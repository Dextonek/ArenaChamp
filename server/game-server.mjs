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
 * Accounts in one JSON file. Several servers may share it (two dev ports, the standalone server): every write
 * re-reads the file and replaces only the account that changed.
 * @param {string} file @returns {import('./accounts.mjs').AccountStore}
 */
export function fileStore(file) {
  const read = () => {
    if (!existsSync(file)) return {};
    try { return JSON.parse(readFileSync(file, 'utf8')).users ?? {}; }
    catch (e) { console.error(`[game] could not read ${file}`, e); return {}; }
  };
  return {
    load: read,
    put(key, account) {
      const users = read();
      users[key] = account;
      mkdirSync(dirname(file), { recursive: true });
      const tmp = `${file}.tmp`;
      writeFileSync(tmp, JSON.stringify({ users }, null, 2));
      renameSync(tmp, file);
    },
  };
}

/**
 * @param {import('node:http').Server} httpServer
 * @param {{ path?: string, dataFile?: string, log?: (msg: string) => void }} [opts]
 */
export function attachGameServer(httpServer, opts = {}) {
  const path = opts.path ?? '/ws';
  const accounts = new Accounts(fileStore(opts.dataFile ?? fileURLToPath(new URL('./data/accounts.json', import.meta.url))));
  const hub = createHub({ accounts, log: opts.log });
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

  return { wss, state: hub.state };
}
