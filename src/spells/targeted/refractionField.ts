import * as THREE from 'three';
import { Emitter } from '../../emitter';
import { smoothstep } from '../../effects/common';
import { ShockRefraction, StarBurst } from '../../effects/parts';
import { Crystal, Glitter, PRISM, PRISM_CSS, SpectrumBeam } from '../../effects/parts/prism';
import { frameCast, type CastContext } from '../../effects/targeting';
import type { Effect, EffectModule } from '../../effects/types';

/**
 * Refraction Field (prism kit, W: a blinding ground zone, radius 4). A ring of 6 tilted crystals rises at the zone edge,
 * facing inward (0..0.3). Each fires a white beam to a prism forming over the centre (about 2.5 high), which spins faster
 * and brightens (0.3..0.7). At 0.75 the prism bursts: spectral beams flash down across the zone, glitter, a little
 * shake, a ground refraction ring, and every enemy inside takes the hit and is blinded. From 1.0 the crystals shatter
 * into glitter. Clean by 2.2 s. See pipeline/designs/kit-prism.md.
 */
export interface RefractionFieldSettings {
  damage: number;
  blindSeconds: number;
  loop: boolean;
}

export const defaultRefractionField = (): RefractionFieldSettings => ({ damage: 48, blindSeconds: 1.5, loop: false });

// Timeline (seconds).
const RISE_END = 0.3;
const BEAM_T = 0.3; // white beams to the centre, the prism forms
const HIT_T = 0.75;
const SHATTER_T = 1.0;
const DURATION = 2.2;

const RADIUS = 4;
const COUNT = 6;
const CRYS_LEN = 2.2;
const CRYS_W = 0.8;
const TILT = 0.3;
const PRISM_Y = 2.5;
const RAYS = 8;

export class RefractionField implements Effect {
  readonly group = new THREE.Group();
  readonly settings: RefractionFieldSettings;
  readonly emitters: Emitter[] = [];
  shake = 0;
  playing = false;

  /** Last cast; frameCamera and telegraphs read it. Null until the first play(). */
  ctx: CastContext | null = null;
  private time = 0;
  private point = new THREE.Vector3(0, 0, -8);
  private flags = { ring: false, prism: false, hit: false, shattered: false };
  private idx: number[] = [];
  private mainIdx = -1;
  private tips: THREE.Vector3[] = [];
  private glintT = 0;

  private ring = new Crystal(COUNT + 2);
  private main = new Crystal(2);
  private beams = new SpectrumBeam(COUNT + RAYS);
  private glitter = new Glitter(90);
  private star = new StarBurst({ points: 4, inner: 0.18, color: PRISM.body, core: 0xffffff, additive: true });
  private groundShock = new ShockRefraction({ facing: 'ground' });
  private shade: THREE.Mesh;
  private shadeMat = new THREE.MeshBasicMaterial({ color: PRISM.dark, transparent: true, opacity: 0, depthWrite: false });
  private rim: THREE.Mesh;
  private rimMat = new THREE.MeshBasicMaterial({ color: PRISM.foil, transparent: true, opacity: 0, depthWrite: false });

  private v1 = new THREE.Vector3();
  private v2 = new THREE.Vector3();
  private v3 = new THREE.Vector3();
  private up = new THREE.Vector3(0, 1, 0);

  constructor(settings: RefractionFieldSettings = defaultRefractionField()) {
    this.settings = settings;
    for (let i = 0; i < COUNT; i++) this.tips.push(new THREE.Vector3());
    this.ring.spin = 0.5;
    this.main.spin = 1.5;
    // A dark layer under the crystals and a pale rim on the zone edge, so the ring reads on the floor.
    this.shade = new THREE.Mesh(new THREE.CircleGeometry(1, 48).rotateX(-Math.PI / 2), this.shadeMat);
    this.shade.renderOrder = 1;
    this.shade.visible = false;
    this.rim = new THREE.Mesh(new THREE.RingGeometry(0.96, 1, 64).rotateX(-Math.PI / 2), this.rimMat);
    this.rim.renderOrder = 2;
    this.rim.visible = false;
    this.group.add(this.shade, this.rim, this.ring.mesh, this.main.mesh, this.beams.mesh, this.glitter.mesh, this.star.mesh, this.groundShock.mesh);
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
    this.groundShock.set(this.point, 0, 0);
  }

  play() {
    this.reset();
    this.playing = true;
  }

  private reset() {
    this.time = 0;
    this.shake = 0;
    this.glintT = 0;
    this.flags.ring = this.flags.prism = this.flags.hit = this.flags.shattered = false;
    this.idx.length = 0;
    this.mainIdx = -1;
    this.ring.reset();
    this.main.reset();
    this.beams.reset();
    this.glitter.reset();
    this.shade.visible = false;
    this.rim.visible = false;
    this.shadeMat.opacity = 0;
    this.rimMat.opacity = 0;
    this.star.set(this.point, 0, 0);
    this.groundShock.set(this.point, 0, 0);
  }

  /** True while `e` stands inside the zone right now (enemies who walked out before the impact are spared). */
  private inside(e: CastContext['targets'][number]) {
    const p = e.group.position;
    return Math.hypot(p.x - this.point.x, p.z - this.point.z) <= RADIUS;
  }

  update(dt: number) {
    for (const e of this.emitters) e.update(dt);
    this.ring.update(dt);
    this.main.update(dt);
    this.glitter.update(dt);
    if (!this.playing) return;
    this.time += dt;
    if (this.time >= DURATION) {
      const loop = this.settings.loop;
      this.playing = false;
      this.reset();
      if (loop) this.play();
      return;
    }
    const t = this.time, f = this.flags, P = this.point;

    // --- 0..0.3: six crystals rise at the zone edge, leaning inward. ---
    if (!f.ring) {
      f.ring = true;
      for (let i = 0; i < COUNT; i++) {
        this.idx[i] = this.ring.place(this.v1.set(P.x, -CRYS_LEN, P.z), this.up, CRYS_LEN, CRYS_W, { scale: 1e-3 });
      }
      this.shade.visible = this.rim.visible = true;
      this.shade.position.set(P.x, 0.03, P.z);
      this.shade.scale.setScalar(RADIUS);
      this.rim.position.set(P.x, 0.05, P.z);
      this.rim.scale.setScalar(RADIUS);
    }
    if (t < SHATTER_T && f.ring) {
      const k = Math.min(1, t / RISE_END), e = easeOut(k);
      for (let i = 0; i < COUNT; i++) {
        const a = (i / COUNT) * Math.PI * 2 + 0.3;
        this.v1.set(Math.cos(a), 0, Math.sin(a)); // outward
        this.v2.copy(this.up).multiplyScalar(Math.cos(TILT)).addScaledVector(this.v1, -Math.sin(TILT)); // axis, leaning inward
        const h = -CRYS_LEN * 0.5 + (CRYS_LEN * 0.5 + 0.1) * e + CRYS_LEN * 0.05;
        this.v3.set(P.x + this.v1.x * RADIUS, h, P.z + this.v1.z * RADIUS);
        this.ring.move(this.idx[i], this.v3, this.v2);
        this.ring.setScale(this.idx[i], Math.max(e, 1e-3));
        // Beam start: the crystal's upper tip.
        this.tips[i].copy(this.v3).addScaledVector(this.v2, CRYS_LEN * 0.5);
      }
    }

    // --- 0.3..0.7: the prism forms over the centre; each crystal fires a white beam into it. ---
    if (!f.prism && t >= BEAM_T) {
      f.prism = true;
      this.mainIdx = this.main.place(this.v1.set(P.x, PRISM_Y, P.z), this.up, 1.9, 0.95, { scale: 1e-3, spin: 1.5 });
    }
    if (f.prism && !f.hit) {
      const k = Math.min(1, (t - BEAM_T) / 0.4);
      this.v1.set(P.x, PRISM_Y, P.z);
      this.main.setScale(this.mainIdx, Math.max(easeOut(k * 1.4), 1e-3) * (1 + 0.12 * k));
      this.main.setSpin(this.mainIdx, 1.5 + 9 * k * k);
      this.main.move(this.mainIdx, this.v1.set(P.x, PRISM_Y + Math.sin(t * 5) * 0.06, P.z));
      const grow = smoothstep(Math.min(1, (t - BEAM_T) / 0.12));
      for (let i = 0; i < COUNT; i++) {
        // Each beam pulses a little out of phase.
        const op = grow * (0.75 + 0.25 * Math.sin(t * 38 + i * 1.9));
        this.beams.set(this.tips[i], this.v1, 0.28 + 0.12 * k, op, PRISM.hot, 1, i);
      }
      this.glintT += dt;
      if (this.glintT >= 0.09) { this.glintT = 0; this.glitter.burst(this.v1, 1, 1.2); }
      this.star.set(this.v1, 1.3 * k * (0.8 + 0.2 * Math.sin(t * 30)), 0.8 * k, t * 3);
    }

    // --- 0.75: the prism bursts, spectral beams flash down across the zone, everyone inside is hit and blinded. ---
    if (!f.hit && t >= HIT_T) {
      f.hit = true;
      this.hit();
    }
    if (f.hit) this.afterHit(t - HIT_T);

    // --- 1.0: the crystals shatter into glitter. ---
    if (!f.shattered && t >= SHATTER_T) {
      f.shattered = true;
      this.ring.shatter(3.2, 0.9, P);
      for (let i = 0; i < COUNT; i++) this.glitter.burst(this.tips[i], 3, 2.5);
      this.rim.visible = false;
    }

    // --- The dark layer fades in with the ring and out with the shatter. ---
    this.shadeMat.opacity = 0.38 * Math.min(1, t / RISE_END) * (1 - smoothstep((t - 1.5) / 0.6));
    this.rimMat.opacity = 0.7 * Math.min(1, t / RISE_END) * (f.shattered ? 0 : 1);
  }

  private hit() {
    const ctx = this.ctx, P = this.point, s = this.settings;
    this.v1.set(P.x, PRISM_Y, P.z);
    if (this.mainIdx >= 0) { this.main.shatter(5, 0.6, this.v1); this.mainIdx = -1; }
    this.glitter.burst(this.v1, 16, 5);
    this.shake = 0.3;
    for (let i = 0; i < COUNT; i++) this.beams.hide(i);
    // Spectral beams from the prism down across the zone; irregular lengths and angles.
    for (let i = 0; i < RAYS; i++) {
      const a = (i / RAYS) * Math.PI * 2 + 0.2 + (i % 3) * 0.08;
      const r = RADIUS * (0.7 + 0.28 * ((i * 5) % 7) / 6);
      this.v2.set(P.x + Math.cos(a) * r, 0.15, P.z + Math.sin(a) * r);
      this.beams.set(this.v1, this.v2, 0.62, 1, undefined, 0.35, COUNT + i);
    }
    // Re-check where everyone stands now: enemies who walked out are spared.
    if (ctx) for (const e of ctx.targets) {
      if (!this.inside(e)) continue;
      ctx.hit(e, { damage: s.damage, knock: 0, from: P, color: PRISM_CSS.body, status: { kind: 'blind', seconds: s.blindSeconds } });
      const p = e.group.position;
      this.glitter.burst(this.v3.set(p.x, 1.0, p.z), 5, 3);
    }
  }

  private afterHit(after: number) {
    const P = this.point;
    // The rays flash and fade band by band.
    const op = Math.max(0, 1 - Math.pow(after / 0.45, 1.5));
    this.v1.set(P.x, PRISM_Y, P.z);
    for (let i = 0; i < RAYS; i++) {
      const a = (i / RAYS) * Math.PI * 2 + 0.2 + (i % 3) * 0.08;
      const r = RADIUS * (0.7 + 0.28 * ((i * 5) % 7) / 6);
      this.v2.set(P.x + Math.cos(a) * r, 0.15, P.z + Math.sin(a) * r);
      this.beams.set(this.v1, this.v2, 0.62 * (0.6 + 0.4 * op), op * (1 - i * 0.02), undefined, 0.35, COUNT + i);
    }
    const sp = StarBurst.pop(after, 0, 0.05);
    this.star.set(this.v1, 1.2 * sp.scale, sp.opacity, 0.3);
    const gp = THREE.MathUtils.clamp(after / 0.5, 0, 1);
    this.groundShock.set(P, 1 + 4 * gp, 0.04 * (1 - gp) * (1 - gp));
    this.shake = Math.max(this.shake * 0.9, 0.3 * Math.exp(-after * 9));
  }
}

const easeOut = (x: number) => 1 - Math.pow(1 - Math.min(1, Math.max(0, x)), 3);

export const refractionFieldModule: EffectModule = {
  label: 'refraction field',
  category: 'hero: prism',
  targeting: { mode: 'ground', radius: RADIUS },
  create: () => new RefractionField(),
  telegraphs(effect) {
    const e = effect as RefractionField;
    const ctx = e.ctx;
    if (!ctx) return [];
    return [{ shape: { kind: 'circle', x: ctx.point.x, z: ctx.point.z, radius: RADIUS }, start: 0, impact: HIT_T }];
  },
  bloom: { enabled: true, strength: 0.35, radius: 0.35, threshold: 0.86 },
  frameCamera(camera, controls, effect) {
    const e = effect as RefractionField;
    if (e.ctx) frameCast(camera, controls, e.ctx, 4);
  },
  buildGui(f, effect) {
    const s = (effect as RefractionField).settings;
    f.add(s, 'loop');
    f.add(s, 'damage', 1, 120, 1);
    f.add(s, 'blindSeconds', 0, 2, 0.1);
  },
};
