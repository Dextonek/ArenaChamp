// The game server on its own port, serving the built pages from dist/ (run `npm run build` first):
//   node server/standalone.mjs            → http://localhost:8787/game.html
//   PORT=9000 node server/standalone.mjs
//   SHOP=off node server/standalone.mjs   → the hero shop switched off
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
  '.glb': 'model/gltf-binary', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.wasm': 'application/wasm', '.mp4': 'video/mp4',
};

const server = createServer((req, res) => {
  const url = new URL(req.url ?? '/', 'http://x');
  const rel = normalize(decodeURIComponent(url.pathname === '/' ? '/game.html' : url.pathname)).replace(/^([/\\])+/, '');
  const file = join(DIST, rel);
  if (!file.startsWith(DIST) || !existsSync(file) || !statSync(file).isFile()) {
    res.writeHead(404).end('not found');
    return;
  }
  const type = TYPES[/** @type {keyof typeof TYPES} */ (extname(file))] ?? 'application/octet-stream';
  // A byte range (Safari on iOS asks for one before it plays a video): "bytes=a-b", "bytes=a-" or "bytes=-n".
  const size = statSync(file).size, m = /^bytes=(\d*)-(\d*)$/.exec(String(req.headers.range ?? '').trim());
  if (m && (m[1] !== '' || m[2] !== '')) {
    const start = m[1] === '' ? Math.max(0, size - Number(m[2])) : Number(m[1]);
    const end = m[1] === '' || m[2] === '' ? size - 1 : Math.min(Number(m[2]), size - 1);
    if (start >= size || start > end) {
      res.writeHead(416, { 'content-range': `bytes */${size}` }).end();
      return;
    }
    res.writeHead(206, { 'content-type': type, 'accept-ranges': 'bytes', 'content-range': `bytes ${start}-${end}/${size}`, 'content-length': end - start + 1 });
    createReadStream(file, { start, end }).pipe(res);
    return;
  }
  res.writeHead(200, { 'content-type': type, 'accept-ranges': 'bytes', 'content-length': size });
  createReadStream(file).pipe(res);
});
// SHOP=off: every hero is free as before the hero shop (pipeline/designs/hero-shop.md).
attachGameServer(server, { shop: process.env.SHOP !== 'off' });
server.listen(PORT, () => console.log(`[game] http://localhost:${PORT}/game.html`));
