import * as THREE from 'three';
import { RING } from '../../arenas/common';
import type { Obstacle } from '../../obstacles';
import type { BossCast, BossDef, BossMove, Objective, PlayContext, PlayedMove } from '../../raid/types';
import type { GameApi } from '../../runtime';
import { BOONS, boonsFor, type Boon } from '../boons';
import { floorNumbers, unseen } from '../floors';
import { setHealth } from '../hooks';
import { TowerLink } from '../link';
import type { ZoneCtx } from './ctx';
import type { DoorDef, FloorDef, PackDef, Spot } from './def';
import type { WorldHud } from './hud';
import { buildLaw, type Law } from './law';
import { Pack, type PackEnv, type PackState } from './packs';
import { People } from './people';
import { Quests } from './quests';
import { Scenery } from './scenery';
import type { WorldRun } from './state';

/**
 * A floor as a world: one walking fight on the duel's boss path for the whole zone, as a Tower horde floor is (an unseen boss that
 * is warded for the whole fight, so the hero's spells go for the units). `buildZone` builds it from the floor's data (`FloorDef`)
 * and the run (`WorldRun`) and is the only way a zone begins: the first entry, after a set piece, after a reload, after a floor
 * begins again. It owns nothing that the run does not hold, so it can be thrown away and built again at any time.
 *
 * What the engine lacks, from this side (TOWER-HOOK, each with a row in pipeline/designs/tower-worlds-build.md): the sun follows the
 * hero, a fall stands the hero up in the fight (`Duel.raidRevived`), boons act on units through `hp` and `leechFrom`.
 */

const WORLD_CAST = 900010;
/** How long a fallen hero lies before it is back up (s), and with how much health. */
const LIE = 1.7, BACK = 0.5;

/** What the zone needs of the run's owner (`WorldGame`). */
export interface ZoneHooks {
  /** The hero fell. `revive`: a life is left, stand it up; `restart`: none was, the owner rebuilds the floor. */
  fell(): 'revive' | 'restart';
  door(d: DoorDef): void;
  save(): void;
  offerBoon(label: string): void;
  giveRelic(): void;
}

export interface Zone {
  def: BossDef;
  link: TowerLink;
  packs: Map<string, Pack>;
  quests: Quests | null;
  people: People | null;
  scenery: Scenery | null;
  law: Law | null;
  ctx: ZoneCtx | null;
  /** Starts the zone's own cast: call right after `Duel.startBoss`. */
  begin(): void;
  log: { t: number; text: string }[];
  /** Falls in this zone. */
  readonly falls: number;
  /** Where the hero wakes after a fall. */
  respawn(): Spot;
  /** The route bot's goal: the autopilot walks to it (`null`: stand where it is) and fights what is awake near it instead. */
  bot: { goal(spot: Spot | null, r?: number): void; readonly fighting: boolean };
  /** The tool's: packs on or off, and every pack awake as far as the summon cap allows. */
  setPacks(on: boolean): void;
  wakeAll(): void;
  line(): string;
}

/** The hero's place after the zone is rebuilt: the last waystone, or the camp. */
export function wakeSpot(def: FloorDef, run: WorldRun): Spot {
  const w = def.waystones.find((x) => x.id === run.lastWaystone);
  return w ? { x: w.at.x + 1.6, z: w.at.z } : def.start;
}

export function buildZone(api: GameApi, floor: FloorDef, run: WorldRun, hud: WorldHud, hooks: ZoneHooks, o: { mode: 'play' | 'run'; start?: Spot } = { mode: 'play' }): Zone {
  const arena = api.arena;
  const log: Zone['log'] = [];
  const kit = api.kits.find((k) => k.name === run.hero);
  if (!kit) throw new Error(`no hero named ${run.hero}`);
  const num = floorNumbers(floor.n);
  const say = (text: string) => log.push({ t: +run.clock.toFixed(2), text });
  const packs = new Map<string, Pack>();
  let ctx: ZoneCtx | null = null;
  let law: Law | null = null;
  const zone = { falls: 0 };

  // The doors that are shut are walls in the arena's cover from the start; opening one removes it by identity.
  const walls = new Map<string, Obstacle>();
  for (const d of floor.doors) if (d.wall && !run.opened.includes(d.id)) walls.set(d.id, { kind: 'wall', ax: d.wall.ax, az: d.wall.az, bx: d.wall.bx, bz: d.wall.bz, r: d.wall.r, height: d.wall.height });
  const place = { ...floor.arena, obstacles: [...floor.cover, ...walls.values()] };

  const penv: PackEnv = {
    api, boons: run.boons, enemies: floor.enemies, hp: num.hp, now: () => run.clock,
    fell: (pack, spec, at) => {
      run.kills++;
      ctx?.pay(spec.shards, at);
      if (pack.def.named && pack.state === 'cleared') ctx?.say(`${pack.def.named.name} falls`, '#ffd27a', at);
      hooks.save();
    },
    log: say,
  };
  for (const p of floor.packs) packs.set(p.id, new Pack(p, penv, run.packsCleared.includes(p.id)));
  const total = [...packs.values()].reduce((n, p) => n + p.total, 0);

  let lie = -1;
  const fall = () => {
    zone.falls++;
    say('the hero falls');
    const next = hooks.fell();
    if (next === 'revive') lie = LIE;
  };

  /**
   * The sun's shadow follows the hero: the runtime's lights are made for an arena 24 m across (its shadow box is +-32 m round the
   * origin, src/runtime.ts:116).
   *
   * TOWER-HOOK (shadow): the runtime should move the sun with the camera (or the stage should say how wide its shadow is). Until then
   * the zone finds the sun in the scene and moves it and its target.
   */
  const scene = api.duel.group.parent as THREE.Scene | null;
  let sun: THREE.DirectionalLight | null = null;
  scene?.traverse((x) => { if (!sun && (x as THREE.DirectionalLight).isDirectionalLight && (x as THREE.DirectionalLight).castShadow) sun = x as THREE.DirectionalLight; });
  const sunWas = sun ? { pos: (sun as THREE.DirectionalLight).position.clone(), target: (sun as THREE.DirectionalLight).target.position.clone() } : null;

  const speeds = new Map<string, number>();
  const zoneRef: Zone = {
    def: undefined as unknown as BossDef, link: undefined as unknown as TowerLink, packs, quests: null, people: null, scenery: null, law: null, ctx: null, log,
    get falls() { return zone.falls; },
    begin: () => zoneRef.link.on.cast({ id: WORLD_CAST, move: 'floor', step: 0, x: RING.x, z: RING.z, fx: RING.x, fz: RING.z, dir: 0, seed: 1, target: 0 }),
    respawn: () => wakeSpot(floor, run),
    bot: undefined as unknown as Zone['bot'],
    setPacks(on) { for (const k of packs.values()) k.off = !on; },
    wakeAll() {
      for (const k of packs.values()) {
        if (k.state === 'unborn') k.spawn(true);
        k.wake('forced');
      }
    },
    line: () => `${floor.name} · hero ${Math.round(api.duel.heroHp)}/${Math.round(api.duel.heroMax)} · falls ${zone.falls}\n${[...packs.values()].map((k) => `${k.id}: ${k.state} ${k.left}/${k.total}`).join('  ')}`,
  };

  const play = (_c: BossCast, p: PlayContext): PlayedMove => {
    // The unseen boss takes no hit for the whole fight: the hero's spells go for the units.
    p.guard(1e6);
    const hero = arena.caster.group.position;
    const project = (x: number, y: number, z: number) => {
      const v = new THREE.Vector3(x, y, z).project(p.camera);
      return { x: (v.x * 0.5 + 0.5) * innerWidth, y: (-v.y * 0.5 + 0.5) * innerHeight, behind: v.z > 1 };
    };
    const c: ZoneCtx = ctx = {
      api, def: floor, run, p, mode: o.mode, kit, hud, hero, packs, group: p.group, project,
      now: () => run.clock,
      speed: (key, mul) => { speeds.set(key, mul); },
      say: (text, color, at) => p.say(text, color, at.x, at.z),
      banner: (title, sub, seconds) => hud.say(title, sub ?? '', seconds),
      pay: (n, at) => {
        run.shards += n;
        if (at) p.say(`+${n} ◆`, '#8cc4ff', at.x, at.z);
      },
      offerBoon: hooks.offerBoon,
      giveRelic: hooks.giveRelic,
      save: hooks.save,
      hunt: (def: PackDef) => {
        const pk = new Pack(def, penv);
        pk.hunter = true;
        packs.set(def.id, pk);
        return pk;
      },
      door: (id) => walls.get(id) ?? null,
      openDoor: (id) => {
        const w = walls.get(id);
        if (!w) return;
        arena.removeObstacle(w);
        walls.delete(id);
        run.opened.push(id);
        zoneRef.scenery?.opened(id);
        hud.say('A door opens', floor.doors.find((d) => d.id === id)?.name ?? '', 3);
        hooks.save();
      },
      mute: (on) => p.mute(on),
    };
    zoneRef.ctx = c;
    law = buildLaw(c, floor.law);
    zoneRef.law = law;
    const quests = (zoneRef.quests = new Quests(c));
    const people = (zoneRef.people = new People(c, quests));
    const scenery = (zoneRef.scenery = new Scenery(c));
    scenery.enter = (d) => hooks.door(d);
    scenery.read = (lines) => {
      if (o.mode === 'run') return;
      hud.openCard({ for: 'lore', name: floor.lore.name, role: 'A carved stone', lines, buttons: [{ label: 'Close', click: () => hud.closeCard() }] });
    };
    hud.floor(floor.name, floor.law.name);
    hud.setLives(run.lives);
    hud.show(true);
    // The trader's wares.
    people.onShop = (what) => {
      const d = api.duel;
      if (what === 'heal') setHealth(api, d.heroHp + 0.35 * d.heroMax);
      else if (what === 'life') run.lives = Math.min(3, run.lives + 1);
      else if (what === 'boon') { run.bought.push('boon'); hooks.offerBoon('The trader’s boon: choose one'); }
      else {
        const k = floor.caches.find((x) => !run.caches.includes(x.id) && !run.hintShown.includes(x.id));
        if (k) { run.hintShown.push(k.id); hud.say('A hint', 'A pillar of light marks a cache', 3); }
      }
      hud.setLives(run.lives);
    };
    if (o.mode === 'play') api.heroMode.snapCameraNow();
    let spent = 0, gone = false;
    // The route bot's one open spot at a time: a magnet for the autopilot (radius 0: it is never taken, so it never closes), shut while
    // anything awake is within reach so that the autopilot fights instead.
    const objectives: Objective[] = [];
    let magnet: Objective | null = null, parts = 0;
    const fighting = () => {
      for (const k of packs.values()) if (k.state === 'awake') for (const u of k.units) if (Math.hypot(u.pos.x - hero.x, u.pos.z - hero.z) < 12) return true;
      return false;
    };
    zoneRef.bot = {
      goal(spot, r = 0.01) {
        if (magnet) magnet.done = true;
        const at = spot ?? { x: hero.x, z: hero.z };
        magnet = { part: ++parts, x: at.x, z: at.z, radius: r, can: () => o.mode === 'run' && !fighting() };
        objectives.push(magnet);
        if (objectives.length > 8) objectives.splice(0, objectives.length - 4);
      },
      get fighting() { return fighting(); },
    };
    return {
      threats: [], duration: Infinity, objectives,
      look: {
        update(_t, dt) {
          run.clock += dt;
          const down = api.duel.heroHp <= 0;
          for (const k of packs.values()) k.update(dt, hero);
          law!.update(dt);
          quests.update(dt);
          // A door walked into ends this zone from inside the frame: nothing after it may touch what was put away.
          scenery.update(dt);
          if (gone) return;
          people.update(dt);
          // One place for every slow and quicken: the boons' Long Stride times the flood, the carry and the rest.
          let mul = run.boons.speedMul;
          for (const m of speeds.values()) mul *= m;
          api.heroMode.speedBonus = mul;
          run.hp = down ? 0 : Math.max(0, Math.min(1, api.duel.heroHp / Math.max(1, api.duel.heroMax)));
          if (sun) {
            const s = sun as THREE.DirectionalLight;
            if (!s.target.parent && scene) scene.add(s.target);
            s.position.set(hero.x + 10, 30, hero.z + 15);
            s.target.position.set(hero.x, 0, hero.z);
            s.target.updateMatrixWorld();
          }
          // A fall: the hero lies a moment, then stands up at the last waystone (or the camp) with half its health. The fight goes on.
          // TOWER-HOOK (revive): `Duel.raidRevived` is a raid's name for a partner getting a hero up; it is the one public way to stand a
          // fallen hero in a boss fight. The duel should have `revive(hp)`.
          if (lie >= 0 && (lie -= dt) < 0) {
            lie = -1;
            const at = zoneRef.respawn();
            hero.set(at.x, 0, at.z);
            api.heroMode.halt();
            api.heroMode.snapCameraNow();
            api.duel.raidRevived(0, Math.round(api.duel.heroMax * BACK), 0);
            say('the hero stands up');
            hud.say('A life lost', `${run.lives} left`, 2.2);
          }
          // The screen, a few times a second.
          if (++spent % 3 === 0) {
            hud.setHealth(api.duel.heroHp, api.duel.heroMax);
            hud.setLives(run.lives);
            hud.stats(run.shards, run.clock, run.carry?.held ? 'key' : '');
            hud.setQuests(quests.lines());
            const st = law!.status();
            hud.law(st.text, st.active, st.warn);
            const tg = quests.target();
            hud.pointTo(tg ? project(tg.x, 1.5, tg.z) : null, '');
          }
        },
        dispose() {
          gone = true;
          for (const k of packs.values()) k.dispose();
          quests.dispose();
          people.dispose();
          scenery.dispose();
          law?.dispose();
          hud.pointTo(null);
          api.heroMode.speedBonus = 1;
          if (sun && sunWas) {
            const s = sun as THREE.DirectionalLight;
            s.position.copy(sunWas.pos);
            s.target.position.copy(sunWas.target);
            s.target.updateMatrixWorld();
          }
        },
      },
    };
  };
  const move: BossMove = {
    id: 'floor', name: '', charge: 0, lock: 0, cooldown: 0, alongside: true, quiet: true, pose: 'channel',
    aim: () => ({ x: RING.x, z: RING.z, dir: 0 }),
    play,
  };
  const start = o.start ?? floor.start;
  const def: BossDef = {
    id: `tower-world-${floor.id}`, name: floor.name, title: '', place,
    starts: { boss: { x: RING.x, z: RING.z - floor.ring + 3 }, heroes: [start, start, start] },
    kit: (max) => unseen(floor.name, max), hp: { solo: total, duo: total }, scale: 1, body: { radius: 0.1, height: 0.1 }, speed: 0, keepAt: 999,
    staggerMax: 1e9, kneel: 0, phasePause: 0, phases: [{ name: '', at: 1, moves: [], gap: [3, 5] }], moves: { floor: move },
    floor: () => law?.floor() ?? null,
  };
  const link = new TowerLink(def, Math.max(1, total), {});
  link.fell = fall;
  zoneRef.def = def;
  zoneRef.link = link;
  return zoneRef;
}

export type { PackState };

/** The three boons a quest or a cache offers: a heal, a power and a relic (the weekly Tower's own rule), from the floor and what happened so far. */
export function offersFor(run: WorldRun, floor: FloorDef, kit: Parameters<typeof boonsFor>[1]): Boon[] {
  return boonsFor(`world-${floor.id}-${run.boons.list().length}-${run.kills}-${run.caches.length}-${run.shards}`, kit, run.boons, run.lives);
}

/** A relic the hero does not have and can use: the first in the list. */
export function relicFor(run: WorldRun, kit: Parameters<typeof boonsFor>[1]): Boon | null {
  return BOONS.filter((b) => b.kind === 'relic').find((b) => !run.boons.has(b.id) && (b.fits?.(kit) ?? true)) ?? null;
}
