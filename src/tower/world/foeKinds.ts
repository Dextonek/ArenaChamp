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
export const BUILT = new Set<string>(['sea_docker', 'sea_admiral', 'wood_giant', 'wood_sprite', 'wood_oak', 'wood_elder', 'wood_briar', 'wood_antler', 'sea_netter', 'sea_mate', 'sea_queen', 'sea_judge', 'sands_raider', 'sands_slinger', 'sands_chief', 'sands_scarab', 'sands_sphinx', 'sands_jackal', 'deep_lurker', 'deep_thief', 'deep_pale', 'deep_prism', 'deep_lamp', 'deep_seam', 'war_footman', 'war_bowman', 'war_knight', 'war_marshal', 'war_siege', 'war_crow']);

/**
 * The health bars sit over the top of each figure at its unit's size (the model review, 2026-11-16: the Pale One's crown, the Hollow
 * Oak's branches, the knights' plumes and the bearer's and deserter's crests stood through their bars): `barY` is the top of the figure
 * standing, divided by the unit's scale, plus 0.15. Looked at in the floors (round 2): the Hollow Oak's crown still touched its bar and the
 * Raider Chief carries his glaive up through his, so those two stand higher.
 */
export const FOE_MODELS: Record<string, FoeModel> = {
  // the Sea
  docker: { id: 'sea_docker', height: 1.6, strike: 'claw', barY: 1.75 },
  netter: { id: 'sea_netter', height: 1.6, shot: 'throw', barY: 1.75 },
  mate: { id: 'sea_mate', height: 1.85, strike: 'heavy', barY: 2.0 },
  barnacle: { id: 'sea_mate', height: 1.85, strike: 'heavy', tint: [0xa8c090, 0.35], barY: 2.0 },
  // the Wood
  giant: { id: 'wood_giant', height: 2.0, strike: 'heavy', barY: 2.15 },
  sprite: { id: 'wood_sprite', height: 1.55, shot: 'spell', hold: 'torch', barY: 1.7 },
  oak: { id: 'wood_oak', height: 3.0, strike: 'heavy', barY: 3.62 },
  // the Sands
  raider: { id: 'sands_raider', height: 1.65, strike: 'blade', barY: 1.8 },
  slinger: { id: 'sands_slinger', height: 1.65, shot: 'throw', barY: 1.75 },
  chief: { id: 'sands_chief', height: 1.9, strike: 'heavy', barY: 2.2 },
  mother: { id: 'sands_chief', height: 3.1, strike: 'heavy', tint: [0xe8c890, 0.4], barY: 3.4 },
  // the Deep
  lurker: { id: 'deep_lurker', height: 1.5, strike: 'claw', barY: 1.65 },
  thief: { id: 'deep_thief', height: 1.85, strike: 'blade', barY: 2.05 },
  pale: { id: 'deep_pale', height: 2.8, strike: 'claw', legs: 0.3, barY: 3.4 },
  // the War: the crimson and the azure, and those of neither army
  'footman-r': { id: 'war_footman', height: 1.9, strike: 'thrust', hold: 'shield', livery: 0x8c1e22, barY: 2.1 },
  'footman-b': { id: 'war_footman', height: 1.9, strike: 'thrust', hold: 'shield', livery: 0x1e3c8c, barY: 2.1 },
  ashen: { id: 'war_footman', height: 1.9, strike: 'thrust', hold: 'shield', livery: 0x5a5a62, tint: [0xb4b4bc, 0.45], barY: 2.1 },
  'bowman-r': { id: 'war_bowman', height: 1.9, shot: 'aim', livery: 0x8c1e22, barY: 2.05 },
  'bowman-b': { id: 'war_bowman', height: 1.9, shot: 'aim', livery: 0x1e3c8c, barY: 2.05 },
  'knight-r': { id: 'war_knight', height: 2.3, strike: 'thrust', livery: 0x8c1e22, barY: 2.75 },
  'knight-b': { id: 'war_knight', height: 2.3, strike: 'thrust', livery: 0x1e3c8c, barY: 2.75 },
  bearer: { id: 'war_knight', height: 2.1, strike: 'heavy', livery: 0x1c1822, barY: 2.55 },
  deserter: { id: 'war_knight', height: 2.15, strike: 'heavy', livery: 0x3a4a3a, tint: [0x8a9a80, 0.3], barY: 2.6 },
};
