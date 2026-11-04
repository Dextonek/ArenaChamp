import { segDist } from '../obstacles';
import { addGroundWiper } from './ground';
import * as THREE from 'three';
import { INK } from '../effects/parts/ink';
import type { GroundMark, Trait } from './types';

/** How long a stroke stays on the ground, and a seal; the seal's arming time and radius. */
export const STROKE_LIFE = 5;
export const SEAL_LIFE = 6;
export const SEAL_ARM = 0.5;
export const SEAL_R = 1;
/** Wet Ink: how close to a stroke counts as standing on it (m), and how often the slow is refreshed (s). */
export const WET_R = 0.8;
const WET_TICK = 0.4;
/** A crossing: seconds from the point appearing to its burst, its radius (m) and its damage. Ink Lash gets 1 s back. */
export const CROSS_FUSE = 0.65;
export const CROSS_R = 1.5;
export const CROSS_DAMAGE = 40;
const BURST_LIFE = 0.35;
const MAX_CROSSINGS = 12;
/** An armed seal counts as a short stroke across its centre (along x) for crossings. */
const SEAL_HALF = 1;

/** One stroke on the ground: a segment, painted at `born` (the clock below), a stroke only counts once it is `armedAt`. */
export interface InkStroke { id: number; ax: number; az: number; bx: number; bz: number; born: number; armedAt: number }
/** A seal of binding: armed at `armedAt`, gone when an enemy steps in (`used`) or after `SEAL_LIFE`. Ids are 0..19 (a message clamps to 0-20). */
export interface InkSeal { id: number; x: number; z: number; born: number; armedAt: number; checked: boolean }
/** Where two strokes cross: it bursts at `at + CROSS_FUSE`, once. */
export interface Crossing { id: number; x: number; z: number; at: number; fired: boolean }

interface Board {
  strokes: InkStroke[];
  seals: InkSeal[];
  crossings: Crossing[];
  /** Seals that were used up, for the look only. */
  pops: { x: number; z: number; at: number }[];
  nextStroke: number;
  nextSeal: number;
  nextCross: number;
}

const boards = new WeakMap<object, Board>();
const clocks = new WeakMap<object, number>();

/**
 * Shiori's ink is state that outlives every spell, so it lives here, keyed by her figure, and the spell effects add to it at
 * the moment they land, on both screens (`addStroke`, `addSeal`). `marks` draws it, ages it out and writes the clock the
 * effects read (`inkNow`); `victimTick` (the victim's screen) slows, roots and bursts.
 */
export function inkNow(fig: object): number {
  return clocks.get(fig) ?? performance.now() / 1000;
}

/** True when a trait is writing this figure's clock (a duel); in the VFX tool no trait runs and the effects draw the ink themselves. */
export function inkLive(fig: object): boolean {
  return clocks.has(fig);
}

function syncClock(fig: object, time: number) {
  const prev = clocks.get(fig);
  const b = boards.get(fig);
  // A clock that went back (a new round) or ink from the future (the tool's real time) empties the board.
  if (b && ((prev !== undefined && time < prev - 0.5) || b.strokes.some((s) => s.born > time + 0.5) || b.seals.some((s) => s.born > time + 0.5))) boards.delete(fig);
  clocks.set(fig, time);
}

function board(fig: object): Board {
  let b = boards.get(fig);
  if (!b) {
    b = { strokes: [], seals: [], crossings: [], pops: [], nextStroke: 0, nextSeal: 0, nextCross: 0 };
    boards.set(fig, b);
  }
  return b;
}

function prune(fig: object, now: number) {
  const b = boards.get(fig);
  if (!b) return;
  b.strokes = b.strokes.filter((s) => now - s.born < STROKE_LIFE);
  b.seals = b.seals.filter((s) => now - s.born < SEAL_LIFE);
  b.crossings = b.crossings.filter((c) => now - c.at < CROSS_FUSE + BURST_LIFE);
  b.pops = b.pops.filter((p) => now - p.at < 0.4);
}

/** The strokes of `fig` that are live (not aged out), armed or not. */
export function strokesOf(fig: object): readonly InkStroke[] {
  return boards.get(fig)?.strokes ?? [];
}

export function sealsOf(fig: object): readonly InkSeal[] {
  return boards.get(fig)?.seals ?? [];
}

export function crossingsOf(fig: object): readonly Crossing[] {
  return boards.get(fig)?.crossings ?? [];
}

const armed = (s: { armedAt: number }, now: number) => now >= s.armedAt;

/** Where segment a-b meets segment c-d (ground plane), or null. */
function meet(ax: number, az: number, bx: number, bz: number, cx: number, cz: number, dx: number, dz: number) {
  const r1x = bx - ax, r1z = bz - az, r2x = dx - cx, r2z = dz - cz;
  const den = r1x * r2z - r1z * r2x;
  if (Math.abs(den) < 1e-6) return null;
  const t = ((cx - ax) * r2z - (cz - az) * r2x) / den;
  const u = ((cx - ax) * r1z - (cz - az) * r1x) / den;
  if (t < 0 || t > 1 || u < 0 || u > 1) return null;
  return { x: ax + r1x * t, z: az + r1z * t };
}

/** Distance from (px, pz) to the segment a-b. */
export function segPointDist(ax: number, az: number, bx: number, bz: number, px: number, pz: number) {
  const dx = bx - ax, dz = bz - az, l2 = dx * dx + dz * dz;
  const k = l2 > 1e-9 ? Math.min(1, Math.max(0, ((px - ax) * dx + (pz - az) * dz) / l2)) : 0;
  return Math.hypot(px - (ax + dx * k), pz - (az + dz * k));
}

function addCrossing(b: Board, x: number, z: number, now: number) {
  b.crossings.push({ id: b.nextCross++, x, z, at: now, fired: false });
  while (b.crossings.length > MAX_CROSSINGS) b.crossings.shift();
}

/**
 * Paints a stroke from a to b for `fig` now. Where it crosses an armed stroke (or an armed seal's short stroke) a crossing
 * is made. Call it at the moment a spell lands, on both screens: the same effects make the same lists.
 */
export function addStroke(fig: object, ax: number, az: number, bx: number, bz: number): InkStroke | null {
  if (Math.hypot(bx - ax, bz - az) < 0.2) return null;
  const now = inkNow(fig);
  const b = board(fig);
  prune(fig, now);
  for (const o of b.strokes) {
    if (!armed(o, now)) continue;
    const p = meet(ax, az, bx, bz, o.ax, o.az, o.bx, o.bz);
    if (p) addCrossing(b, p.x, p.z, now);
  }
  for (const s of b.seals) {
    if (!armed(s, now)) continue;
    const p = meet(ax, az, bx, bz, s.x - SEAL_HALF, s.z, s.x + SEAL_HALF, s.z);
    if (p) addCrossing(b, p.x, p.z, now);
  }
  const stroke: InkStroke = { id: b.nextStroke++, ax, az, bx, bz, born: now, armedAt: now };
  b.strokes.push(stroke);
  return stroke;
}

/** Puts a seal of binding at (x, z) for `fig` now; it arms `SEAL_ARM` s later. */
export function addSeal(fig: object, x: number, z: number): InkSeal {
  const now = inkNow(fig);
  const b = board(fig);
  prune(fig, now);
  const seal: InkSeal = { id: b.nextSeal, x, z, born: now, armedAt: now + SEAL_ARM, checked: false };
  b.nextSeal = (b.nextSeal + 1) % 20;
  b.seals = b.seals.filter((s) => s.id !== seal.id);
  b.seals.push(seal);
  return seal;
}

/** A seal used up by an enemy stepping in: removed, with a pop where it lay. */
export function useSeal(fig: object, id: number): boolean {
  const b = boards.get(fig);
  const s = b?.seals.find((x) => x.id === id);
  if (!b || !s) return false;
  b.seals = b.seals.filter((x) => x !== s);
  b.pops.push({ x: s.x, z: s.z, at: inkNow(fig) });
  return true;
}

/** Armed live strokes within `r` of (x, z), nearest first, at most `max`. */
export function strokesNear(fig: object, x: number, z: number, r: number, max = 99): InkStroke[] {
  const now = inkNow(fig);
  return strokesOf(fig)
    .filter((s) => armed(s, now) && now - s.born < STROKE_LIFE)
    .map((s) => ({ s, d: segPointDist(s.ax, s.az, s.bx, s.bz, x, z) }))
    .filter((c) => c.d <= r)
    .sort((p, q) => p.d - q.d)
    .slice(0, max)
    .map((c) => c.s);
}

/** Removes strokes (The Last Character uses them up). */
export function removeStrokes(fig: object, list: readonly InkStroke[]) {
  const b = boards.get(fig);
  if (b) b.strokes = b.strokes.filter((s) => !list.includes(s));
}

// ---------------------------------------------------------------------------------------------------------------
// Looks of the ground marks
// ---------------------------------------------------------------------------------------------------------------

const flat = <M extends THREE.Material>(m: M): M => { m.polygonOffset = true; m.polygonOffsetFactor = -2; m.polygonOffsetUnits = -2; return m; };
const solid = (color: number, opacity = 1, order = 2) => {
  const m = flat(new THREE.MeshBasicMaterial({ color, transparent: opacity < 1, opacity, depthWrite: false, side: THREE.DoubleSide }));
  return { m, order };
};
const put = (geo: THREE.BufferGeometry, mat: { m: THREE.Material; order: number }, y: number) => {
  const o = new THREE.Mesh(geo, mat.m);
  o.position.y = y;
  o.renderOrder = mat.order;
  return o;
};

let strokeSeed = 0;

/**
 * A brush stroke 1 m long along z (z -0.5 is where the brush came down, z +0.5 the dry tail), flat on the ground: an irregular
 * ribbon, fat at the start, wobbling edges, thinning to a point; a pale rice-paper edge wider than the black so it shows on
 * a dark floor; and a few dry streaks. (The mark stretches z by the length, so nothing round goes in it.) Each pooled copy gets its own wobble.
 */
function strokeGeometry(seed: number, half: number, grow: number) {
  const N = 28;
  const pos: number[] = [];
  const idx: number[] = [];
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    const press = Math.min(1, 0.55 + (t / 0.07) * 0.45);
    const dry = 1 - 0.86 * Math.pow(Math.max(0, t - 0.5) / 0.5, 1.4);
    const wob = 1 + 0.16 * Math.sin(t * 19 + seed) + 0.1 * Math.sin(t * 43 + seed * 2.3);
    const lw = Math.max(0.05, half * press * dry * wob + grow);
    const rw = Math.max(0.05, half * press * dry * (1 + 0.16 * Math.sin(t * 23 + seed * 1.7) + 0.1 * Math.sin(t * 37 + seed)) + grow);
    const z = t - 0.5;
    pos.push(-lw, 0, z, rw, 0, z);
    if (i < N) {
      const a = i * 2;
      idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  return g;
}

function strokeLook(): THREE.Object3D {
  const seed = strokeSeed++ * 1.37;
  const g = new THREE.Group();
  // The pale edge first (wider), the sumi body on it, then dry streaks.
  g.add(put(strokeGeometry(seed, 0.3, 0.1), solid(INK.foil, 0.95, 2), 0.01));
  g.add(put(strokeGeometry(seed, 0.3, 0), solid(INK.dark, 1, 3), 0.02));
  g.add(put(strokeGeometry(seed + 5, 0.07, 0), solid(INK.body, 0.9, 4), 0.03));
  for (const [off, from, to] of [[-0.13, 0.55, 0.92], [0.12, 0.5, 0.86], [0.02, 0.6, 0.98]] as [number, number, number][]) {
    const streak = new THREE.Mesh(new THREE.PlaneGeometry(0.025, to - from).rotateX(-Math.PI / 2), solid(INK.hot, 0.55, 5).m);
    streak.position.set(off * (1 - 0.4 * (from - 0.5)), 0.035, (from + to) / 2 - 0.5);
    streak.renderOrder = 5;
    g.add(streak);
  }
  return g;
}

const disc = (r: number, color: number, opacity: number, y: number, order: number) =>
  put(new THREE.CircleGeometry(r, 40).rotateX(-Math.PI / 2), solid(color, opacity, order), y);
const ring = (r0: number, r1: number, color: number, opacity: number, y: number, order: number) =>
  put(new THREE.RingGeometry(r0, r1, 56).rotateX(-Math.PI / 2), solid(color, opacity, order), y);

/** A vermilion square seal flat on the ground, a pale border, a carved cross. */
function sealGlyph(size: number): THREE.Object3D {
  const g = new THREE.Group();
  const quad = (w: number, h: number, color: number, y: number, order: number) =>
    put(new THREE.PlaneGeometry(w, h).rotateX(-Math.PI / 2), solid(color, 1, order), y);
  g.add(quad(size, size, INK.foil, 0.045, 6));
  g.add(quad(size * 0.84, size * 0.84, INK.accent, 0.05, 7));
  g.add(quad(size * 0.4, size * 0.07, INK.foil, 0.055, 8), quad(size * 0.07, size * 0.4, INK.foil, 0.055, 8));
  g.rotation.y = 0.35;
  return g;
}

/** A seal still drying: a pale ring at the edge, a faint dark disc, the pale square (not yet vermilion). It has no teeth for 0.5 s. */
function sealWetLook(): THREE.Object3D {
  const g = new THREE.Group();
  g.add(disc(SEAL_R, INK.dark, 0.4, 0.015, 2), ring(SEAL_R - 0.07, SEAL_R, INK.foil, 0.7, 0.025, 3), ring(SEAL_R - 0.2, SEAL_R - 0.17, INK.hot, 0.4, 0.026, 3));
  const sq = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.7).rotateX(-Math.PI / 2), solid(INK.foil, 0.35, 6).m);
  sq.position.y = 0.045;
  sq.rotation.y = 0.35;
  sq.renderOrder = 6;
  g.add(sq);
  return g;
}

/** An armed seal: a dark disc, a thick vermilion ring at the 2 m edge, a pale ring inside it, the vermilion seal in the middle. */
function sealLook(): THREE.Object3D {
  const g = new THREE.Group();
  g.add(disc(SEAL_R, INK.dark, 0.6, 0.015, 2), ring(SEAL_R - 0.13, SEAL_R, INK.accent, 0.95, 0.025, 3), ring(SEAL_R - 0.2, SEAL_R - 0.15, INK.foil, 0.8, 0.026, 3));
  g.add(sealGlyph(0.8));
  return g;
}

/** A seal used up: a vermilion ring and a pale flash. Built big, because it shrinks from 0.4 as it goes. */
function sealPopLook(): THREE.Object3D {
  const g = new THREE.Group();
  g.add(disc(2.6, INK.foil, 0.5, 0.03, 4), ring(2.2, 2.6, INK.accent, 0.9, 0.04, 5));
  return g;
}

/** The crossing's glowing point while it burns down: a pale core, an indigo halo, a thin ring at the burst's reach. */
function crossingLook(hot: boolean): () => THREE.Object3D {
  return () => {
    const g = new THREE.Group();
    g.add(ring(CROSS_R - 0.04, CROSS_R, hot ? INK.core : INK.hot, hot ? 0.9 : 0.5, 0.02, 3));
    g.add(disc(hot ? 0.9 : 0.6, INK.body, hot ? 0.55 : 0.4, 0.03, 4));
    g.add(disc(hot ? 0.5 : 0.34, INK.hot, 0.95, 0.04, 5));
    g.add(disc(hot ? 0.3 : 0.18, INK.core, 1, 0.05, 6));
    return g;
  };
}

/** The burst: a pale flash across the 1.5 m reach with an indigo ring. It is fixed at full size and the mark fades it. */
function burstLook(): THREE.Object3D {
  const g = new THREE.Group();
  g.add(disc(CROSS_R, INK.hot, 0.45, 0.03, 4), ring(CROSS_R - 0.2, CROSS_R, INK.body, 0.95, 0.04, 5), disc(0.6, INK.core, 0.95, 0.05, 6));
  return g;
}

export const inkTrait: Trait = {
  meter: { name: 'INK', max: 4, value: (t) => strokesOf(t.self()).length },
  passive: {
    name: 'Wet Ink',
    blurb: 'Her strokes stay on the ground for 5 s. An enemy on wet ink is slowed and Stained (+20% damage from her). Where two strokes cross, a point glows and 0.65 s later bursts for 40 within 1.5 m, and takes 1 s off Ink Lash.',
  },
  twist: { name: 'Where do they cross?', blurb: 'Paint now for the damage, or paint to set up a crossing: a new stroke over an old one, or over an armed seal.' },
  speed: 4.1,
  attack: { kind: 'ranged', range: 6, damage: 10, interval: 1, windup: 0.25, speed: 18, look: 'ink' },
  markLook: {
    stroke: strokeLook, sealWet: sealWetLook, seal: sealLook, sealPop: sealPopLook,
    cross: crossingLook(false), crossHot: crossingLook(true), burst: burstLook,
  },
  // Both screens, every frame: writes the clock, arms the seals (a seal that arms is a new stroke for crossings), draws it all.
  marks(t) {
    const fig = t.self();
    const now = t.time;
    syncClock(fig, now);
    prune(fig, now);
    const b = boards.get(fig);
    if (!b) return [];
    for (const s of b.seals) {
      if (s.checked || now < s.armedAt) continue;
      s.checked = true;
      for (const o of b.strokes) {
        if (!armed(o, now)) continue;
        const p = meet(s.x - SEAL_HALF, s.z, s.x + SEAL_HALF, s.z, o.ax, o.az, o.bx, o.bz);
        if (p) addCrossing(b, p.x, p.z, now);
      }
    }
    const out: GroundMark[] = [];
    for (const s of b.strokes) {
      const len = Math.hypot(s.bx - s.ax, s.bz - s.az);
      out.push({ x: (s.ax + s.bx) / 2, z: (s.az + s.bz) / 2, kind: 'stroke', yaw: Math.atan2(s.bx - s.ax, s.bz - s.az), length: len, age: now - s.born, life: STROKE_LIFE });
    }
    for (const s of b.seals) out.push({ x: s.x, z: s.z, kind: now >= s.armedAt ? 'seal' : 'sealWet', age: now - s.born, life: SEAL_LIFE });
    for (const p of b.pops) out.push({ x: p.x, z: p.z, kind: 'sealPop', age: 0, life: 0.4 - (now - p.at) });
    for (const c of b.crossings) {
      const a = now - c.at;
      if (a < CROSS_FUSE) out.push({ x: c.x, z: c.z, kind: a < CROSS_FUSE - 0.2 ? 'cross' : 'crossHot', age: a, life: a + 5 });
      else out.push({ x: c.x, z: c.z, kind: 'burst', age: 1, life: 2 - (a - CROSS_FUSE) / BURST_LIFE });
    }
    return out;
  },
  // The victim's screen: Wet Ink, the seals and the crossings' bursts.
  victimTick(t, dt) {
    const fig = t.self();
    const foe = t.enemy();
    const b = boards.get(fig);
    t.mem.wetT = (t.mem.wetT ?? 0) - dt;
    if (!foe || !b) return;
    const now = t.time;
    const p = foe.group.position;
    let wet = false;
    for (const s of b.strokes) {
      if (armed(s, now) && now - s.born < STROKE_LIFE && segPointDist(s.ax, s.az, s.bx, s.bz, p.x, p.z) <= WET_R) { wet = true; break; }
    }
    if (wet && t.mem.wetT <= 0) {
      t.mem.wetT = WET_TICK;
      t.hitEnemy({ damage: 0, knock: 0, status: { kind: 'slow', seconds: 0.6 } });
      t.addStacks('stain', 1, 1, 1);
    }
    for (const s of b.seals.slice()) {
      if (!armed(s, now) || now - s.born >= SEAL_LIFE || Math.hypot(p.x - s.x, p.z - s.z) > SEAL_R) continue;
      t.hitEnemy({ damage: 0, knock: 0, status: { kind: 'root', seconds: 1 } });
      t.addStacks('stain', 1, 1, 1);
      useSeal(fig, s.id);
      t.noteOwner('seal', s.id);
    }
    for (const c of b.crossings) {
      if (c.fired || now < c.at + CROSS_FUSE) continue;
      c.fired = true;
      if (Math.hypot(p.x - c.x, p.z - c.z) <= CROSS_R) t.hitEnemy({ damage: CROSS_DAMAGE, knock: 0 });
      t.noteOwner('crossing', 1);
    }
  },
  // Where the hit is decided: her hits on a Stained enemy deal +20% (not a passive's zero-damage hits).
  dealt(t, hit) {
    if (hit.kind === 'trait' || !hit.victimIsHero || !(hit.damage > 0)) return;
    if (t.stacks('stain') > 0) hit.damage = Math.round(hit.damage * 1.2);
  },
  // Her own client: a seal used up, and the refund a crossing's burst gives Ink Lash.
  peerNote(t, name, n) {
    if (name === 'seal') useSeal(t.self(), n);
    else if (name === 'crossing') t.setCooldown(0, Math.max(0, t.cooldownLeft(0) - 1));
  },
  badge(t) {
    const n = strokesOf(t.self()).length;
    return n > 0 ? String(n) : '';
  },
};

addGroundWiper((owner, x, z, r) => {
  const b = boards.get(owner);
  if (b) b.strokes = b.strokes.filter((s) => segDist(x, z, x, z, s.ax, s.az, s.bx, s.bz) > r);
});
