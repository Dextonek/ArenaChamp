import * as THREE from 'three';
import { ArenaHazard, CENTER, REACH, type HazardHit, type HazardThreat, type HazardWorld } from './base';
import { FloorGlows, Sparks } from './fx';

const WARN = 1.3; // seconds before a tongue's first stretch is under water
const STEP = 0.28; // seconds between stretches
const COUNT = 5; // stretches per tongue
const LENGTH = 3.6; // metres per stretch: five of them run three quarters of the way across
const WIDTH = 4.2;
const HOLD = 0.3; // how long a stretch hurts

/**
 * Drowned Harbour, "The swell breaks": two tongues of sea wash over the quay from opposite sides, each running three
 * quarters of the way across, stretch after stretch. The second is the first turned half round the centre. Step out of
 * the lane, or wait: a stretch only hurts for a moment as the water's front passes. It hits less than the other arenas'
 * events and slows.
 */
export class SwellBreaks extends ArenaHazard {
  readonly warning = 'The swell breaks';
  protected readonly zoneColor = 0x4aa8d0;
  private sparks = new Sparks(180, 0.12);
  private glows = new FloorGlows(12);
  private sheets: { mesh: THREE.Mesh; uniforms: Record<string, THREE.IUniform> }[] = [];

  constructor(seed: string) {
    super(seed);
    for (let i = 0; i < 2; i++) {
      const uniforms = { uFront: { value: -1 }, uFade: { value: 0 }, uTime: { value: 0 } };
      const mesh = new THREE.Mesh(
        new THREE.PlaneGeometry(WIDTH, COUNT * LENGTH).rotateX(-Math.PI / 2),
        new THREE.ShaderMaterial({
          uniforms, transparent: true, depthWrite: false,
          vertexShader: /* glsl */ `
            varying vec2 vUv;
            void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
          // v runs along the tongue, 0 where it comes over the kerb. A clean sheet of water behind a pale front line.
          fragmentShader: /* glsl */ `
            varying vec2 vUv;
            uniform float uFront, uFade, uTime;
            void main() {
              float side = abs(vUv.x - 0.5) * 2.0;
              float lobe = 0.035 * sin(vUv.x * 19.0 + uTime * 3.0);
              float behind = uFront + lobe - vUv.y;
              if (behind < 0.0 || side > 0.97) discard;
              float body = smoothstep(0.75, 0.0, behind) * (1.0 - smoothstep(0.86, 0.97, side));
              vec3 col = mix(vec3(0.07, 0.29, 0.4), vec3(0.25, 0.58, 0.7), smoothstep(0.3, 0.0, behind));
              col = mix(col, vec3(0.75, 0.89, 0.93), 1.0 - smoothstep(0.012, 0.03, behind));
              gl_FragColor = vec4(col, 0.8 * body * uFade);
              #include <tonemapping_fragment>
              #include <colorspace_fragment>
            }`,
        }),
      );
      mesh.renderOrder = 2;
      mesh.visible = false;
      this.sheets.push({ mesh, uniforms });
      this.group.add(mesh);
    }
    this.group.add(this.sparks.points, this.glows.group);
  }

  protected begin() {
    const angle = this.rng() * Math.PI * 2, lane = 2.2 + this.rng() * 2.6;
    const along = { x: Math.sin(angle), z: Math.cos(angle) }, across = { x: along.z, z: -along.x };
    [1, -1].forEach((side, s) => {
      // (u, lane) in the tongue's own frame; the second tongue is the first turned half round the centre
      const at = (u: number) => ({ x: CENTER.x + (along.x * u + across.x * lane) * side, z: CENTER.z + (along.z * u + across.z * lane) * side });
      for (let i = 0; i < COUNT; i++) {
        const a = at(-REACH + i * LENGTH), b = at(-REACH + (i + 1) * LENGTH);
        this.threats.push({ shape: { kind: 'line', x1: a.x, z1: a.z, x2: b.x, z2: b.z, width: WIDTH }, at: WARN + i * STEP, to: WARN + i * STEP + HOLD });
      }
      const mid = at(-REACH + (COUNT * LENGTH) / 2), sheet = this.sheets[s];
      sheet.mesh.position.set(mid.x, 0.06, mid.z);
      // the plane's +v end is its -z side: turn it so that v = 0 is where the water comes in
      sheet.mesh.rotation.y = Math.atan2(along.x * side, along.z * side) + Math.PI;
      sheet.mesh.visible = true;
    });
    this.duration = WARN + (COUNT - 1) * STEP + HOLD + 0.6;
  }

  protected hitOf(): HazardHit {
    return { damage: 35, slow: 1.5, color: '#9fd8ff', from: CENTER };
  }

  protected landed(th: HazardThreat) {
    if (th.shape.kind !== 'line') return;
    const { x1, z1, x2, z2 } = th.shape;
    for (let k = 0; k < 3; k++) {
      const f = 0.2 + 0.3 * k, x = x1 + (x2 - x1) * f, z = z1 + (z2 - z1) * f;
      this.sparks.emit(x + (Math.random() - 0.5) * WIDTH * 0.7, 0.2, z + (Math.random() - 0.5) * WIDTH * 0.7, 9, 3.2, 3.6, 0.6, 0xbfe6f4);
    }
    this.glows.flash((x1 + x2) / 2, (z1 + z2) / 2, WIDTH * 0.8, 0x2f7fa8, 0.7, 0.3);
  }

  protected tick(dt: number, t: number, _live: boolean, _world: HazardWorld) {
    this.sparks.update(dt);
    this.glows.update(dt);
    const end = WARN + (COUNT - 1) * STEP + HOLD;
    for (const s of this.sheets) {
      if (t < 0) {
        s.mesh.visible = false;
        continue;
      }
      // the front runs the tongue's length between the first stretch's moment and the last one's
      s.uniforms.uFront.value = Math.min(1.02, Math.max(-0.05, (t - WARN + STEP * 0.5) / (COUNT * STEP)));
      s.uniforms.uFade.value = t < end ? 1 : Math.max(0, 1 - (t - end) / 0.6);
      s.uniforms.uTime.value = t;
    }
  }
}
