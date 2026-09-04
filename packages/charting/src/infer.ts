// ============================================================================
// Schema Inference
// ============================================================================

import type { Dataset, DataColumn } from '../index';

export interface InferredSchema {
  columns: DataColumn[];
  warnings: string[];
}

export function inferSchema(dataset: Dataset): InferredSchema {
  const warnings: string[] = [];
  const columns: DataColumn[] = dataset.columns.map(col => {
    if (!col.inferred) return col;

    // Re-infer with current values
    const { type, convertedValues } = inferColumnType(col.values);
    if (type !== col.type) {
      warnings.push(`Column "${col.name}": type changed from ${col.type} to ${type}`);
    }

    return {
      ...col,
      type,
      values: convertedValues,
      inferred: true,
    };
  });

  return { columns, warnings };
}

function inferColumnType(values: (string | number | boolean | Date | null)[]): { type: DataColumn['type']; convertedValues: DataColumn['values'] } {
  const nonNull = values.filter(v => v !== null && v !== undefined && v !== '');
  if (nonNull.length === 0) return { type: 'string', convertedValues: values };

  // Check if all are booleans
  const allBoolean = nonNull.every(v => typeof v === 'boolean' || (typeof v === 'string' && ['true', 'false', 'yes', 'no', '1', '0'].includes(v.toString().toLowerCase())));
  if (allBoolean) {
    const converted = values.map(v => {
      if (v === null || v === undefined || v === '') return null;
      if (typeof v === 'boolean') return v;
      return ['true', 'yes', '1'].includes(v.toString().toLowerCase());
    });
    return { type: 'boolean', convertedValues: converted };
  }

  // Check if all are dates
  const allDate = nonNull.every(v => v instanceof Date || (typeof v === 'string' && !isNaN(Date.parse(v))));
  if (allDate) {
    const converted = values.map(v => {
      if (v === null || v === undefined || v === '') return null;
      return v instanceof Date ? v : new Date(v);
    });
    return { type: 'date', convertedValues: converted };
  }

  // Check if all are numbers
  const allNumber = nonNull.every(v => typeof v === 'number' || (typeof v === 'string' && !isNaN(Number(v))));
  if (allNumber) {
    const converted = values.map(v => {
      if (v === null || v === undefined || v === '') return null;
      return typeof v === 'number' ? v : Number(v);
    });
    return { type: 'number', convertedValues: converted };
  }

  return { type: 'string', convertedValues: values };
}

export function previewSchema(dataset: Dataset): { columns: Array<{ name: string; type: string; sampleValues: any[] }> } {
  return {
    columns: dataset.columns.map(col => ({
      name: col.name,
      type: col.type,
      sampleValues: col.values.slice(0, 5),
    })),
  };
}