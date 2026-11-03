import * as THREE from 'three';
import { TelegraphLayer, insideTelegraph, type TelegraphShape, type TelegraphSpec } from '../../effects/telegraph';
import type { Obstacle } from '../../obstacles';
import { disposeTree, seeded } from '../common';

/** What an arena hazard does to something it touches. Hazards are not spells: no trait hooks, no credit to anyone. */
export interface HazardHit {
  damage: number;
  color: string;
  from: THREE.Vector3;
  /** Seconds of slow (the hardest control a hazard may have). */
  slow?: number;
}

/** Something a hazard can hit: `key` identifies it, `pos` is where it stands now. */
export interface HazardTarget {
  key: object;
  pos: THREE.Vector3;
}

/** The duel, as a hazard sees it. Online it lists only what this screen decides (this side's hero, the units here). */
export interface HazardWorld {
  camera: THREE.Camera;
  obstacles(): readonly Obstacle[];
  targets(): HazardTarget[];
  hit(target: HazardTarget, hit: HazardHit): void;
}

/** One hurting zone of an event, in seconds after the event began: it hits from `at` until `to` (default just then). */
export interface HazardThreat {
  shape: TelegraphShape;
  at: number;
  to?: number;
  landed?: boolean;
}

/** The ring's centre (arenas/common.ts `RING`) and how far a hazard reaches inside its rim. */
export const CENTER = new THREE.Vector3(0, 0, 7);
export const REACH = 11.6;
/** The first event of a round, the quiet time between events and how long one target is safe after a hit (s). */
const FIRST_EVENT = 8;
const GAP = [9, 13];
const LOCKOUT = 0.8;
/** The margin (m) the danger check adds round a zone, so an AI keeps clear of its edge. */
const MARGIN = 0.5;

function seedNumber(seed: string) {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  return h >>> 0;
}

function grown(s: TelegraphShape, pad: number): TelegraphShape {
  switch (s.kind) {
    case 'circle': return { ...s, radius: s.radius + pad };
    case 'ring': return { ...s, inner: Math.max(0, s.inner - pad), outer: s.outer + pad };
    case 'cone': return { ...s, radius: s.radius + pad };
    case 'line': return { ...s, width: s.width + 2 * pad };
  }
}

/**
 * An arena's own timed event (docs/architecture/arenas.md): every 9-13 s of fight clock something in the arena wakes,
 * shows its zones for at least 1.2 s and hits whoever is still inside, both heroes alike. The schedule and every
 * random choice come from the seed, so both screens of a network duel run the same events; each screen only decides
 * the hits on what it lists in `HazardWorld.targets`.
 *
 * A subclass fills `threats` in `begin` and draws in `tick`. A hazard whose hits do not fit the zones (the temple's
 * sweeping rays) leaves `threats` empty and overrides `danger`.
 */
export abstract class ArenaHazard {
  readonly group = new THREE.Group();
  /** Counts the events so far: an AI rolls its reaction once per event. */
  eventId = 0;
  /** Shown as a short banner when an event begins. */
  abstract readonly warning: string;
  /** The event's zone colour (never the opponent's red). */
  protected abstract readonly zoneColor: THREE.ColorRepresentation;
  /** How long an event lasts (s); set in `begin`. */
  protected duration = 0;
  protected threats: HazardThreat[] = [];
  protected rng: () => number;
  /** Seconds since the event began, -1 between events. */
  protected t = -1;
  private zones = new TelegraphLayer();
  private next = FIRST_EVENT;
  private began = 0;
  private lastHit = new Map<object, number>();
  private clock = 0;

  constructor(seed: string) {
    this.rng = seeded(seedNumber(seed));
    this.group.add(this.zones.group);
  }

  /** An event is on. */
  get active() {
    return this.t >= 0;
  }

  /**
   * One frame. `clock` is the fight clock (it stops outside the fight), `live` whether hits count. Returns true on the
   * frame an event begins.
   */
  update(dt: number, clock: number, live: boolean, world: HazardWorld) {
    this.clock = clock;
    let started = false;
    if (live && this.t < 0 && clock >= this.next) {
      started = true;
      this.eventId++;
      this.began = clock;
      this.threats = [];
      this.t = 0;
      this.begin();
      this.zones.set(this.telegraphs(), this.zoneColor, 0.42);
    }
    if (this.t >= 0) {
      this.t = clock - this.began;
      this.zones.update(this.t);
      if (live) {
        for (const th of this.threats) {
          const to = th.to ?? th.at;
          if (this.t < th.at) continue;
          if (!th.landed) {
            th.landed = true;
            this.landed(th);
          }
          if (this.t > to + 0.05) continue;
          for (const target of world.targets()) {
            if (insideTelegraph(th.shape, target.pos.x, target.pos.z)) this.strike(target, world, th);
          }
        }
      }
      if (this.t >= this.duration) {
        this.t = -1;
        this.zones.set([]);
        this.next = clock + GAP[0] + this.rng() * (GAP[1] - GAP[0]);
      }
    }
    this.tick(dt, this.t, live, world);
    return started;
  }

  /** Hits `target` unless it was hit a moment ago. */
  protected strike(target: HazardTarget, world: HazardWorld, th?: HazardThreat) {
    const last = this.lastHit.get(target.key);
    if (last !== undefined && this.clock - last < LOCKOUT) return;
    this.lastHit.set(target.key, this.clock);
    world.hit(target, this.hitOf(th));
  }

  /** Whether (x, z) is hit, or will be within `within` seconds, by the event on now. The AI's walk-out check. */
  danger(x: number, z: number, within: number) {
    if (this.t < 0) return false;
    return this.threats.some((th) => {
      const to = th.to ?? th.at;
      return this.t <= to && th.at - this.t <= within && insideTelegraph(grown(th.shape, MARGIN), x, z);
    });
  }

  /** The zones to draw; by default one per threat, shown from the event's start. */
  protected telegraphs(): TelegraphSpec[] {
    return this.threats.map((th) => ({ shape: th.shape, start: 0, impact: th.at, until: th.to }));
  }

  /** Starts an event: draw from `rng` only, fill `threats` and `duration`. */
  protected abstract begin(): void;
  /** The damage of a hit. */
  protected abstract hitOf(th?: HazardThreat): HazardHit;
  /** A threat's first moment: its impact visuals. */
  protected landed(_th: HazardThreat) {}
  /** Every frame, also between events (`t` -1) so the visuals can fade. */
  protected abstract tick(dt: number, t: number, live: boolean, world: HazardWorld): void;

  dispose() {
    this.zones.set([]);
    disposeTree(this.group);
    this.group.removeFromParent();
  }
}
