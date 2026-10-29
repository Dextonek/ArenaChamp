// The duel game's server: accounts, lobbies, the matchmaking queue and the relay/referee for 1v1 matches.
// One WebSocket endpoint (default /ws) speaks small JSON messages `{ t: type, ...fields }`; the message table is in
// docs/architecture/multiplayer.md and the client side is src/net/. Attach it to any Node http server: the Vite dev
// server does so through the plugin in vite.config.ts, and `node server/standalone.mjs` runs it on its own port.
//
// Authority: the server owns sessions, lobbies, pairing, match start, HP, the winner and the stats. Each client
// owns its own hero's movement and casts and reports the hits it takes (it knows where it stood when a spell
// landed, which is what makes walking out of the red a dodge). Fine for friends on one machine or a LAN; it is
// not cheat-proof.
import { randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { WebSocketServer } from 'ws';
import { Accounts } from './accounts.mjs';

const HP = 600;
const RING = { x: 0, z: 7, r: 12 };
const COUNTDOWN = 3;
const LOAD_TIMEOUT = 15000;
const HERO_RE = /^[A-Za-z][A-Za-z' -]{0,23}$/;
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ';

/**
 * @typedef {import('ws').WebSocket} WS
 * @typedef {{ ws: WS, name: string | null, lobby: Lobby | null, queued: { hero: string, since: number } | null, match: Match | null, side: number }} Client
 * @typedef {{ code: string, seats: { client: Client, hero: string | null, ready: boolean }[] }} Lobby
 * @typedef {{ client: Client, name: string, hero: string, hp: number, loaded: boolean, casts: number, hits: number, dodges: number }} Player
 * @typedef {{ id: string, players: Player[], state: 'loading' | 'fight' | 'over', created: number, fightAt: number, loadTimer: any }} Match
 */

/**
 * @param {import('node:http').Server} httpServer
 * @param {{ path?: string, dataFile?: string, log?: (msg: string) => void }} [opts]
 */
export function attachGameServer(httpServer, opts = {}) {
  const path = opts.path ?? '/ws';
  const log = opts.log ?? ((m) => console.log(`[game] ${m}`));
  const accounts = new Accounts(opts.dataFile ?? fileURLToPath(new URL('./data/accounts.json', import.meta.url)));
  const wss = new WebSocketServer({ noServer: true });
  /** @type {Map<string, string>} token → account name */
  const sessions = new Map();
  /** @type {Set<Client>} */
  const clients = new Set();
  /** @type {Map<string, Lobby>} */
  const lobbies = new Map();
  /** @type {Client[]} */
  const queue = [];

  // Only our path: Vite's HMR socket shares the same http server and handles its own upgrades.
  httpServer.on('upgrade', (req, socket, head) => {
    const url = new URL(req.url ?? '/', 'http://x');
    if (url.pathname !== path) return;
    wss.handleUpgrade(req, socket, head, (ws) => wss.emit('connection', ws, req));
  });

  wss.on('connection', (ws) => {
    /** @type {Client} */
    const c = { ws, name: null, lobby: null, queued: null, match: null, side: 0 };
    clients.add(c);
    ws.on('message', (data) => {
      let msg;
      try { msg = JSON.parse(String(data)); } catch { return; }
      if (!msg || typeof msg.t !== 'string') return;
      try { handle(c, msg); } catch (e) { log(`error handling ${msg.t}: ${e instanceof Error ? e.stack : e}`); }
    });
    ws.on('close', () => {
      clients.delete(c);
      drop(c, 'disconnect');
    });
  });

  /** @param {Client} c @param {any} msg */
  function send(c, msg) {
    if (c.ws.readyState === 1) c.ws.send(JSON.stringify(msg));
  }

  /** @param {Client} c @param {string} error */
  const fail = (c, error) => send(c, { t: 'error', error });

  /** @param {Client} c @param {any} m */
  function handle(c, m) {
    switch (m.t) {
      case 'register':
      case 'login': {
        const r = m.t === 'register' ? accounts.register(m.name, m.password) : accounts.login(m.name, m.password);
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
        if (c.match.players.every((x) => x.loaded)) fight(c.match);
        return;
      }
      case 'move': {
        const match = c.match;
        if (!match || match.state === 'over' || !num(m.x) || !num(m.z)) return;
        const p = clampRing(m.x, m.z);
        return send(match.players[1 - c.side].client, { t: 'peer_move', x: p.x, z: p.z, yaw: num(m.yaw) ? m.yaw : 0 });
      }
      case 'cast': {
        const match = c.match;
        if (!match || match.state !== 'fight' || Date.now() < match.fightAt) return;
        if (![0, 1, 2, 3].includes(m.slot) || !num(m.x) || !num(m.z) || !num(m.fx) || !num(m.fz)) return;
        match.players[c.side].casts++;
        return send(match.players[1 - c.side].client, {
          t: 'peer_cast', id: m.id, slot: m.slot, x: m.x, z: m.z, fx: m.fx, fz: m.fz, enemy: !!m.enemy,
        });
      }
      case 'took_hit': {
        const match = c.match;
        if (!match || match.state !== 'fight' || !num(m.damage)) return;
        const me = match.players[c.side];
        const damage = Math.max(0, Math.min(250, Math.round(m.damage)));
        me.hp = Math.max(0, me.hp - damage);
        match.players[1 - c.side].hits++;
        send(match.players[1 - c.side].client, { t: 'peer_hit', id: m.id, damage, hp: me.hp, color: typeof m.color === 'string' ? m.color.slice(0, 16) : undefined });
        send(c, { t: 'hp', hp: me.hp });
        if (me.hp <= 0) endMatch(match, 1 - c.side, 'ko');
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
      token = randomBytes(24).toString('hex');
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
      id: randomBytes(6).toString('hex'),
      players: seats.map((s) => ({ client: s.client, name: /** @type {string} */ (s.client.name), hero: s.hero, hp: HP, loaded: false, casts: 0, hits: 0, dodges: 0 })),
      state: 'loading', created: Date.now(), fightAt: 0, loadTimer: null,
    };
    match.players.forEach((p, side) => {
      p.client.match = match;
      p.client.side = side;
      const foe = match.players[1 - side];
      send(p.client, { t: 'match_start', id: match.id, side, hp: HP, you: { name: p.name, hero: p.hero }, foe: { name: foe.name, hero: foe.hero } });
    });
    match.loadTimer = setTimeout(() => { if (match.state === 'loading') fight(match); }, LOAD_TIMEOUT);
    log(`match ${match.id}: ${match.players.map((p) => `${p.name} (${p.hero})`).join(' vs ')}`);
    broadcastLobbies();
  }

  /** @param {Match} match */
  function fight(match) {
    clearTimeout(match.loadTimer);
    match.state = 'fight';
    match.fightAt = Date.now() + COUNTDOWN * 1000;
    for (const p of match.players) send(p.client, { t: 'match_fight', countdown: COUNTDOWN });
  }

  /** @param {Match} match @param {number} winnerSide @param {string} reason */
  function endMatch(match, winnerSide, reason) {
    if (match.state === 'over') return;
    clearTimeout(match.loadTimer);
    match.state = 'over';
    const seconds = Math.max(0, Math.round((Date.now() - (match.fightAt || match.created)) / 100) / 10);
    const at = new Date().toISOString();
    match.players.forEach((p, side) => {
      const foe = match.players[1 - side];
      accounts.record(p.name, { at, hero: p.hero, foe: foe.name, foeHero: foe.hero, result: side === winnerSide ? 'win' : 'loss', seconds, reason });
    });
    accounts.save();
    const winner = match.players[winnerSide];
    match.players.forEach((p, side) => {
      const a = accounts.get(p.name);
      send(p.client, {
        t: 'match_end', id: match.id, result: side === winnerSide ? 'win' : 'loss', winner: winner.name, reason, seconds,
        hp: match.players.map((x) => x.hp), stats: { casts: p.casts, hits: p.hits, dodges: p.dodges },
        profile: a ? accounts.profile(a) : null,
      });
      p.client.match = null;
    });
    log(`match ${match.id} over: ${winner.name} wins (${reason}, ${seconds} s)`);
  }

  /** @param {Client} c */
  function player(c) {
    return c.match?.players[c.side];
  }

  return {
    wss,
    /** For tests and the console: what the server holds right now. */
    state: () => ({ clients: clients.size, lobbies: lobbies.size, queue: queue.length }),
  };
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
