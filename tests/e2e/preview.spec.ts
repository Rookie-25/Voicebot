import { test, expect } from '@playwright/test';

for (const viewport of [
  { width: 1440, height: 1100 },
  { width: 390, height: 844 },
  { width: 320, height: 800 },
]) {
  test(`responsive preview and conversation at ${viewport.width}px`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
    await page.getByLabel('Your interview question').fill('Tell me about yourself.');
    await page.getByRole('button', { name: 'Ask question', exact: true }).click();
    await expect(page.getByLabel('Demo response', { exact: true })).toBeVisible();
    await expect(page.getByLabel('Demo response', { exact: true })).toContainText(
      'candidate-approved',
    );
    await page.getByRole('button', { name: 'Reset conversation' }).click();
    await expect(page.getByLabel('Demo response', { exact: true })).toHaveCount(0);
    // Capture the pristine screen at scroll position zero, rather than retaining
    // the reset button's focus-induced scroll in a full-page mobile screenshot.
    await page.goto('/');
    await page.screenshot({
      path: `.local/artifacts/playwright/preview-${viewport.width}.png`,
      fullPage: true,
    });
  });
}

test('keyboard, cancellation, reduced motion, and microphone disclosure', async ({ page }) => {
  const unexpectedRequests: string[] = [];
  page.on('request', (request) => {
    if (!request.url().startsWith('http://127.0.0.1:5173')) unexpectedRequests.push(request.url());
  });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: 'Skip to question' })).toBeFocused();
  await page.getByRole('button', { name: /Microphone preview/ }).click();
  await expect(page.getByText(/Microphone recording is unavailable/)).toBeVisible();
  await page.getByLabel('Your interview question').fill('A challenge?');
  await page.keyboard.press('Enter');
  await expect(page.getByRole('button', { name: 'Stop demo response' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByText(/Response stopped. Ask another/)).toBeVisible();
  await page.waitForTimeout(1200);
  await expect(page.getByLabel('Demo response', { exact: true })).toHaveCount(0);
  expect(unexpectedRequests).toEqual([]);
});
