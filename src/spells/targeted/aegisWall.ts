import * as THREE from 'three';
import { Emitter } from '../../emitter';
import { smoothstep } from '../../effects/common';
import { ShockRefraction, StarBurst, clearScreenFx, createScreenFx } from '../../effects/parts';
import {
  DAWN, DAWN_CSS, LightPanels, Sigil, dawnFacing, dawnForward, dawnOrient,
} from '../../effects/parts/dawn';
import { frameCast, type CastContext } from '../../effects/targeting';
import type { Effect, EffectModule } from '../../effects/types';

/**
 * Aegis Wall (dawn kit, W: zone). A sun-wheel sigil draws on at the point, ten kite shields fly in and click into a ring
 * standing upright around its edge, then tilt inward over the enemies like a closing dome. At the hit the dome slams
 * shut (a capstone clicks in at the top, the core lines flash), a second pulse ticks at 1.3 s, then the dome shatters
 * outward into panels that shrink away and the sigil fades. See pipeline/designs/kit-dawn.md.
 */
export interface AegisWallSettings {
  damage: number;
  tick: number;
  loop: boolean;
}

export const defaultAegisWall = (): AegisWallSettings => ({ damage: 45, tick: 10, loop: false });

// Timeline (seconds).
const SIGIL_END = 0.3;
const ASSEMBLE_T = 0.3;
const TILT_A = 0.55;
const HIT_T = 0.75;
const TICK_T = 1.3;
const SHATTER_T = 1.4;
const DURATION = 2.35;
const RADIUS = 4;
const SHIELDS = 10;
const RING_R = 3.7;
const LENGTH = 4.6; // shield length, base to apex
const WIDE = 0.7;
const UP = new THREE.Vector3(0, 1, 0);
const THETA_0 = 0.08;
const THETA_1 = Math.asin((RING_R - 0.15) / LENGTH);

export class AegisWall implements Effect {
  readonly group = new THREE.Group();
  readonly settings: AegisWallSettings;
  readonly emitters: Emitter[] = [];
  readonly screen = createScreenFx();
  shake = 0;
  playing = false;

  /** Last cast; frameCamera and telegraphs read it. Null until the first play(). */
  ctx: CastContext | null = null;
  private time = 0;

  // Cast geometry, computed in cast().
  private point = new THREE.Vector3(0, 0, -6);
  private nrm = new THREE.Vector3(0, 0, 1);
  private fwd = new THREE.Vector3(0, 0, -1);
  private radial: THREE.Vector3[] = [];

  private flags = { asm: false, hit: false, tick: false, shatter: false };

  // Parts.
  private sigil = new Sigil();
  private panels = new LightPanels(SHIELDS, 6);
  private cap = new LightPanels(1, 8);
  private star = new StarBurst({ points: 10, inner: 0.3, color: DAWN.accent, core: DAWN.accent, additive: false });
  private groundShock = new ShockRefraction({ facing: 'ground' });

  // Scratch.
  private v1 = new THREE.Vector3();
  private v2 = new THREE.Vector3();
  private v3 = new THREE.Vector3();
  private q1 = new THREE.Quaternion();

  constructor(settings: AegisWallSettings = defaultAegisWall()) {
    this.settings = settings;
    for (let i = 0; i < SHIELDS; i++) this.radial.push(new THREE.Vector3());
    this.screen.tint.set(DAWN.dark);
    this.screen.impactColor.set(DAWN.foil);
    this.group.add(this.sigil.mesh, this.panels.mesh, this.cap.mesh, this.star.mesh, this.groundShock.mesh);
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
    dawnFacing(ctx.aim, this.nrm);
    dawnForward(ctx.aim, this.fwd);
    for (let i = 0; i < SHIELDS; i++) {
      const a = (i / SHIELDS) * Math.PI * 2 + 0.31;
      this.radial[i].set(Math.cos(a), 0, Math.sin(a));
    }
    this.screen.focus.copy(this.point).setY(1.5);
    this.screen.silhouettes = [ctx.caster.group, ...ctx.targets.map((e) => e.group), this.panels.mesh];
    this.groundShock.set(this.point, 0, 0);
  }

  play() {
    this.reset();
    this.playing = true;
  }

  private reset() {
    this.time = 0;
    this.shake = 0;
    const f = this.flags;
    f.asm = f.hit = f.tick = f.shatter = false;
    clearScreenFx(this.screen);
    this.screen.impactColor.set(DAWN.foil);
    this.sigil.reset();
    this.panels.reset();
    this.cap.reset();
    this.star.set(this.point, 1e-3, 0);
    this.groundShock.set(this.point, 0, 0);
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

    if (!f.asm && t >= ASSEMBLE_T) {
      f.asm = true;
      this.layout();
      this.panels.assemble(0.22, 0.1, 5);
    }
    if (!f.hit && t >= HIT_T) {
      f.hit = true;
      this.shake = 0.35;
      this.cap.place(0, this.v1.copy(this.point).setY(LENGTH * Math.cos(THETA_1) + 0.1), dawnOrient(UP, this.nrm, this.q1), 1.5, 'hex', 1, DAWN.hot);
      this.cap.assemble(0.1, 0, 2.5);
      if (ctx) for (const e of ctx.targets) ctx.hit(e, { damage: this.settings.damage, knock: 0, color: DAWN_CSS.body });
    }
    if (!f.tick && t >= TICK_T) {
      f.tick = true;
      if (ctx) for (const e of ctx.targets) ctx.hit(e, { damage: this.settings.tick, knock: 0, color: DAWN_CSS.body });
    }
    if (!f.shatter && t >= SHATTER_T) {
      f.shatter = true;
      this.v1.copy(this.point).setY(1.2);
      this.panels.shatter(7, 0.78, this.v1);
      this.cap.shatter(5, 0.7, this.v1);
    }

    this.layout();
    this.panels.update(dt);
    this.cap.update(dt);
  }

  private layout() {
    const t = this.time;
    const f = this.flags;
    const after = t - HIT_T;

    // --- 0..0.3 the sigil draws on; it fades from 1.7 to 2.2. ---
    this.sigil.set(this.point, RADIUS);
    this.sigil.reveal = smoothstep(t / SIGIL_END);
    this.sigil.opacity = 1 - smoothstep((t - 1.7) / 0.5);

    // --- 0.3..0.7 ten kite shields click into a ring, upright; 0.55..0.75 they tilt in and slam shut. ---
    if (t >= ASSEMBLE_T && !f.shatter) {
      const u = THREE.MathUtils.clamp((t - TILT_A) / (HIT_T - TILT_A), 0, 1);
      const theta = THETA_0 + (THETA_1 - THETA_0) * u * u;
      const pulse = f.tick ? Math.exp(-(t - TICK_T) * 9) : 0;
      const slam = f.hit ? Math.exp(-after * 8) : 0;
      for (let i = 0; i < SHIELDS; i++) {
        const r = this.radial[i];
        const th = theta * (1 - (i % 2) * 0.02);
        // Axis from the base toward the apex, outward normal of the shield plane.
        this.v1.copy(r).multiplyScalar(-Math.sin(th)).addScaledVector(UP, Math.cos(th));
        this.v2.copy(r).multiplyScalar(Math.cos(th)).addScaledVector(UP, Math.sin(th));
        this.v3.copy(this.point).addScaledVector(r, RING_R).addScaledVector(this.v1, LENGTH * 0.5);
        // The shield's own +Y runs toward the base, so its wide flat top sits at the base and the point at the apex.
        dawnOrient(this.v2, this.v1.negate(), this.q1);
        this.panels.place(i, this.v3, this.q1, LENGTH * (1 + 0.05 * (pulse + slam * 0.5)), 'shield', WIDE, i % 3 === 1 ? 0xd9a02e : DAWN.body);
      }
      this.panels.glow = 0.5 * Math.max(after >= 0 && after < 0.1 ? 1 - after / 0.1 : 0, f.tick && t - TICK_T < 0.1 ? 1 - (t - TICK_T) / 0.1 : 0);
    }

    // --- The hit: sky-blue star at the apex, ground refraction 1 -> 5, shake. ---
    if (f.hit) {
      this.v1.copy(this.point).setY(LENGTH * Math.cos(THETA_1) + 0.2);
      const sp = StarBurst.pop(after, 0.02, 0.04);
      this.star.set(this.v1, 1.1 * sp.scale + 1e-3, sp.opacity, 0.1);
      const gp = THREE.MathUtils.clamp(after / 0.4, 0, 1);
      this.groundShock.set(this.point, 1 + 4 * gp, 0.04 * (1 - gp) * (1 - gp));
      this.shake = 0.35 * Math.exp(-after * 9);
    }
  }
}

export const aegisWallModule: EffectModule = {
  label: 'aegis wall',
  category: 'hero: dawn',
  targeting: { mode: 'ground', radius: RADIUS },
  create: () => new AegisWall(),
  telegraphs(effect) {
    const e = effect as AegisWall;
    const ctx = e.ctx;
    if (!ctx) return [];
    return [{ shape: { kind: 'circle', x: ctx.point.x, z: ctx.point.z, radius: RADIUS }, start: 0, impact: HIT_T }];
  },
  bloom: { enabled: true, strength: 0.4, radius: 0.35, threshold: 0.88 },
  frameCamera(camera, controls, effect) {
    const e = effect as AegisWall;
    if (e.ctx) frameCast(camera, controls, e.ctx, 5);
  },
  buildGui(f, effect) {
    const s = (effect as AegisWall).settings;
    f.add(s, 'loop');
    f.add(s, 'damage', 1, 150, 1);
    f.add(s, 'tick', 0, 60, 1);
  },
};
