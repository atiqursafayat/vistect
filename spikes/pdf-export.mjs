#!/usr/bin/env node
/**
 * D0-3 — pdf-lib export spike (throwaway).
 *
 * The question: can a client-side-only pipeline produce a real, downloadable PDF
 * containing (a) typeset text and (b) a chart that started life as SVG and was
 * rasterised through a canvas — with no server, no print dialog, and no tainted
 * canvas? (implementation-plan.md §8 D0-3, §5 "PDF: pdf-lib".)
 *
 * Verification is not "it didn't throw": the produced file is inspected with
 * `pdfinfo` and page 1 is rendered back to a PNG with `pdftoppm` so the chart can
 * actually be looked at.
 *
 *   node spikes/pdf-export.mjs
 */
import { createServer } from 'node:http';
import { mkdir, readFile } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { chromium } from 'playwright';

const run = promisify(execFile);
const here = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(here, 'out');

// US Letter. 816 x 1056 CSS px at 96 dpi is exactly 612 x 792 PostScript points.
const PAGE_PT = { width: 612, height: 792 };
const RASTER_SCALE = 3; // 288 dpi for the rasterised chart

const PAGE_HTML = /* html */ `<!doctype html>
<html lang="en"><meta charset="utf-8"><title>Vistect D0-3 pdf-lib spike</title>
<body><h1>D0-3 spike</h1><div id="log"></div>
<script type="module">
import { PDFDocument, StandardFonts, rgb } from '/pdf-lib.esm.min.js';

const PAGE_PT = ${JSON.stringify(PAGE_PT)};
const RASTER_SCALE = ${RASTER_SCALE};
const NAVY = rgb(0x10 / 255, 0x2a / 255, 0x43 / 255);
const TEAL = rgb(0x00 / 255, 0x8c / 255, 0x95 / 255);

/** Hand-rolled horizontal bar chart, in the shape core/chart/ will emit. */
function chartSvg(data, { width = 640, height = 320 } = {}) {
  const pad = { top: 40, right: 64, bottom: 36, left: 190 };
  const plotW = width - pad.left - pad.right;
  const plotH = height - pad.top - pad.bottom;
  const max = Math.max(...data.map((d) => d.value));
  const band = plotH / data.length;
  const barH = band * 0.62;
  const scale = (v) => (v / max) * plotW;

  const bars = data
    .map((d, i) => {
      const y = pad.top + i * band + (band - barH) / 2;
      const w = scale(d.value);
      return \`
      <rect x="\${pad.left}" y="\${y}" width="\${w.toFixed(2)}" height="\${barH.toFixed(2)}" fill="#008C95"/>
      <text x="\${pad.left - 12}" y="\${(y + barH / 2 + 5).toFixed(2)}" text-anchor="end"
            font-family="DejaVu Sans, sans-serif" font-size="15" fill="#102A43">\${d.label}</text>
      <text x="\${(pad.left + w + 10).toFixed(2)}" y="\${(y + barH / 2 + 5).toFixed(2)}"
            font-family="DejaVu Sans, sans-serif" font-size="15" font-weight="600" fill="#102A43">\${d.value}</text>\`;
    })
    .join('');

  return \`<svg xmlns="http://www.w3.org/2000/svg" width="\${width}" height="\${height}" viewBox="0 0 \${width} \${height}">
  <rect width="\${width}" height="\${height}" fill="#FFFFFF"/>
  <text x="0" y="22" font-family="DejaVu Sans, sans-serif" font-size="17" font-weight="700" fill="#102A43">Participants by outcome, 2025</text>
  \${bars}
  <line x1="\${pad.left}" y1="\${pad.top}" x2="\${pad.left}" y2="\${height - pad.bottom}" stroke="#102A43" stroke-width="1.25"/>
  <text x="\${pad.left}" y="\${height - 10}" font-family="DejaVu Sans, sans-serif" font-size="12" fill="#334E68">Number of participants (n = 92)</text>
</svg>\`;
}

/** SVG string -> PNG bytes, via an offscreen canvas. No network, no taint. */
async function rasteriseSvg(svg, scale) {
  const w = Number(svg.match(/width="(\\d+)"/)[1]);
  const h = Number(svg.match(/height="(\\d+)"/)[1]);
  const url = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  const img = new Image();
  img.width = w; img.height = h;
  await new Promise((res, rej) => { img.onload = res; img.onerror = () => rej(new Error('svg decode failed')); img.src = url; });

  const canvas = new OffscreenCanvas(w * scale, h * scale);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.scale(scale, scale);
  ctx.drawImage(img, 0, 0, w, h);
  // If a data: SVG tainted the canvas this next line throws — that is the real test.
  const blob = await canvas.convertToBlob({ type: 'image/png' });
  return { bytes: new Uint8Array(await blob.arrayBuffer()), width: w, height: h };
}

function wrap(text, font, size, maxWidth) {
  const lines = [];
  let line = '';
  for (const word of text.split(/\\s+/)) {
    const next = line ? line + ' ' + word : word;
    if (font.widthOfTextAtSize(next, size) > maxWidth && line) { lines.push(line); line = word; }
    else line = next;
  }
  if (line) lines.push(line);
  return lines;
}

async function build() {
  const data = [
    { label: 'Entered paid employment', value: 68 },
    { label: 'Continued in education', value: 14 },
    { label: 'Self-employed', value: 6 },
    { label: 'Seeking work', value: 4 },
  ];
  const svg = chartSvg(data);
  const raster = await rasteriseSvg(svg, RASTER_SCALE);

  const pdf = await PDFDocument.create();
  pdf.setTitle('Vistect D0-3 export spike');
  pdf.setLanguage('en-US');
  const page = pdf.addPage([PAGE_PT.width, PAGE_PT.height]);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const body = await pdf.embedFont(StandardFonts.TimesRoman);

  const margin = 54; // 0.75in
  const contentW = PAGE_PT.width - margin * 2;
  let y = PAGE_PT.height - margin;

  page.drawText('Employment outcomes', { x: margin, y: y - 22, size: 24, font: bold, color: NAVY });
  y -= 46;
  page.drawRectangle({ x: margin, y, width: 96, height: 3, color: TEAL });
  y -= 26;

  const para =
    'Ninety-two participants completed the programme in 2025. Sixty-eight entered paid ' +
    'employment within six months of graduating, and a further fourteen continued into ' +
    'formal education. The chart below reports the same figures as the accompanying data table.';
  for (const line of wrap(para, body, 11.5, contentW)) {
    y -= 16;
    page.drawText(line, { x: margin, y, size: 11.5, font: body, color: rgb(0.1, 0.15, 0.22) });
  }

  y -= 24;
  const png = await pdf.embedPng(raster.bytes);
  const drawW = contentW;
  const drawH = (raster.height / raster.width) * drawW;
  page.drawImage(png, { x: margin, y: y - drawH, width: drawW, height: drawH });
  y -= drawH + 18;

  page.drawText('Figure 1. Participant outcomes, 2025. Source: programme intake records.', {
    x: margin, y, size: 9, font: body, color: rgb(0.25, 0.3, 0.38),
  });

  const bytes = await pdf.save();
  return {
    pdf: bytes,
    pngPreview: raster.bytes,
    stats: {
      rasterPx: [raster.width * RASTER_SCALE, raster.height * RASTER_SCALE],
      rasterBytes: raster.bytes.length,
      pdfBytes: bytes.length,
      effectiveDpi: Math.round((raster.width * RASTER_SCALE) / (drawW / 72)),
    },
  };
}

try {
  const { pdf, pngPreview, stats } = await build();
  // Downloading is part of what is being de-risked: no print dialog on stage.
  for (const [name, bytes, type] of [
    ['vistect-d0-3.pdf', pdf, 'application/pdf'],
    ['vistect-d0-3-chart.png', pngPreview, 'image/png'],
  ]) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([bytes], { type }));
    a.download = name;
    document.body.append(a);
    a.click();
    a.remove();
  }
  window.__spike = { ok: true, stats };
} catch (err) {
  window.__spike = { ok: false, error: String(err) };
}
document.getElementById('log').textContent = JSON.stringify(window.__spike);
</script>
`;

async function serve() {
  const lib = await readFile(resolve(here, '../node_modules/pdf-lib/dist/pdf-lib.esm.min.js'));
  const server = createServer((req, res) => {
    if (req.url.startsWith('/pdf-lib.esm.min.js')) {
      res.writeHead(200, { 'content-type': 'text/javascript; charset=utf-8' });
      res.end(lib);
      return;
    }
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    res.end(PAGE_HTML);
  });
  return new Promise((r) =>
    server.listen(0, '127.0.0.1', () =>
      r({ url: `http://127.0.0.1:${server.address().port}/`, close: () => server.close() }),
    ),
  );
}

await mkdir(OUT, { recursive: true });
const site = await serve();
const browser = await chromium.launch({ channel: 'chrome' });
let result;
const saved = [];
try {
  const ctx = await browser.newContext({ acceptDownloads: true });
  const page = await ctx.newPage();
  const consoleErrors = [];
  page.on('pageerror', (e) => consoleErrors.push(String(e)));

  const downloads = [];
  page.on('download', (d) => downloads.push(d));
  await page.goto(site.url, { waitUntil: 'load' });
  await page.waitForFunction('window.__spike !== undefined', null, { timeout: 20_000 });
  result = await page.evaluate('window.__spike');

  for (const d of downloads) {
    const dest = resolve(OUT, d.suggestedFilename());
    await d.saveAs(dest);
    saved.push(dest);
  }
  if (consoleErrors.length) result.pageErrors = consoleErrors;
} finally {
  await browser.close();
  site.close();
}

console.log('\nD0-3 pdf-lib export spike\n');
if (!result?.ok) {
  console.error(`❌ in-page build failed: ${result?.error ?? 'unknown'}`);
  process.exit(1);
}
console.log(
  `Rasterised chart : ${result.stats.rasterPx.join(' x ')}px  (${result.stats.rasterBytes} bytes PNG)`,
);
console.log(`Effective chart resolution in the PDF: ~${result.stats.effectiveDpi} dpi`);
console.log(`PDF size         : ${result.stats.pdfBytes} bytes`);
console.log(`Saved            : ${saved.join(', ')}`);

const pdfPath = saved.find((p) => p.endsWith('.pdf'));
if (!pdfPath) {
  console.error('❌ no PDF download was captured — the blob download path does not work.');
  process.exit(1);
}
const head = (await readFile(pdfPath)).subarray(0, 5).toString('latin1');
const { stdout: info } = await run('pdfinfo', [pdfPath]);
await run('pdftoppm', [
  '-png',
  '-r',
  '110',
  '-f',
  '1',
  '-l',
  '1',
  pdfPath,
  resolve(OUT, 'page'),
]);

console.log(
  `\npdfinfo:\n${info
    .trim()
    .split('\n')
    .map((l) => '  ' + l)
    .join('\n')}`,
);
console.log(`\nRendered page 1 -> ${resolve(OUT, 'page-1.png')} (open it to judge legibility)`);

const ok =
  head === '%PDF-' &&
  /Pages:\s+1\b/.test(info) &&
  /Page size:\s+612 x 792 pts/.test(info) &&
  result.stats.effectiveDpi >= 200;
console.log(
  `\n${ok ? '✅' : '❌'} magic bytes ${head === '%PDF-' ? 'ok' : 'WRONG'}, ` +
    `1 page, Letter 612x792pt, chart embedded at print resolution.\n`,
);
if (!ok) process.exit(1);
