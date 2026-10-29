import * as THREE from 'three';

/**
 * The alchemy kit (pipeline/designs/kit-alchemy.md): thin glass flasks that shatter into flat glass shards, bubbling
 * acid that swells and pops into rings, dark fume curls, a glass-ink alchemical circle as the pale foil, and the gold of
 * the transmutation. Everything is pooled, takes world-space positions and has a `reset()`. All materials are custom
 * toon shaders with values below the bloom threshold (~0.85) except a few tiny specular dots.
 */

/** Palette (kit-alchemy.md). Numbers for `THREE.Color`, `ALCHEMY_CSS` for APIs that want a string. */
export const ALCHEMY = {
  core: 0xf4ffe0,
  hot: 0xc8ff4a,
  body: 0x4fbf2a,
  accent: 0xff5ad8,
  dark: 0x0c1606,
  glass: 0xdcefe6,
  gold: 0xe8b84a,
} as const;

export const ALCHEMY_CSS = {
  core: '#f4ffe0',
  hot: '#c8ff4a',
  body: '#4fbf2a',
  accent: '#ff5ad8',
  dark: '#0c1606',
  glass: '#dcefe6',
  gold: '#e8b84a',
} as const;

const MIN_SCALE = 1e-4;
const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const easeOut = (x: number) => 1 - Math.pow(1 - clamp01(x), 3);
const rnd = (a: number, b: number) => a + Math.random() * (b - a);

// ---------------------------------------------------------------------------------------------------------------
// Shared shaders
// ---------------------------------------------------------------------------------------------------------------

/** Vertex stage for lit meshes: works instanced or not (non-uniform instance scale handled via the inverse-transpose). */
const litVertex = /* glsl */ `
  varying vec3 vN; varying vec3 vView;
  void main() {
    #ifdef USE_INSTANCING
      vec4 lp = instanceMatrix * vec4(position, 1.0);
      vec3 c0 = instanceMatrix[0].xyz, c1 = instanceMatrix[1].xyz, c2 = instanceMatrix[2].xyz;
      vec3 ln = c0 * (normal.x / max(dot(c0, c0), 1e-10)) + c1 * (normal.y / max(dot(c1, c1), 1e-10))
              + c2 * (normal.z / max(dot(c2, c2), 1e-10));
    #else
      vec4 lp = vec4(position, 1.0);
      vec3 ln = normal;
    #endif
    vec4 mv = modelViewMatrix * lp;
    vec3 n = normalMatrix * ln;
    vN = n / max(length(n), 1e-6);
    vView = normalize(-mv.xyz);
    gl_Position = projectionMatrix * mv;
  }`;

/** The kit's acid: smooth, dark-green rim, one thin hot-green rim line, a pinpoint specular dot. */
const liquidFragment = /* glsl */ `
  uniform vec3 uBody, uDark, uHot, uCore;
  varying vec3 vN; varying vec3 vView;
  void main() {
    vec3 n = normalize(vN), v = normalize(vView);
    vec3 L = normalize(vec3(-0.45, 0.65, 0.6));
    float ndl = dot(n, L);
    float f = 1.0 - abs(dot(n, v));
    vec3 col = uBody;
    col = mix(col, uDark, step(ndl, 0.0) * 0.5);
    col = mix(col, uHot, step(0.55, ndl) * 0.3);
    if (f > 0.46 && ndl > -0.15) col = uHot;
    if (f > 0.74) col = uDark;
    float spec = dot(n, normalize(L + v));
    if (spec > 0.987 && f < 0.5) col = uCore * 0.92;
    gl_FragColor = vec4(col, 1.0);
  }`;

/** `bodyMix` 1 = full acid green, lower values darken the body (the liquid inside a flask is darker). */
function liquidMaterial(bodyMix = 1) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uBody: { value: new THREE.Color(ALCHEMY.dark).lerp(new THREE.Color(ALCHEMY.body), bodyMix) },
      uDark: { value: new THREE.Color(ALCHEMY.dark) },
      uHot: { value: new THREE.Color(ALCHEMY.hot) },
      uCore: { value: new THREE.Color(ALCHEMY.core) },
    },
    vertexShader: litVertex,
    fragmentShader: liquidFragment,
  });
}

/** Low-opacity pale glass with a bright fresnel rim and a pinpoint highlight. */
function glassMaterial() {
  return new THREE.ShaderMaterial({
    transparent: true, depthWrite: false,
    uniforms: { uGlass: { value: new THREE.Color(ALCHEMY.glass) }, uCore: { value: new THREE.Color(ALCHEMY.core) } },
    vertexShader: litVertex,
    fragmentShader: /* glsl */ `
      uniform vec3 uGlass, uCore; varying vec3 vN; varying vec3 vView;
      void main() {
        vec3 n = normalize(vN), v = normalize(vView);
        float f = 1.0 - abs(dot(n, v));
        float a = 0.1 + 0.62 * smoothstep(0.45, 0.78, f);
        vec3 col = mix(uGlass * 0.92, uCore, smoothstep(0.78, 0.93, f));
        vec3 L = normalize(vec3(-0.45, 0.65, 0.6));
        if (dot(n, normalize(L + v)) > 0.988) { col = uCore; a = 0.95; }
        gl_FragColor = vec4(col, a);
      }`,
  });
}

// ---------------------------------------------------------------------------------------------------------------
// Flask
// ---------------------------------------------------------------------------------------------------------------

function lathe(points: [number, number][], dy: number) {
  return new THREE.LatheGeometry(points.map(([x, y]) => new THREE.Vector2(x, y)), 20).translate(0, dy, 0);
}

let flaskGeo: { glass: THREE.BufferGeometry; liquid: THREE.BufferGeometry; cork: THREE.BufferGeometry } | null = null;
let flaskMats: { glass: THREE.ShaderMaterial; liquid: THREE.ShaderMaterial; cork: THREE.MeshBasicMaterial } | null = null;

/**
 * A thin-walled round flask (body radius 0.5, about 1.6 tall at scale 1, origin at the middle of the body): pale
 * glass shell with a bright rim, dark acid inside that sloshes, a cork. `scale` sets the size, `slosh(t, amount)`
 * moves the liquid, `lob(from, to, height, u)` flies it along an arc (u 0..1) and spins it. Add `mesh` to the group.
 */
export class Flask {
  readonly mesh = new THREE.Group();
  private liquid: THREE.Mesh;

  constructor() {
    flaskGeo ??= {
      glass: lathe([[0.001, 0], [0.26, 0.02], [0.43, 0.12], [0.5, 0.34], [0.46, 0.58], [0.33, 0.76], [0.17, 0.9], [0.14, 1.1], [0.19, 1.17]], -0.4),
      liquid: lathe([[0.001, 0], [0.23, 0.015], [0.38, 0.11], [0.455, 0.3], [0.43, 0.44], [0.001, 0.44]], -0.38),
      cork: new THREE.CylinderGeometry(0.17, 0.14, 0.2, 10),
    };
    flaskMats ??= {
      glass: glassMaterial(), liquid: liquidMaterial(0.6), cork: new THREE.MeshBasicMaterial({ color: 0x6b5232 }),
    };
    this.liquid = new THREE.Mesh(flaskGeo.liquid, flaskMats.liquid);
    const glass = new THREE.Mesh(flaskGeo.glass, flaskMats.glass);
    glass.renderOrder = 3;
    const cork = new THREE.Mesh(flaskGeo.cork, flaskMats.cork);
    cork.position.y = 0.82;
    this.mesh.add(this.liquid, cork, glass);
    for (const m of [this.liquid, glass, cork]) m.frustumCulled = false;
    this.mesh.visible = false;
  }

  /** World size multiplier (1 = body radius 0.5). */
  set scale(s: number) {
    this.mesh.scale.setScalar(Math.max(s, MIN_SCALE));
  }

  /** Liquid slosh: a tilt and a squash that wobble with `t`. */
  slosh(t: number, amount = 1) {
    this.liquid.rotation.z = Math.sin(t * 7) * 0.14 * amount;
    this.liquid.rotation.x = Math.cos(t * 5.3) * 0.1 * amount;
    this.liquid.scale.y = 1 + Math.sin(t * 9 + 1) * 0.06 * amount;
  }

  /** Flies the flask on an arc from `from` to `to`, `height` above the straight line at the top; u 0..1. Spins it. */
  lob(from: THREE.Vector3, to: THREE.Vector3, height: number, u: number) {
    const k = clamp01(u);
    this.mesh.position.lerpVectors(from, to, k);
    this.mesh.position.y += 4 * height * k * (1 - k);
    this.mesh.rotation.set(k * 9, 0, k * 5);
  }

  reset() {
    this.mesh.visible = false;
    this.mesh.rotation.set(0, 0, 0);
  }
}

// ---------------------------------------------------------------------------------------------------------------
// GlassShards
// ---------------------------------------------------------------------------------------------------------------

interface Shard {
  alive: boolean; pos: THREE.Vector3; vel: THREE.Vector3; axis: THREE.Vector3; angle: number; spin: number;
  age: number; life: number; sx: number; sy: number;
}

export interface GlassShardsOptions {
  /** Pool size. Default 96. */
  max?: number;
  /** Face colour. Default pale glass. */
  color?: THREE.ColorRepresentation;
  /** Edge-line colour. Default the core white-green. */
  edge?: THREE.ColorRepresentation;
  /** 0..1. Below 1 the shards are see-through glass; 1 is opaque (gold flakes). Default 0.82. */
  opacity?: number;
}

function shardGeometry() {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute([0, 0.55, 0, -0.32, -0.45, 0, 0.36, -0.35, 0], 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute([0, 0, 1, 0, 0, 1, 0, 0, 1], 3));
  g.setAttribute('aBary', new THREE.Float32BufferAttribute([1, 0, 0, 0, 1, 0, 0, 0, 1], 3));
  return g;
}

/**
 * Instanced flat triangles with gravity and spin: glass shards (pale, see-through, a bright edge line) or, with
 * another colour and `opacity` 1, gold flakes. `burst(pos, count, speed)` throws a spray with a short life.
 */
export class GlassShards {
  readonly mesh: THREE.InstancedMesh;
  gravity = -14;
  private shards: Shard[] = [];
  private cursor = 0;
  private m = new THREE.Matrix4();
  private q = new THREE.Quaternion();
  private s = new THREE.Vector3();

  constructor(opts: GlassShardsOptions = {}) {
    const max = opts.max ?? 96;
    const opacity = opts.opacity ?? 0.82;
    const mat = new THREE.ShaderMaterial({
      transparent: opacity < 1, depthWrite: opacity >= 1, side: THREE.DoubleSide,
      uniforms: {
        uColor: { value: new THREE.Color(opts.color ?? ALCHEMY.glass) },
        uEdge: { value: new THREE.Color(opts.edge ?? ALCHEMY.core) },
        uOpacity: { value: opacity },
      },
      vertexShader: /* glsl */ `
        attribute vec3 aBary;
        varying vec3 vBary; varying vec3 vN;
        void main() {
          vec4 lp = instanceMatrix * vec4(position, 1.0);
          vec3 n = normalMatrix * (mat3(instanceMatrix) * normal);
          vN = n / max(length(n), 1e-6);
          vBary = aBary;
          gl_Position = projectionMatrix * modelViewMatrix * lp;
        }`,
      fragmentShader: /* glsl */ `
        uniform vec3 uColor, uEdge; uniform float uOpacity;
        varying vec3 vBary; varying vec3 vN;
        void main() {
          vec3 L = normalize(vec3(-0.45, 0.65, 0.6));
          float a = abs(dot(normalize(vN), L));
          vec3 col = uColor * (a > 0.5 ? 1.0 : 0.74);
          float e = min(vBary.x, min(vBary.y, vBary.z));
          float w = max(fwidth(e), 1e-4);
          float edge = 1.0 - smoothstep(w * 1.5, w * 3.0, e);
          col = mix(col, uEdge, edge);
          gl_FragColor = vec4(col, mix(uOpacity, 1.0, edge));
        }`,
    });
    this.mesh = new THREE.InstancedMesh(shardGeometry(), mat, max);
    this.mesh.frustumCulled = false;
    this.mesh.count = 0;
    for (let i = 0; i < max; i++) {
      this.shards.push({
        alive: false, pos: new THREE.Vector3(), vel: new THREE.Vector3(), axis: new THREE.Vector3(1, 0, 0),
        angle: 0, spin: 0, age: 0, life: 1, sx: 0.2, sy: 0.2,
      });
    }
  }

  /** A spray of `count` shards from `pos` at about `speed`. Options: `size` (default 0.2), `life` (0.55 s), `up` extra lift. */
  burst(pos: THREE.Vector3, count: number, speed: number, opts: { size?: number; life?: number; up?: number } = {}) {
    const { size = 0.2, life = 0.55, up = 0.5 } = opts;
    for (let i = 0; i < count; i++) {
      const sh = this.shards[this.cursor];
      this.cursor = (this.cursor + 1) % this.shards.length;
      sh.alive = true;
      sh.pos.copy(pos);
      sh.vel.set(Math.random() - 0.5, Math.random() * 0.8 + up * 0.4, Math.random() - 0.5).normalize()
        .multiplyScalar(speed * rnd(0.45, 1.2));
      sh.vel.y += speed * 0.25;
      sh.axis.randomDirection();
      sh.angle = Math.random() * 6;
      sh.spin = (Math.random() - 0.5) * 22;
      sh.age = 0;
      sh.life = life * rnd(0.8, 1.5);
      const sz = size * rnd(0.7, 1.35);
      sh.sx = sz * rnd(0.6, 1.0);
      sh.sy = sz * rnd(1.0, 1.7);
    }
  }

  reset() {
    for (const sh of this.shards) sh.alive = false;
    this.mesh.count = 0;
  }

  update(dt: number) {
    let k = 0;
    for (const sh of this.shards) {
      if (!sh.alive) continue;
      sh.age += dt;
      if (sh.age >= sh.life) { sh.alive = false; continue; }
      sh.vel.y += this.gravity * dt;
      sh.pos.addScaledVector(sh.vel, dt);
      if (sh.pos.y < 0.03) { sh.pos.y = 0.03; sh.vel.multiplyScalar(0.2); sh.vel.y = 0; sh.spin *= 0.2; }
      sh.angle += sh.spin * dt;
      this.q.setFromAxisAngle(sh.axis, sh.angle);
      const shrink = 1 - Math.pow(clamp01((sh.age / sh.life - 0.55) / 0.45), 2);
      this.m.compose(sh.pos, this.q, this.s.set(Math.max(sh.sx * shrink, MIN_SCALE), Math.max(sh.sy * shrink, MIN_SCALE), 1));
      this.mesh.setMatrixAt(k++, this.m);
    }
    this.mesh.count = k;
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}

// ---------------------------------------------------------------------------------------------------------------
// Bubbles
// ---------------------------------------------------------------------------------------------------------------

interface Bub {
  live: boolean; state: 0 | 1; pos: THREE.Vector3; vel: THREE.Vector3; size: number; age: number; life: number;
  popAge: number; rise: number; seed: number;
}

/**
 * Instanced acid bubbles (the kit's liquid look on small spheres): they rise, swell, then pop into a thin hot-green
 * ring that expands and fades. `emit(pos, size)` starts one, `splash(pos, size)` is just the pop ring. Add `mesh`.
 */
export class Bubbles {
  readonly mesh = new THREE.Group();
  /** Default rise speed (world units / s). */
  rise = 0.9;
  private spheres: THREE.InstancedMesh;
  private rings: THREE.InstancedMesh;
  private ringAlpha: THREE.InstancedBufferAttribute;
  private bubs: Bub[] = [];
  private cursor = 0;
  private m = new THREE.Matrix4();
  private q = new THREE.Quaternion();
  private s = new THREE.Vector3();

  constructor(max = 48) {
    this.spheres = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 2), liquidMaterial(), max);
    const ringGeo = new THREE.RingGeometry(0.78, 1, 28);
    this.ringAlpha = new THREE.InstancedBufferAttribute(new Float32Array(max), 1);
    this.ringAlpha.setUsage(THREE.DynamicDrawUsage);
    ringGeo.setAttribute('aA', this.ringAlpha);
    this.rings = new THREE.InstancedMesh(ringGeo, new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, side: THREE.DoubleSide,
      uniforms: { uHot: { value: new THREE.Color(ALCHEMY.hot) }, uGlass: { value: new THREE.Color(ALCHEMY.glass) } },
      vertexShader: /* glsl */ `
        attribute float aA; varying float vA;
        void main() {
          vA = aA;
          vec4 c = instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
          float s = length(instanceMatrix[0].xyz);
          vec4 mv = modelViewMatrix * c;
          mv.xy += position.xy * s;
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: /* glsl */ `
        uniform vec3 uHot, uGlass; varying float vA;
        void main() { gl_FragColor = vec4(mix(uHot, uGlass, 0.3), vA); }`,
    }), max);
    for (const im of [this.spheres, this.rings]) { im.frustumCulled = false; im.count = 0; this.mesh.add(im); }
    for (let i = 0; i < max; i++) {
      this.bubs.push({
        live: false, state: 0, pos: new THREE.Vector3(), vel: new THREE.Vector3(), size: 0.2, age: 0, life: 1,
        popAge: 0, rise: 0.9, seed: 0,
      });
    }
  }

  private take(): Bub {
    const b = this.bubs[this.cursor];
    this.cursor = (this.cursor + 1) % this.bubs.length;
    return b;
  }

  /** A bubble of radius `size` at `pos`. Options: `life` (s until it pops), `vel` initial velocity (fades fast), `rise` override. */
  emit(pos: THREE.Vector3, size: number, opts: { life?: number; vel?: THREE.Vector3; rise?: number } = {}) {
    const b = this.take();
    b.live = true; b.state = 0; b.pos.copy(pos); b.vel.copy(opts.vel ?? this.zero());
    b.size = Math.max(size, 0.06); b.age = 0; b.life = opts.life ?? rnd(0.6, 1.1); b.popAge = 0;
    b.rise = opts.rise ?? this.rise; b.seed = Math.random() * 6.28;
  }

  /** Just the pop ring at `pos` (a tiny splash). */
  splash(pos: THREE.Vector3, size: number) {
    const b = this.take();
    b.live = true; b.state = 1; b.pos.copy(pos); b.vel.set(0, 0, 0);
    b.size = Math.max(size, 0.06); b.age = 0; b.life = 0; b.popAge = 0; b.rise = 0; b.seed = 0;
  }

  private z = new THREE.Vector3();
  private zero() {
    return this.z.set(0, 0, 0);
  }

  reset() {
    for (const b of this.bubs) b.live = false;
    this.spheres.count = 0;
    this.rings.count = 0;
  }

  update(dt: number) {
    let ks = 0, kr = 0;
    const alpha = this.ringAlpha.array as Float32Array;
    for (const b of this.bubs) {
      if (!b.live) continue;
      b.age += dt;
      if (b.state === 0) {
        b.vel.multiplyScalar(Math.exp(-3 * dt));
        b.pos.addScaledVector(b.vel, dt);
        if (b.rise > 0) {
          b.pos.y += b.rise * dt;
          b.pos.x += Math.sin(b.age * 5 + b.seed) * 0.15 * dt;
        }
        const u = b.age / Math.max(b.life, 1e-3);
        if (u < 1) {
          this.m.compose(b.pos, this.q, this.s.setScalar(Math.max(b.size * (0.5 + 0.85 * u), MIN_SCALE)));
          this.spheres.setMatrixAt(ks++, this.m);
          continue;
        }
        b.state = 1;
        b.popAge = 0;
      }
      b.popAge += dt;
      const pp = b.popAge / 0.2;
      if (pp >= 1) { b.live = false; continue; }
      const r = b.size * 1.35 * (1 + easeOut(pp));
      this.m.compose(b.pos, this.q, this.s.setScalar(Math.max(r, MIN_SCALE)));
      alpha[kr] = 1 - pp * pp;
      this.rings.setMatrixAt(kr++, this.m);
    }
    this.spheres.count = ks;
    this.rings.count = kr;
    this.spheres.instanceMatrix.needsUpdate = true;
    this.rings.instanceMatrix.needsUpdate = true;
    this.ringAlpha.needsUpdate = true;
  }
}

// ---------------------------------------------------------------------------------------------------------------
// AcidPool
// ---------------------------------------------------------------------------------------------------------------

/**
 * A ground decal of bubbling acid with a lumpy edge: dark outer band, green body, one hot-green rim line on the light
 * side and a faint pale meniscus line. `spread(center, radius, seconds)` flows it out, `boil` (bubbles per second at full
 * size) makes it bubble (big round bubbles that swell and pop into rings), `drain(seconds)` shrinks and darkens it to a
 * stain and fades it. `update(dt)` every frame. Add `mesh`.
 */
export class AcidPool {
  readonly mesh = new THREE.Group();
  readonly bubbles: Bubbles;
  /** Bubbles per second once fully spread. */
  boil = 6;
  /** Largest bubble radius. */
  bubbleSize = 0.3;
  /** Height above the floor (set `order` too when two pools overlap). */
  y = 0.035;
  private decal: THREE.Mesh;
  private mat: THREE.ShaderMaterial;
  private radius = 1;
  private spreadDur = 0.4;
  private spreadAge = -1;
  private drainDur = 0.6;
  private drainAge = -1;
  private acc = 0;
  private time = 0;
  private seed = Math.random() * 6.28;
  private p = new THREE.Vector3();

  constructor(maxBubbles = 40) {
    this.mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
      uniforms: {
        uBody: { value: new THREE.Color(ALCHEMY.body) }, uDark: { value: new THREE.Color(ALCHEMY.dark) },
        uHot: { value: new THREE.Color(ALCHEMY.hot) }, uGlass: { value: new THREE.Color(ALCHEMY.glass) },
        uTime: { value: 0 }, uState: { value: new THREE.Vector4(0, 0, 0, 0) },
      },
      vertexShader: /* glsl */ `
        varying vec2 vUv;
        void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: /* glsl */ `
        uniform vec3 uBody, uDark, uHot, uGlass; uniform float uTime; uniform vec4 uState;
        varying vec2 vUv;
        void main() {
          vec2 p = vUv * 2.0 - 1.0;
          float r = length(p), a = atan(p.y, p.x), sd = uState.z;
          float lump = 1.0 + 0.14 * sin(a * 3.0 + sd * 6.0) + 0.08 * sin(a * 5.0 + sd * 11.0) + 0.05 * sin(a * 9.0 + sd * 3.0);
          float R = 0.74 * uState.x * (1.0 - 0.28 * uState.y) * lump;
          float wet = 1.0 - uState.y;
          float aa = max(fwidth(r), 1e-4);
          float alpha = uState.w * (1.0 - smoothstep(R - aa, R, r));
          if (alpha < 0.004) discard;
          vec3 col = mix(uBody * 0.82, uDark, smoothstep(0.55 * R, R, r) * 0.55);       // dark layer under the green
          float rr = R * (0.2 + 0.65 * fract(uTime * 0.45 + sd));
          col = mix(col, uBody, (1.0 - smoothstep(0.0, 0.03, abs(r - rr))) * wet * 0.7);   // slow ripple
          float lit = smoothstep(-0.3, 0.3, dot(p / max(r, 1e-4), vec2(-0.45, 0.65)));
          col = mix(col, uHot, smoothstep(R - 0.055, R - 0.035, r) * lit * wet);              // hot rim, light side
          col = mix(col, uGlass, smoothstep(R - 0.02, R - 0.008, r) * 0.55);                  // pale meniscus line
          // Dried: a dark stain with a faint green crust at its edge.
          vec3 stain = mix(uDark * 1.7, uBody * 0.5, smoothstep(R - 0.09, R - 0.03, r));
          col = mix(col, stain, uState.y);
          gl_FragColor = vec4(col, alpha);
        }`,
    });
    this.decal = new THREE.Mesh(new THREE.PlaneGeometry(2, 2).rotateX(-Math.PI / 2), this.mat);
    this.decal.frustumCulled = false;
    this.decal.visible = false;
    this.bubbles = new Bubbles(maxBubbles);
    this.bubbles.rise = 0;
    this.mesh.add(this.decal, this.bubbles.mesh);
  }

  /** Draw order of the decal (higher = on top of other ground decals). */
  set order(v: number) {
    this.decal.renderOrder = v;
  }

  /** Starts the pool at the x / z of `center`, flowing out to `radius` over `seconds`. */
  spread(center: THREE.Vector3, radius: number, seconds = 0.4) {
    this.radius = Math.max(radius, MIN_SCALE);
    this.spreadDur = Math.max(seconds, 0.05);
    this.spreadAge = 0;
    this.drainAge = -1;
    this.seed = Math.random() * 6.28;
    this.acc = 0;
    this.decal.position.set(center.x, this.y, center.z);
    this.decal.scale.setScalar(this.radius / 0.74);
  }

  /** Shrinks and darkens it to a stain over the first 65 % of `seconds`, fades it out over the rest. Stops the bubbling. */
  drain(seconds = 0.6) {
    this.drainDur = Math.max(seconds, 0.1);
    this.drainAge = 0;
  }

  /** Puts one bubble on the pool at x / z (a dome sunk into the floor). */
  bubbleAt(x: number, z: number, size: number, life = rnd(0.45, 0.9)) {
    this.bubbles.emit(this.p.set(x, 0.02, z), size, { life, rise: 0 });
  }

  reset() {
    this.spreadAge = -1;
    this.drainAge = -1;
    this.decal.visible = false;
    this.bubbles.reset();
  }

  update(dt: number) {
    this.time += dt;
    this.mat.uniforms.uTime.value = this.time;
    this.bubbles.update(dt);
    if (this.spreadAge < 0) { this.decal.visible = false; return; }
    this.spreadAge += dt;
    if (this.drainAge >= 0) this.drainAge += dt;
    const spread = easeOut(this.spreadAge / this.spreadDur);
    const dryDur = this.drainDur * 0.65;
    const dry = this.drainAge < 0 ? 0 : clamp01(this.drainAge / dryDur);
    const alpha = this.drainAge < 0 ? 1 : 1 - clamp01((this.drainAge - dryDur) / (this.drainDur - dryDur));
    this.decal.visible = alpha > 0.004;
    (this.mat.uniforms.uState.value as THREE.Vector4).set(Math.max(spread, 0.01), dry, this.seed, alpha);
    if (this.drainAge < 0 && this.boil > 0) {
      this.acc += dt * this.boil * spread;
      while (this.acc >= 1) {
        this.acc -= 1;
        const a = Math.random() * Math.PI * 2, d = this.radius * spread * 0.82 * Math.sqrt(Math.random());
        this.bubbleAt(this.decal.position.x + Math.cos(a) * d, this.decal.position.z + Math.sin(a) * d, rnd(0.45, 1) * this.bubbleSize);
      }
    }
  }
}

// ---------------------------------------------------------------------------------------------------------------
// Fumes
// ---------------------------------------------------------------------------------------------------------------

const PUFFS = 4;

interface Fume {
  live: boolean; pos: THREE.Vector3; drift: THREE.Vector3; rise: number; size: number; age: number; life: number; phase: number;
}

/**
 * Dark toon fume wisps: a short chain of camera-facing puffs with lumpy, eroding edges that rises along a helix, thins
 * and breaks up. Dark-green body with a thin hot-green rim, partly transparent. Small and few (default cap 8).
 * `puff(pos, size)` starts one, optionally with a sideways drift.
 */
export class Fumes {
  readonly mesh: THREE.InstancedMesh;
  private fumes: Fume[] = [];
  private cursor = 0;
  private state: THREE.InstancedBufferAttribute;
  private m = new THREE.Matrix4();
  private q = new THREE.Quaternion();
  private s = new THREE.Vector3();
  private p = new THREE.Vector3();

  constructor(max = 8) {
    const geo = new THREE.PlaneGeometry(2, 2);
    this.state = new THREE.InstancedBufferAttribute(new Float32Array(max * PUFFS * 2), 2);
    this.state.setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('aS', this.state);
    const mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false,
      uniforms: {
        uColor: { value: new THREE.Color(ALCHEMY.dark).lerp(new THREE.Color(ALCHEMY.body), 0.3) },
        uRim: { value: new THREE.Color(ALCHEMY.hot).multiplyScalar(0.8) },
      },
      vertexShader: /* glsl */ `
        attribute vec2 aS; varying vec2 vUv; varying vec2 vS;
        void main() {
          vUv = position.xy; vS = aS;
          vec4 c = instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
          float sc = length(instanceMatrix[0].xyz);
          vec4 mv = modelViewMatrix * c;
          mv.xy += position.xy * sc;
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: /* glsl */ `
        uniform vec3 uColor, uRim; varying vec2 vUv; varying vec2 vS;
        void main() {
          float r = length(vUv), a = atan(vUv.y, vUv.x), sd = vS.y, e = vS.x;
          float lump = 1.0 + 0.2 * sin(a * 3.0 + sd) + 0.12 * sin(a * 5.0 - sd * 2.0) + 0.08 * sin(a * 9.0 + sd * 3.0);
          // Erosion: bites out of the edge that grow with e, so the puff frays instead of just shrinking.
          float bite = 0.5 + 0.5 * sin(a * 7.0 + sd * 5.0) * sin(a * 3.0 - sd);
          float R = (0.9 - 0.55 * e) * lump - 0.35 * e * bite;
          if (r > R) discard;
          vec3 col = r > R - 0.2 ? uRim : (r < 0.45 * R ? uColor * 0.8 : uColor);
          gl_FragColor = vec4(col, 0.8 * (1.0 - 0.6 * e));
        }`,
    });
    this.mesh = new THREE.InstancedMesh(geo, mat, max * PUFFS);
    this.mesh.frustumCulled = false;
    this.mesh.count = 0;
    for (let i = 0; i < max; i++) {
      this.fumes.push({
        live: false, pos: new THREE.Vector3(), drift: new THREE.Vector3(), rise: 1, size: 0.4, age: 0, life: 1, phase: 0,
      });
    }
  }

  /** A fume wisp at `pos`, puffs of about `size` radius. `drift` adds a sideways velocity, `rise` the climb speed. */
  puff(pos: THREE.Vector3, size = 0.4, drift?: THREE.Vector3, rise = 1.1) {
    const f = this.fumes[this.cursor];
    this.cursor = (this.cursor + 1) % this.fumes.length;
    f.live = true; f.pos.copy(pos); f.drift.copy(drift ?? this.s.set(0, 0, 0)); f.rise = rise; f.size = size * 0.8;
    f.age = 0; f.life = rnd(0.8, 1.0); f.phase = Math.random() * 6.28;
  }

  reset() {
    for (const f of this.fumes) f.live = false;
    this.mesh.count = 0;
  }

  update(dt: number) {
    let k = 0;
    const st = this.state.array as Float32Array;
    for (const f of this.fumes) {
      if (!f.live) continue;
      f.age += dt;
      if (f.age >= f.life) { f.live = false; continue; }
      const u = f.age / f.life;
      for (let j = 0; j < PUFFS; j++) {
        const tau = f.age - j * 0.1;
        if (tau < 0) continue;
        const a = f.phase + tau * 4;
        const r = (0.08 + 0.2 * tau) * (0.6 + f.size);
        this.p.set(
          f.pos.x + f.drift.x * tau + Math.cos(a) * r, f.pos.y + f.rise * tau, f.pos.z + f.drift.z * tau + Math.sin(a) * r,
        );
        const sc = f.size * (0.4 + 0.7 * clamp01(tau / 0.5)) * (1 - j * 0.12);
        this.m.compose(this.p, this.q, this.s.setScalar(Math.max(sc, MIN_SCALE)));
        this.mesh.setMatrixAt(k, this.m);
        st[k * 2] = clamp01(Math.max(u * 1.1 - 0.15, 0) + j * 0.08);
        st[k * 2 + 1] = f.phase + j * 1.7;
        k++;
      }
    }
    this.mesh.count = k;
    this.mesh.instanceMatrix.needsUpdate = true;
    this.state.needsUpdate = true;
  }
}

// ---------------------------------------------------------------------------------------------------------------
// Droplets
// ---------------------------------------------------------------------------------------------------------------

interface Droplet {
  live: boolean; from: THREE.Vector3; to: THREE.Vector3; age: number; dur: number; size: number; arc: number;
}

/**
 * Small acid droplets that fly an arc from a point to a point and call `onLand` there (the E spit). `fire(from, to,
 * seconds, size, delay)`; `update(dt)`.
 */
export class Droplets {
  readonly mesh: THREE.InstancedMesh;
  onLand: ((pos: THREE.Vector3) => void) | null = null;
  private drops: Droplet[] = [];
  private cursor = 0;
  private m = new THREE.Matrix4();
  private q = new THREE.Quaternion();
  private s = new THREE.Vector3();
  private p = new THREE.Vector3();

  constructor(max = 24) {
    this.mesh = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 1), liquidMaterial(), max);
    this.mesh.frustumCulled = false;
    this.mesh.count = 0;
    for (let i = 0; i < max; i++) {
      this.drops.push({ live: false, from: new THREE.Vector3(), to: new THREE.Vector3(), age: 0, dur: 0.4, size: 0.1, arc: 1 });
    }
  }

  fire(from: THREE.Vector3, to: THREE.Vector3, seconds = 0.4, size = 0.1, delay = 0) {
    const d = this.drops[this.cursor];
    this.cursor = (this.cursor + 1) % this.drops.length;
    d.live = true; d.from.copy(from); d.to.copy(to); d.age = -delay; d.dur = Math.max(seconds, 0.05); d.size = size;
    d.arc = rnd(0.7, 1.4);
  }

  reset() {
    for (const d of this.drops) d.live = false;
    this.mesh.count = 0;
  }

  update(dt: number) {
    let k = 0;
    for (const d of this.drops) {
      if (!d.live) continue;
      d.age += dt;
      if (d.age < 0) continue;
      const u = d.age / d.dur;
      if (u >= 1) {
        d.live = false;
        this.onLand?.(d.to);
        continue;
      }
      this.p.lerpVectors(d.from, d.to, u);
      this.p.y += 4 * d.arc * u * (1 - u);
      this.m.compose(this.p, this.q, this.s.setScalar(Math.max(d.size, MIN_SCALE)));
      this.mesh.setMatrixAt(k++, this.m);
    }
    this.mesh.count = k;
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}

// ---------------------------------------------------------------------------------------------------------------
// TransmuteCircle
// ---------------------------------------------------------------------------------------------------------------

function drawCircle(): HTMLCanvasElement {
  const S = 1024, C = S / 2;
  const cv = document.createElement('canvas');
  cv.width = cv.height = S;
  const g = cv.getContext('2d')!;
  g.strokeStyle = '#fff';
  g.fillStyle = '#fff';
  g.lineCap = 'round';
  g.lineJoin = 'round';
  let seed = 23;
  const rand = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  const polar = (r: number, a: number): [number, number] => [C + Math.cos(a) * r, C + Math.sin(a) * r];
  const circle = (r: number, lw: number, cx = C, cy = C) => { g.lineWidth = lw; g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.stroke(); };

  // Outer rings and one script band of short rune strokes.
  circle(497, 5);
  circle(478, 12);
  circle(470, 4);
  circle(404, 5);
  g.lineWidth = 7;
  const runes = 64;
  for (let i = 0; i < runes; i++) {
    const a = ((i + 0.5) / runes) * Math.PI * 2;
    g.beginPath();
    const strokes = 2 + Math.floor(rand() * 2);
    for (let s = 0; s < strokes; s++) {
      const r0 = 412 + rand() * 16, r1 = 436 + rand() * 26, da0 = (rand() - 0.5) * 0.04, da1 = (rand() - 0.5) * 0.04;
      const [x0, y0] = polar(r0, a + da0), [x1, y1] = polar(r1, a + da1);
      g.moveTo(x0, y0); g.lineTo(x1, y1);
    }
    g.stroke();
  }
  // Element glyph band: six glyphs in small circles, one per 60 degree sector (sector i = glyph i, from the top).
  circle(274, 8);
  const GR = 339;
  for (let i = 0; i < 6; i++) {
    const a = ((i + 0.5) / 6) * Math.PI * 2 - Math.PI / 2;
    const [gx, gy] = polar(GR, a);
    circle(48, 5, gx, gy);
    g.lineWidth = 8;
    const tri = (up: boolean, sz: number) => {
      const s = up ? -1 : 1;
      g.beginPath();
      g.moveTo(gx, gy + s * sz);
      g.lineTo(gx - sz * 0.9, gy - s * sz * 0.6);
      g.lineTo(gx + sz * 0.9, gy - s * sz * 0.6);
      g.closePath();
      g.stroke();
    };
    if (i === 0) tri(true, 26);
    else if (i === 1) tri(false, 26);
    else if (i === 2) { tri(true, 26); g.beginPath(); g.moveTo(gx - 20, gy + 4); g.lineTo(gx + 20, gy + 4); g.stroke(); }
    else if (i === 3) { tri(false, 26); g.beginPath(); g.moveTo(gx - 20, gy - 4); g.lineTo(gx + 20, gy - 4); g.stroke(); }
    else if (i === 4) { circle(22, 8, gx, gy); g.beginPath(); g.arc(gx, gy, 5, 0, Math.PI * 2); g.fill(); }
    else {
      circle(14, 8, gx, gy - 10);
      g.beginPath(); g.moveTo(gx, gy + 4); g.lineTo(gx, gy + 28); g.moveTo(gx - 12, gy + 17); g.lineTo(gx + 12, gy + 17); g.stroke();
      g.beginPath(); g.arc(gx, gy - 26, 12, Math.PI * 0.1, Math.PI * 0.9, true); g.stroke();
    }
  }
  // The triangle-in-circle: a hexagram of two triangles inside a heavy circle, an inner ring and a mark at the centre.
  circle(262, 10);
  for (const rot of [-Math.PI / 2, Math.PI / 2]) {
    g.lineWidth = 9;
    g.beginPath();
    for (let k = 0; k < 3; k++) {
      const [x, y] = polar(250, rot + (k / 3) * Math.PI * 2);
      if (k === 0) g.moveTo(x, y); else g.lineTo(x, y);
    }
    g.closePath();
    g.stroke();
  }
  circle(120, 7);
  circle(34, 7);
  g.beginPath(); g.arc(C, C, 8, 0, Math.PI * 2); g.fill();
  return cv;
}

let circleTexture: THREE.CanvasTexture | null = null;

/**
 * The pale foil: a glass-ink alchemical circle on the ground (outer rings, one script band, six element glyphs, a
 * hexagram in a heavy circle). `set(center, radius)` places it (the quad spans the radius), `reveal` 0..1 draws it on as
 * a sweep from the top, `opacity` fades it, `lit` (0..6) lights that many glyphs in hot green one after another, `hole`
 * (0..1 of the radius) hides the busy centre. Add `mesh`.
 */
export class TransmuteCircle {
  readonly mesh: THREE.Mesh;
  private mat: THREE.ShaderMaterial;
  private _reveal = 0;
  private _opacity = 1;

  constructor() {
    if (!circleTexture) {
      circleTexture = new THREE.CanvasTexture(drawCircle());
      circleTexture.colorSpace = THREE.SRGBColorSpace;
      circleTexture.anisotropy = 8;
    }
    this.mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, side: THREE.DoubleSide,
      polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4,
      uniforms: {
        uMap: { value: circleTexture }, uColor: { value: new THREE.Color(ALCHEMY.glass) },
        uHot: { value: new THREE.Color(ALCHEMY.hot) },
        uReveal: { value: 0 }, uOpacity: { value: 1 }, uLit: { value: 0 }, uHole: { value: 0 },
      },
      vertexShader: /* glsl */ `
        varying vec2 vUv;
        void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: /* glsl */ `
        uniform sampler2D uMap; uniform vec3 uColor, uHot; uniform float uReveal, uOpacity, uLit, uHole;
        varying vec2 vUv;
        void main() {
          float a = texture2D(uMap, vUv).a;
          vec2 p = vUv - 0.5;
          float r = length(p) * 2.0;
          float sweep = fract(atan(p.x, p.y) / 6.28318530718);
          float m = 1.0 - smoothstep(uReveal * 1.02 - 0.012, uReveal * 1.02, sweep);
          m *= smoothstep(uHole * 0.96, max(uHole, 0.001), r);
          float o = a * m * uOpacity;
          if (o < 0.004) discard;
          float band = step(0.56, r) * step(r, 0.78);
          float lit = band * step(floor(sweep * 6.0) + 0.5, uLit);
          gl_FragColor = vec4(mix(uColor, uHot, lit), o);
        }`,
    });
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2).rotateX(-Math.PI / 2), this.mat);
    this.mesh.renderOrder = 4;
    this.mesh.frustumCulled = false;
    this.mesh.visible = false;
  }

  get reveal() { return this._reveal; }
  set reveal(v: number) { this._reveal = v; this.mat.uniforms.uReveal.value = v; this.sync(); }
  get opacity() { return this._opacity; }
  set opacity(v: number) { this._opacity = v; this.mat.uniforms.uOpacity.value = v; this.sync(); }
  /** Number of glyphs lit in hot green (0..6). */
  get lit() { return this.mat.uniforms.uLit.value as number; }
  set lit(v: number) { this.mat.uniforms.uLit.value = v; }
  /** Radius (0..1 of the circle) of the hidden centre. */
  get hole() { return this.mat.uniforms.uHole.value as number; }
  set hole(v: number) { this.mat.uniforms.uHole.value = v; }

  private sync() {
    this.mesh.visible = this._reveal > 0.002 && this._opacity > 0.004;
  }

  set(center: THREE.Vector3, radius: number) {
    this.mesh.position.set(center.x, 0.045, center.z);
    this.mesh.scale.setScalar(Math.max(radius, MIN_SCALE));
  }

  reset() {
    this.reveal = 0;
    this.opacity = 1;
    this.lit = 0;
    this.hole = 0;
  }
}

// ---------------------------------------------------------------------------------------------------------------
// AcidColumn
// ---------------------------------------------------------------------------------------------------------------

/**
 * One big blob of acid that is a rounded column and, with `morph` 0 -> 1, coils (twists) and gathers into a sphere over
 * a point. Uses the kit liquid look. `configure(base, height, radius, sphereCentre, sphereRadius)` once per cast, then
 * `update(time, morph, wobble)`; `height` / `radius` may be changed every frame to grow it. Add `mesh`.
 */
export class AcidColumn {
  readonly mesh: THREE.Mesh;
  private mat: THREE.ShaderMaterial;

  constructor() {
    this.mat = new THREE.ShaderMaterial({
      uniforms: {
        uBody: { value: new THREE.Color(ALCHEMY.body).multiplyScalar(0.85) }, uDark: { value: new THREE.Color(ALCHEMY.dark) },
        uHot: { value: new THREE.Color(ALCHEMY.hot) }, uCore: { value: new THREE.Color(ALCHEMY.core) },
        uTime: { value: 0 }, uWob: { value: 0 }, uMorph: { value: 0 },
        uBase: { value: new THREE.Vector3() }, uSC: { value: new THREE.Vector3() },
        uH: { value: 1 }, uRc: { value: 1 }, uRs: { value: 1 },
      },
      vertexShader: /* glsl */ `
        uniform float uTime, uWob, uMorph, uH, uRc, uRs; uniform vec3 uBase, uSC;
        varying vec3 vN; varying vec3 vView;
        void main() {
          vec3 n0 = normalize(position);
          float th = acos(clamp(n0.y, -1.0, 1.0));            // 0 at the top pole .. pi at the bottom
          float hv = 1.0 - th / 3.14159265;                      // 0 base .. 1 top
          float phi = atan(n0.z, n0.x);
          float e = smoothstep(0.0, 1.0, uMorph);
          float tw = phi + e * (1.0 - 0.3 * e) * 5.0 * (hv - 0.2);   // the coil
          float rho = uRc * pow(max(sin(th), 0.0), 0.3) * (1.12 - 0.28 * hv);
          rho *= 1.0 + uWob * (0.1 * sin(hv * 16.0 - uTime * 5.0 + phi * 2.0) + 0.06 * sin(hv * 31.0 + uTime * 7.0 - phi * 3.0));
          vec3 colP = uBase + vec3(rho * cos(tw), uH * hv, rho * sin(tw));
          float lump = 1.0 + uWob * 0.07 * (sin(n0.x * 4.0 + uTime * 3.0) + sin(n0.y * 5.0 - uTime * 2.4) + sin(n0.z * 4.5 + uTime * 3.4));
          vec3 sphP = uSC + n0 * uRs * lump;
          vec3 P = mix(colP, sphP, e);
          vec3 nCol = normalize(vec3(cos(tw) * pow(max(sin(th), 0.0), 0.3), n0.y, sin(tw) * pow(max(sin(th), 0.0), 0.3)));
          vec3 N = normalize(mix(nCol, n0, e));
          vec4 mv = modelViewMatrix * vec4(P, 1.0);
          vN = normalize(normalMatrix * N);
          vView = normalize(-mv.xyz);
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: liquidFragment.replace('spec > 0.987', 'spec > 0.9996').replace('step(0.55, ndl) * 0.3', 'step(0.55, ndl) * 0.1'),
    });
    this.mesh = new THREE.Mesh(new THREE.SphereGeometry(1, 28, 40), this.mat);
    this.mesh.frustumCulled = false;
    this.mesh.visible = false;
  }

  configure(base: THREE.Vector3, height: number, radius: number, sphereCentre: THREE.Vector3, sphereRadius: number) {
    const u = this.mat.uniforms;
    (u.uBase.value as THREE.Vector3).copy(base);
    (u.uSC.value as THREE.Vector3).copy(sphereCentre);
    u.uH.value = height;
    u.uRc.value = radius;
    u.uRs.value = sphereRadius;
  }

  set height(v: number) { this.mat.uniforms.uH.value = Math.max(v, MIN_SCALE); }
  set radius(v: number) { this.mat.uniforms.uRc.value = Math.max(v, MIN_SCALE); }

  update(time: number, morph: number, wobble: number) {
    const u = this.mat.uniforms;
    u.uTime.value = time;
    u.uMorph.value = morph;
    u.uWob.value = wobble;
  }

  reset() {
    this.mesh.visible = false;
  }
}

// ---------------------------------------------------------------------------------------------------------------
// FigureShell
// ---------------------------------------------------------------------------------------------------------------

/**
 * A slightly larger copy of the arena figure's silhouette (robe + head) that follows a figure's position, for effects
 * that must not touch the arena materials. `'gold'` is an opaque banded gold statue with a crack network (`crack` 0..1)
 * and a pale flash (`flash` 0..1); `'rim'` is a transparent green fresnel rim (`opacity`). Add `mesh`.
 */
export class FigureShell {
  readonly mesh = new THREE.Group();
  private mat: THREE.ShaderMaterial;

  constructor(kind: 'gold' | 'rim') {
    const gold = kind === 'gold';
    this.mat = new THREE.ShaderMaterial({
      transparent: !gold, depthWrite: gold,
      uniforms: {
        uGold: { value: new THREE.Color(ALCHEMY.gold) }, uHot: { value: new THREE.Color(ALCHEMY.hot) },
        uBody: { value: new THREE.Color(ALCHEMY.body) }, uDark: { value: new THREE.Color(ALCHEMY.dark) },
        uGoldMode: { value: gold ? 1 : 0 }, uCrack: { value: 0 }, uFlash: { value: 0 }, uOpacity: { value: 1 },
      },
      vertexShader: /* glsl */ `
        varying vec3 vN; varying vec3 vView; varying vec3 vL;
        void main() {
          vL = position;
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          vN = normalize(normalMatrix * normal);
          vView = normalize(-mv.xyz);
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: /* glsl */ `
        uniform vec3 uGold, uHot, uBody, uDark; uniform float uGoldMode, uCrack, uFlash, uOpacity;
        varying vec3 vN; varying vec3 vView; varying vec3 vL;
        float hash(vec2 c) { return fract(sin(dot(c, vec2(127.1, 311.7))) * 43758.5453); }
        void main() {
          vec3 n = normalize(vN), v = normalize(vView);
          vec3 L = normalize(vec3(-0.45, 0.65, 0.6));
          float ndl = dot(n, L);
          float f = 1.0 - abs(dot(n, v));
          if (uGoldMode < 0.5) {
            float a = (0.1 + 0.6 * smoothstep(0.4, 0.75, f)) * uOpacity;
            vec3 col = mix(uBody, uHot, smoothstep(0.55, 0.8, f));
            gl_FragColor = vec4(col, a);
            return;
          }
          vec3 pale = mix(uGold, vec3(1.0, 0.95, 0.78), 0.45);
          vec3 col = ndl > 0.5 ? pale : (ndl > 0.0 ? uGold : (ndl > -0.4 ? uGold * 0.62 : uGold * 0.4));
          if (f > 0.8) col = uGold * 0.28;
          vec2 q = vec2(atan(vL.z, vL.x) * 2.4, vL.y * 2.6);
          q += 0.35 * vec2(sin(q.y * 2.3 + 1.0), sin(q.x * 2.1));
          vec2 cell = floor(q), fr = fract(q);
          float d = min(min(fr.x, 1.0 - fr.x), min(fr.y, 1.0 - fr.y));
          float crack = (1.0 - smoothstep(0.03, 0.065, d)) * step(hash(cell), uCrack);
          col = mix(col, uDark * 2.2, crack);
          col = mix(col, vec3(1.0, 0.95, 0.78) * 0.92, uFlash);
          gl_FragColor = vec4(col, 1.0);
        }`,
    });
    const robe = new THREE.LatheGeometry([
      new THREE.Vector2(0.001, 0), new THREE.Vector2(0.6, 0), new THREE.Vector2(0.58, 0.08), new THREE.Vector2(0.48, 0.55),
      new THREE.Vector2(0.38, 0.95), new THREE.Vector2(0.36, 1.12), new THREE.Vector2(0.46, 1.42), new THREE.Vector2(0.52, 1.56),
      new THREE.Vector2(0.44, 1.66), new THREE.Vector2(0.2, 1.74), new THREE.Vector2(0.001, 1.76),
    ], 18);
    const head = new THREE.SphereGeometry(0.27, 18, 14).scale(1, 1.12, 1).translate(0, 1.97, 0);
    for (const g of [robe, head]) {
      const m = new THREE.Mesh(g, this.mat);
      m.frustumCulled = false;
      this.mesh.add(m);
    }
    this.mesh.visible = false;
  }

  get crack() { return this.mat.uniforms.uCrack.value as number; }
  set crack(v: number) { this.mat.uniforms.uCrack.value = v; }
  get flash() { return this.mat.uniforms.uFlash.value as number; }
  set flash(v: number) { this.mat.uniforms.uFlash.value = v; }
  get opacity() { return this.mat.uniforms.uOpacity.value as number; }
  set opacity(v: number) { this.mat.uniforms.uOpacity.value = v; }

  /** Moves the shell onto `source` (its position) and grows it by `grow` around the feet. */
  follow(source: THREE.Object3D, grow = 1.07) {
    this.mesh.position.copy(source.position);
    this.mesh.scale.setScalar(grow);
  }

  reset() {
    this.mesh.visible = false;
    this.crack = 0;
    this.flash = 0;
    this.opacity = 1;
  }
}
