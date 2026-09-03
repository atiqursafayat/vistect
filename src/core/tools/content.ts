/**
 * Content tools — spec §18, §10.2.
 *
 *   add_text_section   write
 *
 * The design point of §4.2: the caller names a *region*, never coordinates. Position is
 * derived from the template and the objects already in that region, so an agent that
 * cannot see the page can still put text in the right place. Geometry here is an
 * estimate (see `core/layout.ts`); `measure_page` replaces it with measured truth.
 */
import { z } from 'zod';
import { CommandError } from '../commands.js';
import { newTextObject } from '../factory.js';
import { estimateTextHeight, nextFlowBounds, overflowsRegion, textMetrics } from '../layout.js';
import { TEXT_ROLES } from '../model/objects.js';
import { REGION_IDS, getTemplate } from '../templates.js';
import type { RegionId } from '../templates.js';
import type { ToolDefinition } from './types.js';
import { writes } from './types.js';
import {
  expectedDocumentVersionSchema,
  pageIdSchema,
  requirePage,
  requireProject,
} from './common.js';

const addTextSectionSchema = z
  .object({
    expectedDocumentVersion: expectedDocumentVersionSchema,
    pageId: pageIdSchema.optional().describe('Defaults to the last page in the document.'),
    region: z
      .enum([...REGION_IDS] as [RegionId, ...RegionId[]])
      .optional()
      .describe(
        "Which region of the page template to place it in. Defaults to the template's main text region. Call inspect_page to see the regions a page has.",
      ),
    textRole: z
      .enum([...TEXT_ROLES] as [string, ...string[]])
      .describe(
        'The semantic role. "heading" also needs headingLevel. "list" takes items instead of content. Roles carry through to the exported HTML, so choose the one that is true rather than the one that looks right.',
      ),
    headingLevel: z
      .union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)])
      .optional()
      .describe('Required when textRole is "heading". Do not skip levels (§10.2).'),
    content: z.string().min(1).optional().describe('Plain text. Markup is not interpreted.'),
    items: z.array(z.string().min(1)).min(1).optional().describe('Use with textRole "list".'),
    ordered: z.boolean().optional().describe('Numbered rather than bulleted list.'),
    purpose: z
      .string()
      .min(1)
      .optional()
      .describe('Why this section is on the page. Read back in the object explorer.'),
    readingOrderIndex: z
      .int()
      .min(0)
      .optional()
      .describe('Where in the reading order to insert it. Defaults to the end.'),
  })
  .refine((v) => v.textRole !== 'heading' || v.headingLevel !== undefined, {
    message: 'A heading needs a headingLevel between 1 and 4.',
    path: ['headingLevel'],
  })
  .refine((v) => v.textRole !== 'list' || (v.items?.length ?? 0) > 0, {
    message: 'A list needs items.',
    path: ['items'],
  })
  .refine((v) => v.textRole === 'list' || (v.content ?? '').trim().length > 0, {
    message: 'This text role needs content.',
    path: ['content'],
  });

export const addTextSection: ToolDefinition<typeof addTextSectionSchema> = {
  name: 'add_text_section',
  title: 'Add a text section',
  description:
    'Adds a heading, paragraph, list, quote, callout, statistic, caption, source note or footnote to a page region. Position is worked out from the template and what is already in that region — you never supply coordinates. Returns the object id and where it landed in the reading order.',
  schema: addTextSectionSchema,
  annotations: writes(),
  handle: (input, context) => {
    const project = requireProject(context);
    const page = input.pageId ? requirePage(project, input.pageId) : project.pages.at(-1);
    if (!page) {
      throw new CommandError(
        'no-pages',
        'This document has no pages yet, so there is nowhere to put text. Add a page first.',
      );
    }

    const template = getTemplate(page.templateId);
    if (!template) {
      throw new CommandError(
        'template-not-found',
        `Page ${page.pageNumber} uses template "${page.templateId}", which is not a known template.`,
      );
    }

    const regionId = input.region ?? template.defaultTextRegion;
    const region = template.regions.find((r) => r.id === regionId);
    if (!region) {
      throw new CommandError(
        'region-not-found',
        `The ${template.name} template has no "${regionId}" region. It has: ${template.regions.map((r) => `${r.id} (${r.label})`).join(', ')}.`,
      );
    }
    if (!region.flow) {
      throw new CommandError(
        'region-not-a-text-region',
        `The "${region.id}" region on this template holds a single visual (${region.label}), not flowing text. Use ${template.regions
          .filter((r) => r.flow)
          .map((r) => `"${r.id}"`)
          .join(' or ')} for text.`,
      );
    }

    const textRole = input.textRole as (typeof TEXT_ROLES)[number];
    const height = estimateTextHeight(
      {
        textRole,
        content: input.content ?? '',
        ...(input.items === undefined ? {} : { items: input.items }),
        ...(input.headingLevel === undefined ? {} : { headingLevel: input.headingLevel }),
      },
      region.bounds.width,
      project.theme,
    );
    const metrics = textMetrics(project.theme, textRole, input.headingLevel);
    const bounds = nextFlowBounds(region, page.objects, height, metrics.spaceAbovePx);

    const object = newTextObject(
      {
        pageId: page.id,
        textRole,
        content: input.content ?? '',
        ...(input.items === undefined ? {} : { items: input.items }),
        ...(input.ordered === undefined ? {} : { ordered: input.ordered }),
        ...(input.headingLevel === undefined ? {} : { headingLevel: input.headingLevel }),
        ...(input.purpose === undefined ? {} : { purpose: input.purpose }),
        bounds,
        by: context.by,
      },
      context.ids,
    );

    const orderIndex = input.readingOrderIndex ?? page.readingOrder.length;
    const detail: string[] = [
      `Placed in the ${region.label} region of the ${template.name} template, at ${bounds.x}, ${bounds.y}, ${bounds.width} by ${bounds.height} pixels (estimated).`,
      `Position ${orderIndex + 1} of ${page.readingOrder.length + 1} in the reading order for page ${page.pageNumber}.`,
    ];
    const overflowing = overflowsRegion(bounds, region);
    if (overflowing) {
      const over = bounds.y + bounds.height - (region.bounds.y + region.bounds.height);
      detail.push(
        `Warning: this is estimated to run about ${Math.round(over)} pixels past the bottom of the ${region.label} region. Run measure_page once the page has rendered to get the real number, then shorten the text or move it to another page.`,
      );
    }

    const what =
      textRole === 'heading'
        ? `a level ${input.headingLevel ?? 2} heading`
        : `a ${textRole.replace('-', ' ')}`;
    const said = input.items ? `${input.items.length} items` : `"${input.content ?? ''}"`;

    return {
      commands: [
        { kind: 'add-object', pageId: page.id, object, readingOrderIndex: orderIndex },
      ],
      result: {
        lead: `Added ${what} to page ${page.pageNumber}${page.title ? ` (${page.title})` : ''}: ${said}.${overflowing ? ' It may not fit — see the detail.' : ''}`,
        detail,
        data: {
          objectId: object.id,
          pageId: page.id,
          pageNumber: page.pageNumber,
          regionId: region.id,
          bounds,
          boundsAreEstimated: true,
          readingOrderIndex: orderIndex,
          estimatedOverflowPx: overflowing
            ? Math.round(bounds.y + bounds.height - (region.bounds.y + region.bounds.height))
            : 0,
        },
      },
    };
  },
};
