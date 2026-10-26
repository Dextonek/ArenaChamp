# TerKungTH – Roblox Studio [Guide] VFX/ParticleEmitter – How to make quality VFX (AURA) (OxFo5lRNR0c)
https://www.youtube.com/watch?v=OxFo5lRNR0c · 20:42 · guide with burned-in captions (32K views). Mid-roll ads interrupted several sample points; notes come from the frames between them (sampled every 15-70 s). Settings are quoted as numbers only; explanations are paraphrased.

## Frame log (build steps)
| t (s) | on screen | step / setting shown |
|---|---|---|
| 5 | Studio, texture palette panel on the left (rings, stars, smoke, slashes) | a personal texture library is the starting point |
| 15 | preview of the finished aura: golden swirling rings around a figure on a dark floor | target look |
| 30-45 | caption: this is a guide, not a ParticleEmitter basics tutorial | |
| 60 | caption: a ground aura needs smoke, slash, fire, circle, ground and impact textures; flipbooks 1x1 or 8x8 | layer list |
| 110 | LightInfluence 0 (so Brightness works), Brightness 10, LightEmission 1 | unlit, over-bright additive look |
| 130 | Rotation -360..360, SpreadAngle 5,5 (recommended 1,1, flagged as important) | particles stay on the axis; random start rotation |
| 150-190 | a golden fire-smoke puff at the feet; if too bright, set the transparency end value to 0.5-0.75 (low rate) or lower brightness | brightness managed by transparency, not by colour |
| 215 | choose a texture that looks like a smoke ring | ring-shaped smoke for the base |
| 240 | non-flipbook: detailed splash/smoke textures; flipbook: looping smoke sheets 4x4 or 8x8 (impact, fire, circle, ground, flare, slash, water, sweep) | |
| 265 | ZOffset explained: positive pushes particles toward the camera, negative away (can hide them behind objects) | sorting control |
| 300 | an "Aura" attachment holding 3 ParticleEmitters | several emitters on one attachment |
| 330-360 | slash swirl emitter: EmissionDirection Top, Lifetime 0.4-1, Rate 20, Rotation -360..360, RotSpeed -350..-200, Speed 0.001-10, SpreadAngle 15,15, Drag 2.5 | all swirls spin the SAME direction (both RotSpeed values negative) |
| 400 | if too bright: transparency keys 0.3/0.9 or 0.4/0.75 on the second point | |
| 450 | Size given as a number relative to the part size | |
| 470 | LockedToPart enabled | the aura follows the character |
| 500 | circle layer: transparency ~0.75→0.25, same size as the part, speed 0 → "now it looks magical" | a static ring sprite is the glue |
| 560 | Floor aura: an effect that spreads across the floor and emanates from it | ground layer |
| 590 | floor aura: Rotation -360..360, RotSpeed -50..50, Speed 0.001, SpreadAngle 0,0 | slow-turning flat rings on the floor |
| 700 | big golden rune rings lying on the floor around the character | |
| 760 | star texture glitter: small bright 4-point stars add detail | detail layer |
| 900 | glitter: EmissionDirection Top, RotSpeed 0, small upward speed, SpreadAngle 0 | |
| 970-1150 | full stack: fire-smoke core, same-direction swirls, static ring, floor rings, glitter | |
| 1200 | close-up of the finished aura: dense golden swirls and light streaks around the character | final |

## Technique notes
- **Recipe of an aura (6 emitters on one attachment):** smoke-ring core, same-direction slash swirls, one static ring, slow floor rings, glitter stars, (optional) impact puffs. Each emitter has one job.
- **Spin in one direction.** RotSpeed range kept on one side of zero (-350..-200) so every swirl turns the same way: the aura reads as a vortex, not noise. The floor rings get a small symmetric range (-50..50) because they should look calm.
- **Near-zero speed, tight spread.** Speed 0.001 and SpreadAngle 0-1 keep particles where they are born; motion comes from rotation, size and transparency curves.
- **Brightness via transparency.** Over-bright additive stacks are fixed by raising transparency keys (0.3-0.9) or lowering emission, not by darkening colours. Matches our overdraw rule (§1) with concrete numbers.
- **A static ring is the glue.** A ring sprite at ~0.25-0.75 transparency, speed 0, same size as the base, ties the moving layers together.
- **Glitter last.** Tiny 4-point stars added at the end give the "quality" detail.
- Our kit: `Emitter` needs `rotSpeedRange` with a sign (same-direction spin) and `orient: 'up'` for floor rings; ZOffset ≈ `renderOrder` + a camera-ward offset.
