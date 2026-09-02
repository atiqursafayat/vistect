# Vistect v2 — MVP Implementation Plan

**Target:** hackathon demo (spec §31 must-haves, §34 three-minute script)
**Timeline:** 4 working days + a half-day of de-risking spikes
**Approach:** clean-room rebuild in `VisTect_v2/` from `docs/vistect_pts.md`. v1 is read-only reference; nothing is imported from it.
**Companion spec:** [vistect_pts.md](./vistect_pts.md)

---

## 1. The finding that shapes this plan

The spec's §19 example registers tools on `document.modelContext`. **The spec is right.** I verified this in the Chrome installed on this machine (152.0.7977.82):

```
--enable-blink-features=WebMCP  →  document.modelContext   = object  (registerTool, getTools, executeTool, ontoolchange)
                                   navigator.modelContext  = undefined
                                   'modelContext' in navigator = false
```

This matters because v1 (`../Vistect`) decided the opposite. Its `ADR-008 §2.1` states tools are registered on `navigator.modelContext`, and `packages/webmcp/src/types.ts:13` records `document.modelContext` as "wrong." That inverts reality. All 2,819 lines of v1's WebMCP layer register zero tools in any current Chrome, and — as that same ADR predicted about the opposite mistake — the failure is silent: the capability probe reads a permanently `undefined` value, graceful degradation engages on every load, and the mock test harness stays green because it mocks the same non-existent object.

That is the trap this plan is built to avoid. The process fix is §8, item **D1-6**: an end-to-end test in a real flagged Chrome asserting our tools appear in `getTools()`. Never a mock at the registration boundary.

---

## 2. Verified WebMCP ground truth

Everything below was observed in Chrome 152, not read from documentation. Reproduce with `npm run probe:webmcp` (added on Day 0).

| Fact                     | Value                                                                                      | Consequence for us                                                        |
| ------------------------ | ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------- |
| Namespace                | `document.modelContext`                                                                    | Single access point in `src/webmcp/types.ts`. One edit if the spec moves. |
| `registerTool()`         | returns a **Promise**                                                                      | Must be `await`ed. Fire-and-forget silently loses tools.                  |
| Prototype surface        | `registerTool`, `getTools`, `executeTool`, `ontoolchange`                                  | No `unregisterTool`; removal is `AbortController` only.                   |
| `getTools()`             | resolves; items are `{name, description, inputSchema, annotations, title, origin, window}` | Usable as the registration assertion in E2E.                              |
| `executeTool()`          | **did not settle**; our `execute` was never called                                         | Unusable as a test harness. Tests call the tool core directly (§5).       |
| `annotations` round-trip | `readOnlyHint` ✅ `untrustedContentHint` ✅ `consequentialHint` **dropped**                | The app owns its own approval gate. Never rely on the browser to confirm. |
| `webmcp-types@0.1.6`     | augments `interface Document`                                                              | Confirms the namespace independently. Declares no `consequentialHint`.    |
| Secure context           | `file://` and `localhost` qualify                                                          | No origin-trial token needed for local dev.                               |

Two operational notes:

- **Local dev requires a flag.** `google-chrome --enable-blink-features=WebMCP`. `--enable-features=WebMCP` also works; `--enable-features=WebMachineLearningModelContext` does not.
- **Keep it a true SPA.** Chromium issue 534655509 reports the renderer being killed on same-site navigation when an origin-trial token is served via `<meta http-equiv="origin-trial">`. We have no cross-page navigation anyway; this makes that a rule, not an accident.

---

## 3. What "working MVP" means

The acceptance test is the §34 script, run end to end, by keyboard only, with a screen reader active. Nothing is "done" until it survives that run.

**The golden path — six beats, each backed by real tools:**

| Beat                  | Agent calls                                                                                                                          | Must visibly/audibly happen                                                                                                                         |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0:20 Intent Contract  | `create_document`, `update_intent_contract`                                                                                          | Project exists; brief is readable in the navigator                                                                                                  |
| 0:40 Image authorship | `compare_image_candidates`, `record_image_interpretation`, `select_image`, `propose_image_crop`, `place_image_relative_to`           | Three candidates compared on deterministic metrics; agent's read is stored **labelled as interpretation**; selection lands in the ledger unapproved |
| 1:10 Diagram repair   | `create_diagram`, `add_diagram_node`, `connect_diagram_nodes`, `validate_diagram_structure`, `trace_diagram_path`                    | Validator finds the missing return path from the unsuccessful-internship node; user directs the fix                                                 |
| 1:40 Honest chart     | `import_chart_data`, `recommend_chart_types`, `create_chart`, `validate_chart_integrity`                                             | Recommender states, with a rule-based reason, that a line chart would imply a false timeline                                                        |
| 2:05 Visual audit     | `run_document_checks`                                                                                                                | Finds a truncated chart label, a low-contrast caption, and a reading-order mismatch — all three real, all three deterministic                       |
| 2:30 Final authority  | `list_unresolved_decisions`, `approve_visual_decision`, `preview_export_manifest`, `lock_document_version`, `finalize_locked_export` | Zero unapproved decisions; manifest read aloud; PDF + HTML hash-linked to the locked version                                                        |

The three defects in the 2:05 beat are seeded deliberately in the demo fixture, and the validators must find them by measurement — not by a hardcoded list. A validator that only finds planted defects is a prop, not a product.

### In scope (the 14 must-haves)

Semantic multipage document model · screen-reader-operable navigator · Intent Contract · image upload + three-candidate comparison · semantic crop and placement · agent-directed structured diagram creation · diagram structural validation · one accessible chart workflow · deterministic layout and accessibility checks · Visual Decision Ledger · unapproved-decision review · version-bound PDF + HTML export · meaningful WebMCP tools · visible agent action history.

### Explicitly out

PDF import, OCR, Understand Mode, SVG upload, icon library and consistency checks, sonification, privacy receipt, multi-model disagreement, tactile SVG profile, DOCX, collaboration. All are §31 stretch items or later releases. **Do not start any of them until §8 Day 4 passes.**

---

## 4. Architecture

**One Vite SPA, not a monorepo.** v1 split this into eight workspace packages with TypeScript project references. In a four-day sprint that buys nothing and costs a build graph, eight `package.json` files, and cross-package type resolution debugging. Module boundaries are enforced by directory and by an ESLint `import/no-restricted-paths` rule instead — same discipline, no build tax.

The one boundary that is real and non-negotiable is **`src/core/` has zero browser and zero React imports.** Everything consequential lives there and is unit-testable in Node.

```
VisTect_v2/
├── docs/{vistect_pts.md, implementation-plan.md}
├── index.html · package.json · vite.config.ts · tsconfig.json · playwright.config.ts
├── scripts/probe-webmcp.mjs        # §2 reproducibility
├── src/
│   ├── core/                       # pure. no DOM, no React. the whole product logic.
│   │   ├── model.ts                # §8 DocumentProject / Page / DocumentObject
│   │   ├── store.ts                # append-only command log + reducer + version counter
│   │   ├── commands.ts             # every mutation defined once
│   │   ├── ledger.ts               # §15 VisualDecision
│   │   ├── validate/{geometry,contrast,graph,chart,a11y}.ts
│   │   ├── chart/                  # dataset → scales → SVG spec + data table + narrative
│   │   ├── diagram/                # graph model + dagre adapter + SVG spec
│   │   ├── export/                 # canonical JSON, SHA-256, manifest, HTML bundle
│   │   └── tools/                  # one file per tool: zod schema + pure handler
│   │       └── registry.ts         # assembles all of them
│   ├── webmcp/{types,register,probe}.ts   # the ONLY place document.modelContext is touched
│   ├── measure/measurePage.ts       # browser-only: DOM rects → geometry validator input
│   ├── persist/idb.ts               # IndexedDB autosave
│   ├── ui/                          # App, Announcer, Navigator, ObjectExplorer,
│   │                                # DecisionQueue, WarningQueue, ActivityStream,
│   │                                # PageCanvas, DevAgentConsole, styles.css
│   └── main.tsx
└── tests/{unit/**, e2e/webmcp-registration.spec.ts, e2e/golden-path.spec.ts}
```

### Data flow

```
agent ──document.modelContext.registerTool──▶ src/webmcp/register.ts
                                                      │  parse + validate (zod)
                                                      ▼
DevAgentConsole ──────────────────────────▶ src/core/tools/*  (pure handler)
                                                      │  emits Command
                                                      ▼
                                             src/core/store.ts
                                          version++ · log append · ledger entry
                                                      │
                        ┌─────────────────────────────┼──────────────────────┐
                        ▼                             ▼                      ▼
                  ui/PageCanvas              ui/Announcer (aria-live)   persist/idb
                        │  real DOM
                        ▼
                measure/measurePage ──rects──▶ core/validate/geometry
```

### Five load-bearing decisions

**1. The tool core is pure and has two callers.** Every tool is `(state, input) => { commands, result }` with no browser dependency. `src/webmcp/register.ts` is a thin adapter; `ui/DevAgentConsole` is a second one. This exists because `executeTool()` does not settle without an attached agent (§2), so it cannot be a test harness — and because **if no WebMCP agent is available on demo day, the console drives the identical code path and the demo still runs.** That is the single highest-value insurance policy in this plan.

**2. One command log, not event-sourced CQRS.** An append-only `Command[]` plus a reducer over it gives us, for free and in about 120 lines: undo, `expectedDocumentVersion` stale-write rejection (§23.3), the decision ledger's provenance, and the version-bound export. A separate bus/aggregate/projection layer buys nothing here.

**3. Geometry validation measures real DOM.** You cannot check overlap, overflow, or truncation without a layout engine, and we are not writing one. `PageCanvas` renders each page into a fixed-size print-CSS container; `measurePage.ts` reads `getBoundingClientRect`, `scrollWidth`, `scrollHeight`; `core/validate/geometry.ts` is a pure function over those rects. Truncation is `scrollWidth > clientWidth`, overflow is `scrollHeight > clientHeight`, overlap is rect intersection, out-of-bounds is rect vs. page rect. Deterministic given the font set, which we self-host and pin.

**4. The app supplies facts; the agent supplies interpretation.** There is no vision API and no image-analysis backend. `compare_image_candidates` returns only deterministic metrics (pixel dimensions, aspect ratio, effective resolution at the placed size, file size, EXIF presence, dominant colours, contrast against the page background, crop headroom). The agent — which already has vision — reads the images and calls `record_image_interpretation`, which stores its assessment tagged `evidenceType: "model_assessment"` with the agent's name and the user's approval still pending. This needs zero inference budget, and it _is_ §4.3's separation of facts from judgments rather than a retrofit of it.

**5. The app owns the approval gate.** `consequentialHint` is silently dropped by Chrome 152 (§2), so browser-enforced confirmation does not exist. Consequential tools therefore **stage** and return `"Staged. Awaiting your approval."`; a decision appears in the queue; only a separate user action in the UI approves it. No tool both stages and approves. We set `consequentialHint: true` anyway as forward-compatible progressive enhancement — but nothing depends on it.

---

## 5. Stack

| Concern        | Choice                                           | Why this and not the alternative                                                                                                                                                |
| -------------- | ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| App            | Vite + React 19 + TS `strict`                    | Fastest cold start; no SSR need. Next.js adds a server we do not want in a local-first product.                                                                                 |
| Styling        | Hand-written CSS + custom properties             | Must control focus rings, `@media print`, `forced-colors`, `prefers-reduced-motion` precisely. Tailwind fights all four.                                                        |
| Tool schemas   | `zod` + `zod-to-json-schema`                     | One schema per tool is both the runtime guard inside `execute` and the published `inputSchema`. They cannot drift.                                                              |
| WebMCP types   | `webmcp-types@0.1.6`                             | Verified to augment `Document`. Re-exported through one file so a spec move is one edit.                                                                                        |
| State          | `zustand` (vanilla store)                        | The store must be readable from `execute()` outside React. A vanilla store with a React binding is exactly that shape.                                                          |
| Persistence    | `idb` + IndexedDB                                | Projects hold image blobs; `localStorage` cannot.                                                                                                                               |
| Diagram layout | `dagre`                                          | Synchronous. `elkjs` is better quality but async + web worker — an afternoon we do not have.                                                                                    |
| Charts         | Hand-rolled SVG                                  | ~200 lines for bar + line, and we own the scale function, which is what makes `validate_chart_integrity` truthful. Vega-Lite is large and its a11y output is not ours to shape. |
| PDF            | `pdf-lib`                                        | One-click download, no print dialog on stage. Charts/diagrams rasterised via offscreen canvas.                                                                                  |
| Tests          | `vitest` + `playwright` + `@axe-core/playwright` | See §9.                                                                                                                                                                         |

**Deliberately absent:** no backend, no auth, no vision API, no `dompurify` (SVG upload is out of scope, so the sanitiser has nothing to sanitise — if SVG upload is ever added, it comes back the same day).

---

## 6. The tool surface: 30 tools, not 90

Spec §18.2–18.11 enumerates roughly ninety tools. Shipping that is actively harmful: agent tool-selection accuracy degrades as the surface grows, and several of those names overlap enough that a model cannot tell which to pick (`inspect_chart` appears in both §18.3 and §18.7; `trace_diagram_path` in both §18.3 and §18.6). We ship the 30 the §34 script actually exercises, each with one job.

Every write tool takes `expectedDocumentVersion: integer` and is rejected with an actionable message if stale. Every tool returns **one readable lead sentence, then the structured payload** — that string is what the agent reads back and what the screen reader announces.

| Tool                           | Kind  | `readOnly` | `untrusted` | Stages a decision |
| ------------------------------ | ----- | ---------- | ----------- | ----------------- |
| `create_document`              | write |            |             |                   |
| `update_intent_contract`       | write |            |             |                   |
| `get_document_overview`        | read  | ✅         | ✅          |                   |
| `get_document_structure`       | read  | ✅         | ✅          |                   |
| `inspect_page`                 | read  | ✅         | ✅          |                   |
| `inspect_visual_object`        | read  | ✅         | ✅          |                   |
| `add_text_section`             | write |            |             |                   |
| `update_text_content`          | write |            |             |                   |
| `compare_image_candidates`     | read  | ✅         | ✅          |                   |
| `record_image_interpretation`  | write |            | ✅          |                   |
| `select_image`                 | write |            |             | ✅                |
| `propose_image_crop`           | write |            |             | ✅                |
| `place_image_relative_to`      | write |            |             | ✅                |
| `generate_contextual_alt_text` | write |            | ✅          | ✅                |
| `create_diagram`               | write |            |             |                   |
| `add_diagram_node`             | write |            |             |                   |
| `connect_diagram_nodes`        | write |            |             |                   |
| `validate_diagram_structure`   | read  | ✅         |             |                   |
| `trace_diagram_path`           | read  | ✅         |             |                   |
| `import_chart_data`            | write |            | ✅          |                   |
| `recommend_chart_types`        | read  | ✅         |             |                   |
| `create_chart`                 | write |            |             | ✅                |
| `validate_chart_integrity`     | read  | ✅         |             |                   |
| `run_document_checks`          | read  | ✅         |             |                   |
| `list_unresolved_decisions`    | read  | ✅         |             |                   |
| `approve_visual_decision`      | write |            |             |                   |
| `reject_visual_decision`       | write |            |             |                   |
| `preview_export_manifest`      | read  | ✅         |             |                   |
| `lock_document_version`        | write |            |             |                   |
| `finalize_locked_export`       | write |            |             |                   |

**Everything in §18 not on this list is deferred, and §18.12's forbidden tools stay forbidden.**

`untrustedContentHint` is set on every tool whose output can carry text the user or an uploaded file supplied — the §23.1 prompt-injection threat. Imported text is never interpolated into a tool description.

---

## 7. Accessibility — and one correction to the spec

Spec §21.1 and §32.3 require NVDA. **NVDA is Windows-only and this is a Linux machine.** Orca is installed at `/usr/bin/orca`, so real screen-reader verification is possible here, but it is not the screen reader the spec names. Plan accordingly:

- **Every day, locally:** keyboard-only Playwright walk + `axe-core` on every view. Non-negotiable, automated, blocks the build.
- **Day 4, locally:** manual Orca pass over the golden path, at 200% and 400% zoom, in forced-colors mode.
- **NVDA:** only if a Windows machine is available before the demo. If it is not, the accessibility statement says "verified with Orca on Linux; NVDA verification pending" — an honest limitation is worth more than an unverified claim, and §35 already commits us to publishing known limitations.

Implementation rules, applied from the first component rather than retrofitted:

- Semantic HTML first; ARIA only where native semantics genuinely fall short. Landmarks for navigator / editor / decisions / warnings / activity.
- **One** `aria-live="polite"` announcer for the whole app. Agent actions announce in the §21.3 shape: what changed, what it means, what is now unapproved, which shortcut reviews it.
- **Focus is never moved by an agent action.** The announcement tells the user where to go; the user decides when to go. The only exception is a `blocking`-severity finding, which the spec's own §21.3 wording permits.
- Roving tabindex on the navigator tree; visible focus ring everywhere; `:focus-visible` never suppressed.
- No color-only status, no drag-only operation, no hover-only information.
- Every object exposes the §21.4 field set in the Object Explorer, including approval state and provenance.

---

## 8. Day-by-day

Each unit has a **done-when** that is checkable by someone else. If a done-when cannot be demonstrated, the day is not finished — pull from the cut-line in §10 rather than declaring it done.

### Day 0 (half day) — kill the architectural risks first

The entire point of this half day is that v1 spent weeks on an unvalidated foundational assumption. Three throwaway spikes, ~50 lines each, thrown away afterwards.

- **D0-1** `scripts/probe-webmcp.mjs` — reproduce §2 on demand: launch flagged Chrome, register a tool, assert `document.modelContext` exists and `getTools()` contains it. **Done when** it prints the §2 table and exits non-zero if the namespace ever moves.
- **D0-2** DOM-measurement spike — one hardcoded page in a print-CSS container; measure a deliberately overflowing heading and two overlapping boxes. **Done when** measured numbers correctly identify both defects. _If this fails, deterministic layout checks are not achievable in four days and §31 must-have #9 gets renegotiated on Day 0, not Day 4._
- **D0-3** `pdf-lib` spike — one page with a heading, a paragraph, and an SVG chart rasterised through an offscreen canvas. **Done when** a real `.pdf` downloads and the chart is legible.

### Day 1 — spine: state, tools, WebMCP, announcer

- **D1-1** Scaffold: Vite + React + TS strict, ESLint with `jsx-a11y` and the `import/no-restricted-paths` rule that forbids `src/core/**` from importing React or DOM. Self-host and pin the two fonts.
- **D1-2** `core/model.ts` — §8.2's types verbatim, plus `AccessibilityMetadata` (§8.3), `ApprovalState` (§8.4), `ValidationFinding` (§16.1), `VisualDecision` (§15).
- **D1-3** `core/store.ts` + `core/commands.ts` — command log, reducer, version counter, stale-write rejection, undo. **Done when** unit tests prove: every command bumps the version; a write with a stale `expectedDocumentVersion` is refused with an actionable message; changing an approved object flips its approval to `stale` (§27).
- **D1-4** `core/tools/` — the first six tools (`create_document`, `update_intent_contract`, `get_document_overview`, `get_document_structure`, `add_text_section`, `inspect_page`) as pure handlers with zod schemas.
- **D1-5** `webmcp/{types,register,probe}.ts` — awaited registration, `AbortController` scoping, capability probe, graceful degradation when `document.modelContext` is absent.
- **D1-6** **`tests/e2e/webmcp-registration.spec.ts`** — Playwright, `channel: 'chrome'`, `args: ['--enable-blink-features=WebMCP']`. Asserts `getTools()` returns all registered tool names with correct annotations. **This is the test v1 needed and did not have. It runs in CI from Day 1 and it never mocks the browser object.**
- **D1-7** `ui/` shell — landmarks, `Announcer`, `Navigator` tree, `ActivityStream`, `DevAgentConsole`.
- **D1-8** `persist/idb.ts` autosave.

**Day 1 done when:** a flagged Chrome loads the app, a real agent (or the DevAgentConsole) calls `create_document` then `add_text_section`, the page appears, the announcer says what changed, the activity stream lists both calls, a reload restores the project, and `npm run test:e2e` passes the registration assertion.

### Day 2 — the two visual object types

- **D2-1** `core/diagram/` — graph model (§12.2), `dagre` layout adapter, SVG spec generator, keyboard-navigable HTML graph.
- **D2-2** `core/validate/graph.ts` — §12.4 structural checks: disconnected nodes, unreachable nodes, missing decision outcomes, unexpected cycles, missing entry/terminal, duplicate edges. Pure graph algorithms, fully unit-tested. **This is the demo's 1:10 beat and it must find the missing return path by reachability analysis, not by a fixture lookup.**
- **D2-3** Diagram tools: `create_diagram`, `add_diagram_node`, `connect_diagram_nodes`, `validate_diagram_structure`, `trace_diagram_path`, plus short alt text and long description generation.
- **D2-4** `core/chart/` — CSV parse, schema inference, rule-based `recommend_chart_types` with stated reasons (the "line chart would imply a timeline" answer must fall out of a _rule about categorical vs. temporal data_, §13.3, not a canned string), hand-rolled bar + line SVG, accessible data table, narrative.
- **D2-5** `core/validate/chart.ts` — §13.4 integrity: rendered values match source values, axis labels and units present, category labels fit, legend matches series, baseline sanity, source note and data table present.
- **D2-6** Chart tools: `import_chart_data`, `recommend_chart_types`, `create_chart`, `validate_chart_integrity`.

**Day 2 done when:** the agent builds the §34 participant-journey diagram, `validate_diagram_structure` reports the missing return path, `connect_diagram_nodes` fixes it, re-validation is clean — and a CSV becomes a horizontal bar chart with a data table whose numbers a unit test proves identical to the source.

> Load the **`dataviz` skill** before writing the first line of `core/chart/` — colour, axis, and legend decisions are made there, once.

### Day 3 — images, checks, and the ledger

- **D3-1** Image upload (PNG/JPEG/WebP only), blob storage in IndexedDB, deterministic metric extraction. MIME allowlist and size cap enforced (§23.2).
- **D3-2** `compare_image_candidates` — the deterministic metrics table for 2–4 candidates. No interpretation in the output.
- **D3-3** `record_image_interpretation` — stores the agent's assessment as `evidenceType: "model_assessment"` with its confidence, its uncertainties kept separate from its observations (§9.7), and approval pending. **Done when** the UI visibly distinguishes fact, interpretation, uncertainty, and human decision on the same screen.
- **D3-4** Semantic crop (§11.5 instruction set → crop rect), crop validation (§11.6: effective resolution after crop, aspect ratio, subject region retained, title-safe area), `place_image_relative_to` with the §19 relationship enum.
- **D3-5** `measure/measurePage.ts` + `core/validate/geometry.ts` + `core/validate/contrast.ts` + `core/validate/a11y.ts` — the §16.2 deterministic checks: overlap, out-of-bounds, text overflow, truncation, minimum size, heading hierarchy, WCAG contrast ratios, missing alt text, reading-order defects, missing language.
- **D3-6** `run_document_checks` and the `WarningQueue` — each finding shows scope, severity, `evidenceType`, evidence, and suggested actions, and is navigable by keyboard.
- **D3-7** `core/ledger.ts` + `DecisionQueue` + `list_unresolved_decisions` / `approve_visual_decision` / `reject_visual_decision`. Staging and approval are separate code paths (§4, decision 5).

**Day 3 done when:** three candidate images are compared and one is selected, cropped, and placed; `run_document_checks` finds the three seeded defects (truncated chart label, low-contrast caption, reading-order mismatch) **by measurement**; and the decision queue shows every staged decision as unapproved until the user acts.

### Day 4 — lock, export, and harden

- **D4-1** `core/export/` — canonical JSON serialisation, SHA-256 via Web Crypto, `preview_export_manifest` producing the §28 manifest, `lock_document_version`, `finalize_locked_export`.
- **D4-2** Version-bound finalisation (§23.3). **Done when** a unit test locks a document, mutates one object, and proves the export is refused; and a second test proves the exported artifact's hash matches the manifest's.
- **D4-3** PDF export via `pdf-lib`; accessible HTML export bundle with chart data tables, diagram SVGs, and the accessibility manifest.
- **D4-4** `tests/e2e/golden-path.spec.ts` — the full §34 script, keyboard only, `axe` clean at every step.
- **D4-5** Manual Orca pass; 200% and 400% zoom; forced-colors mode; reduced-motion.
- **D4-6** Demo hardening: seed the fixture project, rehearse the three-minute script twice end to end, and verify the DevAgentConsole reproduces every beat in case the agent is unavailable on the day.

**Day 4 done when:** the §34 script runs start to finish, by keyboard, with Orca active, and produces a PDF plus an accessible HTML bundle whose hashes match a manifest bound to the locked version.

---

## 9. Testing, proportionate to four days

Spec §32 describes a full test programme. Four days buys the subset with the highest defect-catch rate per hour. The rule: **test the pure core exhaustively and the browser boundary end-to-end; skip everything in between.**

**Unit (`vitest`, on `src/core/**`)** — cheap, fast, and where the real bugs live:
graph reachability and cycle detection · missing decision outcomes · edge-crossing count · label and text overflow arithmetic · WCAG contrast calculation · chart data ↔ rendered value equality · CSV schema inference · version increment · stale-write rejection · approval invalidation on upstream change · canonical JSON stability · manifest generation · export hash matching.

**End-to-end (`playwright`, real flagged Chrome)** — exactly two specs:

1. `webmcp-registration.spec.ts` — the tools are actually registered, with the right annotations. **Never mocked.**
2. `golden-path.spec.ts` — the §34 script, keyboard-only, with `axe-core` asserted clean at every view.

**Integration cases folded into the two E2E specs** (§32.2): agent creates a page and object · changed diagram invalidates its approval · changed dataset marks the chart stale · a stale agent write is rejected · a locked document cannot be modified · export uses the locked version · imported text cannot alter tool metadata.

**Skipped on purpose:** visual regression, cross-browser (WebMCP is Chrome-only today), load testing, NVDA (§7).

CI (`.github/workflows/ci.yml`): `typecheck → lint → unit → build → e2e`. Any red blocks merge.

**And one hygiene rule learned from v1:** `dist/` is never committed. v1 has 122,000 lines of generated `.d.ts` in git, which is most of its apparent size. `.gitignore` covers `dist/`, `coverage/`, and `test-results/` from the first commit.

---

## 10. Risks, and the cut-line

| Risk                                                    | Mitigation                                                                                                                                                                                                                                            |
| ------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **WebMCP API moves again mid-sprint**                   | Every access goes through `src/webmcp/types.ts`. `scripts/probe-webmcp.mjs` runs in CI and fails loudly on a namespace change. This is the v1 failure mode, now instrumented.                                                                         |
| **No WebMCP-capable agent on demo day**                 | `DevAgentConsole` drives the identical tool core. Rehearsed on Day 4 as a first-class path, not a hack.                                                                                                                                               |
| **DOM measurement proves unworkable**                   | Discovered on Day 0, not Day 4. Fallback: keep contrast, alt-text, reading-order, heading-hierarchy, chart-integrity and diagram checks — all of which are pure and need no geometry — and state plainly that geometric checks are not in this build. |
| **Deterministic checks that only find planted defects** | Every validator is unit-tested against inputs the demo fixture never contains.                                                                                                                                                                        |
| **14 must-haves in 4 days is genuinely tight**          | The cut-line below. Cut in this order, and say what was cut.                                                                                                                                                                                          |
| **Rasterised charts weaken the PDF's accessibility**    | The accessible HTML companion and data tables carry the semantic load — which is the spec's own design (§13.5), not a workaround. Say so rather than overclaiming PDF/UA (§3.3 already disclaims it).                                                 |
| **Subjective AI judgment presented as fact**            | `evidenceType` is a required field on every finding and decision, surfaced in the UI, never defaulted.                                                                                                                                                |

**Cut-line — sacrifice from the bottom up, and only from the bottom:**

1. `update_text_content`, `reject_visual_decision` — symmetric conveniences.
2. `trace_diagram_path` — nonvisual understanding is stronger with it, but the diagram beat survives without it.
3. Undo — the command log makes it nearly free, but it is not in the §34 script.
4. Line chart — horizontal bar alone satisfies must-have #8.
5. Semantic crop (`propose_image_crop`) — degrade to selection and placement only.
6. PDF export — ship the accessible HTML bundle plus the hashed manifest, and demo the version binding on that. **Weakens the story; do not cut this before 1–5.**

**Never cut:** the semantic document model, the screen-reader-operable navigator, deterministic validation that finds a real defect, the decision ledger with unapproved-state review, or version-bound export. Those five _are_ the product's claim. Everything else is evidence for them.

---

## 11. Open questions

None are blocking; each has a stated default so work can start immediately.

1. **Which agent drives the demo?** WebMCP needs an agent that speaks it — Gemini in Chrome, or an extension-based agent. _Default:_ build against `DevAgentConsole` and the probe script, and confirm the real agent on Day 1 rather than Day 4.
2. **Is the demo local or deployed?** _Default:_ local, `--enable-blink-features=WebMCP`, no origin-trial token. If it must be deployed, add HTTPS plus a `<meta http-equiv="origin-trial">` token and keep the no-navigation SPA rule from §2.
3. **Is a Windows machine available for NVDA?** _Default:_ no — verify with Orca and publish that as a known limitation (§7).

---

## 12. First commands

```bash
cd /home/atiqur-safayat/Development/Development/VisTect_v2 && git init && npm create vite@latest . -- --template react-ts
```

```bash
npm i zod zod-to-json-schema zustand idb dagre pdf-lib nanoid && npm i -D webmcp-types vitest @vitest/coverage-v8 @playwright/test @axe-core/playwright eslint eslint-plugin-jsx-a11y typescript-eslint prettier
```

Launch the dev browser with WebMCP enabled:

```bash
google-chrome --enable-blink-features=WebMCP http://localhost:5173
```

Reproduce the §2 findings at any time:

```bash
node scripts/probe-webmcp.mjs
```
