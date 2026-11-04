import type { Obstacle } from '../obstacles';
import { segDist } from '../obstacles';
import type { CastContext } from '../effects/targeting';
import type { CastMods, Trait, TraitView } from './types';

/**
 * Shadow Swap's dagger, published by the effect every frame (keyed by Nyx's figure) so the recast can swap her there:
 * `x, z` where it is now (or where it stopped / hit), `hit` it ended on an enemy, `taken` set by the recast so the effect
 * draws the swap and removes the dagger. Same pattern as Kaia's `stormOrbs`.
 */
export interface ShadowDagger { x: number; z: number; hit: boolean; taken: boolean; fromX: number; fromZ: number }
export const shadowDaggers = new WeakMap<object, ShadowDagger>();

/**
 * Shadow Mark's tally (keyed by Nyx's figure): the effect opens it (`active`) when the mark lands, `dealt` adds the
 * damage her hits do to the enemy hero while it is open, and the strike reads `taken` for its 30%. Kept in `dealt` (not
 * in the effect) because that hook runs on whichever screen resolves her hits, offline or online.
 */
export interface ShadowMarkTally { active: boolean; taken: number }
export const shadowMarks = new WeakMap<object, ShadowMarkTally>();

/** Share of the damage taken under the mark that the strike adds. */
export const MARK_SHARE = 0.3;

/** Umbral Cut: the wind-up, how far her dagger reaches when it lands, and the back cone (the enemy's back 120 degrees). */
export const CUT_WIND = 0.35;
export const CUT_REACH = 3.2;
export const CUT_BACK = (Math.PI * 4) / 3;
/** Smoke Veil: the cloud's radius and how long it stands. */
export const SMOKE_RADIUS = 3;
export const SMOKE_SECONDS = 3;
/** Nightfall: how long the dark and her bonuses last. */
export const NIGHT_SECONDS = 5;
/** Umbral Veil: seconds without a fight before she fades (in the open, within COVER_NEAR of cover, in Nightfall). */
const FADE_OPEN = 2.5;
const FADE_COVER = 1.2;
const FADE_NIGHT = 0.8;
const COVER_NEAR = 2;
/** The silence from the veil comes at most once per this many seconds. */
const SILENCE_GAP = 5;
const VIOLET = '#c88cff';

/**
 * Smoke Veil's cloud, written by the effect on both screens (keyed by Nyx's figure): where it stands, and until when
 * (`performance.now()` ms). The trait counts her as faded while she stands inside.
 */
export interface ShadowSmoke { x: number; z: number; r: number; until: number }
export const shadowSmoke = new WeakMap<object, ShadowSmoke>();

/** How her spells read the live obstacles (her passive has no `ctx`), per figure. */
const coverMap = new WeakMap<object, () => readonly Obstacle[]>();

/**
 * Her spells call this from `cast` (on both screens): the veil then measures cover against the live obstacles. Until one of
 * them has been cast nothing is known, and only the open-ground 2.5 s counts.
 */
export function watchCover(ctx: CastContext) {
  const get = ctx.obstacles;
  if (get) coverMap.set(ctx.caster, () => get() ?? []);
}

const nightOn = (t: TraitView) => t.time < (t.mem.nightUntil ?? 0);

function nearCover(t: TraitView) {
  const get = coverMap.get(t.self());
  if (!get) return false;
  const p = t.self().group.position;
  return get().some((o) => segDist(p.x, p.z, p.x, p.z, o.ax, o.az, o.bx, o.bz) - o.r <= COVER_NEAR);
}

function inSmoke(t: TraitView) {
  const s = shadowSmoke.get(t.self());
  if (!s || performance.now() >= s.until) return false;
  const p = t.self().group.position;
  return Math.hypot(p.x - s.x, p.z - s.z) <= s.r;
}

/**
 * Her first hit out of the veil (Q or a basic attack; decided here, on her own client, where casts begin, and carried as mods):
 * +50% damage, the silence (at most once per 5 s), 3 s off Shadow Double. It ends the veil and starts the fight clock.
 */
function leaveVeil(t: TraitView): Partial<CastMods> {
  if (!t.own('veil')) return {};
  const m: Partial<CastMods> = { power: 1.5 };
  if (t.time - (t.mem.silencedAt ?? -99) >= SILENCE_GAP) {
    m.status = { kind: 'silence', seconds: 0.6 };
    t.mem.silencedAt = t.time;
  }
  t.setCooldown(2, Math.max(0, t.cooldownLeft(2) - 3));
  t.show('veil', 0);
  t.mem.lastFight = t.time;
  t.say('FROM THE DARK', VIOLET);
  return m;
}

/**
 * Nyx (assassin). Passive Umbral Veil: `mem.lastFight` is the round time she last dealt or took damage (`landed`, `taken`). In `tick`
 * she fades after 2.5 s without a fight, 1.2 s within 2 m of cover (the obstacles come from `watchCover`, filled by her spells at
 * `cast`), or 0.8 s during Nightfall; inside her Smoke Veil she is faded at once. Faded (`show('veil')`, mirrored to the other
 * screen) she is drawn dark and see-through (`figureVeil`), never hidden, with a violet ring at her feet (`ring`), and 10% faster
 * (`haste` 0.1 for 0.3 s, renewed every 0.15 s; not during Nightfall, whose own haste is bigger, and not for 0.3 s after it, or the
 * small buff would keep the big one's amount alive). Her next Q or basic attack (`castMods`, `attackMods`) leaves the veil with
 * +50%, a silence of 0.6 s (once per 5 s) and 3 s off Shadow Double. W and R do not spend the veil. R Nightfall: `afterCast` starts
 * `mem.nightUntil`, `haste` 0.25 and `might` 0.2 for 5 s; at its end `tick` slows her 1 s. The CPU holds R until the enemy is within 8 m.
 * Q, W, E need nothing else here: the effects carry their own rules (Q's doubling from behind is decided at the hit).
 * The old Backstab / Combo rules are gone; the old spell files still import `shadowDaggers`, `shadowMarks` and `MARK_SHARE`.
 */
export const shadowTrait: Trait = {
  passive: {
    name: 'Umbral Veil',
    blurb: 'After 2.5 s without dealing or taking damage (1.2 s within 2 m of cover) she fades: dark and see-through, still plainly visible and targetable, 10% faster. Her next Q or attack out of the veil deals 50% more, silences 0.6 s (once per 5 s) and takes 3 s off Shadow Double.',
  },
  speed: 4.6,
  attack: { kind: 'melee', range: 1.9, damage: 11, interval: 0.7, windup: 0.18, speed: 0, look: 'twin' },
  aiHold: (_t, slot, dist) => slot === 3 && dist > 8,
  figureVeil: (t) => (t.own('veil') > 0 ? 1 : 0),
  ring(t) {
    if (t.own('veil') <= 0) return null;
    const night = t.own('night') > 0;
    return {
      radius: night ? 1.15 : 0.95,
      color: night ? '#f4e8ff' : VIOLET,
      opacity: night ? 0.95 : 0.55 + 0.1 * Math.sin(t.time * 3),
    };
  },
  tick(t) {
    const night = nightOn(t);
    if (t.mem.nightUntil && !night) {
      // The dark ends: a second of slow, and the small veil haste waits for the big one to run out.
      t.mem.nightUntil = 0;
      t.mem.hasteFrom = t.time + 0.3;
      t.show('night', 0);
      t.status(t.self())?.apply('slow', 1);
    }
    const need = night ? FADE_NIGHT : nearCover(t) ? FADE_COVER : FADE_OPEN;
    // In her smoke she fades mid-fight, but not the moment after a hit: that would make every swing a veil strike.
    const since = t.time - (t.mem.lastFight ?? 0);
    const faded = since >= need || (inSmoke(t) && since >= 1.5);
    t.show('veil', faded ? 1 : 0);
    if (faded && !night && t.time >= (t.mem.hasteFrom ?? 0) && t.time - (t.mem.hasteAt ?? -99) >= 0.15) {
      t.mem.hasteAt = t.time;
      t.buff('haste', 0.1, 0.3);
    }
  },
  landed(t, hit) {
    if (hit.damage > 0) t.mem.lastFight = t.time;
  },
  taken(t, hit) {
    if (!hit.blocked && hit.damage > 0) t.mem.lastFight = t.time;
  },
  castMods(t, slot) {
    return slot === 0 ? leaveVeil(t) : {};
  },
  attackMods(t) {
    return leaveVeil(t);
  },
  afterCast(t, slot) {
    if (slot !== 3) return;
    t.mem.nightUntil = t.time + NIGHT_SECONDS;
    t.show('night', 1);
    t.buff('haste', 0.25, NIGHT_SECONDS);
    t.buff('might', 0.2, NIGHT_SECONDS);
    t.say('NIGHTFALL', VIOLET);
  },
  badge: (t) => (t.own('night') > 0 ? 'NIGHT' : t.own('veil') > 0 ? 'VEIL' : ''),
};
