import AxeBuilder from '@axe-core/playwright';
import { expect, test } from './fixtures';

test('works offline after the first visit', async ({ page, context }) => {
  await page.goto('/');
  // The worker precaches every built file (including lazily loaded pages) before it activates.
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await expect.poll(() => page.evaluate(() => navigator.serviceWorker.controller !== null)).toBe(true);
  expect(await page.evaluate(async () => (await caches.keys()).length)).toBeGreaterThan(0);
  await context.setOffline(true);

  await page.goto('/learn/karnaugh-maps');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Karnaugh');
  await page.goto('/lab/builder');
  await expect(page.getByRole('button', { name: 'Add NAND gate' })).toBeVisible();
  await page.goto('/exam');
  await expect(page.getByRole('button', { name: 'Start paper' })).toBeVisible();
  await context.setOffline(false);
});

// Lessons are included for their diagrams and widgets: switch circuits, the law checker, adders, latches, IC pin-outs.
const A11Y_PAGES = ['/', '/learn', '/learn/basic-gates', '/learn/switch-circuits', '/learn/boolean-laws', '/learn/karnaugh-maps', '/learn/adders', '/learn/storing-bits', '/learn/integrated-circuits', '/lab', '/lab/builder', '/lab/expression', '/lab/kmap', '/practice', '/practice/session?mode=mixed', '/exam', '/diagnostic', '/progress', '/about'];

for (const theme of ['light', 'dark'] as const) {
  test.describe(`accessibility (${theme})`, () => {
    test.use({ colorScheme: theme });
    for (const path of A11Y_PAGES) {
      test(`no serious axe violations on ${path}`, async ({ page }) => {
        await page.emulateMedia({ reducedMotion: 'reduce' });
        await page.goto(path);
        await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible();
        const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
        const serious = results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
        expect(serious.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).slice(0, 3).join(' | ')}`)).toEqual([]);
      });
    }
  });
}
