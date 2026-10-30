import * as THREE from 'three';
import { Emitter } from '../../emitter';
import { ShockRefraction } from '../../effects/parts';
import { CLOCKWORK, CLOCKWORK_CSS, Gear, Sparks, SteamPuffs } from '../../effects/parts/clockwork';
import { frameCast, type CastContext } from '../../effects/targeting';
import type { Effect, EffectModule } from '../../effects/types';

/**
 * Gear Field (clockwork kit, E: lingering field at the aim). Three big flat gears unfold at the aim point at ankle
 * height, nested one inside the next (radii 1.5, 2.5, 3.5), turning against each other with cyan sparks jumping across
 * the gaps. At 0.8, 1.8 and 2.8 s the gears lurch a notch and an electric ring races out to the radius: every enemy
 * inside takes a small hit and is slowed. At 3.4 the gears fold away with steam. Clean by 4.0 s. See
 * pipeline/designs/kit-clockwork.md.
 */
export interface GearFieldSettings {
  damage: number;
  slowSeconds: number;
  loop: boolean;
}

export const defaultGearField = (): GearFieldSettings => ({ damage: 9, slowSeconds: 1.0, loop: false });

// Timeline (seconds).
const UNFOLD_END = 0.3;
const PULSES = [0.8, 1.8, 2.8];
const PULSE_1 = PULSES[0];
const FOLD_T = 3.4;
const DURATION = 4.0;
const RADIUS = 3.6;
const MAX_VIS = 3; // enemies that get their own spark burst

/** The three gears: outer radius, ring-hole fraction (0 = solid with spokes), spin speed (rad/s), height. */
const RINGS = [
  { r: 1.5, hole: 0, rate: 1.3, y: 0.11 },
  { r: 2.5, hole: 0.62, rate: -0.8, y: 0.09 },
  { r: 3.5, hole: 0.78, rate: 0.55, y: 0.07 },
];

export class GearField implements Effect {
  readonly group = new THREE.Group();
  readonly settings: GearFieldSettings;
  readonly emitters: Emitter[] = [];
  shake = 0;
  playing = false;

  /** Last cast; frameCamera and telegraphs read it. Null until the first play(). */
  ctx: CastContext | null = null;
  private time = 0;
  private from = new THREE.Vector3(0, 0, 14);
  private flags = { gears: false, pulse: [false, false, false], folded: false };
  private pulseAt = [-9, -9, -9];
  private sparkT = 0;
  private steamT = 0;
  private idx: number[] = [];

  private gears = new Gear(4);
  private sparks = new Sparks(120);
  private steam = new SteamPuffs(32);
  private groundShock = new ShockRefraction({ facing: 'ground' });
  private shade: THREE.Mesh;
  private shadeMat = new THREE.MeshBasicMaterial({ color: CLOCKWORK.dark, transparent: true, opacity: 0, depthWrite: false });

  private v1 = new THREE.Vector3();
  private v2 = new THREE.Vector3();
  private up = new THREE.Vector3(0, 1, 0);

  constructor(settings: GearFieldSettings = defaultGearField()) {
    this.settings = settings;
    // A dark layer under the copper so the gears read on the floor.
    this.shade = new THREE.Mesh(new THREE.CircleGeometry(1, 40).rotateX(-Math.PI / 2), this.shadeMat);
    this.shade.renderOrder = 1;
    this.shade.visible = false;
    this.group.add(this.shade, this.gears.mesh, this.sparks.mesh, this.steam.mesh, this.groundShock.mesh);
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
    // Placed at the aim point (ground mode), not round her.
    this.from.copy(ctx.point).setY(0);
    this.groundShock.set(this.from, 0, 0);
  }

  play() {
    this.reset();
    this.playing = true;
  }

  private reset() {
    this.time = 0;
    this.shake = 0;
    this.sparkT = 0;
    this.steamT = 0;
    this.pulseAt.fill(-9);
    this.flags.gears = this.flags.folded = false;
    this.flags.pulse.fill(false);
    this.idx.length = 0;
    this.gears.reset();
    this.sparks.reset();
    this.steam.reset();
    this.shade.visible = false;
    this.shadeMat.opacity = 0;
    this.groundShock.set(this.from, 0, 0);
  }

  private pulse(index: number) {
    const ctx = this.ctx;
    this.pulseAt[index] = PULSES[index];
    this.shake = 0.15;
    // The gears lurch a notch, each in its own direction.
    this.idx.forEach((gi, k) => this.gears.kick(gi, Math.sign(RINGS[k].rate) * 0.5));
    for (let i = 0; i < 3; i++) {
      const a = Math.random() * Math.PI * 2;
      this.steam.puff(this.v1.set(this.from.x + Math.cos(a) * 3.3, 0.2, this.from.z + Math.sin(a) * 3.3), this.up, 2);
    }
    if (!ctx) return;
    // Re-check where everyone stands now: enemies who walked out are spared.
    let shown = 0;
    for (const e of ctx.targets) {
      const p = e.group.position;
      if (Math.hypot(p.x - this.from.x, p.z - this.from.z) > RADIUS) continue;
      if (shown < MAX_VIS) {
        shown++;
        this.sparks.burst(this.v1.set(p.x, 0.9, p.z), 5);
      }
      ctx.hit(e, { damage: this.settings.damage, knock: 0, from: this.from, color: CLOCKWORK_CSS.body, status: { kind: 'slow', seconds: this.settings.slowSeconds } });
    }
  }

  update(dt: number) {
    for (const e of this.emitters) e.update(dt);
    this.gears.update(dt);
    this.sparks.update(dt);
    this.steam.update(dt);
    if (!this.playing) return;
    this.time += dt;
    if (this.time >= DURATION) {
      const loop = this.settings.loop;
      this.playing = false;
      this.reset();
      if (loop) this.play();
      return;
    }
    const t = this.time, f = this.flags;

    if (!f.gears) {
      f.gears = true;
      RINGS.forEach((g, k) => {
        this.idx[k] = this.gears.place(this.v1.set(this.from.x, g.y, this.from.z), this.up, g.r, g.rate, { hole: g.hole, spokes: 6, thick: 0.13 });
      });
      this.gears.assemble(UNFOLD_END);
      this.shade.visible = true;
      this.shade.position.set(this.from.x, 0.03, this.from.z);
      this.shade.scale.setScalar(RADIUS + 0.3);
    }
    for (let i = 0; i < PULSES.length; i++) {
      if (!f.pulse[i] && t >= PULSES[i]) { f.pulse[i] = true; this.pulse(i); }
    }
    if (!f.folded && t >= FOLD_T) {
      f.folded = true;
      this.gears.fold(0.4);
    }

    // Sparks jump across the gaps between the nested gears while they turn.
    if (t > UNFOLD_END * 0.7 && t < FOLD_T + 0.2) {
      this.sparkT += dt;
      if (this.sparkT >= 0.11) {
        this.sparkT = 0;
        const k = Math.random() < 0.5 ? 0 : 1, a = Math.random() * Math.PI * 2;
        const r0 = RINGS[k].r + 0.02, r1 = RINGS[k + 1].r * RINGS[k + 1].hole - 0.02, a1 = a + (Math.random() - 0.5) * 0.12;
        this.v1.set(this.from.x + Math.cos(a) * r0, 0.22, this.from.z + Math.sin(a) * r0);
        this.v2.set(this.from.x + Math.cos(a1) * r1, 0.22, this.from.z + Math.sin(a1) * r1);
        this.sparks.arc(this.v1, this.v2, 0.12);
      }
    }
    // Steam as they fold away.
    if (t >= FOLD_T && t < FOLD_T + 0.35) {
      this.steamT += dt;
      if (this.steamT >= 0.07) {
        this.steamT = 0;
        const a = Math.random() * Math.PI * 2, r = 1.5 + Math.random() * 2;
        this.steam.puff(this.v1.set(this.from.x + Math.cos(a) * r, 0.2, this.from.z + Math.sin(a) * r), this.up, 2);
      }
    }

    // The electric ring racing out from each pulse.
    let gr = 0, gs = 0, sh = 0;
    for (const at of this.pulseAt) {
      const s = t - at;
      if (s < 0 || s > 0.5) continue;
      const k = Math.min(s / 0.4, 1), r = 0.8 + (RADIUS - 0.8) * (1 - Math.pow(1 - k, 3));
      if (s < 0.4) {
        gr = r;
        gs = 0.02 * (1 - k) * (1 - k);
        this.sparks.ring(this.from, r, 12, 0.24);
      }
      sh = Math.max(sh, 0.15 * Math.exp(-s * 10));
    }
    this.groundShock.set(this.from, Math.max(gr, 0.1), gs);
    this.shake = sh;

    // The dark layer fades in with the gears and out with the fold.
    this.shadeMat.opacity = 0.4 * Math.min(1, t / UNFOLD_END) * (1 - Math.min(1, Math.max(0, (t - FOLD_T) / 0.4)));
  }
}

export const gearFieldModule: EffectModule = {
  label: 'gear field',
  category: 'hero: clockwork',
  targeting: { mode: 'ground', radius: RADIUS },
  create: () => new GearField(),
  telegraphs(effect) {
    const e = effect as GearField;
    const ctx = e.ctx;
    if (!ctx) return [];
    // A lingering field: armed at its first lurch, drawn until the last one has gone off.
    return [{ shape: { kind: 'circle', x: ctx.point.x, z: ctx.point.z, radius: RADIUS }, start: 0, impact: PULSE_1, until: PULSES[2] + 0.1 }];
  },
  bloom: { enabled: true, strength: 0.35, radius: 0.35, threshold: 0.86 },
  frameCamera(camera, controls, effect) {
    const e = effect as GearField;
    if (e.ctx) frameCast(camera, controls, e.ctx, 3);
  },
  buildGui(f, effect) {
    const s = (effect as GearField).settings;
    f.add(s, 'loop');
    f.add(s, 'damage', 1, 60, 1);
    f.add(s, 'slowSeconds', 0, 2.5, 0.1);
  },
};
