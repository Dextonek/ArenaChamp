import * as THREE from 'three';
import { Emitter } from '../../emitter';
import { StarBurst } from '../../effects/parts';
import { BaaWords, Crook, Dust, SHEEP, Tufts } from '../../effects/parts/sheep';
import { frameCast, type CastContext } from '../../effects/targeting';
import { insideTelegraph, type TelegraphShape } from '../../effects/telegraph';
import type { Effect, EffectModule } from '../../effects/types';
import { CROOK_ANGLE, CROOK_DAMAGE, CROOK_REACH, CROOK_WIND, SPARE_SECONDS, bookOf, spawnSheep } from '../../traits/sheep';

/**
 * Crook Whack (sheep kit, Q: a furious swing). Bo hauls his crook up over his shoulder and shakes it, red in the face, for 0.55 s
 * (the wobble grows), then brings it down across a 4 m cone, 100 degrees wide (the shape the telegraph draws): a pale wedge of
 * swept ground, a fan of wool tufts and dust, a pop. Everyone inside the cone on their live position takes 45. A hit on the enemy
 * hero also leaves a sheep at their feet (a real summon, `spawnSheep`: it walks to whoever is nearest, so it bumps them for Wool;
 * with the flock full, or in a network duel where there is no `ctx.summon`, no sheep is made and only its *baa* shows). The cone's
 * apex is `sentFrom` and its heading the caster's facing at the cast, so both screens agree. Telegraph: the cone, impact at the
 * swing (he is rooted 0.55 s). Clean by about 1.4 s. See pipeline/designs/kit-sheep.md.
 */
export interface CrookWhackSettings {
  damage: number;
  loop: boolean;
}

export const defaultCrookWhack = (): CrookWhackSettings => ({ damage: CROOK_DAMAGE, loop: false });

const DURATION = 1.4;
const SWING = 0.12;

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

export class CrookWhack implements Effect {
  readonly group = new THREE.Group();
  readonly settings: CrookWhackSettings;
  readonly emitters: Emitter[] = [];
  shake = 0;
  playing = false;

  /** Last cast; frameCamera and telegraphs read it. Null until the first play(). */
  ctx: CastContext | null = null;
  cone: TelegraphShape = { kind: 'cone', x: 0, z: 0, radius: CROOK_REACH, angle: CROOK_ANGLE, dir: 0 };
  private time = 0;
  private swung = false;
  private yaw = 0;
  private from = new THREE.Vector3();
  private lastPuff = 0;

  private crook = new Crook();
  private tufts = new Tufts(34);
  private dust = new Dust(14);
  private words = new BaaWords(3);
  private sweep = new THREE.Mesh(wedge(CROOK_REACH, CROOK_ANGLE), new THREE.MeshBasicMaterial({ color: SHEEP.hay, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide }));
  private star = new StarBurst({ points: 8, inner: 0.3, color: SHEEP.hay, core: 0xffffff, additive: false });

  private v1 = new THREE.Vector3();
  private v2 = new THREE.Vector3();
  private v3 = new THREE.Vector3();

  constructor(settings: CrookWhackSettings = defaultCrookWhack()) {
    this.settings = settings;
    this.sweep.position.y = 0.06;
    this.sweep.renderOrder = 3;
    this.sweep.frustumCulled = false;
    this.group.add(this.tufts.mesh, this.dust.mesh, this.sweep, this.crook.mesh, this.words.mesh, this.star.mesh);
    this.reset();
  }

  get duration() {
    return DURATION;
  }

  get impactTime() {
    return CROOK_WIND;
  }

  cast(ctx: CastContext) {
    this.ctx = ctx;
    const s = ctx.sentFrom ?? ctx.from;
    this.yaw = ctx.caster.group.rotation.y;
    this.from.set(s.x, 0, s.z);
    this.cone = { kind: 'cone', x: s.x, z: s.z, radius: CROOK_REACH, angle: CROOK_ANGLE, dir: this.yaw };
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
    this.tufts.reset();
    this.dust.reset();
    this.words.reset();
    this.crook.hide();
    this.sweep.visible = false;
    this.star.set(this.from, 0, 0);
  }

  /** The crook in his right hand, `pitch` forward, `roll` sideways. */
  private hold(pitch: number, roll: number) {
    const fwd = this.v1.set(Math.sin(this.yaw), 0, Math.cos(this.yaw));
    this.v2.set(this.from.x + fwd.x * 0.4 + fwd.z * 0.45, 1.25, this.from.z + fwd.z * 0.4 - fwd.x * 0.45);
    this.crook.place(this.v2, this.yaw, pitch, roll);
  }

  update(dt: number) {
    for (const e of this.emitters) e.update(dt);
    this.tufts.update(dt);
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

    // --- Wind-up: the crook is held up and back and shaken harder and harder; he stamps, dust flies off his boots. ---
    if (t < CROOK_WIND) {
      const k = t / CROOK_WIND;
      this.hold(-0.5 - 0.5 * k, Math.sin(t * 52) * (0.1 + 0.28 * k));
      if (t - this.lastPuff >= 0.09) {
        this.lastPuff = t;
        this.dust.puff(this.v3.set(this.from.x + (Math.random() - 0.5) * 0.6, 0.15, this.from.z + (Math.random() - 0.5) * 0.6), 0.35, SHEEP.dust, 0.5);
      }
    }

    // --- The whack. ---
    if (!this.swung && t >= CROOK_WIND) {
      this.swung = true;
      this.shake = 0.14;
      this.sweep.visible = true;
      this.sweep.position.set(this.from.x, 0.06, this.from.z);
      this.sweep.rotation.y = this.yaw;
      this.v3.set(this.from.x + fwd.x * 1.0, 0.5, this.from.z + fwd.z * 1.0);
      this.tufts.fan(this.v3, fwd, 12, 6.5, 0.8, 1.0);
      this.dust.ring(this.v3.set(this.from.x + fwd.x * 2.2, 0, this.from.z + fwd.z * 2.2), 0.8, 6, 0.8, SHEEP.dust);
      if (ctx) this.land(ctx);
    }
    const a = t - CROOK_WIND;
    if (a >= 0) {
      const k = Math.min(1, a / SWING);
      this.hold(-1.0 + 2.5 * (1 - (1 - k) ** 3) - 0.9 * THREE.MathUtils.smoothstep(a, 0.25, 0.6), 0);
      (this.sweep.material as THREE.MeshBasicMaterial).opacity = 0.5 * (1 - THREE.MathUtils.smoothstep(a, 0.08, 0.4));
      const sp = StarBurst.pop(a, 0.03, 0.12);
      this.star.set(this.v3.set(this.from.x + fwd.x * 2.0, 0.9, this.from.z + fwd.z * 2.0), 1.3 * sp.scale, sp.opacity, a * 6);
      if (a > 0.7) this.crook.mesh.visible = false;
    }
    this.shake *= Math.exp(-dt * 12);
  }

  /** The hits, on live positions inside the cone; a hit on the enemy hero leaves a sheep at their feet. */
  private land(ctx: CastContext) {
    const foe = bookOf(ctx.caster).foe;
    const foes = ctx.enemies?.() ?? ctx.targets;
    for (const e of foes) {
      const p = e.group.position;
      if (!insideTelegraph(this.cone, p.x, p.z)) continue;
      ctx.hit(e, { damage: this.settings.damage, knock: 2.5, from: ctx.from, color: '#c9b26a' });
      if (e !== foe && !(foe == null && e === ctx.targets[0])) continue;
      this.v3.set(p.x, 0, p.z);
      spawnSheep(ctx, this.v3, 1, SPARE_SECONDS);
      this.words.say(this.v3, 1.1);
    }
  }
}

export const crookWhackModule: EffectModule = {
  label: 'crook whack',
  category: 'hero: sheep',
  // Quick, no aim: the cone is centred on him and the radius is the reach the CPU uses it at.
  targeting: { mode: 'self', radius: CROOK_REACH },
  create: () => new CrookWhack(),
  telegraphs(effect) {
    const e = effect as CrookWhack;
    if (!e.ctx) return [];
    return [{ shape: e.cone, start: 0, impact: CROOK_WIND }];
  },
  bloom: { enabled: true, strength: 0.3, radius: 0.35, threshold: 0.86 },
  frameCamera(camera, controls, effect) {
    const e = effect as CrookWhack;
    if (e.ctx) frameCast(camera, controls, e.ctx, 3);
  },
  buildGui(f, effect) {
    const s = (effect as CrookWhack).settings;
    f.add(s, 'loop');
    f.add(s, 'damage', 1, 150, 1);
  },
};
