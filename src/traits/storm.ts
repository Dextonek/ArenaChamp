import { addGroundWiper } from './ground';
import * as THREE from 'three';
import { STORM, STORM_CSS } from '../effects/parts/storm';
import type { GroundMark, Trait, TraitHit, TraitView } from './types';

/**
 * Where Kaia's Ball Lightning is, keyed by her figure. The effect (`src/spells/targeted/ballLightning.ts`) writes the
 * orb's position every frame while it flies and hovers (`hit`: it ended on an enemy, so she lands short of it); the
 * old blink recast read it. Kept because the old spell file still imports it (the VFX tool lists the old spells).
 */
export interface StormOrb { x: number; z: number; hit: boolean; taken: boolean; fromX: number; fromZ: number }
export const stormOrbs = new WeakMap<object, StormOrb>();

/** Thunderlance damage scale: x0.6 uncharged to x1.5 fully charged (old spell, still imported by its file). */
export const LANCE_MIN = 0.6;
export const LANCE_MAX = 1.5;

/** Rods: at most this many at once, how long a rod stands (round seconds), a great rod (Thunder Rod) and the arc / ground ranges (m). */
export const ROD_MAX = 3;
export const ROD_LIFE = 6;
export const GREAT_LIFE = 3;
export const ARC_RANGE = 5;
export const ARC_DAMAGE = 18;
/** Touching a rod grounds it. Just under 1 m, because Polarity's pull stops the enemy exactly 1.0 m short of a rod. */
export const GROUND_RANGE = 0.99;
/** The ring a rod shows when the enemy is within RING_SHOW of it, and how many seconds an arc / a fizz is drawn. */
export const RING_R = 5;
export const RING_SHOW = 7;
const ARC_SHOW = 0.7;
const FIZZ_SHOW = 0.5;
/** Supercell's length. */
export const STORM_SECONDS = 6;

/** One rod. `id` is a small integer (0-19) so it fits the 'rodgone' note; `born` and `life` are in round seconds. */
export interface Rod {
  id: number; x: number; z: number; born: number; life: number; great: boolean;
  /** Can the enemy ground it now? False while they still stand where it landed on them; set by `victimTick`. */
  touchable?: boolean;
}

interface StormFx { kind: 'arc' | 'fizz'; x: number; z: number; yaw: number; length: number; born: number; life: number }

/**
 * What Kaia's spells and her trait share, per figure (the effects play on both screens). `now` is the round clock the
 * trait writes every frame from `marks` (which runs on both screens), so an effect can stamp a rod's `born`. `rods` is the
 * list both screens keep equal: a spell that lands adds a rod (`addRod`), `dealt` / `victimTick` / `peerNote` remove it
 * (`removeRod`, harmless twice). `w` is Thunder Rod's great rod for its recast.
 */
export interface StormState {
  now: number;
  next: number;
  rods: Rod[];
  fx: StormFx[];
  w: { id: number; x: number; z: number } | null;
}
export const stormStates = new WeakMap<object, StormState>();

export function stormOf(fig: object): StormState {
  let s = stormStates.get(fig);
  if (!s) { s = { now: 0, next: 0, rods: [], fx: [], w: null }; stormStates.set(fig, s); }
  return s;
}

/**
 * Plants a rod at (x, z) now (call it from the spell effect at the moment it lands, on both screens). More than ROD_MAX:
 * the oldest goes. A great rod stands GREAT_LIFE seconds, a plain one ROD_LIFE.
 */
export function addRod(fig: object, x: number, z: number, great = false): Rod {
  const s = stormOf(fig);
  const id = s.next;
  s.next = (s.next + 1) % 20;
  const old = s.rods.findIndex((r) => r.id === id);
  if (old >= 0) s.rods.splice(old, 1);
  const rod: Rod = { id, x, z, born: s.now, life: great ? GREAT_LIFE : ROD_LIFE, great };
  s.rods.push(rod);
  while (s.rods.length > ROD_MAX) s.rods.shift();
  return rod;
}

/** Removes rod `id`; returns it, or undefined when it was already gone (so removing twice is harmless). */
export function removeRod(fig: object, id: number): Rod | undefined {
  const s = stormOf(fig);
  const i = s.rods.findIndex((r) => r.id === id);
  if (i < 0) return undefined;
  return s.rods.splice(i, 1)[0];
}

/** The rod nearest to (x, z) within `within` metres, or undefined. */
export function nearestRod(fig: object, x: number, z: number, within = Infinity): Rod | undefined {
  let best: Rod | undefined, bd = within;
  for (const r of stormOf(fig).rods) {
    const d = Math.hypot(r.x - x, r.z - z);
    if (d <= bd) { bd = d; best = r; }
  }
  return best;
}

/** A short bolt or fizz for `marks` to draw (both screens): from (x, z) toward (tx, tz). */
function pushFx(s: StormState, kind: 'arc' | 'fizz', x: number, z: number, tx: number, tz: number) {
  s.fx.push({ kind, x, z, yaw: Math.atan2(tx - x, tz - z), length: Math.max(0.1, Math.hypot(tx - x, tz - z)), born: s.now, life: kind === 'arc' ? ARC_SHOW : FIZZ_SHOW });
  if (s.fx.length > 12) s.fx.shift();
}

/** The rod's mark kinds (`markLook`): a lightning rod on the ground, a great one, the faint 5 m ring, an arc, a fizz. */
const mat = (color: number, opacity = 1) => new THREE.MeshBasicMaterial({ color, transparent: opacity < 1, opacity, depthWrite: opacity >= 1 });
const glowMat = (color: number, opacity: number) =>
  new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending });

function rodLook(h: number, r: number): THREE.Object3D {
  const g = new THREE.Group();
  // A dark wet patch with a pale ring under the foot.
  const patch = new THREE.Mesh(new THREE.CircleGeometry(r * 4.4, 20).rotateX(-Math.PI / 2), mat(STORM.dark, 0.55));
  patch.material.depthWrite = false;
  patch.position.y = 0.01;
  const foot = new THREE.Mesh(new THREE.RingGeometry(r * 3.6, r * 4.2, 24).rotateX(-Math.PI / 2), mat(STORM.rain, 0.85));
  foot.material.depthWrite = false;
  foot.position.y = 0.02;
  g.add(patch, foot);
  // The pole: a dark collar, a pale shaft, a bright spike, two prongs and a glowing tip.
  const base = new THREE.Mesh(new THREE.CylinderGeometry(r * 1.9, r * 2.4, h * 0.12, 10), mat(0x1d2a40));
  base.position.y = h * 0.06;
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.9, r * 1.3, h, 8), mat(STORM.rain));
  shaft.position.y = h * 0.5;
  const outline = new THREE.Mesh(new THREE.CylinderGeometry(r * 1.2, r * 1.65, h, 8), mat(STORM.dark));
  outline.position.y = h * 0.5;
  outline.scale.set(1, 1.004, 1);
  const spike = new THREE.Mesh(new THREE.ConeGeometry(r * 0.9, h * 0.22, 8), mat(STORM.hot));
  spike.position.y = h + h * 0.11;
  g.add(outline, base, shaft, spike);
  for (const s of [-1, 1]) {
    const prong = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.25, r * 0.45, h * 0.3, 6), mat(STORM.rain));
    prong.position.set(s * r * 1.5, h * 0.8, 0);
    prong.rotation.z = -s * 0.5;
    g.add(prong);
  }
  const tip = new THREE.Mesh(new THREE.SphereGeometry(r * 1.5, 12, 10), mat(STORM.core));
  tip.position.y = h * 1.24;
  const halo = new THREE.Mesh(new THREE.SphereGeometry(r * 3.2, 12, 10), glowMat(STORM.body, 0.3));
  halo.position.y = h * 1.24;
  g.add(tip, halo);
  return g;
}

function ringLook(): THREE.Object3D {
  const g = new THREE.Group();
  const edge = new THREE.Mesh(new THREE.RingGeometry(RING_R - 0.07, RING_R, 64).rotateX(-Math.PI / 2), glowMat(STORM.body, 0.4));
  edge.position.y = 0.03;
  const fill = new THREE.Mesh(new THREE.CircleGeometry(RING_R, 48).rotateX(-Math.PI / 2), glowMat(STORM.body, 0.05));
  fill.position.y = 0.025;
  g.add(edge, fill);
  return g;
}

/** A jagged bolt along +z, 1 m long, falling from rod-top height at z 0 to chest height at z 1 (the mark scales it). */
function arcLook(): THREE.Object3D {
  const g = new THREE.Group();
  const n = 9;
  const pts: THREE.Vector3[] = [];
  for (let i = 0; i <= n; i++) {
    const u = i / n, j = i === 0 || i === n ? 0 : ((i * 37) % 7 - 3) * 0.018;
    pts.push(new THREE.Vector3(j, 2.6 - 1.6 * u + (i % 2 ? 0.05 : -0.05) * (i === 0 || i === n ? 0 : 1), u));
  }
  for (const [col, w] of [[STORM.dark, 0.34], [STORM.body, 0.2], [STORM.core, 0.08]] as const) {
    for (let i = 0; i < n; i++) {
      const a = pts[i], b = pts[i + 1], d = new THREE.Vector3().subVectors(b, a), len = d.length();
      const seg = new THREE.Mesh(new THREE.BoxGeometry(w, w, len * 1.08), mat(col));
      seg.position.copy(a).addScaledVector(d, 0.5);
      seg.lookAt(b.clone().add(seg.position).sub(a));
      g.add(seg);
    }
  }
  return g;
}

function fizzLook(): THREE.Object3D {
  const g = new THREE.Group();
  for (let i = 0; i < 6; i++) {
    const s = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.6, 5), mat(i % 2 ? STORM.accent : STORM.core));
    const a = (i / 6) * Math.PI * 2;
    s.position.set(Math.cos(a) * 0.3, 0.3, Math.sin(a) * 0.3);
    s.rotation.set(Math.sin(a) * 0.9, 0, -Math.cos(a) * 0.9);
    g.add(s);
  }
  g.add(new THREE.Mesh(new THREE.RingGeometry(0.35, 0.5, 16).rotateX(-Math.PI / 2), glowMat(STORM.accent, 0.6)));
  return g;
}

const own = (t: TraitView) => t.time < (t.mem.stormUntil ?? 0);

/**
 * Kaia (mage). Passive Lightning Rods: her spells plant rods where they land (Sky Strike's rod, Thunder Rod's great rod): 3 at
 * most (the oldest goes), each 6 s of round time (a great rod 3 s). When a spell of hers damages the enemy, every rod within
 * 5 m of them arcs to them for 18 and is used up (`dealt`, the screen that decides the hit). An enemy that comes within 1 m of
 * a rod grounds it (`victimTick`): it fizzles. Both screens keep the same list in `stormOf(figure).rods`: the screen that
 * removes a rod tells the other with `noteOwner('rodgone' | 'rodfizz', id)` (`peerNote` removes it there; removing twice is
 * harmless). Rods are drawn by `marks` / `markLook`: a lightning rod on the ground and, when the enemy is within 7 m of it, a
 * faint 5 m ring. The great rod is not used up by its own Thunder Rod hits (slot 1), or its first tick would end it.
 * W Thunder Rod can be recast from 1.2 s (Discharge, told apart by the effect). E Polarity's pull and stun are the effect's.
 * R Supercell is a 6 s storm, shown as 'storm' (a pip over her) while it runs.
 */
export const stormTrait: Trait = {
  meter: { name: 'RODS', max: ROD_MAX, value: (t) => stormOf(t.self()).rods.length },
  passive: {
    name: 'Lightning Rods',
    blurb: 'Her spells plant rods where they land (3 at most, 6 s). When a spell of hers hurts the enemy, every rod within 5 m of them arcs for 18 and is used up. An enemy within 1 m of a rod grounds it.',
  },
  attack: { kind: 'ranged', range: 6, damage: 10, interval: 1.0, windup: 0.25, speed: 18, look: 'spark' },
  recast: { slot: 1, window: 3, arm: 1.2, name: 'Discharge', power: 1, replay: true },
  ownLook: {
    storm: { color: '#ffe36a', shape: 'gem' },
  },
  // The CPU against her walks to a rod that is close, to ground it.
  enemyGoal(t) {
    const e = t.enemy();
    if (!e) return null;
    const p = e.group.position;
    const r = nearestRod(t.self(), p.x, p.z, 3);
    return r ? { x: r.x, z: r.z } : null;
  },
  // The CPU playing her keeps R until the enemy is in its reach (7 m, or a rod that is within 3 m of them).
  aiHold(t, slot, dist) {
    if (slot !== 3) return false;
    const e = t.enemy();
    if (!e) return true;
    const p = e.group.position;
    return dist > 6.8 && !nearestRod(t.self(), p.x, p.z, 2.8);
  },
  afterCast(t, slot) {
    if (slot === 3) {
      t.mem.stormUntil = t.time + STORM_SECONDS;
      t.show('storm', 1);
    }
  },
  tick(t) {
    if (t.mem.stormUntil && !own(t)) {
      t.mem.stormUntil = 0;
      t.show('storm', 0);
    }
  },
  dealt(t, hit: TraitHit) {
    // A spell that damages the hero. 'trait' is her own arc, 'attack' and 'unit' do not arc.
    if (hit.kind !== 'spell' || !hit.victimIsHero) return;
    if (hit.slot === 2 && hit.damage > 0) t.addStacks('magnet', 1, 1, 1);
    if (hit.damage <= 0) return;
    const s = stormOf(t.self());
    const v = hit.victim.group.position;
    for (const r of [...s.rods]) {
      if (r.great && hit.slot === 1) continue;
      if (Math.hypot(r.x - v.x, r.z - v.z) > ARC_RANGE) continue;
      if (!removeRod(t.self(), r.id)) continue;
      t.hitEnemy({ damage: ARC_DAMAGE, knock: 0, color: STORM_CSS.body });
      t.noteOwner('rodgone', r.id);
      pushFx(s, 'arc', r.x, r.z, v.x, v.z);
    }
  },
  victimTick(t) {
    const e = t.enemy();
    if (!e) return;
    const s = stormOf(t.self());
    const p = e.group.position;
    for (const r of [...s.rods]) {
      const near = Math.hypot(r.x - p.x, r.z - p.z) < GROUND_RANGE;
      // A rod that lands on them is not a touch (or a rod aimed at them would always fizzle): they step off, then back on.
      if (r.touchable === undefined) r.touchable = !near;
      if (!near) { r.touchable = true; continue; }
      if (!r.touchable) continue;
      if (!removeRod(t.self(), r.id)) continue;
      t.noteOwner('rodfizz', r.id);
      pushFx(s, 'fizz', r.x, r.z, r.x, r.z + 0.1);
    }
  },
  peerNote(t, name, n) {
    if (name !== 'rodgone' && name !== 'rodfizz') return;
    const r = removeRod(t.self(), n);
    if (!r) return;
    const e = t.enemy();
    const s = stormOf(t.self());
    if (name === 'rodgone' && e) pushFx(s, 'arc', r.x, r.z, e.group.position.x, e.group.position.z);
    else pushFx(s, 'fizz', r.x, r.z, r.x, r.z + 0.1);
  },
  marks(t) {
    const s = stormOf(t.self());
    // A new round restarts the clock: last round's rods are gone.
    if (t.time < s.now - 0.5) { s.rods.length = 0; s.fx.length = 0; s.w = null; }
    s.now = t.time;
    for (let i = s.rods.length - 1; i >= 0; i--) if (s.now - s.rods[i].born >= s.rods[i].life) s.rods.splice(i, 1);
    for (let i = s.fx.length - 1; i >= 0; i--) if (s.now - s.fx[i].born >= s.fx[i].life) s.fx.splice(i, 1);
    const out: GroundMark[] = [];
    const e = t.enemy();
    for (const r of s.rods) {
      const age = s.now - r.born;
      out.push({ x: r.x, z: r.z, kind: r.great ? 'great' : 'rod', age, life: r.life });
      if (e && Math.hypot(e.group.position.x - r.x, e.group.position.z - r.z) <= RING_SHOW) out.push({ x: r.x, z: r.z, kind: 'rodring', age, life: r.life });
    }
    for (const f of s.fx) out.push({ x: f.x, z: f.z, kind: f.kind, age: s.now - f.born, life: f.life, yaw: f.yaw, length: f.kind === 'arc' ? f.length : undefined });
    return out;
  },
  markLook: {
    rod: () => rodLook(2.7, 0.09),
    great: () => rodLook(4.4, 0.15),
    rodring: ringLook,
    arc: arcLook,
    fizz: fizzLook,
  },
  badge: (t) => `${stormOf(t.self()).rods.length}/${ROD_MAX}`,
};

addGroundWiper((owner, x, z, r) => {
  const s = stormStates.get(owner);
  if (s) s.rods = s.rods.filter((rod) => Math.hypot(rod.x - x, rod.z - z) > r);
});
