/**
 * D1-3's done-when, as executable assertions:
 *
 *   - every command bumps the version
 *   - a write with a stale `expectedDocumentVersion` is refused with an actionable message
 *   - changing an approved object flips its approval to `stale` (§27)
 *
 * Plus the properties those three depend on: atomic batches, undo by replay, and
 * version numbers that are never handed out twice.
 */
import { describe, expect, it } from 'vitest';
import type { Store } from '../../src/core/store.js';
import { createDocumentStore } from '../../src/core/store.js';
import type { DocumentObject, TextObject } from '../../src/core/model.js';
import { findObject } from '../../src/core/model.js';
import { newPage, newProject } from '../../src/core/factory.js';
import { agent, makeDeps, seededStore, user } from './support/store-fixture.js';

const version = (store: Store): number => store.getState().project?.activeVersion ?? 0;

const objectIn = (store: Store, objectId: string): DocumentObject => {
  const project = store.getState().project;
  if (!project) throw new Error('the store holds no document');
  const found = findObject(project, objectId);
  if (!found) throw new Error(`the store holds no object "${objectId}"`);
  return found.object;
};

/** The same, narrowed, for assertions about a text object's own content. */
const textIn = (store: Store, objectId: string): TextObject => {
  const object = objectIn(store, objectId);
  if (object.type !== 'text') throw new Error(`object "${objectId}" is not a text object`);
  return object;
};

describe('version counter', () => {
  it('starts at 0 and reaches 1 when the document is created', () => {
    const deps = makeDeps();
    const store = createDocumentStore(deps);
    expect(store.getState().project).toBeUndefined();

    const project = newProject({ title: 'Annual Impact Report' }, deps);
    const result = store.dispatch({
      commands: [{ kind: 'create-document', project }],
      by: agent('create_document'),
      toolName: 'create_document',
    });

    expect(result.ok).toBe(true);
    expect(store.getState().project?.activeVersion).toBe(1);
    expect(store.getState().project?.versions).toHaveLength(1);
    expect(store.getState().project?.versions[0]?.summary).toContain('Annual Impact Report');
  });

  it('bumps the version once per command, not once per tool call', () => {
    const deps = makeDeps();
    const store = createDocumentStore(deps);
    const project = newProject({ title: 'Report' }, deps);
    store.dispatch({
      commands: [{ kind: 'create-document', project }],
      by: agent('create_document'),
    });

    const result = store.dispatch({
      commands: [
        { kind: 'add-page', page: newPage({ templateId: 'text-led', pageNumber: 2 }, deps) },
        { kind: 'add-page', page: newPage({ templateId: 'chart-page', pageNumber: 3 }, deps) },
        {
          kind: 'update-intent-contract',
          patch: { purpose: 'Report on employment outcomes.' },
        },
      ],
      by: agent('create_document'),
      expectedDocumentVersion: 1,
    });

    expect(result.ok && result.versionBefore).toBe(1);
    expect(result.ok && result.versionAfter).toBe(4);
    expect(store.getState().log.map((e) => e.resultingVersion)).toEqual([1, 2, 3, 4]);
    expect(store.getState().project?.versions).toHaveLength(4);
  });
});

describe('stale-write rejection', () => {
  it('refuses a write against an old version and says how to recover', () => {
    const { store, pageId } = seededStore();
    const currentVersion = store.getState().project?.activeVersion;
    expect(currentVersion).toBe(2);

    const result = store.dispatch({
      commands: [{ kind: 'set-page-status', pageId, status: 'review' }],
      by: agent('set_page_status'),
      toolName: 'set_page_status',
      expectedDocumentVersion: 1,
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe('stale-write');
    expect(result.currentVersion).toBe(2);
    // Actionable: both version numbers, why it moved, and the exact next call.
    expect(result.message).toContain('version 1');
    expect(result.message).toContain('version 2');
    expect(result.message).toContain('Employment outcomes');
    expect(result.message).toContain('get_document_overview');
    expect(result.message).toContain('expectedDocumentVersion: 2');
  });

  it('changes nothing when it refuses', () => {
    const { store, pageId } = seededStore();
    const before = store.getState();

    store.dispatch({
      commands: [{ kind: 'set-page-status', pageId, status: 'approved' }],
      by: agent('set_page_status'),
      expectedDocumentVersion: 99,
    });

    const after = store.getState();
    expect(after.project).toBe(before.project);
    expect(after.log).toBe(before.log);
    expect(after.nextVersion).toBe(before.nextVersion);
  });

  it('refuses a write that omits the version entirely', () => {
    const { store, pageId } = seededStore();
    const result = store.dispatch({
      commands: [{ kind: 'set-page-status', pageId, status: 'review' }],
      by: agent('set_page_status'),
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe('missing-expected-version');
    expect(result.message).toContain('expectedDocumentVersion: 2');
  });

  it('records the refusal in the activity stream rather than hiding it', () => {
    const { store, pageId } = seededStore();
    store.dispatch({
      commands: [{ kind: 'set-page-status', pageId, status: 'review' }],
      by: agent('set_page_status'),
      toolName: 'set_page_status',
      expectedDocumentVersion: 1,
    });

    const last = store.getState().activity.at(-1);
    expect(last?.outcome).toBe('rejected');
    expect(last?.toolName).toBe('set_page_status');
    expect(last?.detail.join(' ')).toContain('Nothing changed');
  });
});

/** §27: an approval cannot outlive the thing it approved. */
describe('approval invalidation', () => {
  const approve = (store: Store, objectId: string) => {
    const at = version(store);
    const result = store.dispatch({
      commands: [
        {
          kind: 'set-object-approval',
          objectId,
          approval: {
            status: 'approved',
            approvedBy: 'Atiqur',
            approvedAt: '2026-09-04T09:30:00.000Z',
            approvedVersion: at,
          },
        },
      ],
      by: user(),
      toolName: 'approve_object',
      expectedDocumentVersion: at,
    });
    expect(result.ok).toBe(true);
  };

  it('flips an approved object to stale when its content changes', () => {
    const { store, headingId } = seededStore();
    approve(store, headingId);
    expect(objectIn(store, headingId).approval.status).toBe('approved');

    const result = store.dispatch({
      commands: [
        { kind: 'update-text-content', objectId: headingId, content: 'Jobs and training' },
      ],
      by: agent('update_text_content'),
      toolName: 'update_text_content',
      expectedDocumentVersion: version(store),
    });

    expect(result.ok && result.invalidatedObjectIds).toEqual([headingId]);
    const object = objectIn(store, headingId);
    expect(object.approval.status).toBe('stale');
    // The audit trail keeps who signed off and when, even though it no longer counts.
    expect(object.approval.approvedBy).toBe('Atiqur');
    expect(object.approval.approvedVersion).toBe(2);
    expect(object.versionModified).toBe(4);
  });

  it('tells the user out loud that an approval was cleared', () => {
    const { store, headingId } = seededStore();
    approve(store, headingId);
    store.dispatch({
      commands: [{ kind: 'update-text-content', objectId: headingId, content: 'Jobs' }],
      by: agent('update_text_content'),
      toolName: 'update_text_content',
      expectedDocumentVersion: version(store),
    });

    expect(store.getState().activity.at(-1)?.detail.join(' ')).toContain('needing review');
  });

  it('marks an approved decision stale when the object it governs changes', () => {
    const { store, headingId } = seededStore();
    const staged = version(store);
    store.dispatch({
      commands: [
        {
          kind: 'record-decision',
          decision: {
            id: 'dec-1',
            decisionType: 'alt-text',
            summary: 'Heading wording chosen to lead with the outcome, not the programme.',
            targetIds: [headingId],
            optionsReviewed: [{ id: 'a', label: 'Employment outcomes' }],
            selectedOptionId: 'a',
            evidenceType: 'human_review',
            suggestedBy: agent('propose_heading'),
            status: 'approved',
            approvedBy: 'Atiqur',
            approvedAt: '2026-09-04T09:30:00.000Z',
            stagedAtVersion: staged,
            approvedVersion: staged,
          },
        },
      ],
      by: user(),
      toolName: 'approve_decision',
      expectedDocumentVersion: staged,
    });

    const result = store.dispatch({
      commands: [{ kind: 'update-text-content', objectId: headingId, content: 'Jobs' }],
      by: agent('update_text_content'),
      toolName: 'update_text_content',
      expectedDocumentVersion: version(store),
    });

    expect(result.ok && result.invalidatedDecisionIds).toEqual(['dec-1']);
    const decision = store.getState().project?.decisions.find((d) => d.id === 'dec-1');
    expect(decision?.status).toBe('stale');
    expect(decision?.staleReason).toContain('may no longer hold');
  });

  it('leaves an approval alone when only measured geometry is written back', () => {
    const { store, headingId } = seededStore();
    approve(store, headingId);

    // measure_page writes what the browser found; it is not an editorial change (§27).
    const result = store.dispatch({
      commands: [
        {
          kind: 'set-object-bounds',
          objectId: headingId,
          bounds: { x: 72, y: 72, width: 672, height: 61 },
        },
      ],
      by: { origin: 'system', createdAt: '2026-09-04T09:31:00.000Z' },
      toolName: 'measure_page',
      expectedDocumentVersion: version(store),
    });

    expect(result.ok && result.invalidatedObjectIds).toEqual([]);
    expect(objectIn(store, headingId).approval.status).toBe('approved');
  });
});

describe('atomic batches', () => {
  it('applies nothing when a later command in the batch fails', () => {
    const { store, pageId } = seededStore();
    const before = store.getState();

    const result = store.dispatch({
      commands: [
        { kind: 'set-page-status', pageId, status: 'review' },
        { kind: 'set-page-status', pageId: 'page-does-not-exist', status: 'review' },
      ],
      by: agent('set_page_status'),
      toolName: 'set_page_status',
      expectedDocumentVersion: version(store),
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe('page-not-found');
    expect(result.message).toContain('get_document_structure');
    // The first command's effect is gone too — the page is still a draft at version 2.
    expect(store.getState().project).toBe(before.project);
    expect(version(store)).toBe(2);
    expect(store.getState().log).toHaveLength(2);
  });
});

describe('reading order', () => {
  it('refuses an order that omits an object a screen reader would reach', () => {
    const { store, pageId } = seededStore();
    const result = store.dispatch({
      commands: [{ kind: 'set-reading-order', pageId, readingOrder: [] }],
      by: agent('set_reading_order'),
      toolName: 'set_reading_order',
      expectedDocumentVersion: version(store),
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe('reading-order-incomplete');
    expect(result.message).toContain('Missing');
  });
});

describe('undo', () => {
  it('undoes a whole tool call, not one command of it', () => {
    const { store, deps } = seededStore();
    store.dispatch({
      commands: [
        { kind: 'add-page', page: newPage({ templateId: 'chart-page', pageNumber: 2 }, deps) },
        { kind: 'update-intent-contract', patch: { purpose: 'Report on outcomes.' } },
      ],
      by: agent('apply_page_template'),
      toolName: 'apply_page_template',
      expectedDocumentVersion: version(store),
    });
    expect(store.getState().project?.pages).toHaveLength(2);
    expect(version(store)).toBe(4);

    const undone = store.undo();

    expect(undone.ok).toBe(true);
    expect(undone.ok && undone.undoneSummaries).toHaveLength(2);
    expect(store.getState().project?.pages).toHaveLength(1);
    expect(store.getState().project?.intentContract.purpose).toBe('');
    expect(version(store)).toBe(2);
    expect(store.getState().log).toHaveLength(2);
  });

  it('never hands the same version number out twice', () => {
    const { store, pageId } = seededStore();
    store.undo();
    expect(version(store)).toBe(1);

    const result = store.dispatch({
      commands: [{ kind: 'set-page-status', pageId, status: 'review' }],
      by: agent('set_page_status'),
      expectedDocumentVersion: 1,
    });

    // Version 2 was consumed by the undone command and is not reissued.
    expect(result.ok && result.versionAfter).toBe(3);
  });

  it('says so plainly when there is nothing to undo', () => {
    const deps = makeDeps();
    const store = createDocumentStore(deps);
    const result = store.undo();
    expect(result.ok).toBe(false);
    expect(result.ok || result.message).toContain('nothing to undo');
  });

  it('can undo all the way back to an empty session', () => {
    const { store } = seededStore();
    store.undo();
    store.undo();
    expect(store.getState().project).toBeUndefined();
    expect(store.canUndo()).toBe(false);
  });
});

describe('activity stream', () => {
  it('records a read-only call without changing the document', () => {
    const { store } = seededStore();
    const before = store.getState();

    store.recordRead({
      by: agent('get_document_overview'),
      toolName: 'get_document_overview',
      summary: '"Annual Impact Report", 1 page, version 2, draft.',
      detail: ['1 page: page 1 (Outcomes), text-led, draft.'],
    });

    const after = store.getState();
    expect(after.project).toBe(before.project);
    expect(after.log).toHaveLength(before.log.length);
    expect(version(store)).toBe(2);
    expect(after.activity.at(-1)?.outcome).toBe('read');
    expect(after.activity.at(-1)?.documentVersion).toBe(2);
  });

  it('notifies subscribers once per change', () => {
    const { store, pageId } = seededStore();
    let calls = 0;
    const unsubscribe = store.subscribe(() => {
      calls += 1;
    });

    store.dispatch({
      commands: [{ kind: 'set-page-status', pageId, status: 'review' }],
      by: agent('set_page_status'),
      expectedDocumentVersion: version(store),
    });
    expect(calls).toBe(1);

    unsubscribe();
    store.recordRead({ by: agent('inspect_page'), toolName: 'inspect_page', summary: 'Read.' });
    expect(calls).toBe(1);
  });
});

describe('persistence', () => {
  it('rebuilds the identical document by replaying a saved log', () => {
    const { store, headingId } = seededStore();
    const saved = JSON.parse(JSON.stringify(store.snapshot())) as ReturnType<Store['snapshot']>;

    const restored = createDocumentStore(makeDeps());
    restored.hydrate(saved);

    expect(restored.getState().project).toStrictEqual(store.getState().project);
    expect(version(restored)).toBe(2);
    expect(textIn(restored, headingId).content).toBe('Employment outcomes');
    // Ids came from the log, not from the fresh generator, so replay is reproduction.
    expect(restored.getState().project?.id).toBe('doc-1');
  });

  it('keeps issuing fresh version numbers after a restore', () => {
    const { store, pageId } = seededStore();
    const restored = createDocumentStore(makeDeps());
    restored.hydrate(store.snapshot());

    const result = restored.dispatch({
      commands: [{ kind: 'set-page-status', pageId, status: 'review' }],
      by: agent('set_page_status'),
      expectedDocumentVersion: 2,
    });
    expect(result.ok && result.versionAfter).toBe(3);
  });

  it('refuses a snapshot from a save format it does not understand', () => {
    const store = createDocumentStore(makeDeps());
    expect(() =>
      store.hydrate({ schema: 2 as 1, log: [], activity: [], nextVersion: 1 }),
    ).toThrow(/cannot open/);
  });
});
