// ============================================================================
// Schema Compiler: Zod → JSON Schema
// ============================================================================
//
// Compiles a tool's Zod input schema into the JSON Schema that WebMCP publishes
// to the agent. Zod is the single source of truth (ADR-005): the schema that
// validates input at runtime is the schema the agent sees, so the two cannot
// drift.
//
// Every object level is forced to `additionalProperties: false`. Without it an
// agent can pass unexpected keys that reach the command bus, which is the
// tool-poisoning surface described in `07-security-review.md` §3.

import type { ToolDefinition } from '@vistect/domain/toolSchemas';
import type { ZodSchema } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';


/** JSON Schema object, as published to the agent. */
export type JsonSchemaObject = Record<string, unknown>;

export interface CompiledToolSchema {
  name: string;
  description: string;
  title?: string | undefined;
  inputSchema: JsonSchemaObject;
  annotations: {
    readOnlyHint: boolean;
    untrustedContentHint: boolean;
  };
}

export interface SchemaCompiler {
  compile(tool: ToolDefinition): CompiledToolSchema;
  compileAll(tools: ToolDefinition[]): CompiledToolSchema[];
}

/** Tool-name grammar from the WebMCP contract (ADR-008). */
const TOOL_NAME_PATTERN = /^[a-z][a-z0-9_.-]*$/;
const MAX_TOOL_NAME_LENGTH = 128;

/**
 * Names that would let an agent take a sweeping action in one call.
 *
 * The product's premise is per-decision human approval (§18.12); a bulk tool
 * would route around it, so these are rejected structurally rather than left to
 * review.
 */
const FORBIDDEN_NAME_PATTERNS: readonly RegExp[] = [
  /^approve_all$/,
  /^publish_everything$/,
  /^generate_and_export_without_review$/,
  /^auto_/,
  /_all$/,
  /^bulk_/,
  /_everything$/,
];

export function createSchemaCompiler(): SchemaCompiler {
  return { compile, compileAll };
}

function compile(tool: ToolDefinition): CompiledToolSchema {
  // `$refStrategy: 'none'` inlines every definition. An agent receiving `$ref`
  // pointers into a `definitions` block it was not given cannot validate input.
  // `zod-to-json-schema` types its parameter as `ZodSchema`, which is `ZodType`
  // with `any` type arguments; the narrowing cast keeps the `any` contained here.
  const jsonSchema = zodToJsonSchema(tool.inputSchema as ZodSchema, {
    target: 'openApi3',
    $refStrategy: 'none',
  }) as JsonSchemaObject;

  return {
    name: tool.name,
    description: tool.description,
    // Spread-conditional rather than `title: tool.title`: under
    // `exactOptionalPropertyTypes` an explicit `undefined` is not the same as an
    // absent key, and a `"title": undefined` entry would serialise as `null`.
    ...(tool.title === undefined ? {} : { title: tool.title }),
    inputSchema: enforceStrictSchema(jsonSchema),
    annotations: tool.annotations,
  };
}

function compileAll(tools: ToolDefinition[]): CompiledToolSchema[] {
  return tools.map(compile);
}

/**
 * Recursively sets `additionalProperties: false` on every object schema.
 *
 * `zod-to-json-schema` emits it for `z.object()` but not for schemas reached
 * through `allOf`/`anyOf`/`oneOf` composition or tuple `items` arrays, so those
 * branches are walked explicitly.
 */
function enforceStrictSchema(schema: JsonSchemaObject): JsonSchemaObject {
  const result: JsonSchemaObject = { ...schema };

  if (result['type'] === 'object') {
    result['additionalProperties'] = false;
  }

  const properties = result['properties'];
  if (isRecord(properties)) {
    const strictProperties: JsonSchemaObject = {};
    for (const [key, value] of Object.entries(properties)) {
      strictProperties[key] = isRecord(value) ? enforceStrictSchema(value) : value;
    }
    result['properties'] = strictProperties;
  }

  const items = result['items'];
  if (Array.isArray(items)) {
    // Tuple form: each position has its own schema.
    result['items'] = items.map((item: unknown) => (isRecord(item) ? enforceStrictSchema(item) : item));
  } else if (isRecord(items)) {
    result['items'] = enforceStrictSchema(items);
  }

  for (const key of ['allOf', 'anyOf', 'oneOf'] as const) {
    const branch = result[key];
    if (Array.isArray(branch)) {
      result[key] = branch.map((entry: unknown) => (isRecord(entry) ? enforceStrictSchema(entry) : entry));
    }
  }

  const not = result['not'];
  if (isRecord(not)) {
    result['not'] = enforceStrictSchema(not);
  }

  return result;
}

function isRecord(value: unknown): value is JsonSchemaObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

// ============================================================================
// Validation
// ============================================================================

export interface SchemaValidation {
  valid: boolean;
  errors: string[];
}

/**
 * Validates a compiled schema against the WebMCP contract.
 *
 * Run at registration time so a malformed tool fails loudly during development
 * rather than being silently ignored by the agent at runtime.
 */
export function validateCompiledSchema(schema: CompiledToolSchema): SchemaValidation {
  const errors: string[] = [];

  if (!TOOL_NAME_PATTERN.test(schema.name)) {
    errors.push(`Tool name "${schema.name}" must match ${TOOL_NAME_PATTERN.source}`);
  }
  if (schema.name.length > MAX_TOOL_NAME_LENGTH) {
    errors.push(`Tool name "${schema.name}" exceeds ${MAX_TOOL_NAME_LENGTH} characters`);
  }

  if (schema.description.trim() === '') {
    errors.push('Tool description is required');
  }

  const inputSchema = schema.inputSchema;
  if (!isRecord(inputSchema)) {
    errors.push('inputSchema must be an object');
  } else {
    if (inputSchema['type'] !== 'object') {
      errors.push('inputSchema must have type "object"');
    }
    if (inputSchema['additionalProperties'] !== false) {
      errors.push('inputSchema must set additionalProperties: false');
    }

    const required = inputSchema['required'];
    if (required !== undefined && !Array.isArray(required)) {
      errors.push('inputSchema.required must be an array');
    }

    const properties = inputSchema['properties'];
    if (isRecord(properties)) {
      for (const [name, property] of Object.entries(properties)) {
        if (
          isRecord(property) &&
          property['type'] === 'object' &&
          property['additionalProperties'] !== false
        ) {
          errors.push(`Property "${name}" must set additionalProperties: false`);
        }
      }
    }
  }

  // `annotations` drives whether the agent treats a tool as read-only and whether
  // its output is marked untrusted, so a missing hint is a security defect, not a
  // cosmetic omission.
  if (typeof schema.annotations !== 'object' || schema.annotations === null) {
    errors.push('annotations object is required');
  } else {
    if (typeof schema.annotations.readOnlyHint !== 'boolean') {
      errors.push('annotations.readOnlyHint must be a boolean');
    }
    if (typeof schema.annotations.untrustedContentHint !== 'boolean') {
      errors.push('annotations.untrustedContentHint must be a boolean');
    }
  }

  return { valid: errors.length === 0, errors };
}

/** Forbidden-pattern violations for a tool name. Empty when acceptable. */
export function checkForbiddenPatterns(name: string): string[] {
  return FORBIDDEN_NAME_PATTERNS.filter((pattern) => pattern.test(name)).map(
    (pattern) => `Tool name "${name}" matches forbidden pattern ${pattern.source}`
  );
}
