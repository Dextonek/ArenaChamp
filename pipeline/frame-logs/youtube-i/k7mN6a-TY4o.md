# Coded Games / Techloria – Toon Explosion VFX – Stylized FX for Unreal Engine 5 (k7mN6a-TY4o)
https://www.youtube.com/watch?v=k7mN6a-TY4o · 42 s · asset-pack showcase: ~20 small toon explosions on a dark grid, one every ~1.4 s. Each burst lasts 0.5-1.2 s. Two logged in detail: the cel-shaded puff explosion (7.73-8.9) and the spiked ring pop (33.87-34.9).

Brightness scan (0.1 s): base L≈35. Every burst raises L only by 6-25 (max L71 at 36.6) and W stays ≤ 6 %: these explosions are NOT bright. Their readability comes from shape and flat colour, not light.

## Frame log – A: cel-shaded puff explosion
| t (s) | on screen | visible layers | change |
|---|---|---|---|
| 7.73 | empty | | |
| 7.80 | a cluster of cream-white round puffs (each with a hard outline) + 8 flat green flame-tongue spikes radiating out | toon puffs (opaque, hard-edged #fff6d0), spike sprites (#3ccf3c) | 1 frame pop at ~70 % size |
| 7.87 | spikes longer and curved outward like claws | | |
| 7.93 | a dark olive core appears inside the puffs (the shadow side), spikes start to shrink | dark core (normal #3a3a10) | dark appears 2 frames after the pop |
| 8.00 | puffs bigger, dark core bigger, spikes thin; tiny pink line sparks | | |
| 8.07 | spikes gone; a round puff ball, half cream half dark olive | | |
| 8.13 | puffs pushed outward, cream turns pale mint on the outer puffs, small grey smoke curls on top | colour-over-life cream → mint | |
| 8.20 | ball keeps growing slowly (drag), thin pink sparks | | |
| 8.30 | dark core breaks into holes; puffs pale mint with dark edges | erosion | |
| 8.45 | puffs separate into pale mint blobs; blue rims show at the bottom | | |
| 8.60 | only blue outline fragments and small specks | outline-only remnants (#3a8be0) | |
| 8.90 | clean | | total 1.1 s |

## Frame log – B: spiked ring pop
| t (s) | on screen | visible layers | change |
|---|---|---|---|
| 33.87 | empty | | |
| 33.93 | a small lime ring with white puffs inside and 7 magenta triangular spikes around it | ring (lime #c8f060), spikes (#e040e0 → white tips), puffs | 1-frame pop |
| 34.00 | spikes at max length, ring bigger | | |
| 34.07 | spikes start to retract, the inside is a bright white puff cluster | | |
| 34.13 | the ring becomes a hand-drawn scribble ring (2-3 overlapping lime brush strokes); tan cloud chunks and white sparkles inside | scribble ring | spikes gone |
| 34.20 | same, slightly larger | | |
| 34.30 | ring expands and thins, chunks fly out | | |
| 34.40-34.50 | ring breaks into separate dashes, chunks fade | | |
| 34.60 | next variant: magenta spikes, cream ring, magenta + cyan chunk core | | |
| 34.75-34.90 | cyan/magenta chunks inside a cream scribble ring | | |

## Technique notes
- **Pop at 70 % size, then grow slowly.** Every burst appears in one frame already large, then grows only a little with heavy drag. No ramp-up.
- **Dark core lags 2 frames.** The dark shadow side of the puffs appears 2 frames after the bright pop, so the first frame is pure bright shape and the next frames add volume.
- **Colour ramps in pastels.** Puffs go cream → mint → blue outline. The explosion ends as outline-only fragments: the fill disappears before the line (state change, not alpha fade; extends §8).
- **Spikes are the first 0.15 s only.** Flame tongues / triangle spikes give the explosive direction and are gone by the 3rd-4th frame; the puffs carry the rest.
- **Scribble ring.** The shock ring is 2-3 overlapping hand-drawn brush strokes, not a clean circle: it reads as toon.
- **Low light.** Mean brightness barely moves; flat opaque colours do the work. This is a style that would not blow out in our scene.
- Build: SmokeBall puffs with a toon ramp (cream / mint / dark) and an outline pass (NEW: toon outline/rim on SmokeBall), StarBurst with 6-8 flat spikes (lifetime 0.15 s), a scribble ring texture on createRing (NEW texture), tiny line sparks via Emitter.
