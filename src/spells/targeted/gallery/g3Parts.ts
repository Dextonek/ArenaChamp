import * as THREE from 'three';
import { clamp01, hash } from '../../../heroes/sheath/partsBig';

/**
 * Gallery group 3 (pipeline/designs/gallery-20.md): the pieces of Mosaic Nova (Byzantine gold tesserae, lapis, porphyry) and
 * Mandala Unbinding (Tibetan coloured sand). Nothing here makes a three.js object when the file is loaded: every piece is a
 * class, made by its look's constructor. No dice: `hash` of an index. Every shader ends with the colour-space and tone-mapping
 * includes, so it matches the basic materials.
 */

/** Byzantine mosaic: lapis is the dark layer, gold the one accent, marble the pale foil, porphyry a spice, hot the sparse core. */
export const MOSAIC = {
  gold: '#e3b030',
  gold2: '#b98414',
  lapis: '#1a3a9c',
  lapisDeep: '#0e2263',
  porphyry: '#8a2433',
  marble: '#f0e6cb',
  grout: '#a59a7e',
  hot: '#fff1b8',
};

/** Coloured sand: saffron the accent, lapis the dark layer, white sand the foil, vermilion the spice. */
export const SAND = {
  saffron: '#eda21a',
  vermilion: '#cc3520',
  lapis: '#1d3f9e',
  white: '#e4ddcc',
  dark: '#15110d',
  hot: '#fff4cf',
};

const TAIL = /* glsl */ `#include <tonemapping_fragment>\n#include <colorspace_fragment>`;
const GLSL_HASH = /* glsl */ `float h2(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }`;

/** A flat material that does not z-fight the floor. */
const onFloor = <M extends THREE.Material>(m: M): M => { m.polygonOffset = true; m.polygonOffsetFactor = -2; m.polygonOffsetUnits = -2; return m; };

const FLOOR_VERT = /* glsl */ `varying vec2 vP; void main() { vP = position.xz; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;

// ---------------------------------------------------------------------------------------------------------------
// Mosaic nova.
// ---------------------------------------------------------------------------------------------------------------

/**
 * A floor of square tesserae between two radii round a centre: tiles in rings of gold and lapis, some porphyry and marble, pale
 * grout between them. `cut` (0..1) takes the tiles away, the near ones last (they have lifted off); `rim` lights the outer edge
 * with the hot colour and the foil.
 */
export class MosaicFloor {
  readonly mesh: THREE.Mesh;
  private mat: THREE.ShaderMaterial;

  constructor(half: number) {
    this.mat = onFloor(new THREE.ShaderMaterial({
      transparent: true, depthWrite: false,
      uniforms: {
        uR0: { value: 0 }, uR1: { value: 0 }, uAlpha: { value: 0 }, uRim: { value: 0 }, uCut: { value: 0 },
        uGold: { value: new THREE.Color(MOSAIC.gold) }, uGold2: { value: new THREE.Color(MOSAIC.gold2) },
        uLapis: { value: new THREE.Color(MOSAIC.lapis) }, uDeep: { value: new THREE.Color(MOSAIC.lapisDeep) },
        uPorph: { value: new THREE.Color(MOSAIC.porphyry) }, uMarble: { value: new THREE.Color(MOSAIC.marble) },
        uGrout: { value: new THREE.Color(MOSAIC.grout) }, uHot: { value: new THREE.Color(MOSAIC.hot) },
      },
      vertexShader: FLOOR_VERT,
      fragmentShader: /* glsl */ `
        varying vec2 vP;
        uniform float uR0; uniform float uR1; uniform float uAlpha; uniform float uRim; uniform float uCut;
        uniform vec3 uGold; uniform vec3 uGold2; uniform vec3 uLapis; uniform vec3 uDeep; uniform vec3 uPorph;
        uniform vec3 uMarble; uniform vec3 uGrout; uniform vec3 uHot;
        ${GLSL_HASH}
        void main() {
          float r = length(vP);
          float band = smoothstep(uR0 - 0.04, uR0 + 0.06, r) * (1.0 - smoothstep(uR1 - 0.06, uR1 + 0.01, r));
          if (band < 0.01 || uAlpha < 0.005) discard;
          vec2 g = vP / 0.27;
          vec2 id = floor(g), f = fract(g);
          float hh = h2(id), h3 = h2(id + 17.3);
          // a tile is gone once it has lifted: the near ones last
          if (hh * 0.55 + smoothstep(0.0, 2.4, r) * 0.45 < uCut) discard;
          float edge = min(min(f.x, 1.0 - f.x), min(f.y, 1.0 - f.y));
          float tile = smoothstep(0.05, 0.13, edge);
          float ring = floor(r / 0.54);
          float odd = mod(ring, 2.0);
          vec3 col = odd < 0.5 ? mix(uGold, uGold2, h3 * 0.7) : mix(uLapis, uDeep, h3);
          col = hh > 0.93 ? uMarble : hh > 0.82 ? uPorph : col;
          col *= 0.86 + 0.3 * (f.x * 0.4 + f.y * 0.6) + 0.1 * (h3 - 0.5);
          float rimK = smoothstep(uR1 - 0.5, uR1 - 0.04, r) * uRim;
          col = mix(col, uHot, rimK * 0.55 * tile);
          vec3 outc = mix(uGrout, col, tile);
          outc = mix(outc, uMarble, rimK * (1.0 - tile) * 0.8);
          gl_FragColor = vec4(outc, band * uAlpha * mix(0.6, 0.96, tile));
          ${TAIL}
        }`,
    }));
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(half * 2, half * 2).rotateX(-Math.PI / 2), this.mat);
    this.mesh.renderOrder = 2;
    this.mesh.frustumCulled = false;
    this.mesh.visible = false;
  }

  set(x: number, z: number, r0: number, r1: number, alpha: number, rim: number, cut: number) {
    this.mesh.visible = alpha > 0.005 && r1 > r0 + 0.01;
    this.mesh.position.set(x, 0.03, z);
    const u = this.mat.uniforms;
    u.uR0.value = r0;
    u.uR1.value = r1;
    u.uAlpha.value = alpha;
    u.uRim.value = rim;
    u.uCut.value = cut;
  }
}

/**
 * Instanced tesserae (flat square tiles with a dark edge), shaded in code from the way each one faces so that they glitter as they
 * turn: gold and marble flash, lapis stays deep. One colour each, fixed at the start.
 */
export class TileSwarm {
  readonly mesh: THREE.InstancedMesh;
  private base: Float32Array;
  private gleam: Float32Array;
  private m = new THREE.Matrix4();
  private q = new THREE.Quaternion();
  private e = new THREE.Euler(0, 0, 0, 'YXZ');
  private p = new THREE.Vector3();
  private s = new THREE.Vector3();
  private n = new THREE.Vector3();
  private hot = new THREE.Color(MOSAIC.hot);
  private light = new THREE.Vector3(0.35, 0.85, 0.4).normalize();
  private half = new THREE.Vector3(0.05, 1.0, 0.55).normalize();

  constructor(private count: number) {
    const geo = new THREE.BoxGeometry(1, 0.3, 1);
    // the top is bright, the sides darker, the underside darkest
    const shade = [0.6, 0.6, 1, 0.32, 0.7, 0.7], col = new Float32Array(24 * 3);
    for (let f = 0; f < 6; f++) for (let v = 0; v < 4; v++) col.fill(shade[f], (f * 4 + v) * 3, (f * 4 + v) * 3 + 3);
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    this.mesh = new THREE.InstancedMesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true }), count);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 4;
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.base = new Float32Array(count * 3);
    this.gleam = new Float32Array(count);
    const pal = [MOSAIC.gold, MOSAIC.gold2, MOSAIC.lapis, MOSAIC.lapisDeep, MOSAIC.porphyry, MOSAIC.marble];
    const c = new THREE.Color();
    for (let i = 0; i < count; i++) {
      const r = hash(i * 3.7 + 11);
      // gold 44 %, lapis 32 %, marble 14 %, porphyry 10 %
      const k = r < 0.26 ? 0 : r < 0.44 ? 1 : r < 0.62 ? 2 : r < 0.76 ? 3 : r < 0.86 ? 4 : 5;
      c.set(pal[k]);
      this.base.set([c.r, c.g, c.b], i * 3);
      this.gleam[i] = k < 2 ? 1 : k === 5 ? 0.8 : k === 4 ? 0.3 : 0.2;
      this.mesh.setColorAt(i, c);
    }
    this.mesh.count = 0;
  }

  hide() {
    this.mesh.count = 0;
  }

  /** Tile `i` at (x, y, z), turned (yaw `ey`, lean `ex`, roll `ez`), `size` m across; the first call of a frame shows them all. */
  place(i: number, x: number, y: number, z: number, ex: number, ey: number, ez: number, size: number) {
    this.mesh.count = this.count;
    this.e.set(ex, ey, ez);
    this.q.setFromEuler(this.e);
    this.p.set(x, y, z);
    this.s.set(size, size, size);
    this.m.compose(this.p, this.q, this.s);
    this.mesh.setMatrixAt(i, this.m);
    this.n.set(0, 1, 0).applyQuaternion(this.q);
    const lit = 0.62 + 0.45 * Math.max(0, this.n.dot(this.light));
    const g = Math.pow(Math.max(0, this.n.dot(this.half)), 26) * this.gleam[i];
    const b = i * 3, a = this.mesh.instanceColor!.array as Float32Array;
    a[b] = this.base[b] * lit + this.hot.r * g;
    a[b + 1] = this.base[b + 1] * lit + this.hot.g * g;
    a[b + 2] = this.base[b + 2] * lit + this.hot.b * g;
  }

  commit() {
    this.mesh.instanceMatrix.needsUpdate = true;
    this.mesh.instanceColor!.needsUpdate = true;
  }
}

// ---------------------------------------------------------------------------------------------------------------
// Mandala unbinding.
// ---------------------------------------------------------------------------------------------------------------

/** Radii (m) where the seven rings of the mandala start; the last one ends at `MANDALA_R`. */
export const MANDALA_R = 4;
export const RING_MID = [0.25, 0.72, 1.25, 1.9, 2.52, 3.17, 3.78];

/**
 * The sand mandala on the floor, drawn in a shader: seven rings (a star of white sand, vermilion with white dots, lapis with
 * saffron gates, sixteen petals, a chain of diamonds, a ring of flames, a white rim). `lay` (0..7) lays them from the middle out,
 * ring k round the circle during lay k..k+1, a bright line of sand at the front of the one being laid. `sweep` (0..1) turns the
 * pattern into a spiral and wipes it away from the middle out. `glow` lifts the whole picture; a few grains sparkle.
 */
export class SandMandala {
  readonly mesh: THREE.Mesh;
  private mat: THREE.ShaderMaterial;

  constructor() {
    const half = MANDALA_R + 0.5;
    this.mat = onFloor(new THREE.ShaderMaterial({
      transparent: true, depthWrite: false,
      uniforms: {
        uLay: { value: 0 }, uSweep: { value: 0 }, uAlpha: { value: 1 }, uGlow: { value: 0 }, uTime: { value: 0 },
        uSaffron: { value: new THREE.Color(SAND.saffron) }, uVerm: { value: new THREE.Color(SAND.vermilion) },
        uLapis: { value: new THREE.Color(SAND.lapis) }, uWhite: { value: new THREE.Color(SAND.white) },
        uDark: { value: new THREE.Color(SAND.dark) }, uHot: { value: new THREE.Color(SAND.hot) },
      },
      vertexShader: FLOOR_VERT,
      fragmentShader: /* glsl */ `
        varying vec2 vP;
        uniform float uLay; uniform float uSweep; uniform float uAlpha; uniform float uGlow; uniform float uTime;
        uniform vec3 uSaffron; uniform vec3 uVerm; uniform vec3 uLapis; uniform vec3 uWhite; uniform vec3 uDark; uniform vec3 uHot;
        const float PI = 3.14159265;
        ${GLSL_HASH}
        // sector helper: the angle from the middle of the sector the angle a is in, 0 at the middle
        float sec(float a, float s) { return abs(mod(a, s) - 0.5 * s); }
        vec4 mandala(float r, float a, out float ring) {
          vec4 res = vec4(uDark, 0.78);
          ring = 6.0;
          if (r < 0.5) {
            ring = 0.0;
            float b = 0.15 + 0.33 * pow(abs(cos(a * 4.0)), 4.0);
            res = vec4(r < b ? uWhite : uSaffron, 1.0);
            if (r < 0.07) res = vec4(uVerm, 1.0);
          } else if (r < 0.95) {
            ring = 1.0;
            res = vec4(uVerm, 1.0);
            float S = 2.0 * PI / 12.0, d = mod(a, S) - 0.5 * S;
            if (distance(vec2(r * cos(d), r * sin(d)), vec2(0.73, 0.0)) < 0.085) res = vec4(uWhite, 1.0);
            if (r < 0.54) res = vec4(uSaffron, 1.0);
          } else if (r < 1.55) {
            ring = 2.0;
            float S = 2.0 * PI / 8.0, d = sec(a, S);
            float w = (1.0 - (r - 0.95) / 0.6) * 0.37;
            res = vec4(uLapis, 1.0);
            if (d < w) res = vec4(uSaffron, 1.0);
            if (abs(d - w) < 0.03 && d > 0.0) res = vec4(uWhite, 1.0);
          } else if (r < 2.25) {
            ring = 3.0;
            float S = 2.0 * PI / 16.0, d = sec(a, S);
            float w = 0.5 * S * sin(PI * (r - 1.55) / 0.7) * 0.97;
            float idx = floor(a / S);
            if (d < w) {
              res = vec4(mod(idx, 2.0) < 0.5 ? uSaffron : uVerm, 1.0);
              if (d > w - 0.05) res = vec4(uWhite, 1.0);
            }
          } else if (r < 2.8) {
            ring = 4.0;
            res = vec4(uLapis, 1.0);
            float S = 2.0 * PI / 24.0, d = mod(a, S) - 0.5 * S;
            vec2 q = vec2(r - 2.525, r * d);
            float m = abs(q.x) + abs(q.y);
            if (m < 0.24) res = vec4(uWhite, 1.0);
            if (m < 0.09) res = vec4(uSaffron, 1.0);
          } else if (r < 3.55) {
            ring = 5.0;
            float S = 2.0 * PI / 16.0, k = r - 2.8;
            float d = sec(a - 0.28 * k, S);
            float w = 0.5 * S * (1.0 - k / 0.75);
            if (d < w) {
              res = vec4(uSaffron, 1.0);
              if (d < w * 0.42 && k < 0.5) res = vec4(uVerm, 1.0);
            }
            if (k < 0.04) res = vec4(uSaffron, 1.0);
          } else if (r < MANDALA_R_) {
            ring = 6.0;
            res = vec4(uWhite, 1.0);
            if (r > 3.7 && r < 3.78 && mod(a, 2.0 * PI / 48.0) < 2.0 * PI / 96.0) res = vec4(uLapis, 1.0);
            if (r > 3.9) res = vec4(uSaffron, 1.0);
            if (r < 3.6) res = vec4(uSaffron, 1.0);
          }
          return res;
        }
        void main() {
          float r = length(vP);
          float a = atan(vP.y, vP.x);
          float rc = uSweep * 5.6 - 0.3 * sin(a * 3.0 + uSweep * 7.0) * step(0.001, uSweep);
          if (r > MANDALA_R_ || r < rc || uAlpha < 0.005) discard;
          // the pattern is wound into a spiral as it is swept
          float aw = a - uSweep * 3.0 * (1.0 - clamp(r / MANDALA_R_, 0.0, 1.0));
          float ring;
          vec4 m = mandala(r, aw, ring);
          float lay = clamp(uLay - ring, 0.0, 1.0);
          float ang01 = fract(-a / (2.0 * PI) + 0.25);
          float seen = lay > 0.9995 ? 1.0 : smoothstep(lay, lay - 0.02, ang01) * step(0.0005, lay);
          if (seen < 0.01) discard;
          float line = (lay > 0.001 && lay < 0.999) ? smoothstep(0.045, 0.0, abs(ang01 - lay)) : 0.0;
          float g = h2(floor(vP * 58.0));
          vec3 col = m.rgb * (0.84 + 0.3 * g) * (1.0 + uGlow * 0.5);
          // sparse sparkle of a few grains
          col = mix(col, uHot, step(0.988, g) * step(0.6, sin(uTime * 3.0 + g * 60.0)) * 0.9 * m.a);
          col = mix(col, uHot, line * 0.85);
          // the sweep's front: grains lifting
          float front = smoothstep(0.5, 0.0, r - rc) * step(0.001, uSweep);
          col = mix(col, uWhite, front * 0.25);
          gl_FragColor = vec4(col, seen * uAlpha * max(m.a, line * 0.5));
          ${TAIL}
        }`.replace(/MANDALA_R_/g, MANDALA_R.toFixed(2)),
    }));
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(half * 2, half * 2).rotateX(-Math.PI / 2), this.mat);
    this.mesh.renderOrder = 2;
    this.mesh.frustumCulled = false;
    this.mesh.visible = false;
  }

  set(x: number, z: number, lay: number, sweep: number, alpha: number, glow: number, time: number) {
    this.mesh.visible = alpha > 0.005 && lay > 0.001;
    this.mesh.position.set(x, 0.03, z);
    const u = this.mat.uniforms;
    u.uLay.value = lay;
    u.uSweep.value = sweep;
    u.uAlpha.value = alpha;
    u.uGlow.value = glow;
    u.uTime.value = time;
  }
}

/** The colour (css hex) of the sand at radius r, as the mandala shows it, by the hash of an index. */
export function sandAt(r: number, k: number): string {
  const h = hash(k * 3.3 + 1);
  if (r < 0.5) return h < 0.5 ? SAND.white : SAND.saffron;
  if (r < 0.95) return h < 0.7 ? SAND.vermilion : SAND.white;
  if (r < 1.55) return h < 0.6 ? SAND.lapis : SAND.saffron;
  if (r < 2.25) return h < 0.4 ? SAND.saffron : h < 0.8 ? SAND.vermilion : SAND.white;
  if (r < 2.8) return h < 0.6 ? SAND.lapis : SAND.white;
  if (r < 3.55) return h < 0.7 ? SAND.saffron : SAND.vermilion;
  return h < 0.8 ? SAND.white : SAND.saffron;
}

/**
 * The sand in the wind: `n` grains that lie on the mandala until the sweep passes them (the wipe runs from the middle out, as in
 * `SandMandala`), then rise in a spiral that opens as it climbs, and fade. Positions are worked out each frame from the age of
 * each grain: no state, no allocation.
 */
export class SandWind {
  readonly mesh: THREE.Points;
  private pos: Float32Array;
  private col: THREE.BufferAttribute;
  private posA: THREE.BufferAttribute;
  private r: Float32Array;
  private th: Float32Array;

  constructor(private n: number, size: number) {
    this.pos = new Float32Array(n * 3);
    const rgba = new Float32Array(n * 4);
    this.r = new Float32Array(n);
    this.th = new Float32Array(n);
    const c = new THREE.Color();
    for (let i = 0; i < n; i++) {
      this.r[i] = (MANDALA_R - 0.1) * Math.sqrt(hash(i * 1.9 + 2));
      this.th[i] = hash(i * 2.7 + 5) * Math.PI * 2;
      c.set(sandAt(this.r[i], i));
      rgba.set([c.r, c.g, c.b, 0], i * 4);
    }
    const geo = new THREE.BufferGeometry();
    this.posA = new THREE.BufferAttribute(this.pos, 3);
    this.col = new THREE.BufferAttribute(rgba, 4);
    this.posA.setUsage(THREE.DynamicDrawUsage);
    this.col.setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('position', this.posA);
    geo.setAttribute('color', this.col);
    this.mesh = new THREE.Points(geo, new THREE.PointsMaterial({ size, vertexColors: true, transparent: true, depthWrite: false, sizeAttenuation: true, alphaTest: 0.02 }));
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 5;
    this.hide();
  }

  hide() {
    for (let i = 0; i < this.n; i++) { this.pos[i * 3 + 1] = -50; this.col.setW(i, 0); }
    this.posA.needsUpdate = this.col.needsUpdate = true;
  }

  /** `s`: seconds since the sweep began; the grains are placed round (cx, cz). */
  update(s: number, cx: number, cz: number) {
    for (let i = 0; i < this.n; i++) {
      const r = this.r[i];
      const go = (r / 5.6) * 0.9 - 0.05;       // when the wipe reaches this grain
      const k = s - go;
      const b = i * 3;
      if (k < 0 || k > 1.7) { this.pos[b + 1] = -50; this.col.setW(i, 0); continue; }
      const hh = hash(i * 4.1 + 7);
      const spin = this.th[i] + 3.0 * (1.0 - Math.exp(-k * 1.3)) * (1.4 - r / 6) + k * (1.2 + hh);
      const rad = r + 2.8 * (1 - Math.exp(-k * 1.15)) * (0.6 + 0.8 * hh);
      this.pos[b] = cx + Math.cos(spin) * rad;
      this.pos[b + 1] = 0.08 + (1.2 + 2.2 * hh) * (1 - Math.exp(-k * 1.5)) + 0.25 * Math.sin(k * 6 + i);
      this.pos[b + 2] = cz + Math.sin(spin) * rad;
      this.col.setW(i, (k < 0.08 ? k / 0.08 : 1) * (1 - clamp01((k - 0.9) / 0.8)));
    }
    this.posA.needsUpdate = this.col.needsUpdate = true;
  }
}

/**
 * The wind that sweeps the mandala: an open funnel (wide at the floor, narrow above) painted with two spiral arms of pale sand
 * and saffron that turn as it opens. `grow` (0..1) is how high it has risen, `fade` its opacity.
 */
export class Vortex {
  readonly mesh: THREE.Mesh;
  private mat: THREE.ShaderMaterial;

  constructor() {
    this.mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, side: THREE.DoubleSide,
      uniforms: {
        uGrow: { value: 0 }, uFade: { value: 0 }, uTime: { value: 0 },
        uWhite: { value: new THREE.Color(SAND.white) }, uSaffron: { value: new THREE.Color(SAND.saffron) },
      },
      vertexShader: /* glsl */ `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: /* glsl */ `
        varying vec2 vUv; uniform float uGrow; uniform float uFade; uniform float uTime; uniform vec3 uWhite; uniform vec3 uSaffron;
        ${GLSL_HASH}
        void main() {
          float y = 1.0 - vUv.y; // 0 at the floor, 1 at the top
          if (y > uGrow) discard;
          float ph = fract(vUv.x * 2.0 + y * 1.5 - uTime * 0.9);
          float arm = smoothstep(0.0, 0.07, ph) * (1.0 - smoothstep(0.18, 0.46, ph));
          float grit = h2(floor(vec2(vUv.x * 240.0, y * 100.0 - uTime * 8.0)));
          float a = arm * (0.25 + 0.75 * step(0.5, grit)) * (1.0 - smoothstep(uGrow - 0.25, uGrow, y)) * (1.0 - y * 0.5) * uFade;
          vec3 col = mix(uSaffron, uWhite, smoothstep(0.1, 0.4, arm) * (0.45 + 0.55 * grit));
          gl_FragColor = vec4(col, a * 0.5);
          ${TAIL}
        }`,
    });
    this.mesh = new THREE.Mesh(new THREE.CylinderGeometry(1.3, 4.5, 3.4, 56, 1, true).translate(0, 1.7, 0), this.mat);
    this.mesh.renderOrder = 6;
    this.mesh.frustumCulled = false;
    this.mesh.visible = false;
  }

  set(x: number, z: number, grow: number, fade: number, time: number) {
    this.mesh.visible = fade > 0.004 && grow > 0.01;
    this.mesh.position.set(x, 0, z);
    const u = this.mat.uniforms;
    u.uGrow.value = grow;
    u.uFade.value = fade;
    u.uTime.value = time;
  }
}
