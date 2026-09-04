// ============================================================================
// WebMCP Spec Version
// ============================================================================

/**
 * WebMCP specification version targeted by this implementation.
 * This reflects the Chrome 149 Origin Trial (May 2026) and W3C Web ML Community Group draft.
 * Update this constant when the spec changes and run the migration checklist.
 */
export const WEB_MCP_SPEC_VERSION = 'chrome-149-origin-trial-2026-05';

/**
 * Expected tool object shape for this spec version.
 * Used for CI drift detection.
 */
export const EXPECTED_TOOL_SHAPE = {
  name: 'string (1-128 chars, a-z, 0-9, _, -, .)',
  description: 'string (static constant)',
  title: 'string?',
  inputSchema: 'JSON Schema object with additionalProperties: false',
  execute: 'function (input, client) => Promise<string>',
  annotations: 'object { readOnlyHint?: boolean, untrustedContentHint?: boolean }',
} as const;

/**
 * Expected declarative form attributes for this spec version.
 */
export const EXPECTED_DECLARATIVE_ATTRS = {
  form: ['toolname', 'tooldescription', 'toolautosubmit'],
  fields: ['toolparamtitle', 'toolparamdescription'],
} as const;

/**
 * API surface available in this spec version.
 */
export const WEB_MCP_API_SURFACE = {
  registerTool: 'function',
  getTools: 'function',
  executeTool: 'function',
  ontoolchange: 'event',
} as const;