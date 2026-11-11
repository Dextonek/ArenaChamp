/**
 * Hero kits for hero mode (`src/heroMode.ts`): four spells bound to Q / W / E / R, R being the ultimate. A kit is
 * data only; a new hero is a new entry here, its spells are ordinary registered effects (looked up by label).
 */
import type { BuffKind } from './effects/status';
import type { BodyLook } from './raid/bodies/look';
import type { Trait } from './traits/types';
import { alchemyKit } from './kits/alchemy';
import { sandKit } from './kits/sand';
import { shadowKit } from './kits/shadow';
import { groveKit } from './kits/grove';
import { tideKit } from './kits/tide';
import { dawnKit } from './kits/dawn';
import { skyKit } from './kits/sky';
import { clockworkKit } from './kits/clockwork';
import { boneKit } from './kits/bone';
import { inkKit } from './kits/ink';
import { chronoKit } from './kits/chrono';
import { voidKit } from './kits/void';
import { hiveKit } from './kits/hive';
import { bardKit } from './kits/bard';
import { prismKit } from './kits/prism';
import { stormKit } from './kits/storm';
import { astralKit } from './kits/astral';
import { forgeKit } from './kits/forge';
import { frostKit } from './kits/frost';
import { bloodKit } from './kits/blood';
import { mirrorKit } from './kits/mirror';
import { masonKit } from './kits/mason';
import { timberKit } from './kits/timber';
import { balloonKit } from './kits/balloon';
import { catKit } from './kits/cat';
import { ledgerKit } from './kits/ledger';
import { sumoKit } from './kits/sumo';
import { mimeKit } from './kits/mime';
import { refereeKit } from './kits/referee';
import { chefKit } from './kits/chef';
import { courierKit } from './kits/courier';
import { janitorKit } from './kits/janitor';
import { moleKit } from './kits/mole';
import { yarnKit } from './kits/yarn';
import { weatherKit } from './kits/weather';
import { sheepKit } from './kits/sheep';
import { magicKit } from './kits/magic';
import { doorKit } from './kits/door';
import { phoenixKit } from './kits/phoenix';
import { twinsKit } from './kits/twins';

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
 * Each hero's rigged figure, the same one in fights and on the Heroes page. _v2: the current style (blender/heroes/moba_figures.py);
 * _v3: the new heroes restyled to the game's look (pipeline/designs/heroes-restyle.md), the _v2 file kept beside it; the others
 * are still the first style (blender/heroes/hero_figures.py).
 */
/**
 * The fourth style (user, 2026-11-10: "make all heroes in that style"): a realistic body moved by the animation pack's
 * own clips (src/motion/real.ts, pipeline/designs/style-v4). Every hero has such a model beside its older one, named
 * `<theme>_v4.glb`; they are shown unless the address says `?figs=old`.
 */
const FIGS_OLD = typeof location !== 'undefined' && new URLSearchParams(location.search).get('figs') === 'old';
/** The fourth-style model that stands in for an older one: `models/heroes/blood_v2.glb` -> `models/heroes/blood_v4.glb`. */
export const modelV4 = (url: string | undefined) => (url && !FIGS_OLD ? url.replace(/^(models\/heroes\/[a-z]+)(_v\d+)?\.glb$/, '$1_v4.glb') : url);

const MODELS: Record<string, string> = {
  Vesper: 'models/heroes/blood_v2.glb',
  Brannoc: 'models/heroes/forge_v2.glb',
  Isolde: 'models/heroes/frost_v2.glb',
  Lyra: 'models/heroes/astral.glb',
  Vitriol: 'models/heroes/alchemy.glb',
  Kaia: 'models/heroes/storm_v2.glb',
  Sefu: 'models/heroes/sand_v2.glb',
  Nyx: 'models/heroes/shadow.glb',
  Fenna: 'models/heroes/grove.glb',
  Auriel: 'models/heroes/dawn_v2.glb',
  Marin: 'models/heroes/tide.glb',
  Zephyr: 'models/heroes/sky_v2.glb',
  Mortis: 'models/heroes/bone.glb',
  Ada: 'models/heroes/clockwork.glb',
  Opaline: 'models/heroes/prism.glb',
  Sirix: 'models/heroes/hive.glb',
  Cantor: 'models/heroes/bard.glb',
  Oblivion: 'models/heroes/void_v2.glb',
  Shiori: 'models/heroes/ink.glb',
  Tempo: 'models/heroes/chrono.glb',
  Silvane: 'models/heroes/mirror_v3.glb',
  Bram: 'models/heroes/mason_v3.glb',
  Hank: 'models/heroes/timber_v3.glb',
  'Professor Puff': 'models/heroes/balloon_v3.glb',
  'Sir Whiskers': 'models/heroes/cat_v3.glb',
  'Mr. Ledger': 'models/heroes/ledger_v3.glb',
  'Big Yoko': 'models/heroes/sumo_v3.glb',
  Mum: 'models/heroes/mime_v3.glb',
  'Referee Whistler': 'models/heroes/referee_v3.glb',
  'Madame Cleaver': 'models/heroes/chef_v3.glb',
  Pip: 'models/heroes/courier_v3.glb',
  Gus: 'models/heroes/janitor_v3.glb',
  Mabel: 'models/heroes/mole_v3.glb',
  'Grandma Ironknit': 'models/heroes/yarn_v3.glb',
  'Barry Cloudsley': 'models/heroes/weather_v3.glb',
  Bo: 'models/heroes/sheep_v3.glb',
  'The Great Zambini': 'models/heroes/magic_v3.glb',
  Wick: 'models/heroes/door_v3.glb',
  // born in the fourth style: there is no older model, so `?figs=old` shows her as she is
  Anka: 'models/heroes/phoenix_v4.glb',
};

/**
 * The size each hero's hits are judged with, measured from its model (2026-11-04: the width 90% of its body fits in, and the
 * height 99% of it does). `radius`: half that width plus 0.08 m, at least 0.38, so a bolt that looks like it touched does and one
 * that looks like it passed does. `height`: how high a mouse ray can pick it.
 * The _v3 restyles (2026-11-09 and 11-10) keep the radius of the body they replace where the build is the same; where the
 * vertices' 90% radius or 99% height moved by more than about a tenth it follows (Grandma Ironknit and Bo are narrower
 * without the basket and the sheep; Silvane, Madame Cleaver and Sir Whiskers lost a hair tower, a tall hat and a plume;
 * Barry's height counts his staff, as Kaia's and Sefu's do). No height is under 2.33, so a small hero can still be clicked.
 */
export const HERO_BODIES: Record<string, { radius: number; height: number }> = {
  Vesper: { radius: 0.41, height: 2.35 }, Brannoc: { radius: 0.58, height: 2.35 }, Isolde: { radius: 0.4, height: 2.84 },
  Lyra: { radius: 0.38, height: 2.38 }, Vitriol: { radius: 0.43, height: 2.37 }, Kaia: { radius: 0.47, height: 3.24 },
  Sefu: { radius: 0.4, height: 2.86 }, Nyx: { radius: 0.4, height: 2.32 }, Fenna: { radius: 0.42, height: 2.55 },
  Auriel: { radius: 0.47, height: 2.33 }, Marin: { radius: 0.43, height: 2.29 }, Zephyr: { radius: 0.4, height: 2.37 },
  Mortis: { radius: 0.44, height: 2.51 }, Ada: { radius: 0.39, height: 2.29 }, Sirix: { radius: 0.44, height: 2.31 },
  Cantor: { radius: 0.39, height: 2.38 }, Opaline: { radius: 0.4, height: 2.46 }, Oblivion: { radius: 0.63, height: 2.62 },
  Shiori: { radius: 0.43, height: 2.3 }, Tempo: { radius: 0.41, height: 2.46 }, Silvane: { radius: 0.57, height: 2.34 },
  Bram: { radius: 0.59, height: 2.7 }, Hank: { radius: 0.61, height: 2.69 }, 'Professor Puff': { radius: 0.54, height: 2.43 },
  'Sir Whiskers': { radius: 0.49, height: 2.33 }, 'Mr. Ledger': { radius: 0.42, height: 2.4 },
  'Big Yoko': { radius: 0.76, height: 2.6 }, Mum: { radius: 0.45, height: 2.49 }, 'Referee Whistler': { radius: 0.44, height: 2.33 },
  'Madame Cleaver': { radius: 0.58, height: 2.33 }, Pip: { radius: 0.39, height: 2.36 }, Gus: { radius: 0.55, height: 2.39 },
  Mabel: { radius: 0.5, height: 2.33 }, 'Grandma Ironknit': { radius: 0.4, height: 2.33 }, 'Barry Cloudsley': { radius: 0.46, height: 3.06 },
  Bo: { radius: 0.42, height: 2.4 }, 'The Great Zambini': { radius: 0.45, height: 2.51 },
  Wick: { radius: 0.41, height: 2.37 }, 'Pim and Pom': { radius: 0.38, height: 2.39 },
  Anka: { radius: 0.4, height: 2.4 },
};

export const HERO_KITS: HeroKit[] = [bloodKit, forgeKit, frostKit, astralKit, alchemyKit, stormKit, sandKit, shadowKit, groveKit, dawnKit, tideKit, skyKit, boneKit, clockworkKit, hiveKit, bardKit, prismKit, voidKit, inkKit, chronoKit, mirrorKit, masonKit, timberKit, balloonKit, catKit, ledgerKit, sumoKit, mimeKit, refereeKit, chefKit, courierKit, janitorKit, moleKit, yarnKit, weatherKit, sheepKit, magicKit, doorKit, twinsKit, phoenixKit].map((k) => {
  const kit = { ...k, model: modelV4(k.model ?? MODELS[k.name]) };
  if (kit.alt) {
    // the other twin: its own model, in the same style
    kit.alt.model = modelV4(kit.alt.model);
    kit.alt.base = kit;
  }
  return kit;
});
