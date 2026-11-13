import { RING } from '../../arenas/common';
import type { GameApi } from '../../runtime';
import { HEAL, HIDE, boonById, type Boon } from '../boons';
import { setHealth, setSunlit } from '../hooks';
import { autoBoon } from '../run';
import type { FloorDef, Spot, DoorDef } from './def';
import { pieceStarter, stubWaits, type PieceKind, type PieceOut } from './doors';
import { FLOORS } from './floors';
import { WorldHud } from './hud';
import { KEYS, LIVES, WorldRun, nextFloor, read, sigils, wipe, write } from './state';
import { buildZone, offersFor, relicFor, type Zone } from './world';

/**
 * The run of a floor of the Tower's worlds on one screen: it holds the `WorldRun`, builds the zone from it (`enter`, the only way a
 * zone begins), takes the hero through the doors to the set pieces (`doors.ts`) and back, handles a fall (a life, or the floor
 * begins again with the boons the hero arrived with), offers boons, and ends the floor with its result and four stars.
 *
 * `mode: 'run'` is the route bot's: no cards open by themselves, boons are taken by the autopilot's rule, and time is stepped by the
 * tool (`manual`: the tool calls `tick`), as `TowerRun.pump` does for the weekly Tower.
 *
 * Saved under keys beginning `tower.world.` (never `tower.save` / `tower.best`): the run (`tower.world.run`), the floor the next
 * climb starts on (`tower.world.floor`), the sigils kept (`tower.world.sigils`), each floor's best stars (`tower.world.stars`).
 */

/** How long a fallen hero lies before the floor begins again with no life left (s). */
const RESTART_AFTER = 2.2;

export class WorldGame {
  readonly hud = new WorldHud();
  run!: WorldRun;
  zone: Zone | null = null;
  floor!: FloorDef;
  mode: 'play' | 'run';
  /** The tool steps time and calls `tick` itself. */
  manual = false;
  persist: boolean;
  /** A piece is being played: the zone is gone. */
  piece: PieceKind | null = null;
  /** The floor's result once the gate is won. */
  finished = false;
  log: string[] = [];
  /** How many times a floor began again (no life left). */
  restarts = 0;
  private restartIn = -1;
  /** A door walked into, to be started by the next `tick`. */
  private door: DoorDef | null = null;
  private hero: string;
  private raf = 0;
  private last = 0;
  private alive = true;
  private pickLater: { label: string; offers: Boon[] }[] = [];

  constructor(readonly api: GameApi, o: { hero: string; mode?: 'play' | 'run'; floor?: number; persist?: boolean }) {
    this.hero = o.hero;
    this.mode = o.mode ?? 'play';
    this.persist = o.persist ?? true;
    this.floor = FLOORS[o.floor ?? nextFloor()] ?? FLOORS[1];
  }

  /** Begins the floor: from the saved run when `resume` and it is this hero's, else from the camp. */
  start(o: { resume?: boolean } = {}) {
    const saved = o.resume ? WorldRun.from(read(KEYS.run)) : null;
    if (saved && saved.hero === this.hero && FLOORS[saved.floor] && !saved.result) {
      this.run = saved;
      this.floor = FLOORS[saved.floor];
    } else {
      const arrived = this.floor.n > 1 ? { boons: sigils().map((id) => [id, 1] as [string, number]), shards: 0 } : { boons: sigils().map((id) => [id, 1] as [string, number]), shards: 0 };
      this.run = WorldRun.begin(this.hero, this.floor.n, arrived);
    }
    this.finished = false;
    this.piece = null;
    this.enter();
    this.save();
    if (!this.manual) this.loop();
  }

  private loop() {
    cancelAnimationFrame(this.raf);
    this.last = performance.now();
    const frame = () => {
      if (!this.alive || this.manual) return;
      const now = performance.now();
      this.tick(Math.min(0.1, (now - this.last) / 1000));
      this.last = now;
      this.raf = requestAnimationFrame(frame);
    };
    this.raf = requestAnimationFrame(frame);
  }

  /** Builds the zone from the run and starts its fight. The hero stands at `at` (a waystone, the camp, in front of a door). */
  enter(at?: Spot) {
    const { api, run, floor } = this;
    if (api.duel.on) api.duel.stop();
    const start = at ?? (run.clock > 0 || run.lastWaystone ? this.wake() : floor.start);
    run.boons.twist = undefined;
    this.zone = buildZone(api, floor, run, this.hud, {
      fell: () => this.fell(),
      door: (d) => this.enterDoor(d),
      save: () => this.save(),
      offerBoon: (label) => this.offer(label),
      giveRelic: () => this.relic(),
    }, { mode: this.mode, start });
    api.setKit(run.hero);
    api.setHeroMode(true);
    api.duel.holdStart = false;
    api.duel.startBoss({ def: this.zone.def, link: this.zone.link, seed: `world-${floor.id}`, mode: this.mode, tier: 1, upgrades: run.boons, card: () => null });
    // The hero's health as a share of this fight's max.
    if (run.hp < 0.999) setHealth(api, run.hp * api.duel.heroMax);
    setSunlit(api, run.boons);
    this.zone.begin();
    // The autopilot's camera is fixed on the arena's middle; a zone this wide has to follow the hero.
    if (this.mode === 'run') api.heroMode.focus = null;
    api.heroMode.snapCameraNow();
  }

  private wake(): Spot {
    const w = this.floor.waystones.find((x) => x.id === this.run.lastWaystone);
    return w ? { x: w.at.x + 1.6, z: w.at.z } : this.floor.start;
  }

  private leave() {
    this.door = null;
    if (this.api.duel.on) this.api.duel.stop();
    this.zone = null;
  }

  save() {
    if (!this.persist || !this.run) return;
    write(KEYS.run, this.run.toJSON());
  }

  // --- time ------------------------------------------------------------------------------------------------------------

  /** Once a frame while a person plays; the tool calls it between steps. The zone's own work runs inside the duel's frame. */
  tick(dt: number) {
    this.hud.update(dt);
    if (this.door) {
      const d = this.door;
      this.door = null;
      this.startPiece(d);
    }
    for (const w of stubWaits.splice(0)) {
      w.left -= dt;
      if (w.left > 0) stubWaits.push(w);
      else w.done();
    }
    if (this.restartIn >= 0 && (this.restartIn -= dt) < 0) {
      this.restartIn = -1;
      this.beginAgain();
    }
    if (!this.zone && this.piece === null && !this.finished && this.run && this.restartIn < 0) this.enter();
  }

  stop() {
    this.alive = false;
    cancelAnimationFrame(this.raf);
    this.leave();
    this.hud.dispose();
  }

  // --- a fall ----------------------------------------------------------------------------------------------------------

  /** The hero fell. */
  private fell(): 'revive' | 'restart' {
    const run = this.run;
    run.lives--;
    run.falls++;
    this.hud.setLives(Math.max(0, run.lives));
    this.log.push(`fall at ${run.clock.toFixed(0)}s, lives ${run.lives}`);
    if (run.lives > 0) {
      this.save();
      return 'revive';
    }
    this.hud.say('No lives left', 'The floor begins again from its camp', RESTART_AFTER);
    this.restartIn = RESTART_AFTER;
    return 'restart';
  }

  /** No life left: the floor begins again from its camp with the boons the hero arrived with. */
  private beginAgain() {
    this.restarts++;
    this.run = this.run.restart();
    this.leave();
    this.enter(this.floor.start);
    this.save();
  }

  // --- boons -----------------------------------------------------------------------------------------------------------

  private offer(label: string) {
    const kit = this.api.kits.find((k) => k.name === this.run.hero)!;
    const offers = offersFor(this.run, this.floor, kit);
    if (this.mode === 'run') {
      this.take(offers[autoBoon(offers, this.run.hp, this.run.lives)]);
      return;
    }
    if (this.hud.cardsOpen) { this.pickLater.push({ label, offers }); return; }
    this.hud.showBoons(label, offers, (i) => {
      this.hud.clearCards();
      this.take(offers[i]);
      const next = this.pickLater.shift();
      if (next) this.hud.showBoons(next.label, next.offers, (j) => { this.hud.clearCards(); this.take(next.offers[j]); });
    });
  }

  /** A boon taken: as the weekly Tower's landing does. */
  take(boon: Boon) {
    const { api, run } = this, d = api.duel, max = d.heroMax;
    run.boons.add(boon.id);
    let hp = d.heroHp;
    if (boon.id === 'tw-rest') hp += HEAL.rest * max;
    else if (boon.id === 'tw-wind') hp += HEAL.wind * max;
    else if (boon.id === 'tw-kindle') {
      if (run.lives < LIVES) run.lives++;
      else hp += HEAL.kindle * max;
    } else if (boon.id === 'tw-hide') hp += max * (HIDE - 1);
    setHealth(api, hp);
    this.hud.setLives(run.lives);
    this.hud.say(boon.name, boon.blurb, 2.4);
    this.save();
  }

  private relic() {
    const kit = this.api.kits.find((k) => k.name === this.run.hero)!;
    const r = relicFor(this.run, kit);
    if (!r) { this.run.shards += 30; return; }
    this.run.boons.add(r.id);
    this.run.relics.push(r.id);
    this.hud.say(`Relic: ${r.name}`, r.blurb, 3);
    this.save();
  }

  // --- doors and set pieces ----------------------------------------------------------------------------------------------

  /**
   * The hero walked into a door that is ready. It is asked from inside the duel's frame (the zone's own update), so it is only noted
   * here and done by `tick`, outside the frame: a piece that starts its own fight must not do it in the middle of this one
   * (as `TowerRun.later` keeps what waits for the next pump).
   */
  enterDoor(d: DoorDef) {
    if (this.piece || this.door || !this.zone) return;
    this.door = d;
  }

  private startPiece(d: DoorDef) {
    if (this.piece || !this.zone) return;
    const { run, floor } = this;
    this.piece = d.piece;
    const input = { floor: floor.n, hero: run.hero, hp: Math.max(0.05, run.hp), boons: run.boons, ally: run.ally, mode: this.mode };
    this.log.push(`door ${d.id} at ${run.clock.toFixed(0)}s`);
    this.save();
    this.leave();
    this.hud.show(false);
    pieceStarter()(this.api, d.piece, input, (out) => this.pieceDone(d, out));
  }

  /** A piece ended: its outcome is applied to the run and the zone is built again from it. */
  private pieceDone(d: DoorDef, out: PieceOut) {
    if (this.piece !== d.piece) return;
    const { run } = this;
    this.piece = null;
    run.clock += out.seconds;
    run.hp = Math.max(0.05, Math.min(1, out.hp));
    let after: (() => void) | null = null;
    this.log.push(`piece ${d.piece} ${out.won ? 'won' : 'lost'} hp ${out.hp.toFixed(2)}`);
    if (out.won) {
      if (!run.won.includes(d.piece)) run.won.push(d.piece);
      run.shards += d.piece === 'ruler' ? 40 : d.piece === 'trial' ? 20 : 0;
      after = d.piece === 'trial' ? () => this.relic() : d.piece === 'ruler' ? () => this.hud.say(`${d.name}: its ruler falls`, 'The gate up is unsealed', 3.2) : null;
      if (d.piece === 'rival') { run.rival = 'won'; run.ally = this.floor.rival.hero; after = () => this.offer(`${this.floor.rival.hero}'s boon`); }
    } else if (d.piece === 'ruler' || d.piece === 'gate') {
      // A lost ruler or gate costs a life, as a fall in the zone does; the piece may be tried again.
      run.lives--;
      run.falls++;
      run.hp = 0.5;
      if (run.lives <= 0) {
        this.hud.show(true);
        this.hud.say('No lives left', 'The floor begins again from its camp', RESTART_AFTER);
        this.restartIn = RESTART_AFTER;
        return;
      }
      after = () => this.hud.say('Beaten', `A life lost: ${run.lives} left`, 2.6);
    } else if (d.piece === 'rival') run.rival = 'lost';
    // Back in front of the door.
    const away = Math.atan2(RING.x - d.at.x, RING.z - d.at.z), back = { x: d.at.x + Math.sin(away) * 5, z: d.at.z + Math.cos(away) * 5 };
    this.save();
    if (d.piece === 'gate' && out.won) {
      this.enter(back);
      this.floorCleared();
      return;
    }
    this.enter(back);
    after?.();
  }

  // --- the floor's end ---------------------------------------------------------------------------------------------------

  /** The four stars: cleared; every quest done; no life lost; under the floor's time. */
  stars() {
    const { run, floor } = this;
    return [
      { label: 'Cleared the floor', got: run.has('gate') },
      { label: 'Every quest done', got: floor.quests.every((q) => run.q(q.id).handedIn) },
      { label: 'No life lost', got: run.falls === 0 },
      { label: `Under ${Math.floor(floor.par / 60)} minutes`, got: run.clock <= floor.par },
    ];
  }

  private floorCleared() {
    const { run, floor } = this;
    this.finished = true;
    const stars = this.stars();
    run.result = { stars: stars.map((s) => (s.got ? 1 : 0)), seconds: +run.clock.toFixed(1) };
    if (this.persist) {
      write(KEYS.floor, floor.n + 1);
      const all = read<Record<string, number[]>>(KEYS.stars) ?? {};
      const best = all[floor.n] ?? [0, 0, 0, 0];
      all[floor.n] = best.map((b, i) => Math.max(b, run.result!.stars[i]));
      write(KEYS.stars, all);
    }
    this.save();
    // One boon of those carried is kept as a sigil for every later climb. The autopilot keeps the first.
    const carried = run.boons.list().map(([id]) => boonById(id)!).filter(Boolean).slice(0, 3);
    const keep = (b: Boon | null) => {
      if (b && this.persist) write(KEYS.sigils, [...new Set([...sigils(), b.id])]);
      this.hud.hideResult();
      if (this.persist) wipe(KEYS.run);
    };
    if (this.mode === 'run') { keep(carried[0] ?? null); return; }
    this.hud.show(false);
    this.hud.showResult({
      name: floor.name, stars,
      lines: [`${Math.floor(run.clock / 60)}:${String(Math.floor(run.clock % 60)).padStart(2, '0')}`, `${run.shards} shards`, `${run.falls} falls`],
      buttons: [
        ...carried.map((b) => ({ label: `Keep ${b.name} as a sigil`, click: () => keep(b) } as { label: string; click(): void })),
        { label: carried.length ? 'Keep nothing' : 'Done', click: () => keep(null) },
      ],
    });
  }
}
