import * as THREE from 'three';
import { BODY_RADIUS } from '../../effects/projectile';
import { ArenaHazard, CENTER, REACH, type HazardHit, type HazardWorld } from './base';
import { FloorGlows, GlowBeam, Sparks } from './fx';
import type { TelegraphSpec } from '../../effects/telegraph';
import type { Obstacle } from '../../obstacles';

const WARN = 1.7; // seconds the two wedges show before the rays fire
const SWEEP = 3.2; // seconds a ray takes across its wedge
const WEDGE = 110; // degrees each ray sweeps
const SOURCE_Y = 1.75; // the rays leave the altar's top
const FAR_Y = 0.95; // and are at chest height at the rim
const HALF_WIDTH = 0.3;
const CORE = 0xffc060;
const GLOW = 0xd86a18;

/** How far a ray from (x, z) along (dx, dz) gets before it hits cover, in small steps. The altar is its source. */
function rayLength(x: number, z: number, dx: number, dz: number, max: number, obstacles: readonly Obstacle[]) {
  for (let d = 1.2; d < max; d += 0.2) {
    const px = x + dx * d, pz = z + dz * d;
    for (const o of obstacles) {
      if (o.kind === 'pillar' && Math.hypot(o.ax - x, o.az - z) < 0.5) continue;
      const sx = o.bx - o.ax, sz = o.bz - o.az, len2 = sx * sx + sz * sz;
      const k = len2 > 0 ? Math.min(1, Math.max(0, ((px - o.ax) * sx + (pz - o.az) * sz) / len2)) : 0;
      if (Math.hypot(px - (o.ax + sx * k), pz - (o.az + sz * k)) <= o.r) return d;
    }
  }
  return max;
}

const floorVertex = /* glsl */ `
  varying vec2 vP;
  void main() {
    vP = position.xy;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;
const floorFragment = /* glsl */ `
  uniform float uAngle, uDir, uOpacity;
  uniform vec3 uColor;
  varying vec2 vP;
  void main() {
    // The burn left behind a ray: bright at the ray, gone a quarter turn behind it, on both opposite wedges.
    // Local +Y lies on world -Z after the mesh's rotation, so this is the same angle as atan2(dx, dz).
    float a = atan(vP.x, -vP.y);
    float behind = mod((uAngle - a) * uDir + 12.5664, 3.1416);
    if (behind > 1.6) discard;
    float r = length(vP);
    float rings = 0.75 + 0.25 * sin(r * 7.0);
    float glow = exp(-behind * 4.5) * rings * smoothstep(11.6, 9.0, r) * smoothstep(0.8, 1.6, r);
    gl_FragColor = vec4(uColor * glow * uOpacity, 1.0);
  }
`;

/**
 * Night Temple, "The altar wakes": the sun altar in the middle fires two opposite rays that sweep a 110° wedge each.
 * Stay out of the wedges, or behind cover: walls and columns stop a ray.
 */
export class TempleRays extends ArenaHazard {
  readonly warning = 'The altar wakes';
  protected readonly zoneColor = 0xd08a20;
  private start = 0;
  private spin = 1;
  private beams = [new GlowBeam(CORE, GLOW, 1.5), new GlowBeam(CORE, GLOW, 1.5)];
  private floorRays = [new GlowBeam(0xc06a20, 0x7a3208, 2.2), new GlowBeam(0xc06a20, 0x7a3208, 2.2)];
  private aim = [new GlowBeam(0xb07020, 0x704010, 0.22), new GlowBeam(0xb07020, 0x704010, 0.22)];
  private flare = new THREE.Sprite();
  private sparks = new Sparks(160, 0.16);
  private glows = new FloorGlows(4);
  private burn: THREE.ShaderMaterial;
  private time = 0;
  private a = new THREE.Vector3();
  private b = new THREE.Vector3();
  private fade = 0;

  constructor(seed: string) {
    super(seed);
    this.group.add(...[...this.beams, ...this.floorRays, ...this.aim].map((x) => x.mesh), this.sparks.points, this.glows.group);
    this.burn = new THREE.ShaderMaterial({
      vertexShader: floorVertex, fragmentShader: floorFragment, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      uniforms: { uAngle: { value: 0 }, uDir: { value: 1 }, uOpacity: { value: 0 }, uColor: { value: new THREE.Color(0x9a4a10) } },
    });
    const floor = new THREE.Mesh(new THREE.CircleGeometry(REACH, 64), this.burn);
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(CENTER.x, 0.045, CENTER.z);
    floor.renderOrder = 1;
    this.group.add(floor);
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const g = c.getContext('2d')!;
    const grad = g.createRadialGradient(64, 64, 2, 64, 64, 64);
    grad.addColorStop(0, 'rgba(255,214,140,0.9)');
    grad.addColorStop(0.25, 'rgba(240,140,50,0.4)');
    grad.addColorStop(1, 'rgba(120,50,10,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, 128, 128);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    this.flare.material = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0 });
    this.flare.position.set(CENTER.x, SOURCE_Y, CENTER.z);
    this.flare.renderOrder = 3;
    this.group.add(this.flare);
  }

  protected begin() {
    this.start = this.rng() * Math.PI * 2;
    this.spin = this.rng() < 0.5 ? -1 : 1;
    this.duration = WARN + SWEEP + 0.15;
  }

  protected telegraphs(): TelegraphSpec[] {
    return [0, Math.PI].map((turn) => ({
      shape: { kind: 'cone', x: CENTER.x, z: CENTER.z, radius: REACH, angle: WEDGE, dir: this.start + turn } as const,
      start: 0, impact: WARN, until: WARN + SWEEP,
    }));
  }

  protected hitOf(): HazardHit {
    return { damage: 45, color: '#ffb050', from: CENTER };
  }

  /** The rays' angle at event time `t`. */
  private angleAt(t: number) {
    const half = THREE.MathUtils.degToRad(WEDGE) / 2;
    return this.start + this.spin * (-half + 2 * half * THREE.MathUtils.clamp((t - WARN) / SWEEP, 0, 1));
  }

  /** The walk-out check: is a ray about to pass (x, z)? (A spot behind cover still counts: cover can fall.) */
  danger(x: number, z: number, within: number) {
    const t = this.t;
    if (t < 0 || t > WARN + SWEEP) return false;
    if (Math.hypot(x - CENTER.x, z - CENTER.z) > REACH + 0.5) return false;
    const half = THREE.MathUtils.degToRad(WEDGE) / 2;
    const a = Math.atan2(x - CENTER.x, z - CENTER.z);
    for (const turn of [0, Math.PI]) {
      const off = Math.atan2(Math.sin(a - this.start - turn), Math.cos(a - this.start - turn));
      if (Math.abs(off) > half + 0.12) continue;
      // When the ray reaches that angle.
      const when = WARN + ((this.spin * off + half) / (2 * half)) * SWEEP;
      if (when >= t - 0.1 && when - t <= within) return true;
    }
    return false;
  }

  protected tick(dt: number, t: number, live: boolean, world: HazardWorld) {
    this.time += dt;
    const firing = t >= WARN && t <= WARN + SWEEP;
    const charge = t >= 0 && t < WARN ? t / WARN : 0;
    this.fade = firing ? Math.min(1, this.fade + dt * 12) : Math.max(0, this.fade - dt * 5);
    const flareMat = this.flare.material as THREE.SpriteMaterial;
    flareMat.opacity = Math.max(charge * charge * 0.8, this.fade * (0.7 + 0.2 * Math.sin(this.time * 30)));
    this.flare.scale.setScalar(1.2 + charge * 1.8 + this.fade * 2.2);
    this.flare.visible = flareMat.opacity > 0.01;
    this.sparks.update(dt);
    this.glows.update(dt);
    if (t >= 0) this.lastAngle = this.angleAt(t);
    this.burn.uniforms.uAngle.value = this.lastAngle;
    this.burn.uniforms.uDir.value = this.spin;
    this.burn.uniforms.uOpacity.value = this.fade * 0.32;

    for (let i = 0; i < 2; i++) {
      const a0 = this.lastAngle + i * Math.PI;
      const dx = Math.sin(a0), dz = Math.cos(a0);
      // The charging altar draws where the rays will start.
      if (charge > 0) {
        this.a.set(CENTER.x + dx * 1.1, 0.06, CENTER.z + dz * 1.1);
        this.b.set(CENTER.x + dx * REACH, 0.06, CENTER.z + dz * REACH);
      }
      this.aim[i].set(this.a, this.b, world.camera, this.time, charge > 0 ? 0.25 + 0.45 * charge : 0, 0.22, true);
      if (this.fade <= 0) {
        this.beams[i].mesh.visible = this.floorRays[i].mesh.visible = false;
        continue;
      }
      const len = rayLength(CENTER.x, CENTER.z, dx, dz, REACH, world.obstacles());
      const k = len / REACH;
      this.a.set(CENTER.x + dx * 0.6, SOURCE_Y, CENTER.z + dz * 0.6);
      this.b.set(CENTER.x + dx * len, SOURCE_Y + (FAR_Y - SOURCE_Y) * k, CENTER.z + dz * len);
      this.beams[i].set(this.a, this.b, world.camera, this.time, this.fade);
      const endX = this.b.x, endY = this.b.y, endZ = this.b.z;
      this.a.y = this.b.y = 0.05;
      this.floorRays[i].set(this.a, this.b, world.camera, this.time, this.fade * 0.55, 2.2, true);
      if (!firing) continue;
      // Sparks where the ray ends, on a wall or at the rim.
      if (Math.random() < dt * 40) this.sparks.emit(endX, endY, endZ, 3, 3.2, 3, 0.55, 0xf09030);
      if (Math.random() < dt * 22) this.glows.flash(endX, endZ, 1.5, 0xd06a18, 0.35, 0.45);
      if (!live) continue;
      for (const target of world.targets()) {
        const px = target.pos.x - CENTER.x, pz = target.pos.z - CENTER.z;
        const along = px * dx + pz * dz;
        if (along < 0 || along > len + BODY_RADIUS) continue;
        if (Math.abs(px * dz - pz * dx) <= HALF_WIDTH + BODY_RADIUS) this.strike(target, world);
      }
    }
  }

  private lastAngle = 0;
}
