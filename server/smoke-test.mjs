// End-to-end check of the game server without a browser: two socket clients register, one opens a lobby and the
// other joins it (same hero refused, then a different one), a second pair meets through the queue, and both
// matches are played to a result (best of three rounds won by reported hits, a forfeit). Also checks that hits from
// casts the server never saw and too-fast casts are dropped. Loser picks is off, so those matches offer no pick; on a
// second server with it switched on, its rules are played through as well. Takes about 60 s (countdowns, breaks and a
// pick nobody answers are real).
//   node server/smoke-test.mjs                         (its own Node server on a temporary data file)
//   node server/smoke-test.mjs ws://localhost:8787/ws  (a running server, e.g. `npm run cf:dev`; unique names per run)
import { createServer } from 'node:http';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { WebSocket } from 'ws';
import { attachGameServer } from './game-server.mjs';
import { PROTOCOL, RELOAD_TEXT } from './protocol.mjs';

const target = process.argv[2];
const dir = mkdtempSync(join(tmpdir(), 'duel-smoke-'));
const http = createServer();
const httpPicks = createServer();
let url = target;
let urlPicks = '';
if (!target) {
  /** @param {import('node:http').Server} server */
  const portOf = (server) => /** @type {import('node:net').AddressInfo} */ (server.address()).port;
  attachGameServer(http, { dataFile: join(dir, 'accounts.json'), log: () => {} });
  await new Promise((r) => http.listen(0, () => r(undefined)));
  url = `ws://localhost:${portOf(http)}/ws`;
  attachGameServer(httpPicks, { dataFile: join(dir, 'accounts-picks.json'), log: () => {}, loserPicks: true });
  await new Promise((r) => httpPicks.listen(0, () => r(undefined)));
  urlPicks = `ws://localhost:${portOf(httpPicks)}/ws`;
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

/** A test client: `next(type)` waits for the next message of that type. @param {string} [to] */
async function client(to = url) {
  const ws = new WebSocket(/** @type {string} */ (to));
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
    /** The messages that open a session carry the rules version, as src/net/client.ts sends them. @param {any} m */
    send: (m) => ws.send(JSON.stringify(['register', 'login', 'resume'].includes(m.t) ? { v: PROTOCOL, ...m } : m)),
    /** @param {string} t @param {number} [ms] @returns {Promise<any>} */
    next(t, ms = 8000) {
      const i = inbox.findIndex((m) => m.t === t);
      if (i >= 0) return Promise.resolve(inbox.splice(i, 1)[0]);
      return new Promise((resolve, reject) => {
        waiting.push({ t, resolve });
        setTimeout(() => reject(new Error(`timeout waiting for ${t}`)), ms);
      });
    },
    close: () => ws.close(),
  };
}

try {
  // The rules version: an older tab is told to reload, before any name or password is looked at.
  const old = await client();
  old.send({ t: 'login', name: 'nobody', password: 'nothing', v: PROTOCOL - 1 });
  check((await old.next('update_required')).error === RELOAD_TEXT, 'an older version is told to reload');
  old.send({ t: 'resume', token: 'x', v: undefined });
  check((await old.next('auth_error')).error === RELOAD_TEXT, 'a tab from before the check is told too, in the message it knows');
  old.close();

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
  b.send({ t: 'hazard', damage: 500, color: '#fff' });
  const hz = await a.next('peer_hit');
  check(hz.id === 0 && hz.damage === 60 && hz.hp === 680 && (await b.next('hp')).hp === 680, 'an arena hazard is capped at 60 and comes off the HP');
  b.send({ t: 'heal', amount: 60 });
  await a.next('peer_heal');
  await b.next('hp');
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

  // Loser picks is off: no pick is offered, the break is 3 s, and a pick sent anyway changes nothing.
  check(r1a.pick === null && r1b.pick === null && r1a.next === 3, 'no pick is offered, and the break is 3 s');
  b.send({ t: 'round_pick', hero: 'Lyra' });

  // Round 2: after the break both load again; Bob wins it.
  const s2 = await a.next('round_start'), s2b = await b.next('round_start');
  check(s2.round === 2, 'round 2 starts after the break');
  check(s2.you === 'Vesper' && s2.foe === 'Brannoc' && s2b.you === 'Brannoc' && s2b.foe === 'Vesper' && s2.picked === null, 'a pick sent anyway changes nothing');
  a.send({ t: 'match_loaded' });
  b.send({ t: 'match_loaded', maxHp: 740 });
  check((await b.next('match_fight')).round === 2, 'round 2 countdown');
  await a.next('match_fight');
  await wait(3200);
  b.send({ t: 'cast', id: 1, slot: 1, x: 0, z: 13, fx: 0, fz: 1, enemy: true });
  await a.next('peer_cast');
  for (let i = 0; i < 6; i++) a.send({ t: 'took_hit', id: 1, damage: 100 });
  for (let i = 0; i < 6; i++) await b.next('peer_hit');
  const r2a = await a.next('round_end'), r2b = await b.next('round_end');
  check(r2a.score.join() === '1,1' && r2b.score.join() === '1,1', 'Bob wins round 2 (1-1)');

  // Round 3 decides the match.
  await a.next('round_start');
  await b.next('round_start');
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
  check(eb.profile.history[0].hero === 'Brannoc' && !eb.profile.history[0].from, 'the match counts for the hero played, with no swap in the history');

  /** Loads a round and has `x` knock `y` out with three big hits. @param {any} x @param {any} y @param {number} round @param {string} [end] */
  const knockOut = async (x, y, round, end = 'round_end') => {
    x.send({ t: 'match_loaded' }); y.send({ t: 'match_loaded' });
    await x.next('match_fight'); await y.next('match_fight');
    await wait(3200);
    x.send({ t: 'cast', id: round, slot: 3, x: 0, z: 1, fx: 0, fz: 13, enemy: true });
    await y.next('peer_cast');
    for (let i = 0; i < 3; i++) y.send({ t: 'took_hit', id: round, damage: 250 });
    return [await x.next(end), await y.next(end)];
  };

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
  d.send({ t: 'queue_join', hero: 'Vitriol' });
  const qc = await c.next('match_start'), qd = await d.next('match_start');
  check(qc.foe.name === DAVE && qd.foe.hero === 'Lyra', 'queue pairs two different heroes');
  const [, qr] = await knockOut(c, d, 1);
  check(qr.pick === null, 'no pick in a queue match either');
  const qs = await d.next('round_start');
  await c.next('round_start');
  check(qs.you === 'Vitriol' && qs.picked === null, 'the next round follows after the break');
  d.send({ t: 'match_leave' });
  const fc = await c.next('match_end');
  check(fc.result === 'win' && fc.reason === 'forfeit', 'forfeit ends the match');

  // Loser picks switched on: the code stays working while it is off for players.
  if (!target) {
    const e = await client(urlPicks), f = await client(urlPicks);
    e.send({ t: 'register', name: 'erin', password: 'pw1234' });
    f.send({ t: 'register', name: 'finn', password: 'pw1234' });
    await e.next('session'); await f.next('session');
    /** Both join the queue with the same heroes each time. */
    const pairUp = async () => {
      e.send({ t: 'queue_join', hero: 'Vesper' });
      f.send({ t: 'queue_join', hero: 'Brannoc' });
      await e.next('match_start'); await f.next('match_start');
    };
    await pairUp();

    // The round's loser picks: Finn swaps hero. The winner can't, nor can Finn take Erin's hero, or two things at once.
    const [p1e, p1f] = await knockOut(e, f, 1);
    check(p1f.pick?.you === true && p1e.pick?.you === false && p1f.pick.seconds === 15 && p1e.next === 15, 'switched on: the round loser gets the pick, for 15 s');
    e.send({ t: 'round_pick', hero: 'Lyra' });
    f.send({ t: 'round_pick', hero: 'Vesper' });
    check((await f.next('error')).error.includes('taken'), 'a swap to the other player\'s hero is refused');
    f.send({ t: 'round_pick', hero: 'Lyra', arena: 'frost' });
    check((await f.next('error')).error.includes('Pick one'), 'a hero and an arena together are refused');
    f.send({ t: 'round_pick', hero: 'Lyra' });
    f.send({ t: 'round_pick', arena: 'frost' });
    const p2e = await e.next('round_start'), p2f = await f.next('round_start');
    check(p2e.you === 'Vesper' && p2e.foe === 'Lyra' && p2f.you === 'Lyra' && p2f.foe === 'Vesper' && p2e.picked.by === 'finn' && p2e.picked.hero === 'Lyra' && !p2e.picked.arena,
      'the swap reaches both screens; the winner\'s try and a second pick were dropped');

    // Finn wins round 2, so the second pick is Erin's: an arena, for round 3.
    const [, p3e] = await knockOut(f, e, 2);
    check(p3e.pick.you === true, 'the second pick is the other player\'s');
    f.send({ t: 'round_pick', arena: 'glade' });
    e.send({ t: 'round_pick', arena: 'frost' });
    const p4e = await e.next('round_start'), p4f = await f.next('round_start');
    check(p4e.picked.arena === 'frost' && p4f.picked.arena === 'frost' && p4e.picked.by === 'erin' && p4f.foe === 'Vesper', 'the chosen arena reaches both screens, the heroes stay');
    const [, pe] = await knockOut(e, f, 3, 'match_end');
    const hf = pe.profile.history[0];
    check(hf.hero === 'Lyra' && hf.from === 'Brannoc' && pe.profile.heroes.Lyra.played === 1 && !pe.profile.heroes.Brannoc, 'the match counts for the hero finished on, and the history shows the swap');

    // Nobody answers a pick: the next round starts as it was, when the time runs out.
    await pairUp();
    const [, u1] = await knockOut(e, f, 1);
    check(u1.pick.you === true, 'finn lost round 1 and may pick');
    const unanswered = Date.now();
    const us = await f.next('round_start', 17000);
    await e.next('round_start');
    check(Date.now() - unanswered > 14000 && us.you === 'Brannoc' && us.picked === null, 'a pick nobody answers runs out after 15 s and changes nothing');
    // "Keep" ends the wait, but the break still lasts its 3 s.
    const [, k1] = await knockOut(f, e, 2);
    check(k1.pick.you === true, 'erin lost round 2 and may pick');
    const kept = Date.now();
    e.send({ t: 'round_pick' });
    const uk = await e.next('round_start');
    await f.next('round_start');
    check(Date.now() - kept < 5000 && uk.you === 'Vesper' && uk.picked === null, 'keeping things as they are ends the wait');
    f.send({ t: 'match_leave' });
    await e.next('match_end');
    e.close(); f.close();
  }

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
httpPicks.close();
rmSync(dir, { recursive: true, force: true });
console.log(failed ? 'SMOKE TEST FAILED' : 'smoke test passed');
process.exit(failed ? 1 : 0);
