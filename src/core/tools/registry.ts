/**
 * The tool registry and the single code path that runs a tool — plan §6, decision 1.
 *
 * `createToolRunner` is the only place a tool is executed. `src/webmcp/register.ts` and
 * `src/ui/DevAgentConsole` both call it, so the agent path and the demo path cannot
 * diverge: validation, version checking, activity recording and error phrasing happen
 * once, here.
 *
 * A runner call never throws. Every failure comes back as `ok: false` with a message
 * written to be read aloud, because an exception crossing the WebMCP boundary becomes an
 * opaque failure the user cannot act on.
 */
import { z } from 'zod';
import type { Provenance } from '../model/primitives.js';
import type { Ids } from '../factory.js';
import { CommandError } from '../commands.js';
import type { Store } from '../store.js';
import type { AnyToolDefinition } from './types.js';
import {
  createDocument,
  getDocumentOverview,
  getDocumentStructure,
  updateIntentContract,
} from './document.js';
import { addTextSection } from './content.js';
import { inspectPage } from './page.js';

/**
 * Day 1's six. Plan §6 caps the published surface at 30; adding a tool means adding it
 * here and nowhere else.
 */
export const TOOLS: AnyToolDefinition[] = [
  createDocument,
  updateIntentContract,
  getDocumentOverview,
  getDocumentStructure,
  addTextSection,
  inspectPage,
];

export const TOOL_NAMES: string[] = TOOLS.map((tool) => tool.name);

export const getTool = (name: string): AnyToolDefinition | undefined =>
  TOOLS.find((tool) => tool.name === name);

/** JSON Schema as published to the agent. `io: 'input'` keeps defaulted fields optional. */
export const toolInputSchema = (tool: AnyToolDefinition): Record<string, unknown> => {
  const schema = z.toJSONSchema(tool.schema, { io: 'input', unrepresentable: 'any' }) as Record<
    string,
    unknown
  >;
  delete schema['$schema'];
  return schema;
};

export type ToolRunResult = {
  ok: boolean;
  toolName: string;
  /** One readable sentence. Present on success and failure alike. */
  lead: string;
  detail: string[];
  data: Record<string, unknown>;
  documentVersion: number;
  /** Machine-readable failure reason, e.g. 'stale-write', 'invalid-input'. */
  code?: string;
};

export type ToolRunner = (name: string, rawInput: unknown, by: Provenance) => ToolRunResult;

export function createToolRunner(store: Store, ids: Ids): ToolRunner {
  const version = (): number => store.getState().project?.activeVersion ?? 0;

  const fail = (
    toolName: string,
    code: string,
    lead: string,
    detail: string[] = [],
  ): ToolRunResult => ({
    ok: false,
    toolName,
    lead,
    detail,
    data: {},
    documentVersion: version(),
    code,
  });

  return (name, rawInput, by) => {
    const tool = getTool(name);
    if (!tool) {
      return fail(
        name,
        'unknown-tool',
        `There is no tool called "${name}". The available tools are: ${TOOL_NAMES.join(', ')}.`,
      );
    }

    const parsed = tool.schema.safeParse(rawInput ?? {});
    if (!parsed.success) {
      const issues = parsed.error.issues.map(
        (issue) =>
          `${issue.path.length > 0 ? issue.path.join('.') : 'input'}: ${issue.message}`,
      );
      return fail(
        name,
        'invalid-input',
        `${name} was called with input it cannot use: ${issues.join('; ')}.`,
        issues,
      );
    }

    const input = parsed.data as Record<string, unknown>;
    const expected = input['expectedDocumentVersion'];

    let handled;
    try {
      // Sound: `parsed.data` was just validated against `tool.schema`.
      handled = tool.handle(parsed.data as never, {
        project: store.getState().project,
        ids,
        by: { ...by, toolName: name },
      });
    } catch (error) {
      if (error instanceof CommandError) return fail(name, error.code, error.message);
      throw error;
    }

    const { commands, result } = handled;

    if (commands.length === 0) {
      store.recordRead({ by, toolName: name, summary: result.lead, detail: result.detail });
      return {
        ok: true,
        toolName: name,
        lead: result.lead,
        detail: result.detail,
        data: { ...result.data, documentVersion: version() },
        documentVersion: version(),
      };
    }

    const dispatched = store.dispatch({
      commands,
      by: { ...by, toolName: name },
      toolName: name,
      ...(typeof expected === 'number' ? { expectedDocumentVersion: expected } : {}),
    });

    if (!dispatched.ok) {
      return fail(name, dispatched.code, dispatched.message);
    }

    const detail = [...result.detail];
    if (
      dispatched.invalidatedObjectIds.length > 0 ||
      dispatched.invalidatedDecisionIds.length > 0
    ) {
      detail.push(
        `Because of this change, ${dispatched.invalidatedObjectIds.length} approved object and ${dispatched.invalidatedDecisionIds.length} approved decision went back to needing review.`,
      );
    }

    return {
      ok: true,
      toolName: name,
      lead: `${result.lead} The document is now at version ${dispatched.versionAfter}.`,
      detail,
      data: {
        ...result.data,
        documentVersion: dispatched.versionAfter,
        invalidatedObjectIds: dispatched.invalidatedObjectIds,
        invalidatedDecisionIds: dispatched.invalidatedDecisionIds,
      },
      documentVersion: dispatched.versionAfter,
    };
  };
}
