// The duel game's server logic, independent of the runtime: sessions, lobbies, the matchmaking queue and the
// relay/referee for 1v1 matches. Hosts feed it connections: game-server.mjs (Node + `ws`) and worker/index.mjs (a
// Cloudflare Durable Object). Messages are JSON `{ t: type, ...fields }`; the table is in
// docs/architecture/multiplayer.md and the client is src/net/. A raid is for a party of up to 40
// (pipeline/designs/raid-party.md): its players are told apart by `side`, their seat when it started.
//
// Authority: the hub owns sessions, lobbies, pairing, match start, the rounds, HP, the winner and the stats. Each
// client owns its own hero's movement and casts and reports the hits it takes (it knows where it stood when a spell
// landed, which is what makes walking out of the red a dodge). The hub only accepts hits from casts it relayed and
// limits how fast a slot can be cast. Fine for friends; not cheat-proof.
import { hex } from './accounts.mjs';
import {
  PROTOCOL, RAID_BOSSES, RAID_HALL_RING, RAID_PARTY_MAX, RAID_REWARDS, RAID_RUN, RAID_SHRINE_S, RAID_TWIN, RELOAD_TEXT, raidBand, raidHp, raidScale, raidStaggerMax, raidRing, raidTwin,
} from './protocol.mjs';

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
// The Raid. A party of up to 40, each owning their own hero's HP and telling the others (a cheat there only helps all). The boss's
// HP, phase and stagger live here, because all must agree on them. One screen runs the boss's brain and the hub relays what
// it decides. Damage from one screen is capped by the hit and by the second; everyone hits at most this hard. There is no cap
// on what the whole party takes off the boss in a second: it is these two times the players, so it grows with the party.
const BOSS_HIT_MAX = 600;
const BOSS_SECOND_MAX = 1400;
/** What one hero's hit can lay on the boss for the other screen, and the most it can be: the game's own caps on a buff. */
const BOSS_DEBUFFS = ['slow', 'weaken', 'vulnerable'];
/** Far more spots and rewards than any fight has: a client making them up gets nothing past this. */
const TAKEN_MAX = 400;
const DEBUFF_MAX = 0.5;
const DEBUFF_MAX_S = 6;
const BOSS_HP_GAP_MS = 100;
const STAGGER_MAX = 60;
const REVIVES = 2;
// How long a gold zone waits for the other screen's report before it counts who it has (s).
const STOOD_WAIT_MS = 1500;
// The run: how long the pick lasts (a client takes the first when time runs out, and the hub waits a little longer), how long a
// fallen boss stays on screen, and how long the clear screen waits before the run ends there.
const OFFER_S = 30;
/** How long the gate waits for a hero to walk in, once all have picked (s). */
const GATE_S = 15;
const OFFER_GRACE_MS = 2000;
const WON_PAUSE_MS = 2200;
const CLEARED_WAIT_S = 30;
const STOOD_MAX = 400;
const MOVE_RE = /^[a-z]{1,16}$/;
/** A party of more than two gets everyone's walk in one message, this often (ms): 39 messages for each step would be too many. */
const MOVES_MS = 100;
/**
 * The boss's brain moves to another screen when nothing at all came from its own for this long in a fight (ms), and how often the
 * hub looks. One phone in a pocket must not freeze the boss for 39 others.
 */
const BRAIN_QUIET_MS = 4000;
const BRAIN_CHECK_MS = 500;
/** Stands in for the client of a player who left: nothing is sent there. */
const GONE = /** @type {any} */ ({ closed: true, send() {} });

/**
 * @typedef {{ send: (text: string) => void, name: string | null, lobby: Lobby | null, queued: { hero: string, since: number } | null,
 *   match: Match | null, side: number, chain: Promise<void>, closed: boolean, seenAt: number }} Client
 * @typedef {{ code: string, seats: { client: Client, hero: string | null, ready: boolean }[], raid: string | null, open: boolean, max: number }} Lobby
 * @typedef {{ client: Client, name: string, hero: string, first: string, max: number, hp: number, loaded: boolean, casts: number, hits: number,
 *   dodges: number, recent: Map<number, number>, lastSlot: number[], attacks: Set<number>, lastAttack: number,
 *   heals: { at: number, amount: number }[], rRecast?: boolean, hazardAt?: number, down?: boolean, left?: boolean, dmgAt?: number, dmgSum?: number,
 *   move?: (number | null)[] | null }} Player
 *   `move`: in a party of more than two, this hero's newest walk that the others have not been sent yet.
 * @typedef {{ id: string, band: number, hp: number, max: number, staggerMax: number, phase: number, gauge: number, kneelUntil: number, brain: number,
 *   brainAt: number, revives: number[], stood: Map<string, { id: number, part: number, count: number, from: Set<number>, timer: any, half: number }>,
 *   settled: Set<string>, walls: Set<number>, taken: Set<string>, hpTimer: any, hpAt: number, twin?: RaidTwin }} RaidBoss
 *   `band`: the party size this fight is tuned for, from who was there when it started. `brainAt`: when the brain last changed screens.
 * @typedef {{ hp: number, max: number, staggerMax: number, phase: number, gauge: number, kneelUntil: number, brain: number, brainAt: number,
 *   hpTimer: any, hpAt: number, dead?: boolean }} RaidPool
 *   What is kept per boss. A boss fought alone is its own pool; Twin Flames has two (`RaidTwin.pools`).
 * @typedef {{ pools: [RaidPool, RaidPool], half: number[], fury: number }} RaidTwin
 *   Twin Flames: Ash's pool and Ember's, which half of the room each player is in (by side: 0 west with Ash, 1 east with Ember, -1
 *   gone before the fight), and which of the two is furious now (-1: neither). The boss's own `hp` and `max` are the two together.
 * @typedef {{ id: string, players: Player[], state: 'offer' | 'gate' | 'loading' | 'fight' | 'break' | 'cleared' | 'over', created: number, startedAt: number,
 *   fightAt: number, round: number, score: number[], timer: any,
 *   pick: { side: number, at: number, next: () => void } | null,
 *   picked: { by: string, hero?: string, arena?: string } | null, boss?: RaidBoss, ticker?: any, watch?: any,
 *   run?: { stage: number, tier: number, beaten: number, seconds: number, picks: Set<number>, enters: Set<number>, goes: Set<number>,
 *     sides?: Map<number, string>, sided?: boolean } }} Match
 *   `ticker`: a party's walks, batched. `watch`: the look at whether the brain's screen is still there.
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
    const c = { send: sendText, name: null, lobby: null, queued: null, match: null, side: 0, chain: Promise.resolve(), closed: false, seenAt: Date.now() };
    clients.add(c);
    return {
      /** @param {string} data */
      message(data) {
        let msg;
        try { msg = JSON.parse(String(data)); } catch { return; }
        if (!msg || typeof msg.t !== 'string') return;
        // Any message at all says this screen is still there (the raid's brain is taken from one that went quiet).
        c.seenAt = Date.now();
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

  /** A message already written out. @param {Client} c @param {string} text */
  function sendText(c, text) {
    if (c.closed) return;
    try { c.send(text); } catch { /* the host closes it */ }
  }

  /** One message to everyone in a match, written out once. @param {Match} match @param {any} msg @param {number} [except] a side that is not told */
  function tell(match, msg, except = -1) {
    const text = JSON.stringify(msg);
    for (let side = 0; side < match.players.length; side++) if (side !== except) sendText(match.players[side].client, text);
  }

  /**
   * What a hero did, to whoever else is in the match: the foe in a duel, as it always was. In a raid everyone else, and the
   * message says whose hero it was (`side`).
   * @param {Client} c @param {Match} match @param {any} msg
   */
  function relay(c, match, msg) {
    if (!match.boss) return send(match.players[1 - c.side].client, msg);
    msg.side = c.side;
    tell(match, msg, c.side);
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
        // A raid room is a lobby too, joined by its code, with seats for a whole party. It is listed only when its host opened it
        // to everyone (`open`); otherwise a raid is between friends.
        const raid = typeof m.raid === 'string' && Object.hasOwn(RAID_BOSSES, m.raid) ? m.raid : null;
        /** @type {Lobby} */
        const lobby = { code, seats: [{ client: c, hero: null, ready: false }], raid, open: !!raid && m.open === true, max: raid ? RAID_PARTY_MAX : 2 };
        lobbies.set(code, lobby);
        c.lobby = lobby;
        return lobbyChanged(lobby);
      }
      case 'lobby_join': {
        if (busy(c)) return;
        const lobby = lobbies.get(String(m.code ?? '').toUpperCase().trim());
        if (!lobby) return fail(c, 'No lobby with that code');
        if (lobby.seats.length >= lobby.max) return fail(c, 'That lobby is full');
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
          // Two heroes differ, in a duel and in a raid for two. A bigger party may take the same hero twice (raid-party.md).
          const other = lobby.seats.length <= 2 ? lobby.seats.find((s) => s !== seat) : undefined;
          if (other?.hero === seat.hero) return fail(c, `${seat.hero} is taken in this lobby: pick another hero`);
        }
        seat.ready = !!m.ready;
        lobbyChanged(lobby);
        // Two seats, both ready: it starts, a duel and a raid for two alike. A bigger party waits for its host (`raid_go`).
        if (lobby.seats.length === 2 && lobby.seats.every((s) => s.ready)) startLobby(lobby);
        return;
      }
      case 'raid_go': {
        // The host starts the raid with whoever is seated, one to forty. Nobody has to be ready, everyone needs a hero.
        const lobby = c.lobby;
        if (!lobby || !lobby.raid) return;
        if (lobby.seats[0].client !== c) return fail(c, 'Only the host starts the raid');
        if (lobby.seats.some((s) => !s.hero)) return fail(c, 'Everyone picks a hero first');
        if (lobby.seats.length === 2 && lobby.seats[0].hero === lobby.seats[1].hero) return fail(c, `${lobby.seats[0].hero} is taken in this lobby: pick another hero`);
        return startLobby(lobby);
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
        if (c.match.players.every((x) => x.loaded || x.left)) fight(c.match);
        return;
      }
      case 'move': {
        const match = c.match;
        if (!match || match.state === 'over' || !num(m.x) || !num(m.z)) return;
        const hall = match.state === 'offer' || match.state === 'gate';
        const p = clampRing(m.x, m.z, hall ? RAID_HALL_RING : match.boss ? raidRing(match.boss.id, match.boss.band) : RING.r);
        const yaw = num(m.yaw) ? m.yaw : 0, ts = num(m.ts) ? m.ts : undefined, r = num(m.r) ? Math.max(0, Math.min(1000, m.r)) : undefined;
        if (match.ticker) {
          // A party: only this hero's newest walk is kept, and goes out with everyone's in the next batch (`partyMoves`).
          // To the millimetre, as a client sends it: a clamped spot would be a long number, forty times in every batch.
          const walk = [c.side, mm(p.x), mm(p.z), mm(yaw), ts ?? null];
          if (r !== undefined) walk.push(r);
          match.players[c.side].move = walk;
          return;
        }
        return relay(c, match, { t: 'peer_move', x: p.x, z: p.z, yaw, ts, r });
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
        return relay(c, match, {
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
        return relay(c, match, { t: 'peer_attack', id: m.id, mods: mods(m.mods) });
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
        return relay(c, match, { t: 'peer_heal', amount, hp: me.hp });
      }
      case 'status': {
        const match = c.match;
        if (!match || match.state !== 'fight' || !STATUS_KINDS.includes(m.kind) || !num(m.seconds)) return;
        return relay(c, match, {
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
        return relay(c, match, { t: 'peer_spend', amount, hp: me.hp });
      }
      case 'buff': {
        const match = c.match;
        if (!match || match.state !== 'fight' || !BUFF_KINDS.includes(m.kind) || !num(m.amount) || !num(m.seconds)) return;
        return relay(c, match, {
          t: 'peer_buff', kind: m.kind, amount: Math.max(0, Math.min(BUFF_MAX, m.amount)), seconds: Math.max(0, Math.min(BUFF_MAX_S, m.seconds)),
        });
      }
      case 'stacks': {
        const match = c.match;
        if (!match || match.state !== 'fight' || typeof m.name !== 'string' || !num(m.n)) return;
        return relay(c, match, { t: 'peer_stacks', name: m.name.slice(0, 16), n: Math.max(0, Math.min(999, Math.round(m.n))) });
      }
      case 'shield': {
        const match = c.match;
        if (!match || match.state !== 'fight' || !num(m.amount) || !num(m.seconds)) return;
        return relay(c, match, {
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
        return relay(c, match, { t: 'peer_dodged', id: m.id });
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
        const boss = raidOf(c), match = c.match, pool = boss && brainPool(boss, c.side, m.which);
        if (!boss || !match || !pool || typeof m.move !== 'string' || !MOVE_RE.test(m.move)) return;
        if (![m.id, m.step, m.x, m.z, m.fx, m.fz, m.dir, m.seed].every(num) || !isSide(match, m.target)) return;
        return tell(match, {
          t: 'boss_cast', id: m.id, move: m.move, step: m.step, x: m.x, z: m.z, fx: m.fx, fz: m.fz, dir: m.dir, seed: m.seed, target: m.target, alone: m.alone === true,
          rim: m.rim === true ? true : undefined, form: m.form === 0 || m.form === 1 ? m.form : undefined, flag: m.flag === true ? true : undefined,
          which: whichOf(boss, pool),
        }, c.side);
      }
      case 'boss_move': {
        const boss = raidOf(c), match = c.match, pool = boss && brainPool(boss, c.side, m.which);
        if (!boss || !match || !pool || !num(m.x) || !num(m.z)) return;
        const p = clampRing(m.x, m.z, raidRing(boss.id, boss.band));
        return tell(match, { t: 'boss_move', x: p.x, z: p.z, yaw: num(m.yaw) ? m.yaw : 0, ts: num(m.ts) ? m.ts : undefined, which: whichOf(boss, pool) }, c.side);
      }
      // --- the raid: from any screen ----------------------------------------------------------------------------------
      case 'boss_damage': {
        const boss = raidOf(c), match = c.match;
        if (!boss || !match || !num(m.amount) || m.amount <= 0) return;
        const me = match.players[c.side], now = Date.now();
        // Spells hit hard, but one screen can only do so much in a second.
        if (now - (me.dmgAt ?? 0) >= 1000) { me.dmgAt = now; me.dmgSum = 0; }
        const amount = Math.min(m.amount, BOSS_HIT_MAX, BOSS_SECOND_MAX - (me.dmgSum ?? 0));
        if (amount <= 0) return;
        // Twin Flames: it comes off the boss this hero can reach. A hit on one that has just fallen is dropped.
        const which = reachOf(boss, c.side, m.which);
        if (which < 0) return;
        me.dmgSum = (me.dmgSum ?? 0) + amount;
        raidDamage(match, amount, which);
        return;
      }
      case 'boss_stagger': {
        const boss = raidOf(c), match = c.match;
        if (!boss || !match || !num(m.points) || m.points <= 0) return;
        const which = reachOf(boss, c.side, m.which);
        if (which < 0 || Date.now() < poolOf(boss, which).kneelUntil) return;
        raidStagger(match, Math.min(m.points, STAGGER_MAX), which);
        return;
      }
      case 'boss_obj': {
        // A hero took a spot: the first report wins, and every screen hears who.
        const boss = raidOf(c), match = c.match;
        if (!boss || !match || !num(m.id) || !num(m.part)) return;
        const key = `${m.id}:${m.part}`;
        if (boss.taken.has(key) || boss.taken.size >= TAKEN_MAX) return;
        boss.taken.add(key);
        tell(match, { t: 'boss_done', id: m.id, part: m.part, side: c.side });
        return;
      }
      case 'boss_reward': {
        // A mechanic was done right, says the screen that runs the brain. What it earns comes from the table, once per cast.
        const boss = raidOf(c), match = c.match, pool = boss && brainPool(boss, c.side, m.which);
        if (!boss || !match || !pool || !num(m.id) || typeof m.key !== 'string') return;
        const table = RAID_REWARDS[boss.id], r = Object.hasOwn(table, m.key) ? table[m.key] : null, key = `reward:${m.id}:${m.key}`;
        if (!r || boss.taken.has(key) || boss.taken.size >= TAKEN_MAX) return;
        boss.taken.add(key);
        const which = whichOf(boss, pool) ?? 0;
        if (r.hp) raidDamage(match, pool.max * r.hp, which);
        if (match.state !== 'fight' || pool.dead) return;
        if (r.kneel) raidKneel(match, which);
        else if (r.stun) raidStun(match, r.stun, which);
        // The gauge is bigger for a bigger party, and so is what a mechanic puts in it (each of two bosses has half of both).
        else if (r.stagger && Date.now() >= pool.kneelUntil) raidStagger(match, r.stagger * raidScale(boss.band) * (boss.twin ? 0.5 : 1), which);
        return;
      }
      case 'boss_stood': {
        const boss = raidOf(c), match = c.match;
        if (!boss || !match || !num(m.id) || !num(m.part)) return;
        const key = `${m.id}:${m.part}`;
        // A report later than the wait finds the zone already counted. A fallen hero stands nowhere, and is not waited for.
        if (boss.settled.has(key) || match.players[c.side].down) return;
        let s = boss.stood.get(key);
        if (!s) {
          // Far more zones than any fight has: a client making them up gets no timers.
          if (boss.stood.size + boss.settled.size >= STOOD_MAX) return;
          // Twin Flames, while the wall stands: a zone is its half's own, and only that half is waited for.
          s = { id: m.id, part: m.part, count: 0, from: new Set(), timer: setTimeout(() => stoodDone(match, m.id, m.part), STOOD_WAIT_MS), half: halfOf(boss, c.side) };
          boss.stood.set(key, s);
        }
        if (s.from.has(c.side) || (s.half >= 0 && halfOf(boss, c.side) !== s.half)) return;
        s.from.add(c.side);
        if (m.inside === true) s.count++;
        stoodSettle(match);
        return;
      }
      case 'boss_wall': {
        // A wall that saved a hero falls on every screen, once.
        const boss = raidOf(c), match = c.match;
        if (!boss || !match || !num(m.index) || boss.walls.has(m.index)) return;
        boss.walls.add(m.index);
        tell(match, { t: 'boss_wall', index: m.index });
        return;
      }
      case 'raid_hp': {
        const match = c.match;
        if (!raidOf(c) || !match || !num(m.hp)) return;
        const me = match.players[c.side];
        me.hp = Math.max(0, Math.min(me.max, Math.round(m.hp)));
        return relay(c, match, { t: 'partner_hp', hp: me.hp, max: me.max });
      }
      case 'hero_down': {
        const match = c.match;
        if (!raidOf(c) || !match) return;
        const me = match.players[c.side];
        if (me.down) return;
        me.down = true;
        me.hp = 0;
        tell(match, { t: 'peer_down', side: c.side });
        // Everyone who is still here is down at once: the run is lost.
        if (match.players.every((p) => p.down || p.left)) raidEnd(match, 'lost');
        else stoodSettle(match);
        return;
      }
      case 'raid_form': {
        // A two-kit hero's other half: the other screens replay its spells.
        const boss = raidOf(c), match = c.match;
        if (!boss || !match || typeof m.alt !== 'boolean') return;
        return relay(c, match, { t: 'peer_form', alt: m.alt });
      }
      case 'boss_add': {
        // A hero hit a boss's add on its own screen: the other screens take it off too. Who killed it is an objective (`boss_obj`).
        const boss = raidOf(c), match = c.match;
        if (!boss || !match || ![m.id, m.part, m.amount].every(num) || m.amount <= 0) return;
        return relay(c, match, { t: 'peer_add', id: m.id, part: m.part, amount: Math.min(m.amount, BOSS_HIT_MAX) });
      }
      case 'boss_debuff': {
        // A hero slowed or debuffed the boss: its own screen has it. The others walk the boss or take its hits.
        const boss = raidOf(c), match = c.match;
        if (!boss || !match || !BOSS_DEBUFFS.includes(m.kind) || !num(m.amount) || !num(m.seconds)) return;
        const which = boss.twin ? reachOf(boss, c.side, m.which) : undefined;
        if (which !== undefined && which < 0) return;
        return relay(c, match, {
          t: 'peer_debuff', kind: m.kind, amount: Math.max(0, Math.min(m.amount, DEBUFF_MAX)), seconds: Math.max(0, Math.min(m.seconds, DEBUFF_MAX_S)), which,
        });
      }
      case 'raid_pick': {
        // The upgrade itself stays on the client that took it: the hub only waits for everyone.
        const match = c.match, run = match?.run;
        if (!match || !run || match.state !== 'offer') return;
        run.picks.add(c.side);
        if (allHere(match, run.picks)) raidGate(match);
        return;
      }
      case 'raid_enter': {
        // This hero walked into the open gate. The fight starts once all are in, or when the gate's time runs out.
        const match = c.match, run = match?.run;
        if (!match || !run || match.state !== 'gate') return;
        run.enters.add(c.side);
        if (allHere(match, run.enters)) raidStage(match);
        return;
      }
      case 'raid_side': {
        // A side door of the hall (src/raid/paths.ts): it opens when more than half of those here walked into the same one (for
        // two that is both), once a hall, never the first. Everyone goes through it then.
        const match = c.match, run = match?.run;
        if (!match || !run || match.state !== 'gate' || run.sided || (run.tier === 1 && run.stage === 0) || (m.door !== 'vault' && m.door !== 'shrine')) return;
        run.sides ??= new Map();
        run.sides.set(c.side, m.door);
        if (doorOpens(match, m.door)) raidSide(match, m.door);
        return;
      }
      case 'raid_next': {
        // After the last boss: this player goes on to the next tier. Stopping is leaving, and the others can go on without.
        const match = c.match, run = match?.run;
        if (!match || !run || match.state !== 'cleared' || m.go !== true) return;
        run.goes.add(c.side);
        if (allHere(match, run.goes)) raidNextTier(match);
        return;
      }
      case 'revive': {
        // From whoever stood by a fallen hero long enough, naming it (`side`; with two it can only be the other). Twice a fight
        // at most, per hero. Of two who get there together, the first report counts.
        const boss = raidOf(c), match = c.match;
        if (!boss || !match) return;
        const side = m.side === undefined && match.players.length === 2 ? 1 - c.side : m.side;
        if (!isSide(match, side) || side === c.side) return;
        const target = match.players[side];
        if (!target.down || target.left || match.players[c.side].down || boss.revives[side] >= REVIVES) return;
        // Nobody reaches through the wall of fire.
        if (halfOf(boss, side) !== halfOf(boss, c.side)) return;
        boss.revives[side]++;
        target.down = false;
        target.hp = Math.ceil(target.max / 2);
        tell(match, { t: 'revived', side, hp: target.hp, left: REVIVES - boss.revives[side], by: c.side });
        return;
      }
    }
  }

  /** A seat of this match, as a client names it. @param {Match} match @param {unknown} v @returns {v is number} */
  const isSide = (match, v) => Number.isInteger(v) && /** @type {number} */ (v) >= 0 && /** @type {number} */ (v) < match.players.length;

  /** Everyone still in the raid is in `set`: the wait for a pick, the gate or the next tier is over. @param {Match} match @param {Set<number>} set */
  const allHere = (match, set) => match.players.every((p, side) => p.left || set.has(side));

  /** More than half of those still in the raid walked into this side door. @param {Match} match @param {string} door */
  function doorOpens(match, door) {
    const sides = match.run?.sides;
    let here = 0, inDoor = 0;
    match.players.forEach((p, side) => {
      if (p.left) return;
      here++;
      if (sides?.get(side) === door) inDoor++;
    });
    return inDoor * 2 > here;
  }

  /** What is kept of boss `which` of a fight: the boss itself, or one of Twin Flames' two. @param {RaidBoss} boss @param {number} which @returns {RaidPool} */
  const poolOf = (boss, which) => (boss.twin ? boss.twin.pools[which] : boss);

  /** Which of two a pool is, for a message; undefined for a boss fought alone, whose messages stay as they were. @param {RaidBoss} boss @param {RaidPool} pool */
  const whichOf = (boss, pool) => (boss.twin ? boss.twin.pools.indexOf(/** @type {any} */ (pool)) : undefined);

  /** Twin Flames: the wall of fire stands while both are alive. @param {RaidBoss} boss */
  const wallUp = (boss) => !!boss.twin && !boss.twin.pools[0].dead && !boss.twin.pools[1].dead;

  /** The half of the room a player is held in by the wall, or -1 when there is no wall. @param {RaidBoss} boss @param {number} side */
  const halfOf = (boss, side) => (wallUp(boss) ? /** @type {RaidTwin} */ (boss.twin).half[side] : -1);

  /**
   * The pool whose brain `side` runs, as its message names it (`which`, for Twin Flames), or null: not this screen's to speak for.
   * @param {RaidBoss} boss @param {number} side @param {unknown} which @returns {RaidPool | null}
   */
  function brainPool(boss, side, which) {
    if (!boss.twin) return boss.brain === side ? boss : null;
    if (which !== 0 && which !== 1) return null;
    const pool = boss.twin.pools[which];
    return pool.brain === side && !pool.dead ? pool : null;
  }

  /**
   * The boss a hero's hit or control lands on: for Twin Flames the one on its side of the wall, and once one has fallen the
   * other; -1 for one out of its reach, or just fallen. A boss fought alone is 0.
   * @param {RaidBoss} boss @param {number} side @param {unknown} which
   */
  function reachOf(boss, side, which) {
    const twin = boss.twin;
    if (!twin) return 0;
    const half = halfOf(boss, side), w = which === 0 || which === 1 ? which : half >= 0 ? half : twin.pools[0].dead ? 1 : 0;
    if (twin.pools[w].dead || (half >= 0 && w !== half)) return -1;
    return w;
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

  /** The duel lobbies waiting for a second player (`list`) and the raid rooms open to everyone with a seat free (`raids`). */
  function lobbyList() {
    const all = [...lobbies.values()];
    const list = all.filter((l) => l.seats.length < 2 && !l.raid).map((l) => ({
      code: l.code, host: l.seats[0].client.name, hostHero: l.seats[0].hero,
    }));
    const raids = all.filter((l) => l.raid && l.open && l.seats.length < l.max).map((l) => ({
      code: l.code, host: l.seats[0].client.name, count: l.seats.length, max: l.max, raid: l.raid,
    }));
    return { t: 'lobbies', list, raids };
  }

  function broadcastLobbies() {
    const text = JSON.stringify(lobbyList());
    for (const c of clients) if (c.name && !c.match) sendText(c, text);
  }

  /** Everyone is seated and set: the room closes and the duel or the raid starts. @param {Lobby} lobby */
  function startLobby(lobby) {
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

  /** @param {Lobby} lobby */
  function lobbyChanged(lobby) {
    const state = {
      code: lobby.code,
      raid: lobby.raid ?? null,
      seats: lobby.seats.map((s) => ({ name: s.client.name, hero: s.hero, ready: s.ready })),
      // A raid room: listed or not, how many it seats, what its party would fight at as it sits now. The host is seat 0.
      open: lobby.open, max: lobby.max, host: 0, band: lobby.raid ? raidBand(lobby.seats.length) : null,
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

  /**
   * A party of one to forty against a boss. A player's `side` is its seat when the raid started, and stays that to the end. With two
   * seats everything goes as it always did for two (`partner`, `peer_move`); a bigger party's walks go out in batches.
   * @param {{ client: Client, hero: string }[]} seats @param {string} id
   */
  function startRaid(seats, id) {
    const band = raidBand(seats.length);
    /** @type {Match} */
    const match = {
      id: randomHex(6),
      players: seats.map((s) => ({
        client: s.client, name: /** @type {string} */ (s.client.name), hero: s.hero, first: s.hero, max: HP, hp: HP, loaded: false,
        casts: 0, hits: 0, dodges: 0, recent: new Map(), lastSlot: [-Infinity, -Infinity, -Infinity, -Infinity],
        attacks: new Set(), lastAttack: -Infinity, heals: [], down: false, left: false,
      })),
      state: 'offer', created: Date.now(), startedAt: 0, fightAt: 0, round: 1, score: [0, 0], timer: null, pick: null, picked: null,
      boss: newBoss(id, band, 1, 0, seats.length, null),
      run: { stage: RAID_RUN.indexOf(id), tier: 1, beaten: 0, seconds: 0, picks: new Set(), enters: new Set(), goes: new Set() },
    };
    const party = match.players.map((p, side) => ({ side, name: p.name, hero: p.hero }));
    match.players.forEach((p, side) => {
      p.client.match = match;
      p.client.side = side;
      const other = seats.length === 2 ? match.players[1 - side] : null;
      send(p.client, {
        t: 'raid_start', id: match.id, side, you: { name: p.name, hero: p.hero },
        partner: other ? { name: other.name, hero: other.hero } : undefined, party, band,
      });
    });
    if (seats.length > 2) match.ticker = setInterval(() => partyMoves(match), MOVES_MS);
    match.watch = setInterval(() => brainWatch(match), BRAIN_CHECK_MS);
    raidOffer(match);
    log(`raid ${match.id}: ${match.players.map((p) => `${p.name} (${p.hero})`).join(' and ')} against ${id}`);
    broadcastLobbies();
  }

  /**
   * What the hub keeps of one fight: HP and the gauge's size come from the band.
   * Twin Flames (`raidTwin`: a party against Ash and Ember) is two bosses at once: `half` deals the players into the two halves of
   * the room, and each boss has half the HP and half the gauge, and its brain on the first screen of its own half.
   * @param {string} id @param {number} band @param {number} tier @param {number} brain @param {number} seats
   * @param {number[] | null} half by side: 0 west, 1 east, -1 not here @returns {RaidBoss}
   */
  function newBoss(id, band, tier, brain, seats, half) {
    const hp = raidHp(id, band, tier), staggerMax = raidStaggerMax(id, band);
    /** @type {RaidBoss} */
    const boss = {
      id, band, hp, max: hp, staggerMax, phase: 0, gauge: 0, kneelUntil: 0, brain, brainAt: 0,
      revives: new Array(seats).fill(0), stood: new Map(), settled: new Set(), walls: new Set(), taken: new Set(), hpTimer: null, hpAt: 0,
    };
    if (half && raidTwin(id, band)) {
      /** @param {number} which @returns {RaidPool} */
      const pool = (which) => ({
        hp: Math.round(hp / 2), max: Math.round(hp / 2), staggerMax: staggerMax / 2, phase: 0, gauge: 0, kneelUntil: 0, brain: half.indexOf(which), brainAt: 0,
        hpTimer: null, hpAt: 0, dead: false,
      });
      boss.twin = { pools: [pool(0), pool(1)], half, fury: -1 };
      boss.hp = boss.max = boss.twin.pools[0].max + boss.twin.pools[1].max;
      boss.brain = boss.twin.pools[0].brain;
    }
    return boss;
  }

  /**
   * Which half of the room each player fights in, for Twin Flames: those here are dealt west, east, west... in the order of their
   * seats, so with three or more neither half is empty, and the first of them is in the west (Ash's). -1 for who has left.
   * @param {Match} match
   */
  function dealHalves(match) {
    let n = 0;
    return match.players.map((p) => (p.left ? -1 : n++ % 2));
  }

  /**
   * A party's walks, ten times a second: each player gets the newest walk of every other hero that moved since the last batch, as
   * `[side, x, z, yaw, ts]` (and the hero's resource after that, when it has one). Nobody moved: nothing is sent.
   * @param {Match} match
   */
  function partyMoves(match) {
    if (match.state === 'over') return stopTimers(match);
    /** @type {number[]} */
    const sides = [];
    /** @type {string[]} */
    const texts = [];
    match.players.forEach((p, side) => {
      if (!p.move) return;
      if (!p.left) { sides.push(side); texts.push(JSON.stringify(p.move)); }
      p.move = null;
    });
    if (!sides.length) return;
    const head = '{"t":"party_moves","list":[', all = `${head}${texts.join(',')}]}`;
    match.players.forEach((p, side) => {
      if (p.left) return;
      const own = sides.indexOf(side);
      if (own < 0) return sendText(p.client, all);
      if (sides.length > 1) sendText(p.client, `${head}${texts.filter((_, i) => i !== own).join(',')}]}`);
    });
  }

  /** @param {Match} match */
  function stopTimers(match) {
    clearInterval(match.ticker);
    clearInterval(match.watch);
    match.ticker = match.watch = null;
  }

  /**
   * The screen that runs the boss's brain went quiet in a fight: nothing at all from it for 4 s (its casts, its walks, its own
   * hero's). The brain goes to the next player still here, one whose screen was heard from in that time if there is one. A kneel is
   * not counted: a brain has nothing to say then.
   * @param {Match} match
   */
  function brainWatch(match) {
    if (match.state === 'over') return stopTimers(match);
    const boss = match.boss, now = Date.now();
    if (!boss || match.state !== 'fight') return;
    // Twin Flames: each of the two has its own brain, on a screen of its own half.
    for (const which of boss.twin ? [0, 1] : [0]) {
      const pool = poolOf(boss, which);
      if (pool.dead) continue;
      const p = match.players[pool.brain];
      // Nobody ran it (its half was empty): whoever can reach it now does.
      if (!p) {
        const to = nextBrain(match, -1, now, which);
        if (to >= 0) giveBrain(match, to, which);
        continue;
      }
      if (now - Math.max(p.client.seenAt ?? 0, pool.brainAt, match.fightAt, pool.kneelUntil) < BRAIN_QUIET_MS) continue;
      const to = nextBrain(match, pool.brain, now, which);
      if (to < 0) continue;
      log(`raid ${match.id}: nothing from ${p.name}'s screen, the brain moves to ${match.players[to].name}`);
      giveBrain(match, to, which);
    }
  }

  /**
   * Who takes the brain after `from`: the next seat round the party that is still here, first one whose screen was heard from
   * lately, or -1 when nobody else is here. Twin Flames: only a screen on that boss's side of the wall can run it (`which`).
   * @param {Match} match @param {number} from @param {number} now @param {number} [which]
   */
  function nextBrain(match, from, now, which = 0) {
    const n = match.players.length, boss = /** @type {NonNullable<Match['boss']>} */ (match.boss);
    let any = -1;
    for (let i = 1; i <= n; i++) {
      const side = (from + i + n) % n, p = match.players[side];
      if (p.left || side === from) continue;
      const half = halfOf(boss, side);
      if (half >= 0 && half !== which) continue;
      if (now - (p.client.seenAt ?? 0) < BRAIN_QUIET_MS) return side;
      if (any < 0) any = side;
    }
    return any;
  }

  /**
   * The brain is this screen's now: it is told (`boss_brain`), and the others hear whose it is (`brain_moved`). Twin Flames: the
   * brain of boss `which`.
   * @param {Match} match @param {number} side @param {number} [which]
   */
  function giveBrain(match, side, which = 0) {
    const boss = /** @type {NonNullable<Match['boss']>} */ (match.boss), pool = poolOf(boss, which);
    pool.brain = side;
    pool.brainAt = Date.now();
    if (boss.twin && which === 0) boss.brain = side;
    send(match.players[side].client, { t: 'boss_brain', side, which: whichOf(boss, pool) });
    tell(match, { t: 'brain_moved', side, which: whichOf(boss, pool) }, side);
  }

  /** The pick before a fight. The upgrades stay on the clients; the hub waits for both, or for the time. @param {Match} match */
  function raidOffer(match) {
    const run = /** @type {NonNullable<Match['run']>} */ (match.run);
    clearTimeout(match.timer);
    match.state = 'offer';
    run.picks = new Set();
    run.sided = false;
    run.sides = new Map();
    tell(match, { t: 'raid_offer', stage: run.stage, tier: run.tier, boss: RAID_RUN[run.stage], seconds: OFFER_S });
    match.timer = setTimeout(() => { if (match.state === 'offer') raidGate(match); }, OFFER_S * 1000 + OFFER_GRACE_MS);
  }

  /** A side room: another pick, then the gate again. The Shrine costs time on the run. @param {Match} match @param {string} door */
  function raidSide(match, door) {
    const run = /** @type {NonNullable<Match['run']>} */ (match.run);
    clearTimeout(match.timer);
    run.sided = true;
    run.sides = new Map();
    if (door === 'shrine') run.seconds += RAID_SHRINE_S;
    match.state = 'offer';
    run.picks = new Set();
    tell(match, { t: 'raid_side_go', door, seconds: OFFER_S });
    match.timer = setTimeout(() => { if (match.state === 'offer') raidGate(match); }, OFFER_S * 1000 + OFFER_GRACE_MS);
  }

  /** All have picked: the gate opens, and they walk in. Whoever doesn't is brought along. @param {Match} match */
  function raidGate(match) {
    const run = /** @type {NonNullable<Match['run']>} */ (match.run);
    clearTimeout(match.timer);
    match.state = 'gate';
    run.enters = new Set();
    tell(match, { t: 'raid_gate', seconds: GATE_S });
    match.timer = setTimeout(() => { if (match.state === 'gate') raidStage(match); }, GATE_S * 1000);
  }

  /**
   * The band a fight is tuned for: from the players still in the raid as it starts, and it stays that for the fight, whoever leaves.
   * One player left of a party fights at the band for two, as the table says (before parties, the fight after a partner left was at
   * the HP for one).
   * @param {Match} match
   */
  const bandOf = (match) => raidBand(match.players.filter((p) => !p.left).length);

  /** A fight starts loading: everyone at full HP, the boss new and sized for who is here, the first of them runs its brain. @param {Match} match */
  function raidStage(match) {
    const run = /** @type {NonNullable<Match['run']>} */ (match.run);
    clearTimeout(match.timer);
    match.state = 'loading';
    const id = RAID_RUN[run.stage];
    const boss = match.boss = newBoss(id, bandOf(match), run.tier, Math.max(0, match.players.findIndex((p) => !p.left)), match.players.length, dealHalves(match));
    for (const p of match.players) {
      p.loaded = false;
      p.down = false;
      p.hp = p.max;
      // A raid's hits are never checked against casts (`took_hit` is the duel's): nothing to keep from the last fight.
      p.recent.clear();
      p.attacks.clear();
    }
    // Twin Flames: who is in which half, and each boss's own HP, gauge and brain. `hp`, `brain` and `staggerMax` stay the pair's.
    const twin = boss.twin && { half: boss.twin.half, hp: boss.twin.pools.map((x) => x.max), brain: boss.twin.pools.map((x) => x.brain), staggerMax: boss.twin.pools[0].staggerMax };
    tell(match, { t: 'raid_stage', stage: run.stage, tier: run.tier, boss: id, hp: boss.hp, brain: boss.brain, band: boss.band, staggerMax: boss.staggerMax, twin: twin || undefined });
    match.timer = setTimeout(() => { if (match.state === 'loading') fight(match); }, LOAD_TIMEOUT);
  }

  /** The boss fell: a moment on screen, then the next pick, or the choice to go on after the last one. @param {Match} match */
  function raidWon(match) {
    const run = /** @type {NonNullable<Match['run']>} */ (match.run), boss = /** @type {NonNullable<Match['boss']>} */ (match.boss);
    if (match.state !== 'fight') return;
    for (const pool of boss.twin ? [boss, ...boss.twin.pools] : [boss]) {
      clearTimeout(pool.hpTimer);
      pool.hpTimer = null;
    }
    for (const s of boss.stood.values()) clearTimeout(s.timer);
    boss.stood.clear();
    match.state = 'break';
    // A hero still down when the boss falls gets up with the next fight: between fights nobody is down.
    for (const p of match.players) p.down = false;
    run.seconds += Math.max(0, (Date.now() - match.fightAt) / 1000);
    run.beaten++;
    const last = run.stage >= RAID_RUN.length - 1;
    tell(match, { t: 'raid_won', stage: run.stage, tier: run.tier, bosses: run.beaten, seconds: raidSeconds(match), last, wait: last ? CLEARED_WAIT_S : 0 });
    if (last) {
      match.state = 'cleared';
      run.goes = new Set();
      match.timer = setTimeout(() => { if (match.state === 'cleared') raidEnd(match, 'cleared'); }, CLEARED_WAIT_S * 1000);
      return;
    }
    match.timer = setTimeout(() => {
      if (match.state !== 'break') return;
      run.stage++;
      raidOffer(match);
    }, WON_PAUSE_MS);
  }

  /** @param {Match} match */
  function raidNextTier(match) {
    const run = /** @type {NonNullable<Match['run']>} */ (match.run);
    run.tier++;
    run.stage = 0;
    raidOffer(match);
  }

  /**
   * The boss's HP to everyone, at most ten times a second, and always the last one. Twin Flames: each of the two on its own.
   * @param {Match} match @param {number} [which]
   */
  function sendBossHp(match, which = 0) {
    const boss = /** @type {NonNullable<Match['boss']>} */ (match.boss), pool = poolOf(boss, which);
    if (pool.hpTimer) return;
    const go = () => {
      pool.hpTimer = null;
      pool.hpAt = Date.now();
      tell(match, { t: 'boss_hp', hp: pool.hp, which: whichOf(boss, pool) });
    };
    const wait = BOSS_HP_GAP_MS - (Date.now() - pool.hpAt);
    if (wait <= 0) go();
    else pool.hpTimer = setTimeout(go, wait);
  }

  /**
   * This much comes off the boss: the phases it passes, every screen told, and its end. Twin Flames: off boss `which`, with its
   * own phases; then who is furious is looked at again, and the fight is won when both have fallen.
   * @param {Match} match @param {number} amount @param {number} [which]
   */
  function raidDamage(match, amount, which = 0) {
    const boss = /** @type {NonNullable<Match['boss']>} */ (match.boss), pool = poolOf(boss, which), twin = boss.twin;
    if (pool.dead) return;
    pool.hp = Math.max(0, pool.hp - amount);
    if (twin) boss.hp = twin.pools[0].hp + twin.pools[1].hp;
    const phases = RAID_BOSSES[boss.id].phases;
    while (pool.phase < phases.length && pool.hp / pool.max <= phases[pool.phase]) {
      pool.phase++;
      tell(match, { t: 'boss_phase', phase: pool.phase, which: whichOf(boss, pool) });
    }
    if (!twin) {
      sendBossHp(match);
      if (boss.hp <= 0) raidWon(match);
      return;
    }
    if (pool.hp > 0) {
      sendBossHp(match, which);
      twinFury(match);
      return;
    }
    // One of the two falls: its last HP at once, then the news. The wall of fire goes out, and the other is everyone's.
    clearTimeout(pool.hpTimer);
    pool.hpTimer = null;
    pool.dead = true;
    tell(match, { t: 'boss_hp', hp: 0, which });
    tell(match, { t: 'boss_fell', which });
    const other = twin.pools[1 - which];
    if (other.dead) return raidWon(match);
    log(`raid ${match.id}: ${which ? 'Ember' : 'Ash'} falls, the wall of fire goes out`);
    twinFury(match);
    // Its brain stays where it is; one that nobody ran (an empty half) goes to whoever is here.
    if (!match.players[other.brain] || match.players[other.brain].left) {
      const to = nextBrain(match, -1, Date.now(), 1 - which);
      if (to >= 0) giveBrain(match, to, 1 - which);
    }
    stoodSettle(match);
  }

  /**
   * Twin Flames: their health must fall together. When their HP shares are more than `gapOn` apart, the one with more grows
   * furious, until they are within `gapOff` again. The last one standing is furious to its end.
   * @param {Match} match
   */
  function twinFury(match) {
    const twin = match.boss?.twin;
    if (!twin || match.state !== 'fight') return;
    const [a, b] = twin.pools, gap = a.hp / a.max - b.hp / b.max;
    let fury = twin.fury;
    if (a.dead || b.dead) fury = a.dead ? 1 : 0;
    else if (Math.abs(gap) > RAID_TWIN.gapOn) fury = gap > 0 ? 0 : 1;
    else if (Math.abs(gap) <= RAID_TWIN.gapOff || (fury >= 0 && (gap > 0 ? 0 : 1) !== fury)) fury = -1;
    if (fury === twin.fury) return;
    if (twin.fury >= 0) tell(match, { t: 'boss_rage', which: twin.fury, on: false });
    twin.fury = fury;
    if (fury >= 0) tell(match, { t: 'boss_rage', which: fury, on: true });
  }

  /** The boss kneels, on every screen. @param {Match} match @param {number} [which] */
  function raidKneel(match, which = 0) {
    const boss = /** @type {NonNullable<Match['boss']>} */ (match.boss), b = RAID_BOSSES[boss.id], pool = poolOf(boss, which);
    pool.gauge = 0;
    pool.kneelUntil = Date.now() + b.kneel * 1000;
    tell(match, { t: 'boss_kneel', seconds: b.kneel, which: whichOf(boss, pool) });
    tell(match, { t: 'boss_gauge', value: 0, which: whichOf(boss, pool) });
  }

  /** The boss is stunned: it kneels `seconds` on every screen, and the gauge stays as it is. @param {Match} match @param {number} seconds @param {number} [which] */
  function raidStun(match, seconds, which = 0) {
    const boss = /** @type {NonNullable<Match['boss']>} */ (match.boss), pool = poolOf(boss, which);
    pool.kneelUntil = Math.max(pool.kneelUntil, Date.now() + seconds * 1000);
    tell(match, { t: 'boss_kneel', seconds, which: whichOf(boss, pool) });
  }

  /**
   * Points on the stagger gauge: a full one kneels. Its size is the band's (`raidStaggerMax`; each of two bosses has half).
   * @param {Match} match @param {number} points @param {number} [which]
   */
  function raidStagger(match, points, which = 0) {
    const boss = /** @type {NonNullable<Match['boss']>} */ (match.boss), pool = poolOf(boss, which);
    if (pool.dead) return;
    pool.gauge += points;
    if (pool.gauge >= pool.staggerMax) {
      raidKneel(match, which);
      return;
    }
    tell(match, { t: 'boss_gauge', value: pool.gauge, which: whichOf(boss, pool) });
  }

  /** A gold zone is decided: how many heroes stood in it. @param {Match} match @param {number} id @param {number} part */
  function stoodDone(match, id, part) {
    const boss = match.boss, key = `${id}:${part}`, s = boss?.stood.get(key);
    if (!boss || !s) return;
    clearTimeout(s.timer);
    boss.stood.delete(key);
    boss.settled.add(key);
    if (match.state !== 'fight') return;
    tell(match, { t: 'boss_stood', id, part, count: s.count });
  }

  /**
   * Gold zones that need wait no longer: every hero who is up and still here has said whether it stood in one. Looked at again when
   * one falls or leaves, since nobody waits for them.
   * @param {Match} match
   */
  function stoodSettle(match) {
    const boss = match.boss;
    if (!boss) return;
    for (const s of [...boss.stood.values()]) {
      // A zone of one half of Twin Flames waits for that half only; once the wall is out, for everyone who has not said.
      const others = (/** @type {number} */ side) => s.half >= 0 && wallUp(boss) && /** @type {RaidTwin} */ (boss.twin).half[side] !== s.half;
      if (match.players.every((p, side) => p.down || p.left || others(side) || s.from.has(side))) stoodDone(match, s.id, s.part);
    }
  }

  /**
   * Someone leaves a raid (a closed socket and a reload count too: there is no way back into a running fight). The others
   * fight on with the boss as it stands, band and all, and the next of them takes over its brain if the leaver ran it. Every wait
   * for "all who are here" is looked at again, because it may now be over.
   * @param {Match} match @param {number} side
   */
  function raidLeave(match, side) {
    const me = match.players[side], boss = match.boss;
    if (!boss || me.left) return;
    if (match.state !== 'over') {
      me.left = true;
      // Stopping at the clear screen keeps the clear; leaving in the middle of the run keeps what was beaten.
      accounts.recordRaid(me.name, { ...raidScore(match), result: match.state === 'cleared' ? 'cleared' : 'left' });
    }
    me.client = GONE;
    me.move = null;
    if (match.state === 'over') return;
    // Nobody left who can fight: it is over. Whoever is waiting goes on.
    if (match.players.every((p) => p.left || p.down)) return raidEnd(match, match.state === 'cleared' ? 'cleared' : 'lost');
    if (match.state === 'loading' && match.players.every((p) => p.loaded || p.left)) fight(match);
    tell(match, { t: 'partner_left', side });
    const run = /** @type {NonNullable<Match['run']>} */ (match.run);
    if (match.state === 'offer' && allHere(match, run.picks)) return raidStage(match);
    if (match.state === 'gate' && allHere(match, run.enters)) return raidStage(match);
    if (match.state === 'cleared' && allHere(match, run.goes)) return raidNextTier(match);
    // Whatever brain the leaver ran goes to the next screen that can run it: for Twin Flames one of the same half. A half left
    // empty has none until the wall is out (`brainWatch` looks again).
    for (const which of boss.twin ? [0, 1] : [0]) {
      const pool = poolOf(boss, which);
      if (pool.brain !== side || pool.dead) continue;
      const next = nextBrain(match, side, Date.now(), which);
      if (next >= 0) giveBrain(match, next, which);
      else if (boss.twin) pool.brain = -1;
    }
    stoodSettle(match);
  }

  /** What a run has come to: bosses beaten, the tier it reached, the time spent fighting. @param {Match} match */
  function raidScore(match) {
    const run = /** @type {NonNullable<Match['run']>} */ (match.run);
    return { tier: run.tier, bosses: run.beaten, seconds: raidSeconds(match) };
  }

  /** @param {Match} match */
  function raidSeconds(match) {
    const run = /** @type {NonNullable<Match['run']>} */ (match.run);
    const now = match.state === 'fight' ? Math.max(0, (Date.now() - match.fightAt) / 1000) : 0;
    return Math.round((run.seconds + now) * 10) / 10;
  }

  /** @param {Match} match @param {'cleared' | 'lost'} result */
  function raidEnd(match, result) {
    const boss = match.boss;
    if (!boss || match.state === 'over') return;
    clearTimeout(match.timer);
    clearTimeout(boss.hpTimer);
    for (const pool of boss.twin?.pools ?? []) clearTimeout(pool.hpTimer);
    stopTimers(match);
    for (const s of boss.stood.values()) clearTimeout(s.timer);
    boss.stood.clear();
    const score = raidScore(match);
    match.state = 'over';
    match.players.forEach((p) => {
      if (p.left) return;
      accounts.recordRaid(p.name, { ...score, result });
      const a = accounts.get(p.name);
      send(p.client, { t: 'raid_end', result, ...score, bossHp: boss.hp, bossMax: boss.max, profile: a ? accounts.profile(a) : null });
      p.client.match = null;
    });
    log(`raid ${match.id} over: ${result}, ${score.bosses} bosses, tier ${score.tier} (${score.seconds} s)`);
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

/** A length or an angle to three decimals. @param {number} v */
const mm = (v) => Math.round(v * 1000) / 1000;

/** @param {unknown} h */
function validHero(h) {
  return typeof h === 'string' && HERO_RE.test(h);
}

/** A position kept inside the ring (a raid's room is wider). @param {number} x @param {number} z @param {number} [ring] */
function clampRing(x, z, ring = RING.r) {
  const dx = x - RING.x, dz = z - RING.z, d = Math.hypot(dx, dz), r = ring - 0.5;
  return d > r ? { x: RING.x + (dx / d) * r, z: RING.z + (dz / d) * r } : { x, z };
}
