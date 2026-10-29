/**
 * The duel game's connection to the game server (server/game-server.mjs) over one WebSocket at `/ws` on the page's
 * own host. Messages are JSON `{ t: type, ...fields }`; the table is in docs/architecture/multiplayer.md. The
 * session token lives in sessionStorage (per tab), so two tabs of one browser can be two different players.
 */

export interface HeroStats {
  played: number;
  wins: number;
}

export interface MatchRecord {
  at: string;
  hero: string;
  foe: string;
  foeHero: string;
  result: 'win' | 'loss';
  seconds: number;
  reason: string;
}

export interface Profile {
  name: string;
  created: string;
  wins: number;
  losses: number;
  matches: number;
  favourite: string | null;
  heroes: Record<string, HeroStats>;
  history: MatchRecord[];
}

export interface LobbyState {
  code: string;
  seats: { name: string; hero: string | null; ready: boolean }[];
}

/** Everything the server sends. */
export type ServerMsg =
  | { t: 'session'; token: string; profile: Profile }
  | { t: 'auth_error'; error: string }
  | { t: 'logged_out'; reason: string }
  | { t: 'profile'; profile: Profile }
  | { t: 'error'; error: string }
  | { t: 'lobbies'; list: { code: string; host: string; hostHero: string | null }[] }
  | { t: 'lobby'; lobby: LobbyState | null; you?: number }
  | { t: 'queue'; on: boolean; since: number; size: number }
  | { t: 'match_start'; id: string; side: 0 | 1; hp: number; you: { name: string; hero: string }; foe: { name: string; hero: string } }
  | { t: 'match_fight'; countdown: number }
  | { t: 'peer_move'; x: number; z: number; yaw: number }
  | { t: 'peer_cast'; id: number; slot: number; x: number; z: number; fx: number; fz: number; enemy: boolean }
  | { t: 'peer_hit'; id: number; damage: number; hp: number; color?: string }
  | { t: 'peer_dodged'; id: number }
  | { t: 'hp'; hp: number }
  | {
    t: 'match_end'; id: string; result: 'win' | 'loss'; winner: string; reason: string; seconds: number; hp: number[];
    stats: { casts: number; hits: number; dodges: number }; profile: Profile | null;
  }
  | { t: 'socket'; open: boolean };

type Handler<T extends ServerMsg['t']> = (msg: Extract<ServerMsg, { t: T }>) => void;

const TOKEN_KEY = 'duel.token';

export class NetClient {
  private ws: WebSocket | null = null;
  private handlers = new Map<string, Set<(m: ServerMsg) => void>>();
  private retry = 0;
  open = false;

  connect() {
    const proto = location.protocol === 'https:' ? 'wss' : 'ws';
    const ws = new WebSocket(`${proto}://${location.host}/ws`);
    this.ws = ws;
    ws.addEventListener('open', () => {
      this.open = true;
      this.retry = 0;
      this.emit({ t: 'socket', open: true });
      const token = NetClient.token;
      if (token) this.send({ t: 'resume', token });
    });
    ws.addEventListener('message', (e) => {
      let msg: ServerMsg;
      try { msg = JSON.parse(String(e.data)); } catch { return; }
      if (msg.t === 'session') NetClient.token = msg.token;
      if (msg.t === 'logged_out' || (msg.t === 'auth_error' && !msg.error)) NetClient.token = null;
      this.emit(msg);
    });
    ws.addEventListener('close', () => {
      const was = this.open;
      this.open = false;
      if (was) this.emit({ t: 'socket', open: false });
      // Reconnect with backoff (the dev server restarts when vite.config.ts changes).
      this.retry = Math.min(this.retry + 1, 6);
      setTimeout(() => this.connect(), 400 * this.retry);
    });
  }

  send(msg: { t: string; [k: string]: unknown }) {
    if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(msg));
  }

  on<T extends ServerMsg['t']>(t: T, fn: Handler<T>) {
    let set = this.handlers.get(t);
    if (!set) this.handlers.set(t, (set = new Set()));
    set.add(fn as (m: ServerMsg) => void);
  }

  private emit(msg: ServerMsg) {
    for (const fn of this.handlers.get(msg.t) ?? []) fn(msg);
  }

  static get token() {
    try { return sessionStorage.getItem(TOKEN_KEY); } catch { return null; }
  }

  static set token(v: string | null) {
    try {
      if (v) sessionStorage.setItem(TOKEN_KEY, v);
      else sessionStorage.removeItem(TOKEN_KEY);
    } catch { /* private mode: log in again after a reload */ }
  }
}
