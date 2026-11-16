import * as THREE from 'three';
import { RealHero } from '../../../motion/real';
import type { LifeEnv } from './core';
import { RING } from '../../../arenas/common';

/**
 * People going about a floor: each walks a route (a line of points beside a path) at an easy pace, stands a while at each end and
 * walks back. They are drawn on the heroes' own bodies and moved by the animator's clips the heroes use (`Walk_Loop`, `Idle_Loop`;
 * src/motion/real.ts), so they move as the floor's people do. Never in a fight: a fight that comes near turns them back; the hero in
 * their way stops them, and they turn to look. Only those within `SEEN` m of the hero are drawn and posed (each is a skinned figure:
 * a few draw calls and its bones), and none on a phone.
 */
const SEEN = 60;
/** The walk's pace (m/s) and how fast the walking clip plays for it (its stride covers about this much a second at speed 1). */
const PACE = 1.25, CLIP_PACE = 1.35;
/** Seconds of the floor before a walker's figure is made (see `make`). */
const LATE = 2;

interface Walker {
  fig: RealHero | null;
  pts: { x: number; z: number }[];
  /** Length along the route of each point. */
  at: number[];
  s: number;
  dir: 1 | -1;
  wait: number;
  clock: number;
  yaw: number;
  /** 0 standing, 1 walking: the clips are blended across it. */
  mix: number;
  /** Its figure has loaded and its bone textures are made. */
  ready?: boolean;
}

export class Walkers {
  private list: Walker[] = [];
  private age = 0;
  constructor(private env: LifeEnv, routes: { x: number; z: number }[][], private model: (i: number) => string, private danger: (x: number, z: number) => boolean) {
    routes.forEach((pts) => {
      const at = [0];
      for (let k = 1; k < pts.length; k++) at.push(at[k - 1] + Math.hypot(pts[k].x - pts[k - 1].x, pts[k].z - pts[k - 1].z));
      this.list.push({ fig: null, pts, at, s: at[at.length - 1] * env.rnd(), dir: env.rnd() < 0.5 ? 1 : -1, wait: 0, clock: env.rnd() * 10, yaw: 0, mix: 0 });
    });
  }

  /**
   * A walker's figure is made when the floor has run `LATE` s and the hero is near: its model then loads between frames, as any model
   * that comes in late does. (Made with the zone, it loaded while the fight was being set up, and three.js's ids for its parts rolled
   * the fight's dice: the perf tool's fights came out other fights.)
   */
  private make(i: number) {
    const w = this.list[i];
    w.fig = new RealHero(this.model(i));
    w.fig.root.visible = false;
    this.env.group.add(w.fig.root);
    return w.fig;
  }

  get count() {
    return this.list.length;
  }

  /** Where each is now (the tools), and whether its figure is drawn. */
  snapshot() {
    return this.list.map((w) => ({ ...this.place(w, w.s), drawn: !!w.fig?.root.visible }));
  }

  /** The point `s` m along a route, and the way it runs there. */
  private place(w: Walker, s: number) {
    const L = w.at[w.at.length - 1];
    s = Math.max(0, Math.min(L, s));
    let k = 1;
    while (k < w.at.length - 1 && w.at[k] < s) k++;
    const a = w.pts[k - 1], b = w.pts[k], f = (s - w.at[k - 1]) / Math.max(1e-6, w.at[k] - w.at[k - 1]);
    return { x: a.x + (b.x - a.x) * f, z: a.z + (b.z - a.z) * f, yaw: Math.atan2(b.x - a.x, b.z - a.z) };
  }

  update(dt: number, hero: THREE.Vector3) {
    this.age += dt;
    this.list.forEach((w, i) => {
      const L = w.at[w.at.length - 1], here = this.place(w, w.s);
      const seen = Math.hypot(hero.x - here.x, hero.z - here.z) < SEEN;
      const fig = w.fig ?? (seen && this.age > LATE ? this.make(i) : null);
      if (fig?.loaded && !w.ready) {
        // three.js makes a skinned figure's bone texture when it first draws it, and rolls dice for its id there, in the middle of the
        // fight's frame: made here, under the life's own dice (index.ts `quiet`), the draw finds it made.
        fig.root.traverse((o) => { const sk = (o as THREE.SkinnedMesh).skeleton; if ((o as THREE.SkinnedMesh).isSkinnedMesh && sk && !sk.boneTexture) sk.computeBoneTexture(); });
        w.ready = true;
      }
      if (fig) fig.root.visible = seen && !!w.ready;
      let walking = false;
      if (w.wait > 0) w.wait -= dt;
      else {
        const ahead = this.place(w, w.s + w.dir * 1.6);
        if (this.danger(ahead.x, ahead.z)) {
          // a fight ahead: back the way it came
          w.dir = w.dir === 1 ? -1 : 1;
          w.wait = 1;
        } else if (Math.hypot(hero.x - ahead.x, hero.z - ahead.z) < 1.8) {
          // the hero in the way: it stops and looks
          w.yaw = turn(w.yaw, Math.atan2(hero.x - here.x, hero.z - here.z), dt * 4);
        } else {
          w.s += w.dir * PACE * dt;
          walking = true;
          if (w.s <= 0 || w.s >= L) {
            w.s = Math.max(0, Math.min(L, w.s));
            w.dir = w.dir === 1 ? -1 : 1;
            w.wait = 3 + this.env.rnd() * 5;
          }
          const p = this.place(w, w.s);
          w.yaw = turn(w.yaw, p.yaw + (w.dir === 1 ? 0 : Math.PI), dt * 5);
        }
      }
      if (!seen || !fig) return;
      const p = this.place(w, w.s);
      fig.root.position.set(p.x, 0, p.z);
      fig.root.rotation.y = w.yaw;
      w.mix += ((walking ? 1 : 0) - w.mix) * Math.min(1, dt * 5);
      w.clock += dt * (w.mix * (PACE / CLIP_PACE) + (1 - w.mix));
      const k = w.mix, j = 1 - k;
      fig.pose([
        { clip: 'Walk_Loop', t: w.clock, loop: true, legs: k, torso: k, armR: k, armL: k },
        { clip: 'Idle_Loop', t: w.clock, loop: true, legs: j, torso: j, armR: j, armL: j },
      ]);
    });
  }
}

/**
 * Who walks each chapter's floors, by the floor's number and the walker's index: the model's file stem (`models/tower/<stem>_v4.glb`).
 * The plain workers made for it (2026-11-16, blender/tower/<chapter>/: the people's skeleton, empty hands, a load on the back or the
 * head; no name, so nobody meets a named person twice): on the Sea a dockhand and a fishwife in turn, one worker a chapter after it.
 * They walk on the walking clip (no work clips: the clip file would grow by a third). One line a chapter.
 */
export const WALKER_MODELS: Record<'sea' | 'wood' | 'sands' | 'deep' | 'war', (n: number, i: number) => string> = {
  sea: (n, i) => ((n + i) % 2 === 0 ? 'sea_dockhand' : 'sea_fishwife'),
  wood: () => 'wood_cutter',
  sands: () => 'sands_water',
  deep: () => 'deep_miner',
  war: () => 'war_gleaner',
};
export const walkerModel = (chapter: keyof typeof WALKER_MODELS, n: number) => (i: number) => `models/tower/${WALKER_MODELS[chapter](n, i)}_v4.glb`;

/**
 * Walkers' routes beside a floor's trails (offsets from the middle): each trail followed `side` m to its right, cut where `ok` says
 * no (near a pack's fight, the flats...), and the longest runs of at least `min` points (2 m apart) kept, `most` of them, each
 * 6 m clear of the others.
 */
export function walkerRoutes(paths: [number, number][][], ok: (x: number, z: number) => boolean, most: number, o: { side?: number; min?: number } = {}) {
  const side = o.side ?? 1.4, runs: { x: number; z: number }[][] = [];
  for (const path of paths) {
    const pts = path.map(([dx, dz]) => ({ x: RING.x + dx, z: RING.z + dz }));
    const dense: { x: number; z: number }[] = [];
    for (let k = 1; k < pts.length; k++) {
      const a = pts[k - 1], b = pts[k], len = Math.hypot(b.x - a.x, b.z - a.z) || 1, n = Math.max(1, Math.ceil(len / 2)), nx = (b.z - a.z) / len, nz = -(b.x - a.x) / len;
      for (let i = 0; i < n; i++) dense.push({ x: a.x + (b.x - a.x) * (i / n) + nx * side, z: a.z + (b.z - a.z) * (i / n) + nz * side });
    }
    let cur: { x: number; z: number }[] = [];
    for (const q of dense) {
      if (ok(q.x, q.z)) cur.push(q);
      else { if (cur.length) runs.push(cur); cur = []; }
    }
    if (cur.length) runs.push(cur);
  }
  // the longest first, each kept only if it keeps 6 m from those already kept (two trails side by side gave two walkers walking
  // together, the same figure twice)
  const chosen: { x: number; z: number }[][] = [];
  for (const r of runs.filter((q) => q.length >= (o.min ?? 12)).sort((a, b) => b.length - a.length)) {
    if (chosen.length >= most) break;
    if (chosen.some((c) => r.some((p) => c.some((q) => Math.abs(p.x - q.x) < 6 && Math.abs(p.z - q.z) < 6)))) continue;
    chosen.push(r);
  }
  return chosen;
}

const turn = (from: number, to: number, k: number) => {
  const d = Math.atan2(Math.sin(to - from), Math.cos(to - from));
  return from + d * Math.min(1, k);
};
