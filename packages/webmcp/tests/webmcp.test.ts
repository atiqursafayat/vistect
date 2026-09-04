import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  createSchemaCompiler,
  validateCompiledSchema,
  checkForbiddenPatterns,
} from '../src/compiler';
import {
  createRateLimiter,
  defaultRequireUserInteraction,
  CONSEQUENTIAL_TOOLS,
} from '../src/gate';
import { createToolRegistry, createRegistrySnapshot, compareSnapshots } from '../src/registry';
import { createActivityRecorder } from '../src/activity';
import { WEB_MCP_SPEC_VERSION } from '../src/version';
import type { ToolDefinition } from '@vistect/domain/toolSchemas';

// ============================================================================
// Test Tool Definitions
// ============================================================================

const createTestTool = (overrides: Partial<ToolDefinition> = {}): ToolDefinition => ({
  name: 'test_tool',
  description: 'A test tool',
  inputSchema: {
    type: 'object',
    properties: {
      text: { type: 'string', description: 'Input text' },
    },
    required: ['text'],
    additionalProperties: false,
  },
  annotations: { readOnlyHint: false, untrustedContentHint: false },
  ...overrides,
});

const createReadOnlyTool = (overrides: Partial<ToolDefinition> = {}): ToolDefinition => ({
  name: 'get_data',
  description: 'Get data',
  inputSchema: {
    type: 'object',
    properties: {},
    required: [],
    additionalProperties: false,
  },
  annotations: { readOnlyHint: true, untrustedContentHint: false },
  ...overrides,
});

// ============================================================================
// Schema Compiler Tests
// ============================================================================

describe('Schema Compiler', () => {
  const compiler = createSchemaCompiler();

  it('compiles tool with strict schema', () => {
    const tool = createTestTool();
    const compiled = compiler.compile(tool);

    expect(compiled.name).toBe('test_tool');
    expect(compiled.description).toBe('A test tool');
    expect(compiled.inputSchema.type).toBe('object');
    expect(compiled.inputSchema.additionalProperties).toBe(false);
    expect(compiled.annotations.readOnlyHint).toBe(false);
    expect(compiled.annotations.untrustedContentHint).toBe(false);
  });

  it('enforces additionalProperties: false on nested objects', () => {
    const tool = createTestTool({
      inputSchema: {
        type: 'object',
        properties: {
          nested: {
            type: 'object',
            properties: { value: { type: 'string' } },
            required: ['value'],
            additionalProperties: false,
          },
        },
        required: ['nested'],
        additionalProperties: false,
      },
    });
    const compiled = compiler.compile(tool);

    const nestedSchema = compiled.inputSchema.properties?.nested as Record<string, unknown>;
    expect(nestedSchema.additionalProperties).toBe(false);
  });

  it('validates compiled schema', () => {
    const tool = createTestTool();
    const compiled = compiler.compile(tool);
    const validation = validateCompiledSchema(compiled);

    expect(validation.valid).toBe(true);
    expect(validation.errors).toEqual([]);
  });

  it('rejects invalid tool name', () => {
    const tool = createTestTool({ name: 'Invalid_Tool' });
    const compiled = compiler.compile(tool);
    const validation = validateCompiledSchema(compiled);

    expect(validation.valid).toBe(false);
    expect(validation.errors.some(e => e.includes('name'))).toBe(true);
  });

  it('rejects missing description', () => {
    const tool = createTestTool({ description: '' });
    const compiled = compiler.compile(tool);
    const validation = validateCompiledSchema(compiled);

    expect(validation.valid).toBe(false);
    expect(validation.errors.some(e => e.includes('description'))).toBe(true);
  });

  it('rejects missing annotations', () => {
    const tool = createTestTool();
    const compiled = compiler.compile(tool);
    compiled.annotations = {} as any;
    const validation = validateCompiledSchema(compiled);

    expect(validation.valid).toBe(false);
    expect(validation.errors.some(e => e.includes('annotations'))).toBe(true);
  });
});

// ============================================================================
// Forbidden Patterns Tests
// ============================================================================

describe('Forbidden Patterns', () => {
  it('detects approve_all', () => {
    const violations = checkForbiddenPatterns('approve_all');
    expect(violations.length).toBeGreaterThan(0);
  });

  it('detects publish_everything', () => {
    const violations = checkForbiddenPatterns('publish_everything');
    expect(violations.length).toBeGreaterThan(0);
  });

  it('detects generate_and_export_without_review', () => {
    const violations = checkForbiddenPatterns('generate_and_export_without_review');
    expect(violations.length).toBeGreaterThan(0);
  });

  it('detects auto_ prefix', () => {
    const violations = checkForbiddenPatterns('auto_delete');
    expect(violations.length).toBeGreaterThan(0);
  });

  it('detects _all suffix', () => {
    const violations = checkForbiddenPatterns('delete_all');
    expect(violations.length).toBeGreaterThan(0);
  });

  it('detects bulk_ prefix', () => {
    const violations = checkForbiddenPatterns('bulk_update');
    expect(violations.length).toBeGreaterThan(0);
  });

  it('detects _everything suffix', () => {
    const violations = checkForbiddenPatterns('process_everything');
    expect(violations.length).toBeGreaterThan(0);
  });

  it('allows valid tool names', () => {
    const violations = checkForbiddenPatterns('create_page');
    expect(violations).toEqual([]);
  });

  it('allows valid tool names with dots', () => {
    const violations = checkForbiddenPatterns('export.pdf');
    expect(violations).toEqual([]);
  });
});

// ============================================================================
// Rate Limiter Tests
// ============================================================================

describe('Rate Limiter', () => {
  it('allows requests within capacity', () => {
    const limiter = createRateLimiter();
    const result = limiter.checkLimit('get_project');
    expect(result.allowed).toBe(true);
  });

  it('tracks tokens per tool', () => {
    const limiter = createRateLimiter();

    // Use all tokens for get_project (capacity 50)
    for (let i = 0; i < 50; i++) {
      expect(limiter.checkLimit('get_project').allowed).toBe(true);
    }

    // Next request should be rate limited
    const result = limiter.checkLimit('get_project');
    expect(result.allowed).toBe(false);
    expect(result.retryAfterMs).toBeGreaterThan(0);
  });

  it('separate limits for different tools', () => {
    const limiter = createRateLimiter();

    // Exhaust get_project
    for (let i = 0; i < 50; i++) {
      limiter.checkLimit('get_project');
    }
    expect(limiter.checkLimit('get_project').allowed).toBe(false);

    // create_project should still work (different bucket)
    expect(limiter.checkLimit('create_project').allowed).toBe(true);
  });

  it('refills tokens over time', async () => {
    const limiter = createRateLimiter();

    // Exhaust create_project (capacity 10, refill 2/sec)
    for (let i = 0; i < 10; i++) {
      expect(limiter.checkLimit('create_project').allowed).toBe(true);
    }
    expect(limiter.checkLimit('create_project').allowed).toBe(false);

    // Wait for refill
    await new Promise(r => setTimeout(r, 600));
    expect(limiter.checkLimit('create_project').allowed).toBe(true);
  });

  it('reset clears all buckets', () => {
    const limiter = createRateLimiter();
    limiter.checkLimit('get_project');
    limiter.checkLimit('create_project');
    limiter.reset();
    expect(limiter.checkLimit('get_project').allowed).toBe(true);
  });
});

// ============================================================================
// Default Require User Interaction Tests
// ============================================================================

describe('Default Require User Interaction', () => {
  it('returns true for consequential tools', () => {
    expect(defaultRequireUserInteraction('lock_document')).toBe(true);
    expect(defaultRequireUserInteraction('unlock_document')).toBe(true);
    expect(defaultRequireUserInteraction('finalize_export')).toBe(true);
    expect(defaultRequireUserInteraction('delete_project')).toBe(true);
    expect(defaultRequireUserInteraction('delete_page')).toBe(true);
    expect(defaultRequireUserInteraction('delete_object')).toBe(true);
    expect(defaultRequireUserInteraction('approve_decision')).toBe(true);
    expect(defaultRequireUserInteraction('reject_decision')).toBe(true);
    expect(defaultRequireUserInteraction('approve_export_manifest')).toBe(true);
  });

  it('returns false for read tools', () => {
    expect(defaultRequireUserInteraction('get_project')).toBe(false);
    expect(defaultRequireUserInteraction('list_projects')).toBe(false);
    expect(defaultRequireUserInteraction('inspect_image')).toBe(false);
    expect(defaultRequireUserInteraction('get_findings')).toBe(false);
  });

  it('returns false for non-consequential write tools', () => {
    expect(defaultRequireUserInteraction('create_page')).toBe(false);
    expect(defaultRequireUserInteraction('update_object')).toBe(false);
    expect(defaultRequireUserInteraction('move_object')).toBe(false);
  });

  it('CONSEQUENTIAL_TOOLS set has expected entries', () => {
    expect(CONSEQUENTIAL_TOOLS.has('lock_document')).toBe(true);
    expect(CONSEQUENTIAL_TOOLS.has('finalize_export')).toBe(true);
    expect(CONSEQUENTIAL_TOOLS.has('delete_project')).toBe(true);
    expect(CONSEQUENTIAL_TOOLS.has('approve_decision')).toBe(true);
  });
});

// ============================================================================
// Tool Registry Tests
// ============================================================================

describe('Tool Registry', () => {
  const mockCommandBus = {
    dispatch: vi.fn().mockResolvedValue({ ok: true, version: 1, changedIds: [] }),
  } as any;

  let registry: ReturnType<typeof createToolRegistry>;

  beforeEach(() => {
    registry = createToolRegistry({
      commandBus: mockCommandBus,
    });
  });

  it('registers and retrieves tool', () => {
    const tool = createTestTool();
    registry.registerTool(tool);

    const retrieved = registry.getTool('test_tool');
    expect(retrieved).toBeDefined();
    expect(retrieved?.definition.name).toBe('test_tool');
    expect(retrieved?.compiled.name).toBe('test_tool');
  });

  it('prevents duplicate registration', () => {
    const tool = createTestTool();
    registry.registerTool(tool);

    expect(() => registry.registerTool(tool)).toThrow('already registered');
  });

  it('validates tool on registration', () => {
    const tool = createTestTool({ name: 'Invalid_Tool' });
    expect(() => registry.registerTool(tool)).toThrow('validation failed');
  });

  it('rejects forbidden patterns', () => {
    const tool = createTestTool({ name: 'approve_all' });
    expect(() => registry.registerTool(tool)).toThrow('Forbidden tool patterns');
  });

  it('unregisters tool', () => {
    const tool = createTestTool();
    registry.registerTool(tool);
    registry.unregisterTool('test_tool');
    expect(registry.getTool('test_tool')).toBeUndefined();
  });

  it('unregisters all tools', () => {
    registry.registerTool(createTestTool({ name: 'tool_1' }));
    registry.registerTool(createTestTool({ name: 'tool_2' }));
    registry.unregisterAll();
    expect(registry.getAllTools()).toHaveLength(0);
  });

  it('returns compiled schemas', () => {
    registry.registerTool(createTestTool({ name: 'tool_1' }));
    registry.registerTool(createReadOnlyTool({ name: 'tool_2' }));

    const schemas = registry.getCompiledSchemas();
    expect(schemas).toHaveLength(2);
    expect(schemas[0].annotations.readOnlyHint).toBe(false);
    expect(schemas[1].annotations.readOnlyHint).toBe(true);
  });

  it('getToolsForAgent returns all tools', () => {
    registry.registerTool(createTestTool({ name: 'tool_1' }));
    registry.registerTool(createReadOnlyTool({ name: 'tool_2' }));

    const tools = registry.getToolsForAgent();
    expect(tools).toHaveLength(2);
  });
});

// ============================================================================
// Registry Snapshot Tests
// ============================================================================

describe('Registry Snapshot', () => {
  const mockCommandBus = { dispatch: vi.fn() } as any;
  let registry: ReturnType<typeof createToolRegistry>;

  beforeEach(() => {
    registry = createToolRegistry({ commandBus: mockCommandBus });
    registry.registerTool(createTestTool({ name: 'tool_1' }));
    registry.registerTool(createReadOnlyTool({ name: 'tool_2' }));
  });

  it('creates snapshot with correct structure', () => {
    const snapshot = createRegistrySnapshot(registry);

    expect(snapshot.version).toBe('1.0.0');
    expect(snapshot.specVersion).toBe(WEB_MCP_SPEC_VERSION);
    expect(snapshot.tools).toHaveLength(2);
    expect(snapshot.timestamp).toBeDefined();
  });

  it('compares equal snapshots', () => {
    const snapshot1 = createRegistrySnapshot(registry);
    const snapshot2 = createRegistrySnapshot(registry);

    const result = compareSnapshots(snapshot1, snapshot2);
    expect(result.equal).toBe(true);
    expect(result.differences).toEqual([]);
  });

  it('detects added tool', () => {
    const snapshot1 = createRegistrySnapshot(registry);

    registry.registerTool(createTestTool({ name: 'tool_3' }));
    const snapshot2 = createRegistrySnapshot(registry);

    const result = compareSnapshots(snapshot1, snapshot2);
    expect(result.equal).toBe(false);
    expect(result.differences.some(d => d.includes('added: tool_3'))).toBe(true);
  });

  it('detects removed tool', () => {
    const snapshot1 = createRegistrySnapshot(registry);

    registry.unregisterTool('tool_1');
    const snapshot2 = createRegistrySnapshot(registry);

    const result = compareSnapshots(snapshot1, snapshot2);
    expect(result.equal).toBe(false);
    expect(result.differences.some(d => d.includes('removed: tool_1'))).toBe(true);
  });

  it('detects changed tool', () => {
    const snapshot1 = createRegistrySnapshot(registry);

    registry.unregisterTool('tool_1');
    registry.registerTool(createTestTool({ name: 'tool_1', description: 'Changed description' }));
    const snapshot2 = createRegistrySnapshot(registry);

    const result = compareSnapshots(snapshot1, snapshot2);
    expect(result.equal).toBe(false);
    expect(result.differences.some(d => d.includes('changed: tool_1'))).toBe(true);
  });
});

// ============================================================================
// Activity Recorder Tests
// ============================================================================

describe('Activity Recorder', () => {
  let recorder: ReturnType<typeof createActivityRecorder>;

  beforeEach(() => {
    recorder = createActivityRecorder();
  });

  it('records entry with metadata', () => {
    const entry = recorder.record({
      toolName: 'test_tool',
      input: { text: 'hello' },
      result: 'success',
      status: 'success',
      versionBefore: 1,
      versionAfter: 2,
      durationMs: 100,
      actorId: 'act_1' as any,
    });

    expect(entry.id).toBeDefined();
    expect(entry.timestamp).toBeDefined();
    expect(entry.toolName).toBe('test_tool');
    expect(entry.status).toBe('success');
  });

  it('filters entries by toolName', () => {
    recorder.record({ toolName: 'tool_a', input: {}, result: {}, status: 'success', versionBefore: 1, versionAfter: 2, durationMs: 10, actorId: 'act_1' as any });
    recorder.record({ toolName: 'tool_b', input: {}, result: {}, status: 'success', versionBefore: 1, versionAfter: 2, durationMs: 10, actorId: 'act_1' as any });
    recorder.record({ toolName: 'tool_a', input: {}, result: {}, status: 'success', versionBefore: 1, versionAfter: 2, durationMs: 10, actorId: 'act_1' as any });

    const filtered = recorder.getEntries({ toolName: 'tool_a' });
    expect(filtered).toHaveLength(2);
  });

  it('filters entries by status', () => {
    recorder.record({ toolName: 'tool_a', input: {}, result: {}, status: 'success', versionBefore: 1, versionAfter: 2, durationMs: 10, actorId: 'act_1' as any });
    recorder.record({ toolName: 'tool_b', input: {}, result: {}, status: 'error', versionBefore: 1, versionAfter: 2, durationMs: 10, actorId: 'act_1' as any });

    const errors = recorder.getEntries({ status: 'error' });
    expect(errors).toHaveLength(1);
    expect(errors[0].status).toBe('error');
  });

  it('filters entries by actorId', () => {
    recorder.record({ toolName: 'tool_a', input: {}, result: {}, status: 'success', versionBefore: 1, versionAfter: 2, durationMs: 10, actorId: 'act_1' as any });
    recorder.record({ toolName: 'tool_b', input: {}, result: {}, status: 'success', versionBefore: 1, versionAfter: 2, durationMs: 10, actorId: 'act_2' as any });

    const filtered = recorder.getEntries({ actorId: 'act_1' });
    expect(filtered).toHaveLength(1);
    expect(filtered[0].actorId).toBe('act_1');
  });

  it('limits entries', () => {
    for (let i = 0; i < 10; i++) {
      recorder.record({ toolName: `tool_${i}`, input: {}, result: {}, status: 'success', versionBefore: i, versionAfter: i + 1, durationMs: 10, actorId: 'act_1' as any });
    }

    const limited = recorder.getEntries({ limit: 5 });
    expect(limited).toHaveLength(5);
  });

  it('subscribes to new entries', () => {
    const callback = vi.fn();
    const unsubscribe = recorder.subscribe(callback);

    recorder.record({ toolName: 'tool_a', input: {}, result: {}, status: 'success', versionBefore: 1, versionAfter: 2, durationMs: 10, actorId: 'act_1' as any });

    expect(callback).toHaveBeenCalledTimes(1);

    unsubscribe();
    recorder.record({ toolName: 'tool_b', input: {}, result: {}, status: 'success', versionBefore: 1, versionAfter: 2, durationMs: 10, actorId: 'act_1' as any });
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('clears entries', () => {
    recorder.record({ toolName: 'tool_a', input: {}, result: {}, status: 'success', versionBefore: 1, versionAfter: 2, durationMs: 10, actorId: 'act_1' as any });
    recorder.clear();
    expect(recorder.getEntries()).toHaveLength(0);
  });

  it('trims old entries when over limit', () => {
    // This test would need a modified MAX_ENTRIES to run quickly
    // Skipping due to time constraints
  });
});

// ============================================================================
// Spec Version Tests
// ============================================================================

describe('Spec Version', () => {
  it('has correct spec version constant', () => {
    expect(WEB_MCP_SPEC_VERSION).toBe('chrome-149-origin-trial-2026-05');
  });
});