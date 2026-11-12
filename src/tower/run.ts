import { heightName } from '../arenas/tower';
import { sleep, type LoadingScreen } from '../game/loading';
import { fadeTo } from '../raid/hall';
import type { GameApi } from '../runtime';
import { HEAL, HIDE, TowerBoons, boonsFor, type Boon } from './boons';
import { buildFloor, type Floor } from './floors';
import { setHealth, setMolten, setSunlit } from './hooks';
import { TowerHud } from './hud';
import { buildLanding } from './landing';
import { KIND_NAME, floorOf, isoWeek, type FloorKind } from './week';

/** The loading page only shows when a floor takes longer than this to load (ms). */
const SLOW_LOAD = 1200;
/** How long a cleared floor stays as it is before the altars rise, and how long a fallen hero lies before the floor starts again (ms). */
const WON_PAUSE = 900;
const FELL_PAUSE = 1700;
/** A climb has three lives. A fall puts the hero back at the floor's start with this share of its health. */
export const LIVES = 3;
const BACK_WITH = 0.5;
/** Beating a guardian saves the climb: the next one this week may begin on the floor above it. */
const SAVE_KEY = 'tower.save', BEST_KEY = 'tower.best';

/** What a floor cost a climb, for the tool that measures it (pipeline/tools/tower-tool.js). */
export interface FloorReport {
  n: number;
  kind: FloorKind;
  cleared: boolean;
  /** Seconds of fight. */
  seconds: number;
  /** Health lost on it, as a share of max health (a fall counts what was left). */
  lost: number;
  /** What felled the hero, when it fell. */
  by?: string;
  /** How often each move hit the hero on it. */
  hits: Record<string, number>;
}

/** A climb kept at a guardian's landing: where the next one may start, and with what. */
interface Saved { week: string; floor: number; boons: [string, number][] }

function read<T>(key: string): T | null {
  try {
    return JSON.parse(localStorage.getItem(key) ?? 'null');
  } catch {
    return null;
  }
}
function write(key: string, value: unknown) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* it just isn't kept */ }
}

/** The highest floor cleared in `week` in this browser (0: none). */
export function towerBest(week = isoWeek().id) {
  return read<Record<string, number>>(BEST_KEY)?.[week] ?? 0;
}

/** The floor a new climb may start on this week, past the last guardian beaten (1: from the bottom). */
export function towerSaved(week = isoWeek().id) {
  const s = read<Saved>(SAVE_KEY);
  return s && s.week === week && s.floor > 1 ? s.floor : 1;
}

/** Which boon the autopilot takes: a heal when it is hurt, else the relic, else the power. Returns its place among the three. */
export function autoBoon(offers: Boon[], hpShare: number, lives: number) {
  if (hpShare < 0.55 || (lives < LIVES && offers[0].id === 'tw-kindle')) return 0;
  return offers[2].kind === 'relic' ? 2 : 1;
}

/**
 * A climb of the week's Tower on this screen, with no server and no account (pipeline/designs/tower.md): floor, boon, floor,
 * boon. Shaped like a raid alone (`RaidRun`), and it differs where the Tower does: health carries over from floor to floor,
 * a fall costs one of three lives and starts the floor again, and each floor is a `BossDef` built for it (src/tower/floors.ts)
 * with a short landing after it for the boon and the stairs (src/tower/landing.ts).
 *
 * `mode: 'run'` is the autopilot's climb for the tool: no fades, no waits and nothing on the page; whatever would wait is kept
 * until `pump()` is called, between two steps of the simulation.
 */
export class TowerRun {
  active = false;
  private leave: HTMLButtonElement;
  private hud: TowerHud | null = null;
  private mode: 'play' | 'run' = 'play';
  private hero = '';
  week = '';
  /** The floor the hero is on, from 1. */
  floor = 1;
  lives = LIVES;
  /** The hero's health as it leaves a floor; -1: full. */
  private hp = -1;
  boons = new TowerBoons();
  /** What each floor of this climb cost. */
  log: FloorReport[] = [];
  /** The climb is over: no life was left. */
  ended = false;
  private now: Floor | null = null;
  private landed = false;
  private hpAtStart = 0;
  /** Seconds the floor has run. */
  private clock = 0;
  private pending: (() => void) | null = null;
  private policy: (offers: Boon[], hpShare: number, lives: number) => number = autoBoon;
  /** Each wait gets a number: one the player already left does not go on. */
  private run = 0;

  constructor(
    private api: GameApi,
    private loading: LoadingScreen | null,
    private ui: { onEnter(): void; onExit(): void },
  ) {
    this.leave = document.createElement('button');
    this.leave.className = 'btn ghost forfeit raid-leave tower-leave';
    this.leave.textContent = 'Leave';
    this.leave.style.display = 'none';
    this.leave.addEventListener('click', () => {
      if (confirm('Leave the Tower? This climb ends here.')) this.exit();
    });
    document.body.appendChild(this.leave);
    const rematch = api.duel.onRematch;
    api.duel.onRematch = () => {
      if (!this.active) { rematch?.(); return; }
      void this.start({ hero: this.hero, mode: this.mode, week: this.week, resume: true });
    };
    const finish = api.duel.onFinish;
    api.duel.onFinish = (result) => {
      finish?.(result);
      if (this.active) this.finished(result);
    };
  }

  /**
   * Begins a climb. `resume`: on the floor above the last guardian beaten this week, with the boons the hero had there (else
   * from the bottom). `week`: another week's Tower, for the tool. `from`: a floor to begin on, for the tool and the pictures.
   */
  async start(o: { hero: string; mode?: 'play' | 'run'; week?: string; resume?: boolean; from?: number; policy?: TowerRun['policy'] }) {
    this.run++;
    this.active = true;
    this.ended = false;
    this.hero = o.hero;
    this.mode = o.mode ?? 'play';
    this.week = o.week ?? isoWeek().id;
    this.policy = o.policy ?? autoBoon;
    const saved = o.resume ? read<Saved>(SAVE_KEY) : null;
    const kept = saved && saved.week === this.week && saved.floor > 1 ? saved : null;
    this.floor = o.from ?? kept?.floor ?? 1;
    this.boons = kept ? TowerBoons.from(kept.boons) : new TowerBoons();
    this.lives = LIVES;
    this.hp = -1;
    this.log = [];
    this.pending = null;
    if (this.mode === 'play') {
      this.hud ??= new TowerHud();
      this.frames();
    }
    this.ui.onEnter();
    if (this.api.duel.on) this.api.duel.stop();
    await this.enter();
  }

  /** The highest floor cleared this week in this browser. */
  get best() {
    return towerBest(this.week || undefined);
  }

  /** The autopilot's climb: runs what was waiting (the landing, the next floor, the floor again). Call between two steps. */
  pump() {
    const next = this.pending;
    this.pending = null;
    next?.();
  }

  /** `next` after `ms`, unless the player has left; in the autopilot's climb it waits for `pump` instead. */
  private later(ms: number, next: () => void) {
    const run = this.run;
    if (this.mode === 'run') { this.pending = next; return; }
    void sleep(ms).then(() => { if (run === this.run && this.active) next(); });
  }

  private get kit() {
    return this.api.kits.find((k) => k.name === this.hero);
  }

  /** Starts a fight on the duel's boss path with this climb's hero, boons and health. */
  private fight(o: { def: Floor['def']; link: Floor['link']; seed: string; tier: number }) {
    const { api } = this;
    if (api.duel.on) api.duel.stop();
    api.setKit(this.hero);
    api.setHeroMode(true);
    api.duel.holdStart = false;
    // Health carries over: what the hero left the last floor with (a new climb: full), never more than its max now.
    api.duel.startBoss({ def: o.def, link: o.link, seed: o.seed, mode: this.mode, tier: o.tier, upgrades: this.boons, card: (result) => this.card(result), hp: this.hp < 0 ? undefined : this.hp });
    this.hp = api.duel.heroHp;
  }

  /** The floor the hero is on begins (again, after a fall). */
  private async enter() {
    const { api } = this, run = this.run, play = this.mode === 'play';
    const plan = floorOf(this.week, this.floor);
    this.boons.twist = plan.twist;
    this.landed = false;
    this.clock = 0;
    const floor = buildFloor(plan, { api, boons: this.boons, hero: this.hero, goal: (text) => this.hud?.setGoal(text), time: (t) => { this.clock = t; } });
    this.now = floor;
    floor.link.fell = () => this.fell();
    if (play) {
      await fadeTo(true);
      if (run !== this.run) return;
    }
    this.fight({ def: floor.def, link: floor.link, seed: plan.seed, tier: floor.tier });
    this.hpAtStart = this.hp;
    if (plan.twist === 'molten') setMolten(api);
    setSunlit(api, this.boons);
    floor.begin();
    if (!play) return;
    this.hud?.floor(plan, this.lives, !floor.def.hall);
    this.leave.style.display = '';
    await this.ready(api.duel.whenReady(), { mine: this.kit, title: `The Tower · floor ${plan.n}`, line: `${heightName(plan.n)}: ${KIND_NAME[plan.kind]}` });
    if (run !== this.run) return;
    await fadeTo(false);
    if (run !== this.run) return;
    this.hud?.announce(plan);
  }

  /** Waits for what is loading. The loading page only shows if it takes a while, so a stair stays a stair. */
  private async ready(when: Promise<void>, page: Parameters<LoadingScreen['show']>[0]) {
    let waiting = true;
    void sleep(SLOW_LOAD).then(() => { if (waiting) this.loading?.show(page); });
    await when;
    waiting = false;
    this.loading?.hide();
  }

  /** What the duel's card says when a fight ends, or null for none: a floor cleared just goes on. */
  private card(result: 'win' | 'lose') {
    if (result === 'win') return null;
    const best = this.best;
    return {
      title: 'THE CLIMB ENDS',
      text: `You fell on floor ${this.floor}. ${best ? `Your highest floor this week: ${best}.` : 'No floor cleared yet this week.'}${towerSaved(this.week) > 1 ? ` The next climb begins on floor ${towerSaved(this.week)}.` : ''}`,
      again: 'Climb again',
    };
  }

  private report(cleared: boolean, by?: string) {
    const d = this.api.duel, plan = this.now!.plan;
    const left = cleared ? d.heroHp : 0;
    this.log.push({ n: plan.n, kind: plan.kind, cleared, seconds: +(d.result?.seconds ?? this.clock).toFixed(1), lost: +((this.hpAtStart - left) / Math.max(1, d.heroMax)).toFixed(3), by, hits: { ...(d.boss?.stats.hits ?? {}) } });
  }

  /** A fight ended. A floor cleared: the best is kept, and the landing comes. */
  private finished(result: 'win' | 'lose') {
    if (result !== 'win' || !this.now || this.landed) return;
    const d = this.api.duel, plan = this.now.plan;
    // A floor is cleared by a hero on its feet.
    if (d.heroHp <= 0) return;
    this.report(true);
    // Second Wind gives a little back after every floor.
    this.hp = Math.min(d.heroMax, d.heroHp + this.boons.regen * d.heroMax);
    const best = read<Record<string, number>>(BEST_KEY) ?? {};
    if (plan.n > (best[this.week] ?? 0)) {
      // This week's and the last few: older ones are dropped.
      const kept = Object.fromEntries(Object.entries({ ...best, [this.week]: plan.n }).sort().slice(-8));
      if (this.mode === 'play') write(BEST_KEY, kept);
    }
    // Said now, while the floor still lies as it fell: on the landing the boon cards have that place.
    if (plan.kind === 'guardian') this.hud?.say('The Guardian falls', 'Your climb is saved: the next one this week may begin above it.', 2.4);
    else this.hud?.say(`Floor ${plan.n} cleared`, '', 1.2);
    this.later(WON_PAUSE, () => this.landing());
  }

  /** The landing after a cleared floor: three boons, then the stairs. */
  private landing() {
    const { api } = this, floor = this.now;
    const kit = this.kit;
    if (!floor || !kit) return;
    const plan = floor.plan, me = api.arena.caster.group.position;
    const offers = boonsFor(plan.seed, kit, this.boons, this.lives);
    this.landed = true;
    const land = buildLanding({
      api, place: floor.def.place, at: { x: me.x, z: me.z }, offers, broke: floor.broke, hud: this.hud,
      only: this.mode === 'run' ? this.policy(offers, this.hp / Math.max(1, api.duel.heroMax), this.lives) : undefined,
      goal: (text) => this.hud?.setGoal(text),
      pick: (boon) => this.take(boon),
      climb: () => this.climb(),
    });
    this.fight({ def: land.def, link: land.link, seed: `${plan.seed}-landing`, tier: 1 });
    land.begin();
    // A guardian beaten saves the climb: the next one this week may begin above it, with these boons.
    if (plan.kind === 'guardian' && this.mode === 'play') write(SAVE_KEY, { week: this.week, floor: plan.n + 1, boons: this.boons.list() } satisfies Saved);
  }

  /** A boon was taken on the landing. */
  private take(boon: Boon) {
    const d = this.api.duel, max = d.heroMax;
    this.boons.add(boon.id);
    if (boon.id === 'tw-rest') this.hp += HEAL.rest * max;
    else if (boon.id === 'tw-wind') this.hp += HEAL.wind * max;
    else if (boon.id === 'tw-kindle') {
      if (this.lives < LIVES) this.lives++;
      else this.hp += HEAL.kindle * max;
    } else if (boon.id === 'tw-hide') {
      // The health it adds comes filled: the hero's max grows at the next floor's start.
      this.hp += max * (HIDE - 1);
    }
    // What the screen shows now; the next floor's start caps it at the hero's max then.
    setHealth(this.api, this.hp);
    this.hud?.setLives(this.lives);
    if (boon.kind === 'heal' || boon.id === 'tw-hide') this.hud?.setHealth(d.heroHp, max);
    // A climb saved at a guardian keeps the boon taken on its landing.
    const saved = read<Saved>(SAVE_KEY);
    if (this.mode === 'play' && saved && saved.week === this.week && saved.floor === this.floor + 1) write(SAVE_KEY, { ...saved, boons: this.boons.list() });
  }

  /** The stairs were walked: the next floor. */
  private climb() {
    this.floor++;
    this.later(0, () => void this.enter());
  }

  /** The hero fell: a life goes, and the floor starts again with half its health; with no life left the climb ends here. */
  private fell() {
    const floor = this.now;
    if (!floor) return;
    this.lives--;
    this.report(false, this.api.duel.boss?.killedBy || undefined);
    this.hud?.setLives(this.lives);
    if (this.lives <= 0) {
      this.ended = true;
      floor.link.lose();
      return;
    }
    // The floor is over for this try: nothing that still lands in the moment before it starts again (the last keeper falling
    // to a spell in the air, a time to hold out running down) may clear it under a fallen hero.
    floor.link.over = true;
    this.hp = Math.round(this.api.duel.heroMax * BACK_WITH);
    this.hud?.say('A life lost', `${this.lives} left. The floor begins again.`, FELL_PAUSE / 1000);
    this.later(FELL_PAUSE, () => void this.enter());
  }

  /** While a person climbs: the health bar and the words that fade, once a frame. One loop a climb. */
  private frames() {
    const run = this.run;
    let last = performance.now();
    const frame = () => {
      if (run !== this.run || !this.active) return;
      const now = performance.now();
      this.hud?.setHealth(this.api.duel.heroHp, this.api.duel.heroMax);
      this.hud?.update(Math.min(0.1, (now - last) / 1000));
      last = now;
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  }

  exit() {
    if (!this.active) return;
    this.active = false;
    this.run++;
    this.pending = null;
    this.now = null;
    this.hud?.hide();
    void fadeTo(false, 0);
    this.loading?.hide();
    this.leave.style.display = 'none';
    this.api.duel.stop();
    this.api.duel.holdStart = false;
    this.api.setHeroMode(false);
    this.ui.onExit();
  }
}
