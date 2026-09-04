import type { CommandBus } from '@vistect/domain/bus';
import type { Command, CommandResult } from '@vistect/domain/commands';
import type { ActorId } from '@vistect/domain/schema';
import type { ToolDefinition } from '@vistect/domain/toolSchemas';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { z } from 'zod';


import { createActivityRecorder } from '../src/activity';
import {
  createSchemaCompiler,
  validateCompiledSchema,
  checkForbiddenPatterns,
} from '../src/compiler';
import {
  CONFIRMATION_TIMEOUT_MS,
  CONSEQUENTIAL_TOOLS,
  createBrowserConfirmationHandler,
  createExecutionGate,
  createRateLimiter,
  defaultRequireUserInteraction,
  getRateLimitConfig,
  wrapToolExecute,
} from '../src/gate';
import { createCapabilityProbe } from '../src/probe';
import {
  compareSnapshots,
  createRegistrySnapshot,
  createToolRegistry,
  SNAPSHOT_FORMAT_VERSION,
} from '../src/registry';
import { WEB_MCP_SPEC_VERSION } from '../src/version';


// ============================================================================
// Fixtures
// ============================================================================

const createTestTool = (overrides: Partial<ToolDefinition> = {}): ToolDefinition => ({
  name: 'test_tool',
  description: 'A test tool',
  inputSchema: z.object({ text: z.string().describe('Input text') }),
  annotations: { readOnlyHint: false, untrustedContentHint: false },
  ...overrides,
});

const createReadOnlyTool = (overrides: Partial<ToolDefinition> = {}): ToolDefinition => ({
  name: 'get_data',
  description: 'Get data',
  inputSchema: z.object({}),
  annotations: { readOnlyHint: true, untrustedContentHint: false },
  ...overrides,
});

const okResult: CommandResult = { ok: true, version: 1, changedIds: [] };

const stubCommandBus = (): CommandBus => ({
  dispatch: vi.fn<(command: Command) => Promise<CommandResult>>().mockResolvedValue(okResult),
  dispatchFromAgent: vi
    .fn<(command: Command, toolName: string) => Promise<CommandResult>>()
    .mockResolvedValue(okResult),
});

const actorId = 'act_test' as ActorId;

const testCommand = (): Command =>
  ({
    id: 'cmd_test',
    projectId: 'pj_test',
    expectedVersion: 0,
    actorId,
    timestamp: new Date().toISOString(),
    type: 'CreatePage',
    payload: { template: 'text-led' },
  }) as Command;

// ============================================================================
// Schema Compiler
// ============================================================================

describe('Schema Compiler', () => {
  const compiler = createSchemaCompiler();

  it('compiles a Zod schema into strict JSON Schema', () => {
    const compiled = compiler.compile(createTestTool());

    expect(compiled.name).toBe('test_tool');
    expect(compiled.description).toBe('A test tool');
    expect(compiled.inputSchema['type']).toBe('object');
    expect(compiled.inputSchema['additionalProperties']).toBe(false);
    expect(compiled.annotations.readOnlyHint).toBe(false);
  });

  it('preserves field descriptions for the agent', () => {
    const compiled = compiler.compile(createTestTool());
    const properties = compiled.inputSchema['properties'] as Record<
      string,
      Record<string, unknown>
    >;
    expect(properties['text']?.['description']).toBe('Input text');
  });

  it('enforces additionalProperties: false on nested objects', () => {
    const compiled = compiler.compile(
      createTestTool({
        inputSchema: z.object({ nested: z.object({ value: z.string() }) }),
      })
    );

    const properties = compiled.inputSchema['properties'] as Record<
      string,
      Record<string, unknown>
    >;
    expect(properties['nested']?.['additionalProperties']).toBe(false);
  });

  it('enforces additionalProperties: false inside arrays', () => {
    const compiled = compiler.compile(
      createTestTool({
        inputSchema: z.object({ items: z.array(z.object({ id: z.string() })) }),
      })
    );

    const properties = compiled.inputSchema['properties'] as Record<
      string,
      Record<string, unknown>
    >;
    const items = properties['items']?.['items'] as Record<string, unknown>;
    expect(items['additionalProperties']).toBe(false);
  });

  it('inlines definitions rather than emitting $ref', () => {
    const shared = z.object({ id: z.string() });
    const compiled = compiler.compile(
      createTestTool({ inputSchema: z.object({ a: shared, b: shared }) })
    );

    // An agent given a `$ref` into a `definitions` block it never received cannot
    // validate input.
    expect(JSON.stringify(compiled.inputSchema)).not.toContain('$ref');
  });

  it('omits title when absent rather than emitting undefined', () => {
    const compiled = compiler.compile(createTestTool());
    expect('title' in compiled).toBe(false);
  });

  it('includes title when provided', () => {
    const compiled = compiler.compile(createTestTool({ title: 'Test Tool' }));
    expect(compiled.title).toBe('Test Tool');
  });
});

describe('validateCompiledSchema', () => {
  const compiler = createSchemaCompiler();

  it('accepts a well-formed tool', () => {
    const result = validateCompiledSchema(compiler.compile(createTestTool()));
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it('rejects an invalid name', () => {
    const result = validateCompiledSchema(compiler.compile(createTestTool({ name: 'Invalid_Tool' })));
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('name'))).toBe(true);
  });

  it('rejects an over-long name', () => {
    const result = validateCompiledSchema(
      compiler.compile(createTestTool({ name: `a${'b'.repeat(200)}` }))
    );
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('128'))).toBe(true);
  });

  it('rejects an empty description', () => {
    const result = validateCompiledSchema(compiler.compile(createTestTool({ description: '   ' })));
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('description'))).toBe(true);
  });

  it('rejects missing annotations', () => {
    const compiled = compiler.compile(createTestTool());
    const result = validateCompiledSchema({
      ...compiled,
      annotations: {} as never,
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('annotations'))).toBe(true);
  });

  it('rejects a schema without additionalProperties: false', () => {
    const compiled = compiler.compile(createTestTool());
    const result = validateCompiledSchema({
      ...compiled,
      inputSchema: { ...compiled.inputSchema, additionalProperties: true },
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('additionalProperties'))).toBe(true);
  });
});

describe('checkForbiddenPatterns', () => {
  it.each([
    'approve_all',
    'publish_everything',
    'generate_and_export_without_review',
    'auto_approve',
    'delete_all',
    'bulk_update',
    'fix_everything',
  ])('rejects %s', (name) => {
    // These names would let one agent call bypass per-decision human approval.
    expect(checkForbiddenPatterns(name).length).toBeGreaterThan(0);
  });

  it.each(['approve_decision', 'create_page', 'get_project', 'install_theme'])(
    'accepts %s',
    (name) => {
      expect(checkForbiddenPatterns(name)).toEqual([]);
    }
  );
});

// ============================================================================
// Rate limiter
// ============================================================================

describe('Rate Limiter', () => {
  it('allows a request within capacity', () => {
    expect(createRateLimiter().checkLimit('get_project').allowed).toBe(true);
  });

  it('denies once the bucket is exhausted, with a retry hint', () => {
    const limiter = createRateLimiter();
    const { capacity } = getRateLimitConfig('get_project');

    for (let i = 0; i < capacity; i++) {
      expect(limiter.checkLimit('get_project').allowed).toBe(true);
    }

    const denied = limiter.checkLimit('get_project');
    expect(denied.allowed).toBe(false);
    expect(denied.retryAfterMs).toBeGreaterThan(0);
  });

  it('keeps separate buckets per tool', () => {
    const limiter = createRateLimiter();
    const { capacity } = getRateLimitConfig('get_project');

    for (let i = 0; i < capacity + 1; i++) limiter.checkLimit('get_project');

    expect(limiter.checkLimit('get_project').allowed).toBe(false);
    expect(limiter.checkLimit('create_project').allowed).toBe(true);
  });

  it('refills at the configured rate', () => {
    // Injected clock: a real 600ms sleep makes the suite slow and flaky.
    let now = 0;
    const limiter = createRateLimiter(() => now);
    const { capacity, refillRate } = getRateLimitConfig('create_project');

    for (let i = 0; i < capacity; i++) limiter.checkLimit('create_project');
    expect(limiter.checkLimit('create_project').allowed).toBe(false);

    now += (1 / refillRate) * 1000 + 1;
    expect(limiter.checkLimit('create_project').allowed).toBe(true);
  });

  it('caps refill at capacity', () => {
    let now = 0;
    const limiter = createRateLimiter(() => now);
    const { capacity } = getRateLimitConfig('create_project');

    limiter.checkLimit('create_project');
    now += 3_600_000;

    for (let i = 0; i < capacity; i++) {
      expect(limiter.checkLimit('create_project').allowed).toBe(true);
    }
    expect(limiter.checkLimit('create_project').allowed).toBe(false);
  });

  it('matches the most specific prefix', () => {
    // `get_findings` must not inherit the broader `get_` allowance.
    expect(getRateLimitConfig('get_findings')).toEqual({ capacity: 20, refillRate: 5 });
    expect(getRateLimitConfig('get_something_else')).toEqual({ capacity: 50, refillRate: 10 });
  });

  it('falls back to a default for an unknown prefix', () => {
    expect(getRateLimitConfig('frobnicate_widget')).toEqual({ capacity: 10, refillRate: 2 });
  });

  it('reset clears every bucket', () => {
    const limiter = createRateLimiter();
    const { capacity } = getRateLimitConfig('get_project');

    for (let i = 0; i < capacity + 1; i++) limiter.checkLimit('get_project');
    limiter.reset();

    expect(limiter.checkLimit('get_project').allowed).toBe(true);
  });
});

// ============================================================================
// Consequential actions
// ============================================================================

describe('defaultRequireUserInteraction', () => {
  it.each([
    'lock_document',
    'unlock_document',
    'finalize_export',
    'approve_decision',
    'reject_decision',
    'approve_export_manifest',
    'confirm_readiness',
    'delete_project',
    'delete_page',
    'delete_object',
  ])('requires confirmation for %s', (tool) => {
    expect(defaultRequireUserInteraction(tool)).toBe(true);
  });

  it.each(['get_project', 'list_projects', 'inspect_image', 'get_findings'])(
    'does not require confirmation for read tool %s',
    (tool) => {
      expect(defaultRequireUserInteraction(tool)).toBe(false);
    }
  );

  it.each(['create_page', 'update_object', 'move_object'])(
    'does not require confirmation for reversible write %s',
    (tool) => {
      expect(defaultRequireUserInteraction(tool)).toBe(false);
    }
  );

  it('covers every approval and every deletion', () => {
    // Approval is human-only (I-03) and deletion is irreversible, so both
    // categories must be in the set.
    for (const tool of CONSEQUENTIAL_TOOLS) {
      expect(defaultRequireUserInteraction(tool)).toBe(true);
    }
    expect(CONSEQUENTIAL_TOOLS.has('approve_decision')).toBe(true);
    expect(CONSEQUENTIAL_TOOLS.has('delete_project')).toBe(true);
  });
});

describe('createBrowserConfirmationHandler', () => {
  // Listeners are registered on the shared `window`, so each test removes its own.
  // A leaked listener would answer a later test's request and mask a real failure.
  const listeners: ((event: Event) => void)[] = [];

  const respondWith = (respond: (requestId: string) => void): void => {
    const listener = (event: Event): void => {
      respond((event as CustomEvent<{ requestId: string }>).detail.requestId);
    };
    listeners.push(listener);
    window.addEventListener('webmcp:confirmation', listener);
  };

  afterEach(() => {
    for (const listener of listeners.splice(0)) {
      window.removeEventListener('webmcp:confirmation', listener);
    }
  });

  it('resolves true when the matching response confirms', async () => {
    const confirm = createBrowserConfirmationHandler(1_000);

    respondWith((requestId) => {
      window.dispatchEvent(
        new CustomEvent('webmcp:confirmation-response', { detail: { requestId, confirmed: true } })
      );
    });

    await expect(confirm('lock_document', {})).resolves.toBe(true);
  });

  it('ignores a response carrying a different requestId', async () => {
    const confirm = createBrowserConfirmationHandler(50);

    respondWith(() => {
      // Correlation is by requestId, not tool name: two concurrent calls to the
      // same tool previously cross-resolved.
      window.dispatchEvent(
        new CustomEvent('webmcp:confirmation-response', {
          detail: { requestId: 'unrelated', confirmed: true },
        })
      );
    });

    await expect(confirm('lock_document', {})).resolves.toBe(false);
  });

  it('denies on timeout rather than hanging', async () => {
    const confirm = createBrowserConfirmationHandler(10);
    // No listener responds; a dismissed dialog must not leave a pending promise.
    await expect(confirm('lock_document', {})).resolves.toBe(false);
  });

  it('uses a two-minute default timeout', () => {
    expect(CONFIRMATION_TIMEOUT_MS).toBe(120_000);
  });
});

// ============================================================================
// Execution gate
// ============================================================================

describe('Execution Gate', () => {
  it('runs a non-consequential tool without confirmation', async () => {
    const showConfirmation = vi.fn().mockResolvedValue(true);
    const gate = createExecutionGate({ rateLimiter: createRateLimiter(), showConfirmation });

    const result = await gate.execute('create_page', testCommand(), async () => ({
      ok: true,
      version: 2,
      changedIds: [],
    }));

    expect(result.ok).toBe(true);
    expect(showConfirmation).not.toHaveBeenCalled();
  });

  it('confirms before a consequential tool', async () => {
    const showConfirmation = vi.fn().mockResolvedValue(true);
    const gate = createExecutionGate({ rateLimiter: createRateLimiter(), showConfirmation });
    const run = vi.fn().mockResolvedValue({ ok: true, version: 2, changedIds: [] });

    await gate.execute('lock_document', testCommand(), run);

    expect(showConfirmation).toHaveBeenCalledWith('lock_document', expect.anything());
    expect(run).toHaveBeenCalled();
  });

  it('does not execute when confirmation is declined', async () => {
    const gate = createExecutionGate({
      rateLimiter: createRateLimiter(),
      showConfirmation: vi.fn().mockResolvedValue(false),
    });
    const run = vi.fn();

    const result = await gate.execute('lock_document', testCommand(), run);

    expect(result.ok).toBe(false);
    expect(result.errorCode).toBe('UserDeclined');
    expect(run).not.toHaveBeenCalled();
  });

  it('returns RateLimited without executing', async () => {
    const limiter = createRateLimiter();
    const gate = createExecutionGate({ rateLimiter: limiter });
    const { capacity } = getRateLimitConfig('create_page');

    for (let i = 0; i < capacity; i++) limiter.checkLimit('create_page');

    const run = vi.fn();
    const result = await gate.execute('create_page', testCommand(), run);

    expect(result.ok).toBe(false);
    expect(result.errorCode).toBe('RateLimited');
    expect(run).not.toHaveBeenCalled();
  });

  it('converts a thrown fault into a typed failure', async () => {
    const gate = createExecutionGate({ rateLimiter: createRateLimiter() });

    const result = await gate.execute('create_page', testCommand(), () => {
      throw new Error('boom');
    });

    expect(result.ok).toBe(false);
    expect(result.errorCode).toBe('ExecutionError');
    expect(result.error).toContain('boom');
  });
});

describe('wrapToolExecute', () => {
  it('confirms inside requestUserInteraction for a consequential tool', async () => {
    const showConfirmation = vi.fn().mockResolvedValue(true);
    const wrapped = wrapToolExecute(
      async (_input, client) => client.requestUserInteraction(async () => 'done'),
      'lock_document',
      showConfirmation
    );

    await expect(wrapped({})).resolves.toBe('done');
    expect(showConfirmation).toHaveBeenCalled();
  });

  it('throws a typed error when declined', async () => {
    const wrapped = wrapToolExecute(
      async (_input, client) => client.requestUserInteraction(async () => 'done'),
      'lock_document',
      vi.fn().mockResolvedValue(false)
    );

    await expect(wrapped({})).rejects.toThrow(/UserDeclined/);
  });

  it('skips confirmation for a non-consequential tool', async () => {
    const showConfirmation = vi.fn();
    const wrapped = wrapToolExecute(
      async (_input, client) => client.requestUserInteraction(async () => 'done'),
      'create_page',
      showConfirmation
    );

    await expect(wrapped({})).resolves.toBe('done');
    expect(showConfirmation).not.toHaveBeenCalled();
  });
});

// ============================================================================
// Tool registry
// ============================================================================

describe('Tool Registry', () => {
  let registry: ReturnType<typeof createToolRegistry>;

  beforeEach(() => {
    registry = createToolRegistry({ commandBus: stubCommandBus() });
  });

  it('registers and retrieves a tool', () => {
    registry.registerTool(createTestTool());

    const retrieved = registry.getTool('test_tool');
    expect(retrieved?.definition.name).toBe('test_tool');
    expect(retrieved?.compiled.name).toBe('test_tool');
  });

  it('rejects duplicate registration', () => {
    registry.registerTool(createTestTool());
    expect(() => { registry.registerTool(createTestTool()); }).toThrow(/already registered/);
  });

  it('rejects a tool that fails validation', () => {
    expect(() => { registry.registerTool(createTestTool({ name: 'Invalid_Tool' })); }).toThrow(
      /validation failed/
    );
  });

  it('rejects a forbidden name before compiling', () => {
    expect(() => { registry.registerTool(createTestTool({ name: 'approve_all' })); }).toThrow(
      /Forbidden tool patterns/
    );
  });

  it('unregisters a tool and aborts its signal', () => {
    registry.registerTool(createTestTool());
    const tool = registry.getTool('test_tool');
    expect(tool?.abortController.signal.aborted).toBe(false);

    registry.unregisterTool('test_tool');

    expect(registry.getTool('test_tool')).toBeUndefined();
    // Aborting the signal is the only way to remove a tool from the browser.
    expect(tool?.abortController.signal.aborted).toBe(true);
  });

  it('ignores unregistering an unknown tool', () => {
    expect(() => { registry.unregisterTool('nope'); }).not.toThrow();
  });

  it('unregisters every tool', () => {
    registry.registerTool(createTestTool({ name: 'tool_one' }));
    registry.registerTool(createTestTool({ name: 'tool_two' }));

    registry.unregisterAll();
    expect(registry.getAllTools()).toHaveLength(0);
  });

  it('exposes compiled schemas with their annotations', () => {
    registry.registerTool(createTestTool({ name: 'tool_one' }));
    registry.registerTool(createReadOnlyTool({ name: 'tool_two' }));

    const byName = new Map(registry.getCompiledSchemas().map((s) => [s.name, s]));
    expect(byName.get('tool_one')?.annotations.readOnlyHint).toBe(false);
    expect(byName.get('tool_two')?.annotations.readOnlyHint).toBe(true);
  });

  it('notifies on registration change', () => {
    const onToolChange = vi.fn();
    const notifying = createToolRegistry({ commandBus: stubCommandBus(), onToolChange });

    notifying.registerTool(createTestTool());
    expect(onToolChange).toHaveBeenCalledTimes(1);

    notifying.unregisterTool('test_tool');
    expect(onToolChange).toHaveBeenCalledTimes(2);
  });
});

// ============================================================================
// Registry snapshot
// ============================================================================

describe('Registry Snapshot', () => {
  let registry: ReturnType<typeof createToolRegistry>;

  beforeEach(() => {
    registry = createToolRegistry({ commandBus: stubCommandBus() });
    registry.registerTool(createTestTool({ name: 'tool_one' }));
    registry.registerTool(createReadOnlyTool({ name: 'tool_two' }));
  });

  it('captures format version, spec version and tools', () => {
    const snapshot = createRegistrySnapshot(registry);

    expect(snapshot.version).toBe(SNAPSHOT_FORMAT_VERSION);
    expect(snapshot.specVersion).toBe(WEB_MCP_SPEC_VERSION);
    expect(snapshot.toolCount).toBe(2);
    expect(snapshot.tools).toHaveLength(2);
  });

  it('is byte-stable for an unchanged registry', () => {
    // An embedded timestamp would make every CI run differ from the pin.
    expect(JSON.stringify(createRegistrySnapshot(registry))).toBe(
      JSON.stringify(createRegistrySnapshot(registry))
    );
  });

  it('is independent of registration order', () => {
    const reversed = createToolRegistry({ commandBus: stubCommandBus() });
    reversed.registerTool(createReadOnlyTool({ name: 'tool_two' }));
    reversed.registerTool(createTestTool({ name: 'tool_one' }));

    expect(JSON.stringify(createRegistrySnapshot(reversed))).toBe(
      JSON.stringify(createRegistrySnapshot(registry))
    );
  });

  it('reports equality for identical snapshots', () => {
    const result = compareSnapshots(createRegistrySnapshot(registry), createRegistrySnapshot(registry));
    expect(result.equal).toBe(true);
    expect(result.differences).toEqual([]);
  });

  it('detects an added tool', () => {
    const before = createRegistrySnapshot(registry);
    registry.registerTool(createTestTool({ name: 'tool_three' }));

    const result = compareSnapshots(createRegistrySnapshot(registry), before);
    expect(result.equal).toBe(false);
    expect(result.differences.some((d) => d.includes('added: tool_three'))).toBe(true);
  });

  it('detects a removed tool', () => {
    const before = createRegistrySnapshot(registry);
    registry.unregisterTool('tool_one');

    const result = compareSnapshots(createRegistrySnapshot(registry), before);
    expect(result.equal).toBe(false);
    expect(result.differences.some((d) => d.includes('removed: tool_one'))).toBe(true);
  });

  it('detects a changed description', () => {
    const before = createRegistrySnapshot(registry);
    registry.unregisterTool('tool_one');
    registry.registerTool(createTestTool({ name: 'tool_one', description: 'Changed' }));

    const result = compareSnapshots(createRegistrySnapshot(registry), before);
    expect(result.equal).toBe(false);
    expect(result.differences.some((d) => d.includes('changed: tool_one'))).toBe(true);
  });

  it('detects a changed input schema', () => {
    const before = createRegistrySnapshot(registry);
    registry.unregisterTool('tool_one');
    registry.registerTool(
      createTestTool({ name: 'tool_one', inputSchema: z.object({ different: z.number() }) })
    );

    // A widened schema is exactly the tool-poisoning change pinning exists to catch.
    const result = compareSnapshots(createRegistrySnapshot(registry), before);
    expect(result.differences.some((d) => d.includes('changed: tool_one'))).toBe(true);
  });

  it('detects a spec version change', () => {
    const before = createRegistrySnapshot(registry);
    const result = compareSnapshots({ ...before, specVersion: 'chrome-150-something' }, before);

    expect(result.equal).toBe(false);
    expect(result.differences.some((d) => d.includes('spec version'))).toBe(true);
  });
});

// ============================================================================
// Activity recorder
// ============================================================================

describe('Activity Recorder', () => {
  let recorder: ReturnType<typeof createActivityRecorder>;

  const entry = (overrides: Record<string, unknown> = {}) => ({
    toolName: 'tool_a',
    input: {},
    result: {},
    status: 'success' as const,
    versionBefore: 1,
    versionAfter: 2,
    durationMs: 10,
    actorId,
    ...overrides,
  });

  beforeEach(() => {
    recorder = createActivityRecorder();
  });

  it('stamps id and timestamp', () => {
    const recorded = recorder.record(entry({ toolName: 'test_tool' }));

    expect(recorded.id).toMatch(/^aact_/);
    expect(Number.isNaN(Date.parse(recorded.timestamp))).toBe(false);
    expect(recorded.toolName).toBe('test_tool');
  });

  it('records the version before and after, for auditability', () => {
    const recorded = recorder.record(entry({ versionBefore: 4, versionAfter: 5 }));
    expect(recorded.versionBefore).toBe(4);
    expect(recorded.versionAfter).toBe(5);
  });

  it('filters by tool name', () => {
    recorder.record(entry({ toolName: 'tool_a' }));
    recorder.record(entry({ toolName: 'tool_b' }));
    recorder.record(entry({ toolName: 'tool_a' }));

    expect(recorder.getEntries({ toolName: 'tool_a' })).toHaveLength(2);
  });

  it('filters by status', () => {
    recorder.record(entry({ status: 'success' }));
    recorder.record(entry({ status: 'error' }));

    const errors = recorder.getEntries({ status: 'error' });
    expect(errors).toHaveLength(1);
    expect(errors[0]?.status).toBe('error');
  });

  it('filters by actor', () => {
    recorder.record(entry({ actorId }));
    recorder.record(entry({ actorId: 'act_other' }));

    const filtered = recorder.getEntries({ actorId });
    expect(filtered).toHaveLength(1);
    expect(filtered[0]?.actorId).toBe(actorId);
  });

  it('limits to the most recent entries', () => {
    for (let i = 0; i < 10; i++) recorder.record(entry({ toolName: `tool_${String(i)}` }));

    const limited = recorder.getEntries({ limit: 5 });
    expect(limited).toHaveLength(5);
    expect(limited[4]?.toolName).toBe('tool_9');
  });

  it('notifies subscribers until unsubscribed', () => {
    const callback = vi.fn();
    const unsubscribe = recorder.subscribe(callback);

    recorder.record(entry());
    expect(callback).toHaveBeenCalledTimes(1);

    unsubscribe();
    recorder.record(entry());
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('isolates a throwing subscriber', () => {
    const healthy = vi.fn();
    recorder.subscribe(() => {
      throw new Error('subscriber failure');
    });
    recorder.subscribe(healthy);

    expect(() => recorder.record(entry())).not.toThrow();
    expect(healthy).toHaveBeenCalled();
  });

  it('clears entries', () => {
    recorder.record(entry());
    recorder.clear();
    expect(recorder.getEntries()).toHaveLength(0);
  });
});

// ============================================================================
// Capability probe
// ============================================================================

describe('Capability Probe', () => {
  it('reports unavailable when navigator.modelContext is absent', () => {
    const capability = createCapabilityProbe().check();

    expect(capability.available).toBe(false);
    expect(capability.api.registerTool).toBe(false);
  });

  it('notifies a subscriber immediately', () => {
    const callback = vi.fn();
    const unsubscribe = createCapabilityProbe().onChange(callback);

    expect(callback).toHaveBeenCalledTimes(1);
    unsubscribe();
  });
});

// ============================================================================
// Spec version
// ============================================================================

describe('Spec Version', () => {
  it('pins the WebMCP spec version', () => {
    // CI compares this against the origin-trial version so an API change cannot
    // land unnoticed (AC F-6.x §6).
    expect(WEB_MCP_SPEC_VERSION).toBe('chrome-149-origin-trial-2026-05');
  });
});
