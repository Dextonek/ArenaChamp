import * as THREE from 'three';
import { RING } from '../../../arenas/common';
import type { WoodLook } from '../gen/wood';
import { rimAt } from '../land';
import { Walkers, walkerModel, walkerRoutes } from './walkers';
import { Beasts, Cloth, Dress, Flock, Motes, PAL, Puffs, Shallows, beastGeometry, birdGeometry, roomOf, type Life, type LifeEnv, type Perch } from './core';
import type { LifeIn } from './index';

/**
 * The Wood's life (chapter II, floors 11 to 20; docs/lore/codex/climb/wood.md: "a forest that is moving... groves shift in the night,
 * paths close behind you"). The zone already has its fireflies over the glades, leaves drifting down under the trees, birds far over
 * the hills, the burners' smoke and the lanterns (woodZone.ts, woodDepth.ts); this adds what lives in the wood near the hero:
 * - **Wood pigeons** in the crowns of the bands of trees (they burst out as the hero passes under), on logs, stumps, stones and roofs
 *   and on the grass of the glades; they lift off, wheel over the trees and settle again away from the hero.
 * - **Hinds** in twos and threes at the glades' edges, **foxes** by the thickets, **hares** in the open grass: they graze, look up, and
 *   bolt from the hero (or a fight) into the trees, and come back when the hero has gone. No antlers and no crowns: the Wood's crowned
 *   stags are its enemies (the bestiary), and nothing here may be taken for one.
 * - **Woodsmoke** from the camp's fire and the burners' huts, a thread of incense at the shrines.
 * - **Cloth**: pennants on the camp's tent poles, blankets and hides airing on lines at the camp and the burners.
 * - **Butterflies** over the glades, **dragonflies** and rings on the spring's pool.
 * - **People** walking beside the trails (on a computer only), as on the Sea.
 * All from the floor's own look (its places, trails, cover and kinds), so a floor made again keeps its life where it fits.
 */
export function woodLife(env: LifeEnv, inp: LifeIn, hero: THREE.Vector3): Life {
  const L = inp.look as unknown as WoodLook, def = inp.c.def, rnd = env.rnd, lite = env.tier === 'lite';
  const room = roomOf(L, def);
  // the depth's props and the scenes (a broken cart, a woodpile...): nothing of the life stands in them
  for (const m of inp.marks) room.take(m.x, m.z, m.r + 0.5);
  const beyond = (x: number, z: number) => Math.hypot(x - RING.x, z - RING.z) - rimAt(L.rim, Math.atan2(z - RING.z, x - RING.x));
  const rmean = L.rim.reduce((s, r) => s + r, 0) / L.rim.length, wide = Math.min(2, rmean / 48);
  const counts: Record<string, number> = {};
  const where: Record<string, { x: number; z: number }[]> = { hinds: [], foxes: [], hares: [], walkers: [] };
  env.group.userData.where = where;
  /** The wind: the trees lean east (the codex), a breath of it from the west. */
  const wind = new THREE.Vector2(1, -0.25).normalize();
  const downwind = Math.atan2(-wind.y, wind.x);
  const pieces = L.pieces.map((p, i) => ({ k: L.kinds[i], o: p.o }));
  const placeOf = (id: string) => L.places.find((p) => p.id === id || p.kind === id);
  const camp = placeOf('camp');
  const kit = new Dress(env);
  const cyl = (r0: number, r1: number, h: number, n = 7) => new THREE.CylinderGeometry(r0, r1, h, n).translate(0, h / 2, 0);
  const mtx = (x: number, y: number, z: number, yaw: number) => new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw), new THREE.Vector3(1, 1, 1));

  // --- perches, smoke, pennants from the pieces -------------------------------------------------------------------------------------
  const perches: Perch[] = [];
  const smoke = new Puffs(env, { x: wind.x, z: wind.y });
  const cloth = new Cloth(env, 64);
  for (const { k, o } of pieces) {
    const len = Math.hypot(o.bx - o.ax, o.bz - o.az), mx = (o.ax + o.bx) / 2, mz = (o.az + o.bz) / 2, h = o.height;
    switch (k) {
      case 'band':
        // inside the crowns (5 m up, among the leaves): a pigeon there shows when it bursts out
        for (let s = 2; s < len; s += 7) if (rnd() < 0.45) { const t = s / len; perches.push({ x: o.ax + (o.bx - o.ax) * t + (rnd() - 0.5), y: 4.6 + rnd() * 0.8, z: o.az + (o.bz - o.az) * t + (rnd() - 0.5) }); }
        break;
      case 'grove':
        perches.push({ x: o.ax + (rnd() - 0.5) * o.r * 0.5, y: 4.8 + rnd() * 0.6, z: o.az + (rnd() - 0.5) * o.r * 0.5 });
        break;
      case 'log':
        for (const t of [0.3, 0.7]) if (rnd() < 0.6) perches.push({ x: o.ax + (o.bx - o.ax) * t, y: o.r * 2.6 + 0.02, z: o.az + (o.bz - o.az) * t });
        break;
      case 'stump':
        perches.push({ x: o.ax, y: h + 0.06, z: o.az });
        break;
      case 'menhir':
        if (rnd() < 0.5) perches.push({ x: o.ax, y: h + 0.02, z: o.az });
        break;
      case 'crate':
        if (rnd() < 0.5) perches.push({ x: o.ax, y: h + 0.02, z: o.az });
        break;
      case 'hut':
        // a burner's hut: the roof's peak for a bird, and smoke from the smoke hole under it
        perches.push({ x: mx, y: h * 1.3 + 0.12, z: mz });
        smoke.add(mx, h * 1.3 - 0.1, mz, { rise: 4.5, size: 1.2, per: 7, life: 7, spread: 0.2 });
        break;
      case 'fire':
        smoke.add(o.ax, 0.9, o.az, { rise: 6, size: 1.7, per: 10, life: 7 });
        break;
      case 'tent':
        // a pennant from the gilt pole's top (woodZone.ts: the pole stands h * 1.9)
        cloth.add(mtx(o.ax, h * 1.9 - 0.4, o.az, downwind + (rnd() - 0.5) * 0.3), 0.9, 0.3, rnd() < 0.5 ? PAL.wine : 0x4c6a38, 0);
        break;
    }
  }
  // a thread of incense at each shrine (the offerings' bowl: woodDepth.ts dresses the place)
  for (const p of L.places) if (p.kind === 'shrine') smoke.add(p.x + 1.2, 0.5, p.z - 1.2, { rise: 3, size: 0.55, per: 6, life: 6, spread: 0.05 });

  // --- lines of airing cloth at the camp and the burners: two posts, a line, blankets and hides ------------------------------------------
  let lines = 0;
  for (const p of L.places) {
    if (p.kind !== 'camp' && p.kind !== 'burners') continue;
    for (let t = 0; t < 40; t++) {
      const a = rnd() * 6.28, r = p.r + 1.5 + rnd() * 3, x = p.x + Math.cos(a) * r, z = p.z + Math.sin(a) * r;
      const yaw = a + Math.PI / 2, ux = Math.cos(yaw), uz = -Math.sin(yaw), span = 3.2;
      const x0 = x - ux * span / 2, z0 = z - uz * span / 2, x1 = x + ux * span / 2, z1 = z + uz * span / 2;
      if (!room.free(x0, z0, 0.5) || !room.free(x1, z1, 0.5) || !room.free(x, z, 1.2) || beyond(x, z) > -2) continue;
      room.take(x, z, 2.2);
      const top = 2.6;
      for (const [px, pz] of [[x0, z0], [x1, z1]]) kit.add(PAL.wood, cyl(0.06, 0.07, top + 0.1), px, 0, pz).add('gold', cyl(0.075, 0.075, 0.05, 6), px, top + 0.08, pz);
      kit.add(PAL.rope, new THREE.CylinderGeometry(0.014, 0.014, span, 4).rotateZ(Math.PI / 2), x, top, z, yaw);
      const colors = [0xc4bba2, 0x4c6a38, 0x8a6a48, PAL.wine, 0x6e604a];
      let at = 0.25;
      while (at < span - 0.6) {
        const w = Math.min(span - 0.25 - at, 0.6 + rnd() * 0.5), hh = 0.6 + rnd() * 0.5;
        cloth.add(mtx(x0 + ux * at, top, z0 + uz * at, Math.atan2(-uz, ux)).multiply(new THREE.Matrix4().makeTranslation(0, -hh, 0)), w, hh, colors[Math.floor(rnd() * colors.length)], 1, 0.6);
        at += w + 0.12 + rnd() * 0.2;
      }
      lines++;
      break;
    }
  }
  counts.lines = lines;

  // --- the spring's pool: rings, and dragonflies over it --------------------------------------------------------------------------
  const shallows = new Shallows(env);
  const springs = L.places.filter((p) => p.kind === 'spring');
  for (const p of springs) for (let k = 0; k < (lite ? 3 : 6); k++) {
    const a = rnd() * 6.28, r = Math.sqrt(rnd()) * 2.8;
    shallows.ring(p.x + Math.cos(a) * r, 0.05, p.z + Math.sin(a) * r, 3 + rnd() * 5, rnd(), 0.5 + rnd() * 0.5);
  }
  shallows.build();
  Object.assign(counts, shallows.counts);

  // --- butterflies over the glades, dragonflies over the pool (none on a phone) -------------------------------------------------------
  let flutter: Motes | null = null, darts: Motes | null = null;
  if (!lite) {
    const spots: { x: number; y: number; z: number; r: number }[] = [];
    for (const p of L.places) if (p.kind !== 'camp' && p.kind !== 'den' && p.kind !== 'heart') spots.push({ x: p.x, y: 0.9, z: p.z, r: Math.min(4, p.r * 0.45) });
    for (let k = 0, t = 0; k < 12 && t < 300; t++) {
      const a = rnd() * 6.28, r = Math.sqrt(rnd()) * (rmean - 8), x = RING.x + Math.cos(a) * r, z = RING.z + Math.sin(a) * r;
      if (!room.free(x, z, 2, { road: 1 }) || beyond(x, z) > -4) continue;
      spots.push({ x, y: 0.8, z, r: 2.5 });
      k++;
    }
    flutter = new Motes(env, { n: spots.length * 3, shape: 'wing', size: 0.2, colors: [0xd8cfb4, 0xb8903a, 0x9a5a2a, 0xc4bba2, 0x8a9aa8], spots, flap: 7 });
    counts.butterflies = flutter.count;
    if (springs.length) {
      darts = new Motes(env, { n: springs.length * 4, shape: 'wing', size: 0.2, colors: [PAL.teal, 0x3e6a70], spots: springs.map((p) => ({ x: p.x, y: 0.5, z: p.z, r: 2.4 })), flap: 22 });
      counts.dragonflies = darts.count;
    }
  }

  // --- the beasts: hinds at the glades' edges, foxes by the thickets, hares in the open grass ---------------------------------------
  /** Where a beast may stand or run to: inside the edge, off the trails' middles, off the spots and the packs' homes. */
  const roam = (x: number, z: number) => beyond(x, z) < -2.5 && room.road(x, z) > 1.2;
  const fromCamp = (x: number, z: number) => !camp || Math.hypot(camp.x - x, camp.z - z) > 26;
  const pick = (n: number, ok: (x: number, z: number) => boolean, group = 1, spread = 2.5) => {
    const out: { x: number; z: number }[] = [];
    for (let t = 0; t < n * 80 && out.length < n * group; t++) {
      const a = rnd() * 6.28, r = Math.sqrt(rnd()) * (rmean - 6), x = RING.x + Math.cos(a) * r, z = RING.z + Math.sin(a) * r;
      if (!ok(x, z) || !fromCamp(x, z) || !room.free(x, z, 1.5, { road: 3 })) continue;
      room.take(x, z, 6);
      out.push({ x, z });
      for (let g = 1; g < group; g++) { const b = rnd() * 6.28, d = 1.2 + rnd() * spread; out.push({ x: x + Math.cos(b) * d, z: z + Math.sin(b) * d }); }
    }
    return out;
  };
  // the glade's edge: 2 to 7 m out from a band of trees
  const edge = (x: number, z: number) => { const c = room.cover(x, z); return c > 1.5 && c < 7 && beyond(x, z) < -5; };
  const S = 1.3; // drawn beside the heroes, who are 1.3 times life size (the small ones a fifth more again: seen from the game's camera)
  const hindHomes = pick(lite ? 2 : 4, edge, 2 + (rnd() < 0.5 ? 1 : 0));
  const hinds = new Beasts(env, beastGeometry({
    s: S, shoulder: 0.95, len: 1.2, girth: 0.5, neck: 0.55, head: 0.38, leg: 0.04, ears: 'point', tail: 'stub',
    colors: { body: 0x7a5a3e, under: 0xb8a07c, leg: 0x5e4430, ear: 0x5e4430, tail: 0xd8cfb4 },
  }), hindHomes, { shy: 15, walk: 1.1, run: 7, stride: 2.1, flee: 26, ok: roam, danger: inp.danger });
  const thickets = L.places.filter((p) => ['thicket', 'den', 'bramble', 'hollow'].includes(p.kind));
  const foxHomes = pick(lite ? 1 : 2, (x, z) => edge(x, z) && thickets.some((p) => Math.hypot(p.x - x, p.z - z) < p.r + 14));
  if (foxHomes.length < (lite ? 1 : 2)) foxHomes.push(...pick((lite ? 1 : 2) - foxHomes.length, edge));
  const foxes = new Beasts(env, beastGeometry({
    s: S * 1.2, shoulder: 0.38, len: 0.62, girth: 0.26, neck: 0.2, head: 0.24, leg: 0.026, ears: 'point', tail: 'brush', low: true,
    colors: { body: 0x9a4e26, under: 0xd2c6aa, leg: 0x2a2420, ear: 0x2a2420, tail: 0x8e4824 },
  }), foxHomes, { shy: 11, walk: 1.0, run: 6.5, stride: 1.2, flee: 20, ok: roam, danger: inp.danger, graze: 0.6 });
  const hareHomes = pick(lite ? 3 : 6, (x, z) => room.cover(x, z) > 4 && beyond(x, z) < -6);
  const hares = new Beasts(env, beastGeometry({
    s: S * 1.2, shoulder: 0.3, len: 0.46, girth: 0.28, neck: 0.1, head: 0.18, leg: 0.032, ears: 'long', tail: 'stub', low: true,
    colors: { body: 0x8a7558, under: 0xc8b898, leg: 0x7a664a, ear: 0x6a5a44, tail: 0xd8cfb4 },
  }), hareHomes, { shy: 8, walk: 0.8, run: 7, stride: 1.5, flee: 14, ok: roam, danger: inp.danger, graze: 0.8 });
  where.hinds.push(...hindHomes);
  where.foxes.push(...foxHomes);
  where.hares.push(...hareHomes);
  counts.hinds = hinds.count;
  counts.foxes = foxes.count;
  counts.hares = hares.count;
  env.group.userData.beasts = { hinds, foxes, hares };

  // --- perches on the grass of the glades (off the trails) ------------------------------------------------------------------------
  for (let k = 0, t = 0; k < 14 * wide && t < 600; t++) {
    const a = rnd() * 6.28, r = Math.sqrt(rnd()) * (rmean - 6), x = RING.x + Math.cos(a) * r, z = RING.z + Math.sin(a) * r;
    if (beyond(x, z) > -3 || room.road(x, z) < 1.5 || room.cover(x, z) < 1) continue;
    perches.push({ x, y: 0.02, z });
    k++;
  }
  counts.perches = perches.length;

  // --- the wood pigeons ------------------------------------------------------------------------------------------------------------
  const centres = L.places.map((p) => ({ x: p.x, z: p.z, r: 14 }));
  const nBirds = Math.round((lite ? 8 : 16) * wide);
  // (a wood pigeon spans 0.75 m; beside the heroes, drawn 1.3 times life size, about 1)
  const pigeons = new Flock(env, birdGeometry({ span: 1.0, body: 0.5, colors: { body: 0x77727a, wing: 0x5d5a63, tip: PAL.lacquer, beak: PAL.rope } }), perches, {
    n: nBirds, soarers: 0, shy: 6, heights: [7.5, 11], speed: 6.5, flapHz: 4.2, centres, danger: inp.danger,
  }, hero);
  counts.pigeons = nBirds;
  env.group.userData.gulls = pigeons; // (the tools' name for a floor's flock)

  // --- people walking beside the trails (walkers.ts) -----------------------------------------------------------------------------
  let walkers: Walkers | null = null;
  if (!lite && !(globalThis as { __lifeNoPeople?: boolean }).__lifeNoPeople) {
    const chosen = walkerRoutes(L.paths, (x, z) => room.packNear(x, z) > 14 && room.cover(x, z) > 0.6 && beyond(x, z) < -2, 3);
    walkers = new Walkers(env, chosen, walkerModel('wood', def.n), inp.danger);
    for (const r of chosen) where.walkers.push(r[Math.floor(r.length / 2)]);
  }
  counts.walkers = walkers?.count ?? 0;
  env.group.userData.walkers = walkers; // (the tools: where each is now)

  // --- put together ----------------------------------------------------------------------------------------------------------------
  smoke.build(0x9a9a9c, 0.5);
  counts.smoke = smoke.count;
  cloth.done();
  counts.cloth = cloth.count;
  counts.dressing = kit.parts;
  kit.build();

  return {
    counts,
    update(dt) {
      pigeons.update(dt, hero);
      hinds.update(dt, hero);
      foxes.update(dt, hero);
      hares.update(dt, hero);
      walkers?.update(dt, hero);
    },
    dispose() {},
  };
}
