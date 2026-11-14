import type { FoeModel } from './foeModels';

/**
 * Which enemy kinds are drawn from a model, by the spec's `look` (docs/tower/models/README.md, *Enemies*). Three people-shaped models
 * a chapter: the common melee one, the ranged or casting one, the big one; a named enemy or an elite of another name shares its kind's
 * model under a tint, and the War's two armies share theirs in their own colours (`livery`). The fights are the specs' (`def.ts`), as
 * before: only the drawing changes, and the look strings stay, so the tactics' roles (tactics.ts reads the look's first word) do too.
 *
 * Kinds not listed stay drawn in code (looks.ts, looksWild.ts, f45/looks.ts): the beasts (the brine crab, the bark hound, the shard
 * mite, the crystal golem, the stag), the Sands' dust wraith (a spirit of the storm), the Wood's feeding root, the escorts.
 *
 * Decided here, for the user to overrule: the Wood has no people-shaped common melee (its pack fighter is the hound), so its three are
 * the moss giant (melee), the thorn sprite (caster) and the Hollow Oak (the big one, named); the Deep's ranged one is the golem, so its
 * three are the lurker (melee, a cave hunter that leaps), the Lantern Thief (the big one) and the Pale One (named); the Dune Mother
 * shares the Raider Chief's figure, the War's knights, banner bearers and the deserter share the knight's.
 */
/** The model files built so far (public/models/tower/<id>_v4.glb): a kind or a ruler whose file is not yet built stays as it was. */
export const BUILT = new Set<string>(['sea_docker', 'sea_admiral']);

export const FOE_MODELS: Record<string, FoeModel> = {
  // the Sea
  docker: { id: 'sea_docker', height: 1.6, strike: 'claw', barY: 1.75 },
  netter: { id: 'sea_netter', height: 1.6, shot: 'throw', barY: 1.75 },
  mate: { id: 'sea_mate', height: 1.85, strike: 'heavy', barY: 1.95 },
  barnacle: { id: 'sea_mate', height: 1.85, strike: 'heavy', tint: [0xa8c090, 0.35], barY: 1.95 },
  // the Wood
  giant: { id: 'wood_giant', height: 2.0, strike: 'heavy', barY: 2.15 },
  sprite: { id: 'wood_sprite', height: 1.55, shot: 'spell', hold: 'torch', barY: 1.7 },
  oak: { id: 'wood_oak', height: 3.0, strike: 'heavy', barY: 3.2 },
  // the Sands
  raider: { id: 'sands_raider', height: 1.65, strike: 'blade', barY: 1.75 },
  slinger: { id: 'sands_slinger', height: 1.65, shot: 'throw', barY: 1.75 },
  chief: { id: 'sands_chief', height: 1.9, strike: 'heavy', barY: 2.0 },
  mother: { id: 'sands_chief', height: 3.1, strike: 'heavy', tint: [0xe8c890, 0.4], barY: 3.4 },
  // the Deep
  lurker: { id: 'deep_lurker', height: 1.5, strike: 'claw', barY: 1.65 },
  thief: { id: 'deep_thief', height: 1.85, strike: 'blade', barY: 1.95 },
  pale: { id: 'deep_pale', height: 2.8, strike: 'claw', barY: 3.0 },
  // the War: the crimson and the azure, and those of neither army
  'footman-r': { id: 'war_footman', height: 1.9, strike: 'thrust', livery: 0x8c1e22, barY: 2.0 },
  'footman-b': { id: 'war_footman', height: 1.9, strike: 'thrust', livery: 0x1e3c8c, barY: 2.0 },
  ashen: { id: 'war_footman', height: 1.9, strike: 'thrust', livery: 0x5a5a62, tint: [0xb4b4bc, 0.45], barY: 2.0 },
  'bowman-r': { id: 'war_bowman', height: 1.9, shot: 'aim', livery: 0x8c1e22, barY: 2.0 },
  'bowman-b': { id: 'war_bowman', height: 1.9, shot: 'aim', livery: 0x1e3c8c, barY: 2.0 },
  'knight-r': { id: 'war_knight', height: 2.3, strike: 'thrust', livery: 0x8c1e22, barY: 2.5 },
  'knight-b': { id: 'war_knight', height: 2.3, strike: 'thrust', livery: 0x1e3c8c, barY: 2.5 },
  bearer: { id: 'war_knight', height: 2.1, strike: 'heavy', livery: 0x1c1822, barY: 2.4 },
  deserter: { id: 'war_knight', height: 2.15, strike: 'heavy', livery: 0x3a4a3a, tint: [0x8a9a80, 0.3], barY: 2.3 },
};
