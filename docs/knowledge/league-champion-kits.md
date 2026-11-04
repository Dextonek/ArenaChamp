---
title: League champion kits
tags: [knowledge, kits, design, research, league-of-legends]
updated: 2026-11-04
---

# League champion kits

Every champion in League of Legends, 173 kits as of patch 26.22, read as a designer would read them: what each ability does, the
pattern the kit repeats, the choice it keeps asking of the player, how the opponent answers it, and what a 1v1 duel can learn from
it. The other half of this research, why these kits work and how ours compare, is in
[League kit design](league-kit-design.md).

This is study material. The rule for our game stays the same: take the principle, never the champion. Names, abilities and characters
here belong to Riot Games.

## How to read an entry

The line under the name gives the classes, attack type, resource, release year and last rework. VG is a visual and gameplay update;
GR is a gameplay rework.

- **P, Q, W, E, R:** each ability in a few words, with Riot's name for it. These are this doc's own descriptions, not the game's text.
- **Rhythm:** cooldowns from the first rank to the last, in seconds, and the windows they open.
- **Loop:** the pattern the kit repeats in a fight.
- **Decision:** the choice the player makes over and over.
- **Counterplay:** what the opponent can do, and when.
- **Mastery:** where a good player beats an average one.
- **For a duel:** the lesson for a 1v1 game, ending in a verdict: `[transfers]`, `[partly]` or `[5v5 only]`.

## How it was made, and how far to trust it

**Sources.**
- The list of champions and the vocabulary below started from the two Fandom pages the project was pointed at:
  [List of champions](https://leagueoflegends.fandom.com/wiki/List_of_champions) and
  [Champion ability](https://leagueoflegends.fandom.com/wiki/Champion_ability). Both are out of date: the first counts 170 champions as
  of January 2025, and the second marks itself as outdated. Fandom also refuses automated reading, so they were read by hand in a
  browser.
- The champion pages came from the official wiki, [wiki.leagueoflegends.com](https://wiki.leagueoflegends.com/en-us/List_of_champions),
  which has the same 173 names and is current.
- Slots, ability names and cooldowns were checked against Riot's own public data, Data Dragon version 16.22.1.
- Classes come from the official wiki's list. Riot's intent is linked in an entry only where a source was found. Most analysis lines
  are this project's reading, not Riot's, and most entries say so.

**Checks that were run.**
- Every entry's cooldowns were compared with Riot's data. Before correction, 640 values matched, 41 did not and 11 were not listed.
  After it, 650 match and 31 do not. Most of those 31 are charge, form or attack-speed abilities, where Riot's data lists only the short
  gap between casts and the entry gives the real recharge. Jayce's are read per form.
- Every ability line was then compared with Riot's own text for that slot. About 40 of the 173 entries had something wrong and were
  fixed, six of them with swapped slots: Jayce, Malzahar, Rakan, Ryze, Sett and Volibear.

**Limits.**
- The pages were read through a tool that summarises them, and only the first 100,000 characters of each. Details can be missing, and
  small errors are likely to remain. Check a number against the live wiki before relying on it.
- Tags and "For a duel" verdicts are judgements. No kit here was tested in a 1v1, and no human reviewed all 173 entries.
- Rework years come from one table on the official wiki, read the same way. A few look odd: Aurora and Smolder show a 2024 rework in the
  year they were released, and Swain's 2024 entry could not be confirmed.

## The vocabulary

Nearly every kit has one innate ability with no ranks, three basic abilities with five ranks each, and an ultimate with three ranks that
opens at level 6.

An ability is built from **parts**:
- a **cost** (mana, energy, health, a build-up bar, or nothing) and a **cooldown**
- **ammo**: charges that build up over time, or charges granted on cast that run out
- **range**, and a **cast time** of usually a quarter, half or one second, which stops an effect being instant
- a **channel** the caster must hold, of which a **charge** is one kind; breaking a channel usually keeps the cost and cooldown
- **recasts**, a second or third press with a new effect
- a **toggle**, a **stance** or a change of **form**
- a **summon**, or effects triggered by other actions

And it has **effects**:
- combat: damage, buffs and debuffs, with crowd control as a special debuff
- utility: dashes and blinks, healing, shields, stealth, invulnerability and untargetability

The tags in the counts below use this vocabulary. `hard_cc` is a stun, root, knock, taunt, charm or suppress; `soft_cc` is a slow, blind,
silence or grounding; `stacks` is a build-up the kit pays off; `delay` is a hit that lands after a clear wait; `zone` is a lasting area;
`mark` is a target the kit pays off later. The rows behind the counts are in
[champion-tags.json](league-research/champion-tags.json).

## Counts across the roster

Counted from one tag row per kit, as of the official wiki on 2026-11-04. The tags are judgements read from summarised pages, so treat single percentage points as noise and look at the shape.

### The basic shape

- **Attack:** melee 89 (51%), ranged 79 (46%), both 5 (3%)
- **Resource:** mana 145 (84%), none 7 (4%), rage 7 (4%), energy 6 (3%), other 4 (2%), health 3 (2%), heat 1 (1%)
- **Classes:** Marksman 26, Assassin 21, Diver 19, Skirmisher 18, Burst 17, Vanguard 15, Juggernaut 14, Specialist 14, Enchanter 12, Battlemage 11, Catcher 10, Artillery 8, Warden 7

### How many kits have each effect (anywhere in the kit)

| Effect | Kits | Share |
|---|---:|---:|
| damage | 173 | 100% |
| buff | 155 | 90% |
| soft_cc | 139 | 80% |
| hard_cc | 130 | 75% |
| dash | 101 | 58% |
| heal | 84 | 49% |
| debuff | 69 | 40% |
| shield | 60 | 35% |
| mark | 60 | 35% |
| reset | 46 | 27% |
| attack_reset | 45 | 26% |
| untargetable | 31 | 18% |
| pull | 28 | 16% |
| blink | 23 | 13% |
| execute | 23 | 13% |
| stealth | 20 | 12% |
| terrain | 18 | 10% |
| block | 15 | 9% |
| invulnerable | 10 | 6% |
| steal | 5 | 3% |

Grouped: 112 kits (65%) can dash or blink; 163 (94%) have crowd control; 138 (80%) have a defensive tool (shield, heal, invulnerability, untargetability, stealth or a projectile block).

### How many kits have each structural part (anywhere in the kit)

| Part | Kits | Share |
|---|---:|---:|
| stacks | 116 | 67% |
| delay | 84 | 49% |
| recast | 81 | 47% |
| zone | 80 | 46% |
| channel | 45 | 26% |
| summon | 33 | 19% |
| ammo | 29 | 17% |
| form_change | 21 | 12% |
| evolve | 16 | 9% |
| charge | 15 | 9% |
| stance | 15 | 9% |
| toggle | 10 | 6% |

### What each slot does

Share of kits whose slot has the tag.

| Tag | P | Q | W | E | R |
|---|---:|---:|---:|---:|---:|
| aim: direction | 1% | 52% | 23% | 33% | 27% |
| aim: targeted | 1% | 15% | 12% | 23% | 20% |
| aim: ground | 1% | 16% | 25% | 24% | 19% |
| aim: self | 0% | 17% | 40% | 19% | 29% |
| aim: global | 0% | 1% | 1% | 1% | 5% |
| effects: damage | 46% | 95% | 65% | 81% | 79% |
| effects: hard_cc | 3% | 23% | 19% | 31% | 36% |
| effects: soft_cc | 3% | 28% | 24% | 32% | 29% |
| effects: dash | 2% | 15% | 15% | 28% | 18% |
| effects: blink | 0% | 1% | 1% | 3% | 9% |
| effects: shield | 7% | 1% | 15% | 10% | 6% |
| effects: heal | 21% | 11% | 16% | 5% | 12% |
| effects: buff | 51% | 19% | 42% | 27% | 29% |
| parts: recast | 0% | 15% | 12% | 14% | 22% |
| parts: stacks | 49% | 10% | 7% | 6% | 5% |
| parts: charge | 0% | 4% | 3% | 1% | 1% |
| parts: channel | 1% | 2% | 3% | 4% | 17% |
| parts: zone | 1% | 9% | 17% | 14% | 17% |
| parts: summon | 7% | 2% | 9% | 2% | 6% |

### Cooldowns

Median seconds at the first and last rank, across kits with a listed cooldown for that slot.

| Slot | Kits | First rank | Last rank |
|---|---:|---:|---:|
| Q | 169 | 8 | 6 |
| W | 170 | 14 | 10 |
| E | 170 | 13 | 10 |
| R | 172 | 120 | 80 |

- At the first rank, the ultimate's cooldown is a median 6.7 times the longest basic (151 kits with all four listed).
- Q is the shortest basic in 118 of 164 kits (72%).

### Kits over time

A kit's year is its last rework if it has one, otherwise its release. Busyness is the average number of tags per kit, a rough measure of how much a kit does.

| Kit year | Kits | Can dash or blink | Dash or blink abilities per kit | Recast in kit | Defensive tool | Tags per kit |
|---|---:|---:|---:|---:|---:|---:|
| 2009-2012 | 38 | 55% | 0.76 | 42% | 79% | 14.4 |
| 2013-2015 | 35 | 60% | 0.74 | 31% | 69% | 15.2 |
| 2016-2018 | 36 | 75% | 1.11 | 50% | 78% | 16.9 |
| 2019-2021 | 24 | 75% | 1.12 | 46% | 92% | 16.3 |
| 2022-2024 | 32 | 62% | 0.94 | 59% | 81% | 16.9 |
| 2025-2026 | 8 | 62% | 1.00 | 75% | 100% | 18.0 |

### By class

Primary class only (the first one listed). Tags per kit counts how much a kit does.

| Class | Kits | Can dash or blink | Hard crowd control | Defensive tool | Recast | Tags per kit |
|---|---:|---:|---:|---:|---:|---:|
| Marksman | 26 | 50% | 46% | 54% | 15% | 13.5 |
| Assassin | 18 | 100% | 56% | 89% | 67% | 16.5 |
| Burst | 17 | 47% | 94% | 82% | 65% | 14.4 |
| Diver | 17 | 94% | 94% | 100% | 71% | 18.5 |
| Vanguard | 15 | 93% | 100% | 67% | 47% | 17.5 |
| Specialist | 14 | 50% | 57% | 57% | 14% | 14.8 |
| Skirmisher | 14 | 93% | 71% | 100% | 57% | 16.9 |
| Juggernaut | 13 | 62% | 62% | 100% | 62% | 17.6 |
| Battlemage | 11 | 27% | 73% | 82% | 36% | 16.0 |
| Enchanter | 9 | 11% | 89% | 100% | 44% | 13.9 |
| Catcher | 7 | 43% | 100% | 86% | 43% | 15.9 |
| Warden | 6 | 100% | 100% | 100% | 50% | 18.3 |
| Artillery | 6 | 33% | 100% | 33% | 50% | 16.3 |

### How much carries over to a 1v1 duel

Each entry's own verdict on its lesson.

**transfers:** 106, **partly:** 59, **5v5 only:** 8

Kits whose lesson is 5v5 only: Kayle, Master Yi, Milio, Nasus, Rakan, Taric, Viego, Yuumi.

### Riot's own difficulty rating against how much a kit does

Riot's data rates each champion's difficulty from 1 to 10. Tags per kit is this doc's count.

| Riot difficulty | Kits | Tags per kit | Recast in kit | Stance or form change |
|---|---:|---:|---:|---:|
| 1-3 | 24 | 16.8 | 33% | 29% |
| 4-5 | 58 | 15.9 | 59% | 16% |
| 6-7 | 46 | 15.5 | 37% | 11% |
| 8-10 | 41 | 16.1 | 49% | 27% |

Rated hardest: Ambessa 10, Anivia 10, Aphelios 10, Bel'Veth 10, Cassiopeia 10, Evelynn 10, Nilah 10, Rumble 10, Yasuo 10, Azir 9. Riot's data has no rating for Akshan, Rell, Seraphine, Vex, so the table counts 169 kits.

### The extremes of busyness

- **Most tags:** Briar 29, Hwei 25, Ornn 25, Pantheon 25, Poppy 23, Viego 23, Bel'Veth 22, Rek'Sai 22, Sion 22, Udyr 22, Aurora 21, Camille 21.
- **Fewest tags:** Miss Fortune 9, Tryndamere 9, Ezreal 10, Sivir 10, Vayne 10, Annie 11, Ashe 11, Karma 11, Kassadin 11, Katarina 11, Morgana 11, Sona 11.

## Find a champion by class

Grouped by first class. Some champions have a second class, shown in their entry.

- **Artillery** (6): [Hwei](#hwei-the-visionary), [Jayce](#jayce-the-defender-of-tomorrow), [Mel](#mel-the-souls-reflection), [Vel'Koz](#velkoz-the-eye-of-the-void), [Xerath](#xerath-the-magus-ascendant), [Ziggs](#ziggs-the-hexplosives-expert)
- **Assassin** (18): [Akali](#akali-the-rogue-assassin), [Diana](#diana-scorn-of-the-moon), [Ekko](#ekko-the-boy-who-shattered-time), [Evelynn](#evelynn-agonys-embrace), [Fizz](#fizz-the-tidal-trickster), [Kassadin](#kassadin-the-void-walker), [Katarina](#katarina-the-sinister-blade), [Kha'Zix](#khazix-the-voidreaver), [Locke](#locke-the-ashen-exorcist), [Naafiri](#naafiri-the-hound-of-a-hundred-bites), [Nocturne](#nocturne-the-eternal-nightmare), [Pyke](#pyke-the-bloodharbor-ripper), [Qiyana](#qiyana-empress-of-the-elements), [Rengar](#rengar-the-pridestalker), [Shaco](#shaco-the-demon-jester), [Talon](#talon-the-blades-shadow), [Yone](#yone-the-unforgotten), [Zed](#zed-the-master-of-shadows)
- **Battlemage** (11): [Anivia](#anivia-the-cryophoenix), [Aurelion Sol](#aurelion-sol-the-star-forger), [Cassiopeia](#cassiopeia-the-serpents-embrace), [Karthus](#karthus-the-deathsinger), [Malzahar](#malzahar-the-prophet-of-the-void), [Rumble](#rumble-the-mechanized-menace), [Ryze](#ryze-the-rune-mage), [Swain](#swain-the-noxian-grand-general), [Taliyah](#taliyah-the-stoneweaver), [Viktor](#viktor-the-herald-of-the-arcane), [Vladimir](#vladimir-the-crimson-reaper)
- **Burst** (17): [Ahri](#ahri-the-nine-tailed-fox), [Annie](#annie-the-dark-child), [Aurora](#aurora-the-witch-between-worlds), [Brand](#brand-the-burning-vengeance), [Karma](#karma-the-enlightened-one), [LeBlanc](#leblanc-the-deceiver), [Lissandra](#lissandra-the-ice-witch), [Lux](#lux-the-lady-of-luminosity), [Neeko](#neeko-the-curious-chameleon), [Orianna](#orianna-the-lady-of-clockwork), [Seraphine](#seraphine-the-starry-eyed-songstress), [Sylas](#sylas-the-unshackled), [Syndra](#syndra-the-dark-sovereign), [Twisted Fate](#twisted-fate-the-card-master), [Veigar](#veigar-the-tiny-master-of-evil), [Vex](#vex-the-gloomist), [Zoe](#zoe-the-aspect-of-twilight)
- **Catcher** (7): [Bard](#bard-the-wandering-caretaker), [Blitzcrank](#blitzcrank-the-great-steam-golem), [Ivern](#ivern-the-green-father), [Morgana](#morgana-the-fallen), [Rakan](#rakan-the-charmer), [Thresh](#thresh-the-chain-warden), [Zyra](#zyra-rise-of-the-thorns)
- **Diver** (17): [Ambessa](#ambessa-matriarch-of-war), [Briar](#briar-the-restrained-hunger), [Camille](#camille-the-steel-shadow), [Elise](#elise-the-spider-queen), [Hecarim](#hecarim-the-shadow-of-war), [Irelia](#irelia-the-blade-dancer), [Jarvan IV](#jarvan-iv-the-exemplar-of-demacia), [Lee Sin](#lee-sin-the-blind-monk), [Olaf](#olaf-the-berserker), [Pantheon](#pantheon-the-unbreakable-spear), [Rek'Sai](#reksai-the-void-burrower), [Renekton](#renekton-the-butcher-of-the-sands), [Shyvana](#shyvana-the-half-dragon), [Vi](#vi-the-piltover-enforcer), [Warwick](#warwick-the-uncaged-wrath-of-zaun), [Wukong](#wukong-the-monkey-king), [Xin Zhao](#xin-zhao-the-seneschal-of-demacia)
- **Enchanter** (9): [Janna](#janna-the-storms-fury), [Lulu](#lulu-the-fae-sorceress), [Milio](#milio-the-gentle-flame), [Nami](#nami-the-tidecaller), [Renata Glasc](#renata-glasc-the-chem-baroness), [Sona](#sona-maven-of-the-strings), [Soraka](#soraka-the-starchild), [Taric](#taric-the-shield-of-valoran), [Yuumi](#yuumi-the-magical-cat)
- **Juggernaut** (13): [Aatrox](#aatrox-the-darkin-blade), [Darius](#darius-the-hand-of-noxus), [Dr. Mundo](#dr-mundo-the-madman-of-zaun), [Garen](#garen-the-might-of-demacia), [Illaoi](#illaoi-the-kraken-priestess), [Mordekaiser](#mordekaiser-the-iron-revenant), [Nasus](#nasus-the-curator-of-the-sands), [Sett](#sett-the-boss), [Trundle](#trundle-the-troll-king), [Udyr](#udyr-the-spirit-walker), [Urgot](#urgot-the-dreadnought), [Volibear](#volibear-the-relentless-storm), [Yorick](#yorick-the-shepherd-of-souls)
- **Marksman** (26): [Akshan](#akshan-the-rogue-sentinel), [Aphelios](#aphelios-the-weapon-of-the-faithful), [Ashe](#ashe-the-frost-archer), [Caitlyn](#caitlyn-the-sheriff-of-piltover), [Corki](#corki-the-daring-bombardier), [Draven](#draven-the-glorious-executioner), [Ezreal](#ezreal-the-prodigal-explorer), [Jhin](#jhin-the-virtuoso), [Jinx](#jinx-the-loose-cannon), [Kai'Sa](#kaisa-daughter-of-the-void), [Kalista](#kalista-the-spear-of-vengeance), [Kindred](#kindred-the-eternal-hunters), [Kog'Maw](#kogmaw-the-mouth-of-the-abyss), [Lucian](#lucian-the-purifier), [Miss Fortune](#miss-fortune-the-bounty-hunter), [Samira](#samira-the-desert-rose), [Senna](#senna-the-redeemer), [Sivir](#sivir-the-battle-mistress), [Smolder](#smolder-the-fire-breathing-dragon), [Tristana](#tristana-the-yordle-gunner), [Twitch](#twitch-the-plague-rat), [Varus](#varus-the-arrow-of-retribution), [Vayne](#vayne-the-night-hunter), [Xayah](#xayah-the-rebel), [Yunara](#yunara-the-unbroken-faith), [Zeri](#zeri-the-spark-of-zaun)
- **Skirmisher** (14): [Bel'Veth](#belveth-the-empress-of-the-void), [Fiora](#fiora-the-grand-duelist), [Gwen](#gwen-the-hallowed-seamstress), [Jax](#jax-grandmaster-at-arms), [Kayn](#kayn-the-shadow-reaper), [Kled](#kled-the-cantankerous-cavalier), [Lillia](#lillia-the-bashful-bloom), [Master Yi](#master-yi-the-wuju-bladesman), [Nilah](#nilah-the-joy-unending), [Riven](#riven-the-exile), [Tryndamere](#tryndamere-the-barbarian-king), [Viego](#viego-the-ruined-king), [Yasuo](#yasuo-the-unforgiven), [Zaahen](#zaahen-the-unsundered)
- **Specialist** (14): [Azir](#azir-the-emperor-of-the-sands), [Cho'Gath](#chogath-the-terror-of-the-void), [Fiddlesticks](#fiddlesticks-the-ancient-fear), [Gangplank](#gangplank-the-saltwater-scourge), [Gnar](#gnar-the-missing-link), [Graves](#graves-the-outlaw), [Heimerdinger](#heimerdinger-the-revered-inventor), [Kayle](#kayle-the-righteous), [Kennen](#kennen-the-heart-of-the-tempest), [Nidalee](#nidalee-the-bestial-huntress), [Quinn](#quinn-demacias-wings), [Singed](#singed-the-mad-chemist), [Teemo](#teemo-the-swift-scout), [Zilean](#zilean-the-chronokeeper)
- **Vanguard** (15): [Alistar](#alistar-the-minotaur), [Amumu](#amumu-the-sad-mummy), [Gragas](#gragas-the-rabble-rouser), [Leona](#leona-the-radiant-dawn), [Malphite](#malphite-shard-of-the-monolith), [Maokai](#maokai-the-twisted-treant), [Nautilus](#nautilus-the-titan-of-the-depths), [Nunu & Willump](#nunu--willump-the-boy-and-his-yeti), [Ornn](#ornn-the-fire-below-the-mountain), [Rammus](#rammus-the-armordillo), [Rell](#rell-the-iron-maiden), [Sejuani](#sejuani-fury-of-the-north), [Sion](#sion-the-undead-juggernaut), [Skarner](#skarner-the-primordial-sentry), [Zac](#zac-the-secret-weapon)
- **Warden** (6): [Braum](#braum-the-heart-of-the-freljord), [Galio](#galio-the-colossus), [K'Sante](#ksante-the-pride-of-nazumah), [Poppy](#poppy-keeper-of-the-hammer), [Shen](#shen-eye-of-twilight), [Tahm Kench](#tahm-kench-the-river-king)

## The champions

### Aatrox, the Darkin Blade
Juggernaut · melee · none · 2013 · last rework: 2018 VG

- **P (Deathbringer Stance):** Every so often his next attack becomes a heavy hit that deals max-health damage and heals him. Landing abilities on champions shortens the wait.
- **Q (The Darkin Blade):** Three-part blade combo. Line, then wide wedge, then a circle with a sweetspot that deals bonus damage and a short knock-up.
- **W (Infernal Chains):** Chain skillshot. Slows, and if the target stays tethered it is dragged to the centre.
- **E (Umbral Dash):** Short dash that resets his attack timer, passes through other casts, and heals on damage dealt.
- **R (World Ender):** Ten-second rampage: fear on minions, decaying speed burst, more attack damage, healing, size; takedowns extend it.
- **Rhythm:** about Q 14-6 s (with 1 s between casts), W 18-12 s, E 9-5 s, R 120-80 s. Q is the one that matters: its three casts are three separate windows, and the stance cooldown is fed by landing them.
- **Loop:** Pull or dash in with W/E, run the Q chain while the target is pinned, then take the stance attack for the heal. A sweetspot hit cuts the stance wait further, so accuracy feeds sustain.
- **Decision:** Spend the next Q cast now at a fixed angle, or hold it and wait for the opponent to walk where the circle will land. Casting early keeps pressure; waiting risks the four-second window expiring and the whole Q going on cooldown.
- **Counterplay:** Every cast fixes its angle during a roughly 0.6 s windup, so a sideways step beats casts 1 and 2. The third cast's sweetspot is small, so standing at its outer ring avoids the knock-up. Breaking the W tether (moving out of its range) cancels the pull. Grounded switches off E.
- **Mastery:** Reading which way the opponent will step between casts, aiming casts 1 and 2 to herd them into the sweetspot of cast 3, and using E mid-cast to reposition without losing the combo.
- **For a duel:** A multi-cast skillshot whose later casts shape where the enemy steps is a strong tell-and-punish loop with no items needed; the heal-for-accuracy link is good design, but the stance's max-health damage would need care in a short round. [transfers]

### Ahri, the Nine-Tailed Fox
Burst · ranged · mana · 2011 · last rework: 2022 GR

- **P (Essence Theft):** Minion kills fill a heal; a champion kill soon after damaging it gives a bigger heal. The 2022 update also makes those kills feed her ultimate.
- **Q (Orb of Deception):** Orb goes out and returns, dealing damage both ways; the return is true damage and she can pull it back along her path.
- **W (Fox-Fire):** Speed burst, then three homing flames that prefer charmed targets.
- **E (Charm):** Skillshot kiss that charms: the target cannot use movement abilities and walks toward her.
- **R (Spirit Rush):** Dash with bolts, up to three casts in a window; essence takedowns extend it. Aim is a location.
- **Rhythm:** about Q 7 s flat, W 9-5 s, E 12 s flat, R 140-100 s. Q and E are close together in cost, so E is the real gate; after a charm lands every other tool is free for a few seconds.
- **Loop:** Land E, follow with flames (they home onto charmed targets for you), Q through the target on both passes, then spend R dashes to chase or leave.
- **Decision:** Throw E early for the pick, knowing the miss leaves a 12 s hole in which she has no hard CC, or bait with Q and flames first and save E for a committed step.
- **Counterplay:** E is a narrow line and slow-moving enough to sidestep when the cast is seen. Anything that blocks projectiles or a spell shield stops it. After a charm, the flames are the only guaranteed damage, so burst is limited if she has no mana left.
- **Mastery:** Using R dashes as defence after charm, not only offence; placing Q's return pass so the orb hits as the target is charmed; and chaining the extended R to escape after a kill.
- **For a duel:** One skillshot whose success turns on every other ability is a clean structure for 1v1: a single read decides the exchange. The reward is large, so the tell must be readable. Riot's 2022 notes tie her ultimate recasts to takedowns, which has no equivalent without minions. [partly]

### Akali, the Rogue Assassin
Assassin · melee · energy · 2010 · last rework: 2018 VG

- **P (Assassin's Mark):** Damaging a champion draws a ring around them; stepping out of it gives a speed boost and an extended-range, uncancellable empowered attack.
- **Q (Five Point Strike):** Cone of kunai; targets at the far edge are slowed. Very short cooldown.
- **W (Twilight Shroud):** Smoke zone: refills energy, speed burst, invisibility inside while it expands toward enemies.
- **E (Shuriken Flip):** Backward dash with a shuriken; recast dashes to the marked target or the smoke.
- **R (Perfect Execution):** Two dashes: the first through a target, the second a finisher that scales with missing health.
- **Rhythm:** about Q 1.5 s flat, W 20-16 s, E 16-10 s, R 120-60 s. Energy, not cooldown, limits Q. The window that opens is the smoke: while it lasts her energy cap is doubled.
- **Loop:** Drop smoke, step in and become hard to hit, then dash out with E and R in a chain that ends with the ring exit and an empowered attack.
- **Decision:** Stay inside smoke for safety, or break stealth to deal damage. Attacking or casting reveals her and bars re-entry briefly, so acting costs her the very protection the zone offers.
- **Counterplay:** The smoke cannot pass through terrain and is visible as a zone, so opponents can stand outside and wait. The ring itself is hidden from them, but the empowered attack is not. Anything that reveals or roots her mid-dash ruins a chain.
- **Mastery:** Placing smoke so it expands toward the enemy, keeping E's mark for later, and timing R so its second dash lands as the target drops low.
- **For a duel:** Stealth tied to a place, not a timer, is a strong idea. Her kit is overloaded with four overlapping mobility effects and an energy rule, though, which would be unclear on a small arena. [partly]

### Akshan, the Rogue Sentinel
Marksman, Assassin · ranged · mana · 2021 · last rework: none

- **P (Dirty Fighting):** Every attack fires a second shot; hitting the same target three times in a row triggers bonus damage and a shield. Also revives allies, not relevant here.
- **Q (Avengerang):** Boomerang that extends its range on every enemy it hits and returns.
- **W (Going Rogue):** Camouflage, lasting longer near terrain or brush; boosts speed toward marked killers.
- **E (Heroic Swing):** Hook to terrain, swing around it while shooting, then jump to a spot. Three casts.
- **R (Comeuppance):** Lock onto a champion, store bullets over 2.5 s, recast to fire them; stronger on low-health targets.
- **Rhythm:** about Q 9-5 s, W 18-2 s, E 18-12 s, R 100-70 s. E is a big commitment with a reset on takedown, so a kill reopens it at once. W's cooldown collapses at max rank, which makes it nearly free.
- **Loop:** Stack Dirty Fighting with Q and attacks, use the E swing to shoot while moving, and let R's stored bullets finish.
- **Decision:** Fire R from far away with the lock-on revealing him, or keep the channel hidden and walk closer. Swing in with E to gain damage and a repositioning, or save it for escape, since the swing needs terrain nearby.
- **Counterplay:** The lock-on reveals the target, so the victim knows it has started and can stay behind cover or kill him in the channel. E can be interrupted by hard CC during the dash, and grounded stops the opening cast.
- **Mastery:** Chaining E swing shots with Q to hit three stacks, and using terrain for both hide and hook.
- **For a duel:** The terrain-hook is a good fit for an arena with cover; the W revive rule is dead weight in 1v1. The R telegraphs well. [partly]

### Alistar, the Minotaur
Vanguard · melee · mana · 2009 · last rework: 2016 GR

- **P (Triumphant Roar):** Stunning or moving enemies and nearby deaths fill a counter; at seven he heals himself and allies. Per the [2016 post](https://blogoflegends.com/2016/10/19/alistar-gets-big-changes), the old E healing became this passive.
- **Q (Pulverize):** Instant area slam around him; stuns and knocks up.
- **W (Headbutt):** Targeted dash; knocks the target back and stuns it.
- **E (Trample):** Five-second stomp that makes him ghosted and builds stacks for an empowered stunning attack.
- **R (Unbreakable Will):** Seven seconds of damage reduction and a clean of all CC.
- **Rhythm:** about Q 14-10 s, W 14-10 s, E 12-10 s, R 120-80 s. Q and W are the same length, so they can be chained back to back; E is the only tool that works as a timer.
- **Loop:** W to arrive, Q during the dash to cut the knockback short and stun at close range, then E stacks into an empowered attack.
- **Decision:** Pulverize the moment W lands, shortening the knockback to keep them close, or hold Q for the enemy's dash. Using both at once ends in a long stun, but then he has no answer to their reply.
- **Counterplay:** Q has a short windup and a small circle; stepping out of it, or Flash during the W dash, avoids it. R makes him tanky but not immune to true damage. His E ghosting helps him walk through, not away.
- **Mastery:** The W-into-Q buffer is the high-skill play; so is saving R for the moment he is already inside the stun chain.
- **For a duel:** A kit made of reliable short CC works, but its payoff is protecting allies; alone he only has the stun chain, so tuning would be needed to avoid a lock-down loop. [partly]

### Ambessa, Matriarch of War
Diver, Skirmisher · melee · energy · 2024 · last rework: none

- **P (Drakehound's Step):** An innate dash usable during ability lockouts; each cast stores a stack that turns the next attack into a longer, faster, energy-restoring strike.
- **Q (Cunning Sweep / Sundering Slam):** Cone slash with stronger outer edge; recast a line slam if the first hit.
- **W (Repudiation):** Brace and shield, then ground smash; bigger smash if the shield took damage.
- **E (Lacerate):** Spin that slows heavily; a second spin if she dashes.
- **R (Public Execution):** Long-range line blink to the farthest champion, suppress, then slam.
- **Rhythm:** about Q 14-10 s, W 18-14 s, E 13-9 s, R 130-100 s. All three basic abilities cost the same energy, so what limits her is choosing which one to chain after the passive.
- **Loop:** Cast, dash in the lockout, attack with the empowered hit, cast again. The dash being free inside the lockout means her combos have no wasted time.
- **Decision:** Brace with W while the enemy is still hitting her, for the bigger smash, or open with Q and E to chase. W risks a wasted shield; chasing risks running dry on energy.
- **Counterplay:** W is a stationary brace with a real windup, so punishing it with CC works. R takes 0.7 s to cast and her only defence is displacement immunity; a dash out of the line wastes it. Being grounded stops her dash.
- **Mastery:** Shield timing, and keeping three stacks live so every attack is the empowered one.
- **For a duel:** The idea of the passive dash filling lockouts is a good feel win for a duel with fast ability animations; the energy refund for empowered attacks makes a clear loop. [transfers]

### Amumu, the Sad Mummy
Vanguard · melee · mana · 2009 · last rework: none

- **P (Cursed Touch):** His attacks and ultimate mark enemies with a curse that makes magic damage on them partly true damage. Despair ticks refresh it.
- **Q (Bandage Toss):** Bandage skillshot with two charges and a short gap between casts; stuns the first enemy and dashes him onto them.
- **W (Despair):** Toggle aura that ticks for a little flat damage plus a percent of max health, draining mana every second until he turns it off or runs dry.
- **E (Tantrum):** Passive flat cut to each physical hit; active burst around him whose cooldown shortens every time he is hit by an attack.
- **R (Curse of the Sad Mummy):** Wide, delayed-by-a-quarter-second area stun and damage that applies the curse after its own hit.
- **Rhythm:** about Q charge 16-12 s (3 s between casts), W toggle, E 9-5 s, R 150-100 s. Two Q charges mean one miss is forgivable; E is shortest when he is being hit, so a long fight on him speeds it up.
- **Loop:** Q to close, W on to tick and keep the curse up, E to punish the attacks coming back, R once the enemy is committed. In a duel he is also the one who is hit, and that shortens E.
- **Decision:** Keep Despair on for steady percent damage and constant curse, burning mana that Q and R need, or switch it off to save mana for a second Q or the ultimate. Leaving it on against a kiting enemy drains him for nothing; off, he loses most of his pressure.
- **Counterplay:** Q is a single narrow line, and a sidestep or projectile block wastes it (a spell shield still lets the dash happen). R has a 0.25 s cast and a 550 radius, so staying outside it or killing him first works. Grounded stops Q, and the aura does nothing to a target that never stands near him.
- **Mastery:** Saving the second Q charge for the re-engage, and landing R on someone already cursed so the true-damage bonus applies; the page says R amplifies only already-marked targets.
- **For a duel:** A two-charge skillshot with a stun-and-dash is easy to read and forgiving, and the toggle drain is a nice small tax on staying aggressive. The big-radius stun can become a single lock-down moment, so its numbers would need care. [transfers]

### Anivia, the Cryophoenix
Battlemage · ranged · mana · 2009 · last rework: none

- **P (Rebirth):** When she would die she becomes an egg for six seconds and returns at full health if it survives; a very long cooldown makes it a once-only second life.
- **Q (Flash Frost):** Slow-moving ice bolt that slows; recast, or reaching its end, bursts it into an area stun.
- **W (Crystallize):** Placed ice wall that blocks walking and pushes enemies away from it for five seconds, without blocking sight.
- **E (Frostbite):** Targeted hit that deals double against enemies recently hit by Q or a full-grown storm.
- **R (Glacial Storm):** Toggle storm that grows over 1.5 s, slows, and deals triple damage at full size; drains mana each second and ends if she walks away.
- **Rhythm:** about Q 11-7 s, W 17 s flat, E 4 s flat, R 4-2 s with a 1 s recast gap. E is almost always ready, so the real timing is how long Q's ice mark lasts; W is the only long cooldown.
- **Loop:** Q to slow, wall to close a route, pop Q for the stun, E on the marked target for double damage, storm over the place they are trapped.
- **Decision:** Put the wall in front of the enemy to block a chase, or behind them to trap them in the storm. A wall behind the enemy that traps them also stops her own retreat.
- **Counterplay:** The bolt is slow and straight, so walking sideways beats it, and the stun pops at a place they can see. The wall has a limited width and a visible five-second life, and the storm takes time to reach full strength, so leaving it early costs little.
- **Mastery:** Popping Q so the stun lands as the wall closes, throwing E inside the mark window, and managing mana on the storm toggle.
- **For a duel:** Player-made terrain suits an arena with cover, and a single kit that creates, then punishes, a position is easy to teach. The egg passive is a once-per-round second life that a short round would have to reset. [partly]

### Annie, the Dark Child
Burst · ranged · mana · 2009 · last rework: none

- **P (Pyromania):** Every cast builds a stack; at four she is Energized, and her next Q, W or R becomes a stun.
- **Q (Disintegrate):** Point-and-click fireball; a kill halves its cooldown and refunds the mana.
- **W (Incinerate):** A short cone of fire, cast from where she stands when the windup ends.
- **E (Molten Shield):** A brief shield and speed burst on herself (or an ally) that hurts attackers.
- **R (Summon: Tibbers):** Drops Tibbers on a spot: burst damage, then a controllable bear that burns and attacks for a long while.
- **Rhythm:** Q 4 s flat, W 7 s flat, E 10 s flat, R 130-100 s. The Q is so cheap that stacks return in about one short exchange; the R is the only real pause.
- **Loop:** Spend E, Q, W to reach four stacks, then land the stun with whichever spell fits the range, and burst the stunned target. Tibbers is the second wave.
- **Decision:** Release the stun now on a target who can still run, or hold the Energized state until the opponent commits to a dash or stands still. Holding loses nothing but time and invites the opponent to make her waste stacks on shields; releasing early gives a short stun on a full-health target.
- **Counterplay:** The stun comes from a targeted Q or a short cone, so she must come within about 600 range. Spacing, cover and a spell shield deny it, though the stack still counts when blocked. Her cooldowns are short, so the real answer is a punish after the stun, not a dodge.
- **Mastery:** Choosing the stun spell by distance, banking a kill-reset Q for the finish, and placing Tibbers so the stun covers a trap rather than a retreat.
- **For a duel:** A visible four-pip meter that converts into a guaranteed hard CC is a clean, readable rhythm and lets the opponent play around the next stun. It is also dull: the kit is point-and-click and low in skill expression beyond timing. [transfers]

### Aphelios, the Weapon of the Faithful
Marksman · ranged · mana · 2019 · last rework: none

- **P (The Hitman and the Seer):** Five weapons, two held at once; each has its own attack and Q, and 50 ammo that runs out and cycles.
- **Q (Weapon Abilites):** Changes with the main weapon: a long bolt, a burst attack flurry with healing, a root, a locking cone, or a turret.
- **W (Phase):** Swaps main and off-hand in about a quarter second.
- **E (Weapon Queue System):** A prompt that shows the next weapon in the queue; it is an interface aid, not a spell.
- **R (Moonlight Vigil):** A moonlight missile that explodes on the first champion hit and applies the main weapon's special effect.
- **Rhythm:** Q cooldowns run about 8-12 s down to 5-10 s depending on weapon, W 0.8 s, R 120-100 s. Weapons that empty rotate out, so the "cooldown" that matters is ammo.
- **Loop:** Read the pair you hold, fire the combination that fits (root plus mark, or lock-on cone plus volley), swap as the ammo or the situation demands, and spend the ultimate with the weapon pair that gives the best finish.
- **Decision:** Use a Q now, spending ammo and mana, or swap to a better pair at a cost of a quarter second, knowing the next weapon in the queue is fixed. Rushing forces the worst pair into the fight; waiting wastes uptime.
- **Counterplay:** The weapons are visible, so the opponent can read which pair he holds: dodge the slow-and-root, or stay out of range of a long bolt. The ultimate takes a 0.6 s cast and is a visible missile, so a champion can sidestep it or stay out of the blast. Opponents can also punish the 1 s assembly pause when a weapon empties.
- **Mastery:** Memorising all ten pair combinations and the queue order, and timing swaps so ammo runs out on a favourable weapon. Riot said the queue's fixed order was deliberate, to make combinations situational rather than chosen (see Riot's Aphelios Insights link above).
- **For a duel:** A rotating loadout gives deep variety from few buttons, but the memory load is huge and the mastery is mostly knowledge, not reaction. A trimmed version with two weapons would work. [partly]

### Ashe, the Frost Archer
Marksman · ranged · mana · 2009 · last rework: 2015 GR

- **P (Frost Shot):** Her arrows slow; critical-strike chance converts into bonus damage, and a crit doubles the slow.
- **Q (Ranger's Focus):** Basic attacks build up to four Focus; spending it gives a short burst of rapid arrow flurries.
- **W (Volley):** A cone of arrows that slows the first target each hits.
- **E (Hawkshot):** A hawk flies to any point on the map and reveals the path.
- **R (Enchanted Crystal Arrow):** A global arrow that stuns the first champion hit; the stun grows with the distance it flew.
- **Rhythm:** Q has no cooldown, only the time to rebuild Focus (about 6 s); W 18 s at rank 1 but 4 s at max, E 5 s plus slow-charging, R 100-60 s. The W's cooldown cliff makes the late kit a spam kit.
- **Loop:** Auto-attack to build Focus, open with a slow, trade in the flurry window, and hold the arrow to capture a kiter or catch a disengage. Every auto and W also keeps the opponent slowed.
- **Decision:** Fire the long arrow now for a short stun at close range, or wait for distance and a longer stun but a smaller chance to hit. She can also spend the cheap flurry early, or save Focus for a decisive moment.
- **Counterplay:** The R is a thin, slow projectile and a flat line, so side-steps, cover and walls stop it. Closing the gap beats her slow because the stun is short up close. Cutting the Focus build with brief aggression forces her to waste attacks.
- **Mastery:** Kiting with the slow, flurrying the moment the opponent steps in, and judging when the R's length makes it worth firing.
- **For a duel:** A global projectile that rewards distance with duration is a clean risk-reward trade. In an arena the map is small, so the distance scale should be shortened. [transfers]

### Aurelion Sol, the Star Forger
Battlemage · ranged · mana · 2016 · last rework: 2023 GR

- **P (Cosmic Creator):** Damaging champions earns permanent Stardust, which makes each of his abilities larger or stronger.
- **Q (Breath of Light):** A channelled steerable beam that bursts each second on one target; it can be cancelled early.
- **W (Astral Flight):** A dash that lets him cast Q with no cooldown or channel limit while flying; kills refund it.
- **E (Singularity):** A black hole that pulls enemies in and executes those at its centre below a health threshold.
- **R (Falling Star / The Skies Descend):** A star lands after a delay, stunning. At 75 Stardust it becomes a larger star with a map-wide slowing shockwave.
- **Rhythm:** Q 3 s, W 22-14 s, E 12 s flat, R 120-100 s. The Q's short cooldown lets him channel repeatedly; the E and W set the pace.
- **Loop:** Open with the black hole to hold a target, channel the beam through it, use the dash to follow or escape, and land the star while the target is pinned.
- **Decision:** Commit to a long channel that needs line of sight, or keep the beam short to stay safe, accepting less damage. The W dash lets him channel while moving, at half speed.
- **Counterplay:** The black hole has a half-second delay and a visible circle, so one step out avoids it; the star has a 1.25 s telegraph. Silence or crowd control cancels his channel, and any CC while dashing knocks him down.
- **Mastery:** Positioning the pull so the target sits at the centre for the execute, and steering the beam while dodging.
- **For a duel:** The persistent growth meter is a stand-out idea: his kit gets bigger the longer the match goes. But the rework flopped early (press coverage), because his power was too late-loaded, and a short round would give the meter no time to matter. [partly]

### Aurora, the Witch Between Worlds
Burst, Assassin · ranged · mana · 2024 · last rework: 2024 GR

- **P (Spirit Abjuration):** Three attacks or damaging spells on a target trigger a bonus burst of max-health magic damage, and each burst frees a healing spirit.
- **Q (Twofold Hex):** A bolt that curses; a recast (automatic when the curse expires) sends bolts back that hurt more the lower the target is.
- **W (Across the Veil):** A dash through the Spirit Realm, then brief invisibility; a takedown right after damage resets it.
- **E (The Weirding):** A line blast that slows heavily, while she recoils backward.
- **R (Between Worlds):** A leap, then a shockwave leaves a rift; she can cross its edge to the other side while untargetable, and enemies touching it are slowed.
- **Rhythm:** Q 9-7 s, W 22-18 s, E 15-11 s, R 140-100 s. The short Q cycle and the recoiling E mean she fights in short pokes with a rare reset.
- **Loop:** Q out, auto and spell to build three stacks, recast Q for missing-health damage, E to slow and back out, W or R to leave.
- **Decision:** Use the recoil E to open distance, or hold it as a slow for the finish; spend the W as an escape or hold it so a kill can reset it. Both sides cost her an exit.
- **Counterplay:** Her Q is a bolt: dodge it and the recast has nothing to mark. The recast is also a visible return path. The R rift is a known place, so waiting outside it denies the dash; the rift border slows only for a couple of seconds.
- **Mastery:** Timing the Q recast so both bolts connect, chaining stacks into the burst, and using the rift as an escape route.
- **For a duel:** The mark-then-return Q and the escape rift are strong: each leaves a short window where the opponent can answer. Riot's Insights describe the unfinished first design (stealing spells) that was dropped for the current one ([Aurora Insights](https://www.leagueoflegends.com/en-gb/news/dev/champion-insights-Aurora/)). [transfers]

### Azir, the Emperor of the Sands
Specialist · ranged · mana · 2014 · last rework: 2023 GR

- **P (Shurima's Legacy):** Rebuilds a turret-like Sun Disc from the ruins of fallen turrets; it has nothing to do with duels.
- **Q (Conquering Sands):** All Sand Soldiers rush to a point, damaging and slowing what they cross.
- **W (Arise!):** Places a Sand Soldier (up to two stored) that lasts about 10 s; when he attacks an enemy near a soldier, the soldier strikes in a line instead.
- **E (Shifting Sands):** Dashes to the soldier nearest the cursor and shields; hitting a champion stops him and refunds a soldier charge.
- **R (Emperor's Divide):** A wall of soldiers charges forward and knocks enemies back, then stands as a barrier he and allies can walk through.
- **Rhythm:** Q 14-6 s, W recharge 12-6 s (1.5 s between casts), E 22-16 s, R 120-90 s. The W is the engine: soldiers gate Q and E, so ammo, not cooldown, sets the pace.
- **Loop:** Place soldiers, attack through them, Q to reposition them as a slow, E onto the closest to gap-close or escape, and R to knock the target back into them.
- **Decision:** Keep soldiers near the opponent to attack through, or pull them to Q (which moves them out of range), because a soldier left behind expires fast and a soldier lost costs his dash.
- **Counterplay:** Soldiers are untargetable but expire quickly when Azir moves away, so kiting him beyond their reach weakens him. His attacks only work if an enemy is inside the soldier's range. A wall of terrain or a wind wall stops the R.
- **Mastery:** Placing soldiers as a map, dashing into the gap-close from beyond range, and feeding R so the wall sits across the escape route.
- **For a duel:** An ability that is simultaneously ammo, weapon and mobility is deep, but it needs two hands of attention. A trimmed single-soldier version could suit a small arena. Press coverage of the 2023 update shows only minor numbers, so the rest is analysis, not from Riot. [partly]

### Bard, the Wandering Caretaker
Catcher · ranged · mana · 2015 · last rework: none

- **P (Traveler's Call):** Collectable chimes around the map restore mana and speed, and stronger Meeps are added to his attacks as the count rises.
- **Q (Cosmic Binding):** A bolt that slows the first enemy hit; if it then hits terrain or a second enemy, both are stunned.
- **W (Caretaker's Shrine):** Places a healing shrine that grows over time and speeds an ally who steps on it; an enemy destroys it.
- **E (Magical Journey):** A one-way tunnel through terrain that lasts 10 s and speeds those inside it.
- **R (Tempered Fate):** An area of stasis for about 2.5 s that freezes everything hit, friend or foe, and cannot be cleansed.
- **Rhythm:** Q 11-7 s, W 18 s flat with two charges, E 22-16 s, R 110-80 s. The cooldowns are modest, so he spends them on setup and position rather than damage.
- **Loop:** Lay a shrine, line up the Q against a wall, stun, auto with Meeps, open a tunnel to cut off or flee, and hold R for the committed moment.
- **Decision:** Fire the Q to get a slow now, or wait until the target is next to a wall or a second target for a stun. Likewise, spend the ultimate on one enemy or to freeze everyone, including his own team.
- **Counterplay:** The Q is a slow, thin bolt, so walk in cover or sidestep it. In an arena, staying away from walls removes the stun. The ultimate is slow to travel and a clear circle, and any displacement-immune unit is unaffected.
- **Mastery:** Using walls and tunnels to turn a slow into a stun, placing shrines where they cannot be stomped, and timing the stasis.
- **For a duel:** The Q's terrain-bounce rule makes cover matter and turns the arena itself into the weapon, which is a very good lesson for this game. The passive is entirely a long-game system. [transfers]

### Bel'Veth, the Empress of the Void
Skirmisher · melee · none · 2022 · last rework: none

- **P (Death in Lavender ):** Each cast ghosts her and speeds her attacks; permanent Lavender stacks from takedowns raise attack speed, and she has no attack-speed cap.
- **Q (Void Surge):** A dash in a fixed direction; each of the four directions has its own cooldown.
- **W (Above and Below):** A tail slam that knocks up and slows; if it hits a champion it refunds the Q cooldown for the directions where champions were hit.
- **E (Royal Maelstrom):** She slashes the most wounded nearby enemy many times for more damage as health falls, healing and taking less damage; it can be cancelled.
- **R (Endless Banquet):** After a takedown, a Void Coral appears; she dashes to it, explodes, and enters a larger True Form for a long time.
- **Rhythm:** Q 4 s between casts (16-12 s per direction), W 12-8 s, E 24-12 s, R about 1 s (needs coral). The Q's per-direction timer means chaining is a puzzle, not a single cooldown.
- **Loop:** Q in to hit with a crit-capable strike, auto the target, W to knock up and refresh Q, then E to finish. Takedowns feed the R.
- **Decision:** Dash in a direction now, spending its cooldown, or keep it for a safer exit; use E to finish a wounded target or W to extend the chase. Casting everything buffs attack speed, so she is rewarded for constant action.
- **Counterplay:** Her Q is a straight line, so cover and walls stop it. Her W is slow to cast (about half a second) and visible. The E is vulnerable to crowd control and roots her in place. Staying away from low health stops the E from scaling.
- **Mastery:** Choosing which of four dash directions to spend, using W to reopen one, and spending E at the right health threshold.
- **For a duel:** The four-direction dash cooldown is a lovely idea: each direction is a separate resource, so positioning matters. R depends on kills and may not fit a 1v1. [partly]

### Blitzcrank, the Great Steam Golem
Catcher · melee · mana · 2009 · last rework: none

- **P (Mana Barrier):** Once in a long while, a hit that would drop him under about 30% health instead feeds him a temporary shield built from his mana pool.
- **Q (Rocket Grab):** Skillshot hand that stuns the first enemy and drags them to him; he is rooted while it flies.
- **W (Overdrive):** Short burst of attack and move speed, then a brief slow when it ends.
- **E (Power Fist):** Next basic attack becomes an unstoppable punch that launches the target up.
- **R (Static Field):** Passive: his attacks plant stacks that detonate as damage over time. Active: a close-range blast that strips shields, hurts and briefly silences.
- **Rhythm:** Q about 20-16 s, W 15 s, E 7-5 s, R 60-20 s. Q is the long pole: a miss leaves 15-odd seconds of a plain melee body, and a hit opens a window where E and R are both usually ready.
- **Loop:** Throw the hand, and if it lands, pull straight into a punch, and then the ultimate for the silence and shield strip. If it misses, he walks and bluffs until it returns.
- **Decision:** Throw now into a target who may be ready to dodge and lose the whole kit for 16-plus seconds, or hold it and keep threatening. Holding is safe but gives away tempo; throwing is the only way he does anything.
- **Counterplay:** The hand is slow enough to read: sidestep after the windup, stand so cover is in the line, or use a projectile block. The opponent can also bait the throw and punish the rooted wind-up and recovery.
- **Mastery:** Throwing where the enemy will be after their habitual step, and pulling them over a wall or into a position that lets E and R chain without a gap.
- **For a duel:** One skillshot that is the whole kit gives a very clear loop and strong read-the-opponent play, and it needs cover to be fair. Its failure cost (nothing else to do) would be a problem in a short round. [transfers]

### Brand, the Burning Vengeance
Burst · ranged · mana · 2011 · last rework: 2016 GR

- **P (Blaze):** Each spell leaves a stack of burning on the target (they stack to three), which ticks on max health; at three stacks it goes off in a ring a couple of seconds later and spreads the burn.
- **Q (Sear):** Fireball that stuns only if the target is already burning.
- **W (Pillar of Flame):** Delayed fire pillar on the ground, hitting harder on burning targets.
- **E (Conflagration):** Targeted flame on one enemy that spreads to those near it; the spread radius doubles if the target is burning.
- **R (Pyroclasm):** Fireball that bounces up to four times, preferring burning champions; slows burning targets.
- **Rhythm:** Q about 8-6 s, W 10-8 s, E 13-9 s, R 100-80 s. Three short cooldowns let him cycle spells and keep the fire up; the ring explosion, not any one cooldown, is the windup in the kit.
- **Loop:** E (cannot miss) or W to light the target, then Q for a stun that is now guaranteed to land if the fireball connects, then the other spell, and the ring finishes. In a one-target fight the ultimate bounces on the same enemy and hits several times.
- **Decision:** Open with the safe-to-land E, but it only sets up; or risk the Q or W first and pay for a miss with no stun. Either order shows the opponent which spell comes.
- **Counterplay:** Dodge the Q after the burn has been applied, since the stun is only on a hit; walk out of the pillar's delay; get away from the ring in its two-second delay, and a spell shield or blocker kills the fireball.
- **Mastery:** Setting up the stun with a spell that cannot be dodged and timing the three stacks so the ring lands while the enemy is already stunned.
- **For a duel:** The "light, then stun" structure shows how a mark can turn an easy skillshot into a hard commit. Riot posts on the 2016 rework could not be found; this is reading, not from Riot. [transfers]

### Braum, the Heart of the Freljord
Warden · melee · mana · 2014 · last rework: none

- **P (Concussive Blows):** Hits from Braum and his allies stack on a target; the fourth stack stuns, and afterwards his own hits deal extra damage for a while.
- **Q (Winter's Bite):** Ice bolt with a strong decaying slow.
- **W (Stand Behind Me):** Leap to an allied champion or minion, giving both armor and magic resistance.
- **E (Unbreakable):** A directional wall: an arc that blocks projectiles and cuts damage, fully cancelling the first hit from that side.
- **R (Glacial Fissure):** Leap-and-slam fissure that knocks up (longer at range) and leaves a slowing field.
- **Rhythm:** Q about 8-6 s, W 12-8 s, E 16-8 s, R 130-100 s. The shield's long cooldown at low rank makes him pick his moments, then ranks make it nearly a constant.
- **Loop:** Slow with Q, land the first hit so the passive starts, use E to catch the answer, and ultimate to hold the opponent for the last stacks.
- **Decision:** Spend E to absorb an expected attack, or spend it to move at the speed bonus and close in; he cannot do both and the arc points only one way.
- **Counterplay:** Attack from outside the arc, go around it, or bait the shield and hit after it ends; the stack passive resets if the fight is paused for a few seconds.
- **Mastery:** Keeping the wall between himself and a known skillshot while still stacking, and aiming the ultimate so the knockup is long.
- **For a duel:** The passive only reaches its stun quickly with allies, so alone Braum is a slow, defensive stacker. The directional wall, though, is a great duel tool: the opponent can read it and flank. [partly]

### Briar, the Restrained Hunger
Diver · melee · rage · 2023 · last rework: none

- **P (Crimson Curse):** Her attacks and spells cause a bleed that stacks and heals her, more the lower her health; she has no natural regeneration.
- **Q (Head Rush):** Targeted dash with a brief stun and armor shred; costs a slice of current health.
- **W (Blood Frenzy / Snack Attack):** Dash that, if an enemy is near, puts her in a frenzy where she cannot steer or pick targets; she automatically attacks the nearest enemy, with speed and a strong follow-up hit.
- **E (Chilling Scream):** A channel that cuts damage while she charges, then a scream: a slow, or a knockback that stuns on terrain if fully charged. It also ends the frenzy.
- **R (Certain Death):** Throws a marker that reveals the first champion hit; she dashes to them, fears others, and locks into a frenzy on that one target.
- **Rhythm:** Q about 13-9 s, W 14-10 s, E 16 s at all ranks, R 120-80 s. Every ability costs health, so cooldowns are a budget as well as a clock.
- **Loop:** Q onto a target to stun, W to enter the frenzy, ride the auto-attacks, and E to leave before she dies or is kited.
- **Decision:** Frenzy gives real damage and speed but takes away her control; stay in and bet the opponent cannot kill or kite her, or press E and give up the damage. The cost to health makes both riskier at low health.
- **Counterplay:** Kite or CC her during the frenzy since she cannot pick another target, bait the ultimate's marker, and stand on terrain to avoid the scream's stun.
- **Mastery:** Placing the W dash so the nearest enemy is the one she wants and ending the frenzy at the last safe moment.
- **For a duel:** Riot's [Champion Insights](https://www.riotgames.com/vi/news/tong-quan-tuong-briar) (as relayed by press coverage; the post itself was not opened) says the frenzy idea began as work for another champion, and the only exit is E. The loss of control is the design's cost, and in a 1v1 it is a clean read. [transfers]

### Caitlyn, the Sheriff of Piltover
Marksman · ranged · mana · 2011 · last rework: 2015 GR

- **P (Headshot):** Her attacks build up to an empowered shot (sooner in brush); trapped or netted enemies give her a free long-range empowered shot.
- **Q (Piltover Peacemaker):** Slow-casting piercing shot with very long range.
- **W (Yordle Snap Trap):** Stored traps she places; the first enemy to step on one is rooted and revealed.
- **E (90 Caliber Net):** A net that slows and throws her backward.
- **R (Ace in the Hole):** Channelled homing shot at a far-away champion, which an ally can block.
- **Rhythm:** Q about 10-6 s, W charges that return every 26-10 s (cast delay about 0.5 s), E 16-8 s, R 90 s at all ranks. Traps are the longest recharge, so they are placed before the fight.
- **Loop:** Lay a trap in the path, net or Q to push the enemy into it, take the free long-range shot at the rooted target, and back away with the net's recoil.
- **Decision:** Spend a trap now to cover a retreat or hold it for a better spot, and spend the net for safety or for the guaranteed shot setup.
- **Counterplay:** Step over traps by watching the arm delay, never walk straight through a known lane, and strike during the Q's wind-up.
- **Mastery:** Pre-placing traps where the opponent habitually walks and stacking trap, net and attack into one chain.
- **For a duel:** Riot's [Marksman Update post](https://archive.runeterra.net/na/developer-corner/1YZMAzz0) frames the later trap and Headshot changes. A zone-control marksman is good in a duel; the ultimate would be too long a channel without cover. [transfers]

### Camille, the Steel Shadow
Diver · melee · mana · 2016 · last rework: none

- **P (Adaptive Defenses):** Every so often her first landed attack on a champion gives a short shield against whichever damage type that champion has dealt most.
- **Q (Precision Protocol):** Empowered attack with a speed boost; a recast after a short wait gives a much bigger hit with part of it as true damage.
- **W (Tactical Sweep):** Delayed cone sweep; only the outer edge slows, adds percent-health damage and heals her.
- **E (Hookshot):** A grapple to the first wall, then a second dash from it toward a target; hitting a champion stuns.
- **R (The Hextech Ultimatum):** Dive onto one champion that traps them inside a hex zone for a few seconds.
- **Rhythm:** Q about 9-5 s, W 12-10 s, E 16-12 s, R 140-90 s. The Q recast has its own clock inside the cooldown: a quick recast is the minimum, a late one is worth far more.
- **Loop:** Grapple to a wall, dive at the enemy with the second dash (stun on contact), hit with the late Q, sweep so the outer edge slows and heals, and the ultimate keeps them inside the hex.
- **Decision:** Recast Q straight away for the speed and the safe hit, or wait the extra moment for double bonus damage and true damage while the opponent is free to hit her or step back. Waiting pays more, but it is the moment she is most exposed.
- **Counterplay:** Fight away from walls, since her gap-closer needs one; sidestep the sweep during its long windup and stay in its inner half; leave the hex only by killing her or waiting it out, so avoid trading there when low.
- **Mastery:** Picking the wall that gives a long second dash, aiming the sweep so the outer edge catches the target, and timing the recast to the opponent's own attack.
- **For a duel:** Arena cover is her launch pad, and the hex makes a duel inside a duel. Her own power depends on terrain, so map design decides her strength. [transfers]

### Cassiopeia, the Serpent's Embrace
Battlemage · ranged · mana · 2010 · last rework: 2016 GR

- **P (Serpentine Grace):** All movement speed bonuses are stronger on her.
- **Q (Noxious Blast):** Delayed poison circle that deals damage over time and, if it hits a champion, gives her a decaying speed burst.
- **W (Miasma):** Ring of poison clouds that ground and slow, the slow growing weaker over time.
- **E (Twin Fang):** Targeted fang with a tiny cooldown; far stronger on poisoned targets and heals her.
- **R (Petrifying Gaze):** A cone after a short windup: enemies facing her are stunned, those looking away are only slowed.
- **Rhythm:** Q 3.5 s at all ranks, W 24-16 s, E 0.75 s at all ranks, R 120-80 s. Q and E barely have cooldowns, so mana is her real limit and W and R are the only moments of choice.
- **Loop:** Q to poison and speed up, E over and over while walking (her movement is not interrupted), W to pin them where they stand, R when they are looking at her.
- **Decision:** Keep pouring E on a poisoned target and drain mana, or stop casting to save mana and walk; also, whether to hold R until the enemy faces her for a stun, or fire it early for a slow and damage.
- **Counterplay:** The Q has a short delay so move off the circle; turn away from the cone (it costs them facing the fight); stay out of the W cloud, which can't be cleansed away; make her run out of mana.
- **Mastery:** Moving in an unpredictable line so Q lands, never pausing between fangs, and baiting a turn to face her before the ultimate.
- **For a duel:** The stun that depends on where the enemy looks is a strong 1v1 idea: it rewards the victim for looking away and costs them. Riot's old design posts live in [the archived rework thread](https://archive.runeterra.net/na/gameplay-balance/MgsgckKA); no Riot text found on the 2016 changes, so the rest is analysis. [transfers]

### Cho'Gath, the Terror of the Void
Specialist · melee · mana · 2009 · last rework: none

- **P (Carnivore):** Kills give him a little health and mana, small but constant.
- **Q (Rupture):** Delayed ground circle: an airborne moment, then a heavy slow on landing.
- **W (Feral Scream):** Cone roar with damage and a silence on champions.
- **E (Vorpal Spikes):** Next three attacks gain range and fire spikes that slow and take a percentage of max health.
- **R (Feast):** Eats one champion for true damage; a kill permanently adds health, size and reach, with no ceiling.
- **Rhythm:** Q 6 s at all ranks, W 11-9 s, E 8-4 s, R 80-60 s. Q is the one that stays, and E speeds up the most, so at high rank he has spikes up almost all the time and Feast is the single deadline in a fight.
- **Loop:** Q placed where the enemy will be, so the knockup is followed at once by the slow, W to silence a caster or stop an escape spell, E to chase with extended range, and R the moment his health pool and the target's health line up.
- **Decision:** Throw Q on a guess and eat a 6-second window with no hard control, or walk the opponent into a spot first. He can also poke with spikes for percent damage or hold everything to land a Feast kill, which is also the only way he grows.
- **Counterplay:** The Q circle appears and lasts about 0.6 s, so step out; stay out of the cone; and the execute marker means the opponent should keep health above Feast's threshold, using shields only for effect since Feast goes through them.
- **Mastery:** Predicting the knockup on a fleeing target, and using the execute threshold as a timer on when to commit.
- **For a duel:** Lasting growth from kills is a snowball that only works if rounds persist or a kill is a big event. In a round-based duel the growth would need a different carrier. Without Riot text on the kit, this is analysis, not from Riot. [partly]

### Corki, the Daring Bombardier
Marksman · ranged · mana · 2009 · last rework: 2024 GR

- **P (Hextech Munitions):** Every basic attack carries a slice of true damage (about a fifth of his AD), so armor never fully stops him.
- **Q (Phosphorus Bomb):** Lobbed bomb at a ground point; small blast, reveals those it hits and gives vision of the area.
- **W (Valkyrie):** Short dash that leaves up to three fire patches behind him, longer dash, more patches; he can fire the E mid-dash.
- **E (Gatling Gun):** A 4-second forward cone that ticks fast and stacks an armor and magic-resist shred, maxed in about 1 s.
- **R (Missile Barrage):** Ammo-based missile skillshot; every third missile is a larger, longer Big One. Hits with basic attacks refill ammo faster.
- **Rhythm:** about Q 9-7 s, W 20-12 s (shorter in Arena), E 12 s flat, R 2 s between shots with a 20 s charge recharge. Q and E are almost always available, so the real rationing is W and missile ammo.
- **Loop:** Poke with Q and missiles from range, then dash in with W and hold the cone on the target while hitting it with basic attacks. Each basic attack on a champion pays back missile ammo, so melee-range fighting feeds the ranged poke.
- **Decision:** Spend W as a gap-closer to start the cone and burst, or keep it as the escape and let the opponent push him. Hold missiles for the Big One on every third shot, or fire early for pressure; both lose tempo.
- **Counterplay:** The cone locks Corki facing one direction for 4 s, so walking out of the 35-degree arc or sidestepping a Q bomb (0.25 s cast, slow flight) answers him. Blocks stop Q and R but not E or the fire patches.
- **Mastery:** Counting the Big One, weaving attacks between cone ticks, and laying the W patches across the opponent's retreat path.
- **For a duel:** Ammo missiles with a built-in "every third shot is special" counter give a readable rhythm, and shred plus true damage keep armor from deciding fights. His cone is strong but telegraphs where he cannot turn. Riot's own writing on the 2024 rework was not found; coverage found was second-hand, so the intent is unsourced. [transfers]

### Darius, the Hand of Noxus
Juggernaut · melee · mana · 2012 · last rework: 2015 GR

- **P (Hemorrhage):** Attacks and damaging spells add bleed stacks (up to 5, 5 s). Reaching five stacks, or a Guillotine kill, grants a short Noxian Might power-up.
- **Q (Decimate):** Winding-up axe spin around him; the rim hits harder and heals him, the handle (inner ring) hits less, no stack.
- **W (Crippling Strike):** Next attack has a longer reach, heavy bonus damage and a near-total slow for 1 s; a kill halves its cooldown and refunds mana.
- **E (Apprehend):** Cone sweep that yanks enemies in to him and briefly slows them; passively, his physical damage ignores part of the target's armor.
- **R (Noxian Guillotine):** Targeted leap that deals true damage scaled by the target's bleed stacks; if it kills, a free recast window opens and the cooldown can reset.
- **Rhythm:** about Q 9-4 s, W 5 s flat, E 26-16 s, R 120-80 s (a kill resets it at max rank). W is nearly always up, so E is his true commit.
- **Loop:** Close with E or W's slow, spin Q so the rim, not the handle, hits, reach five stacks, then Guillotine the target. A kill hands back the cooldown and the cycle repeats.
- **Decision:** Fire R early at low stacks for safety, or wait for five stacks to maximize the execute; the first gives the opponent a way back, the second gives them time to run.
- **Counterplay:** Stay at the handle distance of Q, and punish the Q wind-up and E's 0.25 s cast. Spell shields eat the whole of W and R. Stay out of reach until stacks fall off after 5 s.
- **Mastery:** Placing Q so the rim hits, then threading W and basic attacks to keep stacks refreshed before R.
- **For a duel:** Stacks that raise the finisher's damage make "chase or reset" a clear, readable fight; the free recast is strong snowballing and could be dull when he wins. Riot's design writing was not found. [transfers]

### Diana, Scorn of the Moon
Assassin, Diver · melee · mana · 2012 · last rework: 2019 VG

- **P (Moonsilver Blade):** Fast attack speed that triples after any spell; two hits stack the passive, then the third attack cleaves for magic damage around the target.
- **Q (Crescent Strike):** Curved bolt on a counter-clockwise arc that explodes at a point; hit enemies are marked with Moonlight (revealed 3 s).
- **W (Pale Cascade):** Shield plus three orbiting orbs that explode on enemies; all three popping adds a second shield.
- **E (Lunar Rush):** Dash to an enemy; if that target (or any marked enemy) has Moonlight, the cooldown nearly drops to zero, so she can repeat.
- **R (Moonfall):** Pulls nearby enemies to her, then after a moment a beam crashes down for damage that grows with the number pulled.
- **Rhythm:** about Q 8-6 s, W 15-9 s, E 22-14 s (near zero when marked), R 100-80 s. Q is the key that turns the long E into a short one.
- **Loop:** Q to mark, E to land on the mark, W for the orb burst, ult pulls them into the beam, finish with fast attacks. A death or kill on a marked target can reset E.
- **Decision:** Spend Q to chase for a reset, or hold Q so E can still escape when the Q misses.
- **Counterplay:** Q's arc is awkward to read but it has a visible 0.25 s cast and a bolt that spell shields block. The R pull has a 1 s delay before the beam, so walking away from the centre or stunning her out of cast cancels it.
- **Mastery:** Chaining several E dashes off a single Q, and timing W's orbs so that the second shield arrives with R.
- **For a duel:** Marks that refund a dash are the best part of the kit; the combo fits 1v1 well. The 2019 update changed her passive and swapped E and R, per [Riot's patch coverage](https://archive.runeterra.net/na/gameplay-balance/ro9fzR9K). [transfers]

### Dr. Mundo, the Madman of Zaun
Juggernaut · melee · health · 2009 · last rework: 2021 VG

- **P (Goes Where He Pleases):** Extra max-health regeneration and a periodic immunity to the next immobilize, which costs health, spawns a canister that Mundo can walk onto to heal and speed the passive's recharge.
- **Q (Infected Bonesaw):** Thrown cleaver (a long, fast line) dealing damage as a share of the target's current health, with a slow; the health cost is repaid in full on a champion hit.
- **W (Heart Zapper):** Charged zapper aura that stores part of incoming damage; a recast (or auto-expiry) detonates it and heals from the stored amount.
- **E (Blunt Force Trauma):** Passive bonus attack damage from max health; active empowered attack with a lunge reach that gets stronger as he gets hurt.
- **R (Maximum Dosage):** Ten seconds: an instant heal of part of his missing health, then bonus speed and health regeneration over the duration.
- **Rhythm:** about Q 4 s flat, W 17-15 s, E 9-6 s, R 120 s flat; the passive immunity cooldown runs 60-15 s. Q is spammable, which creates a constant "pay health to keep damage up" tempo.
- **Loop:** Hit Q to slow, move in, pop W so it stores damage, hit the empowered E attack, then detonate W for the heal. R when health runs low for a longer, tougher finish.
- **Decision:** Spend health on Q and E to stay threatening, or hold back to keep a buffer; every cast is a trade of health for damage.
- **Counterplay:** Dodge the cleaver, since all of Mundo's pressure sits behind the first Q. Chain CC only after the immobilize passive is spent, burst him when W is not charged, and cut healing.
- **Mastery:** Keeping W charged through a fight so that the final blow heals the most, and walking over canisters.
- **For a duel:** Health-as-resource with refunds is rare and gives a clear risk loop; the kit is simple but can feel unkillable. Riot's goals for the update are in [the kickoff dev blog](https://www.leagueoflegends.com/en-us/news/dev/dev-kicking-off-dr-mundo-s-vgu/) and [the progress post](https://www.leagueoflegends.com/en-us/news/dev/dev-the-latest-on-dr-mundo-s-vgu/): more counterplay and variety, and very hard to lock down. [transfers]

### Draven, the Glorious Executioner
Marksman · ranged · mana · 2012 · last rework: none

- **P (League of Draven):** Collecting axes and killing minions builds Adoration stacks, banked for gold on a champion kill; half is lost on death. The stack count is also the R execute threshold.
- **Q (Spinning Axe):** Next attack throws an empowered axe that bounces off the target and lands near him (ahead if moving, back if still). Catching it re-arms Q, and he can juggle two.
- **W (Blood Rush):** Burst of attack speed and fading ghosted move speed; catching an axe resets the cooldown.
- **E (Stand Aside):** Fan of axes that knocks the first line of enemies airborne with a slow.
- **R (Whirling Death):** Global double axe that returns on recast; damages enemies and executes champions under the stack threshold.
- **Rhythm:** about Q 12-8 s, W 12 s flat, E 16-12 s, R 100-80 s. Axes are the real cooldown: each catch refunds W.
- **Loop:** Throw an axe attack, step to where it lands, catch it, W for speed, attack again; E when the opponent wants to escape, R to finish across the map.
- **Decision:** Move toward the opponent to land the axe in a useful spot but risk exposure, or catch it safely and give ground. Fire R as a long-range kill, or recall it for the second hit.
- **Counterplay:** Axes land after about 1.4 s and wind walls or Blade Whirl-type blocks destroy them. The E has a visible fan and 0.25 s cast; dodging it removes his lockdown.
- **Mastery:** Placing axes by moving and not by clicking, sustaining two, and recalling R only when it re-hits.
- **For a duel:** Movement that sets up the next attack is the best idea here; Adoration is pure meta-progress and does not fit a short round. [transfers]

### Ekko, the Boy Who Shattered Time
Assassin · melee · mana · 2015 · last rework: none

- **P (Z-Drive Resonance):** Three attacks or damaging abilities on one target (4 s window) pop a burst of magic damage and speed Ekko up.
- **Q (Timewinder):** Throws a boomerang grenade that pauses as a slow field at the end of its path and returns for a second hit.
- **W (Parallel Convergence):** Marks a distant spot; after a delay a bubble forms, and stepping into it detonates a stun and a shield. Passive adds execution damage to low-health targets.
- **E (Phase Dive):** Short dash; his next attack blinks him onto the target for a magic damage bonus.
- **R (Chronobreak):** Rewinds him to his position 4 seconds ago, healing more the more health he lost, with a damage burst at the destination.
- **Rhythm:** about Q 9-7 s, W 22-14 s, E 9-7 s, R 110-50 s. Q and E are cheap and frequent; W is the timer on which each fight pivots.
- **Loop:** Q slows, E blinks in on an attack, passive pops, W ties them down while he is inside the bubble, then R either finishes or retreats.
- **Decision:** Put Q on the opponent now for damage, or save it so W's bubble has time to connect; and use R as a kill burst or an escape from the position he was in.
- **Counterplay:** W's marker becomes visible after 2 s and the bubble takes over a second to form; leave its radius or break line. The R ghost shows exactly where he will land, and nearby players can stand there. Dodge Q's return, and avoid being on that spot.
- **Mastery:** Placing W where the enemy must walk, baiting R with early damage, and walking through places that make the 4-second-old ghost land somewhere safe or on top of the opponent.
- **For a duel:** A telegraphed ghost of where he was is a lovely readable tell; the passive and execute damage are standard. [transfers]

### Elise, the Spider Queen
Diver · ranged/melee · mana · 2012 · last rework: none

- **P (Spider Queen):** Human-form ability hits bank dormant spiderlings (a cap that grows with rank); spider-form attacks add damage and heal her.
- **Q (Neurotoxin / Venomous Bite):** Human: a ranged poison bolt that scales with the target's current health. Spider: a pounce that scales with missing health, and the spiderlings jump with her.
- **W (Volatile Spiderling / Skittering Frenzy):** Human: a chasing spiderling that explodes on contact. Spider: an attack-speed burst for her and the spiderlings.
- **E (Cocoon / Rappel):** Human: a skillshot web that stuns and reveals. Spider: a rappel, a short vanish then a drop onto a target or spot.
- **R (Spider Form):** Swaps form, at a flat 3 s cooldown.
- **Rhythm:** human cooldowns are roughly Q 6, W 12, E 12-10 s; spider Q 6, W 6, E 22-18 s; the form swap is 3 s. Because the two sets run on separate clocks, a spent human E is not a spent kit: she swaps and has the spider set fresh.
- **Loop:** poke and web in human form, swap on the stun, pounce and rappel in spider form, swap back as the human cooldowns return.
- **Decision:** when to swap. Each swap is a bet that the other form's cooldowns are worth more than the current form's.
- **Counterplay:** the web is the one skillshot that matters. Dodge it and her human form has nothing to hold you. In spider form she is melee, so you can kite her until the rappel is spent.
- **Mastery:** swap timing and pre-casting the web so the pounce lands inside the stun.
- **For a duel:** two cooldown sets in one body is a strong way to make a kit feel busy without more buttons, and in a 1v1 the opponent can read which set is ready. The web-then-pounce combo is easy to learn. [transfers]

### Evelynn, Agony's Embrace
Assassin · melee · mana · 2009 · last rework: 2017 VG

- **P (Demon Shade):** Goes invisible after a few seconds without acting. Attacking, casting, or taking champion damage breaks it. A cast of her ultimate shortens the wait to return; low on health she heals, and from level 6 the stealth becomes camouflage.
- **Q (Hate Spike):** A dart that marks the target, then up to three free recasts that fire a spike line. Marked targets take bonus damage from her next hits.
- **W (Allure):** Curses a target. Her next hit or spell slows them and refunds mana. If the curse has ripened about 2.5 s, it also charms.
- **E (Whiplash):** A whip based on max health. Empowered after she re-enters stealth: it dashes to the target.
- **R (Last Caress):** Untargetable for a moment, a cone of damage that executes low-health enemies harder, then a blink backward.
- **Rhythm:** Q 4 s flat, W 15-11 s, E 8 s flat, R 120-80 s. Her only long windows are the charm and the ultimate; the rest is a short-cooldown poke loop.
- **Loop:** stay hidden, mark, wait for the charm to ripen, then burst and leave through the ultimate's backward blink.
- **Decision:** cast the curse early and wait for the charm, or burst with the slow now.
- **Counterplay:** being seen is the counter. She wants to open on someone who cannot see her. In a duel with sight, the 2.5 s ripening is a warning, and the charm can be spell-shielded.
- **Mastery:** holding the curse until it ripens, and spending the ultimate as an escape rather than only a finisher.
- **For a duel:** stealth is only a kit if the opponent cannot always see you; a duel with open cover needs vision rules first. Riot framed the 2017 update as a modernisation ([source](https://www.surrenderat20.net/2017/10/red-post-collection-evelynn-ama-league.html), a forwarded dev AMA), and the ripening charm is a clean "wait or act" choice. [partly]

### Ezreal, the Prodigal Explorer
Marksman · ranged · mana · 2010 · last rework: 2018 VG

- **P (Rising Spell Force):** Every ability hit stacks attack speed for a few seconds.
- **Q (Mystic Shot):** A bolt that trims the cooldown of all his abilities on hit.
- **W (Essence Flux):** An orb that marks the first champion; his next hit or spell pops the mark, and an ability pop returns mana.
- **E (Arcane Shift):** A short blink, then a homing bolt at the nearest enemy, preferring marked ones.
- **R (Trueshot Barrage):** A huge-range arc skillshot with long travel, hitting everything in its path.
- **Rhythm:** Q 5.5-4.5 s, W 8 s flat, E 26-14 s, R 120-90 s. A hit on Q shaves 1.5 s from the others, so a fight of landed Qs turns his E from a rare escape into a regular one.
- **Loop:** Q, then W mark, then Q to pop, E to reposition while the homing bolt finishes the job.
- **Decision:** when to spend the escape. Every other button is spam; E is the only one with a price.
- **Counterplay:** Q and W are straight skillshots. Walk off the line and he runs dry, and he has no stop of his own.
- **Mastery:** hitting Q on a moving target, which compounds the entire kit.
- **For a duel:** a hit refunds cooldowns, so skill directly buys more tools. This rewards aim rather than reaction. The 2018 update changed the look and one ability, per coverage of Riot's announcement ([source](https://www.surrenderat20.net/2018/10/ezreal-champion-update-in-820.html)). [transfers]

### Fiddlesticks, the Ancient Fear
Specialist · ranged · mana · 2009 · last rework: 2020 VG

- **P (A Harmless Scarecrow):** Standing still for about 2 s makes him a scarecrow that enemies cannot tell from a decoy.
- **Q (Terrify):** A crow lands after a short delay, fears and slows, and deals extra damage to targets he already scared.
- **W (Bountiful Harvest):** A tether and a channel that drains health and reveals the targets; completing it refunds much of the cooldown.
- **E (Reap):** An area slash that slows, and silences at the centre.
- **R (Crowstorm):** A channel, then a blink to the spot, followed by about 5 s of crows damaging everyone near.
- **Rhythm:** Q 15-13 s, W 10-8 s, E 10-6 s, R 140-80 s. The long cooldowns are the fear and the ultimate, and the W refund rewards finishing a channel.
- **Loop:** hide, fear, silence, channel, then drop the ultimate as a zone.
- **Decision:** to risk the channel or hold it, because an interrupt costs the refund and the tether is the only time he is exposed.
- **Counterplay:** the scarecrow and the ultimate's 1.5 s channel are both tells. Look for the idle dummy; step out of the blink zone before it starts.
- **Mastery:** ambushing out of the scarecrow, and sequencing fear into the channel.
- **For a duel:** Riot's stated aim was to make him the most frightening champion ([source](https://nexus.leagueoflegends.com/en-us/2019/07/fiddlesticks-and-volibear-dev-update-1/)). Fear plus ambush is mostly an information game; with no fog of war on a small arena, the decoy has little to hide in. [partly]

### Fiora, the Grand Duelist
Skirmisher · melee · mana · 2012 · last rework: 2015 VG

- **P (Duelist's Dance):** Enemy champions show a weak spot in one of four directions; hitting it from that side deals extra max-health true damage, heals, and gives a burst of speed.
- **Q (Lunge):** A dash to the target; stabbing a target halves the cooldown.
- **W (Riposte):** A short parry that blocks an incoming hit and its effects, then lashes back with a slow, or a stun if she parried a hard crowd control.
- **E (Bladework):** Empowers her next two hits: the first slows, the second crits.
- **R (Grand Challenge):** Reveals all four weak spots on one enemy for a few seconds; a hit on at least one before they die creates a healing zone.
- **Rhythm:** Q 13-6 s, W 24-16 s, E 11-7 s, R 110-70 s. W is her long-cooldown answer and the opponent has to guess when it is up.
- **Loop:** dash to the side the weak spot is on, strike it, run in with E for the two-hit sequence, hold W for the opponent's best spell.
- **Decision:** the angle of the dash and whether to burn W now.
- **Counterplay:** bait the parry with a harmless spell, then use the real one; or keep moving so the weak spot flips direction. Her parry window is short.
- **Mastery:** reading what the opponent will press so the parry catches the key spell.
- **For a duel:** this is the best match in the batch. The directional weak spot makes every trade positional, and the parry is a mind game. Riot's 2015 update traded raw damage for survivability ([source](https://www.surrenderat20.net/2015/07/champion-update-fiora.html)). [transfers]

### Fizz, the Tidal Trickster
Assassin · melee · mana · 2011 · last rework: none

- **P (Nimble Fighter):** Walks through units and shrugs off a small amount from every hit.
- **Q (Urchin Strike):** A dash through the target that also hits on contact and triggers a basic attack.
- **W (Seastone Trident):** Passive bleed; active empowers his next attack, and a kill refunds it almost completely.
- **E (Playful / Trickster):** A leap that makes him untargetable for about 0.75 s on landing, with a second option to jump again after a very short delay.
- **R (Chum the Waters):** A thrown lure whose shark grows with the distance; it can stick to the first champion it touches, and it knocks up the lured champion, knocks nearby enemies aside and slows.
- **Rhythm:** Q 8-6 s, W 7-3 s, E 16-8 s, R 120-80 s. The long E is the game: each time it is up, he can dodge a spell.
- **Loop:** dash in, empower, dodge the answer with E, finish with the shark.
- **Decision:** spend the E to escape or to dodge a spell; the shark's range sets how much damage it gives up for reach.
- **Counterplay:** the E has an untargetable gap you can wait out, and a long fuse on the shark lets you move out of it.
- **Mastery:** using the untargetable window to dodge the opponent's main spell, not just walk away.
- **For a duel:** a button whose entire value is the moment it dodges something is a rich fight to read. The shark's size-by-distance is a neat risk-for-reward knob. [transfers]

### Galio, the Colossus
Warden · melee · mana · 2010 · last rework: 2017 VG

- **P (Colossal Smash):** A periodic empowered hit that splashes magic damage; spells shave its cooldown.
- **Q (Winds of War):** Two curved winds converge on a spot and leave a tornado that deals max-health damage.
- **W (Shield of Durand):** A magic shield passively; hold to charge a damage reduction, then release a taunt whose range and length grow with the charge.
- **E (Justice Punch):** A short backstep and then a dash that knocks up the first champion on the path and stops at terrain.
- **R (Hero's Entrance):** A long channel that picks an ally's position; Galio then leaps there as untargetable and knocks enemies up.
- **Rhythm:** Q 11-7 s, W 18-14 s, E 11-7 s, R 180-140 s. The ultimate depends on allies, so in a solo duel it has no target.
- **Loop:** charge W while approaching, taunt, then punch through the taunted enemy with E and keep the passive hit rolling.
- **Decision:** how long to charge W, which trades safety against a bigger taunt.
- **Counterplay:** the charge is visible and slows him, so an approaching Galio can be kited. The taunt only reaches close targets.
- **Mastery:** judging the taunt radius against the dash.
- **For a duel:** the charge-to-commit choice works; the ultimate is [5v5 only], and no Riot writing was found, only forwarded coverage ([source](https://www.surrenderat20.net/2017/03/galio-champion-update.html)). The wiki lists the ultimate as ally-targeted. [partly]

### Gangplank, the Saltwater Scourge
Specialist · melee · mana · 2009 · last rework: 2015 VG

- **P (Trial by Fire):** Every 15 s, a hit ignites the target for true damage and gives speed; keg explosions reset it.
- **Q (Parrrley):** A pistol shot that applies on-hit effects.
- **W (Remove Scurvy):** Cleanse and a heal that grows with missing health.
- **E (Powder Keg):** Place a keg and detonate it with an attack. Nearby kegs chain. They restock slowly and cap at a maximum.
- **R (Cannon Barrage):** A cannon barrage anywhere on the map, hitting in waves with a slow.
- **Rhythm:** Q 4.5 s flat, W 22-14 s, E restock 17-13 s per keg, R 160-120 s. Kegs are an ammo count: the time between restocks is when he is weakest.
- **Loop:** place two kegs, shoot one, chain the second as the opponent steps in, then fire the barrage across the exit.
- **Decision:** where to put the kegs, and whether to spend the last charge now.
- **Counterplay:** a keg is a visible object with a visible fuse, so you can avoid its area or attack it yourself; he is thin when out of kegs.
- **Mastery:** laying a chain that the opponent cannot see until it triggers.
- **For a duel:** placed objects that the opponent can see and also attack are great duel material, because they turn the arena into a puzzle. The cannon is global, so it shrinks to a zone on a small map. [transfers]

### Garen, the Might of Demacia
Juggernaut · melee · none · 2010 · last rework: 2015 GR

- **P (Perseverance):** Out of combat for 8 s he regenerates fast; any damage from a champion stops it.
- **Q (Decisive Strike):** Speed burst, cleanses slows, and his next hit lunges and silences.
- **W (Courage):** Passive stacking resistances for kills; active reduces damage with a brief shield.
- **E (Judgment):** Spins his sword for about 3 s of damage in an area while he cannot attack; recasting ends it.
- **R (Demacian Justice):** A targeted finisher that deals true damage scaled by the target's missing health.
- **Rhythm:** Q 8 s flat, W 22-12 s, E 9-6 s, R 120-80 s. The ultimate arrives every other fight.
- **Loop:** Q to catch and silence, spin while the opponent cannot cast, wait for the execute threshold, then press R.
- **Decision:** when to end the spin early and press R.
- **Counterplay:** the silence is what wins the exchange, so avoid it by moving out of range or cleansing; he has no ranged tool.
- **Mastery:** knowing exactly when the ultimate kills.
- **For a duel:** simple on purpose. The ultimate scales with missing health, which makes the last few seconds of a duel a clean threshold. Weakness: very few decisions. [transfers]

### Gnar, the Missing Link
Specialist · ranged/melee · rage · 2014 · last rework: none

- **P (Rage Gene):** Rage builds from fighting; at full rage he transforms into Mega Gnar for 15 s, then is too tired to gain rage for 15 s. Hits stack a mark that bursts on the third.
- **Q (Boomerang Throw / Boulder Toss):** Mini: a returning boomerang that slows. Mega: a boulder toss you can pick up.
- **W (Hyper / Wallop):** Mini: his attacks and spells hype him for bonus damage and speed. Mega: a wide slam that stuns.
- **E (Hop / Crunch):** Mini: a hop that bounces off enemies. Mega: a leap with a delayed shockwave.
- **R (GNAR!):** Mega only: a knock into terrain for a stun.
- **Rhythm:** Q 16-10 s, Mega W 7 s, E 22-12 s, R 90-30 s. Cooldowns are shared across forms, so what he threw as Mini is not back as Mega.
- **Loop:** poke from range, build rage, enter Mega at a wall and land the stun.
- **Decision:** when to let the form change happen. Casting at full rage transforms at once; waiting gives a short window.
- **Counterplay:** the change is announced by the rage bar and a warning pause, so retreat or save your escape. During the tired period he is weak.
- **Mastery:** positioning at a wall for the Mega ultimate.
- **For a duel:** Riot said it wanted strengths and weaknesses in both forms with limited control over the swap ([source](https://www.surrenderat20.net/2014/07/gnar-missing-link-revealed.html)). The wiki mislabels some keys; slots are mapped by what each ability does. The forced swap works in a 1v1 where the opponent can read the bar. [transfers]

### Gragas, the Rabble Rouser
Vanguard · melee · mana · 2010 · last rework: 2014 GR

- **P (Happy Hour):** After casting, a heal of a slice of max health on a short cooldown.
- **Q (Barrel Roll):** A cask rolled to a spot that ferments and grows stronger; recasting pops it.
- **W (Drunken Rage):** A short channel that reduces damage, and a next attack with bonus range and max-health damage.
- **E (Body Slam):** A body-slam dash that stops at the first enemy, stuns, and refunds some cooldown on hit.
- **R (Explosive Cask):** A thrown cask that knocks enemies away from the centre, which can push them out or toward a wall.
- **Rhythm:** Q 10-6 s, W 5 s flat, E 14-12 s, R 100-70 s. The W is cheap, so he always has something to press.
- **Loop:** drop the Q where the opponent will stand, stun with E, pop Q on the stun, finish with the empowered hit.
- **Decision:** pop the cask early for a weak slow or late for a strong one; use the ultimate as damage or as a shove.
- **Counterplay:** the Q lingers and can be seen; the stun needs a straight line.
- **Mastery:** the pop timing, and using R to move opponents rather than hurt them.
- **For a duel:** the cask that grows stronger with time is a good model for delayed payoff. A kit built around knocking enemies is easy to learn and tricky to use well. [transfers]

### Graves, the Outlaw
Specialist · ranged · mana · 2011 · last rework: 2015 GR

- **P (New Destiny):** His attacks fire a cone of pellets from a two-shell magazine; hitting from close range deals much more. Reloading takes about 2 s.
- **Q (End of the Line):** A shot that stops on terrain or after about 2 s, then explodes along its path.
- **W (Smoke Screen):** A smoke that slows, damages, and blinds enemies inside.
- **E (Quickdraw):** A dash that reloads one shell and gives defensive stacks; each pellet that hits reduces its cooldown.
- **R (Collateral Damage):** A recoil backward and a shell that explodes in a cone.
- **Rhythm:** Q 13-6 s, W 26-18 s, E 16-12 s, R 100-60 s. The magazine, not a timer, is the clock: two shots, then a pause.
- **Loop:** dash in, fire both shells point blank, use the recoil of R or E to leave, reload.
- **Decision:** whether to dash toward the opponent to get both shells to hit.
- **Counterplay:** after two shots he is empty for about 2 s, so that is when to hit him. Smoke lets you disengage.
- **Mastery:** landing all pellets and chaining E to reload while staying alive.
- **For a duel:** a magazine that must be reloaded gives the opponent a visible opening. Close range as the reward makes him a great duel pattern. [transfers]

### Gwen, the Hallowed Seamstress
Skirmisher · melee · mana · 2021 · last rework: none

- **P (A Thousand Cuts):** Her hits and spells deal extra max-health magic damage and heal her.
- **Q (Snip Snip!):** A cone of snips; each stack from her hits adds snips, and the centre turns into true damage.
- **W (Hallowed Mist):** A mist at her feet where she is untargetable to anyone outside it; she can move it once.
- **E (Skip 'n Slash):** A dash that empowers her hits with range and speed, and a first hit refunds cooldown.
- **R (Needlework):** A needle line with a slow; recasts fire three then five needles, and each recast needs a hit or snip.
- **Rhythm:** Q 6.5-3.5 s, W 22-18 s, E 13-11 s, R 120-80 s. The shortest Q at max rank means she is attacking continuously.
- **Loop:** hit to stack, snip the stack, dash to empower, recast the ultimate between hits.
- **Decision:** where and when to drop the mist.
- **Counterplay:** the mist is a zone, so step out and it empties of targets. Her kit relies on staying in range.
- **Mastery:** placing the mist so the single move catches a fleeing enemy.
- **For a duel:** Riot said enemies could simply leave the zone, and the fix was letting her move it once ([source](https://dotesports.com/?p=379693), secondhand). Untargetable-from-outside zones are a strong duel tool because the zone is the whole fight. [transfers]

### Hecarim, the Shadow of War
Diver · melee · mana · 2012 · last rework: none

- **P (Warpath):** His attack damage grows with his bonus movement speed.
- **Q (Rampage):** A cleave around him; each enemy hit stacks a damage bonus and shortens the cooldown.
- **W (Spirit of Dread):** An aura that damages those near him and heals him from the damage.
- **E (Devastating Charge):** Ghosted speed, then a charge in his next attack that scales with distance and knocks back.
- **R (Onslaught of Shadows):** A long dash with spectral riders; on arrival, a fear whose length grows with the distance.
- **Rhythm:** Q 4 s base, W 14 s flat, E 20-16 s, R 140-100 s. The page lists Q's cooldown falling to about 1.75 s at three stacks.
- **Loop:** gather speed with E, charge in, cleave on stacks, fear with R.
- **Decision:** how far to run before the charge, since distance pays out damage and fear length.
- **Counterplay:** he runs at you in a straight line, so sidestep or block; the fear is the real danger if you stand still.
- **Mastery:** making the dash longer for bigger fear.
- **For a duel:** movement speed that becomes damage is a good pattern in an arena where distance matters. Distance-for-reward is easy to read for the opponent. [transfers]

### Heimerdinger, the Revered Inventor
Specialist · ranged · mana · 2009 · last rework: 2013 GR

- **P (Hextech Affinity):** Faster near his turrets.
- **Q (H-28 G Evolution Turret):** Deploys a turret from a limited kit stock; up to three are active.
- **W (Hextech Micro-Rockets):** Five rockets that converge then fan out.
- **E (CH-2 Electron Storm Grenade):** A grenade that slows and stuns at the centre.
- **R (UPGRADE!!!):** A toggle that upgrades his next basic spell into a stronger version at no mana cost.
- **Rhythm:** Q 1 s with a 20 s kit recharge, W 11-7 s, E 11 s flat, R 100-70 s. The long kit recharge means turrets are a budget.
- **Loop:** place turrets at a choke, poke with W, stun with E, upgrade whichever spell fits.
- **Decision:** where to place the turrets, and which spell gets the upgrade.
- **Counterplay:** turrets are objects that can be destroyed or avoided; a rushed upgrade is also visible to the opponent.
- **Mastery:** turret layout that covers the exits.
- **For a duel:** summons that fight for you are good if they can be targeted. Weak point: a kit that needs space to set up is slow in short rounds. [partly]

### Hwei, the Visionary
Artillery · ranged · mana · 2023 · last rework: none

- **P (Signature of the Visionary):** Damaging abilities mark an enemy; a different damaging ability on a marked enemy sets off a delayed explosion on the spot.
- **Q (Subject: Disaster):** A mood toggle. It opens three attacks: a fireball, a delayed lightning strike that punishes isolated or immobile targets, and a line of fissures that slow.
- **W (Subject: Serenity):** A calm mood: a speed path, a growing shield pool, or an empowered set of attacks that restore mana.
- **E (Subject: Torment):** A torment mood: a grin that stuns then fears, an eye that finds and roots the nearest champion, or a jaw that pulls enemies in after a delay.
- **R (Spiraling Despair):** A slow globule; on hit it grows an aura around the victim that reveals them, stacks slows, and bursts.
- **Rhythm:** about Q 10-6 s, W 18-16 s, E 12-10 s, R 120-80 s. Each key is a menu, so the cooldown is spent on the menu pick, not on a fixed spell.
- **Loop:** Open a mood, cast one of three spells, which also spends the mood. Chain different keys so the mark pops, and keep the nine spells for different jobs.
- **Decision:** Which of nine spells fits this exact position, and which key to burn on it.
- **Counterplay:** Every spell is a slow, readable shape. Dodge the second spell of a chain, and punish Hwei while he is inside a mood and cannot use the other keys' menus.
- **Mastery:** Reading which mood the opponent's escape needs, and sequencing mark-then-pop without wasting a key.
- **For a duel:** The two-step input (choose a mood, then the spell) gives depth with only three buttons, but it is a lot of memory and menu time for a short round. In a 1v1 the opponent sees your mood before the spell, which is fair warning. Keep the idea of one key with several outcomes; limit it to two or three. [partly]

### Illaoi, the Kraken Priestess
Juggernaut · melee · mana · 2015 · last rework: none

- **P (Prophet of an Elder God):** Tentacles grow from terrain nearby; they only strike when she casts, and they heal her when they hit a champion.
- **Q (Tentacle Smash):** A slow slam in a direction that also boosts tentacle damage.
- **W (Harsh Lesson):** Her next attack leaps to range and hits for a share of max health, and calls the tentacles in.
- **E (Test of Spirit):** A tendril that rips the target's spirit out and ties it to them; hitting the spirit hurts the owner.
- **R (Leap of Faith):** A big idol slam around her that spawns tentacles under every champion hit and halves W's cooldown.
- **Rhythm:** about Q 10-6 s, W 4 s flat, E 16-12 s, R 120-70 s. W is a short cooldown that rarely rests; the ultimate opens a 8-second window of near-constant W.
- **Loop:** Draw the opponent near tentacles, tie their spirit with E, and hit it while W and Q call in the tentacles.
- **Decision:** Fight near terrain with a tentacle up, or step back and let one grow.
- **Counterplay:** Kill the tentacle (its basic-attack-only weakness), dodge the slow Q and E, and do not stand still inside the ultimate zone.
- **Mastery:** Placing fights where tentacles already stand, and landing E so the spirit is hit by tentacles.
- **For a duel:** The kit makes the map part of the character, which fits an arena with cover very well. The cost is that she is weak where tentacles cannot spawn, so terrain placement must be designed on purpose. [transfers]

### Irelia, the Blade Dancer
Diver · melee · mana · 2010 · last rework: 2018 VG

- **P (Ionian Fervor):** Hits on champions build attack speed stacks; a full stack adds magic damage on attacks. Her marks (from E and R) are what Q feeds on.
- **Q (Bladesurge):** Dashes through a target, heals, and refunds fully on a kill.
- **W (Defiant Dance):** A short channel that cuts damage taken, released as a blade burst that grows with channel time.
- **E (Flawless Duet):** Two blades placed apart that snap together and stun enemies between them.
- **R (Vanguard's Edge):** A barrage that opens a wall of blades around a champion.
- **Rhythm:** about Q 10-6 s, W 20-12 s, E 16-10 s, R 125-85 s. Q is meant to chain, so its real cooldown is set by kills and marks.
- **Loop:** Place E, dash in through a marked target, reset the Q on a kill, and keep dashing in a string.
- **Decision:** Which target to dash through so the string continues and where to end it.
- **Counterplay:** Hold targets away from her so she has no stepping stones, dodge the E in the gap before the blades meet, and punish her after a failed reset.
- **Mastery:** Chaining resets around the opponent's cover in a way that looks like one long dance.
- **For a duel:** Riot's own notes say the team wanted her reset to be easy to use without extreme micro and added an assist for it ([Wild Rift dev post](https://wildrift.leagueoflegends.com/zh-hk/news/dev/dev-irelia-dances-her-way-to-wild-rift), [2018 roadmap](https://nexus.leagueoflegends.com/en-us/2018/01/champion-roadmap-january-2018/)). In a duel with no minions the Q has no stepping stones, so a version needs marks or clones as targets. [partly]

### Ivern, the Green Father
Catcher · ranged · mana · 2016 · last rework: 2023 GR

- **P (Friend of the Forest):** He cannot damage ordinary jungle monsters; he grows a grove over a camp instead and frees it later.
- **Q (Rootcaller):** A vine that roots the first enemy; allies can dash to the rooted target.
- **W (Brushmaker):** Plants brush that grants vision and boosts his attacks and his allies' attacks while inside it.
- **E (Triggerseed):** A shield on an ally or on Daisy that explodes after 2 s to slow enemies near.
- **R (Daisy!):** Summons Daisy, a pet that he commands; three hits on one champion knock up enemies in a line.
- **Rhythm:** about Q 14-10 s, W 20 s per charge, E 11-7 s, R 140-120 s. The pet is a second body on a long timer.
- **Loop:** Root, send Daisy in, shield her or himself to explode and slow, repeat from brush.
- **Decision:** Where Daisy stands and when to spend her three hits.
- **Counterplay:** Dodge the vine, which is slow to arrive; kill or kite Daisy, who is a visible and targetable body.
- **Mastery:** Using Daisy as a second unit with its own cooldown and timing.
- **For a duel:** His passive is entirely jungle-based and has no value in a duel, which makes him a poor template as a whole. The pet with its own three-hit knockup is the transferable idea. Riot confirmed a mid-scope update in 2023, but only press coverage was found, not a Riot post, so the intent is not sourced. [partly]

### Janna, the Storm's Fury
Enchanter · ranged · mana · 2009 · last rework: 2022 GR

- **P (Tailwind):** Allies near her speed up while moving toward her, and she turns some bonus movement speed into bonus magic damage.
- **Q (Howling Gale):** A whirlwind that she charges up and then releases; longer charge means more reach and a longer knockup.
- **W (Zephyr):** A slow, targeted air elemental that does damage and slows; passively it gives her speed and lets her pass through units.
- **E (Eye Of The Storm):** A shield on an ally that adds damage while it holds; she gets some of its cooldown back when her slow or knockup lands.
- **R (Monsoon):** A knockback ring around her, then a short channel that heals nearby allies.
- **Rhythm:** about Q 14 s flat, W 8-6 s, E 16-12 s, R 130-100 s. Q has no rank scaling, so Q is a constant spacing tool, not a growing threat.
- **Loop:** Charge Q, slow with W, and keep the ultimate for the moment someone is about to reach her.
- **Decision:** Release the Q early for a quick poke or hold it for a longer knockup.
- **Counterplay:** A visible charge tells you the knockup is coming; walk out of the area, or dive her before the ring.
- **Mastery:** Releasing Q just as the enemy commits, and timing R as a peel.
- **For a duel:** Without allies, her kit is a pure peel-and-poke champion, and her best tools (shields, healing) have no one to cover. Riot staff said the 2022 update drained poke from Zephyr and moved it toward utility, but only press coverage of that was found, not a Riot post. The charge-to-release Q is the useful lesson. [partly]

### Jarvan IV, the Exemplar of Demacia
Diver · melee · mana · 2011 · last rework: none

- **P (Martial Cadence):** His attacks add damage based on the target's current health, once every few seconds per target.
- **Q (Dragon Strike):** A line stab that cuts armor; if it hits his planted flag, he dashes to it and knocks up everything on the way.
- **W (Golden Aegis):** An instant slow around him that gives a growing shield for each champion hit.
- **E (Demacian Standard):** Plants a flag, a damage burst, attack speed aura and vision.
- **R (Cataclysm):** An unstoppable leap onto a champion that raises a ring of terrain to trap them; he can recast to remove it.
- **Rhythm:** about Q 10-6 s, W 9 s flat, E 12-10 s, R 120-90 s. The E-Q combo is the main burst, and the flag must be planted before the Q cooldown matters.
- **Loop:** Plant a flag, dash through it with Q to knock up, then trap with R.
- **Decision:** Where to place the flag so it becomes a path.
- **Counterplay:** The flag is a visible plan; step off the line, or use movement skills to avoid the trap.
- **Mastery:** Placing the flag farther than the opponent expects and using the terrain ring as a wall.
- **For a duel:** The two-step combo of planting a marker and then dashing through it works well in a 1v1 because the opponent can see the setup. Terrain walls fit an arena with cover. [transfers]

### Jax, Grandmaster at Arms
Skirmisher · melee · mana · 2009 · last rework: 2023 GR

- **P (Relentless Assault):** Hits stack attack speed (up to 8 stacks), which fade one at a time.
- **Q (Leap Strike):** A leap to a target unit that lets him cast other abilities in flight.
- **W (Empower):** Empowers the next attack with bonus magic damage and range.
- **E (Counter Strike):** A dodge stance against basic attacks; recast to stun nearby enemies, harder for each attack dodged.
- **R (Grandmaster-at-Arms):** A lantern swing that gives armor and magic resist; his passive adds a third-hit empowered attack.
- **Rhythm:** about Q 8-6 s, W 7-3 s, E 17-9 s, R 110-90 s. E is the long, risky cooldown, others are quick.
- **Loop:** Q onto the target, W-empower the attack, and hold E at the moment the opponent starts hitting.
- **Decision:** When to hold the counter, and whether to fight or let a stance bait a wasted attack.
- **Counterplay:** Do not attack during the stance. Use abilities, since it only dodges basic attacks, and stun him after the stun's wind-up.
- **Mastery:** Baiting the opponent to attack into E.
- **For a duel:** The 2023 update, according to the [13.1 patch notes](https://www.leagueoflegends.com/en-us/news/game-updates/patch-13-1-notes/), kept his simple kit but made the ultimate more interesting. The counter-stance is the classic duel tool: it creates a clear moment where the opponent must choose between attacking and waiting. [transfers]

### Jayce, the Defender of Tomorrow
Artillery · both · mana · 2012 · last rework: none

- **P (Hextech Capacitor):** Switching form gives a brief burst of speed and walking through units.
- **Q (To the Skies! / Shock Blast):** Hammer: leap and slam. Cannon: a bolt that gets stronger if it passes through the gate.
- **W (Lightning Field / Hyper Charge):** Hammer: an electric field. Cannon: a burst of energy that maxes his attack speed for several attacks.
- **E (Thundering Blow / Acceleration Gate):** Hammer: damage and a knock back. Cannon: a gate that speeds allies and Jayce and boosts a Q fired through it.
- **R (Mercury Cannon / Mercury Hammer):** Swaps between the two forms; cooldowns kept in the abilities of the other form.
- **Rhythm:** cannon form listed, about Q 8 s, W 16 s, E 13-5 s, R 6 s; hammer Q is 16-6 s and E 20-10 s. Each form's cooldowns tick while he is in the other form, so a swap gives a fresh set.
- **Loop:** Open at range with the cannon Q through the gate, swap in, finish with the hammer's knock back.
- **Decision:** Which form to stand in, and when a swap gives a fresh set of cooldowns.
- **Counterplay:** The gate is a place on the ground that shows the line of the next shot, and the swap has a delay.
- **Mastery:** Using the gate-boosted Q and the transform at once.
- **For a duel:** Two kits in one champion is a duel idea: the player is always choosing which weapon set to be in. It doubles the memory load, but the swap is a visible commitment. [transfers]

### Jhin, the Virtuoso
Marksman, Catcher · ranged · mana · 2016 · last rework: none

- **P (Whisper):** Four shots per reload; the fourth always crits and hits harder on low health. His attack speed becomes damage and speed on crits.
- **Q (Dancing Grenade):** A grenade that bounces to up to three more targets.
- **W (Deadly Flourish):** A long line shot that roots a marked champion.
- **E (Captive Audience):** Hidden traps that slow, reveal and explode; a kill leaves one behind.
- **R (Curtain Call):** A channel of four shots in a cone, slowing the first hit.
- **Rhythm:** about Q 7-5 s, W 12 s, E 2 s per charge with a 24-14 s recharge, R 120-90 s. The weapon reload forces a pause every four shots.
- **Loop:** Mark with a trap or an ally's damage, root with W, then fire the fourth shot and R.
- **Decision:** When to stop and reload versus when to save the fourth shot.
- **Counterplay:** The reload is a visible pause; the ultimate has a cone you can leave, and the W line can be blocked.
- **Mastery:** Lining up a marked root with the fourth shot.
- **For a duel:** The fixed four-beat attack rhythm is a design lesson: it shapes the player's timing without extra buttons. His W needs an ally mark, which a duel lacks, so a trap would have to do that work. [transfers]

### Jinx, the Loose Cannon
Marksman · ranged · mana · 2013 · last rework: none

- **P (Get Excited!):** Takedowns give a burst of speed and stacks of attack speed.
- **Q (Switcheroo!):** A toggle between a minigun that builds attack speed and a rocket launcher with splash and range.
- **W (Zap!):** A long slow bolt that reveals.
- **E (Flame Chompers!):** A line of three mines that explode after a delay and root champions that touch them.
- **R (Super Mega Death Rocket!):** A global rocket that grows stronger with distance and low health.
- **Rhythm:** about Q 0.9 s, W 8-4 s, E 24-10 s, R 85-45 s. The long E and R are the only moments the kit breaks from its rhythm.
- **Loop:** Walk with the minigun, switch to the rocket to poke, and use the mines as a wall.
- **Decision:** Which weapon to hold, and where to place the mines.
- **Counterplay:** The mines are visible, and the ultimate is a straight line that takes time to travel.
- **Mastery:** Placing mines on the opponent's exit.
- **For a duel:** The weapon toggle is a low-cost choice that keeps the player making a decision all the time. The global rocket is wasted in a small arena. [partly]

### K'Sante, the Pride of Nazumah
Warden, Skirmisher · melee · mana · 2022 · last rework: 2024 GR

- **P (Dauntless Instinct):** His abilities mark enemies; his next attack on a marked enemy burns max-health damage.
- **Q (Ntofo Strikes):** A fast poke with a slow; two hits turn the next into a pull and stun.
- **W (Path Maker):** A charge with damage reduction; the release dashes through and stuns.
- **E (Footwork):** A dash with a shield, which can go through walls with an ally.
- **R (All Out):** Knocks an enemy back, launching them through any wall in their path; he then dashes after them and enters All Out.
- **Rhythm:** about Q 3.5-2 s (set by resistances), W 14-10 s, E 10-8 s, R 120-80 s. All Out turns all basic abilities free and faster for 15 s.
- **Loop:** Tank until the ultimate, then change into a damage form that drops his defence.
- **Decision:** When to spend the ultimate and give up health.
- **Counterplay:** Stay out of his reach during the windup of R and E; fight him early.
- **Mastery:** Launching the opponent through a wall with R.
- **For a duel:** Riot said the All Out idea came from a "drop the weights" moment ([Riot Champion Insights, as reported by press](https://win.gg/news/how-riot-games-made-the-ksante-design/), not read directly). This trade of safety for power is, by analysis not from Riot, a clean duel mechanic, but the form is strong and a version with a short timer would be fairer. [transfers]

### Kai'Sa, Daughter of the Void
Marksman · ranged · mana · 2018 · last rework: none

- **P (Second Skin):** Attacks and her W stack plasma on a target; the fifth stack bursts for missing-health damage. Her three basic abilities also evolve once she holds enough of the matching stat.
- **Q (Icathian Rain):** A swarm of homing missiles at nearby enemies; no aiming, but it needs someone close.
- **W (Void Seeker):** A very long bolt that applies plasma and reveals the victim.
- **E (Supercharge):** A charge she can move through, with ghosting, then a burst of attack speed.
- **R (Killer Instinct):** A short shield and a dash to a spot beside an enemy carrying plasma.
- **Rhythm:** about Q 10-6 s, W 20-14 s, E 16-10 s, R 130-70 s. Evolved W refunds most of its cooldown on a hit, so the long W can fire twice in a row.
- **Loop:** Reveal with W, stack plasma with attacks, dash in with R behind the stack, and burst on the fifth.
- **Decision:** Which of the three abilities to evolve, and when to spend R as a reposition, not an engage.
- **Counterplay:** The W is a slow, thin line, so side-step it. R needs a plasma target, so deny stacks by staying out of attack range, and punish the dash start.
- **Mastery:** Counting plasma and landing the dash so the fifth stack hits the moment she arrives.
- **For a duel:** The evolutions are tied to items, which this game lacks. The transferable idea is a three-way upgrade choice inside the kit, bought with some other currency such as round wins. Her R needing a recently marked target is a clean rule: the ultimate rewards the setup. [partly]

### Kalista, the Spear of Vengeance
Marksman · ranged · mana · 2014 · last rework: none

- **P (Martial Poise):** After each attack she can hop a short way in a chosen direction, so she attacks while moving. She is also tied to an ally, the Oathsworn.
- **Q (Pierce):** A spear that passes on to the next enemy if it kills, carrying the stacks along.
- **W (Sentinel):** Sends a sentinel to patrol and give vision, and with the ally it applies marks.
- **E (Rend):** Rips spears out of every enemy that carries them, for damage and a slow; a kill resets it.
- **R (Fate's Call):** Pulls the ally to her, makes them untargetable for a moment, then lets them dash and knock enemies up.
- **Rhythm:** about Q 9 s, W 30 s (stored charges), E 10-8 s, R 160-120 s. A kill with E erases its cooldown, so the window is whenever the opponent is low enough.
- **Loop:** Attack-hop-attack to stack spears, then rip to finish or slow.
- **Decision:** When to rip: early for a slow, or late for a kill that resets it.
- **Counterplay:** Spears stay in you until she rips them, so a fast burst from her or a retreat out of range makes stacks harmless. Her hop is a fixed distance, and she is easiest to catch when she hops after an attack.
- **Mastery:** Spacing attacks with hops so she never stands still while stacking.
- **For a duel:** The R and the marks need a partner, so most of the kit fails alone. The attack-then-hop and the stack-then-rip with a reset on a kill are the strong parts, and the reset is the sort of window a short round benefits from. [partly]

### Karma, the Enlightened One
Burst, Enchanter · ranged · mana · 2011 · last rework: 2013 VG

- **P (Gathering Fire):** Each champion her damaging abilities hit cuts Mantra's cooldown by about 4 s.
- **Q (Inner Flame):** A bolt that explodes on the first enemy, damages and slows.
- **W (Focused Resolve):** A tether that deals damage, then roots and deals it again if the target stays linked.
- **E (Inspire):** A shield and speed boost on herself or an ally.
- **R (Mantra):** Mantra: the next basic ability gets a stronger form. Q leaves a slow field and blows up again, W heals her and roots longer, E spreads to nearby allies.
- **Rhythm:** about Q 9-5 s, W 12 s flat, E 10-8 s, R 40-34 s. Mantra is a short cooldown, so every ability has a strong form often, and hits shorten it further.
- **Loop:** Land a hit to shorten the timer, cast Mantra, then fire the one ability that best suits the situation.
- **Decision:** Which ability to empower, since only one can be.
- **Counterplay:** The empowered W tether can be broken by leaving range, which wastes the root. The empowered Q is a slow bolt and can be dodged.
- **Mastery:** Choosing the empower before the fight, and keeping Mantra ready for the moment it matters.
- **For a duel:** A cheap "empower the next spell" button is a good duel tool, because it makes the player choose one of three outcomes and the opponent can see it coming. Her E is mostly wasted without allies. [transfers]

### Karthus, the Deathsinger
Battlemage · ranged · mana · 2009 · last rework: none

- **P (Death Defied):** When he would die, he becomes untouchable for about 7 s and can cast freely, but cannot move.
- **Q (Lay Waste):** A delayed blast on the ground that hits twice as hard on a lone target; very short cooldown.
- **W (Wall of Pain):** A wall that slows and strips resistance from whoever touches it.
- **E (Defile):** A toggled aura around him that damages nearby enemies each tick and drains mana.
- **R (Requiem):** A three-second channel, visible to all, then damage to every champion.
- **Rhythm:** about Q 1 s, W 15 s, E 0.5 s, R 200-160 s. Q and E are nearly free of cooldown, so only mana limits them; W and R are the rare spends.
- **Loop:** Fire Q ahead of the opponent's path, wall their escape, switch the aura on when close, then death-state casts.
- **Decision:** How much mana to spend on pressure versus saving the aura.
- **Counterplay:** Walk out of the Q circle after its delay. Close in on him and kill him before the death state. The R can be cancelled by stuns, and he is busy during the channel.
- **Mastery:** Predicting movement for Q against a single target, and never being killed with unspent W.
- **For a duel:** A resource-limited spam spell with a delay is a good pressure tool in a small arena. The global ultimate is meaningless there, but a death state that rewards the killer's patience is an interesting idea for a short round. [partly]

### Kassadin, the Void Walker
Assassin · melee · mana · 2009 · last rework: 2014 VG

- **P (Void Stone):** Walks through units and takes less magic damage.
- **Q (Null Sphere):** Targeted orb that interrupts channels and gives a small magic shield on cast.
- **W (Nether Blade):** Passive magic on-hit; the active empowers the next attack with bonus range and a mana refund.
- **E (Force Pulse):** Short cone, slows; it has to be charged up first, and spells cast nearby feed the charge.
- **R (Riftwalk):** Short blink that stacks, so each repeat hits harder and costs more mana.
- **Rhythm:** about Q 9-7 s, W 7 s, E 21-17 s, R 5-2 s. The R is nearly free to repeat early, so the window is not the cooldown but the mana bar and the stack count.
- **Loop:** Q to shield and interrupt, blink in, empowered attack, cone to slow, then blink again for a second burst.
- **Decision:** how many blinks to spend now, because every extra stack makes the next one cost more mana.
- **Counterplay:** he is only dangerous when his mana is full. Make him blink early and wait out the stack timer. Spell shields beat the targeted Q. The cone is weak against anyone who is already moving away.
- **Mastery:** judging mana across the fight, and blinking over cover to land where the opponent cannot answer.
- **For a duel:** a repeatable blink that gets more expensive each use gives a clear, readable limit to a gap closer. His weakness (no answer before the first blink, a dull kit outside it) is also the lesson. [transfers]

### Katarina, the Sinister Blade
Assassin · melee · none · 2009 · last rework: 2016 GR

- **P (Voracity):** Kills she helped with cut her cooldowns, so the fight can chain; picking up a dagger slashes nearby enemies.
- **Q (Bouncing Blade):** Targeted dagger that bounces to two more enemies and lands behind the first target a moment later.
- **W (Preparation):** Tosses a dagger up and gives a short, fading speed burst.
- **E (Shunpo):** Blink to a dagger or a champion, prefers daggers.
- **R (Death Lotus):** Channelled spin that throws daggers at up to three nearby champions.
- **Rhythm:** about Q 11-7 s, W 15-11 s, E 12-8 s, R 75-45 s. The spread is wide, so she is strongest once the passive is cutting everything short.
- **Loop:** Q leaves a dagger, E to it, the pickup spins and hits, W makes the next dagger, E again.
- **Decision:** where to leave daggers and which one to blink to, which tells the opponent where she will appear.
- **Counterplay:** the daggers are visible for a few seconds, so the opponent sees her next blink point. The R channel is long, and any hard stop breaks it.
- **Mastery:** laying daggers to hide the real path, and holding R until the channel cannot be stopped. Riot's patch notes for this update said it was meant to show her movement to opponents, which fits the dagger design ([6.22 notes](https://archive.runeterra.net/na/riot-official/chOkE7Z4)).
- **For a duel:** a visible object that is also her route is a good tell with a payoff. The open-ended reset snowball is a risk in a short round. [transfers]

### Kayle, the Righteous
Specialist · melee then ranged · mana · 2009 · last rework: 2019 VG

- **P (Divine Ascent):** Four forms by level, from melee with stacking speed to long range with waves on each attack.
- **Q (Radiant Blast):** Slow skillshot sword; slows and cuts the target's resistances.
- **W (Celestial Blessing):** Heals her and an ally, then speed.
- **E (Starfire Spellblade):** Next attack hits harder the lower the target is, and turns ranged early on.
- **R (Divine Judgment):** Makes the target invulnerable for a short time, then swords fall around them.
- **Rhythm:** about Q 10-8 s, W 15 s, E 8-6 s, R 140-80 s. W never gets faster, so the late game is a longer Q and E loop.
- **Loop:** Q, empowered attack, then walk away while the waves and speed finish the job.
- **Decision:** when to spend the invulnerability, since on a duel it only protects herself.
- **Counterplay:** she is weak until level 6 and 11; early pressure and burst are the answer. The Q is slow and straight. The invulnerability can be waited out, but the swords fall afterwards.
- **Mastery:** staying out of reach while the speed and attack range keep her safe, and timing R so it ends when the opponent's burst has gone.
- **For a duel:** Riot built this on four time-based power steps ([2019 update](https://www.surrenderat20.net/2019/02/champion-update-kayle-morgana-righteous.html)). A long timer rewards patience, which a short round does not. Her kit is mostly passive scaling. [5v5 only]

### Kayn, the Shadow Reaper
Skirmisher · melee · mana · 2017 · last rework: none

- **P (The Darkin Scythe):** Choose a form through the whole game: Rhaast (heals and knockup) or Shadow Assassin (burst and sneaking).
- **Q (Reaping Slash):** Dash through enemies, then a swing; on Rhaast it scales with max health.
- **W (Blade's Reach):** Slow sweep (on Shadow, cast through the shadow with no windup); on Rhaast it knocks up.
- **E (Shadow Step):** Walk through walls for a short time; it ends sooner if he fights.
- **R (Umbral Trespass):** Vanish into a marked champion and re-emerge to strike.
- **Rhythm:** about Q 7-5 s, W 13-9 s, E 21-13 s, R 120-80 s. The long E and R mean he picks fights, he does not repeat them.
- **Loop:** E through terrain, R on a marked target, W then Q chain.
- **Decision:** which form to take (the rules push it), then when to commit to R.
- **Counterplay:** R can be seen coming (he reveals the target and is exposed while inside), so the opponent can trade position. His terrain walk is cancelled by attacks and by crowd control.
- **Mastery:** chaining the terrain walk into the form-specific W and Q for a clean engage.
- **For a duel:** Riot called the one-way form choice a first ([Champion Insights](https://nexus.leagueoflegends.com/en-us/2017/07/champ-insights-kayn/)). Choosing a build at the start of a round is a strong idea, but the orb system needs a long game. [partly]

### Kennen, the Heart of the Tempest
Specialist · ranged · energy · 2010 · last rework: none

- **P (Mark of the Storm):** Abilities mark; the third mark stuns and refunds energy.
- **Q (Thundering Shuriken):** Fast skillshot that marks.
- **W (Electrical Surge):** Every fourth attack marks; the active hits all marked enemies at once.
- **E (Lightning Rush):** Short lightning dash that refunds energy and can be cut early for attack speed.
- **R (Slicing Maelstrom):** Storm around him with armor, hits harder per bolt.
- **Rhythm:** about Q 7-4 s, W 13-6 s, E 10-6 s, R 120 s. Everything is short, so he can stun again and again.
- **Loop:** Q to mark, attack to mark, W to hit the marked enemy, third mark stuns, E for energy.
- **Decision:** where to spend marks, because the stun is only worth using when the opponent cannot step away.
- **Counterplay:** he must get close and the Q is a straight line. After a stun the second stun on the same target is much shorter, which the opponent can use to survive.
- **Mastery:** counting marks and timing E so the stun lands as the opponent commits.
- **For a duel:** a mark that rewards three different hits gives a readable, earned stun, and the energy refund removes the dry period. [transfers]

### Kha'Zix, the Voidreaver
Assassin · melee · mana · 2012 · last rework: none

- **P (Unseen Threat):** After vanishing from sight, the next hit on a champion slows and adds damage.
- **Q (Taste Their Fear):** Targeted strike, much stronger on a lone target.
- **W (Void Spike):** Skillshot that heals him when he stands in the blast.
- **E (Leap):** Long jump.
- **R (Void Assault):** Short stealth that can be cast again; each level lets him evolve one ability.
- **Rhythm:** about Q 4 s, W 9 s, E 20-12 s, R 100-70 s. The Q is nearly always ready.
- **Loop:** stealth in, jump, strike the isolated target, spike for healing and reveal, stealth out.
- **Decision:** which ability to evolve and when to cast stealth to win vision.
- **Counterplay:** being near an ally or cover cancels the Q bonus, and the jump has a fixed range and lands in view.
- **Mastery:** using R to reset the passive and the evolution for a wider jump.
- **For a duel:** an evolve choice is a build decision inside the match and it works with the round clock. The lone-target bonus loses its point in a 1v1 where the opponent is always isolated. [partly]

### Kindred, the Eternal Hunters
Marksman · ranged · mana · 2015 · last rework: none

- **P (Mark of the Kindred):** Wolf marks a target; completing hunts permanently grows range and power.
- **Q (Dance of Arrows):** Dash that fires at up to three targets; cooldown drops when used well.
- **W (Wolf's Frenzy):** Wolf claims an area and attacks anything in it.
- **E (Mounting Dread):** Slows the target; third basic attack makes the wolf pounce.
- **R (Lamb's Respite):** Area where nobody dies for four seconds; everyone is healed at the end.
- **Rhythm:** about Q 4-2 s, W 18-14 s, E 14-8 s, R 160-120 s.
- **Loop:** E, attack twice, pounce, dash away, place the wolf's area to control a spot.
- **Decision:** where to put the W, since it stays where it is.
- **Counterplay:** step out of the area; the pounce needs three attacks and can be dodged.
- **Mastery:** using R on an enemy to deny a kill at the right second.
- **For a duel:** the lasting area that follows a wolf is a good cover tool. The ultimate protects both sides, so in a duel it only delays. The hunting passive depends on long games. [partly]

### Kled, the Cantankerous Cavalier
Skirmisher · melee · other · 2016 · last rework: 2025 GR

- **P (Skaarl, the Cowardly Lizard):** Two health bars: the mount takes all damage first; when she flees, Kled must fight on foot and regain courage to remount.
- **Q (Bear Trap on a Rope):** Tethered trap; pulls if the target stays attached.
- **W (Violent Tendencies):** Passive buff after a cooldown; the fourth attack hits for percent health.
- **E (Jousting):** Dash that marks, then a second dash through the target.
- **R (Chaaaaaaaarge!!!):** Long charge at a location, ghosted, ending in a knockback on the first champion he reaches.
- **Rhythm:** about Q 11-7 s, W 13-9 s, E 13-9 s, R 140-110 s.
- **Loop:** trap, pull, dash in, four fast attacks, dismount, shoot, remount.
- **Decision:** whether to fight on or let the mount go.
- **Counterplay:** break the tether by moving away; dodge the dash; wait out the courage gain.
- **Mastery:** pulling a retreating target with the trap and recasting the dash through them.
- **For a duel:** the two-state health is the most transferable idea here, because the break gives the opponent a clear moment to press. The 2025 rework was reported by third parties as making it less punishing; no Riot post was found. [transfers]

### Kog'Maw, the Mouth of the Abyss
Marksman · ranged · mana · 2010 · last rework: 2015 GR

- **P (Icathian Surprise):** On lethal damage, a four-second invulnerable, speeding zombie that then explodes.
- **Q (Caustic Spittle):** Slow skillshot that cuts armor and magic resist.
- **W (Bio-Arcane Barrage):** Eight seconds of long range and percent-health damage on attacks.
- **E (Void Ooze):** Wide skillshot that leaves a slowing pool.
- **R (Living Artillery):** Delayed artillery on a ground point; hits harder on low-health targets.
- **Rhythm:** about Q 7 s, W 17 s, E 12 s, R 2-1 s, with mana cost rising per repeat. R is limited by mana, not time.
- **Loop:** E to slow, W up, attack while backing off, R on anyone who tries to escape.
- **Decision:** when to start W, since he is stationary and weak outside it.
- **Counterplay:** close the distance during the zombie's delay; the R is slow and telegraphed.
- **Mastery:** using the zombie period to walk into the opponent.
- **For a duel:** the death-throes passive is a strong comeback beat that could be copied. The 2015 update doubled his speed while W was active; it was partly reverted in patch 6.19 ([Riot dev blog](https://archive.runeterra.net/na/developer-corner/1YZMAzz0)). [transfers]

### LeBlanc, the Deceiver
Burst, Assassin · ranged · mana · 2010 · last rework: 2016 GR

- **P (Mirror Image):** At 40 percent health she makes a decoy and both vanish for a moment.
- **Q (Sigil of Malice):** Targeted orb that marks; the next damage on the target repeats the hit.
- **W (Distortion):** Dash that leaves a pad; recast to go back.
- **E (Ethereal Chains):** Chain skillshot; breaks after a moment into a root.
- **R (Mimic):** Recasts whichever of Q, W, E she used last.
- **Rhythm:** about Q 6 s, W 15-10 s, E 14-11 s, R 45-25 s. Each spell pairs with the ultimate, so a full combo is short.
- **Loop:** Q, W in, R of the Q to trigger the double mark, E to root, then W back out.
- **Decision:** which spell to double with R, and whether to use the return.
- **Counterplay:** sidestep the chain, break it by moving away, and punish her after the return is spent.
- **Mastery:** hiding which of her spells will be doubled until the last moment.
- **For a duel:** copy-last-spell is a good puzzle; the uncertainty of the decoy is useful. Riot's 2016 version of Mimic was a clone-based design, later reverted ([red posts](https://surrenderat20.net/2016/08/red-post-collection-leblanc-update.html)). [transfers]

### Lee Sin, the Blind Monk
Diver · melee · energy · 2011 · last rework: none

- **P (Flurry):** After any ability, the next two basic attacks are faster and give back energy.
- **Q (Sonic Wave / Resonating Strike):** Skillshot that marks the first enemy it hits. Recast dashes to the mark, hitting harder the lower their health.
- **W (Safeguard / Iron Will):** Dash to an ally or himself; both get a shield. Recast gives him healing from damage for a few seconds.
- **E (Tempest / Cripple):** Burst around him that marks nearby enemies. Recast slows them.
- **R (Dragon's Rage):** Kicks a target champion backward; whoever the body hits is knocked up.
- **Rhythm:** Q 10-6 s, W 8 s, E 8 s, R 110-60 s. Every ability has a cheap second half, so the effective rhythm is a cast, a recast and then a basic-attack pair that refills energy.
- **Loop:** Q, Q to arrive, W or E for the shield or slow, two attacks to refill energy, repeat until the R is ready.
- **Decision:** Recast right away for the gap close, or hold the first mark's few seconds for a bigger hit. Use W on himself as an escape, or bring it to an ally and waste it in a duel.
- **Counterplay:** The first Q is a plain skillshot; if it misses, the recasts don't exist. The R is a short-range targeted kick, so staying out of his reach once the mark has expired is the real answer.
- **Mastery:** Chaining the passive: the Q recast gives attacks right after the dash. Bending the R so the body hits another champion.
- **For a duel:** Every ability being a two-part action is a strong skill-expression design: it rewards deciding what to do after the first half lands. W is mostly an ally ability and loses depth in a duel. [transfers]

### Leona, the Radiant Dawn
Vanguard · melee · mana · 2011 · last rework: none

- **P (Sunlight):** Her abilities mark enemies; an ally's damaging hit on a marked enemy consumes the mark for extra damage.
- **Q (Shield of Daybreak):** Next basic attack gets longer reach and a stun.
- **W (Eclipse):** Guard for 3 s giving damage reduction and extra defences; at the end it explodes, and a hit enemy extends it by another 3 s.
- **E (Zenith Blade):** Throws her sword in a line, then dashes to the last champion hit and roots them briefly.
- **R (Solar Flare):** After a short delay, a large flare slows by 80%; the centre stuns.
- **Rhythm:** Q 5 s, W 14-10 s, E 12-6 s, R 90-60 s. The cheap Q makes her stun nearly constant, while E and R are the real commitments.
- **Loop:** E to close the gap, Q on the first attack for a stun, W up before taking a trade, R for the final lock.
- **Decision:** Open with E from range to catch them, or hold it so she does not end up deep in a bad spot. Pop the W detonation by waiting out the 3 s for the extension, or cut it short.
- **Counterplay:** The E is a straight line and she cannot move while the sword flies; a spell shield stops the dash. The R telegraphs and has a delay, and the slow only stuns at the centre.
- **Mastery:** Keeping the W alive by detonating on someone; lining the R so that the centre hits instead of the edge.
- **For a duel:** A Q stun on a basic attack with a 5-second cooldown is a lot of control from a cheap spell. In a duel, her partner-based mark does nothing. [partly]

### Lillia, the Bashful Bloom
Skirmisher · melee · mana · 2020 · last rework: none

- **P (Dream-Laden Bough):** Her abilities that hit leave a percentage-health burn on the enemy that heals her.
- **Q (Blooming Blows):** Swing around her; the outer ring adds true damage. She can walk while casting. Passively, every ability that hits builds speed stacks (up to 4).
- **W (Watch Out! Eep!):** Dash toward a spot and smash; the centre does double damage.
- **E (Swirlseed):** Lobs a seed that rolls on forever and bursts on the first enemy or wall, slowing them.
- **R (Lilting Lullaby):** Hits every enemy champion carrying her burn: drowsy, then asleep. The first damage on a sleeper deals extra.
- **Rhythm:** Q 6-4 s, W 14-10 s, E 12 s flat, R 150-110 s. The long R leaves most of a match without sleep.
- **Loop:** Seed to apply the burn and slow, W to close, Q ring on the outer edge, run away on stacked speed, repeat; R when a kill is possible.
- **Decision:** Fight at the edge of the Q for the extra true damage, or stay inside it for safety. Spend the R as soon as the burn is on, or hold it to turn a won trade into a kill.
- **Counterplay:** Her stack speed falls off one at a time, so breaking contact costs her; the seed is slow and rolls in a line.
- **Mastery:** Kiting: Q on the move, then run while the burn ticks. The skill is staying at the edge without being hit.
- **For a duel:** Riot built her around sleep from the start ([Lillia Insights](https://www.leagueoflegends.com/en-us/news/dev/champion-insights-lillia/)). A "must be hit by the passive to be ultimate-able" rule makes the R need setup, which is a good fit for a short duel. [transfers]

### Lissandra, the Ice Witch
Burst · ranged · mana · 2013 · last rework: none

- **P (Iceborn Subjugation):** A killed enemy champion becomes an ice thrall that chases and bursts.
- **Q (Ice Shard):** An ice spear that slows the first enemy hit and then shatters wider and longer.
- **W (Ring of Frost):** A tight ring that roots nearby enemies.
- **E (Glacial Path):** An ice claw that slows to a stop; recast to blink to it.
- **R (Frozen Tomb):** On an enemy, a stun and knockdown with an ice field. On herself, a stasis that heals and destroys incoming projectiles.
- **Rhythm:** Q 7-3 s, W 10-8 s, E 24-12 s, R 120-80 s. The short Q cooldown at max rank keeps pressure constant, while the E cooldown is the cost of her escape.
- **Loop:** Q to slow, E in to hit them, W for a point-blank root, then R to finish or run.
- **Decision:** Use the E as an attack to reach the target, or hold it as the only escape. Use the R on an enemy for a stun or on herself for a heal and a wall of untargetability.
- **Counterplay:** The claw's endpoint can be seen by enemies and she can't recast it while rooted. Her W has a very short range.
- **Mastery:** Placing the claw so it ends where the target will be; choosing the self R against a burst.
- **For a duel:** One button that is either an attack or a defence (the R) is the best idea here. A duel designer should note that it offers two answers from one cooldown. [transfers]

### Locke, the Ashen Exorcist
Assassin · melee · mana · 2026 · last rework: none

- **P (Silver Stake):** Attacks deal more magic damage the lower the target's health.
- **Q (Ritual Nails):** Throws a nail; each hit adds a stack (up to 3). Two recasts follow within 4 s. At 2 or more stacks the slow gets much stronger.
- **W (Soul Ignition):** For 5 s, faster and ghosted, burning his own health, storing damage taken to heal back on recast.
- **E (Ashen Pursuit):** Blink to a place with damage; next attack within 4 s dashes in from extra range. A champion takedown resets it.
- **R (Purgatory):** Totem throw that slows by 99%, shows and marks champions, and executes marked ones under a low health line; the totem stays if it kills and gives permanent growth and cooldown.
- **Rhythm:** Q 10-6 s, W 18-14 s, E 10 s flat, R 120-80 s. The E reset on a takedown is the only cooldown that is cancelled by playing well.
- **Loop:** Q three times to build stacks, E in, attack to consume the stacks, W to survive the trade, R for the execute.
- **Decision:** Burn health on W to chase and heal it back, or save the cooldown and take the damage. Use the R at once or wait for the target to cross the health line.
- **Counterplay:** He needs to hit the nails; the R has a delay and marked targets know they are marked. Sealing a kill requires him to collect the totem.
- **Mastery:** Finishing exactly at the execute line so the totem returns.
- **For a duel:** Riot said its main challenge was keeping assassin lethality while making the visuals clear ([Sheep Esports](https://www.sheepesports.com/us/articles/riot-games-unveils-locke-league-s-only-champion-for-2026/en)). A snowballing seal system carries over only to a longer series. [partly]

### Lucian, the Purifier
Marksman · ranged · mana · 2013 · last rework: none

- **P (Lightslinger):** After any ability, his next attack fires a quick second shot; healing, shielding or immobilising an ally or enemy nearby stores extra magic damage on his shots.
- **Q (Piercing Light):** Targeted laser through the target; the cast is short and gets shorter with rank, and it leads a moving target.
- **W (Ardent Blaze):** Skillshot that bursts in a cross and marks enemies; hitting a marked enemy gives him speed.
- **E (Relentless Pursuit):** Short dash toward the cursor that resets his attack timer and can be used during other casts.
- **R (The Culling):** Channelled stream of bullets down a line while he walks; recast ends it early.
- **Rhythm:** about Q 9-5 s, W 14-10 s, E 16-14 s, R 110-90 s. The Q is nearly free at max rank, so the W and E set the pace; each passive shot that lands trims the dash cooldown.
- **Loop:** ability, attack, second shot, dash, ability again. Every spell is the first half of a two-hit burst.
- **Decision:** which ability to open the sequence with, and which way to dash so the next shot lands without taking a hit back.
- **Counterplay:** the Q is telegraphed by a short cast and can be sidestepped; the R is a line, so leaving it costs him the damage. Hitting him in the dash gap is the window.
- **Mastery:** cancelling every wind-up with the dash, so the sequence never pauses.
- **For a duel:** a kit built around "cast, then attack" turns a basic attack into a spell slot; it gives a duel a clear rhythm and rewards movement. The R is weaker 1v1 than the rest. [transfers]

### Lulu, the Fae Sorceress
Enchanter · ranged · mana · 2012 · last rework: none

- **P (Pix, Faerie Companion):** Pix, a companion, adds three small bolts to her basic attacks and moves to an ally she buffs.
- **Q (Glitterlance):** Two skillshot bolts, one from her and one from Pix, that slow hard; a second hit on the same target is weaker.
- **W (Whimsy):** Targeted spell: turns an enemy into a harmless critter (cannot attack, slowed), or speeds up an ally or herself.
- **E (Help, Pix!):** Targeted: damages and reveals an enemy, or shields an ally and attaches Pix.
- **R (Wild Growth):** Targeted: makes an ally big, adds health, knocks nearby enemies up and slows around them.
- **Rhythm:** about Q 7-7 s, W 18-18 s, E 10-8 s, R 120-80 s. The W is the long cooldown and the one that decides a fight; the Q is up almost every trade.
- **Loop:** poke with the doubled Q, polymorph the one who commits, shield the one who is hit.
- **Decision:** spend the polymorph offensively or hold it for the enemy's gap-closer.
- **Counterplay:** the Q has two start points and is awkward to dodge, but still a line; the W is a targeted cast with a short range, so spacing beats it.
- **Mastery:** reading the enemy's engage so the polymorph lands first.
- **For a duel:** the polymorph is a lovely short "answer" tool, but half of the kit gives to other people. The self-cast options are thin. [partly]

### Lux, the Lady of Luminosity
Burst, Artillery · ranged · mana · 2010 · last rework: none

- **P (Illumination):** Her abilities mark enemies; a basic attack or the R pops the mark for extra damage.
- **Q (Light Binding):** Slow skillshot that roots the first two enemies hit.
- **W (Prismatic Barrier):** Wand thrown out and back; shields allies it passes and herself, twice if both passes connect.
- **E (Lucent Singularity):** Placed zone that slows; recast (or expiry) detonates it.
- **R (Final Spark):** Very long beam after a one-second wind-up; she is rooted in place meanwhile.
- **Rhythm:** about Q 10-10 s, W 12-10 s, E 10-8 s, R 60-40 s. The Q, W and E cycle together so a full combo comes up every ten seconds or so, and the R returns twice per long fight.
- **Loop:** slow with the E, root with the Q, pop with a hit or the R. Each step needs the one before it to land.
- **Decision:** when to detonate the E: early for the slow, or late to catch the dodge.
- **Counterplay:** the Q is slow and narrow enough to dodge; the R announces itself with a visible line before the beam, so a short step sideways beats it.
- **Mastery:** predicting where the target will be stuck, and placing the E on that spot.
- **For a duel:** a good example of a combo that the enemy sees in stages and can break at each one. The R is almost too clear to hit one on one. [transfers]

### Malphite, Shard of the Monolith
Vanguard · melee · mana · 2009 · last rework: 2019 VG

- **P (Granite Shield):** A shield that refreshes after a few seconds without damage; he also grows with his armor.
- **Q (Seismic Shard):** Targeted rock that slows and copies the lost speed to him, so a chase turns into a catch-up.
- **W (Thunderclap):** Gives armor (more while the shield is up); active makes his next attack hit harder with a cone that lasts several seconds.
- **E (Ground Slam):** Ground slam around him that cuts attack speed.
- **R (Unstoppable Force):** Dash to a location he cannot be stopped in, then a knock-up in a circle.
- **Rhythm:** about Q 8-8 s, W 10-8 s, E 7-7 s, R 130-100 s. Everything but the R is under ten seconds; the R is the one big window of the round.
- **Loop:** close with the Q, trade with a shielded W, slam the E to blunt a melee enemy, land the R.
- **Decision:** when to spend the shield on damage versus keeping it as the reset he walks in with.
- **Counterplay:** the R is ground-targeted with a clear dash, so ranged enemies step out of the circle; keeping out of range with a slow-resistant build works.
- **Mastery:** aiming the R so the dash finishes on the enemy as they act.
- **For a duel:** Riot said the glow on his shield was added so a player can see when it is back, [PBE notes](https://www.surrenderat20.net/2019/07/71-pbe-update-demacia-vice-garen-lucian.html). Readable resource state is the design lesson; the kit is simple but plays well alone. [transfers]

### Malzahar, the Prophet of the Void
Battlemage · ranged · mana · 2010 · last rework: 2016 VG

- **P (Void Shift):** A periodic shield that ignores crowd control and cuts damage from champions until it breaks.
- **Q (Call of the Void):** Two portals open and, after a short wait, enemies between them are hurt and silenced.
- **W (Void Swarm):** Passive stacks from every cast; the active spawns small creatures that favour marked targets.
- **E (Malefic Visions):** Targeted damage over time; refreshed by his other spells, and spreads on a kill.
- **R (Nether Grasp):** Targeted suppress and channel with a damaging zone left under the target.
- **Rhythm:** about Q 6 s, W 8 s, E 11-7 s, R 140-80 s. The Q is up almost always; the R is the only long cooldown.
- **Loop:** silence with the Q, call the voidlings with the W, apply the damage over time with the E, then chain the R.
- **Decision:** when to hold the R, since his passive shield blocks the one stun the enemy might use to answer.
- **Counterplay:** the passive can be baited by one cheap hit; the Q has a visible portal delay and the R needs the enemy to be caught while the passive is down.
- **Mastery:** putting the Q so that the enemy dodges into the voidlings of the W.
- **For a duel:** this is a kit made of overlapping damage and a "no answer" ultimate. The passive is a nice trade-off that makes the opening move matter, but the suppress is hard to play against. [partly]

### Maokai, the Twisted Treant
Vanguard · melee · mana · 2011 · last rework: 2017 GR

- **P (Sap Magic):** Every few seconds, his next attack heals him; casting spells and being hit by spells shortens the wait.
- **Q (Bramble Smash):** Shockwave that damages, slows and knocks back enemies near him.
- **W (Twisted Advance):** Untargetable dash to an enemy with a root on arrival.
- **E (Sapling Toss):** Thrown sapling that chases and bursts; stronger if placed in brush.
- **R (Nature's Grasp):** Wall of roots that moves forward and speeds up; root length grows with distance travelled.
- **Rhythm:** about Q 7-5 s, W 14-10 s, E 18-14 s, R 130-90 s. The Q and W together are a short lock-down every twelve seconds or so; the E is slow to return.
- **Loop:** root with the W, knock with the Q, then walk with the healing attack.
- **Decision:** whether to spend the W to engage or keep it as an escape since it is untargetable.
- **Counterplay:** the W has a visible dash; the R wall is slow at first so side-stepping early is easy.
- **Mastery:** timing the Q to knock the enemy into the roots.
- **For a duel:** a 2017 midseason tank update, [PBE preview](https://www.surrenderat20.net/2017/04/418-pbe-update.html). Players disliked the brush-based sapling, which is a warning against a mechanic that relies on map cover. In an arena with cover it could work better. [partly]

### Master Yi, the Wuju Bladesman
Skirmisher · melee · mana · 2009 · last rework: 2013 VG

- **P (Double Strike):** Attacks build stacks; at three, an attack strikes twice.
- **Q (Alpha Strike):** Vanishes, marks up to four enemies near him, and returns to strike each; attacks reduce its cooldown.
- **W (Meditate):** Channelled heal and damage reduction that also builds the passive stacks.
- **E (Wuju Style):** Bonus true damage on attacks for a few seconds.
- **R (Highlander):** Speed, cleanse, and slow immunity; kills extend it and cut his other cooldowns heavily.
- **Rhythm:** about Q 20-18 s, W 10 s, E 14 s, R 85 s. The Q is very long but his attacks cut it, so it comes back during a fight; the R is short enough that it returns every round.
- **Loop:** Q in, E to hit, W to survive a burst, R to run down the one who flees.
- **Decision:** whether to spend the Q to dodge a spell or to dive.
- **Counterplay:** he has no way to stop hard crowd control apart from the R window; stun or root him before the R and he cannot do anything.
- **Mastery:** using the Q as a dodge during the enemy's long wind-up.
- **For a duel:** a one-button snowball. In a duel the R reset on kill hardly exists, so the kit is mainly Q and W; weaker as a source of rhythm than it is in a team fight. [5v5 only]

### Mel, the Soul's Reflection
Artillery · ranged · mana · 2025 · last rework: 2026 GR

- **P (Searing Brilliance):** Damage builds on a target as stored hits, and a hit that would kill detonates it all; casts also give her bolts for her next attack.
- **Q (Radiant Barrage):** Volley of bolts at a location; first blast is biggest. Hits on a champion cut its cooldown.
- **W (Rebuttal):** A nova that destroys enemy projectiles it touches and answers with bolts of its own; it also shields and speeds her.
- **E (Solar Snare):** Skillshot orb that roots longer the further it flies, and leaves a slowing field.
- **R (Golden Eclipse):** Global blast on everything with her stored damage, which needs at least one enemy champion marked.
- **Rhythm:** about Q 10-6 s, W 30-24 s, E 11-9 s, R 120-60 s. The W has by far the longest cooldown, so it is a once-a-fight answer.
- **Loop:** pile damage on the target, root at range, finish with the R.
- **Decision:** whether to keep the W for the enemy's best spell.
- **Counterplay:** the W's long cooldown is the window: bait it with a cheap skill. Stored damage fades if she stops hitting.
- **Mastery:** letting the E fly far for a long root.
- **For a duel:** Riot found that reflecting projectiles could not be strong without frustrating opponents, and removed it in patch 26.22 ([Riot](https://www.leagueoflegends.com/en-us/news/dev/dev-mel-midscope/)); the W above is the kit after that change. Analysis, not from Riot: the stored-damage idea is the part that suits a duel. [partly]

### Milio, the Gentle Flame
Enchanter · ranged · mana · 2023 · last rework: none

- **P (Fired Up!):** Any ability that touches an ally (or himself) makes that ally's next hit burn the enemy.
- **Q (Ultra Mega Fire Kick):** Kicked ball that knocks back the first enemy hit, then arcs over and lands on them with damage and a slow; half the mana back if it hits a champion.
- **W (Cozy Campfire):** A campfire that follows an ally, heals, and gives range.
- **E (Warm Hugs):** Targeted shield with speed; two charges.
- **R (Breath of Life):** Heal and cleanse in a circle, with a short lockout afterward.
- **Rhythm:** about Q 10-10 s, W 29-21 s, E 17-13 s, R 160-130 s. Long cooldowns on everything but the Q, so the Q does the work.
- **Loop:** kick, then speed or shield, then burn.
- **Decision:** whether to use the E on himself to dodge or to save the charge.
- **Counterplay:** the Q has a wind-up where he cannot cast anything else; sidestep it or trade at that moment.
- **Mastery:** hitting the Q so the bounce catches a second target.
- **For a duel:** most of the kit is for allies. Alone, the heal and the campfire have no one to go to, so the kit is dull and weak. A useful warning for any support in a team-less game. [5v5 only]

### Miss Fortune, the Bounty Hunter
Marksman · ranged · mana · 2010 · last rework: 2015 GR+VG

- **P (Love Tap):** Her attack on a new target deals extra damage; staying on the same target does not.
- **Q (Double Up):** Targeted shot that bounces to someone behind; crits on a kill.
- **W (Strut):** Passive speed when not hit; active gives attack speed. Switching targets shortens it.
- **E (Make It Rain):** Ground bullet rain that slows and cannot be cleansed.
- **R (Bullet Time):** Channelled cone of bullets for up to three seconds.
- **Rhythm:** about Q 7-3 s, W 12-12 s, E 18-14 s, R 120-100 s. The Q becomes almost free by max rank, so it is a second attack button.
- **Loop:** attack, switch target, Q, E to hold them, R to finish.
- **Decision:** when to switch targets for the passive.
- **Counterplay:** the R is a cone and she stands still, so the window is the channel. Hit her with crowd control or leave the cone.
- **Mastery:** walking away while the W speed builds.
- **For a duel:** Riot's 2015 update changed Strut and Love Tap ([Riot post, archived](https://surrenderat20.net/2015/07/champion-update-miss-fortune-struts-to.html)). With no minions, "switch targets" has no use alone; the passive is dead in a duel and needs a new rule. [partly]

### Mordekaiser, the Iron Revenant
Juggernaut · melee · other (shield) · 2010 · last rework: 2019 VG

- **P (Darkness Rise):** Stacks from hits; at three, he speeds up and an aura hurts nearby enemies.
- **Q (Obliterate):** Line smash that hits harder against one target.
- **W (Indestructible):** Stores damage as a shield; use it, then recast to turn the rest into healing.
- **E (Death's Grasp):** Claw that reveals a spot and drags enemies to him after a delay.
- **R (Realm of Death):** Banishes him and a champion to a private realm for seven seconds; he steals some of the stats.
- **Rhythm:** about Q 8-4 s, W 12-8 s, E 16-8 s, R 120-100 s. The E has the largest range, 16 s to 8 s, so rank matters.
- **Loop:** pull, smash, shield, heal; the R is a hard reset.
- **Decision:** whether to cast the W for shield now or recast for the heal.
- **Counterplay:** the E has a delay; step out of the claw. Nothing answers the R once it starts.
- **Mastery:** spending the shield and the heal in the right order.
- **For a duel:** Riot said the target's realm needed a new dimension system because the first prototype would not scale ([Riot](https://www.riotgames.com/en/news/welcome-death-dimension)). The R is a built-in 1v1, so the kit shows what a duel would feel like inside a team game. [transfers]

### Morgana, the Fallen
Catcher · ranged · mana · 2009 · last rework: none

- **P (Soul Siphon):** Heals her from damage dealt by abilities.
- **Q (Dark Binding):** Long, narrow skillshot that roots the first hit.
- **W (Tormented Shadow):** Ground pool that grows more damaging on low-health enemies.
- **E (Black Shield):** Shield for her or an ally that blocks magic and crowd control.
- **R (Soul Shackles):** Tethers close enemies, then stuns them if they stay near.
- **Rhythm:** about Q 10-10 s, W 12-12 s, E 26-16 s, R 120-100 s. The E starts long, so early on it is a once-per-fight spend.
- **Loop:** root, pool, hold position.
- **Decision:** spend the E now or keep it against the enemy's lock.
- **Counterplay:** the Q is one line; walk out of it. The R stun needs the enemy to remain near, so leave.
- **Mastery:** aiming the Q through the gap the enemy picks.
- **For a duel:** the Q-and-E pair is a simple, clear contest: one tries to lock, the other can block. That is the best 1v1 lesson in the batch. [transfers]

### Naafiri, the Hound of a Hundred Bites
Assassin · melee · mana · 2023 · last rework: 2025 GR

- **P (We Are More):** Packmates follow her and attack her targets; ability hits on champions bring the next one back sooner.
- **Q (Darkin Daggers):** Thrown dagger with a bleed; recast for free, and a second hit pays out the bleed and heals her.
- **W (The Call of the Pack):** Five-second hunt: untargetable at the start, faster, stronger, with extra dogs.
- **E (Eviscerate):** Dash that cuts a line, then blades burst; dogs vanish and return fully healed.
- **R (Hounds' Pursuit):** Singles out a champion, marks, and dashes at them; a kill allows a free recast.
- **Rhythm:** about Q 9-7 s, W 26-18 s, E 11-7 s, R 110-80 s. The pack returns faster than any one ability.
- **Loop:** Q, E in, W for the hunt, R on the weak one.
- **Decision:** which target gets the Q bleed, since it decides the heal.
- **Counterplay:** the dogs die fast; kill them first, or step back when she turns untargetable.
- **Mastery:** using the free recast of the Q to bounce between targets.
- **For a duel:** press reports (not Riot) say the 2025 update swapped W and R ([Sheep Esports](https://www.sheepesports.com/us/articles/lol-naafiri-to-get-a-midscope-rework/en)). Analysis, not from Riot: the pack is a good way to make a duel feel like a fight against more than one body. [transfers]

### Nami, the Tidecaller
Enchanter · ranged · mana · 2012 · last rework: none

- **P (Surging Tides):** Her abilities give allies a burst of speed.
- **Q (Aqua Prison):** Delayed bubble that stuns and lifts enemies.
- **W (Ebb and Flow):** Targeted water that bounces, healing allies and hurting enemies.
- **E (Tidecaller's Blessing):** Gives an ally or herself three bonus hits with a slow.
- **R (Tidal Wave):** Very long wave that knocks up and slows.
- **Rhythm:** about Q 12-8 s, W 10-10 s, E 11-11 s, R 120-100 s. Nearly flat cooldowns; the Q is the only one that improves much.
- **Loop:** bubble, empowered hits, wave.
- **Decision:** whether to lead the bubble where the enemy walks.
- **Counterplay:** the Q has a clear delay (under a second), so a step beats it; the R is slow and visible down its full length.
- **Mastery:** the bubble on a dash that has already started.
- **For a duel:** the delay on the Q is a perfect example of fairness. The rest of the kit has little to do alone. [partly]

### Nasus, the Curator of the Sands
Juggernaut · melee · mana · 2009 · last rework: none

- **P (Soul Eater):** Life steal that rises with level.
- **Q (Siphoning Strike):** Empowered attack that adds permanent damage whenever it kills.
- **W (Wither):** Targeted spell that slows and weakens an enemy more each second.
- **E (Spirit Fire):** Delayed ground fire that lowers armor.
- **R (Fury of the Sands):** Bigger, tougher, longer range and an aura for fifteen seconds; the Q returns faster.
- **Rhythm:** about Q 7.5-3.5 s, W 15-11 s, E 12-12 s, R 120-80 s. The Q cooldown is halved in the R window.
- **Loop:** stack, slow with W, fight in the R.
- **Decision:** when to spend the W, since it gets stronger over time.
- **Counterplay:** kite him before the W has ramped; stay out of the E.
- **Mastery:** farming the stacks; in a duel there are none to farm.
- **For a duel:** the W is the one great piece (slow ramps up, so early use is a gamble). The stacking Q needs minions and is useless in short rounds. [5v5 only]

### Nautilus, the Titan of the Depths
Vanguard · melee · mana · 2012 · last rework: none

- **P (Staggering Blow):** An empowered basic attack roots the target for a short time and adds damage; each target has a separate lockout before it can happen again.
- **Q (Dredge Line):** Anchor skillshot. On an enemy it stuns and drags them in while he dashes to them. On terrain it pulls him there and refunds half the cooldown.
- **W (Titan's Wrath):** A shield; for its duration his basic attacks leave a damage-over-time that spreads to nearby enemies.
- **E (Riptide):** Three expanding rings that slow, the later rings hitting for less.
- **R (Depth Charge):** A targeted charge that chases one champion and knocks up everything on its path, then erupts on the target with a stun.
- **Rhythm:** Q 14-10 s, W 12 s, E 7-5 s, R 120-80 s. The short E and the Q refund mean he always has something to press. The ultimate is the one long gap, and it opens a window where he has only the ordinary kit.
- **Loop:** Hook in, auto to root, ring to slow, shield and attack while the target is pinned; hook off a wall to leave.
- **Decision:** Throw Q at the enemy and risk a miss that leaves him standing at range, or throw it at a wall to reposition at half price and give up the engage. The R choice is similar: save it for the dive, or spend it now on someone about to escape.
- **Counterplay:** Q is a visible line with a wind-up, so sidestepping or standing behind another body works. The ultimate is a slow chase that can be dodged by breaking sight or going untargetable, and it cancels for free if the target does. The root cannot hit the same person again soon.
- **Mastery:** Using terrain hooks to close distance without committing, and spacing the first auto so the root lands as the stun ends.
- **For a duel:** Own analysis: a pull that doubles as a gap-closer when it misses is a strong way to make a miss cost less than a mistake. A chase ultimate that cancels free is clean and readable. [transfers]

### Neeko, the Curious Chameleon
Burst, Catcher · ranged · mana · 2018 · last rework: 2023 GR

- **P (Inherent Glamour):** She can copy the look of allies or of a stored non-champion unit. Attacking does not break it; any damaging ability does.
- **Q (Blooming Burst):** Ground bloom that repeats up to two more times if it hits a champion or kills.
- **W (Shapesplitter):** A clone runs off in a direction and copies her next cast; passively, two attacks stack into a bonus-damage hit with a speed burst.
- **E (Tangle-Barbs):** A spiral that roots; if it hits anyone it grows and the root gets longer.
- **R (Pop Blossom):** A wind-up of over a second, then a leap that knocks up and stuns around her.
- **Rhythm:** Q 9-7 s, W 16-12 s, E 12-10 s, R 120-90 s. Because the kit is mostly delay, the windows are about timing: the second bloom, the grown root, the landing.
- **Loop:** Bait with a clone or disguise, root to start the fight, bloom three times on the pinned target, finish with the ultimate under cover.
- **Decision:** Spend the clone to fake a position and hide, or hold it to make the cast she really wants look like a copy.
- **Counterplay:** Everything telegraphs. The ultimate shows the area to enemies for its full wind-up unless she is disguised, so they walk out of it. The root is a skillshot. The clone dies to damage.
- **Mastery:** Disguising so that the ultimate wind-up starts hidden; reading which spell the enemy will dodge.
- **For a duel:** Own analysis: in 1v1 there are no allies to copy, so the disguise is mostly dead; the clone is the part that remains. The wind-up-and-reveal ultimate is a good model of a strong spell with a readable answer. [partly]

### Nidalee, the Bestial Huntress
Specialist · ranged and melee · mana · 2009 · last rework: 2014 GR

- **P (Prowl):** Faster in brush; a hit by the javelin or a trap marks a target, revealing it and powering her first cougar attack and pounce on it.
- **Q (Javelin Toss / Takedown):** Human: a javelin whose damage grows with distance travelled. Cougar: an empowered attack that hits harder on low-health targets.
- **W (Bushwhack / Pounce):** Human: a hidden trap. Cougar: a dash that goes further and refunds time on a marked target.
- **E (Primal Surge / Swipe):** Human: a heal and attack speed. Cougar: a frontal arc.
- **R (Aspect Of The Cougar):** Switches form; a mark reset the human-form cooldown.
- **Rhythm:** Javelin 6 s, trap 13-9 s, heal 12 s, cougar spells 6 s each, switch 3 s. Hitting the javelin shortens the form switch, so the first hit starts the whole chain.
- **Loop:** Long javelin, mark, switch, pounce, takedown, swipe, switch back.
- **Decision:** Take the safe long-range poke and keep the kit human, or spend the mark on the all-in where a miss leaves her in melee and exposed.
- **Counterplay:** The javelin is one narrow line that can be dodged or blocked by a body; the cougar all-in has no escape once the pounce has been spent. Traps are visible to champion attacks and hurt only if stepped on.
- **Mastery:** Landing the javelin at full range, and laying traps on the path the enemy must walk.
- **For a duel:** Own analysis: the best lesson is a high-skill first hit that unlocks a second kit. Two forms mean a lot to learn, and the wiki's development history suggests she was long hard to catch. [transfers]

### Nilah, the Joy Unending
Skirmisher · melee · mana · 2022 · last rework: none

- **P (Joy Unending):** Shares extra experience and a share of ally heals and shields. Nearly dead in a duel, since it needs allies.
- **Q (Formless Blade):** A short whip line on a fast cooldown; any hit empowers her attacks for a few seconds with range and a cone.
- **W (Jubilant Veil):** A short veil of speed, dodging basic attacks and less magic damage; touched allies get it too.
- **E (Slipstream):** Two-charge dash through enemies; Q can be cast mid-dash to leave a wave.
- **R (Apotheosis):** About one second of spinning, then a burst that drags enemies in and heals.
- **Rhythm:** Q 4 s, W 26-22 s, E charges back every 26-12 s, R 110-80 s. The Q is nearly always ready, so what she is rationing is the dash.
- **Loop:** Q to power up, auto-auto-dash through, Q mid-dash for the wave, pull them back with the ultimate when they leave.
- **Decision:** Dash in now to open the fight, or keep a charge so she can leave or finish.
- **Counterplay:** She has to stay in melee reach after Q hits, so kiting past the empowered range works. The ultimate is a long spin that lets the enemy walk out, and she cannot attack or cast during it. Her heal depends on crits, so low crit means weak sustain.
- **Mastery:** Dash path and Q timing; using the veil's dodge to take a key auto.
- **For a duel:** Own analysis: a dash that resets the basic attack with a short-range Q that powers it is a clean, readable loop. The passive is dead weight in 1v1. [transfers]

### Nocturne, the Eternal Nightmare
Assassin · melee · mana · 2011 · last rework: none

- **P (Umbra Blades):** Every few seconds his next attack becomes a wide slash that heals him; hitting shortens the wait, champions most of all.
- **Q (Duskbringer):** Shadow-blade line that leaves a trail on champions, giving him speed, damage and ghosting along it.
- **W (Shroud of Darkness):** Passive attack speed; the active is a brief spell shield that boosts it further if it blocks something.
- **E (Unspeakable Horror):** Tether: if the target stays tethered, they are feared and slowed.
- **R (Paranoia):** Shrinks all enemy sight, and a recast dashes him to a chosen champion for burst.
- **Rhythm:** Q 8 s, W 20-12 s, E 15-11 s, R 160-100 s. The shield is on a long cooldown against the E that is short enough to be used often; the ultimate is a rare event.
- **Loop:** Q, run the trail, E to tether, fear starts, hit and heal with the passive slash, spell shield the answer, R in if it needs finishing.
- **Decision:** Hold W for the enemy's key spell, or use it early for a mere damage bump; and whether to dash onto the target or stay to use the trail.
- **Counterplay:** The tether can be broken by moving away before it ends. The Q is a line that can be sidestepped. The shield blocks only one spell, and the enemy can bait it with a weak one.
- **Mastery:** W timing against the one spell that matters; using the trail's path to close.
- **For a duel:** Own analysis: a spell shield with a payoff when it works is a good duel tool because it punishes the enemy for casting. The darkness ultimate matters less when there is only one opponent. [transfers]

### Nunu & Willump, the Boy and His Yeti
Vanguard · melee · mana · 2009 · last rework: 2018 VG

- **P (Call of the Freljord):** Damaging a champion gives an ally and themselves speed and attack speed; Willump's attacks splash.
- **Q (Consume):** A bite that damages and heals him, healing more when low.
- **W (Biggest Snowball Ever!):** A channelled, steerable snowball that grows with charge time; hits knock up and stun for longer the longer it was charged.
- **E (Snowball Barrage):** Three snowballs; one hit marks the target, and they root a moment later if they stay near Willump. It can be recast twice.
- **R (Absolute Zero):** A channelled blizzard with a shield and a growing slow, then an explosion.
- **Rhythm:** Q 13-9 s, W 14 s, E 14-10 s, R 110-90 s. The W is the same at every rank, so levelling gives cost and damage, not tempo.
- **Loop:** Start the snowball from afar, steer it, release for the stun, E to root and hit, bite to sustain.
- **Decision:** Release early for a short stun that lands, or hold for a long one that the enemy can walk away from.
- **Counterplay:** The snowball is easy to read by its size and direction; sidestep late, since it is steered. The blizzard channel can be interrupted by any hard control. In a duel they can also simply walk out of E's root zone.
- **Mastery:** Charge exactly long enough for the stun to matter; steering around corners.
- **For a duel:** Own analysis: steering a charged projectile and letting the player trade stun length for risk is a transferable idea. The passive ally buff is lost in 1v1. [transfers]

### Olaf, the Berserker
Diver · melee · mana · 2010 · last rework: 2022 GR

- **P (Berserker Rage):** The lower his health, the more attack speed and life steal he has.
- **Q (Undertow):** An axe thrown to a spot that slows and cuts armor; he can pick it up to refund cooldown.
- **W (Tough It Out):** Attack speed and a shield sized by missing health; resets his attack timer.
- **E (Reckless Swing):** Pays health to deal unblockable damage; refunds that health if it kills. Each hit he lands shortens its cooldown.
- **R (Ragnarok):** Immune to hard control, extra armor, and the ability to extend the duration by hitting champions.
- **Rhythm:** Q 9 s fixed, W 16-12 s, E 11-7 s, R 100-80 s. A fixed Q means picking up the axe is the only way to speed it.
- **Loop:** Throw axe, step on it, W into the fight, auto to shorten E, E to finish, and R to stay.
- **Decision:** Spend health on E now for damage, or stay healthy so the passive's strength is not needed; and whether to cast R early for immunity or save it against a stun.
- **Counterplay:** Axe lands as a visible target. The R extends only on champion hits, so kiting him can end it. Burst while he is below mid health is risky because the passive heals him, so fighting at the right moment matters.
- **Mastery:** Picking the axe up on the way in; timing R to break the stun that was meant to kill him.
- **For a duel:** Own analysis: a self-damage trade and a hard-control immunity that only lasts while he connects is an excellent duel pattern because it forces the opponent to deny contact. [transfers]

### Orianna, the Lady of Clockwork
Burst · ranged · mana · 2011 · last rework: none

- **P (Clockwork Windup):** She is followed by a ball that her spells move; her attacks stack a bonus for two hits, and attacking something else resets it.
- **Q (Command: Attack):** Sends the ball to a place, hitting along the way, and it stays there.
- **W (Command: Dissonance):** The ball pulses, damaging and leaving a field that speeds allies and slows enemies.
- **E (Command: Protect):** Sends the ball to an ally (or herself) with a shield; the ball also gives its holder defence.
- **R (Command: Shockwave):** After half a second, the ball pulls enemies to it and stuns.
- **Rhythm:** Q 7-3 s, W 7 s, E 9 s, R 110-80 s. Q is the only spell that falls hard with rank, so late in the game she moves the ball constantly.
- **Loop:** Q out to a place, W when the enemy reaches it, E the ball back, hold R for the moment the ball sits on the enemy.
- **Decision:** Leave the ball forward to threaten the ultimate and the field, or bring it back for defence; the ultimate is only as good as where the ball currently is.
- **Counterplay:** The ball is visible, so the enemy always knows where the ultimate will happen; the cast takes half a second, and they can leave the circle, kill her, or use a dash.
- **Mastery:** Ball placement two spells ahead, and taking the ball through a target on the way back.
- **For a duel:** Own analysis: a visible object on the map that spells are anchored to is a strong 1v1 idea, since the opponent can see and play around it. [transfers]

### Ornn, the Fire Below the Mountain
Vanguard · melee · mana · 2017 · last rework: none

- **P (Living Forge):** Buys items from anywhere after a long, interruptible channel and upgrades items for himself and allies later in the game. Separately, Brittle (applied by his spells) makes his basic attacks knock the target back, lengthens CC on it, and pops for percent-health damage when he roots, stuns or silences it.
- **Q (Volcanic Rupture):** A slow fissure in a line; a pillar erupts at the end after a clear delay, shoving enemies and standing as temporary wall.
- **W (Bellows Breath):** A short lunge through enemies, breathing fire in a cone; the last tick applies Brittle.
- **E (Searing Charge):** A charge in a line. If he hits terrain (including his own pillar) a shockwave knocks up and stuns; a Brittle target is stunned longer.
- **R (Call of the Forge God):** A huge wave of lava sent at him from far away; he can recast to dash into it and throw it back, doubling the hit and adding a knock-up.
- **Rhythm:** About Q 9-7 s, W 12-10 s, E 14-12 s, R 140-100 s. Q is short enough to be used on every cycle; E is the long cooldown that decides when he can really commit.
- **Loop:** Drop a pillar, lunge in to mark with Brittle, then charge into the pillar or a wall for the extended stun and finish with auto-attacks that shove. The ultimate is a second, slower round of the same pattern.
- **Decision:** Whether to spend Q early as a slowing poke, or hold it so the pillar is a guaranteed anvil for E. Spending it gives damage now; holding it gives a stun later, but the opponent sees the pillar and walks away from it.
- **Counterplay:** The pillar and the charge are both telegraphed. Stepping out of the pillar's delay, or staying away from walls, takes the stun away. The ultimate wave is slow and visible for a long time, so the answer is to avoid being near terrain when he recasts.
- **Mastery:** Placing a pillar where the enemy will be forced to walk, then lining the charge so the pillar is the wall. Also knowing the recast timing of R so both passes land.
- **For a duel:** His own terrain is the model: the kit turns ordinary cover into a weapon and gives the opponent a visible delay to read. The shop passive is irrelevant. Riot's reveal post: [Champion Reveal: Ornn](https://www.surrenderat20.net/2017/08/champion-reveal-ornn-fire-below-mountain.html). [transfers]

### Pantheon, the Unbreakable Spear
Diver · melee · mana · 2010 · last rework: 2019 VG

- **P (Mortal Will):** Every attack or spell builds a stack; at five, the next basic ability is empowered, and he starts a fight with a full set.
- **Q (Comet Spear):** A spear thrust that is either a quick tap with a partial cooldown refund or a held charge that throws it further; extra damage on weak targets.
- **W (Shield Vault):** A targeted leap that stuns on arrival; the empowered version also sets up a three-hit combo attack.
- **E (Aegis Assault):** A shield held in one direction that makes him immune from that side while it damages a cone; recast slams, and the empowered form adds defence and speed.
- **R (Grand Starfall):** A long channel that takes him off the map, then a second channel before he crashes down at the chosen point with a spear and shockwave.
- **Rhythm:** About Q 11-8 s, W 13-9 s, E 22-18 s, R 180-150 s. The tap Q lets him fill stacks fast, so the empowered ability comes round more often than any cooldown suggests.
- **Loop:** Stun in with W, finish the three-hit empowered strike, tap Q to rebuild stacks, then hide behind E when the target counter-attacks. The ultimate is a way into the fight that restores a full stack.
- **Decision:** Tap the Q for safety and stack speed, or hold it for the long throw that punishes someone running. The tap is reliable; the throw is a gamble that wins more when the enemy is already low.
- **Counterplay:** W is point and click, but the shield on E blocks only one direction, so stepping around it works. R shows where he will land and the channel is long enough to avoid or kill the zone.
- **Mastery:** Counting stacks so the stun and the combo come out together, and facing E toward the right side.
- **For a duel:** A clear case of a passive turned into a rhythm that the player can see and feed. Riot's own breakdown: [kit breakdown](https://blogoflegends.com/2019/07/30/league-of-legends-pantheon-rework-kit), plus the [roadmap post](https://nexus.leagueoflegends.com/en-us/2019/04/champion-roadmap-april-2019/) where the lead said the aim was to modernise him rather than reimagine him. [transfers]

### Poppy, Keeper of the Hammer
Warden · melee · mana · 2010 · last rework: 2015 VG

- **P (Iron Ambassador):** Her next attack is a thrown buckler on a cooldown; it lands near the target and she can pick it up for a shield, or the enemy can step on it to break it.
- **Q (Hammer Shock):** A hammer smash down a line that slows with a field, then ruptures for the same damage a moment later.
- **W (Steadfast Presence):** Passive armour and magic resist that grow when she is low; active gives speed and an aura that stops anyone who dashes into it, then slows and grounds them.
- **E (Heroic Charge):** She dashes to a target and drags them with her; if they hit a wall, a second hit and a stun.
- **R (Keeper's Verdict):** A charged hammer swing; the quick version is a small knock-up, the held version launches enemies far away from her.
- **Rhythm:** About Q 8-4 s, W 20-12 s, E 14-10 s, R 140-100 s. Q's cooldown falls enough to keep the field up often; W and E are the commitments.
- **Loop:** Close the gap, drag the enemy to a wall with E, and keep them in the Q field. W waits as an answer to the dash that tries to escape.
- **Decision:** Spend W now to get speed and presence, or keep it for the enemy's own dash. Spending it gives a faster chase; holding it risks no gap closer from her side but can remove their best escape.
- **Counterplay:** E sets its direction at cast, so a sidestep or a flash leaves her empty-handed. Without a nearby wall the E stun does not happen. A charged R can be cancelled for a long cooldown if she is interrupted.
- **Mastery:** Choosing a position that has a wall behind the opponent, and holding W for one dash.
- **For a duel:** W is a pure counter-move that makes the opponent consider using their escape. The wall rule suits an arena with cover, but E is weak without it. Riot post: [Keeper of the Hammer](https://archive.runeterra.net/na/riot-official/Yn7U1aot). [transfers]

### Pyke, the Bloodharbor Ripper
Assassin, Catcher · melee · mana · 2018 · last rework: none

- **P (Gift of the Drowned Ones):** His maximum health never grows from items; bonus health becomes damage. Damage taken is stored as grey health, more when several enemies are near, and he heals it when out of sight.
- **Q (Bone Skewer):** Held to extend range, then released to throw a harpoon that pulls the first enemy and slows; an early release is a short stab.
- **W (Ghostwater Dive):** Camouflage with a speed burst for several seconds that ends when he attacks or casts, and it warns nearby enemies.
- **E (Phantom Undertow):** A dash that leaves a phantom behind, which returns after a second and stuns everyone it passes.
- **R (Death From Below):** An X-shaped strike that kills anyone under a health line and blinks him to the middle; it can be recast free if a champion dies.
- **Rhythm:** About Q 10-8 s, W 14-10 s, E 15-11 s, R 100-70 s. Most of his tools are on a similar timescale, so the combo of E, Q and R fits inside one rotation.
- **Loop:** Hide with W, pull with Q, stun with E, and strike with R if the target falls under the line.
- **Decision:** Hold the long Q charge for range, or release early for safety. The long throw is a big hit if they stand still, but its delay and the slow he has while charging give the enemy time.
- **Counterplay:** The charge is audible and visible, so the answer is to walk out of line and keep close to blockers. E can be dodged by leaving, since the stun comes after the dash.
- **Mastery:** Judging the threshold so R is a guaranteed kill, and the order of Q then E.
- **For a duel:** The passive trades survival for a reason to be risky, and R tells the opponent exactly when they are in danger. The warning in W is the key fairness idea. Riot gave context on the origin in [the making of Pyke](https://pcgamesn.com/league-of-legends/league-of-legends-making-of-pyke-bloodharbor-ripper) and the [development page](https://wiki.leagueoflegends.com/en-us/Pyke/Development) quoting the design lead. [transfers]

### Qiyana, Empress of the Elements
Assassin · melee · mana · 2019 · last rework: none

- **P (Royal Privilege):** Her spells and attacks add extra damage to a target, and cannot hit the same one again for a short time.
- **Q (Elemental Wrath / Edge of Ixtal):** A short line skillshot; with an element, it becomes a stronger version.
- **W (Terrashape):** She dashes to a nearby patch of terrain, brush or river and takes its element, which gives her speed, range and damage.
- **E (Audacity):** A dash through an enemy that hits if she ends close enough and can be used while casting.
- **R (Supreme Display of Talent):** A windblast that pushes and shockwaves at brush, river or a wall, stunning enemies nearby.
- **Rhythm:** About Q 7-7 s, W 7-7 s, E 11-7 s, R 120-120 s. Q and W share the same short cooldown and W resets Q, so the kit can act almost constantly.
- **Loop:** W to pick up an element, E onto the target, Q for the upgraded hit, then R if they stand beside a wall or water.
- **Decision:** Take the element that matches the area, or one that matches the next ability. Using Q with the brush element gives hidden approach; the river gives a quick slow; terrain gives a stun.
- **Counterplay:** R's windblast is blocked by projectile blocks, and a spell shield cancels it. The enemy can stay away from walls, brush and water, but this is hard on a small arena.
- **Mastery:** Using R from a place so that the shockwave covers the enemy whatever they do, and keeping all three elements in mind.
- **For a duel:** The map shapes the kit, which is a good lesson for a game with cover. It is a weak kit for a new player because of the number of terrain types to remember, and the R can feel unfair when the map is small. See [Riot's art director on the faction](https://magazine.artstation.com/2019/06/riot-games-league-of-legends-yuumi-mordekaiser-qiyana-art-blast/); no Riot design post found. [partly]

### Quinn, Demacia's Wings
Specialist · ranged · mana · 2013 · last rework: 2015 GR

- **P (Harrier):** Her damaging abilities mark enemies, and her next attack on a marked target deals bonus damage and gives her speed.
- **Q (Blinding Assault):** Her bird Valor flies out to the first enemy, damaging nearby foes and blinding a champion.
- **W (Heightened Senses):** Passive speed boost on a mark; the active reveals an area for a short time.
- **E (Vault):** A dash to an enemy that knocks them back and slows, then a hop back away.
- **R (Behind Enemy Lines):** A channel that makes her fast and ghosted; the second cast is an arrow volley around her.
- **Rhythm:** About Q 11-9 s, W 50-30 s, E 12-8 s, R 3 s (the first cast is a flat short cooldown). Q and E stack up quickly and W is rare.
- **Loop:** Q to blind and mark, auto the marked target for burst, E for the knock-back and escape, repeat.
- **Decision:** Use the Q to blind early and stay at range, or hold it for the moment the target is about to attack. Early use keeps the enemy off her but costs the cooldown when the blind matters most.
- **Counterplay:** The bird is a visible line, so the answer is to step out of line. E can be dodged because it needs her to reach the target. R takes two seconds to channel and breaks with any CC.
- **Mastery:** Chaining attack, E and the next attack without losing time, and judging the hop-back so she is not trapped.
- **For a duel:** Blind and a hop are cheap to understand, and the blind gives the opponent an answer in the form of a stand-off. R is a map-travel tool that is of little use in a small arena. No Riot post on the 2015 update found, so this is analysis, not from Riot. [partly]

### Rakan, the Charmer
Catcher · melee · mana · 2017 · last rework: none

- **P (Fey Feathers):** A shield that returns on a cooldown that falls with every hit on an enemy champion.
- **Q (Gleaming Quill):** A feather skillshot that damages; if it hits, a healing circle forms around him after a moment, or immediately if an ally touches it.
- **W (Grand Entrance):** A dash to a place that knocks enemies up after a delay.
- **E (Battle Dance):** Shield an ally and dash to them, with a free recast.
- **R (The Quickness):** A short sprint through enemies that charms and slows each one.
- **Rhythm:** About Q 11-7 s, W 14-10 s, E 20-12 s, R 130-90 s. Passive shield returns in 40 to about 13 s depending on level, faster with hits.
- **Loop:** W in with a delay, R through the group for the charm, then Q to heal and shield.
- **Decision:** Dash in with W first to knock up, or open with R to charm and risk nothing. R first is reliable; W first is a gamble on a delay.
- **Counterplay:** W's delay is plain to see; a quick side-step avoids it. R can be dodged by not standing in line; a spell shield blocks the damage.
- **Mastery:** Timing R so the W lands afterwards, and using the shield on the next fight.
- **For a duel:** The kit needs an ally to be strong. E is almost dead without one, and Q's heal is a tiny gain alone. It is a clean example of a support kit that does not transfer. [5v5 only]

### Rammus, the Armordillo
Vanguard · melee · mana · 2009 · last rework: 2021 VG

- **P (Spiked Shell):** Gains attack damage from his armour and magic resist.
- **Q (Powerball):** A roll that speeds up while he steers it and ends on the first enemy, knocking back and slowing them.
- **W (Defensive Ball Curl):** A stance that raises resists and hurts anyone who attacks him in melee.
- **E (Frenzying Taunt):** A targeted taunt at short range.
- **R (Soaring Slam):** A leap to a place, a slow, and three aftershocks; used during Q it adds a knock-up.
- **Rhythm:** About Q 12-6 s, W 7-7 s, E 12-12 s, R 120-90 s. W has a short fixed cooldown but ends if he casts Q.
- **Loop:** Roll to close, taunt, curl up while they hit him, and use R to catch the one that runs.
- **Decision:** Keep rolling for more speed or stop early for the hit. A longer roll catches a fleeing target but gives them time to turn, and a short roll is safer but gives less surprise.
- **Counterplay:** Rolling is loud and gives a direction, so the answer is to step aside; ranged attackers are not hurt by W, and the taunt is short.
- **Mastery:** Rolling into R for the knock-up, and curling at the moment the enemy starts a long attack.
- **For a duel:** The speed ramp is an excellent shape of tension: faster is more dangerous but more easily dodged. W is weak against ranged heroes. Riot's pages: [PBE update](https://www.surrenderat20.net/2021/04/42-pbe-update-rammus-update-skin-bios.html) and the [development page](https://wiki.leagueoflegends.com/en-us/Rammus/Development). [transfers]

### Rek'Sai, the Void Burrower
Diver · melee · fury · 2014 · last rework: 2024 GR

- **P (Fury of the Xer'Sai):** Hits and ability connects build Fury; Fury drains out of combat, and while burrowed she spends it to heal.
- **Q (Queen's Wrath / Prey Seeker):** Above ground, a three-hit attack-speed modifier that splashes. Burrowed, a void bolt that explodes on the first enemy and reveals.
- **W (Burrow / Un-burrow):** The toggle between the two states. Unburrowing knocks up nearby enemies; burrowing gives speed, ghosting and tremor sense but short range.
- **E (Furious Bite / Tunnel):** Above ground, a bite that turns to true damage at full Fury. Burrowed, a dash that leaves a linked tunnel pair anyone can use.
- **R (Void Rush):** Marks a champion, then pounces on them with a health-based hit, briefly untargetable while casting.
- **Rhythm:** Q 4-2 s, W 4 s down and 1 s up, E 6 s (bite) or 18-14 s (tunnel), R 120-80 s. Short cooldowns on the toggle mean the real timer is the tunnel cooldown and the ultimate.
- **Loop:** Burrow, move unseen, unburrow under the target for the knock-up, chew through three empowered hits and a Fury-boosted bite, then burrow to heal and reposition.
- **Decision:** Stay above ground for damage and the full Fury bite, or burrow for speed, healing and tunnel setup. Burrowing is safer and mobile but she cannot kill from it; staying up kills but exposes her.
- **Counterplay:** The unburrow knock-up has a clear lead-in: she stops moving and surfaces. Stepping on a tunnel entrance destroys it, so a laid network can be dismantled. The ultimate cancels if the target gets far enough away or dies.
- **Mastery:** Placing tunnels on both sides of cover so one dash opens an escape or a surprise angle, and timing the unburrow to land the knock-up as an ally or the second hit follows.
- **For a duel:** The two-state kit is readable in a duel because the state is visible and the knock-up is telegraphed; the tunnels work as terrain you author on an arena with cover. Weak point: Riot reshaped her in 2024 toward a bruiser and players called it a loss of identity (secondary reports only, no Riot post found). [transfers]

### Rell, the Iron Maiden
Vanguard · melee · mana · 2020 · last rework: 2024 GR

- **P (Break the Mold):** Her hits and spells stack a debuff that lowers the target's armor and magic resist and gives her the same amount; hits deal bonus magic damage from her own defences.
- **Q (Shattering Strike):** A lance lunge that breaks shields on the way, damages and stuns.
- **W (Ferromancy: Crash Down):** Ferromancy: two forms of one button. Mounted, she leaps to a spot, shields, and knocks up on landing, then slides on. Dismounted, she remounts and her next hit charges and flings the target.
- **E (Full Tilt):** Speeds her and an ally; her next hit or lance adds an explosion based on the target's max health.
- **R (Magnet Storm):** Pulls all nearby enemies in, then keeps a damaging field that continues to drag them toward her.
- **Rhythm:** Q 11-9 s, W 10 s, E 14-10 s, R 120-80 s. The W alternates states, so the same button is always a different threat on every other press.
- **Loop:** Stay mounted to close, crash down for the stun, fight dismounted with range and defence, remount into a charged hit when the target runs.
- **Decision:** Remount for speed and the fling, or stay dismounted for bonus resistances, range and attack speed. Mounted catches and starts fights; dismounted wins them but cannot chase.
- **Counterplay:** The leap has a visible airtime and a landing spot, and the lance cannot start while she is rooted or silenced. The ultimate has a clear pull; spreading out or using a dash to leave before the second tick limits it.
- **Mastery:** Chaining the mount-up charged attack into the lance for two stuns, and using the shield-breaking lunge to punish shielded targets.
- **For a duel:** A state toggle that changes what one button does is a strong way to give a 4-button hero more than four options. Riot's own framing was to lean into the mounted and dismounted fantasy ([secondary report of the 2023 update](https://www.esports.net/news/lol/rell-mid-scope-update)). [transfers]

### Renata Glasc, the Chem-Baroness
Enchanter · ranged · mana · 2022 · last rework: none

- **P (Leverage):** Her attacks mark an enemy; her ally's damage consumes the mark for bonus health-based damage.
- **Q (Handshake):** A hook that roots and tethers her to the target; recast to throw the target along the aim line, stunning those it hits.
- **W (Bailout):** Gives herself or an ally ramping speed; if they would die they are restored to full and then burn down, unless they score a takedown first.
- **E (Loyalty Program):** Two rockets that merge and explode: shield on friends, slow and damage on enemies.
- **R (Hostile Takeover):** A slow chemical cloud that turns enemies berserk so they attack the nearest unit by priority, their own allies first.
- **Rhythm:** Q 16 s flat, W 28-24 s, E 14-10 s, R 150-110 s. The long W and R set clear windows where one side has the big spell.
- **Loop:** Hook, throw them into the ally's line, shield and slow, then spend the ultimate on a clump so the enemy fights itself.
- **Decision:** Throw the hooked target into the ally's reach or hold the recast to keep the tether and root longer. Using the W to save the life now or to save it for the ultimate fight.
- **Counterplay:** The hook is a visible line skillshot that a minion or terrain blocks. The ultimate has a 0.75 s cast and a slow cloud, so it can be sidestepped; the berserk lasts only 1.25 to 2.25 s.
- **Mastery:** Placing the cloud so the berserk targets are inside their own ally crowd; knowing when W's life-save is worth the burn.
- **For a duel:** The ultimate depends on other units, so it has little to hit in a duel. Riot did not design it for that: a developer interview mentions a bug where the enemy team was credited with the kills ([Upcomer](https://upcomer.com/?p=112957)). The hook-throw does transfer. [partly]

### Renekton, the Butcher of the Sands
Diver · melee · fury · 2011 · last rework: none

- **P (Reign of Anger):** Hits and spell connects build Fury (a bit faster when he is low on health); at 50 Fury his next basic ability spends it for an extra effect.
- **Q (Cull the Meek):** A spin that heals him for each enemy hit, and builds Fury; empowered, it triples the healing.
- **W (Ruthless Predator):** His next hit strikes twice and stuns; empowered, it hits three times, strips shields and stuns longer.
- **E (Slice and Dice):** A dash through enemies, recastable within a few seconds if the first one hit.
- **R (Dominus):** Grows him, gives health and a damaging aura, and generates Fury over time.
- **Rhythm:** Q 7 s flat, W 16-8 s, E 16-10 s, R 120-80 s. Q recurs often, so he always has a Fury source nearby.
- **Loop:** Dash in, hit to build Fury, stun with W on the empowered strike, spin for the heal, dash out with the second E.
- **Decision:** Spend Fury at 50 on W for the long stun or on Q for a larger heal, or keep it banked. Empowered W kills a shielded opponent's plan; empowered Q wins the long trade.
- **Counterplay:** The W stun needs a basic attack, so keeping away to dodge the windup avoids it. Dash recast is visible and the two-dash pattern lets the opponent predict the exit. Kiting him without a gap closer is easy because the dashes have a long cooldown.
- **Mastery:** Using the second dash to leave a trade right after the empowered stun, and saving 50 Fury for the right ability.
- **For a duel:** The "bank it or spend it now" meter is clear and works with no minions. The Q heal depends on hitting something, which hurts if there is only one target, but still rewards commitment. [transfers]

### Rengar, the Pridestalker
Assassin, Diver · melee · ferocity · 2012 · last rework: 2016 GR

- **P (Unseen Predator):** Basic abilities build Ferocity pips; at four, the next one is empowered with an extra effect. In brush he leaps at targets, and he earns permanent attack damage per champion takedown.
- **Q (Savagery):** Attack-speed boost for two empowered hits; the first has extra damage, range and can crit.
- **W (Battle Roar):** Roars at nearby enemies and heals himself the recent damage he took; empowered, it also removes crowd control.
- **E (Bola Strike):** A bola line that slows and reveals; empowered, it roots instead.
- **R (Thrill of the Hunt):** Speed boost, then stealth after a delay; his next hit on a marked or nearby enemy deals extra damage and reduces armor.
- **Rhythm:** Q 6-4 s, W 16-10 s, E 10 s flat, R 100-80 s. The short Q cooldown is what builds the fourth pip quickly.
- **Loop:** Ambush from brush, hit, empower the E to root, finish with the other abilities, then use the W to reset the damage.
- **Decision:** Spend pips early for a quick cast or hold four for the empowered effect. The empowered E root or W cleanse is a better answer to a specific threat than three weak casts.
- **Counterplay:** Brush is the danger zone: staying out of it denies the leap. The ultimate's stealth begins only after 2 seconds, and the bola is a line he must aim. A stun-cleanse W is the one answer to crowd control.
- **Mastery:** Choosing which empowered ability to hold for, and landing the leap from outside normal range.
- **For a duel:** The pip counter is a very legible resource, and the empower swap-by-situation is a strong idea. The brush leap needs cover, which fits an arena. Riot said in 2016 that the update changed how he takes down prey ([Assassin Roster Update](https://archive.runeterra.net/na/developer-corner/hYn5EO3E)). [transfers]

### Riven, the Exile
Skirmisher · melee · none · 2011 · last rework: none

- **P (Runic Blade):** Each ability cast adds a charge (up to three) that her next basic attack spends for bonus damage.
- **Q (Broken Wings):** Three recastable dash-slashes with a very short pause between; the third knocks back.
- **W (Ki Burst):** A short burst that damages and stuns around her.
- **E (Valor):** A short dash with a shield.
- **R (Blade of the Exile):** Boosts her damage and range for 15 seconds, and unlocks a cone that hits harder on low-health targets.
- **Rhythm:** Q 13 s flat, W 11-7 s, E 10-6 s, R 120-60 s. The three Q casts share one cooldown and expire in a few seconds, so the burst is a single window.
- **Loop:** E in, W stun, Q once or twice between attacks, finish with the third Q and the ultimate cone.
- **Decision:** Chain all abilities for a burst and be exposed, or take one Q and a trade and leave. Using E for shield versus distance.
- **Counterplay:** The W comes out almost at once, so the answer is spacing: stay outside its small radius. Once her three Q casts, W and E are spent she has nothing left for several seconds, so the punish is immediate. The ultimate cone is a visible line.
- **Mastery:** Cancelling the attack animation between casts, which community players treat as the central skill (secondary sources only; no Riot statement found).
- **For a duel:** A weakness: the skill ceiling depends on animation canceling and input timing, not on decisions. But the shared three-cast window is a good rule for a 1v1. [transfers]

### Rumble, the Mechanized Menace
Battlemage · melee · heat · 2011 · last rework: none

- **P (Junkyard Titan):** Casting basic abilities builds Heat; from 50 Heat they are empowered, at 100 Heat abilities shut off for about four seconds while his attacks get faster and deal max-health magic damage.
- **Q (Flamespitter):** A three-second cone flamethrower that scorches.
- **W (Scrap Shield):** A brief shield with a speed burst.
- **E (Electro Harpoon):** A harpoon that slows and shreds magic resistance; he stores two charges.
- **R (The Equalizer):** A line of rockets that leaves slowing fire fields.
- **Rhythm:** Q 10-6 s, W 6 s flat, E 0.5 s with a 6 s recharge, R 130-80 s. The abilities are meant to be used almost every few seconds, so the cooldowns hardly matter and Heat is the real limiter.
- **Loop:** Build Heat to 50 with short casts, burn in the empowered zone, and decide whether to go to 100 and be silent but dangerous in melee.
- **Decision:** Hold just under overheat to stay empowered, or overheat on purpose for the attack-speed surge. Overheating wins a short, close fight but he cannot cast his shield or harpoon when it happens.
- **Counterplay:** The overheat is visible and fixed in length, so an opponent can run during the four seconds when he has no spells. The Q is a cone he must stand in range of, so spacing denies it.
- **Mastery:** Managing the Heat bar so empowerment is constant and overheat arrives at a chosen moment; placing the ultimate so the fire fields cut off an exit.
- **For a duel:** The meter that punishes spamming and rewards deliberately breaking it is a strong, readable idea; the silence window makes a clear counterplay moment. [transfers]

### Ryze, the Rune Mage
Battlemage · ranged · mana · 2009 · last rework: 2016 VG

- **P (Arcane Mastery):** His maximum mana grows with ability power.
- **Q (Overload):** A bolt that hits the first enemy; casting any basic ability refreshes it, so it fires again at once.
- **W (Rune Prison):** Seizes a target to slow it; against a Fluxed target it roots instead.
- **E (Spell Flux):** An orb that damages and marks nearby enemies with Flux; his other abilities then pay off against Fluxed targets.
- **R (Realm Warp):** A two-second channel opens a portal; he and allies in it blink to the destination, untargetable for a moment. It also makes his Q and W stronger.
- **Rhythm:** Q 5 s but reset by his other casts, W 11-9 s, E 3.5-2.5 s, R 180-140 s. Short E and constant Q resets make his rotation continuous; the ultimate is on a separate, very long timer.
- **Loop:** E to mark, W to root, then Q once, E again, Q again, because each cast clears the Q cooldown.
- **Decision:** Spend E immediately for the Flux, or hold it so the W root is available. Cast the order that prioritises the root or the damage.
- **Counterplay:** All of his casts target an enemy or a line, so cover blocks Q and a spell shield stops the whole chain. The root takes a cast time during which the target may become untargetable, and then he wastes no mana. The portal is a channel, and interrupting it cancels it.
- **Mastery:** The order of casts so that Flux, the Q reset, and the root all land without a gap.
- **For a duel:** A combo whose order is chosen by the player and whose reward is a root is a good duel lesson. Riot's 2016 changes turned him from a point-and-click mage into a combo champion (secondary report, [Riot red posts via Surrender at 20](https://www.surrenderat20.net/2016/06/628-pbe-update-ryze-champion-update.html)). The portal is the 5v5-only part. [partly]

### Samira, the Desert Rose
Marksman · ranged · mana · 2020 · last rework: none

- **P (Daredevil Impulse):** Hits that differ from the previous one (a different ability or attack) build up to six Style stacks, which give speed. Her close-range blade attacks add missing-health damage, and attacking a CC'd enemy dashes her out to attack range (a knocked-up target is held up briefly).
- **Q (Flair):** Directional shot, or a cone slash if someone is in melee range.
- **W (Blade Whirl):** A short spin that destroys enemy projectiles and hits twice; she cannot attack or cast Q during it.
- **E (Wild Rush):** Targeted dash through a unit, with attack speed afterwards; a takedown shortly after damage resets it.
- **R (Inferno Trigger):** Costs all six Style stacks. About two seconds of automatic fire at everything near her, while she moves slowly.
- **Rhythm:** Q 6-2 s, W 30-22 s, E 20-12 s, R 5 s flat, but gated by Style. Q is nearly always up late, so the real pacing is W and E: spin and dash are a two-button window, then a long wait.
- **Loop:** Dash in, vary attacks and abilities to climb Style, attack anything held in place to dash to range, then convert six stacks into the ultimate.
- **Decision:** Spend the dash early to get inside blade range and start the stack count, or hold it for the reset on a kill. Holding keeps her safe to escape; spending commits her to the melee range where the ult is strongest.
- **Counterplay:** Do not be CC'd next to her, since that is her dash trigger. Her ult has a clear start: a rooted caster is not in the gap, and she is slowed during it, so leaving its radius works. Projectile-heavy kits lose to the W spin but only for its short window.
- **Mastery:** Sequencing the stacks (Q, W, E, attack in a certain order) so six land before the target can react, and weaving the W so it also cancels a projectile that would have killed her.
- **For a duel:** The "reward for varied hits" passive is great in a 1v1, since it asks for a different ability or attack each time, not a different target. The idea of a meter that unlocks a short burst state is strong. [transfers]

### Sejuani, Fury of the North
Vanguard · melee · mana · 2012 · last rework: 2017 GR

- **P (Fury of the North):** Stuns freeze the target, and her next hit on a frozen enemy deals max-health damage. She also has armor and magic resist plus slow immunity, which lapses for a while after champions hit her.
- **Q (Arctic Assault):** A dash to a ground point that stops on the first champion, knocks them up and hits them once.
- **W (Winter's Wrath):** A delayed cone swing, then a line lash that slows briefly; she can walk while casting.
- **E (Permafrost):** Her hits and Q-adjacent abilities build up to four Frost stacks. The active throws a trap at a stacked enemy: a one-second stun that also resets her attack.
- **R (Glacial Prison):** A bola that stops on the first champion. Fired from far enough away it explodes into a frost storm: longer stun, then a shatter after two seconds with a heavy slow.
- **Rhythm:** Q 18-12 s, W 9-5 s, E about 1.5 s but gated by stacks, R 120-90 s. The slot with a short cooldown is the one that needs four stacks, so the real wait is stack-building, not time.
- **Loop:** Q on, hit to build Frost, W for the extra stack, E to stun, and the freeze rewards one big hit. Ultimate bookends a fight.
- **Decision:** Spend R at close range for a safe one-second stun, or walk back to range for the long stun and storm, which gives the enemy time to step out. A short-range stun is certain; the long one is strong but readable.
- **Counterplay:** After stacks are consumed the enemy is immune to Frost for several seconds, so a stunned player has a clear safe period. The W cone has a visible delay and she can be baited into swinging early.
- **Mastery:** Landing the R at range with the correct angle, and timing the trap so the freeze bonus lands on the next attack rather than a wasted one.
- **For a duel:** Marking an enemy with a stun and paying off with a big hit is a clear two-step. Her passive, though, mostly asks "was I hit by a champion", which has little to measure in a 1v1. Her kit is built for team fights. [partly]

### Senna, the Redeemer
Marksman, Enchanter · ranged · mana · 2019 · last rework: none

- **P (Absolution):** Hits mark enemies; hitting a marked target adds a Mist stack and bonus damage by current health. Mist wraiths from dead enemies add stacks, which give attack damage and later range. Attacks also give a movement burst.
- **Q (Piercing Darkness):** Targeted beam through a unit, healing allies it passes and slowing enemies.
- **W (Last Embrace):** A thrown globule that damages the first enemy and then roots after a delay, including nearby enemies.
- **E (Curse of the Black Mist):** A self aura that hides her and speeds her; allies who enter get camouflage.
- **R (Dawning Shadow):** A global beam that shields allies and reveals enemies it passes through.
- **Rhythm:** Q 15 s flat, W 11 s flat, E 26-20 s, R 140-100 s. Nothing scales through ranks: she gains power from stacks, not from lowered cooldowns, which makes each ability a fixed beat.
- **Loop:** Attack for the movement burst, hit with Q to slow, root with W, and kill. Between fights she builds stacks off wraiths.
- **Decision:** Walk forward and attack to apply marks and range, or hang back at the long reach. The Q hits a unit, so she can shoot through a minion, but there is no minion in a duel, so the target is simply the enemy.
- **Counterplay:** The W has a clear delay between the hit and the root, so a mover can leave. Her stealth is a zone, not a toggle, so she is visible when standing outside it. Her stacks come largely from the map.
- **Mastery:** Drawing the W root so that it catches on the turn rather than the walk-away, and keeping Mist stacks high by farming wraiths safely.
- **For a duel:** The one real lesson is a kit that scales by collecting something on the field rather than from items, which is a good no-items idea. Wraiths from kills would need a replacement. Most of the kit supports allies and has no use alone. [partly]

### Seraphine, the Starry-Eyed Songstress
Burst, Enchanter · ranged · mana · 2020 · last rework: 2024 GR

- **P (Stage Presence):** Every third basic ability is cast twice for free. Her casts add Notes to her and allies, and her next attack fires every Note as magic damage with extra range.
- **Q (High Note):** Ground-targeted soundwave that deals more damage to low-health targets.
- **W (Surround Sound):** Self and ally shield plus speed; if she is already shielded, ending it heals.
- **E (Beat Drop):** Line wave that slows. Anything already slowed is rooted, and anything already rooted is stunned.
- **R (Encore):** Line projectile that charms and reveals; its reach grows each time it passes through a champion.
- **Rhythm:** Q 8-6 s, W 22 s flat, E 11 s flat, R 160-120 s. The passive effectively halves the Q and E waits because the echo gives double casts at a regular beat.
- **Loop:** Cast three skills, get the free echo and Notes, auto for the Note burst. The E can chain from slow to root to stun using her own earlier hits.
- **Decision:** Take the safe Q poke to build Notes, or save E for a combo whose ceiling is a stun. The stun needs the target to be slowed and then rooted first, which also tells them what is coming.
- **Counterplay:** Dodge the E before it hits because the first hit is only a slow and the stronger forms need a prior effect. The charm is a long line with a visible travel, and walling it out is possible.
- **Mastery:** Counting echo stacks so the double cast lands on the ability that matters, and setting the E up after a W-shield walkup.
- **For a duel:** The escalating E (slow to root to stun) is a clean model for chaining effects without stacking crowd control the player did not earn. On her design history: public coverage of the 2024 changes says Riot wanted to reduce her pull to support while helping her mid ([Dot Esports](https://dotesports.com/league-of-legends/news/lol-devs-squeeze-seraphine-back-to-support-with-huge-changes)), a secondary source, not Riot itself. [transfers]

### Sett, the Boss
Juggernaut · melee · other (Grit) · 2020 · last rework: none

- **P (Pit Grit):** Extra regeneration that grows as health drops. His attacks alternate left and right punch, and the right one is faster, longer and harder.
- **Q (Knuckle Down):** Next two attacks reach further and deal max-health damage; he also speeds up while moving toward enemy champions; resets the attack timer.
- **W (Haymaker):** Damage taken is stored as Grit. The cast spends all of it as a shield and a wide blast, with true damage in the middle.
- **E (Facebreaker):** A directional pull that drags enemies in from both sides, slowing them; if both sides catch someone it stuns.
- **R (The Show Stopper):** Target dash, carries the champion while suppressing, then slams them down.
- **Rhythm:** Q 9-5 s, W 18-12 s, E 16-10 s, R 120-80 s. He is meant to take damage first and then spend the long W on a pile of it; short Q is the engine.
- **Loop:** Q to close, left punch, right punch, E to drag, and W once the Grit bar is full.
- **Decision:** Take hits to fill Grit for a large W, or avoid damage and keep health. Taking damage is the whole point, but dying early wastes the stored bar since it decays.
- **Counterplay:** Do not hit him lightly before a big exchange since it fuels W. The W is a visible wind-up with a long shape; stepping out of the middle removes the true damage. His ultimate is a unit-target dash that cannot be stopped, but you can leave its range before it starts.
- **Mastery:** Holding the W until Grit is large and the enemy is in its center line, and timing Q to land the right-hand punch together.
- **For a duel:** Converting damage taken into a stored and decaying resource gives a brawler a reason to stand in front of damage, and it has no dependence on a team. The stun-on-both-sides E needs a second body to be at its best. [transfers]

### Shaco, the Demon Jester
Assassin · melee · mana · 2009 · last rework: none

- **P (Backstab):** Backstab: hits from behind deal extra damage, and the effect also boosts Q and E.
- **Q (Deceive):** Invisibility for a moment, then a blink to a point. The first attack from invisibility is empowered and crits from behind.
- **W (Jack In The Box):** A hidden box that fears enemies on contact, then shoots nearby enemies for a while.
- **E (Two-Shiv Poison):** A thrown knife that slows, hitting harder on low-health targets.
- **R (Hallucinate):** A controllable clone that explodes when it dies, dropping three small traps.
- **Rhythm:** Q 13-11 s, W 15 s flat, E 8 s flat, R 100-80 s. Nothing here scales much; his tempo is traps placed ahead of the fight.
- **Loop:** Place W, vanish with Q, strike from behind with a crit, throw E to finish. The clone muddles who is who.
- **Decision:** Use Q to open a kill, or hold it to escape the enemy's answer. Spending it on a bait gives away its position, while holding it makes his damage too low to commit.
- **Counterplay:** Boxes are hidden, so the counter is vision and moving through lanes where a box is likely; stepping slowly around corners or walking a path other than the obvious one. The clone takes extra damage, so hitting it ends it fast and prompts the explosion on their terms.
- **Mastery:** Predicting where the opponent will step and placing the box ahead, and using the clone to look like a second attacker.
- **For a duel:** A kit built on concealed information. In a small arena with cover it could be fun, but a hidden trap that is unfair to see needs a rule like a faint tell, or it feels cheap; the wiki shows no such tell here. [partly]

### Shen, Eye of Twilight
Warden · melee · energy · 2010 · last rework: 2016 VG

- **P (Ki Barrier):** After casting, he gets a shield; hitting another champion with the cast shortens that passive's cooldown.
- **Q (Twilight Assault):** Recalls his sword from anywhere; enemies it crosses are slowed, and his next three attacks reach further and deal max-health damage.
- **W (Spirit's Refuge):** A zone that blocks basic attacks on allies inside for under two seconds.
- **E (Shadow Dash):** A dash to a point that taunts what it passes.
- **R (Stand United):** Channels to shield an ally anywhere, then teleports beside them.
- **Rhythm:** Q 8-5 s, W 16-10 s, E 18-10 s, R 200-160 s. Because both big costs are energy, not mana, the cooldowns are not the main limit; the pool is.
- **Loop:** Throw or leave the sword, dash with E, taunt, recall with Q while hitting, and drop W where the fight is.
- **Decision:** Spend the energy on E to force a fight or hold it for Q's follow-up hits. Both cost a lot of energy (around 140 and 150 at the first rank), so he cannot do both in a row.
- **Counterplay:** The taunt can be avoided by leaving its path; since the dash has range up to a few hundred units, the player can see it being aimed. W only blocks basic attacks, so spells go through.
- **Mastery:** Placing the sword so the Q's recall path crosses the enemy, giving a slow and the empowered hits together, and using the shield timing.
- **For a duel:** Putting a weapon on the field and recalling it later is a good two-position idea. The ultimate and W are about allies and do not apply. His energy limits make an interesting tempo model. [partly]

### Shyvana, the Half-Dragon
Diver · melee · other (Fury) · 2011 · last rework: 2026 VG

- **P (Scalemail):** Takedowns give small permanent armor and magic resist.
- **Q (Emberstrike):** A repeated strike: a cone, then a slam, and in dragon form a third hit with true damage. Landing hits shortens its cooldown; the last cast resets the attack timer.
- **W (Inferno Aegis):** A shield that grows with nearby enemies and gives speed; recasting explodes it, healing in dragon form.
- **E (Molten Burst):** A fireball; as a dragon it is wider, passes through enemies and leaves burning ground.
- **R (Dragon's Descent):** Needs full Fury. Dashes forward, turns her into a dragon, breathes fear. Fury drains and she returns when it is empty.
- **Rhythm:** Q 10-6 s, W 13-10 s, E 12-8 s, R has no fixed cooldown (roughly 200-100 s in effect). The ultimate is paid for with a meter, and while she is a dragon her short cooldowns become much stronger.
- **Loop:** Build Fury through hits, ult to change shape, run the ability sequence while dragon, and revert.
- **Decision:** Cast R as soon as the bar is full, or wait until the opponent has spent an escape. Early gives a longer dragon window; late makes the fear land.
- **Counterplay:** Her dragon form is a timed window drained by Fury, so retreating until it runs out is valid. The fear is cast at the end of the dash, which has a tell.
- **Mastery:** Chaining Q's hits with auto attacks to refresh the Q, and spending the W explosion when the heal matters.
- **For a duel:** The fury-gated transformation is a strong template: build, burst, then a clear end. Riot reported the 2026 update as visuals with minor kit changes ([coverage](https://idcgames.com/en/league-of-legends/news/shyvana-reborns-the-long-awaited-update-blazes-into-league-of-legends-2026-03-02-12-15-12516), secondary). [transfers]

### Singed, the Mad Chemist
Specialist · melee · mana · 2009 · last rework: none

- **P (Noxious Slipstream):** Walking close to enemy champions builds short-lived speed stacks, one pass per target every few seconds, so circling the enemy makes him very fast.
- **Q (Poison Trail):** A toggle that drips a poison cloud behind him while he walks, paid per second in mana.
- **W (Mega Adhesive):** Goo thrown on the ground: a field that grounds and slows, landing after a short delay.
- **E (Fling):** Grabs an adjacent enemy and flings them over his head to land behind him; if they land in the goo they are rooted.
- **R (Insanity Potion):** Self buff for about 25 s: more power and toughness, and the poison now cuts healing.
- **Rhythm:** Q has a 1 s toggle cooldown, W about 17-13 s, E 10-8 s, R 100 s. The kit is a standing state (the trail) with two cooldowns, W then E, that must be spent in that order.
- **Loop:** Run through the enemy to gain speed, lay the goo, fling them into it, then keep running over a rooted target while the poison ticks.
- **Decision:** Spend mana on a permanent trail that hurts only if the enemy follows or stays near, or switch it off to save mana and risk having no pressure while the W and E are down.
- **Counterplay:** The W is a slow projectile with a clear landing time, so it can be walked out of or blocked; the fling needs a melee-range grab, so spacing and dashes beat it. Never chase a Singed through his own trail.
- **Mastery:** Aiming the goo where the fling will land, and baiting the opponent into a chase.
- **For a duel:** A trail that punishes the pursuer is a strong pressure tool, and a two-part setup combo (area, then grab into it) gives the defender a readable tell. Mana on a toggle is a good tax. [transfers]

### Sion, the Undead Juggernaut
Vanguard · melee · mana · 2009 · last rework: 2014 VG

- **P (Glory in Death):** On fatal damage he lingers briefly, then rises with a draining health bar, hits hard with huge lifesteal, and can only attack and move until the time runs out or he dies for good.
- **Q (Decimating Smash):** A held directional smash. Letting go early gives a short slow; holding long enough gives a knock-up then a stun, with more range the longer he charges.
- **W (Soul Furnace):** A shield that grows over time and can be popped on recast for area damage; it also feeds permanent health from kills.
- **E (Roar of the Slayer):** A shockwave that slows and softens armor; when it hits a minion first, the minion flies on and hits those behind.
- **R (Unstoppable Onslaught):** A long, steerable, CC-immune charge that ends on contact or a wall; the longer the run, the heavier the slam and stun.
- **Rhythm:** Q 10-6 s, W 15-11 s, E 12-8 s, R 140-60 s. The ultimate's cooldown shrinks enormously with rank, so the late game becomes a repeat charge threat.
- **Loop:** Charge the Q while the enemy decides whether to walk away, pop the shield to punish those standing near him, and use the ultimate to start the fight.
- **Decision:** Hold the Q for the stun and risk being hit while it is visible, or release it early for a safe small slow.
- **Counterplay:** The held Q shows its length and direction; step sideways or out of range after the second beat. During the ultimate, the player cannot be stopped, so only steering away or terrain helps. The undead state is weak to just walking away and waiting.
- **Mastery:** Reading when the enemy will dodge, and steering the charge into them without hitting a wall.
- **For a duel:** Held-to-strengthen attacks are a clean read-versus-commit duel. The death-and-return passive is dramatic but may be miserable in a short round. [partly]

### Sivir, the Battle Mistress
Marksman · ranged · mana · 2009 · last rework: 2022 GR

- **P (Fleet of Foot):** Hitting champions with attacks or damaging abilities gives a quick burst of speed that fades.
- **Q (Boomerang Blade):** A boomerang thrown in a line that hits on the way out and again on the way back.
- **W (Ricochet):** A short attack-speed buff in which attacks bounce to nearby enemies; also resets the attack timer.
- **E (Spell Shield):** A brief spell shield that blocks one incoming effect, then heals her and fires up her speed.
- **R (On The Hunt):** A self and ally speed aura where every basic attack trims her cooldowns; kills refresh it.
- **Rhythm:** Q 10-8 s, W 12 s, E 24-18 s, R 120-80 s. The E is the one long cooldown, and it is also the lever the whole kit hangs on.
- **Loop:** Throw the boomerang, empower an attack, and keep the shield timed for the enemy's key spell.
- **Decision:** Spend the shield early on a poke to heal and gain speed, or hold it for the enemy's big spell and risk wasting it on nothing.
- **Counterplay:** Bait the shield with a cheap spell first, then use the real one; the boomerang is a visible line that can be sidestepped, especially on the way back.
- **Mastery:** Blocking the right spell and then converting the speed into a boomerang return.
- **For a duel:** The spell shield is a bluff mechanic: the best lesson here. The 2022 change made the block pay her back, which Riot's own Reddit thread framed as more consistent damage, less team role ([patch 12.13 notes](https://www.leagueoflegends.com/en-us/news/game-updates/patch-12-13-notes/) only list it). [transfers]

### Skarner, the Primordial Sentry
Vanguard, Juggernaut · melee · mana · 2011 · last rework: 2024 VG

- **P (Threads of Vibration):** Hits and his abilities apply quake stacks; at three, the target takes a health-scaled magic tick over time.
- **Q (Shattered Earth / Upheaval):** A three-attack empowerment with extra range and damage; or he can throw a boulder in a line at the cost of the empowerment.
- **W (Seismic Bastion):** A small self shield with an expanding shockwave that slows nearby enemies.
- **E (Ixtal's Impact):** A long, steerable charge through terrain that grabs the first champion and carries them; hitting a wall stuns and refunds part of the cooldown.
- **R (Impale):** A wide, short lash that pins up to three champions to him for about 1.5 s.
- **Rhythm:** Q 8-3 s, W 10-6 s, E 22-18 s, R 120-90 s. The Q gets very short, so he is always attacking, while E and R are rare, big decisions.
- **Loop:** Auto-attack with the empowered Q to stack the quake, then threaten with E to force the opponent to move toward or away from walls.
- **Decision:** Dive into the wall with E for the stun and a faster cooldown, or recast early to drop them where Skarner can use the Q.
- **Counterplay:** The charge starts slow and speeds up, so a dodge is easiest early; a cleanse or hard CC ends the charge. Spell shield stops the grab.
- **Mastery:** Choosing a charge angle that ends at terrain.
- **For a duel:** Terrain as a weapon fits arenas with cover directly. Riot's [dev post](https://www.leagueoflegends.com/en-us/news/dev/dev-searching-for-skarner-s-sting/) exists but was read only through secondhand coverage. [transfers]

### Smolder, the Fire-Breathing Dragon
Marksman · ranged · mana · 2024 · last rework: 2024 GR

- **P (Dragon Practice):** Stacks build when abilities hit champions (and the Q kills), and each tier of stacks permanently upgrades the Q: explosion, then side bolts, then burn and execute.
- **Q (Super Scorcher Breath):** A point-and-click fireball with a short cooldown, which becomes the center of the kit as stacks grow.
- **W (Achooo!):** A slow glob in a line, which explodes on a champion and slows.
- **E (Flap, Flap, Flap):** A short flight through terrain that fires bolts at the closest wounded enemy while moving.
- **R (MMOOOMMMM!):** A long-range line of fire that heals him and hits the first and nearby targets harder at the center.
- **Rhythm:** Q 5.5-3.5 s, W 14-10 s, E 24-16 s, R 120-100 s. The spammable Q gives a constant feed to the passive.
- **Loop:** Land the glob for the first stacks, spam the Q, use the flight to escape or reposition, and use the ultimate to finish a fight.
- **Decision:** Stay safe and stack slowly, or poke with W and Q to build stacks faster and risk exposure.
- **Counterplay:** The early game is deliberately weak, so pressure him before the stacks tiers; spell shields block pieces of the Q; the glob is slow to arrive.
- **Mastery:** Stack management and walking the ultimate into the right place.
- **For a duel:** [Riot's Champion Insights](https://www.riotgames.com/en/news/champion-insights-smolder) says the goal was an easier marksman and a scaling "baby dragon". A visible tier-up is readable, but a stack-based power curve needs time a short duel may not give. [partly]

### Sona, Maven of the Strings
Enchanter · ranged · mana · 2010 · last rework: 2021 GR

- **P (Power Chord):** Three basic ability casts empower her next attack, and the effect depends on the last song: more damage, a damage-and-size cut, or a slow.
- **Q (Hymn of Valor):** Automatic bolts at the two nearest enemies, with a bonus to her next attack.
- **W (Aria of Perseverance):** A heal for herself and the most hurt ally; with an ally it adds a shield. Alone it works as a weaker heal.
- **E (Song of Celerity):** A speed buff that fades if she is hit.
- **R (Crescendo):** A wide line that stuns everything in it, with a long cooldown that falls with stacks.
- **Rhythm:** Q 8 s, W 10 s, E 14 s, R 140-100 s. The three songs are mostly flat, so the real rhythm is the order she casts them in.
- **Loop:** Cast three songs, pick the last one to match what the situation needs, then land the empowered attack.
- **Decision:** Finish with the Q for damage, W for the debuff, or E for the slow, deciding which problem to solve at the cost of the others.
- **Counterplay:** The R is a long, visible line with a short wind-up: sidestep or block it. Close the distance to disrupt the attack windup.
- **Mastery:** Ordering the songs and getting the stun to land in a fight.
- **For a duel:** Without allies, the heal and shield half is wasted, so the kit is a weak solo design. The three-then-choose passive is a good idea for a duel, but no Riot source was found for it. [partly]

### Soraka, the Starchild
Enchanter · ranged · mana · 2009 · last rework: 2014 VG

- **P (Salvation):** Gets a big speed boost when she faces a nearby ally who is below 40% health.
- **Q (Starcall):** A star on a point, delayed in proportion to distance; a slow, and a heal-over-time with speed if it hits a champion.
- **W (Astral Infusion):** A strong heal on an ally that costs her health; cheaper while she is boosted by the Q.
- **E (Equinox):** A zone that silences, then erupts and roots.
- **R (Wish):** A global heal for every ally, bigger on those below 40%.
- **Rhythm:** Q 8-4 s, W 6-2 s, E 20-16 s, R 150-120 s. Fast low cooldowns reward constant casting.
- **Loop:** Hit with Q to heal herself, then use W to trade health for allied health, and drop E so the enemy can't escape.
- **Decision:** Pay health for a heal or spare herself and risk a death.
- **Counterplay:** The E is telegraphed and the root comes after a pause, so walk out. A delayed star is easy to dodge at long range.
- **Mastery:** Landing the E root and Q hits so she heals herself.
- **For a duel:** With no ally, the heal is a self-sacrifice loop only. The "pay life for healing" idea is a strong duel tradeoff, but the kit is weak alone. [partly]

### Swain, the Noxian Grand General
Battlemage · ranged · mana · 2010 · last rework: 2024 GR

- **P (Ravenous Flock):** Dead champions leave fragments, collected after a pause to give him permanent health and healing.
- **Q (Death's Hand):** A five-bolt cone; later bolts on the same target do more.
- **W (Vision of Empire):** A far-ranging eye that reveals and slows an area after a delay.
- **E (Nevermove):** A projectile that roots, with a recast that pulls the rooted target to him.
- **R (Demonic Ascension):** A transformation that drains nearby enemies and heals him, fed by hits; ends with a nova on expiry.
- **Rhythm:** Q 7-3 s, W 20-16 s, E 12-10 s, R 120 s. The long W sets the pace.
- **Loop:** Reveal and slow with W, root with E, pull with the recast, and then transform to stay close.
- **Decision:** Pull early to stay at the right range, or wait and risk the root being removed.
- **Counterplay:** Dodge the E projectile; a dash or blink breaks the recast; spell shields stop the roots.
- **Mastery:** Staying in drain range, reading when to nova.
- **For a duel:** A pull recast gives a clear tell and a time-limited resource, and the fragment count on his passive is easy to read. No Riot source was found for the 2024 rework, so this is analysis, not from Riot. [transfers]

### Sylas, the Unshackled
Burst, Skirmisher · melee · mana · 2019 · last rework: none

- **P (Petricite Burst):** Every cast banks a short-lived charge (up to three). Charges give big attack speed, and the next attack becomes a chain whirl that hits the target hard and nearby enemies lightly.
- **Q (Chain Lash):** Two chains cross at a chosen point, slow on the way, then detonate there after a short beat.
- **W (Kingslayer):** Targeted lunge-and-strike; heals more the lower his health is.
- **E (Abscond / Abduct):** A short dash, then a recast chain skillshot that stuns, pulls him to the victim and knocks them up.
- **R (Hijack):** Targeted: copies an enemy ultimate and holds it for a long time.
- **Rhythm:** Q about 10-6 s, W 12-6 s, E 13-9 s, R 80-30 s. Short cooldowns mean three casts fit inside one passive window; the ultimate is the only slow beat, and it depends on what the enemy owns.
- **Loop:** Dash out with E, land the chain, drag himself in, then spend W and Q as stacks refill, finishing each cast with an empowered attack. When the opponent's ultimate is up, he steals it first.
- **Decision:** Spend W early on a healthy target for damage, or hold it until he is low so the heal makes the trade swing. Same with R: steal now, or wait for a better ultimate.
- **Counterplay:** E is a straight line with a stall between dash and chain, so strafing or blocking the second cast beats it. A spell shield wastes the chain. Stealing is lockout-limited, and you can use your ultimate before he reaches you.
- **Mastery:** Chaining casts so every attack is empowered, and knowing every stealable ultimate and its quirks. Riot's QA has said ultimates were not built with Sylas in mind, which is why interactions break ([Dot Esports on the Hijack fixes](https://dotesports.com/?p=1208349)).
- **For a duel:** The ultimate-steal makes every opponent change the kit, which is strong in a 1v1 with a small hero pool, but costs one special case per hero. Stack-from-cast passives that reward rapid casting transfer well. [partly]

### Syndra, the Dark Sovereign
Burst · ranged · mana · 2012 · last rework: 2022 GR

- **P (Transcendent):** She gathers Splinters by landing ability hits on champions and ranking up; mana returns with each; milestones power up her Q, W, E and R in turn.
- **Q (Dark Sphere):** Drops a lingering sphere after a short delay; any number can exist.
- **W (Force of Will):** Picks up a sphere and throws it later, damaging and slowing.
- **E (Scatter the Weak):** Cone blast that knocks back; spheres it touches fly far and stun.
- **R (Unleashed Power):** Pulls her spheres in and barrages one champion; cannot be interrupted.
- **Rhythm:** Q 7 s flat, W 13-9 s, E 15 s flat, R 120-80 s. The cheap Q buys spheres, so the real gating resource is Q count, and the long E is the committed stun.
- **Loop:** Place spheres, grab one with W, then use E to push spheres into the target for a stun, with the ultimate finishing on the spheres already out.
- **Decision:** Keep spheres on the ground as ultimate damage, or burn them on E and W now for control and a stun. More spheres means more R damage, but fewer if you spend them.
- **Counterplay:** Spheres are visible and telegraphed, so avoid standing near them. Dashing out of the E cone or dodging the stun's sphere path is the main answer. The ultimate cannot be stopped once begun, so burst it down earlier or use a spell shield, which blocks only one sphere.
- **Mastery:** Placing spheres so E stuns take effect where the opponent steps, throwing W to catch a dash. The 2022 update moved power into the passive's milestones for big high moments ([patch 12.19 notes](https://www.leagueoflegends.com/en-us/news/game-updates/patch-12-19-notes/)).
- **For a duel:** Persistent objects the player sets up and then detonates make a good duel kit, since the opponent reads the board. The long-term passive thresholds matter less in short rounds. [transfers]

### Tahm Kench, the River King
Warden · melee · mana · 2015 · last rework: 2021 GR

- **P (An Acquired Taste):** Attacks and the tongue add damage scaled by bonus health and stack to three; at three, his tongue stuns and Devour becomes usable.
- **Q (Tongue Lash):** Tongue skillshot that slows and heals him; stuns at full stacks.
- **W (Abyssal Dive):** A long channel, then a blink that knocks up and stuns; hitting a champion refunds some cost.
- **E (Thick Skin):** Passive grey-health store and an active that turns it into a shield.
- **R (Devour):** Pulls in and swallows an enemy at three stacks, then spits them out; or swallows an ally to shield it.
- **Rhythm:** Q 7-5 s, W 21-17 s, E 3 s, R 120-80 s. The tiny E cooldown lets the shield be used reactively, while the W is the long commit.
- **Loop:** Land tongue hits and attacks until three stacks, then stun with Q or swallow with R, shielding as damage comes in.
- **Decision:** Spend the three stacks on a stunning tongue now, or keep them for Devour, which needs the same stacks. One resource, two exits.
- **Counterplay:** The W channel is a long, loud wind-up, so step away from the marked area. Avoid hits that feed stacks, and avoid trading while he holds a shield. Tongue is a straight line.
- **Mastery:** Reading when to cash grey health into a shield, and hiding the stack count so the opponent doesn't know Devour is live. Riot said the rework would move Devour to the ultimate to be more powerful as a cast and less dependent on allies (summarised by [Sportskeeda, secondary](https://www.sportskeeda.com/esports/league-legend-patch-11-13-official-notes-brings-tahm-kench-mini-rework-virgo-nerfs-massive-mobility-updates)).
- **For a duel:** A shared stack that decides between two payoffs is a strong tension. His tank-support body was built for a team, and alone his kit is slow. [partly]

### Taliyah, the Stoneweaver
Battlemage · ranged · mana · 2016 · last rework: 2022 GR

- **P (Rock Surfing):** Gains movement speed near terrain, which fades after a few seconds away.
- **Q (Threaded Volley):** Fires five shards while she moves; casting on the patch of ground it leaves fires one heavier boulder.
- **W (Seismic Shove):** Marks a point and direction; a delayed ledge knocks enemies up and back.
- **E (Unraveled Earth):** Fan of stones that slow, and detonate with a stun when an enemy dashes or is knocked across them.
- **R (Weaver's Wall):** Sends a wall of rock that knocks aside, then ride it and hop off elsewhere.
- **Rhythm:** Q 7-3 s, W 14-8 s, E about 14 s, R 180-120 s. The ground-patch reward makes Q cheaper on a second cast, so her pace is quick but gated by position.
- **Loop:** Cast Q to lay ground, stand on it for the boulder, then use the W knockup to push enemies into the E stones for the stun.
- **Decision:** Fire the cheap shards at once to keep pressure, or save the patch for the strong boulder. Same with R: block them in, or ride the wall to escape.
- **Counterplay:** Both W and E show a ground marker and delay, so walk away. Do not dash across her stones. Wall travels in a line, so sidestep it.
- **Mastery:** Placing stones where the enemy's own dash must cross, and using the wall as terrain. The 2022 update changed Worked Ground and Rock Surfing numbers ([RiftFeed breakdown, secondary](https://riftfeed.gg/lol-news/lol-patch-12-9-taliyah-rework-breakdown)).
- **For a duel:** Spells that turn the opponent's own movement into the trigger are a high-skill idea and fit arenas with cover. Her terrain wall also fits. [transfers]

### Talon, the Blade's Shadow
Assassin · melee · mana · 2011 · last rework: 2016 GR

- **P (Blade's End):** Abilities add stacking wounds; an attack on a target with three wounds starts a bleed.
- **Q (Noxian Diplomacy):** Dashes to a target; hits as a crit if up close, and heals and halves cooldown on a kill.
- **W (Rake):** Throws a fan of daggers that return, slowing on the way back.
- **E (Assassin's Path):** Vaults over a wall or terrain, with each piece of terrain on its own long cooldown.
- **R (Shadow Assault):** Ring of blades, stealth and speed; recast pulls the blades back.
- **Rhythm:** Q 8-6 s, W 9-7 s, E 2 s base (each terrain 160-60 s), R 100-60 s. Abilities are cheap, so he can apply three wounds fast.
- **Loop:** Vault in, Q the target, W for a second hit, trigger the bleed with an attack, then R for stealth and blades.
- **Decision:** Use the ultimate for opening burst, or hold it as a stealth escape. Walls are limited by cooldown, so a vault is also a one-time exit.
- **Counterplay:** Wall vaults are announced to enemies, so watch where he lands. Dodge the daggers' return, and shielding the bleed hit wastes the three wounds.
- **Mastery:** Choosing the right wall for a vault and timing the recast of R to hit twice. The 2016 update added Assassin's Path to support roaming ([Surrender@20, secondary](https://www.surrenderat20.net/2016/08/red-post-collection-talon-update.html)).
- **For a duel:** Spells that leave a wall-specific cooldown tie movement to the map, which only works if the arena has varied cover. The bleed combo is simple. [partly]

### Taric, the Shield of Valoran
Enchanter, Warden · melee · mana · 2009 · last rework: 2016 VG

- **P (Bravado):** After a cast, his next two attacks are very fast, deal bonus damage and trim his other cooldowns.
- **Q (Starlight's Touch):** Stored heal that spends charges built by empowered attacks.
- **W (Bastion):** Binds him to an ally; both gain armor and shields, and his spells mirror on the ally.
- **E (Dazzle):** Delayed beam stun, firing from him and the bound ally.
- **R (Cosmic Radiance):** After a delay, he and nearby allies cannot be hurt for a short time.
- **Rhythm:** Q 3 s between casts with slow charge build, W 15 s, E 16-12 s, R 180-120 s. The delay on E and R is the identity.
- **Loop:** Cast, then punch twice at high speed to refund cooldowns and fill Q charges, then shield or stun.
- **Decision:** Hold Q charges for a bigger heal, or spend them early to survive. A big heal needs more empowered hits, which means staying in melee.
- **Counterplay:** E's one-second wind-up is a clear telegraph, and he can move while charging. Shield-breaking or spell shields cancel it. The ultimate starts a countdown to prepare for.
- **Mastery:** Weaving attack and cast to keep the passive running, and timing the delayed stun. 
- **For a duel:** Most of his kit points at allies and the bound partner, so alone it is thin: a stun, a heal and an invulnerability window. He is a weak duelist whose best part is the delayed telegraph. [5v5 only]

### Teemo, the Swift Scout
Specialist · ranged · mana · 2009 · last rework: none

- **P (Guerrilla Warfare):** Goes invisible while standing still; breaking it grants attack speed.
- **Q (Blinding Dart):** Targeted dart; damages and blinds.
- **W (Move Quick):** Passive speed outside combat; active doubles it.
- **E (Toxic Shot):** Passive poison on attacks.
- **R (Noxious Trap):** Plants hidden mushrooms with limited charges; stepping on one poisons and slows.
- **Rhythm:** Q 7 s, W 14 s, E none (passive), R recharge about 35-25 s per charge. Charges accumulate while he waits, so patience builds more traps.
- **Loop:** Hide, shoot a dart that blinds, keep attacking at range so the poison ticks, retreat via W, and leave a mushroom.
- **Decision:** Stand still to stay invisible and start the fight with a free attack, or move now and lose it. Spend mushrooms in a spot, or save a charge.
- **Counterplay:** The mushroom is visible if you scan for it, can be destroyed by attacks, and has low health. Reveal him first. The blind loses value against ranged heroes.
- **Mastery:** Placing traps on the path an opponent will take, and knowing when to hold still.
- **For a duel:** Hidden traps in a small arena with cover are an excellent counterplay puzzle: the opponent suspects, you hide. The stealth rule is dull on its own. [transfers]

### Thresh, the Chain Warden
Catcher · ranged · mana · 2013 · last rework: none

- **P (Damnation):** Collects souls from deaths near him; each gives AP and armor.
- **Q (Death Sentence):** Hook that stuns and pulls; recast to dash to the target.
- **W (Dark Passage):** Lantern that shields him and an ally who reaches it.
- **E (Flay):** Chain sweep that knocks the enemy away or pulls them depending on aim.
- **R (The Box):** Five walls around him; the first one broken hurts and almost freezes the enemy.
- **Rhythm:** Q 19-9 s, W 21-17 s, E 13-10 s, R 120-80 s. The Q's long first cooldown makes the miss expensive, and later ranks cut that.
- **Loop:** Hook, recast to follow the target in, flay to hold them, and finish with the box.
- **Decision:** Recast Q to dash to the target, or let it stay hooked and use E to pull them. Spend the ultimate on trapping a fleeing target or hold it as a defensive wall.
- **Counterplay:** Q is a narrow line with a half-second windup, so sidestep or put a unit in its path. A spell shield blocks it all. Break out of the box by hitting a wall.
- **Mastery:** Landing the hook after reading the opponent's movement habits, and the choice between hook-dash and pull. Knockback direction on E depends on aim.
- **For a duel:** A single skillshot with a high reward and a two-way recast is strong. Lantern and souls are team features. [transfers]

### Tristana, the Yordle Gunner
Marksman · ranged · mana · 2009 · last rework: 2024 GR

- **P (Draw a Bead):** Her attack range grows with level, so she out-ranges most of the cast late in a game.
- **Q (Rapid Fire):** A self buff: a big attack-speed boost for about 7 s.
- **W (Rocket Jump):** Leap to a spot (about 900 range), damaging and slowing on landing. Resets on a champion kill or a fully stacked bomb detonation.
- **E (Explosive Charge):** Plants a bomb on a target that grows with every attack or ability that hits it, and blows up after about 4 s or at four stacks. Also, enemies she kills with attacks explode.
- **R (Buster Shot):** Shoots one target; it and nearby enemies are thrown back.
- **Rhythm:** Q 20-16 s, W 22-14 s, E 16-14 s, R 100 s. The long W is the whole risk of her kit; a kill hands it back, so one clean fight can chain into the next.
- **Loop:** Put the bomb on, turn on Q, hit the target until the bomb pops (four hits or the timer), jump away or onto the next victim.
- **Decision:** Spend W as a gap closer to finish a kill and get it back, or hold it as the only escape she has and fight at range with an unprotected target. Both sides cost: jumping in exposes her, holding it wastes damage.
- **Counterplay:** The bomb is visible and takes time to reach full stacks, so a target can duck out of range or fight back before it fills. The jump has a clear arc and lands at a known point; punish the landing, not the leap. R is a short, readable cast.
- **Mastery:** Counting bomb stacks to pop it exactly on the kill, landing W so the reset triggers, and using R to peel rather than to burst.
- **For a duel:** A reset tied to a kill or a charged detonation is a clean rule: it rewards winning an exchange with mobility. The slow, telegraphed jump keeps it fair. Her range advantage is flat and dull to face. [transfers]

### Trundle, the Troll King
Juggernaut · melee · mana · 2010 · last rework: 2013 VG

- **P (King's Tribute):** Heals him when enemies die nearby, as a fraction of their health.
- **Q (Chomp):** Empowers the next attack: extra damage, slow, a short boost to his damage, and a cut to the target's damage. Refreshes his attack timer.
- **W (Frozen Domain):** Freezes a large circle for about 8 s; while he stands in it he is faster and hits faster.
- **E (Pillar of Ice):** Raises a pillar at a chosen spot for about 6 s. It is terrain, knocks back what it spawns on, and slows around it.
- **R (Subjugate):** Channel-drains a champion: damage and healing as a share of their max health, and he takes part of their defences.
- **Rhythm:** Q 3.5 s flat, W 18-14 s, E 21-15 s, R 120-80 s. The Q is nearly free, so the real cooldowns are the pillar and the zone, and they make a two-step plan.
- **Loop:** Pillar to cut off the exit, W under his feet, chain Q-empowered attacks inside the zone, R when the target is trapped and big.
- **Decision:** Place the pillar to trap the enemy in his zone, or keep it as a wall for himself against a stronger attacker. The trap wins fights, the wall saves him; he cannot have both.
- **Counterplay:** Both W and the pillar are ground-targeted and visible; leave the circle, or play around a pillar before it lands. R is a channel on a single target, so a dash, a block of line of sight or immunity cancels it. The ice is time-limited.
- **Mastery:** Pillar angles (knock someone into a corner, or block a dash) and keeping the fight inside the circle.
- **For a duel:** Terrain you can drop and a zone you want to stay in make a good 1v1 shape, a place to fight rather than just a hit. Drain-by-percent is strong into tanks and dull otherwise. [transfers]

### Tryndamere, the Barbarian King
Skirmisher · melee · rage · 2009 · last rework: 2011 VG

- **P (Battle Fury):** Builds a Fury bar from attacks, crits and kills; more Fury means more crit chance. It decays if he stops fighting.
- **Q (Bloodlust):** Passive extra damage the lower his health is. Active: spends all Fury to heal, more for more Fury.
- **W (Mocking Shout):** A shout that lowers nearby enemies' damage, and slows those who turn their backs to him.
- **E (Spinning Slash):** Dash through enemies, damaging them; hits and crits shorten its cooldown.
- **R (Undying Rage):** For about 5 s his health cannot fall below a floor, and he gains Fury.
- **Rhythm:** Q 12 s, W 14 s, E 12-8 s, R 120-80 s. The ultimate is the one cooldown that decides the fight; the others are short.
- **Loop:** Dash in to build Fury, hit until the bar is high enough to crit often, spend it on a heal when hurt, and use R only when he would otherwise die.
- **Decision:** Spend Fury on the heal now to stay alive, or keep it for crits and kill pressure. Healing survives this trade; holding it ends the fight faster.
- **Counterplay:** Wait out R: it is five seconds and he cannot be killed, so hold your damage and your crowd control until it ends. W is the fixed tell that stops a fleeing enemy from escaping, so do not run with your back turned. Keep distance so he cannot build Fury.
- **Mastery:** Timing R so that the player spends it just before the fatal hit, then keeping Fury high for a big heal after.
- **For a duel:** A health floor is a clear countdown with a clean answer (wait). The Fury bar fits a duel well; the kit is dull when R is down. [transfers]

### Twisted Fate, the Card Master
Burst · ranged · mana · 2009 · last rework: 2010 GR

- **P (Loaded Dice):** Gold on kills (a small economy bonus, with no use in a game without gold).
- **Q (Wild Cards):** Throws three cards in a cone; each enemy takes damage once.
- **W (Pick a Card):** Cycles through three cards; pressing again locks one for the next attack: Blue restores mana, Red damages in an area and slows, Gold stuns.
- **E (Stacked Deck):** Passive attack speed; every fourth attack deals bonus damage.
- **R (Destiny):** Reveals all enemy champions for a few seconds, then he can channel and blink to a spot within range.
- **Rhythm:** Q 6-5 s, W 6 s flat, E none, R 170-110 s. The W is back almost at once, so he can pick a new card on nearly every fight beat; the ultimate is a rare special.
- **Loop:** Stalk the target, time Gold on a gap, land the Q cone, hit with the stacked fourth attack, repeat.
- **Decision:** Pick Gold (stun, to chain a kill), Red (slow, to keep a chase) or Blue (mana, to keep fighting). Each answers a different threat; the stun is strongest but the longest to wait for.
- **Counterplay:** The card spinning above his head tells you what is coming, and a gold card means a stun is next, so stay out of range of his next attack or get a spell ready to block it. The ultimate channel is long and can be cancelled by crowd control.
- **Mastery:** Hitting the card at the right moment from muscle memory, and using R's blink to engage or escape.
- **For a duel:** A visible, selectable effect with a short window is a good teachable skill test. The passive is useless without gold. [partly]

### Twitch, the Plague Rat
Marksman · ranged · mana · 2009 · last rework: 2012 GR

- **P (Deadly Venom):** Every attack stacks poison (to six), which deals true damage over time.
- **Q (Ambush):** After a one-second delay he turns invisible for about 10-14 s, faster toward enemies who can't see him; attacking ends it with an attack-speed burst. Resets on a poisoned kill.
- **W (Venom Cask):** Throws a cask: poisons and slows in an area for about 3 s.
- **E (Contaminate):** Deals damage to every poisoned enemy nearby, more per stack.
- **R (Spray and Pray):** For about 6 s his attacks become piercing bolts with extra range and damage.
- **Rhythm:** Q 16 s flat, W 13-9 s, E 12-8 s, R 90 s flat. The Q never gets shorter, so ambush is a once-per-fight tool; the E is the damage button.
- **Loop:** Vanish, close in unseen, throw the cask to slow, poison with attacks, finish with E, repeat after a kill resets the stealth.
- **Decision:** Fire E early for a small hit, or wait for more poison stacks and a larger one. Waiting kills better but gives the target time to react.
- **Counterplay:** Stealth has a one-second wind-up, which is the moment to engage him or hit something nearby. Control wards or detection reveal him. The cask is a slow projectile and can be blocked. The ultimate is predictable and only lasts six seconds.
- **Mastery:** Starting stealth outside the enemy's vision so the speed boost triggers, and aiming the R bolts along a line.
- **For a duel:** Stealth with a visible wind-up, plus stacking damage with a cash-in button, is a strong shape. On an open arena the stealth is weaker, so cover matters. [transfers]

### Udyr, the Spirit Walker
Juggernaut · melee · mana · 2009 · last rework: 2022 VG

- **P (Bridge Between):** No ultimate. Each of four abilities puts him in a stance that empowers his next two attacks; recasting shortly after Awakens it. Monk Training speeds attacks and gives back cooldown on Awaken.
- **Q (Wilding Claw):** Claw: bonus damage by max health, range and speed. Awaken: chain lightning.
- **W (Iron Mantle):** Mantle: shield and lifesteal. Awaken: bigger shield and heal.
- **E (Blazing Stampede):** Stampede: pounce that stuns, ghost movement and speed. Awaken: more speed, brief crowd-control immunity.
- **R (Wingborne Storm):** Storm: blizzard and slow around him. Awaken: a glacial storm that moves by itself.
- **Rhythm:** Q 6 s, W 6 s, E 6 s, R 6 s, all flat, with the Awaken cooldown 50-20 s. Short, equal cooldowns plus a shared global lockout let him pick any of the four on demand; Awaken is the slow resource.
- **Loop:** Pick a stance, hit twice, stack another stance (their timers overlap), and spend Awaken when the fight needs a peak.
- **Decision:** Which stance now: E to close or chase, W to survive, Q to kill, R to control a group, plus whether Awaken is worth its long cooldown right now. Each is a clear commitment with a clear cost.
- **Counterplay:** He telegraphs by casting; E is a short pounce you can sidestep or kill his path to. The stun is only 0.75 s and E makes him immune to crowd control only during Awaken. Kite him; stances are melee only.
- **Mastery:** Picking the right combination from four options in under a second, timing Awaken for immunity or burst, and weaving the global lockout.
- **For a duel:** Riot said a major aim of the 2022 update was making the awakened stances a stronger version of the original four ([Riot dev post](https://www.riotgames.com/en/news/dev-the-latest-on-udyrs-vgu), as summarised by search). Four buttons on one cooldown, no ultimate, is an excellent 1v1 design. [transfers]

### Urgot, the Dreadnought
Juggernaut · ranged · mana · 2010 · last rework: 2017 VG

- **P (Echoing Flames):** Six shotguns around his body, each a separate cooldown; his next hit inside a shotgun's arc fires a cone for percent-health damage.
- **Q (Corrosive Charge):** A canister lobbed at a spot, bursts after about 0.3 s, damages and slows.
- **W (Purge):** A machine gun that fires itself at the nearest enemy for 4 s while he moves; at max rank, a toggle.
- **E (Disdain):** Shields, then dashes through enemies and stuns the first champion he touches, flinging them behind him.
- **R (Fear Beyond Death):** A drill pins the first champion hit and leashes them; once they are below a quarter of their health, a recast pulls them in and kills them.
- **Rhythm:** Q 10-8 s, W 12-0 s, E 16-14 s, R 100-70 s. W falling to zero is a rare rule: his upgrade turns a cooldown ability into a stance.
- **Loop:** Slow with Q, run through the target with E, hold W on while he walks, drill R when the target gets low, then finish on the recast.
- **Decision:** Use E to close the gap (a stun and a flip) or to dodge, and R early to chain a target or late to threaten an execution. If the leash breaks, the execution is lost.
- **Counterplay:** R is a long straight shot that a body or a wall blocks. After the hit, leave the leash range, or keep health above the threshold; the execution is a long, readable animation. E and Q have clear telegraphs.
- **Mastery:** Walking in time with the machine gun while shotguns reload, and holding R for the moment the recast threshold is reached.
- **For a duel:** An execution with a visible health threshold (see Riot's [2017 roadmap](https://nexus.leagueoflegends.com/en-us/2017/06/champion-roadmap-june-2017/)) gives both players a countdown. The kit is a little overloaded with systems. [transfers]

### Varus, the Arrow of Retribution
Marksman, Artillery · ranged · mana · 2012 · last rework: none

- **P (Living Vengeance):** On kills and assists he gains attack damage and ability power, more for a champion.
- **Q (Piercing Arrow):** Hold to charge an arrow (about 1.25-1.5 s) that gets longer range and more damage, then release. Slows him while holding.
- **W (Blighted Quiver):** Attacks apply Blight stacks (to three); his abilities then detonate them for percent-health damage and refund part of his cooldowns. The active supercharges the next arrow.
- **E (Hail of Arrows):** Arrows land after a short wait and leave a slowing zone that cuts healing for 4 s.
- **R (Chain of Corruption):** A tendril roots the first champion hit and spreads to nearby ones.
- **Rhythm:** Q 16-12 s, W 40 s flat, E 18-10 s, R 100-60 s. Blight detonation hands back a share of the first three, so a fight that lands stacks turns the short cooldowns into a loop.
- **Loop:** Stack Blight with attacks, charge a Q to full range, detonate with Q or E, refunded cooldowns let him go again, then R catches the one who runs.
- **Decision:** Hold the Q to maximum charge for range and damage, or release early and keep moving. Charging wins the trade but it slows him and shows his intent.
- **Counterplay:** The charge is a clear tell and he moves slowly while holding it; step out of line, or hit him then. R is a skillshot with a travel time, but the spread is strong against grouped enemies. E's zone has a wait before damage.
- **Mastery:** Charging Q while out of reach and landing it with stacks present.
- **For a duel:** A charged skillshot with a loud tell is a clean duel tool, and the cooldown refund rewards setup. In a 1v1 the R spread has nothing to spread to. [partly]

### Vayne, the Night Hunter
Marksman · ranged · mana · 2011 · last rework: none

- **P (Night Hunter):** Night Hunter. She runs faster while facing a nearby visible enemy champion; the bonus lingers about 2 s after sight is lost and triples during her ultimate.
- **Q (Tumble):** Tumble. Short dash that also loads her next attack with bonus physical damage and lifesteal, and resets her attack timer.
- **W (Silver Bolts):** Silver Bolts. Passive. Her attacks and Condemn stack on one target; the third hit adds true damage based on the target's max health.
- **E (Condemn):** Condemn. Targeted bolt that shoves the target back; if the target hits terrain it takes a lot more damage and a stun.
- **R (Final Hour):** Final Hour. For about 8-12 s she gains attack damage, a shorter Tumble cooldown and a short stealth on each Tumble.
- **Rhythm:** about Q 6-2 s, E 20-12 s, R 100-70 s. Q is cheap and nearly always up late, so her attack rhythm is Tumble, hit, hit, hit; E and R are the real windows.
- **Loop:** Tumble in, attack, tumble out, and repeat so the third attack lands the true-damage hit every few seconds. Condemn counts as one of the three stacks, so it doubles as the opener.
- **Decision:** Spend Condemn now for the knockback and a stack, or hold it for a moment when a wall is behind the target and it becomes a stun and a big hit. Spending Q forward adds damage but leaves her without her escape.
- **Counterplay:** Condemn is a targeted cast with a 0.25 s windup, and the push direction is fixed at the end of it, so Flash or standing away from walls answers it. Her range is only medium, so closing the gap works if the enemy can survive three attacks. Final Hour stealth is revealed by its own cast effect.
- **Mastery:** Choosing the angle so the wall is behind the target, and weaving Tumble between attacks without wasting its range.
- **For a duel:** On an arena with cover, "knock into a wall" is the cleanest terrain-as-weapon rule in the roster: the map itself is her damage amplifier, and the opponent can read where she wants to stand. Her kit is mostly one skill check, positioning. [transfers]

### Veigar, the Tiny Master of Evil
Burst · ranged · mana · 2009 · last rework: 2015 VG

- **P (Phenomenal Evil Power):** Phenomenal Evil Power. Every enemy champion his abilities touch gives a point of ability power; a takedown gives five. It never resets.
- **Q (Baleful Strike):** Baleful Strike. Straight bolt that stops at the first two enemies; kills with it give extra stacks.
- **W (Dark Matter):** Dark Matter. Ground blast that lands after about 1.2 s; its cooldown shrinks as his stacks grow, to nothing.
- **E (Event Horizon):** Event Horizon. A ring cage that appears after 0.5 s and lasts about 3 s; anyone who touches its edge is stunned.
- **R (Primordial Burst):** Primordial Burst. Targeted nuke that does up to double damage on a low-health target.
- **Rhythm:** about Q 6-4 s, W 8 s (less with stacks), E 20-14 s, R 120-60 s. Q and W are cheap early, so the stun and the execute are the windows.
- **Loop:** Place the cage, then drop Dark Matter on the exits, then Q the one who tries to leave. Hit the ult when the target is already low.
- **Decision:** Place the cage on the opponent now, or hold it as a wall to deny their approach or escape. Using the stun early wastes the 20 s window; holding it lets them slip away.
- **Counterplay:** Both W and E have visible delays, so moving constantly beats W; for the cage, walk to an edge only when they cannot hit you (the stun only fires once). Q is a thin line blocked by the first body. Ult is a targeted cast with a windup that spell shields stop.
- **Mastery:** Predicting where the opponent will dodge, and placing the cage so every escape route crosses an edge.
- **For a duel:** The cage is zone control with a readable commitment: it makes the enemy choose a side to leave from and punishes the lazy one. The permanent-stack passive snowballs across rounds, which only fits a duel if it resets per round. [partly]

### Vel'Koz, the Eye of the Void
Artillery · ranged · mana · 2014 · last rework: 2016 GR

- **P (Organic Deconstruction):** Organic Deconstruction. Each ability hit adds a mark; the third hit on the same target adds true damage.
- **Q (Plasma Fission):** Plasma Fission. Bolt that slows; recast splits it into two perpendicular bolts, also done automatically on hit.
- **W (Void Rift):** Void Rift. Two-charge ground rift in a line, hits twice (open and collapse).
- **E (Tectonic Disruption):** Tectonic Disruption. Delayed ground blast that knocks up; at close range it also shoves.
- **R (Life Form Disintegration Ray):** Life Form Disintegration Ray. Channeled steerable beam; true damage on a target who has the full marks.
- **Rhythm:** about Q 7 s, W charge 19-15 s, E 12-10 s, R 100-80 s. Four things come back at different speeds, so he always has something to throw.
- **Loop:** Every ability applies a mark, so the sequence is always "three different hits, then true damage." The ult then turns marked enemies into targets for true damage.
- **Decision:** Split the Q early to spread marks and cover angles, or send it straight and let it travel for a long-range hit. Likewise whether to spend the ult's 2.6 s channel while locked in place.
- **Counterplay:** Almost everything has a visible delay, and the channel plants him: any hard disrupt, silence or gap-closer ends it. The Q split is predictable once it flies, and the first bolt line can be sidestepped.
- **Mastery:** Placing the Q split on a wall or a sidestep path so both halves threaten; using the beam's slow steering to track.
- **For a duel:** His whole kit is one rule, "different spells build a payoff," and it forces the player to rotate abilities rather than repeat one. A channel with no escape is a good clear trade between power and risk. [transfers]

### Vex, the Gloomist
Burst · ranged · mana · 2021 · last rework: none

- **P (Doom 'n Gloom):** Doom 'n Gloom. Her next basic ability fears and knocks down on a cooldown; enemies that dash or blink near her get marked, and a following attack or ability detonates the mark and refunds part of that cooldown.
- **Q (Mistral Bolt):** Mistral Bolt. Wave that starts wide and slow, then speeds up and narrows.
- **W (Personal Space):** Personal Space. Burst around herself that damages and gives a shield; wider against dashers.
- **E (Looming Darkness):** Looming Darkness. Ground shadow that explodes and slows; the area grows with distance.
- **R (Shadow Surge):** Shadow Surge. Line shot that marks the first champion hit; recast flies her to them for more damage. A kill lets her recast for free for a short time.
- **Rhythm:** about Q 8-4 s, W 16-12 s, E 12 s, R 140-100 s; passive fear cycle 25-16 s. A takedown refunds the ult, so cooldowns can end up beside each other.
- **Loop:** Wait for the dash, punish it with the fear, then chain Q, E and W while the shield absorbs the reply. Use R as a finishing gap-close.
- **Decision:** Keep the fear ready for a dasher or spend it early on a basic Q. Spending it early gets damage but removes her only answer to a diver.
- **Counterplay:** The best answer is not to dash while Doom is ready: walk, or use dashes after it has been spent. Her range is short, so staying at range beats her.
- **Mastery:** Baiting dashes and playing the cooldown of the fear; and landing Q after its slow start.
- **For a duel:** Riot says the passive is built so that enemy mobility feeds her ([Champion Insights: Vex](https://leagueoflegends.com/en-au/news/dev/champion-insights-vex)), and the same post says her ultimate was awkward for her. Both lessons hold: a counter-rule that punishes one habit is great, but a global chase ult clashes with it. [transfers]

### Vi, the Piltover Enforcer
Diver · melee · mana · 2012 · last rework: none

- **P (Blast Shield):** Blast Shield. Every few seconds her next ability hit gives her a shield worth a tenth of her health.
- **Q (Vault Breaker):** Vault Breaker. Held charge, then a dash that knocks the first champion back; more charge means more range and damage. Tapping too late cancels it.
- **W (Denting Blows):** Denting Blows. Passive. Her attacks stack three times on one target; the third strikes for max-health damage, weakens armor and speeds her attacks.
- **E (Relentless Force):** Relentless Force. Two charges; the next attack gets a cone blast that hits everyone behind the target.
- **R (Cease and Desist):** Cease and Desist. Targeted charge that cannot be stopped; she knocks aside whatever is in the way and lifts the target for over a second.
- **Rhythm:** about Q 12-6 s, E charges 12-8 s, R 140-90 s. The charges give two bursts per fight; the ult is a once-a-fight lock.
- **Loop:** Q to cross the gap, E to hit, attack to hit the third stack, then R when the target is committed.
- **Decision:** Use Q as a charged dash with range and risk, or tap it for a quick short hop. A long charge shows her intent and slows her.
- **Counterplay:** The Q charge is visible and slows her, so stepping back or around it wastes it; the ult has a long dash that tracks, but it can still be dodged by becoming untargetable or by killing the stun with a cleanse (it does not cleanse). Staying out of arm's length matters more.
- **Mastery:** Releasing Q at the right charge for the actual gap, and weaving the E reset into the third attack.
- **For a duel:** A chase kit that is easy to read, hard to dodge, and honest: you see the windup. Charge-for-range is a clean skill-expression slider. [transfers]

### Viego, the Ruined King
Skirmisher · melee · none · 2021 · last rework: none

- **P (Sovereign's Domination):** Sovereign's Domination. A kill soon after damaging a champion makes a wraith; hitting the wraith lets him possess the dead champion's attacks, basic spells and base stats for 10 s, with a free ultimate.
- **Q (Blade of the Ruined King):** Blade of the Ruined King. Line stab; his attacks deal current-health damage, and each marked target gets a second strike.
- **W (Spectral Maw):** Spectral Maw. Charged dash with a mist blast that stuns the first enemy; held longer means more range and stun.
- **E (Harrowed Path):** Harrowed Path. Sends the Black Mist to surround a piece of terrain; while he hides inside it as a wraith he is camouflaged and gains move speed and attack speed.
- **R (Heartbreaker):** Heartbreaker. Blinks to a place, hits everyone nearby, with extra damage on the most wounded champion.
- **Rhythm:** about Q 5-3 s, W 8 s, E 14-6 s, R 120-80 s. Short Q and W cooldowns make him busy; his ult comes back faster when possession ends.
- **Loop:** Charge W through the gap, Q, attack the mark for a second hit, and finish with R. A kill extends the fight by turning the corpse into more tools.
- **Decision:** Take the possession (10 s of untargetable windup, then a borrowed kit) or leave the wraith and keep going. Possession is strong only on a fitting champion.
- **Counterplay:** Do not die near him if he has dealt damage; the W charge is a held channel and can be interrupted. His E camouflage breaks when he attacks.
- **Mastery:** Knowing which enemy kits are worth borrowing, and holding the W charge to match the gap.
- **For a duel:** Riot describes possession as the hook and made him manaless so players did not have to track mana across forms ([Champion Insights: Viego](https://www.leagueoflegends.com/en-us/news/dev/champion-insights-viego/)). In a duel the one kill ends the round, so the passive is almost irrelevant. [5v5 only]

### Viktor, the Herald of the Arcane
Battlemage · ranged · mana · 2011 · last rework: 2024 VG

- **P (Glorious Evolution):** Glorious Evolution. Kills fill a counter; at each full 100 he picks one ability to upgrade, and the ult can be upgraded only after the other three.
- **Q (Siphon Power):** Siphon Power. Targeted hit that gives him a shield and makes his next attack a magic hit; upgrade adds speed.
- **W (Gravity Field):** Gravity Field. Ground field that slows, stacks gravity, and stuns on the fifth stack; upgrade makes his other spells slow.
- **E (Hextech Ray):** Hextech Ray. Aimed line; upgrade makes the line explode a second later.
- **R (Arcane Storm):** Arcane Storm. Roaming storm that follows one champion and can be steered by recast; upgrade grows it with kills.
- **Rhythm:** about Q 9-5 s, W 17-13 s, E 12-8 s, R 120-80 s. W's field and the storm are long, so he has time to reposition between.
- **Loop:** Q for shield, W to lock the area, E along the exit, then recast the storm to chase. Upgrades change which of those is strongest.
- **Decision:** Which ability to upgrade first, and whether to spend the field on the enemy or save it for a wall of stun. Greedy upgrades make the ult stronger but delay the immediate spell.
- **Counterplay:** Walk out of Gravity Field before the fifth stack; dodge the Ray's delayed explosion; the storm is slow and can be outwalked or avoided behind cover (terrain does not block it, so kiting is better).
- **Mastery:** Using the field edge to herd, and steering the storm with recasts.
- **For a duel:** Riot's own account of the 2024 update was not found, so this is analysis, not from Riot. Mid-game upgrade choices are a fine "build" decision inside one match, but they depend on a kill economy that a short duel round lacks. [partly]

### Vladimir, the Crimson Reaper
Battlemage · ranged · health · 2010 · last rework: 2016 GR

- **P (Crimson Pact):** Crimson Pact. Converts some of his bonus health into ability power, and some ability power into extra health.
- **Q (Transfusion):** Transfusion. Targeted hit that heals him; two casts build Crimson Rush, which gives speed and makes the next cast stronger.
- **W (Sanguine Pool):** Sanguine Pool. He sinks into a pool for 2 s, untargetable, slowing and draining enemies on top of him; costs a fraction of his health.
- **E (Tides of Blood):** Tides of Blood. Charge for up to 1.5 s, then fire bolts; the longer the charge, the more damage and a slow.
- **R (Hemoplague):** Hemoplague. Area curse that raises damage taken for 4 s, then bursts and heals him per champion hit.
- **Rhythm:** about Q 9-4.6 s, W 28-16 s, E 13-5 s, R 120 s. Q and E cooldowns drop a lot with rank, so he becomes hit-heavy late.
- **Loop:** Q, Q, empowered Q while the surge lasts, then E during the surge, and Pool when the answer arrives.
- **Decision:** Pay health to charge E or Pool now, or stay healthy. The health costs make every cast a bet on whether the trade pays back.
- **Counterplay:** Wait for Pool to end, the 2 s untargetable window is the only protected time, and the end-tick leaves him exposed. Avoid fighting on top of Pool, and break line on Tides by stepping behind cover. After R, the curse is visible and its burst is delayed.
- **Mastery:** Timing the surge to the empowered Q, and spending Pool at the exact moment to dodge a kill.
- **For a duel:** Riot's 2016 mage update notes were not found directly, so this is analysis, not from Riot. Health as a resource turns every cast into a live risk, and a short round suits it well. [transfers]

### Volibear, the Relentless Storm
Juggernaut · melee · mana · 2011 · last rework: 2020 VG

- **P (The Relentless Storm):** Hits build up to five attack-speed stacks; at five, the next hit arcs lightning to nearby enemies.
- **Q (Thundering Smash):** Ghosted sprint into an empowered attack that dashes in and stuns about 1 s.
- **W (Frenzied Maul):** Targeted punch that marks the target; a second W on a marked target becomes a bite that heals.
- **E (Sky Splitter):** Delayed ground lightning (about 2 s) that slows and shields Volibear if he stands in it.
- **R (Stormbringer):** Leaps to a spot, gains bonus health and range for about 12 s, disables nearby towers and slams for a slow.
- **Rhythm:** Q 12-10 s, W 5 s, E 16 s, R 160-110 s. The 5 s W is a flat short loop; E and R are the long beats everything else orbits.
- **Loop:** W to mark, Q to close and stun, W again for the bite, with W hits topping up the passive stacks. E is dropped on a spot he plans to stand in.
- **Decision:** Spend Q as a chase tool from range, or hold it to answer the opponent's gap-closer. Q is also the only thing that gets him to a runner; spent early, he has no answer to a retreat. Or fall back on E, whose delay only hits a target who is cornered.
- **Counterplay:** E's two-second telegraph is readable and easy to leave. Q gives the target a half-second to sidestep before the stun lands, and the empowered attack ends if he is stunned. R's slam is dodged by running off the landing circle; he cannot be stopped mid-flight.
- **Mastery:** Landing E when the opponent is walled in by his Q, and starting R so the slam traps them against cover.
- **For a duel:** The two-part W (mark, then heal bite) and a telegraphed lightning that rewards the bear for standing in it are clean duel ideas. Riot says it aimed for "relentless" and "unstoppable" ([dev update](https://www.leagueoflegends.com/en-us/news/dev/fiddlesticks-and-volibear-dev-update-1/), [A Storm is Brewing](https://www.leagueoflegends.com/en-gb/news/dev/dev-a-storm-is-brewing/)); analysis, not from Riot: the CC-immune R delivers that, and on a small arena it is a strong, slightly low-counterplay window. [transfers]

### Warwick, the Uncaged Wrath of Zaun
Diver · melee · mana · 2009 · last rework: 2017 VG

- **P (Eternal Hunger):** On-hit damage, and heavy self-healing from those hits once his health is low.
- **Q (Jaws of the Beast):** Short targeted lunge and bite that heals; holding the button keeps him latched on, so he follows the target's dash.
- **W (Blood Hunt):** Marks the nearest enemy; gives attack and move speed against wounded enemies.
- **E (Primal Howl):** Damage-reduction stance; recast (or let it end) fears nearby enemies for about 1 s.
- **R (Infinite Duress):** Directional leap that suppresses the first champion it touches for up to 1.5 s.
- **Rhythm:** Q 8-6 s, W 80-40 s, E 15-11 s, R 110-70 s. Q is spammable; W is a long scouting tool; R is a rare, hard commitment.
- **Loop:** Q to land on the target, auto while they run, E for a defensive window that ends in a fear, R to finish when the target is low or has no escape.
- **Decision:** Chase now with Q, or keep it so he can close a gap after the opponent flashes or walks away. Hold E for defence, or release it early for the fear to stop a fleeing target. Warwick gets stronger as he gets hurt, so the real choice is how low he can afford to sit.
- **Counterplay:** R is a visible, line-shaped lunge that ends the moment it hits something or any CC-immune check applies; a spell shield or cc-immune target makes it fail. Q has a short bite delay, and dashing away just drags Warwick after you. The opponent can also burst him past the heal threshold before it matters.
- **Mastery:** Timing the E recast so the fear lands the moment R's dash or Q's leap needs a stopped target; keeping health in the 25-50% band where the heal peaks.
- **For a duel:** A chaser who heals more when losing gives the weaker side a real comeback arc, and a lunge that sticks to a moving target is a strong answer to kiting, so in an arena with cover it needs a clear range and a clear tell. Riot's own words on this update were not found; the Q gap-closer was added at the 2017 update per press only. [transfers]

### Wukong, the Monkey King
Diver · melee · mana · 2011 · last rework: 2020 GR

- **P (Stone Skin):** Armor and regeneration that double with a stack count built by hitting enemies.
- **Q (Crushing Blow):** Next attack gets reach, bonus damage and armour shred; cooldown shrinks as he hits.
- **W (Warrior Trickster):** Brief invisibility dash that leaves a fighting clone for 4 s.
- **E (Nimbus Strike):** Targeted dash with clones that strike nearby enemies, then attack speed.
- **R (Cyclone):** Spins for up to 2 s, knocks up once, can be recast within the window.
- **Rhythm:** Q 8-6 s, W 22-18 s, E 10-7 s, R 130-90 s. The Q refund on hit means long fights run faster than the numbers.
- **Loop:** W to vanish, E to blink onto a target while the clone mirrors, Q on arrival, R when the target is stuck beside him.
- **Decision:** Stay invisible and hold the clone as a decoy while the opponent guesses, or fire E and Q at once for damage but with no misdirection left. A clone copies R, so casting after W doubles the spin.
- **Counterplay:** The real Wukong is unknown only for about a second; once the invisibility fades, the clone has lower damage and dies to hits. E is a targeted dash that spell shield, a grounding effect or a knock-down stops. R is mostly a short-range circle, so a fast opponent can leave its edge.
- **Mastery:** Casting abilities during W's dash so the clone copies them, and choosing which one of the two bodies stays in front.
- **For a duel:** A clone-as-bluff is a great 1v1 tool because the opponent must choose which body to answer. The whole kit is built around that single trick, which makes the rest feel plain. Riot's reasoning was not found; press says the 2020 rework aimed at a "trickster" fantasy (analysis, not from Riot: it delivers). [transfers]

### Xayah, the Rebel
Marksman · ranged · mana · 2017 · last rework: none

- **P (Clean Cuts):** Casting spells loads stacks; each attack uses one to fire a feather that piercing-hits and is planted.
- **Q (Double Daggers):** Fires two daggers in a V, which become planted feathers.
- **W (Deadly Plumage):** Attack-speed burst; her attacks fire an extra feather and a hit gives movement speed.
- **E (Bladecaller):** Recalls every planted feather to her; three feather hits root the target.
- **R (Featherstorm):** Leaps up, untargetable for about 1.5 s, then fires a cone that plants feathers.
- **Rhythm:** Q 10-8 s, W 18-14 s, E 12-8 s, R 140-100 s. Q and E run in a loop; R is a rare reset button.
- **Loop:** Q or an attack plants feathers behind the opponent, W to hit faster and plant more, then E pulls them all back through the target for a root.
- **Decision:** Use E for damage now with a few feathers, or wait to build three on a single enemy so the root lands. Or use R early as a safe escape that plants feathers, or save it to cap a root.
- **Counterplay:** Feathers are visible on the ground, so the opponent can stand away from them and deny the root; a blocking effect stops their path. She cannot attack or cast during R, so a patient opponent can wait for its cone.
- **Mastery:** Leaving her feathers so the enemy is between them and her, then rooting just as they commit to a dash.
- **For a duel:** The idea of a trail of threat she leaves in space and cashes in later is great for arenas with cover, because the opponent must read her positioning. [transfers]

### Xerath, the Magus Ascendant
Artillery · ranged · mana · 2011 · last rework: 2014 GR

- **P (Mana Surge):** Periodic attack restores mana, more against champions.
- **Q (Arcanopulse):** Charged beam; holding it lengthens range before it fires.
- **W (Eye of Destruction):** Delayed ground blast with a stronger centre and slow.
- **E (Shocking Orb):** Skillshot orb that stuns longer the farther it flew.
- **R (Rite of the Arcane):** Stands and fires several long-range, delayed missiles at places you pick.
- **Rhythm:** Q 9-5 s, W 14-10 s, E 13-11 s, R 130-100 s. Everything is slow and telegraphed, so he is paced by his own delays.
- **Loop:** W slows a spot, Q or E lands on the slowed enemy, R fires several missiles at where they run.
- **Decision:** Stand still and charge Q for range while the opponent closes, or fire it short and keep moving; hold E for a long, strong stun or throw it early for a short one.
- **Counterplay:** Every ability has a delay, so any opponent who closes the distance through an unpredictable path beats them. E has a long travel time, and stuns on near targets are short.
- **Mastery:** Placing W so the dodge path runs into E's line, and using R's reveal-limits and missile delay to lead the target.
- **For a duel:** Range as a skill: charge-time as distance is a good readable choice. The kit is weak close-up and the ultimate is arguably too sluggish for a short-round game with cover; no Riot source found for the 2014 rework. [partly]

### Xin Zhao, the Seneschal of Demacia
Diver · melee · mana · 2010 · last rework: 2017 GR

- **P (Determination):** Each third attack heals and hits harder; the farthest enemy hit by W or his dash is marked Challenged.
- **Q (Three Talon Strike):** Next three attacks hit harder; the third knocks up; each one trims other cooldowns.
- **W (Wind Becomes Lightning):** Three-part cone and line thrust that slows and marks the farthest target.
- **E (Audacious Charge):** Targeted dash with a small slow and attack speed.
- **R (Crescent Guard):** Circle sweep that knocks everyone back except the Challenged target, and protects him.
- **Rhythm:** Q 7-5 s, W 12-8 s, E 11-11 s, R 120-100 s. The Q cooldown shrinks with every empowered attack.
- **Loop:** E onto a target, Q for three quick hits and a knock-up, W thrust to slow and mark, auto-attacks for the heal.
- **Decision:** Use E at range as a chase tool, or save it so he can reach a Challenged enemy with the longer range. R either keeps a duel-mate locked beside him or throws them away.
- **Counterplay:** E is a targeted dash, so spell shield or a block stops it. The W thrust is a visible line, and R does not knock the Challenged target away, so that target stays in reach. He is rarely safe on retreat.
- **Mastery:** Chaining Q's third strike into W's thrust, and timing R so the marked one is the only one left standing.
- **For a duel:** The Challenged mark forces the two fighters into a literal duel, which is a clean 1v1 idea. Press says the 2017 goal was a duelist identity apart from Fiora (no Riot link found). [transfers]

### Yasuo, the Unforgiven
Skirmisher · melee · other (Flow) · 2013 · last rework: none

- **P (Way of the Wanderer):** Extra crit chance; moving builds Flow, and a full bar becomes a shield when hit.
- **Q (Steel Tempest):** Thrust; two hits load a whirlwind that knocks airborne.
- **W (Wind Wall):** Wall that stops enemy projectiles.
- **E (Sweeping Blade):** Dash through a target, with the same target locked out for several seconds.
- **R (Last Breath):** Blink to an airborne enemy; knocks up nearby airborne enemies, then max Flow.
- **Rhythm:** Q 4-1.33 s (attack-speed scaled), W 25-17 s, E 0.5-0.1 s, R 70-30 s. E spam means mobility is almost free, so the limits are the target lockout and the wall.
- **Loop:** E in, Q Q to load the whirlwind, knock-up, then R on the airborne target.
- **Decision:** Spend the wall at once to cancel a skillshot, or hold it to save his own approach. Dash through the opponent now or wait for a target he needs.
- **Counterplay:** W is the answer to ranged enemies, so melee ones can only avoid the whirlwind or keep the distance and make E have nothing to hit. Without a knock-up on a target, R does nothing, which is why he needs an ally or his own Q.
- **Mastery:** Threading Q through E so the whirlwind fires during the dash, and walling the exact skillshot that ends the fight.
- **For a duel:** A projectile wall forces ranged opponents to change tactics in a 1v1 and is a rare deliberate counter. His R needs another airborne source, a trap in a 1v1 where nobody else knocks up, so only his own Q works. No Riot source found for the kit. [partly]

### Yone, the Unforgotten
Assassin, Skirmisher · melee · other (Flow) · 2020 · last rework: none

- **P (Way of the Hunter):** Extra crit chance; attacks alternate physical and half-magic damage.
- **Q (Mortal Steel):** Thrust; two hits load a dash and whirlwind that knocks airborne.
- **W (Spirit Cleave):** Cone slash with a shield that grows per champion hit.
- **E (Soul Unbound):** Leaves his body behind in a ghost form, then snaps back to detonate stored damage.
- **R (Fate Sealed):** Wide line stun and blink past the farthest target, then pulls them to him.
- **Rhythm:** Q 4-1.33 s (attack-speed scaled), W 14-6 s, E 22-10 s, R 120-80 s. E and R are the two long, committal beats.
- **Loop:** Q Q for the dash, E out, spend abilities while ghosted, recast to bring the damage back, R to end the fight.
- **Decision:** Start E early to bank damage and risk ending far from his body, or wait and use it as a safe retreat. He can also close with R or save it as the escape.
- **Counterplay:** The body he leaves behind shows where he will return; the opponent can stand on it or kill him before. R has a 0.75 s windup, and the line is dodgeable. His shield absorbs the first answer, so the opponent should wait for it to drop.
- **Mastery:** Fitting a full burst combo into the ghost window and having R's pull put the target in range of the E return.
- **For a duel:** Riot says the first plan to make him an echo of Yasuo failed and the brothers were redesigned to contrast ([Champion Insights](https://www.leagueoflegends.com/en-us/news/dev/champion-insights-yone/)). The "store your damage, come back and cash in" idea is a standout 1v1 mechanic. [transfers]

### Yorick, the Shepherd of Souls
Juggernaut · melee · mana · 2011 · last rework: 2025 GR

- **P (Shepherd of Souls):** Dead enemies leave graves (max 4); graves become Mist Walker minions when spent.
- **Q (Last Rites):** Empowered next hit with extra reach and a self-heal; with 3+ graves it can instead raise walkers.
- **W (Dark Procession):** A delayed ring of spirits that shoves and pulls enemies, then stays as a wall.
- **E (Mourning Mist):** Thrown mist: percent-health damage, slow, and a Cursed mark that sends walkers at the target.
- **R (Eulogy of the Isles):** Summons the Maiden, a second body that pushes and marks a target for a heavy hit; she dies if Yorick does.
- **Rhythm:** Q 6-4 s, W 20-12 s, E 12-8 s, R 160-100 s. Q is nearly always up, so the real windows come from W (long) and from how many graves are banked.
- **Loop:** Hit with Q, curse with E, trap with W, and turn graves into a small army that chases the cursed target.
- **Decision:** Spend graves now on a short army that chases a cursed enemy, or hold them for a bigger swarm later. Holding risks losing them (they vanish if he leaves the area); spending them early leaves nothing for the next exchange.
- **Counterplay:** The W ring has a visible delay, so step out before it closes. Kill walkers or kite them, and attack the Maiden, who is fragile and drops with Yorick. The Cursed mark is a clear signal to leave.
- **Mastery:** Placing W so the wall splits an enemy from escape, and timing Q resets between auto attacks. Riot's 2025 notes pushed him toward being more self-sufficient with more walkers ([Patch 25.07](https://www.leagueoflegends.com/de-de/news/game-updates/patch-25-07-notes/)).
- **For a duel:** Without minions the grave economy has little to feed on, so only the pet-plus-wall pattern survives. The terrain wall is strong on an arena with cover. [partly]

### Yunara, the Unbroken Faith
Marksman · ranged · mana · 2025 · last rework: none

- **P (Vow of the First Lands):** Crits add a bonus magic hit that heals her and can crit again.
- **Q (Cultivation of Spirit):** Basic attacks build stacks; spending all eight gives a short burst of fast, splashing attacks.
- **W (Arc of Judgment | Arc of Ruin):** A slow-moving bead that hard-slows on first touch and lingers at max range.
- **E (Kanmei's Steps | Untouchable Shadow):** A short ghosted speed burst, stronger when she faces a champion.
- **R (Transcend One's Self):** A 15-second state that makes Q free and turns W and E into a beam and a dash with refreshed cooldowns.
- **Rhythm:** W 10 s, E 9 s, R 100-80 s; Q has no cooldown, only stacks that refill by attacking (about 6 s against a champion). Her power peaks in the 15 seconds of R, then she goes back to plain attacking.
- **Loop:** Auto attack to fill stacks, pop Q for a burst, slow with W to keep the target in reach, and use E to reposition while attacking.
- **Decision:** Fire Q the moment it fills, or wait until the target is slowed or pinned so the whole burst lands. Early gives steady damage but may waste the window; late risks the stacks fading after 6 s.
- **Counterplay:** The W bead is slow and readable, and her stack bar shows when Q is ready. Engage when stacks are low, and avoid fighting during R, then press when it ends.
- **Mastery:** Chaining W into Q so the slow covers the whole burst, and saving E's ghosting to dodge the answer. In R, casting the beam during the dash.
- **For a duel:** A resource built only by attacking forces committing to the fight, which is a clean lesson. R refreshing cooldowns makes one window huge, a design with some risk. [transfers]

### Yuumi, the Magical Cat
Enchanter · ranged · mana · 2019 · last rework: 2023 GR

- **P (Feline Friendship):** Friendship heals her (and her partner) after a hit; the ally with most stacks becomes Best Friend.
- **Q (Prowling Projectile):** A steerable missile while attached; it accelerates and slows harder after the channel.
- **W (You and Me!):** Dash onto an ally and ride them, untargetable, casting from their position.
- **E (Zoomies):** Shield, move speed and attack speed; while attached they go to her ally instead of her.
- **R (Final Chapter):** A channelled sequence of five healing and damaging waves.
- **Rhythm:** Q 6.5 s, W 10 s down to 0 by level, E 10 s, R 120-100 s. With no real W cooldown late, she can detach and reattach freely.
- **Loop:** Ride an ally, steer Q at the enemy, shield on E when the fight starts, and use R in the middle of the exchange.
- **Decision:** Stay attached and safe, buffing the ally, or detach to dash, attack or reposition. Attached is nearly immune but passive; detached is risky and gives enemies a target for the first time.
- **Counterplay:** Hit her when she hops between allies, or while detached. Kill the carrier. Her steered Q can be sidestepped after the long wind-up. Riot kept untargetability but added counterplay while attached ([Riot dev post](https://pre-blades-bw-testing.leagueoflegends.com/en-us/news/dev/dev-launching-yuumi-s-rework/)).
- **Mastery:** Knowing when to detach for the lethal Q, and steering around blockers.
- **For a duel:** No ally means the kit does not exist. A cat that rides the enemy would be a different design altogether. [5v5 only]

### Zaahen, the Unsundered
Skirmisher · melee · mana · 2025 · last rework: none

- **P (Cultivation of War):** Hits build Determination stacks (to 12); at max stacks the bonus doubles, and a lethal hit triggers a 4-second revive on a long timer.
- **Q (The Darkin Glaive):** A double-strike attack, then a recast that knocks up with a stronger hit.
- **W (Dreaded Return):** A thrust that damages on the way out, then returns, stuns and pulls enemies in.
- **E (Aureate Rush):** A dash with a flourish; the outer edge hits harder.
- **R (Grim Deliverance):** A leap with a delay and slam, CC-immune while airborne, healing per champion hit.
- **Rhythm:** Q 8-6 s, W 14-12 s, E 10-8 s, R 110-80 s, revive 300-120 s by level. Everything is short enough to be rolled in a chain.
- **Loop:** Stack Determination by landing anything, chain E into Q into Q recast, pull with W, and finish with R.
- **Decision:** Fight on at max stacks, knowing a revive is available, or retreat to keep the stacks and survive. Staying uses the revive; leaving drops the stacks in 5 s.
- **Counterplay:** Bait the revive and then burst while he is returning; the 4 seconds are a free window to step away or heal. W can be sidestepped, and the knock-up recast is a visible second press. Shield blocks the recast's knock-up.
- **Mastery:** Sequencing E's edge hit, and using R's immunity to start the fight.
- **For a duel:** A revive on a long timer is good in 1v1 only if its use is clearly signalled. No Riot design writing on him found. [transfers]

### Zac, the Secret Weapon
Vanguard · melee · health · 2013 · last rework: 2017 GR

- **P (Cell Division):** Abilities leave goo chunks that heal him when picked up; on death he splits into bloblets and can revive.
- **Q (Stretching Strikes):** A stretching arm that slows, then a second strike; two targets get slammed together.
- **W (Unstable Matter):** A short-cooldown burst of percent-health damage around him.
- **E (Elastic Slingshot):** A channelled long leap; holding longer extends range and the stun.
- **R (Let's Bounce!):** A string of bouncing hits that knock up and slow, while he moves freely.
- **Rhythm:** Q 14-8 s, W 5 s, E 21-9 s, R 120-90 s. Every ability costs health, so a fast W is a real trade, not a freebie.
- **Loop:** Open with a Q arm, jump in with E, burst with W for chunks, and grab chunks for healing while the enemy chases.
- **Decision:** Pay health to cast again, or hold back to stay healthy. Casting gets chunks to heal back, but only if enemies do not step on them first.
- **Counterplay:** The E is a long visible channel, so dodge the landing circle. Step on chunks to destroy them, and watch for the revive timer.
- **Mastery:** Using E's hold time to land the wide stun, picking up chunks mid-fight, and managing health costs.
- **For a duel:** Health as a cost is one of the best ideas here: spending is a choice with a visible price. The goo gives something on the ground to fight for. [transfers]

### Zed, the Master of Shadows
Assassin · melee · energy · 2012 · last rework: none

- **P (Contempt for the Weak):** Hits on enemies below half health deal extra percent-health magic damage.
- **Q (Razor Shuriken):** A piercing shuriken that shadows copy.
- **W (Living Shadow):** Sends a shadow; recast swaps places; the clone repeats his Q and E.
- **E (Shadow Slash):** A spin that slows and shortens W's cooldown.
- **R (Death Mark):** Dash behind a champion untargetable, mark them, and detonate stored damage 3 seconds later.
- **Rhythm:** Q 6 s, W 20-16 s, E 5-3 s, R 120-100 s. W is the long cooldown that gates the entire pattern, E trims it.
- **Loop:** W out, Q through both bodies, step in with the swap, E, then R and burn damage into the mark.
- **Decision:** Use W as an attack (clone for double Q) or as an escape (swap away). Attacking commits his position; escaping wastes the damage window.
- **Counterplay:** Watch the shadow, because the real Zed is nearly always on it or nearby. Delay a kill until the mark runs out, and use a zone or shield when R lands. The 3-second mark is the loudest tell in the game.
- **Mastery:** Placing the shadow at an angle for double hits, then hiding the swap until the last moment.
- **For a duel:** The clone is a lovely decoy tool, and the mark delay gives the victim a real answer. R's guaranteed targeting is the unfair part. [transfers]

### Zeri, the Spark of Zaun
Marksman · ranged · mana · 2022 · last rework: none

- **P (Living Battery):** Moving charges her; a full charge makes the next attack an execute-style percent-health hit.
- **Q (Burst Fire):** Seven rapid rounds in a line; each acts as a basic attack with on-hit effects.
- **W (Ultrashock Laser):** A pulse that slows; when it hits a wall it becomes a delayed laser.
- **E (Spark Surge):** A dash that crosses terrain and empowers Q to pierce.
- **R (Lightning Crash):** A nova that overcharges her with speed and chained rounds.
- **Rhythm:** Q has no fixed cooldown (attack speed capped), W 12-8 s, E 24-18 s, R 80-70 s. Hits on champions shorten E, so a good fight shortens her own gaps.
- **Loop:** Move to charge, Q while kiting, bank a full shot, then E over a wall and R to snowball.
- **Decision:** Keep running to charge the shot, or stop and fire Q at once. Running builds a lethal hit but deals less; stopping deals steady damage but wastes the passive.
- **Counterplay:** Her charge is visible, so avoid the full-charge hit and punish when she is empty. Dodge the W pulse to deny the laser. Chase her when E is down.
- **Mastery:** Aiming Q like an Ezreal skillshot, using walls for W's laser, and weaving through terrain with E ([Riot roadmap framing via PCGamesN](https://www.pcgamesn.com/league-of-legends/zeri-abilities)).
- **For a duel:** Movement-as-resource suits an arena with cover. Her auto attack being her Q is a strong unifying idea. [transfers]

### Ziggs, the Hexplosives Expert
Artillery · ranged · mana · 2012 · last rework: none

- **P (Short Fuse):** Every few seconds a basic attack hits harder; casting abilities shortens the wait.
- **Q (Bouncing Bomb):** A lobbed bomb that bounces up to twice.
- **W (Satchel Charge):** A satchel you detonate yourself; it throws enemies back and throws him away if caught.
- **E (Hexplosive Minefield):** Eleven proximity mines across an area that slow.
- **R (Mega Inferno Bomb):** A huge global-range bomb with a long flight and a wide area.
- **Rhythm:** Q 6-4 s, W 20-12 s, E 16 s, R 120-70 s. The short Q is the poke; E and W are the long cooldown "set pieces".
- **Loop:** Poke with Q, mine the lane with E, satchel to separate or to flee, and fire R at a locked target.
- **Decision:** Use W to shove the enemy away, or blow it up under himself to escape. Pushing keeps distance but wastes the escape; escaping surrenders the space.
- **Counterplay:** The R indicator is slow, so leave the circle. Mines are visible after arming, so walk around them. The satchel has a 4-second fuse, so do not stand beside it.
- **Mastery:** Reading bounces off walls for Q, setting E in the path the enemy will take, and using W's self-dash to dodge.
- **For a duel:** Zoning with terrain-aware bombs fits cover maps well. R's range is made for big lanes, and would need a smaller arena. [partly]

### Zilean, the Chronokeeper
Specialist · ranged · mana · 2009 · last rework: 2015 VG

- **P (Time In A Bottle):** Stored experience he can pour into an ally who is near a level-up. Irrelevant to a duel.
- **Q (Time Bomb):** Throws a bomb at a spot. It sticks to the first enemy it touches, shows them, and blows up after about 3 s. A second bomb on the same unit pops the first at once and stuns.
- **W (Rewind):** Cuts the remaining cooldown of Q and E by 10 s. Only usable while one of them is cooling down; not learnable at level 1.
- **E (Time Warp):** Targeted. Slows an enemy champion, or speeds an ally (or himself) a lot.
- **R (Chronoshift):** Puts a rune on himself or an ally for 5 s. If that champion would die, they become untargetable and invulnerable for a moment and then revive healed.
- **Rhythm:** Q 10-8 s, W 14-6 s, E 15 s flat, R 120-60 s. W makes the Q cooldown a variable, so the real rhythm is whatever the player chooses to buy back.
- **Loop:** Bomb, bomb again to pop and stun, slow with E to hold them in place, W to be ready for another bomb sooner.
- **Decision:** Spend W now to get a second bomb out and stun, or hold it so the E and Q are covered later. Cast the R early on himself as insurance, or keep it for the moment it saves a fight.
- **Counterplay:** The bomb takes 3 s to go off, so the target can walk away from allies or kill the fuse by dying elsewhere; a spell shield blocks the attach. The stun needs two bombs, so the enemy can see the second throw coming and sidestep it.
- **Mastery:** Placing the second bomb so that the stun lands on a stationary target; spacing the E slow so the first bomb cannot be walked out of.
- **For a duel:** The "refund cooldowns at a price" button (W) is a good tension: a player's own cooldown clock becomes a resource. The self-revive R is also a clean answer to a single killing blow. [transfers]

### Zoe, the Aspect of Twilight
Burst · ranged · mana · 2017 · last rework: none

- **P (More Sparkles!):** After any ability, the next basic attack within 5 s hits harder and cannot be dodged as a projectile.
- **Q (Paddle Star!):** Fires a star; the further it travels the harder it hits. A recast steers it, making it bigger and faster for even more.
- **W (Spell Thief):** Picks up spell shards dropped by enemies using summoner spells or item actives and borrows their effect; also grants orbiting bolts and speed on use. Drop-based, so it depends on events outside the kit.
- **E (Sleepy Trouble Bubble):** A bubble kick that leaves the target drowsy (small slow), then asleep. Hitting a sleeper makes them take the hit as true damage.
- **R (Portal Jump):** Blinks a short way, waits about a second, then blinks back to where she started.
- **Rhythm:** Q 8.5-6.5 s, E 18-14 s (partly refunded on a hit), R 11-5 s, W essentially a free action. The long E cooldown is the one real commitment.
- **Loop:** Land a bubble, hold position while the drowsy timer runs, redirect the Q across the map into the sleeper, then hit them again for the sleep damage.
- **Decision:** Throw the bubble at long range for a chance at a rare kill and risk a wasted 18 s, or wait to be sure it hits. Use the R as a forward blink to reach, or as a free return from a risky Q setup.
- **Counterplay:** The sleep is delayed, so a champion with a cleanse or a dash can break out of drowsy; anyone can dodge the bubble because it is slow and she has no gap close that comes after it. Riot said the delayed sleep was meant to make it stronger offensively than defensively ([Zoe Insights](https://nexus.leagueoflegends.com/en-us/2017/11/champ-insights-zoe/) via press summary).
- **Mastery:** Walking the Q far behind a wall before recasting; the R lets her place the star's origin.
- **For a duel:** Riot's own note says the kit was built to enable the long Q. That is the useful lesson: one skillshot rewarding distance and aim. The sleep wake-up damage is a good "punish the response" design. [transfers]

### Zyra, Rise of the Thorns
Catcher · ranged · mana · 2012 · last rework: 2016 VG

- **P (Garden of Thorns):** Seeds appear near her over time and when she hits things. Her spells turn a seed into a plant that fires on enemies.
- **Q (Deadly Spines):** Delayed area damage. If it lands on a seed, that seed grows into a ranged plant.
- **W (Rampant Growth):** Plants a seed on the ground with 2 charges. Enemies who step on it destroy it and become visible.
- **E (Grasping Roots):** Skillshot that roots. If it passes over a seed, that seed grows into a melee plant that slows.
- **R (Stranglethorns):** A thicket erupts in an area over 2 s, then knocks everything up. Plants caught in it are boosted and healed.
- **Rhythm:** Q 7-5 s, W 16-10 s (stored), E 11 s flat, R 110-90 s. Q and E sitting on shorter cooldowns than W's charge refill gives her a repeated "plant, then spend" beat.
- **Loop:** Place seeds with W, hit them with Q or E so they become plants, fight beside her plants, and use the R to enrage them and add a knockup.
- **Decision:** Spend a seed charge now on a tricky angle or save it so a root is guaranteed to have a plant ready. Fire the R early to start the plants' boost or wait to catch the opponent.
- **Counterplay:** Plants die in 8 s and a seed is revealed to enemies and can be stepped on; the root is a straight line.
- **Mastery:** Pre-placing seeds so that a root lands on the enemy and the spell makes a Vine Lasher on the way. A weaker player has seeds but no plan for them.
- **For a duel:** "Make your own terrain" matters in a duel: the seeds are small zone pieces that you set and then spend. The plants are a minion-like feature a duel would have to simplify. [partly]
