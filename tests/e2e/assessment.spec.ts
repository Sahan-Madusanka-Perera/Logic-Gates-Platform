import { expect, test } from './fixtures';

test('diagnostic: answers are marked at the end and suggest a starting lesson', async ({ page }) => {
  await page.goto('/diagnostic');
  await page.getByRole('button', { name: 'Start the diagnostic' }).click();
  await expect(page.getByRole('heading', { name: 'Question 1 of 12' })).toBeVisible();
  // No hints during the diagnostic.
  await expect(page.getByRole('button', { name: /hint/i })).toHaveCount(0);

  await page.getByRole('textbox', { name: 'Your answer' }).fill('8');
  await page.getByRole('button', { name: 'Next' }).click();
  await page.getByRole('radio', { name: 'Output: 0' }).click();
  await page.getByRole('button', { name: 'Next' }).click();
  for (let i = 3; i <= 12; i++) {
    await expect(page.getByRole('heading', { name: `Question ${i} of 12` })).toBeVisible();
    await page.getByRole('button', { name: 'I don’t know yet' }).click();
  }

  await expect(page.getByRole('heading', { name: '2 of 12 correct' })).toBeVisible();
  // Foundations 1/1 is secure; basic gates 1/2 is the first gap.
  await expect(page.getByRole('heading', { name: 'Suggested start: lesson 2' })).toBeVisible();
  await expect(page.getByRole('article', { name: 'Question 3: Not answered' })).toBeVisible();

  await page.goto('/progress');
  await expect(page.getByRole('region', { name: 'Diagnostic' })).toContainText('lesson 2');
});

test('mock exam: flag, navigate, confirm in-page, then review by filter', async ({ page }) => {
  await page.goto('/exam');
  await page.getByRole('radio', { name: 'No timer' }).check();
  await page.getByRole('button', { name: 'Start paper' }).click();

  await expect(page.getByText('0 of 10 answered')).toBeVisible();
  await expect(page.getByRole('timer')).toHaveCount(0);
  await page.getByRole('button', { name: 'Flag for review' }).click();
  await expect(page.getByRole('button', { name: 'Question 1: not answered, flagged' })).toBeVisible();
  await page.getByRole('button', { name: 'Question 3: not answered' }).click();
  await expect(page.getByText('Question 3 of 10').first()).toBeVisible();

  await page.getByRole('button', { name: 'Finish paper' }).first().click();
  const dialog = page.getByRole('dialog', { name: 'Submit your paper?' });
  await expect(dialog).toContainText('10 unanswered questions will score 0.');
  await expect(dialog).toContainText('1 question is flagged');
  await dialog.getByRole('button', { name: 'Keep working' }).click();
  await expect(dialog).toBeHidden();
  await page.getByRole('button', { name: 'Finish paper' }).first().click();
  await dialog.getByRole('button', { name: 'Submit paper' }).click();

  await expect(page.getByRole('heading', { name: '0 of 10 correct (0%)' })).toBeVisible();
  await page.getByRole('button', { name: 'Flagged' }).click();
  await expect(page.getByRole('article')).toHaveCount(1);
  await page.getByRole('article').getByRole('button', { name: /worked solution/ }).click();
  await expect(page.getByRole('article').getByText(/^Answer:/)).toBeHidden();
  await page.getByRole('article').getByRole('button', { name: /worked solution/ }).click();
  await expect(page.getByRole('article').getByText(/^Answer:/)).toBeVisible();

  await page.goto('/progress');
  await expect(page.getByRole('region', { name: 'Practice papers' })).toContainText('0 of 10');
});

test('mock exam: the timer submits automatically when time runs out', async ({ page }) => {
  await page.clock.install();
  await page.goto('/exam');
  await page.getByRole('radio', { name: '15 minutes' }).check();
  await page.getByRole('button', { name: 'Start paper' }).click();
  await expect(page.getByRole('timer')).toHaveText('15:00');
  await page.clock.fastForward('10:30');
  await expect(page.getByRole('timer')).toHaveText('4:30');
  await page.clock.fastForward('04:31');
  await expect(page.getByText('Time ran out, so your paper was submitted automatically.')).toBeVisible();
  await expect(page.getByText('Time used: 15 minutes of 15 minutes.')).toBeVisible();
});

test('mock exam: an unfinished paper can be resumed after a refresh', async ({ page }) => {
  await page.goto('/exam');
  await page.getByRole('radio', { name: 'No timer' }).check();
  await page.getByRole('button', { name: 'Start paper' }).click();
  await page.getByRole('button', { name: 'Question 2: not answered' }).click();
  await page.getByRole('button', { name: 'Flag for review' }).click();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'You have an unfinished paper' })).toBeVisible();
  await page.getByRole('button', { name: 'Resume paper' }).click();
  await expect(page.getByText('Question 2 of 10').first()).toBeVisible();
  await expect(page.getByRole('button', { name: 'Question 2: not answered, flagged' })).toBeVisible();
});
