import * as THREE from 'three';
import { RING } from '../../arenas/common';
import type { BossCast, BossDef, BossMove, PlayContext, PlayedMove } from '../../raid/types';
import type { GameApi } from '../../runtime';
import type { Bite } from '../hooks';
import { unseen } from '../floors';
import { TowerLink } from '../link';
import { Pack, type PackState } from './packs';
import { PACK_HOMES, PLACES, ZONE_R, ZONE_START, zoneArena } from './zone';

/**
 * A floor as a world, stage 0 (pipeline/designs/tower-worlds-build.md): one walking fight on the duel's boss path for the whole
 * zone, as a Tower horde floor is (an unseen boss that is warded for the whole fight, so the hero's spells go for the units).
 * Packs of keepers wait at three of its places and wake when the hero comes near (`packs.ts`). The fight has no end of its own
 * here: the spike has no quest, so the tool decides when it is over.
 */

const WORLD_CAST = 900010;
/** How long a fallen hero lies before it is back at the camp (s), and with how much health. */
const LIE = 1.7, BACK = 0.5;

/** A zone's link on one screen: a fall is the world's to handle, in place. */
export class WorldLink extends TowerLink {}

export interface World {
  def: BossDef;
  link: WorldLink;
  packs: Pack[];
  /** Starts the zone's own cast: call right after `Duel.startBoss`. */
  begin(): void;
  /** What happened, with the second it happened at (the zone's clock). */
  log: { t: number; text: string }[];
  falls: number;
  /** Seconds the zone has run. */
  clock: number;
  /** One line for the screen. */
  line(): string;
  /** The tool's: packs on or off (a bare zone), every pack awake and alive at once as far as the summon cap allows. */
  setPacks(on: boolean): void;
  wakeAll(): void;
}

export function buildWorld(api: GameApi, o: { floor?: number } = {}): World {
  const arena = api.arena;
  const log: World['log'] = [];
  const world = { clock: 0, falls: 0 };
  const say = (text: string) => log.push({ t: +world.clock.toFixed(2), text });
  let total = 0, fallen = 0;
  let link!: WorldLink;
  const packs = PACK_HOMES.map((h) => {
    const kinds: Bite[] = Array.from({ length: h.count }, (_, i) => (i % 4 === 3 ? 'lampbearer' : 'keeper'));
    total += kinds.length;
    return new Pack(api, h.place, h, kinds, { fell: () => { fallen++; link.spend(1); }, log: say });
  });

  let lie = -1;
  const fall = () => {
    world.falls++;
    say('the hero falls');
    lie = LIE;
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

  const play = (_c: BossCast, p: PlayContext): PlayedMove => {
    // The unseen boss takes no hit for the whole fight: the hero's spells go for the units.
    p.guard(1e6);
    const hud = document.createElement('div');
    hud.style.cssText = 'position:fixed;left:10px;bottom:10px;z-index:7;padding:6px 10px;border-radius:8px;background:rgba(8,6,10,0.78);border:1px solid #3a3242;font:600 12px ui-sans-serif,system-ui;color:#e9dcc6;pointer-events:none;white-space:pre;';
    document.body.appendChild(hud);
    let spent = 0;
    return {
      threats: [], duration: Infinity,
      look: {
        update(t, dt) {
          world.clock = t;
          const hero = arena.caster.group.position;
          for (const k of packs) k.update(dt, hero);
          if (sun) {
            const s = sun as THREE.DirectionalLight;
            if (!s.target.parent && scene) scene.add(s.target);
            s.position.set(hero.x + 10, 30, hero.z + 15);
            s.target.position.set(hero.x, 0, hero.z);
            s.target.updateMatrixWorld();
          }
          // A fall: the hero lies a moment, then stands at the camp with half its health. The fight goes on (the weekly Tower starts it again).
          // TOWER-HOOK (revive): `Duel.raidRevived` is a raid's name for a partner getting a hero up; it is the one public way to stand a
          // fallen hero in a boss fight. The duel should have `revive(hp)`.
          if (lie >= 0 && (lie -= dt) < 0) {
            lie = -1;
            hero.set(ZONE_START.x, 0, ZONE_START.z);
            api.heroMode.halt();
            api.heroMode.snapCameraNow();
            api.duel.raidRevived(0, Math.round(api.duel.heroMax * BACK), 0);
            say('the hero stands at the camp');
          }
          if (++spent % 6 === 0) hud.textContent = `${line()}`;
        },
        dispose() {
          for (const k of packs) k.dispose();
          hud.remove();
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
  const def: BossDef = {
    id: 'tower-world', name: PLACES.camp.name, title: `${total} keepers`, place: zoneArena,
    starts: { boss: { x: RING.x, z: RING.z - ZONE_R + 3 }, heroes: [ZONE_START, ZONE_START, ZONE_START] },
    kit: (max) => unseen('The harbour', max), hp: { solo: total, duo: total }, scale: 1, body: { radius: 0.1, height: 0.1 }, speed: 0, keepAt: 999,
    staggerMax: 1e9, kneel: 0, phasePause: 0, phases: [{ name: '', at: 1, moves: [], gap: [3, 5] }], moves: { floor: move },
  };
  link = new WorldLink(def, total, {});
  link.fell = fall;

  const line = () => {
    const d = api.duel;
    return `The harbour · hero ${Math.round(d.heroHp)}/${Math.round(d.heroMax)} · falls ${world.falls}\n${packs.map((k) => `${k.id}: ${k.state} ${k.left}/${k.total}`).join('  ')}`;
  };
  void o;
  return {
    def, link, packs, log, line,
    get falls() { return world.falls; },
    get clock() { return world.clock; },
    begin: () => link.on.cast({ id: WORLD_CAST, move: 'floor', step: 0, x: RING.x, z: RING.z, fx: RING.x, fz: RING.z, dir: 0, seed: 1, target: 0 }),
    setPacks(on) { for (const k of packs) k.off = !on; },
    wakeAll() {
      // As many as the summon system holds (6 a side): the nearest pack's units come first.
      for (const k of packs) {
        if (k.state === 'unborn') k.spawn(true);
        k.wake('forced');
      }
    },
  };
}

export type { PackState };

/**
 * Starts the zone with `hero` under the player's control (`mode: 'play'`) or the duel's autopilot (`'run'`), as `TowerRun.fight`
 * starts a floor: the same sequence of calls on the same api.
 */
export function startWorld(api: GameApi, o: { hero: string; mode?: 'play' | 'run' }) {
  const world = buildWorld(api);
  if (api.duel.on) api.duel.stop();
  api.setKit(o.hero);
  api.setHeroMode(true);
  api.duel.holdStart = false;
  api.duel.startBoss({ def: world.def, link: world.link, seed: 'world-1', mode: o.mode ?? 'play', tier: 1, card: () => null });
  world.begin();
  return world;
}
