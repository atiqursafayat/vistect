# 04 — Domain Model

> Engineering execution plan Phase 4. Canonical schema implementations live in `packages/domain/src/schema/*` (Zod); this document is the design source of truth.

## 1. Aggregates, Entities, Value Objects

### Aggregates (consistency boundaries; one command mutates one aggregate root)
| Aggregate | Root | Consistency rule |
|---|---|---|
| **DocumentProject** | `DocumentProject` | All page/object/asset/decision/finding mutations via project commands; version is aggregate-level |
| **Diagram** (inside project) | `Diagram` object | Node/edge mutations are atomic per command; topology validators run per mutation |
| **Dataset** (inside project) | `Dataset` | Schema inference + edits atomic; downstream charts staled on change |
| **ImageAsset** | `ImageAsset` | Crop/analysis registrations atomic; crops are derived, non-destructive |

### Entities (identity + lifecycle)
`Page`, `DocumentObject` (Text/Image/Icon/Chart/Diagram/Table/Shape), `DiagramNode`, `DiagramEdge`, `DiagramGroup`, `VisualDecision`, `ValidationFinding`, `DocumentVersion` (snapshot ref), `ExportJob`.

### Value Objects (immutable, no identity)
`Bounds{x,y,w,h}`, `RelativeConstraint{anchorId, relationship, spacing?}`, `AccessibilityMetadata`, `ApprovalState`, `Provenance{sourceType, sourceReference?, license?, actorId, at}`, `Observation{claim, confidence, basis}`, `Interpretation{claim, confidence, model/agent, evidence[]}`, `Uncertainty{claim, analyses[], recommendation}`, `Theme{colors, fonts, spacing}`, `CropSpec{rect, aspectRatio?, intent}`, `ChartSpec{type, datasetId, mappings, axes}`, `FindingSeverity`, `EvidenceType`, `Hash`, `ActorId`.

## 2. ERD

```mermaid
erDiagram
    DocumentProject ||--|| IntentContract : has
    DocumentProject ||--|| Theme : has
    DocumentProject ||--o{ Page : contains
    DocumentProject ||--o{ ImageAsset : owns
    DocumentProject ||--o{ Dataset : owns
    DocumentProject ||--o{ VisualDecision : records
    DocumentProject ||--o{ ValidationFinding : records
    DocumentProject ||--o{ DocumentVersion : versions
    DocumentProject ||--o{ ExportJob : produces
    Page ||--o{ DocumentObject : contains
    Page }o--|| PageTemplate : uses
    DocumentObject ||--o| ImageAsset : references
    DocumentObject ||--o| Dataset : references
    DocumentObject ||--o| Diagram : embeds
    DocumentObject ||--o| ChartSpec : embeds
    Diagram ||--o{ DiagramNode : has
    Diagram ||--o{ DiagramEdge : has
    Diagram ||--o{ DiagramGroup : has
    DiagramEdge }o--|| DiagramNode : from
    DiagramEdge }o--|| DiagramNode : to
    Dataset ||--o{ DataColumn : has
    VisualDecision }o--o{ DocumentObject : affects
    VisualDecision ||--o{ DecisionOption : reviewed
    ValidationFinding }o--|| DocumentObject : targets
    ExportJob ||--|| DocumentVersion : binds
    ExportJob ||--|| ExportManifest : describes
    ImageAsset ||--o{ Observation : "local facts"
    ImageAsset ||--o{ Interpretation : "agent judgments"
    ImageAsset ||--o{ Uncertainty : "disagreements"
```

## 3. State Machines (transition tables — implemented as exhaustive pure functions)

### 3.1 Document lifecycle (spec §27)
| From | Event | To | Guards |
|---|---|---|---|
| (new) | `ProjectCreated` | `draft` | — |
| `draft` | `ReviewRequested` | `review` | ≥1 page |
| `review` | `AllPagesApproved` | `page_approved` | every page `approved` |
| `page_approved` | `ReadinessConfirmed` | `document_ready` | no open blocking findings; all required decisions approved |
| `document_ready` | `DocumentLocked` | `locked` | manifest preview generated; user gesture |
| `locked` | `ExportFinalized` | `exported` | manifest hash matches state hash |
| `locked`/`exported` | `UnlockRequested` | `review` | user only; invalidates exports' "current" flag |
| any† | content-mutating event | version++ | †`locked`: **rejected** (LockViolation) |

### 3.2 Page status
`draft → review → approved → locked`; any object mutation on a page → back to `review` (unlocks). `locked` only when document locked.

### 3.3 Object approval state (spec §8.4 + §15)
`unreviewed → proposed → approved ⇄ stale → approved…`; `proposed → rejected → proposed (new alternatives)`. Guards: transitions to `approved` require `actor.kind === "human"`; mutation of approved object → `stale`.

### 3.4 Visual decision status
`open → proposed → approved | rejected`; `approved → stale` on upstream change (see §6 R- rules); `rejected → open` on "request alternatives". Locked documents freeze all decisions.

### 3.5 Validation finding status
`open → resolved` (fix applied, check recomputed clean) | `accepted` (user accepts risk; requires reason for `blocking`→ escalates to manifest "accepted_findings") | `dismissed` (subjective-only, reversible). Upstream change re-opens invalidated findings.

### 3.6 Export lifecycle
`prepared (manifest preview) → approved (user approves manifest) → rendering → completed | failed`. Re-run of any mutation after `approved` → `prepared` again + `StaleVersionError` on finalize (spec §23.3).

## 4. Lifecycles

### 4.1 Approval lifecycle (consequential agent change)
1. Agent tool call → command bus validates schema + version.
2. Domain applies change with `approval.status = "proposed"`, creates `VisualDecision{status:"proposed", suggestedBy: agent actor, options[]}`.
3. Announcement; decision card in Alt+U queue.
4. User approves → object `approved`, decision `approved`, `approvedVersion` stamped; user rejects → revert-or-keep-rejected semantics per decision type (image selection reverts selection; alt text keeps previous approved text).

### 4.2 Export lifecycle
1. `document_ready` → run full validation suite → manifest preview (spec §28 shape) rendered accessibly.
2. User approves manifest → `ExportJob(prepared→approved)`, approval token bound to `version + manifestHash`.
3. Render HTML bundle + PDF + SVG/PNG assets + tables → hash each artifact → `completed`.
4. Any post-approval mutation invalidates token → finalize rejected (recompute hash mismatch).

## 5. Invariants (enforced in `packages/domain/src/invariants`; every one unit-tested)

| # | Invariant |
|---|---|
| I-01 | Every content mutation increments `version`; no mutation on `locked` projects succeeds. |
| I-02 | `expectedDocumentVersion` must equal current version at dispatch; otherwise `StaleVersionError`. |
| I-03 | Approval transitions require human actor (command-bus guard). |
| I-04 | Mutation of an approved object marks it `stale` and re-opens its decision. |
| I-05 | Page mutation unlocks that page and cascades document status recompute. |
| I-06 | Dataset change marks dependent charts' checks/descriptions `stale`. |
| I-07 | Diagram node/edge change marks diagram descriptions and checks `stale`. |
| I-08 | Image crop change marks alt text + placement decisions for review when relevant (face/subject regions intersect changed crop). |
| I-09 | Reading order contains exactly the ids of objects with `includedInReadingOrder=true`, once each. |
| I-10 | Every non-decorative Image/Chart/Diagram object must have alt text (short) and — for charts — a data table, and — for diagrams — a long description **before** `document_ready`. |
| I-11 | Export finalize requires: no blocking open findings ∧ all required decisions approved ∧ status `locked` ∧ manifest.approvedVersion === currentVersion ∧ no event after lock ∧ renderer input hash === manifest hash. |
| I-12 | Decision ledger entries are append-only; corrections are new entries (no in-place history edits). |
| I-13 | Event log appends are durable (tx committed) before command returns success. |
| I-14 | Object bounds are template-resolved; no object may carry user/agent-authored absolute x/y as input (constraints only). |
| I-15 | Tool executions never mutate state outside the command bus (no engine writes state directly). |

## 6. Business Rules (beyond invariants)

| # | Rule |
|---|---|
| R-01 | Semantic placement vocabulary only: before/after/above/below/left_of/right_of/inside_same_region (matches spec §19 enum). |
| R-02 | Uncertain interpretations (confidence < threshold or analyses disagree) must not appear in generated alt text without explicit user inclusion (spec §9.7). |
| R-03 | Chart narrative template states only computable facts (extremes, deltas, ordering); agent refinements are staged decisions. |
| R-04 | Chart baseline rule: bar charts encode zero-baseline unless user explicitly overrides with a recorded decision; truncated-baseline exports carry a warning finding. |
| R-05 | Time-series must map to line charts with ordered temporal axis; categorical comparison defaults to horizontal bar when any label exceeds fit threshold (deterministic recommendation rules, spec §13.3). |
| R-06 | Every diagram must declare entry/terminal nodes for process/decision types or carry a warning finding. |
| R-07 | Consequential tool calls without a following human approval cannot progress document to `document_ready` (unapproved decision count must be 0). |
| R-08 | SVG imports: scripts, external refs, animations, and non-allowlisted elements/attrs stripped; rejection if parse fails (never partial trust). |
| R-09 | Upload caps: 25 MB/image, 50 MB/CSV×? (CSV 5 MB), 100 pages guard, 400 objects guard — typed errors, user-facing guidance. |
| R-10 | Privacy receipt entry required for every non-local processing event (agent analysis of sensitive assets included). |
| R-11 | `documentType` restricted to `impact-report` in R1 (schema-enum, extensible). |
| R-12 | Undo depth: last 100 commands per project; undo of an approval requires new approval (never silently re-approve). |

## 7. Domain Constraints Summary

- IDs: `nanoid`-style, prefixed per type (`pg_`, `obj_`, `dec_`, `fnd_`, `ds_`, `ast_`, `dg_`, `nd_`, `eg_`, `exp_`) — readable in logs and SR output.
- Timestamps: ISO-8601 UTC.
- Money/percent/etc. in charts: parsed via dataset schema (typed columns: number/string/date/boolean).
- Language: BCP-47; default from `navigator.language`; exports stamp `lang`.
- All cross-references are id-typed with existence validation on load (corruption → snapshot recovery path, NFR-008).
