import * as THREE from 'three';
import { RING } from '../common';
import type { HazardWorld } from '../hazards/base';
import { REVEAL, type ShiftLook } from './base';

/**
 * The floor look of the arenas in the heroes' style (`../real.ts`): pools that open in the floor and grow from stage to
 * stage, and a band that comes in from the rim. Drawn clean, as those arenas are: a flat colour, slow bands moving
 * through it and a crisp line along its edge; no noise. A pool reaches its size when its stage lands, so the edge a
 * player sees creeping is the edge that will count.
 *
 * One step per stage: `circles` [x, z, radius] (a circle keeps its place in the list from stage to stage and only
 * grows) and `edge`, the radius outside which the floor is taken. After the last step comes Last stand: the band
 * closes over the whole floor.
 */
export interface PoolStep {
  circles?: [number, number, number][];
  edge?: number;
}

export interface PoolStyle {
  /** The body, the bands moving through it and the line along its edge. Mid values: the floor is large and would bloom. */
  deep: number;
  light: number;
  rim: number;
  /** How fast the bands travel (m/s, outward positive) and how far apart they are (m). */
  speed: number;
  spacing: number;
  /** How much of the floor under it still shows. */
  alpha: number;
  /** Flames: the bands flicker and lick outward in tongues. */
  flicker?: boolean;
}

export const POOL_STYLES = {
  /** Sea water over stone. */
  tide: { deep: 0x124a66, light: 0x3f93b4, rim: 0xbfe2ee, speed: 0.5, spacing: 1.7, alpha: 0.86 },
  /** Quicksand. */
  sand: { deep: 0x7a5a2c, light: 0xb08a48, rim: 0xe0c078, speed: -0.35, spacing: 1.3, alpha: 0.9 },
  /** Fire on the ground. */
  fire: { deep: 0x8a2a0c, light: 0xd8742a, rim: 0xf0b050, speed: 0.9, spacing: 1.1, alpha: 0.82, flicker: true },
  /** Fallen rock and the dark behind it. */
  rubble: { deep: 0x1c1a22, light: 0x3a3644, rim: 0x8a84a0, speed: 0.15, spacing: 2.2, alpha: 0.92 },
} satisfies Record<string, PoolStyle>;

const vertex = /* glsl */ `
  varying vec2 vP;
  void main() {
    vec4 w = modelMatrix * vec4(position, 1.0);
    vP = w.xz;
    gl_Position = projectionMatrix * viewMatrix * w;
  }
`;

const fragment = /* glsl */ `
  varying vec2 vP;
  uniform vec2 uCentre;
  uniform float uInner, uOuter, uTime, uSpeed, uSpacing, uAlpha, uFlicker;
  uniform vec3 uDeep, uLight, uRim;
  void main() {
    vec2 q = vP - uCentre;
    float d = length(q), ang = atan(q.y, q.x);
    // flames lick out in tongues; water and sand keep a clean round edge
    float lick = uFlicker * (0.16 * sin(ang * 9.0 + uTime * 5.0) + 0.1 * sin(ang * 17.0 - uTime * 7.0));
    float outer = uOuter + lick, inner = uInner - lick;
    if (d > outer || d < inner) discard;
    float band = 0.5 + 0.5 * sin((d - uTime * uSpeed) * 6.2832 / uSpacing + uFlicker * 1.5 * sin(ang * 5.0 + uTime * 3.0));
    vec3 col = mix(uDeep, uLight, 0.3 * smoothstep(0.55, 0.95, band));
    float edge = min(outer - d, inner < 0.0 ? 99.0 : d - inner);
    col = mix(col, uRim, 1.0 - smoothstep(0.05, 0.11, edge));
    gl_FragColor = vec4(col, uAlpha);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

interface Patch {
  mesh: THREE.Mesh;
  uniforms: Record<string, THREE.IUniform>;
  /** The radius it had, the radius it is going to (a pool's outer edge, the band's inner one). */
  from: number;
  to: number;
}

export class PoolLook implements ShiftLook {
  readonly group = new THREE.Group();
  readonly drawsZones = true;
  private pools: Patch[] = [];
  private band: Patch;
  /** The fight clock when the stage showing began, -1 when `begin` has not been seen by `update` yet. */
  private began = -Infinity;
  private pending = false;

  constructor(style: PoolStyle, private steps: PoolStep[]) {
    const count = Math.max(0, ...steps.map((s) => s.circles?.length ?? 0));
    const most = (i: number) => Math.max(...steps.map((s) => s.circles?.[i]?.[2] ?? 0));
    const spot = (i: number) => steps.find((s) => s.circles?.[i])!.circles![i];
    for (let i = 0; i < count; i++) this.pools.push(this.patch(style, spot(i)[0], spot(i)[1], most(i) + 0.4, -1, 0));
    // the band from the rim: its inner edge starts at the rim and comes in
    this.band = this.patch(style, RING.x, RING.z, RING.r + 0.3, RING.r + 0.3, RING.r + 0.3);
    this.band.uniforms.uOuter.value = RING.r + 0.3;
    this.band.from = this.band.to = RING.r + 0.3;
  }

  private patch(style: PoolStyle, x: number, z: number, size: number, inner: number, outer: number): Patch {
    const uniforms = {
      uCentre: { value: new THREE.Vector2(x, z) }, uInner: { value: inner }, uOuter: { value: outer }, uTime: { value: 0 },
      uSpeed: { value: style.speed }, uSpacing: { value: style.spacing }, uAlpha: { value: style.alpha }, uFlicker: { value: style.flicker ? 1 : 0 },
      uDeep: { value: new THREE.Color(style.deep) }, uLight: { value: new THREE.Color(style.light) }, uRim: { value: new THREE.Color(style.rim) },
    };
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(size * 2, size * 2).rotateX(-Math.PI / 2),
      new THREE.ShaderMaterial({ uniforms, vertexShader: vertex, fragmentShader: fragment, transparent: true, depthWrite: false }),
    );
    mesh.position.set(x, 0.034, z);
    // after the see-through floors, before the spells' zones, which must read on it (as `ZoneFloor`)
    mesh.renderOrder = 0.5;
    mesh.visible = false;
    this.group.add(mesh);
    return { mesh, uniforms, from: 0, to: 0 };
  }

  begin(index: number) {
    const step = this.steps[index];
    this.pending = true;
    this.pools.forEach((p, i) => {
      p.from = p.to;
      // Last stand (past the last step): the pools stay as they are, the band takes the rest
      if (step) p.to = step.circles?.[i]?.[2] ?? p.to;
    });
    this.band.from = this.band.to;
    this.band.to = step ? step.edge ?? this.band.to : 0;
  }

  update(_dt: number, clock: number, _world: HazardWorld) {
    if (this.pending) {
      this.pending = false;
      this.began = clock;
    }
    const t = Math.min(1, Math.max(0, (clock - this.began) / REVEAL)), k = t * t * (3 - 2 * t);
    for (const p of this.pools) {
      const r = p.from + (p.to - p.from) * k;
      p.uniforms.uOuter.value = r;
      p.uniforms.uTime.value = clock;
      p.mesh.visible = r > 0.05;
    }
    const inner = this.band.from + (this.band.to - this.band.from) * k;
    this.band.uniforms.uInner.value = inner;
    this.band.uniforms.uTime.value = clock;
    this.band.mesh.visible = inner < RING.r + 0.25;
  }
}
