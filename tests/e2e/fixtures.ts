import { test as base, expect, type Page } from '@playwright/test';

/** Every test fails if the page logs an error or throws. */
export const test = base.extend<{ consoleErrors: string[] }>({
  consoleErrors: [
    async ({ page }, use) => {
      const errors: string[] = [];
      page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
      page.on('console', (m) => {
        if (m.type() === 'error') errors.push(`console: ${m.text()}`);
      });
      await use(errors);
      expect(errors, 'no console errors').toEqual([]);
    },
    { auto: true },
  ],
});

export { expect };

export async function noHorizontalScroll(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow, 'page should not scroll sideways').toBeLessThanOrEqual(1);
}

/** Primary navigation is a top bar on desktop and a bottom tab bar on phones. */
export async function navigate(page: Page, name: RegExp) {
  await page.getByRole('navigation').getByRole('link', { name }).filter({ visible: true }).first().click();
}
