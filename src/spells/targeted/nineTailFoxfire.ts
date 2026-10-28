import * as THREE from 'three';
import { Emitter, defaultSettings } from '../../emitter';
import { smoothstep } from '../../effects/common';
import {
  CrescentArc, SmokeBall, StarBurst, chromaPulse, clearScreenFx, createScreenFx, impactFrameAt,
} from '../../effects/parts';
import { frameCast, type CastContext } from '../../effects/targeting';
import type { Effect, EffectModule } from '../../effects/types';

/**
 * Nine-Tail Foxfire (targeted, `enemies`, up to nine targets): nine fox tails (one hard-edged canvas silhouette
 * each, black outline, dark root, orange body, pink tip, cream point) fan open behind the caster. A teardrop
 * foxfire wisp lights on each tail tip, one after another, then leaves in order on a curved seeking arc to its
 * target (targets are cycled when there are fewer than nine). Each landing is a small flame pop and a light hit
 * and the wisp stays on the enemy. At D the tails flick shut and every wisp detonates at once (impact frame,
 * big hit); the tails then burn away from the tips inward while embers rise and small black smoke balls
 * hang on the targets.
 */
export interface NineTailFoxfireSettings {
  wispDamage: number;
  finalDamage: number;
  loop: boolean;
}

export const defaultNineTailFoxfire = (): NineTailFoxfireSettings => ({ wispDamage: 9, finalDamage: 25, loop: false });

const TAILS = 9;
const D = 2.5; // the flick and the combined detonation
const HIT2 = D + 0.1; // big hit lands just after the first impact frame
const DURATION = 4.2;
const TAIL_L = 4.6;
const TAIL_W = 2.3;
const FAN = (100 * Math.PI) / 180; // half of the 200 degree fan
const FIRE_PINK = 0xff4f8b;
const Z_AXIS = new THREE.Vector3(0, 0, 1);

const ignite = (i: number) => 0.6 + 0.06 * i;
const launch = (i: number) => 1.2 + 0.1 * i;
const FLIGHT = 0.4;
const land = (i: number) => launch(i) + FLIGHT;

/** One fox tail drawn on a canvas (256 x 512): root at the bottom centre, tip up. Hard edges, black outline. */
function tailTexture(): THREE.CanvasTexture {
  const cv = document.createElement('canvas');
  cv.width = 256;
  cv.height = 512;
  const g = cv.getContext('2d')!;
  g.lineJoin = 'round';
  g.lineCap = 'round';
  // Centre line: an S curve from the root (bottom) to the tip (top). Half width: narrow root, bushy middle, taper.
  const cx = (u: number) => 128 + 26 * Math.sin(u * Math.PI * 2) * (0.5 + 0.5 * u);
  const cy = (u: number) => 506 - 496 * u;
  const half = (u: number) => 8 + 50 * Math.pow(Math.sin(Math.PI * Math.pow(u, 0.75)), 0.8);
  const N = 72;
  const edge = (side: number, k: number) => {
    const u = k / N;
    const du = 0.004;
    const dx = cx(Math.min(1, u + du)) - cx(Math.max(0, u - du));
    const dy = cy(Math.min(1, u + du)) - cy(Math.max(0, u - du));
    const len = Math.hypot(dx, dy) || 1;
    // Fur tufts: a sawtooth that hooks toward the tip, offset between the two sides.
    const ph = (u * 10 + (side > 0 ? 0.5 : 0)) % 1;
    const tuft = 13 * ph * Math.sin(Math.PI * Math.min(1, u * 1.1)) * (u > 0.97 ? 0 : 1);
    const w = half(u) + tuft;
    return [cx(u) + (-dy / len) * w * side, cy(u) + (dx / len) * w * side];
  };
  const body = new Path2D();
  for (let k = 0; k <= N; k++) { const [x, y] = edge(1, k); if (k === 0) body.moveTo(x, y); else body.lineTo(x, y); }
  for (let k = N; k >= 0; k--) { const [x, y] = edge(-1, k); body.lineTo(x, y); }
  body.closePath();

  g.save();
  g.clip(body);
  g.fillStyle = '#ff6a1f'; // orange body
  g.fillRect(0, 0, 256, 512);
  // Furry bands: zigzag edges between the value steps.
  const band = (y: number, color: string, below: boolean) => {
    g.fillStyle = color;
    g.beginPath();
    g.moveTo(0, below ? 512 : 0);
    for (let k = 0; k <= 8; k++) g.lineTo(k * 32, y + (k % 2 ? -22 : 14));
    g.lineTo(256, below ? 512 : 0);
    g.closePath();
    g.fill();
  };
  band(400, '#b8300f', true); // darker red-orange root
  band(110, '#ffeccc', false); // cream-white tip
  // Hot streak along the S curve and dark fur lines.
  g.lineWidth = 9;
  g.strokeStyle = '#ffa43a';
  g.beginPath();
  for (let k = 8; k <= 56; k++) { const u = k / N; if (k === 8) g.moveTo(cx(u) - 8, cy(u)); else g.lineTo(cx(u) - 8, cy(u)); }
  g.stroke();
  g.lineWidth = 4;
  g.strokeStyle = '#7a1a08';
  for (const off of [-26, 22]) {
    g.beginPath();
    for (let k = 14; k <= 60; k += 2) { const u = k / N; if (k === 14) g.moveTo(cx(u) + off, cy(u)); else g.lineTo(cx(u) + off * (1 - u * 0.5), cy(u)); }
    g.stroke();
  }
  // Thin pink rim just inside the edge.
  g.lineWidth = 14;
  g.strokeStyle = '#ff4f8b';
  g.stroke(body);
  g.restore();
  g.lineWidth = 9;
  g.strokeStyle = '#000000';
  g.stroke(body);

  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** A foxfire teardrop (256 x 128), round head at +X, flame licks trailing to -X: a nested value ramp. */
function wispTexture(): THREE.CanvasTexture {
  const cv = document.createElement('canvas');
  cv.width = 256;
  cv.height = 128;
  const g = cv.getContext('2d')!;
  g.lineJoin = 'round';
  const shape = new Path2D();
  shape.moveTo(8, 66);
  shape.quadraticCurveTo(40, 52, 70, 32);
  shape.lineTo(58, 6);
  shape.quadraticCurveTo(110, 14, 165, 16);
  shape.bezierCurveTo(215, 14, 244, 36, 244, 66);
  shape.bezierCurveTo(244, 96, 215, 114, 165, 114);
  shape.bezierCurveTo(95, 116, 55, 80, 8, 66);
  shape.closePath();
  const layer = (scale: number, color: string, stroke?: string, w = 0) => {
    g.save();
    g.translate(170, 64);
    g.scale(scale, scale);
    g.translate(-170, -64);
    g.fillStyle = color;
    g.fill(shape);
    if (stroke) { g.lineWidth = w / scale; g.strokeStyle = stroke; g.stroke(shape); }
    g.restore();
  };
  layer(1, '#ff4f8b', '#000000', 9);
  layer(0.8, '#ff6a1f', '#3a0d0a', 3);
  layer(0.58, '#ffa43a');
  layer(0.2, '#ffd98a');
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** Tail material: the drawn texture eaten away from the tip inward by `uBurn`, with a charcoal band and ember edge. */
function tailMaterial(map: THREE.Texture): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, side: THREE.DoubleSide,
    uniforms: { uMap: { value: map }, uBurn: { value: 0 } },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
    `,
    fragmentShader: /* glsl */ `
      uniform sampler2D uMap;
      uniform float uBurn;
      varying vec2 vUv;
      float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
      float noise(vec2 p) {
        vec2 i = floor(p), f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
      }
      void main() {
        vec4 c = texture2D(uMap, vUv);
        if (c.a < 0.5) discard;
        float line = vUv.y - (1.08 - uBurn * 1.14 + (noise(vUv * vec2(9.0, 22.0)) - 0.5) * 0.08);
        if (line > 0.0) discard;
        if (line > -0.03) c.rgb = vec3(1.0, 0.15, 0.02);
        else if (line > -0.09) c.rgb *= 0.22;
        gl_FragColor = vec4(c.rgb, 1.0);
      }
    `,
  });
}

const easeOutBack = (x: number) => {
  const k = THREE.MathUtils.clamp(x, 0, 1) - 1;
  return 1 + 2.2 * k * k * k + 1.2 * k * k;
};

export class NineTailFoxfire implements Effect {
  readonly group = new THREE.Group();
  readonly settings: NineTailFoxfireSettings;
  readonly emitters: Emitter[] = [];
  readonly screen = createScreenFx();
  shake = 0;
  playing = false;
  ctx: CastContext | null = null;

  private time = 0;
  private landed: boolean[] = Array(TAILS).fill(false);
  private finalDone = false;
  private smokeDone = false;

  // Cast geometry.
  private fanPos = new THREE.Vector3();
  private centroid = new THREE.Vector3();
  private landPos: THREE.Vector3[] = Array.from({ length: TAILS }, () => new THREE.Vector3());
  private targetIdx: number[] = Array(TAILS).fill(0);
  private aimYaw = 0;

  // Tails.
  private rig = new THREE.Group();
  private tails: THREE.Mesh[] = [];
  private tailMats: THREE.ShaderMaterial[] = [];
  private tailLen = [0.88, 1.04, 0.8, 1.1, 0.94, 1.06, 0.84, 1.0, 0.9];
  private tailJit = [0.12, -0.14, 0.16, -0.06, 0.22, -0.16, 0.08, -0.12, 0.14];
  private tailOff = [-0.5, 0.3, -0.2, 0.45, 0, -0.35, 0.2, -0.45, 0.4];
  private tailScale: number[] = Array(TAILS).fill(1);
  private tailAngle: number[] = Array(TAILS).fill(0);

  // Wisps.
  private wisps: THREE.Mesh[] = [];
  private wispDir: THREE.Vector3[] = Array.from({ length: TAILS }, () => new THREE.Vector3(0, 1, 0));
  private launchPos: THREE.Vector3[] = Array.from({ length: TAILS }, () => new THREE.Vector3());

  // Pops.
  private popGroups: THREE.Group[] = [];
  private popArcs: CrescentArc[] = [];
  private popStars: StarBurst[] = [];
  private smoke = new SmokeBall({ maxBalls: TAILS });

  private trail: Emitter;
  private embers: Emitter;

  private tmpA = new THREE.Vector3();
  private tmpB = new THREE.Vector3();
  private tmpC = new THREE.Vector3();
  private ctrl = new THREE.Vector3();
  private tmpD = new THREE.Vector3();

  constructor(settings: NineTailFoxfireSettings = defaultNineTailFoxfire()) {
    this.settings = settings;
    this.screen.tint.set(0x3a0d0a);
    this.screen.impactColor.set(FIRE_PINK);
    this.screen.edgeTint.set(FIRE_PINK);

    // Tails: one rig that billboards to the camera, nine drawn tails pivoting at its origin.
    const tailTex = tailTexture();
    const tailGeo = new THREE.PlaneGeometry(TAIL_W, TAIL_L);
    tailGeo.translate(0, TAIL_L / 2, 0);
    const camQ = new THREE.Quaternion();
    const parentQ = new THREE.Quaternion();
    const faceRig = (_r: THREE.WebGLRenderer, _s: THREE.Scene, camera: THREE.Camera) => {
      this.rig.parent?.getWorldQuaternion(parentQ);
      camera.getWorldQuaternion(camQ);
      this.rig.quaternion.copy(parentQ.invert().multiply(camQ));
      this.rig.updateMatrixWorld(true);
    };
    for (let i = 0; i < TAILS; i++) {
      const mat = tailMaterial(tailTex);
      const mesh = new THREE.Mesh(tailGeo, mat);
      mesh.renderOrder = 5 + ((i * 4) % 9);
      mesh.frustumCulled = false;
      mesh.onBeforeRender = faceRig;
      this.rig.add(mesh);
      this.tails.push(mesh);
      this.tailMats.push(mat);
    }
    this.group.add(this.rig);

    // Wisps: a drawn teardrop that billboards and points along its travel direction.
    const wispTex = wispTexture();
    const wispGeo = new THREE.PlaneGeometry(1.7, 0.85);
    const dq = new THREE.Quaternion();
    for (let i = 0; i < TAILS; i++) {
      const mat = new THREE.MeshBasicMaterial({ map: wispTex, transparent: true, alphaTest: 0.5, depthWrite: false, side: THREE.DoubleSide });
      const mesh = new THREE.Mesh(wispGeo, mat);
      mesh.renderOrder = 20;
      mesh.frustumCulled = false;
      mesh.visible = false;
      mesh.onBeforeRender = (_r, _s, camera) => {
        this.group.getWorldQuaternion(parentQ);
        camera.getWorldQuaternion(camQ);
        const d = this.tmpC.copy(this.wispDir[i]).applyQuaternion(parentQ).applyQuaternion(dq.copy(camQ).invert());
        const ang = Math.hypot(d.x, d.y) > 1e-4 ? Math.atan2(d.y, d.x) : 0;
        mesh.quaternion.copy(parentQ.invert().multiply(camQ));
        mesh.rotateZ(ang);
        mesh.updateMatrixWorld(true);
      };
      this.wisps.push(mesh);
      this.group.add(mesh);
    }

    // Landing pops: a toon flame crescent facing the caster plus a crisp pink star.
    for (let i = 0; i < TAILS; i++) {
      const pg = new THREE.Group();
      const arc = new CrescentArc({ radius: 0.8, width: 0.55, style: 'toon', sweep: Math.PI * 1.5, edge: 0xffb07a, mid: 0xff6a1f, outer: 0x3a0d0a });
      arc.mesh.rotation.z = i * 1.3;
      pg.add(arc.mesh);
      const star = new StarBurst({ points: 8, inner: 0.3, color: FIRE_PINK, core: 0xff9a50, additive: false });
      star.mesh.renderOrder = 31;
      this.popGroups.push(pg);
      this.popArcs.push(arc);
      this.popStars.push(star);
      this.group.add(pg, star.mesh);
    }

    this.smoke.hold = 0.25;
    this.trail = new Emitter({
      ...defaultSettings(), maxParticles: 1200, rate: 0, lifetime: 0.5, lifetimeJitter: 0.4,
      shape: 'sphere', shapeSize: 0.12, speed: 0.5, speedJitter: 0.8, spread: 180, gravity: -1, drag: 2,
      sizeStart: 0.24, sizeEnd: 0.02, colorStart: '#ff9a3a', colorEnd: '#ff4f8b',
      opacityStart: 0.3, opacityEnd: 0, additive: true, colorMid: '#ff6a1f', sizeJitter: 0.4, erosion: 0.45, spin: 0.6,
    });
    this.embers = new Emitter({
      ...defaultSettings(), maxParticles: 900, rate: 0, lifetime: 1.6, lifetimeJitter: 0.5,
      shape: 'sphere', shapeSize: 0.25, speed: 1.2, speedJitter: 0.7, spread: 50, gravity: -1.6, drag: 0.8,
      sizeStart: 0.16, sizeEnd: 0, colorStart: '#ffc247', colorEnd: '#ff4f8b',
      opacityStart: 0.5, opacityEnd: 0, additive: true, colorMid: '#ff6a1f', sizeJitter: 0.5, erosion: 0.5, spin: 0.5,
    });
    this.emitters.push(this.trail, this.embers, this.smoke.emitter);
    for (const e of this.emitters) this.group.add(e.points);
    this.group.add(this.smoke.mesh);
    this.reset();
  }

  get duration() {
    return DURATION;
  }

  get impactTime() {
    return D;
  }

  cast(ctx: CastContext) {
    this.ctx = ctx;
    const fwd = new THREE.Vector3(Math.sin(ctx.aim), 0, Math.cos(ctx.aim));
    this.aimYaw = ctx.aim;
    // The fan sits a little ahead of the caster's back so the body hides the roots.
    this.fanPos.copy(ctx.from).addScaledVector(fwd, 0.7).setY(1.5);
    const pts = ctx.targetPos.length ? ctx.targetPos : [ctx.point];
    this.centroid.set(0, 0, 0);
    for (const p of pts) this.centroid.add(p);
    this.centroid.divideScalar(pts.length).setY(0);
    const right = new THREE.Vector3(-fwd.z, 0, fwd.x);
    for (let i = 0; i < TAILS; i++) {
      const j = i % pts.length;
      const lap = Math.floor(i / pts.length);
      this.targetIdx[i] = j;
      // Repeat visits to the same enemy land a little higher and to the side so the flames do not stack.
      this.landPos[i].copy(pts[j]).setY(1.0 + 0.3 * (lap % 3)).addScaledVector(right, lap === 0 ? 0 : (lap % 2 ? 0.45 : -0.45));
    }
    this.screen.silhouettes = [ctx.caster.group, ...ctx.targets.map((e) => e.group)];
    this.screen.focus.copy(this.centroid).setY(1.2);
  }

  play() {
    this.reset();
    this.playing = true;
  }

  private reset() {
    this.time = 0;
    this.finalDone = false;
    this.smokeDone = false;
    this.landed.fill(false);
    this.shake = 0;
    clearScreenFx(this.screen);
    this.smoke.clear();
    for (const e of this.emitters) e.clear();
    this.layout(0);
  }

  update(dt: number) {
    this.trail.update(dt);
    this.embers.update(dt);
    this.smoke.update(dt);
    if (!this.playing) return;
    this.time += dt;
    if (this.time >= DURATION) {
      if (this.settings.loop) { this.play(); return; }
      this.playing = false;
      clearScreenFx(this.screen);
    }
    for (let i = 0; i < TAILS; i++) if (!this.landed[i] && this.time >= land(i)) this.onLand(i);
    if (!this.finalDone && this.time >= HIT2) this.onFinal();
    if (!this.smokeDone && this.time >= D + 0.25) this.onSmoke();
    this.layout(dt);
  }

  /** Point at fraction f (0 root, 1 tip) along tail i, in group space. */
  private tailPoint(i: number, f: number, out: THREE.Vector3) {
    return out.set(0, TAIL_L * this.tailScale[i] * f, 0)
      .applyAxisAngle(Z_AXIS, this.tailAngle[i])
      .add(this.tmpD.set(this.tailOff[i], 0, 0))
      .applyQuaternion(this.rig.quaternion)
      .add(this.rig.position);
  }

  private layout(dt: number) {
    const t = this.time;
    const afterD = t - D;
    const live = t < DURATION;

    // --- World grade, speed lines into the flick, impact frame, chroma. ---
    this.screen.darken = t < D ? 0.6 * smoothstep(t / 0.5) : 0.6 * Math.exp(-Math.max(0, afterD - 0.1) * 2.2);
    this.screen.speedLines = t < D ? 0.55 * smoothstep((t - (D - 0.3)) / 0.3) : Math.max(0, 0.55 - afterD * 4);
    this.screen.impact = impactFrameAt(t, D, [1, 2]);
    this.screen.chroma = chromaPulse(t, HIT2, 0.7);

    // --- Tails: fan open with overshoot, sway, lift before the flick, snap shut at D, then burn from the tips. ---
    let open = easeOutBack(t / 0.6);
    if (t > D - 0.18) open *= 1 + 0.07 * smoothstep((t - (D - 0.18)) / 0.18);
    if (t >= D) open = 1.07 * (1 - 0.85 * smoothstep(afterD / 0.08));
    const grow = Math.max(0.02, smoothstep(t / 0.45));
    this.rig.position.copy(this.fanPos);
    for (let i = 0; i < TAILS; i++) {
      this.tailScale[i] = this.tailLen[i] * grow;
      this.tailAngle[i] = (((i - 4) / 4) * FAN * 0.85 + this.tailJit[i]) * open + Math.sin(t * 2.2 + i * 0.7) * 0.05 * Math.min(1, open);
      const m = this.tails[i];
      m.rotation.z = this.tailAngle[i];
      m.position.x = this.tailOff[i];
      m.scale.set((i % 2 ? -1 : 1) * this.tailScale[i], this.tailScale[i], this.tailScale[i]);
      const burn = smoothstep((t - (D + 0.15 + 0.05 * Math.abs(i - 4))) / 1.0);
      this.tailMats[i].uniforms.uBurn.value = burn;
      m.visible = live && burn < 0.995;
      if (dt > 0 && burn > 0.03 && burn < 0.97 && Math.random() < 0.6) {
        this.embers.burst(1, this.tailPoint(i, Math.max(0, 1.05 - burn * 1.14), this.tmpA));
      }
    }

    // --- Wisps: ignite on the tips, leave in order on seeking arcs, sit on the target until D. ---
    for (let i = 0; i < TAILS; i++) {
      const w = this.wisps[i];
      const t0 = ignite(i), tl = launch(i), tn = land(i);
      if (!live || t < t0 || t >= D + 0.05) { w.visible = false; continue; }
      w.visible = true;
      const flick = 1 + 0.08 * Math.sin(t * 40 + i * 2);
      const p = this.tmpA;
      let size: number;
      if (t < tl) {
        // Lit on the tail tip, pointing outward along the tail.
        this.tailPoint(i, 1.02, p);
        this.tailPoint(i, 0.9, this.tmpB);
        this.wispDir[i].copy(p).sub(this.tmpB);
        if (this.wispDir[i].lengthSq() < 1e-8) this.wispDir[i].set(0, 1, 0);
        this.wispDir[i].normalize();
        p.addScaledVector(this.wispDir[i], 0.35);
        this.launchPos[i].copy(p);
        size = 0.85 * easeOutBack((t - t0) / 0.25);
      } else if (t < tn) {
        const u = (t - tl) / FLIGHT;
        const ue = Math.pow(u, 1.4);
        const a = this.launchPos[i], b = this.landPos[i];
        const d = this.tmpB.copy(b).sub(a);
        const dist = Math.max(d.length(), 1e-3);
        // Sideways bulge (alternating sides) plus a lift: a curved hunt, not a line.
        const side = this.tmpC.set(-d.z, 0, d.x);
        if (side.lengthSq() < 1e-8) side.set(1, 0, 0);
        side.normalize().multiplyScalar((i % 2 ? 1 : -1) * dist * (0.3 + 0.03 * i));
        const c = this.ctrl.copy(a).add(b).multiplyScalar(0.5).add(side);
        c.y += 1.5 + 0.12 * dist;
        const k = 1 - ue;
        p.set(
          k * k * a.x + 2 * k * ue * c.x + ue * ue * b.x,
          k * k * a.y + 2 * k * ue * c.y + ue * ue * b.y,
          k * k * a.z + 2 * k * ue * c.z + ue * ue * b.z,
        );
        this.wispDir[i].set(
          2 * k * (c.x - a.x) + 2 * ue * (b.x - c.x),
          2 * k * (c.y - a.y) + 2 * ue * (b.y - c.y),
          2 * k * (c.z - a.z) + 2 * ue * (b.z - c.z),
        );
        if (this.wispDir[i].lengthSq() < 1e-8) this.wispDir[i].copy(d);
        this.wispDir[i].normalize();
        size = 1;
        if (dt > 0) this.trail.burst(3, p);
      } else {
        // Landed: a standing flame on the enemy, flame licks up.
        p.copy(this.landPos[i]);
        this.wispDir[i].set(0, -1, 0);
        size = 0.8;
      }
      w.position.copy(p);
      w.scale.setScalar(Math.max(1e-3, size * flick));
    }

    // --- Pops: small on each landing, large together after the flick. ---
    const big = t >= HIT2;
    for (let i = 0; i < TAILS; i++) {
      const age = big ? t - HIT2 - i * 0.012 : t - land(i);
      const sz = big ? 1.9 : 1;
      const pg = this.popGroups[i];
      pg.position.copy(this.landPos[i]);
      pg.rotation.set(-0.25, this.aimYaw + Math.PI, 0);
      pg.scale.setScalar(sz);
      const arc = this.popArcs[i];
      arc.head = THREE.MathUtils.clamp(age / 0.28, 0, 1) * 1.3;
      arc.length = 0.55;
      arc.time = t;
      arc.opacity = age >= 0 && age < 0.42 ? 1 : 0;
      const pop = StarBurst.pop(age);
      if (pop.opacity === 0 || !live) this.popStars[i].set(this.tmpA.set(0, 0, 0), 0, 0);
      else this.popStars[i].set(this.tmpA.copy(this.landPos[i]), (big ? 3.4 : 1.7) * pop.scale, pop.opacity, i * 0.7);
    }

    // --- Shake: a tick per landing, one heavy hit at the detonation. ---
    let sh = 0;
    for (let i = 0; i < TAILS; i++) { const a = t - land(i); if (a >= 0) sh = Math.max(sh, 0.1 * Math.exp(-a * 14)); }
    if (t >= HIT2) sh = Math.max(sh, 0.7 * Math.exp(-(t - HIT2) * 7));
    this.shake = sh;
  }

  private onLand(i: number) {
    this.landed[i] = true;
    const ctx = this.ctx;
    const e = ctx?.targets[this.targetIdx[i]];
    if (!ctx || !e) return;
    this.trail.burst(8, this.landPos[i]);
    ctx.hit(e, { damage: this.settings.wispDamage, knock: 1, from: this.launchPos[i], color: '#ff9ac0' });
  }

  private onFinal() {
    this.finalDone = true;
    const ctx = this.ctx;
    for (let i = 0; i < TAILS; i++) this.trail.burst(12, this.landPos[i]);
    if (!ctx) return;
    ctx.targets.forEach((e) => {
      ctx.hit(e, { damage: this.settings.finalDamage, knock: 4, from: this.centroid, color: '#ff4f8b' });
    });
  }

  private onSmoke() {
    this.smokeDone = true;
    const pts = this.ctx?.targetPos ?? [];
    for (const p of pts) this.smoke.trigger(this.tmpA.copy(p).setY(1), 1.1, 0.7);
  }
}

export const nineTailFoxfireModule: EffectModule = {
  label: 'nine tail foxfire',
  category: 'targeted',
  targeting: { mode: 'enemies', maxTargets: 9 },
  create: () => new NineTailFoxfire(),
  telegraphs(effect) {
    const e = effect as NineTailFoxfire;
    return (e.ctx?.targetPos ?? []).map((p) => ({
      shape: { kind: 'circle' as const, x: p.x, z: p.z, radius: 1.3 }, start: 1.2, impact: D,
    }));
  },
  bloom: { enabled: true, strength: 0.6, radius: 0.5, threshold: 0.82 },
  frameCamera(camera, controls, effect) {
    const e = effect as NineTailFoxfire;
    if (e.ctx) frameCast(camera, controls, e.ctx, 6);
  },
  buildGui(f, effect) {
    const s = (effect as NineTailFoxfire).settings;
    f.add(s, 'loop');
    f.add(s, 'wispDamage', 1, 60, 1).name('wisp damage');
    f.add(s, 'finalDamage', 1, 150, 1).name('final damage');
  },
};
