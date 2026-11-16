import { defineConfig } from 'vite';
import { resolve } from 'node:path';

/**
 * The fight prints' own dev server (pipeline/tools/hero-prints.py starts and stops it), port 5191: no hot reload, so saving a
 * source file never reloads a fight in progress, and its own dependency cache, so it runs beside the main dev server (5173),
 * the simulator's (5181) and the performance tool's (5183).
 */
export default defineConfig({
  root: resolve(__dirname, '../..'),
  cacheDir: resolve(__dirname, '../../node_modules/.vite-prints'),
  server: { port: 5191, strictPort: true, hmr: false },
  logLevel: 'warn',
});
