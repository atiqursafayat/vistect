// ============================================================================
// Schema Compiler: Zod → JSON Schema
// ============================================================================

import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';
import type { ToolDefinition } from '@vistect/domain/toolSchemas';

export interface CompiledToolSchema {
  name: string;
  description: string;
  title?: string;
  inputSchema: Record<string, unknown>;
  annotations: {
    readOnlyHint: boolean;
    untrustedContentHint: boolean;
  };
}

export interface SchemaCompiler {
  compile(tool: ToolDefinition): CompiledToolSchema;
  compileAll(tools: ToolDefinition[]): CompiledToolSchema[];
}

export function createSchemaCompiler(): SchemaCompiler {
  return {
    compile,
    compileAll,
  };
}

function compile(tool: ToolDefinition): CompiledToolSchema {
  // Convert Zod schema to JSON Schema with strict options
  const jsonSchema = zodToJsonSchema(tool.inputSchema as any, {
    target: 'openApi3',
    strict: true,
    definitions: {},
    $refStrategy: 'none',
  });

  // Force additionalProperties: false at all levels
  const strictSchema = enforceStrictSchema(jsonSchema);

  return {
    name: tool.name,
    description: tool.description,
    title: tool.title,
    inputSchema: strictSchema,
    annotations: tool.annotations,
  };
}

function compileAll(tools: ToolDefinition[]): CompiledToolSchema[] {
  return tools.map(compile);
}

function enforceStrictSchema(schema: Record<string, unknown>): Record<string, unknown> {
  const result = { ...schema };

  // Ensure top-level additionalProperties: false
  if (result.type === 'object' && result.properties) {
    result.additionalProperties = false;
  }

  // Recursively process nested objects
  if (result.properties && typeof result.properties === 'object') {
    const newProps: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(result.properties)) {
      if (value && typeof value === 'object' && 'type' in value) {
        newProps[key] = enforceStrictSchema(value as Record<string, unknown>);
      } else {
        newProps[key] = value;
      }
    }
    result.properties = newProps;
  }

  // Process items (arrays)
  if (result.items && typeof result.items === 'object') {
    result.items = enforceStrictSchema(result.items as Record<string, unknown>);
  }

  // Process allOf, anyOf, oneOf
  for (const key of ['allOf', 'anyOf', 'oneOf'] as const) {
    if (Array.isArray(result[key])) {
      result[key] = (result[key] as Record<string, unknown>[]).map(enforceStrictSchema);
    }
  }

  return result;
}

// ============================================================================
// Validation Helpers
// ============================================================================

export function validateCompiledSchema(schema: CompiledToolSchema): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Check name format
  if (!/^[a-z][a-z0-9_.-]*$/.test(schema.name)) {
    errors.push(`Tool name "${schema.name}" must match ^[a-z][a-z0-9_.-]*$`);
  }

  if (schema.name.length > 128) {
    errors.push(`Tool name "${schema.name}" exceeds 128 characters`);
  }

  // Check description is present
  if (!schema.description || schema.description.trim() === '') {
    errors.push('Tool description is required');
  }

  // Check inputSchema structure
  if (!schema.inputSchema || typeof schema.inputSchema !== 'object') {
    errors.push('inputSchema is required');
  } else {
    const inputSchema = schema.inputSchema as Record<string, unknown>;

    if (inputSchema.type !== 'object') {
      errors.push('inputSchema must be an object type');
    }

    if (inputSchema.additionalProperties !== false) {
      errors.push('inputSchema must have additionalProperties: false');
    }

    if (inputSchema.required && !Array.isArray(inputSchema.required)) {
      errors.push('inputSchema.required must be an array');
    }

    if (inputSchema.properties && typeof inputSchema.properties === 'object') {
      for (const [propName, propSchema] of Object.entries(inputSchema.properties)) {
        if (propSchema && typeof propSchema === 'object') {
          const ps = propSchema as Record<string, unknown>;
          if (ps.additionalProperties !== false && ps.type === 'object') {
            errors.push(`Property "${propName}" must have additionalProperties: false`);
          }
        }
      }
    }
  }

  // Check annotations
  if (!schema.annotations || typeof schema.annotations !== 'object') {
    errors.push('annotations object is required');
  } else {
    if (typeof schema.annotations.readOnlyHint !== 'boolean') {
      errors.push('annotations.readOnlyHint must be boolean');
    }
    if (typeof schema.annotations.untrustedContentHint !== 'boolean') {
      errors.push('annotations.untrustedContentHint must be boolean');
    }
  }

  return { valid: errors.length === 0, errors };
}

export function checkForbiddenPatterns(name: string): string[] {
  const forbidden = [
    /^approve_all$/,
    /^publish_everything$/,
    /^generate_and_export_without_review$/,
    /^auto_/,
    /_all$/,
    /^bulk_/,
    /_everything$/,
  ];

  const violations: string[] = [];
  for (const pattern of forbidden) {
    if (pattern.test(name)) {
      violations.push(`Tool name "${name}" matches forbidden pattern: ${pattern}`);
    }
  }
  return violations;
}