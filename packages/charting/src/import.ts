// ============================================================================
// Dataset Import - CSV, Manual Entry, Pasted Table
// ============================================================================
//
// Import is deliberately strict and lossless: a chart is only trustworthy if the
// numbers behind it are exactly what the user supplied. Anything ambiguous is
// reported as a warning rather than silently coerced, and the resulting dataset
// is marked `userConfirmed: false` until the user verifies the inferred schema
// (spec §13.1, AC F-4.x §1).
//
// Row and cell caps bound memory and parse time for adversarial input
// (`07-security-review.md` §3).

import { createDataColumnId, createDatasetId } from '@vistect/domain/schema';
import type { ActorId, DataColumn, Dataset } from '@vistect/domain/schema';

export interface ImportResult {
  dataset: Dataset;
  warnings: string[];
  errors: string[];
}

/** Input caps. Exceeding one produces an error, never a truncated dataset. */
export const IMPORT_LIMITS = {
  maxRows: 10_000,
  maxColumns: 100,
  maxCellLength: 1_000,
  maxTextBytes: 5 * 1024 * 1024,
} as const;

/** Strings accepted as booleans during type inference, lowercased. */
const TRUTHY = new Set(['true', 'yes', '1']);
const FALSY = new Set(['false', 'no', '0']);

/**
 * ISO-8601-like date shapes.
 *
 * `Date.parse` is far too permissive — it accepts `"7"` and `"Q3"` as dates — so
 * a column of short numeric codes was being converted to timestamps. Inference
 * requires an explicit date shape instead.
 */
const DATE_PATTERN = /^\d{4}-\d{2}(-\d{2}([T ]\d{2}:\d{2}(:\d{2})?)?)?$/;

/** Numeric literals only: optional sign, digits, optional decimal and exponent. */
const NUMBER_PATTERN = /^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?$/;

export function importCSV(
  csvText: string,
  name: string,
  actorId: ActorId,
  sourceReference?: string
): ImportResult {
  const parsed = parseDelimitedText(csvText, parseCSVLine);
  if (parsed.errors.length > 0) {
    return { dataset: createEmptyDataset(name, actorId, 'csv_upload'), warnings: parsed.warnings, errors: parsed.errors };
  }

  return {
    dataset: {
      id: createDatasetId(),
      name,
      columns: buildColumns(parsed.headers, parsed.rows),
      rowCount: parsed.rows.length,
      source: 'csv_upload',
      ...(sourceReference === undefined ? {} : { sourceReference }),
      inferredSchema: true,
      userConfirmed: false,
      createdAt: new Date().toISOString(),
      createdBy: actorId,
    },
    warnings: parsed.warnings,
    errors: [],
  };
}

export function importPastedTable(text: string, name: string, actorId: ActorId): ImportResult {
  // Tabs win ties: spreadsheet clipboard content is tab-separated, and its cells
  // frequently contain commas (e.g. "1,234").
  const firstLine = text.trimStart().split('\n')[0] ?? '';
  const tabCount = (firstLine.match(/\t/g) ?? []).length;
  const commaCount = (firstLine.match(/,/g) ?? []).length;
  const delimiter = tabCount >= commaCount && tabCount > 0 ? '\t' : ',';

  const parsed = parseDelimitedText(text, (line) =>
    delimiter === '\t' ? line.split('\t').map((c) => c.trim()) : parseCSVLine(line)
  );
  if (parsed.errors.length > 0) {
    return {
      dataset: createEmptyDataset(name, actorId, 'pasted_table'),
      warnings: parsed.warnings,
      errors: parsed.errors,
    };
  }

  return {
    dataset: {
      id: createDatasetId(),
      name,
      columns: buildColumns(parsed.headers, parsed.rows),
      rowCount: parsed.rows.length,
      source: 'pasted_table',
      inferredSchema: true,
      userConfirmed: false,
      createdAt: new Date().toISOString(),
      createdBy: actorId,
    },
    warnings: parsed.warnings,
    errors: [],
  };
}

export function importManualEntry(
  columns: DataColumn[],
  name: string,
  actorId: ActorId
): ImportResult {
  if (columns.length === 0) {
    return {
      dataset: createEmptyDataset(name, actorId, 'manual_entry'),
      warnings: [],
      errors: ['At least one column is required'],
    };
  }

  const rowCounts = new Set(columns.map((c) => c.values.length));
  if (rowCounts.size > 1) {
    return {
      dataset: createEmptyDataset(name, actorId, 'manual_entry'),
      warnings: [],
      errors: [`All columns must have the same number of rows (found ${[...rowCounts].join(', ')})`],
    };
  }

  return {
    dataset: {
      id: createDatasetId(),
      name,
      columns,
      rowCount: columns[0]?.values.length ?? 0,
      source: 'manual_entry',
      // Manually entered data was typed by the user, so its schema is known.
      inferredSchema: false,
      userConfirmed: true,
      createdAt: new Date().toISOString(),
      createdBy: actorId,
    },
    warnings: [],
    errors: [],
  };
}

// ============================================================================
// Parsing
// ============================================================================

interface ParsedTable {
  headers: string[];
  rows: string[][];
  warnings: string[];
  errors: string[];
}

function parseDelimitedText(text: string, parseLine: (line: string) => string[]): ParsedTable {
  const warnings: string[] = [];

  if (text.length > IMPORT_LIMITS.maxTextBytes) {
    return {
      headers: [],
      rows: [],
      warnings,
      errors: [`Input exceeds ${IMPORT_LIMITS.maxTextBytes / (1024 * 1024)} MB limit`],
    };
  }

  // Normalise line endings so CRLF files do not leave \r on the last cell.
  const lines = text.replace(/\r\n?/g, '\n').trim().split('\n');
  if (lines.length < 2) {
    return {
      headers: [],
      rows: [],
      warnings,
      errors: ['Input must have a header row and at least one data row'],
    };
  }

  const headers = parseLine(lines[0] ?? '');
  if (headers.length === 0 || headers.every((h) => h === '')) {
    return { headers: [], rows: [], warnings, errors: ['No column headers found'] };
  }
  if (headers.length > IMPORT_LIMITS.maxColumns) {
    return {
      headers: [],
      rows: [],
      warnings,
      errors: [`Too many columns: ${headers.length} exceeds limit of ${IMPORT_LIMITS.maxColumns}`],
    };
  }

  const duplicates = headers.filter((h, i) => headers.indexOf(h) !== i);
  if (duplicates.length > 0) {
    warnings.push(`Duplicate column names: ${[...new Set(duplicates)].join(', ')}`);
  }

  const dataLines = lines.slice(1);
  if (dataLines.length > IMPORT_LIMITS.maxRows) {
    return {
      headers: [],
      rows: [],
      warnings,
      errors: [`Too many rows: ${dataLines.length} exceeds limit of ${IMPORT_LIMITS.maxRows}`],
    };
  }

  const rows: string[][] = [];
  for (const [index, line] of dataLines.entries()) {
    if (line.trim() === '') continue;

    const cells = parseLine(line);
    if (cells.length !== headers.length) {
      warnings.push(
        `Row ${index + 2}: column count mismatch (expected ${headers.length}, got ${cells.length}) — row skipped`
      );
      continue;
    }

    const overlong = cells.findIndex((c) => c.length > IMPORT_LIMITS.maxCellLength);
    if (overlong !== -1) {
      warnings.push(
        `Row ${index + 2}: cell in column ${overlong + 1} exceeds ${IMPORT_LIMITS.maxCellLength} characters — row skipped`
      );
      continue;
    }

    rows.push(cells);
  }

  if (rows.length === 0) {
    return { headers, rows, warnings, errors: ['No valid data rows found'] };
  }

  return { headers, rows, warnings, errors: [] };
}

/** RFC 4180 CSV line parsing: quoted fields, escaped quotes, embedded commas. */
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === undefined) continue;

    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

function buildColumns(headers: string[], rows: string[][]): DataColumn[] {
  return headers.map((header, colIndex) => {
    const rawValues = rows.map((row) => row[colIndex] ?? '');
    const { type, values } = inferColumnType(rawValues);
    return {
      id: createDataColumnId(),
      name: header === '' ? `Column ${colIndex + 1}` : header,
      type,
      values,
      inferred: true,
    };
  });
}

/**
 * Infers a column type from its raw cells.
 *
 * Order matters: boolean is checked before number so a `0`/`1` flag column is
 * not read as a measure, and date requires an explicit date shape so numeric
 * codes are not misread as timestamps.
 *
 * Empty cells become `''` rather than `null`, because `DataColumn['values']`
 * does not admit null and a null would silently break chart arithmetic.
 */
function inferColumnType(rawValues: string[]): {
  type: DataColumn['type'];
  values: DataColumn['values'];
} {
  const nonEmpty = rawValues.filter((v) => v !== '');
  if (nonEmpty.length === 0) return { type: 'string', values: rawValues };

  const allBoolean = nonEmpty.every((v) => {
    const lower = v.toLowerCase();
    return TRUTHY.has(lower) || FALSY.has(lower);
  });
  if (allBoolean) {
    return {
      type: 'boolean',
      values: rawValues.map((v) => (v === '' ? '' : TRUTHY.has(v.toLowerCase()))),
    };
  }

  if (nonEmpty.every((v) => NUMBER_PATTERN.test(v))) {
    return { type: 'number', values: rawValues.map((v) => (v === '' ? '' : Number(v))) };
  }

  if (nonEmpty.every((v) => DATE_PATTERN.test(v) && !Number.isNaN(Date.parse(v)))) {
    return { type: 'date', values: rawValues.map((v) => (v === '' ? '' : new Date(v))) };
  }

  return { type: 'string', values: rawValues };
}

function createEmptyDataset(
  name: string,
  actorId: ActorId,
  source: Dataset['source']
): Dataset {
  return {
    id: createDatasetId(),
    name,
    columns: [],
    rowCount: 0,
    source,
    inferredSchema: false,
    userConfirmed: false,
    createdAt: new Date().toISOString(),
    createdBy: actorId,
  };
}
