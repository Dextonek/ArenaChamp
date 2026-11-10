---
title: Effect catalog
tags: [catalog, effects, vfx]
updated: 2026-11-04
---

# Effect catalog

Every effect registered in the Three.js VFX editor: **283 effects in 47 categories**, plus 13 test spells in a 48th (`test: mechanics`, 296 registered slots), listed in the order of the category dropdown (the order in which `src/effects/index.ts` registers them; a category appears at its first effect). Each table gives the registered label, a one-line description taken from the effect's JSDoc header, how it targets, its length or tier, and links to the source, the design note in `pipeline/designs/` and the contact sheet in `docs/spells/` where they exist.

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
| [hero: prism](#hero-prism) | 4 |
| [hero: bard](#hero-bard) | 4 |
| [hero: hive](#hero-hive) | 4 |
| [hero: void](#hero-void) | 4 |
| [hero: chrono](#hero-chrono) | 4 |
| [hero: ink](#hero-ink) | 4 |
| [hero: mirror](#hero-mirror) | 4 |
| [hero: mason](#hero-mason) | 4 |
| [hero: timber](#hero-timber) | 4 |
| [hero: balloon](#hero-balloon) | 4 |
| [hero: cat](#hero-cat) | 4 |
| [hero: ledger](#hero-ledger) | 4 |
| [hero: sumo](#hero-sumo) | 4 |
| [hero: mime](#hero-mime) | 4 |
| [hero: referee](#hero-referee) | 4 |
| [hero: chef](#hero-chef) | 4 |
| [hero: courier](#hero-courier) | 4 |
| [hero: janitor](#hero-janitor) | 4 |
| [hero: mole](#hero-mole) | 4 |
| [hero: yarn](#hero-yarn) | 4 |
| [hero: weather](#hero-weather) | 4 |
| [hero: sheep](#hero-sheep) | 4 |
| [hero: magic](#hero-magic) | 4 |
| [hero: door](#hero-door) | 4 |
| [hero: twins](#hero-twins) | 7 |
| [weapons](#weapons) | 5 |
| [weapon attacks](#weapon-attacks) | 5 |
| [test: mechanics](#test-mechanics) | 13 (test spells, not counted below) |
| **Total** | **283** (+ 13 test spells = 296 slots) |

## How to read the tables

- **Targeting** is the `targeting` spec of the module: `enemy` (one target), `enemies` (shift-clicked or a nearest-neighbour chain, capped), `ground` (a spot, radius decides who is hit), `self` (centred on the caster). `fixed scene` effects have no targeting and play on the fixed demo scene.
- **Length** is the constant `DURATION` (or `TOTAL`, or a stated "~N s") in the source. `settings-driven` means the length is the `duration` getter, computed from other constants or from the effect's settings (cast time, flight time and so on), so there is no single literal number. `loop` is an idle aura.
- **Tier** comes from `pipeline/forged.json`: `hero tier` and `hero-cinematic` are the higher-bar batches, `hero kit Q/W/E/R` is a slot in one of the 39 hero kits. **cinematic** marks the 14 effects that use `createCinematic` (a scripted camera and letterbox, `src/effects/parts/cinematic.ts`): genesis collapse, colossus drop, hyperion railgun, leviathan breach, ghost galleon broadside, caldera awakening, ophanim descent, thousand-cut iaido, lunar tide, abyssal angler, supercell, world tree rising, hourglass of ages, midnight circus. Of these, the ten tagged `hero-cinematic` plus hyperion railgun and leviathan breach (hero tier) are the fully cinematic heroes; genesis collapse and colossus drop are earlier cinematic ultimates.
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

68 effects. Targeted spells (`src/spells/targeted/`): they aim at the enemies or ground spot picked in the shared arena (see `src/effects/targeting.ts`). Most were written by the forge-vfx pipeline; `pipeline/forged.json` records mode, tier and recipes. Registered in `src/spells/targeted/index.ts` (the hero kits are registered in the same array but use their own categories, below).

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
| lancet | A blood needle flies to the enemy and stays in for 3 s; cast again to rip it out for more damage and HP back. | enemy | 1.4 s · hero kit Q | [source](../../src/spells/targeted/lancet.ts), [kit sheet](../../pipeline/designs/kit-blood.md) |
| mist waltz | She comes apart into blood-red mist and flows 5 m, then arms her next two basic attacks. | ground (r 1) | 1.3 s · hero kit W | [source](../../src/spells/targeted/mistWaltz.ts), [kit sheet](../../pipeline/designs/kit-blood.md) |
| hemocurse | A thread of blood and a crown of thorns put a 3 s curse on the enemy: each spell they cast costs them HP. | enemy | 4.0 s · hero kit E | [source](../../src/spells/targeted/hemocurse.ts), [kit sheet](../../pipeline/designs/kit-blood.md) |
| sanguine feast | She is rooted for 1.6 s and drinks from the enemy through a thread of blood, in three pulses. | enemy | 2.4 s · hero kit R | [source](../../src/spells/targeted/sanguineFeast.ts), [kit sheet](../../pipeline/designs/kit-blood.md) |

## hero: forge

4 effects. Brannoc, the Ashen Smith. Hero kit, see [Forge](heroes/forge.md).

| Label | Description | Targeting | Length / tier | Links |
|---|---|---|---|---|
| chain hammer | A hammer on a chain is whirled and thrown down the aim; the first enemy it touches is dragged to the smith and slowed. | ground (line) | 1.7 s · hero kit Q | [source](../../src/spells/targeted/chainHammer.ts), [kit sheet](../../pipeline/designs/kit-forge.md) |
| forge roar | Heat rolls off him in a ring, a loop of chain turns at his waist and his next basic attack is armed as a slam. | self (r 4) | 3.6 s · hero kit W | [source](../../src/spells/targeted/forgeRoar.ts), [kit sheet](../../pipeline/designs/kit-forge.md) |
| red-hot rivet | He flicks a white-hot rivet at an enemy in sight; it punches in and burns in two ticks. | enemy | 3.2 s · hero kit E | [source](../../src/spells/targeted/redHotRivet.ts), [kit sheet](../../pipeline/designs/kit-forge.md) |
| molten core | His chest cracks open for 6 s and his swings spray slag cones; a recast Quenches it in a ring burst. | self (r 6) | 6.4 s (Quench 2.4 s) · hero kit R | [source](../../src/spells/targeted/moltenCore.ts), [kit sheet](../../pipeline/designs/kit-forge.md) |

## hero: frost

4 effects. Isolde, the Winter Warden. Hero kit, see [Frost](heroes/frost.md).

| Label | Description | Targeting | Length / tier | Links |
|---|---|---|---|---|
| icicle | She throws a piercing icicle that sticks in the floor for 2 s; cast again to shatter it. | ground (r 8) | 1.5 s · hero kit Q | [source](../../src/spells/targeted/icicle.ts), [kit sheet](../../pipeline/designs/kit-frost.md) |
| hoarfrost | A cone of mist and a pale streak run to an enemy in sight and frost bites them. | enemy | 1.4 s · hero kit W | [source](../../src/spells/targeted/hoarfrost.ts), [kit sheet](../../pipeline/designs/kit-frost.md) |
| rime armour | Rime climbs her robe and six crystals turn round her shoulders for 3 s. | self (r 8) | 3.7 s · hero kit E | [source](../../src/spells/targeted/rimeArmour.ts), [kit sheet](../../pipeline/designs/kit-frost.md) |
| winter's shatter | Her fist of ice closes on an enemy in sight and shatters the Chill on them. | enemy | 1.7 s · hero kit R | [source](../../src/spells/targeted/wintersShatter.ts), [kit sheet](../../pipeline/designs/kit-frost.md) |

## hero: astral

4 effects. Lyra, the Star Archer. Hero kit, see [Astral](heroes/astral.md).

| Label | Description | Targeting | Length / tier | Links |
|---|---|---|---|---|
| starfall arrow | A held arrow: the longer the draw, the farther and harder it flies; stars drop along its line and join into a constellation. | ground (line) | 3.2 s · hero kit Q | [source](../../src/spells/targeted/starfallArrow.ts), [kit sheet](../../pipeline/designs/kit-astral.md) |
| twin stars | Two stars orbit her chest on a gold line: her basic attacks echo for 5 s and she moves faster. | self (r 9) | 5.2 s · hero kit W | [source](../../src/spells/targeted/twinStars.ts), [kit sheet](../../pipeline/designs/kit-astral.md) |
| pinning arrow | A thin arrow pins the enemy to a nearby wall, or slows them anywhere else. | ground (line) | 3.2 s · hero kit E | [source](../../src/spells/targeted/pinningArrow.ts), [kit sheet](../../pipeline/designs/kit-astral.md) |
| meteor mark | A star locks onto the enemy, follows them for 1.5 s, fixes on their spot and falls as a meteor. | enemy | 4.1 s · hero kit R | [source](../../src/spells/targeted/meteorMark.ts), [kit sheet](../../pipeline/designs/kit-astral.md) |

## hero: alchemy

4 effects. Vitriol, the Plague Alchemist. Hero kit, see [Alchemy](heroes/alchemy.md).

| Label | Description | Targeting | Length / tier | Links |
|---|---|---|---|---|
| toxin dart | A fast glass dart of green toxin flies down the aim and the toxin clings to the body that it hits. | ground (r 0.4) | 4.3 s · hero kit Q | [source](../../src/spells/targeted/toxinDart.ts), [kit sheet](../../pipeline/designs/kit-alchemy.md) |
| fire vial | A vial of orange fire arcs after the enemy and bursts on them; flames then stand on the body. | enemy | 3.6 s · hero kit W | [source](../../src/spells/targeted/fireVial.ts), [kit sheet](../../pipeline/designs/kit-alchemy.md) |
| acid splash | She smashes a flask of violet acid in a 4 m cone in front of her and shoves back whoever is in it. | self (r 4.5) | 2.1 s · hero kit E | [source](../../src/spells/targeted/acidSplash.ts), [kit sheet](../../pipeline/designs/kit-alchemy.md) |
| homunculus | A glass-bellied walking bomb with all three reagents hops out of a circle and bursts on the enemy. | enemies (max 10) | 5.5 s · hero kit R | [source](../../src/spells/targeted/homunculus.ts), [kit sheet](../../pipeline/designs/kit-alchemy.md) |

## hero: storm

4 effects. Kaia, the Tempest Caller. Hero kit, see [Storm](heroes/storm.md).

| Label | Description | Targeting | Length / tier | Links |
|---|---|---|---|---|
| sky strike | A lightning tree falls on an enemy in sight and plants a rod in front of them. | enemy | 1.4 s · hero kit Q | [source](../../src/spells/targeted/skyStrike.ts), [kit sheet](../../pipeline/designs/kit-storm.md) |
| thunder rod | A great rod stands on the ground and shocks and slows everyone in its ring; cast again to discharge it. | ground (r 3.5) | 3.4 s · hero kit W | [source](../../src/spells/targeted/thunderRod.ts), [kit sheet](../../pipeline/designs/kit-storm.md) |
| polarity | A bolt magnetises an enemy in sight and then yanks them toward her nearest rod. | enemy | 1.8 s · hero kit E | [source](../../src/spells/targeted/polarity.ts), [kit sheet](../../pipeline/designs/kit-storm.md) |
| supercell storm | A storm cloud follows her for 6 s and drops marked bolts on the enemy near her or her rods. | self (r 14) | 6.6 s · hero kit R | [source](../../src/spells/targeted/supercellStorm.ts), [kit sheet](../../pipeline/designs/kit-storm.md) |

## hero: sand

4 effects. Sefu, the Dune Sovereign. Hero kit, see [Sand](heroes/sand.md).

| Label | Description | Targeting | Length / tier | Links |
|---|---|---|---|---|
| cobra spit | A cobra of sand rears up and spits venom down the aim; the first enemy hit is blinded. | ground | 1.4 s · hero kit Q | [source](../../src/spells/targeted/cobraSpit.ts), [kit sheet](../../pipeline/designs/kit-sand.md) |
| shepherd's crook | A sandstone crook hooks round an enemy in sight and drags them toward him. | enemy | 1.4 s · hero kit W | [source](../../src/spells/targeted/shepherdsCrook.ts), [kit sheet](../../pipeline/designs/kit-sand.md) |
| scarab stride | He skitters 6 m as a stream of scarabs, and biting an enemy on the way poisons them. | ground (r 1) | 3.0 s · hero kit E | [source](../../src/spells/targeted/scarabStride.ts), [kit sheet](../../pipeline/designs/kit-sand.md) |
| sarcophagus | A gold sarcophagus rises at the enemy's spot and shuts on them, then opens in scarabs. | enemy | 3.1 s · hero kit R | [source](../../src/spells/targeted/sarcophagus.ts), [kit sheet](../../pipeline/designs/kit-sand.md) |

## hero: shadow

4 effects. Nyx, the Umbral Stalker. Hero kit, see [Shadow](heroes/shadow.md).

| Label | Description | Targeting | Length / tier | Links |
|---|---|---|---|---|
| umbral cut | A dagger strike lands on an enemy within 2.5 m after a short wind-up, harder from behind. | enemy | 1.0 s · hero kit Q | [source](../../src/spells/targeted/umbralCut.ts), [kit sheet](../../pipeline/designs/kit-shadow.md) |
| smoke veil | A 3 m cloud of dark smoke stays at her feet for 3 s and blinds whoever stands in it. | self (r 3) | 3.5 s · hero kit W | [source](../../src/spells/targeted/smokeVeil.ts), [kit sheet](../../pipeline/designs/kit-shadow.md) |
| shadow double | She darts 4 m through cover and a shadow copy stays behind and walks at the enemy. | ground (r 1) | 1.0 s · hero kit E | [source](../../src/spells/targeted/shadowDouble.ts), [kit sheet](../../pipeline/designs/kit-shadow.md) |
| nightfall | The arena darkens for 5 s under a pale moon crescent while she is faster and hits harder. | self (r 9) | 5.5 s · hero kit R | [source](../../src/spells/targeted/nightfall.ts), [kit sheet](../../pipeline/designs/kit-shadow.md) |

## hero: grove

4 effects. Fenna, the Grove Warden. Hero kit, see [Grove](heroes/grove.md).

| Label | Description | Targeting | Length / tier | Links |
|---|---|---|---|---|
| seed shot | A seed swells in her hand and flies down the aim; a flower grows where it stops. | ground | 1.4 s · hero kit Q | [source](../../src/spells/targeted/seedShot.ts), [kit sheet](../../pipeline/designs/kit-grove.md) |
| strangle vine | Vines run along the ground and coil up an enemy in sight, rooting them. | enemy | 2.6 s · hero kit W | [source](../../src/spells/targeted/strangleVine.ts), [kit sheet](../../pipeline/designs/kit-grove.md) |
| pollen glide | She glides up to 6 m on a gust of gold pollen and a flower grows where she lands. | ground (r 1) | 1.3 s · hero kit E | [source](../../src/spells/targeted/pollenGlide.ts), [kit sheet](../../pipeline/designs/kit-grove.md) |
| world tree | A giant flower opens, then a tree bursts up, roots an enemy near it and stands 8 s; a recast uproots it in thorns. | ground (r 3) | 10.2 s · hero kit R | [source](../../src/spells/targeted/worldTree.ts), [kit sheet](../../pipeline/designs/kit-grove.md) |

## hero: dawn

4 effects. Auriel, the Dawn Paladin. Hero kit, see [Dawn](heroes/dawn.md).

| Label | Description | Targeting | Length / tier | Links |
|---|---|---|---|---|
| first light | A sun disc swells and five blade shards fly out in a 6 m cone; a hit shields her and the shield bursts when it ends. | self (cone 6 m) | 4.35 s · hero kit Q | [source](../../src/spells/targeted/firstLight.ts), [kit sheet](../../pipeline/designs/kit-dawn.md) |
| dawnward | Six kite shields click into a ring round her; when the shield ends the ring shatters in a 3 m burst. | self | 3.95 s · hero kit W | [source](../../src/spells/targeted/dawnward.ts), [kit sheet](../../pipeline/designs/kit-dawn.md) |
| oathbrand | A thread of light and a closing ring mark the enemy, then a beam falls on it and brands it. | enemy | 3.1 s · hero kit E | [source](../../src/spells/targeted/oathbrand.ts), [kit sheet](../../pipeline/designs/kit-dawn.md) |
| sunrise | A sun disc, a halo and eight kite shields lift her; when the shield ends a fixed 5 m ring closes and bursts. | self (r 5 ring) | 7.55 s · hero kit R | [source](../../src/spells/targeted/sunrise.ts), [kit sheet](../../pipeline/designs/kit-dawn.md) |

## hero: tide

4 effects. Marin, the Tide Dancer. Hero kit, see [Tide](heroes/tide.md).

| Label | Description | Targeting | Length / tier | Links |
|---|---|---|---|---|
| wave disc | A spinning disc of water flies down the aim; it pushes at High tide and pulls at Low tide. | ground (line, bolt) | 2.0 s · hero kit Q | [source](../../src/spells/targeted/waveDisc.ts), [kit sheet](../../pipeline/designs/kit-tide.md) |
| coral spire | A coral pillar bursts up at a spot and stands 5 s as an obstacle, pushing or pulling the enemy near it. | ground (r 2.5) | 6.7 s · hero kit W | [source](../../src/spells/targeted/coralSpire.ts), [kit sheet](../../pipeline/designs/kit-tide.md) |
| mist form | She turns to water, flows up to 6 m, untouchable, and reforms in a splash that flips the tide. | ground (dash, r 3) | 1.15 s · hero kit E | [source](../../src/spells/targeted/mistForm.ts), [kit sheet](../../pipeline/designs/kit-tide.md) |
| moon's pull | A pale moon rises over her for 3 s and drags the enemy toward her; a tide crash lands if it is close when the moon sets. | self (r 25) | 3.9 s · hero kit R | [source](../../src/spells/targeted/moonPull.ts), [kit sheet](../../pipeline/designs/kit-tide.md) |

## hero: sky

4 effects. Zephyr, the Wind Blade. Hero kit, see [Sky](heroes/sky.md).

| Label | Description | Targeting | Length / tier | Links |
|---|---|---|---|---|
| crosswind | A 3 m cross-cut of wind in front of him; cast again within 2 s for a dash-slash. | enemies (cone 3 m) | 1.2 s · hero kit Q | [source](../../src/spells/targeted/crosswind.ts), [kit sheet](../../pipeline/designs/kit-sky.md) |
| skyward | He leaps, untouchable, and comes down on a spot, knocking enemies up. | ground (r 1.4) | 2.0 s · hero kit W | [source](../../src/spells/targeted/skyward.ts), [kit sheet](../../pipeline/designs/kit-sky.md) |
| feather step | A quick 4 m step with jade afterimages; two charges. | ground (dash) | 1.0 s · hero kit E | [source](../../src/spells/targeted/featherStep.ts), [kit sheet](../../pipeline/designs/kit-sky.md) |
| sky rend | He marks an enemy, vanishes, and strikers cut it from every side. | enemy | 2.2 to 3.1 s · hero kit R | [source](../../src/spells/targeted/skyRend.ts), [kit sheet](../../pipeline/designs/kit-sky.md) |

## hero: bone

4 effects. Mortis, the Ossuary Lord. Hero kit, see [Bone](heroes/bone.md).

| Label | Description | Targeting | Length / tier | Links |
|---|---|---|---|---|
| bone fan | Three thin bone shards fly in a fan; every bone pile near him adds a shard. | ground (line, bolt) | 1.3 s · hero kit Q | [source](../../src/spells/targeted/boneFan.ts), [kit sheet](../../pipeline/designs/kit-bone.md) |
| raise dead | Bone spires rise and a skeleton claws out of the ground, one more per bone pile near the spot. | ground (r 2.4) | 2.0 s · hero kit W | [source](../../src/spells/targeted/raiseDead.ts), [kit sheet](../../pipeline/designs/kit-bone.md) |
| bone armour | A cage of ribs closes round him; when it breaks its bone darts fly at the enemy. | self | 4.6 s · hero kit E | [source](../../src/spells/targeted/boneArmour.ts), [kit sheet](../../pipeline/designs/kit-bone.md) |
| grave grasp | A hand rises where the enemy stood and drags it to him, rooted, with two skeletons beside it. | enemy | 3.3 s · hero kit R | [source](../../src/spells/targeted/graveGrasp.ts), [kit sheet](../../pipeline/designs/kit-bone.md) |

## hero: clockwork

4 effects. Ada, the Artificer. Hero kit, see [Clockwork](heroes/clockwork.md).

| Label | Description | Targeting | Length / tier | Links |
|---|---|---|---|---|
| homing drone | A brass drone flies out of her backpack and always hits the enemy, tagging it. | enemy | 3.75 s · hero kit Q | [source](../../src/spells/targeted/homingDrone.ts), [kit sheet](../../pipeline/designs/kit-clockwork.md) |
| deploy turret | A turret is built at a spot; two charges. | ground (r 1.5) | 1.6 s · hero kit W | [source](../../src/spells/targeted/deployTurret.ts), [kit sheet](../../pipeline/designs/kit-clockwork.md) |
| grapple hook | A hook that slows an enemy, or reels her to a wall, pillar or her own turret. | ground (line, bolt) | up to 2.2 s · hero kit E | [source](../../src/spells/targeted/grappleHook.ts), [kit sheet](../../pipeline/designs/kit-clockwork.md) |
| siege mode | Four steel plates slam down and she braces, rooted, firing heavy rounds while her turrets speed up. | self (r 25) | 6.7 s · hero kit R | [source](../../src/spells/targeted/siegeMode.ts), [kit sheet](../../pipeline/designs/kit-clockwork.md) |

## hero: prism

4 effects. Opaline, the Lightbreaker. Hero kit, see [Prism](heroes/prism.md).

| Label | Description | Targeting | Length / tier | Links |
|---|---|---|---|---|
| ricochet light | A bolt of light that banks off up to two walls, pillars or crystals, hitting harder with each bounce. | ground (line, bolt) | up to 3.5 s · hero kit Q | [source](../../src/spells/targeted/ricochetLight.ts), [kit sheet](../../pipeline/designs/kit-prism.md) |
| crystal pillar | A crystal rises at a spot and stands 6 s, blocking walking, sight and bolts; her bolts bounce off it. | ground (r 0.95) | 7.5 s · hero kit W | [source](../../src/spells/targeted/crystalPillar.ts), [kit sheet](../../pipeline/designs/kit-prism.md) |
| blinding flare | Six panes of light flash round her, blinding and pushing enemies within 3 m. | self (r 3) | 1.5 s · hero kit E | [source](../../src/spells/targeted/blindingFlare.ts), [kit sheet](../../pipeline/designs/kit-prism.md) |
| shatterlight | Six shards ring the enemy and fire inward through it, each bouncing once off a wall. | enemy | up to 3.2 s · hero kit R | [source](../../src/spells/targeted/shatterlight.ts), [kit sheet](../../pipeline/designs/kit-prism.md) |

## hero: bard

4 effects. Cantor, the Last Verse. Hero kit, see [Bard](heroes/bard.md).

| Label | Description | Targeting | Length / tier | Links |
|---|---|---|---|---|
| resounding chord | A chord from the lyre fans out in a 5 m cone; silences when cast on the beat. | self (cone 5 m) | 1.3 s · hero kit Q | [source](../../src/spells/targeted/resoundingChord.ts), [kit sheet](../../pipeline/designs/kit-bard.md) |
| siren song | A note flies at the enemy and charms it into walking toward him. | enemy | 3.8 s · hero kit W | [source](../../src/spells/targeted/sirenSong.ts), [kit sheet](../../pipeline/designs/kit-bard.md) |
| rising chorus | Notes orbit him; in-tune casts give speed and a shield. | self (r 7) | 3.5 s · hero kit E | [source](../../src/spells/targeted/risingChorus.ts), [kit sheet](../../pipeline/designs/kit-bard.md) |
| duet | A ring of music staves closes round both heroes and pulses on every beat. | self (r 9, ring r 6) | 4.2 s · hero kit R | [source](../../src/spells/targeted/duet.ts), [kit sheet](../../pipeline/designs/kit-bard.md) |

## hero: hive

4 effects. Sirix, the Swarm Warden. Hero kit, see [Hive](heroes/hive.md).

| Label | Description | Targeting | Length / tier | Links |
|---|---|---|---|---|
| barbed stinger | A stinger flies down the aim and leaves a barb; cast again to leap onto the barbed enemy. | ground (line, bolt) | 1.4 s (leap 1.0 to 3.7 s) · hero kit Q | [source](../../src/spells/targeted/barbedStinger.ts), [kit sheet](../../pipeline/designs/kit-hive.md) |
| hive shell | Chitin plates close round him; each hit he takes sends a wasp to sting the attacker. | self (r 1.5) | 3.5 s · hero kit W | [source](../../src/spells/targeted/hiveShell.ts), [kit sheet](../../pipeline/designs/kit-hive.md) |
| swarm cloud | All his wasps fly to a spot and hang there as a stinging, blinding cloud. | ground (r 2.5) | 3.65 s · hero kit E | [source](../../src/spells/targeted/swarmCloud.ts), [kit sheet](../../pipeline/designs/kit-hive.md) |
| swarm surge | He looses every wasp down a 10 m column that shoves and blinds. | ground (line, column) | 2.0 s · hero kit R | [source](../../src/spells/targeted/swarmSurge.ts), [kit sheet](../../pipeline/designs/kit-hive.md) |

## hero: void

4 effects. Oblivion, the Unmaker. Hero kit, see [Void](heroes/void.md).

| Label | Description | Targeting | Length / tier | Links |
|---|---|---|---|---|
| gravity slam | He slams the ground and drags enemies within 3 m toward him. | self (r 3) | 1.6 s · hero kit Q | [source](../../src/spells/targeted/gravitySlam.ts), [kit sheet](../../pipeline/designs/kit-void.md) |
| null zone | A 3 m sphere of void stays where he cast it for 3 s, silencing enemies inside and stopping bolts. | self (zone r 3) | 3.5 s · hero kit W | [source](../../src/spells/targeted/nullZone.ts), [kit sheet](../../pipeline/designs/kit-void.md) |
| phase step | He marks a spot, steps through the void to it, and his next attack rips and weakens. | ground (dash) | 3.6 s · hero kit E | [source](../../src/spells/targeted/phaseStep.ts), [kit sheet](../../pipeline/designs/kit-void.md) |
| void black hole | A black hole crawls down his aim, pulling enemies in and stunning at its core; recast to collapse it. | ground (line, pull r 5) | 4.7 s · hero kit R | [source](../../src/spells/targeted/blackHole.ts), [kit sheet](../../pipeline/designs/kit-void.md) |

## hero: chrono

4 effects. Tempo, the Unwound Hour. Hero kit, see [Chrono](heroes/chrono.md).

| Label | Description | Targeting | Length / tier | Links |
|---|---|---|---|---|
| tick bolt | A spinning clock hand flies down the aim; the same line repeats 1.5 s later as an echo. | ground (line, bolt) | 2.45 s · hero kit Q | [source](../../src/spells/targeted/tickBolt.ts), [kit sheet](../../pipeline/designs/kit-chrono.md) |
| slow time | Time thickens in a 3.5 m circle; enemies in it are hit and slowed, and the circle echoes. | ground (r 3.5) | 3.35 s · hero kit W | [source](../../src/spells/targeted/slowTime.ts), [kit sheet](../../pipeline/designs/kit-chrono.md) |
| time skip | He vanishes for 0.6 s and returns on a marker with a pulse, then echoes. | ground (dash, r 1.4) | 2.5 s · hero kit E | [source](../../src/spells/targeted/timeSkip.ts), [kit sheet](../../pipeline/designs/kit-chrono.md) |
| stolen hour | A clock face forms over the enemy and strikes, and makes his echoes stronger for 4 s. | enemy | 2.7 s · hero kit R | [source](../../src/spells/targeted/stolenHour.ts), [kit sheet](../../pipeline/designs/kit-chrono.md) |

## hero: ink

4 effects. Shiori, the Last Brush. Hero kit, see [Ink](heroes/ink.md).

| Label | Description | Targeting | Length / tier | Links |
|---|---|---|---|---|
| ink lash | A lash of ink flies down the aim and leaves a wet stroke along its path. | ground (line, bolt) | 1.5 s · hero kit Q | [source](../../src/spells/targeted/inkLash.ts), [kit sheet](../../pipeline/designs/kit-ink.md) |
| seal of binding | A paper seal stamps down, arms after 0.5 s and roots whoever steps in. | ground (r 1) | 1.4 s · hero kit W | [source](../../src/spells/targeted/sealOfBinding.ts), [kit sheet](../../pipeline/designs/kit-ink.md) |
| flowing script | She glides 6 m along a line and paints a stroke behind her. | ground (dash) | 1.0 s · hero kit E | [source](../../src/spells/targeted/flowingScript.ts), [kit sheet](../../pipeline/designs/kit-ink.md) |
| the last character | She writes one great character that roots the enemy; her strokes under it erupt. | ground (r 2) | 2.4 s · hero kit R | [source](../../src/spells/targeted/theLastCharacter.ts), [kit sheet](../../pipeline/designs/kit-ink.md) |

## hero: mirror

4 effects. Silvane, the Mirror Duchess. Hero kit, see [Mirror](heroes/mirror.md).

| Label | Description | Targeting | Length / tier | Links |
|---|---|---|---|---|
| hand mirror | A spinning hand mirror bounces off walls for more damage each time and lies on the floor to be caught. | ground (r 0.3) | 3.2 s · hero kit Q | [source](../../src/spells/targeted/handMirror.ts), [kit sheet](../../pipeline/designs/kit-mirror.md) |
| vanity stand | A tall standing mirror steps up at a spot and stands 6 s as a wall that blocks and reflects bolts. | ground (r 0.9) | 7.5 s · hero kit W | [source](../../src/spells/targeted/vanityStand.ts), [kit sheet](../../pipeline/designs/kit-mirror.md) |
| through the glass | She steps into her standing mirror and out of the far side. | ground (r 1) | 1.0 s · hero kit E | [source](../../src/spells/targeted/throughTheGlass.ts), [kit sheet](../../pipeline/designs/kit-mirror.md) |
| hall of mirrors | She spins and throws eight mirrors outward in a ring; some come to rest to be caught. | self (r 3) | 2.5 s · hero kit R | [source](../../src/spells/targeted/hallOfMirrors.ts), [kit sheet](../../pipeline/designs/kit-mirror.md) |

## hero: mason

4 effects. Bram, the Stonewright. Hero kit, see [Mason](heroes/mason.md).

| Label | Description | Targeting | Length / tier | Links |
|---|---|---|---|---|
| raise gerald | A circle marks a spot and Gerald, a limestone pillar with a face, bursts up out of the floor there. | ground (r 1.5) | 2.0 s · hero kit Q | [source](../../src/spells/targeted/raiseGerald.ts), [kit sheet](../../pipeline/designs/kit-mason.md) |
| the shove | Bram puts his shoulder to Gerald and slides him along the aim as a battering ram. | ground (r 1) | 2.3 s · hero kit W | [source](../../src/spells/targeted/theShove.ts), [kit sheet](../../pipeline/designs/kit-mason.md) |
| a good lean | Bram runs at Gerald and leans in for a hug, which gives him a shield. | self (r 1) | 1.4 s · hero kit E | [source](../../src/spells/targeted/aGoodLean.ts), [kit sheet](../../pipeline/designs/kit-mason.md) |
| gerald no | Gerald topples along the aim, a long shadow grows ahead of him and he crashes into rubble. | ground (r 1) | 2.5 s · hero kit R | [source](../../src/spells/targeted/geraldNo.ts), [kit sheet](../../pipeline/designs/kit-mason.md) |

## hero: timber

4 effects. Hank, the Moss Hewer. Hero kit, see [Timber](heroes/timber.md).

| Label | Description | Targeting | Length / tier | Links |
|---|---|---|---|---|
| axe swing | A quick swing of the double axe; any of his trees it touches is chopped and falls along a strip. | self (r 3) | 2.1 s · hero kit Q | [source](../../src/spells/targeted/axeSwing.ts), [kit sheet](../../pipeline/designs/kit-timber.md) |
| fast growth | He slams the axe into the ground and a tree sprouts at a spot, hitting whoever stands there. | ground (r 1.5) | 1.8 s · hero kit W | [source](../../src/spells/targeted/fastGrowth.ts), [kit sheet](../../pipeline/designs/kit-timber.md) |
| caber toss | He rips up the nearest tree and hurls it end over end, or throws his axe if there is none. | ground (r 1) | 3.0 s · hero kit E | [source](../../src/spells/targeted/caberToss.ts), [kit sheet](../../pipeline/designs/kit-timber.md) |
| timber call | Five trees grow in a row; a recast swings and they fall like dominoes along the row. | ground (r 1) | 9.3 s (the fall 3.65 s) · hero kit R | [source](../../src/spells/targeted/timberCall.ts), [kit sheet](../../pipeline/designs/kit-timber.md) |

## hero: balloon

4 effects. Professor Puff, the Aeronaut. Hero kit, see [Balloon](heroes/balloon.md).

| Label | Description | Targeting | Length / tier | Links |
|---|---|---|---|---|
| air hose | He pumps a small pink balloon up at the brass nozzle and lets it fly down the aim as a rocket. | ground (r 0.35) | 1.7 s · hero kit Q | [source](../../src/spells/targeted/airHose.ts), [kit sheet](../../pipeline/designs/kit-balloon.md) |
| helium bomb | A foil balloon floats to a spot, swells and pops after 1.0 s, pushing out everyone in the circle. | ground (r 2.5) | 2.2 s · hero kit W | [source](../../src/spells/targeted/heliumBomb.ts), [kit sheet](../../pipeline/designs/kit-balloon.md) |
| hot air | He pumps himself up, pushes away anyone close, then floats 6 m away. | ground (r 2.5) | 2.4 s · hero kit E | [source](../../src/spells/targeted/hotAir.ts), [kit sheet](../../pipeline/designs/kit-balloon.md) |
| pop! | A brass pin flies at an enemy in sight and pops the Air out of them. | enemy | 1.9 s · hero kit R | [source](../../src/spells/targeted/popPin.ts), [kit sheet](../../pipeline/designs/kit-balloon.md) |

## hero: cat

4 effects. Sir Whiskers, the Lynx Duelist. Hero kit, see [Cat](heroes/cat.md).

| Label | Description | Targeting | Length / tier | Links |
|---|---|---|---|---|
| scratch | He rakes the air in front of him: three crossed claw strokes in a 2.5 m cone. | self (cone 2.5 m) | 1.3 s · hero kit Q | [source](../../src/spells/targeted/scratch.ts), [kit sheet](../../pipeline/designs/kit-cat.md) |
| knock it over | He bats a clay pot off a nearby pillar or wall onto the aimed spot; with no cover it does nothing. | ground (r 1.5) | 2.2 s · hero kit W | [source](../../src/spells/targeted/knockItOver.ts), [kit sheet](../../pipeline/designs/kit-cat.md) |
| pounce | He spends a life and leaps up to 7 m, landing on the enemy with a push. | ground (dash, r 1.5) | 2.2 s · hero kit E | [source](../../src/spells/targeted/pounce.ts), [kit sheet](../../pipeline/designs/kit-cat.md) |
| land on my feet | A twirl and a cream ring: for 4 s the next lost life is kept and he leaps away. | self | 4.6 s · hero kit R | [source](../../src/spells/targeted/landOnMyFeet.ts), [kit sheet](../../pipeline/designs/kit-cat.md) |

## hero: ledger

4 effects. Mr. Ledger, the Tithe-Keeper. Hero kit, see [Ledger](heroes/ledger.md).

| Label | Description | Targeting | Length / tier | Links |
|---|---|---|---|---|
| invoice | A paper flies down the aim; its damage goes on the enemy's tab instead of hurting now. | ground (line, bolt) | up to 2.2 s · hero kit Q | [source](../../src/spells/targeted/invoice.ts), [kit sheet](../../pipeline/designs/kit-ledger.md) |
| late fee | A huge LATE FEE notice drops onto a 2.5 m circle; its damage goes on the tab and it slows. | ground (r 2.5) | 2.4 s · hero kit W | [source](../../src/spells/targeted/lateFee.ts), [kit sheet](../../pipeline/designs/kit-ledger.md) |
| call it in | The ledger is slammed shut and the enemy's tab comes due now, without interest. | self | 1.7 s · hero kit E | [source](../../src/spells/targeted/callItIn.ts), [kit sheet](../../pipeline/designs/kit-ledger.md) |
| foreclosure | A huge rubber stamp drops onto the spot and the target pays their whole tab at +60%. | ground (r 2.2) | 2.7 s · hero kit R | [source](../../src/spells/targeted/foreclosure.ts), [kit sheet](../../pipeline/designs/kit-ledger.md) |

## hero: sumo

4 effects. Big Yoko, the Mountain. Hero kit, see [Sumo](heroes/sumo.md).

| Label | Description | Targeting | Length / tier | Links |
|---|---|---|---|---|
| palm strike | A huge open hand is drawn back and thrown forward, shoving everyone in a short strip in front of the caster. | self (r 3.4) | 1.3 s · hero kit Q | [source](../../src/spells/targeted/palmStrike.ts), [kit sheet](../../pipeline/designs/kit-sumo.md) |
| stomp | A foot comes down, cracks run out across the floor and a straw-rope ring is stamped round the caster. | self (r 3.6) | 1.7 s · hero kit W | [source](../../src/spells/targeted/stomp.ts), [kit sheet](../../pipeline/designs/kit-sumo.md) |
| sumo charge | The caster drops low and runs down the aim, carrying the first enemy on the strip ahead of him. | ground (r 8) | 2.0 s · hero kit E | [source](../../src/spells/targeted/sumoCharge.ts), [kit sheet](../../pipeline/designs/kit-sumo.md) |
| salt throw | A fistful of salt is thrown in a fan across a cone in front of the caster and blinds what it covers. | self (r 6.6) | 1.8 s · hero kit R | [source](../../src/spells/targeted/saltThrow.ts), [kit sheet](../../pipeline/designs/kit-sumo.md) |

## hero: mime

4 effects. Mum, the Silent One. Hero kit, see [Mime](heroes/mime.md).

| Label | Description | Targeting | Length / tier | Links |
|---|---|---|---|---|
| invisible ball | A glove closes round nothing and throws: a ball you cannot see flies down a dashed chalk line. | ground (r 0.3) | 2.2 s · hero kit Q | [source](../../src/spells/targeted/invisibleBall.ts), [kit sheet](../../pipeline/designs/kit-mime.md) |
| mime wall | Two flat gloves press a pane that is not there and an invisible wall rises along a chalk line. | ground (r 1) | 1.4 s · hero kit W | [source](../../src/spells/targeted/mimeWall.ts), [kit sheet](../../pipeline/designs/kit-mime.md) |
| rope trick | She mimes a rope hand over hand and heaves; the enemy is pulled toward her. | enemy | 1.6 s · hero kit E | [source](../../src/spells/targeted/ropeTrick.ts), [kit sheet](../../pipeline/designs/kit-mime.md) |
| the box | She draws a box in the air and four invisible walls close round a spot on the floor. | ground (r 1.5) | 1.7 s · hero kit R | [source](../../src/spells/targeted/theBox.ts), [kit sheet](../../pipeline/designs/kit-mime.md) |

## hero: referee

4 effects. Referee Whistler, the Arbiter. Hero kit, see [Referee](heroes/referee.md).

| Label | Description | Targeting | Length / tier | Links |
|---|---|---|---|---|
| whistle blast | Whistler blows the whistle and a standing ring of sound flies down the aim. | ground (r 0.4) | about 2 s · hero kit Q | [source](../../src/spells/targeted/whistleBlast.ts), [kit sheet](../../pipeline/designs/kit-referee.md) |
| no running | A ring of sound rushes out and every enemy seen inside gets the rule NO RUNNING. | self (r 7) | 2.1 s · hero kit W | [source](../../src/spells/targeted/noRunning.ts), [kit sheet](../../pipeline/designs/kit-referee.md) |
| no casting | The same whistle and ring; every enemy seen inside gets the rule NO CASTING. | self (r 7) | about 2.1 s · hero kit E | [source](../../src/spells/targeted/noCasting.ts), [kit sheet](../../pipeline/designs/kit-referee.md) |
| show the card | A big arm points at a spot and a yellow card flies there and lands; whoever is seen inside is carded. | ground (r 1.2) | 2.2 s · hero kit R | [source](../../src/spells/targeted/showTheCard.ts), [kit sheet](../../pipeline/designs/kit-referee.md) |

## hero: chef

4 effects. Madame Cleaver, the Feastmistress. Hero kit, see [Chef](heroes/chef.md).

| Label | Description | Targeting | Length / tier | Links |
|---|---|---|---|---|
| thrown cleaver | She throws her cleaver as a tumbling bolt; it bites into the floor at the end of the line and a dish plops out. | ground (r 0.3) | about 2.4 s · hero kit Q | [source](../../src/spells/targeted/thrownCleaver.ts), [kit sheet](../../pipeline/designs/kit-chef.md) |
| hot soup | A huge stock pot drops on a spot, rocks and tips over, and a puddle of soup runs out with a dish in the middle. | ground (r 2.5) | 3.3 s · hero kit W | [source](../../src/spells/targeted/hotSoup.ts), [kit sheet](../../pipeline/designs/kit-chef.md) |
| burnt offering | She spins a blackened plate in a high arc; it lands and stays as a burnt dish that harms whoever eats it. | ground (r 0.9) | 1.7 s · hero kit E | [source](../../src/spells/targeted/burntOffering.ts), [kit sheet](../../pipeline/designs/kit-chef.md) |
| dinner is served | She snaps her fingers and an 8 m banquet table with three covered plates rises in front of her. | self (r 8.1) | about 6.9 s · hero kit R | [source](../../src/spells/targeted/dinnerIsServed.ts), [kit sheet](../../pipeline/designs/kit-chef.md) |

## hero: courier

4 effects. Pip, the Wingfoot. Hero kit, see [Courier](heroes/courier.md).

| Label | Description | Targeting | Length / tier | Links |
|---|---|---|---|---|
| express letter | An airmail envelope is flicked as a fluttering bolt that grows with the caster's Charges. | ground (r 0.3) | about 2 s · hero kit Q | [source](../../src/spells/targeted/expressLetter.ts), [kit sheet](../../pipeline/designs/kit-courier.md) |
| fragile | A brown-paper parcel is hurled at a spot, ticks and bursts into a slowing ring. | ground (r 2.5) | 2.6 s · hero kit W | [source](../../src/spells/targeted/fragile.ts), [kit sheet](../../pipeline/designs/kit-courier.md) |
| shortcut | The caster sprints up to 6 m, spilling envelopes; a Charge refunds the spell. | ground (r 1) | 1.3 s · hero kit E | [source](../../src/spells/targeted/shortcut.ts), [kit sheet](../../pipeline/designs/kit-courier.md) |
| final delivery | A big parcel with the enemy's name on it hunts the enemy for 1.5 s and bursts. | enemy | 3.0 s · hero kit R | [source](../../src/spells/targeted/finalDelivery.ts), [kit sheet](../../pipeline/designs/kit-courier.md) |

## hero: janitor

4 effects. Gus, the Temple Keeper. Hero kit, see [Janitor](heroes/janitor.md).

| Label | Description | Targeting | Length / tier | Links |
|---|---|---|---|---|
| big mop | He swings a squeaky mop across a cone and leaves a long strip of wet floor. | self (r 3.5) | 2.0 s · hero kit Q | [source](../../src/spells/targeted/bigMop.ts), [kit sheet](../../pipeline/designs/kit-janitor.md) |
| wet floor sign | A yellow folding sign tumbles onto a spot and stands as a breakable obstacle. | ground (r 0.45) | about 7.4 s · hero kit W | [source](../../src/spells/targeted/wetFloorSign.ts), [kit sheet](../../pipeline/designs/kit-janitor.md) |
| mop bucket | He throws his wheeled bucket as a tumbling bolt; it lands with a clang and wets the floor round it. | ground (r 0.4) | about 2.2 s · hero kit E | [source](../../src/spells/targeted/mopBucket.ts), [kit sheet](../../pipeline/designs/kit-janitor.md) |
| flood | After a one second warning a wave bursts out and the whole floor round him is wet. | self (r 7) | about 7.2 s · hero kit R | [source](../../src/spells/targeted/flood.ts), [kit sheet](../../pipeline/designs/kit-janitor.md) |

## hero: mole

4 effects. Mabel, the Deepdelver. Hero kit, see [Mole](heroes/mole.md).

| Label | Description | Targeting | Length / tier | Links |
|---|---|---|---|---|
| mole claw | She rakes her huge digging claws across a cone in front of her. | self (r 2.5) | 1.3 s · hero kit Q | [source](../../src/spells/targeted/moleClaw.ts), [kit sheet](../../pipeline/designs/kit-mole.md) |
| mole dig | A tiny pickaxe taps the ground three times and a hole opens that traps whoever walks in. | ground (r 1.5) | 1.6 s · hero kit W | [source](../../src/spells/targeted/moleDig.ts), [kit sheet](../../pipeline/designs/kit-mole.md) |
| mole tunnel | She dives, tunnels under the floor behind a moving mound and bursts out, knocking up what is at the exit. | ground (r 8.7) | about 2.6 s · hero kit E | [source](../../src/spells/targeted/moleTunnel.ts), [kit sheet](../../pipeline/designs/kit-mole.md) |
| sinkhole | The ground shudders under the enemy, then drops into a wide pit that roots whoever is inside. | enemy | 3.0 s · hero kit R | [source](../../src/spells/targeted/sinkhole.ts), [kit sheet](../../pipeline/designs/kit-mole.md) |

## hero: yarn

4 effects. Grandma Ironknit, the Weaver. Hero kit, see [Yarn](heroes/yarn.md).

| Label | Description | Targeting | Length / tier | Links |
|---|---|---|---|---|
| knitting needle | She throws a needle as long as a sword, end first, with a thread of wool behind it. | ground (r 0.3) | about 1.8 s · hero kit Q | [source](../../src/spells/targeted/knittingNeedle.ts), [kit sheet](../../pipeline/designs/kit-yarn.md) |
| cast on | She throws a ball of wool along the aim and ties a yarn line to the nearest cover. | ground (r 1) | 1.1 s · hero kit W | [source](../../src/spells/targeted/castOn.ts), [kit sheet](../../pipeline/designs/kit-yarn.md) |
| sweater | She throws a knitted sweater on the enemy; it slows them, then shrinks. | enemy | 3.4 s · hero kit E | [source](../../src/spells/targeted/sweater.ts), [kit sheet](../../pipeline/designs/kit-yarn.md) |
| mr biscuit | A big grey cat springs out of a ball of wool and runs at the enemy to sit on them. | enemies (up to 10) | about 7.2 s · hero kit R | [source](../../src/spells/targeted/mrBiscuit.ts), [kit sheet](../../pipeline/designs/kit-yarn.md) |

## hero: weather

4 effects. Barry Cloudsley, the Sky Augur. Hero kit, see [Weather](heroes/weather.md).

| Label | Description | Targeting | Length / tier | Links |
|---|---|---|---|---|
| cold front | He sweeps his pointer and a gust flies down the aim, carrying the weather of the moment. | ground (r 0.4) | about 2 s · hero kit Q | [source](../../src/spells/targeted/coldFront.ts), [kit sheet](../../pipeline/designs/kit-weather.md) |
| lightning risk | A grinning storm cloud rolls in over a spot and a bolt strikes the circle under it. | ground (r 1.5) | about 2.0 s · hero kit W | [source](../../src/spells/targeted/lightningRisk.ts), [kit sheet](../../pipeline/designs/kit-weather.md) |
| forecast update | A weather card hangs over his head and flips to the new forecast. | self (r 30) | 2.1 s · hero kit E | [source](../../src/spells/targeted/forecastUpdate.ts), [kit sheet](../../pipeline/designs/kit-weather.md) |
| severe warning | A tornado stands up at a spot and walks at the enemy for four seconds. | ground (r 2) | about 5.8 s · hero kit R | [source](../../src/spells/targeted/severeWarning.ts), [kit sheet](../../pipeline/designs/kit-weather.md) |

## hero: sheep

4 effects. Bo, the Ramherd. Hero kit, see [Sheep](heroes/sheep.md).

| Label | Description | Targeting | Length / tier | Links |
|---|---|---|---|---|
| crook whack | He shakes his crook, then brings it down across a cone, leaving a sheep at the feet of whoever is hit. | self (r 4) | 1.4 s · hero kit Q | [source](../../src/spells/targeted/crookWhack.ts), [kit sheet](../../pipeline/designs/kit-sheep.md) |
| spare sheep | Three sheep are flung out of his coat and land at a spot. | ground (r 2) | 1.4 s · hero kit W | [source](../../src/spells/targeted/spareSheep.ts), [kit sheet](../../pipeline/designs/kit-sheep.md) |
| shear | He shears a nearby sheep in one stroke and throws the wool as a spinning ball. | ground (r 0.3) | 1.4 s · hero kit E | [source](../../src/spells/targeted/shear.ts), [kit sheet](../../pipeline/designs/kit-sheep.md) |
| stampede | Eight sheep gather abreast of him, then bolt down a long strip. | ground (r 2) | 2.9 s · hero kit R | [source](../../src/spells/targeted/stampede.ts), [kit sheet](../../pipeline/designs/kit-sheep.md) |

## hero: magic

4 effects. The Great Zambini, the Illusionist. Hero kit, see [Magic](heroes/magic.md).

| Label | Description | Targeting | Length / tier | Links |
|---|---|---|---|---|
| card spray | A fan of three playing cards flies out as three spinning bolts trailing confetti and gold stars. | ground (r 0.3) | about 2.2 s · hero kit Q | [source](../../src/spells/targeted/cardSpray.ts), [kit sheet](../../pipeline/designs/kit-magic.md) |
| sawn in half | A toothed saw blade is drawn out of thin air and slides at the enemy. | ground (r 0.35) | about 2.2 s · hero kit W | [source](../../src/spells/targeted/sawnInHalf.ts), [kit sheet](../../pipeline/designs/kit-magic.md) |
| hat trick | Three top hats shuffle round him while he hides under one; he steps out of it with a rabbit. | self (r 2) | about 2.7 s · hero kit E | [source](../../src/spells/targeted/hatTrick.ts), [kit sheet](../../pipeline/designs/kit-magic.md) |
| grand finale | He vanishes; three hats ring the enemy and swords fly from all three toward the centre. | enemy | about 3.0 s · hero kit R | [source](../../src/spells/targeted/grandFinale.ts), [kit sheet](../../pipeline/designs/kit-magic.md) |

## hero: door

4 effects. Wick, the Doorwarden. Hero kit, see [Door](heroes/door.md).

| Label | Description | Targeting | Length / tier | Links |
|---|---|---|---|---|
| key toss | He throws a brass key as a bolt that flies into one door and out of its pair. | ground (r 0.3) | about 2.5 s · hero kit Q | [source](../../src/spells/targeted/keyToss.ts), [kit sheet](../../pipeline/designs/kit-door.md) |
| wick door | An upright door with a brass number steps up at a spot; two at a time form a pair. | ground (r 0.9) | about 1.8 s · hero kit W | [source](../../src/spells/targeted/wickDoor.ts), [kit sheet](../../pipeline/designs/kit-door.md) |
| door slam | Every standing door of his slams and hits what is near it. | self (r 30) | 1.7 s · hero kit E | [source](../../src/spells/targeted/doorSlam.ts), [kit sheet](../../pipeline/designs/kit-door.md) |
| grand lobby | Four tall red doors rise in a ring round the enemy's spot. | ground (r 3) | about 2.3 s · hero kit R | [source](../../src/spells/targeted/grandLobby.ts), [kit sheet](../../pipeline/designs/kit-door.md) |

## hero: twins

7 effects. Pim and Pom, the Changeling Twins. Hero kit, see [Twins](heroes/twins.md).

| Label | Description | Targeting | Length / tier | Links |
|---|---|---|---|---|
| bonk | Pim swings a wooden sword across a 3 m cone. | ground (cone) | 1.5 s · hero kit Q | [source](../../src/spells/targeted/pimBonk.ts), [kit sheet](../../pipeline/designs/kit-twins.md) |
| pim charge | Pim runs up to 5 m along a lane and shoves what is in it. | ground (lane) | 1.6 s · hero kit W | [source](../../src/spells/targeted/pimCharge.ts), [kit sheet](../../pipeline/designs/kit-twins.md) |
| shield up | A toy shield pops up in front of Pim: shield 50 for 2 s. | self (r 4) | 2.5 s · hero kit E | [source](../../src/spells/targeted/pimShieldUp.ts), [kit sheet](../../pipeline/designs/kit-twins.md) |
| pebble | Pom fires a pebble from a slingshot as a real bolt. | ground (bolt) | 1.8 s · hero kit Q | [source](../../src/spells/targeted/pomPebble.ts), [kit sheet](../../pipeline/designs/kit-twins.md) |
| snare | A net drops on a 2 m circle and roots what is inside. | ground (r 2) | 2.7 s · hero kit W | [source](../../src/spells/targeted/pomSnare.ts), [kit sheet](../../pipeline/designs/kit-twins.md) |
| backflip | Pom hops 4 m and leaves a party popper that goes off. | ground (hop) | 1.6 s · hero kit E | [source](../../src/spells/targeted/pomBackflip.ts), [kit sheet](../../pipeline/designs/kit-twins.md) |
| tag out | The twins high-five and swap: a 0.5 s hold, then the other kit. | self (r 3) | 1.5 s · hero kit R | [source](../../src/spells/targeted/tagOut.ts), [kit sheet](../../pipeline/designs/kit-twins.md) |

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
- [Blood](heroes/blood.md), [Forge](heroes/forge.md), [Frost](heroes/frost.md), [Astral](heroes/astral.md), [Alchemy](heroes/alchemy.md), [Storm](heroes/storm.md), [Sand](heroes/sand.md), [Shadow](heroes/shadow.md), [Grove](heroes/grove.md), [Dawn](heroes/dawn.md), [Tide](heroes/tide.md), [Sky](heroes/sky.md), [Bone](heroes/bone.md), [Clockwork](heroes/clockwork.md), [Prism](heroes/prism.md), [Bard](heroes/bard.md), [Hive](heroes/hive.md), [Void](heroes/void.md), [Chrono](heroes/chrono.md), [Ink](heroes/ink.md)
- [Docs home](../README.md)
- [Art bible](../ART_BIBLE.md)
- [VFX principles](../VFX_PRINCIPLES.md)
