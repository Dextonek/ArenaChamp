import * as THREE from 'three';

/**
 * The shadow kit (pipeline/designs/kit-shadow.md): flat cut-paper shadows. Matte-black shapes (blades, hands, a
 * crescent, a hooded figure) with a thin hard violet edge line, lying on the floor or standing upright as cut-outs
 * that move in stepped jumps. A pale moon-grey foil disc sits under every pool so the black reads on the dark floor.
 * Everything is pooled, takes world-space positions and has a `reset()`. All materials are normal-blended, never
 * additive; the edge line sits below the bloom threshold.
 */

/** Palette. Numbers for `THREE.Color`, `SHADOW_CSS` for APIs that want a string. */
export const SHADOW = {
  core: 0xf4e8ff,
  hot: 0xc88cff,
  body: 0x6a2ec0,
  accent: 0x5affd2,
  dark: 0x050308,
  foil: 0xcfcad8,
} as const;

export const SHADOW_CSS = {
  core: '#f4e8ff',
  hot: '#c88cff',
  body: '#6a2ec0',
  accent: '#5affd2',
  dark: '#050308',
  foil: '#cfcad8',
} as const;

const MIN_SCALE = 1e-4;
const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const easeOut = (x: number) => 1 - Math.pow(1 - clamp01(x), 3);
const easeOutBack = (x: number) => {
  const k = clamp01(x) - 1;
  return 1 + 2.2 * k * k * k + 1.2 * k * k;
};

const UP = new THREE.Vector3(0, 1, 0);

/** Unit normal of an upright cut-out that faces the gameplay camera (behind the caster, looking along `aim`). */
export function facing(aim: number, out = new THREE.Vector3()) {
  return out.set(-Math.sin(aim), 0, -Math.cos(aim));
}

/** Unit direction from the caster along `aim` (horizontal). */
export function forward(aim: number, out = new THREE.Vector3()) {
  return out.set(Math.sin(aim), 0, Math.cos(aim));
}

const _x = new THREE.Vector3();
const _y = new THREE.Vector3();
const _z = new THREE.Vector3();
const _m = new THREE.Matrix4();
const _qr = new THREE.Quaternion();
const _zAxis = new THREE.Vector3(0, 0, 1);
const Z = _zAxis;

/** Orientation whose local +Z is `normal`; local +Y is up for upright shapes and away from `hint` for flat ones. */
function basisQuat(normal: THREE.Vector3, hint: THREE.Vector3, out: THREE.Quaternion) {
  _z.copy(normal).normalize();
  const ref = Math.abs(_z.y) > 0.999 ? hint : UP;
  _x.crossVectors(ref, _z);
  if (_x.lengthSq() < 1e-8) _x.set(1, 0, 0);
  _x.normalize();
  _y.crossVectors(_z, _x);
  _m.makeBasis(_x, _y, _z);
  return out.setFromRotationMatrix(_m);
}

// ---------------------------------------------------------------------------------------------------------------
// Outlines (unit space, y up). Each is a closed polygon.
// ---------------------------------------------------------------------------------------------------------------

type Pt = [number, number];
export type CutKind = 'blade' | 'hand' | 'crescent' | 'figure' | 'disc';

/** A curved dagger blade along +x (base at x = -0.5, tip at +0.5), about 0.2 wide at the base. */
function bladePts(): Pt[] {
  const n = 14, top: Pt[] = [], bot: Pt[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const yc = 0.15 * (1 - (2 * t - 1) ** 2) * 0.8 + 0.11 * t ** 3;
    const w = 0.1 * (1 - t ** 1.5) + 0.006;
    top.push([-0.5 + t, yc + w]);
    bot.push([-0.5 + t, yc - w * 0.75]);
  }
  // A short crossguard / pommel stub at the base so it reads as a dagger.
  return [[-0.58, 0.1], [-0.52, 0.16], ...top, ...bot.reverse(), [-0.52, -0.1], [-0.58, -0.04]];
}

/** A broad hand pointing up: wrist at the origin, palm about 0.56 wide, four spread fingers and a thumb, tips curled. */
function handPts(): Pt[] {
  const pts: Pt[] = [[-0.15, 0], [-0.28, 0.14]];
  // [base x, base y, lean angle (0 = up, + = toward +x), length, half width, tip curl]
  const fingers: [number, number, number, number, number, number][] = [
    [-0.3, 0.2, -1.0, 0.36, 0.075, 0.6], [-0.2, 0.42, -0.42, 0.56, 0.07, 0.7], [-0.07, 0.44, -0.1, 0.66, 0.07, 0.6],
    [0.07, 0.44, 0.14, 0.62, 0.07, 0.55], [0.2, 0.42, 0.42, 0.5, 0.065, 0.5],
  ];
  for (const [bx, by, a, len, hw, curl] of fingers) {
    const dx = Math.sin(a), dy = Math.cos(a), nx = Math.cos(a), ny = -Math.sin(a);
    const mx = bx + dx * len * 0.6, my = by + dy * len * 0.6;
    const ta = a + curl, tx = mx + Math.sin(ta) * len * 0.42, ty = my + Math.cos(ta) * len * 0.42;
    pts.push([bx - nx * hw, by - ny * hw], [mx - nx * hw * 0.85, my - ny * hw * 0.85], [tx, ty], [mx + nx * hw * 0.85, my + ny * hw * 0.85], [bx + nx * hw, by + ny * hw]);
  }
  pts.push([0.28, 0.14], [0.15, 0]);
  return pts;
}

/** A thin crescent with its tips on x = 0 at y = +-1 and the bulge toward -x. */
function crescentPts(ho: number, hi: number): Pt[] {
  const arcPts = (h: number, n: number): Pt[] => {
    const R = (1 + h * h) / (2 * h), cx = R - h, th = Math.asin(1 / R), out: Pt[] = [];
    for (let i = 0; i <= n; i++) {
      const p = -th + (2 * th * i) / n;
      out.push([cx - R * Math.cos(p), R * Math.sin(p)]);
    }
    return out;
  };
  return [...arcPts(ho, 28), ...arcPts(hi, 28).reverse()];
}

/** A hooded, cloaked figure, feet at y = 0, hood tip at y ~ 1.05. */
function figurePts(): Pt[] {
  const right: Pt[] = [
    [0.1, 0.99], [0.15, 0.91], [0.16, 0.83], [0.12, 0.76], [0.2, 0.72], [0.29, 0.62], [0.31, 0.46], [0.27, 0.3],
    [0.34, 0.15], [0.28, 0.09], [0.25, 0], [0.15, 0.07], [0.07, 0],
  ];
  const left: Pt[] = right.slice().reverse().map(([x, y], i) => [-x * (1 + 0.04 * (i % 3)), y + (i === 4 ? 0.03 : 0)] as Pt);
  return [[0.01, 1.06], ...right, ...left];
}

function discPts(n = 40): Pt[] {
  const out: Pt[] = [];
  for (let i = 0; i < n; i++) out.push([Math.cos((i / n) * Math.PI * 2), Math.sin((i / n) * Math.PI * 2)]);
  return out;
}

function outline(kind: CutKind): Pt[] {
  switch (kind) {
    case 'blade': return bladePts();
    case 'hand': return handPts();
    case 'crescent': return crescentPts(0.55, 0.17);
    case 'figure': return figurePts();
    default: return discPts();
  }
}

function fillGeometry(pts: Pt[]): THREE.BufferGeometry {
  return new THREE.ShapeGeometry(new THREE.Shape(pts.map(([x, y]) => new THREE.Vector2(x, y))));
}

/** A strip along the outline (both sides), pushed out in the vertex shader by `uHalf` so its width stays constant. */
function edgeGeometry(src: Pt[]): THREE.BufferGeometry {
  const pts: Pt[] = [];
  for (const p of src) {
    const q = pts[pts.length - 1];
    if (!q || Math.hypot(p[0] - q[0], p[1] - q[1]) > 1e-4) pts.push(p);
  }
  if (pts.length > 1 && Math.hypot(pts[0][0] - pts[pts.length - 1][0], pts[0][1] - pts[pts.length - 1][1]) < 1e-4) pts.pop();
  const n = pts.length, pos: number[] = [], aN: number[] = [], side: number[] = [], idx: number[] = [];
  for (let i = 0; i < n; i++) {
    const p = pts[i], a = pts[(i - 1 + n) % n], b = pts[(i + 1) % n];
    let e0x = p[0] - a[0], e0y = p[1] - a[1];
    let l = Math.hypot(e0x, e0y) || 1;
    e0x /= l; e0y /= l;
    let e1x = b[0] - p[0], e1y = b[1] - p[1];
    l = Math.hypot(e1x, e1y) || 1;
    e1x /= l; e1y /= l;
    const n0x = -e0y, n0y = e0x, n1x = -e1y, n1y = e1x;
    let mx = n0x + n1x, my = n0y + n1y;
    const ml = Math.hypot(mx, my);
    if (ml < 1e-4) { mx = n0x; my = n0y; } else { mx /= ml; my /= ml; }
    const k = 1 / Math.max(mx * n0x + my * n0y, 0.42);
    for (const s of [-1, 1]) {
      pos.push(p[0], p[1], 0);
      aN.push(mx * k, my * k);
      side.push(s);
    }
    const j = (i + 1) % n;
    idx.push(2 * i, 2 * i + 1, 2 * j, 2 * i + 1, 2 * j + 1, 2 * j);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('aN', new THREE.Float32BufferAttribute(aN, 2));
  g.setAttribute('aSide', new THREE.Float32BufferAttribute(side, 1));
  g.setIndex(idx);
  return g;
}

const geoCache = new Map<CutKind, { fill: THREE.BufferGeometry; edge: THREE.BufferGeometry }>();
function geometryFor(kind: CutKind) {
  let g = geoCache.get(kind);
  if (!g) {
    const pts = outline(kind);
    g = { fill: fillGeometry(pts), edge: edgeGeometry(pts) };
    geoCache.set(kind, g);
  }
  return g;
}

// ---------------------------------------------------------------------------------------------------------------
// CutShape
// ---------------------------------------------------------------------------------------------------------------

export interface CutShapeOptions {
  kind: CutKind;
  /** Fill colour (default the shadow black). */
  fill?: THREE.ColorRepresentation;
  /** Edge colour (default the hot violet). */
  edgeColor?: THREE.ColorRepresentation;
  /** Edge width in world units, constant at any size. Default 0.13. */
  edgeWidth?: number;
  /** Draw order of the fill; the edge is one above. Default 4. */
  renderOrder?: number;
}

/**
 * A flat cut-out: matte fill with a thin hard edge line, from a drawn outline (`blade`, `hand`, `crescent`, `figure`,
 * `disc`). `place(pos, normal, size, rotation, hint)` puts it: `size` is its unit length in world units, `normal` the
 * way the face points (up = lying on the floor, `facing(aim)` = standing up toward the camera), `rotation` rolls it
 * about the normal. `opacity` fades the whole thing, `edge` (0..1) the edge line alone. Add `mesh`.
 */
export class CutShape {
  readonly mesh = new THREE.Group();
  private fillMat: THREE.MeshBasicMaterial;
  private edgeMat: THREE.ShaderMaterial;
  private _opacity = 0;
  private _edge = 1;
  private size = 1;
  private edgeWidth: number;
  private q = new THREE.Quaternion();
  private hintDefault = new THREE.Vector3(0, 0, -1);

  constructor(opts: CutShapeOptions) {
    const geo = geometryFor(opts.kind);
    const ro = opts.renderOrder ?? 4;
    this.edgeWidth = opts.edgeWidth ?? 0.13;
    this.fillMat = new THREE.MeshBasicMaterial({
      color: opts.fill ?? SHADOW.dark, transparent: true, depthWrite: false, side: THREE.DoubleSide,
      polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
    });
    this.edgeMat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, side: THREE.DoubleSide,
      polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3,
      uniforms: {
        uColor: { value: new THREE.Color(opts.edgeColor ?? SHADOW.hot) }, uHalf: { value: 0.05 }, uOpacity: { value: 1 },
      },
      vertexShader: /* glsl */ `
        attribute vec2 aN; attribute float aSide; uniform float uHalf;
        void main() {
          vec2 p = position.xy + aN * aSide * uHalf;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 0.0, 1.0);
        }`,
      fragmentShader: /* glsl */ `
        uniform vec3 uColor; uniform float uOpacity;
        void main() { if (uOpacity < 0.004) discard; gl_FragColor = vec4(uColor, uOpacity); }`,
    });
    const fill = new THREE.Mesh(geo.fill, this.fillMat);
    const edge = new THREE.Mesh(geo.edge, this.edgeMat);
    fill.renderOrder = ro;
    edge.renderOrder = ro + 1;
    fill.frustumCulled = edge.frustumCulled = false;
    this.mesh.add(fill, edge);
    this.mesh.visible = false;
  }

  get opacity() { return this._opacity; }
  set opacity(v: number) {
    this._opacity = v;
    this.fillMat.opacity = v;
    this.edgeMat.uniforms.uOpacity.value = v * this._edge;
    this.mesh.visible = v > 0.004;
  }

  get edge() { return this._edge; }
  set edge(v: number) {
    this._edge = v;
    this.edgeMat.uniforms.uOpacity.value = this._opacity * v;
  }

  place(pos: THREE.Vector3, normal: THREE.Vector3, size: number, rotation = 0, hint?: THREE.Vector3) {
    basisQuat(normal, hint ?? this.hintDefault, this.q);
    if (rotation !== 0) this.q.multiply(_qr.setFromAxisAngle(_zAxis, rotation));
    this.mesh.position.copy(pos);
    this.mesh.quaternion.copy(this.q);
    this.size = Math.max(size, MIN_SCALE);
    this.mesh.scale.setScalar(this.size);
    this.edgeMat.uniforms.uHalf.value = this.edgeWidth / 2 / this.size;
  }

  reset() {
    this.opacity = 0;
    this.edge = 1;
  }
}

// ---------------------------------------------------------------------------------------------------------------
// ShadowPool
// ---------------------------------------------------------------------------------------------------------------

/**
 * A black ground pool with a hard violet rim and a ragged edge that jumps in steps, over a pale moon-grey foil disc
 * (the foil shows as a ring around the pool). `spread(center, radius, s)` grows it (s 0..1, eased); `shrink(seconds)`
 * pulls it back to nothing (needs `update(dt)`). `foil` fades the foil disc. Add `mesh`.
 */
export class ShadowPool {
  readonly mesh: THREE.Mesh;
  /** Height above the floor. */
  y = 0.05;
  private mat: THREE.ShaderMaterial;
  private center = new THREE.Vector3();
  private radius = 1;
  private s = 0;
  private shrinkDur = 0;
  private shrinkAge = 0;
  private time = 0;
  private _foil = 0.7;
  private _opacity = 1;

  constructor() {
    this.mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, side: THREE.DoubleSide,
      polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
      uniforms: {
        uDark: { value: new THREE.Color(SHADOW.dark) }, uHot: { value: new THREE.Color(SHADOW.hot) },
        uFoilCol: { value: new THREE.Color(SHADOW.foil) }, uFoil: { value: 0.7 }, uOpacity: { value: 1 }, uStep: { value: 0 },
      },
      vertexShader: /* glsl */ `
        varying vec2 vP;
        void main() { vP = position.xz; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: /* glsl */ `
        uniform vec3 uDark, uHot, uFoilCol; uniform float uFoil, uOpacity, uStep;
        varying vec2 vP;
        void main() {
          float r = length(vP);
          float a = atan(vP.y, vP.x);
          float w = 1.0 + 0.05 * sin(a * 5.0 + uStep * 1.7) + 0.035 * sin(a * 9.0 - uStep * 2.3) + 0.02 * sin(a * 17.0 + uStep * 3.1);
          float pr = 0.8333 * w;
          float fr = 0.995 - 0.02 * sin(a * 7.0 + 1.3 + uStep);
          float aa = 0.012;
          float inPool = 1.0 - smoothstep(pr - aa, pr, r);
          float rim = smoothstep(pr - 0.052, pr - 0.052 + aa, r);
          float inFoil = 1.0 - smoothstep(fr - aa, fr, r);
          vec3 pool = mix(uDark, uHot, rim);
          float aPool = inPool * 0.97;
          float aFoil = inFoil * uFoil * 0.58;
          float a0 = max(aPool, aFoil) * uOpacity;
          if (a0 < 0.004) discard;
          vec3 col = mix(uFoilCol, pool, inPool);
          gl_FragColor = vec4(col, a0);
        }`,
    });
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2).rotateX(-Math.PI / 2), this.mat);
    this.mesh.frustumCulled = false;
    this.mesh.visible = false;
    this.mesh.renderOrder = 1;
  }

  get foil() { return this._foil; }
  set foil(v: number) { this._foil = v; this.mat.uniforms.uFoil.value = v; }
  get opacity() { return this._opacity; }
  set opacity(v: number) { this._opacity = v; this.mat.uniforms.uOpacity.value = v; this.sync(); }

  spread(center: THREE.Vector3, radius: number, s: number) {
    this.center.copy(center);
    this.radius = radius;
    this.s = clamp01(s);
    this.sync();
  }

  shrink(seconds: number) {
    this.shrinkDur = Math.max(seconds, 0.02);
    this.shrinkAge = 1e-5;
  }

  private sync() {
    const k = this.shrinkDur > 0 ? clamp01(this.shrinkAge / this.shrinkDur) : 0;
    const g = easeOut(this.s) * (1 - k * k);
    this.mesh.position.set(this.center.x, this.y, this.center.z);
    this.mesh.scale.setScalar(Math.max(this.radius * 1.2 * g, MIN_SCALE));
    this.mesh.visible = g > 0.01 && this._opacity > 0.004;
  }

  update(dt: number) {
    this.time += dt;
    this.mat.uniforms.uStep.value = Math.floor(this.time / 0.11) * 0.11;
    if (this.shrinkDur > 0) {
      this.shrinkAge += dt;
      this.sync();
    }
  }

  reset() {
    this.s = 0;
    this.shrinkDur = 0;
    this.shrinkAge = 0;
    this.time = 0;
    this.foil = 0.7;
    this.opacity = 1;
    this.mesh.visible = false;
  }
}

// ---------------------------------------------------------------------------------------------------------------
// ShadowHands
// ---------------------------------------------------------------------------------------------------------------

/**
 * Instanced flat black hands (violet edge) that rise out of the floor, grab and sink. `grab(at, count, height, s,
 * close)` lays `count` hands around the anchor point(s) `at` (the first anchors get a hand right under them, the rest
 * stand in a ring around), `s` 0..1 is how far they have risen (they are staggered; s back to 0 sinks them) and
 * `close` 0..1 curls them shut. `face(aim)` turns them toward the camera. Add `mesh`.
 */
export class ShadowHands {
  readonly mesh = new THREE.Group();
  private back: THREE.InstancedMesh;
  private front: THREE.InstancedMesh;
  private yaw = 0;
  private m = new THREE.Matrix4();
  private p = new THREE.Vector3();
  private sc = new THREE.Vector3();
  private qy = new THREE.Quaternion();
  private qz = new THREE.Quaternion();
  private anchor = new THREE.Vector3();

  constructor(readonly max = 14) {
    const geo = fillGeometry(handPts());
    const mk = (color: number, ro: number, off: number) => {
      const im = new THREE.InstancedMesh(geo, new THREE.MeshBasicMaterial({
        color, transparent: true, depthWrite: false, side: THREE.DoubleSide,
        polygonOffset: true, polygonOffsetFactor: off, polygonOffsetUnits: off,
      }), max);
      im.frustumCulled = false;
      im.renderOrder = ro;
      im.count = 0;
      return im;
    };
    this.back = mk(SHADOW.hot, 5, -2);
    this.front = mk(SHADOW.dark, 6, -3);
    this.mesh.add(this.back, this.front);
  }

  face(aim: number) {
    this.yaw = aim + Math.PI;
  }

  grab(at: THREE.Vector3 | readonly THREE.Vector3[], count: number, height: number, s: number, close = 0) {
    const anchors = Array.isArray(at) ? (at as readonly THREE.Vector3[]) : [at as THREE.Vector3];
    const n = Math.min(count, this.max);
    const na = Math.max(1, anchors.length);
    let used = 0;
    for (let i = 0; i < n; i++) {
      const a = anchors[i % na];
      const ang = i * 2.39996 + 0.5;
      const rad = i < na ? 0.35 : 1.15 + 0.45 * (i % 3);
      const si = clamp01(s * 1.5 - 0.5 * (i / Math.max(n, 1)));
      if (si <= 0.001) continue;
      const e = easeOut(si);
      const h = height * (0.85 + 0.3 * ((i * 7) % 5) / 4);
      const k = close;
      this.anchor.set(a.x + Math.cos(ang) * rad, 0, a.z + Math.sin(ang) * rad);
      this.qy.setFromAxisAngle(UP, this.yaw + ((i * 5) % 7 - 3) * 0.06);
      this.qy.multiply(this.qz.setFromAxisAngle(Z, Math.sin(i * 2.1 + 0.5) * 0.28 * (1 - 0.6 * close)));
      this.p.set(this.anchor.x, this.anchor.y - h * (1 - e) * 0.95, this.anchor.z);
      const sx = h * 0.92 * (1 - 0.3 * k), sy = h * (1 - 0.22 * k);
      this.sc.set(sx * 1.16, sy * 1.07, 1);
      this.m.compose(this.p, this.qy, this.sc);
      this.back.setMatrixAt(used, this.m);
      this.sc.set(sx, sy, 1);
      this.m.compose(this.p, this.qy, this.sc);
      this.front.setMatrixAt(used, this.m);
      used++;
    }
    this.back.count = this.front.count = used;
    this.back.instanceMatrix.needsUpdate = true;
    this.front.instanceMatrix.needsUpdate = true;
    this.mesh.visible = used > 0;
  }

  reset() {
    this.back.count = this.front.count = 0;
    this.mesh.visible = false;
  }
}

// ---------------------------------------------------------------------------------------------------------------
// Afterimage
// ---------------------------------------------------------------------------------------------------------------

/**
 * A stepped trail of black figure cut-outs between two points. `trail(from, to, steps, s)`: figure k appears at once
 * when `s` passes (k + 1) / steps and then fades over `fadeLen` (0.45) of s (so run `s` past 1 to let the last ones fade).
 * `face(aim)` turns them toward the camera. Add `mesh`.
 */
export class Afterimage {
  readonly mesh = new THREE.Group();
  /** Figure height in world units. */
  size = 2.2;
  /** How much of `s` a figure takes to fade out. */
  fadeLen = 0.45;
  private figs: CutShape[] = [];
  private normal = new THREE.Vector3(0, 0, 1);
  private pos = new THREE.Vector3();

  constructor(readonly max = 5) {
    for (let i = 0; i < max; i++) {
      const f = new CutShape({ kind: 'figure', edgeWidth: 0.1, renderOrder: 3 });
      this.figs.push(f);
      this.mesh.add(f.mesh);
    }
  }

  face(aim: number) {
    facing(aim, this.normal);
  }

  trail(from: THREE.Vector3, to: THREE.Vector3, steps: number, s: number) {
    const n = Math.min(steps, this.max);
    for (let k = 0; k < this.max; k++) {
      const f = this.figs[k];
      if (k >= n) { f.opacity = 0; continue; }
      const born = (k + 1) / n;
      if (s < born - 1e-6) { f.opacity = 0; continue; }
      const fade = clamp01((s - born) / this.fadeLen);
      this.pos.lerpVectors(from, to, born);
      f.place(this.pos, this.normal, this.size * (1 - 0.14 * fade), 0);
      f.opacity = 1 - fade;
    }
  }

  reset() {
    for (const f of this.figs) f.reset();
  }
}

// ---------------------------------------------------------------------------------------------------------------
// CutFlash
// ---------------------------------------------------------------------------------------------------------------

function crescentFill(ho: number, hi: number) {
  return fillGeometry(crescentPts(ho, hi));
}

let flashGeos: { hot: THREE.BufferGeometry; core: THREE.BufferGeometry } | null = null;

/**
 * The hit cut: a thin hot violet crescent with a mint core, up for ~2 frames then shrinking away. `cut(pos, dir,
 * size)` fires one (`dir` is the stroke direction, `size` its half length); `update(dt)` each frame. It stands upright
 * toward the camera (`face(aim)`) and draws over everything. Add `mesh`.
 */
export class CutFlash {
  readonly mesh = new THREE.Group();
  private hot: THREE.Mesh;
  private core: THREE.Mesh;
  private normal = new THREE.Vector3(0, 0, 1);
  private xAxis = new THREE.Vector3(1, 0, 0);
  private pos = new THREE.Vector3();
  private size = 1;
  private roll = 0;
  private age = -1;
  private q = new THREE.Quaternion();
  private hint = new THREE.Vector3(0, 0, -1);

  constructor() {
    if (!flashGeos) flashGeos = { hot: crescentFill(0.5, 0.4), core: crescentFill(0.46, 0.43) };
    const mat = (c: number) => new THREE.MeshBasicMaterial({ color: c, transparent: true, depthTest: false, depthWrite: false, side: THREE.DoubleSide });
    this.hot = new THREE.Mesh(flashGeos.hot, mat(SHADOW.hot));
    this.core = new THREE.Mesh(flashGeos.core, mat(SHADOW.accent));
    this.hot.renderOrder = 20;
    this.core.renderOrder = 21;
    this.hot.frustumCulled = this.core.frustumCulled = false;
    this.mesh.add(this.hot, this.core);
    this.mesh.visible = false;
  }

  face(aim: number) {
    facing(aim, this.normal);
    this.xAxis.crossVectors(UP, this.normal).normalize();
  }

  cut(pos: THREE.Vector3, dir: THREE.Vector3, size: number) {
    this.pos.copy(pos);
    this.size = size;
    const dx = dir.dot(this.xAxis), dy = dir.y;
    this.roll = Math.atan2(-dx, dy);
    this.age = 0;
    this.apply();
  }

  private apply() {
    const hold = 0.04, out = 0.07;
    const grow = clamp01(this.age / 0.012);
    const k = this.age <= hold ? 1 : Math.max(0, 1 - (this.age - hold) / out);
    const sz = this.size * (0.35 + 0.65 * grow) * (0.3 + 0.7 * k);
    this.mesh.visible = this.age >= 0 && k > 0.01;
    basisQuat(this.normal, this.hint, this.q);
    this.q.multiply(_qr.setFromAxisAngle(_zAxis, this.roll));
    this.mesh.position.copy(this.pos);
    this.mesh.quaternion.copy(this.q);
    this.mesh.scale.set(Math.max(sz * (0.35 + 0.65 * k), MIN_SCALE), Math.max(sz, MIN_SCALE), 1);
  }

  update(dt: number) {
    if (this.age < 0) return;
    this.age += dt;
    if (this.age > 0.2) { this.reset(); return; }
    this.apply();
  }

  reset() {
    this.age = -1;
    this.mesh.visible = false;
  }
}

// ---------------------------------------------------------------------------------------------------------------
// CutShards
// ---------------------------------------------------------------------------------------------------------------

interface Shard {
  live: boolean;
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  q: THREE.Quaternion;
  axis: THREE.Vector3;
  spin: number;
  size: number;
  age: number;
  life: number;
  landed: boolean;
}

/**
 * Flat black shards with a violet edge. `burst(center, radius, count, speed, lift, life)` throws pieces out of a
 * point; they tumble, fall, snap flat on the floor and shrink away within `life` seconds. `update(dt)` each frame.
 * Add `mesh`.
 */
export class CutShards {
  readonly mesh = new THREE.Group();
  gravity = -15;
  private shards: Shard[] = [];
  private back: THREE.InstancedMesh;
  private front: THREE.InstancedMesh;
  private cursor = 0;
  private m = new THREE.Matrix4();
  private sc = new THREE.Vector3();
  private eu = new THREE.Euler();

  constructor(readonly max = 40) {
    const geo = fillGeometry([[0, 0.55], [-0.42, -0.3], [0.5, -0.36]]);
    const mk = (color: number, ro: number, off: number) => {
      const im = new THREE.InstancedMesh(geo, new THREE.MeshBasicMaterial({
        color, transparent: true, depthWrite: false, side: THREE.DoubleSide,
        polygonOffset: true, polygonOffsetFactor: off, polygonOffsetUnits: off,
      }), max);
      im.frustumCulled = false;
      im.renderOrder = ro;
      im.count = 0;
      return im;
    };
    this.back = mk(SHADOW.hot, 7, -4);
    this.front = mk(SHADOW.dark, 8, -5);
    this.mesh.add(this.back, this.front);
    for (let i = 0; i < max; i++) {
      this.shards.push({
        live: false, pos: new THREE.Vector3(), vel: new THREE.Vector3(), q: new THREE.Quaternion(), axis: new THREE.Vector3(1, 0, 0),
        spin: 0, size: 0.5, age: 0, life: 1, landed: false,
      });
    }
  }

  burst(center: THREE.Vector3, radius: number, count: number, speed: number, lift = 3, life = 1.0) {
    for (let k = 0; k < count; k++) {
      const s = this.shards[this.cursor];
      this.cursor = (this.cursor + 1) % this.shards.length;
      const a = Math.random() * Math.PI * 2, r = radius * Math.sqrt(Math.random());
      s.live = true;
      s.landed = false;
      s.age = 0;
      s.life = life * (0.8 + Math.random() * 0.35);
      s.size = 0.34 + Math.random() * 0.5;
      s.pos.set(center.x + Math.cos(a) * r, Math.max(center.y + (Math.random() - 0.3) * 0.8, 0.1), center.z + Math.sin(a) * r);
      const out = speed * (0.3 + Math.random() * 0.7);
      s.vel.set(Math.cos(a) * out, lift * (0.4 + Math.random() * 0.8), Math.sin(a) * out);
      s.q.setFromEuler(this.eu.set(Math.random() * 6, Math.random() * 6, Math.random() * 6));
      s.axis.set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize();
      s.spin = (Math.random() - 0.5) * 12;
    }
  }

  update(dt: number) {
    let n = 0;
    for (const s of this.shards) {
      if (!s.live) continue;
      s.age += dt;
      if (s.age >= s.life) { s.live = false; continue; }
      if (!s.landed) {
        s.vel.y += this.gravity * dt;
        s.pos.addScaledVector(s.vel, dt);
        s.q.premultiply(_qr.setFromAxisAngle(s.axis, s.spin * dt));
        if (s.pos.y <= 0.09 && s.vel.y < 0) {
          s.pos.y = 0.09;
          s.landed = true;
          s.q.setFromEuler(this.eu.set(-Math.PI / 2, 0, Math.random() * 6.28));
        }
      }
      const k = s.age / s.life;
      const fade = 1 - clamp01((k - 0.55) / 0.45);
      const sz = Math.max(s.size * (0.4 + 0.6 * fade * fade), MIN_SCALE);
      this.sc.setScalar(sz * 1.4);
      this.m.compose(s.pos, s.q, this.sc);
      this.back.setMatrixAt(n, this.m);
      this.sc.setScalar(sz);
      this.m.compose(s.pos, s.q, this.sc);
      this.front.setMatrixAt(n, this.m);
      n++;
    }
    this.back.count = this.front.count = n;
    this.back.instanceMatrix.needsUpdate = true;
    this.front.instanceMatrix.needsUpdate = true;
    this.mesh.visible = n > 0;
  }

  reset() {
    for (const s of this.shards) s.live = false;
    this.back.count = this.front.count = 0;
    this.mesh.visible = false;
  }
}

export { clamp01 as shadowClamp01, easeOut as shadowEaseOut, easeOutBack as shadowEaseOutBack };
