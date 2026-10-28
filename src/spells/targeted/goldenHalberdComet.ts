import * as THREE from 'three';
import { Emitter, defaultSettings } from '../../emitter';
import { LightPillar, createRing, smoothstep, softDotTexture } from '../../effects/common';
import {
  HeatHaze, ShockRefraction, SmokeBall, StarBurst, chromaPulse, clearScreenFx, createScreenFx, impactFrameAt,
} from '../../effects/parts';
import { frameCast, type CastContext } from '../../effects/targeting';
import type { Effect, EffectModule } from '../../effects/types';

/**
 * Golden Halberd Comet (targeted, single target): a 6 m dark-gold halberd (ji) forms in the caster's raised hand
 * out of converging gold motes and turns to aim, a needle-thin gold line marks the target, then it is hurled like
 * a comet: a gold trail over a wider black under-trail. It pierces the target, plants in the ground behind it
 * at a steep angle (gold impact frames, cool star, light pillar, ground cracks, black scorch) and stays
 * there like a monument until it breaks into gold motes from the tip down and the pillar collapses to a line.
 *
 * Recipes: a-lol-ashe-enchanted-crystal-arrow (one heavy projectile, long readable flight, long wake),
 * g-fuga-fire-arrow-pillar (pillar erupts at the landing), i-lanza-leaf-burst-needle-throw (needle line before
 * the throw, black smoke behind the bright shape).
 * Palette: ART_BIBLE Solar / holy row; the object is dark gold (#7a5a1a..#c9a24a) with thin bright edges.
 */
export interface GoldenHalberdCometSettings {
  damage: number;
  loop: boolean;
}

export const defaultGoldenHalberdComet = (): GoldenHalberdCometSettings => ({ damage: 60, loop: false });

const DURATION = 3.8;
const T_FORM = 0.65; // motes finish converging
const T_NEEDLE = 0.8;
const T_THROW = 1.0;
const D = 1.4; // impact
const BREAK0 = 2.5; // planted halberd starts breaking up (tip first)
const BREAK_STEP = 0.28;
const TIP = 3.0; // halberd local +Y tip; origin is the grip, the butt is at -2.75
const MOTES = 140;
const TRAIL_N = 28;
const TRAIL_SPAN = 0.85;
const MAX_CRACK = 24;
const END_ROLL = 0.35;
const BIG = 1.6; // planted size multiplier (grows during the aim)
const UP = new THREE.Vector3(0, 1, 0);

const GOLD = 0xc9a24a;
const DARK_GOLD = 0x7a5a1a;
const HOT = 0xffc247;
const BODY = 0xf2b53c;
const COOL = 0x6fe0ff;

/** Right-handed frame with local +Y along `f`, local X horizontal (so the blade faces the caster), then a roll. */
const _m = new THREE.Matrix4();
const _qr = new THREE.Quaternion();
function frameQ(f: THREE.Vector3, roll: number, side: THREE.Vector3, out: THREE.Quaternion) {
  const y = f.clone();
  if (y.lengthSq() < 1e-8) y.set(0, 1, 0);
  y.normalize();
  const x = new THREE.Vector3().crossVectors(UP, y);
  if (x.lengthSq() < 1e-4) x.copy(side);
  x.normalize();
  const z = new THREE.Vector3().crossVectors(x, y);
  _m.makeBasis(x, y, z);
  out.setFromRotationMatrix(_m);
  out.multiply(_qr.setFromAxisAngle(UP, roll));
}

/** Camera-independent strip along a polyline, colour head -> mid -> tail, fading and tapering to the tail. */
class Ribbon {
  readonly mesh: THREE.Mesh;
  private pos: Float32Array;
  private geo = new THREE.BufferGeometry();
  private mat: THREE.ShaderMaterial;
  private n: number;
  private t = new THREE.Vector3();
  private s = new THREE.Vector3();

  constructor(n: number, additive: boolean, head: number, mid: number, tail: number) {
    this.n = n;
    this.pos = new Float32Array(n * 2 * 3);
    const aT = new Float32Array(n * 2);
    const aS = new Float32Array(n * 2);
    const index: number[] = [];
    for (let i = 0; i < n; i++) {
      aT[i * 2] = aT[i * 2 + 1] = i / (n - 1);
      aS[i * 2] = -1;
      aS[i * 2 + 1] = 1;
      if (i < n - 1) {
        const a = i * 2;
        index.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
      }
    }
    this.geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    this.geo.setAttribute('aT', new THREE.BufferAttribute(aT, 1));
    this.geo.setAttribute('aS', new THREE.BufferAttribute(aS, 1));
    this.geo.setIndex(index);
    this.mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, side: THREE.DoubleSide,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
      uniforms: {
        uHead: { value: new THREE.Color(head) }, uMid: { value: new THREE.Color(mid) },
        uTail: { value: new THREE.Color(tail) }, uOpacity: { value: 0 },
      },
      vertexShader: /* glsl */ `
        attribute float aT; attribute float aS; varying float vT; varying float vS;
        void main() { vT = aT; vS = aS; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: /* glsl */ `
        uniform vec3 uHead, uMid, uTail; uniform float uOpacity; varying float vT; varying float vS;
        void main() {
          vec3 col = vT < 0.3 ? mix(uHead, uMid, vT / 0.3) : mix(uMid, uTail, (vT - 0.3) / 0.7);
          float edge = 1.0 - smoothstep(0.55, 1.0, abs(vS));
          float a = uOpacity * pow(1.0 - vT, 1.2) * edge;
          gl_FragColor = vec4(col, a);
        }`,
    });
    this.mesh = new THREE.Mesh(this.geo, this.mat);
    this.mesh.frustumCulled = false;
    this.mesh.visible = false;
  }

  /** `pts` head first; `vertical` picks the strip plane (two crossed strips read from any camera). */
  set(pts: THREE.Vector3[], width: number, vertical: boolean, fallback: THREE.Vector3, opacity: number) {
    this.mat.uniforms.uOpacity.value = opacity;
    this.mesh.visible = opacity > 0.003;
    if (!this.mesh.visible) return;
    const n = this.n;
    for (let i = 0; i < n; i++) {
      const a = pts[Math.min(i + 1, n - 1)], b = pts[Math.max(i - 1, 0)];
      this.t.subVectors(b, a);
      if (this.t.lengthSq() < 1e-8) this.t.copy(fallback);
      this.t.normalize();
      this.s.crossVectors(this.t, UP);
      if (this.s.lengthSq() < 1e-4) this.s.set(1, 0, 0);
      this.s.normalize();
      if (vertical) this.s.crossVectors(this.t, this.s).normalize();
      const w = width * Math.pow(1 - i / (n - 1), 0.8);
      const p = pts[i];
      this.pos[i * 6] = p.x - this.s.x * w;
      this.pos[i * 6 + 1] = p.y - this.s.y * w;
      this.pos[i * 6 + 2] = p.z - this.s.z * w;
      this.pos[i * 6 + 3] = p.x + this.s.x * w;
      this.pos[i * 6 + 4] = p.y + this.s.y * w;
      this.pos[i * 6 + 5] = p.z + this.s.z * w;
    }
    this.geo.attributes.position.needsUpdate = true;
  }
}

/** Crescent blade outline in the XY plane: horns toward -X, belly toward +X. */
function crescentShape(): THREE.Shape {
  const s = new THREE.Shape();
  s.absarc(0, 0, 0.9, -1.2, 1.2, false);
  s.absarc(-0.7, 0, 1.324, 0.6857, -0.6857, true);
  s.closePath();
  return s;
}

export class GoldenHalberdComet implements Effect {
  readonly group = new THREE.Group();
  readonly settings: GoldenHalberdCometSettings;
  readonly emitters: Emitter[] = [];
  readonly screen = createScreenFx();
  shake = 0;
  playing = false;

  /** Last cast; frameCamera and telegraphs read it. Null until the first play(). */
  ctx: CastContext | null = null;
  private time = 0;
  private impacted = false;
  private broke = [false, false, false, false];

  // Cast geometry, computed in cast().
  private hand = new THREE.Vector3(0, 3, 0);
  private chest = new THREE.Vector3(0, 1.3, -1);
  private fAim = new THREE.Vector3(0, 0, -1);
  private fEnd = new THREE.Vector3(0, -0.8, -0.6).normalize();
  private oEnd = new THREE.Vector3(0, 2.4, -1);
  private ctrl = new THREE.Vector3(0, 6, 0);
  private entry = new THREE.Vector3(0, 0, -1);
  private dirXZ = new THREE.Vector3(0, 0, -1);
  private side = new THREE.Vector3(1, 0, 0);

  // The object.
  private halberd = new THREE.Group();
  private segs: THREE.Group[] = [new THREE.Group(), new THREE.Group(), new THREE.Group(), new THREE.Group()];
  private segY = [2.3, 1.2, 0.7, -1.3];
  private bodyMat = new THREE.MeshStandardMaterial({ color: DARK_GOLD, metalness: 0.7, roughness: 0.4, emissive: 0x3a2a08, emissiveIntensity: 0.5 });
  private goldMat = new THREE.MeshStandardMaterial({ color: GOLD, metalness: 0.75, roughness: 0.32, emissive: DARK_GOLD, emissiveIntensity: 0.5 });
  private redMat = new THREE.MeshStandardMaterial({ color: 0xb3202a, roughness: 0.7, emissive: 0x5a0a10, emissiveIntensity: 0.6 });
  private gemMat = new THREE.MeshStandardMaterial({ color: 0xc0302a, emissive: 0xff4f2b, emissiveIntensity: 0.9, roughness: 0.3 });
  private edgeMat = new THREE.LineBasicMaterial({ color: 0xffe8a8 });
  private tassel = new THREE.Group();

  // Layers.
  private motePos = new Float32Array(MOTES * 3);
  private moteSeed = Array.from({ length: MOTES }, () => ({
    a: Math.random() * Math.PI * 2, r: 2.5 + Math.random() * 3.5, h: Math.random(), s: -2.6 + Math.random() * 5.6, d: Math.random() * 0.45,
  }));
  private moteGeo = new THREE.BufferGeometry();
  private moteMat = new THREE.PointsMaterial({
    size: 0.14, map: softDotTexture(), color: 0xffd27a, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false,
  });
  private motes = new THREE.Points(this.moteGeo, this.moteMat);
  private needleMat = new THREE.MeshBasicMaterial({ color: 0xffe39a, transparent: true, opacity: 0, depthWrite: false });
  private needle = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 1, 6), this.needleMat);
  private glint = new StarBurst({ points: 4, inner: 0.12, jitter: 0, color: 0xffd27a, core: 0xffffff, additive: false });
  private blackTrail = [new Ribbon(TRAIL_N, false, 0x0a0806, 0x1c1408, 0x2a1a08), new Ribbon(TRAIL_N, false, 0x0a0806, 0x1c1408, 0x2a1a08)];
  private goldTrail = [new Ribbon(TRAIL_N, true, HOT, 0xc9822a, 0x7a4a10), new Ribbon(TRAIL_N, true, HOT, 0xc9822a, 0x7a4a10)];
  private trailPts = Array.from({ length: TRAIL_N }, () => new THREE.Vector3());
  private pillar = new LightPillar(HOT, 0.4);
  private ring = createRing(HOT, 0.93, 1, 96);
  private ring2 = createRing(BODY, 0.95, 1, 96);
  private shockWave = new ShockRefraction({ facing: 'ground', width: 0.3 });
  private haze = new HeatHaze({ width: 3, height: 5 });
  private scorchMat = new THREE.MeshBasicMaterial({ color: 0x0a0704, transparent: true, opacity: 0, depthWrite: false });
  private scorch = new THREE.Mesh(new THREE.CircleGeometry(1, 40), this.scorchMat);
  private crackGeo = new THREE.PlaneGeometry(1, 1).translate(0.5, 0, 0);
  private crackBlackMat = new THREE.MeshBasicMaterial({ color: 0x0a0704, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide });
  private crackGoldMat = new THREE.MeshBasicMaterial({ color: 0xe8b040, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide });
  private crackBlack = new THREE.InstancedMesh(this.crackGeo, this.crackBlackMat, MAX_CRACK);
  private crackGold = new THREE.InstancedMesh(this.crackGeo, this.crackGoldMat, MAX_CRACK);
  private cracks: { x: number; z: number; a: number; len: number; delay: number; w: number }[] = [];
  private starGold = new StarBurst({ points: 12, color: BODY, core: 0xfff4d6, additive: false });
  private starCool = new StarBurst({ points: 8, inner: 0.2, color: COOL, core: 0xcff6ff, additive: false });
  private smoke = new SmokeBall({ color: 0x120c06, rim: 0x4a3818, flake: '#1a1208', maxBalls: 2 });
  private sparks: Emitter;
  private peel: Emitter;
  private under: Emitter;
  private leaf: Emitter;

  constructor(settings: GoldenHalberdCometSettings = defaultGoldenHalberdComet()) {
    this.settings = settings;
    this.screen.tint.set(0x4a3a24);
    this.screen.impactColor.set(BODY);
    this.screen.speedLineColor.set(0xffe39a);
    this.screen.edgeTint.set(HOT);
    this.buildHalberd();

    this.moteGeo.setAttribute('position', new THREE.BufferAttribute(this.motePos, 3));
    this.motes.frustumCulled = false;
    this.needle.visible = false;
    this.crackBlack.frustumCulled = false;
    this.crackGold.frustumCulled = false;
    this.crackBlack.count = 0;
    this.crackGold.count = 0;
    this.scorch.rotation.x = -Math.PI / 2;
    this.scorch.visible = false;
    this.blackTrail.forEach((r, i) => { r.mesh.renderOrder = 1 + i; });
    this.goldTrail.forEach((r, i) => { r.mesh.renderOrder = 3 + i; });
    this.group.add(this.halberd, this.motes, this.needle, this.glint.mesh);
    for (const r of [...this.blackTrail, ...this.goldTrail]) this.group.add(r.mesh);
    this.group.add(this.scorch, this.crackBlack, this.crackGold, this.ring.mesh, this.ring2.mesh, this.pillar.mesh, this.shockWave.mesh, this.haze.mesh);
    this.group.add(this.starGold.mesh, this.starCool.mesh, this.smoke.mesh);

    this.sparks = new Emitter({
      ...defaultSettings(), maxParticles: 900, rate: 0, lifetime: 0.7, lifetimeJitter: 0.5,
      shape: 'sphere', shapeSize: 0.3, speed: 11, speedJitter: 0.6, spread: 95, gravity: 12, drag: 1.2,
      sizeStart: 0.12, sizeEnd: 0.02, colorStart: '#ffe39a', colorEnd: '#c9822a',
      opacityStart: 0.9, opacityEnd: 0, additive: true, sizeJitter: 0.3, erosion: 0,
    });
    this.peel = new Emitter({
      ...defaultSettings(), maxParticles: 900, rate: 0, lifetime: 0.45, lifetimeJitter: 0.5,
      shape: 'sphere', shapeSize: 0.35, speed: 3, speedJitter: 0.8, spread: 180, gravity: 4, drag: 2.2,
      sizeStart: 0.1, sizeEnd: 0.02, colorStart: '#ffe39a', colorEnd: '#c9822a',
      opacityStart: 0.8, opacityEnd: 0, additive: true, sizeJitter: 0.3, erosion: 0,
    });
    // Small, short, dark smoke: normal-blended so it sits black behind the gold.
    this.under = new Emitter({
      ...defaultSettings(), maxParticles: 400, rate: 0, lifetime: 0.5, lifetimeJitter: 0.4,
      shape: 'sphere', shapeSize: 0.3, speed: 1.2, speedJitter: 0.6, spread: 180, gravity: 0, drag: 2,
      sizeStart: 0.4, sizeEnd: 0.8, colorStart: '#1c140a', colorEnd: '#0a0704',
      opacityStart: 0.55, opacityEnd: 0, additive: false, sizeJitter: 0.4, erosion: 0.5, spin: 1.2,
    });
    // Gold leaf / qi motes that drift up off the planted halberd and fly off as it breaks.
    this.leaf = new Emitter({
      ...defaultSettings(), maxParticles: 900, rate: 0, lifetime: 1.6, lifetimeJitter: 0.5,
      shape: 'sphere', shapeSize: 0.3, speed: 1.6, speedJitter: 0.7, spread: 120, gravity: -1.1, drag: 0.9,
      sizeStart: 0.17, sizeEnd: 0.02, colorStart: '#ffe39a', colorEnd: '#a8741c', colorMid: '#f2b53c',
      opacityStart: 0.6, opacityEnd: 0, additive: true, sizeJitter: 0.5, erosion: 0.4, spin: 1.5,
    });
    this.emitters.push(this.sparks, this.peel, this.under, this.leaf, this.smoke.emitter);
    for (const e of this.emitters) this.group.add(e.points);
    this.reset();
  }

  /** The object: dark-gold body, gold crescents and collar, bright thin edges, a red tassel, one red gem. */
  private buildHalberd() {
    const [sTip, sHead, sUp, sLow] = this.segs;
    const edges = (mesh: THREE.Mesh, parent: THREE.Object3D) => {
      const l = new THREE.LineSegments(new THREE.EdgesGeometry(mesh.geometry, 20), this.edgeMat);
      l.position.copy(mesh.position);
      l.rotation.copy(mesh.rotation);
      l.scale.copy(mesh.scale);
      parent.add(l);
    };
    // Spear tip: a flattened four-sided cone (leaf blade) on a gold collar.
    const tip = new THREE.Mesh(new THREE.ConeGeometry(0.2, 1.5, 4), this.goldMat);
    tip.position.y = 2.25;
    tip.rotation.y = Math.PI / 4;
    tip.scale.z = 0.45;
    const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.12, 0.16, 10), this.goldMat);
    collar.position.y = 1.5;
    sTip.add(tip, collar);
    edges(tip, sTip);

    // Two crescent blades, one each side, plus a red gem between them.
    const geo = new THREE.ExtrudeGeometry(crescentShape(), { depth: 0.07, bevelEnabled: false });
    geo.translate(0, 0, -0.035);
    for (let i = 0; i < 2; i++) {
      const c = new THREE.Mesh(geo, this.goldMat);
      c.position.set(i === 0 ? -0.3 : 0.3, 1.25, 0);
      c.rotation.z = i === 0 ? 0 : Math.PI;
      c.scale.setScalar(1.0);
      sHead.add(c);
      edges(c, sHead);
    }
    const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.1), this.gemMat);
    gem.position.set(0, 1.25, 0.07);
    gem.scale.y = 1.4;
    const head = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.5, 10), this.goldMat);
    head.position.y = 1.25;
    sHead.add(head, gem);

    // Red tassel hanging toward the butt from the head; swayed in layout().
    this.tassel.position.set(0, 0.98, 0);
    const knot = new THREE.Mesh(new THREE.SphereGeometry(0.08, 10, 8), this.redMat);
    this.tassel.add(knot);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const strand = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.008, 1.1, 5), this.redMat);
      strand.position.set(Math.cos(a) * 0.06, -0.58 - (i % 2) * 0.08, Math.sin(a) * 0.06);
      this.tassel.add(strand);
    }
    sHead.add(this.tassel);

    // Shaft: two dark-gold lengths with gold bands, then a butt spike.
    const up = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.065, 1.9, 10), this.bodyMat);
    up.position.y = 0.95;
    sUp.add(up);
    const low = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.065, 2.7, 10), this.bodyMat);
    low.position.y = -1.35;
    sLow.add(low);
    const band = (y: number, parent: THREE.Object3D) => {
      const b = new THREE.Mesh(new THREE.CylinderGeometry(0.095, 0.095, 0.1, 10), this.goldMat);
      b.position.y = y;
      parent.add(b);
    };
    band(1.85, sUp); band(0.9, sUp); band(0.1, sUp);
    band(-0.6, sLow); band(-1.5, sLow); band(-2.4, sLow);
    const butt = new THREE.Mesh(new THREE.SphereGeometry(0.11, 12, 8), this.goldMat);
    butt.position.y = -2.78;
    sLow.add(butt);
    this.halberd.add(...this.segs);
  }

  get duration() {
    return DURATION;
  }

  get impactTime() {
    return D;
  }

  cast(ctx: CastContext) {
    this.ctx = ctx;
    const fwd = new THREE.Vector3(Math.sin(ctx.aim), 0, Math.cos(ctx.aim));
    const right = new THREE.Vector3(-fwd.z, 0, fwd.x);
    this.hand.copy(ctx.from).addScaledVector(right, 0.5).addScaledVector(fwd, 0.3).setY(3.0);
    const target = ctx.targetPos[0] ?? ctx.point;
    this.chest.copy(target).setY(1.3);
    // Horizontal direction caster -> target; never a zero vector.
    this.dirXZ.set(target.x - ctx.from.x, 0, target.z - ctx.from.z);
    if (this.dirXZ.lengthSq() < 0.25) this.dirXZ.copy(fwd).multiplyScalar(-1);
    this.dirXZ.normalize();
    this.side.set(this.dirXZ.z, 0, -this.dirXZ.x);

    this.fAim.subVectors(this.chest, this.hand);
    if (this.fAim.lengthSq() < 1e-4) this.fAim.copy(this.dirXZ);
    this.fAim.normalize();

    // Plant: tip goes 0.4 m behind the target and 0.5 m under the ground, steep, leaning away from the caster.
    this.fEnd.copy(this.dirXZ).multiplyScalar(0.342).setY(-0.94).normalize();
    const tipEnd = new THREE.Vector3().copy(target).addScaledVector(this.dirXZ, 0.4).setY(-0.5);
    this.oEnd.copy(tipEnd).addScaledVector(this.fEnd, -TIP * BIG);
    const s = -tipEnd.y / this.fEnd.y;
    this.entry.copy(tipEnd).addScaledVector(this.fEnd, s).setY(0);

    // Bezier whose end tangent is exactly the plant direction.
    const start = this.hand.clone();
    const L = start.distanceTo(this.oEnd);
    const k = THREE.MathUtils.clamp(L * 0.45, 2.5, 7);
    this.ctrl.copy(this.oEnd).addScaledVector(this.fEnd, -k);
    this.screen.silhouettes = [ctx.caster.group, ...ctx.targets.map((e) => e.group), this.halberd];
    this.screen.focus.copy(this.chest);
  }

  play() {
    this.reset();
    this.playing = true;
  }

  private reset() {
    this.time = 0;
    this.impacted = false;
    this.broke = [false, false, false, false];
    this.shake = 0;
    this.cracks = [];
    this.crackBlack.count = 0;
    this.crackGold.count = 0;
    clearScreenFx(this.screen);
    this.smoke.clear();
    for (const e of this.emitters) e.clear();
    this.layout(0);
  }

  update(dt: number) {
    for (const e of this.emitters) if (e !== this.smoke.emitter) e.update(dt);
    this.smoke.update(dt);
    if (!this.playing) return;
    this.time += dt;
    if (this.time >= DURATION) {
      if (this.settings.loop) { this.play(); return; }
      this.playing = false;
      clearScreenFx(this.screen);
    }
    if (!this.impacted && this.time >= D) this.onImpact();
    for (let i = 0; i < 4; i++) if (!this.broke[i] && this.time >= BREAK0 + i * BREAK_STEP) this.onBreak(i);
    this.layout(dt);
  }

  /** Halberd grip position on the flight curve, u in 0..1. */
  private bez(u: number, out: THREE.Vector3) {
    const k = 1 - u;
    return out.set(
      k * k * this.hand.x + 2 * k * u * this.ctrl.x + u * u * this.oEnd.x,
      k * k * this.hand.y + 2 * k * u * this.ctrl.y + u * u * this.oEnd.y,
      k * k * this.hand.z + 2 * k * u * this.ctrl.z + u * u * this.oEnd.z,
    );
  }

  private bezTangent(u: number, out: THREE.Vector3) {
    const k = 1 - u;
    out.set(
      2 * k * (this.ctrl.x - this.hand.x) + 2 * u * (this.oEnd.x - this.ctrl.x),
      2 * k * (this.ctrl.y - this.hand.y) + 2 * u * (this.oEnd.y - this.ctrl.y),
      2 * k * (this.ctrl.z - this.hand.z) + 2 * u * (this.oEnd.z - this.ctrl.z),
    );
    return out.lengthSq() < 1e-8 ? out.copy(this.fAim) : out.normalize();
  }

  private layout(dt: number) {
    const t = this.time;
    const after = t - D;
    const u = THREE.MathUtils.clamp((t - T_THROW) / (D - T_THROW), 0, 1);
    const flying = t >= T_THROW && !this.impacted;
    const fadeEnd = 1 - smoothstep((t - 3.3) / 0.5);

    // --- Grade, speed lines, impact frames, chroma. ---
    const sc = this.screen;
    sc.darken = t < D ? 0.5 * smoothstep(t / 0.35) : 0.5 * Math.exp(-Math.max(0, after - 0.1) * 2.5);
    sc.speedLines = t < D ? 0.7 * smoothstep((t - 0.95) / 0.15) : Math.max(0, 0.7 - after * 5);
    sc.impact = impactFrameAt(t, D, [1, 2], 0.04);
    sc.chroma = chromaPulse(t, D, 0.5, 10);

    // --- Orientation and position of the halberd. ---
    const origin = new THREE.Vector3();
    const f = new THREE.Vector3();
    const q = new THREE.Quaternion();
    let roll = END_ROLL;
    if (t < T_THROW) {
      // Held in the hand: forms upright, then turns to aim.
      const e = smoothstep((t - 0.3) / 0.5);
      f.copy(UP).addScaledVector(this.dirXZ, 0.15).lerp(this.fAim, e).normalize();
      origin.copy(this.hand).add(new THREE.Vector3(0, 0.25 + 0.06 * Math.sin(t * 7), 0));
    } else if (!this.impacted) {
      this.bez(u, origin);
      this.bezTangent(u, f);
      f.lerpVectors(this.fAim, f, smoothstep(u / 0.35)).normalize();
      roll = END_ROLL + (1 - smoothstep(u)) * Math.PI * 3;
      origin.y += 0; // origin follows the curve exactly; the 0.25 hold offset is gone by the throw
    } else {
      // Planted, with a short settle wobble.
      origin.copy(this.oEnd);
      const wob = 0.07 * Math.exp(-after * 5) * Math.sin(after * 32);
      f.copy(this.fEnd).addScaledVector(this.side, wob).normalize();
    }
    frameQ(f, roll, this.side, q);
    const form = smoothstep((t - 0.05) / 0.6);
    this.halberd.visible = t > 0.08;
    this.halberd.position.copy(origin);
    this.halberd.quaternion.copy(q);
    const big = 1 + (BIG - 1) * smoothstep((t - 0.7) / 0.4);
    this.halberd.scale.setScalar(big * (0.35 + 0.65 * form));

    // Material state: emissive pulse while planted, spike on the hit. Always <= 1.5.
    const pulse = 0.5 + 0.12 * Math.sin(t * 5);
    const spike = this.impacted ? 0.9 * Math.exp(-after * 6) : 0;
    this.goldMat.emissiveIntensity = pulse + spike;
    this.bodyMat.emissiveIntensity = pulse * 0.8 + spike * 0.5;
    this.gemMat.emissiveIntensity = 0.9 + 0.3 * Math.sin(t * 6) + spike;
    // Tassel streams backward in flight and sways when held or planted.
    // The tassel hangs with gravity when the halberd is held or planted (it then points up the shaft otherwise).
    const hang = flying ? 0 : 0.85;
    this.tassel.quaternion.slerpQuaternions(new THREE.Quaternion(), q.clone().invert(), hang);
    this.tassel.rotateX((flying ? 0.12 : 0.3) * Math.sin(t * 8));
    this.tassel.rotateZ((flying ? 0.1 : 0.25) * Math.sin(t * 6.3 + 1));
    this.segs.forEach((s, i) => { s.visible = t < BREAK0 + i * BREAK_STEP; });

    // --- Converging motes (0 .. T_FORM) onto the halberd body. ---
    const gripF = f.clone();
    for (let i = 0; i < MOTES; i++) {
      const m = this.moteSeed[i];
      const k = THREE.MathUtils.clamp((t / T_FORM - m.d) / (1 - m.d), 0, 1);
      const e = k * k * (3 - 2 * k);
      const r = m.r * (1 - e);
      const a = m.a + k * 4;
      this.motePos[i * 3] = origin.x + gripF.x * m.s * big + Math.cos(a) * r;
      this.motePos[i * 3 + 1] = origin.y + gripF.y * m.s * big + (m.h - 0.5) * 3 * (1 - e);
      this.motePos[i * 3 + 2] = origin.z + gripF.z * m.s * big + Math.sin(a) * r;
    }
    this.moteGeo.attributes.position.needsUpdate = true;
    this.moteMat.opacity = t < T_FORM ? 0.75 * smoothstep(t / 0.2) : 0;

    // --- Needle line from the tip to the target, a glint at the tip (dead beat after). ---
    const tipW = new THREE.Vector3().copy(origin).addScaledVector(f, TIP * big * (0.35 + 0.65 * form));
    const nA = smoothstep((t - T_NEEDLE) / 0.03) * (1 - smoothstep((t - 0.9) / 0.1));
    if (nA > 0.01 && t < T_THROW) {
      const dir = new THREE.Vector3().subVectors(this.chest, tipW);
      const len = Math.max(dir.length(), 1e-3);
      this.needle.visible = true;
      this.needle.position.copy(tipW).addScaledVector(dir, 0.5);
      this.needle.quaternion.setFromUnitVectors(UP, dir.divideScalar(len));
      this.needle.scale.set(0.022, len, 0.022);
      this.needleMat.opacity = nA;
    } else {
      this.needle.visible = false;
    }
    const gp = StarBurst.pop(t - T_NEEDLE, 0.06, 0.16);
    this.glint.set(tipW, 0.9 * gp.scale, gp.opacity, t * 3);

    // --- Comet trail: gold strip over a wider black under-strip, following the curve. ---
    const fb = this.dirXZ;
    const tOp = this.impacted ? Math.exp(-after * 10) : smoothstep(u / 0.08);
    for (let i = 0; i < TRAIL_N; i++) this.bez(Math.max(0, u - (i / (TRAIL_N - 1)) * TRAIL_SPAN), this.trailPts[i]);
    const live = t >= T_THROW;
    this.blackTrail[0].set(this.trailPts, 1.15, false, fb, live ? 0.75 * tOp : 0);
    this.blackTrail[1].set(this.trailPts, 1.15, true, fb, live ? 0.75 * tOp : 0);
    this.goldTrail[0].set(this.trailPts, 0.5, false, fb, live ? 0.5 * tOp : 0);
    this.goldTrail[1].set(this.trailPts, 0.5, true, fb, live ? 0.5 * tOp : 0);
    if (flying && dt > 0) {
      const back = new THREE.Vector3().copy(origin).addScaledVector(f, -1.2);
      this.peel.burst(6, back);
      this.under.burst(2, this.trailPts[5]);
    }
    if (this.impacted && t < BREAK0 + 0.1 && dt > 0 && Math.random() < 0.6) {
      // Gold leaf drifts up off the planted halberd.
      this.leaf.burst(1, origin.clone().addScaledVector(this.fEnd, (-TIP + 1 + Math.random() * 4.2) * BIG));
    }

    // --- Impact set pieces at the ground entry point and on the target. ---
    const E = this.entry;
    const pos0 = new THREE.Vector3();
    const ringA = after > 0 ? Math.max(0, 0.35 * (1 - after / 0.5)) : 0;
    this.ring.mesh.position.set(E.x, 0.05, E.z);
    this.ring.mesh.scale.setScalar(Math.max(1e-3, 0.6 + Math.max(0, after) * 24));
    this.ring.material.opacity = ringA;
    const a2 = after - 0.1;
    this.ring2.mesh.position.set(E.x, 0.06, E.z);
    this.ring2.mesh.scale.setScalar(Math.max(1e-3, 0.5 + Math.max(0, a2) * 14));
    this.ring2.material.opacity = a2 > 0 ? Math.max(0, 0.3 * (1 - a2 / 0.7)) : 0;

    // Refraction ring with the gold ring (0.45 s), and a short heat shimmer over the planted halberd.
    const rp = THREE.MathUtils.clamp(after / 0.45, 0, 1);
    this.shockWave.set(pos0.set(E.x, 0, E.z), 0.6 + Math.max(0, after) * 24, this.impacted && rp < 1 ? 0.045 * (1 - rp) * (1 - rp) : 0);
    this.haze.set(pos0.set(E.x, 0, E.z), this.impacted ? 0.012 * smoothstep(after / 0.15) * (1 - smoothstep((after - 0.6) / 1.2)) : 0, t, 0.9);

    // Light pillar: erupts, flickers, holds low, then collapses to a line and goes out.
    if (this.impacted) {
      const rise = smoothstep(after / 0.12);
      const hold = 0.3 * Math.exp(-after * 5);
      const flick = 1 + 0.12 * Math.sin(t * 40) * Math.sin(t * 13);
      const collapse = smoothstep((after - 0.1) / 0.5);
      this.pillar.set(E.x, E.z, 0, 14 * rise, hold * (1 - smoothstep((after - 0.3) / 0.3)));
      this.pillar.mesh.scale.x = Math.max(0.03, flick * (1 - 0.95 * collapse));
      this.pillar.mesh.scale.z = this.pillar.mesh.scale.x;
    } else {
      this.pillar.set(E.x, E.z, 0, 1, 0);
    }

    // Black scorch disc under it all.
    this.scorch.visible = this.impacted;
    this.scorch.position.set(E.x, 0.03, E.z);
    this.scorch.scale.setScalar(Math.max(1e-3, 1.6 * smoothstep(after / 0.15)));
    this.scorchMat.opacity = this.impacted ? 0.6 * fadeEnd : 0;

    // Ground cracks grow outward from the entry point; the gold glow inside them dies first.
    const m = new THREE.Matrix4();
    const qc = new THREE.Quaternion();
    const qx = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI / 2);
    const qy = new THREE.Quaternion();
    const pos = new THREE.Vector3();
    const scl = new THREE.Vector3();
    this.cracks.forEach((c, i) => {
      const g = THREE.MathUtils.clamp((after - c.delay) / 0.12, 0, 1);
      qy.setFromAxisAngle(UP, -c.a);
      qc.copy(qy).multiply(qx);
      pos.set(c.x, 0.035, c.z);
      this.crackBlack.setMatrixAt(i, m.compose(pos, qc, scl.set(Math.max(1e-4, c.len * g), c.w, 1)));
      pos.y = 0.05;
      this.crackGold.setMatrixAt(i, m.compose(pos, qc, scl.set(Math.max(1e-4, c.len * g), c.w * 0.3, 1)));
    });
    this.crackBlack.instanceMatrix.needsUpdate = true;
    this.crackGold.instanceMatrix.needsUpdate = true;
    this.crackBlackMat.opacity = this.impacted ? 0.85 * fadeEnd : 0;
    this.crackGoldMat.opacity = this.impacted ? (0.9 * Math.exp(-Math.max(0, after - 0.4) * 1.2)) * fadeEnd : 0;

    // Stars on the target: a gold toon star, then a small cool one for two frames. Frames first, stars after.
    const sg = StarBurst.pop(after - 0.08, 0.06, 0.14);
    this.starGold.set(this.chest, 3.2 * sg.scale, sg.opacity, 0.3);
    const cp = StarBurst.pop(after - 0.08, 0.02, 0.05);
    this.starCool.set(this.chest, 1.6 * cp.scale, cp.opacity, -0.4);

    this.shake = this.impacted ? 0.7 * Math.exp(-after * 6) : flying ? 0.05 : 0;
  }

  private onImpact() {
    this.impacted = true;
    const E = this.entry;
    this.sparks.burst(220, this.chest);
    this.sparks.burst(160, new THREE.Vector3(E.x, 0.3, E.z));
    this.leaf.burst(80, new THREE.Vector3(E.x, 0.4, E.z));
    this.smoke.trigger(new THREE.Vector3(E.x, 0.3, E.z), 0.9, 0.8);
    // Cracks: 10 jagged two-piece lines radiating from the entry point.
    this.cracks = [];
    const base = Math.random() * Math.PI * 2;
    for (let k = 0; k < 10; k++) {
      const a0 = base + (k / 10) * Math.PI * 2 + (Math.random() - 0.5) * 0.4;
      const l1 = 1.0 + Math.random() * 1.6;
      this.cracks.push({ x: E.x, z: E.z, a: a0, len: l1, delay: 0.02, w: 0.3 });
      const a1 = a0 + (Math.random() - 0.5) * 1.0;
      this.cracks.push({
        x: E.x + Math.cos(a0) * l1, z: E.z + Math.sin(a0) * l1, a: a1, len: 0.6 + Math.random() * 1.2, delay: 0.14, w: 0.2,
      });
    }
    this.crackBlack.count = this.cracks.length;
    this.crackGold.count = this.cracks.length;
    const ctx = this.ctx;
    if (ctx) {
      ctx.targets.forEach((e, i) => ctx.hit(e, { damage: i === 0 ? this.settings.damage : 15, knock: 6, from: ctx.from, color: '#ffd27a' }));
    }
  }

  /** Segment i (0 = tip) breaks into gold motes at its place on the planted halberd. */
  private onBreak(i: number) {
    this.broke[i] = true;
    const p = this.halberd.localToWorld(new THREE.Vector3(0, this.segY[i], 0));
    this.leaf.burst(90, p);
    this.sparks.burst(24, p);
  }
}

export const goldenHalberdCometModule: EffectModule = {
  label: 'golden halberd comet',
  category: 'targeted',
  targeting: { mode: 'enemy' },
  create: () => new GoldenHalberdComet(),
  telegraphs(effect) {
    const e = effect as GoldenHalberdComet;
    const ctx = e.ctx;
    const c = ctx?.targetPos[0] ?? ctx?.point;
    if (!ctx || !c) return [];
    return [{ shape: { kind: 'line', x1: ctx.from.x, z1: ctx.from.z, x2: c.x, z2: c.z, width: 1.4 }, start: T_NEEDLE, impact: D }];
  },
  bloom: { enabled: true, strength: 0.6, radius: 0.5, threshold: 0.82 },
  frameCamera(camera, controls, effect) {
    const e = effect as GoldenHalberdComet;
    if (e.ctx) frameCast(camera, controls, e.ctx, 8);
  },
  buildGui(f, effect) {
    const s = (effect as GoldenHalberdComet).settings;
    f.add(s, 'loop');
    f.add(s, 'damage', 1, 150, 1);
  },
};
