import * as THREE from 'three';
import { Emitter } from '../../emitter';
import { smoothstep } from '../../effects/common';
import { ShockRefraction, StarBurst, clearScreenFx, createScreenFx } from '../../effects/parts';
import { ASTRAL, ASTRAL_CSS, ConstellationLines, StarChart, StarPoints } from '../../effects/parts/astral';
import { BoltSet, type BoltLook } from '../../effects/parts/bolt';
import type { Obstacle } from '../../obstacles';
import type { TelegraphShape } from '../../effects/telegraph';
import { frameCast, type CastContext, type HitOptions } from '../../effects/targeting';
import type { Effect, EffectModule } from '../../effects/types';

/**
 * Pinning Arrow (astral kit, E: skillshot). A short flare at the nock, then at 0.3 s a thin arrow (24 m/s) (9 m,
 * `ctx.projectile`). The status is decided at the hit: the bolt's hit options carry a getter that measures the
 * enemy's live position (the nearest of the cast's targets to the bolt, else the bolt's own point) against
 * `ctx.obstacles()`: within 1.5 m of a wall's or pillar's surface they are pinned (root 1.5 s), otherwise slowed 40%
 * (slow 1.5 s). Pinned: a stuck arrow of stars joins the enemy to the nearest point of the wall by a gold line, a
 * parchment chart locks round their feet and holds for the root; slowed: a thin chart ring follows their feet with
 * stars trailing behind them. Both end by snapping the lines and letting the stars fall. Online the dealer's screen
 * draws only the nock (bolts fly on the victim's screen, where the status is decided with the same walls). Clean by
 * about 3 s. See pipeline/designs/kit-astral.md.
 */
export interface PinningArrowSettings {
  damage: number;
  loop: boolean;
}

export const defaultPinningArrow = (): PinningArrowSettings => ({ damage: 35, loop: false });

// Timeline (seconds).
const RELEASE_T = 0.3;
const SPEED = 24;
const RANGE = 9;
const RADIUS = 0.4;
const MUZZLE = 0.8;
const PIN_RANGE = 1.5;
const STATUS_S = 1.5;
const MAX_T = 3.2;

const LOOK: BoltLook = { core: ASTRAL_CSS.core, body: ASTRAL_CSS.hot, rim: ASTRAL_CSS.body, size: 0.3, trail: 3, hit: ASTRAL_CSS.accent };

/** Distance from (px, pz) to the obstacle's surface and the nearest point on its centre segment. */
function surfaceDist(o: Obstacle, px: number, pz: number) {
  const dx = o.bx - o.ax, dz = o.bz - o.az, len2 = dx * dx + dz * dz;
  const k = len2 > 0 ? Math.min(1, Math.max(0, ((px - o.ax) * dx + (pz - o.az) * dz) / len2)) : 0;
  const cx = o.ax + dx * k, cz = o.az + dz * k;
  const d = Math.hypot(px - cx, pz - cz);
  return { d: d - o.r, x: cx + ((px - cx) / (d || 1)) * o.r, z: cz + ((pz - cz) / (d || 1)) * o.r };
}

export class PinningArrow implements Effect {
  readonly group = new THREE.Group();
  readonly settings: PinningArrowSettings;
  readonly emitters: Emitter[] = [];
  readonly screen = createScreenFx();
  shake = 0;
  playing = false;

  /** Last cast; frameCamera and telegraphs read it. Null until the first play(). */
  ctx: CastContext | null = null;
  line: TelegraphShape = { kind: 'line', x1: 0, z1: 0, x2: 0, z2: 0, width: RADIUS * 2 };
  private time = 0;

  private fwd = new THREE.Vector3(0, 0, -1);
  private hand = new THREE.Vector3(0, 1.4, 13);
  private fired = false;
  private bolt: ReturnType<NonNullable<CastContext['projectile']>> | null = null;
  /** What the last hit decided: the wall point it pinned to (null = slowed), when it landed, and who. */
  private pin: { x: number; z: number } | null = null;
  private target: THREE.Object3D | null = null;
  private hitAt = -1;
  private hitPos = new THREE.Vector3();
  private snapped = false;
  private lineId = -1;
  private anchor = new THREE.Vector3();

  private bolts = new BoltSet(this.group);
  private stars = new StarPoints({ max: 16 });
  private lines = new ConstellationLines({ maxLines: 6 });
  private chart = new StarChart({ color: ASTRAL.foil });
  private pop = new StarBurst({ points: 10, inner: 0.3, color: ASTRAL.accent, core: ASTRAL.core, additive: false });
  private nock = new StarBurst({ points: 4, inner: 0.2, jitter: 0, color: ASTRAL.hot, core: ASTRAL.core, additive: false });
  private pinStar = new StarBurst({ points: 4, inner: 0.22, jitter: 0, color: ASTRAL.hot, core: ASTRAL.core, additive: false });
  private shock = new ShockRefraction({ facing: 'ground' });

  private v1 = new THREE.Vector3();
  private v2 = new THREE.Vector3();

  constructor(settings: PinningArrowSettings = defaultPinningArrow()) {
    this.settings = settings;
    this.lines.widthScale = 1.4;
    this.group.add(this.chart.mesh, this.lines.mesh, this.stars.mesh, this.pop.mesh, this.nock.mesh, this.pinStar.mesh, this.shock.mesh);
    this.reset();
  }

  get duration() {
    return MAX_T;
  }

  get impactTime() {
    return RELEASE_T;
  }

  get flightEnd() {
    return RELEASE_T + RANGE / SPEED;
  }

  cast(ctx: CastContext) {
    this.ctx = ctx;
    this.fwd.set(Math.sin(ctx.aim), 0, Math.cos(ctx.aim));
    this.hand.copy(ctx.from).addScaledVector(this.fwd, 0.55).setY(1.4);
    this.line = {
      kind: 'line', x1: ctx.from.x, z1: ctx.from.z, x2: ctx.from.x + this.fwd.x * RANGE, z2: ctx.from.z + this.fwd.z * RANGE,
      width: RADIUS * 2,
    };
    this.screen.silhouettes = [ctx.caster.group, ...ctx.targets.map((e) => e.group)];
  }

  play() {
    this.reset();
    this.playing = true;
  }

  private reset() {
    this.time = 0;
    this.shake = 0;
    this.fired = this.snapped = false;
    this.bolt = null;
    this.pin = null;
    this.target = null;
    this.hitAt = -1;
    this.lineId = -1;
    this.trailK = -1;
    clearScreenFx(this.screen);
    this.bolts.clear();
    this.stars.reset();
    this.lines.reset();
    this.chart.reset();
    this.pop.set(this.hand, 0, 0);
    this.nock.set(this.hand, 0, 0);
    this.pinStar.set(this.hand, 0, 0);
    this.shock.set(this.hand, 0, 0);
  }

  /**
   * The enemy the bolt is about to hit: the nearest of the cast's targets to the bolt (live), else a point a little
   * ahead of it. Decides the status: the wall point when pinned, null when not.
   */
  private decide(): { x: number; z: number } | null {
    const ctx = this.ctx, bolt = this.bolt;
    if (!ctx || !bolt) return null;
    let px = bolt.pos.x + bolt.dir.x * 0.4, pz = bolt.pos.z + bolt.dir.z * 0.4, best = 1.6;
    for (const e of ctx.targets) {
      const d = Math.hypot(e.group.position.x - bolt.pos.x, e.group.position.z - bolt.pos.z);
      if (d < best) { best = d; px = e.group.position.x; pz = e.group.position.z; }
    }
    let found: { x: number; z: number } | null = null, near = PIN_RANGE;
    for (const o of ctx.obstacles?.() ?? []) {
      const s = surfaceDist(o, px, pz);
      if (s.d <= near) { near = s.d; found = { x: s.x, z: s.z }; }
    }
    this.pin = found;
    return found;
  }

  update(dt: number) {
    for (const e of this.emitters) e.update(dt);
    if (!this.playing) return;
    this.stars.update(dt);
    this.lines.update(dt);
    this.time += dt;
    const t = this.time;
    const ctx = this.ctx;

    if (!this.fired && t >= RELEASE_T) {
      this.fired = true;
      if (ctx?.projectile) {
        // The status is read from the options when the hit happens (the engine spreads them then): a getter decides it.
        const hit: HitOptions = { damage: this.settings.damage, knock: 1.5, color: ASTRAL_CSS.hot };
        Object.defineProperty(hit, 'status', {
          enumerable: true,
          get: () => ({ kind: this.decide() ? 'root' : 'slow', seconds: STATUS_S }),
        });
        this.bolt = ctx.projectile({
          from: ctx.from.clone().addScaledVector(this.fwd, MUZZLE), dir: this.fwd.clone(), speed: SPEED, range: RANGE - MUZZLE,
          radius: RADIUS, hit,
        });
        this.bolts.follow(this.bolt, LOOK);
        this.bolt.onHit((target, at) => this.onHit(target.group, at));
      }
    }
    this.bolts.update(dt);

    this.layout(dt);

    if (this.hitAt >= 0 && !this.snapped && t >= this.hitAt + STATUS_S) {
      this.snapped = true;
      this.lines.snap(0.5);
      this.stars.fallAll(1, 0.5);
    }
    if ((this.snapped && t >= this.hitAt + STATUS_S + 0.9) || t >= MAX_T || (this.fired && this.hitAt < 0 && !this.bolts.busy && t > 1.2)) {
      const loop = this.settings.loop;
      this.playing = false;
      this.reset();
      if (loop) this.play();
    }
  }

  private onHit(target: THREE.Object3D, at: THREE.Vector3) {
    this.hitAt = this.time;
    this.target = target;
    this.hitPos.set(at.x, 1.2, at.z);
    this.shake = this.pin ? 0.3 : 0.15;
    if (this.pin) {
      // The pin: a star where the arrow sticks in the wall, a line from the enemy to it.
      this.anchor.set(this.pin.x, 1.2, this.pin.z);
      this.stars.add(this.anchor, 0.55);
      this.lineId = this.lines.connect(this.hitPos, this.anchor, 0.1);
    }
  }

  private layout(dt: number) {
    const t = this.time;

    // --- The nock: a star swells at the hand and flashes out at the release. ---
    const swell = t < RELEASE_T ? smoothstep(t / RELEASE_T) : 0;
    const flash = StarBurst.pop(t - RELEASE_T, 0, 0.03);
    this.nock.set(this.hand, 0.3 * swell + 0.7 * flash.scale, swell * 0.9 + flash.opacity, t * 4);

    if (this.hitAt < 0 || !this.target) return;
    const a = t - this.hitAt;
    const p = this.target.position;
    this.hitPos.set(p.x, 1.2, p.z);

    // --- The hit star, and the ground ring. ---
    const sp = StarBurst.pop(a, 0.02, 0.05);
    this.pop.set(this.hitPos, 1.0 * sp.scale, sp.opacity, 0.3);
    const g = smoothstep(a / 0.3);
    this.shock.set(this.v1.set(p.x, 0, p.z), 0.4 + (this.pin ? 2.4 : 1.6) * g, (this.pin ? 0.03 : 0.02) * (1 - g) * (1 - g));

    const fade = 1 - smoothstep((a - (STATUS_S - 0.35)) / 0.35);
    this.chart.set(this.v1.set(p.x, 0, p.z), this.pin ? 1.5 : 1.15);
    this.chart.reveal = smoothstep(a / 0.25);
    this.chart.opacity = 0.9 * fade;
    this.chart.spin = this.pin ? 0 : a * 3;

    if (this.pin) {
      // Pinned: the line holds the enemy to the wall and the pin star pulses.
      if (this.lineId >= 0) this.lines.move(this.lineId, this.hitPos, this.anchor);
      const ps = 0.5 + 0.12 * Math.sin(a * 14);
      this.pinStar.set(this.anchor, ps * smoothstep(a / 0.1) * fade, fade, a * 2);
    } else {
      // Slowed: stars hang behind the enemy's feet as they walk, one every 0.3 s.
      const k = Math.floor(a / 0.3);
      if (k < 5 && k !== this.trailK) {
        this.trailK = k;
        this.v2.set(p.x, 0.5, p.z);
        this.stars.add(this.v2, 0.28);
      }
    }
    void dt;
  }

  private trailK = -1;
}

export const pinningArrowModule: EffectModule = {
  label: 'pinning arrow',
  category: 'hero: astral',
  targeting: { mode: 'ground', radius: 1 },
  create: () => new PinningArrow(),
  telegraphs(effect) {
    const e = effect as PinningArrow;
    if (!e.ctx) return [];
    return [{ shape: e.line, start: 0, impact: RELEASE_T, until: e.flightEnd }];
  },
  bloom: { enabled: true, strength: 0.45, radius: 0.4, threshold: 0.86 },
  frameCamera(camera, controls, effect) {
    const e = effect as PinningArrow;
    if (e.ctx) frameCast(camera, controls, e.ctx, 3);
  },
  buildGui(f, effect) {
    const s = (effect as PinningArrow).settings;
    f.add(s, 'loop');
    f.add(s, 'damage', 1, 150, 1);
  },
};
