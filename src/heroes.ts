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
import { mirrorKit } from './kits/mirror';
import { masonKit } from './kits/mason';
import { timberKit } from './kits/timber';
import { balloonKit } from './kits/balloon';
import { catKit } from './kits/cat';
import { ledgerKit } from './kits/ledger';
import { sumoKit } from './kits/sumo';
import { mimeKit } from './kits/mime';

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
  /** The HP bar is cut into this many equal chunks, for both players (Sir Whiskers's lives). */
  hpChunks?: number;
  /** A melee hero: the duel AI closes to about 2 m (not 70% of Q's range) and chases a target that backs off. */
  melee?: true;
  spells: [HeroSpell, HeroSpell, HeroSpell, HeroSpell];
}

/**
 * Each hero's rigged figure, the same one in fights and on the Heroes page. _v2: the current style (blender/heroes/moba_figures.py);
 * the others are still the first style (blender/heroes/hero_figures.py).
 */
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
  Silvane: 'models/heroes/mirror_v2.glb',
  Bram: 'models/heroes/mason_v2.glb',
  Hank: 'models/heroes/timber_v2.glb',
  'Professor Puff': 'models/heroes/balloon_v2.glb',
  'Sir Whiskers': 'models/heroes/cat_v2.glb',
  'Mr. Ledger': 'models/heroes/ledger_v2.glb',
  'Big Yoko': 'models/heroes/sumo_v2.glb',
  Mum: 'models/heroes/mime_v2.glb',
};

/**
 * The size each hero's hits are judged with, measured from its model (2026-11-04: the width 90% of its body fits in, and the
 * height 99% of it does). `radius`: half that width plus 0.08 m, at least 0.38, so a bolt that looks like it touched does and one
 * that looks like it passed does. `height`: how high a mouse ray can pick it.
 */
export const HERO_BODIES: Record<string, { radius: number; height: number }> = {
  Vesper: { radius: 0.41, height: 2.35 }, Brannoc: { radius: 0.58, height: 2.35 }, Isolde: { radius: 0.4, height: 2.84 },
  Lyra: { radius: 0.38, height: 2.38 }, Vitriol: { radius: 0.43, height: 2.37 }, Kaia: { radius: 0.47, height: 3.24 },
  Sefu: { radius: 0.4, height: 2.86 }, Nyx: { radius: 0.4, height: 2.32 }, Fenna: { radius: 0.42, height: 2.55 },
  Auriel: { radius: 0.47, height: 2.33 }, Marin: { radius: 0.43, height: 2.29 }, Zephyr: { radius: 0.4, height: 2.37 },
  Mortis: { radius: 0.44, height: 2.51 }, Ada: { radius: 0.39, height: 2.29 }, Sirix: { radius: 0.44, height: 2.31 },
  Cantor: { radius: 0.39, height: 2.38 }, Opaline: { radius: 0.4, height: 2.46 }, Oblivion: { radius: 0.63, height: 2.62 },
  Shiori: { radius: 0.43, height: 2.3 }, Tempo: { radius: 0.41, height: 2.46 }, Silvane: { radius: 0.57, height: 2.73 },
  Bram: { radius: 0.59, height: 2.7 }, Hank: { radius: 0.61, height: 2.69 }, 'Professor Puff': { radius: 0.54, height: 2.43 },
  'Sir Whiskers': { radius: 0.49, height: 2.39 }, 'Mr. Ledger': { radius: 0.42, height: 2.4 },
  'Big Yoko': { radius: 0.76, height: 2.6 }, Mum: { radius: 0.45, height: 2.58 },
};

export const HERO_KITS: HeroKit[] = [bloodKit, forgeKit, frostKit, astralKit, alchemyKit, stormKit, sandKit, shadowKit, groveKit, dawnKit, tideKit, skyKit, boneKit, clockworkKit, hiveKit, bardKit, prismKit, voidKit, inkKit, chronoKit, mirrorKit, masonKit, timberKit, balloonKit, catKit, ledgerKit, sumoKit, mimeKit].map((k) => ({ ...k, model: k.model ?? MODELS[k.name] }));
