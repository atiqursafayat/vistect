/**
 * The tool layer: schemas, the published JSON Schema, and the one runner both callers use.
 *
 * The §34 demo script is asserted end to end here — create_document, then
 * add_text_section, then inspect_page — because that sequence is Day 1's done-when and it
 * must keep working without a browser in the loop.
 */
import { describe, expect, it } from 'vitest';
import { createDocumentStore } from '../../src/core/store.js';
import {
  TOOLS,
  TOOL_NAMES,
  createToolRunner,
  getTool,
  toolInputSchema,
} from '../../src/core/tools/registry.js';
import { agent, makeDeps, user } from './support/store-fixture.js';

const runner = () => {
  const deps = makeDeps();
  const store = createDocumentStore(deps);
  return { store, run: createToolRunner(store, deps) };
};

describe('the registry', () => {
  it('publishes Day 1’s six tools, each named once', () => {
    expect(TOOL_NAMES).toEqual([
      'create_document',
      'update_intent_contract',
      'get_document_overview',
      'get_document_structure',
      'add_text_section',
      'inspect_page',
    ]);
    expect(new Set(TOOL_NAMES).size).toBe(TOOL_NAMES.length);
  });

  it('describes every tool well enough for an agent to choose it', () => {
    for (const tool of TOOLS) {
      expect(tool.title.length).toBeGreaterThan(0);
      // Long enough to say when to use it and when not to; short enough to stay read.
      expect(tool.description.length).toBeGreaterThan(80);
      expect(tool.description.length).toBeLessThan(600);
    }
  });

  it('marks read-only tools read-only and nothing as destructive', () => {
    const reads = ['get_document_overview', 'get_document_structure', 'inspect_page'];
    for (const tool of TOOLS) {
      expect(tool.annotations.readOnlyHint).toBe(reads.includes(tool.name));
      expect(tool.annotations.destructiveHint).toBe(false);
      expect(tool.annotations.openWorldHint).toBe(false);
    }
  });

  it('turns every schema into JSON Schema an agent can read', () => {
    for (const tool of TOOLS) {
      const schema = toolInputSchema(tool);
      expect(schema['type']).toBe('object');
      expect(schema['$schema']).toBeUndefined();
      expect(schema['properties']).toBeTypeOf('object');
    }
  });

  it('requires expectedDocumentVersion on every write except create_document', () => {
    for (const tool of TOOLS) {
      if (tool.annotations.readOnlyHint || tool.name === 'create_document') continue;
      const schema = toolInputSchema(tool);
      expect(schema['required']).toContain('expectedDocumentVersion');
    }
    expect(toolInputSchema(getTool('create_document') as never)['required']).not.toContain(
      'expectedDocumentVersion',
    );
  });

  it('keeps defaulted fields optional in the published schema', () => {
    const schema = toolInputSchema(getTool('create_document') as never);
    expect(schema['required']).toEqual(['title', 'purpose']);
    const properties = schema['properties'] as Record<string, { description?: string }>;
    expect(properties['pageTemplates']?.description).toContain('cover');
  });
});

describe('the Day 1 demo path', () => {
  it('creates a document, adds two sections, and reads the page back', () => {
    const { run } = runner();

    const created = run(
      'create_document',
      {
        title: 'Annual Impact Report 2026',
        purpose: 'Show funders what changed for the people we work with this year.',
        audience: ['funders', 'local authority partners'],
        primaryMessage: 'Supported employment works when it is sustained.',
        tone: ['plain', 'confident'],
      },
      agent('create_document'),
    );

    expect(created.ok).toBe(true);
    expect(created.lead).toContain('Annual Impact Report 2026');
    expect(created.lead).toContain('2 pages');
    expect(created.lead).toContain('version 1');
    expect(created.documentVersion).toBe(1);
    expect(created.data['documentId']).toBe('doc-1');
    expect(created.data['pages']).toEqual([
      { id: 'page-1', pageNumber: 1, templateId: 'cover' },
      { id: 'page-2', pageNumber: 2, templateId: 'text-led' },
    ]);
    // Purpose, audience, primary message and tone were all supplied, so nothing is missing.
    expect(created.data['intentContractGaps']).toEqual([]);

    const heading = run(
      'add_text_section',
      {
        expectedDocumentVersion: 1,
        pageId: 'page-2',
        textRole: 'heading',
        headingLevel: 2,
        content: 'Employment outcomes',
      },
      agent('add_text_section'),
    );

    expect(heading.ok).toBe(true);
    expect(heading.lead).toContain('a level 2 heading');
    expect(heading.lead).toContain('"Employment outcomes"');
    expect(heading.lead).toContain('version 2');
    expect(heading.data['objectId']).toBe('obj-1');
    expect(heading.data['regionId']).toBe('flow');
    expect(heading.data['readingOrderIndex']).toBe(0);
    expect(heading.data['boundsAreEstimated']).toBe(true);

    const paragraph = run(
      'add_text_section',
      {
        expectedDocumentVersion: 2,
        pageId: 'page-2',
        textRole: 'paragraph',
        content:
          'Forty-one people started work this year, and thirty-two were still in post twelve months later.',
      },
      agent('add_text_section'),
    );

    expect(paragraph.ok).toBe(true);
    expect(paragraph.data['readingOrderIndex']).toBe(1);
    // Placed below the heading, not on top of it.
    const above = heading.data['bounds'] as { y: number; height: number };
    const below = paragraph.data['bounds'] as { y: number };
    expect(below.y).toBeGreaterThanOrEqual(above.y + above.height);

    const inspected = run('inspect_page', { pageId: 'page-2' }, agent('inspect_page'));

    expect(inspected.ok).toBe(true);
    expect(inspected.lead).toContain('Page 2');
    expect(inspected.lead).toContain('2 objects');
    expect(inspected.lead).toContain('2 in the reading order');
    expect(inspected.data['readingOrder']).toEqual(['obj-1', 'obj-2']);
    expect(inspected.data['objectsMissingAltText']).toEqual([]);
    // A read never advances the version.
    expect(inspected.documentVersion).toBe(3);
    expect(inspected.detail.some((line) => line.includes('Main column region (flow)'))).toBe(
      true,
    );
    expect(inspected.detail.some((line) => line.includes('Employment outcomes'))).toBe(true);
  });
});

/**
 * Every failure below is one an agent has to recover from without a human reading a stack
 * trace. The assertions are on the words, because the words are the interface.
 */
describe('failures an agent has to recover from', () => {
  it('never throws, whatever it is handed', () => {
    const { run } = runner();
    const by = agent('create_document');
    for (const input of [undefined, null, 'a string', 42, [], { title: 'no purpose' }]) {
      expect(() => run('create_document', input, by)).not.toThrow();
    }
  });

  it('names the available tools when the tool does not exist', () => {
    const { run } = runner();
    const result = run('add_chart', {}, agent('add_chart'));
    expect(result.ok).toBe(false);
    expect(result.code).toBe('unknown-tool');
    expect(result.lead).toContain('add_chart');
    for (const name of TOOL_NAMES) expect(result.lead).toContain(name);
  });

  it('says which field is wrong and why', () => {
    const { run } = runner();
    run(
      'create_document',
      { title: 'Report', purpose: 'Show what changed.' },
      agent('create_document'),
    );

    const result = run(
      'add_text_section',
      { expectedDocumentVersion: 1, textRole: 'heading', content: 'No level given' },
      agent('add_text_section'),
    );

    expect(result.ok).toBe(false);
    expect(result.code).toBe('invalid-input');
    expect(result.lead).toContain('headingLevel');
    expect(result.detail).toContain(
      'headingLevel: A heading needs a headingLevel between 1 and 4.',
    );
    // The refusal cost nothing.
    expect(result.documentVersion).toBe(1);
  });

  it('tells the caller to create a document first', () => {
    const { run } = runner();
    const result = run('get_document_overview', {}, agent('get_document_overview'));
    expect(result.ok).toBe(false);
    expect(result.code).toBe('no-document');
    expect(result.lead).toContain('create_document');
  });

  it('refuses a stale write with the version to retry at', () => {
    const { run } = runner();
    run(
      'create_document',
      { title: 'Report', purpose: 'Show what changed.' },
      agent('create_document'),
    );
    run(
      'add_text_section',
      {
        expectedDocumentVersion: 1,
        pageId: 'page-2',
        textRole: 'heading',
        headingLevel: 2,
        content: 'Outcomes',
      },
      agent('add_text_section'),
    );

    const stale = run(
      'add_text_section',
      {
        expectedDocumentVersion: 1,
        pageId: 'page-2',
        textRole: 'paragraph',
        content: 'Written against the old version.',
      },
      agent('add_text_section'),
    );

    expect(stale.ok).toBe(false);
    expect(stale.code).toBe('stale-write');
    expect(stale.lead).toContain('version 1');
    expect(stale.lead).toContain('version 2');
    expect(stale.lead).toContain('expectedDocumentVersion: 2');
    expect(stale.documentVersion).toBe(2);
  });

  it('refuses to flow text into a region that holds a single visual', () => {
    const { run } = runner();
    run(
      'create_document',
      {
        title: 'Report',
        purpose: 'Show what changed.',
        pageTemplates: ['text-with-side-image'],
      },
      agent('create_document'),
    );

    const result = run(
      'add_text_section',
      {
        expectedDocumentVersion: 1,
        region: 'figure',
        textRole: 'paragraph',
        content: 'Not a caption.',
      },
      agent('add_text_section'),
    );

    expect(result.ok).toBe(false);
    expect(result.code).toBe('region-not-a-text-region');
    // Says what to use instead, not just what went wrong.
    expect(result.lead).toContain('"flow"');
  });

  it('lists the page ids it knows when given one it does not', () => {
    const { run } = runner();
    run(
      'create_document',
      { title: 'Report', purpose: 'Show what changed.' },
      agent('create_document'),
    );
    const result = run('inspect_page', { pageId: 'page-9' }, agent('inspect_page'));
    expect(result.ok).toBe(false);
    expect(result.code).toBe('page-not-found');
    expect(result.lead).toContain('page-1');
    expect(result.lead).toContain('page-2');
  });

  it('says so when an update would change nothing', () => {
    const { run } = runner();
    run(
      'create_document',
      { title: 'Report', purpose: 'Show what changed.' },
      agent('create_document'),
    );
    const result = run(
      'update_intent_contract',
      { expectedDocumentVersion: 1 },
      agent('update_intent_contract'),
    );
    expect(result.ok).toBe(false);
    expect(result.code).toBe('nothing-to-update');
    expect(result.lead).toContain('primaryMessage');
  });
});

describe('what the activity stream records', () => {
  it('logs reads, writes and refusals, and only writes move the version', () => {
    const { store, run } = runner();
    run(
      'create_document',
      { title: 'Report', purpose: 'Show what changed.' },
      agent('create_document'),
    );
    run('get_document_structure', {}, agent('get_document_structure'));
    run(
      'add_text_section',
      { expectedDocumentVersion: 99, textRole: 'paragraph', content: 'Stale.' },
      agent('add_text_section'),
    );

    const activity = store.getState().activity;
    expect(activity.map((e) => e.outcome)).toEqual(['applied', 'read', 'rejected']);
    expect(activity.map((e) => e.toolName)).toEqual([
      'create_document',
      'get_document_structure',
      'add_text_section',
    ]);
    expect(activity.map((e) => e.documentVersion)).toEqual([1, 1, 1]);
    expect(store.getState().log).toHaveLength(1);
  });

  it('tells the user out loud when a change invalidated an approval', () => {
    const { store, run } = runner();
    run(
      'create_document',
      { title: 'Report', purpose: 'Show what changed.' },
      agent('create_document'),
    );
    const added = run(
      'add_text_section',
      {
        expectedDocumentVersion: 1,
        pageId: 'page-2',
        textRole: 'heading',
        headingLevel: 2,
        content: 'Outcomes',
      },
      agent('add_text_section'),
    );
    const objectId = added.data['objectId'] as string;

    const approved = store.dispatch({
      commands: [
        {
          kind: 'set-object-approval',
          objectId,
          approval: {
            status: 'approved',
            approvedBy: 'Atiqur',
            approvedAt: new Date().toISOString(),
            approvedVersion: 2,
          },
        },
      ],
      by: user(),
      expectedDocumentVersion: 2,
    });
    expect(approved.ok).toBe(true);

    const rewritten = store.dispatch({
      commands: [{ kind: 'update-text-content', objectId, content: 'Employment outcomes' }],
      by: user(),
      expectedDocumentVersion: 3,
    });
    expect(rewritten.ok && rewritten.invalidatedObjectIds).toEqual([objectId]);

    const inspected = run('inspect_page', { pageId: 'page-2' }, agent('inspect_page'));
    const objects = inspected.data['objects'] as { approval: string }[];
    expect(objects[0]?.approval).toBe('stale');
  });
});
