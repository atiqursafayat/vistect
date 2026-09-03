# 10 — Test Strategy

> Formats: unit (Vitest), integration (Vitest + in-memory store), contract (WebMCP registry vs pinned schemas), E2E (Playwright + axe), performance (budget), security (see `07-security-review.md` §3). Coverage targets: domain/graph/charting ≥90% branch; app ≥80%.

## 1. Unit tests — domain core
- **Versioning:** every content command increments version; no-op commands don't; concurrent stale `expectedDocumentVersion` rejected (typed error carries current version).
- **State machines:** exhaustive transition tables — legal transitions apply; illegal raise typed errors (locked mutation, agent approval, unlock side-effects, stale cascades per I-04..I-08).
- **Reading order:** reorder independence, id uniqueness (I-09), decorative exclusion.
- **Invariants I-01..I-15:** one test each, named `invariant-XX.test.ts`.
- **Event chain HMAC:** tampered event → load fails → snapshot recovery.
- **Undo:** depth 100; approval undo requires new approval (R-12).

## 2. Unit tests — graph package
- Reachability (BFS from entry), unreachable node detection, cycle detection (DFS colors), duplicate/ambiguous edges, missing decision outcomes, disconnected components.
- Edge-crossing segment intersection math; node overlap AABB; label-overflow bounds math; bend counting; contrast ratio (WCAG formula, 4.5/3.0 thresholds); color-only meaning detection.
- Layout determinism: same seed → identical geometry (golden files).
- Path tracing: primary/alternative routes; entry/terminal summaries.

## 3. Unit tests — charting
- Data-to-pixel equality: rendered bar length / point position ↔ value math within 0.5px.
- Label-fit: rotation/truncation thresholds; category count vs available width.
- Baseline rule (R-04): non-zero baseline produces warning finding; override requires decision.
- Recommendation rules table: categorical→bar, temporal→line, long labels→horizontal bar, series-count guards (R-05).
- Percent/total coherence; time-axis ordering; legend/series equality.
- Table generation: column types, totals, SR-friendly captioning inputs.

## 4. Unit tests — layout engine / templates
- Constraint resolution: each relationship (before/after/above/below/left/right/inside) across all 10 templates; bounds within page margins; keep-together honored; distribute-evenly math.
- Overflow detection: text estimation vs region bounds (both tolerance edges).
- Geometry golden files per template (preview === validation === export inputs, ARCH-02).

## 5. Unit tests — image
- Sanitizer corpus (30+ vectors) — strip/reject assertions.
- Crop validation: face/subject truncation (region math), resolution-after-crop, aspect, title-safe, focal point.
- Semantic crop instruction parser: each §11.5 instruction → deterministic crop spec.
- Alt-text gate: uncertain claims excluded (R-02); decorative vs informative.

## 6. Integration tests (command bus + store + engines, in-memory IndexedDB shim)
- Given a draft project, when agent creates page+object via tool, then version++, activity logged, announcement queued, object `proposed`.
- Given an approved object, when a diagram node changes, then object stale + decision re-opened + checks invalidated.
- Given a changed dataset, when charts depend on it, then charts stale.
- Given locked document, when any mutation attempted (UI or tool), then `LockViolation` and no event appended.
- Given export approved, when any mutation occurs, when finalize called, then rejected (hash mismatch).
- Given imported PDF text containing injection strings, when tools registered/execed, then descriptions unchanged, strings inert.
- Given two projects, when tool references foreign object id, then NotFound (scoped).

## 7. Contract tests — WebMCP registry
- Every tool: name matches `^[a-z][a-z0-9_]+$` verb-based; description is static constant (no interpolation — AST-level check on registry source); inputSchema has `additionalProperties:false`, `required` ⊆ properties; execute result shape `{content:[{type:"text"}]}`.
- Snapshot: full registry (names/descriptions/schemas) byte-identical to pinned JSON; diff fails CI.
- Forbidden-pattern scan (§18.12).
- Read/write classification: write tools require `expectedDocumentVersion`; read tools contain no mutation imports (dependency-cruiser rule).
- Mock `document.modelContext` harness: register → executeTool → assert dispatch, gate (rate limit, approval staging), unregister on project close, `AbortSignal` honored.

## 8. E2E tests (Playwright) — user journeys
1. **Create-from-scratch (keyboard only):** new project → intent contract → outline → add pages/text → reorder → navigator travel → object explorer inspection → autosave indicator → reload persistence.
2. **Image authorship:** upload 3 images → inspect analysis records → compare candidates (SR labels) → select (decision card) → semantic crop → alt text approve → place after heading.
3. **Diagram:** create process diagram via tools → validation finds unreachable node → repair → long description generated → SVG export exists.
4. **Chart:** import CSV → recommendation (categorical→hbar) → create → integrity checks → table present → narrative staged → approve.
5. **Validation/export:** run full audit → resolve/blocking findings → Alt+U empty → lock → manifest review → export PDF+HTML → hashes recorded → files downloadable; assert PDF bytes stable for identical locked version (determinism).
6. **Agent flow (mock agent page):** executeTool sequences reproducing spec §34 demo beats; activity stream entries; announcements asserted in live region.
7. **No-agent degradation:** capability probe false → tools absent, UI fully operable.
8. **A11y:** axe on every route (zero critical); focus-trace assertions; 320px reflow; 200%/400% zoom spot set; reduced-motion CSS applied.

## 9. Regression
- Golden files: template geometry, chart SVG output, ELK layouts, export PDF bytes (per seeded project version), registry snapshot.
- Bug protocol: every fixed defect gets a named regression test in the suite of its layer.

## 10. Performance tests (budget, CI-warn, release-block)
- 20-page/300-object project: layout recompute < 250ms; full validation < 2s; export PDF < 15s; ELK 60-node layout < 1.5s (worker); initial bundle < 250KB gz (excl. lazy); Lighthouse a11y ≥ 95, TTI < 3s.

## 11. Security tests
See `07-security-review.md` §3 (10 CI-blocking suites). E2E additionally asserts zero non-asset network calls during authoring/export (zero-egress, PRIV-01).

## 12. Accessibility scripted tests (manual, per phase gate)
Per `08-accessibility-review.md` §5 matrix: NVDA pass scripts recorded in `docs/validation/phase-N-nvda.md`; JAWS/VoiceOver reduced sets at phases 5/7.

## 13. Given/When/Then scenario bank (key examples; full bank lives with each feature's tests)
- **G** draft project with 1 page **W** `create_page` via tool with stale version **T** StaleVersionError; version unchanged; no activity mutation entry.
- **G** approved cover image + approved alt text **W** crop changes to exclude detected face **T** alt-text & placement decisions stale; finding opened; announcement mentions review.
- **G** decision tree diagram with node lacking "No" outcome **W** validation runs **T** finding severity=error, category=diagram.missingDecisionOutcome, suggestedActions=[add outcome].
- **G** CSV with 12 long category labels **W** `recommend_chart_types` **T** horizontal-bar ranked first with reason "label-fit"; line flagged "implies timeline".
- **G** locked & exported version 24 **W** user unlocks, edits text, re-locks, finalizes **T** new version 25 manifest+export; old export hash ≠ new; old job marked superseded.
- **G** agent streams 200 tool calls in 10s **W** gate active **T** first N pass, remainder RateLimitedError; no state corruption; activity stream intact.
- **G** SVG containing `<script>` in `<defs>` **W** upload **T** sanitized (script stripped) or rejected if structural; never stored raw.
