import { defineConfig, devices } from '@playwright/test';

/**
 * Two specs, one browser (implementation-plan.md §9).
 *
 * WebMCP is behind a Blink flag and only exists in real Chrome, so the E2E
 * project uses `channel: 'chrome'` with the flag on. This is deliberate: the
 * registration boundary is never mocked. v1's WebMCP layer stayed green against
 * a mock of an object that does not exist.
 */
export const WEBMCP_CHROME_ARGS = ['--enable-blink-features=WebMCP'];

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : [['list']],
  timeout: 60_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chrome-webmcp',
      use: {
        ...devices['Desktop Chrome'],
        channel: 'chrome',
        launchOptions: { args: WEBMCP_CHROME_ARGS },
      },
    },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
