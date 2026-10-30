import * as THREE from 'three';
import { Emitter } from '../../emitter';
import { smoothstep } from '../../effects/common';
import { ShockRefraction } from '../../effects/parts';
import { BONE_CSS, BoneDust, BoneShards, RibCage, SoulWisps } from '../../effects/parts/bone';
import { frameCast, type CastContext } from '../../effects/targeting';
import type { Effect, EffectModule } from '../../effects/types';

/**
 * Ossuary Ward (bone kit, E: cage). A cage of curved ribs grows up out of the floor round the chosen enemy (enemy
 * mode, radius 1.0), soulfire flickering in its joints. At 0.8 s the ribs close and flex and fire a ring of bone shards
 * to radius 2 that hurts and roots whoever is still inside (an enemy that walked away from the spot is missed); at 1.9 s
 * they flex again and hurt it once more. At 2.2 s the cage crumbles into dust. Clean by 2.8 s. See
 * pipeline/designs/kit-bone.md.
 */
export interface OssuaryWardSettings {
  damage: number;
  /** Root seconds on the first flex (engine cap 1.5). */
  root: number;
  loop: boolean;
}

export const defaultOssuaryWard = (): OssuaryWardSettings => ({ damage: 12, root: 1.2, loop: false });

// Timeline (seconds).
const GROW_END = 0.3; // the cage is up
const PULSE_1 = 0.8;
const PULSE_2 = 1.9;
const CRUMBLE_T = 2.2;
const GONE_T = 2.6;
const DURATION = 2.8;

const RADIUS = 2;
const CAGE_R = 1.0;
const CAGE_H = 2.4;

export class OssuaryWard implements Effect {
  readonly group = new THREE.Group();
  readonly settings: OssuaryWardSettings;
  readonly emitters: Emitter[] = [];
  shake = 0;
  playing = false;

  /** Last cast; frameCamera and telegraphs read it. Null until the first play(). */
  ctx: CastContext | null = null;
  private time = 0;
  private from = new THREE.Vector3(0, 0, 14);
  private flags = { wisps: false, pulse1: false, pulse2: false, crumbled: false };
  private pulseAt = [-9, -9];

  // Parts.
  private cage = new RibCage();
  private shards = new BoneShards(56);
  private wisps = new SoulWisps();
  private dust = new BoneDust();
  private groundShock = new ShockRefraction({ facing: 'ground' });

  // Scratch.
  private v1 = new THREE.Vector3();

  constructor(settings: OssuaryWardSettings = defaultOssuaryWard()) {
    this.settings = settings;
    this.group.add(this.cage.mesh, this.dust.mesh, this.shards.mesh, this.wisps.mesh, this.groundShock.mesh);
    this.reset();
  }

  get duration() {
    return DURATION;
  }

  get impactTime() {
    return PULSE_1;
  }

  cast(ctx: CastContext) {
    this.ctx = ctx;
    // The cage is built where the chosen enemy stands at the cast.
    this.from.copy(ctx.targetPos[0] ?? ctx.point).setY(0);
    this.groundShock.set(this.from, 0, 0);
  }

  play() {
    this.reset();
    this.playing = true;
  }

  private reset() {
    this.time = 0;
    this.shake = 0;
    this.pulseAt[0] = this.pulseAt[1] = -9;
    this.flags.wisps = this.flags.pulse1 = this.flags.pulse2 = this.flags.crumbled = false;
    this.cage.reset();
    this.shards.reset();
    this.wisps.reset();
    this.dust.reset();
    this.groundShock.set(this.from, 0, 0);
  }

  private pulse(index: number) {
    const ctx = this.ctx;
    this.pulseAt[index] = index === 0 ? PULSE_1 : PULSE_2;
    this.shake = 0.15;
    this.shards.ring(this.from, 10, RADIUS, 0.45, 1.0, 0.4);
    this.dust.ring(this.from, RADIUS, 6, 0.5);
    if (!ctx) return;
    // Re-check where everyone stands now: enemies who walked out of the ring are spared.
    for (const e of ctx.targets) {
      const p = e.group.position;
      if (Math.hypot(p.x - this.from.x, p.z - this.from.z) > RADIUS) continue;
      ctx.hit(e, {
        damage: this.settings.damage, knock: 0, from: this.from, color: BONE_CSS.body,
        status: index === 0 ? { kind: 'root', seconds: this.settings.root } : undefined,
      });
    }
  }

  update(dt: number) {
    for (const e of this.emitters) e.update(dt);
    if (!this.playing) return;
    this.shards.update(dt);
    this.wisps.update(dt);
    this.dust.update(dt);
    this.time += dt;
    if (this.time >= DURATION) {
      const loop = this.settings.loop;
      this.reset();
      this.playing = false;
      if (loop) this.play();
      return;
    }
    const t = this.time;
    const f = this.flags;

    if (!f.wisps && t >= GROW_END) {
      f.wisps = true;
      // Soulfire lights in the joints of the cage.
      const spots: [number, number][] = [[0, 0.5], [2, 0.72], [3, 0.38], [5, 0.8], [6, 0.55], [7, 0.3]];
      for (const [rib, s] of spots) {
        this.cage.pointAt(rib, s, 0, this.v1);
        this.wisps.attach(this.v1, 2, 0.15, 0.2);
      }
    }
    if (!f.pulse1 && t >= PULSE_1) { f.pulse1 = true; this.pulse(0); }
    if (!f.pulse2 && t >= PULSE_2) { f.pulse2 = true; this.pulse(1); }
    if (!f.crumbled && t >= CRUMBLE_T) {
      f.crumbled = true;
      this.wisps.release();
      this.dust.burst(this.v1.set(this.from.x, 0, this.from.z), 8, 2.2, 0.45);
      this.shards.ring(this.from, 6, CAGE_R + 0.6, 0.5, 1.2, 0.34);
    }

    this.layout();
  }

  private layout() {
    const t = this.time;

    // Flex: out in ~0.12 s on each pulse, back over ~0.3 s; the shard ring and a ground ripple go with it.
    let flex = 0, gr = 0, gs = 0, sh = 0;
    for (const at of this.pulseAt) {
      const s = t - at;
      if (s < 0 || s > 0.6) continue;
      const out = 1 - Math.pow(1 - Math.min(s / 0.12, 1), 3);
      const back = s < 0.15 ? 0 : smoothstep((s - 0.15) / 0.35);
      flex = Math.max(flex, out * (1 - back));
      if (s < 0.4) {
        const k = s / 0.4;
        gr = RADIUS * (1 - Math.pow(1 - k, 3));
        gs = 0.02 * (1 - k) * (1 - k);
      }
      sh = Math.max(sh, 0.15 * Math.exp(-s * 10));
    }
    this.groundShock.set(this.from, Math.max(gr, 0.1), gs);
    this.shake = sh;

    const grow = THREE.MathUtils.clamp(t / GROW_END, 0, 1);
    const crumble = THREE.MathUtils.clamp((t - CRUMBLE_T) / (GONE_T - CRUMBLE_T), 0, 1);
    if (t < GONE_T + 0.05) this.cage.set(this.from, CAGE_R, CAGE_H, grow, flex, crumble, t * 0.25);
    else this.cage.hide();
  }
}

export const ossuaryWardModule: EffectModule = {
  label: 'ossuary ward',
  category: 'hero: bone',
  // Built round the enemy: the cage stands where it was at the cast.
  targeting: { mode: 'enemy' },
  create: () => new OssuaryWard(),
  telegraphs(effect) {
    const e = effect as OssuaryWard;
    const ctx = e.ctx;
    if (!ctx) return [];
    const c = ctx.targetPos[0] ?? ctx.point;
    // Ends at the first pulse (no `until`).
    return [{ shape: { kind: 'circle', x: c.x, z: c.z, radius: RADIUS }, start: 0, impact: PULSE_1 }];
  },
  bloom: { enabled: true, strength: 0.35, radius: 0.4, threshold: 0.86 },
  frameCamera(camera, controls, effect) {
    const e = effect as OssuaryWard;
    if (e.ctx) frameCast(camera, controls, e.ctx, 3);
  },
  buildGui(f, effect) {
    const s = (effect as OssuaryWard).settings;
    f.add(s, 'loop');
    f.add(s, 'damage', 1, 60, 1);
    f.add(s, 'root', 0, 1.5, 0.1);
  },
};
