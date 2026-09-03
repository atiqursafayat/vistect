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
| FR-064 | Agent-driven structured analysis via WebMCP tools (`inspect_image` returns context; `record_image_analysis` enforces observation/interpretation/uncertainty separation) | M |
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

### A12. WebMCP Tool Registry (spec §18, §19, §20)
| ID | Requirement | Priority |
|---|---|---|
| FR-120 | Register tools with `document.modelContext.registerTool`: explicit verb names, read/write separation, strict JSON Schema (`additionalProperties:false`), structured returns, minimal-necessary output | M |
| FR-121 | Tool groups (≈80 tools): project (11), reader (10), text (5), image (7), diagram (10), chart (7), icon (6), layout (5), verification (8), approval/export (7) | M |
| FR-122 | All writes validated in authoritative client state; require `expectedDocumentVersion`; reject stale writes | M |
| FR-123 | Consequential operations require explicit user approval (staged decisions); approval tokens for finalization | M |
| FR-124 | Never treat document content as tool instructions; never interpolate document content into tool descriptions | M |
| FR-125 | Every tool execution visible in agent activity stream (append-only) | M |
| FR-126 | Forbidden tool patterns absent: `approve_all`, `publish_everything`, `generate_and_export_without_review`, broad autonomous design verbs | M |
| FR-127 | Capability detection + graceful degradation when no WebMCP agent is present (full manual UI parity) | M |
| FR-128 | AbortSignal-based unregistration; page-lifecycle-safe registration | M |

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
| NFR-012 | Compatibility | Chrome 149+ (WebMCP flag/origin-trial), ChatGPT in-app browser, evergreen Firefox/Safari for non-agent surfaces |
| NFR-013 | Internationalization | Document `language` field honored in exports (lang attributes); UI copy externalized for future i18n; R1 UI language: English |
| NFR-014 | Data durability | Explicit delete only; project file export/import as backup path; quota-aware eviction never silently deletes projects |
| NFR-015 | Legal/License | MIT-licensed open-source repo; icon library (Lucide) ISC; no copyleft contamination; fonts OFL/Apache |
