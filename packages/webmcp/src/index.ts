// ============================================================================
// WebMCP Package Exports
// ============================================================================

export { WEB_MCP_SPEC_VERSION, EXPECTED_TOOL_SHAPE, EXPECTED_DECLARATIVE_ATTRS, WEB_MCP_API_SURFACE } from './version';
export { capabilityProbe, createCapabilityProbe, type WebMCPCapability, type CapabilityProbe } from './probe';
export { createSchemaCompiler, validateCompiledSchema, checkForbiddenPatterns, type CompiledToolSchema, type SchemaCompiler } from './compiler';
export { createRateLimiter, createExecutionGate, defaultRequireUserInteraction, defaultShowConfirmation, wrapToolExecute, type RateLimiter, type RateLimitConfig, type ExecutionGate, type ExecutionGateConfig, type WebMCPClient, type ToolExecuteFn, CONSEQUENTIAL_TOOLS } from './gate';
export { createToolRegistry, createToolExecutor, createRegistrySnapshot, compareSnapshots, type ToolRegistry, type ToolRegistryConfig, type RegisteredTool, type RegistrySnapshot } from './registry';
export { activityRecorder, createActivityRecorder, createActivityStream, type ActivityRecorder, type AgentActivityEntry, type ActivityFilter } from './activity';