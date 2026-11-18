import * as THREE from 'three';
import { RING } from '../../../arenas/common';
import type { WarKind, WarLook } from '../warZone';
import { rimAt } from '../land';
import { Walkers, walkerModel, walkerRoutes } from './walkers';
import { Beasts, Cloth, Dress, Flock, Motes, PAL, Puffs, beastGeometry, birdGeometry, roomOf, type Life, type LifeEnv, type Perch } from './core';
import type { LifeIn } from './index';

/**
 * The War's life (chapter V, floors 41 to 50; docs/lore/codex/climb/war.md: the Field of Banners in the last days of the War, a grey
 * evening after a day of battle, warm low sun through smoke). The zone already has crows wheeling far over the field, columns of
 * smoke from the far camps, banners on the roads and the gate towers, and the armies' camps on the hills (warDepth.ts); this adds
 * what lives (and smoulders) near the hero:
 * - **Crows** on the stakes, the palisade, the fences, the walls' broken tops, the wagons, the shields and the field itself; they
 *   lift off when the hero comes near or a fight does, wheel, and come down again.
 * - **Smoke**: the burned farm still smouldering, the braziers, the camp's cooking fire; **ash** drifting down everywhere.
 * - **Cloth**: bandages and sheets drying on lines at the field hospital (the White Sister's), pennants on short staffs by the war
 *   drums in their army's colour. The standards' own cloth is the law's (it flies the colours), so nothing is added to them.
 * - **Horses** of the wagon train, tethered at the wagons: they do not bolt: they watch and step aside if the hero comes right up.
 * - **People walking** beside the roads (on a computer only): the War's gleaner.
 */
export function warLife(env: LifeEnv, inp: LifeIn, hero: THREE.Vector3): Life {
  const L = inp.look as unknown as WarLook, def = inp.c.def, rnd = env.rnd, lite = env.tier === 'lite';
  const room = roomOf(L, def);
  for (const m of inp.marks) room.take(m.x, m.z, m.r + 0.5);
  const beyond = (x: number, z: number) => Math.hypot(x - RING.x, z - RING.z) - rimAt(L.rim, Math.atan2(z - RING.z, x - RING.x));
  const rmean = L.rim.reduce((s, r) => s + r, 0) / L.rim.length, wide = Math.min(2, rmean / 48);
  const kinds = new Map<number, WarKind>(L.kinds);
  const counts: Record<string, number> = {};
  const where: Record<string, { x: number; z: number }[]> = { horses: [], walkers: [] };
  env.group.userData.where = where;
  /** The wind: from the west, carrying the smoke over the field. */
  const wind = new THREE.Vector2(1, 0.2).normalize();
  const downwind = Math.atan2(-wind.y, wind.x);
  const CRIMSON = 0x9a2c2c, AZURE = 0x2c4c9a, LINEN = 0xa49e90;
  const sideOf = (x: number) => ((x - RING.x) * L.crimson > 0 ? CRIMSON : AZURE);
  const kit = new Dress(env);
  const cyl = (r0: number, r1: number, h: number, n = 7) => new THREE.CylinderGeometry(r0, r1, h, n).translate(0, h / 2, 0);
  const mtx = (x: number, y: number, z: number, yaw: number) => new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw), new THREE.Vector3(1, 1, 1));

  // --- perches, smoke and pennants from the pieces ---------------------------------------------------------------------------------
  const perches: Perch[] = [];
  const smoke = new Puffs(env, { x: wind.x, z: wind.y }), dark = new Puffs(env, { x: wind.x, z: wind.y });
  const cloth = new Cloth(env, 90);
  L.pieces.forEach(({ look: lk, o }, idx) => {
    const kind = kinds.get(idx), h = o.height, len = Math.hypot(o.bx - o.ax, o.bz - o.az);
    const along = (n: number, y: number, p = 0.5) => { for (let k = 0; k < n; k++) if (rnd() < p) { const t = (k + 0.5) / n; perches.push({ x: o.ax + (o.bx - o.ax) * t, y, z: o.az + (o.bz - o.az) * t }); } };
    switch (kind ?? lk) {
      case 'stake': if (rnd() < 0.4) perches.push({ x: o.ax, y: h * 1.1 + 0.05, z: o.az }); break;
      case 'palisade': along(Math.max(1, Math.round(len / 5)), h + 0.02, 0.4); break;
      case 'fence': along(Math.max(1, Math.round(len / 3)), h + 0.02, 0.5); break;
      case 'farmwall': case 'ruinwall': along(Math.max(1, Math.round(len / 4)), h * 0.6, 0.5); break;
      case 'wagon': perches.push({ x: (o.ax + o.bx) / 2, y: 0.35 + h * 0.55 + 0.1, z: (o.az + o.bz) / 2 }); break;
      case 'siegetower': perches.push({ x: (o.ax + o.bx) / 2, y: 0.5 + h * 0.7, z: (o.az + o.bz) / 2 }); break;
      case 'hay': perches.push({ x: o.ax, y: h + 0.02, z: o.az }); break;
      case 'shieldpile': if (rnd() < 0.5) perches.push({ x: o.ax, y: 0.4, z: o.az }); break;
      case 'barrel': perches.push({ x: o.ax, y: h + 0.02, z: o.az }); break;
      case 'drum': {
        // a pennant in its army's colour on a short staff beside the drum
        const a = rnd() * 6.28, x = o.ax + Math.cos(a) * (o.r + 0.35), z = o.az + Math.sin(a) * (o.r + 0.35);
        kit.add(PAL.wood, cyl(0.035, 0.04, 2.6, 6), x, 0, z).add('gold', new THREE.ConeGeometry(0.06, 0.16, 5).translate(0, 0.08, 0), x, 2.6, z);
        cloth.add(mtx(x, 2.55, z, downwind + (rnd() - 0.5) * 0.3), 0.85, 0.32, sideOf(o.ax), 0);
        break;
      }
      case 'gatetower': perches.push({ x: o.ax, y: h + 1.56, z: o.az }); break;
      case 'fire':
        if (lk === 'fire') smoke.add(o.ax, 1.9, o.az, { rise: 5, size: 1.2, per: 8, life: 6, spread: 0.15 });
        break;
    }
  });
  // the burned farm still smoulders: dark smoke from inside its walls; the camp's cooking fire
  for (const p of L.places) {
    if (p.kind === 'farm') for (let k = 0; k < 2; k++) dark.add(p.x + (rnd() - 0.5) * p.r, 0.3, p.z + (rnd() - 0.5) * p.r, { rise: 9, size: 2.2, per: 11, life: 9, spread: 0.8 });
    if (p.kind === 'camp') smoke.add(p.x, 0.6, p.z, { rise: 6, size: 1.5, per: 9, life: 7 });
  }

  // --- bandages and sheets drying at the field hospital --------------------------------------------------------------------------
  let lines = 0;
  for (const p of L.places) {
    if (p.kind !== 'hospital') continue;
    for (let t = 0, made = 0; t < 60 && made < (lite ? 1 : 2); t++) {
      const a = rnd() * 6.28, r = p.r + 1.5 + rnd() * 3, x = p.x + Math.cos(a) * r, z = p.z + Math.sin(a) * r;
      const yaw = a + Math.PI / 2, ux = Math.cos(yaw), uz = -Math.sin(yaw), span = 3.6;
      const x0 = x - ux * span / 2, z0 = z - uz * span / 2, x1 = x + ux * span / 2, z1 = z + uz * span / 2;
      if (!room.free(x0, z0, 0.5) || !room.free(x1, z1, 0.5) || !room.free(x, z, 1.2) || beyond(x, z) > -2) continue;
      room.take(x, z, 2.4);
      const top = 3.5; // the cloths' feet stay 2.5 m up, over the heads: the line stands on walkable ground (as the Sea's washing)
      for (const [px, pz] of [[x0, z0], [x1, z1]]) kit.add(PAL.wood, cyl(0.06, 0.07, top + 0.1), px, 0, pz);
      kit.add(PAL.rope, new THREE.CylinderGeometry(0.014, 0.014, span, 4).rotateZ(Math.PI / 2), x, top, z, yaw);
      let at = 0.2;
      while (at < span - 0.4) {
        // long narrow bandages among the sheets (the linen a shade down: in the evening sun white glares)
        const bandage = rnd() < 0.5, w = bandage ? 0.18 + rnd() * 0.08 : Math.min(span - 0.2 - at, 0.8 + rnd() * 0.4), hh = Math.min(top - 2.5, bandage ? 1.1 + rnd() * 0.4 : 0.9 + rnd() * 0.4);
        if (at + w > span - 0.2) break;
        cloth.add(mtx(x0 + ux * at, top, z0 + uz * at, Math.atan2(-uz, ux)).multiply(new THREE.Matrix4().makeTranslation(0, -hh, 0)), w, hh, bandage ? 0xb8b0a0 : LINEN, 1, 0.7);
        at += w + 0.08 + rnd() * 0.15;
      }
      lines++;
      made++;
    }
  }
  counts.lines = lines;

  // --- the wagon train's horses, tethered at the wagons ------------------------------------------------------------------------
  const horseHomes: { x: number; z: number }[] = [];
  for (const p of L.places) {
    if (p.kind !== 'wagons') continue;
    for (let t = 0, made = 0; t < 60 && made < (lite ? 1 : 3); t++) {
      const a = rnd() * 6.28, r = p.r + 1.5 + rnd() * 4, x = p.x + Math.cos(a) * r, z = p.z + Math.sin(a) * r;
      if (!room.free(x, z, 1.4, { road: 3 }) || beyond(x, z) > -3) continue;
      room.take(x, z, 2.8);
      horseHomes.push({ x, z });
      made++;
    }
  }
  const horses = new Beasts(env, beastGeometry({
    s: 1.3, shoulder: 1.6, len: 1.75, girth: 0.82, neck: 0.85, head: 0.62, leg: 0.085, ears: 'point', tail: 'hang',
    colors: { body: 0x4a3226, under: 0x3e2a20, leg: 0x2a1e18, head: 0x4a3226, ear: 0x2a1e18, tail: 0x1d1b21 },
  }), horseHomes, { shy: 2.8, watch: true, walk: 0.8, run: 1.4, stride: 2, flee: 3.5, ok: (x, z) => beyond(x, z) < -2.5, danger: () => false, graze: 0.8 });
  where.horses.push(...horseHomes);
  counts.horses = horses.count;

  // --- ash drifting down round the hero ---------------------------------------------------------------------------------------
  const ash = new Motes(env, {
    n: lite ? 60 : 140, shape: 'flake', size: 0.13, colors: [0x6a6668, 0x8a8688, 0x4a4648, 0x7a7476],
    around: { box: [44, 9, 44], base: 0, vel: [wind.x * 0.9, -0.55, wind.y * 0.9], sway: 0.6 }, spin: 2.2,
  });
  counts.ash = ash.count;

  // --- perches on the field --------------------------------------------------------------------------------------------------
  for (let k = 0, t = 0; k < 10 * wide && t < 600; t++) {
    const a = rnd() * 6.28, r = Math.sqrt(rnd()) * (rmean - 6), x = RING.x + Math.cos(a) * r, z = RING.z + Math.sin(a) * r;
    if (beyond(x, z) > -3 || room.road(x, z) < 2 || room.cover(x, z) < 1) continue;
    perches.push({ x, y: 0.02, z });
    k++;
  }
  counts.perches = perches.length;

  // --- the crows ------------------------------------------------------------------------------------------------------------------
  const centres = L.places.map((p) => ({ x: p.x, z: p.z, r: 14 }));
  const nBirds = Math.round((lite ? 8 : 16) * wide);
  // (a carrion crow spans 0.95 m; beside the heroes, drawn 1.3 times life size, about 1.25)
  const crows = new Flock(env, birdGeometry({ span: 1.25, body: 0.55, colors: { body: 0x1d1b21, wing: 0x26242a, tip: 0x141218, beak: PAL.iron } }), perches, {
    n: nBirds, soarers: lite ? 1 : 3, shy: 6, heights: [7, 12], speed: 6, flapHz: 3, centres, danger: inp.danger,
  }, hero);
  counts.crows = nBirds;
  env.group.userData.gulls = crows;

  // --- people walking beside the roads -----------------------------------------------------------------------------------------
  let walkers: Walkers | null = null;
  if (!lite && !(globalThis as { __lifeNoPeople?: boolean }).__lifeNoPeople) {
    const chosen = walkerRoutes(L.paths, (x, z) => room.packNear(x, z) > 14 && room.cover(x, z) > 0.6 && beyond(x, z) < -2, 3);
    walkers = new Walkers(env, chosen, walkerModel('war', def.n), inp.danger);
    for (const r of chosen) where.walkers.push(r[Math.floor(r.length / 2)]);
  }
  counts.walkers = walkers?.count ?? 0;
  env.group.userData.walkers = walkers;

  smoke.build(0x8a8682, 0.45);
  dark.build(0x4a4648, 0.5);
  counts.smoke = smoke.count + dark.count;
  cloth.done();
  counts.cloth = cloth.count;
  counts.dressing = kit.parts;
  kit.build();
  env.group.userData.beasts = { horses };

  return {
    counts,
    update(dt) {
      crows.update(dt, hero);
      horses.update(dt, hero);
      ash.follow(hero);
      walkers?.update(dt, hero);
    },
    dispose() {},
  };
}
