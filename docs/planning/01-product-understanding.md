# 01 — Product Understanding

> Status: Approved · Source of truth: `vistect_pts.md` v1.0 · This document is the planning-phase distillation of Phases 1 (Project Understanding) of the engineering execution plan.

## 1. Executive Summary

**What the product is.** Vistect is a privacy-conscious, WebMCP-native workspace where blind and low-vision users independently **understand**, **author**, **inspect**, **verify**, and **publish** visual documents — specifically professional multipage reports (3–20 pages) exported as PDF plus an accessible HTML companion. Documents are stored as a **semantic object model** (pages → typed objects with bounds, constraints, reading order, accessibility metadata, provenance, approval state), never as an unstructured bitmap canvas.

**Who it serves.** Blind and low-vision professionals, students, researchers, educators, nonprofit leaders, freelancers, and business owners — people who can author the text of a report but today depend on a sighted person for image selection, diagram construction, page arrangement, visual quality inspection, and final approval.

**Core differentiators.**
1. **Agent-as-analyst, human-as-author**: the user's own browser agent (via WebMCP) proposes and executes structured operations; deterministic systems validate measurable properties; the user reviews every subjective decision and holds final approval authority.
2. **Epistemic discipline everywhere**: deterministic facts, AI-assisted interpretations, uncertain observations, and human decisions are labeled and separated in every surface (image analysis, validation findings, verbal preview).
3. **Semantic control, not coordinate control**: users say "place the image after the introduction," never `x`/`y`.
4. **Version-bound export**: the exported artifact is hash-linked to the exact inspected and locked version — stale or unapproved states cannot finalize.
5. **Local-first privacy**: project storage, parsing, layout, validation, and export all happen in-browser; nothing leaves the device except to the user's own chosen agent.
6. **Accessibility as data model**: reading order, alt text, long descriptions, chart tables, and approval state are first-class schema fields, not export-time decorations.

**Why it matters.** Existing tools help blind people *consume* visual content created by others. Vistect removes the "disability tax" (time, privacy, dependence, coordination, creative control, employment/educational participation) by giving blind creators independent command over visual communication. Defining user question: *"Could you send this document without asking a sighted person to check it?"*

## 2. Problem Analysis

### Current workflow (before Vistect)
1. Blind author writes full report text independently.
2. Visual production stalls: author must recruit a sighted collaborator for image selection, cropping, diagram construction, layout, icon consistency, chart honesty, and visual QA.
3. Author cannot verify the collaborator's work independently; revision cycles repeat through the collaborator.
4. Final send-off requires an act of trust, not verification.

### Pain points (mapped to product capability)
| Pain | Spec evidence | Vistect answer |
|---|---|---|
| "Which photograph is appropriate?" | §2 | Image comparison studio with intent-alignment criteria + decision ledger |
| "Does this image communicate independence or charity?" | §2, §7 `avoid` | Tone/representation criteria surfaced; agent interpretations labeled; human approves |
| "Is the page visually balanced?" | §2, §9.3 | Spatial narration + deterministic layout checks |
| "Does this diagram contain missing paths?" | §2, §12.4 | Graph topology validation (unreachable nodes, missing decision outcomes, cycles) |
| "Does the chart honestly communicate the data?" | §2, §13.4 | Data-to-visual equality checks, baseline review, category ordering |
| "Is any text hidden/truncated/overlapping?" | §2, §16.2 | Deterministic overflow/overlap/out-of-bounds checks |
| "Can I safely send the exported PDF?" | §2, §28 | Version-bound manifest: all blocking checks pass, all decisions approved, hash-linked export |

### Dependency problems
The dependency is structural, not incidental: every visual decision in conventional tools assumes sight. Screen readers can read text but cannot author layout, judge composition, or verify export fidelity. Generic AI chatbots describe images but cannot operate a document model with auditability, version binding, or approval gates — and screenshot-driven agent operation of a visual canvas is brittle and unauditable (spec §20).

### Accessibility barriers in existing tools
- Canvas-based editors (Canva et al.) are drag-and-drop-first; semantics are rendering artifacts, not data.
- PDF is a print-description format: reading order, alt text, and structure are afterthoughts.
- AI describers conflate observation with interpretation; hallucinated details flow into alt text unchallenged (spec §9.7).
- No existing tool separates *facts the system can prove* from *opinions a model holds* from *decisions a human must make*.

### Why existing solutions fail
| Solution class | Failure mode |
|---|---|
| Screen readers | Read text; cannot author or verify visual structure |
| Generic PDF chatbots | No authoring, no approval model, no version binding, no export |
| Canva-like editors | Screenshot-driven agent operation is brittle; semantics not in data model; not keyboard/SR-first |
| Sighted collaborator | The problem itself: time, privacy, dependence, coordination, creative control |

## 3. Product Vision

### Long-term vision
Vistect becomes the agent-native authoring standard for accessible visual communication: any visual artifact a professional produces (reports now; presentations, DOCX, shared reviews later — roadmap §36 R2–R4) is authored through semantic operations, validated deterministically, approved by the human author, and exported version-bound. The platform's moat is the **trust model**: provenance, approvals, and verifiable agent collaboration.

### Initial release vision (R1)
One document class done superbly: **professional multipage impact reports** (3–20 pages), ten fixed accessible templates, images + curated icons + bar/line charts + process/decision diagrams, Understand + Create + Inspect loop, ~80 WebMCP tools, deterministic layout/accessibility checks, Visual Decision Ledger, version-bound PDF + accessible HTML export. Explicit non-goals (spec §3.3, §29.2): no pixel-perfect PDF editing, no Word/PowerPoint round-trips, no video, no guaranteed PDF/UA certification, no autonomous design agent.

### Success criteria
**Primary metric:** percentage of visual document projects completed without sighted assistance for visual selection, arrangement, or final verification.

**Supporting metrics (spec §33):** independently approved visual decisions; % objects with provenance and approval status; agent errors independently detected by users; diagram/chart/layout defects corrected; unapproved changes blocked; documents exported; user confidence in sending the final artifact.

**Engineering success criteria for R1:**
1. All §31 must-have features shipped with passing automated tests.
2. WCAG 2.2 AA conformance claim backed by: axe-core zero criticals in CI, keyboard-complete core workflow, documented NVDA pass, published conformance statement + known limitations.
3. Full §34 demo script executable by a real browser agent against the hosted URL.
4. Zero data leaves the device except to the user's agent; privacy receipt feature complete.
5. All ~80 WebMCP tools schema-tested with stale-version and injection corpora passing.

## 4. Product Principles (binding constraints on engineering)

1. **The user remains the visual author** — agent recommends and operates; user controls message, representation, final approval.
2. **Semantic control before coordinate control** — no raw x/y in any user- or agent-facing instruction surface.
3. **Facts / model judgments / human decisions must be separated** — enforced by schema (`evidenceType`, observation/interpretation/uncertainty arrays).
4. **Every consequential agent action must be inspectable** — what changed, why, which tool, what source, approval state, how to undo.
5. **Accessibility is part of the core data model** — never export-time decoration.
6. **Privacy must be observable** — local vs remote processing visible; privacy receipts.
7. **Deterministic validation must not be replaced by AI opinion** — geometry/topology/contrast/chart-values/version use computed checks.
