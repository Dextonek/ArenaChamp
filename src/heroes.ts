/**
 * Hero kits for hero mode (`src/heroMode.ts`): four spells bound to Q / W / E / R, R being the ultimate. A kit is
 * data only; a new hero is a new entry here, its spells are ordinary registered effects (looked up by label).
 */
import type { BuffKind } from './effects/status';
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
  /** A buff the hero gives itself when it casts this (see `BuffKind`). */
  buff?: { kind: BuffKind; amount: number; seconds: number };
  /** A debuff every hit of this spell puts on what it hits. */
  debuff?: { kind: BuffKind; amount: number; seconds: number };
  /** Draws the slot icon into a `size` × `size` canvas. */
  icon: (g: CanvasRenderingContext2D, size: number) => void;
}

export interface HeroKit {
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
  /** A melee hero: the duel AI closes to about 2 m (not 70% of Q's range) and chases a target that backs off. */
  melee?: true;
  spells: [HeroSpell, HeroSpell, HeroSpell, HeroSpell];
}

/** Each hero's rigged figure (blender/heroes/hero_figures.py exports them; concept: docs/heroes/lineup_concept.svg). */
const MODELS: Record<string, string> = {
  Vesper: 'models/heroes/blood.glb',
  Brannoc: 'models/heroes/forge.glb',
  Isolde: 'models/heroes/frost.glb',
  Lyra: 'models/heroes/astral.glb',
  Vitriol: 'models/heroes/alchemy.glb',
  Kaia: 'models/heroes/storm.glb',
  Sefu: 'models/heroes/sand.glb',
  Nyx: 'models/heroes/shadow.glb',
  Fenna: 'models/heroes/grove.glb',
  Auriel: 'models/heroes/dawn.glb',
  Marin: 'models/heroes/tide.glb',
  Zephyr: 'models/heroes/sky.glb',
  Mortis: 'models/heroes/bone.glb',
  Ada: 'models/heroes/clockwork.glb',
  Opaline: 'models/heroes/prism.glb',
  Sirix: 'models/heroes/hive.glb',
  Cantor: 'models/heroes/bard.glb',
  Oblivion: 'models/heroes/void.glb',
  Shiori: 'models/heroes/ink.glb',
  Tempo: 'models/heroes/chrono.glb',
};

/**
 * The MOBA-style redesign on trial (blender/heroes/moba_figures.py): `?figs=v2` in the URL swaps these heroes'
 * figures (sculpted, in the concept sheet's shapes); without it the game keeps the current ones.
 */
const MODELS_V2: Record<string, string> = {
  Brannoc: 'models/heroes/forge_v2.glb',
  Kaia: 'models/heroes/storm_v2.glb',
  Vesper: 'models/heroes/blood_v2.glb',
  Isolde: 'models/heroes/frost_v2.glb',
  Zephyr: 'models/heroes/sky_v2.glb',
  Oblivion: 'models/heroes/void_v2.glb',
  Sefu: 'models/heroes/sand_v2.glb',
  Auriel: 'models/heroes/dawn_v2.glb',
};
// `v2c` (the concept trial's link) still works and now shows the same figures
const FIGS = typeof location !== 'undefined' ? new URLSearchParams(location.search).get('figs') : null;
if (FIGS === 'v2' || FIGS === 'v2c') Object.assign(MODELS, MODELS_V2);

export const HERO_KITS: HeroKit[] = [bloodKit, forgeKit, frostKit, astralKit, alchemyKit, stormKit, sandKit, shadowKit, groveKit, dawnKit, tideKit, skyKit, boneKit, clockworkKit, hiveKit, bardKit, prismKit, voidKit, inkKit, chronoKit].map((k) => ({ ...k, model: k.model ?? MODELS[k.name] }));
