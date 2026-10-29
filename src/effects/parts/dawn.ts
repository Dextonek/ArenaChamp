import * as THREE from 'three';

/**
 * The dawn kit (pipeline/designs/kit-dawn.md): hard-light geometry. Light is solid: flat gold panels with crisp edges
 * (hexagons, kite shields, long blade shards) that fly in and click together into shapes, lit with a thin white core
 * line over an ivory/gold face and a dark amber rim, then shatter back into panels. Nothing here is a soft glow: the
 * panels are opaque flat shapes, the rays are thin crisp wedges, the halo is a solid ring. Only the thin core lines
 * are bright enough to bloom (the gold and ivory faces stay below the bloom threshold). Everything is pooled, takes
 * world-space positions and has a `reset()`.
 */

/** Palette. Numbers for `THREE.Color`, `DAWN_CSS` for APIs that want a string. */
export const DAWN = {
  core: 0xfffdf2,
  hot: 0xffe7a0,
  body: 0xf2b83c,
  accent: 0x7fd8ff,
  dark: 0x3a2408,
  foil: 0xefe6d2,
} as const;

export const DAWN_CSS = {
  core: '#fffdf2',
  hot: '#ffe7a0',
  body: '#f2b83c',
  accent: '#7fd8ff',
  dark: '#3a2408',
  foil: '#efe6d2',
} as const;

const MIN_SCALE = 1e-4;
export const dawnClamp01 = (x: number) => Math.min(1, Math.max(0, x));
export const dawnEaseOut = (x: number) => 1 - Math.pow(1 - dawnClamp01(x), 3);
export const dawnEaseOutBack = (x: number) => {
  const k = dawnClamp01(x) - 1;
  return 1 + 2.2 * k * k * k + 1.2 * k * k;
};
const sstep = (x: number) => {
  const t = dawnClamp01(x);
  return t * t * (3 - 2 * t);
};

const Z = new THREE.Vector3(0, 0, 1);
const _qr = new THREE.Quaternion().setFromAxisAngle(Z, Math.PI / 2);

/** Unit normal of an upright panel that faces the gameplay camera (behind the caster, looking along `aim`). */
export function dawnFacing(aim: number, out = new THREE.Vector3()) {
  return out.set(-Math.sin(aim), 0, -Math.cos(aim));
}

/** Unit direction from the caster along `aim` (horizontal). */
export function dawnForward(aim: number, out = new THREE.Vector3()) {
  return out.set(Math.sin(aim), 0, Math.cos(aim));
}

/** Unit vector from the scene toward the gameplay camera (16 back, 8 up), for panels that should face it. */
export function dawnView(aim: number, out = new THREE.Vector3()) {
  return out.set(-Math.sin(aim) * 0.89, 0.45, -Math.cos(aim) * 0.89).normalize();
}

const _x = new THREE.Vector3();
const _y = new THREE.Vector3();
const _z = new THREE.Vector3();
const _m = new THREE.Matrix4();

/** Orientation whose local +Z is `normal` and whose local +Y points along `up` (made perpendicular to the normal). */
export function dawnOrient(normal: THREE.Vector3, up: THREE.Vector3, out: THREE.Quaternion) {
  _z.copy(normal).normalize();
  _y.copy(up).addScaledVector(_z, -up.dot(_z));
  if (_y.lengthSq() < 1e-8) _y.set(Math.abs(_z.y) > 0.9 ? 1 : 0, Math.abs(_z.y) > 0.9 ? 0 : 1, 0);
  _y.normalize();
  _x.crossVectors(_y, _z).normalize();
  _y.crossVectors(_z, _x);
  _m.makeBasis(_x, _y, _z);
  return out.setFromRotationMatrix(_m);
}

/** The panel normal that faces the camera as much as it can while still containing the direction `dir`. */
export function dawnPanelNormal(dir: THREE.Vector3, view: THREE.Vector3, out = new THREE.Vector3()) {
  out.copy(view).addScaledVector(dir, -view.dot(dir));
  if (out.lengthSq() < 1e-4) out.set(0, 1, 0).addScaledVector(dir, -dir.y);
  return out.normalize();
}

// ---------------------------------------------------------------------------------------------------------------
// Outlines (unit space, y up, origin inside). All convex.
// ---------------------------------------------------------------------------------------------------------------

type Pt = [number, number];
export type PanelShape = 'hex' | 'shield' | 'shard';
const SHAPES: PanelShape[] = ['hex', 'shield', 'shard'];

function hexPts(): Pt[] {
  const out: Pt[] = [];
  for (let i = 0; i < 6; i++) out.push([Math.cos((i / 6) * Math.PI * 2) * 0.5, Math.sin((i / 6) * Math.PI * 2) * 0.5]);
  return out;
}

/** A kite shield: flat top, point at -y, 0.72 wide, 1 tall. */
const SHIELD: Pt[] = [[-0.36, 0.5], [0.36, 0.5], [0.36, 0.0], [0, -0.5], [-0.36, 0.0]];
/** A long blade shard: tip at +y, 0.28 wide, 1 long, cut tail at -y. */
const SHARD: Pt[] = [[0, 0.5], [0.14, 0.08], [0.1, -0.5], [-0.1, -0.5], [-0.14, 0.08]];

const scalePts = (pts: Pt[], sx: number, sy = sx): Pt[] => pts.map(([x, y]) => [x * sx, y * sy] as Pt);

function fillGeo(pts: Pt[]): THREE.BufferGeometry {
  return new THREE.ShapeGeometry(new THREE.Shape(pts.map(([x, y]) => new THREE.Vector2(x, y))));
}

/** A closed strip between an outer and an inner copy of the same outline. */
function ringGeo(outer: Pt[], inner: Pt[]): THREE.BufferGeometry {
  const n = outer.length, pos: number[] = [], idx: number[] = [];
  for (let i = 0; i < n; i++) pos.push(outer[i][0], outer[i][1], 0, inner[i][0], inner[i][1], 0);
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    idx.push(2 * i, 2 * i + 1, 2 * j, 2 * i + 1, 2 * j + 1, 2 * j);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  return g;
}

interface PanelGeos { rim: THREE.BufferGeometry; face: THREE.BufferGeometry; core: THREE.BufferGeometry }
const geoCache = new Map<PanelShape, PanelGeos>();
function geosFor(shape: PanelShape): PanelGeos {
  let g = geoCache.get(shape);
  if (g) return g;
  if (shape === 'shard') {
    g = {
      rim: fillGeo(SHARD),
      face: fillGeo(scalePts(SHARD, 0.66, 0.94)),
      core: fillGeo([[0, 0.4], [0.03, 0.05], [0.024, -0.4], [-0.024, -0.4], [-0.03, 0.05]]),
    };
  } else {
    const pts = shape === 'hex' ? hexPts() : SHIELD;
    const inset = shape === 'hex' ? 0.84 : 0.85;
    g = {
      rim: fillGeo(pts),
      face: fillGeo(scalePts(pts, inset)),
      core: ringGeo(scalePts(pts, 0.7), scalePts(pts, 0.62)),
    };
  }
  geoCache.set(shape, g);
  return g;
}

// ---------------------------------------------------------------------------------------------------------------
// LightPanels
// ---------------------------------------------------------------------------------------------------------------

interface Panel {
  used: boolean;
  shape: number;
  pos: THREE.Vector3;
  quat: THREE.Quaternion;
  size: number;
  wide: number;
  color: THREE.Color;
  // assemble
  asmAge: number; // -1 = not assembling
  asmDelay: number;
  asmDur: number;
  startPos: THREE.Vector3;
  startQuat: THREE.Quaternion;
  // fade
  fadeAge: number; // -1 = none
  fadeDelay: number;
  fadeDur: number;
  // free flight (shatter / fling)
  flying: boolean;
  fpos: THREE.Vector3;
  fquat: THREE.Quaternion;
  vel: THREE.Vector3;
  axis: THREE.Vector3;
  spin: number;
  age: number;
  life: number;
}

const FACE_COLORS = [DAWN.body, DAWN.body, DAWN.hot, DAWN.foil, DAWN.body, DAWN.foil];

/**
 * Instanced hard-light panels (`hex`, `shield` = kite, `shard` = long blade piece), each a dark amber rim under an
 * ivory or gold face under a thin white core line. `place(i, pos, quat, size, shape, wide, color)` sets panel `i`
 * (call it every frame while it moves; `wide` stretches the width, `color` overrides the face colour). `assemble(
 * seconds, stagger, scatter, origin)` makes every placed panel fly in from a random spot `scatter` away and click into
 * place with a small pop. `shatter(speed, life, center)` throws all panels out and they shrink away within `life`;
 * `fling(i, vel, life)` does it for one panel; `fadeOut(seconds, stagger)` shrinks them away panel by panel in place;
 * `hide(i)` removes one. `glow` (0..) overdrives the core lines. `update(dt)` every frame, after the `place` calls.
 * Add `mesh`.
 */
export class LightPanels {
  readonly mesh = new THREE.Group();
  gravity = -9;
  private panels: Panel[] = [];
  private groups: { rim: THREE.InstancedMesh; face: THREE.InstancedMesh; core: THREE.InstancedMesh }[] = [];
  private mats: THREE.MeshBasicMaterial[] = [];
  private coreMats: THREE.MeshBasicMaterial[] = [];
  private _glow = 0;
  private _opacity = 1;
  private m = new THREE.Matrix4();
  private p = new THREE.Vector3();
  private q = new THREE.Quaternion();
  private sc = new THREE.Vector3();
  private qa = new THREE.Quaternion();
  private col = new THREE.Color();

  constructor(readonly max = 24, renderOrder = 6) {
    const mk = (geo: THREE.BufferGeometry, color: number, ro: number, off: number, core: boolean) => {
      const mat = new THREE.MeshBasicMaterial({
        color, transparent: true, depthWrite: true, side: THREE.DoubleSide,
        polygonOffset: true, polygonOffsetFactor: off, polygonOffsetUnits: off,
      });
      (core ? this.coreMats : this.mats).push(mat);
      const im = new THREE.InstancedMesh(geo, mat, max);
      im.frustumCulled = false;
      im.renderOrder = ro;
      im.count = 0;
      this.mesh.add(im);
      return im;
    };
    for (const shape of SHAPES) {
      const g = geosFor(shape);
      const rim = mk(g.rim, DAWN.dark, renderOrder, -1, false);
      const face = mk(g.face, 0xffffff, renderOrder + 1, -2, false);
      const core = mk(g.core, DAWN.core, renderOrder + 2, -3, true);
      face.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(max * 3), 3);
      this.groups.push({ rim, face, core });
    }
    for (let i = 0; i < max; i++) {
      this.panels.push({
        used: false, shape: 0, pos: new THREE.Vector3(), quat: new THREE.Quaternion(), size: 1, wide: 1, color: new THREE.Color(DAWN.body),
        asmAge: -1, asmDelay: 0, asmDur: 0.3, startPos: new THREE.Vector3(), startQuat: new THREE.Quaternion(),
        fadeAge: -1, fadeDelay: 0, fadeDur: 0.3,
        flying: false, fpos: new THREE.Vector3(), fquat: new THREE.Quaternion(), vel: new THREE.Vector3(),
        axis: new THREE.Vector3(1, 0, 0), spin: 0, age: 0, life: 1,
      });
    }
    this.mesh.visible = false;
  }

  get glow() { return this._glow; }
  set glow(v: number) {
    this._glow = v;
    for (const m of this.coreMats) m.color.setHex(DAWN.core).multiplyScalar(1 + 2.2 * v);
  }

  get opacity() { return this._opacity; }
  set opacity(v: number) {
    this._opacity = v;
    for (const m of this.mats) m.opacity = v;
    for (const m of this.coreMats) m.opacity = v;
  }

  place(
    i: number, pos: THREE.Vector3, quat: THREE.Quaternion, size: number, shape: PanelShape = 'hex', wide = 1,
    color?: THREE.ColorRepresentation,
  ) {
    const p = this.panels[i];
    if (!p || p.flying) return;
    if (!p.used) {
      p.used = true;
      p.color.set(color ?? FACE_COLORS[i % FACE_COLORS.length]);
    } else if (color !== undefined) p.color.set(color);
    p.shape = SHAPES.indexOf(shape);
    p.pos.copy(pos);
    p.quat.copy(quat);
    p.size = Math.max(size, MIN_SCALE);
    p.wide = wide;
  }

  hide(i: number) {
    const p = this.panels[i];
    if (p && !p.flying) p.used = false;
  }

  /** Every placed panel flies in from a random spot `scatter` away from `origin` (default: from itself) and clicks into place. */
  assemble(seconds = 0.4, stagger = 0.3, scatter = 9, origin?: THREE.Vector3) {
    const used = this.panels.filter((p) => p.used && !p.flying);
    used.forEach((p, k) => {
      p.asmAge = 0;
      p.asmDur = seconds * (0.85 + 0.3 * ((k * 7) % 5) / 4);
      p.asmDelay = used.length > 1 ? (((k * 5) % used.length) / (used.length - 1)) * stagger : 0;
      const a = Math.random() * Math.PI * 2, e = (Math.random() - 0.3) * 1.2, r = scatter * (0.6 + Math.random() * 0.4);
      p.startPos.copy(origin ?? p.pos).add(this.p.set(Math.cos(a) * Math.cos(e) * r, Math.sin(e) * r * 0.8 + 1, Math.sin(a) * Math.cos(e) * r));
      p.startQuat.setFromAxisAngle(this.sc.set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize(), Math.random() * 6);
    });
  }

  /** Shrinks the panels away in place, panel by panel. */
  fadeOut(seconds = 0.4, stagger = 0.4) {
    const used = this.panels.filter((p) => p.used);
    used.forEach((p, k) => {
      p.fadeAge = 0;
      p.fadeDur = seconds;
      p.fadeDelay = used.length > 1 ? (((k * 7) % used.length) / (used.length - 1)) * stagger : 0;
    });
  }

  /** Throws panel `i` out with velocity `vel`; it tumbles, falls and shrinks away within `life` seconds. */
  fling(i: number, vel: THREE.Vector3, life = 1, spin = 9) {
    const p = this.panels[i];
    if (!p || !p.used || p.flying) return;
    p.flying = true;
    p.fpos.copy(p.pos);
    p.fquat.copy(p.quat);
    p.vel.copy(vel);
    p.axis.set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize();
    p.spin = (Math.random() - 0.5) * 2 * spin;
    p.age = 0;
    p.life = life;
    p.asmAge = -1;
  }

  /** Every placed panel bursts away from `center` and shrinks out within `life` seconds. */
  shatter(speed = 5, life = 1, center?: THREE.Vector3) {
    for (let i = 0; i < this.panels.length; i++) {
      const p = this.panels[i];
      if (!p.used || p.flying) continue;
      this.p.copy(p.pos);
      if (center) this.p.sub(center); else this.p.set(Math.random() - 0.5, 0.2, Math.random() - 0.5);
      if (this.p.lengthSq() < 1e-4) this.p.set(Math.random() - 0.5, 0.3, Math.random() - 0.5);
      this.p.normalize().multiplyScalar(speed * (0.45 + Math.random() * 0.75));
      this.p.y += speed * 0.3;
      this.fling(i, this.p, life * (0.85 + Math.random() * 0.3));
    }
  }

  update(dt: number) {
    const counts = [0, 0, 0];
    for (const p of this.panels) {
      if (!p.used) continue;
      let s = p.size;
      this.p.copy(p.pos);
      this.q.copy(p.quat);
      if (p.flying) {
        p.age += dt;
        if (p.age >= p.life) { p.used = false; p.flying = false; continue; }
        p.vel.y += this.gravity * dt;
        p.fpos.addScaledVector(p.vel, dt);
        p.fquat.premultiply(this.qa.setFromAxisAngle(p.axis, p.spin * dt));
        if (p.fpos.y < 0.08) { p.fpos.y = 0.08; p.vel.y = Math.abs(p.vel.y) * 0.2; p.vel.x *= 0.85; p.vel.z *= 0.85; }
        const k = p.age / p.life;
        const f = 1 - sstep((k - 0.4) / 0.6);
        s *= Math.max(0.05 + 0.95 * f * f, 0);
        this.p.copy(p.fpos);
        this.q.copy(p.fquat);
      } else if (p.asmAge >= 0) {
        p.asmAge += dt;
        const a = p.asmAge - p.asmDelay;
        if (a < 0) continue;
        const k = dawnClamp01(a / p.asmDur), e = dawnEaseOut(k);
        this.p.lerpVectors(p.startPos, p.pos, e);
        this.q.copy(p.startQuat).slerp(p.quat, e);
        s *= (0.5 + 0.5 * e) * (1 + 0.14 * (k >= 1 ? Math.max(0, 1 - (a - p.asmDur) / 0.1) : 0));
        if (a >= p.asmDur + 0.12) p.asmAge = -1;
      }
      if (p.fadeAge >= 0) {
        p.fadeAge += dt;
        const k = dawnClamp01((p.fadeAge - p.fadeDelay) / p.fadeDur);
        if (k >= 1) { p.used = false; p.fadeAge = -1; continue; }
        s *= 1 - k * k;
      }
      s = Math.max(s, MIN_SCALE);
      const g = this.groups[p.shape], c = counts[p.shape]++;
      this.m.compose(this.p, this.q, this.sc.set(s * p.wide, s, s));
      g.rim.setMatrixAt(c, this.m);
      g.face.setMatrixAt(c, this.m);
      g.core.setMatrixAt(c, this.m);
      this.col.copy(p.color);
      g.face.setColorAt(c, this.col);
    }
    let any = false;
    this.groups.forEach((g, k) => {
      g.rim.count = g.face.count = g.core.count = counts[k];
      g.rim.instanceMatrix.needsUpdate = g.face.instanceMatrix.needsUpdate = g.core.instanceMatrix.needsUpdate = true;
      if (g.face.instanceColor) g.face.instanceColor.needsUpdate = true;
      if (counts[k] > 0) any = true;
    });
    this.mesh.visible = any;
  }

  reset() {
    for (const p of this.panels) {
      p.used = false;
      p.flying = false;
      p.asmAge = -1;
      p.fadeAge = -1;
    }
    this.glow = 0;
    this.opacity = 1;
    for (const g of this.groups) g.rim.count = g.face.count = g.core.count = 0;
    this.mesh.visible = false;
  }
}

// ---------------------------------------------------------------------------------------------------------------
// HaloRing
// ---------------------------------------------------------------------------------------------------------------

/**
 * A solid gold ring with an ivory inner band, a dark amber outer rim, a thin white core line and a crown of short
 * crisp ray ticks of uneven length. `set(center, normal, radius)` places it (radius to the outer rim), `spin(dt)` turns
 * the ticks and the core line, `opacity` fades it. Add `mesh`.
 */
export class HaloRing {
  readonly mesh = new THREE.Group();
  private turn = new THREE.Group();
  private mats: THREE.MeshBasicMaterial[] = [];
  private _opacity = 1;

  constructor() {
    const band = (a: number, b: number, color: number, ro: number, off: number) => {
      const mat = new THREE.MeshBasicMaterial({
        color, transparent: true, depthWrite: false, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: off, polygonOffsetUnits: off,
      });
      this.mats.push(mat);
      const m = new THREE.Mesh(new THREE.RingGeometry(a, b, 72), mat);
      m.renderOrder = ro;
      m.frustumCulled = false;
      return m;
    };
    const ticks: number[] = [], idx: number[] = [];
    const n = 18;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2, w = 0.085, r0 = 1.03, r1 = r0 + 0.2 + 0.16 * ((i * 7) % 4) / 3;
      const base = ticks.length / 3;
      ticks.push(Math.cos(a - w) * r0, Math.sin(a - w) * r0, 0, Math.cos(a + w) * r0, Math.sin(a + w) * r0, 0, Math.cos(a) * r1, Math.sin(a) * r1, 0);
      idx.push(base, base + 1, base + 2);
    }
    const tg = new THREE.BufferGeometry();
    tg.setAttribute('position', new THREE.Float32BufferAttribute(ticks, 3));
    tg.setIndex(idx);
    const tickMat = new THREE.MeshBasicMaterial({
      color: DAWN.body, transparent: true, depthWrite: false, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3,
    });
    this.mats.push(tickMat);
    const tickMesh = new THREE.Mesh(tg, tickMat);
    tickMesh.renderOrder = 9;
    tickMesh.frustumCulled = false;
    this.turn.add(
      tickMesh,
      band(0.97, 1.0, DAWN.dark, 7, -1), band(0.74, 0.97, DAWN.body, 8, -2), band(0.52, 0.74, DAWN.foil, 8, -2),
      band(0.84, 0.865, DAWN.core, 9, -4),
    );
    this.mesh.add(this.turn);
    this.mesh.visible = false;
  }

  get opacity() { return this._opacity; }
  set opacity(v: number) {
    this._opacity = v;
    for (const m of this.mats) m.opacity = v;
    this.mesh.visible = v > 0.004;
  }

  set(center: THREE.Vector3, normal: THREE.Vector3, radius: number) {
    this.mesh.position.copy(center);
    this.mesh.quaternion.setFromUnitVectors(Z, this.p.copy(normal).normalize());
    this.mesh.scale.setScalar(Math.max(radius, MIN_SCALE));
  }

  private p = new THREE.Vector3();

  spin(dt: number) {
    this.turn.rotation.z += dt * 0.9;
  }

  reset() {
    this.opacity = 0;
    this.turn.rotation.z = 0;
    this.mesh.scale.setScalar(MIN_SCALE);
  }
}

// ---------------------------------------------------------------------------------------------------------------
// SunRays
// ---------------------------------------------------------------------------------------------------------------

/**
 * A few thin, crisp, tapered wedges at low opacity fanning from a point, all in the plane with normal `normal` (it
 * defaults to facing the camera; `face(aim)` resets that, or set `normal` to up for ground rays). `fan(origin, dir,
 * count, length, spread, grow, width)`: `dir` is the centre ray, `spread` the half angle (>= PI = a full circle),
 * `grow` 0..1 scales the length so the rays can shoot out. `fade(k)` sets the opacity (0..1 of the base 0.34).
 * Add `mesh`.
 */
export class SunRays {
  readonly mesh: THREE.InstancedMesh;
  readonly normal = new THREE.Vector3(0, 0, 1);
  private mat: THREE.MeshBasicMaterial;
  private m = new THREE.Matrix4();
  private q = new THREE.Quaternion();
  private d = new THREE.Vector3();
  private sc = new THREE.Vector3();
  private _fade = 1;

  constructor(readonly max = 12, readonly baseOpacity = 0.34, color: number = DAWN.hot) {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute([0, -0.5, 0, 0, 0.5, 0, 1, 0, 0], 3));
    geo.setIndex([0, 1, 2]);
    this.mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: baseOpacity, depthWrite: false, side: THREE.DoubleSide });
    this.mesh = new THREE.InstancedMesh(geo, this.mat, max);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 3;
    this.mesh.count = 0;
    this.mesh.visible = false;
  }

  face(aim: number) {
    dawnFacing(aim, this.normal);
  }

  fan(origin: THREE.Vector3, dir: THREE.Vector3, count: number, length: number, spread: number, grow = 1, width = 0.5) {
    const n = Math.min(count, this.max);
    const full = spread >= Math.PI - 1e-3;
    for (let i = 0; i < n; i++) {
      const u = full ? (i / n) * Math.PI * 2 : n > 1 ? (i / (n - 1) * 2 - 1) * spread : 0;
      const ang = u + (((i * 7) % 5) - 2) * 0.03;
      this.d.copy(dir).applyAxisAngle(this.normal, ang);
      dawnOrient(this.normal, this.d, this.q);
      // dawnOrient puts +Y along d; the wedge runs along +X, so turn it a quarter about the normal.
      this.q.multiply(_qr);
      const len = length * (0.62 + 0.38 * (((i * 5) % 4) / 3)) * Math.max(grow, MIN_SCALE);
      const w = width * (0.7 + 0.5 * (((i * 3) % 4) / 3));
      this.m.compose(origin, this.q, this.sc.set(len, w, 1));
      this.mesh.setMatrixAt(i, this.m);
    }
    this.mesh.count = n;
    this.mesh.instanceMatrix.needsUpdate = true;
    this.mesh.visible = n > 0 && this._fade > 0.004;
  }

  fade(k: number) {
    this._fade = k;
    this.mat.opacity = this.baseOpacity * k;
    this.mesh.visible = this.mesh.count > 0 && k > 0.004;
  }

  reset() {
    this.mesh.count = 0;
    this.mesh.visible = false;
    this._fade = 1;
    this.mat.opacity = this.baseOpacity;
  }
}

// ---------------------------------------------------------------------------------------------------------------
// Sigil
// ---------------------------------------------------------------------------------------------------------------

function drawSigil(): HTMLCanvasElement {
  const S = 512, c = S / 2;
  const cv = document.createElement('canvas');
  cv.width = cv.height = S;
  const g = cv.getContext('2d')!;
  const css = DAWN_CSS;
  g.translate(c, c);
  // Dark amber underlay so the gold reads on the dark floor.
  g.fillStyle = 'rgba(58,36,8,0.55)';
  g.beginPath(); g.arc(0, 0, 252, 0, Math.PI * 2); g.fill();
  const ring = (r: number, w: number, col: string) => {
    g.strokeStyle = col; g.lineWidth = w; g.beginPath(); g.arc(0, 0, r, 0, Math.PI * 2); g.stroke();
  };
  // Outer ring: dark rim, gold band, thin core line.
  ring(244, 18, css.dark);
  ring(240, 11, css.body);
  ring(240, 3, css.core);
  // Ivory band with ticks.
  ring(200, 16, css.foil);
  ring(210, 3, css.dark);
  ring(190, 3, css.dark);
  for (let i = 0; i < 36; i++) {
    g.save(); g.rotate((i / 36) * Math.PI * 2);
    g.fillStyle = i % 3 === 0 ? css.hot : css.body;
    g.fillRect(-4, -228, 8, i % 3 === 0 ? 22 : 12);
    g.restore();
  }
  // Sun wheel: long and short rays, gold with a dark outline.
  for (let i = 0; i < 16; i++) {
    const long = i % 2 === 0;
    g.save(); g.rotate((i / 16) * Math.PI * 2);
    g.beginPath();
    g.moveTo(-(long ? 22 : 15), -92);
    g.lineTo(0, -(long ? 184 : 150));
    g.lineTo(long ? 22 : 15, -92);
    g.closePath();
    g.fillStyle = long ? css.body : css.hot;
    g.fill();
    g.lineWidth = 4; g.strokeStyle = css.dark; g.stroke();
    g.restore();
  }
  // Inner rings and the sun disc.
  ring(92, 14, css.dark);
  ring(92, 8, css.body);
  g.fillStyle = css.foil;
  g.beginPath(); g.arc(0, 0, 54, 0, Math.PI * 2); g.fill();
  g.lineWidth = 5; g.strokeStyle = css.dark; g.stroke();
  g.fillStyle = css.hot;
  g.beginPath(); g.arc(0, 0, 26, 0, Math.PI * 2); g.fill();
  ring(26, 3, css.body);
  return cv;
}

let sigilTex: THREE.CanvasTexture | null = null;

/**
 * A flat gold ground circle with a sun-wheel pattern (dark amber underlay, ivory band, sixteen rays). `set(center,
 * radius)` places it, `reveal` (0..1) draws it on clockwise, `opacity` fades it, `hide` (0..1 of the radius) cuts a
 * hole in the middle so the busy centre can sit under a big object. Add `mesh`.
 */
export class Sigil {
  readonly mesh: THREE.Mesh;
  /** Height above the floor. */
  y = 0.05;
  private mat: THREE.ShaderMaterial;
  private _reveal = 0;
  private _opacity = 1;

  constructor() {
    if (!sigilTex) {
      sigilTex = new THREE.CanvasTexture(drawSigil());
      sigilTex.colorSpace = THREE.SRGBColorSpace;
      sigilTex.anisotropy = 4;
    }
    this.mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, side: THREE.DoubleSide,
      polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
      uniforms: { uMap: { value: sigilTex }, uReveal: { value: 0 }, uOpacity: { value: 1 }, uHide: { value: 0 } },
      vertexShader: /* glsl */ `
        varying vec2 vUv;
        void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: /* glsl */ `
        uniform sampler2D uMap; uniform float uReveal, uOpacity, uHide;
        varying vec2 vUv;
        void main() {
          vec2 p = vUv * 2.0 - 1.0;
          if (length(p) < uHide) discard;
          float ang = atan(p.x, -p.y) / 6.2831853 + 0.5;
          float rv = uReveal * 1.06;
          float on = 1.0 - smoothstep(rv - 0.05, rv, ang);
          vec4 c = texture2D(uMap, vUv);
          float a = c.a * on * uOpacity;
          if (a < 0.004) discard;
          gl_FragColor = vec4(c.rgb, a);
        }`,
    });
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2).rotateX(-Math.PI / 2), this.mat);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 2;
    this.mesh.visible = false;
  }

  get reveal() { return this._reveal; }
  set reveal(v: number) { this._reveal = v; this.mat.uniforms.uReveal.value = v; this.sync(); }
  get opacity() { return this._opacity; }
  set opacity(v: number) { this._opacity = v; this.mat.uniforms.uOpacity.value = v; this.sync(); }
  get hide() { return this.mat.uniforms.uHide.value as number; }
  set hide(v: number) { this.mat.uniforms.uHide.value = v; }

  private sync() {
    this.mesh.visible = this._reveal > 0.002 && this._opacity > 0.004;
  }

  set(center: THREE.Vector3, radius: number) {
    this.mesh.position.set(center.x, this.y, center.z);
    this.mesh.scale.setScalar(Math.max(radius, MIN_SCALE));
  }

  reset() {
    this._reveal = 0;
    this._opacity = 1;
    this.mat.uniforms.uReveal.value = 0;
    this.mat.uniforms.uOpacity.value = 1;
    this.mat.uniforms.uHide.value = 0;
    this.mesh.visible = false;
  }
}
