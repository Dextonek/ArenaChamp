import * as THREE from 'three';
import { Emitter } from '../../emitter';
import { BaaWords, Crook, Dust, SHEEP, SheepHerd, Tufts } from '../../effects/parts/sheep';
import { frameCast, type CastContext } from '../../effects/targeting';
import type { Effect, EffectModule } from '../../effects/types';
import { SPARE_COUNT, SPARE_LAND, SPARE_RANGE, SPARE_SECONDS, spawnSheep } from '../../traits/sheep';

/**
 * Spare Sheep (sheep kit, W: three sheep from the flock). Bo points his crook and bellows; three sheep are flung out of his coat
 * in high arcs (drawn, `SheepHerd`, with a pale ring on the ground at the spot so the other player sees where they come down) and
 * land 0.5 s later at the aimed spot (8 m): a ring of dust and wool tufts, a little *baa* over each, and three real sheep
 * (`spawnSheep`: 30 HP, 6 s, they walk to whoever is NEAREST, Bo or the enemy, and bump whoever is in reach). The cap is 6 units a
 * side: with four alive only two come down, with six none (the drawn sheep still land, a puff and no baa). The trait refuses the
 * cast at a full flock, so a player or the CPU never wastes it. Network duels have no `ctx.summon`: the effect only draws. No
 * damage, so no telegraph. Clean by about 1.3 s. See pipeline/designs/kit-sheep.md.
 */
export interface SpareSheepSettings {
  /** Seconds the sheep live. */
  seconds: number;
  loop: boolean;
}

export const defaultSpareSheep = (): SpareSheepSettings => ({ seconds: SPARE_SECONDS, loop: false });

const DURATION = 1.4;
const ARC = 2.4;
const RING_R = 1.0;

export class SpareSheep implements Effect {
  readonly group = new THREE.Group();
  readonly settings: SpareSheepSettings;
  readonly emitters: Emitter[] = [];
  shake = 0;
  playing = false;

  ctx: CastContext | null = null;
  private time = 0;
  private landed = false;
  private yaw = 0;
  private from = new THREE.Vector3();
  private spot = new THREE.Vector3();

  private crook = new Crook();
  private herd = new SheepHerd(SPARE_COUNT);
  private tufts = new Tufts(30);
  private dust = new Dust(14);
  private words = new BaaWords(SPARE_COUNT);
  private marker = new THREE.Mesh(
    new THREE.RingGeometry(0.88, 1, 40).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ color: SHEEP.hay, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide }),
  );

  private v1 = new THREE.Vector3();

  constructor(settings: SpareSheepSettings = defaultSpareSheep()) {
    this.settings = settings;
    this.marker.renderOrder = 3;
    this.marker.frustumCulled = false;
    this.group.add(this.marker, this.herd.mesh, this.tufts.mesh, this.dust.mesh, this.crook.mesh, this.words.mesh);
    this.reset();
  }

  get duration() {
    return DURATION;
  }

  get impactTime() {
    return SPARE_LAND;
  }

  cast(ctx: CastContext) {
    this.ctx = ctx;
    const s = ctx.sentFrom ?? ctx.from;
    this.from.set(s.x, 0, s.z);
    // The spot is at most 8 m away, as the duel clamps a cast to its range.
    const dx = ctx.point.x - s.x, dz = ctx.point.z - s.z, d = Math.hypot(dx, dz) || 1, k = Math.min(1, SPARE_RANGE / d);
    this.spot.set(s.x + dx * k, 0, s.z + dz * k);
    this.yaw = Math.atan2(dx, dz);
  }

  play() {
    this.reset();
    this.playing = true;
  }

  private reset() {
    this.time = 0;
    this.shake = 0;
    this.landed = false;
    this.tufts.reset();
    this.dust.reset();
    this.words.reset();
    this.crook.hide();
    this.marker.visible = false;
    for (let i = 0; i < SPARE_COUNT; i++) this.herd.hide(i);
    this.herd.update();
  }

  /** Where drawn sheep `i` comes down: a ring round the spot, as the summon spreads them. */
  private slot(i: number, out: THREE.Vector3) {
    const a = (i / SPARE_COUNT) * Math.PI * 2 + Math.PI / 2;
    return out.set(this.spot.x + Math.cos(a) * RING_R, 0, this.spot.z + Math.sin(a) * RING_R);
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

    // --- The crook points at the spot and shakes; a ring on the ground shows where they come down. ---
    const fwd = this.v1.set(Math.sin(this.yaw), 0, Math.cos(this.yaw));
    if (t < 0.9) {
      this.crook.place(new THREE.Vector3(this.from.x + fwd.x * 0.4 + fwd.z * 0.45, 1.25, this.from.z + fwd.z * 0.4 - fwd.x * 0.45), this.yaw, 0.9 + Math.sin(t * 46) * 0.12, Math.sin(t * 38) * 0.12);
    } else this.crook.hide();
    if (!this.landed) {
      this.marker.visible = true;
      this.marker.position.set(this.spot.x, 0.07, this.spot.z);
      this.marker.scale.setScalar(RING_R + 0.5 - 0.3 * (t / SPARE_LAND));
      (this.marker.material as THREE.MeshBasicMaterial).opacity = 0.35 + 0.35 * (t / SPARE_LAND);
    } else {
      const a = t - SPARE_LAND;
      this.marker.scale.setScalar(RING_R + 0.2 + a * 2);
      (this.marker.material as THREE.MeshBasicMaterial).opacity = Math.max(0, 0.6 * (1 - a / 0.4));
    }

    // --- Three sheep fly out of his coat in high arcs. ---
    if (!this.landed) {
      for (let i = 0; i < SPARE_COUNT; i++) {
        const k = THREE.MathUtils.clamp((t - i * 0.04) / (SPARE_LAND - 0.1), 0, 1);
        if (t - i * 0.04 < 0) { this.herd.hide(i); continue; }
        const to = this.slot(i, new THREE.Vector3());
        const x = this.from.x + (to.x - this.from.x) * k, z = this.from.z + (to.z - this.from.z) * k;
        this.herd.set(i, x, z, this.yaw + k * 6.3, 0.8 + 4 * ARC * k * (1 - k), Math.sin(k * 12) * 0.4, 0.9);
      }
      this.herd.update();
    }

    // --- They land: dust and wool, a baa each, and the real sheep. ---
    if (!this.landed && t >= SPARE_LAND) {
      this.landed = true;
      this.shake = 0.16;
      for (let i = 0; i < SPARE_COUNT; i++) this.herd.hide(i);
      this.herd.update();
      this.dust.ring(this.spot, RING_R, 8, 0.8, SHEEP.dust);
      this.tufts.burst(this.v1.set(this.spot.x, 0.4, this.spot.z), 14, 4.5, 1.0);
      const made = ctx ? spawnSheep(ctx, this.spot, SPARE_COUNT, this.settings.seconds) : [];
      if (made.length > 0) for (const u of made) this.words.say(u.pos, 0.95);
      else if (!ctx?.summon) for (let i = 0; i < SPARE_COUNT; i++) this.words.say(this.slot(i, new THREE.Vector3()), 0.95);
    }
    this.shake *= Math.exp(-dt * 12);
  }
}

export const spareSheepModule: EffectModule = {
  label: 'spare sheep',
  category: 'hero: sheep',
  // A spot (8 m); the summon spreads three sheep round it. The CPU casts a summon at a spot in front of itself.
  targeting: { mode: 'ground', radius: RING_R },
  create: () => new SpareSheep(),
  // No damage, so nothing to warn about: the ring the effect draws shows where they land.
  telegraphs: () => [],
  bloom: { enabled: true, strength: 0.3, radius: 0.35, threshold: 0.86 },
  frameCamera(camera, controls, effect) {
    const e = effect as SpareSheep;
    if (e.ctx) frameCast(camera, controls, e.ctx, 3);
  },
  buildGui(f, effect) {
    const s = (effect as SpareSheep).settings;
    f.add(s, 'loop');
    f.add(s, 'seconds', 2, 10, 0.5);
  },
};
