/**
 * Hero kits for hero mode (`src/heroMode.ts`): four spells bound to Q / W / E / R, R being the ultimate. A kit is
 * data only; its spells are ordinary registered effects (looked up by label).
 *
 * Every hero lives in a folder of its own (`src/heroes/<theme>/`, docs/pipeline/hero-framework.md), found by
 * src/heroes/index.ts: its card brings its kit, model and body, and its place in `HERO_KITS` is the card's `order`. Nothing
 * here is edited for a new hero.
 */
import type { BuffKind } from './effects/status';
import type { BodyLook } from './raid/bodies/look';
import type { Trait } from './traits/types';
import { useVcIcons } from './icons/vc';
import { HERO_CARDS } from './heroes/index';

export type HeroKey = 'Q' | 'W' | 'E' | 'R';

export interface HeroSpell {
  key: HeroKey;
  /** Effect label (as registered). */
  label: string;
  /** Name shown on the bar. */
  name: string;
  /** Cast range from the hero (ground units). Ignored for self-cast spells. */
  range: number;
  /** Seconds before it can be cast again. */
  cooldown: number;
  /** One-line tooltip. */
  blurb: string;
  /** The spell stuns or roots: the duel AI casts it first when the enemy is in range. */
  cc?: true;
  /** A gap closer (a dash toward the target): the duel AI casts it when the enemy is out of Q's range, not otherwise. */
  dash?: true;
  /** With `dash`, a getaway rather than a gap closer: the duel AI casts it away from an enemy who comes close, not toward one far off. */
  escape?: true;
  /** With R: not an ultimate for the duel AI, which casts it as iHold allows, whatever the enemy's HP (Tag Out). */
  anytime?: true;
  /** A last stand (a cheat death, a heal): the duel AI casts it when its own HP drops under about 45%, not by the enemy's HP. */
  save?: true;
  /** A parry (Radiant Parry): the duel AI casts it only when a hit is about to land (a bolt due, an attack winding up). */
  parry?: true;
  /** A bolt wall (Wind Barrier): the duel AI raises it toward an enemy bolt that is still far enough out to be caught. */
  barrier?: true;
  /** The spell summons units (`ctx.summon`): the duel AI casts it when ready and the enemy is within about 10 m, at a spot in front of itself. */
  summon?: true;
  /**
   * `line`: a skillshot. Hero mode shows a strip of the spell's range and width from the hero toward the cursor, not the ground circle.
   * `arc`: a curving skillshot (`ProjectileOptions.curve`): the strip bends from the hero to the cursor; the bend comes to the
   * spell as `CastContext.bend` (rule: `arcBendFor` in effects/projectile.ts). The spell's targeting is a ground point.
   */
  aim?: 'line' | 'arc';
  /** A bank shot: with `aim: 'line'`, the aim strip stops at the wall and draws the first bounce (Opaline, Silvane). */
  bank?: true;
  /**
   * With `aim: 'line'`: this spell does not stop at cover (a dash, a falling pillar, a row of trees), so its aim strip and
   * cast strip run on past a wall. Every other line skillshot is a bolt, and both strips end where cover stops it.
   */
  overCover?: true;
  /** With `aim: 'line'`: a bolt that passes the caster's own walls (`isOwnWall`) and stops at other cover. Its effect draws its own cast strip. */
  passesOwnWalls?: true;
  /** A buff the hero gives itself when it casts this (see `BuffKind`). */
  buff?: { kind: BuffKind; amount: number; seconds: number };
  /** A debuff every hit of this spell puts on what it hits. */
  debuff?: { kind: BuffKind; amount: number; seconds: number };
  /** Draws the slot icon into a `size` × `size` canvas. */
  icon: (g: CanvasRenderingContext2D, size: number) => void;
}

export interface HeroKit {
  /** A boss with a body of its own, not a hero's rig: poses its rigid parts (src/raid/bodies). */
  look?: BodyLook;
  name: string;
  title: string;
  /** Accent colour of the bar and the aim indicators (css). */
  accent: string;
  /** Pale foil colour for rings and text (css). */
  foil: string;
  /** Draws the portrait into a `size` × `size` canvas. */
  portrait: (g: CanvasRenderingContext2D, size: number) => void;
  /** Rigged hero figure (Dao rig, built by blender/heroes/hero_figures.py), path under public/. */
  model?: string;
  /** Start HP and the duel bar's full length (default 600). Melee heroes carry more. */
  maxHp?: number;
  /** The HP bar is cut into this many equal chunks, for both players (Sir Whiskers's lives). */
  hpChunks?: number;
  /**
   * A hero of two halves (Pim and Pom): the other half's kit, with the same name, so the same trait. It has its own spells, model,
   * look and `attack`. `TraitView.swapKit` brings it in on both screens; each round starts on this one.
   */
  alt?: HeroKit;
  /** On an `alt` kit: the kit it is the other half of (set below). */
  base?: HeroKit;
  /** This half's basic attack, over the trait's. */
  attack?: Trait['attack'];
  /** A melee hero: the duel AI closes to about 2 m (not 70% of Q's range) and chases a target that backs off. */
  melee?: true;
  spells: [HeroSpell, HeroSpell, HeroSpell, HeroSpell];
}

/**
 * Each hero's rigged figure is on its card (`model`), the same one in fights and on the Heroes page. _v2: the second style
 * (blender/heroes/moba_figures.py); _v3: the heroes restyled to the game's look (pipeline/designs/heroes-restyle.md), the _v2
 * file kept beside it; the others the first style (blender/heroes/hero_figures.py).
 *
 * The fourth style (user, 2026-11-10: "make all heroes in that style"): a realistic body moved by the animation pack's
 * own clips (src/motion/real.ts, pipeline/designs/style-v4). Every hero has such a model beside its older one, named
 * `<theme>_v4.glb`; they are shown unless the address says `?figs=old`.
 */
const FIGS_OLD = typeof location !== 'undefined' && new URLSearchParams(location.search).get('figs') === 'old';
/** The fourth-style model that stands in for an older one: `models/heroes/blood_v2.glb` -> `models/heroes/blood_v4.glb`. */
export const modelV4 = (url: string | undefined) => (url && !FIGS_OLD ? url.replace(/^(models\/heroes\/[a-z]+)(_v\d+)?\.glb$/, '$1_v4.glb') : url);

/**
 * The size each hero's hits are judged with, measured from its model (2026-11-04: the width 90% of its body fits in, and the
 * height 99% of it does). `radius`: half that width plus 0.08 m, at least 0.38, so a bolt that looks like it touched does and one
 * that looks like it passed does. `height`: how high a mouse ray can pick it.
 * The _v3 restyles (2026-11-09 and 11-10) keep the radius of the body they replace where the build is the same; where the
 * vertices' 90% radius or 99% height moved by more than about a tenth it follows (Grandma Ironknit and Bo are narrower
 * without the basket and the sheep; Silvane, Madame Cleaver and Sir Whiskers lost a hair tower, a tall hat and a plume;
 * Barry's height counts his staff, as Kaia's and Sefu's do). No height is under 2.29 (Ada, Marin), so a small hero can still
 * be clicked.
 */
export const HERO_BODIES: Record<string, { radius: number; height: number }> = Object.fromEntries(HERO_CARDS.map((c) => [c.kit.name, c.body]));

/** The roster in order: each hero's card at its `order` (0 = Vesper ... 39 = Anka); two cards on one place, or a gap, stop the page. */
function roster(): HeroKit[] {
  const out: (HeroKit | undefined)[] = [];
  for (const c of HERO_CARDS) {
    if (out[c.order]) throw new Error(`Two heroes want place ${c.order} in the roster: ${out[c.order]!.name} and ${c.kit.name}`);
    out[c.order] = { ...c.kit, model: c.model };
  }
  const gap = out.findIndex((k) => !k);
  if (gap >= 0 || out.length !== HERO_CARDS.length) throw new Error(`No hero's card has place ${gap} in the roster`);
  return out as HeroKit[];
}

export const HERO_KITS: HeroKit[] = roster().map((k) => {
  const kit = { ...k, model: modelV4(k.model) };
  if (kit.alt) {
    // the other twin: its own model, in the same style
    kit.alt.model = modelV4(kit.alt.model);
    kit.alt.base = kit;
  }
  return kit;
});

// The spell icons drawn with VectorCraft (src/icons/vc.ts): the heroes that have them draw them wherever a slot icon shows,
// each hero's files fetched the first time one of its slots is drawn; the kit's own canvas icon is the fallback.
useVcIcons(HERO_KITS, Object.fromEntries(HERO_CARDS.map((c) => [c.kit.name, c.icons])));
