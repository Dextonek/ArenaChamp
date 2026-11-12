import * as THREE from 'three';
import { RAID_BOSSES } from '../../server/protocol.mjs';
import { pillar, type Obstacle } from '../obstacles';
import { lavaTexture } from './caldera';
import { PIT_STAGE } from './cinderpit';
import { buildPillars } from './cinderPillars';
import { RING, canvasTexture, disposeTree, seeded } from './common';
import layout from './real/twinforge.json';
import { Glows, realProps, type RealLayout } from './real';
import type { ArenaDef, WallState } from './types';

/**
 * The Twin Forge: Ash and Ember's boss room for a party, Twin Flames (pipeline/designs/raid-party.md). Not a ring: two halls side
 * by side under one roofless forge, cut into dark stone, a channel of flame between them from the north wall to the gate. Ash
 * fights in the west hall, among his pillars, Ember in the east, over her vents; the party comes in through the gate in the south,
 * each half on its own side of the channel. Built in blender/arenas/real/twinforge.py (clean forms, the heroes' materials, gold
 * on the edges, lantern light as the only glow), which also writes the plan (`real/twinforge.json`: the halls, the gate, the lava
 * channels, the bridges, the thresholds, the last island, and where the two of them, the pillars and the vents are).
 *
 * The game's floor is still a ring (`TWIN_R`: the hub and the walk keep heroes inside it); the forge's shape is its own walls,
 * obstacles that never break (`Obstacle.fixed`). The wall of fire is one more: it stops walking, sight and bolts until the pit
 * floods, or one of the two falls, and it goes out (`wallState`).
 *
 * The room changes twice (user, 2026-11-12: "when there will be second stage the arena will transform"), and `forge` is its state:
 * - **The floor cracks into islands** (each half when its own twin's second phase begins): lava channels open, and bridges of cooled
 *   crust over them stand in turn. Each glows before it sinks; Ash's Charge shatters one it crosses.
 * - **The pit floods** (when the first of the two reaches its last phase): the wall of fire goes out and lava rises from the walls
 *   inward to one last island in the middle.
 * Only the twins' casts change `forge` (src/raid/twinForge.ts), at a time counted from the cast, so every screen has the same room;
 * what the lava does to a hero is asked here (`lavaAt`), not in a boss's script: it burns whichever of the two still lives.
 */
interface ForgeLayout extends RealLayout {
  forge: {
    hx: number; hn: number; hs: number; chan: number; gx: number; gs: number; lava: number;
    gates: number[]; gateHalf: number; isle: { hx: number; hz: number };
    hold: { x: number; z: number }[]; pillars: number[][]; vents: number[][]; slag: number[][]; ventR: number; greatVentR: number;
    channels: { half: number; ax: number; az: number; bx: number; bz: number; r: number }[];
    bridges: { name: string; half: number; channel: number; adj: number; turn: number; alone: boolean; x: number; z: number; yaw: number; w: number; len: number }[];
  };
}
const LAYOUT = layout as ForgeLayout, F = LAYOUT.forge;

export const TWIN_R = RAID_BOSSES.ash.partyRing ?? 38;
const C = { x: RING.x, z: RING.z };
export const TWIN_LAYOUT = {
  /** How far the floor reaches (m): the hub clamps walks to it (`raidRing`). */
  ring: TWIN_R,
  /** The forge: half its width, how far it reaches north and south of the middle (m). The gate's passage: half its width, how far south it ends. */
  hx: F.hx, hn: F.hn, hs: F.hs, gx: F.gx, gs: F.gs,
  /** The wall of fire: along x = 0 from the north wall to the gate, this thick each side of the line (m), and how tall its flames are. */
  wallHalf: F.chan,
  wallHeight: 4.2,
  /** Where each of them starts and waits out its Eruption: Ash in the middle of his pillars, Ember over her great vent. */
  hold: F.hold,
  /** Heroes come in through the gate, either side of the wall: rows of this many, this far from the wall and from each other. */
  rowOf: 4,
  rowFrom: 3,
  rowGap: 1.4,
  /** How far inside the ring the first row stands (m): in the gate's passage. */
  rowIn: 6.5,
  /** Ash's pillars, in the order they are added as the party grows: the first four stand round him as the pit's four do. */
  pillars: F.pillars,
  pillarR: 1.15,
  /** Ember's vents: her great one (her Eruption, her wave, the one to seal) is `hold[1]`; these are the small ones round it. */
  vents: F.vents,
  /** Ash's half has vents too, cold until Seal the Vents: slag vents. */
  slag: F.slag,
  ventR: F.ventR,
  greatVentR: F.greatVentR,
  /** The thresholds across the channel of flame, where the gates open for The Changing of the Flames (z), and half their width. */
  gates: F.gates,
  gateHalf: F.gateHalf,
  /** The last island, when the pit has flooded: half its width and half its length (m), round the middle. */
  isle: F.isle,
};

/** How many pillars Ash's half has for a party tuned for `band`: four, and one more for every three heroes of his half. */
export const twinPillarCount = (band: number) => Math.min(TWIN_LAYOUT.pillars.length, 4 + Math.ceil(band / 2 / 3));

/** The wall of fire, as the game sees it. */
export const TWIN_WALL: Obstacle = {
  ax: C.x, az: C.z + TWIN_R + 1, bx: C.x, bz: C.z - TWIN_R - 1, r: TWIN_LAYOUT.wallHalf, height: TWIN_LAYOUT.wallHeight, kind: 'wall', fixed: true,
};
/** Ash's pillars standing in this fight's room (`setTwinBand`), and the room's whole cover: the wall of fire first, the pillars, then the forge's own walls. */
export const TWIN_PILLARS: Obstacle[] = [];
/** The forge's own walls, and the two great pieces before the hearths (his anvil, her brazier): none of them ever breaks. */
export const TWIN_WALLS: readonly Obstacle[] = LAYOUT.obstacles;
const COVER: Obstacle[] = [TWIN_WALL];

/** Where hero number `n` of a half (0 west, 1 east) comes in. */
export function twinHeroStart(half: number, n: number) {
  const L = TWIN_LAYOUT, col = n % L.rowOf, row = Math.floor(n / L.rowOf);
  return { x: (half ? 1 : -1) * (L.rowFrom + col * L.rowGap), z: C.z + TWIN_R - L.rowIn - row * L.rowGap };
}

let bandNow = 0;
/** Sets the room for a party tuned for `band`, before it is built. Returns whether it changed. */
export function setTwinBand(band: number) {
  if (band === bandNow) return false;
  bandNow = band;
  TWIN_PILLARS.length = 0;
  for (const [x, z] of TWIN_LAYOUT.pillars.slice(0, twinPillarCount(band))) TWIN_PILLARS.push({ ...pillar(x, z, TWIN_LAYOUT.pillarR), height: 3.3 });
  COVER.length = 0;
  COVER.push(TWIN_WALL, ...TWIN_PILLARS, ...TWIN_WALLS);
  return true;
}
setTwinBand(10);

// --- the forge's shape ----------------------------------------------------------------------------------------------------

/** Whether (x, z) is on the forge's floor, `pad` m inside its walls: the two halls and the gate's passage. */
export function inForge(x: number, z: number, pad = 0) {
  const dx = Math.abs(x - C.x), dz = z - C.z;
  if (dx <= F.hx - pad && dz >= -(F.hn - pad) && dz <= F.hs - pad) return true;
  return dx <= F.gx - pad && dz >= F.hs - pad && dz <= F.gs - pad;
}

/** How far from (x, z) along yaw `dir` the forge's floor goes (m), `pad` m short of its walls. */
export function forgeReach(x: number, z: number, dir: number, pad = 0) {
  const dx = Math.sin(dir), dz = Math.cos(dir);
  let far = 0;
  while (far < 90 && inForge(x + dx * (far + 0.25), z + dz * (far + 0.25), pad)) far += 0.25;
  return far;
}

// --- the room's state: islands, bridges, the flood --------------------------------------------------------------------------

/**
 * The room's numbers.
 * - `warn`: the floor cracks for this long before the lava opens (s). `burn`: what a second in a channel costs, of max HP.
 * - A bridge stands `stand` s; `glow`: it glows for its last seconds; the other of its pair has stood for `overlap` s by the time it
 *   sinks, so two islands that touch always have a way between them. A bridge with no other is away `stand - 2 * overlap` s.
 * - `shards`: a bridge Ash's Charge shatters is gone until its next turn.
 * - The flood: it shows along the walls for `floodWarn` s, then rises `floodRate` m a second, from the walls to the last island
 *   (16 m: just under two minutes); `floodBurn` a second in it. `corner`: how round the dry floor's corners are (m).
 */
export const FORGE = { warn: 5, burn: 0.07, stand: 16, glow: 4, overlap: 3, floodWarn: 6, floodRate: 0.145, floodBurn: 0.08, corner: 5 };
const CYCLE = 2 * (FORGE.stand - FORGE.overlap);
/** How far the lava comes at most: to the last island. */
const INSET_MOST = Math.min(F.hx - F.isle.hx, F.hn - F.isle.hz);

interface Bridge {
  /** Its place in the plan, and the object's name in the room's file. */
  i: number;
  name: string;
  half: number;
  x: number;
  z: number;
  yaw: number;
  /** Along its channel: where it is (m from the channel's start) and half its width; across: half its length. */
  at: number;
  w: number;
  len: number;
  channel: number;
  adj: number;
  turn: number;
  alone: boolean;
}
interface Channel {
  half: number;
  ax: number;
  az: number;
  ux: number;
  uz: number;
  length: number;
  r: number;
  /** Its lava as capsules: the stretches between its bridges, which always burn, and one under each bridge, which burns when that bridge is down. */
  runs: Obstacle[];
  spans: { bridge: number; o: Obstacle }[];
}

const BRIDGES: Bridge[] = [];
const CHANNELS: Channel[] = F.channels.map((c) => {
  const length = Math.hypot(c.bx - c.ax, c.bz - c.az);
  return { half: c.half, ax: c.ax, az: c.az, ux: (c.bx - c.ax) / length, uz: (c.bz - c.az) / length, length, r: c.r, runs: [], spans: [] };
});
F.bridges.forEach((b, i) => {
  const ch = CHANNELS[b.channel];
  BRIDGES.push({ i, name: b.name, half: b.half, x: b.x, z: b.z, yaw: b.yaw, at: (b.x - ch.ax) * ch.ux + (b.z - ch.az) * ch.uz, w: b.w / 2, len: b.len / 2, channel: b.channel, adj: b.adj, turn: b.turn, alone: b.alone });
});
for (const [ci, ch] of CHANNELS.entries()) {
  const lava = (from: number, to: number): Obstacle => ({ kind: 'wall', ax: ch.ax + ch.ux * from, az: ch.az + ch.uz * from, bx: ch.ax + ch.ux * to, bz: ch.az + ch.uz * to, r: ch.r, height: 0 });
  const mine = BRIDGES.filter((b) => b.channel === ci).sort((a, b) => a.at - b.at);
  // A stretch ends its own half width short of a bridge: its round end then reaches the bridge's edge and no further.
  let from = 0;
  for (const b of mine) {
    const to = b.at - b.w - ch.r;
    ch.runs.push(lava(from, Math.max(from, to)));
    ch.spans.push({ bridge: b.i, o: lava(b.at - b.w, b.at + b.w) });
    from = b.at + b.w + ch.r;
  }
  ch.runs.push(lava(Math.min(from, ch.length), ch.length));
}
/** The plan's bridges and channels, for what draws them and for the tools. */
export const TWIN_BRIDGES: readonly Bridge[] = BRIDGES;
export const TWIN_CHANNELS: readonly Channel[] = CHANNELS;

const capsuleDist = (o: Obstacle, x: number, z: number) => {
  const dx = o.bx - o.ax, dz = o.bz - o.az, len2 = dx * dx + dz * dz;
  const t = len2 > 0 ? Math.max(0, Math.min(1, ((x - o.ax) * dx + (z - o.az) * dz) / len2)) : 0;
  return Math.hypot(x - o.ax - dx * t, z - o.az - dz * t);
};

/**
 * The forge as this screen has it. Only the twins' casts change it (src/raid/twinForge.ts), so every screen has the same room at
 * the same moment of the fight; `reset` before each fight (`BossDef.resize`). `clock` runs with the room (`tick`).
 */
export const forge = {
  /**
   * The room's clock (s). It runs with the frames, and never behind real time: a screen that draws under 30 frames a second counts
   * short frames (the game caps a frame's time), and its bridges and its flood would fall behind every other screen's.
   */
  clock: 0,
  frames: 0,
  since: 0,
  /** When each half's lava opened or will open (the room's clock), or -1: it has not cracked. And the seed its bridges turn by. */
  cracked: [-1, -1],
  seeds: [0, 0],
  /** When each bridge was last shattered (the room's clock). */
  shattered: BRIDGES.map(() => -Infinity),
  /** When the flood began to rise or will (the room's clock), or -1; and how long sealed vents have held it back less what open ones sped it (s). */
  floodAt: -1,
  held: 0,
  /** The wall of fire is out for good: the pit floods. */
  get open() { return this.floodAt >= 0; },
  /** A new fight: the floor is whole and dry. */
  reset() {
    this.cracked = [-1, -1];
    this.seeds = [0, 0];
    this.shattered.fill(-Infinity);
    this.floodAt = -1;
    this.held = 0;
    this.clock = this.frames = 0;
    this.since = performance.now();
    coverKey = '';
    coverAt = NaN;
  },
  tick(dt: number) {
    this.frames += dt;
    this.clock = Math.max(this.clock, this.frames, (performance.now() - this.since) / 1000);
  },
  /** Half `half`'s floor cracks: its lava opens after `warn` s. Nothing, if it has cracked already. */
  crack(half: number, seed: number, warn = FORGE.warn) {
    if (this.cracked[half] >= 0) return false;
    this.cracked[half] = this.clock + warn;
    this.seeds[half] = seed;
    return true;
  },
  /** The pit floods: the lava shows along the walls, and rises after `warn` s. Nothing, if it floods already. */
  flood(warn = FORGE.floodWarn) {
    if (this.floodAt >= 0) return false;
    this.floodAt = this.clock + warn;
    this.held = 0;
    return true;
  },
  /** A sealed vent holds the flood back `seconds` (it draws back that much); an open one speeds it (`seconds` under 0). */
  hold(seconds: number) { this.held += seconds; },
  /** Bridge `i` is shattered: gone until its next turn. */
  shatter(i: number) { if (bridgeUp(i)) this.shattered[i] = this.clock; },
};

/** Where bridge `b` is in its turn: seconds since it last rose (it stands while this is under `FORGE.stand`), or -1 before its half cracked. */
function standing(b: Bridge, t: number) {
  const open = forge.cracked[b.half];
  if (open < 0 || t < open) return -1;
  // Each pair of islands turns by its own start, from the seed; the second of a pair rises half a turn after the first.
  const off = seeded(forge.seeds[b.half] + b.adj * 7919)() * CYCLE;
  return (((t - open + off - b.turn * (CYCLE / 2)) % CYCLE) + CYCLE) % CYCLE;
}

/** Whether bridge `i` stands now (or at the room's clock `t`). */
export function bridgeUp(i: number, t = forge.clock) {
  const b = BRIDGES[i], s = standing(b, t);
  return s >= 0 && s < FORGE.stand && forge.shattered[i] < t - s;
}

/** How near its end bridge `i` is, 0 (it has time) to 1 (it sinks now); 0 for one that is down. */
export function bridgeGlow(i: number, t = forge.clock) {
  if (!bridgeUp(i, t)) return 0;
  return Math.max(0, Math.min(1, (standing(BRIDGES[i], t) - (FORGE.stand - FORGE.glow)) / FORGE.glow));
}

/** How long bridge `i` has stood (s), or -1 when it is down: what draws it raises it over its first second. */
export function bridgeAge(i: number, t = forge.clock) {
  return bridgeUp(i, t) ? standing(BRIDGES[i], t) : -1;
}

/** The bridges standing now that a run from a to b, `width` m wide, crosses (Ash's Charge). */
export function bridgesCrossed(ax: number, az: number, bx: number, bz: number, width: number) {
  const out: number[] = [], len = Math.hypot(bx - ax, bz - az);
  for (const b of BRIDGES) {
    if (!bridgeUp(b.i)) continue;
    for (let d = 0; d <= len; d += 0.4) {
      const k = len > 0 ? d / len : 0;
      if (Math.hypot(ax + (bx - ax) * k - b.x, az + (bz - az) * k - b.z) > width / 2 + b.len) continue;
      out.push(b.i);
      break;
    }
  }
  return out;
}

/** How far the flood has come in from the walls (m): 0 while the floor is dry. */
export function floodInset(t = forge.clock) {
  if (forge.floodAt < 0) return 0;
  return Math.max(0, Math.min(INSET_MOST, FORGE.floodRate * (t - forge.floodAt - forge.held)));
}

/** How far (x, z) is inside the floor the flood has left dry (m; under 0: in the lava). The dry floor is the halls less `inset`, its corners round. */
function dryDepth(x: number, z: number, inset: number) {
  const k = FORGE.corner, qx = Math.abs(x - C.x) - (F.hx - inset - k), qz = Math.abs(z - C.z) - (F.hn - inset - k);
  return k - (Math.hypot(Math.max(qx, 0), Math.max(qz, 0)) + Math.min(Math.max(qx, qz), 0));
}

/** The lava channels burning now, as capsules: what an AI plans its walk round, and what `lavaAt` asks. The same objects from call to call. */
let coverKey = '', coverNow: Obstacle[] = [], coverAt = NaN;
export function forgeCover() {
  // Asked many times a frame (an AI trying spots): worked out once for each moment of the room's clock.
  if (forge.clock === coverAt) return coverNow;
  coverAt = forge.clock;
  let key = `${forge.cracked[0] >= 0 && forge.clock >= forge.cracked[0] ? 1 : 0}${forge.cracked[1] >= 0 && forge.clock >= forge.cracked[1] ? 1 : 0}`;
  if (key === '00') return (coverKey = key, coverNow = []);
  for (const b of BRIDGES) key += bridgeUp(b.i) ? '1' : '0';
  if (key === coverKey) return coverNow;
  coverKey = key;
  coverNow = [];
  for (const ch of CHANNELS) {
    if (key[ch.half] !== '1') continue;
    coverNow.push(...ch.runs);
    for (const s of ch.spans) if (!bridgeUp(s.bridge)) coverNow.push(s.o);
  }
  return coverNow;
}

/** What a second standing at (x, z) costs now, as a share of max HP: 0 on dry floor, a channel's lava, the flood's. */
export function lavaAt(x: number, z: number) {
  if (forge.floodAt >= 0 && forge.clock >= forge.floodAt && inForge(x, z) && dryDepth(x, z, floodInset()) < 0) return FORGE.floodBurn;
  for (const o of forgeCover()) if (capsuleDist(o, x, z) <= o.r) return FORGE.burn;
  return 0;
}

/** Whether an AI may stand at (x, z): `pad` m clear of every channel's lava, and of the flood (and of where it will be in two seconds). */
export function forgeSafe(x: number, z: number, pad = 0.45) {
  if (forge.floodAt >= 0 && dryDepth(x, z, floodInset(forge.clock + 2)) < pad + 0.4) return false;
  for (const o of forgeCover()) if (capsuleDist(o, x, z) <= o.r + pad) return false;
  return true;
}

/**
 * Where one of the two may walk to: (x, z) pulled back into its own hall, 2.6 m inside its walls and the channel, and never into the
 * gate's passage; once the pit floods, into the floor that is still dry, either hall.
 */
export function forgeRoam(half: number, x: number, z: number) {
  const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v)), pad = 2.6;
  if (forge.open) {
    const inset = floodInset() + pad;
    return { x: clamp(x, C.x - F.hx + inset, C.x + F.hx - inset), z: clamp(z, C.z - F.hn + inset, C.z + F.hn - inset) };
  }
  const s = half ? 1 : -1, x0 = C.x + s * (F.chan + pad), x1 = C.x + s * (F.hx - pad);
  return { x: clamp(x, Math.min(x0, x1), Math.max(x0, x1)), z: clamp(z, C.z - F.hn + pad, C.z + F.hs - pad) };
}

/** How far out from the middle an AI and a boss backing away may go once the pit floods (m), or 0 while it is dry. */
export function forgeBounds() {
  return forge.floodAt >= 0 && forge.clock >= forge.floodAt ? Math.min(F.hx, F.hn) - floodInset() - 0.8 : 0;
}

// --- how it looks ---------------------------------------------------------------------------------------------------------------

/** The floor's drawing covers this far each way from its own middle, which lies this far south of the room's (m). */
const SPAN = 34, SOUTH = 5;

/** The floor: black glass plates over the buried sun; Ash's half clawed and dark, Ember's lit from her vents; the gate's road, the seal of the two in the middle. */
function forgeFloor() {
  const size = 2048, ppm = size / (2 * SPAN), L = TWIN_LAYOUT;
  const rnd = seeded(717), plates: { pts: [number, number][]; tone: number }[] = [];
  for (let gy = -SPAN; gy <= SPAN; gy += 1.7) {
    for (let gx = -F.hx - 1; gx <= F.hx + 1; gx += 1.7) {
      const cx = gx + (rnd() - 0.5) * 0.8, cy = gy + (rnd() - 0.5) * 0.8, n = 6 + Math.floor(rnd() * 3), r = 1.08 + rnd() * 0.15, a0 = rnd() * 6.28;
      const pts = Array.from({ length: n }, (_, k): [number, number] => {
        const a = a0 + (k / n) * Math.PI * 2, rr = r * (0.88 + rnd() * 0.2);
        return [cx + Math.cos(a) * rr, cy + Math.sin(a) * rr];
      });
      plates.push({ pts, tone: rnd() });
    }
  }
  const path = (g: CanvasRenderingContext2D, pts: [number, number][]) => {
    g.beginPath();
    pts.forEach(([x, y], i) => (i ? g.lineTo(x * ppm, y * ppm) : g.moveTo(x * ppm, y * ppm)));
    g.closePath();
  };
  // The canvas's y runs south from its own middle: a spot (x, z) of the room is at (x, z - C.z - SOUTH).
  const Y = (z: number) => z - C.z - SOUTH;
  const claws = [{ x: -9, z: 5, dir: 0.5 }, { x: -18, z: -6, dir: -1.1 }, { x: -16, z: 14, dir: 2.6 }, { x: -6, z: -14, dir: 1.3 }, { x: -24, z: 4, dir: 0.2 }, { x: -10, z: 27, dir: 1.9 }];
  const gouges = (g: CanvasRenderingContext2D, style: string, width: number) => {
    g.strokeStyle = style;
    g.lineCap = 'round';
    for (const c of claws) {
      const dx = Math.sin(c.dir), dz = Math.cos(c.dir), px = dz, pz = -dx;
      for (const k of [-1, 0, 1]) {
        g.lineWidth = width * (k === 0 ? 1.2 : 1);
        g.beginPath();
        for (let t = -3; t <= 3; t += 0.4) {
          const bend = Math.sin(t * 0.6) * 0.35, x = c.x + dx * t + px * (k * 0.5 + bend), z = Y(c.z) + dz * t + pz * (k * 0.5 + bend);
          if (t === -3) g.moveTo(x * ppm, z * ppm);
          else g.lineTo(x * ppm, z * ppm);
        }
        g.stroke();
      }
    }
  };
  const vents = [...L.vents.map(([x, z]) => ({ x, z: Y(z), r: L.ventR })), { x: L.hold[1].x, z: Y(L.hold[1].z), r: L.greatVentR }];
  const slag = L.slag.map(([x, z]) => ({ x, z: Y(z), r: L.ventR }));
  /** The seal of the two in the middle, where the last island is: a wheel of two rings and eight spokes, cut by the channel. */
  const seal = (g: CanvasRenderingContext2D, style: string, width: number) => {
    g.strokeStyle = style;
    g.lineWidth = width;
    const y = Y(C.z);
    for (const r of [3.4, 8.6, 9.4]) { g.beginPath(); g.arc(0, y * ppm, r * ppm, 0, Math.PI * 2); g.stroke(); }
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2 + Math.PI / 8;
      g.beginPath();
      g.moveTo(Math.cos(a) * 3.4 * ppm, (y + Math.sin(a) * 3.4) * ppm);
      g.lineTo(Math.cos(a) * 8.6 * ppm, (y + Math.sin(a) * 8.6) * ppm);
      g.stroke();
    }
  };
  const color = canvasTexture(size, (g, s) => {
    g.fillStyle = '#0b0807';
    g.fillRect(0, 0, s, s);
    g.translate(s / 2, s / 2);
    for (const p of plates) {
      path(g, p.pts);
      // Ash's half: basalt, colder and darker. Ember's: warmer, with burnt plates among them.
      const west = p.pts[0][0] < 0;
      g.fillStyle = west ? `rgb(${15 + p.tone * 9},${15 + p.tone * 8},${19 + p.tone * 9})` : p.tone < 0.7 ? `rgb(${20 + p.tone * 10},${15 + p.tone * 7},${15 + p.tone * 7})` : `rgb(${42 + p.tone * 12},${22 + p.tone * 6},${15})`;
      g.fill();
      g.strokeStyle = 'rgba(120,110,140,0.12)';
      g.lineWidth = 1.5;
      g.stroke();
    }
    gouges(g, '#050303', 0.5 * ppm);
    // The gate's road, either side of the channel.
    g.fillStyle = 'rgba(190,150,70,0.05)';
    g.strokeStyle = 'rgba(190,150,70,0.26)';
    g.lineWidth = 3;
    for (const sx of [-1, 1]) {
      g.fillRect(Math.min(sx * 2, sx * 8.4) * ppm, (F.hs - 6) * ppm - SOUTH * ppm, 6.4 * ppm, (F.gs - F.hs + 6) * ppm);
      g.strokeRect(Math.min(sx * 2, sx * 8.4) * ppm, (F.hs - 6) * ppm - SOUTH * ppm, 6.4 * ppm, (F.gs - F.hs + 6) * ppm);
    }
    seal(g, 'rgba(190,150,70,0.3)', 3);
    // Under the wall the floor is burnt black.
    const burn = g.createLinearGradient(-3 * ppm, 0, 3 * ppm, 0);
    burn.addColorStop(0, 'rgba(0,0,0,0)');
    burn.addColorStop(0.5, 'rgba(0,0,0,0.9)');
    burn.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = burn;
    g.fillRect(-3 * ppm, -s / 2, 6 * ppm, s);
    // Ash's place: a ring of cracked stone where he stands.
    g.strokeStyle = 'rgba(160,120,90,0.28)';
    g.lineWidth = 3;
    g.beginPath();
    g.arc(L.hold[0].x * ppm, Y(L.hold[0].z) * ppm, 2.9 * ppm, 0, Math.PI * 2);
    g.stroke();
    // The vents' dark mouths.
    for (const v of [...vents, ...slag]) {
      g.fillStyle = '#060404';
      g.beginPath();
      g.arc(v.x * ppm, v.z * ppm, (v.r + 0.2) * ppm, 0, Math.PI * 2);
      g.fill();
    }
    // A gold line just inside the walls.
    g.strokeStyle = 'rgba(200,160,80,0.42)';
    g.lineWidth = 4;
    g.beginPath();
    const w = F.hx - 0.9, n = Y(C.z - F.hn + 0.9), sth = Y(C.z + F.hs - 0.9), gx = F.gx - 0.9, ge = Y(C.z + F.gs - 0.9);
    ([[-w, n], [w, n], [w, sth], [gx, sth], [gx, ge], [-gx, ge], [-gx, sth], [-w, sth]] as [number, number][]).forEach(([x, y], i) => (i ? g.lineTo(x * ppm, y * ppm) : g.moveTo(x * ppm, y * ppm)));
    g.closePath();
    g.stroke();
  });
  const glow = canvasTexture(size, (g, s) => {
    g.translate(s / 2, s / 2);
    // The buried sun: brighter under Ember's half, an ember glow under Ash's.
    const light = g.createRadialGradient(L.hold[1].x * ppm, Y(L.hold[1].z) * ppm, 0, L.hold[1].x * ppm, Y(L.hold[1].z) * ppm, 46 * ppm);
    light.addColorStop(0, '#d89a48');
    light.addColorStop(0.3, '#9a4614');
    light.addColorStop(1, '#2a0e05');
    g.fillStyle = light;
    g.fillRect(-s / 2, -s / 2, s, s);
    g.fillStyle = '#000';
    for (const p of plates) {
      path(g, p.pts);
      g.fill();
    }
    gouges(g, '#c8501a', 0.16 * ppm);
    for (const v of vents) {
      const hot = g.createRadialGradient(v.x * ppm, v.z * ppm, 0, v.x * ppm, v.z * ppm, v.r * ppm);
      hot.addColorStop(0, '#ffd08a');
      hot.addColorStop(0.7, '#e8601a');
      hot.addColorStop(1, '#5a1a06');
      g.fillStyle = hot;
      g.beginPath();
      g.arc(v.x * ppm, v.z * ppm, v.r * ppm, 0, Math.PI * 2);
      g.fill();
    }
  });
  return { color, glow };
}

const NOISE = /* glsl */ `
  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float noise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
  }
  float fbm(vec2 p) { return noise(p) * 0.6 + noise(p * 2.1 + 3.7) * 0.28 + noise(p * 4.3 + 9.1) * 0.12; }
`;
/** Lava as the room draws it: dark crust over slow fire. `n` in 0..1. */
const LAVA_GLSL = /* glsl */ `
  vec3 lavaColor(vec2 p, float time) {
    float n = fbm(p * 0.55 + vec2(time * 0.07, -time * 0.05)), m = fbm(p * 1.7 - vec2(time * 0.11, time * 0.04));
    float hot = smoothstep(0.35, 0.8, n * 0.65 + m * 0.35);
    return mix(vec3(0.16, 0.035, 0.012), vec3(0.95, 0.38, 0.07), hot);
  }
`;

/**
 * The wall of fire: a row of flames in the channel, each a sheet facing the camera's side (the south), over a strip of molten
 * floor. `set(on)` lights it or puts it out; out, only a burnt line is left. `gates(amount)`: the flames over the three thresholds
 * die down (The Changing of the Flames). Kept dim on purpose: under the game's bloom a bright wall would hide whoever stands beside it.
 */
class FireWall {
  readonly group = new THREE.Group();
  private flames: THREE.ShaderMaterial;
  private strip: THREE.ShaderMaterial;
  private on = 1;
  private to = 1;
  private gate = 0;
  private gateTo = 0;

  constructor() {
    const L = TWIN_LAYOUT, north = C.z - F.hn, len = F.hn + F.gs, step = 1.5, n = Math.floor(len / step), w = L.wallHalf * 2 + 1.3, h = L.wallHeight;
    const pos: number[] = [], uv: number[] = [], seed: number[] = [], gate: number[] = [], idx: number[] = [];
    const rnd = seeded(31);
    for (let i = 0; i < n; i++) {
      // No two alike: each its own height, width and place across the line, and unevenly spaced along it.
      const z = north + 0.5 + i * step + (rnd() - 0.5) * 0.9, s = rnd(), tall = h * (0.6 + rnd() * 0.55), off = (rnd() - 0.5) * 0.9, b = i * 4;
      const wide = w * (0.75 + rnd() * 0.6), atGate = L.gates.some((gz) => Math.abs(z - gz) < L.gateHalf + 0.5) ? 1 : 0;
      pos.push(off - wide / 2, 0, z, off + wide / 2, 0, z, off + wide / 2, tall, z, off - wide / 2, tall, z);
      uv.push(0, 0, 1, 0, 1, 1, 0, 1);
      seed.push(s, s, s, s);
      gate.push(atGate, atGate, atGate, atGate);
      idx.push(b, b + 1, b + 2, b, b + 2, b + 3);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    geo.setAttribute('aSeed', new THREE.Float32BufferAttribute(seed, 1));
    geo.setAttribute('aGate', new THREE.Float32BufferAttribute(gate, 1));
    geo.setIndex(idx);
    this.flames = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
      uniforms: { uTime: { value: 0 }, uOn: { value: 1 }, uGate: { value: 0 } },
      vertexShader: /* glsl */ `
        attribute float aSeed;
        attribute float aGate;
        uniform float uGate;
        varying vec2 vUv;
        varying float vSeed;
        varying float vLit;
        void main() {
          vUv = uv;
          vSeed = aSeed;
          vLit = 1.0 - aGate * uGate;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        uniform float uTime;
        uniform float uOn;
        varying vec2 vUv;
        varying float vSeed;
        varying float vLit;
        ${NOISE}
        void main() {
          float h = vUv.y;
          float n = fbm(vec2(vUv.x * 3.0 + vSeed * 17.0, h * 2.0 - uTime * (1.6 + vSeed * 0.8)));
          float n2 = fbm(vec2(vUv.x * 7.0 - vSeed * 9.0, h * 4.5 - uTime * 2.7));
          float side = max(0.0, 1.0 - abs(vUv.x - 0.5) * 2.0);
          // Tongues: wide at the foot, narrowing and breaking up toward their tips.
          float a = smoothstep(0.0, 0.28, (n * 0.7 + n2 * 0.3) * (0.5 + side * 0.95) - h * 0.92 - (1.0 - side) * 0.3 + 0.1);
          vec3 col = mix(vec3(0.7, 0.1, 0.02), vec3(1.0, 0.46, 0.1), smoothstep(0.1, 0.9, a) * (1.0 - h * 0.8));
          gl_FragColor = vec4(col, a * uOn * vLit * 0.3);
        }
      `,
    });
    const flames = new THREE.Mesh(geo, this.flames);
    flames.frustumCulled = false;
    flames.renderOrder = 3;
    this.strip = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false,
      uniforms: { uTime: { value: 0 }, uOn: { value: 1 } },
      vertexShader: /* glsl */ `
        varying vec2 vUv;
        varying vec3 vWorld;
        void main() {
          vUv = uv;
          vWorld = (modelMatrix * vec4(position, 1.0)).xyz;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        uniform float uTime;
        uniform float uOn;
        varying vec2 vUv;
        varying vec3 vWorld;
        ${NOISE}
        void main() {
          float across = 1.0 - abs(vUv.x - 0.5) * 2.0;
          float n = fbm(vec2(vWorld.x * 1.6, vWorld.z * 0.7 - uTime * 0.5));
          float hot = smoothstep(0.15, 0.9, across) * (0.55 + 0.45 * n);
          vec3 fire = mix(vec3(0.4, 0.07, 0.015), vec3(0.78, 0.3, 0.06), hot * n);
          vec3 col = mix(vec3(0.02, 0.015, 0.015), fire, uOn);
          gl_FragColor = vec4(col, smoothstep(0.0, 0.35, across) * mix(0.75, 0.7 * hot + 0.15, uOn));
        }
      `,
    });
    const strip = new THREE.Mesh(new THREE.PlaneGeometry(L.wallHalf * 2, len - 0.4).rotateX(-Math.PI / 2), this.strip);
    strip.position.set(C.x, 0.03, north + len / 2);
    strip.renderOrder = 1;
    this.group.add(strip, flames);
  }

  /** Lit, or out: it fades over two and a half seconds. `now`: at once (a new fight). */
  set(on: boolean, now = false) {
    this.to = on ? 1 : 0;
    if (now) this.on = this.to;
  }

  /** The gates over the thresholds: open (the flames there die down) or shut. */
  gates(open: boolean) {
    this.gateTo = open ? 1 : 0;
  }

  update(dt: number, time: number) {
    this.on += Math.sign(this.to - this.on) * Math.min(Math.abs(this.to - this.on), dt / 2.5);
    this.gate += Math.sign(this.gateTo - this.gate) * Math.min(Math.abs(this.gateTo - this.gate), dt / 0.8);
    this.flames.uniforms.uTime.value = this.strip.uniforms.uTime.value = time;
    this.flames.uniforms.uOn.value = this.strip.uniforms.uOn.value = this.on;
    this.flames.uniforms.uGate.value = this.gate;
  }
}

/** What shows the room now (the last one built): the gates in its wall of fire open there. */
let wallShow: FireWall | null = null;
/** The gates in the wall of fire open or shut, for the eye (The Changing of the Flames). */
export function forgeGates(open: boolean) {
  wallShow?.gates(open);
}

/** One half's lava channels: a crack that glows while the floor breaks, then lava from its middle out to its edges. */
function channelMesh(half: number) {
  const pos: number[] = [], uv: number[] = [], idx: number[] = [];
  let b = 0;
  for (const ch of CHANNELS) {
    if (ch.half !== half) continue;
    const px = -ch.uz, pz = ch.ux, w = ch.r + 0.15;
    const ends = [[ch.ax - ch.ux * 0.4, ch.az - ch.uz * 0.4, 0], [ch.ax + ch.ux * (ch.length + 0.4), ch.az + ch.uz * (ch.length + 0.4), ch.length]];
    for (const [x, z, along] of ends) {
      pos.push(x + px * w, 0, z + pz * w, x - px * w, 0, z - pz * w);
      uv.push(along, 1, along, -1);
    }
    idx.push(b, b + 2, b + 1, b + 1, b + 2, b + 3);
    b += 4;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(idx);
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, side: THREE.DoubleSide,
    uniforms: { uTime: { value: 0 }, uWarn: { value: 0 }, uOpen: { value: 0 } },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      varying vec3 vWorld;
      void main() {
        vUv = uv;
        vWorld = (modelMatrix * vec4(position, 1.0)).xyz;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      uniform float uWarn;
      uniform float uOpen;
      varying vec2 vUv;
      varying vec3 vWorld;
      ${NOISE}
      ${LAVA_GLSL}
      void main() {
        // A ragged edge: the crust breaks unevenly along the channel.
        float rag = (fbm(vec2(vUv.x * 0.9, 3.1)) - 0.5) * 0.3;
        float across = abs(vUv.y) + rag;
        // The crack: a thin line down the middle that widens and glows as the floor is about to give.
        float crack = (1.0 - smoothstep(0.0, 0.05 + 0.16 * uWarn, across)) * uWarn * (0.6 + 0.4 * sin(uTime * (5.0 + 9.0 * uWarn) + vUv.x));
        float open = 1.0 - smoothstep(uOpen * 0.86 - 0.08, uOpen * 0.86, across);
        // Its banks: the crust's burnt lip, brighter where it meets the lava.
        float lip = smoothstep(uOpen * 0.86 - 0.3, uOpen * 0.86, across) * open;
        vec3 col = lavaColor(vWorld.xz, uTime) + vec3(0.5, 0.2, 0.03) * lip;
        vec3 line = vec3(1.0, 0.5, 0.14);
        float a = max(open * step(0.001, uOpen) * 0.96, crack);
        gl_FragColor = vec4(mix(line, col, step(crack, open * step(0.001, uOpen))), a);
      }
    `,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.y = 0.036;
  mesh.renderOrder = 1;
  mesh.frustumCulled = false;
  return { mesh, mat };
}

/** The flood: lava over the forge's floor outside the dry part, with a bright edge where it advances; along the walls it shows before it rises. */
function floodMesh() {
  const north = C.z - F.hn - 0.5, south = C.z + F.gs + 0.5;
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false,
    uniforms: { uTime: { value: 0 }, uOn: { value: 0 }, uHalf: { value: new THREE.Vector2(F.hx, F.hn) }, uCorner: { value: FORGE.corner }, uCentre: { value: new THREE.Vector2(C.x, C.z) }, uGate: { value: new THREE.Vector2(F.gx, C.z + F.hs) } },
    vertexShader: /* glsl */ `
      varying vec3 vWorld;
      void main() {
        vWorld = (modelMatrix * vec4(position, 1.0)).xyz;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      uniform float uOn;
      uniform vec2 uHalf;
      uniform float uCorner;
      uniform vec2 uCentre;
      uniform vec2 uGate;
      varying vec3 vWorld;
      ${NOISE}
      ${LAVA_GLSL}
      void main() {
        vec2 p = vWorld.xz - uCentre;
        vec2 q = abs(p) - (uHalf - vec2(uCorner));
        // How far outside the dry floor this is (m): the lava's depth.
        float d = length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - uCorner;
        // Outside the forge's own floor (the stone) nothing is drawn; the gate's passage is floor.
        float room = step(abs(p.x), ${F.hx.toFixed(1)}) * step(-${F.hn.toFixed(1)}, p.y) * step(p.y, ${F.hs.toFixed(1)});
        float gate = step(abs(p.x), uGate.x) * step(${F.hs.toFixed(1)}, p.y) * step(p.y, ${F.gs.toFixed(1)});
        float lava = smoothstep(0.0, 0.3, d);
        // Its edge: the colour of a zone to leave, so it reads as one.
        float edge = (1.0 - smoothstep(0.0, 0.5, abs(d - 0.1))) * (0.75 + 0.25 * sin(uTime * 3.0 + p.x * 0.6 + p.y * 0.6));
        vec3 col = mix(lavaColor(vWorld.xz, uTime), vec3(0.91, 0.52, 0.23), edge);
        gl_FragColor = vec4(col, max(lava * 0.95, edge) * uOn * max(room, gate));
      }
    `,
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(F.hx * 2 + 1, south - north).rotateX(-Math.PI / 2), mat);
  mesh.position.set(C.x, 0.05, (north + south) / 2);
  mesh.renderOrder = 2;
  mesh.visible = false;
  return { mesh, mat };
}

function build(): ReturnType<ArenaDef['build']> {
  const g = new THREE.Group();
  const own: { dispose(): void }[] = [];
  // The forge stands in the Cinder Pit's lake: lava far round it, and a crater wall so the lake has an edge.
  const lavaTex = lavaTexture();
  const lake = new THREE.Mesh(new THREE.RingGeometry(40, 150, 72, 1), new THREE.MeshBasicMaterial({ map: lavaTex, color: 0xcccccc }));
  lake.rotation.x = -Math.PI / 2;
  lake.position.set(C.x, 0.01, C.z);
  const crater = new THREE.Mesh(
    new THREE.LatheGeometry([[96, 0], [104, 16], [120, 38], [142, 50]].map(([x, y]) => new THREE.Vector2(x, y)), 64),
    new THREE.MeshStandardMaterial({ color: 0x140c0a, roughness: 1, side: THREE.DoubleSide }),
  );
  crater.position.set(C.x, 0, C.z);
  g.add(lake, crater);

  // The floor: one drawn square under the forge; the stone round it stands on it and hides the rest.
  const den = forgeFloor();
  const face = new THREE.MeshStandardMaterial({ map: den.color, color: 0xffffff, roughness: 0.55, metalness: 0.15, emissive: 0xffffff, emissiveMap: den.glow, emissiveIntensity: 0.4 });
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(SPAN * 2, SPAN * 2), face);
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(C.x, 0.012, C.z + SOUTH);
  floor.receiveShadow = true;
  g.add(floor);

  const wall = new FireWall();
  wallShow = wall;
  g.add(wall.group);
  const pillars = buildPillars(COVER, TWIN_PILLARS);
  g.add(pillars.group);
  const channels = [channelMesh(0), channelMesh(1)];
  const flood = floodMesh();
  g.add(channels[0].mesh, channels[1].mesh, flood.mesh);

  // The lanterns' light, with no lamp in the scene: the keepers' lanterns, the niches, the two hearths, her brazier.
  const SIZE: Record<string, number> = { lantern: 1.1, lamp: 1.9, hearth: 9, beacon: 4 };
  const glows = new Glows(LAYOUT.marks.filter((m) => SIZE[m.kind]).map((m) => ({ ...m, size: SIZE[m.kind] })), 0xff9a40, 1.5);
  g.add(glows.group);
  own.push(glows);

  // The bridges of cooled crust, each on its own pivot: under the floor until its half cracks, then up and down in its turn.
  const bridges: { o: THREE.Object3D; glow: THREE.Mesh; mat: THREE.MeshBasicMaterial; lift: number }[] = [];
  const glowGeo = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
  let disposed = false;
  void realProps('twinforge', LAYOUT.obstacles.length, {
    dim: 0.85, env: 0.35,
    parts: {
      glow: { emissive: 0xffa040, strength: 2.0 }, coals: { emissive: 0xe0601a, strength: 0.9 }, stone: { dim: 0.8 }, slate: { dim: 0.85 }, basalt: { dim: 0.9 },
      gold: { dim: 0.62, rough: 0.5 }, iron: { dim: 0.8, rough: 0.5 }, cinder: { dim: 0.8 },
    },
  }, BRIDGES.map((b) => b.name)).then((props) => {
    if (disposed) return;
    for (const c of props.cover) if (c) g.add(c);
    if (props.back) g.add(props.back);
    for (const b of BRIDGES) {
      const o = props.named[b.name];
      if (!o) continue;
      o.visible = false;
      const mat = new THREE.MeshBasicMaterial({ color: 0xff8a30, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending });
      const glow = new THREE.Mesh(glowGeo, mat);
      glow.scale.set(b.len * 2, 1, b.w * 2);
      glow.rotation.y = b.yaw;
      glow.position.set(b.x, 0.13, b.z);
      glow.renderOrder = 4;
      glow.visible = false;
      g.add(o, glow);
      bridges[b.i] = { o, glow, mat, lift: 0 };
    }
  }).catch((e) => console.warn('twin forge: props failed to load', e));

  // Embers rising off the wall of fire and the hearths.
  const EMBERS = 150;
  const emberPos = new Float32Array(EMBERS * 3), emberSeed = new Float32Array(EMBERS);
  const ernd = seeded(626);
  for (let i = 0; i < EMBERS; i++) {
    emberSeed[i] = ernd();
    // Half of them over the wall's line, the rest over the floor.
    const onWall = i % 2 === 0;
    emberPos[i * 3] = onWall ? C.x + (ernd() - 0.5) * 1.6 : C.x + (ernd() * 2 - 1) * F.hx;
    emberPos[i * 3 + 2] = C.z - F.hn + ernd() * (F.hn + (onWall ? F.gs : F.hs));
  }
  const emberGeo = new THREE.BufferGeometry();
  emberGeo.setAttribute('position', new THREE.BufferAttribute(emberPos, 3));
  const embers = new THREE.Points(emberGeo, new THREE.PointsMaterial({ size: 0.14, color: 0xff8a3a, transparent: true, opacity: 0.8, depthWrite: false, blending: THREE.AdditiveBlending }));
  embers.frustumCulled = false;
  g.add(embers);

  return {
    group: g,
    coverFall: pillars.coverFall,
    resetShift() {
      pillars.resetShift();
      wall.set(true, true);
      wall.gates(false);
    },
    // The wall of fire is the room's one wall that goes: broken means it has gone out.
    wallState(index: number, state: WallState) {
      if (COVER[index] === TWIN_WALL) wall.set(state !== 'broken', state === 'whole');
    },
    update(dt, time) {
      forge.tick(dt);
      const now = forge.clock;
      pillars.update(dt, time);
      wall.update(dt, time);
      glows.update(time);
      lavaTex.offset.x = (time * 0.004) % 1;
      lavaTex.offset.y = (time * 0.0025) % 1;
      // The channels: a crack for the warning, then lava from the middle out.
      channels.forEach((c, half) => {
        const at = forge.cracked[half], u = c.mat.uniforms;
        c.mesh.visible = at >= 0;
        u.uTime.value = time;
        u.uWarn.value = at < 0 ? 0 : now < at ? Math.max(0.15, 1 - (at - now) / FORGE.warn) : Math.max(0, 1 - (now - at) * 2);
        u.uOpen.value = at < 0 || now < at ? 0 : Math.min(1, (now - at) / 1.2);
      });
      for (const b of BRIDGES) {
        const v = bridges[b.i];
        if (!v) continue;
        // It rises in a second and sinks in less; under the lava it is not drawn.
        const up = bridgeUp(b.i, now), glow = bridgeGlow(b.i, now);
        v.lift += Math.sign((up ? 1 : 0) - v.lift) * Math.min(Math.abs((up ? 1 : 0) - v.lift), dt * (up ? 1.2 : 2));
        v.o.visible = v.lift > 0.01;
        v.o.position.y = -(1 - v.lift) * 0.75;
        v.glow.visible = glow > 0 && v.lift > 0.5;
        v.mat.opacity = glow * (0.28 + 0.22 * Math.sin(time * (6 + 16 * glow)));
      }
      // The flood: along the walls first, then in.
      const fl = flood.mat.uniforms, at = forge.floodAt;
      flood.mesh.visible = at >= 0;
      if (at >= 0) {
        const inset = floodInset(now), warn = now < at ? 1 - (at - now) / FORGE.floodWarn : 1;
        fl.uTime.value = time;
        fl.uOn.value = warn;
        // Before it rises it stands half a metre in from the walls, so its edge shows all round the floor.
        (fl.uHalf.value as THREE.Vector2).set(F.hx - Math.max(0.5 * warn, inset), F.hn - Math.max(0.5 * warn, inset));
      }
      for (let i = 0; i < EMBERS; i++) {
        const s = emberSeed[i], u = (time * (0.08 + s * 0.1) + s * 3) % 1;
        emberPos[i * 3 + 1] = u * 7;
        emberPos[i * 3] += Math.sin(time * 1.3 + s * 40) * 0.004;
      }
      emberGeo.attributes.position.needsUpdate = true;
    },
    dispose() {
      disposed = true;
      if (wallShow === wall) wallShow = null;
      pillars.dispose();
      for (const o of own) o.dispose();
      for (const v of bridges) v?.mat.dispose();
      glowGeo.dispose();
      // What the room's file gave is shared with the next build: only this build's own things go.
      disposeTree(new THREE.Group().add(lake, crater, floor, wall.group, channels[0].mesh, channels[1].mesh, flood.mesh, embers));
    },
  };
}

/**
 * The room as the duel takes it. A new object for each band, so a room built for another party is built again (the duel keeps a
 * scene as long as its arena is the same object).
 */
let arena: ArenaDef | null = null;
export function twinPitArena(band: number): ArenaDef {
  if (setTwinBand(band) || !arena) arena = { id: 'twinpit', name: 'The Twin Forge', ring: TWIN_R, obstacles: COVER, stage: { ...PIT_STAGE, fogNear: 80, fogFar: 230 }, build };
  return arena;
}
