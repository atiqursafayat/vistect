/**
 * Page inspection — spec §18, §21.4.
 *
 *   inspect_page   read
 *
 * This is the tool that replaces looking at a page. It answers, in words: what template
 * is this, what regions does it have, what is in each of them, in what order will a
 * screen reader meet them, how much room is left, and what is still missing. Numbers are
 * given as measured whenever `measure_page` has run, and flagged as estimates when not.
 */
import { z } from 'zod';
import type { DocumentObject } from '../model/objects.js';
import { requiresAlternativeText } from '../model/objects.js';
import type { Region } from '../templates.js';
import { getTemplate } from '../templates.js';
import type { ToolDefinition } from './types.js';
import { readOnly } from './types.js';
import { objectLine, pageIdSchema, plural, requirePage, requireProject } from './common.js';

const inspectPageSchema = z.object({
  pageId: pageIdSchema.optional().describe('Defaults to the last page in the document.'),
});

const inRegion = (object: DocumentObject, region: Region): boolean =>
  object.bounds.x >= region.bounds.x - 1 &&
  object.bounds.x < region.bounds.x + region.bounds.width &&
  object.bounds.y >= region.bounds.y - 1 &&
  object.bounds.y < region.bounds.y + region.bounds.height + 1;

export const inspectPage: ToolDefinition<typeof inspectPageSchema> = {
  name: 'inspect_page',
  title: 'Inspect a page',
  description:
    'Describes one page in full: its template and regions, every object with its position and size, the reading order, how much room is left in each region, and what is still missing such as alternative text. Use this before changing a page, and after, to hear what changed.',
  schema: inspectPageSchema,
  annotations: readOnly,
  handle: (input, context) => {
    const project = requireProject(context);
    const page = input.pageId ? requirePage(project, input.pageId) : project.pages.at(-1);
    if (!page) {
      return {
        commands: [],
        result: {
          lead: 'This document has no pages yet.',
          detail: [],
          data: { pageCount: 0 },
        },
      };
    }

    const template = getTemplate(page.templateId);
    const regions = template?.regions ?? [];
    const detail: string[] = [];

    for (const region of regions) {
      const contents = page.objects.filter((o) => inRegion(o, region));
      const used = contents.reduce(
        (bottom, o) => Math.max(bottom, o.bounds.y + o.bounds.height),
        region.bounds.y,
      );
      const remaining = region.bounds.y + region.bounds.height - used;
      detail.push(
        `${region.label} region (${region.id}): ${region.bounds.width} by ${region.bounds.height} pixels at ${region.bounds.x}, ${region.bounds.y}. ${
          contents.length === 0
            ? 'Empty.'
            : `${plural(contents.length, 'object')}, using ${used - region.bounds.y} pixels, ${Math.max(0, remaining)} left${remaining < 0 ? ` — overflowing by ${Math.abs(remaining)}` : ''}.`
        }`,
      );
      for (const object of contents) {
        const index = page.readingOrder.indexOf(object.id);
        detail.push(
          `  ${objectLine(object, index === -1 ? undefined : index)} At ${object.bounds.x}, ${object.bounds.y}, ${object.bounds.width} by ${object.bounds.height} pixels.`,
        );
      }
    }

    const orphans = page.objects.filter((o) => !regions.some((r) => inRegion(o, r)));
    for (const object of orphans) {
      detail.push(`Outside every template region: ${objectLine(object)}`);
    }

    const missingAlt = page.objects.filter(
      (o) => requiresAlternativeText(o) && (o.accessibility.altText ?? '').trim() === '',
    );
    const notInOrder = page.objects.filter(
      (o) => o.accessibility.includedInReadingOrder && !page.readingOrder.includes(o.id),
    );
    if (missingAlt.length > 0) {
      detail.push(
        `${plural(missingAlt.length, 'object')} still ${missingAlt.length === 1 ? 'needs' : 'need'} alternative text: ${missingAlt.map((o) => o.role).join(', ')}.`,
      );
    }
    if (notInOrder.length > 0) {
      detail.push(
        `${plural(notInOrder.length, 'object')} should be in the reading order but ${notInOrder.length === 1 ? 'is' : 'are'} not. Call set_reading_order.`,
      );
    }

    const lead = `Page ${page.pageNumber}${page.title ? ` (${page.title})` : ''} uses the ${template?.name ?? page.templateId} template: ${template?.description ?? 'unknown template.'} ${plural(page.objects.length, 'object')}, ${page.readingOrder.length} in the reading order, status ${page.status}.`;

    return {
      commands: [],
      result: {
        lead,
        detail,
        data: {
          documentVersion: project.activeVersion,
          pageId: page.id,
          pageNumber: page.pageNumber,
          title: page.title,
          templateId: page.templateId,
          status: page.status,
          geometry: project.geometry,
          regions: regions.map((r) => ({
            id: r.id,
            label: r.label,
            bounds: r.bounds,
            flow: r.flow,
          })),
          readingOrder: page.readingOrder,
          objects: page.objects.map((o) => ({
            id: o.id,
            type: o.type,
            role: o.role,
            purpose: o.purpose,
            bounds: o.bounds,
            approval: o.approval.status,
            readingOrderIndex: page.readingOrder.indexOf(o.id),
            accessibility: o.accessibility,
            ...(o.type === 'text'
              ? {
                  textRole: o.textRole,
                  headingLevel: o.headingLevel,
                  content: o.content,
                  items: o.items,
                }
              : {}),
          })),
          objectsMissingAltText: missingAlt.map((o) => o.id),
          objectsMissingFromReadingOrder: notInOrder.map((o) => o.id),
        },
      },
    };
  },
};
