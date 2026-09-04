// ============================================================================
// Chart Rendering - SVG with Geometry Records
// ============================================================================
//
// A hand-written renderer (ADR-007) rather than a charting library, because
// integrity checks need the **exact** pixel geometry of every bar and point in
// order to prove that the drawing matches the data (spec §13.4). `RenderResult`
// therefore returns geometry alongside the SVG; both are derived from one pass.
//
// SECURITY: titles, labels and category values are authored or imported, so every
// interpolated string is XML-escaped.

import type { ChartGeometry, ChartSpec, Dataset } from '@vistect/domain/schema';
import { escapeXml } from '@vistect/domain/text';

export interface RenderResult {
  svg: string;
  geometry: ChartGeometry;
}

export interface ChartMargin {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export const DEFAULT_MARGIN: ChartMargin = { top: 40, right: 40, bottom: 60, left: 60 };

const FONT_STACK = 'system-ui, sans-serif';
const AXIS_COLOR = '#adb5bd';
const LABEL_COLOR = '#333333';
const Y_AXIS_TICKS = 5;

interface PlotArea {
  width: number;
  height: number;
  margin: ChartMargin;
}

/** Empty geometry anchored to the plot area, used when a chart has no data. */
function emptyGeometry(plot: PlotArea): ChartGeometry {
  const { margin, width, height } = plot;
  return {
    bars: [],
    lines: [],
    axes: {
      x: { x: margin.left, y: margin.top + height, w: width, h: 1 },
      y: { x: margin.left, y: margin.top, w: 1, h: height },
    },
  };
}

/** Distinct category labels in first-seen order, preserving dataset row order. */
function categoryLabels(dataset: Dataset): string[] {
  const column = dataset.columns.find((c) => c.type === 'string' || c.type === 'date');
  if (column === undefined) return [];

  const seen = new Set<string>();
  const labels: string[] = [];
  for (const value of column.values) {
    const label = value instanceof Date ? (value.toISOString().split('T')[0] ?? '') : String(value);
    if (!seen.has(label)) {
      seen.add(label);
      labels.push(label);
    }
  }
  return labels;
}

/** Numeric value at `index` for a series, or `0` when absent or non-numeric. */
function seriesValue(dataset: Dataset, dataColumnId: string, index: number): number {
  const column = dataset.columns.find((c) => c.id === dataColumnId);
  const raw = column?.values[index];
  return typeof raw === 'number' ? raw : 0;
}

interface ValueRange {
  min: number;
  max: number;
}

/**
 * Value range across all series.
 *
 * `baselineZero` is honoured here rather than in the drawing code: a truncated
 * axis exaggerates differences, which is exactly what the integrity checks flag
 * (§13.4). A zero-height range is widened so a constant series still renders.
 */
function valueRange(spec: ChartSpec, dataset: Dataset): ValueRange {
  let min = Number.POSITIVE_INFINITY;
  let max = Number.NEGATIVE_INFINITY;

  for (const series of spec.series) {
    const column = dataset.columns.find((c) => c.id === series.dataColumnId);
    for (const value of column?.values ?? []) {
      if (typeof value !== 'number') continue;
      min = Math.min(min, value);
      max = Math.max(max, value);
    }
  }

  if (!Number.isFinite(min) || !Number.isFinite(max)) return { min: 0, max: 1 };

  if (spec.yAxis.baselineZero) {
    min = Math.min(0, min);
    max = Math.max(0, max);
  }
  if (min === max) {
    return min === 0 ? { min: 0, max: 1 } : { min: Math.min(0, min), max: max * 1.1 };
  }
  return { min, max };
}

function text(
  x: number,
  y: number,
  content: string,
  attrs: { anchor?: 'start' | 'middle' | 'end'; size?: number; fill?: string; weight?: string } = {}
): string {
  const { anchor = 'start', size = 11, fill = LABEL_COLOR, weight } = attrs;
  return (
    `<text x="${x}" y="${y}" text-anchor="${anchor}" font-size="${size}" ` +
    `font-family="${FONT_STACK}" fill="${fill}"` +
    (weight === undefined ? '' : ` font-weight="${weight}"`) +
    `>${escapeXml(content)}</text>`
  );
}

function axisLines(plot: PlotArea): string {
  const { margin, width, height } = plot;
  return (
    `<line x1="${margin.left}" y1="${margin.top}" x2="${margin.left}" y2="${margin.top + height}" stroke="${AXIS_COLOR}" stroke-width="1" />` +
    `<line x1="${margin.left}" y1="${margin.top + height}" x2="${margin.left + width}" y2="${margin.top + height}" stroke="${AXIS_COLOR}" stroke-width="1" />`
  );
}

function yAxisTicks(plot: PlotArea, range: ValueRange): string {
  const { margin, height } = plot;
  const parts: string[] = [];

  for (let i = 0; i <= Y_AXIS_TICKS; i++) {
    const value = range.min + (range.max - range.min) * (1 - i / Y_AXIS_TICKS);
    const y = margin.top + (i / Y_AXIS_TICKS) * height;
    parts.push(
      `<line x1="${margin.left - 5}" y1="${y}" x2="${margin.left}" y2="${y}" stroke="${AXIS_COLOR}" stroke-width="1" />`
    );
    parts.push(text(margin.left - 10, y + 4, value.toFixed(1), { anchor: 'end', size: 10 }));
  }

  return parts.join('');
}

export function renderChart(
  spec: ChartSpec,
  dataset: Dataset,
  width = 600,
  height = 400,
  margin: ChartMargin = DEFAULT_MARGIN
): RenderResult {
  const plot: PlotArea = {
    width: width - margin.left - margin.right,
    height: height - margin.top - margin.bottom,
    margin,
  };

  const parts: string[] = [];
  parts.push(
    `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" ` +
      `xmlns="http://www.w3.org/2000/svg" role="img" aria-labelledby="chart-title">`
  );
  parts.push(`<title id="chart-title">${escapeXml(spec.title)}</title>`);

  // Patterns give each series a non-colour distinguishing mark, so the chart
  // remains readable without colour perception (WCAG 1.4.1).
  parts.push('<defs>');
  for (const [index, series] of spec.series.entries()) {
    if (series.pattern === undefined) continue;
    parts.push(
      `<pattern id="pattern-${index}" patternUnits="userSpaceOnUse" width="4" height="4">` +
        `<path d="M0,0 L4,4 M4,0 L0,4" stroke="${series.color}" stroke-width="1" />` +
        '</pattern>'
    );
  }
  parts.push('</defs>');

  parts.push(
    `<rect x="${margin.left}" y="${margin.top}" width="${plot.width}" height="${plot.height}" fill="none" stroke="#dee2e6" />`
  );

  const rendered =
    spec.type === 'line' ? renderLineChart(spec, dataset, plot) : renderBarChart(spec, dataset, plot);
  parts.push(rendered.svg);

  parts.push(
    text(width / 2, margin.top / 2, spec.title, { anchor: 'middle', size: 16, weight: 'bold' })
  );
  if (spec.subtitle !== undefined && spec.subtitle !== '') {
    parts.push(
      text(width / 2, margin.top / 2 + 20, spec.subtitle, {
        anchor: 'middle',
        size: 12,
        fill: '#666666',
      })
    );
  }
  if (spec.sourceNote !== undefined && spec.sourceNote !== '') {
    parts.push(
      text(margin.left, height - 10, `Source: ${spec.sourceNote}`, { size: 10, fill: '#767676' })
    );
  }

  if (spec.legendPosition !== 'none') {
    parts.push(renderLegend(spec, width, margin));
  }

  parts.push('</svg>');
  return { svg: parts.join(''), geometry: rendered.geometry };
}

function renderBarChart(spec: ChartSpec, dataset: Dataset, plot: PlotArea): RenderResult {
  const { margin, width: plotWidth, height: plotHeight } = plot;
  const isHorizontal = spec.type === 'horizontal_bar';
  const categories = categoryLabels(dataset);
  const seriesCount = spec.series.length;

  if (categories.length === 0 || seriesCount === 0) {
    return { svg: axisLines(plot), geometry: emptyGeometry(plot) };
  }

  const range = valueRange(spec, dataset);
  const span = range.max - range.min;
  const bars: ChartGeometry['bars'] = [];
  const parts: string[] = [];

  // Each category owns a band; series share it, leaving 20% as padding.
  const bandSize = (isHorizontal ? plotHeight : plotWidth) / categories.length;
  const barThickness = (bandSize * 0.8) / seriesCount;
  const gap = (bandSize * 0.2) / (seriesCount + 1);

  for (const [catIdx] of categories.entries()) {
    for (const [sIdx, series] of spec.series.entries()) {
      const value = seriesValue(dataset, series.dataColumnId, catIdx);
      const magnitude = span > 0 ? ((value - range.min) / span) * (isHorizontal ? plotWidth : plotHeight) : 0;
      const fill = series.pattern !== undefined ? `url(#pattern-${sIdx})` : series.color;
      const bandStart = (isHorizontal ? margin.top : margin.left) + catIdx * bandSize;
      const offset = gap + sIdx * (barThickness + gap);

      if (isHorizontal) {
        const x = margin.left;
        const y = bandStart + offset;
        parts.push(
          `<rect x="${x}" y="${y}" width="${magnitude}" height="${barThickness}" fill="${fill}" stroke="${series.color}" stroke-width="1" />`
        );
        // Inside-the-bar labels only when the bar is wide enough; a white label
        // on the page background would otherwise be invisible.
        parts.push(
          magnitude > 30
            ? text(x + magnitude - 5, y + barThickness / 2 + 4, String(value), {
                anchor: 'end',
                size: 10,
                fill: '#ffffff',
              })
            : text(x + magnitude + 5, y + barThickness / 2 + 4, String(value), { size: 10 })
        );
        bars.push({ seriesIndex: sIdx, categoryIndex: catIdx, value, x, y, w: magnitude, h: barThickness });
      } else {
        const x = bandStart + offset;
        const y = margin.top + plotHeight - magnitude;
        parts.push(
          `<rect x="${x}" y="${y}" width="${barThickness}" height="${magnitude}" fill="${fill}" stroke="${series.color}" stroke-width="1" />`
        );
        if (magnitude > 20) {
          parts.push(
            text(x + barThickness / 2, y - 5, String(value), { anchor: 'middle', size: 10 })
          );
        }
        bars.push({ seriesIndex: sIdx, categoryIndex: catIdx, value, x, y, w: barThickness, h: magnitude });
      }
    }
  }

  for (const [catIdx, label] of categories.entries()) {
    if (isHorizontal) {
      const y = margin.top + catIdx * bandSize + bandSize / 2 + 4;
      parts.push(text(margin.left - 10, y, label, { anchor: 'end' }));
    } else {
      const x = margin.left + catIdx * bandSize + bandSize / 2;
      parts.push(text(x, margin.top + plotHeight + 20, label, { anchor: 'middle' }));
    }
  }

  parts.push(axisLines(plot));
  if (!isHorizontal) {
    parts.push(yAxisTicks(plot, range));
  }

  return {
    svg: parts.join(''),
    geometry: { ...emptyGeometry(plot), bars },
  };
}

function renderLineChart(spec: ChartSpec, dataset: Dataset, plot: PlotArea): RenderResult {
  const { margin, width: plotWidth, height: plotHeight } = plot;
  const categories = categoryLabels(dataset);

  if (categories.length === 0 || spec.series.length === 0) {
    return { svg: axisLines(plot), geometry: emptyGeometry(plot) };
  }

  const range = valueRange(spec, dataset);
  const span = range.max - range.min;
  const lines: ChartGeometry['lines'] = [];
  const parts: string[] = [];

  // A single category would divide by zero; pin it to the left edge instead.
  const xStep = categories.length > 1 ? plotWidth / (categories.length - 1) : 0;

  for (const [sIdx, series] of spec.series.entries()) {
    const points: ChartGeometry['lines'][number]['points'] = [];

    for (const [catIdx] of categories.entries()) {
      const value = seriesValue(dataset, series.dataColumnId, catIdx);
      const x = margin.left + catIdx * xStep;
      const y =
        span > 0
          ? margin.top + plotHeight - ((value - range.min) / span) * plotHeight
          : margin.top + plotHeight / 2;
      points.push({ x, y, value });
    }

    if (points.length > 1) {
      const path = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
      const strokeWidth = series.dashArray === undefined ? 2.5 : 2;
      parts.push(
        `<path d="${path}" stroke="${series.color}" stroke-width="${strokeWidth}" fill="none"` +
          (series.dashArray === undefined ? '' : ` stroke-dasharray="${series.dashArray}"`) +
          ' />'
      );
    }

    // Markers are drawn after the path so they sit on top of it.
    for (const point of points) {
      parts.push(
        `<circle cx="${point.x}" cy="${point.y}" r="4" fill="${series.color}" stroke="#ffffff" stroke-width="2" />`
      );
      parts.push(text(point.x, point.y - 10, String(point.value), { anchor: 'middle', size: 10 }));
    }

    lines.push({ seriesIndex: sIdx, points });
  }

  for (const [catIdx, label] of categories.entries()) {
    parts.push(
      text(margin.left + catIdx * xStep, margin.top + plotHeight + 20, label, { anchor: 'middle' })
    );
  }

  parts.push(axisLines(plot));
  parts.push(yAxisTicks(plot, range));

  return {
    svg: parts.join(''),
    geometry: { ...emptyGeometry(plot), lines },
  };
}

function renderLegend(spec: ChartSpec, width: number, margin: ChartMargin): string {
  const itemHeight = 20;
  const startX = width - margin.right - 120;
  const startY = margin.top + 20;

  const parts = [`<g font-family="${FONT_STACK}" font-size="11">`];
  for (const [index, series] of spec.series.entries()) {
    const y = startY + index * itemHeight;
    const fill = series.pattern !== undefined ? `url(#pattern-${index})` : series.color;
    parts.push(
      `<rect x="${startX}" y="${y - 8}" width="16" height="12" fill="${fill}" stroke="${series.color}" />`
    );
    parts.push(text(startX + 22, y + 2, series.name));
  }
  parts.push('</g>');

  return parts.join('');
}
