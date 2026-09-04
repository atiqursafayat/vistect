import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

/**
 * Keyboard and accessibility E2E suite.
 *
 * Uses `AxeBuilder`, the current `@axe-core/playwright` API. The previous
 * `injectAxe`/`checkA11y` helpers do not exist in this package (they belong to
 * `axe-playwright`), so every assertion in this file was failing to import.
 *
 * Scope note: these tests cover keyboard reachability and automated axe rules.
 * Automated checks catch roughly a third of WCAG failures, so scripted screen
 * reader passes (Phase 7, `docs/planning/08-accessibility-review.md`) remain
 * required and are recorded separately.
 */

/** Serious and critical violations block; minor ones are triaged manually. */
const BLOCKING_IMPACTS = ['serious', 'critical'] as const;

/**
 * Navigates to the app and waits until it is interactive.
 *
 * `page.goto` resolves on `load`, but React commits the tree and attaches the
 * global `keydown` listener (`App.tsx`) after that. Pressing a key in between is
 * silently dropped, which made the shortcut tests fail only under parallel
 * workers, where CPU contention widens that window. Waiting for rendered output
 * proves the commit happened, and effects flush immediately after it.
 */
async function gotoApp(page: Page): Promise<void> {
  await page.goto('/');
  await page.getByRole('heading', { level: 1, name: /vistect/i }).waitFor();
}

async function expectNoAccessibilityViolations(page: Page, context: string): Promise<void> {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .analyze();

  const blocking = results.violations.filter(
    (violation) =>
      violation.impact !== null &&
      violation.impact !== undefined &&
      (BLOCKING_IMPACTS as readonly string[]).includes(violation.impact)
  );

  // Failure message names the rule and the offending selector, so a CI failure is
  // actionable without re-running locally.
  expect(
    blocking,
    `${context}: ${blocking
      .map((v) => `${v.id} (${v.nodes.map((n) => n.target.join(' ')).join(', ')})`)
      .join('; ')}`
  ).toEqual([]);
}

test.describe('Welcome screen', () => {
  test.beforeEach(async ({ page }) => {
    await gotoApp(page);
  });

  test('is accessible and names the product', async ({ page }) => {
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Vistect');
    await expectNoAccessibilityViolations(page, 'welcome screen');
  });

  test('exposes a skip link as the first tab stop', async ({ page }) => {
    await page.keyboard.press('Tab');

    // A skip link that is not first defeats its purpose: a keyboard user has to
    // traverse the navigation it exists to bypass.
    const focused = page.locator(':focus');
    await expect(focused).toHaveText(/skip to/i);
  });
});

test.describe('Keyboard shortcuts', () => {
  test.beforeEach(async ({ page }) => {
    await gotoApp(page);
  });

  test('opens the shortcut help dialog with ?', async ({ page }) => {
    await page.keyboard.press('?');

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText(/keyboard shortcuts/i);

    await expectNoAccessibilityViolations(page, 'shortcut dialog');
  });

  test('closes the dialog with Escape and restores focus', async ({ page }) => {
    await page.keyboard.press('?');
    await expect(page.getByRole('dialog')).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toBeHidden();
  });

  const viewShortcuts: readonly { key: string; expected: RegExp }[] = [
    { key: 'u', expected: /decision/i },
    { key: 'w', expected: /warning/i },
    { key: 'a', expected: /activity/i },
    { key: 'o', expected: /object explorer/i },
    { key: 'p', expected: /privacy/i },
  ];

  for (const { key, expected } of viewShortcuts) {
    test(`Alt+${key} switches view`, async ({ page }) => {
      await page.keyboard.press(`Alt+${key}`);
      await expect(page.getByRole('main')).toContainText(expected);
    });
  }
});

test.describe('Navigator', () => {
  test('is reachable by keyboard and announces its purpose', async ({ page }) => {
    await gotoApp(page);

    const navigator = page.getByRole('region', { name: /document navigator/i });
    await expect(navigator).toBeVisible();
    await expectNoAccessibilityViolations(page, 'navigator');
  });
});

test.describe('Reduced motion and zoom', () => {
  test('respects prefers-reduced-motion', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await gotoApp(page);
    await expectNoAccessibilityViolations(page, 'reduced motion');
  });

  test('reflows at 400% zoom without horizontal scrolling', async ({ page }) => {
    // 320 × 256 CSS pixels is the 400%-zoom equivalent viewport from WCAG 1.4.10.
    await page.setViewportSize({ width: 320, height: 256 });
    await gotoApp(page);

    const overflows = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1
    );
    expect(overflows, 'page scrolls horizontally at 400% zoom').toBe(false);
  });
});
