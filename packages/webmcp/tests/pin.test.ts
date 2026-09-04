import type { CommandBus } from '@vistect/domain/bus';
import type { Command, CommandResult } from '@vistect/domain/commands';
import { toolDefinitions } from '@vistect/domain/toolSchemas';
import { describe, expect, it } from 'vitest';

import pinnedSnapshot from '../pins/reg-v1.json' with { type: 'json' };
import { createRegistrySnapshot, createToolRegistry } from '../src/registry';
import { WEB_MCP_SPEC_VERSION } from '../src/version';

/**
 * Registry pin test.
 *
 * The full tool registry is pinned to a checked-in snapshot. A change to any
 * tool's name, description, schema or annotations therefore requires updating
 * `pins/reg-v1.json` in the same commit, which puts it in front of a reviewer.
 *
 * This is the tool-poisoning defence from `07-security-review.md` §3: a widened
 * input schema or a rewritten description is exactly how an agent's contract
 * would be silently expanded.
 *
 * To update deliberately: `pnpm --filter @vistect/webmcp run pin:update`.
 */

const noopBus: CommandBus = {
  dispatch: (): Promise<CommandResult> =>
    Promise.resolve({ ok: false, changedIds: [], error: 'not dispatched in pin test' }),
  dispatchFromAgent: (_command: Command, _toolName: string): Promise<CommandResult> =>
    Promise.resolve({ ok: false, changedIds: [], error: 'not dispatched in pin test' }),
};

function buildFullRegistry() {
  const registry = createToolRegistry({ commandBus: noopBus });
  for (const definition of toolDefinitions) {
    registry.registerTool(definition);
  }
  return registry;
}

describe('Registry pin', () => {
  it('matches the checked-in snapshot', () => {
    const current = createRegistrySnapshot(buildFullRegistry());

    // Compared as JSON so the diff a reviewer sees is the diff CI sees.
    expect(JSON.stringify(current, null, 2)).toBe(JSON.stringify(pinnedSnapshot, null, 2));
  });

  it('pins the WebMCP spec version', () => {
    expect(pinnedSnapshot.specVersion).toBe(WEB_MCP_SPEC_VERSION);
  });

  it('registers every declared tool', () => {
    expect(buildFullRegistry().getAllTools()).toHaveLength(toolDefinitions.length);
  });

  it('gives every tool both annotation hints', () => {
    for (const tool of buildFullRegistry().getCompiledSchemas()) {
      expect(typeof tool.annotations.readOnlyHint, tool.name).toBe('boolean');
      expect(typeof tool.annotations.untrustedContentHint, tool.name).toBe('boolean');
    }
  });

  it('enforces additionalProperties: false on every tool', () => {
    for (const tool of buildFullRegistry().getCompiledSchemas()) {
      expect(tool.inputSchema['additionalProperties'], tool.name).toBe(false);
    }
  });

  it('has no duplicate tool names', () => {
    const names = toolDefinitions.map((t) => t.name);
    expect(new Set(names).size).toBe(names.length);
  });
});
