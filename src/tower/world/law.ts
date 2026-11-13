import * as THREE from 'three';
import { RING } from '../../arenas/common';
import type { Obstacle } from '../../obstacles';
import { softDotTexture } from '../../effects/common';
import { LightPillar } from '../../raid/fx';
import type { RoomFloor } from '../../raid/types';
import type { ZoneCtx } from './ctx';
import type { LawDef, Region } from './def';
import { buildLaw45 } from './f45/laws';

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
        z.banner('The tide is turning', 'Get onto dry ground, off the flats', 2.6);
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

/**
 * A wall of sand that crosses the zone from the north rim to the south one (`every` s, `lasts` s long, the first at `every`), `width` m
 * deep, warned `warn` s before. Inside it the hero sees only `sight` steps (a page layer) and takes `burn` of its max health a second
 * (the duel's own room floor), unless a rock stands upwind of it: the wind blows towards +z, so a piece of cover within `shelter` m to
 * the north of the hero puts it in the rock's lee (`rayStop`). The dust wraiths come out of the band while it is over the hero and
 * dissolve when it has passed. The band's place is read from the clock, so it is where it should be after any rebuild.
 */
function storm(z: ZoneCtx, d: Extract<LawDef, { kind: 'storm' }>): Law {
  const R = z.def.ring, shelter = d.shelter ?? 7, sight = d.sight ?? 5;
  const north = RING.z - R - d.width / 2, travel = 2 * R + d.width;
  const mat = new THREE.MeshBasicMaterial({ color: 0xc89a5a, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide, fog: false });
  const geo = new THREE.BoxGeometry(R * 2.3, 7, d.width);
  const band = new THREE.Mesh(geo, mat);
  band.visible = false;
  // The wall's face (the south side, the way it goes): streaks of dust that read as a front from the camera.
  const faceTex = (() => {
    const c = document.createElement('canvas');
    c.width = 256; c.height = 64;
    const g = c.getContext('2d')!;
    const grad = g.createLinearGradient(0, 64, 0, 0);
    grad.addColorStop(0, 'rgba(120,80,40,0.95)'); grad.addColorStop(0.6, 'rgba(210,160,90,0.85)'); grad.addColorStop(1, 'rgba(230,190,120,0)');
    g.fillStyle = grad; g.fillRect(0, 0, 256, 64);
    for (let i = 0; i < 90; i++) { g.fillStyle = `rgba(255,${200 + (i % 40)},140,${0.05 + (i % 7) * 0.02})`; g.fillRect((i * 37) % 256, (i * 11) % 60, 30 + (i % 5) * 10, 2); }
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  })();
  const faceMat = new THREE.MeshBasicMaterial({ map: faceTex, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide, fog: false });
  const faceGeo = new THREE.PlaneGeometry(R * 2.3, 11);
  const face = new THREE.Mesh(faceGeo, faceMat);
  face.position.set(RING.x, 5.5, 0);
  face.visible = false;
  // Dust blowing through the band.
  const N = 260, dpos = new Float32Array(N * 3), dph = new Float32Array(N * 2);
  for (let i = 0; i < N; i++) { dph[i * 2] = Math.random(); dph[i * 2 + 1] = Math.random() * 6.28; }
  const dgeo = new THREE.BufferGeometry();
  dgeo.setAttribute('position', new THREE.BufferAttribute(dpos, 3));
  const dmat = new THREE.PointsMaterial({ color: 0xe8c890, size: 0.55, sizeAttenuation: true, transparent: true, opacity: 0.6, depthWrite: false });
  const dust = new THREE.Points(dgeo, dmat);
  dust.frustumCulled = false;
  dust.visible = false;
  z.p.group.add(band, face, dust);
  // What the hero sees inside the band: a page layer under the HUD with a clear circle `sight` steps wide.
  const el = document.createElement('div');
  el.className = 'world-storm';
  el.style.cssText = 'position:fixed;inset:0;z-index:1;pointer-events:none;opacity:0;';
  el.style.background = `radial-gradient(circle at 50% 56%, rgba(214,170,106,0) 0, rgba(214,170,106,0.15) ${sight * 1.2}vmin, rgba(204,156,92,0.93) ${sight * 3.4}vmin, rgba(196,148,86,0.97) ${sight * 6}vmin)`;
  document.body.append(el);
  let fade = 0;
  const phase = (t: number) => {
    const k = t % d.every, active = t >= d.every && k < d.lasts, warn = !active && k > d.every - d.warn && t > d.every - d.warn;
    const f = active ? k / d.lasts : 0;
    return { active, warn, f, zb: north + f * travel, next: active ? 0 : d.every - k, k };
  };
  const hits = { burned: 0, sheltered: 0, wraiths: 0 };
  /** In the lee of a rock: cover within `shelter` m to the north. */
  const sheltered = (x: number, zz: number) => z.p.rayStop(x, zz, x, zz - shelter) < 0.999;
  const inBand = (zz: number, t = z.now()) => { const ph = phase(t); return ph.active && Math.abs(zz - ph.zb) <= d.width / 2; };
  const burn = (x: number, zz: number) => (inBand(zz) && !sheltered(x, zz) ? d.burn : 0);
  const floor: RoomFloor = { cover: [] as Obstacle[], name: 'The storm', safe: (x, zz) => burn(x, zz) === 0, burn };
  let lastWraith = -99, wraithN = 0, said = -1;
  const wraiths = () => [...z.packs.values()].filter((p) => p.id.startsWith('wraith-'));
  return {
    update(dt) {
      const t = z.now(), ph = phase(t), me = z.hero, time = performance.now() / 1000;
      band.visible = ph.active;
      face.visible = ph.active || ph.warn;
      dust.visible = ph.active;
      const cycle = Math.floor(t / d.every);
      if (ph.warn) {
        // The front is seen on the north rim before it comes.
        faceMat.opacity += (0.5 - faceMat.opacity) * Math.min(1, dt * 2);
        face.position.z = north + d.width / 2 + 2;
        if (said !== cycle) { said = cycle; z.banner('A wall of sand', 'Get behind a rock: it crosses from the north', 2.8); }
      } else if (ph.active) {
        faceMat.opacity += (0.85 - faceMat.opacity) * Math.min(1, dt * 3);
        face.position.z = ph.zb + d.width / 2;
      } else faceMat.opacity += (0 - faceMat.opacity) * Math.min(1, dt * 3);
      mat.opacity += ((ph.active ? 0.3 : 0) - mat.opacity) * Math.min(1, dt * 3);
      if (ph.active) {
        band.position.set(RING.x, 3.5, ph.zb);
        const p = dgeo.attributes.position as THREE.BufferAttribute;
        for (let i = 0; i < N; i++) {
          const u = (dph[i * 2] + time * 0.35 + i * 0.013) % 1;
          p.setXYZ(i, RING.x + (((i * 0.6180339) % 1) - 0.5) * R * 2.2 + Math.sin(time * 1.3 + dph[i * 2 + 1]) * 1.2, 0.4 + ((i * 7) % 60) / 10, ph.zb + (u - 0.5) * d.width);
        }
        p.needsUpdate = true;
      }
      // What the hero sees: the dust closes in while it stands in the band.
      const inside = inBand(me.z, t);
      fade += ((inside ? 1 : 0) - fade) * Math.min(1, dt * (inside ? 2.2 : 3));
      el.style.opacity = fade.toFixed(3);
      if (inside) (sheltered(me.x, me.z) ? hits.sheltered++ : hits.burned++);
      // The wraiths: out of the band while it is over the hero; gone when it has passed.
      if (d.wraiths) {
        const w = d.wraiths;
        for (const pk of wraiths()) if (!ph.active || !inBand(pk.home.z, t) || pk.state === 'cleared') { pk.dispose(); z.packs.delete(pk.id); }
        const alive = wraiths().reduce((n, pk) => n + pk.left, 0);
        if (inside && alive < w.most && t - lastWraith > w.every) {
          lastWraith = t;
          for (let i = 0; i < 8; i++) {
            const a = (wraithN * 2.4 + i * 0.8) % 6.28, x = me.x + Math.cos(a) * 11, zz = me.z + Math.sin(a) * 11;
            if (Math.hypot(x - RING.x, zz - RING.z) > R - 2 || !inBand(zz, t) || !z.api.arena.lineOfSight(new THREE.Vector3(x, 0, zz), new THREE.Vector3(me.x, 0, me.z))) continue;
            const pk = z.hunt({ id: `wraith-${wraithN++}`, at: { x, z: zz }, mix: [{ kind: w.kind, n: w.n }] });
            pk.spawn(true);
            hits.wraiths += w.n;
            break;
          }
        }
      }
    },
    floor: () => (phase(z.now()).active ? floor : null),
    status() {
      const ph = phase(z.now()), me = z.hero;
      const text = ph.active
        ? (inBand(me.z) ? (sheltered(me.x, me.z) ? 'IN THE STORM, in the lee of a rock: safe' : 'IN THE STORM: get behind a rock') : `The storm is crossing: ${Math.ceil(d.lasts - ph.k)} s`)
        : ph.warn ? `A wall of sand in ${Math.ceil(ph.next)} s: find a rock` : `The storm comes in ${Math.ceil(ph.next)} s`;
      // Never `active`: that lights the HUD's blue flood tint, which is the tide's.
      return { text, active: false, warn: ph.active || ph.warn };
    },
    safe: (x, zz, ahead = 0) => {
      const ph = phase(z.now() + ahead);
      if (!(ph.active || ph.warn)) return true;
      // Warned: the whole zone counts as in the path of the band, so safe means in a lee (or already past the band).
      return sheltered(x, zz) || (ph.active && zz < ph.zb - d.width / 2 - 1);
    },
    facts: () => { const ph = phase(z.now()); return { kind: 'storm', active: ph.active, zb: +ph.zb.toFixed(1), inBand: inBand(z.hero.z), lee: sheltered(z.hero.x, z.hero.z), ...hits }; },
    dispose() {
      band.removeFromParent(); face.removeFromParent(); dust.removeFromParent();
      geo.dispose(); mat.dispose(); faceGeo.dispose(); faceMat.dispose(); faceTex.dispose(); dgeo.dispose(); dmat.dispose();
      el.remove();
      for (const pk of wraiths()) { pk.dispose(); z.packs.delete(pk.id); }
    },
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

/**
 * Walls of roots rise and sink by the clock (`every` s; set `first` is up at the start, the other set after the first change): the cover
 * list changes and the navigator rebuilds on a change (`nav.ts` `sync`). Warned `warn` s before: an amber ring pulses where a wall will
 * rise or sink and the wall trembles. A way that is open shows a green light in it; a wall that is up is a hedge of roots with thorns.
 * Nobody is ever walled in: when a wall rises, the hero and every unit standing where it will be are set down beside it, on the side
 * they were on (`facts().pushed` counts them). Which set is up is read from the clock, so it is the same after any rebuild.
 */
function paths(z: ZoneCtx, d: Extract<LawDef, { kind: 'paths' }>): Law {
  const arena = z.api.arena, first = d.first ?? 0, warnS = d.warn ?? 0;
  const bark = new THREE.MeshStandardMaterial({ color: 0x3a2a1c, roughness: 0.9, flatShading: true });
  const moss = new THREE.MeshStandardMaterial({ color: 0x3f6a2e, roughness: 0.9, flatShading: true });
  const thorn = new THREE.MeshStandardMaterial({ color: 0x6a2f45, roughness: 0.8, flatShading: true });
  const ringMat = new THREE.MeshBasicMaterial({ color: 0xffb050, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide });
  const own: { dispose(): void }[] = [bark, moss, thorn, ringMat];
  const walls = d.walls.map((w) => {
    const dx = w.b.x - w.a.x, dz = w.b.z - w.a.z, len = Math.hypot(dx, dz), cx = (w.a.x + w.b.x) / 2, cz = (w.a.z + w.b.z) / 2;
    const o: Obstacle = { kind: 'wall', ax: w.a.x, az: w.a.z, bx: w.b.x, bz: w.b.z, r: w.r, height: w.height } as Obstacle;
    const group = new THREE.Group();
    group.position.set(cx, 0, cz);
    group.rotation.y = Math.atan2(dx, dz);
    const body = new THREE.BoxGeometry(w.r * 2, w.height * 0.55, len + w.r * 2).translate(0, w.height * 0.275, 0);
    const cap = new THREE.BoxGeometry(w.r * 1.5, 0.5, len).translate(0, w.height * 0.55, 0);
    const spike = new THREE.ConeGeometry(0.28, w.height * 0.55, 5);
    own.push(body, cap, spike);
    const mb = new THREE.Mesh(body, bark), mc = new THREE.Mesh(cap, moss);
    mb.castShadow = true;
    group.add(mb, mc);
    for (let k = 0; k < Math.floor(len / 1.5); k++) {
      const s = new THREE.Mesh(spike, thorn);
      s.position.set(((k % 3) - 1) * 0.35, w.height * 0.8, -len / 2 + 0.8 + k * 1.5);
      s.rotation.z = ((k % 3) - 1) * 0.35;
      group.add(s);
    }
    z.p.group.add(group);
    // The glow of an open way: two green lights on the ground where the barrier would stand, and a faint pillar.
    const pillar = new LightPillar(cx, cz, 1.4, 6, 0x7aff9a);
    z.p.group.add(pillar.mesh);
    const lamps = [-1, 1].map((s) => {
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: softDotTexture(), color: 0x9affb0, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.9 }));
      sp.position.set(cx + (dx / len) * s * Math.min(3, len * 0.3), 1.5, cz + (dz / len) * s * Math.min(3, len * 0.3));
      sp.scale.setScalar(2.2);
      z.p.group.add(sp);
      own.push(sp.material);
      return sp;
    });
    const rg = new THREE.RingGeometry(len * 0.32, len * 0.4, 32);
    own.push(rg);
    const ring = new THREE.Mesh(rg, ringMat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(cx, 0.12, cz);
    ring.visible = false;
    z.p.group.add(ring);
    return { w, o, group, up: 0, pillar, lamps, ring, cx, cz, len, dx, dz };
  });
  let set = -1, changes = 0, lastMs = 0, pushed = 0, said = -1;
  const setAt = (t: number) => ((Math.floor(t / d.every) + first) % 2) as 0 | 1;
  /** Sets `p` (a position) down beside wall `w` when it is within the wall's thickness, on the side it is on. */
  const clear = (p: THREE.Vector3, w: (typeof walls)[number]) => {
    const o = w.o, ex = o.bx - o.ax, ez = o.bz - o.az, l2 = ex * ex + ez * ez;
    const t = Math.max(0, Math.min(1, ((p.x - o.ax) * ex + (p.z - o.az) * ez) / l2)), qx = o.ax + ex * t, qz = o.az + ez * t;
    const dist = Math.hypot(p.x - qx, p.z - qz);
    if (dist >= o.r + 0.9) return false;
    let nx = p.x - qx, nz = p.z - qz;
    const n = Math.hypot(nx, nz);
    if (n < 1e-4) { nx = -ez / Math.sqrt(l2); nz = ex / Math.sqrt(l2); } else { nx /= n; nz /= n; }
    p.x = qx + nx * (o.r + 1.3);
    p.z = qz + nz * (o.r + 1.3);
    return true;
  };
  const apply = (s: 0 | 1) => {
    const t0 = performance.now();
    const cur = arena.obstacles ?? [];
    const next = cur.filter((o) => !walls.some((w) => w.o === o));
    const rising = walls.filter((w) => w.w.set === s);
    for (const w of rising) next.push(w.o);
    // A new list by value: the navigator compares it and rebuilds.
    arena.obstacles = next;
    // Nobody under a rising wall: the hero, the units on both sides.
    for (const w of rising) {
      if (clear(z.hero, w)) { z.api.heroMode.halt(); pushed++; }
      for (const side of ['hero', 'opponent'] as const) for (const u of arena.summons.alive(side)) if (clear(u.pos, w)) pushed++;
    }
    arena.route({}, new THREE.Vector3(z.hero.x, 0, z.hero.z), new THREE.Vector3(z.def.start.x, 0, z.def.start.z));
    lastMs = performance.now() - t0;
    changes++;
  };
  const names = (s: 0 | 1) => walls.filter((w) => w.w.set === s && w.w.name).map((w) => w.w.name).join(', ');
  return {
    update(dt) {
      const t = z.now(), s = setAt(t), k = t % d.every, time = performance.now() / 1000;
      if (s !== set) {
        const firstTime = set < 0;
        set = s;
        apply(s);
        if (!firstTime) z.banner('The wood moves', `Closed now: ${names(s)}. Open now: ${names((1 - s) as 0 | 1)}`, 3.2);
      }
      const warn = warnS > 0 && k > d.every - warnS && t > d.every - warnS;
      if (warn && said !== Math.floor(t / d.every)) {
        said = Math.floor(t / d.every);
        z.banner('The wood is stirring', `${names((1 - set) as 0 | 1)} will close; ${names(set as 0 | 1)} will open`, 3);
      }
      ringMat.opacity = warn ? 0.35 + 0.35 * Math.sin(time * 8) ** 2 : 0;
      for (const w of walls) {
        const up = w.w.set === set;
        w.up += ((up ? 1 : 0) - w.up) * Math.min(1, dt * 2.5);
        w.group.scale.y = Math.max(0.001, w.up);
        w.group.visible = w.up > 0.01;
        w.group.position.x = w.cx + (warn ? Math.sin(time * 40 + w.cx) * 0.05 : 0);
        w.ring.visible = warn;
        // The way is open (the wall is down or sinking): a green light in it, brighter the more open.
        const open = 1 - w.up;
        w.pillar.opacity = open > 0.9 ? 0.3 + 0.08 * Math.sin(time * 2 + w.cx) : 0;
        for (const l of w.lamps) { l.visible = open > 0.9; (l.material as THREE.SpriteMaterial).opacity = 0.7 + 0.2 * Math.sin(time * 3 + w.cz); }
      }
    },
    floor: noFloor,
    status() {
      const t = z.now(), k = t % d.every, next = d.every - k, warn = warnS > 0 && next < warnS && t > d.every - warnS;
      return { text: warn ? `THE WOOD MOVES in ${Math.ceil(next)} s: roots close and open the ways` : `The paths change in ${Math.ceil(next)} s`, active: false, warn };
    },
    safe: () => true,
    facts: () => ({ kind: 'paths', set, changes, lastRebuildMs: +lastMs.toFixed(2), pushed, up: walls.filter((w) => w.up > 0.5).length }),
    dispose() {
      arena.obstacles = (arena.obstacles ?? []).filter((o) => !walls.some((w) => w.o === o));
      for (const w of walls) { w.group.removeFromParent(); w.pillar.dispose(); w.ring.removeFromParent(); for (const l of w.lamps) l.removeFromParent(); }
      for (const o of own) o.dispose();
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

/** The law of each zone (for the parts that ask what the law says: the escort waits out a storm in a lee). */
export const lawOf = new WeakMap<object, Law>();

export function buildLaw(z: ZoneCtx, d: LawDef): Law {
  const law = (() => {
    // Floors 4 and 5's `dark` and `sides` are the full pieces (f45/laws.ts); the scratch ones below are what the tool's `_worldVerbs` still plays.
    const full = buildLaw45(z, d);
    if (full) return full;
    switch (d.kind) {
      case 'tide': return tide(z, d);
      case 'storm': return storm(z, d);
      case 'dark': return dark(z, d);
      case 'paths': return paths(z, d);
      case 'sides': return sides(z, d);
    }
  })();
  lawOf.set(z, law);
  return law;
}
