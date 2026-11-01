// End-to-end check of the game server without a browser: two socket clients register, one opens a lobby and the
// other joins it (same hero refused, then a different one), a second pair meets through the queue, and both
// matches are played to a result (best of three rounds won by reported hits, a forfeit). Also checks that hits from
// casts the server never saw and too-fast casts are dropped. Takes about 25 s (countdowns and breaks are real).
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
        setTimeout(() => reject(new Error(`timeout waiting for ${t}`)), 8000);
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
  // Alice is ready before Bob picks (two sockets have no shared order: picking first could refuse Alice as well).
  a.send({ t: 'lobby_pick', hero: 'Vesper' });
  a.send({ t: 'lobby_ready', ready: true });
  await new Promise((r) => setTimeout(r, 300));
  b.send({ t: 'lobby_pick', hero: 'Vesper' });
  b.send({ t: 'lobby_ready', ready: true });
  check((await b.next('error')).error.includes('taken'), 'same hero refused at ready');
  b.send({ t: 'lobby_pick', hero: 'Brannoc' });
  b.send({ t: 'lobby_ready', ready: true });
  const ma = await a.next('match_start'), mb = await b.next('match_start');
  check(ma.side === 0 && mb.side === 1 && ma.foe.hero === 'Brannoc' && mb.foe.hero === 'Vesper', 'lobby match starts with both heroes');

  // Round 1: loaded → countdown → moves and casts relay → hits to KO. Bob's hero says it has 740 HP (melee).
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  a.send({ t: 'match_loaded' });
  b.send({ t: 'match_loaded', maxHp: 740 });
  const f1 = await a.next('match_fight');
  check(f1.countdown === 3 && f1.round === 1, 'countdown after both loaded (round 1)');
  await b.next('match_fight');
  a.send({ t: 'move', x: 50, z: 7, yaw: 1 });
  const pm = await b.next('peer_move');
  check(Math.abs(pm.x - 11.5) < 1e-6, 'move relayed and clamped to the ring');
  a.send({ t: 'cast', id: 1, slot: 0, x: 0, z: 1, fx: 0, fz: 13, enemy: true });
  await wait(3200);
  a.send({ t: 'cast', id: 2, slot: 0, x: 0, z: 1, fx: 0, fz: 13, enemy: true });
  a.send({ t: 'cast', id: 3, slot: 0, x: 0, z: 1, fx: 0, fz: 13, enemy: true });
  await wait(900);
  a.send({ t: 'cast', id: 4, slot: 0, x: 0, z: 1, fx: 0, fz: 13, enemy: true });
  const pc = await b.next('peer_cast');
  check(pc.id === 2 && pc.enemy === true, 'cast relayed after the countdown (the early one was not)');
  check((await b.next('peer_cast')).id === 4, 'a second Q within 0.35 s is dropped');
  b.send({ t: 'dodged', id: 2 });
  check((await a.next('peer_dodged')).id === 2, 'dodge relayed');
  // Basic attacks, heals, statuses and shields (each client decides what happens to its own hero; the server caps).
  a.send({ t: 'attack', id: 10 });
  a.send({ t: 'attack', id: 11 });
  check((await b.next('peer_attack')).id === 10, 'basic attack relayed');
  b.send({ t: 'took_hit', id: 11, damage: 20 });
  b.send({ t: 'took_hit', id: 10, damage: 200, soaked: 15 });
  const ah = await a.next('peer_hit');
  check(ah.id === 10 && ah.damage === 40 && ah.soaked === 15 && ah.hp === 700, 'attack hit capped at 40 with its shield share (the attack within 0.5 s was dropped)');
  check((await b.next('hp')).hp === 700, 'victim told its HP');
  a.send({ t: 'cast', id: 12, slot: 1, x: 0, z: 0, fx: 0, fz: 0, enemy: true, yaw: 0 });
  await b.next('peer_cast');
  b.send({ t: 'took_hit', id: 12, damage: 90, soaked: 60, blocked: true });
  const bh = await a.next('peer_hit');
  check(bh.blocked === true && bh.damage === 0 && bh.hp === 700 && (await b.next('hp')).hp === 700, 'a hit the victim swallowed whole costs no HP');
  b.send({ t: 'heal', amount: 500 });
  const ph = await a.next('peer_heal');
  check(ph.amount === 40 && ph.hp === 740 && (await b.next('hp')).hp === 740, 'heal capped at the max HP and relayed');
  b.send({ t: 'status', kind: 'stun', seconds: 9, color: '#fff' });
  b.send({ t: 'status', kind: 'nap', seconds: 1 });
  const ps = await a.next('peer_status');
  check(ps.kind === 'stun' && ps.seconds === 3, 'status relayed, capped at 3 s (an unknown kind dropped)');
  b.send({ t: 'shield', amount: 999, seconds: 4 });
  check((await a.next('peer_shield')).amount === 400, 'shield relayed, capped at 400');
  // The identity layer: a cast's mods, buffs, stacks, HP costs (src/traits).
  a.send({ t: 'cast', id: 20, slot: 2, x: 0, z: 1, fx: 0, fz: 13, enemy: true, mods: { power: 9, status: { kind: 'stun', seconds: 9 }, debuff: { kind: 'nope', amount: 1, seconds: 1 } } });
  const mc = await b.next('peer_cast');
  check(mc.id === 20 && mc.mods.power === 3 && mc.mods.status.seconds === 3 && !mc.mods.debuff, 'cast mods relayed and clamped (power 3, status 3 s, unknown debuff dropped)');
  // R: one free second cast (a recast) within 4 s, then the long gap.
  a.send({ t: 'cast', id: 30, slot: 3, x: 0, z: 1, fx: 0, fz: 13, enemy: true });
  await wait(450);
  a.send({ t: 'cast', id: 31, slot: 3, x: 0, z: 1, fx: 0, fz: 13, enemy: true });
  await wait(450);
  a.send({ t: 'cast', id: 32, slot: 3, x: 0, z: 1, fx: 0, fz: 13, enemy: true });
  a.send({ t: 'cast', id: 33, slot: 0, x: 0, z: 1, fx: 0, fz: 13, enemy: true });
  const rs = [await b.next('peer_cast'), await b.next('peer_cast'), await b.next('peer_cast')].map((c) => c.id);
  check(rs.join() === '30,31,33', `one R recast allowed within 4 s, a third R dropped (${rs.join()})`);
  b.send({ t: 'buff', kind: 'armor', amount: 2, seconds: 60 });
  const pb = await a.next('peer_buff');
  check(pb.kind === 'armor' && pb.amount === 0.5 && pb.seconds === 6, 'buff relayed, capped at 50% and 6 s');
  b.send({ t: 'stacks', name: 'Toxin', n: 3 });
  check((await a.next('peer_stacks')).n === 3, 'stacks relayed');
  b.send({ t: 'spend', amount: 500 });
  const sp = await a.next('peer_spend');
  check(sp.amount === 100 && sp.hp === 640 && (await b.next('hp')).hp === 640, 'HP cost capped at 100 and relayed');
  b.send({ t: 'heal', amount: 100 });
  check((await a.next('peer_heal')).hp === 740 && (await b.next('hp')).hp === 740, 'healed back to full');
  b.send({ t: 'took_hit', id: 99, damage: 250 });
  for (let i = 0; i < 8; i++) b.send({ t: 'took_hit', id: i % 2 ? 2 : 4, damage: 100, color: '#ff3b4e' });
  const hits = [];
  for (let i = 0; i < 8; i++) hits.push(await a.next('peer_hit'));
  check(hits[0].hp === 640 && hits[7].hp === 0, 'hits relayed with server HP from 740 (the hit from an unknown cast was dropped)');
  const r1a = await a.next('round_end'), r1b = await b.next('round_end');
  check(r1a.result === 'win' && r1b.result === 'loss' && r1a.score.join() === '1,0' && r1b.score.join() === '0,1', 'KO wins round 1 (1-0)');

  // Round 2: after the break both load again; Bob wins it.
  const s2 = await a.next('round_start');
  await b.next('round_start');
  check(s2.round === 2, 'round 2 starts after the break');
  a.send({ t: 'match_loaded' });
  b.send({ t: 'match_loaded', maxHp: 740 });
  check((await b.next('match_fight')).round === 2, 'round 2 countdown');
  await a.next('match_fight');
  await wait(3200);
  b.send({ t: 'cast', id: 1, slot: 1, x: 0, z: 13, fx: 0, fz: 1, enemy: true });
  await a.next('peer_cast');
  for (let i = 0; i < 6; i++) a.send({ t: 'took_hit', id: 1, damage: 100 });
  for (let i = 0; i < 6; i++) await b.next('peer_hit');
  check((await a.next('round_end')).score.join() === '1,1', 'Bob wins round 2 (1-1)');
  await b.next('round_end');

  // Round 3 decides the match.
  await a.next('round_start'); await b.next('round_start');
  a.send({ t: 'match_loaded' });
  b.send({ t: 'match_loaded', maxHp: 740 });
  check((await a.next('match_fight')).round === 3, 'round 3 countdown');
  await b.next('match_fight');
  await wait(3200);
  a.send({ t: 'cast', id: 1, slot: 3, x: 0, z: 1, fx: 0, fz: 13, enemy: true });
  await b.next('peer_cast');
  for (let i = 0; i < 3; i++) b.send({ t: 'took_hit', id: 1, damage: 250 });
  for (let i = 0; i < 3; i++) await a.next('peer_hit');
  const ea = await a.next('match_end'), eb = await b.next('match_end');
  check(ea.result === 'win' && eb.result === 'loss' && ea.reason === 'ko' && ea.score.join() === '2,1' && eb.score.join() === '1,2', 'round 3 ends the match 2-1');
  check(ea.profile.wins === 1 && ea.profile.favourite === 'Vesper' && eb.profile.losses === 1 && eb.profile.history[0].foe === ALICE
    && ea.profile.history[0].rounds.join() === '2,1', 'stats recorded with the round score');

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
