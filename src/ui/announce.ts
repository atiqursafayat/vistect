/**
 * What the announcer says after a tool call — spec §21.3.
 *
 * §21.3 gives the shape: what happened, what changed, what is now unapproved, and where to
 * deal with it. This is the only place that shape is written down, so the agent path and
 * the developer console produce identical wording for identical results.
 *
 * Two rules, both deliberate:
 *
 *   - **An agent's *reads* are silent.** The agent is already answering the user in its own
 *     voice; announcing `inspect_page` as well would talk over it. Reads stay visible in the
 *     activity stream, which is where a user goes to check what the agent looked at.
 *   - **The user's own calls always speak**, read or write, because the user asked a
 *     question and the answer must reach them without navigating anywhere.
 *
 * Focus is never moved from here (plan §7). The announcement says what changed; the user
 * decides when to go and look.
 */
import type { ToolRunResult } from '../core/tools/registry.js';
import { getTool } from '../core/tools/registry.js';

export type CallOrigin = 'agent' | 'user';

const count = (result: ToolRunResult, key: string): number => {
  const value = result.data[key];
  return Array.isArray(value) ? value.length : 0;
};

/** The tool's own annotation, not a guess from the payload. */
const isRead = (result: ToolRunResult): boolean =>
  getTool(result.toolName)?.annotations.readOnlyHint === true;

/** Returns the sentences to announce, or `undefined` when nothing should be said aloud. */
export function announcementFor(result: ToolRunResult, origin: CallOrigin): string | undefined {
  // A refused read still speaks: it means the agent is working from a wrong assumption.
  if (origin === 'agent' && result.ok && isRead(result)) return undefined;

  const opening =
    origin === 'agent'
      ? result.ok
        ? 'Agent action completed.'
        : 'Agent action refused.'
      : result.ok
        ? 'Tool call completed.'
        : 'Tool call refused.';

  const lines = [opening, result.lead];

  const objects = count(result, 'invalidatedObjectIds');
  const decisions = count(result, 'invalidatedDecisionIds');
  if (objects > 0 || decisions > 0) {
    const parts: string[] = [];
    if (objects > 0) parts.push(`${objects} approved ${objects === 1 ? 'object' : 'objects'}`);
    if (decisions > 0)
      parts.push(`${decisions} approved ${decisions === 1 ? 'decision' : 'decisions'}`);
    lines.push(
      `${parts.join(' and ')} ${objects + decisions === 1 ? 'needs' : 'need'} review again. Look for "needs review" in the document navigator.`,
    );
  }

  return lines.join(' ');
}
