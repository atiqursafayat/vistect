// ============================================================================
// WebMCP Package Exports
// ============================================================================
//
// Registry, schema compiler, execution gate, activity stream, and capability
// probe. Imports `@vistect/domain` only — never `apps/web` (see
// `docs/planning/13-repository-structure.md`).

export {
  WEB_MCP_SPEC_VERSION,
  EXPECTED_TOOL_SHAPE,
  EXPECTED_DECLARATIVE_ATTRS,
  WEB_MCP_API_SURFACE,
} from './version';

export {
  getModelContext,
  type ModelContext,
  type ModelContextClient,
  type ModelContextTool,
  type RegisterToolOptions,
} from './types';

export {
  capabilityProbe,
  createCapabilityProbe,
  type CapabilityProbe,
  type WebMCPCapability,
} from './probe';

export {
  createSchemaCompiler,
  validateCompiledSchema,
  checkForbiddenPatterns,
  type CompiledToolSchema,
  type JsonSchemaObject,
  type SchemaCompiler,
  type SchemaValidation,
} from './compiler';

export {
  createRateLimiter,
  createExecutionGate,
  createBrowserConfirmationHandler,
  defaultRequireUserInteraction,
  defaultShowConfirmation,
  getRateLimitConfig,
  wrapToolExecute,
  CONSEQUENTIAL_TOOLS,
  CONFIRMATION_TIMEOUT_MS,
  type ConfirmationHandler,
  type ConfirmationRequestDetail,
  type ConfirmationResponseDetail,
  type ExecutionGate,
  type ExecutionGateConfig,
  type RateLimitConfig,
  type RateLimiter,
  type RateLimitResult,
  type ToolExecuteFn,
  type WebMCPClient,
} from './gate';

export {
  createToolRegistry,
  createRegistrySnapshot,
  compareSnapshots,
  SNAPSHOT_FORMAT_VERSION,
  type RegisteredTool,
  type RegistrySnapshot,
  type SnapshotComparison,
  type ToolExecutionResult,
  type ToolRegistry,
  type ToolRegistryConfig,
} from './registry';

export {
  activityRecorder,
  createActivityRecorder,
  createActivityStream,
  type ActivityFilter,
  type ActivityRecorder,
  type AgentActivityEntry,
} from './activity';
