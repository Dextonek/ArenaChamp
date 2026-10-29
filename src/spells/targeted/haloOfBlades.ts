import * as THREE from 'three';
import { Emitter } from '../../emitter';
import { smoothstep } from '../../effects/common';
import { StarBurst, clearScreenFx, createScreenFx } from '../../effects/parts';
import {
  DAWN, DAWN_CSS, HaloRing, LightPanels, Sigil, dawnEaseOut, dawnFacing, dawnForward, dawnOrient, dawnPanelNormal, dawnView,
} from '../../effects/parts/dawn';
import { frameCast, type CastContext } from '../../effects/targeting';
import type { Effect, EffectModule } from '../../effects/types';

/**
 * Halo of Blades (dawn kit, E: self aura). A solid gold halo ring forms over Auriel's head and six blade shards click
 * together around her at waist height. They orbit her; at 1.0 s and 2.0 s every blade launches at the nearest enemy
 * in range (a straight streak), strikes with a sky-blue spark and snaps back. Then the blades and the halo shatter into
 * panels. See pipeline/designs/kit-dawn.md.
 */
export interface HaloOfBladesSettings {
  damage: number;
  loop: boolean;
}

export const defaultHaloOfBlades = (): HaloOfBladesSettings => ({ damage: 13, loop: false });

// Timeline (seconds).
const RISE_END = 0.3;
const PULSE_T = [1.0, 2.0];
const DASH = 0.16; // the launch runs PULSE_T - DASH .. PULSE_T
const HOLD = 0.05; // the blade stays in the enemy this long
const BACK = 0.2; // and snaps back in this long
const SHATTER_T = 2.6;
const DURATION = 3.2;
const RADIUS = 5;
const ORBIT_R = 1.6;
const WAIST = 1.1;
const BLADES = 6;
const BLADE_SIZE = 1.5;
const SPIN = 2.4; // orbit speed, rad/s
const UP = new THREE.Vector3(0, 1, 0);

interface Launch { from: THREE.Vector3; to: THREE.Vector3; enemy: number }

export class HaloOfBlades implements Effect {
  readonly group = new THREE.Group();
  readonly settings: HaloOfBladesSettings;
  readonly emitters: Emitter[] = [];
  readonly screen = createScreenFx();
  shake = 0;
  playing = false;

  /** Last cast; frameCamera and telegraphs read it. Null until the first play(). */
  ctx: CastContext | null = null;
  private time = 0;

  // Cast geometry, computed in cast().
  private from = new THREE.Vector3(0, 0, 14);
  private nrm = new THREE.Vector3(0, 0, 1);
  private fwd = new THREE.Vector3(0, 0, -1);
  private view = new THREE.Vector3(0, 0.45, 0.9);
  private haloN = new THREE.Vector3(0, 1, 0);

  private flags = { pulse: [false, false], shatter: false };
  /** Per volley and blade: where it flies (null = no enemy in range). */
  private launch: (Launch | null)[][] = [[], []];

  // Parts.
  private sigil = new Sigil();
  private halo = new HaloRing();
  private panels = new LightPanels(BLADES * 2, 6);
  private stars = Array.from({ length: BLADES }, () => new StarBurst({ points: 8, inner: 0.3, color: DAWN.accent, core: DAWN.accent, additive: false }));
  private starPos = Array.from({ length: BLADES }, () => new THREE.Vector3());
  private starAt = new Array<number>(BLADES).fill(-1);

  // Scratch.
  private v1 = new THREE.Vector3();
  private v2 = new THREE.Vector3();
  private v3 = new THREE.Vector3();
  private v4 = new THREE.Vector3();
  private q1 = new THREE.Quaternion();

  constructor(settings: HaloOfBladesSettings = defaultHaloOfBlades()) {
    this.settings = settings;
    this.screen.tint.set(DAWN.dark);
    this.group.add(this.sigil.mesh, this.halo.mesh, this.panels.mesh, ...this.stars.map((s) => s.mesh));
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
    dawnFacing(ctx.aim, this.nrm);
    dawnForward(ctx.aim, this.fwd);
    dawnView(ctx.aim, this.view);
    this.haloN.copy(UP).addScaledVector(this.view, 0.5).normalize();
    this.screen.focus.copy(this.from).setY(1.3);
  }

  play() {
    this.reset();
    this.playing = true;
    this.layout();
    this.panels.assemble(0.2, 0.1, 4);
  }

  private reset() {
    this.time = 0;
    this.shake = 0;
    this.flags.pulse = [false, false];
    this.flags.shatter = false;
    this.launch = [[], []];
    this.starAt.fill(-1);
    clearScreenFx(this.screen);
    this.sigil.reset();
    this.halo.reset();
    this.panels.reset();
    for (const s of this.stars) s.set(this.from, 1e-3, 0);
  }

  /** Blade i on its circle around Auriel at time t. */
  private orbitAt(i: number, t: number, out: THREE.Vector3) {
    const a = (i / BLADES) * Math.PI * 2 + SPIN * Math.max(0, t - RISE_END) + 0.4;
    const grow = dawnEaseOut(t / RISE_END);
    return out.set(this.from.x + Math.cos(a) * ORBIT_R * grow, WAIST + 0.12 * Math.sin(a * 2 + i), this.from.z + Math.sin(a) * ORBIT_R * grow);
  }

  update(dt: number) {
    for (const e of this.emitters) e.update(dt);
    if (!this.playing) return;
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

    for (let v = 0; v < 2; v++) {
      if (this.launch[v].length === 0 && t >= PULSE_T[v] - DASH) this.planVolley(v, PULSE_T[v] - DASH);
      if (!f.pulse[v] && t >= PULSE_T[v]) {
        f.pulse[v] = true;
        this.shake = 0.12;
        const hitEnemies = new Set<number>();
        for (let i = 0; i < BLADES; i++) {
          const l = this.launch[v][i];
          if (!l) continue;
          this.starAt[i] = t;
          this.starPos[i].copy(l.to);
          if (ctx && !hitEnemies.has(l.enemy)) {
            hitEnemies.add(l.enemy);
            ctx.hit(ctx.targets[l.enemy], { damage: this.settings.damage, knock: 1, color: DAWN_CSS.body });
          }
        }
      }
    }
    if (!f.shatter && t >= SHATTER_T) {
      f.shatter = true;
      this.v1.copy(this.from).setY(WAIST);
      this.panels.shatter(5, 0.45, this.v1);
    }

    this.layout();
    this.halo.spin(dt);
    this.panels.update(dt);
  }

  private planVolley(v: number, t: number) {
    const ctx = this.ctx;
    this.launch[v] = [];
    for (let i = 0; i < BLADES; i++) {
      let best = -1, bd = 1e9;
      this.orbitAt(i, t, this.v1);
      if (ctx) {
        ctx.targetPos.forEach((p, k) => {
          const d = Math.hypot(p.x - this.from.x, p.z - this.from.z);
          if (d <= RADIUS + 0.5 && d < bd) { bd = d; best = k; }
        });
      }
      if (best < 0 || !ctx) { this.launch[v].push(null); continue; }
      const p = ctx.targetPos[best];
      // Blades that share an enemy spread over its body a little.
      const side = ((i % 3) - 1) * 0.35;
      this.v2.set(p.x - this.v1.x, 0, p.z - this.v1.z).normalize();
      const to = new THREE.Vector3(p.x - this.v2.z * side, WAIST + 0.35 * ((i % 2) - 0.5), p.z + this.v2.x * side).addScaledVector(this.v2, -0.35);
      this.launch[v].push({ from: this.v1.clone(), to, enemy: best });
    }
  }

  private layout() {
    const t = this.time;
    const gone = t >= SHATTER_T;
    const rise = dawnEaseOut(t / RISE_END);
    const out = 1 - smoothstep((t - SHATTER_T) / 0.35);

    // --- Halo over her head, bobbing a little; the sigil under her. ---
    this.v1.copy(this.from).setY(2.75 + 0.06 * Math.sin(t * 3));
    this.halo.set(this.v1, this.haloN, 0.72 * Math.max(rise, 0.02) * (1 + 0.1 * (1 - out)));
    this.halo.opacity = smoothstep(t / 0.2) * out;
    this.sigil.set(this.from, 2.4);
    this.sigil.hide = 0.3;
    this.sigil.reveal = smoothstep(t / RISE_END);
    this.sigil.opacity = 1 - smoothstep((t - SHATTER_T) / 0.4);

    // --- Blades: on the circle, or launched at an enemy, striking and snapping back. ---
    for (let i = 0; i < BLADES; i++) {
      this.orbitAt(i, t, this.v1);
      const a = (i / BLADES) * Math.PI * 2 + SPIN * Math.max(0, t - RISE_END) + 0.4;
      this.v2.set(-Math.sin(a), 0, Math.cos(a)); // tangent = flying direction on the circle
      let streakLen = 0;
      for (let v = 0; v < 2; v++) {
        const l = this.launch[v][i];
        const s = t - (PULSE_T[v] - DASH);
        if (!l || s < 0 || s > DASH + HOLD + BACK) continue;
        if (s < DASH) {
          const u = (s / DASH) ** 2;
          this.v1.lerpVectors(l.from, l.to, u);
          this.v2.subVectors(l.to, l.from).normalize();
          this.v3.copy(l.from);
          streakLen = this.v4.subVectors(this.v1, l.from).length();
        } else if (s < DASH + HOLD) {
          this.v1.copy(l.to);
          this.v2.subVectors(l.to, l.from).normalize();
          this.v3.copy(l.from);
          streakLen = this.v4.subVectors(l.to, l.from).length() * (1 - (s - DASH) / HOLD);
        } else {
          const k = dawnEaseOut((s - DASH - HOLD) / BACK);
          this.v4.copy(this.v1);
          this.v1.lerpVectors(l.to, this.v4, k);
          this.v2.subVectors(this.v4, l.to).normalize();
        }
      }
      if (!gone) {
        dawnPanelNormal(this.v2, this.view, this.v4);
        dawnOrient(this.v4, this.v2, this.q1);
        this.panels.place(i, this.v1, this.q1, BLADE_SIZE * Math.max(rise, 0.05), 'shard', 1.3, i % 2 === 0 ? DAWN.hot : DAWN.foil);
        if (streakLen > 0.15) {
          // A straight, thin streak from the launch point to the blade, shrinking away after the strike.
          const l2 = streakLen;
          this.v3.lerp(this.v1, 0.5);
          this.panels.place(BLADES + i, this.v3, this.q1, l2, 'shard', Math.min(0.34 / (0.28 * l2), 3), DAWN.hot);
        } else this.panels.hide(BLADES + i);
      }
    }

    // --- Sky-blue sparks at the strikes (2 frames). ---
    for (let i = 0; i < BLADES; i++) {
      const age = t - this.starAt[i];
      if (this.starAt[i] < 0 || age > 0.2) { this.stars[i].set(this.starPos[i], 1e-3, 0); continue; }
      const sp = StarBurst.pop(age, 0, 0.03);
      this.stars[i].set(this.starPos[i], 0.8 * sp.scale + 1e-3, sp.opacity, i);
    }
    this.shake *= 0.85;
  }
}

export const haloOfBladesModule: EffectModule = {
  label: 'halo of blades',
  category: 'hero: dawn',
  targeting: { mode: 'self', radius: RADIUS },
  create: () => new HaloOfBlades(),
  telegraphs(effect) {
    const e = effect as HaloOfBlades;
    const c = e.ctx?.from;
    if (!c) return [];
    return [{ shape: { kind: 'circle' as const, x: c.x, z: c.z, radius: RADIUS }, start: 0, impact: PULSE_T[0] }];
  },
  bloom: { enabled: true, strength: 0.4, radius: 0.35, threshold: 0.88 },
  frameCamera(camera, controls, effect) {
    const e = effect as HaloOfBlades;
    if (e.ctx) frameCast(camera, controls, e.ctx, 4);
  },
  buildGui(f, effect) {
    const s = (effect as HaloOfBlades).settings;
    f.add(s, 'loop');
    f.add(s, 'damage', 1, 60, 1);
  },
};
