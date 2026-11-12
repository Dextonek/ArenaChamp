// The duel game's server on Node: the hub (hub.mjs) behind a `ws` WebSocket endpoint (default /ws) on any http
// server, with accounts in a JSON file. The Vite dev server attaches it through the plugin in vite.config.ts, and
// `node server/standalone.mjs` runs it on its own port. On Cloudflare the same hub runs in a Durable Object
// (worker/index.mjs).
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocketServer } from 'ws';
import { Accounts } from './accounts.mjs';
import { createHub } from './hub.mjs';

/**
 * Accounts in one JSON file: `{ users, meta }`. `meta` holds the store's small records (the day the shop arrived, the week's
 * boards). Several servers may share the file (two dev ports, the standalone server): every write re-reads it and replaces
 * only the account or the record that changed.
 * @param {string} file @returns {import('./accounts.mjs').AccountStore}
 */
export function fileStore(file) {
  /** @returns {{ users?: Record<string, any>, meta?: Record<string, any> }} */
  const read = () => {
    if (!existsSync(file)) return {};
    try { return JSON.parse(readFileSync(file, 'utf8')) ?? {}; }
    catch (e) { console.error(`[game] could not read ${file}`, e); return {}; }
  };
  /** @param {{ users?: Record<string, any>, meta?: Record<string, any> }} data */
  const write = (data) => {
    mkdirSync(dirname(file), { recursive: true });
    const tmp = `${file}.tmp`;
    writeFileSync(tmp, JSON.stringify({ users: data.users ?? {}, meta: data.meta }, null, 2));
    renameSync(tmp, file);
  };
  return {
    load: () => read().users ?? {},
    put(key, account) {
      const data = read();
      (data.users ??= {})[key] = account;
      write(data);
    },
    getMeta: (key) => read().meta?.[key] ?? null,
    putMeta(key, value) {
      const data = read();
      (data.meta ??= {})[key] = value;
      write(data);
    },
  };
}

/**
 * @param {import('node:http').Server} httpServer
 * @param {{ path?: string, dataFile?: string, log?: (msg: string) => void, loserPicks?: boolean, shop?: boolean, now?: () => number }} [opts]
 *   `shop`: heroes are locked behind the shop (on unless `false`). `now`: the hub's clock for days and weeks, for tests.
 */
export function attachGameServer(httpServer, opts = {}) {
  const path = opts.path ?? '/ws';
  const accounts = new Accounts(fileStore(opts.dataFile ?? fileURLToPath(new URL('./data/accounts.json', import.meta.url))));
  const hub = createHub({ accounts, log: opts.log, loserPicks: opts.loserPicks, shop: opts.shop, now: opts.now });
  const wss = new WebSocketServer({ noServer: true });

  // Only our path: Vite's HMR socket shares the same http server and handles its own upgrades.
  httpServer.on('upgrade', (req, socket, head) => {
    const url = new URL(req.url ?? '/', 'http://x');
    if (url.pathname !== path) return;
    wss.handleUpgrade(req, socket, head, (ws) => wss.emit('connection', ws, req));
  });

  wss.on('connection', (ws) => {
    const conn = hub.connect((text) => { if (ws.readyState === 1) ws.send(text); });
    ws.on('message', (data) => conn.message(String(data)));
    ws.on('close', () => conn.closed());
  });

  return { wss, state: hub.state, accounts };
}
