// ============================================================================
// PDF Renderer - pdf-lib deterministic renderer from resolved layout
// ============================================================================

import { PDFDocument, rgb, StandardFonts, PDFFont, PDFPage, PDFImage, rgb as pdfRgb } from 'pdf-lib';
import type { DocumentProject, Bounds, PageTemplate } from '@vistect/domain/schema';
import type { ResolvedLayout, ResolvedPage, ResolvedObject } from '@vistect/render-html';

// ============================================================================
// PDF Constants
// ============================================================================

const A4_WIDTH = 595.28; // points (72 DPI)
const A4_HEIGHT = 841.89;
const MARGIN = 72; // 1 inch
const CONTENT_WIDTH = A4_WIDTH - 2 * MARGIN;
const CONTENT_HEIGHT = A4_HEIGHT - 2 * MARGIN;

// ============================================================================
// PDF Renderer
// ============================================================================

export interface PDFRenderOptions {
  includeMetadata?: boolean;
  embedFonts?: boolean;
  compress?: boolean;
}

export async function renderProjectPDF(
  project: DocumentProject,
  layout: ResolvedLayout,
  options: PDFRenderOptions = {}
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  pdfDoc.setTitle(project.title);
  pdfDoc.setSubject(project.intentContract.purpose);
  pdfDoc.setKeywords([project.documentType, project.language, ...project.intentContract.requiredVisuals]);
  pdfDoc.setAuthor('Vistect');
  pdfDoc.setCreator('Vistect WebMCP Workspace');
  pdfDoc.setCreationDate(new Date(project.createdAt));
  pdfDoc.setModificationDate(new Date(project.updatedAt));

  // Register fonts
  const regularFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const obliqueFont = await pdfDoc.embedFont(StandardFonts.HelveticaOblique);
  const boldObliqueFont = await pdfDoc.embedFont(StandardFonts.HelveticaBoldOblique);

  // Render each page
  for (let i = 0; i < layout.pages.length; i++) {
    const pageLayout = layout.pages[i];
    const page = pdfDoc.addPage([A4_WIDTH, A4_HEIGHT]);
    await renderPage(page, pageLayout, project, {
      regularFont,
      boldFont,
      obliqueFont,
      boldObliqueFont,
    });
  }

  // Add page numbers
  const pages = pdfDoc.getPages();
  for (let i = 0; i < pages.length; i++) {
    addPageNumber(pages[i], i + 1, pages.length, regularFont);
  }

  // Save
  const pdfBytes = await pdfDoc.save({
    useObjectStreams: options.compress !== false,
    addDefaultPage: false,
  });

  return pdfBytes;
}

interface FontSet {
  regularFont: PDFFont;
  boldFont: PDFFont;
  obliqueFont: PDFFont;
  boldObliqueFont: PDFFont;
}

async function renderPage(
  page: PDFPage,
  pageLayout: ResolvedPage,
  project: DocumentProject,
  fonts: FontSet
): Promise<void> {
  const { regularFont, boldFont, obliqueFont, boldObliqueFont } = fonts;

  // Draw page background
  page.drawRectangle({
    x: 0,
    y: 0,
    width: A4_WIDTH,
    height: A4_HEIGHT,
    color: rgb(1, 1, 1),
  });

  // Draw margins
  page.drawRectangle({
    x: MARGIN,
    y: MARGIN,
    width: CONTENT_WIDTH,
    height: CONTENT_HEIGHT,
    borderColor: rgb(0.9, 0.9, 0.9),
    borderWidth: 0.5,
  });

  // Render objects in z-order
  const sortedObjects = [...pageLayout.objects].sort((a, b) => a.zIndex - b.zIndex);

  for (const robj of sortedObjects) {
    await renderObject(page, robj, project, fonts);
  }

  // Page footer with template name
  page.drawText(pageLayout.template, {
    x: MARGIN,
    y: 36,
    size: 8,
    font: regularFont,
    color: rgb(0.5, 0.5, 0.5),
  });
}

async function renderObject(
  page: PDFPage,
  robj: ResolvedObject,
  project: DocumentProject,
  fonts: FontSet
): Promise<void> {
  const { object, resolvedBounds } = robj;
  const { regularFont, boldFont, obliqueFont, boldObliqueFont } = fonts;

  // Convert bounds to PDF coordinates (origin bottom-left)
  const x = MARGIN + resolvedBounds.x;
  const y = A4_HEIGHT - MARGIN - resolvedBounds.y - resolvedBounds.h;
  const w = resolvedBounds.w;
  const h = resolvedBounds.h;

  switch (object.kind) {
    case 'text':
      await renderTextObject(page, object, x, y, w, h, fonts);
      break;
    case 'image':
      await renderImageObject(page, object, project, x, y, w, h);
      break;
    case 'chart':
      await renderChartObject(page, object, project, x, y, w, h, fonts);
      break;
    case 'diagram':
      await renderDiagramObject(page, object, project, x, y, w, h, fonts);
      break;
    case 'table':
      await renderTableObject(page, object, x, y, w, h, fonts);
      break;
    case 'icon':
    case 'shape':
      // Icons and shapes - render as simple placeholders
      page.drawRectangle({ x, y, width: w, height: h, borderColor: rgb(0.8, 0.8, 0.8), borderWidth: 0.5 });
      page.drawText(`[${object.kind}: ${object.purpose}]`, { x: x + 4, y: y + h - 12, size: 8, font: regularFont, color: rgb(0.5, 0.5, 0.5) });
      break;
  }
}

async function renderTextObject(
  page: PDFPage,
  object: any, // TextObject
  x: number,
  y: number,
  w: number,
  h: number,
  fonts: FontSet
): Promise<void> {
  const { regularFont, boldFont, obliqueFont, boldObliqueFont } = fonts;
  const role = object.role;
  const content = object.content;

  // Select font based on role
  let font = regularFont;
  let size = 10;
  let leading = 14;
  let color = rgb(0.1, 0.1, 0.1);

  switch (role) {
    case 'heading':
      font = boldFont;
      size = { 1: 20, 2: 18, 3: 14, 4: 12 }[object.headingLevel || 1] || 14;
      leading = size * 1.3;
      color = rgb(0.1, 0.1, 0.2);
      break;
    case 'paragraph':
      font = regularFont;
      size = 10;
      leading = 14;
      break;
    case 'bulleted-list':
    case 'numbered-list':
      font = regularFont;
      size = 10;
      leading = 14;
      break;
    case 'quotation':
      font = obliqueFont;
      size = 10;
      leading = 14;
      color = rgb(0.2, 0.2, 0.3);
      break;
    case 'callout':
      font = regularFont;
      size = 10;
      leading = 14;
      color = rgb(0.15, 0.15, 0.25);
      break;
    case 'statistic-card':
      font = boldFont;
      size = 14;
      leading = 18;
      color = rgb(0.1, 0.1, 0.1);
      break;
    case 'caption':
      font = obliqueFont;
      size = 9;
      leading = 12;
      color = rgb(0.4, 0.4, 0.4);
      break;
    case 'footnote':
    case 'source-note':
      font = regularFont;
      size = 8;
      leading = 11;
      color = rgb(0.5, 0.5, 0.5);
      break;
    case 'hyperlink':
      font = regularFont;
      size = 10;
      leading = 14;
      color = rgb(0, 0.3, 0.8);
      break;
    default:
      font = regularFont;
      size = 10;
      leading = 14;
  }

  // Handle list items
  const lines = wrapText(content, font, size, w - 16);

  let currentY = y + h - leading;
  for (let i = 0; i < lines.length; i++) {
    if (currentY < y + leading) break; // Prevent overflow

    const line = lines[i];
    const isListItem = (role === 'bulleted-list' || role === 'numbered-list') && i === 0;
    const prefix = isListItem ? (role === 'bulleted-list' ? '•  ' : '1.  ') : '';
    const drawX = x + (isListItem ? 16 : 8);
    const drawW = w - (isListItem ? 24 : 16);

    page.drawText(prefix + line, {
      x: drawX,
      y: currentY,
      size,
      font,
      color,
      maxWidth: drawW,
    });

    currentY -= leading;
  }
}

function wrapText(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let currentLine = '';

  for (const word of words) {
    const testLine = currentLine + (currentLine ? ' ' : '') + word;
    const width = font.widthOfTextAtSize(testLine, size);

    if (width > maxWidth && currentLine) {
      lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = testLine;
    }
  }

  if (currentLine) lines.push(currentLine);
  return lines.length > 0 ? lines : [''];
}

async function renderImageObject(
  page: PDFPage,
  object: any, // ImageObject
  project: DocumentProject,
  x: number,
  y: number,
  w: number,
  h: number
): Promise<void> {
  const asset = project.assets[object.assetId];
  if (!asset) return;

  try {
    // In real implementation, we'd load the blob and embed
    // For now, draw placeholder
    page.drawRectangle({
      x,
      y,
      width: w,
      height: h,
      borderColor: rgb(0.8, 0.8, 0.8),
      borderWidth: 1,
    });

    page.drawText(`[Image: ${object.purpose}]`, {
      x: x + 4,
      y: y + h / 2,
      size: 10,
      color: rgb(0.5, 0.5, 0.5),
    });

    // Caption
    if (object.altTextApproved) {
      page.drawText(object.altTextApproved, {
        x: x,
        y: y - 16,
        size: 9,
        font: await page.doc.embedFont(StandardFonts.HelveticaOblique),
        color: rgb(0.4, 0.4, 0.4),
        maxWidth: w,
      });
    }
  } catch {
    // Ignore image rendering errors
  }
}

async function renderChartObject(
  page: PDFPage,
  object: any, // ChartObject
  project: DocumentProject,
  x: number,
  y: number,
  w: number,
  h: number,
  fonts: FontSet
): Promise<void> {
  const chart = project.charts[object.chartId];
  if (!chart) return;

  // Draw chart area
  page.drawRectangle({
    x,
    y,
    width: w,
    height: h,
    borderColor: rgb(0.9, 0.9, 0.9),
    borderWidth: 0.5,
  });

  // Title
  page.drawText(chart.spec.title, {
    x: x + 8,
    y: y + h - 20,
    size: 12,
    font: fonts.boldFont,
    color: rgb(0.1, 0.1, 0.1),
    maxWidth: w - 16,
  });

  // Render simple bar/line chart
  if (chart.geometry) {
    const chartX = x + 60;
    const chartY = y + 30;
    const chartW = w - 100;
    const chartH = h - 80;

    if (chart.spec.type === 'horizontal_bar' || chart.spec.type === 'vertical_bar') {
      renderBarChart(page, chart, chartX, chartY, chartW, chartH);
    } else if (chart.spec.type === 'line') {
      renderLineChart(page, chart, chartX, chartY, chartW, chartH);
    }
  }

  // Source note
  if (chart.spec.sourceNote) {
    page.drawText(chart.spec.sourceNote, {
      x: x + 8,
      y: y + 8,
      size: 7,
      font: fonts.obliqueFont,
      color: rgb(0.5, 0.5, 0.5),
      maxWidth: w - 16,
    });
  }
}

function renderBarChart(
  page: PDFPage,
  chart: any,
  x: number,
  y: number,
  w: number,
  h: number
): void {
  const { geometry, spec } = chart;
  if (!geometry || !geometry.bars.length) return;

  const maxValue = Math.max(...geometry.bars.map((b: any) => b.value));
  const barCount = geometry.bars.length;
  const barWidth = (w / barCount) * 0.8;
  const gap = w / barCount - barWidth;

  for (let i = 0; i < geometry.bars.length; i++) {
    const bar = geometry.bars[i];
    const series = spec.series[bar.seriesIndex];
    const barHeight = (bar.value / maxValue) * h;
    const barX = x + i * (barWidth + gap) + gap / 2;
    const barY = y + h - barHeight;

    // Convert hex color to RGB
    const color = hexToRgb(series.color);

    page.drawRectangle({
      x: barX,
      y: barY,
      width: barWidth,
      height: barHeight,
      color: color,
    });
  }

  // Y axis
  page.drawLine({
    start: { x, y },
    end: { x, y: y + h },
    thickness: 1,
    color: rgb(0.5, 0.5, 0.5),
  });

  // X axis
  page.drawLine({
    start: { x, y: y + h },
    end: { x: x + w, y: y + h },
    thickness: 1,
    color: rgb(0.5, 0.5, 0.5),
  });
}

function renderLineChart(
  page: PDFPage,
  chart: any,
  x: number,
  y: number,
  w: number,
  h: number
): void {
  const { geometry, spec } = chart;
  if (!geometry || !geometry.lines.length) return;

  for (let i = 0; i < geometry.lines.length; i++) {
    const line = geometry.lines[i];
    const series = spec.series[i];
    const color = hexToRgb(series.color);

    if (!line.points.length) continue;

    const points = line.points.map((p: any) => ({
      x: x + (p.x / w) * w,
      y: y + h - (p.y / h) * h,
    }));

    for (let j = 1; j < points.length; j++) {
      page.drawLine({
        start: points[j - 1],
        end: points[j],
        thickness: 2,
        color,
      });
    }
  }
}

async function renderDiagramObject(
  page: PDFPage,
  object: any, // DiagramObject
  project: DocumentProject,
  x: number,
  y: number,
  w: number,
  h: number,
  fonts: FontSet
): Promise<void> {
  const diagram = project.diagrams[object.diagramId];
  if (!diagram) return;

  // Draw diagram area
  page.drawRectangle({
    x,
    y,
    width: w,
    height: h,
    borderColor: rgb(0.9, 0.9, 0.9),
    borderWidth: 0.5,
  });

  // Render nodes and edges
  const bounds = getDiagramBounds(diagram);
  const scaleX = (w - 40) / bounds.w;
  const scaleY = (h - 40) / bounds.h;
  const scale = Math.min(scaleX, scaleY);
  const offsetX = x + (w - bounds.w * scale) / 2;
  const offsetY = y + (h - bounds.h * scale) / 2;

  // Edges first
  for (const edge of diagram.edges) {
    const from = diagram.nodes.find((n: any) => n.id === edge.from);
    const to = diagram.nodes.find((n: any) => n.id === edge.to);
    if (!from || !to) continue;

    const fromX = offsetX + (from.bounds.x + from.bounds.w / 2) * scale;
    const fromY = offsetY + (from.bounds.y + from.bounds.h / 2) * scale;
    const toX = offsetX + (to.bounds.x + to.bounds.w / 2) * scale;
    const toY = offsetY + (to.bounds.y + to.bounds.h / 2) * scale;

    page.drawLine({
      start: { x: fromX, y: fromY },
      end: { x: toX, y: toY },
      thickness: 1,
      color: rgb(0.3, 0.3, 0.3),
    });
  }

  // Nodes
  for (const node of diagram.nodes) {
    const nx = offsetX + node.bounds.x * scale;
    const ny = offsetY + node.bounds.y * scale;
    const nw = node.bounds.w * scale;
    const nh = node.bounds.h * scale;

    page.drawRectangle({
      x: nx,
      y: ny,
      width: nw,
      height: nh,
      borderColor: rgb(0.2, 0.2, 0.2),
      borderWidth: 1,
    });

    page.drawText(node.label, {
      x: nx + nw / 2,
      y: ny + nh / 2 + 3,
      size: Math.max(6, 9 * scale),
      font: fonts.regularFont,
      color: rgb(0.1, 0.1, 0.1),
      maxWidth: nw - 4,
    });
  }
}

async function renderTableObject(
  page: PDFPage,
  object: any, // TableObject
  x: number,
  y: number,
  w: number,
  h: number,
  fonts: FontSet
): Promise<void> {
  const { headers, rows } = object;

  const colWidth = w / headers.length;
  const rowHeight = 20;
  const headerHeight = 24;

  // Header
  page.drawRectangle({
    x,
    y: y + h - headerHeight,
    width: w,
    height: headerHeight,
    color: rgb(0.95, 0.95, 0.95),
    borderColor: rgb(0.8, 0.8, 0.8),
    borderWidth: 1,
  });

  for (let i = 0; i < headers.length; i++) {
    page.drawText(headers[i], {
      x: x + i * colWidth + 4,
      y: y + h - headerHeight + 6,
      size: 9,
      font: fonts.boldFont,
      color: rgb(0.1, 0.1, 0.1),
      maxWidth: colWidth - 8,
    });
  }

  // Rows
  for (let rowIdx = 0; rowIdx < rows.length; rowIdx++) {
    const row = rows[rowIdx];
    const rowY = y + h - headerHeight - (rowIdx + 1) * rowHeight;

    if (rowY < y) break;

    if (rowIdx % 2 === 0) {
      page.drawRectangle({
        x,
        y: rowY,
        width: w,
        height: rowHeight,
        color: rgb(0.98, 0.98, 0.98),
      });
    }

    for (let colIdx = 0; colIdx < headers.length; colIdx++) {
      const cell = row[colIdx] ?? '';
      page.drawText(String(cell), {
        x: x + colIdx * colWidth + 4,
        y: rowY + 6,
        size: 8,
        font: fonts.regularFont,
        color: rgb(0.2, 0.2, 0.2),
        maxWidth: colWidth - 8,
      });
    }

    // Grid lines
    for (let colIdx = 0; colIdx <= headers.length; colIdx++) {
      page.drawLine({
        start: { x: x + colIdx * colWidth, y: rowY },
        end: { x: x + colIdx * colWidth, y: rowY + rowHeight },
        thickness: 0.5,
        color: rgb(0.8, 0.8, 0.8),
      });
    }
  }
}

function addPageNumber(
  page: PDFPage,
  pageNum: number,
  totalPages: number,
  font: PDFFont
): void {
  page.drawText(`${pageNum} / ${totalPages}`, {
    x: A4_WIDTH / 2,
    y: 24,
    size: 9,
    font,
    color: rgb(0.5, 0.5, 0.5),
  });
}

function getDiagramBounds(diagram: any): Bounds {
  if (!diagram.nodes.length) return { x: 0, y: 0, w: 400, h: 300 };
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const node of diagram.nodes) {
    minX = Math.min(minX, node.bounds.x);
    minY = Math.min(minY, node.bounds.y);
    maxX = Math.max(maxX, node.bounds.x + node.bounds.w);
    maxY = Math.max(maxY, node.bounds.y + node.bounds.h);
  }
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}

function hexToRgb(hex: string): ReturnType<typeof pdfRgb> {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return pdfRgb(0, 0, 0);
  return pdfRgb(
    parseInt(result[1], 16) / 255,
    parseInt(result[2], 16) / 255,
    parseInt(result[3], 16) / 255
  );
}