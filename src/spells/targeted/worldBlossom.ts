import * as THREE from 'three';
import { Emitter } from '../../emitter';
import { smoothstep } from '../../effects/common';
import { ShockRefraction, StarBurst, clearScreenFx, createScreenFx, impactFrameAt } from '../../effects/parts';
import { GROVE, GROVE_CSS, Bloom, Petals, Pollen, RootRing, SpiralVine } from '../../effects/parts/grove';
import { frameCast, type CastContext } from '../../effects/targeting';
import type { Effect, EffectModule } from '../../effects/types';

/**
 * World Blossom (grove kit, R: the MOBA ultimate). Under the normal gameplay camera, no letterbox: the world darkens to
 * a green dusk, roots spread over the whole zone and a trunk of four braided spiral vines grows up from the point. A
 * giant bud on top opens into a flower about 8 wide, then folds shut like a fist. A dead beat, then the petals slam
 * down flat over the zone: impact frames, a ring of smaller flowers bursts open across the radius, petals and pollen
 * explode outward. Petals rain down and fade, the vines wither, the roots fade, the darkness lifts. Clean by 4.5 s.
 * See pipeline/designs/kit-grove.md.
 */
export interface WorldBlossomSettings {
  damage: number;
  loop: boolean;
}

export const defaultWorldBlossom = (): WorldBlossomSettings => ({ damage: 130, loop: false });

// Timeline (seconds).
const TRUNK_T = 0.3; // the trunk starts to grow (up by 1.1)
const BLOOM_T = 1.0; // the bud forms and opens (open by 1.5)
const CLOSE_T = 1.5; // the flower folds shut
const DEAD_A = 1.85; // dead beat: everything stops
const DEAD_B = 2.0; // the slam starts
const HIT_T = 2.2;
const DURATION = 4.5;

const RADIUS = 7;
const TRUNK = 4;
const HOLD = 3;
const RING = 9;
const TOP = 3.8; // trunk height, the flower sits on top
const BIG = 3.6; // petal length of the big flower

export class WorldBlossom implements Effect {
  readonly group = new THREE.Group();
  readonly settings: WorldBlossomSettings;
  readonly emitters: Emitter[] = [];
  readonly screen = createScreenFx();
  shake = 0;
  playing = false;

  /** Last cast; frameCamera and telegraphs read it. Null until the first play(). */
  ctx: CastContext | null = null;
  private time = 0;

  // Cast geometry, computed in cast().
  private point = new THREE.Vector3(0, 0, -8);
  private fwd = new THREE.Vector3(0, 0, -1);
  private staff = new THREE.Vector3(0, 0.4, 14);

  // Event flags.
  private flags = { roots: false, bloom: false, close: false, implode: false, impacted: false, shed: false, rain: [false, false, false] };
  private ringAt: number[] = [];
  private ringOpened: boolean[] = [];

  // Parts.
  private roots = new RootRing();
  private trunk: SpiralVine[] = [];
  private holds: SpiralVine[] = [];
  private main = new Bloom();
  private ring: Bloom[] = [];
  private petals = new Petals(64);
  private pollen = new Pollen(72);
  private pop = new StarBurst({ points: 12, inner: 0.3, color: GROVE.accent, core: 0xfff0f6, additive: false });
  private plant = new StarBurst({ points: 4, inner: 0.2, jitter: 0, color: GROVE.hot, core: GROVE.core, additive: false });
  private groundShock = new ShockRefraction({ facing: 'ground' });

  // Scratch.
  private v1 = new THREE.Vector3();
  private v2 = new THREE.Vector3();

  constructor(settings: WorldBlossomSettings = defaultWorldBlossom()) {
    this.settings = settings;
    this.screen.impactColor.set(GROVE.bark);
    this.screen.tint.set(GROVE.dark);
    this.petals.life = 1.2;
    for (let i = 0; i < TRUNK; i++) { const v = new SpiralVine(40, 6, 3); v.sinkDepth = TOP + 0.6; this.trunk.push(v); }
    for (let i = 0; i < HOLD; i++) this.holds.push(new SpiralVine(28, 6, 4));
    for (let i = 0; i < RING; i++) { this.ring.push(new Bloom()); this.ringAt.push(0); this.ringOpened.push(false); }
    this.group.add(
      this.roots.mesh, ...this.trunk.map((v) => v.mesh), ...this.holds.map((v) => v.mesh), this.main.mesh,
      ...this.ring.map((b) => b.mesh), this.petals.mesh, this.pollen.mesh, this.pop.mesh, this.plant.mesh, this.groundShock.mesh,
    );
    this.reset();
  }

  get duration() {
    return DURATION;
  }

  get impactTime() {
    return HIT_T;
  }

  cast(ctx: CastContext) {
    this.ctx = ctx;
    this.point.copy(ctx.point).setY(0);
    this.fwd.set(Math.sin(ctx.aim), 0, Math.cos(ctx.aim));
    this.staff.copy(ctx.from).addScaledVector(this.fwd, 0.5).setY(0.4);
    this.screen.silhouettes = [ctx.caster.group, ...ctx.targets.map((e) => e.group)];
    this.screen.focus.copy(this.v1.copy(this.point).setY(2));
  }

  play() {
    this.reset();
    this.playing = true;
    // The braided trunk: four spiral strands twisting around the same axis, a quarter turn apart.
    this.v1.copy(this.point).setY(0.05);
    for (let i = 0; i < TRUNK; i++) {
      this.trunk[i].grow(this.v1, this.v2.set(0, 1, 0), TOP, 2.6, 0.4, 0.8, { coilRadius: 0.42, phase: (i / TRUNK) * Math.PI * 2, delay: TRUNK_T });
    }
    // Vines coil around up to three enemies inside the zone.
    const ctx = this.ctx;
    let n = 0;
    if (ctx) {
      for (let i = 0; i < ctx.targets.length && n < HOLD; i++) {
        const p = ctx.targetPos[i];
        if (!p || Math.hypot(p.x - this.point.x, p.z - this.point.z) > RADIUS) continue;
        this.v1.set(p.x, 0.05, p.z);
        this.holds[n].grow(this.v1, this.v2.set(0, 1, 0), 2.3, 2.4, 0.3, 0.5, { coilRadius: 0.62, phase: Math.random() * 6, delay: 0.5 + n * 0.05 });
        n++;
      }
    }
  }

  private reset() {
    this.time = 0;
    this.shake = 0;
    const f = this.flags;
    f.roots = f.bloom = f.close = f.implode = f.impacted = f.shed = false;
    f.rain.fill(false);
    this.ringOpened.fill(false);
    clearScreenFx(this.screen);
    this.roots.reset();
    for (const v of this.trunk) v.reset();
    for (const v of this.holds) v.reset();
    this.main.reset();
    for (const b of this.ring) b.reset();
    this.petals.reset();
    this.pollen.reset();
    this.pop.set(this.point, 0, 0);
    this.plant.set(this.staff, 0, 0);
    this.groundShock.set(this.point, 0, 0);
    const ctx = this.ctx;
    if (ctx) for (const e of ctx.targets) ctx.displace(e, this.v1.set(0, 0, 0));
  }

  update(dt: number) {
    for (const e of this.emitters) e.update(dt);
    if (!this.playing) return;
    const frozen = this.time >= DEAD_A && this.time < DEAD_B;
    if (!frozen) {
      this.roots.update(dt);
      for (const v of this.trunk) v.update(dt);
      for (const v of this.holds) v.update(dt);
      this.main.update(dt);
      for (const b of this.ring) b.update(dt);
      this.petals.update(dt);
      this.pollen.update(dt);
    }
    this.time += dt;
    if (this.time >= DURATION) {
      if (this.settings.loop) { this.play(); return; }
      this.playing = false;
      clearScreenFx(this.screen);
      this.shake = 0;
      this.reset();
      return;
    }
    const t = this.time;
    const ctx = this.ctx;
    const f = this.flags;

    // Events.
    if (!f.roots) {
      f.roots = true;
      this.roots.spread(this.point, RADIUS, 0.4);
      this.pollen.drift(this.point, 5, 10, 4, 2.4);
    }
    if (!f.bloom && t >= BLOOM_T) {
      f.bloom = true;
      this.v1.copy(this.point).setY(TOP);
      this.main.open(this.v1, BIG, 0.5);
      this.pollen.drift(this.point, 4.5, 12, 6, 2.2);
    }
    if (!f.close && t >= CLOSE_T) {
      f.close = true;
      this.main.close(DEAD_A - CLOSE_T);
    }
    // Ring flowers burst open one after the other, from the centre outward, in a blink after the hit.
    if (f.impacted) {
      for (let i = 0; i < RING; i++) {
        if (!this.ringOpened[i] && t >= this.ringAt[i]) {
          this.ringOpened[i] = true;
          const a = (i / RING) * Math.PI * 2 + (Math.random() - 0.5) * 0.5;
          const r = 2.4 + Math.random() * 3.6;
          this.v1.set(this.point.x + Math.cos(a) * r, 0.05, this.point.z + Math.sin(a) * r);
          this.ring[i].open(this.v1, 0.9 + Math.random() * 0.5, 0.3);
          this.pollen.puff(this.v1.setY(0.8), 3);
        }
      }
    }
    if (!f.implode && t >= DEAD_B) {
      f.implode = true;
      this.pollen.drift(this.point, 5, 8, 5, 1.6);
    }
    if (!f.impacted && t >= HIT_T) {
      f.impacted = true;
      this.land();
      if (ctx) {
        ctx.targets.forEach((e, i) => {
          const p = ctx.targetPos[i];
          if (p && Math.hypot(p.x - this.point.x, p.z - this.point.z) <= RADIUS) {
            ctx.hit(e, { damage: this.settings.damage, knock: 6, from: this.point, color: GROVE_CSS.body });
          }
        });
      }
    }
    [2.3, 2.6, 2.9].forEach((ta, i) => {
      if (!f.rain[i] && t >= ta) { f.rain[i] = true; this.petals.rain(this.point, 6.2, 12, 6, 1.4); }
    });
    if (f.impacted && t >= 3.0 && !f.shed) {
      f.shed = true;
      this.ring.forEach((b, i) => b.shed(0.9 + (i % 3) * 0.04));
      this.roots.fade(1.0, 0.1);
    }

    this.layout();
  }

  /** The hit: the flat flower bursts, ring flowers, petals, pollen, wither. */
  private land() {
    this.main.hide();
    this.v1.copy(this.point).setY(0.6);
    this.petals.burst(this.v1, 28, 9);
    this.pollen.puff(this.v1, 14);
    this.pollen.puff(this.v1.setY(1.6), 12);
    for (let i = 0; i < RING; i++) this.ringAt[i] = HIT_T + 0.02 + (i / RING) * 0.18;
    for (const v of this.trunk) v.wither(0.45, 0.02);
    for (const v of this.holds) v.wither(0.5, 0);
    this.shake = 0.75;
  }

  private layout() {
    const t = this.time;
    const after = t - HIT_T;
    const f = this.flags;
    const ctx = this.ctx;

    // --- Screen: green dusk, a lift at the hit and toward the end; the impact frames. ---
    let dk = 0.5 * smoothstep(t / 0.4) * (1 - smoothstep((t - 3.3) / 1.1));
    if (after >= 0) dk *= 1 - 0.3 * Math.exp(-after * 10);
    this.screen.darken = dk;
    this.screen.impact = impactFrameAt(t, HIT_T, [1, 2], 0.04);

    // --- Planting the staff: a hot flare in the first 0.4 s. ---
    const af = t < 0.4 ? Math.sin(Math.PI * (t / 0.4)) : 0;
    this.plant.set(this.staff, 0.9 * af, af > 0.05 ? 1 : 0, t * 2);

    // --- The flower: sways on top of the trunk, then the slam (2.0..2.2) splays the petals flat over the zone. ---
    if (this.main.visible && !f.impacted) {
      const k = t < DEAD_B ? 0 : Math.min(1, (t - DEAD_B) / (HIT_T - DEAD_B));
      const e = k * k * k;
      this.main.pos.set(this.point.x, TOP + (0.2 - TOP) * e, this.point.z);
      this.main.flatten = e;
    }

    // --- Enemies are pulled 0.5 toward the middle until the hit. ---
    if (ctx) {
      const k = t < HIT_T ? smoothstep((t - 0.3) / 1.3) : 0;
      ctx.targets.forEach((e, i) => {
        const p = ctx.targetPos[i];
        if (!p) return;
        const dx = this.point.x - p.x, dz = this.point.z - p.z;
        const d = Math.hypot(dx, dz);
        if (d > RADIUS || d < 1e-4) { ctx.displace(e, this.v1.set(0, 0, 0)); return; }
        const pull = Math.min(0.5 * k, d);
        ctx.displace(e, this.v1.set((dx / d) * pull, 0, (dz / d) * pull));
      });
    }

    // --- Hit: accent star (3 frames), ground refraction, shake. ---
    if (f.impacted) {
      const sp = StarBurst.pop(after, 0, 0.05);
      this.pop.set(this.v1.copy(this.point).setY(1.4), 2 * sp.scale, sp.opacity, 0.2);
      const gp = THREE.MathUtils.clamp(after / 0.5, 0, 1);
      this.groundShock.set(this.point, 1 + 11 * gp, 0.07 * (1 - gp) * (1 - gp));
      this.shake = 0.75 * Math.exp(-after * 9);
    }
  }
}

export const worldBlossomModule: EffectModule = {
  label: 'world blossom',
  category: 'hero: grove',
  targeting: { mode: 'ground', radius: RADIUS },
  create: () => new WorldBlossom(),
  telegraphs(effect) {
    const e = effect as WorldBlossom;
    const ctx = e.ctx;
    if (!ctx) return [];
    return [{ shape: { kind: 'circle', x: ctx.point.x, z: ctx.point.z, radius: RADIUS }, start: 0, impact: HIT_T }];
  },
  bloom: { enabled: true, strength: 0.45, radius: 0.4, threshold: 0.86 },
  frameCamera(camera, controls, effect) {
    const e = effect as WorldBlossom;
    if (e.ctx) frameCast(camera, controls, e.ctx, 11);
  },
  buildGui(f, effect) {
    const s = (effect as WorldBlossom).settings;
    f.add(s, 'loop');
    f.add(s, 'damage', 1, 300, 1);
  },
};
