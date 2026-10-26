import * as THREE from 'three';
import type { Emitter } from '../../emitter';
import { GlowSphere } from '../../effects/common';
import { WeaponAura, weaponModule } from '../../effects/weapons/aura';
import { FlowRibbon, PetalSwarm, PolylineSpawner, StarFlare, TAU, alongPolyline, wave } from '../../effects/weapons/kit';
import { SOCKETS } from '../../effects/weapons/sockets';

/**
 * Green dragon crescent: the idle enchant of the Green Dragon Crescent Blade (wp-glaive-guandao), after the
 * Spiderlily scythe (f-spiderlily-scythe-ribbon, f-spiderlily-bow-crest, e-geodraws-crimson-pillar). The dark
 * blade wakes up: silk ribbons unspool down the haft, the gold relief dragon lights up with a band of light that
 * runs tail to head once per loop, a jade banner streams off the blade's back edge, a glint sweeps the cutting
 * edge and a jade star burns on the collar orb. Loops every 4 s.
 */
const S = SOCKETS['wp-glaive-guandao'];
const PERIOD = 4;
const V = (x: number, y: number, z = 0) => new THREE.Vector3(x, y, z);

/** n+1 points of `curve` between arc fractions u0 and u1. */
function slice(curve: THREE.Curve<THREE.Vector3>, u0: number, u1: number, n: number) {
  const out: THREE.Vector3[] = [];
  for (let i = 0; i <= n; i++) out.push(curve.getPointAt(u0 + (u1 - u0) * (i / n)));
  return out;
}

/** Overlapping thirds of a curve: [0, .42], [.29, .71], [.58, 1]. */
const THIRDS: [number, number][] = [[0, 0.42], [0.29, 0.71], [0.58, 1]];

interface Piece { ribbon: FlowRibbon; centre: number; cycles: number; phase: number }
interface Silk { ribbon: FlowRibbon; index: number; phase: number; cycles: number }

export class GreenDragonCrescent extends WeaponAura {
  private pieces: Piece[] = [];
  private silks: Silk[] = [];
  private banner: FlowRibbon;
  private flare = new StarFlare(0xe8fff0, 0x6dffa0);
  private buttFlare = new StarFlare(0xfff0c0, 0x5cff9a);
  private glint = new StarFlare(0xfff6d0, 0xffd070);
  private halo = new GlowSphere(0x1f9a50, { rim: false });
  private flecks = new PetalSwarm({ count: 40, color: 0xffd070, size: 0.014, gravity: 0.1, life: 1.8 });
  private motes: Emitter;
  private mist: Emitter;
  private edgeFeed: PolylineSpawner;
  private haftFeed: PolylineSpawner;
  private mistFeed: PolylineSpawner;
  private burstDone = false;

  constructor() {
    super('wp-glaive-guandao', PERIOD, 0.9, { darken: 0.12, tint: 0x0a1a10, tintAmount: 0.5, emissiveMax: 0.5, rim: 0x6dffa0, rimPower: 2.4 });

    // the relief dragon: three overlapping pieces on each face, a few mm in front of the plate
    const zf = S.reliefZ + 0.006;
    for (const side of [1, -1]) {
      const curve = new THREE.CatmullRomCurve3(S.relief.map((p) => V(p.x, p.y, side * zf)));
      THIRDS.forEach(([u0, u1], i) => {
        const ribbon = new FlowRibbon({
          points: slice(curve, u0, u1, 12), width: (u) => 0.02 * (0.75 + 0.5 * Math.sin(Math.PI * u)),
          colors: ['#fff6d0', '#5cff9a', '#1f9a50'], normal: V(0, 0, side),
          tiling: 3, across: 2, erosion: 0.25, sway: 0, intensity: 1.1, segments: 40,
        });
        this.rig.add(ribbon.mesh);
        this.pieces.push({ ribbon, centre: (u0 + u1) / 2, cycles: 2, phase: i * 0.2 });
      });
    }

    // two silk ribbons spiralling down the haft (radius 0.04, 12 control points per turn), half a turn apart
    const turns = 2.5, perTurn = 12, top = S.haft[1].y, bottom = S.haft[0].y;
    for (let k = 0; k < 2; k++) {
      const pts: THREE.Vector3[] = [];
      const n = Math.round(turns * perTurn);
      for (let i = 0; i <= n; i++) {
        const u = i / n, a = TAU * (turns * u + k * 0.5);
        pts.push(V(0.04 * Math.cos(a), top + (bottom - top) * u, 0.04 * Math.sin(a)));
      }
      const curve = new THREE.CatmullRomCurve3(pts);
      const cols: [string, string, string] = k ? ['#ffd070', '#5cff9a', '#1f9a50'] : ['#1f9a50', '#5cff9a', '#ffd070'];
      THIRDS.forEach(([u0, u1], j) => {
        const count = Math.max(13, Math.round((u1 - u0) * turns * perTurn) + 1);
        const ribbon = new FlowRibbon({
          points: slice(curve, u0, u1, count - 1), width: 0.04, colors: cols, cross: true,
          tiling: 3, across: 1.5, erosion: 0.35, sway: 0.02, swayWaves: 1.2, intensity: 0.85, segments: 96,
        });
        this.rig.add(ribbon.mesh);
        this.silks.push({ ribbon, index: j, phase: k * 0.5 + j * 0.13, cycles: 2 });
      });
    }

    // blade banner: streams back (+X, up) off the back edge, like the scythe's silk
    this.banner = new FlowRibbon({
      points: [V(0.075, 0.5, 0.012), V(0.13, 0.6, 0.03), V(0.2, 0.74, 0.02), V(0.3, 0.9, 0.0)],
      width: (u) => 0.03 + 0.07 * Math.sin(Math.PI * Math.min(1, u * 0.9 + 0.1)) ** 0.7,
      colors: ['#b8ffd0', '#3fe07a', '#0a5a2a'], tiling: 3, across: 2.5, erosion: 0.6,
      sway: 0.04, swayAxis: V(0, 0, 1), swayWaves: 1.4, intensity: 0.7, segments: 64,
    });
    this.rig.add(this.banner.mesh);

    this.glint.streak = 5;
    this.flare.streak = 4;
    this.buttFlare.streak = 3;
    this.halo.mesh.position.copy(S.collar).add(V(0, 0.02, -0.02));
    this.rig.add(this.halo.mesh, this.flare.group, this.buttFlare.group, this.glint.group, this.flecks.mesh);

    // jade motes rising off the edge and the haft
    this.motes = this.emitter({
      maxParticles: 160, lifetime: 1.5, lifetimeJitter: 0.4, speed: 0.1, speedJitter: 0.5, spread: 40,
      gravity: -0.14, drag: 0.6, sizeStart: 0.014, sizeEnd: 0.004, sizeJitter: 0.6,
      colorStart: '#e8fff0', colorMid: '#5cff9a', colorEnd: '#1f9a50', opacityStart: 0.9, opacityEnd: 0, additive: true,
    });
    this.motes.points.renderOrder = 4;
    this.edgeFeed = new PolylineSpawner(this.motes, S.edge.map((p) => V(p.x, p.y, 0.012)), 9, 0.012);
    this.haftFeed = new PolylineSpawner(this.motes, [V(0.045, bottom, 0), V(0.045, top, 0)], 5, 0.015);

    // dark layer: eroded dark-green mist low round the butt
    this.mist = this.emitter({
      maxParticles: 50, lifetime: 1.6, lifetimeJitter: 0.3, speed: 0.05, speedJitter: 0.4, spread: 30,
      gravity: -0.05, drag: 1, sizeStart: 0.06, sizeEnd: 0.12, sizeJitter: 0.5, erosion: 0.55, spin: 0.4,
      colorStart: '#0f3a20', colorEnd: '#040e08', opacityStart: 0.5, opacityEnd: 0, additive: false,
    });
    this.mistFeed = new PolylineSpawner(this.mist, [V(-0.05, S.butt.y + 0.1, 0.04), V(0.05, S.butt.y + 0.2, 0.04), V(0, S.butt.y + 0.05, -0.04)], 3, 0.03);
  }

  protected reset() {
    this.flecks.clear();
    this.burstDone = false;
  }

  protected animate(t: number, loopT: number, ramp: number, dt: number) {
    const k = this.intensity;
    const f = loopT / PERIOD;
    const beat = wave(loopT, PERIOD, 0.25);
    this.model.rim = (0.35 + 0.2 * wave(loopT, PERIOD, 0.5)) * ramp * k;

    // relief dragon: a band of light travels tail -> head once per loop, entering and leaving outside the dragon
    const band = -0.15 + 1.3 * f;
    this.pieces.forEach((o) => {
      const d = Math.abs(band - o.centre);
      const bump = Math.max(0, 1 - d / 0.3) ** 2;
      o.ribbon.update(loopT, PERIOD, o.cycles, 1);
      o.ribbon.opacity = (0.22 + 0.78 * bump) * (0.9 + 0.1 * Math.sin(TAU * (f * 2 + o.phase))) * ramp * k;
    });

    // silk: unspools top -> bottom on ignition, then breathes
    this.silks.forEach((o) => {
      const grow = THREE.MathUtils.smoothstep(t, 0.1 + 0.25 * o.index, 0.45 + 0.25 * o.index);
      o.ribbon.update(loopT, PERIOD, o.cycles, 1);
      o.ribbon.opacity = 0.6 * (0.8 + 0.2 * Math.sin(TAU * (f + o.phase))) * grow * k;
    });

    const bGrow = THREE.MathUtils.smoothstep(t, 0.3, 0.8);
    this.banner.update(loopT, PERIOD, 2, 1);
    this.banner.opacity = 0.5 * (0.8 + 0.2 * wave(loopT, PERIOD, 0.6)) * bGrow * k;

    // edge glint: one sweep from the collar to the tip per loop
    const s = THREE.MathUtils.clamp((f - 0.05) / 0.6, 0, 1);
    const glintPos = alongPolyline(S.edge, s).clone().setZ(0.016);
    const gl = Math.sin(Math.PI * s) ** 3 * (s > 0 && s < 1 ? 1 : 0);
    this.glint.set(glintPos, 0.06 * (0.5 + 0.5 * gl), gl * ramp * k, 0);

    // focal star on the collar orb, with an ignition pop
    const orb = S.orb.clone().setZ(S.orb.z + 0.01);
    const pop = t < 0.5 ? 1 + 1.3 * Math.max(0, 1 - Math.abs(t - 0.3) / 0.2) : 1;
    this.flare.set(orb, 0.11 * pop * (0.85 + 0.25 * beat) * ramp, (0.75 + 0.25 * beat) * Math.min(1, t / 0.2) * k);
    this.buttFlare.set(S.butt.clone().setZ(0.02), 0.05 * (0.85 + 0.2 * wave(loopT, PERIOD, 0.75)), 0.7 * ramp * k);

    this.halo.mesh.scale.setScalar(0.26 + 0.03 * beat);
    this.halo.opacity = (0.14 + 0.07 * beat) * ramp * k;

    // gold flecks burst from the collar on ignition
    if (!this.burstDone && t >= 0.25) {
      this.flecks.emit(orb, 24, 0.45, 0.2);
      this.burstDone = true;
    }
    this.flecks.update(dt);

    this.edgeFeed.rate = 9 * ramp * k;
    this.haftFeed.rate = 5 * ramp * k;
    this.mistFeed.rate = 3 * ramp;
    this.edgeFeed.update(dt);
    this.haftFeed.update(dt);
    this.mistFeed.update(dt);
  }
}

export const greenDragonCrescentModule = weaponModule('green dragon crescent', 'wp-glaive-guandao', () => new GreenDragonCrescent());
