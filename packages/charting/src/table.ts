// ============================================================================
// Chart Data Table Generation
// ============================================================================
//
// The accessible data table is the primary representation of a chart for screen
// reader users (AC F-4.x §2: table precedes chart in DOM order). It is generated
// from the same `Dataset` the renderer draws from, so the table and the picture
// cannot disagree.

import type { DataColumn, Dataset, ChartSpec } from '@vistect/domain/schema';
import { escapeHtml } from '@vistect/domain/text';

/** A scalar as stored in a dataset column. */
export type CellValue = DataColumn['values'][number];

export interface TableColumn {
  name: string;
  type: DataColumn['type'];
  values: DataColumn['values'];
}

export interface AccessibleTable {
  caption: string;
  headers: TableColumn[];
  rows: Record<string, CellValue | undefined>[];
  summary: string;
}

export function generateChartTable(dataset: Dataset, spec: ChartSpec): AccessibleTable {
  const categoryCol = dataset.columns.find((c) => c.type === 'string' || c.type === 'date');

  const headers: TableColumn[] = [];

  if (categoryCol) {
    headers.push({
      name: spec.xAxis.title || categoryCol.name,
      type: categoryCol.type,
      values: categoryCol.values,
    });
  }

  for (const series of spec.series) {
    const col = dataset.columns.find((c) => c.id === series.dataColumnId);
    if (col) {
      headers.push({
        name: series.name,
        type: col.type,
        values: col.values,
      });
    }
  }

  // Rows are built from each header's own `values` array rather than by
  // re-looking-up columns by name: a series may be renamed (`series.name`
  // differs from `col.name`), and duplicate names would otherwise collide.
  const rows: Record<string, CellValue | undefined>[] = [];
  for (let i = 0; i < dataset.rowCount; i++) {
    const row: Record<string, CellValue | undefined> = {};
    for (const header of headers) {
      row[header.name] = header.values[i];
    }
    rows.push(row);
  }

  const summaryParts = [`${spec.title}.`];
  if (categoryCol) {
    summaryParts.push(`Categories: ${[...new Set(categoryCol.values.map(String))].join(', ')}.`);
  }
  summaryParts.push(`Series: ${spec.series.map((s) => s.name).join(', ')}.`);
  summaryParts.push(`${dataset.rowCount} data points.`);

  return {
    caption: `${spec.title} - Data Table`,
    headers,
    rows,
    summary: summaryParts.join(' '),
  };
}

/**
 * Renders the table as semantic HTML.
 *
 * Every interpolated value is escaped: dataset content is untrusted (it may come
 * from an imported CSV or an agent-supplied table).
 */
export function generateTableHTML(table: AccessibleTable): string {
  const parts: string[] = ['<table class="chart-data-table">'];
  parts.push(`<caption>${escapeHtml(table.caption)}</caption>`);

  parts.push('<thead><tr>');
  for (const header of table.headers) {
    parts.push(`<th scope="col">${escapeHtml(header.name)}</th>`);
  }
  parts.push('</tr></thead>');

  parts.push('<tbody>');
  for (const row of table.rows) {
    parts.push('<tr>');
    for (const [index, header] of table.headers.entries()) {
      const formatted = formatValue(row[header.name], header.type);
      // First column acts as the row header so screen readers can announce
      // "<category>, <series>: <value>" when navigating cells.
      parts.push(
        index === 0
          ? `<th scope="row">${escapeHtml(formatted)}</th>`
          : `<td>${escapeHtml(formatted)}</td>`
      );
    }
    parts.push('</tr>');
  }
  parts.push('</tbody></table>');

  return parts.join('');
}

/** Renders the table as GitHub-flavoured Markdown, escaping cell delimiters. */
export function generateTableMarkdown(table: AccessibleTable): string {
  const escapeCell = (value: string) => value.replace(/\|/g, '\\|').replace(/\n/g, ' ');

  const lines = [
    `| ${table.headers.map((h) => escapeCell(h.name)).join(' | ')} |`,
    `| ${table.headers.map(() => '---').join(' | ')} |`,
  ];

  for (const row of table.rows) {
    const cells = table.headers.map((h) => escapeCell(formatValue(row[h.name], h.type)));
    lines.push(`| ${cells.join(' | ')} |`);
  }

  return `${lines.join('\n')}\n`;
}

function formatValue(value: CellValue | undefined, type: DataColumn['type']): string {
  if (value === null || value === undefined) return '';

  switch (type) {
    case 'number':
      return Number(value).toLocaleString('en-US');
    case 'date':
      return value instanceof Date ? (value.toISOString().split('T')[0] ?? '') : String(value);
    case 'boolean':
      return value ? 'Yes' : 'No';
    case 'string':
      return String(value);
  }
}
