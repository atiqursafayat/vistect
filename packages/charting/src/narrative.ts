// ============================================================================
// Chart Narrative Generation
// ============================================================================
//
// Deterministic, template-driven prose describing a chart (spec §13.5). No model
// is involved: every sentence is derived arithmetically from the dataset, so the
// narrative is a *deterministic* claim (§16.1) and can be regenerated
// identically. Anything requiring interpretation belongs in an agent-recorded
// analysis, not here.

import type { ChartSpec, Dataset, DataColumn } from '@vistect/domain/schema';
import { escapeHtml } from '@vistect/domain/text';

export interface NarrativeTemplate {
  title: string;
  sentences: string[];
}

/** Numeric values of a column, or `null` when the column is not numeric or empty. */
function numericValues(column: DataColumn | undefined): number[] | null {
  if (column?.type !== 'number') return null;
  const values = column.values.filter((v): v is number => typeof v === 'number');
  return values.length > 0 ? values : null;
}

interface NumericSummary {
  min: number;
  max: number;
  mean: number;
  minIndex: number;
  maxIndex: number;
}

function summarise(values: number[]): NumericSummary {
  const first = values[0] ?? 0;
  let min = first;
  let max = first;
  let minIndex = 0;
  let maxIndex = 0;
  let total = 0;

  for (const [index, value] of values.entries()) {
    total += value;
    if (value < min) {
      min = value;
      minIndex = index;
    }
    if (value > max) {
      max = value;
      maxIndex = index;
    }
  }

  return { min, max, mean: total / values.length, minIndex, maxIndex };
}

const formatNumber = (value: number): string =>
  Number.isInteger(value) ? String(value) : value.toFixed(2);

export function generateChartNarrative(spec: ChartSpec, dataset: Dataset): NarrativeTemplate {
  const sentences: string[] = [];
  const isHorizontal = spec.type === 'horizontal_bar';
  const categoryCol = dataset.columns.find((c) => c.type === 'string' || c.type === 'date');

  const categoryLabel = (index: number): string => {
    const raw = categoryCol?.values[index];
    return raw === undefined ? `point ${index + 1}` : String(raw);
  };

  sentences.push(
    `${spec.title} shows ${spec.series.length} ${spec.series.length === 1 ? 'series' : 'series'} across ${dataset.rowCount} data points.`
  );

  sentences.push(
    `The ${spec.xAxis.title.toLowerCase()} is on the ${isHorizontal ? 'vertical' : 'horizontal'} axis, and ${spec.yAxis.title.toLowerCase()} is on the ${isHorizontal ? 'horizontal' : 'vertical'} axis.`
  );

  if (spec.series.length > 1) {
    sentences.push(`The chart compares ${spec.series.map((s) => s.name).join(', ')}.`);
  }

  for (const series of spec.series) {
    const values = numericValues(dataset.columns.find((c) => c.id === series.dataColumnId));
    if (values === null) continue;

    const { min, max, mean, minIndex, maxIndex } = summarise(values);

    if (spec.series.length === 1) {
      sentences.push(
        `${series.name} ranges from ${formatNumber(min)} to ${formatNumber(max)}, with an average of ${mean.toFixed(2)}.`
      );
    }

    if (min === max) {
      sentences.push(`${series.name} is constant at ${formatNumber(min)}.`);
    } else {
      sentences.push(
        `${series.name} peaks at ${formatNumber(max)} (${categoryLabel(maxIndex)}) and is lowest at ${formatNumber(min)} (${categoryLabel(minIndex)}).`
      );
    }

    if (spec.type === 'line' && values.length >= 2) {
      const first = values[0] ?? 0;
      const last = values[values.length - 1] ?? 0;
      // 10% band avoids reporting a "trend" for noise. Zero-crossing series use
      // an absolute comparison, since a ratio against 0 is meaningless.
      const threshold = Math.abs(first) * 0.1;
      if (last > first + threshold) {
        sentences.push(
          `${series.name} shows an increasing trend from ${formatNumber(first)} to ${formatNumber(last)}.`
        );
      } else if (last < first - threshold) {
        sentences.push(
          `${series.name} shows a decreasing trend from ${formatNumber(first)} to ${formatNumber(last)}.`
        );
      } else {
        sentences.push(
          `${series.name} remains relatively stable around ${((first + last) / 2).toFixed(2)}.`
        );
      }
    }
  }

  if (spec.sourceNote !== undefined && spec.sourceNote !== '') {
    sentences.push(`Source: ${spec.sourceNote}.`);
  }

  return { title: spec.title, sentences };
}

/** Renders the narrative as a labelled region; all interpolated text is escaped. */
export function generateNarrativeHTML(narrative: NarrativeTemplate): string {
  return [
    '<div class="chart-narrative" role="region" aria-label="Chart description">',
    `<h3>${escapeHtml(narrative.title)} - Description</h3>`,
    `<p>${narrative.sentences.map(escapeHtml).join(' ')}</p>`,
    '</div>',
  ].join('');
}

export function generateNarrativeText(narrative: NarrativeTemplate): string {
  return `${narrative.title}\n\n${narrative.sentences.join('\n\n')}`;
}
