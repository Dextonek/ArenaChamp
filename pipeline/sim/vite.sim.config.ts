import { defineConfig } from 'vite';
import { resolve } from 'node:path';

/**
 * The fight simulator's own dev server (pipeline/sim/sim.py starts and stops it), port 5181: no HMR, so saving a source
 * file never reloads a fight in progress; a page takes the code as it was when the page loaded. Its own dependency
 * cache, so it runs beside the main dev server on 5173. No game server: fights are offline CPU duels.
 */
export default defineConfig({
  root: resolve(__dirname, '../..'),
  cacheDir: resolve(__dirname, '../../node_modules/.vite-sim'),
  server: { port: 5181, strictPort: true, hmr: false },
  logLevel: 'warn',
});
