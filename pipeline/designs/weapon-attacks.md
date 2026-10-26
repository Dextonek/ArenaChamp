# Weapon attacks (hero wields the five weapons)

Category `weapon attacks`. The rigged hero (`public/models/figures/hero.glb`, the Azure Cloud disciple from the Dao
Archive, scaled ×1.3 to the arena figures) replaces the capsule caster, holds the weapon with its idle aura in the
right hand, dashes to the target, strikes and walks back. Framework: `src/effects/weapons/hero.ts` (load, bone
posing in figure space, weapon grip calibrated on the rest pose) and `src/effects/weapons/strike.ts` (`WeaponStrike`:
key poses, dash, capsule hide/restore, hits; `strikeModule`: targeting, telegraph, camera). `BladeTrail` in the kit.

| Label | File | Weapon | Targeting | Choreography | Impact |
|---|---|---|---|---|---|
| `azure dragon slash` | `strikes/dragonSlash.ts` | dragon sword | enemy | dash, sword raised over the right shoulder, diagonal cut down-across | cyan blade trail, a crescent of sword qi flies to the target, star + sparks |
| `frost lily thrust` | `strikes/frostThrust.ts` | ice sword | enemy (+ splash 2.6) | dash, coil at the hip, straight thrust | frost lily burst, ring of 9 ice spikes erupting then shattering, glitter, cold ring, dark mist |
| `green dragon sweep` | `strikes/crescentSweep.ts` | guandao | enemies ≤ 6 within 5.8 | step in, blade drawn back low right, wide horizontal sweep | flat jade crescent, hits in order right → left, jade stars, gold flecks |
| `thunder drum slam` | `strikes/thunderSlam.ts` | thunder hammer | enemy (+ splash 3.2) | run, leap with the hammer overhead, slam down | 4 sky bolts, violet star, two shockwave rings, sparks, dark dust, heavy shake |
| `phoenix gale` | `strikes/phoenixGale.ts` | fire fan | enemies ≤ 4, ranged | no dash: draw across the body, sweep out wide | one curved flame gust per target, a gold lily, a crown of flame tongues and petals on each hit |

Recipes drawn on: `f-spiderlily-scythe-ribbon` (swing trail), `f-spiderlily-fan-tufts` (radial flame tongues),
`f-spiderlily-gauntlet-ignition` (lily burst on impact), `d-kler-3-lightning-chain-cage` (bolts), `c-ice-spikes-eruption`
(ice spikes + fog + ring).
