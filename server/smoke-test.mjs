// End-to-end check of the game server without a browser: two socket clients register, one opens a lobby and the
// other joins it (same hero refused, then a different one), a second pair meets through the queue, and both
// matches are played to a result (a KO by reported hits, a forfeit). Exits non-zero on the first failed check.
//   node server/smoke-test.mjs                         (its own Node server on a temporary data file)
//   node server/smoke-test.mjs ws://localhost:8787/ws  (a running server, e.g. `npm run cf:dev`; unique names per run)
import { createServer } from 'node:http';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { WebSocket } from 'ws';
import { attachGameServer } from './game-server.mjs';

const target = process.argv[2];
const dir = mkdtempSync(join(tmpdir(), 'duel-smoke-'));
const http = createServer();
let url = target;
if (!target) {
  attachGameServer(http, { dataFile: join(dir, 'accounts.json'), log: () => {} });
  await new Promise((r) => http.listen(0, () => r(undefined)));
  url = `ws://localhost:${/** @type {import('node:net').AddressInfo} */ (http.address()).port}/ws`;
}
// Against a server with saved accounts the names must be new each run.
const tag = target ? `_${Math.random().toString(36).slice(2, 6)}` : '';
const [ALICE, BOB, CAROL, DAVE] = ['alice', 'bob', 'carol', 'dave'].map((n) => n + tag);
let failed = false;

/** @param {boolean} ok @param {string} what */
function check(ok, what) {
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}`);
  if (!ok) failed = true;
}

/** A test client: `next(type)` waits for the next message of that type. */
async function client() {
  const ws = new WebSocket(/** @type {string} */ (url));
  /** @type {any[]} */
  const inbox = [];
  /** @type {{ t: string, resolve: (m: any) => void }[]} */
  const waiting = [];
  ws.on('message', (d) => {
    const m = JSON.parse(String(d));
    const w = waiting.findIndex((x) => x.t === m.t);
    if (w >= 0) waiting.splice(w, 1)[0].resolve(m);
    else inbox.push(m);
  });
  await new Promise((r) => ws.on('open', r));
  return {
    /** @param {any} m */
    send: (m) => ws.send(JSON.stringify(m)),
    /** @param {string} t @returns {Promise<any>} */
    next(t) {
      const i = inbox.findIndex((m) => m.t === t);
      if (i >= 0) return Promise.resolve(inbox.splice(i, 1)[0]);
      return new Promise((resolve, reject) => {
        waiting.push({ t, resolve });
        setTimeout(() => reject(new Error(`timeout waiting for ${t}`)), 6000);
      });
    },
    close: () => ws.close(),
  };
}

try {
  // Accounts.
  const a = await client(), b = await client();
  a.send({ t: 'register', name: ALICE, password: 'pw1234' });
  const sa = await a.next('session');
  check(!!sa.token && sa.profile.name === ALICE, 'register alice');
  b.send({ t: 'register', name: ALICE, password: 'x1234' });
  check((await b.next('auth_error')).error.includes('taken'), 'duplicate name refused');
  b.send({ t: 'register', name: BOB, password: 'pw1234' });
  check((await b.next('session')).profile.matches === 0, 'register bob');
  const c2 = await client();
  c2.send({ t: 'login', name: BOB, password: 'nope' });
  check(!!(await c2.next('auth_error')).error, 'wrong password refused');
  c2.close();

  // Lobby: alice creates, bob joins by code; the same hero cannot ready twice.
  a.send({ t: 'lobby_create' });
  const la = await a.next('lobby');
  check(/^[A-Z]{4}$/.test(la.lobby.code), `lobby created (${la.lobby.code})`);
  b.send({ t: 'lobby_join', code: la.lobby.code.toLowerCase() });
  check((await b.next('lobby')).lobby.seats.length === 2, 'bob joined by code');
  a.send({ t: 'lobby_pick', hero: 'Vesper' });
  b.send({ t: 'lobby_pick', hero: 'Vesper' });
  a.send({ t: 'lobby_ready', ready: true });
  await new Promise((r) => setTimeout(r, 100));
  b.send({ t: 'lobby_ready', ready: true });
  check((await b.next('error')).error.includes('taken'), 'same hero refused at ready');
  b.send({ t: 'lobby_pick', hero: 'Brannoc' });
  b.send({ t: 'lobby_ready', ready: true });
  const ma = await a.next('match_start'), mb = await b.next('match_start');
  check(ma.side === 0 && mb.side === 1 && ma.foe.hero === 'Brannoc' && mb.foe.hero === 'Vesper', 'lobby match starts with both heroes');

  // Fight: loaded → countdown → moves and casts relay → hits to KO.
  a.send({ t: 'match_loaded' });
  b.send({ t: 'match_loaded' });
  check((await a.next('match_fight')).countdown === 3, 'countdown after both loaded');
  await b.next('match_fight');
  a.send({ t: 'move', x: 50, z: 7, yaw: 1 });
  const pm = await b.next('peer_move');
  check(Math.abs(pm.x - 11.5) < 1e-6, 'move relayed and clamped to the ring');
  a.send({ t: 'cast', id: 1, slot: 0, x: 0, z: 1, fx: 0, fz: 13, enemy: true });
  await new Promise((r) => setTimeout(r, 3200));
  a.send({ t: 'cast', id: 2, slot: 0, x: 0, z: 1, fx: 0, fz: 13, enemy: true });
  const pc = await b.next('peer_cast');
  check(pc.id === 2 && pc.enemy === true, 'cast relayed after the countdown (the early one was not)');
  b.send({ t: 'dodged', id: 2 });
  check((await a.next('peer_dodged')).id === 2, 'dodge relayed');
  for (let i = 0; i < 6; i++) b.send({ t: 'took_hit', id: 3, damage: 100, color: '#ff3b4e' });
  const hits = [];
  for (let i = 0; i < 6; i++) hits.push(await a.next('peer_hit'));
  check(hits[5].hp === 0 && hits[0].hp === 500, 'hits relayed with server HP');
  const ea = await a.next('match_end'), eb = await b.next('match_end');
  check(ea.result === 'win' && eb.result === 'loss' && ea.reason === 'ko', 'KO ends the match');
  check(ea.profile.wins === 1 && ea.profile.favourite === 'Vesper' && eb.profile.losses === 1 && eb.profile.history[0].foe === ALICE, 'stats recorded');

  // Queue: carol and dave meet through matchmaking; same hero waits.
  const c = await client(), d = await client();
  c.send({ t: 'register', name: CAROL, password: 'pw1234' });
  d.send({ t: 'register', name: DAVE, password: 'pw1234' });
  await c.next('session'); await d.next('session');
  c.send({ t: 'queue_join', hero: 'Lyra' });
  check((await c.next('queue')).on === true, 'carol queued');
  d.send({ t: 'queue_join', hero: 'Lyra' });
  await d.next('queue');
  await new Promise((r) => setTimeout(r, 150));
  d.send({ t: 'queue_leave' });
  await d.next('queue');
  d.send({ t: 'queue_join', hero: 'Vex' });
  const qc = await c.next('match_start'), qd = await d.next('match_start');
  check(qc.foe.name === DAVE && qd.foe.hero === 'Lyra', 'queue pairs two different heroes');
  d.send({ t: 'match_leave' });
  const fc = await c.next('match_end');
  check(fc.result === 'win' && fc.reason === 'forfeit', 'forfeit ends the match');

  // Session resume with the token (a reload in the same tab).
  const a2 = await client();
  a2.send({ t: 'resume', token: sa.token });
  check((await a2.next('session')).profile.wins === 1, 'token resumes the session');
  check((await a.next('logged_out')).reason.includes('another tab'), 'the older connection is signed out');
  for (const x of [a, a2, b, c, d]) x.close();
} catch (e) {
  check(false, String(e));
}
http.close();
rmSync(dir, { recursive: true, force: true });
console.log(failed ? 'SMOKE TEST FAILED' : 'smoke test passed');
process.exit(failed ? 1 : 0);
