import * as THREE from 'three';
import { Emitter, defaultSettings } from '../../emitter';

export interface SmokeBallOptions {
  /** Ball body colour (dark, normal-blended). Default near-black. */
  color?: THREE.ColorRepresentation;
  /** Rim highlight colour. */
  rim?: THREE.ColorRepresentation;
  /** Flake colour. */
  flake?: THREE.ColorRepresentation;
  /** How many balls can live at once. Default 8. */
  maxBalls?: number;
}

const PUFFS = 7;

interface Ball {
  pos: THREE.Vector3;
  size: number;
  age: number;
  life: number;
  offsets: THREE.Vector3[];
  scales: number[];
  broken: boolean;
}

/**
 * Toon "black smoke ball" aftermath: a cluster of hard-edged dark puffs bulges out around a point, holds, then
 * breaks into black flakes that blow away. Normal-blended, so it sits as solid black against bright layers
 * ("black is a colour").
 *
 * `trigger(pos, size)` starts one (pool of `maxBalls`), `update(dt)` every frame. Add `emitter` to the effect's
 * `emitters` list so its point size stays in sync with the viewport.
 */
export class SmokeBall {
  readonly mesh: THREE.InstancedMesh;
  readonly emitter: Emitter;
  /** Seconds the ball holds before breaking into flakes. */
  hold = 0.35;
  private balls: Ball[] = [];
  private maxBalls: number;
  private m = new THREE.Matrix4();
  private q = new THREE.Quaternion();
  private s = new THREE.Vector3();
  private p = new THREE.Vector3();

  constructor(opts: SmokeBallOptions = {}) {
    this.maxBalls = opts.maxBalls ?? 8;
    const material = new THREE.ShaderMaterial({
      uniforms: {
        uColor: { value: new THREE.Color(opts.color ?? 0x0c0a12) },
        uRim: { value: new THREE.Color(opts.rim ?? 0x3a3550) },
      },
      vertexShader: /* glsl */ `
        varying vec3 vN; varying vec3 vView;
        void main() {
          vec4 p = instanceMatrix * vec4(position, 1.0);
          vec4 mv = modelViewMatrix * p;
          // Uniform scale per instance: no inverse needed; length guard avoids NaN on tiny scales.
          vec3 n = normalMatrix * (mat3(instanceMatrix) * normal);
          vN = n / max(length(n), 1e-6);
          vView = normalize(-mv.xyz);
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: /* glsl */ `
        uniform vec3 uColor, uRim; varying vec3 vN; varying vec3 vView;
        void main() {
          float rim = 1.0 - abs(dot(vN, vView));
          // Two hard toon bands: body and a thin lighter rim.
          vec3 col = rim > 0.72 ? uRim : uColor;
          gl_FragColor = vec4(col, 1.0);
        }`,
    });
    this.mesh = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 1), material, this.maxBalls * PUFFS);
    this.mesh.frustumCulled = false;
    this.mesh.count = 0;

    this.emitter = new Emitter({
      ...defaultSettings(), maxParticles: 900, rate: 0, lifetime: 1.1, lifetimeJitter: 0.4,
      shape: 'sphere', shapeSize: 0.6, speed: 3.2, speedJitter: 0.6, spread: 110, gravity: -1.2, drag: 1.4,
      sizeStart: 0.32, sizeEnd: 0.05, colorStart: '#14111c', colorEnd: '#05040a',
      opacityStart: 0.9, opacityEnd: 0, additive: false, sizeJitter: 0.5, erosion: 0.3, spin: 2.5,
    });
    if (opts.flake) {
      this.emitter.settings.colorStart = new THREE.Color(opts.flake).getStyle();
      this.emitter.applyStyle();
    }
  }

  /** Starts a smoke ball at `pos` with radius `size`; it lives `life` seconds before fully blowing away. */
  trigger(pos: THREE.Vector3, size = 1.4, life = 1.1) {
    if (this.balls.length >= this.maxBalls) this.balls.shift();
    const offsets: THREE.Vector3[] = [], scales: number[] = [];
    for (let i = 0; i < PUFFS; i++) {
      const o = i === 0 ? new THREE.Vector3() : new THREE.Vector3().randomDirection().multiplyScalar(size * (0.45 + Math.random() * 0.35));
      o.y = Math.abs(o.y) * 0.8;
      offsets.push(o);
      scales.push(size * (i === 0 ? 0.8 : 0.45 + Math.random() * 0.3));
    }
    this.balls.push({ pos: pos.clone(), size, age: 0, life, offsets, scales, broken: false });
  }

  clear() {
    this.balls = [];
    this.mesh.count = 0;
    this.emitter.clear();
  }

  update(dt: number) {
    this.emitter.update(dt);
    let k = 0;
    this.balls = this.balls.filter((b) => b.age < b.life);
    for (const b of this.balls) {
      b.age += dt;
      // Bulge out fast (ease-out), hold, then shrink while breaking into flakes.
      const grow = 1 - Math.pow(1 - Math.min(1, b.age / 0.18), 3);
      const breakT = Math.max(0, (b.age - this.hold) / Math.max(0.05, b.life - this.hold));
      if (!b.broken && b.age >= this.hold) {
        b.broken = true;
        this.emitter.burst(Math.round(60 * b.size), b.pos.clone().setY(b.pos.y + b.size * 0.4));
      }
      for (let i = 0; i < PUFFS; i++) {
        // Puffs pop off one by one (outer ones first).
        const local = Math.min(1, Math.max(0, breakT * 1.6 - (PUFFS - i) * 0.06));
        const sc = Math.max(1e-4, b.scales[i] * grow * (1 + 0.15 * breakT) * (1 - local));
        this.p.copy(b.pos).add(this.s.copy(b.offsets[i]).multiplyScalar(grow * (1 + breakT * 0.6)));
        this.p.y += breakT * 0.8;
        this.m.compose(this.p, this.q, this.s.setScalar(sc));
        this.mesh.setMatrixAt(k++, this.m);
      }
    }
    this.mesh.count = k;
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}
