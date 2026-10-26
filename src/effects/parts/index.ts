/**
 * The parts kit: shared building blocks distilled from the user's reference videos (pipeline/library batch d–g)
 * and docs/VFX_PRINCIPLES.md §7–§8. Spells should use these instead of re-inventing them per file.
 *
 * - ScreenFx (`screen.ts`): world darken + grade, anime impact frames with flat silhouettes (dark / light / X-ray /
 *   outline cards), focus lines, anti-flash → whiteout beats (`flashBeat`), chromatic pulses with tinted edges
 *   (`chromaPulse`), colour drain keeping one hue, and a crack web that shatters.
 * - StarBurst: hard-edged spiky camera-facing star (impact pop, glint).
 * - CrescentArc: crescent / wind / slash stroke along an arc, soft or toon style, with erosion.
 * - LightningArc: thick camera-facing jagged bolt with forks and flicker.
 * - SmokeBall: toon black smoke balls that break into flakes.
 */
export { createScreenFx, clearScreenFx, impactFrameAt, flashBeat, chromaPulse, type ScreenFx } from './screen';
export { StarBurst, type StarBurstOptions } from './starBurst';
export { CrescentArc, type CrescentArcOptions } from './crescentArc';
export { LightningArc, type LightningArcOptions } from './lightningArc';
export { SmokeBall, type SmokeBallOptions } from './smokeBall';
