import { defineConfig, type Plugin } from 'vite';
import { resolve } from 'node:path';
import { attachGameServer } from './server/game-server.mjs';

/** Runs the duel game's WebSocket server (/ws) inside the dev and preview servers, so one command serves both. */
function gameServer(): Plugin {
  return {
    name: 'duel-game-server',
    configureServer(server) {
      if (server.httpServer) attachGameServer(server.httpServer);
    },
    configurePreviewServer(server) {
      if (server.httpServer) attachGameServer(server.httpServer);
    },
  };
}

export default defineConfig({
  server: { port: 5173, strictPort: true },
  plugins: [gameServer()],
  build: {
    rollupOptions: {
      input: { editor: resolve(__dirname, 'index.html'), game: resolve(__dirname, 'game.html') },
    },
  },
});
