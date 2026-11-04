import * as THREE from 'three';
import { Emitter } from '../../emitter';
import { StarBurst, clearScreenFx, createScreenFx, impactFrameAt } from '../../effects/parts';
import { Clods, Cracks, GroundRing, LampGlow, MOLE, MOLE_CSS, Pickaxe, Puffs, buildPit } from '../../effects/parts/mole';
import { frameCast, type CastContext } from '../../effects/targeting';
import type { Effect, EffectModule } from '../../effects/types';
import { SINK_DAMAGE, SINK_DELAY, SINK_RADIUS, SINK_ROOT } from '../../traits/mole';

/**
 * Sinkhole (mole kit, R: a pit under the enemy). A click on the enemy within 9 m (the engine checks sight at the cast). The circle
 * (4 m radius) is fixed where they stood. For 1.3 s the ground shudders: Mabel taps her tiny pickaxe on the floor, a tremor ring runs out
 * from the centre with each tap (0.15, 0.5, 0.85 s), cracks run toward the rim, the ground inside darkens, pebbles hop and dust
 * rises along the edge. At 1.3 s the ground drops: a pit of the full 4 m opens (a dark hollow, a raised rim of dirt), clods fly, a dust
 * ring runs out, one short impact frame. Everyone inside the circle on their live position takes 90 and is rooted 1 s. The pit stays
 * a second, then crumbles shut. Telegraph: the circle, impact at the drop (she is rooted 1.3 s). Clean by about 2.8 s. See
 * pipeline/designs/kit-mole.md.
 */
export interface SinkholeSettings {
  damage: number;
  /** Root seconds (engine cap 1.5). */
  root: number;
  loop: boolean;
}

export const defaultSinkhole = (): SinkholeSettings => ({ damage: SINK_DAMAGE, root: SINK_ROOT, loop: false });

const DURATION = 3.0;
const TAPS = [0.15, 0.5, 0.85];
const SHUT_AT = SINK_DELAY + 1.0;

export class Sinkhole implements Effect {
  readonly group = new THREE.Group();
  readonly settings: SinkholeSettings;
  readonly emitters: Emitter[] = [];
  readonly screen = createScreenFx();
  shake = 0;
  playing = false;

  /** Last cast; frameCamera and telegraphs read it. Null until the first play(). */
  ctx: CastContext | null = null;
  readonly spot = new THREE.Vector3();
  private time = 0;
  private tapped = 0;
  private dropped = false;
  private shut = false;
  private lastEdge = 0;
  private yaw = 0;
  private hand = new THREE.Vector3();
  private head = new THREE.Vector3();

  private pit = buildPit(SINK_RADIUS);
  private shade = new THREE.Mesh(
    new THREE.CircleGeometry(SINK_RADIUS, 40).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ color: MOLE.deep, transparent: true, opacity: 0, depthWrite: false }),
  );
  private clods = new Clods(80);
  private puffs = new Puffs(30);
  private cracks = new Cracks(12);
  private ring = new GroundRing(MOLE.light);
  private tremor = new GroundRing(MOLE.foil);
  private pick = new Pickaxe();
  private lamp = new LampGlow();
  private star = new StarBurst({ points: 12, inner: 0.3, color: MOLE.foil, core: 0xffffff, additive: false });

  private v1 = new THREE.Vector3();

  constructor(settings: SinkholeSettings = defaultSinkhole()) {
    this.settings = settings;
    this.shade.position.y = 0.04;
    this.shade.renderOrder = 1;
    this.shade.frustumCulled = false;
    this.screen.impactColor.set(MOLE.dirt);
    this.group.add(
      this.shade, this.pit, this.cracks.mesh, this.clods.mesh, this.puffs.mesh, this.ring.mesh, this.tremor.mesh, this.pick.mesh,
      this.lamp.mesh, this.star.mesh,
    );
    this.reset();
  }

  get duration() {
    return DURATION;
  }

  get impactTime() {
    return SINK_DELAY;
  }

  cast(ctx: CastContext) {
    this.ctx = ctx;
    this.spot.copy(ctx.targetPos[0] ?? ctx.point).setY(0);
    const s = ctx.sentFrom ?? ctx.from;
    this.yaw = Math.atan2(this.spot.x - s.x, this.spot.z - s.z);
    this.hand.set(s.x + Math.sin(this.yaw) * 0.9, 0, s.z + Math.cos(this.yaw) * 0.9);
    this.head.set(s.x, 1.65, s.z);
    this.pit.position.set(this.spot.x, 0, this.spot.z);
    this.shade.position.set(this.spot.x, 0.04, this.spot.z);
    this.screen.silhouettes = [ctx.caster.group, ...ctx.targets.map((e) => e.group)];
    this.screen.focus.copy(this.spot).setY(0.5);
  }

  play() {
    this.reset();
    this.playing = true;
  }

  private reset() {
    this.time = 0;
    this.shake = 0;
    this.tapped = 0;
    this.dropped = false;
    this.shut = false;
    this.lastEdge = 0;
    clearScreenFx(this.screen);
    this.screen.impactColor.set(MOLE.dirt);
    this.clods.reset();
    this.puffs.reset();
    this.pit.scale.setScalar(1e-4);
    ((this.shade.material) as THREE.MeshBasicMaterial).opacity = 0;
    this.cracks.set(this.spot, SINK_RADIUS, 0, 0);
    this.ring.set(this.spot, 0, 0);
    this.tremor.set(this.spot, 0, 0);
    this.pick.hide();
    this.lamp.set(this.head, 0, 0);
    this.star.set(this.spot, 0, 0);
  }

  update(dt: number) {
    for (const e of this.emitters) e.update(dt);
    this.clods.update(dt);
    this.puffs.update(dt);
    if (!this.playing) return;
    this.time += dt;
    const t = this.time, ctx = this.ctx;
    if (t >= DURATION) {
      const loop = this.settings.loop;
      this.playing = false;
      clearScreenFx(this.screen);
      this.reset();
      if (loop) this.play();
      return;
    }

    // --- 0..1.3: the ground shudders. Taps, tremor rings, cracks, a darkening floor, hopping pebbles. ---
    if (t < SINK_DELAY) {
      let swing = -0.5;
      for (const tt of TAPS) {
        const a = t - (tt - 0.1);
        if (a >= 0 && a < 0.14) swing = -0.5 + 1.2 * Math.sin((Math.PI * a) / 0.14);
      }
      this.pick.place(this.hand, this.yaw + Math.PI, swing, THREE.MathUtils.clamp(t / 0.06, 0, 1) * 2.2);
      while (this.tapped < TAPS.length && t >= TAPS[this.tapped]) {
        this.tapped++;
        this.shake = Math.max(this.shake, 0.08 + 0.03 * this.tapped);
        this.puffs.puff(this.v1.set(this.hand.x, 0.15, this.hand.z), 0.5);
        this.clods.burst(this.v1, 3, 2.2, 0.6, 0.7);
      }
      // A tremor ring after each tap, from the centre to the rim.
      let tr = 0;
      for (const tt of TAPS) {
        const a = (t - tt) / 0.5;
        if (a >= 0 && a < 1) tr = Math.max(tr, a);
      }
      const last = (t - 1.1) / 0.2;
      if (last >= 0) tr = Math.max(tr, Math.min(1, last));
      this.tremor.set(this.spot, SINK_RADIUS * (tr || 0.001), tr > 0 ? 0.65 * (1 - tr) : 0);
      this.cracks.set(this.spot, SINK_RADIUS * 0.95, THREE.MathUtils.smoothstep(t, 0.05, 1.15), 0.95);
      ((this.shade.material) as THREE.MeshBasicMaterial).opacity = 0.42 * THREE.MathUtils.smoothstep(t, 0.1, 1.2);
      this.screen.darken = 0.1 * THREE.MathUtils.smoothstep(t, 0.3, 1.2);
      this.lamp.set(this.head, 1.0, 0.5 + 0.3 * Math.sin(t * 30) + 0.3 * (t / SINK_DELAY));
      if (t - this.lastEdge >= 0.07) {
        this.lastEdge = t;
        const a = Math.random() * Math.PI * 2, r = SINK_RADIUS * (0.55 + Math.random() * 0.4);
        this.v1.set(this.spot.x + Math.cos(a) * r, 0.1, this.spot.z + Math.sin(a) * r);
        if (Math.random() < 0.6) this.puffs.puff(this.v1, 0.45 + 0.4 * (t / SINK_DELAY), MOLE.light, 0.6);
        else this.clods.throw(this.v1, new THREE.Vector3((Math.random() - 0.5) * 0.8, 2 + Math.random() * 1.4, (Math.random() - 0.5) * 0.8), 0.12, 0.7);
      }
    }

    // --- 1.3: the ground drops. Judged on live positions. ---
    if (!this.dropped && t >= SINK_DELAY) {
      this.dropped = true;
      this.pick.hide();
      this.shake = 0.7;
      if (ctx) {
        const foes = ctx.enemies?.() ?? ctx.targets;
        for (const e of foes) {
          const p = e.group.position;
          if (Math.hypot(p.x - this.spot.x, p.z - this.spot.z) > SINK_RADIUS) continue;
          ctx.hit(e, { damage: this.settings.damage, knock: 0, from: this.spot.clone(), color: MOLE_CSS.soil, status: { kind: 'root', seconds: this.settings.root } });
        }
      }
      // Clods thrown up from the rim and from the middle, a ring of dust running out.
      for (let i = 0; i < 18; i++) {
        const a = (i / 18) * Math.PI * 2 + Math.random() * 0.3, r = SINK_RADIUS * (0.7 + Math.random() * 0.35);
        this.v1.set(this.spot.x + Math.cos(a) * r, 0.3, this.spot.z + Math.sin(a) * r);
        this.clods.throw(this.v1, new THREE.Vector3(Math.cos(a) * (1.5 + Math.random() * 2), 4 + Math.random() * 3, Math.sin(a) * (1.5 + Math.random() * 2)), 0.2 + Math.random() * 0.2, 1.2);
      }
      this.clods.burst(this.v1.set(this.spot.x, 0.3, this.spot.z), 14, 3, 1.3, 1.4);
      this.puffs.ring(this.spot, SINK_RADIUS * 0.8, 12, 1.3);
      this.puffs.ring(this.spot, SINK_RADIUS * 0.35, 6, 1.0, MOLE.soil);
    }
    if (this.dropped) {
      const a = t - SINK_DELAY;
      // The pit drops in fast (a small overshoot), stays, then crumbles shut.
      const open = (1 + 0.06 * Math.sin(THREE.MathUtils.clamp(a / 0.2, 0, 1) * Math.PI)) * THREE.MathUtils.smoothstep(a, 0, 0.12);
      const close = 1 - THREE.MathUtils.smoothstep(t, SHUT_AT, SHUT_AT + 0.7);
      this.pit.scale.setScalar(Math.max(1e-4, open * close));
      ((this.shade.material) as THREE.MeshBasicMaterial).opacity = 0;
      this.cracks.set(this.spot, SINK_RADIUS * 0.95, 1, Math.max(0, 0.95 - a * 4));
      const rk = THREE.MathUtils.clamp(a / 0.5, 0, 1);
      this.ring.set(this.spot, SINK_RADIUS * (0.5 + 0.9 * rk), 0.8 * (1 - rk) * (1 - rk));
      this.tremor.set(this.spot, SINK_RADIUS * (0.3 + 1.1 * rk), 0.6 * (1 - rk));
      const sp = StarBurst.pop(a, 0.04, 0.14);
      this.star.set(this.v1.set(this.spot.x, 1.4, this.spot.z), 2.2 * sp.scale, sp.opacity, a * 4);
      this.screen.impact = impactFrameAt(t, SINK_DELAY, [1], 0.04);
      this.screen.darken = 0.1 * (1 - THREE.MathUtils.smoothstep(a, 0, 0.4));
      this.lamp.set(this.head, 1.2, Math.max(0, 0.8 - a * 3));
      if (!this.shut && t >= SHUT_AT) {
        this.shut = true;
        this.clods.burst(this.v1.set(this.spot.x, 0.3, this.spot.z), 10, 2.6, 1.1, 1);
        this.puffs.ring(this.spot, SINK_RADIUS * 0.6, 8, 1.0);
      }
    }
    this.shake *= Math.exp(-dt * 9);
  }
}

export const sinkholeModule: EffectModule = {
  label: 'sinkhole',
  category: 'hero: mole',
  // Click an enemy within 9 m (the engine checks sight at the cast). The circle is fixed where they stood: step out of it.
  targeting: { mode: 'enemy' },
  create: () => new Sinkhole(),
  telegraphs(effect) {
    const e = effect as Sinkhole;
    if (!e.ctx) return [];
    return [{ shape: { kind: 'circle', x: e.spot.x, z: e.spot.z, radius: SINK_RADIUS }, start: 0, impact: SINK_DELAY }];
  },
  bloom: { enabled: true, strength: 0.4, radius: 0.4, threshold: 0.86 },
  frameCamera(camera, controls, effect) {
    const e = effect as Sinkhole;
    if (e.ctx) frameCast(camera, controls, e.ctx, 3);
  },
  buildGui(f, effect) {
    const s = (effect as Sinkhole).settings;
    f.add(s, 'loop');
    f.add(s, 'damage', 1, 200, 1);
    f.add(s, 'root', 0.2, 1.5, 0.1);
  },
};
