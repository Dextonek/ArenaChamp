import * as THREE from 'three';
import { Emitter } from '../../emitter';
import { smoothstep, type Enemy } from '../../effects/common';
import { ShockRefraction, StarBurst, clearScreenFx, createScreenFx, impactFrameAt } from '../../effects/parts';
import { AshMotes, Rift, Shards, VOID, VOID_CSS } from '../../effects/parts/void';
import { blocksSight } from '../../obstacles';
import type { TelegraphShape } from '../../effects/telegraph';
import { frameCast, type CastContext } from '../../effects/targeting';
import type { Effect, EffectModule } from '../../effects/types';
import { voidFx, watchCover } from '../../traits/void';

/**
 * Black Hole (void kit v5, R: a slow skillshot with a recast; label 'void black hole' because 'black hole' is the VFX tool's
 * old set piece). A black hole opens at his feet and crawls 8 m along the aim (`aim: 'line'`) at 2 m/s for 4 s. It is drawn as
 * a set piece: a 5 m ground field (a dark floor with streaks that flow inward and a pale ash edge ring with a cyan inner
 * line) that is the pull zone, a black sphere core over a 1 m pink core ring, two tilted accretion rings, a standing rift
 * through it, shards and ash streaming in. The line telegraph (the core's path, 2 m wide) shows from the cast; its impact is
 * 0.4 s, the wind-up he is rooted for, and the hole pulls and hurts from then on. Each frame it pulls every enemy within
 * 5 m of its live position toward it at 1.8 m/s (`ctx.carry`, live positions), unless cover stops it: an obstacle between the
 * hole and the enemy (`blocksSight` with `ctx.obstacles()`). Touching the core (centre within 1 m) deals 90 and stuns 1 s, once
 * per enemy (`projectile: true`), with one short impact frame. At 4 s it closes; clean by 4.7 s.
 * Recast, Collapse (the trait's free second cast; it opens 0.3 s late, replays nothing): it writes `voidFx.collapseAt`, which the
 * effect reads on both screens. The hole stops where it is, the pull stops (so the 0.5 s warning is true), a 3 m ring fills in
 * hot pink for 0.5 s, then everyone within 3 m of it on live positions takes 70 (`projectile: true`) with an impact frame, shards
 * and a ground ripple. The core still stuns during the warning. Clean 1.2 s after the collapse hit. A new cast clears the flag.
 */
export interface BlackHoleSettings {
  /** Core touch: damage and stun seconds. */
  coreDamage: number;
  stun: number;
  /** Collapse damage. */
  collapseDamage: number;
  loop: boolean;
}

export const defaultBlackHole = (): BlackHoleSettings => ({ coreDamage: 90, stun: 1, collapseDamage: 70, loop: false });

// Numbers.
const CRAWL_SPEED = 2;
const CRAWL_MAX = 8;
const LIFE = 4;
const PULL_R = 5;
const PULL_SPEED = 1.8;
const CORE_R = 1;
const COLLAPSE_R = 3;
const ARM_T = 0.4;
const WARN = 0.5;
const CLOSE_NATURAL = 0.5;
const CLOSE_COLLAPSE = 0.3;
const CORE_Y = 1.4;

const FIELD_VERTEX = /* glsl */ `
  varying vec2 vP;
  void main() {
    vP = position.xz;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }`;

const FIELD_FRAGMENT = /* glsl */ `
  uniform vec3 uPink, uCyan, uAsh; uniform float uK, uTime;
  varying vec2 vP;
  void main() {
    float r = length(vP);
    if (r > 1.0) discard;
    float ang = atan(vP.y, vP.x);
    vec3 col = vec3(0.0);
    float a = 0.5 * (1.0 - 0.45 * r);
    // Streaks that flow inward.
    float s = sin(ang * 2.0 + r * 13.0 + uTime * 3.5);
    float streak = smoothstep(0.8, 1.0, s) * (1.0 - 0.5 * r) * smoothstep(0.08, 0.3, r);
    col = mix(col, uPink, streak);
    a = max(a, streak * 0.75);
    // A cyan inner line, dashed, and the pale ash edge.
    float dash = 0.55 + 0.45 * step(0.0, sin(ang * 34.0 + uTime * 2.5));
    float inner = smoothstep(0.9, 0.915, r) * (1.0 - smoothstep(0.925, 0.945, r)) * dash;
    col = mix(col, uCyan, inner);
    a = max(a, inner * 0.8);
    float edge = smoothstep(0.955, 0.972, r);
    col = mix(col, uAsh, edge);
    a = max(a, edge * 0.95);
    gl_FragColor = vec4(col, a * uK);
  }`;

let haloTex: THREE.CanvasTexture | null = null;

/** A soft radial halo: dark in the middle, pink at the rim. */
function haloTexture(): THREE.CanvasTexture {
  if (haloTex) return haloTex;
  const S = 128, c = S / 2;
  const cv = document.createElement('canvas');
  cv.width = cv.height = S;
  const g = cv.getContext('2d');
  if (g) {
    const gr = g.createRadialGradient(c, c, c * 0.2, c, c, c);
    gr.addColorStop(0, 'rgba(0,0,0,0.9)');
    gr.addColorStop(0.45, 'rgba(0,0,0,0.55)');
    gr.addColorStop(0.7, 'rgba(255,42,85,0.35)');
    gr.addColorStop(1, 'rgba(255,42,85,0)');
    g.fillStyle = gr;
    g.fillRect(0, 0, S, S);
  }
  haloTex = new THREE.CanvasTexture(cv);
  haloTex.colorSpace = THREE.SRGBColorSpace;
  return haloTex;
}

export class BlackHole implements Effect {
  readonly group = new THREE.Group();
  readonly settings: BlackHoleSettings;
  readonly emitters: Emitter[] = [];
  readonly screen = createScreenFx();
  shake = 0;
  playing = false;

  /** Last cast; frameCamera and telegraphs read it. Null until the first play(). */
  ctx: CastContext | null = null;
  /** The core's path: from his feet 8 m along the aim, 2 m wide. */
  readonly path: Extract<TelegraphShape, { kind: 'line' }> = { kind: 'line', x1: 0, z1: 0, x2: 0, z2: 1, width: CORE_R * 2 };
  private time = 0;
  private startMs = 0;
  private endT = LIFE + CLOSE_NATURAL + 0.2;
  private moveT = 0;
  /** Seconds when Collapse was seen, -1 before. */
  private tc = -1;
  private boomed = false;
  private touchAt = -1;
  private boomAt = -1;
  private touched = new Set<Enemy>();
  private start = new THREE.Vector3();
  private dir = new THREE.Vector3(0, 0, 1);
  private face = new THREE.Vector3(0, 0, -1);
  private hole = new THREE.Vector3();
  private shardClock = 0;
  private moteClock = 0;

  private fieldMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3,
    uniforms: {
      uPink: { value: new THREE.Color(VOID.body) }, uCyan: { value: new THREE.Color(VOID.accent) }, uAsh: { value: new THREE.Color(VOID.ash) },
      uK: { value: 0 }, uTime: { value: 0 },
    },
    vertexShader: FIELD_VERTEX, fragmentShader: FIELD_FRAGMENT,
  });
  private field = new THREE.Mesh(new THREE.CircleGeometry(1, 72).rotateX(-Math.PI / 2), this.fieldMat);
  private coreMesh = new THREE.Mesh(new THREE.SphereGeometry(0.9, 28, 18), new THREE.MeshBasicMaterial({ color: VOID.dark }));
  private coreRingMat = new THREE.MeshBasicMaterial({ color: VOID.body, transparent: true, opacity: 0, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -6, polygonOffsetUnits: -6 });
  private coreRing = new THREE.Mesh(new THREE.RingGeometry(0.84, 1, 48).rotateX(-Math.PI / 2), this.coreRingMat);
  private diskA = new THREE.Mesh(new THREE.TorusGeometry(1.5, 0.09, 8, 56), new THREE.MeshBasicMaterial({ color: VOID.body, transparent: true }));
  private diskB = new THREE.Mesh(new THREE.TorusGeometry(1.95, 0.05, 8, 56), new THREE.MeshBasicMaterial({ color: VOID.accent, transparent: true }));
  private halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: haloTexture(), transparent: true, depthWrite: false }));
  private warnRingMat = new THREE.MeshBasicMaterial({ color: VOID.hot, transparent: true, opacity: 0, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -7, polygonOffsetUnits: -7 });
  private warnRing = new THREE.Mesh(new THREE.RingGeometry(0.93, 1, 64).rotateX(-Math.PI / 2), this.warnRingMat);
  private warnFillMat = new THREE.MeshBasicMaterial({ color: VOID.body, transparent: true, opacity: 0, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -6, polygonOffsetUnits: -6 });
  private warnFill = new THREE.Mesh(new THREE.CircleGeometry(1, 64).rotateX(-Math.PI / 2), this.warnFillMat);
  private rift = new Rift(2);
  private riftSlot = -1;
  private shards = new Shards(14);
  private motes = new AshMotes(40);
  private pop = new StarBurst({ points: 12, inner: 0.3, color: VOID.accent, core: VOID.core, additive: false });
  private touchPop = new StarBurst({ points: 8, inner: 0.3, color: VOID.hot, core: VOID.core, additive: false });
  private shock = new ShockRefraction({ facing: 'ground' });

  private v1 = new THREE.Vector3();
  private v2 = new THREE.Vector3();
  private v3 = new THREE.Vector3();

  constructor(settings: BlackHoleSettings = defaultBlackHole()) {
    this.settings = settings;
    this.screen.impactColor.set(VOID.hot);
    this.screen.tint.set(VOID.dark);
    this.field.renderOrder = 3;
    this.coreRing.renderOrder = 7;
    this.warnRing.renderOrder = 8;
    this.warnFill.renderOrder = 6;
    this.coreMesh.renderOrder = 9;
    this.halo.renderOrder = 8;
    this.halo.material.depthTest = false;
    this.diskA.rotation.x = Math.PI / 2 - 0.45;
    this.diskB.rotation.x = Math.PI / 2 + 0.6;
    this.group.add(
      this.field, this.warnFill, this.coreRing, this.warnRing, this.rift.mesh, this.shards.mesh, this.motes.mesh,
      this.halo, this.coreMesh, this.diskA, this.diskB, this.pop.mesh, this.touchPop.mesh, this.shock.mesh,
    );
    this.reset();
  }

  get duration() {
    return this.endT;
  }

  get impactTime() {
    return ARM_T;
  }

  cast(ctx: CastContext) {
    this.ctx = ctx;
    watchCover(ctx);
    this.start.copy(ctx.sentFrom ?? ctx.from).setY(0);
    this.v1.set(ctx.point.x - this.start.x, 0, ctx.point.z - this.start.z);
    if (this.v1.length() < 0.3) this.dir.set(Math.sin(ctx.aim), 0, Math.cos(ctx.aim));
    else this.dir.copy(this.v1).normalize();
    this.face.copy(this.dir).negate();
    this.path.x1 = this.start.x;
    this.path.z1 = this.start.z;
    this.path.x2 = this.start.x + this.dir.x * CRAWL_MAX;
    this.path.z2 = this.start.z + this.dir.z * CRAWL_MAX;
    this.hole.copy(this.start);
    this.screen.silhouettes = [ctx.caster.group, ...ctx.targets.map((e) => e.group)];
  }

  play() {
    this.reset();
    this.playing = true;
    this.startMs = performance.now();
    this.riftSlot = this.rift.openStanding(this.v1.set(0, 0.1, 0), 3.6, this.face, 0.9, 0.5, { seed: 5 });
  }

  private reset() {
    this.time = 0;
    this.moveT = 0;
    this.tc = -1;
    this.boomed = false;
    this.touchAt = this.boomAt = -1;
    this.endT = LIFE + CLOSE_NATURAL + 0.2;
    this.touched.clear();
    this.shardClock = this.moteClock = 0;
    this.shake = 0;
    this.hole.copy(this.start);
    clearScreenFx(this.screen);
    this.screen.tint.set(VOID.dark);
    this.fieldMat.uniforms.uK.value = 0;
    this.field.visible = this.coreMesh.visible = this.diskA.visible = this.diskB.visible = this.coreRing.visible = false;
    this.halo.visible = false;
    this.warnRingMat.opacity = this.warnFillMat.opacity = 0;
    this.rift.reset();
    this.riftSlot = -1;
    this.shards.reset();
    this.motes.reset();
    this.pop.set(this.hole, 0, 0);
    this.touchPop.set(this.hole, 0, 0);
    this.shock.set(this.hole, 0, 0);
  }

  update(dt: number) {
    for (const e of this.emitters) e.update(dt);
    if (!this.playing) return;
    this.rift.update(dt);
    this.shards.update(dt);
    this.motes.update(dt);
    this.time += dt;
    if (this.time >= this.endT) {
      const loop = this.settings.loop;
      this.reset();
      this.playing = false;
      if (loop) this.play();
      return;
    }
    const t = this.time, ctx = this.ctx;

    // Collapse: the recast flag (the trait writes it on his client and mirrors it on the other screen). Only while the hole lives.
    if (this.tc < 0 && ctx && t < LIFE && voidFx(ctx.caster).collapseAt >= this.startMs) {
      this.tc = t;
      this.endT = t + WARN + CLOSE_COLLAPSE + 0.6;
      this.rift.flicker = true;
      this.rift.flare(1, 0.3);
      this.shake = 0.15;
    }
    const collapsing = this.tc >= 0;
    const hitT = collapsing ? this.tc + WARN : -1;
    const closeAt = collapsing ? hitT : LIFE;
    const closeS = collapsing ? CLOSE_COLLAPSE : CLOSE_NATURAL;

    // It crawls until it stops (collapse) or ends.
    if (!collapsing && t < LIFE) this.moveT = t;
    else if (collapsing) this.moveT = Math.min(this.moveT, this.tc);
    const along = Math.min(CRAWL_MAX, CRAWL_SPEED * this.moveT);
    this.hole.set(this.start.x + this.dir.x * along, 0, this.start.z + this.dir.z * along);

    const pullOn = t >= ARM_T && t < LIFE && !collapsing;
    const coreOn = t >= ARM_T && t < (collapsing ? hitT : LIFE);

    if (ctx) {
      const foes = ctx.enemies?.() ?? ctx.targets;
      const obstacles = ctx.obstacles?.();
      for (const e of foes) {
        const p = e.group.position;
        const dx = this.hole.x - p.x, dz = this.hole.z - p.z;
        const d = Math.hypot(dx, dz);
        // The pull: on the live position, stopped by cover between the hole and the enemy.
        if (pullOn && d <= PULL_R && d > 1e-3 && !(obstacles && blocksSight(this.hole, p, obstacles))) {
          const step = Math.min(PULL_SPEED * dt, d);
          ctx.carry?.(e, this.v1.set((dx / d) * step, 0, (dz / d) * step));
        }
        // The core: once per enemy.
        if (coreOn && d <= CORE_R && !this.touched.has(e)) {
          this.touched.add(e);
          this.touchAt = t;
          this.shake = Math.max(this.shake, 0.3);
          ctx.hit(e, {
            damage: this.settings.coreDamage, knock: 0, color: VOID_CSS.body, status: { kind: 'stun', seconds: this.settings.stun }, projectile: true,
          });
        }
      }
      // The collapse: after the 0.5 s warning, everyone within 3 m of the hole now.
      if (collapsing && !this.boomed && t >= hitT) {
        this.boomed = true;
        this.boomAt = t;
        this.shake = 0.6;
        this.shards.burst(this.v2.set(this.hole.x, 1.2, this.hole.z), 12, 9, 0.5);
        for (const e of foes) {
          const p = e.group.position;
          if (Math.hypot(p.x - this.hole.x, p.z - this.hole.z) > COLLAPSE_R) continue;
          ctx.hit(e, { damage: this.settings.collapseDamage, knock: 0, color: VOID_CSS.body, projectile: true });
        }
      }
    }

    // Shards and ash stream in while it pulls.
    if (pullOn) {
      this.shardClock += dt;
      if (this.shardClock >= 0.2) {
        this.shardClock = 0;
        const a = Math.random() * Math.PI * 2;
        this.v2.set(this.hole.x + Math.cos(a) * (PULL_R - 0.6), 0.1, this.hole.z + Math.sin(a) * (PULL_R - 0.6));
        this.v3.set(this.hole.x, CORE_Y, this.hole.z);
        this.shards.drift(this.v2, this.v3, 2, 0.9, 0.3, 0.45);
      }
      this.moteClock += dt;
      if (this.moteClock >= 0.18) {
        this.moteClock = 0;
        const a = Math.random() * Math.PI * 2, r = 1.5 + Math.random() * (PULL_R - 2);
        this.motes.emit(this.v2.set(this.hole.x + Math.cos(a) * r, 0, this.hole.z + Math.sin(a) * r), 0.8, 2);
      }
    }

    this.layout(closeAt, closeS);
  }

  private layout(closeAt: number, closeS: number) {
    const t = this.time;
    const open = smoothstep(t / ARM_T);
    const close = 1 - smoothstep((t - closeAt) / closeS);
    const k = open * close;
    const h = this.hole;
    const collapsing = this.tc >= 0;

    // The pull field: a 5 m disc that opens with it.
    this.field.visible = k > 0.01;
    this.field.position.set(h.x, 0.03, h.z);
    this.field.scale.set(Math.max(PULL_R * k, 1e-4), 1, Math.max(PULL_R * k, 1e-4));
    this.fieldMat.uniforms.uK.value = collapsing ? 0.5 * k : k;
    this.fieldMat.uniforms.uTime.value = t;

    // The core: a black sphere, a 1 m pink ring on the ground, two tilted accretion rings, a dark halo.
    const jitter = collapsing && !this.boomed ? 0.04 * Math.sin(t * 60) : 0;
    const pulse = 1 + 0.05 * Math.sin(t * 5) + jitter;
    this.coreMesh.visible = this.diskA.visible = this.diskB.visible = this.coreRing.visible = k > 0.01;
    this.coreMesh.position.set(h.x, CORE_Y, h.z);
    this.coreMesh.scale.setScalar(Math.max(k * pulse, 1e-4));
    this.diskA.position.copy(this.coreMesh.position);
    this.diskB.position.copy(this.coreMesh.position);
    this.diskA.scale.setScalar(Math.max(k, 1e-4));
    this.diskB.scale.setScalar(Math.max(k, 1e-4));
    this.diskA.rotation.z = t * 2.2;
    this.diskB.rotation.z = -t * 1.5;
    (this.diskA.material as THREE.MeshBasicMaterial).opacity = k;
    (this.diskB.material as THREE.MeshBasicMaterial).opacity = 0.9 * k;
    this.coreRing.position.set(h.x, 0.05, h.z);
    this.coreRing.scale.set(Math.max(k * pulse, 1e-4), 1, Math.max(k * pulse, 1e-4));
    this.coreRingMat.opacity = 0.9 * k;
    this.halo.visible = k > 0.01;
    this.halo.position.set(h.x, CORE_Y, h.z);
    this.halo.scale.setScalar(Math.max(4.6 * k, 1e-4));
    this.halo.material.opacity = 0.85 * k;
    if (this.riftSlot >= 0) this.rift.place(this.riftSlot, this.v1.set(h.x, 0, h.z));
    if (close < 0.2 && this.riftSlot >= 0) {
      this.rift.close(0.15, this.riftSlot);
      this.riftSlot = -1;
    }

    // The collapse warning: a 3 m ring that fills for 0.5 s, so it can be read and left.
    if (collapsing) {
      const w = THREE.MathUtils.clamp((t - this.tc) / WARN, 0, 1);
      const live = !this.boomed;
      const fade = this.boomed ? 1 - smoothstep((t - this.boomAt) / 0.3) : 1;
      this.warnRing.position.set(h.x, 0.06, h.z);
      this.warnRing.scale.set(COLLAPSE_R, 1, COLLAPSE_R);
      this.warnRingMat.opacity = (live ? 0.7 + 0.3 * Math.sin(t * 40) : 1) * fade;
      this.warnFill.position.set(h.x, 0.05, h.z);
      this.warnFill.scale.set(COLLAPSE_R * w, 1, COLLAPSE_R * w);
      this.warnFillMat.opacity = (0.15 + 0.45 * w) * fade;
    }

    // Impact frames: one short frame at a core touch, one at the collapse.
    const touchFrame = this.touchAt >= 0 ? impactFrameAt(t, this.touchAt, [1], 0.04) : 0;
    const boomFrame = this.boomAt >= 0 ? impactFrameAt(t, this.boomAt, [1], 0.04) : 0;
    this.screen.impact = touchFrame || boomFrame;
    this.screen.darken = 0.25 * k * (this.boomed ? 1 - smoothstep((t - this.boomAt) / 0.5) : 1);

    // Stars and the ripple at the touch and at the collapse.
    if (this.touchAt >= 0) {
      const sp = StarBurst.pop(t - this.touchAt, 0, 0.05);
      this.touchPop.set(this.v1.set(h.x, CORE_Y, h.z), 1.3 * sp.scale, sp.opacity, 0.2);
    }
    if (this.boomAt >= 0) {
      const a = t - this.boomAt;
      const sp = StarBurst.pop(a, 0, 0.05);
      this.pop.set(this.v1.set(h.x, CORE_Y, h.z), 2 * sp.scale, sp.opacity, 0.2);
      const gp = smoothstep(a / 0.45);
      this.shock.set(this.v1.set(h.x, 0, h.z), 0.5 + (COLLAPSE_R + 0.6) * gp, 0.07 * (1 - gp) * (1 - gp));
      this.shake = Math.max(0.6 * Math.exp(-a * 8), 0);
    } else {
      this.shake *= Math.exp(-0.016 * 8);
    }
  }
}

export const blackHoleModule: EffectModule = {
  label: 'void black hole',
  category: 'hero: void',
  // The AI casts it when an enemy is within this of the aim point; the spell judges everything on live positions.
  targeting: { mode: 'ground', radius: PULL_R },
  create: () => new BlackHole(),
  telegraphs(effect) {
    const e = effect as BlackHole;
    if (!e.ctx) return [];
    return [{ shape: e.path, start: 0, impact: ARM_T, until: LIFE }];
  },
  bloom: { enabled: true, strength: 0.45, radius: 0.4, threshold: 0.86 },
  frameCamera(camera, controls, effect) {
    const e = effect as BlackHole;
    if (e.ctx) frameCast(camera, controls, e.ctx, 3);
  },
  buildGui(f, effect) {
    const s = (effect as BlackHole).settings;
    f.add(s, 'loop');
    f.add(s, 'coreDamage', 1, 300, 1);
    f.add(s, 'stun', 0.2, 1.2, 0.1);
    f.add(s, 'collapseDamage', 1, 200, 1);
  },
};
