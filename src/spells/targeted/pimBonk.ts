import * as THREE from 'three';
import { Emitter } from '../../emitter';
import { StarBurst } from '../../effects/parts';
import { Confetti, Dust, ToyRing, ToyWords, TWINS, TWINS_CSS, WoodSword } from '../../effects/parts/twins';
import { frameCast, type CastContext } from '../../effects/targeting';
import { insideTelegraph, type TelegraphShape } from '../../effects/telegraph';
import type { Effect, EffectModule } from '../../effects/types';
import { BONK_ANGLE, BONK_DAMAGE, BONK_REACH, BONK_WIND } from '../../traits/twins';

/**
 * Bonk (twins kit, Pim's Q: a wooden sword). Pim hauls the toy sword up over his head and wobbles it (0.45 s, the wobble grows, a few
 * puffs of dust at his boots), then brings it down across a 3 m cone, 100 degrees wide (the shape the telegraph draws): a pale orange
 * wedge of swept floor, a fan of confetti, a spiky star with a white core, a ring, and the word BONK. Everyone inside the cone on their
 * live position takes 50 and is knocked back a little. The cone's apex is `sentFrom` and its heading the aim, so both screens agree.
 * Telegraph: the cone, impact at the swing (he is rooted until then). Clean by about 1.5 s. See pipeline/designs/kit-twins.md.
 */
export interface PimBonkSettings {
  damage: number;
  loop: boolean;
}

export const defaultPimBonk = (): PimBonkSettings => ({ damage: BONK_DAMAGE, loop: false });

const DURATION = 1.5;
const SWING = 0.1;

/** A flat wedge on the ground: `radius` m, `angle` degrees full width, centred on +Z (rotate the mesh to aim it). */
function wedge(radius: number, angle: number, seg = 18): THREE.BufferGeometry {
  const half = THREE.MathUtils.degToRad(angle) / 2, pos = [0, 0, 0];
  for (let i = 0; i <= seg; i++) {
    const a = -half + (i / seg) * half * 2;
    pos.push(Math.sin(a) * radius, 0, Math.cos(a) * radius);
  }
  const idx: number[] = [];
  for (let i = 0; i < seg; i++) idx.push(0, i + 2, i + 1);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  return g;
}

export class PimBonk implements Effect {
  readonly group = new THREE.Group();
  readonly settings: PimBonkSettings;
  readonly emitters: Emitter[] = [];
  shake = 0;
  playing = false;

  /** Last cast; frameCamera and telegraphs read it. Null until the first play(). */
  ctx: CastContext | null = null;
  cone: TelegraphShape = { kind: 'cone', x: 0, z: 0, radius: BONK_REACH, angle: BONK_ANGLE, dir: 0 };
  private time = 0;
  private swung = false;
  private yaw = 0;
  private from = new THREE.Vector3();
  private lastPuff = 0;

  private sword = new WoodSword();
  private bits = new Confetti(40);
  private dust = new Dust(16);
  private words = new ToyWords(2);
  private ring = new ToyRing(TWINS.pim, 0.12);
  private sweep = new THREE.Mesh(wedge(BONK_REACH, BONK_ANGLE), new THREE.MeshBasicMaterial({ color: TWINS.pimMid, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide }));
  private star = new StarBurst({ points: 8, inner: 0.3, color: TWINS.pim, core: 0xffffff, additive: false });
  private spark = new StarBurst({ points: 4, inner: 0.25, color: TWINS.yellow, core: 0xffffff, additive: false });

  private v1 = new THREE.Vector3();
  private v2 = new THREE.Vector3();
  private v3 = new THREE.Vector3();

  constructor(settings: PimBonkSettings = defaultPimBonk()) {
    this.settings = settings;
    this.sweep.renderOrder = 3;
    this.sweep.frustumCulled = false;
    this.group.add(this.bits.mesh, this.dust.mesh, this.sweep, this.ring.mesh, this.sword.mesh, this.words.mesh, this.star.mesh, this.spark.mesh);
    this.reset();
  }

  get duration() {
    return DURATION;
  }

  get impactTime() {
    return BONK_WIND;
  }

  cast(ctx: CastContext) {
    this.ctx = ctx;
    const s = ctx.sentFrom ?? ctx.from;
    this.yaw = ctx.aim;
    this.from.set(s.x, 0, s.z);
    this.cone = { kind: 'cone', x: s.x, z: s.z, radius: BONK_REACH, angle: BONK_ANGLE, dir: this.yaw };
  }

  play() {
    this.reset();
    this.playing = true;
  }

  private reset() {
    this.time = 0;
    this.shake = 0;
    this.swung = false;
    this.lastPuff = 0;
    this.bits.reset();
    this.dust.reset();
    this.words.reset();
    this.sword.hide();
    this.sweep.visible = false;
    this.star.set(this.from, 0, 0);
    this.spark.set(this.from, 0, 0);
    this.ring.set(this.from, 0, 0);
  }

  /** The sword in his right hand, `pitch` forward (negative: up), `roll` sideways. */
  private hold(pitch: number, roll: number) {
    const fwd = this.v1.set(Math.sin(this.yaw), 0, Math.cos(this.yaw));
    this.v2.set(this.from.x + fwd.x * 0.35 + fwd.z * 0.4, 1.15, this.from.z + fwd.z * 0.35 - fwd.x * 0.4);
    this.sword.place(this.v2, this.yaw, pitch, roll);
  }

  update(dt: number) {
    for (const e of this.emitters) e.update(dt);
    this.bits.update(dt);
    this.dust.update(dt);
    this.words.update(dt);
    if (!this.playing) return;
    this.time += dt;
    const t = this.time, ctx = this.ctx;
    if (t >= DURATION) {
      const loop = this.settings.loop;
      this.playing = false;
      this.reset();
      if (loop) this.play();
      return;
    }
    const fwd = this.v1.set(Math.sin(this.yaw), 0, Math.cos(this.yaw));

    // --- Wind-up: the sword goes up and back and wobbles harder and harder; he stamps, dust flies off his boots. ---
    if (t < BONK_WIND) {
      const k = t / BONK_WIND, up = THREE.MathUtils.smoothstep(k, 0, 0.45);
      this.hold(-0.4 - 1.8 * up, Math.sin(t * 46) * (0.06 + 0.22 * k));
      if (t - this.lastPuff >= 0.1) {
        this.lastPuff = t;
        this.dust.puff(this.v3.set(this.from.x + (Math.random() - 0.5) * 0.6, 0.15, this.from.z + (Math.random() - 0.5) * 0.6), 0.3, 0xd9c9a8, 0.5);
      }
    }

    // --- The bonk. ---
    if (!this.swung && t >= BONK_WIND) {
      this.swung = true;
      this.shake = 0.16;
      this.sweep.visible = true;
      this.sweep.position.set(this.from.x, 0.06, this.from.z);
      this.sweep.rotation.y = this.yaw;
      this.v3.set(this.from.x + fwd.x * 1.2, 0.6, this.from.z + fwd.z * 1.2);
      this.bits.spray(this.v3, fwd, 14, 6.5, 0.8);
      this.dust.ring(this.v3.set(this.from.x + fwd.x * 2.0, 0, this.from.z + fwd.z * 2.0), 0.8, 6, 0.7, 0xd9c9a8);
      this.words.say('BONK', this.v3.set(this.from.x + fwd.x * 1.8, 0, this.from.z + fwd.z * 1.8), 1.7, 0.9, TWINS_CSS.yellow, 1.9);
      if (ctx) this.land(ctx);
    }
    const a = t - BONK_WIND;
    if (a >= 0) {
      const k = Math.min(1, a / SWING);
      this.hold(-2.2 + 2.7 * (1 - (1 - k) ** 3) - 0.5 * THREE.MathUtils.smoothstep(a, 0.25, 0.6), 0);
      (this.sweep.material as THREE.MeshBasicMaterial).opacity = 0.5 * (1 - THREE.MathUtils.smoothstep(a, 0.06, 0.4));
      const sp = StarBurst.pop(a, 0.04, 0.14);
      this.star.set(this.v3.set(this.from.x + fwd.x * 1.9, 1.0, this.from.z + fwd.z * 1.9), 1.5 * sp.scale, sp.opacity, a * 5);
      this.spark.set(this.v3.set(this.from.x + fwd.x * 1.9, 1.0, this.from.z + fwd.z * 1.9), 0.9 * sp.scale, sp.opacity, -a * 6);
      const rp = THREE.MathUtils.clamp(a / 0.4, 0, 1);
      this.ring.set(this.v3.set(this.from.x + fwd.x * 1.4, 0, this.from.z + fwd.z * 1.4), 0.4 + 1.6 * rp, 0.6 * (1 - rp) * (1 - rp));
      if (a > 0.7) this.sword.hide();
    }
    this.shake *= Math.exp(-dt * 12);
  }

  /** The hits, on live positions inside the cone. */
  private land(ctx: CastContext) {
    const foes = ctx.enemies?.() ?? ctx.targets;
    for (const e of foes) {
      const p = e.group.position;
      if (!insideTelegraph(this.cone, p.x, p.z)) continue;
      ctx.hit(e, { damage: this.settings.damage, knock: 3, from: ctx.from, color: TWINS_CSS.pim });
    }
  }
}

export const pimBonkModule: EffectModule = {
  label: 'bonk',
  category: 'hero: twins',
  // A cone in front of him, toward the aim: the radius is the reach the CPU uses it at.
  targeting: { mode: 'ground', radius: 1 },
  create: () => new PimBonk(),
  telegraphs(effect) {
    const e = effect as PimBonk;
    if (!e.ctx) return [];
    return [{ shape: e.cone, start: 0, impact: BONK_WIND }];
  },
  bloom: { enabled: true, strength: 0.3, radius: 0.35, threshold: 0.86 },
  frameCamera(camera, controls, effect) {
    const e = effect as PimBonk;
    if (e.ctx) frameCast(camera, controls, e.ctx, 3);
  },
  buildGui(f, effect) {
    const s = (effect as PimBonk).settings;
    f.add(s, 'loop');
    f.add(s, 'damage', 1, 150, 1);
  },
};
