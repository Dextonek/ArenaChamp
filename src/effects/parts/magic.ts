import * as THREE from 'three';
import type { Projectile } from '../projectile';
import type { MinionLook, MinionPalette, MinionRig } from './minion';

/**
 * The magic kit (pipeline/designs/kit-magic.md): The Great Zambini, stage magician. Black tailcoat and a purple cape on a dark violet
 * ground, gold foil, paper confetti, playing cards and gold stars. Everything is flat and unlit (nothing above 0.92, so the bloom
 * never turns it into a halo), pooled, takes world-space positions and has `reset()` where it holds state.
 *
 * - `Pieces`   pooled tumbling confetti / gold stars / playing cards: bursts, and one-off pieces with a velocity.
 * - `Flyers`   a card, a saw or a sword that follows a real bolt (`ctx.projectile`) or, where no bolt flies, a drawn straight path.
 * - `Hats`     three pooled top hats standing on the floor, with a gold ring under each so they read on any floor.
 * - `rabbitLook` a white rabbit with long ears (a `MinionLook`); `HIDDEN_LOOK` an empty one for a unit that is only a target.
 * - `paintHat`, `paintCard`, `paintStar` canvas drawing for the kit's icons and portrait.
 */

export const MAGIC = {
  core: 0xffffff,
  hot: 0xfff1c8,
  foil: 0xffe08a,
  gold: 0xe0b050,
  violet: 0xb05aff,
  purple: 0x7a30c8,
  deep: 0x2a1248,
  dark: 0x120a1e,
  red: 0xd8404a,
  pink: 0xff8ac8,
  cyan: 0x6ad8ff,
  card: 0xd6cfc0,
  steel: 0xc4cad8,
} as const;

export const MAGIC_CSS = {
  core: '#ffffff',
  hot: '#fff1c8',
  foil: '#ffe08a',
  gold: '#e0b050',
  violet: '#b05aff',
  purple: '#7a30c8',
  deep: '#2a1248',
  dark: '#120a1e',
  red: '#d8404a',
  pink: '#ff8ac8',
  cyan: '#6ad8ff',
  card: '#d6cfc0',
  steel: '#c4cad8',
} as const;

/** The colours of the confetti. */
export const CONFETTI = [MAGIC.violet, MAGIC.foil, MAGIC.pink, MAGIC.cyan, MAGIC.red, 0xe8e0f0] as const;
export const STARS = [MAGIC.foil, MAGIC.hot, MAGIC.gold] as const;

const MIN_SCALE = 1e-4;
export const BOLT_Y = 1.1;

// ---------------------------------------------------------------------------------------------------------------
// Canvas drawing (icons, portrait, the card texture).
// ---------------------------------------------------------------------------------------------------------------

/** A five-point star centred at (x, y), outer radius `r`. */
export function paintStar(g: CanvasRenderingContext2D, x: number, y: number, r: number, fill: string = MAGIC_CSS.foil, edge: string = MAGIC_CSS.dark) {
  g.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5, rr = i % 2 ? r * 0.42 : r;
    if (i === 0) g.moveTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
    else g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  g.closePath();
  g.fillStyle = fill;
  g.fill();
  g.strokeStyle = edge;
  g.lineWidth = Math.max(1, r * 0.12);
  g.stroke();
}

/** A playing card centred at (cx, cy), `h` tall, turned by `rot`; `suit` 0 heart, 1 spade, 2 diamond, 3 club. */
export function paintCard(g: CanvasRenderingContext2D, cx: number, cy: number, h: number, rot = 0, suit = 0) {
  const w = h * 0.68;
  g.save();
  g.translate(cx, cy);
  g.rotate(rot);
  g.fillStyle = MAGIC_CSS.dark;
  g.beginPath();
  g.roundRect(-w / 2 - h * 0.04, -h / 2 - h * 0.04, w + h * 0.08, h + h * 0.08, h * 0.1);
  g.fill();
  g.fillStyle = MAGIC_CSS.card;
  g.beginPath();
  g.roundRect(-w / 2, -h / 2, w, h, h * 0.08);
  g.fill();
  const red = suit === 0 || suit === 2;
  g.fillStyle = red ? MAGIC_CSS.red : '#241830';
  const s = h * 0.17;
  g.beginPath();
  if (suit === 0) {
    g.moveTo(0, s * 1.1);
    g.bezierCurveTo(-s * 1.7, -s * 0.2, -s * 0.9, -s * 1.3, 0, -s * 0.5);
    g.bezierCurveTo(s * 0.9, -s * 1.3, s * 1.7, -s * 0.2, 0, s * 1.1);
  } else if (suit === 2) {
    g.moveTo(0, -s * 1.3);
    g.lineTo(s * 0.95, 0);
    g.lineTo(0, s * 1.3);
    g.lineTo(-s * 0.95, 0);
  } else {
    g.moveTo(0, -s * 1.3);
    g.bezierCurveTo(s * 1.9, s * 0.2, s * 0.9, s * 1.2, 0, s * 0.6);
    g.bezierCurveTo(-s * 0.9, s * 1.2, -s * 1.9, s * 0.2, 0, -s * 1.3);
    g.fillRect(-s * 0.12, s * 0.4, s * 0.24, s * 0.9);
  }
  g.closePath();
  g.fill();
  g.fillRect(-w * 0.38, -h * 0.42, w * 0.14, h * 0.07);
  g.restore();
}

/** A top hat standing at (cx, base), `h` tall: black with a violet band and gold trim. */
export function paintHat(g: CanvasRenderingContext2D, cx: number, base: number, h: number) {
  const w = h * 1.05;
  g.fillStyle = MAGIC_CSS.dark;
  g.beginPath();
  g.ellipse(cx, base - h * 0.06, w * 0.62, h * 0.17, 0, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = '#2a1848';
  g.beginPath();
  g.ellipse(cx, base - h * 0.08, w * 0.58, h * 0.14, 0, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = MAGIC_CSS.foil;
  g.lineWidth = h * 0.03;
  g.stroke();
  g.fillStyle = '#1b1030';
  g.fillRect(cx - w * 0.31, base - h * 0.92, w * 0.62, h * 0.82);
  g.fillStyle = MAGIC_CSS.violet;
  g.fillRect(cx - w * 0.31, base - h * 0.3, w * 0.62, h * 0.13);
  g.fillStyle = MAGIC_CSS.foil;
  g.fillRect(cx - w * 0.31, base - h * 0.32, w * 0.62, h * 0.025);
  g.fillStyle = '#2a1848';
  g.beginPath();
  g.ellipse(cx, base - h * 0.92, w * 0.31, h * 0.09, 0, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = '#08040e';
  g.beginPath();
  g.ellipse(cx, base - h * 0.92, w * 0.25, h * 0.065, 0, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = 'rgba(255,255,255,0.18)';
  g.fillRect(cx - w * 0.24, base - h * 0.84, w * 0.06, h * 0.5);
}

let cardTex: THREE.CanvasTexture | undefined;
/** The face every flying card shows: a pale card, a red heart and a black spade. */
function cardTexture() {
  if (cardTex) return cardTex;
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 96;
  const g = c.getContext('2d')!;
  g.fillStyle = MAGIC_CSS.dark;
  g.fillRect(0, 0, 64, 96);
  g.fillStyle = MAGIC_CSS.card;
  g.fillRect(3, 3, 58, 90);
  g.fillStyle = MAGIC_CSS.red;
  g.beginPath();
  g.moveTo(32, 62);
  g.bezierCurveTo(14, 48, 18, 28, 32, 38);
  g.bezierCurveTo(46, 28, 50, 48, 32, 62);
  g.fill();
  g.fillStyle = '#241830';
  g.fillRect(8, 8, 9, 6);
  g.fillStyle = MAGIC_CSS.red;
  g.fillRect(47, 82, 9, 6);
  cardTex = new THREE.CanvasTexture(c);
  cardTex.colorSpace = THREE.SRGBColorSpace;
  return cardTex;
}

// ---------------------------------------------------------------------------------------------------------------
// Pieces: confetti, stars and cards that tumble and fall.
// ---------------------------------------------------------------------------------------------------------------

export type PieceKind = 'confetti' | 'star' | 'card';

interface Piece {
  live: boolean;
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  rot: THREE.Euler;
  spin: THREE.Vector3;
  age: number;
  life: number;
  size: number;
  seed: number;
  color: THREE.Color;
}

export interface BurstOptions {
  size?: number;
  life?: number;
  /** Extra upward share of the launch (default 0.6). */
  up?: number;
  colors?: readonly number[];
}

const STAR_FACE = new THREE.Vector3(0, 0.62, 0.78).normalize();

function starGeometry() {
  const s = new THREE.Shape();
  for (let i = 0; i < 10; i++) {
    const a = Math.PI / 2 + (i * Math.PI) / 5, r = i % 2 ? 0.42 : 1;
    if (i === 0) s.moveTo(Math.cos(a) * r, Math.sin(a) * r);
    else s.lineTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  s.closePath();
  return new THREE.ShapeGeometry(s);
}

export class Pieces {
  readonly mesh: THREE.InstancedMesh;
  private pool: Piece[] = [];
  private cursor = 0;
  private m = new THREE.Matrix4();
  private q = new THREE.Quaternion();
  private q0 = new THREE.Quaternion();
  private qz = new THREE.Quaternion();
  private e = new THREE.Euler();
  private s = new THREE.Vector3();
  private zAxis = new THREE.Vector3(0, 0, 1);

  constructor(readonly kind: PieceKind, private max = 80, private gravity = 6) {
    const geo = kind === 'star' ? starGeometry() : kind === 'card' ? new THREE.PlaneGeometry(0.62, 0.9) : new THREE.PlaneGeometry(1, 0.6);
    const mat = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide, map: kind === 'card' ? cardTexture() : null, color: 0xffffff });
    this.mesh = new THREE.InstancedMesh(geo, mat, max);
    this.mesh.frustumCulled = false;
    this.mesh.count = 0;
    this.q0.setFromUnitVectors(this.zAxis, STAR_FACE);
    for (let i = 0; i < max; i++) {
      this.pool.push({
        live: false, pos: new THREE.Vector3(), vel: new THREE.Vector3(), rot: new THREE.Euler(), spin: new THREE.Vector3(), age: 0, life: 1,
        size: 0.1, seed: Math.random() * 6, color: new THREE.Color(),
      });
      this.mesh.setColorAt(i, this.pool[i].color);
    }
  }

  get busy() {
    return this.pool.some((p) => p.live);
  }

  /** One piece with its own launch. */
  emit(pos: THREE.Vector3, vel: THREE.Vector3, size: number, life: number, color?: number) {
    const p = this.pool[this.cursor];
    this.cursor = (this.cursor + 1) % this.max;
    p.live = true;
    p.pos.copy(pos);
    p.vel.copy(vel);
    p.age = 0;
    p.life = life;
    p.size = size;
    p.rot.set(Math.random() * 6, Math.random() * 6, Math.random() * 6);
    p.spin.set((Math.random() - 0.5) * 14, (Math.random() - 0.5) * 14, (Math.random() - 0.5) * 14);
    if (this.kind === 'star') p.spin.set(0, 0, (Math.random() - 0.5) * 9);
    const set = this.kind === 'star' ? STARS : CONFETTI;
    p.color.set(color ?? (this.kind === 'card' ? 0xf0f0f0 : set[Math.floor(Math.random() * set.length)]));
    p.color.multiplyScalar(0.92);
    return p;
  }

  burst(pos: THREE.Vector3, count: number, speed: number, o: BurstOptions = {}) {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2, up = (o.up ?? 0.6) + Math.random() * 0.7, sp = speed * (0.4 + Math.random() * 0.8);
      const v = new THREE.Vector3(Math.cos(a), up, Math.sin(a)).normalize().multiplyScalar(sp);
      const colors = o.colors;
      this.emit(pos, v, (o.size ?? 0.16) * (0.7 + Math.random() * 0.6), (o.life ?? 1.1) * (0.7 + Math.random() * 0.5), colors ? colors[Math.floor(Math.random() * colors.length)] : undefined);
    }
  }

  reset() {
    for (const p of this.pool) p.live = false;
    this.mesh.count = 0;
  }

  update(dt: number) {
    let n = 0;
    for (const p of this.pool) {
      if (!p.live) continue;
      p.age += dt;
      if (p.age >= p.life) { p.live = false; continue; }
      p.vel.multiplyScalar(Math.max(0, 1 - 1.6 * dt));
      p.vel.y -= this.gravity * dt;
      if (this.kind !== 'star') p.vel.x += Math.sin(p.age * 9 + p.seed) * dt * 2.2;
      p.pos.addScaledVector(p.vel, dt);
      if (p.pos.y < 0.05) {
        p.pos.y = 0.05;
        p.vel.set(0, 0, 0);
        p.spin.multiplyScalar(0.8);
      }
      p.rot.x += p.spin.x * dt;
      p.rot.y += p.spin.y * dt;
      p.rot.z += p.spin.z * dt;
      const u = p.age / p.life;
      const k = u < 0.12 ? u / 0.12 : u > 0.72 ? 1 - (u - 0.72) / 0.28 : 1;
      this.s.setScalar(Math.max(p.size * k, MIN_SCALE));
      if (this.kind === 'star') this.q.copy(this.q0).multiply(this.qz.setFromAxisAngle(this.zAxis, p.rot.z));
      else this.q.setFromEuler(this.e.copy(p.rot));
      this.m.compose(p.pos, this.q, this.s);
      this.mesh.setMatrixAt(n, this.m);
      this.mesh.setColorAt(n, p.color);
      n++;
    }
    this.mesh.count = n;
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }
}

// ---------------------------------------------------------------------------------------------------------------
// Flyers: a card, a saw or a sword in flight.
// ---------------------------------------------------------------------------------------------------------------

export type FlyerKind = 'card' | 'saw' | 'sword';

const flatMat = (color: number) => new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide });

/** A flat outline in the XZ plane from points given as (x, forward). */
function flatShape(pts: [number, number][], color: number): THREE.Mesh {
  const s = new THREE.Shape();
  pts.forEach(([x, y], i) => (i === 0 ? s.moveTo(x, y) : s.lineTo(x, y)));
  s.closePath();
  const geo = new THREE.ShapeGeometry(s).rotateX(Math.PI / 2);
  return new THREE.Mesh(geo, flatMat(color));
}

/** A dark copy a little bigger behind a flat shape: the outline that makes it read on a bright floor. */
function outlined(face: THREE.Mesh, grow = 1.22): THREE.Group {
  const g = new THREE.Group();
  const back = new THREE.Mesh(face.geometry, flatMat(MAGIC.dark));
  back.scale.set(grow, 1, grow);
  back.position.y = -0.02;
  g.add(back, face);
  return g;
}

function buildFlyer(kind: FlyerKind): THREE.Group {
  const g = new THREE.Group();
  if (kind === 'card') {
    const face = new THREE.Mesh(new THREE.PlaneGeometry(0.46, 0.66).rotateX(Math.PI / 2), new THREE.MeshBasicMaterial({ map: cardTexture(), side: THREE.DoubleSide }));
    g.add(outlined(face, 1.14));
  } else if (kind === 'saw') {
    const pts: [number, number][] = [[0, 0.78]];
    for (let i = 0; i < 7; i++) pts.push([i % 2 ? 0.15 : 0.22, 0.6 - i * 0.12]);
    pts.push([0.22, -0.3], [-0.22, -0.3]);
    for (let i = 6; i >= 0; i--) pts.push([i % 2 ? -0.15 : -0.22, 0.6 - i * 0.12]);
    g.add(outlined(flatShape(pts, MAGIC.steel), 1.14));
    const grip = flatShape([[-0.1, -0.3], [0.1, -0.3], [0.1, -0.7], [-0.1, -0.7]], MAGIC.purple);
    const gold = flatShape([[-0.18, -0.3], [0.18, -0.3], [0.18, -0.38], [-0.18, -0.38]], MAGIC.foil);
    grip.position.y = 0.01;
    gold.position.y = 0.02;
    g.add(outlined(grip, 1.2), gold);
  } else {
    g.add(outlined(flatShape([[0, 0.95], [0.1, 0.78], [0.1, -0.28], [-0.1, -0.28], [-0.1, 0.78]], MAGIC.steel), 1.2));
    const guard = flatShape([[-0.26, -0.26], [0.26, -0.26], [0.26, -0.35], [-0.26, -0.35]], MAGIC.foil);
    const grip = flatShape([[-0.04, -0.35], [0.04, -0.35], [0.04, -0.62], [-0.04, -0.62]], MAGIC.purple);
    const pommel = flatShape([[-0.08, -0.62], [0.08, -0.62], [0.08, -0.72], [-0.08, -0.72]], MAGIC.foil);
    for (const m of [guard, grip, pommel]) m.position.y = 0.02;
    g.add(guard, grip, pommel);
  }
  for (const c of g.children) c.frustumCulled = false;
  return g;
}

export interface LaunchOptions {
  /** The real bolt; null where no bolt flies (a drawn path along `dir` for `range`). */
  bolt?: Projectile | null;
  from: THREE.Vector3;
  dir: THREE.Vector3;
  speed: number;
  range: number;
  /** Called once when it ends: where, and whether it hit someone. */
  onEnd?: (at: THREE.Vector3, hit: boolean) => void;
}

interface Flyer {
  group: THREE.Group;
  body: THREE.Group;
  trail: THREE.Mesh;
  live: boolean;
  held: boolean;
  bolt: Projectile | null;
  from: THREE.Vector3;
  dir: THREE.Vector3;
  speed: number;
  range: number;
  dist: number;
  age: number;
  spark: number;
  last: THREE.Vector3;
  onEnd?: (at: THREE.Vector3, hit: boolean) => void;
}

const SPIN = 15;

export class Flyers {
  readonly group = new THREE.Group();
  private flyers: Flyer[] = [];
  private trailGeo: THREE.BufferGeometry;
  private trailMat = new THREE.MeshBasicMaterial({ color: MAGIC.violet, transparent: true, opacity: 0.5, depthWrite: false, side: THREE.DoubleSide });
  private v = new THREE.Vector3();

  constructor(readonly kind: FlyerKind, count: number, private sparks?: Pieces, private trailLen = 1.6) {
    this.trailGeo = new THREE.BufferGeometry();
    this.trailGeo.setAttribute('position', new THREE.Float32BufferAttribute([-1, 0, 0, 1, 0, 0, 0, 0, -1], 3));
    for (let i = 0; i < count; i++) {
      const body = new THREE.Group();
      body.add(buildFlyer(kind));
      const group = new THREE.Group();
      const trail = new THREE.Mesh(this.trailGeo, this.trailMat);
      trail.frustumCulled = false;
      trail.position.y = -0.04;
      group.add(trail, body);
      group.visible = false;
      this.group.add(group);
      this.flyers.push({
        group, body, trail, live: false, held: false, bolt: null, from: new THREE.Vector3(), dir: new THREE.Vector3(0, 0, 1), speed: 1, range: 1,
        dist: 0, age: 0, spark: 0, last: new THREE.Vector3(),
      });
    }
  }

  get busy() {
    return this.flyers.some((f) => f.live);
  }

  /** Shows flyer `i` held still at `pos`, pointing along `dir`, `scale` big (the wind-up). */
  show(i: number, pos: THREE.Vector3, dir: THREE.Vector3, scale: number, spin = 0, age = 0) {
    const f = this.flyers[i];
    if (!f || f.live) return;
    f.held = true;
    f.group.visible = scale > 0.01;
    f.group.position.set(pos.x, pos.y, pos.z);
    f.group.rotation.y = Math.atan2(dir.x, dir.z);
    f.group.scale.setScalar(Math.max(scale, MIN_SCALE));
    f.trail.scale.set(MIN_SCALE, 1, MIN_SCALE);
    this.pose(f, age, spin);
  }

  hide(i: number) {
    const f = this.flyers[i];
    if (!f) return;
    f.live = false;
    f.held = false;
    f.group.visible = false;
  }

  launch(i: number, o: LaunchOptions) {
    const f = this.flyers[i];
    if (!f) return;
    f.live = true;
    f.held = false;
    f.bolt = o.bolt ?? null;
    f.from.copy(o.from);
    f.dir.copy(o.dir).setY(0).normalize();
    f.speed = o.speed;
    f.range = o.range;
    f.dist = 0;
    f.spark = 0;
    f.last.copy(o.from);
    f.onEnd = o.onEnd;
    f.group.scale.setScalar(1);
    f.group.visible = true;
  }

  reset() {
    for (const f of this.flyers) {
      f.live = false;
      f.held = false;
      f.bolt = null;
      f.onEnd = undefined;
      f.group.visible = false;
    }
  }

  private pose(f: Flyer, age: number, spin: number) {
    if (this.kind === 'card') {
      f.body.rotation.set(0.3, age * spin, 0);
    } else if (this.kind === 'saw') {
      f.body.rotation.set(0, 0, Math.sin(age * 18) * 0.2);
    } else {
      f.body.rotation.set(0, 0, Math.sin(age * 9) * 0.06);
    }
  }

  update(dt: number) {
    for (const f of this.flyers) {
      if (!f.live) continue;
      f.age += dt;
      let at: THREE.Vector3, dir = f.dir;
      if (f.bolt) {
        if (!f.bolt.alive) { this.end(f, f.bolt.pos, f.bolt.hits > 0); continue; }
        at = f.bolt.pos;
        dir = f.bolt.dir;
      } else {
        f.dist += f.speed * dt;
        if (f.dist >= f.range) { this.end(f, this.v.copy(f.from).addScaledVector(f.dir, f.range), false); continue; }
        at = this.v.copy(f.from).addScaledVector(f.dir, f.dist);
      }
      f.last.copy(at);
      f.group.position.set(at.x, BOLT_Y, at.z);
      f.group.rotation.y = Math.atan2(dir.x, dir.z);
      this.pose(f, f.age, this.kind === 'card' ? SPIN : 0);
      const run = Math.min(this.trailLen, Math.hypot(at.x - f.from.x, at.z - f.from.z));
      f.trail.scale.set(this.kind === 'card' ? 0.2 : this.kind === 'saw' ? 0.3 : 0.18, 1, Math.max(MIN_SCALE, run));
      f.spark += dt;
      if (this.sparks && f.spark >= 0.045) {
        f.spark = 0;
        this.sparks.burst(this.v.set(at.x, BOLT_Y, at.z), 1, 0.9, { size: 0.15, life: 0.55, up: 0.1 });
      }
    }
  }

  private end(f: Flyer, at: THREE.Vector3, hit: boolean) {
    f.live = false;
    f.group.visible = false;
    const cb = f.onEnd;
    f.onEnd = undefined;
    cb?.(at.clone().setY(BOLT_Y), hit);
  }
}

// ---------------------------------------------------------------------------------------------------------------
// Hats: three top hats standing on the floor.
// ---------------------------------------------------------------------------------------------------------------

/** Where the hat's centre is in the picture and how big it is: the brim is 0.46 m out. */
export const HAT_BRIM = 0.46;

let hatGeos: Record<string, THREE.BufferGeometry> | undefined;
function hatGeometry() {
  return (hatGeos ??= {
    brim: new THREE.CylinderGeometry(HAT_BRIM, HAT_BRIM, 0.05, 28),
    crown: new THREE.CylinderGeometry(0.27, 0.3, 0.5, 22),
    band: new THREE.CylinderGeometry(0.305, 0.31, 0.1, 22),
    trim: new THREE.CylinderGeometry(0.31, 0.31, 0.022, 22),
    top: new THREE.CylinderGeometry(0.27, 0.27, 0.01, 22),
    hole: new THREE.CircleGeometry(0.22, 22).rotateX(-Math.PI / 2),
    rim: new THREE.TorusGeometry(HAT_BRIM, 0.02, 6, 32).rotateX(Math.PI / 2),
    disc: new THREE.CircleGeometry(0.62, 32).rotateX(-Math.PI / 2),
    ring: new THREE.RingGeometry(0.56, 0.66, 40).rotateX(-Math.PI / 2),
    glint: new THREE.PlaneGeometry(0.06, 0.34),
  });
}

class Hat {
  readonly group = new THREE.Group();
  readonly body = new THREE.Group();
  readonly ringMat = new THREE.MeshBasicMaterial({ color: MAGIC.foil, transparent: true, opacity: 0.85, depthWrite: false, side: THREE.DoubleSide });
  private discMat = new THREE.MeshBasicMaterial({ color: MAGIC.dark, transparent: true, opacity: 0.5, depthWrite: false });

  constructor() {
    const G = hatGeometry();
    const dark = new THREE.MeshBasicMaterial({ color: 0x1b1030 });
    const lit = new THREE.MeshBasicMaterial({ color: 0x3a2260 });
    const brim = new THREE.Mesh(G.brim, dark);
    brim.position.y = 0.05;
    const rim = new THREE.Mesh(G.rim, new THREE.MeshBasicMaterial({ color: MAGIC.gold }));
    rim.position.y = 0.05;
    const crown = new THREE.Mesh(G.crown, dark);
    crown.position.y = 0.3;
    const band = new THREE.Mesh(G.band, new THREE.MeshBasicMaterial({ color: MAGIC.violet }));
    band.position.y = 0.16;
    const trim = new THREE.Mesh(G.trim, new THREE.MeshBasicMaterial({ color: MAGIC.foil }));
    trim.position.y = 0.225;
    const top = new THREE.Mesh(G.top, lit);
    top.position.y = 0.555;
    const hole = new THREE.Mesh(G.hole, new THREE.MeshBasicMaterial({ color: 0x08040e }));
    hole.position.y = 0.562;
    const glint = new THREE.Mesh(G.glint, new THREE.MeshBasicMaterial({ color: 0x6a4aa0, side: THREE.DoubleSide }));
    glint.position.set(-0.14, 0.32, 0.27);
    glint.rotation.y = -0.5;
    this.body.add(brim, rim, crown, band, trim, top, hole, glint);
    const disc = new THREE.Mesh(G.disc, this.discMat);
    disc.position.y = 0.02;
    disc.renderOrder = 1;
    const ring = new THREE.Mesh(G.ring, this.ringMat);
    ring.position.y = 0.03;
    ring.renderOrder = 2;
    this.group.add(disc, ring, this.body);
    for (const c of [...this.group.children, ...this.body.children]) c.frustumCulled = false;
    this.group.visible = false;
  }
}

/** Three top hats. `set` places one (`lift` raises the hat off the floor in a hop; the ring and shadow stay down). */
export class Hats {
  readonly group = new THREE.Group();
  private hats: Hat[] = [];

  constructor(count = 3) {
    for (let i = 0; i < count; i++) {
      const h = new Hat();
      this.hats.push(h);
      this.group.add(h.group);
    }
  }

  set(i: number, x: number, z: number, scale = 1, lift = 0, tilt = 0, yaw = 0, glow = 0) {
    const h = this.hats[i];
    if (!h) return;
    h.group.visible = scale > 0.01;
    h.group.position.set(x, 0, z);
    h.group.scale.setScalar(Math.max(scale, MIN_SCALE));
    h.body.position.y = lift;
    h.body.rotation.set(0, yaw, tilt);
    h.ringMat.opacity = 0.7 + 0.3 * glow;
    h.ringMat.color.setHex(glow > 0.5 ? MAGIC.hot : MAGIC.foil);
  }

  hide(i: number) {
    const h = this.hats[i];
    if (h) h.group.visible = false;
  }

  hideAll() {
    for (const h of this.hats) h.group.visible = false;
  }
}

// ---------------------------------------------------------------------------------------------------------------
// Units' looks.
// ---------------------------------------------------------------------------------------------------------------

/** A unit that is only a target: nothing is drawn (the effect draws it) and its HP bar is hidden by the effect. */
export const HIDDEN_LOOK: MinionLook = () => ({ root: new THREE.Group(), animate() { /* nothing */ }, barY: 1 });

/** The white rabbit: a pale round body (0.72 at most), two tall ears with pink insides, a cotton tail, dark eyes. It hops. */
export const rabbitLook: MinionLook = (_kind: string, p: MinionPalette): MinionRig => {
  const root = new THREE.Group();
  // The palette's body material carries the hit flash; its colour is a pale warm grey (0.72 at most: the bloom turns more into a halo).
  p.body.color.setRGB(0.72, 0.7, 0.67);
  p.body.roughness = 0.9;
  p.eye.color.set(0x2a0e1c);
  const pink = new THREE.MeshBasicMaterial({ color: 0xc88aa0 });
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.27, 12, 10), p.body);
  body.scale.set(0.9, 0.85, 1.25);
  body.position.set(0, 0.3, 0);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.17, 12, 10), p.body);
  head.position.set(0, 0.5, 0.27);
  const out = (m: THREE.Mesh, k = 1.18) => {
    const o = new THREE.Mesh(m.geometry, p.outline);
    o.position.copy(m.position);
    o.rotation.copy(m.rotation);
    o.scale.copy(m.scale).multiplyScalar(k);
    return o;
  };
  root.add(out(body), out(head, 1.22), body, head);
  const earGeo = new THREE.CapsuleGeometry(0.05, 0.3, 4, 8);
  const ears = [-1, 1].map((s) => {
    const e = new THREE.Group();
    e.position.set(s * 0.07, 0.62, 0.24);
    e.rotation.z = -s * 0.18;
    const outer = new THREE.Mesh(earGeo, p.body);
    outer.position.y = 0.2;
    const inner = new THREE.Mesh(earGeo, pink);
    inner.scale.set(0.5, 0.8, 0.4);
    inner.position.set(0, 0.2, 0.035);
    const hull = new THREE.Mesh(earGeo, p.outline);
    hull.scale.set(1.35, 1.1, 1.35);
    hull.position.y = 0.2;
    e.add(hull, outer, inner);
    root.add(e);
    return e;
  });
  const tail = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 8), p.body);
  tail.position.set(0, 0.3, -0.34);
  const nose = new THREE.Mesh(new THREE.SphereGeometry(0.03, 6, 6), pink);
  nose.position.set(0, 0.49, 0.43);
  root.add(tail, nose);
  for (const s of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.03, 6, 6), p.eye);
    eye.position.set(s * 0.075, 0.54, 0.38);
    root.add(eye);
  }
  const feet = [-1, 1].map((s) => {
    const f = new THREE.Mesh(new THREE.CapsuleGeometry(0.05, 0.16, 4, 6), p.body);
    f.rotation.x = Math.PI / 2;
    f.position.set(s * 0.12, 0.05, -0.12);
    root.add(f);
    return f;
  });
  void feet;
  let phase = 0;
  return {
    root,
    barY: 0.95,
    animate(dt, pose) {
      phase += dt * (4 + 9 * pose.walk);
      const hop = Math.abs(Math.sin(phase)) * (0.05 + 0.22 * pose.walk);
      root.position.y = hop;
      root.rotation.x = pose.walk * -Math.cos(phase) * 0.16;
      ears.forEach((e, i) => { e.rotation.x = -0.15 - hop * 0.8 + Math.sin(phase * 0.5 + i) * 0.05; });
      if (pose.swing >= 0) root.position.z = Math.sin(pose.swing * Math.PI) * 0.18;
      else root.position.z = 0;
    },
  };
};
