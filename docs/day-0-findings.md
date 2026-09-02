# Day 0 findings

Three de-risking spikes, run against Chrome 152.0.7977.82 on Linux 7.0.0-30-generic.
Only the things that change a downstream decision are recorded here.

Re-run any of them:

```bash
npm run probe:webmcp && npm run spike:measure && npm run spike:pdf
```

---

## D0-1 · WebMCP ground truth — PASS

Every row of [implementation-plan.md §2](./implementation-plan.md) reproduced exactly:
`document.modelContext` is the namespace, `navigator.modelContext` is `undefined`,
`registerTool()` returns a Promise, `getTools()` lists the tool with
`{name, title, description, inputSchema, annotations, origin, window}`,
`readOnlyHint` and `untrustedContentHint` round-trip, `consequentialHint` is dropped,
and `AbortController` is the only removal path.

**Two new facts, both load-bearing:**

1. **WebMCP requires a real secure-context origin, not just a secure context flag.**
   The first version of the probe used `page.setContent()` on `about:blank`;
   `window.isSecureContext` was `false` and `document.modelContext` was `undefined`
   even with the flag on. Served over loopback it appears immediately. This is a
   _third_ way to get a silent false negative on WebMCP support — alongside the wrong
   namespace and un-awaited registration — so `scripts/probe-webmcp.mjs` now serves
   its own page and asserts `isSecureContext` as a critical check.

2. **`executeTool()` rejects, it does not hang.** §2 recorded "did not settle"; here it
   settles as a rejection within ~1.5 s and the tool's own `execute` callback is never
   invoked. Same conclusion either way — it is unusable as a test harness — so
   architecture decision 1 (pure tool core with two thin callers) is unchanged.

## D0-2 · DOM measurement — PASS

Deterministic layout checks are achievable. **§31 must-have #9 stands; no renegotiation.**

4/4 seeded defects found by measurement, 0 false positives, page geometry exact at
816 × 1056 px (= 612 × 792 pt, so US Letter is the page size — clean integers in both
units, and `PX_PER_PT = 96/72` is exact).

| Check           | Measured as                                                              |
| --------------- | ------------------------------------------------------------------------ |
| text truncation | `scrollWidth − clientWidth > 0.5px` (found 722px of text in a 200px box) |
| text overflow   | `scrollHeight − clientHeight > 0.5px` (88px of text in a 44px box)       |
| out of bounds   | object rect vs. page content rect per side (156px past the right margin) |
| object overlap  | rect intersection area (50 × 50px)                                       |

Two decisions came out of it:

- **Measure an off-screen, unscaled copy of the page — never the visible canvas.**
  `getBoundingClientRect()` returns post-transform values: the same page under
  `transform: scale(0.5)` measured 408px instead of 816px. `PageCanvas` therefore
  renders a hidden measurement root at exact page size, and the zoomable preview is a
  separate element.
- **`await document.fonts.ready` before measuring**, or the first measurement runs
  against fallback metrics.

The first run reported two extra findings I had not planted: the "control" heading
really did truncate, and the out-of-bounds box really did overlap its neighbour. The
fixture was wrong and the validator was right — which is the evidence §10 asks for that
these checks measure rather than look up.

## D0-3 · pdf-lib export — PASS

A real, downloadable, single-page Letter PDF with typeset text and an SVG chart
rasterised through `OffscreenCanvas`, produced entirely client-side: no server, no
print dialog. `pdfinfo` confirms 1 page at 612 × 792 pt; page 1 rendered back with
`pdftoppm` is legible; the chart lands at ~274 dpi (SVG at 3× into a 504pt-wide box).

- **A `data:image/svg+xml` image does not taint the canvas.** `convertToBlob()`
  succeeded, so the SVG → PNG → PDF path needs no server-side rasteriser.
- **`Tagged: no`.** pdf-lib emits untagged PDFs. This is the concrete reason the
  accessible HTML companion carries the semantic load (§13.5) and why §3.3's
  refusal to claim PDF/UA is correct rather than modest.
- **Standard fonts only, for now.** Helvetica/Times needed no embedding. Using the
  pinned Inter / Source Serif 4 in the PDF requires `@pdf-lib/fontkit`; until then
  PDF metrics and HTML metrics differ, so the HTML preview stays the surface that
  geometry validation measures. Day 4 decision, not a Day 0 blocker.
- **The spike's own chart truncated a category label** ("Entered paid employment" →
  "tered paid employment") because the label was wider than its gutter. That is
  precisely the §13.4 truncated-label defect the 2:05 demo beat depends on detecting,
  and it confirms the check is `label text width > available gutter width`, measured,
  not asserted.

## Addendum · two more WebMCP facts, found by D1-6

Both surfaced on the first run of `tests/e2e/webmcp-registration.spec.ts` against Chrome
152, and both are recorded here rather than in the plan because they are facts about the
browser, not decisions about Vistect. Neither breaks registration; both change what a test
is allowed to assert.

1. **`getTools()` returns the tools sorted alphabetically by name, not in registration
   order.** `webmcp/register.ts` registers one at a time, in `TOOLS` order, and will keep
   doing so — that is about attributing a rejection to the tool that caused it — but the
   order an agent sees is Chrome's. The registration test asserts the published _set_, by
   name, and says so where it does it.

2. **`RegisteredTool.inputSchema` is reflected back as a JSON string.**
   `webmcp-types@0.1.6` declares it `object` and documents it as "a deep copy of the schema
   provided at tool registration"; Chrome hands back the serialised form. The object passed
   to `registerTool()` is accepted and its content survives intact, so nothing in
   `src/webmcp/` changes — but a caller reading a published schema has to `JSON.parse` it,
   and a test that did `Object.keys(schema.properties)` silently saw nothing. This is the
   same failure shape as v1's namespace error: a declared type agreeing with our belief
   while the browser did something else. `reflectedSchemaKind` in the spec now asserts the
   string, so the day Chrome honours its own IDL we are told.

---

The two spikes under `spikes/` are kept rather than deleted: each exits non-zero on
regression, so they are runnable Day 0 evidence rather than dead code. Delete them once
`src/measure/measurePage.ts` (D3-5) and `src/core/export/` (D4-3) supersede them.
