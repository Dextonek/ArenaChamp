import * as THREE from 'three';
import type { Emitter } from '../../emitter';
import { GlowSphere } from '../../effects/common';
import { LightningArc } from '../../effects/parts/lightningArc';
import { WeaponAura, weaponModule } from '../../effects/weapons/aura';
import { FlowRibbon, LilyBurst, StarFlare, TAU, wave } from '../../effects/weapons/kit';
import { SOCKETS } from '../../effects/weapons/sockets';

/**
 * Thunder drum hammer: the idle enchant of the thunder war hammer (wp-hammer-thunder), after the recipes
 * d-kler-3-lightning-chain-cage (arcs locked between fixed points, redrawn every few frames), f-moa-arm-lightning-lash
 * (a bolt crawling down the haft) and d-wolf-4-pink-plasma-slash-orb (curly arcs + four-point sparkle).
 * Millimetre-thin arcs jump between the drum studs, the spike and the beast's mouth; a white qi spiral winds up the
 * haft, the taiji burns white-violet with a gold streak, a dark storm haze hangs round the head.
 * Loops every 3 s. The arcs are re-rolled on a time slot counter (3, 4 or 5 frames at 60 fps, a whole number of
 * slots per loop) with a seeded random per arc and slot, so frame t and t + 3 s are identical.
 */
const S = SOCKETS['wp-hammer-thunder'];
const PERIOD = 3;
const FLASH = 0.15; // ignition: all arcs fire for this long
const ON_CHANCE = 0.42; // each arc is visible about 40% of the time

/** mulberry32: small seeded PRNG. */
function seeded(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Runs fn with Math.random replaced by rng, so LightningArc.reroll() (which uses Math.random) is deterministic. */
function withRandom<T>(rng: () => number, fn: () => T): T {
  const orig = Math.random;
  Math.random = rng;
  try { return fn(); } finally { Math.random = orig; }
}

type ArcKind = 'spike' | 'mouth' | 'drumL' | 'drumR' | 'across' | 'haft';
interface Strike { arc: LightningArc; kind: ArcKind; slots: number; slot: number; on: boolean }

export class ThunderDrumHammer extends WeaponAura {
  private strikes: Strike[] = [];
  private flare = new StarFlare(0xffffff, 0xffd080);
  private lily = new LilyBurst(0xb9a0ff, 0xf2eaff, { filaments: 22, curl: 0.4 });
  private eyes: StarFlare[] = [];
  private bellGlint = new StarFlare(0xdccfff, 0xffd080);
  private halo = new GlowSphere(0x7a4ae0, { rim: false });
  private spiral: FlowRibbon;
  private sparks: Emitter;
  private haze: Emitter;
  private hazeAcc = 0;
  private a = new THREE.Vector3();
  private b = new THREE.Vector3();

  constructor() {
    super('wp-hammer-thunder', PERIOD, 0.7, { darken: 0.15, tint: 0x141020, tintAmount: 0.5, emissiveMax: 0.5, rim: 0xb49aff, rimPower: 3.5 });

    // lightning: thin small-scale arcs; auto re-roll is switched off (huge rerollEvery) and done per slot below
    const kinds: { kind: ArcKind; slots: number; width: number }[] = [
      { kind: 'spike', slots: 60, width: 0.016 }, // 0.05 s = 3 frames
      { kind: 'mouth', slots: 45, width: 0.014 }, // 4 frames
      { kind: 'drumL', slots: 36, width: 0.013 }, // 5 frames
      { kind: 'drumR', slots: 45, width: 0.013 },
      { kind: 'across', slots: 60, width: 0.016 },
      { kind: 'haft', slots: 90, width: 0.011 }, // 2 frames: the crawler moves, so it is redrawn more often
    ];
    for (const k of kinds) {
      const arc = new LightningArc({
        width: k.width, segments: 8, jitter: 0.1, branches: 1, rerollEvery: 1e9, dropChance: 0,
        core: 0xffffff, glow: 0x9a6aff,
      });
      arc.mesh.renderOrder = 4;
      this.rig.add(arc.mesh);
      this.strikes.push({ arc, kind: k.kind, slots: k.slots, slot: -1, on: false });
    }

    // white qi spiral up the haft, 2 turns just outside the shaft
    const pts: THREE.Vector3[] = [];
    const n = 24;
    for (let i = 0; i <= n; i++) {
      const u = i / n, ang = u * TAU * 2;
      pts.push(new THREE.Vector3(Math.cos(ang) * 0.042, S.haft[0].y + (S.haft[1].y - S.haft[0].y) * u, Math.sin(ang) * 0.042));
    }
    this.spiral = new FlowRibbon({
      points: pts, width: 0.025, colors: ['#ffffff', '#dccfff', '#7a4ae0'], cross: true,
      tiling: 4, across: 2, erosion: 0.5, sway: 0.01, swayWaves: 1, intensity: 0.8,
    });
    this.rig.add(this.spiral.mesh);

    // taiji focal point (the flare turns the lily slowly), eyes, bell
    this.flare.streak = 4;
    for (let i = 0; i < S.beastEyes.length; i++) {
      const e = new StarFlare(0xb08cff, 0xdccfff);
      e.streak = 2;
      this.eyes.push(e);
      this.rig.add(e.group);
    }
    this.bellGlint.streak = 3;
    this.halo.mesh.position.set(0, S.headY, 0);
    this.rig.add(this.halo.mesh, this.lily.group, this.flare.group, this.bellGlint.group);

    // sparks where the arcs land, and the dark storm haze (normal blended, the dark layer)
    this.sparks = this.emitter({
      maxParticles: 160, lifetime: 0.35, lifetimeJitter: 0.4, speed: 0.5, speedJitter: 0.6, spread: 180,
      drag: 3, sizeStart: 0.012, sizeEnd: 0.003, sizeJitter: 0.5,
      colorStart: '#ffffff', colorMid: '#c7b0ff', colorEnd: '#6a3ad0', opacityStart: 1, opacityEnd: 0, additive: true,
    });
    this.sparks.points.renderOrder = 4;
    this.haze = this.emitter({
      maxParticles: 50, lifetime: 2, lifetimeJitter: 0.3, speed: 0.04, speedJitter: 0.5, spread: 40,
      gravity: -0.03, drag: 1, sizeStart: 0.08, sizeEnd: 0.17, sizeJitter: 0.5, erosion: 0.55, spin: 0.3,
      colorStart: '#2a2438', colorEnd: '#0c0a14', opacityStart: 0.45, opacityEnd: 0, additive: false,
    });
  }

  protected reset() {
    this.hazeAcc = 0;
    for (const s of this.strikes) { s.slot = -1; s.on = false; }
  }

  /** Point on a drum's surface: x on the drum axis, angle from +Y towards +Z, radius factor over the drum radius. */
  private drumPoint(out: THREE.Vector3, x: number, ang: number, rf = 1.06) {
    const r = S.drumRadius * rf;
    return out.set(x, S.headY + Math.cos(ang) * r, Math.sin(ang) * r);
  }

  /** Picks the endpoints and on/off state of one arc for a slot, deterministic from (arc index, slot). */
  private strike(s: Strike, i: number, f: number, flash: boolean) {
    const rng = seeded(i * 7919 + s.slot * 104729 + 13);
    const a = this.a, b = this.b;
    let on = rng() < ON_CHANCE;
    switch (s.kind) {
      case 'spike': {
        const d = rng() < 0.5 ? 0 : 1;
        a.copy(S.spikeTop);
        this.drumPoint(b, S.studRingX[d], (rng() - 0.5) * 1.4);
        break;
      }
      case 'mouth': {
        a.copy(S.beastMouth);
        b.set(a.x + 0.07 + rng() * 0.1, a.y + (rng() - 0.5) * 0.2, a.z + (rng() - 0.5) * 0.1);
        break;
      }
      case 'drumL':
      case 'drumR': {
        const x = S.studRingX[s.kind === 'drumL' ? 0 : 1];
        const th = rng() * TAU;
        this.drumPoint(a, x, th, 1.08);
        this.drumPoint(b, x + (rng() - 0.5) * 0.05, th + (rng() < 0.5 ? -1 : 1) * (0.45 + 0.35 * rng()), 1.08);
        break;
      }
      case 'across': {
        const th = (rng() - 0.5) * 2.6 + (rng() < 0.5 ? 0 : Math.PI);
        this.drumPoint(a, S.studRingX[0], th, 1.1);
        this.drumPoint(b, S.studRingX[1], th + (rng() - 0.5) * 0.5, 1.1);
        break;
      }
      case 'haft': {
        // crawls from the top of the haft to the bottom once per loop, winding round the shaft
        const y0 = S.haft[1].y - (S.haft[1].y - S.haft[0].y) * f;
        const ph = TAU * 2 * f + rng() * 0.6;
        a.set(Math.cos(ph) * 0.035, y0, Math.sin(ph) * 0.035);
        b.set(Math.cos(ph + 0.9) * 0.035, y0 - 0.12, Math.sin(ph + 0.9) * 0.035);
        on = rng() < 0.6;
        break;
      }
    }
    s.on = on || flash;
    s.arc.setEnds(a, b);
    const rr = seeded(i * 31337 + s.slot * 2749 + 5);
    withRandom(rr, () => s.arc.reroll());
    if (s.on && s.kind !== 'haft') this.sparks.burst(2 + Math.floor(rng() * 4), b);
  }

  protected animate(t: number, loopT: number, ramp: number, dt: number) {
    const k = this.intensity;
    const f = loopT / PERIOD;
    const beat = wave(loopT, PERIOD, 0.25); // one breath per loop
    const flash = t < FLASH;
    const arcEnv = Math.max(ramp, flash ? 1 : 0);

    // lightning
    let active = 0;
    this.strikes.forEach((s, i) => {
      const slot = Math.floor(f * s.slots) % s.slots;
      // during the ignition flash every slot change also forces the arc on
      if (slot !== s.slot || (flash && !s.on)) {
        s.slot = slot;
        this.strike(s, i, slot / s.slots, flash);
      }
      const env = s.kind === 'haft' ? Math.sqrt(Math.sin(Math.PI * f)) : 1;
      s.arc.opacity = s.on ? 0.9 * arcEnv * env * k : 0;
      s.arc.update(dt);
      if (s.on) active++;
    });

    // taiji: the hot focal point, the lily behind it as the medallion's charge
    const pos = S.taijiFront;
    const pop = t < 0.15 ? 1 + 1.5 * Math.max(0, 1 - Math.abs(t - 0.05) / 0.1) : 1;
    this.lily.set(this.a.copy(pos).setZ(pos.z - 0.004), 0.3 * (0.94 + 0.06 * beat), 0.6 * Math.min(1, t / 0.2) * k, 0.3 * Math.sin(TAU * f));
    this.flare.set(this.b.copy(pos).setZ(pos.z + 0.012), 0.13 * pop * (0.85 + 0.25 * beat), (0.75 + 0.25 * beat) * Math.min(1, t / 0.1) * k);

    // beast eyes flare together once per loop; bell glint twinkles half a loop later
    const eyeFlare = Math.max(0, Math.sin(TAU * f)) ** 6;
    this.eyes.forEach((e, i) => {
      e.set(S.beastEyes[i], 0.03 + 0.03 * eyeFlare, (0.3 + 0.7 * eyeFlare) * ramp * k, 0);
    });
    const bell = Math.max(0, Math.sin(TAU * (f - 0.5))) ** 6;
    this.bellGlint.set(S.bell, 0.05 * (0.4 + 0.6 * bell), (0.2 + 0.8 * bell) * ramp * k, 0);

    // halo pulses with the arcs, rim breathes out of phase
    this.halo.mesh.scale.setScalar(0.34 + 0.03 * beat);
    this.halo.opacity = (0.1 + 0.2 * (active / this.strikes.length) + 0.06 * beat) * ramp * k;
    this.model.rim = (0.14 + 0.1 * wave(loopT, PERIOD, 0.5)) * ramp * k;

    // qi spiral: fades in with the ignition; 2 texture passes per loop
    this.spiral.update(loopT, PERIOD, 2, 1);
    this.spiral.opacity = 0.6 * (0.8 + 0.2 * wave(loopT, PERIOD, 0.75)) * ramp * k;

    // storm haze round the head
    this.hazeAcc += 6 * ramp * dt;
    while (this.hazeAcc >= 1) {
      this.hazeAcc -= 1;
      this.a.set((Math.random() - 0.5) * 0.6, S.headY + (Math.random() - 0.5) * 0.3, (Math.random() - 0.5) * 0.2);
      this.haze.burst(1, this.a);
    }
  }
}

export const thunderDrumHammerModule = weaponModule('thunder drum hammer', 'wp-hammer-thunder', () => new ThunderDrumHammer());
