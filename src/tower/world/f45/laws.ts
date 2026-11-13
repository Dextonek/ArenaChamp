import * as THREE from 'three';
import { softDotTexture } from '../../../effects/common';
import type { SummonUnit } from '../../../effects/summon';
import type { Law } from '../law';
import type { ZoneCtx } from '../ctx';
import type { LawDef, Spot, Step } from '../def';
import { EXTRA_LOOKS } from './looks';

/**
 * The laws of floors 4 and 5 in full (pipeline/designs/tower-worlds-floors45.md): `dark` and `sides`. Stage 1 built each once in a scratch
 * zone as a plain piece (`../law.ts`); `buildLaw` asks `buildLaw45` first, so floors 4 and 5 get these and floor 1's tide and the
 * other floors' laws are untouched. Everything here reads the floor's data and the run, and draws nothing the run does not hold.
 */

type Kind = 'dark' | 'sides';
export function buildLaw45(z: ZoneCtx, d: LawDef): Law | null {
  if (d.kind === 'dark') return dark(z, d);
  if (d.kind === 'sides') return sides(z, d);
  return null;
}
export const isLaw45 = (k: LawDef['kind']): k is Kind => k === 'dark' || k === 'sides';

const dist = (a: Spot, b: Spot) => Math.hypot(a.x - b.x, a.z - b.z);

// --- the dark -----------------------------------------------------------------------------------------------------------

/** What the dark law puts on the screen, in metres of ground: the hero's own circle (`radius`), a lit hall's (`lit`), the camp's lamps. */
export const DARK = { holeCamp: 0.5, holeStone: 5, glimmer: 2.6, beacon: 3.6, carryBonus: 0.35, wakeDark: 15 } as const;

/**
 * Only light gives light. A screen layer (a small canvas under the HUD, 1/4 size) is dark all over with soft clear holes cut in it, each
 * at the screen place of a spot on the ground: the hero (wider with a carried shard), the camp's lamps, a stone that was touched, a crystal
 * woken (a hall, for good), a dim glimmer at one still asleep, and a small beacon over the place the main quest asks for (a way to steer
 * by: the edge arrow only shows when the place is off the screen). A hole is an ellipse as the ground's circle is seen from the camera.
 * Lurkers wake from further off when the hero stands in the dark; in the light they sleep as any pack.
 */
function dark(z: ZoneCtx, d: Extract<LawDef, { kind: 'dark' }>): Law {
  const cv = document.createElement('canvas');
  cv.className = 'world-dark';
  cv.style.cssText = 'position:fixed;left:0;top:0;width:100%;height:100%;z-index:1;pointer-events:none;';
  document.body.append(cv);
  const g2 = cv.getContext('2d')!;
  const SCALE = 0.25;
  const crystals = z.def.quests.flatMap((q) => q.steps).flatMap((s) => (s.verb === 'light' ? s.things : []));
  const woken = () => crystals.filter((c) => z.run.lit.includes(c.id));
  const stones = () => z.def.waystones.filter((w) => z.run.waystones.includes(w.id));
  const main = z.def.quests.find((q) => q.main);
  const goal = (): Spot | null => {
    if (!main) return null;
    const st = z.run.q(main.id), s: Step | undefined = main.steps[st.step];
    if (!st.taken || st.done || !s) return null;
    switch (s.verb) {
      case 'reach': case 'hold': return s.at;
      case 'light': return s.things.find((t) => !z.run.lit.includes(t.id))?.at ?? null;
      case 'carry': return z.run.carry?.held ? s.to : z.run.carry ? z.run.carry.at : s.from;
      case 'open': return z.def.doors.find((x) => x.id === s.door)?.at ?? null;
      default: return null;
    }
  };
  const litBy = (x: number, zz: number) => {
    const here = { x, z: zz };
    if (d.lights.some((l) => dist(l, here) < d.lit * DARK.holeCamp)) return true;
    if (woken().some((c) => dist(c.at, here) < d.lit * 0.9)) return true;
    return stones().some((w) => dist(w.at, here) < DARK.holeStone * 0.8);
  };
  // The halls on the ground: a soft cool disc and a glow where a crystal is woken, drawn in the world (they show through the holes).
  const group = new THREE.Group();
  z.p.group.add(group);
  const own: { dispose(): void }[] = [];
  const discGeo = new THREE.CircleGeometry(1, 40);
  own.push(discGeo);
  const discMat = new THREE.MeshBasicMaterial({ color: 0x6a8cff, transparent: true, opacity: 0.1, depthWrite: false, blending: THREE.AdditiveBlending });
  const glowMat = new THREE.SpriteMaterial({ map: softDotTexture(), color: 0x8fe8ff, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.95 });
  own.push(discMat, glowMat);
  const halls = new Map<string, { disc: THREE.Mesh; glow: THREE.Sprite }>();
  const hall = (id: string, at: Spot) => {
    let h = halls.get(id);
    if (!h) {
      const disc = new THREE.Mesh(discGeo, discMat);
      disc.rotation.x = -Math.PI / 2;
      disc.scale.setScalar(d.lit * 0.9);
      disc.position.set(at.x, 0.06, at.z);
      disc.renderOrder = 1;
      const glow = new THREE.Sprite(glowMat);
      glow.position.set(at.x, 2.4, at.z);
      glow.scale.setScalar(7);
      group.add(disc, glow);
      h = { disc, glow };
      halls.set(id, h);
    }
    return h;
  };
  for (const c of woken()) hall(c.id, c.at);

  let t = 0, radius = d.radius, heroDark = true, minR = 1e9, maxR = 0, holes = 0, wokeDark = 0;
  const ground = (x: number, zz: number, r: number) => {
    const c = z.project(x, 0, zz), e = z.project(x + r, 0, zz), n = z.project(x, 0, zz - r), f = z.project(x, 0, zz + r);
    if (c.behind) return null;
    const k = SCALE;
    return { cx: c.x * k, cy: c.y * k, rx: Math.max(2, Math.abs(e.x - c.x) * k), ry: Math.max(2, Math.abs(f.y - n.y) * 0.5 * k) };
  };
  const hole = (x: number, zz: number, r: number, alpha = 1, core = 0.55) => {
    const q = ground(x, zz, r);
    if (!q) return;
    holes++;
    g2.save();
    g2.translate(q.cx, q.cy);
    g2.scale(q.rx, q.ry);
    const gr = g2.createRadialGradient(0, 0, 0, 0, 0, 1);
    gr.addColorStop(0, `rgba(0,0,0,${alpha})`);
    gr.addColorStop(core, `rgba(0,0,0,${alpha})`);
    gr.addColorStop(1, 'rgba(0,0,0,0)');
    g2.fillStyle = gr;
    g2.beginPath();
    g2.arc(0, 0, 1, 0, Math.PI * 2);
    g2.fill();
    g2.restore();
  };
  const paint = () => {
    const w = Math.max(8, Math.round(innerWidth * SCALE)), h = Math.max(8, Math.round(innerHeight * SCALE));
    if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; }
    holes = 0;
    g2.globalCompositeOperation = 'source-over';
    g2.clearRect(0, 0, w, h);
    g2.fillStyle = 'rgba(2,2,10,0.95)';
    g2.fillRect(0, 0, w, h);
    g2.globalCompositeOperation = 'destination-out';
    const me = z.hero;
    hole(me.x, me.z, radius * 1.3);
    for (const l of d.lights) hole(l.x, l.z, d.lit * DARK.holeCamp * 1.15);
    for (const s of stones()) hole(s.at.x, s.at.z, DARK.holeStone);
    for (const c of woken()) hole(c.at.x, c.at.z, d.lit * 1.15);
    for (const c of crystals) if (!z.run.lit.includes(c.id)) hole(c.at.x, c.at.z, DARK.glimmer, 0.7, 0.3);
    const gl = goal();
    if (gl && dist(gl, me) > radius * 1.3) hole(gl.x, gl.z, DARK.beacon, 0.8, 0.35);
    g2.globalCompositeOperation = 'source-over';
  };
  const lurkerPacks = [...z.packs.values()].filter((p) => p.def.mix.some((m) => z.def.enemies[m.kind]?.look === ('lurker' as never)));
  return {
    update(dt) {
      t += dt;
      const me = z.hero;
      const want = d.radius + (z.run.carry?.held ? d.radius * DARK.carryBonus : 0);
      radius += (want - radius) * Math.min(1, dt * 3);
      minR = Math.min(minR, radius);
      maxR = Math.max(maxR, radius);
      heroDark = !litBy(me.x, me.z);
      // Lurkers hunt in the dark: asleep packs of them wake from further off when the hero stands outside every light.
      if (heroDark) for (const p of lurkerPacks) if (p.state === 'asleep' && !p.off && dist(p.home, me) < DARK.wakeDark) { p.wake('dark'); wokeDark++; }
      for (const c of woken()) {
        const h = hall(c.id, c.at);
        h.glow.scale.setScalar(6.5 + 0.8 * Math.sin(t * 2.4));
      }
      paint();
    },
    floor: () => null,
    status: () => ({ text: heroDark ? `Only crystals give light: ${Math.round(radius)} steps clear` : 'In the light', active: false, warn: false }),
    safe: () => true,
    facts: () => ({ kind: 'dark', radius: +radius.toFixed(1), minRadius: +minR.toFixed(1), maxRadius: +maxR.toFixed(1), heroDark, holes, halls: woken().length, lurkersWokenInDark: wokeDark, overlay: !!document.querySelector('.world-dark') }),
    dispose() {
      cv.remove();
      group.removeFromParent();
      for (const o of own) o.dispose();
    },
  };
}

// --- the war (sides) ----------------------------------------------------------------------------------------------------

/** The numbers of the war: how many of the taken army fight beside the hero, how they walk, and when one comes to fill a gap. */
export const WAR = { squad: 4, hp: 150, damage: 22, every: 1.4, speed: 3.9, follow: 4.6, near: 16, refill: 18, hostileLeash: 30 } as const;
/** The squad, in order: footmen and a knight. */
const SQUAD: ('footman' | 'knight')[] = ['footman', 'knight', 'footman', 'footman'];

const css = (n: number) => `#${n.toString(16).padStart(6, '0')}`;

/**
 * Two ghost armies. In the camp the hero takes one of two banners (a card; the route bot takes `window.__worldBanner`, 0 or 1). The choice is
 * kept in the run. The army taken fights beside the hero: a squad of its soldiers (hero-side units, never more than `WAR.squad`) walks with
 * it and chases what is awake near it. The other army hunts: its packs are the hostile ones. Packs of the army taken are gone for good, and
 * until a banner is taken every pack of both armies sleeps. The places carry the colours: both armies' pennants over their camps until the
 * choice; after it the other army's still fly over its packs, and each one cleared turns to the hero's colour, as the standards do when the
 * main quest takes them.
 */
function sides(z: ZoneCtx, d: Extract<LawDef, { kind: 'sides' }>): Law {
  const arena = z.api.arena;
  const store = z.run as unknown as { banner?: string };
  let taken: string | null = store.banner ?? null;
  const army = (id: string | null) => d.banners.find((b) => b.id === id);
  const colour = (id: string | null, fallback = 0xb8b8c0) => army(id)?.color ?? fallback;
  const group = new THREE.Group();
  z.p.group.add(group);
  const own: { dispose(): void }[] = [];
  const woodMat = new THREE.MeshStandardMaterial({ color: 0x4a3626, roughness: 0.85, flatShading: true });
  const goldMat = new THREE.MeshStandardMaterial({ color: 0xc9a24a, metalness: 0.7, roughness: 0.4, flatShading: true });
  own.push(woodMat, goldMat);
  const clothGeo = new THREE.PlaneGeometry(1.5, 1.0, 6, 2);
  const poleGeo = new THREE.CylinderGeometry(0.06, 0.08, 1, 6);
  const capGeo = new THREE.ConeGeometry(0.12, 0.3, 5);
  own.push(clothGeo, poleGeo, capGeo);
  type Flag = { cloth: THREE.Mesh; mat: THREE.MeshStandardMaterial; at: Spot; h: number; phase: number };
  const flags: Flag[] = [];
  const flag = (at: Spot, h: number, color: number, big = 1): Flag => {
    const pole = new THREE.Mesh(poleGeo, woodMat);
    pole.scale.set(big, h, big);
    pole.position.set(at.x, h / 2, at.z);
    pole.castShadow = true;
    const cap = new THREE.Mesh(capGeo, goldMat);
    cap.position.set(at.x, h + 0.12, at.z);
    const mat = new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.28, roughness: 0.8, side: THREE.DoubleSide });
    own.push(mat);
    const cloth = new THREE.Mesh(clothGeo, mat);
    cloth.scale.setScalar(big);
    cloth.position.set(at.x + 0.75 * big, h - 0.7 * big, at.z);
    cloth.castShadow = true;
    group.add(pole, cap, cloth);
    const f = { cloth, mat, at, h, phase: Math.random() * 6 };
    flags.push(f);
    return f;
  };
  // The two stands in the camp.
  const stands = d.banners.map((b) => ({ b, f: flag(b.at, 3.6, b.color ?? 0xb03030, 1.25) }));
  // The camps of the armies: a pennant at each pack's home; a standard of the main quest at each `reach`.
  const camps = d.banners.flatMap((b) => b.packs.map((id) => ({ b, id, f: flag({ x: (z.packs.get(id)?.def.at.x ?? 0) + 2.4, z: (z.packs.get(id)?.def.at.z ?? 0) + 1.2 }, 2.8, b.color ?? 0xb03030) })));
  const main = z.def.quests.find((q) => q.main);
  const standards = (main?.steps ?? []).flatMap((s, i) => (s.verb === 'reach' ? [{ i, at: s.at, f: flag(s.at, 4.4, 0xb8b8c0, 1.3) }] : []));
  const paint = () => {
    for (const c of camps) {
      c.f.cloth.visible = !(taken && c.b.id === taken);
      const cleared = z.packs.get(c.id)?.state === 'cleared';
      c.f.mat.color.setHex(taken && cleared ? colour(taken) : colour(c.b.id));
      c.f.mat.emissive.copy(c.f.mat.color);
    }
    for (const s of standards) {
      const up = !!taken && !!main && (z.run.q(main.id).step > s.i || z.run.q(main.id).done);
      s.f.mat.color.setHex(up ? colour(taken) : 0xb8b8c0);
      s.f.mat.emissive.copy(s.f.mat.color);
    }
    for (const s of stands) s.f.mat.emissiveIntensity = !taken || taken === s.b.id ? 0.5 : 0.12;
  };
  // Packs: nothing wakes before the choice; after it the army taken is gone and the other hunts.
  const packsOf = (id: string) => d.banners.find((b) => b.id === id)?.packs ?? [];
  const apply = () => {
    for (const b of d.banners) for (const id of b.packs) {
      const pk = z.packs.get(id);
      if (!pk) continue;
      if (!taken || b.id === taken) { pk.off = true; pk.dispose(); } else { pk.off = false; pk.leashAt = WAR.hostileLeash; }
    }
    paint();
  };
  apply();

  // The squad: hero-side units of the army taken.
  const squad: (SummonUnit | null)[] = Array.from({ length: WAR.squad }, () => null);
  let refill = 0, t = 0, fought = 0, maxHero = 0, maxFoes = 0, made = 0, fell = 0, dismissed = false, wasOpen = false, wasNear = false;
  const lookFor = (kind: string) => EXTRA_LOOKS[`${kind}-${taken}`];
  const make = (i: number, at: Spot) => {
    if (!taken || arena.summons.alive('hero').length >= WAR.squad + 1) return;
    const kind = SQUAD[i % SQUAD.length], knight = kind === 'knight';
    const handle = arena.summonFor('hero', {
      kind: 'melee', at: new THREE.Vector3(at.x, 0, at.z), hp: Math.round(WAR.hp * (knight ? 1.5 : 1)), seconds: 3600, damage: Math.round(WAR.damage * (knight ? 1.3 : 1)), attackEvery: WAR.every * (knight ? 1.3 : 1),
      speed: WAR.speed, color: css(colour(taken)), look: lookFor(kind),
      // Awake foes near the hero: the system's own chase. Else the unit is walked from here (the system walks a unit only toward a victim).
      goal: (pos) => (awakeNear() ? null : pos.clone()),
    });
    const u = handle.units[0];
    if (!u) return;
    squad[i] = u;
    made++;
    handle.onDeath((dead) => { if (dead.slain) fell++; });
  };
  const awakeNear = () => {
    for (const k of z.packs.values()) if (k.state === 'awake') for (const u of k.units) if (dist(u.pos, z.hero) < WAR.near) return true;
    return false;
  };
  const muster = () => {
    const me = z.hero;
    for (let i = 0; i < WAR.squad; i++) make(i, { x: me.x - 2 + (i - 1.5) * 1.1, z: me.z + 2.4 });
    if (squad.some(Boolean)) z.say(`${army(taken)?.name ?? 'The host'} musters`, css(colour(taken)), { x: me.x, z: me.z });
  };
  const take = (id: string, why: string) => {
    if (taken) return;
    taken = id;
    store.banner = id;
    apply();
    z.hud.closeCard();
    z.banner(`You take the ${army(id)?.name}`, `Its soldiers fight beside you; the ${army(d.banners.find((b) => b.id !== id)?.id ?? null)?.name} hunts you`, 3.4);
    muster();
    z.save();
    void why;
  };
  const card = () => {
    z.hud.openCard({
      for: 'banners', name: 'Two banners', role: 'Choose a side',
      lines: ['Two ghost armies still fight on this field. Take a banner: its soldiers fight beside you, and the other army hunts you.'],
      buttons: d.banners.map((b) => ({ label: `Take the ${b.name}`, sub: `${b.name} walks with you; the other army hunts`, tone: b.id === 'r' ? 'red' : 'blue', click: () => take(b.id, 'card') })),
    });
  };

  return {
    update(dt) {
      t += dt;
      const me = z.hero;
      for (const f of flags) {
        f.phase += dt * 3;
        f.cloth.rotation.y = Math.sin(f.phase) * 0.22;
        f.cloth.scale.y = 1 + Math.sin(f.phase * 1.3) * 0.05;
      }
      if (!taken) {
        if (z.mode === 'run') {
          // The route bot takes the banner `window.__worldBanner` (0 or 1) once it stands in the camp.
          if (t > 1.2) take(d.banners[Number((globalThis as unknown as { __worldBanner?: number }).__worldBanner ?? 0) % d.banners.length].id, 'bot');
        } else {
          // The card opens at the start and again when the hero walks up to a stand, unless it was closed and the hero has not come back to one.
          const near = stands.some((s) => dist(s.b.at, me) < 4.5), open = z.hud.cardFor === 'banners';
          if (wasOpen && !open) dismissed = true;
          wasOpen = open;
          if (near && !wasNear) dismissed = false;
          wasNear = near;
          if (!open && !dismissed && !z.hud.cardOpen && !z.hud.cardsOpen && (t > 0.9 || near)) card();
        }
        return;
      }
      paint();
      // The squad: each unit follows the hero (it stands off the hero's side, spread out) unless foes are awake near; a fallen one is replaced.
      const awake = awakeNear();
      if (awake) fought += dt;
      let alive = 0;
      squad.forEach((u, i) => {
        if (!u?.alive) { squad[i] = null; return; }
        alive++;
        if (awake || u.swing >= 0) return;
        const a = (i / WAR.squad) * Math.PI * 2 + 0.7, to = { x: me.x + Math.cos(a) * 2.6, z: me.z + Math.sin(a) * 2.6 };
        const gap = dist(u.pos, to);
        if (gap < 1.2) return;
        const step = arena.route(u, u.pos, new THREE.Vector3(to.x, 0, to.z)).point, dx = step.x - u.pos.x, dz = step.z - u.pos.z, len = Math.hypot(dx, dz) || 1;
        const sp = gap > 14 ? WAR.speed * 1.6 : WAR.follow;
        u.pos.x += (dx / len) * Math.min(len, sp * dt);
        u.pos.z += (dz / len) * Math.min(len, sp * dt);
        arena.keepInside(u.pos, 0.5);
        u.figure.group.rotation.y = Math.atan2(dx, dz);
      });
      if (alive < WAR.squad) {
        refill += dt;
        if (refill >= WAR.refill) {
          refill = 0;
          const i = squad.findIndex((u) => !u);
          make(i < 0 ? 0 : i, { x: me.x + 2.5, z: me.z + 2 });
        }
      } else refill = 0;
      maxHero = Math.max(maxHero, arena.summons.alive('hero').length);
      maxFoes = Math.max(maxFoes, arena.summons.alive('opponent').length);
    },
    floor: () => null,
    status: () => ({ text: taken ? `${army(taken)?.name}: ${squad.filter((u) => u?.alive).length} beside you` : 'Take a banner in the camp', active: false, warn: false }),
    safe: () => true,
    facts: () => ({ kind: 'sides', taken, squad: squad.filter((u) => u?.alive).length, made, fell, fightingSeconds: +fought.toFixed(1), maxHeroSide: maxHero, maxFoeSide: maxFoes, hostile: taken ? packsOf(d.banners.find((b) => b.id !== taken)!.id) : [] }),
    dispose() {
      for (const u of squad) if (u?.alive) arena.summons.dismiss(u);
      group.removeFromParent();
      for (const o of own) o.dispose();
    },
  };
}
