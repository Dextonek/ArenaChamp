import * as THREE from 'three';
import type { Emitter } from '../../emitter';
import { GlowSphere } from '../../effects/common';
import { WeaponAura, weaponModule } from '../../effects/weapons/aura';
import { FlowRibbon, LilyBurst, PetalSwarm, PolylineSpawner, StarFlare, TAU, wave } from '../../effects/weapons/kit';
import { SOCKETS, fanPoint } from '../../effects/weapons/sockets';

/**
 * Phoenix fan: the idle enchant of the Jade-Leaf Phoenix Fan (wp-fan-fire), after the Spiderlily fans
 * (recipes f-spiderlily-fan-tufts, f-spiderlily-gauntlet-ignition). The dark fan ignites from the pivot: a gold
 * spider-lily bursts open on the pivot gem with a white-gold star and lens streak, a fringe of flame tongues
 * grows out round the leaf tips (orange root → pink → violet), rib tips twinkle, embers rise, small dark puffs
 * drift off the top and petals flutter away. Loops every 4 s; the reference weapon for the other auras.
 */
const S = SOCKETS['wp-fan-fire'];
const PERIOD = 4;

interface Tongue { pivot: THREE.Group; ribbon: FlowRibbon; phase: number; cycles: number }

export class PhoenixFan extends WeaponAura {
  private tongues: Tongue[] = [];
  private lily = new LilyBurst(0xffb85a, 0xfff0c8, { filaments: 28, curl: 1 });
  private flare = new StarFlare(0xfff0d0, 0xff9ad0);
  private glints: StarFlare[] = [];
  private halo = new GlowSphere(0xc04a9a, { rim: false });
  private petals = new PetalSwarm({ count: 70, color: 0xffa860, size: 0.022, gravity: 0.3, life: 2.4 });
  private embers: Emitter;
  private smoke: Emitter;
  private emberFeed: PolylineSpawner;
  private smokeFeed: PolylineSpawner;
  private petalTimer = 0;
  private burstDone = false;

  constructor() {
    super('wp-fan-fire', PERIOD, 0.9, { darken: 0.08, tint: 0x2a1030, tintAmount: 0.5, emissiveMax: 0.4, rim: 0xff7ab8, rimPower: 2.2 });

    // flame fringe: three tongues per leaf tip and one per rib tip, radiating outward
    const roots: { deg: number; r: number; len: number; w: number }[] = [];
    // (rooted inside the leaves, so the flames cover the outer half of the fan like the reference)
    for (const a of S.leafAngles) {
      for (const d of [-12, -6, 0, 6, 12]) {
        const c = d === 0;
        roots.push({ deg: a + d, r: 0.2 + 0.02 * Math.abs(d) / 6, len: c ? 0.3 : 0.24 - 0.02 * Math.abs(d) / 6, w: c ? 0.07 : 0.055 });
      }
    }
    for (const a of S.ribAngles) roots.push({ deg: a, r: S.ribTipR - 0.05, len: 0.2, w: 0.045 });
    roots.forEach((o, i) => {
      const a = THREE.MathUtils.degToRad(o.deg);
      const out = new THREE.Vector3(Math.sin(a), Math.cos(a), 0);
      const side = new THREE.Vector3(Math.cos(a), -Math.sin(a), 0);
      const bend = (i % 2 ? 1 : -1) * 0.25;
      // local points from the root (the pivot group sits at the root and scales the tongue out)
      const pts = [0, 0.35, 0.7, 1].map((u) => out.clone().multiplyScalar(o.len * u).addScaledVector(side, o.len * bend * u * u));
      const ribbon = new FlowRibbon({
        points: pts, width: (u) => o.w * (1 - 0.65 * u), colors: ['#ffb070', '#ff506a', '#7a2070'],
        tiling: 3, across: 6, erosion: 0.6, sway: 0.03, swayWaves: 1.2, intensity: 0.75,
      });
      const pivot = new THREE.Group();
      pivot.position.copy(fanPoint(o.deg, o.r, 0.014)); // in front of the leaves and their gold rims
      pivot.add(ribbon.mesh);
      this.rig.add(pivot);
      this.tongues.push({ pivot, ribbon, phase: (i * 0.37) % 1, cycles: 2 + (i % 2) });
    });

    // rib-tip glints
    for (let i = 0; i < S.ribAngles.length; i++) {
      const g = new StarFlare(0xffe0a0, 0xffb0d8);
      g.streak = 2.5;
      this.glints.push(g);
      this.rig.add(g.group);
    }

    this.halo.mesh.position.copy(S.pivotCentre).add(new THREE.Vector3(0, 0.08, -0.05));
    this.rig.add(this.halo.mesh, this.lily.group, this.flare.group, this.petals.mesh);

    // embers rising off the leaf rim, and dark puffs drifting off the top (the dark-against-bright layer)
    const rim = S.leafAngles.map((a) => fanPoint(a, 0.31, 0.01));
    this.embers = this.emitter({
      maxParticles: 200, lifetime: 1.4, lifetimeJitter: 0.4, speed: 0.12, speedJitter: 0.5, spread: 35,
      gravity: -0.18, drag: 0.6, sizeStart: 0.016, sizeEnd: 0.004, sizeJitter: 0.6,
      colorStart: '#fff0c0', colorMid: '#ffa050', colorEnd: '#c03a7a', opacityStart: 0.9, opacityEnd: 0, additive: true,
    });
    this.embers.points.renderOrder = 4;
    this.emberFeed = new PolylineSpawner(this.embers, rim, 16, 0.03);
    this.smoke = this.emitter({
      maxParticles: 60, lifetime: 1.3, lifetimeJitter: 0.3, speed: 0.08, speedJitter: 0.4, spread: 25,
      gravity: -0.12, drag: 1, sizeStart: 0.05, sizeEnd: 0.1, sizeJitter: 0.5, erosion: 0.55, spin: 0.4,
      colorStart: '#3a1a2a', colorEnd: '#10060a', opacityStart: 0.5, opacityEnd: 0, additive: false,
    });
    this.smokeFeed = new PolylineSpawner(this.smoke, S.leafAngles.slice(1, 4).map((a) => fanPoint(a, 0.36, -0.01)), 3.5, 0.03);
  }

  protected reset() {
    this.petals.clear();
    this.burstDone = false;
    this.petalTimer = 0;
  }

  protected animate(t: number, loopT: number, ramp: number, dt: number) {
    const k = this.intensity;
    const f = loopT / PERIOD;
    const beat = wave(loopT, PERIOD, 0.25); // one slow breath per loop: brightest at the start of the loop
    const pivot = S.pivot.clone().setZ(S.pivot.z + 0.01);

    // ignition: the lily blooms open from the pivot, then the fringe grows out
    const bloom = Math.min(1, t / 0.35);
    this.lily.set(pivot, 0.36 * (0.3 + 0.7 * bloom) * (0.94 + 0.06 * beat), (0.8 + 0.2 * beat) * Math.min(1, t / 0.2) * k, 0.25 * Math.sin(TAU * f));
    const pop = t < 0.5 ? 1 + 1.4 * Math.max(0, 1 - Math.abs(t - 0.28) / 0.18) : 1;
    this.flare.streak = 5;
    this.flare.set(pivot.clone().setZ(pivot.z + 0.01), 0.1 * pop * (0.85 + 0.25 * beat) * ramp, (0.75 + 0.25 * beat) * Math.min(1, t / 0.15) * k);
    this.halo.mesh.scale.setScalar(0.32 + 0.03 * beat);
    this.halo.opacity = (0.16 + 0.08 * beat) * ramp * k;
    this.model.rim = (0.35 + 0.2 * wave(loopT, PERIOD, 0.5)) * ramp * k;

    const grow = THREE.MathUtils.smoothstep(t, 0.25, 0.75);
    this.tongues.forEach((o) => {
      const flick = 0.8 + 0.2 * Math.sin(TAU * (f * 2 + o.phase));
      o.pivot.scale.setScalar(Math.max(1e-4, (0.35 + 0.65 * grow) * (0.92 + 0.08 * Math.sin(TAU * (f + o.phase)))));
      o.ribbon.update(loopT, PERIOD, o.cycles, 1);
      o.ribbon.opacity = 0.55 * flick * grow * k;
    });

    // rib-tip glints twinkle in a wave from left to right, once per loop
    this.glints.forEach((g, i) => {
      const tw = Math.max(0, Math.sin(TAU * (f - i / this.glints.length * 0.6))) ** 6;
      g.set(fanPoint(S.ribAngles[i], S.ribTipR + 0.03, 0.01), 0.05 * (0.4 + 0.6 * tw), (0.2 + 0.8 * tw) * ramp * k, 0);
    });

    // petals: a burst on ignition, then one now and then off the rim
    if (!this.burstDone && t >= 0.3) {
      this.petals.emit(pivot, 28, 0.55, 0.25);
      this.burstDone = true;
    }
    this.petalTimer += dt;
    if (t > 1 && this.petalTimer > 0.35) {
      this.petalTimer = 0;
      const a = S.leafAngles[Math.floor(Math.random() * S.leafAngles.length)];
      this.petals.emit(fanPoint(a, 0.33, 0.01), 1, 0.15, 0.1);
    }
    this.petals.update(dt);

    this.emberFeed.rate = 16 * ramp * k;
    this.smokeFeed.rate = 3.5 * ramp;
    this.emberFeed.update(dt);
    this.smokeFeed.update(dt);
  }
}

export const phoenixFanModule = weaponModule('phoenix fan', 'wp-fan-fire', () => new PhoenixFan());
