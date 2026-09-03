/**
 * The tool contract — architecture decision 1 in the plan.
 *
 * A tool handler is a pure function `(input, context) => { commands, result }`. It never
 * touches the store, the DOM, or `document.modelContext`. That is what lets exactly two
 * thin callers drive the same handlers:
 *
 *   - `src/webmcp/register.ts`  — the real agent path
 *   - `src/ui/DevAgentConsole`  — demo-day insurance, because `executeTool()` is unusable
 *     as a harness (see docs/day-0-findings.md)
 *
 * Because the handler is pure, a tool is unit-testable without a browser, and the two
 * callers cannot drift apart: there is no second implementation for them to drift into.
 */
import type { z } from 'zod';
import type { Command } from '../commands.js';
import type { DocumentProject } from '../model/project.js';
import type { Provenance } from '../model/primitives.js';
import type { Ids } from '../factory.js';

/**
 * What a tool says back. `lead` is one sentence a screen reader can read on its own
 * (plan §6); `data` is the structured payload an agent reasons over. Both, always —
 * a bare JSON blob is unusable by ear, and a bare sentence is unusable by an agent.
 */
export type ToolResult = {
  lead: string;
  data: Record<string, unknown>;
  /** Supporting lines, already written as prose. Shown in the activity stream. */
  detail: string[];
};

export type ToolHandlerResult = {
  /** Empty for a read-only tool. A write tool's commands are dispatched as one batch. */
  commands: Command[];
  result: ToolResult;
};

export type ToolContext = {
  /** Undefined before `create_document`. Handlers must say so, not throw. */
  project: DocumentProject | undefined;
  ids: Ids;
  by: Provenance;
};

/** MCP annotations. `consequentialHint` is absent: Chrome drops it (plan §4, decision 5). */
export type ToolAnnotations = {
  readOnlyHint: boolean;
  destructiveHint: boolean;
  idempotentHint: boolean;
  openWorldHint: boolean;
};

export type ToolDefinition<Schema extends z.ZodType = z.ZodType> = {
  name: string;
  title: string;
  /** Written for tool selection: says when to use it and when not to. */
  description: string;
  schema: Schema;
  annotations: ToolAnnotations;
  handle: (input: z.output<Schema>, context: ToolContext) => ToolHandlerResult;
};

/**
 * The registry holds tools with unrelated schemas, so the schema type has to be erased.
 * `input: never` is what makes that sound: a handler that accepts a specific parsed
 * shape is assignable to one that accepts `never`, and the only place the value is
 * widened back is immediately after `safeParse` has validated it against this very
 * schema (see `registry.ts`).
 */
export type AnyToolDefinition = {
  name: string;
  title: string;
  description: string;
  schema: z.ZodType;
  annotations: ToolAnnotations;
  handle: (input: never, context: ToolContext) => ToolHandlerResult;
};

export const readOnly: ToolAnnotations = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
};

export const writes = (idempotent = false): ToolAnnotations => ({
  readOnlyHint: false,
  // Nothing in this product deletes user content without a separate confirmation step.
  destructiveHint: false,
  idempotentHint: idempotent,
  openWorldHint: false,
});
