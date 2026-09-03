#!/usr/bin/env node
/**
 * D0-2 — DOM-measurement spike (throwaway).
 *
 * The question this answers, before any of Day 3 is built: can deterministic
 * layout checks (§16.2 overlap / out-of-bounds / text overflow / truncation) be
 * derived from real browser layout, using nothing but `getBoundingClientRect`,
 * `scrollWidth` and `scrollHeight`?
 *
 * If the answer is no, §31 must-have #9 gets renegotiated on Day 0 rather than
 * discovered on Day 4 (implementation-plan.md §8 D0-2, §10 risk 3).
 *
 * The fixture contains four real defects AND four near-miss controls, because a
 * measurement that flags everything is as useless as one that flags nothing.
 *
 *   node spikes/dom-measure.mjs
 */
import { createServer } from 'node:http';
import { chromium } from 'playwright';

// US Letter at 96 dpi: 816 x 1056 px == 612 x 792 pt exactly. Integers both ways.
const PAGE = { width: 816, height: 1056, margin: 72 };

const FIXTURE = /* html */ `<!doctype html>
<html lang="en"><meta charset="utf-8"><title>Vistect D0-2 measurement spike</title>
<style>
  :root { --page-w: ${PAGE.width}px; --page-h: ${PAGE.height}px; --margin: ${PAGE.margin}px; }
  * { box-sizing: border-box; margin: 0; }
  body { font-family: 'DejaVu Sans', system-ui, sans-serif; }

  /* The measurement surface: exact page size, unscaled, off-screen. Production
     measures a copy like this rather than the visible canvas, so a display zoom
     or a CSS transform on the preview can never contaminate the numbers. */
  .measure-root { position: absolute; left: -10000px; top: 0; }
  .page {
    position: relative; width: var(--page-w); height: var(--page-h);
    padding: var(--margin); background: #fff; overflow: hidden;
  }
  .obj { position: absolute; overflow: hidden; }
  h2.obj { font-size: 28px; line-height: 34px; white-space: nowrap; }
  p.obj  { font-size: 15px; line-height: 22px; }
  .swatch { background: #dfe8f0; border: 1px solid #102a43; }

  /* A visible, CSS-scaled preview of the same page — used only to demonstrate
     why we do not measure it. */
  .preview { transform: scale(0.5); transform-origin: top left; }
</style>

<div class="measure-root">
  <div class="page" id="page-1" data-page-id="page-1">

    <!-- DEFECT 1: heading wider than its box -> truncated -->
    <h2 class="obj" id="o-heading-truncated" data-object-id="o-heading-truncated"
        style="left:72px; top:72px; width:200px;">Employment outcomes across all four regions</h2>

    <!-- CONTROL 1: same style, text that genuinely fits its box -->
    <h2 class="obj" id="o-heading-ok" data-object-id="o-heading-ok"
        style="left:72px; top:120px; width:640px;">Employment outcomes</h2>

    <!-- DEFECT 2: paragraph taller than its box -> vertical overflow -->
    <p class="obj" id="o-para-overflow" data-object-id="o-para-overflow"
       style="left:72px; top:180px; width:300px; height:44px;">Ninety-two participants completed
       the programme in 2025, and sixty-eight of them entered paid employment within six months
       of graduating.</p>

    <!-- CONTROL 2: same text, box tall enough -->
    <p class="obj" id="o-para-ok" data-object-id="o-para-ok"
       style="left:420px; top:180px; width:300px; height:180px;">Ninety-two participants completed
       the programme in 2025, and sixty-eight of them entered paid employment within six months
       of graduating.</p>

    <!-- DEFECT 3: two objects that intersect -->
    <div class="obj swatch" id="o-box-a" data-object-id="o-box-a"
         style="left:100px; top:420px; width:200px; height:100px;"></div>
    <div class="obj swatch" id="o-box-b" data-object-id="o-box-b"
         style="left:250px; top:470px; width:200px; height:100px;"></div>

    <!-- CONTROL 3: two objects that share an edge but do not intersect -->
    <div class="obj swatch" id="o-box-c" data-object-id="o-box-c"
         style="left:100px; top:620px; width:150px; height:80px;"></div>
    <div class="obj swatch" id="o-box-d" data-object-id="o-box-d"
         style="left:250px; top:620px; width:150px; height:80px;"></div>

    <!-- DEFECT 4: object crossing the page's right and bottom margins -->
    <div class="obj swatch" id="o-box-oob" data-object-id="o-box-oob"
         style="left:700px; top:900px; width:200px; height:200px;"></div>

    <!-- CONTROL 4: object flush against the inside of the bottom margin -->
    <div class="obj swatch" id="o-box-inbounds" data-object-id="o-box-inbounds"
         style="left:72px; top:824px; width:200px; height:160px;"></div>
  </div>
</div>

<main>
  <h1>D0-2 spike</h1>
  <div class="preview"><div class="page" id="page-preview"></div></div>
</main>
`;

/**
 * The browser-only half. This is the shape `src/measure/measurePage.ts` will take:
 * read raw numbers, return plain data, decide nothing.
 */
async function measureInPage() {
  await document.fonts.ready;
  const page = document.querySelector('[data-page-id]');
  const pageRect = page.getBoundingClientRect();
  const cs = getComputedStyle(page);
  const px = (v) => parseFloat(v) || 0;

  const objects = [...page.querySelectorAll('[data-object-id]')].map((el) => {
    const r = el.getBoundingClientRect();
    return {
      id: el.dataset.objectId,
      // Page-local coordinates: viewport rect minus the page's own origin.
      bounds: {
        x: r.left - pageRect.left,
        y: r.top - pageRect.top,
        width: r.width,
        height: r.height,
      },
      // Truncation and overflow are content-vs-box comparisons, not rects.
      scrollWidth: el.scrollWidth,
      clientWidth: el.clientWidth,
      scrollHeight: el.scrollHeight,
      clientHeight: el.clientHeight,
      fontSizePx: px(getComputedStyle(el).fontSize),
    };
  });

  return {
    page: {
      width: pageRect.width,
      height: pageRect.height,
      content: {
        x: px(cs.paddingLeft),
        y: px(cs.paddingTop),
        width: pageRect.width - px(cs.paddingLeft) - px(cs.paddingRight),
        height: pageRect.height - px(cs.paddingTop) - px(cs.paddingBottom),
      },
    },
    objects,
    // Proof that the visible preview must not be the measurement surface.
    scaledPreviewRectWidth: document.querySelector('#page-preview').getBoundingClientRect()
      .width,
  };
}

/**
 * The pure half. This is the shape `src/core/validate/geometry.ts` will take:
 * plain numbers in, findings out, no DOM anywhere.
 */
function findGeometryDefects(measurement, { tolerancePx = 0.5 } = {}) {
  const findings = [];
  const { content } = measurement.page;

  for (const o of measurement.objects) {
    if (o.scrollWidth - o.clientWidth > tolerancePx) {
      findings.push({
        category: 'text-truncation',
        targetId: o.id,
        evidence: `content is ${o.scrollWidth}px wide in a ${o.clientWidth}px box (clipped by ${o.scrollWidth - o.clientWidth}px)`,
      });
    }
    if (o.scrollHeight - o.clientHeight > tolerancePx) {
      findings.push({
        category: 'text-overflow',
        targetId: o.id,
        evidence: `content is ${o.scrollHeight}px tall in a ${o.clientHeight}px box (clipped by ${o.scrollHeight - o.clientHeight}px)`,
      });
    }
    const b = o.bounds;
    const over = {
      left: content.x - b.x,
      top: content.y - b.y,
      right: b.x + b.width - (content.x + content.width),
      bottom: b.y + b.height - (content.y + content.height),
    };
    const breached = Object.entries(over).filter(([, v]) => v > tolerancePx);
    if (breached.length > 0) {
      findings.push({
        category: 'out-of-bounds',
        targetId: o.id,
        evidence: breached
          .map(([side, v]) => `${v.toFixed(1)}px past the ${side} margin`)
          .join(', '),
      });
    }
  }

  for (let i = 0; i < measurement.objects.length; i += 1) {
    for (let j = i + 1; j < measurement.objects.length; j += 1) {
      const a = measurement.objects[i].bounds;
      const b = measurement.objects[j].bounds;
      const overlapW = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x);
      const overlapH = Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y);
      if (overlapW > tolerancePx && overlapH > tolerancePx) {
        findings.push({
          category: 'object-overlap',
          targetId: `${measurement.objects[i].id} + ${measurement.objects[j].id}`,
          evidence: `rects intersect over ${overlapW.toFixed(1)} x ${overlapH.toFixed(1)}px`,
        });
      }
    }
  }
  return findings;
}

const EXPECTED = [
  { category: 'text-truncation', targetId: 'o-heading-truncated' },
  { category: 'text-overflow', targetId: 'o-para-overflow' },
  { category: 'object-overlap', targetId: 'o-box-a + o-box-b' },
  { category: 'out-of-bounds', targetId: 'o-box-oob' },
];

function serve(html) {
  const server = createServer((_req, res) => {
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    res.end(html);
  });
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () =>
      resolve({
        url: `http://127.0.0.1:${server.address().port}/`,
        close: () => server.close(),
      }),
    );
  });
}

const site = await serve(FIXTURE);
const browser = await chromium.launch({ channel: 'chrome' });
let measurement;
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await page.goto(site.url, { waitUntil: 'load' });
  measurement = await page.evaluate(`(${measureInPage.toString()})()`);
} finally {
  await browser.close();
  site.close();
}

const findings = findGeometryDefects(measurement);
const key = (f) => `${f.category}:${f.targetId}`;
const got = new Set(findings.map(key));
const want = new Set(EXPECTED.map(key));

console.log(`\nD0-2 DOM measurement spike\n`);
console.log(
  `Page measured: ${measurement.page.width} x ${measurement.page.height}px ` +
    `(expected ${PAGE.width} x ${PAGE.height})`,
);
console.log(
  `Content box:   ${measurement.page.content.width} x ${measurement.page.content.height}px ` +
    `at (${measurement.page.content.x}, ${measurement.page.content.y})`,
);
console.log(`Objects measured: ${measurement.objects.length}\n`);

console.log('Findings:');
for (const f of findings) {
  const mark = want.has(key(f)) ? '✅ expected  ' : '❌ FALSE POSITIVE';
  console.log(`  ${mark} ${f.category.padEnd(16)} ${f.targetId} — ${f.evidence}`);
}
const missed = EXPECTED.filter((e) => !got.has(key(e)));
for (const m of missed) console.log(`  ❌ MISSED      ${m.category.padEnd(16)} ${m.targetId}`);

console.log(
  `\nControls that correctly produced no finding: ` +
    `${['o-heading-ok', 'o-para-ok', 'o-box-c', 'o-box-d', 'o-box-inbounds']
      .filter((id) => !findings.some((f) => f.targetId.includes(id)))
      .join(', ')}`,
);
console.log(
  `\nWhy we measure off-screen and unscaled: the CSS-scaled preview of the same ` +
    `page reports ${measurement.scaledPreviewRectWidth}px wide, not ${PAGE.width}px. ` +
    `getBoundingClientRect() returns post-transform values, so the measurement surface ` +
    `must never be the zoomed/scaled one.`,
);

const pageSizeExact =
  measurement.page.width === PAGE.width && measurement.page.height === PAGE.height;
const falsePositives = findings.filter((f) => !want.has(key(f)));
const ok = pageSizeExact && missed.length === 0 && falsePositives.length === 0;

console.log(
  `\n${ok ? '✅' : '❌'} ${findings.length - falsePositives.length}/${EXPECTED.length} seeded defects found by measurement, ` +
    `${falsePositives.length} false positives, page geometry ${pageSizeExact ? 'exact' : 'WRONG'}.\n`,
);
if (!ok) process.exit(1);
