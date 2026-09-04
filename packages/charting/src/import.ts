// ============================================================================
// Dataset Import - CSV, Manual Entry, Pasted Table
// ============================================================================

import type { Dataset, DataColumn } from '../index';

export interface ImportResult {
  dataset: Dataset;
  warnings: string[];
  errors: string[];
}

export function importCSV(csvText: string, name: string, sourceReference?: string): ImportResult {
  const warnings: string[] = [];
  const errors: string[] = [];

  // Parse CSV
  const lines = csvText.trim().split('\n');
  if (lines.length < 2) {
    return { dataset: createEmptyDataset(name), warnings, errors: ['CSV must have at least header and one data row'] };
  }

  // Parse header
  const headers = parseCSVLine(lines[0]);
  if (headers.length === 0) {
    return { dataset: createEmptyDataset(name), warnings, errors: ['No columns found in CSV'] };
  }

  // Parse data rows
  const rows: string[][] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = parseCSVLine(lines[i]);
    if (cols.length === headers.length) {
      rows.push(cols);
    } else if (cols.length > 0) {
      warnings.push(`Row ${i + 1}: column count mismatch (expected ${headers.length}, got ${cols.length})`);
    }
  }

  if (rows.length === 0) {
    warnings.push('No valid data rows found');
  }

  // Infer column types
  const columns: DataColumn[] = headers.map((header, colIndex) => {
    const values = rows.map(row => row[colIndex]);
    const { type, convertedValues } = inferColumnType(values);

    return {
      id: `dc_${crypto.randomUUID?.() || Math.random().toString(36).slice(2)}`,
      name: header,
      type,
      values: convertedValues,
      inferred: true,
    };
  });

  const dataset: Dataset = {
    id: `ds_${crypto.randomUUID?.() || Math.random().toString(36).slice(2)}`,
    name,
    columns,
    rowCount: rows.length,
    source: 'csv_upload',
    sourceReference,
    inferredSchema: true,
    userConfirmed: false,
    createdAt: new Date().toISOString(),
    createdBy: 'user',
  };

  return { dataset, warnings, errors };
}

export function importManualEntry(columns: DataColumn[], name: string): ImportResult {
  // Validate all columns have same row count
  const rowCounts = columns.map(c => c.values.length);
  const uniqueCounts = new Set(rowCounts);
  if (uniqueCounts.size > 1) {
    return { dataset: createEmptyDataset(name), warnings: [], errors: ['All columns must have the same number of rows'] };
  }

  const dataset: Dataset = {
    id: `ds_${crypto.randomUUID?.() || Math.random().toString(36).slice(2)}`,
    name,
    columns,
    rowCount: rowCounts[0] || 0,
    source: 'manual_entry',
    inferredSchema: false,
    userConfirmed: true,
    createdAt: new Date().toISOString(),
    createdBy: 'user',
  };

  return { dataset, warnings: [], errors: [] };
}

export function importPastedTable(text: string, name: string): ImportResult {
  // Try to parse as tab-separated or comma-separated
  const lines = text.trim().split('\n');
  if (lines.length < 2) {
    return { dataset: createEmptyDataset(name), warnings: [], errors: ['Table must have at least header and one data row'] };
  }

  // Detect delimiter
  const firstLine = lines[0];
  const tabCount = (firstLine.match(/\t/g) || []).length;
  const commaCount = (firstLine.match(/,/g) || []).length;

  let delimiter = ',';
  if (tabCount > commaCount) delimiter = '\t';

  // Re-parse with detected delimiter
  const parseLine = (line: string) => line.split(delimiter).map(c => c.trim());

  const headers = parseLine(lines[0]);
  const rows = lines.slice(1).map(parseLine).filter(r => r.length === headers.length);

  const columns: DataColumn[] = headers.map((header, colIndex) => {
    const values = rows.map(row => row[colIndex]);
    const { type, convertedValues } = inferColumnType(values);

    return {
      id: `dc_${crypto.randomUUID?.() || Math.random().toString(36).slice(2)}`,
      name: header,
      type,
      values: convertedValues,
      inferred: true,
    };
  });

  const dataset: Dataset = {
    id: `ds_${crypto.randomUUID?.() || Math.random().toString(36).slice(2)}`,
    name,
    columns,
    rowCount: rows.length,
    source: 'pasted_table',
    inferredSchema: true,
    userConfirmed: false,
    createdAt: new Date().toISOString(),
    createdBy: 'user',
  };

  return { dataset, warnings: [], errors: [] };
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
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

function inferColumnType(values: string[]): { type: DataColumn['type']; convertedValues: DataColumn['values'] } {
  if (values.length === 0) return { type: 'string', convertedValues: [] };

  let isNumber = true;
  let isDate = true;
  let isBoolean = true;

  for (const val of values) {
    if (val === '') continue;

    // Check number
    if (isNumber && isNaN(Number(val))) isNumber = false;

    // Check date
    if (isDate && isNaN(Date.parse(val))) isDate = false;

    // Check boolean
    if (isBoolean && !['true', 'false', 'yes', 'no', '1', '0'].includes(val.toLowerCase())) isBoolean = false;
  }

  if (isBoolean) {
    const converted = values.map(v => {
      if (v === '') return null;
      return ['true', 'yes', '1'].includes(v.toLowerCase());
    });
    return { type: 'boolean', convertedValues: converted };
  }

  if (isDate) {
    const converted = values.map(v => {
      if (v === '') return null;
      return new Date(v);
    });
    return { type: 'date', convertedValues: converted };
  }

  if (isNumber) {
    const converted = values.map(v => {
      if (v === '') return null;
      return Number(v);
    });
    return { type: 'number', convertedValues: converted };
  }

  return { type: 'string', convertedValues: values };
}

function createEmptyDataset(name: string): Dataset {
  return {
    id: `ds_${crypto.randomUUID?.() || Math.random().toString(36).slice(2)}`,
    name,
    columns: [],
    rowCount: 0,
    source: 'csv_upload',
    inferredSchema: false,
    userConfirmed: false,
    createdAt: new Date().toISOString(),
    createdBy: 'user',
  };
}