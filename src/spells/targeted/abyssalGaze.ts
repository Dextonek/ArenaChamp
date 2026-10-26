import * as THREE from 'three';
import { Emitter, defaultSettings } from '../../emitter';
import {
  GlowSphere, LightPillar, createRing, smoothstep, softDotTexture,
} from '../../effects/common';
import { frameCast, type CastContext } from '../../effects/targeting';
import type { Effect, EffectModule } from '../../effects/types';

/**
 * Abyssal Gaze (targeted, single target): a violet void eye opens in front of the caster while dark wisps are
 * sucked into it and an upright rune stands behind. The eye snaps a channelled beam onto the chosen enemy: a dark
 * wide sheath under a bright pulsing core, two orbiting bead-helices, jagged forked arcs re-rolled at 20 Hz and
 * wisps streaming toward the target, which mirrors the eye and is lifted off the ground. The beam grows thicker
 * with every damage tick, swells at the end and detonates: flash, shells, void implosion that pops, sparks, smoke.
 *
 * Structure copied from starbreakerLance.ts (docs/TARGETED_SPELL_BRIEF.md).
 */
export interface AbyssalGazeSettings {
  chargeTime: number;
  channelTime: number;
  beamWidth: number;
  tickDamage: number;
  overloadDamage: number;
  color: string;
  loop: boolean;
}

export const defaultAbyssalGaze = (): AbyssalGazeSettings => ({
  chargeTime: 0.9,
  channelTime: 2.7,
  beamWidth: 0.6,
  tickDamage: 4,
  overloadDamage: 60,
  color: '#a05aff',
  loop: false,
});

const AFTERMATH = 1.6;
const TICK = 0.3;
const SNAP = 0.06;
const SWELL = 0.15;
const RETRACT = 0.2;
const SUCK = 150;
const ARCS = 3;
const ARC_SEG = 14;
const BRANCHES = 2;
const BRANCH_SEG = 3;
const HELIX = 64;
const WISPS = 90;
const SEGMENTS = ARCS * (ARC_SEG - 1) + ARCS * BRANCHES * BRANCH_SEG;
const SHAKE_CAP = 0.7;

/** A soft open cylinder along +Y (unit radius and length): scrolling bands, soft sides, soft ends. */
class Beam {
  readonly mesh: THREE.Mesh;
  private material: THREE.ShaderMaterial;

  constructor(color: THREE.ColorRepresentation, additive: boolean, bright = 1, edge = 1.5) {
    this.material = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, side: THREE.DoubleSide,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
      uniforms: {
        uColor: { value: new THREE.Color(color) }, uOpacity: { value: 0 }, uTime: { value: 0 },
        uLen: { value: 1 }, uBright: { value: bright }, uEdge: { value: edge },
      },
      vertexShader: /* glsl */ `
        varying vec2 vUv; varying vec3 vN; varying vec3 vView;
        void main() {
          vUv = uv;
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          vN = normalize(normalMatrix * normal); vView = normalize(-mv.xyz);
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: /* glsl */ `
        uniform vec3 uColor; uniform float uOpacity, uTime, uLen, uBright, uEdge;
        varying vec2 vUv; varying vec3 vN; varying vec3 vView;
        void main() {
          float facing = abs(dot(vN, vView));
          float ends = smoothstep(0.0, 0.05, vUv.y) * smoothstep(1.0, 0.93, vUv.y);
          float bands = 0.72 + 0.28 * sin(vUv.y * uLen * 2.5 - uTime * 28.0 + vUv.x * 12.566);
          gl_FragColor = vec4(uColor * uBright, pow(facing, uEdge) * ends * bands * uOpacity);
        }`,
    });
    this.mesh = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 1, 18, 1, true), this.material);
    this.mesh.visible = false;
    this.mesh.frustumCulled = false;
  }

  get color(): THREE.Color {
    return this.material.uniforms.uColor.value as THREE.Color;
  }

  /** Places the beam from a along dir for `length`, with the given radius; opacity 0 hides it. */
  place(a: THREE.Vector3, dir: THREE.Vector3, length: number, radius: number, opacity: number, time: number) {
    const len = Math.max(0.001, length);
    this.mesh.position.copy(a).addScaledVector(dir, len / 2);
    this.mesh.quaternion.setFromUnitVectors(UP, dir);
    this.mesh.scale.set(radius, len, radius);
    const u = this.material.uniforms;
    u.uOpacity.value = opacity;
    u.uTime.value = time;
    u.uLen.value = len;
    this.mesh.visible = opacity > 0.002 && length > 0.01;
  }
}

const UP = new THREE.Vector3(0, 1, 0);

export class AbyssalGaze implements Effect {
  readonly group = new THREE.Group();
  readonly settings: AbyssalGazeSettings;
  readonly emitters: Emitter[] = [];
  shake = 0;
  playing = false;

  /** Last cast; frameCamera and telegraphs read it. Null until the first play(). */
  ctx: CastContext | null = null;
  private time = 0;
  private detonated = false;
  private popped = false;
  private nextTick = 0;
  private rerollAcc = 0;

  // Cast geometry, computed in cast() from the context.
  private eye = new THREE.Vector3(0, 1.6, 0);
  private fwd = new THREE.Vector3(0, 0, 1);
  private tgtFeet = new THREE.Vector3(0, 0, -6);
  // Per-frame scratch.
  private tgt = new THREE.Vector3();
  private dirV = new THREE.Vector3(0, 0, -1);
  private uV = new THREE.Vector3(1, 0, 0);
  private vV = new THREE.Vector3(0, 1, 0);
  private tmp = new THREE.Vector3();
  private tmp2 = new THREE.Vector3();

  // Eye (caster end) and its mirror at the target.
  private eyeG = new THREE.Group();
  private tgtG = new THREE.Group();
  private eyeSlit = createRing(0xf4e8ff, 0.78, 1, 48);
  private tgtSlit = createRing(0xf4e8ff, 0.78, 1, 48);
  private runeA = createRing(0xa05aff, 0.86, 1, 6);
  private runeB = createRing(0x8fe8ff, 0.93, 1, 72);
  private eyeCore = new GlowSphere(0x6a2ac0, { rim: false });
  private eyeRim = new GlowSphere(0xa05aff);
  private tgtCore = new GlowSphere(0x6a2ac0, { rim: false });
  private tgtRim = new GlowSphere(0xa05aff);
  private flash = new GlowSphere(0xf4e8ff, { rim: false });
  private muzzle = new GlowSphere(0xf4e8ff, { rim: false });

  // Beam.
  private dark = new Beam(0x1a0830, false, 1, 1.2);
  private core = new Beam(0xf4e8ff, true, 1, 2);
  private sheath = new Beam(0xa05aff, true, 0.9, 1.2);

  private arcPos = new Float32Array(SEGMENTS * 2 * 3);
  private arcCol = new Float32Array(SEGMENTS * 2 * 3);
  private arcGeo = new THREE.BufferGeometry();
  private arcMat = new THREE.LineBasicMaterial({
    vertexColors: true, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false,
  });
  private arcs = new THREE.LineSegments(this.arcGeo, this.arcMat);
  private jit = Array.from({ length: ARCS }, () => Array.from({ length: ARC_SEG }, () => ({ x: 0, y: 0 })));
  private branchDef = Array.from({ length: ARCS }, () => Array.from({ length: BRANCHES }, () => ({ at: 4, phi: 0, len: 1 })));

  private helixPos = [new Float32Array(HELIX * 3), new Float32Array(HELIX * 3)];
  private helixGeo = [new THREE.BufferGeometry(), new THREE.BufferGeometry()];
  private helixMat = [0, 1].map((i) => new THREE.PointsMaterial({
    size: 0.17, map: softDotTexture(), color: i === 0 ? 0xa05aff : 0x8fe8ff, transparent: true, opacity: 0,
    blending: THREE.AdditiveBlending, depthWrite: false,
  }));
  private helices = [0, 1].map((i) => new THREE.Points(this.helixGeo[i], this.helixMat[i]));

  private wispPos = new Float32Array(WISPS * 3);
  private wispSeed = Array.from({ length: WISPS }, () => ({ s: Math.random(), sp: 0.5 + Math.random() * 0.8, a: Math.random() * Math.PI * 2, r: 0.4 + Math.random() * 1.2 }));
  private wispGeo = new THREE.BufferGeometry();
  private wispMat = new THREE.PointsMaterial({
    size: 0.13, map: softDotTexture(), color: 0x8fe8ff, transparent: true, opacity: 0,
    blending: THREE.AdditiveBlending, depthWrite: false,
  });
  private wisps = new THREE.Points(this.wispGeo, this.wispMat);

  // Anticipation: wisps sucked into the eye (dark normal-blended and bright additive sharing positions).
  private suckPos = new Float32Array(SUCK * 3);
  private suckSeed = Array.from({ length: SUCK }, () => ({ a: Math.random() * Math.PI * 2, b: Math.random() * 2 - 1, r: 2.5 + Math.random() * 2.5, d: Math.random() * 0.45 }));
  private suckGeo = new THREE.BufferGeometry();
  private suckDarkMat = new THREE.PointsMaterial({
    size: 0.42, map: softDotTexture(), color: 0x14061f, transparent: true, opacity: 0, depthWrite: false,
  });
  private suckGlowMat = new THREE.PointsMaterial({
    size: 0.12, map: softDotTexture(), color: 0xb98cff, transparent: true, opacity: 0,
    blending: THREE.AdditiveBlending, depthWrite: false,
  });
  private suckDark = new THREE.Points(this.suckGeo, this.suckDarkMat);
  private suckGlow = new THREE.Points(this.suckGeo, this.suckGlowMat);

  // Target end and detonation.
  private groundRing = createRing(0xa05aff, 0.7, 1, 64);
  private burst = new GlowSphere(0xa05aff);
  private shock = createRing(0xe6d2ff, 0.9, 1, 96);
  private shock2 = createRing(0xa05aff, 0.94, 1, 96);
  private rune = createRing(0x8fe8ff, 0.9, 1, 6);
  private voidMat = new THREE.MeshBasicMaterial({ color: 0x14061f, transparent: true, opacity: 0, depthWrite: false });
  private voidSphere = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 16), this.voidMat);
  private scorchMat = new THREE.MeshBasicMaterial({ color: 0x14061f, transparent: true, opacity: 0, depthWrite: false });
  private scorch = new THREE.Mesh(new THREE.CircleGeometry(1, 48).rotateX(-Math.PI / 2), this.scorchMat);
  private pillar = new LightPillar(0xa05aff, 1.1);

  private chSparks: Emitter;
  private sparks: Emitter;
  private embers: Emitter;
  private smoke: Emitter;

  constructor(settings: AbyssalGazeSettings = defaultAbyssalGaze()) {
    this.settings = settings;

    this.arcGeo.setAttribute('position', new THREE.BufferAttribute(this.arcPos, 3));
    this.arcGeo.setAttribute('color', new THREE.BufferAttribute(this.arcCol, 3));
    this.arcs.frustumCulled = false;
    const violet = new THREE.Color(0xdcc2ff), cyan = new THREE.Color(0x8fe8ff);
    for (let sgm = 0; sgm < SEGMENTS; sgm++) {
      // Arc segments first (3 per arc group), then branches; arc 2 and its branches are cyan.
      const arcIdx = sgm < ARCS * (ARC_SEG - 1) ? Math.floor(sgm / (ARC_SEG - 1)) : Math.floor((sgm - ARCS * (ARC_SEG - 1)) / (BRANCHES * BRANCH_SEG));
      const c = arcIdx === 2 ? cyan : violet;
      for (let k = 0; k < 2; k++) {
        const o = (sgm * 2 + k) * 3;
        this.arcCol[o] = c.r; this.arcCol[o + 1] = c.g; this.arcCol[o + 2] = c.b;
      }
    }
    for (let i = 0; i < 2; i++) {
      this.helixGeo[i].setAttribute('position', new THREE.BufferAttribute(this.helixPos[i], 3));
      this.helices[i].frustumCulled = false;
    }
    this.wispGeo.setAttribute('position', new THREE.BufferAttribute(this.wispPos, 3));
    this.wisps.frustumCulled = false;
    this.suckGeo.setAttribute('position', new THREE.BufferAttribute(this.suckPos, 3));
    this.suckDark.frustumCulled = false;
    this.suckGlow.frustumCulled = false;

    // Eye group is oriented toward the target with +Z; rings are drawn in its XY plane (upright).
    for (const r of [this.eyeSlit, this.tgtSlit, this.runeA, this.runeB]) r.mesh.rotation.set(0, 0, 0);
    this.runeA.mesh.position.z = -0.55;
    this.runeB.mesh.position.z = -0.62;
    this.eyeSlit.mesh.position.z = 0.02;
    this.tgtSlit.mesh.position.z = 0.02;
    this.eyeG.add(this.eyeSlit.mesh, this.runeA.mesh, this.runeB.mesh);
    this.tgtG.add(this.tgtSlit.mesh);
    this.voidSphere.visible = false;
    this.scorch.visible = false;

    // Render order: dark behind, bright in front.
    this.dark.mesh.renderOrder = 1;
    this.sheath.mesh.renderOrder = 2;
    this.core.mesh.renderOrder = 3;
    this.group.add(this.scorch, this.suckDark, this.dark.mesh, this.sheath.mesh, this.core.mesh, this.arcs, this.suckGlow);
    this.group.add(...this.helices, this.wisps, this.eyeG, this.tgtG);
    this.group.add(this.eyeCore.mesh, this.eyeRim.mesh, this.tgtCore.mesh, this.tgtRim.mesh, this.flash.mesh, this.muzzle.mesh);
    this.group.add(this.groundRing.mesh, this.burst.mesh, this.shock.mesh, this.shock2.mesh, this.rune.mesh);
    this.group.add(this.voidSphere, this.pillar.mesh);

    this.chSparks = new Emitter({
      ...defaultSettings(), maxParticles: 700, rate: 0, lifetime: 0.7, lifetimeJitter: 0.5,
      shape: 'sphere', shapeSize: 0.25, speed: 5, speedJitter: 0.7, spread: 180, gravity: 7, drag: 0.9,
      sizeStart: 0.1, sizeEnd: 0.02, colorStart: '#ffffff', colorEnd: '#6a2ac0',
      opacityStart: 0.9, opacityEnd: 0, additive: true, colorMid: '#8fe8ff', sizeJitter: 0.3, erosion: 0,
    });
    this.sparks = new Emitter({
      ...defaultSettings(), maxParticles: 1400, rate: 0, lifetime: 0.9, lifetimeJitter: 0.5,
      shape: 'sphere', shapeSize: 0.4, speed: 12, speedJitter: 0.6, spread: 180, gravity: 10, drag: 0.9,
      sizeStart: 0.13, sizeEnd: 0.02, colorStart: '#ffffff', colorEnd: '#5a2ca8',
      opacityStart: 0.9, opacityEnd: 0, additive: true, colorMid: settings.color, sizeJitter: 0.3, erosion: 0,
    });
    this.embers = new Emitter({
      ...defaultSettings(), maxParticles: 700, rate: 0, lifetime: 2.4, lifetimeJitter: 0.5,
      shape: 'sphere', shapeSize: 1.4, speed: 2.2, speedJitter: 0.6, spread: 180, gravity: -0.7, drag: 0.8,
      sizeStart: 0.22, sizeEnd: 0, colorStart: '#f4e8ff', colorEnd: '#3a0a7a',
      opacityStart: 0.4, opacityEnd: 0, additive: true, colorMid: settings.color, sizeJitter: 0.5, erosion: 0.55, spin: 0.5,
    });
    // Dark normal-blended layer so the bright void burst has something to read against.
    this.smoke = new Emitter({
      ...defaultSettings(), maxParticles: 600, rate: 0, lifetime: 2.6, lifetimeJitter: 0.4,
      shape: 'sphere', shapeSize: 1.2, speed: 3.2, speedJitter: 0.6, spread: 180, gravity: -0.2, drag: 1.3,
      sizeStart: 1, sizeEnd: 2.4, colorStart: '#3a2a52', colorEnd: '#0d0416',
      opacityStart: 0.4, opacityEnd: 0, additive: false, colorMid: '#1a0830', sizeJitter: 0.4, erosion: 0.6, spin: 0.4,
      groundFade: 0.3,
    });
    this.emitters.push(this.chSparks, this.sparks, this.embers, this.smoke);
    for (const e of this.emitters) this.group.add(e.points);
    this.applyStyle();
    this.reset();
  }

  applyStyle() {
    const c = this.settings.color;
    this.eyeRim.color.set(c);
    this.tgtRim.color.set(c);
    this.burst.color.set(c);
    this.sheath.color.set(c);
    this.groundRing.material.color.set(c);
    this.runeA.material.color.set(c);
    this.shock2.material.color.set(c);
    this.helixMat[0].color.set(c);
    this.sparks.settings.colorMid = c;
    this.embers.settings.colorMid = c;
    this.sparks.applyStyle();
    this.embers.applyStyle();
  }

  get duration() {
    return this.detTime + AFTERMATH;
  }

  /** When the beam is released onto the target. */
  get releaseTime() {
    return this.settings.chargeTime;
  }

  /** When the overload detonates (end of the channel). */
  get detTime() {
    return this.settings.chargeTime + this.settings.channelTime;
  }

  cast(ctx: CastContext) {
    this.ctx = ctx;
    this.fwd.set(Math.sin(ctx.aim), 0, Math.cos(ctx.aim));
    this.tgtFeet.copy(ctx.targetPos[0] ?? ctx.point).setY(0);
    // The eye floats in front of the caster at chest height. If the target stands right on the caster, push it out.
    const dx = this.tgtFeet.x - ctx.from.x, dz = this.tgtFeet.z - ctx.from.z;
    const reach = Math.min(1.6, Math.max(0.5, Math.hypot(dx, dz) * 0.4));
    this.eye.copy(ctx.from).addScaledVector(this.fwd, reach).setY(1.6);
  }

  play() {
    this.reset();
    this.playing = true;
  }

  private reset() {
    this.time = 0;
    this.detonated = false;
    this.popped = false;
    this.nextTick = 0;
    this.rerollAcc = 0;
    this.shake = 0;
    for (const e of this.emitters) e.clear();
    this.reroll();
    this.layout(0);
  }

  update(dt: number) {
    for (const e of this.emitters) e.update(dt);
    if (!this.playing) return;
    this.time += dt;
    if (this.time >= this.duration) {
      if (this.settings.loop) { this.play(); return; }
      this.playing = false;
    }
    // Damage ticks, one hit each, safe against long frames.
    while (this.ctx && this.nextTick < this.tickCount() && this.time >= this.releaseTime + TICK * (this.nextTick + 1)) {
      const target = this.ctx.targets[0];
      if (target) this.ctx.hit(target, { damage: this.settings.tickDamage + this.nextTick, knock: 0.6, from: this.eye, color: '#d8b8ff' });
      this.nextTick++;
    }
    if (!this.detonated && this.time >= this.detTime) this.onDetonate();
    if (this.detonated && !this.popped && this.time >= this.detTime + 0.3) this.onPop();
    // Re-roll the jagged arcs at 20 Hz.
    this.rerollAcc += dt;
    if (this.rerollAcc >= 0.05) { this.rerollAcc = 0; this.reroll(); }
    this.layout(dt);
  }

  private tickCount() {
    return Math.max(0, Math.ceil((this.settings.channelTime - 0.05) / TICK) - 1);
  }

  private reroll() {
    for (let a = 0; a < ARCS; a++) {
      for (let i = 0; i < ARC_SEG; i++) {
        this.jit[a][i].x = Math.random() * 2 - 1;
        this.jit[a][i].y = Math.random() * 2 - 1;
      }
      for (let b = 0; b < BRANCHES; b++) {
        const d = this.branchDef[a][b];
        d.at = 2 + Math.floor(Math.random() * (ARC_SEG - 5));
        d.phi = Math.random() * Math.PI * 2;
        d.len = 0.7 + Math.random() * 0.9;
      }
    }
  }

  /** Beam reach 0..1: snaps out after the release, retracts toward the eye after the detonation. */
  private reachAt(t: number) {
    if (t < this.releaseTime) return 0;
    if (t < this.detTime + 0.05) return smoothstep((t - this.releaseTime) / SNAP);
    return 1 - smoothstep((t - this.detTime - 0.05) / RETRACT);
  }

  private layout(dt: number) {
    const s = this.settings;
    const t = this.time;
    const rel = this.releaseTime, det = this.detTime;
    const after = t - det;
    const fade = 1 - smoothstep((t - (this.duration - 0.8)) / 0.8);
    const ctx = this.ctx;
    const reach = this.reachAt(t);
    const channeling = t >= rel && t < det;
    const grow = smoothstep((t - rel) / s.channelTime);

    // --- Target lift: rises during the channel, drops with a little bounce on the detonation. ---
    let lift = 0;
    if (t < det) lift = 1.2 * smoothstep((t - rel - 0.15) / (s.channelTime * 0.8));
    else lift = 1.2 * Math.pow(Math.max(0, 1 - after / 0.15), 2) + 0.3 * Math.abs(Math.sin(after * 8)) * Math.exp(-after * 3.5) * smoothstep(after / 0.15);
    const target = ctx?.targets[0];
    if (ctx && target) ctx.displace(target, this.tmp.set(0, lift, 0));

    // Beam end: the target's chest, following the lift.
    this.tgt.copy(this.tgtFeet).setY(1.3 + lift);
    const to = this.tmp2.subVectors(this.tgt, this.eye);
    const fullLen = to.length();
    if (fullLen > 1e-4) this.dirV.copy(to).divideScalar(fullLen); else this.dirV.copy(this.fwd);
    const dir = this.dirV;
    const helper = Math.abs(dir.y) > 0.95 ? this.tmp.set(1, 0, 0) : this.tmp.set(0, 1, 0);
    this.uV.crossVectors(dir, helper).normalize();
    this.vV.crossVectors(dir, this.uV).normalize();
    const len = fullLen * reach;

    // --- Eye: opens during the anticipation, pulses while channelling, closes in the aftermath. ---
    const open = smoothstep(t / (rel * 0.8)) * (1 - smoothstep((t - (det + 0.25)) / 0.5));
    const pulse = channeling ? 1 + 0.12 * Math.sin(t * Math.PI * 12) : 1;
    this.eyeG.position.copy(this.eye);
    this.eyeG.lookAt(this.tmp.copy(this.eye).add(dir));
    const eyeR = (0.15 + 0.55 * open) * pulse;
    this.eyeCore.mesh.position.copy(this.eye);
    this.eyeCore.mesh.scale.setScalar(eyeR * 1.2);
    this.eyeCore.opacity = 0.55 * open * fade;
    this.eyeRim.mesh.position.copy(this.eye);
    this.eyeRim.mesh.scale.setScalar(eyeR);
    this.eyeRim.opacity = 0.5 * open * fade;
    this.eyeSlit.mesh.scale.set(eyeR * 0.22, eyeR * 1.7, 1);
    this.eyeSlit.material.opacity = 0.75 * open * fade;
    // Upright rune standing behind the eye, facing the target.
    const runeS = 0.9 + 0.9 * smoothstep(t / rel);
    this.runeA.mesh.scale.setScalar(runeS * 1.4);
    this.runeA.mesh.rotation.z = t * 1.4;
    this.runeA.material.opacity = 0.5 * open * fade;
    this.runeB.mesh.scale.setScalar(runeS * 1.65);
    this.runeB.mesh.rotation.z = -t * 0.9;
    this.runeB.material.opacity = 0.35 * open * fade;
    // Release flash at the eye.
    const sinceRel = t - rel;
    this.muzzle.mesh.position.copy(this.eye);
    this.muzzle.mesh.scale.setScalar(0.9 + sinceRel * 3);
    this.muzzle.opacity = sinceRel >= 0 ? 0.8 * Math.exp(-sinceRel * 14) : 0;

    // --- Anticipation: dark wisps are sucked into the eye. ---
    for (let i = 0; i < SUCK; i++) {
      const m = this.suckSeed[i];
      const k = THREE.MathUtils.clamp((t / rel - m.d) / (1 - m.d), 0, 1);
      const r = m.r * (1 - k * k);
      const a = m.a + k * 4;
      const cy = Math.sqrt(Math.max(0, 1 - m.b * m.b));
      this.suckPos[i * 3] = this.eye.x + Math.cos(a) * cy * r;
      this.suckPos[i * 3 + 1] = this.eye.y + m.b * r * 0.8;
      this.suckPos[i * 3 + 2] = this.eye.z + Math.sin(a) * cy * r;
    }
    this.suckGeo.attributes.position.needsUpdate = true;
    const suckOp = t < rel ? smoothstep(t / 0.25) : 0;
    this.suckDarkMat.opacity = 0.55 * suckOp;
    this.suckGlowMat.opacity = 0.6 * suckOp;

    // --- Channel: dark sheath, bright pulsing core, violet shell, helices, arcs, wisps. ---
    const ramp = 0.15 + 0.85 * grow;
    let swell = 1;
    if (t < det) swell = 1 + 2 * smoothstep((t - (det - SWELL)) / SWELL);
    else swell = 1 + 2 * (1 - smoothstep(after / RETRACT));
    const wob = 1 + 0.18 * Math.sin(t * Math.PI * 12);
    const coreHalf = (s.beamWidth / 2) * ramp * wob * swell;
    this.core.place(this.eye, dir, len, coreHalf, 0.62 * fade, t);
    this.sheath.place(this.eye, dir, len, coreHalf * 1.9, 0.22 * fade, t * 0.7);
    this.dark.place(this.eye, dir, len, coreHalf * 2.9 + 0.12, 0.5 * fade, t * 0.4);

    const beamOn = reach > 0.01;
    this.arcs.visible = beamOn;
    for (const h of this.helices) h.visible = beamOn;
    this.wisps.visible = beamOn;
    if (beamOn) {
      this.layoutArcs(len, coreHalf, grow, swell);
      this.layoutHelix(len, coreHalf, t);
      this.layoutWisps(len, coreHalf, t);
      const bo = reach * fade;
      this.arcMat.opacity = 0.95 * bo;
      this.helixMat[0].opacity = 0.7 * bo;
      this.helixMat[1].opacity = 0.7 * bo;
      this.wispMat.opacity = 0.7 * bo;
      if (channeling && dt > 0) {
        this.chSparks.burst(4 + Math.floor(grow * 5), this.tgt);
        if (Math.random() < 0.35) this.smoke.burst(1, this.tmp.copy(this.tgtFeet).setY(0.3));
      }
    }

    // --- Target end: mirrors the eye (same glow sprites and slit), plus a ground ring. ---
    const tOpen = channeling ? smoothstep((t - rel) / 0.25) : t < rel ? 0 : Math.max(0, 1 - after / 0.25);
    const tPulse = 1 + 0.15 * Math.sin(t * Math.PI * 12 + 1);
    const tR = (0.4 + 0.6 * grow) * tOpen * tPulse * swell * 0.6;
    this.tgtG.position.copy(this.tgt);
    this.tgtG.lookAt(this.eye);
    this.tgtCore.mesh.position.copy(this.tgt);
    this.tgtCore.mesh.scale.setScalar(tR * 1.2);
    this.tgtCore.opacity = 0.55 * tOpen * fade;
    this.tgtRim.mesh.position.copy(this.tgt);
    this.tgtRim.mesh.scale.setScalar(tR);
    this.tgtRim.opacity = 0.5 * tOpen * fade;
    this.tgtSlit.mesh.scale.set(tR * 0.22, tR * 1.7, 1);
    this.tgtSlit.material.opacity = 0.7 * tOpen * fade;
    this.groundRing.mesh.position.set(this.tgtFeet.x, 0.05, this.tgtFeet.z);
    this.groundRing.mesh.scale.setScalar((1.3 + 0.9 * grow + 0.15 * Math.sin(t * 9)) * (1 + (t > det ? after * 2 : 0)));
    this.groundRing.mesh.rotation.z = t * 1.5;
    this.groundRing.material.opacity = (channeling ? 0.5 * tOpen : 0) * fade;

    // --- Detonation: flash, shell, two rings, void implosion that pops, pillar, scorch. ---
    const c = this.tmp.copy(this.tgtFeet).setY(1.2);
    if (this.detonated) {
      this.flash.mesh.position.copy(c);
      this.flash.mesh.scale.setScalar(1.8 + after * 5);
      this.flash.opacity = 0.9 * Math.exp(-after * 12);
      this.burst.mesh.position.copy(c);
      this.burst.mesh.scale.setScalar(1 + after * 11);
      this.burst.opacity = 0.55 * Math.exp(-after * 4);
      this.shock.mesh.position.set(c.x, 0.05, c.z);
      this.shock.mesh.scale.setScalar(1 + after * 22);
      this.shock.material.opacity = Math.max(0, 0.8 * (1 - after / 0.6));
      const a2 = after - 0.12;
      this.shock2.mesh.position.set(c.x, 0.06, c.z);
      this.shock2.mesh.scale.setScalar(1 + Math.max(0, a2) * 13);
      this.shock2.material.opacity = a2 > 0 ? Math.max(0, 0.6 * (1 - a2 / 0.9)) : 0;
      // Void implosion: shrinks, then pops (hidden) at 0.3 s.
      this.voidSphere.position.copy(c);
      this.voidSphere.scale.setScalar(2.4 * (1 - 0.85 * smoothstep(after / 0.3)));
      this.voidMat.opacity = after < 0.3 ? 0.75 : 0;
      this.voidSphere.visible = after < 0.3;
      this.pillar.set(this.tgtFeet.x, this.tgtFeet.z, 0, 22, 0.5 * Math.exp(-after * 2.8) * fade);
      this.rune.mesh.position.set(this.tgtFeet.x, 0.06, this.tgtFeet.z);
      this.rune.mesh.scale.setScalar(2.6 + Math.min(after, 0.5) * 1.2);
      this.rune.mesh.rotation.z = after * 0.8;
      this.rune.material.opacity = 0.4 * smoothstep(after / 0.3) * fade;
      this.scorch.position.set(this.tgtFeet.x, 0.03, this.tgtFeet.z);
      this.scorch.scale.setScalar(2.8);
      this.scorchMat.opacity = 0.5 * smoothstep(after / 0.4) * fade;
      this.scorch.visible = this.scorchMat.opacity > 0.01;
      this.shake = Math.min(SHAKE_CAP, 0.7 * Math.exp(-after * 6));
    } else {
      this.flash.opacity = 0;
      this.burst.opacity = 0;
      this.shock.material.opacity = 0;
      this.shock2.material.opacity = 0;
      this.rune.material.opacity = 0;
      this.voidSphere.visible = false;
      this.scorch.visible = false;
      this.pillar.set(this.tgtFeet.x, this.tgtFeet.z, 0, 22, 0);
      // Shake ramps 0.06 -> 0.2 over the channel, spikes in the overload swell.
      this.shake = channeling ? 0.06 + 0.14 * grow + 0.1 * smoothstep((t - (det - SWELL)) / SWELL) : 0;
    }
  }

  /** Straight core arcs with jagged offsets (a fixed count of segments; never goes thin). */
  private layoutArcs(len: number, coreHalf: number, grow: number, swell: number) {
    const amp = (0.22 + 0.35 * grow) * (0.6 + 0.4 * swell) + coreHalf;
    const p = this.arcPos;
    let o = 0;
    const put = (v: THREE.Vector3) => { p[o++] = v.x; p[o++] = v.y; p[o++] = v.z; };
    const a = new THREE.Vector3(), b = new THREE.Vector3(), q = new THREE.Vector3();
    const pts: THREE.Vector3[] = Array.from({ length: ARC_SEG }, () => new THREE.Vector3());
    for (let arc = 0; arc < ARCS; arc++) {
      for (let i = 0; i < ARC_SEG; i++) {
        const f = i / (ARC_SEG - 1);
        const env = Math.sin(Math.PI * f) * amp * (arc === 2 ? 1.25 : 1);
        const j = this.jit[arc][i];
        pts[i].copy(this.eye).addScaledVector(this.dirV, f * len).addScaledVector(this.uV, j.x * env).addScaledVector(this.vV, j.y * env);
      }
      for (let i = 0; i < ARC_SEG - 1; i++) { put(pts[i]); put(pts[i + 1]); }
    }
    // Branches fork outward from the arcs; the order matches the colour layout in the constructor.
    for (let arc = 0; arc < ARCS; arc++) {
      for (let br = 0; br < BRANCHES; br++) {
        const d = this.branchDef[arc][br];
        // Recompute the arc point the branch forks from.
        const f = d.at / (ARC_SEG - 1);
        const env = Math.sin(Math.PI * f) * amp * (arc === 2 ? 1.25 : 1);
        const j = this.jit[arc][d.at];
        a.copy(this.eye).addScaledVector(this.dirV, f * len).addScaledVector(this.uV, j.x * env).addScaledVector(this.vV, j.y * env);
        b.copy(a);
        for (let k = 1; k <= BRANCH_SEG; k++) {
          const ph = d.phi + k * 0.5;
          q.copy(a).addScaledVector(this.dirV, 0.3 * k * d.len)
            .addScaledVector(this.uV, Math.cos(ph) * 0.38 * k * d.len)
            .addScaledVector(this.vV, Math.sin(ph) * 0.38 * k * d.len);
          put(b); put(q);
          b.copy(q);
        }
      }
    }
    this.arcGeo.attributes.position.needsUpdate = true;
  }

  /** Two bead-helices orbiting the beam, in opposite phase. */
  private layoutHelix(len: number, coreHalf: number, t: number) {
    const R = coreHalf * 1.9 + 0.25;
    for (let h = 0; h < 2; h++) {
      const pos = this.helixPos[h];
      for (let i = 0; i < HELIX; i++) {
        const sP = (i + 0.5) / HELIX;
        const th = sP * len * 1.9 + t * 7 + h * Math.PI;
        const rr = R * (0.85 + 0.15 * Math.sin(sP * 20 + t * 5));
        const c = Math.cos(th) * rr, sn = Math.sin(th) * rr;
        pos[i * 3] = this.eye.x + this.dirV.x * sP * len + this.uV.x * c + this.vV.x * sn;
        pos[i * 3 + 1] = this.eye.y + this.dirV.y * sP * len + this.uV.y * c + this.vV.y * sn;
        pos[i * 3 + 2] = this.eye.z + this.dirV.z * sP * len + this.uV.z * c + this.vV.z * sn;
      }
      this.helixGeo[h].attributes.position.needsUpdate = true;
    }
  }

  /** Wisps streaming along the beam toward the target. */
  private layoutWisps(len: number, coreHalf: number, t: number) {
    for (let i = 0; i < WISPS; i++) {
      const w = this.wispSeed[i];
      const sP = (w.s + t * w.sp) % 1;
      const th = w.a + t * 2.5;
      const rr = coreHalf * 1.2 + w.r * 0.35 * (1 - sP * 0.4);
      const c = Math.cos(th) * rr, sn = Math.sin(th) * rr;
      this.wispPos[i * 3] = this.eye.x + this.dirV.x * sP * len + this.uV.x * c + this.vV.x * sn;
      this.wispPos[i * 3 + 1] = this.eye.y + this.dirV.y * sP * len + this.uV.y * c + this.vV.y * sn;
      this.wispPos[i * 3 + 2] = this.eye.z + this.dirV.z * sP * len + this.uV.z * c + this.vV.z * sn;
    }
    this.wispGeo.attributes.position.needsUpdate = true;
  }

  private onDetonate() {
    this.detonated = true;
    const c = new THREE.Vector3().copy(this.tgtFeet).setY(1.2);
    this.sparks.burst(700, c);
    this.embers.burst(400, c);
    this.smoke.burst(260, this.tmp2.copy(this.tgtFeet).setY(0.4));
    const ctx = this.ctx;
    const target = ctx?.targets[0];
    if (ctx && target) ctx.hit(target, { damage: this.settings.overloadDamage, knock: 9, from: this.eye, color: '#e6d2ff' });
  }

  /** The void sphere has collapsed: a second, smaller pop. */
  private onPop() {
    this.popped = true;
    const c = new THREE.Vector3().copy(this.tgtFeet).setY(1.2);
    this.sparks.burst(220, c);
    this.chSparks.burst(120, c);
    this.shake = Math.max(this.shake, 0.35);
  }
}

export const abyssalGazeModule: EffectModule = {
  label: 'abyssal gaze',
  category: 'targeted',
  targeting: { mode: 'enemy' },
  create: () => new AbyssalGaze(),
  telegraphs(effect) {
    const e = effect as AbyssalGaze;
    const ctx = e.ctx;
    if (!ctx) return [];
    const c = ctx.targetPos[0] ?? ctx.point;
    return [
      { shape: { kind: 'line', x1: ctx.from.x, z1: ctx.from.z, x2: c.x, z2: c.z, width: 1.6 }, start: 0.1, impact: e.releaseTime, until: e.detTime },
      { shape: { kind: 'circle', x: c.x, z: c.z, radius: 3 }, start: Math.max(0.2, e.detTime - 1), impact: e.detTime },
    ];
  },
  bloom: { enabled: true, strength: 0.6, radius: 0.5, threshold: 0.82 },
  frameCamera(camera, controls, effect) {
    const e = effect as AbyssalGaze;
    if (e.ctx) frameCast(camera, controls, e.ctx, 4);
  },
  buildGui(f, effect) {
    const g = effect as AbyssalGaze;
    const s = g.settings;
    f.add(s, 'loop');
    f.add(s, 'chargeTime', 0.3, 2.5, 0.05).name('charge time');
    f.add(s, 'channelTime', 0.9, 5, 0.1).name('channel time');
    f.add(s, 'beamWidth', 0.2, 1.4, 0.05).name('beam width');
    f.add(s, 'tickDamage', 1, 20, 1).name('tick damage');
    f.add(s, 'overloadDamage', 1, 150, 1).name('overload damage');
    f.addColor(s, 'color').onChange(() => g.applyStyle());
  },
};
