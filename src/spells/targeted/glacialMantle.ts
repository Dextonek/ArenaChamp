import * as THREE from 'three';
import { Emitter } from '../../emitter';
import { smoothstep } from '../../effects/common';
import { CrescentArc, clearScreenFx, createScreenFx } from '../../effects/parts';
import { FROST, FROST_CSS, FrostFerns, RimeRing, Snow } from '../../effects/parts/frost';
import { frameCast, type CastContext } from '../../effects/targeting';
import type { Effect, EffectModule } from '../../effects/types';

/**
 * Glacial Mantle (frost kit, E: ice block, then a blizzard; no shield). On the cast she is encased in a faceted block of
 * pale blue ice (forms in 0.15 s, rime-white edges, a soft inner glow, crystal spikes and frost ferns at the base, a
 * slow shimmer) for exactly `hold` seconds (1.5): the duel trait makes her untouchable and unable to act meanwhile.
 * At `hold` the block SHATTERS (shards fly out, a frost ring races over the ground) and the blizzard circles her for the
 * rest of the spell: snow and thin pale wind arcs; twice a rime ring races out to the radius and the enemies inside get
 * ferns at their feet, a small hit and a slow. Then the blizzard and ferns fade. Loopable.
 * See pipeline/designs/kit-frost.md.
 */
export interface GlacialMantleSettings {
  damage: number;
  /** Seconds she stays encased in ice (untouchable, cannot act). */
  hold: number;
  /** Slow seconds on each pulse hit (engine cap 2.5). */
  slow: number;
  loop: boolean;
}

export const defaultGlacialMantle = (): GlacialMantleSettings => ({ damage: 12, hold: 1.5, slow: 1.0, loop: false });

// Timeline (seconds). The block lasts `hold` (settings); the blizzard times are relative to the shatter.
const FORM_END = 0.15; // the block forms
const PULSE_1 = 0.5; // after the shatter
const PULSE_2 = 1.5; // after the shatter
const BLIZZ_END = 2.2; // after the shatter: the blizzard and ferns fade
const TAIL = 2.5; // after the shatter: the spell is over
const RADIUS = 4;
const ARCS = 4;
const MAX_ENEMY_FERNS = 4;
const SPIKES = 9;
const SHARDS = 30;

// Block profile (radius, height), turned with 6 segments so it reads as a faceted crystal column about 2.7 tall.
const BLOCK_PROFILE: [number, number][] = [[0.001, 0], [0.85, 0], [0.98, 0.45], [0.82, 1.95], [0.45, 2.5], [0.001, 2.75]];

export class GlacialMantle implements Effect {
  readonly group = new THREE.Group();
  readonly settings: GlacialMantleSettings;
  readonly emitters: Emitter[] = [];
  readonly screen = createScreenFx();
  shake = 0;
  playing = false;

  /** Last cast; frameCamera and telegraphs read it. Null until the first play(). */
  ctx: CastContext | null = null;
  private time = 0;

  // Cast geometry.
  private from = new THREE.Vector3(0, 0, 14);
  private fwd = new THREE.Vector3(0, 0, -1);
  private chest = new THREE.Vector3(0, 1.25, 14);

  private flags = { ferns: false, snow: false, pulse1: false, pulse2: false, shattered: false, faded: false };
  private pulseAt = [-9, -9];
  private shatterAt = -9;

  // Parts.
  private ferns = new FrostFerns({ variant: 0, maxShards: 24 });
  private enemyFerns = Array.from({ length: MAX_ENEMY_FERNS }, (_, i) => new FrostFerns({ variant: i % 2, maxShards: 0 }));
  private snow = new Snow({ max: 56 });
  private ring = new RimeRing();
  private arcs: CrescentArc[] = [];
  private arcPivots: THREE.Group[] = [];

  // The ice block.
  private block = new THREE.Group();
  private blockGeo = new THREE.LatheGeometry(BLOCK_PROFILE.map(([x, y]) => new THREE.Vector2(x, y)), 6);
  // Deep blue faces and a faint additive glow: the block stays under the bloom threshold (no white blob).
  private faceMat = new THREE.MeshBasicMaterial({ color: 0x3f8fc4, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false });
  private glowMat = new THREE.MeshBasicMaterial({ color: 0x2a6fa8, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending });
  private sheenMat = new THREE.MeshBasicMaterial({ color: FROST.rime, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending });
  private edgeMat = new THREE.LineBasicMaterial({ color: 0xa8daf2, transparent: true, opacity: 0, depthWrite: false });
  private spikeMat = new THREE.MeshBasicMaterial({ color: 0x6fb4dc, transparent: true, opacity: 0, depthWrite: false });
  private spikes: THREE.Mesh[] = [];
  private spikeScale: number[] = [];
  private sheen: THREE.Mesh;
  private glow: THREE.Mesh;
  private shardMat = new THREE.MeshBasicMaterial({ color: 0xb8e4f8, transparent: true, opacity: 0, depthWrite: false });
  private shards: THREE.Mesh[] = [];
  private shardVel: THREE.Vector3[] = [];
  private shardSpin: THREE.Vector3[] = [];
  private shatterRing: THREE.Mesh;
  private shatterRingMat = new THREE.MeshBasicMaterial({ color: FROST.hot, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending });

  // Scratch.
  private v1 = new THREE.Vector3();

  constructor(settings: GlacialMantleSettings = defaultGlacialMantle()) {
    this.settings = settings;
    this.screen.tint.set(FROST.dark);
    this.ferns.renderOrder = 2;
    for (const f of this.enemyFerns) f.renderOrder = 3;
    this.ring.mesh.renderOrder = 4;
    for (let i = 0; i < ARCS; i++) {
      const arc = new CrescentArc({ radius: 2.9, width: 0.24, sweep: Math.PI * 0.95, style: 'toon', edge: FROST.core, mid: FROST.rime, outer: FROST.body });
      arc.mesh.rotation.x = -Math.PI / 2; // lie in the horizontal plane
      const pivot = new THREE.Group();
      pivot.add(arc.mesh);
      this.arcs.push(arc);
      this.arcPivots.push(pivot);
    }

    // Block: translucent faces, a smaller additive glow, a turning additive sheen for the shimmer, rime edges.
    const faces = new THREE.Mesh(this.blockGeo, this.faceMat);
    this.glow = new THREE.Mesh(this.blockGeo, this.glowMat);
    this.glow.scale.set(0.82, 0.9, 0.82);
    this.sheen = new THREE.Mesh(this.blockGeo, this.sheenMat);
    this.sheen.scale.set(1.02, 1.01, 1.02);
    const edges = new THREE.LineSegments(new THREE.EdgesGeometry(this.blockGeo, 1), this.edgeMat);
    faces.renderOrder = 5;
    this.glow.renderOrder = 6;
    this.sheen.renderOrder = 6;
    edges.renderOrder = 7;
    this.block.add(faces, this.glow, this.sheen, edges);
    this.block.visible = false;

    // Crystal spikes round the base, leaning out.
    const spikeGeo = new THREE.ConeGeometry(0.13, 1, 4).translate(0, 0.5, 0);
    for (let i = 0; i < SPIKES; i++) {
      const sp = new THREE.Mesh(spikeGeo, this.spikeMat);
      const a = (i / SPIKES) * Math.PI * 2 + (i % 2) * 0.2;
      const r = 0.95 + (i % 3) * 0.12;
      sp.position.set(Math.cos(a) * r, 0, Math.sin(a) * r);
      sp.rotation.set(Math.sin(a) * 0.55, 0, -Math.cos(a) * 0.55);
      sp.renderOrder = 5;
      this.spikeScale.push(0.7 + ((i * 5) % 4) * 0.22);
      this.spikes.push(sp);
      this.block.add(sp);
    }

    // Shatter shards and the ground ring.
    const shardGeo = new THREE.TetrahedronGeometry(0.2);
    for (let i = 0; i < SHARDS; i++) {
      const m = new THREE.Mesh(shardGeo, this.shardMat);
      m.visible = false;
      m.renderOrder = 6;
      this.shards.push(m);
      this.shardVel.push(new THREE.Vector3());
      this.shardSpin.push(new THREE.Vector3());
    }
    this.shatterRing = new THREE.Mesh(new THREE.RingGeometry(0.88, 1, 48).rotateX(-Math.PI / 2), this.shatterRingMat);
    this.shatterRing.renderOrder = 4;
    this.shatterRing.visible = false;

    this.group.add(
      this.ferns.mesh, ...this.enemyFerns.map((f) => f.mesh), this.ring.mesh, this.shatterRing, this.block, ...this.shards,
      ...this.arcPivots, this.snow.mesh,
    );
    this.reset();
  }

  get duration() {
    return this.settings.hold + TAIL;
  }

  /** The shatter: the caster's cast root ends with the ice block (the blizzard pulses come after, on their own). */
  get impactTime() {
    return this.settings.hold;
  }

  cast(ctx: CastContext) {
    this.ctx = ctx;
    this.from.copy(ctx.from).setY(0);
    this.fwd.set(Math.sin(ctx.aim), 0, Math.cos(ctx.aim));
    this.chest.copy(ctx.from).addScaledVector(this.fwd, 0.15).setY(1.25);
    this.screen.focus.copy(this.chest);
  }

  play() {
    this.reset();
    this.playing = true;
  }

  private reset() {
    this.time = 0;
    this.shake = 0;
    this.pulseAt[0] = this.pulseAt[1] = -9;
    this.shatterAt = -9;
    for (const k of Object.keys(this.flags) as (keyof typeof this.flags)[]) this.flags[k] = false;
    clearScreenFx(this.screen);
    this.screen.tint.set(FROST.dark);
    this.ferns.reset();
    for (const f of this.enemyFerns) f.reset();
    this.snow.reset();
    this.ring.set(this.from, 0, 0.5, 0);
    for (const a of this.arcs) a.opacity = 0;
    this.block.visible = false;
    this.faceMat.opacity = this.glowMat.opacity = this.sheenMat.opacity = this.edgeMat.opacity = this.spikeMat.opacity = 0;
    for (const s of this.shards) s.visible = false;
    this.shardMat.opacity = 0;
    this.shatterRing.visible = false;
  }

  /** The block bursts: shards fly out and up, a frost ring races over the ground. */
  private shatter() {
    this.shatterAt = this.time;
    this.block.visible = false;
    const yaw = Math.atan2(this.fwd.x, this.fwd.z);
    for (let i = 0; i < SHARDS; i++) {
      const s = this.shards[i];
      const a = yaw + (i / SHARDS) * Math.PI * 2 + (i % 3) * 0.3;
      const h = 0.2 + (((i * 7) % 11) / 11) * 2.4; // start height along the column
      const sp = 3 + ((i * 5) % 7) * 0.55;
      s.position.set(this.from.x + Math.cos(a) * 0.5, h, this.from.z + Math.sin(a) * 0.5);
      this.shardVel[i].set(Math.cos(a) * sp, 1.5 + ((i * 3) % 5) * 0.6, Math.sin(a) * sp);
      this.shardSpin[i].set(4 + (i % 4), 3 + (i % 5), 5 - (i % 3));
      s.scale.setScalar(0.6 + (((i * 13) % 9) / 9) * 1.3);
      s.visible = true;
    }
    this.shatterRing.visible = true;
    this.shatterRing.position.set(this.from.x, 0.06, this.from.z);
    this.ferns.fade(0.4); // the base ferns go with the block
  }

  update(dt: number) {
    for (const e of this.emitters) e.update(dt);
    if (!this.playing) return;
    this.ferns.update(dt);
    for (const f of this.enemyFerns) f.update(dt);
    this.snow.update(dt);
    this.time += dt;
    if (this.time >= this.duration) {
      const loop = this.settings.loop;
      this.reset();
      this.playing = false;
      if (loop) this.play();
      return;
    }
    const t = this.time;
    const hold = this.settings.hold;
    const ctx = this.ctx;
    const f = this.flags;

    // She stands still in the block, then moves again: the effect follows her.
    const c = ctx?.caster.group.position;
    if (c) this.from.set(c.x, 0, c.z);

    // Events.
    if (!f.ferns) {
      f.ferns = true;
      this.block.visible = true;
      this.ferns.grow(this.from, 2.2, FORM_END);
    }
    if (!f.shattered && t >= hold) {
      f.shattered = true;
      this.shatter();
    }
    if (!f.snow && t >= hold) {
      f.snow = true;
      this.snow.swirl(this.from, 3.5, 44, { y: 1.3, ySpread: 1.8, speed: 3.0, band: 0.43 });
    }
    for (let p = 0; p < 2; p++) {
      const at = hold + (p === 0 ? PULSE_1 : PULSE_2);
      const key = p === 0 ? 'pulse1' : 'pulse2';
      if (!f[key] && t >= at) {
        f[key] = true;
        this.pulseAt[p] = at;
        if (ctx) {
          const n = Math.min(MAX_ENEMY_FERNS, ctx.targets.length);
          for (let i = 0; i < n; i++) this.enemyFerns[i].grow(this.v1.copy(ctx.targetPos[i]).setY(0), 1.3, 0.25);
          for (const e of ctx.targets) {
            const q = e.group.position;
            if (Math.hypot(q.x - this.from.x, q.z - this.from.z) > RADIUS + 0.3) continue; // walked out
            ctx.hit(e, { damage: this.settings.damage, knock: 0, color: FROST_CSS.body, status: { kind: 'slow', seconds: this.settings.slow } });
          }
        }
      }
    }
    if (!f.faded && t >= hold + BLIZZ_END) {
      f.faded = true;
      for (const ef of this.enemyFerns) ef.fade(0.4);
      this.snow.stop();
    }

    this.layout(dt);
  }

  private layout(dt: number) {
    const t = this.time;
    const hold = this.settings.hold;
    const after = t - hold;

    // --- Screen: a gentle cold darken so the pale ice reads. ---
    this.screen.darken = 0.25 * smoothstep(t / 0.35) * (1 - smoothstep((after - (BLIZZ_END - 0.3)) / 0.4));

    // --- The ice block: forms in FORM_END, shimmers while held, strains just before it bursts. ---
    if (this.block.visible) {
      const k = smoothstep(t / FORM_END);
      const strain = 1 + 0.015 * Math.sin(t * 40) * smoothstep((t - (hold - 0.35)) / 0.35);
      this.block.position.copy(this.from);
      this.block.scale.set((0.6 + 0.4 * k) * strain, k * strain, (0.6 + 0.4 * k) * strain);
      this.faceMat.opacity = 0.42 * k;
      this.glowMat.opacity = (0.08 + 0.03 * Math.sin(t * 6)) * k;
      this.sheenMat.opacity = (0.03 + 0.04 * Math.max(0, Math.sin(t * 5 + 1))) * k;
      this.sheen.rotation.y = Math.PI / 6 + t * 0.6;
      this.edgeMat.opacity = (0.6 + 0.15 * Math.sin(t * 9)) * k;
      this.spikeMat.opacity = 0.85 * k;
      for (let i = 0; i < SPIKES; i++) this.spikes[i].scale.set(1, this.spikeScale[i] * k, 1);
    }

    // --- Shards and the ground ring after the burst. ---
    if (this.shatterAt >= 0) {
      const s = t - this.shatterAt;
      this.shardMat.opacity = 0.85 * (1 - smoothstep((s - 0.5) / 0.5));
      for (let i = 0; i < SHARDS; i++) {
        const m = this.shards[i];
        if (!m.visible) continue;
        this.shardVel[i].y -= 9 * dt;
        m.position.addScaledVector(this.shardVel[i], dt);
        if (m.position.y < 0.05) { m.position.y = 0.05; this.shardVel[i].set(0, 0, 0); }
        m.rotation.x += this.shardSpin[i].x * dt;
        m.rotation.y += this.shardSpin[i].y * dt;
        m.rotation.z += this.shardSpin[i].z * dt;
        if (s > 1) m.visible = false;
      }
      const rk = Math.min(1, s / 0.45);
      this.shatterRing.scale.setScalar(Math.max(0.1, 3.4 * (1 - Math.pow(1 - rk, 3))));
      this.shatterRingMat.opacity = 0.8 * (1 - rk);
      if (rk >= 1) this.shatterRing.visible = false;
    }

    // --- The rime ring races out to the radius at each pulse. ---
    let ringR = 0, ringOp = 0;
    for (const at of this.pulseAt) {
      const k = (t - at) / 0.4;
      if (k >= 0 && k < 1) {
        ringR = RADIUS * (1 - Math.pow(1 - k, 3));
        ringOp = 1 - k * k;
      }
    }
    this.ring.set(this.from, ringR, 0.55, ringOp);

    // --- Wind arcs: thin pale bands circling her at different heights, from the shatter on. ---
    const wind = smoothstep(after / 0.25) * (1 - smoothstep((after - (BLIZZ_END - 0.2)) / 0.3));
    for (let i = 0; i < ARCS; i++) {
      const arc = this.arcs[i], pv = this.arcPivots[i];
      pv.position.set(this.from.x, [0.55, 1.05, 1.5, 0.85][i], this.from.z);
      pv.rotation.y = t * (2.6 + 0.3 * i) + (i * Math.PI) / 2;
      arc.head = 1;
      arc.length = 0.9;
      arc.erosion = 0.1;
      arc.time = t;
      arc.opacity = 0.9 * wind;
    }

    // --- A shake at the shatter and a small one on each pulse. ---
    let sh = after >= 0 ? 0.35 * Math.exp(-after * 9) : 0;
    for (const at of this.pulseAt) if (t >= at) sh = Math.max(sh, 0.12 * Math.exp(-(t - at) * 10));
    this.shake = sh;
  }
}

export const glacialMantleModule: EffectModule = {
  label: 'glacial mantle',
  category: 'hero: frost',
  targeting: { mode: 'self', radius: RADIUS },
  create: () => new GlacialMantle(),
  telegraphs(effect) {
    const e = effect as GlacialMantle;
    const ctx = e.ctx;
    if (!ctx) return [];
    return [{ shape: { kind: 'circle', x: ctx.from.x, z: ctx.from.z, radius: RADIUS }, start: e.settings.hold, impact: e.impactTime }];
  },
  bloom: { enabled: true, strength: 0.45, radius: 0.4, threshold: 0.86 },
  frameCamera(camera, controls, effect) {
    const e = effect as GlacialMantle;
    if (e.ctx) frameCast(camera, controls, e.ctx, 2);
  },
  buildGui(f, effect) {
    const s = (effect as GlacialMantle).settings;
    f.add(s, 'loop');
    f.add(s, 'damage', 1, 60, 1);
    f.add(s, 'hold', 0.5, 3, 0.1);
    f.add(s, 'slow', 0, 2.5, 0.1);
  },
};
