import * as THREE from 'three';
import { Emitter } from '../../emitter';
import { smoothstep } from '../../effects/common';
import { ShockRefraction, StarBurst, clearScreenFx, createScreenFx } from '../../effects/parts';
import { Crystal, Glitter, PRISM, PRISM_CSS, PrismRing, SpectrumBeam } from '../../effects/parts/prism';
import { frameCast, type CastContext } from '../../effects/targeting';
import type { Effect, EffectModule } from '../../effects/types';

/**
 * Spectrum Lance (prism kit, R: QUICK CHANNEL, no aim). A faceted prism assembles in front of Opaline (0..0.3 s) with a
 * small ring of prisms orbiting it. From 0.3 s she holds a spectral beam for 2 s, rooted, and it sweeps 70 degrees
 * across the direction she faces (her yaw at cast, not the click), 12 m long: the beam end glitters along the floor. It
 * ticks three times (0.63, 1.3, 1.97 s): every enemy whose live position lies on the beam at that moment is hit and
 * flashes a spectrum accent, so one walks out of the sweep's path. At 2.3 s the beam ends, the prism shatters into
 * glitter. Clean by 3.2 s. The telegraph is the whole sweep cone, its impact at the channel's end.
 * See pipeline/designs/kit-prism.md.
 */
export interface SpectrumLanceSettings {
  damage: number;
  knock: number;
  loop: boolean;
}

export const defaultSpectrumLance = (): SpectrumLanceSettings => ({ damage: 50, knock: 1.5, loop: false });

// Timeline (seconds).
const BUILD_END = 0.3; // the prism stands
const BEAM_T = 0.3; // the channel starts
const CHANNEL = 2.0;
const BEAM_END = BEAM_T + CHANNEL; // 2.3: the channel ends (the telegraph's impact)
const TICKS = [BEAM_T + CHANNEL / 6, BEAM_T + CHANNEL / 2, BEAM_T + (CHANNEL * 5) / 6]; // 0.63, 1.3, 1.97
const SHATTER_T = 2.4;
const DURATION = 3.2;

const RANGE = 12;
const SWEEP_DEG = 70;
const BEAM_HALF_W = 1.2; // an enemy this close to the beam's line is hit at a tick
const RADIUS = 12; // self mode: the AI casts it when the enemy is inside RADIUS - 0.6
const PRISM_Y = 2.1;
const PRISM_LEN = 1.9;
const PRISM_W = 1.05;
const PRISM_AHEAD = 1.2;

export class SpectrumLance implements Effect {
  readonly group = new THREE.Group();
  readonly settings: SpectrumLanceSettings;
  readonly emitters: Emitter[] = [];
  readonly screen = createScreenFx();
  shake = 0;
  playing = false;

  /** Last cast; frameCamera and telegraphs read it. Null until the first play(). */
  ctx: CastContext | null = null;
  /** The sweep cone (the whole channel), set at cast from the caster's facing. */
  readonly yaw = { value: 0 };
  private time = 0;

  // Cast geometry.
  private from = new THREE.Vector3(0, 0, 14);
  private center = new THREE.Vector3(0, PRISM_Y, 13);

  private flags = { prism: false, tick: [false, false, false], shattered: false, beamOff: false };
  private mainIdx = -1;
  private tickAge = [9, 9, 9];
  private tickPts: THREE.Vector3[] = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()];
  private glintT = 0;

  // Parts.
  private main = new Crystal(2);
  private orbit = new PrismRing(8);
  private beams = new SpectrumBeam(2);
  private endGlow = new StarBurst({ points: 8, inner: 0.35, color: PRISM.gold, core: 0xffffff, additive: true });
  private glitter = new Glitter(160);
  private flare = new StarBurst({ points: 4, inner: 0.16, color: PRISM.body, core: 0xffffff, additive: true });
  private pops = [0, 1, 2].map(() => new StarBurst({ points: 12, inner: 0.3, color: PRISM.gold, core: 0xffffff, additive: false }));
  private groundShock = new ShockRefraction({ facing: 'ground' });

  // Scratch.
  private v1 = new THREE.Vector3();
  private v2 = new THREE.Vector3();
  private up = new THREE.Vector3(0, 1, 0);

  constructor(settings: SpectrumLanceSettings = defaultSpectrumLance()) {
    this.settings = settings;
    this.screen.impactColor.set(PRISM.hot);
    this.screen.tint.set(PRISM.dark);
    this.main.spin = 0.5;
    this.group.add(
      this.main.mesh, this.orbit.mesh, this.beams.mesh, this.endGlow.mesh, this.glitter.mesh, this.flare.mesh, ...this.pops.map((p) => p.mesh),
      this.groundShock.mesh,
    );
    this.reset();
  }

  get duration() {
    return DURATION;
  }

  /** A channel's impact is its end. */
  get impactTime() {
    return BEAM_END;
  }

  /** The beam's direction (unit vector on the ground) at time t. */
  private beamDir(t: number, out: THREE.Vector3) {
    const u = THREE.MathUtils.clamp((t - BEAM_T) / CHANNEL, 0, 1);
    const a = this.yaw.value + THREE.MathUtils.degToRad(-SWEEP_DEG / 2 + SWEEP_DEG * u);
    return out.set(Math.sin(a), 0, Math.cos(a));
  }

  cast(ctx: CastContext) {
    this.ctx = ctx;
    // QUICK: no aim. The sweep is centred on where she faces right now.
    this.yaw.value = ctx.caster.group.rotation.y;
    this.from.copy(ctx.from).setY(0);
    this.center.set(this.from.x + Math.sin(this.yaw.value) * PRISM_AHEAD, PRISM_Y, this.from.z + Math.cos(this.yaw.value) * PRISM_AHEAD);
    this.screen.silhouettes = [ctx.caster.group, ...ctx.targets.map((e) => e.group)];
    this.screen.focus.set(this.from.x + Math.sin(this.yaw.value) * 5, 1.5, this.from.z + Math.cos(this.yaw.value) * 5);
    this.groundShock.set(this.from, 0, 0);
  }

  play() {
    this.reset();
    this.playing = true;
  }

  private reset() {
    this.time = 0;
    this.shake = 0;
    this.glintT = 0;
    this.mainIdx = -1;
    this.tickAge = [9, 9, 9];
    this.flags.prism = this.flags.shattered = this.flags.beamOff = false;
    this.flags.tick = [false, false, false];
    clearScreenFx(this.screen);
    this.screen.tint.set(PRISM.dark);
    this.main.reset();
    this.orbit.reset();
    this.beams.reset();
    this.glitter.reset();
    this.flare.set(this.center, 0, 0);
    this.endGlow.set(this.center, 0, 0);
    for (const p of this.pops) p.set(this.center, 0, 0);
    this.groundShock.set(this.from, 0, 0);
  }

  update(dt: number) {
    for (const e of this.emitters) e.update(dt);
    this.main.update(dt);
    this.orbit.update(dt);
    this.glitter.update(dt);
    if (!this.playing) return;
    this.time += dt;
    if (this.time >= DURATION) {
      const loop = this.settings.loop;
      this.playing = false;
      this.shake = 0;
      this.reset();
      if (loop) this.play();
      return;
    }
    const t = this.time, f = this.flags, P = this.from;

    // --- 0..0.3: the prism assembles in front of her; the small prisms orbit it. ---
    if (!f.prism) {
      f.prism = true;
      this.mainIdx = this.main.place(this.center, this.up, PRISM_LEN, PRISM_W, { scale: 1e-3, spin: 0.5 });
    }
    if (!f.shattered) {
      const g = easeOut(t / BUILD_END);
      this.main.setScale(this.mainIdx, Math.max(g, 1e-3));
      const lit = smoothstep((t - BEAM_T) / 0.2) * (1 - smoothstep((t - BEAM_END) / 0.1));
      this.main.setSpin(this.mainIdx, 0.5 + 2.2 * lit);
      this.main.move(this.mainIdx, this.v1.set(this.center.x, PRISM_Y + Math.sin(t * 1.6) * 0.06, this.center.z));
      this.orbit.set(this.v1.set(this.center.x, PRISM_Y, this.center.z), 1.5, 8, 0.8 + 1.4 * lit, 1.0);
      this.orbit.scale(Math.max(easeOut(t / BUILD_END), 1e-3));
    }

    // --- 0.3..2.3: the beam, held and sweeping. ---
    if (t >= BEAM_T && t < BEAM_END + 0.12) {
      const on = smoothstep((t - BEAM_T) / 0.1) * (1 - smoothstep((t - BEAM_END) / 0.12));
      this.beamDir(Math.min(t, BEAM_END), this.v2);
      this.v1.set(this.center.x, PRISM_Y, this.center.z);
      const endPt = this.v2.clone().multiplyScalar(RANGE).add(P).setY(0.2);
      // A dark under-beam twice as wide, then the bright spectral core on top, and a glow where it meets the floor.
      this.beams.set(this.v1, endPt, 1.6, 0.7 * on, PRISM.dark, 0.1, 1);
      this.beams.set(this.v1, endPt, 0.8, on, undefined, 0.1, 0);
      this.endGlow.set(endPt, 2.4 * on, 0.9 * on, t * 2);
      const glow = on * (0.85 + 0.15 * Math.sin(t * 36));
      this.flare.set(this.v1, 2.2 * glow, 0.8 * glow, t * 1.5);
      // Glitter streams off the beam's end along the floor while it sweeps.
      this.glintT += dt;
      while (this.glintT >= 0.07) {
        this.glintT -= 0.07;
        const along = 3 + Math.random() * (RANGE - 3);
        this.glitter.burst(this.v1.copy(this.v2).multiplyScalar(along).add(P).setY(0.2), 2, 2.5);
      }
    } else if (t >= BEAM_END + 0.12 && !f.beamOff) {
      f.beamOff = true;
      this.beams.hide(0);
      this.beams.hide(1);
      this.endGlow.set(this.center, 0, 0);
      this.flare.set(this.center, 0, 0);
    }

    // --- Three ticks: whoever stands on the beam (live position) is hit. ---
    for (let i = 0; i < TICKS.length; i++) {
      if (!f.tick[i] && t >= TICKS[i]) {
        f.tick[i] = true;
        this.tick(i);
      }
    }

    // --- 2.4: the prism shatters into glitter. ---
    if (!f.shattered && t >= SHATTER_T) {
      f.shattered = true;
      this.main.shatter(4.5, 0.9, this.v1.set(this.center.x, PRISM_Y, this.center.z));
      this.orbit.shatter(4, 0.9);
      this.glitter.burst(this.v1, 18, 5);
      this.shake = Math.max(this.shake, 0.2);
    }

    this.layout(dt);
  }

  /** One tick: every enemy on the beam's line right now takes a hit and a spectrum accent. */
  private tick(i: number) {
    const ctx = this.ctx, P = this.from;
    this.shake = Math.max(this.shake, 0.2);
    this.beamDir(TICKS[i], this.v2);
    // A flash of glitter along the beam.
    for (let k = 1; k <= 4; k++) this.glitter.burst(this.v1.copy(this.v2).multiplyScalar((RANGE * k) / 4).add(P).setY(0.3), 3, 3.5);
    this.tickAge[i] = 0;
    this.tickPts[i].copy(this.v2).multiplyScalar(RANGE * 0.5).add(P).setY(1.2);
    if (!ctx) return;
    for (const e of ctx.targets) {
      const p = e.group.position;
      const rx = p.x - P.x, rz = p.z - P.z;
      const along = rx * this.v2.x + rz * this.v2.z;
      const perp = Math.abs(rx * this.v2.z - rz * this.v2.x);
      if (along < 0.3 || along > RANGE + 0.5 || perp > BEAM_HALF_W) continue;
      this.glitter.burst(this.v1.set(p.x, 1.0, p.z), 6, 3);
      this.tickPts[i].set(p.x, 1.4, p.z);
      ctx.hit(e, { damage: this.settings.damage, knock: this.settings.knock, from: P, color: PRISM_CSS.body });
    }
  }

  private layout(_dt: number) {
    const t = this.time;

    // --- Screen: a light violet-black while the beam is held. ---
    this.screen.darken = 0.3 * smoothstep(t / 0.3) * (1 - smoothstep((t - SHATTER_T) / 0.6));

    // --- The spectrum accent over each tick's hit (two frames). ---
    for (let i = 0; i < TICKS.length; i++) {
      if (!this.flags.tick[i]) continue;
      this.tickAge[i] = t - TICKS[i];
      const sp = StarBurst.pop(this.tickAge[i], 0, 0.05);
      this.pops[i].set(this.tickPts[i], 1.3 * sp.scale, sp.opacity, 0.2 + i * 0.4);
    }

    // --- A soft ring on the floor at each tick. ---
    let gp = 0, gs = 0;
    for (const at of TICKS) {
      const s = t - at;
      if (s >= 0 && s < 0.35) { const k = s / 0.35; gp = Math.max(gp, 0.5 + 3 * k); gs = Math.max(gs, 0.03 * (1 - k) * (1 - k)); }
    }
    this.groundShock.set(this.from, Math.max(gp, 0.1), gs);
    this.shake *= 0.9;
  }
}

const easeOut = (x: number) => 1 - Math.pow(1 - Math.min(1, Math.max(0, x)), 3);

export const spectrumLanceModule: EffectModule = {
  label: 'spectrum lance',
  category: 'hero: prism',
  targeting: { mode: 'self', radius: RADIUS },
  create: () => new SpectrumLance(),
  telegraphs(effect) {
    const e = effect as SpectrumLance;
    const ctx = e.ctx;
    if (!ctx) return [];
    // The whole sweep (70 degrees plus the beam's width at its far end), drawn until the channel ends.
    return [{ shape: { kind: 'cone', x: ctx.from.x, z: ctx.from.z, radius: RANGE + 0.5, angle: SWEEP_DEG + 14, dir: e.yaw.value }, start: 0, impact: BEAM_END }];
  },
  bloom: { enabled: true, strength: 0.4, radius: 0.4, threshold: 0.86 },
  frameCamera(camera, controls, effect) {
    const e = effect as SpectrumLance;
    if (e.ctx) frameCast(camera, controls, e.ctx, 4);
  },
  buildGui(f, effect) {
    const s = (effect as SpectrumLance).settings;
    f.add(s, 'loop');
    f.add(s, 'damage', 1, 150, 1);
    f.add(s, 'knock', 0, 8, 0.5);
  },
};
