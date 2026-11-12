import * as THREE from 'three';
import { RING, seeded } from '../arenas/common';
import { seedNumber } from '../arenas/hazards/base';
import { TOWER_DOORS, TOWER_R, TOWER_STAIRS, TOWER_START, gauntletWay, towerCover, towerHeight, towerRoom } from '../arenas/tower';
import { MAX_UNITS, type Summon } from '../effects/summon';
import { HERO_BODIES, type HeroKey, type HeroKit, type HeroSpell } from '../heroes';
import { HoldRing, LightPillar, ShadowFloor } from '../raid/fx';
import { STAND_COLOR } from '../raid/script';
import type { BossCast, BossDef, BossMove, PlayContext, PlayedMove, RaidAdd, Threat } from '../raid/types';
import type { GameApi } from '../runtime';
import { traitFor } from '../traits';
import type { TowerBoons } from './boons';
import { bite, biteMoves, leechFrom, type Bite } from './hooks';
import { TowerLink, type FloorReward } from './link';
import { keeperLook, sentryLook } from './looks';
import { call, cleave, fan, halves, lunge, ofRoom, spokes, stand, stones, sweep, tide, volley } from './moves';
import { ECHOES, type FloorPlan } from './week';

/**
 * A Tower floor as a fight on the duel's boss path (pipeline/designs/tower.md, docs/architecture/tower.md): `buildFloor` turns
 * a floor of the week's plan into a `BossDef`, its link and its numbers, and `Duel.startBoss` plays it as it plays a raid's
 * boss. What is fought differs by kind:
 *
 * - Gauntlet and Hold out: a room with nobody in it (`BossDef.hall`: only walking). Its brain casts the room's moves at the hero.
 * - Horde: nobody to hit but the keepers that come in by the doors, units of the summon system that walk and strike.
 * - Break it: the crystal is the boss, standing still, with sentries that shoot.
 * - Duel and Guardian: the echo of a hero, drawn big, with a boss's moves.
 *
 * Each floor also plays one long cast of its own, `floor`, as Noonfall's hall does: its goal, its clock, what it raises.
 */

/** What a floor needs of the climb it is part of. */
export interface FloorEnv {
  api: GameApi;
  boons: TowerBoons;
  /** The hero that climbs: its echo never guards a floor. */
  hero: string;
  /** The floor's goal, in a few words, for the screen. */
  goal(text: string): void;
  /** Seconds since the floor began, each frame: the climb keeps it for a floor that ends in a fall. */
  time?(seconds: number): void;
}

/** One floor, built: what `Duel.startBoss` takes, and `begin` to call right after it. */
export interface Floor {
  plan: FloorPlan;
  def: BossDef;
  link: TowerLink;
  /** How much shorter the floor's zones show: the Raid's tier, one more each ten floors. */
  tier: number;
  /** Starts the floor's own cast. */
  begin(): void;
  /** Where something of the floor's stood that broke as it ended (the crystal), for the landing to scatter. */
  broke?: { x: number; z: number };
}

/** The id of a floor's own cast, well clear of the brain's (they count up from 1). */
const FLOOR_CAST = 900001;
const noIcon = () => {};
const noSpell = (key: HeroKey): HeroSpell => ({ key, label: '', name: '', range: 0, cooldown: 0, blurb: '', icon: noIcon });
/** The kit of a floor with no body: a name for the bar and for the words when it ends. */
export const unseen = (name: string, hp: number) =>
  ({ name, title: '', accent: '#e8a040', foil: '#ffd27a', portrait: noIcon, maxHp: hp, spells: [noSpell('Q'), noSpell('W'), noSpell('E'), noSpell('R')] } as unknown as HeroKit);

/** "0:42" */
export const clockOf = (seconds: number) => `${Math.floor(Math.max(0, seconds) / 60)}:${String(Math.floor(Math.max(0, seconds) % 60)).padStart(2, '0')}`;

/**
 * How a floor's numbers grow with its height: enemies' health, what a hit costs, and how short the quiet between the room's
 * blows gets. Tuned with pipeline/tools/tower-tool.js so a middling hero's autopilot ends between floors 8 and 14.
 */
export function floorNumbers(n: number, restless = false) {
  // A little with every floor, and a step at each of the Tower's heights (floor 11, floor 21): past a guardian the air is thinner.
  const up = n - 1, height = towerHeight(n);
  return {
    hp: (1 + 0.08 * up) * (1 + 0.1 * height), hit: Math.min(2.6, 1.12 + 0.05 * up + 0.15 * height),
    gap: Math.max(0.5, 1 - 0.022 * up) * (restless ? 0.7 : 1),
  };
}

/** What each thing costs at floor 1, as a share of the hero's max health, and what it has. One table, so tuning is in one place. */
export const TOWER = {
  stones: 0.09, sweep: 0.09, spokes: 0.1, halves: 0.12, tide: 0.1, stand: 0.18, volley: 0.09,
  keeper: { hp: 70, share: 0.024, every: 1.8, speed: 3.2 },
  lampbearer: { hp: 50, share: 0.024, every: 2.6, speed: 2.8 },
  sentry: 110,
  crystal: { hp: 800, seconds: 45, again: 18, share: [0.3, 0.35, 0.4] },
  hold: [45, 55, 60],
  duel: { hp: 650, cleave: 0.17, lunge: 0.17, fan: 0.12, stars: 0.12, quake: 0.15 },
  guardian: { hp: 1500 },
} as const;

/** The heroes' echo: the roster's own kit and model under another name. */
function echoKit(real: HeroKit, name: string, title: string, hp: number): HeroKit {
  // Its own name, so the hero's passive does not run on the boss's side (no raid boss has one, and a boss's rules were never
  // played against one). The price: a hero's motion style goes by its name too (`REAL_STYLE`, a staff held upright), so the
  // Tower keeps echoes only of heroes with no such hold (`ECHOES`). Its attack is the hero's, so it stands as a fighter or a caster.
  // TOWER-HOOK: `HeroKit` should carry `styleOf?: string`, the hero whose motion style a kit uses (`HeroFigure.setModel` reads
  // `REAL_STYLE[kit.name]`, `Duel.setupTraits` reads `traitFor(kit.name)`): then any hero could be an echo under its own name.
  return { ...real, name, title, maxHp: hp, alt: undefined, base: undefined, attack: real.attack ?? traitFor(real.name)?.attack };
}

/** A look made of parts: each part adds what it does each frame, on a landing, and when the floor ends. */
class Parts {
  updates: ((t: number, dt: number) => void)[] = [];
  lands: ((th: Threat) => void)[] = [];
  ends: (() => void)[] = [];
  look() {
    return {
      update: (t: number, dt: number) => { for (const f of this.updates) f(t, dt); },
      land: (th: Threat) => { for (const f of this.lands) f(th); },
      dispose: () => { for (const f of this.ends) f(); },
    };
  }
}

/** The floor's own move: one long cast that aims at nobody. */
const floorMove = (play: (c: BossCast, p: PlayContext) => PlayedMove): BossMove => ({
  id: 'floor', name: '', charge: 0, lock: 0, cooldown: 0, alongside: true, quiet: true, pose: 'channel',
  aim: () => ({ x: RING.x, z: RING.z, dir: 0 }),
  play,
});

const rim = (deg: number, r: number) => {
  const a = THREE.MathUtils.degToRad(deg);
  return { x: RING.x + Math.sin(a) * r, z: RING.z + Math.cos(a) * r };
};

export function buildFloor(plan: FloorPlan, env: FloorEnv): Floor {
  const { n, kind } = plan, arena = env.api.arena;
  const num = floorNumbers(n, plan.twist === 'restless');
  const seed = seedNumber(plan.seed);
  const place = towerRoom(kind, n, towerCover(kind, seed));
  const start = { ...TOWER_START };
  const starts = (boss: { x: number; z: number }): BossDef['starts'] => ({ boss, heroes: [start, start, start] });
  // The link is made last (it needs the def), and everything below only calls it once the floor is on.
  let link!: TowerLink;
  const floor: Partial<Floor> = { plan, tier: 1 + towerHeight(n) };

  // --- what a floor raises -------------------------------------------------------------------------------------
  const raised: Summon[] = [];
  /** One of the horde, at (x, z). Null when the room is full. */
  /** How many may stand at once: fewer on the low floors, the summon system's own six from floor 24. */
  const most = Math.min(MAX_UNITS, n < 12 ? 4 : n < 24 ? 5 : 6);
  const raise = (who: Bite, at: { x: number; z: number }, died?: () => void) => {
    if (arena.summons.alive('opponent').length >= most) return null;
    const u = TOWER[who];
    const handle = arena.summonFor('opponent', {
      kind: who === 'keeper' ? 'melee' : 'ranged', at: new THREE.Vector3(at.x, 0, at.z),
      // The hero's boons add to its hits on a boss only: its units have less health by as much instead (hooks.ts, `leechFrom`).
      hp: Math.max(10, Math.round((u.hp * num.hp) / env.boons.dealtMul(false))),
      seconds: 900, damage: 30, attackEvery: u.every, speed: Math.min(3.9, u.speed + 0.02 * n), range: 9, color: '#e0a050', look: keeperLook,
    }, (target, opts) => {
      // A keeper's blow grows slower with the height than a zone does: there are more of them up there, and they come at once.
      if (target === arena.caster) bite(link, who, u.share * (1 + (num.hit - 1) * 0.6), opts?.from ?? at, arena.caster.group.position);
      else arena.hit(target, opts);
    });
    if (!handle.units.length) return null;
    handle.onHurt((_, damage) => leechFrom(env.api, damage, env.boons.leech));
    if (died) handle.onDeath(() => died());
    raised.push(handle);
    return handle;
  };
  const dismissAll = () => {
    for (const h of raised) for (const u of h.units) if (u.alive) arena.summons.dismiss(u);
    raised.length = 0;
  };
  /**
   * What stands in the room can't be hurt while something wards it: a horde's room always, a warded echo until its wards break,
   * and whoever called keepers until they have fallen. Guarded, the autopilot goes for the nearest unit (`Duel.pilot`), as a
   * person would. Each ward counts, so one that ends does not lift another.
   */
  let warding = 0;
  const ward = (p: PlayContext) => { if (warding++ === 0) p.guard(1e6); };
  const unward = (p: PlayContext) => { if (--warding === 0) p.guard(0); };
  /** A few more of the horde by the doors, called by a move (a mixed floor, a guardian). They are not the floor's goal. */
  const callIn = (count: number, rolls: number, p: PlayContext) => {
    const rng = seeded(rolls);
    let called = 0;
    for (let i = 0; i < count; i++) {
      const door = TOWER_DOORS[Math.floor(rng() * TOWER_DOORS.length)];
      if (!raise('keeper', door, () => { if (--called === 0) unward(p); })) continue;
      called++;
      p.show.column(door.x, door.z, { radius: 0.7, height: 6, life: 0.7, color: 0xffb060, peak: 0.6 });
    }
    if (!called) return;
    ward(p);
    p.hint('It is warded while its keepers stand');
  };
  const sentries: RaidAdd[] = [];
  const sentry = (p: PlayContext, at: { x: number; z: number }, died?: () => void) => {
    const add = p.spawnAdd({
      x: at.x, z: at.z, hp: Math.max(20, Math.round((TOWER.sentry * num.hp) / env.boons.dealtMul(false))), look: sentryLook, color: '#e0a050',
      hurt: (damage) => leechFrom(env.api, damage, env.boons.leech),
      died: () => {
        p.show.shards(at.x, 1.6, at.z, { count: 14, color: 0xc9a24a, speed: 5, life: 0.9, size: 0.18 });
        p.show.ring(at.x, at.z, { radius: 3.4, life: 0.6, color: 0xffb060, width: 0.4 });
        died?.();
      },
    });
    p.show.column(at.x, at.z, { radius: 0.8, height: 8, life: 1, color: 0xffb060 });
    sentries.push(add);
    return add;
  };

  // --- what a floor from 11 on borrows from a second kind: one more move for its brain ------------------------------
  const mixed: Record<string, BossMove> = {};
  if (plan.mix === 'gauntlet') mixed.sweep = sweep({ bands: [{ z0: RING.z - 11, z1: RING.z + 11 }], share: TOWER.sweep * num.hit, cooldown: 9 * num.gap });
  if (plan.mix === 'horde') mixed.call = ofRoom(call({ raise: callIn, count: 2, cooldown: 18 * num.gap }));
  if (plan.mix === 'break') mixed.volley = volley({ share: TOWER.volley * num.hit, sentries: () => sentries, cooldown: 5 * num.gap });
  if (plan.mix === 'hold') mixed.stand = stand({ share: TOWER.stand * num.hit, cooldown: 13 * num.gap });
  const mixIds = Object.keys(mixed);
  /** What every floor's cast does besides its own: a mixed floor's sentries, and the end of what it raised. */
  const common = (p: PlayContext, parts: Parts) => {
    parts.updates.push((t) => env.time?.(t));
    if (plan.mix === 'break') for (const deg of n >= 16 ? [115, 245] : [115]) sentry(p, rim(deg, 9.4));
    parts.ends.push(() => {
      for (const s of sentries) s.remove();
      sentries.length = 0;
      dismissAll();
    });
  };

  const room = (id: string, name: string, title: string, hp: number, o: Partial<BossDef>): BossDef => ({
    id, name, title, place, starts: starts({ x: TOWER_STAIRS.x, z: TOWER_STAIRS.z }), kit: (max) => unseen(name, max), hp: { solo: hp, duo: hp },
    scale: 1, body: { radius: 0.1, height: 0.1 }, speed: 0, keepAt: 999, staggerMax: 1e9, kneel: 0, phasePause: 0,
    phases: [{ name: '', at: 1, moves: mixIds, gap: [3 * num.gap, 5 * num.gap] }],
    moves: {},
    ...o,
  });
  let def: BossDef;
  const rewards: Record<string, FloorReward> = {};
  let hp = 1;

  if (kind === 'gauntlet') {
    // Nobody to fight: fire sweeps each stretch of the way, stones fall where you stand, and the stairs are at the far end.
    const way = gauntletWay(seed);
    def = room('tower-gauntlet', 'The fire', '', 1, {
      hall: true,
      phases: [{ name: '', at: 1, moves: ['stones', ...mixIds.filter((id) => id !== 'sweep')], gap: [2.6 * num.gap, 3.8 * num.gap], timed: { move: 'sweep', first: 2.2, every: Math.max(2.6, 5 - 0.1 * n) * num.gap, most: 999 } }],
      moves: {
        ...mixed, stones: ofRoom(stones({ share: TOWER.stones * num.hit })), sweep: sweep({ bands: way.bands, share: TOWER.sweep * num.hit }),
        floor: floorMove((_c, p) => {
          const parts = new Parts();
          common(p, parts);
          const light = new LightPillar(TOWER_STAIRS.x, TOWER_STAIRS.z, 1.8, 5, STAND_COLOR);
          p.group.add(light.mesh);
          parts.updates.push((t) => {
            light.opacity = 0.3 + 0.1 * Math.sin(t * 3.4);
            env.goal('Reach the stairs');
          });
          parts.ends.push(() => light.dispose());
          return {
            threats: [], objectives: [{ part: 0, x: TOWER_STAIRS.x, z: TOWER_STAIRS.z, radius: 1.8 }], duration: Infinity,
            look: { ...parts.look(), done: () => link.win() },
          };
        }),
      },
    });
  } else if (kind === 'hold') {
    // Nobody to fight: the room turns against you until the time is out.
    const seconds = TOWER.hold[towerHeight(n)];
    const wide = (m: BossMove) => ({ ...ofRoom(m), lock: 1.6 });
    def = room('tower-hold', 'The storm', '', 1, {
      hall: true,
      phases: [{ name: '', at: 1, moves: ['stones', 'spokes', 'halves', 'tide', 'stand', ...mixIds.filter((id) => id !== 'stand')], gap: [2 * num.gap, 3 * num.gap] }],
      moves: {
        ...mixed,
        stones: ofRoom(stones({ share: TOWER.stones * num.hit })), spokes: wide(spokes({ share: TOWER.spokes * num.hit })),
        halves: wide(halves({ share: TOWER.halves * num.hit })), tide: wide(tide({ share: TOWER.tide * num.hit })),
        stand: stand({ share: TOWER.stand * num.hit, cooldown: 12 }),
        floor: floorMove((_c, p) => {
          const parts = new Parts();
          common(p, parts);
          // The time left, as a gold ring round the room's middle that runs out.
          const ring = new HoldRing(RING.x, RING.z, 3.56, STAND_COLOR);
          p.group.add(ring.mesh);
          parts.updates.push((t) => {
            ring.set(Math.max(0, 1 - t / seconds));
            env.goal(`Hold out: ${clockOf(seconds - t + 0.99)}`);
            if (t >= seconds) link.win();
          });
          parts.ends.push(() => ring.dispose());
          return { threats: [], duration: Infinity, look: parts.look() };
        }),
      },
    });
  } else if (kind === 'horde') {
    // Keepers come in by the doors in waves. The room's bar is how many are left.
    const total = Math.min(16, Math.round(8 + 0.3 * n)), waves = n < 4 ? 2 : 3;
    hp = total;
    const who = (i: number): Bite => (n >= 3 && i % 4 === 3 ? 'lampbearer' : 'keeper');
    def = room('tower-horde', 'The horde', `${total} keepers`, total, {
      moves: {
        ...mixed,
        floor: floorMove((c, p) => {
          const parts = new Parts();
          common(p, parts);
          // Nothing to hit but the keepers.
          ward(p);
          const rng = seeded(c.seed);
          let sent = 0, fallen = 0, wave = 0, waveAt = 0, wait = 0.6;
          const size = Math.ceil(total / waves);
          parts.updates.push((t, dt) => {
            env.goal(`Clear the room: ${total - fallen} left`);
            // The next wave comes when the last is nearly down, or after a while whatever stands.
            const due = Math.min(total, (wave + 1) * size);
            if (sent >= due && wave < waves - 1 && (sent - fallen <= 1 || t - waveAt > 16)) {
              wave++;
              waveAt = t;
              wait = 1.2;
            }
            wait -= dt;
            if (wait > 0 || sent >= Math.min(total, (wave + 1) * size)) return;
            const door = TOWER_DOORS[Math.floor(rng() * TOWER_DOORS.length)];
            const made = raise(who(sent), door, () => {
              fallen++;
              link.spend(1);
            });
            wait = 0.45;
            if (!made) return;
            sent++;
            p.show.column(door.x, door.z, { radius: 0.7, height: 6, life: 0.7, color: 0xffb060, peak: 0.6 });
          });
          return { threats: [], duration: Infinity, look: parts.look() };
        }),
      },
    });
  } else if (kind === 'break') {
    // The crystal is the boss: it stands still, its sentries shoot, and when its time is out it strikes the whole room.
    const at = { x: RING.x, z: RING.z - 4.5 }, T = TOWER.crystal;
    hp = Math.round(T.hp * num.hp);
    const first = towerHeight(n) ? T.seconds - 5 : T.seconds;
    def = room('tower-break', 'The seal', 'break it before it strikes', hp, {
      starts: starts(at), body: { radius: 1.3, height: 3.6 },
      phases: [{ name: '', at: 1, moves: ['volley', ...mixIds.filter((id) => id !== 'volley')], gap: [2.2 * num.gap, 3.2 * num.gap] }],
      moves: {
        ...mixed, volley: volley({ share: TOWER.volley * num.hit, sentries: () => sentries, cooldown: 3.2 }),
        floor: floorMove((_c, p) => {
          const parts = new Parts();
          common(p, parts);
          const turrets = n >= 16 ? 4 : n >= 8 ? 3 : 2;
          [65, 295, 150, 210].slice(0, turrets).forEach((deg) => sentry(p, rim(deg, 8.8)));
          // The crystal: dark glass on a plinth, a flame inside it that shows more as it cracks, two gold rings turning round it.
          const g = new THREE.Group();
          g.position.set(at.x, 0, at.z);
          const stone = new THREE.MeshStandardMaterial({ color: 0x2b2a33, roughness: 0.85, flatShading: true });
          const gold = new THREE.MeshStandardMaterial({ color: 0xc9a24a, roughness: 0.4, metalness: 0.8, emissive: 0xffb050, emissiveIntensity: 0.2 });
          const glass = new THREE.MeshStandardMaterial({ color: 0x2a2842, roughness: 0.25, metalness: 0.55, flatShading: true, emissive: 0xff9a40, emissiveIntensity: 0.03, transparent: true, opacity: 0.78 });
          const flame = new THREE.MeshBasicMaterial({ color: 0xffb060 });
          const plinth = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.75, 0.5, 8).translate(0, 0.25, 0), stone);
          plinth.castShadow = plinth.receiveShadow = true;
          const shard = new THREE.Mesh(new THREE.OctahedronGeometry(1.25, 0).scale(1, 1.75, 1), glass);
          shard.position.y = 2.75;
          shard.castShadow = true;
          const core = new THREE.Mesh(new THREE.OctahedronGeometry(0.5, 0), flame);
          core.renderOrder = 1;
          core.position.y = 2.75;
          const rings = [0.5, -0.7].map((tilt) => {
            const r = new THREE.Mesh(new THREE.TorusGeometry(1.75, 0.05, 6, 40), gold);
            r.position.y = 2.75;
            r.rotation.set(Math.PI / 2 + tilt, 0, 0);
            return r;
          });
          const band = new THREE.Mesh(new THREE.TorusGeometry(1.52, 0.06, 6, 32).rotateX(Math.PI / 2), gold);
          band.position.y = 0.5;
          g.add(plinth, band, shard, core, ...rings);
          p.group.add(g);
          // It strikes when its time is out, and again after: only a pillar between you and it saves you.
          const strikes: Threat[] = Array.from({ length: 8 }, (_, k) => {
            const when = first + k * T.again;
            // What it costs grows with the Tower's three heights, not with every floor: nothing but a pillar stops it.
            return { shape: { kind: 'circle', x: RING.x, z: RING.z, radius: TOWER_R + 1.5 }, at: when, show: when - 4, share: T.share[towerHeight(n)], source: at };
          });
          const shadows = new ShadowFloor(at, () => p.cover(), STAND_COLOR, TOWER_R - 0.5);
          p.group.add(shadows.mesh);
          p.hint('Break the crystal before its time is out, or get a pillar between you and it');
          let was = 1, shake = 0, charged = -1;
          parts.updates.push((t, dt) => {
            const next = strikes.find((s) => !s.landed) ?? strikes[strikes.length - 1], left = next.at - t;
            env.goal(`Break the crystal: ${clockOf(left + 0.99)}`);
            // A hit shows: the shard jolts, and the flame inside grows as its health goes.
            const now = link.left;
            if (now < was - 0.001) shake = 0.25;
            was = now;
            shake = Math.max(0, shake - dt);
            shard.rotation.y += dt * (0.3 + 1.2 * (1 - now));
            shard.position.x = shake > 0 ? Math.sin(t * 90) * 0.06 : 0;
            core.scale.setScalar(1 + 1.6 * (1 - now) + 0.12 * Math.sin(t * 5));
            glass.emissiveIntensity = 0.03 + 0.3 * (1 - now) + (left < 4 ? 0.4 * (1 - left / 4) : 0);
            rings[0].rotation.z += dt * 0.9;
            rings[1].rotation.z -= dt * 1.3;
            const k = strikes.indexOf(next);
            if (left < 3 && left > 0.4 && charged !== k) {
              charged = k;
              p.show.charge(at.x, 2.75, at.z, left, 0xffa050, 3.2);
            }
            shadows.update(t, left < 4 && left > 0 ? 0.2 + 0.35 * (1 - left / 4) : 0);
          });
          parts.lands.push(() => {
            p.show.ring(at.x, at.z, { radius: TOWER_R + 4, life: 1, color: 0xffe0b8, width: 1.4 });
            p.show.column(at.x, at.z, { radius: 1.6, height: 18, life: 1, color: 0xfff4e0 });
            p.flash('rgba(255,236,206,0.9)', 0.5);
            p.shake(0.12);
            p.say('The seal strikes', '#ff9a6a', at.x, at.z);
          });
          parts.ends.push(() => {
            shadows.dispose();
            g.removeFromParent();
            g.traverse((o) => { if (o instanceof THREE.Mesh) o.geometry.dispose(); });
            for (const m of [stone, gold, glass, flame]) m.dispose();
          });
          return { threats: strikes, duration: Infinity, look: parts.look() };
        }),
      },
    });
    floor.broke = at;
  } else {
    // A Duel and a Guardian: the echo of a hero of the roster, bigger than a hero, with a boss's moves.
    const guardian = kind === 'guardian';
    const names = ECHOES.filter((e) => e !== env.hero);
    const who = plan.foe && plan.foe !== env.hero ? plan.foe : names[seed % names.length];
    const real = env.api.kits.find((k) => k.name === who) ?? env.api.kits.find((k) => k.name !== env.hero)!;
    const twist = guardian ? undefined : plan.duel;
    const k = guardian ? 2.4 : twist === 'giant' ? 1.9 : twist === 'swift' ? 1.2 : 1.45;
    const quick = twist === 'swift' ? 0.6 : 1;
    hp = Math.round((guardian ? TOWER.guardian.hp : TOWER.duel.hp * (twist === 'giant' ? 1.35 : twist === 'swift' ? 0.8 : 0.85)) * num.hp);
    const D = TOWER.duel, hit = num.hit * (guardian ? 1.15 : twist === 'giant' ? 1.15 : 1);
    const body = HERO_BODIES[real.name] ?? { radius: 0.45, height: 2.4 };
    const blows: Record<string, BossMove> = real.melee
      ? { cleave: cleave({ share: D.cleave * hit, k }), lunge: lunge({ share: D.lunge * hit, k }) }
      : { fan: fan({ share: D.fan * hit, k }), stars: stones({ id: 'stars', name: 'Starfall', share: D.stars * hit, light: true, cooldown: 6 }) };
    blows.quake = tide({ id: 'quake', name: 'Shockwave', share: D.quake * hit, near: true, inner: 2.2 + 1.3 * k, cooldown: 8 });
    const own = Object.keys(blows);
    const name = guardian ? `Guardian ${real.name}` : `Echo of ${real.name}`;
    const title = guardian ? `keeper of floor ${n}` : twist === 'giant' ? 'a giant' : twist === 'swift' ? 'swift' : 'warded';
    const gap: [number, number] = [1.1 * num.gap * quick, 1.8 * num.gap * quick];
    def = {
      id: guardian ? 'tower-guardian' : 'tower-duel', name, title, place, starts: starts({ x: RING.x, z: RING.z - 4.5 }),
      kit: (max) => echoKit(real, name, title, max), hp: { solo: hp, duo: hp }, scale: k, body: { radius: body.radius * k, height: body.height * k },
      speed: twist === 'giant' ? 1.9 : twist === 'swift' ? 3.3 : guardian ? 2.1 : 2.5, keepAt: real.melee ? 1.6 + 1.1 * k : 7.5,
      staggerMax: guardian ? 100 : 80, kneel: guardian ? 5 : 4, phasePause: guardian ? 1.6 : 0,
      phases: guardian
        ? [
          { name: `${name} wakes`, at: 1, moves: own, gap },
          { name: 'It calls the keepers', at: 0.66, moves: [...own, 'spokes'], opener: 'call', gap },
          { name: 'Last stand', at: 0.33, moves: [...own, 'spokes'], opener: 'tide', gap: [gap[0] * 0.8, gap[1] * 0.8] },
        ]
        : [{ name: '', at: 1, moves: [...own, ...mixIds], gap }],
      moves: {
        ...mixed, ...blows,
        ...(guardian ? {
          call: call({ raise: callIn, count: 2, cooldown: 30 }),
          spokes: spokes({ share: TOWER.spokes * hit, cooldown: 12 }),
          tide: tide({ share: TOWER.tide * hit, cooldown: 30 }),
        } : {}),
        floor: floorMove((_c, p) => {
          const parts = new Parts();
          common(p, parts);
          let wards = 0;
          if (twist === 'warded') {
            // Two wards keep it from harm: break them first. It fights meanwhile.
            ward(p);
            wards = 2;
            for (const side of [-1, 1]) {
              sentry(p, { x: RING.x + side * 7.2, z: RING.z - 2.5 }, () => {
                if (--wards > 0) return;
                unward(p);
                p.say('The wards break', '#fff2c8', RING.x, RING.z - 4.5);
                p.show.ring(RING.x, RING.z - 4.5, { radius: 12, life: 0.9, color: 0xfff4e0, width: 0.9 });
              });
            }
          }
          parts.updates.push(() => env.goal(wards > 0 ? `Break its wards: ${wards} left` : guardian ? `Defeat ${name}` : `Defeat the echo of ${real.name}`));
          return { threats: [], duration: Infinity, look: parts.look() };
        }),
      },
    };
  }
  def.moves = { ...biteMoves(), ...def.moves };
  link = new TowerLink(def, hp, rewards);
  floor.def = def;
  floor.link = link;
  floor.begin = () => link.on.cast({ id: FLOOR_CAST, move: 'floor', step: 0, x: RING.x, z: RING.z, fx: RING.x, fz: RING.z, dir: 0, seed, target: 0 });
  return floor as Floor;
}
