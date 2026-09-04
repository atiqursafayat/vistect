# Vistect

WebMCP-native accessible visual document workspace for blind and low-vision professionals.

## Overview

Vistect enables blind and low-vision users to independently **understand**, **author**, **inspect**, **verify**, and **publish** visual documents — specifically professional multipage reports (3–20 pages) exported as PDF plus an accessible HTML companion.

### Core Differentiators

1. **Agent-as-analyst, human-as-author**: The user's own browser agent (via WebMCP) proposes and executes structured operations; deterministic systems validate measurable properties; the user reviews every subjective decision and holds final approval authority.

2. **Epistemic discipline everywhere**: Deterministic facts, AI-assisted interpretations, uncertain observations, and human decisions are labeled and separated in every surface.

3. **Semantic control, not coordinate control**: Users say "place the image after the introduction," never `x`/`y`.

4. **Version-bound export**: The exported artifact is hash-linked to the exact inspected and locked version.

5. **Local-first privacy**: Project storage, parsing, layout, validation, and export all happen in-browser; nothing leaves the device except to the user's own chosen agent.

6. **Accessibility as data model**: Reading order, alt text, long descriptions, chart tables, and approval state are first-class schema fields.

## Architecture

```
apps/web/                 # Vite React SPA (the product)
packages/
  domain/                 # Pure domain: schemas, events, commands, bus, state machines
  graph/                  # Diagram topology, geometry, layout adapters
  charting/               # Dataset import, chart recommendation, rendering, integrity
  render-html/            # Semantic HTML preview + export bundle
  render-pdf/             # pdf-lib deterministic renderer
  webmcp/                 # Tool registry, schema compiler, gate, activity, probe
  storage/                # IndexedDB event store, snapshots, HMAC, quota, Web Crypto
  testing/                # Fixtures, mock modelContext, axe config
```

## Getting Started

### Prerequisites

- Node.js 20+
- pnpm 9+

### Installation

```bash
pnpm install
```

### Development

```bash
# Start dev server
pnpm dev

# Run type checking
pnpm typecheck

# Run linting
pnpm lint

# Run unit tests
pnpm test:unit

# Run E2E tests
pnpm test:e2e

# Full CI pipeline
pnpm test:ci
```

### Building

```bash
pnpm build
```

## WebMCP Integration

Vistect implements the WebMCP (Web Model Context Protocol) standard, exposing ~80 semantic tools to browser-based AI agents. The implementation follows the WebMCP best practices:

- **Imperative API** (`navigator.modelContext.registerTool`) for all semantic operations
- **Tool annotations** (`readOnlyHint`, `untrustedContentHint`) on every tool
- **User confirmation** via `client.requestUserInteraction()` for consequential actions
- **Progressive enhancement** — full manual UI parity when WebMCP unavailable
- **Spec version pinning** against Chrome 149 Origin Trial
- **Rate limiting** (token bucket) on all modelContext access

## Accessibility

Vistect targets WCAG 2.2 AA conformance:

- Semantic HTML-first component system
- Complete keyboard operability
- Screen reader support (NVDA + Chrome primary)
- Live region announcements for all async changes
- Focus management with no focus theft by agent actions
- Reduced motion support
- High contrast mode support
- 200%/400% zoom reflow

## Testing

- **Unit**: Vitest with jsdom/happy-dom
- **Integration**: In-memory IndexedDB shim
- **Contract**: WebMCP registry vs pinned schemas
- **E2E**: Playwright + axe-core injection
- **A11y**: Scripted NVDA passes recorded per phase gate

## Security

- Zero network egress of document content
- CSP with `connect-src 'none'`
- SVG sanitization (DOMPurify + custom allowlist)
- HMAC-signed event chain
- Agent action audit stream
- No forbidden tool patterns (`approve_all`, `publish_everything`, etc.)

## License

Apache License 2.0 — see [LICENSE](LICENSE) for details.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for development guidelines.

## Documentation

Planning documents in `docs/planning/`:
- 01-product-understanding.md
- 02-requirements.md
- 03-architecture.md
- 04-domain-model.md
- 05-tech-stack.md
- 06-risk-register.md
- 07-security-review.md
- 08-accessibility-review.md
- 09-roadmap.md
- 10-test-strategy.md
- 11-acceptance-criteria.md
- 12-implementation-plan.md
- 13-repository-structure.md
- 14-observability.md