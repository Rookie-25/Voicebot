import { defineConfig } from 'vitest/config';

export default defineConfig({
  cacheDir: '.local/cache/vitest',
  test: {
    maxWorkers: 2,
    projects: [
      { test: { name: 'unit', include: ['tests/**/*.test.ts'], environment: 'node' } },
      {
        test: {
          name: 'ui',
          include: ['apps/web/src/**/*.test.tsx'],
          environment: 'jsdom',
          setupFiles: ['apps/web/src/test-setup.ts'],
        },
      },
    ],
  },
});
