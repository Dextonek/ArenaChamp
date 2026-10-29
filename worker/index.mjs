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
    /** @type {import('../server/accounts.mjs').AccountStore} */
    const store = {
      load: () => Object.fromEntries([...sql.exec('SELECT key, json FROM accounts')].map((r) => [r.key, JSON.parse(String(r.json))])),
      put: (key, account) => { sql.exec('INSERT OR REPLACE INTO accounts (key, json) VALUES (?, ?)', key, JSON.stringify(account)); },
    };
    this.hub = createHub({ accounts: new Accounts(store), log: (m) => console.log(`[game] ${m}`) });
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

export default {
  /** @param {Request} request @param {{ HUB: DurableObjectNamespace, ASSETS: Fetcher }} env */
  async fetch(request, env) {
    const url = new URL(request.url);
    // One hub for everybody: every player has to meet in the same place for lobbies and the queue.
    if (url.pathname === '/ws') return env.HUB.get(env.HUB.idFromName('main')).fetch(request);
    // The game is the front page; the editor stays at /index.html.
    if (url.pathname === '/') return Response.redirect(new URL('/game.html', url).toString(), 302);
    return env.ASSETS.fetch(request);
  },
};
