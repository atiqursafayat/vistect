// ============================================================================
// WebMCP Tool Registry
// ============================================================================
//
// Registers the project's tools with `navigator.modelContext` and routes agent
// invocations into the command bus (ADR-004: one write path).
//
// Lifecycle is **per open project**: tools are registered when a project opens and
// unregistered when it closes, so an agent cannot address a project the user is
// not working in. Unregistration uses `AbortSignal`, which is the only removal
// mechanism the WebMCP API provides.


import type { CommandBus } from '@vistect/domain/bus';
import type { Command, CommandResult, CommandType } from '@vistect/domain/commands';
import type { DocumentProject } from '@vistect/domain/schema';
import { getToolDefinition } from '@vistect/domain/toolSchemas';
import type { ToolDefinition } from '@vistect/domain/toolSchemas';
import { type z } from 'zod';

import {
  checkForbiddenPatterns,
  createSchemaCompiler,
  validateCompiledSchema,
  type CompiledToolSchema,
} from '../compiler';
import { createExecutionGate, createRateLimiter, type ExecutionGate, type RateLimiter } from '../gate';
import { getModelContext } from '../types';
import { WEB_MCP_SPEC_VERSION } from '../version';

export type { CompiledToolSchema };

export interface RegisteredTool {
  definition: ToolDefinition;
  compiled: CompiledToolSchema;
  abortController: AbortController;
}

export interface ToolExecutionResult {
  ok: boolean;
  result?: string;
  error?: string;
  errorCode?: string;
}

export interface ToolRegistry {
  registerTool(definition: ToolDefinition): void;
  unregisterTool(name: string): void;
  unregisterAll(): void;
  getTool(name: string): RegisteredTool | undefined;
  getAllTools(): RegisteredTool[];
  getCompiledSchemas(): CompiledToolSchema[];
  /** Opens a project for agent access and (re-)registers tools against it. */
  setProjectContext(project: DocumentProject, commandBus: CommandBus): void;
  /** Closes agent access. Tools are unregistered from the browser. */
  clearProjectContext(): void;
}

export interface ToolRegistryConfig {
  commandBus: CommandBus;
  project?: DocumentProject;
  rateLimiter?: RateLimiter;
  executionGate?: ExecutionGate;
  onToolChange?: () => void;
  /** Records each agent invocation for the activity stream (§21.3). */
  onExecution?: (entry: {
    toolName: string;
    input: unknown;
    result: ToolExecutionResult;
    durationMs: number;
    versionBefore: number;
    versionAfter: number;
  }) => void;
}

/**
 * Maps a tool name to the command it dispatches.
 *
 * Explicit rather than derived from the name, because the two vocabularies differ
 * deliberately: tools are named for what an agent wants to do (`create_text_object`)
 * and commands for what the domain does (`CreateObject`). Deriving one from the
 * other would couple the agent-facing contract to internal naming, and an unmapped
 * tool must be a rejection rather than a guess.
 */
const TOOL_COMMAND_MAP: Readonly<Record<string, CommandType>> = {
  create_project: 'CreateProject',
  update_project: 'UpdateProject',
  delete_project: 'DeleteProject',
  encrypt_project: 'EncryptProject',
  import_project: 'ImportProject',
  request_review: 'RequestReview',
  lock_document: 'LockDocument',
  unlock_document: 'UnlockDocument',
  create_page: 'CreatePage',
  update_page: 'UpdatePage',
  delete_page: 'DeletePage',
  reorder_pages: 'ReorderPages',
  create_text_object: 'CreateObject',
  update_text_object: 'UpdateObject',
  delete_object: 'DeleteObject',
  move_object: 'MoveObject',
  set_object_constraints: 'SetObjectConstraints',
  reorder_reading_order: 'ReorderObjectReadingOrder',
  upload_asset: 'UploadAsset',
  update_asset: 'UpdateAsset',
  delete_asset: 'DeleteAsset',
  record_image_analysis: 'RecordAssetAnalysis',
  crop_image: 'RegisterAssetCrop',
  create_dataset: 'CreateDataset',
  update_dataset: 'UpdateDataset',
  delete_dataset: 'DeleteDataset',
  confirm_dataset_schema: 'ConfirmDatasetSchema',
  create_diagram: 'CreateDiagram',
  update_diagram: 'UpdateDiagram',
  delete_diagram: 'DeleteDiagram',
  add_diagram_node: 'AddDiagramNode',
  update_diagram_node: 'UpdateDiagramNode',
  remove_diagram_node: 'RemoveDiagramNode',
  add_diagram_edge: 'AddDiagramEdge',
  update_diagram_edge: 'UpdateDiagramEdge',
  remove_diagram_edge: 'RemoveDiagramEdge',
  apply_diagram_layout: 'ApplyDiagramLayout',
  create_chart: 'CreateChart',
  update_chart: 'UpdateChart',
  delete_chart: 'DeleteChart',
  create_decision: 'CreateDecision',
  update_decision: 'UpdateDecision',
  approve_decision: 'ApproveDecision',
  reject_decision: 'RejectDecision',
  request_decision_alternatives: 'RequestDecisionAlternatives',
  create_finding: 'CreateFinding',
  resolve_finding: 'ResolveFinding',
  accept_finding: 'AcceptFinding',
  dismiss_finding: 'DismissFinding',
  confirm_readiness: 'ConfirmReadiness',
  create_export_job: 'CreateExportJob',
  approve_export_manifest: 'ApproveExportManifest',
  finalize_export: 'FinalizeExport',
};

export function createToolRegistry(config: ToolRegistryConfig): ToolRegistry {
  const { onToolChange, onExecution } = config;
  const tools = new Map<string, RegisteredTool>();
  const compiler = createSchemaCompiler();
  const rateLimiter = config.rateLimiter ?? createRateLimiter();
  const gate = config.executionGate ?? createExecutionGate({ rateLimiter });

  let currentProject = config.project;
  let currentBus = config.commandBus;

  /**
   * Executes a tool by validating input, building a command, and dispatching it
   * through the gate and the bus.
   *
   * Returns a plain string, which is what WebMCP expects. Every failure is
   * reported as a JSON string rather than thrown, so the agent gets a structured
   * reason instead of an opaque rejection.
   */
  async function executeTool(toolName: string, rawInput: unknown): Promise<string> {
    const started = performance.now();
    const project = currentProject;

    const respond = (result: ToolExecutionResult, versionAfter: number): string => {
      onExecution?.({
        toolName,
        input: rawInput,
        result,
        durationMs: Math.round(performance.now() - started),
        versionBefore: project?.currentVersion ?? 0,
        versionAfter,
      });
      return JSON.stringify(result);
    };

    if (project === undefined) {
      return respond(
        { ok: false, error: 'No project is open.', errorCode: 'NotFound' },
        0
      );
    }

    const definition = getToolDefinition(toolName);
    if (definition === undefined) {
      return respond(
        { ok: false, error: `Unknown tool ${toolName}.`, errorCode: 'NotFound' },
        project.currentVersion
      );
    }

    // Input is validated against the *same* Zod schema the agent was given, so a
    // malformed call is rejected here rather than reaching the domain.
    const parsed = definition.inputSchema.safeParse(rawInput);
    if (!parsed.success) {
      return respond(
        {
          ok: false,
          error: formatZodError(parsed.error),
          errorCode: 'SchemaValidationError',
        },
        project.currentVersion
      );
    }

    const commandType = TOOL_COMMAND_MAP[toolName];
    if (commandType === undefined) {
      // A read-only tool has no command; a write tool without a mapping is a
      // registry defect and must not silently no-op.
      if (definition.annotations.readOnlyHint) {
        return respond(
          {
            ok: false,
            error: `Tool ${toolName} is read-only and has no query handler registered.`,
            errorCode: 'NotImplemented',
          },
          project.currentVersion
        );
      }
      return respond(
        {
          ok: false,
          error: `Tool ${toolName} has no command mapping.`,
          errorCode: 'NotImplemented',
        },
        project.currentVersion
      );
    }

    // `as Command` narrows the envelope-plus-payload literal to the discriminated
    // union; the payload was already validated by the tool's own Zod schema above.
    const command = {
      id: `cmd_agent_${String(Date.now())}`,
      projectId: project.id,
      // Read from the live project so a version bumped by a previous call in the
      // same turn is respected; a stale value would trip the version guard.
      expectedVersion: project.currentVersion,
      actorId: project.actorId,
      timestamp: new Date().toISOString(),
      type: commandType,
      payload: parsed.data as never,
    } as Command;

    const result = await gate.execute(toolName, command, () =>
      currentBus.dispatchFromAgent(command, toolName)
    );

    return respond(toToolResult(result), result.version ?? project.currentVersion);
  }

  function registerWithBrowser(tool: RegisteredTool): void {
    const modelContext = getModelContext();
    if (modelContext?.registerTool === undefined) return;

    try {
      modelContext.registerTool(
        {
          name: tool.compiled.name,
          description: tool.compiled.description,
          ...(tool.compiled.title === undefined ? {} : { title: tool.compiled.title }),
          inputSchema: tool.compiled.inputSchema,
          annotations: tool.compiled.annotations,
          execute: async (input) => executeTool(tool.compiled.name, input),
        },
        { signal: tool.abortController.signal }
      );
    } catch (error) {
      // Registration failure is not fatal — the UI still works — but it must be
      // visible, since the agent will silently lack the tool.
      console.error(`Failed to register tool ${tool.compiled.name}:`, error);
    }
  }

  return {
    registerTool(definition: ToolDefinition) {
      if (tools.has(definition.name)) {
        throw new Error(`Tool ${definition.name} is already registered`);
      }

      const forbidden = checkForbiddenPatterns(definition.name);
      if (forbidden.length > 0) {
        throw new Error(`Forbidden tool patterns: ${forbidden.join(', ')}`);
      }

      const compiled = compiler.compile(definition);
      const validation = validateCompiledSchema(compiled);
      if (!validation.valid) {
        throw new Error(`Tool validation failed: ${validation.errors.join(', ')}`);
      }

      const tool: RegisteredTool = {
        definition,
        compiled,
        abortController: new AbortController(),
      };
      tools.set(definition.name, tool);

      // Only exposed while a project is open (§18 scoping rule).
      if (currentProject !== undefined) {
        registerWithBrowser(tool);
      }

      onToolChange?.();
    },

    unregisterTool(name: string) {
      const tool = tools.get(name);
      if (tool === undefined) return;

      tool.abortController.abort();
      tools.delete(name);
      onToolChange?.();
    },

    unregisterAll() {
      for (const tool of tools.values()) {
        tool.abortController.abort();
      }
      tools.clear();
      onToolChange?.();
    },

    getTool(name: string) {
      return tools.get(name);
    },

    getAllTools() {
      return [...tools.values()];
    },

    getCompiledSchemas() {
      return [...tools.values()].map((tool) => tool.compiled);
    },

    setProjectContext(project: DocumentProject, commandBus: CommandBus) {
      currentProject = project;
      currentBus = commandBus;

      // Re-register so each tool's closure targets the new project. The previous
      // implementation aborted the old controllers but reused them, so every tool
      // registered against an already-aborted signal and was immediately removed.
      for (const [name, tool] of tools) {
        tool.abortController.abort();
        const replacement: RegisteredTool = {
          definition: tool.definition,
          compiled: tool.compiled,
          abortController: new AbortController(),
        };
        tools.set(name, replacement);
        registerWithBrowser(replacement);
      }

      onToolChange?.();
    },

    clearProjectContext() {
      for (const tool of tools.values()) {
        tool.abortController.abort();
      }
      currentProject = undefined;
      onToolChange?.();
    },
  };
}

/** Field-path-prefixed messages, so an agent can correct a specific input. */
function formatZodError(error: z.ZodError): string {
  return error.issues
    .map((issue) => {
      const path = issue.path.join('.');
      return path === '' ? issue.message : `${path}: ${issue.message}`;
    })
    .join('; ');
}

/**
 * Narrows a `CommandResult` to the minimum an agent needs.
 *
 * Deliberately excludes project content: tool results are data, never
 * instructions, which is the prompt-injection defence in §18.
 */
function toToolResult(result: CommandResult): ToolExecutionResult {
  if (result.ok) {
    return {
      ok: true,
      result: JSON.stringify({
        version: result.version,
        changedIds: result.changedIds,
      }),
    };
  }

  return {
    ok: false,
    ...(result.error === undefined ? {} : { error: result.error }),
    ...(result.errorCode === undefined ? {} : { errorCode: result.errorCode }),
  };
}

// ============================================================================
// Registry snapshot (pinning)
// ============================================================================
//
// The registry is pinned to a checked-in snapshot so a tool cannot be added,
// removed, or have its schema changed without an explicit diff in review. This is
// the tool-poisoning defence in `07-security-review.md` §3.

export interface RegistrySnapshot {
  /** Snapshot format version. */
  version: string;
  specVersion: string;
  toolCount: number;
  tools: CompiledToolSchema[];
}

export const SNAPSHOT_FORMAT_VERSION = '1.0.0';

/**
 * Captures the registry for comparison against the pinned snapshot.
 *
 * Contains no timestamp: a snapshot must be byte-stable for an unchanged
 * registry, and an embedded `generatedAt` made every run differ.
 */
export function createRegistrySnapshot(registry: ToolRegistry): RegistrySnapshot {
  const tools = registry
    .getCompiledSchemas()
    // Sorted so registration order cannot alter the snapshot.
    .sort((a, b) => a.name.localeCompare(b.name));

  return {
    version: SNAPSHOT_FORMAT_VERSION,
    specVersion: WEB_MCP_SPEC_VERSION,
    toolCount: tools.length,
    tools,
  };
}

export interface SnapshotComparison {
  equal: boolean;
  differences: string[];
}

export function compareSnapshots(
  current: RegistrySnapshot,
  pinned: RegistrySnapshot
): SnapshotComparison {
  const differences: string[] = [];

  if (current.specVersion !== pinned.specVersion) {
    differences.push(
      `WebMCP spec version changed: ${pinned.specVersion} → ${current.specVersion}`
    );
  }

  const currentByName = new Map(current.tools.map((t) => [t.name, t]));
  const pinnedByName = new Map(pinned.tools.map((t) => [t.name, t]));

  for (const [name, pinnedTool] of pinnedByName) {
    const currentTool = currentByName.get(name);
    if (currentTool === undefined) {
      differences.push(`Tool removed: ${name}`);
      continue;
    }
    if (JSON.stringify(currentTool) !== JSON.stringify(pinnedTool)) {
      differences.push(`Tool changed: ${name}`);
    }
  }

  for (const name of currentByName.keys()) {
    if (!pinnedByName.has(name)) {
      differences.push(`Tool added: ${name}`);
    }
  }

  return { equal: differences.length === 0, differences };
}
