import * as THREE from 'three';
import { RING } from '../../../arenas/common';
import type { DeepLook } from '../deepZone';
import { rimAt } from '../land';
import { Walkers, walkerModel, walkerRoutes } from './walkers';
import { Drips, Flock, Motes, Puffs, Shallows, Swimmers, birdGeometry, roomOf, type Life, type LifeEnv } from './core';
import type { LifeIn } from './index';

/**
 * The Deep's life (chapter IV, floors 31 to 40; docs/lore/codex/climb/deep.md: the far halls on the night their crystals went out,
 * "only crystals give light, and beyond their glow you see nothing, and the lurkers hunt there"). The zone already has bats under
 * the north wall, the waterfall and the glints on the black lake (deepDepth.ts); this adds what lives near the hero, and nothing that
 * makes light of its own (the only living light in the Deep is the Firefly-Seller's, in jars) and nothing dark that stands still at
 * the edge of the light (that is what a lurker does):
 * - **Moths** round every crystal, lamp and fire: pale wings, seen only in the light they are drawn to.
 * - **Spores** hanging in the air round the hero, rising slowly; seen where a crystal lights them.
 * - **Drips** falling from the dark into the glowing pools, a ring opening where each lands; a **pale blind fish** going slowly round
 *   a pool here and there.
 * - **Bats** flitting low over the halls (a few, always moving).
 * - **Smoke** from the camp's fire and the stoves of the miners' huts.
 * - **People walking** beside the mine's tracks (on a computer only): the Deep's miner.
 */
export function deepLife(env: LifeEnv, inp: LifeIn, hero: THREE.Vector3): Life {
  const L = inp.look as unknown as DeepLook, def = inp.c.def, rnd = env.rnd, lite = env.tier === 'lite';
  const room = roomOf(L, def);
  for (const m of inp.marks) room.take(m.x, m.z, m.r + 0.5);
  const beyond = (x: number, z: number) => Math.hypot(x - RING.x, z - RING.z) - rimAt(L.rim, Math.atan2(z - RING.z, x - RING.x));
  const counts: Record<string, number> = {};
  const where: Record<string, { x: number; z: number }[]> = { moths: [], fish: [], walkers: [] };
  env.group.userData.where = where;
  const pieces = L.pieces.map((p, i) => ({ k: L.kinds[i], o: p.o }));

  // --- the lights' moths, smoke ----------------------------------------------------------------------------------------------------
  const lights: { x: number; y: number; z: number; r: number }[] = [];
  const smoke = new Puffs(env, { x: 0.15, z: -0.1 });
  for (const { k, o } of pieces) {
    switch (k) {
      // (round the light, outside the crystal or the lamp: drawn to it, not inside it)
      case 'crystal': if (rnd() < 0.55) lights.push({ x: o.ax, y: o.height * 0.7, z: o.az, r: o.r * 1.1 + 0.9 }); break;
      case 'great': lights.push({ x: o.ax, y: o.height * 0.6, z: o.az, r: o.r * 1.6 + 1.1 }); break;
      case 'cradle': case 'cart': lights.push({ x: o.ax, y: 1.6, z: o.az, r: o.r + 1 }); break;
      case 'post': lights.push({ x: o.ax, y: o.height + 0.3, z: o.az, r: 0.9 }); break;
      case 'fire':
        lights.push({ x: o.ax, y: 2.0, z: o.az, r: 1.6 });
        smoke.add(o.ax, 1.0, o.az, { rise: 5, size: 1.4, per: 9, life: 7 });
        break;
      case 'hut':
        // a stove's pipe through the tent's peak
        if (rnd() < 0.6) smoke.add(o.ax, o.height * 1.3, o.az, { rise: 3.5, size: 0.8, per: 6, life: 6, spread: 0.1 });
        break;
    }
  }
  const nearLights = lite ? lights.filter((_, i) => i % 2 === 0) : lights;
  const moths = new Motes(env, { n: nearLights.length * 4, shape: 'wing', size: 0.3, colors: [0xb8b2cc, 0xa89e86, 0xc8c0d4], spots: nearLights, flap: 13 });
  where.moths.push(...nearLights);
  counts.moths = moths.count;

  // --- spores hanging round the hero ------------------------------------------------------------------------------------------
  const spores = new Motes(env, {
    n: lite ? 50 : 120, shape: 'mote', size: 0.07, colors: [0x8e88a6, 0x9a94b2, 0x7a7494],
    around: { box: [40, 6, 40], base: 0.2, vel: [0.1, 0.12, -0.05], sway: 0.5 }, spin: 0.8,
  });
  counts.spores = spores.count;

  // --- drips into the pools, and a pale fish going round some ---------------------------------------------------------------------
  const shallows = new Shallows(env), drips = new Drips(env), fish = new Swimmers(env);
  for (const p of L.pools) {
    const c = Math.cos(p.rot ?? 0), s = Math.sin(p.rot ?? 0);
    for (let k = 0; k < (lite ? 1 : 2); k++) {
      const u = (rnd() - 0.5) * p.rx * 1.1, v = (rnd() - 0.5) * p.rz * 1.1;
      drips.add(shallows, p.x + u * c - v * s, 0.05, p.z + u * s + v * c, 7 + rnd() * 4, 2.5 + rnd() * 3, rnd());
    }
    if (!lite && rnd() < 0.5) { fish.add(p.x, -0.05, p.z, p.rx * 0.55, p.rz * 0.55, -(p.rot ?? 0), (rnd() < 0.5 ? 1 : -1) * (0.25 + rnd() * 0.15), rnd() * 6.28); where.fish.push({ x: p.x, z: p.z }); }
  }
  shallows.build();
  drips.build();
  fish.build(0xd8d0dc, 0.55);
  Object.assign(counts, shallows.counts);
  counts.drips = drips.count;
  counts.fish = fish.count;

  // --- bats flitting low over the halls (never still) -------------------------------------------------------------------------------
  const nBats = lite ? 3 : 6;
  const bats = new Flock(env, birdGeometry({ span: 0.75, body: 0.3, colors: { body: 0x2a2630, wing: 0x221e28, tip: 0x1a1720, beak: 0x2a2630 } }), [], {
    n: nBats, soarers: nBats, shy: 0, heights: [-2.5, 0], speed: 7.5, flapHz: 7, centres: L.places.map((p) => ({ x: p.x, z: p.z, r: 10 })), danger: inp.danger,
  }, hero);
  counts.bats = nBats;
  env.group.userData.gulls = bats;

  // --- people walking beside the mine's tracks ---------------------------------------------------------------------------------
  let walkers: Walkers | null = null;
  if (!lite && !(globalThis as { __lifeNoPeople?: boolean }).__lifeNoPeople) {
    const chosen = walkerRoutes(L.paths, (x, z) => room.packNear(x, z) > 14 && room.cover(x, z) > 0.6 && beyond(x, z) < -2, 3);
    walkers = new Walkers(env, chosen, walkerModel('deep', def.n), inp.danger);
    for (const r of chosen) where.walkers.push(r[Math.floor(r.length / 2)]);
  }
  counts.walkers = walkers?.count ?? 0;
  env.group.userData.walkers = walkers;

  smoke.build(0x77738a, 0.4);
  counts.smoke = smoke.count;

  return {
    counts,
    update(dt) {
      bats.update(dt, hero);
      spores.follow(hero);
      walkers?.update(dt, hero);
    },
    dispose() {},
  };
}
