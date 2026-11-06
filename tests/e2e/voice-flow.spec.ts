import { test, expect } from '@playwright/test';

test('dictation review -> text API -> playback/stop/replay (emulated speech and test API)', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() => {
    class Recognition {
      onresult: ((event: unknown) => void) | null = null;
      onend: (() => void) | null = null;
      start() {
        queueMicrotask(() => {
          this.onresult?.({ results: [[{ transcript: 'Tell me about yourself.' }]] });
          this.onend?.();
        });
      }
      stop() {
        this.onend?.();
      }
      abort() {}
    }
    class Utterance {
      onstart: (() => void) | null = null;
      onend: (() => void) | null = null;
      onerror: (() => void) | null = null;
      constructor(public text: string) {}
    }
    const state = window as unknown as { spoken: string; stops: number };
    state.spoken = '';
    state.stops = 0;
    Object.defineProperty(window, 'SpeechRecognition', { configurable: true, value: Recognition });
    Object.defineProperty(window, 'SpeechSynthesisUtterance', {
      configurable: true,
      value: Utterance,
    });
    Object.defineProperty(window, 'speechSynthesis', {
      configurable: true,
      value: {
        getVoices: () => [],
        addEventListener() {},
        removeEventListener() {},
        cancel() {
          state.stops++;
        },
        speak(u: Utterance) {
          state.spoken = u.text;
          u.onstart?.();
        },
      },
    });
  });
  await page.route('**/api/v1/config', (route) =>
    route.fulfill({ json: { available: true, fictional: true, provider: 'test' } }),
  );
  await page.route('**/api/v1/turn', async (route) => {
    expect(route.request().postDataJSON().question).toBe('Tell me about yourself.');
    await route.fulfill({
      json: {
        requestId: '00000000-0000-4000-8000-000000000001',
        answer: 'An approved browser test answer.',
        answerId: 'intro',
        contentVersion: 'fixture-v1',
        fictional: true,
        provider: 'test',
        grounded: true,
        context: 'test-only-context',
        followUpAvailable: false,
      },
    });
  });
  await page.goto('/');
  await expect(page.getByText('Local test provider — not live AI.')).toBeVisible();
  await page.getByText('Audio preferences & answer length').click();
  await page.getByRole('checkbox', { name: /Allow my browser/ }).check();
  await page.getByRole('button', { name: 'Start microphone' }).click();
  await expect(page.getByLabel('Your interview question')).toHaveValue('Tell me about yourself.');
  await page.getByRole('button', { name: 'Ask question', exact: true }).click();
  await expect(page.getByLabel('Interview response')).toContainText('approved browser test answer');
  await expect(page.getByText('Speaking', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Stop speech and recording' }).click();
  await page.getByRole('button', { name: 'Replay answer' }).click();
  await expect(page.getByText('Speaking', { exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: '.local/artifacts/playwright/voice-flow-390.png', fullPage: true });
});
