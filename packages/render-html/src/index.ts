// ============================================================================
// HTML Renderer - Semantic HTML Preview + Export Bundle
// ============================================================================

import type {
  DocumentProject,
  DocumentObject,
  Page,
  PageTemplate,
  ImageAsset,
  Diagram,
  Chart,
  Dataset,
  Bounds,
  AccessibilityMetadata,
  ApprovalState,
} from '@vistect/domain/schema';

// ============================================================================
// Layout Engine Types
// ============================================================================

export interface ResolvedLayout {
  pages: ResolvedPage[];
  globalStyles: string;
}

export interface ResolvedPage {
  pageId: string;
  template: PageTemplate;
  objects: ResolvedObject[];
  bounds: Bounds;
}

export interface ResolvedObject {
  object: DocumentObject;
  resolvedBounds: Bounds;
  zIndex: number;
}

// ============================================================================
// Layout Engine
// ============================================================================

export function resolveLayout(project: DocumentProject): ResolvedLayout {
  const pages: ResolvedPage[] = [];

  for (const pageId of project.pageOrder) {
    const page = project.pages[pageId];
    if (!page) continue;

    const resolvedObjects: ResolvedObject[] = [];
    const pageBounds = getTemplateBounds(page.template);

    // Sort objects by layer then reading order
    const sortedObjects = page.objects
      .map(id => project.objects[id])
      .filter(Boolean) as DocumentObject[];

    sortedObjects.sort((a, b) => {
      if (a.layer !== b.layer) return a.layer - b.layer;
      return a.readingOrderIndex - b.readingOrderIndex;
    });

    for (let i = 0; i < sortedObjects.length; i++) {
      const obj = sortedObjects[i];
      const resolvedBounds = resolveObjectBounds(obj, pageBounds, page, project, i);

      resolvedObjects.push({
        object: obj,
        resolvedBounds,
        zIndex: obj.layer * 1000 + i,
      });
    }

    pages.push({
      pageId,
      template: page.template,
      objects: resolvedObjects,
      bounds: pageBounds,
    });
  }

  return {
    pages,
    globalStyles: generateGlobalStyles(project),
  };
}

function getTemplateBounds(template: PageTemplate): Bounds {
  // A4 at 72 DPI with margins
  return { x: 0, y: 0, w: 595, h: 842 };
}

function resolveObjectBounds(
  obj: DocumentObject,
  pageBounds: Bounds,
  page: Page,
  project: DocumentProject,
  index: number
): Bounds {
  // If object has explicit bounds, use them (from layout engine)
  // Otherwise compute from constraints
  if (obj.bounds.w > 0 && obj.bounds.h > 0) {
    return { ...obj.bounds };
  }

  // Default positioning based on template regions
  return computeDefaultPosition(obj, pageBounds, index);
}

function computeDefaultPosition(obj: DocumentObject, pageBounds: Bounds, index: number): Bounds {
  const margin = 72; // 1 inch
  const contentWidth = pageBounds.w - 2 * margin;
  const lineHeight = 24;
  const estimatedHeight = Math.max(lineHeight, obj.kind === 'text' ? estimateTextHeight(obj) : 200);

  return {
    x: margin,
    y: margin + index * (estimatedHeight + 16),
    w: contentWidth,
    h: estimatedHeight,
  };
}

function estimateTextHeight(obj: DocumentObject): number {
  if (obj.kind !== 'text') return 100;
  const charsPerLine = Math.max(1, Math.floor((595 - 144) / 8));
  const lines = Math.ceil(obj.content.length / charsPerLine);
  return lines * 24 + 16;
}

// ============================================================================
// HTML Generation
// ============================================================================

export function renderProjectHTML(project: DocumentProject, layout: ResolvedLayout): string {
  const html = new HTMLBuilder();

  html.open('html', { lang: project.language });
  html.open('head');
  html.tag('meta', { charset: 'utf-8' });
  html.tag('meta', { name: 'viewport', content: 'width=device-width, initial-scale=1' });
  html.tag('title', {}, project.title);
  html.open('style');
  html.raw(layout.globalStyles);
  html.raw(generatePageStyles(layout));
  html.close('style');
  html.close('head');

  html.open('body');
  html.open('main', { id: 'document', role: 'document' });

  // Skip link
  html.tag('a', { href: '#navigator', class: 'skip-link' }, 'Skip to navigator');
  html.tag('a', { href: '#explorer', class: 'skip-link' }, 'Skip to object explorer');
  html.tag('a', { href: '#decisions', class: 'skip-link' }, 'Skip to decisions');

  // Live regions for announcements
  html.open('div', { id: 'live-polite', role: 'status', 'aria-live': 'polite', 'aria-atomic': 'true', class: 'sr-only' });
  html.close('div');
  html.open('div', { id: 'live-assertive', role: 'alert', 'aria-live': 'assertive', 'aria-atomic': 'true', class: 'sr-only' });
  html.close('div');

  // Pages
  for (const page of layout.pages) {
    html.open('section', {
      id: `page-${page.pageId}`,
      role: 'region',
      'aria-label': `Page ${layout.pages.indexOf(page) + 1}`,
      class: 'page',
      'data-template': page.template,
    });

    // Page template regions
    const regions = getTemplateRegions(page.template);
    for (const region of regions) {
      html.open('div', { class: `region region-${region.name}`, 'data-region': region.name });
      const regionObjects = page.objects.filter(o =>
        o.resolvedBounds.x >= region.bounds.x &&
        o.resolvedBounds.y >= region.bounds.y &&
        o.resolvedBounds.x + o.resolvedBounds.w <= region.bounds.x + region.bounds.w &&
        o.resolvedBounds.y + o.resolvedBounds.h <= region.bounds.y + region.bounds.h
      );
      for (const robj of regionObjects) {
        html.raw(renderObject(robj, project));
      }
      html.close('div');
    }

    html.close('section');
  }

  html.close('main');
  html.close('body');
  html.close('html');

  return html.toString();
}

function renderObject(robj: ResolvedObject, project: DocumentProject): string {
  const { object, resolvedBounds } = robj;
  const style = `position:absolute;left:${resolvedBounds.x}px;top:${resolvedBounds.y}px;width:${resolvedBounds.w}px;height:${resolvedBounds.h}px;z-index:${robj.zIndex};`;

  const html = new HTMLBuilder();
  const accessibility = object.accessibility;

  // Determine element type and ARIA
  let tag = 'div';
  let role = accessibility.role;
  let ariaLabel = accessibility.altText || accessibility.accessibleName || object.purpose;
  let ariaDescribedBy = accessibility.longDescription ? `${object.id}-desc` : undefined;

  switch (object.kind) {
    case 'text':
      return renderTextObject(object, style, html);
    case 'image':
      return renderImageObject(object, project, style, html);
    case 'icon':
      return renderIconObject(object, style, html);
    case 'chart':
      return renderChartObject(object, project, style, html);
    case 'diagram':
      return renderDiagramObject(object, project, style, html);
    case 'table':
      return renderTableObject(object, style, html);
    case 'shape':
      return renderShapeObject(object, style, html);
  }

  // Generic fallback
  html.open(tag, { id: object.id, class: `object object-${object.kind}`, style, role, 'aria-label': ariaLabel, 'aria-describedby': ariaDescribedBy });
  html.close(tag);

  if (accessibility.longDescription) {
    html.open('div', { id: `${object.id}-desc`, class: 'sr-only' });
    html.raw(accessibility.longDescription);
    html.close('div');
  }

  return html.toString();
}

function renderTextObject(obj: DocumentObject, style: string, html: HTMLBuilder): string {
  const role = obj.role;
  const accessibility = obj.accessibility;

  let tag = 'div';
  let level = 0;

  switch (role) {
    case 'heading':
      level = obj.headingLevel || 1;
      tag = `h${level}`;
      break;
    case 'paragraph':
      tag = 'p';
      break;
    case 'bulleted-list':
      tag = 'ul';
      break;
    case 'numbered-list':
      tag = 'ol';
      break;
    case 'quotation':
      tag = 'blockquote';
      break;
    case 'callout':
      tag = 'aside';
      break;
    case 'statistic-card':
      tag = 'div';
      break;
    case 'caption':
      tag = 'figcaption';
      break;
    case 'footnote':
      tag = 'footer';
      break;
    case 'source-note':
      tag = 'small';
      break;
    case 'hyperlink':
      tag = 'a';
      break;
  }

  const attrs: Record<string, string> = {
    id: obj.id,
    class: `object object-text object-${role}`,
    style,
    'data-role': role,
  };

  if (role === 'heading') {
    attrs['aria-level'] = String(level);
  }

  if (accessibility.isDecorative) {
    attrs.role = 'presentation';
    attrs['aria-hidden'] = 'true';
  } else if (accessibility.altText) {
    attrs['aria-label'] = accessibility.altText;
  }

  if (role === 'hyperlink' && obj.hyperlink) {
    attrs.href = obj.hyperlink;
    attrs.target = '_blank';
    attrs.rel = 'noopener noreferrer';
  }

  html.open(tag, attrs);

  if (role === 'bulleted-list' || role === 'numbered-list') {
    const items = obj.listItems || [obj.content];
    for (const item of items) {
      html.open('li', { class: 'list-item' });
      html.raw(item);
      html.close('li');
    }
  } else if (role === 'quotation') {
    html.open('p', { class: 'quote-text' });
    html.raw(obj.content);
    html.close('p');
    if (obj.content) {
      html.open('footer', { class: 'quote-attribution' });
      html.raw(obj.content);
      html.close('footer');
    }
  } else if (role === 'callout') {
    html.open('div', { class: 'callout-content' });
    html.raw(obj.content);
    html.close('div');
  } else if (role === 'statistic-card') {
    html.open('div', { class: 'statistic-value' });
    html.raw(obj.content);
    html.close('div');
  } else {
    html.raw(obj.content);
  }

  html.close(tag);

  if (accessibility.longDescription) {
    html.open('div', { id: `${obj.id}-desc`, class: 'sr-only' });
    html.raw(accessibility.longDescription);
    html.close('div');
  }

  return html.toString();
}

function renderImageObject(obj: DocumentObject, project: DocumentProject, style: string, html: HTMLBuilder): string {
  const imageObj = obj as any; // ImageObject
  const asset = project.assets[imageObj.assetId];
  const accessibility = obj.accessibility;

  const src = asset ? URL.createObjectURL(asset.blob) : '';
  const alt = accessibility.isDecorative ? '' : (imageObj.altTextApproved || accessibility.altText || obj.purpose);

  html.open('figure', { id: obj.id, class: 'object object-image', style });
  html.tag('img', {
    src,
    alt,
    class: 'image-content',
    loading: 'lazy',
  });

  if (accessibility.longDescription) {
    html.open('figcaption', { id: `${obj.id}-desc`, class: 'sr-only' });
    html.raw(accessibility.longDescription);
    html.close('figcaption');
  }

  html.close('figure');

  return html.toString();
}

function renderIconObject(obj: DocumentObject, style: string, html: HTMLBuilder): string {
  const iconObj = obj as any; // IconObject
  const accessibility = obj.accessibility;

  html.open('span', { id: obj.id, class: `object object-icon icon-${iconObj.iconFamily} icon-${iconObj.iconName}`, style, role: 'img', 'aria-label': accessibility.altText || obj.purpose });
  html.raw(`<!-- ${iconObj.iconName} -->`);
  html.close('span');

  if (accessibility.longDescription) {
    html.open('div', { id: `${obj.id}-desc`, class: 'sr-only' });
    html.raw(accessibility.longDescription);
    html.close('div');
  }

  return html.toString();
}

function renderChartObject(obj: DocumentObject, project: DocumentProject, style: string, html: HTMLBuilder): string {
  const chartObj = obj as any; // ChartObject
  const chart = project.charts[chartObj.chartId];
  const accessibility = obj.accessibility;

  if (!chart) {
    html.open('div', { id: obj.id, class: 'object object-chart missing', style });
    html.raw('Chart not found');
    html.close('div');
    return html.toString();
  }

  html.open('figure', { id: obj.id, class: 'object object-chart', style });

  // Render SVG chart
  if (chart.geometry) {
    const svg = generateChartSVG(chart);
    html.raw(svg);
  }

  // Accessible table
  html.open('table', { class: 'chart-data-table', 'aria-hidden': 'true' });
  html.open('caption', { class: 'sr-only' });
  html.raw(`${chart.spec.title} - Data Table`);
  html.close('caption');
  html.raw(generateChartTable(chart, project));
  html.close('table');

  // Narrative
  if (accessibility.longDescription) {
    html.open('figcaption', { id: `${obj.id}-desc`, class: 'sr-only' });
    html.raw(accessibility.longDescription);
    html.close('figcaption');
  }

  html.close('figure');

  return html.toString();
}

function renderDiagramObject(obj: DocumentObject, project: DocumentProject, style: string, html: HTMLBuilder): string {
  const diagramObj = obj as any; // DiagramObject
  const diagram = project.diagrams[diagramObj.diagramId];
  const accessibility = obj.accessibility;

  if (!diagram) {
    html.open('div', { id: obj.id, class: 'object object-diagram missing', style });
    html.raw('Diagram not found');
    html.close('div');
    return html.toString();
  }

  html.open('figure', { id: obj.id, class: 'object object-diagram', style });

  // Render SVG diagram
  const svg = generateDiagramSVG(diagram);
  html.raw(svg);

  // Accessible node list
  html.open('nav', { class: 'diagram-nodes sr-only', 'aria-label': 'Diagram nodes' });
  html.open('ul');
  for (const node of diagram.nodes) {
    html.open('li');
    html.raw(`${node.label} (${node.type})`);
    const outgoing = diagram.edges.filter(e => e.from === node.id);
    if (outgoing.length > 0) {
      html.raw(' → ');
      html.raw(outgoing.map(e => {
        const target = diagram.nodes.find(n => n.id === e.to);
        return `${e.label || ''} ${target?.label || e.to}`;
      }).join(', '));
    }
    html.close('li');
  }
  html.close('ul');
  html.close('nav');

  if (accessibility.longDescription) {
    html.open('figcaption', { id: `${obj.id}-desc`, class: 'sr-only' });
    html.raw(accessibility.longDescription);
    html.close('figcaption');
  }

  html.close('figure');

  return html.toString();
}

function renderTableObject(obj: DocumentObject, style: string, html: HTMLBuilder): string {
  const tableObj = obj as any; // TableObject
  const accessibility = obj.accessibility;

  html.open('figure', { id: obj.id, class: 'object object-table', style });

  if (tableObj.caption) {
    html.tag('figcaption', { class: 'table-caption' }, tableObj.caption);
  }

  html.open('table', { class: 'data-table', role: 'table' });
  html.open('thead');
  html.open('tr');
  for (const header of tableObj.headers) {
    html.tag('th', { scope: 'col' }, header);
  }
  html.close('tr');
  html.close('thead');
  html.open('tbody');
  for (const row of tableObj.rows) {
    html.open('tr');
    for (const cell of row) {
      html.tag('td', {}, cell);
    }
    html.close('tr');
  }
  html.close('tbody');
  html.close('table');

  if (accessibility.longDescription) {
    html.open('figcaption', { id: `${obj.id}-desc`, class: 'sr-only' });
    html.raw(accessibility.longDescription);
    html.close('figcaption');
  }

  html.close('figure');

  return html.toString();
}

function renderShapeObject(obj: DocumentObject, style: string, html: HTMLBuilder): string {
  const shapeObj = obj as any; // ShapeObject
  const accessibility = obj.accessibility;

  html.open('div', { id: obj.id, class: `object object-shape shape-${shapeObj.shapeType}`, style, role: 'img', 'aria-label': accessibility.altText || obj.purpose });
  html.close('div');

  if (accessibility.longDescription) {
    html.open('div', { id: `${obj.id}-desc`, class: 'sr-only' });
    html.raw(accessibility.longDescription);
    html.close('div');
  }

  return html.toString();
}

// ============================================================================
// SVG Generation Helpers
// ============================================================================

function generateChartSVG(chart: Chart): string {
  const { spec, geometry } = chart;
  if (!geometry) return '<svg class="chart-svg" aria-hidden="true"></svg>';

  const width = 500;
  const height = 300;
  const margin = { top: 40, right: 40, bottom: 60, left: 60 };
  const plotWidth = width - margin.left - margin.right;
  const plotHeight = height - margin.top - margin.bottom;

  let svg = `<svg class="chart-svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" aria-hidden="true" role="img">`;

  // Title
  svg += `<title>${spec.title}</title>`;

  // Axes
  svg += `<g class="axes" transform="translate(${margin.left},${margin.top})">`;

  // Y axis
  svg += `<line class="axis y" x1="0" y1="0" x2="0" y2="${plotHeight}" />`;
  // X axis
  svg += `<line class="axis x" x1="0" y1="${plotHeight}" x2="${plotWidth}" y2="${plotHeight}" />`;

  // Grid lines
  if (spec.type === 'horizontal_bar' || spec.type === 'vertical_bar') {
    // Bar chart
    const barWidth = plotWidth / Math.max(1, geometry.bars.length);
    for (let i = 0; i < geometry.bars.length; i++) {
      const bar = geometry.bars[i];
      const series = spec.series[bar.seriesIndex];
      const x = i * barWidth + barWidth * 0.1;
      const w = barWidth * 0.8;
      const h = bar.h;

      svg += `<rect class="bar series-${bar.seriesIndex}" x="${x}" y="${plotHeight - h}" width="${w}" height="${h}" fill="${series.color}" />`;
    }
  } else if (spec.type === 'line') {
    // Line chart
    for (let i = 0; i < geometry.lines.length; i++) {
      const line = geometry.lines[i];
      const series = spec.series[line.seriesIndex];
      const points = line.points.map(p => `${p.x},${plotHeight - p.y}`).join(' ');
      svg += `<polyline class="line series-${i}" points="${points}" stroke="${series.color}" stroke-width="2" fill="none" />`;
    }
  }

  svg += '</g></svg>';
  return svg;
}

function generateDiagramSVG(diagram: Diagram): string {
  const bounds = getDiagramBounds(diagram);
  const padding = 40;

  let svg = `<svg class="diagram-svg" width="${bounds.w + 2 * padding}" height="${bounds.h + 2 * padding}" viewBox="${bounds.x - padding} ${bounds.y - padding} ${bounds.w + 2 * padding} ${bounds.h + 2 * padding}" aria-hidden="true" role="img">`;
  svg += `<title>${diagram.type}</title>`;

  // Edges
  for (const edge of diagram.edges) {
    const from = diagram.nodes.find(n => n.id === edge.from);
    const to = diagram.nodes.find(n => n.id === edge.to);
    if (!from || !to) continue;

    const fromX = from.bounds.x + from.bounds.w / 2;
    const fromY = from.bounds.y + from.bounds.h / 2;
    const toX = to.bounds.x + to.bounds.w / 2;
    const toY = to.bounds.y + to.bounds.h / 2;

    svg += `<line class="edge" x1="${fromX}" y1="${fromY}" x2="${toX}" y2="${toY}" stroke="currentColor" stroke-width="2" />`;

    // Arrowhead
    const angle = Math.atan2(toY - fromY, toX - fromX);
    const arrowSize = 8;
    const arrowX = toX - Math.cos(angle) * (to.bounds.w / 2 + 4);
    const arrowY = toY - Math.sin(angle) * (to.bounds.h / 2 + 4);
    svg += `<polygon class="arrowhead" points="${arrowX},${arrowY} ${arrowX - Math.cos(angle - Math.PI / 6) * arrowSize},${arrowY - Math.sin(angle - Math.PI / 6) * arrowSize} ${arrowX - Math.cos(angle + Math.PI / 6) * arrowSize},${arrowY - Math.sin(angle + Math.PI / 6) * arrowSize}" fill="currentColor" />`;

    if (edge.label) {
      const midX = (fromX + toX) / 2;
      const midY = (fromY + toY) / 2;
      svg += `<text class="edge-label" x="${midX}" y="${midY}" text-anchor="middle">${edge.label}</text>`;
    }
  }

  // Nodes
  for (const node of diagram.nodes) {
    svg += `<rect class="node node-${node.type}" x="${node.bounds.x}" y="${node.bounds.y}" width="${node.bounds.w}" height="${node.bounds.h}" rx="4" ry="4" stroke="currentColor" stroke-width="2" fill="white" />`;
    svg += `<text class="node-label" x="${node.bounds.x + node.bounds.w / 2}" y="${node.bounds.y + node.bounds.h / 2}" text-anchor="middle" dominant-baseline="middle">${node.label}</text>`;
  }

  svg += '</svg>';
  return svg;
}

function getDiagramBounds(diagram: Diagram): Bounds {
  if (diagram.nodes.length === 0) return { x: 0, y: 0, w: 400, h: 300 };
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const node of diagram.nodes) {
    minX = Math.min(minX, node.bounds.x);
    minY = Math.min(minY, node.bounds.y);
    maxX = Math.max(maxX, node.bounds.x + node.bounds.w);
    maxY = Math.max(maxY, node.bounds.y + node.bounds.h);
  }
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}

function generateChartTable(chart: Chart, project: DocumentProject): string {
  const dataset = project.datasets[chart.spec.datasetId];
  if (!dataset) return '';

  let html = '<thead><tr>';
  for (const col of dataset.columns) {
    html += `<th scope="col">${col.name}</th>`;
  }
  html += '</tr></thead><tbody>';

  for (let row = 0; row < dataset.rowCount; row++) {
    html += '<tr>';
    for (const col of dataset.columns) {
      const val = col.values[row];
      html += `<td>${val ?? ''}</td>`;
    }
    html += '</tr>';
  }

  html += '</tbody>';
  return html;
}

// ============================================================================
// Template Regions
// ============================================================================

interface TemplateRegion {
  name: string;
  bounds: Bounds;
}

function getTemplateRegions(template: PageTemplate): TemplateRegion[] {
  const margin = 72;
  const contentWidth = 595 - 2 * margin;
  const contentHeight = 842 - 2 * margin;

  const regions: Record<PageTemplate, TemplateRegion[]> = {
    cover: [
      { name: 'title', bounds: { x: margin, y: margin, w: contentWidth, h: contentHeight * 0.4 } },
      { name: 'subtitle', bounds: { x: margin, y: margin + contentHeight * 0.4, w: contentWidth, h: contentHeight * 0.2 } },
      { name: 'image', bounds: { x: margin, y: margin + contentHeight * 0.6, w: contentWidth, h: contentHeight * 0.3 } },
      { name: 'footer', bounds: { x: margin, y: margin + contentHeight * 0.9, w: contentWidth, h: contentHeight * 0.1 } },
    ],
    'text-led': [
      { name: 'header', bounds: { x: margin, y: margin, w: contentWidth, h: 60 } },
      { name: 'content', bounds: { x: margin, y: margin + 60, w: contentWidth, h: contentHeight - 120 } },
      { name: 'footer', bounds: { x: margin, y: 842 - margin - 60, w: contentWidth, h: 60 } },
    ],
    'text-side-image': [
      { name: 'header', bounds: { x: margin, y: margin, w: contentWidth, h: 60 } },
      { name: 'text', bounds: { x: margin, y: margin + 60, w: contentWidth * 0.6, h: contentHeight - 120 } },
      { name: 'image', bounds: { x: margin + contentWidth * 0.65, y: margin + 60, w: contentWidth * 0.35, h: contentHeight - 120 } },
      { name: 'footer', bounds: { x: margin, y: 842 - margin - 60, w: contentWidth, h: 60 } },
    ],
    'full-width-image-caption': [
      { name: 'header', bounds: { x: margin, y: margin, w: contentWidth, h: 60 } },
      { name: 'image', bounds: { x: margin, y: margin + 60, w: contentWidth, h: contentHeight * 0.6 } },
      { name: 'caption', bounds: { x: margin, y: margin + 60 + contentHeight * 0.6, w: contentWidth, h: 80 } },
      { name: 'footer', bounds: { x: margin, y: 842 - margin - 60, w: contentWidth, h: 60 } },
    ],
    statistics: [
      { name: 'header', bounds: { x: margin, y: margin, w: contentWidth, h: 60 } },
      { name: 'stats-grid', bounds: { x: margin, y: margin + 60, w: contentWidth, h: contentHeight - 120 } },
      { name: 'footer', bounds: { x: margin, y: 842 - margin - 60, w: contentWidth, h: 60 } },
    ],
    chart: [
      { name: 'header', bounds: { x: margin, y: margin, w: contentWidth, h: 60 } },
      { name: 'chart', bounds: { x: margin, y: margin + 60, w: contentWidth, h: contentHeight - 120 } },
      { name: 'footer', bounds: { x: margin, y: 842 - margin - 60, w: contentWidth, h: 60 } },
    ],
    diagram: [
      { name: 'header', bounds: { x: margin, y: margin, w: contentWidth, h: 60 } },
      { name: 'diagram', bounds: { x: margin, y: margin + 60, w: contentWidth, h: contentHeight - 120 } },
      { name: 'footer', bounds: { x: margin, y: 842 - margin - 60, w: contentWidth, h: 60 } },
    ],
    'participant-story': [
      { name: 'header', bounds: { x: margin, y: margin, w: contentWidth, h: 60 } },
      { name: 'quote', bounds: { x: margin, y: margin + 60, w: contentWidth, h: 150 } },
      { name: 'content', bounds: { x: margin, y: margin + 210, w: contentWidth, h: contentHeight - 270 } },
      { name: 'footer', bounds: { x: margin, y: 842 - margin - 60, w: contentWidth, h: 60 } },
    ],
    recommendations: [
      { name: 'header', bounds: { x: margin, y: margin, w: contentWidth, h: 60 } },
      { name: 'list', bounds: { x: margin, y: margin + 60, w: contentWidth, h: contentHeight - 120 } },
      { name: 'footer', bounds: { x: margin, y: 842 - margin - 60, w: contentWidth, h: 60 } },
    ],
    'conclusion-contact': [
      { name: 'header', bounds: { x: margin, y: margin, w: contentWidth, h: 60 } },
      { name: 'conclusion', bounds: { x: margin, y: margin + 60, w: contentWidth, h: contentHeight * 0.5 } },
      { name: 'contact', bounds: { x: margin, y: margin + 60 + contentHeight * 0.5, w: contentWidth, h: contentHeight * 0.5 - 60 } },
      { name: 'footer', bounds: { x: margin, y: 842 - margin - 60, w: contentWidth, h: 60 } },
    ],
  };

  return regions[template] || regions['text-led'];
}

// ============================================================================
// Style Generation
// ============================================================================

function generateGlobalStyles(project: DocumentProject): string {
  const theme = project.theme;
  const colors = theme.colors || {};
  const fonts = theme.fonts || {};

  return `
    :root {
      --color-primary: ${colors.primary || '#1a1a2e'};
      --color-secondary: ${colors.secondary || '#16213e'};
      --color-accent: ${colors.accent || '#e94560'};
      --color-background: ${colors.background || '#ffffff'};
      --color-text: ${colors.text || '#1a1a2e'};
      --color-text-muted: ${colors.textMuted || '#666666'};
      --color-border: ${colors.border || '#e0e0e0'};
      --font-primary: ${fonts.primary || 'system-ui, -apple-system, sans-serif'};
      --font-heading: ${fonts.heading || 'Georgia, serif'};
      --font-mono: ${fonts.mono || 'monospace'};
      --spacing-unit: ${theme.spacing?.unit || 8}px;
      --container-width: 595px;
      --page-margin: 72px;
    }

    * { box-sizing: border-box; }
    body { margin: 0; font-family: var(--font-primary); color: var(--color-text); background: var(--color-background); line-height: 1.5; }
    .sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; border: 0; }
    .skip-link { position: absolute; top: -40px; left: 0; background: var(--color-primary); color: white; padding: 8px 16px; z-index: 100; text-decoration: none; }
    .skip-link:focus { top: 0; }
    main { max-width: var(--container-width); margin: 0 auto; padding: var(--page-margin); }
    .page { position: relative; width: 100%; min-height: 842px; margin-bottom: 48px; background: white; box-shadow: 0 2px 8px rgba(0,0,0,0.1); page-break-after: always; }
    .region { position: relative; }
    .object { position: absolute; }
    .object-text { overflow: hidden; }
    .object-text h1 { font-size: 2.5rem; font-family: var(--font-heading); margin: 0.5rem 0; }
    .object-text h2 { font-size: 2rem; font-family: var(--font-heading); margin: 0.5rem 0; }
    .object-text h3 { font-size: 1.5rem; font-family: var(--font-heading); margin: 0.5rem 0; }
    .object-text h4 { font-size: 1.25rem; font-family: var(--font-heading); margin: 0.5rem 0; }
    .object-text p { margin: 0.5rem 0; }
    .object-text ul, .object-text ol { margin: 0.5rem 0; padding-left: 1.5rem; }
    .object-text li { margin: 0.25rem 0; }
    .object-text blockquote { border-left: 4px solid var(--color-accent); padding-left: 1rem; margin: 1rem 0; font-style: italic; }
    .object-text figcaption { font-size: 0.875rem; color: var(--color-text-muted); margin-top: 0.5rem; }
    .object-image img { max-width: 100%; height: auto; display: block; }
    .object-table table { width: 100%; border-collapse: collapse; }
    .object-table th, .object-table td { border: 1px solid var(--color-border); padding: 8px; text-align: left; }
    .object-table caption { caption-side: top; font-weight: bold; margin-bottom: 0.5rem; }
    .chart-svg, .diagram-svg { max-width: 100%; height: auto; }
    .chart-data-table { width: 100%; border-collapse: collapse; margin-top: 1rem; font-size: 0.75rem; }
    .chart-data-table th, .chart-data-table td { border: 1px solid var(--color-border); padding: 4px; text-align: left; }
    .diagram-nodes ul { list-style: none; padding: 0; }
    .diagram-nodes li { padding: 4px 0; font-size: 0.875rem; }
    @media print { .page { box-shadow: none; margin: 0; page-break-after: always; } body { background: white; } }
  `;
}

function generatePageStyles(layout: ResolvedLayout): string {
  // Template-specific styles could go here
  return '';
}

// ============================================================================
// HTML Builder Utility
// ============================================================================

class HTMLBuilder {
  private parts: string[] = [];
  private indent = 0;
  private readonly indentStr = '  ';

  open(tag: string, attrs: Record<string, string | number | boolean | undefined> = {}): this {
    this.parts.push(`${this.indentStr.repeat(this.indent)}<${tag}${this.formatAttrs(attrs)}>`);
    this.indent++;
    return this;
  }

  close(tag: string): this {
    this.indent--;
    this.parts.push(`${this.indentStr.repeat(this.indent)}</${tag}>`);
    return this;
  }

  tag(tag: string, attrs: Record<string, string | number | boolean | undefined>, content: string): this {
    this.parts.push(`${this.indentStr.repeat(this.indent)}<${tag}${this.formatAttrs(attrs)}>${content}</${tag}>`);
    return this;
  }

  raw(html: string): this {
    this.parts.push(html);
    return this;
  }

  toString(): string {
    return this.parts.join('\n');
  }

  private formatAttrs(attrs: Record<string, string | number | boolean | undefined>): string {
    return Object.entries(attrs)
      .filter(([, v]) => v !== undefined && v !== false)
      .map(([k, v]) => v === true ? ` ${k}` : ` ${k}="${v}"`)
      .join('');
  }
}

// ============================================================================
// Export Bundle
// ============================================================================

export interface ExportBundle {
  html: string;
  assets: Array<{ id: string; type: string; data: Uint8Array; filename: string }>;
  manifest: string; // JSON manifest
}

export function createExportBundle(project: DocumentProject, layout: ResolvedLayout): ExportBundle {
  const html = renderProjectHTML(project, layout);

  // Collect assets
  const assets: ExportBundle['assets'] = [];
  for (const asset of Object.values(project.assets)) {
    assets.push({
      id: asset.id,
      type: asset.mimeType,
      data: new Uint8Array(), // Would be filled from blob
      filename: asset.fileName,
    });
  }

  // Generate manifest
  const manifest = JSON.stringify({
    projectId: project.id,
    title: project.title,
    version: project.currentVersion,
    pageCount: project.pageOrder.length,
    objectCount: Object.keys(project.objects).length,
    assetCount: Object.keys(project.assets).length,
    generatedAt: new Date().toISOString(),
  }, null, 2);

  return { html, assets, manifest };
}