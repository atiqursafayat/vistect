// ============================================================================
// PDF Renderer — deterministic output from resolved layout
// ============================================================================
//
// Renders the *same* `ResolvedLayout` the HTML preview uses, so a blind author who
// approved the preview gets a PDF with matching geometry (ADR-003, AC F-5.x §1).
//
// Determinism requirements:
//   - No `Date.now()`; timestamps come from the project.
//   - Iteration follows `layout.pages` and z-order, never object key order.
//   - Only the 14 standard PDF fonts, so no font file can vary the output.
//
// Coordinate systems differ: layout is top-left origin (like the DOM), PDF is
// bottom-left. `toPdfY` is the single conversion point.


import type {
  Chart,
  Diagram,
  DocumentObject,
  DocumentProject,
} from '@vistect/domain/schema';
import type { ResolvedLayout, ResolvedObject, ResolvedPage } from '@vistect/render-html';
import { PAGE_SIZE } from '@vistect/render-html';
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from 'pdf-lib';

const PAGE_WIDTH = PAGE_SIZE.width;
const PAGE_HEIGHT = PAGE_SIZE.height;

/** Reserved band at the page foot for the page number. */
const FOOTER_BAND = 36;

export interface PDFRenderOptions {
  /** Embed document metadata (title, subject, keywords). Default true. */
  includeMetadata?: boolean;
  /** Use PDF object streams to reduce size. Default true. */
  compress?: boolean;
}

interface FontSet {
  regular: PDFFont;
  bold: PDFFont;
  oblique: PDFFont;
  boldOblique: PDFFont;
}

/** Text style for one object role. */
interface TextStyle {
  font: PDFFont;
  size: number;
  leading: number;
  color: ReturnType<typeof rgb>;
  /** Left indent in points, e.g. for list markers. */
  indent: number;
}

export async function renderProjectPDF(
  project: DocumentProject,
  layout: ResolvedLayout,
  options: PDFRenderOptions = {}
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();

  if (options.includeMetadata !== false) {
    pdfDoc.setTitle(project.title);
    pdfDoc.setSubject(project.intentContract.purpose);
    pdfDoc.setKeywords([
      project.documentType,
      project.language,
      ...project.intentContract.requiredVisuals,
    ]);
    pdfDoc.setAuthor('Vistect');
    pdfDoc.setCreator('Vistect');
    // Project timestamps, not wall-clock: two exports of one version must be
    // byte-identical so the manifest hash is meaningful.
    pdfDoc.setCreationDate(new Date(project.createdAt));
    pdfDoc.setModificationDate(new Date(project.updatedAt));
  }

  pdfDoc.setLanguage(project.language);

  const fonts: FontSet = {
    regular: await pdfDoc.embedFont(StandardFonts.Helvetica),
    bold: await pdfDoc.embedFont(StandardFonts.HelveticaBold),
    oblique: await pdfDoc.embedFont(StandardFonts.HelveticaOblique),
    boldOblique: await pdfDoc.embedFont(StandardFonts.HelveticaBoldOblique),
  };

  for (const pageLayout of layout.pages) {
    const page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    renderPage(page, pageLayout, project, fonts);
  }

  const pages = pdfDoc.getPages();
  for (const [index, page] of pages.entries()) {
    drawPageNumber(page, index + 1, pages.length, fonts.regular);
  }

  return pdfDoc.save({
    useObjectStreams: options.compress !== false,
    addDefaultPage: false,
  });
}

/** Converts a top-left-origin y plus height into a PDF bottom-left origin y. */
function toPdfY(y: number, height: number): number {
  return PAGE_HEIGHT - y - height;
}

function renderPage(
  page: PDFPage,
  pageLayout: ResolvedPage,
  project: DocumentProject,
  fonts: FontSet
): void {
  // Ascending z-index so higher layers paint last.
  const ordered = [...pageLayout.objects].sort((a, b) => a.zIndex - b.zIndex);
  for (const resolved of ordered) {
    renderObject(page, resolved, project, fonts);
  }
}

function renderObject(
  page: PDFPage,
  resolved: ResolvedObject,
  project: DocumentProject,
  fonts: FontSet
): void {
  const { object, resolvedBounds } = resolved;
  const x = resolvedBounds.x;
  const y = toPdfY(resolvedBounds.y, resolvedBounds.h);
  const w = resolvedBounds.w;
  const h = resolvedBounds.h;

  switch (object.kind) {
    case 'text':
      drawTextObject(page, object, x, y, w, h, fonts);
      break;
    case 'image':
      drawImagePlaceholder(page, object, project, x, y, w, h, fonts);
      break;
    case 'chart':
      drawChartObject(page, object, project, x, y, w, h, fonts);
      break;
    case 'diagram':
      drawDiagramObject(page, object, project, x, y, w, h, fonts);
      break;
    case 'table':
      drawTableObject(page, object, x, y, w, h, fonts);
      break;
    case 'icon':
    case 'shape':
      drawOutlinePlaceholder(page, `${object.kind}: ${object.purpose}`, x, y, w, h, fonts);
      break;
  }
}

// ============================================================================
// Text
// ============================================================================

/** Heading point sizes by level. */
const HEADING_SIZES: Readonly<Record<1 | 2 | 3 | 4, number>> = { 1: 20, 2: 18, 3: 14, 4: 12 };

function textStyleFor(
  object: Extract<DocumentObject, { kind: 'text' }>,
  fonts: FontSet
): TextStyle {
  const body = { font: fonts.regular, size: 10, leading: 14, color: rgb(0.1, 0.1, 0.1), indent: 0 };

  switch (object.role) {
    case 'heading': {
      const level = Math.min(4, Math.max(1, object.headingLevel ?? 1)) as 1 | 2 | 3 | 4;
      const size = HEADING_SIZES[level];
      return { font: fonts.bold, size, leading: size * 1.3, color: rgb(0.1, 0.1, 0.2), indent: 0 };
    }
    case 'quotation':
      return { ...body, font: fonts.oblique, color: rgb(0.2, 0.2, 0.3), indent: 16 };
    case 'callout':
      return { ...body, color: rgb(0.15, 0.15, 0.25), indent: 8 };
    case 'statistic-card':
      return { font: fonts.bold, size: 14, leading: 18, color: rgb(0.1, 0.1, 0.1), indent: 0 };
    case 'caption':
      // 0.42 luminance against white is ~4.6:1, clearing WCAG AA for small text.
      return { font: fonts.oblique, size: 9, leading: 12, color: rgb(0.35, 0.35, 0.35), indent: 0 };
    case 'footnote':
    case 'source-note':
      return { font: fonts.regular, size: 8, leading: 11, color: rgb(0.35, 0.35, 0.35), indent: 0 };
    case 'hyperlink':
      return { ...body, color: rgb(0, 0.25, 0.65) };
    case 'bulleted-list':
    case 'numbered-list':
      return { ...body, indent: 16 };
    case 'paragraph':
    case 'page-break':
    case 'section-break':
      return body;
  }
}

function drawTextObject(
  page: PDFPage,
  object: Extract<DocumentObject, { kind: 'text' }>,
  x: number,
  y: number,
  w: number,
  h: number,
  fonts: FontSet
): void {
  const style = textStyleFor(object, fonts);
  const isList = object.role === 'bulleted-list' || object.role === 'numbered-list';
  const availableWidth = w - style.indent - 8;

  // Each list item gets its own marker. The previous implementation wrapped all
  // items into one string and marked only the first line, so a multi-item list
  // rendered as a single bullet.
  const segments: { marker: string; text: string }[] = isList
    ? (object.listItems ?? [object.content]).map((item, index) => ({
        marker: object.role === 'bulleted-list' ? '•  ' : `${index + 1}.  `,
        text: item,
      }))
    : [{ marker: '', text: object.content }];

  let cursorY = y + h - style.leading;

  for (const segment of segments) {
    const markerWidth =
      segment.marker === '' ? 0 : style.font.widthOfTextAtSize(segment.marker, style.size);
    const lines = wrapText(segment.text, style.font, style.size, availableWidth - markerWidth);

    for (const [lineIndex, line] of lines.entries()) {
      // Stop at the object's own lower edge; overflow was already reported as a
      // layout diagnostic, so silently continuing would overlap neighbours.
      if (cursorY < y) return;

      const prefix = lineIndex === 0 ? segment.marker : ' '.repeat(segment.marker.length);
      page.drawText(prefix + line, {
        x: x + style.indent,
        y: cursorY,
        size: style.size,
        font: style.font,
        color: style.color,
      });
      cursorY -= style.leading;
    }
  }
}

/**
 * Greedy word wrap using the embedded font's real metrics.
 *
 * A single word wider than the line is emitted on its own line rather than
 * dropped, so content is never silently lost.
 */
function wrapText(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  if (text === '') return [];

  const lines: string[] = [];
  let current = '';

  for (const word of text.split(/\s+/)) {
    if (word === '') continue;
    const candidate = current === '' ? word : `${current} ${word}`;

    if (font.widthOfTextAtSize(candidate, size) > maxWidth && current !== '') {
      lines.push(current);
      current = word;
    } else {
      current = candidate;
    }
  }

  if (current !== '') lines.push(current);
  return lines;
}

// ============================================================================
// Images
// ============================================================================

/**
 * Draws an outlined box naming the image.
 *
 * Embedding pixels requires the asset blob, which lives in IndexedDB and is not
 * reachable from this pure package. `apps/web` embeds real images before calling
 * this renderer; until then a labelled box makes the omission visible in the PDF
 * rather than leaving an unexplained gap.
 */
function drawImagePlaceholder(
  page: PDFPage,
  object: Extract<DocumentObject, { kind: 'image' }>,
  project: DocumentProject,
  x: number,
  y: number,
  w: number,
  h: number,
  fonts: FontSet
): void {
  const asset = project.assets[object.assetId];
  const label =
    asset === undefined
      ? `Missing image asset ${object.assetId}`
      : `Image: ${object.altTextApproved ?? asset.fileName}`;

  drawOutlinePlaceholder(page, label, x, y, w, h, fonts);
}

function drawOutlinePlaceholder(
  page: PDFPage,
  label: string,
  x: number,
  y: number,
  w: number,
  h: number,
  fonts: FontSet
): void {
  page.drawRectangle({
    x,
    y,
    width: w,
    height: h,
    borderColor: rgb(0.7, 0.7, 0.7),
    borderWidth: 0.75,
  });

  const lines = wrapText(label, fonts.regular, 9, w - 8);
  let cursorY = y + h / 2 + (lines.length - 1) * 6;
  for (const line of lines.slice(0, 3)) {
    page.drawText(line, {
      x: x + 4,
      y: cursorY,
      size: 9,
      font: fonts.regular,
      color: rgb(0.35, 0.35, 0.35),
    });
    cursorY -= 12;
  }
}

// ============================================================================
// Charts
// ============================================================================

function drawChartObject(
  page: PDFPage,
  object: Extract<DocumentObject, { kind: 'chart' }>,
  project: DocumentProject,
  x: number,
  y: number,
  w: number,
  h: number,
  fonts: FontSet
): void {
  const chart = project.charts[object.chartId];
  if (chart === undefined) {
    drawOutlinePlaceholder(page, `Missing chart ${object.chartId}`, x, y, w, h, fonts);
    return;
  }

  page.drawText(chart.spec.title, {
    x: x + 8,
    y: y + h - 16,
    size: 12,
    font: fonts.bold,
    color: rgb(0.1, 0.1, 0.1),
    maxWidth: w - 16,
  });

  const geometry = chart.geometry;
  if (geometry !== undefined) {
    // Geometry is reprojected, not recomputed: it is the geometry the integrity
    // checks verified against the data, so recomputing here could disagree with
    // what was approved.
    const plot = { x: x + 48, y: y + 28, w: w - 64, h: h - 60 };
    drawChartGeometry(page, chart, plot);
  }

  if (chart.spec.sourceNote !== undefined && chart.spec.sourceNote !== '') {
    page.drawText(chart.spec.sourceNote, {
      x: x + 8,
      y: y + 8,
      size: 7,
      font: fonts.oblique,
      color: rgb(0.35, 0.35, 0.35),
      maxWidth: w - 16,
    });
  }
}

/** Reprojects stored geometry into the given PDF plot rectangle. */
function drawChartGeometry(
  page: PDFPage,
  chart: Chart,
  plot: { x: number; y: number; w: number; h: number }
): void {
  const geometry = chart.geometry;
  if (geometry === undefined) return;

  const source = geometryExtent(chart);
  if (source.w <= 0 || source.h <= 0) return;

  const scaleX = plot.w / source.w;
  const scaleY = plot.h / source.h;

  // Geometry uses top-left origin; flip within the plot rectangle.
  const mapX = (gx: number) => plot.x + (gx - source.x) * scaleX;
  const mapY = (gy: number) => plot.y + plot.h - (gy - source.y) * scaleY;

  for (const bar of geometry.bars) {
    const series = chart.spec.series[bar.seriesIndex];
    page.drawRectangle({
      x: mapX(bar.x),
      y: mapY(bar.y + bar.h),
      width: Math.max(0.5, bar.w * scaleX),
      height: Math.max(0.5, bar.h * scaleY),
      color: hexToRgb(series?.color ?? '#333333'),
    });
  }

  for (const line of geometry.lines) {
    const series = chart.spec.series[line.seriesIndex];
    const color = hexToRgb(series?.color ?? '#333333');

    for (let i = 1; i < line.points.length; i++) {
      const from = line.points[i - 1];
      const to = line.points[i];
      if (from === undefined || to === undefined) continue;

      page.drawLine({
        start: { x: mapX(from.x), y: mapY(from.y) },
        end: { x: mapX(to.x), y: mapY(to.y) },
        thickness: 1.5,
        color,
      });
    }
  }

  page.drawLine({
    start: { x: plot.x, y: plot.y },
    end: { x: plot.x, y: plot.y + plot.h },
    thickness: 0.75,
    color: rgb(0.45, 0.45, 0.45),
  });
  page.drawLine({
    start: { x: plot.x, y: plot.y },
    end: { x: plot.x + plot.w, y: plot.y },
    thickness: 0.75,
    color: rgb(0.45, 0.45, 0.45),
  });
}

/** Bounding box of a chart's stored geometry, in geometry units. */
function geometryExtent(chart: Chart): { x: number; y: number; w: number; h: number } {
  const geometry = chart.geometry;
  if (geometry === undefined) return { x: 0, y: 0, w: 0, h: 0 };

  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;

  const include = (x: number, y: number): void => {
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  };

  for (const bar of geometry.bars) {
    include(bar.x, bar.y);
    include(bar.x + bar.w, bar.y + bar.h);
  }
  for (const line of geometry.lines) {
    for (const point of line.points) include(point.x, point.y);
  }
  include(geometry.axes.x.x, geometry.axes.x.y);
  include(geometry.axes.x.x + geometry.axes.x.w, geometry.axes.x.y);
  include(geometry.axes.y.x, geometry.axes.y.y);
  include(geometry.axes.y.x, geometry.axes.y.y + geometry.axes.y.h);

  if (!Number.isFinite(minX)) return { x: 0, y: 0, w: 0, h: 0 };
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}

// ============================================================================
// Diagrams
// ============================================================================

function drawDiagramObject(
  page: PDFPage,
  object: Extract<DocumentObject, { kind: 'diagram' }>,
  project: DocumentProject,
  x: number,
  y: number,
  w: number,
  h: number,
  fonts: FontSet
): void {
  const diagram = project.diagrams[object.diagramId];
  if (diagram === undefined) {
    drawOutlinePlaceholder(page, `Missing diagram ${object.diagramId}`, x, y, w, h, fonts);
    return;
  }
  if (diagram.nodes.length === 0) {
    drawOutlinePlaceholder(page, 'Diagram has no nodes', x, y, w, h, fonts);
    return;
  }

  const bounds = diagramExtent(diagram);
  const padding = 20;
  // Uniform scale preserves the layout's proportions; independent axis scales
  // would distort node shapes and invalidate the approved geometry.
  const scale = Math.min((w - 2 * padding) / bounds.w, (h - 2 * padding) / bounds.h);
  const offsetX = x + (w - bounds.w * scale) / 2;
  const offsetY = y + (h - bounds.h * scale) / 2;

  const mapX = (gx: number) => offsetX + (gx - bounds.x) * scale;
  const mapY = (gy: number) => offsetY + (bounds.h - (gy - bounds.y)) * scale;

  const nodesById = new Map(diagram.nodes.map((n) => [n.id, n]));

  for (const edge of diagram.edges) {
    const from = nodesById.get(edge.from);
    const to = nodesById.get(edge.to);
    if (from === undefined || to === undefined) continue;

    page.drawLine({
      start: {
        x: mapX(from.bounds.x + from.bounds.w / 2),
        y: mapY(from.bounds.y + from.bounds.h / 2),
      },
      end: { x: mapX(to.bounds.x + to.bounds.w / 2), y: mapY(to.bounds.y + to.bounds.h / 2) },
      thickness: 1,
      color: rgb(0.3, 0.3, 0.3),
    });
  }

  const labelSize = Math.max(6, 9 * scale);
  for (const node of diagram.nodes) {
    const nw = node.bounds.w * scale;
    const nh = node.bounds.h * scale;
    const nx = mapX(node.bounds.x);
    const ny = mapY(node.bounds.y + node.bounds.h);

    page.drawRectangle({
      x: nx,
      y: ny,
      width: nw,
      height: nh,
      borderColor: rgb(0.2, 0.2, 0.2),
      borderWidth: 1,
    });

    // Horizontally centred using measured width; `maxWidth` alone does not centre.
    const labelWidth = fonts.regular.widthOfTextAtSize(node.label, labelSize);
    page.drawText(node.label, {
      x: nx + Math.max(2, (nw - labelWidth) / 2),
      y: ny + nh / 2 - labelSize / 3,
      size: labelSize,
      font: fonts.regular,
      color: rgb(0.1, 0.1, 0.1),
      maxWidth: Math.max(4, nw - 4),
    });
  }
}

function diagramExtent(diagram: Diagram): { x: number; y: number; w: number; h: number } {
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

  // Guard against a zero-extent single node, which would make `scale` infinite.
  return {
    x: minX,
    y: minY,
    w: Math.max(1, maxX - minX),
    h: Math.max(1, maxY - minY),
  };
}

// ============================================================================
// Tables
// ============================================================================

function drawTableObject(
  page: PDFPage,
  object: Extract<DocumentObject, { kind: 'table' }>,
  x: number,
  y: number,
  w: number,
  h: number,
  fonts: FontSet
): void {
  if (object.headers.length === 0) return;

  const colWidth = w / object.headers.length;
  const headerHeight = 24;
  const rowHeight = 20;

  page.drawRectangle({
    x,
    y: y + h - headerHeight,
    width: w,
    height: headerHeight,
    color: rgb(0.94, 0.94, 0.94),
    borderColor: rgb(0.7, 0.7, 0.7),
    borderWidth: 0.75,
  });

  for (const [index, header] of object.headers.entries()) {
    page.drawText(header, {
      x: x + index * colWidth + 4,
      y: y + h - headerHeight + 8,
      size: 9,
      font: fonts.bold,
      color: rgb(0.1, 0.1, 0.1),
      maxWidth: colWidth - 8,
    });
  }

  for (const [rowIndex, row] of object.rows.entries()) {
    const rowY = y + h - headerHeight - (rowIndex + 1) * rowHeight;
    if (rowY < y) break;

    // Zebra striping starts on the first data row.
    if (rowIndex % 2 === 1) {
      page.drawRectangle({
        x,
        y: rowY,
        width: w,
        height: rowHeight,
        color: rgb(0.975, 0.975, 0.975),
      });
    }

    for (let colIndex = 0; colIndex < object.headers.length; colIndex++) {
      page.drawText(row[colIndex] ?? '', {
        x: x + colIndex * colWidth + 4,
        y: rowY + 6,
        size: 8,
        font: fonts.regular,
        color: rgb(0.15, 0.15, 0.15),
        maxWidth: colWidth - 8,
      });
    }

    page.drawLine({
      start: { x, y: rowY },
      end: { x: x + w, y: rowY },
      thickness: 0.5,
      color: rgb(0.8, 0.8, 0.8),
    });
  }

  for (let colIndex = 0; colIndex <= object.headers.length; colIndex++) {
    const lineX = x + colIndex * colWidth;
    page.drawLine({
      start: { x: lineX, y: Math.max(y, y + h - headerHeight - object.rows.length * rowHeight) },
      end: { x: lineX, y: y + h },
      thickness: 0.5,
      color: rgb(0.8, 0.8, 0.8),
    });
  }
}

// ============================================================================
// Page furniture
// ============================================================================

function drawPageNumber(
  page: PDFPage,
  pageNumber: number,
  totalPages: number,
  font: PDFFont
): void {
  const label = `${pageNumber} of ${totalPages}`;
  const size = 9;
  const width = font.widthOfTextAtSize(label, size);

  page.drawText(label, {
    // Centred using measured width; `x: PAGE_WIDTH / 2` left it visibly off-centre.
    x: (PAGE_WIDTH - width) / 2,
    y: FOOTER_BAND / 2,
    size,
    font,
    color: rgb(0.35, 0.35, 0.35),
  });
}

/** Parses `#rrggbb` (with or without `#`) into a pdf-lib colour. Black on failure. */
function hexToRgb(hex: string): ReturnType<typeof rgb> {
  const match = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex.trim());
  if (match === null) return rgb(0, 0, 0);

  const [, r, g, b] = match;
  return rgb(
    Number.parseInt(r ?? '00', 16) / 255,
    Number.parseInt(g ?? '00', 16) / 255,
    Number.parseInt(b ?? '00', 16) / 255
  );
}
