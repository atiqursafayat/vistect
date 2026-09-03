# Vistect

WebMCP-native accessible document studio for blind and low-vision creators.

## Overview

Vistect enables authors to independently create, inspect, verify, and publish structured visual documents — including multipage reports with diagrams, charts, and structured layouts — exported as deterministic PDF and accessible HTML companion documents.

### Core Principles

1. **Human Authority and Agent Collaboration**: Autonomous agents propose and execute structured document operations through the WebMCP protocol. Deterministic rules validate measurable properties, while the author reviews operations and holds approval authority.
2. **Epistemic Classification**: Deterministic observations, automated interpretations, and explicit human approvals are rigorously categorized across the data model and user interface.
3. **Semantic Positioning**: Layouts are authored using semantic relations (such as relative ordering and structural anchoring) rather than raw visual coordinates.
4. **Local-First Architecture**: Document storage, layout calculations, accessibility validation, and exports run entirely client-side using browser APIs (IndexedDB, Web Crypto, and Canvas/DOM).
5. **First-Class Accessibility**: Reading flow, alternative text, structural descriptions, and screen reader announcements are foundational schema fields.

## Project Structure

```
VisTect_v2/
├── docs/                      # Technical specifications and implementation architecture
│   ├── day-0-findings.md
│   ├── implementation-plan.md
│   └── vistect_pts.md
├── scripts/                   # Tooling and protocol diagnostic scripts
│   └── probe-webmcp.mjs
├── spikes/                    # DOM measurement and PDF export prototypes
│   ├── dom-measure.mjs
│   └── pdf-export.mjs
├── src/
│   ├── core/                  # Core domain models, commands, layout engine, and tool registry
│   │   ├── model/             # Document, page, object, and finding schemas
│   │   ├── commands.ts        # Immutable mutation commands
│   │   ├── defaults.ts        # Initial project configurations
│   │   ├── factory.ts         # Document object factory helpers
│   │   ├── layout.ts          # Deterministic layout geometry engine
│   │   ├── store.ts           # Reactive project store and event dispatch
│   │   ├── templates.ts       # Document layout templates
│   │   └── tools/             # Document, page, and content tool implementations
│   ├── persist/               # IndexedDB persistence layer
│   ├── ui/                    # Accessible UI workspace, canvas, announcer, and navigator
│   │   ├── ActivityStream.tsx # Operation log and audit stream
│   │   ├── Announcer.tsx      # ARIA live region screen reader announcer
│   │   ├── App.tsx            # Main workspace application shell
│   │   ├── DevAgentConsole.tsx# Development test console
│   │   ├── Navigator.tsx      # Structural document navigation panel
│   │   ├── ObjectExplorer.tsx # Detailed object properties inspector
│   │   └── PageCanvas.tsx     # Deterministic document page rendering
│   ├── webmcp/                # WebMCP registration bridge and browser capability probe
│   └── main.tsx               # Application entrypoint
└── tests/
    ├── e2e/                   # Playwright end-to-end integration tests
    └── unit/                  # Vitest unit test suites
```

## Getting Started

### Prerequisites

- Node.js >= 20.19.0
- npm >= 10.0.0
- Google Chrome (for WebMCP integration testing)

### Installation

```bash
npm install
```

### Development

Start the local Vite development server:

```bash
npm run dev
```

To run with WebMCP capabilities enabled in Google Chrome:

```bash
npm run chrome
```

### Verification & Testing

```bash
# Typecheck core and application layers
npm run typecheck

# Run unit tests
npm run test

# Run end-to-end tests with Playwright
npm run test:e2e

# Code formatting and linting checks
npm run lint
npm run format:check
```

### Building

Build production assets:

```bash
npm run build
```

## Protocol Integration (WebMCP)

Vistect implements the browser-native Web Model Context Protocol via `document.modelContext`:

- **Explicit Registration**: Exposes semantic authoring tools directly to the browser model context environment.
- **Contract Annotations**: Enforces `readOnlyHint` and `untrustedContentHint` metadata across registered operations.
- **Diagnostic Probes**: Run `npm run probe:webmcp` to verify protocol availability and inspect active tool schemas.

## Accessibility Standards

The workspace is designed to conform to WCAG 2.2 AA standards:

- Semantic DOM tree with keyboard navigation and focus management.
- Live region updates via ARIA live regions for background agent activities.
- High contrast support, responsive zoom reflow, and full screen reader compatibility.

## License

This project is licensed under the Apache License, Version 2.0. See [LICENSE](LICENSE) for details.
