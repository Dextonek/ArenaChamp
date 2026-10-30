import * as THREE from 'three';
import { Emitter } from '../../emitter';
import { smoothstep } from '../../effects/common';
import {
  CrescentArc, ShockRefraction, StarBurst, clearScreenFx, createScreenFx, impactFrameAt,
} from '../../effects/parts';
import {
  ASTRAL, ASTRAL_CSS, ConstellationLines, NightVeil, StarArrow, StarChart, StarPoints,
} from '../../effects/parts/astral';
import { frameCast, type CastContext } from '../../effects/targeting';
import type { Effect, EffectModule } from '../../effects/types';

/**
 * Celestial Hunt (astral kit, R: GLOBAL ultimate, range 60, radius 3, lands 2.5 s after the cast). Under the normal gameplay camera, no letterbox: the world
 * darkens to night and Lyra shoots an arrow into the sky. Where it lands, a giant constellation STAG is drawn star by
 * star (antlers, head, back, legs), side-on to the camera, over a dark night patch. The stag lowers its head, holds
 * for a dead beat, then charges down through the zone toward the caster, shedding falling stars. It hits the centre:
 * impact frame (the stag as a black silhouette on a parchment card), a wave of star points bursts up across the
 * radius, a cyan accent, ground refraction and shake. The stag dissolves into a rain of small shooting stars; the
 * chart and the night fade. Clean by 4.5 s. See pipeline/designs/kit-astral.md.
 */
export interface CelestialHuntSettings {
  damage: number;
  loop: boolean;
}

export const defaultCelestialHunt = (): CelestialHuntSettings => ({ damage: 155, loop: false });

// Timeline (seconds).
const SHOT_T = 0.1; // arrow leaves the bow
const IGNITE_T = 0.3; // arrow arrives, first star
const BUILD_STEP = 0.052; // between stars
const LOWER_T = 1.6;
const DEAD_A = 1.8;
const DEAD_B = 1.95;
const HIT_T = 2.5; // GLOBAL: the stag lands 2.5 s after the cast, on the spot that was aimed
const DURATION = 4.5;

const RADIUS = 3;
const SC = 1.0; // stag scale: about 11 wide
const HOME_Y = 6.5;
const END_Y = 3.9;
const RAIN = 26;

/** Stag nodes in the figure's plane: x toward the nose, y up; size of the star. */
const NODE: [number, number, number][] = [
  [-4.3, 0.5, 0.75], // 0 rump
  [-1.5, 1.2, 0.6], // 1 back
  [1.3, 1.1, 0.8], // 2 shoulder
  [2.5, 2.0, 0.6], // 3 neck
  [3.5, 3.0, 0.7], // 4 poll
  [5.5, 2.0, 0.55], // 5 nose
  [4.2, 1.6, 0.5], // 6 jaw
  [2.7, 0.7, 0.55], // 7 throat
  [1.8, -0.6, 0.8], // 8 chest
  [-1.2, -0.7, 0.6], // 9 belly
  [-3.7, -0.4, 0.75], // 10 flank
  [2.4, -1.8, 0.55], // 11 front knee
  [2.3, -3.5, 0.6], // 12 front hoof
  [0.9, -1.7, 0.5], // 13 second front knee
  [1.8, -2.6, 0.55], // 14 second front hoof
  [-4.6, -1.7, 0.55], // 15 hock
  [-4.0, -3.4, 0.6], // 16 hind hoof
  [-2.7, -1.9, 0.5], // 17 second hind knee
  [-2.9, -3.4, 0.55], // 18 second hind hoof
  [3.1, 3.9, 0.55], // 19 antler a1
  [2.5, 4.7, 0.65], // 20 antler a2
  [1.7, 5.3, 0.5], // 21 antler tip
  [4.0, 4.6, 0.45], // 22 tine
  [3.4, 5.4, 0.5], // 23 tine tip
];
const EDGES: [number, number][] = [
  [0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 7], [7, 8], [8, 9], [9, 10], [10, 0],
  [4, 6], [3, 7], [1, 9], [2, 8],
  [8, 11], [11, 12], [8, 13], [13, 14], [10, 15], [15, 16], [10, 17], [17, 18],
  [4, 19], [19, 20], [20, 21], [19, 22], [20, 23],
];
const HEAD = new Set([4, 5, 6, 19, 20, 21, 22, 23]);
const PIVOT = NODE[3];
const HEAD_ANGLE = -0.55; // the head lowers this much (radians, nose down)
const CHARGE_ROLL = -0.3;

export class CelestialHunt implements Effect {
  readonly group = new THREE.Group();
  readonly settings: CelestialHuntSettings;
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
  private right = new THREE.Vector3(1, 0, 0);
  private hand = new THREE.Vector3(0, 2.2, 13);
  private bowPos = new THREE.Vector3(0, 2.4, 12);
  private point = new THREE.Vector3(0, 0, -6);
  private home = new THREE.Vector3();
  private end = new THREE.Vector3();
  private origin = new THREE.Vector3();
  private nodes: THREE.Vector3[] = NODE.map(() => new THREE.Vector3());
  private rainPts: THREE.Vector3[] = [];
  private rainT: number[] = [];

  private flags = { arrow: false, ignite: false, build: false, hit: false, dissolve: false, rain: 0 };
  private starIds: number[] = [];
  private lineIds: number[] = [];
  private trailTimer = 0;

  // Parts.
  private bowPivot = new THREE.Group();
  private bow = new CrescentArc({ radius: 0.85, width: 0.18, sweep: Math.PI * 0.9, style: 'toon', edge: ASTRAL.core, mid: ASTRAL.hot, outer: ASTRAL.body });
  private string = new THREE.Mesh(
    new THREE.PlaneGeometry(1, 0.08),
    new THREE.MeshBasicMaterial({ color: ASTRAL.hot, transparent: true, depthWrite: false, side: THREE.DoubleSide, opacity: 0 }),
  );
  private arrow = new StarArrow();
  private chart = new StarChart();
  private groundVeil = new NightVeil();
  private skyVeil = new NightVeil();
  private stag = new StarPoints({ max: 32 });
  private lines = new ConstellationLines({ maxLines: 36, maxShards: 72 });
  private trail = new StarPoints({ max: 80 });
  private burst = new StarPoints({ max: 48 });
  private rain = new StarPoints({ max: 40 });
  private ignite = new StarBurst({ points: 4, inner: 0.2, jitter: 0, color: ASTRAL.hot, core: ASTRAL.core, additive: false });
  private centre = new StarBurst({ points: 12, inner: 0.3, color: ASTRAL.accent, core: ASTRAL.core, additive: false });
  private groundShock = new ShockRefraction({ facing: 'ground' });
  private silhouette: THREE.Mesh;

  // Scratch.
  private v1 = new THREE.Vector3();
  private v2 = new THREE.Vector3();
  private qa = new THREE.Quaternion();
  private qb = new THREE.Quaternion();
  private m4 = new THREE.Matrix4();
  private up = new THREE.Vector3(0, 1, 0);
  private normal = new THREE.Vector3(0, 0, 1);

  constructor(settings: CelestialHuntSettings = defaultCelestialHunt()) {
    this.settings = settings;
    this.screen.tint.set(ASTRAL.dark);
    this.screen.impactColor.set(ASTRAL.foil);

    // The bow: same toon crescent as Starshot, raised toward the sky.
    const sweep = Math.PI * 0.9;
    this.bow.mesh.rotation.z = Math.PI / 2 - sweep / 2;
    this.string.scale.x = 0.85 * Math.sin(sweep / 2) * 2;
    this.string.position.set(0, 0.85 * Math.cos(sweep / 2), 0);
    this.bowPivot.add(this.bow.mesh, this.string);
    this.bow.mesh.onBeforeRender = (_r, _s, camera) => {
      this.bowPivot.parent?.getWorldQuaternion(this.qa);
      camera.getWorldQuaternion(this.qb);
      this.bowPivot.quaternion.copy(this.qa.invert().multiply(this.qb));
      this.bowPivot.updateMatrixWorld(true);
    };
    this.string.renderOrder = 7;

    this.lines.widthScale = 1.7;
    this.stag.twinkle = 0.12;
    this.trail.gravity = -4;
    this.burst.gravity = -9;
    this.rain.gravity = -3;
    this.chart.hole = 0.4;

    this.silhouette = this.buildSilhouette();
    this.silhouette.visible = false;

    this.group.add(
      this.groundVeil.mesh, this.skyVeil.mesh, this.chart.mesh, this.bowPivot, this.arrow.mesh, this.lines.mesh,
      this.stag.mesh, this.trail.mesh, this.burst.mesh, this.rain.mesh, this.ignite.mesh, this.centre.mesh,
      this.groundShock.mesh, this.silhouette,
    );
    this.reset();
  }

  get duration() {
    return DURATION;
  }

  get impactTime() {
    return HIT_T;
  }

  /** A solid copy of the stag in its charging pose (thick bars, filled body) for the impact frame. */
  private buildSilhouette() {
    const pos: number[] = [];
    const pts = NODE.map(([x, y], i) => {
      if (!HEAD.has(i)) return new THREE.Vector2(x, y);
      const dx = x - PIVOT[0], dy = y - PIVOT[1], c = Math.cos(HEAD_ANGLE), s = Math.sin(HEAD_ANGLE);
      return new THREE.Vector2(PIVOT[0] + dx * c - dy * s, PIVOT[1] + dx * s + dy * c);
    });
    const tri = (a: THREE.Vector2, b: THREE.Vector2, c: THREE.Vector2) => {
      pos.push(a.x, a.y, 0, b.x, b.y, 0, c.x, c.y, 0, a.x, a.y, 0, c.x, c.y, 0, b.x, b.y, 0); // both faces
    };
    const bar = (a: THREE.Vector2, b: THREE.Vector2, w: number) => {
      const d = new THREE.Vector2().subVectors(b, a).normalize();
      const n = new THREE.Vector2(-d.y, d.x).multiplyScalar(w / 2);
      const p1 = a.clone().add(n), p2 = a.clone().sub(n), p3 = b.clone().add(n), p4 = b.clone().sub(n);
      tri(p1, p2, p3);
      tri(p2, p4, p3);
    };
    const disc = (c: THREE.Vector2, r: number) => {
      for (let k = 0; k < 8; k++) {
        const a0 = (k / 8) * Math.PI * 2, a1 = ((k + 1) / 8) * Math.PI * 2;
        tri(c, new THREE.Vector2(c.x + Math.cos(a0) * r, c.y + Math.sin(a0) * r), new THREE.Vector2(c.x + Math.cos(a1) * r, c.y + Math.sin(a1) * r));
      }
    };
    // Body fill: a fan over the torso, a quad for the neck, a triangle for the head.
    const torso = [0, 1, 2, 3, 7, 8, 9, 10];
    const mid = new THREE.Vector2();
    for (const i of torso) mid.add(pts[i]);
    mid.multiplyScalar(1 / torso.length);
    for (let k = 0; k < torso.length; k++) tri(mid, pts[torso[k]], pts[torso[(k + 1) % torso.length]]);
    tri(pts[3], pts[4], pts[6]);
    tri(pts[3], pts[6], pts[7]);
    tri(pts[4], pts[5], pts[6]);
    for (const [a, b] of EDGES) bar(pts[a], pts[b], b >= 19 || a >= 19 ? 0.34 : 0.6);
    pts.forEach((p, i) => disc(p, 0.3 + NODE[i][2] * 0.35));
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: 0x000000, side: THREE.DoubleSide }));
    m.frustumCulled = false;
    return m;
  }

  cast(ctx: CastContext) {
    this.ctx = ctx;
    this.from.copy(ctx.from);
    this.point.copy(ctx.point).setY(0);
    this.fwd.set(Math.sin(ctx.aim), 0, Math.cos(ctx.aim));
    this.right.set(-this.fwd.z, 0, this.fwd.x);
    this.hand.copy(ctx.from).addScaledVector(this.fwd, 0.55).setY(2.2);
    this.bowPos.copy(ctx.from).addScaledVector(this.fwd, 0.9).setY(2.5);
    this.bowPivot.position.copy(this.bowPos);
    this.home.copy(this.point).addScaledVector(this.fwd, 4).setY(HOME_Y);
    this.end.copy(this.point).addScaledVector(this.fwd, -1).setY(END_Y);
    this.normal.crossVectors(this.right, this.up).normalize();

    this.rainPts.length = 0;
    this.rainT.length = 0;
    for (let i = 0; i < RAIN; i++) {
      const r = RADIUS * 1.05 * Math.sqrt((i + 0.5) / RAIN), a = i * 2.39996 + 0.4;
      this.rainPts.push(new THREE.Vector3(this.point.x + Math.cos(a) * r, 8 + ((i * 7) % 5), this.point.z + Math.sin(a) * r));
      this.rainT.push(HIT_T + 0.1 + (i / RAIN) * 1.1);
    }

    this.screen.silhouettes = [ctx.caster.group, ...ctx.targets.map((e) => e.group), this.silhouette];
    this.screen.focus.copy(this.point).setY(1.5);
    this.chart.set(this.point, RADIUS);
    this.groundVeil.set(this.point, RADIUS + 0.4, 0);
    this.setSkyVeil();
    this.groundShock.set(this.point, 0, 0);
  }

  private setSkyVeil() {
    this.v1.copy(this.home).addScaledVector(this.normal, -0.6);
    this.v1.y += 0.9;
    this.skyVeil.setPlane(this.v1, this.normal, 7.6, 6.6);
  }

  play() {
    this.reset();
    this.playing = true;
  }

  private reset() {
    this.time = 0;
    this.shake = 0;
    this.trailTimer = 0;
    const f = this.flags;
    f.arrow = f.ignite = f.build = f.hit = f.dissolve = false;
    f.rain = 0;
    this.starIds.length = 0;
    this.lineIds.length = 0;
    clearScreenFx(this.screen);
    this.screen.tint.set(ASTRAL.dark);
    this.screen.impactColor.set(ASTRAL.foil);
    this.arrow.reset();
    this.chart.reset();
    this.chart.hole = 0.4;
    this.groundVeil.reset();
    this.skyVeil.reset();
    if (this.ctx) { this.groundVeil.set(this.point, RADIUS + 0.4, 0); this.setSkyVeil(); }
    this.groundVeil.opacity = 0;
    this.skyVeil.opacity = 0;
    this.stag.reset();
    this.stag.twinkle = 0.12;
    this.trail.reset();
    this.burst.reset();
    this.rain.reset();
    this.lines.reset();
    this.bow.opacity = 0;
    (this.string.material as THREE.MeshBasicMaterial).opacity = 0;
    this.string.visible = false;
    this.silhouette.visible = false;
    this.ignite.set(this.hand, 0, 0);
    this.centre.set(this.point, 0, 0);
    this.groundShock.set(this.point, 0, 0);
  }

  /** The stag's origin (the middle of its figure) at time t: parked behind the zone, then diving through it. */
  private originAt(t: number, out: THREE.Vector3) {
    const u = THREE.MathUtils.clamp((t - DEAD_B) / (HIT_T - DEAD_B), 0, 1);
    const e = u * u;
    out.lerpVectors(this.home, this.end, e);
    out.y = this.home.y + (this.end.y - this.home.y) * (u * u * (1.0 + 0.4 * (1 - u)));
    return out;
  }

  private headAngleAt(t: number) {
    return HEAD_ANGLE * smoothstep((t - LOWER_T) / 0.2);
  }

  private rollAt(t: number) {
    const u = THREE.MathUtils.clamp((t - DEAD_B) / (HIT_T - DEAD_B), 0, 1);
    return CHARGE_ROLL * u * u;
  }

  /** World position of node i at time t (origin must be current). */
  private nodeAt(i: number, t: number, out: THREE.Vector3) {
    let x = NODE[i][0], y = NODE[i][1];
    if (HEAD.has(i)) {
      const h = this.headAngleAt(t), c = Math.cos(h), s = Math.sin(h);
      const dx = x - PIVOT[0], dy = y - PIVOT[1];
      x = PIVOT[0] + dx * c - dy * s;
      y = PIVOT[1] + dx * s + dy * c;
    }
    const r = this.rollAt(t), cr = Math.cos(r), sr = Math.sin(r);
    const rx = (x * cr - y * sr) * SC, ry = (x * sr + y * cr) * SC;
    return out.copy(this.origin).addScaledVector(this.right, rx).addScaledVector(this.up, ry);
  }

  update(dt: number) {
    for (const e of this.emitters) e.update(dt);
    if (!this.playing) return;
    const beat = this.time >= DEAD_A && this.time < DEAD_B;
    if (!beat) {
      this.groundVeil.update(dt);
      this.skyVeil.update(dt);
    }
    this.stag.update(dt);
    this.trail.update(dt);
    this.burst.update(dt);
    this.rain.update(dt);
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
    this.originAt(t, this.origin);

    // Events.
    if (!f.arrow && t >= SHOT_T) {
      f.arrow = true;
      this.originAt(0, this.origin);
      this.arrow.fly(this.hand, this.nodeAt(0, 0, this.v1), IGNITE_T - SHOT_T);
      this.originAt(t, this.origin);
    }
    if (!f.ignite && t >= IGNITE_T) f.ignite = true;
    if (!f.build && t >= IGNITE_T) {
      f.build = true;
      this.originAt(0, this.origin);
      const delays: number[] = [];
      for (let i = 0; i < NODE.length; i++) {
        this.nodeAt(i, 0, this.nodes[i]);
        delays.push(i * BUILD_STEP);
        this.starIds.push(this.stag.add(this.nodes[i], NODE[i][2] * 1.05, delays[i]));
      }
      EDGES.forEach(([a, b]) => {
        const d = Math.max(delays[a], delays[b]) + 0.03;
        this.lineIds.push(this.lines.connect(this.nodes[a], this.nodes[b], 0.14, d));
      });
      this.originAt(t, this.origin);
    }
    if (!f.hit && t >= HIT_T) {
      f.hit = true;
      this.land();
    }
    if (!f.dissolve && t >= HIT_T + 0.05) {
      f.dissolve = true;
      this.lines.snap(0.9);
      this.stag.fallAll(1, 1.0);
    }
    while (f.rain < RAIN && t >= this.rainT[f.rain]) {
      const id = this.rain.add(this.rainPts[f.rain], 0.2 + 0.12 * (f.rain % 3));
      this.rain.fall(id, this.v1.set((f.rain % 2 - 0.5) * 0.8, -3.5 - (f.rain % 4) * 0.5, 0), 1.0);
      f.rain++;
    }
    if (t >= DEAD_B && t < HIT_T) this.shed(dt);

    // The figure follows its pose every frame once it has been built.
    if (f.build && !f.dissolve && !beat) {
      for (let i = 0; i < NODE.length; i++) {
        this.nodeAt(i, t, this.nodes[i]);
        this.stag.place(this.starIds[i], this.nodes[i]);
      }
      EDGES.forEach(([a, b], k) => this.lines.move(this.lineIds[k], this.nodes[a], this.nodes[b]));
    }

    this.layout();
    void ctx;
  }

  /** Falling star segments shed from the charging stag. */
  private shed(dt: number) {
    this.trailTimer += dt;
    while (this.trailTimer >= 0.012) {
      this.trailTimer -= 0.012;
      const i = Math.floor(Math.random() * NODE.length);
      const id = this.trail.add(this.nodes[i], 0.16 + Math.random() * 0.12);
      this.trail.fall(id, this.v1.set((Math.random() - 0.5) * 1.5, -1 - Math.random() * 1.5, (Math.random() - 0.5) * 1.5), 0.45);
    }
  }

  /** The hit: star points burst up across the radius, damage, shake. */
  private land() {
    const n = 40;
    for (let k = 0; k < n; k++) {
      const r = RADIUS * Math.sqrt((k + 0.5) / n), a = k * 2.39996 + 1.1;
      this.v1.set(this.point.x + Math.cos(a) * r, 0.1, this.point.z + Math.sin(a) * r);
      const id = this.burst.add(this.v1, 0.28 + 0.26 * ((k * 7) % 5) / 4, (r / RADIUS) * 0.25);
      this.burst.fall(id, this.v2.set(Math.cos(a) * 0.8, 6 + ((k * 3) % 5), Math.sin(a) * 0.8), 1.0);
    }
    this.shake = 0.7;
    const ctx = this.ctx;
    if (ctx) {
      // Re-check at the landing: only enemies still inside the circle (live position) are hit, so a walker escapes.
      for (const e of ctx.targets) {
        if (Math.hypot(e.group.position.x - this.point.x, e.group.position.z - this.point.z) > RADIUS) continue;
        ctx.hit(e, { damage: this.settings.damage, knock: 7, from: this.point, color: ASTRAL_CSS.hot });
      }
    }
  }

  private layout() {
    const t = this.time;
    const f = this.flags;
    const after = t - HIT_T;
    const beat = t >= DEAD_A && t < DEAD_B;
    this.stag.twinkle = beat ? 0 : 0.12;

    // --- Screen: night, then the impact frame. ---
    this.screen.darken = 0.7 * smoothstep(t / 0.4) * (1 - smoothstep((t - 3.4) / 1.0));
    this.screen.impact = impactFrameAt(t, HIT_T, [1, 2], 0.04);
    this.silhouette.visible = this.screen.impact !== 0;
    if (this.silhouette.visible) {
      this.m4.makeBasis(this.right, this.up, this.normal);
      this.silhouette.quaternion.setFromRotationMatrix(this.m4);
      this.qa.setFromAxisAngle(this.normal, CHARGE_ROLL);
      this.silhouette.quaternion.premultiply(this.qa);
      this.silhouette.position.copy(this.end);
      this.silhouette.scale.setScalar(SC);
    }

    // --- Chart and night. ---
    const outK = 1 - smoothstep((t - 3.2) / 1.1);
    this.chart.reveal = smoothstep(t / 0.8);
    this.chart.opacity = outK;
    const spinT = t < DEAD_A ? t : t < DEAD_B ? DEAD_A : t - (DEAD_B - DEAD_A);
    this.chart.spin = 0.07 * spinT;
    this.groundVeil.opacity = smoothstep(t / 0.5) * outK;
    this.skyVeil.opacity = smoothstep((t - 0.25) / 0.6) * (1 - smoothstep((t - DEAD_B) / 0.4));

    // --- The bow, drawn toward the sky and gone after the shot. ---
    this.bowPivot.position.copy(this.bowPos);
    this.bow.head = smoothstep(t / 0.12);
    this.bow.length = 1;
    this.bow.erosion = 0;
    this.bow.time = t;
    const bowA = t < 0.22 ? 1 : 1 - smoothstep((t - 0.22) / 0.12);
    this.bow.opacity = bowA;
    const sm = this.string.material as THREE.MeshBasicMaterial;
    sm.opacity = bowA * smoothstep((t - 0.03) / 0.07);
    this.string.visible = sm.opacity > 0.01;

    // --- Ignition: a gold flash where the arrow lands. ---
    if (f.ignite) {
      const sp = StarBurst.pop(t - IGNITE_T, 0.01, 0.03);
      this.ignite.set(this.nodes[0], 1.3 * sp.scale, sp.opacity, 0.3);
    }

    // --- Impact: cyan star at the centre, ground refraction, shake. ---
    if (f.hit) {
      const sp = StarBurst.pop(after - 0.04, 0.03, 0.05);
      this.centre.set(this.v1.copy(this.point).setY(1.4), 2 * sp.scale, sp.opacity, 0.2);
      const gp = THREE.MathUtils.clamp(after / 0.55, 0, 1);
      this.groundShock.set(this.point, 1 + 11 * gp, 0.07 * (1 - gp) * (1 - gp));
      this.shake = 0.7 * Math.exp(-after * 8);
    } else if (t >= DEAD_B) {
      this.shake = 0.12 * smoothstep((t - DEAD_B) / 0.3);
    }
  }
}

export const celestialHuntModule: EffectModule = {
  label: 'celestial hunt',
  category: 'hero: astral',
  targeting: { mode: 'ground', radius: RADIUS },
  create: () => new CelestialHunt(),
  telegraphs(effect) {
    const e = effect as CelestialHunt;
    const ctx = e.ctx;
    if (!ctx) return [];
    return [{ shape: { kind: 'circle', x: ctx.point.x, z: ctx.point.z, radius: RADIUS }, start: 0, impact: HIT_T }];
  },
  bloom: { enabled: true, strength: 0.45, radius: 0.4, threshold: 0.86 },
  frameCamera(camera, controls, effect) {
    const e = effect as CelestialHunt;
    if (e.ctx) frameCast(camera, controls, e.ctx, 12);
  },
  buildGui(f, effect) {
    const s = (effect as CelestialHunt).settings;
    f.add(s, 'loop');
    f.add(s, 'damage', 1, 300, 1);
  },
};
