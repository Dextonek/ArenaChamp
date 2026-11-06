import * as THREE from 'three';
import { TelegraphLayer, insideTelegraph, type TelegraphShape, type TelegraphSpec } from '../../effects/telegraph';
import { pillar, type Obstacle } from '../../obstacles';
import { RING, disposeTree } from '../common';
import { CENTER, grown, type HazardWorld } from '../hazards/base';

/** Seconds a stage shows its zones before they count. Longer than an event's 1.2 s, because these stay. */
export const REVEAL = 3;
/** The least time between two zone hits on one target (s). */
const TICK = 0.8;
/** How far (m) from a zone's edge an AI keeps. */
const MARGIN = 0.5;
/** How pale the zones are while they show, and once they stay. */
const COMING_ALPHA = 0.42;
const LASTING_ALPHA = 0.3;
/**
 * Last stand: the whole floor hurts, more and more, so a long round always ends (user, 2026-11-06). Its share of max HP
 * per tick grows by `LAST_STEP` every `LAST_EVERY` seconds up to `LAST_MAX`: 7 % of the largest hero (840 HP) stays under
 * the hub's 60 a hit. Without heals a full hero falls about 20 s after it begins.
 */
const LAST_AT = 105;
const LAST_SHARE = 0.03;
const LAST_STEP = 0.01;
const LAST_EVERY = 5;
const LAST_MAX = 0.07;
/** How long cover takes to topple (s), and when the wind-up shows it. */
const TOPPLE = 0.8;

/** A part of the floor that stays changed: it hurts (`share` of max HP per tick), slows (`slow` seconds per tick) or both. */
export interface ShiftZone {
  shape: TelegraphShape;
  share?: number;
  slow?: number;
}

/** A part of the floor that is hit once, when the stage lands (a column falling on it). */
export interface ShiftStrike {
  shape: TelegraphShape;
  damage: number;
}

/** One step of the change: from `at` on the fight clock it shows `zones`, which replace the last stage's when it lands. */
export interface ShiftStage {
  at: number;
  zones: ShiftZone[];
  /** Overrides the arena's banner. */
  banner?: string;
  strikes?: ShiftStrike[];
  /** Arena cover that goes (indexes into `ArenaDef.obstacles`): it cracks when the stage shows and falls when it lands. */
  breaks?: number[];
  /** Arena cover that topples along yaw `dir` so that it lies flat when the stage lands, and is gone then. */
  topples?: { index: number; dir: number }[];
  /** New cover that stands from when the stage lands. */
  adds?: Obstacle[];
  /** Marks shown while the stage shows that are not zones (where new cover will stand). */
  marks?: TelegraphShape[];
  /** The ring gets this small when the stage lands: the floor beyond is gone (Sky Ruins). */
  ring?: number;
}

/** The duel, as a stage sees it. */
export interface ShiftWorld extends HazardWorld {
  crack(index: number): void;
  remove(index: number): void;
  topple(index: number, dir: number, seconds: number): void;
  add(cover: Obstacle[]): void;
  /** The walkable ring shrinks to radius `r`; whoever stands beyond is pushed in. */
  ring(r: number): void;
}

/** What a stage looks like beyond its zones: an arena's own floor and pieces. It only draws. */
export interface ShiftLook {
  readonly group: THREE.Object3D;
  /** It draws the zones that stay, so the plain marks are not needed. */
  readonly drawsZones?: boolean;
  /** Stage `index` starts showing. */
  begin?(index: number): void;
  /** Stage `index` lands. */
  land?(index: number): void;
  update(dt: number, clock: number, world: HazardWorld): void;
}

/**
 * Arenas that change (docs/architecture/arenas.md): as a round runs long the floor gets worse in steps, each announced by
 * a banner and shown for `REVEAL` seconds, ending in Last stand. Everything comes from the fight clock and the seed, so
 * both screens of a network duel change together; each screen only decides the hits on what it lists in
 * `HazardWorld.targets`, as with the arena's events.
 */
export class ArenaShift {
  readonly group = new THREE.Group();
  private coming = new TelegraphLayer();
  private lasting = new TelegraphLayer();
  private stages: ShiftStage[];
  /** The stage shown last, -1 before the first. */
  private index = -1;
  /** A stage is showing and has not landed. */
  private showing = false;
  private began = 0;
  private landed = 0;
  /** The zones that count now. */
  private zones: ShiftZone[] = [];
  private lastHit = new Map<object, number>();
  /** What an AI plans its walk round: the zones that hurt, now or at the stage showing, as cover and as a smaller ring. */
  aiCover: Obstacle[] = [];
  aiBounds: { x: number; z: number; r: number } | null = null;
  /** The topples of the stage showing have started. */
  private toppled = false;

  constructor(private banner: string, private color: THREE.ColorRepresentation, private hitColor: string, stages: ShiftStage[], private look?: ShiftLook, ring = RING.r) {
    this.stages = [...stages, { at: LAST_AT, banner: 'Last stand', zones: [{ shape: { kind: 'circle', x: RING.x, z: RING.z, radius: ring + 1 }, share: LAST_SHARE }] }];
    this.group.add(this.coming.group, this.lasting.group);
    if (look) this.group.add(look.group);
  }

  private get lastStand() {
    return this.index === this.stages.length - 1;
  }

  /**
   * One frame. `clock` is the fight clock (it stops outside the fight), `live` whether hits count. Returns a banner on the
   * frame a stage begins.
   */
  update(dt: number, clock: number, live: boolean, world: ShiftWorld): string | null {
    if (this.showing) {
      const stage = this.stages[this.index];
      if (!this.toppled && clock >= this.began + REVEAL - TOPPLE) {
        this.toppled = true;
        for (const t of stage.topples ?? []) world.topple(t.index, t.dir, TOPPLE);
      }
      if (clock >= this.began + REVEAL) this.land(clock, world, live);
    }
    let banner: string | null = null;
    const next = this.stages[this.index + 1];
    if (live && !this.showing && next && clock >= next.at) {
      this.index++;
      this.showing = true;
      this.toppled = false;
      this.began = clock;
      const shapes = [...next.zones.map((z) => z.shape), ...(next.strikes ?? []).map((s) => s.shape), ...(next.marks ?? [])];
      this.coming.set(shapes.map((shape): TelegraphSpec => ({ shape, start: 0, impact: REVEAL })), this.color, COMING_ALPHA);
      banner = next.banner ?? this.banner;
      this.planAi(next.zones);
      for (const i of next.breaks ?? []) world.crack(i);
      this.look?.begin?.(this.index);
    }
    this.coming.update(clock - this.began);
    this.lasting.update(clock - this.landed);
    this.look?.update(dt, clock, world);
    if (live) this.hurt(clock, world);
    return banner;
  }

  private planAi(zones: ShiftZone[]) {
    this.aiCover = [];
    this.aiBounds = null;
    if (this.lastStand) return;
    for (const { shape: s, share } of zones) {
      if (!share) continue;
      if (s.kind === 'ring') this.aiBounds = { x: s.x, z: s.z, r: s.inner };
      else if (s.kind === 'circle') this.aiCover.push(pillar(s.x, s.z, s.radius));
    }
  }

  private land(clock: number, world: ShiftWorld, live: boolean) {
    const stage = this.stages[this.index];
    this.showing = false;
    this.landed = clock;
    this.zones = stage.zones;
    this.coming.set([]);
    if (!this.look?.drawsZones) this.lasting.set(this.zones.map((z): TelegraphSpec => ({ shape: z.shape, start: 0, impact: 0, until: Infinity })), this.color, LASTING_ALPHA);
    if (stage.ring !== undefined) world.ring(stage.ring);
    for (const i of stage.breaks ?? []) world.remove(i);
    for (const t of stage.topples ?? []) world.remove(t.index);
    if (stage.adds) world.add(stage.adds);
    this.look?.land?.(this.index);
    if (!live) return;
    for (const strike of stage.strikes ?? []) {
      for (const target of world.targets()) {
        if (insideTelegraph(strike.shape, target.pos.x, target.pos.z)) world.hit(target, { damage: strike.damage, color: this.hitColor, from: CENTER });
      }
    }
  }

  private hurt(clock: number, world: HazardWorld) {
    for (const target of world.targets()) {
      const zone = this.zones.find((z) => insideTelegraph(z.shape, target.pos.x, target.pos.z));
      if (!zone) continue;
      const last = this.lastHit.get(target.key);
      if (last !== undefined && clock - last < TICK) continue;
      this.lastHit.set(target.key, clock);
      world.hit(target, { damage: 0, share: this.shareOf(zone, clock), slow: zone.slow, color: this.hitColor, from: CENTER });
    }
  }

  private shareOf(zone: ShiftZone, clock: number) {
    if (!this.lastStand) return zone.share;
    return Math.min(LAST_MAX, LAST_SHARE + LAST_STEP * Math.floor((clock - this.landed) / LAST_EVERY));
  }

  /**
   * Whether an AI may stand at (x, z): outside every zone that hurts, now or at the stage now showing. In Last stand all
   * the floor hurts, so there is no use walking anywhere and every spot counts as safe. A zone that only slows is safe.
   */
  safe(x: number, z: number) {
    if (this.lastStand) return true;
    const hurts = (list: ShiftZone[]) => list.some((s) => s.share && insideTelegraph(grown(s.shape, MARGIN), x, z));
    if (hurts(this.zones)) return false;
    if (!this.showing) return true;
    const stage = this.stages[this.index];
    return !hurts(stage.zones) && !(stage.strikes ?? []).some((s) => insideTelegraph(grown(s.shape, MARGIN), x, z));
  }

  dispose() {
    this.coming.set([]);
    this.lasting.set([]);
    disposeTree(this.group);
    this.group.removeFromParent();
  }
}
