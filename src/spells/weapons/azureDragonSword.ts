import * as THREE from 'three';
import type { Emitter } from '../../emitter';
import { GlowSphere } from '../../effects/common';
import { WeaponAura, weaponModule } from '../../effects/weapons/aura';
import { FlowRibbon, PolylineSpawner, StarFlare, TAU, wave } from '../../effects/weapons/kit';
import { SOCKETS } from '../../effects/weapons/sockets';

/**
 * Azure dragon sword: the idle enchant of the Azure Dragon Sword (wp-sword-dragon), after the Genji dragonblade
 * and the Spiderlily scythe ribbon (recipes a-ow-genji-dragonblade, f-spiderlily-scythe-ribbon,
 * f-spiderlily-gauntlet-ignition). A translucent cyan spirit dragon (a scrolling-scale ribbon, two turns) uncoils
 * up round the dark blade from the guard on ignition, its head a small star near the tip; light runs up the
 * centre line, qi wisps curl off the vertebrae, sparkles rise and a dark teal mist sinks off the pommel.
 * Loops every 4 s.
 */
const S = SOCKETS['wp-sword-dragon'];
const PERIOD = 4;

// helix: from just above the guard to past the tip, clear of the blade (half width 0.05) and the vertebrae (x ≈ -0.09)
const Y0 = 0.2;
const Y1 = 1.15;
const TURNS = 2;
const R0 = 0.15;
const R1 = 0.115;
const PTS_PER_TURN = 12;
const HEAD_S = 0.96; // where along the helix the dragon's head sits
/** Angle at the head, so it ends on the camera-facing side (+Z). */
const END_ANGLE = Math.PI / 2;

/** Helix point at s (0..1), relative to (0, Y0, 0). `a` offsets the angle, `dr` the radius. */
function helix(s: number, a = 0, dr = 0): THREE.Vector3 {
  const ang = END_ANGLE - TURNS * TAU * (1 - s) + a;
  const r = R0 + (R1 - R0) * s + dr;
  return new THREE.Vector3(Math.cos(ang) * r, (Y1 - Y0) * s, Math.sin(ang) * r);
}
function helixPoints(a: number): THREE.Vector3[] {
  const n = TURNS * PTS_PER_TURN;
  return Array.from({ length: n + 1 }, (_, i) => helix(i / n, a));
}

export class AzureDragonSword extends WeaponAura {
  private body: FlowRibbon;
  private ghost: FlowRibbon;
  private coil = new THREE.Group();
  private whiskers: { ribbon: FlowRibbon; cycles: number }[] = [];
  private head = new StarFlare(0xbff8ff, 0x6ff2ff);
  private flare = new StarFlare(0xf0ffff, 0x6ff2ff);
  private ends: StarFlare[] = [];
  private lines: FlowRibbon[] = [];
  private wisps: { pivot: THREE.Group; ribbon: FlowRibbon; phase: number }[] = [];
  private halo = new GlowSphere(0x2fd8e8, { rim: false });
  private sparkles: Emitter;
  private ring: Emitter;
  private mist: Emitter;
  private sparkleFeed: PolylineSpawner;
  private mistFeed: PolylineSpawner;
  private burstDone = false;

  constructor() {
    super('wp-sword-dragon', PERIOD, 1.0, { darken: 0.12, tint: 0x0a1a24, tintAmount: 0.5, emissiveMax: 0.5, rim: 0x5ff0ff, rimPower: 3 });

    // spirit dragon: a dense helix (12 control points per turn, 128 segments) so Catmull-Rom does not cut the blade
    this.body = new FlowRibbon({
      points: helixPoints(0), width: (u) => 0.055 * (0.45 + 0.55 * Math.sin(Math.PI * Math.min(1, u * 1.15 + 0.1))),
      colors: ['#e8ffff', '#4fe6f4', '#0f7f8c'], cross: true, tiling: 6, across: 3, erosion: 0.35, sway: 0.02, swayWaves: 1.5,
      intensity: 0.85, segments: 128,
    });
    // its thinner, fainter after-image half a turn round
    this.ghost = new FlowRibbon({
      points: helixPoints(Math.PI), width: (u) => 0.03 * (0.5 + 0.5 * Math.sin(Math.PI * Math.min(1, u * 1.1 + 0.05))),
      colors: ['#c8ffff', '#35c8d8', '#0a3a4a'], cross: true, tiling: 5, across: 2.5, erosion: 0.5, sway: 0.02, swayWaves: 1,
      intensity: 0.7, segments: 128,
    });
    this.coil.position.set(0, Y0, 0);
    this.coil.add(this.body.mesh, this.ghost.mesh);

    // two whiskers trailing back (down the body) from the head
    for (const side of [-1, 1]) {
      const pts = [0, 0.012, 0.024, 0.036].map((d, i) => helix(HEAD_S - d, side * (0.1 + 0.07 * i), 0.012 * i + 0.01));
      const ribbon = new FlowRibbon({
        points: pts, width: (u) => 0.016 * (1 - 0.7 * u), colors: ['#e8ffff', '#4fe6f4', '#0f7f8c'],
        tiling: 2, across: 2, erosion: 0.5, sway: 0.02, swayWaves: 1, intensity: 0.8, segments: 24,
      });
      this.coil.add(ribbon.mesh);
      this.whiskers.push({ ribbon, cycles: 2 });
    }
    this.rig.add(this.coil, this.head.group);
    this.head.streak = 2;

    // light running up the centre line, one thin ribbon either side of the blade
    for (const z of [0.01, -0.01]) {
      const pts = [0.2, 0.4, 0.6, 0.8, 1.0].map((y) => new THREE.Vector3(0, y, z));
      const ribbon = new FlowRibbon({
        points: pts, width: 0.012, colors: ['#ffffff', '#6ff2ff', '#1aa6a0'],
        tiling: 6, across: 1, erosion: 0.3, intensity: 0.9, segments: 48,
      });
      this.lines.push(ribbon);
      this.rig.add(ribbon.mesh);
    }

    // qi wisps curling out and up off three vertebrae
    [1, 2, 3].forEach((si, i) => {
      const o = S.spine[si];
      const pts = [new THREE.Vector3(0, 0, 0), new THREE.Vector3(-0.04, 0.06, 0), new THREE.Vector3(-0.08, 0.14, 0), new THREE.Vector3(-0.06, 0.24, 0), new THREE.Vector3(-0.01, 0.31, 0)];
      const ribbon = new FlowRibbon({
        points: pts, width: (u) => 0.03 * (1 - 0.7 * u), colors: ['#e8ffff', '#4fe6f4', '#0f7f8c'],
        tiling: 3, across: 2, erosion: 0.6, sway: 0.04, swayWaves: 1.2, intensity: 0.75, segments: 40,
      });
      const pivot = new THREE.Group();
      pivot.position.set(o.x, o.y, 0.02); // in front of the vertebrae
      pivot.add(ribbon.mesh);
      this.rig.add(pivot);
      this.wisps.push({ pivot, ribbon, phase: i / 3 });
    });

    // focal star on the guard orb, small ones on the pommel and the tip
    this.flare.streak = 5;
    for (let i = 0; i < 2; i++) {
      const g = new StarFlare(0xc8ffff, 0x6ff2ff);
      g.streak = 2.5;
      this.ends.push(g);
      this.rig.add(g.group);
    }
    this.halo.mesh.position.copy(S.orb);
    this.rig.add(this.halo.mesh, this.flare.group);

    // sparkles rising along the blade, an ignition ring from the orb, and a sinking dark mist off the pommel
    this.sparkles = this.emitter({
      maxParticles: 160, lifetime: 1.5, lifetimeJitter: 0.4, speed: 0.06, speedJitter: 0.5, spread: 40,
      gravity: -0.1, drag: 0.5, sizeStart: 0.012, sizeEnd: 0.003, sizeJitter: 0.6,
      colorStart: '#f0ffff', colorMid: '#6ff2ff', colorEnd: '#1aa6a0', opacityStart: 0.9, opacityEnd: 0, additive: true,
    });
    this.sparkles.points.renderOrder = 4;
    this.sparkleFeed = new PolylineSpawner(this.sparkles, [S.bladeBase, S.tip], 14, 0.07);
    this.ring = this.emitter({
      maxParticles: 40, lifetime: 0.9, lifetimeJitter: 0.3, speed: 0.4, speedJitter: 0.3, spread: 180,
      gravity: 0, drag: 2, sizeStart: 0.016, sizeEnd: 0.003, sizeJitter: 0.4,
      colorStart: '#f0ffff', colorMid: '#6ff2ff', colorEnd: '#0a3a4a', opacityStart: 0.95, opacityEnd: 0, additive: true,
    });
    this.ring.points.renderOrder = 4;
    this.mist = this.emitter({
      maxParticles: 50, lifetime: 1.8, lifetimeJitter: 0.3, speed: 0.04, speedJitter: 0.4, spread: 40,
      gravity: 0.08, drag: 1, sizeStart: 0.05, sizeEnd: 0.11, sizeJitter: 0.5, erosion: 0.55, spin: 0.3,
      colorStart: '#0e4a52', colorEnd: '#041418', opacityStart: 0.5, opacityEnd: 0, additive: false,
    });
    this.mistFeed = new PolylineSpawner(this.mist, [S.pommel, S.pommel.clone().setY(S.pommel.y + 0.06)], 3, 0.02);
  }

  protected reset() {
    this.burstDone = false;
  }

  protected animate(t: number, loopT: number, ramp: number, _dt: number) {
    const k = this.intensity;
    const f = loopT / PERIOD;
    const beat = wave(loopT, PERIOD, 0.25); // one breath per loop
    // ignition: the dragon uncoils from the guard upward over 0.6 s (one-shot, uses t)
    const g = THREE.MathUtils.smoothstep(t, 0, 0.6);

    this.model.rim = (0.35 + 0.25 * wave(loopT, PERIOD, 0.5)) * ramp * k;

    // dragon body: grows up from the guard, breathes in radius
    const rad = 0.4 + 0.6 * g;
    const breathe = 1 + 0.03 * Math.sin(TAU * f);
    this.coil.scale.set(Math.max(1e-4, rad * breathe), Math.max(1e-4, g), Math.max(1e-4, rad * breathe));
    this.coil.rotation.y = 0.12 * Math.sin(TAU * f); // slow sway of the coil about the blade
    this.body.update(loopT, PERIOD, 2, 1);
    this.ghost.update(loopT, PERIOD, 1, 1);
    this.body.opacity = 0.7 * (0.85 + 0.15 * beat) * g * k;
    this.ghost.opacity = 0.32 * (0.8 + 0.2 * wave(loopT, PERIOD, 0.55)) * g * k;
    this.whiskers.forEach((w, i) => {
      w.ribbon.update(loopT, PERIOD, w.cycles, 1);
      w.ribbon.opacity = 0.6 * (0.8 + 0.2 * Math.sin(TAU * (f + i * 0.5))) * THREE.MathUtils.smoothstep(t, 0.4, 0.8) * k;
    });

    // head star rides the top of the coil (position follows the coil's scale and sway)
    const hp = helix(HEAD_S).multiply(this.coil.scale).applyAxisAngle(new THREE.Vector3(0, 1, 0), this.coil.rotation.y);
    hp.y += Y0;
    hp.z += 0.01;
    this.head.set(hp, 0.06 * (0.85 + 0.25 * beat) * g, (0.6 + 0.3 * beat) * THREE.MathUtils.smoothstep(t, 0.3, 0.8) * k, 0);

    // focal star on the orb, with a pop on ignition
    const pop = t < 0.6 ? 1 + 1.3 * Math.max(0, 1 - Math.abs(t - 0.2) / 0.2) : 1;
    this.flare.set(S.orb.clone().setZ(0.02), 0.09 * pop * (0.85 + 0.25 * beat) * ramp, (0.75 + 0.25 * beat) * Math.min(1, t / 0.15) * k, 0);
    this.halo.mesh.scale.setScalar(0.2 + 0.02 * beat);
    this.halo.opacity = (0.14 + 0.07 * beat) * ramp * k;

    // pommel and tip twinkle, offset in phase so the light travels
    const tws = [Math.max(0, Math.sin(TAU * f)) ** 4, Math.max(0, Math.sin(TAU * (f - 0.4))) ** 4];
    this.ends[0].set(S.pommel.clone().setZ(0.02), 0.05 * (0.5 + 0.5 * tws[0]), (0.3 + 0.7 * tws[0]) * ramp * k, 0);
    this.ends[1].set(S.tip.clone().setZ(0.02), 0.05 * (0.5 + 0.5 * tws[1]), (0.3 + 0.7 * tws[1]) * ramp * k, 0);

    // centre-line light running up the blade
    this.lines.forEach((l, i) => {
      l.update(loopT, PERIOD, 3, 1);
      l.opacity = 0.7 * (0.8 + 0.2 * wave(loopT, PERIOD, i * 0.5)) * THREE.MathUtils.smoothstep(t, 0.1, 0.7) * k;
    });

    // qi wisps off the vertebrae
    const grow = THREE.MathUtils.smoothstep(t, 0.4, 0.9);
    this.wisps.forEach((w, i) => {
      w.pivot.scale.setScalar(Math.max(1e-4, (0.35 + 0.65 * grow) * (0.92 + 0.08 * Math.sin(TAU * (f + w.phase)))));
      w.ribbon.update(loopT, PERIOD, 2 + (i % 2), 1);
      w.ribbon.opacity = 0.55 * (0.8 + 0.2 * Math.sin(TAU * (f * 2 + w.phase))) * grow * k;
    });

    // ignition ring: 16 sparkles burst from the orb, once
    if (!this.burstDone && t >= 0.25) {
      this.ring.burst(16, S.orb);
      this.burstDone = true;
    }

    this.sparkleFeed.rate = 14 * ramp * k;
    this.mistFeed.rate = 3 * ramp;
    this.sparkleFeed.update(_dt);
    this.mistFeed.update(_dt);
  }
}

export const azureDragonSwordModule = weaponModule('azure dragon sword', 'wp-sword-dragon', () => new AzureDragonSword());
