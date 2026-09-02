/**
 * Constructors for model records — spec §8.2, §8.3, §8.4.
 *
 * Commands carry fully-formed data (see `commands.ts`), so *something* has to fill in
 * every required field before a command is built. That is this file. Ids and timestamps
 * arrive as arguments rather than being generated here, which is what keeps the core
 * pure and makes a replayed log reproduce the same document byte for byte.
 */
import type { Bounds, Provenance } from './model/primitives.js';
import { defaultAccessibility, unreviewed, PAGE_GEOMETRY } from './model/primitives.js';
import type { HeadingLevel, TextObject, TextRole } from './model/objects.js';
import type { DocumentProject, IntentContract, Page, Theme } from './model/project.js';
import { defaultIntentContract, defaultTheme } from './defaults.js';

export type Ids = { newId: (prefix: string) => string; now: () => string };

/** Semantic role names used by the object explorer (§21.4) when none is supplied. */
const ROLE_FOR_TEXT: Record<TextRole, string> = {
  heading: 'heading',
  paragraph: 'body',
  list: 'list',
  quote: 'pull-quote',
  callout: 'callout',
  statistic: 'statistic',
  caption: 'figure-caption',
  'source-note': 'source-note',
  footnote: 'footnote',
};

export function newProject(
  input: {
    title: string;
    language?: string;
    intentContract?: IntentContract;
    theme?: Theme;
    pages?: Page[];
  },
  ids: Ids,
): DocumentProject {
  const intentContract = input.intentContract ?? defaultIntentContract();
  return {
    id: ids.newId('doc'),
    title: input.title,
    language: input.language ?? 'en',
    documentType: 'impact-report',
    geometry: PAGE_GEOMETRY,
    intentContract,
    theme: input.theme ?? defaultTheme(intentContract),
    pages: input.pages ?? [],
    assets: [],
    datasets: [],
    decisions: [],
    findings: [],
    // Overwritten by the reducer, which owns version numbering.
    versions: [],
    activeVersion: 0,
    approvalStatus: 'draft',
    createdAt: ids.now(),
    updatedAt: ids.now(),
  };
}

export function newPage(
  input: { templateId: string; pageNumber: number; title?: string },
  ids: Ids,
): Page {
  return {
    id: ids.newId('page'),
    pageNumber: input.pageNumber,
    templateId: input.templateId,
    ...(input.title === undefined ? {} : { title: input.title }),
    objects: [],
    readingOrder: [],
    status: 'draft',
  };
}

export function newTextObject(
  input: {
    pageId: string;
    textRole: TextRole;
    content: string;
    items?: string[];
    ordered?: boolean;
    headingLevel?: HeadingLevel;
    role?: string;
    purpose?: string;
    bounds: Bounds;
    layer?: number;
    by: Provenance;
  },
  ids: Ids,
): TextObject {
  return {
    id: ids.newId('obj'),
    pageId: input.pageId,
    type: 'text',
    role: input.role ?? ROLE_FOR_TEXT[input.textRole],
    ...(input.purpose === undefined ? {} : { purpose: input.purpose }),
    textRole: input.textRole,
    ...(input.headingLevel === undefined ? {} : { headingLevel: input.headingLevel }),
    content: input.content,
    ...(input.items === undefined ? {} : { items: input.items }),
    ...(input.ordered === undefined ? {} : { ordered: input.ordered }),
    bounds: input.bounds,
    relativeConstraints: [],
    layer: input.layer ?? 0,
    accessibility: defaultAccessibility(),
    source: input.by,
    approval: unreviewed(),
    createdBy:
      input.by.origin === 'agent' ? 'agent' : input.by.origin === 'import' ? 'import' : 'user',
    // Overwritten by the reducer, which owns version numbering.
    versionCreated: 0,
    versionModified: 0,
  };
}
