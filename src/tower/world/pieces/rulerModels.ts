import { REAL_STYLE, type RealStyle } from '../../../motion/real';
import { BUILT } from '../foeKinds';
import type { PiecesDef, RulerDef } from './types';

/**
 * The Climb's rulers as figures of their own (docs/tower/models/README.md, *Rulers*; the user, 2026-11-14: "models for rulers and
 * enemies, so the Climb's bosses and enemies stop being heroes"): fifteen giants, three a chapter, built in Blender as the people are
 * (blender/tower/<chapter>/<name>.py) and drawn from public/models/tower/<id>_v4.glb. Each stands on three floors of its chapter
 * under that floor's own name, tint and size; the chapter's first floor has the first of them in its own colours (no tint). The
 * crowns (10, 20, 30, 40, 50) are Raid bosses and keep theirs.
 *
 * Only the drawing changes: a ruler keeps the stand-in hero's kit (`RulerDef.stand`) for its numbers and the distance it keeps, so its
 * moves, health and timings are the floor's as before. What the model brings is its look, its hit size (`body`, measured on the
 * model) and how it holds what it carries (`hold`: a staff upright in the left hand, as the pack's torch clip has it).
 * `globalThis.__codeFoes = true` before a floor starts leaves every ruler its stand-in hero (the A/B).
 */
export interface RulerModel {
  /** `models/tower/<id>_v4.glb`. */
  id: string;
  /**
   * Its hit size at a hero's size (radius and height, m); the fight multiplies it by the ruler's `scale`. Measured on the posed-at-rest
   * model as the game draws it (1.3 times its own size): the height to its top; the radius of its trunk between waist and chest, kept
   * between 0.4 and 0.6 (a cloak, wing-cases or a weapon held low widen the trunk's ring past the body).
   */
  body: { radius: number; height: number };
  /** What its arms do when they do not strike (`REAL_STYLE`): a staff upright in the left hand. */
  hold?: RealStyle['hold'];
}

export const RULER_MODELS: Record<string, RulerModel> = {
  sea_admiral: { id: 'sea_admiral', body: { radius: 0.4, height: 2.38 } },
  sea_queen: { id: 'sea_queen', body: { radius: 0.45, height: 2.57 } },
  sea_judge: { id: 'sea_judge', body: { radius: 0.4, height: 2.54 } },
  wood_elder: { id: 'wood_elder', body: { radius: 0.4, height: 2.49 }, hold: 'torch' },
  wood_briar: { id: 'wood_briar', body: { radius: 0.46, height: 2.65 }, hold: 'torch' },
  wood_antler: { id: 'wood_antler', body: { radius: 0.6, height: 3.12 } },
  sands_scarab: { id: 'sands_scarab', body: { radius: 0.6, height: 2.55 } },
  sands_sphinx: { id: 'sands_sphinx', body: { radius: 0.4, height: 2.7 } },
  sands_jackal: { id: 'sands_jackal', body: { radius: 0.6, height: 2.66 } },
  deep_prism: { id: 'deep_prism', body: { radius: 0.54, height: 2.65 }, hold: 'torch' },
  deep_lamp: { id: 'deep_lamp', body: { radius: 0.4, height: 2.46 }, hold: 'torch' },
  deep_seam: { id: 'deep_seam', body: { radius: 0.6, height: 2.36 } },
  war_marshal: { id: 'war_marshal', body: { radius: 0.6, height: 2.48 } },
  war_siege: { id: 'war_siege', body: { radius: 0.42, height: 2.46 } },
  war_crow: { id: 'war_crow', body: { radius: 0.6, height: 2.56 }, hold: 'torch' },
};

/** Which ruler stands on which floor (the made floors' names in the comments). The first of a chapter's is on its first floor. */
export const RULER_OF: Record<number, string> = {
  // the Sea: the Drowned Captain, the Drowned Admiral, the Salt King / Mother of Wrecks, the Pearl Tyrant, the Gull Queen / the Tide
  // Judge, the Bell Below, the Lantern Leviathan
  1: 'sea_admiral', 2: 'sea_admiral', 3: 'sea_admiral', 4: 'sea_queen', 6: 'sea_queen', 9: 'sea_queen', 5: 'sea_judge', 7: 'sea_judge', 8: 'sea_judge',
  // the Wood: the Elder Root, the Moss Warden, the Hollow Elder / the Thorn Mother, the Briar Witch, the Mire Heart / the Antler King,
  // the Lantern Root, the Grey Oak
  11: 'wood_elder', 12: 'wood_elder', 15: 'wood_elder', 13: 'wood_briar', 16: 'wood_briar', 19: 'wood_briar', 14: 'wood_antler', 17: 'wood_antler', 18: 'wood_antler',
  // the Sands: the Scarab Colossus, the Scarab King, the Dune Colossus / the Brass Sphinx, the Mirage Lord, the Sun-Eater / the Glass
  // Serpent, the Sand Tyrant, the Red Jackal
  21: 'sands_scarab', 22: 'sands_scarab', 23: 'sands_scarab', 24: 'sands_sphinx', 26: 'sands_sphinx', 29: 'sands_sphinx', 25: 'sands_jackal', 27: 'sands_jackal', 28: 'sands_jackal',
  // the Deep: the Prism Mother, the Hollow Queen, Mother of Echoes / the Lamp Warden, the Blind Cantor, the Drowned Lantern / the Glass
  // Abbot, the Seam King, the Gem Tyrant
  31: 'deep_prism', 32: 'deep_prism', 35: 'deep_prism', 33: 'deep_lamp', 37: 'deep_lamp', 39: 'deep_lamp', 34: 'deep_seam', 36: 'deep_seam', 38: 'deep_seam',
  // the War: the Last Marshal, the Iron Marshal, the Banner Knight / the Siege Lord, the Ashen General, the War Drummer / the Crow King,
  // the Black Herald, the Grey Captain
  41: 'war_marshal', 42: 'war_marshal', 45: 'war_marshal', 43: 'war_siege', 44: 'war_siege', 48: 'war_siege', 46: 'war_crow', 47: 'war_crow', 49: 'war_crow',
};

/** How much of a made floor's tint lies over a ruler's own colours (a hero stand-in had 0.5: its colours were not the ruler's). */
const TINT = 0.22;

const codeFoes = () => !!(globalThis as { __codeFoes?: boolean }).__codeFoes;

/** The floor's pieces with its ruler drawn as its own figure (unchanged for a crown, a floor with none, or `__codeFoes`). */
export function withRulerModel(p: PiecesDef | undefined): PiecesDef | undefined {
  if (!p || p.crown || codeFoes()) return p;
  const m = RULER_MODELS[RULER_OF[p.floor] ?? ''];
  if (!m || !BUILT.has(m.id)) return p;
  const first = p.floor % 10 === 1;
  if (m.hold && !REAL_STYLE[p.ruler.name]) REAL_STYLE[p.ruler.name] = { hold: m.hold };
  const ruler: RulerDef = { ...p.ruler, model: `models/tower/${m.id}_v4.glb`, body: m.body, tint: first ? undefined : p.ruler.tint, tintAmount: TINT };
  return { ...p, ruler };
}
