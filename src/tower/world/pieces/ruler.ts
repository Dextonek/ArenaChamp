import * as THREE from 'three';
import { RING, canvasTexture, seeded } from '../../../arenas/common';
import { arenaById } from '../../../arenas';
import { defaultLook, type MinionLook } from '../../../effects/parts/minion';
import { HERO_BODIES, type HeroKit } from '../../../heroes';
import { HoldRing } from '../../../raid/fx';
import { STAND_COLOR } from '../../../raid/script';
import type { BossCast, BossDef, BossMove, PlayContext, PlayedMove, RaidAdd, RoomFloor, Threat } from '../../../raid/types';
import type { GameApi } from '../../../runtime';
import { traitFor } from '../../../traits';
import type { TowerBoons } from '../../boons';
import { bite, leechFrom } from '../../hooks';
import { TowerLink, type FloorReward } from '../../link';
import { keeperLook } from '../../looks';
import { call, cleave, fan, halves, lunge, spokes, stand, stones, sweep, tide, volley } from '../../moves';
import { SENTRY_LOOKS } from './looks';
import type { PieceRun } from './core';
import type { MoveSpec, RulerDef } from './types';

/**
 * A floor's ruler as a fight on the duel's boss path (pipeline/designs/tower-worlds-pieces.md): the Tower's guardian's way (a hero's
 * model drawn big under a name of its own, three phases, a stagger gauge that makes it kneel), made of a floor's data (`RulerDef`) and
 * only the moves of the plan's "Ruler moves" list: the Tower's own (`src/tower/moves.ts`), a ground that hurts but for a safe place
 * (`BossDef.floor`, as the Twin Forge's flood is), sentries (a boss's adds, shot at and felled), `guard` and `exposed`.
 *
 * The floor's own cast (`floor`, 900001) is long and keeps the room's state; the moves only say what they want of it (`state`), so
 * nothing the room keeps is tied to a short cast.
 */

const FLOOR_CAST = 900001;
const REWARD_ID = 910000;
const GLOW = 0xffb060;
const WATER = 0x2f8fa8;
const DUST = 0xc8a060;
const V0 = new THREE.Vector3();

const rim = (deg: number, r: number) => {
  const a = THREE.MathUtils.degToRad(deg);
  return { x: RING.x + Math.sin(a) * r, z: RING.z + Math.cos(a) * r };
};

/** The hero's own kit under another name: so its passive does not run on the boss's side (as `echoKit` in `src/tower/floors.ts`). */
function standKit(real: HeroKit, name: string, title: string, hp: number): HeroKit {
  // TOWER-HOOK: `HeroKit` should carry `styleOf?: string` and `tint?: string` (see the notes file): a kit that is another body's under its
  // own name, and coloured. Until then the name decides the hero's motion style (`REAL_STYLE[kit.name]`) and the model keeps its colours.
  return { ...real, name, title, maxHp: hp, alt: undefined, base: undefined, attack: real.attack ?? traitFor(real.name)?.attack };
}

/**
 * A figure's colours laid over by `tint`, so the five rulers do not look alike. Returns what puts the colours back: the boss's figure keeps
 * its model between fights (a later duel against the same hero would come out in the ruler's colour), so the piece restores them when it ends.
 */
export function tintFigure(api: GameApi, tint: string, amount = 0.5) {
  // TOWER-HOOK: `Duel` keeps the boss's figure private and `RealHero` its materials; the kit should carry a tint the figure applies.
  const fig = (api.duel as unknown as { figure?: { real?: { mats?: { color: THREE.Color; emissive: THREE.Color }[] } } }).figure;
  const want = new THREE.Color(tint);
  const mats = fig?.real?.mats;
  if (!mats?.length) return null;
  const was = mats.map((m) => m.color.clone());
  mats.forEach((m) => m.color.lerp(want, amount));
  return () => mats.forEach((m, i) => m.color.copy(was[i]));
}

/** What the room keeps between the moves (they say what they want; the floor's cast does it). */
interface State {
  /** The floor's clock (s). */
  t: number;
  surge: { at: number; warn: number; on: number; end: number; x: number; z: number } | null;
  raise: boolean;
}

export interface Ruler {
  def: BossDef;
  link: TowerLink;
  /** Starts the floor's own cast: call right after `Duel.startBoss`. */
  begin(): void;
  /** What happens after the fight starts and its figures load: the tint, the ally. */
  ready(): void;
  /** Which phase the fight is in (0-based). */
  phase(): number;
}

export function buildRuler(api: GameApi, d: RulerDef, ctx: { hard: number; boons: TowerBoons; ally?: string; run: PieceRun }): Ruler {
  const { hard, boons, run } = ctx, arena = api.arena;
  const real = api.kits.find((k) => k.name === d.stand) ?? api.kits[0];
  // `hard` raises what a hit costs; the health is the ruler's own number (a longer fight is not a harder one).
  const hp = Math.round(d.hp);
  const k = d.scale;
  const place = (() => {
    const a = arenaById(d.room);
    if (!a) throw new Error(`no arena ${d.room}`);
    return { ...a, id: `ruler-${a.id}`, name: d.name };
  })();
  const body = HERO_BODIES[real.name] ?? { radius: 0.45, height: 2.4 };
  const still = d.speed === 0;
  const state: State = { t: 0, surge: null, raise: false };
  let link!: TowerLink;
  let tinted: (() => void) | null = null;
  const rewards: Record<string, FloorReward> = {};
  if (d.sentries?.fall) rewards.sentry = { stagger: d.sentries.fall.stagger, kneel: d.sentries.fall.kneel };

  // --- the ground that hurts but for a safe place -----------------------------------------------------------------
  const safeAt = (x: number, z: number) => {
    const s = d.surge?.safe;
    if (!s) return true;
    if ('decks' in s) return s.decks.some((k2) => Math.hypot(x - k2.x, z - k2.z) <= k2.r + 0.2);
    const at = state.surge;
    return !!at && Math.hypot(x - at.x, z - at.z) <= s.shell;
  };
  const SURGE: RoomFloor | null = d.surge ? {
    cover: [],
    safe: (x, z) => safeAt(x, z),
    burn: (x, z) => (state.surge && state.t >= state.surge.on && state.t < state.surge.end && !safeAt(x, z) ? d.surge!.burn * hard : 0),
    refuge: d.surge.safe && 'decks' in d.surge.safe ? d.surge.safe.decks[0] : { x: RING.x, z: RING.z },
    name: d.surge.name,
  } : null;
  /** The tide's warning and the tide itself both make the floor "hurt": the autopilot walks to the safe place at the warning. */
  const floorNow = () => (SURGE && state.surge && state.t >= state.surge.at && state.t < state.surge.end ? SURGE : null);

  // --- the ruler's own moves --------------------------------------------------------------------------------------
  const sentryList: (RaidAdd | null)[] = [];
  const alive = () => sentryList.filter((a): a is RaidAdd => !!a && a.alive);
  const make = (id: string, spec: MoveSpec): BossMove => {
    switch (spec.use) {
      case 'sweep': return { ...sweep({ bands: [{ z0: RING.z - 10, z1: RING.z + 10 }], share: spec.share * hard, cooldown: spec.cooldown }), name: spec.name ?? 'Sweeping Fire' };
      case 'volley': return { ...volley({ share: spec.share * hard, sentries: alive, cooldown: spec.cooldown }), name: spec.name ?? 'Volley' };
      case 'stones': return { ...stones({ share: spec.share * hard, count: spec.count, radius: spec.radius, light: spec.light, cooldown: spec.cooldown }), name: spec.name ?? (spec.light ? 'Starfall' : 'Falling Stones') };
      case 'spokes': return { ...spokes({ share: spec.share * hard, cooldown: spec.cooldown }), name: spec.name ?? 'Turning Fire' };
      case 'halves': return { ...halves({ share: spec.share * hard, cooldown: spec.cooldown }), name: spec.name ?? 'The Room Tilts' };
      case 'stand': return { ...stand({ share: spec.share * hard, cooldown: spec.cooldown }), name: spec.name ?? 'The Lantern Calls' };
      case 'tide': return { ...tide({ share: spec.share * hard, near: spec.near, inner: spec.inner, cooldown: spec.cooldown, id, name: spec.name }) };
      case 'cleave': return cleave({ share: spec.share * hard, k });
      case 'lunge': return lunge({ share: spec.share * hard, k });
      case 'fan': return fan({ share: spec.share * hard, k });
      case 'call': return { ...call({ raise: callIn, count: spec.count, cooldown: spec.cooldown, name: spec.name }) };
      case 'raise': return {
        id, name: spec.name ?? 'It Raises', charge: 0.6, lock: 0.8, cooldown: 999, quiet: true, pose: 'raise',
        aim: (c) => ({ x: c.target.x, z: c.target.z, dir: 0 }),
        play: (): PlayedMove => { state.raise = true; return { threats: [], duration: 0.2 }; },
      };
      case 'surge': {
        const long = d.surge && 'shell' in d.surge.safe;
        return {
          id, name: spec.name ?? d.surge?.name ?? 'The Surge', charge: 1.2, lock: long ? spec.warn + spec.seconds : 1.2, cooldown: spec.cooldown ?? 28, alongside: !long, quiet: false, pose: 'raise',
          aim: (c) => ({ x: c.boss.x, z: c.boss.z, dir: 0 }),
          play(c): PlayedMove {
            // The floor's cast does it: the water (or the dust) comes in after `warn`, stays `seconds`, and goes.
            state.surge = { at: state.t, warn: spec.warn, on: state.t + spec.warn, end: state.t + spec.warn + spec.seconds, x: c.fx, z: c.fz };
            run.note(`${state.t.toFixed(0)}s ${d.surge?.name ?? 'surge'} called`);
            return { threats: [], duration: spec.warn + spec.seconds + 1.4 };
          },
        };
      }
      case 'burrow': return {
        id, name: spec.name ?? 'It Burrows', charge: 0.8, lock: spec.under + 0.4, cooldown: spec.cooldown ?? 12, steps: [0, spec.under], pose: 'slam',
        aim(c) {
          if (c.step > 0 && c.prev) return c.prev;
          return { x: c.target.x, z: c.target.z, dir: Math.atan2(c.target.x - c.boss.x, c.target.z - c.boss.z) };
        },
        // Only the screen that runs the brain moves it: it comes up where the hero stood, as the second step lands.
        act: (world, c) => { if (c.step === 1) world.dash(c.x, c.z, 0.3); },
        play(c, p): PlayedMove {
          if (c.step > 0) return { threats: [], duration: 0.1 };
          p.guard(spec.under + 0.1);
          p.show.column(c.fx, c.fz, { radius: 1.6, height: 5, life: 0.9, color: DUST, peak: 0.7 });
          p.sparks.emit(c.fx, 0.3, c.fz, 24, 4, 3, 0.8, DUST);
          const r = 3.2;
          return {
            threats: [{ shape: { kind: 'circle', x: c.x, z: c.z, radius: r }, at: spec.under, share: spec.share * hard, knock: 3 }], duration: spec.under + 1.4,
            look: {
              land: () => {
                p.show.ring(c.x, c.z, { radius: r + 1, life: 0.6, color: DUST, width: 0.6, peak: 0.7 });
                p.show.column(c.x, c.z, { radius: 1.8, height: 7, life: 0.8, color: DUST, peak: 0.8 });
                p.exposed(spec.open);
                p.say('Open!', '#ffe08a', c.x, c.z);
                p.shake(0.06);
              },
            },
          };
        },
      };
    }
  };

  // --- the guard of the floor: keepers called, wards ------------------------------------------------------------
  let warding = 0;
  let wardCtx: PlayContext | null = null;
  const most = 6;
  const callIn = (count: number, rolls: number, p: PlayContext) => {
    const rng = seeded(rolls);
    let called = 0;
    for (let i = 0; i < count; i++) {
      if (arena.summons.alive('opponent').length >= most) break;
      const spot = rim(rng() * 360, 9.4);
      const handle = arena.summonFor('opponent', {
        kind: i % 3 === 2 ? 'ranged' : 'melee', at: V0.set(spot.x, 0, spot.z).clone(), hp: Math.max(10, Math.round((70 * hard) / boons.dealtMul(false))), seconds: 900, damage: 30,
        attackEvery: 1.8, speed: 3.2, range: 9, color: i % 2 ? '#c05050' : '#5070c0', look: keeperLook,
      }, (target, opts) => {
        if (target === arena.caster) bite(api, i % 3 === 2 ? 'lampbearer' : 'keeper', 0.017 * hard, opts?.from ?? spot);
        else arena.hit(target, opts);
      });
      if (!handle.units.length) continue;
      handle.onHurt((_, damage) => leechFrom(api, damage, boons.leech));
      handle.onDeath(() => { if (--called === 0 && --warding === 0) wardCtx?.guard(0); });
      called++;
      p.show.column(spot.x, spot.z, { radius: 0.7, height: 6, life: 0.7, color: GLOW, peak: 0.6 });
    }
    if (!called) return;
    warding++;
    wardCtx = p;
    p.guard(1e6);
    p.hint('It is warded while its guard stands');
  };

  // --- phases and the whole def -----------------------------------------------------------------------------------
  const moves: Record<string, BossMove> = {};
  // The brain casts a move by its `id` and the fight looks it up by the same key: the record's key is the id.
  for (const [id, spec] of Object.entries(d.moves)) moves[id] = { ...make(id, spec), id };
  const bossAt = still ? { x: RING.x, z: RING.z } : { x: RING.x, z: RING.z - 4.5 };
  const def: BossDef = {
    id: `ruler-${place.id}`, name: d.name, title: d.title, place, starts: { boss: bossAt, heroes: [{ x: RING.x, z: RING.z + 6 }, { x: RING.x, z: RING.z + 6 }, { x: RING.x, z: RING.z + 6 }] },
    kit: (max) => standKit(real, d.name, d.title, max), hp: { solo: hp, duo: hp }, scale: k, body: { radius: body.radius * k, height: body.height * k },
    speed: d.speed, keepAt: still ? 999 : d.keepAt ?? (real.melee ? 1.6 + 1.1 * k : 7.5), staggerMax: d.stagger.max, kneel: d.stagger.kneel, phasePause: 1.6,
    phases: d.phases.map((ph) => ({ name: ph.name, at: ph.at, moves: ph.moves, opener: ph.opener, timed: ph.timed, gap: ph.gap })),
    moves: { ...moves, floor: floorMove() },
    floor: () => floorNow(),
  };
  link = new TowerLink(def, hp, rewards);

  /** Which phase the fight is in, from the bar. */
  const phase = () => {
    let i = 0;
    for (let n = 1; n < def.phases.length; n++) if (link.left <= def.phases[n].at) i = n;
    return i;
  };

  // --- the floor's own cast: the room's look and what it keeps ---------------------------------------------------
  function floorMove(): BossMove {
    return {
      id: 'floor', name: '', charge: 0, lock: 0, cooldown: 0, alongside: true, quiet: true, pose: 'channel',
      aim: () => ({ x: RING.x, z: RING.z, dir: 0 }),
      play(_c: BossCast, p: PlayContext): PlayedMove {
        const parts: ((t: number, dt: number) => void)[] = [];
        const ends: (() => void)[] = [];
        const spec = d.sentries;
        // The figure's materials may not be there at the first frame: try again for a few seconds.
        parts.push((t) => { if (!tinted && t < 12) ready(); });

        // The sentries: cannons, roots, crystals, a standard.
        const timers: number[] = [];
        let guarded = false;
        let fell = 0;
        const raiseOne = (i: number) => {
          if (!spec || (sentryList[i] && sentryList[i]!.alive)) return;
          const at = rim(spec.spots[i][0], spec.spots[i][1]);
          const add = p.spawnAdd({
            x: at.x, z: at.z, hp: Math.max(20, Math.round((spec.hp * hard) / boons.dealtMul(false))), look: SENTRY_LOOKS[spec.look], color: '#e0a050',
            hurt: (damage) => leechFrom(api, damage, boons.leech),
            died: () => {
              p.show.shards(at.x, 1.6, at.z, { count: 14, color: 0xc9a24a, speed: 5, life: 0.9, size: 0.18 });
              p.show.ring(at.x, at.z, { radius: 3.4, life: 0.6, color: GLOW, width: 0.4 });
              sentryList[i] = null;
              fell++;
              run.note(`${state.t.toFixed(0)}s ${spec.look} ${i} fell`);
              if (spec.fall) p.reward('sentry', REWARD_ID + fell);
              if (spec.again) timers[i] = spec.again;
              guard();
            },
          });
          p.show.column(at.x, at.z, { radius: 0.8, height: 8, life: 1, color: GLOW });
          sentryList[i] = add;
          guard();
        };
        const raiseAll = () => { if (spec) spec.spots.forEach((_s, i) => raiseOne(i)); };
        const guard = () => {
          if (!spec?.guards) return;
          const n = alive().length;
          if (n > 0 && !guarded) { guarded = true; p.guard(1e6); } else if (n === 0 && guarded) {
            guarded = false;
            p.guard(0);
            p.exposed(spec.guards.open);
            p.say('It stands open', '#ffe08a', RING.x, RING.z);
          }
        };
        if (spec && (spec.from ?? 0) === 0) raiseAll();
        parts.push((_t, dt) => {
          if (state.raise) { state.raise = false; raiseAll(); }
          timers.forEach((left, i) => {
            if (left > 0 && (timers[i] -= dt) <= 0) raiseOne(i);
          });
        });
        ends.push(() => { for (const a of sentryList) a?.remove(); sentryList.length = 0; });

        // The floor's ground: the deck and the sea (or the dust and the shell).
        const surge = d.surge;
        if (surge) {
          const safe = surge.safe;
          if ('decks' in safe) {
            const plank = canvasTexture(256, (g, s) => {
              g.fillStyle = '#4a3220';
              g.fillRect(0, 0, s, s);
              for (let r = 0; r < 8; r++) {
                g.fillStyle = r % 2 ? '#6a4a2c' : '#7a5632';
                g.fillRect(2, r * (s / 8) + 2, s - 4, s / 8 - 4);
              }
            });
            for (const dk of safe.decks) {
              const g = new THREE.Group();
              const top = new THREE.Mesh(new THREE.CylinderGeometry(dk.r, dk.r + 0.08, 0.34, 28), new THREE.MeshStandardMaterial({ map: plank, roughness: 0.85 }));
              top.position.y = 0.17;
              top.receiveShadow = true;
              const edge = new THREE.Mesh(new THREE.TorusGeometry(dk.r, 0.06, 6, 40).rotateX(Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0xc9a24a, metalness: 0.7, roughness: 0.4, emissive: 0xffb050, emissiveIntensity: 0.25 }));
              edge.position.y = 0.35;
              const ring = new HoldRing(0, 0, dk.r - 0.3, STAND_COLOR);
              ring.mesh.position.set(0, 0.37, 0);
              ring.set(1);
              ring.mesh.visible = false;
              g.add(top, edge);
              g.position.set(dk.x, 0, dk.z);
              p.group.add(g);
              ends.push(() => {
                g.removeFromParent();
                top.geometry.dispose();
                (top.material as THREE.Material).dispose();
                edge.geometry.dispose();
                (edge.material as THREE.Material).dispose();
                ring.dispose();
                plank.dispose();
              });
            }
            p.hint('When the tide comes in, only the deck is dry');
          }
          // The water (or the dust): a sheet over the ring that fills in and goes out.
          const sheet = new THREE.Mesh(new THREE.CircleGeometry(RING.r + 1.4, 48).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: surge.look === 'sea' ? WATER : DUST, transparent: true, opacity: 0, depthWrite: false }));
          sheet.position.set(RING.x, 0.3, RING.z);
          // Before the figures: a boss's body is drawn in the same pass as this sheet, and a sheet over it would haze it.
          sheet.renderOrder = -2;
          p.group.add(sheet);
          let shell: HoldRing | null = null;
          if ('shell' in safe) {
            shell = new HoldRing(0, 0, safe.shell, STAND_COLOR);
            shell.mesh.visible = false;
            p.group.add(shell.mesh);
          }
          let said = '';
          let puff = 0;
          parts.push((_t, dt) => {
            const s = state.surge;
            let k = 0;
            if (s && state.t < s.end + 1.2) {
              if (state.t < s.on) k = 0.16 * ((state.t - s.at) / s.warn) + 0.06 * Math.sin(state.t * 9);
              else if (state.t < s.end) k = 0.42 + 0.05 * Math.sin(state.t * 3);
              else k = 0.42 * (1 - (state.t - s.end) / 1.2);
            }
            const mat = sheet.material as THREE.MeshBasicMaterial;
            mat.opacity = Math.max(0, k);
            sheet.visible = k > 0.002;
            sheet.position.y = surge.look === 'sea' ? 0.2 + 0.12 * Math.min(1, k * 2.4) : 0.3;
            if (shell && s) {
              shell.mesh.position.set(s.x, 0.09, s.z);
              shell.set(1);
              shell.mesh.visible = state.t >= s.at && state.t < s.end;
            }
            if (surge.look === 'storm' && s && state.t >= s.on && state.t < s.end) {
              puff -= dt;
              if (puff <= 0) {
                puff = 0.06;
                const a = Math.random() * Math.PI * 2, r = 4 + Math.random() * (RING.r - 4);
                p.sparks.emit(RING.x + Math.sin(a) * r, 0.5, RING.z + Math.cos(a) * r, 2, 3.5, 1.2, 0.8, DUST);
              }
            }
            let say = '';
            if (s && state.t >= s.at && state.t < s.end) say = state.t < s.on ? `${surge.name}: ${'decks' in safe ? 'get on the deck' : 'get to the shell'}` : `${surge.name}: ${Math.ceil(s.end - state.t)}`;
            if (say !== said) { said = say; if (say) run.hud?.setGoal(say); }
            // The sea slows what stands in it.
            if (s && state.t >= s.on && state.t < s.end && surge.slow) {
              const me = arena.caster.group.position;
              api.heroMode.speedBonus = boons.speedMul * (safeAt(me.x, me.z) ? 1 : 1 - surge.slow);
            } else if (surge.slow) api.heroMode.speedBonus = boons.speedMul;
          });
          ends.push(() => { sheet.removeFromParent(); sheet.geometry.dispose(); mat0(sheet); shell?.dispose(); });
        }

        // The dark of the last phase (a page layer).
        const dark = d.dark;
        if (dark) parts.push(() => run.hud?.setDark(phase() >= dark.from));
        ends.push(() => run.hud?.setDark(false));

        let said = '';
        parts.push(() => {
          if (state.surge && state.t < state.surge.end) return;
          const text = `Defeat ${d.name}`;
          if (text !== said) { said = text; run.hud?.setGoal(text); }
        });
        return {
          threats: [] as Threat[], duration: Infinity,
          look: {
            update: (t, dt) => { state.t = t; for (const f of parts) f(t, dt); },
            dispose: () => { for (const f of ends) f(); },
          },
        };
      },
    };
  }

  // --- the ally ------------------------------------------------------------------------------------------------
  // The rival's look is only its colours: a walker of the summon system, bigger than the horde's, in the hero's accent (darkened, so it does not
  // read as a white keg) and foil. A body from the hero's own model is the next step (see the notes file).
  const allyLook = (accent: string, foil: string): MinionLook => (kind, p) => {
    const rig = defaultLook(kind, p);
    p.body.color.set(accent).multiplyScalar(0.62);
    p.trim.color.set(foil);
    rig.root.scale.setScalar(1.7);
    rig.barY = (rig.barY ?? 1.28) * 1.7;
    return rig;
  };

  const ready = () => {
    if (tinted) return;
    tinted = tintFigure(api, d.tint);
    if (tinted) run.onEnd(tinted);
  };
  return {
    def, link, phase, ready,
    begin() {
      link.on.cast({ id: FLOOR_CAST, move: 'floor', step: 0, x: RING.x, z: RING.z, fx: RING.x, fz: RING.z, dir: 0, seed: 1, target: 0 });
      if (ctx.ally) {
        const kit = api.kits.find((x) => x.name === ctx.ally);
        const me = arena.caster.group.position;
        const handle = arena.summonFor('hero', {
          kind: 'melee', at: new THREE.Vector3(me.x - 2.2, 0, me.z - 1.2), hp: Math.round(380 * (0.8 + 0.2 * hard)), seconds: 900, damage: 20, attackEvery: 1.2, speed: 3.6,
          color: kit?.accent ?? '#c0c0ff', look: allyLook(kit?.accent ?? '#9fb0ff', kit?.foil ?? '#ffe08a'),
        });
        if (handle.units.length) {
          arena.say(`${ctx.ally} fights beside you`, kit?.accent ?? '#ffffff', new THREE.Vector3(me.x - 2.2, 2.2, me.z - 1.2), 2.4);
          run.note(`ally ${ctx.ally} (${handle.units[0].max} hp)`);
          handle.onDeath(() => run.note(`${state.t.toFixed(0)}s ally fell`));
        }
      }
    },
  };
}

function mat0(m: THREE.Mesh) {
  (m.material as THREE.Material).dispose();
}
