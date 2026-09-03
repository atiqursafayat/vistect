# 14 — Observability

> Principle: **local-only by default** (NFR-006, NFR-010). No content in logs. The user can inspect everything the system observed about them — observability is a feature ("Privacy must be observable", spec §4.6).

## Logging
- Structured JSON ring buffer (last 2,000 entries) in IndexedDB `vistect-meta.logs`: `{ts, level, category, code, durationMs?, counts?}`.
- **Redaction rule:** fields never include document prose, image bytes, alt text, dataset values — only ids, types, counts, durations, error codes.
- Levels: `debug` (dev), `info` (command/tool lifecycle), `warn` (quota, degradation), `error` (typed failures).
- Debug bundle export (support flow): logs + storage stats + capability report — user-initiated download only.

## Metrics (local counters, daily rollup)
- Commands by type/result; tool calls by name/reject-reason; findings open/resolved by category; validation recompute duration; export duration/size; layout duration; storage usage vs quota.
- Surfaced in-app: Settings → Diagnostics (accessible table + summary).

## Tracing
- Correlation id per command → spans across bus → engines → store; attached to activity-stream entries. Enables "why did this change" replay.

## Audit logs (= product features)
- **Agent activity stream:** every tool execution (tool, args-summary, result code, version Δ, actor, ts) — append-only, user-visible, exportable.
- **Decision ledger:** full history incl. rejected alternatives (spec §15).
- **Event log:** domain truth (HMAC-chained).

## Accessibility telemetry
- Live-region announcement counter + last message (id only); focus-restoration failures (log code `a11y.focusRestoreFailed`); shortcut usage counts. Purpose: catch announcement gaps (A11Y-01) without recording content.

## WebMCP telemetry
- Capability probe result per session; registrations/unregistrations; gate rejections by reason (rate, stale, approval); tool error taxonomy counts (AI-03).

## Privacy logs
- **Privacy receipts** (FR-142): every non-local processing event — asset id, purpose, scope, consent ref, ts. User-facing list in Privacy Center; exportable.

## Dashboards (docs-as-dashboards, local Diagnostics view)
- Diagnostics page panels: Storage health (usage/quota/persist status), Performance (p95 durations vs budgets), Findings funnel, Agent activity stats, Privacy receipts.
- Release checklist consumes exported counters for perf budgets (Phase 9).

## Incident procedure (local-first product)
User-reported issue → user exports Debug Bundle → bundle attached to GitHub issue → reproduction from fixtures. No remote capture exists by design.
