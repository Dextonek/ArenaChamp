import * as THREE from 'three';
import { Emitter, defaultSettings } from '../../emitter';
import { GlowSphere, createRing, smoothstep } from '../../effects/common';
import {
  CrescentArc, StarBurst, chromaPulse, clearScreenFx, createScreenFx, flashBeat,
} from '../../effects/parts';
import { frameCast, type CastContext } from '../../effects/targeting';
import type { Effect, EffectModule } from '../../effects/types';

/**
 * Prism Overture (targeted, ground AoE): a monochrome ink-and-light move. The caster's orb shrinks to a speck, a thin
 * black-and-white ink tendril climbs from the aim point while pink / teal fringes flick at the screen edges, two white
 * hooks knot at its top and swell into a white star-puff over a flat disc with a rainbow rim. Everything collapses to
 * grey haze, ONE frame is darker than normal (anti-flash), then the screen blows out white with an RGB split. A tunnel
 * of white shards and black slivers, a thin glass bubble full of prism flakes, a flat white flare and a crown of
 * spikes follow, then a forest of tall white wisps sways with iridescent ribbons and curling ring trails.
 *
 * Built from the recipe i-chromatic-ink-charge-prism-burst (frame log youtube-i/V-zNBHnx1kY.md, 5.3-9.1 s).
 */
export interface PrismOvertureSettings {
  damage: number;
  loop: boolean;
}

export const defaultPrismOverture = (): PrismOvertureSettings => ({ damage: 50, loop: false });

const DURATION = 4.2;
const HIT = 1.7;
const WISPS = 14;
const SPIKES = 16;
const CHIPS = 6;
const PINK = new THREE.Color(0xff5ab4);
const TEAL = new THREE.Color(0x4ff0e0);
const PASTELS = [0xffb0d8, 0xb0f0ff, 0xfff2a8, 0xc8b0ff, 0xb0ffd0, 0xffc8a0];

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const easeOut = (x: number) => 1 - Math.pow(1 - clamp01(x), 3);

export class PrismOverture implements Effect {
  readonly group = new THREE.Group();
  readonly settings: PrismOvertureSettings;
  readonly emitters: Emitter[] = [];
  readonly screen = createScreenFx();
  shake = 0;
  playing = false;

  /** Last cast; frameCamera and telegraphs read it. Null until the first play(). */
  ctx: CastContext | null = null;
  private time = 0;
  private hitDone = false;
  private hazeDone = false;
  private burstDone = false;
  private popDone = false;

  private point = new THREE.Vector3();
  private chest = new THREE.Vector3(0, 1.6, 14);
  private hitSrc = new THREE.Vector3();

  // Charge.
  private orb = new GlowSphere(0xe8f0ff, { rim: false });
  private hooks: CrescentArc[] = [];
  private hookPlanes: THREE.Group[] = [];

  // Star-puff, rainbow disc, chips.
  private puff = new StarBurst({ points: 8, inner: 0.5, jitter: 0.12, color: 0xffffff, core: 0xf4f4f8, additive: false });
  private disc = createRing(0xffffff, 0, 1, 96);
  private rainbow = [0xff4a4a, 0xffd84a, 0x4ff0e0, 0xa46aff].map((c) => createRing(c, 0.94, 1, 96));
  private chips: StarBurst[] = [];
  private chipSeed = Array.from({ length: CHIPS }, (_, i) => ({ a: (i / CHIPS) * Math.PI * 2, r: 0.7 + (i % 3) * 0.35, h: 0.2 + (i % 2) * 0.5 }));

  // Release.
  private flash = new GlowSphere(0xffffff, { rim: false });
  private shock = createRing(0xffffff, 0.92, 1, 96);
  private bubble = new GlowSphere(0xe8f8ff, { rim: true });
  private bubbleRings = [createRing(0xffffff, 0.975, 1, 96), createRing(0xcfeaff, 0.975, 1, 96)];
  private flare = createRing(0xffffff, 0, 1, 96);
  private spikeMat = new THREE.MeshStandardMaterial({ color: 0xf0f0f4, roughness: 0.6, flatShading: true, emissive: 0xffffff, emissiveIntensity: 0.6 });
  private spikes: THREE.InstancedMesh;
  private spikeSeed = Array.from({ length: SPIKES }, (_, i) => ({
    a: (i / SPIKES) * Math.PI * 2 + Math.random() * 0.2,
    r: 1.3 + Math.random() * 1.1,
    h: 1.5 + Math.random() * 1.6,
    w: 0.14 + Math.random() * 0.08,
  }));

  // Aftermath.
  private wispPlanes: THREE.Group[] = [];
  private wisps: CrescentArc[] = [];
  private wispSeed = Array.from({ length: WISPS }, (_, i) => ({
    a: (i / WISPS) * Math.PI * 2 + Math.random() * 0.25,
    r: 1.2 + Math.random() * 1.7,
    delay: Math.random() * 0.25,
    sway: Math.random() * Math.PI * 2,
  }));
  private ribbonPlanes: THREE.Group[] = [];
  private ribbons: CrescentArc[] = [];
  private trails: CrescentArc[] = [];

  // Emitters.
  private ink: Emitter;
  private inkEdge: Emitter;
  private haze: Emitter;
  private tunnelWhite: Emitter;
  private tunnelBlack: Emitter;
  private flakes: Emitter;
  private flecks: Emitter;
  private dust: Emitter;

  private tmpM = new THREE.Matrix4();
  private tmpQ = new THREE.Quaternion();
  private tmpQ2 = new THREE.Quaternion();
  private tmpS = new THREE.Vector3();
  private tmpP = new THREE.Vector3();
  private tmpV = new THREE.Vector3();
  private readonly UP = new THREE.Vector3(0, 1, 0);
  private readonly AX = new THREE.Vector3(1, 0, 0);

  constructor(settings: PrismOvertureSettings = defaultPrismOverture()) {
    this.settings = settings;
    this.screen.tint.set(0x303034);
    this.screen.whiteColor.set(0xffffff);
    this.screen.speedLineColor.set(0xffffff);
    this.screen.edgeTint.copy(PINK);

    this.orb.color.set(0xe8f0ff);
    this.group.add(this.orb.mesh, this.puff.mesh, this.disc.mesh, this.flash.mesh, this.shock.mesh, this.bubble.mesh, this.flare.mesh);
    for (const r of this.rainbow) this.group.add(r.mesh);
    for (const r of this.bubbleRings) this.group.add(r.mesh);

    for (let i = 0; i < 2; i++) {
      const plane = new THREE.Group();
      const arc = new CrescentArc({ radius: 0.9, width: 0.18, style: 'soft', edge: 0xffffff, mid: 0xe8e8f0, outer: 0x707078, sweep: Math.PI * 1.5 });
      plane.add(arc.mesh);
      this.hookPlanes.push(plane);
      this.hooks.push(arc);
      this.group.add(plane);
    }
    for (let i = 0; i < CHIPS; i++) {
      const c = new StarBurst({ points: 4, inner: 0.15, jitter: 0, color: PASTELS[i % PASTELS.length], core: 0xffffff, additive: false });
      this.chips.push(c);
      this.group.add(c.mesh);
    }

    const coneGeo = new THREE.ConeGeometry(1, 1, 5);
    coneGeo.translate(0, 0.5, 0);
    this.spikes = new THREE.InstancedMesh(coneGeo, this.spikeMat, SPIKES);
    this.spikes.frustumCulled = false;
    this.group.add(this.spikes);

    // Wisps: near-straight tall arcs. The arc starts at local (R, 0) heading up, so the plane sits R to the side.
    for (let i = 0; i < WISPS; i++) {
      const plane = new THREE.Group();
      const R = 5 + (i % 4);
      const arc = new CrescentArc({ radius: R, width: 0.3 + (i % 3) * 0.08, style: 'soft', edge: 0xffffff, mid: 0xf0f0ff, outer: 0x9090a0, sweep: 0.5 + (i % 5) * 0.06 });
      arc.mesh.position.x = -R;
      plane.add(arc.mesh);
      this.wispPlanes.push(plane);
      this.wisps.push(arc);
      this.group.add(plane);
    }
    for (let i = 0; i < 2; i++) {
      const plane = new THREE.Group();
      const arc = new CrescentArc({ radius: 2.1 + i * 0.5, width: 0.5, style: 'soft', edge: 0xff9ad8, mid: 0x9af0ff, outer: 0xc8b0ff, sweep: Math.PI * 1.6 });
      plane.add(arc.mesh);
      this.ribbonPlanes.push(plane);
      this.ribbons.push(arc);
      this.group.add(plane);
    }
    for (let i = 0; i < 3; i++) {
      const arc = new CrescentArc({ radius: 1, width: 0.12, style: 'soft', edge: 0xffffff, mid: 0xe0e0ea, outer: 0x808090, sweep: Math.PI * 1.4 });
      arc.mesh.rotation.x = -Math.PI / 2;
      this.trails.push(arc);
      this.group.add(arc.mesh);
    }

    const base = defaultSettings();
    this.ink = new Emitter({
      ...base, maxParticles: 900, rate: 0, lifetime: 0.9, lifetimeJitter: 0.4,
      shape: 'sphere', shapeSize: 0.08, speed: 0.5, speedJitter: 0.6, spread: 60, gravity: -0.6, drag: 1.2,
      sizeStart: 0.22, sizeEnd: 0.1, colorStart: '#202024', colorEnd: '#050507', opacityStart: 0.85, opacityEnd: 0,
      additive: false, sizeJitter: 0.4, erosion: 0.6, spin: 0.5,
    });
    this.inkEdge = new Emitter({
      ...base, maxParticles: 600, rate: 0, lifetime: 0.6, lifetimeJitter: 0.4,
      shape: 'sphere', shapeSize: 0.14, speed: 0.4, speedJitter: 0.6, spread: 90, gravity: -0.4, drag: 1.5,
      sizeStart: 0.1, sizeEnd: 0.03, colorStart: '#ffffff', colorEnd: '#c0c0cc', opacityStart: 0.7, opacityEnd: 0,
      additive: true, sizeJitter: 0.4, erosion: 0,
    });
    this.haze = new Emitter({
      ...base, maxParticles: 400, rate: 0, lifetime: 0.7, lifetimeJitter: 0.4,
      shape: 'sphere', shapeSize: 0.6, speed: 1.2, speedJitter: 0.6, spread: 180, gravity: 0, drag: 2,
      sizeStart: 0.9, sizeEnd: 0.3, colorStart: '#a8a8b0', colorEnd: '#4a4a52', opacityStart: 0.55, opacityEnd: 0,
      additive: false, sizeJitter: 0.4, erosion: 0.5, spin: 0.4,
    });
    this.tunnelWhite = new Emitter({
      ...base, maxParticles: 900, rate: 0, lifetime: 0.4, lifetimeJitter: 0.4,
      shape: 'sphere', shapeSize: 0.3, speed: 28, speedJitter: 0.5, spread: 180, gravity: 0, drag: 3.5,
      sizeStart: 0.2, sizeEnd: 0.03, colorStart: '#ffffff', colorEnd: '#d8d8e8', opacityStart: 1, opacityEnd: 0,
      additive: true, sizeJitter: 0.4, erosion: 0,
    });
    this.tunnelBlack = new Emitter({
      ...base, maxParticles: 600, rate: 0, lifetime: 0.5, lifetimeJitter: 0.4,
      shape: 'sphere', shapeSize: 0.3, speed: 22, speedJitter: 0.6, spread: 180, gravity: 4, drag: 3,
      sizeStart: 0.28, sizeEnd: 0.06, colorStart: '#101014', colorEnd: '#000000', opacityStart: 0.95, opacityEnd: 0,
      additive: false, sizeJitter: 0.5, erosion: 0.2, spin: 1,
    });
    this.flakes = new Emitter({
      ...base, maxParticles: 400, rate: 0, lifetime: 0.5, lifetimeJitter: 0.4,
      shape: 'sphere', shapeSize: 1.4, speed: 2.5, speedJitter: 0.6, spread: 180, gravity: 0.5, drag: 1.2,
      sizeStart: 0.16, sizeEnd: 0.05, colorStart: '#ffb0d8', colorMid: '#b0f0ff', colorEnd: '#fff2a8', opacityStart: 0.95, opacityEnd: 0,
      additive: true, sizeJitter: 0.5, erosion: 0,
    });
    this.flecks = new Emitter({
      ...base, maxParticles: 200, rate: 0, lifetime: 0.9, lifetimeJitter: 0.5,
      shape: 'sphere', shapeSize: 1.2, speed: 3, speedJitter: 0.7, spread: 120, gravity: 3, drag: 0.8,
      sizeStart: 0.1, sizeEnd: 0.03, colorStart: '#7aff9a', colorEnd: '#3a9a5a', opacityStart: 0.9, opacityEnd: 0,
      additive: true, sizeJitter: 0.4, erosion: 0,
    });
    this.dust = new Emitter({
      ...base, maxParticles: 500, rate: 0, lifetime: 1.2, lifetimeJitter: 0.4,
      shape: 'sphere', shapeSize: 1.8, speed: 2.2, speedJitter: 0.6, spread: 100, gravity: -0.2, drag: 1.6,
      sizeStart: 0.8, sizeEnd: 0.4, colorStart: '#8a8a92', colorEnd: '#3e3e44', opacityStart: 0.45, opacityEnd: 0,
      additive: false, sizeJitter: 0.4, erosion: 0.5, spin: 0.4, groundFade: 0.3,
    });
    this.emitters.push(this.ink, this.inkEdge, this.haze, this.tunnelWhite, this.tunnelBlack, this.flakes, this.flecks, this.dust);
    for (const e of this.emitters) this.group.add(e.points);
    this.reset();
  }

  get duration() {
    return DURATION;
  }

  get impactTime() {
    return HIT;
  }

  cast(ctx: CastContext) {
    this.ctx = ctx;
    this.point.copy(ctx.point).setY(0);
    this.chest.copy(ctx.from).setY(1.6);
    this.hitSrc.copy(this.point);
    this.screen.silhouettes = [ctx.caster.group, ...ctx.targets.map((e) => e.group)];
    this.screen.focus.copy(this.point).setY(1.2);
    this.hookPlanes.forEach((p, i) => {
      p.position.set(this.point.x, 3, this.point.z);
      p.rotation.set(Math.PI / 2 + 0.3, i * 2.2, 0);
    });
    this.wispPlanes.forEach((p, i) => {
      const s = this.wispSeed[i];
      p.position.set(this.point.x + Math.sin(s.a) * s.r, 0, this.point.z + Math.cos(s.a) * s.r);
      p.rotation.set(0, s.a + Math.PI / 2, 0);
    });
    this.ribbonPlanes.forEach((p, i) => {
      p.position.set(this.point.x, 1.6, this.point.z);
      p.rotation.set(Math.PI / 2 - 0.5 + i * 0.9, i * 1.4, 0);
    });
  }

  play() {
    this.reset();
    this.playing = true;
  }

  private reset() {
    this.time = 0;
    this.hitDone = false;
    this.hazeDone = false;
    this.burstDone = false;
    this.popDone = false;
    this.shake = 0;
    clearScreenFx(this.screen);
    for (const e of this.emitters) e.clear();
    this.layout(0);
  }

  update(dt: number) {
    for (const e of this.emitters) e.update(dt);
    if (!this.playing) return;
    this.time += dt;
    if (this.time >= DURATION) {
      if (this.settings.loop) { this.play(); return; }
      this.playing = false;
      clearScreenFx(this.screen);
      this.time = DURATION;
    }
    if (!this.hazeDone && this.time >= 1.6) {
      this.hazeDone = true;
      this.haze.burst(70, this.tmpP.copy(this.point).setY(1.6));
    }
    if (!this.hitDone && this.time >= HIT) this.onHit();
    if (!this.burstDone && this.time >= 1.75) this.onBurst();
    if (!this.popDone && this.time >= 2.1) {
      this.popDone = true;
      this.flakes.burst(120, this.tmpP.copy(this.point).setY(1.3));
    }
    this.layout(dt);
  }

  private layout(dt: number) {
    const t = this.time;
    const P = this.point;
    const after = t - HIT;
    const live = this.playing || t > 0;

    // --- Screen: dim grey world, flicking pink / teal fringes, anti-flash -> white blowout, chroma pulses. ---
    const dark = t < HIT ? 0.5 * smoothstep(t / 0.5) : 0.5 * (1 - smoothstep((t - HIT) / 0.5));
    this.screen.darken = live ? dark : 0;
    const ramp = t > 0.4 && t < HIT ? 0.35 * smoothstep((t - 0.4) / 0.6) : 0;
    const flick = Math.floor(t / 0.2) % 2 === 0;
    const blowFlick = Math.floor(after / 0.08) % 2 === 0;
    this.screen.edgeTint.copy(t < HIT ? (flick ? PINK : TEAL) : blowFlick ? PINK : TEAL);
    this.screen.chroma = Math.max(ramp, t >= HIT ? chromaPulse(t, HIT, 1, 6) : 0, t >= 2.1 ? chromaPulse(t, 2.1, 0.4, 9) : 0);
    const fb = flashBeat(t, HIT, 0.05, 0.35);
    this.screen.exposure = fb.exposure;
    this.screen.whiteout = fb.whiteout;
    this.screen.speedLines = after >= 0 && after < 0.12 ? 1 : 0;

    // --- Caster orb: small soft white, shrinks to a speck. ---
    const orbS = Math.max(1e-3, 0.55 * (1 - smoothstep(t / 0.5)) + 0.04);
    this.orb.mesh.position.copy(this.chest);
    this.orb.mesh.scale.setScalar(orbS);
    this.orb.opacity = t < 0.5 ? 0.8 : 0.8 * (1 - smoothstep((t - 0.5) / 0.2));

    // --- Ink tendril: dark smoke with white edges climbs ~3 m from the point. ---
    const climb = smoothstep((t - 0.4) / 1.0);
    if (dt > 0 && t > 0.4 && t < 1.45) {
      const y = 0.1 + 2.9 * climb;
      const wob = 0.25 * Math.sin(t * 9) * climb;
      this.tmpV.set(P.x + wob, y, P.z + 0.2 * Math.cos(t * 7) * climb);
      this.ink.burst(5, this.tmpV);
      this.inkEdge.burst(3, this.tmpV);
    }
    // Two white hook strands curl round the top of the tendril and knot.
    this.hooks.forEach((arc, i) => {
      const k = smoothstep((t - 0.75) / 0.6);
      const knot = smoothstep((t - 1.2) / 0.3);
      const out = t > 1.5 ? 1 - smoothstep((t - 1.5) / 0.1) : 1;
      this.hookPlanes[i].position.set(P.x, 0.4 + 2.6 * climb, P.z);
      arc.mesh.scale.setScalar(Math.max(1e-3, (0.6 + 0.5 * k) * (1 - 0.55 * knot)));
      arc.mesh.rotation.z = t * (5 + i * 2) * (i ? -1 : 1) + i * 3;
      arc.head = 1.1;
      arc.length = 0.35 + 0.6 * k;
      arc.erosion = 0;
      arc.time = t;
      arc.opacity = k > 0 ? 0.9 * out : 0;
    });

    // --- Star-puff, rainbow-rim disc, prism chips (1.45 -> 1.6, collapsing). ---
    const bloom = easeOut((t - 1.45) / 0.15);
    const coll = smoothstep((t - 1.6) / 0.1);
    const pre = t >= 1.45 && t < HIT ? 1 : 0;
    const puffS = 1.4 * bloom * (1 - coll);
    this.puff.set(this.tmpV.set(P.x, 3.0, P.z), puffS, pre && puffS > 0.02 ? 1 : 0, t * 0.6);
    this.disc.mesh.position.set(P.x, 0.05, P.z);
    this.disc.mesh.scale.setScalar(Math.max(1e-3, 2.4 * bloom * (1 - 0.8 * coll)));
    this.disc.material.opacity = pre * 0.7 * (1 - coll);
    this.rainbow.forEach((r, i) => {
      r.mesh.position.set(P.x, 0.055 + i * 0.002, P.z);
      r.mesh.scale.setScalar(Math.max(1e-3, (2.4 + i * 0.1) * bloom * (1 - 0.8 * coll)));
      r.material.opacity = pre * 0.85 * (1 - coll);
    });
    this.chips.forEach((c, i) => {
      const s = this.chipSeed[i];
      const k = pre * (1 - coll);
      this.tmpV.set(P.x + Math.cos(s.a + t * 2) * s.r * 1.6 * bloom, 2.4 + s.h * 2 * bloom, P.z + Math.sin(s.a + t * 2) * s.r * 1.6 * bloom);
      c.set(this.tmpV, 0.45 * bloom * (1 - coll), k > 0.01 ? 1 : 0, t * 3 + i);
    });

    // --- Blowout: white sphere for one beat, shock ring, then the bubble, flare and spikes. ---
    this.flash.mesh.position.set(P.x, 1.3, P.z);
    this.flash.mesh.scale.setScalar(3 + Math.max(0, after) * 18);
    this.flash.opacity = after >= 0 ? 0.9 * Math.exp(-after * 12) : 0;
    this.shock.mesh.position.set(P.x, 0.06, P.z);
    this.shock.mesh.scale.setScalar(Math.max(1e-3, 1 + Math.max(0, after) * 22));
    this.shock.material.opacity = after >= 0 ? Math.max(0, 0.8 * (1 - after / 0.45)) : 0;

    const bAge = t - 1.78;
    const bGrow = clamp01(bAge / 0.32);
    const bLive = bAge >= 0 && t < 2.1;
    this.bubble.mesh.position.set(P.x, 1.3, P.z);
    this.bubble.mesh.scale.setScalar(Math.max(1e-3, 0.8 + 3.6 * easeOut(bGrow)));
    this.bubble.opacity = bLive ? 0.3 : 0;
    this.bubbleRings.forEach((r, i) => {
      r.mesh.position.set(P.x, 1.3, P.z);
      r.mesh.rotation.set(i === 0 ? 0 : Math.PI / 3, i === 0 ? t * 1.5 : -t * 1.5, i === 0 ? 0 : 0.6);
      r.mesh.scale.setScalar(Math.max(1e-3, 0.8 + 3.6 * easeOut(bGrow)));
      r.material.opacity = bLive ? 0.7 : 0;
    });

    // Flat flare: a wide white ellipse floating at chest height, thin from the side camera.
    const fAge = t - 1.85;
    this.flare.mesh.rotation.set(-Math.PI / 2, 0, 0);
    this.flare.mesh.position.set(P.x, 1.4, P.z);
    this.flare.mesh.scale.setScalar(Math.max(1e-3, 7 * easeOut(fAge / 0.2)));
    this.flare.material.opacity = fAge >= 0 ? 0.7 * Math.exp(-fAge * 3.5) : 0;

    // Spike crown: thin white cones shoot up round the point and sink.
    const sAge = t - 1.78;
    const sGrow = easeOut(sAge / 0.1);
    const sSink = smoothstep((sAge - 0.5) / 0.5);
    for (let i = 0; i < SPIKES; i++) {
      const s = this.spikeSeed[i];
      const lift = sAge >= 0 ? sGrow * (1 - sSink) : 0;
      this.tmpQ.setFromAxisAngle(this.UP, s.a).multiply(this.tmpQ2.setFromAxisAngle(this.AX, 0.22));
      this.tmpP.set(P.x + Math.sin(s.a) * s.r, -0.05, P.z + Math.cos(s.a) * s.r);
      this.tmpM.compose(this.tmpP, this.tmpQ, this.tmpS.set(Math.max(1e-4, s.w), Math.max(1e-4, s.h * lift), Math.max(1e-4, s.w)));
      this.spikes.setMatrixAt(i, this.tmpM);
    }
    this.spikes.instanceMatrix.needsUpdate = true;
    this.spikeMat.emissiveIntensity = 0.6 * (1 - sSink);

    // --- Wisp forest: tall thin white strands rise from a ring, sway, thin out. ---
    this.wisps.forEach((arc, i) => {
      const s = this.wispSeed[i];
      const age = t - 2.2 - s.delay;
      if (age < 0 || t > 3.5) { arc.opacity = 0; return; }
      const grow = easeOut(age / 0.35);
      arc.head = grow * 1.4;
      arc.length = 0.85;
      arc.erosion = smoothstep((age - 0.6) / 0.6) * 0.9;
      arc.time = t;
      arc.opacity = 0.9 * (1 - smoothstep((age - 0.8) / 0.5));
      this.wispPlanes[i].rotation.z = 0.12 * Math.sin(t * 5 + s.sway) * grow;
    });
    this.ribbons.forEach((arc, i) => {
      const age = t - 2.45 - i * 0.12;
      if (age < 0 || t > 3.6) { arc.opacity = 0; return; }
      arc.mesh.rotation.z = age * (3 + i) * (i ? -1 : 1);
      arc.mesh.scale.setScalar(Math.max(1e-3, 0.8 + 0.6 * easeOut(age / 0.5)));
      this.ribbonPlanes[i].position.y = 1.6 + age * 0.4;
      arc.head = 1.2;
      arc.length = 0.8;
      arc.erosion = smoothstep((age - 0.6) / 0.6);
      arc.time = t;
      arc.opacity = 0.9 * (1 - smoothstep((age - 0.7) / 0.4));
    });
    // Curling ring trails on the ground, then clean.
    this.trails.forEach((arc, i) => {
      const age = t - 3.4 - i * 0.08;
      if (age < 0 || t > DURATION) { arc.opacity = 0; return; }
      arc.mesh.position.set(P.x, 0.08 + i * 0.01, P.z);
      arc.mesh.scale.setScalar(Math.max(1e-3, 1.6 + age * 3 + i * 0.7));
      arc.mesh.rotation.z = age * (4 + i) * (i % 2 ? -1 : 1);
      arc.head = 1.1;
      arc.length = Math.max(0.05, 0.9 - age * 0.7);
      arc.erosion = clamp01(age * 0.9);
      arc.time = t;
      arc.opacity = 0.8 * (1 - smoothstep((age - 0.4) / 0.4));
    });

    this.shake = after >= 0 ? 0.8 * Math.exp(-after * 7) : t > 0.4 ? 0.03 * smoothstep((t - 0.4) / 1) : 0;
  }

  private onHit() {
    this.hitDone = true;
    const ctx = this.ctx;
    if (!ctx) return;
    ctx.targets.forEach((e, i) => {
      const tp = ctx.targetPos[i];
      const src = this.hitSrc.clone();
      // A target exactly on the point gets a nudged source so the knockback direction is defined.
      if (tp && (tp.x - src.x) ** 2 + (tp.z - src.z) ** 2 < 1e-4) src.add(new THREE.Vector3(0.01, 0, 0.01));
      ctx.hit(e, { damage: this.settings.damage, knock: 7, from: src, color: '#ffffff' });
    });
  }

  private onBurst() {
    this.burstDone = true;
    const c = this.tmpP.copy(this.point).setY(0.6);
    this.tunnelWhite.burst(420, c);
    this.tunnelBlack.burst(220, c);
    this.flakes.burst(140, this.tmpV.copy(this.point).setY(1.3));
    this.flecks.burst(50, this.tmpV.copy(this.point).setY(0.8));
    this.dust.burst(90, this.tmpV.copy(this.point).setY(0.3));
    this.inkEdge.burst(80, c);
  }
}

export const prismOvertureModule: EffectModule = {
  label: 'prism overture',
  category: 'targeted',
  targeting: { mode: 'ground', radius: 5 },
  create: () => new PrismOverture(),
  telegraphs(effect) {
    const e = effect as PrismOverture;
    if (!e.ctx) return [];
    return [{ shape: { kind: 'circle' as const, x: e.ctx.point.x, z: e.ctx.point.z, radius: 5 }, start: 0.4, impact: HIT }];
  },
  bloom: { enabled: true, strength: 0.6, radius: 0.5, threshold: 0.82 },
  frameCamera(camera, controls, effect) {
    const e = effect as PrismOverture;
    if (e.ctx) frameCast(camera, controls, e.ctx, 6);
  },
  buildGui(f, effect) {
    const s = (effect as PrismOverture).settings;
    f.add(s, 'loop');
    f.add(s, 'damage', 1, 150, 1);
  },
};
