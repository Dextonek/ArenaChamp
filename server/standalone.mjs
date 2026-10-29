// The game server on its own port, serving the built pages from dist/ (run `npm run build` first):
//   node server/standalone.mjs            → http://localhost:8787/game.html
//   PORT=9000 node server/standalone.mjs
// During development `npm run dev` runs the same server inside Vite instead (see vite.config.ts).
import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { attachGameServer } from './game-server.mjs';

const PORT = Number(process.env.PORT ?? 8787);
const DIST = fileURLToPath(new URL('../dist/', import.meta.url));
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.glb': 'model/gltf-binary', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.wasm': 'application/wasm',
};

const server = createServer((req, res) => {
  const url = new URL(req.url ?? '/', 'http://x');
  const rel = normalize(decodeURIComponent(url.pathname === '/' ? '/game.html' : url.pathname)).replace(/^([/\\])+/, '');
  const file = join(DIST, rel);
  if (!file.startsWith(DIST) || !existsSync(file) || !statSync(file).isFile()) {
    res.writeHead(404).end('not found');
    return;
  }
  res.writeHead(200, { 'content-type': TYPES[/** @type {keyof typeof TYPES} */ (extname(file))] ?? 'application/octet-stream' });
  createReadStream(file).pipe(res);
});
attachGameServer(server);
server.listen(PORT, () => console.log(`[game] http://localhost:${PORT}/game.html`));
