import * as THREE from 'three';
import { RING } from '../../arenas/common';
import type { Obstacle } from '../../obstacles';
import type { RoomFloor } from '../../raid/types';
import type { ZoneCtx } from './ctx';
import type { LawDef, Region } from './def';

/**
 * A floor's law, one rule of the zone's cast (pipeline/designs/tower-worlds-build.md, "Law pieces"). The state is read from the
 * run's clock (the tide's phase is `clock mod every`), so it is the same after any rebuild. `tide` is the full piece for floor 1;
 * `storm`, `dark`, `paths` and `sides` are built from the same engine pieces and tried once each in the tool's scratch zone
 * (`_worldVerbs`): what each has and what stage 2 still owes is in the plan file.
 */

export interface LawStatus { text: string; active: boolean; warn: boolean }

export interface Law {
  update(dt: number): void;
  /** The duel's own floor that hurts (`BossDef.floor`), or null while nothing does. */
  floor(): RoomFloor | null;
  status(): LawStatus;
  dispose(): void;
  /** For the route bot: standing here is safe from the law now (or soon: `ahead` seconds from now). */
  safe(x: number, z: number, ahead?: number): boolean;
  /** For the tool: what has happened, a few facts. */
  facts(): Record<string, unknown>;
}

const noFloor = () => null;

function inRegion(r: Region, x: number, z: number) {
  const c = Math.cos(r.rot ?? 0), s = Math.sin(r.rot ?? 0), dx = x - r.x, dz = z - r.z;
  const u = (dx * c + dz * s) / r.rx, v = (-dx * s + dz * c) / r.rz;
  return u * u + v * v <= 1;
}

// --- the tide ---------------------------------------------------------------------------------------------------------

function tide(z: ZoneCtx, d: Extract<LawDef, { kind: 'tide' }>): Law {
  const group = new THREE.Group();
  z.p.group.add(group);
  const water = new THREE.MeshBasicMaterial({ color: 0x2c7fae, transparent: true, opacity: 0.1, depthWrite: false });
  const edge = new THREE.MeshBasicMaterial({ color: 0x6ec8ff, transparent: true, opacity: 0.45, depthWrite: false, side: THREE.DoubleSide });
  const foam = new THREE.MeshBasicMaterial({ color: 0xcfefff, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide });
  const geos: THREE.BufferGeometry[] = [];
  const meshes = d.low.map((r) => {
    const geo = new THREE.CircleGeometry(1, 40);
    geos.push(geo);
    const m = new THREE.Mesh(geo, water);
    m.rotation.x = -Math.PI / 2;
    m.rotation.z = -(r.rot ?? 0);
    m.scale.set(r.rx, r.rz, 1);
    m.position.set(r.x, 0.05, r.z);
    m.renderOrder = 1;
    // the edge: a band on the ground that stays visible, so which ground is low is always readable (amber as the tide turns)
    const edgeGeo = new THREE.RingGeometry(0.93, 1, 48);
    geos.push(edgeGeo);
    const loop = new THREE.Mesh(edgeGeo, edge);
    loop.rotation.x = -Math.PI / 2;
    loop.rotation.z = -(r.rot ?? 0);
    loop.scale.set(r.rx, r.rz, 1);
    loop.position.set(r.x, 0.09, r.z);
    loop.renderOrder = 2;
    // foam: a ring that breathes while it floods
    const ringGeo = new THREE.RingGeometry(0.86, 1, 40);
    geos.push(ringGeo);
    const ring = new THREE.Mesh(ringGeo, foam);
    ring.rotation.x = -Math.PI / 2;
    ring.rotation.z = -(r.rot ?? 0);
    ring.scale.set(r.rx, r.rz, 1);
    ring.position.set(r.x, 0.11, r.z);
    ring.renderOrder = 2;
    group.add(m, loop, ring);
    return { m, ring };
  });
  const phase = (t: number) => {
    const k = t % d.every;
    const active = t >= d.every && k < d.lasts;
    const warn = !active && k > d.every - d.warn && t > d.every - d.warn;
    const next = active ? 0 : d.every - k;
    return { active, warn, next, left: active ? d.lasts - k : 0 };
  };
  const low = (x: number, zz: number) => d.low.some((r) => inRegion(r, x, zz));
  let said = -1, was = false;
  let burned = 0, deepest = 0;
  const floor: RoomFloor = {
    cover: [] as Obstacle[], name: 'The tide', safe: (x, zz) => !phase(z.now()).active || !low(x, zz), burn: (x, zz) => (phase(z.now()).active && low(x, zz) ? d.burn : 0),
  };
  return {
    update(dt) {
      const t = z.now(), ph = phase(t), time = performance.now() / 1000;
      const lvl = ph.active ? 0.5 : ph.warn ? 0.22 + 0.1 * Math.sin(time * 6) : 0.1;
      water.opacity += (lvl - water.opacity) * Math.min(1, dt * 4);
      edge.color.setHex(ph.warn ? 0xffd27a : ph.active ? 0xcfefff : 0x6ec8ff);
      edge.opacity = ph.warn ? 0.55 + 0.4 * Math.sin(time * 8) ** 2 : 0.45;
      foam.opacity = ph.active ? 0.35 + 0.25 * Math.sin(time * 3) : 0;
      meshes.forEach(({ m, ring }, i) => {
        m.position.y = 0.05 + (ph.active ? 0.05 + 0.02 * Math.sin(time * 2 + i) : 0);
        ring.scale.set(d.low[i].rx * (1 + 0.03 * Math.sin(time * 3 + i)), d.low[i].rz * (1 + 0.03 * Math.sin(time * 3 + i)), 1);
      });
      // The warning comes once a cycle.
      const cycle = Math.floor(t / d.every);
      if (ph.warn && said !== cycle) {
        said = cycle;
        z.banner('The tide is turning', 'Get onto dry ground: the quays and decks', 2.6);
      }
      if (ph.active && !was) z.banner('The sea comes in', 'The low ground is flooded', 2);
      was = ph.active;
      const me = z.hero, wet = ph.active && low(me.x, me.z);
      z.speed('tide', wet ? d.slow : 1);
      if (wet) { burned += dt; deepest = Math.max(deepest, burned); } else burned = 0;
    },
    floor: () => (phase(z.now()).active ? floor : null),
    status() {
      const ph = phase(z.now());
      const text = ph.active ? `THE SEA IS IN: ${Math.ceil(ph.left)} s. Stay on dry ground` : ph.warn ? `The tide is turning in ${Math.ceil(ph.next)} s: reach dry ground` : `The tide comes in ${Math.ceil(ph.next)} s`;
      return { text, active: ph.active, warn: ph.warn };
    },
    safe: (x, zz, ahead = 0) => {
      const ph = phase(z.now() + ahead);
      return !low(x, zz) || (!ph.active && !ph.warn);
    },
    facts: () => ({ kind: 'tide', active: phase(z.now()).active, regions: d.low.length }),
    dispose() {
      group.removeFromParent();
      for (const g of geos) g.dispose();
      water.dispose();
      edge.dispose();
      foam.dispose();
    },
  };
}

// --- the storm --------------------------------------------------------------------------------------------------------

/** A band of dust that crosses the zone from north to south: it burns whoever stands in it unless something stands between them and the wind. */
function storm(z: ZoneCtx, d: Extract<LawDef, { kind: 'storm' }>): Law {
  const R = z.def.ring, mid = { x: RING.x, z: RING.z + 5.5 };
  const mat = new THREE.MeshBasicMaterial({ color: 0xd8b070, transparent: true, opacity: 0, depthWrite: false, blending: THREE.NormalBlending, side: THREE.DoubleSide });
  const geo = new THREE.BoxGeometry(R * 2.2, 6, d.width);
  const band = new THREE.Mesh(geo, mat);
  band.visible = false;
  z.p.group.add(band);
  const phase = (t: number) => {
    const k = t % d.every, active = t >= d.every && k < d.lasts, warn = !active && k > d.every - d.warn && t > d.every - d.warn;
    // The band's middle runs from the north rim to the south one while it lasts.
    const f = active ? k / d.lasts : 0;
    return { active, warn, f, zb: mid.z - 38 + f * 76, next: active ? 0 : d.every - k };
  };
  const hits = { burned: 0, sheltered: 0 };
  const sheltered = (x: number, zz: number) => z.p.rayStop(x + 14, zz, x, zz) < 0.999;
  const burn = (x: number, zz: number) => {
    const ph = phase(z.now());
    if (!ph.active || Math.abs(zz - ph.zb) > d.width / 2) return 0;
    return sheltered(x, zz) ? 0 : d.burn;
  };
  const floor: RoomFloor = { cover: [] as Obstacle[], name: 'The storm', safe: (x, zz) => burn(x, zz) === 0, burn };
  return {
    update() {
      const ph = phase(z.now());
      band.visible = ph.active || ph.warn;
      band.position.set(R * 0, 3, ph.active ? ph.zb : mid.z - 40);
      mat.opacity += ((ph.active ? 0.5 : ph.warn ? 0.14 : 0) - mat.opacity) * 0.1;
      if (ph.warn) z.banner('A wall of sand', 'Get behind a rock', 1.6);
      const me = z.hero;
      if (ph.active && Math.abs(me.z - ph.zb) < d.width / 2) (sheltered(me.x, me.z) ? hits.sheltered++ : hits.burned++);
    },
    floor: () => (phase(z.now()).active ? floor : null),
    status() {
      const ph = phase(z.now());
      return { text: ph.active ? 'THE STORM IS HERE: get behind a rock' : `The storm crosses in ${Math.ceil(ph.next)} s`, active: ph.active, warn: ph.warn };
    },
    safe: (x, zz, ahead = 0) => {
      const ph = phase(z.now() + ahead);
      return !(ph.active || ph.warn) || sheltered(x, zz) || Math.abs(zz - ph.zb) > d.width;
    },
    facts: () => ({ kind: 'storm', ...hits }),
    dispose() { band.removeFromParent(); geo.dispose(); mat.dispose(); },
  };
}

// --- the dark ---------------------------------------------------------------------------------------------------------

/** Only lights give light: a page layer under the HUD (as the weekly Tower's Lightless twist) whose clear circle grows near lit things. */
function dark(z: ZoneCtx, d: Extract<LawDef, { kind: 'dark' }>): Law {
  const el = document.createElement('div');
  el.className = 'world-dark';
  el.style.cssText = 'position:fixed;inset:0;z-index:1;pointer-events:none;';
  document.body.append(el);
  let radius = d.radius;
  const litNear = () => {
    // A light is lit when its thing is in the run's `lit`; a carried shard lights a few steps.
    let best = 0;
    for (const l of d.lights) {
      const id = z.def.quests.flatMap((q) => q.steps).flatMap((s) => (s.verb === 'light' ? s.things : [])).find((t) => Math.hypot(t.at.x - l.x, t.at.z - l.z) < 0.5)?.id;
      if (id && z.run.lit.includes(id)) best = Math.max(best, 1 - Math.min(1, Math.hypot(z.hero.x - l.x, z.hero.z - l.z) / 24));
    }
    return best;
  };
  const paint = () => {
    el.style.background = `radial-gradient(circle at 50% 55%, transparent 0, transparent ${radius * 0.6}vmin, rgba(2,2,8,0.55) ${radius}vmin, rgba(2,2,8,0.92) ${radius * 1.7}vmin)`;
  };
  paint();
  return {
    update(dt) {
      const want = d.radius + (z.run.carry?.held ? d.lit * 0.4 : 0) + d.lit * litNear();
      radius += (want - radius) * Math.min(1, dt * 3);
      paint();
    },
    floor: noFloor,
    status: () => ({ text: `Only light helps: ${Math.round(radius)} steps clear`, active: false, warn: false }),
    safe: () => true,
    facts: () => ({ kind: 'dark', radius: +radius.toFixed(1) }),
    dispose() { el.remove(); },
  };
}

// --- the paths --------------------------------------------------------------------------------------------------------

/** Walls rise and sink by the clock: the cover list changes, and the navigator rebuilds on a change (`nav.ts` `sync`). */
function paths(z: ZoneCtx, d: Extract<LawDef, { kind: 'paths' }>): Law {
  const arena = z.api.arena;
  const walls = d.walls.map((w) => {
    const dx = w.b.x - w.a.x, dz = w.b.z - w.a.z;
    const o: Obstacle = { kind: 'wall', ax: w.a.x, az: w.a.z, bx: w.b.x, bz: w.b.z, r: w.r, height: w.height } as Obstacle;
    const mat = new THREE.MeshStandardMaterial({ color: 0x2a3a22, roughness: 0.9, flatShading: true });
    const geo = new THREE.BoxGeometry(w.r * 2, w.height, Math.hypot(dx, dz) + w.r * 2);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set((w.a.x + w.b.x) / 2, 0, (w.a.z + w.b.z) / 2);
    mesh.rotation.y = Math.atan2(dx, dz);
    mesh.castShadow = true;
    z.p.group.add(mesh);
    return { w, o, mesh, mat, geo, up: 0 };
  });
  let set = -1, changes = 0, lastMs = 0;
  const want = () => (Math.floor(z.now() / d.every) % 2) as 0 | 1;
  const apply = (s: 0 | 1) => {
    const t0 = performance.now();
    const cur = arena.obstacles ?? [];
    const next = cur.filter((o) => !walls.some((w) => w.o === o));
    for (const w of walls) if (w.w.set === s) next.push(w.o);
    // A new list by value: the navigator compares it and rebuilds.
    arena.obstacles = next;
    arena.route({}, new THREE.Vector3(z.hero.x, 0, z.hero.z), new THREE.Vector3(z.def.start.x, 0, z.def.start.z));
    lastMs = performance.now() - t0;
    changes++;
  };
  return {
    update(dt) {
      const s = want();
      if (s !== set) {
        const first = set < 0;
        set = s;
        apply(s);
        if (!first) z.banner('The wood moves', 'A way closes, another opens', 2.2);
      }
      for (const w of walls) {
        w.up += ((w.w.set === set ? 1 : 0) - w.up) * Math.min(1, dt * 2.5);
        w.mesh.scale.y = Math.max(0.001, w.up);
        w.mesh.position.y = (w.w.height * w.up) / 2 - (1 - w.up) * 0.1;
      }
    },
    floor: noFloor,
    status: () => ({ text: `The paths change in ${Math.ceil(d.every - (z.now() % d.every))} s`, active: false, warn: false }),
    safe: () => true,
    facts: () => ({ kind: 'paths', set, changes, lastRebuildMs: +lastMs.toFixed(2) }),
    dispose() {
      arena.obstacles = (arena.obstacles ?? []).filter((o) => !walls.some((w) => w.o === o));
      for (const w of walls) { w.mesh.removeFromParent(); w.geo.dispose(); w.mat.dispose(); }
    },
  };
}

// --- sides ------------------------------------------------------------------------------------------------------------

/** A banner taken in the camp: its packs stay asleep for good; every other pack hunts from further off. */
function sides(z: ZoneCtx, d: Extract<LawDef, { kind: 'sides' }>): Law {
  let taken: string | null = (z.run as unknown as { banner?: string }).banner ?? null;
  const flags = d.banners.map((b) => {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 3.2, 5), new THREE.MeshStandardMaterial({ color: 0x4a3626 }));
    const cloth = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 0.9), new THREE.MeshBasicMaterial({ color: b.color ?? 0xb03030, side: THREE.DoubleSide }));
    pole.position.set(b.at.x, 1.6, b.at.z);
    cloth.position.set(b.at.x + 0.7, 2.7, b.at.z);
    z.p.group.add(pole, cloth);
    return { b, pole, cloth };
  });
  const apply = () => {
    for (const b of d.banners) for (const id of b.packs) {
      const pk = z.packs.get(id);
      if (!pk) continue;
      if (b.id === taken) { pk.off = true; pk.dispose(); } else { pk.off = false; pk.leashAt = 40; }
    }
  };
  apply();
  return {
    update() {
      if (taken) return;
      for (const f of flags) if (Math.hypot(z.hero.x - f.b.at.x, z.hero.z - f.b.at.z) < 2) {
        taken = f.b.id;
        (z.run as unknown as { banner?: string }).banner = taken;
        apply();
        z.banner(`You take the ${f.b.name}`, 'Its soldiers leave you be; the others hunt you', 3);
      }
    },
    floor: noFloor,
    status: () => ({ text: taken ? `Banner: ${d.banners.find((b) => b.id === taken)?.name}` : 'Take a banner in the camp', active: false, warn: false }),
    safe: () => true,
    facts: () => ({ kind: 'sides', taken }),
    dispose() { for (const f of flags) { f.pole.removeFromParent(); f.cloth.removeFromParent(); } },
  };
}

export function buildLaw(z: ZoneCtx, d: LawDef): Law {
  switch (d.kind) {
    case 'tide': return tide(z, d);
    case 'storm': return storm(z, d);
    case 'dark': return dark(z, d);
    case 'paths': return paths(z, d);
    case 'sides': return sides(z, d);
  }
}
