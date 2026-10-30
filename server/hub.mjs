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

const HP = 600; // when a client does not say its hero's max HP
const RING = { x: 0, z: 7, r: 12 };
const COUNTDOWN = 3;
const LOAD_TIMEOUT = 15000;
// Best of three: the first to two round wins takes the match. A round has no time limit: it ends when a hero falls
// (user, 2026-10-30). BREAK_MS between rounds.
const ROUNDS_TO_WIN = 2;
const BREAK_MS = 3000;
// A hit must come from a cast the other side made at most this long ago; a slot can't be cast faster than SLOT_GAP_MS
// (R: R_GAP_MS). Lenient on purpose: the real cooldowns live in the kits, which are still changing.
const HIT_WINDOW_MS = 12000;
const SLOT_GAP_MS = 800;
const R_GAP_MS = 10000;
// Basic attacks: at most one per ATTACK_GAP_MS, a hit from one at most ATTACK_MAX damage. Heals: one at most HEAL_MAX,
// at most HEAL_WINDOW_MAX within HEAL_WINDOW_MS. Statuses and shields the clients report are only relayed (for the
// look on the other screen), clamped to these caps.
const ATTACK_GAP_MS = 500;
const ATTACK_MAX = 40;
const HEAL_MAX = 150;
const HEAL_WINDOW_MS = 2000;
const HEAL_WINDOW_MAX = 300;
const STATUS_KINDS = ['stun', 'root', 'slow', 'silence', 'blind', 'knockup'];
const STATUS_MAX_S = 3;
const SHIELD_MAX = 400;
const SHIELD_MAX_S = 10;
const HERO_RE = /^[A-Za-z][A-Za-z' -]{0,23}$/;
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ';

/**
 * @typedef {{ send: (text: string) => void, name: string | null, lobby: Lobby | null, queued: { hero: string, since: number } | null,
 *   match: Match | null, side: number, chain: Promise<void>, closed: boolean }} Client
 * @typedef {{ code: string, seats: { client: Client, hero: string | null, ready: boolean }[] }} Lobby
 * @typedef {{ client: Client, name: string, hero: string, max: number, hp: number, loaded: boolean, casts: number, hits: number,
 *   dodges: number, recent: Map<number, number>, lastSlot: number[], attacks: Set<number>, lastAttack: number,
 *   heals: { at: number, amount: number }[] }} Player
 * @typedef {{ id: string, players: Player[], state: 'loading' | 'fight' | 'break' | 'over', created: number, startedAt: number,
 *   fightAt: number, round: number, score: number[], timer: any }} Match
 */

/** @param {number} n */
const randomHex = (n) => hex(crypto.getRandomValues(new Uint8Array(n)));

/**
 * @param {{ accounts: import('./accounts.mjs').Accounts, log?: (msg: string) => void }} opts
 */
export function createHub({ accounts, log = (m) => console.log(`[game] ${m}`) }) {
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
        const lobby = { code, seats: [{ client: c, hero: null, ready: false }] };
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
          for (const s of lobby.seats) s.client.lobby = null;
          broadcastLobbies();
          startMatch(lobby.seats.map((s) => ({ client: s.client, hero: /** @type {string} */ (s.hero) })));
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
        const p = clampRing(m.x, m.z);
        return send(match.players[1 - c.side].client, { t: 'peer_move', x: p.x, z: p.z, yaw: num(m.yaw) ? m.yaw : 0, ts: num(m.ts) ? m.ts : undefined });
      }
      case 'cast': {
        const match = c.match;
        if (!match || match.state !== 'fight' || Date.now() < match.fightAt) return;
        if (![0, 1, 2, 3].includes(m.slot) || !num(m.id) || !num(m.x) || !num(m.z) || !num(m.fx) || !num(m.fz)) return;
        const me = match.players[c.side], now = Date.now();
        if (now - me.lastSlot[m.slot] < (m.slot === 3 ? R_GAP_MS : SLOT_GAP_MS)) return;
        me.lastSlot[m.slot] = now;
        me.recent.set(m.id, now);
        me.casts++;
        return send(match.players[1 - c.side].client, {
          t: 'peer_cast', id: m.id, slot: m.slot, x: m.x, z: m.z, fx: m.fx, fz: m.fz, enemy: !!m.enemy, yaw: num(m.yaw) ? m.yaw : undefined,
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
        return send(match.players[1 - c.side].client, { t: 'peer_attack', id: m.id });
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
      case 'shield': {
        const match = c.match;
        if (!match || match.state !== 'fight' || !num(m.amount) || !num(m.seconds)) return;
        return send(match.players[1 - c.side].client, {
          t: 'peer_shield', amount: Math.max(0, Math.min(SHIELD_MAX, Math.round(m.amount))),
          seconds: Math.max(0, Math.min(SHIELD_MAX_S, m.seconds)), color: color(m.color),
        });
      }
      case 'took_hit': {
        const match = c.match;
        if (!match || match.state !== 'fight' || !num(m.damage)) return;
        const me = match.players[c.side];
        // Only a cast the other side really made, not long ago.
        const foe = match.players[1 - c.side];
        const castAt = foe.recent.get(m.id);
        if (castAt === undefined || Date.now() - castAt > HIT_WINDOW_MS) return;
        // `damage` is what got past the hero's own shield; `soaked` what the shield took (only shown on the other side).
        const damage = Math.max(0, Math.min(foe.attacks.has(m.id) ? ATTACK_MAX : 250, Math.round(m.damage)));
        const soaked = num(m.soaked) ? Math.max(0, Math.min(SHIELD_MAX, Math.round(m.soaked))) : 0;
        me.hp = Math.max(0, me.hp - damage);
        foe.hits++;
        send(foe.client, { t: 'peer_hit', id: m.id, damage, soaked, hp: me.hp, color: color(m.color) });
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
      case 'match_leave': {
        const match = c.match;
        if (!match) return;
        if (match.state !== 'over') endMatch(match, 1 - c.side, 'forfeit');
        c.match = null;
        return;
      }
    }
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
    if (match && match.state !== 'over') endMatch(match, 1 - c.side, reason);
    c.match = null;
  }

  // --- lobbies --------------------------------------------------------------------------------------------

  function lobbyList() {
    const list = [...lobbies.values()].filter((l) => l.seats.length < 2).map((l) => ({
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
        client: s.client, name: /** @type {string} */ (s.client.name), hero: s.hero, max: HP, hp: HP, loaded: false,
        casts: 0, hits: 0, dodges: 0, recent: new Map(), lastSlot: [-Infinity, -Infinity, -Infinity, -Infinity],
        attacks: new Set(), lastAttack: -Infinity, heals: [],
      })),
      state: 'loading', created: Date.now(), startedAt: 0, fightAt: 0, round: 1, score: [0, 0], timer: null,
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
   * `round_end`, a break, then `round_start` and the same load → countdown as the first round.
   * @param {Match} match @param {number} winnerSide @param {string} reason
   */
  function endRound(match, winnerSide, reason) {
    if (match.state !== 'fight') return;
    clearTimeout(match.timer);
    if (winnerSide >= 0) match.score[winnerSide]++;
    if (winnerSide >= 0 && match.score[winnerSide] >= ROUNDS_TO_WIN) return endMatch(match, winnerSide, reason);
    match.state = 'break';
    match.players.forEach((p, side) => send(p.client, {
      t: 'round_end', round: match.round, result: winnerSide < 0 ? 'draw' : side === winnerSide ? 'win' : 'loss', reason,
      winner: winnerSide < 0 ? null : match.players[winnerSide].name, score: [match.score[side], match.score[1 - side]],
      hp: match.players.map((x) => x.hp), next: BREAK_MS / 1000,
    }));
    log(`match ${match.id} round ${match.round}: ${winnerSide < 0 ? 'tie' : match.players[winnerSide].name} (${reason}), ${match.score.join('-')}`);
    match.timer = setTimeout(() => {
      if (match.state !== 'break') return;
      if (winnerSide >= 0) match.round++;
      match.state = 'loading';
      for (const p of match.players) {
        p.loaded = false;
        p.hp = p.max;
        p.recent.clear();
        p.lastSlot.fill(-Infinity);
        p.attacks.clear();
        p.lastAttack = -Infinity;
        p.heals = [];
        send(p.client, { t: 'round_start', round: match.round, score: [match.score[p.client.side], match.score[1 - p.client.side]] });
      }
      match.timer = setTimeout(() => { if (match.state === 'loading') fight(match); }, LOAD_TIMEOUT);
    }, BREAK_MS);
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
        at, hero: p.hero, foe: foe.name, foeHero: foe.hero, result: side === winnerSide ? 'win' : 'loss', seconds, reason,
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

/** A position kept inside the duel ring. @param {number} x @param {number} z */
function clampRing(x, z) {
  const dx = x - RING.x, dz = z - RING.z, d = Math.hypot(dx, dz), r = RING.r - 0.5;
  return d > r ? { x: RING.x + (dx / d) * r, z: RING.z + (dz / d) * r } : { x, z };
}
