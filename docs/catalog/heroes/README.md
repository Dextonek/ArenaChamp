---
title: Hero roster
tags: [catalog, heroes, kits]
updated: 2026-10-30
---

# Hero roster

Twenty hero kits, each one character with four spells (Q, W, E and the R ultimate), one shared parts file, one palette row in the art bible and one rigged model. A kit is data (`HeroKit` in [`src/heroes.ts`](../../../src/heroes.ts)); its spells are ordinary registered effects looked up by label, so each also appears in the [effect catalog](../effects.md). Hero mode (key H, `src/heroMode.ts`) plays a kit MOBA-style on top of play mode, and the hero switcher (View menu, or click the portrait) changes the hero.

## Roster

| Hero | Title | Theme | Signature shape | Portrait (HUD, canvas-drawn) | Page |
|---|---|---|---|---|---|
| Vesper | the Crimson Countess | blood (`hero: blood`) | The blood tendril: a tapered, viscous rope with a round bead at the tip, that hardens into faceted ruby crystal thorns. | A bone crescent behind a blood drop: the moon and the blood. | [blood](blood.md) |
| Brannoc | the Ashen Smith | forge (`hero: forge`) | Molten slag that cools: liquid metal glows white-orange, a black crust grows over it from the edges inward, leaving orange cracks that dim to dull red and go out. | A broad iron helm, an ash beard, and the forge glowing in his chest. | [forge](forge.md) |
| Isolde | the Winter Warden | frost (`hero: frost`) | Frost ferns: rime creeps across the floor (and up the enemies) as feathery, branching fern patterns that grow from a point outward, white-blue on dark stone, then shatter into angular ice shards. | A frost fern fan behind, a tall crystal, and a hooded face with one pink glint. | [frost](frost.md) |
| Lyra | the Star Archer | astral (`hero: astral`) | Constellations: bright four-point star points joined by thin, crisp gold lines that draw themselves from star to star into a figure (a net, a bow, a stag), then snap: the lines break and the stars fall as small shooting stars. | A parchment ring with a gold bow-shaped constellation inside it. | [astral](astral.md) |
| Vex | the Plague Alchemist | alchemy (`hero: alchemy`) | Glass and reaction: thin-walled glass flasks (pale green-white glass, dark liquid inside) that shatter into sharp glass shards, releasing a bubbling caustic liquid (acid green, big round bubbles that swell and pop into rings) and rising fume curls. | A dark hood, a pale glass mask with a long beak-like snout and two round green lenses, and a coat with a bandolier of vials. | [alchemy](alchemy.md) |
| Kaia | the Tempest Caller | storm (`hero: storm`) | The lightning tree: thick, hard-edged blue-white lightning that branches like a tree with a dark outline, under flat-bottomed dark cloud, with slanting rain streaks at one shared angle. | A dark cloud over slanting rain and a branching bolt, a hooded face in a rain cloak, and the hooked staff with a spark in its hook. | [storm](storm.md) |
| Sefu | the Dune Sovereign | sand (`hero: sand`) | Sand that flows like a ribbon and sets like stone: thick grainy ochre ribbons that harden into pale carved sandstone with dark incised glyphs, then crumble to dust. | Layered linen shoulders, a gold collar, a bearded face under a striped gold headdress, and the sandstone crook behind. | [sand](sand.md) |
| Nyx | the Umbral Stalker | shadow (`hero: shadow`) | Flat cut-paper shadow: matte-black blades, hands, a crescent and hooded figures with a thin hard violet edge line, standing as cut-outs that move in stepped jumps. | A pale moon behind her, two crossed daggers and the hooded black figure with a mint slit for the eyes. | [shadow](shadow.md) |
| Fenna | the Grove Warden | grove (`hero: grove`) | The spiral vine that blooms: thick green vines coil in spirals with leaf pairs, and at the end of every spiral a giant flower bursts open (a cup of cream petals with a pink rim and a pollen core), then sheds petals and pollen. | A living staff topped by a bloom, a cloak of layered leaves with a pale bark collar, and antler-like branches around her head. | [grove](grove.md) |
| Auriel | the Dawn Paladin | dawn (`hero: dawn`) | Hard-light geometry: flat gold panels with crisp edges (hexagons, kite shields, blade shards) that click together into shapes and shatter into panels, lit by a white core line with a dark amber rim. | A sun disc with crisp rays, a halo ring above a helmed paladin in white and gold plate, and a raised blade. | [dawn](dawn.md) |
| Marin | the Tide Dancer | tide (`hero: tide`) | The water ribbon: thick, smooth bands of clear blue water with a white foam crest that she swirls like a dancer's sash, throwing spinning droplets off the curls. | Sashes of water sweeping round her, a wave-blue wrap on the shoulders and a coral flower in her hair. | [tide](tide.md) |
| Zephyr | the Wind Blade | sky (`hero: sky`) | The wind crescent: sharp pale sickle crescents with a hot leading edge and a thin dark inner edge, joined by thin spiral gust ribbons and blown leaves. | A big pale crescent behind her, gust ribbons streaming to the side, a mint scarf and a head with swept white hair and a pink blossom. | [sky](sky.md) |
| Mortis | the Ossuary Lord | bone (`hero: bone`) | Bone architecture: chunky carved ivory ribs, vertebrae, skull-capped spires and cages with teal soulfire flickering in the joints. | A skull face under a dark hood with teal wisps, rib arcs over the chest and a skull-topped staff. | [bone](bone.md) |
| Ada | the Artificer | clockwork (`hero: clockwork`) | The toothed gear: machined copper and brass gears, springs, chains and rivets, with cyan sparks jumping where the metal meets and steam from the joints. | A backpack of brass gears behind her shoulders, a cyan zigzag of electricity and a bobbed head with goggles pushed up on a leather cap. | [clockwork](clockwork.md) |
| Opaline | the Lightbreaker | prism (`hero: prism`) | The refracting crystal: faceted clear lavender glass with a dark edge line, and light that enters white and leaves as thin parallel bands of red, gold, green and blue. | A floating ring of small prisms behind her head, a pale lavender robe with crystal epaulettes and a crystal brooch, and a calm face under long pale hair. | [prism](prism.md) |
| Sirix | the Swarm Warden | hive (`hero: hive`) | The hexagon and the swarm: wax-amber honeycomb cells, black chitin plates with an amber rim, and hundreds of small striped wasps that form into shapes. | Honeycomb cells and pale wings behind black chitin shoulders with hexagonal pauldrons, and an insect head with green eyes. | [hive](hive.md) |
| Cantor | the Last Verse | bard (`hero: bard`) | The stave and the note: flowing five-line parchment staves with dark ink notes riding them, thin fast sound rings and one golden lyre. | Staves drifting behind him with notes riding them, a rose and plum coat with a lyre strap and a parchment scarf printed with notes. | [bard](bard.md) |
| Oblivion | the Unmaker | void (`hero: void`) | Torn space: jagged slits of pure black with a hot pink edge on one side and a cyan fringe on the other, glass-like cracks on the ground and flat shards of the world drifting into the tears. | Black plate cracked with glowing pink rifts, spiked pauldrons, a ragged cloak whose hem breaks into floating shards and a horned helm with a single rift slit. | [void](void.md) |
| Shiori | the Last Brush | ink (`hero: ink`) | The wet brushstroke: tapered strokes with bristle streaks and a dry tail, splatter, rice-paper decals where ink bleeds in and a square vermilion seal. | Floating paper talismans, a huge brush, a rice-paper white robe with the hem washed in ink and an indigo sash, and long black hair with a brush-shaped hairpin. | [ink](ink.md) |
| Tempo | the Unwound Hour | chrono (`hero: chrono`) | The luminous clock dial: rings of Roman numerals and ticks in radium chartreuse, tapered clock hands, a red second hand and pale afterimages. | A glowing clock dial behind his head like a halo, a staff shaped like a giant minute hand, an ivory dial plate on the shoulder and a monocle. | [chrono](chrono.md) |

## Roles (2026-10-30)

Every hero has a role and a kit shape of its own (design: [`hero-roles.md`](../../../pipeline/designs/hero-roles.md)).
No two heroes share the same four spell shapes; the old "Q single target, W ground zone, E self aura, R radius-7
ultimate" template is gone. New spell types: QUICK (no aim: the hero turns to the nearest enemy in reach and fires), NOVA (a ring that grows from
the caster), ORBIT (blades circle the caster), BOOMERANG (out and back), CHANNEL (a held, sweeping beam), GLOBAL (no
range limit, long warning), TRAIL (a dash that leaves a slowing strip), plus TRAP, LINGER, FUSE, HOOK, TETHER, CAGE,
BACKSTEP, BLINK and EXECUTE.

| Hero | Role | Signature | Q | W | E | R |
|---|---|---|---|---|---|---|
| Nyx | assassin | Shadowstep | DASH strike | AURA silence | QUICK fan ×3 | EXECUTE |
| Zephyr | assassin (melee) | Never stands still | CONE | DASH knock-up | BACKSTEP | DASH ultimate |
| Brannoc | tank (melee) | Anvil lock | CONE slow | LOB stun | BUFF shield + chain pull | SELF-R knock-up |
| Oblivion | juggernaut (melee) | Into the rift | CONE | ZONE pull to him | AURA silence | ZONE pull + silence |
| Vesper | juggernaut (drain) | Blood price | TGT drain | ZONE slow | TETHER drain | ZONE heal per hit |
| Sirix | juggernaut (melee) | The swarm | CONE slow | DASH + wasps | BUFF shield | SUMMON queen ultimate |
| Kaia | mage (burst) | Unavoidable lightning | TGT chain | ZONE 3 strikes | NOVA stun | ZONE r5 burst |
| Vex | mage (poison) | Lingering poison | LOB burn | LINGER slow pool | BUFF heal | LINGER gold field |
| Tempo | mage (chrono) | Rewind | BOOMERANG slow | ZONE stun | BACKSTEP rewind | FUSE |
| Lyra | marksman | Out-range | BOLT bounce | TRAP root | BACKSTEP | GLOBAL hunt |
| Opaline | marksman | Refraction | BOLT split | ZONE blind | BLINK + shield | QUICK CHANNEL sweep |
| Auriel | support | Aegis | BOLT pierce + shield | TRAP stun dome | ORBIT blades + shield | ZONE + big shield |
| Fenna | support | Regrowth | TGT + heal | TGT root (vines) | TURRET | SELF-R heal + root |
| Cantor | support | Silence | BOLT bounce | ZONE silence | BUFF heal + shield | SELF-R stun |
| Isolde | controller | Frostbite, then freeze | BOLT pierce slow | LINE root | AURA slow + armour | SELF-R stun |
| Sefu | controller | Shackles and teeth | TGT root | LINGER slow, then root | AURA shield + slow | ZONE stun |
| Marin | controller | Undertow | HOOK | ZONE pull + knock-up | TRAIL dash + heal | LINE knock-up |
| Mortis | summoner | Raise the dead | BOLT pierce | SUMMON skeletons | CAGE root | ZONE + archers |
| Ada | summoner | Turret engineer | BOLT bounce slow | TURRET | LINGER gear field | ZONE root |
| Shiori | summoner | Ink familiars | BOLT split at end | ZONE root | SUMMON cranes | ZONE blind |

Spell labels per hero:

| Hero | Q | W | E | R (ultimate) |
|---|---|---|---|---|
| Vesper | hemolance | thorn garden | crimson pact | sanguine eclipse |
| Brannoc | rivet shot | anvil drop | bellows ward | forgefall |
| Isolde | rime spear | frostfern field | glacial mantle | winter's crown |
| Lyra | starshot | constellation snare | orbit veil | celestial hunt |
| Vex | volatile flask | caustic pool | mutagen | grand transmutation |
| Kaia | arc lance | downpour | static field | eye of the storm |
| Sefu | sand lash | quicksand | dune ward | tomb of kings |
| Nyx | umbral blink | grasp of the deep | night shroud | eclipse execution |
| Fenna | bloom lash | overgrowth | verdant ward | world blossom |
| Auriel | radiant spear | aegis wall | halo of blades | judgement of dawn |
| Marin | tide whip | whirlpool | undertow dance | leviathan's waltz |
| Zephyr | gale edge | tailwind rush | cyclone guard | thousand winds |
| Mortis | bone spear | grave call | ossuary ward | legion of the ossuary |
| Ada | clockwork rivet shot | cog turret | gear field | gearfall |
| Opaline | prism bolt | refraction field | mirror shell | spectrum lance |
| Sirix | mandible rend | swarm leap | chitin carapace | queen's descent |
| Cantor | discordant note | silencing refrain | ballad of valor | crescendo |
| Oblivion | rift cleave | null tether | void mantle | unmaking |
| Shiori | brushstroke | ink snare | paper familiars | final calligraphy |
| Tempo | second hand | stopped moment | rewind | twelfth hour |

## How the kits share structure

- **One parts file per kit**: `src/effects/parts/<theme>.ts` exports a palette constant (numbers, plus a `_CSS` string twin such as `BLOOD` / `BLOOD_CSS`) and the kit's pooled parts. The spells import it directly.
- **One palette row per kit** in [ART_BIBLE.md](../../ART_BIBLE.md) section 2: core, hot, body, accent, dark, plus a pale foil colour that keeps dark energy readable on a darkened floor. The art bible rows are Blood (bone foil), Forge (ash), Frost (rime), Astral (chart parchment), Alchemy (glass, with gold for the transmutation), Storm (rain grey), Sand (sandstone), Shadow (moon grey), Grove (bark cream), Dawn (ivory) and Tide (foam), Sky (cloud), Bone (bone ivory), Clockwork (steel), Prism (clear glass), Hive (wax), Bard (parchment), Void (ash), Ink (rice paper) and Chrono (ivory dial).
- **Spells**: `src/spells/targeted/<camelName>.ts`, each exporting `<camelName>Module` with `category: 'hero: <theme>'`, registered in `src/spells/targeted/index.ts`. Every hit passes the kit colour (`color: <PALETTE>_CSS.body`) so the arena hit flash matches.
- **Kit data**: `HeroKit` has name, title, accent and foil colours, a canvas-drawn portrait, an optional model path, and a tuple of four `HeroSpell` (`key`, `label`, `name`, `range`, `cooldown`, `blurb`, canvas icon). The blood kit is inline in `src/heroes.ts`; the others are `src/kits/<theme>.ts`.
- **Q, W, E are normal MOBA abilities** under the gameplay camera: the hit lands 0.4-0.8 s after the cast and the frame is clean by about 2 s (an E aura may run about 3 s). Since 2026-10-30 each slot's shape depends on the hero (see Roles above); traps, lingering zones and fuses may land up to 4.2 s after the cast.
- **R is the ultimate**: the biggest of the four, still under the gameplay camera (no cinematic, no letterbox), hit around 2.0-2.5 s, clean by 4.5 s, with one dead beat and one short impact frame. Ranges: Q 10-12, W 10-11, R 13-14; cooldowns: Q 2.5-3 s, W 6-8 s, E 9-10 s, R 20 s.
- **Each kit has a signature shape** and a pale foil near its dark layer; shapes must read at gameplay distance (camera about 12-16 behind and 6-8 above). The shared look lessons are in [`pipeline/designs/kit-common.md`](../../../pipeline/designs/kit-common.md); the blood kit sheet [`blood-kit.md`](../../../pipeline/designs/blood-kit.md) is the template.
- **Mechanics fields**: the wave 3, wave 4 and wave 5 kits use the optional kit fields of the [combat mechanics](../../architecture/mechanics.md): `maxHp` and `melee` on the kit (Zephyr, Sirix, Oblivion), `dash`, `cc`, `summon` and `aim: 'line'` on a spell, and `ctx.projectile` / `ctx.summon` / `ctx.shieldSelf` / `ctx.moveCaster` and `HitOptions.status` in the spell files; the wave 5 kits also use `HitOptions.pull` (Oblivion's Null Tether and Unmaking, see [Pull](../../architecture/mechanics.md#pull)) and `ctx.healSelf` (Tempo's Rewind).
- **Models**: rigged figures on the Dao rig in `public/models/heroes/<theme>.glb`, built by [`blender/heroes/hero_figures.py`](../../../blender/heroes/hero_figures.py) (one `LOOKS` entry per hero plus its props) and mapped by hero name in `src/heroes.ts`.

## Concept lineup

The hand-drawn concept lineup (front views, one scale, each hero wearing the look of their spells; vector source [`lineup_concept.svg`](../../heroes/lineup_concept.svg)):

![Hero kits concept lineup](../../heroes/lineup_concept.png)

The concept for the wave 1 heroes (Kaia, Sefu and Nyx; vector source [`wave1_concept.svg`](../../heroes/wave1_concept.svg)):

![Wave 1 concept: Kaia, Sefu and Nyx](../../heroes/wave1_concept.jpg)

The concept for the wave 2 heroes (Fenna, Auriel and Marin; vector source [`wave2_concept.svg`](../../heroes/wave2_concept.svg)):

![Wave 2 concept: Fenna, Auriel and Marin](../../heroes/wave2_concept.jpg)

The concept for the wave 3 heroes (Zephyr, Mortis and Ada; vector source [`wave3_concept.svg`](../../heroes/wave3_concept.svg)):

![Wave 3 concept: Zephyr, Mortis and Ada](../../heroes/wave3_concept.jpg)

The concept for the wave 4 heroes (Opaline, Sirix and Cantor; vector source [`wave4_concept.svg`](../../heroes/wave4_concept.svg)):

![Wave 4 concept: Opaline, Sirix and Cantor](../../heroes/wave4_concept.jpg)

The concept for the newest three heroes (Oblivion, Shiori and Tempo; vector source [`wave5_concept.svg`](../../heroes/wave5_concept.svg)):

![Wave 5 concept: Oblivion, Shiori and Tempo](../../heroes/wave5_concept.jpg)

## In-game sheet

The rigged models in hero mode: front row facing the camera, back row from behind (left to right: Vesper, Brannoc, Isolde, Lyra, Vex).

![In-game hero models](../../heroes/ingame_sheet.jpg)

The turnaround sheet of the same models is [`models_sheet.jpg`](../../heroes/models_sheet.jpg).

The wave 4 models in hero mode (Opaline, Sirix and Cantor):

![Wave 4 in-game hero models](../../heroes/wave4-ingame_sheet.jpg)

The wave 5 models in hero mode (Oblivion, Shiori and Tempo):

![Wave 5 in-game hero models](../../heroes/wave5-ingame_sheet.jpg)

## Hero pages

- [Vesper, the Crimson Countess](blood.md)
- [Brannoc, the Ashen Smith](forge.md)
- [Isolde, the Winter Warden](frost.md)
- [Lyra, the Star Archer](astral.md)
- [Vex, the Plague Alchemist](alchemy.md)
- [Kaia, the Tempest Caller](storm.md)
- [Sefu, the Dune Sovereign](sand.md)
- [Nyx, the Umbral Stalker](shadow.md)
- [Fenna, the Grove Warden](grove.md)
- [Auriel, the Dawn Paladin](dawn.md)
- [Marin, the Tide Dancer](tide.md)
- [Zephyr, the Wind Blade](sky.md)
- [Mortis, the Ossuary Lord](bone.md)
- [Ada, the Artificer](clockwork.md)
- [Opaline, the Lightbreaker](prism.md)
- [Sirix, the Swarm Warden](hive.md)
- [Cantor, the Last Verse](bard.md)
- [Oblivion, the Unmaker](void.md)
- [Shiori, the Last Brush](ink.md)
- [Tempo, the Unwound Hour](chrono.md)

## Balance (duel tournament)

The 2026-10-30 hero-roles pass rebalanced every kit at walk speed 4 m/s with duel cover on. Main numbers are damage per hit unless noted; they come from the spell defaults in `src/spells/targeted/`.

| Hero | Role | HP | Q / W / E / R main numbers |
|---|---|---|---|
| Vesper | juggernaut (drain) | 620 | Q 42 (heals 6); W 50 + slow 1.5 s + tick 10; E 3 x 12 (heals 6 each); R 15 harvest (heals 10) + 100 |
| Brannoc | tank (melee) | 780 | Q 38, slow 0.8 s; W 42, stun 1.0 s; E shield 100, pull 1.5 m; R 92, knock-up 0.5 s |
| Isolde | controller | 600 | Q 64, slow 1.5 s; W 62, root 1.2 s; E shield 50, 12 + slow 1.0 s; R 150, stun 1.0 s |
| Lyra | marksman | 550 | Q 53 (bounces); W 60, root 1.2 s; E 12, slow 1.0 s; R 155 |
| Vex | mage (poison) | 560 | Q 53 + burn 12; W 34 + 4 x 7, slow 1.0 s; E heal 45; R 75 + 2 x 5 + 50, slow 2.0 s |
| Kaia | mage (burst) | 560 | Q 56 (chain 28); W 40 + 15, slow 1.0 s; E 20, stun 0.5 s; R 150 |
| Sefu | controller | 600 | Q 46, root 0.8 s; W 3 x 6 slow 1.2 s + 32 root 1.0 s; E shield 45, 13, slow 1.0 s; R 110, stun 1.0 s |
| Nyx | assassin | 600 | Q 62; W 40, silence 1.0 s; E 3 x 22; R 160 |
| Fenna | support | 600 | Q 50 (heals 8); W 45, root 1.2 s; E turret 80 HP, 12 per shot; R 95, heal 45, root 1.0 s |
| Auriel | support | 600 | Q 55, shield 10; W 45, stun 0.8 s; E 3 x 10, shield 25; R 100, shield 50 |
| Marin | controller | 620 | Q 55, pull 3 m; W 45, pull 1.5 m, knock-up 0.4 s; E 4 per tick, slow 1.0 s, heal 15; R 100, knock-up 0.5 s |
| Zephyr | assassin (melee) | 690 | Q 44; W 45, knock-up 0.4 s; E 13, shield 30; R 130, knock-up 0.5 s |
| Mortis | summoner | 580 | Q 54; W 15 + 2 skeletons; E 2 x 12, root 1.2 s; R 95 + 2 archers |
| Ada | summoner | 580 | Q 58, slow 1.5 s; W turret 20, 12 per shot; E 3 x 9, slow 1.0 s; R 125, root 1.2 s |
| Opaline | marksman | 560 | Q 50 (split 18); W 48, blind 1.5 s; E shield 45, blink; R 3 x 50 sweep, 70 degrees |
| Sirix | juggernaut (melee) | 720 | Q 45, slow 1.0 s; W 40 + 2 wasps; E shield 60; R 85, slow 1.5 s, 3 wasps |
| Cantor | support | 640 | Q 52; W 40, silence 1.5 s; E 10 per pulse, shield 30, heal 40; R 95, stun 0.8 s |
| Oblivion | juggernaut (melee) | 780 | Q 53; W 48, pull 4 m, slow 1.0 s; E 35, silence 1.2 s; R 120, pull 4 m, silence 1.5 s |
| Shiori | summoner | 580 | Q 56 (split 12); W 48, root 1.0 s; E 10 + 2 cranes (8 damage); R 115, blind 1.5 s |
| Tempo | mage (chrono) | 580 | Q 35 per leg, slow 1.0 s; W 35, stun 0.8 s; E 15, shield 25, heal 45; R 135 (fuse 3.5 s) |

Basic attacks (melee 13 per 1.2 s at 2.6 m, ranged 10 per 1.0 s at 6.5 m) are on in the AI duels, and the numbers above were rebalanced for them. Final win rates from `_tourney(4)` with basic attacks (1520 fights, 0 timeouts, average fight 22 s, 152 fights per hero): Vesper 51, Brannoc 47 (re-check after his last nerf; 63 before), Isolde 51, Lyra 49, Vex 48, Kaia 57, Sefu 47, Nyx 43, Fenna 52, Auriel 51, Marin 47, Zephyr 57, Mortis 42, Ada 42, Sirix 53, Cantor 44, Opaline 54, Oblivion 51, Shiori 48, Tempo 50. Noise is about plus or minus 6 points.

## See also

- [Effect catalog](../effects.md)
- [Combat mechanics](../../architecture/mechanics.md)
- [Hero mode screenshots](../../spells/hero-mode_aim.jpg) and [ultimate](../../spells/hero-mode_ult.jpg)
- [Docs home](../../README.md)
- [Art bible](../../ART_BIBLE.md)
- [Kit shared rules](../../../pipeline/designs/kit-common.md)
