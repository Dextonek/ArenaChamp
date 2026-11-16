import { BOSSES } from '../../../raid/bosses';
import { LocalLink } from '../../../raid/link';
import type { RunUpgrades } from '../../../raid/upgrades';
import type { BossDef, RaidLink } from '../../../raid/types';
import type { GameApi } from '../../../runtime';
import { setHealth } from '../../hooks';
import type { TowerLink } from '../../link';
import { PieceHud } from './hud';
import type { PieceHandle, PieceIn, PieceOut, PieceReport, SharedPiece } from './types';

/** How long a finished fight is left on the screen before the piece hands its outcome back (ms), in a person's play. */
const END_PAUSE = 2000;

/**
 * One set piece's life: it ends once, hands `done` its outcome once, and puts back what it changed (the duel's flags, the page's
 * elements). In the autopilot's run (`mode: 'run'`) there are no timers: a finished fight reports from the first `pump`, as the
 * weekly Tower's landing does; in a person's play a short pause lets the end show.
 */
export class PieceRun implements PieceHandle {
  over = false;
  readonly hud: PieceHud | null;
  readonly notes: string[] = [];
  private undo: (() => void)[] = [];
  private ready: PieceOut | null = null;
  private stats: PieceReport = { hits: {}, phase: 0, kneels: 0, note: this.notes };
  private timer: ReturnType<typeof setTimeout> | null = null;

  constructor(readonly api: GameApi, readonly input: PieceIn, readonly title: string, private done: (out: PieceOut) => void) {
    this.hud = input.mode === 'play' ? new PieceHud(title) : null;
    this.undo.push(() => this.hud?.dispose());
  }

  /** Something to put back when the piece is over. */
  onEnd(fn: () => void) {
    this.undo.push(fn);
  }

  note(text: string) {
    if (this.notes.length < 40) this.notes.push(text);
  }

  /** Watches the duel for the end of the fight: `fight` turns the duel's result into an outcome. */
  watch(outcome: (result: 'win' | 'lose') => PieceOut) {
    const d = this.api.duel, was = d.onFinish, rematch = d.onRematch;
    d.onRematch = () => {};
    d.onFinish = (result) => {
      was?.(result);
      this.end(outcome(result));
    };
    this.onEnd(() => {
      d.onFinish = was;
      d.onRematch = rematch;
    });
  }

  /** The fight is over: the outcome is handed back after a pause (a person) or at the next `pump` (the autopilot). */
  end(out: PieceOut) {
    if (this.over || this.ready) return;
    const d = this.api.duel;
    this.stats = { by: d.boss?.killedBy || undefined, hits: { ...(d.boss?.stats.hits ?? {}) }, phase: d.boss?.stats.phases ?? 0, kneels: d.boss?.stats.kneels ?? 0, note: this.notes };
    this.ready = out;
    if (this.input.mode === 'play') {
      this.timer = setTimeout(() => this.deliver(), END_PAUSE);
      // TOWER-HOOK (card): a CPU duel puts up its own result card (a Rematch and a Leave button) after `onFinish` returns, and a boss fight
      // says "<boss> falls" even when the hero fell. The piece is only a step of a floor: once the duel is done with the frame its card and
      // banner are hidden and the piece says its own words. (`Duel.start({ card: null })` is what the engine should get, as `startBoss` has.)
      queueMicrotask(() => {
        if (this.over) return;
        const d = this.api.duel as unknown as { card?: HTMLElement; banner?: HTMLElement };
        if (d.card) d.card.style.display = 'none';
        if (d.banner) d.banner.style.display = 'none';
        this.hud?.say(out.won ? 'Won' : 'Beaten', this.title, 2);
      });
    }
    // The autopilot's run has no timers. `pump` delivers at the next step; a caller that never pumps (the contract does not ask it to) is
    // told as soon as the code that stepped the simulation lets go of the thread. Never inside `Duel.update`: a microtask cannot fire there.
    else queueMicrotask(() => this.deliver());
  }

  pump() {
    if (this.ready) this.deliver();
  }

  private deliver() {
    const out = this.ready;
    if (this.over || !out) return;
    this.over = true;
    if (this.timer) clearTimeout(this.timer);
    this.finishOff();
    this.done({ won: out.won, hp: Math.max(0, Math.min(1, out.hp)), seconds: +out.seconds.toFixed(1), none: out.none, shared: out.shared });
  }

  cancel() {
    if (this.over) return;
    this.over = true;
    if (this.timer) clearTimeout(this.timer);
    this.finishOff();
  }

  private finishOff() {
    for (const fn of this.undo.reverse()) fn();
    this.undo = [];
    if (this.api.duel.on) this.api.duel.stop();
  }

  report(): PieceReport {
    return this.stats;
  }
}

/**
 * A crown floor's boss (every tenth floor, pipeline/designs/tower-50.md): a Raid boss, alone, on its own ground, at the first tier, as
 * the solo Raid plays it (`raid/run.ts`: a `LocalLink`), with the climber's health and boons. A fall ends the piece.
 */
export function crownFight(run: PieceRun, id: string, seed: string, tier = 1) {
  const { api, input } = run, def = BOSSES[id];
  if (!def) throw new Error(`no raid boss ${id}`);
  // With others (the open world's stage 3): the Raid's own two-screen fight, on the hub.
  if (input.shared) return sharedFight(run, { def, link: input.shared.link(def), seed, tier, boons: input.boons, shared: input.shared });
  const link = new LocalLink(def, tier);
  if (api.duel.on) api.duel.stop();
  api.setKit(input.hero);
  api.setHeroMode(true);
  api.duel.holdStart = false;
  api.duel.startBoss({ def, link, seed, mode: input.mode, tier, upgrades: input.boons, card: () => null });
  setHealth(api, input.hp * api.duel.heroMax);
  run.watch((result) => {
    const d = api.duel;
    const won = result === 'win' && d.heroHp > 0;
    return { won, hp: won ? d.heroHp / Math.max(1, d.heroMax) : 0, seconds: d.result?.seconds ?? 0 };
  });
}

/** A fight on the duel's boss path with this hero, its boons and its health: what `TowerRun.fight` does, with no climb round it. */
export function bossFight(run: PieceRun, o: { def: BossDef; link: TowerLink; seed: string; tier: number; boons: RunUpgrades | null }) {
  const { api, input } = run;
  if (api.duel.on) api.duel.stop();
  api.setKit(input.hero);
  api.setHeroMode(true);
  api.duel.holdStart = false;
  // A fall ends the piece: the zone decides what a lost fight costs.
  o.link.fell = () => o.link.lose();
  api.duel.startBoss({ def: o.def, link: o.link, seed: o.seed, mode: input.mode, tier: o.tier, upgrades: o.boons ?? undefined, card: () => null });
  // Health as a share of the max in this fight (Thick Hide has already made it bigger).
  setHealth(api, input.hp * api.duel.heroMax);
  run.watch((result) => {
    const d = api.duel;
    // A fight is won by a hero on its feet.
    const won = result === 'win' && d.heroHp > 0;
    return { won, hp: won ? d.heroHp / Math.max(1, d.heroMax) : 0, seconds: d.result?.seconds ?? 0 };
  });
}

/** A fallen hero whose party still won comes out with this much of its health. */
const UP_AFTER = 0.25;

/**
 * A ruler (or a crown's Raid boss) fought with others of the floor's shard (the open world's stage 3, src/tower/world/together.ts): the
 * duel's boss path as a raid for two or more runs it (`startBoss` with the party; one screen runs the brain, the others follow; a fallen
 * hero lies until a partner gets it up), held until the hub's countdown. It ends when the hub says (`door_end`): won for this player
 * if its hero hit the ruler, nothing either way if it never did, lost when everyone was down.
 */
export function sharedFight(run: PieceRun, o: { def: BossDef; link: RaidLink; seed: string; tier: number; boons: RunUpgrades | null; shared: SharedPiece }) {
  const { api, input } = run, s = o.shared;
  if (api.duel.on) api.duel.stop();
  api.setKit(input.hero);
  api.setHeroMode(true);
  // The fight waits for every screen to load: the hub's `match_fight` starts the countdown.
  api.duel.holdStart = input.mode === 'play';
  api.duel.startBoss({
    def: o.def, link: o.link, seed: o.seed, mode: input.mode, tier: o.tier, upgrades: o.boons ?? undefined, name: s.name,
    partner: s.party.length === 1 ? s.party[0] : undefined, party: s.party.length > 1 ? s.party : undefined, band: 2, card: () => null,
  });
  setHealth(api, input.hp * api.duel.heroMax);
  void api.duel.whenReady().then(() => { if (!run.over) s.loaded(api.duel.heroMax); });
  run.onEnd(() => { api.duel.holdStart = false; s.stop(); });
  run.watch(() => {
    const d = api.duel, r = s.result(), seconds = d.result?.seconds ?? 0;
    if (!r) return { won: false, hp: input.hp, seconds, none: true, shared: true };
    if (r.won && !r.hit) return { won: false, hp: Math.max(UP_AFTER, d.heroHp / Math.max(1, d.heroMax)), seconds, none: true, shared: true };
    if (r.won) return { won: true, hp: d.heroHp > 0 ? d.heroHp / Math.max(1, d.heroMax) : UP_AFTER, seconds, shared: true };
    return { won: false, hp: 0, seconds, shared: true };
  });
}
