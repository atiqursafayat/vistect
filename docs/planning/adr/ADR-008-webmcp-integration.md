# ADR-008 — WebMCP Integration Contract

- **Status:** Accepted
- **Date:** 2026-09-04
- **Deciders:** Engineering (single contributor)
- **Supersedes:** `vistect_pts.md` §19 (namespace and `execute` return shape) and the §18.2–18.11 tool enumeration
- **Referenced by:** `02-requirements.md` A12/NFR-012/NFR-016, `03-architecture.md` §7/§12, `07-security-review.md`, `10-test-strategy.md` §7, `11-acceptance-criteria.md` F-1.11/F-6.x, `12-implementation-plan.md` Phases 1/6/9

---

## 1. Context

Vistect is WebMCP-native: the user's own browser agent is the only interpretive AI in the system (ADR-001), and it operates the document exclusively through typed tools. The WebMCP layer is therefore not an add-on — if it mis-registers, the product's central claim fails.

WebMCP is a W3C Web Machine Learning Community Group draft (first published February 2026), available in a Chrome 149 origin trial. It is **tab-bound and ephemeral**: tools exist only while the page is open, there is no server and no persistence. The API surface is not final.

The source specification `vistect_pts.md` §19 documents registration on `document.modelContext` and an MCP-server-style `{content:[{type:"text"}]}` return value. Both are incorrect for the browser API. Left uncorrected, the namespace error is silent and total: the capability probe would evaluate a permanently falsy expression, graceful degradation (FR-127) would engage on every load, no tool would ever register, and the mock test harness — mocking the same wrong object — would stay green. The product would appear to work and expose nothing.

This ADR fixes the API surface, resolves duplicate and overlapping tool names, and closes the gaps around annotations, human confirmation, secure context, and origin-trial provisioning.

## 2. Decision

### 2.1 Namespace and API surface

Tools are registered on **`navigator.modelContext`**, not `document.modelContext`.

```
navigator.modelContext.registerTool(tool, options)   // register
navigator.modelContext.getTools()                    // introspect (diagnostics)
navigator.modelContext.executeTool(tool, inputJson)  // page-side dry-run only
navigator.modelContext.ontoolchange                  // outbound notification
```

A tool descriptor is `{ name, description, title?, inputSchema?, execute, annotations? }`. `options` is `{ signal?, exposedTo? }`.

`executeTool` is a **page-side** manual/dry-run entry point. The agent does **not** invoke tools through it; the browser calls each tool's own `execute`. This has a direct architectural consequence — see §2.6.

`ontoolchange` fires **when the tool set changes**; it is an outbound notification, not a signal for the page to re-register. Registration lifetime is governed solely by our own `AbortController` scoping (§2.7).

### 2.2 `execute` signature and return value

```ts
execute: (input: TInput, client: ToolClient) => string | Promise<string>
```

- `input` is the already-parsed arguments object.
- `client.requestUserInteraction(callback)` pauses execution for the user (§2.5).
- The return value is a **single string** that the browser wraps. We do **not** emit `{content:[...]}`; that is the MCP server wire format and is wrong here.

**Summary-first return contract.** The returned string is what the agent reads back, and — via the activity stream — what a screen reader announces. Every tool returns one readable lead sentence, then the machine-readable payload:

```
<plain-language summary>. Document version <n>. <k> unapproved decision(s).
---
{ "…structured fields…" }
```

A bare `JSON.stringify` blob is prohibited (contract-tested). Rationale: the skill's guidance that the return string "is what the agent reads back, so make it specific" coincides exactly with FR-152 announcement quality for screen-reader users. One string serves both.

### 2.3 Canonical tool registry — 72 tools

The §18 enumeration contained two names registered twice (`inspect_chart`, `trace_diagram_path`), seven overlapping near-duplicate pairs, and omitted `record_image_analysis` (required by FR-064). A registry cannot hold duplicate names, and near-duplicates cause wrong-tool selection because the agent knows only what the names and descriptions tell it.

Operation classes: **R** read · **W** write (version-gated) · **C** consequential (stages a decision for human approval) · **H** human-gated (completes only inside `requestUserInteraction`).

| Group | n | Tools (class) |
|---|---|---|
| project | 10 | `create_document` W · `get_document_overview` R · `get_document_structure` R · `get_intent_contract` R · `update_intent_contract` W · `list_pages` R · `get_page_structure` R · `create_page` W · `move_page` W · `apply_page_template` C |
| reader | 9 | `read_section` R · `describe_page_layout` R · `inspect_visual_object` R · `inspect_placed_image` R · `inspect_chart` R · `inspect_diagram` R · `inspect_table` R · `compare_visual_elements` R · `list_uncertain_interpretations` R |
| text | 5 | `add_text_section` W · `update_text_content` W · `set_heading_level` W · `move_section` W · `create_caption` W |
| image | 8 | `register_uploaded_image` W · `inspect_image_asset` R · `record_image_analysis` W · `compare_image_candidates` R · `select_image` C · `propose_image_crop` C · `apply_approved_crop` W · `generate_contextual_alt_text` C |
| diagram | 9 | `create_diagram` C · `add_diagram_node` W · `update_diagram_node` W · `remove_diagram_node` W · `connect_diagram_nodes` W · `remove_diagram_connection` W · `apply_diagram_layout` C · `trace_diagram_path` R · `generate_diagram_description` C |
| chart | 6 | `import_chart_data` W · `recommend_chart_types` R · `create_chart` C · `change_chart_type` C · `compare_chart_categories` R · `generate_chart_narrative` C |
| icon | 6 | `search_icons_by_meaning` R · `compare_icon_candidates` R · `set_icon_family` C · `assign_icon` C · `replace_icon` C · `check_icon_consistency` R |
| layout | 5 | `place_object_relative_to` C · `group_objects` W · `set_visual_priority` C · `change_reading_order` C · `move_object_to_page` C |
| verification | 8 | `run_layout_checks` R · `run_accessibility_checks` R · `run_chart_checks` R · `run_diagram_checks` R · `list_unapproved_decisions` R · `find_subjective_visual_risks` R · `compare_document_versions` R · `verify_intent_alignment` R |
| approval/export | 6 | `open_decision_for_review` H · `lock_page` H · `unlock_page` H · `preview_export_manifest` R · `lock_document_version` H · `finalize_locked_export` H |

**Totals: 72 tools — 31 R, 19 W, 17 C, 5 H.** This exact number replaces every prior "~80 tools" claim.

Resolution log (each change removes an ambiguity an agent would have to guess about):

| Spec name(s) | Resolution | Reason |
|---|---|---|
| `inspect_chart` ×2, `trace_diagram_path` ×2 | one registration each | duplicate names are unregistrable |
| `inspect_image` / `inspect_image_asset` | `inspect_placed_image` / `inspect_image_asset` | names now say placed page object vs library asset |
| `place_image_relative_to` / `place_object_relative_to` | `place_object_relative_to` only | the second was a strict superset |
| `validate_chart_integrity` / `run_chart_checks` | `run_chart_checks` | same operation |
| `validate_diagram_structure` / `run_diagram_checks` | `run_diagram_checks` | same operation |
| `list_unresolved_decisions` / `find_unapproved_visual_decisions` | `list_unapproved_decisions` | same operation; "unapproved" matches the domain term |
| `inspect_page` / `describe_page_layout` | `get_page_structure` / `describe_page_layout` | structural facts vs spatial narration |
| `approve_visual_decision` + `reject_visual_decision` | `open_decision_for_review` | see §2.5 |
| (missing) | `record_image_analysis` added | required by FR-064 |

### 2.4 Annotations — mandatory

`annotations` was absent from all planning. Two hints are now required:

- **`readOnlyHint: true` on all 31 read tools.** Exactly the read class; the mapping is mechanical and contract-tested both ways (read ⇔ hint).
- **`untrustedContentHint: true` on the 28 read tools that surface text originating from imported documents, uploaded assets, or user authoring** — every reader tool, `get_document_overview`, `get_document_structure`, `get_intent_contract`, `list_pages`, `get_page_structure`, `inspect_image_asset`, `compare_image_candidates`, `trace_diagram_path`, `recommend_chart_types`, `compare_chart_categories`, all eight verification tools, and `preview_export_manifest`. Excluded: the three icon tools, which return only our own curated Lucide metadata.

The second hint matters disproportionately here. T-02 and SEC-02 identify prompt injection via imported PDF text and image OCR as a top threat, and defend it with home-grown controls (static descriptions, results-as-data, text-node rendering, injection corpus). Those controls stay. `untrustedContentHint` adds the platform's own signal telling the agent to treat that text as data rather than instructions — defence in depth from the standard itself, previously unused.

`title` is set on every tool. Without it a screen reader announces `place_object_relative_to` verbatim in the activity stream; with it, "Place an object relative to another".

### 2.5 Human authority — consequential vs human-gated

Two distinct mechanisms, deliberately not merged:

**Consequential (C, 17 tools) — staged decisions.** Unchanged and retained: the tool applies the change with `approval.status = "proposed"`, opens a `VisualDecision` with alternatives/evidence/uncertainty, announces, and enqueues it for `Alt+U`. The user decides later, in a real decision card, with full context. This is *stronger* than a confirmation dialog and is Vistect's core differentiator; a modal yes/no would be approval theatre and would feed PR-03 (agent perceived as author).

**Human-gated (H, 5 tools) — `requestUserInteraction`.** For actions that are finalizing or user-only by domain rule, `execute` pauses for the user before doing the work, following the standard's confirmation pattern:

```js
execute: async ({ …args }, client) => {
  let outcome = null;
  await client.requestUserInteraction(async () => {
    outcome = await presentLockOrManifestUiAndAwaitChoice(); // mints the approval token
  });
  if (!outcome?.confirmed) return 'The user did not confirm. Nothing changed. …';
  const r = await bus.dispatch(cmd, { actor: humanActor, token: outcome.token });
  return summaryFirst(r);
}
```

The user's gesture inside the callback is what mints the approval token and supplies the `human` actor, so I-03 and I-11 hold **by construction**, not merely by a rejecting guard.

`approve_visual_decision` and `reject_visual_decision` are **not** registered. An agent-invocable "approve" either violates I-03 (always fails — a tool that can never succeed is bad tool design and misleads the agent) or lets the agent decide (violates product principle 1). They are replaced by one honest tool, `open_decision_for_review`, which brings the user to the decision card and reports what *they* chose. The internal commands `ApproveVisualDecision` / `RejectVisualDecision` are unchanged and remain UI-only. This also collapses an overlap with `list_unapproved_decisions`.

**No tool may be registered that the command bus will always reject.** Contract-tested.

### 2.6 Gate placement — inside `execute`, not at the registry

Because the agent's invocations reach `execute` directly and never pass through `executeTool` (§2.1), a gate wrapping the registry boundary would be bypassed by every real agent call while still appearing to work in page-side dry-runs.

Therefore the `ExecutionGate` (version check, class enforcement, rate limit, activity recording, project scoping) is applied at **tool-definition time**: every descriptor is built through `defineTool()`, which returns an already-wrapped `execute`. `registerTool` receives no unwrapped function. Enforced by lint rule and contract test: no `registerTool` call site may pass a raw `execute`.

### 2.7 Registration lifecycle

1. **Probe** on app start: `'modelContext' in navigator`, secure-context check, and writer-tab status → a typed `CapabilityReport` with a reason code (`ok` · `no_api` · `insecure_context` · `read_only_tab`). The reason is surfaced to the user, not swallowed — an insecure origin during device testing must be diagnosable rather than looking like an absent agent.
2. **Register** when a project context opens, scoped to one `AbortController` per project session.
3. **Read-only secondary tabs register read tools only.** The single-writer election (`03-architecture.md` §6) means a secondary tab cannot write; registering write tools there would give the agent a set of confusingly failing tools. Any write attempt in such a tab returns: "This tab is read-only because another tab is editing this project. Ask the user to switch to that tab."
4. **Unregister** by `controller.abort()` on project close, route change, or writer-status loss.
5. No re-registration is driven by `ontoolchange` (§2.1).

`exposedTo` is left at its default (own origin plus built-in agents). No cross-origin exposure in R1.

### 2.8 Version handshake

Every write carries `expectedDocumentVersion`; mismatch yields `StaleVersionError`. Two additions:

- **Every read result includes `currentDocumentVersion`.** Without it the agent has no legitimate source for the value and its first write in a session would fail predictably.
- **Stale errors are literally actionable:** `"Stale version. The document is now at version 12. Re-read the affected object and retry with expectedDocumentVersion: 12."` Per the failure-usefully rule, every error tells the agent what to do next, including when to hand the task back to the user.

### 2.9 Platform constraints — secure context and origin trial

- WebMCP requires a **secure context**. `localhost` is fine; plain-HTTP LAN or device testing silently disables everything. Documented in the dev runbook and reported by the probe (§2.7).
- The **origin-trial token** is provisioned in Phase 9 as a `<meta http-equiv="origin-trial">` tag plus the response header in `vercel.json`, with the expiry date recorded in the release checklist and a renewal owner. The §34 demo is agent-driven end to end, so a missing or expired token is a demo-day outage.

### 2.10 Declarative API — evaluated, rejected for R1

The declarative API (`toolname` / `tooldescription` / `toolautosubmit` on `<form>`, `toolparamtitle` / `toolparamdescription` on fields) was evaluated and rejected for R1, recorded here rather than left as a silent omission.

Core document operations are not form-shaped: they are version-gated, project-scoped, decision-staging commands over a semantic object model. Three surfaces *are* form-shaped (Intent Contract editor, CSV import confirmation, alt-text approval), but routing them through form annotations would create a second write path that bypasses the command bus, breaking the single-write-path invariant that makes audit, staleness, and undo provable. The cost of the imperative API here is a schema compiler we already need for Zod parity.

Where it does apply: `toolautosubmit` is **never** used anywhere in Vistect. Its declarative equivalent of "let the user review before submitting" is already our default posture.

## 3. Consequences

**Positive.** The tool layer actually registers. Blocker-class silent failure removed. Duplicate and overlapping names eliminated, so agent tool selection is unambiguous. Injection defence gains the standard's own hint. Human authority is structural rather than guard-dependent for the finalizing class. Probe failures are diagnosable. One exact tool count replaces four inconsistent claims.

**Negative / accepted.** 72 tools instead of "~80" — the reduction is de-duplication, not scope loss, and must be stated that way in the demo narrative. Renaming eight spec tool names is a documented deviation from `vistect_pts.md`. `defineTool()` adds one mandatory indirection at every registration site. Summary-first returns cost a formatter per tool group.

**Risk carried (AI-04).** The API is not final. Mitigations: the entire surface lives behind `packages/webmcp` and nothing outside it touches `navigator.modelContext`; §4 records the assumption date; re-verification is a gate at Phase 6 exit and again at Phase 9 deploy.

## 4. API assumptions — dated

Recorded against the spec and Chrome documentation **as of May 2026**. Re-verify each row before Phase 6 exit and before Phase 9 production deploy; any drift amends this ADR.

| # | Assumption |
|---|---|
| A1 | Registration namespace is `navigator.modelContext` |
| A2 | Descriptor shape is `{ name, description, title?, inputSchema?, execute, annotations? }` |
| A3 | Names are 1–128 chars from `[A-Za-z0-9_.-]`; our stricter house rule is `^[a-z][a-z0-9_]+$` |
| A4 | `registerTool` options are `{ signal?, exposedTo? }`; `AbortSignal` unregisters |
| A5 | `execute(input, client)` returns `string \| Promise<string>`; the browser wraps it |
| A6 | `client.requestUserInteraction(callback)` is the user-confirmation mechanism |
| A7 | `annotations` supports `readOnlyHint` and `untrustedContentHint` |
| A8 | `getTools()` and `executeTool(tool, inputJsonString)` are page-side introspection/dry-run |
| A9 | `ontoolchange` is an outbound change notification |
| A10 | A secure context is required |
| A11 | Chrome 149 origin trial; token via meta tag and/or response header |
| A12 | Declarative attributes: `toolname`, `tooldescription`, `toolautosubmit`, `toolparamtitle`, `toolparamdescription` |

## 5. Alternatives considered

| Alternative | Rejected because |
|---|---|
| Follow `vistect_pts.md` §19 verbatim | Registers nothing; silent total failure |
| Support both namespaces defensively | Doubles the mock surface and hides which path is live; the probe reason code gives better diagnostics |
| Keep `{content:[…]}` returns | Wrong layer's format; also degrades agent and screen-reader readability |
| Register `approve_visual_decision` and let the bus reject it | A permanently failing tool misleads the agent and wastes turns |
| Confirm consequential changes with `requestUserInteraction` instead of staged decisions | Loses alternatives, evidence, uncertainty and the `Alt+U` queue — the product's differentiator |
| Gate at the registry boundary | Bypassed by real agent invocations (§2.6) |
| Declarative API for form-shaped surfaces | Creates a second write path around the command bus |
| `userland webmcp.js` library | Separate project with its own API; the origin trial exposes the standard surface |
