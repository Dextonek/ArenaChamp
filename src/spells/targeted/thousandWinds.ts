import * as THREE from 'three';
import { Emitter } from '../../emitter';
import { smoothstep, type Enemy } from '../../effects/common';
import { ShockRefraction, StarBurst, clearScreenFx, createScreenFx, impactFrameAt } from '../../effects/parts';
import { GustRibbon, Leaves, SKY, SKY_CSS, SpeedLines, WindCrescent } from '../../effects/parts/sky';
import { frameCast, type CastContext } from '../../effects/targeting';
import type { Effect, EffectModule } from '../../effects/types';

/**
 * Thousand Winds (sky kit, R: the MOBA ultimate). Under the normal gameplay camera, no letterbox: the world darkens to a
 * pale storm teal and a ring of crescents marks the zone. A tall spiral of gust ribbons and well over a hundred small
 * crescents rises round the zone edge to about 8 high, spinning faster while the enemies are pulled in and leaves stream
 * inward. The cyclone tightens to radius 3 and the blades freeze edge-on pointing at the centre (the dead beat), then
 * he dashes into its eye and a giant vertical crescent splits the centre: the cyclone bursts outward as a ring of
 * crescents, a pink star, the hit. Leaves and crescents fall and fade; clean by 4.5 s. See pipeline/designs/kit-sky.md.
 */
export interface ThousandWindsSettings {
  damage: number;
  loop: boolean;
}

export const defaultThousandWinds = (): ThousandWindsSettings => ({ damage: 145, loop: false });

// Timeline (seconds).
const RISE_T = 0.3; // the cyclone starts to rise
const TIGHT_T = 1.6; // it tightens to radius 3
const BEAT_T = 1.85; // dead beat 1.85..2.0
const DIVE_T = 2.0; // he dashes in
const HIT_T = 2.2;
const RAIN_END_T = 3.2;
const DURATION = 4.5;

const RADIUS = 4;
const VISUAL = RADIUS / 7; // the cyclone was drawn for a radius of 7; its tightening and burst scale with the zone
const BEAT_LEN = DIVE_T - BEAT_T;
const TOP = 7; // height of the cyclone
const N_CYC = 150; // small crescents in the cyclone
const N_MARK = 18; // crescents of the ring that marks the zone
const N_BURST = 16; // crescents of the ring the burst throws out
const N_RIBBON = 5;

const easeOut = (x: number) => 1 - Math.pow(1 - THREE.MathUtils.clamp(x, 0, 1), 3);
const sstep = (a: number, b: number, x: number) => smoothstep((x - a) / (b - a));
const hs = (x: number) => { const s = Math.sin(x * 12.9898 + 78.233) * 43758.5453; return s - Math.floor(s); };

/** The cyclone's clock: runs with the timeline but stands still during the dead beat. */
const gClock = (t: number) => (t < BEAT_T ? t : t < DIVE_T ? BEAT_T : t - BEAT_LEN);

interface Blade { h: number; ph: number; size: number; tilt: number; arc: number; jr: number }

export class ThousandWinds implements Effect {
  readonly group = new THREE.Group();
  readonly settings: ThousandWindsSettings;
  readonly emitters: Emitter[] = [];
  readonly screen = createScreenFx();
  shake = 0;
  playing = false;

  /** Last cast; frameCamera and telegraphs read it. Null until the first play(). */
  ctx: CastContext | null = null;
  private time = 0;

  // Cast geometry.
  private point = new THREE.Vector3(0, 0, -8);
  private lateral = new THREE.Vector3(1, 0, 0);
  private land = new THREE.Vector3();
  private from0 = new THREE.Vector3();
  private victims: { enemy: Enemy; feet: THREE.Vector3 }[] = [];

  private flags = { dive: false, hit: false };
  private spinA = 0;
  private leafTimer = 0;
  private rainTimer = 0;

  // Parts.
  private blades: Blade[] = [];
  private giant = new WindCrescent(2, 0);
  private crescents = new WindCrescent(0, N_CYC + N_MARK + N_BURST + 4);
  private ribbons: GustRibbon[] = [];
  private lines = new SpeedLines(24);
  private leaves = new Leaves(48);
  private pop = new StarBurst({ points: 12, inner: 0.3, color: SKY.accent, core: 0xfff0f5, additive: false });
  private groundShock = new ShockRefraction({ facing: 'ground' });

  // Scratch, and the per-frame values the ribbon paths read.
  private v1 = new THREE.Vector3();
  private v2 = new THREE.Vector3();
  private v3 = new THREE.Vector3();
  private cur = { rb: RADIUS, height: 0, spin: 0, phase: 0, turns: 1.4 };

  constructor(settings: ThousandWindsSettings = defaultThousandWinds()) {
    this.settings = settings;
    this.screen.impactColor.set(SKY.hot);
    this.screen.tint.set(SKY.dark);
    for (let i = 0; i < N_CYC; i++) {
      this.blades.push({
        h: (i + 0.5 * hs(i)) / N_CYC, ph: hs(i + 3) * Math.PI * 2, size: 0.55 + hs(i + 9) * 0.5,
        tilt: 0.45 + hs(i + 17) * 0.8, arc: 75 + hs(i + 29) * 40, jr: (hs(i + 41) - 0.5) * 0.28,
      });
    }
    for (let i = 0; i < N_RIBBON; i++) this.ribbons.push(new GustRibbon(56));
    this.group.add(
      this.crescents.mesh, this.giant.mesh, ...this.ribbons.map((r) => r.mesh), this.lines.mesh, this.leaves.mesh, this.pop.mesh, this.groundShock.mesh,
    );
    this.reset();
  }

  get duration() {
    return DURATION;
  }

  get impactTime() {
    return HIT_T;
  }

  /** True while `e` stands inside the zone right now (enemies who walked out before the impact are spared). */
  private inside(e: CastContext['targets'][number]) {
    const p = e.group.position;
    return Math.hypot(p.x - this.point.x, p.z - this.point.z) <= RADIUS;
  }

  cast(ctx: CastContext) {
    this.ctx = ctx;
    this.point.copy(ctx.point).setY(0);
    this.lateral.set(Math.cos(ctx.aim), 0, -Math.sin(ctx.aim));
    this.land.copy(this.point);
    this.from0.copy(ctx.from).setY(0);
    this.victims.length = 0;
    ctx.targets.forEach((e, i) => {
      const p = ctx.targetPos[i];
      if (!p) return;
      if (Math.hypot(p.x - this.point.x, p.z - this.point.z) > RADIUS) return;
      this.victims.push({ enemy: e, feet: p.clone().setY(0) });
    });
    this.screen.silhouettes = [ctx.caster.group, ...ctx.targets.map((e) => e.group)];
    this.screen.focus.copy(this.point).setY(2);
    this.groundShock.set(this.point, 0, 0);
  }

  play() {
    this.reset();
    this.playing = true;
  }

  private reset() {
    this.time = 0;
    this.shake = 0;
    this.spinA = 0;
    this.leafTimer = 0;
    this.rainTimer = 0;
    this.flags.dive = this.flags.hit = false;
    clearScreenFx(this.screen);
    this.screen.tint.set(SKY.dark);
    this.crescents.reset();
    this.giant.reset();
    for (const r of this.ribbons) r.reset();
    this.lines.reset();
    this.leaves.reset();
    this.giant.mesh.renderOrder = 9;
    this.pop.set(this.point, 0, 0);
    this.groundShock.set(this.point, 0, 0);
  }

  /** One gust ribbon of the tall spiral, round the funnel at the current radius and height. */
  private ribbonPath = (u: number, out: THREE.Vector3): THREE.Vector3 => {
    const c = this.cur;
    const y = u * c.height;
    const r = c.rb * (0.8 + 0.3 * (y / TOP));
    const a = c.phase + c.spin * 0.9 + u * c.turns * Math.PI * 2;
    return out.set(this.point.x + Math.cos(a) * r, y, this.point.z + Math.sin(a) * r);
  };

  update(dt: number) {
    for (const e of this.emitters) e.update(dt);
    if (!this.playing) return;
    const held = this.time >= BEAT_T && this.time < DIVE_T;
    this.crescents.frozen = held;
    this.leaves.frozen = held;
    this.lines.frozen = held;
    for (const r of this.ribbons) r.frozen = held;
    this.crescents.update(dt);
    this.giant.update(dt);
    for (const r of this.ribbons) r.update(dt);
    this.lines.update(dt);
    this.leaves.update(dt);
    this.time += dt;
    if (this.time >= DURATION) {
      this.finish();
      if (this.settings.loop) this.play();
      return;
    }
    const t = this.time;
    const ctx = this.ctx;
    const f = this.flags;

    // The cyclone spins faster as it rises; still in the dead beat, hard again for the dive, slowing after the burst.
    const after0 = t - HIT_T;
    const w = held ? 0 : t < DIVE_T ? 1.5 + 4.5 * smoothstep((t - RISE_T) / 1.3) : t < HIT_T ? 6 : 6 * Math.exp(-after0 * 1.3);
    this.spinA += dt * w;

    // Leaves stream inward from the rim while the cyclone builds.
    if (t >= RISE_T + 0.1 && t < TIGHT_T && !held) {
      this.leafTimer += dt;
      while (this.leafTimer >= 0.075) {
        this.leafTimer -= 0.075;
        const a = Math.random() * Math.PI * 2, r = RADIUS * (0.95 + Math.random() * 0.25);
        this.v1.set(this.point.x + Math.cos(a) * r, 0.5 + Math.random() * 5.5, this.point.z + Math.sin(a) * r);
        this.v2.set(-Math.cos(a) * 5 - Math.sin(a) * 3.5, 0.3, -Math.sin(a) * 5 + Math.cos(a) * 3.5);
        this.leaves.spawn(this.v1, this.v2, 0.9, 0.13 + Math.random() * 0.08);
      }
    }
    // Leaves fall through the zone after the burst.
    if (t >= HIT_T + 0.1 && t < RAIN_END_T) {
      this.rainTimer += dt;
      while (this.rainTimer >= 0.07) {
        this.rainTimer -= 0.07;
        const a = Math.random() * Math.PI * 2, r = RADIUS * 0.9 * Math.sqrt(Math.random());
        this.v1.set(this.point.x + Math.cos(a) * r, 4 + Math.random() * 3, this.point.z + Math.sin(a) * r);
        this.v2.set((Math.random() - 0.5) * 2, -(1.5 + Math.random() * 2), (Math.random() - 0.5) * 2);
        this.leaves.spawn(this.v1, this.v2, 1.2, 0.13 + Math.random() * 0.08);
      }
    }

    // 2.0..2.2: he dashes into the eye and the giant vertical crescent splits the centre.
    if (!f.dive && t >= DIVE_T) {
      f.dive = true;
      if (ctx?.moveCaster) this.land.copy(ctx.moveCaster(this.point, HIT_T - DIVE_T)).setY(0);
      this.v1.set(this.point.x, 3.0, this.point.z);
      // Face the gameplay camera, which looks along caster -> point: the plane holds the lateral axis and up.
      this.v2.set(this.point.x - this.from0.x, 0, this.point.z - this.from0.z);
      if (this.v2.lengthSq() < 1e-4) this.v2.set(Math.sin(ctx?.aim ?? 0), 0, Math.cos(ctx?.aim ?? 0));
      this.v2.normalize();
      this.v3.set(this.v2.z, 0, -this.v2.x);
      this.giant.slash(this.v1, this.v3, 2.9, 160, Math.PI / 2, 1.2, { width: 1.0, reverse: true, sweep: 0.1 });
      // A second one across it (plane along the dash) so the cut reads from any camera angle, not only face-on.
      this.giant.slash(this.v1, this.v2, 2.5, 150, Math.PI / 2, 1.2, { width: 0.8, reverse: true, sweep: 0.1, tone: 1 });
      this.v2.copy(this.land).setY(1.0);
      this.v3.set(this.point.x - this.land.x, 0, this.point.z - this.land.z);
      if (this.v3.lengthSq() < 1e-4) this.v3.copy(this.lateral);
      this.lines.sweep(this.v2.set(this.land.x - this.v3.x * 0.5, 1.0, this.land.z - this.v3.z * 0.5), this.v1.set(this.point.x, 1.0, this.point.z), 10, 2.4);
    }

    if (!f.hit && t >= HIT_T) {
      f.hit = true;
      this.shake = 0.7;
      this.v1.set(this.point.x, 1.2, this.point.z);
      this.leaves.blow(this.v1, this.v2.set(0, 1, 0), 14, 8);
      this.lines.burst(this.v1, this.v2.set(this.lateral.x, 0, this.lateral.z), 8, 2.2);
      if (ctx) {
        for (const v of this.victims) {
          if (!this.inside(v.enemy)) continue;
          ctx.hit(v.enemy, { damage: this.settings.damage, knock: 0, from: this.point, color: SKY_CSS.body, status: { kind: 'knockup', seconds: 0.5 } });
        }
      }
    }

    this.layout();
  }

  private finish() {
    this.playing = false;
    this.shake = 0;
    const ctx = this.ctx;
    if (ctx) for (const v of this.victims) ctx.displace(v.enemy, this.v3.set(0, 0, 0));
    this.reset();
  }

  private layout() {
    const t = this.time;
    const ctx = this.ctx;
    const after = t - HIT_T;
    const g = gClock(t);

    // --- Screen: pale storm teal, a lift at the landing, lifting away as the leaves fall. Impact frames at the hit. ---
    let dk = 0.5 * smoothstep(t / 0.4) * (1 - smoothstep((t - 3.4) / 1.0));
    if (after >= 0) dk *= 1 - 0.3 * Math.exp(-after * 10);
    this.screen.darken = dk;
    this.screen.impact = impactFrameAt(t, HIT_T, [1, 2], 0.04);

    // --- The funnel: its height, its radius (tightening, then bursting outward) and the spin. ---
    const height = TOP * smoothstep((t - RISE_T) / 1.3);
    const tight = smoothstep((t - TIGHT_T) / 0.25);
    let rb = RADIUS - 4 * VISUAL * tight;
    if (t >= DIVE_T) rb -= 0.4 * VISUAL * smoothstep((t - DIVE_T) / 0.2);
    if (after >= 0) rb = (2.6 + 6.2 * easeOut(after / 0.55)) * VISUAL;
    const burstFade = after >= 0 ? 1 - sstep(0.4, 2.2, after) : 1;
    const fallK = after >= 0 ? sstep(0, 2.4, after) : 0;
    const e2 = after >= 0 ? smoothstep(after / 0.3) : 0;

    // --- Ring of crescents on the floor marking the radius: up in 0.4 s, gone after the burst. ---
    const markOp = smoothstep(t / 0.4) * (after >= 0 ? 1 - sstep(0.1, 0.7, after) : 1);
    if (markOp > 0.01) {
      for (let k = 0; k < N_MARK; k++) {
        const a = (k / N_MARK) * Math.PI * 2 + 0.12 * Math.sin(k * 3.1);
        this.v1.set(this.point.x, 0.12, this.point.z);
        this.crescents.put(this.v1, Math.atan2(Math.cos(a), Math.sin(a)), 0, RADIUS, 13 + 7 * hs(k + 60), 1.1, markOp, 0.24);
      }
    }

    // --- The cyclone of small crescents. ---
    if (height > 0.05 && burstFade > 0.01) {
      for (const b of this.blades) {
        const y0 = b.h * TOP;
        const vis = THREE.MathUtils.clamp((height - y0) / 0.7, 0, 1);
        const op = vis * burstFade * (t >= DIVE_T && after < 0 ? 0.5 : 1);
        if (op < 0.02) continue;
        const R = rb * (0.8 + 0.3 * b.h) * (1 + b.jr);
        const th = b.ph + this.spinA * (1 + 0.3 * (1 - b.h));
        const c = Math.cos(th), s = Math.sin(th);
        // Heading: along the spin, turning edge-on to the centre as it tightens, then out as it bursts.
        let hx = -s * (1 - tight) - c * tight, hz = c * (1 - tight) - s * tight;
        if (e2 > 0) { hx = hx * (1 - e2) + c * e2; hz = hz * (1 - e2) + s * e2; }
        const hl = Math.hypot(hx, hz) || 1;
        hx /= hl; hz /= hl;
        const y = y0 * (1 - 0.85 * fallK) + 0.15;
        this.v1.set(this.point.x + c * R - hx * b.size * 0.7, y, this.point.z + s * R - hz * b.size * 0.7);
        this.crescents.put(this.v1, Math.atan2(hx, hz), b.tilt + (1.35 - b.tilt) * tight, b.size, b.arc, 1.1, op, Math.max(0.16, b.size * 0.22), b.h > 0.93 && b.ph < 0.9 ? 1 : 0);
      }
    }

    // --- The ring of crescents the burst throws out across the zone. ---
    if (after >= 0 && after < 1.0) {
      const rr = (1.2 + (7 - 1.0) * easeOut(after / 0.45)) * VISUAL;
      const op = 1 - sstep(0.3, 1.0, after);
      for (let k = 0; k < N_BURST; k++) {
        const a = (k / N_BURST) * Math.PI * 2 + 0.2 * Math.sin(k * 2.7) + after * 0.8;
        this.v1.set(this.point.x, 0.3, this.point.z);
        this.crescents.put(this.v1, Math.atan2(Math.cos(a), Math.sin(a)), 0.15, rr, 26 + 10 * hs(k + 80), 1.1, op, 0.3, k === 0 ? 1 : 0);
      }
    }

    // --- The tall spiral of gust ribbons. ---
    const c = this.cur;
    c.rb = rb;
    c.height = Math.max(height, 0.01);
    c.spin = this.spinA;
    const ribOp = after >= 0 ? 1 - sstep(0, 0.6, after) : 1;
    for (let i = 0; i < N_RIBBON; i++) {
      c.phase = (i / N_RIBBON) * Math.PI * 2;
      c.turns = 1.3 + 0.12 * i;
      if (height > 0.4 && ribOp > 0.01) this.ribbons[i].setFunction(this.ribbonPath, 0.34, 1, 0, g, ribOp);
      else this.ribbons[i].hide();
    }

    // --- The pull on the enemies: in while the cyclone builds, released at the landing. ---
    if (ctx) {
      const pull = 0.4 * smoothstep((t - RISE_T) / 1.3) * (1 - smoothstep(after / 0.3));
      for (const v of this.victims) {
        this.v3.set(this.point.x - v.feet.x, 0, this.point.z - v.feet.z).multiplyScalar(pull);
        ctx.displace(v.enemy, this.v3);
      }
    }

    // --- The landing: pink star at the centre, ground refraction, shake. ---
    if (this.flags.hit) {
      const sp = StarBurst.pop(after, 0, 0.05);
      this.pop.set(this.v1.set(this.point.x, 1.2, this.point.z), 2 * sp.scale, sp.opacity, 0.2);
      const gp = THREE.MathUtils.clamp(after / 0.5, 0, 1);
      this.groundShock.set(this.point, 1 + 11 * gp, 0.07 * (1 - gp) * (1 - gp));
      this.shake = 0.7 * Math.exp(-after * 9);
    }
  }
}

export const thousandWindsModule: EffectModule = {
  label: 'thousand winds',
  category: 'hero: sky',
  targeting: { mode: 'ground', radius: RADIUS },
  create: () => new ThousandWinds(),
  telegraphs(effect) {
    const e = effect as ThousandWinds;
    const ctx = e.ctx;
    if (!ctx) return [];
    return [{ shape: { kind: 'circle', x: ctx.point.x, z: ctx.point.z, radius: RADIUS }, start: 0, impact: HIT_T }];
  },
  bloom: { enabled: true, strength: 0.4, radius: 0.4, threshold: 0.86 },
  frameCamera(camera, controls, effect) {
    const e = effect as ThousandWinds;
    if (e.ctx) frameCast(camera, controls, e.ctx, 10);
  },
  buildGui(f, effect) {
    const s = (effect as ThousandWinds).settings;
    f.add(s, 'loop');
    f.add(s, 'damage', 1, 300, 1);
  },
};
