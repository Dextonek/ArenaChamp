import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { RING } from '../../../arenas/common';
import type { FloorDef } from '../def';
import { floorKeep } from '../keep';
import { WATER, geography, rimAt } from '../land';
import type { SeaLook } from '../zone';
import { Walkers } from './walkers';
import { Cloth, Dress, Flock, Floaters, PAL, Puffs, Room, Shallows, birdGeometry, goldOf, palMat, type Life, type LifeEnv, type Perch } from './core';

/**
 * The Sea's life (chapter I, floors 1 to 10; docs/lore/codex/climb/sea.md: "wrecks lie against the quays, lanterns burn on the
 * docks, gulls wheel over a grey sea"). What it adds to a floor, all from the floor's own data (its look and its `FloorDef`), so a
 * floor that is moved or made again keeps its life where it fits:
 * - **Gulls**: on the posts, the lighthouse's gallery, the wreck, the cottages' ridges, the rocks, the beach, the tidal flats (off
 *   them when the tide turns) and on the water. They lift off when the hero comes near or a fight does, wheel, and come down again
 *   on a free perch away from the hero. A few always wheel high over the shore.
 * - **Smoke** from the camp's and the beacons' fires, the cottages' chimneys and the fires of the scenes past the edge.
 * - **On the beach** (past the walkable edge, where the tall things stand: nothing there is in the hero's way): nets drying on
 *   frames, washing on lines, a pennant on a pole, and set dressing (driftwood, crates, pots, a boat upside down).
 * - **On the water**: rowing boats moored at the jetties, fishing boats under sail standing off the shore, all bobbing; rings
 *   spreading in the shallows, and now and then a fish leaping.
 * - **Pennants** on the lighthouse's top and the camp's tents.
 * - **Ankle-high things** at the places' edges, off the paths (rope coils, baskets of fish, pots, glass floats, oars, buckets).
 */

export interface SeaIn {
  def: FloorDef;
  look: SeaLook;
  /** The scenes past the edge (scenes/sea.ts `Placed`), for their fires and to keep off them. */
  scenes: { kind: string; x: number; z: number; r: number; beyond: boolean }[];
  /** The depth's props (depth.ts marks), to keep off. */
  marks: { x: number; z: number; r: number }[];
  /** A fight is near (x, z): a pack's unit awake within reach. */
  danger(x: number, z: number): boolean;
  /** The tide is in, or about to come (the flats flood). */
  tide(): boolean;
}

export function seaLife(env: LifeEnv, inp: SeaIn, hero: THREE.Vector3): Life {
  const L = inp.look, def = inp.def, rnd = env.rnd, lite = env.tier === 'lite';
  const rim = L.rim ?? new Array(48).fill(48);
  const m = L.mirror ?? 1;
  const geo = geography(rim, { mirror: m, seed: L.seed });
  const D = (x: number, z: number) => [x - RING.x, z - RING.z] as const;
  const beyond = (x: number, z: number) => geo.beyond(...D(x, z));
  const sea = (x: number, z: number) => geo.sea(...D(x, z));
  const height = (x: number, z: number) => geo.height(...D(x, z));
  const beach = (x: number, z: number) => geo.beach(...D(x, z));
  const rmean = rim.reduce((s, r) => s + r, 0) / rim.length;
  /** How many times floor 1's ground the floor has (1 on floor 1, about 5 on the made floors). */
  const area = Math.max(1, (rmean / 48) ** 2), wide = Math.sqrt(area);
  /** The wind: off the sea, inland and a little north. */
  const wind = new THREE.Vector2(-m * 0.8, -0.45).normalize();
  const downwind = Math.atan2(-wind.y, wind.x); // the yaw that turns a cloth's +x downwind

  const roads: [number, number, number, number][] = [];
  for (const p of L.paths) for (let i = 1; i < p.length; i++) roads.push([RING.x + p[i - 1][0], RING.z + p[i - 1][1], RING.x + p[i][0], RING.z + p[i][1]]);
  const low = def.law.kind === 'tide' ? def.law.low : L.flats;
  const room = new Room({
    roads, cover: L.pieces.map((p) => p.o), keep: floorKeep(def), low,
    // a pack's home and the ground of its fight; a named enemy's patrol is in `keep`
    packs: def.packs.map((p) => ({ x: p.at.x, z: p.at.z, r: p.named ? 4 : 8 })),
  });
  /** Past the edge: what the land's depth and scenes put there (and what life put down). */
  const outside: { x: number; z: number; r: number }[] = [...inp.marks, ...inp.scenes.map((s) => ({ x: s.x, z: s.z, r: s.r }))];
  const outFree = (x: number, z: number, r: number) => outside.every((o) => Math.hypot(o.x - x, o.z - z) > o.r + r);
  const kindOf = (p: { id: string; kind?: string }) => p.kind ?? p.id;
  const counts: Record<string, number> = {};

  // --- materials (the palette's) and the static dressing (merged per material and square of ground: a few draw calls) -------------
  const mats = {
    wood: PAL.wood, plank: PAL.plank, rope: PAL.rope, gold: 'gold' as const, iron: PAL.iron, cream: PAL.cream, wine: PAL.wine, teal: PAL.teal, lacquer: PAL.lacquer,
    glass: 0x4f8f86, drift: 0x8a7a66, fish: 0x9aa3a8,
  };

  const kit = new Dress(env);
  const cyl = (r0: number, r1: number, h: number, n = 10) => new THREE.CylinderGeometry(r0, r1, h, n).translate(0, h / 2, 0);
  const box = (w: number, h: number, d: number) => new THREE.BoxGeometry(w, h, d).translate(0, h / 2, 0);
  const torus = (r: number, t: number) => new THREE.TorusGeometry(r, t, 6, 18).rotateX(Math.PI / 2);

  // --- cloth: one instanced mesh for pennants, washing and sails; one for the nets (a see-through mesh of cords) ---------------------
  const cloth = new Cloth(env, 160);
  const netTex = (() => {
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const g = c.getContext('2d')!;
    g.strokeStyle = '#ffffff';
    g.lineWidth = 6;
    for (let k = 0; k <= 64; k += 16) { g.beginPath(); g.moveTo(k, 0); g.lineTo(k, 64); g.stroke(); g.beginPath(); g.moveTo(0, k); g.lineTo(64, k); g.stroke(); }
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(9, 5);
    t.colorSpace = THREE.SRGBColorSpace;
    env.own.push(t);
    return t;
  })();
  const nets = new Cloth(env, 24, { map: netTex, alphaTest: 0.5 });
  /** Where some things went (the tools: pipeline pictures look at them). */
  const where: Record<string, { x: number; z: number }[]> = { nets: [], boats: [], walkers: [] };
  env.group.userData.where = where;
  const mtx = (x: number, y: number, z: number, yaw: number) => new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw), new THREE.Vector3(1, 1, 1));
  /** A pennant at (x, y, z) on a staff, flying downwind. */
  const pennant = (x: number, y: number, z: number, w: number, h: number, color: number) => cloth.add(mtx(x, y, z, downwind + (rnd() - 0.5) * 0.3), w, h, color, 0);

  // --- the floor's pieces: perches, smoke, pennants ------------------------------------------------------------------------------
  const perches: Perch[] = [];
  const smoke = new Puffs(env, { x: wind.x, z: wind.y });
  for (const { look, o } of L.pieces) {
    const h = o.height, len = Math.hypot(o.bx - o.ax, o.bz - o.az), yaw = Math.atan2(o.bx - o.ax, o.bz - o.az), mx = (o.ax + o.bx) / 2, mz = (o.az + o.bz) / 2;
    switch (look) {
      // (no gull on a post: a post carries a lantern, and the lantern's light is the one glow)
      case 'rock':
        if (room.packNear(o.ax, o.az) > 3) perches.push({ x: o.ax + (rnd() - 0.5) * o.r * 0.5, y: h * 0.96, z: o.az + (rnd() - 0.5) * o.r * 0.5 });
        break;
      case 'crate': case 'barrel':
        if (rnd() < 0.4) perches.push({ x: o.ax, y: h + 0.02, z: o.az });
        break;
      case 'hull':
        for (const t of [0.25, 0.55, 0.8]) perches.push({ x: o.ax + (o.bx - o.ax) * t, y: h + 0.3, z: o.az + (o.bz - o.az) * t });
        break;
      case 'lighthouse': {
        // the gallery's rail, and a pennant on a gilt staff over the lantern's roof
        for (let k = 0; k < 5; k++) { const a = (k / 5) * Math.PI * 2 + 0.3; perches.push({ x: o.ax + Math.cos(a) * 2.15, y: 16.22, z: o.az + Math.sin(a) * 2.15 }); }
        kit.add(mats.gold, cyl(0.045, 0.045, 1.9, 6), o.ax, 18.4, o.az);
        pennant(o.ax, 19.55, o.az, 1.5, 0.5, PAL.wine);
        break;
      }
      case 'tent':
        pennant(o.ax, h * 1.9 - 0.42, o.az, 0.95, 0.32, rnd() < 0.5 ? PAL.wine : PAL.teal);
        break;
      case 'fire':
        smoke.add(o.ax, 0.9, o.az, { rise: o.r > 1.1 ? 7 : 5, size: o.r > 1.1 ? 2.1 : 1.6, per: 10, life: 7 });
        break;
      case 'house':
        if (o.r >= 1.2) {
          // a cottage (zone.ts draws it): its ridge for the gulls, and smoke from about half the chimneys
          const w = o.r * 2, d = len + o.r * 2, rh = w * 0.45, ux = Math.cos(yaw), uz = -Math.sin(yaw);
          for (const t of [-0.3, 0.3]) perches.push({ x: mx + Math.sin(yaw) * d * t, y: h + rh + 0.3, z: mz + Math.cos(yaw) * d * t });
          if (rnd() < 0.55) smoke.add(mx + ux * w * 0.22 + Math.sin(yaw) * d * 0.25, h + rh + 1.15, mz + uz * w * 0.22 + Math.cos(yaw) * d * 0.25, { rise: 5, size: 1.3, per: 8, life: 8, spread: 0.15 });
        }
        break;
    }
  }
  // The scenes' fires past the edge (a cooking fire, a tar pot) smoke too.
  for (const s of inp.scenes) if (s.kind === 'fire') smoke.add(s.x, 0.4 + Math.max(0, height(s.x, s.z)), s.z, { rise: 4, size: 1.2, per: 7, life: 6, spread: 0.2 });

  // --- the shore. The sea comes up to the walkable edge (land.ts: the water begins 1 to 3 m past it on the sea's side), so the tall
  // things stand in the shallows past it, where nothing is in the hero's way; on the sand inside the edge only ankle-high things lie.
  /** Points round the edge on the sea's side, `b0` to `b1` m past it (negative: inside), where `ok` says. */
  const seaDir = m === 1 ? 0 : Math.PI;
  const sample = (n: number, b0: number, b1: number, ok: (x: number, z: number) => boolean, spread = 1.15) => {
    const out: { x: number; z: number; a: number }[] = [];
    for (let k = 0; k < n * 30 && out.length < n; k++) {
      const a = seaDir + (rnd() - 0.5) * 2 * spread, r = rimAt(rim, a) + b0 + rnd() * (b1 - b0), x = RING.x + Math.cos(a) * r, z = RING.z + Math.sin(a) * r;
      if (ok(x, z)) out.push({ x, z, a });
    }
    return out;
  };
  /** The edge's tangent at angle `a` (a yaw that lays a thing along the shore). */
  const along = (a: number) => Math.atan2(-Math.sin(a), Math.cos(a)) + Math.PI / 2;
  /** Shallow water: the sea, a metre or so deep. */
  const shallowAt = (x: number, z: number) => sea(x, z) > 0.93 && height(x, z) < WATER - 0.35 && height(x, z) > WATER - 2;

  // Stake nets: two poles in the shallows and a net hung between them to dry, glass floats along its top; a gull on a pole.
  const nNets = Math.round((lite ? 2 : 3) * wide);
  for (const p of sample(nNets, 3, 8, (x, z) => shallowAt(x, z) && outFree(x, z, 2.4))) {
    const yaw = along(p.a) + (rnd() - 0.5) * 0.4, ux = Math.cos(yaw), uz = -Math.sin(yaw), top = WATER + 2.1;
    if (!shallowAt(p.x + ux * 1.7, p.z + uz * 1.7) || !shallowAt(p.x - ux * 1.7, p.z - uz * 1.7)) continue;
    outside.push({ x: p.x, z: p.z, r: 2.2 });
    for (const s of [-1.65, 1.65]) {
      const px = p.x + ux * s, pz = p.z + uz * s, py = height(px, pz) - 0.1;
      kit.add(mats.wood, cyl(0.07, 0.08, top + 0.15 - py, 6), px, py, pz).add(mats.gold, cyl(0.085, 0.085, 0.06, 6), px, top + 0.08, pz);
      perches.push({ x: px, y: top + 0.17, z: pz });
    }
    kit.add(mats.wood, new THREE.CylinderGeometry(0.045, 0.045, 3.45, 6).rotateZ(Math.PI / 2), p.x, top - 0.05, p.z, yaw);
    for (let k = -2; k <= 2; k++) kit.add(mats.glass, new THREE.SphereGeometry(0.11, 8, 6), p.x + ux * k * 0.62, top - 0.17, p.z + uz * k * 0.62);
    where.nets.push({ x: p.x, z: p.z });
    nets.add(mtx(p.x - ux * 1.55, top - 0.05, p.z - uz * 1.55, yaw).multiply(new THREE.Matrix4().makeTranslation(0, -1.8, 0)), 3.1, 1.8, PAL.rope, 1, 0.6);
  }
  counts.nets = nets.count;
  // Channel markers: a pole in the water with a pennant (and a gull's seat).
  for (const p of sample(Math.round((lite ? 1 : 2) * wide), 4, 14, (x, z) => shallowAt(x, z) && outFree(x, z, 1))) {
    const py = height(p.x, p.z) - 0.1, top = WATER + 3.3;
    outside.push({ x: p.x, z: p.z, r: 1 });
    kit.add(mats.wood, cyl(0.08, 0.1, top - py, 7), p.x, py, p.z).add(mats.gold, new THREE.SphereGeometry(0.11, 8, 6), p.x, top, p.z);
    pennant(p.x, top - 0.65, p.z, 1.3, 0.42, rnd() < 0.5 ? PAL.wine : PAL.teal);
    perches.push({ x: p.x, y: top + 0.1, z: p.z });
  }
  // Washing strung across the village's lane, from wall to wall above the heads (the lane is walked: the lowest cloth is 2.5 m up).
  const washColors = [0xc4bba2, PAL.teal, 0xc4bba2, PAL.wine, 0x8a9aa0, 0xc4bba2, PAL.rope]; // the cream a shade down: in the sun it glared
  const cottages = L.pieces.filter((pc) => pc.look === 'house' && pc.o.r >= 1.2).map((pc) => ({ o: pc.o, mx: (pc.o.ax + pc.o.bx) / 2, mz: (pc.o.az + pc.o.bz) / 2, yaw: Math.atan2(pc.o.bx - pc.o.ax, pc.o.bz - pc.o.az) }));
  let lines = 0;
  for (let i = 0; i < cottages.length; i++) for (let j = i + 1; j < cottages.length; j++) {
    const a = cottages[i], b = cottages[j], d = Math.hypot(b.mx - a.mx, b.mz - a.mz);
    // facing each other across a lane: parallel, side by side (not end to end), 5 to 11 m apart
    if (d < 5 || d > 11 || Math.abs(Math.sin(a.yaw - b.yaw)) > 0.1) continue;
    const endways = Math.abs(Math.sin(a.yaw) * (b.mx - a.mx) + Math.cos(a.yaw) * (b.mz - a.mz));
    if (endways > 1.5 || (lite && lines >= 2) || rnd() < 0.3) continue;
    const ux = (b.mx - a.mx) / d, uz = (b.mz - a.mz) / d, y = Math.min(a.o.height, b.o.height) - 0.35;
    const x0 = a.mx + ux * a.o.r, z0 = a.mz + uz * a.o.r, span = d - a.o.r - b.o.r, yaw = Math.atan2(-uz, ux);
    if (span < 2.5) continue;
    kit.add(mats.rope, new THREE.CylinderGeometry(0.014, 0.014, span, 4).rotateZ(Math.PI / 2), x0 + ux * span / 2, y, z0 + uz * span / 2, yaw);
    for (const e of [0, span]) kit.add(mats.iron, box(0.06, 0.12, 0.06), x0 + ux * e, y - 0.06, z0 + uz * e);
    let at = 0.3;
    while (at < span - 0.6) {
      const w = Math.min(span - 0.3 - at, 0.45 + rnd() * 0.4), hh = Math.min(y - 2.5, 0.45 + rnd() * 0.4);
      if (w > 0.3 && hh > 0.25) cloth.add(mtx(x0 + ux * at, y, z0 + uz * at, yaw).multiply(new THREE.Matrix4().makeTranslation(0, -hh, 0)), w, hh, washColors[Math.floor(rnd() * washColors.length)], 1, 0.7);
      at += w + 0.1 + rnd() * 0.25;
    }
    lines++;
  }
  counts.washing = lines;
  // On the sand inside the edge: driftwood, a float or two, a coil of rope (ankle-high, off the paths and the spots).
  const sand = (x: number, z: number) => beach(x, z) > 0.6 && sea(x, z) < 0.05 && beyond(x, z) < -1.2 && room.free(x, z, 0.9);
  let junk = 0;
  for (const p of sample(Math.round((lite ? 5 : 9) * wide), -8, -1.2, sand)) {
    const yaw = rnd() * 6.28, what = rnd();
    room.take(p.x, p.z, 1.2);
    junk++;
    if (what < 0.5) {
      kit.add(mats.drift, new THREE.CylinderGeometry(0.11, 0.15, 2.0 + rnd(), 7).rotateZ(Math.PI / 2), p.x, 0.09, p.z, yaw);
      kit.add(mats.drift, new THREE.CylinderGeometry(0.04, 0.06, 1.0, 5).rotateZ(Math.PI / 2), p.x + 0.4, 0.05, p.z + 0.3, yaw + 0.8);
      perches.push({ x: p.x, y: 0.24, z: p.z });
    } else if (what < 0.75) {
      for (let k = 0; k < 3; k++) kit.add(mats.glass, new THREE.SphereGeometry(0.15, 8, 6), p.x + Math.cos(k * 2.1) * 0.25, 0.13, p.z + Math.sin(k * 2.1) * 0.25);
      kit.add(mats.rope, torus(0.36, 0.03), p.x, 0.02, p.z);
    } else {
      for (let k = 0; k < 3; k++) kit.add(mats.rope, torus(0.3 - k * 0.05, 0.055), p.x, 0.05 + k * 0.09, p.z);
      kit.add(mats.plank, box(0.08, 0.05, 2.3), p.x + 0.6, 0.01, p.z, yaw);
    }
  }
  counts.sand = junk;

  // --- ankle-high things at the places' edges (inside the walkable ground, off the paths, the cover and the spots) --------------------
  const small = (x: number, z: number) => {
    const yaw = rnd() * 6.28, what = Math.floor(rnd() * 6);
    switch (what) {
      case 0: for (let k = 0; k < 3; k++) kit.add(mats.rope, torus(0.3 - k * 0.05, 0.055), x, 0.05 + k * 0.09, z); break; // a coil of rope
      case 1: // a basket of fish
        kit.add(mats.rope, new THREE.CylinderGeometry(0.32, 0.26, 0.34, 12, 1, true).translate(0, 0.17, 0), x, 0, z).add(mats.rope, new THREE.CircleGeometry(0.26, 12).rotateX(-Math.PI / 2), x, 0.02, z);
        kit.add(mats.gold, torus(0.32, 0.02), x, 0.34, z);
        for (let k = 0; k < 4; k++) kit.add(mats.fish, new THREE.SphereGeometry(1, 6, 4).scale(0.05, 0.05, 0.2), x + (rnd() - 0.5) * 0.3, 0.3, z + (rnd() - 0.5) * 0.3, rnd() * 6.28, 1, 1, 1, 0.3);
        break;
      case 2: // glass floats in a heap
        for (let k = 0; k < 4; k++) kit.add(mats.glass, new THREE.SphereGeometry(0.15, 8, 6), x + Math.cos(k * 1.7) * 0.22, 0.13 + (k === 3 ? 0.2 : 0), z + Math.sin(k * 1.7) * 0.22);
        break;
      case 3: // a pair of oars
        kit.add(mats.plank, box(0.08, 0.05, 2.3), x, 0.01, z, yaw).add(mats.plank, box(0.08, 0.05, 2.3), x + 0.2, 0.06, z, yaw + 0.12);
        kit.add(mats.plank, box(0.2, 0.03, 0.55), x, 0.01, z, yaw, 1, 1, 1, 0).add(mats.gold, box(0.1, 0.06, 0.06), x, 0.03, z, yaw);
        break;
      case 4: // a bucket and a mallet
        kit.add(mats.wood, cyl(0.17, 0.14, 0.3, 10), x, 0, z).add(mats.iron, cyl(0.18, 0.18, 0.03, 10), x, 0.22, z);
        kit.add(mats.plank, new THREE.CylinderGeometry(0.025, 0.025, 0.5, 5).rotateZ(Math.PI / 2), x + 0.35, 0.04, z + 0.15, yaw);
        break;
      default: // a sail, folded and tied
        kit.add(mats.cream, box(0.9, 0.18, 0.55), x, 0, z, yaw).add(mats.rope, box(0.06, 0.2, 0.58), x, 0, z, yaw);
    }
  };
  let smalls = 0;
  for (const p of L.places) {
    const k = kindOf(p), want = k === 'camp' ? 5 : k === 'caves' ? 1 : 4;
    for (let t = 0, made = 0; t < want * 12 && made < want; t++) {
      const a = rnd() * Math.PI * 2, r = p.r + 0.5 + rnd() * 4, x = p.x + Math.cos(a) * r, z = p.z + Math.sin(a) * r;
      if (beyond(x, z) > -1.5 || !room.free(x, z, 0.6)) continue;
      room.take(x, z, 0.8);
      small(x, z);
      made++;
      smalls++;
    }
  }
  counts.smalls = smalls;

  // --- boats on the water: rowing boats moored at the jetties, fishing boats under sail standing off ----------------------------------
  // (the jetties are land.ts's: their directions come from the outline alone, no dice: `dir`, `jetties` there)
  const dirT = (t: number) => (m === 1 ? t * Math.PI * 2 : Math.PI - t * Math.PI * 2);
  const jetties = Math.max(2, Math.round(2 * (rmean / 48)));
  const rowing = new Floaters(env, cloth), sailing = new Floaters(env, cloth);
  const wet = (x: number, z: number) => sea(x, z) > 0.93 && height(x, z) < WATER - 0.25;
  for (let j = 0; j < jetties; j++) {
    const a = dirT(((j + 0.5) / jetties - 0.5) * 0.26), ux = Math.cos(a), uz = Math.sin(a), r0 = rimAt(rim, a) + 1.5, jy = Math.atan2(ux, uz);
    for (const [s, side] of [[5, 2.55], [9.5, -2.55]] as const) {
      if (lite && s > 6) continue;
      const x = RING.x + ux * (r0 + s) - uz * side, z = RING.z + uz * (r0 + s) + ux * side;
      if (wet(x, z)) { rowing.add(x, WATER + 0.3, z, jy + (rnd() - 0.5) * 0.15, 0.8); where.boats.push({ x, z }); }
    }
  }
  const nSail = lite ? 2 : 3;
  for (let k = 0, tries = 0; k < nSail && tries < 60; tries++) {
    const a = seaDir + (rnd() - 0.5) * 1.5, r = rimAt(rim, a) + 30 + rnd() * 34, cx = RING.x + Math.cos(a) * r, cz = RING.z + Math.sin(a) * r, rr = 8 + rnd() * 10;
    let ok = true;
    for (let i = 0; i < 10 && ok; i++) ok = wet(cx + Math.cos(i * 0.63) * (rr + 4), cz + Math.sin(i * 0.63) * (rr + 4));
    if (!ok) continue;
    const it = sailing.add(cx, WATER + 0.36, cz, 0, 1.2, { r: rr, w: (rnd() < 0.5 ? 1 : -1) * (0.035 + rnd() * 0.02), cx, cz });
    // the sail: held on the mast, out over the stern; a pennant at the mast's head
    sailing.sail(it, new THREE.Matrix4().makeRotationY(Math.PI / 2).premultiply(new THREE.Matrix4().makeTranslation(0, 1.1, 0.35)), 2.3, 3.5, PAL.cream);
    sailing.sail(it, new THREE.Matrix4().makeRotationY(downwind).premultiply(new THREE.Matrix4().makeTranslation(0, 5.0, 0.35)), 0.9, 0.3, PAL.wine, 0);
    k++;
  }
  {
    const hull = (sx: number, sy: number, sz: number) => new THREE.SphereGeometry(1, 16, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2).scale(sx, sy, sz);
    const paintMat = palMat(env, 0xffffff, { roughness: 0.6, side: THREE.DoubleSide }), goldMat = goldOf(env), plankMat = palMat(env, PAL.plank), woodMat = palMat(env, PAL.wood);
    rowing.build([
      { geo: hull(0.72, 0.42, 1.75), mat: paintMat, paint: [PAL.wine, PAL.teal, PAL.lacquer, PAL.teal] },
      { geo: torus(1, 0.035).scale(0.72, 1, 1.75), mat: goldMat },
      { geo: mergeGeometries([new THREE.BoxGeometry(1.3, 0.06, 0.28).translate(0, -0.05, 0.4), new THREE.BoxGeometry(0.9, 0.05, 2.6).translate(0, -0.3, 0), new THREE.BoxGeometry(1.3, 0.06, 0.28).translate(0, -0.05, -0.7)])!, mat: plankMat },
    ]);
    sailing.build([
      { geo: hull(1.05, 0.6, 2.6), mat: paintMat, paint: [PAL.teal, PAL.wine, PAL.lacquer] },
      { geo: torus(1, 0.05).scale(1.05, 1, 2.6), mat: goldMat },
      { geo: new THREE.CylinderGeometry(0.07, 0.09, 5.1, 7).translate(0, 2.5, 0.35), mat: woodMat },
    ]);
  }
  counts.boats = rowing.count + sailing.count;

  // --- the shallows: rings spreading, a fish leaping now and then -----------------------------------------------------------------
  const shallows = new Shallows(env);
  const shallow = (x: number, z: number) => sea(x, z) > 0.96 && height(x, z) < WATER - 0.15;
  for (const p of sample(Math.round((lite ? 8 : 18) * wide), 2, 14, shallow, 1.25)) shallows.ring(p.x, WATER + 0.02, p.z, 4 + rnd() * 7, rnd(), 0.8 + rnd() * 0.9);
  if (!lite) for (const p of sample(Math.round(6 * wide), 4, 20, shallow, 1.25)) shallows.leap(p.x, WATER - 0.02, p.z, rnd() * 6.28, 6 + rnd() * 9, rnd(), 1.3 + rnd() * 0.8);
  shallows.build();
  Object.assign(counts, shallows.counts);

  // --- perches on the beach, on the flats and on the water -------------------------------------------------------------------
  for (const p of sample(Math.round(10 * wide), -7, -0.8, (x, z) => beach(x, z) > 0.6 && sea(x, z) < 0.05 && room.road(x, z) > 1.5)) perches.push({ x: p.x, y: 0.02, z: p.z });
  for (const p of sample(Math.round(6 * wide), 6, 24, shallow)) perches.push({ x: p.x, y: WATER + 0.06, z: p.z, float: true });
  for (const f of low) {
    for (let k = 0; k < 3; k++) {
      const a = rnd() * 6.28, u = Math.cos(a) * f.rx * 0.6 * rnd(), v = Math.sin(a) * f.rz * 0.6 * rnd(), c = Math.cos(f.rot ?? 0), s = Math.sin(f.rot ?? 0);
      const x = f.x + u * c - v * s, z = f.z + u * s + v * c;
      if (room.road(x, z) > 1.5) perches.push({ x, y: 0.03, z, wet: inp.tide });
    }
  }
  counts.perches = perches.length;

  // --- the gulls ----------------------------------------------------------------------------------------------------------------
  const centres = [
    ...L.places.filter((p) => ['lighthouse', 'wreck', 'beacon', 'shipyard', 'market'].includes(kindOf(p))).map((p) => ({ x: p.x, z: p.z, r: 10 })),
    ...sample(4, 4, 20, () => true).map((p) => ({ x: p.x, z: p.z, r: 12 })),
  ];
  const nGulls = Math.round((lite ? 10 : 22) * Math.min(2, wide));
  // (a herring gull spans 1.45 m; the heroes are drawn 1.3 times life size, so beside them it spans 1.9)
  // (their white is kept to the tents' cream: a whiter one caught the bloom and glowed)
  const gulls = new Flock(env, birdGeometry({ span: 1.9, body: 0.88, colors: { body: 0xbcb8ad, wing: 0x7d848c, tip: PAL.lacquer, beak: PAL.gold } }), perches, {
    n: nGulls, soarers: lite ? 2 : 4, shy: 6, heights: [6, 11], speed: 5.5, flapHz: 2.6, centres, danger: inp.danger,
  }, hero);
  counts.gulls = nGulls;
  env.group.userData.gulls = gulls; // for the tools (pipeline/tools/life-shots.js)

  // --- people walking between places: beside a path, well off the packs' fights and the flats (walkers.ts) ----------------------------
  // A stand-in figure until the Sea has plain coast folk of its own: the trader who is not on this floor (the two take turns, folk.ts).
  let walkers: Walkers | null = null;
  // (`globalThis.__lifeNoPeople = true`: the rest of the life without them, for the perf tool's A/B)
  if (!lite && !(globalThis as { __lifeNoPeople?: boolean }).__lifeNoPeople) {
    const runs: { x: number; z: number }[][] = [];
    for (const path of L.paths) {
      const pts = path.map(([dx, dz]) => ({ x: RING.x + dx, z: RING.z + dz }));
      const dense: { x: number; z: number }[] = [];
      for (let k = 1; k < pts.length; k++) {
        const a = pts[k - 1], b = pts[k], len = Math.hypot(b.x - a.x, b.z - a.z) || 1, n = Math.max(1, Math.ceil(len / 2)), nx = (b.z - a.z) / len, nz = -(b.x - a.x) / len;
        for (let i = 0; i < n; i++) dense.push({ x: a.x + (b.x - a.x) * (i / n) + nx * 1.4, z: a.z + (b.z - a.z) * (i / n) + nz * 1.4 });
      }
      let cur: { x: number; z: number }[] = [];
      for (const q of dense) {
        if (room.packNear(q.x, q.z) > 14 && !room.low(q.x, q.z) && room.cover(q.x, q.z) > 0.6) cur.push(q);
        else { if (cur.length) runs.push(cur); cur = []; }
      }
      if (cur.length) runs.push(cur);
    }
    const chosen = runs.filter((r) => r.length >= 12).sort((a, b) => b.length - a.length).slice(0, area > 2 ? 3 : 2);
    const stand = `models/tower/${def.n % 2 === 1 ? 'sea_pedlar' : 'sea_trader'}_v4.glb`;
    walkers = new Walkers(env, chosen, () => stand, inp.danger);
    for (const r of chosen) where.walkers.push(r[Math.floor(r.length / 2)]);
  }
  counts.walkers = walkers?.count ?? 0;

  // --- put together ----------------------------------------------------------------------------------------------------------------
  smoke.build(0x9c9991, 0.55);
  counts.smoke = smoke.count;
  cloth.done();
  nets.done();
  counts.cloth = cloth.count;
  counts.dressing = kit.parts;
  kit.build();

  return {
    counts,
    update(dt) {
      gulls.update(dt, hero);
      walkers?.update(dt, hero);
      rowing.update(dt);
      sailing.update(dt);
    },
    dispose() {},
  };
}
