import { MODULE_IDS } from '../../src/content/curriculum';
import { expect, noHorizontalScroll, test } from './fixtures';

const ROUTES = ['/', '/learn', '/lab', '/lab/builder', '/lab/expression', '/lab/kmap', '/practice', '/practice/session?mode=rapid', '/practice/session?mode=detective', '/exam', '/diagnostic', '/progress', '/about'];

test.describe('every page loads', () => {
  for (const path of ROUTES) {
    test(`page ${path}`, async ({ page }) => {
      await page.goto(path);
      await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible();
      await noHorizontalScroll(page);
    });
  }

  test('all 14 lessons', async ({ page }) => {
    for (const id of MODULE_IDS) {
      await page.goto(`/learn/${id}`);
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      await expect(page.getByText('Mark lesson complete')).toBeVisible();
      await noHorizontalScroll(page);
    }
  });

  test('unknown pages show a helpful 404', async ({ page }) => {
    await page.goto('/no-such-page');
    await expect(page.getByRole('heading', { name: 'This page outputs 0' })).toBeVisible();
    await page.getByRole('link', { name: 'Go home' }).click();
    await expect(page).toHaveURL(/\/$/);
  });
});
