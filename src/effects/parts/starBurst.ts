import * as THREE from 'three';

/** A flat star outline with `points` spikes: outer radius 1, inner radius `inner`. */
function starShape(points: number, inner: number, jitter: number): THREE.Shape {
  const shape = new THREE.Shape();
  const n = points * 2;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + Math.PI / 2;
    const spike = i % 2 === 0;
    // Uneven spike lengths read hand-drawn instead of clip-art.
    const r = spike ? 1 - jitter * ((i * 7919) % 13) / 13 : inner;
    const x = Math.cos(a) * r, y = Math.sin(a) * r;
    if (i === 0) shape.moveTo(x, y);
    else shape.lineTo(x, y);
  }
  shape.closePath();
  return shape;
}

export interface StarBurstOptions {
  /** Spike count (4 = glint, 8–12 = impact star). Default 10. */
  points?: number;
  /** Inner radius 0..1 (smaller = sharper spikes). Default 0.28. */
  inner?: number;
  /** Spike length variation 0..1. Default 0.35. */
  jitter?: number;
  /** Outer star colour. */
  color?: THREE.ColorRepresentation;
  /** Inner (smaller, rotated) star colour, usually white. */
  core?: THREE.ColorRepresentation;
  /** Additive glow-y star, or normal-blended solid (toon, works on bright backgrounds). Default additive. */
  additive?: boolean;
}

/**
 * Hard-edged spiky star that always faces the camera: the anime impact pop / star glint. Two stacked stars (a
 * coloured outer one and a white, rotated core) with crisp edges, no soft glow. Use a small GlowSphere behind
 * it if you want a halo.
 *
 * Animate with `set(pos, size, opacity, spin)` each frame; `pop(age)` gives the classic 2-frame scale-in,
 * hold, shrink curve.
 */
export class StarBurst {
  readonly mesh = new THREE.Group();
  private outerMat: THREE.MeshBasicMaterial;
  private coreMat: THREE.MeshBasicMaterial;
  private outer: THREE.Mesh;
  private core: THREE.Mesh;
  private camQ = new THREE.Quaternion();
  private parentQ = new THREE.Quaternion();

  constructor(opts: StarBurstOptions = {}) {
    const points = opts.points ?? 10;
    const geo = new THREE.ShapeGeometry(starShape(points, opts.inner ?? 0.28, opts.jitter ?? 0.35));
    const blending = opts.additive === false ? THREE.NormalBlending : THREE.AdditiveBlending;
    this.outerMat = new THREE.MeshBasicMaterial({ color: opts.color ?? 0x8af4ff, transparent: true, depthWrite: false, blending, side: THREE.DoubleSide });
    this.coreMat = new THREE.MeshBasicMaterial({ color: opts.core ?? 0xffffff, transparent: true, depthWrite: false, blending, side: THREE.DoubleSide });
    this.outer = new THREE.Mesh(geo, this.outerMat);
    this.core = new THREE.Mesh(geo, this.coreMat);
    this.core.scale.setScalar(0.55);
    this.core.rotation.z = Math.PI / points;
    this.core.position.z = 0.01;
    this.mesh.add(this.outer, this.core);
    this.mesh.visible = false;
    // Billboard: face the camera, compensating for any rotation of the parent (play mode turns effect groups).
    const face = (_r: THREE.WebGLRenderer, _s: THREE.Scene, camera: THREE.Camera) => {
      this.mesh.parent?.getWorldQuaternion(this.parentQ);
      camera.getWorldQuaternion(this.camQ);
      this.mesh.quaternion.copy(this.parentQ.invert().multiply(this.camQ));
      this.mesh.updateMatrixWorld(true);
    };
    // Both, since either may render first.
    this.outer.onBeforeRender = face;
    this.core.onBeforeRender = face;
  }

  get color(): THREE.Color {
    return this.outerMat.color;
  }

  get coreColor(): THREE.Color {
    return this.coreMat.color;
  }

  /** Places the star; opacity ≤ 0 hides it. `spin` is the in-plane rotation (radians). */
  set(pos: THREE.Vector3, size: number, opacity: number, spin = 0) {
    this.mesh.visible = opacity > 0.002 && size > 1e-4;
    this.mesh.position.copy(pos);
    this.mesh.scale.setScalar(Math.max(size, 1e-4));
    this.outer.rotation.z = spin;
    this.core.rotation.z = spin + 0.3;
    this.outerMat.opacity = opacity;
    this.coreMat.opacity = Math.min(1, opacity * 1.2);
  }

  /**
   * Classic pop curve for `age` seconds since the hit: full size in ~2 frames, hold, then shrink to nothing.
   * Returns { scale 0..1, opacity 0..1 }.
   */
  static pop(age: number, hold = 0.12, shrink = 0.18) {
    if (age < 0) return { scale: 0, opacity: 0 };
    const grow = Math.min(1, age / 0.035);
    const out = Math.max(0, (age - 0.035 - hold) / shrink);
    const scale = grow * (1 - out * out);
    return { scale: Math.max(0, scale), opacity: out >= 1 ? 0 : 1 };
  }
}
