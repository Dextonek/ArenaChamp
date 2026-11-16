import * as THREE from 'three';

/**
 * The weather kit (pipeline/designs/kit-weather.md): Barry Cloudsley, the cheerful TV weatherman. Sky blue, sunshine yellow, a
 * mint wind, cloud white and a storm grey. Weather is an index everywhere: 0 rain, 1 sun, 2 wind (`src/traits/weather.ts`).
 *
 * `rainLook` / `sunLook` / `windLook` = the layer of weather across the whole arena (`Trait.markLook`): each is a few hundred quads
 * moved entirely in a vertex shader from one time uniform, so nothing is allocated or written per frame, and `driveWeather` is the
 * one call that sets the time, the wind and the fades. `cardLook` = the big weather card over Barry. `Specks` / `Dots` = pooled
 * round points (`Specks` fly on their own, `Dots` are placed by the caller). `GustHead` = the cold front's flying head,
 * `ThunderCloud` = a grinning cloud, `Lightning` = a jagged bolt, `Tornado` = a tall funnel with debris, `Pointer` = his pointer stick.
 * Everything is pooled or built once, has `reset()` where it holds state, and stays under the bloom threshold.
 */

export const WEATHER = {
  core: 0xffffff,
  accent: 0x6ac8ff,
  foil: 0xf4e65a,
  rain: 0x6ac8ff,
  sun: 0xf4e65a,
  wind: 0xb8f0d0,
  cloud: 0xe4edf8,
  grey: 0x7b8aa2,
  storm: 0x4a5870,
  dark: 0x16233b,
  suit: 0x2f5ea8,
} as const;

export const WEATHER_CSS = {
  core: '#ffffff',
  accent: '#6ac8ff',
  foil: '#f4e65a',
  rain: '#6ac8ff',
  sun: '#f4e65a',
  wind: '#b8f0d0',
  cloud: '#e4edf8',
  grey: '#7b8aa2',
  storm: '#4a5870',
  dark: '#16233b',
  suit: '#2f5ea8',
} as const;

/** Per weather index: its word and its colour (css and number). */
export const WEATHER_WORDS = ['RAIN', 'SUN', 'WIND'] as const;
export const WEATHER_CSS_OF = [WEATHER_CSS.rain, WEATHER_CSS.sun, WEATHER_CSS.wind] as const;
export const WEATHER_HEX_OF = [WEATHER.rain, WEATHER.sun, WEATHER.wind] as const;

const MIN = 1e-4;
const SZ = new THREE.Vector2();

// ---------------------------------------------------------------------------------------------------------------
// Canvas pictures: the weather icons, the cloud, the cards.
// ---------------------------------------------------------------------------------------------------------------

function canvasTex(w: number, h: number, draw: (g: CanvasRenderingContext2D, w: number, h: number) => void) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d')!, w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** A puffy cloud centred at (cx, cy), `r` its half-width, with a shaded underside. Exported for the kit's icons. */
export function paintCloud(g: CanvasRenderingContext2D, cx: number, cy: number, r: number, fill: string = WEATHER_CSS.cloud, shade: string = WEATHER_CSS.grey) {
  const puffs: [number, number, number][] = [[-0.55, 0.12, 0.42], [-0.2, -0.22, 0.52], [0.28, -0.12, 0.48], [0.58, 0.14, 0.38], [0.02, 0.18, 0.5]];
  for (const pass of [0, 1]) {
    g.fillStyle = pass === 0 ? shade : fill;
    const dy = pass === 0 ? r * 0.1 : 0;
    for (const [px, py, pr] of puffs) {
      g.beginPath();
      g.arc(cx + px * r, cy + py * r + dy, pr * r, 0, Math.PI * 2);
      g.fill();
    }
    g.fillRect(cx - 0.55 * r, cy + 0.12 * r + dy, 1.13 * r, 0.42 * r);
  }
}

/** A weather icon (`w`: 0 rain, 1 sun, 2 wind) centred at (cx, cy) in a box of half-size `r`. Exported for the kit's icons. */
export function paintWeather(g: CanvasRenderingContext2D, w: number, cx: number, cy: number, r: number) {
  g.lineCap = 'round';
  g.lineJoin = 'round';
  if (w === 0) {
    paintCloud(g, cx, cy - r * 0.2, r * 0.82);
    g.strokeStyle = WEATHER_CSS.rain;
    g.lineWidth = r * 0.12;
    for (const [dx, dy] of [[-0.45, 0.5], [0, 0.62], [0.45, 0.5]]) {
      g.beginPath();
      g.moveTo(cx + dx * r + r * 0.12, cy + dy * r - r * 0.12);
      g.lineTo(cx + dx * r - r * 0.1, cy + dy * r + r * 0.32);
      g.stroke();
    }
  } else if (w === 1) {
    g.strokeStyle = WEATHER_CSS.sun;
    g.lineWidth = r * 0.14;
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      g.beginPath();
      g.moveTo(cx + Math.cos(a) * r * 0.66, cy + Math.sin(a) * r * 0.66);
      g.lineTo(cx + Math.cos(a) * r * 0.95, cy + Math.sin(a) * r * 0.95);
      g.stroke();
    }
    g.fillStyle = WEATHER_CSS.sun;
    g.beginPath();
    g.arc(cx, cy, r * 0.52, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = '#8a5a10';
    g.lineWidth = r * 0.06;
    g.beginPath();
    g.arc(cx, cy + r * 0.04, r * 0.3, 0.25, Math.PI - 0.25);
    g.stroke();
    g.fillStyle = '#8a5a10';
    for (const dx of [-0.18, 0.18]) {
      g.beginPath();
      g.arc(cx + dx * r, cy - r * 0.12, r * 0.05, 0, Math.PI * 2);
      g.fill();
    }
  } else {
    g.strokeStyle = WEATHER_CSS.wind;
    g.lineWidth = r * 0.13;
    for (const [dy, len] of [[-0.45, 0.8], [0, 1.0], [0.45, 0.7]]) {
      g.beginPath();
      g.moveTo(cx - r * len * 0.9, cy + dy * r);
      g.lineTo(cx + r * len * 0.35, cy + dy * r);
      g.arc(cx + r * len * 0.35, cy + dy * r - r * 0.2, r * 0.2, Math.PI / 2, -Math.PI * 0.9, true);
      g.stroke();
    }
  }
}

const cardTextures = new Map<string, THREE.CanvasTexture>();

/** The card for a mode ('next': the forecast, 'now': the change, 'sorry': it was wrong, 'update': the forecast was changed) and a weather. */
export function cardTexture(mode: string, w: number) {
  const key = `${mode}${w}`;
  let tex = cardTextures.get(key);
  if (tex) return tex;
  const top = mode === 'next' ? 'NEXT' : mode === 'now' ? 'AND NOW THE WEATHER' : mode === 'sorry' ? 'SORRY FOLKS' : 'NEW FORECAST';
  const word = WEATHER_WORDS[w];
  tex = canvasTex(512, 192, (g, cw, ch) => {
    g.lineJoin = 'round';
    // A TV weather card: a rounded white board with a dark blue edge and a gold stripe, the picture on the left.
    const rr = (x: number, y: number, ww: number, hh: number, r: number) => {
      g.beginPath();
      g.moveTo(x + r, y);
      g.arcTo(x + ww, y, x + ww, y + hh, r);
      g.arcTo(x + ww, y + hh, x, y + hh, r);
      g.arcTo(x, y + hh, x, y, r);
      g.arcTo(x, y, x + ww, y, r);
      g.closePath();
    };
    rr(8, 8, cw - 16, ch - 16, 26);
    g.fillStyle = WEATHER_CSS.dark;
    g.fill();
    rr(18, 18, cw - 36, ch - 36, 20);
    g.fillStyle = '#a9b6c6';
    g.fill();
    g.fillStyle = mode === 'sorry' ? '#ff8a6a' : WEATHER_CSS.foil;
    g.fillRect(18, 18, cw - 36, 10);
    rr(30, 40, 138, 122, 14);
    g.fillStyle = '#5d8fd0';
    g.fill();
    paintWeather(g, w, 99, 102, 52);
    g.fillStyle = WEATHER_CSS.dark;
    g.textBaseline = 'middle';
    g.textAlign = 'left';
    const small = top.length > 12;
    g.font = `900 ${small ? 30 : 36}px Impact, Arial Black, sans-serif`;
    g.fillText(top, 184, 66, cw - 210);
    g.font = '900 78px Impact, Arial Black, sans-serif';
    g.fillStyle = mode === 'sorry' ? '#c0392b' : '#1f4f9a';
    g.fillText(word, 184, 128, cw - 210);
  });
  cardTextures.set(key, tex);
  return tex;
}

/** The weather card over a hero (`Trait.markLook`: feet at y 0, so the sprite sits 3.3 m up). 2.4 m wide, drawn over everything. */
export function cardLook(mode: string, w: number): THREE.Object3D {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: cardTexture(mode, w), transparent: true, depthTest: false, depthWrite: false }));
  s.scale.set(2.4, 0.9, 1);
  s.position.y = 3.3;
  s.renderOrder = 7;
  const g = new THREE.Group();
  g.add(s);
  return g;
}

let cloudTex: THREE.CanvasTexture | null = null;
let stormTex: THREE.CanvasTexture | null = null;

function cloudTexture(storm: boolean) {
  if (storm ? stormTex : cloudTex) return (storm ? stormTex : cloudTex)!;
  const t = canvasTex(256, 192, (g, w, h) => {
    paintCloud(g, w * 0.5, h * 0.52, w * 0.42, storm ? '#8794ac' : WEATHER_CSS.cloud, storm ? '#4a5870' : '#a9b9cf');
    // The face: round eyes, a wide smile, rosy cheeks: he is cheerful, and so is his weather.
    g.fillStyle = WEATHER_CSS.dark;
    for (const dx of [-0.13, 0.13]) {
      g.beginPath();
      g.ellipse(w * (0.5 + dx), h * 0.5, w * 0.025, h * 0.045, 0, 0, Math.PI * 2);
      g.fill();
    }
    g.strokeStyle = WEATHER_CSS.dark;
    g.lineWidth = w * 0.018;
    g.lineCap = 'round';
    g.beginPath();
    g.arc(w * 0.5, h * 0.52, w * 0.11, 0.25, Math.PI - 0.25);
    g.stroke();
    g.fillStyle = 'rgba(255,140,150,0.55)';
    for (const dx of [-0.22, 0.22]) {
      g.beginPath();
      g.arc(w * (0.5 + dx), h * 0.58, w * 0.04, 0, Math.PI * 2);
      g.fill();
    }
    if (storm) {
      g.fillStyle = WEATHER_CSS.foil;
      g.beginPath();
      g.moveTo(w * 0.52, h * 0.7);
      g.lineTo(w * 0.44, h * 0.9);
      g.lineTo(w * 0.5, h * 0.88);
      g.lineTo(w * 0.46, h * 1.0);
      g.lineTo(w * 0.58, h * 0.8);
      g.lineTo(w * 0.52, h * 0.82);
      g.closePath();
      g.fill();
    }
  });
  if (storm) stormTex = t;
  else cloudTex = t;
  return t;
}

// ---------------------------------------------------------------------------------------------------------------
// Round points: Specks (fly by themselves) and Dots (placed by the caller). One shared point material shape.
// ---------------------------------------------------------------------------------------------------------------

function dotMaterial() {
  const m = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: { uScale: { value: 500 } },
    vertexShader: /* glsl */ `
      attribute float aSize; attribute vec4 aCol; varying vec4 vCol; uniform float uScale;
      void main() {
        vCol = aCol;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = aSize * uScale / max(0.1, -mv.z);
      }`,
    fragmentShader: /* glsl */ `
      varying vec4 vCol;
      void main() {
        float d = length(gl_PointCoord - 0.5) * 2.0;
        float a = vCol.a * (1.0 - smoothstep(0.55, 1.0, d));
        if (a < 0.01) discard;
        gl_FragColor = vec4(vCol.rgb, a);
      }`,
  });
  return m;
}

function pointsMesh(n: number) {
  const geo = new THREE.BufferGeometry();
  const pos = new THREE.BufferAttribute(new Float32Array(n * 3), 3).setUsage(THREE.DynamicDrawUsage);
  const size = new THREE.BufferAttribute(new Float32Array(n), 1).setUsage(THREE.DynamicDrawUsage);
  const col = new THREE.BufferAttribute(new Float32Array(n * 4), 4).setUsage(THREE.DynamicDrawUsage);
  geo.setAttribute('position', pos);
  geo.setAttribute('aSize', size);
  geo.setAttribute('aCol', col);
  const mat = dotMaterial();
  const mesh = new THREE.Points(geo, mat);
  mesh.frustumCulled = false;
  mesh.renderOrder = 5;
  // The point size is in world metres: scale it by the view each frame the mesh is drawn (no allocation).
  mesh.onBeforeRender = (renderer, _scene, camera) => {
    renderer.getDrawingBufferSize(SZ);
    mat.uniforms.uScale.value = SZ.y * 0.5 * (camera as THREE.PerspectiveCamera).projectionMatrix.elements[5];
  };
  return { mesh, pos, size, col };
}

const TMP = new THREE.Color();

/** Pooled round points that fly by themselves (gravity, drag, fade out). `spawn` takes the oldest when full. */
export class Specks {
  readonly mesh: THREE.Points;
  private posA: THREE.BufferAttribute;
  private sizeA: THREE.BufferAttribute;
  private colA: THREE.BufferAttribute;
  private vel: Float32Array;
  private life: Float32Array;
  private total: Float32Array;
  private size0: Float32Array;
  private rgb: Float32Array;
  private grav: Float32Array;
  private drag: Float32Array;
  private cursor = 0;

  constructor(private max = 80) {
    const p = pointsMesh(max);
    this.mesh = p.mesh;
    this.posA = p.pos;
    this.sizeA = p.size;
    this.colA = p.col;
    this.vel = new Float32Array(max * 3);
    this.life = new Float32Array(max);
    this.total = new Float32Array(max);
    this.size0 = new Float32Array(max);
    this.rgb = new Float32Array(max * 3);
    this.grav = new Float32Array(max);
    this.drag = new Float32Array(max);
    this.reset();
  }

  get busy() {
    for (let i = 0; i < this.max; i++) if (this.life[i] > 0) return true;
    return false;
  }

  spawn(x: number, y: number, z: number, vx: number, vy: number, vz: number, life: number, size: number, color: number, gravity = 0, drag = 0) {
    const i = this.cursor;
    this.cursor = (this.cursor + 1) % this.max;
    this.posA.setXYZ(i, x, y, z);
    this.vel[i * 3] = vx;
    this.vel[i * 3 + 1] = vy;
    this.vel[i * 3 + 2] = vz;
    this.life[i] = this.total[i] = Math.max(0.05, life);
    this.size0[i] = size;
    TMP.setHex(color);
    this.rgb[i * 3] = TMP.r;
    this.rgb[i * 3 + 1] = TMP.g;
    this.rgb[i * 3 + 2] = TMP.b;
    this.grav[i] = gravity;
    this.drag[i] = drag;
  }

  /** `n` points thrown out from (x, y, z) in a sphere (or a flat ring when `flat`), speeds up to `speed`. */
  burst(x: number, y: number, z: number, n: number, speed: number, life: number, size: number, color: number, gravity = 6, flat = false) {
    for (let k = 0; k < n; k++) {
      const a = Math.random() * Math.PI * 2, u = flat ? 0.15 : Math.random() * 2 - 1, r = Math.sqrt(1 - u * u), sp = speed * (0.4 + Math.random() * 0.6);
      this.spawn(x, y, z, Math.cos(a) * r * sp, (flat ? 0.4 + Math.random() * 0.4 : u) * sp, Math.sin(a) * r * sp, life * (0.6 + Math.random() * 0.4), size * (0.7 + Math.random() * 0.6), color, gravity, 1.2);
    }
  }

  update(dt: number) {
    let any = false;
    for (let i = 0; i < this.max; i++) {
      if (this.life[i] <= 0) continue;
      any = true;
      this.life[i] -= dt;
      if (this.life[i] <= 0) {
        this.colA.setXYZW(i, 0, 0, 0, 0);
        this.sizeA.setX(i, 0);
        continue;
      }
      const d = Math.exp(-this.drag[i] * dt);
      this.vel[i * 3] *= d;
      this.vel[i * 3 + 1] = this.vel[i * 3 + 1] * d - this.grav[i] * dt;
      this.vel[i * 3 + 2] *= d;
      let y = this.posA.getY(i) + this.vel[i * 3 + 1] * dt;
      if (y < 0.03) { y = 0.03; this.vel[i * 3 + 1] = 0; }
      this.posA.setXYZ(i, this.posA.getX(i) + this.vel[i * 3] * dt, y, this.posA.getZ(i) + this.vel[i * 3 + 2] * dt);
      const k = this.life[i] / this.total[i];
      this.colA.setXYZW(i, this.rgb[i * 3], this.rgb[i * 3 + 1], this.rgb[i * 3 + 2], Math.min(1, k * 2.5));
      this.sizeA.setX(i, this.size0[i] * (0.5 + 0.5 * k));
    }
    if (any) {
      this.posA.needsUpdate = true;
      this.sizeA.needsUpdate = true;
      this.colA.needsUpdate = true;
    }
  }

  reset() {
    this.life.fill(0);
    for (let i = 0; i < this.max; i++) {
      this.colA.setXYZW(i, 0, 0, 0, 0);
      this.sizeA.setX(i, 0);
    }
    this.posA.needsUpdate = this.sizeA.needsUpdate = this.colA.needsUpdate = true;
  }
}

/** Round points the caller places every frame (orbiting debris, a ring of sparks): `put` them, then `flush`. */
export class Dots {
  readonly mesh: THREE.Points;
  private posA: THREE.BufferAttribute;
  private sizeA: THREE.BufferAttribute;
  private colA: THREE.BufferAttribute;

  constructor(readonly max = 40) {
    const p = pointsMesh(max);
    this.mesh = p.mesh;
    this.posA = p.pos;
    this.sizeA = p.size;
    this.colA = p.col;
    this.hide(0);
    this.flush();
  }

  put(i: number, x: number, y: number, z: number, size: number, color: number, alpha = 1) {
    TMP.setHex(color);
    this.posA.setXYZ(i, x, y, z);
    this.sizeA.setX(i, size);
    this.colA.setXYZW(i, TMP.r, TMP.g, TMP.b, alpha);
  }

  /** Hides every point from index `from` on. */
  hide(from: number) {
    for (let i = from; i < this.max; i++) {
      this.sizeA.setX(i, 0);
      this.colA.setW(i, 0);
    }
  }

  flush() {
    this.posA.needsUpdate = this.sizeA.needsUpdate = this.colA.needsUpdate = true;
  }
}

// ---------------------------------------------------------------------------------------------------------------
// The weather across the arena (Trait.markLook): quads moved by the vertex shader from one time uniform.
// ---------------------------------------------------------------------------------------------------------------

/** Radius of the arena (`RING` in duel.ts is x 0, z 7, r 12): the layers fill a disc of this size round the mark's centre. */
const FIELD_R = 12;

interface Layer { w: number; mat: THREE.ShaderMaterial }
const layers: Layer[] = [];

/**
 * Sets the time, the wind direction (a unit vector across the arena) and each weather's fade (0..1) on every layer built so far.
 * One call a frame from the trait's `marks`: only uniforms change, nothing is allocated.
 */
export function driveWeather(time: number, windX: number, windZ: number, fades: ArrayLike<number>) {
  for (const l of layers) {
    const u = l.mat.uniforms;
    u.uTime.value = time;
    u.uWind.value.set(windX, windZ);
    u.uFade.value = fades[l.w];
  }
}

/** `n` quads, each its own four corners (position.xy = -1..1) and one random seed (aSeed, 0..1 x4). */
function quadField(n: number, seed: number) {
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(n * 12), sd = new Float32Array(n * 16), idx = new Uint16Array(n * 6);
  let s = seed >>> 0;
  const rnd = () => (s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296;
  const cx = [-1, 1, 1, -1], cy = [-1, -1, 1, 1];
  for (let i = 0; i < n; i++) {
    const a = rnd(), b = rnd(), c = rnd(), d = rnd();
    for (let k = 0; k < 4; k++) {
      pos[(i * 4 + k) * 3] = cx[k];
      pos[(i * 4 + k) * 3 + 1] = cy[k];
      sd.set([a, b, c, d], (i * 4 + k) * 4);
    }
    idx.set([i * 4, i * 4 + 1, i * 4 + 2, i * 4, i * 4 + 2, i * 4 + 3], i * 6);
  }
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('aSeed', new THREE.BufferAttribute(sd, 4));
  geo.setIndex(new THREE.BufferAttribute(idx, 1));
  return geo;
}

const PRELUDE = /* glsl */ `
  uniform float uTime; uniform vec2 uWind; uniform float uFade;
  attribute vec4 aSeed;
  varying vec2 vC; varying float vA; varying vec3 vCol; varying float vX;
  const float R = ${FIELD_R.toFixed(1)};
  float edge(vec2 xz) { return 1.0 - smoothstep(R * 0.72, R * 0.98, length(xz)); }
  vec3 faceX(vec3 wp) { return normalize(cross(vec3(0.0, 1.0, 0.0), normalize(cameraPosition - wp))); }
`;

function layerMesh(w: number, geo: THREE.BufferGeometry, vertex: string, fragment: string, additive: boolean, order: number) {
  const mat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    uniforms: { uTime: { value: 0 }, uWind: { value: new THREE.Vector2(1, 0) }, uFade: { value: 1 } },
    vertexShader: PRELUDE + vertex,
    fragmentShader: /* glsl */ `varying vec2 vC; varying float vA; varying vec3 vCol; varying float vX;\n` + fragment,
  });
  layers.push({ w, mat });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.frustumCulled = false;
  mesh.renderOrder = order;
  return mesh;
}

/**
 * Rain across the arena: 300 thin slanting streaks falling from 9 m (an alpha of at most 0.5, so the fighters show through) and 90
 * ripples on the floor. Pale blue. Feet at y 0, centred on the mark.
 */
export function rainLook(): THREE.Object3D {
  const root = new THREE.Group();
  const streaks = layerMesh(0, quadField(300, 11), /* glsl */ `
    void main() {
      vC = position.xy;
      float H = 9.0, speed = 15.0 + aSeed.z * 8.0;
      float ph = fract(uTime * speed / H + aSeed.w);
      float y = H * (1.0 - ph);
      float rr = sqrt(aSeed.x) * R, aa = aSeed.y * 6.2831853;
      vec2 slant = vec2(0.24, 0.1);
      vec3 p = vec3(cos(aa) * rr + slant.x * y, y, sin(aa) * rr + slant.y * y);
      vec3 axis = normalize(vec3(slant.x, 1.0, slant.y));
      vec3 wp = (modelMatrix * vec4(p, 1.0)).xyz;
      vec3 side = normalize(cross(axis, normalize(cameraPosition - wp)));
      wp += axis * (position.y * (0.55 + aSeed.z * 0.45)) + side * (position.x * 0.02);
      vA = 0.5 * uFade * smoothstep(0.0, 0.08, ph) * (1.0 - smoothstep(0.9, 1.0, ph)) * edge(vec2(cos(aa), sin(aa)) * rr) * (0.55 + 0.45 * aSeed.z);
      gl_Position = projectionMatrix * viewMatrix * vec4(wp, 1.0);
    }`, /* glsl */ `
    void main() {
      float a = vA * (1.0 - vC.x * vC.x) * (1.0 - 0.5 * abs(vC.y));
      gl_FragColor = vec4(0.74, 0.88, 1.0, a);
    }`, false, 2);
  const ripples = layerMesh(0, quadField(90, 29), /* glsl */ `
    void main() {
      vC = position.xy;
      float ph = fract(uTime * 1.15 + aSeed.w);
      float rr = sqrt(aSeed.x) * R * 0.95, aa = aSeed.y * 6.2831853;
      vec2 xz = vec2(cos(aa), sin(aa)) * rr;
      vec3 wp = (modelMatrix * vec4(xz.x, 0.045, xz.y, 1.0)).xyz + vec3(position.x, 0.0, position.y) * 0.7;
      vX = ph;
      vA = 0.55 * uFade * (1.0 - ph) * edge(xz);
      gl_Position = projectionMatrix * viewMatrix * vec4(wp, 1.0);
    }`, /* glsl */ `
    void main() {
      float d = length(vC), rn = 0.25 + 0.75 * vX;
      float ring = smoothstep(rn - 0.2, rn, d) * (1.0 - smoothstep(rn, rn + 0.05, d));
      gl_FragColor = vec4(0.8, 0.92, 1.0, vA * ring);
    }`, false, 1);
  root.add(ripples, streaks);
  return root;
}

/**
 * Sun across the arena: seven wide warm shafts lying slanted on the floor (additive, a slow drift and a slow pulse) and 80 gold motes
 * that rise and twinkle. Warm yellow, never above the bloom threshold.
 */
export function sunLook(): THREE.Object3D {
  const root = new THREE.Group();
  const shafts = layerMesh(1, quadField(7, 5), /* glsl */ `
    void main() {
      vC = position.xy;
      float ang = 0.62;
      vec2 along = vec2(cos(ang), sin(ang)), across = vec2(-along.y, along.x);
      float off = (aSeed.x * 2.0 - 1.0) * R * 0.9 + sin(uTime * 0.18 + aSeed.w * 6.28) * 2.0;
      float wid = 1.2 + aSeed.y * 2.6;
      vec2 xz = along * position.y * R * 1.15 + across * (off + position.x * wid);
      vX = 0.55 + 0.45 * sin(uTime * 0.55 + aSeed.z * 6.28);
      vA = 0.16 * uFade * vX;
      vec3 wp = (modelMatrix * vec4(xz.x, 0.03, xz.y, 1.0)).xyz;
      gl_Position = projectionMatrix * viewMatrix * vec4(wp, 1.0);
    }`, /* glsl */ `
    void main() {
      float a = vA * (1.0 - vC.x * vC.x) * (1.0 - smoothstep(0.55, 1.0, abs(vC.y)));
      gl_FragColor = vec4(1.0 * a, 0.88 * a, 0.45 * a, a);
    }`, true, 1);
  const motes = layerMesh(1, quadField(80, 77), /* glsl */ `
    void main() {
      vC = position.xy;
      float ph = fract(uTime * (0.1 + aSeed.z * 0.08) + aSeed.w);
      float rr = sqrt(aSeed.x) * R * 0.95, aa = aSeed.y * 6.2831853;
      vec2 xz = vec2(cos(aa), sin(aa)) * rr + vec2(sin(uTime * 0.7 + aSeed.w * 40.0), cos(uTime * 0.6 + aSeed.x * 30.0)) * 0.35;
      vec3 wp = (modelMatrix * vec4(xz.x, 0.2 + ph * 3.2, xz.y, 1.0)).xyz;
      vec3 r = faceX(wp), u = cross(normalize(cameraPosition - wp), r);
      wp += (r * position.x + u * position.y) * (0.07 + aSeed.z * 0.07);
      vA = 0.8 * uFade * sin(ph * 3.14159) * (0.5 + 0.5 * sin(uTime * 4.0 + aSeed.y * 50.0)) * edge(xz);
      gl_Position = projectionMatrix * viewMatrix * vec4(wp, 1.0);
    }`, /* glsl */ `
    void main() {
      float d = abs(vC.x) + abs(vC.y);
      float a = vA * pow(max(0.0, 1.0 - d), 1.6);
      gl_FragColor = vec4(1.0 * a, 0.92 * a, 0.5 * a, a);
    }`, true, 3);
  root.add(shafts, motes);
  return root;
}

/**
 * Wind across the arena: 90 leaves (green, orange, tan) tumbling along the wind with a bob, and 70 long thin dust streaks that run
 * faster at the height of a hero's knees. `driveWeather` sets the direction. Soft, and never a wall.
 */
export function windLook(): THREE.Object3D {
  const root = new THREE.Group();
  const dust = layerMesh(2, quadField(70, 303), /* glsl */ `
    void main() {
      vC = position.xy;
      vec2 wd = normalize(uWind + vec2(0.0001)), pd = vec2(-wd.y, wd.x);
      float u = fract(uTime * (7.0 + aSeed.z * 5.0) / (R * 2.4) + aSeed.w);
      vec2 xz = wd * ((u * 2.0 - 1.0) * R * 1.2) + pd * ((aSeed.x * 2.0 - 1.0) * R * 0.95);
      vec3 axis = vec3(wd.x, 0.0, wd.y);
      vec3 wp = (modelMatrix * vec4(xz.x, 0.15 + aSeed.y * 1.3, xz.y, 1.0)).xyz;
      vec3 side = normalize(cross(axis, normalize(cameraPosition - wp)));
      wp += axis * (position.x * (1.2 + aSeed.z * 1.6)) + side * (position.y * 0.03);
      vA = 0.3 * uFade * edge(xz) * sin(u * 3.14159);
      gl_Position = projectionMatrix * viewMatrix * vec4(wp, 1.0);
    }`, /* glsl */ `
    void main() {
      float a = vA * (1.0 - vC.x * vC.x * vC.x * vC.x) * (1.0 - abs(vC.y));
      gl_FragColor = vec4(0.88, 0.9, 0.78, a);
    }`, false, 1);
  const leaves = layerMesh(2, quadField(90, 411), /* glsl */ `
    void main() {
      vC = position.xy;
      vec2 wd = normalize(uWind + vec2(0.0001)), pd = vec2(-wd.y, wd.x);
      float u = fract(uTime * (4.5 + aSeed.z * 3.0) / (R * 2.4) + aSeed.w);
      vec2 xz = wd * ((u * 2.0 - 1.0) * R * 1.2) + pd * ((aSeed.x * 2.0 - 1.0) * R * 0.95 + sin(uTime * 1.7 + aSeed.w * 30.0) * 0.5);
      float y = 0.3 + aSeed.y * 1.6 + 0.3 * sin(uTime * 3.0 + aSeed.w * 40.0);
      vec3 wp = (modelMatrix * vec4(xz.x, y, xz.y, 1.0)).xyz;
      vec3 r = faceX(wp), up = cross(normalize(cameraPosition - wp), r);
      float an = uTime * (3.0 + aSeed.z * 4.0) + aSeed.w * 6.28;
      vec2 q = vec2(position.x * cos(an) - position.y * sin(an), position.x * sin(an) + position.y * cos(an));
      wp += (r * q.x + up * q.y) * (0.16 + aSeed.y * 0.1);
      float k = fract(aSeed.x * 7.0);
      vCol = k < 0.4 ? vec3(0.45, 0.72, 0.3) : (k < 0.75 ? vec3(0.88, 0.58, 0.24) : vec3(0.76, 0.68, 0.48));
      vA = 0.85 * uFade * edge(xz) * sin(u * 3.14159);
      gl_Position = projectionMatrix * viewMatrix * vec4(wp, 1.0);
    }`, /* glsl */ `
    void main() {
      float s = 1.0 - (vC.x * vC.x * 1.9 + vC.y * vC.y * 0.5);
      float a = vA * smoothstep(0.0, 0.12, s);
      gl_FragColor = vec4(vCol * (0.85 + 0.3 * vC.y), a);
    }`, false, 3);
  root.add(dust, leaves);
  return root;
}

// ---------------------------------------------------------------------------------------------------------------
// Cold Front: the flying head of the gust.
// ---------------------------------------------------------------------------------------------------------------

/**
 * The cold front's head: three thin helices wound round the line of flight, spinning, with a white puff at the middle (three squashed
 * spheres). It faces +Z; the caller points it with `place`. `tint` colours the helices (the weather it flies in).
 */
export class GustHead {
  readonly mesh = new THREE.Group();
  private spin = new THREE.Group();
  private mats: THREE.MeshBasicMaterial[] = [];
  private puff = new THREE.Group();

  constructor() {
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i <= 28; i++) {
      const u = i / 28, a = u * Math.PI * 5, r = 0.5 * (1 - u * 0.55);
      pts.push(new THREE.Vector3(Math.cos(a) * r, Math.sin(a) * r, 0.9 - u * 2.6));
    }
    const geo = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 56, 0.045, 5, false);
    for (let k = 0; k < 3; k++) {
      const mat = new THREE.MeshBasicMaterial({ color: WEATHER.core, transparent: true, opacity: 0.8, depthWrite: false });
      const m = new THREE.Mesh(geo, mat);
      m.rotation.z = (k / 3) * Math.PI * 2;
      this.mats.push(mat);
      this.spin.add(m);
    }
    const white = new THREE.MeshBasicMaterial({ color: 0xf4f9ff });
    for (const [x, y, z, s] of [[0, 0, 0.3, 0.36], [0.2, 0.08, -0.05, 0.28], [-0.2, -0.05, -0.1, 0.26]]) {
      const b = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 8), white);
      b.position.set(x, y, z);
      b.scale.set(s, s * 0.8, s * 1.2);
      this.puff.add(b);
    }
    this.mesh.add(this.spin, this.puff);
    this.mesh.visible = false;
  }

  /** At `pos`, flying along (dx, dz), `t` the clock for the spin, `k` the size 0..1, `tint` the helix colour. */
  place(pos: THREE.Vector3, dx: number, dz: number, t: number, k: number, tint: number) {
    this.mesh.visible = k > MIN;
    this.mesh.position.copy(pos);
    this.mesh.rotation.y = Math.atan2(dx, dz);
    this.mesh.scale.setScalar(Math.max(MIN, k));
    this.spin.rotation.z = -t * 16;
    for (const m of this.mats) m.color.setHex(tint);
    this.puff.rotation.z = t * 3;
  }

  hide() {
    this.mesh.visible = false;
  }
}

// ---------------------------------------------------------------------------------------------------------------
// Lightning Risk: a grinning storm cloud and a jagged bolt.
// ---------------------------------------------------------------------------------------------------------------

/** A cloud with a face (a sprite): `place(pos, width, opacity)`. `storm` is the dark one with a yellow bolt on its belly. */
export class ThunderCloud {
  readonly mesh: THREE.Sprite;

  constructor(storm = true) {
    this.mesh = new THREE.Sprite(new THREE.SpriteMaterial({ map: cloudTexture(storm), transparent: true, depthWrite: false }));
    this.mesh.renderOrder = 6;
    this.mesh.visible = false;
  }

  place(pos: THREE.Vector3, width: number, opacity: number) {
    this.mesh.visible = opacity > 0.01 && width > MIN;
    this.mesh.position.copy(pos);
    this.mesh.scale.set(Math.max(MIN, width), Math.max(MIN, width * 0.75), 1);
    (this.mesh.material as THREE.SpriteMaterial).opacity = opacity;
  }
}

const BOLT_SEGS = 14;

/**
 * A jagged bolt from the sky to the floor: two crossed vertical ribbons (so it reads from any angle), each with a white core and a
 * pale yellow glow. The shape is written into preallocated buffers by `strike(x, z, top)`; `fade` 0..1 sets the brightness.
 */
export class Lightning {
  readonly mesh = new THREE.Group();
  private geo: THREE.BufferGeometry;
  private posA: THREE.BufferAttribute;
  private mats: THREE.MeshBasicMaterial[] = [];

  constructor() {
    this.geo = new THREE.BufferGeometry();
    // 2 planes x BOLT_SEGS segments x 4 vertices.
    const n = 2 * BOLT_SEGS * 4;
    this.posA = new THREE.BufferAttribute(new Float32Array(n * 3), 3).setUsage(THREE.DynamicDrawUsage);
    this.geo.setAttribute('position', this.posA);
    const idx: number[] = [];
    for (let i = 0; i < 2 * BOLT_SEGS; i++) idx.push(i * 4, i * 4 + 1, i * 4 + 2, i * 4, i * 4 + 2, i * 4 + 3);
    this.geo.setIndex(idx);
    const glow = new THREE.MeshBasicMaterial({ color: WEATHER.foil, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide });
    this.mats.push(glow);
    const m = new THREE.Mesh(this.geo, glow);
    m.frustumCulled = false;
    m.renderOrder = 6;
    // The white core is the same strip drawn thinner by scaling it in x/z about the bolt's axis is not possible per vertex, so it is a copy.
    const coreGeo = this.geo.clone();
    this.coreA = coreGeo.getAttribute('position') as THREE.BufferAttribute;
    const core = new THREE.MeshBasicMaterial({ color: WEATHER.core, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide });
    this.mats.push(core);
    const c = new THREE.Mesh(coreGeo, core);
    c.frustumCulled = false;
    c.renderOrder = 7;
    this.mesh.add(m, c);
    this.mesh.visible = false;
  }

  private coreA: THREE.BufferAttribute;

  /** Draws a new jag from (x, top, z) down to the floor at (x, 0, z). */
  strike(x: number, z: number, top: number) {
    let px = x, pz = z;
    for (let s = 0; s < BOLT_SEGS; s++) {
      const y0 = top * (1 - s / BOLT_SEGS), y1 = top * (1 - (s + 1) / BOLT_SEGS);
      const nx = s === BOLT_SEGS - 1 ? x : x + (Math.random() - 0.5) * 1.6 * Math.sin(((s + 1) / BOLT_SEGS) * Math.PI), nz = s === BOLT_SEGS - 1 ? z : z + (Math.random() - 0.5) * 1.6 * Math.sin(((s + 1) / BOLT_SEGS) * Math.PI);
      for (let plane = 0; plane < 2; plane++) {
        const i = (plane * BOLT_SEGS + s) * 4;
        const ox = plane === 0 ? 1 : 0, oz = plane === 0 ? 0 : 1;
        const w0 = 0.34 - 0.2 * (s / BOLT_SEGS), w1 = 0.34 - 0.2 * ((s + 1) / BOLT_SEGS);
        this.posA.setXYZ(i, px - ox * w0, y0, pz - oz * w0);
        this.posA.setXYZ(i + 1, px + ox * w0, y0, pz + oz * w0);
        this.posA.setXYZ(i + 2, nx + ox * w1, y1, nz + oz * w1);
        this.posA.setXYZ(i + 3, nx - ox * w1, y1, nz - oz * w1);
        this.coreA.setXYZ(i, px - ox * w0 * 0.35, y0, pz - oz * w0 * 0.35);
        this.coreA.setXYZ(i + 1, px + ox * w0 * 0.35, y0, pz + oz * w0 * 0.35);
        this.coreA.setXYZ(i + 2, nx + ox * w1 * 0.35, y1, nz + oz * w1 * 0.35);
        this.coreA.setXYZ(i + 3, nx - ox * w1 * 0.35, y1, nz - oz * w1 * 0.35);
      }
      px = nx;
      pz = nz;
    }
    this.posA.needsUpdate = true;
    this.coreA.needsUpdate = true;
  }

  fade(k: number) {
    this.mesh.visible = k > 0.01;
    this.mats[0].opacity = 0.7 * k;
    this.mats[1].opacity = k;
  }
}

// ---------------------------------------------------------------------------------------------------------------
// Severe Warning: the tornado.
// ---------------------------------------------------------------------------------------------------------------

const TORNADO_H = 5.2;

/**
 * A tall tornado: a funnel (wide at the top, a narrow foot) with swirling dark and pale bands that wobble as it turns, 60 pieces of
 * debris (leaves, paper) orbiting it, and a skirt of dust at the foot. `set(x, z, k, t)` places it with `k` 0..1 the growth and fade;
 * `update(dt, t)` turns the debris. Translucent (at most 0.62) and never depth-writing, so a hero inside still shows.
 */
export class Tornado {
  readonly mesh = new THREE.Group();
  private funnel: THREE.Mesh;
  private mat: THREE.ShaderMaterial;
  private debris = new Dots(60);
  private dust = new Specks(40);
  private ang = new Float32Array(60);
  private hh = new Float32Array(60);
  private rr = new Float32Array(60);
  private kind = new Uint8Array(60);
  private x = 0;
  private z = 0;
  private k = 0;
  private dustT = 0;

  constructor() {
    this.mat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      uniforms: { uTime: { value: 0 }, uFade: { value: 0 } },
      vertexShader: /* glsl */ `
        uniform float uTime; varying vec2 vUv; varying float vH;
        void main() {
          vUv = uv;
          vec3 p = position;
          float h = p.y / ${TORNADO_H.toFixed(1)} + 0.5;
          vH = h;
          p.x += sin(uTime * 2.1 + h * 5.0) * 0.22 * h;
          p.z += cos(uTime * 1.7 + h * 4.0) * 0.18 * h;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
        }`,
      fragmentShader: /* glsl */ `
        uniform float uTime; uniform float uFade; varying vec2 vUv; varying float vH;
        void main() {
          float band = 0.5 + 0.5 * sin(vUv.x * 6.2831853 * 4.0 + vH * 11.0 - uTime * 9.0);
          float fine = 0.5 + 0.5 * sin(vUv.x * 6.2831853 * 11.0 - vH * 5.0 - uTime * 14.0);
          vec3 col = mix(vec3(0.27, 0.34, 0.46), vec3(0.86, 0.92, 0.98), pow(band, 2.2) * 0.8 + fine * 0.12);
          float a = uFade * (0.3 + 0.32 * band) * smoothstep(0.0, 0.1, vH) * (1.0 - 0.25 * vH);
          gl_FragColor = vec4(col, a);
        }`,
    });
    // A cylinder wide at the top (radius 2.2) narrowing to the foot (0.35): its feet at y 0.
    const geo = new THREE.CylinderGeometry(2.2, 0.35, TORNADO_H, 28, 10, true).translate(0, TORNADO_H / 2, 0);
    this.funnel = new THREE.Mesh(geo, this.mat);
    this.funnel.frustumCulled = false;
    this.funnel.renderOrder = 4;
    for (let i = 0; i < 60; i++) {
      this.ang[i] = i * 2.399;
      this.hh[i] = ((i * 37) % 60) / 60;
      this.rr[i] = 0.85 + (((i * 53) % 17) / 17) * 0.5;
      this.kind[i] = i % 5;
    }
    this.mesh.add(this.funnel, this.debris.mesh, this.dust.mesh);
    this.hide();
  }

  /** Radius of the funnel at height fraction h (0 foot, 1 top). */
  private static radius(h: number) {
    return 0.35 + 1.85 * h;
  }

  set(x: number, z: number, k: number) {
    this.x = x;
    this.z = z;
    this.k = k;
  }

  hide() {
    this.k = 0;
    this.funnel.visible = false;
    this.debris.hide(0);
    this.debris.flush();
    this.dust.reset();
  }

  /** Turns the funnel and the debris; `t` is a clock in seconds. */
  update(dt: number, t: number) {
    this.dust.update(dt);
    const k = this.k;
    this.funnel.visible = k > 0.01;
    if (k <= 0.01) {
      this.debris.hide(0);
      this.debris.flush();
      return;
    }
    this.funnel.position.set(this.x, 0, this.z);
    this.funnel.scale.set(Math.max(MIN, k), Math.max(MIN, 0.4 + 0.6 * k), Math.max(MIN, k));
    this.mat.uniforms.uTime.value = t;
    this.mat.uniforms.uFade.value = Math.min(1, k * 1.4);
    for (let i = 0; i < 60; i++) {
      const h = this.hh[i], r = Tornado.radius(h) * this.rr[i] * k, a = this.ang[i] + t * (4.2 - h * 2.4);
      const col = this.kind[i] === 0 ? 0x8fbf6a : this.kind[i] === 1 ? 0xd08a3c : this.kind[i] === 2 ? 0xf4f9ff : this.kind[i] === 3 ? 0xb5a070 : 0xdfe6ef;
      this.debris.put(i, this.x + Math.cos(a) * r, 0.2 + h * TORNADO_H * (0.4 + 0.6 * k), this.z + Math.sin(a) * r, 0.2 + (i % 3) * 0.06, col, Math.min(1, k * 1.5));
    }
    this.debris.flush();
    // A skirt of dust thrown out round the foot.
    this.dustT += dt;
    if (this.dustT > 0.05) {
      this.dustT = 0;
      const a = Math.random() * Math.PI * 2;
      this.dust.spawn(this.x + Math.cos(a) * 0.5, 0.15, this.z + Math.sin(a) * 0.5, Math.cos(a + 1.4) * 2.4, 0.9, Math.sin(a + 1.4) * 2.4, 0.9, 0.7 * k, 0xcfc6ae, -0.6, 1.1);
    }
  }
}

// ---------------------------------------------------------------------------------------------------------------
// The pointer stick.
// ---------------------------------------------------------------------------------------------------------------

/** A weatherman's telescoping pointer: a long thin stick with a dark handle and a bright yellow tip. `aim(from, to, extend)` sets it. */
export class Pointer {
  readonly mesh = new THREE.Group();
  private stick: THREE.Mesh;
  private tip: THREE.Mesh;
  private v = new THREE.Vector3();

  constructor() {
    this.stick = new THREE.Mesh(
      new THREE.CylinderGeometry(0.025, 0.04, 1, 8).rotateX(Math.PI / 2).translate(0, 0, 0.5),
      new THREE.MeshBasicMaterial({ color: 0xd9e2ee }),
    );
    this.tip = new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 8), new THREE.MeshBasicMaterial({ color: WEATHER.foil }));
    this.mesh.add(this.stick, this.tip);
    this.mesh.visible = false;
  }

  /** The stick from `from` toward `to`, `extend` 0..1 of the full way (0 hides it). */
  aim(from: THREE.Vector3, to: THREE.Vector3, extend: number) {
    this.mesh.visible = extend > 0.01;
    this.mesh.position.copy(from);
    this.v.copy(to).sub(from);
    const len = Math.max(MIN, this.v.length());
    this.mesh.lookAt(to);
    this.stick.scale.set(1, 1, len * extend);
    this.tip.position.set(0, 0, len * extend);
  }
}
