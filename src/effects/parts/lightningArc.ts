import * as THREE from 'three';

export interface LightningArcOptions {
  /** Trunk width in world units. Default 0.25. */
  width?: number;
  /** Segments along the trunk. Default 14. */
  segments?: number;
  /** Max sideways jitter as a fraction of the length (grows toward the far end). Default 0.12. */
  jitter?: number;
  /** Forks per bolt. Default 3. */
  branches?: number;
  /** Seconds between automatic re-rolls in update() (flipbook feel: every 2–3 frames). Default 0.04. */
  rerollEvery?: number;
  /** Chance per re-roll to skip a frame entirely (forced flicker). Default 0.12. */
  dropChance?: number;
  core?: THREE.ColorRepresentation;
  glow?: THREE.ColorRepresentation;
}

const MAX_POINTS = 64; // trunk + branch points, total
const MAX_QUADS = MAX_POINTS;

/**
 * A thick, camera-facing lightning bolt between two points, with forks. Each re-roll redraws the shape
 * (straight near the source, more jagged toward the target); small forks fade before the trunk. Width is in
 * world units, so it reads at any distance, unlike 1px lines.
 *
 * Call `setEnds(a, b)` (parent-local space), then `update(dt)` every frame; `opacity` fades it.
 */
export class LightningArc {
  readonly mesh: THREE.Mesh;
  opacity = 0;
  private material: THREE.ShaderMaterial;
  private geo = new THREE.BufferGeometry();
  private positions = new Float32Array(MAX_QUADS * 4 * 3);
  private uvs = new Float32Array(MAX_QUADS * 4 * 2);
  private fades = new Float32Array(MAX_QUADS * 4);
  private a = new THREE.Vector3();
  private b = new THREE.Vector3();
  /** Polylines: trunk first, then branches. Each point: position + width + fade. */
  private lines: { pts: THREE.Vector3[]; width: number; fade: number }[] = [];
  private timer = 0;
  private dropped = false;
  private opts: Required<Omit<LightningArcOptions, 'core' | 'glow'>>;
  private camLocal = new THREE.Vector3();

  constructor(opts: LightningArcOptions = {}) {
    this.opts = {
      width: opts.width ?? 0.25, segments: opts.segments ?? 14, jitter: opts.jitter ?? 0.12,
      branches: opts.branches ?? 3, rerollEvery: opts.rerollEvery ?? 0.04, dropChance: opts.dropChance ?? 0.12,
    };
    this.geo.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
    this.geo.setAttribute('uv', new THREE.BufferAttribute(this.uvs, 2));
    this.geo.setAttribute('aFade', new THREE.BufferAttribute(this.fades, 1));
    const index: number[] = [];
    for (let q = 0; q < MAX_QUADS; q++) {
      const v = q * 4;
      index.push(v, v + 1, v + 2, v + 1, v + 3, v + 2);
    }
    this.geo.setIndex(index);
    this.material = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
      uniforms: {
        uOpacity: { value: 0 },
        uCore: { value: new THREE.Color(opts.core ?? 0xffffff) },
        uGlow: { value: new THREE.Color(opts.glow ?? 0x6ab0ff) },
      },
      vertexShader: /* glsl */ `
        attribute float aFade; varying vec2 vUv; varying float vFade;
        void main() { vUv = uv; vFade = aFade; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: /* glsl */ `
        uniform float uOpacity; uniform vec3 uCore, uGlow; varying vec2 vUv; varying float vFade;
        void main() {
          float x = abs(vUv.y * 2.0 - 1.0);           // 0 centre, 1 edge
          float core = smoothstep(0.45, 0.0, x);
          float glow = pow(1.0 - x, 2.0);
          vec3 col = mix(uGlow, uCore, core);
          gl_FragColor = vec4(col * 1.4, (glow * 0.6 + core) * uOpacity * vFade);
        }`,
    });
    this.mesh = new THREE.Mesh(this.geo, this.material);
    this.mesh.frustumCulled = false;
    this.mesh.visible = false;
    // Build the camera-facing quads right before drawing, when the camera is known.
    this.mesh.onBeforeRender = (_r, _s, camera) => this.build(camera);
  }

  get coreColor(): THREE.Color { return this.material.uniforms.uCore.value; }
  get glowColor(): THREE.Color { return this.material.uniforms.uGlow.value; }

  /** Endpoints in the parent's local space. Re-rolls the shape when they move a lot. */
  setEnds(a: THREE.Vector3, b: THREE.Vector3) {
    const moved = this.a.distanceToSquared(a) + this.b.distanceToSquared(b) > 0.25;
    this.a.copy(a);
    this.b.copy(b);
    if (moved || this.lines.length === 0) this.reroll();
  }

  /** New random shape now. */
  reroll() {
    const { segments, jitter, branches, width } = this.opts;
    const dir = new THREE.Vector3().subVectors(this.b, this.a);
    const len = dir.length();
    this.lines = [];
    if (len < 1e-4) return;
    dir.divideScalar(len);
    // Two axes perpendicular to the bolt for jitter.
    const helper = Math.abs(dir.y) < 0.9 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0);
    const p1 = new THREE.Vector3().crossVectors(dir, helper).normalize();
    const p2 = new THREE.Vector3().crossVectors(dir, p1).normalize();
    const trunk: THREE.Vector3[] = [];
    for (let i = 0; i <= segments; i++) {
      const u = i / segments;
      const amp = len * jitter * Math.sqrt(u) * (i === 0 || i === segments ? 0 : 1); // straighter at the source
      trunk.push(this.a.clone().addScaledVector(dir, len * u)
        .addScaledVector(p1, (Math.random() - 0.5) * 2 * amp)
        .addScaledVector(p2, (Math.random() - 0.5) * 2 * amp));
    }
    this.lines.push({ pts: trunk, width, fade: 1 });
    let budget = MAX_POINTS - trunk.length;
    for (let k = 0; k < branches && budget > 4; k++) {
      const at = 2 + Math.floor(Math.random() * (segments - 4));
      const start = trunk[at];
      const bLen = len * (0.12 + Math.random() * 0.18);
      const bDir = dir.clone().addScaledVector(p1, (Math.random() - 0.5) * 2.2).addScaledVector(p2, (Math.random() - 0.5) * 2.2).normalize();
      const n = Math.min(budget - 1, 4 + Math.floor(Math.random() * 3));
      const pts = [start.clone()];
      for (let i = 1; i <= n; i++) {
        pts.push(start.clone().addScaledVector(bDir, (bLen * i) / n)
          .addScaledVector(p1, (Math.random() - 0.5) * bLen * 0.3)
          .addScaledVector(p2, (Math.random() - 0.5) * bLen * 0.3));
      }
      budget -= pts.length;
      // Small forks are dimmer and get dropped more often (they "fade first").
      this.lines.push({ pts, width: width * 0.5, fade: Math.random() < 0.3 ? 0 : 0.7 });
    }
  }

  /** Advances the flicker: re-rolls every `rerollEvery` s and sometimes drops a frame. */
  update(dt: number) {
    this.timer += dt;
    if (this.timer >= this.opts.rerollEvery) {
      this.timer = 0;
      this.reroll();
      this.dropped = Math.random() < this.opts.dropChance;
    }
    this.material.uniforms.uOpacity.value = this.dropped ? 0 : this.opacity;
    this.mesh.visible = this.opacity > 0.002 && this.lines.length > 0;
  }

  private build(camera: THREE.Camera) {
    this.camLocal.setFromMatrixPosition(camera.matrixWorld);
    this.mesh.worldToLocal(this.camLocal);
    let q = 0;
    const side = new THREE.Vector3(), seg = new THREE.Vector3(), toCam = new THREE.Vector3();
    for (const line of this.lines) {
      for (let i = 0; i < line.pts.length - 1 && q < MAX_QUADS; i++, q++) {
        const p0 = line.pts[i], p1 = line.pts[i + 1];
        seg.subVectors(p1, p0);
        toCam.subVectors(this.camLocal, p0);
        side.crossVectors(seg, toCam);
        if (side.lengthSq() < 1e-10) side.set(0, 1, 0);
        // Taper: thinner toward the end of each polyline.
        const w0 = line.width * (1 - 0.6 * (i / line.pts.length)) / 2;
        const w1 = line.width * (1 - 0.6 * ((i + 1) / line.pts.length)) / 2;
        side.normalize();
        const v = q * 12;
        this.positions.set([
          p0.x - side.x * w0, p0.y - side.y * w0, p0.z - side.z * w0,
          p0.x + side.x * w0, p0.y + side.y * w0, p0.z + side.z * w0,
          p1.x - side.x * w1, p1.y - side.y * w1, p1.z - side.z * w1,
          p1.x + side.x * w1, p1.y + side.y * w1, p1.z + side.z * w1,
        ], v);
        this.uvs.set([0, 0, 0, 1, 1, 0, 1, 1], q * 8);
        this.fades.fill(line.fade, q * 4, q * 4 + 4);
      }
    }
    // Collapse unused quads.
    this.positions.fill(0, q * 12);
    this.fades.fill(0, q * 4);
    this.geo.attributes.position.needsUpdate = true;
    this.geo.attributes.uv.needsUpdate = true;
    this.geo.attributes.aFade.needsUpdate = true;
  }
}
