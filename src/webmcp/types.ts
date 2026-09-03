/**
 * The browser side of the WebMCP boundary — types, and the one place the namespace is read.
 *
 * `document.modelContext` is read *only* by `getModelContext()` below. That is deliberate:
 * v1 built 2,819 lines against `navigator.modelContext`, registered zero tools, and never
 * found out, because the belief was spread across the whole layer instead of stated once.
 * Here, a namespace move is a one-line change and `npm run probe:webmcp` fails loudly the
 * day it happens (see `docs/day-0-findings.md` D0-1).
 *
 * The `WebMCP.*` types are ambient globals from `webmcp-types`, which declares
 * `Document.modelContext` as optional. Nothing in this file assumes the API exists.
 */
import type { AnyToolDefinition } from '../core/tools/types.js';

export type ModelContext = WebMCP.ModelContext;
export type ModelContextTool = WebMCP.ModelContextTool;
export type RegisteredTool = WebMCP.RegisteredTool;
export type WebMcpAnnotations = WebMCP.ToolAnnotations;

/** Plan §6. An agent choosing between 90 near-synonyms chooses badly. */
export const MAX_PUBLISHED_TOOLS = 30;

/** Chrome's own rule for `ModelContextTool.name`: 1–128 chars of ASCII word/dash/dot. */
const TOOL_NAME = /^[A-Za-z0-9_.-]{1,128}$/;

export const toolNameIsPublishable = (name: string): boolean => TOOL_NAME.test(name);

/**
 * The single read of the namespace. Guarded for `document`-less environments so a probe
 * can be called from anywhere and answer truthfully instead of throwing.
 */
export const getModelContext = (): ModelContext | undefined =>
  typeof document === 'undefined' ? undefined : document.modelContext;

/**
 * Core publishes four MCP annotations; Chrome 152 keeps two and silently drops the rest,
 * `consequentialHint` included (D0-1). The mapping is lossy on purpose, and it is written
 * out here rather than spread by hand so the loss stays visible:
 *
 *   - `readOnlyHint`         → kept. Round-trips.
 *   - `untrustedContentHint` → set for every tool. Tool results quote document text back
 *     to the agent, and document text is whatever a person typed or pasted. The agent
 *     should treat it as data, not as instructions addressed to it.
 *   - `destructiveHint`, `idempotentHint`, `openWorldHint` → not sent. Undeclared by the
 *     browser API, so sending them would only look like a guarantee we cannot make.
 *
 * Because `consequentialHint` is dropped, the browser cannot be asked to confirm a
 * consequential write. The app owns its own approval gate instead (plan §4, decision 5).
 */
export const toWebMcpAnnotations = (tool: AnyToolDefinition): WebMcpAnnotations => ({
  readOnlyHint: tool.annotations.readOnlyHint,
  untrustedContentHint: true,
});

/** What `probeWebMcp()` found. Every field is a fact; `summary` is those facts in a sentence. */
export type WebMcpSupport = {
  /** True only when a tool can actually be registered right now. */
  supported: boolean;
  hasDocument: boolean;
  isSecureContext: boolean;
  hasDocumentNamespace: boolean;
  /** Watched, not used. If this ever becomes true, re-read the spec before switching. */
  hasNavigatorNamespace: boolean;
  canRegister: boolean;
  /** One sentence, written to be read aloud by a screen reader. */
  summary: string;
  /** What the user can do about it. Empty when there is nothing to do. */
  advice: string[];
};

export type ToolRegistrationFailure = {
  toolName: string;
  reason: string;
};

export type WebMcpRegistration = {
  /** True when every tool registered. */
  ok: boolean;
  registered: string[];
  failed: ToolRegistrationFailure[];
  support: WebMcpSupport;
  /** One sentence, written to be read aloud. */
  summary: string;
  /**
   * Unregisters everything this call registered. There is no `unregisterTool()`;
   * aborting the signal is the only removal path the API offers (D0-1).
   */
  dispose: () => void;
};
