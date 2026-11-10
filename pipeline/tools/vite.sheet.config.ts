import { defineConfig } from 'vite';
import { resolve } from 'node:path';

/**
 * A second dev server for model sheets (pipeline/tools/hero-sheet.html), port 5175: no HMR, so saving a kit or any other source
 * file never reloads a render in progress. Its own dependency cache, so it can run beside the main dev server on 5173.
 *   npx vite --config pipeline/tools/vite.sheet.config.ts   (or the "sheet-dev" entry in .claude/launch.json)
 */
export default defineConfig({
  root: resolve(__dirname, '../..'),
  cacheDir: resolve(__dirname, '../../node_modules/.vite-sheet'),
  server: { port: 5175, strictPort: true, hmr: false },
});
