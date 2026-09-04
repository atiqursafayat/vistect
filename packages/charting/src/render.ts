// ============================================================================
// Chart Rendering - SVG with Geometry Records
// ============================================================================

import type { ChartSpec, Dataset, ChartGeometry, DataColumn } from '../index';

export interface RenderResult {
  svg: string;
  geometry: ChartGeometry;
}

export function renderChart(spec: ChartSpec, dataset: Dataset, width = 600, height = 400): RenderResult {
  const margin = { top: 40, right: 40, bottom: 60, left: 60 };
  const plotWidth = width - margin.left - margin.right;
  const plotHeight = height - margin.top - margin.bottom;

  let geometry: ChartGeometry = { bars: [], lines: [], axes: { x: { x: margin.left, y: margin.top + plotHeight, w: plotWidth, h: 1 }, y: { x: margin.left, y: margin.top, w: 1, h: plotHeight } } };

  let svg = `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg" role="img" aria-labelledby="chart-title">`;
  svg += `<title id="chart-title">${spec.title}</title>`;
  svg += `<defs>`;
  // Patterns for accessibility
  for (let i = 0; i < spec.series.length; i++) {
    const series = spec.series[i];
    if (series.pattern) {
      svg += `<pattern id="pattern-${i}" patternUnits="userSpaceOnUse" width="4" height="4">`;
      svg += `<path d="M0,0 L4,4 M4,0 L0,4" stroke="${series.color}" stroke-width="1" />`;
      svg += `</pattern>`;
    }
  }
  svg += `</defs>`;

  // Chart area background
  svg += `<rect x="${margin.left}" y="${margin.top}" width="${plotWidth}" height="${plotHeight}" fill="none" stroke="#dee2e6" />`;

  if (spec.type === 'horizontal_bar' || spec.type === 'vertical_bar') {
    const result = renderBarChart(spec, dataset, plotWidth, plotHeight, margin);
    svg += result.svg;
    geometry = result.geometry;
  } else if (spec.type === 'line') {
    const result = renderLineChart(spec, dataset, plotWidth, plotHeight, margin);
    svg += result.svg;
    geometry = result.geometry;
  }

  // Axes
  svg += renderAxes(spec, dataset, plotWidth, plotHeight, margin);

  // Title
  svg += `<text x="${width / 2}" y="${margin.top / 2}" text-anchor="middle" font-size="16" font-weight="bold" font-family="system-ui, sans-serif">${spec.title}</text>`;

  // Subtitle
  if (spec.subtitle) {
    svg += `<text x="${width / 2}" y="${margin.top / 2 + 20}" text-anchor="middle" font-size="12" fill="#666" font-family="system-ui, sans-serif">${spec.subtitle}</text>`;
  }

  // Source note
  if (spec.sourceNote) {
    svg += `<text x="${margin.left}" y="${height - 10}" font-size="10" fill="#999" font-family="system-ui, sans-serif">Source: ${spec.sourceNote}</text>`;
  }

  // Legend
  if (spec.legendPosition !== 'none') {
    svg += renderLegend(spec, width, height, margin);
  }

  svg += `</svg>`;

  return { svg, geometry };
}

function renderBarChart(spec: ChartSpec, dataset: Dataset, plotWidth: number, plotHeight: number, margin: any): { svg: string; geometry: ChartGeometry } {
  const isHorizontal = spec.type === 'horizontal_bar';
  const categoryCol = dataset.columns.find(c => c.type === 'string' || c.type === 'date');
  const categories = categoryCol ? [...new Set(categoryCol.values)] : [];
  const categoryCount = categories.length;
  const seriesCount = spec.series.length;

  let svg = '';
  const bars: ChartGeometry['bars'] = [];

  if (isHorizontal) {
    const barHeight = (plotHeight / categoryCount) * 0.8 / seriesCount;
    const gap = (plotHeight / categoryCount) * 0.2 / seriesCount;

    // Find max value for scaling
    let maxValue = 0;
    for (const series of spec.series) {
      const col = dataset.columns.find(c => c.id === series.dataColumnId);
      if (col) {
        for (const val of col.values) {
          if (typeof val === 'number' && val > maxValue) maxValue = val;
        }
      }
    }

    for (let catIdx = 0; catIdx < categoryCount; catIdx++) {
      for (let sIdx = 0; sIdx < seriesCount; sIdx++) {
        const series = spec.series[sIdx];
        const col = dataset.columns.find(c => c.id === series.dataColumnId);
        const value = col && col.values[catIdx] as number || 0;

        const barLength = maxValue > 0 ? (value / maxValue) * plotWidth : 0;
        const y = margin.top + catIdx * (plotHeight / categoryCount) + sIdx * (barHeight + gap) + gap;
        const x = margin.left;

        const fill = series.pattern ? `url(#pattern-${sIdx})` : series.color;

        svg += `<rect x="${x}" y="${y}" width="${barLength}" height="${barHeight}" fill="${fill}" stroke="${series.color}" stroke-width="1" />`;

        // Value label
        if (barLength > 30) {
          svg += `<text x="${x + barLength - 5}" y="${y + barHeight / 2 + 4}" text-anchor="end" font-size="10" fill="white" font-family="system-ui, sans-serif">${value}</text>`;
        } else {
          svg += `<text x="${x + barLength + 5}" y="${y + barHeight / 2 + 4}" font-size="10" fill="#333" font-family="system-ui, sans-serif">${value}</text>`;
        }

        bars.push({ seriesIndex: sIdx, categoryIndex: catIdx, value, x, y, w: barLength, h: barHeight });
      }
    }

    // Category labels
    for (let catIdx = 0; catIdx < categoryCount; catIdx++) {
      const labelY = margin.top + catIdx * (plotHeight / categoryCount) + (plotHeight / categoryCount) / 2 + 4;
      svg += `<text x="${margin.left - 10}" y="${labelY}" text-anchor="end" font-size="11" font-family="system-ui, sans-serif">${categories[catIdx]}</text>`;
    }

    // Axes for horizontal bar
    svg += `<line x1="${margin.left}" y1="${margin.top}" x2="${margin.left}" y2="${margin.top + plotHeight}" stroke="#adb5bd" stroke-width="1" />`;
    svg += `<line x1="${margin.left}" y1="${margin.top + plotHeight}" x2="${margin.left + plotWidth}" y2="${margin.top + plotHeight}" stroke="#adb5bd" stroke-width="1" />`;

    geometry = {
      bars,
      lines: [],
      axes: { x: { x: margin.left, y: margin.top + plotHeight, w: plotWidth, h: 1 }, y: { x: margin.left, y: margin.top, w: 1, h: plotHeight } },
    };

  } else {
    // Vertical bar
    const barWidth = (plotWidth / categoryCount) * 0.8 / seriesCount;
    const gap = (plotWidth / categoryCount) * 0.2 / seriesCount;

    let maxValue = 0;
    for (const series of spec.series) {
      const col = dataset.columns.find(c => c.id === series.dataColumnId);
      if (col) {
        for (const val of col.values) {
          if (typeof val === 'number' && val > maxValue) maxValue = val;
        }
      }
    }

    for (let catIdx = 0; catIdx < categoryCount; catIdx++) {
      for (let sIdx = 0; sIdx < seriesCount; sIdx++) {
        const series = spec.series[sIdx];
        const col = dataset.columns.find(c => c.id === series.dataColumnId);
        const value = col && col.values[catIdx] as number || 0;

        const barHeight = maxValue > 0 ? (value / maxValue) * plotHeight : 0;
        const x = margin.left + catIdx * (plotWidth / categoryCount) + sIdx * (barWidth + gap) + gap;
        const y = margin.top + plotHeight - barHeight;

        const fill = series.pattern ? `url(#pattern-${sIdx})` : series.color;

        svg += `<rect x="${x}" y="${y}" width="${barWidth}" height="${barHeight}" fill="${fill}" stroke="${series.color}" stroke-width="1" />`;

        if (barHeight > 20) {
          svg += `<text x="${x + barWidth / 2}" y="${y - 5}" text-anchor="middle" font-size="10" fill="#333" font-family="system-ui, sans-serif">${value}</text>`;
        }

        bars.push({ seriesIndex: sIdx, categoryIndex: catIdx, value, x, y, w: barWidth, h: barHeight });
      }
    }

    // Category labels
    for (let catIdx = 0; catIdx < categoryCount; catIdx++) {
      const labelX = margin.left + catIdx * (plotWidth / categoryCount) + (plotWidth / categoryCount) / 2;
      svg += `<text x="${labelX}" y="${margin.top + plotHeight + 20}" text-anchor="middle" font-size="11" font-family="system-ui, sans-serif">${categories[catIdx]}</text>`;
    }

    // Axes for vertical bar
    svg += `<line x1="${margin.left}" y1="${margin.top}" x2="${margin.left}" y2="${margin.top + plotHeight}" stroke="#adb5bd" stroke-width="1" />`;
    svg += `<line x1="${margin.left}" y1="${margin.top + plotHeight}" x2="${margin.left + plotWidth}" y2="${margin.top + plotHeight}" stroke="#adb5bd" stroke-width="1" />`;

    geometry = {
      bars,
      lines: [],
      axes: { x: { x: margin.left, y: margin.top + plotHeight, w: plotWidth, h: 1 }, y: { x: margin.left, y: margin.top, w: 1, h: plotHeight } },
    };
  }

  return { svg, geometry };
}

function renderLineChart(spec: ChartSpec, dataset: Dataset, plotWidth: number, plotHeight: number, margin: any): { svg: string; geometry: ChartGeometry } {
  const categoryCol = dataset.columns.find(c => c.type === 'string' || c.type === 'date');
  const categories = categoryCol ? [...new Set(categoryCol.values)] : [];
  const categoryCount = categories.length;

  let svg = '';
  const lines: ChartGeometry['lines'] = [];

  // Find min/max for y-axis scaling
  let minValue = Infinity, maxValue = -Infinity;
  for (const series of spec.series) {
    const col = dataset.columns.find(c => c.id === series.dataColumnId);
    if (col) {
      for (const val of col.values) {
        if (typeof val === 'number') {
          minValue = Math.min(minValue, val);
          maxValue = Math.max(maxValue, val);
        }
      }
    }

  // Add padding
  const range = maxValue - minValue;
  minValue = spec.yAxis.baselineZero ? Math.min(0, minValue - range * 0.1) : minValue - range * 0.1;
  maxValue = maxValue + range * 0.1;

  for (let sIdx = 0; sIdx < spec.series.length; sIdx++) {
    const series = spec.series[sIdx];
    const col = dataset.columns.find(c => c.id === series.dataColumnId);
    if (!col) continue;

    const points: Array<{ x: number; y: number; value: number }> = [];

    for (let catIdx = 0; catIdx < categoryCount; catIdx++) {
      const value = col.values[catIdx] as number;
      const x = margin.left + (catIdx / Math.max(1, categoryCount - 1)) * plotWidth;
      const y = margin.top + plotHeight - ((value - minValue) / (maxValue - minValue)) * plotHeight;

      points.push({ x, y, value });

      // Data point marker
      svg += `<circle cx="${x}" cy="${y}" r="4" fill="${series.color}" stroke="white" stroke-width="2" />`;

      // Value label
      svg += `<text x="${x}" y="${y - 10}" text-anchor="middle" font-size="10" fill="#333" font-family="system-ui, sans-serif">${value}</text>`;
    }

    // Line path
    if (points.length > 1) {
      const pathData = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
      const strokeDash = series.dashArray || 'none';
      svg += `<path d="${pathData}" stroke="${series.color}" stroke-width="${series.dashArray ? '2' : '2.5'}" fill="none" stroke-dasharray="${strokeDash}" />`;
    }

    lines.push({ seriesIndex: sIdx, points });
  }

  // Axes
  svg += `<line x1="${margin.left}" y1="${margin.top}" x2="${margin.left}" y2="${margin.top + plotHeight}" stroke="#adb5bd" stroke-width="1" />`;
  svg += `<line x1="${margin.left}" y1="${margin.top + plotHeight}" x2="${margin.left + plotWidth}" y2="${margin.top + plotHeight}" stroke="#adb5bd" stroke-width="1" />`;

  // Y-axis labels
  const yTicks = 5;
  for (let i = 0; i <= yTicks; i++) {
    const val = minValue + (maxValue - minValue) * (1 - i / yTicks);
    const y = margin.top + (i / yTicks) * plotHeight;
    svg += `<line x1="${margin.left - 5}" y1="${y}" x2="${margin.left}" y2="${y}" stroke="#adb5bd" stroke-width="1" />`;
    svg += `<text x="${margin.left - 10}" y="${y + 4}" text-anchor="end" font-size="10" font-family="system-ui, sans-serif">${val.toFixed(1)}</text>`;
  }

  // X-axis labels
  for (let catIdx = 0; catIdx < categoryCount; catIdx++) {
    const x = margin.left + (catIdx / Math.max(1, categoryCount - 1)) * plotWidth;
    svg += `<text x="${x}" y="${margin.top + plotHeight + 20}" text-anchor="middle" font-size="11" font-family="system-ui, sans-serif">${categories[catIdx]}</text>`;
  }

  geometry = {
    bars: [],
    lines,
    axes: { x: { x: margin.left, y: margin.top + plotHeight, w: plotWidth, h: 1 }, y: { x: margin.left, y: margin.top, w: 1, h: plotHeight } },
  };

  return { svg, geometry };
}

function renderAxes(spec: ChartSpec, dataset: Dataset, plotWidth: number, plotHeight: number, margin: any): string {
  // Already rendered in chart-specific functions
  return '';
}

function renderLegend(spec: ChartSpec, width: number, height: number, margin: any): string {
  let svg = '';
  const itemHeight = 20;
  const startX = width - margin.right - 120;
  const startY = margin.top + 20;

  svg += `<g font-family="system-ui, sans-serif" font-size="11">`;
  spec.series.forEach((series, i) => {
    const y = startY + i * itemHeight;
    const pattern = series.pattern ? `url(#pattern-${i})` : series.color;
    svg += `<rect x="${startX}" y="${y - 8}" width="16" height="12" fill="${pattern}" stroke="${series.color}" />`;
    svg += `<text x="${startX + 22}" y="${y + 2}" fill="#333">${series.name}</text>`;
  });
  svg += `</g>`;

  return svg;
}