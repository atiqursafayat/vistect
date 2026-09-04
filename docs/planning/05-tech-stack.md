# 05 — Technology Stack Review

> Engineering execution plan Phase 5. Format per layer: recommendation, why, pros, cons, alternatives.

## Frontend framework
**Recommendation: React 19 + Vite 7 (SPA), TypeScript 5 strict.**
- **Why:** Hackathon ecosystem suggests React (`use-webmcp-tool` exists); SPA is the natural shape for a local-first IndexedDB app; Vite gives instant HMR and trivial static deploy.
- **Pros:** largest accessible-component knowledge base; fast builds; zero-server deploy.
- **Cons:** no SSR/SEO (irrelevant — authenticated local tool, not a content site); React 19 concurrent features need discipline in SR contexts (avoid layout-tearing around live regions).
- **Alternatives:** *Next.js* (rejected: SSR adds nothing, complicates client-only WebMCP lifecycle); *SvelteKit* (smaller bundles, but smaller a11y component ecosystem); *Angular* (native WebMCP docs exist, but heavier and less fit for solo velocity).

## WebMCP Target & Versioning
**Target:** Chrome 149 Origin Trial (Web Machine Learning Community Group draft, first published February 2026).
- **Spec version pin:** `WEB_MCP_SPEC_VERSION = "chrome-149-origin-trial-2026-05"` in `packages/webmcp/src/version.ts`.
- **Feature detection:** `if ('modelContext' in navigator)` guard on all registration (progressive enhancement).
- **API surface:** Imperative `navigator.modelContext.registerTool()` only (no declarative forms in Vistect).
- **Tool annotations:** `annotations: { readOnlyHint: boolean, untrustedContentHint: boolean }` required on every tool.
- **Confirmation:** `execute(input, client)` with `client.requestUserInteraction()` for sensitive operations.
- **Headers:** `Permissions-Policy: tools=(self)` on hosting; CSP `script-src 'self'`.
- **CI drift check:** Registry snapshot test validates tool names/descriptions/schemas against pinned `pins/reg-v1.json`; forbidden-pattern scan (`approve_all`, `publish_everything`, etc.) blocks merge.

## Language / type safety
**Recommendation: TypeScript `strict:true`, `noImplicitAny`, `exactOptionalPropertyTypes`; ESLint `no-explicit-any` = error; `ts-reset`-style strictness on lib calls.**
- Zero-`any` policy per coding standards; Zod parse at every boundary (tool inputs, storage loads, imports).

## State management
**Recommendation: Zustand (view/projection stores) over an event-sourced domain core; `useSyncExternalStore` for command-derived state.**
- **Why:** domain truth lives in the event store; React state is a projection. Zustand is minimal, SSR-free, testable.
- **Pros:** no reducer boilerplate; selector-based re-render control matters for 300-object documents.
- **Cons:** discipline needed to keep components reading projections, not mutating directly (enforced: only the command bus writes).
- **Alternatives:** *Redux Toolkit* (more ceremony, no benefit); *XState* (evaluated for lifecycles — rejected: transition tables here are small; exhaustive pure functions + tests chosen, ADR-006); *Valtio* (proxy mutation model conflicts with single-write-path invariant).

## Schemas / validation
**Recommendation: Zod v4 (domain schemas, command/tool inputs) + `zod-to-json-schema` (WebMCP `inputSchema` emission).**
- **Why:** single source of truth for runtime validation and agent-facing contracts (ADR-004).
- **Pros:** inferred static types; composable; JSON Schema output compatible with WebMCP.
- **Cons:** JSON Schema emission needs a custom post-pass to force `additionalProperties:false` everywhere and strip Zod-only keywords.
- **Alternatives:** *TypeBox* (JSON-Schema-native; weaker DX for domain modeling); *Valibot* (smaller; less ecosystem).

## Persistence
**Recommendation: IndexedDB via `idb` (tiny promise wrapper) with custom event-store layer; Blob storage for assets; OPFS fallback under quota pressure.**
- **Pros:** transactional appends (I-13), generous quota, Blob-efficient.
- **Cons:** IndexedDB quirks (Safari eviction — mitigated with `navigator.storage.persist()` + export/backup UX); no relational joins (fine — single-project aggregate loads).
- **Alternatives:** *SQLite WASM + OPFS* (better queries; heavier, Safari OPFS sync quirks); *localStorage* (size limits, synchronous — rejected).

## Cryptography
**Recommendation:** Web Crypto API: PBKDF2 (≥600k iterations) → AES-GCM for optional encrypted project packages; SHA-256 (via `crypto.subtle`) for content addressing and export hashes.
- **Alternatives:** *libsodium.js* (more primitives, extra dep — not needed).

## PDF import
**Recommendation: PDF.js (`pdfjs-dist`) — text layer extraction, page rendering to canvas for agent/sighted inspection, outline parsing.**
- **Cons:** scanned PDFs yield no text → OCR deferred (agent can read rendered page screenshots; documented limitation + R2 remote OCR adapter).
- **Alternatives:** *pdf.js + Tesseract.js* (local OCR — heavy WASM, mediocre accuracy; stretch only).

## SVG sanitization
**Recommendation: DOMPurify (SVG profile) + custom allowlist pass (strip `<script>`, `on*`, `href` external, `<foreignObject>`, animations, fonts) + parse-or-reject (R-08).**
- **Alternatives:** hand-rolled parser only (higher risk — DOMPurify is battle-tested; belt-and-braces chosen).

## Diagram engine
**Recommendation: `packages/graph` pure model + validators; layout via ELK.js (`elkjs`) lazy-loaded with deterministic seeds; dagre fallback path; custom sanitized SVG emission.**
- **Pros:** ELK layered layout is the best open option for process/decision graphs; pure model keeps validation deterministic and testable.
- **Cons:** ELK bundle ~1MB → lazy chunk; worker-ified to keep main thread free.
- **Alternatives:** *React Flow* (great editor UX but rendering-first model — we render our own SVG from the graph; may adopt for interactive touch later); *Cytoscape.js* (general purpose, less good layered layouts).

## Chart engine
**Recommendation: custom deterministic SVG renderer in `packages/charting` (bar h/v, line) with exact geometry records.**
- **Why:** integrity checks (label fit, pixel-value equality, baseline) require knowing exact geometry; 3 chart types is a bounded surface.
- **Alternatives:** *Vega-Lite* (fast coverage; opaque geometry, harder to validate + bigger bundle — revisit R2 when chart types grow); *Chart.js* (canvas — bad for SR/geometry).

## PDF export
**Recommendation: `pdf-lib` renderer in `packages/render-pdf` driven by the shared layout engine (ADR-003).**
- **Pros:** deterministic bytes → hash-bindable; embeds standard fonts + images; offline.
- **Cons:** manual text layout (wrapping/pagination) — bounded by 10 fixed templates; no tagged-PDF (PDF/UA) in R1 — spec §3.3 disclaims; accessibility compensated by HTML companion (which IS fully accessible).
- **Alternatives:** *Puppeteer server render* (rejected: violates local-first, adds infra); *browser print* (non-deterministic, unhashable).

## Testing
**Recommendation:** Vitest (unit/integration, jsdom + node), Testing Library (React), Playwright (E2E + visual regression + axe-core injection), custom WebMCP contract harness (in-memory `document.modelContext` mock), `@axe-core/playwright`.
- **Alternatives:** *Jest* (slower, legacy config); *Cypress* (worse a11y/CI story).

## Linting / formatting / CI
**Recommendation:** ESLint (typescript-eslint strict, `no-explicit-any` error, boundary rules via `eslint-plugin-import` no-restricted-paths: domain may not import React/DOM APIs), Prettier, GitHub Actions (typecheck → lint → unit → build → Playwright+axe → `pnpm audit --audit-level=high`), changesets-style conventional commits.

## Observability (local-only)
**Recommendation:** custom ring-buffer structured logger (IndexedDB `vistect-meta.log`) + agent activity stream + privacy receipts (see `14-observability.md`). No Sentry/telemetry SDK — zero-egress policy (NFR-006); debug bundle export instead.

## Dependency policy
Minimal deps; every addition requires justification in PR; bundle budget: initial < 250KB gz (excluding lazy ELK/PDF.js chunks); `pnpm audit` clean at high+; licenses scanned (MIT/ISC/Apache-2/OFL only).
