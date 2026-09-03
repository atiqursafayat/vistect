/**
 * Shared schema fragments and prose helpers for the tool layer.
 *
 * The prose helpers matter as much as the schemas: every tool describes a page or an
 * object with the same words, so a user hearing the activity stream, the navigator and
 * a tool response does not have to work out that three different phrasings mean the
 * same thing.
 */
import { z } from 'zod';
import { CommandError } from '../commands.js';
import type { DocumentObject } from '../model/objects.js';
import { objectText, requiresAlternativeText } from '../model/objects.js';
import type { DocumentProject, Page } from '../model/project.js';
import type { ToolContext } from './types.js';

export const expectedDocumentVersionSchema = z
  .int()
  .min(0)
  .describe(
    'The document version this change is written against. Read it from get_document_overview or any read tool. If the document has moved on since then, the write is refused instead of silently overwriting the newer state.',
  );

export const pageIdSchema = z
  .string()
  .min(1)
  .describe('A page id from get_document_structure, for example "page-1".');

export const plural = (count: number, one: string, many = `${one}s`): string =>
  `${count} ${count === 1 ? one : many}`;

export function requireProject(context: ToolContext): DocumentProject {
  if (!context.project) {
    throw new CommandError(
      'no-document',
      'There is no document yet. Call create_document first, with a title and the purpose of the report.',
    );
  }
  return context.project;
}

export function requirePage(project: DocumentProject, pageId: string): Page {
  const page = project.pages.find((p) => p.id === pageId);
  if (!page) {
    const known = project.pages.map((p) => p.id).join(', ');
    throw new CommandError(
      'page-not-found',
      `There is no page with id "${pageId}". This document has ${plural(project.pages.length, 'page')}: ${known || 'none'}.`,
    );
  }
  return page;
}

/** One line per page, as heard in the navigator tree (§21.2). */
export function pageLine(page: Page): string {
  const title = page.title ? ` "${page.title}"` : '';
  return `Page ${page.pageNumber}${title}: ${page.templateId} template, ${page.status}, ${plural(page.objects.length, 'object')}.`;
}

/** One line per object, naming what it says before what it is made of (§21.4). */
export function objectLine(object: DocumentObject, readingOrderIndex?: number): string {
  const position = readingOrderIndex === undefined ? '' : `${readingOrderIndex + 1}. `;
  const text = objectText(object);
  const what = text ? `${describeKind(object)}: "${text}"` : describeKind(object);
  const notes: string[] = [`${object.approval.status}`];
  if (requiresAlternativeText(object)) {
    notes.push(object.accessibility.altText ? 'has alt text' : 'alt text still needed');
  }
  if (object.accessibility.isDecorative) notes.push('decorative, hidden from screen readers');
  return `${position}${what} — ${notes.join(', ')}.`;
}

/**
 * "Heading level 2", "Paragraph", "Chart" — what the thing *is*, in one phrase.
 *
 * Exported because the navigator and the object explorer say it too, and three spellings of
 * the same object kind is three things for a user to reconcile.
 */
export function describeKind(object: DocumentObject): string {
  if (object.type === 'text') {
    return object.textRole === 'heading'
      ? `Heading level ${object.headingLevel ?? 2}`
      : capitalise(object.textRole.replace('-', ' '));
  }
  return capitalise(object.type);
}

const capitalise = (value: string): string => value.charAt(0).toUpperCase() + value.slice(1);

/**
 * §7 fields that are still blank. Reported by every document-level tool, because an
 * agent that cannot see the gaps will happily recommend visuals against an empty brief.
 */
export function contractGaps(project: DocumentProject): string[] {
  const c = project.intentContract;
  const gaps: string[] = [];
  if (c.purpose.trim() === '') gaps.push('purpose');
  if (c.audience.length === 0) gaps.push('audience');
  if (c.primaryMessage.trim() === '') gaps.push('primary message');
  if (c.tone.length === 0) gaps.push('tone');
  return gaps;
}

/** Objects that carry meaning but have no alt text yet (§16.2). */
export function altTextGaps(project: DocumentProject): DocumentObject[] {
  return project.pages.flatMap((page) =>
    page.objects.filter(
      (o) => requiresAlternativeText(o) && (o.accessibility.altText ?? '').trim() === '',
    ),
  );
}
