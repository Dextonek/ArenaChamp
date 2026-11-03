import * as THREE from 'three';
import { Emitter } from '../../emitter';
import { smoothstep } from '../../effects/common';
import { ShockRefraction, StarBurst, clearScreenFx, createScreenFx, impactFrameAt } from '../../effects/parts';
import {
  DAWN, DAWN_CSS, HaloRing, LightBeams, LightPanels, Sigil, SunEmblems, SunRays, dawnEaseOutBack, dawnFacing, dawnForward, dawnOrient,
  dawnPanelNormal, dawnView, type PanelShape,
} from '../../effects/parts/dawn';
import { BOLT_HEIGHT, type Projectile } from '../../effects/projectile';
import { frameCast, type CastContext } from '../../effects/targeting';
import type { Effect, EffectModule } from '../../effects/types';

/**
 * Radiant Spear (dawn kit, Q: piercing skillshot). Five ivory and gold feather plates and a blade tip click together
 * into a long hard-light spear over Auriel's shoulder (0.2 s) around a glowing core, a sun disc swelling behind it. It
 * leaves as a piercing bolt (`ctx.projectile`) in a sun-disc flare and a ring of light, shedding feather shards along
 * the flight. On a hit a clean pierce flash cuts through the target's back, rays and feathers fan out with a sky-blue
 * star, a small sun-wheel sigil flashes under it, one impact frame, and Auriel gains a small shield. At max range the
 * spear tumbles apart panel by panel. See pipeline/designs/kit-dawn.md.
 */
export interface RadiantSpearSettings {
  damage: number;
  /** Shield Auriel gains when the spear hits (seconds fixed at SHIELD_SECONDS). */
  shield: number;
  loop: boolean;
}

export const defaultRadiantSpear = (): RadiantSpearSettings => ({ damage: 55, shield: 10, loop: false });

// Timeline (seconds).
const ASSEMBLE = 0.2; // the spear is whole and starts to fly
const DURATION = 1.8;
const RANGE = 12;
const SPEED = 24;
const RADIUS = 0.5;
const SHIELD_SECONDS = 4;
const FLIGHT_END = ASSEMBLE + RANGE / SPEED;
const CHEST_Y = 1.25;
const SPEAR = 6;
const SPRAY = 8;
const TRAIL = 8; // feather shards shed along the flight
const TRAIL_BASE = SPEAR + SPRAY + 1;
const UP = new THREE.Vector3(0, 1, 0);
const Z = new THREE.Vector3(0, 0, 1);
// Offsets of the six shards along the spear axis, and their size and width (the last one is the tip).
const OFFS = [-1.56, -0.93, -0.3, 0.33, 0.96, 1.59];
const SIZES = [1.25, 1.25, 1.25, 1.25, 1.25, 1.5];
const WIDES = [1.5, 1.6, 1.6, 1.5, 1.3, 1.25];

export class RadiantSpear implements Effect {
  readonly group = new THREE.Group();
  readonly settings: RadiantSpearSettings;
  readonly emitters: Emitter[] = [];
  readonly screen = createScreenFx();
  shake = 0;
  playing = false;

  /** Last cast; frameCamera and telegraphs read it. Null until the first play(). */
  ctx: CastContext | null = null;
  private time = 0;

  // Cast geometry, computed in cast().
  private from = new THREE.Vector3(0, 0, 14);
  private fwd = new THREE.Vector3(0, 0, -1);
  private right = new THREE.Vector3(1, 0, 0);
  private view = new THREE.Vector3(0, 0.45, 0.9);
  private start = new THREE.Vector3();
  private chest = new THREE.Vector3(0, CHEST_Y, -6);
  private dir = new THREE.Vector3(0, 0, -1);
  private hover = new THREE.Vector3();
  private endC = new THREE.Vector3();
  private ground = new THREE.Vector3();

  private flags = { fired: false, hit: false, ended: false, shielded: false };
  private bolt: Projectile | null = null;
  private launchAge = -1;
  private trailT = 0;
  private trailAt = 0;
  private hitAge = -1;
  private hitAt = new THREE.Vector3();
  private dtLast = 0;

  // Parts.
  private panels = new LightPanels(TRAIL_BASE + TRAIL, 6);
  private core = new LightBeams(1);
  private pierce = new LightBeams(2);
  private emblem = new SunEmblems(1);
  private halo = new HaloRing();
  private rays = new SunRays(12, 0.5);
  private flare = new StarBurst({ points: 12, inner: 0.25, color: DAWN.hot, core: DAWN.core, additive: false });
  private sigil = new Sigil();
  private star = new StarBurst({ points: 10, inner: 0.3, color: DAWN.accent, core: DAWN.accent, additive: false });
  private groundShock = new ShockRefraction({ facing: 'ground' });

  // Scratch.
  private v1 = new THREE.Vector3();
  private v2 = new THREE.Vector3();
  private v3 = new THREE.Vector3();
  private v4 = new THREE.Vector3();
  private q1 = new THREE.Quaternion();
  private q2 = new THREE.Quaternion();

  constructor(settings: RadiantSpearSettings = defaultRadiantSpear()) {
    this.settings = settings;
    this.screen.tint.set(DAWN.dark);
    this.screen.impactColor.set(DAWN.foil);
    this.group.add(
      this.sigil.mesh, this.panels.mesh, this.core.mesh, this.pierce.mesh, this.emblem.mesh, this.halo.mesh, this.rays.mesh, this.flare.mesh,
      this.star.mesh, this.groundShock.mesh,
    );
    this.reset();
  }

  get duration() {
    return DURATION;
  }

  get impactTime() {
    return ASSEMBLE;
  }

  /** Seconds until the bolt has flown its full range (the telegraph's last moment). */
  get flightEnd() {
    return FLIGHT_END;
  }

  cast(ctx: CastContext) {
    this.ctx = ctx;
    this.from.copy(ctx.from).setY(0);
    dawnForward(ctx.aim, this.fwd);
    dawnFacing(ctx.aim, this.v1);
    this.right.crossVectors(UP, this.v1).normalize();
    dawnView(ctx.aim, this.view);
    // A skillshot: it flies along the aim line, whoever stands on it.
    this.dir.set(Math.sin(ctx.aim), 0, Math.cos(ctx.aim));
    this.chest.copy(this.from).addScaledVector(this.dir, RANGE * 0.5).setY(CHEST_Y);
    this.ground.set(this.chest.x, 0, this.chest.z);
    this.start.copy(this.from).addScaledVector(this.right, 0.55).addScaledVector(this.fwd, 0.2).setY(2.0);
    this.hover.copy(this.start).addScaledVector(this.dir, 1.1);
    this.rays.face(ctx.aim);
    this.endC.copy(this.chest);
    this.screen.focus.copy(this.chest);
    this.screen.silhouettes = [ctx.caster.group, ...ctx.targets.map((e) => e.group), this.panels.mesh];
    this.groundShock.set(this.ground, 0, 0);
  }

  play() {
    this.reset();
    this.playing = true;
    this.layout();
    this.panels.assemble(0.12, 0.07, 4.5);
  }

  private reset() {
    this.time = 0;
    this.shake = 0;
    this.flags.fired = this.flags.hit = this.flags.ended = this.flags.shielded = false;
    this.bolt = null;
    this.hitAge = -1;
    this.launchAge = -1;
    this.trailT = 0;
    this.trailAt = 0;
    clearScreenFx(this.screen);
    this.screen.impactColor.set(DAWN.foil);
    this.panels.reset();
    this.sigil.reset();
    this.core.reset();
    this.pierce.reset();
    this.emblem.reset();
    this.halo.reset();
    this.rays.reset();
    this.flare.set(this.chest, 1e-3, 0);
    this.star.set(this.chest, 1e-3, 0);
    this.groundShock.set(this.ground, 0, 0);
  }

  update(dt: number) {
    for (const e of this.emitters) e.update(dt);
    if (!this.playing) return;
    this.time += dt;
    this.dtLast = dt;
    if (this.time >= DURATION) {
      const loop = this.settings.loop;
      this.reset();
      this.playing = false;
      this.shake = 0;
      if (loop) this.play();
      return;
    }
    const t = this.time;
    const f = this.flags;
    const ctx = this.ctx;

    if (!f.fired && t >= ASSEMBLE) {
      f.fired = true;
      this.launchAge = 0;
      this.shake = Math.max(this.shake, 0.1);
      // A network duel has no bolts (the context leaves `projectile` out): the spear then just tumbles apart.
      if (ctx?.projectile) {
        this.v1.copy(this.hover).setY(0);
        this.bolt = ctx.projectile({
          from: this.v1.clone(), dir: this.dir.clone(), speed: SPEED, range: RANGE, radius: RADIUS, pierce: true,
          hit: { damage: this.settings.damage, knock: 3, color: DAWN_CSS.body },
        });
        this.bolt.onHit((_target, at) => this.onHit(at));
      }
    }

    this.layout();
    this.panels.update(dt);
  }

  /** A hit: the shield, and a spray of small panels fans out of the target's back (the spear flies on). */
  private onHit(at: THREE.Vector3) {
    const f = this.flags;
    if (!f.shielded) {
      f.shielded = true;
      this.ctx?.shieldSelf?.(this.settings.shield, SHIELD_SECONDS, DAWN_CSS.body);
    }
    if (this.hitAge >= 0) return; // one burst per cast; later targets still take the damage
    f.hit = true;
    this.hitAge = 0;
    this.hitAt.set(at.x, CHEST_Y, at.z);
    this.ground.set(at.x, 0, at.z);
    this.screen.focus.copy(this.hitAt);
    this.shake = 0.3;
    this.burst();
  }

  /** The spray: a fan of smaller panels thrown out of the target's back. */
  private burst() {
    const shapes: PanelShape[] = ['feather', 'shard', 'feather', 'hex'];
    const base = this.v1.copy(this.hitAt).addScaledVector(this.dir, 0.9);
    dawnPanelNormal(this.dir, this.view, this.v2);
    this.v3.crossVectors(this.dir, this.v2).normalize(); // sideways in the panel plane
    for (let k = 0; k < SPRAY; k++) {
      const spread = ((k / (SPRAY - 1)) * 2 - 1) * 0.95 + (Math.random() - 0.5) * 0.2;
      const lift = (Math.random() - 0.3) * 0.8;
      const vel = new THREE.Vector3()
        .copy(this.dir).multiplyScalar(Math.cos(spread) * (7 + Math.random() * 3))
        .addScaledVector(this.v3, Math.sin(spread) * (7 + Math.random() * 3));
      vel.y += 2.2 + lift * 2;
      const shape = shapes[k % shapes.length];
      this.panels.place(SPEAR + k, base, dawnOrient(this.v2, vel, this.q1), shape === 'hex' ? 0.9 : 1.5, shape, shape === 'shard' ? 1.2 : 1);
      this.panels.fling(SPEAR + k, vel, 0.85 + Math.random() * 0.08, 10);
    }
    this.panels.hide(SPEAR + SPRAY);
  }

  /** The spear itself tumbles apart (max range, a pillar). */
  private scatterSpear() {
    this.flags.ended = true;
    this.v3.set(-this.dir.z, 0, this.dir.x);
    for (let k = 0; k < SPEAR; k++) {
      const spread = (Math.random() - 0.5) * 1.1;
      const vel = new THREE.Vector3()
        .copy(this.dir).multiplyScalar(Math.cos(spread) * (5 + Math.random() * 3))
        .addScaledVector(this.v3, Math.sin(spread) * (5 + Math.random() * 3));
      vel.y += 1.2 + Math.random() * 2;
      this.panels.fling(k, vel, 0.8 + Math.random() * 0.1, 8);
    }
  }

  private layout() {
    const t = this.time;
    const f = this.flags;

    // --- 0..0.2 the spear forms over the shoulder around its glowing core, a sun disc swelling behind it; then it rides the bolt. ---
    if (!f.fired) {
      this.v1.copy(this.hover);
      this.placeSpear(this.v1, smoothstep(t / ASSEMBLE));
      const k = smoothstep(t / ASSEMBLE);
      this.placeEmblem(this.v1, 0.4 + 1.1 * dawnEaseOutBack(k) , 0.5 * t * 6);
      this.halo.opacity = 0;
    } else if (!f.ended) {
      const b = this.bolt;
      if (b && b.alive) {
        // The first few hundredths glide down from the shoulder to bolt height.
        const k = Math.min(1, (t - ASSEMBLE) / 0.1);
        this.v1.set(b.pos.x, BOLT_HEIGHT + 0.15, b.pos.z);
        this.v1.lerp(this.hover, (1 - k) * (1 - k));
        this.placeSpear(this.v1, 1);
        // A gold streak trailing behind the flying spear.
        this.v3.copy(this.v1).addScaledVector(this.dir, -3.2);
        this.panels.place(SPEAR + SPRAY, this.v3, this.q1, 1.4, 'shard', 1.8, DAWN.body);
        this.shedFeathers(this.v1);
      } else {
        this.panels.hide(SPEAR + SPRAY);
        this.core.hide(0);
        this.scatterSpear();
      }
    }

    // --- Launch: the sun disc flares and a ring of light opens around the spear's tail. ---
    if (this.launchAge >= 0) {
      const a = this.launchAge;
      this.launchAge += this.dtLast;
      const u = smoothstep(a / 0.32);
      this.emblem.opacity = 1 - u;
      if (a < 0.32) this.placeEmblem(this.hover, 1.5 + 1.8 * u, 0.5 * a * 6 + 1.2);
      else this.emblem.hide(0);
      const sp = StarBurst.pop(a, 0.02, 0.1);
      this.flare.set(this.hover, 1.7 * sp.scale + 1e-3, sp.opacity, 0.15);
      this.halo.set(this.hover, this.dir, 0.5 + 2.2 * u);
      this.halo.opacity = 0.85 * (1 - u);
      this.halo.spin(this.dtLast);
    }

    // --- Sun-wheel sigil flash under the target, ground refraction, sky-blue star, pierce flash, impact frame. ---
    if (this.hitAge >= 0) {
      const after = this.hitAge;
      this.hitAge += this.dtLast;
      this.screen.impact = impactFrameAt(after, 0, [1], 0.03);
      this.sigil.set(this.ground, 1.9);
      this.sigil.reveal = 1;
      this.sigil.opacity = 1 - smoothstep(after / 0.55);
      const sp = StarBurst.pop(after, 0, 0.03);
      this.star.set(this.hitAt, 1.0 * sp.scale + 1e-3, sp.opacity, 0.2);
      const gp = THREE.MathUtils.clamp(after / 0.3, 0, 1);
      this.groundShock.set(this.ground, 0.5 + 3 * gp, 0.03 * (1 - gp) * (1 - gp));
      this.shake = 0.3 * Math.exp(-after * 10);
      // The pierce: a needle of light along the spear's line through the target, then a thin cross flash.
      const pk = THREE.MathUtils.clamp(after / 0.22, 0, 1);
      dawnPanelNormal(this.dir, this.view, this.v2);
      this.v1.copy(this.hitAt).addScaledVector(this.dir, 0.6);
      this.pierce.opacity = 1 - pk * pk;
      this.pierce.bright = 2.2;
      this.pierce.set(0, this.v1, this.dir, this.v2, 2.5 + 8 * smoothstep(pk * 2), 0.34 * (1 - pk));
      this.v3.crossVectors(this.dir, this.v2).normalize();
      this.pierce.set(1, this.hitAt, this.v3, this.v2, 1.2 + 3.4 * smoothstep(pk * 1.6), 0.2 * (1 - pk));
      // Sun rays fan out of the wound.
      dawnPanelNormal(this.dir, this.view, this.v2);
      this.v3.copy(UP).addScaledVector(this.rays.normal, -UP.dot(this.rays.normal)).normalize();
      this.rays.fan(this.hitAt, this.v3, 12, 3.4, Math.PI, smoothstep(after / 0.12), 0.32);
      this.rays.fade(1 - smoothstep((after - 0.05) / 0.3));
    }
  }

  /** Six plates along the dir axis centred on `c`: five feathers and a blade tip, around a glowing core needle. */
  private placeSpear(c: THREE.Vector3, form: number) {
    dawnPanelNormal(this.dir, this.view, this.v2);
    dawnOrient(this.v2, this.dir, this.q1);
    for (let i = 0; i < SPEAR; i++) {
      this.v3.copy(c).addScaledVector(this.dir, OFFS[i]);
      const tip = i === SPEAR - 1;
      this.panels.place(
        i, this.v3, this.q1, SIZES[i], tip ? 'shard' : 'feather', WIDES[i], tip ? DAWN.foil : i % 2 === 0 ? DAWN.foil : DAWN.hot,
      );
    }
    // The glowing core: a white-hot needle through the plates, pulsing a little in flight.
    this.core.opacity = form;
    this.core.bright = 1.8 + 0.5 * Math.sin(this.time * 40);
    this.v3.copy(c).addScaledVector(this.dir, 0.1);
    this.core.set(0, this.v3, this.dir, this.v2, 3.9 * (0.4 + 0.6 * form), 0.16 * form);
  }

  /** The sun-disc emblem standing behind the spear, facing the camera. */
  private placeEmblem(c: THREE.Vector3, size: number, spin: number) {
    this.v3.copy(c).addScaledVector(this.view, -0.15);
    dawnOrient(this.view, this.dir, this.q1);
    this.q1.multiply(this.q2.setFromAxisAngle(Z, spin));
    this.emblem.set(0, this.v3, this.q1, size);
  }

  /** Feather shards come loose from the spear's tail as it flies. */
  private shedFeathers(c: THREE.Vector3) {
    if (this.time < this.trailAt) return;
    this.trailAt = this.time + 0.045;
    const i = TRAIL_BASE + (this.trailT++ % TRAIL);
    dawnPanelNormal(this.dir, this.view, this.v2);
    this.v3.crossVectors(this.dir, this.v2).normalize();
    const side = (Math.random() - 0.5) * 2;
    this.v4.copy(c).addScaledVector(this.dir, -1.2 - Math.random() * 1.2).addScaledVector(this.v3, side * 0.25);
    dawnOrient(this.v2, this.dir, this.q1);
    this.panels.place(i, this.v4, this.q1, 0.75 + Math.random() * 0.35, 'feather', 1, Math.random() < 0.5 ? DAWN.foil : DAWN.hot);
    const vel = this.v4.copy(this.dir).multiplyScalar(-1.5 - Math.random() * 2).addScaledVector(this.v3, side * 2.6);
    vel.y += 0.8 + Math.random() * 1.2;
    this.panels.fling(i, vel, 0.4 + Math.random() * 0.15, 6);
  }
}

export const radiantSpearModule: EffectModule = {
  label: 'radiant spear',
  category: 'hero: dawn',
  // A skillshot is aimed at a spot (the ground point or the target's feet); `radius` only sizes the aim marker.
  targeting: { mode: 'ground', radius: RADIUS },
  create: () => new RadiantSpear(),
  telegraphs(effect) {
    const e = effect as RadiantSpear;
    const ctx = e.ctx;
    if (!ctx) return [];
    const d = { x: Math.sin(ctx.aim), z: Math.cos(ctx.aim) };
    // Armed at the launch, then shown until the bolt has passed; a bolt's hit is the dodge check, not the zone.
    return [{
      shape: { kind: 'line', x1: ctx.from.x, z1: ctx.from.z, x2: ctx.from.x + d.x * RANGE, z2: ctx.from.z + d.z * RANGE, width: RADIUS * 2 },
      start: 0, impact: ASSEMBLE, until: e.flightEnd,
    }];
  },
  bloom: { enabled: true, strength: 0.4, radius: 0.35, threshold: 0.88 },
  frameCamera(camera, controls, effect) {
    const e = effect as RadiantSpear;
    if (e.ctx) frameCast(camera, controls, e.ctx, 3);
  },
  buildGui(f, effect) {
    const s = (effect as RadiantSpear).settings;
    f.add(s, 'loop');
    f.add(s, 'damage', 1, 150, 1);
    f.add(s, 'shield', 0, 80, 1);
  },
};
