import * as THREE from 'three';
import { Emitter, defaultSettings } from '../../emitter';
import { createRing, smoothstep } from '../../effects/common';
import {
  CrescentArc, SmokeBall, StarBurst, clearScreenFx, createScreenFx, impactFrameAt,
} from '../../effects/parts';
import { frameCast, type CastContext } from '../../effects/targeting';
import type { Effect, EffectModule } from '../../effects/types';

/**
 * Paper Crane Blizzard (targeted, up to six enemies): the world goes cold blue and twelve sheets of paper unfold
 * out of the caster's hand and fold into origami cranes (white and pale blue, flat facets, dark creases). They rise
 * into a V formation above the caster, wings flapping, with soft wind sheets circling the flock, while one huge
 * crane (twice the size) hangs above the apex. Then the cranes peel off in pairs, nearest enemy first, and dive on
 * curved, accelerating paths; each bursts into a hard six-armed snowflake, a frost ring and torn paper. After a
 * short beat the giant crane dives at the primary target: dark and light impact frames, a huge snowflake with a
 * violet accent, ice shards and a small black smoke ball. Paper scraps flutter down, frost fades, frame clears.
 */
export interface PaperCraneBlizzardSettings {
  /** Damage of the final giant crane on the primary target. */
  damage: number;
  loop: boolean;
}

export const defaultPaperCraneBlizzard = (): PaperCraneBlizzardSettings => ({ damage: 30, loop: false });

const MAXT = 6;
const FLOCK = 12;
const CRANES = FLOCK + 1; // the last one is the giant
const D = 2.8; // final impact
const TOTAL = 4.4;
const PEEL_START = 1.5;
const PEEL_STEP = 0.12;
const DIVE_TIME = 0.5;
const GIANT_START = 1.95;
const GIANT_SCALE = 2.05;
const WIND = 4;
const MIN = 1e-4;

const UP = new THREE.Vector3(0, 1, 0);
const ZERO = new THREE.Vector3();
const clamp01 = (x: number) => THREE.MathUtils.clamp(x, 0, 1);
const easeOutBack = (x: number) => {
  const k = clamp01(x) - 1;
  return 1 + 2.70158 * k * k * k + 1.70158 * k * k;
};

const C_WHITE = new THREE.Color(0xc8d6e2);
const C_PALE = new THREE.Color(0xa9bfd4);
const C_SHADE = new THREE.Color(0x8aa3bd);
const C_DEEP = new THREE.Color(0x6f8aa6);
const C_BEAK = new THREE.Color(0x1d3a5a);

type V3 = [number, number, number];

/** Flat-shaded triangle soup: one colour per face. */
function facets(faces: { v: V3[]; c: THREE.Color }[]): THREE.BufferGeometry {
  const pos: number[] = [];
  const col: number[] = [];
  for (const f of faces) {
    for (const v of f.v) {
      pos.push(v[0], v[1], v[2]);
      col.push(f.c.r, f.c.g, f.c.b);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  return g;
}

/** Origami crane body, facing +Z, up +Y: folded body, long neck, dark beak, lifted tail. About 0.9 m long. */
function craneBodyGeometry(): THREE.BufferGeometry {
  const N: V3 = [0, 0.04, 0.32], T: V3 = [0, 0.14, -0.02], B: V3 = [0, -0.12, 0.0], Tl: V3 = [0, 0.02, -0.4];
  const L: V3 = [-0.09, 0, 0], R: V3 = [0.09, 0, 0];
  return facets([
    { v: [N, T, R], c: C_WHITE }, { v: [N, L, T], c: C_PALE },
    { v: [N, R, B], c: C_PALE }, { v: [N, B, L], c: C_SHADE },
    { v: [T, Tl, R], c: C_PALE }, { v: [T, L, Tl], c: C_SHADE },
    { v: [R, Tl, B], c: C_SHADE }, { v: [L, B, Tl], c: C_DEEP },
    // Neck and head (a tall thin triangle), beak.
    { v: [[-0.04, 0.07, 0.22], [0.04, 0.07, 0.22], [0, 0.42, 0.44]], c: C_WHITE },
    { v: [[0, 0.42, 0.44], [0.03, 0.35, 0.42], [0, 0.37, 0.68]], c: C_BEAK },
    // Tail feather, lifted.
    { v: [[-0.07, 0.03, -0.26], [0.07, 0.03, -0.26], [0, 0.28, -0.58]], c: C_PALE },
  ]);
}

/** One wing (right side, +X), root at the shoulder, tip 0.62 m out. Three folded facets. */
function craneWingGeometry(): THREE.BufferGeometry {
  return facets([
    { v: [[0, 0, 0.25], [0, 0, -0.25], [0.5, 0.04, -0.15]], c: C_WHITE },
    { v: [[0, 0, 0.25], [0.5, 0.04, -0.15], [0.3, 0, 0.32]], c: C_PALE },
    { v: [[0.5, 0.04, -0.15], [0.62, 0.07, -0.3], [0.38, 0.02, -0.02]], c: C_SHADE },
  ]);
}

/** Torn-paper scrap: two flat triangles. */
function scrapGeometry(): THREE.BufferGeometry {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute([
    -0.1, 0, -0.08, 0.12, 0, -0.03, 0, 0.02, 0.12,
    0.12, 0, -0.03, 0.18, 0.01, 0.1, 0, 0.02, 0.12,
  ], 3));
  return g;
}

/** Bent ice shard: dark blue centre, pale edge. Length 1 along +Y. */
function iceShardGeometry(): THREE.BufferGeometry {
  const bend = (x: number, y: number): V3 => [x, y, 0.3 * y * y];
  const B = bend(0, 0), R = bend(0.13, 0.35), T = bend(0, 1), L = bend(-0.13, 0.35), C = bend(0, 0.4);
  const dark = new THREE.Color(0x14305a), hot = new THREE.Color(0xe6f6ff);
  const pos: number[] = [];
  const col: number[] = [];
  for (const tri of [[C, B, R], [C, R, T], [C, T, L], [C, L, B]]) {
    tri.forEach((v, i) => {
      pos.push(v[0], v[1], v[2]);
      const k = i === 0 ? dark : hot;
      col.push(k.r, k.g, k.b);
    });
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  return g;
}

interface Piece {
  p: THREE.Vector3; v: THREE.Vector3; r: THREE.Euler; w: THREE.Vector3;
  size: number; age: number; life: number; seed: number; live: boolean; landed: boolean;
}

/** Instanced debris with gravity, drag, optional flutter, landing and a fade-out at the end of its life. */
class Debris {
  readonly mesh: THREE.InstancedMesh;
  private pieces: Piece[];
  private next = 0;
  private m = new THREE.Matrix4();
  private q = new THREE.Quaternion();
  private s = new THREE.Vector3();

  constructor(geo: THREE.BufferGeometry, mat: THREE.Material, private count: number,
    private gravity: number, private drag: number, private flutter: number) {
    this.mesh = new THREE.InstancedMesh(geo, mat, count);
    this.mesh.frustumCulled = false;
    const white = new THREE.Color(1, 1, 1);
    this.pieces = Array.from({ length: count }, (_, i) => {
      this.mesh.setColorAt(i, white);
      return {
        p: new THREE.Vector3(0, -50, 0), v: new THREE.Vector3(), r: new THREE.Euler(), w: new THREE.Vector3(),
        size: 1, age: 0, life: 1, seed: Math.random() * 6.28, live: false, landed: false,
      };
    });
  }

  clear() {
    for (const p of this.pieces) { p.live = false; p.landed = false; p.p.set(0, -50, 0); }
    this.next = 0;
    this.write();
  }

  spawn(pos: THREE.Vector3, vel: THREE.Vector3, size: number, life: number, color: THREE.Color) {
    const p = this.pieces[this.next];
    const idx = this.next;
    this.next = (this.next + 1) % this.count;
    p.p.copy(pos);
    p.v.copy(vel);
    p.w.set((Math.random() - 0.5) * 9, (Math.random() - 0.5) * 9, (Math.random() - 0.5) * 9);
    p.r.set(Math.random() * 6, Math.random() * 6, Math.random() * 6);
    p.size = size;
    p.age = 0;
    p.life = life;
    p.live = true;
    p.landed = false;
    this.mesh.setColorAt(idx, color);
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }

  step(dt: number) {
    if (dt <= 0) return;
    for (const p of this.pieces) {
      if (!p.live) continue;
      p.age += dt;
      if (p.age >= p.life) { p.live = false; continue; }
      if (p.landed) continue;
      p.v.y -= this.gravity * dt;
      p.v.x += Math.sin(p.age * 7 + p.seed) * this.flutter * dt;
      p.v.z += Math.cos(p.age * 6 + p.seed) * this.flutter * dt;
      p.v.multiplyScalar(Math.exp(-this.drag * dt));
      p.p.addScaledVector(p.v, dt);
      p.r.set(p.r.x + p.w.x * dt, p.r.y + p.w.y * dt, p.r.z + p.w.z * dt);
      if (p.p.y < 0.05) {
        p.p.y = 0.05;
        p.landed = true;
        p.v.set(0, 0, 0);
        p.r.set(-Math.PI / 2, 0, p.seed);
      }
    }
  }

  write() {
    for (let i = 0; i < this.count; i++) {
      const p = this.pieces[i];
      const k = p.live ? 1 - smoothstep((p.age - (p.life - 0.45)) / 0.45) : 0;
      if (k < 0.02) this.m.compose(p.p, this.q.identity(), this.s.setScalar(MIN));
      else this.m.compose(p.p, this.q.setFromEuler(p.r), this.s.setScalar(Math.max(MIN, p.size * k)));
      this.mesh.setMatrixAt(i, this.m);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}

interface Crane {
  group: THREE.Group;
  bird: THREE.Group;
  wingR: THREE.Group;
  wingL: THREE.Group;
  sheet: THREE.Group;
  star: StarBurst;
  giant: boolean;
  phase: number;
  /** Time the sheet appears; time it starts to travel to its slot and how long that takes. */
  tb: number;
  t0: number;
  tDur: number;
  handOff: THREE.Vector3;
  slot: THREE.Vector3;
  tgt: number;
  ts: number;
  dur: number;
  hit: number;
  end: THREE.Vector3;
  ctrl: THREE.Vector3;
  scale: number;
  hitDone: boolean;
}

interface Ground {
  ring: ReturnType<typeof createRing>;
  disc: THREE.Mesh;
  discMat: THREE.MeshBasicMaterial;
  lastHit: number;
}

export class PaperCraneBlizzard implements Effect {
  readonly group = new THREE.Group();
  readonly settings: PaperCraneBlizzardSettings;
  readonly emitters: Emitter[] = [];
  readonly screen = createScreenFx();
  shake = 0;
  playing = false;

  /** Last cast; frameCamera and telegraphs read it. Null until the first play(). */
  ctx: CastContext | null = null;
  private time = 0;

  private hand = new THREE.Vector3(0, 2.4, 14);
  private base = new THREE.Vector3(0, 4, 13);
  private fwd = new THREE.Vector3(0, 0, -1);
  private tPos: THREE.Vector3[] = [new THREE.Vector3()];
  private tEnemy: (CastContext['targets'][number] | undefined)[] = [undefined];
  private dmg: number[] = [10];
  private primary = 0;

  private cranes: Crane[] = [];
  private grounds: Ground[] = [];
  private winds: CrescentArc[] = [];
  private windPlanes: THREE.Group[] = [];
  private bigStar = new StarBurst({ points: 6, inner: 0.2, jitter: 0, color: 0xbfe8ff, core: 0xd4ecfa, additive: false });
  private violetStar = new StarBurst({ points: 8, inner: 0.35, jitter: 0.2, color: 0x8a7cff, core: 0xc4bcf0, additive: false });
  private bigRing = createRing(0xbfe8ff, 0.9, 1, 96);
  private smoke = new SmokeBall({ color: 0x1a3358, rim: 0x0e1f3a, flake: 0xbfe8ff, maxBalls: 2 });
  private scraps: Debris;
  private shards: Debris;
  private snow: Emitter;
  private trail: Emitter;

  constructor(settings: PaperCraneBlizzardSettings = defaultPaperCraneBlizzard()) {
    this.settings = settings;
    this.screen.tint.set(0x0e1f3a);
    this.screen.impactColor.set(0x5ab8f0);
    this.screen.speedLineColor.set(0xbfe8ff);

    const bodyGeo = craneBodyGeometry();
    const wingGeo = craneWingGeometry();
    const bodyEdges = new THREE.EdgesGeometry(bodyGeo, 1);
    const wingEdges = new THREE.EdgesGeometry(wingGeo, 1);
    const paperMat = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide });
    const lineMat = new THREE.LineBasicMaterial({ color: 0x0e1f3a });
    // Outline: a slightly larger navy copy pushed behind the paper.
    const hullMat = new THREE.MeshBasicMaterial({
      color: 0x0e1f3a, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: 2, polygonOffsetUnits: 2,
    });
    const sheetGeo = new THREE.PlaneGeometry(0.95, 0.95);
    const sheetEdges = new THREE.EdgesGeometry(sheetGeo);
    const sheetMat = new THREE.MeshBasicMaterial({ color: 0xc8d6e2, side: THREE.DoubleSide });

    for (let i = 0; i < CRANES; i++) {
      const giant = i === FLOCK;
      const group = new THREE.Group();
      const bird = new THREE.Group();
      const wingR = new THREE.Group();
      const wingL = new THREE.Group();
      wingR.position.set(0.07, 0.1, 0);
      wingL.position.set(-0.07, 0.1, 0);
      const wr = new THREE.Mesh(wingGeo, paperMat);
      const wl = new THREE.Mesh(wingGeo, paperMat);
      wl.scale.x = -1;
      const hr = new THREE.Mesh(wingGeo, hullMat);
      const hl = new THREE.Mesh(wingGeo, hullMat);
      hr.scale.set(1.16, 1, 1.16);
      hl.scale.set(-1.16, 1, 1.16);
      const lr = new THREE.LineSegments(wingEdges, lineMat);
      const ll = new THREE.LineSegments(wingEdges, lineMat);
      ll.scale.x = -1;
      wingR.add(hr, wr, lr);
      wingL.add(hl, wl, ll);
      const hb = new THREE.Mesh(bodyGeo, hullMat);
      hb.scale.setScalar(1.14);
      bird.add(hb, new THREE.Mesh(bodyGeo, paperMat), new THREE.LineSegments(bodyEdges, lineMat), wingR, wingL);
      const sheet = new THREE.Group();
      sheet.rotation.x = -Math.PI / 2;
      sheet.add(new THREE.Mesh(sheetGeo, sheetMat), new THREE.LineSegments(sheetEdges, lineMat));
      group.add(bird, sheet);
      group.visible = false;
      const star = new StarBurst({ points: 6, inner: 0.22, jitter: 0, color: 0xbfe8ff, core: 0xd4ecfa, additive: false });
      this.group.add(group, star.mesh);
      this.cranes.push({
        group, bird, wingR, wingL, sheet, star, giant, phase: i * 0.7,
        tb: 0, t0: 0, tDur: 0.75, handOff: new THREE.Vector3(), slot: new THREE.Vector3(), tgt: 0, ts: 0, dur: DIVE_TIME,
        hit: 0, end: new THREE.Vector3(), ctrl: new THREE.Vector3(), scale: giant ? GIANT_SCALE : 1, hitDone: false,
      });
    }

    const discGeo = new THREE.CircleGeometry(1, 48);
    for (let i = 0; i < MAXT; i++) {
      const ring = createRing(0xbfe8ff, 0.86, 1, 64);
      ring.mesh.position.y = 0.05;
      const discMat = new THREE.MeshBasicMaterial({ color: 0x0e1f3a, transparent: true, opacity: 0, depthWrite: false });
      const disc = new THREE.Mesh(discGeo, discMat);
      disc.rotation.x = -Math.PI / 2;
      disc.position.y = 0.03;
      disc.visible = false;
      this.group.add(ring.mesh, disc);
      this.grounds.push({ ring, disc, discMat, lastHit: -10 });
    }

    for (let i = 0; i < WIND; i++) {
      const plane = new THREE.Group();
      const arc = new CrescentArc({ radius: 2.4 + 0.5 * (i % 2), width: 0.8, style: 'soft', edge: 0xf4fbff, mid: 0xbfe8ff, outer: 0x5ab8f0 });
      plane.add(arc.mesh);
      this.windPlanes.push(plane);
      this.winds.push(arc);
      this.group.add(plane);
    }

    this.scraps = new Debris(scrapGeometry(), new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide }), 140, 5, 1.6, 7);
    this.shards = new Debris(iceShardGeometry(), new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide }), 32, 15, 0.6, 0);

    this.snow = new Emitter({
      ...defaultSettings(), maxParticles: 900, rate: 0, lifetime: 1.6, lifetimeJitter: 0.4,
      shape: 'sphere', shapeSize: 0.5, speed: 3, speedJitter: 0.7, spread: 180, gravity: 0.8, drag: 1.4,
      sizeStart: 0.15, sizeEnd: 0.06, colorStart: '#f4fbff', colorEnd: '#bfe8ff',
      opacityStart: 0.7, opacityEnd: 0, additive: true, sizeJitter: 0.4, erosion: 0,
    });
    this.trail = new Emitter({
      ...defaultSettings(), maxParticles: 700, rate: 0, lifetime: 0.5, lifetimeJitter: 0.4,
      shape: 'sphere', shapeSize: 0.12, speed: 0.4, speedJitter: 0.6, spread: 180, gravity: 0, drag: 2,
      sizeStart: 0.28, sizeEnd: 0.04, colorStart: '#f4fbff', colorEnd: '#5ab8f0',
      opacityStart: 0.3, opacityEnd: 0, additive: true, sizeJitter: 0.4, erosion: 0.4,
    });
    this.emitters.push(this.snow, this.trail, this.smoke.emitter);
    for (const e of [this.snow, this.trail]) this.group.add(e.points);
    this.group.add(this.scraps.mesh, this.shards.mesh, this.smoke.mesh, this.bigStar.mesh, this.violetStar.mesh, this.bigRing.mesh);

    this.plan(new THREE.Vector3(0, 0, 14), Math.PI, [new THREE.Vector3()], [undefined], 0);
    this.reset();
  }

  /** Time the telegraph starts and the final impact. */
  get impactTime() {
    return D;
  }

  get duration() {
    return TOTAL;
  }

  get targetPositions(): readonly THREE.Vector3[] {
    return this.tPos;
  }

  cast(ctx: CastContext) {
    this.ctx = ctx;
    const pts = ctx.targetPos.length ? ctx.targetPos : [ctx.point];
    const count = Math.min(MAXT, pts.length);
    // Nearest to the caster first: the flock peels off in a clear front-to-back order.
    const order = Array.from({ length: count }, (_, i) => i)
      .sort((a, b) => pts[a].distanceToSquared(ctx.from) - pts[b].distanceToSquared(ctx.from));
    this.plan(
      ctx.from, ctx.aim,
      order.map((i) => pts[i].clone().setY(0)),
      order.map((i) => ctx.targets[i]),
      Math.max(0, order.indexOf(0)),
    );
    this.screen.silhouettes = [ctx.caster.group, ...ctx.targets.map((e) => e.group)];
    this.screen.focus.copy(this.tPos[this.primary]).setY(1.3);
  }

  /** Computes every crane's slot, target, dive path and timing for the current cast. */
  private plan(from: THREE.Vector3, aim: number, pos: THREE.Vector3[], enemies: (CastContext['targets'][number] | undefined)[], primary: number) {
    const fwd = this.fwd.set(Math.sin(aim), 0, Math.cos(aim));
    const right = new THREE.Vector3(-fwd.z, 0, fwd.x);
    this.hand.copy(from).addScaledVector(right, 0.5).addScaledVector(fwd, 0.3).setY(2.4);
    this.base.copy(from).addScaledVector(fwd, 1.2).setY(4.2);
    this.tPos = pos.length ? pos : [new THREE.Vector3()];
    this.tEnemy = enemies.length ? enemies : [undefined];
    this.primary = Math.min(primary, this.tPos.length - 1);
    const n = this.tPos.length;

    const hits = new Array<number>(n).fill(0);
    this.cranes.forEach((c, i) => {
      if (c.giant) {
        c.tgt = this.primary;
        c.tb = 0.9;
        c.t0 = 0.9;
        c.tDur = 0.6;
        c.ts = GIANT_START;
        c.dur = D - GIANT_START;
        c.handOff.set(0, 0, 0);
        c.slot.copy(this.base).addScaledVector(fwd, 1.6).add(new THREE.Vector3(0, 1.9, 0));
      } else {
        c.tgt = Math.min(n - 1, Math.floor((i * n) / FLOCK));
        hits[c.tgt]++;
        c.tb = 0.05 + 0.05 * i;
        c.t0 = 0.6 + 0.02 * i;
        c.tDur = 0.75;
        c.ts = PEEL_START + Math.floor(i / 2) * PEEL_STEP;
        c.dur = DIVE_TIME;
        const a = i * 2.4;
        c.handOff.set(Math.cos(a) * 0.6, 0.15 * (i % 3), Math.sin(a) * 0.6);
        // V formation: apex first, then pairs fanning out and back.
        const r = Math.ceil(i / 2);
        const side = i === 0 ? 0 : i % 2 === 1 ? 1 : -1;
        c.slot.copy(this.base)
          .addScaledVector(fwd, 1.8 - 0.75 * r)
          .addScaledVector(right, side * 0.85 * r)
          .add(new THREE.Vector3(0, -0.18 * r, 0));
      }
      c.hit = c.ts + c.dur;
      const a = i * 2.1;
      const spread = c.giant ? 0 : 0.5;
      c.end.copy(this.tPos[c.tgt]).add(new THREE.Vector3(Math.cos(a) * spread, c.giant ? 1.4 : 1.2 + 0.15 * (i % 3), Math.sin(a) * spread));
      // Control point: up and out to one side, so the dive curves in instead of falling straight.
      const mid = c.slot.clone().lerp(c.end, 0.5);
      const d = new THREE.Vector3().subVectors(c.end, c.slot).setY(0);
      const perp = new THREE.Vector3(-d.z, 0, d.x);
      if (perp.lengthSq() < 1e-6) perp.set(1, 0, 0);
      perp.normalize().multiplyScalar((i % 2 === 0 ? 1 : -1) * (c.giant ? 0 : 1.6));
      c.ctrl.copy(mid).add(perp).add(new THREE.Vector3(0, c.giant ? 1.2 : 2.2, 0));
    });
    this.dmg = hits.map((h) => THREE.MathUtils.clamp(Math.round(36 / Math.max(1, h)), 3, 12));
  }

  play() {
    this.reset();
    this.playing = true;
  }

  private reset() {
    this.time = 0;
    this.shake = 0;
    clearScreenFx(this.screen);
    this.smoke.clear();
    this.scraps.clear();
    this.shards.clear();
    for (const e of this.emitters) e.clear();
    for (const c of this.cranes) c.hitDone = false;
    for (const g of this.grounds) g.lastHit = -10;
    this.layout(0);
  }

  update(dt: number) {
    this.snow.update(dt);
    this.trail.update(dt);
    this.smoke.update(dt);
    if (!this.playing) return;
    this.time += dt;
    if (this.time >= TOTAL) {
      if (this.settings.loop) { this.play(); return; }
      this.playing = false;
      clearScreenFx(this.screen);
    }
    for (let i = 0; i < CRANES; i++) {
      const c = this.cranes[i];
      if (c.hitDone || this.time < c.hit) continue;
      if (c.giant) this.onFinal(c);
      else this.onHit(c);
    }
    this.layout(dt);
  }

  private path(c: Crane, u: number, out: THREE.Vector3) {
    const e = Math.pow(clamp01(u), c.giant ? 1.6 : 1.8);
    const k = 1 - e;
    return out.set(
      k * k * c.slot.x + 2 * k * e * c.ctrl.x + e * e * c.end.x,
      k * k * c.slot.y + 2 * k * e * c.ctrl.y + e * e * c.end.y,
      k * k * c.slot.z + 2 * k * e * c.ctrl.z + e * e * c.end.z,
    );
  }

  private layout(dt: number) {
    const t = this.time;
    const after = t - D;
    const over = t >= TOTAL;
    const m = new THREE.Matrix4();
    const p = new THREE.Vector3();
    const p2 = new THREE.Vector3();
    const dir = new THREE.Vector3();

    // --- World grade, focus lines before the giant lands, impact frames on it. ---
    this.screen.darken = over ? 0 : t < D ? 0.6 * smoothstep(t / 0.5) : 0.6 * Math.exp(-Math.max(0, after - 0.15) * 2.2);
    const imp = smoothstep((t - 2.3) / 0.5);
    this.screen.speedLines = t < 2.3 ? 0 : t < D ? 0.8 * imp : Math.max(0, 0.8 - after * 5);
    this.screen.impact = impactFrameAt(t, D, [1, 2]);

    // --- Wind sheets circle the flock while it forms and hovers. ---
    const windOn = t > 0.5 && t < 2.1 ? smoothstep((t - 0.5) / 0.3) * (1 - smoothstep((t - 1.7) / 0.4)) : 0;
    this.winds.forEach((arc, i) => {
      const plane = this.windPlanes[i];
      plane.position.copy(this.base).add(new THREE.Vector3(0, 0.2, 0));
      plane.rotation.set(Math.PI / 2 + (i - 1.5) * 0.3, (i * Math.PI) / 2 + t * 0.4, 0);
      arc.head = ((t * 1.1 + i * 0.25) % 1) * 1.35;
      arc.length = 0.35;
      arc.time = t;
      arc.erosion = 0.15;
      arc.opacity = 0.35 * windOn;
    });

    // --- Cranes. ---
    for (const c of this.cranes) {
      const age = t - c.tb;
      const diving = t >= c.ts;
      const gone = t >= c.hit;
      c.group.visible = age > 0 && !gone;
      if (!c.group.visible) { c.star.set(p.set(0, 0, 0), 0, 0); this.popStar(c, t); continue; }

      // Paper sheet shrinks as the bird pops out of it.
      const sheetK = 1 - clamp01(age / 0.25);
      c.sheet.visible = sheetK > 0.02;
      c.sheet.scale.setScalar(Math.max(MIN, sheetK));
      const pop = age < 0.1 ? 0 : easeOutBack((age - 0.1) / 0.22);
      c.bird.visible = pop > 0.01;
      const sc = c.scale * (c.giant ? 0.35 + 0.65 * smoothstep((t - c.t0) / c.tDur) * pop : pop);
      c.group.scale.setScalar(Math.max(MIN, sc));

      let wing: number;
      if (!diving) {
        // Hand → slot, with a small lift in the middle of the move; then hover with a bob.
        const k = smoothstep((t - c.t0) / c.tDur);
        p.copy(this.hand).add(c.handOff).y += Math.min(age, 0.6) * 0.5;
        if (c.giant) p.copy(this.hand);
        p.lerp(c.slot, k);
        p.y += Math.sin(Math.PI * k) * 0.6 + (k >= 1 ? Math.sin(t * 3 + c.phase) * 0.08 : 0);
        c.group.position.copy(p);
        dir.copy(this.fwd);
        dir.y = 0.15 * (1 - k);
        wing = age < 0.28 ? 0 : (c.giant ? 0.5 : 0.55) * Math.sin(t * (c.giant ? 5 : 9) + c.phase) + 0.15;
      } else {
        const u = (t - c.ts) / c.dur;
        this.path(c, u, p);
        this.path(c, Math.min(1, u + 0.04), p2);
        if (p2.distanceToSquared(p) < 1e-8) this.path(c, u - 0.04, p2).sub(p).negate().add(p);
        dir.subVectors(p2, p);
        c.group.position.copy(p);
        // Wings sweep back and tuck as the bird accelerates.
        wing = 0.95 - 0.1 * u + 0.12 * Math.sin(t * 24 + c.phase);
        if (dt > 0) this.trail.burst(c.giant ? 6 : 2, p);
      }
      if (dir.lengthSq() < 1e-8) dir.copy(this.fwd);
      m.lookAt(dir, ZERO, UP);
      c.group.quaternion.setFromRotationMatrix(m);
      c.wingR.rotation.z = wing;
      c.wingL.rotation.z = -wing;
      c.star.set(p.set(0, 0, 0), 0, 0);
      this.popStar(c, t);
    }

    // --- Ground: frost ring on every hit, a dark frost disc that lingers, fading before the end. ---
    const lateFade = 1 - smoothstep((t - 3.6) / 0.7);
    this.grounds.forEach((g, i) => {
      const live = i < this.tPos.length;
      const a = t - g.lastHit;
      const has = live && g.lastHit > -5;
      if (live) {
        g.ring.mesh.position.set(this.tPos[i].x, 0.05, this.tPos[i].z);
        g.disc.position.set(this.tPos[i].x, 0.03, this.tPos[i].z);
      }
      g.ring.mesh.scale.setScalar(Math.max(MIN, has ? 0.7 + 2.0 * (1 - Math.exp(-a * 9)) : MIN));
      g.ring.material.opacity = has ? 0.55 * Math.exp(-a * 3.5) * lateFade : 0;
      g.disc.visible = has;
      g.disc.scale.setScalar(1.7);
      g.discMat.opacity = has ? 0.4 * smoothstep(a / 0.2) * lateFade : 0;
    });

    // --- The giant's impact: huge snowflake, violet accent for two frames, ring. ---
    const pt = this.tPos[this.primary];
    const bp = StarBurst.pop(after, 0.1, 0.2);
    this.bigStar.set(p.set(pt.x, 1.5, pt.z), 7 * bp.scale, bp.opacity, 0.2);
    const vp = StarBurst.pop(after, 0.03, 0.05);
    this.violetStar.set(p.set(pt.x, 1.5, pt.z), 9 * vp.scale, vp.opacity, 0.5);
    this.bigRing.mesh.position.set(pt.x, 0.06, pt.z);
    this.bigRing.mesh.scale.setScalar(Math.max(MIN, after > 0 ? 1 + after * 22 : MIN));
    this.bigRing.material.opacity = after > 0 ? Math.max(0, 0.7 * (1 - after / 0.6)) : 0;

    // --- Shake: light during the dives, a kick per final hit. ---
    this.shake = after > 0 ? 0.8 * Math.exp(-after * 6) : t > PEEL_START && t < D ? 0.03 : 0;

    if (dt > 0) { this.scraps.step(dt); this.shards.step(dt); }
    this.scraps.write();
    this.shards.write();
  }

  private popStar(c: Crane, t: number) {
    if (c.giant || !c.hitDone) return;
    const pop = StarBurst.pop(t - c.hit, 0.05, 0.12);
    const pos = new THREE.Vector3().copy(c.end);
    c.star.set(pos, 2.3 * pop.scale, pop.opacity, c.phase);
  }

  private spawnScraps(at: THREE.Vector3, n: number, up: number, out: number, size: number, life: number) {
    const col = new THREE.Color();
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = out * (0.3 + Math.random());
      col.copy(Math.random() < 0.55 ? C_WHITE : C_PALE);
      this.scraps.spawn(at, new THREE.Vector3(Math.cos(a) * sp, up * (0.4 + Math.random()), Math.sin(a) * sp),
        size * (0.8 + Math.random() * 0.7), life * (0.8 + Math.random() * 0.4), col);
    }
  }

  private onHit(c: Crane) {
    c.hitDone = true;
    const g = this.grounds[c.tgt];
    if (g) g.lastHit = this.time;
    this.snow.burst(10, c.end);
    this.spawnScraps(c.end, 5, 3.5, 3, 1.6, 2.1);
    const ctx = this.ctx;
    const e = this.tEnemy[c.tgt];
    if (ctx && e) ctx.hit(e, { damage: this.dmg[c.tgt], knock: 1.5, from: ctx.from, color: '#bfe8ff' });
  }

  private onFinal(c: Crane) {
    c.hitDone = true;
    const pt = this.tPos[this.primary];
    const g = this.grounds[this.primary];
    if (g) g.lastHit = this.time;
    this.snow.burst(180, new THREE.Vector3(pt.x, 1.3, pt.z));
    this.smoke.trigger(new THREE.Vector3(pt.x, 0.8, pt.z), 0.9, 0.85);
    // Ice shards fly out; torn paper rains down from above.
    const col = new THREE.Color(1, 1, 1);
    for (let i = 0; i < 28; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 4 + Math.random() * 6;
      this.shards.spawn(new THREE.Vector3(pt.x, 1.1, pt.z), new THREE.Vector3(Math.cos(a) * sp, 4 + Math.random() * 6, Math.sin(a) * sp),
        0.5 + Math.random() * 0.5, 1.0 + Math.random() * 0.4, col);
    }
    for (let i = 0; i < 40; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = Math.random() * 2.2;
      const at = new THREE.Vector3(pt.x + Math.cos(a) * r, 2.5 + Math.random() * 2.5, pt.z + Math.sin(a) * r);
      const k = Math.random() < 0.5 ? C_WHITE : C_PALE;
      this.scraps.spawn(at, new THREE.Vector3((Math.random() - 0.5) * 3, 2 + Math.random() * 2, (Math.random() - 0.5) * 3),
        1.7 + Math.random() * 0.9, 1.4 + Math.random() * 0.1, k);
    }
    const ctx = this.ctx;
    const e = this.tEnemy[this.primary];
    if (ctx && e) {
      const d = new THREE.Vector3().subVectors(pt, ctx.from).setY(0);
      if (d.lengthSq() < 1e-4) d.set(0, 0, -1);
      ctx.hit(e, { damage: this.settings.damage, knock: 5, from: pt.clone().addScaledVector(d.normalize(), -1).setY(0), color: '#bfe8ff' });
    }
  }
}

export const paperCraneBlizzardModule: EffectModule = {
  label: 'paper crane blizzard',
  category: 'targeted',
  targeting: { mode: 'enemies', maxTargets: MAXT },
  create: () => new PaperCraneBlizzard(),
  telegraphs(effect) {
    const e = effect as PaperCraneBlizzard;
    if (!e.ctx) return [];
    return e.targetPositions.map((p) => ({
      shape: { kind: 'circle' as const, x: p.x, z: p.z, radius: 1.3 }, start: PEEL_START, impact: e.impactTime,
    }));
  },
  bloom: { enabled: true, strength: 0.5, radius: 0.5, threshold: 0.85 },
  frameCamera(camera, controls, effect) {
    const e = effect as PaperCraneBlizzard;
    if (e.ctx) frameCast(camera, controls, e.ctx, 6);
  },
  buildGui(f, effect) {
    const s = (effect as PaperCraneBlizzard).settings;
    f.add(s, 'loop');
    f.add(s, 'damage', 1, 150, 1);
  },
};
