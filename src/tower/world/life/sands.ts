import * as THREE from 'three';
import { RING } from '../../../arenas/common';
import type { SandsKind, SandsLook } from '../sandsZone';
import { rimAt } from '../land';
import { Walkers, walkerModel, walkerRoutes } from './walkers';
import { Beasts, Cloth, Dress, Flock, PAL, Puffs, Shallows, beastGeometry, birdGeometry, roomOf, type Life, type LifeEnv, type Perch } from './core';
import type { LifeIn } from './index';

/**
 * The Sands' life (chapter III, floors 21 to 30; docs/lore/codex/climb/sands.md: the Storm Canyon in the great storm of the year after
 * the Fall, a red canyon under a sky the colour of rust, a caravan that never reached Tamerit still trying to). The zone already has
 * vultures over the far cliffs, a caravan walking the far dunes, waymark cloths, awnings and prayer flags (sandsDepth.ts); this adds
 * what lives near the hero:
 * - **Kites** on the palms' crowns, the columns, the walls' tops, the wells' beams, the watchtower and the rocks, and a few always
 *   circling high. They lift off when the hero comes near, a fight does, or the storm comes (the law), and settle again after.
 * - **Camels** of the caravan, tethered at the caravanserai, the oasis and the wells: they never bolt, they turn their heads to watch
 *   the hero pass and lower them to drink.
 * - **Lizards** in the sun at the rocks' feet; they dart off when the hero comes.
 * - **Cloth**: pennants on the tents' poles and the watchtower, dyed cloths drying on lines at the caravanserai and the camp.
 * - **Smoke** from the fire bowls and the watch fire; rings on the oasis pools.
 * - **People walking** beside the roads (on a computer only): the Sands' water-carrier.
 * (Blowing sand and dust devils were tried and left out: from the game's high camera the one is sand on sand and the other a
 * column seen end on, a blob.) Nothing marks the ground: marks in the sand are the Scarab's (the lore), and nothing here may be taken for them.
 */
export function sandsLife(env: LifeEnv, inp: LifeIn, hero: THREE.Vector3): Life {
  const L = inp.look as unknown as SandsLook, def = inp.c.def, rnd = env.rnd, lite = env.tier === 'lite';
  const room = roomOf(L, def);
  for (const m of inp.marks) room.take(m.x, m.z, m.r + 0.5);
  const beyond = (x: number, z: number) => Math.hypot(x - RING.x, z - RING.z) - rimAt(L.rim, Math.atan2(z - RING.z, x - RING.x));
  const rmean = L.rim.reduce((s, r) => s + r, 0) / L.rim.length, wide = Math.min(2, rmean / 48);
  const kinds = new Map<number, SandsKind>(L.kinds);
  const counts: Record<string, number> = {};
  const where: Record<string, { x: number; z: number }[]> = { camels: [], lizards: [], walkers: [] };
  env.group.userData.where = where;
  /** The wind: down the canyon from the north, a little from the dunes' side. */
  const wind = new THREE.Vector2(0.35 * (L.dunes || 1), 1).normalize();
  const downwind = Math.atan2(-wind.y, wind.x);
  const kit = new Dress(env);
  const cyl = (r0: number, r1: number, h: number, n = 7) => new THREE.CylinderGeometry(r0, r1, h, n).translate(0, h / 2, 0);
  const mtx = (x: number, y: number, z: number, yaw: number) => new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw), new THREE.Vector3(1, 1, 1));
  const TURQ = 0x1f8a86, RED = 0x8a3424, OCHRE = 0xb8903a;

  // --- perches, smoke, pennants from the pieces -------------------------------------------------------------------------------------
  const perches: Perch[] = [];
  const storm = () => inp.law();
  const smoke = new Puffs(env, { x: wind.x, z: wind.y });
  const cloth = new Cloth(env, 80);
  const rocks: { x: number; z: number; r: number }[] = [];
  L.pieces.forEach(({ look: lk, o }, idx) => {
    const kind = kinds.get(idx), len = Math.hypot(o.bx - o.ax, o.bz - o.az), h = o.height;
    switch (lk) {
      case 'rock':
        rocks.push({ x: o.ax, z: o.az, r: o.r });
        if (o.r > 1 && rnd() < 0.5) perches.push({ x: o.ax + (rnd() - 0.5) * o.r * 0.4, y: (o.r > 2.6 || h > 2.2 * o.r ? h : h * 0.95) + 0.02, z: o.az + (rnd() - 0.5) * o.r * 0.4, wet: storm });
        break;
      case 'barrel':
        // a well's beam (sandsZone.ts: 2.45 m up across it)
        if (kind === 'well') perches.push({ x: o.ax, y: 2.53, z: o.az, wet: storm });
        break;
      case 'tent':
        cloth.add(mtx(o.ax, h * 1.9 - 0.42, o.az, downwind + (rnd() - 0.5) * 0.3), 0.95, 0.32, rnd() < 0.5 ? TURQ : PAL.wine, 0);
        break;
      case 'stall': case 'house':
        // the tops of the walls (a brass cap)
        for (let s = 0.2; s < 1; s += 0.6) if (rnd() < 0.5) perches.push({ x: o.ax + (o.bx - o.ax) * s, y: h + 0.12, z: o.az + (o.bz - o.az) * s, wet: storm });
        break;
      case 'fire':
        smoke.add(o.ax, 1.9, o.az, { rise: 4, size: 1.0, per: 7, life: 6, spread: 0.15 });
        break;
      case 'lighthouse': {
        // the watchtower: its corner posts for the kites, a pennant on a gilt staff over its roof, the watch fire's smoke
        const top = h;
        for (const [sx, sz] of [[-1, -1], [1, 1]]) perches.push({ x: o.ax + sx * o.r * 0.7, y: top + 1.92, z: o.az + sz * o.r * 0.7, wet: storm });
        kit.add('gold', cyl(0.04, 0.04, 1.6, 6), o.ax, top + 3.3, o.az);
        cloth.add(mtx(o.ax, top + 4.75, o.az, downwind), 1.3, 0.42, PAL.wine, 0);
        smoke.add(o.ax, top + 1.4, o.az, { rise: 6, size: 1.6, per: 9, life: 7 });
        break;
      }
      case 'post':
        if (kind === 'palm') perches.push({ x: o.ax, y: h + 0.15, z: o.az, wet: storm });
        else if (kind === 'column') perches.push({ x: o.ax, y: h + 0.02, z: o.az, wet: storm });
        break;
      case 'hull':
        if (kind === 'column') perches.push({ x: (o.ax + o.bx) / 2, y: o.r * 2 + 0.02, z: (o.az + o.bz) / 2, wet: storm });
        void len;
        break;
    }
  });

  // --- dyed cloths drying on lines at the caravanserai and the camp ------------------------------------------------------------------
  let lines = 0;
  for (const p of L.places) {
    if (p.kind !== 'serai' && p.kind !== 'camp') continue;
    for (let t = 0; t < 50; t++) {
      const a = rnd() * 6.28, r = p.r + 1.5 + rnd() * 3, x = p.x + Math.cos(a) * r, z = p.z + Math.sin(a) * r;
      const yaw = a + Math.PI / 2, ux = Math.cos(yaw), uz = -Math.sin(yaw), span = 3.4;
      const x0 = x - ux * span / 2, z0 = z - uz * span / 2, x1 = x + ux * span / 2, z1 = z + uz * span / 2;
      if (!room.free(x0, z0, 0.5) || !room.free(x1, z1, 0.5) || !room.free(x, z, 1.2) || beyond(x, z) > -2) continue;
      room.take(x, z, 2.4);
      const top = 2.6;
      for (const [px, pz] of [[x0, z0], [x1, z1]]) kit.add(PAL.wood, cyl(0.06, 0.07, top + 0.1), px, 0, pz).add('gold', cyl(0.075, 0.075, 0.05, 6), px, top + 0.08, pz);
      kit.add(PAL.rope, new THREE.CylinderGeometry(0.014, 0.014, span, 4).rotateZ(Math.PI / 2), x, top, z, yaw);
      const colors = [TURQ, PAL.wine, 0xc4bba2, OCHRE, RED];
      let at = 0.25;
      while (at < span - 0.6) {
        const w = Math.min(span - 0.25 - at, 0.7 + rnd() * 0.4), hh = 0.9 + rnd() * 0.6;
        cloth.add(mtx(x0 + ux * at, top, z0 + uz * at, Math.atan2(-uz, ux)).multiply(new THREE.Matrix4().makeTranslation(0, -hh, 0)), w, hh, colors[Math.floor(rnd() * colors.length)], 1, 0.8);
        at += w + 0.1 + rnd() * 0.15;
      }
      lines++;
      if (p.kind === 'camp' || lines % 2 === 0) break;
    }
  }
  counts.lines = lines;

  // --- the oasis pools: rings on the water -------------------------------------------------------------------------------------------
  const shallows = new Shallows(env);
  let pools: { x: number; z: number }[] = [];
  inp.root?.traverse((o) => { if (o.userData.depth?.pools) pools = o.userData.depth.pools; });
  for (const p of pools) for (let k = 0; k < (lite ? 2 : 4); k++) {
    const a = rnd() * 6.28, r = Math.sqrt(rnd()) * 2;
    shallows.ring(p.x + Math.cos(a) * r, 0.06, p.z + Math.sin(a) * r, 3 + rnd() * 5, rnd(), 0.5 + rnd() * 0.4);
  }
  shallows.build();
  Object.assign(counts, shallows.counts);

  // --- the camels of the caravan, tethered at the caravanserai, the oasis and the wells -----------------------------------------------
  const S = 1.3;
  const camelHomes: { x: number; z: number }[] = [];
  for (const p of L.places) {
    const want = p.kind === 'serai' ? (lite ? 2 : 3) : p.kind === 'oasis' || p.kind === 'well' ? (lite ? 1 : 2) : 0;
    for (let t = 0, made = 0; t < 60 && made < want; t++) {
      const a = rnd() * 6.28, r = p.r + 2 + rnd() * 4, x = p.x + Math.cos(a) * r, z = p.z + Math.sin(a) * r;
      if (!room.free(x, z, 1.6, { road: 3 }) || beyond(x, z) > -3) continue;
      room.take(x, z, 3.2);
      camelHomes.push({ x, z });
      made++;
    }
  }
  const camels = new Beasts(env, beastGeometry({
    s: S, shoulder: 1.85, len: 2.0, girth: 1.0, neck: 0.95, head: 0.52, leg: 0.1, ears: 'round', tail: 'stub',
    hump: 0.38, saddle: TURQ,
    colors: { body: 0xa8875e, under: 0xc4a77c, leg: 0x957552, ear: 0x8a6a48, tail: 0x6a5034 },
  }), camelHomes, { shy: 0, walk: 0.8, run: 0.8, stride: 2.4, flee: 0, ok: () => false, danger: inp.danger, graze: 0.55 });
  where.camels.push(...camelHomes);
  counts.camels = camels.count;

  // --- lizards at the rocks' feet --------------------------------------------------------------------------------------------------
  const lizardHomes: { x: number; z: number }[] = [];
  for (let t = 0; t < 400 && lizardHomes.length < (lite ? 4 : 9) && rocks.length; t++) {
    const rk = rocks[Math.floor(rnd() * rocks.length)], a = rnd() * 6.28, x = rk.x + Math.cos(a) * (rk.r + 0.7), z = rk.z + Math.sin(a) * (rk.r + 0.7);
    if (beyond(x, z) > -2 || room.road(x, z) < 1.5 || !room.free(x, z, 0.3, { road: 1.5 })) continue;
    room.take(x, z, 2);
    lizardHomes.push({ x, z });
  }
  const lizards = new Beasts(env, beastGeometry({
    s: S * 1.7, shoulder: 0.09, len: 0.34, girth: 0.12, neck: 0.05, head: 0.1, leg: 0.022, ears: 'round', tail: 'long', low: true,
    colors: { body: 0x8a6a46, under: 0xb89a74, leg: 0x6a5034, ear: 0x8a6a46, tail: 0x7a5c3c },
  }), lizardHomes, { shy: 5, walk: 0.4, run: 6, stride: 0.5, flee: 5, ok: (x, z) => beyond(x, z) < -1.5, danger: inp.danger, graze: 0.25 });
  where.lizards.push(...lizardHomes);
  counts.lizards = lizards.count;

  // --- perches on the open sand -------------------------------------------------------------------------------------------------
  for (let k = 0, t = 0; k < 8 * wide && t < 500; t++) {
    const a = rnd() * 6.28, r = Math.sqrt(rnd()) * (rmean - 6), x = RING.x + Math.cos(a) * r, z = RING.z + Math.sin(a) * r;
    if (beyond(x, z) > -3 || room.road(x, z) < 2) continue;
    perches.push({ x, y: 0.02, z, wet: storm });
    k++;
  }
  counts.perches = perches.length;

  // --- the kites --------------------------------------------------------------------------------------------------------------------
  const centres = L.places.map((p) => ({ x: p.x, z: p.z, r: 14 }));
  const nBirds = Math.round((lite ? 6 : 12) * wide);
  // (a black kite spans 1.5 m; beside the heroes, drawn 1.3 times life size, about 2)
  const kites = new Flock(env, birdGeometry({ span: 1.9, body: 0.75, colors: { body: 0x5a4232, wing: 0x4a3628, tip: PAL.lacquer, beak: PAL.gold } }), perches, {
    n: nBirds, soarers: lite ? 2 : 4, shy: 7, heights: [9, 15], speed: 6, flapHz: 1.8, centres, danger: inp.danger,
  }, hero);
  counts.kites = nBirds;
  env.group.userData.gulls = kites;

  // --- people walking beside the roads ---------------------------------------------------------------------------------------------
  let walkers: Walkers | null = null;
  if (!lite && !(globalThis as { __lifeNoPeople?: boolean }).__lifeNoPeople) {
    const chosen = walkerRoutes(L.paths, (x, z) => room.packNear(x, z) > 14 && room.cover(x, z) > 0.6 && beyond(x, z) < -2, 3);
    walkers = new Walkers(env, chosen, walkerModel('sands', def.n), inp.danger);
    for (const r of chosen) where.walkers.push(r[Math.floor(r.length / 2)]);
  }
  counts.walkers = walkers?.count ?? 0;
  env.group.userData.walkers = walkers;

  smoke.build(0xa89e90, 0.42);
  counts.smoke = smoke.count;
  cloth.done();
  counts.cloth = cloth.count;
  counts.dressing = kit.parts;
  kit.build();
  env.group.userData.beasts = { camels, lizards };

  return {
    counts,
    update(dt) {
      kites.update(dt, hero);
      camels.update(dt, hero);
      lizards.update(dt, hero);
      walkers?.update(dt, hero);
    },
    dispose() {},
  };
}
