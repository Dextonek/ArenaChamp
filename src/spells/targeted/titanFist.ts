import * as THREE from 'three';
import { Emitter, defaultSettings } from '../../emitter';
import { createRing, smoothstep } from '../../effects/common';
import {
  HeatHaze, ShockRefraction, SmokeBall, StarBurst, chromaPulse, clearScreenFx, createScreenFx, impactFrameAt,
} from '../../effects/parts';
import { frameCast, type CastContext } from '../../effects/targeting';
import type { Effect, EffectModule } from '../../effects/types';

/**
 * Titan Fist (targeted, single enemy, earth/lava): glowing lava cracks race across the ground under the chosen
 * enemy and the soil bulges, then a colossal faceted basalt fist (forearm, hand block, four knuckles, curled
 * fingers, thumb; lava only in the thin seams between the blocks) erupts in an uppercut and carries the enemy five
 * metres up. It holds there for a dead beat, then the arm crumbles from the hand down into boulders that sink
 * while the enemy falls back and lands. The cracks cool from orange to dark.
 *
 * Recipes: c-ground-slam-shockwave-ring (ground ring), h-beyondfx-botw-bomb-explosion (small dark lit smoke, colour
 * only in small accents), f-swipe-launch-slam (launch up, then slam down).
 */
export interface TitanFistSettings {
  damage: number;
  loop: boolean;
}

export const defaultTitanFist = (): TitanFistSettings => ({ damage: 60, loop: false });

// Timeline (seconds).
const CRACK_END = 0.6;
const D = 0.95; // the fist erupts
const RISE = 0.2;
const FALL_START = 1.95;
const LAND = 2.5;
const DURATION = 4.2;

const LIFT = 6.9; // knuckle top height when the fist holds
const SUNK = 9; // how far below ground the fist starts

const LAVA = 0xe0601a;
const LAVA_DARK = 0x2a1208;
const BASALT_A = 0x3a3430;
const BASALT_B = 0x2f2a27;
const BASALT_C = 0x2a2624;
const ORANGE = 0xff7a1a;
const WHITE_HOT = 0xfff0c8;

const SEGMENTS = 32; // ground crack segments (8 spokes x 4)
const SLABS = 8;
const PEBBLES = 14;
const BOULDERS = 12;

const UP = new THREE.Vector3(0, 1, 0);
/** Uppercut lean: the arm tips toward the target's far side (local -Z). */
const TILT_Q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -0.12);

/** Deterministic pseudo-random. */
function lcg(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/** Offsets vertices by a hash of their position, so shared corners move together and the block stays closed. */
function chunk<T extends THREE.BufferGeometry>(geo: T, amt: number, seed: number): T {
  const pos = geo.attributes.position;
  const h = (x: number, y: number, z: number, k: number) => {
    const v = Math.sin((Math.round(x * 100) + seed) * 127.1 + Math.round(y * 100) * 311.7 + Math.round(z * 100) * 74.7 + k * 19.19) * 43758.5453;
    return (v - Math.floor(v)) - 0.5;
  };
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    pos.setXYZ(i, x + h(x, y, z, 1) * amt, y + h(x, y, z, 2) * amt, z + h(x, y, z, 3) * amt);
  }
  geo.computeVertexNormals();
  return geo;
}

interface Piece {
  mesh: THREE.Mesh;
  rest: THREE.Vector3; // root-local rest position (before yaw)
  restQ: THREE.Quaternion;
  release: number;
  kind: 'tumble' | 'sink' | 'hide';
  size: number; // rough half height for the floor contact
  // runtime
  released: boolean;
  landed: boolean;
  landT: number;
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  quat: THREE.Quaternion;
  w: THREE.Vector3;
  dir: THREE.Vector3;
}

export class TitanFist implements Effect {
  readonly group = new THREE.Group();
  readonly settings: TitanFistSettings;
  readonly emitters: Emitter[] = [];
  readonly screen = createScreenFx();
  shake = 0;
  playing = false;

  /** Last cast; frameCamera and telegraphs read it. Null until the first play(). */
  ctx: CastContext | null = null;
  private time = 0;
  private impacted = false;
  private landedHit = false;
  private center = new THREE.Vector3();
  private yaw = 0;
  private toCaster = new THREE.Vector3(0, 0, 1);
  private dripClock = 0;

  // Ground.
  private seamMat = new THREE.MeshBasicMaterial({ color: LAVA });
  private crackMat = new THREE.MeshBasicMaterial({ color: LAVA, transparent: true, opacity: 0, depthWrite: false });
  private cracks = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), this.crackMat, SEGMENTS);
  private crackSeg: { x: number; z: number; ang: number; len: number; spoke: number; idx: number }[] = [];
  private crackSpeed: number[] = [];
  private scorchMat = new THREE.MeshBasicMaterial({
    color: 0x0a0707, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide,
    polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1,
  });
  private scorch = new THREE.Mesh(new THREE.CircleGeometry(1, 40), this.scorchMat);
  private mound = new THREE.Mesh(
    chunk(new THREE.IcosahedronGeometry(1, 1), 0.12, 5),
    new THREE.MeshStandardMaterial({ color: BASALT_B, roughness: 0.95, flatShading: true }),
  );

  // The fist.
  private fist = new THREE.Group();
  private pieces: Piece[] = [];

  // Impact.
  private shock = createRing(ORANGE, 0.86, 1, 64);
  private shock2 = createRing(0xc89a70, 0.9, 1, 64);
  private refract = new ShockRefraction({ facing: 'ground', width: 0.3 });
  private haze = new HeatHaze({ width: 7, height: 6, scale: 4 });
  private star = new StarBurst({ points: 10, color: 0xe0601a, core: 0xffa040, additive: false });
  private glint = new StarBurst({ points: 4, inner: 0.12, jitter: 0, color: 0xffa040, core: 0xffd9a0, additive: false });
  private landStar = new StarBurst({ points: 8, color: 0xc89a70, core: 0xffa040, additive: false });

  private slabs: THREE.InstancedMesh;
  private slabSeed = Array.from({ length: SLABS }, (_, i) => ({
    a: (i / SLABS) * Math.PI * 2 + 0.25, r: 3.0 + (i % 3) * 0.35, w: 1.7 + (i % 2) * 0.5, d: 2.1 + (i % 3) * 0.3,
  }));
  private pebbles: THREE.InstancedMesh;
  private pebSeed: { a: number; r: number; t0: number; s: number }[] = [];
  private boulders: THREE.InstancedMesh;
  private boulderState = Array.from({ length: BOULDERS }, () => ({
    p: new THREE.Vector3(0, -50, 0), v: new THREE.Vector3(), q: new THREE.Quaternion(), w: new THREE.Vector3(),
    s: 0.3, landed: false, landT: 0,
  }));

  private smoke = new SmokeBall({ color: 0x3a2e2a, rim: 0x7a4a2c, flake: 0x3a2e2a, maxBalls: 6 });
  private sparks: Emitter;
  private dust: Emitter;
  private drips: Emitter;

  constructor(settings: TitanFistSettings = defaultTitanFist()) {
    this.settings = settings;
    this.screen.tint.set(0x2a0f08);
    this.screen.impactColor.set(ORANGE);
    this.screen.speedLineColor.set(WHITE_HOT);
    this.screen.edgeTint.set(0xc02a0a);

    // --- Ground: crack spokes (hard thin lava lines), scorch disc, bulge mound. ---
    const rnd = lcg(11);
    for (let s = 0; s < 8; s++) {
      let a = (s / 8) * Math.PI * 2 + (rnd() - 0.5) * 0.4;
      let x = Math.sin(a) * 0.3, z = Math.cos(a) * 0.3;
      this.crackSpeed.push(0.75 + rnd() * 0.45);
      for (let i = 0; i < 4; i++) {
        const len = 0.9 + rnd() * 0.7 + (i > 1 ? 0.3 : 0);
        this.crackSeg.push({ x, z, ang: a, len, spoke: s, idx: i });
        x += Math.sin(a) * len;
        z += Math.cos(a) * len;
        a += (rnd() - 0.5) * 0.9;
      }
    }
    this.cracks.frustumCulled = false;
    this.cracks.renderOrder = 3;
    this.scorch.rotation.x = -Math.PI / 2;
    this.scorch.renderOrder = 2;
    this.mound.visible = false;
    this.group.add(this.scorch, this.cracks, this.mound, this.shock.mesh, this.shock2.mesh, this.refract.mesh, this.haze.mesh);

    // --- The fist: blocks of faceted basalt with lava slabs showing only through the gaps. ---
    const stone = (c: number) => new THREE.MeshStandardMaterial({
      color: c, roughness: 0.95, metalness: 0, flatShading: true, emissive: 0x120503, emissiveIntensity: 0.6,
    });
    const mats = [stone(BASALT_A), stone(BASALT_B), stone(BASALT_C)];
    let n = 0;
    const add = (
      geo: THREE.BufferGeometry, mat: THREE.Material, x: number, y: number, z: number, release: number,
      kind: Piece['kind'], size: number, rot = new THREE.Euler(),
    ) => {
      const mesh = new THREE.Mesh(geo, mat);
      this.fist.add(mesh);
      const piece: Piece = {
        mesh, rest: new THREE.Vector3(x, y, z), restQ: new THREE.Quaternion().setFromEuler(rot), release, kind, size,
        released: false, landed: false, landT: 0, pos: new THREE.Vector3(), vel: new THREE.Vector3(),
        quat: new THREE.Quaternion(), w: new THREE.Vector3(), dir: new THREE.Vector3(),
      };
      this.pieces.push(piece);
      n++;
      return piece;
    };
    const block = (w: number, h: number, d: number, j: number) => chunk(new THREE.BoxGeometry(w, h, d), j, n * 13 + 3);
    const seg = (r0: number, r1: number, h: number) => {
      const g = new THREE.CylinderGeometry(r0, r1, h, 8, 1);
      g.rotateY(Math.PI / 8);
      return chunk(g, 0.16, n * 13 + 5);
    };
    const lavaMesh = (geo: THREE.BufferGeometry, x: number, y: number, z: number, release: number, kind: Piece['kind'], size: number) =>
      add(geo, this.seamMat, x, y, z, release, kind, size);

    // Zigzag lava crack (three thin strips) on a face; poked out of the stone so it glows.
    const crackLine = (parent: THREE.Object3D, x: number, y: number, len: number, seed: number, z: number, ry = 0, px = 0) => {
      const g = new THREE.Group();
      const r = lcg(seed);
      let cx = x, cy = y;
      for (let k = 0; k < 3; k++) {
        const ang = (r() - 0.5) * 1.0;
        const l = len / 3;
        const m = new THREE.Mesh(new THREE.BoxGeometry(0.07, l, 0.14), this.seamMat);
        m.position.set(cx + Math.sin(ang) * l * 0.5, cy - Math.cos(ang) * l * 0.5, 0);
        m.rotation.z = ang;
        g.add(m);
        cx += Math.sin(ang) * l;
        cy -= Math.cos(ang) * l;
      }
      g.position.set(px, 0, z);
      g.rotation.y = ry;
      parent.add(g);
    };

    // Forearm: three octagonal segments (about 4 m above ground), 0.1 m gaps with a lava core behind them.
    const f0 = 2.6, f1 = 2.4, f2 = 2.2;
    const seg2 = add(seg(1.1, 1.2, 2.0), mats[0], 0, 3.15, 0, f0 - 0.4, 'sink', 1.1);
    const seg1 = add(seg(1.2, 1.25, 2.0), mats[1], 0, 1.05, 0, f1, 'sink', 1.1);
    add(seg(1.25, 1.3, 2.0), mats[2], 0, -1.05, 0, f2 + 0.4, 'sink', 1.1);
    lavaMesh(new THREE.CylinderGeometry(0.95, 0.95, 12, 8, 1), 0, -1.0, 0, f1, 'sink', 1);
    [[seg2, -0.5, 0.8], [seg2, 0.45, 0.5], [seg2, 0.05, 0.2], [seg1, -0.4, 0.8], [seg1, 0.5, 0.6], [seg1, 0.0, 0.1]]
      .forEach(([p, x, y], i) => crackLine((p as Piece).mesh, x as number, y as number, 1.0, 40 + i, 1.0 + Math.abs(x as number) * 0.05));

    // Hand block, wider than the forearm; four rounded knuckles; stepped curled fingers; thumb across the front.
    const hand = add(block(4.4, 2.0, 3.0, 0.16), mats[1], 0, 5.25, 0, 1.95, 'tumble', 1.0);
    for (const sx of [-1, 1]) {
      crackLine(hand.mesh, -0.3, 0.8, 1.5, 60 + sx, 0, sx * Math.PI / 2, sx * 2.2);
      crackLine(hand.mesh, 0.5, 0.6, 1.2, 70 + sx, 0.4, sx * Math.PI / 2, sx * 2.2);
    }
    const hx = [-1.65, -0.55, 0.55, 1.65];
    hx.forEach((x, i) => {
      const k = chunk(new THREE.IcosahedronGeometry(1, 1), 0.1, 90 + i);
      k.scale(0.58, 0.58, 0.6);
      const kn = add(k, mats[(i + 1) % 3], x, 6.35 + (i === 1 || i === 2 ? 0.08 : 0), 1.25 + (i === 1 || i === 2 ? 0.05 : 0), 1.95 + i * 0.03, 'tumble', 0.5,
        new THREE.Euler(0.5, 0, 0));
      crackLine(kn.mesh, 0.1, 0.4, 0.5, 100 + i, 0.55);
      const up = add(block(1.0, 1.8, 1.0, 0.12), mats[i % 3], x, 5.3 + (i === 1 || i === 2 ? 0.1 : -0.05), 1.95, 1.97 + i * 0.03, 'tumble', 0.9,
        new THREE.Euler(0, 0, (i - 1.5) * 0.02));
      crackLine(up.mesh, (i % 2 ? 0.15 : -0.15), 0.8, 1.2, 110 + i, 0.5);
      add(block(0.95, 0.85, 0.9, 0.1), mats[(i + 2) % 3], x, 4.5 - (i === 1 || i === 2 ? 0.1 : 0), 2.6, 2.0 + i * 0.03, 'tumble', 0.4);
    });
    const thumb = add(block(3.6, 0.8, 0.9, 0.1), mats[2], 0, 3.85, 3.2, 2.05, 'tumble', 0.4, new THREE.Euler(0, 0, 0.12));
    crackLine(thumb.mesh, 0.6, 0.3, 0.55, 120, 0.46);
    lavaMesh(new THREE.BoxGeometry(4.5, 1.8, 0.3), 0, 5.3, 1.55, 1.95, 'hide', 0);
    lavaMesh(new THREE.BoxGeometry(4.5, 0.2, 1.0), 0, 6.27, 1.2, 1.95, 'hide', 0);
    lavaMesh(new THREE.BoxGeometry(4.3, 0.2, 0.9), 0, 4.4, 2.2, 1.95, 'hide', 0);
    this.fist.visible = false;
    this.group.add(this.fist);

    // --- Slabs, pebbles, boulders. ---
    this.slabs = new THREE.InstancedMesh(
      chunk(new THREE.BoxGeometry(1, 0.5, 1), 0.08, 17), stone(BASALT_B), SLABS,
    );
    this.pebbles = new THREE.InstancedMesh(new THREE.TetrahedronGeometry(0.18), stone(BASALT_C), PEBBLES);
    this.boulders = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 0), stone(BASALT_A), BOULDERS);
    for (const m of [this.slabs, this.pebbles, this.boulders]) {
      m.frustumCulled = false;
      this.group.add(m);
    }
    const pr = lcg(23);
    for (let i = 0; i < PEBBLES; i++) {
      this.pebSeed.push({ a: pr() * Math.PI * 2, r: 0.8 + pr() * 3.6, t0: 0.12 + pr() * 0.45, s: 0.7 + pr() * 0.9 });
    }

    // --- Impact marks. ---
    this.group.add(this.star.mesh, this.glint.mesh, this.landStar.mesh, this.smoke.mesh);

    this.sparks = new Emitter({
      ...defaultSettings(), maxParticles: 500, rate: 0, lifetime: 0.7, lifetimeJitter: 0.5,
      shape: 'sphere', shapeSize: 0.5, speed: 9, speedJitter: 0.6, spread: 70, gravity: 14, drag: 1.2,
      sizeStart: 0.12, sizeEnd: 0.02, colorStart: '#fff0c8', colorEnd: '#c02a0a',
      opacityStart: 0.9, opacityEnd: 0, additive: true, sizeJitter: 0.3, erosion: 0, colorMid: '#ff7a1a',
    });
    // Small, short, dark smoke: never swallows the fist.
    this.dust = new Emitter({
      ...defaultSettings(), maxParticles: 300, rate: 0, lifetime: 1.1, lifetimeJitter: 0.4,
      shape: 'sphere', shapeSize: 0.8, speed: 3.2, speedJitter: 0.6, spread: 75, gravity: -0.1, drag: 1.8,
      sizeStart: 0.5, sizeEnd: 1.2, colorStart: '#5a4a42', colorEnd: '#1a1412',
      opacityStart: 0.3, opacityEnd: 0, additive: false, colorMid: '#3a2e2a', sizeJitter: 0.4, erosion: 0.6, spin: 0.4,
      groundFade: 0.3,
    });
    this.drips = new Emitter({
      ...defaultSettings(), maxParticles: 120, rate: 0, lifetime: 0.9, lifetimeJitter: 0.3,
      shape: 'sphere', shapeSize: 0.1, speed: 0.3, speedJitter: 0.5, spread: 180, gravity: 16, drag: 0.2,
      sizeStart: 0.1, sizeEnd: 0.05, colorStart: '#ffb050', colorEnd: '#c02a0a',
      opacityStart: 0.9, opacityEnd: 0, additive: true, sizeJitter: 0.3, erosion: 0,
    });
    this.emitters.push(this.sparks, this.dust, this.drips, this.smoke.emitter);
    for (const e of this.emitters) this.group.add(e.points);
    this.reset();
  }

  get duration() {
    return DURATION;
  }

  get impactTime() {
    return D;
  }

  cast(ctx: CastContext) {
    this.ctx = ctx;
    const target = ctx.targetPos[0] ?? ctx.point;
    this.center.copy(target).setY(0);
    // The fist's local +Z (finger side) faces the caster.
    this.yaw = (Number.isFinite(ctx.aim) ? ctx.aim : 0) + Math.PI;
    this.toCaster.set(Math.sin(this.yaw), 0, Math.cos(this.yaw));
    this.screen.silhouettes = [ctx.caster.group, ...ctx.targets.map((e) => e.group), this.fist];
  }

  play() {
    this.reset();
    this.playing = true;
  }

  private reset() {
    this.time = 0;
    this.impacted = false;
    this.landedHit = false;
    this.dripClock = 0;
    this.shake = 0;
    clearScreenFx(this.screen);
    this.smoke.clear();
    for (const e of this.emitters) e.clear();
    for (const p of this.pieces) {
      p.released = false;
      p.landed = false;
      p.mesh.visible = true;
    }
    for (const b of this.boulderState) b.p.set(0, -50, 0);
    this.layout(0);
  }

  update(dt: number) {
    for (const e of this.emitters) e.update(dt);
    this.smoke.update(dt);
    if (!this.playing) return;
    this.time += dt;
    if (this.time >= DURATION) {
      if (this.settings.loop) { this.play(); return; }
      this.playing = false;
      clearScreenFx(this.screen);
    }
    if (!this.impacted && this.time >= D) this.onImpact();
    if (!this.landedHit && this.time >= LAND) this.onLand();
    this.layout(dt);
  }

  /** Vertical offset of the fist (negative = underground): an overshooting uppercut. */
  private riseOffset(t: number) {
    const p = THREE.MathUtils.clamp((t - D) / RISE, 0, 1);
    const c1 = 1.2, c3 = c1 + 1;
    const e = 1 + c3 * Math.pow(p - 1, 3) + c1 * Math.pow(p - 1, 2);
    return -SUNK * (1 - e);
  }

  /** Height the launched enemy is lifted to at time t. */
  private enemyLift(t: number) {
    if (t < D) return 0;
    if (t < FALL_START) {
      const top = Math.min(LIFT + this.riseOffset(t), LIFT + 0.4);
      return Math.max(0, top) + (t > D + 0.4 ? 0.06 * Math.sin((t - D) * 5) : 0);
    }
    const q = THREE.MathUtils.clamp((t - FALL_START) / (LAND - FALL_START), 0, 1);
    return LIFT * (1 - q * q);
  }

  private layout(dt: number) {
    const t = this.time;
    const after = t - D;
    const c = this.center;
    const heat = 1 - smoothstep((t - 1.2) / 2.2);
    const fadeOut = 1 - smoothstep((t - 3.4) / 0.8);

    // --- Layer 1: the world darkens for the build-up, releases after the strike. ---
    this.screen.darken = t < D ? 0.55 * smoothstep(t / 0.6) : 0.55 * Math.exp(-Math.max(0, after - 0.1) * 3);

    // --- Layer 2: lava cracks race out of the target's feet, pebbles hop, the soil bulges. ---
    const grow = smoothstep(t / CRACK_END);
    this.seamMat.color.setHex(LAVA_DARK).lerp(new THREE.Color(LAVA), heat);
    this.crackMat.color.copy(this.seamMat.color);
    this.crackMat.opacity = (t < 0.02 ? 0 : 1) * fadeOut;
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const p = new THREE.Vector3();
    const sc = new THREE.Vector3();
    this.crackSeg.forEach((s, i) => {
      const lp = THREE.MathUtils.clamp(grow * 4 * this.crackSpeed[s.spoke] - s.idx, 0, 1);
      const len = Math.max(1e-4, s.len * lp);
      const wid = s.idx === 0 ? 0.17 : 0.12;
      p.set(c.x + s.x + Math.sin(s.ang) * len * 0.5, 0.05, c.z + s.z + Math.cos(s.ang) * len * 0.5);
      q.setFromAxisAngle(UP, s.ang);
      m.compose(p, q, sc.set(wid, 0.03, len));
      this.cracks.setMatrixAt(i, m);
    });
    this.cracks.instanceMatrix.needsUpdate = true;
    this.scorch.position.set(c.x, 0.03, c.z);
    this.scorch.scale.setScalar(5.2);
    this.scorchMat.opacity = after < 0 ? 0.28 * grow : (0.2 + 0.4 * Math.min(1, after / 0.1)) * fadeOut;

    const bulge = smoothstep((t - CRACK_END) / 0.3);
    this.mound.visible = t > CRACK_END && t < D + 0.02;
    this.mound.position.set(c.x, 0, c.z);
    this.mound.scale.set(1.9 * bulge + 1e-3, 0.55 * bulge + 1e-3, 1.9 * bulge + 1e-3);

    for (let i = 0; i < PEBBLES; i++) {
      const s = this.pebSeed[i];
      const ph = t - s.t0;
      if (ph < 0 || t >= D) {
        m.compose(p.set(0, -10, 0), q.identity(), sc.setScalar(1e-4));
      } else {
        const hop = Math.abs(Math.sin(ph * 8 + i)) * 0.4 * (0.4 + t);
        m.compose(
          p.set(c.x + Math.sin(s.a) * s.r, 0.15 + hop, c.z + Math.cos(s.a) * s.r),
          q.setFromEuler(new THREE.Euler(ph * 3 + i, ph * 2, i)), sc.setScalar(s.s),
        );
      }
      this.pebbles.setMatrixAt(i, m);
    }
    this.pebbles.instanceMatrix.needsUpdate = true;

    // --- Layer 3: the fist. Rises through the bulge, holds, then crumbles piece by piece. ---
    this.fist.visible = t >= D;
    const root = new THREE.Vector3(c.x, this.riseOffset(t), c.z);
    const yawQ = new THREE.Quaternion().setFromAxisAngle(UP, this.yaw);
    const tmp = new THREE.Vector3();
    const tq = new THREE.Quaternion();
    for (const pc of this.pieces) {
      if (!pc.released && t >= pc.release && t >= D) this.releasePiece(pc, root, yawQ);
      if (!pc.released) {
        pc.mesh.position.copy(pc.rest).applyQuaternion(TILT_Q).applyAxisAngle(UP, this.yaw).add(root);
        pc.mesh.quaternion.copy(yawQ).multiply(TILT_Q).multiply(pc.restQ);
        pc.mesh.scale.setScalar(1);
        continue;
      }
      if (pc.kind === 'hide') { pc.mesh.visible = false; continue; }
      const age = t - pc.release;
      const fin = Math.max(1e-3, 1 - smoothstep((t - 3.3) / 0.6));
      if (pc.kind === 'sink') {
        // Forearm blocks slump and sink into the ground.
        const k = smoothstep(age / 0.9);
        pc.mesh.position.copy(pc.rest).applyQuaternion(TILT_Q).applyAxisAngle(UP, this.yaw).add(root);
        pc.mesh.position.addScaledVector(pc.dir, 0.5 * k);
        pc.mesh.position.y -= 4.4 * k;
        pc.mesh.quaternion.copy(yawQ).multiply(TILT_Q).multiply(pc.restQ).multiply(tq.setFromAxisAngle(pc.w, 0.35 * k));
        pc.mesh.scale.setScalar(fin);
        if (age > 0.9) pc.mesh.visible = false;
        continue;
      }
      // Tumbling boulder-piece.
      if (dt > 0) {
        if (!pc.landed) {
          pc.vel.y -= 22 * dt;
          pc.pos.addScaledVector(pc.vel, dt);
          pc.mesh.quaternion.premultiply(tq.setFromAxisAngle(tmp.copy(pc.w).normalize(), pc.w.length() * dt));
          if (pc.pos.y < pc.size && pc.vel.y < 0) {
            pc.pos.y = pc.size;
            pc.landed = true;
            pc.landT = t;
            this.dust.burst(26, tmp.set(pc.pos.x, 0.3, pc.pos.z));
            this.shake = Math.max(this.shake, 0.3);
          }
        } else {
          pc.pos.y = pc.size - (pc.size + 2.2) * smoothstep((t - pc.landT - 0.45) / 1.3);
        }
      }
      pc.mesh.position.copy(pc.pos);
      pc.mesh.scale.setScalar(fin);
      if (pc.landed && t - pc.landT > 1.8) pc.mesh.visible = false;
    }

    // Lava drips fall from the seams while the fist holds.
    if (dt > 0 && t > D + 0.3 && t < FALL_START) {
      this.dripClock += dt;
      while (this.dripClock > 0.07) {
        this.dripClock -= 0.07;
        const side = Math.random() - 0.5;
        this.drips.burst(1, tmp.set(c.x, 2.4 + Math.random() * 2, c.z).addScaledVector(this.toCaster, 1.6 + Math.random() * 0.3)
          .addScaledVector(tmp.set(this.toCaster.z, 0, -this.toCaster.x), side * 3.2));
      }
    }

    // --- Layer 4: launch / hang / fall for the enemy. ---
    const ctx = this.ctx;
    if (ctx) {
      const off = new THREE.Vector3(0, this.enemyLift(t), 0);
      for (const e of ctx.targets) ctx.displace(e, off);
    }

    // --- Layer 5: impact frames, ring, star, slabs, boulders. ---
    this.screen.impact = impactFrameAt(t, D, [1, 2], 0.04);
    this.screen.chroma = chromaPulse(t, D, 0.6, 12);
    this.screen.focus.set(c.x, 2, c.z);
    this.screen.speedLines = t < D ? Math.max(0, Math.min(0.5, (t - (D - 0.3)) * 1.8)) : Math.max(0, 0.5 - after * 4);

    const se = 1 - Math.pow(1 - THREE.MathUtils.clamp(after / 0.5, 0, 1), 3);
    this.shock.mesh.position.set(c.x, 0.07, c.z);
    this.shock.mesh.scale.setScalar(1.5 + 9 * se);
    this.shock.material.opacity = after > 0 && after < 0.5 ? 0.75 * (1 - after / 0.5) : 0;
    const rp = THREE.MathUtils.clamp(after / 0.5, 0, 1);
    this.refract.set(tmp.set(c.x, 0.07, c.z), 1.5 + 9 * se, after > 0 && after < 0.5 ? 0.045 * (1 - rp) * (1 - rp) : 0);
    // Heat shimmer rises off the fist and cracks while the lava is hot.
    this.haze.set(tmp.set(c.x, 0.2, c.z), t > 0.3 && t < DURATION ? 0.014 * heat * fadeOut * smoothstep((t - 0.3) / 0.4) : 0, t, 1.2);
    const la = t - LAND;
    this.shock2.mesh.position.set(c.x, 0.06, c.z);
    this.shock2.mesh.scale.setScalar(1.5 + 5 * (1 - Math.pow(1 - THREE.MathUtils.clamp(la / 0.5, 0, 1), 3)));
    this.shock2.material.opacity = la > 0 && la < 0.5 ? 0.4 * (1 - la / 0.5) : 0;

    const pop = StarBurst.pop(after - 0.01, 0.06, 0.16);
    this.star.set(tmp.copy(c).addScaledVector(this.toCaster, 2.4).setY(1.0), 2.3 * pop.scale, pop.opacity, 0.3);
    const gp = StarBurst.pop(after - 0.05, 0.05, 0.22);
    this.glint.set(tmp.copy(c).addScaledVector(this.toCaster, 2.6).setY(2.6), 0.7 * gp.scale, gp.opacity, t * 2);
    const lp2 = StarBurst.pop(la - 0.01, 0.05, 0.14);
    this.landStar.set(tmp.copy(c).addScaledVector(this.toCaster, 0.5).setY(0.6), 1.8 * lp2.scale, lp2.opacity, 0.7);

    // Slabs heave up in a ring around the fist, then settle and sink.
    const qa = new THREE.Quaternion();
    const qx = new THREE.Quaternion();
    for (let i = 0; i < SLABS; i++) {
      const s = this.slabSeed[i];
      if (after < 0) {
        m.compose(p.set(0, -10, 0), q.identity(), sc.setScalar(1e-4));
      } else {
        const up = 1 - Math.pow(1 - Math.min(1, after / 0.25), 2);
        const th = 0.9 * up - 0.35 * smoothstep((after - 0.3) / 0.6);
        const sink = 1.4 * smoothstep((t - 3.0) / 0.8);
        const shrink = Math.max(1e-3, 1 - smoothstep((t - 3.5) / 0.4));
        qa.setFromAxisAngle(UP, s.a);
        qx.setFromAxisAngle(new THREE.Vector3(1, 0, 0), th);
        p.set(c.x + Math.sin(s.a) * s.r, 0.1 + 0.25 * up - sink, c.z + Math.cos(s.a) * s.r);
        m.compose(p, qa.multiply(qx), sc.set(s.w * shrink, shrink, s.d * shrink));
      }
      this.slabs.setMatrixAt(i, m);
    }
    this.slabs.instanceMatrix.needsUpdate = true;

    for (let i = 0; i < BOULDERS; i++) {
      const b = this.boulderState[i];
      if (dt > 0 && b.p.y > -20) {
        if (!b.landed) {
          b.v.y -= 22 * dt;
          b.p.addScaledVector(b.v, dt);
          b.q.premultiply(qa.setFromAxisAngle(tmp.copy(b.w).normalize(), b.w.length() * dt));
          if (b.p.y < b.s * 0.6 && b.v.y < 0) { b.p.y = b.s * 0.6; b.landed = true; b.landT = t; }
        } else {
          b.p.y = b.s * 0.6 - (b.s + 1) * smoothstep((t - b.landT - 0.5) / 1.0);
        }
      }
      const sh = b.p.y < -20 ? 1e-4 : Math.max(1e-3, b.s * (1 - smoothstep((t - 3.4) / 0.5)));
      m.compose(b.p, b.q, sc.setScalar(sh));
      this.boulders.setMatrixAt(i, m);
    }
    this.boulders.instanceMatrix.needsUpdate = true;

    // Shake: rumble, strike, landing.
    const rumble = t > 0.1 && t < D ? 0.04 + 0.06 * smoothstep((t - 0.1) / 0.8) : 0;
    const strike = after >= 0 ? 0.9 * Math.exp(-after * 6) : 0;
    const land = la >= 0 ? 0.4 * Math.exp(-la * 8) : 0;
    this.shake = Math.max(rumble, strike, land, this.shake * 0.9);
  }

  private releasePiece(pc: Piece, root: THREE.Vector3, yawQ: THREE.Quaternion) {
    pc.released = true;
    pc.pos.copy(pc.rest).applyQuaternion(TILT_Q).applyAxisAngle(UP, this.yaw).add(root);
    pc.quat.copy(yawQ).multiply(TILT_Q).multiply(pc.restQ);
    const out = new THREE.Vector3(pc.pos.x - this.center.x, 0, pc.pos.z - this.center.z);
    if (out.lengthSq() < 1e-4) out.set(Math.random() - 0.5, 0, Math.random() - 0.5);
    out.normalize();
    pc.dir.copy(out);
    pc.mesh.quaternion.copy(pc.quat);
    if (pc.kind === 'tumble') {
      pc.vel.copy(out).multiplyScalar(1.5 + Math.random() * 2.5).setY(0.5 + Math.random() * 2);
      pc.w.set((Math.random() - 0.5) * 3, (Math.random() - 0.5) * 2, (Math.random() - 0.5) * 3);
    } else if (pc.kind === 'sink') {
      pc.w.set(out.z, 0, -out.x).normalize();
      this.dust.burst(22, new THREE.Vector3(this.center.x, 0.4, this.center.z));
      this.shake = Math.max(this.shake, 0.22);
    }
  }

  private onImpact() {
    this.impacted = true;
    const c = this.center;
    const base = new THREE.Vector3(c.x, 0.3, c.z);
    this.sparks.burst(260, base);
    this.dust.burst(70, base);
    // Two small dark lit smoke balls at the base; they break up quickly.
    for (const side of [-1, 1]) {
      this.smoke.trigger(
        new THREE.Vector3(c.x + this.toCaster.z * side * 1.8, 0.8, c.z - this.toCaster.x * side * 1.8)
          .addScaledVector(this.toCaster, 1.2), 1.3, 0.9,
      );
    }
    for (const b of this.boulderState) {
      const a = Math.random() * Math.PI * 2;
      const sp = 3 + Math.random() * 4;
      b.p.set(c.x + Math.sin(a) * 1.8, 0.4, c.z + Math.cos(a) * 1.8);
      b.v.set(Math.sin(a) * sp, 6 + Math.random() * 6, Math.cos(a) * sp);
      b.w.set((Math.random() - 0.5) * 8, (Math.random() - 0.5) * 8, (Math.random() - 0.5) * 8);
      b.q.setFromEuler(new THREE.Euler(Math.random() * 3, Math.random() * 3, Math.random() * 3));
      b.s = 0.25 + Math.random() * 0.3;
      b.landed = false;
    }
    const ctx = this.ctx;
    if (!ctx) return;
    ctx.targets.forEach((e, i) => {
      const tp = ctx.targetPos[i] ?? c;
      const from = new THREE.Vector3(tp.x + this.toCaster.x, 0, tp.z + this.toCaster.z);
      if (from.distanceToSquared(tp) < 0.09) from.set(tp.x - 0.5, 0, tp.z + 0.5);
      ctx.hit(e, { damage: this.settings.damage, knock: 2, from });
    });
  }

  private onLand() {
    this.landedHit = true;
    const c = this.center;
    this.dust.burst(50, new THREE.Vector3(c.x, 0.3, c.z));
    this.sparks.burst(40, new THREE.Vector3(c.x, 0.2, c.z));
    this.smoke.trigger(new THREE.Vector3(c.x, 0.7, c.z), 1.0, 0.8);
    const ctx = this.ctx;
    if (!ctx) return;
    ctx.targets.forEach((e, i) => {
      const tp = ctx.targetPos[i] ?? c;
      const from = new THREE.Vector3(tp.x + this.toCaster.x, 0, tp.z + this.toCaster.z);
      if (from.distanceToSquared(tp) < 0.09) from.set(tp.x - 0.5, 0, tp.z + 0.5);
      ctx.hit(e, { damage: 10, knock: 1, from });
    });
  }
}

export const titanFistModule: EffectModule = {
  label: 'titan fist',
  category: 'targeted',
  targeting: { mode: 'enemy' },
  create: () => new TitanFist(),
  telegraphs(effect) {
    const e = effect as TitanFist;
    const c = e.ctx?.targetPos[0] ?? e.ctx?.point;
    if (!c) return [];
    return [{ shape: { kind: 'circle', x: c.x, z: c.z, radius: 2.4 }, start: 0.1, impact: e.impactTime }];
  },
  bloom: { enabled: true, strength: 0.6, radius: 0.5, threshold: 0.82 },
  frameCamera(camera, controls, effect) {
    const e = effect as TitanFist;
    if (e.ctx) frameCast(camera, controls, e.ctx, LIFT + 2);
  },
  buildGui(f, effect) {
    const s = (effect as TitanFist).settings;
    f.add(s, 'loop');
    f.add(s, 'damage', 1, 150, 1);
  },
};
