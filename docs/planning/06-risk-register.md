# 06 — Risk Register

> Likelihood/Impact: Low/Medium/High. Every risk names an owner surface (package/phase) and a monitoring signal.

## Product
| ID | Risk | L | I | Mitigation | Monitoring |
|---|---|---|---|---|---|
| PR-01 | Perceived as "voice-controlled design editor" gimmick | M | H | Lead with understanding, provenance, deterministic validation, human approval (spec §35); demo script emphasizes verification loop | Demo walkthrough review; user-testing comprehension Qs |
| PR-02 | Scope explosion vs. capacity | H | H | Full-spec mandate with phased delivery; §31 must-haves sequenced first; strict module boundaries; stretch features isolated in Phase 8 | Backlog burnup; phase exit gates |
| PR-03 | Agent becomes perceived author | M | H | Decision cards, alternatives, unapproved queue, human-only approval guard | % decisions human-approved metric in demo |
| PR-04 | Users don't trust subjective findings | M | M | Evidence + confidence + keep-existing; label as interpretation everywhere | Usability test trust-calibration measure (§32.4) |

## Accessibility
| ID | Risk | L | I | Mitigation | Monitoring |
|---|---|---|---|---|---|
| A11Y-01 | Live-region announcements missed/duplicated by NVDA/JAWS | H | H | Announcement bus with dedupe + testing on real NVDA; assertive only for blockers | Manual SR test checklist per phase; CI DOM assertions on live region |
| A11Y-02 | Focus loss after agent actions/dialogs breaks SR flow | M | H | Focus restoration utilities + E2E focus assertions; agent actions never move focus | Playwright focus-travel tests |
| A11Y-03 | Complex explorer (300 objects) unusable via SR | M | H | Virtualized tree with proper roles/levels, jump menus by type/warning/approval | SR task completion in §32.4 suite |
| A11Y-04 | 400% zoom reflow failures | M | M | Responsive grid, no fixed-position traps; zoom spot-checks in E2E | Playwright viewport/zoom suite |
| A11Y-05 | axe clean ≠ actually usable | H | M | Manual NVDA scripted tests per phase gate; blind-user validation tasks | Phase gate records |

## Security & Privacy
| ID | Risk | L | I | Mitigation | Monitoring |
|---|---|---|---|---|---|
| SEC-01 | Malicious SVG upload (script/XXE/external refs) | H | H | DOMPurify + allowlist + parse-or-reject (R-08); corpus tests | Security test suite green |
| SEC-02 | Prompt injection via imported document content | H | H | Content never interpolated into tool descriptions; results-as-data; no instruction execution from content; injection corpus tests | Contract tests; code review rule (no dynamic descriptions) |
| SEC-03 | Tool-description poisoning by upstream/extension | M | H | Static descriptions from code; registry snapshot test (descriptions === shipped constants) | CI snapshot diff |
| SEC-04 | Unauthorized/stale finalization | M | H | Approval tokens bound to version+hash; I-11 chain | Invariant tests + E2E finalize attack |
| SEC-05 | Data loss via IndexedDB eviction | M | H | `storage.persist()`, quota dashboard, export/backup UX | Storage status surfaced in UI |
| SEC-06 | Cross-project leakage via agent tool calls | L | H | Project-scoped tool registration (unregister on project close); ids validated in command bus | Multi-project E2E |
| PRIV-01 | Accidental content egress | L | H | Zero-egress architecture (no analytics/telemetry SDK); CSP `connect-src 'none'` by default except dev | CSP report; network test in E2E (no request assertions) |

## AI / Agent
| ID | Risk | L | I | Mitigation | Monitoring |
|---|---|---|---|---|---|
| AI-01 | Agent vision analysis wrong (hallucinated details) | H | H | Forced structure (observations vs interpretations vs uncertainties); confidence required; R-02 blocks uncertain claims from alt text; human approval | Usability metric: agent errors caught by user |
| AI-02 | Agent unavailable/weak (no WebMCP browser) | M | M | Full manual UI parity (FR-127); capability probe + guidance | E2E no-agent path |
| AI-03 | Agent ignores schemas / spams tools | M | M | Strict Zod rejection with typed errors; per-tool rate limits in gate; version mismatches force re-read | Activity stream metrics |
| AI-04 | WebMCP spec drift (pre-standard) | M | M | Adapter layer isolates API; capability probe per feature; manual parity | Chrome flag release notes; adapter tests |

## Legal
| ID | Risk | L | I | Mitigation | Monitoring |
|---|---|---|---|---|---|
| LEG-01 | Icon/font license contamination | L | M | Lucide (ISC), Inter (OFL); license scan in CI | Dependency audit |
| LEG-02 | User uploads copyrighted material | L | L | License field + provenance required for library-grade assets; disclaimer in docs | — |

## Architecture / Performance / UX / Delivery
| ID | Risk | L | I | Mitigation | Monitoring |
|---|---|---|---|---|---|
| ARCH-01 | Event-store complexity slows delivery | M | M | Snapshot-first loading; event layer kept small (~15 event types R1) | Phase 1 exit |
| ARCH-02 | Layout engine divergence between preview/validation/export | M | H | Single layout package consumed by all three (ADR-003); geometry golden tests | Golden-file tests |
| PERF-01 | ELK layout jank on large graphs | M | M | Web-worker + node cap (150) with finding when exceeded | Perf budget test |
| PERF-02 | 20-page PDF render time | M | M | pdf-lib incremental embedding; budget test 15s | Perf budget test |
| UX-01 | Nonvisual cropping is unintuitive | M | H | Semantic crop vocabulary + deterministic validation feedback + spatial narration of result | §32.4 crop task |
| UX-02 | Alt-text approval fatigue | M | M | Batch review screen; pre-filled deterministic facts; counts in announcements | Decision queue analytics |
| DEL-01 | Single-contributor bus factor | H | M | Everything documented; conventional commits; this planning suite | — |
| DEL-02 | Browser/env variance for judges | M | M | Static SPA on CDN; capability probe + onboarding notice; test matrix Chrome/Firefox/Safari | Smoke tests on deploy previews |
