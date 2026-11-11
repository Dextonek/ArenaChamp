import * as THREE from 'three';
import { ArenaHazard, CENTER, REACH, type HazardHit, type HazardThreat, type HazardWorld } from './base';
import { Sparks } from './fx';

const WARN = 1.4; // seconds a whirlwind gathers at the rim before it sets off
const STEP = 0.42; // seconds from one circle of its path to the next
const COUNT = 8; // circles per path
// How long a circle hurts. With the 0.8 s between two hits on one target, a hero who stands still where two circles
// overlap is hit once, not twice: the next circle is over 0.72 s after the first began.
const HOLD = 0.3;
const RADIUS = 1.7;
const FADE = 0.6; // seconds it takes to fall apart at the far rim
const HEIGHT = 4.6;

const vertex = /* glsl */ `
  uniform float uTime, uPhase;
  varying vec2 vUv;
  void main() {
    vUv = uv;
    // the column sways more the higher it is
    vec3 p = position;
    float h = uv.y;
    p.x += 0.32 * h * h * sin(uTime * 2.3 + h * 3.0 + uPhase);
    p.z += 0.32 * h * h * cos(uTime * 1.9 + h * 2.4 + uPhase);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  }
`;

/** Clean bands of dust winding up the funnel: no noise, three broad stripes that turn. */
const fragment = /* glsl */ `
  uniform float uTime, uOpacity, uPhase;
  uniform vec3 uDust, uPale;
  varying vec2 vUv;
  void main() {
    float h = vUv.y;
    float wind = vUv.x * 6.2832 * 3.0 + h * 9.0 - uTime * 7.0 + uPhase;
    float band = smoothstep(0.1, 0.5, sin(wind));
    float thin = smoothstep(0.82, 0.95, sin(wind * 0.5 + 1.7 + uTime * 2.0));
    vec3 col = mix(uDust, uPale, 0.55 * thin + 0.25 * h);
    float a = (0.2 + 0.5 * band + 0.3 * thin) * smoothstep(0.0, 0.07, h) * (1.0 - smoothstep(0.62, 1.0, h));
    gl_FragColor = vec4(col, a * uOpacity);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

/** Where the clean rings ride on a funnel (share of its height), and the funnel's radius at a height. */
const RINGS = [0.2, 0.46, 0.72];
const PROFILE = [0.3, 0.42, 0.62, 0.9, 1.22, 1.55, 1.85];
const radiusAt = (h: number) => {
  const f = h * (PROFILE.length - 1), i = Math.min(PROFILE.length - 2, Math.floor(f));
  return PROFILE[i] + (PROFILE[i + 1] - PROFILE[i]) * (f - i);
};

interface Devil {
  group: THREE.Group;
  uniforms: Record<string, THREE.IUniform>;
  rings: THREE.Mesh[];
  ringLook: THREE.MeshBasicMaterial;
  /** Its path this event, through the circles' centres. */
  path: THREE.CatmullRomCurve3 | null;
}

/**
 * Sandstone Canyon, "Dust devils": two whirlwinds gather at opposite rims and wander across the court on curved
 * paths, the second the first turned half round the centre. Each path is shown as a chain of circles; a circle only
 * hurts while the whirlwind is over it, so step aside or let it pass. It hits less than the other arenas' events and
 * slows.
 */
export class DustDevils extends ArenaHazard {
  readonly warning = 'Dust devils';
  // the arena's own turquoise, pale: it reads on the dark flags and on the quicksand, which a sand colour would not
  protected readonly zoneColor = 0x5fd0c4;
  private sparks = new Sparks(220, 0.2);
  private devils: Devil[] = [];
  private spot = new THREE.Vector3();

  constructor(seed: string) {
    super(seed);
    // a funnel, narrow at the foot: one turned profile, v running up it
    const profile = PROFILE.map((r, i, all) => new THREE.Vector2(r, (i / (all.length - 1)) * HEIGHT));
    for (let i = 0; i < 2; i++) {
      const uniforms = {
        uTime: { value: 0 }, uOpacity: { value: 0 }, uPhase: { value: i * 2.1 },
        uDust: { value: new THREE.Color(0x8a6a48) }, uPale: { value: new THREE.Color(0xd8bc8c) },
      };
      const outer = new THREE.Mesh(
        new THREE.LatheGeometry(profile, 28),
        new THREE.ShaderMaterial({ uniforms, vertexShader: vertex, fragmentShader: fragment, transparent: true, depthWrite: false, side: THREE.DoubleSide }),
      );
      outer.renderOrder = 3;
      outer.frustumCulled = false;
      const group = new THREE.Group();
      group.add(outer);
      // three clean rings of dust riding on it
      const ringLook = new THREE.MeshBasicMaterial({ color: 0xc9ad80, transparent: true, opacity: 0, depthWrite: false });
      const rings = RINGS.map((h) => {
        const ring = new THREE.Mesh(new THREE.TorusGeometry(1, 0.035, 6, 36), ringLook);
        ring.rotation.x = Math.PI / 2;
        ring.scale.setScalar(radiusAt(h) * 1.04);
        ring.renderOrder = 3;
        ring.frustumCulled = false;
        group.add(ring);
        return ring;
      });
      group.visible = false;
      this.devils.push({ group, uniforms, rings, ringLook, path: null });
      this.group.add(group);
    }
    this.group.add(this.sparks.points);
  }

  protected begin() {
    const angle = this.rng() * Math.PI * 2, lane = 1.6 + this.rng() * 1.8, sway = 2.2 + this.rng() * 1.4;
    const bends = 0.9 + this.rng() * 0.8, phase = this.rng() * Math.PI;
    const along = { x: Math.sin(angle), z: Math.cos(angle) }, across = { x: along.z, z: -along.x };
    const span = REACH - RADIUS - 0.2;
    const centres: { x: number; z: number }[][] = [[], []];
    for (let i = 0; i < COUNT; i++) {
      const s = i / (COUNT - 1), u = -span + 2 * span * s;
      // the path's own bend, kept inside the ring: near the rim there is little room beside the axis
      const room = Math.sqrt(Math.max(0, (REACH - RADIUS) ** 2 - u * u));
      const off = Math.max(-room, Math.min(room, lane + sway * Math.sin(Math.PI * (bends * s * 2 + phase))));
      // the second whirlwind is the first turned half round the centre
      [1, -1].forEach((side, k) => {
        const x = CENTER.x + (along.x * u + across.x * off) * side, z = CENTER.z + (along.z * u + across.z * off) * side;
        centres[k].push({ x, z });
        this.threats.push({ shape: { kind: 'circle', x, z, radius: RADIUS }, at: WARN + i * STEP, to: WARN + i * STEP + HOLD });
      });
    }
    this.devils.forEach((d, k) => {
      d.path = new THREE.CatmullRomCurve3(centres[k].map((c) => new THREE.Vector3(c.x, 0, c.z)));
    });
    this.duration = WARN + (COUNT - 1) * STEP + HOLD + FADE;
  }

  protected hitOf(th?: HazardThreat): HazardHit {
    const from = th && th.shape.kind === 'circle' ? new THREE.Vector3(th.shape.x, 0, th.shape.z) : CENTER;
    return { damage: 35, slow: 1.5, color: '#e6cf9c', from };
  }

  protected tick(dt: number, t: number, _live: boolean, _world: HazardWorld) {
    this.sparks.update(dt);
    const end = WARN + (COUNT - 1) * STEP + HOLD;
    for (const d of this.devils) {
      if (t < 0 || !d.path) {
        d.group.visible = false;
        continue;
      }
      // over circle i in the middle of the time it hurts
      const along = Math.min(1, Math.max(0, ((t - WARN - HOLD / 2) / STEP) / (COUNT - 1)));
      d.path.getPoint(along, this.spot);
      const grow = Math.min(1, t / WARN), fade = t < end ? 1 : Math.max(0, 1 - (t - end) / FADE);
      d.group.visible = true;
      d.group.position.set(this.spot.x, 0.04, this.spot.z);
      d.group.scale.set(0.35 + 0.65 * grow, (0.3 + 0.7 * grow) * (0.6 + 0.4 * fade), 0.35 + 0.65 * grow);
      d.uniforms.uTime.value = t;
      d.uniforms.uOpacity.value = 0.85 * grow * fade;
      d.ringLook.opacity = 0.6 * grow * fade;
      // the rings sway with the funnel (the same sway as in its shader) and bob a little
      const phase = d.uniforms.uPhase.value as number;
      d.rings.forEach((ring, j) => {
        const h = RINGS[j] + 0.03 * Math.sin(t * 3.1 + j * 2.0);
        ring.position.set(0.32 * h * h * Math.sin(t * 2.3 + h * 3.0 + phase), h * HEIGHT, 0.32 * h * h * Math.cos(t * 1.9 + h * 2.4 + phase));
        ring.scale.setScalar(radiusAt(h) * 1.04);
      });
      // dust thrown out at its foot (looks only)
      if (Math.random() < dt * 34 * grow * fade) {
        const a = Math.random() * Math.PI * 2, r = 0.3 + Math.random() * 0.7;
        this.sparks.emit(this.spot.x + Math.cos(a) * r, 0.15, this.spot.z + Math.sin(a) * r, 1, 2.6, 2.2, 0.8, 0x6e5436, 3);
      }
    }
  }
}
