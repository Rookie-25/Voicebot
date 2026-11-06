import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  plugins: [react()],
  cacheDir: fileURLToPath(new URL('../../.local/cache/vite', import.meta.url)),
  server: { port: 5173, strictPort: true },
  build: { outDir: 'dist', sourcemap: false, chunkSizeWarningLimit: 220 },
});
