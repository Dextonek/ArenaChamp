import { defineConfig } from 'vite';
import { resolve } from 'node:path';

/**
 * The showpiece tool's own dev server (pipeline/tools/showpiece-shots.py starts and stops it): no HMR, so saving a source
 * file never reloads a page that is filming; a page takes the code as it was when it loaded. Its own dependency cache, so
 * several can run beside the main dev server on 5173, each on its own port.
 */
export default defineConfig({
  root: resolve(__dirname, '../..'),
  cacheDir: resolve(__dirname, '../../node_modules/.vite-showpiece'),
  server: { strictPort: true, hmr: false },
  logLevel: 'warn',
});
