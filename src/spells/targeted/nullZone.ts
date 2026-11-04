import * as THREE from 'three';
import { Emitter } from '../../emitter';
import { smoothstep } from '../../effects/common';
import { ShockRefraction, StarBurst, clearScreenFx, createScreenFx } from '../../effects/parts';
import { AshMotes, Crackle, Shards, VOID, VOID_CSS } from '../../effects/parts/void';
import type { TelegraphShape } from '../../effects/telegraph';
import { frameCast, type CastContext } from '../../effects/targeting';
import type { Effect, EffectModule } from '../../effects/types';
import { watchCover } from '../../traits/void';

/**
 * Null Zone (void kit v5, W: a sphere on the spot). A 3 m sphere of void opens at his feet and stays FIXED where he cast it
 * for 3 s (it never follows him; the spot is `sentFrom`, the same on both screens). It is a dark sphere you can see through,
 * with a bright edge (pink to cyan by view angle, a fresnel shell), a pale ash rim on the ground over a dark floor disc and
 * glass cracks, ash rising inside. The circle telegraph shows from the cast (the real shape: a sphere judged on the ground
 * plane) and its impact is 0.2 s, so he is rooted only that long. No damage. Every 0.25 s from 0.25 s to 3.0 s each enemy
 * whose live position is inside the 3 m is silenced 0.3 s (`silence`, `projectile: true`, 0 damage): it cannot cast while
 * it stands inside, and the silence runs out 0.3 s after it steps out. Bolts that enter it vanish: eight short bolt walls
 * round the circle (`boltWall`, built from `sentFrom`) for 3 s, each block puffing shards and flaring the edge. The sphere
 * shrinks away at 3.0 s; clean by 3.5 s.
 */
export interface NullZoneSettings {
  /** Seconds of silence each tick gives. */
  silence: number;
  loop: boolean;
}

export const defaultNullZone = (): NullZoneSettings => ({ silence: 0.3, loop: false });

// Timeline (seconds).
const OPEN_T = 0.2;
const FIRST_TICK = 0.25;
const TICK_S = 0.25;
const END_T = 3.0;
const CLOSE_S = 0.35;
const DURATION = END_T + CLOSE_S + 0.15;
const RADIUS = 3;
const SEGMENTS = 8;

const SHELL_VERTEX = /* glsl */ `
  varying vec3 vN; varying vec3 vV;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vN = normalize(normalMatrix * normal);
    vV = normalize(-mv.xyz);
    gl_Position = projectionMatrix * mv;
  }`;

const SHELL_FRAGMENT = /* glsl */ `
  uniform vec3 uCyan, uPink, uHot; uniform float uAlpha, uFlare, uTime;
  varying vec3 vN; varying vec3 vV;
  void main() {
    float f = 1.0 - abs(dot(normalize(vN), normalize(vV)));
    float rim = pow(f, 2.6);
    float band = 0.5 + 0.5 * sin(vN.y * 9.0 + uTime * 2.0);
    vec3 edge = mix(uPink, uCyan, smoothstep(0.2, 0.9, 0.5 + 0.5 * vN.x));
    edge = mix(edge, uHot, rim * 0.5 + uFlare * 0.6);
    // A dark body you can see through; the bright edge on top.
    vec3 col = mix(vec3(0.0), edge, clamp(rim * 1.4 + uFlare * 0.5, 0.0, 1.0));
    float a = (0.2 + 0.1 * band * (1.0 - rim) + 0.75 * rim + 0.3 * uFlare) * uAlpha;
    gl_FragColor = vec4(col, clamp(a, 0.0, 1.0));
  }`;

export class NullZone implements Effect {
  readonly group = new THREE.Group();
  readonly settings: NullZoneSettings;
  readonly emitters: Emitter[] = [];
  readonly screen = createScreenFx();
  shake = 0;
  playing = false;

  /** Last cast; frameCamera and telegraphs read it. Null until the first play(). */
  ctx: CastContext | null = null;
  readonly circle: Extract<TelegraphShape, { kind: 'circle' }> = { kind: 'circle', x: 0, z: 0, radius: RADIUS };
  private time = 0;
  private flags = { open: false, closed: false };
  private nextTick = FIRST_TICK;
  private flare = 0;
  private center = new THREE.Vector3();

  private shellMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, side: THREE.DoubleSide,
    uniforms: {
      uCyan: { value: new THREE.Color(VOID.accent) }, uPink: { value: new THREE.Color(VOID.body) }, uHot: { value: new THREE.Color(VOID.hot) },
      uAlpha: { value: 0 }, uFlare: { value: 0 }, uTime: { value: 0 },
    },
    vertexShader: SHELL_VERTEX, fragmentShader: SHELL_FRAGMENT,
  });
  private shell = new THREE.Mesh(new THREE.SphereGeometry(1, 40, 24), this.shellMat);
  private floorMat = new THREE.MeshBasicMaterial({ color: VOID.dark, transparent: true, opacity: 0, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  private floor = new THREE.Mesh(new THREE.CircleGeometry(1, 48).rotateX(-Math.PI / 2), this.floorMat);
  private rimMat = new THREE.MeshBasicMaterial({ color: VOID.ash, transparent: true, opacity: 0, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -5, polygonOffsetUnits: -5 });
  private rim = new THREE.Mesh(new THREE.RingGeometry(0.955, 1, 64).rotateX(-Math.PI / 2), this.rimMat);
  private innerMat = new THREE.MeshBasicMaterial({ color: VOID.body, transparent: true, opacity: 0, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -6, polygonOffsetUnits: -6 });
  private inner = new THREE.Mesh(new THREE.RingGeometry(0.9, 0.93, 64).rotateX(-Math.PI / 2), this.innerMat);
  private crackle = new Crackle();
  private shards = new Shards(12);
  private motes = new AshMotes(40);
  private pop = new StarBurst({ points: 12, inner: 0.3, color: VOID.accent, core: VOID.core, additive: false });
  private shock = new ShockRefraction({ facing: 'ground' });

  private v1 = new THREE.Vector3();
  private v2 = new THREE.Vector3();

  constructor(settings: NullZoneSettings = defaultNullZone()) {
    this.settings = settings;
    this.screen.impactColor.set(VOID.hot);
    this.shell.renderOrder = 8;
    this.floor.position.y = 0.025;
    this.floor.renderOrder = 3;
    this.rim.position.y = 0.04;
    this.rim.renderOrder = 7;
    this.inner.position.y = 0.045;
    this.inner.renderOrder = 7;
    this.group.add(this.floor, this.crackle.mesh, this.rim, this.inner, this.shards.mesh, this.motes.mesh, this.shell, this.pop.mesh, this.shock.mesh);
    this.reset();
  }

  get duration() {
    return DURATION;
  }

  get impactTime() {
    return OPEN_T;
  }

  cast(ctx: CastContext) {
    this.ctx = ctx;
    watchCover(ctx);
    // Fixed where he cast it: from `sentFrom`, so both screens agree and a walking caster does not drag it.
    this.center.copy(ctx.sentFrom ?? ctx.from).setY(0);
    this.circle.x = this.center.x;
    this.circle.z = this.center.z;
    this.screen.silhouettes = [ctx.caster.group, ...ctx.targets.map((e) => e.group)];
    this.screen.focus.copy(this.center).setY(1.5);
  }

  play() {
    this.reset();
    this.playing = true;
    const ctx = this.ctx;
    if (!ctx?.boltWall) return;
    // Eight short segments round the circle: a bolt that crosses one vanishes.
    for (let i = 0; i < SEGMENTS; i++) {
      const a0 = (i / SEGMENTS) * Math.PI * 2, a1 = ((i + 1) / SEGMENTS) * Math.PI * 2;
      ctx.boltWall({
        a: new THREE.Vector3(this.center.x + Math.cos(a0) * RADIUS, 0, this.center.z + Math.sin(a0) * RADIUS),
        b: new THREE.Vector3(this.center.x + Math.cos(a1) * RADIUS, 0, this.center.z + Math.sin(a1) * RADIUS),
        halfWidth: 0.15,
        seconds: END_T,
        onBlock: (_bolt, at) => {
          this.flare = 1;
          this.shards.burst(this.v2.set(at.x, 0.6, at.z), 4, 3, 0.25);
        },
      });
    }
  }

  private reset() {
    this.time = 0;
    this.shake = 0;
    this.flags.open = this.flags.closed = false;
    this.nextTick = FIRST_TICK;
    this.flare = 0;
    clearScreenFx(this.screen);
    this.shell.visible = false;
    this.shellMat.uniforms.uAlpha.value = 0;
    this.floorMat.opacity = this.rimMat.opacity = this.innerMat.opacity = 0;
    this.crackle.reset();
    this.shards.reset();
    this.motes.reset();
    this.pop.set(this.center, 0, 0);
    this.shock.set(this.center, 0, 0);
  }

  update(dt: number) {
    for (const e of this.emitters) e.update(dt);
    if (!this.playing) return;
    this.crackle.update(dt);
    this.shards.update(dt);
    this.motes.update(dt);
    this.time += dt;
    if (this.time >= DURATION) {
      const loop = this.settings.loop;
      this.reset();
      this.playing = false;
      if (loop) this.play();
      return;
    }
    const t = this.time, ctx = this.ctx;
    const f = this.flags;

    if (!f.open) {
      f.open = true;
      this.crackle.width = 0.4;
      this.crackle.grow(this.center, RADIUS, 0.4);
      this.shake = 0.2;
    }
    if (!f.closed && t >= END_T) {
      f.closed = true;
      this.crackle.fade(0.5);
      this.shards.burst(this.v1.set(this.center.x, 0.8, this.center.z), 6, 4, 0.3);
    }

    // The silence ticks: every enemy inside the sphere now (live position) cannot cast.
    if (ctx) {
      while (this.nextTick <= Math.min(t, END_T)) {
        this.nextTick += TICK_S;
        for (const e of ctx.enemies?.() ?? ctx.targets) {
          const p = e.group.position;
          if (Math.hypot(p.x - this.center.x, p.z - this.center.z) > RADIUS) continue;
          ctx.hit(e, { damage: 0, knock: 0, color: VOID_CSS.accent, status: { kind: 'silence', seconds: this.settings.silence }, projectile: true });
        }
      }
    }

    // Ash rises inside while it stands.
    if (t > OPEN_T && t < END_T && Math.random() < dt * 10) {
      const a = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random()) * (RADIUS - 0.5);
      this.motes.emit(this.v1.set(this.center.x + Math.cos(a) * r, 0, this.center.z + Math.sin(a) * r), 0.5, 1);
    }

    // The sphere: opens over 0.25 s, holds, shrinks away at the end.
    const open = smoothstep(t / 0.25);
    const close = 1 - smoothstep((t - END_T) / CLOSE_S);
    const k = open * close;
    this.flare = Math.max(0, this.flare - dt * 3);
    this.shell.visible = k > 0.01;
    this.shell.position.set(this.center.x, 0, this.center.z);
    this.shell.scale.setScalar(Math.max(RADIUS * (0.2 + 0.8 * k), 1e-4));
    const u = this.shellMat.uniforms;
    u.uAlpha.value = k;
    u.uFlare.value = this.flare;
    u.uTime.value = t;
    for (const m of [this.floor, this.rim, this.inner]) {
      m.position.x = this.center.x;
      m.position.z = this.center.z;
      m.scale.set(Math.max(RADIUS * (0.3 + 0.7 * k), 1e-4), 1, Math.max(RADIUS * (0.3 + 0.7 * k), 1e-4));
    }
    this.floorMat.opacity = 0.55 * k;
    this.rimMat.opacity = 0.9 * k;
    this.innerMat.opacity = (0.5 + 0.2 * Math.sin(t * 6)) * k;

    // The opening: a small cyan star at his feet and a ground ripple.
    const sp = StarBurst.pop(t, 0, 0.05);
    this.pop.set(this.v1.set(this.center.x, 0.8, this.center.z), 1.0 * sp.scale, sp.opacity, 0.2);
    const gp = smoothstep(t / 0.4);
    this.shock.set(this.center, 0.5 + (RADIUS + 0.3) * gp, 0.05 * (1 - gp) * (1 - gp));
    this.shake = Math.max(this.shake * Math.exp(-dt * 8), 0);
  }
}

export const nullZoneModule: EffectModule = {
  label: 'null zone',
  category: 'hero: void',
  // The AI casts it when an enemy is inside this radius (the spell judges the sphere on live positions).
  targeting: { mode: 'self', radius: 3.5 },
  create: () => new NullZone(),
  telegraphs(effect) {
    const e = effect as NullZone;
    if (!e.ctx) return [];
    return [{ shape: e.circle, start: 0, impact: OPEN_T, until: END_T }];
  },
  bloom: { enabled: true, strength: 0.4, radius: 0.4, threshold: 0.86 },
  frameCamera(camera, controls, effect) {
    const e = effect as NullZone;
    if (e.ctx) frameCast(camera, controls, e.ctx, 3);
  },
  buildGui(f, effect) {
    const s = (effect as NullZone).settings;
    f.add(s, 'loop');
    f.add(s, 'silence', 0.1, 1, 0.05);
  },
};
