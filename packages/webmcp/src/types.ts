// ============================================================================
// WebMCP Types
// ============================================================================
//
// Minimal ambient declarations for `navigator.modelContext` (ADR-008 §2.1).
//
// WebMCP is a W3C draft available behind a Chrome origin trial, so no
// `@types/…` package exists. Declaring the surface here means the rest of the
// package is fully typed and every `as any` on the browser API is confined to
// this file — where a spec change is a compile error rather than a silent
// runtime mismatch.
//
// Note the namespace: **`navigator`**, not `document`. The source spec's
// `document.modelContext` is wrong, and the mistake is silent: the capability
// probe would read a permanently undefined value, degradation would engage on
// every load, and no tool would ever register.

/** A tool as registered with the browser. */
export interface ModelContextTool {
  name: string;
  description: string;
  title?: string;
  /** JSON Schema with `additionalProperties: false`. */
  inputSchema: Record<string, unknown>;
  annotations: {
    readOnlyHint: boolean;
    untrustedContentHint: boolean;
  };
  execute(input: unknown, client: ModelContextClient): Promise<string>;
}

/** Client object the browser passes into `execute`. */
export interface ModelContextClient {
  requestUserInteraction?<T>(callback: () => Promise<T>): Promise<T>;
}

export interface RegisterToolOptions {
  /** Unregisters the tool when aborted; the only removal mechanism the API offers. */
  signal?: AbortSignal;
}

export interface ModelContext {
  registerTool(tool: ModelContextTool, options?: RegisterToolOptions): void;
  getTools?(): ModelContextTool[];
  executeTool?(toolName: string, inputJson: string): Promise<string>;
  addEventListener?(type: string, listener: () => void): void;
  removeEventListener?(type: string, listener: () => void): void;
  version?: string;
}

/**
 * Reads `navigator.modelContext`, or `undefined` when unavailable.
 *
 * The single access point for the browser API. Returns `undefined` outside a
 * browser too, so this package remains importable in Node for tests.
 */
export function getModelContext(): ModelContext | undefined {
  if (typeof navigator === 'undefined') return undefined;
  return (navigator as Navigator & { modelContext?: ModelContext }).modelContext;
}
