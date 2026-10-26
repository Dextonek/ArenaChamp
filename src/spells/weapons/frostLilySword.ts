import * as THREE from 'three';
import type { Emitter } from '../../emitter';
import { GlowSphere, createRing } from '../../effects/common';
import { WeaponAura, weaponModule } from '../../effects/weapons/aura';
import { FlowRibbon, LilyBurst, PetalSwarm, PolylineSpawner, StarFlare, TAU, wave } from '../../effects/weapons/kit';
import { SOCKETS } from '../../effects/weapons/sockets';

/**
 * Frost lily sword: the idle enchant of the Ice Sword (wp-sword-ice), after the Spiderlily set (recipes
 * f-spiderlily-gauntlet-ignition, a-lol-ashe-enchanted-crystal-arrow, c-ice-spikes-eruption). The dark crystal
 * blade ignites: frost creeps up both edges, a lily of straight crystal spikes snaps open on the guard hub with a
 * white-ice star and lens streak, glitter sheds from the blade, snowflakes drift down, pale mist falls off the
 * pommel and scroll tips and a frost ring breathes under the weapon. Loops every 4 s.
 */
const S = SOCKETS['wp-sword-ice'];
const PERIOD = 4;
const BLADE_Y0 = S.bladeBase.y;
const BLADE_LEN = S.tip.y - BLADE_Y0;

interface Edge { group: THREE.Group; ribbon: FlowRibbon; phase: number }
interface Mist { ribbon: FlowRibbon; phase: number; cycles: number }

export class FrostLilySword extends WeaponAura {
  private edges: Edge[] = [];
  private mists: Mist[] = [];
  private lily = new LilyBurst(0x8fd8ff, 0xf0fbff, { filaments: 24, curl: 0 });
  private flare = new StarFlare(0xe8f8ff, 0x9fd8ff);
  private tipGlint = new StarFlare(0xffffff, 0xbfeaff);
  private halo = new GlowSphere(0x5ab4ff, { rim: false });
  private ring = createRing(0xbfeaff, 0.9, 1, 96);
  private snow = new PetalSwarm({ count: 60, color: 0xdff4ff, size: 0.02, gravity: 0.06, drag: 1.4, life: 3 });
  private glitter: Emitter;
  private glitterFeed: PolylineSpawner;
  private snowTimer = 0;
  private burstDone = false;

  constructor() {
    super('wp-sword-ice', PERIOD, 0.8, { darken: 0.18, tint: 0x0a1428, tintAmount: 0.4, emissiveMax: 0.6, rim: 0x9fe0ff, rimPower: 2 });

    // edge frost: a ribbon per blade edge, in front (+z) and a mirrored pair behind (-z); each group sits at the
    // blade base and scales up its length so the frost creeps up on ignition
    for (const z of [0.012, -0.012]) {
      for (const x of [-S.bladeHalfWidth, S.bladeHalfWidth]) {
        const pts = [0, 0.33, 0.66, 1].map((u) => new THREE.Vector3(0, BLADE_LEN * u, 0));
        const ribbon = new FlowRibbon({
          points: pts, width: (u) => 0.016 * (1 - 0.5 * u), colors: ['#dff6ff', '#8fd4ff', '#2a78d0'],
          tiling: 3, across: 3, erosion: 0.4, sway: 0.004, swayWaves: 1, intensity: 0.8,
        });
        const group = new THREE.Group();
        group.position.set(x * 0.95, BLADE_Y0, z);
        group.add(ribbon.mesh);
        this.rig.add(group);
        this.edges.push({ group, ribbon, phase: this.edges.length * 0.25 });
      }
    }

    // cold mist: normal-blended, pale to dark blue, falling from the pommel and the two scroll tips
    const roots = [
      { at: S.pommel.clone().add(new THREE.Vector3(0, -0.01, 0)), drift: 0.0, len: 0.42, w: 0.07 },
      { at: S.pommel.clone().add(new THREE.Vector3(0.01, -0.01, 0)), drift: 0.05, len: 0.34, w: 0.05 },
      { at: S.scrollTips[0].clone(), drift: -0.08, len: 0.36, w: 0.06 },
      { at: S.scrollTips[1].clone(), drift: 0.08, len: 0.36, w: 0.06 },
    ];
    roots.forEach((o, i) => {
      const pts = [0, 0.35, 0.7, 1].map((u) => new THREE.Vector3(o.drift * u * u, -o.len * u, 0));
      const ribbon = new FlowRibbon({
        points: pts, width: (u) => o.w * (0.5 + 0.8 * u), colors: ['#8fb8d8', '#4a6a94', '#1a2a4a'],
        tiling: 2, across: 2, erosion: 0.5, sway: 0.04, swayWaves: 1, intensity: 1, additive: false, cross: true,
      });
      ribbon.mesh.position.copy(o.at).setZ(0.004);
      ribbon.mesh.renderOrder = 1;
      this.rig.add(ribbon.mesh);
      this.mists.push({ ribbon, phase: i / roots.length, cycles: 1 });
    });

    // frost ring under the pommel
    this.ring.mesh.position.set(0, -0.22, 0);
    this.ring.mesh.renderOrder = 1;
    this.halo.mesh.position.copy(S.hub);

    this.rig.add(this.ring.mesh, this.halo.mesh, this.lily.group, this.flare.group, this.tipGlint.group, this.snow.mesh);

    // ice glitter shed along the blade
    const blade = [S.bladeBase.clone().setZ(0.01), S.tip.clone().setZ(0.01)];
    this.glitter = this.emitter({
      maxParticles: 120, lifetime: 0.9, lifetimeJitter: 0.4, speed: 0.04, speedJitter: 0.6, spread: 180,
      gravity: -0.03, drag: 0.8, sizeStart: 0.01, sizeEnd: 0.002, sizeJitter: 0.5,
      colorStart: '#ffffff', colorMid: '#bfeaff', colorEnd: '#4aa8ff', opacityStart: 0.9, opacityEnd: 0, additive: true,
    });
    this.glitter.points.renderOrder = 4;
    this.glitterFeed = new PolylineSpawner(this.glitter, blade, 20, 0.025);
  }

  protected reset() {
    this.snow.clear();
    this.burstDone = false;
    this.snowTimer = 0;
  }

  protected animate(t: number, loopT: number, ramp: number, dt: number) {
    const k = this.intensity;
    const f = loopT / PERIOD;
    const beat = wave(loopT, PERIOD, 0.25); // one slow breath per loop
    const hub = S.hub.clone().setZ(0.02);

    // ignition: the lily snaps open on the hub
    const bloom = Math.min(1, t / 0.3);
    this.lily.set(hub, 0.26 * (0.3 + 0.7 * bloom) * (0.95 + 0.05 * beat), (0.75 + 0.2 * beat) * Math.min(1, t / 0.2) * k, 0.3 * Math.sin(TAU * f));
    const pop = t < 0.5 ? 1 + 1.2 * Math.max(0, 1 - Math.abs(t - 0.25) / 0.17) : 1;
    this.flare.streak = 5;
    this.flare.set(S.gemFront.clone().setZ(0.03), 0.1 * pop * (0.85 + 0.25 * beat) * ramp, (0.75 + 0.25 * beat) * Math.min(1, t / 0.15) * k);
    this.halo.mesh.scale.setScalar(0.3 + 0.03 * beat);
    this.halo.opacity = (0.12 + 0.07 * beat) * ramp * k;
    this.model.rim = (0.4 + 0.2 * wave(loopT, PERIOD, 0.5)) * ramp * k;

    // the blade tip glints once per loop
    const tw = Math.max(0, Math.sin(TAU * (f - 0.1))) ** 8;
    this.tipGlint.streak = 4;
    this.tipGlint.set(S.tip.clone().setZ(0.015), 0.05 * (0.5 + 0.7 * tw), (0.15 + 0.85 * tw) * smooth(t, 0.5, 0.9) * k);

    // edge frost creeps up bottom to top over 0.6 s, then flows with whole texture passes per loop
    const creep = smooth(t, 0.1, 0.7);
    this.edges.forEach((e) => {
      e.group.scale.set(1, Math.max(1e-4, creep), 1);
      e.ribbon.update(loopT, PERIOD, 2, 1);
      e.ribbon.opacity = 0.4 * creep * (0.85 + 0.15 * Math.sin(TAU * (f + e.phase))) * k;
    });

    // mist: faint, drifting; slow swell offset per ribbon
    this.mists.forEach((m) => {
      m.ribbon.update(loopT, PERIOD, m.cycles, 1);
      m.ribbon.opacity = 0.32 * smooth(t, 0.3, 1.1) * (0.8 + 0.2 * Math.sin(TAU * (f + m.phase))) * k;
    });

    // frost ring breathes under the pommel
    this.ring.mesh.scale.setScalar(0.16 + 0.015 * Math.sin(TAU * (f + 0.3)));
    this.ring.material.opacity = (0.12 + 0.06 * wave(loopT, PERIOD, 0.55)) * smooth(t, 0.2, 0.8) * k;

    // snowflakes: a burst on ignition, then a few per second round the blade
    if (!this.burstDone && t >= 0.3) {
      this.snow.emit(hub, 20, 0.5, 0.25);
      this.burstDone = true;
    }
    this.snowTimer += dt;
    if (t > 1 && this.snowTimer > 0.3) {
      this.snowTimer = 0;
      const y = BLADE_Y0 + Math.random() * BLADE_LEN;
      const side = Math.random() < 0.5 ? -1 : 1;
      this.snow.emit(new THREE.Vector3(side * (0.05 + Math.random() * 0.08), y, (Math.random() - 0.5) * 0.08), 1, 0.05, 0.02);
    }
    this.snow.update(dt);

    this.glitterFeed.rate = 20 * creep * k;
    this.glitterFeed.update(dt);
  }
}

const smooth = (t: number, a: number, b: number) => THREE.MathUtils.smoothstep(t, a, b);

export const frostLilySwordModule = weaponModule('frost lily sword', 'wp-sword-ice', () => new FrostLilySword());
