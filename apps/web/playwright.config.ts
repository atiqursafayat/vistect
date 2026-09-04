import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright configuration.
 *
 * `PORT` matches `vite.config.ts`; both read the same default so the dev server
 * and the tests cannot disagree about where the app is served.
 */
const PORT = 3000;
const BASE_URL = `http://localhost:${String(PORT)}`;

const isCI = process.env['CI'] === 'true' || process.env['CI'] === '1';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,

  // Fail the CI run if a `.only` was committed, and retry twice to absorb
  // genuine flakiness without hiding it locally.
  forbidOnly: isCI,
  retries: isCI ? 2 : 0,
  // Serial in CI: parallel workers share one dev server and one IndexedDB origin,
  // so concurrent runs would interfere with each other's storage.
  ...(isCI ? { workers: 1 } : {}),

  reporter: isCI ? [['html', { open: 'never' }], ['github']] : [['html', { open: 'never' }]],

  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    // Accessibility assertions depend on real focus, which headless Chromium
    // only reports correctly when the page is actually focused.
    video: isCI ? 'retain-on-failure' : 'off',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      // WebMCP is behind a flag; this project exercises the agent-enabled path.
      name: 'chromium-webmcp',
      use: {
        ...devices['Desktop Chrome'],
        launchOptions: {
          args: ['--enable-features=WebMachineLearning,WebMCP'],
        },
      },
    },
    {
      // 400% zoom reflow (WCAG 1.4.10) behaves like a narrow viewport.
      name: 'mobile-chrome',
      use: { ...devices['Pixel 5'] },
    },
  ],

  webServer: {
    command: 'pnpm dev',
    url: BASE_URL,
    reuseExistingServer: !isCI,
    timeout: 120_000,
  },
});
