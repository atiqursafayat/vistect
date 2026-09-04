import { defineConfig } from 'vitest/config';

/**
 * Root Vitest config — the workspace definition lives here as `test.projects`.
 *
 * This replaced `vitest.workspace.ts`: `defineWorkspace` is deprecated in Vitest
 * 3 and removed in the next major, and the deprecation is a lint error under
 * `@typescript-eslint/no-deprecated`.
 *
 * Each entry points at a package's own config so environments differ where they
 * must — `happy-dom` for anything touching `navigator`, the default Node
 * environment for pure packages.
 *
 * Coverage is configured here, not per project: Vitest resolves `coverage` from
 * the root config only, so the thresholds in `apps/web/vitest.config.ts` apply
 * when that package is run directly and are ignored by a root run.
 */
export default defineConfig({
  test: {
    projects: [
      'packages/domain',
      'packages/graph',
      'packages/charting',
      'packages/render-html',
      'packages/render-pdf',
      'packages/storage',
      'packages/webmcp',
      'apps/web',
    ],

    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['packages/*/src/**/*.{ts,tsx}', 'apps/web/src/**/*.{ts,tsx}'],
      exclude: [
        // Build output, which would otherwise be measured twice (once as source,
        // once as bundled assets) and drag the total toward zero.
        '**/dist/**',
        // Not executed by unit tests: the service worker runs in a SW scope and
        // the entry point mounts React into a real document.
        'apps/web/public/**',
        'apps/web/src/main.tsx',
        '**/*.d.ts',
        // Note: `index.ts` is *not* excluded. In this repo those files hold the
        // implementation (`packages/domain/src/schema/index.ts` is 956 lines), so
        // excluding them by the usual barrel convention would hide most of the
        // codebase from the report.
      ],
      // A regression ratchet measured against the current suite, not the target.
      // `apps/web/vitest.config.ts` keeps the 80% goal for that package. This
      // floor sits just under today's numbers so coverage cannot slide while
      // packages/{graph,charting,render-html,render-pdf} remain untested; raise
      // it as those suites land.
      thresholds: {
        lines: 18,
        statements: 18,
        functions: 45,
        branches: 70,
      },
    },
  },
});
