// End-to-end check of the game server without a browser: two socket clients register, one opens a lobby and the
// other joins it (same hero refused, then a different one), a second pair meets through the queue, and both
// matches are played to a result (best of three rounds won by reported hits, a forfeit). Also checks that hits from
// casts the server never saw and too-fast casts are dropped. Loser picks is off, so those matches offer no pick; on a
// second server with it switched on, its rules are played through as well. Then a raid for a party of twelve (an open
// room, the band, batched walks, the brain's watchdog, leavers) and a load check with forty. Takes about 150 s
// (countdowns, breaks and a pick nobody answers are real).
//   node server/smoke-test.mjs                         (its own Node server on a temporary data file)
//   node server/smoke-test.mjs ws://localhost:8787/ws  (a running server, e.g. `npm run cf:dev`; unique names per run)
import { createServer } from 'node:http';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { WebSocket } from 'ws';
import { attachGameServer } from './game-server.mjs';
import { PROTOCOL, RAID_BOSSES, RAID_PARTY_MAX, RAID_REWARDS, RELOAD_TEXT, raidBand, raidHp, raidStaggerMax } from './protocol.mjs';

/** The bosses' HP for two, as the hub keeps it. */
const SUN = RAID_BOSSES.sun.hp.duo, ASH = RAID_BOSSES.ash.hp.duo, HEART = RAID_BOSSES.heart.hp.duo;

const target = process.argv[2];
const dir = mkdtempSync(join(tmpdir(), 'duel-smoke-'));
const http = createServer();
const httpPicks = createServer();
let url = target;
let urlPicks = '';
/** What the hub wrote to its log (its own server only): the party test reads the brain's moves from it. @type {string[]} */
const hubLog = [];
if (!target) {
  /** @param {import('node:http').Server} server */
  const portOf = (server) => /** @type {import('node:net').AddressInfo} */ (server.address()).port;
  attachGameServer(http, { dataFile: join(dir, 'accounts.json'), log: (m) => { hubLog.push(m); } });
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
  /** How many messages of each type came in, read or not. @type {Record<string, number>} */
  const got = {};
  /** @type {{ tap: ((m: any, size: number) => void) | null }} */
  const hook = { tap: null };
  ws.on('message', (d) => {
    const text = String(d), m = JSON.parse(text);
    got[m.t] = (got[m.t] ?? 0) + 1;
    hook.tap?.(m, text.length);
    const w = waiting.findIndex((x) => x.t === m.t);
    if (w >= 0) waiting.splice(w, 1)[0].resolve(m);
    else inbox.push(m);
  });
  await new Promise((r) => ws.on('open', r));
  return {
    got,
    /** Sees every message as it comes in, with its length. @param {((m: any, size: number) => void) | null} fn */
    tap: (fn) => { hook.tap = fn; },
    /** Drops what is waiting unread of one type. @param {string} t */
    forget: (t) => { for (let i = inbox.length - 1; i >= 0; i--) if (inbox[i].t === t) inbox.splice(i, 1); },
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

  // A raid: a room only its code opens, the boss's HP and phases kept here, a fall and a revive, a clear.
  {
    const [GINA, HAL] = ['gina', 'hal'].map((n) => n + tag);
    const g = await client(), h = await client();
    g.send({ t: 'register', name: GINA, password: 'pw1234' });
    h.send({ t: 'register', name: HAL, password: 'pw1234' });
    await g.next('session');
    await h.next('session');
    g.send({ t: 'lobby_create', raid: 'sun' });
    const room = (await g.next('lobby')).lobby;
    check(room.raid === 'sun', 'a raid room opens');
    h.send({ t: 'lobbies' });
    const listed = await h.next('lobbies');
    check(!listed.list.some((/** @type {{ code: string }} */ l) => l.code === room.code), 'a raid room is not on the public list');
    h.send({ t: 'lobby_join', code: room.code });
    await h.next('lobby');
    g.send({ t: 'lobby_pick', hero: 'Lyra' });
    g.send({ t: 'lobby_ready', ready: true });
    h.send({ t: 'lobby_pick', hero: 'Bram' });
    h.send({ t: 'lobby_ready', ready: true });
    const rg = await g.next('raid_start'), rh = await h.next('raid_start');
    check(rg.side === 0 && rh.side === 1 && rg.partner.hero === 'Bram' && rh.partner.hero === 'Lyra', 'a raid starts with both heroes');
    // After both have picked the gate opens, and both walk in.
    const through = async () => {
      await g.next('raid_gate');
      g.send({ t: 'raid_enter' });
      h.send({ t: 'raid_enter' });
    };
    // The pick first: the hub waits for both, then the first boss.
    const off = await g.next('raid_offer');
    check(off.stage === 0 && off.tier === 1 && off.boss === 'sun' && off.seconds === 30, 'the run opens with a pick');
    await h.next('raid_offer');
    g.send({ t: 'raid_pick' });
    await wait(200);
    h.send({ t: 'raid_pick' });
    const gate = await g.next('raid_gate');
    check(gate.seconds === 15, 'both picked: the gate opens, and nobody is fighting yet');
    g.send({ t: 'raid_enter' });
    await wait(150);
    h.send({ t: 'raid_enter' });
    const st = await g.next('raid_stage');
    check(st.boss === 'sun' && st.hp === SUN && st.brain === 0, 'both picked: the first boss loads');
    await h.next('raid_stage');
    g.send({ t: 'match_loaded', maxHp: 520 });
    h.send({ t: 'match_loaded', maxHp: 800 });
    await g.next('match_fight');
    await h.next('match_fight');
    g.send({ t: 'boss_damage', amount: 100 });
    h.send({ t: 'hero_down' });
    await wait(3200);

    // The brain's casts and walk reach the other screen, and only from the screen that runs it.
    const castMsg = { t: 'boss_cast', id: 7, move: 'sweep', step: 0, x: 1, z: 2, fx: 0, fz: 0, dir: 0.5, seed: 9, target: 1 };
    h.send({ ...castMsg, id: 8 });
    g.send(castMsg);
    const cast = await h.next('boss_cast');
    check(cast.id === 7 && cast.move === 'sweep' && cast.target === 1, 'the brain\'s cast is relayed, and the other screen\'s is not');
    g.send({ t: 'boss_move', x: 50, z: 7, yaw: 1 });
    check(Math.abs((await h.next('boss_move')).x - 15.5) < 1e-6, 'the boss\'s walk is relayed, clamped to its wider room');
    g.send({ t: 'move', x: 50, z: 7, yaw: 1 });
    check(Math.abs((await h.next('peer_move')).x - 15.5) < 1e-6, 'a hero\'s walk too');

    // The hub keeps the boss's HP: hits from both, capped, and sent to both.
    g.send({ t: 'boss_damage', amount: 300 });
    check((await g.next('boss_hp')).hp === SUN - 300 && (await h.next('boss_hp')).hp === SUN - 300, 'hits come off the boss and both hear it');
    g.send({ t: 'boss_damage', amount: 99999 });
    await wait(150);
    check((await g.next('boss_hp')).hp === SUN - 900, 'one hit is capped');
    await h.next('boss_hp');
    await wait(1050);
    // Into the second phase, at 70 %: from both screens, each under its own cap for the second.
    h.send({ t: 'boss_damage', amount: 600 });
    await wait(150);
    h.send({ t: 'boss_damage', amount: 600 });
    await wait(150);
    g.send({ t: 'boss_damage', amount: 600 });
    check((await g.next('boss_phase')).phase === 1 && (await h.next('boss_phase')).phase === 1, 'the phase changes on both screens');

    // The gauge: stagger from either screen, a full one kneels both.
    g.send({ t: 'boss_stagger', points: 60 });
    check((await h.next('boss_gauge')).value === 60, 'control fills the gauge');
    h.send({ t: 'boss_stagger', points: 999 });
    check((await g.next('boss_kneel')).seconds === 6 && (await h.next('boss_kneel')).seconds === 6, 'a full gauge makes it kneel, on both');
    await g.next('boss_gauge');
    await g.next('boss_gauge');
    await h.next('boss_gauge');

    // A gold zone counts who stood in it, once both have said.
    g.send({ t: 'boss_stood', id: 20, part: 0, inside: true });
    h.send({ t: 'boss_stood', id: 20, part: 0, inside: false });
    check((await g.next('boss_stood')).count === 1 && (await h.next('boss_stood')).count === 1, 'a gold zone counts its heroes');
    g.send({ t: 'boss_wall', index: 3 });
    h.send({ t: 'boss_wall', index: 3 });
    check((await g.next('boss_wall')).index === 3 && (await h.next('boss_wall')).index === 3, 'a wall falls on both');
    await wait(200);
    h.send({ t: 'boss_wall', index: 3 });

    // A hero's own HP reaches the partner. A fall, a revive, and at most two of them.
    g.send({ t: 'raid_hp', hp: 200 });
    const php = await h.next('partner_hp');
    check(php.hp === 200 && php.max === 520, 'a hero\'s HP reaches its partner');
    h.send({ t: 'hero_down' });
    check((await g.next('peer_down')).side === 1, 'a fall reaches both');
    await h.next('peer_down');
    h.send({ t: 'revive' });
    g.send({ t: 'revive' });
    const rv = await g.next('revived');
    check(rv.side === 1 && rv.hp === 400 && rv.left === 1, 'the partner gets the fallen hero up, at half HP');
    await h.next('revived');
    for (let i = 0; i < 2; i++) {
      h.send({ t: 'hero_down' });
      await g.next('peer_down');
      await h.next('peer_down');
      g.send({ t: 'revive' });
      await wait(100);
    }
    await g.next('revived');
    await h.next('revived');
    // That was the second; the third fall stays down.
    h.send({ t: 'boss_damage', amount: 1 });
    await wait(1100);

    // The boss falls: on to the next pick, and everyone is up and full again.
    const finish = (/** @type {any} */ who) => { for (let i = 0; i < 2; i++) who.send({ t: 'boss_damage', amount: 600 }); };
    // Hits past the boss's end are dropped, so this just hits for long enough: 1,200 a second, enough seconds for `hp`.
    const until = async (/** @type {string} */ t, hp) => {
      const seconds = Math.ceil(hp / 1200) + 1;
      for (let i = 0; i < seconds; i++) {
        finish(g);
        await wait(1050);
      }
      return g.next(t, 2000);
    };
    const won = await until('raid_won', SUN);
    check(won.bosses === 1 && won.last === false && won.seconds > 3, 'the first boss falls and the run goes on');
    await h.next('raid_won');
    const off2 = await g.next('raid_offer', 5000);
    check(off2.stage === 1 && off2.boss === 'ash', 'the next pick is for the second boss');
    g.send({ t: 'raid_pick' });
    h.send({ t: 'raid_pick' });
    // A side door (src/raid/paths.ts): it opens only when both walk into the same one, then another pick and the gate again.
    await g.next('raid_gate');
    await h.next('raid_gate');
    g.send({ t: 'raid_side', door: 'vault' });
    h.send({ t: 'raid_side', door: 'shrine' });
    await wait(150);
    h.send({ t: 'raid_side', door: 'vault' });
    const side = await g.next('raid_side_go');
    check(side.door === 'vault' && (await h.next('raid_side_go')).door === 'vault', 'both in the same side door: it opens for both');
    g.send({ t: 'raid_side', door: 'shrine' });
    g.send({ t: 'raid_pick' });
    h.send({ t: 'raid_pick' });
    await through();
    const st2 = await g.next('raid_stage');
    check(st2.boss === 'ash' && st2.hp === ASH, 'the second boss loads at its own HP');
    g.send({ t: 'match_loaded', maxHp: 520 });
    h.send({ t: 'match_loaded', maxHp: 800 });
    await g.next('match_fight');
    await h.next('match_fight');
    await wait(3100);

    // A tag team's casts carry who is on the rim and who steps in.
    g.send({ t: 'boss_cast', id: 40, move: 'tag', step: 0, x: 1, z: 2, fx: 0, fz: -9, dir: 0, seed: 9, target: 0, form: 1 });
    const tagged = await h.next('boss_cast');
    check(tagged.form === 1 && tagged.fz === -9, 'a tag reaches the other screen');
    g.send({ t: 'boss_cast', id: 41, move: 'fan', step: 0, x: 1, z: 2, fx: 0, fz: -9, dir: 0, seed: 9, target: 0, rim: true, flag: true });
    const rimCast = await h.next('boss_cast');
    check(rimCast.rim === true && rimCast.flag === true, 'so does a move from the rim');
    // Ash's Charge into a pillar: a stun as long as the table says, on both screens, and the gauge stays.
    g.send({ t: 'boss_stagger', points: 30 });
    check((await h.next('boss_gauge')).value === 30, 'the gauge fills');
    await g.next('boss_gauge');
    g.send({ t: 'boss_reward', key: 'charge', id: 42 });
    const stun = RAID_REWARDS.ash.charge.stun;
    check((await g.next('boss_kneel')).seconds === stun && (await h.next('boss_kneel')).seconds === stun, 'a Charge into a pillar stuns him, on both screens');
    g.send({ t: 'boss_reward', key: 'charge', id: 42 });
    await wait(stun * 1000 + 100);
    g.send({ t: 'boss_stagger', points: 10 });
    check((await h.next('boss_gauge')).value === 40, 'once, and the gauge kept what it had');
    await g.next('boss_gauge');

    // The second boss falls, and the third waits: the Heart of Noon.
    const won2 = await until('raid_won', ASH);
    check(won2.bosses === 2 && won2.last === false, 'the second boss falls and the run goes on');
    await h.next('raid_won');
    const offH = await g.next('raid_offer', 5000);
    check(offH.stage === 2 && offH.boss === 'heart', 'the next pick is for the third boss');
    await h.next('raid_offer');
    g.send({ t: 'raid_pick' });
    h.send({ t: 'raid_pick' });
    await through();
    const stH = await g.next('raid_stage');
    check(stH.boss === 'heart' && stH.hp === HEART, 'the third boss loads at its own HP');
    await h.next('raid_stage');
    g.send({ t: 'match_loaded', maxHp: 520 });
    h.send({ t: 'match_loaded', maxHp: 800 });
    await g.next('match_fight');
    await h.next('match_fight');
    await wait(3100);

    // The last boss falls: the clear screen. Both go on to the next tier, keeping their upgrades, with more boss HP.
    const clear = await until('raid_won', HEART);
    check(clear.bosses === 3 && clear.last === true && clear.tier === 1, 'the last boss falls: the raid is cleared');
    await h.next('raid_won');
    g.send({ t: 'raid_next', go: true });
    await wait(150);
    h.send({ t: 'raid_next', go: true });
    const off3 = await g.next('raid_offer', 3000);
    check(off3.stage === 0 && off3.tier === 2, 'both go on: the next tier opens with a pick');
    await h.next('raid_offer');
    g.send({ t: 'raid_pick' });
    h.send({ t: 'raid_pick' });
    await through();
    const st3 = await g.next('raid_stage');
    check(st3.hp === Math.round(SUN * 1.15), 'a tier adds 15 % to the boss');
    g.send({ t: 'match_loaded', maxHp: 520 });
    h.send({ t: 'match_loaded', maxHp: 800 });
    await g.next('match_fight');
    await h.next('match_fight');
    await wait(3100);
    // Both down ends the run, with its score. It counts as a raid and not as a win.
    g.send({ t: 'hero_down' });
    h.send({ t: 'hero_down' });
    const eg = await g.next('raid_end', 12000), eh = await h.next('raid_end', 12000);
    check(eg.result === 'lost' && eh.result === 'lost' && eg.bosses === 3 && eg.tier === 2, 'both down ends the run, with its score');
    const pr = eg.profile.raids;
    check(pr.played === 1 && pr.bosses === 3 && pr.tier === 2 && pr.best > 0 && eg.profile.wins === 0 && eg.profile.matches === 0, 'it counts as a raid, not as a win');

    // Someone leaves: the other fights on and takes the brain. The last hero down ends it.
    g.send({ t: 'lobby_create', raid: 'sun' });
    // The first room's updates are still in the inbox.
    let room2 = room;
    while (!room2 || room2.code === room.code) room2 = (await g.next('lobby')).lobby;
    h.send({ t: 'lobby_join', code: room2.code });
    g.send({ t: 'lobby_pick', hero: 'Lyra' });
    g.send({ t: 'lobby_ready', ready: true });
    h.send({ t: 'lobby_pick', hero: 'Bram' });
    h.send({ t: 'lobby_ready', ready: true });
    await g.next('raid_start');
    await h.next('raid_start');
    await g.next('raid_offer');
    await h.next('raid_offer');
    g.send({ t: 'raid_pick' });
    h.send({ t: 'raid_pick' });
    await through();
    await g.next('raid_stage');
    await h.next('raid_stage');
    g.send({ t: 'match_loaded', maxHp: 520 });
    h.send({ t: 'match_loaded', maxHp: 800 });
    await g.next('match_fight');
    await h.next('match_fight');
    await wait(3100);
    g.send({ t: 'match_leave' });
    await h.next('partner_left');
    await h.next('boss_brain');
    check(true, 'side 0 leaves: the other screen takes the brain');
    h.send({ ...castMsg, id: 30 });
    h.send({ t: 'hero_down' });
    const lost = await h.next('raid_end');
    check(lost.result === 'lost' && lost.profile.raids.played === 2, 'the last hero down ends it');

    // A room can't name something that isn't a boss.
    g.send({ t: 'lobby_create', raid: 'constructor' });
    let bad = room2;
    while (!bad || bad.code === room2.code) bad = (await g.next('lobby')).lobby;
    check(bad.raid === null, 'a room for a boss that does not exist is a plain lobby');
    g.send({ t: 'lobby_leave' });
    await wait(100);

    // A hero still down when the boss falls: the other leaves at the pick, and the run goes on alone. Also a two-kit hero's other half.
    g.send({ t: 'lobby_create', raid: 'sun' });
    let room3 = bad;
    while (!room3 || room3.code === bad.code) room3 = (await g.next('lobby')).lobby;
    h.send({ t: 'lobby_join', code: room3.code });
    g.send({ t: 'lobby_pick', hero: 'Lyra' });
    g.send({ t: 'lobby_ready', ready: true });
    h.send({ t: 'lobby_pick', hero: 'Pim and Pom' });
    h.send({ t: 'lobby_ready', ready: true });
    await g.next('raid_start');
    await h.next('raid_start');
    await g.next('raid_offer');
    await h.next('raid_offer');
    g.send({ t: 'raid_pick' });
    h.send({ t: 'raid_pick' });
    await through();
    await g.next('raid_stage');
    await h.next('raid_stage');
    g.send({ t: 'match_loaded', maxHp: 520 });
    h.send({ t: 'match_loaded', maxHp: 620 });
    await g.next('match_fight');
    await h.next('match_fight');
    await wait(3100);
    h.send({ t: 'raid_form', alt: true });
    check((await g.next('peer_form')).alt === true, 'a two-kit hero\'s other half reaches the partner');
    // A spot goes to whoever reports first, and both screens hear who.
    h.send({ t: 'boss_obj', id: 71, part: 0 });
    g.send({ t: 'boss_obj', id: 71, part: 0 });
    h.send({ t: 'boss_obj', id: 'x', part: 0 });
    const took = await g.next('boss_done');
    check(took.id === 71 && took.side === 1 && (await h.next('boss_done')).side === 1, 'a spot goes to the first who reports, and both hear who');
    // A reward: only from the screen that runs the brain, only from the table, once per cast.
    h.send({ t: 'boss_reward', key: 'ray', id: 72 });
    g.send({ t: 'boss_reward', key: 'constructor', id: 72 });
    g.send({ t: 'boss_reward', key: 'nothing', id: 72 });
    g.send({ t: 'boss_reward', key: 'ray', id: 72 });
    g.send({ t: 'boss_reward', key: 'ray', id: 72 });
    check((await g.next('boss_gauge')).value === 40 && (await h.next('boss_gauge')).value === 40, 'a reward fills the gauge, from the brain\'s screen only');
    g.send({ t: 'boss_reward', key: 'noon', id: 73 });
    check((await h.next('boss_kneel')).seconds > 0, 'a reward can make it kneel');
    check((await h.next('boss_gauge')).value === 0, 'and a kneel empties the gauge');
    await g.next('boss_gauge');
    await g.next('boss_kneel');
    // Older reports of the last fight may still be in the inbox.
    let paid = await h.next('boss_hp');
    for (let i = 0; i < 50 && paid.hp !== SUN - SUN * 0.05; i++) paid = await h.next('boss_hp');
    check(paid.hp === SUN - SUN * 0.05, 'and takes 5 % of the boss\'s HP off');
    h.send({ t: 'boss_debuff', kind: 'slow', amount: 0, seconds: 1.5 });
    const slowed = await g.next('peer_debuff');
    check(slowed.kind === 'slow' && slowed.seconds === 1.5, 'a slow on the boss reaches the other screen');
    g.send({ t: 'boss_debuff', kind: 'weaken', amount: 9, seconds: 99 });
    const capped = await h.next('peer_debuff');
    check(capped.amount === 0.5 && capped.seconds === 6, 'a debuff on the boss reaches the other screen, capped');
    h.send({ t: 'boss_debuff', kind: 'stun', amount: 1, seconds: 1 });
    h.send({ t: 'boss_debuff', kind: 'vulnerable', amount: 0.2, seconds: 'long' });
    h.send({ t: 'boss_debuff', kind: 'vulnerable', amount: 0.2, seconds: 2 });
    check((await g.next('peer_debuff')).kind === 'vulnerable', 'a kind it does not know, or a bad number, goes no further');
    h.send({ t: 'boss_add', id: 80, part: 1, amount: 9999 });
    const passed = await g.next('peer_add');
    check(passed.id === 80 && passed.part === 1 && passed.amount === 600, 'a hit on an add reaches the other screen, capped');
    h.send({ t: 'boss_add', id: 80, part: 1, amount: -5 });
    h.send({ t: 'boss_add', id: 80, part: 'x', amount: 5 });
    h.send({ t: 'boss_add', id: 81, part: 0, amount: 12 });
    check((await g.next('peer_add')).id === 81, 'a hit on an add with a bad number goes no further');
    g.send({ t: 'boss_cast', id: 70, move: 'tag', step: 0, x: 1, z: 2, fx: 0, fz: -9, dir: 0, seed: 9, target: 0, form: 5 });
    check((await h.next('boss_cast')).form === undefined, 'a cast with a form that does not exist loses it');
    h.send({ t: 'hero_down' });
    await g.next('peer_down');
    await until('raid_won', SUN * 1.15);
    await h.next('raid_won');
    // Older runs' offers are still in the inbox.
    let off4;
    do off4 = await h.next('raid_offer', 5000);
    while (off4.stage !== 1);
    g.send({ t: 'match_leave' });
    await h.next('partner_left');
    check(true, 'the other leaves at the pick: a hero who was down goes on alone');
    h.send({ t: 'raid_pick' });
    await h.next('raid_gate');
    h.send({ t: 'raid_enter' });
    // Older runs' stages are still in the inbox.
    let st4;
    do st4 = await h.next('raid_stage', 5000);
    while (st4.stage !== 1);
    check(st4.brain === 1, 'and runs the next boss');
    g.close(); h.close();
  }

  // A raid for a party (pipeline/designs/raid-party.md): an open room on the list, the band, walks in batches, who did what,
  // the brain's watchdog, leavers, and a loss only when everyone still here is down.
  /** `n` new players, signed in. @param {number} n @param {string} prefix */
  const players = async (n, prefix) => {
    const list = await Promise.all(Array.from({ length: n }, () => client()));
    list.forEach((x, i) => x.send({ t: 'register', name: `${prefix}${i}${tag}`, password: 'pw1234' }));
    await Promise.all(list.map((x) => x.next('session', 20000)));
    return list;
  };
  /** The next message of a type that fits, dropping older ones that don't. @param {any} x @param {string} t @param {(m: any) => boolean} fits */
  const seen = async (x, t, fits, ms = 8000) => {
    for (let i = 0; i < 500; i++) {
      const m = await x.next(t, ms);
      if (fits(m)) return m;
    }
    throw new Error(`no ${t} that fits`);
  };
  /** A room for a party, everyone seated with a hero. @param {any[]} p @param {boolean} open @param {string[]} heroes */
  const seat = async (p, open, heroes) => {
    p[0].send({ t: 'lobby_create', raid: 'sun', open });
    const room = (await p[0].next('lobby')).lobby;
    for (const x of p.slice(1)) x.send({ t: 'lobby_join', code: room.code });
    p.forEach((x, i) => x.send({ t: 'lobby_pick', hero: heroes[i % heroes.length] }));
    await seen(p[0], 'lobby', (m) => m.lobby?.seats.length === p.length && m.lobby.seats.every((/** @type {any} */ s) => s.hero), 20000);
    return room;
  };
  /** From the pick to the fight: everyone picks, walks through the gate, loads, and the countdown runs out. @param {any[]} here */
  const intoFight = async (here) => {
    for (const x of here) x.send({ t: 'raid_pick' });
    await Promise.all(here.map((x) => x.next('raid_gate')));
    for (const x of here) x.send({ t: 'raid_enter' });
    const stage = await Promise.all(here.map((x) => x.next('raid_stage')));
    for (const x of here) x.send({ t: 'match_loaded', maxHp: 600 });
    await Promise.all(here.map((x) => x.next('match_fight')));
    await wait(3100);
    return stage;
  };
  {
    if (!target) check(!hubLog.some((l) => l.includes('the brain moves')), 'in the raids for two the brain stayed where it was');
    const N = 12, HEROES = ['Lyra', 'Lyra', 'Bram', 'Vesper', 'Brannoc', 'Vitriol'];
    const p = await players(N, 'pa');
    const name = (/** @type {number} */ i) => `pa${i}${tag}`;
    /** Everyone still in the raid. @type {any[]} */
    let here = [...p];

    // The room: open, so it is on the list for everyone, and joined by its code.
    p[0].send({ t: 'lobby_create', raid: 'sun', open: true });
    const room = (await p[0].next('lobby')).lobby;
    check(room.open === true && room.max === RAID_PARTY_MAX && room.band === 2 && room.host === 0, `an open raid room with ${RAID_PARTY_MAX} seats`);
    p[1].send({ t: 'lobbies' });
    const on = await seen(p[1], 'lobbies', (m) => m.raids?.some((/** @type {any} */ r) => r.code === room.code));
    const entry = on.raids.find((/** @type {any} */ r) => r.code === room.code);
    check(entry.host === name(0) && entry.count === 1 && entry.raid === 'sun' && !on.list.some((/** @type {any} */ l) => l.code === room.code),
      'it is on the list of open raids, with its host and how many are in');
    for (const x of p.slice(1)) x.send({ t: 'lobby_join', code: room.code });
    const full = await seen(p[0], 'lobby', (m) => m.lobby?.seats.length === N, 20000);
    check(full.lobby.band === 15 && full.you === 0, 'twelve joined by its code: the room shows the band for 15');
    // The same hero twice, the host starts, and only once everyone has a hero.
    p.slice(0, N - 1).forEach((x, i) => x.send({ t: 'lobby_pick', hero: HEROES[i % HEROES.length] }));
    p[1].send({ t: 'lobby_ready', ready: true });
    const twice = await seen(p[0], 'lobby', (m) => m.lobby?.seats.filter((/** @type {any} */ s) => s.hero).length === N - 1 && m.lobby.seats[1].ready);
    check(twice.lobby.seats[0].hero === 'Lyra' && twice.lobby.seats[1].hero === 'Lyra' && p[1].got.error === undefined, 'two may take the same hero in a party');
    p[3].send({ t: 'raid_go' });
    check((await p[3].next('error')).error.includes('host'), 'only the host starts it');
    p[0].send({ t: 'raid_go' });
    check((await p[0].next('error')).error.includes('hero'), 'and not while someone has no hero');
    p[N - 1].send({ t: 'lobby_pick', hero: 'Kaia' });
    await seen(p[0], 'lobby', (m) => m.lobby?.seats.every((/** @type {any} */ s) => s.hero));
    p[0].send({ t: 'raid_go' });
    const starts = await Promise.all(p.map((x) => x.next('raid_start')));
    check(starts.every((m, i) => m.side === i && m.band === 15 && m.partner === undefined && m.party.length === N && m.you.name === name(i))
      && starts[5].party[1].hero === 'Lyra' && starts[5].party[11].name === name(11) && starts[5].party[7].side === 7,
    'the host starts: everyone gets the party of twelve and the band for 15');

    // The first fight: sized for 15.
    await Promise.all(p.map((x) => x.next('raid_offer')));
    // The brain's screen says something every second, as a real one does (any message counts), until the watchdog's turn.
    let brain = 0;
    let chat = setInterval(() => p[brain].send({ t: 'ping' }), 1000);
    const stage = await intoFight(here);
    check(stage.every((m) => m.band === 15 && m.hp === raidHp('sun', 15, 1) && m.staggerMax === raidStaggerMax('sun', 15) && m.brain === 0)
      && stage[0].hp === SUN * 7.5, `the boss loads for 15: ${stage[0].hp} HP, a gauge of ${stage[0].staggerMax}`);

    // Walks: many a second from two heroes come out as batches, ten a second, the newest of each, never the receiver's own.
    /** @type {any[]} */
    const to5 = [], to2 = [];
    p[5].tap((m) => { if (m.t === 'party_moves') to5.push(m); });
    p[2].tap((m) => { if (m.t === 'party_moves') to2.push(m); });
    const STEPS = 40, walked = Date.now();
    for (let i = 1; i <= STEPS; i++) {
      p[2].send({ t: 'move', x: i === STEPS ? 50 : i / 10, z: 7, yaw: 1, ts: i });
      p[3].send({ t: 'move', x: -i / 10, z: 7, yaw: 2, ts: i });
      await wait(20);
    }
    const walkedMs = Date.now() - walked;
    await wait(300);
    p[5].tap(null);
    p[2].tap(null);
    const last = (/** @type {any[]} */ list, /** @type {number} */ side) => list.flatMap((m) => m.list).filter((e) => e[0] === side).pop();
    check(to5.length >= 4 && to5.length <= walkedMs / 100 + 3 && to5.every((m) => m.list.length <= 2) && !p[5].got.peer_move,
      `${STEPS * 2} walks in ${walkedMs} ms reach another player as ${to5.length} batches, ten a second, not one message each`);
    const l2 = last(to5, 2), l3 = last(to5, 3);
    check(l2.length === 5 && Math.abs(l2[1] - 45.5) < 1e-6 && l2[3] === 1 && l2[4] === STEPS && l3[1] === -STEPS / 10 && l3[4] === STEPS,
      'a batch has the newest walk of each hero as [side, x, z, yaw, ts], kept inside the room of a party (the Hall of Noon, 46 m)');
    check(to2.length > 0 && to2.every((m) => m.list.every((/** @type {any} */ e) => e[0] === 3)), 'and nobody gets its own walk back');

    // Who did it: a cast, a hero's HP and the boss's own cast reach everyone else, with the side.
    p[4].send({ t: 'cast', id: 1, slot: 0, x: 0, z: 1, fx: 0, fz: 13, enemy: true });
    const casts = await Promise.all(p.filter((_, i) => i !== 4).map((x) => x.next('peer_cast')));
    await wait(100);
    check(casts.length === N - 1 && casts.every((m) => m.side === 4 && m.id === 1) && !p[4].got.peer_cast, 'a cast reaches the eleven others, saying whose it was');
    p[6].send({ t: 'raid_hp', hp: 200 });
    const hp6 = await p[9].next('partner_hp');
    check(hp6.side === 6 && hp6.hp === 200 && hp6.max === 600, 'so does a hero\'s HP');
    const bossCast = { t: 'boss_cast', id: 7, move: 'sweep', step: 0, x: 1, z: 2, fx: 0, fz: 0, dir: 0.5, seed: 9, target: 7 };
    p[1].send({ ...bossCast, id: 8 });
    p[0].send({ ...bossCast, id: 9, target: N });
    p[0].send(bossCast);
    const bc = await Promise.all(p.slice(1).map((x) => x.next('boss_cast')));
    check(bc.every((m) => m.id === 7 && m.target === 7), 'the brain\'s cast reaches everyone, aimed at any seat of the party');

    // The gauge and a mechanic's share of it are the band's size; the boss's HP is one number for all.
    p[2].send({ t: 'boss_stagger', points: 60 });
    await wait(50);
    p[3].send({ t: 'boss_stagger', points: 60 });
    await seen(p[8], 'boss_gauge', (m) => m.value === 120);
    p[0].send({ t: 'boss_reward', key: 'ray', id: 30 });
    const ray = RAID_REWARDS.sun.ray.stagger * 7.5;
    check((await seen(p[8], 'boss_gauge', (m) => m.value > 120)).value === 120 + ray && !p[8].got.boss_kneel,
      `a gauge that would be full for two is not for 15, and a mechanic fills ${ray} of it`);
    p[1].send({ t: 'boss_damage', amount: 300 });
    check((await p[11].next('boss_hp')).hp === SUN * 7.5 - 300, 'a hit comes off the boss for everyone');

    // Two fall. A gold zone counts who stands, of those who are up, as soon as they have all said.
    p[10].send({ t: 'hero_down' });
    p[11].send({ t: 'hero_down' });
    await Promise.all([seen(p[0], 'peer_down', (m) => m.side === 11), seen(p[1], 'peer_down', (m) => m.side === 10)]);
    p[10].send({ t: 'boss_stood', id: 20, part: 0, inside: true });
    for (let i = 0; i < 10; i++) p[i].send({ t: 'boss_stood', id: 20, part: 0, inside: i < 4 });
    const asked = Date.now();
    const stood = await p[10].next('boss_stood');
    check(stood.count === 4 && Date.now() - asked < 1000 && (await p[0].next('boss_stood')).count === 4, 'a gold zone counts the four standing in it, without waiting for the two who are down');
    // A revive names whom.
    p[5].send({ t: 'revive' });
    p[5].send({ t: 'revive', side: 5 });
    p[5].send({ t: 'revive', side: 10 });
    const up = await p[2].next('revived');
    check(up.side === 10 && up.by === 5 && up.hp === 300 && up.left === 1 && (await p[10].next('revived')).side === 10, 'a revive names whom, and everyone hears who got up and by whom');
    p[6].send({ t: 'revive', side: 11 });
    await seen(p[0], 'revived', (m) => m.side === 11);

    // The watchdog: the brain's screen goes quiet. After 4 s the brain goes to the next player whose screen is still there
    // (the two seats after it have said nothing for as long, the third has).
    await wait(600);
    clearInterval(chat);
    p[0].send({ t: 'ping' });
    const quiet = Date.now();
    chat = setInterval(() => p[3].send({ t: 'ping' }), 1000);
    const took = await p[3].next('boss_brain', 7000), after = Date.now() - quiet;
    brain = 3;
    check(took.side === 3 && after > 3500 && after < 6000, `nothing from the brain's screen for 4 s: the brain moves (after ${(after / 1000).toFixed(1)} s) to the next screen that is alive`);
    const moved = await Promise.all(p.filter((_, i) => i !== 3).map((x) => x.next('brain_moved')));
    check(moved.every((m) => m.side === 3) && !p[1].got.boss_brain && !p[3].got.brain_moved, 'the others, the old brain too, hear whose it is now');
    p[0].send({ ...bossCast, id: 50 });
    p[3].send({ ...bossCast, id: 51 });
    check((await p[0].next('boss_cast')).id === 51 && (await p[7].next('boss_cast')).id === 51, 'and the new brain\'s casts count, the old one\'s no longer');

    // Two leave in the fight, one by closing the page. The fight keeps its band; the next one is sized for who is left.
    p[8].send({ t: 'match_leave' });
    p[9].close();
    here = here.filter((x) => x !== p[8] && x !== p[9]);
    const gone = [await p[0].next('partner_left'), await p[0].next('partner_left')].map((m) => m.side).sort();
    check(gone.join() === '8,9', 'two leave: the others hear who');
    p[1].send({ t: 'boss_stagger', points: 60 });
    await wait(50);
    p[2].send({ t: 'boss_stagger', points: 60 });
    const kept = await seen(p[4], 'boss_gauge', (m) => m.value >= 120 + ray + 120);
    await wait(200);
    check(kept.value === 240 + ray && kept.value > raidStaggerMax('sun', 10) && !p[4].got.boss_kneel, 'the fight keeps the band it started with: the gauge is still the one for 15');
    // The boss falls: ten players, each under its own cap, and no cap on the party as a whole.
    let fell = false;
    const wonAll = Promise.all(here.map((x) => x.next('raid_won', 30000))).then((w) => { fell = true; return w; });
    const began = Date.now();
    for (let i = 0; i < 20 && !fell; i++) {
      for (const x of here) for (let k = 0; k < 3; k++) x.send({ t: 'boss_damage', amount: 600 });
      await wait(1050);
    }
    const won = await wonAll, took1 = (Date.now() - began) / 1000;
    check(won.every((m) => m.bosses === 1 && m.last === false) && took1 < 9, `ten players take ${SUN * 7.5} HP off in ${took1.toFixed(1)} s: 1,400 a second each, and the party's total is not capped`);

    // The hall: a side door opens on a majority of those here, for everyone.
    await Promise.all(here.map((x) => seen(x, 'raid_offer', (m) => m.stage === 1)));
    for (const x of here) x.send({ t: 'raid_pick' });
    await Promise.all(here.map((x) => x.next('raid_gate')));
    here.slice(0, 5).forEach((x) => x.send({ t: 'raid_side', door: 'vault' }));
    here.slice(5, 8).forEach((x) => x.send({ t: 'raid_side', door: 'shrine' }));
    await wait(300);
    check(!here[0].got.raid_side_go, 'five of ten in one side door: it stays shut');
    here[9].send({ t: 'raid_side', door: 'vault' });
    const doors = await Promise.all(here.map((x) => x.next('raid_side_go')));
    check(doors.every((m) => m.door === 'vault'), 'the sixth makes a majority: it opens, for everyone');
    clearInterval(chat);
    brain = p.indexOf(here[0]);
    chat = setInterval(() => p[brain].send({ t: 'ping' }), 1000);
    const stage2 = await intoFight(here);
    check(stage2.every((m) => m.boss === 'ash' && m.band === 10 && m.hp === ASH * 5 && m.staggerMax === raidStaggerMax('ash', 10) && m.brain === 0)
      && raidBand(here.length) === 10, `the next boss loads for the ten who are left: ${stage2[0].hp} HP`);

    // Lost only when everyone still here is down at once.
    for (const x of here) x.forget('peer_down');
    here.slice(0, 9).forEach((x) => x.send({ t: 'hero_down' }));
    await seen(here[9], 'peer_down', (m) => m.side === p.indexOf(here[8]));
    await wait(400);
    check(!here[9].got.raid_end && !here[0].got.raid_end, 'nine of ten down: the run goes on');
    here[9].send({ t: 'hero_down' });
    const ends = await Promise.all(here.map((x) => x.next('raid_end', 12000)));
    check(ends.every((m) => m.result === 'lost' && m.bosses === 1 && m.tier === 1 && m.bossMax === ASH * 5) && ends[0].profile.raids.played === 1,
      'the tenth falls: the run is lost for all ten, with its score');
    clearInterval(chat);
    if (!target) check(hubLog.filter((l) => l.includes('the brain moves')).length === 1, 'the brain moved once in all, when its screen went quiet');
    for (const x of p) x.close();
  }

  // The host may start with whoever is seated, alone too: one or two players fight at the band for two.
  {
    const [solo] = await players(1, 'so');
    solo.send({ t: 'lobby_create', raid: 'sun' });
    await solo.next('lobby');
    solo.send({ t: 'lobby_pick', hero: 'Lyra' });
    solo.send({ t: 'raid_go' });
    const start = await solo.next('raid_start');
    await solo.next('raid_offer');
    solo.send({ t: 'raid_pick' });
    await solo.next('raid_gate');
    solo.send({ t: 'raid_enter' });
    const st = await solo.next('raid_stage');
    check(start.party.length === 1 && start.band === 2 && start.partner === undefined && st.band === 2 && st.hp === SUN && st.staggerMax === RAID_BOSSES.sun.staggerMax,
      'the host may start alone: the boss is the one for two');
    solo.close();
  }

  // The load of a full raid: forty players in one fight, each sending its walk ten times a second for five seconds.
  {
    const N = RAID_PARTY_MAX, SECONDS = 5;
    const t0 = Date.now();
    const p = await players(N, 'ld');
    const room = await seat(p, false, ['Lyra', 'Bram', 'Vesper', 'Kaia']);
    p[1].forget('lobbies');
    p[1].send({ t: 'lobbies' });
    const none = await p[1].next('lobbies');
    check(!JSON.stringify(none).includes(room.code), 'a raid room that was not opened is on no list');
    p[0].send({ t: 'raid_go' });
    const starts = await Promise.all(p.map((x) => x.next('raid_start', 20000)));
    await Promise.all(p.map((x) => x.next('raid_offer')));
    const stage = await intoFight(p);
    check(starts.every((m) => m.band === 40 && m.party.length === N) && stage[0].band === 40 && stage[0].hp === SUN * 20, `forty in one raid: the boss loads for 40, ${stage[0].hp} HP`);
    const setup = (Date.now() - t0) / 1000;

    let frames = 0, bytes = 0, entries = 0, delay = 0, worst = 0, other = 0, began = 0;
    /** Which heroes each player has heard of. */
    const heard = p.map(() => new Set());
    p.forEach((x, i) => x.tap((m, size) => {
      frames++;
      bytes += size;
      if (m.t !== 'party_moves') { other++; return; }
      const now = Date.now() - began;
      for (const e of m.list) {
        entries++;
        heard[i].add(e[0]);
        delay += now - e[4];
        worst = Math.max(worst, now - e[4]);
      }
    }));
    began = Date.now();
    const cpu = process.cpuUsage(), mm = (/** @type {number} */ v) => +v.toFixed(3);
    let sent = 0;
    /** @type {any[]} */
    const timers = [];
    p.forEach((x, i) => {
      let step = 0;
      const go = () => {
        const a = (i / N) * Math.PI * 2 + step++ * 0.05;
        // As the game sends it: to the millimetre, with its own clock's time (here one clock for all, to measure the way).
        x.send({ t: 'move', x: mm(Math.cos(a) * 8), z: mm(7 + Math.sin(a) * 8), yaw: mm(a), ts: Date.now() - began });
        sent++;
      };
      // Not all on the same tick: each player's clock runs its own way.
      timers.push(setTimeout(() => { go(); timers.push(setInterval(go, 100)); }, (i * 100) / N));
    });
    await wait(SECONDS * 1000);
    for (const t of timers) { clearTimeout(t); clearInterval(t); }
    await wait(250);
    for (const x of p) x.tap(null);
    const took = (Date.now() - began - 250) / 1000, used = process.cpuUsage(cpu), perS = frames / took;
    console.log(`     load: ${N} players, ${sent} walks sent in ${took.toFixed(1)} s (${Math.round(sent / took)} a second)`);
    console.log(`     load: the hub sent ${frames} messages, ${Math.round(perS)} a second (${Math.round(perS / N * 10) / 10} a second to each player), ${Math.round(bytes / took / 1024)} KB a second in all, ${Math.round(bytes / took / N / 102.4) / 10} KB a second to each player`);
    console.log(`     load: one message per walk and player would be ${Math.round(sent / took) * (N - 1)} a second`);
    console.log(`     load: ${entries} walks delivered, ${Math.round(delay / Math.max(1, entries))} ms from sent to received on average, ${worst} ms at worst`);
    console.log(`     load: ${((used.user + used.system) / 1000 / took / 10).toFixed(1)} % of one core, hub${target ? ' not counted (it runs elsewhere)' : ' and all forty test clients together'}; seating and starting the forty took ${setup.toFixed(1)} s`);
    check(perS <= N * 11.5 && other === 0, `the hub sends each player about ten batches a second (${Math.round(perS)} messages a second for forty), and nothing else`);
    check(heard.every((h, i) => h.size === N - 1 && !h.has(i)), 'every player hears the walk of all 39 others');
    check(entries >= sent * (N - 1) * 0.8 && worst < 500, `walks arrive within a batch or two (worst ${worst} ms)`);
    for (const x of p) x.close();
    await wait(300);
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
