# 02 — Requirements Register

> Priorities: **M** = Must (R1 blocking), **S** = Should (R1 stretch / demo-valuable), **L** = Later (R2+, documented only).
> Every FR maps to acceptance criteria in `11-acceptance-criteria.md` and test scenarios in `10-test-strategy.md`.

## A. Functional Requirements

### A1. Project & Intent Contract (spec §7, §18.2)
| ID | Requirement | Priority |
|---|---|---|
| FR-001 | Create a document project with title, language, document type (`impact-report` initially) | M |
| FR-002 | Capture Intent Contract fields: document type, purpose, audience, primary/secondary messages, tone, concepts to avoid, brand colors/fonts, visual style, required visuals, accessibility requirements, image sourcing preference, privacy sensitivity, export requirements | M |
| FR-003 | Update Intent Contract with validation against schema; changes recorded as events | M |
| FR-004 | Evaluate visual recommendations against the contract without treating aesthetic alignment as objective fact | M |
| FR-005 | List projects; open/delete/export project packages; explicit deletion control | M |
| FR-006 | Autosave projects locally (IndexedDB) with quota monitoring and user-visible storage status | M |
| FR-007 | Encrypted local project packages (Web Crypto, passphrase-derived key) | S |

### A2. Semantic Document Model (spec §8)
| ID | Requirement | Priority |
|---|---|---|
| FR-010 | Store documents as structured data: Document → Metadata, Intent Contract, Theme, Pages (Regions, Objects), Assets, Data sources, Decisions, Findings, Accessibility metadata, Versions, Export manifests | M |
| FR-011 | Typed objects: Text, Image, Icon, Chart, Diagram, Table, Shape — each with id, role, purpose, bounds, relative constraints, layer, reading order index, accessibility metadata, provenance, approval state, createdBy, versionCreated/Modified | M |
| FR-012 | Accessibility metadata per object: isDecorative, altText, longDescription, accessibleName/Role, includedInReadingOrder, language, warnings | M |
| FR-013 | Approval state per object: unreviewed/proposed/approved/rejected/stale with approvedBy/At/Version, decisionId | M |
| FR-014 | Every content change increments document version; event-sourced history | M |
| FR-015 | Snapshot compaction of event history without losing version semantics | S |

### A3. Create Mode — Pages, Templates, Text (spec §5.2, §10)
| ID | Requirement | Priority |
|---|---|---|
| FR-020 | Create document from scratch; generate pages from user-approved outline | M |
| FR-021 | Ten page templates: cover, text-led, text+side image, full-width image+caption, statistics, chart, diagram, participant story, recommendations, conclusion+contact | M |
| FR-022 | Text features: headings H1–H4, paragraphs, bulleted/numbered lists, quotations, callout boxes, statistic cards, captions, footnotes/source notes, page/section breaks, hyperlinks | M |
| FR-023 | Layout features: apply template, place before/after another object, align (left/right/center/top/bottom), distribute evenly, group, keep-together, set primary/secondary visual priority, move object to another page, change reading order independent of visual order, document-wide margins/spacing | M |
| FR-024 | Reorder pages | M |
| FR-025 | Cross-page consistency checks: heading placement, margins, footer placement, image/caption style, icon family, chart/diagram theme, palette, typography, visual pacing, repeated layouts | S |

### A4. Reader / Understanding Mode (spec §5.1, §9)
| ID | Requirement | Priority |
|---|---|---|
| FR-030 | Accept inputs: PDF, scanned PDF, PNG, JPEG, WebP, structured SVG, CSV | M (digital PDF S for scanned) |
| FR-031 | Digital PDF parsing in-browser (PDF.js): pages, text, headings, language detection | M |
| FR-032 | Reconstruct logical reading order; describe page structure and spatial hierarchy | M |
| FR-033 | Identify images, charts, diagrams, tables, captions, icons, sidebars, headers/footers | S |
| FR-034 | Extract chart labels/values and reconstruct diagram nodes/edges **when reliable**, with confidence labels | S |
| FR-035 | Semantic page output (numbered object list with roles) and spatial narration (relative positions, dominant visual, whitespace, density) | M |
| FR-036 | Document overview: page/section counts, heading hierarchy, object counts by type, visual density, language, reading-order status, a11y warnings, low-confidence interpretations | M |
| FR-037 | Semantic navigation by page, heading, paragraph, image, chart, diagram, table, icon, caption, footnote, warning, unapproved decision, agent-created object | M |
| FR-038 | Image understanding output separation: high-confidence observations, model interpretations, uncertain observations, detected text, composition, likely purpose, sensitive-content warning, source/license status | M |
| FR-039 | Chart understanding: type, title, axes, series, categories, values, extremes, trends, outliers, source linkage, a11y defects, misleading-visual flags | M (for Vistect-created charts) / S (imported) |
| FR-040 | Diagram understanding: type, nodes, edges, groups, decisions, entry/exit, primary/alternative paths, unreachable nodes, cycles, spatial organization, visual defects | M |
| FR-041 | Uncertainty handling: never silently convert uncertain interpretation into fact; show disagreement; recommend handling | M |
| FR-042 | Compare pages or visual elements | S |
| FR-043 | Identify accessibility defects in imported documents | S |
| FR-044 | Convert supported imported content into editable Vistect projects with reconstruction-confidence disclosure | S |
| FR-045 | Whole-document verbal preview (§17): impression, cover composition, per-page dominants, pacing, consistency, typography, color, image style, icon system, density, patterns, unresolved risks — labeled as interpretation | S |

### A5. Inspect & Verify Mode (spec §5.3)
| ID | Requirement | Priority |
|---|---|---|
| FR-050 | Continuous loop: agent proposes → app renders → user understands → deterministic systems validate → user corrects/approves → approved version locked | M |
| FR-051 | Inspect agent-created objects with the same reader used for imported documents | M |
| FR-052 | Version comparison (diff two document versions) | S |

### A6. Image Studio (spec §11)
| ID | Requirement | Priority |
|---|---|---|
| FR-060 | Sources: user upload, organization library (L), curated provider (L), AI-generated (L), imported from document (S) | upload M |
| FR-061 | Formats: JPEG, PNG, WebP, SVG (safe+parseable only); MIME sniffing, size caps, sanitization | M |
| FR-062 | Asset record: fileName, mime, dimensions, sourceType, sourceReference, license, localOnly, detectedText, observations/interpretations/uncertainties, qualityFindings | M |
| FR-063 | Local metadata extraction (dimensions, format, EXIF-derived facts where parseable) | M |
| FR-064 | Agent-driven structured analysis via WebMCP tools (`inspect_image_asset` returns context; `record_image_analysis` enforces observation/interpretation/uncertainty separation) | M |
| FR-065 | Image comparison across ≥3 candidates with criteria: intent alignment, subject relevance, composition, emotional tone, professional quality, representation, stereotype/charity framing, crop flexibility, title-safe area, distracting details, visual complexity, source/license, resolution, model confidence/disagreement | M |
| FR-066 | Semantic cropping instructions: keep subject/faces/hands visible, remove region, leave title space, square/full-width crop, center subject | M |
| FR-067 | Crop validation: face/subject truncation, post-crop resolution, aspect ratio, title-safe region, focal point, important detected text, object loss | M |
| FR-068 | Contextual alt text workflow: considers purpose, nearby text, redundant info, audience, decorative status, uncertain claims; user reviews and approves final | M |
| FR-069 | Sensitive-content detection disclosure before any remote/agent processing; redaction + cancel | M |

### A7. Diagram Studio (spec §12)
| ID | Requirement | Priority |
|---|---|---|
| FR-070 | Diagram types: process flow, decision tree, journey map, system architecture, org structure (R1 validators guarantee process + decision) | M (process/decision), S (rest) |
| FR-071 | Graph model: nodes, edges, groups, layout, entry/terminal nodes, accessibility metadata | M |
| FR-072 | Operations: create, add/update/remove node, connect/disconnect, decision outcomes, groups, apply layout, semantic move, trace path, list connections, generate short/long description, export SVG+PNG | M |
| FR-073 | Automatic layout (layered) with deterministic results | M |
| FR-074 | Structural validation: disconnected nodes, unreachable nodes, missing decision outcomes, invalid cycles, missing entry/terminal, duplicate edges, ambiguous edge labels | M |
| FR-075 | Visual validation: edge crossings, connector-label collisions, node overlaps, label overflow, crowded regions, inconsistent node dimensions, excessive bends, reading-order mismatch, insufficient contrast, color-only meaning | M |
| FR-076 | Accessible output: structured SVG, PNG preview, keyboard-navigable HTML graph, node/connection list, primary/alternative route descriptions, short alt, long description, tactile-oriented SVG profile (S) | M except tactile S |
| FR-077 | Natural-language-to-graph staging: agent proposes graph operations; executed as versioned, inspectable commands | M |

### A8. Chart Studio (spec §13)
| ID | Requirement | Priority |
|---|---|---|
| FR-080 | Chart types R1: horizontal bar, vertical bar, line (stacked bar/area/scatter L) | M |
| FR-081 | Inputs: CSV upload, manual entry, paste table, extracted table with user verification | M |
| FR-082 | Dataset schema inference with preview and user confirmation | M |
| FR-083 | Chart recommendation by deterministic rules: categorical vs temporal, series count, category count, label lengths, comparison/trend/composition goal, intended message, accessibility, misinterpretation risk | M |
| FR-084 | Integrity checks: visual values match source, axis labels, units, category label fit, legend/series match, baseline review, time-axis ordering, percentage/total coherence, no color-only distinction, source note, data table presence, narrative-vs-values contradiction | M |
| FR-085 | Synchronized outputs: SVG rendering, accessible data table, short narrative (deterministic template; agent may refine as approved decision), optional sonification (S), source reference, accessibility metadata | M except sonification S |
| FR-086 | Changed dataset marks dependent charts stale | M |

### A9. Icon & Visual Vocabulary Studio (spec §14)
| ID | Requirement | Priority |
|---|---|---|
| FR-090 | Document-wide icon system: family, stroke weight, corner style, fill style, colors, size classes, semantic assignments | M |
| FR-091 | One curated icon library (Lucide, MIT) with meaning-based search | M |
| FR-092 | Icon checks: style/stroke consistency, fill mismatch, size, alignment, ambiguous metaphor, repeated meaning, cultural ambiguity, color-only meaning, accidental medical/charity framing | S |
| FR-093 | Metaphor comparison and user selection (not first-suggestion acceptance) | M |

### A10. Visual Decision Ledger (spec §15)
| ID | Requirement | Priority |
|---|---|---|
| FR-100 | Record every consequential visual decision: page structure, image selection/crop/placement, icon metaphor/family, chart type/styling, diagram structure/layout, template, visual priority, reading order, alt text, long description, export format | M |
| FR-101 | Decision record: options reviewed, selected, selection reason, rejected candidates with reasons, suggestedBy, approvedBy, status, version | M |
| FR-102 | Operations: list unreviewed, inspect alternatives, approve, reject, request new alternatives, undo, mark stale on upstream change | M |
| FR-103 | Unapproved-decision queue with global shortcut (Alt+U) and count in announcements | M |

### A11. Validation Framework (spec §16)
| ID | Requirement | Priority |
|---|---|---|
| FR-110 | Finding model: id, scope (object/page/document), targetId, category, severity (info/warning/error/blocking), evidenceType (deterministic/model_assessment/human_review), summary, evidence[], confidence?, suggestedActions[], status (open/accepted/resolved/dismissed) | M |
| FR-111 | Deterministic layout checks: overlap, out-of-bounds, alignment, spacing consistency, margins, empty placeholders, crowded regions, excessive whitespace | M |
| FR-112 | Deterministic text checks: overflow, truncation, minimum size, heading hierarchy, missing/orphan headings | M |
| FR-113 | Deterministic color checks: contrast ratios, color-only distinctions, palette violations | M |
| FR-114 | Image checks: missing alt, resolution, aspect distortion, source metadata, crop boundaries | M |
| FR-115 | Chart checks: data mismatch, missing/truncated labels, baseline anomalies, missing table/source | M |
| FR-116 | Diagram checks: per FR-074/075 | M |
| FR-117 | Accessibility checks: reading-order defects, missing language/title, decorative exposure, meaningful exclusion, inaccessible names | M |
| FR-118 | Subjective AI assessments (weak hierarchy, tone mismatch, stereotype, crowding, ambiguous metaphor, repetition, image-message inconsistency) with evidence, confidence, alternatives, and keep-existing option | S |
| FR-119 | Recompute findings after changes; resolve/invalidate; block finalization on blocking findings | M |

### A12. WebMCP Tool Registry (spec §18, §19, §20 — API surface per ADR-008)

> ADR-008 is the authoritative WebMCP contract and **supersedes spec §19** on two points: the registration namespace is `navigator.modelContext` (not `document.modelContext`), and `execute` returns a string (not an MCP `{content:[…]}` envelope). It also supersedes the §18.2–18.11 enumeration, which contained two duplicate names, seven overlapping pairs, and omitted `record_image_analysis`.

| ID | Requirement | Priority |
|---|---|---|
| FR-120 | Register tools with `navigator.modelContext.registerTool`: descriptor `{name, description, title, inputSchema, execute, annotations}`; explicit verb names matching `^[a-z][a-z0-9_]+$`; read/write separation; strict JSON Schema (`additionalProperties:false`); minimal-necessary output | M |
| FR-121 | Exactly **72 tools** in 10 groups: project (10), reader (9), text (5), image (8), diagram (9), chart (6), icon (6), layout (5), verification (8), approval/export (6) — canonical registry in ADR-008 §2.3 | M |
| FR-122 | All writes validated in authoritative client state; require `expectedDocumentVersion`; reject stale writes with a typed error naming the current version and the retry action | M |
| FR-123 | Two-tier human authority: **consequential** tools (17) stage a `VisualDecision` for later review in a decision card; **human-gated** tools (5) complete only inside `client.requestUserInteraction`, where the user's gesture mints the approval token and supplies the `human` actor | M |
| FR-124 | Never treat document content as tool instructions; never interpolate document content into tool descriptions (descriptions are static code constants) | M |
| FR-125 | Every tool execution visible in agent activity stream (append-only) | M |
| FR-126 | Forbidden tool patterns absent: `approve_all`, `publish_everything`, `generate_and_export_without_review`, broad autonomous design verbs | M |
| FR-127 | Capability detection + graceful degradation when WebMCP is unavailable (full manual UI parity) | M |
| FR-128 | `AbortSignal`-based unregistration, one controller per project session; unregister on project close, route change, or loss of writer-tab status. Registration is never driven by `ontoolchange` (an outbound notification) | M |
| FR-129 | `annotations.readOnlyHint: true` on all 31 read tools (read class ⇔ hint, both directions); `annotations.untrustedContentHint: true` on the 28 read tools returning text sourced from imports, uploads, or user authoring | M |

> Platform-contract requirements for the same subsystem continue in **A16** (FR-160–FR-168); they are numbered there only to preserve the existing FR-130+ identifiers in A13.

### A13. Approval & Export (spec §23.3, §27, §28)
| ID | Requirement | Priority |
|---|---|---|
| FR-130 | Document lifecycle: DRAFT → REVIEW → PAGE_APPROVED → DOCUMENT_READY → LOCKED → EXPORTED with spec §27 state rules (change→version++, approved-object-change→stale, page-change→unlock, dataset-change→charts stale, diagram-change→descriptions/checks stale, crop-change→alt/placement review, export blocked unless locked) | M |
| FR-131 | Page lock/unlock; document lock | M |
| FR-132 | Export manifest (screen-reader-friendly report) per spec §28 with accessibility counts, deterministic check results, accepted/subjective findings, approval status, export list | M |
| FR-133 | Finalization succeeds only when: blocking validations pass, required decisions approved, document locked, manifest references active version, no post-lock changes, renderer uses locked version | M |
| FR-134 | Exports: PDF (deterministic client-side pdf-lib), accessible HTML bundle, SVG diagrams, chart data tables, accessibility manifest | M |
| FR-135 | Artifact hashes linking export to locked version + manifest | M |

### A14. Privacy Architecture (spec §22)
| ID | Requirement | Priority |
|---|---|---|
| FR-140 | Local-first in-browser: project storage, PDF rendering, text extraction, object state, diagram generation, chart generation, geometry/reading-order checks, redaction, image metadata, version comparison, export preparation | M |
| FR-141 | Before any non-local processing (agent analysis of sensitive assets, future remote OCR): identify asset/region, state why, disclose detected text/faces/sensitive content, allow redaction/cancel, request explicit permission, transmit minimum, record privacy receipt | M |
| FR-142 | Privacy receipt: processed locally / analyzed remotely / not transmitted / retention status | M |
| FR-143 | Data minimization: no full-profile tool requests, scoped analysis content, scoped outputs, logs exclude document content, analytics collect no document text/images | M |
| FR-144 | IndexedDB persistence; explicit deletion; no retention for temporary data | M |

### A15. Accessibility (spec §21)
| ID | Requirement | Priority |
|---|---|---|
| FR-150 | AT support: NVDA+Chrome (primary), JAWS+Chrome (if available), VoiceOver+Safari (non-WebMCP surfaces), keyboard-only, 200%/400% zoom, high-contrast modes | M |
| FR-151 | Interface: semantic HTML first, ARIA only when insufficient, complete keyboard operation, visible focus, predictable focus movement, focus restoration after dialogs/agent actions, live-region summaries, skip links, heading/landmark navigation, clear status/error messages, no color-only status, no drag-only operation, no hover-only info, reduced motion, scalable text, accessible names for all controls | M |
| FR-152 | Agent action announcements (what changed, unapproved count, Alt+U hint); no automatic focus move unless immediate review required | M |
| FR-153 | Semantic object explorer exposing type, accessible name, page, purpose, relative position, reading-order position, dimensions in understandable terms, source, approval state, warnings, available actions | M |

### A16. WebMCP Platform Contract (continuation of A12 — ADR-008)
| ID | Requirement | Priority |
|---|---|---|
| FR-160 | Every tool `execute` returns a **summary-first string**: one plain-language sentence (what changed · document version · unapproved-decision count), then the structured payload. A bare `JSON.stringify` return is prohibited. The same string feeds the agent and the activity-stream announcement (FR-152) | M |
| FR-161 | Every read result carries `currentDocumentVersion`, so the agent has a legitimate source for `expectedDocumentVersion` on its first write of a session | M |
| FR-162 | `ExecutionGate` (version check, class enforcement, rate limit, activity recording, project scoping) is applied at tool-definition time via `defineTool()`; no `registerTool` call site may pass an unwrapped `execute`. Rationale: agent invocations reach `execute` directly and never traverse `executeTool`, so a registry-boundary gate would be bypassed by every real agent call | M |
| FR-163 | No tool may be registered that the command bus will always reject. `approve_visual_decision` / `reject_visual_decision` are therefore **not** registered (they would violate I-03 on every call); `open_decision_for_review` brings the user to the decision card and reports the choice the user made. The internal approve/reject commands remain UI-only | M |
| FR-164 | Capability probe returns a typed `CapabilityReport` with reason code (`ok` · `no_api` · `insecure_context` · `read_only_tab`) and surfaces the reason to the user rather than swallowing it | M |
| FR-165 | In a read-only secondary tab (single-writer election, NFR-008), register read tools only; any write attempt returns guidance to switch to the editing tab | M |
| FR-166 | `exposedTo` left at default (own origin + built-in agents); no cross-origin exposure in R1 | M |
| FR-167 | `toolautosubmit` is never used on any form in Vistect; the declarative API is not used in R1 (evaluated and rejected — ADR-008 §2.10) | M |
| FR-168 | Origin-trial token provisioned as `<meta http-equiv="origin-trial">` plus response header; expiry date and renewal owner recorded in the release checklist | M |

## B. Non-Functional Requirements

| ID | Category | Requirement |
|---|---|---|
| NFR-001 | Performance | App interactive < 3s on mid-range hardware; tool execute round-trip < 100ms p95 (excludes agent think-time); layout recompute < 250ms for 20-page doc; chart/diagram render < 200ms |
| NFR-002 | Performance | Import of a 20-page digital PDF < 10s; export of 20-page PDF < 15s |
| NFR-003 | Availability | Static SPA on CDN; fully functional offline after first load (PWA caching); IndexedDB is the system of record |
| NFR-004 | Scalability | Client-side scale targets: 20 pages, 300 objects, 40 assets, 25 versions snapshot-compacted; storage quota guard with user-facing guidance |
| NFR-005 | Security | All untrusted content (uploads, imports) treated as data: sanitized, sandboxed rendering, no interpolation into instructions; CSP strict; see `07-security-review.md` |
| NFR-006 | Privacy | Zero network egress of document content by the application itself; agent processing is user-consented per FR-141; no third-party analytics collecting content |
| NFR-007 | Accessibility | WCAG 2.2 AA for all authoring surfaces; core workflows operable with NVDA + keyboard only; axe-core zero critical violations in CI |
| NFR-008 | Reliability | No silent data loss: event-sourced writes are durable before UI ack; multi-tab single-writer election; corruption-recoverable via snapshots + export packages |
| NFR-009 | Maintainability | TypeScript strict, zero `any`; Zod at every boundary; pure domain package with no React/DOM imports (enforced by lint); SOLID; functional core / imperative shell |
| NFR-010 | Observability | Local-only structured logs (ring buffer in IndexedDB); agent action audit stream; privacy receipt log; debug export bundle for support |
| NFR-011 | Testability | Domain and engines fully unit-testable without DOM; ≥90% branch coverage on domain/graph/charting/validation; E2E covers §34 demo script |
| NFR-012 | Compatibility | Chrome 149+ with the WebMCP origin trial enabled (token per FR-168) or the local flag; ChatGPT in-app browser (support to be verified by a Phase 1 spike, not assumed); evergreen Firefox/Safari for non-agent surfaces, where the app must remain fully operable without WebMCP |
| NFR-013 | Internationalization | Document `language` field honored in exports (lang attributes); UI copy externalized for future i18n; R1 UI language: English |
| NFR-014 | Data durability | Explicit delete only; project file export/import as backup path; quota-aware eviction never silently deletes projects |
| NFR-015 | Legal/License | Apache-2.0-licensed open-source repo; icon library (Lucide) ISC; no copyleft contamination; fonts OFL/Apache |
| NFR-016 | Platform constraint | WebMCP requires a **secure context**. Production is HTTPS; `localhost` is a secure context for development. Plain-HTTP LAN or device testing (e.g. NVDA on a second machine, in-app browser against a preview) disables WebMCP entirely — the probe must report `insecure_context` (FR-164) so this is diagnosable rather than indistinguishable from an absent agent. Documented in the dev runbook. |
| NFR-017 | Platform volatility | WebMCP is a W3C draft in origin trial and its API surface will move. All contact with `navigator.modelContext` is confined to `packages/webmcp`; no other package or app module may reference it (lint-enforced). API assumptions are dated in ADR-008 §4 and re-verified at Phase 6 exit and Phase 9 deploy. |
