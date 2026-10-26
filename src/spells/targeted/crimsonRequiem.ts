import * as THREE from 'three';
import { Emitter, defaultSettings } from '../../emitter';
import { GlowSphere, createRing, smoothstep } from '../../effects/common';
import {
  CrescentArc, LightningArc, StarBurst, chromaPulse, clearScreenFx, createScreenFx, flashBeat, impactFrameAt,
  type ScreenFx,
} from '../../effects/parts';
import { frameCast, type CastContext } from '../../effects/targeting';
import type { Effect, EffectModule } from '../../effects/types';

/**
 * Crimson Requiem (targeted, up to 5 enemies): the colour drains out of the world until only red survives. A thin
 * red blade is drawn upward from the caster over a grey spiral, red petals orbit and then rush the camera in a
 * full-screen petal wipe. The world returns in monochrome with a white crescent moon standing behind the targets,
 * and red laser slashes from the blade tip hit every enemy in order, each with a flower-shaped star. Then the
 * screen cracks in one frame and everything holds dead still for 1.3 s; light rays, red / white impact cards and
 * a shatter finish the targets before a cream whiteout and falling petals clear the frame.
 *
 * Recipes: i-acheron-petal-wipe-monochrome-slashes, i-acheron-crack-web-shatter-finisher.
 */
export interface CrimsonRequiemSettings {
  slashDamage: number;
  finishDamage: number;
  loop: boolean;
}

export const defaultCrimsonRequiem = (): CrimsonRequiemSettings => ({ slashDamage: 14, finishDamage: 55, loop: false });

const MAX = 5;
const PETALS = 24;
const T_DRAIN = 0.8;
const T_WIPE = 1.6; // petals start rushing the camera
const T_WORLD = 1.9; // wipe ends, moon appears
const T_SLASH = 2.1;
const T_CRACK = 3.3;
const T_RAYS = 4.45;
const T_FRAMES = 4.6;
const T_SHATTER = 4.8;
const T_EXIT = 5.3;
const T_FALL = 5.6;
const DURATION = 6.6;
const LASER_LIFE = 0.075;
const RED = 0xff2030;
const BLADE_R = 8;
const BLADE_S = 0.55;
const BLADE_H = 2 * BLADE_R * Math.sin(BLADE_S / 2); // chord length of the blade arc (vertical)
const MOON_Y = 4.2;

const hash = (n: number) => {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
};

/** Flat two-band petal: dark crimson outline, glossy red inside (front and back), pivot in the middle. */
function petalGeometry(): THREE.BufferGeometry {
  const make = (sx: number, sy: number, oy: number) => {
    const s = new THREE.Shape();
    s.moveTo(0, oy);
    s.bezierCurveTo(0.55 * sx, oy + 0.2 * sy, 0.5 * sx, oy + 0.85 * sy, 0, oy + sy);
    s.bezierCurveTo(-0.5 * sx, oy + 0.85 * sy, -0.55 * sx, oy + 0.2 * sy, 0, oy);
    return new THREE.ShapeGeometry(s);
  };
  const dark = new THREE.Color('#6a0010');
  const red = new THREE.Color('#e8283a');
  const parts: { g: THREE.BufferGeometry; z: number; c: THREE.Color }[] = [
    { g: make(1, 1, 0), z: 0, c: dark },
    { g: make(0.62, 0.78, 0.09), z: 0.004, c: red },
    { g: make(0.62, 0.78, 0.09), z: -0.004, c: red },
  ];
  const pos: number[] = [], col: number[] = [], idx: number[] = [];
  let base = 0;
  for (const p of parts) {
    const pa = p.g.getAttribute('position');
    for (let i = 0; i < pa.count; i++) {
      pos.push(pa.getX(i), pa.getY(i) - 0.5, p.z);
      col.push(p.c.r, p.c.g, p.c.b);
    }
    const ia = p.g.getIndex();
    if (ia) for (let i = 0; i < ia.count; i++) idx.push(base + ia.getX(i));
    base += pa.count;
    p.g.dispose();
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  geo.setIndex(idx);
  return geo;
}

export class CrimsonRequiem implements Effect {
  readonly group = new THREE.Group();
  readonly settings: CrimsonRequiemSettings;
  readonly emitters: Emitter[] = [];
  readonly screen: ScreenFx = createScreenFx();
  shake = 0;
  playing = false;
  ctx: CastContext | null = null;

  private time = 0;
  private count = 0;
  private gap = 0.18;
  private slashDone: boolean[] = [];
  private finishDone = false;
  private bitTimer = 0;
  private hand = new THREE.Vector3();
  private tip = new THREE.Vector3();
  private centroid = new THREE.Vector3();
  private spread = 3;
  private nodes: THREE.Vector3[] = Array.from({ length: MAX }, () => new THREE.Vector3());

  // Camera, captured while rendering (falls back to a side view from +X before the first frame).
  private camPos = new THREE.Vector3(24, 7, 6);
  private camQ = new THREE.Quaternion();
  private haveCam = false;

  private bladeRoot = new THREE.Group();
  private blade: CrescentArc;
  private spiralPlane = new THREE.Group();
  private spiral: CrescentArc[] = [];
  private moonRoot = new THREE.Group();
  private moon: CrescentArc;
  private moonMirrorRoot = new THREE.Group();
  private moonMirror: CrescentArc;
  private petalMat = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide });
  private petals: THREE.InstancedMesh;
  private lasers: LightningArc[] = [];
  private streaks: LightningArc[] = [];
  private flowers: StarBurst[] = [];
  private needles: StarBurst[] = [];
  private bigStars: StarBurst[] = [];
  private tipGlint = new StarBurst({ points: 4, inner: 0.12, jitter: 0, color: 0xffffff, core: 0xffffff });
  private rays = new StarBurst({ points: 24, inner: 0.05, jitter: 0.7, color: 0xffffff, core: 0xfff0f0, additive: false });
  private scorchMat = new THREE.MeshBasicMaterial({ color: 0x2a0008, transparent: true, opacity: 0, depthWrite: false });
  private scorch: THREE.Mesh[] = [];
  private handGlow = new GlowSphere(RED, { rim: false });
  private footRing = createRing(RED, 0.93, 1, 96);
  private shockRing = createRing(RED, 0.9, 1, 96);
  private sparks: Emitter;
  private bits: Emitter;
  private flecks: Emitter;

  private m = new THREE.Matrix4();
  private qa = new THREE.Quaternion();
  private qb = new THREE.Quaternion();
  private pa = new THREE.Vector3();
  private pb = new THREE.Vector3();
  private sc = new THREE.Vector3();
  private eul = new THREE.Euler();

  constructor(settings: CrimsonRequiemSettings = defaultCrimsonRequiem()) {
    this.settings = settings;
    const s = this.screen;
    s.tint.set(0x2a2a32);
    s.keepHue.set(0xff2030);
    s.impactColor.set(0xff1a2a);
    s.speedLineColor.set(RED);
    s.edgeTint.set(0xff2030);
    s.whiteColor.set(0xfde8dc);

    const grab = (_r: THREE.WebGLRenderer, _s: THREE.Scene, camera: THREE.Camera) => {
      camera.getWorldPosition(this.camPos);
      camera.getWorldQuaternion(this.camQ);
      this.haveCam = true;
    };

    // Blade: a long thin vertical red crescent, drawn upward from the hand.
    this.blade = new CrescentArc({ radius: BLADE_R, width: 0.5, sweep: BLADE_S, style: 'toon', edge: 0xffd0d8, mid: RED, outer: 0x6a0010 });
    const inner = new THREE.Group();
    inner.rotation.z = -BLADE_S / 2;
    inner.position.set(-BLADE_R * Math.cos(BLADE_S / 2), BLADE_R * Math.sin(BLADE_S / 2), 0);
    inner.add(this.blade.mesh);
    this.bladeRoot.add(inner);
    this.blade.mesh.onBeforeRender = grab;

    // Grey toon spiral at the caster's feet.
    for (let i = 0; i < 3; i++) {
      const arc = new CrescentArc({
        radius: 3.6 - i * 0.6, width: 1.0, style: 'toon', edge: 0xe8e8f0, mid: 0x8a8a96, outer: 0x20202a, sweep: Math.PI * 1.2,
      });
      arc.mesh.rotation.z = (i * Math.PI * 2) / 3;
      this.spiral.push(arc);
      this.spiralPlane.add(arc.mesh);
    }
    this.spiralPlane.rotation.x = -Math.PI / 2;

    // White crescent moon standing behind the targets, mirrored faintly in the floor.
    const moonOpts = { radius: 5, width: 1.3, sweep: Math.PI * 1.5, style: 'soft' as const, edge: 0xffffff, mid: 0xfff4f4, outer: 0xb8b0c0 };
    this.moon = new CrescentArc(moonOpts);
    this.moonMirror = new CrescentArc(moonOpts);
    this.moonRoot.add(this.moon.mesh);
    this.moonMirrorRoot.add(this.moonMirror.mesh);
    this.moonMirrorRoot.scale.set(1, -1, 1);
    this.moon.mesh.onBeforeRender = grab;

    // Petals.
    this.petals = new THREE.InstancedMesh(petalGeometry(), this.petalMat, PETALS);
    this.petals.frustumCulled = false;
    this.petals.visible = false;
    this.petals.onBeforeRender = grab;

    for (let i = 0; i < MAX; i++) {
      const laser = new LightningArc({ width: 0.12, segments: 6, jitter: 0.005, branches: 0, rerollEvery: 1, dropChance: 0, core: 0xffffff, glow: RED });
      this.lasers.push(laser);
      const flower = new StarBurst({ points: 6, inner: 0.45, jitter: 0.15, color: RED, core: 0xffffff, additive: false });
      const needle = new StarBurst({ points: 8, inner: 0.1, jitter: 0.5, color: 0x14000a, core: 0x6a0010, additive: false });
      const big = new StarBurst({ points: 12, inner: 0.3, color: RED, core: 0xffffff, additive: false });
      for (const st of [flower, big]) st.mesh.traverse((o) => { o.renderOrder = 4; });
      needle.mesh.traverse((o) => { o.renderOrder = 5; });
      this.flowers.push(flower);
      this.needles.push(needle);
      this.bigStars.push(big);
      const sc = new THREE.Mesh(new THREE.CircleGeometry(0.75 + 0.1 * (i % 3), 20), this.scorchMat);
      sc.rotation.x = -Math.PI / 2;
      sc.visible = false;
      this.scorch.push(sc);
      this.group.add(laser.mesh, flower.mesh, needle.mesh, big.mesh, sc);
    }
    for (let i = 0; i < 2; i++) {
      const st = new LightningArc({ width: 0.1, segments: 6, jitter: 0.005, branches: 0, rerollEvery: 1, dropChance: 0, core: 0xffffff, glow: RED });
      this.streaks.push(st);
      this.group.add(st.mesh);
    }

    this.shockRing.material.blending = THREE.NormalBlending;
    this.group.add(
      this.bladeRoot, this.spiralPlane, this.moonRoot, this.moonMirrorRoot, this.petals, this.tipGlint.mesh, this.rays.mesh,
      this.handGlow.mesh, this.footRing.mesh, this.shockRing.mesh,
    );

    this.sparks = new Emitter({
      ...defaultSettings(), maxParticles: 1200, rate: 0, lifetime: 0.45, lifetimeJitter: 0.5,
      shape: 'sphere', shapeSize: 0.3, speed: 10, speedJitter: 0.6, spread: 100, gravity: 8, drag: 2.4,
      sizeStart: 0.13, sizeEnd: 0.02, colorStart: '#ffffff', colorEnd: '#ff2030',
      opacityStart: 0.9, opacityEnd: 0, additive: true, sizeJitter: 0.3, erosion: 0, colorMid: '#ff8090',
    });
    // Red petal bits, normal-blended so they stay solid against the grey world.
    this.bits = new Emitter({
      ...defaultSettings(), maxParticles: 800, rate: 0, lifetime: 1.0, lifetimeJitter: 0.5,
      shape: 'sphere', shapeSize: 0.4, speed: 5, speedJitter: 0.6, spread: 180, gravity: 3, drag: 1.2,
      sizeStart: 0.2, sizeEnd: 0.06, colorStart: '#e8283a', colorEnd: '#6a0010',
      opacityStart: 0.95, opacityEnd: 0, additive: false, sizeJitter: 0.5, erosion: 0.2, spin: 1.5,
    });
    this.flecks = new Emitter({
      ...defaultSettings(), maxParticles: 400, rate: 0, lifetime: 0.8, lifetimeJitter: 0.5,
      shape: 'sphere', shapeSize: 0.5, speed: 4, speedJitter: 0.7, spread: 180, gravity: 5, drag: 1.2,
      sizeStart: 0.15, sizeEnd: 0.05, colorStart: '#1a0a10', colorEnd: '#05020a',
      opacityStart: 0.9, opacityEnd: 0, additive: false, sizeJitter: 0.5, erosion: 0.3, spin: 1,
    });
    this.emitters.push(this.sparks, this.bits, this.flecks);
    for (const e of this.emitters) this.group.add(e.points);
    this.reset();
  }

  get duration() {
    return DURATION;
  }

  slashTime(i: number) {
    return T_SLASH + this.gap * i;
  }

  get centre() {
    return this.centroid;
  }

  get finishRadius() {
    return this.spread + 1.5;
  }

  cast(ctx: CastContext) {
    this.ctx = ctx;
    const pts = (ctx.targetPos.length ? ctx.targetPos : [ctx.point]).slice(0, MAX);
    this.count = pts.length;
    this.gap = this.count >= 4 ? 0.18 : 0.24;
    this.hand.copy(ctx.from).setY(2.4);
    this.tip.copy(this.hand).setY(this.hand.y + BLADE_H);
    this.centroid.set(0, 0, 0);
    pts.forEach((p, i) => { this.nodes[i].copy(p).setY(1.3); this.centroid.add(p); });
    this.centroid.divideScalar(pts.length).setY(0);
    this.spread = 0;
    for (const p of pts) this.spread = Math.max(this.spread, Math.hypot(p.x - this.centroid.x, p.z - this.centroid.z));
    this.screen.silhouettes = [ctx.caster.group, ...ctx.targets.map((e) => e.group)];
    this.screen.focus.copy(this.centroid).setY(1.2);
    this.spiralPlane.position.set(ctx.from.x, 0.06, ctx.from.z);
    this.bladeRoot.position.copy(this.hand);
    for (let i = 0; i < MAX; i++) this.scorch[i].position.set(this.nodes[i].x, 0.03, this.nodes[i].z);
  }

  play() {
    this.reset();
    this.playing = true;
  }

  private reset() {
    this.time = 0;
    this.slashDone = Array.from({ length: MAX }, () => false);
    this.finishDone = false;
    this.bitTimer = 0;
    this.shake = 0;
    clearScreenFx(this.screen);
    for (const e of this.emitters) e.clear();
    this.layout();
    for (const a of this.lasers) a.update(0);
    for (const a of this.streaks) a.update(0);
  }

  update(dt: number) {
    const frozen = this.playing && this.time >= T_CRACK && this.time < T_SHATTER;
    const edt = frozen ? dt * 0.05 : dt; // flakes hang almost still during the crack hold
    for (const e of this.emitters) e.update(edt);
    if (!this.playing) return;
    this.time += dt;
    if (this.time >= this.duration) {
      if (this.settings.loop) { this.play(); return; }
      this.playing = false;
      this.time = this.duration;
      this.layout();
      clearScreenFx(this.screen);
      return;
    }
    const t = this.time;
    const ctx = this.ctx;

    // Red petal bits shed from the caster while the petals orbit.
    if (ctx && t > T_DRAIN && t < T_WIPE) {
      this.bitTimer += dt;
      while (this.bitTimer > 0.05) { this.bitTimer -= 0.05; this.bits.burst(3, this.hand); }
    }
    for (let i = 0; i < this.count; i++) {
      if (!this.slashDone[i] && t >= this.slashTime(i)) { this.slashDone[i] = true; this.onSlash(i); }
    }
    if (!this.finishDone && t >= T_SHATTER) this.onFinish();
    this.layout();
    for (const a of this.lasers) a.update(dt);
    for (const a of this.streaks) a.update(dt);
  }

  private camBasis() {
    if (!this.haveCam) {
      const m = new THREE.Matrix4().lookAt(this.camPos, this.centroid, new THREE.Vector3(0, 1, 0));
      this.camQ.setFromRotationMatrix(m);
    }
    const f = new THREE.Vector3(0, 0, -1).applyQuaternion(this.camQ);
    const r = new THREE.Vector3(1, 0, 0).applyQuaternion(this.camQ);
    const u = new THREE.Vector3(0, 1, 0).applyQuaternion(this.camQ);
    return { f, r, u };
  }

  private layout() {
    const t = this.time;
    const ctx = this.ctx;
    const hasCtx = ctx !== null && this.count > 0;
    const s = this.screen;
    const mt = Math.min(t, T_CRACK); // motion time: everything holds still from the crack onward
    const live = hasCtx && t < T_EXIT;
    const { f, r, u } = this.camBasis();

    // 1. World grade: colour drains to grey (keep red), the scene dims.
    const drain = smoothstep(t / T_DRAIN);
    s.desaturate = live ? drain : 0;
    s.darken = live ? 0.6 * drain : 0;
    s.crack = live && t >= T_CRACK ? 1 : 0;
    s.shatter = live && t >= T_SHATTER ? Math.pow(THREE.MathUtils.clamp((t - T_SHATTER) / 0.5, 0, 1), 1.6) : 0;

    // 2. Impact cards: red dark card, white, red X-ray, red light card, each ~3 frames, with matching focus lines.
    const fi = Math.floor((t - T_FRAMES) / 0.05);
    s.impact = live ? impactFrameAt(t, T_FRAMES, [1, 1, 3, 2], 0.05) : 0;
    if (fi >= 0 && fi < 4) {
      if (fi === 1) { s.impactColor.set(0xffffff); s.speedLineColor.set(0xffffff); } else { s.impactColor.set(0xff1a2a); s.speedLineColor.set(RED); }
    }
    const wipeLines = t >= T_WIPE && t < T_WORLD ? 0.6 * smoothstep((t - T_WIPE) / 0.1) : 0;
    const finLines = t >= T_FRAMES - 0.05 && t < T_SHATTER ? 1 : 0;
    if (!(fi >= 0 && fi < 4)) s.speedLineColor.set(RED);
    s.speedLines = live ? Math.max(wipeLines, finLines) : 0;

    // 3. Chromatic pulse on every slash and on the shatter; anti-flash → cream whiteout at the exit.
    let ch = 0;
    for (let i = 0; i < this.count; i++) ch = Math.max(ch, chromaPulse(t, this.slashTime(i), 0.5));
    s.chroma = hasCtx ? Math.max(ch, chromaPulse(t, T_SHATTER, 0.9)) : 0;
    Object.assign(s, hasCtx ? flashBeat(t, T_EXIT, 0.25, 0.45) : { exposure: 1, whiteout: 0 });

    // 4. Blade drawn upward from the hand; it stays until the exit.
    const bd = 1 - Math.pow(1 - THREE.MathUtils.clamp((t - 0.1) / 0.7, 0, 1), 3);
    this.bladeRoot.position.copy(this.hand);
    this.bladeRoot.rotation.y = Math.atan2(this.camPos.x - this.hand.x, this.camPos.z - this.hand.z);
    this.blade.head = bd;
    this.blade.length = Math.max(0.02, bd);
    this.blade.time = mt;
    this.blade.opacity = live && t > 0.1 ? 1 : 0;
    this.tipGlint.set(this.tip, 0, 0);

    // 5. Grey spiral at the feet forms during the drain, spins, erodes under the wipe.
    this.spiral.forEach((arc, i) => {
      arc.head = Math.min(1.2, 0.15 + 1.05 * smoothstep(t / T_DRAIN));
      arc.length = 0.6;
      arc.time = mt;
      arc.erosion = smoothstep((t - T_WIPE) / 0.3);
      arc.opacity = live && t > 0.05 && t < T_WORLD ? 1 : 0;
      arc.mesh.rotation.z = (i * Math.PI * 2) / 3 + mt * 1.4;
    });
    this.handGlow.mesh.position.copy(this.hand);
    this.handGlow.mesh.scale.setScalar(0.4 + 0.4 * smoothstep(t / T_WIPE));
    this.handGlow.opacity = live && t < T_WORLD ? 0.35 * smoothstep(t / 0.5) : 0;
    const ru = THREE.MathUtils.clamp((t - 1.0) / 0.6, 0, 1);
    this.footRing.mesh.position.set(this.hand.x, 0.07, this.hand.z);
    this.footRing.mesh.scale.setScalar(Math.max(1e-3, 1.5 + 2.2 * ru));
    this.footRing.material.opacity = live && t > 1.0 && t < T_WORLD ? 0.5 * (1 - ru * 0.5) : 0;

    // 6. Petals: orbit and rise (0.8–1.6), rush the camera (1.6–1.9), later drift down (5.6+).
    this.layoutPetals(t, mt, hasCtx, f, r, u);

    // 7. Moon behind the targets: appears at the wipe's end, holds, mirrored faintly in the floor.
    if (t < T_CRACK) {
      const h = new THREE.Vector3(this.centroid.x - this.camPos.x, 0, this.centroid.z - this.camPos.z);
      if (h.lengthSq() < 1e-4) h.set(-1, 0, 0);
      h.normalize();
      this.moonRoot.position.set(this.centroid.x + h.x * 3.5, MOON_Y, this.centroid.z + h.z * 3.5);
      this.moonMirrorRoot.position.set(this.moonRoot.position.x, -MOON_Y, this.moonRoot.position.z);
      const yaw = Math.atan2(this.camPos.x - this.moonRoot.position.x, this.camPos.z - this.moonRoot.position.z);
      this.moonRoot.rotation.y = yaw;
      this.moonMirrorRoot.rotation.y = yaw;
    }
    const mo = live && t >= T_WORLD ? 1 : 0;
    const er = 1 - smoothstep((t - T_WORLD) / 0.35);
    for (const [arc, op] of [[this.moon, 0.7], [this.moonMirror, 0.22]] as [CrescentArc, number][]) {
      arc.head = 1;
      arc.length = 1;
      arc.time = mt;
      arc.erosion = er;
      arc.opacity = mo * op;
      arc.mesh.rotation.z = 0.35 + mt * 0.03;
    }

    // 8. Slashes: laser from the blade tip, flower star with black needles, tip glint, scorch.
    let glintSize = 0, glintOp = 0, glintAt = this.tip;
    for (let i = 0; i < MAX; i++) {
      const used = hasCtx && i < this.count;
      const age = t - this.slashTime(i);
      const node = this.nodes[i];
      const laser = this.lasers[i];
      if (used && age >= 0 && age < LASER_LIFE) {
        laser.setEnds(this.tip, node);
        laser.opacity = 1;
      } else laser.opacity = 0;
      const pop = StarBurst.pop(age, 0.1, 0.2);
      if (used && pop.opacity > 0) {
        this.flowers[i].set(node, 3.2 * pop.scale, pop.opacity, i * 0.6);
        const np = StarBurst.pop(age - 0.04, 0.08, 0.15);
        this.needles[i].set(node, 2.3 * np.scale, np.opacity, i * 0.6 + 0.5);
      } else {
        this.flowers[i].set(node, 0, 0);
        this.needles[i].set(node, 0, 0);
      }
      if (used) {
        const g = StarBurst.pop(age, 0.05, 0.12);
        if (g.opacity > 0 && g.scale > glintSize) { glintSize = g.scale; glintOp = g.opacity; glintAt = this.tip; }
      }
      const sc = this.scorch[i];
      const on = used && age > 0 && t < T_EXIT + 0.3;
      sc.visible = on;
      if (on) sc.scale.setScalar(Math.max(1e-4, Math.min(1, age * 8)));
    }
    this.scorchMat.opacity = hasCtx ? 0.6 * (t > T_EXIT ? Math.max(0, 1 - (t - T_EXIT) / 0.3) : 1) : 0;
    if (glintOp > 0) this.tipGlint.set(glintAt, 1.2 * glintSize, glintOp, t * 3);

    // 9. Two horizontal laser streaks across the screen area at 2.9 and 3.0.
    const flat = r.clone().setY(0);
    if (flat.lengthSq() < 1e-4) flat.set(0, 0, 1);
    flat.normalize();
    const heights = [1.1, 2.6];
    this.streaks.forEach((st, k) => {
      const age = t - (2.9 + 0.1 * k);
      if (hasCtx && age >= 0 && age < LASER_LIFE) {
        const a = this.centroid.clone().addScaledVector(flat, -13).setY(heights[k]);
        const b = this.centroid.clone().addScaledVector(flat, 13).setY(heights[k] + 0.3);
        st.setEnds(a, b);
        st.opacity = 1;
      } else st.opacity = 0;
    });

    // 10. Finisher: rays, big stars on every target, shock ring.
    const rayAge = t - T_RAYS;
    if (hasCtx && rayAge >= 0 && t < T_FRAMES + 0.2) {
      this.rays.set(new THREE.Vector3(this.centroid.x, 1.2, this.centroid.z), 4 + 14 * smoothstep(rayAge / 0.15), 0.95, t * 0.5);
    } else this.rays.set(this.centroid, 0, 0);
    const fa = t - T_SHATTER;
    for (let i = 0; i < MAX; i++) {
      const used = hasCtx && i < this.count;
      const bp = StarBurst.pop(fa - i * 0.02, 0.15, 0.25);
      if (used && bp.opacity > 0) this.bigStars[i].set(new THREE.Vector3(this.nodes[i].x, 1.3, this.nodes[i].z), 5.5 * bp.scale, bp.opacity, i * 0.5);
      else this.bigStars[i].set(this.nodes[i], 0, 0);
    }
    const su = THREE.MathUtils.clamp(fa / 0.6, 0, 1);
    this.shockRing.mesh.position.set(this.centroid.x, 0.08, this.centroid.z);
    this.shockRing.mesh.scale.setScalar(Math.max(1e-3, 1 + 14 * (1 - Math.pow(1 - su, 3))));
    this.shockRing.material.opacity = hasCtx && fa > 0 && fa < 0.8 ? 0.7 * (1 - fa / 0.8) : 0;

    // 11. Shake: small kick per slash, dead still in the hold, heavy at the shatter.
    let sh = 0;
    for (let i = 0; i < this.count; i++) {
      const a = t - this.slashTime(i);
      if (a >= 0) sh = Math.max(sh, 0.3 * Math.exp(-a * 10));
    }
    if (fa >= 0) sh = Math.max(sh, 0.8 * Math.exp(-fa * 6));
    this.shake = hasCtx && !(t >= T_CRACK && t < T_SHATTER) ? sh : 0;
  }

  private layoutPetals(t: number, mt: number, hasCtx: boolean, f: THREE.Vector3, r: THREE.Vector3, u: THREE.Vector3) {
    const ctx = this.ctx;
    if (!hasCtx || !ctx) { this.petals.visible = false; return; }
    const orbitPhase = t >= T_DRAIN && t < T_WORLD;
    const fallPhase = t >= T_FALL;
    if (!orbitPhase && !fallPhase) { this.petals.visible = false; return; }
    this.petals.visible = true;
    const cx = ctx.from.x, cz = ctx.from.z;
    for (let i = 0; i < PETALS; i++) {
      const h0 = hash(i + 1), h1 = hash(i + 41), h2 = hash(i + 83), h3 = hash(i + 127);
      let scale = 1e-4;
      if (orbitPhase) {
        const ph = THREE.MathUtils.clamp((mt - T_DRAIN) / 0.8, 0, 1);
        const a = (i / PETALS) * Math.PI * 2 + h0 + 2.4 * (mt - T_DRAIN);
        const rad = (1.2 + 0.5 * (i % 4)) * (0.8 + 1.0 * ph);
        const hgt = 0.4 + 2.8 * ph * (0.6 + 0.4 * h1);
        this.pa.set(cx + Math.cos(a) * rad, hgt, cz + Math.sin(a) * rad);
        this.eul.set(h1 * 6.28, a + h2 * 3, h3 * 6.28 + mt * (2 + 3 * h2));
        this.qa.setFromEuler(this.eul);
        const base = 0.6 + 0.3 * h3;
        scale = base * smoothstep((mt - T_DRAIN - 0.02 * i) / 0.2);
        // Wipe: fly to the camera, face it, scale up to fill the frame.
        const e = Math.pow(THREE.MathUtils.clamp((t - T_WIPE) / 0.25, 0, 1), 2);
        if (e > 0) {
          const d = 3.0 + 2.5 * h1;
          this.pb.copy(this.camPos).addScaledVector(f, d).addScaledVector(r, (h2 * 2 - 1) * 3.5).addScaledVector(u, (h0 * 2 - 1) * 2.2);
          this.qb.copy(this.camQ).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), h3 * 6.28 + t * 2));
          this.pa.lerp(this.pb, e);
          this.qa.slerp(this.qb, e);
          const big = (9 + 4 * h2) * (1 + Math.max(0, t - 1.8) * 2);
          scale = base * (1 - e) + big * e;
        }
      } else {
        // Exit: petals drift down over the target area once the whiteout clears.
        const age = t - T_FALL - 0.03 * i;
        if (age < 0) {
          this.m.compose(this.pa.set(0, -50, 0), this.qa.identity(), this.sc.setScalar(1e-4));
          this.petals.setMatrixAt(i, this.m);
          continue;
        }
        const ang = h0 * 6.28;
        const rad = 0.5 + 6 * h1;
        this.pa.set(this.centroid.x + Math.cos(ang) * rad + 0.4 * Math.sin(age * 2 + i), 6.5 + 2 * h2 - (2.8 + 1.8 * h3) * age, this.centroid.z + Math.sin(ang) * rad);
        this.eul.set(h1 * 6.28 + age * 2, h2 * 6.28 + age * 1.5, h3 * 6.28 + age * 3);
        this.qa.setFromEuler(this.eul);
        scale = (0.5 + 0.3 * h3) * smoothstep(age / 0.1) * (1 - smoothstep((t - (DURATION - 0.3)) / 0.3));
      }
      this.m.compose(this.pa, this.qa, this.sc.setScalar(Math.max(1e-4, scale)));
      this.petals.setMatrixAt(i, this.m);
    }
    this.petals.instanceMatrix.needsUpdate = true;
  }

  private awayFrom(p: THREE.Vector3) {
    const from = this.ctx ? this.ctx.from.clone() : new THREE.Vector3();
    if (Math.hypot(p.x - from.x, p.z - from.z) < 0.5) from.set(p.x, 0, p.z + 1);
    return from;
  }

  private onSlash(i: number) {
    const ctx = this.ctx;
    if (!ctx) return;
    const e = ctx.targets[i];
    const at = this.nodes[i];
    this.sparks.burst(60, at);
    this.bits.burst(40, at);
    this.flecks.burst(14, at);
    if (e) ctx.hit(e, { damage: this.settings.slashDamage, knock: 1, from: this.awayFrom(ctx.targetPos[i]), color: '#ff4050' });
  }

  private onFinish() {
    this.finishDone = true;
    const ctx = this.ctx;
    if (!ctx) return;
    ctx.targets.forEach((e, i) => {
      const p = ctx.targetPos[i];
      if (!p || i >= MAX) return;
      const at = new THREE.Vector3(p.x, 1.3, p.z);
      this.sparks.burst(220, at);
      this.bits.burst(120, at);
      this.flecks.burst(40, at);
      // Knock away from the group centre; a lone / central target is knocked away from the caster instead.
      const from = new THREE.Vector3(this.centroid.x, 0, this.centroid.z);
      if (Math.hypot(p.x - this.centroid.x, p.z - this.centroid.z) < 0.5) from.copy(this.awayFrom(p));
      ctx.hit(e, { damage: this.settings.finishDamage, knock: 8, from, color: '#ff4050' });
    });
  }
}

export const crimsonRequiemModule: EffectModule = {
  label: 'crimson requiem',
  category: 'targeted',
  targeting: { mode: 'enemies', maxTargets: MAX },
  create: () => new CrimsonRequiem(),
  telegraphs(effect) {
    const e = effect as CrimsonRequiem;
    const ctx = e.ctx;
    if (!ctx) return [];
    const pts = (ctx.targetPos.length ? ctx.targetPos : [ctx.point]).slice(0, MAX);
    const out = pts.map((p, i) => ({
      shape: { kind: 'circle' as const, x: p.x, z: p.z, radius: 1.6 }, start: 0.2, impact: e.slashTime(i),
    }));
    const c = e.centre;
    out.push({ shape: { kind: 'circle' as const, x: c.x, z: c.z, radius: e.finishRadius }, start: T_CRACK, impact: T_SHATTER });
    return out;
  },
  bloom: { enabled: true, strength: 0.5, radius: 0.5, threshold: 0.85 },
  frameCamera(camera, controls, effect) {
    const e = effect as CrimsonRequiem;
    if (e.ctx) frameCast(camera, controls, e.ctx, 8);
  },
  buildGui(f, effect) {
    const s = (effect as CrimsonRequiem).settings;
    f.add(s, 'loop');
    f.add(s, 'slashDamage', 1, 80, 1).name('slash damage');
    f.add(s, 'finishDamage', 1, 150, 1).name('finisher damage');
  },
};
