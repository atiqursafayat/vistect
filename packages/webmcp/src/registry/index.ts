// ============================================================================
// WebMCP Tool Registry
// ============================================================================

import { createSchemaCompiler, validateCompiledSchema, checkForbiddenPatterns } from '../compiler';
import { createRateLimiter, createExecutionGate, defaultRequireUserInteraction, defaultShowConfirmation, wrapToolExecute } from '../gate';
import { capabilityProbe } from '../probe';
import { WEB_MCP_SPEC_VERSION } from '../version';
import type { ToolDefinition, CompiledToolSchema } from '@vistect/domain/toolSchemas';
import type { CommandBus, Command, DocumentProject } from '@vistect/domain';
import type { RateLimiter, ExecutionGate } from '../gate';

// ============================================================================
// Registry Types
// ============================================================================

export interface RegisteredTool {
  definition: ToolDefinition;
  compiled: CompiledToolSchema;
  abortController: AbortController;
}

export interface ToolRegistry {
  registerTool(definition: ToolDefinition): void;
  unregisterTool(name: string): void;
  unregisterAll(signal?: AbortSignal): void;
  getTool(name: string): RegisteredTool | undefined;
  getAllTools(): RegisteredTool[];
  getCompiledSchemas(): CompiledToolSchema[];
  getToolsForAgent(): CompiledToolSchema[];
  setProjectContext(project: DocumentProject, commandBus: CommandBus): void;
  clearProjectContext(): void;
}

export interface ToolRegistryConfig {
  commandBus: CommandBus;
  project?: DocumentProject;
  rateLimiter?: RateLimiter;
  executionGate?: ExecutionGate;
  onToolChange?: () => void;
}

// ============================================================================
// Tool Registry Implementation
// ============================================================================

export function createToolRegistry(config: ToolRegistryConfig): ToolRegistry {
  const { commandBus, rateLimiter, executionGate, onToolChange } = config;
  const tools = new Map<string, RegisteredTool>();
  const compiler = createSchemaCompiler();
  let currentProject = config.project;

  // Register with browser's modelContext if available
  function registerWithBrowser(compiled: CompiledToolSchema, abortController: AbortController) {
    const modelContext = (navigator as any).modelContext;
    if (!modelContext || !modelContext.registerTool) return;

    try {
      modelContext.registerTool({
        name: compiled.name,
        description: compiled.description,
        title: compiled.title,
        inputSchema: compiled.inputSchema,
        execute: async (input: unknown) => {
          // This is called by the agent
          // We need to dispatch through command bus
          return 'Tool executed'; // Simplified
        },
        annotations: compiled.annotations,
      }, { signal: abortController.signal });
    } catch (error) {
      console.error(`Failed to register tool ${compiled.name}:`, error);
    }
  }

  function unregisterFromBrowser(name: string) {
    const modelContext = (navigator as any).modelContext;
    if (!modelContext) return;
    // Browser doesn't have explicit unregister - uses AbortSignal
  }

  return {
    registerTool(definition: ToolDefinition) {
      // Validate
      const compiled = compiler.compile(definition);
      const validation = validateCompiledSchema(compiled);
      if (!validation.valid) {
        throw new Error(`Tool validation failed: ${validation.errors.join(', ')}`);
      }

      // Check forbidden patterns
      const forbidden = checkForbiddenPatterns(definition.name);
      if (forbidden.length > 0) {
        throw new Error(`Forbidden tool patterns: ${forbidden.join(', ')}`);
      }

      // Check name uniqueness
      if (tools.has(definition.name)) {
        throw new Error(`Tool ${definition.name} already registered`);
      }

      const abortController = new AbortController();
      const registered: RegisteredTool = { definition, compiled, abortController };
      tools.set(definition.name, registered);

      // Register with browser if available
      if (currentProject) {
        registerWithBrowser(compiled, abortController);
      }

      // Notify change
      if (onToolChange) onToolChange();
    },

    unregisterTool(name: string) {
      const tool = tools.get(name);
      if (tool) {
        tool.abortController.abort();
        tools.delete(name);
        unregisterFromBrowser(name);
        if (onToolChange) onToolChange();
      }
    },

    unregisterAll(signal?: AbortSignal) {
      for (const tool of tools.values()) {
        tool.abortController.abort();
        unregisterFromBrowser(tool.definition.name);
      }
      tools.clear();
      if (onToolChange) onToolChange();

      if (signal) {
        signal.addEventListener('abort', () => {
          for (const tool of tools.values()) {
            tool.abortController.abort();
          }
          tools.clear();
        });
      }
    },

    getTool(name: string) {
      return tools.get(name);
    },

    getAllTools() {
      return Array.from(tools.values());
    },

    getCompiledSchemas() {
      return Array.from(tools.values()).map(t => t.compiled);
    },

    getToolsForAgent() {
      // Return all tools - browser handles exposure
      return this.getCompiledSchemas();
    },

    setProjectContext(project: DocumentProject, newCommandBus: CommandBus) {
      currentProject = project;
      // Re-register all tools with new project context
      for (const tool of tools.values()) {
        tool.abortController.abort();
        const newController = new AbortController();
        tool.abortController = newController;
        registerWithBrowser(tool.compiled, newController);
      }
    },

    clearProjectContext() {
      for (const tool of tools.values()) {
        tool.abortController.abort();
      }
      currentProject = undefined;
      if (onToolChange) onToolChange();
    },
  };
}

// ============================================================================
// Tool Execution Adapter
// ============================================================================

export function createToolExecutor(
  registry: ToolRegistry,
  commandBus: CommandBus,
  project: DocumentProject,
  showConfirmation: (toolName: string, input: unknown) => Promise<boolean> = defaultShowConfirmation
) {
  const rateLimiter = createRateLimiter();
  const gate = createExecutionGate({
    rateLimiter,
    requireUserInteraction: defaultRequireUserInteraction,
    showConfirmation,
  });

  return {
    async executeTool(toolName: string, input: unknown): Promise<{ ok: boolean; result?: string; error?: string; errorCode?: string }> {
      const tool = registry.getTool(toolName);
      if (!tool) {
        return { ok: false, error: `Tool ${toolName} not found`, errorCode: 'NotFound' };
      }

      // Build command from tool input
      // This is simplified - real implementation would map tool inputs to commands
      const command: Command = {
        id: `cmd_${crypto.randomUUID?.() || Math.random().toString(36).slice(2)}`,
        type: toolName,
        projectId: project.id,
        expectedVersion: project.currentVersion,
        actorId: project.actorId,
        payload: input,
        timestamp: new Date().toISOString(),
      };

      const result = await gate.execute(toolName, project, commandBus, command, async () => {
        // In real implementation, dispatch command
        await commandBus.dispatch(command);
      });

      return result;
    },

    async dryRun(toolName: string, inputJson: string): Promise<{ ok: boolean; result?: string; error?: string }> {
      const tool = registry.getTool(toolName);
      if (!tool) {
        return { ok: false, error: `Tool ${toolName} not found` };
      }

      try {
        const input = JSON.parse(inputJson);
        // Validate input against schema
        // In real implementation, use Zod to validate
        return { ok: true, result: 'Dry run successful' };
      } catch (error) {
        return { ok: false, error: error instanceof Error ? error.message : 'Invalid JSON' };
      }
    },
  };
}

// ============================================================================
// Pins / Snapshot Testing
// ============================================================================

export interface RegistrySnapshot {
  version: string;
  specVersion: string;
  tools: CompiledToolSchema[];
  timestamp: string;
}

export function createRegistrySnapshot(registry: ToolRegistry): RegistrySnapshot {
  return {
    version: '1.0.0',
    specVersion: WEB_MCP_SPEC_VERSION,
    tools: registry.getCompiledSchemas(),
    timestamp: new Date().toISOString(),
  };
}

export function compareSnapshots(current: RegistrySnapshot, pinned: RegistrySnapshot): { equal: boolean; differences: string[] } {
  const differences: string[] = [];

  if (current.tools.length !== pinned.tools.length) {
    differences.push(`Tool count changed: ${pinned.tools.length} → ${current.tools.length}`);
  }

  const currentByName = new Map(current.tools.map(t => [t.name, t]));
  const pinnedByName = new Map(pinned.tools.map(t => [t.name, t]));

  for (const [name, pinnedTool] of pinnedByName) {
    const currentTool = currentByName.get(name);
    if (!currentTool) {
      differences.push(`Tool removed: ${name}`);
      continue;
    }

    if (JSON.stringify(currentTool) !== JSON.stringify(pinnedTool)) {
      differences.push(`Tool changed: ${name}`);
    }
  }

  for (const [name, currentTool] of currentByName) {
    if (!pinnedByName.has(name)) {
      differences.push(`Tool added: ${name}`);
    }
  }

  return { equal: differences.length === 0, differences };
}