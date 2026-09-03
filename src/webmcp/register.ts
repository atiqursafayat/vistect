/**
 * Registering Vistect's tools with the browser — the real agent path.
 *
 * This file is deliberately thin. It converts a core tool definition into a WebMCP tool
 * descriptor, hands the call straight to the shared `ToolRunner`, and turns the runner's
 * result into an MCP response. It contains no validation, no version checking and no
 * state: all of that already happened in `core/tools/registry.ts`, which is the *same*
 * code path `DevAgentConsole` uses. There is no second implementation for the two callers
 * to drift apart into (plan §4, decision 1).
 *
 * Three failure modes this file exists to prevent, all found in D0-1:
 *
 *   1. `registerTool()` returns a Promise. Not awaiting it loses tools silently, which is
 *      indistinguishable from an agent that simply chose not to call them.
 *   2. There is no `unregisterTool()`. An `AbortSignal` is the only removal path, so every
 *      registration is scoped to one controller and `dispose()` aborts it.
 *   3. An exception thrown inside `execute` crosses the browser boundary as an opaque
 *      failure. The runner never throws, and the mapping below never throws either.
 */
import type { Provenance } from '../core/model/primitives.js';
import type { ToolRunResult, ToolRunner } from '../core/tools/registry.js';
import { TOOLS, toolInputSchema } from '../core/tools/registry.js';
import { plural } from '../core/tools/common.js';
import type { AnyToolDefinition } from '../core/tools/types.js';
import type { ModelContextTool, ToolRegistrationFailure, WebMcpRegistration } from './types.js';
import {
  MAX_PUBLISHED_TOOLS,
  getModelContext,
  toWebMcpAnnotations,
  toolNameIsPublishable,
} from './types.js';
import { probeWebMcp } from './probe.js';

export type RegisterOptions = {
  /** How the agent identifies itself. Untrusted display data, never an authorisation (§4.4). */
  agentName?: string;
  /**
   * Called after every agent tool call, successful or refused. This is how the announcer
   * and the activity stream hear about work the user did not initiate.
   */
  onResult?: (result: ToolRunResult) => void;
  /** Aborting this unregisters every tool, exactly as `dispose()` does. */
  signal?: AbortSignal;
  now?: () => string;
};

/**
 * An MCP tool response. `content` is what a language model reads; `structuredContent` is
 * the same payload as data. Both are sent, and the payload is repeated as JSON text,
 * because a client that ignores `structuredContent` would otherwise never see the ids the
 * next call needs.
 */
type ToolResponse = {
  content: { type: 'text'; text: string }[];
  structuredContent: Record<string, unknown>;
  isError?: boolean;
};

const toolResponse = (result: ToolRunResult): ToolResponse => {
  const payload: Record<string, unknown> = {
    ok: result.ok,
    documentVersion: result.documentVersion,
    ...(result.code === undefined ? {} : { code: result.code }),
    ...result.data,
  };
  const content: { type: 'text'; text: string }[] = [{ type: 'text', text: result.lead }];
  if (result.detail.length > 0) content.push({ type: 'text', text: result.detail.join('\n') });
  content.push({ type: 'text', text: JSON.stringify(payload, null, 2) });

  return { content, structuredContent: payload, ...(result.ok ? {} : { isError: true }) };
};

/**
 * Publishes every tool in the registry. Resolves once the browser has acknowledged all of
 * them, so a caller that awaits this knows the agent can see the tools.
 *
 * `ok: false` with `support.supported === false` is expected degradation, not a bug: the
 * browser has no WebMCP and the app carries on without an agent.
 */
export async function registerVistectTools(
  runner: ToolRunner,
  options: RegisterOptions = {},
): Promise<WebMcpRegistration> {
  const support = probeWebMcp();
  const modelContext = getModelContext();

  const controller = new AbortController();
  if (options.signal) {
    if (options.signal.aborted) controller.abort();
    else options.signal.addEventListener('abort', () => controller.abort(), { once: true });
  }
  const dispose = () => controller.abort();

  if (!support.supported || !modelContext) {
    return {
      ok: false,
      registered: [],
      failed: [],
      support,
      summary: `No agent tools were registered. ${support.summary}`,
      dispose,
    };
  }

  const failed: ToolRegistrationFailure[] = [];
  const publishable: AnyToolDefinition[] = [];
  for (const tool of TOOLS) {
    if (!toolNameIsPublishable(tool.name)) {
      failed.push({
        toolName: tool.name,
        reason:
          'the name is not a legal WebMCP tool name — use 1 to 128 characters of letters, digits, underscore, dash or dot',
      });
    } else if (publishable.length >= MAX_PUBLISHED_TOOLS) {
      failed.push({
        toolName: tool.name,
        reason: `the published surface is capped at ${MAX_PUBLISHED_TOOLS} tools (plan §6) and this one is over the cap`,
      });
    } else {
      publishable.push(tool);
    }
  }

  const now = options.now ?? (() => new Date().toISOString());
  const provenance = (): Provenance => ({
    origin: 'agent',
    ...(options.agentName === undefined ? {} : { agentName: options.agentName }),
    createdAt: now(),
  });

  const registered: string[] = [];
  // One at a time, not `Promise.all`: registration order is the order an agent lists the
  // tools in, and a rejection here has to be attributable to the tool that caused it.
  for (const tool of publishable) {
    /**
     * Checked every iteration, because the caller can dispose while this loop is still
     * running — React's StrictMode does exactly that on every mount in development. Without
     * this, the remaining `registerTool` calls run against an aborted signal and come back as
     * six "failures" that were really one cancellation.
     */
    if (controller.signal.aborted) {
      return {
        ok: false,
        registered,
        failed,
        support,
        summary: `Registration was cancelled after ${plural(registered.length, 'tool')}. No tools are published.`,
        dispose,
      };
    }

    const descriptor: ModelContextTool = {
      name: tool.name,
      title: tool.title,
      description: tool.description,
      inputSchema: toolInputSchema(tool),
      annotations: toWebMcpAnnotations(tool),
      execute: (input) => {
        const result = runner(tool.name, input, provenance());
        options.onResult?.(result);
        return toolResponse(result);
      },
    };

    try {
      await modelContext.registerTool(descriptor, { signal: controller.signal });
      registered.push(tool.name);
    } catch (error) {
      failed.push({
        toolName: tool.name,
        reason: error instanceof Error ? error.message : String(error),
      });
    }
  }

  const summary =
    failed.length === 0
      ? `Vistect published ${plural(registered.length, 'tool')} to this browser's agent: ${registered.join(', ')}.`
      : `Vistect published ${registered.length} of ${TOOLS.length} tools. ${plural(failed.length, 'tool')} could not be published: ${failed.map((f) => `${f.toolName}, because ${f.reason}`).join('; ')}.`;

  return { ok: failed.length === 0, registered, failed, support, summary, dispose };
}
