import * as THREE from 'three';
import { Emitter, defaultSettings } from '../../emitter';
import { smoothstep } from '../../effects/common';
import {
  CrescentArc, SmokeBall, StarBurst, chromaPulse, clearScreenFx, createScreenFx, impactFrameAt,
} from '../../effects/parts';
import { frameCast, type CastContext } from '../../effects/targeting';
import type { Effect, EffectModule } from '../../effects/types';

/**
 * Ink Moon Severance (targeted, up to five enemies): the world drains to a dark violet monochrome while ink drips
 * up from the caster's hand and a thin violet brush line draws itself across the ground through the chosen
 * enemies, nearest first. A giant calligraphy crescent is then painted in the sky by a moving brush tip (a black
 * brush body over a thin violet-white edge), faces back toward the caster so it reads as a moon from the play
 * camera, hangs for a dead beat, and cuts down and along the ground path. Every enemy it crosses gets a flat black
 * ink slash with a thin pale edge and a 2-3 frame magenta star. On the sever beat (impact frames in violet) each
 * slash splits into two halves that slide apart along the cut, a small ink burst pops at each enemy, and the moon
 * dissolves into falling ink petals while the colour returns.
 */
export interface InkMoonSeveranceSettings {
  /** Damage of the final sever hit on every enemy (the crossing hits are small). */
  damage: number;
  loop: boolean;
}

export const defaultInkMoonSeverance = (): InkMoonSeveranceSettings => ({ damage: 40, loop: false });

const MAX = 5;
const BRUSH_END = 0.5;
const PAINT_END = 1.3;
const CUT_START = 1.55;
const CROSS_FIRST = 0.12;
const CROSS_STEP = 0.085;
const SEVER = 2.15;
const DURATION = 4.2;

const MOON_R = 4.5;
const MOON_W = 2.0;
const MOON_SWEEP = Math.PI * 1.5;
const MOON_COVER_SHIFT = 0.22;
const MOON_GAP_ANGLE = -1.5 * Math.PI;
const MOON_HEIGHT = 7;
const SLASH_R = 2.7;
const SLASH_SWEEP = Math.PI * 0.8;

const INK = 0x07030c;
const INK_VIOLET = 0x0d0518;
const EDGE = 0xf0d8ff;
const HOT = 0xd68cff;
const BODY = 0x8a2ee0;
const MAGENTA = 0xff3fa0;

const clamp01 = (x: number) => THREE.MathUtils.clamp(x, 0, 1);
const UP = new THREE.Vector3(0, 1, 0);

/** Orientation of a plane whose face points back toward the caster (and a little up): local +Z is the face. */
function facingQuat(fwd: THREE.Vector3, tilt: number, out: THREE.Quaternion) {
  const z = new THREE.Vector3().copy(fwd).multiplyScalar(-Math.cos(tilt)).addScaledVector(UP, Math.sin(tilt)).normalize();
  const x = new THREE.Vector3(-fwd.z, 0, fwd.x);
  const y = new THREE.Vector3().crossVectors(z, x);
  return out.setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, z));
}

interface Slash {
  root: THREE.Group;
  wrap: THREE.Group;
  a: CrescentArc;
  b: CrescentArc;
  star: StarBurst;
  star2: StarBurst;
  phi: number;
}

interface Waypoint { t: number; p: THREE.Vector3 }

export class InkMoonSeverance implements Effect {
  readonly group = new THREE.Group();
  readonly settings: InkMoonSeveranceSettings;
  readonly emitters: Emitter[] = [];
  readonly screen = createScreenFx();
  shake = 0;
  playing = false;

  /** Last cast; frameCamera and telegraphs read it. Null until the first play(). */
  ctx: CastContext | null = null;
  private time = 0;
  private severed = false;
  private smokeDone = false;
  private crossDone: boolean[] = [];
  private n = 0;

  // Cast geometry.
  private hand = new THREE.Vector3();
  private fwd = new THREE.Vector3(0, 0, -1);
  private centroid = new THREE.Vector3();
  private pos: THREE.Vector3[] = [];
  private dirs: THREE.Vector3[] = [];
  private enemies: CastContext['targets'][number][] = [];
  private tCross: number[] = [];
  private way: Waypoint[] = [];
  private segs: { a: THREE.Vector3; b: THREE.Vector3; len: number; cum: number }[] = [];
  private pathLen = 1;

  // Moon.
  private moonRoot = new THREE.Group();
  private moonSpin = new THREE.Group();
  private moonLight = new CrescentArc({ radius: MOON_R, width: MOON_W, sweep: MOON_SWEEP, style: 'toon', edge: HOT, mid: HOT, outer: HOT });
  private moonBody = new CrescentArc({ radius: MOON_R + MOON_COVER_SHIFT, width: MOON_W, sweep: MOON_SWEEP, style: 'toon', edge: INK, mid: INK_VIOLET, outer: INK });
  private moonQuat = new THREE.Quaternion();
  private moonDiscMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, side: THREE.DoubleSide,
    uniforms: { uOpacity: { value: 0 }, uCentre: { value: new THREE.Color(0xe8dcf4) }, uRim: { value: new THREE.Color(BODY) } },
    vertexShader: 'varying vec2 vP; void main() { vP = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `uniform float uOpacity; uniform vec3 uCentre, uRim; varying vec2 vP;
      void main() {
        float r = length(vP) / ${(MOON_R * 1.15).toFixed(3)};
        float a = (1.0 - smoothstep(0.82, 1.0, r)) * uOpacity;
        gl_FragColor = vec4(mix(uCentre, uRim, smoothstep(0.35, 1.0, r)), a);
      }`,
  });
  private moonDisc = new THREE.Mesh(new THREE.CircleGeometry(MOON_R * 1.15, 64), this.moonDiscMat);

  private slashes: Slash[] = [];
  private lineLight: THREE.Mesh[] = [];
  private lineDark: THREE.Mesh[] = [];
  private lineLightMat = new THREE.MeshBasicMaterial({ color: HOT, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
  private lineDarkMat = new THREE.MeshBasicMaterial({ color: INK, transparent: true, opacity: 0, depthWrite: false });
  private glint = new StarBurst({ points: 4, inner: 0.12, jitter: 0, color: HOT, core: EDGE });
  private smoke = new SmokeBall({ color: INK, rim: 0x2a0a4a, flake: BODY, maxBalls: 6 });

  private inkDrip: Emitter;
  private inkSplat: Emitter;
  private inkBurst: Emitter;
  private spray: Emitter;
  private edgeSparks: Emitter;
  private petals: Emitter;

  constructor(settings: InkMoonSeveranceSettings = defaultInkMoonSeverance()) {
    this.settings = settings;
    this.screen.tint.set(INK);
    this.screen.impactColor.set(BODY);
    this.screen.speedLineColor.set(HOT);
    this.screen.keepHue.set(BODY);
    this.screen.edgeTint.set(MAGENTA);

    // Moon: pale-violet arc underneath, the black brush body on top shifted outward so only a thin inner edge shows.
    this.moonLight.mesh.renderOrder = 10;
    this.moonBody.mesh.renderOrder = 11;
    this.moonLight.mesh.rotation.z = MOON_GAP_ANGLE;
    this.moonBody.mesh.rotation.z = MOON_GAP_ANGLE;
    this.moonSpin.add(this.moonLight.mesh, this.moonBody.mesh);
    // Pale full-moon disc behind the crescent, so the black ink reads as a silhouette.
    this.moonDisc.renderOrder = 5;
    this.moonDisc.position.z = -0.15;
    this.moonDisc.visible = false;
    this.moonRoot.add(this.moonDisc, this.moonSpin);
    this.group.add(this.moonRoot);

    // Ground path: one thin pale line over a wider dark ink strip, per segment.
    const strip = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
    for (let i = 0; i < MAX - 1; i++) {
      const dark = new THREE.Mesh(strip, this.lineDarkMat);
      const light = new THREE.Mesh(strip, this.lineLightMat);
      dark.position.y = 0.03;
      light.position.y = 0.045;
      dark.renderOrder = 2;
      light.renderOrder = 3;
      dark.visible = false;
      light.visible = false;
      this.lineDark.push(dark);
      this.lineLight.push(light);
      this.group.add(dark, light);
    }

    for (let i = 0; i < MAX; i++) {
      const root = new THREE.Group();
      const wrap = new THREE.Group();
      const mk = () => new CrescentArc({ radius: SLASH_R, width: 0.95, sweep: SLASH_SWEEP / 2, style: 'toon', edge: 0xe6c8ff, mid: INK_VIOLET, outer: INK });
      const a = mk();
      const b = mk();
      a.mesh.renderOrder = 20;
      b.mesh.renderOrder = 20;
      wrap.add(a.mesh, b.mesh);
      root.add(wrap);
      root.visible = false;
      const star = new StarBurst({ points: 8, inner: 0.3, color: MAGENTA, core: MAGENTA, additive: false });
      const star2 = new StarBurst({ points: 10, inner: 0.25, color: MAGENTA, core: MAGENTA, additive: false });
      this.slashes.push({ root, wrap, a, b, star, star2, phi: 0 });
      this.group.add(root, star.mesh, star2.mesh);
    }
    this.group.add(this.glint.mesh, this.smoke.mesh);

    this.inkDrip = new Emitter({
      ...defaultSettings(), maxParticles: 300, rate: 0, lifetime: 0.8, lifetimeJitter: 0.4,
      shape: 'sphere', shapeSize: 0.12, speed: 2.4, speedJitter: 0.6, spread: 25, gravity: 5, drag: 0.6,
      sizeStart: 0.17, sizeEnd: 0.05, colorStart: '#0d0518', colorEnd: '#07030c',
      opacityStart: 0.95, opacityEnd: 0, additive: false, sizeJitter: 0.4, erosion: 0,
    });
    this.inkSplat = new Emitter({
      ...defaultSettings(), maxParticles: 500, rate: 0, lifetime: 0.7, lifetimeJitter: 0.5,
      shape: 'sphere', shapeSize: 0.1, speed: 5, speedJitter: 0.7, spread: 180, gravity: 9, drag: 1.5,
      sizeStart: 0.2, sizeEnd: 0.04, colorStart: '#0d0518', colorEnd: '#07030c',
      opacityStart: 1, opacityEnd: 0, additive: false, sizeJitter: 0.5, erosion: 0,
    });
    this.inkBurst = new Emitter({
      ...defaultSettings(), maxParticles: 500, rate: 0, lifetime: 0.5, lifetimeJitter: 0.4,
      shape: 'sphere', shapeSize: 0.25, speed: 5.5, speedJitter: 0.5, spread: 180, gravity: 8, drag: 2.6,
      sizeStart: 0.3, sizeEnd: 0.06, colorStart: '#12062a', colorEnd: '#07030c',
      opacityStart: 0.95, opacityEnd: 0, additive: false, sizeJitter: 0.4, erosion: 0.3,
    });
    this.spray = new Emitter({
      ...defaultSettings(), maxParticles: 500, rate: 0, lifetime: 0.5, lifetimeJitter: 0.5,
      shape: 'sphere', shapeSize: 0.25, speed: 10, speedJitter: 0.6, spread: 180, gravity: 9, drag: 1.8,
      sizeStart: 0.11, sizeEnd: 0.02, colorStart: '#f0d8ff', colorEnd: '#8a2ee0',
      opacityStart: 0.9, opacityEnd: 0, additive: true, sizeJitter: 0.3, erosion: 0,
    });
    this.edgeSparks = new Emitter({
      ...defaultSettings(), maxParticles: 200, rate: 0, lifetime: 0.6, lifetimeJitter: 0.5,
      shape: 'sphere', shapeSize: 0.15, speed: 0.8, speedJitter: 0.6, spread: 180, gravity: 1, drag: 1.2,
      sizeStart: 0.1, sizeEnd: 0.02, colorStart: '#f0d8ff', colorEnd: '#8a2ee0',
      opacityStart: 0.85, opacityEnd: 0, additive: true, sizeJitter: 0.4, erosion: 0,
    });
    // Falling ink petals: dark flakes that tumble down slowly.
    this.petals = new Emitter({
      ...defaultSettings(), maxParticles: 600, rate: 0, lifetime: 1.6, lifetimeJitter: 0.4,
      shape: 'sphere', shapeSize: 0.2, speed: 1.2, speedJitter: 0.7, spread: 180, gravity: 2.2, drag: 1.1,
      sizeStart: 0.26, sizeEnd: 0.1, colorStart: '#2a0a4a', colorEnd: '#07030c',
      opacityStart: 0.95, opacityEnd: 0, additive: false, colorMid: '#12062a', sizeJitter: 0.5, erosion: 0.35, spin: 1.5,
    });
    this.emitters.push(this.inkDrip, this.inkSplat, this.inkBurst, this.spray, this.edgeSparks, this.petals, this.smoke.emitter);
    for (const e of [this.inkDrip, this.inkSplat, this.inkBurst, this.spray, this.edgeSparks, this.petals]) this.group.add(e.points);
    this.reset();
  }

  get impactTime() {
    return SEVER;
  }
  get duration() {
    return DURATION;
  }

  cast(ctx: CastContext) {
    this.ctx = ctx;
    const pts = ctx.targetPos.length ? ctx.targetPos : [ctx.point];
    const count = Math.min(MAX, pts.length);
    const order = Array.from({ length: count }, (_, i) => i)
      .sort((a, b) => pts[a].distanceToSquared(ctx.from) - pts[b].distanceToSquared(ctx.from));
    this.n = count;
    this.pos = order.map((i) => pts[i].clone().setY(0));
    this.enemies = order.map((i) => ctx.targets[i]).filter((e): e is CastContext['targets'][number] => !!e);
    this.centroid.set(0, 0, 0);
    for (const p of this.pos) this.centroid.add(p);
    this.centroid.divideScalar(Math.max(1, count));

    // Caster -> centroid direction (the gameplay camera sits behind the caster looking along it).
    this.fwd.set(this.centroid.x - ctx.from.x, 0, this.centroid.z - ctx.from.z);
    if (this.fwd.lengthSq() < 1e-3) this.fwd.set(Math.sin(ctx.aim), 0, Math.cos(ctx.aim));
    if (this.fwd.lengthSq() < 1e-6) this.fwd.set(0, 0, -1);
    this.fwd.normalize();
    const right = new THREE.Vector3(-this.fwd.z, 0, this.fwd.x);
    this.hand.copy(ctx.from).addScaledVector(right, 0.5).addScaledVector(this.fwd, 0.3).setY(2.0);

    // Cut direction at every target: toward the next one, the last one keeps the incoming direction.
    this.dirs = this.pos.map((p, i) => {
      const d = new THREE.Vector3();
      if (count > 1) {
        if (i < count - 1) d.subVectors(this.pos[i + 1], p);
        else d.subVectors(p, this.pos[i - 1]);
      }
      d.setY(0);
      if (d.lengthSq() < 1e-4) d.copy(this.fwd);
      return d.normalize();
    });
    this.tCross = this.pos.map((_, i) => CUT_START + CROSS_FIRST + i * CROSS_STEP);

    // Moon path: hover between caster and targets, then dive through every target in order.
    const hover = new THREE.Vector3().lerpVectors(ctx.from, this.centroid, 0.6).setY(0);
    this.way = [{ t: CUT_START, p: hover }];
    this.pos.forEach((p, i) => this.way.push({ t: this.tCross[i], p }));
    const lastDir = this.dirs[count - 1] ?? this.fwd;
    const last = this.pos[count - 1] ?? this.centroid;
    this.way.push({ t: SEVER, p: last.clone().addScaledVector(lastDir, 1.5) });

    // Ground guide path through all targets (extended past both ends).
    const line: THREE.Vector3[] = this.pos.map((p) => p.clone());
    if (count === 1) {
      line[0] = this.pos[0].clone().addScaledVector(this.fwd, -3);
      line.push(this.pos[0].clone().addScaledVector(this.fwd, 3));
    } else {
      line[0].addScaledVector(this.dirs[0], -1.5);
      line[count - 1].addScaledVector(this.dirs[count - 1], 1.5);
    }
    this.segs = [];
    let cum = 0;
    for (let i = 0; i < line.length - 1 && i < MAX - 1; i++) {
      const len = Math.max(1e-3, line[i].distanceTo(line[i + 1]));
      this.segs.push({ a: line[i], b: line[i + 1], len, cum });
      cum += len;
    }
    this.pathLen = Math.max(1e-3, cum);

    // One ink slash per target, camera-facing, at a sharp diagonal that alternates a little.
    const q = facingQuat(this.fwd, 0.25, new THREE.Quaternion());
    this.slashes.forEach((s, i) => {
      s.root.quaternion.copy(q);
      const alpha = THREE.MathUtils.degToRad((i % 2 === 0 ? -38 : -28) - i * 3);
      s.phi = alpha - Math.PI / 2;
      s.wrap.position.set(-SLASH_R * Math.cos(s.phi), -SLASH_R * Math.sin(s.phi), 0);
      const th0 = s.phi - SLASH_SWEEP / 2;
      s.a.mesh.rotation.z = th0;
      s.b.mesh.scale.x = -1;
      s.b.mesh.rotation.z = th0 + SLASH_SWEEP - Math.PI;
    });

    this.screen.silhouettes = [ctx.caster.group, ...ctx.targets.map((e) => e.group)];
    this.screen.focus.copy(this.centroid).setY(1.2);
  }

  play() {
    this.reset();
    this.playing = true;
  }

  private reset() {
    this.time = 0;
    this.severed = false;
    this.smokeDone = false;
    this.crossDone = this.pos.map(() => false);
    this.shake = 0;
    clearScreenFx(this.screen);
    this.smoke.clear();
    for (const e of this.emitters) e.clear();
    this.layout(0);
  }

  update(dt: number) {
    for (const e of this.emitters) e.update(dt);
    this.smoke.update(dt);
    if (!this.playing) return;
    this.time += dt;
    if (this.time >= this.duration) {
      if (this.settings.loop) { this.play(); return; }
      this.playing = false;
      clearScreenFx(this.screen);
    }
    for (let i = 0; i < this.n; i++) {
      if (!this.crossDone[i] && this.time >= this.tCross[i]) this.onCross(i);
    }
    if (!this.severed && this.time >= SEVER) this.onSever();
    if (!this.smokeDone && this.severed && this.time >= SEVER + 0.05) {
      this.smokeDone = true;
      for (const p of this.pos) {
        this.smoke.trigger(p.clone().addScaledVector(this.fwd, -0.8).setY(0.5), 0.75, 0.8);
      }
    }
    this.layout(dt);
  }

  /** Horizontal moon position at time t along the waypoints. */
  private moonXZ(t: number, out: THREE.Vector3) {
    const w = this.way;
    if (w.length === 0) return out.set(0, 0, 0);
    if (t <= w[0].t) return out.copy(w[0].p);
    for (let i = 1; i < w.length; i++) {
      if (t <= w[i].t) {
        const k = clamp01((t - w[i - 1].t) / Math.max(1e-4, w[i].t - w[i - 1].t));
        return out.lerpVectors(w[i - 1].p, w[i].p, i === 1 ? smoothstep(k) : k);
      }
    }
    return out.copy(w[w.length - 1].p);
  }

  /** World point on the moon's arc at fraction u of its sweep (needs matrices up to date). */
  private moonPoint(u: number, out: THREE.Vector3) {
    const a = u * MOON_SWEEP;
    out.set(Math.cos(a) * MOON_R, Math.sin(a) * MOON_R, 0);
    return this.moonLight.mesh.localToWorld(out);
  }

  private layout(dt: number) {
    const t = this.time;
    const D = SEVER;
    const after = t - D;
    const over = t >= DURATION;
    const n = this.n;
    const tLast = n > 0 ? this.tCross[n - 1] : CUT_START + CROSS_FIRST;

    // --- 1. World grade: dark violet, drained to monochrome with violet kept; colour returns after the sever. ---
    this.screen.darken = over ? 0 : t < D ? 0.8 * smoothstep(t / 0.5) : 0.8 * Math.exp(-Math.max(0, after - 0.15) * 2.2);
    this.screen.desaturate = over ? 0 : t < D + 1.2 ? 0.85 * smoothstep((t - 0.05) / 0.45) : 0.85 * (1 - smoothstep((t - (D + 1.2)) / 0.6));
    this.screen.impact = impactFrameAt(t, D, [2, 1, 2]);
    this.screen.chroma = chromaPulse(t, D, 0.8);
    this.screen.speedLines = t >= CUT_START && t < D ? 0.5 * smoothstep((t - CUT_START) / 0.2) : Math.max(0, 0.5 * (1 - Math.max(0, after) * 6));
    if (t < CUT_START) this.screen.speedLines = 0;

    // --- 2. Brush: a glint at the hand, ink drips climb out of it. ---
    const gl = t < BRUSH_END + 0.1 ? smoothstep(t / 0.4) : Math.max(0, 1 - (t - BRUSH_END - 0.1) / 0.2);
    this.glint.set(this.hand, 0.2 + 0.7 * gl, 0.8 * gl, t * 1.5);
    if (dt > 0 && t < BRUSH_END && Math.random() < 0.7) this.inkDrip.burst(1, this.hand);

    // --- 3. Ground cut path draws itself like a brush guide and fades last. ---
    const draw = smoothstep((t - 0.2) / 0.6) * this.pathLen;
    const lineFade = over ? 0 : 1 - smoothstep((t - (D + 0.6)) / 0.9);
    const lineOn = t > 0.2 ? lineFade : 0;
    this.lineLightMat.opacity = 0.4 * lineOn;
    this.lineDarkMat.opacity = 0.55 * lineOn;
    for (let i = 0; i < this.lineLight.length; i++) {
      const sg = this.segs[i];
      const k = sg ? clamp01((draw - sg.cum) / sg.len) : 0;
      const light = this.lineLight[i];
      const dark = this.lineDark[i];
      const show = !!sg && k > 0.001 && lineOn > 0.001;
      light.visible = show;
      dark.visible = show;
      if (!show || !sg) continue;
      const dx = sg.b.x - sg.a.x, dz = sg.b.z - sg.a.z;
      const mx = sg.a.x + dx * k * 0.5, mz = sg.a.z + dz * k * 0.5;
      const yaw = Math.atan2(-dz, dx);
      light.position.set(mx, 0.045, mz);
      dark.position.set(mx, 0.03, mz);
      light.rotation.y = yaw;
      dark.rotation.y = yaw;
      light.scale.set(Math.max(1e-4, sg.len * k), 1, 0.14);
      dark.scale.set(Math.max(1e-4, sg.len * k), 1, 0.8);
    }

    // --- 4. The moon: painted, held, then dives along the path and dissolves. ---
    const paint = clamp01((t - BRUSH_END) / (PAINT_END - BRUSH_END));
    const head = 1 - (1 - paint) * (1 - paint);
    const cutP = clamp01((t - CUT_START) / Math.max(1e-3, tLast - CUT_START));
    const cutE = cutP * cutP * (3 - 2 * cutP);
    const erosion = smoothstep((t - (D + 0.1)) / 1.2);
    const moonOn = t >= BRUSH_END && !over && erosion < 0.999;
    const op = moonOn ? 1 : 0;
    for (const arc of [this.moonLight, this.moonBody]) {
      arc.head = head;
      arc.length = 1;
      arc.time = t;
      arc.erosion = erosion;
      arc.opacity = op;
    }
    // Pale edge flashes magenta for a moment when the stroke completes.
    const rim = t >= PAINT_END ? Math.exp(-(t - PAINT_END) * 12) : 0;
    const lc = new THREE.Color(HOT).lerp(new THREE.Color(MAGENTA), rim);
    this.moonLight.edgeColor.copy(lc);
    this.moonLight.midColor.copy(lc);
    this.moonLight.outerColor.copy(lc);

    const discOp = over ? 0 : 0.85 * smoothstep((t - BRUSH_END) / 0.4) * (1 - smoothstep((t - (CUT_START + 0.05)) / 0.3));
    this.moonDiscMat.uniforms.uOpacity.value = discOp;
    this.moonDisc.visible = discOp > 0.002;

    const mp = new THREE.Vector3();
    this.moonXZ(t, mp);
    const tilt = THREE.MathUtils.degToRad(30 - 18 * cutE);
    facingQuat(this.fwd, tilt, this.moonQuat);
    this.moonRoot.quaternion.copy(this.moonQuat);
    const height = t < CUT_START ? MOON_HEIGHT + 0.12 * Math.sin(t * 3) : MOON_HEIGHT - 3.4 * cutE;
    this.moonRoot.position.set(mp.x, height, mp.z);
    const msc = 1 - 0.22 * cutE;
    this.moonRoot.scale.setScalar(msc);
    this.moonSpin.rotation.z = -(Math.PI / 3) * cutE;
    this.moonRoot.updateMatrixWorld(true);

    if (dt > 0) {
      // Brush tip splatter while painting.
      if (t >= BRUSH_END && t < PAINT_END) {
        const tip = this.moonPoint(head, new THREE.Vector3());
        this.inkSplat.burst(2, tip);
      }
      // Violet sparks crawl along the held edge.
      if (t >= PAINT_END && t < CUT_START) {
        this.edgeSparks.burst(2, this.moonPoint(Math.random(), new THREE.Vector3()));
      }
      // The moon crumbles into falling ink petals.
      if (t >= D + 0.1 && t < D + 1.3) {
        for (let k = 0; k < 3; k++) this.petals.burst(1, this.moonPoint(Math.random(), new THREE.Vector3()));
      }
    }

    // --- 5. Slashes: drawn as the moon crosses, split into halves at the sever. ---
    const slide = (a: number) => 1 - Math.pow(1 - clamp01(a / 0.4), 3);
    for (let i = 0; i < MAX; i++) {
      const s = this.slashes[i];
      const active = i < n;
      const age = active ? t - this.tCross[i] : -1;
      const on = active && age >= 0 && !over;
      s.star.set(new THREE.Vector3(), 0, 0);
      s.star2.set(new THREE.Vector3(), 0, 0);
      if (!active) { s.root.visible = false; continue; }
      const p = this.pos[i];
      s.root.position.set(p.x, 1.3, p.z);
      const dr = clamp01(age / 0.07);
      const sl = after > 0 ? slide(after) : 0;
      const er = after > 0 ? smoothstep((after - 0.08) / 0.7) : 0;
      const alpha = after > 0 ? 1 - smoothstep((after - 0.55) / 0.35) : 1;
      const o = on ? alpha : 0;
      for (const arc of [s.a, s.b]) {
        arc.head = dr;
        arc.length = 1;
        arc.time = t;
        arc.erosion = er;
        arc.opacity = o;
      }
      const tx = -Math.sin(s.phi), ty = Math.cos(s.phi);
      s.a.mesh.position.set(-tx * sl * 2.4, -ty * sl * 2.4, 0);
      s.b.mesh.position.set(tx * sl * 2.4, ty * sl * 2.4, 0);
      s.root.visible = on && o > 0.002;

      // Magenta accents: 2-3 frames at the crossing and again at the sever.
      const pop = StarBurst.pop(age, 0.0, 0.03);
      s.star.set(new THREE.Vector3(p.x, 1.3, p.z).addScaledVector(this.fwd, -0.4), 1.5 * pop.scale, pop.opacity, i * 0.7);
      const pop2 = StarBurst.pop(after, 0.0, 0.03);
      s.star2.set(new THREE.Vector3(p.x, 1.3, p.z).addScaledVector(this.fwd, -0.4), 2.2 * pop2.scale, pop2.opacity, i * 0.9);
    }

    this.shake = after > 0 ? 0.8 * Math.exp(-after * 7) : t >= CUT_START && t < D ? 0.05 : 0;
  }

  private onCross(i: number) {
    this.crossDone[i] = true;
    const p = this.pos[i];
    this.inkSplat.burst(8, new THREE.Vector3(p.x, 1.3, p.z));
    const e = this.enemies[i];
    const ctx = this.ctx;
    if (ctx && e) ctx.hit(e, { damage: 15, knock: 0, from: p.clone().addScaledVector(this.dirs[i], -1), color: '#d68cff' });
  }

  private onSever() {
    this.severed = true;
    const ctx = this.ctx;
    this.pos.forEach((p, i) => {
      const c = new THREE.Vector3(p.x, 1.2, p.z);
      // Small, short ink burst: a ring of black blobs and a violet spray.
      this.inkBurst.burst(14, c);
      this.spray.burst(34, c);
      const e = this.enemies[i];
      if (ctx && e) {
        const origin = p.clone().addScaledVector(this.dirs[i], -1).setY(0);
        ctx.hit(e, { damage: this.settings.damage, knock: 4, from: origin, color: '#ff3fa0' });
      }
    });
  }
}

export const inkMoonSeveranceModule: EffectModule = {
  label: 'ink moon severance',
  category: 'targeted',
  targeting: { mode: 'enemies', maxTargets: MAX },
  create: () => new InkMoonSeverance(),
  telegraphs(effect) {
    const e = effect as InkMoonSeverance;
    if (!e.ctx) return [];
    return e.ctx.targetPos.map((p) => ({
      shape: { kind: 'circle' as const, x: p.x, z: p.z, radius: 1.4 }, start: 0.5, impact: e.impactTime,
    }));
  },
  bloom: { enabled: true, strength: 0.5, radius: 0.5, threshold: 0.85 },
  frameCamera(camera, controls, effect) {
    const e = effect as InkMoonSeverance;
    if (e.ctx) frameCast(camera, controls, e.ctx, MOON_HEIGHT + MOON_R * 0.6);
  },
  buildGui(f, effect) {
    const s = (effect as InkMoonSeverance).settings;
    f.add(s, 'loop');
    f.add(s, 'damage', 1, 150, 1);
  },
};
