import * as THREE from 'three';
import { Emitter } from '../../emitter';
import { smoothstep, type Enemy } from '../../effects/common';
import { ShockRefraction, StarBurst, clearScreenFx, createScreenFx, impactFrameAt } from '../../effects/parts';
import { INK, INK_CSS, InkBleed, Seal, Splatter, Stroke } from '../../effects/parts/ink';
import { frameCast, type CastContext } from '../../effects/targeting';
import type { Effect, EffectModule } from '../../effects/types';

/**
 * Final Calligraphy (ink kit, R: the MOBA ultimate). Under the normal gameplay camera, no letterbox: the world darkens to
 * sumi black and a vast sheet of rice paper (radius 7, torn edge) unrolls over the zone. A giant brush (about 5 tall,
 * built from strokes) comes down over the point and paints one huge character across the paper, stroke by stroke, a
 * splatter flying off each stroke end, while enemies drift toward the centre. At 1.6 the brush lifts away; dead beat
 * 1.85-2.0; a giant vermilion seal drops from above onto the middle of the character. At 2.2: two impact frames, the
 * ink erupts upward as a wall of splatter and flakes, a vermilion star, ground refraction, the hit and a blind. The
 * flakes drift down, the paper fades, the dark lifts. Clean by 4.5 s. See pipeline/designs/kit-ink.md.
 */
export interface FinalCalligraphySettings {
  damage: number;
  blindSeconds: number;
  loop: boolean;
}

export const defaultFinalCalligraphy = (): FinalCalligraphySettings => ({ damage: 95, blindSeconds: 1.5, loop: false });

// Timeline (seconds).
const MARK_END = 0.4; // darkness in, the paper unrolled
const BRUSH_T = 0.3; // the brush appears and comes down
const LIFT_T = 1.6; // the brush lifts away
const LIFT_END = 1.85;
const BEAT_END = 2.0; // dead beat 1.85..2.0
const HIT_T = 2.2;
const DARK_END = 4.2;
const DURATION = 4.5;

const RADIUS = 7;
const SCALE = 5.2; // the character spans about +-0.9 of this
const GROUND = 0.1;
const TIP_Y = 0.3;
const WALL_RISE = 2.5;

/** 永 in five strokes: (u right, v away from the caster), each painted over [start, start + dur]. */
const CHAR: { w: number; start: number; dur: number; pts: [number, number][] }[] = [
  { w: 1.5, start: 0.45, dur: 0.10, pts: [[-0.12, 0.98], [0.0, 0.9], [0.14, 0.78]] },
  { w: 1.4, start: 0.59, dur: 0.24, pts: [[-0.82, 0.66], [-0.2, 0.7], [0.5, 0.68], [0.82, 0.66], [0.74, 0.5], [0.62, 0.42]] },
  { w: 1.6, start: 0.87, dur: 0.22, pts: [[0.04, 0.78], [0.02, 0.3], [0.0, -0.3], [-0.02, -0.8], [-0.2, -0.72]] },
  { w: 1.4, start: 1.13, dur: 0.18, pts: [[-0.02, 0.2], [-0.3, 0.02], [-0.6, -0.25], [-0.88, -0.6]] },
  { w: 1.6, start: 1.35, dur: 0.22, pts: [[0.04, 0.2], [0.32, -0.02], [0.62, -0.38], [0.92, -0.75]] },
];

export class FinalCalligraphy implements Effect {
  readonly group = new THREE.Group();
  readonly settings: FinalCalligraphySettings;
  readonly emitters: Emitter[] = [];
  readonly screen = createScreenFx();
  shake = 0;
  playing = false;

  /** Last cast; frameCamera and telegraphs read it. Null until the first play(). */
  ctx: CastContext | null = null;
  private time = 0;

  // Cast geometry.
  private point = new THREE.Vector3(0, 0, -8);
  private fwd = new THREE.Vector3(0, 0, -1);
  private right = new THREE.Vector3(1, 0, 0);
  private lean = new THREE.Vector3(0.35, 1, 0);
  private yaw = 0;
  private victims: { enemy: Enemy; feet: THREE.Vector3 }[] = [];
  private startP: THREE.Vector3[] = CHAR.map(() => new THREE.Vector3());
  private endP: THREE.Vector3[] = CHAR.map(() => new THREE.Vector3());
  private charPts: THREE.Vector3[][] = CHAR.map((c) => c.pts.map(() => new THREE.Vector3()));

  private flags = { paper: false, seal: false, hit: false, fadeOut: false };
  private started = CHAR.map(() => false);
  private ended = CHAR.map(() => false);

  // Parts.
  private paper = new InkBleed(2, 0.58);
  private chars = CHAR.map(() => new Stroke({ flat: true, order: 4, samples: 40 }));
  private bristle = new Stroke();
  private ferrule = new Stroke({ body: INK.foil, bristle: 0, taper: 0, samples: 8 });
  private handle = new Stroke({ taper: 0.35, bristle: 0.25, samples: 16 });
  private tassel = new Stroke({ body: INK.accent, rim: INK.accent, bristle: 0, taper: 0.6, samples: 10 });
  private brush = [this.bristle, this.ferrule, this.handle, this.tassel];
  private splat = new Splatter(24);
  private seal = new Seal(1);
  private pop = new StarBurst({ points: 12, inner: 0.3, color: INK.accent, core: 0xffffff, additive: false });
  private groundShock = new ShockRefraction({ facing: 'ground' });

  // Scratch.
  private v1 = new THREE.Vector3();
  private v2 = new THREE.Vector3();
  private v3 = new THREE.Vector3();
  private tipP = new THREE.Vector3();
  private bp: THREE.Vector3[] = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()];

  constructor(settings: FinalCalligraphySettings = defaultFinalCalligraphy()) {
    this.settings = settings;
    this.screen.impactColor.set(INK.hot);
    this.screen.tint.set(INK.dark);
    this.group.add(
      this.paper.mesh, ...this.chars.map((s) => s.mesh), this.seal.mesh, this.splat.mesh, ...this.brush.map((s) => s.mesh),
      this.pop.mesh, this.groundShock.mesh,
    );
    this.reset();
  }

  get duration() {
    return DURATION;
  }

  get impactTime() {
    return HIT_T;
  }

  /** True while `e` stands inside the zone right now (enemies who walked out before the strike are spared). */
  private inside(e: CastContext['targets'][number]) {
    const p = e.group.position;
    return Math.hypot(p.x - this.point.x, p.z - this.point.z) <= RADIUS;
  }

  cast(ctx: CastContext) {
    this.ctx = ctx;
    const P = this.point.copy(ctx.point).setY(0);
    // The character reads from the gameplay camera: v runs away from the caster, u to the camera's right.
    this.fwd.set(P.x - ctx.from.x, 0, P.z - ctx.from.z);
    if (this.fwd.lengthSq() < 1e-4) this.fwd.set(0, 0, -1);
    this.fwd.normalize();
    this.right.set(-this.fwd.z, 0, this.fwd.x);
    this.yaw = Math.atan2(this.fwd.x, this.fwd.z);
    this.lean.copy(this.right).multiplyScalar(0.12).setY(1).normalize();
    CHAR.forEach((c, i) => {
      c.pts.forEach(([u, v], k) => this.charPts[i][k].copy(P).addScaledVector(this.right, u * SCALE).addScaledVector(this.fwd, v * SCALE).setY(GROUND));
      this.startP[i].copy(this.charPts[i][0]);
      this.endP[i].copy(this.charPts[i][c.pts.length - 1]);
    });
    this.victims.length = 0;
    ctx.targets.forEach((e, i) => {
      const p = ctx.targetPos[i];
      if (!p) return;
      if (Math.hypot(p.x - P.x, p.z - P.z) > RADIUS) return;
      this.victims.push({ enemy: e, feet: p.clone().setY(0) });
    });
    this.screen.silhouettes = [ctx.caster.group, ...ctx.targets.map((e) => e.group)];
    this.screen.focus.copy(P).setY(2);
    this.groundShock.set(P, 0, 0);
  }

  play() {
    this.reset();
    this.playing = true;
  }

  private reset() {
    this.time = 0;
    this.shake = 0;
    for (const k of Object.keys(this.flags) as (keyof typeof this.flags)[]) this.flags[k] = false;
    this.started.fill(false);
    this.ended.fill(false);
    clearScreenFx(this.screen);
    this.screen.tint.set(INK.dark);
    this.paper.reset();
    for (const s of this.chars) s.reset();
    for (const s of this.brush) s.reset();
    this.splat.reset();
    this.seal.reset();
    this.pop.set(this.point, 0, 0);
    this.groundShock.set(this.point, 0, 0);
  }

  update(dt: number) {
    for (const e of this.emitters) e.update(dt);
    if (this.playing) this.tick(dt);
    this.paper.update(dt);
    for (const s of this.chars) s.update(dt);
    for (const s of this.brush) s.update(dt);
    this.splat.update(dt);
    this.seal.update(dt);
  }

  private tick(dt: number) {
    this.time += dt;
    if (this.time >= DURATION) {
      this.finish();
      if (this.settings.loop) this.play();
      return;
    }
    const t = this.time, f = this.flags, P = this.point;

    // --- 0..0.4: the world darkens, the sheet of paper unrolls across the zone. ---
    if (!f.paper) {
      f.paper = true;
      this.paper.spread(P, RADIUS, MARK_END, { ink: 0, unroll: true, yaw: this.yaw });
    }

    // --- 0.45..1.6: the character, stroke by stroke; a splatter flies off each stroke's end. ---
    CHAR.forEach((c, i) => {
      if (!this.started[i] && t >= c.start) {
        this.started[i] = true;
        this.chars[i].paint(this.charPts[i], c.w, c.dur);
      }
      if (this.started[i] && !this.ended[i] && t >= c.start + c.dur) {
        this.ended[i] = true;
        this.v2.subVectors(this.endP[i], this.chars[i].at(0.9, this.v3)).setY(0).normalize().setY(0.3);
        this.splat.fling(this.v1.copy(this.endP[i]).setY(0.25), this.v2, 2, 4.5, { size: 0.14, spread: 0.6, life: 0.7 });
      }
    });

    // --- The brush: comes down at 0.3, follows the strokes, lifts away 1.6..1.85. ---
    this.layoutBrush(t);

    // --- 2.0..2.2: a giant vermilion seal drops from above onto the centre of the character. ---
    if (!f.seal && t >= BEAT_END) {
      f.seal = true;
      this.seal.fall(P, 3, 6.5, HIT_T - BEAT_END);
    }

    // --- 2.2: the strike. ---
    if (!f.hit && t >= HIT_T) {
      f.hit = true;
      this.hit();
    }

    // --- 2.9..: the paper and the seal fade. ---
    if (!f.fadeOut && t >= 2.5) {
      f.fadeOut = true;
      this.paper.fade(1.8);
      this.seal.fade(1.0);
    }

    this.layout(dt);
  }

  /** The brush tip at time `t` (in `out`): down from above, over the strokes, hopping between them. */
  private brushTip(t: number, out: THREE.Vector3) {
    const first = this.startP[0];
    if (t < CHAR[0].start) {
      const k = easeOut((t - BRUSH_T) / (CHAR[0].start - BRUSH_T));
      return out.set(first.x, TIP_Y + 2.6 * (1 - k), first.z);
    }
    for (let i = 0; i < CHAR.length; i++) {
      const c = CHAR[i], e = c.start + c.dur;
      if (t < e) return this.chars[i].tip(out).setY(TIP_Y);
      const nx = CHAR[i + 1];
      if (nx && t < nx.start) {
        const k = (t - e) / (nx.start - e);
        out.lerpVectors(this.endP[i], this.startP[i + 1], k * k * (3 - 2 * k));
        return out.setY(TIP_Y + 0.9 * Math.sin(Math.PI * k));
      }
    }
    return out.copy(this.endP[CHAR.length - 1]).setY(TIP_Y);
  }

  private layoutBrush(t: number) {
    if (t < BRUSH_T || t >= LIFT_END) {
      for (const s of this.brush) s.alpha = 0;
      return;
    }
    const T = this.brushTip(t, this.tipP);
    T.y += 3.4 * easeIn((t - LIFT_T) / (LIFT_END - LIFT_T));
    const a = smoothstep((t - BRUSH_T) / 0.1) * (1 - smoothstep((t - 1.65) / (LIFT_END - 1.65)));
    for (const s of this.brush) s.alpha = a;
    const u = this.lean;
    const at = (d: number, out: THREE.Vector3) => out.copy(T).addScaledVector(u, d);
    // Bristles: fat belly at the top, tapering to the wet tip.
    at(2.3, this.bp[0]); at(1.15, this.bp[1]); at(0, this.bp[2]);
    this.bristle.set(this.bp, 1.8);
    at(2.3, this.bp[0]); at(2.95, this.bp[1]);
    this.ferrule.set(this.bp.slice(0, 2), 0.95);
    at(2.95, this.bp[0]); at(5.2, this.bp[1]); at(7.4, this.bp[2]);
    this.handle.set(this.bp, 0.6);
    at(7.4, this.bp[0]);
    this.bp[1].copy(this.bp[0]).addScaledVector(this.right, 0.22).y -= 0.8;
    this.bp[2].copy(this.bp[0]).addScaledVector(this.right, 0.06).y -= 1.7;
    this.tassel.set(this.bp, 0.34);
  }

  private hit() {
    const ctx = this.ctx, P = this.point;
    // The ink erupts: every stroke stands up as a wall (see layout) and spits splatter and flakes upward.
    this.chars.forEach((s, i) => {
      s.dissolve(1.3 + i * 0.08);
      for (let k = 0; k < 2; k++) {
        s.at(Math.random(), this.v1).setY(0.2);
        const a = Math.random() * Math.PI * 2;
        this.v2.set(Math.cos(a), 1.25, Math.sin(a));
        this.splat.fling(this.v1, this.v2, 1, 5, { size: 0.2, spread: 0.3, up: 2, life: 1.3, gravity: 5, shard: true });
      }
    });
    for (let k = 0; k < 2; k++) {
      const a = (k / 2) * Math.PI * 2;
      this.v2.set(Math.cos(a), 1.0, Math.sin(a));
      this.splat.fling(this.v1.set(P.x, 0.3, P.z), this.v2, 1, 5.5, { size: 0.22, spread: 0.2, up: 2, life: 1.3, gravity: 5, shard: true });
    }
    this.shake = Math.max(this.shake, 0.7);
    // Re-check where everyone stands now: enemies who walked out are spared.
    if (ctx) for (const e of ctx.targets) {
      if (this.inside(e)) {
        ctx.hit(e, { damage: this.settings.damage, knock: 3, from: P, color: INK_CSS.hot, status: { kind: 'blind', seconds: this.settings.blindSeconds } });
      }
    }
  }

  private finish() {
    this.playing = false;
    this.shake = 0;
    const ctx = this.ctx;
    if (ctx) for (const v of this.victims) ctx.displace(v.enemy, this.v3.set(0, 0, 0));
    this.reset();
  }

  private layout(dt: number) {
    const t = this.time, ctx = this.ctx, P = this.point;
    const after = t - HIT_T;
    const f = this.flags;

    // --- Screen: sumi-black dark, a lift at the strike, lifting away as the paper fades. Impact frames at the hit. ---
    let dk = 0.55 * smoothstep(t / MARK_END) * (1 - smoothstep((t - 3.2) / (DARK_END - 3.2)));
    if (after >= 0) dk *= 1 - 0.3 * Math.exp(-after * 10);
    this.screen.darken = dk;
    this.screen.impact = impactFrameAt(t, HIT_T, [1, 2], 0.04);

    // --- The pull on the enemies: in while the brush writes, released at the strike. ---
    if (ctx) {
      const pull = 0.4 * smoothstep((t - BRUSH_T) / (HIT_T - BRUSH_T)) * (1 - smoothstep(after / 0.3));
      for (const v of this.victims) {
        this.v3.set(P.x - v.feet.x, 0, P.z - v.feet.z).multiplyScalar(pull);
        ctx.displace(v.enemy, this.v3);
      }
    }

    // --- The strike: the written strokes stand up as walls of ink, a vermilion star, ground refraction, shake. ---
    if (f.hit) {
      const k = easeOut(after / 0.15);
      for (const s of this.chars) s.setStand(k, WALL_RISE);
      const sp = StarBurst.pop(after, 0, 0.05);
      this.pop.set(this.v1.copy(P).setY(1.5), 2 * sp.scale, sp.opacity, 0.2);
      const gp = THREE.MathUtils.clamp(after / 0.5, 0, 1);
      this.groundShock.set(P, 1 + 11 * gp, 0.07 * (1 - gp) * (1 - gp));
      this.shake = Math.max(this.shake * Math.exp(-dt * 9), 0.7 * Math.exp(-after * 9));
    } else this.shake *= Math.exp(-dt * 12);
  }
}

const easeOut = (x: number) => 1 - Math.pow(1 - Math.min(1, Math.max(0, x)), 3);
const easeIn = (x: number) => Math.pow(Math.min(1, Math.max(0, x)), 2);

export const finalCalligraphyModule: EffectModule = {
  label: 'final calligraphy',
  category: 'hero: ink',
  targeting: { mode: 'ground', radius: RADIUS },
  create: () => new FinalCalligraphy(),
  telegraphs(effect) {
    const e = effect as FinalCalligraphy;
    const ctx = e.ctx;
    if (!ctx) return [];
    return [{ shape: { kind: 'circle', x: ctx.point.x, z: ctx.point.z, radius: RADIUS }, start: 0, impact: HIT_T }];
  },
  bloom: { enabled: true, strength: 0.4, radius: 0.4, threshold: 0.86 },
  frameCamera(camera, controls, effect) {
    const e = effect as FinalCalligraphy;
    if (e.ctx) frameCast(camera, controls, e.ctx, 10);
  },
  buildGui(f, effect) {
    const s = (effect as FinalCalligraphy).settings;
    f.add(s, 'loop');
    f.add(s, 'damage', 1, 300, 1);
    f.add(s, 'blindSeconds', 0, 2, 0.1);
  },
};
