import * as THREE from 'three';
import { Emitter } from '../../emitter';
import { smoothstep } from '../../effects/common';
import { ShockRefraction, StarBurst, clearScreenFx, createScreenFx, impactFrameAt } from '../../effects/parts';
import {
  DAWN, DAWN_CSS, LightPanels, Sigil, dawnFacing, dawnForward, dawnOrient, dawnPanelNormal, dawnView, type PanelShape,
} from '../../effects/parts/dawn';
import { frameCast, type CastContext } from '../../effects/targeting';
import type { Effect, EffectModule } from '../../effects/types';

/**
 * Radiant Spear (dawn kit, Q: single-target pierce). Six gold shards click together into a long spear over Auriel's
 * shoulder, it flies and pierces the target; the shards burst out of its back in a fan with a sky-blue accent, a small
 * sun-wheel sigil flashes under it, one impact frame. The shards tumble and shrink away panel by panel. See
 * pipeline/designs/kit-dawn.md.
 */
export interface RadiantSpearSettings {
  damage: number;
  loop: boolean;
}

export const defaultRadiantSpear = (): RadiantSpearSettings => ({ damage: 50, loop: false });

// Timeline (seconds).
const ASSEMBLE = 0.2; // the spear is whole and starts to fly
const HIT_T = 0.45;
const DURATION = 1.5;
const CHEST_Y = 1.25;
const SPEAR = 6;
const SPRAY = 8;
const UP = new THREE.Vector3(0, 1, 0);
// Offsets of the six shards along the spear axis, and their size and width (the last one is the tip).
const OFFS = [-1.56, -0.93, -0.3, 0.33, 0.96, 1.59];
const SIZES = [0.95, 0.95, 0.95, 0.95, 0.95, 1.5];
const WIDES = [1.6, 1.8, 1.8, 1.7, 1.5, 1.25];

export class RadiantSpear implements Effect {
  readonly group = new THREE.Group();
  readonly settings: RadiantSpearSettings;
  readonly emitters: Emitter[] = [];
  readonly screen = createScreenFx();
  shake = 0;
  playing = false;

  /** Last cast; frameCamera and telegraphs read it. Null until the first play(). */
  ctx: CastContext | null = null;
  private time = 0;

  // Cast geometry, computed in cast().
  private from = new THREE.Vector3(0, 0, 14);
  private fwd = new THREE.Vector3(0, 0, -1);
  private right = new THREE.Vector3(1, 0, 0);
  private view = new THREE.Vector3(0, 0.45, 0.9);
  private start = new THREE.Vector3();
  private chest = new THREE.Vector3(0, CHEST_Y, -6);
  private dir = new THREE.Vector3(0, 0, -1);
  private hover = new THREE.Vector3();
  private endC = new THREE.Vector3();
  private ground = new THREE.Vector3();

  private flags = { hit: false };

  // Parts.
  private panels = new LightPanels(SPEAR + SPRAY + 1, 6);
  private sigil = new Sigil();
  private star = new StarBurst({ points: 10, inner: 0.3, color: DAWN.accent, core: DAWN.accent, additive: false });
  private groundShock = new ShockRefraction({ facing: 'ground' });

  // Scratch.
  private v1 = new THREE.Vector3();
  private v2 = new THREE.Vector3();
  private v3 = new THREE.Vector3();
  private q1 = new THREE.Quaternion();

  constructor(settings: RadiantSpearSettings = defaultRadiantSpear()) {
    this.settings = settings;
    this.screen.tint.set(DAWN.dark);
    this.screen.impactColor.set(DAWN.foil);
    this.group.add(this.sigil.mesh, this.panels.mesh, this.star.mesh, this.groundShock.mesh);
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
    this.from.copy(ctx.from).setY(0);
    dawnForward(ctx.aim, this.fwd);
    dawnFacing(ctx.aim, this.v1);
    this.right.crossVectors(UP, this.v1).normalize();
    dawnView(ctx.aim, this.view);
    const tp = ctx.targetPos[0] ?? ctx.point;
    this.chest.set(tp.x, CHEST_Y, tp.z);
    this.ground.set(tp.x, 0, tp.z);
    this.start.copy(this.from).addScaledVector(this.right, 0.55).addScaledVector(this.fwd, 0.2).setY(2.0);
    this.dir.subVectors(this.chest, this.start).normalize();
    this.hover.copy(this.start).addScaledVector(this.dir, 1.1);
    this.endC.copy(this.chest).addScaledVector(this.dir, 0.3);
    this.screen.focus.copy(this.chest);
    this.screen.silhouettes = [ctx.caster.group, ...ctx.targets.map((e) => e.group), this.panels.mesh];
    this.groundShock.set(this.ground, 0, 0);
  }

  play() {
    this.reset();
    this.playing = true;
    this.layout();
    this.panels.assemble(0.12, 0.07, 4.5);
  }

  private reset() {
    this.time = 0;
    this.shake = 0;
    this.flags.hit = false;
    clearScreenFx(this.screen);
    this.screen.impactColor.set(DAWN.foil);
    this.panels.reset();
    this.sigil.reset();
    this.star.set(this.chest, 1e-3, 0);
    this.groundShock.set(this.ground, 0, 0);
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

    if (!f.hit && t >= HIT_T) {
      f.hit = true;
      this.shake = 0.3;
      this.burst();
      if (ctx && ctx.targets[0]) {
        ctx.hit(ctx.targets[0], { damage: this.settings.damage, knock: 3, from: ctx.from, color: DAWN_CSS.body });
      }
    }

    this.layout();
    this.panels.update(dt);
  }

  /** The spear shatters out of the target's back: its own six shards plus a spray of smaller panels, in a fan. */
  private burst() {
    const shapes: PanelShape[] = ['shard', 'hex', 'shard', 'shield'];
    const base = this.v1.copy(this.chest).addScaledVector(this.dir, 0.9);
    dawnPanelNormal(this.dir, this.view, this.v2);
    this.v3.crossVectors(this.dir, this.v2).normalize(); // sideways in the panel plane
    for (let k = 0; k < SPRAY; k++) {
      const spread = ((k / (SPRAY - 1)) * 2 - 1) * 0.95 + (Math.random() - 0.5) * 0.2;
      const lift = (Math.random() - 0.3) * 0.8;
      const vel = new THREE.Vector3()
        .copy(this.dir).multiplyScalar(Math.cos(spread) * (7 + Math.random() * 3))
        .addScaledVector(this.v3, Math.sin(spread) * (7 + Math.random() * 3));
      vel.y += 2.2 + lift * 2;
      const shape = shapes[k % shapes.length];
      this.panels.place(SPEAR + k, base, dawnOrient(this.v2, vel, this.q1), shape === 'shard' ? 1.6 : 0.9, shape, shape === 'shard' ? 1.2 : 1);
      this.panels.fling(SPEAR + k, vel, 0.85 + Math.random() * 0.08, 10);
    }
    this.panels.hide(SPEAR + SPRAY);
    for (let k = 0; k < SPEAR; k++) {
      const spread = (Math.random() - 0.5) * 1.1;
      const vel = new THREE.Vector3()
        .copy(this.dir).multiplyScalar(Math.cos(spread) * (5 + Math.random() * 3))
        .addScaledVector(this.v3, Math.sin(spread) * (5 + Math.random() * 3));
      vel.y += 1.2 + Math.random() * 2;
      this.panels.fling(k, vel, 0.8 + Math.random() * 0.1, 8);
    }
  }

  private layout() {
    const t = this.time;
    const f = this.flags;
    const after = t - HIT_T;

    // --- 0..0.2 the spear forms over the shoulder; 0.2..0.45 it flies and pierces. ---
    if (!f.hit) {
      const u = Math.pow(THREE.MathUtils.clamp((t - ASSEMBLE) / (HIT_T - ASSEMBLE), 0, 1), 1.5);
      this.v1.lerpVectors(this.hover, this.endC, u);
      dawnPanelNormal(this.dir, this.view, this.v2);
      dawnOrient(this.v2, this.dir, this.q1);
      for (let i = 0; i < SPEAR; i++) {
        this.v3.copy(this.v1).addScaledVector(this.dir, OFFS[i]);
        this.panels.place(i, this.v3, this.q1, SIZES[i], 'shard', WIDES[i], i % 2 === 0 ? DAWN.hot : i === SPEAR - 1 ? DAWN.foil : DAWN.body);
      }
      // A gold streak trailing behind the flying spear.
      const trail = this.v1.distanceTo(this.hover);
      if (trail > 0.4) {
        this.v3.copy(this.v1).addScaledVector(this.dir, -1.7 - trail * 0.5);
        this.panels.place(SPEAR + SPRAY, this.v3, this.q1, trail, 'shard', Math.min(0.9 / (0.28 * trail), 3), DAWN.body);
      }
    }

    // --- Sun-wheel sigil flash under the target, ground refraction, sky-blue star, impact frame. ---
    this.screen.impact = impactFrameAt(t, HIT_T, [1], 0.03);
    if (f.hit) {
      this.sigil.set(this.ground, 1.9);
      this.sigil.reveal = 1;
      this.sigil.opacity = 1 - smoothstep(after / 0.55);
      const sp = StarBurst.pop(after, 0, 0.03);
      this.star.set(this.chest, 1.0 * sp.scale + 1e-3, sp.opacity, 0.2);
      const gp = THREE.MathUtils.clamp(after / 0.3, 0, 1);
      this.groundShock.set(this.ground, 0.5 + 3 * gp, 0.03 * (1 - gp) * (1 - gp));
      this.shake = 0.3 * Math.exp(-after * 10);
    }
  }
}

export const radiantSpearModule: EffectModule = {
  label: 'radiant spear',
  category: 'hero: dawn',
  targeting: { mode: 'enemy' },
  create: () => new RadiantSpear(),
  telegraphs(effect) {
    const e = effect as RadiantSpear;
    const ctx = e.ctx;
    if (!ctx) return [];
    const c = ctx.targetPos[0] ?? ctx.point;
    return [{ shape: { kind: 'line', x1: ctx.from.x, z1: ctx.from.z, x2: c.x, z2: c.z, width: 1.0 }, start: 0.05, impact: HIT_T }];
  },
  bloom: { enabled: true, strength: 0.4, radius: 0.35, threshold: 0.88 },
  frameCamera(camera, controls, effect) {
    const e = effect as RadiantSpear;
    if (e.ctx) frameCast(camera, controls, e.ctx, 3);
  },
  buildGui(f, effect) {
    const s = (effect as RadiantSpear).settings;
    f.add(s, 'loop');
    f.add(s, 'damage', 1, 150, 1);
  },
};
