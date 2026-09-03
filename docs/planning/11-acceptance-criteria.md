# 11 — Acceptance Criteria

> Every feature ships with all five categories below. Feature ids refer to `09-roadmap.md`.

**Feature F-1.1 Domain schemas** — AC: (1) Functional: Zod schemas parse all spec §8 shapes; inferred TS types compile strict; round-trip serialize/deserialize stable. (2) A11y: n/a (pure). (3) Security: parse rejects malformed ids, oversized strings, unknown discriminants. (4) Errors: typed `SchemaValidationError` with field paths. (5) Observability: parse failures logged (no content) with schema name.

**Feature F-1.2 Event store** — AC: (1) Durable append before ack (tx ordering test); snapshot compaction preserves replay equality; HMAC chain detects tamper. (2) n/a. (3) Tamper → typed load failure → snapshot recovery path surfaced. (4) Quota errors typed with user guidance string. (5) Storage metrics (bytes, event counts) queryable locally.

**Feature F-1.3 Command bus** — AC: (1) All §4-event-flow steps in order; version guard; state-machine guards; undo depth 100. (2) Announcements emitted for every state-changing command. (3) Human-only approvals; lock guard; project scoping. (4) Typed error union (StaleVersion, LockViolation, ApprovalDenied, NotFound, RateLimited, SchemaValidation). (5) Command metrics (count by type, error rate) in local log.

**Feature F-1.4 Intent Contract** — AC: (1) All §7 fields editable, validated (BCP-47 lang, hex colors); contract linked into recommendations. (2) Editor fully keyboard-operable; labels descriptive; errors announced. (3) Field length caps; no content egress. (4) Invalid saves blocked with field-level messages. (5) Contract edits logged as events.

**Feature F-1.5 Templates + layout** — AC: (1) All 10 templates resolve constraints; geometry deterministic (golden files). (2) Template picker SR-described (purpose per template). (3) Constraint cycles rejected. (4) Unresolvable constraint → typed error + finding. (5) Resolution timings logged.

**Feature F-1.6 Text features** — AC: (1) All §10.2 features create/edit/reorder via commands. (2) Semantic HTML rendering (h1–h4, ul/ol, blockquote, figure/figcaption, aside, a[rel]). (3) Hyperlink schemes allowlisted (http/https/mailto); javascript: rejected. (4) Length caps with counters. (5) Text command events logged (no prose in logs).

**Feature F-1.7 Navigator / F-1.8 Explorer** — AC: (1) Navigate pages/headings/objects; jump by type/warning/unapproved. (2) Full §21.4 field exposure; tree ARIA per §2 of a11y doc; Alt+ shortcuts; focus rules per §4. (3) No content beyond active project. (4) Empty states announced. (5) Navigation usage counts (locally).

**Feature F-1.9 Autosave/multi-tab** — AC: (1) Save within 2s of change; reload restores; crash-safe. (2) Status announced politely. (3) Second tab read-only banner; no split-brain. (4) Quota warnings actionable. (5) Save latency metrics.

**Feature F-1.10 HTML preview** — AC: (1) Preview = semantic render used by export; reading order respected. (2) axe-clean; lang stamped. (3) Untrusted text escaped (no HTML injection). (4) Render failures typed. (5) n/a.

**Feature F-1.11 WebMCP shell** — AC: (1) Probe → register per open project → unregister on close; schemas compiled `additionalProperties:false`. (2) Activity stream role=log; no focus theft. (3) Registry snapshot pinned; no dynamic descriptions. (4) Unavailable capability → hidden affordances + notice. (5) Every execution in activity stream with version before/after.

**Feature F-2.x Image workflow** — AC: (1) Upload→register→analyze→compare→select→crop→alt-text→place chain complete; decisions staged. (2) Comparison UI: criteria as SR table; selection via decision card; crop controls keyboard-alternative (2.5.7). (3) Sanitizer corpus green; size/MIME caps; provenance required. (4) Unsupported format/oversize → typed errors with guidance. (5) Analysis records show evidenceType labels; uncertain claims excluded from alt text (R-02).

**Feature F-3.x Diagram** — AC: (1) CRUD+layout+validation+descriptions+exports per §12; repair loop works via tools. (2) Keyboard-navigable HTML graph; node/connection list; route descriptions. (3) Node/edge caps; SVG export sanitized. (4) Invalid ops (edge to missing node) typed errors. (5) Validator findings carry deterministic evidence.

**Feature F-4.x Chart** — AC: (1) Import→infer→recommend→create→validate→table+narrative per §13; dataset change stales charts. (2) Table precedes chart in DOM order; chart role=img labelled; narrative describedby. (3) CSV size caps; numeric parsing strict. (4) Mismatched data → blocking finding. (5) Recommendation reasons recorded in decision options.

**Feature F-5.x Validation/Approval/Export** — AC: (1) Full §16 suite; manifest per §28; finalize chain per I-11; hashes bind artifacts. (2) Manifest is SR-friendly report; Alt+U queue; version diff announced. (3) Approval tokens human-gesture-bound; stale finalize rejected. (4) Blocking findings produce actionable messages with suggested actions. (5) Findings recompute timings logged; export job records hashes.

**Feature F-6.x WebMCP hardening** — AC: (1) ~80 tools registered with read/write split. (2) Announcements for agent actions per §21.3 template. (3) All `07-security-review.md` §3 suites green; rate limits; snapshot pinning. (4) No-agent degradation complete. (5) Tool metrics: calls, rejects by reason.

**Feature F-7.x A11y validation** — AC: (1) All §32.3 scripted tests pass and recorded. (2) NVDA primary; JAWS/VoiceOver reduced sets. (3) n/a. (4) n/a. (5) Conformance statement + known limitations published.

**Feature F-8.x Understand mode & remaining** — AC: (1) Digital PDF → semantic+spatial views with confidence labels; limited conversion disclosed; icon studio + privacy center complete. (2) Reader navigation SR-first; icon search by meaning. (3) Imported content inert (injection corpus). (4) Parse failures typed with page-level context. (5) Privacy receipts per non-local processing event.

**Feature F-9.x Release** — AC: (1) Live URL + PWA offline; seed demo project loads. (2) Lighthouse a11y ≥95. (3) Headers verified (CSP, nosniff, no-referrer, tools=(self)); dep audit clean. (4) Deployment rollback = redeploy previous immutable asset hash. (5) Release checklist doc completed.
