import { test, expect } from '@playwright/test';
import { injectAxe, checkA11y } from '@axe-core/playwright';

test.describe('Keyboard Navigation & Accessibility', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await injectAxe(page);
  });

  test('welcome screen accessible', async ({ page }) => {
    await checkA11y(page);
    await expect(page.locator('h1')).toContainText('Welcome to Vistect');
  });

  test('create new project', async ({ page }) => {
    await page.click('button:has-text("New Project")');
    await expect(page.locator('[aria-label="Intent contract editor"]')).toBeVisible();
    await checkA11y(page);
  });

  test('navigator keyboard navigation', async ({ page }) => {
    await page.click('button:has-text("New Project")');
    await page.fill('textarea[id="purpose"]', 'Test document purpose for accessibility testing');
    await page.fill('textarea[id="audience"]', 'Test audience');
    await page.fill('textarea[id="primary-message"]', 'Primary test message');
    await page.click('button:has-text("Save")');

    // Wait for editor to load
    await expect(page.locator('[aria-label="Document editor"]')).toBeVisible();

    // Test navigator shortcut
    await page.keyboard.press('Alt+N');
    await expect(page.locator('[aria-label="Document navigator"]')).toBeFocused();

    // Test page creation
    await page.keyboard.press('Tab'); // Focus page tabs
    await page.keyboard.press('Enter'); // Create new page
    await checkA11y(page);
  });

  test('object explorer keyboard navigation', async ({ page }) => {
    await page.keyboard.press('Alt+O');
    await expect(page.locator('[aria-label="Object explorer"]')).toBeFocused();
    await checkA11y(page);
  });

  test('decision queue keyboard navigation', async ({ page }) => {
    await page.keyboard.press('Alt+U');
    await expect(page.locator('[aria-label="Decision queue"]')).toBeFocused();
    await checkA11y(page);
  });

  test('warning queue keyboard navigation', async ({ page }) => {
    await page.keyboard.press('Alt+W');
    await expect(page.locator('[aria-label="Warning queue"]')).toBeFocused();
    await checkA11y(page);
  });

  test('activity stream keyboard navigation', async ({ page }) => {
    await page.keyboard.press('Alt+A');
    await expect(page.locator('[aria-label="Agent activity stream"]')).toBeFocused();
    await checkA11y(page);
  });

  test('privacy center keyboard navigation', async ({ page }) => {
    await page.keyboard.press('Alt+P');
    await expect(page.locator('[aria-label="Privacy center"]')).toBeFocused();
    await checkA11y(page);
  });

  test('shortcut help dialog', async ({ page }) => {
    await page.keyboard.press('?');
    await expect(page.locator('[aria-label="Keyboard Shortcuts"]')).toBeVisible();
    await checkA11y(page);
    await page.keyboard.press('Escape');
    await expect(page.locator('[aria-label="Keyboard Shortcuts"]')).toBeHidden();
  });

  test('focus management', async ({ page }) => {
    // Create project
    await page.click('button:has-text("New Project")');
    await page.fill('textarea[id="purpose"]', 'Focus test purpose for this document');
    await page.fill('textarea[id="audience"]', 'Test audience');
    await page.fill('textarea[id="primary-message"]', 'Focus test message');
    await page.click('button:has-text("Save")');

    // Navigate to editor
    await expect(page.locator('[aria-label="Document editor"]')).toBeVisible();

    // Open object explorer
    await page.keyboard.press('Alt+O');
    await expect(page.locator('[aria-label="Object explorer"]')).toBeFocused();

    // Close with Escape
    await page.keyboard.press('Escape');
    // Focus should return to editor
    await expect(page.locator('[aria-label="Document editor"]')).toBeFocused();
  });

  test('live region announcements', async ({ page }) => {
    // Check live regions exist
    await expect(page.locator('#live-polite')).toBeAttached();
    await expect(page.locator('#live-assertive')).toBeAttached();
    await expect(page.locator('#live-polite')).toHaveAttribute('aria-live', 'polite');
    await expect(page.locator('#live-assertive')).toHaveAttribute('aria-live', 'assertive');
  });

  test('skip links', async ({ page }) => {
    await page.keyboard.press('Tab');
    await expect(page.locator('.skip-link:focus')).toBeVisible();
    await expect(page.locator('.skip-link:focus')).toContainText('Skip to navigator');
  });
});

test.describe('WebMCP Integration', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('WebMCP capability detection', async ({ page }) => {
    // Check if WebMCP is available (in CI with flags, it might not be)
    const hasWebMCP = await page.evaluate(() => 'modelContext' in navigator);
    // Test that app gracefully degrades
    if (!hasWebMCP) {
      await expect(page.locator('text=WebMCP agent capability unavailable')).toBeVisible();
    }
  });

  test('create_project tool registration', async ({ page }) => {
    const hasWebMCP = await page.evaluate(() => 'modelContext' in navigator);
    if (!hasWebMCP) {
      test.skip();
    }

    // Check tool registration
    const tools = await page.evaluate(async () => {
      const ctx = navigator.modelContext;
      await ctx.registerTool({
        name: 'test_tool',
        description: 'Test tool',
        inputSchema: { type: 'object', properties: {}, additionalProperties: false },
        execute: () => 'ok',
      });
      return ctx.getTools();
    });

    expect(tools.some((t: any) => t.name === 'create_project')).toBeTruthy();
  });
});