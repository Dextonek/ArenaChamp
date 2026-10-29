import * as THREE from 'three';
import { Emitter } from '../../emitter';
import { smoothstep } from '../../effects/common';
import { clearScreenFx, createScreenFx } from '../../effects/parts';
import {
  Afterimage, CutFlash, CutShape, SHADOW_CSS, ShadowPool, facing, forward, shadowEaseOut,
} from '../../effects/parts/shadow';
import { frameCast, type CastContext } from '../../effects/targeting';
import type { Effect, EffectModule } from '../../effects/types';

/**
 * Night Shroud (shadow kit, E: self aura). A shadow pool spreads under Nyx and three figure cut-outs (clones) rise
 * around her. They circle her slowly; at 1.0 s and 2.0 s every clone lunges at the nearest enemy in a stepped dash,
 * slashes (blade cut-out and a mint cut) and snaps back. Then the clones fold flat into the pool and it shrinks.
 * See pipeline/designs/kit-shadow.md.
 */
export interface NightShroudSettings {
  damage: number;
  loop: boolean;
}

export const defaultNightShroud = (): NightShroudSettings => ({ damage: 13, loop: false });

// Timeline (seconds).
const RISE_END = 0.3;
const PULSE_T = [1.0, 2.0];
const DASH = 0.2; // the lunge runs PULSE_T - DASH .. PULSE_T
const HOLD = 0.12; // the clone stays at the enemy this long after the slash
const FOLD_A = 2.6;
const FOLD_B = 3.0;
const DURATION = 3.2;
const RADIUS = 5;
const ORBIT_R = 1.6;
const CLONES = 3;
const CLONE_H = 2.1;
const UP = new THREE.Vector3(0, 1, 0);

export class NightShroud implements Effect {
  readonly group = new THREE.Group();
  readonly settings: NightShroudSettings;
  readonly emitters: Emitter[] = [];
  readonly screen = createScreenFx();
  shake = 0;
  playing = false;

  /** Last cast; frameCamera and telegraphs read it. Null until the first play(). */
  ctx: CastContext | null = null;
  private time = 0;

  private from = new THREE.Vector3(0, 0, 14);
  private nrm = new THREE.Vector3(0, 0, 1);
  private fwd = new THREE.Vector3(0, 0, -1);
  private right = new THREE.Vector3(1, 0, 0);

  private flags = { pulse: [false, false] };
  /** Per volley and clone: where it stands at the enemy (null = no target in range) and which enemy. */
  private lunge: ({ from: THREE.Vector3; to: THREE.Vector3; enemy: number } | null)[][] = [[], []];
  private orbit: THREE.Vector3[] = [];

  // Parts.
  private pool = new ShadowPool();
  private clones = Array.from({ length: CLONES }, () => new CutShape({ kind: 'figure', renderOrder: 4 }));
  private trails = Array.from({ length: CLONES }, () => new Afterimage(3));
  private slashes = Array.from({ length: CLONES }, () => new CutShape({ kind: 'blade', renderOrder: 8 }));
  private cuts = Array.from({ length: CLONES }, () => new CutFlash());
  private shrunk = false;

  // Scratch.
  private v1 = new THREE.Vector3();
  private v2 = new THREE.Vector3();

  constructor(settings: NightShroudSettings = defaultNightShroud()) {
    this.settings = settings;
    for (let i = 0; i < CLONES; i++) this.orbit.push(new THREE.Vector3());
    for (const tr of this.trails) { tr.size = CLONE_H * 1.05; tr.fadeLen = 1.1; }
    this.group.add(
      this.pool.mesh, ...this.trails.map((a) => a.mesh), ...this.clones.map((c) => c.mesh), ...this.slashes.map((s) => s.mesh),
      ...this.cuts.map((c) => c.mesh),
    );
    this.reset();
  }

  get duration() {
    return DURATION;
  }

  get impactTime() {
    return PULSE_T[0];
  }

  cast(ctx: CastContext) {
    this.ctx = ctx;
    this.from.copy(ctx.from).setY(0);
    facing(ctx.aim, this.nrm);
    forward(ctx.aim, this.fwd);
    this.right.crossVectors(UP, this.nrm).normalize();
    for (const a of this.trails) a.face(ctx.aim);
    for (const c of this.cuts) c.face(ctx.aim);
    this.screen.focus.copy(this.from).setY(1.3);
  }

  play() {
    this.reset();
    this.playing = true;
  }

  private reset() {
    this.time = 0;
    this.shake = 0;
    this.flags.pulse = [false, false];
    this.lunge = [[], []];
    this.shrunk = false;
    clearScreenFx(this.screen);
    this.pool.reset();
    for (const c of this.clones) c.reset();
    for (const a of this.trails) a.reset();
    for (const s of this.slashes) s.reset();
    for (const c of this.cuts) c.reset();
  }

  /** Clone i on its circle around Nyx at time t. */
  private orbitAt(i: number, t: number, out: THREE.Vector3) {
    const a = (i / CLONES) * Math.PI * 2 + 0.9 * Math.max(0, t - RISE_END) + 0.4;
    const grow = shadowEaseOut(t / RISE_END);
    return out.set(this.from.x + Math.cos(a) * ORBIT_R * grow, 0.06, this.from.z + Math.sin(a) * ORBIT_R * grow);
  }

  update(dt: number) {
    for (const e of this.emitters) e.update(dt);
    if (!this.playing) return;
    this.pool.update(dt);
    for (const c of this.cuts) c.update(dt);
    this.time += dt;
    if (this.time >= DURATION) {
      const loop = this.settings.loop;
      this.reset();
      this.playing = false;
      this.shake = 0;
      if (loop) this.play();
      return;
    }
    const t = this.time;
    const f = this.flags;
    const ctx = this.ctx;

    // Plan each volley a dash early: every clone picks the nearest enemy in range.
    for (let v = 0; v < 2; v++) {
      if (this.lunge[v].length === 0 && t >= PULSE_T[v] - DASH) this.planVolley(v, PULSE_T[v] - DASH);
      if (!f.pulse[v] && t >= PULSE_T[v]) {
        f.pulse[v] = true;
        this.shake = 0.14;
        const hitEnemies = new Set<number>();
        for (let i = 0; i < CLONES; i++) {
          const l = this.lunge[v][i];
          if (!l) continue;
          const a = (i % 2 === 0 ? 0.6 : -0.6) + (v === 1 ? 0.3 : 0);
          this.v1.copy(l.to).setY(1.1);
          this.v2.copy(this.right).multiplyScalar(Math.cos(a)).addScaledVector(UP, Math.sin(a));
          this.cuts[i].cut(this.v1, this.v2, 1.7);
          if (ctx && !hitEnemies.has(l.enemy)) {
            hitEnemies.add(l.enemy);
            ctx.hit(ctx.targets[l.enemy], { damage: this.settings.damage, knock: 1, color: SHADOW_CSS.hot });
          }
        }
      }
    }
    if (!this.shrunk && t >= FOLD_A + 0.1) {
      this.shrunk = true;
      this.pool.shrink(FOLD_B - FOLD_A - 0.1);
    }

    this.layout();
  }

  private planVolley(v: number, t: number) {
    const ctx = this.ctx;
    this.lunge[v] = [];
    for (let i = 0; i < CLONES; i++) {
      let best = -1, bd = 1e9;
      this.orbitAt(i, t, this.v1);
      if (ctx) {
        ctx.targetPos.forEach((p, k) => {
          const d = Math.hypot(p.x - this.v1.x, p.z - this.v1.z);
          if (d <= RADIUS + 0.5 && d < bd) { bd = d; best = k; }
        });
      }
      if (best < 0 || !ctx) { this.lunge[v].push(null); continue; }
      const p = ctx.targetPos[best];
      const from = this.v1.clone();
      const dir = new THREE.Vector3(p.x - from.x, 0, p.z - from.z);
      const len = dir.length() || 1;
      dir.multiplyScalar(1 / len);
      // Stand 0.9 short of the enemy, on the clone's side of it.
      const to = new THREE.Vector3(p.x - dir.x * 0.9, 0.06, p.z - dir.z * 0.9);
      this.lunge[v].push({ from, to, enemy: best });
    }
  }

  private layout() {
    const t = this.time;
    const fold = smoothstep((t - FOLD_A) / (FOLD_B - FOLD_A));
    const rise = shadowEaseOut(t / RISE_END);

    // --- Pool under Nyx: spreads in 0.3 s. ---
    this.pool.spread(this.from, 2, smoothstep(t / RISE_END));

    for (let i = 0; i < CLONES; i++) {
      // Where the clone is: on its circle, or in the stepped lunge of the current volley.
      this.orbitAt(i, t, this.v1);
      let trailLunge: { from: THREE.Vector3; to: THREE.Vector3 } | null = null;
      let trailS = 0;
      for (let v = 0; v < 2; v++) {
        const l = this.lunge[v][i];
        if (!l) continue;
        const s = (t - (PULSE_T[v] - DASH)) / DASH;
        if (s < 0 || t > PULSE_T[v] + 0.5) continue;
        trailLunge = l;
        trailS = s;
        if (t < PULSE_T[v] + HOLD) {
          const step = Math.floor(THREE.MathUtils.clamp(s, 0, 1) * 3 + 1e-6) / 3;
          this.v1.lerpVectors(l.from, l.to, step);
        }
      }
      if (trailLunge) this.trails[i].trail(trailLunge.from, trailLunge.to, 3, trailS);
      else this.trails[i].reset();

      // Fold: the figure tips flat into the pool and shrinks toward Nyx.
      const c = this.clones[i];
      if (fold > 0) this.v1.lerp(this.from, fold * 0.8).setY(0.06 + 0.02 * fold);
      this.v2.copy(this.nrm).multiplyScalar(Math.cos(fold * Math.PI * 0.5)).addScaledVector(UP, Math.sin(fold * Math.PI * 0.5));
      c.place(this.v1, this.v2, CLONE_H * Math.max(rise, 0.02) * (1 - 0.35 * fold), 0, this.fwd);
      c.opacity = t >= FOLD_B ? 0 : 1;

      // Slash: a blade cut-out slides across the enemy for a few frames.
      const sl = this.slashes[i];
      sl.opacity = 0;
      for (let v = 0; v < 2; v++) {
        const l = this.lunge[v][i];
        const age = t - PULSE_T[v];
        if (!l || age < -0.03 || age > 0.14) continue;
        const k = shadowEaseOut((age + 0.03) / 0.08);
        const a = (i % 2 === 0 ? 0.6 : -0.6) + (v === 1 ? 0.3 : 0);
        const off = -1.0 + 1.3 * k;
        this.v2.copy(l.to).setY(1.1).addScaledVector(this.right, Math.cos(a) * off).addScaledVector(UP, Math.sin(a) * off);
        sl.place(this.v2, this.nrm, 2.6, a);
        sl.opacity = 1 - smoothstep((age - 0.07) / 0.07);
      }
    }
    this.shake *= 0.85;
  }
}

export const nightShroudModule: EffectModule = {
  label: 'night shroud',
  category: 'hero: shadow',
  targeting: { mode: 'self', radius: RADIUS },
  create: () => new NightShroud(),
  telegraphs(effect) {
    const e = effect as NightShroud;
    const c = e.ctx?.from;
    if (!c) return [];
    return [{ shape: { kind: 'circle' as const, x: c.x, z: c.z, radius: RADIUS }, start: 0, impact: PULSE_T[0] }];
  },
  bloom: { enabled: true, strength: 0.4, radius: 0.35, threshold: 0.88 },
  frameCamera(camera, controls, effect) {
    const e = effect as NightShroud;
    if (e.ctx) frameCast(camera, controls, e.ctx, 4);
  },
  buildGui(f, effect) {
    const s = (effect as NightShroud).settings;
    f.add(s, 'loop');
    f.add(s, 'damage', 1, 60, 1);
  },
};
