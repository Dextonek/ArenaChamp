import * as THREE from 'three';
import { Emitter, defaultSettings } from '../../emitter';
import { GlowSphere, createRing, createSwordGeometry, mergeParts, smoothstep } from '../../effects/common';
import {
  LightningArc, SmokeBall, StarBurst, chromaPulse, clearScreenFx, createScreenFx, impactFrameAt,
} from '../../effects/parts';
import { frameCast, type CastContext } from '../../effects/targeting';
import type { Effect, EffectModule } from '../../effects/types';

/**
 * Flying Sword Formation (targeted, ground AoE): the world darkens and a violet sky sigil draws itself over the
 * chosen spot, tilted ~55 degrees toward the caster. 36 dark-steel swords (gold guard, thin violet-white edge)
 * appear on its three rings, blade-down, and the formation turns faster while thin arcs jump between swords.
 * Three waves of 12 swords streak down onto the area and stay standing in the ground as scars. A dead beat: the
 * empty sigil collapses into one giant sword that hangs, then drops through the centre. Impact frames, a violet
 * ground discharge, every stuck sword flashes and shatters at once; the giant sword dissolves from the tip up
 * into motes while shards fall.
 *
 * Recipes: g-castorice-sky-rift-blade-rain (source shows early, blades hang as scars),
 * b-elden-ring-founding-rain-of-stars (staggered field of falling projectiles), c-ue5-triangle-portal (sky sigil).
 */
export interface FlyingSwordFormationSettings {
  /** Damage of the giant sword (each small landing within 1 m does 6). */
  damage: number;
  loop: boolean;
}

export const defaultFlyingSwordFormation = (): FlyingSwordFormationSettings => ({ damage: 50, loop: false });

const D = 3.0; // giant sword lands
const DURATION = 5.0;
const COUNT = 36;
const WAVES = 3;
const SIGIL_Y = 8.5;
const SIGIL_R = 5.4;
const AREA = 4.3; // radius the small swords land in
const S = 2.0; // small sword length
const GIANT = 5.0; // giant sword length
const FLIGHT = 0.26;
const FRAME = 0.04;
const RING_R = [2.0, 3.4, 4.7];
const RING_N = [6, 12, 18];
const NOVA = 6;
const ARCS = 4;
const EDGE = new THREE.Color(0xcbb8ff);

const hash = (n: number) => {
  const x = Math.sin(n * 127.1 + 11.7) * 43758.5453;
  return x - Math.floor(x);
};

/** Sigil spin (radians): slow, speeding up 0.8-1.4 s, then steady fast. */
function spinAt(t: number) {
  const u = Math.min(t, 1.4);
  return 0.5 * u + 0.9 * Math.max(0, u - 0.8) ** 2 + (t > 1.4 ? 1.58 * (t - 1.4) : 0);
}

/** Sky sigil texture: concentric rings, tick band, eight-point star, spokes. White lines with a violet glow copy. */
function sigilTexture() {
  const N = 512, c = N / 2;
  const cv = document.createElement('canvas');
  cv.width = cv.height = N;
  const g = cv.getContext('2d')!;
  const ring = (r: number, w: number) => { g.lineWidth = w; g.beginPath(); g.arc(c, c, r * c, 0, Math.PI * 2); g.stroke(); };
  const draw = () => {
    ring(0.97, 5); ring(0.86, 3); ring(0.6, 4); ring(0.34, 3); ring(0.12, 3);
    g.lineWidth = 2;
    for (let i = 0; i < 72; i++) {
      const a = (i / 72) * Math.PI * 2, r0 = 0.86, r1 = i % 6 === 0 ? 0.97 : 0.92;
      g.beginPath(); g.moveTo(c + Math.cos(a) * r0 * c, c + Math.sin(a) * r0 * c);
      g.lineTo(c + Math.cos(a) * r1 * c, c + Math.sin(a) * r1 * c); g.stroke();
    }
    g.lineWidth = 3;
    for (let k = 0; k < 2; k++) {
      g.beginPath();
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * Math.PI * 2 + k * (Math.PI / 4) + Math.PI / 8;
        const x = c + Math.cos(a) * 0.6 * c, y = c + Math.sin(a) * 0.6 * c;
        if (i === 0) g.moveTo(x, y); else g.lineTo(x, y);
      }
      g.closePath(); g.stroke();
    }
    g.lineWidth = 2;
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      g.beginPath(); g.moveTo(c + Math.cos(a) * 0.12 * c, c + Math.sin(a) * 0.12 * c);
      g.lineTo(c + Math.cos(a) * 0.34 * c, c + Math.sin(a) * 0.34 * c); g.stroke();
    }
  };
  g.strokeStyle = '#9b6bff'; g.shadowColor = '#9b6bff'; g.shadowBlur = 16; draw(); draw();
  g.strokeStyle = '#e6dcff'; g.shadowBlur = 0; draw();
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** Lets a material discard fragments below a world height (uCut), to dissolve the giant sword from the tip up. */
function cutable(mat: THREE.Material, cut: { value: number }) {
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uCut = cut;
    sh.vertexShader = 'varying float vWY;\n' + sh.vertexShader.replace(
      '#include <begin_vertex>', '#include <begin_vertex>\nvWY = (modelMatrix * vec4(transformed, 1.0)).y;',
    );
    sh.fragmentShader = 'varying float vWY; uniform float uCut;\n' + sh.fragmentShader.replace(
      'void main() {', 'void main() {\nif (vWY < uCut) discard;',
    );
  };
}

interface Sword {
  ring: number; ang: number; wave: number;
  appear: number; launch: number; land: number;
  hit: THREE.Vector3; stick: THREE.Vector3;
  landed: boolean;
}

export class FlyingSwordFormation implements Effect {
  readonly group = new THREE.Group();
  readonly settings: FlyingSwordFormationSettings;
  readonly emitters: Emitter[] = [];
  readonly screen = createScreenFx();
  shake = 0;
  playing = false;
  ctx: CastContext | null = null;

  private time = 0;
  private struck = false;
  private smokeDone = false;
  private shattered = false;
  private spit = 0;

  private center = new THREE.Vector3();
  private sigilQuat = new THREE.Quaternion();
  private swords: Sword[] = [];
  private waveHit: Set<number>[] = [new Set(), new Set(), new Set()];

  // Sigil.
  private sigilGroup = new THREE.Group();
  private spinGroup = new THREE.Group();
  private sigilMat: THREE.ShaderMaterial;
  private sigilDarkMat = new THREE.MeshBasicMaterial({ color: 0x120a24, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide });

  // Small swords: dark steel body, gold guard, thin violet-white edges (same matrices), streaks, ground scars.
  private body: THREE.InstancedMesh;
  private guard: THREE.InstancedMesh;
  private edge: THREE.InstancedMesh;
  private edgeMat = new THREE.MeshBasicMaterial({ color: EDGE.clone() });
  private streaks: THREE.InstancedMesh;
  private scars: THREE.InstancedMesh;
  private scarMat = new THREE.MeshBasicMaterial({ color: 0x07030c, transparent: true, opacity: 0.75, depthWrite: false });

  // Giant sword.
  private cut = { value: -100 };
  private giant = new THREE.Group();
  private giantEdgeMat = new THREE.MeshBasicMaterial({ color: EDGE.clone() });

  // Arcs, impact.
  private arcs: LightningArc[] = [];
  private nova: LightningArc[] = [];
  private star = new StarBurst({ points: 10, color: 0x9b6bff, core: 0xe6dcff, additive: false });
  private flash = new GlowSphere(0x9b6bff, { rim: false });
  private lockRing = createRing(0x9b6bff, 0.93, 1, 96);
  private shock = createRing(0x9b6bff, 0.9, 1, 128);
  private scorchMat = new THREE.MeshBasicMaterial({ color: 0x05040a, transparent: true, opacity: 0, depthWrite: false });
  private scorch = new THREE.Mesh(new THREE.CircleGeometry(1, 48), this.scorchMat);
  private smoke = new SmokeBall({ color: 0x1a1626, rim: 0x4a3f66, flake: '#2a2236', maxBalls: 4 });
  private sparks: Emitter;
  private shards: Emitter;
  private motes: Emitter;

  // Scratch.
  private m = new THREE.Matrix4();
  private q = new THREE.Quaternion();
  private p = new THREE.Vector3();
  private sc = new THREE.Vector3();
  private down = new THREE.Vector3(0, -1, 0);
  private d = new THREE.Vector3();
  private tip = new THREE.Vector3();
  private mid = new THREE.Vector3();
  private a0 = new THREE.Vector3();
  private b0 = new THREE.Vector3();

  constructor(settings: FlyingSwordFormationSettings = defaultFlyingSwordFormation()) {
    this.settings = settings;
    this.screen.tint.set(0x120a24);
    this.screen.impactColor.set(0x9b6bff);
    this.screen.speedLineColor.set(0xe6dcff);

    // Sigil: dark normal-blended disc under an additive line texture.
    this.sigilMat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
      uniforms: { uMap: { value: sigilTexture() }, uOpacity: { value: 0 }, uReveal: { value: 0 } },
      vertexShader: /* glsl */ `
        varying vec2 vUv;
        void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: /* glsl */ `
        uniform sampler2D uMap; uniform float uOpacity, uReveal; varying vec2 vUv;
        void main() {
          vec2 p = vUv * 2.0 - 1.0;
          float a = (atan(p.y, p.x) + 3.14159265) / 6.2831853;
          if (a > uReveal) discard;
          vec4 t = texture2D(uMap, vUv);
          gl_FragColor = vec4(t.rgb, t.a * uOpacity);
        }`,
    });
    const plane = new THREE.PlaneGeometry(SIGIL_R * 2, SIGIL_R * 2);
    const dark = new THREE.Mesh(new THREE.CircleGeometry(SIGIL_R, 64), this.sigilDarkMat);
    const lines = new THREE.Mesh(plane, this.sigilMat);
    dark.renderOrder = 1;
    lines.renderOrder = 2;
    lines.position.z = 0.02;
    this.spinGroup.add(dark, lines);
    this.sigilGroup.add(this.spinGroup);
    this.sigilGroup.visible = false;
    this.group.add(this.sigilGroup);

    // Swords.
    const swordGeo = createSwordGeometry();
    const steel = new THREE.MeshStandardMaterial({ color: 0x343a44, metalness: 0.65, roughness: 0.45, emissive: 0x1a1030, emissiveIntensity: 0.5 });
    const gold = new THREE.MeshStandardMaterial({ color: 0xc9a24a, metalness: 0.7, roughness: 0.4, emissive: 0x3a2a08, emissiveIntensity: 0.4 });
    const guardGeo = new THREE.BoxGeometry(0.34, 0.05, 0.075).translate(0, 0.74, 0);
    const edgeGeo = mergeParts([
      new THREE.BoxGeometry(0.012, 0.56, 0.034).translate(-0.043, 0.42, 0),
      new THREE.BoxGeometry(0.012, 0.56, 0.034).translate(0.043, 0.42, 0),
    ]);
    this.body = new THREE.InstancedMesh(swordGeo, steel, COUNT);
    this.guard = new THREE.InstancedMesh(guardGeo, gold, COUNT);
    this.edge = new THREE.InstancedMesh(edgeGeo, this.edgeMat, COUNT);
    for (const im of [this.body, this.guard, this.edge]) { im.frustumCulled = false; this.group.add(im); }

    const streakMat = new THREE.MeshBasicMaterial({
      color: 0x9b6bff, transparent: true, opacity: 0.45, blending: THREE.AdditiveBlending, depthWrite: false,
    });
    this.streaks = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), streakMat, COUNT);
    this.streaks.frustumCulled = false;
    this.scars = new THREE.InstancedMesh(new THREE.CircleGeometry(1, 20), this.scarMat, COUNT);
    this.scars.frustumCulled = false;
    this.group.add(this.streaks, this.scars);

    // Giant sword: same parts, dissolving from the tip up through a shared world-height cut.
    const gSteel = steel.clone();
    const gGold = gold.clone();
    for (const mat of [gSteel, gGold, this.giantEdgeMat]) cutable(mat, this.cut);
    this.giant.add(new THREE.Mesh(swordGeo, gSteel), new THREE.Mesh(guardGeo, gGold), new THREE.Mesh(edgeGeo, this.giantEdgeMat));
    this.giant.visible = false;
    this.group.add(this.giant);

    for (let i = 0; i < ARCS; i++) {
      const a = new LightningArc({ width: 0.07, segments: 8, jitter: 0.08, branches: 1, core: 0xe6dcff, glow: 0x9b6bff, rerollEvery: 0.04, dropChance: 0.1 });
      this.arcs.push(a);
      this.group.add(a.mesh);
    }
    for (let i = 0; i < NOVA; i++) {
      const a = new LightningArc({ width: 0.2, segments: 10, jitter: 0.1, branches: 1, core: 0xe6dcff, glow: 0x9b6bff, rerollEvery: 0.04, dropChance: 0.2 });
      this.nova.push(a);
      this.group.add(a.mesh);
    }

    this.scorch.rotation.x = -Math.PI / 2;
    this.scorch.visible = false;
    this.group.add(this.star.mesh, this.flash.mesh, this.lockRing.mesh, this.shock.mesh, this.scorch, this.smoke.mesh);

    this.sparks = new Emitter({
      ...defaultSettings(), maxParticles: 900, rate: 0, lifetime: 0.6, lifetimeJitter: 0.5,
      shape: 'sphere', shapeSize: 0.2, speed: 6, speedJitter: 0.6, spread: 120, gravity: 9, drag: 1.4,
      sizeStart: 0.1, sizeEnd: 0.02, colorStart: '#e6dcff', colorEnd: '#5fe3ff',
      opacityStart: 0.9, opacityEnd: 0, additive: true, colorMid: '#9b6bff', sizeJitter: 0.3, erosion: 0,
    });
    this.shards = new Emitter({
      ...defaultSettings(), maxParticles: 700, rate: 0, lifetime: 1.3, lifetimeJitter: 0.4,
      shape: 'sphere', shapeSize: 0.3, speed: 7, speedJitter: 0.7, spread: 150, gravity: 14, drag: 0.4,
      sizeStart: 0.18, sizeEnd: 0.08, colorStart: '#59606c', colorEnd: '#1c2028',
      opacityStart: 1, opacityEnd: 0, additive: false, sizeJitter: 0.5, erosion: 0, groundFade: 0.2,
    });
    this.motes = new Emitter({
      ...defaultSettings(), maxParticles: 500, rate: 0, lifetime: 1.2, lifetimeJitter: 0.5,
      shape: 'sphere', shapeSize: 0.4, speed: 1.2, speedJitter: 0.6, spread: 180, gravity: -1.5, drag: 0.8,
      sizeStart: 0.14, sizeEnd: 0.03, colorStart: '#e8c86a', colorEnd: '#9b6bff',
      opacityStart: 0.9, opacityEnd: 0, additive: true, sizeJitter: 0.4, erosion: 0,
    });
    this.emitters.push(this.sparks, this.shards, this.motes, this.smoke.emitter);
    for (const e of this.emitters) this.group.add(e.points);

    for (let i = 0; i < COUNT; i++) {
      const ring = i < RING_N[0] ? 0 : i < RING_N[0] + RING_N[1] ? 1 : 2;
      const idx = ring === 0 ? i : ring === 1 ? i - RING_N[0] : i - RING_N[0] - RING_N[1];
      const wave = i % WAVES;
      const j = Math.floor(i / WAVES);
      const launch = 1.4 + 0.4 * wave + 0.22 * (((j * 5) % 12) / 11);
      this.swords.push({
        ring, ang: (idx / RING_N[ring]) * Math.PI * 2 + ring * 0.4, wave,
        appear: 0.3 + 0.5 * hash(i * 3.1), launch, land: launch + FLIGHT,
        hit: new THREE.Vector3(), stick: new THREE.Vector3(), landed: false,
      });
    }
    this.reset();
  }

  get duration() {
    return DURATION;
  }

  private rollSwords() {
    this.swords.forEach((s, i) => {
      const r = AREA * Math.sqrt(hash(i * 5.3 + 1));
      const th = hash(i * 7.9 + 2) * Math.PI * 2;
      s.hit.set(this.center.x + Math.cos(th) * r, 0, this.center.z + Math.sin(th) * r);
      const tilt = 0.08 + 0.32 * hash(i * 2.7 + 3), az = hash(i * 9.1 + 4) * Math.PI * 2;
      s.stick.set(Math.sin(tilt) * Math.cos(az), -Math.cos(tilt), Math.sin(tilt) * Math.sin(az));
      s.landed = false;
    });
  }

  cast(ctx: CastContext) {
    this.ctx = ctx;
    this.center.copy(ctx.point).setY(0);
    // Sigil face normal: mostly down, leaning back toward the caster (opposite the caster -> target direction).
    const k = (55 * Math.PI) / 180;
    const n = new THREE.Vector3(-Math.sin(ctx.aim) * Math.sin(k), -Math.cos(k), -Math.cos(ctx.aim) * Math.sin(k));
    this.sigilQuat.setFromUnitVectors(new THREE.Vector3(0, 0, 1), n);
    this.sigilGroup.quaternion.copy(this.sigilQuat);
    this.sigilGroup.position.set(this.center.x, SIGIL_Y, this.center.z);
    this.rollSwords();
    this.screen.silhouettes = [ctx.caster.group, ...ctx.targets.map((e) => e.group)];
    this.screen.focus.set(this.center.x, 1.5, this.center.z);
  }

  play() {
    this.reset();
    this.playing = true;
  }

  private reset() {
    this.time = 0;
    this.struck = false;
    this.smokeDone = false;
    this.shattered = false;
    this.spit = 0;
    this.shake = 0;
    this.cut.value = -100;
    for (const s of this.swords) s.landed = false;
    for (const w of this.waveHit) w.clear();
    clearScreenFx(this.screen);
    this.smoke.clear();
    for (const e of this.emitters) e.clear();
    this.layout(0);
  }

  update(dt: number) {
    for (const e of [this.sparks, this.shards, this.motes]) e.update(dt);
    this.smoke.update(dt);
    if (!this.playing) return;
    this.time += dt;
    let ended = false;
    if (this.time >= DURATION) {
      if (this.settings.loop) { this.play(); return; }
      this.playing = false;
      ended = true;
    }
    const t = this.time;
    if (dt > 0) {
      this.swords.forEach((s) => { if (!s.landed && t >= s.land) this.land(s); });
      if (!this.struck && t >= D) this.onStrike();
      if (!this.smokeDone && t >= D + 0.3) this.onSmoke();
      if (t > D + 0.1 && t < D + 0.7) {
        this.spit += dt;
        if (this.spit > 0.07) {
          this.spit = 0;
          const a = Math.random() * Math.PI * 2, r = 1 + Math.random() * 4;
          this.sparks.burst(6, new THREE.Vector3(this.center.x + Math.cos(a) * r, 0.15, this.center.z + Math.sin(a) * r));
        }
      }
      // The giant sword turns to motes from its buried tip upward.
      if (t > D + 0.3 && this.cut.value < SIGIL_Y) {
        this.motes.burst(14, new THREE.Vector3(
          this.center.x + (Math.random() - 0.5) * 0.5, this.cut.value + 0.1, this.center.z + (Math.random() - 0.5) * 0.3,
        ));
      }
    }
    for (const a of [...this.arcs, ...this.nova]) a.update(dt);
    this.layout(dt);
    if (ended) clearScreenFx(this.screen);
  }

  /** A small sword plants itself: sparks, a scar and a hit on any enemy within 1 m (once per enemy per wave). */
  private land(s: Sword) {
    s.landed = true;
    this.sparks.burst(8, new THREE.Vector3(s.hit.x, 0.15, s.hit.z));
    this.shards.burst(2, new THREE.Vector3(s.hit.x, 0.2, s.hit.z));
    const ctx = this.ctx;
    if (!ctx) return;
    ctx.targets.forEach((e, k) => {
      const tp = ctx.targetPos[k];
      if (!tp || this.waveHit[s.wave].has(k)) return;
      if (Math.hypot(tp.x - s.hit.x, tp.z - s.hit.z) < 1) {
        this.waveHit[s.wave].add(k);
        ctx.hit(e, { damage: 6, knock: 1.5, from: s.hit.clone() });
      }
    });
  }

  private onStrike() {
    this.struck = true;
    const g = this.center;
    this.sparks.burst(240, new THREE.Vector3(g.x, 0.4, g.z));
    this.shards.burst(60, new THREE.Vector3(g.x, 0.5, g.z));
    const ctx = this.ctx;
    if (ctx) {
      for (const e of ctx.targets) ctx.hit(e, { damage: this.settings.damage, knock: 6, from: g.clone() });
    }
  }

  private onSmoke() {
    this.smokeDone = true;
    const g = this.center;
    for (let k = 0; k < 3; k++) {
      const an = (k / 3) * Math.PI * 2 + 0.5;
      this.smoke.trigger(new THREE.Vector3(g.x + Math.cos(an) * 2.2, 0.5, g.z + Math.sin(an) * 2.2), 0.9, 0.8);
    }
  }

  /** Sigil scale: forms 0-0.8, holds, collapses 2.7-2.95. */
  private sigilScale(t: number) {
    return Math.max(1e-4, (0.15 + 0.85 * smoothstep(t / 0.8)) * (1 - 0.85 * smoothstep((t - 2.7) / 0.25)));
  }

  /** World position of a hanging sword's midpoint at time t. */
  private hang(s: Sword, t: number, out: THREE.Vector3) {
    const th = s.ang + (s.ring % 2 === 0 ? 1 : -1) * spinAt(t);
    const r = RING_R[s.ring] * this.sigilScale(t);
    return out.set(Math.cos(th) * r, Math.sin(th) * r, 0).applyQuaternion(this.sigilQuat)
      .add(this.p.set(this.center.x, SIGIL_Y, this.center.z));
  }

  private put(im: THREE.InstancedMesh[], i: number, tip: THREE.Vector3, d: THREE.Vector3, scale: number) {
    this.q.setFromUnitVectors(this.down, d);
    this.sc.setScalar(Math.max(1e-4, scale));
    this.m.compose(tip, this.q, this.sc);
    for (const x of im) x.setMatrixAt(i, this.m);
  }

  private layout(_dt: number) {
    const t = this.time;
    const after = t - D;
    const struck = t >= D;
    const ctx = this.ctx;
    const hasCtx = !!ctx;
    const g = this.center;
    const sw = [this.body, this.guard, this.edge];

    // --- 1. Screen: darken, focus lines into the drop, tight impact frames, chroma pulse. ---
    this.screen.darken = hasCtx
      ? (t < D ? 0.75 * smoothstep(t / 0.5) : 0.75 * Math.exp(-Math.max(0, after - 0.5) * 2.2))
      : 0;
    this.screen.speedLines = hasCtx ? (t > 2.7 && t < D ? 0.8 * smoothstep((t - 2.7) / 0.25) : struck ? Math.max(0, 0.8 - after * 8) : 0) : 0;
    this.screen.impact = hasCtx ? impactFrameAt(t, D, [1, 2], FRAME) : 0;
    this.screen.chroma = hasCtx ? chromaPulse(t, D) * 0.7 : 0;

    // --- 2. Sky sigil: draws itself (conic reveal), spins, collapses before the giant sword. ---
    const sigS = this.sigilScale(t);
    const sigFade = 1 - smoothstep((t - 2.8) / 0.2);
    this.sigilGroup.visible = hasCtx && t > 0.02 && sigFade > 0.002;
    this.sigilGroup.scale.setScalar(sigS);
    this.spinGroup.rotation.z = spinAt(t) * 0.35;
    this.sigilMat.uniforms.uReveal.value = smoothstep(t / 0.8);
    this.sigilMat.uniforms.uOpacity.value = sigFade * (0.55 + 0.1 * Math.sin(t * 8));
    this.sigilDarkMat.opacity = 0.5 * sigFade * smoothstep(t / 0.5);

    // Lock ring on the ground marks the area.
    this.lockRing.mesh.position.set(g.x, 0.05, g.z);
    this.lockRing.mesh.scale.setScalar(AREA + 0.7);
    this.lockRing.mesh.rotation.z = t * 0.5;
    this.lockRing.material.opacity = !hasCtx ? 0 : t < D
      ? 0.3 * smoothstep((t - 0.6) / 0.4)
      : 0.6 * Math.exp(-after * 8);

    // --- 3. The 36 swords. ---
    let flying = 0;
    this.swords.forEach((s, i) => {
      const pop = (t - s.appear) / 0.25;
      const hide = () => {
        this.put(sw, i, this.tip.set(0, -50, 0), this.down, 1e-4);
        this.put([this.streaks], i, this.tip.set(0, -50, 0), this.down, 1e-4);
      };
      let scarK = 0;
      if (!hasCtx || pop <= 0 || (struck && after > FRAME * 1.5)) { hide(); }
      else if (t < s.launch) {
        // Hanging blade-down on its ring, popping in with a small overshoot.
        const k = pop < 1 ? 1.12 * smoothstep(pop) : 1.12 - 0.12 * smoothstep((pop - 1) / 0.4);
        this.hang(s, t, this.mid);
        this.d.copy(this.down);
        this.tip.copy(this.mid).addScaledVector(this.d, 0.5 * S * k);
        this.put(sw, i, this.tip, this.d, S * k);
        this.put([this.streaks], i, this.tip, this.down, 1e-4);
      } else if (t < s.land) {
        // Streak down: ease-in along the line, turning from straight down to its stuck angle.
        const u = (t - s.launch) / FLIGHT;
        this.hang(s, s.launch, this.a0);
        this.d.copy(this.down).lerp(s.stick, smoothstep(u / 0.5)).normalize();
        this.b0.copy(s.hit).addScaledVector(s.stick, 0.3 * S * 0.5).addScaledVector(s.stick, -0.5 * S); // landing midpoint
        this.mid.lerpVectors(this.a0, this.b0, u * u);
        this.tip.copy(this.mid).addScaledVector(this.d, 0.5 * S);
        this.put(sw, i, this.tip, this.d, S);
        // Short streak behind the hilt.
        const len = 2.4 * Math.min(1, u * 4);
        this.p.copy(this.mid).addScaledVector(this.d, -(0.5 * S + len / 2));
        this.q.setFromUnitVectors(new THREE.Vector3(0, 1, 0), this.d);
        this.sc.set(0.07, Math.max(1e-4, len), 0.07);
        this.m.compose(this.p, this.q, this.sc);
        this.streaks.setMatrixAt(i, this.m);
        flying++;
      } else {
        // Stuck in the ground at an angle, tip sunk a little.
        this.d.copy(s.stick);
        this.tip.copy(s.hit).addScaledVector(s.stick, 0.3 * S * 0.5);
        const shiver = struck ? 0 : Math.exp(-(t - s.land) * 14) * 0.03;
        this.tip.x += shiver * Math.sin(t * 90);
        this.put(sw, i, this.tip, this.d, S);
        this.put([this.streaks], i, this.tip, this.down, 1e-4);
        scarK = smoothstep((t - s.land) / 0.1);
      }
      // Ground scar under each stuck sword.
      this.p.set(s.hit.x, 0.03, s.hit.z);
      this.q.setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI / 2);
      this.sc.set(Math.max(1e-4, 0.45 * scarK), Math.max(1e-4, 0.45 * scarK), 1);
      this.m.compose(this.p, this.q, this.sc);
      this.scars.setMatrixAt(i, this.m);
    });
    for (const im of [...sw, this.streaks, this.scars]) im.instanceMatrix.needsUpdate = true;
    this.scarMat.opacity = hasCtx ? 0.75 * (1 - smoothstep((after - 1.2) / 0.8)) : 0;
    this.scars.visible = this.scarMat.opacity > 0.002;
    this.streaks.visible = flying > 0;
    // All stuck swords flash at once as the giant lands.
    this.edgeMat.color.copy(EDGE).multiplyScalar(struck && after < FRAME * 1.5 ? 1.9 : 1);

    // --- 4. Thin arcs jump between hanging swords while the formation spins up. ---
    const bucket = Math.floor(t / 0.1);
    this.arcs.forEach((arc, k) => {
      arc.opacity = 0;
      if (!hasCtx || t < 0.8 || t > 2.6) return;
      const ia = Math.floor(hash(bucket * 3.7 + k * 11.3) * COUNT);
      const ib = (ia + 1 + Math.floor(hash(bucket * 1.9 + k) * 3)) % COUNT;
      const sa = this.swords[ia], sb = this.swords[ib];
      if (t >= sa.launch || t >= sb.launch || hash(bucket + k * 5.5) > 0.35 + 0.6 * smoothstep((t - 0.8) / 0.6)) return;
      this.hang(sa, t, this.a0);
      this.hang(sb, t, this.b0);
      this.a0.y -= S * 0.3;
      this.b0.y -= S * 0.3;
      arc.setEnds(this.a0, this.b0);
      arc.opacity = 0.8;
    });

    // --- 5. Giant sword: forms 2.6-2.8 at the sigil centre, hangs, drops 2.8-3.0, dissolves tip-up. ---
    const gAppear = smoothstep((t - 2.6) / 0.2);
    const drop = smoothstep((t - 2.8) / 0.2) ** 2;
    const startY = SIGIL_Y - 2.5, endY = -0.6;
    const gy = struck ? endY : THREE.MathUtils.lerp(startY, endY, drop);
    const gHang = hasCtx && t > 2.6 && this.cut.value < SIGIL_Y - 1;
    this.giant.visible = gHang;
    this.giant.position.set(g.x, gy, g.z);
    this.giant.scale.setScalar(Math.max(1e-4, GIANT * (0.3 + 0.7 * gAppear)));
    this.cut.value = hasCtx && after > 0.3 ? endY + 0.2 + (after - 0.3) * 7 : -100;
    this.giantEdgeMat.color.copy(EDGE).multiplyScalar(struck && after < FRAME * 3 ? 1.9 : 1);

    // --- 6. Impact: star pop, flash, shock ring, ground discharge, scorch. ---
    const f = struck && hasCtx ? Math.floor(after / FRAME) : -1;
    const pop = StarBurst.pop(after);
    this.star.set(this.p.set(g.x, 1.4, g.z), Math.max(1e-4, 4.2 * pop.scale), struck && hasCtx ? pop.opacity : 0, f * 0.3);
    this.flash.mesh.position.set(g.x, 1.0, g.z);
    this.flash.mesh.scale.setScalar(2.2 + Math.max(0, after) * 6);
    this.flash.opacity = struck && hasCtx ? 0.25 * Math.exp(-after * 14) : 0;
    this.shock.mesh.position.set(g.x, 0.06, g.z);
    this.shock.mesh.scale.setScalar(Math.max(1e-4, Math.min(8, 0.5 + Math.max(0, after) * 16)));
    this.shock.material.opacity = struck && hasCtx ? Math.max(0, 0.7 * (1 - after / 0.7)) : 0;
    this.nova.forEach((arc, i) => {
      if (!struck || !hasCtx || after > 1.7) { arc.opacity = 0; return; }
      const ang = (i / NOVA) * Math.PI * 2 + 0.3;
      const far = 2 + 3.5 * smoothstep(after / 0.5);
      const near = Math.min(far - 0.4, 0.4 + smoothstep((after - 0.6) / 0.8) * 4.6);
      this.a0.set(g.x + Math.cos(ang) * near, 0.2, g.z + Math.sin(ang) * near);
      this.b0.set(g.x + Math.cos(ang) * far, 0.2, g.z + Math.sin(ang) * far);
      arc.setEnds(this.a0, this.b0);
      arc.opacity = 0.95 * (1 - smoothstep((after - 1.3) / 0.4));
    });
    this.scorch.position.set(g.x, 0.03, g.z);
    this.scorch.scale.setScalar(2.4);
    this.scorchMat.opacity = struck && hasCtx ? 0.85 * (1 - smoothstep((after - 1.4) / 0.7)) : 0;
    this.scorch.visible = this.scorchMat.opacity > 0.002;

    // Stuck swords shatter at once on the first frame after impact.
    if (struck && !this.shattered && hasCtx) {
      this.shattered = true;
      for (const s of this.swords) {
        if (s.landed) this.shards.burst(5, new THREE.Vector3(s.hit.x, 0.8, s.hit.z));
      }
    }
    this.shake = struck ? Math.exp(-after * 5) : t > 1.4 && t < D ? 0.02 : 0;
  }
}

export const flyingSwordFormationModule: EffectModule = {
  label: 'flying sword formation',
  category: 'targeted',
  targeting: { mode: 'ground', radius: 5 },
  create: () => new FlyingSwordFormation(),
  telegraphs(effect) {
    const e = effect as FlyingSwordFormation;
    const c = e.ctx?.point;
    if (!c) return [];
    return [{ shape: { kind: 'circle', x: c.x, z: c.z, radius: 5 }, start: 0.8, impact: D }];
  },
  bloom: { enabled: true, strength: 0.6, radius: 0.5, threshold: 0.82 },
  frameCamera(camera, controls, effect) {
    const e = effect as FlyingSwordFormation;
    if (e.ctx) frameCast(camera, controls, e.ctx, SIGIL_Y + 3);
  },
  buildGui(f, effect) {
    const s = (effect as FlyingSwordFormation).settings;
    f.add(s, 'loop');
    f.add(s, 'damage', 1, 150, 1);
  },
};
