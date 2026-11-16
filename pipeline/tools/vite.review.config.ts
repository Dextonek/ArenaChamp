import { defineConfig } from 'vite';
import { resolve } from 'node:path';
import { tmpdir } from 'node:os';

/**
 * The Climb review's own dev server (docs/tower/review/): port 5196 (5191 was taken by another agent), no HMR (an edit never reloads a check in progress), its own
 * dependency cache outside the repo, so it runs beside the other dev servers. `npx vite --config pipeline/tools/vite.review.config.ts`.
 */
export default defineConfig({
  root: resolve(import.meta.dirname, '../..'),
  cacheDir: resolve(tmpdir(), 'arena-review-vite'),
  server: { port: Number(process.env.REVIEW_PORT ?? 5196), strictPort: true, hmr: false },
  define: { __BUILD__: JSON.stringify('dev') },
  logLevel: 'warn',
});
