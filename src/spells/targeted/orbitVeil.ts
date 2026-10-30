import * as THREE from 'three';
import { Emitter } from '../../emitter';
import { smoothstep } from '../../effects/common';
import { StarBurst, clearScreenFx, createScreenFx } from '../../effects/parts';
import {
  ASTRAL, ASTRAL_CSS, ConstellationLines, NightVeil, StarChart, StarPoints,
} from '../../effects/parts/astral';
import { frameCast, type CastContext } from '../../effects/targeting';
import type { Effect, EffectModule } from '../../effects/types';

/**
 * Orbit Veil (astral kit, E: backstep). A small star chart draws itself under Lyra and a night veil rises around
 * her. Seven stars orbit her on two tilted rings, linked by gold lines into a turning figure. Once (0.6 s) the figure
 * flares and fires a thin gold line from the nearest star to every enemy within 5 of where she stood (live
 * positions): a star-strike with a cyan pop that hurts and slows (1.0 s). At 0.65 s the orbit carries her 5 m straight
 * away from the enemy (`ctx.moveCaster`, 0.35 s) and the chart, veil and figure travel with her. Then the orbit breaks
 * and the stars fall. See pipeline/designs/kit-astral.md.
 */
export interface OrbitVeilSettings {
  damage: number;
  slow: number;
  loop: boolean;
}

export const defaultOrbitVeil = (): OrbitVeilSettings => ({ damage: 12, slow: 1, loop: false });

// Timeline (seconds).
const SETUP_END = 0.25;
const ORBIT_END = 1.9;
const STRIKE_T = [0.6];
const MOVE_T = 0.65; // the orbit carries her away
const MOVE_LEN = 0.35;
const BACKSTEP = 5;
const DURATION = 2.4;
const RADIUS = 5;
const CENTRE_Y = 1.3;
const NODES = 7;
const MAX_STRIKES = 8;
const EDGES: [number, number][] = [[0, 1], [1, 2], [2, 0], [3, 4], [4, 5], [5, 6], [6, 3], [0, 3], [1, 5], [2, 4]];

// Ring of each node: radius, tilt, angular speed (rad/s), start angle.
const RING_A = { r: 1.4, tilt: 0.75, w: 1.9, axis: new THREE.Vector3(1, 0, 0) };
const RING_B = { r: 2.0, tilt: -0.55, w: -1.3, axis: new THREE.Vector3(0.6, 0, 0.8).normalize() };

export class OrbitVeil implements Effect {
  readonly group = new THREE.Group();
  readonly settings: OrbitVeilSettings;
  readonly emitters: Emitter[] = [];
  readonly screen = createScreenFx();
  shake = 0;
  playing = false;

  /** Last cast; frameCamera and telegraphs read it. Null until the first play(). */
  ctx: CastContext | null = null;
  private time = 0;

  /** Where the chart and orbit are drawn: her feet, following her once the backstep starts. */
  private from = new THREE.Vector3(0, 0, 14);
  /** Where she cast from (the volley reaches RADIUS round it) and where she is carried to. */
  readonly start = new THREE.Vector3(0, 0, 14);
  private land = new THREE.Vector3();
  private moved = false;
  private centre = new THREE.Vector3(0, CENTRE_Y, 14);

  private flags = { start: false, volley: [false], strikeFade: [false], broke: false };
  private starIds: number[] = [];
  private lineIds: number[] = [];
  private nodePos: THREE.Vector3[] = [];
  private strikeCount = 0;
  private strikePts: THREE.Vector3[] = [];
  private lastVolley = -10;

  // Parts.
  private chart = new StarChart();
  private veil = new NightVeil();
  private stars = new StarPoints({ max: 16 });
  private figure = new ConstellationLines({ maxLines: 16 });
  private strikes = new ConstellationLines({ maxLines: 12 });
  private pops = Array.from({ length: MAX_STRIKES }, () => new StarBurst({ points: 10, inner: 0.3, color: ASTRAL.accent, core: ASTRAL.core, additive: false }));

  // Scratch.
  private v1 = new THREE.Vector3();

  constructor(settings: OrbitVeilSettings = defaultOrbitVeil()) {
    this.settings = settings;
    this.veil.strength = 0.4;
    for (let i = 0; i < NODES; i++) this.nodePos.push(new THREE.Vector3());
    for (let i = 0; i < MAX_STRIKES; i++) this.strikePts.push(new THREE.Vector3());
    this.chart.hole = 0.3;
    this.figure.widthScale = 1.6;
    this.strikes.widthScale = 1.6;
    this.group.add(
      this.veil.mesh, this.chart.mesh, this.figure.mesh, this.strikes.mesh, this.stars.mesh, ...this.pops.map((p) => p.mesh),
    );
    this.reset();
  }

  get duration() {
    return DURATION;
  }

  get impactTime() {
    return STRIKE_T[0];
  }

  cast(ctx: CastContext) {
    this.ctx = ctx;
    this.from.copy(ctx.from).setY(0);
    this.start.copy(this.from);
    // Away from the enemy (the nearest one in the ring); with none in the ring, away from where she faces.
    const e = ctx.targetPos[0] ?? ctx.point;
    this.v1.set(this.from.x - e.x, 0, this.from.z - e.z);
    if (this.v1.lengthSq() < 0.25) this.v1.set(-Math.sin(ctx.caster.group.rotation.y), 0, -Math.cos(ctx.caster.group.rotation.y));
    this.v1.normalize();
    this.land.copy(this.start).addScaledVector(this.v1, BACKSTEP);
    this.centre.copy(this.from).setY(CENTRE_Y);
    this.screen.focus.copy(this.centre);
    this.chart.set(this.from, 2);
    this.veil.set(this.from, 2.5, 2.7);
  }

  play() {
    this.reset();
    this.playing = true;
  }

  private reset() {
    this.time = 0;
    this.shake = 0;
    const f = this.flags;
    f.start = f.broke = false;
    f.volley = [false];
    f.strikeFade = [false];
    this.moved = false;
    this.from.copy(this.start);
    this.centre.copy(this.from).setY(CENTRE_Y);
    this.starIds.length = 0;
    this.lineIds.length = 0;
    this.strikeCount = 0;
    this.lastVolley = -10;
    clearScreenFx(this.screen);
    this.chart.reset();
    this.chart.hole = 0.3;
    this.veil.reset();
    if (this.ctx) this.veil.set(this.from, 2.5, 2.7);
    this.veil.opacity = 0;
    this.stars.reset();
    this.figure.reset();
    this.strikes.reset();
    for (const p of this.pops) p.set(this.centre, 0, 0);
  }

  /** Node i on its ring at time t. `grow` 0..1 spirals it out from the centre. */
  private nodeAt(i: number, t: number, grow: number, out: THREE.Vector3) {
    const ring = i < 3 ? RING_A : RING_B;
    const k = i < 3 ? i : i - 3, n = i < 3 ? 3 : 4;
    const a = (k / n) * Math.PI * 2 + ring.w * (t - SETUP_END) + (i < 3 ? 0.3 : 1.1);
    out.set(Math.cos(a) * ring.r * grow, 0, Math.sin(a) * ring.r * grow).applyAxisAngle(ring.axis, ring.tilt);
    return out.add(this.centre);
  }

  update(dt: number) {
    for (const e of this.emitters) e.update(dt);
    this.veil.update(dt);
    if (!this.playing) return;
    this.stars.update(dt);
    this.figure.update(dt);
    this.strikes.update(dt);
    this.time += dt;
    if (this.time >= DURATION) {
      const loop = this.settings.loop;
      this.reset();
      this.playing = false;
      this.shake = 0;
      if (loop) this.play();
      return;
    }
    const t = this.time;
    const f = this.flags;
    const ctx = this.ctx;

    // Events.
    if (!f.start && t >= SETUP_END) {
      f.start = true;
      for (let i = 0; i < NODES; i++) {
        this.nodeAt(i, SETUP_END, 0.3, this.nodePos[i]);
        this.starIds.push(this.stars.add(this.nodePos[i], i < 3 ? 0.24 : 0.3, i * 0.04));
      }
      EDGES.forEach(([a, b], k) => {
        this.lineIds.push(this.figure.connect(this.nodePos[a], this.nodePos[b], 0.15, 0.12 + k * 0.025));
      });
    }
    for (let v = 0; v < STRIKE_T.length; v++) {
      if (!f.volley[v] && t >= STRIKE_T[v]) {
        f.volley[v] = true;
        this.lastVolley = STRIKE_T[v];
        this.volley();
      }
      if (!f.strikeFade[v] && t >= STRIKE_T[v] + 0.23) {
        f.strikeFade[v] = true;
        this.strikes.fadeOut(0.12);
      }
    }
    if (!this.moved && t >= MOVE_T) {
      this.moved = true;
      if (ctx?.moveCaster) this.land.copy(ctx.moveCaster(this.land, MOVE_LEN)).setY(0);
    }
    if (this.moved) {
      const u = THREE.MathUtils.clamp((t - MOVE_T) / MOVE_LEN, 0, 1);
      this.from.lerpVectors(this.start, this.land, 1 - (1 - u) * (1 - u));
      this.centre.copy(this.from).setY(CENTRE_Y);
      this.chart.set(this.from, 2);
      this.veil.set(this.from, 2.5, 2.7);
      this.screen.focus.copy(this.centre);
    }
    if (!f.broke && t >= ORBIT_END) {
      f.broke = true;
      this.figure.snap(0.35);
      this.stars.fallAll(1, 0.35);
    }

    // The figure turns: the nodes move, the lines follow.
    if (f.start && !f.broke) {
      for (let i = 0; i < NODES; i++) {
        const grow = smoothstep((t - SETUP_END - i * 0.03) / 0.35);
        this.nodeAt(i, t, 0.3 + 0.7 * grow, this.nodePos[i]);
        this.stars.place(this.starIds[i], this.nodePos[i]);
      }
      EDGES.forEach(([a, b], k) => this.figure.move(this.lineIds[k], this.nodePos[a], this.nodePos[b]));
    }

    this.layout(ctx);
  }

  /** The figure fires a gold line from its nearest star into every enemy in range. */
  private volley() {
    const ctx = this.ctx;
    if (!ctx) return;
    // Re-check at the volley: only enemies still within reach of the spot she stood on are struck.
    const inside = ctx.targets.filter((e) => Math.hypot(e.group.position.x - this.start.x, e.group.position.z - this.start.z) <= RADIUS);
    this.strikeCount = Math.min(MAX_STRIKES, inside.length);
    for (let i = 0; i < this.strikeCount; i++) {
      const tp = inside[i].group.position;
      this.strikePts[i].set(tp.x, 1.1, tp.z);
      let best = 0, bd = 1e9;
      for (let k = 0; k < NODES; k++) {
        const d = this.nodePos[k].distanceToSquared(this.strikePts[i]);
        if (d < bd) { bd = d; best = k; }
      }
      this.strikes.connect(this.v1.copy(this.nodePos[best]), this.strikePts[i], 0.08, i * 0.015);
      ctx.hit(inside[i], { damage: this.settings.damage, knock: 1, color: ASTRAL_CSS.hot, status: { kind: 'slow', seconds: this.settings.slow } });
    }
    this.shake = 0.12;
  }

  private layout(_ctx: CastContext | null) {
    const t = this.time;

    // --- Chart under her and the night veil around her: in over the setup, out with the break. ---
    const out = 1 - smoothstep((t - ORBIT_END) / 0.4);
    this.chart.reveal = smoothstep(t / SETUP_END);
    this.chart.opacity = out;
    this.chart.spin = 0.35 * t;
    this.veil.opacity = smoothstep(t / SETUP_END) * out;

    // --- The figure flares at each volley: the stars swell for a moment. ---
    let flare = 0;
    for (const tv of STRIKE_T) if (t >= tv) flare = Math.max(flare, 1 - THREE.MathUtils.clamp((t - tv) / 0.2, 0, 1));
    if (this.flags.start && !this.flags.broke) {
      for (let i = 0; i < NODES; i++) this.stars.setSize(this.starIds[i], (i < 3 ? 0.24 : 0.3) * (1 + 0.3 * flare));
    }

    // --- Star-strike pops on the enemies (cyan, 2-3 frames). ---
    const age = t - this.lastVolley - 0.08;
    for (let i = 0; i < MAX_STRIKES; i++) {
      const sp = i < this.strikeCount ? StarBurst.pop(age - i * 0.015, 0.02, 0.04) : { scale: 0, opacity: 0 };
      this.pops[i].set(this.strikePts[i], 0.9 * sp.scale, sp.opacity, i);
    }
    this.shake *= 0.85;
  }
}

export const orbitVeilModule: EffectModule = {
  label: 'orbit veil',
  category: 'hero: astral',
  targeting: { mode: 'self', radius: RADIUS },
  create: () => new OrbitVeil(),
  telegraphs(effect) {
    const e = effect as OrbitVeil;
    if (!e.ctx) return [];
    return [{ shape: { kind: 'circle' as const, x: e.start.x, z: e.start.z, radius: RADIUS }, start: 0, impact: STRIKE_T[0] }];
  },
  bloom: { enabled: true, strength: 0.45, radius: 0.4, threshold: 0.86 },
  frameCamera(camera, controls, effect) {
    const e = effect as OrbitVeil;
    if (e.ctx) frameCast(camera, controls, e.ctx, 4);
  },
  buildGui(f, effect) {
    const s = (effect as OrbitVeil).settings;
    f.add(s, 'loop');
    f.add(s, 'damage', 1, 60, 1);
    f.add(s, 'slow', 0, 2.5, 0.1);
  },
};
