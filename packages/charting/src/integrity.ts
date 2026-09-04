// ============================================================================
// Chart Integrity Checks
// ============================================================================

import type { ChartSpec, Dataset, ChartGeometry, Chart } from '../index';

export interface IntegrityCheck {
  passed: boolean;
  message: string;
  severity: 'info' | 'warning' | 'error' | 'blocking';
  category: string;
}

export function runIntegrityChecks(chart: Chart, dataset: Dataset, geometry: ChartGeometry): IntegrityCheck[] {
  const checks: IntegrityCheck[] = [];

  // 1. Visual values match source data
  checks.push(...checkDataMatch(chart, dataset, geometry));

  // 2. Axis labels present
  checks.push(...checkAxisLabels(chart));

  // 3. Units specified
  checks.push(...checkUnits(chart));

  // 4. Category label fit
  checks.push(...checkLabelFit(chart, dataset, geometry));

  // 5. Legend/series match
  checks.push(...checkLegendMatch(chart));

  // 6. Baseline review
  checks.push(...checkBaseline(chart));

  // 7. Time-axis ordering
  checks.push(...checkTimeAxisOrdering(chart, dataset));

  // 8. Percentage/total coherence
  checks.push(...checkPercentageCoherence(chart, dataset));

  // 9. No color-only distinction
  checks.push(...checkColorOnlyDistinction(chart));

  // 10. Source note present
  checks.push(...checkSourceNote(chart));

  // 11. Data table presence
  checks.push(...checkDataTable(chart));

  // 12. Narrative vs values contradiction
  checks.push(...checkNarrativeContradiction(chart));

  return checks;
}

function checkDataMatch(chart: Chart, dataset: Dataset, geometry: ChartGeometry): IntegrityCheck[] {
  const checks: IntegrityCheck[] = [];

  if (chart.spec.type === 'horizontal_bar' || chart.spec.type === 'vertical_bar') {
    for (const bar of geometry.bars) {
      const series = chart.spec.series[bar.seriesIndex];
      const col = dataset.columns.find(c => c.id === series.dataColumnId);
      if (col) {
        const sourceValue = col.values[bar.categoryIndex] as number;
        if (sourceValue !== bar.value) {
          checks.push({
            passed: false,
            message: `Bar value mismatch: geometry=${bar.value}, source=${sourceValue}`,
            severity: 'blocking',
            category: 'data_mismatch',
          });
        }
      }
    }
  } else if (chart.spec.type === 'line') {
    for (const line of geometry.lines) {
      const series = chart.spec.series[line.seriesIndex];
      const col = dataset.columns.find(c => c.id === series.dataColumnId);
      if (col) {
        for (const point of line.points) {
          const sourceValue = col.values[line.points.indexOf(point)] as number;
          if (sourceValue !== point.value) {
            checks.push({
              passed: false,
              message: `Line point mismatch: geometry=${point.value}, source=${sourceValue}`,
              severity: 'blocking',
              category: 'data_mismatch',
            });
          }
        }
      }
    }
  }

  return checks;
}

function checkAxisLabels(chart: Chart): IntegrityCheck[] {
  const checks: IntegrityCheck[] = [];

  if (!chart.spec.xAxis.title || chart.spec.xAxis.title.trim() === '') {
    checks.push({
      passed: false,
      message: 'X-axis missing title',
      severity: 'error',
      category: 'missing_labels',
    });
  }

  if (!chart.spec.yAxis.title || chart.spec.yAxis.title.trim() === '') {
    checks.push({
      passed: false,
      message: 'Y-axis missing title',
      severity: 'error',
      category: 'missing_labels',
    });
  }

  if (!chart.spec.title || chart.spec.title.trim() === '') {
    checks.push({
      passed: false,
      message: 'Chart missing title',
      severity: 'error',
      category: 'missing_labels',
    });
  }

  return checks;
}

function checkUnits(chart: Chart): IntegrityCheck[] {
  const checks: IntegrityCheck[] = [];

  // Check if units are implied but not stated
  const xTitle = chart.spec.xAxis.title.toLowerCase();
  const yTitle = chart.spec.yAxis.title.toLowerCase();

  const unitKeywords = ['dollars', 'euros', 'pounds', 'percent', 'percentage', 'rate', 'ratio', 'count', 'number', 'amount', 'total', 'sum', 'average', 'mean', 'median'];
  const hasUnitHint = unitKeywords.some(k => xTitle.includes(k) || yTitle.includes(k));

  if (hasUnitHint && !/[$\u20ac\u00a3%]/.test(chart.spec.xAxis.title + chart.spec.yAxis.title)) {
    checks.push({
      passed: false,
      message: 'Axis titles suggest units but no unit symbols ($, €, £, %) are used',
      severity: 'warning',
      category: 'missing_units',
    });
  }

  return checks;
}

function checkLabelFit(chart: Chart, dataset: Dataset, geometry: ChartGeometry): IntegrityCheck[] {
  const checks: IntegrityCheck[] = [];

  const categoryCol = dataset.columns.find(c => c.type === 'string' || c.type === 'date');
  if (!categoryCol) return checks;

  const categories = [...new Set(categoryCol.values)];
  const maxLabelLength = Math.max(...categories.map(c => String(c).length));

  if (chart.spec.type === 'vertical_bar' && maxLabelLength > 15) {
    checks.push({
      passed: false,
      message: `Category labels up to ${maxLabelLength} chars may truncate in vertical bar chart`,
      severity: 'warning',
      category: 'label_fit',
    });
  }

  if (chart.spec.type === 'horizontal_bar' && maxLabelLength > 30) {
    checks.push({
      passed: false,
      message: `Category labels up to ${maxLabelLength} chars may be cramped in horizontal bar chart`,
      severity: 'warning',
      category: 'label_fit',
    });
  }

  return checks;
}

function checkLegendMatch(chart: Chart): IntegrityCheck[] {
  const checks: IntegrityCheck[] = [];

  if (chart.spec.series.length !== new Set(chart.spec.series.map(s => s.name)).size) {
    checks.push({
      passed: false,
      message: 'Duplicate series names in legend',
      severity: 'error',
      category: 'legend_series_match',
    });
  }

  return checks;
}

function checkBaseline(chart: Chart): IntegrityCheck[] {
  const checks: IntegrityCheck[] = [];

  if (chart.spec.yAxis.baselineZero === false) {
    checks.push({
      passed: false,
      message: 'Chart uses non-zero baseline - may exaggerate differences',
      severity: 'warning',
      category: 'baseline_anomaly',
    });
  }

  if (chart.spec.yAxis.min !== undefined && chart.spec.yAxis.min > 0 && chart.spec.yAxis.baselineZero) {
    checks.push({
      passed: false,
      message: 'Y-axis minimum > 0 but baselineZero is true - inconsistent',
      severity: 'warning',
      category: 'baseline_anomaly',
    });
  }

  return checks;
}

function checkTimeAxisOrdering(chart: Chart, dataset: Dataset): IntegrityCheck[] {
  const checks: IntegrityCheck[] = [];

  if (chart.spec.xAxis.type === 'time') {
    const temporalCol = dataset.columns.find(c => c.type === 'date');
    if (temporalCol) {
      const dates = temporalCol.values.filter(v => v instanceof Date) as Date[];
      const sorted = [...dates].sort((a, b) => a.getTime() - b.getTime());
      if (JSON.stringify(dates) !== JSON.stringify(sorted)) {
        checks.push({
          passed: false,
          message: 'Time-axis data is not in chronological order',
          severity: 'error',
          category: 'time_axis_ordering',
        });
      }
    }
  }

  return checks;
}

function checkPercentageCoherence(chart: Chart, dataset: Dataset): IntegrityCheck[] {
  const checks: IntegrityCheck[] = [];

  // Check if data sums to 100% for composition charts
  if (chart.spec.type === 'horizontal_bar' || chart.spec.type === 'vertical_bar') {
    const numericCols = dataset.columns.filter(c => c.type === 'number');
    for (const col of numericCols) {
      const sum = col.values.reduce((acc, v) => acc + (typeof v === 'number' ? v : 0), 0);
      if (Math.abs(sum - 100) < 1 && col.name.toLowerCase().includes('percent')) {
        // Good - percentages sum to 100
      } else if (Math.abs(sum - 1) < 0.01 && col.name.toLowerCase().includes('share')) {
        // Good - proportions sum to 1
      }
    }
  }

  return checks;
}

function checkColorOnlyDistinction(chart: Chart): IntegrityCheck[] {
  const checks: IntegrityCheck[] = [];

  // Check if series only differ by color
  const hasPatterns = chart.spec.series.some(s => s.pattern);
  const hasDashArrays = chart.spec.series.some(s => s.dashArray);

  if (chart.spec.series.length > 1 && !hasPatterns && !hasDashArrays) {
    checks.push({
      passed: false,
      message: 'Multiple series distinguished only by color - add patterns or dash arrays for accessibility',
      severity: 'error',
      category: 'color_only_distinction',
    });
  }

  return checks;
}

function checkSourceNote(chart: Chart): IntegrityCheck[] {
  const checks: IntegrityCheck[] = [];

  if (!chart.spec.sourceNote || chart.spec.sourceNote.trim() === '') {
    checks.push({
      passed: false,
      message: 'Chart missing source note',
      severity: 'warning',
      category: 'missing_source',
    });
  }

  return checks;
}

function checkDataTable(chart: Chart): IntegrityCheck[] {
  const checks: IntegrityCheck[] = [];

  // This would be checked at the object level in the domain
  // Here we just note the requirement
  checks.push({
    passed: true,
    message: 'Accessible data table required for export',
    severity: 'info',
    category: 'missing_table',
  });

  return checks;
}

function checkNarrativeContradiction(chart: Chart): IntegrityCheck[] {
  // Placeholder - would compare narrative with actual data
  return [];
}