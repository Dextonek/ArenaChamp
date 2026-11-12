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
  /**
   * Runs apart from the duel record: how many, how many cleared, and the best: most bosses beaten, its tier and time (s).
   * `others`: the most bosses beaten in one run with others, which the raid rank comes from.
   */
  raids?: { played: number; cleared: number; bosses?: number; tier?: number; best: number; others?: number };
  // The hero shop (pipeline/designs/hero-shop.md), since PROTOCOL 11.
  /** The shop's currency, earned by playing online. */
  obols?: number;
  /** The heroes the account owns for good: the starters, what it bought, a founder's first roster. Every hero while the shop is off. */
  owned?: string[];
  /** An account from before the shop: it owns the heroes there were then. */
  founder?: boolean;
  /** The raid rank's id (`RAID_RANKS`), or null for none. */
  rank?: string | null;
  /** The highest floor of a week's Tower this account's page reported (not verified by the server). */
  tower?: { week: string; floor: number; hero: string } | null;
}

/** One run on the week's raid board: bosses beaten with others, the run's time then (s), its tier, the party. */
export interface RaidRow {
  bosses: number;
  tier: number;
  seconds: number;
  names: string[];
  at: string;
}

/** One player on the week's Tower board: the highest floor their own page reported. Not verified by the server. */
export interface TowerRow {
  name: string;
  floor: number;
  hero: string;
  at: string;
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
  /** `rank`: in a raid room, the player's raid rank (an id of `RAID_RANKS`) or null. */
  seats: { name: string; hero: string | null; ready: boolean; rank?: string | null }[];
  /** A raid room listed for everyone (`lobby_create { raid, open: true }`). Since PROTOCOL 8, as the next three. */
  open?: boolean;
  /** How many seats the room has: 2 for a duel, `RAID_PARTY_MAX` for a raid. */
  max?: number;
  /** The seat of the host, who starts a raid with `raid_go`: always 0. */
  host?: number;
  /** A raid room: the party size its boss would be tuned for as it sits now (`raidBand`). */
  band?: number | null;
}

/** An open raid room on the public list. */
export interface RaidRoom {
  code: string;
  host: string;
  /** Players seated now, of `max`. */
  count: number;
  max: number;
  /** The boss's id. */
  raid: string;
  /** The host's raid rank, or null. */
  rank?: string | null;
}

/** One player of a raid's party: `side` is the seat it started in, and names it in every message to the end of the run. */
export interface PartyMember {
  side: number;
  name: string;
  hero: string;
}

/**
 * One hero's newest walk in a `party_moves` batch: `[side, x, z, yaw, ts]`, and the hero's resource after that when it has one.
 * `ts` is the sender's own clock (ms), null when it sent none.
 */
export type PartyMove = [side: number, x: number, z: number, yaw: number, ts: number | null, r?: number];

/** Everything the server sends. */
export type ServerMsg =
  | { t: 'session'; token: string; profile: Profile }
  | { t: 'auth_error'; error: string }
  | { t: 'update_required'; error: string }
  | { t: 'logged_out'; reason: string }
  | { t: 'profile'; profile: Profile }
  // The hero shop. To every connection as it opens, and again with a session and a profile: whether heroes are locked, the
  // week's name, when the next begins (ms) and the week's free heroes.
  | { t: 'shop'; on: boolean; week: string; next: number; free: string[] }
  | { t: 'shop_bought'; hero: string; price: number; profile: Profile }
  // Obols were earned: how many, the account's new total, and what for.
  | { t: 'obols'; earned: number; total: number; why: { what: string; n: number }[] }
  // The week's boards: the best raid runs with others, and the highest Tower floors as the players' pages reported them.
  | { t: 'boards'; week: string; raid: RaidRow[]; tower: TowerRow[] }
  | { t: 'error'; error: string }
  | { t: 'lobbies'; list: { code: string; host: string; hostHero: string | null }[]; raids?: RaidRoom[] }
  | { t: 'lobby'; lobby: LobbyState | null; you?: number }
  | { t: 'queue'; on: boolean; since: number; size: number }
  | { t: 'match_start'; id: string; side: 0 | 1; hp: number; you: { name: string; hero: string }; foe: { name: string; hero: string } }
  | { t: 'match_fight'; countdown: number; round?: number }
  | {
    t: 'round_end'; round: number; result: 'win' | 'loss' | 'draw'; reason: string; winner: string | null; score: number[];
    hp: number[]; next: number; pick: { you: boolean; seconds: number } | null;
  }
  | { t: 'round_start'; round: number; score: number[]; you: string; foe: string; picked: RoundPick | null }
  // In a raid, every `peer_*` and `partner_*` message says whose hero it was (`side`); in a duel there is no `side`.
  | { t: 'peer_move'; x: number; z: number; yaw: number; ts?: number; r?: number; side?: number }
  // A raid party of more than two: everyone else's walks in one message, ten times a second, instead of `peer_move`.
  | { t: 'party_moves'; list: PartyMove[] }
  | { t: 'peer_cast'; id: number; slot: number; x: number; z: number; fx: number; fz: number; enemy: boolean; yaw?: number; mods?: CastMods; bend?: number; side?: number }
  | { t: 'peer_hit'; id: number; damage: number; soaked?: number; hp: number; color?: string; blocked?: boolean }
  | { t: 'peer_attack'; id: number; mods?: CastMods; side?: number }
  | { t: 'peer_spend'; amount: number; hp: number; side?: number }
  | { t: 'peer_buff'; kind: BuffKind; amount: number; seconds: number; side?: number }
  | { t: 'peer_stacks'; name: string; n: number; side?: number }
  | { t: 'peer_form'; alt: boolean; side?: number }
  | { t: 'peer_heal'; amount: number; hp: number; side?: number }
  | { t: 'peer_status'; kind: StatusKind; seconds: number; color?: string; side?: number }
  | { t: 'peer_shield'; amount: number; seconds: number; color?: string; side?: number }
  | { t: 'peer_dodged'; id: number; side?: number }
  | { t: 'hp'; hp: number }
  | {
    t: 'match_end'; id: string; result: 'win' | 'loss'; winner: string; reason: string; seconds: number; score?: number[]; hp: number[];
    stats: { casts: number; hits: number; dodges: number }; profile: Profile | null;
    /** The obols this duel paid the player (0: too short, or the player left it). */
    earned?: number;
  }
  // `partner` only in a raid for two. `party`: everyone, this player too, by seat. `band`: what the party's size is tuned for.
  | { t: 'raid_start'; id: string; side: number; you: { name: string; hero: string }; partner?: { name: string; hero: string }; party: PartyMember[]; band: number }
  | { t: 'raid_offer'; stage: number; tier: number; boss: string; seconds: number }
  | { t: 'raid_gate'; seconds: number }
  | { t: 'raid_side_go'; door: 'vault' | 'shrine'; seconds: number }
  // `band`: from the players still in the raid as this fight starts; `hp` and `staggerMax` (the gauge's size) come from it.
  // `twin`: Twin Flames (a party against Ash and Ember, both at once): which half of the room each side is in (0 west with Ash,
  // 1 east with Ember, -1 gone), and each boss's own HP, brain and gauge. `hp`, `brain` and `staggerMax` are then the pair's.
  | { t: 'raid_stage'; stage: number; tier: number; boss: string; hp: number; brain: number; band: number; staggerMax: number; twin?: { half: number[]; hp: [number, number]; brain: [number, number]; staggerMax: number } }
  | { t: 'raid_won'; stage: number; tier: number; bosses: number; seconds: number; last: boolean; wait: number }
  // `which`, on these and below: only in Twin Flames, which of the two bosses it is about (0 Ash, 1 Ember).
  | { t: 'boss_cast'; id: number; move: string; step: number; x: number; z: number; fx: number; fz: number; dir: number; seed: number; target: number; alone?: boolean; rim?: boolean; form?: number; flag?: boolean; which?: number; mate?: number }
  // Twin Flames, The Changing of the Flames: the halves as the hub has dealt them again (by side, as in `raid_stage.twin.half`), whose
  // screen runs each boss's brain now, and who the gates shut on (`late`: each of those is dragged through, and burns).
  | { t: 'twin_halves'; half: number[]; brain: [number, number]; late: number[] }
  | { t: 'boss_move'; x: number; z: number; yaw: number; ts?: number; which?: number }
  | { t: 'boss_hp'; hp: number; which?: number }
  | { t: 'boss_phase'; phase: number; which?: number }
  | { t: 'boss_gauge'; value: number; which?: number }
  | { t: 'boss_kneel'; seconds: number; which?: number }
  // Twin Flames: boss `which` grows furious (the other is more than 12 points ahead) or calms (within 6 again).
  | { t: 'boss_rage'; which: number; on: boolean }
  // Twin Flames: boss `which` fell. The wall of fire goes out and the other is everyone's; the raid is won when both have.
  | { t: 'boss_fell'; which: number }
  | { t: 'boss_stood'; id: number; part: number; count: number }
  | { t: 'boss_done'; id: number; part: number; side: number }
  | { t: 'boss_wall'; index: number }
  | { t: 'partner_hp'; hp: number; max: number; side: number }
  | { t: 'peer_down'; side: number }
  // `side` got up, `by` stood by it; `left`: how often that hero can still be got up in this fight.
  | { t: 'revived'; side: number; hp: number; left: number; by: number }
  | { t: 'peer_debuff'; kind: 'slow' | 'weaken' | 'vulnerable'; amount: number; seconds: number; side: number; which?: number }
  | { t: 'peer_add'; id: number; part: number; amount: number; side: number }
  | { t: 'partner_left'; side: number }
  // To one screen only: it runs the boss's brain from now on (the one before left, or went quiet for 4 s).
  | { t: 'boss_brain'; side: number; which?: number }
  // To every other screen, the one that ran it too: the brain is `side`'s now.
  | { t: 'brain_moved'; side: number; which?: number }
  | { t: 'raid_end'; result: 'cleared' | 'lost'; tier: number; bosses: number; seconds: number; bossHp: number; bossMax: number; profile: Profile | null }
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
