import * as THREE from 'three';
import { Emitter } from '../../emitter';
import { smoothstep, type Enemy } from '../../effects/common';
import { ShockRefraction, StarBurst, clearScreenFx, createScreenFx, impactFrameAt } from '../../effects/parts';
import { Crystal, Glitter, PRISM, PRISM_CSS, PrismRing, SpectrumBeam } from '../../effects/parts/prism';
import { frameCast, type CastContext } from '../../effects/targeting';
import type { Effect, EffectModule } from '../../effects/types';

/**
 * Spectrum Lance (prism kit, R: the MOBA ultimate). Under the normal gameplay camera, no letterbox: the world darkens to a
 * deep violet-black and a ring of small crystals marks the zone (radius 7). A huge faceted prism (about 4 tall, top
 * under y 8.5) assembles from shards over the point while 8 smaller prisms orbit it and enemies are pulled in a little.
 * A white beam strikes it from the sky, it glows from inside, everything hangs for a dead beat (1.85..2.0), then it
 * splits the beam into 7 spectral lances that slam into the ground in a ring (2.0..2.2) and sweep once round the zone.
 * The impact (2.2): two impact frames, glitter along the lances, a spectrum accent, a ground refraction ring, shake and
 * the hit. The lances fade band by band, the prism shatters into glitter, the light lifts. Clean by 4.5 s.
 * See pipeline/designs/kit-prism.md.
 */
export interface SpectrumLanceSettings {
  damage: number;
  knock: number;
  loop: boolean;
}

export const defaultSpectrumLance = (): SpectrumLanceSettings => ({ damage: 125, knock: 4, loop: false });

// Timeline (seconds).
const MARK_END = 0.4; // darkness in, the ring of small crystals up
const BUILD_T = 0.3; // the prism starts to assemble
const BUILD_END = 1.6;
const BEAM_T = 1.6; // the beam strikes
const BEAT_T = 1.85; // dead beat 1.85..2.0
const SPLIT_T = 2.0;
const HIT_T = 2.2;
const SWEEP_END = 3.1;
const SHATTER_T = 3.0;
const MARKERS_T = 3.2;
const DURATION = 4.5;

const RADIUS = 7;
const PRISM_Y = 5.2; // centre; the 4-tall prism's top is at 7.2, under the 8.5 limit
const PRISM_LEN = 4;
const PRISM_W = 2.2;
const MARKERS = 12;
const SHARDS = 12;
const LANCES = 7;
const SKY_Y = 15;

export class SpectrumLance implements Effect {
  readonly group = new THREE.Group();
  readonly settings: SpectrumLanceSettings;
  readonly emitters: Emitter[] = [];
  readonly screen = createScreenFx();
  shake = 0;
  playing = false;

  /** Last cast; frameCamera and telegraphs read it. Null until the first play(). */
  ctx: CastContext | null = null;
  private time = 0;

  // Cast geometry.
  private point = new THREE.Vector3(0, 0, -8);
  private victims: { enemy: Enemy; feet: THREE.Vector3 }[] = [];

  private flags = { markers: false, prism: false, beam: false, split: false, hit: false, shattered: false, markersGone: false };
  private mainIdx = -1;
  private markerIdx: number[] = [];
  private shardIdx: number[] = [];
  private shardFrom: THREE.Vector3[] = [];
  private shardDelay: number[] = [];
  private glintT = 0;
  private footT = 0;
  private lanceR: number[] = [];
  private lanceA: number[] = [];

  // Parts.
  private markers = new Crystal(MARKERS);
  private shards = new Crystal(SHARDS);
  private main = new Crystal(2);
  private orbit = new PrismRing(8);
  private beams = new SpectrumBeam(1 + LANCES);
  private glitter = new Glitter(160);
  private flare = new StarBurst({ points: 4, inner: 0.16, color: PRISM.body, core: 0xffffff, additive: true });
  private pop = new StarBurst({ points: 12, inner: 0.3, color: PRISM.gold, core: 0xffffff, additive: false });
  private pop2 = new StarBurst({ points: 8, inner: 0.3, color: PRISM.blue, core: 0xffffff, additive: false });
  private groundShock = new ShockRefraction({ facing: 'ground' });
  private shade: THREE.Mesh;
  private shadeMat = new THREE.MeshBasicMaterial({ color: PRISM.dark, transparent: true, opacity: 0, depthWrite: false });
  private rim: THREE.Mesh;
  private rimMat = new THREE.MeshBasicMaterial({ color: PRISM.foil, transparent: true, opacity: 0, depthWrite: false });

  // Scratch.
  private center = new THREE.Vector3();
  private v1 = new THREE.Vector3();
  private v2 = new THREE.Vector3();
  private v3 = new THREE.Vector3();
  private up = new THREE.Vector3(0, 1, 0);

  constructor(settings: SpectrumLanceSettings = defaultSpectrumLance()) {
    this.settings = settings;
    this.screen.impactColor.set(PRISM.hot);
    this.screen.tint.set(PRISM.dark);
    this.markers.spin = 0.6;
    this.shards.spin = 4;
    this.main.spin = 0.5;
    for (let i = 0; i < SHARDS; i++) {
      this.shardFrom.push(new THREE.Vector3());
      this.shardDelay.push(0);
    }
    for (let i = 0; i < LANCES; i++) {
      this.lanceR.push(4.8 + 1.6 * hash(i * 2.3 + 1));
      this.lanceA.push((i / LANCES) * Math.PI * 2 + (hash(i + 5) - 0.5) * 0.25);
    }
    // A dark layer on the floor and a pale ring on the zone edge, so the zone reads on the darkened floor.
    this.shade = new THREE.Mesh(new THREE.CircleGeometry(1, 56).rotateX(-Math.PI / 2), this.shadeMat);
    this.shade.renderOrder = 1;
    this.shade.visible = false;
    this.rim = new THREE.Mesh(new THREE.RingGeometry(0.975, 1, 72).rotateX(-Math.PI / 2), this.rimMat);
    this.rim.renderOrder = 2;
    this.rim.visible = false;
    this.group.add(
      this.shade, this.rim, this.markers.mesh, this.shards.mesh, this.main.mesh, this.orbit.mesh, this.beams.mesh, this.glitter.mesh,
      this.flare.mesh, this.pop.mesh, this.pop2.mesh, this.groundShock.mesh,
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
    this.center.set(this.point.x, PRISM_Y, this.point.z);
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
    this.glintT = 0;
    this.footT = 0;
    this.mainIdx = -1;
    this.markerIdx.length = 0;
    this.shardIdx.length = 0;
    for (const k of Object.keys(this.flags) as (keyof typeof this.flags)[]) this.flags[k] = false;
    clearScreenFx(this.screen);
    this.screen.tint.set(PRISM.dark);
    this.markers.reset();
    this.shards.reset();
    this.main.reset();
    this.orbit.reset();
    this.beams.reset();
    this.glitter.reset();
    this.shade.visible = false;
    this.rim.visible = false;
    this.shadeMat.opacity = 0;
    this.rimMat.opacity = 0;
    this.flare.set(this.point, 0, 0);
    this.pop.set(this.point, 0, 0);
    this.pop2.set(this.point, 0, 0);
    this.groundShock.set(this.point, 0, 0);
  }

  update(dt: number) {
    for (const e of this.emitters) e.update(dt);
    const held = this.playing && this.time >= BEAT_T && this.time < SPLIT_T;
    this.markers.frozen = this.shards.frozen = this.main.frozen = this.orbit.frozen = this.glitter.frozen = held;
    this.markers.update(dt);
    this.shards.update(dt);
    this.main.update(dt);
    this.orbit.update(dt);
    this.glitter.update(dt);
    if (!this.playing) return;
    this.time += dt;
    if (this.time >= DURATION) {
      this.finish();
      if (this.settings.loop) this.play();
      return;
    }
    const t = this.time, f = this.flags, P = this.point;

    // --- 0..0.4: the ring of small crystals marks the zone. ---
    if (!f.markers) {
      f.markers = true;
      for (let i = 0; i < MARKERS; i++) {
        const a = (i / MARKERS) * Math.PI * 2 + 0.2, len = 0.85 + 0.5 * hash(i * 1.7), w = 0.3 + 0.1 * hash(i * 4.1);
        this.markerIdx[i] = this.markers.place(this.v1.set(P.x + Math.cos(a) * RADIUS, -len, P.z + Math.sin(a) * RADIUS), this.up, len, w, { scale: 1e-3 });
      }
      this.shade.visible = this.rim.visible = true;
      this.shade.position.set(P.x, 0.03, P.z);
      this.shade.scale.setScalar(RADIUS);
      this.rim.position.set(P.x, 0.05, P.z);
      this.rim.scale.setScalar(RADIUS);
    }
    if (!f.markersGone) {
      const e = easeOut(t / MARK_END);
      for (let i = 0; i < MARKERS; i++) {
        const a = (i / MARKERS) * Math.PI * 2 + 0.2, len = 0.85 + 0.5 * hash(i * 1.7);
        this.v1.set(P.x + Math.cos(a) * RADIUS, -len * 0.5 + (len * 0.5 + 0.05) * e + len * 0.05, P.z + Math.sin(a) * RADIUS);
        this.markers.move(this.markerIdx[i], this.v1);
        this.markers.setScale(this.markerIdx[i], Math.max(e, 1e-3));
      }
    }

    // --- 0.3..1.6: the huge prism assembles from shards over the point; 8 smaller prisms orbit it. ---
    if (!f.prism && t >= BUILD_T) {
      f.prism = true;
      this.mainIdx = this.main.place(this.center, this.up, PRISM_LEN, PRISM_W, { scale: 1e-3, spin: 0.5 });
      for (let i = 0; i < SHARDS; i++) {
        const a = hash(i * 3.7) * Math.PI * 2, r = 2.4 + 1.8 * hash(i * 1.3 + 4);
        this.shardFrom[i].set(P.x + Math.cos(a) * r, PRISM_Y + 0.9 + (hash(i * 2.9) - 0.3) * 2.2, P.z + Math.sin(a) * r);
        this.shardDelay[i] = 0.35 * hash(i * 5.3);
        this.shardIdx[i] = this.shards.place(this.shardFrom[i], this.up, 0.9, 0.34, { scale: 1e-3, spin: 4 });
      }
    }
    if (f.prism && !f.split) {
      const k = (t - BUILD_T) / (BUILD_END - BUILD_T);
      // The shards swirl in and shrink into the prism, which grows from its middle.
      for (let i = 0; i < SHARDS; i++) {
        if (this.shardIdx[i] < 0) continue;
        const u = Math.min(1, Math.max(0, (t - BUILD_T - this.shardDelay[i]) / 1.0));
        if (u >= 1) { this.shards.hide(this.shardIdx[i]); this.shardIdx[i] = -1; continue; }
        const e = u * u * (3 - 2 * u), sw = (1 - e) * 1.1;
        this.v1.copy(this.shardFrom[i]).sub(this.center);
        const c = Math.cos(sw), s = Math.sin(sw);
        this.v2.set(this.v1.x * c - this.v1.z * s, this.v1.y, this.v1.x * s + this.v1.z * c);
        this.v3.copy(this.center).addScaledVector(this.v2, 1 - e);
        this.v2.copy(this.center).sub(this.v3).normalize();
        this.shards.move(this.shardIdx[i], this.v3, this.v2);
        this.shards.setScale(this.shardIdx[i], Math.max(Math.min(1, u * 6) * (1 - 0.6 * e), 1e-3));
      }
      const g = easeOut(k);
      this.main.setScale(this.mainIdx, Math.max(g, 1e-3));
      // It turns slowly, quicker as the beam arrives, and settles a little as it grows.
      const lit = smoothstep((t - BEAM_T) / (BEAT_T - BEAM_T));
      this.main.setSpin(this.mainIdx, 0.5 + 2.2 * lit);
      this.main.move(this.mainIdx, this.v1.set(P.x, PRISM_Y + Math.sin(t * 1.6) * 0.1 * (1 - lit), P.z));
      this.orbit.set(this.v1.set(P.x, PRISM_Y, P.z), 3.3, 8, 0.8 + 0.9 * lit, 1.0);
      this.orbit.scale(Math.max(easeOut((t - BUILD_T - 0.2) / 1.2), 1e-3));
      // Glitter drifts off the growing prism.
      this.glintT += dt;
      if (this.glintT >= 0.16 && t < BEAM_T + 0.5) {
        this.glintT = 0;
        const a = Math.random() * Math.PI * 2;
        this.glitter.burst(this.v1.set(P.x + Math.cos(a) * PRISM_W * 0.5, PRISM_Y + (Math.random() - 0.5) * PRISM_LEN * 0.6, P.z + Math.sin(a) * PRISM_W * 0.5), 1, 1);
      }
    }

    // --- 1.6..2.0: the beam strikes the prism from above and it glows from inside; held through the dead beat. ---
    if (f.prism && t >= BEAM_T && t < HIT_T + 0.15) {
      const k = smoothstep((t - BEAM_T) / 0.25);
      const out = 1 - smoothstep((t - HIT_T) / 0.15);
      this.v1.set(P.x, SKY_Y, P.z);
      this.v2.set(P.x, PRISM_Y + PRISM_LEN * 0.5, P.z);
      this.beams.set(this.v1, this.v2, (0.5 + 1.2 * k) * (0.7 + 0.3 * out), k * out, PRISM.hot, 1, 0);
      f.beam = true;
      const glow = smoothstep((t - BEAM_T) / (BEAT_T - BEAM_T));
      const pulse = t < BEAT_T ? 0.85 + 0.15 * Math.sin(t * 36) : 1;
      this.flare.set(this.center, 4.2 * glow * pulse * out, 0.85 * glow * out, t * 1.5);
    } else if (f.beam && t >= HIT_T + 0.15) {
      f.beam = false;
      this.beams.hide(0);
      this.flare.set(this.center, 0, 0);
    }

    // --- 2.0..2.2: the prism splits the beam into 7 lances that slam down in a ring. ---
    if (!f.split && t >= SPLIT_T) f.split = true;
    if (f.split) this.lances(t);
    if (!f.hit && t >= HIT_T) {
      f.hit = true;
      this.hit();
    }
    if (f.hit && !f.shattered && t >= SHATTER_T) {
      f.shattered = true;
      this.main.shatter(4.5, 0.9, this.center);
      this.orbit.shatter(4, 0.9);
      this.glitter.burst(this.center, 22, 6);
      this.shake = Math.max(this.shake, 0.25);
    }
    if (f.hit && !f.markersGone && t >= MARKERS_T) {
      f.markersGone = true;
      this.markers.shatter(3, 0.8, P);
      this.rim.visible = false;
    }

    this.layout(dt);
  }

  /** The 7 lances: from the prism's underside to a ring on the ground, then a sweep once round, then fading band by band. */
  private lances(t: number) {
    const P = this.point;
    const ext = easeOut((t - SPLIT_T) / (HIT_T - SPLIT_T)); // 0..1 they slam down
    const sweep = t > HIT_T ? easeInOut((t - HIT_T) / (SWEEP_END - HIT_T)) * Math.PI * 2 : 0;
    this.v1.set(P.x, PRISM_Y - PRISM_LEN * 0.5 + 0.4, P.z);
    for (let i = 0; i < LANCES; i++) {
      const a = this.lanceA[i] + sweep, r = this.lanceR[i] * (0.55 + 0.45 * ext);
      this.v2.set(P.x + Math.cos(a) * r, 0.12 + (1 - ext) * 3.2, P.z + Math.sin(a) * r);
      // Fade band by band: each lance thins and goes out a little after the one before.
      const out = 1 - smoothstep((t - (2.9 + 0.16 * i)) / 0.5);
      if (out <= 0.003) { this.beams.hide(1 + i); continue; }
      this.beams.set(this.v1, this.v2, 0.95 * (0.55 + 0.45 * out), (t < HIT_T ? 0.6 + 0.4 * ext : 1) * out, undefined, 0.45, 1 + i);
    }
  }

  private hit() {
    const ctx = this.ctx, P = this.point;
    // Glitter bursts along the lances; a spectrum accent at the centre.
    for (let i = 0; i < LANCES; i++) {
      const a = this.lanceA[i], r = this.lanceR[i];
      for (let k = 0; k < 3; k++) {
        const u = 0.35 + 0.3 * k;
        this.glitter.burst(this.v1.set(P.x + Math.cos(a) * r * u, 0.3, P.z + Math.sin(a) * r * u), 3, 3.5);
      }
    }
    this.glitter.burst(this.v1.set(P.x, 1.2, P.z), 14, 6);
    // Re-check where everyone stands now: enemies who walked out are spared.
    if (ctx) for (const e of ctx.targets) {
      if (this.inside(e)) ctx.hit(e, { damage: this.settings.damage, knock: this.settings.knock, from: P, color: PRISM_CSS.body });
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
    const t = this.time, P = this.point, ctx = this.ctx;
    const after = t - HIT_T;
    const f = this.flags;

    // --- Screen: a deep violet-black, a lift at the landing, lifting away as the prism breaks. Impact frames at the hit. ---
    let dk = 0.55 * smoothstep(t / MARK_END) * (1 - smoothstep((t - 3.4) / 0.8));
    if (after >= 0) dk *= 1 - 0.3 * Math.exp(-after * 10);
    this.screen.darken = dk;
    this.screen.impact = impactFrameAt(t, HIT_T, [1, 2], 0.04);

    // --- Glitter off the lance feet while they sweep. ---
    if (f.hit && t < SWEEP_END) {
      this.footT += dt;
      while (this.footT >= 0.09) {
        this.footT -= 0.09;
        const i = Math.floor(Math.random() * LANCES), sweep = easeInOut(after / (SWEEP_END - HIT_T)) * Math.PI * 2;
        const a = this.lanceA[i] + sweep, r = this.lanceR[i];
        this.glitter.burst(this.v1.set(P.x + Math.cos(a) * r, 0.2, P.z + Math.sin(a) * r), 2, 2.5);
      }
    }

    // --- The pull on the enemies: in while the prism builds, released at the landing. ---
    if (ctx) {
      const pull = 0.4 * smoothstep((t - BUILD_T) / (HIT_T - BUILD_T)) * (1 - smoothstep(after / 0.3));
      for (const v of this.victims) {
        this.v3.set(P.x - v.feet.x, 0, P.z - v.feet.z).multiplyScalar(pull);
        ctx.displace(v.enemy, this.v3);
      }
    }

    // --- The dark layer and the pale ring on the floor. ---
    const fade = 1 - smoothstep((t - 3.4) / 0.8);
    this.shadeMat.opacity = 0.34 * Math.min(1, t / MARK_END) * fade;
    this.rimMat.opacity = 0.65 * Math.min(1, t / MARK_END) * fade;

    // --- The landing: spectrum accent (two stars), ground refraction, shake. ---
    if (f.hit) {
      const sp = StarBurst.pop(after, 0, 0.05);
      this.pop.set(this.v1.set(P.x, 1.5, P.z), 2 * sp.scale, sp.opacity, 0.2);
      this.pop2.set(this.v1.set(P.x, 1.5, P.z), 1.35 * sp.scale, sp.opacity, 0.6);
      const gp = THREE.MathUtils.clamp(after / 0.5, 0, 1);
      this.groundShock.set(P, 1 + 11 * gp, 0.07 * (1 - gp) * (1 - gp));
      this.shake = Math.max(0.7 * Math.exp(-after * 9), f.shattered ? 0.25 * Math.exp(-(t - SHATTER_T) * 8) : 0);
    }
  }
}

const hash = (x: number) => { const s = Math.sin(x * 12.9898 + 78.233) * 43758.5453; return s - Math.floor(s); };
const easeOut = (x: number) => 1 - Math.pow(1 - Math.min(1, Math.max(0, x)), 3);
const easeInOut = (x: number) => { const k = Math.min(1, Math.max(0, x)); return k * k * (3 - 2 * k); };

export const spectrumLanceModule: EffectModule = {
  label: 'spectrum lance',
  category: 'hero: prism',
  targeting: { mode: 'ground', radius: RADIUS },
  create: () => new SpectrumLance(),
  telegraphs(effect) {
    const e = effect as SpectrumLance;
    const ctx = e.ctx;
    if (!ctx) return [];
    return [{ shape: { kind: 'circle', x: ctx.point.x, z: ctx.point.z, radius: RADIUS }, start: 0, impact: HIT_T }];
  },
  bloom: { enabled: true, strength: 0.4, radius: 0.4, threshold: 0.86 },
  frameCamera(camera, controls, effect) {
    const e = effect as SpectrumLance;
    if (e.ctx) frameCast(camera, controls, e.ctx, 10);
  },
  buildGui(f, effect) {
    const s = (effect as SpectrumLance).settings;
    f.add(s, 'loop');
    f.add(s, 'damage', 1, 300, 1);
    f.add(s, 'knock', 0, 8, 0.5);
  },
};
