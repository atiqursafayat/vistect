// ============================================================================
// Chart Recommendation Engine
// ============================================================================
//
// Deterministic chart-type recommendation (spec §13.3). No model involved: the
// same dataset and goal always yield the same ranked list, and each entry carries
// the reason it was chosen so the recommendation can be staged as a decision with
// evidence (AC F-4.x §5).
//
// R1 renders three chart types only (horizontal bar, vertical bar, line), so
// goals that would normally call for a scatter or histogram are answered with the
// closest supported type plus an explicit limitation warning.

import type { ChartSpec, ChartType, DataColumn, Dataset } from '@vistect/domain/schema';

export type AnalysisGoal = 'comparison' | 'trend' | 'composition' | 'distribution' | 'relationship';

export interface ChartRecommendation {
  type: ChartType;
  reason: string;
  /** 0–100. Higher means a better structural fit for the data and goal. */
  score: number;
  warnings: string[];
}

/** Thresholds at which category count or label length changes the recommendation. */
const THRESHOLDS = {
  manyCategories: 8,
  crowdedCategories: 15,
  longLabel: 20,
} as const;

interface DatasetShape {
  numeric: DataColumn[];
  categorical: DataColumn[];
  temporal: DataColumn[];
  categoryCount: number;
  maxLabelLength: number;
}

function analyseShape(dataset: Dataset): DatasetShape {
  const categorical = dataset.columns.filter((c) => c.type === 'string');

  // `Math.max(...[])` is `-Infinity`, so counts are folded explicitly.
  let categoryCount = 0;
  let maxLabelLength = 0;
  for (const col of categorical) {
    const labels = new Set(col.values.map(String));
    categoryCount = Math.max(categoryCount, labels.size);
    for (const label of labels) {
      maxLabelLength = Math.max(maxLabelLength, label.length);
    }
  }

  return {
    numeric: dataset.columns.filter((c) => c.type === 'number'),
    categorical,
    temporal: dataset.columns.filter((c) => c.type === 'date'),
    categoryCount,
    maxLabelLength,
  };
}

export function recommendChartTypes(dataset: Dataset, goal: AnalysisGoal): ChartRecommendation[] {
  const shape = analyseShape(dataset);
  const recommendations: ChartRecommendation[] = [];

  // Temporal data reads as a trend; a bar chart of dates hides continuity.
  if (shape.temporal.length > 0 && shape.numeric.length > 0) {
    recommendations.push({
      type: 'line',
      reason: 'Dataset has temporal and numeric columns — suited to showing change over time',
      score: goal === 'trend' ? 98 : 95,
      warnings: [],
    });
  } else if (goal === 'trend') {
    recommendations.push({
      type: 'line',
      reason: 'Trend requested, but no date column was found — the x-axis will be treated as ordinal',
      score: 60,
      warnings: ['A line chart implies continuity; confirm the x-axis order is meaningful'],
    });
  }

  // Long labels or many categories clip in vertical bars; horizontal bars give
  // each label a full text line.
  if (shape.categoryCount > THRESHOLDS.manyCategories || shape.maxLabelLength > THRESHOLDS.longLabel) {
    recommendations.push({
      type: 'horizontal_bar',
      reason: `${shape.categoryCount} categories with labels up to ${shape.maxLabelLength} characters — horizontal bars prevent label truncation`,
      score: 90,
      warnings:
        shape.categoryCount > THRESHOLDS.crowdedCategories
          ? [`${shape.categoryCount} categories may still be crowded; consider grouping`]
          : [],
    });
  }

  if (
    goal === 'comparison' &&
    shape.categoryCount > 0 &&
    shape.categoryCount <= THRESHOLDS.manyCategories &&
    shape.maxLabelLength <= THRESHOLDS.longLabel
  ) {
    recommendations.push({
      type: 'vertical_bar',
      reason: `${shape.categoryCount} categories with short labels — vertical bars make magnitude comparison direct`,
      score: 85,
      warnings: [],
    });
  }

  if (goal === 'composition' && shape.categorical.length >= 1 && shape.numeric.length >= 1) {
    recommendations.push({
      type: 'horizontal_bar',
      reason: 'Part-to-whole comparison is clearest with a single shared baseline',
      score: 80,
      warnings: ['Stacked composition is not available in R1; parts are shown side by side'],
    });
  }

  if (goal === 'distribution' && shape.numeric.length >= 1 && shape.categorical.length === 0) {
    recommendations.push({
      type: 'vertical_bar',
      reason: 'Numeric distribution can be shown as histogram-style vertical bars',
      score: 75,
      warnings: ['Values are not binned automatically; pre-bin continuous data'],
    });
  }

  if (goal === 'relationship') {
    const hasTemporal = shape.temporal.length > 0;
    recommendations.push({
      type: hasTemporal ? 'line' : 'horizontal_bar',
      reason: hasTemporal
        ? 'Relationship over time shown as a line chart'
        : 'Relationship between a category and a measure shown as horizontal bars',
      score: hasTemporal ? 70 : 65,
      warnings: ['Scatter plots are not available in R1'],
    });
  }

  if (recommendations.length === 0) {
    recommendations.push({
      type: 'horizontal_bar',
      reason: 'Default for categorical data when no stronger signal is present',
      score: 50,
      warnings: ['Specify an analysis goal for a more specific recommendation'],
    });
  }

  // Highest score first; ties broken by type name so ordering is deterministic
  // (Array.prototype.sort is not stable across every engine for equal keys).
  return recommendations.sort((a, b) => b.score - a.score || a.type.localeCompare(b.type));
}

export function getChartTypeLimitations(type: ChartType): string[] {
  const limitations: Record<ChartType, string[]> = {
    horizontal_bar: [
      'Limited to roughly 20 categories before becoming hard to scan',
      'Magnitude comparison is less immediate than vertical bars for some readers',
    ],
    vertical_bar: [
      'Category labels may truncate beyond about 15 characters',
      'Limited to roughly 12 categories before becoming hard to scan',
    ],
    line: [
      'Implies continuity between points — misleading if the x-axis is unordered',
      'Requires an ordered x-axis (temporal or ordinal)',
      'A non-zero baseline exaggerates change unless clearly disclosed',
    ],
  };
  return limitations[type];
}

/**
 * Structural validation of a chart spec against its dataset.
 *
 * Checks referential integrity and type compatibility — the things a wrong spec
 * would otherwise fail on silently at render time, producing an empty chart.
 */
export function validateChartSpec(
  dataset: Dataset,
  spec: ChartSpec
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (spec.datasetId !== dataset.id) {
    errors.push(`Spec references dataset ${spec.datasetId} but was validated against ${dataset.id}`);
  }

  if (spec.series.length === 0) {
    errors.push('At least one series is required');
  }

  for (const series of spec.series) {
    const col = dataset.columns.find((c) => c.id === series.dataColumnId);
    if (col === undefined) {
      errors.push(`Series "${series.name}" references unknown column ${series.dataColumnId}`);
      continue;
    }
    // Every supported chart type plots magnitude, so a series column must be numeric.
    if (col.type !== 'number') {
      errors.push(`Series "${series.name}" uses column "${col.name}" of type ${col.type}; a numeric column is required`);
    }
  }

  if (spec.xAxis.type === 'time' && !dataset.columns.some((c) => c.type === 'date')) {
    errors.push('X-axis is declared as time but the dataset has no date column');
  }

  if (spec.xAxis.type === 'category' && !dataset.columns.some((c) => c.type === 'string' || c.type === 'date')) {
    errors.push('X-axis is declared as category but the dataset has no categorical column');
  }

  return { valid: errors.length === 0, errors };
}
