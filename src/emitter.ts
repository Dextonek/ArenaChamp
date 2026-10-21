import * as THREE from 'three';

export type EmitterShape = 'point' | 'sphere' | 'box' | 'cone';

/** Everything that defines an emitter's look. Plain data so it serialises to JSON. */
export interface EmitterSettings {
  maxParticles: number;
  rate: number; // particles per second
  lifetime: number; // seconds
  lifetimeJitter: number; // 0..1
  shape: EmitterShape;
  shapeSize: number;
  originY: number; // height of the emitter above the grid
  speed: number;
  speedJitter: number; // 0..1
  spread: number; // degrees from the +Y axis
  gravity: number;
  drag: number;
  sizeStart: number;
  sizeEnd: number;
  colorStart: string;
  colorEnd: string;
  opacityStart: number;
  opacityEnd: number;
  additive: boolean;
  // --- Optional look refinements (omit for the plain soft dot) ---------------------------------
  /** Middle colour stop at half life: hot core → saturated mid → cool end reads far richer than two stops. */
  colorMid?: string;
  /** 0..1: per-particle size variance, so a cloud has big and small puffs instead of identical dots. */
  sizeJitter?: number;
  /**
   * 0..1: alpha erosion. Each particle gets a noise mask that eats it away as it ages, so smoke and fire break
   * into wisps instead of fading as uniform discs. ~0.5 for smoke/fire, 0 for sparks.
   */
  erosion?: number;
  /**
   * World-space height over which particles fade out toward the ground (fake soft particles). Default 0 (off):
   * many effects spawn dust exactly at y = 0 and would vanish at birth. Use ~0.3 for things that settle or fall.
   */
  groundFade?: number;
  /** 0..1: spin of the sprite over its life (only visible with erosion). */
  spin?: number;
}

export const defaultSettings = (): EmitterSettings => ({
  maxParticles: 4000,
  rate: 300,
  lifetime: 1.6,
  lifetimeJitter: 0.3,
  shape: 'sphere',
  shapeSize: 0.2,
  originY: 0,
  speed: 2,
  speedJitter: 0.4,
  spread: 25,
  gravity: 1.2,
  drag: 0.6,
  sizeStart: 0.35,
  sizeEnd: 0.05,
  colorStart: '#ffd27a',
  colorEnd: '#ff3a10',
  opacityStart: 1,
  opacityEnd: 0,
  additive: true,
});

const vertexShader = /* glsl */ `
  attribute float aLife;   // 0 = just born, 1 = dead
  attribute float aAlive;  // 1 alive, 0 free slot
  attribute float aSeed;   // per-particle random 0..1
  uniform float uSizeStart, uSizeEnd, uOpacityStart, uOpacityEnd, uPixelScale, uSizeJitter, uUseMid, uGroundFade;
  uniform vec3 uColorStart, uColorEnd, uColorMid;
  varying vec4 vColor;
  varying float vLife;
  varying float vSeed;
  void main() {
    vec4 world = modelMatrix * vec4(position, 1.0);
    vec4 mv = viewMatrix * world;
    gl_Position = projectionMatrix * mv;
    float size = mix(uSizeStart, uSizeEnd, aLife) * (1.0 + (aSeed - 0.5) * 2.0 * uSizeJitter);
    gl_PointSize = aAlive * size * uPixelScale / -mv.z;
    vec3 col = uUseMid > 0.5
      ? (aLife < 0.5 ? mix(uColorStart, uColorMid, aLife * 2.0) : mix(uColorMid, uColorEnd, aLife * 2.0 - 1.0))
      : mix(uColorStart, uColorEnd, aLife);
    // Fake soft particles: fade as the sprite's centre nears the (flat) ground instead of clipping hard.
    float ground = uGroundFade > 0.0 ? smoothstep(0.0, uGroundFade + size * 0.35, world.y) : 1.0;
    vColor = vec4(col, mix(uOpacityStart, uOpacityEnd, aLife) * aAlive * ground);
    vLife = aLife;
    vSeed = aSeed;
  }
`;

const fragmentShader = /* glsl */ `
  uniform float uErosion, uSpin;
  varying vec4 vColor;
  varying float vLife;
  varying float vSeed;
  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float noise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
  }
  void main() {
    vec2 c = gl_PointCoord - 0.5;
    float d = length(c) * 2.0;
    float a = smoothstep(1.0, 0.0, d);
    a *= a;
    if (uErosion > 0.0) {
      // Rotate the mask per particle, then erode: the threshold rises with age so wisps thin out and break up.
      float ang = vSeed * 6.2832 + vLife * uSpin * 3.0;
      vec2 r = mat2(cos(ang), -sin(ang), sin(ang), cos(ang)) * c;
      vec2 o = vec2(vSeed * 31.7, vSeed * 17.3);
      float n = 0.65 * noise(r * 4.0 + o) + 0.35 * noise(r * 9.0 + o * 1.7);
      float thr = uErosion * (0.15 + 0.75 * vLife);
      a *= smoothstep(thr, thr + 0.22, n * (0.6 + 0.4 * a));
    }
    if (vColor.a * a < 0.003) discard;
    gl_FragColor = vec4(vColor.rgb, vColor.a * a);
  }
`;

/** A CPU-simulated particle emitter rendered as one THREE.Points draw call. */
export class Emitter {
  readonly points: THREE.Points;
  settings: EmitterSettings;

  private geometry = new THREE.BufferGeometry();
  private material: THREE.ShaderMaterial;
  private capacity = 0;
  private positions!: Float32Array;
  private velocities!: Float32Array;
  private ages!: Float32Array;
  private lifetimes!: Float32Array;
  private life!: Float32Array;
  private alive!: Float32Array;
  private seeds!: Float32Array;
  private spawnAccumulator = 0;
  private cursor = 0;
  private tmp = new THREE.Vector3();
  private offset = new THREE.Vector3();

  constructor(settings: EmitterSettings = defaultSettings()) {
    this.settings = settings;
    this.material = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      transparent: true,
      depthWrite: false,
      uniforms: {
        uSizeStart: { value: 0 },
        uSizeEnd: { value: 0 },
        uOpacityStart: { value: 1 },
        uOpacityEnd: { value: 0 },
        uColorStart: { value: new THREE.Color() },
        uColorEnd: { value: new THREE.Color() },
        uColorMid: { value: new THREE.Color() },
        uUseMid: { value: 0 },
        uSizeJitter: { value: 0 },
        uErosion: { value: 0 },
        uGroundFade: { value: 0 },
        uSpin: { value: 0 },
        uPixelScale: { value: 600 },
      },
    });
    this.points = new THREE.Points(this.geometry, this.material);
    this.points.frustumCulled = false;
    this.allocate(settings.maxParticles);
    this.applyStyle();
  }

  /** (Re)creates the buffers; existing particles are dropped. */
  allocate(count: number) {
    this.capacity = Math.max(1, Math.floor(count));
    const n = this.capacity;
    this.positions = new Float32Array(n * 3);
    this.velocities = new Float32Array(n * 3);
    this.ages = new Float32Array(n);
    this.lifetimes = new Float32Array(n);
    this.life = new Float32Array(n).fill(1);
    this.alive = new Float32Array(n);
    this.seeds = new Float32Array(n).map(() => Math.random());
    this.geometry.setAttribute('aSeed', new THREE.BufferAttribute(this.seeds, 1));
    this.geometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3).setUsage(THREE.DynamicDrawUsage));
    this.geometry.setAttribute('aLife', new THREE.BufferAttribute(this.life, 1).setUsage(THREE.DynamicDrawUsage));
    this.geometry.setAttribute('aAlive', new THREE.BufferAttribute(this.alive, 1).setUsage(THREE.DynamicDrawUsage));
    this.cursor = 0;
    this.spawnAccumulator = 0;
  }

  /** Pushes the non-simulation settings (colours, sizes, blending) to the GPU. */
  applyStyle() {
    const s = this.settings;
    const u = this.material.uniforms;
    u.uSizeStart.value = s.sizeStart;
    u.uSizeEnd.value = s.sizeEnd;
    u.uOpacityStart.value = s.opacityStart;
    u.uOpacityEnd.value = s.opacityEnd;
    (u.uColorStart.value as THREE.Color).set(s.colorStart);
    (u.uColorEnd.value as THREE.Color).set(s.colorEnd);
    u.uUseMid.value = s.colorMid ? 1 : 0;
    if (s.colorMid) (u.uColorMid.value as THREE.Color).set(s.colorMid);
    u.uSizeJitter.value = s.sizeJitter ?? 0;
    u.uErosion.value = s.erosion ?? 0;
    u.uGroundFade.value = s.groundFade ?? 0;
    u.uSpin.value = s.spin ?? 0;
    this.material.blending = s.additive ? THREE.AdditiveBlending : THREE.NormalBlending;
    this.material.needsUpdate = true;
    if (s.maxParticles !== this.capacity) this.allocate(s.maxParticles);
  }

  setPixelScale(viewportHeight: number, fovDeg: number) {
    this.material.uniforms.uPixelScale.value = viewportHeight / (2 * Math.tan(THREE.MathUtils.degToRad(fovDeg) / 2));
  }

  /** Kills every particle (e.g. on restart). */
  clear() {
    this.alive.fill(0);
    this.life.fill(1);
    this.spawnAccumulator = 0;
  }

  update(dt: number) {
    const s = this.settings;
    this.spawnAccumulator += s.rate * dt;
    let toSpawn = Math.floor(this.spawnAccumulator);
    this.spawnAccumulator -= toSpawn;
    // Never spawn more than a full buffer in one frame (e.g. after a tab stall).
    toSpawn = Math.min(toSpawn, this.capacity);
    for (let i = 0; i < toSpawn; i++) this.spawn();

    const dragFactor = Math.exp(-s.drag * dt);
    const p = this.positions, v = this.velocities;
    for (let i = 0; i < this.capacity; i++) {
      if (this.alive[i] === 0) continue;
      this.ages[i] += dt;
      if (this.ages[i] >= this.lifetimes[i]) {
        this.alive[i] = 0;
        this.life[i] = 1;
        continue;
      }
      const j = i * 3;
      v[j + 1] -= s.gravity * dt;
      v[j] *= dragFactor; v[j + 1] *= dragFactor; v[j + 2] *= dragFactor;
      p[j] += v[j] * dt; p[j + 1] += v[j + 1] * dt; p[j + 2] += v[j + 2] * dt;
      this.life[i] = this.ages[i] / this.lifetimes[i];
    }
    this.geometry.attributes.position.needsUpdate = true;
    this.geometry.attributes.aLife.needsUpdate = true;
    this.geometry.attributes.aAlive.needsUpdate = true;
  }

  /**
   * Spawns `count` particles at once (used for one-shot explosions; set rate to 0).
   * `at` offsets the spawn point in world space (added to originY's position).
   */
  burst(count: number, at?: THREE.Vector3) {
    if (at) this.offset.copy(at);
    const n = Math.min(Math.floor(count), this.capacity);
    for (let i = 0; i < n; i++) this.spawn();
    this.offset.set(0, 0, 0);
  }

  get aliveCount() {
    let n = 0;
    for (let i = 0; i < this.capacity; i++) n += this.alive[i];
    return n;
  }

  private spawn() {
    const s = this.settings;
    // Ring-buffer slot reuse: the oldest particle is replaced when the buffer is full.
    const i = this.cursor;
    this.cursor = (this.cursor + 1) % this.capacity;
    const j = i * 3;

    const pos = this.samplePosition(this.tmp);
    const o = this.offset;
    this.positions[j] = pos.x + o.x; this.positions[j + 1] = pos.y + s.originY + o.y; this.positions[j + 2] = pos.z + o.z;

    const dir = randomDirectionInCone(THREE.MathUtils.degToRad(s.spread), this.tmp);
    const speed = s.speed * (1 + (Math.random() * 2 - 1) * s.speedJitter);
    this.velocities[j] = dir.x * speed; this.velocities[j + 1] = dir.y * speed; this.velocities[j + 2] = dir.z * speed;

    this.ages[i] = 0;
    this.lifetimes[i] = Math.max(0.05, s.lifetime * (1 + (Math.random() * 2 - 1) * s.lifetimeJitter));
    this.life[i] = 0;
    this.alive[i] = 1;
  }

  private samplePosition(out: THREE.Vector3) {
    const r = this.settings.shapeSize;
    switch (this.settings.shape) {
      case 'point':
        return out.set(0, 0, 0);
      case 'box':
        return out.set((Math.random() - 0.5) * 2 * r, (Math.random() - 0.5) * 2 * r, (Math.random() - 0.5) * 2 * r);
      case 'cone': {
        // Disc at the base; the cone itself comes from the spread angle.
        const a = Math.random() * Math.PI * 2, d = Math.sqrt(Math.random()) * r;
        return out.set(Math.cos(a) * d, 0, Math.sin(a) * d);
      }
      case 'sphere':
      default: {
        randomUnitVector(out);
        return out.multiplyScalar(r * Math.cbrt(Math.random()));
      }
    }
  }

  dispose() {
    this.geometry.dispose();
    this.material.dispose();
  }
}

function randomUnitVector(out: THREE.Vector3) {
  const z = Math.random() * 2 - 1;
  const a = Math.random() * Math.PI * 2;
  const r = Math.sqrt(1 - z * z);
  return out.set(r * Math.cos(a), z, r * Math.sin(a));
}

/** Uniformly samples a direction within `angle` radians of +Y. */
function randomDirectionInCone(angle: number, out: THREE.Vector3) {
  const cosMax = Math.cos(Math.min(angle, Math.PI));
  const y = cosMax + Math.random() * (1 - cosMax);
  const a = Math.random() * Math.PI * 2;
  const r = Math.sqrt(Math.max(0, 1 - y * y));
  return out.set(r * Math.cos(a), y, r * Math.sin(a));
}
