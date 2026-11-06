import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  outputDir: '.local/artifacts/playwright/results',
  reporter: [
    ['list'],
    ['html', { outputFolder: '.local/artifacts/playwright/report', open: 'never' }],
  ],
  use: {
    baseURL: 'http://127.0.0.1:5173',
    ...(process.platform === 'win32' ? { channel: 'msedge' } : {}),
    headless: true,
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'npm run dev --workspace @voice-bot/web',
    url: 'http://127.0.0.1:5173',
    reuseExistingServer: false,
  },
});
