import { expect, navigate, test } from './fixtures';

test('a lesson can be completed and progress survives a refresh', async ({ page }) => {
  await page.goto('/');
  await navigate(page, /Learn/);
  await expect(page).toHaveURL(/\/learn$/);
  await page.goto('/learn/foundations');
  await page.getByRole('button', { name: 'Mark lesson complete' }).click();
  await expect(page.getByText('Marked complete').first()).toBeVisible();

  await page.goto('/progress');
  await expect(page.getByText('1/14')).toBeVisible();
  await page.reload();
  await expect(page.getByText('1/14')).toBeVisible();
  await expect(page.getByRole('row', { name: /Thinking in 0s and 1s/ })).toContainText('lesson done');
});

test('practice: hints, then the worked solution, then the session summary', async ({ page }) => {
  await page.goto('/practice/session?mode=rapid&count=3');
  for (let i = 0; i < 3; i++) {
    await page.getByRole('button', { name: 'Check answer' }).click();
    await expect(page.getByText('Enter an answer first.')).toBeVisible();
    // Open every hint; the worked solution is offered after the last one.
    const hasHints = await page.getByRole('button', { name: /Show a hint/ }).isVisible();
    while (await page.getByRole('button', { name: /Show a hint|Next hint/ }).isVisible()) {
      await page.getByRole('button', { name: /Show a hint|Next hint/ }).click();
    }
    if (hasHints) await expect(page.getByText('Hint 1:')).toBeVisible();
    await page.getByRole('button', { name: 'Show worked solution' }).click();
    await expect(page.getByText(/^Answer:/)).toBeVisible();
    await page.getByRole('button', { name: i < 2 ? 'Next question' : 'See results' }).click();
  }
  await expect(page.getByRole('heading', { name: '0 of 3 right first time' })).toBeVisible();
  await expect(page.getByText('Solution shown').first()).toBeVisible();
  await page.goto('/progress');
  await expect(page.getByText('Answers', { exact: true }).locator('..')).toContainText('3');
});

test('settings apply immediately and persist', async ({ page }) => {
  await page.goto('/progress');
  await page.getByRole('radio', { name: 'Dark' }).check();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.getByRole('radio', { name: 'AB (no dot)' }).check();
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(page.getByRole('radio', { name: 'AB (no dot)' })).toBeChecked();
});

test('progress can be downloaded, deleted with confirmation, and imported back', async ({ page }) => {
  await page.goto('/learn/foundations');
  await page.getByRole('button', { name: 'Mark lesson complete' }).click();
  await page.goto('/progress');

  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download progress' }).click();
  const file = await download;
  expect(file.suggestedFilename()).toMatch(/^logic-gates-progress-\d{4}-\d{2}-\d{2}\.json$/);
  const path = await file.path();

  await page.getByRole('button', { name: 'Delete all progress' }).click();
  const dialog = page.getByRole('dialog', { name: 'Delete all progress?' });
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: 'Keep it' }).click();
  await expect(page.getByText('1/14')).toBeVisible();

  await page.getByRole('button', { name: 'Delete all progress' }).click();
  await dialog.getByRole('button', { name: 'Delete progress' }).click();
  await expect(page.getByText('0/14')).toBeVisible();

  await page.locator('input[type=file]').setInputFiles(path);
  await expect(page.getByText('Progress imported.')).toBeVisible();
  await expect(page.getByText('1/14')).toBeVisible();
});
