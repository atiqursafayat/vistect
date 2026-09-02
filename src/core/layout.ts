/**
 * Deterministic flow layout for the pure core.
 *
 * Core cannot measure text — it has no DOM (see `tsconfig.core.json`). So an object's
 * `bounds` starts as an *estimate* computed here, and `measure_page` (Day 3) overwrites
 * it with numbers read off a real off-screen render. Every consumer that needs the
 * truth reads measured bounds; this module exists so that a freshly created object has
 * plausible geometry, a stable reading order and a region to belong to.
 *
 * The estimate is intentionally slightly pessimistic (it rounds lines up), so the
 * common failure mode is "core said it fits, the browser agreed" rather than a
 * surprise overflow the user only hears about at export time.
 */
import type { Bounds } from './model/primitives.js';
import type { HeadingLevel, TextObject, TextRole } from './model/objects.js';
import type { Theme } from './model/project.js';
import type { Region } from './templates.js';

export type TextMetrics = {
  fontSizePx: number;
  lineHeightPx: number;
  /** Mean advance width as a fraction of font size, for the estimator only. */
  avgCharWidthRatio: number;
  spaceAbovePx: number;
};

/** Ratios sampled from the two pinned faces at 15px; see docs/day-0-findings.md. */
const CHAR_RATIO = { heading: 0.5, body: 0.47 } as const;

export function textMetrics(
  theme: Theme,
  textRole: TextRole,
  headingLevel: HeadingLevel = 2,
): TextMetrics {
  if (textRole === 'heading') {
    const fontSizePx = theme.headingScalePx[headingLevel - 1] ?? theme.headingScalePx[1];
    return {
      fontSizePx,
      lineHeightPx: Math.round(fontSizePx * 1.2),
      avgCharWidthRatio: CHAR_RATIO.heading,
      spaceAbovePx: headingLevel === 1 ? 0 : theme.baselinePx,
    };
  }
  const scale: Record<Exclude<TextRole, 'heading'>, number> = {
    paragraph: 1,
    list: 1,
    quote: 1.1,
    callout: 1,
    statistic: 2.2,
    caption: 0.87,
    'source-note': 0.8,
    footnote: 0.8,
  };
  const fontSizePx = Math.round(theme.bodySizePx * scale[textRole]);
  return {
    fontSizePx,
    lineHeightPx: Math.max(theme.baselinePx, Math.round(fontSizePx * 1.5)),
    avgCharWidthRatio: CHAR_RATIO.body,
    spaceAbovePx: Math.round(theme.baselinePx * 0.5),
  };
}

/** Lines a run of text needs at `widthPx`, never fewer than one. */
export function estimateLineCount(text: string, widthPx: number, metrics: TextMetrics): number {
  const charsPerLine = Math.max(
    1,
    Math.floor(widthPx / (metrics.fontSizePx * metrics.avgCharWidthRatio)),
  );
  const paragraphs = text.split('\n').filter((line) => line.trim().length > 0);
  if (paragraphs.length === 0) return 1;
  return paragraphs.reduce((total, line) => total + Math.ceil(line.length / charsPerLine), 0);
}

export function estimateTextHeight(
  object: Pick<TextObject, 'textRole' | 'content' | 'items' | 'headingLevel'>,
  widthPx: number,
  theme: Theme,
): number {
  const metrics = textMetrics(theme, object.textRole, object.headingLevel);
  if (object.textRole === 'list' && object.items && object.items.length > 0) {
    const bulletIndentPx = 22;
    const lines = object.items.reduce(
      (total, item) => total + estimateLineCount(item, widthPx - bulletIndentPx, metrics),
      0,
    );
    return lines * metrics.lineHeightPx + (object.items.length - 1) * 4;
  }
  return estimateLineCount(object.content, widthPx, metrics) * metrics.lineHeightPx;
}

/**
 * Next free y inside a flow region: below everything already placed there, plus the
 * new object's own leading. Objects outside the region are ignored, which is what makes
 * two regions on one page independent of each other.
 */
export function nextFlowBounds(
  region: Region,
  siblings: readonly { bounds: Bounds }[],
  heightPx: number,
  spaceAbovePx: number,
): Bounds {
  const inRegion = siblings.filter(
    (o) =>
      o.bounds.x >= region.bounds.x - 1 && o.bounds.x < region.bounds.x + region.bounds.width,
  );
  const bottom = inRegion.reduce(
    (lowest, o) => Math.max(lowest, o.bounds.y + o.bounds.height),
    region.bounds.y,
  );
  const y = inRegion.length === 0 ? region.bounds.y : bottom + spaceAbovePx;
  return { x: region.bounds.x, y, width: region.bounds.width, height: heightPx };
}

/** True when an object's estimated box already runs past the region it was placed in. */
export function overflowsRegion(bounds: Bounds, region: Region): boolean {
  return bounds.y + bounds.height > region.bounds.y + region.bounds.height;
}
