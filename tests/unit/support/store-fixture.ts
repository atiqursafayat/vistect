/**
 * Deterministic doubles for the injected clock and id generator.
 *
 * Every id is `prefix-n` and every timestamp is one second after the last, so a test
 * can assert on exact values and a replayed log produces exactly the same document.
 */
import type { Provenance } from '../../../src/core/model/primitives.js';
import type { Command } from '../../../src/core/commands.js';
import type { Store, StoreDeps } from '../../../src/core/store.js';
import { createDocumentStore } from '../../../src/core/store.js';
import { newPage, newProject, newTextObject } from '../../../src/core/factory.js';
import { getRegion } from '../../../src/core/templates.js';
import { defaultTheme } from '../../../src/core/defaults.js';
import { estimateTextHeight, nextFlowBounds, textMetrics } from '../../../src/core/layout.js';

export const START = Date.parse('2026-09-04T09:00:00.000Z');

export function makeDeps(): StoreDeps & { newId: (prefix: string) => string } {
  const counters = new Map<string, number>();
  let clock = START;
  return {
    newId: (prefix: string) => {
      const next = (counters.get(prefix) ?? 0) + 1;
      counters.set(prefix, next);
      return `${prefix}-${next}`;
    },
    now: () => {
      clock += 1000;
      return new Date(clock).toISOString();
    },
  };
}

export const agent = (toolName: string): Provenance => ({
  origin: 'agent',
  agentName: 'test-agent',
  toolName,
  createdAt: new Date(START).toISOString(),
});

export const user = (): Provenance => ({
  origin: 'user',
  createdAt: new Date(START).toISOString(),
});

/** A store holding one text-led page. Returns the ids the tests need to address it. */
export function seededStore(): {
  store: Store;
  deps: StoreDeps;
  pageId: string;
  headingId: string;
} {
  const deps = makeDeps();
  const store = createDocumentStore(deps);
  const page = newPage({ templateId: 'text-led', pageNumber: 1, title: 'Outcomes' }, deps);
  const project = newProject({ title: 'Annual Impact Report', pages: [page] }, deps);

  const created = store.dispatch({
    commands: [{ kind: 'create-document', project }],
    by: agent('create_document'),
    toolName: 'create_document',
  });
  if (!created.ok) throw new Error(`fixture failed to create a document: ${created.message}`);

  const heading = addHeading(store, page.id, 'Employment outcomes', deps);
  return { store, deps, pageId: page.id, headingId: heading };
}

/** Places a level-2 heading into the page's default flow region, the way D1-4 will. */
export function addHeading(
  store: Store,
  pageId: string,
  content: string,
  deps: StoreDeps,
): string {
  const state = store.getState();
  const project = state.project;
  if (!project) throw new Error('no document');
  const page = project.pages.find((p) => p.id === pageId);
  if (!page) throw new Error(`no page ${pageId}`);
  const region = getRegion(page.templateId, 'flow');
  if (!region) throw new Error(`template ${page.templateId} has no flow region`);

  const theme = defaultTheme();
  const metrics = textMetrics(theme, 'heading', 2);
  const height = estimateTextHeight(
    { textRole: 'heading', content, headingLevel: 2 },
    region.bounds.width,
    theme,
  );
  const object = newTextObject(
    {
      pageId,
      textRole: 'heading',
      headingLevel: 2,
      content,
      bounds: nextFlowBounds(region, page.objects, height, metrics.spaceAbovePx),
      by: agent('add_text_section'),
    },
    deps,
  );
  const command: Command = { kind: 'add-object', pageId, object };
  const result = store.dispatch({
    commands: [command],
    by: agent('add_text_section'),
    toolName: 'add_text_section',
    expectedDocumentVersion: project.activeVersion,
  });
  if (!result.ok) throw new Error(`fixture failed to add a heading: ${result.message}`);
  return object.id;
}
