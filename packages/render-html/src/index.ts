// ============================================================================
// HTML Renderer - Semantic HTML Preview and Export Bundle
// ============================================================================
//
// One renderer serves both the in-app preview and the exported HTML companion,
// so what an author inspects is what ships (AC F-1.10 §1).
//
// Two rules govern this module:
//
//   1. Semantics come from the object model. A heading is an `<h1>`–`<h4>` because
//      `role === 'heading'`, not because of its size. Reading order is DOM order.
//   2. Every interpolated value is escaped. Document content is untrusted: it may
//      have been imported from a PDF or supplied by an agent.

import type {
  Chart,
  Dataset,
  Diagram,
  DocumentObject,
  DocumentProject,
} from '@vistect/domain/schema';
import { escapeXml } from '@vistect/domain/text';

import { HTMLBuilder } from './builder';
import { generateGlobalStyles, resolveLayout, type ResolvedLayout, type ResolvedObject } from './layout';

export * from './layout';
export { HTMLBuilder, type Attributes, type AttributeValue } from './builder';

/** Heading level → tag name. Levels are clamped to the h1–h4 range the spec allows. */
function headingTag(level: number): 'h1' | 'h2' | 'h3' | 'h4' {
  const clamped = Math.min(4, Math.max(1, Math.trunc(level)));
  return (['h1', 'h2', 'h3', 'h4'] as const)[clamped - 1] ?? 'h1';
}

/** Absolute positioning derived from resolved geometry, never from authored input. */
function positionStyle(resolved: ResolvedObject): string {
  const { x, y, w, h } = resolved.resolvedBounds;
  return `position:absolute;left:${x}px;top:${y}px;width:${w}px;height:${h}px;z-index:${resolved.zIndex};`;
}

export function renderProjectHTML(project: DocumentProject, layout: ResolvedLayout): string {
  const html = new HTMLBuilder();

  html.unsafeRaw('<!DOCTYPE html>');
  html.open('html', { lang: project.language });

  html.open('head');
  html.voidTag('meta', { charset: 'utf-8' });
  html.voidTag('meta', { name: 'viewport', content: 'width=device-width, initial-scale=1' });
  html.tag('title', {}, project.title);
  html.open('style');
  html.unsafeRaw(layout.globalStyles);
  html.close('style');
  html.close('head');

  html.open('body');

  // Skip links precede everything, so a keyboard user reaches landmarks in one tab.
  html.tag('a', { href: '#document-content', class: 'skip-link' }, 'Skip to document content');

  // Live regions for announcements (§21.3). Empty in the exported bundle; the app
  // writes into them at runtime.
  html.open('div', {
    id: 'live-polite',
    role: 'status',
    'aria-live': 'polite',
    'aria-atomic': 'true',
    class: 'sr-only',
  });
  html.close('div');
  html.open('div', {
    id: 'live-assertive',
    role: 'alert',
    'aria-live': 'assertive',
    'aria-atomic': 'true',
    class: 'sr-only',
  });
  html.close('div');

  html.open('main', { id: 'document-content' });
  html.tag('h1', { class: 'sr-only' }, project.title);

  for (const [index, page] of layout.pages.entries()) {
    html.open('section', {
      id: `page-${page.pageId}`,
      'aria-label': `Page ${index + 1} of ${layout.pages.length}`,
      class: 'page',
      'data-template': page.template,
    });

    // Objects are grouped by their resolved region, which is authoritative.
    // Grouping by coordinate containment (the previous approach) dropped any
    // object whose box crossed a region edge — it appeared in no region at all.
    for (const region of page.regions) {
      const inRegion = page.objects.filter((o) => o.regionName === region.name);
      if (inRegion.length === 0) continue;

      html.open('div', {
        class: `region region-${region.name}`,
        'data-region': region.name,
      });
      for (const resolved of inRegion) {
        html.unsafeRaw(renderObject(resolved, project));
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

function renderObject(resolved: ResolvedObject, project: DocumentProject): string {
  const { object } = resolved;
  const style = positionStyle(resolved);

  switch (object.kind) {
    case 'text':
      return renderTextObject(object, style);
    case 'image':
      return renderImageObject(object, project, style);
    case 'icon':
      return renderIconObject(object, style);
    case 'chart':
      return renderChartObject(object, project, style);
    case 'diagram':
      return renderDiagramObject(object, project, style);
    case 'table':
      return renderTableObject(object, style);
    case 'shape':
      return renderShapeObject(object, style);
  }
}

/** Long description in a visually hidden element, referenced by `aria-describedby`. */
function appendLongDescription(html: HTMLBuilder, object: DocumentObject): void {
  const description = object.accessibility.longDescription;
  if (description === undefined || description.trim() === '') return;

  html.open('div', { id: `${object.id}-desc`, class: 'sr-only' });
  html.text(description);
  html.close('div');
}

function describedBy(object: DocumentObject): string | undefined {
  const description = object.accessibility.longDescription;
  return description === undefined || description.trim() === '' ? undefined : `${object.id}-desc`;
}

function renderTextObject(object: Extract<DocumentObject, { kind: 'text' }>, style: string): string {
  const html = new HTMLBuilder();
  const { accessibility, role } = object;

  const attrs = {
    id: object.id,
    class: `object object-text object-${role}`,
    style,
    'data-role': role,
    // A decorative text object is hidden from assistive technology entirely;
    // `role="presentation"` alone would still expose its contents.
    ...(accessibility.isDecorative ? { 'aria-hidden': true } : {}),
    ...(describedBy(object) === undefined ? {} : { 'aria-describedby': describedBy(object) }),
  };

  switch (role) {
    case 'heading':
      html.tag(headingTag(object.headingLevel ?? 1), attrs, object.content);
      break;

    case 'bulleted-list':
    case 'numbered-list': {
      html.open(role === 'bulleted-list' ? 'ul' : 'ol', attrs);
      const items = object.listItems ?? [object.content];
      for (const item of items) {
        html.tag('li', {}, item);
      }
      html.close(role === 'bulleted-list' ? 'ul' : 'ol');
      break;
    }

    case 'quotation':
      html.open('blockquote', attrs);
      html.tag('p', {}, object.content);
      html.close('blockquote');
      break;

    case 'callout':
      // `<aside>` conveys "related but tangential", which is what a callout is.
      html.open('aside', attrs);
      html.tag('p', {}, object.content);
      html.close('aside');
      break;

    case 'statistic-card':
      html.open('div', attrs);
      html.tag('p', { class: 'statistic-value' }, object.content);
      html.close('div');
      break;

    case 'caption':
      html.tag('figcaption', attrs, object.content);
      break;

    case 'footnote':
      html.tag('p', { ...attrs, class: `${attrs.class} object-footnote` }, object.content);
      break;

    case 'source-note':
      html.tag('p', { ...attrs, class: `${attrs.class} object-source-note` }, object.content);
      break;

    case 'hyperlink':
      // `rel` is mandatory alongside `target="_blank"`: without `noopener` the
      // opened page can reach back through `window.opener`.
      html.tag(
        'a',
        {
          ...attrs,
          href: object.hyperlink,
          target: '_blank',
          rel: 'noopener noreferrer',
        },
        object.content
      );
      break;

    case 'page-break':
    case 'section-break':
      html.voidTag('hr', { ...attrs, 'aria-hidden': true });
      break;

    case 'paragraph':
      html.tag('p', attrs, object.content);
      break;

    default:
      html.tag('p', attrs, object.content);
  }

  appendLongDescription(html, object);
  return html.toString();
}

function renderImageObject(
  object: Extract<DocumentObject, { kind: 'image' }>,
  project: DocumentProject,
  style: string
): string {
  const html = new HTMLBuilder();
  const asset = project.assets[object.assetId];

  html.open('figure', { id: object.id, class: 'object object-image', style });

  if (asset === undefined) {
    // Reported rather than rendered as a broken image: a missing asset is a
    // validation finding, and a silent empty box is invisible to a screen reader.
    html.tag('p', { class: 'missing-asset' }, `Image asset ${object.assetId} not found`);
    html.close('figure');
    return html.toString();
  }

  // Decorative images take alt="" so assistive technology skips them; anything
  // else uses approved alt text (never the draft, which has not been reviewed).
  const alt = object.accessibility.isDecorative
    ? ''
    : (object.altTextApproved ?? object.accessibility.altText ?? object.purpose);

  html.voidTag('img', {
    src: `assets/${asset.id}-${asset.fileName}`,
    alt,
    width: asset.dimensions.width,
    height: asset.dimensions.height,
    loading: 'lazy',
    decoding: 'async',
    class: 'image-content',
    ...(object.accessibility.isDecorative ? { role: 'presentation' } : {}),
    ...(describedBy(object) === undefined ? {} : { 'aria-describedby': describedBy(object) }),
  });

  appendLongDescription(html, object);
  html.close('figure');
  return html.toString();
}

function renderIconObject(
  object: Extract<DocumentObject, { kind: 'icon' }>,
  style: string
): string {
  const html = new HTMLBuilder();
  const isDecorative = object.accessibility.isDecorative;

  html.open('span', {
    id: object.id,
    class: `object object-icon icon-${object.iconFamily} icon-${object.iconName}`,
    style,
    'data-icon': object.iconName,
    ...(isDecorative
      ? { 'aria-hidden': true }
      : {
          role: 'img',
          'aria-label': object.accessibility.altText ?? object.semanticAssignment ?? object.purpose,
        }),
  });
  html.close('span');

  appendLongDescription(html, object);
  return html.toString();
}

function renderChartObject(
  object: Extract<DocumentObject, { kind: 'chart' }>,
  project: DocumentProject,
  style: string
): string {
  const html = new HTMLBuilder();
  const chart = project.charts[object.chartId];

  html.open('figure', { id: object.id, class: 'object object-chart', style });

  if (chart === undefined) {
    html.tag('p', { class: 'missing-chart' }, `Chart ${object.chartId} not found`);
    html.close('figure');
    return html.toString();
  }

  const dataset = project.datasets[chart.spec.datasetId];

  // Table first in DOM order: it is the primary representation for screen reader
  // users, and the chart image is the secondary one (AC F-4.x §2).
  if (dataset !== undefined) {
    html.unsafeRaw(renderChartDataTable(chart, dataset));
  }

  if (chart.geometry !== undefined) {
    html.open('div', {
      class: 'chart-svg-container',
      role: 'img',
      'aria-label': object.accessibility.altText ?? chart.spec.title,
      ...(describedBy(object) === undefined ? {} : { 'aria-describedby': describedBy(object) }),
    });
    html.unsafeRaw(renderChartSVG(chart));
    html.close('div');
  }

  appendLongDescription(html, object);
  html.close('figure');
  return html.toString();
}

function renderDiagramObject(
  object: Extract<DocumentObject, { kind: 'diagram' }>,
  project: DocumentProject,
  style: string
): string {
  const html = new HTMLBuilder();
  const diagram = project.diagrams[object.diagramId];

  html.open('figure', { id: object.id, class: 'object object-diagram', style });

  if (diagram === undefined) {
    html.tag('p', { class: 'missing-diagram' }, `Diagram ${object.diagramId} not found`);
    html.close('figure');
    return html.toString();
  }

  // Node list precedes the drawing, for the same reason the chart table does.
  html.unsafeRaw(renderDiagramNodeList(diagram));

  html.open('div', {
    class: 'diagram-svg-container',
    role: 'img',
    'aria-label': object.accessibility.altText ?? `${diagram.type} diagram`,
    ...(describedBy(object) === undefined ? {} : { 'aria-describedby': describedBy(object) }),
  });
  html.unsafeRaw(renderDiagramSVG(diagram));
  html.close('div');

  appendLongDescription(html, object);
  html.close('figure');
  return html.toString();
}

function renderTableObject(
  object: Extract<DocumentObject, { kind: 'table' }>,
  style: string
): string {
  const html = new HTMLBuilder();

  html.open('figure', { id: object.id, class: 'object object-table', style });
  html.open('table', {
    ...(describedBy(object) === undefined ? {} : { 'aria-describedby': describedBy(object) }),
  });

  if (object.caption !== undefined && object.caption !== '') {
    html.tag('caption', {}, object.caption);
  }

  html.open('thead');
  html.open('tr');
  for (const header of object.headers) {
    html.tag('th', { scope: 'col' }, header);
  }
  html.close('tr');
  html.close('thead');

  html.open('tbody');
  for (const row of object.rows) {
    html.open('tr');
    for (const [index, cell] of row.entries()) {
      // The first cell is a row header, so a screen reader can announce
      // "<row>, <column>: <value>" while navigating the grid.
      if (index === 0) {
        html.tag('th', { scope: 'row' }, cell);
      } else {
        html.tag('td', {}, cell);
      }
    }
    html.close('tr');
  }
  html.close('tbody');
  html.close('table');

  appendLongDescription(html, object);
  html.close('figure');
  return html.toString();
}

function renderShapeObject(
  object: Extract<DocumentObject, { kind: 'shape' }>,
  style: string
): string {
  const html = new HTMLBuilder();
  const isDecorative = object.accessibility.isDecorative;

  html.open('div', {
    id: object.id,
    class: `object object-shape shape-${object.shapeType}`,
    style,
    ...(isDecorative
      ? { 'aria-hidden': true }
      : {
          role: 'img',
          'aria-label': object.accessibility.altText ?? object.purpose,
        }),
  });
  html.close('div');

  appendLongDescription(html, object);
  return html.toString();
}

// ============================================================================
// SVG and table fragments
// ============================================================================

/**
 * Chart SVG from stored geometry.
 *
 * Geometry is used verbatim — it is the same geometry the integrity checks
 * verified against the data, so re-deriving positions here could disagree with
 * what was approved.
 */
function renderChartSVG(chart: Chart): string {
  const geometry = chart.geometry;
  if (geometry === undefined) return '';

  const width = 500;
  const height = 300;
  const parts = [
    `<svg class="chart-svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" aria-hidden="true" focusable="false">`,
  ];

  parts.push(
    `<line class="axis axis-y" x1="${geometry.axes.y.x}" y1="${geometry.axes.y.y}" x2="${geometry.axes.y.x}" y2="${geometry.axes.y.y + geometry.axes.y.h}" stroke="currentColor" />`
  );
  parts.push(
    `<line class="axis axis-x" x1="${geometry.axes.x.x}" y1="${geometry.axes.x.y}" x2="${geometry.axes.x.x + geometry.axes.x.w}" y2="${geometry.axes.x.y}" stroke="currentColor" />`
  );

  for (const bar of geometry.bars) {
    const series = chart.spec.series[bar.seriesIndex];
    const fill = series?.color ?? 'currentColor';
    parts.push(
      `<rect class="bar series-${bar.seriesIndex}" x="${bar.x}" y="${bar.y}" width="${bar.w}" height="${bar.h}" fill="${fill}" />`
    );
  }

  for (const line of geometry.lines) {
    const series = chart.spec.series[line.seriesIndex];
    const stroke = series?.color ?? 'currentColor';
    const points = line.points.map((p) => `${p.x},${p.y}`).join(' ');
    parts.push(
      `<polyline class="line series-${line.seriesIndex}" points="${points}" stroke="${stroke}" stroke-width="2" fill="none" />`
    );
  }

  parts.push('</svg>');
  return parts.join('');
}

function renderChartDataTable(chart: Chart, dataset: Dataset): string {
  const html = new HTMLBuilder();

  html.open('table', { class: 'chart-data-table' });
  html.tag('caption', {}, `${chart.spec.title} — data table`);

  html.open('thead');
  html.open('tr');
  for (const column of dataset.columns) {
    html.tag('th', { scope: 'col' }, column.name);
  }
  html.close('tr');
  html.close('thead');

  html.open('tbody');
  for (let row = 0; row < dataset.rowCount; row++) {
    html.open('tr');
    for (const [index, column] of dataset.columns.entries()) {
      const raw = column.values[row];
      const value =
        raw === undefined || raw === ''
          ? ''
          : raw instanceof Date
            ? (raw.toISOString().split('T')[0] ?? '')
            : String(raw);

      if (index === 0) {
        html.tag('th', { scope: 'row' }, value);
      } else {
        html.tag('td', {}, value);
      }
    }
    html.close('tr');
  }
  html.close('tbody');
  html.close('table');

  return html.toString();
}

function renderDiagramSVG(diagram: Diagram): string {
  const padding = 40;
  const bounds = diagramBounds(diagram);
  const width = bounds.w + 2 * padding;
  const height = bounds.h + 2 * padding;

  const parts = [
    `<svg class="diagram-svg" width="${width}" height="${height}" ` +
      `viewBox="${bounds.x - padding} ${bounds.y - padding} ${width} ${height}" aria-hidden="true" focusable="false">`,
  ];

  const nodesById = new Map(diagram.nodes.map((n) => [n.id, n]));

  for (const edge of diagram.edges) {
    const from = nodesById.get(edge.from);
    const to = nodesById.get(edge.to);
    if (from === undefined || to === undefined) continue;

    const fromX = from.bounds.x + from.bounds.w / 2;
    const fromY = from.bounds.y + from.bounds.h / 2;
    const toX = to.bounds.x + to.bounds.w / 2;
    const toY = to.bounds.y + to.bounds.h / 2;

    parts.push(
      `<line class="edge" x1="${fromX}" y1="${fromY}" x2="${toX}" y2="${toY}" stroke="currentColor" stroke-width="2" />`
    );

    if (edge.label !== undefined && edge.label !== '') {
      parts.push(
        `<text class="edge-label" x="${(fromX + toX) / 2}" y="${(fromY + toY) / 2}" text-anchor="middle">${escapeXml(edge.label)}</text>`
      );
    }
  }

  for (const node of diagram.nodes) {
    parts.push(
      `<rect class="node node-${node.type}" x="${node.bounds.x}" y="${node.bounds.y}" ` +
        `width="${node.bounds.w}" height="${node.bounds.h}" rx="4" ry="4" stroke="currentColor" stroke-width="2" fill="#ffffff" />`
    );
    parts.push(
      `<text class="node-label" x="${node.bounds.x + node.bounds.w / 2}" y="${node.bounds.y + node.bounds.h / 2}" ` +
        `text-anchor="middle" dominant-baseline="middle">${escapeXml(node.label)}</text>`
    );
  }

  parts.push('</svg>');
  return parts.join('');
}

function renderDiagramNodeList(diagram: Diagram): string {
  const html = new HTMLBuilder();
  const nodesById = new Map(diagram.nodes.map((n) => [n.id, n]));

  html.open('nav', { class: 'diagram-nodes', 'aria-label': 'Diagram nodes and connections' });
  html.open('ul');

  for (const node of diagram.nodes) {
    html.open('li');
    html.text(`${node.label} (${node.type})`);

    const outgoing = diagram.edges.filter((e) => e.from === node.id);
    if (outgoing.length > 0) {
      html.open('ul');
      for (const edge of outgoing) {
        const target = nodesById.get(edge.to);
        const targetLabel = target?.label ?? edge.to;
        html.tag(
          'li',
          {},
          edge.label !== undefined && edge.label !== ''
            ? `${edge.label}: leads to ${targetLabel}`
            : `leads to ${targetLabel}`
        );
      }
      html.close('ul');
    }

    html.close('li');
  }

  html.close('ul');
  html.close('nav');
  return html.toString();
}

function diagramBounds(diagram: Diagram): { x: number; y: number; w: number; h: number } {
  if (diagram.nodes.length === 0) return { x: 0, y: 0, w: 400, h: 300 };

  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;

  for (const node of diagram.nodes) {
    minX = Math.min(minX, node.bounds.x);
    minY = Math.min(minY, node.bounds.y);
    maxX = Math.max(maxX, node.bounds.x + node.bounds.w);
    maxY = Math.max(maxY, node.bounds.y + node.bounds.h);
  }

  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}

// ============================================================================
// Export Bundle
// ============================================================================

export interface BundleAsset {
  /** Path within the bundle, e.g. `assets/ast_abc-photo.jpg`. */
  path: string;
  assetId: string;
  mimeType: string;
  /** Content hash, for the export manifest (§28). */
  contentHash: string;
}

export interface ExportBundle {
  html: string;
  /** Asset manifest. Bytes are attached by the app, which owns blob storage. */
  assets: BundleAsset[];
  manifest: string;
}

/**
 * Builds the accessible HTML companion bundle.
 *
 * Asset *bytes* are not read here: this package is pure and has no storage
 * access. It emits the paths the HTML references, and `apps/web` fills them from
 * IndexedDB, which keeps the reference and the file name in one place.
 */
export function createExportBundle(
  project: DocumentProject,
  layout: ResolvedLayout = resolveLayout(project)
): ExportBundle {
  const html = renderProjectHTML(project, layout);

  const assets: BundleAsset[] = Object.values(project.assets)
    .filter((asset): asset is NonNullable<typeof asset> => asset !== undefined)
    .map((asset) => ({
      path: `assets/${asset.id}-${asset.fileName}`,
      assetId: asset.id,
      mimeType: asset.mimeType,
      contentHash: asset.contentHash,
    }));

  const manifest = JSON.stringify(
    {
      title: project.title,
      language: project.language,
      documentType: project.documentType,
      version: project.currentVersion,
      pageCount: layout.pages.length,
      assets: assets.map(({ path, contentHash, mimeType }) => ({ path, contentHash, mimeType })),
      layoutDiagnostics: layout.diagnostics,
      generatedAt: project.updatedAt,
    },
    null,
    2
  );

  return { html, assets, manifest };
}

/** Convenience: resolve layout and render in one call. */
export function renderProject(project: DocumentProject): string {
  return renderProjectHTML(project, resolveLayout(project));
}

export { generateGlobalStyles };
