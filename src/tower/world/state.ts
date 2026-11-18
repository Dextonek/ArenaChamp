import { TowerBoons } from '../boons';
import type { PieceKind } from './doors';
import type { Spot } from './def';

/** The saved keys: all begin `tower.world.`, never the weekly Tower's `tower.save` / `tower.best`. */
export const KEYS = { run: 'tower.world.run', floor: 'tower.world.floor', sigils: 'tower.world.sigils', stars: 'tower.world.stars', times: 'tower.world.times', version: 'tower.world.version' } as const;
export const LIVES = 3;

export interface QuestState {
  taken: boolean;
  /** The step in hand (0-based); past the last: all done. */
  step: number;
  /** How far along the step is (a count, or seconds held/lit). */
  progress: number;
  done: boolean;
  handedIn: boolean;
}

export type RivalResult = 'none' | 'running' | 'won' | 'lost';

/** The pieces of a floor that can be won. */
export type PieceId = PieceKind;

/**
 * Everything a floor of a climb is, kept in plain data: the zone is built from it (`enterZone`) at any moment, after a set piece,
 * after a reload, after the last life. It holds no three.js object. `toJSON`/`from` round-trip it for the browser's storage.
 */
export class WorldRun {
  floor = 1;
  hero = '';
  lives = LIVES;
  shards = 0;
  boons = new TowerBoons();
  /** What the hero arrived on this floor with: a floor that begins again starts from these. */
  arrived: { boons: [string, number][]; shards: number } = { boons: [], shards: 0 };
  /** Health as a share of max, kept between the zone and the pieces. */
  hp = 1;
  quests: Record<string, QuestState> = {};
  packsCleared: string[] = [];
  /** Named enemies that are down (their bounty is paid once). */
  caches: string[] = [];
  lore: string[] = [];
  waystones: string[] = [];
  lastWaystone: string | null = null;
  rival: RivalResult = 'none';
  /** The rival's hero, set when it was beaten and fights beside you against the ruler. */
  ally: string | undefined;
  /** The floor's clock (s): the zone's time plus what the pieces took. The tide and the patrols are read from it. */
  clock = 0;
  won: PieceId[] = [];
  relics: string[] = [];
  /** A thing carried: held by the hero, or lying where it was dropped. */
  carry: { item: string; held: boolean; at: Spot } | null = null;
  /** Doors opened (walls gone). */
  opened: string[] = [];
  /** Lights lit (the `light` verb's things). */
  lit: string[] = [];
  hintShown: string[] = [];
  /** Lives lost on this floor (for the third star). */
  falls = 0;
  /** Trials lost on this floor: the door stays open for one more try. */
  trialLost = 0;
  /** What the trader sold already (once per floor each). */
  bought: string[] = [];
  /** A floor's result, once its gate is won. */
  result: { stars: number[]; seconds: number } | null = null;
  /** Fight stats for the report. */
  kills = 0;

  q(id: string): QuestState {
    return (this.quests[id] ??= { taken: false, step: 0, progress: 0, done: false, handedIn: false });
  }

  has(piece: PieceId) {
    return this.won.includes(piece);
  }

  /** A floor begins (again): the boons and shards it arrived with, nothing cleared. */
  static begin(hero: string, floor: number, from?: { boons: [string, number][]; shards: number }): WorldRun {
    const r = new WorldRun();
    r.floor = floor;
    r.hero = hero;
    r.boons = TowerBoons.from(from?.boons ?? []);
    r.shards = from?.shards ?? 0;
    r.arrived = { boons: r.boons.list(), shards: r.shards };
    return r;
  }

  /** The floor starts over from its camp: the same arrival, a clean zone, three lives. */
  restart(): WorldRun {
    return WorldRun.begin(this.hero, this.floor, this.arrived);
  }

  toJSON() {
    const { boons, ...rest } = this;
    return { ...rest, boons: boons.list() };
  }

  static from(data: unknown): WorldRun | null {
    const d = data as (Partial<Omit<WorldRun, 'boons'>> & { boons?: [string, number][] }) | null;
    if (!d || typeof d !== 'object' || typeof d.floor !== 'number') return null;
    const r = new WorldRun();
    const { boons, ...rest } = d;
    Object.assign(r, rest);
    r.boons = TowerBoons.from(boons ?? []);
    return r;
  }
}

/**
 * The saves' version (`tower.world.version`). 1 (or none): the Climb had five floors, 1 to 5. 2: the Climb has 50 floors in five
 * chapters of ten, and the five handmade floors are 1, 11, 21, 31 and 41 (pipeline/designs/tower-50.md, "the renumbering").
 */
export const SAVE_VERSION = 2;

/** Old floor `n` (1 to 5) is new floor `10 * (n - 1) + 1`. */
export const movedFloor = (n: number) => (n >= 2 && n <= 5 ? 10 * (n - 1) + 1 : n);

/**
 * Moves the saves of a browser that played the five-floor Climb to the 50 floors, once (the version key says it is done): the stars
 * and best times of floors 2 to 5 go to 11, 21, 31 and 41; a floor in progress on 2 to 5 continues there; the floor a climb may begin
 * on moves likewise (who could begin old floor 3 can begin 21, and every floor below it that exists). Who had cleared all five (the
 * floor reached was 6) can begin 42: what clearing floor 41 now writes. Runs before the first read or write of a `tower.world.` key.
 */
export function migrateSaves(store: Storage | null = storage()) {
  if (!store) return;
  try {
    const v = Number(store.getItem(KEYS.version) ?? '1');
    if (v >= SAVE_VERSION) return;
    const get = (k: string) => { try { return JSON.parse(store.getItem(k) ?? 'null'); } catch { return null; } };
    const reached = get(KEYS.floor);
    if (typeof reached === 'number' && reached >= 2) store.setItem(KEYS.floor, JSON.stringify(reached >= 6 ? 42 : movedFloor(reached)));
    for (const k of [KEYS.stars, KEYS.times]) {
      const all = get(k);
      if (!all || typeof all !== 'object') continue;
      const moved: Record<string, unknown> = {};
      for (const [n, val] of Object.entries(all)) moved[String(movedFloor(Number(n)))] = val;
      store.setItem(k, JSON.stringify(moved));
    }
    const run = get(KEYS.run);
    if (run && typeof run === 'object' && typeof run.floor === 'number') store.setItem(KEYS.run, JSON.stringify({ ...run, floor: movedFloor(run.floor) }));
    store.setItem(KEYS.version, String(SAVE_VERSION));
  } catch { /* storage that cannot be written keeps nothing anyway */ }
}

function storage(): Storage | null {
  try { return typeof localStorage === 'undefined' ? null : localStorage; } catch { return null; }
}

let migrated = false;
const ensureMigrated = () => {
  if (migrated) return;
  migrated = true;
  migrateSaves();
};

export function read<T>(key: string): T | null {
  ensureMigrated();
  try {
    return JSON.parse(localStorage.getItem(key) ?? 'null');
  } catch {
    return null;
  }
}
export function write(key: string, value: unknown) {
  ensureMigrated();
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* it just isn't kept */ }
}
export function wipe(key: string) {
  ensureMigrated();
  try { localStorage.removeItem(key); } catch { /* ignore */ }
}

/** The floor the next climb may begin on (past the last gate beaten). */
export const nextFloor = () => read<number>(KEYS.floor) ?? 1;
/** One boon kept as a sigil for every later climb (the Tower only). */
export const sigils = () => read<string[]>(KEYS.sigils) ?? [];
