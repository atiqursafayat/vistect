// ============================================================================
// Chart Data Table Generation
// ============================================================================

import type { Dataset, DataColumn, ChartSpec } from '../index';

export interface TableColumn {
  name: string;
  type: DataColumn['type'];
  values: DataColumn['values'];
}

export interface AccessibleTable {
  caption: string;
  headers: TableColumn[];
  rows: Array<Record<string, any>>;
  summary: string;
}

export function generateChartTable(dataset: Dataset, spec: ChartSpec): AccessibleTable {
  const categoryCol = dataset.columns.find(c => c.type === 'string' || c.type === 'date');
  const numericCols = dataset.columns.filter(c => c.type === 'number');

  // Build headers
  const headers: TableColumn[] = [];

  if (categoryCol) {
    headers.push({
      name: spec.xAxis.title || categoryCol.name,
      type: categoryCol.type,
      values: categoryCol.values,
    });
  }

  for (const series of spec.series) {
    const col = dataset.columns.find(c => c.id === series.dataColumnId);
    if (col) {
      headers.push({
        name: series.name,
        type: col.type,
        values: col.values,
      });
    }
  }

  // Build rows
  const rowCount = dataset.rowCount;
  const rows: Array<Record<string, any>> = [];

  for (let i = 0; i < rowCount; i++) {
    const row: Record<string, any> = {};
    for (const header of headers) {
      const col = dataset.columns.find(c => c.name === header.name);
      if (col) {
        row[header.name] = col.values[i];
      }
    }
    rows.push(row);
  }

  // Generate summary
  let summary = `${spec.title}. `;
  if (categoryCol) {
    summary += `Categories: ${[...new Set(categoryCol.values)].join(', ')}. `;
  }
  summary += `Series: ${spec.series.map(s => s.name).join(', ')}. `;
  summary += `${rowCount} data points.`;

  return {
    caption: `${spec.title} - Data Table`,
    headers,
    rows,
    summary,
  };
}

export function generateTableHTML(table: AccessibleTable): string {
  let html = `<table class="chart-data-table" role="table">`;
  html += `<caption>${escapeHtml(table.caption)}</caption>`;
  html += `<thead><tr>`;
  for (const header of table.headers) {
    html += `<th scope="col">${escapeHtml(header.name)}</th>`;
  }
  html += `</tr></thead>`;
  html += `<tbody>`;
  for (const row of table.rows) {
    html += `<tr>`;
    for (const header of table.headers) {
      const value = row[header.name];
      const formatted = formatValue(value, header.type);
      html += `<td>${escapeHtml(formatted)}</td>`;
    }
    html += `</tr>`;
  }
  html += `</tbody></table>`;
  return html;
}

export function generateTableMarkdown(table: AccessibleTable): string {
  let md = `| ${table.headers.map(h => h.name).join(' | ')} |\n`;
  md += `| ${table.headers.map(() => '---').join(' | ')} |\n`;
  for (const row of table.rows) {
    md += `| ${table.headers.map(h => String(row[h.name] ?? '')).join(' | ')} |\n`;
  }
  return md;
}

function formatValue(value: any, type: DataColumn['type']): string {
  if (value === null || value === undefined) return '';
  if (type === 'number') return Number(value).toLocaleString();
  if (type === 'date') return value instanceof Date ? value.toISOString().split('T')[0] : String(value);
  if (type === 'boolean') return value ? 'Yes' : 'No';
  return String(value);
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&')
    .replace(/</g, '<')
    .replace(/>/g, '>')
    .replace(/"/g, '"')
    .replace(/'/g, ''');
}