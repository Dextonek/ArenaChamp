// The duel game's server logic, independent of the runtime: sessions, lobbies, the matchmaking queue and the
// relay/referee for 1v1 matches. Hosts feed it connections: game-server.mjs (Node + `ws`) and worker/index.mjs (a
// Cloudflare Durable Object). Messages are JSON `{ t: type, ...fields }`; the table is in
// docs/architecture/multiplayer.md and the client is src/net/.
//
// Authority: the hub owns sessions, lobbies, pairing, match start, the rounds, HP, the winner and the stats. Each
// client owns its own hero's movement and casts and reports the hits it takes (it knows where it stood when a spell
// landed, which is what makes walking out of the red a dodge). The hub only accepts hits from casts it relayed and
// limits how fast a slot can be cast. Fine for friends; not cheat-proof.
import { hex } from './accounts.mjs';
import { PROTOCOL, RAID_BOSSES, RELOAD_TEXT } from './protocol.mjs';

const HP = 600; // when a client does not say its hero's max HP
const RING = { x: 0, z: 7, r: 12 };
const COUNTDOWN = 3;
const LOAD_TIMEOUT = 15000;
// Best of three: the first to two round wins takes the match. A round ends when a hero falls. The hub has no clock for
// it, but the arena's Last stand makes a long round end (user, 2026-11-06; src/arenas/shifts). BREAK_MS between rounds.
const ROUNDS_TO_WIN = 2;
const BREAK_MS = 3000;
// Loser picks is switched off for every match (user, 2026-11-06): the code stays, and `createHub({ loserPicks: true })`
// turns it on. With it on, the loser of a round that does not end the match has PICK_MS to swap hero or choose the next
// arena. Best of three gives each player one pick at most by itself: the loser of round 1 picks, and only if they then
// win round 2 is there a second pick, by the other player. An answer ends the wait, but the break still lasts BREAK_MS.
const PICK_MS = 15000;
const ARENA_ID_RE = /^[a-z]{1,16}$/;
// A hit must come from a cast the other side made at most this long ago; a slot can't be cast faster than SLOT_GAP_MS
// (R: R_GAP_MS). Lenient on purpose: the real cooldowns live in the kits, which are still changing.
const HIT_WINDOW_MS = 12000;
const SLOT_GAP_MS = 350;
const R_GAP_MS = 10000;
// A free second R (a recast such as Oblivion's Collapse) may follow the first within RECAST_MS.
const RECAST_MS = 4000;
// Basic attacks: at most one per ATTACK_GAP_MS, a hit from one at most ATTACK_MAX damage. Heals: one at most HEAL_MAX,
// at most HEAL_WINDOW_MAX within HEAL_WINDOW_MS. Statuses and shields the clients report are only relayed (for the
// look on the other screen), clamped to these caps.
const ATTACK_GAP_MS = 500;
const ATTACK_MAX = 40;
const HEAL_MAX = 150;
const HEAL_WINDOW_MS = 2000;
const HEAL_WINDOW_MAX = 300;
const STATUS_KINDS = ['stun', 'root', 'slow', 'silence', 'blind', 'knockup', 'charm', 'sealed'];
const STATUS_MAX_S = 3;
const SHIELD_MAX = 400;
const SHIELD_MAX_S = 10;
// The identity layer (src/traits): a cast's power and extras, buffs and debuffs, stacks, the resource.
const POWER_MIN = 0.25;
const POWER_MAX = 3;
const BUFF_KINDS = ['haste', 'might', 'armor', 'vulnerable', 'weaken', 'grounded'];
const BUFF_MAX = 0.5;
const BUFF_MAX_S = 6;
const SPELL_HIT_MAX = 400;
const HAZARD_MAX = 60; // one arena hazard hit
const HAZARD_GAP_MS = 300; // the least time between two hazard hits on one hero
const HERO_RE = /^[A-Za-z][A-Za-z.' -]{0,23}$/;
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
// The Raid. Two players, each owning their own hero's HP and telling the other (a cheat there only helps both). The boss's
// HP, phase and stagger live here, because both must agree on them. One screen runs the boss's brain and the hub relays what
// it decides. Damage from one screen is capped by the hit and by the second; both hit at most this hard.
const BOSS_HIT_MAX = 600;
const BOSS_SECOND_MAX = 1400;
const BOSS_HP_GAP_MS = 100;
const STAGGER_MAX = 60;
const REVIVES = 2;
// How long a gold zone waits for the other screen's report before it counts who it has (s).
const STOOD_WAIT_MS = 1500;
const MOVE_RE = /^[a-z]{1,16}$/;
/** Stands in for the client of a player who left: nothing is sent there. */
const GONE = /** @type {any} */ ({ closed: true, send() {} });

/**
 * @typedef {{ send: (text: string) => void, name: string | null, lobby: Lobby | null, queued: { hero: string, since: number } | null,
 *   match: Match | null, side: number, chain: Promise<void>, closed: boolean }} Client
 * @typedef {{ code: string, seats: { client: Client, hero: string | null, ready: boolean }[], raid?: string | null }} Lobby
 * @typedef {{ client: Client, name: string, hero: string, first: string, max: number, hp: number, loaded: boolean, casts: number, hits: number,
 *   dodges: number, recent: Map<number, number>, lastSlot: number[], attacks: Set<number>, lastAttack: number,
 *   heals: { at: number, amount: number }[], rRecast?: boolean, hazardAt?: number, down?: boolean, left?: boolean, dmgAt?: number, dmgSum?: number }} Player
 * @typedef {{ id: string, hp: number, max: number, phase: number, gauge: number, kneelUntil: number, brain: number, revives: number[],
 *   stood: Map<string, { count: number, from: Set<number>, timer: any }>, settled: Set<string>, walls: Set<number>, hpTimer: any, hpAt: number }} RaidBoss
 * @typedef {{ id: string, players: Player[], state: 'loading' | 'fight' | 'break' | 'over', created: number, startedAt: number,
 *   fightAt: number, round: number, score: number[], timer: any,
 *   pick: { side: number, at: number, next: () => void } | null,
 *   picked: { by: string, hero?: string, arena?: string } | null, boss?: RaidBoss }} Match
 */

/** @param {number} n */
const randomHex = (n) => hex(crypto.getRandomValues(new Uint8Array(n)));

/**
 * @param {{ accounts: import('./accounts.mjs').Accounts, log?: (msg: string) => void, loserPicks?: boolean }} opts
 *   `loserPicks`: the loser of a round may pick. Off everywhere; only the smoke test turns it on, to keep it working.
 */
export function createHub({ accounts, log = (m) => console.log(`[game] ${m}`), loserPicks = false }) {
  /** @type {Map<string, string>} token → account name */
  const sessions = new Map();
  /** @type {Set<Client>} */
  const clients = new Set();
  /** @type {Map<string, Lobby>} */
  const lobbies = new Map();
  /** @type {Client[]} */
  const queue = [];

  /**
   * A new connection. `send` writes one text frame. Returns the handlers the host calls for each incoming frame and
   * when the connection closes.
   * @param {(text: string) => void} sendText
   */
  function connect(sendText) {
    /** @type {Client} */
    const c = { send: sendText, name: null, lobby: null, queued: null, match: null, side: 0, chain: Promise.resolve(), closed: false };
    clients.add(c);
    return {
      /** @param {string} data */
      message(data) {
        let msg;
        try { msg = JSON.parse(String(data)); } catch { return; }
        if (!msg || typeof msg.t !== 'string') return;
        // One message at a time per connection (login hashes asynchronously; a lobby_create right after it waits).
        c.chain = c.chain
          .then(() => (c.closed ? undefined : handle(c, msg)))
          .catch((e) => log(`error handling ${msg.t}: ${e instanceof Error ? e.stack : e}`));
      },
      closed() {
        if (c.closed) return;
        c.closed = true;
        clients.delete(c);
        drop(c, 'disconnect');
      },
    };
  }

  /** @param {Client} c @param {any} msg */
  function send(c, msg) {
    if (c.closed) return;
    try { c.send(JSON.stringify(msg)); } catch { /* the host closes it */ }
  }

  /** @param {Client} c @param {string} error */
  const fail = (c, error) => send(c, { t: 'error', error });

  /** @param {Client} c @param {any} m */
  async function handle(c, m) {
    if (m.t === 'register' || m.t === 'login' || m.t === 'resume') {
      // A tab from before this check sends no version and knows only `auth_error`, which it shows on its login screen.
      if (!num(m.v)) return send(c, { t: 'auth_error', error: RELOAD_TEXT });
      if (m.v < PROTOCOL) return send(c, { t: 'update_required', error: RELOAD_TEXT });
    }
    switch (m.t) {
      case 'register':
      case 'login': {
        const r = m.t === 'register' ? await accounts.register(m.name, m.password) : await accounts.login(m.name, m.password);
        if (!r.account) return send(c, { t: 'auth_error', error: r.error });
        return signIn(c, r.account.name);
      }
      case 'resume': {
        const name = typeof m.token === 'string' ? sessions.get(m.token) : undefined;
        if (!name || !accounts.get(name)) return send(c, { t: 'auth_error', error: '' });
        return signIn(c, name, m.token);
      }
    }
    if (!c.name) return send(c, { t: 'auth_error', error: 'Please log in' });
    switch (m.t) {
      case 'logout':
        for (const [tok, n] of sessions) if (n === c.name) sessions.delete(tok);
        drop(c, 'logout');
        c.name = null;
        return send(c, { t: 'logged_out', reason: '' });
      case 'profile':
        return sendProfile(c);
      case 'lobbies':
        return send(c, lobbyList());
      case 'lobby_create': {
        if (busy(c)) return;
        let code;
        do code = Array.from({ length: 4 }, () => CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]).join('');
        while (lobbies.has(code));
        // A raid room is a lobby too, joined by its code. It is not listed: a raid is between friends.
        const lobby = { code, seats: [{ client: c, hero: null, ready: false }], raid: typeof m.raid === 'string' && RAID_BOSSES[m.raid] ? m.raid : null };
        lobbies.set(code, lobby);
        c.lobby = lobby;
        return lobbyChanged(lobby);
      }
      case 'lobby_join': {
        if (busy(c)) return;
        const lobby = lobbies.get(String(m.code ?? '').toUpperCase().trim());
        if (!lobby) return fail(c, 'No lobby with that code');
        if (lobby.seats.length >= 2) return fail(c, 'That lobby is full');
        lobby.seats.push({ client: c, hero: null, ready: false });
        c.lobby = lobby;
        return lobbyChanged(lobby);
      }
      case 'lobby_leave':
        return leaveLobby(c);
      case 'lobby_pick': {
        const seat = c.lobby?.seats.find((s) => s.client === c);
        if (!seat || !validHero(m.hero)) return;
        seat.hero = m.hero;
        seat.ready = false;
        return lobbyChanged(/** @type {Lobby} */ (c.lobby));
      }
      case 'lobby_ready': {
        const lobby = c.lobby;
        const seat = lobby?.seats.find((s) => s.client === c);
        if (!lobby || !seat) return;
        if (m.ready) {
          if (!seat.hero) return fail(c, 'Pick a hero first');
          const other = lobby.seats.find((s) => s !== seat);
          if (other?.hero === seat.hero) return fail(c, `${seat.hero} is taken in this lobby: pick another hero`);
        }
        seat.ready = !!m.ready;
        lobbyChanged(lobby);
        if (lobby.seats.length === 2 && lobby.seats.every((s) => s.ready)) {
          lobbies.delete(lobby.code);
          for (const s of lobby.seats) {
            s.client.lobby = null;
            // The room is gone: the page must not offer "Back to lobby" after the fight.
            send(s.client, { t: 'lobby', lobby: null });
          }
          broadcastLobbies();
          const seats = lobby.seats.map((s) => ({ client: s.client, hero: /** @type {string} */ (s.hero) }));
          if (lobby.raid) startRaid(seats, lobby.raid);
          else startMatch(seats);
        }
        return;
      }
      case 'queue_join': {
        if (busy(c) || !validHero(m.hero)) return;
        c.queued = { hero: m.hero, since: Date.now() };
        queue.push(c);
        sendQueue(c);
        return pair();
      }
      case 'queue_leave':
        leaveQueue(c);
        return sendQueue(c);
      case 'match_loaded': {
        const p = player(c);
        if (!p || !c.match || c.match.state !== 'loading') return;
        p.loaded = true;
        // The client knows its hero's max HP (melee heroes carry more); every round starts full.
        if (num(m.maxHp)) p.max = Math.max(200, Math.min(2000, Math.round(m.maxHp)));
        p.hp = p.max;
        if (c.match.players.every((x) => x.loaded)) fight(c.match);
        return;
      }
      case 'move': {
        const match = c.match;
        if (!match || match.state === 'over' || !num(m.x) || !num(m.z)) return;
        const p = clampRing(m.x, m.z, match.boss ? RAID_BOSSES[match.boss.id].ring : RING.r);
        return send(match.players[1 - c.side].client, {
          t: 'peer_move', x: p.x, z: p.z, yaw: num(m.yaw) ? m.yaw : 0, ts: num(m.ts) ? m.ts : undefined,
          r: num(m.r) ? Math.max(0, Math.min(1000, m.r)) : undefined,
        });
      }
      case 'cast': {
        const match = c.match;
        if (!match || match.state !== 'fight' || Date.now() < match.fightAt) return;
        if (![0, 1, 2, 3].includes(m.slot) || !num(m.id) || !num(m.x) || !num(m.z) || !num(m.fx) || !num(m.fz)) return;
        const me = match.players[c.side], now = Date.now();
        const since = now - me.lastSlot[m.slot];
        if (m.slot === 3 && since < R_GAP_MS) {
          // Only one quick second R (a recast), and it does not restart the long gap.
          if (since < SLOT_GAP_MS || since > RECAST_MS || me.rRecast) return;
          me.rRecast = true;
        } else {
          if (since < SLOT_GAP_MS) return;
          me.lastSlot[m.slot] = now;
          if (m.slot === 3) me.rRecast = false;
        }
        me.recent.set(m.id, now);
        me.casts++;
        return send(match.players[1 - c.side].client, {
          t: 'peer_cast', id: m.id, slot: m.slot, x: m.x, z: m.z, fx: m.fx, fz: m.fz, enemy: !!m.enemy, yaw: num(m.yaw) ? m.yaw : undefined,
          // The bend of an arc aim (about +-1.4 rad at most): relayed so the other screen draws the same curve.
          bend: num(m.bend) ? Math.max(-1.5, Math.min(1.5, m.bend)) : undefined,
          mods: mods(m.mods),
        });
      }
      case 'attack': {
        // A basic attack released at the other hero: the other client plays it and reports the hit (`took_hit`).
        const match = c.match;
        if (!match || match.state !== 'fight' || Date.now() < match.fightAt || !num(m.id)) return;
        const me = match.players[c.side], now = Date.now();
        if (now - me.lastAttack < ATTACK_GAP_MS) return;
        me.lastAttack = now;
        me.recent.set(m.id, now);
        me.attacks.add(m.id);
        return send(match.players[1 - c.side].client, { t: 'peer_attack', id: m.id, mods: mods(m.mods) });
      }
      case 'heal': {
        const match = c.match;
        if (!match || match.state !== 'fight' || !num(m.amount) || m.amount <= 0) return;
        const me = match.players[c.side], now = Date.now();
        me.heals = me.heals.filter((h) => now - h.at < HEAL_WINDOW_MS);
        const room = HEAL_WINDOW_MAX - me.heals.reduce((a, h) => a + h.amount, 0);
        const amount = Math.min(Math.round(m.amount), HEAL_MAX, room, me.max - me.hp);
        if (amount <= 0) return send(c, { t: 'hp', hp: me.hp });
        me.heals.push({ at: now, amount });
        me.hp += amount;
        send(c, { t: 'hp', hp: me.hp });
        return send(match.players[1 - c.side].client, { t: 'peer_heal', amount, hp: me.hp });
      }
      case 'status': {
        const match = c.match;
        if (!match || match.state !== 'fight' || !STATUS_KINDS.includes(m.kind) || !num(m.seconds)) return;
        return send(match.players[1 - c.side].client, {
          t: 'peer_status', kind: m.kind, seconds: Math.max(0, Math.min(STATUS_MAX_S, m.seconds)), color: color(m.color),
        });
      }
      case 'spend': {
        // A hero paid HP for a spell (Vesper): off the HP the server counts, never below 1 (it can't KO itself).
        const match = c.match;
        if (!match || match.state !== 'fight' || !num(m.amount) || m.amount <= 0) return;
        const me = match.players[c.side];
        const amount = Math.min(Math.round(m.amount), 100, me.hp - 1);
        if (amount <= 0) return;
        me.hp -= amount;
        send(c, { t: 'hp', hp: me.hp });
        return send(match.players[1 - c.side].client, { t: 'peer_spend', amount, hp: me.hp });
      }
      case 'buff': {
        const match = c.match;
        if (!match || match.state !== 'fight' || !BUFF_KINDS.includes(m.kind) || !num(m.amount) || !num(m.seconds)) return;
        return send(match.players[1 - c.side].client, {
          t: 'peer_buff', kind: m.kind, amount: Math.max(0, Math.min(BUFF_MAX, m.amount)), seconds: Math.max(0, Math.min(BUFF_MAX_S, m.seconds)),
        });
      }
      case 'stacks': {
        const match = c.match;
        if (!match || match.state !== 'fight' || typeof m.name !== 'string' || !num(m.n)) return;
        return send(match.players[1 - c.side].client, { t: 'peer_stacks', name: m.name.slice(0, 16), n: Math.max(0, Math.min(999, Math.round(m.n))) });
      }
      case 'shield': {
        const match = c.match;
        if (!match || match.state !== 'fight' || !num(m.amount) || !num(m.seconds)) return;
        return send(match.players[1 - c.side].client, {
          t: 'peer_shield', amount: Math.max(0, Math.min(SHIELD_MAX, Math.round(m.amount))),
          seconds: Math.max(0, Math.min(SHIELD_MAX_S, m.seconds)), color: color(m.color),
        });
      }
      case 'hazard': {
        // An arena hazard hit this client's hero: it decides where its hero stood, as with spells. It can KO; nobody
        // gets credit. The other screen draws it as a hit (id 0 names no cast).
        const match = c.match;
        if (!match || match.boss || match.state !== 'fight' || !num(m.damage) || m.damage <= 0) return;
        const me = match.players[c.side];
        const now = Date.now();
        if (now - (me.hazardAt ?? 0) < HAZARD_GAP_MS) return;
        me.hazardAt = now;
        const damage = Math.min(HAZARD_MAX, Math.round(m.damage));
        me.hp = Math.max(0, me.hp - damage);
        send(match.players[1 - c.side].client, { t: 'peer_hit', id: 0, damage, soaked: 0, hp: me.hp, color: color(m.color) });
        send(c, { t: 'hp', hp: me.hp });
        if (me.hp <= 0) endRound(match, 1 - c.side, 'ko');
        return;
      }
      case 'took_hit': {
        const match = c.match;
        if (!match || match.boss || match.state !== 'fight' || !num(m.damage)) return;
        const me = match.players[c.side];
        // Only a cast the other side really made, not long ago.
        const foe = match.players[1 - c.side];
        const castAt = foe.recent.get(m.id);
        if (castAt === undefined || Date.now() - castAt > HIT_WINDOW_MS) return;
        // `damage` is what got past the hero's own shield; `soaked` what the shield took (only shown on the other side).
        const damage = Math.max(0, Math.min(foe.attacks.has(m.id) ? ATTACK_MAX : SPELL_HIT_MAX, Math.round(m.damage)));
        const soaked = num(m.soaked) ? Math.max(0, Math.min(SHIELD_MAX, Math.round(m.soaked))) : 0;
        // `blocked`: the victim's passive swallowed the hit whole (ice block, void maw): no damage gets through.
        const blocked = m.blocked === true;
        if (!blocked) me.hp = Math.max(0, me.hp - damage);
        foe.hits++;
        send(foe.client, { t: 'peer_hit', id: m.id, damage: blocked ? 0 : damage, soaked, hp: me.hp, color: color(m.color), blocked });
        send(c, { t: 'hp', hp: me.hp });
        if (me.hp <= 0) endRound(match, 1 - c.side, 'ko');
        return;
      }
      case 'dodged': {
        const match = c.match;
        if (!match || match.state !== 'fight') return;
        match.players[c.side].dodges++;
        return send(match.players[1 - c.side].client, { t: 'peer_dodged', id: m.id });
      }
      case 'round_pick': {
        // From the round's loser: `hero` swaps, `arena` chooses the next arena, neither keeps things as they are. The
        // hub does not know the arenas: an id no client knows falls back to the seeded arena on both screens.
        const match = c.match, pick = match?.pick;
        if (!match || match.state !== 'break' || !pick || pick.side !== c.side) return;
        const me = match.players[c.side], foe = match.players[1 - c.side];
        if (m.hero !== undefined && m.arena !== undefined) return fail(c, 'Pick one: a hero or an arena');
        if (m.hero !== undefined) {
          if (!validHero(m.hero)) return;
          if (m.hero === foe.hero) return fail(c, `${m.hero} is taken in this match: pick another hero`);
          if (m.hero !== me.hero) {
            me.hero = m.hero;
            match.picked = { by: me.name, hero: m.hero };
          }
        } else if (m.arena !== undefined) {
          if (typeof m.arena !== 'string' || !ARENA_ID_RE.test(m.arena)) return;
          match.picked = { by: me.name, arena: m.arena };
        }
        match.pick = null;
        clearTimeout(match.timer);
        match.timer = setTimeout(pick.next, Math.max(0, BREAK_MS - (Date.now() - pick.at)));
        return;
      }
      case 'match_leave': {
        const match = c.match;
        if (!match) return;
        if (match.boss) raidLeave(match, c.side);
        else if (match.state !== 'over') endMatch(match, 1 - c.side, 'forfeit');
        c.match = null;
        return;
      }
      // --- the raid: from the screen that runs the boss's brain ---------------------------------------------------
      case 'boss_cast': {
        const boss = raidOf(c);
        if (!boss || boss.brain !== c.side || typeof m.move !== 'string' || !MOVE_RE.test(m.move)) return;
        if (![m.id, m.step, m.x, m.z, m.fx, m.fz, m.dir, m.seed].every(num) || (m.target !== 0 && m.target !== 1)) return;
        return send(/** @type {Match} */ (c.match).players[1 - c.side].client, {
          t: 'boss_cast', id: m.id, move: m.move, step: m.step, x: m.x, z: m.z, fx: m.fx, fz: m.fz, dir: m.dir, seed: m.seed, target: m.target, alone: m.alone === true,
        });
      }
      case 'boss_move': {
        const boss = raidOf(c);
        if (!boss || boss.brain !== c.side || !num(m.x) || !num(m.z)) return;
        const p = clampRing(m.x, m.z, RAID_BOSSES[boss.id].ring);
        return send(/** @type {Match} */ (c.match).players[1 - c.side].client, { t: 'boss_move', x: p.x, z: p.z, yaw: num(m.yaw) ? m.yaw : 0, ts: num(m.ts) ? m.ts : undefined });
      }
      // --- the raid: from either screen -------------------------------------------------------------------------------
      case 'boss_damage': {
        const boss = raidOf(c), match = c.match;
        if (!boss || !match || !num(m.amount) || m.amount <= 0) return;
        const me = match.players[c.side], now = Date.now();
        // Spells hit hard, but one screen can only do so much in a second.
        if (now - (me.dmgAt ?? 0) >= 1000) { me.dmgAt = now; me.dmgSum = 0; }
        const amount = Math.min(m.amount, BOSS_HIT_MAX, BOSS_SECOND_MAX - (me.dmgSum ?? 0));
        if (amount <= 0) return;
        me.dmgSum = (me.dmgSum ?? 0) + amount;
        boss.hp = Math.max(0, boss.hp - amount);
        const phases = RAID_BOSSES[boss.id].phases;
        while (boss.phase < phases.length && boss.hp / boss.max <= phases[boss.phase]) {
          boss.phase++;
          for (const p of match.players) send(p.client, { t: 'boss_phase', phase: boss.phase });
        }
        sendBossHp(match);
        if (boss.hp <= 0) raidEnd(match, 'cleared');
        return;
      }
      case 'boss_stagger': {
        const boss = raidOf(c), match = c.match;
        if (!boss || !match || !num(m.points) || m.points <= 0 || Date.now() < boss.kneelUntil) return;
        const b = RAID_BOSSES[boss.id];
        boss.gauge += Math.min(m.points, STAGGER_MAX);
        if (boss.gauge >= b.staggerMax) {
          boss.gauge = 0;
          boss.kneelUntil = Date.now() + b.kneel * 1000;
          for (const p of match.players) send(p.client, { t: 'boss_kneel', seconds: b.kneel });
        }
        for (const p of match.players) send(p.client, { t: 'boss_gauge', value: boss.gauge });
        return;
      }
      case 'boss_stood': {
        const boss = raidOf(c), match = c.match;
        if (!boss || !match || !num(m.id) || !num(m.part)) return;
        const key = `${m.id}:${m.part}`;
        // A report later than the wait finds the zone already counted.
        if (boss.settled.has(key)) return;
        let s = boss.stood.get(key);
        if (!s) {
          s = { count: 0, from: new Set(), timer: setTimeout(() => stoodDone(match, m.id, m.part), STOOD_WAIT_MS) };
          boss.stood.set(key, s);
        }
        if (s.from.has(c.side)) return;
        s.from.add(c.side);
        if (m.inside === true) s.count++;
        if (s.from.size >= match.players.filter((p) => !p.down && !p.left).length) stoodDone(match, m.id, m.part);
        return;
      }
      case 'boss_wall': {
        // A wall that saved a hero falls on both screens, once.
        const boss = raidOf(c), match = c.match;
        if (!boss || !match || !num(m.index) || boss.walls.has(m.index)) return;
        boss.walls.add(m.index);
        for (const p of match.players) send(p.client, { t: 'boss_wall', index: m.index });
        return;
      }
      case 'raid_hp': {
        const match = c.match;
        if (!raidOf(c) || !match || !num(m.hp)) return;
        const me = match.players[c.side];
        me.hp = Math.max(0, Math.min(me.max, Math.round(m.hp)));
        return send(match.players[1 - c.side].client, { t: 'partner_hp', hp: me.hp, max: me.max });
      }
      case 'hero_down': {
        const match = c.match;
        if (!raidOf(c) || !match) return;
        const me = match.players[c.side];
        if (me.down) return;
        me.down = true;
        me.hp = 0;
        for (const p of match.players) send(p.client, { t: 'peer_down', side: c.side });
        if (match.players.every((p) => p.down || p.left)) raidEnd(match, 'lost');
        return;
      }
      case 'revive': {
        // From the partner, who stood by the fallen hero long enough. Twice a fight at most, per hero.
        const boss = raidOf(c), match = c.match;
        if (!boss || !match) return;
        const side = 1 - c.side, target = match.players[side];
        if (!target.down || target.left || match.players[c.side].down || boss.revives[side] >= REVIVES) return;
        boss.revives[side]++;
        target.down = false;
        target.hp = Math.ceil(target.max / 2);
        for (const p of match.players) send(p.client, { t: 'revived', side, hp: target.hp, left: REVIVES - boss.revives[side] });
        return;
      }
    }
  }

  /** The raid `c` is fighting right now, if any. @param {Client} c */
  function raidOf(c) {
    const match = c.match;
    return match && match.state === 'fight' && Date.now() >= match.fightAt ? match.boss ?? null : null;
  }

  /** @param {Client} c @param {string} name @param {string} [token] */
  function signIn(c, name, token) {
    // One connection per account: a second sign-in replaces the first.
    for (const other of clients) {
      if (other !== c && other.name === name) {
        drop(other, 'disconnect');
        other.name = null;
        send(other, { t: 'logged_out', reason: 'Signed in from another tab' });
      }
    }
    if (!token) {
      token = randomHex(24);
      sessions.set(token, name);
    }
    c.name = name;
    send(c, { t: 'session', token, profile: accounts.profile(/** @type {any} */ (accounts.get(name))) });
    send(c, lobbyList());
    log(`${name} signed in`);
  }

  /** @param {Client} c */
  function sendProfile(c) {
    const a = c.name ? accounts.get(c.name) : undefined;
    if (a) send(c, { t: 'profile', profile: accounts.profile(a) });
  }

  /** True (and tells the client) when it is already in a lobby, the queue or a match. @param {Client} c */
  function busy(c) {
    if (c.match && c.match.state !== 'over') { fail(c, 'You are in a match'); return true; }
    if (c.lobby) { fail(c, 'Leave your lobby first'); return true; }
    if (c.queued) { fail(c, 'Leave the queue first'); return true; }
    return false;
  }

  /** Leaves whatever the client is in (lobby, queue, a running match counts as a loss). @param {Client} c @param {string} reason */
  function drop(c, reason) {
    leaveLobby(c);
    leaveQueue(c);
    const match = c.match;
    if (match?.boss) raidLeave(match, c.side);
    else if (match && match.state !== 'over') endMatch(match, 1 - c.side, reason);
    c.match = null;
  }

  // --- lobbies --------------------------------------------------------------------------------------------

  function lobbyList() {
    const list = [...lobbies.values()].filter((l) => l.seats.length < 2 && !l.raid).map((l) => ({
      code: l.code, host: l.seats[0].client.name, hostHero: l.seats[0].hero,
    }));
    return { t: 'lobbies', list };
  }

  function broadcastLobbies() {
    const msg = lobbyList();
    for (const c of clients) if (c.name && !c.match) send(c, msg);
  }

  /** @param {Lobby} lobby */
  function lobbyChanged(lobby) {
    const state = {
      code: lobby.code,
      raid: lobby.raid ?? null,
      seats: lobby.seats.map((s) => ({ name: s.client.name, hero: s.hero, ready: s.ready })),
    };
    for (const s of lobby.seats) send(s.client, { t: 'lobby', lobby: state, you: lobby.seats.indexOf(s) });
    broadcastLobbies();
  }

  /** @param {Client} c */
  function leaveLobby(c) {
    const lobby = c.lobby;
    if (!lobby) return;
    c.lobby = null;
    lobby.seats = lobby.seats.filter((s) => s.client !== c);
    send(c, { t: 'lobby', lobby: null });
    if (!lobby.seats.length) lobbies.delete(lobby.code);
    else {
      for (const s of lobby.seats) s.ready = false;
      lobbyChanged(lobby);
    }
    broadcastLobbies();
  }

  // --- queue ----------------------------------------------------------------------------------------------

  /** @param {Client} c */
  function sendQueue(c) {
    send(c, { t: 'queue', on: !!c.queued, since: c.queued?.since ?? 0, size: queue.length });
  }

  /** @param {Client} c */
  function leaveQueue(c) {
    const i = queue.indexOf(c);
    if (i >= 0) queue.splice(i, 1);
    c.queued = null;
    for (const q of queue) sendQueue(q);
  }

  /** Pairs the two longest-waiting players with different heroes (one effect per spell label on the client). */
  function pair() {
    for (let i = 0; i < queue.length; i++) {
      for (let j = i + 1; j < queue.length; j++) {
        const a = queue[i], b = queue[j];
        if (a.queued?.hero === b.queued?.hero) continue;
        const seats = [a, b].map((c) => ({ client: c, hero: /** @type {string} */ (c.queued?.hero) }));
        for (const c of [a, b]) { queue.splice(queue.indexOf(c), 1); c.queued = null; sendQueue(c); }
        startMatch(seats);
        return pair();
      }
    }
    for (const q of queue) sendQueue(q);
  }

  // --- matches --------------------------------------------------------------------------------------------

  /** @param {{ client: Client, hero: string }[]} seats */
  function startMatch(seats) {
    /** @type {Match} */
    const match = {
      id: randomHex(6),
      players: seats.map((s) => ({
        client: s.client, name: /** @type {string} */ (s.client.name), hero: s.hero, first: s.hero, max: HP, hp: HP, loaded: false,
        casts: 0, hits: 0, dodges: 0, recent: new Map(), lastSlot: [-Infinity, -Infinity, -Infinity, -Infinity],
        attacks: new Set(), lastAttack: -Infinity, heals: [],
      })),
      state: 'loading', created: Date.now(), startedAt: 0, fightAt: 0, round: 1, score: [0, 0], timer: null, pick: null, picked: null,
    };
    match.players.forEach((p, side) => {
      p.client.match = match;
      p.client.side = side;
      const foe = match.players[1 - side];
      send(p.client, { t: 'match_start', id: match.id, side, hp: HP, you: { name: p.name, hero: p.hero }, foe: { name: foe.name, hero: foe.hero } });
    });
    match.timer = setTimeout(() => { if (match.state === 'loading') fight(match); }, LOAD_TIMEOUT);
    log(`match ${match.id}: ${match.players.map((p) => `${p.name} (${p.hero})`).join(' vs ')}`);
    broadcastLobbies();
  }

  /** Both sides are loaded (or the wait ran out): the countdown, then the round. @param {Match} match */
  function fight(match) {
    clearTimeout(match.timer);
    match.state = 'fight';
    match.fightAt = Date.now() + COUNTDOWN * 1000;
    if (!match.startedAt) match.startedAt = match.fightAt;
    for (const p of match.players) send(p.client, { t: 'match_fight', countdown: COUNTDOWN, round: match.round });
  }

  /**
   * A round is over: the winner scores (`winnerSide` -1: a tie, nobody does). Two wins end the match; otherwise
   * `round_end`, a break (with `loserPicks` on, the loser may pick), then `round_start` and the same load → countdown
   * as the first round.
   * @param {Match} match @param {number} winnerSide @param {string} reason
   */
  function endRound(match, winnerSide, reason) {
    if (match.state !== 'fight') return;
    clearTimeout(match.timer);
    if (winnerSide >= 0) match.score[winnerSide]++;
    if (winnerSide >= 0 && match.score[winnerSide] >= ROUNDS_TO_WIN) return endMatch(match, winnerSide, reason);
    match.state = 'break';
    const pickSide = loserPicks && winnerSide >= 0 ? 1 - winnerSide : -1;
    const wait = pickSide >= 0 ? PICK_MS : BREAK_MS;
    match.players.forEach((p, side) => send(p.client, {
      t: 'round_end', round: match.round, result: winnerSide < 0 ? 'draw' : side === winnerSide ? 'win' : 'loss', reason,
      winner: winnerSide < 0 ? null : match.players[winnerSide].name, score: [match.score[side], match.score[1 - side]],
      hp: match.players.map((x) => x.hp), next: wait / 1000,
      pick: pickSide >= 0 ? { you: side === pickSide, seconds: PICK_MS / 1000 } : null,
    }));
    log(`match ${match.id} round ${match.round}: ${winnerSide < 0 ? 'tie' : match.players[winnerSide].name} (${reason}), ${match.score.join('-')}`);
    const next = () => nextRound(match, winnerSide);
    match.pick = pickSide >= 0 ? { side: pickSide, at: Date.now(), next } : null;
    match.timer = setTimeout(next, wait);
  }

  /** The break is over: `round_start` with the heroes as they now stand and the pick, if one was made. @param {Match} match @param {number} winnerSide */
  function nextRound(match, winnerSide) {
    if (match.state !== 'break') return;
    if (winnerSide >= 0) match.round++;
    match.state = 'loading';
    const picked = match.picked;
    match.pick = null;
    match.picked = null;
    match.players.forEach((p, side) => {
      p.loaded = false;
      p.hp = p.max;
      p.recent.clear();
      p.lastSlot.fill(-Infinity);
      p.rRecast = false;
      p.attacks.clear();
      p.lastAttack = -Infinity;
      p.heals = [];
      send(p.client, {
        t: 'round_start', round: match.round, score: [match.score[side], match.score[1 - side]],
        you: p.hero, foe: match.players[1 - side].hero, picked,
      });
    });
    match.timer = setTimeout(() => { if (match.state === 'loading') fight(match); }, LOAD_TIMEOUT);
  }

  /** @param {Match} match @param {number} winnerSide @param {string} reason */
  function endMatch(match, winnerSide, reason) {
    if (match.state === 'over') return;
    clearTimeout(match.timer);
    match.state = 'over';
    const seconds = Math.max(0, Math.round((Date.now() - (match.startedAt || match.created)) / 100) / 10);
    const at = new Date().toISOString();
    match.players.forEach((p, side) => {
      const foe = match.players[1 - side];
      accounts.record(p.name, {
        // The match counts for the hero the player finished on; `from` is the one they started on, after a swap.
        at, hero: p.hero, from: p.first !== p.hero ? p.first : undefined, foe: foe.name, foeHero: foe.hero, result: side === winnerSide ? 'win' : 'loss', seconds, reason,
        rounds: [match.score[side], match.score[1 - side]],
      });
    });
    const winner = match.players[winnerSide];
    match.players.forEach((p, side) => {
      const a = accounts.get(p.name);
      send(p.client, {
        t: 'match_end', id: match.id, result: side === winnerSide ? 'win' : 'loss', winner: winner.name, reason, seconds,
        score: [match.score[side], match.score[1 - side]],
        hp: match.players.map((x) => x.hp), stats: { casts: p.casts, hits: p.hits, dodges: p.dodges },
        profile: a ? accounts.profile(a) : null,
      });
      p.client.match = null;
    });
    log(`match ${match.id} over: ${winner.name} wins ${match.score.join('-')} (${reason}, ${seconds} s)`);
  }

  // --- raids ----------------------------------------------------------------------------------------------------

  /** Two players against a boss. Alone is always offline: a raid here has two seats from start to end. @param {{ client: Client, hero: string }[]} seats @param {string} id */
  function startRaid(seats, id) {
    const b = RAID_BOSSES[id];
    /** @type {Match} */
    const match = {
      id: randomHex(6),
      players: seats.map((s) => ({
        client: s.client, name: /** @type {string} */ (s.client.name), hero: s.hero, first: s.hero, max: HP, hp: HP, loaded: false,
        casts: 0, hits: 0, dodges: 0, recent: new Map(), lastSlot: [-Infinity, -Infinity, -Infinity, -Infinity],
        attacks: new Set(), lastAttack: -Infinity, heals: [], down: false, left: false,
      })),
      state: 'loading', created: Date.now(), startedAt: 0, fightAt: 0, round: 1, score: [0, 0], timer: null, pick: null, picked: null,
      boss: { id, hp: b.hp.duo, max: b.hp.duo, phase: 0, gauge: 0, kneelUntil: 0, brain: 0, revives: [0, 0], stood: new Map(), settled: new Set(), walls: new Set(), hpTimer: null, hpAt: 0 },
    };
    match.players.forEach((p, side) => {
      p.client.match = match;
      p.client.side = side;
      const other = match.players[1 - side];
      send(p.client, { t: 'raid_start', id: match.id, side, boss: id, hp: b.hp.duo, you: { name: p.name, hero: p.hero }, partner: { name: other.name, hero: other.hero } });
    });
    match.timer = setTimeout(() => { if (match.state === 'loading') fight(match); }, LOAD_TIMEOUT);
    log(`raid ${match.id}: ${match.players.map((p) => `${p.name} (${p.hero})`).join(' and ')} against ${id}`);
    broadcastLobbies();
  }

  /** The boss's HP to both, at most ten times a second, and always the last one. @param {Match} match */
  function sendBossHp(match) {
    const boss = /** @type {NonNullable<Match['boss']>} */ (match.boss);
    if (boss.hpTimer) return;
    const go = () => {
      boss.hpTimer = null;
      boss.hpAt = Date.now();
      for (const p of match.players) send(p.client, { t: 'boss_hp', hp: boss.hp });
    };
    const wait = BOSS_HP_GAP_MS - (Date.now() - boss.hpAt);
    if (wait <= 0) go();
    else boss.hpTimer = setTimeout(go, wait);
  }

  /** A gold zone is decided: how many heroes stood in it. @param {Match} match @param {number} id @param {number} part */
  function stoodDone(match, id, part) {
    const boss = match.boss, key = `${id}:${part}`, s = boss?.stood.get(key);
    if (!boss || !s) return;
    clearTimeout(s.timer);
    boss.stood.delete(key);
    boss.settled.add(key);
    if (match.state !== 'fight') return;
    for (const p of match.players) send(p.client, { t: 'boss_stood', id, part, count: s.count });
  }

  /**
   * Someone leaves a raid (a closed socket and a reload count too: there is no way back into a running fight). The other
   * hero fights on with the boss as it stands, and takes over its brain if the leaver ran it.
   * @param {Match} match @param {number} side
   */
  function raidLeave(match, side) {
    const me = match.players[side], boss = match.boss;
    if (!boss || me.left) return;
    if (match.state !== 'over') {
      me.left = true;
      accounts.recordRaid(me.name, { at: new Date().toISOString(), hero: me.hero, partner: match.players[1 - side].name, boss: boss.id, result: 'left', seconds: raidSeconds(match) });
    }
    me.client = GONE;
    if (match.state === 'over') return;
    const other = match.players[1 - side];
    // Nobody left who can fight: it is over. Someone waiting on a load goes on alone.
    if (other.left || other.down) return raidEnd(match, 'lost');
    if (match.state === 'loading' && match.players.every((p) => p.loaded || p.left)) fight(match);
    send(other.client, { t: 'partner_left' });
    if (boss.brain === side) {
      boss.brain = 1 - side;
      send(other.client, { t: 'boss_brain' });
    }
  }

  /** @param {Match} match */
  function raidSeconds(match) {
    return Math.max(0, Math.round((Date.now() - (match.startedAt || match.created)) / 100) / 10);
  }

  /** @param {Match} match @param {'cleared' | 'lost'} result */
  function raidEnd(match, result) {
    const boss = match.boss;
    if (!boss || match.state === 'over') return;
    clearTimeout(match.timer);
    clearTimeout(boss.hpTimer);
    for (const s of boss.stood.values()) clearTimeout(s.timer);
    boss.stood.clear();
    match.state = 'over';
    const seconds = raidSeconds(match), at = new Date().toISOString();
    match.players.forEach((p, side) => {
      if (p.left) return;
      accounts.recordRaid(p.name, { at, hero: p.hero, partner: match.players[1 - side].name, boss: boss.id, result, seconds });
      const a = accounts.get(p.name);
      send(p.client, { t: 'raid_end', result, seconds, bossHp: boss.hp, bossMax: boss.max, profile: a ? accounts.profile(a) : null });
      p.client.match = null;
    });
    log(`raid ${match.id} over: ${result} (${seconds} s)`);
  }

  /** @param {Client} c */
  function player(c) {
    return c.match?.players[c.side];
  }

  return {
    connect,
    /** For tests and the console: what the hub holds right now. */
    state: () => ({ clients: clients.size, lobbies: lobbies.size, queue: queue.length }),
  };
}

/**
 * A cast's mods from a client (src/traits `CastMods`), clamped: power, one status, one debuff, extra knock.
 * @param {any} v
 */
function mods(v) {
  if (!v || typeof v !== 'object') return undefined;
  /** @type {any} */
  const out = { power: num(v.power) ? Math.max(POWER_MIN, Math.min(POWER_MAX, v.power)) : 1 };
  if (v.status && STATUS_KINDS.includes(v.status.kind) && num(v.status.seconds)) {
    out.status = { kind: v.status.kind, seconds: Math.max(0, Math.min(STATUS_MAX_S, v.status.seconds)) };
  }
  if (v.debuff && BUFF_KINDS.includes(v.debuff.kind) && num(v.debuff.amount) && num(v.debuff.seconds)) {
    out.debuff = { kind: v.debuff.kind, amount: Math.max(0, Math.min(BUFF_MAX, v.debuff.amount)), seconds: Math.max(0, Math.min(BUFF_MAX_S, v.debuff.seconds)) };
  }
  if (num(v.knock)) out.knock = Math.max(0, Math.min(6, v.knock));
  return out;
}

/** A css colour from a client, or undefined. @param {unknown} v */
function color(v) {
  return typeof v === 'string' ? v.slice(0, 16) : undefined;
}

/** @param {unknown} v @returns {v is number} */
function num(v) {
  return typeof v === 'number' && Number.isFinite(v);
}

/** @param {unknown} h */
function validHero(h) {
  return typeof h === 'string' && HERO_RE.test(h);
}

/** A position kept inside the ring (a raid's room is wider). @param {number} x @param {number} z @param {number} [ring] */
function clampRing(x, z, ring = RING.r) {
  const dx = x - RING.x, dz = z - RING.z, d = Math.hypot(dx, dz), r = ring - 0.5;
  return d > r ? { x: RING.x + (dx / d) * r, z: RING.z + (dz / d) * r } : { x, z };
}
