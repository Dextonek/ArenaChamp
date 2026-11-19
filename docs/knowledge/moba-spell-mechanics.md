---
title: MOBA spell mechanics
tags: [knowledge, research, moba, spells, targeting, counterplay, league-of-legends, dota2, smite]
updated: 2026-11-19
---

# Five input shapes build every MOBA spell

League of Legends, Dota 2 and Smite build every ability from the same five inputs: no target, a unit, a ground point, a direction, or a two-point vector. On top of that sits a timing pattern (passive, toggle, channel, charge, recast, ammo, stance) and one hit rule (the first unit hit, everything along the path, or the whole area). The three games differ in the mix and in how a cast resolves. **Dota clicks:** of its 736 ability entries in patch 7.42, 162 target a unit, and its answers are a toolbox of blinks that make projectiles miss, spell blocks, three levels of dispel, and a wind-up (median 0.30 s) that costs nothing when it is interrupted. **Smite aims everything:** it has no lock-on at all, even melee basic attacks are aimed cones, each shot's notes say what stops it, every player carries one cleanse, and repeated crowd control (CC) gets shorter by a formal rule. **League sits between them:** a 0.25 s cast time that nothing but death interrupts, the richest input options, and the only published readability rules of the three. **Our game is already a dodgeable, terrain-rich design.** Every area spell is judged on the victim's live position, 23% of our spells put a fuse on the floor, 27% of our kits build terrain (League: 10%), losing sight works as our way of dodging a targeted spell, and our lock cap (1.5 s in total, then 0.5 s of immunity) is stricter than Smite's. Our gaps are in four places. We lack input forms: no vector aim, no toggle, one charge-up and three channels. We lack answer buttons: no spell shield, cleanse, immunity or shared escape. Every cast roots the caster until it lands: 0.4 s to 2.5 s, where the others typically commit for 0.25 to 0.3 s and only a few listed spells take 1 to 3 s. And our resolution rules live in code comments, not on the screen. The ranked list at the end starts with cheap, safe work: write each spell's rules down and check every answer with arithmetic. It ends with two expensive experiments: a shared answer button and casting while moving.

This report builds on the League research already in this folder and does not repeat it. [League champion kits](league-champion-kits.md) reads all 173 League kits and counts their parts. [League kit design](league-kit-design.md) explains why those kits work and gives a 35-question checklist for our kits (its "our 20 heroes" parts predate the v5 rebuild; the current state of our spells is in the inventory note below). The notes in [league-research/](league-research/kit-anatomy.md) cover kit anatomy, Riot's design values and failed reworks. This report adds Dota 2, Smite and the mechanics of casting, and puts our current 41 kits and the VFX tool's spells beside all three.

## How far to trust each line

Every claim carries one of four labels.

| Label | Meaning |
|---|---|
| **[cited]** | Stated in one of the research notes with a source link. The link is given, either to the original source or to the note that holds it. |
| **[notes' reading]** | The note author's own analysis. This covers all Dota "Counterplay" lines, all Smite "Counter" lines, and the "mechanic" and "counterplay" columns of our inventory. |
| **[counted here]** | Counted by a script for this report over the notes. The method is given. |
| **[inference]** | My own judgement in this report. |

**Sources.**
- **The six notes** in [moba-research/](moba-research/): [cast-and-targeting-systems.md](moba-research/cast-and-targeting-systems.md) (the casting systems of all three games), [dota2-heroes-a-m.md](moba-research/dota2-heroes-a-m.md) and [dota2-heroes-n-z.md](moba-research/dota2-heroes-n-z.md) (every Dota hero from Valve's official data feed, patch 7.42 of 2026-11-18), [smite-gods.md](moba-research/smite-gods.md) and [smite-gods-numbers.md](moba-research/smite-gods-numbers.md) (every Smite 2 god from the Smite 2 wiki, Open Beta 48 of 16–17 Nov 2026, plus the 38 Smite 1-only gods), and [our-spells-inventory.md](moba-research/our-spells-inventory.md) (every spell of ours, read from the code).
- **Where notes disagree, the newer, primary note wins.** The Dota hero notes (Valve's 7.42 feed) override the older wiki and search-summary lines in the casting note. For example, facets were removed in 7.41, and the two notes list different vector spells.
- **The casting note's Dota rules** (cast point, disjoint, dispel, channel) come from Fandom pages read in a browser. Some lines come only from a search engine's summary, and those are marked.
- **Our counts include the draft hero Kagen:** 41 kits and 167 spells, or 40 and 163 without him.
- **Nothing in this report has been tested in play against a person.**

## Every spell is one input shape, one timing pattern and one hit rule

League's wiki gives the most exact list of input shapes **[cited]** ([Wiki: Targeting](https://wiki.leagueoflegends.com/en-us/Targeting)). A spell needs no input (auto-targeted: self, point-blank, or proximity, which needs an enemy nearby to cast), a unit (a valid unit in range and in sight), a location (a point, mostly a circle), a direction (a fixed-length line or cone from a fixed origin), or a vector (an origin the player picks, plus a direction measured from that origin). Dota's own scheme says the same in other words **[cited]**: No Target (with Toggle under it), Target Point (with Target Area and Vector under it), Target Unit, and mixes such as "Point or Unit" ([Fandom: Abilities](https://dota2.fandom.com/wiki/Abilities)). Smite uses only three of the five. It has no unit click, and the notes found no vector cast: every ability is aimed by facing, or placed as a ground circle in front of the god **[cited]** ([smite-gods.md](moba-research/smite-gods.md), header).

Everything else is a pattern in time laid over one of those shapes, followed by a hit rule. A small engine can describe any spell as one input shape, one timing pattern and one hit rule **[inference, already the casting note's reading]**. Ours nearly does: `targeting.mode` gives the shape, the trait's `hold`, `charges` and `recast` give the timing, and the spell file holds the hit rule ([src/effects/targeting.ts](../../src/effects/targeting.ts), [src/traits/types.ts](../../src/traits/types.ts)).

The table below defines each kind once, with one example from each game and the usual answer. Examples come from the notes; the "usual answer" column is the notes' reading unless marked otherwise.

| Kind | How it is aimed and how it resolves | Examples (League / Dota 2 / Smite) | Usual answer |
|---|---|---|---|
| **Unit-targeted** | Click a unit in range and in sight. In League and Dota it cannot miss once it starts, unless sight is lost (League's delayed casts) or the projectile is dodged by a blink (Dota). | Fiora R, Camille R, Sett R / Mist Coil, Hex, Laguna Blade / none: Smite has no lock-on; Loki's teleport takes the god nearest the centre of a small aimed area | Before the cast: range and sight. After it: a disjoint, a spell block or a reflect (Dota), a spell shield (League), Dota's motion buffer (step more than 250 past range during the wind-up) |
| **Ground point (circle)** | A circle at the cursor, clamped to range. In League, a cast beyond range either snaps to max range, walks into range, or fails, depending on the spell. | Ziggs Q (clamped) / Light Strike Array (0.45 s wind-up + 0.5 s delay) / Agni Rain Fire, Charon's Damnation | Walk out before the delay ends; the drawn circle must equal the hit |
| **Circle with a delay** | A ground circle whose hit lands later. This is the most common way all three games give an area hard CC an answer. | Brand's Pillar of Flame / Torrent 1.6 s, Sun Strike 1.7 s, Blood Rite 2.9 s, Chaos Meteor 1.3 s / Nut's Skyfall 1 s, Ra's Divine Light 2 s | Read the delay; Smite tunes these by changing the delay (Nox's delay went from 0.7 s to 0.4 s in OB48) |
| **Direction (skillshot)** | A line from the caster toward the cursor. It hits the first unit, everything along the line, or the whole line at once. Some lines store the target point at cast. | Ezreal Q, Thresh Q / Sacred Arrow, Shackleshot / Neith's World Weaver; 40 Smite lines stop on the first unit and 48 pierce | Step off the line; stand behind a blocker if the line stops on the first unit |
| **Cone** | A wedge in front of the caster. It is a "direction" input with a whole-area hit. | Nidalee Swipe, Ashe Volley / Dragon Slave, Breathe Fire / Achilles' Shield of Achilles (80°), Medusa's Petrify (40°) | Stand beside or behind the caster |
| **Self / no target** | Fires at once, around or on the caster. Proximity casts need an enemy nearby before they can be used. | Katarina R, Kai'Sa R (proximity) / Berserker's Call, Borrowed Time / Sylvanus ult, Ra's Divine Light | Spacing; wait out a buff |
| **Toggle** | On/off. It usually drains a resource every second. | Amumu W, Karthus E, Anivia R / Pudge's Rot, Leshrac's Pulse Nova / Pele's Magma Rush, Cu Chulainn's Vent Anger | Make the drain cost something: force a long fight, or wait |
| **Channel** | The caster must keep holding it. Interrupting it usually keeps the cost and cooldown spent. | Karthus R, Katarina R / Fiend's Grip, Freezing Field, Black Hole / Ares' No Escape, Anubis' Death Gaze (34 Smite lines are channels) | Hard CC interrupts it; walk out of the area |
| **Charge (hold)** | Press to start, release to fire; longer holds give more range or power. Some lock the direction at the first press. | Xerath Q (range), Sion Q (locked direction) / Hoodwink's Sharpshooter, Primal Beast's Onslaught / Neith's World Weaver (0.5–2 s), Charybdis' Capsize | The charge shows; step out of the final shape |
| **Recast** | A second press within a window, with a new effect. | Ahri R (three dashes; the casting note marks its numbers as from memory), Zed W swap / Alchemist's Concoction throw / Achilles' Combat Dodge then Spear Strike | Bait the first part; punish the window |
| **Vector** | Two points: the press sets the origin, the drag sets the direction from that origin. | Viktor's Hextech Ray, Rumble's Equalizer, Taliyah's Seismic Shove / Kinetic Fence, Swashbuckle, Aether Remnant / no analogue found in the Smite notes | As the shape it makes (a wall, a dash line) |
| **Ammo** | Charges. League splits **stock** (refills over time, can be banked) from **barrage** (granted on cast, lost if unused). | Stock and barrage per the wiki / 22 Dota entries with charges | Count the charges |
| **Passive / autocast** | Always on, or toggled onto basic attacks. | Every League innate / 19 autocast attack modifiers, such as Drow's Frost Arrows / 10 Smite "next attack" buffs | Play around its trigger |
| **Summon / deploy** | A unit or object that acts by itself. | 33 League kits / Death Ward, Tombstone, Power Cogs / 22 Smite deployables | Kill it, or fight away from it |
| **Terrain** | Makes a wall or obstacle. In League, a spell shield cannot block a terrain-making spell. | Crystallize, Pillar of Ice / Fissure, Ice Shards, Kinetic Field / Ymir's Ice Wall, Odin's Ring of Spears | Walk round it; break it; a cage must be broken or waited out |
| **Global** | Reaches the whole map. | 5% of League ultimates / Teleportation, Ice Blast / 8 Smite lines, such as Neith's World Weaver | Long travel time; others can body-block it |
| **Stance / form** | Swaps the kit or the body. | Jayce / Troll's Battle Stance, Brewmaster, Kez / Hel, Merlin, Artio, Ullr | Read the current stance |

Sources for the table **[cited]**: the League rows come from [Wiki: Targeting](https://wiki.leagueoflegends.com/en-us/Targeting), [Wiki: Ability](https://wiki.leagueoflegends.com/en-us/Ability), [Wiki: Channel](https://wiki.leagueoflegends.com/en-us/Channel) and [league-champion-kits.md](league-champion-kits.md) (toggles: Amumu, Anivia, Karthus). The Dota rows come from the 7.42 feed lines in the two Dota notes, and from [Fandom: Channeling](https://dota2.fandom.com/wiki/Channeling). The Smite rows come from the per-god lines in [smite-gods.md](moba-research/smite-gods.md) and [smite-gods-numbers.md](moba-research/smite-gods-numbers.md).
## Dota clicks, Smite aims, League mixes: the counts

The three games count different things, so each column below has its own unit, and the columns cannot be added together.
- **League:** kits that have the part anywhere (n = 173), from [league-champion-kits.md](league-champion-kits.md) **[cited]**. For aim, it gives the share of kits whose Q, W, E or R uses that aim. The League research counted kits, not abilities, and this report does not invent per-ability counts.
- **Dota 2:** ability entries (n = 736: 390 for heroes A to M and 346 for N to Z). Each entry counts once, under its primary activation from Valve's feed **[cited, counted by the Dota notes]**. Vector is 10 entries by that rule and 11 by the raw flag.
- **Smite 2:** active-ability lines, hand-tagged in [smite-gods.md](moba-research/smite-gods.md) (n = 401 lines over 96 gods; stance alternates count separately) **[cited, counted by the note]**. The script-derived forms in [smite-gods-numbers.md](moba-research/smite-gods-numbers.md) are a cross-check. They agree on the order (ground circle 68, piercing line 58, dash 52, circle around the god 50, projectile 42, leap 42, cone 41, channel 35).
- **Ours:** hero spells (n = 167) or kits (n = 41), from [our-spells-inventory.md](moba-research/our-spells-inventory.md) **[cited from our code]**.

### Activation and aim, per game

| Kind | League (kits, n=173) | Dota 2 (entries, n=736) | Smite 2 (lines, n=401) | Ours (spells n=167; kits n=41) |
|---|---|---|---|---|
| No target / self | Self-aim share: Q 17%, W 40%, E 19%, R 29% | 168 No Target | 53 self-centred circles, 36 self buffs | 44 spells (26%) |
| Unit (click) | Q 15%, W 12%, E 23%, R 20% | 162 Unit, +19 Unit-or-Point | 0 (no lock-on) | 27 spells (16%) + 3 `enemies` (2%) |
| Ground point | Q 16%, W 25%, E 24%, R 19% | 143 Point (separately, 112 entries carry an AoE flag) | 73 ground circles | 52 spells (31%) |
| Direction / line | Q 52%, W 23%, E 33%, R 27% | inside Point (a "directional" flag on 8 of the A-to-M entries) | 40 stop-on-first, 48 piercing, 17 plain lines | 41 spells (25%) |
| Cone | inside Direction | not tallied | 46 | 11 (10 no-aim, 1 aimed) |
| Vector | a few: Viktor, Rumble, Taliyah (`DragDirection`) | 10 | none in the notes | 0 |
| Toggle | 10 kits (6%) | 13 | 11 stance/toggle/transform | 0 |
| Channel | 45 kits (26%); R 17% | 25 | 34 | 3 kits (Vesper R, Ada R, Marin R) |
| Charge (hold) | 15 kits (9%) | examples only (Sharpshooter, Onslaught) | 7 | 1 (Lyra Q) |
| Recast | 81 kits (47%) | not tallied (recast buttons are sub-entries) | 38 | 12 slots in 11 kits (27%) |
| Ammo | 29 kits (17%) | 22 with base charges, +10 from Scepter or Shard | no tag (e.g. Agni's 3-charge Rain Fire) | 7 slots in 7 kits (17%) |
| Passive | 1 innate per kit | 176 | 98 passives (numbers note) | 41 passives |
| Autocast / next-attack | attack reset in 45 kits (26%) | 19 autocast attack modifiers | 10 | 3 empowered attacks |
| Summon / deploy | 33 kits (19%) | not tallied | 22 deployables + 5 summons | 5 spells, 7 kits (17%) |
| Makes terrain | 18 kits (10%) | about 16 named (Fissure, Ice Path, Kinetic Field...) | 7 walls + cages | 14 spells, 11 kits (27%) |
| Dash / leap / blink | 112 kits (65%) | not tallied | 48 dashes, 37 leaps, 9 teleports | 22 spells, 22 kits (54%) |
| Global | R global in 5% of kits | examples (Teleportation, Ice Blast) | 8 | 0 (Barry's weather is arena-wide) |
| Stance / form | stance 9%, form 12% | examples (Battle Stance, Brewmaster, Kez) | merged with toggle above | 3 kits (Marin, Pim and Pom, Ada) |

**Cooldown rhythm** **[cited]**. League's median cooldowns run Q 8→6 s, W 14→10, E 13→10 and R 120→80 from first to last rank ([league-champion-kits.md](league-champion-kits.md)). Smite 2's median basic ability cooldown is 14 s and its ultimate 90 s ([smite-gods-numbers.md](moba-research/smite-gods-numbers.md)). Ours are Q 3.5 s, W 9, E 10 and R 24 s (medians from the inventory), and every round starts with everything ready. **[inference]** Our rounds are short and have no ranks, so a cooldown about half of League's late-game value is consistent. But our R comes back within one round, where League's and Smite's come back once per fight.

**What the counts say [inference].**
- **Dota is the click game.** About a quarter of its entries are unit-targeted. Most of its counterplay (spell block, reflect, disjoint, motion buffer) exists because so much is a sure hit.
- **Smite is the aim game.** No unit clicks at all, with ground circles and self-centred circles as its two largest groups.
- **League is the line game.** Direction is the top aim on Q in 52% of kits.
- **Ours spreads almost evenly over point, self, line and click.** That makes us the most mixed of the four.
- **Smite channels the most** (34 of 401 lines, about 8%), League often (26% of kits), Dota on about 3% of entries, and we on 3 kits.
- **Toggles, vectors and charge-ups are rare everywhere** (Dota: 13, 10 and a handful of 736). The Dota notes call that rarity part of why heroes such as Leshrac, Muerta and Earth Spirit feel distinct **[notes' reading]**. Our zero in all three is a gap, but a small one.

### How the player aims, and the input rules worth copying

All three PC games settled on the same three cast modes **[cited]**: normal (press, then click to confirm), quick (fire at the cursor on the press), and quick with an indicator (hold to preview, release to fire, back out before the release) ([Wiki: Quick cast](https://wiki.leagueoflegends.com/en-us/Quick_cast); [Item Level Gaming: Smite 2 settings](https://itemlevel.net/smite-2-best-settings-guide/); Dota per [Liquipedia: Settings](https://liquipedia.net/dota2/Settings), from a search summary). We already offer all three, and new players start on the indicator mode ([src/heroMode.ts](../../src/heroMode.ts), [docs/architecture/hero-mode.md](../architecture/hero-mode.md)) **[cited from our code]**. The details around those modes differ, and several are worth copying.

| Rule | Game | What it does | Do we have it? |
|---|---|---|---|
| **Targeting forgiveness** | League | A unit spell cast on an invalid target snaps to the nearest valid unit within 175 units ([Wiki: Targeting](https://wiki.leagueoflegends.com/en-us/Targeting)) **[cited]** | Partly: an `enemy` spell takes an enemy within 2.2 m of the cursor (3.2 m on touch) |
| **Self-cast fallback** | League, Dota | No valid unit under the cursor casts on yourself; Dota uses a double-tap or Alt **[cited]** | Not needed in a 1v1: no ally spells exist |
| **Separate click and hit sizes** | League | Gameplay radius 65 (55 to 80); selection radius 100 to 150 ([Wiki: Unit radius](https://wiki.leagueoflegends.com/en-us/Unit_radius)) **[cited]** | Yes in effect (the 2.2 m snap) |
| **Clamp or walk** | League, Dota | A cast past range either snaps to max range, walks into range, or fails. This is set per spell **[cited]** | Yes: ground casts clamp, click casts walk in (`pending`), and lines fire at once |
| **Stored target point** | League | Some spells remember the cast point, so a Flash during the cast bends them back ([Wiki: Targeting](https://wiki.leagueoflegends.com/en-us/Targeting)) **[cited]** | Not written down per spell |
| **Facing and turn rate** | Dota | The hero must face within 11.5° before acting; a 180° turn takes 0.15–0.19 s **[cited, search summary]** | No: facing follows walking, and there is no turn command (the Nyx problem in [league-kit-design.md](league-kit-design.md)) |
| **Motion buffer** | Dota | A unit-target spell still fires if the target walks up to 250 past range during the wind-up ([Fandom: Cast range](https://dota2.fandom.com/wiki/Cast_range)) **[cited]** | No; our click spells re-check sight or a fixed reach at impact instead |
| **Vector by drag** | League, Dota | Press for the origin, drag, release for the direction. Dota offers key-up and key-down variants ([Fandom: Cast Animation](https://dota2.fandom.com/wiki/Cast_Animation)) **[cited]** | No: one point per cast (`CastContext` in [src/effects/targeting.ts](../../src/effects/targeting.ts)) |
| **Per-god or per-key cast mode** | Smite, League | Normal, Quick or Instant for each god (Smite), or each key (League) **[cited]** | One mode for all keys |
| **Touch auto-aim priority** | Phone MOBAs | Tap auto-aims by a priority rule. Mobile Legends' "smart targeting" can steal the lock and aim at a minion, a known complaint ([BitTopup](https://bittopup.com/article/Mobile-Legends-Controls-Guide-2025-Pro-Settings-Setup)) **[cited, community guide]** | A tap casts at the nearest enemy (`aimAuto`). Whether that can pick a summon (Bo's sheep, Mortis's skeletons, Ada's turret) instead of the hero is **to check** |

**[inference]** Release-to-fire is the shared gesture of mouse and touch, and our indicator mode and drag buttons already use it. The same press, drag and release would carry a vector on a phone with no new gesture. The casting note reached the same conclusion.

### Crowd control, per game

League's CC is a table of kinds with rules, not a count. Its kits show hard CC in 75% and soft CC in 80% **[cited]** ([league-champion-kits.md](league-champion-kits.md)). The Smite column counts the "enemy CC" field the numbers note gives on each ability line **[counted here: n = 509 lines over 96 gods, passives and stance alternates included]**. The Dota column is harder. The feed has no CC field, so a keyword search over the "What it does" text of all 736 entries gives only rough counts for the big kinds **[counted here, approximate: a word like "stunned" also matches "usable while stunned"]**. The small kinds were read line by line and are given as names.

| CC kind | League (in the CC table?) | Dota 2 (n=736) | Smite 2 (n=509) | Ours (n=167) |
|---|---|---|---|---|
| Stun | yes; tenacity shortens it | about 80 | 63 (plus 6 mesmerize) | 9 |
| Root | yes | about 24 | 25 | 10 |
| Slow | yes | about 170 | 94 | 18 (always 40%) |
| Silence | yes | about 23 | 11 | 6 |
| Knock-up / airborne | yes; tenacity does not shorten it | a few (Tornado and Telekinesis lift) | 21 | 5 |
| Knockback / push | yes (airborne) | about 22 | 19 | 13 |
| Pull / grab / drag | kinematics; 16% of kits pull | about 26 | 16 pull, 6 grab, 7 vortex, 5 tremble | 10 (+2 carry) |
| Blind | yes | Laser, Whirling Axes | 5 | 6 (attacks miss, aimed casts scatter 2.5 m) |
| Disarm | yes | about 13 (Deafening Blast, Leech Seed, Concussive Grenade...) | 3 | 0 |
| Taunt | forced action | Berserker's Call, Life Break | 2 | 0 (Cantor's charm is the nearest) |
| Fear / flee | forced action | Terrorize, Savage Roar, Requiem of Souls, Terror Wave, Dead Shot | 4 | 0 |
| Charm | forced action | none found | 1 | 1 (Siren Song) |
| Sleep | yes | Nightmare, Echo Stomp, Song of the Siren | (mesmerize counted above) | 0 (`sleep` built in the engine, unused) |
| Polymorph / hex | yes | Lion's and Shadow Shaman's Hex | 1 | 0 (Bo's passive turns you into a sheep for 1 s) |
| Suppression | yes; blocks all summoner spells | Fiend's Grip (a channel) | none | 0 |
| Stasis / banish / cage | stasis (untargetable and invulnerable) | Astral Imprisonment, Disruption, Decrepify | banish (no count) | 1 sealed + 3 cages |
| No dashes | ground; Dota's leash | Flaming Lasso, Dream Coil, Pounce | 12 cripple | 1 (Referee's rule) + Sefu's half-length dashes |
| Odd kinds | drowsy, nearsight | break (passives off), mute (items off) | intoxicate (scrambled controls), madness | slide (Gus) |

Sources **[cited]**: [Wiki: Crowd control](https://wiki.leagueoflegends.com/en-us/Crowd_control), [Fandom: Disable](https://dota2.fandom.com/wiki/Disable), the per-hero feed lines in the Dota notes, the per-god lines in [smite-gods-numbers.md](moba-research/smite-gods-numbers.md), and [src/effects/status.ts](../../src/effects/status.ts) via the inventory.

**[inference]** The shape is the same in all four columns: slows dominate, then stuns, then roots and displacement. Forced-action CC (taunt, fear, charm) is rare in Dota and Smite too, so our near-absence is less of a gap than the League table suggests. The real difference is duration and stacking. We cap every lock, and Smite shortens repeats. League relies on tenacity and kit design, and Dota on dispels and status resistance.

## Resolution decides the answer: wind-ups, stop rules, disjoints and immunity

How a cast resolves decides where its answer lives. The three games built three different models.

**League: the cast always comes out, and the answer comes after it [cited].** A cast time is usually 0.25 s (range 0.1 to 1.25 s). It locks out moving, attacking and casting, and nothing but death interrupts it. Cooldown and cost apply after it, except for a few spells, such as Yasuo's Steel Tempest, that start their cooldown at the start of the cast ([Wiki: Cast time](https://wiki.leagueoflegends.com/en-us/Cast_time), a page the wiki marks as outdated). Counterplay then lives in the missile or the area: dodge the line, leave the circle, or eat it with a spell shield. Only three things stop a dash already under way: airborne, knockdown and stasis ([Wiki: Crowd control](https://wiki.leagueoflegends.com/en-us/Crowd_control)).

**Dota: the wind-up can be stopped for free, and the answer comes before it [cited].** If a stun or the caster's own Stop lands before the cast point, the spell is cancelled with no mana spent and no cooldown started. The animation starts at once, so it is the tell ([Fandom: Cast Animation](https://dota2.fandom.com/wiki/Cast_Animation)). Of the activated A-to-M entries, 98 have no cast point at all, and the rest have a median of 0.30 s; 19 run 0.5 s or longer ([dota2-heroes-a-m.md](moba-research/dota2-heroes-a-m.md)). The longest are the most telegraphed: Teleportation 3 s, Epicenter 2 s, Assassinate 2 s, Requiem of Souls 1.67 s ([dota2-heroes-n-z.md](moba-research/dota2-heroes-n-z.md)). Channels are the opposite: an interrupted channel keeps its cost and cooldown spent, though Powershot and Illuminate still fire, weaker ([Fandom: Channeling](https://dota2.fandom.com/wiki/Channeling)).

**Smite 2: moving toward League [cited, search summary].** In Smite 1, CC that landed during an animation cancelled the ability. Smite 2 added "CC buffering": an ability whose animation has just begun still goes off. Players raised concerns about it ([ZLeague, via search summary](https://www.zleague.gg/theportal/smite-2-update-exploring-cc-buffering-and-player-reactions/)). Hard CC still interrupts channels, and repeated hard CC is shortened: each stack cuts 10%, up to 4 stacks (40%); a hard CC adds 2 stacks and a displacement 4; the stacks expire together after 6 s ([Smite 2 Wiki: Crowd Control](https://wiki.smite2.com/w/Crowd_Control)).

**Ours: a long commit, then a judgement on live positions [cited from our code].** A cast roots our hero until its danger zone's last impact: at most 2.5 s, or 0.4 s for a spell with no zone ([hero-mode.md](../architecture/hero-mode.md)). A drawn shape hits only a victim standing inside it at the impact ("DODGED" otherwise). A skillshot that touched the body has already passed its dodge test. The engine can also block a zone with a ward ("WARDED"), but no hero places one yet ([src/duel.ts](../../src/duel.ts); `ward` is among the unused pieces in [src/mech/index.ts](../../src/mech/index.ts)). Stun, silence and knock-up break our three channels ([src/effects/channel.ts](../../src/effects/channel.ts)). Nothing interrupts an ordinary wind-up. **[inference]** So we run League's "the cast always comes out" with a commit of 0.4 s to 2.5 s. League's cast times are mostly 0.25 s (at most 1.25 s), and Dota's cast points have a median of 0.30 s, with a listed few from 1 s to 3 s. Our longer casts commit several times longer than their typical one. That long commit is our skill test, and it is also the biggest single difference in feel.

### What a shot stops on is the counterplay

Smite's wiki writes one of a few standard sentences on each shot. Counted over the base kits **[cited]** ([smite-gods-numbers.md](moba-research/smite-gods-numbers.md)):

| What the ability stops on | Smite 2 abilities | What it means in our 1v1 [inference] |
|---|---|---|
| Passes all enemies and walls (cannot be blocked) | 46 | Only stepping aside or out-ranging it works |
| Passes minions, stops on the first god; walls block it | 19 | A plain skillshot that cover stops |
| Stops on the first unit; walls block it | 15 | The same, plus summons and pillars can eat it |
| Passes all enemies; walls stop it | 12 | A piercing line that cover stops |
| Passes minions and walls; stops on the first god | 8 | A line that ignores cover |
| Hits everything in its area; walls stop it | 4 | An area that cover shields |

League's wiki gives the same split in three hit rules (pass-through, first unit, whole area) and stores it per spell ([Wiki: Targeting](https://wiki.leagueoflegends.com/en-us/Targeting)) **[cited]**. **[inference]** We decide all of this per spell file, but nowhere is it written as a field the player, the tooltip or the CPU can read. Our aim strip is already cut flat where cover stops it ([hero-mode.md](../architecture/hero-mode.md)), so half of Smite's lesson is already on screen.

### Answer tools, per game

| Answer | League | Dota 2 | Smite 2 | Ours |
|---|---|---|---|---|
| **Dodge by moving** | Skillshots; delayed circles | Point spells and delays; projectiles can be outrun | Everything: no lock-on; strafe and backpedal penalties keep it fair | Every area spell is judged on live position; 38 fuses on the floor |
| **Cover / body-block** | Some spells interact with terrain | Trees, cliffs (Shackleshot, Spear of Mars use them) | Stop rules; walls; minions | Cover cuts skillshots; 11 kits build cover; a zone-blocking `ward` is built, but nothing places one |
| **Lose sight** | Delayed unit casts cancel without sight | Invisibility makes projectiles miss | Stealth breaks on hard CC | **Our main disjoint:** 10 spells check sight at the impact |
| **Blink out of a homing shot** | (rare) | Every blink disjoints; a listed set of spells cannot be disjointed | (no homing) | Untargetable windows swallow hits (6 kits) |
| **Interrupt the wind-up** | No | Yes, for free; full refund | Smite 1 yes; Smite 2 buffers it | No |
| **Interrupt a channel** | Airborne, forced action, silence, sleep, stun, stasis, suppression | Any disable that blocks casting; silence for spells, mute for items | Hard CC | Stun, silence, knock-up (3 channels) |
| **One-spell shield / block** | Spell shield (Sivir, Banshee's Veil...) | Linken's Sphere, once per 14 s | Aegis (damage immunity); Nemesis' reflect | None (Kagen's parry is a draft) |
| **Reflect** | (rare) | Lotus Orb, Counterspell | Nemesis' Retribution, Kuzenbo's Shell Spikes | Final Delivery goes back on cover; Null Zone deletes bolts |
| **Cleanse** | Cleanse, Quicksilver Sash | Basic and strong dispels | Purification Beads (every player) | None (`cleanse` built, unused) |
| **CC immunity** | Some ultimates | Debuff immunity (BKB); 127 entries pierce it | "CC immune while active" on 39 ability lines; Beads | Brannoc at white heat (slow and root only) |
| **Less CC over time** | Tenacity | Status resistance | Diminishing returns (stacks) | Lock cap 1.5 s in total, then 0.5 s immunity |
| **Shared escape button** | Flash (summoner spell) | Blink Dagger, Force Staff (items) | Blink (relic or item) | None |
| **Position rules** | Some kits | Many: Rupture, Cold Feet, Stone Gaze, Backstab | Facing checks (Medusa, Ra) | Referee's rules, Oblivion's stand-still pull, Nyx's backstab |
| **Punish an action** | Some kits | Nether Ward, Last Word, Spiked Carapace | (few) | Vesper's curse taxes casts; Referee's cards |

Sources **[cited]**: [Wiki: Spell shield](https://wiki.leagueoflegends.com/en-us/Spell_shield), [Wiki: Channel](https://wiki.leagueoflegends.com/en-us/Channel), [Fandom: Disjoint](https://dota2.fandom.com/wiki/Disjoint), [Fandom: Dispel](https://dota2.fandom.com/wiki/Dispel), [Liquipedia: Linken's Sphere](https://liquipedia.net/dota2/Linken's_Sphere) (search summary), [ONE Esports: BKB 7.33](https://www.oneesports.gg/dota2/black-king-bar-debuff-immunity-7-33/), [Digital Trends: Smite 2 relics](https://www.digitaltrends.com/gaming/smite-2-relics-when-to-pick/), [Smite 2 Wiki: Purification Beads](https://wiki.smite2.com/w/Purification_Beads), the Dota and Smite per-ability lines, and the inventory for ours. The "127 pierce" is 70 (A to M) plus 57 (N to Z) from the Dota notes. The "39 CC immune" line count is **[counted here]** from the numbers note. The League Cleanse and Quicksilver Sash names come from the CC table's "Cleanse / QSS" column.

**The rules worth copying exactly, if we build these tools [cited]:**
- **League's spell shield.** All hits within 0.1 s of one cast count as one ability. A delayed area of the same spell is still blocked. Terrain-making spells and persistent areas are not. The caster's own dash and refunds still happen ([Wiki: Spell shield](https://wiki.leagueoflegends.com/en-us/Spell_shield)).
- **Dota's 7.33 immunity.** An immune unit can still be targeted. Blocked debuffs simply do not apply, and a debuff that outlasts the immunity applies for its remaining time. Piercing is marked per spell in the tooltip.
- **Dota's dispel tiers.** A basic dispel removes slows and silences but not stuns. A strong dispel removes everything that death does not ([Fandom: Dispel](https://dota2.fandom.com/wiki/Dispel)).

**[inference]** In a game with no items, the answer has to live in the spell itself: a telegraph, a dodgeable path, a break condition or a short duration. The Dota notes reached the same conclusion ([dota2-heroes-a-m.md](moba-research/dota2-heroes-a-m.md), counterplay inferences). That is what our design already does. The missing piece is a deliberate, readable "answer button" on some heroes.

### Telegraphs: what the enemy is shown

Riot is the only one of the three studios with public readability rules **[cited]** ([Riot: Clarity in League](https://www.leagueoflegends.com/en-us/news/dev/clarity-in-league/); the VFX guide via [GDAD wiki summary](https://gdad.wiki/wiki/sources/source-lol-vfx-style-guide)):
- the hitbox matches the visual;
- visual weight grows with damage, CC strength, how dodgeable the spell is, and how much it changes play;
- every effect has anticipation, a main part and dissipation, with short lingering;
- projectiles show their direction even when still;
- an area shows its true radius at ground level.

Riot's warning example is Arcane Comet: its big ground circle promises more chance to dodge than it gives. Dota hides some warnings from the victim on purpose: Torrent's bubbles, Call Down's indicator and Assassinate's crosshair are visible to allies only, and Alchemist's brew timer is visible to everyone ([dota2-heroes-a-m.md](moba-research/dota2-heroes-a-m.md), [dota2-heroes-n-z.md](moba-research/dota2-heroes-n-z.md)). Smite marks CC immunity with a golden glow ([Smite Academy, 2014](https://smiteacademy.wordpress.com/2014/10/17/guide-crowd-control-in-smite/)). Our rule 6 ("the drawn shape is exactly what hits") and rule 7 ("every stack, mark, timer and stance shows for both players") already state Riot's two strongest rules ([new-hero.md](../pipeline/new-hero.md)). **[inference]** A hidden-from-the-victim warning, as in Dota, breaks our rule 7 and should not be copied.

## Each game owns a shelf of rare mechanics

The rare mechanics share one trait: they add a decision on top of "aim and press". Which orbs to combine, which weapon to hold, when to release, which way to bounce, where to come back to **[notes' reading]** ([dota2-heroes-a-m.md](moba-research/dota2-heroes-a-m.md)). The tables below take the rare and unique mechanics of each game from the notes. For each, they judge whether it fits our duel under our four rules (a written answer, a circle warns for at least 0.25 + radius/4 s, the same result on both screens and no chance, and a CPU that can play it) **[inference]**. Every mechanic is **[cited]** in the note named in the table's lead-in.

### League: rarities in the casting system

League's kit-level rarities (Viego's possession, Sylas's stolen ultimate, Aphelios's weapons and so on) are already in [league-champion-kits.md](league-champion-kits.md) and [kit-anatomy.md](league-research/kit-anatomy.md). The system-level ones come from the [casting note](moba-research/cast-and-targeting-systems.md).

| Mechanic | Example | Fits our 1v1? |
|---|---|---|
| Can only be cast on a wall | Bard's Magical Journey (`TerrainLocation`); Qiyana's Terrashape (terrain check) | **Yes:** our arenas have cover, and Silvane and Opaline already use walls |
| The stored point bends the spell back after a Flash | Engine "store target point at cast" | **Yes:** a per-spell flag; it decides what our dashes do mid-cast |
| Proximity cast (needs an enemy near) | Katarina's Death Lotus, Kai'Sa's Icathian Rain | **Yes:** stops wasted self-novas; the CPU must know the rule |
| Barrage ammo (granted on cast, lost if unused) | the wiki's "barrage" type | **Yes:** a new rhythm against our 7 stock-ammo slots |
| Uninterruptible channel | Irelia's Defiant Dance, Pantheon's Aegis Assault | **Partly:** fine if it is short and drawn |
| A channel that ends the moment you act | Katarina's Death Lotus, Jhin's Curtain Call | **Yes:** a clear commit with a self-cancel |
| Polymorph is the only CC that stops an attack wind-up | the CC table | **No need** |
| Only airborne, knockdown or stasis stop a dash | the CC table | **Decide ours:** which of our CC stops a dash in flight is not written down |
| Cooldown starts when the cast starts | Yasuo's Steel Tempest, Thresh's Death Sentence | **Yes, small** |
| WASD movement with spells moved to the mouse | patches 25.24 to 26.03 | **Note only:** our phone joystick is the same idea |

### Dota 2: the most unusual mechanics

Taken from the notes' lists of 30 (A to M) and 28 (N to Z). Patch 7.42, from Valve's feed.

| Mechanic | Example | Fits our 1v1? |
|---|---|---|
| Combine three orbs into one of 10 spells | Invoker | **No:** study burden; breaks "one idea" |
| Whole bar swaps between two weapons | Kez's Switch Discipline | **Partly:** Pim and Pom already swap kits |
| Songs work only on a 1 s beat | Largo's Amphibian Rhapsody | **Already ours:** Cantor (a 1.2 s beat) |
| Rewind position and health | Weaver's Time Lapse (5 s), Faceless Void's Time Walk (undoes 2 s of damage) | **Yes:** our tool spell Unwind does it; needs a visible ghost of the old spot |
| Send an enemy back to where it was | Disruptor's Glimpse (4 s), Kunkka's X Marks the Spot | **Yes:** a readable time trick if the return path is drawn |
| Freeze everything in an area, allies too | Chronosphere | **Partly:** our cages (Duet, The Box, Grand Lobby) are the duel version |
| Damage per distance moved, or stun if you stay still | Rupture, Cold Feet | **Yes:** a position rule that needs no reaction |
| Petrify those who face you | Medusa's Stone Gaze; Ringmaster's Wheel of Wonder | **Only with a facing control:** we have none |
| Front or back damage armour | Bristleback, Mars | **Only with a facing control** |
| Sleep that jumps to the attacker | Bane's Nightmare | **Yes:** the engine's `sleep` is built and unused |
| Copy a spell onto a linked second target | Grimstroke's Soulbind | **No:** needs two enemies |
| Steal the enemy's last spell | Rubick's Spell Steal | **Risky:** the engine's `noteCast` exists, but the earlier checklist (Q33) warns it is engine debt across the roster |
| Ammo that is a placed object | Earth Spirit's Stone Remnants, Ember Spirit's remnants | **Yes:** close to Mortis's bones and Anka's embers |
| Hold-to-charge with a forced release | Hoodwink's Sharpshooter (max at 3 s, fires itself at 5 s); Alchemist's Concoction (blows up on him at 5.5 s, public timer) | **Yes:** a charge with a visible timer and a self-punish |
| Pay health instead of mana | Huskar; Abaddon's Mist Coil | **Already ours:** Vesper |
| A forced 1v1 with no items | Legion Commander's Duel | **Already the format** |
| A vector trick shot | Muerta's Dead Shot (ricochet direction), Marci's Rebound | **Yes:** fits our bank shots |
| Swap places or swap health | Nether Swap; Sunder (health %, with a 25–35% floor) | **Partly:** the engine's `swap` is unused; a health swap is a big lever |
| Hold damage, release it later | Oracle's False Promise | **Already ours, inverted:** Mr. Ledger's tab |
| Die into a sun; reborn if it survives 6 s | Phoenix's Supernova | **Already ours:** Anka's ashes |
| Punish a cast near a ward | Pugna's Nether Ward; Silencer's Last Word | **Yes:** Referee and Vesper already do this |
| A dodge that pays you | Puck's Puckish (health and mana for each dodged spell) | **Yes:** a dodge reward fits a dodge game |
| Random effects | Chaos Bolt, Ogre Magi's Multicast | **No:** rule 7, no chance |
| A mine you only see up close | Techies' Proximity Mines | **Partly:** our traps arm in view; a hidden trap breaks rule 7 |

### Smite: the most unusual mechanics

Taken from the note's list of 32 ([smite-gods.md](moba-research/smite-gods.md)).

| Mechanic | Example | Fits our 1v1? |
|---|---|---|
| No lock-on at all; melee basics are aimed cones | Every god | **Partly:** 72% of our hero spells already take a point, a line or a click, and every area is dodgeable |
| A push stuns only against a wall | Anhur's Impale, Gilgamesh's Drop Kick | **Already ours:** Bram's Shove, Lyra's pin |
| Player-made walls that block everyone | Ymir's Ice Wall (also vaults Ymir), Thor's fissure | **Already ours:** 11 kits |
| Cages that must be broken or waited out | Odin's Ring of Spears, Yemoja's River's Rebuke | **Already ours:** The Box, Grand Lobby, Duet |
| A private duel dimension | Aladdin's Into the Lamp (16 s, escape at 8 s) | **No need:** the arena already is one |
| Walk inside walls; portals through walls | Cliodhna, Janus | **Partly:** Wick's doors; walking inside walls breaks cover rules |
| Aim distance picks the ability's form | Sun Wukong's 72 Transformations (near, mid, far) | **Yes:** a second decision inside one press |
| Facing checks | Medusa's Petrify (stun only if facing her), Ra's Divine Light | **Only with a facing control** |
| An untargetable flight, then choose where to land | Thor's Anvil of Dawn, Apollo's chariot | **Partly:** Zephyr and Mabel already have untargetable moves |
| Become another god | The Morrigan's Changeling | **No:** checklist Q33 |
| Rewind with cooldowns reset | Chronos (8 s) | **Yes, as with Weaver** |
| Steer the projectile or area after the cast | Danzaburou's rocket, Sol's Supernova | **Yes:** our Void Black Hole and Barry's storm already move |
| Retrieve the projectile for a lower cooldown | Tsukuyomi's shuriken, Ne Zha's ring, Thor's hammer | **Already ours:** Silvane's pickup reset |
| Bounce off walls for more damage | Hou Yi's Ricochet (+40% per bounce) | **Already ours:** Opaline, Silvane |
| Detonate your own zone with another spell | Agni's fumes | **Already ours:** Shiori's ink, Anka's embers |
| A sweet-spot circle (CC only in the centre) | Erlang Shen's Pin, Nut's Comet, Poseidon's Kraken (inner 2.4 m stun) | **Yes:** a partial answer: step to the edge |
| No cooldown, a fuel limit instead | Pele's Magma Rush, Rama's Astral Strike | **Already ours:** Brannoc's Heat, Vesper's blood |
| Intoxicate (scrambled controls) | Bacchus | **No:** feels like a bug on a browser |
| Random kits | Baba Yaga, Chronos' wheel | **No:** rule 7 |
| The interact key as an ability input | Mordred's dash within 2 s of an ability | **Yes on PC; a sixth button on phones costs space** |

**[inference]** About half of Smite's oddities and a third of Dota's are already in our roster, usually in a duel-sized form: walls, cages, bounces, pickups, fuel kits and punish-a-cast rules. What we lack from these shelves is the **time** family (rewind, send back) and the **second decision inside one press** family (aim distance picks the form, release timing, vector direction). Both families fit a duel well and are deterministic.

## Our spells: dodgeable, terrain-rich, one point per cast

### Our 167 hero spells beside the big three

Our side comes from the inventory **[cited from our code]**, League's from [league-champion-kits.md](league-champion-kits.md), and Dota's and Smite's from their notes. The verdict column is **[inference]**.

| Aspect | League / Dota 2 / Smite 2 | Ours | Verdict |
|---|---|---|---|
| Input mix | League leans to lines (Q 52%), Dota to clicks (about a quarter), Smite to aim (no clicks) | Point 31%, self 26%, line 25%, click 16% | The most even mix of the four: good for variety |
| Sure hits | Dota is built on them; League targets on about 17% of slots | Of 27 click spells: 8 true sure hits, 7 only mark a spot you can walk out of, and the rest re-check sight or reach at the impact | Deliberately dodgeable; sight is our disjoint |
| Delays you can read | League: "delay" in 49% of kits. Dota: many, 0.5 to 2.9 s. Smite: 20 tagged | 38 spells (23%) put a fuse on the floor; every area is judged on live position | A strength; the delay rule (0.25 + r/4) is stricter than any of the three publish |
| Commit per cast | League cast time mostly 0.25 s (0.1 to 1.25 s); Dota cast point median 0.30 s (a few 1 to 3 s); Smite 2 buffers CC | Rooted until the last impact: 0.4 s to 2.5 s | Our biggest difference in feel; never tested against a person |
| Terrain | 10% of League kits; about 16 Dota abilities; 7 Smite walls plus cages | 11 kits (27%), 14 spells | Our signature |
| Channel / charge / toggle / vector | 26% / 9% / 6% / a few in League; 25 / few / 13 / 10 in Dota; 34 / 7 / about 11 / 0 in Smite | 3 kits / 1 / 0 / 0 | Thin, especially channels |
| Recast | 47% of League kits; 38 Smite lines | 11 kits (27%) | Below League, but on every slot now |
| Answer buttons | League: summoner spells, spell shields, Cleanse, QSS. Dota: items (Linken's, BKB, dispels). Smite: Beads, Aegis, Blink | None. The answers live inside the spells (step out, break sight, break the object) | The largest structural gap |
| Stacking CC | League: tenacity. Dota: status resistance. Smite: diminishing returns, 10% per stack | Every kind capped per hit; hard locks in a row capped at 1.5 s, then 0.5 s immunity | Ahead of all three for a duel |
| Shields and heals | 35% and 49% of League kits | 12% and 10% of kits | Low on purpose ([league-kit-design.md](league-kit-design.md), principle 10) |
| Ranks and levels | All three: ranks, ultimate at a later level | None; every round starts with full kits and empty cooldowns | By design |
| Readability rules | Riot publishes them; Valve and Hi-Rez were not found | Rules 6 and 7 of [new-hero.md](../pipeline/new-hero.md) | On a par with Riot on paper; untested on people |

**What is rare elsewhere and common in our kits** **[cited in the inventory, which calls these rare or absent in the big three]**:
- damage deferred onto a tab the victim pays down by hitting back (Mr. Ledger);
- a beat window for every cast (Cantor);
- automatic repeat-casts (Tempo);
- a damage cap per hit with HP in chunks (Sir Whiskers);
- rules that punish with cards (Referee);
- weather that hits both players (Barry);
- a ring-out (Big Yoko);
- invisible walls and an invisible ball (Mum);
- a companion pillar that is cover, weapon and dash target (Bram);
- trees that grow in stages and can be felled (Hank);
- portals for bodies and bolts (Wick);
- pickups both players fight over (Madame Cleaver);
- an objective inside a duel (Pip).

Some have close relatives in Dota: Largo's beat-timed songs (Cantor), Kunkka's Admiral's Rum and Oracle's False Promise, which delay damage (Mr. Ledger). Most have no counterpart in the notes.

### The VFX tool: 167 aimable spells, mostly looks

The tool page offers 167 aimable spells **[cited from our code]** ([inventory §2](moba-research/our-spells-inventory.md)):
- 56 VFX showcases and 15 cinematic "hero tier" cutscenes;
- 59 spells from heroes' earlier kits;
- the gallery of 20;
- Kagen's four;
- 13 mechanics tests.

By input they are 90 point, 29 unit, 25 `enemies` and 23 self. 109 of the 167 carry no CC, and their "lift" is a visual offset, not a knock-up. The tool page has **no aim strip**: a click picks the enemy or the spot. 37 more effects (the iconic 20, paladin 13 and original 4) have no targeting at all and only play as staged scenes.

**[inference]** The tool and the game have drifted apart. The game aims with a strip, a circle, a bank line and an arc. The tool aims with a click, so a showcase built there is never seen with the game's telegraph, and never checked against the game's rules. The tool's strength is a shelf of mechanics the engine can already do but no released kit uses. Those are the cheapest new mechanics we can give a hero.

| Mechanic on the shelf (tool spell) | Reference in the big three | Candidate hero [inference] |
|---|---|---|
| Hold-to-charge line, ×0.6 to ×1.5 (Thunderlance) | Xerath's Arcanopulse, Neith's World Weaver, Hoodwink's Sharpshooter | Kaia (the storm kit it came from) |
| Recast to teleport to your own bolt (Shadow Swap, Ball Lightning) | Puck's Illusory Orb + Ethereal Jaunt; Zed's W swap | Nyx, Kaia |
| Rewind to where you were 2.5 s ago, with that HP (Unwind) | Weaver's Time Lapse, Chronos' ultimate | Tempo (it is his old kit) |
| Timed parry answered by a stun (Radiant Parry) | Kez's Shodo Sai parry | Auriel, or Kagen's Noto |
| Self stasis in ice (Glacial Mantle) | League's stasis state | Isolde |
| Decoy dash (Ink Double) | Naga's Mirror Image, Phantom Lancer's Doppelganger | Shiori |
| Curving arc the player bends (Final Calligraphy, `aim: 'arc'`) | Puck's Illusory Orb (curved along a path) | Shiori; no released card uses `arc` |
| Boomerang that hits out and back (Second Hand, Crescent Return) | Thor's returning hammer, Ne Zha's ring | Tempo, Silvane |
| Beam held over a fan (Spectrum Lance, Charcoal Tempest) | Anubis' Death Gaze (a channelled line) | Opaline (its old kit) |
| Crossfire from several origins (Mag Rail) | none in the notes | Ada (her turrets) |
| Split on the first hit (Prism Bolt, Brushstroke) | none in the notes | Opaline |
| Chain between enemies (Glacial Ricochet, Art Deco Arc) | Lich's Chain Frost | Raid only: one enemy in a duel, unless it chains to summons |

The engine also holds idle pieces built for a planned set of twenty heroes, with no user **[cited]** ([src/mech/index.ts](../../src/mech/index.ts), [pipeline/designs/heroes20-engine.md](../../pipeline/designs/heroes20-engine.md)). `sleep` matches Bane's Nightmare and Echo Stomp. `ward` (a line no spell crosses) matches Smite's "walls block it" and Yemoja's projectile-blocking cage. `leash` matches Flaming Lasso, Pounce and Dream Coil. `holdDash`/`fizzleDash` match Smite's cripple. `swap` matches Nether Swap. `cleanse` matches Purification Beads. `noteCast` matches Rubick's Spell Steal.

## Fifteen changes for the game and five for the tool, ranked

The ranking weighs what a duel gains against the cost and the risk under our four rules ([new-hero.md](../pipeline/new-hero.md), rules 4, 7 and 8):
1. every spell has a written answer, checked with numbers (a hero walks 4 m/s, a person reacts in 0.25 s);
2. a circle warns for at least `0.25 + radius / 4` s;
3. the same result on both screens, and nothing both screens must agree on uses chance;
4. the CPU can play the hero and against it (`aiHold`, `aiGoal`, `enemyGoal`).

**Every proposal is [inference]: an idea to test, not a finding.** The reference abilities are **[cited]** in the notes named earlier. After any change to a hero, the balance check is `python pipeline/sim/sim.py hero <Name>`, and the Rust model must be refreshed (CLAUDE.md). The shared engine files (`src/heroMode.ts`, `src/duel.ts`) take one writer at a time.

| # | Change | Main heroes and files | Gain | Cost / risk |
|---:|---|---|---|---|
| 1 | Write each spell's resolution sheet, and show it | every card; `src/heroes.ts`, `src/heroes/framework/card.ts` | High | Low |
| 2 | Check every answer with arithmetic; settle the circle rule's reading | Big Yoko, Brannoc, Cantor, Kagen, Nyx and all fuses | High | Low |
| 3 | Give each sure hit a post-cast answer, or say why not | Vitriol, Ada, Brannoc, Kaia, Isolde, Fenna, Sefu | High | Medium (rebalance) |
| 4 | Long wind-ups can be interrupted, with a refund; write which CC stops a dash | ultimates with a stand (Sky Rend...); `src/duel.ts`, `src/effects/channel.ts` | High | Medium |
| 5 | Vector aim: one press, drag, release | Bram, Hank, Mum, Ironknit, Silvane, Marin; `src/effects/targeting.ts`, `src/heroMode.ts`, `src/touch.ts` | High | Medium-high |
| 6 | More charge-ups and channels | Big Yoko, Kaia, Sirix, Bo | Medium | Medium |
| 7 | A one-spell block on two or three heroes | Silvane, Auriel, Opaline; engine `ward` | Medium | Medium-high |
| 8 | Sweet-spot circles: CC in the centre, damage at the edge | Mabel, Fenna, Auriel, Brannoc | Medium | Low |
| 9 | One toggle, on a kit that pays a resource | Brannoc (Heat), Vesper (HP) | Medium | Medium |
| 10 | A second decision inside one press | new heroes; Lyra, Kaia | Medium | Medium |
| 11 | Touch aim: never snap to a summon; one cast mode per key | `src/heroMode.ts` (`aimAuto`), `src/touch.ts` | Medium | Low |
| 12 | A time mechanic (rewind or send-back) for a new hero | new hero; Unwind on the shelf | Medium | Medium |
| 13 | Trial: some casts can walk, slowed | fuse spells (Pip, Mr. Ledger, Pom...); `src/heroMode.ts`, `src/duel.ts` | Possibly high | High (balance of all 40) |
| 14 | Experiment: one shared answer button per round | every hero; new key and HUD | Possibly high | High |
| 15 | Ally targeting for the co-op Raid only | Auriel, Fenna, Pim; `src/effects/targeting.ts` | Low for duels | Low |

### 1. Write each spell's resolution sheet, and show it

**What to change.** Give every card a short, fixed set of fields:
- **stops on:** the first hit, pierce, or the whole area (League's three hit rules; Smite's six stop sentences);
- **cover:** blocked by cover, needs sight, or ignores cover;
- **dodge:** step out, break sight, outrun, or none;
- **wind-up:** its length, and whether it can be interrupted;
- **dash stop:** whether a dash in flight ignores it.

Draw the stop rule on the aim (the strip already ends at cover). Put the fields in the tooltip and on the catalog page. Let the CPU read the same fields instead of the spell's private comments.

**Touches.** Card flags in [src/heroes.ts](../../src/heroes.ts) and [src/heroes/framework/card.ts](../../src/heroes/framework/card.ts); the aim drawing in [src/heroMode.ts](../../src/heroMode.ts); the CPU flags. The values are already in each spell's header comment ([inventory](moba-research/our-spells-inventory.md)).

**References.** League's engine types, which store clamp, stored point and hit rule per spell ([Wiki: Targeting](https://wiki.leagueoflegends.com/en-us/Targeting)). Smite's stop sentences on every ability ([smite-gods-numbers.md](moba-research/smite-gods-numbers.md)). Dota's per-spell "pierces immunity" and "cannot be disjointed" notes in the feed.

**Duel risk.**
- Answer: this is rule 4 made visible.
- Warn: no change.
- Both screens: a field never draws chance.
- CPU: it gains a single source of truth.

The only cost is writing 167 short rows.

### 2. Check every answer with arithmetic, and settle the circle rule's reading

**What to change.** Run a script over every spell: the fuse against `0.25 + d / 4`, where `d` is the distance the victim must walk. Bolts get the same treatment against "reaches 6 m no sooner than 0.5 s". The rule needs one written reading first. Read as the **radius**, it fails several of our self-centred rings. Read as the **walk from the attacker's reach to the edge**, which is how Kagen's Noto file applies it, they pass for an enemy in melee. The headers below were read for this report; the arithmetic is mine.

| Spell (from its header) | Shape and fuse | Radius reading | Walk reading |
|---|---|---|---|
| Kagen W, Noto | 3.5 m ring, 0.5 s | needs 1.13 s: **fails** | 0.9 m walk, needs 0.48 s: passes (the file's own sum) |
| Kagen E, Senbon | 3 m ring, first wave 1.0 s | needs 1.0 s: passes, exactly | passes |
| Big Yoko W, Stomp | 3 m circle, 0.5 s | needs 1.0 s: **fails** | from his 2.8 m Palm Strike reach: passes |
| Brannoc R, Molten Core (Quench) | 3 m ring, 0.6 s | needs 1.0 s: **fails** | his stance reach is 3 m: passes |
| Cantor R, Duet | ring closing to 6 m, judged at 0.8 s | needs 1.75 s: **fails** | an enemy 4 m inside the edge needs 1.25 s: **fails** for anyone close to him |
| Shiori R, The Last Character | 2 m circle (4 m wide), 1.0 s | needs 0.75 s: passes | passes |
| Nyx Q, Umbral Cut (a mark that follows the enemy) | strikes within 3.2 m at 0.35 s, cast from 2.5 m | n/a | 0.7 m walk, needs 0.43 s: **fails** by 0.08 s |

The inventory gives The Last Character as a "4 m area". Its header says 4 m wide, with a 2 m circle. So the inventory's sizes are sometimes widths, and the lint must read the code, not the inventory.

**Touches.** [src/heroes/sumo/spells/stomp.ts](../../src/heroes/sumo/spells/stomp.ts), [src/heroes/forge/spells/moltenCore.ts](../../src/heroes/forge/spells/moltenCore.ts), [src/heroes/bard/spells/duet.ts](../../src/heroes/bard/spells/duet.ts), [src/heroes/shadow/spells/umbralCut.ts](../../src/heroes/shadow/spells/umbralCut.ts), [src/heroes/sheath/spells/noto.ts](../../src/heroes/sheath/spells/noto.ts); the rule text in [new-hero.md](../pipeline/new-hero.md).

**References.** Dota's delayed areas run 0.5 to 2.9 s, and its area stuns with no delay are melee-range and need a gap-closer first ([dota2-heroes-a-m.md](moba-research/dota2-heroes-a-m.md)). Smite tunes delays directly (Nox's went from 0.7 s to 0.4 s in OB48). [league-kit-design.md](league-kit-design.md) found the same kind of false answer in three older kits.

**Duel risk.** This only makes rule 4 true. Duet may be fine as designed (a cage whose answer is to stand outside 6 m when Cantor casts), but then its written answer must say that.

### 3. Give each sure hit a post-cast answer, or say why not

**What to change.** Seven click spells are written as "none once cast (sight needed at the cast)":
- Fire Vial (Vitriol)
- Homing Drone (Ada)
- Red-Hot Rivet (Brannoc)
- Sky Strike (Kaia)
- Hoarfrost (Isolde)
- Strangle Vine (Fenna)
- Shepherd's Crook (Sefu)

Polarity (Kaia) is conditional on her rods. For each, pick one of three answers:
1. **A reach check at the impact**, as Lancet and Hemocurse already do (they fizzle past 8 m). This is Dota's motion buffer in our units.
2. **A short delay that loses sight**: about 0.25 s, as Laguna Blade and Finger of Death have, during which stepping behind cover saves you.
3. **Keep the sure hit**, and write why: short range, long cooldown, low damage.

**Touches.** [fireVial.ts](../../src/heroes/alchemy/spells/fireVial.ts), [homingDrone.ts](../../src/heroes/clockwork/spells/homingDrone.ts), [redHotRivet.ts](../../src/heroes/forge/spells/redHotRivet.ts), [skyStrike.ts](../../src/heroes/storm/spells/skyStrike.ts), [hoarfrost.ts](../../src/heroes/frost/spells/hoarfrost.ts), [strangleVine.ts](../../src/heroes/grove/spells/strangleVine.ts), [shepherdsCrook.ts](../../src/heroes/sand/spells/shepherdsCrook.ts).

**References.**
- League: delayed unit-targeted spells cancel if sight is lost ([Wiki: Targeting](https://wiki.leagueoflegends.com/en-us/Targeting)).
- Dota: the 250 motion buffer ([Fandom: Cast range](https://dota2.fandom.com/wiki/Cast_range)); the 0.25 s delay of Laguna Blade and Finger of Death "lets some abilities avoid it" ([dota2-heroes-a-m.md](moba-research/dota2-heroes-a-m.md)).
- Smite: no unit clicks at all, which is the far end of this choice.

**Duel risk.**
- Answer: this is the fix.
- Warn: n/a.
- Both screens: decide on the screen that owns the hit, as the sight checks already do.
- CPU: whether it breaks sight against sight-checked spells (`enemyGoal`) is **to check**; it must do so here.

Seven heroes lose some reliability, so each needs a sim run. League's lesson from old Fiora argues for keeping some avoidable damage in every kit ([kit-anatomy.md](league-research/kit-anatomy.md)).

### 4. Long wind-ups can be interrupted, with a refund; write which CC stops a dash

**What to change.** Pick one model per spell class and draw it:
- **Short wind-ups** (0.35 s or less) cannot be interrupted, as League's cast time.
- **Long, telegraphed wind-ups** (0.5 s or more) end when a stun, silence or knock-up lands, and their cooldown is refunded, as Dota's cast point.

Candidates are the ultimates with a stand or a long tell: Sky Rend's 0.8 s stand (Zephyr), the Grand Finale and Shatterlight rings (Zambini, Opaline), Moon's Pull and the other channels. In the same change, write which of our CC stops a dash already in flight. League allows only airborne, knockdown and stasis.

**Touches.** [src/duel.ts](../../src/duel.ts) (the cast lock), [src/effects/channel.ts](../../src/effects/channel.ts), the CPU's `aiHold` for every hero that owns a stun (24 kits have hard CC), and the long-wind-up spells, e.g. [skyRend.ts](../../src/heroes/sky/spells/skyRend.ts).

**References.**
- Dota: an interrupted cast point refunds everything ([Fandom: Cast Animation](https://dota2.fandom.com/wiki/Cast_Animation)).
- League: uninterruptible cast time; channels break on airborne, silence, stun and others ([Wiki: Channel](https://wiki.leagueoflegends.com/en-us/Channel)).
- Smite 2: the opposite move, CC buffering, drew player complaints.

**Duel risk.**
- Answer: it gives our ultimates a second, active answer, and gives CC a job beyond damage.
- Both screens: the interrupt must be judged on the caster's screen with the lock rules, or the two screens disagree.
- CPU: it must learn to hold a stun for the enemy's R wind-up, a new `aiHold` rule for 24 kits.

Interacts with the 1.5 s lock cap: a stun that interrupts still counts toward the cap.

### 5. Vector aim: one press, drag, release

**What to change.** Add `aim: 'vector'`: the press fixes the origin, the drag sets the direction, the release casts. On a plain click or tap with no drag, use a default direction (across the line from the caster) so new players are never stuck. That default is the lesson of Dota's 2022 quick-cast complaints about Swashbuckle and Rebound. `CastContext` gains a second direction.

Candidates, where the second direction is the real decision:
- **Mum's Mime Wall** and **Ironknit's Cast On:** the wall's or the tripwire's angle across the enemy's path.
- **Hank's Timber Call:** the row's fall line.
- **Silvane's Vanity Stand:** the mirror's angle, which sets the bounce of Hand Mirror.
- **Bram's The Shove:** where Gerald slides.
- **Marin's Coral Spire:** the push direction.

**Touches.** [src/effects/targeting.ts](../../src/effects/targeting.ts) (`CastContext`), [src/heroMode.ts](../../src/heroMode.ts) (the aim and the three cast modes), [src/touch.ts](../../src/touch.ts) (drag), the network message (the protocol number goes up), and the spell files [mimeWall.ts](../../src/heroes/mime/spells/mimeWall.ts), [castOn.ts](../../src/heroes/yarn/spells/castOn.ts), [timberCall.ts](../../src/heroes/timber/spells/timberCall.ts), [vanityStand.ts](../../src/heroes/mirror/spells/vanityStand.ts), [theShove.ts](../../src/heroes/mason/spells/theShove.ts), [coralSpire.ts](../../src/heroes/tide/spells/coralSpire.ts).

**References.**
- League: Viktor's Hextech Ray, Rumble's Equalizer, Taliyah's Seismic Shove (`DragDirection`); quick cast sets the origin on the press and the direction on the release ([Wiki: Targeting](https://wiki.leagueoflegends.com/en-us/Targeting)).
- Dota: Kinetic Fence, Wall of Replica, Swashbuckle, Aether Remnant, Dead Shot (10 vector entries).
- Smite: no analogue in the notes.

**Duel risk.**
- Answer: as the shape it makes. A wall across a path must still leave a written way round.
- Both screens: the two points travel in the cast message, so the result is deterministic.
- CPU: the second point is easy (across the enemy's escape line).
- Phone: the same drag gesture the slot buttons already use.

Vector stays rare in Dota (about 1.4% of entries) and still makes those heroes distinct. Two or three uses in our roster is enough.

### 6. More charge-ups and channels

**What to change.** Channels exist in 7% of our kits against 26% of League's. Charge-ups exist in one kit (Lyra Q), against League's 9%. The engine already takes several `hold` slots (`HoldSpec[]`), and the tool's Thunderlance is a built charged line. Candidates:
- **Big Yoko's Sumo Charge:** charged distance with the direction locked at the first press, as Sion's and K'Sante's charges lock theirs.
- **Kaia:** Thunderlance from her old kit.
- **Sirix's Swarm Surge, Bo's Stampede:** lane length grows with the hold.
- **A new channelled ultimate** that a stun or silence ends, drawn with a bar.

**Touches.** [sumoCharge.ts](../../src/heroes/sumo/spells/sumoCharge.ts), [swarmSurge.ts](../../src/heroes/hive/spells/swarmSurge.ts), [thunderlance.ts](../../src/spells/targeted/thunderlance.ts), the traits' `hold` specs ([src/traits/types.ts](../../src/traits/types.ts)).

**References.**
- League: Xerath's Arcanopulse (charges for range); Sion's Decimating Smash and Briar's Chilling Scream (direction locked at the first press).
- Dota: Hoodwink's Sharpshooter (max at 3 s, fires itself at 5 s); Primal Beast's Onslaught (up to 1.7 s).
- Smite: Neith's World Weaver (0.5 to 2 s); Charybdis' Capsize (up to 0.75 s).

**Duel risk.**
- Answer: the growing shape is the warning, and it must show on the floor for both players (Lyra's draw already does).
- Both screens: release time travels in the message.
- CPU: needs a hold length, which is simple (hold until the shape reaches the enemy).

A forced release (Sharpshooter's 5 s) stops a held threat from becoming a stand-off.

### 7. A one-spell block on two or three heroes

**What to change.** Give a block or reflect to heroes whose theme already says "mirror" or "ward". Silvane could turn the next bolt back. Auriel's Dawnward could swallow the next enemy spell. Opaline could refract one. Use League's rule set exactly:
- all hits within 0.1 s of one cast count as one spell;
- a delayed area of the same spell is still blocked;
- terrain and lasting zones are not blocked;
- the caster's dash still happens.

Draw the block as a visible shell on the body. The engine's unused `ward` already blocks zones ("WARDED").

**Touches.** [src/heroes/mirror/trait.ts](../../src/heroes/mirror/trait.ts), [dawnward.ts](../../src/heroes/dawn/spells/dawnward.ts), [crystalPillar.ts](../../src/heroes/prism/spells/crystalPillar.ts) (or a new Opaline slot), [src/mech/index.ts](../../src/mech/index.ts).

**References.**
- League: Sivir's Spell Shield, Banshee's Veil ([Wiki: Spell shield](https://wiki.leagueoflegends.com/en-us/Spell_shield)).
- Dota: Linken's Sphere (once per 14 s), Lotus Orb, Anti-Mage's Counterspell, Nyx's Spiked Carapace.
- Smite: Nemesis' Retribution (a 2 s reflecting shield that hard CC breaks), Kuzenbo's Shell Spikes.

**Duel risk.**
- Answer: the answer to the block is to wait it out or bait it with a cheap spell. A 24 s ultimate eaten by a block is a lost round, so make the block short (about 1 s, as Nemesis' 2 s) and loud. The earlier checklist warns that no single interaction may blank a kit ([league-kit-design.md](league-kit-design.md), Q28).
- Both screens: the block must be decided on the screen that owns the hit.
- CPU: it must hold spells while the shell shows (`enemyGoal`).

### 8. Sweet-spot circles: CC in the centre, damage at the edge

**What to change.** On our larger ground CC circles, put the hard CC only in an inner ring, with damage or a slow at the edge. A victim who cannot leave in time can still reach the edge, a partial answer that our all-or-nothing circles lack. Candidates:
- Mabel's Sinkhole (a 4 m pit at 1.3 s; root);
- Fenna's World Tree (3 m at 1.2 s; root);
- Auriel's Sunrise (a 5 m ring at 1.6 s; stun on branded enemies);
- Brannoc's Molten Core Quench (a 3 m ring; knockback and stun).

The small circles (Sarcophagus and Grave Grasp at 1.6 m) are too small to split.

**Touches.** [sinkhole.ts](../../src/heroes/mole/spells/sinkhole.ts), `src/heroes/grove/spells/worldTree.ts`, `src/heroes/dawn/spells/sunrise.ts`, [moltenCore.ts](../../src/heroes/forge/spells/moltenCore.ts).

**References.**
- League: no sweet-spot circle in the notes (League's Arcane Comet lesson is about circles that promise too much).
- Dota: no sweet-spot circle in the notes.
- Smite: Erlang Shen's Pin (root only in the centre), Nut's Comet (root in the centre, tremble at the edge), Poseidon's Kraken (inner 2.4 m stun, outer slow).

**Duel risk.**
- Warn: the inner ring needs its own drawn edge, and the warning time can then be judged on the inner radius, which is shorter, so the CC is easier to place fairly.
- CPU: aims the centre at the enemy, as now.
- Both screens: unchanged.

### 9. One toggle, on a kit that pays a resource

**What to change.** We have no toggle. Toggles in all three games drain a resource every second, so they fit only our resource kits. Candidates:
- **Brannoc:** a toggled heat aura that burns around him and raises Heat each second, ending at overheat.
- **Vesper:** a blood aura that costs her HP each second, like Pudge's Rot.

Write what silence does to a toggle. In Dota, silence freezes a toggle in its current state.

**Touches.** [src/traits/types.ts](../../src/traits/types.ts) (a `toggle` slot spec, which does not exist), [src/heroes/forge/trait.ts](../../src/heroes/forge/trait.ts), [src/heroes/blood/trait.ts](../../src/heroes/blood/trait.ts), the HUD.

**References.**
- League: Amumu's Despair, Karthus's Defile (mana each second), Anivia's Glacial Storm (ends if she walks away).
- Dota: Pudge's Rot, Leshrac's Pulse Nova.
- Smite: Cu Chulainn's Vent Anger (drains Rage), Pele's Magma Rush (fuel, no cooldown).

**Duel risk.**
- Answer: kite the aura until the drain costs more than it deals.
- Both screens: the on/off state shows on the body (rule 7).
- CPU: on when the enemy is within the aura, off below a resource line.

### 10. A second decision inside one press

**What to change.** For new heroes mainly: let the aim distance or the release time pick the form of one spell. For example:
- a short cast is a shove, a far cast is a pull;
- a release on the beat is stronger (Cantor already does this).

Lyra's draw is our one example today. [league-kit-design.md](league-kit-design.md) (gap 2) found this to be our largest gap to League.

**Touches.** New kits (gate 3 of [new-hero.md](../pipeline/new-hero.md)); Lyra, Kaia as candidates.

**References.**
- Smite: Sun Wukong's 72 Transformations (Ox near, Tiger mid, Eagle far).
- Dota: Kez's weapon swap; Hoodwink's Sharpshooter.
- League: the stance and form champions (9% and 12% of kits).

**Duel risk.**
- Answer: each form needs its own drawn shape before the hit.
- CPU: needs a rule per form.
- Both screens: deterministic.

### 11. Touch aim: never snap to a summon; one cast mode per key

**What to change.** Two small fixes:
- **Check `aimAuto`** (a tap casts at the nearest enemy) and make sure it prefers the hero over Bo's sheep, Mortis's skeletons, Ada's turret, Zambini's hats and Nyx's double. Allow a drag to aim away on purpose.
- **Allow a cast mode per key**, as League and Smite do. Many players quick-cast skillshots and normal-cast a precise ground spell.

**Touches.** [src/heroMode.ts](../../src/heroMode.ts) (`aimAuto`, the mode setting kept in `localStorage`), [src/touch.ts](../../src/touch.ts).

**References.** Mobile Legends' smart targeting stealing the lock onto a minion, and Pokémon Unite's aim snap blocking an escape (both [cited], community guides in the casting note). League's per-key quick cast ([Wiki: Quick cast](https://wiki.leagueoflegends.com/en-us/Quick_cast)). Smite's per-god modes.

**Duel risk.** Low. The CPU does not use touch.

### 12. A time mechanic for a new hero

**What to change.** Give one future hero a time trick: a self-rewind (return to where you were 2.5 s ago with that HP), or a send-back on the enemy. Draw a ghost of the old spot all the time it is available. Unwind is already built as a tool spell.

**Touches.** A new kit; [src/spells/targeted/](../../src/spells/targeted/index.ts) (Unwind as the base).

**References.**
- Dota: Weaver's Time Lapse (5 s), Faceless Void's Time Walk, Disruptor's Glimpse (4 s), Kunkka's X Marks the Spot.
- Smite: Chronos' ultimate (8 s, cooldowns reset).
- League: none cited in these notes.

**Duel risk.**
- Answer: the drawn ghost is the warning, and the answer is to punish the spot it returns to.
- Both screens: store the history on the owning screen.
- CPU: easy for a self-rewind (use it below an HP line), harder for a send-back.

The Dota notes say each such spell needs "a visible marker or trail".

### 13. Trial: some casts can walk, slowed

**What to change.** Every cast now roots until its last impact (up to 2.5 s). Try, on a few spells whose danger is already on the floor (ground fuses, summons, traps), letting the caster walk at half speed once the wind-up is over. Keep the root on channels, stances and strikes.

**Touches.** [src/heroMode.ts](../../src/heroMode.ts) and [src/duel.ts](../../src/duel.ts) (the cast root); a per-card flag; test heroes such as Pip (Fragile), Mr. Ledger (Late Fee) and Pom (Snare).

**References.**
- League: 0.25 s cast times, then free movement.
- Dota: cast point median 0.30 s, then a backswing that can be cancelled.
- Smite: Agni is slowed 50% while calling Rain Fire.

**Duel risk.**
- High: the long commit is part of every kit's balance and of what the CPU expects. Every changed hero needs a sim run.
- Answer and warn: unchanged, since the circle stays where it was cast.
- Do this only as a measured trial, never across the roster at once.

### 14. Experiment: one shared answer button per round

**What to change.** Every MOBA studied gives every player access to a shared answer. League gives summoner spells (Flash). Smite gives Purification Beads, which every player starts with. Dota sells them as items (Blink Dagger, BKB). We give none, and the inventory calls this "the biggest structural difference". The experiment: one extra button, usable once per round, with two or three choices picked before the match:
- a cleanse plus 0.5 s of CC immunity (the engine's unused `cleanse`);
- a short blink;
- a 1 s spell block.

**Touches.** [src/heroMode.ts](../../src/heroMode.ts) (a key and the HUD), [src/touch.ts](../../src/touch.ts) (a button), [src/duel.ts](../../src/duel.ts), [src/mech/index.ts](../../src/mech/index.ts), the server protocol, the CPU for all 40 heroes, and the hero shop or menu for the choice.

**References.**
- League: Flash, Cleanse, Quicksilver Sash.
- Dota: Black King Bar, Linken's Sphere, Blink Dagger, Eul's.
- Smite: Purification Beads (150 s cooldown at Open Beta 1), Aegis, Blink.

**Duel risk.**
- High: it devalues the 24 kits with hard CC, and in rounds of about 20 s a once-per-round cleanse eats the first CC of most rounds. Smite's answer is that skill becomes baiting the Beads, which suits a duel; our 1.5 s lock cap already does part of a cleanse's job.
- Both screens: deterministic.
- CPU: needs a rule (cleanse a lock longer than 0.6 s; blink out of a fuse it cannot walk out of).

Test it in the simulator on the whole roster before any person plays it.

### 15. Ally targeting for the co-op Raid only

**What to change.** Add an `ally` target mode with League's forgiveness (snap to the nearest ally within a radius) and self-cast fallback. Then let a few buff spells target the Raid partner: Auriel's Dawnward, Fenna's heal zone, Pim's Shield Up.

**Touches.** [src/effects/targeting.ts](../../src/effects/targeting.ts) (the four modes), the Raid code, and the three spell files.

**References.**
- League: forgiveness of 175 on ally spells (Janna, Karma, Soraka...); self-cast fallback.
- Dota: Mist Coil and Nightmare on allies.
- Smite: Athena's and Geb's ally abilities (8 ally-aimed lines).

**Duel risk.** None in a duel: the mode never appears there.

### Five changes for the VFX tool

The tool page has no CPU and no second player, so for the tool, rules 7 and 8 become a question: would this spell still pass them when moved into the game?

**T1. Give the tool page the game's aim.**
- **What:** the strip, the circle, the bank line and the arc, and later the vector. 90 of 167 tool spells are ground clicks, and none is ever seen with the game's telegraph. A showcase previewed with its strip and fuse ring can be judged by rule 6 before it becomes a hero spell.
- **Files:** the tool page's targeting path, reusing the aim drawing in [src/heroMode.ts](../../src/heroMode.ts) (a shared engine file: one writer at a time).
- **References:** the three cast modes of all three games, and Smite's configurable ground-target arrow and range "ruler" ([Item Level Gaming](https://itemlevel.net/smite-2-best-settings-guide/)).
- **Risk:** low. The drawn shape must be exactly the hit shape (rule 6), which is the point.

**T2. A rules panel.**
- **What:** for the selected spell, show the input shape, the stop rule, the fuse, `0.25 + d/4` passed or failed, "look only" or "has rules", and the CPU flags. 109 of 167 tool spells carry no CC, and the panel would show at once which are looks and which are mechanics.
- **Files:** the tool page, reading the fields of change 1.
- **References:** Smite's stop sentences and Dota's per-spell piercing and "cannot be disjointed" notes, as in change 1.
- **Risk:** none to play. It flags rule-4 failures, and any use of chance (rule 7), before a spell reaches a kit.

**T3. Mechanics tests for the missing forms.**
- **What:** vector wall, toggle aura, channel interrupt with refund, one-spell block, cleanse, sweet-spot circle, and held charge with forced release. Each game change above is then proven on dummies first, the way the bolt, summon and status tests were.
- **Files:** next to the 13 existing tests in [src/spells/targeted/](../../src/spells/targeted/index.ts) (e.g. [statusTest.ts](../../src/spells/targeted/statusTest.ts), [shieldTest.ts](../../src/spells/targeted/shieldTest.ts)).
- **References:** one per test, from changes 4 to 9: Kinetic Fence, Pudge's Rot, Dota's cast point, Linken's Sphere, Purification Beads, Poseidon's Kraken, Hoodwink's Sharpshooter.
- **Risk:** low. Tests are tool-only. Each should state its warn time, so that rule 4 travels with it.

**T4. Map the shelf.**
- **What:** tag each tool spell with its mechanic and a candidate hero (the shelf table above), so that a new kit starts from a built, tested mechanic.
- **Files:** the tool's catalog ([docs/catalog/effects.md](../catalog/effects.md)).
- **References:** the shelf table's reference column.
- **Risk:** none. It is documentation, and gate 3 of [new-hero.md](../pipeline/new-hero.md) still checks answers.

**T5. Give the 37 untargeted effects a target, where it is cheap.**
- **What:** for example, Avenger's Shield's bounce, Hammer of Justice and Chain Lightning, so they can be aimed and compared beside the rest. Low priority.
- **Files:** `src/spells/iconic/`, `src/spells/paladin/`.
- **References:** World of Warcraft spells, not MOBA ones. A chain only matters in the Raid, as with Lich's Chain Frost.
- **Risk:** low. The `enemies` chains have no use in a 1v1 ([inventory](moba-research/our-spells-inventory.md)).

## What the notes could not settle

**Counts that are rough.**
- League's per-ability aim counts do not exist in our research, only per-slot shares of kits. The League column therefore cannot be summed against the others.
- The Dota CC numbers are keyword counts over effect text. They are good to within a handful on the big kinds and were read by hand on the small ones.
- Smite's activation tags were set by hand, and its forms were derived by a script. The two disagree on single counts but not on the order.
- Our own "mechanic" column is one reader's vocabulary, and single counts can move by one or two ([inventory](moba-research/our-spells-inventory.md), Gaps).

**Facts the notes leave open.**
- Projectile speeds and wind-up lengths in seconds are missing for most Smite abilities: only 5 of 16 delays have a number.
- The Dota notes have no general "disjointable" field beyond the exceptions the feed states.
- Whether Smite 2 still has a separate relic slot is unsettled: two sources disagree.
- Smite 2's CC-buffering window has no number, and its source is a search summary of a page that returned 404.
- Which League ground indicators the enemy sees is known only from memory, so this report does not use it.

**Our own code, not checked here.**
- Whether `aimAuto` can pick a summon over the hero (change 11).
- Whether the CPU breaks sight against the seven sure hits (change 3).
- Whether any CC stops our dashes in flight (change 4).
- The fuse table of change 2 covers only the seven headers read for it; the other circles need the same script.

**The largest unknown is the same as in the League report.** No spell of ours has been played by a person against a person. Our 0.25 s reaction time is an assumption. Every counterplay line and every ranking above is therefore a hypothesis for the first real playtest ([league-kit-design.md](league-kit-design.md), gap 4).

## Conclusion

The three big games are less different than their reputations. All three use the same five inputs and the same few answers, and each leans on a different one. Dota trusts sure hits and sells the answers as items. Smite makes everything an aim and gives everyone the same cleanse. League takes the middle and writes the rules down. **Our game already took a fourth position that suits a duel:** answers live inside the spells (a fuse to step out of, sight to break, an object to destroy), CC stacking is capped harder than anywhere else, and terrain is part of the kits. That choice is why the missing items, summoner spells and relics matter less here than the gap tables suggest. In a duel with no team, an answer built into the spell is worth more than an answer bought in a shop.

What does matter is that our answers are only as good as their arithmetic and their visibility. The cheapest gains are not new mechanics. They are writing every spell's resolution down where the player, the tooltip and the CPU can read it, and running the circle rule over every spell under one agreed reading. The first new mechanics worth building are the two that add a decision without adding a button: vector aim on the wall-makers, and hold-to-charge on a few lines. Both are on the tool's shelf or one field away in the engine. The expensive questions, whether a cast should root for up to 2.5 s and whether everyone needs one shared answer button, cannot be settled by any note. They need people playing, and that playtest is still the step every report in this folder ends on.

