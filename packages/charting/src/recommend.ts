// ============================================================================
// Chart Recommendation Engine
// ============================================================================

import type { Dataset, DataColumn, ChartRecommendation } from '../index';

export function recommendChartTypes(dataset: Dataset, goal: 'comparison' | 'trend' | 'composition' | 'distribution' | 'relationship'): ChartRecommendation[] {
  const recommendations: ChartRecommendation[] = [];

  // Analyze dataset structure
  const numericColumns = dataset.columns.filter(c => c.type === 'number');
  const categoricalColumns = dataset.columns.filter(c => c.type === 'string');
  const temporalColumns = dataset.columns.filter(c => c.type === 'date');
  const categoryCount = Math.max(...categoricalColumns.map(c => new Set(c.values).size), 0);
  const maxLabelLength = Math.max(...categoricalColumns.map(c => Math.max(...c.values.map(v => String(v).length))), 0);

  // Rule: Time series -> line chart
  if (temporalColumns.length > 0 && numericColumns.length > 0) {
    recommendations.push({
      type: 'line',
      reason: 'Dataset has temporal and numeric columns - ideal for trend visualization',
      score: 95,
      warnings: [],
    });
  }

  // Rule: Many categories or long labels -> horizontal bar
  if (categoryCount > 8 || maxLabelLength > 20) {
    recommendations.push({
      type: 'horizontal_bar',
      reason: `${categoryCount} categories with labels up to ${maxLabelLength} chars - horizontal bars prevent label truncation`,
      score: 90,
      warnings: categoryCount > 15 ? ['Many categories may still be crowded'] : [],
    });
  }

  // Rule: Few categories, comparison goal -> vertical bar
  if (categoryCount <= 8 && maxLabelLength <= 20 && goal === 'comparison') {
    recommendations.push({
      type: 'vertical_bar',
      reason: `${categoryCount} categories with short labels - vertical bars work well for comparison`,
      score: 85,
      warnings: [],
    });
  }

  // Rule: Composition goal with one categorical + one numeric -> horizontal bar
  if (goal === 'composition' && categoricalColumns.length >= 1 && numericColumns.length >= 1) {
    recommendations.push({
      type: 'horizontal_bar',
      reason: 'Composition analysis benefits from horizontal bars for part-to-whole comparison',
      score: 80,
      warnings: [],
    });
  }

  // Rule: Distribution with numeric only -> line or vertical bar (histogram-like)
  if (goal === 'distribution' && numericColumns.length >= 1 && categoricalColumns.length === 0) {
    recommendations.push({
      type: 'vertical_bar',
      reason: 'Numeric distribution can be shown as histogram-style vertical bars',
      score: 75,
      warnings: ['Consider binning for continuous data'],
    });
  }

  // Rule: Relationship (scatter) not supported in R1, suggest line if temporal
  if (goal === 'relationship') {
    if (temporalColumns.length > 0) {
      recommendations.push({
        type: 'line',
        reason: 'Relationship over time shown as line chart (scatter not available in R1)',
        score: 70,
        warnings: ['Scatter plots not available in R1'],
      });
    } else {
      recommendations.push({
        type: 'horizontal_bar',
        reason: 'Relationship between categorical and numeric shown as horizontal bars (scatter not available in R1)',
        score: 65,
        warnings: ['Scatter plots not available in R1'],
      });
    }
  }

  // Default fallback
  if (recommendations.length === 0) {
    recommendations.push({
      type: 'horizontal_bar',
      reason: 'Default recommendation for categorical data',
      score: 50,
      warnings: ['Consider specifying analysis goal for better recommendation'],
    });
  }

  // Sort by score descending
  return recommendations.sort((a, b) => b.score - a.score);
}

export function getChartTypeLimitations(type: string): string[] {
  const limitations: Record<string, string[]> = {
    horizontal_bar: [
      'Limited to ~20 categories for readability',
      'Value comparison less intuitive than vertical for some users',
    ],
    vertical_bar: [
      'Category labels may truncate if long (>15 chars)',
      'Limited to ~12 categories for readability',
    ],
    line: [
      'Implies temporal continuity - may mislead if x-axis is categorical',
      'Requires ordered x-axis (temporal or ordinal)',
      'Zero baseline may be misleading if not explicitly shown',
    ],
  };
  return limitations[type] || [];
}

export function validateChartSpec(dataset: Dataset, spec: any): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!spec.xAxis || !spec.yAxis) {
    errors.push('Both xAxis and yAxis are required');
  }

  if (!spec.series || spec.series.length === 0) {
    errors.push('At least one series is required');
  }

  // Check referenced columns exist
  for (const series of spec.series || []) {
    const col = dataset.columns.find(c => c.id === series.dataColumnId);
    if (!col) {
      errors.push(`Series references unknown column: ${series.dataColumnId}`);
    }
  }

  // Check axis types match column types
  if (spec.xAxis && spec.yAxis) {
    const xCol = dataset.columns.find(c => c.id === spec.series?.[0]?.dataColumnId);
    const yCol = dataset.columns.find(c => c.id === spec.series?.[0]?.dataColumnId);

    // Simplified check - real implementation would be more thorough
  }

  return { valid: errors.length === 0, errors };
}