import { defineConfig, type Plugin } from 'vite';
import { resolve } from 'node:path';
import { attachGameServer } from './server/game-server.mjs';

/** Runs the duel game's WebSocket server (/ws) inside the dev and preview servers, so one command serves both. */
function gameServer(): Plugin {
  // SHOP=off in the environment: the hero shop switched off (every hero free), as on the other hosts.
  const opts = { shop: process.env.SHOP !== 'off' };
  return {
    name: 'duel-game-server',
    configureServer(server) {
      if (server.httpServer) attachGameServer(server.httpServer, opts);
    },
    configurePreviewServer(server) {
      if (server.httpServer) attachGameServer(server.httpServer, opts);
    },
  };
}

/**
 * Each build gets an id: in the code (`__BUILD__`) and in `/build.json`. After a deploy every connection drops; a page that
 * reconnects reads `/build.json`, and if it is another build it asks the player to reload (src/game/main.ts). Without this,
 * a change that left `PROTOCOL` as it was kept old tabs on the old code (user, 2026-11-12).
 */
const BUILD = new Date().toISOString().replace(/[-:]/g, '').slice(0, 15);

function buildId(): Plugin {
  return {
    name: 'build-id',
    apply: 'build',
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'build.json', source: JSON.stringify({ build: BUILD }) });
    },
  };
}

export default defineConfig(({ command }) => ({
  server: { port: 5173, strictPort: true },
  plugins: [gameServer(), buildId()],
  // 'dev' on the dev server: there is nothing to compare with.
  define: { __BUILD__: JSON.stringify(command === 'build' ? BUILD : 'dev') },
  build: {
    rollupOptions: {
      // Two apps on one runtime (src/runtime.ts): the VFX tool (src/tool/) and the duel game (src/game/).
      input: { tool: resolve(__dirname, 'index.html'), game: resolve(__dirname, 'game.html') },
    },
  },
}));
