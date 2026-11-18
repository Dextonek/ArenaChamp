import { RING } from '../../arenas/common';
import type { GameApi } from '../../runtime';
import { HEAL, HIDE, boonById, type Boon } from '../boons';
import { setHealth, setSunlit } from '../hooks';
import { autoBoon } from '../run';
import type { FloorDef, Spot, DoorDef } from './def';
import { pieceStarter, stubWaits, type PieceHandle, type PieceKind, type PieceOut } from './doors';
import { FLOORS, floorAbove, floorAtOrBelow } from './floors';
import { withRivalFor } from './rival';
import { WorldHud } from './hud';
import { WorldMap } from './map';
import { WorldOthers } from './others';
import type { DoorSink, WorldPresence } from '../../net/world';
import type { ServerMsg } from '../../net/client';
import { DoorFight, checkDoorTable, sharedDoors } from './together';
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
/** A door asked of the hub that it has not answered by then is played alone (s); a held door, this long past its time. */
const DOOR_ASK_S = 2.5;

/** One door fight controller a connection (its handlers live as long as the page). */
const fights = new WeakMap<object, DoorFight>();

export class WorldGame implements DoorSink {
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
  /** The piece's handle: the route bot's `tick` pumps it between two steps. */
  private handle: PieceHandle | null = null;
  /** What a person's result card leads to (the game page's menu): the next floor, or back to the Tower screen. */
  ui: { next?(floor: number): void; back?(): void } = {};
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
  /**
   * The open world (pipeline/designs/climb-open-world.md, stage 1): the other players on this floor, drawn only. `presence` is the
   * game page's link to the hub (src/net/world.ts); without it, or not signed in, the climb is alone as before. Each zone built joins
   * the floor's shard and each zone put away (a door, a fall that begins the floor again, the result card, Leave) leaves it.
   */
  readonly others: WorldOthers;
  /** The minimap in the top-left corner and the big map on M (map.ts); a person's play only. */
  readonly map: WorldMap | null;
  private presence: WorldPresence | null;
  /**
   * The open world's stage 3, doors together: the door this hero walked into and asked the hub about (held for others, or waiting for
   * the answer), the seconds left as the hub said, another player's held door this hero may walk into, the fight the hub began.
   */
  private asking: { door: DoorDef; left: number; names: string[]; first: boolean; held: boolean } | null = null;
  private invite: { door: string; left: number; names: string[] } | null = null;
  private starting: Extract<ServerMsg, { t: 'door_start' }> | null = null;
  /** This hero's seat in the party's fight and how many were in it: they come out side by side, not on one spot. */
  private seat: { side: number; n: number } | null = null;
  /** The party's fight on this connection (null alone, offline, in the tools). */
  readonly together: DoorFight | null = null;
  private lastX = NaN;
  private lastZ = NaN;

  constructor(readonly api: GameApi, o: { hero: string; mode?: 'play' | 'run'; floor?: number; persist?: boolean; presence?: WorldPresence | null }) {
    this.hero = o.hero;
    this.mode = o.mode ?? 'play';
    this.persist = o.persist ?? true;
    this.others = new WorldOthers(api);
    this.map = this.mode === 'play' ? new WorldMap(api, this.others) : null;
    this.presence = o.presence ?? null;
    this.others.onCount = (n) => this.hud.setOthers(this.presence?.online || n > 0 ? n : null);
    if (this.presence) this.presence.sink = this.others;
    if (this.presence) this.presence.doors = this;
    const net = this.presence?.net;
    if (net && this.mode === 'play') {
      let f = fights.get(net);
      if (!f) fights.set(net, (f = new DoorFight(net, api)));
      this.together = f;
    }
    // A floor asked for that does not exist (not made yet) gives the highest one below it that does.
    this.floor = this.asMet(FLOORS[floorAtOrBelow(o.floor ?? nextFloor())]);
  }

  /** The floor as this hero meets it: a rival who is this hero is the next one on the roster (rival.ts). */
  private asMet(def: FloorDef): FloorDef {
    return withRivalFor(def, this.hero, this.api.kits.map((k) => k.name));
  }

  /** Begins the floor: from the saved run when `resume` and it is this hero's, else from the camp. */
  start(o: { resume?: boolean } = {}) {
    const saved = o.resume ? WorldRun.from(read(KEYS.run)) : null;
    if (saved && saved.hero === this.hero && FLOORS[saved.floor] && !saved.result) {
      this.run = saved;
      this.floor = this.asMet(FLOORS[saved.floor]);
    } else {
      const arrived = { boons: sigils().map((id) => [id, 1] as [string, number]), shards: 0 };
      this.run = WorldRun.begin(this.hero, this.floor.n, arrived);
    }
    this.finished = false;
    this.piece = null;
    this.enter();
    this.save();
    // The speed test's switch: `game.html?others=7` walks seven made-up others about the hero (no server); `&packs=3` gives each of
    // them three made-up packs fighting round the hero (share.ts `fake`), and this hero's packs fight the others too.
    const q = new URLSearchParams(location.search);
    const fakes = Math.min(16, Math.max(0, Math.floor(Number(q.get('others')) || 0)));
    if (fakes) this.others.fake(fakes, this.api.arena.caster.group.position);
    if (fakes) this.fakePacks(Math.floor(Number(q.get('packs')) || 0));
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
      joinable: (d) => this.joinable(d),
      save: () => this.save(),
      offerBoon: (label) => this.offer(label),
      giveRelic: () => this.relic(),
    }, { mode: this.mode, start, share: this.presence || this.fakeK ? { link: this.presence, others: this.others } : undefined });
    api.setKit(run.hero);
    api.setHeroMode(true);
    api.duel.holdStart = false;
    api.duel.startBoss({ def: this.zone.def, link: this.zone.link, seed: `world-${floor.id}`, mode: this.mode, tier: 1, upgrades: run.boons, card: () => null });
    // The hero's health as a share of this fight's max.
    if (run.hp < 0.999) setHealth(api, run.hp * api.duel.heroMax);
    setSunlit(api, run.boons);
    this.zone.begin();
    this.map?.setZone(this.zone, floor);
    // The autopilot's camera is fixed on the arena's middle; a zone this wide has to follow the hero.
    if (this.mode === 'run') api.heroMode.focus = null;
    api.heroMode.snapCameraNow();
    // The open world: this hero's casts go to the others on the floor as looks (after the fight's own handling of them).
    const hm = api.heroMode, inner = hm.onCast;
    hm.onCast = (label, slot, target) => {
      inner?.(label, slot, target);
      const me = api.arena.caster.group.position, p = 'enemy' in target ? target.enemy.group.position : target.point;
      this.presence?.cast(label, me.x, me.z, p.x, p.z);
    };
    const me = api.arena.caster.group.position;
    this.presence?.join(floor.n, run.hero, me.x, me.z, api.arena.caster.group.rotation.y);
    if (this.together) checkDoorTable(floor);
    if (this.fakeK) this.zone.share?.fake(this.fakeK);
    this.hud.setOthers(this.presence?.online || this.others.count > 0 ? this.others.count : null);
  }

  /** Made-up packs for the made-up others (the speed test: share.ts `fake`); 0 takes them away. Kept for the zones built after. */
  fakePacks(k: number) {
    this.fakeK = k;
    if (k > 0 && this.zone && !this.zone.share) {
      // A zone built without a share (no link: the tools) is built again with one.
      this.leave();
      this.enter(this.api.arena.caster.group.position.clone());
    }
    this.zone?.share?.fake(k);
  }
  private fakeK = 0;

  private wake(): Spot {
    const w = this.floor.waystones.find((x) => x.id === this.run.lastWaystone);
    return w ? { x: w.at.x + 1.6, z: w.at.z } : this.floor.start;
  }

  private leave(away = false) {
    // Behind a door with others the seat stays in the shard (the hub keeps it): the floor only goes from this screen.
    if (away) this.presence?.away();
    else this.presence?.leave();
    this.asking = null;
    this.invite = null;
    this.hud.door(null);
    this.map?.setZone(null, null);
    this.door = null;
    this.handle?.cancel();
    this.handle = null;
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
    if (this.starting) {
      const m = this.starting;
      this.starting = null;
      this.startShared(m);
    }
    if (this.door) {
      const d = this.door;
      this.door = null;
      this.startPiece(d);
    }
    this.doorLine(dt);
    this.handle?.pump();
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
    this.share(dt);
  }

  /** The open world, once a frame: this hero's place to the others (the link sends ten a second at most), and the others drawn. */
  private share(dt: number) {
    const c = this.api.arena.caster.group, me = c.position, zoneOn = !!this.zone && this.piece === null && !this.finished;
    if (zoneOn && this.presence) {
      const walk = Math.abs(me.x - this.lastX) + Math.abs(me.z - this.lastZ) > 0.002;
      const hp = this.api.duel.heroHp <= 0 ? 0 : Math.max(0.01, this.run.hp);
      this.presence.move(me.x, me.z, c.rotation.y, walk, hp);
    }
    this.lastX = me.x;
    this.lastZ = me.z;
    this.others.update(dt, me, zoneOn);
    this.map?.update(dt, zoneOn);
  }

  stop() {
    this.alive = false;
    cancelAnimationFrame(this.raf);
    this.leave();
    if (this.presence?.doors === this) this.presence.doors = null;
    this.piece = null;
    if (this.presence?.sink === this.others) this.presence.sink = null;
    this.others.dispose();
    this.map?.dispose();
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
    if (this.piece || this.door || !this.zone || this.starting) return;
    // Already asked the hub about this door (or another): the zone calls this every frame the hero stands in a doorway.
    if (this.asking) return;
    // The open world's stage 3: a ruler's lair walked into with others on the floor is asked of the hub, which holds it for those
    // near or says to go alone. Alone, offline, a gate, a trial or a rival: as always.
    const p = this.presence;
    if (this.together && p?.online && this.others.count > 0 && d.piece === 'ruler' && sharedDoors(this.floor).has(d.id)) {
      this.asking = { door: d, left: DOOR_ASK_S, names: [], first: true, held: false };
      p.doorEnter(d.id);
      return;
    }
    this.door = d;
  }

  /** Whether another player holds this door open for others (the zone lets a won lair be walked into then). */
  joinable(d: DoorDef) {
    return !!this.invite && this.invite.door === d.id && this.invite.left > 0;
  }

  // --- the hub's news of doors (DoorSink) --------------------------------------------------------------------------------

  doorGather(m: Extract<ServerMsg, { t: 'door_gather' }>) {
    const you = this.presence?.you ?? 0, mine = m.ids.includes(you);
    if (mine && this.asking?.door.id === m.door) {
      // Held for others: the hub's answer comes when its time is up (door_start or door_solo).
      Object.assign(this.asking, { left: m.left > 0 ? m.left + DOOR_ASK_S : DOOR_ASK_S, names: m.names, first: m.by === you, held: true });
      this.invite = null;
      return;
    }
    if (mine) return;
    this.invite = m.left > 0 ? { door: m.door, left: m.left, names: m.names } : null;
  }

  doorSolo(door: string) {
    const a = this.asking;
    if (!a || a.door.id !== door) return;
    this.asking = null;
    this.hud.door(null);
    if (!this.piece && this.zone) this.door = a.door;
  }

  doorStart(m: Extract<ServerMsg, { t: 'door_start' }>) {
    if (this.asking?.door.id === m.door && !this.piece && this.zone) { this.starting = m; return; }
    // A fight this screen cannot play now (the zone is gone, a piece is on): out of it at once.
    this.presence?.net?.send({ t: 'match_leave' });
  }

  doorBusy(m: Extract<ServerMsg, { t: 'door_busy' }>) {
    if (!this.zone || this.piece || this.mode !== 'play') return;
    const d = this.floor.doors.find((x) => x.id === m.door);
    if (d && m.n > 0) this.hud.say(d.name, `${m.names.join(' and ')} ${m.n === 1 ? 'goes' : 'go'} in together`, 2.4);
  }

  doorEnd(m: Extract<ServerMsg, { t: 'door_end' }>) {
    this.together?.end(m);
  }

  /** The door line on the screen, once a frame: a door held for others, or another's held door to walk into. */
  private doorLine(dt: number) {
    const a = this.asking, inv = this.invite;
    if (a) {
      a.left -= dt;
      // The hub never answered (an older hub, a lost message): the door is played alone.
      if (a.left <= 0) { this.doorSolo(a.door.id); return; }
      if (!a.held) { this.hud.door(null); return; }
      const shown = Math.max(0, Math.ceil(a.left - DOOR_ASK_S));
      const others = a.names.length > 1 ? `With ${a.names.filter((_n, i) => i > 0 || !a.first).join(', ')}. ` : '';
      this.hud.door(`${a.door.name}: held for others near, ${shown} s. ${others}`, a.first ? { label: 'Go in now', click: () => this.presence?.doorGo() } : undefined);
      return;
    }
    if (inv) {
      inv.left -= dt;
      const d = this.floor.doors.find((x) => x.id === inv.door);
      if (inv.left <= 0 || !d || !this.zone || this.piece) { this.invite = null; this.hud.door(null); return; }
      this.hud.door(`${inv.names.join(' and ')} ${inv.names.length === 1 ? 'waits' : 'wait'} at ${d.name}: walk in within ${Math.ceil(inv.left)} s to fight beside them`);
      return;
    }
    this.hud.door(null);
  }

  /** The hub began a fight of the party behind a door: as `startPiece`, but the seat stays in the shard and the piece is the party's. */
  private startShared(m: Extract<ServerMsg, { t: 'door_start' }>) {
    const d = this.floor.doors.find((x) => x.id === m.door), shared = d && this.zone && !this.piece ? this.together?.begin(m) : null;
    if (!d || !shared) { this.presence?.net?.send({ t: 'match_leave' }); this.asking = null; return; }
    const { run, floor } = this;
    this.piece = d.piece;
    this.seat = { side: m.side, n: m.n };
    const input = { floor: floor.n, hero: run.hero, hp: Math.max(0.05, run.hp), boons: run.boons, ally: run.ally, mode: this.mode, shared };
    this.log.push(`door ${d.id} with ${m.n - 1} others at ${run.clock.toFixed(0)}s`);
    this.save();
    this.leave(true);
    this.hud.show(false);
    this.handle = pieceStarter()(this.api, d.piece, input, (out) => { this.handle = null; this.pieceDone(d, out); }) ?? null;
  }

  private startPiece(d: DoorDef) {
    if (this.piece || !this.zone) return;
    this.seat = null;
    const { run, floor } = this;
    this.piece = d.piece;
    const input = { floor: floor.n, hero: run.hero, hp: Math.max(0.05, run.hp), boons: run.boons, ally: run.ally, mode: this.mode };
    this.log.push(`door ${d.id} at ${run.clock.toFixed(0)}s`);
    this.save();
    this.leave();
    this.hud.show(false);
    const piece = d.piece;
    this.handle = pieceStarter()(this.api, piece, input, (out) => { this.handle = null; this.pieceDone(d, out); }) ?? null;
  }

  /**
   * A piece ended: its outcome is applied to the run and the zone is built again from it. The rules: a ruler or a gate lost costs a
   * life and the hero wakes at the last waystone with half its health; a trial lost costs nothing and its door stays open for one more
   * try (`run.trialLost`); the health a piece reports is the health the hero has.
   */
  private pieceDone(d: DoorDef, out: PieceOut) {
    if (this.piece !== d.piece) return;
    const { run } = this;
    this.piece = null;
    run.clock += out.seconds;
    run.hp = Math.max(0.05, Math.min(1, out.hp));
    let after: (() => void) | null = null;
    this.log.push(`piece ${d.piece} ${out.none ? 'nothing counted' : out.won ? 'won' : 'lost'} hp ${out.hp.toFixed(2)} ${out.seconds.toFixed(0)}s${out.shared ? ' (with others)' : ''}`);
    if (out.none) {
      // A party's fight that does not count for this hero (it never hit the ruler, or the connection went): the door as it was.
      this.save();
      this.enter(this.inFront(d));
      this.hud.say(d.name, 'Nothing counted for you: your hero did not strike it, or the fight was cut off', 3);
      return;
    }
    if (out.won) {
      const again = run.won.includes(d.piece);
      if (!again) run.won.push(d.piece);
      // A lair this run had already won (helping another player) pays nothing more.
      if (!again) run.shards += d.piece === 'ruler' ? 40 : d.piece === 'trial' ? 20 : 0;
      after = d.piece === 'trial' ? () => this.relic() : d.piece === 'ruler' ? () => this.hud.say(`${d.name}: its ruler falls`, 'The gate up is unsealed', 3.2) : null;
      if (d.piece === 'rival') { run.rival = 'won'; run.ally = this.floor.rival.hero; after = () => this.offer(`${this.floor.rival.hero}'s boon`); }
    } else if (d.piece === 'ruler' || d.piece === 'gate') {
      // A lost ruler or gate costs a life, as a fall in the zone does, and the hero wakes at the last waystone; it may be tried again.
      run.lives--;
      run.falls++;
      run.hp = 0.5;
      this.pieceFalls.push(`${d.piece}@${run.clock.toFixed(0)}s`);
      if (run.lives <= 0) {
        this.restartIn = RESTART_AFTER;
        this.enter(out.shared ? this.inFront(d) : undefined);
        this.hud.say('No lives left', 'The floor begins again from its camp', RESTART_AFTER);
        return;
      }
      after = () => this.hud.say('Beaten', `A life lost: ${run.lives} left`, 2.6);
    } else if (d.piece === 'trial') {
      run.trialLost++;
      after = () => this.hud.say('The vault holds', run.trialLost < 2 ? 'No life lost: the door stays open for one more try' : 'No life lost: the door closes', 3);
    } else if (d.piece === 'rival') run.rival = 'lost';
    this.save();
    if (d.piece === 'gate' && out.won) {
      this.enter(this.inFront(d));
      this.floorCleared();
      return;
    }
    // Back in front of the door when it was won (or a trial was lost); at the last waystone when a life was lost. A party's fight puts
    // everyone in front of the door, won or lost: they come out together. A won ruler, alone, too (the parent's decision, 2026-11-16:
    // it used to send the hero to the last waystone, against this comment); only a lost ruler or gate wakes the hero at the waystone.
    this.enter((d.piece === 'ruler' || d.piece === 'gate') && !out.won && !out.shared ? undefined : this.inFront(d));
    after?.();
  }

  /** The hero's place in front of a door, on the ring's side; after a party's fight, side by side by seat (1.6 m apart). */
  private inFront(d: DoorDef): Spot {
    const away = Math.atan2(RING.x - d.at.x, RING.z - d.at.z), seat = this.seat;
    const across = seat ? (seat.side - (seat.n - 1) / 2) * 1.6 : 0;
    return { x: d.at.x + Math.sin(away) * 5 + Math.cos(away) * across, z: d.at.z + Math.cos(away) * 5 - Math.sin(away) * across };
  }

  /** Falls that happened inside a piece (the zone does not see them), for the tool's report. */
  pieceFalls: string[] = [];

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

  /** The next floor up that exists (after 11 comes 21 until 12 is made), or null past the last. */
  get above() {
    const n = floorAbove(this.floor.n);
    return n ? FLOORS[n] : null;
  }

  private floorCleared() {
    const { run, floor } = this;
    this.finished = true;
    const stars = this.stars();
    // The clock stops here (the zone under the card does not count it), and what is awake goes to sleep.
    run.result = { stars: stars.map((s) => (s.got ? 1 : 0)), seconds: +run.clock.toFixed(1) };
    this.zone?.setPacks(false);
    // The floor is done: out of its shard (the next floor joins its own).
    this.presence?.leave();
    const before = sigils();
    if (this.persist) {
      // The next floor that exists (or the one above the last, when none does: it opens as soon as it is made).
      write(KEYS.floor, Math.max(nextFloor(), floorAbove(floor.n) ?? floor.n + 1));
      const all = read<Record<string, number[]>>(KEYS.stars) ?? {};
      const best = all[floor.n] ?? [0, 0, 0, 0];
      all[floor.n] = best.map((b, i) => Math.max(b, run.result!.stars[i]));
      write(KEYS.stars, all);
      const times = read<Record<string, number>>(KEYS.times) ?? {};
      if (!times[floor.n] || run.result.seconds < times[floor.n]) times[floor.n] = run.result.seconds;
      write(KEYS.times, times);
      globalThis.dispatchEvent?.(new Event('climb-cleared')); // the game page reports it to the Climb's board (src/game/main.ts)
    }
    this.save();
    // One boon of those carried is kept as a sigil for every later climb. The autopilot keeps the first.
    const carried = run.boons.list().map(([id]) => boonById(id)!).filter(Boolean).slice(0, 3);
    let chosen = carried.length ? 0 : -1;
    const keep = (i: number) => {
      chosen = i;
      if (this.persist) write(KEYS.sigils, [...new Set([...before, ...(carried[i] ? [carried[i].id] : [])])]);
    };
    keep(chosen);
    if (this.mode === 'run') { this.hud.hideResult(); if (this.persist) wipe(KEYS.run); return; }
    const leave = (then?: () => void) => () => {
      this.hud.hideResult();
      wipe(KEYS.run);
      then?.();
    };
    const above = this.above;
    this.hud.show(false);
    this.hud.showResult({
      name: floor.name, stars,
      lines: [`${Math.floor(run.clock / 60)}:${String(Math.floor(run.clock % 60)).padStart(2, '0')}`, `${run.shards} shards`, run.falls ? `${run.falls} ${run.falls === 1 ? 'fall' : 'falls'}` : 'no falls'],
      sigils: carried.map((b) => ({ label: b.name, sub: b.blurb })),
      picked: chosen,
      pick: (i) => keep(i),
      climb: above ? { label: `Climb to floor ${above.n}`, click: leave(() => this.ui.next?.(above.n)) } : { label: 'The way up is still being built', click: () => {}, off: true },
      back: { label: 'Back to the Tower', click: leave(() => this.ui.back?.()) },
    });
  }
}
