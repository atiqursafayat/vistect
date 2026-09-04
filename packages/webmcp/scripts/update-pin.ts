// ============================================================================
// Registry pin generator
// ============================================================================
//
// Regenerates `pins/reg-v1.json` from the current tool definitions.
//
// Run deliberately, never automatically: the pin exists so a change to the agent
// contract is reviewed, and a script that refreshed it on every build would defeat
// that entirely.
//
//   pnpm --filter @vistect/webmcp run pin:update

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

import type { CommandBus } from '@vistect/domain/bus';
import type { Command, CommandResult } from '@vistect/domain/commands';
import { toolDefinitions } from '@vistect/domain/toolSchemas';

import { createRegistrySnapshot, createToolRegistry } from '../src/registry';

const noopBus: CommandBus = {
  dispatch: (): Promise<CommandResult> =>
    Promise.resolve({ ok: false, changedIds: [], error: 'not dispatched' }),
  dispatchFromAgent: (_command: Command, _toolName: string): Promise<CommandResult> =>
    Promise.resolve({ ok: false, changedIds: [], error: 'not dispatched' }),
};

const registry = createToolRegistry({ commandBus: noopBus });
for (const definition of toolDefinitions) {
  registry.registerTool(definition);
}

const snapshot = createRegistrySnapshot(registry);
const target = resolve(import.meta.dirname, '../pins/reg-v1.json');

mkdirSync(dirname(target), { recursive: true });
writeFileSync(target, `${JSON.stringify(snapshot, null, 2)}\n`, 'utf8');

console.warn(`Wrote ${String(snapshot.toolCount)} tools to ${target}`);
