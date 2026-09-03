# 12 — Implementation Plan (per phase)

> For every phase: Deliverables · Files · Interfaces · Storage · Tests · Docs · Migration · Rollback. Bite-sized TDD task sequences live in `docs/plans/2026-09-04-vistect-r1.md`.

## Phase 0 — Planning + Scaffold (this suite)
- **Deliverables:** docs 01–15, ADR-001..008, execution plan; monorepo; CI.
- **Files:** root `package.json`, `pnpm-workspace.yaml`, `tsconfig.base.json`, `tooling/{eslint,prettier}.config`, `.github/workflows/ci.yml`, `LICENSE`, `README.md`, package skeletons.
- **Interfaces:** none (tooling only). **Storage:** none. **Tests:** CI self-test (hello vitest). **Docs:** this suite.
- **Migration/Rollback:** n/a (greenfield).

## Phase 1 — Document Foundation
- **Deliverables:** F-1.1..F-1.12.
- **Files:** `packages/domain/src/{schema,events,commands,bus,machines,invariants,decisions,toolSchemas}/…`; `packages/storage/src/{eventStore,snapshots,keys,quota}/…`; `apps/web/src/{app,ui,features/{navigator,explorer,intent,editor},state,announce}/…`; `packages/render-html/src/…`; `packages/webmcp/src/{registry,compiler,gate,activity,probe}/…`.
- **Interfaces:** `CommandBus.dispatch(cmd, expectedVersion) → Result`; `EventStore.append/subscribe/load`; `LayoutEngine.resolve(project) → ResolvedLayout`; tool registration API.
- **Storage:** IndexedDB schemas `vistect-events/-snapshots/-assets/-meta` v1.
- **Tests:** per `10-test-strategy.md` §1, §4, §6 (subset), §7 (subset), §8.1; gate: keyboard + NVDA navigator pass.
- **Docs:** README quickstart; ADR-006 update if state machines diverge.
- **Migration:** storage v1 baseline. **Rollback:** pre-event-store dev state n/a; forward-only from v1.

## Phase 2 — Image Workflow
- **Files:** `apps/web/src/services/asset/{upload,sanitize,metadata,crop,altText}.ts`; `packages/domain/src/schema/asset.ts`; image tools in `packages/webmcp/src/tools/image.ts`.
- **Interfaces:** `sanitizeSvg(text) → SafeSvg | Rejection`; `proposeCrop(assetId, instruction) → CropSpec`; validation hooks into finding registry.
- **Storage:** asset blobs + content-hash index.
- **Tests:** sanitizer corpus; crop math; comparison E2E (SR labels); injection corpus subset.
- **Migration:** storage v1→v2 (assets store indexes) with versioned open handler. **Rollback:** keep v1 handler until v2 proven; assets are additive (old builds ignore new index).

## Phase 3 — Diagram Workflow
- **Files:** `packages/graph/src/{model,topology,geometry,layout/{elk,dagre},describe,svg}.ts`; diagram tools file; `apps/web/src/features/diagram/…`.
- **Interfaces:** `validateStructure(diagram) → Finding[]`; `computeLayout(diagram, seed) → Geometry`; `tracePaths(diagram) → Routes`.
- **Storage:** diagrams inside project state (no new stores).
- **Tests:** §2 graph units; golden layouts; repair E2E.
- **Migration:** none. **Rollback:** feature flag off (tools unregistered) if ELK worker faults — UI parity path.

## Phase 4 — Chart Workflow
- **Files:** `packages/charting/src/{import,infer,recommend,render/integrity,table,narrative,sonify}.ts`; chart tools; `apps/web/src/features/chart/…`.
- **Interfaces:** `importCsv(text) → Dataset`; `recommend(dataset, goal) → RankedRecommendation[]`; `renderChart(spec) → {svg, geometry}`.
- **Storage:** datasets in project state.
- **Tests:** §3 units; honest-chart E2E.
- **Migration:** none. **Rollback:** n/a (additive).

## Phase 5 — Validation, Approval & Export
- **Files:** `packages/domain/src/validation/{registry,checks/*,recompute}.ts`; approval/locking in `machines/`; `packages/render-pdf/src/{layout,embed,fonts,pdf}.ts`; `packages/render-html/src/bundle.ts`; export tools.
- **Interfaces:** `runValidation(project, scope?) → Findings`; `finalizeExport(token) → ExportJob`; `hashProject(project) → Hash`.
- **Storage:** export jobs + manifests in meta store; artifacts to user downloads + cached copies.
- **Tests:** §1 invariant suite completion; §8.5 E2E; PDF determinism golden.
- **Migration:** v2→v3 (export store). **Rollback:** export is read-only w.r.t. project; disabling export flag safe.

## Phase 6 — WebMCP Hardening
- **Files:** `packages/webmcp/src/tools/*.ts` (all groups), `gate.ts` (rates/tokens), `pin.ts` (snapshot).
- **Interfaces:** registry completes §18.2–18.11 enumerations.
- **Tests:** full contract suite; mock-agent §34 sequence; degradation test.
- **Migration:** registry pin file versioned (pins/reg-v1.json). **Rollback:** pin diff blocks bad changes pre-merge.

## Phase 7 — Accessibility Validation
- **Files:** fixes across `apps/web`; `docs/validation/*`; public `docs/accessibility-statement.md`.
- **Tests:** scripted NVDA passes recorded; sweeps automated.
- **Migration/Rollback:** n/a.

## Phase 8 — Understand Mode & Remaining
- **Files:** `apps/web/src/services/import/{pdf,pages,narrate,convert}.ts`; icon studio `apps/web/src/features/icons/`; privacy center `apps/web/src/features/privacy/`; reader/verification tools.
- **Interfaces:** `importDigitalPdf(bytes) → ImportedDocument`; `narrate(page) → SemanticView + SpatialView`.
- **Storage:** v3→v4 (imported source cache, optional, size-capped).
- **Tests:** §6 import integration; §8 reader E2E; icon checks units.
- **Migration:** additive stores; **Rollback:** import feature flag.

## Phase 9 — Release
- **Files:** `vercel.json` (headers), `apps/web/public/{manifest.webmanifest,sw.js}`; seed project JSON; statements.
- **Tests:** budgets + Lighthouse CI; smoke on preview.
- **Rollback:** immutable deploy revert.
