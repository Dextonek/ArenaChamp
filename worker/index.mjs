// Arena of Kits on Cloudflare: one Worker serves the built pages (dist/, as static assets) and hands /ws to one
// Durable Object, `GameHub`, which runs the same hub as the Node server (server/hub.mjs): sessions, lobbies, the
// queue and the matches live in its memory, the accounts in its SQLite storage. Config: wrangler.jsonc.
//   npm run cf:dev     local, no Cloudflare account needed (http://localhost:8788)
//   npm run cf:deploy  publish (after `npx wrangler login`)
import { DurableObject } from 'cloudflare:workers';
import { Accounts } from '../server/accounts.mjs';
import { createHub } from '../server/hub.mjs';

export class GameHub extends DurableObject {
  /** @param {DurableObjectState} ctx @param {unknown} env */
  constructor(ctx, env) {
    super(ctx, env);
    const sql = ctx.storage.sql;
    sql.exec('CREATE TABLE IF NOT EXISTS accounts (key TEXT PRIMARY KEY, json TEXT NOT NULL)');
    // The store's small records, beside the accounts: the day the shop arrived (who is a founder) and the week's boards.
    sql.exec('CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, json TEXT NOT NULL)');
    /** @type {import('../server/accounts.mjs').AccountStore} */
    const store = {
      load: () => Object.fromEntries([...sql.exec('SELECT key, json FROM accounts')].map((r) => [r.key, JSON.parse(String(r.json))])),
      put: (key, account) => { sql.exec('INSERT OR REPLACE INTO accounts (key, json) VALUES (?, ?)', key, JSON.stringify(account)); },
      getMeta: (key) => {
        const row = [...sql.exec('SELECT json FROM meta WHERE key = ?', key)][0];
        return row ? JSON.parse(String(row.json)) : null;
      },
      putMeta: (key, value) => { sql.exec('INSERT OR REPLACE INTO meta (key, json) VALUES (?, ?)', key, JSON.stringify(value)); },
    };
    // The hero shop (pipeline/designs/hero-shop.md) is on unless the `SHOP` variable in wrangler.jsonc says "off": then every
    // hero is free as before, and obols are still earned.
    this.hub = createHub({ accounts: new Accounts(store), log: (m) => console.log(`[game] ${m}`), shop: /** @type {any} */ (env)?.SHOP !== 'off' });
  }

  /** @param {Request} request */
  async fetch(request) {
    if (request.headers.get('Upgrade') !== 'websocket') return new Response('Expected a WebSocket', { status: 426 });
    const [client, server] = Object.values(new WebSocketPair());
    server.accept();
    const conn = this.hub.connect((text) => server.send(text));
    server.addEventListener('message', (e) => { if (typeof e.data === 'string') conn.message(e.data); });
    server.addEventListener('close', () => { conn.closed(); try { server.close(); } catch { /* already closed */ } });
    server.addEventListener('error', () => conn.closed());
    return new Response(null, { status: 101, webSocket: client });
  }
}

/**
 * A clip from dist/news/ answered a piece at a time. Cloudflare's static assets answer a byte-range request with the
 * whole file, and Safari on iOS will not play a video without ranges, so the Worker cuts the piece itself (the clips
 * are under a megabyte; the whole file is read each time).
 * @param {Request} request @param {Fetcher} assets
 */
async function clip(request, assets) {
  const res = await assets.fetch(new Request(request.url, { method: 'GET' }));
  if (!res.ok) return res;
  const body = await res.arrayBuffer(), size = body.byteLength;
  const headers = new Headers(res.headers);
  headers.set('Accept-Ranges', 'bytes');
  headers.delete('Content-Length');
  headers.delete('Content-Encoding');
  const m = /^bytes=(\d*)-(\d*)$/.exec((request.headers.get('Range') ?? '').trim());
  if (!m || (m[1] === '' && m[2] === '')) {
    return new Response(request.method === 'HEAD' ? null : body, { status: 200, headers });
  }
  // "bytes=a-b", "bytes=a-" (to the end) or "bytes=-n" (the last n)
  let start = m[1] === '' ? Math.max(0, size - Number(m[2])) : Number(m[1]);
  let end = m[1] === '' || m[2] === '' ? size - 1 : Math.min(Number(m[2]), size - 1);
  if (start >= size || start > end) {
    headers.set('Content-Range', `bytes */${size}`);
    return new Response(null, { status: 416, headers });
  }
  headers.set('Content-Range', `bytes ${start}-${end}/${size}`);
  return new Response(request.method === 'HEAD' ? null : body.slice(start, end + 1), { status: 206, headers });
}

export default {
  /** @param {Request} request @param {{ HUB: DurableObjectNamespace, ASSETS: Fetcher }} env */
  async fetch(request, env) {
    const url = new URL(request.url);
    // One hub for everybody: every player has to meet in the same place for lobbies and the queue.
    if (url.pathname === '/ws') return env.HUB.get(env.HUB.idFromName('main')).fetch(request);
    // The game is the front page; the editor stays at /index.html.
    if (url.pathname === '/') return Response.redirect(new URL('/game.html', url).toString(), 302);
    if (url.pathname.startsWith('/news/') && url.pathname.endsWith('.mp4')) return clip(request, env.ASSETS);
    return env.ASSETS.fetch(request);
  },
};
