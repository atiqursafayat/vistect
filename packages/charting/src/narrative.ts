// ============================================================================
// Chart Narrative Generation
// ============================================================================

import type { ChartSpec, Dataset, ChartGeometry } from '../index';

export interface NarrativeTemplate {
  title: string;
  sentences: string[];
}

export function generateChartNarrative(spec: ChartSpec, dataset: Dataset, geometry: ChartGeometry): NarrativeTemplate {
  const sentences: string[] = [];

  // Opening
  sentences.push(`${spec.title} shows ${spec.series.length} series across ${dataset.rowCount} data points.`);

  // Axis description
  sentences.push(`The ${spec.xAxis.title.toLowerCase()} is on the ${spec.type === 'horizontal_bar' ? 'vertical' : 'horizontal'} axis, and ${spec.yAxis.title.toLowerCase()} is on the ${spec.type === 'horizontal_bar' ? 'horizontal' : 'vertical'} axis.`);

  // Series overview
  if (spec.series.length === 1) {
    const series = spec.series[0];
    const col = dataset.columns.find(c => c.id === series.dataColumnId);
    if (col && col.type === 'number') {
      const values = col.values.filter(v => typeof v === 'number') as number[];
      const min = Math.min(...values);
      const max = Math.max(...values);
      const avg = values.reduce((a, b) => a + b, 0) / values.length;
      sentences.push(`${series.name} ranges from ${min} to ${max}, with an average of ${avg.toFixed(2)}.`);
    }
  } else {
    const seriesNames = spec.series.map(s => s.name).join(', ');
    sentences.push(`The chart compares ${seriesNames}.`);
  }

  // Extremes
  for (const series of spec.series) {
    const col = dataset.columns.find(c => c.id === series.dataColumnId);
    if (col && col.type === 'number') {
      const values = col.values.filter(v => typeof v === 'number') as number[];
      const maxIdx = values.indexOf(Math.max(...values));
      const minIdx = values.indexOf(Math.min(...values));
      if (maxIdx >= 0 && minIdx >= 0) {
        const categoryCol = dataset.columns.find(c => c.type === 'string' || c.type === 'date');
        const maxCat = categoryCol ? String(categoryCol.values[maxIdx]) : `point ${maxIdx}`;
        const minCat = categoryCol ? String(categoryCol.values[minIdx]) : `point ${minIdx}`;
        sentences.push(`${series.name} peaks at ${Math.max(...values)} (${maxCat}) and is lowest at ${Math.min(...values)} (${minCat}).`);
      }
    }
  }

  // Trend (for line charts)
  if (spec.type === 'line') {
    for (const series of spec.series) {
      const col = dataset.columns.find(c => c.id === series.dataColumnId);
      if (col && col.type === 'number') {
        const values = col.values.filter(v => typeof v === 'number') as number[];
        if (values.length >= 2) {
          const first = values[0];
          const last = values[values.length - 1];
          if (last > first * 1.1) {
            sentences.push(`${series.name} shows an increasing trend from ${first} to ${last}.`);
          } else if (last < first * 0.9) {
            sentences.push(`${series.name} shows a decreasing trend from ${first} to ${last}.`);
          } else {
            sentences.push(`${series.name} remains relatively stable around ${((first + last) / 2).toFixed(2)}.`);
          }
        }
      }
    }
  }

  // Source note
  if (spec.sourceNote) {
    sentences.push(`Source: ${spec.sourceNote}.`);
  }

  return {
    title: spec.title,
    sentences,
  };
}

export function generateNarrativeHTML(narrative: NarrativeTemplate): string {
  let html = `<div class="chart-narrative" role="region" aria-label="Chart description">`;
  html += `<h3>${escapeHtml(narrative.title)} - Description</h3>`;
  html += `<p>${narrative.sentences.map(s => escapeHtml(s)).join(' ')}</p>`;
  html += `</div>`;
  return html;
}

export function generateNarrativeText(narrative: NarrativeTemplate): string {
  return `${narrative.title}\n\n${narrative.sentences.join('\n\n')}`;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&')
    .replace(/</g, '<')
    .replace(/>/g, '>')
    .replace(/"/g, '"')
    .replace(/'/g, ''');
}