---
title: Effect catalog
tags: [catalog, effects, vfx]
updated: 2026-10-29
---

# Effect catalog

Every effect registered in the Three.js VFX editor: **180 effects in 22 categories**, plus 13 test spells in a 23rd (`test: mechanics`, 193 registered slots), listed in the order of the category dropdown (the order in which `src/effects/index.ts` registers them; a category appears at its first effect). Each table gives the registered label, a one-line description taken from the effect's JSDoc header, how it targets, its length or tier, and links to the source, the design note in `pipeline/designs/` and the contact sheet in `docs/spells/` where they exist.

## Counts

| Category (dropdown name) | Effects |
|---|---|
| [set pieces](#set-pieces) | 8 |
| [paladin](#paladin) | 13 |
| [iconic](#iconic) | 20 |
| [original](#original) | 4 |
| [targeted](#targeted) | 68 |
| [parts kit](#parts-kit) | 1 |
| [hero: blood](#hero-blood) | 4 |
| [hero: forge](#hero-forge) | 4 |
| [hero: frost](#hero-frost) | 4 |
| [hero: astral](#hero-astral) | 4 |
| [hero: alchemy](#hero-alchemy) | 4 |
| [hero: storm](#hero-storm) | 4 |
| [hero: sand](#hero-sand) | 4 |
| [hero: shadow](#hero-shadow) | 4 |
| [hero: grove](#hero-grove) | 4 |
| [hero: dawn](#hero-dawn) | 4 |
| [hero: tide](#hero-tide) | 4 |
| [hero: sky](#hero-sky) | 4 |
| [hero: bone](#hero-bone) | 4 |
| [hero: clockwork](#hero-clockwork) | 4 |
| [weapons](#weapons) | 5 |
| [weapon attacks](#weapon-attacks) | 5 |
| [test: mechanics](#test-mechanics) | 13 (test spells, not counted below) |
| **Total** | **180** (+ 13 test spells = 193 slots) |

## How to read the tables

- **Targeting** is the `targeting` spec of the module: `enemy` (one target), `enemies` (shift-clicked or a nearest-neighbour chain, capped), `ground` (a spot, radius decides who is hit), `self` (centred on the caster). `fixed scene` effects have no targeting and play on the fixed demo scene.
- **Length** is the constant `DURATION` (or `TOTAL`, or a stated "~N s") in the source. `settings-driven` means the length is the `duration` getter, computed from other constants or from the effect's settings (cast time, flight time and so on), so there is no single literal number. `loop` is an idle aura.
- **Tier** comes from `pipeline/forged.json`: `hero tier` and `hero-cinematic` are the higher-bar batches, `hero kit Q/W/E/R` is a slot in one of the fourteen hero kits. **cinematic** marks the 14 effects that use `createCinematic` (a scripted camera and letterbox, `src/effects/parts/cinematic.ts`): genesis collapse, colossus drop, hyperion railgun, leviathan breach, ghost galleon broadside, caldera awakening, ophanim descent, thousand-cut iaido, lunar tide, abyssal angler, supercell, world tree rising, hourglass of ages, midnight circus. Of these, the ten tagged `hero-cinematic` plus hyperion railgun and leviathan breach (hero tier) are the fully cinematic heroes; genesis collapse and colossus drop are earlier cinematic ultimates.
- Sheets in `docs/spells/` are contact sheets (frames over time) made by `pipeline/tools/contact-sheet.js`. A few effects also have per-frame images (`<name>_1-....jpg`) next to the sheet.
- Descriptions are shortened from the source header; the header and the design note have the full timeline.

## set pieces

8 effects. The eight original timed set pieces (default category, registered in `src/effects/index.ts`, files in `src/effects/`). They play on the fixed demo scene (caster and one enemy at fixed positions), not on the shared arena.

| Label | Description | Targeting | Length / tier | Links |
|---|---|---|---|---|
| divine sword | A giant sword falls from the sky onto an enemy while a swarm of small spectral swords forms a spinning drill ahead of its tip and orbits the blade. | fixed scene | settings-driven | [source](../../src/effects/divineSword.ts) |
| gate of babylon | A wall of golden ripple portals opens in the sky behind the caster and fires volleys of swords and spears at the enemy. | fixed scene | settings-driven | [source](../../src/effects/gateOfBabylon.ts) |
| meteor shower | The sky over the target reddens and warning rings appear on the ground, then a barrage of burning rocks streaks down at a diagonal and cratering the area. | fixed scene | settings-driven | [source](../../src/effects/meteorShower.ts) |
| shockwave punch | A puncher stands 8 units in front of the enemy (which is at the origin) and gathers energy in its fist. | fixed scene | settings-driven | [source](../../src/effects/shockwavePunch.ts) |
| lightning strike | A storm cloud gathers above the enemy with arcs crackling inside it and around its feet, then a rapid series of jagged bolts hits it, scorching the ground and crushing it on ... | fixed scene | settings-driven | [source](../../src/effects/lightningStrike.ts) |
| spiral sphere | A spinning energy sphere forms in mid-air in front of the enemy (particle streams spiral in, tilted rings whirl around a bright core), charges, rushes the enemy, grinds ... | fixed scene | settings-driven | [source](../../src/effects/spiralSphere.ts) |
| energy beam | A caster 22 units in front of the enemy gathers light between cupped hands (particles stream inward, arcs crackle, dust is stirred up), then fires a wave that extends to the ... | fixed scene | settings-driven | [source](../../src/effects/energyBeam.ts) |
| black hole | A hole opens above and slightly behind the enemy, grows an event horizon, a photon ring and a glowing accretion disk, then drags debris, dust and finally the enemy into itself. | fixed scene | settings-driven | [source](../../src/effects/blackHole.ts) |

## paladin

13 effects. Reworked Paladin spells (`src/spells/paladin/`), fixed demo scene.

| Label | Description | Targeting | Length / tier | Links |
|---|---|---|---|---|
| judgment | The caster raises a hand, a rune circle locks onto the enemy, and a giant hammer of light drops out of the sky onto it. | fixed scene | settings-driven | [source](../../src/spells/paladin/judgment.ts) |
| crusader strike | The caster crouches, dashes in leaving a golden afterimage trail, and a giant crescent of light cuts through the enemy. | fixed scene | settings-driven | [source](../../src/spells/paladin/crusaderStrike.ts) |
| divine storm | The caster spins up holding a huge glowing sword, a golden whirlwind of ring blades and rising motes forms around it, holy rings burst outward. | fixed scene | settings-driven | [source](../../src/spells/paladin/divineStorm.ts) |
| wake of ashes | The caster hoists a giant two-handed blade, drives it into the ground, and a 70 degree fan of fire and holy ash tears along the floor with glowing cracks behind it and ... | fixed scene | settings-driven | [source](../../src/spells/paladin/wakeOfAshes.ts) |
| consecration | The caster drives a glowing palm into the ground at the enemy's feet and holy ground ignites in a wide rune circle: nested rings turning at different speeds, a belt of ... | fixed scene | settings-driven | [source](../../src/spells/paladin/consecration.ts) |
| avenging wrath | A column of light slams down on the caster, who rises into the air while two distinct wings of light (left and right of the back, each a swept fan hanging off an arm bone) ... | fixed scene | 5.2 s | [source](../../src/spells/paladin/avengingWrath.ts) |
| divine shield | A golden dome of hexagonal panels lights up around the caster in a wave from the ground up. | fixed scene | settings-driven | [source](../../src/spells/paladin/divineShield.ts) |
| lay on hands | The caster steps up to a kneeling, dimly lit ally and lays a hand on it. | fixed scene | 5.4 s | [source](../../src/spells/paladin/layOnHands.ts) |
| light of dawn | The caster raises the weapon, a sun rises behind the allies and a wide sunrise-coloured cone of light sweeps forward across the ground with rays of light. | fixed scene | settings-driven | [source](../../src/spells/paladin/lightOfDawn.ts) |
| divine toll | A giant translucent golden bell materialises above the caster, swings once and tolls. | fixed scene | 4.8 s | [source](../../src/spells/paladin/divineToll.ts) |
| hammer of wrath | A hammer condenses out of golden motes above the raised arm, is hurled end over end along an arc with a comet trail, and detonates in a holy explosion. | fixed scene | settings-driven | [source](../../src/spells/paladin/hammerOfWrath.ts) |
| avenger's shield | A spinning shield of light is thrown, ricochets through three enemies (each hit flashes, sparks, rings and leaves a silence mark spinning over the head), then returns to the ... | fixed scene | settings-driven | [source](../../src/spells/paladin/avengersShield.ts) |
| hammer of justice | A giant spectral hammer materialises above the enemy and swings down like a gavel onto its head. | fixed scene | settings-driven | [source](../../src/spells/paladin/hammerOfJustice.ts) |

## iconic

20 effects. Iconic spells from across the classes (`src/spells/iconic/`), fixed demo scene.

| Label | Description | Targeting | Length / tier | Links |
|---|---|---|---|---|
| fireball | Flames spiral into the mage's hand, a roiling fireball forms, streaks to the enemy leaving a thick fire-and-smoke trail, and detonates in a fiery blast with a smoke plume and ... | fixed scene | settings-driven | [source](../../src/spells/iconic/fireball.ts) |
| pyroblast | A long, heavy cast. The mage rises, magma rings orbit and the ground cracks open while a huge roiling fireball swells overhead. | fixed scene | settings-driven | [source](../../src/spells/iconic/pyroblast.ts) |
| frostbolt | Ice shards crystallise in front of the mage and fuse into a sharp ice spear that flies on a frosty mist trail. | fixed scene | settings-driven | [source](../../src/spells/iconic/frostbolt.ts) |
| blizzard | The caster channels a swirling storm cloud over the enemy area. | fixed scene | settings-driven | [source](../../src/spells/iconic/blizzard.ts) |
| arcane missiles | The caster channels. A nested rune sigil forms upright in front of the hands while arcane motes swirl up around the caster, then glowing missiles leave the sigil one after ... | fixed scene | settings-driven | [source](../../src/spells/iconic/arcaneMissiles.ts) |
| chain lightning | Five enemies stand staggered in front of the caster. A bolt leaps from the caster's hand to the first, then hops from target to target. | fixed scene | settings-driven | [source](../../src/spells/iconic/chainLightning.ts) |
| chaos bolt | A heavy warlock cast. Green and orange fel flames swirl round the hands with crackling arcs, then a jagged, unstable bolt of chaos launches slowly, accelerates, and leaves a ... | fixed scene | settings-driven | [source](../../src/spells/iconic/chaosBolt.ts) |
| rain of fire | A dark rune circle opens high above the enemy area and dozens of fel-green / orange meteors rain down at staggered times onto random spots. | fixed scene | settings-driven | [source](../../src/spells/iconic/rainOfFire.ts) |
| death coil | The dark caster gathers sickly green-yellow necrotic energy, then launches a writhing serpentine coil with a skull-ish head that weaves toward the enemy trailing shadowy wisps. | fixed scene | settings-driven | [source](../../src/spells/iconic/deathCoil.ts) |
| army of the dead | The death knight channels, frost runes spin under him and the ground cracks with sickly green-blue light. | fixed scene | 5 s | [source](../../src/spells/iconic/armyOfTheDead.ts) |
| starfall | The sky over the battlefield darkens to a starry violet while a lunar crescent glows under the caster. | fixed scene | 4.5 s | [source](../../src/spells/iconic/starfall.ts) |
| penance | A priest in white robes channels three volleys of holy light bolts. | fixed scene | settings-driven | [source](../../src/spells/iconic/penance.ts) |
| earthquake | The caster drives a rune totem into the ground, a glowing fissure races to the enemy and a huge circle around it ruptures. | fixed scene | settings-driven | [source](../../src/spells/iconic/earthquake.ts) |
| bladestorm | The warrior spins up with two huge blades into a whirlwind of steel, charges the enemy, circles it twice cutting it again and again, then skids to a stop in a burst of dust. | fixed scene | settings-driven | [source](../../src/spells/iconic/bladestorm.ts) |
| heroic leap | The warrior crouches, explodes into the sky on a wind-trailed arc, hangs at the apex, then dives and craters the ground beside the enemy. | fixed scene | settings-driven | [source](../../src/spells/iconic/heroicLeap.ts) |
| volley | The caster draws a bow and looses a flight of glowing arrows straight up. | fixed scene | settings-driven | [source](../../src/spells/iconic/volley.ts) |
| eye beam | The caster's eyes flare fel-green, then a wide layered beam channels from them toward the enemy and sweeps over its contact line. | fixed scene | settings-driven | [source](../../src/spells/iconic/eyeBeam.ts) |
| metamorphosis | The caster crouches, leaps high and slams down beside the enemy as a giant demon. | fixed scene | settings-driven | [source](../../src/spells/iconic/metamorphosis.ts) |
| spinning crane kick | The monk coils, rises and whirls with one leg out, wrapped in jade wind ribbons and swirling chi motes while a dust ring is kicked up. | fixed scene | settings-driven | [source](../../src/spells/iconic/spinningCraneKick.ts) |
| deep breath | A vast bronze dragon sweeps low across the arena in a straight line, pouring a continuous torrent of fire down and ahead of it. | fixed scene | settings-driven | [source](../../src/spells/iconic/deepBreath.ts) |

## original

4 effects. Original moves designed from their names (`src/spells/original/`), fixed demo scene.

| Label | Description | Targeting | Length / tier | Links |
|---|---|---|---|---|
| corpse finger gravity pull | The dark caster stabs a hand into the earth, a crack of violet-black light runs to the middle of the arena and a giant corpse hand claws out of the ground. | fixed scene | 6.8 s | [source](../../src/spells/original/corpseFingerGravityPull.ts) |
| illusionist rain of doom | The caster twirls in prismatic light and five mirror clones step out beside it (each with red/cyan chromatic ghosts). | fixed scene | 7.0 s | [source](../../src/spells/original/illusionistRainOfDoom.ts) |
| solar verdict | The sun itself passes judgement. The caster raises a blade, the scene dims to amber-black and a sun forms high above the enemy (white-gold core, rotating flare spikes ... | fixed scene | 6.8 s | [source](../../src/spells/original/solarVerdict.ts) |
| crown of the final star | Seven stars ignite above the caster's head and spin into a crown that rises over the enemy and widens into a vast constellation while the sky goes indigo. | fixed scene | 7.0 s | [source](../../src/spells/original/crownOfTheFinalStar.ts) |

## targeted

68 effects. Targeted spells (`src/spells/targeted/`): they aim at the enemies or ground spot picked in the shared arena (see `src/effects/targeting.ts`). Most were written by the forge-vfx pipeline; `pipeline/forged.json` records mode, tier and recipes. Registered in `src/spells/targeted/index.ts` (the eight hero kits are registered in the same array but use their own categories, below).

| Label | Description | Targeting | Length / tier | Links |
|---|---|---|---|---|
| starbreaker lance | Star-motes spiral into the caster's raised hand and forge a lance of light while a lock-on rune closes around the chosen enemy. | enemy | settings-driven | [source](../../src/spells/targeted/starbreakerLance.ts) |
| glacial ricochet | Cold mist swirls around the caster while a spiky frost orb grows above their hands. | enemies (up to 7) | settings-driven | [source](../../src/spells/targeted/glacialRicochet.ts), [design](../../pipeline/designs/glacial-ricochet.md) |
| cataclysm sigil | A huge burning sigil draws itself on the chosen ground, its pulse racing faster as the countdown runs out, four satellite circles flare around it and fiery orbs gather in the ... | ground (r 6) | 5.4 s | [source](../../src/spells/targeted/cataclysmSigil.ts), [design](../../pipeline/designs/cataclysm-sigil.md) |
| abyssal gaze | A violet void eye opens in front of the caster while dark wisps are sucked into it and an upright rune stands behind. | enemy | settings-driven | [source](../../src/spells/targeted/abyssalGaze.ts), [design](../../pipeline/designs/abyssal-gaze.md) |
| tempest lattice | The world dims to a cold blue, a bolt hops from the caster through every chosen enemy in order (one hop per 0.15 s, each enemy flashing as it is reached) and closes back on ... | enemies (up to 6) | settings-driven | [source](../../src/spells/targeted/tempestLattice.ts), [design](../../pipeline/designs/tempest-lattice.md) |
| gale bullet | The caster kicks up a wind swirl and a dust cloud that hides them for a beat, then fires a compact ball of spinning wind crescents. | enemy | 3.4 s | [source](../../src/spells/targeted/galeBullet.ts), [design](../../pipeline/designs/gale-bullet.md) |
| cinder bow | A flat disc of flame ribbons whips round the caster in a darkened world, flame spikes flick up and black scraps spit out. | enemy | 5.0 s | [source](../../src/spells/targeted/cinderBow.ts), [design](../../pipeline/designs/cinder-bow.md) |
| ember comet | The comet's own shadow slides in from the caster's side and grows on the ground at the aim point (the telegraph carries the theme). | ground (r 4) | 3.0 s | [source](../../src/spells/targeted/emberComet.ts), [design](../../pipeline/designs/ember-comet.md) |
| violet severance | The caster gathers a violet flare at the hand while thin rings contract into it and motes are sucked in, then the beam LENGTH snaps out in 0.3 s and keeps going 6 m past the ... | enemy | 4.2 s | [source](../../src/spells/targeted/violetSeverance.ts), [design](../../pipeline/designs/violet-severance.md) |
| jade dragon ascension | A gold spark draws a jade sigil on the ground, motes and a toon spiral implode into its centre, then a spirit dragon made of silk ribbons coils up out of the sigil to ~11 m ... | ground (r 5) | 5.2 s | [source](../../src/spells/targeted/jadeDragonAscension.ts), [design](../../pipeline/designs/jade-dragon-ascension.md), [sheet](../spells/jade-dragon_sheet.jpg) |
| hundred lily frost | The world goes cold and a pale glint gathers at the caster's hand while frost mist rolls out along the ground. | enemies (up to 6) | settings-driven | [source](../../src/spells/targeted/hundredLilyFrost.ts), [design](../../pipeline/designs/hundred-lily-frost.md), [sheet](../spells/lily-frost_sheet.jpg) |
| taiji thunder seal | The world goes dark and a 7 m taiji seal (violet light half, black half, eight trigram bars) forms in the sky over the chosen enemy. | enemy | 4.4 s | [source](../../src/spells/targeted/taijiThunderSeal.ts), [design](../../pipeline/designs/taiji-thunder-seal.md), [sheet](../spells/taiji-seal_sheet.jpg) |
| golden bell sutra | A thin gold pillar of light calls a giant translucent temple bell (dark bronze body, bright thin fresnel rim, gold bands and studs) out of the sky. | self (r 6) | 4.4 s | [source](../../src/spells/targeted/goldenBellSutra.ts), [design](../../pipeline/designs/golden-bell-sutra.md), [sheet](../spells/golden-bell_sheet.jpg) |
| ink moon severance | The world drains to a dark violet monochrome while ink drips up from the caster's hand and a thin violet brush line draws itself across the ground through the chosen enemies ... | enemies (up to 5) | 4.2 s | [source](../../src/spells/targeted/inkMoonSeverance.ts), [design](../../pipeline/designs/ink-moon-severance.md), [sheet](../spells/ink-moon_sheet.jpg) |
| vermilion phoenix dive | Embers spiral up round the caster and a cold glint opens; a hand-drawn phoenix (canvas sprite rig: crested head, body, two feathered wings, three scrolling tail plumes) ... | enemy | 4.6 s | [source](../../src/spells/targeted/vermilionPhoenixDive.ts), [design](../../pipeline/designs/vermilion-phoenix-dive.md), [sheet](../spells/phoenix_sheet.jpg) |
| red lotus inferno | A ring of fire runes burns into the ground, then a giant fire lotus (two rings of 8 flat-shaded petals with a black outline and a flame fringe) rises and opens to a cup ... | ground (r 5) | 4.6 s | [source](../../src/spells/targeted/redLotusInferno.ts), [design](../../pipeline/designs/red-lotus-inferno.md), [sheet](../spells/red-lotus_sheet.jpg) |
| nine tail foxfire | Nine fox tails (one hard-edged canvas silhouette each, black outline, dark root, orange body, pink tip, cream point) fan open behind the caster. | enemies (up to 9) | 4.2 s | [source](../../src/spells/targeted/nineTailFoxfire.ts), [design](../../pipeline/designs/nine-tail-foxfire.md), [sheet](../spells/foxfire_sheet.jpg) |
| paper crane blizzard | The world goes cold blue and twelve sheets of paper unfold out of the caster's hand and fold into origami cranes (white and pale blue, flat facets, dark creases). | enemies (up to 6) | 4.4 s | [source](../../src/spells/targeted/paperCraneBlizzard.ts), [design](../../pipeline/designs/paper-crane-blizzard.md), [sheet](../spells/paper-crane_sheet.jpg) |
| mirror ice prison | Frost cracks spread under the chosen enemy, then six tall faceted panels of mirror ice punch up around it one after another (a hexagonal cell with a vertex toward the camera). | enemy | settings-driven | [source](../../src/spells/targeted/mirrorIcePrison.ts), [design](../../pipeline/designs/mirror-ice-prison.md), [sheet](../spells/mirror-prison_sheet.jpg) |
| flying sword formation | The world darkens and a violet sky sigil draws itself over the chosen spot, tilted ~55 degrees toward the caster. 36 dark-steel swords (gold guard, thin violet-white edge) ... | ground (r 5) | 5.0 s | [source](../../src/spells/targeted/flyingSwordFormation.ts), [design](../../pipeline/designs/flying-sword-formation.md), [sheet](../spells/flying-swords_sheet.jpg) |
| thunder god drums | The world goes dark and a ring of eight floating war drums (black lacquer barrels, gold rims and studs, one violet glowing drumhead each) fades in over the area, tilted ... | ground (r 5.5) | 4.8 s | [source](../../src/spells/targeted/thunderGodDrums.ts), [design](../../pipeline/designs/thunder-god-drums.md), [sheet](../spells/thunder-drums_sheet.jpg) |
| bamboo leaf gale | Hundreds of hard-edged bamboo leaves (instanced, drawn on a canvas with a dark midrib, outline and a two-tone value ramp) lift off the ground round the caster in a toon-wind ... | enemy | 3.8 s | [source](../../src/spells/targeted/bambooLeafGale.ts), [design](../../pipeline/designs/bamboo-leaf-gale.md), [sheet](../spells/bamboo-gale_sheet.jpg) |
| jade imperial seal | A red square outline closes round the chosen enemy while the world darkens. | enemy | 4.2 s | [source](../../src/spells/targeted/jadeImperialSeal.ts), [design](../../pipeline/designs/jade-imperial-seal.md), [sheet](../spells/jade-seal_sheet.jpg) |
| cloud step cyclone | Pale jade-white xiangyun cloud curls (drawn on canvas, outlined, three-step value ramp) spiral out of the ground round the caster and climb the wall of a twisted toon-wind ... | self (r 6) | 4.4 s | [source](../../src/spells/targeted/cloudStepCyclone.ts), [design](../../pipeline/designs/cloud-step-cyclone.md), [sheet](../spells/cloud-cyclone_sheet.jpg) |
| heavenly buddha palm | Clouds part above the chosen spot and a gold shaft of light comes down. | ground (r 5) | 4.6 s | [source](../../src/spells/targeted/heavenlyBuddhaPalm.ts), [design](../../pipeline/designs/heavenly-buddha-palm.md), [sheet](../spells/buddha-palm_sheet.jpg) |
| golden halberd comet | A 6 m dark-gold halberd (ji) forms in the caster's raised hand out of converging gold motes and turns to aim, a needle-thin gold line marks the target, then it is hurled like ... | enemy | 3.8 s | [source](../../src/spells/targeted/goldenHalberdComet.ts), [design](../../pipeline/designs/golden-halberd-comet.md), [sheet](../spells/golden-halberd_sheet.jpg) |
| ghost lantern procession | Six paper lanterns (dark red-black shells, dark ribs, black lacquer caps, gold tassels, a violet ghost flame glowing through the paper) rise one by one round the caster, then ... | enemies (up to 6) | 4.6 s | [source](../../src/spells/targeted/ghostLanternProcession.ts), [design](../../pipeline/designs/ghost-lantern-procession.md), [sheet](../spells/ghost-lanterns_sheet.jpg) |
| shadow puppet execution | The world goes dark and a tall back-lit paper screen unrolls behind the target, facing the caster. | enemy | 4.4 s | [source](../../src/spells/targeted/shadowPuppetExecution.ts), [design](../../pipeline/designs/shadow-puppet-execution.md), [sheet](../spells/shadow-puppets_sheet.jpg) |
| spider lily soul field | A wave of red spider lilies (hard-edged canvas billboards with thin curling petals and long gold-tipped stamens) blooms outward from the aim point across the whole circle. | ground (r 5.5) | 4.8 s | [source](../../src/spells/targeted/spiderLilySoulField.ts), [design](../../pipeline/designs/spider-lily-soul-field.md), [sheet](../spells/spider-lily_sheet.jpg) |
| taotie bronze maw | The world darkens and a violet taotie face cracks open in the ground. | ground (r 4.5) | 4.6 s | [source](../../src/spells/targeted/taotieBronzeMaw.ts), [design](../../pipeline/designs/taotie-bronze-maw.md), [sheet](../spells/taotie-maw_sheet.jpg) |
| supernova seed | A star chart draws behind the enemy, a small star is planted in it and swells while the world goes to deep space, then everything collapses to a pinpoint, a dead beat, and ... | enemy | settings-driven | [source](../../src/spells/targeted/supernovaSeed.ts), [design](../../pipeline/designs/supernova-seed.md), [sheet](../spells/supernova_sheet.jpg) |
| clockwork judgement | A giant brass clock face is drawn on the ground (canvas dial, real gear meshes around the rim, filigree hands). | ground (r 5.5) | 4.8 s | [source](../../src/spells/targeted/clockworkJudgement.ts), [design](../../pipeline/designs/clockwork-judgement.md), [sheet](../spells/clockwork_sheet.jpg) |
| kraken grasp | Dark water portals (two-noise swirl, black centre, teal foam rim) open under each enemy in turn. | enemies (up to 5) | 4.6 s | [source](../../src/spells/targeted/krakenGrasp.ts), [design](../../pipeline/designs/kraken-grasp.md), [sheet](../spells/kraken_sheet.jpg) |
| bifrost strike | A Norse rune circle with a knotwork band is drawn on the ground under a stormy, darkened world. | ground (r 4.5) | settings-driven | [source](../../src/spells/targeted/bifrostStrike.ts), [design](../../pipeline/designs/bifrost-strike.md), [sheet](../spells/bifrost_sheet.jpg) |
| glitch purge | Digital theme, motion is deliberately stepped (positions are re-rolled only every 4 frames, 15 fps) against the smooth spells. | enemies (up to 5) | 4.2 s | [source](../../src/spells/targeted/glitchPurge.ts), [design](../../pipeline/designs/glitch-purge.md), [sheet](../spells/glitch_sheet.jpg) |
| sun disk of ra | Cartouche glyphs (gold on dark) float up round the caster while the world darkens warm. | enemy | 4.4 s | [source](../../src/spells/targeted/sunDiskOfRa.ts), [design](../../pipeline/designs/sun-disk-of-ra.md), [sheet](../spells/sun-disk_sheet.jpg) |
| genesis collapse | The caster is lifted out of the arena on a column of light (a stand-in figure rises; the real caster is only hidden and restored), the camera leaves the atmosphere for orbit ... | enemies (up to 8) | 60 s · cinematic | [source](../../src/spells/targeted/genesisCollapse.ts), [design](../../pipeline/designs/genesis-collapse.md), [sheet](../spells/genesis_sheet.jpg) |
| thornwood bloom | Roots crack the ground in a spiral and leaves rustle up, then eight thick thorned vines (tapered bark tubes with a toon shader skin, black thorn cones) burst up in spiral ... | ground (r 5) | 4.8 s | [source](../../src/spells/targeted/thornwoodBloom.ts), [design](../../pipeline/designs/thornwood-bloom.md), [sheet](../spells/thornwood_sheet.jpg) |
| titan fist | Glowing lava cracks race across the ground under the chosen enemy and the soil bulges, then a colossal faceted basalt fist (forearm, hand block, four knuckles, curled ... | enemy | 4.2 s | [source](../../src/spells/targeted/titanFist.ts), [design](../../pipeline/designs/titan-fist.md), [sheet](../spells/titan-fist_sheet.jpg) |
| jellyfish bloom | Twelve bioluminescent jellyfish (translucent dark-violet bells with a thin fresnel rim, a soft rib-and-lobe pattern inside, long thin ribbon tentacles that sway and trail) ... | enemies (up to 6) | 5.1 s | [source](../../src/spells/targeted/jellyfishBloom.ts), [design](../../pipeline/designs/jellyfish-bloom.md), [sheet](../spells/jellyfish_sheet.jpg) |
| checkmate | The world darkens and an 8x8 marble chessboard flips in tile by tile from the chosen enemy outward (the enemy stands on the centre of tile e5). | enemy | 4.6 s | [source](../../src/spells/targeted/checkmate.ts), [design](../../pipeline/designs/checkmate.md), [sheet](../spells/checkmate_sheet.jpg) |
| orbital lance | The world darkens cold and a hex-grid targeting reticle unfolds on the ground under the chosen enemy (thin cyan hex outlines popping outward, dark tinted tiles, a red ... | enemy | 4.4 s | [source](../../src/spells/targeted/orbitalLance.ts), [design](../../pipeline/designs/orbital-lance.md), [sheet](../spells/orbital-lance_sheet.jpg) |
| stained glass sanctum | A floor rose fades in under the area and eight tall gothic windows (pointed arch, black lead lines, a rose and a diamond lattice of coloured panes, drawn on canvas) rise in a ... | ground (r 5) | settings-driven | [source](../../src/spells/targeted/stainedGlassSanctum.ts), [design](../../pipeline/designs/stained-glass-sanctum.md), [sheet](../spells/stained-glass_sheet.jpg) |
| murder of crows | The world dims to grey-violet and a flock of crows (drawn silhouettes with a pale-violet rim, flapping wings, tiny red eyes) bursts out of the caster's cloak in a swirl, then ... | enemies (up to 6) | 4.8 s | [source](../../src/spells/targeted/murderOfCrows.ts), [design](../../pipeline/designs/murder-of-crows.md), [sheet](../spells/crows_sheet.jpg) |
| hellfire chains | Demonic glyph gates open in the ground under every chosen enemy and heavy dark-iron chains lash out of them, spiral round the enemies and cinch tight while a few links glow ... | enemies (up to 5) | 4.6 s | [source](../../src/spells/targeted/hellfireChains.ts), [design](../../pipeline/designs/hellfire-chains.md), [sheet](../spells/hellfire_sheet.jpg) |
| colossus drop | The caster fires an orange signal flare, a red targeting ring is painted on the arena, and a ten-metre steel mech drops from orbit behind a heat shield, brakes on cyan ... | enemies (up to 8) | 45 s · cinematic | [source](../../src/spells/targeted/colossusDrop.ts), [design](../../pipeline/designs/colossus-drop.md), [sheet](../spells/colossus_sheet.jpg) |
| tarot judgement | Five giant tarot cards (backs showing: violet with a gilt lattice) fan out of the caster's hand, fly to the enemies spinning and stand upright behind each one, their backs to ... | enemies (up to 5) | 4.6 s | [source](../../src/spells/targeted/tarotJudgement.ts), [design](../../pipeline/designs/tarot-judgement.md), [sheet](../spells/tarot_sheet.jpg) |
| great wave | A woodblock-print wave. Flat dark-blue water seeps up over the chosen area, then a huge curling wall rises on the FAR side of it (facing the caster, so the barrel and the lip ... | ground (r 6) | 4.6 s | [source](../../src/spells/targeted/greatWave.ts), [design](../../pipeline/designs/great-wave.md), [sheet](../spells/great-wave_sheet.jpg) |
| tesla coil field | The world goes dark and four tesla coils (iron base, ridged copper windings, a brass toroid on top; mid-tone lit materials below the bloom threshold, only a thin violet rim ... | ground (r 5.5) | 4.6 s | [source](../../src/spells/targeted/teslaCoilField.ts), [design](../../pipeline/designs/tesla-coil-field.md), [sheet](../spells/tesla_sheet.jpg) |
| mammoth stampede | Frost motes swirl together behind the caster into a drawn, translucent woolly-mammoth spirit (seen from behind: shaggy rump, big ears, tusks curving out to the sides, raised ... | enemy | settings-driven | [source](../../src/spells/targeted/mammothStampede.ts), [design](../../pipeline/designs/mammoth-stampede.md), [sheet](../spells/mammoth_sheet.jpg) |
| sandstorm djinn | Sand ripples spiral across the ground and a twisted toon-band sand funnel (ochre, dune shade, storm-brown lines, no glow) spins up round the caster. | self (r 6) | 4.8 s | [source](../../src/spells/targeted/sandstormDjinn.ts), [design](../../pipeline/designs/sandstorm-djinn.md), [sheet](../spells/djinn_sheet.jpg) |
| aurora veil | Under a polar-night sky of stars, a faint aurora band waves high up and seven tall rippling aurora curtains (green body, teal edge, magenta lower fringe, vertical streaks) ... | ground (r 5.5) | settings-driven | [source](../../src/spells/targeted/auroraVeil.ts), [design](../../pipeline/designs/aurora-veil.md), [sheet](../spells/aurora_sheet.jpg) |
| event horizon | A real black hole. A pure-black sphere hangs over the aim point, a thin photon ring hugs it and a drawn, tilted accretion disk (spiral gas arms with black lines between the ... | ground (r 6) | 7.0 s · hero tier | [source](../../src/spells/targeted/eventHorizon.ts), [design](../../pipeline/designs/event-horizon.md), [sheet](../spells/event-horizon_sheet.jpg) |
| hyperion railgun | A huge rail cannon assembles itself from hard drawn panels behind the caster's shoulder, locks a HUD reticle on the primary target, charges (coils light up back to front ... | enemies (up to 12) | 8.5 s · hero tier, cinematic | [source](../../src/spells/targeted/hyperionRailgun.ts), [design](../../pipeline/designs/hyperion-railgun.md), [sheet](../spells/hyperion-railgun_sheet.jpg) |
| leviathan breach | A whirlpool opens in the ground at the point, a sea serpent bursts out of it inside a toon water column, arcs over the arena in one huge loop (apex ~14.6 m) and crashes ... | ground (r 5) | 11 s · hero tier, cinematic | [source](../../src/spells/targeted/leviathanBreach.ts), [design](../../pipeline/designs/leviathan-breach.md), [sheet](../spells/leviathan-breach_sheet.jpg) |
| ghost galleon broadside | A fog bank rolls in over the arena, a spectral pirate galleon sails out of it through the air (bow and figurehead first), swings broadside toward the enemies, opens eight gun ... | enemies (up to 8) | 24 s · hero-cinematic, cinematic | [source](../../src/spells/targeted/ghostGalleonBroadside.ts), [design](../../pipeline/designs/ghost-galleon-broadside.md), [sheet](../spells/ghost-galleon_sheet.jpg) |
| caldera awakening | The caster stamps, a crack races across the floor and a volcano grows out of the arena: basalt columns heave up in waves and lock into a cone, the crater crust heaves, cracks ... | ground (r 8) | 22 s · hero-cinematic, cinematic | [source](../../src/spells/targeted/calderaAwakening.ts), [design](../../pipeline/designs/caldera-awakening.md), [sheet](../spells/caldera_sheet.jpg) |
| ophanim descent | A "biblically accurate" angel. Three interlocking bronze wheels (within wheels), covered in drawn eyes, descend through a split in a storm-cloud ring. | ground (r 7) | 22 s · hero-cinematic, cinematic | [source](../../src/spells/targeted/ophanimDescent.ts), [design](../../pipeline/designs/ophanim-descent.md), [sheet](../spells/ophanim_sheet.jpg) |
| thousand-cut iaido | A samurai duel cut. The caster draws a katana (drawn model: curved blade, gold tsuba, wrapped hilt, lacquer scabbard) and time stops: the world drains to grey, dust hangs in ... | enemies (up to 8) | 16 s · hero-cinematic, cinematic | [source](../../src/spells/targeted/thousandCutIaido.ts), [design](../../pipeline/designs/thousand-cut-iaido.md), [sheet](../spells/iaido_sheet.jpg) |
| lunar tide | The caster raises a hand and the moon itself comes down. A huge drawn moon (cratered canvas texture, dark maria, lit limb, a standard lit sphere below the bloom threshold) ... | ground (r 7) | 20.5 s · hero-cinematic, cinematic | [source](../../src/spells/targeted/lunarTide.ts), [design](../../pipeline/designs/lunar-tide.md), [sheet](../spells/lunar-tide_sheet.jpg) |
| abyssal angler | The arena sinks into the deep sea. Darkness floods in, silt and bioluminescent motes hang in the water, a single cyan lure sways in the black and the enemies drift toward it ... | ground (r 6) | 18 s · hero-cinematic, cinematic | [source](../../src/spells/targeted/abyssalAngler.ts), [design](../../pipeline/designs/abyssal-angler.md), [sheet](../spells/angler_sheet.jpg) |
| supercell | The sky turns slate, a rotating wall cloud lowers under a huge anvil, a funnel lowers and touches down at the point as a tornado of dust and debris that pulls the enemies in ... | ground (r 8) | 20 s · hero-cinematic, cinematic | [source](../../src/spells/targeted/supercell.ts), [design](../../pipeline/designs/supercell.md), [sheet](../spells/supercell_sheet.jpg) |
| world tree rising | A seed thrown by the caster sinks into the floor at the point and cracks the ground, then a colossal tree grows in one continuous rise: a twisting 22 tall trunk (a tube along ... | ground (r 8) | 22 s · hero-cinematic, cinematic | [source](../../src/spells/targeted/worldTreeRising.ts), [design](../../pipeline/designs/world-tree-rising.md), [sheet](../spells/world-tree_sheet.jpg) |
| hourglass of ages | The caster raises a hand, a clock chime rolls out and a giant brass-framed hourglass condenses from gold dust above the enemies, drops over them and slams down, trapping them ... | ground (r 6) | 18 s · hero-cinematic, cinematic | [source](../../src/spells/targeted/hourglassOfAges.ts), [design](../../pipeline/designs/hourglass-of-ages.md), [sheet](../spells/hourglass_sheet.jpg) |
| midnight circus | A sinister big top erupts from the floor around the enemies. | enemies (up to 6) | 20 s · hero-cinematic, cinematic | [source](../../src/spells/targeted/midnightCircus.ts), [design](../../pipeline/designs/midnight-circus.md), [sheet](../spells/midnight-circus_sheet.jpg) |
| neon fracture jab | The caster crouches in cyan wind, a glowing ball lands on the target's head before the fist does, hard cyan brush strokes shoot in along the dash, and the hit becomes a ... | enemy | 2.8 s | [source](../../src/spells/targeted/neonFractureJab.ts), [design](../../pipeline/designs/neon-fracture-jab.md) |
| prism overture | A monochrome ink-and-light move. The caster's orb shrinks to a speck, a thin black-and-white ink tendril climbs from the aim point while pink / teal fringes flick at the ... | ground (r 5) | 4.2 s | [source](../../src/spells/targeted/prismOverture.ts), [design](../../pipeline/designs/prism-overture.md) |
| crimson requiem | The colour drains out of the world until only red survives. A thin red blade is drawn upward from the caster over a grey spiral, red petals orbit and then rush the camera in ... | enemies (up to 5) | 6.6 s | [source](../../src/spells/targeted/crimsonRequiem.ts), [design](../../pipeline/designs/crimson-requiem.md) |

## parts kit

1 effect. A single reference spell that exercises every part of the shared kit in `src/effects/parts` (category `parts kit`).

| Label | Description | Targeting | Length / tier | Links |
|---|---|---|---|---|
| parts showcase | One short spell that exercises every part of the kit in the order the reference videos use them. | enemies (up to 4) | settings-driven | [source](../../src/spells/targeted/partsShowcase.ts) |

## hero: blood

4 effects. Vesper, the Crimson Countess. Hero kit, see [Blood](heroes/blood.md).

| Label | Description | Targeting | Length / tier | Links |
|---|---|---|---|---|
| hemolance | A pale cut across the caster's raised palm sprays blood; a tendril of blood pours up out of the hand, coils once above the shoulder and straightens toward the enemy in front ... | enemy | 1.6 s · hero kit Q | [source](../../src/spells/targeted/hemolance.ts), [design](../../pipeline/designs/hemolance.md), [kit sheet](../../pipeline/designs/blood-kit.md), [sheet](../spells/hemolance_sheet.jpg) |
| thorn garden | The caster flicks a hand down and a tendril pours to the ground and runs to the target point. | ground (r 4.5) | 2.3 s · hero kit W | [source](../../src/spells/targeted/thornGarden.ts), [design](../../pipeline/designs/thorn-garden.md), [kit sheet](../../pipeline/designs/blood-kit.md), [sheet](../spells/thorn-garden_sheet.jpg) |
| crimson pact | Arms spread, a bone sigil draws on under the caster and blood rises from both palms into a heart of liquid blood above her head. | self (r 6) | 3.2 s · hero kit E | [source](../../src/spells/targeted/crimsonPact.ts), [design](../../pipeline/designs/crimson-pact.md), [kit sheet](../../pipeline/designs/blood-kit.md), [sheet](../spells/crimson-pact_sheet.jpg) |
| sanguine eclipse | The world darkens, three blood beads are thrown into the sky and a pale bone moon appears above the zone and BLEEDS (red runs down it). | ground (r 7) | 4.5 s · hero kit R | [source](../../src/spells/targeted/sanguineEclipse.ts), [design](../../pipeline/designs/sanguine-eclipse.md), [kit sheet](../../pipeline/designs/blood-kit.md), [sheet](../spells/sanguine-eclipse_sheet.jpg) |

## hero: forge

4 effects. Brannoc, the Ashen Smith. Hero kit, see [Forge](heroes/forge.md).

| Label | Description | Targeting | Length / tier | Links |
|---|---|---|---|---|
| rivet shot | Brannoc pulls a white-hot rivet out of his chest forge (sparks), flicks it, and it flies as a short hot streak and punches into the target. | enemy | 1.7 s · hero kit Q | [source](../../src/spells/targeted/rivetShot.ts), [kit sheet](../../pipeline/designs/kit-forge.md), [sheet](../spells/rivet-shot_sheet.jpg) |
| anvil drop | A ring of molten runes draws itself on the ground while a huge dark anvil with hot edges falls from the sky onto it. | ground (r 3.5) | 2.3 s · hero kit W | [source](../../src/spells/targeted/anvilDrop.ts), [kit sheet](../../pipeline/designs/kit-forge.md), [sheet](../spells/anvil-drop_sheet.jpg) |
| bellows ward | The forge in Brannoc's chest flares and a ring of heat haze rises around him. | self (r 5) | 3.3 s · hero kit E | [source](../../src/spells/targeted/bellowsWard.ts), [kit sheet](../../pipeline/designs/kit-forge.md), [sheet](../spells/bellows-ward_sheet.jpg) |
| forgefall | The world darkens, an anvil sigil draws on around the zone, slag streams pour up from the ground into the sky and pool into a colossal hammer that cools black from its edges ... | ground (r 7) | 4.5 s · hero kit R | [source](../../src/spells/targeted/forgefall.ts), [kit sheet](../../pipeline/designs/kit-forge.md), [sheet](../spells/forgefall_sheet.jpg) |

## hero: frost

4 effects. Isolde, the Winter Warden. Hero kit, see [Frost](heroes/frost.md).

| Label | Description | Targeting | Length / tier | Links |
|---|---|---|---|---|
| rime spear | She breathes on her open hand, a long ice javelin grows in it, she throws it and it pierces the enemy. | enemy | 1.7 s · hero kit Q | [source](../../src/spells/targeted/rimeSpear.ts), [kit sheet](../../pipeline/designs/kit-frost.md), [sheet](../spells/rime-spear_sheet.jpg) |
| frostfern field | She sweeps a hand low and her breath rolls toward the point; frost ferns race across the floor to the full radius, climbing the enemies inside (they sink a little, held). | ground (r 4.5) | 2.3 s · hero kit W | [source](../../src/spells/targeted/frostfernField.ts), [kit sheet](../../pipeline/designs/kit-frost.md), [sheet](../spells/frostfern-field_sheet.jpg) |
| glacial mantle | Frost ferns grow out from under her and up her coat; six long ice crystals grow at her shoulders and hips like armour plates, pointing outward and down. | self (r 4) | 3.3 s · hero kit E | [source](../../src/spells/targeted/glacialMantle.ts), [kit sheet](../../pipeline/designs/kit-frost.md), [sheet](../spells/glacial-mantle_sheet.jpg) |
| winter's crown | The world darkens cold and frost ferns spread over the whole zone (the warning). | ground (r 7) | 4.5 s · hero kit R | [source](../../src/spells/targeted/wintersCrown.ts), [kit sheet](../../pipeline/designs/kit-frost.md), [sheet](../spells/winters-crown_sheet.jpg) |

## hero: astral

4 effects. Lyra, the Star Archer. Hero kit, see [Astral](heroes/astral.md).

| Label | Description | Targeting | Length / tier | Links |
|---|---|---|---|---|
| starshot | Lyra draws a bow of light (a gold crescent and a string), a star arrow flies to the first enemy and on the hit splits and hops to the 2nd and 3rd nearest (0.08 s per hop). | enemies (up to 3) | 1.6 s · hero kit Q | [source](../../src/spells/targeted/starshot.ts), [kit sheet](../../pipeline/designs/kit-astral.md), [sheet](../spells/starshot_sheet.jpg) |
| constellation snare | Lyra fires an arrow into the sky; a parchment star chart draws itself around the target point over a dark night veil and a handful of stars streak down onto points around and ... | ground (r 4) | 2.1 s · hero kit W | [source](../../src/spells/targeted/constellationSnare.ts), [kit sheet](../../pipeline/designs/kit-astral.md) |
| orbit veil | A small star chart draws itself under Lyra and a night veil rises around her. | self (r 5) | 3.3 s · hero kit E | [source](../../src/spells/targeted/orbitVeil.ts), [kit sheet](../../pipeline/designs/kit-astral.md) |
| celestial hunt | The world darkens to night and Lyra shoots an arrow into the sky. | ground (r 7) | 4.5 s · hero kit R | [source](../../src/spells/targeted/celestialHunt.ts), [kit sheet](../../pipeline/designs/kit-astral.md) |

## hero: alchemy

4 effects. Vex, the Plague Alchemist. Hero kit, see [Alchemy](heroes/alchemy.md).

| Label | Description | Targeting | Length / tier | Links |
|---|---|---|---|---|
| volatile flask | She plucks a flask from her coat, lobs it in a high spinning arc with a thin fume trail and it shatters on the target: glass shards, an acid splash with bubbles, a magenta ... | enemy | 1.8 s · hero kit Q | [source](../../src/spells/targeted/volatileFlask.ts), [kit sheet](../../pipeline/designs/kit-alchemy.md) |
| caustic pool | She throws two flasks at once, one high and one low; both shatter at the point, then a glass-ink alchemical circle flashes on and a pool of acid spreads to fill it, bubbling ... | ground (r 4) | 2.6 s · hero kit W | [source](../../src/spells/targeted/causticPool.ts), [kit sheet](../../pipeline/designs/kit-alchemy.md) |
| mutagen | She drinks a flask (it tilts up at her head and shatters in her hand), her body takes a pulsing green rim, and four flasks orbit her while fumes curl up around her. | self (r 4) | 3.2 s · hero kit E | [source](../../src/spells/targeted/mutagen.ts), [kit sheet](../../pipeline/designs/kit-alchemy.md) |
| grand transmutation | She smashes a big flask at her feet, the world darkens and a giant glass-ink alchemical circle draws on at the point. | ground (r 7) | 4.5 s · hero kit R | [source](../../src/spells/targeted/grandTransmutation.ts), [kit sheet](../../pipeline/designs/kit-alchemy.md) |

## hero: storm

4 effects. Kaia, the Tempest Caller. Hero kit, see [Storm](heroes/storm.md).

| Label | Description | Targeting | Length / tier | Links |
|---|---|---|---|---|
| arc lance | She points the hooked staff and sparks crackle along it; a horizontal lightning tree jumps from the staff tip to the target and splits into the ground at its feet. | enemy | 1.5 s · hero kit Q | [source](../../src/spells/targeted/arcLance.ts), [kit sheet](../../pipeline/designs/kit-storm.md), [sheet](../spells/storm-review_sheet.jpg) |
| downpour | A dark storm cloud gathers high over the point while slanting rain falls inside the circle and ripples spread on the wet floor. | ground (r 4) | 2.3 s · hero kit W | [source](../../src/spells/targeted/downpour.ts), [kit sheet](../../pipeline/designs/kit-storm.md), [sheet](../spells/storm-review_sheet.jpg) |
| static field | A small storm cloud forms over her head and her rain cloak crackles. A ring of short lightning arcs hops around her at radius 1.5 while light rain falls around her. | self (r 5) | 3.2 s · hero kit E | [source](../../src/spells/targeted/staticField.ts), [kit sheet](../../pipeline/designs/kit-storm.md), [sheet](../spells/storm-review_sheet.jpg) |
| eye of the storm | The world darkens blue-black and wind-blown rain starts across the whole zone. A vast ring of dark storm cloud forms high over it and turns, with a clear eye in the middle. | ground (r 7) | 4.5 s · hero kit R | [source](../../src/spells/targeted/eyeOfTheStorm.ts), [kit sheet](../../pipeline/designs/kit-storm.md), [sheet](../spells/storm-review_sheet.jpg) |

## hero: sand

4 effects. Sefu, the Dune Sovereign. Hero kit, see [Sand](heroes/sand.md).

| Label | Description | Targeting | Length / tier | Links |
|---|---|---|---|---|
| sand lash | Sefu sweeps his crook and a thick ribbon of sand pours out of the floor at his side, arcs over and cracks across to the target like a whip. | enemy | 1.6 s · hero kit Q | [source](../../src/spells/targeted/sandLash.ts), [kit sheet](../../pipeline/designs/kit-sand.md), [sheet](../spells/sand-review_sheet.jpg) |
| quicksand | A ring of carved glyphs cuts itself into the floor, sand floods inside it and starts to swirl inward, sinking and pulling the enemies in it. | ground (r 4) | 2.3 s · hero kit W | [source](../../src/spells/targeted/quicksand.ts), [kit sheet](../../pipeline/designs/kit-sand.md), [sheet](../spells/sand-review_sheet.jpg) |
| dune ward | Three sand ribbons rise from the floor and wind around Sefu in a slow spiral above a small glyph ring. | self (r 5) | 3.2 s · hero kit E | [source](../../src/spells/targeted/duneWard.ts), [kit sheet](../../pipeline/designs/kit-sand.md), [sheet](../spells/sand-review_sheet.jpg) |
| tomb of kings | The world darkens warm, a big glyph ring carves into the floor, the ground turns to swirling sand and sand ribbons spiral up from the ring and stack a stepped sandstone pyramid layer by layer. | ground (r 7) | 4.5 s · hero kit R | [source](../../src/spells/targeted/tombOfKings.ts), [kit sheet](../../pipeline/designs/kit-sand.md), [sheet](../spells/sand-review_sheet.jpg) |

## hero: shadow

4 effects. Nyx, the Umbral Stalker. Hero kit, see [Shadow](heroes/shadow.md).

| Label | Description | Targeting | Length / tier | Links |
|---|---|---|---|---|
| umbral blink | A black figure cut-out peels off Nyx, blinks to the target in four stepped jumps (a trail of fading figures) and two crossed blade cut-outs slash through the target. | enemy | 1.5 s · hero kit Q | [source](../../src/spells/targeted/umbralBlink.ts), [kit sheet](../../pipeline/designs/kit-shadow.md), [sheet](../spells/shadow-review_sheet.jpg) |
| grasp of the deep | A shadow pool with a pale foil disc spreads at the point; flat black hands rise out of it around and under the enemies with their fingers spread. | ground (r 4) | 2.3 s · hero kit W | [source](../../src/spells/targeted/graspOfTheDeep.ts), [kit sheet](../../pipeline/designs/kit-shadow.md), [sheet](../spells/shadow-review_sheet.jpg) |
| night shroud | A shadow pool spreads under Nyx and three figure cut-outs (clones) rise around her and circle her slowly. | self (r 5) | 3.2 s · hero kit E | [source](../../src/spells/targeted/nightShroud.ts), [kit sheet](../../pipeline/designs/kit-shadow.md), [sheet](../spells/shadow-review_sheet.jpg) |
| eclipse execution | Nyx raises a dagger and the world goes dark. A shadow pool covers the whole zone, shadow hands rise across it and hold the enemies while a pale moon rises behind the zone and a black disc slides across it into an eclipse. | ground (r 7) | 4.5 s · hero kit R | [source](../../src/spells/targeted/eclipseExecution.ts), [kit sheet](../../pipeline/designs/kit-shadow.md), [sheet](../spells/shadow-review_sheet.jpg) |

## hero: grove

4 effects. Fenna, the Grove Warden. Hero kit, see [Grove](heroes/grove.md).

| Label | Description | Targeting | Length / tier | Links |
|---|---|---|---|---|
| bloom lash | Fenna sweeps her staff and a spiral vine bursts from the floor, coils across to the target and up around it, and a flower blooms on top. | enemy | 1.6 s · hero kit Q | [source](../../src/spells/targeted/bloomLash.ts), [kit sheet](../../pipeline/designs/kit-grove.md), [sheet](../spells/wave2-grove_sheet.jpg), [sheet](../spells/wave2-dawngrove-r2_sheet.jpg) |
| overgrowth | Roots spread across the ground and spiral vines grow up around the enemies inside, then burst into a ring of flowers. | ground (r 4) | 2.3 s · hero kit W | [source](../../src/spells/targeted/overgrowth.ts), [kit sheet](../../pipeline/designs/kit-grove.md), [sheet](../spells/wave2-grove_sheet.jpg), [sheet](../spells/wave2-dawngrove-r2_sheet.jpg) |
| verdant ward | Three flowering vines rise around Fenna, turn outward and twice fire petals and pollen at every enemy nearby. | self (r 5) | 3.2 s · hero kit E | [source](../../src/spells/targeted/verdantWard.ts), [kit sheet](../../pipeline/designs/kit-grove.md), [sheet](../spells/wave2-grove_sheet.jpg), [sheet](../spells/wave2-dawngrove-r2_sheet.jpg) |
| world blossom | The world darkens to a green dusk and a colossal flower grows from a braided trunk, folds shut over the zone and slams down in a burst of blooms. | ground (r 7) | 4.5 s · hero kit R | [source](../../src/spells/targeted/worldBlossom.ts), [kit sheet](../../pipeline/designs/kit-grove.md), [sheet](../spells/wave2-grove_sheet.jpg), [sheet](../spells/wave2-dawngrove-r2_sheet.jpg) |

## hero: dawn

4 effects. Auriel, the Dawn Paladin. Hero kit, see [Dawn](heroes/dawn.md).

| Label | Description | Targeting | Length / tier | Links |
|---|---|---|---|---|
| radiant spear | Shards of hard light click into a spear over Auriel's shoulder and pierce the target, bursting out of its back. | enemy | 1.5 s · hero kit Q | [source](../../src/spells/targeted/radiantSpear.ts), [kit sheet](../../pipeline/designs/kit-dawn.md), [sheet](../spells/wave2-dawn_sheet.jpg), [sheet](../spells/wave2-dawngrove-r2_sheet.jpg) |
| aegis wall | A ring of kite-shield panels rises around the point and closes into a dome that slams shut over the enemies. | ground (r 4) | 2.35 s · hero kit W | [source](../../src/spells/targeted/aegisWall.ts), [kit sheet](../../pipeline/designs/kit-dawn.md), [sheet](../spells/wave2-dawn_sheet.jpg), [sheet](../spells/wave2-dawngrove-r2_sheet.jpg) |
| halo of blades | A halo crowns Auriel and six blade shards circle her, lunging at every enemy nearby, twice. | self (r 5) | 3.2 s · hero kit E | [source](../../src/spells/targeted/haloOfBlades.ts), [kit sheet](../../pipeline/designs/kit-dawn.md), [sheet](../spells/wave2-dawn_sheet.jpg), [sheet](../spells/wave2-dawngrove-r2_sheet.jpg) |
| judgement of dawn | The world darkens to a pre-dawn blue and a colossal sword of hard-light panels is built in the sky and driven into the zone. | ground (r 7) | 4.5 s · hero kit R | [source](../../src/spells/targeted/judgementOfDawn.ts), [kit sheet](../../pipeline/designs/kit-dawn.md), [sheet](../spells/wave2-dawn_sheet.jpg), [sheet](../spells/wave2-dawngrove-r2_sheet.jpg) |

## hero: tide

4 effects. Marin, the Tide Dancer. Hero kit, see [Tide](heroes/tide.md).

| Label | Description | Targeting | Length / tier | Links |
|---|---|---|---|---|
| tide whip | Marin spins a water ribbon off her wrist; it lashes the target, wraps it once and bursts into a splash crown. | enemy | 1.5 s · hero kit Q | [source](../../src/spells/targeted/tideWhip.ts), [kit sheet](../../pipeline/designs/kit-tide.md), [sheet](../spells/wave2-tide_sheet.jpg), [sheet](../spells/wave2-tide-r2_sheet.jpg) |
| whirlpool | A pool spreads and three water ribbons spiral up, drawing the enemies in before a water column bursts. | ground (r 4) | 2.3 s · hero kit W | [source](../../src/spells/targeted/whirlpool.ts), [kit sheet](../../pipeline/designs/kit-tide.md), [sheet](../spells/wave2-tide_sheet.jpg), [sheet](../spells/wave2-tide-r2_sheet.jpg) |
| undertow dance | Water sashes circle Marin as she spins; twice they flare into a flat ring of water that splashes everything near. | self (r 5) | 3.2 s · hero kit E | [source](../../src/spells/targeted/undertowDance.ts), [kit sheet](../../pipeline/designs/kit-tide.md), [sheet](../spells/wave2-tide_sheet.jpg), [sheet](../spells/wave2-tide-r2_sheet.jpg) |
| leviathan's waltz | The world darkens to a deep sea blue and a water serpent made of ribbons coils over the zone, rears up and dives through it in a crown of foam. | ground (r 7) | 4.5 s · hero kit R | [source](../../src/spells/targeted/leviathansWaltz.ts), [kit sheet](../../pipeline/designs/kit-tide.md), [sheet](../spells/wave2-tide_sheet.jpg), [sheet](../spells/wave2-tide-r2_sheet.jpg) |

## hero: sky

4 effects. Zephyr, the Wind Blade. Hero kit, see [Sky](heroes/sky.md).

| Label | Description | Targeting | Length / tier | Links |
|---|---|---|---|---|
| gale edge | Two crossing wind crescents sweep the cone in front of Zephyr and shove everything in it back (melee swing). | enemy (cone r 3.2) | 1.2 s · hero kit Q | [source](../../src/spells/targeted/galeEdge.ts), [kit sheet](../../pipeline/designs/kit-sky.md), [sheet](../spells/wave3-sky_sheet.jpg), [sheet](../spells/wave3-sky-r2_sheet.jpg), [sheet](../spells/wave3-sky-r3_sheet.jpg) |
| tailwind rush | She rides a gust ribbon to the spot (dash) and a spiral wind lifts everyone there off their feet (knock-up). | ground (r 2.5) | 1.6 s · hero kit W | [source](../../src/spells/targeted/tailwindRush.ts), [kit sheet](../../pipeline/designs/kit-sky.md), [sheet](../spells/wave3-sky_sheet.jpg), [sheet](../spells/wave3-sky-r2_sheet.jpg), [sheet](../spells/wave3-sky-r3_sheet.jpg) |
| cyclone guard | A whirl of crescents wraps her in a 50 point shield; twice it flares out as a ring that cuts and shoves enemies near. | self (r 4) | 3.2 s · hero kit E | [source](../../src/spells/targeted/cycloneGuard.ts), [kit sheet](../../pipeline/designs/kit-sky.md), [sheet](../spells/wave3-sky_sheet.jpg), [sheet](../spells/wave3-sky-r2_sheet.jpg), [sheet](../spells/wave3-sky-r3_sheet.jpg) |
| thousand winds | The world darkens to a pale storm teal and a cyclone of about 150 crescents closes over the zone; she dashes into its eye and the winds burst out, knocking everything up. | ground (r 7) | 4.5 s · hero kit R | [source](../../src/spells/targeted/thousandWinds.ts), [kit sheet](../../pipeline/designs/kit-sky.md), [sheet](../spells/wave3-sky_sheet.jpg), [sheet](../spells/wave3-sky-r2_sheet.jpg), [sheet](../spells/wave3-sky-r3_sheet.jpg) |

## hero: bone

4 effects. Mortis, the Ossuary Lord. Hero kit, see [Bone](heroes/bone.md).

| Label | Description | Targeting | Length / tier | Links |
|---|---|---|---|---|
| bone spear | A spear of vertebrae assembles beside Mortis and is thrown down a line as a piercing skillshot; it clatters apart at max range. | ground (skillshot line, r 0.45) | 1.5 s · hero kit Q | [source](../../src/spells/targeted/boneSpear.ts), [kit sheet](../../pipeline/designs/kit-bone.md), [sheet](../spells/wave3-bone_sheet.jpg), [sheet](../spells/wave3-bone-r2_sheet.jpg), [sheet](../spells/wave3-bone-r3_sheet.jpg) |
| grave call | The ground cracks open with teal light and two skeletons claw out among bone spires and fight for him for 6 s (summon). | ground (r 3) | 2.0 s · hero kit W | [source](../../src/spells/targeted/graveCall.ts), [kit sheet](../../pipeline/designs/kit-bone.md), [sheet](../spells/wave3-bone_sheet.jpg), [sheet](../spells/wave3-bone-r2_sheet.jpg), [sheet](../spells/wave3-bone-r3_sheet.jpg) |
| ossuary ward | A cage of ribs grows round him with a 30 point shield; twice the ribs flex and fire a ring of bone shards at everything near. | self (r 4) | 3.2 s · hero kit E | [source](../../src/spells/targeted/ossuaryWard.ts), [kit sheet](../../pipeline/designs/kit-bone.md), [sheet](../spells/wave3-bone_sheet.jpg), [sheet](../spells/wave3-bone-r2_sheet.jpg), [sheet](../spells/wave3-bone-r3_sheet.jpg) |
| legion of the ossuary | The world darkens to teal-black and a colossal skeletal hand rises, closes and slams the zone in a ring of bone spires; two skeleton archers climb out of the cracks (summon). | ground (r 7) | 4.5 s · hero kit R | [source](../../src/spells/targeted/legionOfTheOssuary.ts), [kit sheet](../../pipeline/designs/kit-bone.md), [sheet](../spells/wave3-bone_sheet.jpg), [sheet](../spells/wave3-bone-r2_sheet.jpg), [sheet](../spells/wave3-bone-r3_sheet.jpg) |

## hero: clockwork

4 effects. Ada, the Artificer. Hero kit, see [Clockwork](heroes/clockwork.md).

| Label | Description | Targeting | Length / tier | Links |
|---|---|---|---|---|
| clockwork rivet shot | A spring-loaded launcher fires a spinning copper rivet down a line (skillshot); each hit slows the enemy and the rivet ricochets to the next. | ground (skillshot line, r 0.4) | 1.5 s · hero kit Q | [source](../../src/spells/targeted/clockworkRivetShot.ts), [kit sheet](../../pipeline/designs/kit-clockwork.md), [sheet](../spells/wave3-clockwork_sheet.jpg), [sheet](../spells/wave3-clockwork-r2_sheet.jpg), [sheet](../spells/wave3-clockwork-r3_sheet.jpg) |
| cog turret | Gears and a spring click together at the point into a brass turret (summon) that shoots whatever comes within 8 for 6 s. | ground (r 2) | 1.6 s · hero kit W | [source](../../src/spells/targeted/cogTurret.ts), [kit sheet](../../pipeline/designs/kit-clockwork.md), [sheet](../spells/wave3-clockwork_sheet.jpg), [sheet](../spells/wave3-clockwork-r2_sheet.jpg), [sheet](../spells/wave3-clockwork-r3_sheet.jpg) |
| gear field | Three nested gears unfold round her; twice they lurch and an electric ring races out, hitting and slowing every enemy inside. | self (r 5) | 3.2 s · hero kit E | [source](../../src/spells/targeted/gearField.ts), [kit sheet](../../pipeline/designs/kit-clockwork.md), [sheet](../spells/wave3-clockwork_sheet.jpg), [sheet](../spells/wave3-clockwork-r2_sheet.jpg), [sheet](../spells/wave3-clockwork-r3_sheet.jpg) |
| gearfall | The world darkens to a warm iron dark and a colossal gear is lowered on chains, hangs for a dead beat and drops on the zone, rooting everything in it. | ground (r 7) | 4.5 s · hero kit R | [source](../../src/spells/targeted/gearfall.ts), [kit sheet](../../pipeline/designs/kit-clockwork.md), [sheet](../spells/wave3-clockwork_sheet.jpg), [sheet](../spells/wave3-clockwork-r2_sheet.jpg), [sheet](../spells/wave3-clockwork-r3_sheet.jpg) |

## test: mechanics

13 effects. Tools for the combat mechanics engine, not hero spells: they live in `src/spells/targeted/`, are registered at the end of `targetedModules`, and are used by the hidden test kits (see [Combat mechanics](../architecture/mechanics.md#testing)). They have no design note, contact sheet or `forged.json` entry.

| Label | Description | Targeting | Links |
|---|---|---|---|
| status test | Ring flash, then 10 damage plus the chosen status kind and seconds to everyone inside the zone (`HitOptions.status`) | ground | [source](../../src/spells/targeted/statusTest.ts) |
| shield test | `shieldSelf(60, 4)` on the caster | self | [source](../../src/spells/targeted/shieldTest.ts) |
| heal test | `healSelf` on the caster | self | [source](../../src/spells/targeted/healTest.ts) |
| dash test | `moveCaster` rush to a spot in a quarter second, 20 damage where it lands | ground | [source](../../src/spells/targeted/dashTest.ts) |
| cleave test | Cone swing in front of the caster, 45 damage, range 3 (melee kit Q) | enemies | [source](../../src/spells/targeted/cleaveTest.ts) |
| bolt test | Plain skillshot, 45 damage (`ctx.projectile`) | ground | [source](../../src/spells/targeted/boltTests.ts) |
| summoner bolt test | The same plain bolt, for the summon test kit | ground | [source](../../src/spells/targeted/boltTests.ts) |
| split bolt test | Bolt that splits into 3 children over 25 degrees on its first hit | ground | [source](../../src/spells/targeted/boltTests.ts) |
| bounce bolt test | Bolt that bounces twice to the nearest other enemy | ground | [source](../../src/spells/targeted/boltTests.ts) |
| pierce bolt test | Fast piercing lance that hits every enemy on its line | ground | [source](../../src/spells/targeted/boltTests.ts) |
| summon melee test | 2 melee units, 40 HP, 6 s (`ctx.summon`) | ground | [source](../../src/spells/targeted/summonTests.ts) |
| summon ranged test | 2 ranged units that shoot dodgeable bolts, 35 HP, 6 s | ground | [source](../../src/spells/targeted/summonTests.ts) |
| turret test | 1 stationary turret, 80 HP, 6 s, range 8 | ground | [source](../../src/spells/targeted/summonTests.ts) |

## weapons

5 effects. Idle enchant loops for the five Blender weapons in `public/models/weapons` (`src/spells/weapons/`, kit in `src/effects/weapons`, technique in `docs/WEAPON_VFX_GUIDE.md`).

| Label | Description | Targeting | Length / tier | Links |
|---|---|---|---|---|
| phoenix fan | The idle enchant of the Jade-Leaf Phoenix Fan (wp-fan-fire), after the Spiderlily fans (recipes f-spiderlily-fan-tufts, f-spiderlily-gauntlet-ignition). | none (idle loop) | loop | [source](../../src/spells/weapons/phoenixFan.ts), [design](../../pipeline/designs/phoenix-fan.md) |
| frost lily sword | The idle enchant of the Ice Sword (wp-sword-ice), after the Spiderlily set (recipes f-spiderlily-gauntlet-ignition, a-lol-ashe-enchanted-crystal-arrow, c-ice-spikes-eruption). | none (idle loop) | loop | [source](../../src/spells/weapons/frostLilySword.ts), [design](../../pipeline/designs/frost-lily-sword.md) |
| azure dragon sword | The idle enchant of the Azure Dragon Sword (wp-sword-dragon), after the Genji dragonblade and the Spiderlily scythe ribbon (recipes a-ow-genji-dragonblade ... | none (idle loop) | loop | [source](../../src/spells/weapons/azureDragonSword.ts), [design](../../pipeline/designs/azure-dragon-sword.md) |
| thunder drum hammer | The idle enchant of the thunder war hammer (wp-hammer-thunder), after the recipes d-kler-3-lightning-chain-cage (arcs locked between fixed points, redrawn every few frames) ... | none (idle loop) | loop | [source](../../src/spells/weapons/thunderDrumHammer.ts), [design](../../pipeline/designs/thunder-drum-hammer.md) |
| green dragon crescent | The idle enchant of the Green Dragon Crescent Blade (wp-glaive-guandao), after the Spiderlily scythe (f-spiderlily-scythe-ribbon, f-spiderlily-bow-crest ... | none (idle loop) | loop | [source](../../src/spells/weapons/greenDragonCrescent.ts), [design](../../pipeline/designs/green-dragon-crescent.md) |

## weapon attacks

5 effects. The hero wields a weapon against the arena enemies (`src/spells/weapons/strikes/`, built with `strikeModule` in `src/effects/weapons/strike.ts`).

| Label | Description | Targeting | Length / tier | Links |
|---|---|---|---|---|
| azure dragon slash | The hero dashes in with the Azure Dragon-Spine Sword raised over the right shoulder, cuts diagonally down across the target (a cyan blade trail), and the cut throws a ... | enemy | settings-driven | [source](../../src/spells/weapons/strikes/dragonSlash.ts), [design](../../pipeline/designs/weapon-attacks.md) |
| frost lily thrust | The hero dashes in, coils the Frost-Crystal Sword back at the hip and drives it straight through the target. | enemy | settings-driven | [source](../../src/spells/weapons/strikes/frostThrust.ts), [design](../../pipeline/designs/weapon-attacks.md) |
| green dragon sweep | The hero steps in with the Green Dragon Crescent Blade drawn back low on the right, then whirls it round in one wide horizontal sweep. | enemies | settings-driven | [source](../../src/spells/weapons/strikes/crescentSweep.ts), [design](../../pipeline/designs/weapon-attacks.md) |
| thunder drum slam | The hero runs in, leaps with the Thunder-Drum Hammer swung up over the head, and brings it down on the target. | enemy | settings-driven | [source](../../src/spells/weapons/strikes/thunderSlam.ts), [design](../../pipeline/designs/weapon-attacks.md) |
| phoenix gale | The hero stays put, draws the Jade-Leaf Phoenix Fan across the body and sweeps it out wide. | enemies | settings-driven | [source](../../src/spells/weapons/strikes/phoenixGale.ts), [design](../../pipeline/designs/weapon-attacks.md) |

## See also

- [Heroes: roster and shared structure](heroes/README.md)
- [Blood](heroes/blood.md), [Forge](heroes/forge.md), [Frost](heroes/frost.md), [Astral](heroes/astral.md), [Alchemy](heroes/alchemy.md), [Storm](heroes/storm.md), [Sand](heroes/sand.md), [Shadow](heroes/shadow.md), [Grove](heroes/grove.md), [Dawn](heroes/dawn.md), [Tide](heroes/tide.md), [Sky](heroes/sky.md), [Bone](heroes/bone.md), [Clockwork](heroes/clockwork.md)
- [Docs home](../README.md)
- [Art bible](../ART_BIBLE.md)
- [VFX principles](../VFX_PRINCIPLES.md)
