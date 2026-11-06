import { test, expect } from '@playwright/test';

test('typed browser turn and follow-up use real local MCP/D1', async ({ page }) => {
  test.skip(process.env.RUN_LOCAL_INTERVIEW !== '1', 'Requires isolated local Workers.');
  // No API interception: the explicitly local test selector still uses real MCP and D1.
  await page.goto('/');
  await expect(page.getByText('Local test provider — not live AI.')).toBeVisible();
  await page.getByRole('button', { name: 'Prefer audio responses when available' }).click();
  await page.getByLabel('Your interview question').fill('Tell me about yourself.');
  await page.getByRole('button', { name: 'Ask question', exact: true }).click();
  await expect(page.getByLabel('Interview response', { exact: true })).toContainText(
    'SYNTHETIC FIXTURE: I am Alex',
  );
  await page.getByText('Audio preferences & answer length').click();
  await page.getByRole('combobox', { name: /^Answer length/ }).selectOption('standard');
  await page.getByLabel('Your interview question').fill('Tell me more.');
  await page.getByRole('button', { name: 'Ask question', exact: true }).click();
  await expect(page.getByLabel('Interview response', { exact: true }).last()).toContainText(
    'SYNTHETIC FIXTURE: this is a fictional follow-up answer.',
  );
  await page.screenshot({
    path: '.local/artifacts/playwright/local-interview.png',
    fullPage: true,
  });
});
