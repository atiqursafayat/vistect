# 13 — Repository Structure & Ownership

```
vistect/
├── apps/
│   └── web/                      # Vite React SPA (the product)
│       ├── public/               # static assets, PWA manifest, SW
│       ├── src/
│       │   ├── app/              # shell, routing, providers, shortcuts
│       │   ├── features/         # navigator, explorer, intent, editor,
│       │   │                     # image, diagram, chart, icons, decisions,
│       │   │                     # validation, export, activity, privacy, import
│       │   ├── services/         # asset (upload/sanitize/crop), import (pdf),
│       │   │                     # announcements bus, storage status
│       │   ├── state/            # zustand projections of domain state
│       │   └── ui/               # design system (accessible primitives)
│       └── tests/e2e/            # Playwright + axe suites
├── packages/
│   ├── domain/                   # PURE: schemas (Zod), events, commands,
│   │   │                          # command bus, state machines, invariants,
│   │   │                          # decisions, validation registry, tool schemas
│   ├── graph/                    # PURE: diagram topology, geometry, layout adapters
│   ├── charting/                 # PURE: dataset import/infer, recommend, render math,
│   │                              # integrity, table, narrative templates
│   ├── render-html/              # PURE-ish (DOM-free string/DOM builders):
│   │                              # semantic HTML preview + export bundle
│   ├── render-pdf/               # PURE: pdf-lib renderer from resolved layout
│   ├── webmcp/                   # registry, schema compiler, gate, activity,
│   │                              # capability probe (imports domain only)
│   ├── storage/                  # IndexedDB event store, snapshots, HMAC,
│   │                              # quota, Web Crypto packages
│   └── testing/                  # fixtures, mock modelContext, axe config,
│                                  # golden-file helpers
├── tooling/                      # eslint config, tsconfig presets, scripts
├── docs/
│   ├── planning/                 # 01–15 (this suite) + adr/
│   ├── plans/                    # bite-sized execution plans
│   ├── validation/               # SR test recordings, phase gate records
│   └── accessibility-statement.md, privacy-statement.md (Phase 7/9)
├── .github/workflows/ci.yml      # typecheck→lint→unit→build→e2e(+axe)→audit
├── pnpm-workspace.yaml
├── tsconfig.base.json            # strict, project references
├── LICENSE (Apache-2.0) · README.md
└── vistect_pts.md                # source spec (kept for reference)
```

## Ownership & dependency rules (enforced by ESLint no-restricted-paths + dependency-cruiser)
- `domain`, `graph`, `charting`, `render-pdf` **must not** import React, DOM globals, or any app code. (`render-html` may only use string building + a tiny DOM serializer interface injected by the app.)
- `webmcp` imports `domain` only. `storage` imports `domain` schemas only.
- `apps/web` may import everything; nothing imports `apps/web`.
- Test utilities in `testing` may be imported by all test code only.

## CI quality gates
`typecheck` (tsc -b, strict) → `lint` (eslint incl. `no-explicit-any` error, import boundaries) → `unit` (vitest, coverage thresholds) → `build` → `e2e` (Playwright + axe, zero critical) → `audit` (pnpm audit high+) → `pins` (registry snapshot diff).
