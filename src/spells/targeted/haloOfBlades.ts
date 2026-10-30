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
 * Halo of Blades (dawn kit, E: orbit). A solid gold halo ring forms over Auriel's head and six blade shards click
 * together around her at waist height, then circle her at 2.5 m for 3 s. They hit only what they touch: an enemy that
 * stands in the ring takes a cut (with a sky-blue spark) each time a blade passes, at most 3 cuts in all, one per 0.7 s
 * per enemy. Auriel gains a shield when the halo forms. At 3.3 s the blades and the halo shatter into panels. See
 * pipeline/designs/kit-dawn.md.
 */
export interface HaloOfBladesSettings {
  damage: number;
  /** Shield Auriel gains at the cast (held SHIELD_SECONDS). */
  shield: number;
  loop: boolean;
}

export const defaultHaloOfBlades = (): HaloOfBladesSettings => ({ damage: 10, shield: 25, loop: false });

// Timeline (seconds).
const RISE_END = 0.3;
const ORBIT_END = 3.3; // the blades circle from RISE_END to here (3 s)
const SHATTER_T = 3.3;
const DURATION = 3.9;
const RADIUS = 3.6; // the telegraph: the orbit circle plus the blades' reach
const ORBIT_R = 2.5;
const TOUCH = 0.95; // a blade touches an enemy within this ground distance
const MAX_HITS = 3;
const REHIT = 0.7; // seconds before the same enemy can be cut again
const SHIELD_SECONDS = 4;
const WAIST = 1.1;
const BLADES = 6;
const BLADE_SIZE = 2.2;
const SPIN = 2.6; // orbit speed, rad/s
const ROOT_T = 2.0; // she stands rooted this long (the telegraph's impact)
const UP = new THREE.Vector3(0, 1, 0);

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

  private flags = { shield: false, shatter: false };
  private hits = 0;
  /** Per target (ctx.targets order): the time of its last cut, -1 = never. */
  private lastCut: number[] = [];

  // Parts.
  private sigil = new Sigil();
  private halo = new HaloRing();
  private panels = new LightPanels(BLADES, 6);
  private stars = Array.from({ length: MAX_HITS }, () => new StarBurst({ points: 8, inner: 0.3, color: DAWN.accent, core: DAWN.accent, additive: false }));
  private starPos = Array.from({ length: MAX_HITS }, () => new THREE.Vector3());
  private starAt = new Array<number>(MAX_HITS).fill(-1);

  // Scratch.
  private v1 = new THREE.Vector3();
  private v2 = new THREE.Vector3();
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
    return ROOT_T;
  }

  /** The telegraph hangs until the blades stop. */
  get orbitEnd() {
    return ORBIT_END;
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
    this.flags.shield = this.flags.shatter = false;
    this.hits = 0;
    this.lastCut = [];
    this.starAt.fill(-1);
    clearScreenFx(this.screen);
    this.sigil.reset();
    this.halo.reset();
    this.panels.reset();
    for (const s of this.stars) s.set(this.from, 1e-3, 0);
  }

  /** The orbit's centre: she stands rooted, but if she moves the ring goes with her. */
  private centre(out: THREE.Vector3) {
    const c = this.ctx?.caster.group.position;
    return c ? out.set(c.x, 0, c.z) : out.copy(this.from);
  }

  /** Blade i on its circle around Auriel at time t. */
  private orbitAt(i: number, t: number, out: THREE.Vector3) {
    const a = (i / BLADES) * Math.PI * 2 + SPIN * Math.max(0, t - RISE_END) + 0.4;
    const grow = dawnEaseOut(t / RISE_END);
    this.centre(this.v4);
    return out.set(this.v4.x + Math.cos(a) * ORBIT_R * grow, WAIST + 0.12 * Math.sin(a * 2 + i), this.v4.z + Math.sin(a) * ORBIT_R * grow);
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

    if (!f.shield) {
      f.shield = true;
      this.ctx?.shieldSelf?.(this.settings.shield, SHIELD_SECONDS, DAWN_CSS.body);
    }
    if (t >= RISE_END && t < ORBIT_END) this.touch(t);
    if (!f.shatter && t >= SHATTER_T) {
      f.shatter = true;
      this.v1.copy(this.from).setY(WAIST);
      this.panels.shatter(5, 0.45, this.v1);
    }

    this.layout();
    this.halo.spin(dt);
    this.panels.update(dt);
  }

  /** A blade that reaches an enemy cuts it (live positions): once per pass, at most MAX_HITS in all. */
  private touch(t: number) {
    const ctx = this.ctx;
    if (!ctx || this.hits >= MAX_HITS) return;
    ctx.targets.forEach((e, k) => {
      if (this.hits >= MAX_HITS) return;
      if (this.lastCut[k] !== undefined && this.lastCut[k] >= 0 && t - this.lastCut[k] < REHIT) return;
      const p = e.group.position;
      for (let i = 0; i < BLADES; i++) {
        this.orbitAt(i, t, this.v1);
        if (Math.hypot(this.v1.x - p.x, this.v1.z - p.z) > TOUCH) continue;
        this.lastCut[k] = t;
        const s = this.hits++;
        this.starAt[s] = t;
        this.starPos[s].set(p.x, WAIST, p.z);
        this.shake = 0.12;
        ctx.hit(e, { damage: this.settings.damage, knock: 1, color: DAWN_CSS.body });
        break;
      }
    });
  }

  private layout() {
    const t = this.time;
    const gone = t >= SHATTER_T;
    const rise = dawnEaseOut(t / RISE_END);
    const out = 1 - smoothstep((t - SHATTER_T) / 0.35);
    this.centre(this.v2);

    // --- Halo over her head, bobbing a little; the sigil under her. ---
    this.v1.copy(this.v2).setY(2.75 + 0.06 * Math.sin(t * 3));
    this.halo.set(this.v1, this.haloN, 0.72 * Math.max(rise, 0.02) * (1 + 0.1 * (1 - out)));
    this.halo.opacity = smoothstep(t / 0.2) * out;
    this.sigil.set(this.v2, ORBIT_R + 0.3);
    this.sigil.hide = 0.3;
    this.sigil.reveal = smoothstep(t / RISE_END);
    this.sigil.opacity = 1 - smoothstep((t - SHATTER_T) / 0.4);

    // --- Blades: on the circle, flying along its tangent. ---
    for (let i = 0; i < BLADES; i++) {
      this.orbitAt(i, t, this.v1);
      const a = (i / BLADES) * Math.PI * 2 + SPIN * Math.max(0, t - RISE_END) + 0.4;
      this.v2.set(-Math.sin(a), 0, Math.cos(a));
      if (!gone) {
        dawnPanelNormal(this.v2, this.view, this.v4);
        dawnOrient(this.v4, this.v2, this.q1);
        this.panels.place(i, this.v1, this.q1, BLADE_SIZE * Math.max(rise, 0.05), 'shard', 0.9, i % 2 === 0 ? DAWN.hot : DAWN.foil);
      }
    }

    // --- Sky-blue sparks at the cuts (2 frames). ---
    for (let i = 0; i < MAX_HITS; i++) {
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
    // The orbit circle: she stands rooted while it spins; it hangs until the blades stop.
    return [{ shape: { kind: 'circle' as const, x: c.x, z: c.z, radius: RADIUS }, start: 0, impact: ROOT_T, until: e.orbitEnd }];
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
    f.add(s, 'shield', 0, 120, 1);
  },
};
