/**
 * The flow estimator. Core cannot measure text, so these numbers are estimates that
 * `measure_page` later overwrites — what matters here is that they are deterministic,
 * ordered and never zero-height, because reading order and region overflow are derived
 * from them before the browser has said anything.
 */
import { describe, expect, it } from 'vitest';
import { defaultTheme } from '../../src/core/defaults.js';
import {
  estimateLineCount,
  estimateTextHeight,
  nextFlowBounds,
  textMetrics,
} from '../../src/core/layout.js';
import { getRegion, getTemplate, TEMPLATE_IDS } from '../../src/core/templates.js';
import { PAGE_GEOMETRY, contentBox, pxToPt } from '../../src/core/model/primitives.js';

const theme = defaultTheme();

describe('page geometry', () => {
  it('is US Letter in whole pixels and whole points', () => {
    expect(PAGE_GEOMETRY.widthPx).toBe(816);
    expect(pxToPt(PAGE_GEOMETRY.widthPx)).toBe(612);
    expect(pxToPt(PAGE_GEOMETRY.heightPx)).toBe(792);
    expect(contentBox()).toEqual({ x: 72, y: 72, width: 672, height: 912 });
  });

  it('keeps every template region inside the page', () => {
    for (const id of TEMPLATE_IDS) {
      const template = getTemplate(id);
      expect(template).toBeDefined();
      for (const region of template?.regions ?? []) {
        expect(region.bounds.x).toBeGreaterThanOrEqual(0);
        expect(region.bounds.y).toBeGreaterThanOrEqual(0);
        expect(region.bounds.x + region.bounds.width).toBeLessThanOrEqual(
          PAGE_GEOMETRY.widthPx,
        );
        expect(region.bounds.y + region.bounds.height).toBeLessThanOrEqual(
          PAGE_GEOMETRY.heightPx,
        );
      }
    }
  });
});

describe('text estimates', () => {
  it('never returns less than one line, even for empty text', () => {
    const metrics = textMetrics(theme, 'paragraph');
    expect(estimateLineCount('', 672, metrics)).toBe(1);
    expect(estimateTextHeight({ textRole: 'paragraph', content: '' }, 672, theme)).toBe(
      metrics.lineHeightPx,
    );
  });

  it('grows with content and shrinks with width', () => {
    const short = estimateTextHeight(
      { textRole: 'paragraph', content: 'A short line.' },
      672,
      theme,
    );
    const long = estimateTextHeight(
      { textRole: 'paragraph', content: 'A short line.'.repeat(20) },
      672,
      theme,
    );
    const narrow = estimateTextHeight(
      { textRole: 'paragraph', content: 'A short line.'.repeat(20) },
      324,
      theme,
    );
    expect(long).toBeGreaterThan(short);
    expect(narrow).toBeGreaterThan(long);
  });

  it('sizes a heading from the theme scale, not the body size', () => {
    expect(textMetrics(theme, 'heading', 1).fontSizePx).toBe(34);
    expect(textMetrics(theme, 'heading', 3).fontSizePx).toBe(19);
    expect(textMetrics(theme, 'source-note').fontSizePx).toBeLessThan(theme.bodySizePx);
  });
});

describe('flow placement', () => {
  it('puts the first object at the top of its region and stacks the next below it', () => {
    const region = getRegion('text-led', 'flow');
    expect(region).toBeDefined();
    if (!region) return;

    const first = nextFlowBounds(region, [], 40, 12);
    expect(first).toEqual({ x: 72, y: 72, width: 672, height: 40 });

    const second = nextFlowBounds(region, [{ bounds: first }], 60, 12);
    expect(second.y).toBe(72 + 40 + 12);
    expect(second.x).toBe(72);
  });
});
