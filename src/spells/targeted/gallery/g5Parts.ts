import * as THREE from 'three';
import { mergeParts } from '../../../effects/common';

/**
 * Gallery group 5 (pipeline/designs/gallery-20.md): the pieces of the geode heart and the whalebone harpoon.
 * Nothing here makes a three.js object when the file is loaded: every piece is a class or a function, called by its look's
 * constructor. No dice: `hash` of an index. Every shader ends with the colour-space and tone-mapping includes, so it matches the
 * basic materials.
 */
export const hash = (n: number) => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
export const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
export const smooth = (x: number) => { const t = clamp01(x); return t * t * (3 - 2 * t); };
export const easeOut = (x: number) => 1 - Math.pow(1 - clamp01(x), 3);
/** Overshoots a little (1.0 at the end, about 1.1 near three quarters): a crystal that spears out and settles. */
export const backOut = (x: number) => { const t = clamp01(x) - 1; return 1 + t * t * (2.7 * t + 1.7); };

const TAIL = /* glsl */ `#include <tonemapping_fragment>\n#include <colorspace_fragment>`;
const GLSL_HASH = /* glsl */ `float h1(float n) { return fract(sin(n * 127.1 + 311.7) * 43758.5453); }`;

/** A flat material that does not z-fight the floor. */
const onFloor = <M extends THREE.Material>(m: M): M => { m.polygonOffset = true; m.polygonOffsetFactor = -3; m.polygonOffsetUnits = -3; return m; };

// ---------------------------------------------------------------------------------------------------------------
// Flat-faceted solids (stone, crystal, ivory): the face's normal comes from the screen derivatives, so every facet is lit alone.
// ---------------------------------------------------------------------------------------------------------------

/**
 * A faceted material. Plain: the vertex colour is the colour, a fixed light from the camera's upper left shades each face, and
 * `uGlow` leaks `uGlowCol` through the rim (light inside the stone). Crystal: the vertex colour's x is the height up the crystal
 * (0 root .. 1 tip), the instance's `aTint` is (paleness, growth flash); it runs from deep violet to a quartz tip, facets twinkle.
 */
export function facetMaterial(crystal: boolean, glow = '#b57cff') {
  return new THREE.ShaderMaterial({
    vertexColors: true,
    side: THREE.DoubleSide,
    defines: crystal ? { CRYSTAL: '' } : {},
    uniforms: {
      uLight: { value: new THREE.Vector3(-0.35, 0.8, 0.5).normalize() },
      uGlowCol: { value: new THREE.Color(glow) },
      uGlow: { value: 0 },
      uTime: { value: 0 },
      uDeep: { value: new THREE.Color('#3a1670') },
      uMid: { value: new THREE.Color('#8b4fd9') },
      uQuartz: { value: new THREE.Color('#efe6fa') },
      uHot: { value: new THREE.Color('#ffd0f4') },
    },
    vertexShader: /* glsl */ `
      varying vec3 vView; varying vec3 vCol;
      #ifdef CRYSTAL
      attribute vec2 aTint; varying vec2 vTint;
      #endif
      void main() {
        vec4 p = vec4(position, 1.0);
        #ifdef USE_INSTANCING
        p = instanceMatrix * p;
        #endif
        vec4 mv = modelViewMatrix * p;
        vView = mv.xyz; vCol = color;
        #ifdef CRYSTAL
        vTint = aTint;
        #endif
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      varying vec3 vView; varying vec3 vCol;
      #ifdef CRYSTAL
      varying vec2 vTint;
      #endif
      uniform vec3 uLight; uniform vec3 uGlowCol; uniform float uGlow; uniform float uTime;
      uniform vec3 uDeep; uniform vec3 uMid; uniform vec3 uQuartz; uniform vec3 uHot;
      void main() {
        vec3 n = normalize(cross(dFdx(vView), dFdy(vView)));
        float lit = 0.42 + 0.58 * max(dot(n, uLight), 0.0);
        float rim = pow(1.0 - abs(n.z), 2.0);
        vec3 col;
        #ifdef CRYSTAL
        float h = vCol.x;
        vec3 base = mix(uDeep, uMid, smoothstep(0.0, 0.55, h));
        base = mix(base, uQuartz, smoothstep(0.5, 1.0, h) * (0.4 + 0.4 * vTint.x));
        base = mix(base, uQuartz, 0.2 * vTint.x);
        col = base * lit + uQuartz * rim * 0.22;
        float tw = pow(max(0.0, sin(uTime * 3.0 + dot(n, vec3(12.9, 78.2, 37.7)) * 5.0 + vTint.x * 20.0)), 28.0);
        col += uQuartz * tw * 0.45;
        col = mix(col, uHot, vTint.y * (0.3 + 0.45 * h));
        #else
        col = vCol * lit + uGlowCol * uGlow * (0.22 + 0.9 * rim);
        #endif
        gl_FragColor = vec4(col, 1.0);
        ${TAIL}
      }`,
  });
}

/** Colours of a stone's faces: cool grey, each face its own shade, a little darker toward the bottom. */
function rindColour(face: number, y: number, out: THREE.Color) {
  const k = hash(face * 3.1 + 7);
  out.set('#3b3742').lerp(new THREE.Color('#7a7482'), k * 0.8 + 0.1 * y);
}

/** A rough stone: an icosahedron of `detail`, its corners pushed in and out, one colour a face (vertex colours), non-indexed. */
export function rockGeometry(detail: number, rough: number, seed: number): THREE.BufferGeometry {
  const g = new THREE.IcosahedronGeometry(1, detail);
  const p = g.attributes.position as THREE.BufferAttribute;
  const key = (i: number) => Math.round(p.getX(i) * 50) * 7919 + Math.round(p.getY(i) * 50) * 104729 + Math.round(p.getZ(i) * 50) * 1299709 + seed;
  for (let i = 0; i < p.count; i++) {
    const f = 1 - rough + rough * 2 * hash(key(i) * 0.001);
    p.setXYZ(i, p.getX(i) * f, p.getY(i) * f * 0.92, p.getZ(i) * f);
  }
  const col = new Float32Array(p.count * 3);
  const c = new THREE.Color();
  for (let f = 0; f < p.count / 3; f++) {
    const y = (p.getY(f * 3) + p.getY(f * 3 + 1) + p.getY(f * 3 + 2)) / 3;
    rindColour(f + seed, y, c);
    for (let k = 0; k < 3; k++) { col[(f * 3 + k) * 3] = c.r; col[(f * 3 + k) * 3 + 1] = c.g; col[(f * 3 + k) * 3 + 2] = c.b; }
  }
  g.deleteAttribute('uv');
  g.deleteAttribute('normal');
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return g;
}

/**
 * One quartz point of unit size: a six-sided shaft (radius 1, tapering a little) up to y = 0.74, then a six-sided point to y = 1.
 * The colour's x is the height (see `facetMaterial`). Scale x and z for its thickness, y for its length.
 */
export function crystalGeometry(): THREE.BufferGeometry {
  const pos: number[] = [], col: number[] = [];
  const S = 6, SHAFT = 0.74;
  const ring = (i: number, y: number, r: number) => [Math.cos((i / S) * Math.PI * 2 + 0.3) * r, y, Math.sin((i / S) * Math.PI * 2 + 0.3) * r];
  const put = (p: number[], h: number) => { pos.push(p[0], p[1], p[2]); col.push(h, 0, 0); };
  for (let i = 0; i < S; i++) {
    const a0 = ring(i, 0, 1), b0 = ring(i + 1, 0, 1), a1 = ring(i, SHAFT, 0.88), b1 = ring(i + 1, SHAFT, 0.88);
    put(a0, 0); put(b0, 0); put(b1, SHAFT); put(a0, 0); put(b1, SHAFT); put(a1, SHAFT);
    put(a1, SHAFT); put(b1, SHAFT); put([0, 1, 0], 1);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  return g;
}

// ---------------------------------------------------------------------------------------------------------------
// The geode's floor: a hollow and cracks that run out from it, glowing violet.
// ---------------------------------------------------------------------------------------------------------------

/**
 * The floor where the stone broke: a dark hollow with a violet rim, and cracks that run out of it (two layers of rays, long and
 * short, jagged), glowing violet along their edges and hot pale near the hollow while `heat` is high. `grow` 0..1 runs them out.
 */
export class FloorCracks {
  readonly mesh: THREE.Mesh;
  private mat: THREE.ShaderMaterial;

  constructor(radius = 3.2) {
    this.mat = onFloor(new THREE.ShaderMaterial({
      transparent: true, depthWrite: false,
      uniforms: {
        uGrow: { value: 0 }, uHeat: { value: 0 }, uFade: { value: 0 }, uR: { value: radius },
        uDark: { value: new THREE.Color('#120b1b') }, uViolet: { value: new THREE.Color('#9a5cf0') }, uHot: { value: new THREE.Color('#f1c9ff') },
      },
      vertexShader: /* glsl */ `varying vec2 vP; void main() { vP = position.xz; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: /* glsl */ `
        varying vec2 vP; uniform float uGrow; uniform float uHeat; uniform float uFade; uniform float uR;
        uniform vec3 uDark; uniform vec3 uViolet; uniform vec3 uHot;
        ${GLSL_HASH}
        vec2 rays(float r, float ang, float N, float s, float reachK, float w0) {
          float seg = 6.28318 / N;
          float u = ang / seg;
          float id = floor(u);
          float cell = fract(u) - 0.5;
          float jit = (h1(id + s) - 0.5) * 0.5;
          float reach = uR * reachK * (0.45 + 0.55 * h1(id * 3.1 + 1.7 + s));
          float lat = (cell - jit) * seg * r + sin(r * 6.0 + id * 2.3) * 0.07 + sin(r * 15.0 + id * 5.1) * 0.025;
          float prog = clamp(r / reach, 0.0, 1.0);
          float w = mix(w0, w0 * 0.2, prog);
          float on = step(r, reach * uGrow) * smoothstep(0.4, 0.62, r);
          return vec2(smoothstep(w, w * 0.35, abs(lat)) * on, smoothstep(w * 4.5, 0.0, abs(lat)) * on * (1.0 - prog * 0.6));
        }
        void main() {
          float r = length(vP);
          float ang = atan(vP.y, vP.x);
          vec2 a = rays(r, ang, 14.0, 0.0, 1.0, 0.085);
          vec2 b = rays(r, ang, 30.0, 9.0, 0.5, 0.05);
          float core = max(a.x, b.x * 0.85);
          float glow = max(a.y, b.y * 0.8);
          float hotK = uHeat * smoothstep(uR * 0.5, 0.0, r);
          vec3 gcol = mix(uViolet, uHot, hotK * 0.8 + uHeat * 0.12);
          vec3 col = gcol; float al = glow * 0.75 * (0.5 + 0.5 * uHeat);
          col = mix(col, uDark, core); al = max(al, core * 0.92);
          float open = smoothstep(0.0, 0.15, uGrow);
          float hole = smoothstep(0.66, 0.52, r) * open;
          float rim = smoothstep(0.08, 0.0, abs(r - 0.6)) * open;
          col = mix(col, uDark, hole); al = max(al, hole * 0.95);
          col = mix(col, gcol, hole * uHeat * 0.5);
          col = mix(col, gcol, rim * 0.9); al = max(al, rim * 0.75 * (0.4 + 0.6 * uHeat));
          gl_FragColor = vec4(col, al * uFade);
          ${TAIL}
        }`,
    }));
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(radius * 2, radius * 2).rotateX(-Math.PI / 2), this.mat);
    this.mesh.renderOrder = 3;
    this.mesh.visible = false;
  }

  set(x: number, z: number, grow: number, heat: number, fade: number) {
    this.mesh.visible = fade > 0.01;
    this.mesh.position.set(x, 0.035, z);
    const u = this.mat.uniforms;
    u.uGrow.value = grow; u.uHeat.value = heat; u.uFade.value = fade;
  }
}

// ---------------------------------------------------------------------------------------------------------------
// The rope.
// ---------------------------------------------------------------------------------------------------------------

/**
 * A rope: a six-sided tube along a sagging, waving line from `a` to `b`, drawn from `u0` to `u1` of that line (0..1). Strands are
 * light and dark in a spiral, a dark whipping every few rings. Made once; `set` moves its points, no allocation.
 */
export class Rope {
  readonly mesh: THREE.Mesh;
  private pos: Float32Array;
  private posA: THREE.BufferAttribute;
  private mid: Float32Array;

  constructor(private segs = 36, private sides = 6, private radius = 0.09) {
    const n = (segs + 1) * sides;
    this.pos = new Float32Array(n * 3);
    this.mid = new Float32Array((segs + 1) * 3);
    const col = new Float32Array(n * 3);
    const light = new THREE.Color('#aab6ba'), dark = new THREE.Color('#72828a'), whip = new THREE.Color('#2a2830');
    const c = new THREE.Color();
    for (let i = 0; i <= segs; i++) {
      for (let j = 0; j < sides; j++) {
        c.copy(j % 2 ? dark : light);
        if (i % 12 === 0) c.copy(whip);
        col.set([c.r, c.g, c.b], (i * sides + j) * 3);
      }
    }
    const idx: number[] = [];
    for (let i = 0; i < segs; i++) {
      for (let j = 0; j < sides; j++) {
        const a = i * sides + j, b = i * sides + ((j + 1) % sides), cc = (i + 1) * sides + j, d = (i + 1) * sides + ((j + 1) % sides);
        idx.push(a, cc, b, b, cc, d);
      }
    }
    const geo = new THREE.BufferGeometry();
    this.posA = new THREE.BufferAttribute(this.pos, 3);
    this.posA.setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('position', this.posA);
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    geo.setIndex(idx);
    this.mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide }));
    this.mesh.frustumCulled = false;
    this.mesh.visible = false;
  }

  /** The rope from a to b; `sag` (m) drops its middle, `wave` (m) swings it sideways in a wave moving along it (`phase`). */
  set(ax: number, ay: number, az: number, bx: number, by: number, bz: number, u0: number, u1: number, sag: number, wave: number, phase: number) {
    if (u1 - u0 < 0.004) { this.mesh.visible = false; return; }
    this.mesh.visible = true;
    const S = this.segs, K = this.sides, m = this.mid;
    const dx = bx - ax, dz = bz - az, len = Math.hypot(dx, dz) || 1;
    const px = -dz / len, pz = dx / len;
    for (let i = 0; i <= S; i++) {
      const u = u0 + ((u1 - u0) * i) / S, s = Math.sin(Math.PI * u);
      const side = wave * s * Math.sin(u * 11 - phase);
      m[i * 3] = ax + dx * u + px * side;
      m[i * 3 + 1] = ay + (by - ay) * u - sag * 4 * u * (1 - u);
      m[i * 3 + 2] = az + dz * u + pz * side;
    }
    for (let i = 0; i <= S; i++) {
      const i0 = Math.max(0, i - 1), i1 = Math.min(S, i + 1);
      let tx = m[i1 * 3] - m[i0 * 3], ty = m[i1 * 3 + 1] - m[i0 * 3 + 1], tz = m[i1 * 3 + 2] - m[i0 * 3 + 2];
      const tl = Math.hypot(tx, ty, tz) || 1; tx /= tl; ty /= tl; tz /= tl;
      // side = tangent x up, up2 = side x tangent
      let sx = tz, sz = -tx; const sl = Math.hypot(sx, sz) || 1; sx /= sl; sz /= sl;
      const ux = sz * ty, uy = sz * tx - sx * tz, uz = -sx * ty;
      for (let j = 0; j < K; j++) {
        const a = (j / K) * Math.PI * 2 + i * 0.5, ca = Math.cos(a) * this.radius, sa = Math.sin(a) * this.radius;
        const o = (i * K + j) * 3;
        this.pos[o] = m[i * 3] + sx * ca + ux * sa;
        this.pos[o + 1] = m[i * 3 + 1] + uy * sa;
        this.pos[o + 2] = m[i * 3 + 2] + sz * ca + uz * sa;
      }
    }
    this.posA.needsUpdate = true;
  }
}

// ---------------------------------------------------------------------------------------------------------------
// The harpoon and what it etches on the ice.
// ---------------------------------------------------------------------------------------------------------------

/**
 * One carved harpoon, tip at the origin and the shaft running back along -Z (about 1.6 long): an ivory diamond head with two
 * barbs, a black socket with a teal inlay, an ivory shaft banded and chevron-etched in black, a black knob and an eye at the
 * tail where the rope is tied. Vertex colours.
 */
export function harpoonGeometry(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  const Y = new THREE.Vector3(0, 1, 0), m = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), s = new THREE.Vector3(1, 1, 1);
  const add = (g: THREE.BufferGeometry, hex: string) => {
    g.deleteAttribute('uv');
    g.deleteAttribute('normal');
    const c = new THREE.Color(hex), n = g.attributes.position.count, a = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b; }
    g.setAttribute('color', new THREE.BufferAttribute(a, 3));
    parts.push(g);
  };
  /** A cylinder along Z from z0 to z1. */
  const rod = (r0: number, r1: number, z0: number, z1: number, seg: number, hex: string, flat = 1) => {
    const g = new THREE.CylinderGeometry(r1, r0, Math.abs(z1 - z0), seg).rotateX(Math.PI / 2);
    g.scale(1, flat, 1);
    g.translate(0, 0, (z0 + z1) / 2);
    add(g, hex);
  };
  // head: a flat diamond, tip at z = 0
  const head = new THREE.ConeGeometry(0.115, 0.55, 4).rotateY(Math.PI / 4).rotateX(Math.PI / 2);
  head.scale(1, 0.4, 1);
  head.translate(0, 0, -0.275);
  add(head, '#f1e8d2');
  // barbs, swept back and out
  for (const sx of [-1, 1]) {
    const d = new THREE.Vector3(sx * 0.5, 0, -0.85).normalize();
    q.setFromUnitVectors(Y, d);
    p.set(sx * 0.12, 0, -0.5);
    const b = new THREE.ConeGeometry(0.05, 0.34, 4).translate(0, 0.17, 0);
    b.applyMatrix4(m.compose(p, q, s));
    b.scale(1, 0.55, 1);
    add(b, '#dccfae');
  }
  rod(0.085, 0.085, -0.5, -0.62, 8, '#17151a');
  rod(0.09, 0.09, -0.62, -0.68, 8, '#4fb3c4');
  rod(0.078, 0.078, -0.68, -1.47, 8, '#e9dec2');
  // etched bands and chevrons on the shaft
  for (let i = 0; i < 3; i++) rod(0.086, 0.086, -0.86 - i * 0.22, -0.885 - i * 0.22, 8, '#17151a');
  for (let i = 0; i < 5; i++) {
    for (const sx of [-1, 1]) {
      const b = new THREE.BoxGeometry(0.09, 0.02, 0.018);
      b.rotateY(sx * 0.6);
      b.translate(sx * 0.035, 0.079, -0.93 - i * 0.13);
      add(b, '#17151a');
    }
  }
  const knob = new THREE.SphereGeometry(0.1, 8, 6).translate(0, 0, -1.5);
  add(knob, '#17151a');
  const eye = new THREE.TorusGeometry(0.085, 0.022, 5, 10).rotateY(Math.PI / 2).translate(0, 0.1, -1.42);
  add(eye, '#4fb3c4');
  return mergeParts(parts);
}

/**
 * Scrimshaw on the ice: ink lines scratched into the floor in rings (a wavy line, a line of scallops, hatching, a dashed ring), each
 * with a pale scratch beside it, drawn as if by a pen that goes round once (`draw` 0..1 from `start`), with a teal glow while fresh.
 */
export class EtchedWaves {
  readonly mesh: THREE.Mesh;
  private mat: THREE.ShaderMaterial;

  constructor(radius = 2.5) {
    this.mat = onFloor(new THREE.ShaderMaterial({
      transparent: true, depthWrite: false,
      uniforms: {
        uDraw: { value: 0 }, uStart: { value: 0 }, uFade: { value: 0 }, uFresh: { value: 0 }, uR: { value: radius },
        uInk: { value: new THREE.Color('#14121a') }, uIvory: { value: new THREE.Color('#efe6cf') }, uTeal: { value: new THREE.Color('#4fb3c4') },
      },
      vertexShader: /* glsl */ `varying vec2 vP; void main() { vP = position.xz; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: /* glsl */ `
        varying vec2 vP; uniform float uDraw; uniform float uStart; uniform float uFade; uniform float uFresh; uniform float uR;
        uniform vec3 uInk; uniform vec3 uIvory; uniform vec3 uTeal;
        float ln(float rr, float w) { return smoothstep(w, w * 0.3, abs(rr)); }
        float halo(float rr, float w) { return smoothstep(w * 3.2, w * 1.1, abs(rr - 0.045)); }
        void main() {
          float r = length(vP);
          float ang = atan(vP.y, vP.x);
          float a01 = fract((ang - uStart) / 6.28318 + 1.0);
          float vis = step(a01, uDraw);
          float pen = smoothstep(0.035, 0.0, abs(a01 - uDraw)) * step(uDraw, 0.995) * step(0.001, uDraw);
          float w = 0.045;
          float rr0 = r - 0.55 + 0.04 * sin(ang * 9.0 + 1.0);
          float rr1 = r - 1.05 + 0.1 * sin(ang * 7.0);
          float rr2 = r - 1.62 + 0.13 * abs(sin(ang * 5.0)) - 0.06;
          float rr3 = r - 2.18;
          float dash = step(0.45, fract(ang * 16.0 / 6.28318));
          float tick = step(0.7, fract(ang * 24.0 / 6.28318)) * step(0.68, r) * step(r, 0.92);
          float tick2 = step(0.62, fract(ang * 20.0 / 6.28318 + 0.3)) * step(1.2, r) * step(r, 1.4);
          float ink = max(max(ln(rr0, w), ln(rr1, w * 1.1)), max(ln(rr2, w * 1.1), ln(rr3, w * 0.8) * dash));
          ink = max(ink, max(tick, tick2) * 0.9);
          float pale = max(max(halo(rr0, w), halo(rr1, w * 1.1)), max(halo(rr2, w * 1.1), halo(rr3, w * 0.8) * dash)) * (1.0 - ink);
          float frost = smoothstep(uR, 0.4, r) * 0.16;
          vec3 col = uIvory; float al = frost + pale * 0.5;
          vec3 inkc = mix(uInk, uTeal, uFresh * 0.85);
          col = mix(col, inkc, ink); al = max(al, ink * 0.88);
          col = mix(col, uTeal, pen); al = max(al, pen * 0.9);
          gl_FragColor = vec4(col, al * vis * uFade * step(r, uR));
          ${TAIL}
        }`,
    }));
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(radius * 2, radius * 2).rotateX(-Math.PI / 2), this.mat);
    this.mesh.renderOrder = 3;
    this.mesh.visible = false;
  }

  set(x: number, z: number, start: number, draw: number, fresh: number, fade: number) {
    this.mesh.visible = fade > 0.01 && draw > 0.001;
    this.mesh.position.set(x, 0.03, z);
    const u = this.mat.uniforms;
    u.uStart.value = start; u.uDraw.value = draw; u.uFresh.value = fresh; u.uFade.value = fade;
  }
}
