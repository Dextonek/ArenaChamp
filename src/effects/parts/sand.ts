import * as THREE from 'three';

/**
 * The sand kit (pipeline/designs/kit-sand.md): sand that flows like a ribbon and sets like stone. Ochre ribbons (lit
 * band, dark underside, grains streaming off the trailing edge), pale carved sandstone with dark incised glyphs as the
 * foil, small toon dust puffs. Everything is pooled, takes world-space positions and has a `reset()`. All materials
 * are custom toon shaders with values below the bloom threshold (~0.85) except a few tiny core dots.
 */

/** Palette (`SAND_CSS` for APIs that want a string). `stone` is the pale foil (carved sandstone). */
export const SAND = {
  core: 0xfff6dc,
  hot: 0xffd27a,
  body: 0xc8913f,
  accent: 0x3fd4c8,
  dark: 0x2a1a0c,
  stone: 0xe8d8b4,
} as const;

export const SAND_CSS = {
  core: '#fff6dc',
  hot: '#ffd27a',
  body: '#c8913f',
  accent: '#3fd4c8',
  dark: '#2a1a0c',
  stone: '#e8d8b4',
} as const;

const UP = new THREE.Vector3(0, 1, 0);
const MIN_SCALE = 1e-4;
const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const easeOut = (x: number) => 1 - Math.pow(1 - clamp01(x), 3);

function sandUniforms() {
  return {
    uBody: { value: new THREE.Color(SAND.body) },
    uDark: { value: new THREE.Color(SAND.dark) },
    uHot: { value: new THREE.Color(SAND.hot) },
    uCore: { value: new THREE.Color(SAND.core) },
    uStone: { value: new THREE.Color(SAND.stone) },
    uAccent: { value: new THREE.Color(SAND.accent) },
  };
}

// ---------------------------------------------------------------------------------------------------------------
// Carved glyphs (canvas, channel-coded: green = incised line, red = stone, blue adds the shaded lip)
// ---------------------------------------------------------------------------------------------------------------

/** One chunky angular glyph centred on the origin, about `s` tall. Stroke style and width are set by the caller. */
function drawGlyph(g: CanvasRenderingContext2D, kind: number, s: number) {
  const h = s / 2;
  g.beginPath();
  switch (kind % 7) {
    case 0: // eye
      g.moveTo(-h, 0); g.lineTo(0, -h * 0.55); g.lineTo(h, 0); g.lineTo(0, h * 0.55); g.closePath();
      g.moveTo(0, -h * 0.12); g.lineTo(0, h * 0.12);
      g.moveTo(-h * 0.5, h * 0.9); g.lineTo(h * 0.5, h * 0.9);
      break;
    case 1: // waves
      for (let i = -1; i <= 1; i++) {
        g.moveTo(-h, i * h * 0.55); g.lineTo(-h * 0.5, i * h * 0.55 - h * 0.28); g.lineTo(0, i * h * 0.55); g.lineTo(h * 0.5, i * h * 0.55 - h * 0.28); g.lineTo(h, i * h * 0.55);
      }
      break;
    case 2: // ankh
      g.moveTo(0, -h * 0.2); g.lineTo(h * 0.35, -h * 0.55); g.lineTo(0, -h); g.lineTo(-h * 0.35, -h * 0.55); g.closePath();
      g.moveTo(0, -h * 0.2); g.lineTo(0, h);
      g.moveTo(-h * 0.55, h * 0.15); g.lineTo(h * 0.55, h * 0.15);
      break;
    case 3: // steps
      g.moveTo(-h, h); g.lineTo(-h, h * 0.35); g.lineTo(-h * 0.4, h * 0.35); g.lineTo(-h * 0.4, -h * 0.3); g.lineTo(h * 0.2, -h * 0.3);
      g.lineTo(h * 0.2, -h); g.lineTo(h, -h);
      break;
    case 4: // bird
      g.moveTo(-h, -h * 0.5); g.lineTo(0, h * 0.2); g.lineTo(h, -h * 0.5);
      g.moveTo(0, h * 0.2); g.lineTo(0, h);
      g.moveTo(-h * 0.35, h); g.lineTo(h * 0.35, h);
      break;
    case 5: // staff with a forked head
      g.moveTo(0, h); g.lineTo(0, -h * 0.2);
      g.moveTo(-h * 0.45, -h); g.lineTo(0, -h * 0.2); g.lineTo(h * 0.45, -h);
      break;
    default: // stacked bars
      for (let i = -1; i <= 1; i++) { g.moveTo(-h * (0.9 - Math.abs(i) * 0.3), i * h * 0.6); g.lineTo(h * (0.9 - Math.abs(i) * 0.3), i * h * 0.6); }
      break;
  }
  g.stroke();
}

let tabletTex: THREE.CanvasTexture | null = null;

/** 256 px stone tablet: a border groove and three rows of glyphs (G channel). Tiles every ~1.8 world units. */
function getTabletTexture() {
  if (tabletTex) return tabletTex;
  const S = 256;
  const cv = document.createElement('canvas');
  cv.width = cv.height = S;
  const g = cv.getContext('2d')!;
  g.fillStyle = '#000000';
  g.fillRect(0, 0, S, S);
  g.lineCap = 'butt';
  g.lineJoin = 'miter';
  g.strokeStyle = '#00ff00';
  g.lineWidth = 9;
  g.strokeRect(10, 10, S - 20, S - 20);
  let seed = 7;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  g.lineWidth = 10;
  for (let row = 0; row < 3; row++) {
    for (let i = 0; i < 4; i++) {
      g.save();
      g.translate(32 + i * 64, 52 + row * 76);
      drawGlyph(g, Math.floor(rnd() * 7), 38);
      g.restore();
    }
  }
  tabletTex = new THREE.CanvasTexture(cv);
  tabletTex.colorSpace = THREE.NoColorSpace;
  tabletTex.wrapS = tabletTex.wrapT = THREE.RepeatWrapping;
  tabletTex.anisotropy = 8;
  return tabletTex;
}

const ringTextures: [THREE.CanvasTexture | null, THREE.CanvasTexture | null] = [null, null];

/** The glyph ring: a wide stone band (0.72..0.97 of the radius) with a row of carved glyphs; optional sun disc inside. */
function drawGlyphRing(centre: boolean): HTMLCanvasElement {
  const S = 1024, C = S / 2;
  const cv = document.createElement('canvas');
  cv.width = cv.height = S;
  const g = cv.getContext('2d')!;
  g.lineCap = 'butt';
  g.lineJoin = 'miter';
  const STONE = '#ff0000', SHADE = '#ff00ff', CUT = '#00ff00';
  const circle = (r: number, lw: number, col: string) => { g.strokeStyle = col; g.lineWidth = lw; g.beginPath(); g.arc(C, C, r, 0, Math.PI * 2); g.stroke(); };
  // The band, with a shaded lip on both edges (a step in the stone).
  circle(C * 0.845, C * 0.25, STONE);
  circle(C * 0.725, 14, SHADE);
  circle(C * 0.965, 14, SHADE);
  circle(C * 0.99, 7, STONE);
  // Divider cuts and glyph stamps along the band.
  g.strokeStyle = CUT;
  g.lineWidth = 12;
  const slots = 24;
  for (let i = 0; i < slots; i++) {
    const a = (i / slots) * Math.PI * 2;
    g.beginPath();
    g.moveTo(C + Math.cos(a) * C * 0.75, C + Math.sin(a) * C * 0.75);
    g.lineTo(C + Math.cos(a) * C * 0.94, C + Math.sin(a) * C * 0.94);
    g.stroke();
  }
  let seed = 31;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  g.lineWidth = 13;
  for (let i = 0; i < slots; i++) {
    const a = ((i + 0.5) / slots) * Math.PI * 2;
    g.save();
    g.translate(C + Math.cos(a) * C * 0.845, C + Math.sin(a) * C * 0.845);
    g.rotate(a + Math.PI / 2);
    drawGlyph(g, Math.floor(rnd() * 7), 70);
    g.restore();
  }
  if (centre) {
    circle(C * 0.2, 16, STONE);
    circle(C * 0.12, 12, CUT);
    g.strokeStyle = STONE;
    g.lineWidth = 22;
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      g.beginPath();
      g.moveTo(C + Math.cos(a) * C * 0.26, C + Math.sin(a) * C * 0.26);
      g.lineTo(C + Math.cos(a) * C * (i % 2 ? 0.4 : 0.52), C + Math.sin(a) * C * (i % 2 ? 0.4 : 0.52));
      g.stroke();
    }
  }
  return cv;
}

// ---------------------------------------------------------------------------------------------------------------
// SandRibbon
// ---------------------------------------------------------------------------------------------------------------

/** Ribbon: lit band on top, ochre middle, dark underside; grain speckle and bright flow lines scroll along it. */
function ribbonMaterial() {
  return new THREE.ShaderMaterial({
    side: THREE.DoubleSide,
    uniforms: { ...sandUniforms(), uTime: { value: 0 }, uSet: { value: 0 } },
    vertexShader: /* glsl */ `
      attribute float aLen;
      varying vec3 vN; varying vec3 vNv; varying vec2 vUv; varying float vL;
      void main() {
        vUv = uv; vL = aLen;
        vN = normalize(mat3(modelMatrix) * normal);
        vNv = normalize(normalMatrix * normal);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uBody, uDark, uHot, uCore, uStone, uAccent; uniform float uTime, uSet;
      varying vec3 vN; varying vec3 vNv; varying vec2 vUv; varying float vL;
      float h1(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      void main() {
        vec3 n = normalize(vN), nv = normalize(vNv);
        if (!gl_FrontFacing) { n = -n; nv = -nv; }
        float f = 1.0 - abs(nv.z);
        float up = n.y;
        vec3 col = uBody;
        // Ochre over most of the width, a thin sunlit crest on top, a dark shadow edge and underside.
        col *= 0.92;
        col = mix(col, uHot * 0.9, step(0.9, up));
        col = mix(col, uDark * 2.2, smoothstep(0.35, 0.05, up) * 0.75);
        col = mix(col, uDark * 1.5, step(up, -0.2));
        // Grains: a coarse speckle that scrolls with the flow (dark and light), and a faint flow line.
        float g = h1(floor(vec2(vUv.x * 7.0 - uTime * 5.0, vUv.y * 12.0)));
        col = mix(col, uHot * 0.9, step(0.9, g) * 0.8 * step(-0.2, up));
        col = mix(col, uDark * 2.0, step(g, 0.22) * 0.7);
        float flow = sin(vUv.x * 3.2 - uTime * 4.0 + sin(vUv.y * 6.2832) * 1.6);
        col = mix(col, uHot * 0.85, step(0.95, flow) * 0.35 * step(0.5, up));
        // Set into stone: three flat tones and dark incised bands across the length.
        float ndl = dot(n, normalize(vec3(-0.45, 0.65, 0.6)));
        vec3 st = ndl > 0.4 ? uStone * 0.95 : (ndl > -0.1 ? uStone * 0.76 : uStone * 0.55);
        st = mix(st, uDark * 1.3, step(0.88, fract(vUv.x * 2.3)) * 0.75);
        col = mix(col, st, uSet);
        if (f > 0.8) col = uDark;
        gl_FragColor = vec4(col, 1.0);
      }`,
  });
}

interface Grain { live: boolean; pos: THREE.Vector3; vel: THREE.Vector3; age: number; life: number; size: number; hot: number }

/**
 * A thick flowing band of sand along a curve. `setFunction(fn, width, head, tail, time)` draws it along fn(u, out)
 * (u 0..1) between `tail` and `head` (call it every frame; both ends taper to a point); `setPath(points, ...)` does the
 * same along a Catmull-Rom curve through world points. `stone` (0..1) sets it into carved sandstone. Grains shed from
 * the trailing end while it is visible: call `update(dt)` every frame. `hide()` / `reset()` hide it. Add `mesh`.
 */
export class SandRibbon {
  readonly mesh = new THREE.Group();
  /** Grains shed per second from the trailing end (0 = none). */
  shed = 26;
  private tube: THREE.Mesh;
  private mat: THREE.ShaderMaterial;
  private geo = new THREE.BufferGeometry();
  private pos: Float32Array;
  private nrm: Float32Array;
  private uv: Float32Array;
  private len: Float32Array;
  private segs: number;
  private sides: number;
  private c: THREE.Vector3[] = [];
  private T: THREE.Vector3[] = [];
  private L: Float32Array;
  private B = new THREE.Vector3();
  private N = new THREE.Vector3();
  private prevB = new THREE.Vector3(1, 0, 0);
  private tailPos = new THREE.Vector3();
  private active = false;
  private acc = 0;
  private grains: Grain[] = [];
  private gMesh: THREE.InstancedMesh;
  private cursor = 0;
  private m = new THREE.Matrix4();
  private q = new THREE.Quaternion();
  private s = new THREE.Vector3();
  private col = new THREE.Color();
  private cHot = new THREE.Color(SAND.hot);
  private cBody = new THREE.Color(SAND.body);

  constructor(segments = 26, sides = 8, maxGrains = 18) {
    this.segs = segments;
    this.sides = sides;
    const rings = segments + 1;
    this.L = new Float32Array(rings);
    for (let i = 0; i < rings; i++) { this.c.push(new THREE.Vector3()); this.T.push(new THREE.Vector3()); }
    const index: number[] = [];
    for (let i = 0; i < segments; i++) {
      for (let j = 0; j < sides; j++) {
        const a = i * sides + j, b = i * sides + ((j + 1) % sides), c = a + sides, d = b + sides;
        index.push(a, c, b, b, c, d);
      }
    }
    this.pos = new Float32Array(rings * sides * 3);
    this.nrm = new Float32Array(rings * sides * 3);
    this.uv = new Float32Array(rings * sides * 2);
    this.len = new Float32Array(rings * sides);
    this.geo.setIndex(index);
    this.geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    this.geo.setAttribute('normal', new THREE.BufferAttribute(this.nrm, 3).setUsage(THREE.DynamicDrawUsage));
    this.geo.setAttribute('uv', new THREE.BufferAttribute(this.uv, 2).setUsage(THREE.DynamicDrawUsage));
    this.geo.setAttribute('aLen', new THREE.BufferAttribute(this.len, 1).setUsage(THREE.DynamicDrawUsage));
    this.mat = ribbonMaterial();
    this.tube = new THREE.Mesh(this.geo, this.mat);
    this.tube.frustumCulled = false;
    this.tube.visible = false;
    this.mesh.add(this.tube);
    this.gMesh = new THREE.InstancedMesh(new THREE.TetrahedronGeometry(0.5), new THREE.MeshBasicMaterial(), maxGrains);
    this.gMesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(maxGrains * 3), 3);
    this.gMesh.frustumCulled = false;
    this.gMesh.count = 0;
    this.mesh.add(this.gMesh);
    for (let i = 0; i < maxGrains; i++) {
      this.grains.push({ live: false, pos: new THREE.Vector3(), vel: new THREE.Vector3(), age: 0, life: 0.6, size: 0.1, hot: 0 });
    }
  }

  get stone() { return this.mat.uniforms.uSet.value as number; }
  set stone(v: number) { this.mat.uniforms.uSet.value = clamp01(v); }

  hide() {
    this.tube.visible = false;
    this.active = false;
  }

  setPath(points: THREE.Vector3[], width: number, head = 1, tail = 0, time = 0) {
    const curve = new THREE.CatmullRomCurve3(points);
    this.setFunction((u, out) => curve.getPoint(u, out), width, head, tail, time);
  }

  setFunction(fn: (u: number, out: THREE.Vector3) => THREE.Vector3, width: number, head = 1, tail = 0, time = 0) {
    if (head - tail < 1e-3 || width < 1e-3) { this.hide(); return; }
    this.tube.visible = true;
    this.active = true;
    this.mat.uniforms.uTime.value = time;
    const S = this.segs, sides = this.sides;
    for (let k = 0; k <= S; k++) fn(tail + (head - tail) * (k / S), this.c[k]);
    this.tailPos.copy(this.c[1]);
    this.L[0] = 0;
    for (let k = 1; k <= S; k++) this.L[k] = this.L[k - 1] + this.c[k].distanceTo(this.c[k - 1]);
    const total = Math.max(this.L[S], 1e-4);
    for (let k = 0; k <= S; k++) {
      this.T[k].subVectors(this.c[Math.min(S, k + 1)], this.c[Math.max(0, k - 1)]);
      if (this.T[k].lengthSq() < 1e-12) this.T[k].set(0, 1, 0);
      this.T[k].normalize();
    }
    const hw = width / 2, hh = width * 0.26;
    this.prevB.set(1, 0, 0);
    for (let k = 0; k <= S; k++) {
      const T = this.T[k];
      this.B.crossVectors(T, UP);
      const bl = this.B.length();
      if (bl < 0.2) this.B.copy(this.prevB);
      else { this.B.multiplyScalar(1 / bl); if (this.B.dot(this.prevB) < 0) this.B.negate(); }
      this.N.crossVectors(this.B, T).normalize();
      this.B.crossVectors(T, this.N);
      this.prevB.copy(this.B);
      const wob = 0.9 + 0.14 * Math.sin(k * 0.7 + time * 5);
      const tp = Math.sqrt(clamp01(this.L[k] / (hw * 1.6))) * Math.sqrt(clamp01((total - this.L[k]) / (hw * 1.3))) * wob;
      const rw = Math.max(hw * tp, 1e-3), rh = Math.max(hh * tp, 1e-3);
      for (let j = 0; j < sides; j++) {
        const ang = (j / sides) * Math.PI * 2, ca = Math.cos(ang), sa = Math.sin(ang);
        const o = (k * sides + j) * 3, vi = k * sides + j;
        this.pos[o] = this.c[k].x + this.B.x * ca * rw + this.N.x * sa * rh;
        this.pos[o + 1] = this.c[k].y + this.B.y * ca * rw + this.N.y * sa * rh;
        this.pos[o + 2] = this.c[k].z + this.B.z * ca * rw + this.N.z * sa * rh;
        // Ellipse normal: scale the cos / sin parts by the opposite radius.
        let nx = this.B.x * ca * hh + this.N.x * sa * hw, ny = this.B.y * ca * hh + this.N.y * sa * hw, nz = this.B.z * ca * hh + this.N.z * sa * hw;
        const nl = Math.max(Math.hypot(nx, ny, nz), 1e-6);
        nx /= nl; ny /= nl; nz /= nl;
        this.nrm[o] = nx; this.nrm[o + 1] = ny; this.nrm[o + 2] = nz;
        this.uv[vi * 2] = this.L[k]; this.uv[vi * 2 + 1] = j / sides;
        this.len[vi] = this.L[k] / total;
      }
    }
    for (const n of ['position', 'normal', 'uv', 'aLen']) this.geo.attributes[n].needsUpdate = true;
  }

  reset() {
    this.hide();
    this.stone = 0;
    this.acc = 0;
    for (const g of this.grains) g.live = false;
    this.gMesh.count = 0;
  }

  update(dt: number) {
    if (this.active && this.shed > 0) {
      this.acc += dt * this.shed;
      while (this.acc >= 1) {
        this.acc -= 1;
        const g = this.grains[this.cursor];
        this.cursor = (this.cursor + 1) % this.grains.length;
        g.live = true;
        g.pos.copy(this.tailPos);
        g.pos.x += (Math.random() - 0.5) * 0.3; g.pos.y += (Math.random() - 0.3) * 0.2; g.pos.z += (Math.random() - 0.5) * 0.3;
        g.vel.set((Math.random() - 0.5) * 1.4, 0.2 + Math.random() * 0.9, (Math.random() - 0.5) * 1.4);
        g.age = 0;
        g.life = 0.45 + Math.random() * 0.4;
        g.size = 0.08 + Math.random() * 0.06;
        g.hot = Math.random() < 0.4 ? 1 : 0;
      }
    }
    let k = 0;
    for (const g of this.grains) {
      if (!g.live) continue;
      g.age += dt;
      if (g.age >= g.life || g.pos.y < 0.03) { g.live = false; continue; }
      g.vel.y -= 7 * dt;
      g.pos.addScaledVector(g.vel, dt);
      const u = g.age / g.life;
      this.q.setFromAxisAngle(UP, g.age * 9);
      this.m.compose(g.pos, this.q, this.s.setScalar(Math.max(g.size * (1 - u * u), MIN_SCALE)));
      this.gMesh.setMatrixAt(k, this.m);
      this.gMesh.setColorAt(k, this.col.copy(g.hot ? this.cHot : this.cBody));
      k++;
    }
    this.gMesh.count = k;
    this.gMesh.instanceMatrix.needsUpdate = true;
    if (this.gMesh.instanceColor) this.gMesh.instanceColor.needsUpdate = true;
  }
}

// ---------------------------------------------------------------------------------------------------------------
// Dust
// ---------------------------------------------------------------------------------------------------------------

interface Puff { live: boolean; pos: THREE.Vector3; size: number; age: number; life: number; seed: number; drift: number }
interface Fall { live: boolean; pos: THREE.Vector3; vy: number; ph: number; age: number; life: number; size: number; angle: number; hot: number }

/**
 * Small toon dust: camera-facing puffs in the body colour with a pale lit edge and an eroding rim (`puff(pos, size)`,
 * cap = `maxPuffs`, oldest recycled), and falling grains (`fall(center, radius, count, height, life)`). Keep `life`
 * short so it is gone by the end of the spell. `update(dt)` every frame. Add `mesh` (a group).
 */
export class Dust {
  readonly mesh = new THREE.Group();
  life = 0.7;
  private puffMesh: THREE.InstancedMesh;
  private puffs: Puff[] = [];
  private cursor = 0;
  private aAlpha: THREE.InstancedBufferAttribute;
  private aAge: THREE.InstancedBufferAttribute;
  private aSeed: THREE.InstancedBufferAttribute;
  private gMesh: THREE.InstancedMesh;
  private falls: Fall[] = [];
  private gCursor = 0;
  private m = new THREE.Matrix4();
  private q = new THREE.Quaternion();
  private s = new THREE.Vector3();
  private p = new THREE.Vector3();
  private c = new THREE.Color();
  private cHot = new THREE.Color(SAND.hot);
  private cBody = new THREE.Color(SAND.body);

  constructor(maxPuffs = 12, maxGrains = 60) {
    const geo = new THREE.PlaneGeometry(2, 2);
    this.aAlpha = new THREE.InstancedBufferAttribute(new Float32Array(maxPuffs), 1);
    this.aAge = new THREE.InstancedBufferAttribute(new Float32Array(maxPuffs), 1);
    this.aSeed = new THREE.InstancedBufferAttribute(new Float32Array(maxPuffs), 1);
    geo.setAttribute('aAlpha', this.aAlpha);
    geo.setAttribute('aAge', this.aAge);
    geo.setAttribute('aSeed', this.aSeed);
    this.puffMesh = new THREE.InstancedMesh(geo, new THREE.ShaderMaterial({
      transparent: true, depthWrite: false,
      uniforms: { uBody: { value: new THREE.Color(SAND.body) }, uStone: { value: new THREE.Color(SAND.stone) }, uDark: { value: new THREE.Color(SAND.dark) } },
      vertexShader: /* glsl */ `
        attribute float aAlpha; attribute float aAge; attribute float aSeed;
        varying vec2 vP; varying float vA; varying float vAge; varying float vSeed;
        void main() {
          vec4 c = modelViewMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
          float sc = length(instanceMatrix[0].xyz);
          c.xy += position.xy * sc;
          vP = position.xy; vA = aAlpha; vAge = aAge; vSeed = aSeed;
          gl_Position = projectionMatrix * c;
        }`,
      fragmentShader: /* glsl */ `
        uniform vec3 uBody, uStone, uDark;
        varying vec2 vP; varying float vA; varying float vAge; varying float vSeed;
        void main() {
          float r = length(vP), a = atan(vP.y, vP.x);
          float wob = 1.0 + 0.24 * sin(a * 3.0 + vSeed) + 0.13 * sin(a * 5.0 + vSeed * 2.3);
          float R = 0.72 * wob * (1.0 - 0.2 * vAge);
          float edge = 1.0 - smoothstep(R - 0.05, R, r);
          float n = 0.5 + 0.5 * sin(vP.x * 6.0 + vSeed * 3.0) * sin(vP.y * 5.0 - vSeed * 1.7 + vAge * 2.0);
          float hole = step(vAge * 0.85 - 0.1, n);
          float o = edge * hole * vA;
          if (o < 0.02) discard;
          vec3 col = r < R * 0.55 ? uBody * 1.08 : uBody * 0.78;
          // Lit crescent toward the upper left, a pale foil against the dark floor.
          float lit = dot(normalize(vP + 1e-4), normalize(vec2(-0.5, 0.8)));
          if (r > R * 0.5 && lit > 0.45) col = mix(col, uStone * 0.8, 0.8);
          if (r > R * 0.9 && lit < -0.2) col = mix(col, uDark * 1.5, 0.6);
          gl_FragColor = vec4(col, o * 0.88);
        }`,
    }), maxPuffs);
    this.puffMesh.frustumCulled = false;
    this.puffMesh.count = 0;
    this.puffMesh.renderOrder = 6;
    this.mesh.add(this.puffMesh);
    for (let i = 0; i < maxPuffs; i++) this.puffs.push({ live: false, pos: new THREE.Vector3(), size: 0.5, age: 0, life: 0.7, seed: 0, drift: 0 });
    this.gMesh = new THREE.InstancedMesh(new THREE.TetrahedronGeometry(0.5), new THREE.MeshBasicMaterial(), maxGrains);
    this.gMesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(maxGrains * 3), 3);
    this.gMesh.frustumCulled = false;
    this.gMesh.count = 0;
    this.mesh.add(this.gMesh);
    for (let i = 0; i < maxGrains; i++) {
      this.falls.push({ live: false, pos: new THREE.Vector3(), vy: -2, ph: 0, age: 0, life: 1, size: 0.1, angle: 0, hot: 0 });
    }
  }

  puff(pos: THREE.Vector3, size = 0.6) {
    const p = this.puffs[this.cursor];
    this.cursor = (this.cursor + 1) % this.puffs.length;
    p.live = true; p.pos.copy(pos); p.size = size * 0.6; p.age = 0; p.life = this.life * (0.85 + Math.random() * 0.3);
    p.seed = Math.random() * 6.28; p.drift = (Math.random() - 0.5) * 0.8;
  }

  /** Falling grains over a disc: `count` grains from up to `height` above `center`, living about `life` s. */
  fall(center: THREE.Vector3, radius: number, count: number, height = 5, life = 1.3) {
    for (let i = 0; i < count; i++) {
      const f = this.falls[this.gCursor];
      this.gCursor = (this.gCursor + 1) % this.falls.length;
      const a = Math.random() * Math.PI * 2, r = radius * Math.sqrt(Math.random());
      f.live = true;
      f.pos.set(center.x + Math.cos(a) * r, center.y + height * (0.4 + Math.random() * 0.6), center.z + Math.sin(a) * r);
      f.vy = -(2.4 + Math.random() * 2);
      f.ph = Math.random() * 6.28;
      f.age = 0;
      f.life = life * (0.8 + Math.random() * 0.4);
      f.size = 0.08 + Math.random() * 0.08;
      f.hot = Math.random() < 0.35 ? 1 : 0;
    }
  }

  reset() {
    for (const p of this.puffs) p.live = false;
    for (const f of this.falls) f.live = false;
    this.puffMesh.count = 0;
    this.gMesh.count = 0;
  }

  update(dt: number) {
    let k = 0;
    for (const pf of this.puffs) {
      if (!pf.live) continue;
      pf.age += dt;
      if (pf.age >= pf.life) { pf.live = false; continue; }
      const u = pf.age / pf.life;
      this.p.set(pf.pos.x + pf.drift * pf.age, pf.pos.y + pf.age * 0.9 * (1 - u * 0.5), pf.pos.z);
      this.m.compose(this.p, this.q, this.s.setScalar(Math.max(pf.size * (0.7 + 0.7 * easeOut(u)), MIN_SCALE)));
      this.puffMesh.setMatrixAt(k, this.m);
      this.aAlpha.setX(k, Math.min(1, u * 9) * (1 - Math.pow(u, 3)));
      this.aAge.setX(k, u);
      this.aSeed.setX(k, pf.seed);
      k++;
    }
    this.puffMesh.count = k;
    this.puffMesh.instanceMatrix.needsUpdate = true;
    this.aAlpha.needsUpdate = true;
    this.aAge.needsUpdate = true;
    this.aSeed.needsUpdate = true;
    let g = 0;
    for (const f of this.falls) {
      if (!f.live) continue;
      f.age += dt;
      if (f.age >= f.life || f.pos.y < 0.05) { f.live = false; continue; }
      f.pos.y += f.vy * dt;
      f.pos.x += Math.sin(f.age * 2.5 + f.ph) * 0.5 * dt;
      f.angle += dt * 3;
      const u = f.age / f.life;
      const fade = 1 - Math.pow(clamp01((u - 0.7) / 0.3), 2);
      this.q.setFromAxisAngle(UP, f.angle);
      this.m.compose(f.pos, this.q, this.s.setScalar(Math.max(f.size * fade, MIN_SCALE)));
      this.gMesh.setMatrixAt(g, this.m);
      this.gMesh.setColorAt(g, this.c.copy(f.hot ? this.cHot : this.cBody).multiplyScalar(0.8 + 0.2 * Math.sin(f.ph)));
      g++;
    }
    this.q.identity();
    this.gMesh.count = g;
    this.gMesh.instanceMatrix.needsUpdate = true;
    if (this.gMesh.instanceColor) this.gMesh.instanceColor.needsUpdate = true;
  }
}

// ---------------------------------------------------------------------------------------------------------------
// SandstoneBlocks
// ---------------------------------------------------------------------------------------------------------------

function stoneMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: { ...sandUniforms(), uMap: { value: getTabletTexture() }, uLit: { value: 0 }, uBand: { value: 0 } },
    vertexShader: /* glsl */ `
      attribute float aTaper; attribute float aSeed;
      varying vec3 vPosV; varying vec2 vUv; varying vec2 vDim; varying float vSeed; varying float vY;
      void main() {
        vec3 p = position;
        p.xz *= mix(1.0, aTaper, p.y);
        vec4 mv = modelViewMatrix * (instanceMatrix * vec4(p, 1.0));
        vPosV = mv.xyz;
        vUv = uv;
        vDim = vec2(0.5 * (length(instanceMatrix[0].xyz) + length(instanceMatrix[2].xyz)), length(instanceMatrix[1].xyz));
        vSeed = aSeed;
        vY = position.y;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uDark, uStone, uAccent; uniform sampler2D uMap; uniform float uLit, uBand;
      varying vec3 vPosV; varying vec2 vUv; varying vec2 vDim; varying float vSeed; varying float vY;
      void main() {
        vec3 nv = normalize(cross(dFdx(vPosV), dFdy(vPosV)));
        vec3 n = normalize(transpose(mat3(viewMatrix)) * nv);
        float ndl = dot(n, normalize(vec3(-0.45, 0.65, 0.6)));
        vec3 base = uStone * (0.94 + 0.08 * (vSeed - 0.5));
        vec3 col = n.y > 0.7 ? base * 0.98 : (ndl > 0.15 ? base * 0.84 : base * 0.62);
        float side = 1.0 - smoothstep(0.45, 0.7, abs(n.y));
        // Carved glyphs on the side faces; the lit state turns them turquoise.
        float cut = texture2D(uMap, vUv * vDim / 1.8).g;
        float inc = step(0.5, cut) * side;
        vec3 glyph = mix(col * 0.38, uAccent * 0.95, uLit);
        col = mix(col, glyph, inc);
        // Banded pillars (uBand): gold and turquoise stripes up the upper shaft like a nemes headcloth, a gold cap on top.
        if (uBand > 0.0) {
          float h = vY * vDim.y;
          float stripe = fract(h * 2.4);
          vec3 gold = vec3(0.86, 0.63, 0.2), turq = uAccent * 0.9;
          vec3 bandCol = stripe < 0.34 ? gold : (stripe < 0.56 ? turq : col);
          bandCol = (stripe > 0.32 && stripe < 0.36) || (stripe > 0.54 && stripe < 0.58) ? uDark * 1.6 : bandCol;
          float zone = smoothstep(0.38, 0.46, vY);
          bandCol = mix(bandCol, gold, smoothstep(0.9, 0.94, vY));
          float shade = n.y > 0.7 ? 1.0 : (ndl > 0.15 ? 0.86 : 0.64);
          col = mix(col, bandCol * shade, uBand * zone * max(side, step(0.7, n.y)));
        }
        // Chiselled edge: a dark line hugging every face border.
        vec2 e = min(vUv, 1.0 - vUv);
        float border = 1.0 - smoothstep(0.0, 0.035, min(e.x, e.y) * min(vDim.x, vDim.y) * 0.5);
        col = mix(col, uDark * 1.4, border * 0.55 * side);
        gl_FragColor = vec4(col, 1.0);
      }`,
  });
}

interface Piece {
  live: boolean; thrown: boolean;
  base: THREE.Vector3; size: THREE.Vector3; yaw: number; leanAxis: THREE.Vector3; lean: number; taper: number; seed: number;
  age: number; delay: number; dur: number;
  crumbleAt: number; crumbleLife: number; collapseAt: number; collapseDur: number; dusted: boolean;
  vel: THREE.Vector3; pos: THREE.Vector3; axis: THREE.Vector3; angle: number; spin: number; life: number;
}

export interface RaiseOptions {
  /** Yaw of the block (radians). */
  yaw?: number;
  /** Lean angle (radians) toward `leanDir` (a yaw angle, atan2(dx, dz) convention). */
  lean?: number;
  leanDir?: number;
  /** Top width / bottom width: 1 block, ~0.7 pillar, ~0.1 shard. */
  taper?: number;
}

/**
 * Carved sandstone: instanced flat-shaded pale blocks (pillars, slabs, shards) with dark incised glyph lines. They
 * rise out of the floor with `raise(base, size, seconds, delay, opts)` (base = foot centre, size = x/y/z, returns the
 * piece index), sink away with `collapse(seconds, delay)`, or break up with `crumble(life, stagger)` (shrink and
 * sink, a dust puff each when `dust` is set). `throwShard(pos, vel, size, life)` flies a free shard that rests, then
 * crumbles. `lit` (0..1) turns the glyph lines turquoise. `update(dt)` every frame. Add `mesh`.
 */
export class SandstoneBlocks {
  readonly mesh: THREE.InstancedMesh;
  /** Puffs spawned when a piece starts to crumble (every `dustEvery`-th piece). */
  dust: Dust | null = null;
  dustEvery = 1;
  gravity = -18;
  private taperAttr: THREE.InstancedBufferAttribute;
  private seedAttr: THREE.InstancedBufferAttribute;
  private pieces: Piece[] = [];
  private cursor = 0;
  private nCrumbled = 0;
  private m = new THREE.Matrix4();
  private qa = new THREE.Quaternion();
  private qb = new THREE.Quaternion();
  private s = new THREE.Vector3();
  private p = new THREE.Vector3();
  private d = new THREE.Vector3();

  constructor(max = 24) {
    const geo = new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0);
    this.taperAttr = new THREE.InstancedBufferAttribute(new Float32Array(max).fill(1), 1);
    this.seedAttr = new THREE.InstancedBufferAttribute(new Float32Array(max), 1);
    this.taperAttr.setUsage(THREE.DynamicDrawUsage);
    this.seedAttr.setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('aTaper', this.taperAttr);
    geo.setAttribute('aSeed', this.seedAttr);
    this.mesh = new THREE.InstancedMesh(geo, stoneMaterial(), max);
    this.mesh.frustumCulled = false;
    this.mesh.count = 0;
    for (let i = 0; i < max; i++) {
      this.pieces.push({
        live: false, thrown: false, base: new THREE.Vector3(), size: new THREE.Vector3(1, 1, 1), yaw: 0, leanAxis: new THREE.Vector3(1, 0, 0), lean: 0,
        taper: 1, seed: 0, age: 0, delay: 0, dur: 0.3, crumbleAt: -1, crumbleLife: 0.6, collapseAt: -1, collapseDur: 0.3, dusted: false,
        vel: new THREE.Vector3(), pos: new THREE.Vector3(), axis: new THREE.Vector3(1, 0, 0), angle: 0, spin: 0, life: 1.5,
      });
    }
  }

  /** 0..1 paints the upper shafts with gold and turquoise bands (a nemes headcloth) and a gold cap. */
  get banded() { return (this.mesh.material as THREE.ShaderMaterial).uniforms.uBand.value as number; }
  set banded(v: number) { (this.mesh.material as THREE.ShaderMaterial).uniforms.uBand.value = clamp01(v); }

  get lit() { return (this.mesh.material as THREE.ShaderMaterial).uniforms.uLit.value as number; }
  set lit(v: number) { (this.mesh.material as THREE.ShaderMaterial).uniforms.uLit.value = clamp01(v); }

  private next() {
    const pc = this.pieces[this.cursor];
    this.cursor = (this.cursor + 1) % this.pieces.length;
    pc.live = true; pc.age = 0; pc.crumbleAt = -1; pc.collapseAt = -1; pc.dusted = false; pc.seed = Math.random();
    return pc;
  }

  raise(base: THREE.Vector3, size: THREE.Vector3, seconds = 0.3, delay = 0, opts: RaiseOptions = {}) {
    const pc = this.next();
    pc.thrown = false;
    pc.base.copy(base);
    pc.size.copy(size);
    pc.yaw = opts.yaw ?? 0;
    pc.lean = opts.lean ?? 0;
    const ld = opts.leanDir ?? 0;
    pc.leanAxis.set(Math.cos(ld), 0, -Math.sin(ld)); // y x (sin, 0, cos) = (cos, 0, -sin)
    pc.taper = opts.taper ?? 1;
    pc.delay = delay;
    pc.dur = Math.max(seconds, 0.05);
    return this.pieces.indexOf(pc);
  }

  /** A free shard: flies with gravity, bounces, rests, and crumbles over its last `crumbleLife` seconds of `life`. */
  throwShard(pos: THREE.Vector3, vel: THREE.Vector3, size: THREE.Vector3, life = 1.8, crumbleLife = 0.5) {
    const pc = this.next();
    pc.thrown = true;
    pc.pos.copy(pos);
    pc.vel.copy(vel);
    pc.size.copy(size);
    pc.taper = 0.1 + Math.random() * 0.15;
    pc.axis.randomDirection();
    pc.angle = Math.random() * 6;
    pc.spin = (Math.random() - 0.5) * 14;
    pc.life = life;
    pc.crumbleLife = crumbleLife;
    pc.delay = 0;
  }

  /** Every standing piece starts to crumble within `stagger` seconds and is gone `life` seconds later. */
  crumble(life = 0.7, stagger = 0.25) {
    for (const pc of this.pieces) {
      if (!pc.live || pc.thrown || pc.crumbleAt >= 0) continue;
      pc.crumbleAt = pc.age + Math.random() * stagger;
      pc.crumbleLife = life;
    }
  }

  /** Every standing piece sinks into the floor (shrinking a little) over `seconds`, starting after `delay`. */
  collapse(seconds = 0.3, delay = 0) {
    for (const pc of this.pieces) {
      if (!pc.live || pc.thrown) continue;
      pc.collapseAt = pc.age + delay;
      pc.collapseDur = Math.max(seconds, 0.05);
    }
  }

  reset() {
    for (const pc of this.pieces) pc.live = false;
    this.mesh.count = 0;
    this.nCrumbled = 0;
    this.lit = 0;
  }

  private puff(pc: Piece, y: number) {
    if (!this.dust) return;
    this.nCrumbled++;
    if (this.nCrumbled % Math.max(1, this.dustEvery) !== 0) return;
    this.dust.puff(this.d.set(pc.pos.x, y, pc.pos.z), Math.max(0.5, pc.size.x * 0.8));
  }

  update(dt: number) {
    let k = 0;
    for (const pc of this.pieces) {
      if (!pc.live) continue;
      pc.age += dt;
      let sx = pc.size.x, sy = pc.size.y, sz = pc.size.z;
      if (pc.thrown) {
        pc.vel.y += this.gravity * dt;
        pc.pos.addScaledVector(pc.vel, dt);
        const half = Math.min(sx, sz) * 0.3;
        if (pc.pos.y < half) {
          pc.pos.y = half;
          if (pc.vel.y < -1.5) pc.vel.y *= -0.3; else pc.vel.y = 0;
          pc.vel.x *= 0.55; pc.vel.z *= 0.55; pc.spin *= 0.4;
        }
        pc.angle += pc.spin * dt;
        const left = pc.life - pc.age;
        if (left <= 0) { pc.live = false; continue; }
        const c = clamp01(1 - left / pc.crumbleLife);
        if (c > 0 && !pc.dusted) { pc.dusted = true; this.puff(pc, 0.4); }
        const sink = c * c * sy * 0.9;
        this.qa.setFromAxisAngle(pc.axis, pc.angle);
        const sc = 1 - c * 0.45;
        this.p.set(pc.pos.x, pc.pos.y - sink, pc.pos.z);
        this.s.set(Math.max(sx * sc, MIN_SCALE), Math.max(sy * sc, MIN_SCALE), Math.max(sz * sc, MIN_SCALE));
        this.m.compose(this.p, this.qa, this.s);
      } else {
        if (pc.age < pc.delay) continue;
        const u = clamp01((pc.age - pc.delay) / pc.dur);
        let y = pc.base.y - (1 - easeOut(u)) * sy * 1.05;
        let x = pc.base.x, z = pc.base.z;
        if (pc.crumbleAt >= 0 && pc.age >= pc.crumbleAt) {
          const c = clamp01((pc.age - pc.crumbleAt) / pc.crumbleLife);
          if (c >= 1) { pc.live = false; continue; }
          if (!pc.dusted) { pc.dusted = true; pc.pos.copy(pc.base); this.puff(pc, pc.base.y + sy * 0.4); }
          y -= c * c * sy * 1.0;
          const sh = 1 - c * 0.5;
          sx *= sh; sz *= sh; sy *= 1 - c * 0.3;
          x += Math.sin(pc.age * 70 + pc.seed * 9) * 0.05 * c;
          z += Math.cos(pc.age * 63 + pc.seed * 5) * 0.05 * c;
        }
        if (pc.collapseAt >= 0 && pc.age >= pc.collapseAt) {
          const c = clamp01((pc.age - pc.collapseAt) / pc.collapseDur);
          if (c >= 1) { pc.live = false; continue; }
          y -= (pc.base.y + sy * 1.1) * c * c;
          sx *= 1 - c * 0.35; sz *= 1 - c * 0.35;
        }
        this.qa.setFromAxisAngle(UP, pc.yaw);
        this.qb.setFromAxisAngle(pc.leanAxis, pc.lean);
        this.qb.multiply(this.qa);
        this.p.set(x, y, z);
        this.s.set(Math.max(sx, MIN_SCALE), Math.max(sy, MIN_SCALE), Math.max(sz, MIN_SCALE));
        this.m.compose(this.p, this.qb, this.s);
      }
      this.mesh.setMatrixAt(k, this.m);
      this.taperAttr.setX(k, pc.taper);
      this.seedAttr.setX(k, pc.seed);
      k++;
    }
    this.mesh.count = k;
    this.mesh.instanceMatrix.needsUpdate = true;
    this.taperAttr.needsUpdate = true;
    this.seedAttr.needsUpdate = true;
  }
}

// ---------------------------------------------------------------------------------------------------------------
// GlyphRing
// ---------------------------------------------------------------------------------------------------------------

export interface GlyphRingOptions {
  /** Draw a sun disc in the middle (hide it with `centre = 0` when a pool or a pyramid covers it). Default false. */
  centre?: boolean;
}

/**
 * A sandstone ground ring with carved glyphs (pale stone band, shaded lips, dark incised lines). `set(center,
 * radius, spin)` lays it on the ground; `reveal` 0..1 carves it on as a sweep around the circle, `opacity` fades it,
 * `lit` 0..1 turns the glyphs turquoise (a glint), `centre` 0..1 fades the middle disc (only with the centre option).
 * Add `mesh`.
 */
export class GlyphRing {
  readonly mesh: THREE.Mesh;
  private mat: THREE.ShaderMaterial;
  private _reveal = 0;
  private _opacity = 1;

  constructor(opts: GlyphRingOptions = {}) {
    const si = opts.centre ? 1 : 0;
    let tex = ringTextures[si];
    if (!tex) {
      tex = new THREE.CanvasTexture(drawGlyphRing(si === 1));
      tex.colorSpace = THREE.NoColorSpace;
      tex.anisotropy = 8;
      ringTextures[si] = tex;
    }
    this.mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, side: THREE.DoubleSide,
      polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1,
      uniforms: {
        ...sandUniforms(), uMap: { value: tex }, uReveal: { value: 0 }, uOpacity: { value: 1 }, uLit: { value: 0 }, uCentre: { value: opts.centre ? 1 : 0 },
      },
      vertexShader: /* glsl */ `
        varying vec2 vUv;
        void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: /* glsl */ `
        uniform vec3 uDark, uStone, uAccent; uniform sampler2D uMap; uniform float uReveal, uOpacity, uLit, uCentre;
        varying vec2 vUv;
        void main() {
          vec4 t = texture2D(uMap, vUv);
          vec2 p = vUv - 0.5;
          float sweep = fract(atan(p.x, -p.y) / 6.28318530718);
          float m = 1.0 - smoothstep(uReveal * 1.02 - 0.012, uReveal * 1.02, sweep);
          float o = t.a * m * uOpacity;
          if (length(p) * 2.0 < 0.62) o *= uCentre;
          if (o < 0.004) discard;
          vec3 col = uStone * 0.97;
          if (t.b > 0.5) col = uStone * 0.74;
          if (t.g > 0.5) col = mix(uDark * 1.25, uAccent * 0.95, uLit);
          gl_FragColor = vec4(col, o);
        }`,
    });
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2).rotateX(-Math.PI / 2), this.mat);
    this.mesh.frustumCulled = false;
    this.mesh.visible = false;
    this.mesh.renderOrder = 1;
  }

  get reveal() { return this._reveal; }
  set reveal(v: number) { this._reveal = v; this.mat.uniforms.uReveal.value = v; this.sync(); }
  get opacity() { return this._opacity; }
  set opacity(v: number) { this._opacity = v; this.mat.uniforms.uOpacity.value = v; this.sync(); }
  get lit() { return this.mat.uniforms.uLit.value as number; }
  set lit(v: number) { this.mat.uniforms.uLit.value = clamp01(v); }
  get centre() { return this.mat.uniforms.uCentre.value as number; }
  set centre(v: number) { this.mat.uniforms.uCentre.value = clamp01(v); }

  private sync() {
    this.mesh.visible = this._reveal > 0.002 && this._opacity > 0.004;
  }

  set(center: THREE.Vector3, radius: number, spin = 0) {
    this.mesh.position.set(center.x, 0.05, center.z);
    this.mesh.rotation.y = spin;
    this.mesh.scale.setScalar(Math.max(radius, MIN_SCALE));
  }

  reset() {
    this.reveal = 0;
    this.opacity = 1;
    this.lit = 0;
  }
}

// ---------------------------------------------------------------------------------------------------------------
// SandPool
// ---------------------------------------------------------------------------------------------------------------

/**
 * A ground decal of loose sand with a lumpy edge: spiral ridges (ochre, a lit crest, dark troughs, pale streaks) that
 * flow toward the centre as `swirl` (0..1) rises, with a dark funnel in the middle. `place(center)`, `spread(radius,
 * seconds)` flows it out, set `swirl` each frame (or let `settle(seconds, delay)` ease it to 0), `fade(seconds,
 * delay)` fades it out. `update(dt)` every frame. Add `mesh`.
 */
export class SandPool {
  readonly mesh: THREE.Mesh;
  /** 0..1 swirl speed and funnel depth. */
  swirl = 0;
  /** Height above the floor. */
  y = 0.06;
  private mat: THREE.ShaderMaterial;
  private spreadDur = 0.4;
  private spreadAge = -1;
  private clock = 0;
  private phase = 0;
  private settleFrom = -1;
  private settleDur = 1;
  private settleStart = 0;
  private fadeFrom = -1;
  private fadeDur = 0.6;
  private seed = Math.random() * 6.28;

  constructor() {
    this.mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
      uniforms: { ...sandUniforms(), uState: { value: new THREE.Vector4(0, 0, 0, 0) }, uSeed: { value: 0 } },
      vertexShader: /* glsl */ `
        varying vec2 vUv;
        void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: /* glsl */ `
        uniform vec3 uBody, uDark, uHot, uStone; uniform vec4 uState; uniform float uSeed;
        varying vec2 vUv;
        float h1(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
        void main() {
          vec2 p = vUv * 2.0 - 1.0;
          float r = length(p), a = atan(p.y, p.x);
          float lump = 1.0 + 0.05 * sin(a * 4.0 + uSeed * 5.0) + 0.035 * sin(a * 9.0 + uSeed * 2.0);
          float R = 0.92 * lump * uState.x;
          float aa = max(fwidth(r), 1e-4);
          float alpha = uState.w * (1.0 - smoothstep(R - aa, R, r));
          if (alpha < 0.004) discard;
          float rn = r / max(R, 1e-4);
          float sw = uState.y;
          // Spiral ridges: three arms, tighter as the swirl rises; the phase runs inward.
          float f = a * 3.0 + rn * (2.5 + 9.0 * sw) + uState.z;
          float v = fract(f / 6.28318530718);
          vec3 col = uBody;
          col = mix(col, uHot * 0.92, step(0.62, v) * step(v, 0.86));
          col = mix(col, uBody * 0.7, step(v, 0.3));
          col = mix(col, uStone * 0.82, step(0.86, v) * step(v, 0.915));
          col = mix(col, uDark * 1.6, (1.0 - smoothstep(0.0, 0.035, abs(v - 0.3))) * 0.8);
          // Grain speckle.
          float g = h1(floor(p * 70.0));
          col = mix(col, uHot * 0.95, step(0.93, g) * 0.8);
          col *= mix(1.0, 0.8, step(g, 0.07));
          // Dark funnel toward the middle.
          col = mix(col, uDark * 1.5, smoothstep(0.6, 1.0, 1.0 - rn) * sw * 0.85);
          // Darker rim where the sand meets the floor.
          col = mix(col, uDark * 1.7, smoothstep(0.9, 0.99, rn) * 0.7);
          gl_FragColor = vec4(col, alpha);
        }`,
    });
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2).rotateX(-Math.PI / 2), this.mat);
    this.mesh.frustumCulled = false;
    this.mesh.visible = false;
    this.mesh.renderOrder = 2;
    this.mesh.position.y = this.y;
  }

  place(center: THREE.Vector3) {
    this.mesh.position.set(center.x, this.y, center.z);
  }

  /** Flows out to `radius` (world units) over `seconds`; restarts the settle and fade clocks. */
  spread(radius: number, seconds = 0.4) {
    this.spreadDur = Math.max(seconds, 0.05);
    this.spreadAge = 0;
    this.clock = 0;
    this.phase = 0;
    this.settleFrom = -1;
    this.fadeFrom = -1;
    this.seed = Math.random() * 6.28;
    this.mat.uniforms.uSeed.value = this.seed;
    this.mesh.scale.setScalar(Math.max(radius / 0.92, MIN_SCALE));
  }

  /** Eases `swirl` to 0 over `seconds`, starting `delay` seconds from now. */
  settle(seconds = 0.8, delay = 0) {
    this.settleDur = Math.max(seconds, 0.05);
    this.settleFrom = this.clock + delay;
    this.settleStart = -1;
  }

  /** Fades out over `seconds`, starting `delay` seconds from now. */
  fade(seconds = 0.6, delay = 0) {
    this.fadeDur = Math.max(seconds, 0.05);
    this.fadeFrom = this.clock + delay;
  }

  reset() {
    this.spreadAge = -1;
    this.settleFrom = -1;
    this.fadeFrom = -1;
    this.swirl = 0;
    this.mesh.visible = false;
  }

  update(dt: number) {
    if (this.spreadAge < 0) { this.mesh.visible = false; return; }
    this.spreadAge += dt;
    this.clock += dt;
    if (this.settleFrom >= 0 && this.clock >= this.settleFrom) {
      if (this.settleStart < 0) this.settleStart = this.swirl;
      this.swirl = this.settleStart * (1 - clamp01((this.clock - this.settleFrom) / this.settleDur));
    }
    this.phase += dt * (1.2 + 11 * this.swirl);
    const spread = easeOut(this.spreadAge / this.spreadDur);
    const alpha = this.fadeFrom < 0 ? 1 : 1 - clamp01((this.clock - this.fadeFrom) / this.fadeDur);
    this.mesh.visible = alpha > 0.004;
    (this.mat.uniforms.uState.value as THREE.Vector4).set(Math.max(spread, 0.01), this.swirl, this.phase, alpha);
  }
}

// ---------------------------------------------------------------------------------------------------------------
// SandWave
// ---------------------------------------------------------------------------------------------------------------

/**
 * An expanding ground ring of flung sand: a pale stone leading line, a lit ochre band and a dark grainy tail that
 * dissolves into speckles, with an uneven edge. `set(center, radius, opacity, thickness)` each frame (radius = the
 * leading edge); opacity 0 hides it. Add `mesh`.
 */
export class SandWave {
  readonly mesh: THREE.Mesh;
  private mat: THREE.ShaderMaterial;

  constructor() {
    this.mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, side: THREE.DoubleSide,
      polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3,
      uniforms: { ...sandUniforms(), uRadius: { value: 1 }, uThick: { value: 0.4 }, uOpacity: { value: 0 }, uScale: { value: 1 }, uSeed: { value: Math.random() * 6 } },
      vertexShader: /* glsl */ `
        varying vec2 vUv;
        void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: /* glsl */ `
        uniform vec3 uBody, uDark, uHot, uStone; uniform float uRadius, uThick, uOpacity, uScale, uSeed;
        varying vec2 vUv;
        float h1(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
        void main() {
          vec2 p = (vUv * 2.0 - 1.0) * uScale;
          float r = length(p), a = atan(p.y, p.x);
          float wob = (0.3 * sin(a * 7.0 + uSeed) + 0.2 * sin(a * 13.0 + uSeed * 2.0)) * uThick;
          float d = uRadius - r + wob;
          if (d < -0.02 || d > uThick * 3.4) discard;
          float g = h1(floor(vec2(a * 34.0, r * 7.0)));
          vec3 col; float al = uOpacity;
          if (d < uThick * 0.5) col = uStone * 0.95;
          else if (d < uThick * 1.7) col = mix(uBody, uHot * 0.92, 0.55 + 0.4 * step(0.6, g));
          else if (d < uThick * 2.5) col = uBody * 0.7;
          else { col = uDark * 1.6; if (g < smoothstep(uThick * 2.5, uThick * 3.4, d)) discard; }
          gl_FragColor = vec4(col, al);
        }`,
    });
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2).rotateX(-Math.PI / 2), this.mat);
    this.mesh.frustumCulled = false;
    this.mesh.visible = false;
    this.mesh.renderOrder = 4;
  }

  set(center: THREE.Vector3, radius: number, opacity: number, thickness = 0.4) {
    this.mesh.visible = opacity > 0.004 && radius > 1e-3;
    if (!this.mesh.visible) return;
    const maxR = radius + thickness * 3.6;
    this.mesh.position.set(center.x, 0.07, center.z);
    this.mesh.scale.setScalar(maxR);
    this.mat.uniforms.uScale.value = maxR;
    this.mat.uniforms.uRadius.value = radius;
    this.mat.uniforms.uThick.value = thickness;
    this.mat.uniforms.uOpacity.value = opacity;
  }

  reset() {
    this.mesh.visible = false;
  }
}

// ---------------------------------------------------------------------------------------------------------------
// GemGlints
// ---------------------------------------------------------------------------------------------------------------

/** Jewel colours of the Dune Sovereign collar: gold, turquoise, lapis blue and carnelian. */
export const GEM_COLORS = [0xf2c14e, 0x3fd4c8, 0x3a5fd9, 0xd9482b] as const;

interface Glint {
  live: boolean; pos: THREE.Vector3; vy: number; age: number; life: number; size: number; spin: number; ph: number; color: number;
}

/**
 * Tiny twinkling jewel diamonds (gold, turquoise, lapis, carnelian) that wink in the sand and drift up: `scatter(center,
 * radius, count, life)` throws a burst over a disc, `trickle(dt, center, radius, perSecond)` keeps a steady glitter.
 * They face the camera along the vector given to `face` (set it once per cast). `update(dt)` every frame. Add `mesh`.
 */
export class GemGlints {
  readonly mesh: THREE.InstancedMesh;
  private glints: Glint[] = [];
  private cursor = 0;
  private acc = 0;
  private facing = new THREE.Vector3(0, 0.45, 0.9).normalize();
  private qFace = new THREE.Quaternion();
  private q = new THREE.Quaternion();
  private m = new THREE.Matrix4();
  private s = new THREE.Vector3();
  private c = new THREE.Color();
  private p = new THREE.Vector3();
  private static Z = new THREE.Vector3(0, 0, 1);

  constructor(readonly max = 32) {
    const shape = new THREE.Shape();
    shape.moveTo(0, 0.5); shape.lineTo(0.28, 0); shape.lineTo(0, -0.5); shape.lineTo(-0.28, 0); shape.closePath();
    const mat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, depthWrite: false, side: THREE.DoubleSide });
    this.mesh = new THREE.InstancedMesh(new THREE.ShapeGeometry(shape), mat, max);
    this.mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(max * 3), 3);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 9;
    this.mesh.count = 0;
    this.mesh.visible = false;
    for (let i = 0; i < max; i++) {
      this.glints.push({ live: false, pos: new THREE.Vector3(), vy: 0, age: 0, life: 1, size: 0.2, spin: 0, ph: 0, color: 0 });
    }
    this.face(this.facing);
  }

  /** Unit vector from the scene toward the camera. */
  face(toCamera: THREE.Vector3) {
    this.facing.copy(toCamera).normalize();
    this.qFace.setFromUnitVectors(GemGlints.Z, this.facing);
  }

  private spawn(pos: THREE.Vector3, life: number) {
    const g = this.glints[this.cursor];
    this.cursor = (this.cursor + 1) % this.max;
    g.live = true; g.age = 0; g.life = life * (0.7 + Math.random() * 0.6);
    g.pos.copy(pos);
    g.vy = 0.3 + Math.random() * 0.7;
    g.size = 0.22 + Math.random() * 0.2;
    g.spin = (Math.random() - 0.5) * 3;
    g.ph = Math.random() * 6;
    g.color = GEM_COLORS[Math.floor(Math.random() * GEM_COLORS.length)];
  }

  scatter(center: THREE.Vector3, radius: number, count: number, life = 0.9) {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2, r = radius * Math.sqrt(Math.random());
      this.spawn(this.p.set(center.x + Math.cos(a) * r, 0.15 + Math.random() * 1.6, center.z + Math.sin(a) * r), life);
    }
  }

  trickle(dt: number, center: THREE.Vector3, radius: number, perSecond: number, life = 0.8) {
    this.acc += dt * perSecond;
    const n = Math.floor(this.acc);
    this.acc -= n;
    if (n > 0) this.scatter(center, radius, n, life);
  }

  reset() {
    for (const g of this.glints) g.live = false;
    this.acc = 0;
    this.mesh.count = 0;
    this.mesh.visible = false;
  }

  update(dt: number) {
    let k = 0;
    for (const g of this.glints) {
      if (!g.live) continue;
      g.age += dt;
      if (g.age >= g.life) { g.live = false; continue; }
      const u = g.age / g.life;
      g.pos.y += g.vy * dt;
      // Wink in, flash, wink out: a pinched twinkle.
      const tw = Math.sin(Math.PI * u) * (0.65 + 0.35 * Math.sin(g.age * 18 + g.ph));
      this.q.setFromAxisAngle(GemGlints.Z, g.spin * g.age).premultiply(this.qFace);
      this.m.compose(g.pos, this.q, this.s.set(Math.max(g.size * tw, MIN_SCALE), Math.max(g.size * tw * 1.4, MIN_SCALE), 1));
      this.mesh.setMatrixAt(k, this.m);
      this.mesh.setColorAt(k, this.c.setHex(g.color));
      k++;
    }
    this.mesh.count = k;
    this.mesh.visible = k > 0;
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }
}

// ---------------------------------------------------------------------------------------------------------------
// SandHood
// ---------------------------------------------------------------------------------------------------------------

/**
 * A rearing cobra made of sand: a thin upright sheet (facing `yaw`) cut by a shader into a narrow neck, a wide rounded
 * hood striped gold and turquoise like a nemes headcloth, and a small head with a dark eye. `place(base, yaw)` stands
 * it on the ground; `set(rear, strike, opacity, erode, time)`: `rear` 0..1 is how far it has risen (and grown),
 * `strike` 0..1 tilts it forward at the camera, `erode` 0..1 dissolves it into grains. Add `mesh`.
 */
export class SandHood {
  readonly mesh: THREE.Mesh;
  /** World size of the fully risen hood (width of the hood, height of the head). */
  width = 3.6;
  height = 4.6;
  private mat: THREE.ShaderMaterial;

  constructor() {
    this.mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, side: THREE.DoubleSide,
      uniforms: { ...sandUniforms(), uOpacity: { value: 0 }, uErode: { value: 0 }, uTime: { value: 0 } },
      vertexShader: /* glsl */ `
        varying vec2 vUv;
        void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: /* glsl */ `
        uniform vec3 uBody, uDark, uHot, uAccent, uStone; uniform float uOpacity, uErode, uTime;
        varying vec2 vUv;
        float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
        float noise(vec2 p) {
          vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
          return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
        }
        // Half width of the silhouette at height v: neck, flaring hood, rounded shoulders.
        float halfWidth(float v) {
          if (v < 0.24) return 0.13 + 0.03 * (v / 0.24);
          if (v < 0.6) return mix(0.16, 0.86, pow(smoothstep(0.24, 0.6, v), 0.8));
          float k = (v - 0.6) / 0.15;
          return k >= 1.0 ? 0.0 : 0.86 * sqrt(max(0.0, 1.0 - k * k));
        }
        void main() {
          float u = vUv.x * 2.0 - 1.0, v = vUv.y;
          float hw = halfWidth(v);
          vec2 hp = vec2(u / 0.17, (v - 0.8) / 0.14);
          float head = 1.0 - length(hp);
          float body = hw - abs(u);
          float d = max(body, head * 0.17);
          // Ragged, grainy edge that eats inward as it erodes.
          float n = noise(vec2(u * 11.0, v * 17.0 - uTime * 2.0));
          float edge = d + (n - 0.5) * 0.09 - uErode * (0.5 + 0.5 * n) * 0.6;
          if (edge < 0.0) discard;
          vec3 gold = vec3(0.88, 0.64, 0.2), turq = uAccent * 0.92;
          vec3 col = uBody * (0.9 + 0.2 * n);
          // Nemes stripes across the hood, bending down toward the edges.
          if (v > 0.26 && v < 0.74) {
            float s = fract(v * 8.0 + u * u * 1.6);
            col = s < 0.4 ? gold : (s < 0.74 ? turq : uStone * 0.95);
            col = (abs(s - 0.4) < 0.025 || abs(s - 0.74) < 0.025 || s < 0.02) ? uDark * 1.5 : col;
          }
          // Neck: sand grains streaming up, a lit centre line.
          if (v <= 0.26) col = mix(uBody, uHot, 0.35 * smoothstep(0.12, 0.0, abs(u)) + 0.25 * step(0.6, noise(vec2(u * 20.0, v * 30.0 - uTime * 6.0))));
          // Head: gold, a turquoise brow band and a dark eye.
          if (head > 0.0) {
            col = gold;
            if (hp.y > 0.35) col = turq;
            if (length(vec2(abs(u) - 0.05, v - 0.805)) < 0.017) col = uDark * 1.4;
          }
          // Dark outline hugging the border.
          col = mix(uDark * 1.5, col, smoothstep(0.0, 0.025, edge));
          // Fade near the foot so it grows out of the sand.
          float foot = smoothstep(0.0, 0.08, v);
          gl_FragColor = vec4(col, uOpacity * foot);
        }`,
    });
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1).translate(0, 0.5, 0), this.mat);
    this.mesh.frustumCulled = false;
    this.mesh.rotation.order = 'YXZ'; // yaw first, then tilt forward in the hood own plane
    this.mesh.renderOrder = 5;
    this.mesh.visible = false;
  }

  place(base: THREE.Vector3, yaw: number) {
    this.mesh.position.set(base.x, 0.02, base.z);
    this.mesh.rotation.set(0, yaw, 0);
  }

  set(rear: number, strike: number, opacity: number, erode: number, time: number) {
    const r = clamp01(rear);
    this.mesh.visible = r > 0.01 && opacity > 0.004;
    const sway = Math.sin(time * 3.2) * 0.05 * r;
    this.mesh.scale.set(this.width * (0.3 + 0.7 * r) * (1 + 0.04 * Math.sin(time * 9)), Math.max(this.height * r, MIN_SCALE), 1);
    this.mesh.rotation.x = strike * 0.85;
    this.mesh.rotation.z = sway;
    this.mat.uniforms.uOpacity.value = opacity;
    this.mat.uniforms.uErode.value = erode;
    this.mat.uniforms.uTime.value = time;
  }

  reset() {
    this.mesh.visible = false;
    this.mat.uniforms.uOpacity.value = 0;
    this.mat.uniforms.uErode.value = 0;
    this.mesh.scale.set(1, MIN_SCALE, 1);
    this.mesh.rotation.set(0, 0, 0);
  }
}

// ---------------------------------------------------------------------------------------------------------------
// ScarabSwarm
// ---------------------------------------------------------------------------------------------------------------

interface Scarab { live: boolean; pos: THREE.Vector3; vel: THREE.Vector3; age: number; life: number; size: number; gold: boolean; ph: number }

/**
 * Pooled scarab beetles: a gold or turquoise shell (a flattened ellipsoid pointing along its heading) inside a dark rim.
 * They fly on an arc, bounce once and skitter along the floor, then shrink away. `emit(pos, vel, life, size)` throws one,
 * `burst(center, count, speed, life)` throws a ring of them out and up, `scuttle(pos, dir, count, life)` lets a few run
 * low along `dir`. Cap = `max`, oldest recycled. `update(dt)` every frame. Add `mesh`.
 */
export class ScarabSwarm {
  readonly mesh = new THREE.Group();
  private body: THREE.InstancedMesh;
  private rim: THREE.InstancedMesh;
  private bugs: Scarab[] = [];
  private cursor = 0;
  private m = new THREE.Matrix4();
  private q = new THREE.Quaternion();
  private s = new THREE.Vector3();
  private c = new THREE.Color();
  private cGold = new THREE.Color(0xf2c14e);
  private cTurq = new THREE.Color(SAND.accent);
  private bv = new THREE.Vector3();
  private bp = new THREE.Vector3();

  constructor(readonly max = 40) {
    const geo = new THREE.SphereGeometry(0.5, 7, 5);
    this.body = new THREE.InstancedMesh(geo, new THREE.MeshBasicMaterial(), max);
    this.body.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(max * 3), 3);
    this.rim = new THREE.InstancedMesh(geo, new THREE.MeshBasicMaterial({ color: SAND.dark, side: THREE.BackSide }), max);
    for (const im of [this.body, this.rim]) { im.frustumCulled = false; im.count = 0; this.mesh.add(im); }
    for (let i = 0; i < max; i++) this.bugs.push({ live: false, pos: new THREE.Vector3(), vel: new THREE.Vector3(), age: 0, life: 1, size: 0.3, gold: false, ph: 0 });
  }

  emit(pos: THREE.Vector3, vel: THREE.Vector3, life = 0.9, size = 0.3) {
    const b = this.bugs[this.cursor];
    this.cursor = (this.cursor + 1) % this.max;
    b.live = true; b.age = 0; b.life = life * (0.8 + Math.random() * 0.4);
    b.pos.copy(pos);
    b.vel.copy(vel);
    b.size = size * (0.8 + Math.random() * 0.4);
    b.gold = Math.random() < 0.5;
    b.ph = Math.random() * 6.28;
  }

  /** A ring of scarabs thrown out and up from `center`, each with its own speed, landing and running on. */
  burst(center: THREE.Vector3, count: number, speed = 5, life = 1.0) {
    const v = this.bv, p = this.bp;
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2 + Math.random() * 0.5, k = 0.55 + Math.random() * 0.7;
      v.set(Math.cos(a) * speed * k, 3.5 + Math.random() * 4, Math.sin(a) * speed * k);
      this.emit(p.set(center.x + Math.cos(a) * 0.3, Math.max(center.y, 0.3), center.z + Math.sin(a) * 0.3), v, life);
    }
  }

  /** A few scarabs running low along `dir` (a unit ground vector) from `pos`. */
  scuttle(pos: THREE.Vector3, dir: THREE.Vector3, count = 2, life = 0.6) {
    const v = this.bv, p = this.bp;
    for (let i = 0; i < count; i++) {
      const side = (Math.random() - 0.5) * 2.4;
      v.set(dir.x * (3 + Math.random() * 2) - dir.z * side, 1.2 + Math.random() * 1.4, dir.z * (3 + Math.random() * 2) + dir.x * side);
      this.emit(p.set(pos.x + (Math.random() - 0.5) * 0.5, 0.35 + Math.random() * 0.5, pos.z + (Math.random() - 0.5) * 0.5), v, life, 0.26);
    }
  }

  reset() {
    for (const b of this.bugs) b.live = false;
    this.body.count = this.rim.count = 0;
  }

  update(dt: number) {
    let k = 0;
    for (const b of this.bugs) {
      if (!b.live) continue;
      b.age += dt;
      if (b.age >= b.life) { b.live = false; continue; }
      b.vel.y -= 16 * dt;
      b.pos.addScaledVector(b.vel, dt);
      if (b.pos.y < 0.12) {
        b.pos.y = 0.12;
        if (b.vel.y < -2) { b.vel.y *= -0.3; b.vel.x *= 0.55; b.vel.z *= 0.55; } else b.vel.y = 0;
      }
      if (b.pos.y <= 0.13) { const f = Math.exp(-2.2 * dt); b.vel.x *= f; b.vel.z *= f; }
      const u = b.age / b.life, fade = 1 - Math.pow(clamp01((u - 0.7) / 0.3), 2);
      const yaw = Math.atan2(b.vel.x + 1e-4, b.vel.z + 1e-4);
      this.q.setFromAxisAngle(UP, yaw + Math.sin(b.age * 22 + b.ph) * 0.25);
      const sc = Math.max(b.size * fade, MIN_SCALE);
      this.m.compose(b.pos, this.q, this.s.set(sc * 0.85, sc * 0.55, sc * 1.15));
      this.body.setMatrixAt(k, this.m);
      this.body.setColorAt(k, this.c.copy(b.gold ? this.cGold : this.cTurq));
      this.m.compose(b.pos, this.q, this.s.set(Math.max(sc * 1.2, MIN_SCALE), Math.max(sc * 0.8, MIN_SCALE), Math.max(sc * 1.45, MIN_SCALE)));
      this.rim.setMatrixAt(k, this.m);
      k++;
    }
    this.body.count = this.rim.count = k;
    this.body.instanceMatrix.needsUpdate = this.rim.instanceMatrix.needsUpdate = true;
    if (this.body.instanceColor) this.body.instanceColor.needsUpdate = true;
  }
}

// ---------------------------------------------------------------------------------------------------------------
// Sarcophagus
// ---------------------------------------------------------------------------------------------------------------

/** Height of the sarcophagus, and the x of its two hinges (the widest half-width). */
export const SARCOPHAGUS_HEIGHT = 2.9;
const SARC_HINGE = 0.95;

function sarcophagusMaterial(face: number) {
  return new THREE.ShaderMaterial({
    side: THREE.DoubleSide,
    uniforms: { ...sandUniforms(), uFace: { value: face } },
    vertexShader: /* glsl */ `
      varying vec3 vPosV; varying vec3 vLocal;
      void main() {
        vLocal = position;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vPosV = mv.xyz;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uBody, uDark, uHot, uStone, uAccent; uniform float uFace;
      varying vec3 vPosV; varying vec3 vLocal;
      void main() {
        if (!gl_FrontFacing) {
          // The inside of the lid: dark wood with gold ribs.
          gl_FragColor = vec4(mix(uDark * 1.7, uBody * 0.6, step(0.8, fract(vLocal.y * 2.5))), 1.0);
          return;
        }
        vec3 nv = normalize(cross(dFdx(vPosV), dFdy(vPosV)));
        vec3 n = normalize(transpose(mat3(viewMatrix)) * nv);
        float ndl = dot(n, normalize(vec3(-0.45, 0.65, 0.6)));
        float shade = ndl > 0.25 ? 1.0 : (ndl > -0.15 ? 0.78 : 0.56);
        vec3 gold = vec3(0.84, 0.6, 0.19), turq = uAccent * 0.9;
        float y = vLocal.y, a = atan(vLocal.x, vLocal.z);
        vec3 col = gold;
        // Body: turquoise bands with dark seams, a pale collar of carved stone.
        float s = fract(y * 1.7);
        if (y < 1.7) col = s > 0.5 && s < 0.7 ? turq : gold;
        if (y < 1.7 && (abs(s - 0.5) < 0.025 || abs(s - 0.7) < 0.025)) col = uDark * 1.5;
        if (y >= 1.7 && y < 1.98) { col = uStone * 0.96; if (fract(a * 4.0) < 0.1) col = uDark * 1.4; }
        // Headdress: gold and turquoise stripes falling past the face.
        if (y >= 1.98) { float st = fract(y * 3.2 + a * 0.4); col = st < 0.4 ? gold : (st < 0.7 ? turq : uStone * 0.95); }
        // The face on the front half: a pale mask, dark eyes with a turquoise line, a dark beard.
        if (uFace > 0.5 && vLocal.z > 0.0) {
          vec2 fp = vec2(vLocal.x / 0.3, (y - 2.3) / 0.3);
          if (dot(fp, fp) < 1.0) {
            col = uStone * 0.98;
            if (abs(abs(vLocal.x) - 0.12) < 0.06 && abs(y - 2.36) < 0.03) col = uDark * 1.4;
            if (abs(abs(vLocal.x) - 0.12) < 0.06 && abs(y - 2.4) < 0.012) col = turq;
            if (abs(vLocal.x) < 0.07 && abs(y - 2.17) < 0.02) col = uDark * 1.4;
          }
          if (abs(vLocal.x) < 0.1 && y > 1.9 && y < 2.05) col = uDark * 1.5;
        }
        col *= shade;
        float f = 1.0 - abs(nv.z);
        if (f > 0.84) col = uDark;
        gl_FragColor = vec4(col, 1.0);
      }`,
  });
}

/**
 * A gold mummiform sarcophagus in two halves that stand round a spot. `place(center, yaw)` sets it (the face looks along `yaw`,
 * a heading as `atan2(dx, dz)`); `set(open, rise)`: `open` 1 = the halves stand swung wide, 0 = shut round whoever is inside
 * (the case is opaque and 2.9 m tall, so it hides them); beyond 1 the halves fall away. `rise` 0..1 lifts it out of the floor.
 * Add `mesh`.
 */
export class Sarcophagus {
  readonly mesh = new THREE.Group();
  private pivots: THREE.Group[] = [];

  constructor() {
    const profile = [
      [0.001, 0], [0.62, 0], [0.66, 0.1], [0.74, 0.5], [0.86, 0.95], [0.93, 1.35], [0.95, 1.7], [0.82, 1.98], [0.6, 2.12], [0.55, 2.26],
      [0.6, 2.42], [0.66, 2.58], [0.6, 2.74], [0.3, 2.86], [0.001, SARCOPHAGUS_HEIGHT],
    ].map(([r, y]) => new THREE.Vector2(r, y));
    // Front half (z > 0) hinged on +x, back half (z < 0) on -x; both swing by the same angle about the vertical.
    for (const [side, phi, face] of [[1, -Math.PI / 2, 1], [-1, Math.PI / 2, 0]] as const) {
      const pivot = new THREE.Group();
      pivot.position.x = side * SARC_HINGE;
      const half = new THREE.Mesh(new THREE.LatheGeometry(profile, 12, phi, Math.PI), sarcophagusMaterial(face));
      half.position.x = -side * SARC_HINGE;
      half.frustumCulled = false;
      pivot.add(half);
      this.pivots.push(pivot);
      this.mesh.add(pivot);
    }
    this.mesh.visible = false;
  }

  place(center: THREE.Vector3, yaw: number) {
    this.mesh.position.set(center.x, 0, center.z);
    this.mesh.rotation.y = yaw;
  }

  set(open: number, rise: number) {
    this.mesh.visible = rise > 0.01;
    this.mesh.position.y = -(1 - clamp01(rise)) * (SARCOPHAGUS_HEIGHT + 0.1);
    const ang = open * 1.3;
    for (const p of this.pivots) p.rotation.y = ang;
  }

  reset() {
    this.mesh.visible = false;
    this.set(1, 0);
  }
}
