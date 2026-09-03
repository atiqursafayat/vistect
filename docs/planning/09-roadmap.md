# 09 — Implementation Roadmap

> Estimates in ideal engineer-days (ED) for a senior full-stack engineer; Complexity S/M/L/XL; Dependencies list roadmap item ids.

## Epic / Feature / Story / Task hierarchy

### EP-0 Foundations & Planning (Phase 0)
| ID | Item | Type | Est | Cx | Deps |
|---|---|---|---|---|---|
| EP-0 | Planning suite (docs 01–15, ADRs, execution plan) | Epic | 2 | M | — |
| F-0.1 | Monorepo scaffold (pnpm, TS project refs, ESLint boundaries, Vitest, CI) | Feature | 1.5 | M | EP-0 docs |
| F-0.2 | Quality gates config (strict TS, no-any, prettier, GH Actions matrix) | Feature | 0.5 | S | F-0.1 |

### EP-1 Document Foundation (Phase 1)
| ID | Item | Type | Est | Cx | Deps |
|---|---|---|---|---|---|
| F-1.1 | Domain schemas: project/page/objects/a11y/approval/provenance (Zod + types) | Feature | 1.5 | M | F-0.1 |
| F-1.2 | Event store + snapshots + HMAC chain (packages/storage) | Feature | 1.5 | L | F-1.1 |
| F-1.3 | Command bus + version guard + lifecycle state machines | Feature | 2 | L | F-1.2 |
| F-1.4 | Intent Contract schema + editor UI | Feature | 1 | M | F-1.3 |
| F-1.5 | Page templates ×10 (data-driven registry) + constraint resolver (layout engine) | Feature | 2.5 | XL | F-1.3 |
| F-1.6 | Text object features (H1–H4, lists, quotes, callouts, stat cards, captions, footnotes, links) | Feature | 2 | M | F-1.5 |
| F-1.7 | Accessible document navigator (pages/headings tree) | Feature | 1.5 | L | F-1.5 |
| F-1.8 | Semantic object explorer (§21.4 fields) | Feature | 1.5 | L | F-1.7 |
| F-1.9 | Autosave + storage status + multi-tab single-writer | Feature | 1 | M | F-1.2 |
| F-1.10 | HTML preview renderer (render-html) | Feature | 1.5 | M | F-1.5 |
| F-1.11 | WebMCP shell: registry adapter, capability probe, schema compiler, activity stream + project/text tools | Feature | 2 | L | F-1.3 |
| F-1.12 | Announcement bus + live regions + shortcuts | Feature | 1 | M | F-1.7 |

### EP-2 Image Workflow (Phase 2)
| ID | Item | Type | Est | Cx | Deps |
|---|---|---|---|---|---|
| F-2.1 | Upload pipeline: MIME sniff, caps, hash-dedup, provenance | Feature | 1 | M | F-1.3 |
| F-2.2 | SVG sanitizer (DOMPurify + allowlist + corpus) | Feature | 1 | M | F-2.1 |
| F-2.3 | Local metadata extraction (dimensions, type, basic EXIF facts) | Feature | 0.5 | S | F-2.1 |
| F-2.4 | Structured analysis records + `inspect_image` / `record_image_analysis` tools | Feature | 1.5 | L | F-1.11, F-2.1 |
| F-2.5 | Candidate comparison UI (criteria matrix + SR flow) + selection decision | Feature | 1.5 | L | F-2.4 |
| F-2.6 | Semantic cropping (instruction → crop spec) + crop validation checks | Feature | 2 | XL | F-2.3 |
| F-2.7 | Contextual alt-text workflow (draft → edit → approve) | Feature | 1 | M | F-2.4 |
| F-2.8 | Image WebMCP tools (§18.5 remainder) | Feature | 1 | M | F-2.4–2.7 |

### EP-3 Diagram Workflow (Phase 3)
| ID | Item | Type | Est | Cx | Deps |
|---|---|---|---|---|---|
| F-3.1 | Graph model + CRUD commands + topology validators | Feature | 2 | L | F-1.3 |
| F-3.2 | ELK layout (worker, deterministic) + dagre fallback | Feature | 1.5 | L | F-3.1 |
| F-3.3 | Visual validators (crossings, overlaps, label collisions, contrast) | Feature | 1.5 | L | F-3.2 |
| F-3.4 | Semantic/spatial descriptions + route tracing (primary/alternative) | Feature | 1 | M | F-3.1 |
| F-3.5 | Accessible outputs: keyboard-navigable HTML graph, SVG export (sanitized), PNG, tactile profile (S) | Feature | 1.5 | L | F-3.2 |
| F-3.6 | Diagram WebMCP tools incl. NL-to-graph staging | Feature | 1.5 | M | F-3.1–3.4 |

### EP-4 Chart Workflow (Phase 4)
| ID | Item | Type | Est | Cx | Deps |
|---|---|---|---|---|---|
| F-4.1 | CSV/paste/manual import + schema inference + preview confirm | Feature | 1.5 | M | F-1.3 |
| F-4.2 | Deterministic chart recommendation engine | Feature | 1 | M | F-4.1 |
| F-4.3 | SVG renderer (bar h/v, line) with geometry records | Feature | 2 | L | F-4.1 |
| F-4.4 | Integrity checks (§13.4) + accessible table + template narrative | Feature | 1.5 | L | F-4.3 |
| F-4.5 | Sonification (Web Audio, short) — stretch | Feature | 1 | M | F-4.3 |
| F-4.6 | Chart WebMCP tools | Feature | 1 | M | F-4.1–4.4 |

### EP-5 Validation, Approval & Export (Phase 5)
| ID | Item | Type | Est | Cx | Deps |
|---|---|---|---|---|---|
| F-5.1 | Full deterministic validator suite (layout/text/color/image/chart/diagram/a11y) + finding model + recompute | Feature | 2.5 | XL | EP-1..4 |
| F-5.2 | Subjective findings workflow (agent-labeled, evidence/confidence/keep) | Feature | 1 | M | F-5.1 |
| F-5.3 | Decision ledger completion + Alt+U queue + version diff | Feature | 1.5 | L | F-5.1 |
| F-5.4 | Locking (page/document) + state rules cascade | Feature | 1 | M | F-5.3 |
| F-5.5 | Export manifest (§28) + approval token + finalize chain | Feature | 1.5 | L | F-5.4 |
| F-5.6 | pdf-lib renderer + accessible HTML bundle + SVG/PNG assets + hashes | Feature | 2.5 | XL | F-5.5, F-1.10 |

### EP-6 WebMCP Hardening (Phase 6)
| ID | Item | Type | Est | Cx | Deps |
|---|---|---|---|---|---|
| F-6.1 | Complete tool registry (~80) with read/write split + min outputs | Feature | 2 | L | EP-1..5 |
| F-6.2 | Consequential-action gates + approval tokens + rate limits | Feature | 1 | M | F-6.1 |
| F-6.3 | Injection/poisoning defenses + snapshot pinning + forbidden-pattern audit | Feature | 1 | M | F-6.1 |
| F-6.4 | Agent compatibility suite (mock modelContext) + no-agent degradation | Feature | 1.5 | L | F-6.1 |

### EP-7 Accessibility Validation (Phase 7)
| ID | Item | Type | Est | Cx | Deps |
|---|---|---|---|---|---|
| F-7.1 | NVDA scripted pass + fixes | Feature | 2 | L | EP-1..6 |
| F-7.2 | Keyboard/zoom/high-contrast/reduced-motion sweeps + fixes | Feature | 1.5 | M | EP-1..6 |
| F-7.3 | Whole-document verbal preview (§17) | Feature | 1.5 | M | F-5.1 |
| F-7.4 | Conformance statement + known limitations (public docs) | Feature | 0.5 | S | F-7.1–7.2 |

### EP-8 Understand Mode & Remaining Scope (Phase 8)
| ID | Item | Type | Est | Cx | Deps |
|---|---|---|---|---|---|
| F-8.1 | Digital PDF import (PDF.js): text, headings, pages, reading order + confidence labels | Feature | 2 | XL | F-1.3 |
| F-8.2 | Semantic/spatial narration engine (§9.3) for imported + created docs | Feature | 1.5 | L | F-8.1 |
| F-8.3 | Image/chart/diagram/table identification in imports (S) + comparison (S) | Feature | 2 | XL | F-8.1 |
| F-8.4 | Limited PDF→project conversion w/ confidence disclosure (S) | Feature | 1.5 | L | F-8.1 |
| F-8.5 | Icon studio (Lucide integration, meaning search, assignments, consistency checks) | Feature | 1.5 | M | F-1.3 |
| F-8.6 | Layout tools (§18.9) + reading-order independence + cross-page consistency (S) | Feature | 1.5 | M | F-1.5 |
| F-8.7 | Privacy center: receipts, consent pipeline, redaction, deletion, encrypted packages | Feature | 1.5 | L | F-2.4 |
| F-8.8 | Reader tools completion (§18.3) + verification tools (§18.10) | Feature | 1.5 | M | EP-6 |

### EP-9 Release Engineering (Phase 9)
| ID | Item | Type | Est | Cx | Deps |
|---|---|---|---|---|---|
| F-9.1 | Production deploy (headers, CSP, PWA manifest+SW cache) | Feature | 1 | M | EP-1..8 |
| F-9.2 | Performance budgets + Lighthouse gate (a11y ≥95) | Feature | 0.5 | S | F-9.1 |
| F-9.3 | README, accessibility statement, privacy statement, seed demo project | Feature | 1 | S | F-9.1 |
| F-9.4 | Demo rehearsal asset (script + checklist; recording by user) | Feature | 0.5 | S | F-9.3 |

## Correct ordering rationale
Domain core before UI (schemas drive everything) → storage before editor (durability first) → command bus before any tool (single write path from day 1) → templates/layout before text features (constraints resolve against templates) → engines (image/diagram/chart) before validation suite (validators consume engines) → export last (consumes everything) → WebMCP hardening after engines exist (registry completes) → a11y validation after functional freeze → understand mode last among features (highest risk, standalone).

## Total estimate
~57 ED of feature work + ~6 ED planning/tooling ≈ 63 ED. Milestones M0–M9 as defined in the approved plan.
