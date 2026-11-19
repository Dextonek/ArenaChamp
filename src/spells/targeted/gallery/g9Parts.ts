import * as THREE from 'three';
import { mergeParts } from '../../../effects/common';

/**
 * Gallery group 9 (pipeline/designs/gallery-20.md): the pieces of the arabesque fan and the crescent return.
 * Nothing here makes a three.js object when the file is loaded: every piece is a class or a function, called by its look's
 * constructor. No dice: `hash` of an index. Every shader ends with the colour-space and tone-mapping includes, so it matches the
 * basic materials.
 */
export { hash, clamp01, easeOut, smooth } from '../../../heroes/sheath/partsBig';
/** Overshoots a little (1.0 at the end): a thing that snaps open and settles. */
export const backOut = (x: number) => { const t = Math.min(1, Math.max(0, x)) - 1; return 1 + t * t * (2.7 * t + 1.7); };

const TAIL = /* glsl */ `#include <tonemapping_fragment>\n#include <colorspace_fragment>`;

// ---------------------------------------------------------------------------------------------------------------
// Girih tile stars: an eight-pointed star of nine tiles (eight dart-shaped kites round one small star), each tile gold-edged,
// with a glazed field and a white glaze dot. The tiles tile exactly, so a star can be taken apart and put back together.
// ---------------------------------------------------------------------------------------------------------------

const TIP = 1, VALLEY = 0.62, INNER = 0.28;
const PI8 = Math.PI / 4;
/** The kite's own centre, along its axis (its geometry is moved so that this point is its origin). */
export const KITE_RC = (TIP + VALLEY * Math.cos(PI8 / 2) * 2 + INNER) / 4;

type V2 = [number, number];

/** A flat extruded polygon (x, z points) standing on `y0`, `depth` thick, every vertex coloured `code` (0 gold, 0.5 field, 1 white glaze). */
function slab(pts: V2[], y0: number, depth: number, code: number): THREE.BufferGeometry {
  const g = new THREE.ExtrudeGeometry(new THREE.Shape(pts.map(([x, z]) => new THREE.Vector2(x, -z))), { depth, bevelEnabled: false });
  g.rotateX(-Math.PI / 2);
  g.translate(0, y0, 0);
  const col = new Float32Array(g.attributes.position.count * 3);
  for (let i = 0; i < col.length; i += 3) col[i] = code;
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return g;
}

const scaled = (pts: V2[], k: number, cx = 0, cz = 0): V2[] => pts.map(([x, z]) => [cx + (x - cx) * k, cz + (z - cz) * k]);

function starPts(rOut: number, rIn: number, tilt: number, n = 8): V2[] {
  const out: V2[] = [];
  for (let i = 0; i < n * 2; i++) {
    const a = tilt + (i * Math.PI) / n, r = i % 2 === 0 ? rOut : rIn;
    out.push([Math.cos(a) * r, Math.sin(a) * r]);
  }
  return out;
}

/** The two tile shapes of a star: a kite pointing along +x (its centre at the origin) and the small central star. */
export function girihGeometry(): { kite: THREE.BufferGeometry; centre: THREE.BufferGeometry } {
  const vx = VALLEY * Math.cos(PI8 / 2), vz = VALLEY * Math.sin(PI8 / 2);
  const kitePts: V2[] = [[TIP - KITE_RC, 0], [vx - KITE_RC, vz], [INNER - KITE_RC, 0], [vx - KITE_RC, -vz]];
  const centrePts = starPts(VALLEY, INNER, PI8 / 2).map(([x, z]): V2 => [x, z]);
  // the star's outer points sit at 22.5 + 45 k degrees and its notches at 45 k: starPts starts on an outer point at `tilt`
  const kite = mergeParts([
    slab(kitePts, 0, 0.16, 0),
    slab(scaled(kitePts, 0.74), 0.16, 0.05, 0.5),
    slab(scaled(kitePts, 0.3, 0.12, 0), 0.21, 0.03, 1),
  ]);
  const octagon = starPts(0.17, 0.17, 0, 4).map(([x, z]): V2 => [x, z]);
  const centre = mergeParts([
    slab(centrePts, 0, 0.16, 0),
    slab(scaled(centrePts, 0.78), 0.16, 0.05, 0.5),
    slab(octagon, 0.21, 0.03, 1),
  ]);
  return { kite, centre };
}

/** The star's tiles: five stars of nine (eight kites and the small star), every tile placed by `put`. */
export class GirihStars {
  readonly kites: THREE.InstancedMesh;
  readonly centres: THREE.InstancedMesh;
  readonly material: THREE.ShaderMaterial;
  private m = new THREE.Matrix4();
  private s = new THREE.Vector3();
  private static ONE = 1e-4;

  constructor(readonly stars: number) {
    const g = girihGeometry();
    this.material = new THREE.ShaderMaterial({
      vertexColors: true,
      side: THREE.DoubleSide,
      uniforms: {
        uTime: { value: 0 },
        uGlow: { value: 0 },
        uLight: { value: new THREE.Vector3(-0.35, 0.8, 0.5).normalize() },
        uGold: { value: new THREE.Color('#d9a441') },
        uCobalt: { value: new THREE.Color('#1c3f8f') },
        uTurq: { value: new THREE.Color('#23b5ad') },
        uWhite: { value: new THREE.Color('#f3eee2') },
        uHot: { value: new THREE.Color('#fff0c4') },
      },
      vertexShader: /* glsl */ `
        attribute float aPal; varying vec3 vView; varying vec3 vCol; varying float vPal; varying vec3 vW;
        void main() {
          vec4 p = instanceMatrix * vec4(position, 1.0);
          vec4 w = modelMatrix * p;
          vec4 mv = viewMatrix * w;
          vView = mv.xyz; vCol = color; vPal = aPal; vW = w.xyz;
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: /* glsl */ `
        varying vec3 vView; varying vec3 vCol; varying float vPal; varying vec3 vW;
        uniform vec3 uLight; uniform vec3 uGold; uniform vec3 uCobalt; uniform vec3 uTurq; uniform vec3 uWhite; uniform vec3 uHot;
        uniform float uTime; uniform float uGlow;
        void main() {
          vec3 n = normalize(cross(dFdx(vView), dFdy(vView)));
          float lit = 0.5 + 0.5 * max(dot(n, uLight), 0.0);
          float rim = pow(1.0 - abs(n.z), 2.0);
          float code = vCol.r;
          vec3 body = mix(uCobalt, uTurq, vPal);
          vec3 inlay = mix(uTurq, uCobalt, vPal);
          vec3 col = body;
          float isGold = 1.0 - smoothstep(0.2, 0.3, code);
          float isWhite = smoothstep(0.75, 0.9, code);
          col = mix(col, uGold, isGold);
          col = mix(col, uWhite, isWhite);
          col = mix(col, inlay, 0.0);
          col *= lit;
          // a glaze catches the light in a band that sweeps over the tiles
          float band = pow(max(0.0, sin(dot(vW.xz, vec2(1.3, 0.8)) * 2.6 - uTime * 6.0)), 18.0);
          col += uWhite * band * (0.25 + 0.5 * isGold);
          col += uGold * rim * 0.25;
          col = mix(col, uHot, clamp(uGlow * (0.25 + 0.5 * isGold + 0.4 * isWhite), 0.0, 0.9));
          gl_FragColor = vec4(col, 1.0);
          ${TAIL}
        }`,
    });
    const pal = (n: number, per: number) => {
      const a = new Float32Array(n);
      for (let i = 0; i < n; i++) a[i] = Math.floor(i / per) % 2;
      return new THREE.InstancedBufferAttribute(a, 1);
    };
    g.kite.setAttribute('aPal', pal(stars * 8, 8));
    g.centre.setAttribute('aPal', pal(stars, 1));
    this.kites = new THREE.InstancedMesh(g.kite, this.material, stars * 8);
    this.centres = new THREE.InstancedMesh(g.centre, this.material, stars);
    for (const mesh of [this.kites, this.centres]) {
      mesh.frustumCulled = false;
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    }
    for (let s = 0; s < stars; s++) this.hideStar(s);
    this.flush();
  }

  get meshes(): THREE.InstancedMesh[] {
    return [this.kites, this.centres];
  }

  /** Tile `piece` (0-7 the kites, 8 the small star) of star `star`, composed from a position, a rotation and a scale. */
  put(star: number, piece: number, p: THREE.Vector3, q: THREE.Quaternion, scale: number) {
    this.m.compose(p, q, this.s.setScalar(scale));
    (piece < 8 ? this.kites : this.centres).setMatrixAt(piece < 8 ? star * 8 + piece : star, this.m);
  }

  hideStar(star: number) {
    this.m.makeScale(GirihStars.ONE, GirihStars.ONE, GirihStars.ONE);
    for (let k = 0; k < 8; k++) this.kites.setMatrixAt(star * 8 + k, this.m);
    this.centres.setMatrixAt(star, this.m);
  }

  flush() {
    this.kites.instanceMatrix.needsUpdate = this.centres.instanceMatrix.needsUpdate = true;
  }
}

/** Where tile `piece` of a star lies when the star is whole: its offset from the star's centre and its rotation (`spin` turns the star). */
export function tileHome(piece: number, spin: number, scale: number, pos: THREE.Vector3, quat: THREE.Quaternion) {
  const ang = piece < 8 ? spin + piece * PI8 : spin;
  const r = piece < 8 ? KITE_RC * scale : 0;
  pos.set(Math.cos(ang) * r, 0, Math.sin(ang) * r);
  quat.setFromAxisAngle(Y_AXIS, -ang);
}
const Y_AXIS = new THREE.Vector3(0, 1, 0);

// ---------------------------------------------------------------------------------------------------------------
// Decals on the floor: instanced flat shapes with their own alpha (a star stamped in gold lines, a ring, a crescent's shadow).
// ---------------------------------------------------------------------------------------------------------------

/** The star's outline as a floor shape: a gold line (code 1) round a faint field (code 0). Unit radius. */
export function starStampGeometry(): THREE.BufferGeometry {
  const outer = starPts(TIP, VALLEY, 0).map(([x, z]) => new THREE.Vector2(x, -z));
  const hole = starPts(TIP * 0.88, VALLEY * 0.88, 0).map(([x, z]) => new THREE.Vector2(x, -z));
  const ring = new THREE.ShapeGeometry(Object.assign(new THREE.Shape(outer), { holes: [new THREE.Path(hole.slice().reverse())] }));
  const field = new THREE.ShapeGeometry(new THREE.Shape(hole));
  const code = (g: THREE.BufferGeometry, v: number) => {
    const c = new Float32Array(g.attributes.position.count);
    c.fill(v);
    g.setAttribute('aCode', new THREE.BufferAttribute(c, 1));
    g.deleteAttribute('uv');
    g.deleteAttribute('normal');
  };
  code(ring, 1);
  code(field, 0);
  const g = mergeParts([ring, field]);
  g.rotateX(-Math.PI / 2);
  return g;
}

/** A flat ring of unit outer radius (code 1). */
export function ringGeometry(inner = 0.86): THREE.BufferGeometry {
  const g = new THREE.RingGeometry(inner, 1, 56).rotateX(-Math.PI / 2);
  const c = new Float32Array(g.attributes.position.count).fill(1);
  g.setAttribute('aCode', new THREE.BufferAttribute(c, 1));
  g.deleteAttribute('uv');
  g.deleteAttribute('normal');
  return g;
}

/** The crescent's outline, as a flat dark field (code 0): its shadow on the floor. */
export function crescentFlatGeometry(): THREE.BufferGeometry {
  const g = new THREE.ShapeGeometry(new THREE.Shape(crescentPts().map(([x, z]) => new THREE.Vector2(x, -z)))).rotateX(-Math.PI / 2);
  g.setAttribute('aCode', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count), 1));
  g.deleteAttribute('uv');
  g.deleteAttribute('normal');
  return g;
}

export class Decals {
  readonly mesh: THREE.InstancedMesh;
  private a: THREE.InstancedBufferAttribute;
  private m = new THREE.Matrix4();
  private q = new THREE.Quaternion();
  private p = new THREE.Vector3();
  private s = new THREE.Vector3();

  constructor(geometry: THREE.BufferGeometry, private n: number, ring: string, fill: string, ringA: number, fillA: number) {
    this.a = new THREE.InstancedBufferAttribute(new Float32Array(n), 1);
    this.a.setUsage(THREE.DynamicDrawUsage);
    geometry.setAttribute('aA', this.a);
    const mat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      polygonOffset: true,
      polygonOffsetFactor: -4,
      polygonOffsetUnits: -4,
      uniforms: { uRing: { value: new THREE.Color(ring) }, uFill: { value: new THREE.Color(fill) }, uRingA: { value: ringA }, uFillA: { value: fillA } },
      vertexShader: /* glsl */ `
        attribute float aA; attribute float aCode; varying float vA; varying float vCode;
        void main() { vA = aA; vCode = aCode; gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0); }`,
      fragmentShader: /* glsl */ `
        varying float vA; varying float vCode; uniform vec3 uRing; uniform vec3 uFill; uniform float uRingA; uniform float uFillA;
        void main() {
          float a = vA * mix(uFillA, uRingA, vCode);
          if (a < 0.003) discard;
          gl_FragColor = vec4(mix(uFill, uRing, vCode), a);
          ${TAIL}
        }`,
    });
    this.mesh = new THREE.InstancedMesh(geometry, mat, n);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 3;
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.clear();
  }

  clear() {
    for (let i = 0; i < this.n; i++) this.set(i, 0, 0, 1e-4, 0, 0);
  }

  set(i: number, x: number, z: number, scale: number, rot: number, alpha: number, y = 0.04) {
    this.q.setFromAxisAngle(Y_AXIS, rot);
    this.p.set(x, y, z);
    this.s.setScalar(Math.max(1e-4, scale));
    this.m.compose(this.p, this.q, this.s);
    this.mesh.setMatrixAt(i, this.m);
    this.a.setX(i, alpha);
    this.mesh.instanceMatrix.needsUpdate = true;
    this.a.needsUpdate = true;
  }
}

// ---------------------------------------------------------------------------------------------------------------
// The crescent: a flat silver blade, thick enough to catch the light, horns up and down in its own plane.
// ---------------------------------------------------------------------------------------------------------------

const CD = 0.42, CRI = 1.12;

/** The crescent's outline (x, z), unit outer radius, centred on the outer circle (so that it spins about its own disc). */
export function crescentPts(): V2[] {
  const th = Math.acos((1 + CD * CD - CRI * CRI) / (2 * CD));
  const tipY = Math.sin(th), phi = Math.atan2(tipY, Math.cos(th) - CD);
  const out: V2[] = [];
  const N = 28;
  for (let i = 0; i <= N; i++) {
    const a = th + (i / N) * (Math.PI * 2 - 2 * th);
    out.push([Math.cos(a), Math.sin(a)]);
  }
  for (let i = 0; i <= N; i++) {
    const a = Math.PI * 2 - phi - (i / N) * (Math.PI * 2 - 2 * phi);
    out.push([CD + Math.cos(a) * CRI, Math.sin(a) * CRI]);
  }
  return out;
}

export function crescentGeometry(): THREE.BufferGeometry {
  const sh = new THREE.Shape(crescentPts().map(([x, z]) => new THREE.Vector2(x, -z)));
  const g = new THREE.ExtrudeGeometry(sh, { depth: 0.12, bevelEnabled: true, bevelThickness: 0.035, bevelSize: 0.03, bevelSegments: 2 });
  g.translate(0, 0, -0.06);
  g.rotateX(-Math.PI / 2);
  return g;
}

export function crescentMaterial() {
  return new THREE.ShaderMaterial({
    side: THREE.DoubleSide,
    uniforms: {
      uSpin: { value: 0 },
      uGlow: { value: 0 },
      uLight: { value: new THREE.Vector3(-0.35, 0.8, 0.5).normalize() },
      uDark: { value: new THREE.Color('#222b66') },
      uSilver: { value: new THREE.Color('#d6dff0') },
      uHot: { value: new THREE.Color('#f6faff') },
    },
    vertexShader: /* glsl */ `
      varying vec3 vView; varying vec3 vLocal;
      void main() { vLocal = position; vec4 mv = modelViewMatrix * vec4(position, 1.0); vView = mv.xyz; gl_Position = projectionMatrix * mv; }`,
    fragmentShader: /* glsl */ `
      varying vec3 vView; varying vec3 vLocal;
      uniform vec3 uLight; uniform vec3 uDark; uniform vec3 uSilver; uniform vec3 uHot; uniform float uSpin; uniform float uGlow;
      void main() {
        vec3 n = normalize(cross(dFdx(vView), dFdy(vView)));
        float lit = max(dot(n, uLight), 0.0);
        float rim = pow(1.0 - abs(n.z), 1.5);
        vec3 col = mix(uDark, uSilver, 0.28 + 0.72 * lit);
        col = mix(col, uSilver, rim * 0.5);
        // a bright band sweeps across the blade as it turns; the horns burn pale
        float band = pow(max(0.0, sin(vLocal.x * 4.0 + vLocal.z * 3.0 + uSpin * 2.0)), 26.0);
        float r = length(vLocal.xz);
        float horn = smoothstep(0.78, 1.0, r) * smoothstep(0.0, 0.5, abs(vLocal.z));
        col += uHot * (band * 0.6 + horn * 0.35);
        col = mix(col, uHot, clamp(uGlow, 0.0, 0.85));
        gl_FragColor = vec4(col, 1.0);
        ${TAIL}
      }`,
  });
}

// ---------------------------------------------------------------------------------------------------------------
// A ribbon trail lying flat in the air behind a point: the newest sample at its head, ageing to nothing.
// ---------------------------------------------------------------------------------------------------------------

export class Ribbon {
  readonly mesh: THREE.Mesh;
  private px: Float32Array;
  private py: Float32Array;
  private pz: Float32Array;
  private age: Float32Array;
  private pos: Float32Array;
  private a: Float32Array;
  private posA: THREE.BufferAttribute;
  private aA: THREE.BufferAttribute;
  private n = 0;

  constructor(private max: number, private halfW: number, private life: number, core: string, edge: string) {
    this.px = new Float32Array(max); this.py = new Float32Array(max); this.pz = new Float32Array(max); this.age = new Float32Array(max);
    this.pos = new Float32Array(max * 6);
    this.a = new Float32Array(max * 2);
    const k = new Float32Array(max * 2);
    const idx: number[] = [];
    for (let i = 0; i < max; i++) {
      k[i * 2] = -1; k[i * 2 + 1] = 1;
      if (i < max - 1) idx.push(i * 2, i * 2 + 1, i * 2 + 2, i * 2 + 1, i * 2 + 3, i * 2 + 2);
    }
    const g = new THREE.BufferGeometry();
    this.posA = new THREE.BufferAttribute(this.pos, 3);
    this.aA = new THREE.BufferAttribute(this.a, 1);
    this.posA.setUsage(THREE.DynamicDrawUsage);
    this.aA.setUsage(THREE.DynamicDrawUsage);
    g.setAttribute('position', this.posA);
    g.setAttribute('aA', this.aA);
    g.setAttribute('aK', new THREE.BufferAttribute(k, 1));
    g.setIndex(idx);
    this.mesh = new THREE.Mesh(g, new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      uniforms: { uCore: { value: new THREE.Color(core) }, uEdge: { value: new THREE.Color(edge) } },
      vertexShader: /* glsl */ `
        attribute float aA; attribute float aK; varying float vA; varying float vK;
        void main() { vA = aA; vK = aK; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: /* glsl */ `
        varying float vA; varying float vK; uniform vec3 uCore; uniform vec3 uEdge;
        void main() {
          float c = 1.0 - abs(vK);
          float a = vA * (0.25 + 0.75 * smoothstep(0.0, 0.6, c));
          if (a < 0.004) discard;
          gl_FragColor = vec4(mix(uEdge, uCore, smoothstep(0.35, 1.0, c) * vA), a);
          ${TAIL}
        }`,
    }));
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 4;
    this.clear();
  }

  clear() {
    this.n = 0;
    this.pos.fill(0);
    this.a.fill(0);
    this.posA.needsUpdate = this.aA.needsUpdate = true;
  }

  /** A new head sample. */
  push(x: number, y: number, z: number) {
    const m = Math.min(this.n, this.max - 1);
    this.px.copyWithin(1, 0, m); this.py.copyWithin(1, 0, m); this.pz.copyWithin(1, 0, m); this.age.copyWithin(1, 0, m);
    this.px[0] = x; this.py[0] = y; this.pz[0] = z; this.age[0] = 0;
    this.n = Math.min(this.max, this.n + 1);
  }

  update(dt: number) {
    const n = this.n;
    for (let i = 0; i < n; i++) this.age[i] += dt;
    while (this.n > 0 && this.age[this.n - 1] >= this.life) this.n--;
    for (let i = 0; i < this.max; i++) {
      if (i >= this.n) {
        const j = Math.max(0, this.n - 1), b = i * 6;
        const x = this.n ? this.px[j] : 0, y = this.n ? this.py[j] : -50, z = this.n ? this.pz[j] : 0;
        this.pos[b] = this.pos[b + 3] = x; this.pos[b + 1] = this.pos[b + 4] = y; this.pos[b + 2] = this.pos[b + 5] = z;
        this.a[i * 2] = this.a[i * 2 + 1] = 0;
        continue;
      }
      const prev = Math.max(0, i - 1), next = Math.min(this.n - 1, i + 1);
      let dx = this.px[prev] - this.px[next], dz = this.pz[prev] - this.pz[next];
      const l = Math.hypot(dx, dz) || 1;
      dx /= l; dz /= l;
      const f = 1 - this.age[i] / this.life;
      const w = this.halfW * Math.pow(f, 0.7) * Math.min(1, 0.35 + i / 4);
      const b = i * 6;
      this.pos[b] = this.px[i] - dz * w; this.pos[b + 1] = this.py[i]; this.pos[b + 2] = this.pz[i] + dx * w;
      this.pos[b + 3] = this.px[i] + dz * w; this.pos[b + 4] = this.py[i]; this.pos[b + 5] = this.pz[i] - dx * w;
      this.a[i * 2] = this.a[i * 2 + 1] = Math.pow(f, 1.3) * 0.9;
    }
    this.posA.needsUpdate = this.aA.needsUpdate = true;
  }
}

// ---------------------------------------------------------------------------------------------------------------
// Glints: four-pointed star points (star dust). Spawned and drifting (`spawn`) or placed by hand every frame (`set`).
// ---------------------------------------------------------------------------------------------------------------

export class Glints {
  readonly mesh: THREE.Points;
  private pos: Float32Array;
  private col: Float32Array;
  private al: Float32Array;
  private sz: Float32Array;
  private vel: Float32Array;
  private life: Float32Array;
  private age: Float32Array;
  private size0: Float32Array;
  private drag: Float32Array;
  private manual: Uint8Array;
  private posA: THREE.BufferAttribute;
  private colA: THREE.BufferAttribute;
  private alA: THREE.BufferAttribute;
  private szA: THREE.BufferAttribute;
  private head = 0;
  private time = 0;

  constructor(private max: number) {
    this.pos = new Float32Array(max * 3); this.col = new Float32Array(max * 3); this.al = new Float32Array(max); this.sz = new Float32Array(max);
    this.vel = new Float32Array(max * 3); this.life = new Float32Array(max).fill(1); this.age = new Float32Array(max).fill(2);
    this.size0 = new Float32Array(max); this.drag = new Float32Array(max); this.manual = new Uint8Array(max);
    const g = new THREE.BufferGeometry();
    this.posA = new THREE.BufferAttribute(this.pos, 3);
    this.colA = new THREE.BufferAttribute(this.col, 3);
    this.alA = new THREE.BufferAttribute(this.al, 1);
    this.szA = new THREE.BufferAttribute(this.sz, 1);
    for (const a of [this.posA, this.colA, this.alA, this.szA]) a.setUsage(THREE.DynamicDrawUsage);
    g.setAttribute('position', this.posA);
    g.setAttribute('aCol', this.colA);
    g.setAttribute('aA', this.alA);
    g.setAttribute('aSize', this.szA);
    const scale = { value: 400 };
    const size = new THREE.Vector2();
    this.mesh = new THREE.Points(g, new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      uniforms: { uScale: scale },
      vertexShader: /* glsl */ `
        attribute vec3 aCol; attribute float aA; attribute float aSize; uniform float uScale; varying vec3 vC; varying float vA;
        void main() {
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          vC = aCol; vA = aA;
          gl_PointSize = aA > 0.003 ? aSize * uScale / -mv.z : 0.0;
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: /* glsl */ `
        varying vec3 vC; varying float vA;
        void main() {
          vec2 p = abs(gl_PointCoord - 0.5) * 2.0;
          float s = sqrt(p.x) + sqrt(p.y);
          float star = 1.0 - smoothstep(0.65, 1.0, s);
          float core = 1.0 - smoothstep(0.0, 0.4, length(p));
          float a = max(star * 0.9, core) * vA;
          if (a < 0.01) discard;
          gl_FragColor = vec4(vC * (0.85 + 0.6 * core), a);
          ${TAIL}
        }`,
    }));
    this.mesh.onBeforeRender = (renderer) => {
      renderer.getDrawingBufferSize(size);
      scale.value = size.y * 0.5;
    };
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 6;
    this.clear();
  }

  clear() {
    this.head = 0;
    this.age.fill(2);
    this.manual.fill(0);
    this.al.fill(0);
    for (let i = 0; i < this.max; i++) this.pos[i * 3 + 1] = -50;
    this.posA.needsUpdate = this.alA.needsUpdate = true;
  }

  /** One glint from (x, y, z), drifting with (vx, vy, vz), alive `life` s, `size` m across at the most. */
  spawn(x: number, y: number, z: number, c: THREE.Color, size: number, life: number, vx = 0, vy = 0, vz = 0, drag = 2) {
    const i = this.head;
    this.head = (this.head + 1) % this.max;
    const b = i * 3;
    this.pos[b] = x; this.pos[b + 1] = y; this.pos[b + 2] = z;
    this.vel[b] = vx; this.vel[b + 1] = vy; this.vel[b + 2] = vz;
    this.col[b] = c.r; this.col[b + 1] = c.g; this.col[b + 2] = c.b;
    this.life[i] = life; this.age[i] = 0; this.size0[i] = size; this.drag[i] = drag; this.manual[i] = 0;
  }

  /** Slot `i`, placed by hand this frame (call every frame; alpha 0 hides it). */
  set(i: number, x: number, y: number, z: number, c: THREE.Color, size: number, alpha: number) {
    const b = i * 3;
    this.manual[i] = 1;
    this.pos[b] = x; this.pos[b + 1] = y; this.pos[b + 2] = z;
    this.col[b] = c.r; this.col[b + 1] = c.g; this.col[b + 2] = c.b;
    this.sz[i] = size; this.al[i] = alpha;
    this.posA.needsUpdate = this.colA.needsUpdate = this.alA.needsUpdate = this.szA.needsUpdate = true;
  }

  update(dt: number) {
    this.time += dt;
    for (let i = 0; i < this.max; i++) {
      if (this.manual[i] || this.age[i] >= 1) continue;
      const b = i * 3;
      this.age[i] += dt / this.life[i];
      if (this.age[i] >= 1) { this.al[i] = 0; this.pos[b + 1] = -50; continue; }
      const d = Math.exp(-this.drag[i] * dt);
      this.vel[b] *= d; this.vel[b + 1] *= d; this.vel[b + 2] *= d;
      this.pos[b] += this.vel[b] * dt; this.pos[b + 1] += this.vel[b + 1] * dt; this.pos[b + 2] += this.vel[b + 2] * dt;
      const f = this.age[i];
      const fade = f < 0.08 ? f / 0.08 : 1 - Math.pow((f - 0.08) / 0.92, 1.5);
      const tw = 0.65 + 0.35 * Math.sin(this.time * 17 + i * 3.1);
      this.al[i] = fade * tw;
      this.sz[i] = this.size0[i] * (0.5 + 0.5 * fade);
    }
    this.posA.needsUpdate = this.colA.needsUpdate = this.alA.needsUpdate = this.szA.needsUpdate = true;
  }
}
