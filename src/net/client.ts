/**
 * The duel game's connection to the game server (server/game-server.mjs) over one WebSocket at `/ws` on the page's
 * own host. Messages are JSON `{ t: type, ...fields }`; the table is in docs/architecture/multiplayer.md. The
 * session token lives in sessionStorage (per tab), so two tabs of one browser can be two different players.
 */

import type { BuffKind, StatusKind } from '../effects/status';
import type { CastMods } from '../traits';
import { PROTOCOL } from '../../server/protocol.mjs';

export interface HeroStats {
  played: number;
  wins: number;
}

export interface MatchRecord {
  at: string;
  /** The hero the player finished on. */
  hero: string;
  /** The hero the player started on, when they swapped after losing a round. */
  from?: string;
  foe: string;
  foeHero: string;
  result: 'win' | 'loss';
  seconds: number;
  reason: string;
  /** Rounds won by this player and by the foe (best of three). */
  rounds?: number[];
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
  /** Raids apart from the duel record: how many, how many cleared, the fastest clear (s). */
  raids?: { played: number; cleared: number; best: number };
}

/** What a round's loser chose: a hero swap or the next arena. */
export interface RoundPick {
  by: string;
  hero?: string;
  arena?: string;
}

export interface LobbyState {
  code: string;
  /** A raid room: the boss's id. */
  raid?: string | null;
  seats: { name: string; hero: string | null; ready: boolean }[];
}

/** Everything the server sends. */
export type ServerMsg =
  | { t: 'session'; token: string; profile: Profile }
  | { t: 'auth_error'; error: string }
  | { t: 'update_required'; error: string }
  | { t: 'logged_out'; reason: string }
  | { t: 'profile'; profile: Profile }
  | { t: 'error'; error: string }
  | { t: 'lobbies'; list: { code: string; host: string; hostHero: string | null }[] }
  | { t: 'lobby'; lobby: LobbyState | null; you?: number }
  | { t: 'queue'; on: boolean; since: number; size: number }
  | { t: 'match_start'; id: string; side: 0 | 1; hp: number; you: { name: string; hero: string }; foe: { name: string; hero: string } }
  | { t: 'match_fight'; countdown: number; round?: number }
  | {
    t: 'round_end'; round: number; result: 'win' | 'loss' | 'draw'; reason: string; winner: string | null; score: number[];
    hp: number[]; next: number; pick: { you: boolean; seconds: number } | null;
  }
  | { t: 'round_start'; round: number; score: number[]; you: string; foe: string; picked: RoundPick | null }
  | { t: 'peer_move'; x: number; z: number; yaw: number; ts?: number; r?: number }
  | { t: 'peer_cast'; id: number; slot: number; x: number; z: number; fx: number; fz: number; enemy: boolean; yaw?: number; mods?: CastMods; bend?: number }
  | { t: 'peer_hit'; id: number; damage: number; soaked?: number; hp: number; color?: string; blocked?: boolean }
  | { t: 'peer_attack'; id: number; mods?: CastMods }
  | { t: 'peer_spend'; amount: number; hp: number }
  | { t: 'peer_buff'; kind: BuffKind; amount: number; seconds: number }
  | { t: 'peer_stacks'; name: string; n: number }
  | { t: 'peer_heal'; amount: number; hp: number }
  | { t: 'peer_status'; kind: StatusKind; seconds: number; color?: string }
  | { t: 'peer_shield'; amount: number; seconds: number; color?: string }
  | { t: 'peer_dodged'; id: number }
  | { t: 'hp'; hp: number }
  | {
    t: 'match_end'; id: string; result: 'win' | 'loss'; winner: string; reason: string; seconds: number; score?: number[]; hp: number[];
    stats: { casts: number; hits: number; dodges: number }; profile: Profile | null;
  }
  | { t: 'raid_start'; id: string; side: 0 | 1; boss: string; hp: number; you: { name: string; hero: string }; partner: { name: string; hero: string } }
  | { t: 'boss_cast'; id: number; move: string; step: number; x: number; z: number; fx: number; fz: number; dir: number; seed: number; target: 0 | 1 }
  | { t: 'boss_move'; x: number; z: number; yaw: number; ts?: number }
  | { t: 'boss_hp'; hp: number }
  | { t: 'boss_phase'; phase: number }
  | { t: 'boss_gauge'; value: number }
  | { t: 'boss_kneel'; seconds: number }
  | { t: 'boss_stood'; id: number; part: number; count: number }
  | { t: 'boss_wall'; index: number }
  | { t: 'partner_hp'; hp: number; max: number }
  | { t: 'peer_down'; side: 0 | 1 }
  | { t: 'revived'; side: 0 | 1; hp: number; left: number }
  | { t: 'partner_left' }
  | { t: 'boss_brain' }
  | { t: 'raid_end'; result: 'cleared' | 'lost'; seconds: number; bossHp: number; bossMax: number; profile: Profile | null }
  | { t: 'socket'; open: boolean };

type Handler<T extends ServerMsg['t']> = (msg: Extract<ServerMsg, { t: T }>) => void;

// Test lag, off by default: game.html?lag=120&jitter=40 holds every message that long each way (in order, like TCP),
// so two local tabs feel like players far from the server.
const query = new URLSearchParams(location.search);
const LAG = Math.max(0, Number(query.get('lag')) || 0);
const JITTER = Math.max(0, Number(query.get('jitter')) || 0);

const TOKEN_KEY = 'duel.token';
/** The messages that open a session carry this build's rules version: an older tab is told to reload. */
const VERSIONED = new Set(['register', 'login', 'resume']);

export class NetClient {
  private ws: WebSocket | null = null;
  private handlers = new Map<string, Set<(m: ServerMsg) => void>>();
  private retry = 0;
  private lagIn = 0;
  private lagOut = 0;
  /** This build is older than the server's: no more connections until the page reloads. */
  private outdated = false;
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
    ws.addEventListener('message', (e) => this.lagged('in', () => {
      let msg: ServerMsg;
      try { msg = JSON.parse(String(e.data)); } catch { return; }
      if (msg.t === 'session') NetClient.token = msg.token;
      if (msg.t === 'logged_out' || (msg.t === 'auth_error' && !msg.error)) NetClient.token = null;
      if (msg.t === 'update_required') {
        this.outdated = true;
        ws.close();
      }
      this.emit(msg);
    }));
    ws.addEventListener('close', () => {
      const was = this.open;
      this.open = false;
      if (was) this.emit({ t: 'socket', open: false });
      if (this.outdated) return;
      // Reconnect with backoff (the dev server restarts when vite.config.ts changes).
      this.retry = Math.min(this.retry + 1, 6);
      setTimeout(() => this.connect(), 400 * this.retry);
    });
  }

  send(msg: { t: string; [k: string]: unknown }) {
    const ws = this.ws, text = JSON.stringify(VERSIONED.has(msg.t) ? { ...msg, v: PROTOCOL } : msg);
    this.lagged('out', () => { if (ws?.readyState === WebSocket.OPEN) ws.send(text); });
  }

  /** Runs `fn` now, or after the test lag (`?lag=` / `?jitter=`) without reordering messages. */
  private lagged(dir: 'in' | 'out', fn: () => void) {
    if (!LAG && !JITTER) return fn();
    const now = performance.now();
    const at = Math.max(dir === 'in' ? this.lagIn : this.lagOut, now + LAG + Math.random() * JITTER);
    if (dir === 'in') this.lagIn = at; else this.lagOut = at;
    setTimeout(fn, at - now);
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
