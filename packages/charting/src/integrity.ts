// ============================================================================
// Chart Integrity Checks
// ============================================================================
//
// Deterministic verification that a chart is an honest depiction of its data
// (spec §13.4). These checks are the reason the renderer emits geometry: a
// blind author cannot see that a bar is the wrong height, so the system proves
// it arithmetically instead.
//
// Severity contract:
//   blocking — the picture contradicts the data; export must not proceed
//   error    — required information is missing or inconsistent
//   warning  — likely to mislead; needs a human decision
//   info     — advisory only

import type { Chart, ChartGeometry, Dataset } from '@vistect/domain/schema';

export interface IntegrityCheck {
  passed: boolean;
  message: string;
  severity: 'info' | 'warning' | 'error' | 'blocking';
  category: string;
}

/**
 * Floating-point tolerance for value comparison.
 *
 * Geometry values pass through `(value - min) / span * pixels`, so exact
 * equality would produce false mismatches from representation error alone.
 */
const VALUE_EPSILON = 1e-9;

/** Character counts beyond which category labels are likely to clip. */
const LABEL_FIT_LIMITS = { vertical_bar: 15, horizontal_bar: 30 } as const;

export function runIntegrityChecks(
  chart: Chart,
  dataset: Dataset,
  geometry: ChartGeometry
): IntegrityCheck[] {
  return [
    ...checkDataMatch(chart, dataset, geometry),
    ...checkAxisLabels(chart),
    ...checkUnits(chart),
    ...checkLabelFit(chart, dataset),
    ...checkLegendMatch(chart),
    ...checkBaseline(chart),
    ...checkTimeAxisOrdering(chart, dataset),
    ...checkPercentageCoherence(chart, dataset),
    ...checkColorOnlyDistinction(chart),
    ...checkSourceNote(chart),
  ];
}

/** Numeric cell at `index`, or `null` when absent or non-numeric. */
function numericAt(dataset: Dataset, dataColumnId: string, index: number): number | null {
  const column = dataset.columns.find((c) => c.id === dataColumnId);
  const raw = column?.values[index];
  return typeof raw === 'number' ? raw : null;
}

/**
 * The central check: every rendered mark must carry the value from its source
 * cell. A mismatch means the drawing misrepresents the data.
 */
function checkDataMatch(
  chart: Chart,
  dataset: Dataset,
  geometry: ChartGeometry
): IntegrityCheck[] {
  const checks: IntegrityCheck[] = [];

  for (const bar of geometry.bars) {
    const series = chart.spec.series[bar.seriesIndex];
    if (series === undefined) {
      checks.push({
        passed: false,
        message: `Bar references series index ${bar.seriesIndex}, which does not exist`,
        severity: 'blocking',
        category: 'data_mismatch',
      });
      continue;
    }

    const sourceValue = numericAt(dataset, series.dataColumnId, bar.categoryIndex);
    if (sourceValue === null) {
      checks.push({
        passed: false,
        message: `Bar for "${series.name}" at position ${bar.categoryIndex + 1} has no numeric source value`,
        severity: 'blocking',
        category: 'data_mismatch',
      });
      continue;
    }

    if (Math.abs(sourceValue - bar.value) > VALUE_EPSILON) {
      checks.push({
        passed: false,
        message: `Bar value mismatch for "${series.name}" at position ${bar.categoryIndex + 1}: rendered ${bar.value}, source ${sourceValue}`,
        severity: 'blocking',
        category: 'data_mismatch',
      });
    }
  }

  for (const line of geometry.lines) {
    const series = chart.spec.series[line.seriesIndex];
    if (series === undefined) {
      checks.push({
        passed: false,
        message: `Line references series index ${line.seriesIndex}, which does not exist`,
        severity: 'blocking',
        category: 'data_mismatch',
      });
      continue;
    }

    // Position comes from `entries()`, not `indexOf(point)`: two points sharing a
    // value made `indexOf` return the first match, so a mismatch later in the
    // series compared against the wrong cell and went unreported.
    for (const [index, point] of line.points.entries()) {
      const sourceValue = numericAt(dataset, series.dataColumnId, index);
      if (sourceValue === null) {
        checks.push({
          passed: false,
          message: `Point for "${series.name}" at position ${index + 1} has no numeric source value`,
          severity: 'blocking',
          category: 'data_mismatch',
        });
        continue;
      }

      if (Math.abs(sourceValue - point.value) > VALUE_EPSILON) {
        checks.push({
          passed: false,
          message: `Line point mismatch for "${series.name}" at position ${index + 1}: rendered ${point.value}, source ${sourceValue}`,
          severity: 'blocking',
          category: 'data_mismatch',
        });
      }
    }
  }

  return checks;
}

function checkAxisLabels(chart: Chart): IntegrityCheck[] {
  const checks: IntegrityCheck[] = [];
  const missing = (value: string | undefined): boolean => value === undefined || value.trim() === '';

  if (missing(chart.spec.xAxis.title)) {
    checks.push({
      passed: false,
      message: 'X-axis missing title',
      severity: 'error',
      category: 'missing_labels',
    });
  }
  if (missing(chart.spec.yAxis.title)) {
    checks.push({
      passed: false,
      message: 'Y-axis missing title',
      severity: 'error',
      category: 'missing_labels',
    });
  }
  if (missing(chart.spec.title)) {
    checks.push({
      passed: false,
      message: 'Chart missing title',
      severity: 'error',
      category: 'missing_labels',
    });
  }

  return checks;
}

/** Axis titles that name a quantity without stating its unit. */
function checkUnits(chart: Chart): IntegrityCheck[] {
  const unitKeywords = [
    'dollars',
    'euros',
    'pounds',
    'percent',
    'percentage',
    'rate',
    'ratio',
    'count',
    'number',
    'amount',
    'total',
    'sum',
    'average',
    'mean',
    'median',
  ];

  const titles = `${chart.spec.xAxis.title} ${chart.spec.yAxis.title}`;
  const lowered = titles.toLowerCase();
  const hasUnitHint = unitKeywords.some((k) => lowered.includes(k));
  const hasUnitSymbol = /[$€£%]/.test(titles);

  if (hasUnitHint && !hasUnitSymbol) {
    return [
      {
        passed: false,
        message: 'Axis titles suggest units but no unit symbols ($, €, £, %) are used',
        severity: 'warning',
        category: 'missing_units',
      },
    ];
  }
  return [];
}

function checkLabelFit(chart: Chart, dataset: Dataset): IntegrityCheck[] {
  const categoryCol = dataset.columns.find((c) => c.type === 'string' || c.type === 'date');
  if (categoryCol === undefined) return [];

  const labels = [...new Set(categoryCol.values.map(String))];
  if (labels.length === 0) return [];

  const maxLength = Math.max(...labels.map((l) => l.length));

  if (chart.spec.type === 'vertical_bar' && maxLength > LABEL_FIT_LIMITS.vertical_bar) {
    return [
      {
        passed: false,
        message: `Category labels up to ${maxLength} characters may truncate in a vertical bar chart`,
        severity: 'warning',
        category: 'label_fit',
      },
    ];
  }

  if (chart.spec.type === 'horizontal_bar' && maxLength > LABEL_FIT_LIMITS.horizontal_bar) {
    return [
      {
        passed: false,
        message: `Category labels up to ${maxLength} characters may be cramped in a horizontal bar chart`,
        severity: 'warning',
        category: 'label_fit',
      },
    ];
  }

  return [];
}

function checkLegendMatch(chart: Chart): IntegrityCheck[] {
  const names = chart.spec.series.map((s) => s.name);
  const duplicates = [...new Set(names.filter((n, i) => names.indexOf(n) !== i))];

  if (duplicates.length > 0) {
    return [
      {
        passed: false,
        message: `Duplicate series names in legend: ${duplicates.join(', ')}`,
        severity: 'error',
        category: 'legend_series_match',
      },
    ];
  }
  return [];
}

function checkBaseline(chart: Chart): IntegrityCheck[] {
  const checks: IntegrityCheck[] = [];
  const { baselineZero, min } = chart.spec.yAxis;

  if (!baselineZero) {
    checks.push({
      passed: false,
      message: 'Chart uses a non-zero baseline, which exaggerates differences between values',
      severity: 'warning',
      category: 'baseline_anomaly',
    });
  }

  if (baselineZero && min !== undefined && min > 0) {
    checks.push({
      passed: false,
      message: `Y-axis minimum is ${min} but baselineZero is true — the axis configuration contradicts itself`,
      severity: 'error',
      category: 'baseline_anomaly',
    });
  }

  return checks;
}

function checkTimeAxisOrdering(chart: Chart, dataset: Dataset): IntegrityCheck[] {
  if (chart.spec.xAxis.type !== 'time') return [];

  const temporalCol = dataset.columns.find((c) => c.type === 'date');
  if (temporalCol === undefined) {
    return [
      {
        passed: false,
        message: 'X-axis is declared as time but the dataset has no date column',
        severity: 'error',
        category: 'time_axis_ordering',
      },
    ];
  }

  const times = temporalCol.values
    .filter((v): v is Date => v instanceof Date)
    .map((d) => d.getTime());

  // Direct pairwise comparison; the previous `JSON.stringify` comparison of Date
  // arrays compared serialised strings and reported false positives.
  for (let i = 1; i < times.length; i++) {
    const current = times[i];
    const previous = times[i - 1];
    if (current === undefined || previous === undefined) continue;
    if (current < previous) {
      return [
        {
          passed: false,
          message: `Time-axis data is not in chronological order (position ${i + 1} precedes position ${i})`,
          severity: 'error',
          category: 'time_axis_ordering',
        },
      ];
    }
  }

  return [];
}

/**
 * Columns whose name claims a percentage or share but whose values do not total
 * 100 (or 1). A "percent" column summing to 87 is either incomplete or mislabelled.
 */
function checkPercentageCoherence(chart: Chart, dataset: Dataset): IntegrityCheck[] {
  const checks: IntegrityCheck[] = [];
  if (chart.spec.type === 'line') return checks;

  const chartedColumnIds = new Set(chart.spec.series.map((s) => s.dataColumnId));

  for (const col of dataset.columns) {
    if (col.type !== 'number' || !chartedColumnIds.has(col.id)) continue;

    const name = col.name.toLowerCase();
    const isPercent = name.includes('percent') || name.includes('%');
    const isShare = name.includes('share') || name.includes('proportion');
    if (!isPercent && !isShare) continue;

    const sum = col.values.reduce<number>((acc, v) => acc + (typeof v === 'number' ? v : 0), 0);
    const expected = isPercent ? 100 : 1;
    const tolerance = isPercent ? 1 : 0.01;

    if (Math.abs(sum - expected) > tolerance) {
      checks.push({
        passed: false,
        message: `Column "${col.name}" is labelled as a ${isPercent ? 'percentage' : 'share'} but its values total ${sum.toFixed(2)}, not ${expected}`,
        severity: 'warning',
        category: 'percentage_coherence',
      });
    }
  }

  return checks;
}

/** Series must differ by more than colour alone (WCAG 1.4.1). */
function checkColorOnlyDistinction(chart: Chart): IntegrityCheck[] {
  if (chart.spec.series.length <= 1) return [];

  const hasNonColourCue = chart.spec.series.some(
    (s) => s.pattern !== undefined || s.dashArray !== undefined
  );
  if (hasNonColourCue) return [];

  return [
    {
      passed: false,
      message:
        'Multiple series are distinguished only by colour — add patterns or dash arrays so the chart is readable without colour perception',
      severity: 'error',
      category: 'color_only_distinction',
    },
  ];
}

function checkSourceNote(chart: Chart): IntegrityCheck[] {
  if (chart.spec.sourceNote !== undefined && chart.spec.sourceNote.trim() !== '') return [];

  return [
    {
      passed: false,
      message: 'Chart missing source note',
      severity: 'warning',
      category: 'missing_source',
    },
  ];
}
