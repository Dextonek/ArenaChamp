import * as THREE from 'three';
import { Emitter } from '../../emitter';
import { smoothstep } from '../../effects/common';
import { ShockRefraction, StarBurst, clearScreenFx, createScreenFx } from '../../effects/parts';
import {
  ASTRAL, ASTRAL_CSS, ConstellationLines, NightVeil, StarArrow, StarChart, StarPoints,
} from '../../effects/parts/astral';
import { frameCast, type CastContext } from '../../effects/targeting';
import type { Effect, EffectModule } from '../../effects/types';

/**
 * Constellation Snare (astral kit, W: zone). Lyra fires an arrow into the sky; a parchment star chart draws itself
 * around the target point over a dark night veil and a handful of stars streak down onto points around and across
 * the circle (the enemies among them). Gold lines draw between them into a triangulated net. Then the net snaps tight
 * toward the centre and drags the enemies in; a moment later it breaks apart and the stars fall. See
 * pipeline/designs/kit-astral.md.
 */
export interface ConstellationSnareSettings {
  damage: number;
  loop: boolean;
}

export const defaultConstellationSnare = (): ConstellationSnareSettings => ({ damage: 50, loop: false });

// Timeline (seconds).
const SHOT_T = 0.2; // arrow is gone, chart and stars begin
const CHART_END = 0.6;
const NET_T = 0.6; // lines start drawing
const HIT_T = 0.8; // the net snaps tight
const PULL_DUR = 0.12;
const BREAK_T = 1.4;
const DURATION = 2.1;
const RADIUS = 4;
const STARS = 8;
const NET_Y = 0.4;
const PULL = 0.5; // fraction of the way to the centre the net and the enemies are pulled

const cross2 = (ax: number, az: number, bx: number, bz: number) => ax * bz - az * bx;

/** True when segments p1-p2 and p3-p4 cross properly (shared endpoints do not count). */
function crosses(p1: THREE.Vector3, p2: THREE.Vector3, p3: THREE.Vector3, p4: THREE.Vector3) {
  const d1 = cross2(p4.x - p3.x, p4.z - p3.z, p1.x - p3.x, p1.z - p3.z);
  const d2 = cross2(p4.x - p3.x, p4.z - p3.z, p2.x - p3.x, p2.z - p3.z);
  const d3 = cross2(p2.x - p1.x, p2.z - p1.z, p3.x - p1.x, p3.z - p1.z);
  const d4 = cross2(p2.x - p1.x, p2.z - p1.z, p4.x - p1.x, p4.z - p1.z);
  return d1 * d2 < -1e-6 && d3 * d4 < -1e-6;
}

export class ConstellationSnare implements Effect {
  readonly group = new THREE.Group();
  readonly settings: ConstellationSnareSettings;
  readonly emitters: Emitter[] = [];
  readonly screen = createScreenFx();
  shake = 0;
  playing = false;

  /** Last cast; frameCamera and telegraphs read it. Null until the first play(). */
  ctx: CastContext | null = null;
  private time = 0;

  // Cast geometry, computed in cast().
  private from = new THREE.Vector3(0, 0, 14);
  private fwd = new THREE.Vector3(0, 0, -1);
  private hand = new THREE.Vector3(0, 1.4, 13);
  private sky = new THREE.Vector3(0, 9, 10);
  private centre = new THREE.Vector3(0, 0, -6);
  private base: THREE.Vector3[] = [];
  private cur: THREE.Vector3[] = [];
  private sizes: number[] = [];
  private landT: number[] = [];
  private edges: [number, number][] = [];

  private flags = { arrow: false, stars: false, net: false, hit: false, broke: false };
  private starIds: number[] = [];
  private lineIds: number[] = [];

  // Parts.
  private arrow = new StarArrow();
  private chart = new StarChart();
  private veil = new NightVeil();
  private stars = new StarPoints({ max: 16 });
  private lines = new ConstellationLines({ maxLines: 24 });
  private pops = Array.from({ length: STARS }, () => new StarBurst({ points: 4, inner: 0.2, jitter: 0, color: ASTRAL.hot, core: ASTRAL.core, additive: false }));
  private hitStar = new StarBurst({ points: 10, inner: 0.3, color: ASTRAL.accent, core: ASTRAL.core, additive: false });
  private groundShock = new ShockRefraction({ facing: 'ground' });

  // Scratch.
  private v1 = new THREE.Vector3();
  private v2 = new THREE.Vector3();

  constructor(settings: ConstellationSnareSettings = defaultConstellationSnare()) {
    this.settings = settings;
    for (let i = 0; i < STARS; i++) {
      this.base.push(new THREE.Vector3());
      this.cur.push(new THREE.Vector3());
      this.sizes.push(0.5);
      this.landT.push(0.35 + i * 0.035);
    }
    this.chart.hole = 0.3;
    this.lines.widthScale = 2;
    this.group.add(
      this.veil.mesh, this.chart.mesh, this.arrow.mesh, this.lines.mesh, this.stars.mesh, ...this.pops.map((p) => p.mesh),
      this.hitStar.mesh, this.groundShock.mesh,
    );
    this.reset();
  }

  get duration() {
    return DURATION;
  }

  get impactTime() {
    return HIT_T;
  }

  cast(ctx: CastContext) {
    this.ctx = ctx;
    this.from.copy(ctx.from);
    this.centre.copy(ctx.point).setY(0);
    this.fwd.set(Math.sin(ctx.aim), 0, Math.cos(ctx.aim));
    this.hand.copy(ctx.from).addScaledVector(this.fwd, 0.55).setY(1.4);
    this.sky.copy(this.hand).addScaledVector(this.fwd, 1.5).setY(10);

    // Star positions: the nearest few enemies first, then a Vogel spiral fills the circle between them.
    let n = 0;
    for (let i = 0; i < ctx.targetPos.length && n < 4; i++) {
      const p = ctx.targetPos[i];
      if (Math.hypot(p.x - this.centre.x, p.z - this.centre.z) > RADIUS - 0.2) continue;
      this.base[n++].set(p.x, NET_Y, p.z);
    }
    for (let k = 0; n < STARS && k < 60; k++) {
      const r = (RADIUS - 0.5) * Math.sqrt((k + 0.6) / 14), a = k * 2.39996 + 0.7;
      const x = this.centre.x + Math.cos(a) * r, z = this.centre.z + Math.sin(a) * r;
      let ok = true;
      for (let j = 0; j < n; j++) if (Math.hypot(x - this.base[j].x, z - this.base[j].z) < 1.3) { ok = false; break; }
      if (ok) this.base[n++].set(x, NET_Y, z);
    }
    for (; n < STARS; n++) this.base[n].set(this.centre.x + n, NET_Y, this.centre.z); // never happens in practice
    for (let i = 0; i < STARS; i++) { this.cur[i].copy(this.base[i]); this.sizes[i] = 0.27 + 0.2 * ((i * 5) % 4) / 3; }

    // Greedy triangulation: shortest edges first, none may cross an accepted one.
    const pairs: [number, number, number][] = [];
    for (let i = 0; i < STARS; i++) for (let j = i + 1; j < STARS; j++) pairs.push([i, j, this.base[i].distanceTo(this.base[j])]);
    pairs.sort((a, b) => a[2] - b[2]);
    this.edges.length = 0;
    for (const [i, j, d] of pairs) {
      if (d > 5.2 || this.edges.length >= 20) continue;
      let ok = true;
      for (const [a, b] of this.edges) {
        if (a === i || a === j || b === i || b === j) continue;
        if (crosses(this.base[i], this.base[j], this.base[a], this.base[b])) { ok = false; break; }
      }
      if (ok) this.edges.push([i, j]);
    }

    this.screen.focus.copy(this.centre);
    this.chart.set(this.centre, RADIUS);
    this.veil.set(this.centre, RADIUS + 0.3, 0);
    this.groundShock.set(this.centre, 0, 0);
  }

  play() {
    this.reset();
    this.playing = true;
  }

  private reset() {
    this.time = 0;
    this.shake = 0;
    const f = this.flags;
    f.arrow = f.stars = f.net = f.hit = f.broke = false;
    this.starIds.length = 0;
    this.lineIds.length = 0;
    clearScreenFx(this.screen);
    this.arrow.reset();
    this.chart.reset();
    this.chart.hole = 0.3;
    this.veil.reset();
    if (this.ctx) this.veil.set(this.centre, RADIUS + 0.3, 0);
    this.veil.opacity = 0;
    this.stars.reset();
    this.lines.reset();
    for (let i = 0; i < STARS; i++) { this.cur[i].copy(this.base[i]); this.pops[i].set(this.centre, 0, 0); }
    this.hitStar.set(this.centre, 0, 0);
    this.groundShock.set(this.centre, 0, 0);
    if (this.ctx) for (const e of this.ctx.targets) this.ctx.displace(e, this.v1.set(0, 0, 0));
  }

  update(dt: number) {
    for (const e of this.emitters) e.update(dt);
    this.veil.update(dt);
    if (!this.playing) return;
    this.stars.update(dt);
    this.lines.update(dt);
    this.arrow.update(dt);
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
    if (!f.arrow) {
      f.arrow = true;
      this.arrow.fly(this.hand, this.sky, SHOT_T);
    }
    if (!f.stars && t >= SHOT_T) {
      f.stars = true;
      for (let i = 0; i < STARS; i++) {
        this.starIds.push(this.stars.drop(this.base[i], this.sizes[i], 9, 0.15, Math.max(0, this.landT[i] - 0.15 - t)));
      }
    }
    if (!f.net && t >= NET_T) {
      f.net = true;
      this.edges.forEach(([a, b], k) => {
        this.lineIds.push(this.lines.connect(this.base[a], this.base[b], 0.1, (k / this.edges.length) * 0.1));
      });
    }
    if (!f.hit && t >= HIT_T) {
      f.hit = true;
      this.shake = 0.3;
      if (ctx) for (const e of ctx.targets) ctx.hit(e, { damage: this.settings.damage, knock: 0, color: ASTRAL_CSS.hot });
    }
    if (!f.broke && t >= BREAK_T) {
      f.broke = true;
      this.lines.snap(0.55);
      this.stars.fallAll(1, 0.5);
    }

    this.layout();
  }

  private layout() {
    const t = this.time;
    const f = this.flags;
    const ctx = this.ctx;
    const after = t - HIT_T;

    // --- Chart draws on while the stars fall; the night veil dims the ground under the gold. ---
    this.chart.reveal = smoothstep((t - SHOT_T) / (CHART_END - SHOT_T));
    this.chart.opacity = 1 - smoothstep((t - BREAK_T) / 0.5);
    this.chart.spin = -0.25 * t;
    this.veil.opacity = smoothstep((t - 0.3) / 0.3) * (1 - smoothstep((t - BREAK_T) / 0.5));

    // --- Landing pops. ---
    for (let i = 0; i < STARS; i++) {
      const sp = StarBurst.pop(t - this.landT[i], 0.01, 0.04);
      this.pops[i].set(this.v1.copy(this.base[i]).setY(0.5), 0.5 * sp.scale, sp.opacity, i);
    }

    // --- The net snaps tight toward the centre (stars and lines together), holds, then breaks. ---
    let pull = 0;
    if (f.hit && t < BREAK_T) pull = 1 - Math.pow(1 - Math.min(1, after / PULL_DUR), 3);
    if (pull > 0) {
      for (let i = 0; i < STARS; i++) {
        this.cur[i].lerpVectors(this.base[i], this.centre, PULL * pull).setY(NET_Y + 0.15 * pull);
        if (this.starIds[i] !== undefined) this.stars.place(this.starIds[i], this.cur[i]);
      }
      this.edges.forEach(([a, b], k) => {
        if (this.lineIds[k] >= 0) this.lines.move(this.lineIds[k], this.cur[a], this.cur[b]);
      });
    }

    // --- Enemies are dragged in with the net and let go when it breaks. ---
    if (ctx && f.hit) {
      const release = smoothstep((t - BREAK_T) / 0.25);
      const k = pull * (1 - release);
      if (t < BREAK_T + 0.3) {
        ctx.targets.forEach((e, i) => {
          const p = ctx.targetPos[i];
          if (p) ctx.displace(e, this.v2.set(this.centre.x - p.x, 0, this.centre.z - p.z).multiplyScalar(PULL * k));
        });
      }
    }

    // --- Hit: cyan star at the centre, ground refraction, shake. ---
    if (f.hit) {
      const sp = StarBurst.pop(after, 0.02, 0.04);
      this.hitStar.set(this.v1.copy(this.centre).setY(0.8), 1.1 * sp.scale, sp.opacity, 0.2);
      const gp = THREE.MathUtils.clamp(after / 0.35, 0, 1);
      this.groundShock.set(this.centre, 1 + 4 * gp, 0.04 * (1 - gp) * (1 - gp));
      this.shake = 0.3 * Math.exp(-after * 12);
    }
  }
}

export const constellationSnareModule: EffectModule = {
  label: 'constellation snare',
  category: 'hero: astral',
  targeting: { mode: 'ground', radius: RADIUS },
  create: () => new ConstellationSnare(),
  telegraphs(effect) {
    const e = effect as ConstellationSnare;
    const ctx = e.ctx;
    if (!ctx) return [];
    return [{ shape: { kind: 'circle', x: ctx.point.x, z: ctx.point.z, radius: RADIUS }, start: 0, impact: HIT_T }];
  },
  bloom: { enabled: true, strength: 0.45, radius: 0.4, threshold: 0.86 },
  frameCamera(camera, controls, effect) {
    const e = effect as ConstellationSnare;
    if (e.ctx) frameCast(camera, controls, e.ctx, 3);
  },
  buildGui(f, effect) {
    const s = (effect as ConstellationSnare).settings;
    f.add(s, 'loop');
    f.add(s, 'damage', 1, 150, 1);
  },
};
