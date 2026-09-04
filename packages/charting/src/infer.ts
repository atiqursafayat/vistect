// ============================================================================
// Schema Inference
// ============================================================================
//
// Re-infers column types for a dataset whose cells may have been edited after
// import, and reports every type change so the user can re-confirm the schema
// before charts are rebuilt from it (spec §13.1).
//
// Inference order (boolean → number → date) matches `import.ts`; keeping the two
// consistent is what makes "import then re-infer" idempotent.

import type { DataColumn, Dataset } from '@vistect/domain/schema';

export interface InferredSchema {
  columns: DataColumn[];
  warnings: string[];
}

type CellValue = DataColumn['values'][number];

const TRUTHY = new Set(['true', 'yes', '1']);
const FALSY = new Set(['false', 'no', '0']);
const DATE_PATTERN = /^\d{4}-\d{2}(-\d{2}([T ]\d{2}:\d{2}(:\d{2})?)?)?$/;
const NUMBER_PATTERN = /^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?$/;

/** A cell carrying no value. Empty string is the dataset's "blank" representation. */
function isBlank(value: CellValue): boolean {
  return value === '' || value === null || value === undefined;
}

export function inferSchema(dataset: Dataset): InferredSchema {
  const warnings: string[] = [];

  const columns = dataset.columns.map((col) => {
    // A column the user typed or confirmed is authoritative; only re-infer
    // columns that were inferred in the first place.
    if (!col.inferred) return col;

    const { type, values } = inferColumnType(col.values);
    if (type !== col.type) {
      warnings.push(`Column "${col.name}": type changed from ${col.type} to ${type}`);
    }

    return { ...col, type, values, inferred: true };
  });

  return { columns, warnings };
}

function inferColumnType(rawValues: CellValue[]): {
  type: DataColumn['type'];
  values: DataColumn['values'];
} {
  const populated = rawValues.filter((v) => !isBlank(v));
  if (populated.length === 0) return { type: 'string', values: rawValues };

  const allBoolean = populated.every((v) => {
    if (typeof v === 'boolean') return true;
    if (typeof v !== 'string') return false;
    const lower = v.toLowerCase();
    return TRUTHY.has(lower) || FALSY.has(lower);
  });
  if (allBoolean) {
    return {
      type: 'boolean',
      values: rawValues.map((v) => {
        if (isBlank(v)) return '';
        if (typeof v === 'boolean') return v;
        return TRUTHY.has(String(v).toLowerCase());
      }),
    };
  }

  // Numbers precede dates: a bare year like "2024" is a number, and letting
  // `Date.parse` claim it would silently convert a measure into a timestamp.
  const allNumber = populated.every(
    (v) => typeof v === 'number' || (typeof v === 'string' && NUMBER_PATTERN.test(v))
  );
  if (allNumber) {
    return {
      type: 'number',
      values: rawValues.map((v) => (isBlank(v) ? '' : typeof v === 'number' ? v : Number(v))),
    };
  }

  const allDate = populated.every(
    (v) =>
      v instanceof Date ||
      (typeof v === 'string' && DATE_PATTERN.test(v) && !Number.isNaN(Date.parse(v)))
  );
  if (allDate) {
    return {
      type: 'date',
      values: rawValues.map((v) => {
        if (isBlank(v)) return '';
        return v instanceof Date ? v : new Date(String(v));
      }),
    };
  }

  return { type: 'string', values: rawValues };
}

export interface SchemaPreviewColumn {
  name: string;
  type: DataColumn['type'];
  sampleValues: CellValue[];
  /** Number of populated cells; surfaces sparse columns before charting. */
  populatedCount: number;
}

/** Schema summary for the import confirmation step (AC F-4.x §1). */
export function previewSchema(
  dataset: Dataset,
  sampleSize = 5
): { columns: SchemaPreviewColumn[] } {
  return {
    columns: dataset.columns.map((col) => ({
      name: col.name,
      type: col.type,
      sampleValues: col.values.slice(0, sampleSize),
      populatedCount: col.values.filter((v) => !isBlank(v)).length,
    })),
  };
}
