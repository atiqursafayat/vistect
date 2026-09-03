/**
 * Document-level tools — spec §18.
 *
 *   create_document          write, and the only write with no expectedDocumentVersion
 *   update_intent_contract   write
 *   get_document_overview    read
 *   get_document_structure   read
 *
 * Descriptions are written for tool *selection*: each says when to reach for it and,
 * where it matters, when not to. Plan §6 keeps the surface at 30 tools for exactly this
 * reason — an agent choosing between 90 near-synonyms chooses badly.
 */
import { z } from 'zod';
import { CommandError } from '../commands.js';
import { newPage, newProject } from '../factory.js';
import { defaultIntentContract } from '../defaults.js';
import { PAGE_TEMPLATES, TEMPLATE_IDS, getTemplate } from '../templates.js';
import { blocksExport, isUnresolved } from '../model/findings.js';
import type { IntentContract } from '../model/project.js';
import type { ToolDefinition } from './types.js';
import { readOnly, writes } from './types.js';
import {
  altTextGaps,
  contractGaps,
  expectedDocumentVersionSchema,
  objectLine,
  pageLine,
  plural,
  requireProject,
} from './common.js';

const templateList = TEMPLATE_IDS.join(', ');

const updateIntentContractSchema = z.object({
  expectedDocumentVersion: expectedDocumentVersionSchema,
  purpose: z.string().min(1).optional().describe('What the document is for.'),
  audience: z
    .array(z.string().min(1))
    .optional()
    .describe('Replaces the current audience list.'),
  primaryMessage: z.string().min(1).optional(),
  secondaryMessages: z.array(z.string().min(1)).optional(),
  tone: z.array(z.string().min(1)).optional(),
  avoid: z
    .array(z.string().min(1))
    .optional()
    .describe('Replaces the current avoid list. Include the existing entries you still want.'),
  visualStyle: z
    .string()
    .min(1)
    .optional()
    .describe('e.g. "documentary photography, no stock".'),
  requiredVisuals: z
    .record(z.string(), z.int().min(0))
    .optional()
    .describe('How many of each visual the report needs, e.g. {"chart": 2, "diagram": 1}.'),
  privacySensitivity: z
    .enum(['standard', 'sensitive'])
    .optional()
    .describe('"sensitive" turns off anything that would send content off-device.'),
});

export const updateIntentContract: ToolDefinition<typeof updateIntentContractSchema> = {
  name: 'update_intent_contract',
  title: 'Update the intent contract',
  description:
    'Records or revises what the document is for, who it is for, and what to avoid. Every field you send replaces the current value; fields you omit are left alone. Use this whenever the brief becomes clearer — recommendations are only as good as this contract.',
  schema: updateIntentContractSchema,
  annotations: writes(true),
  handle: (input, context) => {
    const project = requireProject(context);
    const patch: Partial<IntentContract> = {};
    if (input.purpose !== undefined) patch.purpose = input.purpose;
    if (input.audience !== undefined) patch.audience = input.audience;
    if (input.primaryMessage !== undefined) patch.primaryMessage = input.primaryMessage;
    if (input.secondaryMessages !== undefined)
      patch.secondaryMessages = input.secondaryMessages;
    if (input.tone !== undefined) patch.tone = input.tone;
    if (input.avoid !== undefined) patch.avoid = input.avoid;
    if (input.visualStyle !== undefined) patch.visualStyle = input.visualStyle;
    if (input.requiredVisuals !== undefined) patch.requiredVisuals = input.requiredVisuals;
    if (input.privacySensitivity !== undefined)
      patch.privacySensitivity = input.privacySensitivity;

    const fields = Object.keys(patch);
    if (fields.length === 0) {
      throw new CommandError(
        'nothing-to-update',
        'No intent contract fields were supplied, so there was nothing to change. Send at least one of purpose, audience, primaryMessage, secondaryMessages, tone, avoid, visualStyle, requiredVisuals or privacySensitivity.',
      );
    }

    const gaps = contractGaps({
      ...project,
      intentContract: { ...project.intentContract, ...patch },
    });
    return {
      commands: [{ kind: 'update-intent-contract', patch }],
      result: {
        lead: `Updated the intent contract: ${fields.join(', ')}.${gaps.length > 0 ? ` Still empty: ${gaps.join(', ')}.` : ' The contract is now complete.'}`,
        detail: gaps.map((gap) => `The ${gap} is still empty.`),
        data: { updatedFields: fields, intentContractGaps: gaps },
      },
    };
  },
};

const createDocumentSchema = z.object({
  title: z.string().min(1).describe('The report title, as it should appear on the cover.'),
  purpose: z
    .string()
    .min(1)
    .describe(
      'What this document is for, in one or two sentences. Required: every later recommendation is judged against it, and an empty purpose produces generic advice.',
    ),
  audience: z
    .array(z.string().min(1))
    .default([])
    .describe('Who will read it, e.g. ["funders", "local authority partners"].'),
  primaryMessage: z
    .string()
    .default('')
    .describe('The one thing a reader should take away. Leave empty if it is not settled yet.'),
  tone: z.array(z.string().min(1)).default([]).describe('e.g. ["plain", "confident", "warm"].'),
  avoid: z
    .array(z.string().min(1))
    .default([])
    .describe(
      'Framings and imagery to stay away from. Pre-seeded with pity, charity and medical framing; add to it rather than replacing it.',
    ),
  language: z.string().default('en').describe('BCP 47 language tag for the document.'),
  pageTemplates: z
    .array(z.enum([...TEMPLATE_IDS] as [string, ...string[]]))
    .min(1)
    .default(['cover', 'text-led'])
    .describe(`One id per starting page, in order. Available: ${templateList}.`),
});

export const createDocument: ToolDefinition<typeof createDocumentSchema> = {
  name: 'create_document',
  title: 'Create a document',
  description:
    'Starts a new report and records the intent contract it will be judged against. Call this once, before anything else. It is the only write tool that does not take expectedDocumentVersion, because there is no prior state to conflict with.',
  schema: createDocumentSchema,
  annotations: writes(),
  handle: (input, context) => {
    const intentContract: IntentContract = {
      ...defaultIntentContract(),
      purpose: input.purpose,
      audience: input.audience,
      primaryMessage: input.primaryMessage,
      ...(input.tone.length > 0 ? { tone: input.tone } : {}),
      avoid: [...defaultIntentContract().avoid, ...input.avoid],
    };
    const pages = input.pageTemplates.map((templateId, index) =>
      newPage({ templateId, pageNumber: index + 1 }, context.ids),
    );
    const project = newProject(
      { title: input.title, language: input.language, intentContract, pages },
      context.ids,
    );

    const named = pages
      .map(
        (page) =>
          `page ${page.pageNumber} (${getTemplate(page.templateId)?.name ?? page.templateId})`,
      )
      .join(', ');
    const gaps = contractGaps({ ...project, intentContract });

    return {
      commands: [{ kind: 'create-document', project }],
      result: {
        lead: `Created "${input.title}" with ${plural(pages.length, 'page')}: ${named}. Nothing is on the pages yet.`,
        detail: [
          ...pages.map((page) => pageLine(page)),
          gaps.length > 0
            ? `The intent contract still has no ${gaps.join(', ')}. Fill those in with update_intent_contract before asking for visual recommendations.`
            : 'The intent contract has a purpose, an audience, a primary message and a tone.',
        ],
        data: {
          documentId: project.id,
          title: project.title,
          pages: pages.map((p) => ({
            id: p.id,
            pageNumber: p.pageNumber,
            templateId: p.templateId,
          })),
          intentContractGaps: gaps,
          availableTemplates: PAGE_TEMPLATES.map((t) => ({
            id: t.id,
            name: t.name,
            description: t.description,
          })),
        },
      },
    };
  },
};

const noArguments = z.object({});

export const getDocumentOverview: ToolDefinition<typeof noArguments> = {
  name: 'get_document_overview',
  title: 'Get a document overview',
  description:
    'Reads the whole document in one paragraph: title, current version, pages, how complete the intent contract is, and anything blocking export. Call this at the start of a session, and again whenever a write is refused as stale — the version it reports is the expectedDocumentVersion the next write needs.',
  schema: noArguments,
  annotations: readOnly,
  handle: (_input, context) => {
    const project = requireProject(context);
    const gaps = contractGaps(project);
    const missingAlt = altTextGaps(project);
    const blocking = project.findings.filter(blocksExport);
    const unresolved = project.decisions.filter(isUnresolved);

    const sentences = [
      `"${project.title}" is at version ${project.activeVersion}, status ${project.approvalStatus}, with ${plural(project.pages.length, 'page')}.`,
      gaps.length > 0
        ? `The intent contract is missing ${gaps.join(', ')}.`
        : 'The intent contract is complete.',
      missingAlt.length > 0
        ? `${plural(missingAlt.length, 'object')} still ${missingAlt.length === 1 ? 'needs' : 'need'} alternative text.`
        : 'Every meaningful object has alternative text.',
      blocking.length > 0
        ? `${plural(blocking.length, 'finding')} would block export.`
        : 'Nothing is blocking export.',
    ];

    return {
      commands: [],
      result: {
        lead: sentences.join(' '),
        detail: project.pages.map((page) => pageLine(page)),
        data: {
          documentId: project.id,
          title: project.title,
          language: project.language,
          documentVersion: project.activeVersion,
          approvalStatus: project.approvalStatus,
          pageCount: project.pages.length,
          intentContract: project.intentContract,
          intentContractGaps: gaps,
          objectsMissingAltText: missingAlt.map((o) => o.id),
          blockingFindings: blocking.map((f) => ({
            id: f.id,
            category: f.category,
            summary: f.summary,
          })),
          unresolvedDecisions: unresolved.map((d) => ({
            id: d.id,
            decisionType: d.decisionType,
            summary: d.summary,
          })),
        },
      },
    };
  },
};

const getDocumentStructureSchema = z.object({
  includeObjects: z
    .boolean()
    .default(true)
    .describe('Set false for just the page list, when a full object listing would be noise.'),
});

export const getDocumentStructure: ToolDefinition<typeof getDocumentStructureSchema> = {
  name: 'get_document_structure',
  title: 'Get the document structure',
  description:
    'Lists every page with its id, template and reading order, and by default every object on it. Use this to find the ids other tools need. For one page in depth — including region bounds and measured geometry — use inspect_page instead.',
  schema: getDocumentStructureSchema,
  annotations: readOnly,
  handle: (input, context) => {
    const project = requireProject(context);
    const detail: string[] = [];

    for (const page of project.pages) {
      detail.push(pageLine(page));
      if (!input.includeObjects) continue;
      if (page.objects.length === 0) {
        detail.push('  Nothing on this page yet.');
        continue;
      }
      const ordered = page.readingOrder
        .map((id) => page.objects.find((o) => o.id === id))
        .filter((o): o is NonNullable<typeof o> => o !== undefined);
      const hidden = page.objects.filter((o) => !page.readingOrder.includes(o.id));
      ordered.forEach((object, index) => detail.push(`  ${objectLine(object, index)}`));
      for (const object of hidden)
        detail.push(`  Not in the reading order: ${objectLine(object)}`);
    }

    return {
      commands: [],
      result: {
        lead: `"${project.title}" has ${plural(project.pages.length, 'page')} and ${plural(
          project.pages.reduce((n, p) => n + p.objects.length, 0),
          'object',
        )} at version ${project.activeVersion}.`,
        detail,
        data: {
          documentVersion: project.activeVersion,
          pages: project.pages.map((page) => ({
            id: page.id,
            pageNumber: page.pageNumber,
            title: page.title,
            templateId: page.templateId,
            status: page.status,
            readingOrder: page.readingOrder,
            ...(input.includeObjects
              ? {
                  objects: page.objects.map((o) => ({
                    id: o.id,
                    type: o.type,
                    role: o.role,
                    approval: o.approval.status,
                    ...(o.type === 'text' ? { textRole: o.textRole, content: o.content } : {}),
                  })),
                }
              : {}),
          })),
        },
      },
    };
  },
};
