import { expect, test } from './fixtures';

test('builder: solve "NOT from NAND" with the keyboard-friendly wiring panel', async ({ page }) => {
  await page.goto('/lab/builder');
  await page.getByRole('button', { name: 'NOT from NAND' }).click();
  await page.getByRole('button', { name: 'Add NAND gate' }).click();
  await expect(page.getByRole('heading', { name: 'NAND gate G1' })).toBeVisible();

  await page.getByRole('button', { name: 'Check my circuit' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'not connected' })).toBeVisible();

  await page.getByLabel('Input 1', { exact: true }).selectOption({ label: 'input A' });
  await page.getByLabel('Input 2', { exact: true }).selectOption({ label: 'input A' });
  await page.getByRole('button', { name: 'Done' }).click();
  await page.getByRole('complementary').getByRole('button', { name: 'output F' }).click();
  await page.getByLabel('Source of output F').selectOption({ label: 'NAND gate G1' });

  await page.getByRole('button', { name: 'Check my circuit' }).click();
  await expect(page.getByText(/^Correct! Your circuit gives the right output for all 2 input combinations/)).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Truth table' })).toBeVisible();

  // Toggling the input propagates through the gate.
  await page.getByRole('switch', { name: 'Input A, currently 0' }).click();
  await expect(page.getByRole('button', { name: /^output F, value 0$/ })).toBeVisible();

  // The circuit is kept after a refresh.
  await page.reload();
  await expect(page.getByRole('button', { name: /^NAND gate G1, 2 inputs/ })).toBeVisible();
});

test('builder: wire by tapping pins, then undo and redo', async ({ page }) => {
  await page.goto('/lab/builder');
  await page.getByRole('button', { name: 'Clear' }).click();
  await page.getByRole('button', { name: 'Add NOT gate' }).click();
  await page.getByRole('button', { name: 'Done' }).click();
  // Port order on the canvas: A out, B out, F in, then the gate's out and in.
  const ports = page.locator('svg g.cursor-crosshair');
  await expect(ports).toHaveCount(5);
  await ports.nth(0).click();
  await ports.nth(4).click();
  await ports.nth(3).click();
  await ports.nth(2).click();
  await expect(page.getByText('Output F is not connected')).toHaveCount(0);
  await expect(page.getByText(/^F = /)).toBeVisible();

  await page.getByRole('button', { name: 'Undo' }).click();
  await expect(page.getByText('Output F is not connected to any gate or input.')).toBeVisible();
  await page.getByRole('button', { name: 'Redo' }).click();
  await expect(page.getByText('Output F is not connected to any gate or input.')).toHaveCount(0);
});

test('expression lab: table, forms and equivalence come from one engine', async ({ page }) => {
  await page.goto('/lab/expression');
  const input = page.getByRole('textbox', { name: 'Expression' });
  await input.fill("A.B + A.B'");
  await page.getByRole('button', { name: 'SOP and POS' }).click();
  await expect(page.getByText('Σm(2, 3)')).toBeVisible();
  await page.getByRole('button', { name: 'Compare' }).click();
  await page.getByRole('textbox', { name: 'Compare with' }).fill('A');
  await expect(page.getByText('Equivalent: the outputs match for every input combination.')).toBeVisible();
  await page.getByRole('textbox', { name: 'Compare with' }).fill('B');
  await expect(page.getByText(/Not equivalent\. When A = 0, B = 1/)).toBeVisible();
});

test('K-map lab: fill from an expression and reveal the simplest form on request', async ({ page }) => {
  await page.goto('/lab/kmap');
  await page.getByRole('radio', { name: /^2 / }).click();
  await page.getByRole('textbox', { name: 'Fill the map from an expression' }).fill("A.B' + A.B");
  await page.getByRole('button', { name: 'Fill the map' }).click();
  await expect(page.getByText('The map has 2 cells with 1 and 2 with 0.')).toBeVisible();
  await expect(page.getByText('SOP:')).toHaveCount(0);
  await page.getByRole('button', { name: 'Show the simplest SOP and POS' }).click();
  await expect(page.getByText('SOP:')).toBeVisible();
});

test('expression lab: B.1 is not "already simplest" — the Identity law finishes it', async ({ page }) => {
  await page.goto('/lab/expression');
  await page.getByRole('textbox', { name: 'Expression' }).fill('B.1');
  await page.getByRole('button', { name: 'Simplify with laws' }).click();
  await expect(page.getByText(/already fully simplified/)).toHaveCount(0);
  await expect(page.getByRole('status').filter({ hasText: 'Nearly there.' })).toContainText('can still be simplified with the Identity law');

  await page.getByRole('textbox', { name: 'Next line' }).fill('B');
  await page.getByLabel('Law used').selectOption('Identity law');
  await page.getByRole('button', { name: 'Check this step' }).click();
  await expect(page.getByText(/Fully simplified: 1 variable occurrence/)).toBeVisible();

  await page.getByRole('textbox', { name: 'Expression' }).fill('B');
  await expect(page.getByText(/already fully simplified/)).toBeVisible();
});

test('simplify with laws: the law named is checked, and a jump straight to the answer is not accepted', async ({ page }) => {
  await page.goto('/lab/expression');
  await page.getByRole('textbox', { name: 'Expression' }).fill("A.B + A.B'");
  await page.getByRole('button', { name: 'Simplify with laws' }).click();
  const next = page.getByRole('textbox', { name: 'Next line' });
  const law = page.getByLabel('Law used');
  const check = page.getByRole('button', { name: 'Check this step' });

  // The right answer in one jump uses more than one law.
  await next.fill('A');
  await law.selectOption('Identity law');
  await check.click();
  await expect(page.getByRole('alert')).toContainText('no single law turns the previous line into this one');

  // A real step with the wrong law names the right one, and keeps what was typed.
  await next.fill("A.(B + B')");
  await law.selectOption('Complement law');
  await check.click();
  await expect(page.getByRole('alert')).toContainText('this step uses the Distributive law, not the Complement law');
  await expect(next).toHaveValue("A.(B + B')");

  await law.selectOption('Distributive law');
  await check.click();
  await expect(page.getByRole('alert')).toHaveCount(0);
  await expect(page.getByText('(Distributive law)')).toBeVisible();

  for (const [line, name] of [
    ['A.1', 'Complement law'],
    ['A', 'Identity law'],
  ] as const) {
    await next.fill(line);
    await law.selectOption(name);
    await check.click();
  }
  await expect(page.getByText(/Fully simplified: 1 variable occurrence/)).toBeVisible();
});
