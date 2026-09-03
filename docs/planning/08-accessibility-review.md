# 08 — Accessibility Review (WCAG 2.2 AA)

> Vistect's primary users are blind/low-vision. Accessibility is the product, not a compliance checkbox. This document binds engineering.

## 1. Accessibility Requirements Matrix (WCAG 2.2 AA — selected criteria mapped to implementation)

| Criterion | Level | Implementation commitment | Verified by |
|---|---|---|---|
| 1.1.1 Non-text content | A | Every object carries AccessibilityMetadata; decorative flagged `role="presentation"`; charts → table + narrative; diagrams → node list + long description | unit + axe + SR test |
| 1.3.1 Info & relationships | A | Semantic HTML first: real headings, lists, landmarks (`banner/main/nav`), `<table>` for data | axe + DOM assertions |
| 1.3.2 Meaningful sequence | A | Reading order independent of DOM order; explorer follows `readingOrder` | unit + SR test |
| 1.4.1 Use of color | A | Status always icon+text; chart series differ by shape/dash + direct labels | charting tests |
| 1.4.3 Contrast (min 4.5:1) | AA | Design tokens enforced; deterministic contrast checks in validation suite | token tests + validator |
| 1.4.4 Text resize 200% | AA | rem-based type; no fixed-height text traps | E2E zoom |
| 1.4.10 Reflow 320px / 400% | AA | Single-column collapse; no 2-D scroll for content | E2E viewport |
| 1.4.11 Non-text contrast 3:1 | AA | Focus indicators, icons, chart strokes ≥3:1 | token tests |
| 1.4.12 Text spacing | AA | No loss at spacing overrides | E2E spot |
| 2.1.1 Keyboard | A | 100% operable; no drag-only ops (semantic crop/placement keyboard UIs) | keyboard E2E |
| 2.1.2 No keyboard trap | A | Modals cycle + Esc; focus return | E2E |
| 2.4.1 Skip links | A | "Skip to navigator / explorer / decisions" | E2E |
| 2.4.2 Page titled | A | Document title updates with project + view | E2E |
| 2.4.3 Focus order | A | Predictable: DOM = logical; roving tabindex in explorer | E2E focus trace |
| 2.4.6 Headings & labels | AA | Descriptive labels everywhere | axe |
| 2.4.7 Focus visible | AA | ≥2px indicator, 3:1, never `outline:none` without replacement | token + E2E |
| 2.4.11 Focus not obscured | AA (2.2) | Sticky headers/footers never cover focused element | E2E |
| 2.5.7 Dragging movements | AA (2.2) | All drag interactions have pointer+keyboard alternative (crop = numeric + semantic controls) | E2E |
| 2.5.8 Target size (24px) | AA (2.2) | Design token min target | lint storybook checks |
| 3.2.1/3.2.2 On change | A | No context change on focus; selects/inputs commit explicitly | E2E |
| 3.3.1/3.3.3 Errors | A/AA | Inline errors with role=alert, suggestions | E2E |
| 4.1.2/4.1.3 Status messages | A/AA (2.2) | Live regions (polite default); status/roles announced | announcement bus tests |
| 2.3.3 Animation from interactions | AAA→goal | `prefers-reduced-motion` honored globally | CSS tests |

## 2. ARIA Guidance

- **Rules:** native elements first; ARIA only for (a) live regions, (b) composite widgets (tree explorer), (c) tabs/dialogs where native insufficient. No ARIA on native controls. Names precede descriptions (`aria-label` < visible label < `aria-labelledby`).
- **Object explorer:** `role="tree"` / `treeitem` with `aria-level`, `aria-expanded`; type-ahead find; Home/End; `Alt+U` jumps to unapproved-decision queue.
- **Announcement bus:** one `role="status"` (polite) + one `role="alert"` (assertive, blockers only) region; messages deduped; format per spec §21.3 (action → effect → unapproved count → shortcut hint).
- **Agent activity stream:** `role="log"` with `aria-live="polite"`.
- **Decision cards:** `role="group"` + `aria-labelledby`; options as fieldsets with radio semantics; rejected-reasons as definition lists.
- **Charts:** `role="img"` + `aria-labelledby` (title) + describedby (narrative); table adjacent in DOM; sonification button labeled.
- **Diagrams (interactive HTML view):** nodes as list items with connection summaries; keyboard tracing (Enter follows primary path).

## 3. Keyboard Navigation Model (global map)

| Keys | Action |
|---|---|
| `Alt+U` | Unapproved-decision queue |
| `Alt+W` | Warning/validation queue |
| `Alt+A` | Agent activity stream |
| `Alt+N` | Document navigator (page/headings tree) |
| `Alt+O` | Semantic object explorer |
| `Alt+P` | Privacy center / receipts |
| `Esc` | Close dialog / cancel operation (restores focus) |
| Standard | Tab/Shift-Tab, arrows in composites, Enter/Space activate, `?` shortcut help dialog |

Explorer composites: Up/Down move, Right/Left expand/collapse, Enter open object inspector, `t` jump by type, `w` jump to warnings, `u` jump to unapproved.

## 4. Focus Management Strategy

1. Route/view changes: focus to view `<h1>` (tabindex=-1) with announcement.
2. Dialogs: focus first meaningful control; trap cycle; Esc/Close returns to invoker.
3. Agent actions: **never** move focus (spec §21.3); announce via live region; exceptions (blocking failure requiring choice) move focus to decision card with announcement.
4. Object deletion: focus next sibling in reading order; never body.
5. Lists (decisions/warnings): focus position preserved on resolve.

## 5. Screen Reader Testing Plan

| AT / Browser | Scope | Cadence | Scripted cases |
|---|---|---|---|
| NVDA + Chrome (primary) | All authoring surfaces + WebMCP flows | Every phase gate | §32.3 set: full keyboard workflow; navigator travel; activity inspection without focus loss; resolve validation error; image comparison; diagram create/inspect; manifest review |
| JAWS + Chrome (if license available) | Core navigator, explorer, decisions | Phase 5, 7 | Reduced set (nav + decisions + export) |
| VoiceOver + Safari | Non-WebMCP UI (editing, export) | Phase 7 | Navigator + export |
| Keyboard-only (no SR) | Everything | Every PR (automated) | Playwright focus-trace suites |

Recordings + notes stored per gate in `docs/validation/`.

## 6. Accessibility Acceptance Criteria (global — every feature must pass)

1. axe-core: zero critical/serious violations on the feature's routes.
2. Complete keyboard operability incl. all drag-alternatives; focus trace test committed.
3. All async changes announced via bus with correct politeness.
4. Names/roles/values programmatically determinable; labels descriptive.
5. No information by color/hover/position alone.
6. Reflow at 320px & 400% zoom without loss (feature's layouts).
7. Reduced-motion variant exists where animation introduced.
8. New user-facing strings reviewed for clarity (plain language, no visual metaphors).
