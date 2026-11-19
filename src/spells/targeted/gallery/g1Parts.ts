import * as THREE from 'three';
import { mergeParts } from '../../../effects/common';

/**
 * Pieces shared by group g1 (Kintsugi Shatter, Carnival Masquerade; pipeline/designs/gallery-20.md):
 * - `Pieces`: instanced hard objects (glaze shards, porcelain masks) lit by a small gloss shader, with a per-instance gold glow.
 * - `shardGeometry`, `maskGeometry`: their forms, in vertex colours (dark glaze / cream body / gold seam; porcelain / gold leaf / teal).
 * - `SilkRibbon`: a twisting strip of teal silk with gold hems, placed by a path function.
 * - `GlazeShell`, `KilnFloor`: black glaze crazed with gold seams (a procedural cell crackle), over a figure and on the floor.
 * Nothing here makes a three.js object when the file is loaded: every piece is a class made by its look's constructor. No dice.
 */

export { hash, clamp01, easeOut, smooth } from '../../../heroes/sheath/partsBig';

const TAIL = /* glsl */ `#include <tonemapping_fragment>\n#include <colorspace_fragment>`;

/** Cell noise: `vor(p)` = (second nearest minus nearest distance, the nearest cell's id 0..1, nearest distance). */
const GLSL_VOR = /* glsl */ `
  vec3 h33(vec3 p) { p = fract(p * vec3(.1031, .1030, .0973)); p += dot(p, p.yxz + 33.33); return fract((p.xxy + p.yxx) * p.zyx); }
  float h31(vec3 p) { p = fract(p * .1031); p += dot(p, p.zyx + 31.32); return fract((p.x + p.y) * p.z); }
  vec3 vor(vec3 x) {
    vec3 n = floor(x), f = fract(x);
    float d1 = 9., d2 = 9., id = 0.;
    for (int k = -1; k <= 1; k++) for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) {
      vec3 g = vec3(float(i), float(j), float(k));
      vec3 r = g + h33(n + g) - f;
      float d = dot(r, r);
      if (d < d1) { d2 = d1; d1 = d; id = h31(n + g); } else if (d < d2) { d2 = d; }
    }
    return vec3(sqrt(d2) - sqrt(d1), id, sqrt(d1));
  }`;

/** A flat material that does not z-fight the floor. */
const onFloor = <M extends THREE.Material>(m: M): M => { m.polygonOffset = true; m.polygonOffsetFactor = -2; m.polygonOffsetUnits = -2; return m; };

// ---------------------------------------------------------------------------------------------------------------
// Hard pieces.
// ---------------------------------------------------------------------------------------------------------------

/** Colours a flat-shaded (non-indexed) geometry by each triangle's normal: `front` (+z flat), `back` (-z flat), else `side`. */
function paint(g: THREE.BufferGeometry, front: THREE.Color, back: THREE.Color, side: THREE.Color): THREE.BufferGeometry {
  const ng = g.toNonIndexed();
  ng.deleteAttribute('uv');
  ng.computeVertexNormals();
  const n = ng.attributes.normal, count = n.count, col = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const z = n.getZ(i);
    const c = z > 0.92 ? front : z < -0.92 ? back : side;
    col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
  }
  ng.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return ng;
}

/** A jagged plate of broken glazed clay, about 1 m across, 0.07 thick: black glaze on the front, cream body behind, gold on the edge. */
export function shardGeometry(variant: number): THREE.BufferGeometry {
  const pts = variant % 2 === 0
    ? [[-0.5, -0.3], [0.05, -0.52], [0.52, -0.12], [0.3, 0.46], [-0.34, 0.3]]
    : [[-0.46, -0.4], [0.52, -0.18], [0.12, 0.2], [0.02, 0.52], [-0.3, 0.1]];
  const s = new THREE.Shape();
  pts.forEach((p, i) => (i ? s.lineTo(p[0], p[1]) : s.moveTo(p[0], p[1])));
  s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth: 0.07, bevelEnabled: false });
  g.translate(0, 0, -0.035);
  return paint(g, new THREE.Color('#15110f'), new THREE.Color('#b3a78a'), new THREE.Color('#e0a93c'));
}

/** A half mask (Columbina), 1 m wide: porcelain face, gold-leaf rim, cat eyes, a teal diamond on the brow, lacquer back. */
export function maskGeometry(): THREE.BufferGeometry {
  const out: [number, number][] = [
    [-0.5, 0.12], [-0.43, 0.3], [-0.21, 0.41], [0, 0.43], [0.21, 0.41], [0.43, 0.3], [0.5, 0.12],
    [0.45, -0.08], [0.31, -0.2], [0.14, -0.19], [0.07, -0.36], [0, -0.4], [-0.07, -0.36], [-0.14, -0.19], [-0.31, -0.2], [-0.45, -0.08],
  ];
  const s = new THREE.Shape();
  out.forEach((p, i) => (i ? s.lineTo(p[0], p[1]) : s.moveTo(p[0], p[1])));
  s.closePath();
  for (const k of [-1, 1]) {
    // a cat's eye: the outer corner lifted
    const eye = [[0.4, 0.13], [0.3, 0.14], [0.14, 0.09], [0.07, 0.01], [0.17, -0.05], [0.32, -0.03]];
    const h = new THREE.Path();
    eye.forEach((p, i) => (i ? h.lineTo(p[0] * k, p[1]) : h.moveTo(p[0] * k, p[1])));
    h.closePath();
    s.holes.push(h);
  }
  const body = paint(
    new THREE.ExtrudeGeometry(s, { depth: 0.05, bevelEnabled: true, bevelThickness: 0.05, bevelSize: 0.045, bevelSegments: 1 }).translate(0, 0, -0.05),
    new THREE.Color('#e4ddcd'), new THREE.Color('#0d1a1b'), new THREE.Color('#e3b14d'),
  );
  const d = new THREE.Shape();
  d.moveTo(0, 0.34); d.lineTo(0.07, 0.25); d.lineTo(0, 0.16); d.lineTo(-0.07, 0.25); d.closePath();
  const gem = paint(new THREE.ExtrudeGeometry(d, { depth: 0.02, bevelEnabled: false }).translate(0, 0, 0.045), new THREE.Color('#17a99b'), new THREE.Color('#17a99b'), new THREE.Color('#e3b14d'));
  return mergeParts([body, gem]);
}

/**
 * Instanced pieces with a small gloss shading: dark faces are glazed (a highlight), gold edges take a per-instance glow. The
 * piece's front is +z; `set` places it (Euler order YXZ: yaw, then pitch, then roll about its own facing). Hidden until set.
 */
export class Pieces {
  readonly mesh: THREE.InstancedMesh;
  private glow: THREE.InstancedBufferAttribute;
  private m = new THREE.Matrix4();
  private q = new THREE.Quaternion();
  private p = new THREE.Vector3();
  private s = new THREE.Vector3();
  private e = new THREE.Euler(0, 0, 0, 'YXZ');

  constructor(geo: THREE.BufferGeometry, private n: number) {
    this.glow = new THREE.InstancedBufferAttribute(new Float32Array(n), 1);
    this.glow.setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('aGlow', this.glow);
    const mat = new THREE.ShaderMaterial({
      side: THREE.DoubleSide,
      vertexShader: /* glsl */ `
        attribute vec3 color; attribute float aGlow;
        varying vec3 vCol; varying vec3 vN; varying vec3 vV; varying float vGlow;
        void main() {
          mat4 mv = modelViewMatrix * instanceMatrix;
          vec4 p = mv * vec4(position, 1.0);
          vN = mat3(mv) * normal; vV = -p.xyz; vCol = color; vGlow = aGlow;
          gl_Position = projectionMatrix * p;
        }`,
      fragmentShader: /* glsl */ `
        varying vec3 vCol; varying vec3 vN; varying vec3 vV; varying float vGlow;
        void main() {
          vec3 N = normalize(vN); if (!gl_FrontFacing) N = -N;
          vec3 V = normalize(vV), L = normalize(vec3(0.3, 0.75, 0.55));
          float lum = dot(vCol, vec3(.3, .59, .11));
          float gold = step(0.1, vCol.r - vCol.b) * step(0.5, lum);
          float gloss = 1.0 - smoothstep(0.08, 0.4, lum);
          float dif = 0.42 + 0.42 * max(dot(N, L), 0.0);
          vec3 H = normalize(L + V);
          float spec = pow(max(dot(N, H), 0.0), 36.0) * (0.25 + 0.75 * gloss) * 0.45;
          float rim = pow(1.0 - max(dot(N, V), 0.0), 3.0) * gloss * 0.18;
          vec3 col = vCol * dif + vec3(1.0, 0.95, 0.85) * (spec + rim);
          col += gold * vCol * (0.1 + 0.8 * vGlow) + gold * vec3(1.0, 0.85, 0.5) * 0.1 * vGlow;
          gl_FragColor = vec4(col, 1.0);
          ${TAIL}
        }`,
    });
    this.mesh = new THREE.InstancedMesh(geo, mat, n);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 5;
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.reset();
  }

  /** Every piece hidden. */
  reset() {
    for (let i = 0; i < this.n; i++) this.hide(i);
    this.commit();
  }

  hide(i: number) {
    this.p.set(0, -50, 0);
    this.s.setScalar(1e-4);
    this.q.identity();
    this.m.compose(this.p, this.q, this.s);
    this.mesh.setMatrixAt(i, this.m);
    this.glow.setX(i, 0);
  }

  set(i: number, x: number, y: number, z: number, rx: number, ry: number, rz: number, sx: number, sy: number, sz: number, glow = 0) {
    this.e.set(rx, ry, rz);
    this.q.setFromEuler(this.e);
    this.p.set(x, y, z);
    this.s.set(Math.max(sx, 1e-4), Math.max(sy, 1e-4), Math.max(sz, 1e-4));
    this.m.compose(this.p, this.q, this.s);
    this.mesh.setMatrixAt(i, this.m);
    this.glow.setX(i, glow);
  }

  commit() {
    this.mesh.instanceMatrix.needsUpdate = true;
    this.glow.needsUpdate = true;
  }
}

// ---------------------------------------------------------------------------------------------------------------
// Silk.
// ---------------------------------------------------------------------------------------------------------------

const _up = new THREE.Vector3(0, 1, 0);

/**
 * A ribbon of teal silk with a gold hem and a cream thread, lacquer-dark on its back, twisting as it goes. `set` places the part
 * of the path `path(u)` (u 0..1) between `from` and `to`, `width` wide (tapering at both ends), turned by `twist` radians per
 * metre-ish and fluttering with `time`. No allocation per frame.
 */
export class SilkRibbon {
  readonly mesh: THREE.Mesh;
  private pos: Float32Array;
  private posA: THREE.BufferAttribute;
  private mat: THREE.ShaderMaterial;
  private pts: THREE.Vector3[];
  private a = new THREE.Vector3();
  private b = new THREE.Vector3();
  private t = new THREE.Vector3();
  private sd = new THREE.Vector3();
  private n2 = new THREE.Vector3();

  constructor(private seg: number) {
    const rows = seg + 1;
    this.pos = new Float32Array(rows * 2 * 3);
    this.pts = Array.from({ length: rows }, () => new THREE.Vector3());
    const uv = new Float32Array(rows * 2 * 2), idx: number[] = [];
    for (let i = 0; i < rows; i++) {
      uv[i * 4] = 0; uv[i * 4 + 1] = i / seg; uv[i * 4 + 2] = 1; uv[i * 4 + 3] = i / seg;
      if (i < seg) { const k = i * 2; idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2); }
    }
    const geo = new THREE.BufferGeometry();
    this.posA = new THREE.BufferAttribute(this.pos, 3);
    this.posA.setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('position', this.posA);
    geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    geo.setIndex(idx);
    this.mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, side: THREE.DoubleSide,
      uniforms: {
        uOpacity: { value: 1 }, uTime: { value: 0 },
        uTeal: { value: new THREE.Color('#17a99b') }, uDeep: { value: new THREE.Color('#0b2b2c') },
        uGold: { value: new THREE.Color('#e3b14d') }, uFoil: { value: new THREE.Color('#f1ebdf') },
      },
      vertexShader: /* glsl */ `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: /* glsl */ `
        varying vec2 vUv; uniform float uOpacity; uniform float uTime; uniform vec3 uTeal; uniform vec3 uDeep; uniform vec3 uGold; uniform vec3 uFoil;
        void main() {
          float across = abs(vUv.x * 2.0 - 1.0);
          float fold = 0.78 + 0.22 * sin(vUv.y * 40.0 + uTime * 6.0 + vUv.x * 3.0);
          vec3 silk = gl_FrontFacing ? uTeal * fold : uDeep * (0.8 + 0.4 * fold);
          float hem = smoothstep(0.80, 0.86, across);
          float thread = smoothstep(0.05, 0.0, abs(across - 0.66)) * 0.7;
          vec3 col = mix(silk, uFoil, thread);
          col = mix(col, uGold * (0.9 + 0.3 * fold), hem);
          float edge = smoothstep(1.0, 0.94, across);
          gl_FragColor = vec4(col, uOpacity * edge);
          ${TAIL}
        }`,
    });
    this.mesh = new THREE.Mesh(geo, this.mat);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 6;
    this.mesh.visible = false;
  }

  set(path: (u: number, out: THREE.Vector3) => void, from: number, to: number, width: number, twist: number, time: number, opacity: number) {
    const len = to - from;
    this.mesh.visible = opacity > 0.01 && len > 0.004 && width > 1e-3;
    if (!this.mesh.visible) return;
    const seg = this.seg;
    for (let i = 0; i <= seg; i++) path(from + len * (i / seg), this.pts[i]);
    for (let i = 0; i <= seg; i++) {
      const p = this.pts[i], k = i / seg;
      this.a.copy(this.pts[Math.min(seg, i + 1)]).sub(this.pts[Math.max(0, i - 1)]);
      if (this.a.lengthSq() < 1e-8) this.a.set(0, 0, 1);
      this.t.copy(this.a).normalize();
      this.sd.crossVectors(this.t, _up);
      if (this.sd.lengthSq() < 1e-4) this.sd.set(1, 0, 0);
      this.sd.normalize();
      this.n2.crossVectors(this.t, this.sd);
      const ang = twist * k * 6 + time * 3 + k * 5;
      this.b.copy(this.sd).multiplyScalar(Math.cos(ang)).addScaledVector(this.n2, Math.sin(ang));
      const w = width * 0.5 * Math.pow(Math.sin(Math.PI * Math.min(1, Math.max(0.04, k))), 0.45);
      const o = i * 6;
      this.pos[o] = p.x - this.b.x * w; this.pos[o + 1] = p.y - this.b.y * w; this.pos[o + 2] = p.z - this.b.z * w;
      this.pos[o + 3] = p.x + this.b.x * w; this.pos[o + 4] = p.y + this.b.y * w; this.pos[o + 5] = p.z + this.b.z * w;
    }
    this.posA.needsUpdate = true;
    this.mat.uniforms.uOpacity.value = opacity;
    this.mat.uniforms.uTime.value = time;
  }

  hide() {
    this.mesh.visible = false;
  }
}

// ---------------------------------------------------------------------------------------------------------------
// Black glaze crazed with gold.
// ---------------------------------------------------------------------------------------------------------------

const CRACKLE_FRAG_HEAD = /* glsl */ `
  uniform vec3 uDark; uniform vec3 uGold; uniform vec3 uFoil; uniform vec3 uCore;
  ${GLSL_VOR}
  /** The gold seam at an edge distance e (F2 - F1): a gold band with a cream thread down its middle. */
  vec3 seamColor(float e, float w, float glow) {
    vec3 gold = mix(uGold, uCore, clamp(glow, 0.0, 1.0) * 0.3) * (0.78 + 0.25 * glow);
    return mix(gold, uFoil, (1.0 - smoothstep(0.0, w * 0.4, e)) * 0.7);
  }`;

/**
 * An open, robe-shaped shell (about 2.2 m tall) round a standing figure: translucent black glaze with a gold crackle that
 * climbs it from the floor (`spread` 0..1.3). `show` fades it, `glow` brightens the seams, `tremor` shakes it.
 */
export class GlazeShell {
  readonly mesh: THREE.Mesh;
  private mat: THREE.ShaderMaterial;

  constructor() {
    const prof = [[0.68, 0], [0.64, 0.3], [0.54, 0.8], [0.49, 1.15], [0.52, 1.45], [0.43, 1.75], [0.32, 1.95], [0.14, 2.15], [0.001, 2.22]];
    const geo = new THREE.LatheGeometry(prof.map((p) => new THREE.Vector2(p[0], p[1])), 30);
    this.mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, side: THREE.DoubleSide,
      uniforms: {
        uShow: { value: 0 }, uSpread: { value: 0 }, uGlow: { value: 0 },
        uDark: { value: new THREE.Color('#0d0b0a') }, uGold: { value: new THREE.Color('#d9a23a') },
        uFoil: { value: new THREE.Color('#f1e8d0') }, uCore: { value: new THREE.Color('#fff0c4') },
      },
      vertexShader: /* glsl */ `
        varying vec3 vObj; varying vec3 vN; varying vec3 vV;
        void main() {
          vObj = position; vN = normalMatrix * normal;
          vec4 p = modelViewMatrix * vec4(position, 1.0); vV = -p.xyz;
          gl_Position = projectionMatrix * p;
        }`,
      fragmentShader: /* glsl */ `
        varying vec3 vObj; varying vec3 vN; varying vec3 vV;
        uniform float uShow; uniform float uSpread; uniform float uGlow;
        ${CRACKLE_FRAG_HEAD}
        void main() {
          vec3 N = normalize(vN), V = normalize(vV);
          float fr = pow(1.0 - abs(dot(N, V)), 2.4);
          vec3 v = vor(vObj * 2.5 + vec3(3.1, 1.7, 5.3));
          float reach = smoothstep(uSpread, uSpread - 0.2, vObj.y / 2.2 + 0.22 * v.y);
          float w = 0.12 + 0.12 * uGlow;
          float seam = (1.0 - smoothstep(w, w + 0.07, v.x)) * reach;
          vec3 glaze = uDark * (0.7 + 0.6 * v.y) + uFoil * (fr * 0.3 + 0.05 * (1.0 - smoothstep(0.0, 0.5, v.x)));
          vec3 col = mix(glaze, seamColor(v.x, w, uGlow), seam);
          float a = max(0.46 * (0.6 + 0.4 * fr), seam * 0.96) * uShow;
          gl_FragColor = vec4(col, a);
          ${TAIL}
        }`,
    });
    this.mesh = new THREE.Mesh(geo, this.mat);
    this.mesh.renderOrder = 4;
    this.mesh.frustumCulled = false;
    this.mesh.visible = false;
  }

  set(x: number, z: number, show: number, spread: number, glow: number, tremor: number, time: number) {
    this.mesh.visible = show > 0.004;
    this.mesh.position.set(x, 0, z);
    const k = tremor * Math.sin(time * 83);
    this.mesh.scale.set(1 + k, 1 + k * 0.5, 1 + k);
    const u = this.mat.uniforms;
    u.uShow.value = show; u.uSpread.value = spread; u.uGlow.value = glow;
  }
}

/**
 * The kiln floor: a disc of black glaze painted outward from the centre (`reveal` m, ragged), crazed with gold seams that creep
 * out (`spread` m); at the hit the glaze cells let go one by one (`lift` 0..1) and leave the gold lines.
 */
export class KilnFloor {
  readonly mesh: THREE.Mesh;
  private mat: THREE.ShaderMaterial;

  constructor(radius: number) {
    this.mat = onFloor(new THREE.ShaderMaterial({
      transparent: true, depthWrite: false,
      uniforms: {
        uReveal: { value: 0 }, uSpread: { value: 0 }, uLift: { value: 0 }, uGlow: { value: 0 }, uAlpha: { value: 1 },
        uDark: { value: new THREE.Color('#171210') }, uGold: { value: new THREE.Color('#d9a23a') },
        uFoil: { value: new THREE.Color('#f1e8d0') }, uCore: { value: new THREE.Color('#fff0c4') },
      },
      vertexShader: /* glsl */ `varying vec2 vP; void main() { vP = position.xz; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: /* glsl */ `
        varying vec2 vP; uniform float uReveal; uniform float uSpread; uniform float uLift; uniform float uGlow; uniform float uAlpha;
        ${CRACKLE_FRAG_HEAD}
        void main() {
          float r = length(vP), ang = atan(vP.y, vP.x);
          float rag = 0.13 * sin(ang * 7.0 + 1.0) + 0.07 * sin(ang * 13.0 + 4.0) + 0.04 * sin(ang * 29.0);
          float edge = uReveal + rag;
          float inside = smoothstep(edge, edge - 0.08, r);
          vec3 v = vor(vec3(vP.x, 0.0, vP.y) * 2.3 + vec3(5.7, 0.0, 2.9));
          float gone = smoothstep(v.y * 0.7, v.y * 0.7 + 0.18, uLift);
          float reach = smoothstep(uSpread, uSpread - 0.4, r + 0.35 * v.y);
          float w = 0.11 + 0.1 * uGlow;
          float seam = (1.0 - smoothstep(w, w + 0.06, v.x)) * reach * inside;
          float rim = smoothstep(0.07, 0.0, abs(r - edge + 0.06)) * smoothstep(0.0, 0.2, uReveal);
          float glazeA = 0.7 * inside * (1.0 - gone) * (0.8 + 0.2 * v.y);
          vec3 col = mix(uDark, seamColor(v.x, w, uGlow), max(seam, rim * 0.8));
          float a = max(glazeA, max(seam * 0.95, rim * 0.7)) * uAlpha;
          gl_FragColor = vec4(col, a);
          ${TAIL}
        }`,
    }));
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(radius * 2, radius * 2).rotateX(-Math.PI / 2), this.mat);
    this.mesh.renderOrder = 2;
    this.mesh.frustumCulled = false;
    this.mesh.visible = false;
  }

  set(x: number, z: number, reveal: number, spread: number, lift: number, glow: number, alpha: number) {
    this.mesh.visible = alpha > 0.004 && reveal > 0.01;
    this.mesh.position.set(x, 0.03, z);
    const u = this.mat.uniforms;
    u.uReveal.value = reveal; u.uSpread.value = spread; u.uLift.value = lift; u.uGlow.value = glow; u.uAlpha.value = alpha;
  }
}
