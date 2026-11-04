---
title: Our kits compared with League
tags: [knowledge, research, league-of-legends]
updated: 2026-11-04
---

Research notes behind [League kit design](../league-kit-design.md), kept for their sources. Read through a tool that summarises pages, so check wording and small numbers at the source.

# Our 20 kits against what the League research shows

Written 2026-11-04. Asked by the game's artist: why are League's kits "so much better" than ours?

**What is being judged, and how firmly.**
- Five kits are built: Lyra, Vex, Marin, Mortis, Zephyr. I judge them from the code and their kit sheets. Where the build differs from `kits-v4.md`, the build counts.
- The other 15 exist in v4 only as text in `pipeline/designs/kits-v4.md`. The game still runs older kits for them (`src/kits/*.ts`). Every verdict on those 15 is judged from the design text, and the older kits are not judged.
- Nobody has played any of this with a person (`docs/STATUS.md:49`, `:69`). The only numbers are CPU fights. A verdict below says what a kit asks for on paper or in code, not how it feels.
- The CPU cannot test counterplay. It plays no tide policy (`pipeline/designs/kit-tide.md:75-76`), and the rules for playing against Lyra are "for later" (`kit-astral.md:88`). It reacts to bolts in 0.12 s at Normal (`docs/architecture/mechanics.md:105`). So a CPU win rate says nothing about whether a weakness works.
- Single matchups are 16 fights, about ±25 points at two standard deviations (my arithmetic). `mechanics.md:113` and `:115` give ±7 and ±14 for 48 fights, which are one and two standard deviations of the same number.

**Short answer.** On paper the kit ideas are not the problem. Every hero has a verb, 14 of 20 ultimates raise it, and there is a counterplay line for every spell. League is better in four specific ways: its strongest moments carry more of an answer, its buttons hold a second decision after the press, its state is more often visible to the opponent, and it has been tested against people for fifteen years. The first three can be fixed in the design, and for 15 heroes the fix costs almost nothing today.

Source labels on claims about Riot's intent are the notes' own: [Riot], [Riot, mirror], [Riot designer, outlet], [Riot via wiki], [Community]. See `riot-design-values.md` and `reworks-and-failures.md` for the links.

## 1. Our kits in League's numbers

**Method.** I tagged all 20 with the vocabulary in `champions/_brief.md`, following how the League rows use it, and counted both sides with one script. The tags are in the last section. League numbers come from `champions/_final/rows_*.jsonl`. They differ from `_stats.md` by a point on four lines (soft_cc 139 not 140, heal 84 not 85, untargetable 31 not 30, blink 23 not 24).

With n = 20, one hero is 5 points, so read the shape and not single points. Judgement calls:
- Marin's tide is tagged `stance`, though nobody chooses it.
- Marin's E is tagged as built (dash and splash), not as designed.
- `terrain` means the kit makes terrain, as in the League rows, which leave wall-using spells like Vayne's E untagged. So Lyra's E, Opaline's Q and Ada's E are not `terrain`, though they use cover.
- Nyx's veil is `stealth`, not `untargetable`. Sefu's sealed enemy is `hard_cc` only, as Bard's stasis is.

### Effects (share of kits with it anywhere)

| Effect | League | Ours | | Effect | League | Ours |
|---|---:|---:|---|---|---:|---:|
| damage | 100% | 100% | | reset (cooldown refund) | 27% | 10% |
| buff | 90% | 70% | | attack_reset | 26% | 5% |
| soft_cc | 80% | 70% | | untargetable | 18% | 30% |
| hard_cc | 75% | 85% | | pull | 16% | 40% |
| dash | 58% | 45% | | blink | 13% | 15% |
| heal | 49% | 10% | | execute | 13% | 5% |
| debuff | 40% | 35% | | stealth | 12% | 5% |
| shield | 35% | 20% | | terrain | 10% | 20% |
| mark | 35% | 50% | | block | 9% | 15% |
| | | | | invulnerable, steal | 6%, 3% | 0%, 5% |

Grouped: dash or blink 65% against 55%; crowd control 94% against 95%; any defensive tool 80% against 65%; cannot be hit (untargetable or invulnerable) 20% against 30%.

### Structural parts

| Part | League | Ours | | Part | League | Ours |
|---|---:|---:|---|---|---:|---:|
| stacks | 67% | 40% | | ammo | 17% | 10% |
| delay | 49% | 50% | | form_change | 12% | 10% |
| recast | 47% | 20% | | evolve | 9% | 0% |
| zone | 46% | 45% | | charge | 9% | 5% |
| channel | 26% | 5% | | stance | 9% | 5% |
| summon | 19% | 25% | | toggle | 6% | 0% |

Tags per kit (parts plus effects): League 16.0, ours 14.3. Ours run from Opaline 9 to Zephyr 20.

### Aim mix and slot shape (share of kits whose slot has the tag)

| | Q L / O | W L / O | E L / O | R L / O | All four L / O |
|---|---:|---:|---:|---:|---:|
| direction (skillshot) | 52 / 75 | 23 / 0 | 33 / 30 | 27 / 10 | 34 / 29 |
| targeted | 15 / 20 | 12 / 25 | 23 / 20 | 20 / 45 | 17 / 28 |
| ground | 16 / 0 | 25 / 50 | 24 / 30 | 19 / 15 | 21 / 24 |
| self | 17 / 5 | 40 / 25 | 19 / 20 | 29 / 25 | 26 / 19 |
| global | 1 / 0 | 1 / 0 | 1 / 0 | 5 / 5 | 2 / 1 |
| dash or blink | 16 / 10 | 16 / 10 | 31 / 45 | 27 / 5 | |
| untargetable | 1 / 0 | 3 / 10 | 1 / 25 | 10 / 5 | |
| recast | 15 / 20 | 12 / 0 | 14 / 0 | 22 / 0 | |
| hard_cc | 23 / 15 | 19 / 30 | 31 / 20 | 36 / 45 | |

League's slot figures above come from the rows, so a few differ by a point or two from `_stats.md`. The dash or blink row adds the two tags, so a slot with both counts twice.

### Cooldown rhythm

| Median seconds | Q | W | E | R | R over longest basic |
|---|---:|---:|---:|---:|---:|
| League, first rank | 8 | 14 | 13 | 120 | 6.7 |
| League, last rank | 6 | 10 | 10 | 80 | 6.4 |
| Our 5 built kits | 4 | 9 | 9 | 24 | 2.2 (1.6 to 3.1) |

Built cooldowns are in `src/kits/{astral,alchemy,tide,sky,bone}.ts`. Q is the shortest basic in all five (League 71%).

**The other 15 have no v4 cooldowns at all.** `kits-v4.md` gives none, and each built sheet says its numbers were chosen later (`kit-sky.md:12`, `kit-tide.md:17`, `kit-astral.md:22`, `kit-alchemy.md:92`). The older kits in the code sit near the flat budget in `kit-common.md:26-31`, about 3/7/9/20, and those are different spells, so I do not count them. That is a finding. `kit-anatomy.md` calls the ladder of time (rhythm tool, commit tools, turning point) the one thing consistent across League kits. The v4 design leaves it out, while rule 2 asks for variety in every column (`kits-v4.md:38-44`).

### Where the shape differs, and whether that is good for a 1v1

| Difference | Verdict |
|---|---|
| **R over longest basic 2.2 against 6.7** | Not a flaw. Fights average about 20-22 s (`kit-common.md:103`, `STATUS.md:162`) and a round fully resets (`docs/architecture/multiplayer.md:90-96`), so an R at 22-25 s is once per round. That is what `kit-anatomy.md` recommends. League's 120 s spans fights we do not have. |
| **No resource on 18 of 20 against 4%** | Good. With resets, mana's pacing job is gone (`kit-anatomy.md`, resources). The cost of a miss is not gone, see recast and refund below. |
| **Heal 10% against 49%** | Good. `kit-common.md:100-101` found sustain the strongest thing in a 1v1 here. League needs lane sustain and we do not. |
| **Targeted 28% against 17%** | Fine overall. The user asked for it (`kits-v4.md:10-14`), it is the easiest input on a phone, and line of sight gives anyone an answer (`multiplayer.md:177`). |
| **R targeted 45% against 20%** | Bad. Sure-hit spells are concentrated on the strongest button. See principle 2. |
| **Untargetable on basics: 7 of 60 against 8 of 519** | Bad. That is about eight times the rate. League keeps this rare on basics and we put it on a quarter of the E keys. See principle 11. |
| **Pull 40% against 16%** (13 heroes displace, `kits-v4.md:382`) | Risky. The user asked for pulls. Keep them where the pull is the verb. A pull also undoes cover. See principle 8. |
| **Recast 20% against 47%, and only on Q** | Bad. No W, E or R has a second press. In League, 22% of R have one. |
| **Cooldown refund 10% against 27%; none rewards a hit** | Bad. Cantor's comes from timing and Tempo's from his R. With no mana, a miss costs only a short timer. |
| **Attack reset 5% against 26%** | Mostly fine for ranged heroes. Of 5 melee heroes only Zephyr has one. |
| **Channel 5% against 26%** | Mixed. Most of League's are team-fight ultimates. But a channel is the clearest commit moment a duel can offer, and only Vesper has one. |
| **Melee 25% against 51%** | Open. 55% of ordered pairings are ranged against ranged (my arithmetic). Riot found closed arenas favour melee ([Riot] /dev: Arena, via `kit-anatomy.md`), and Brannoc, Oblivion and Sirix are strong in CPU fights, but those are old kits. Needs people. |
| **Q is a skillshot on 75%, W never, W is ground on 50%** | Mildly bad. By aim type our columns are more templated than League's, despite rule 2. It costs nothing to fix on paper. |
| **Stacks 40% against 67%, evolve 0%, toggle 0%** | Fine. Many League stacks and evolves are long-game scaling that has no input here. |
| **Tags per kit 14.3 against 16.0** | Fine. Riot's newest kits run near 18 (`_stats.md`), and that is not a target. |

## 2. Principle by principle

### Principle 1. One sharp strength paid for by a clear weakness

[Riot] Scruffy, Quick Gameplay Thoughts April 17, 2020: Riot avoids the jack of all trades by pairing a very sharp strength with a clear, reachable weakness. [Riot] May 14, 2021: a weakness should give a moderate disadvantage, not a complete counter. The test from `reworks-and-failures.md` section 4 is the useful one: what situation is this kit bad in?

**Meets it.**
- Lyra: far damage, paid for with 550 HP and no dash or shield (`src/kits/astral.ts:60`, `kits-v4.md:120-129`).
- Vex: no dash and no hard lock of her own, and she needs two hits (`kit-alchemy.md:39`).
- Mortis: slowest built hero at 3.8 m/s and helpless without bodies (`src/traits/bone.ts:38`).
- Sirix: a visibly spent swarm (`kits-v4.md:277`).
- Shiori: strong only where the ink lies (`kits-v4.md:320-323`).

**Misses it.**
- Zephyr: three dash buttons, three untouchable windows and 690 HP near the top of his class band (`kit-common.md:99`). By my arithmetic he is untouchable 20% of the time if everything is used on cooldown (W 0.8/8, E 0.2/7, R 1.6/24, `src/traits/sky.ts:4-8`). [Riot] Scruffy, May 28, 2021: mobile champions should be weaker elsewhere so they cannot easily win 1v1 against less mobile foes. He loses to Brannoc and Oblivion in CPU fights (2 of 16 each, `STATUS.md:47`), but those are old kits, and the CPU does not show why.
- Oblivion: a juggernaut with a blink, two drags, a constant pull and a walking silence (`kits-v4.md:308-316`). Riot lists breaking a class weakness as a poor form of mobility ([Riot] May 28, 2021).
- Vesper: drains on four buttons, three of them sure hits. See principle 9.
- Brannoc: the only stated weakness is kiting, and his kit answers it with a 9 m hook and +25% speed (`kits-v4.md:102-103`).

**A warning from the CPU numbers, for shape only.** Against old-kit opponents: Lyra 0 of 16 against Oblivion, Mortis 0 of 16 against Sirix and 16 of 16 against Cantor, Zephyr 16 of 16 against Kaia (`STATUS.md:46-48`). If people confirm gaps that wide, that is a complete counter and not a moderate disadvantage. The queue pairs heroes blind (`multiplayer.md:73`), and the hero stays for the whole match, so a hard counter here is a lost match with no way out.

### Principle 2. Counterplay lives in a moment you can read, and stronger effects carry more of it

[Riot] Scruffy, May 14, 2021: tactical counterplay matters most for high-impact moments, works best when anyone can use it, and stronger effects should carry more of it. [Riot, mirror] Morello, 2014: avoid abilities that leave no room to react. A kit should also keep some avoidable damage ([Riot, mirror] Flawed Fencer on old Fiora, via `kit-anatomy.md`).

**This is our biggest miss, and it sits on the R key.** Nine R are targeted: Vesper, Isolde, Lyra, Sefu, Zephyr, Mortis, Cantor, Opaline, Tempo. Isolde, Sefu, Zephyr, Tempo and Mortis have no answer once cast. Sefu's and Zephyr's own lines say "Nothing" (`kits-v4.md:171`, `:239`, `kit-sky.md:96`). Line of sight and range at the moment of the cast are the only defence. That is a real defence, but it is a preparation and not a moment.

**The counterplay column is the best thing in the v4 design, but some of its lines are not true.** I checked them against the code and the numbers:

| Hero, ability | Stated counterplay | What the numbers say | State |
|---|---|---|---|
| Lyra R, Meteor Mark | "Move in the last half-second" (`kits-v4.md:129`) | The spot fixes at 1.5 s, strikes at 2.0 s, radius 2.2 m, measured at the centre with no body radius (`meteorMark.ts:37-40`, `:222-225`, `:261`). A 4 m/s hero covers 2.0 m in 0.5 s and is still inside. Only Nyx and Zephyr (4.6 m/s) get out, and only with no reaction time. In practice it takes a dash. It hits for 135, and Far Sight makes that 175 from 10 m (`traits/astral.ts:57-60`). | Built |
| Marin R, Moon's Pull | "Walk against the pull; stun her" (`kits-v4.md:225`) | Four ticks of 20 plus a 65 crash land from anywhere, up to 145 in all, with no telegraph (`moonPull.ts:40-46`, `:184`, `:208`, `:305`). Walking only shortens the drag. I found no read of her status in the file, and channel cancelling is an unbuilt engine piece (`kits-v4.md:406`). From the code I read, a stun does not stop it. | Built |
| Mortis Q, Bone Fan | "Stand between the shards" (`kits-v4.md:249`, `kit-bone.md:33`) | Neighbouring lines are 8 degrees apart and a body is hit within 0.82 m of a line (`boneFan.ts:28`, `:36`, `:116`, `mechanics.md:82`). At 8 m the lines are 1.12 m apart, so the midpoint is hit by both. A safe gap needs 1.64 m, which is past the spell's range. Standing between is the worst place. | Built |
| Mortis P and W | "Fight away from his piles", "Kill skeletons away from piles" (`kits-v4.md:249-250`) | Piles are drawn only while a spell uses them (`kit-bone.md:83`, `boneFan.ts:179-180`), and the count is on his own HUD (`heroMode.ts:1256`). The opponent cannot see them. | Built |
| Marin P | "Read the tide" (`kits-v4.md:222`) | The ring shows only while one of her spells plays (`kit-tide.md:9-11`, `waveDisc.ts:247`), though the design asked for a ring at her feet. The badge is on her own HUD. What the opponent gets is a floating word at each flip, or counting 8 s. | Built |
| Brannoc W, Forge Roar | "Kite him for 3 s" (`kits-v4.md:103`) | The spell gives him +25% speed. At his current 3.6 m/s (`traits/forge.ts:11`) that is 4.5 m/s, faster than most heroes. | Design |
| Oblivion W, Null Zone | "Keep 3 m away for 3 s" (`kits-v4.md:314`) | The sphere is round him and his passive pulls at 0.6 m/s within 4 m (`:308`). A 4 m/s hero nets 3.4 m/s against his current 3.8 (`traits/void.ts:14`), so on foot you cannot leave once inside. | Design |
| Nyx Q, Backstab | "Keep turning to face her" (`kits-v4.md:182`) | There is no turn command. Facing follows the walk (`mechanics.md:134`), so from what I read you face her only by walking toward her. | Design |

**Are the skillshots dodgeable on reaction?** Seconds from cast to arrival, minus the seconds a 4 m/s hero needs to step clear, from the constants in each spell file. My assumption, not from the notes: a person needs about 0.25 s to react.

| Spell | At 6 m | At max range |
|---|---:|---:|
| Toxin Dart (`toxinDart.ts:34-41`) | 0.16 s | 0.26 s |
| Pinning Arrow (`pinningArrow.ts:31-35`) | 0.17 s | 0.27 s |
| Bone Fan, clearing all three (`boneFan.ts:31-36`) | 0.14 s | 0.17 s |
| Wave Disc (`waveDisc.ts:32-35`) | 0.25 s | 0.38 s |
| Starfall Arrow, full draw, cast to arrival after the hold (`starfallArrow.ts:32-36`) | 0.25 s | 0.56 s |

So below about 9 m, most of these can only be dodged by moving first, and the CPU's 65% dodge at 0.12 s may not describe people at all. Kits tuned to a third of bolts landing (`mechanics.md:90`) could land far more often against a person. That is a thing to test, not a verdict.

**Meets it well.**
- Vesper E: stop casting for 4 s or pay (`kits-v4.md:91`).
- Fenna: trample a flower by standing on it for 1 s (`:193`).
- Auriel W: break it and eat the burst, or wait (`:210`).
- Vex R: a bomb on legs you can outrun or shoot (`:145`, `kit-alchemy.md:67`).
- Lyra E: stay off walls (`:128`).
- Opaline R: step out within 0.8 s (`:304`).
- Shiori R: leave within 1 s (`:330`).
- Oblivion R: a hole crawling at 2 m/s (`:316`).
- Sirix: strike while the swarm is out (`:277`).

Rule 4 (`kits-v4.md:52-60`) is why these differ from each other, and that variety is real.

### Principle 3. One repeated decision at the kit's core

`kit-anatomy.md` (inference from the case studies): every kit that stands out asks one simple question the player can name.

**Clear question:**
- Brannoc: which spell gets Tempered (`kits-v4.md:96-98`).
- Sirix: spend wasps now or hold six for R (`:269-278`).
- Shiori: where do the strokes cross (`:320-330`).
- Zephyr: bank a Gust or keep the dodge (`traits/sky.ts`).
- Lyra: how long to hold the draw (`kit-astral.md:17`).
- Mortis: what to do with bodies, and his opponent also decides whether killing one helps him (`kits-v4.md:243-252`).
- Fenna: where to plant and whether to stay (`:189-200`).
- Vesper: how low to go (`:82-85`).
- Cantor: cast now or wait for the beat (`:282-285`).

**Thin:**
- Vex in practice, because Combust outvalues the rest. See per hero.
- Marin, because she cannot choose the tide and nothing rewards either side.
- Ada, because staying near turrets is close to the only thing to do.
- Auriel, because her real question belongs to the opponent.

**None found:**
- Isolde as written (the "counts as 5" clause closes it).
- Sefu (the passive fires by itself).
- Oblivion (walk at them).
- Tempo (see principle 4).

Riot's stated complaint about old Swain was close to Oblivion: in play he simply walked at enemies ([Riot via wiki] Champion Insights: Swain).

### Principle 4. The passive is a rule of play

`kit-anatomy.md` (inference, from Fiora's and Jhin's passives): the best passives change where you stand or how you attack. Rule 1 in `kits-v4.md:34-37` says the same, and the design mostly delivers it. By tags, League's own average looks plainer: 51% of its passives carry `buff`. That is a rough signal only.

**Meets it:** Shiori's ink, Vex's reaction, Sirix's swarm, Zephyr's Gust, Brannoc's Heat, Fenna's garden, Mortis's piles, Kaia's rods, Auriel's burst, Nyx's veil, Cantor's beat, Opaline's bounce, Isolde's Chill, Lyra's distance (a true rule for movement, but no button spends it).

**Misses it:**
- **Tempo, Echo.** The echo is damage only (`kits-v4.md:334-335`), and W, E and R deal no damage (`:340-342`). The passive described as "every spell happens twice" works on Q alone.
- **Sefu, Decree.** Any lock of his applies it, and the player chooses nothing (`:162-164`). Q and E never feed it.
- **Oblivion, Event Horizon.** It is automatic (`:308-309`).
- **Ada, Overclock.** It holds two unrelated rules, and "every third spell" is a count (`:256-258`). The uniqueness pass already removed four such counters from the older kits (`STATUS.md:173-175`).
- **Marin, Riptide.** It is a real rule, but no button cares whether the enemy was pushed or pulled.
- **Vesper, Blood Price.** At 4% of current HP, and refunded by Q's recast (`:89`), the price barely bites.

### Principle 5. The ultimate raises a verb the kit already teaches

`kit-anatomy.md` counts about half of its twelve League kits as doing this. By my reading, 14 of ours do.

**Raises it:** Vex (every reaction at once), Shiori (every stroke erupts), Sirix (the whole swarm), Isolde, Brannoc (slag cone adds Heat), Marin (the tide held), Kaia, Fenna, Oblivion, Cantor (in-tune spells silence), Mortis, Vesper, Nyx, Sefu.

**Partly:** Lyra (the tally and Far Sight apply, but a meteor is not about distance) and Opaline (shards reflect once, but the kit's angles do not matter much in a ring).

**Misses it:**
- Auriel: Ascendant has nothing to do with shields (`kits-v4.md:212`).
- Ada: the mech ignores her turrets (`:265`).
- Tempo: Time Theft does not echo (`:342`).
- Zephyr: Sky Rend is not a dash, gives no Gust and spends none (`traits/sky.ts:47-64`). It only pays Skyward's knock-up (`:78-82`).

Four misses out of 20 is cheap to fix, and three of the four are not built.

### Principle 6. A second decision after the press, and hits that matter

`kit-anatomy.md` (inference): a cheap second press with a time limit turns one spell into a commit decision; link cooldowns through hits so accuracy buys tempo; attacks between spells should matter. [Riot] Axes, Ask Riot 2021: a missed high-impact spell should cost something, and cooldowns can only raise the stakes so far.

**This is where League's depth is greatest and ours thinnest.** Numbers are above. Recast exists on Vesper's, Isolde's, Zephyr's and Sirix's Q and nowhere else.

**Good:** Lyra's hold (decide during the press), Zephyr's Q recast, Vesper's Q recast (take the refund now or later), Isolde's Q shatter, Sirix's leap.

**Basic attacks.** They are 9-13 damage against spells of 30-78 (`src/traits/*.ts`, `src/kits/*.ts`). Zephyr's Gust is the one real weave in a built kit. Lyra's W gives the attack a job but asks nothing. Mortis's fifth hit is a count.

**No kit gives a cooldown back for landing a skillshot,** which is the cheapest way to make a miss cost something when there is no mana.

### Principle 7. Keep locks short, and always leave a reaction window

[Riot, mirror] Scruffy, Q&A 2015: a crowd-controlled enemy should have a brief window to react, neither helplessly disabled nor already dead, and the damage-to-CC ratio matters more than raw CC. `kit-anatomy.md`: hard locks on basics near 0.75-1 s.

**Already good.** `src/effects/status.ts:14` caps every status and `:28` adds 0.5 s of immunity after a stun or knock-up. That is an engine-wide rule League does not have.

**Misses:**
- **Isolde, freeze into R.** `status.ts:113` refuses a new stun only when the target is not already stunned, so R during the 1 s freeze refreshes it to the 1.2 s cap (design asks 1.25). That can reach about 2.2 s of no action. In the same window: Q 40, W 30, then R at 190, raised by the freeze's +30% to 247, about 317 in all on paper (`kits-v4.md:109-118`). This is the case Scruffy's ratio warns about.
- **Sefu R.** 1.2 s stun, then 0.8 s root, then his crook (`:169-171`). The root does not count for immunity. His damage is low, so the ratio is fair, but it is 2 s with no answer.
- **Mortis R, as built.** Root from 0.6 to 1.45 s, drag to 1.7 s, root to 2.7 s (`graveGrasp.ts:217-219`, `:265-267`). That is longer than the design's 1 s (`kits-v4.md:252`). The target can still cast, which helps.
- **Cantor W.** A sure-hit charm of up to 1.4 s on a basic (`:290`), past the 1.2 s stun cap if it is built as a stun.

Fenna's W asks for a 1.8 s root and the cap is 1.5 (`:198`, `status.ts:14`). Brannoc's W knock-ups (0.5, 0.8 s) pass the sheet's limit of 0.4 s on a W (`kit-common.md:71`).

### Principle 8. Limit forced movement

[Riot] Axes, Champion Insights: Sett, 2020: moving other champions caused clarity problems and frustration, and the grapple was dropped. `kit-anatomy.md`: this applies with full weight when the player is the only target.

The user asked for pulls (`kits-v4.md:13`), so the question is where they earn their place.

**Keep:** Oblivion (the verb), Marin (the verb), Brannoc's hook, Kaia's yank (needs a rod), Sefu's crook.

**Weak:**
- Vesper R drags 1 m per pulse, which fights its own stated counter of stepping behind a pillar (`:92`).
- Ada's reel adds a pull to a grapple for no clear reason (`:264`).

In a cover arena a pull also takes the target out of the cover that rule 3 offers as the answer to sure hits.

Marin's sheet found a real engine trap here: a knock moves a foe v/7 m and the player only 0.18 m per unit up to a cap, so knock-backs are worth less against a person than against the CPU (`kit-tide.md:30-35`). She worked around it. Vex's Concussion did not: 3 m on a foe, 1.44 m on the player (`kit-alchemy.md:93-94`).

### Principle 9. Sustain must not undo a won exchange

[Riot] Phroxzon, Quick Gameplay Thoughts 7/29, 2022: healing is a problem when it breaks intended counterplay, and sustained burst healing is the worst case.

The roster shape is good: only 2 of 20 heal. But those two repeat the project's own finding. `kit-common.md:100-101` says a heal on every spell took Vesper to 100% and an R heal took Fenna to 84%, and sets limits of 15 per spell and 50 on an R.
- **Vesper.** The passive heals on every hit, up to 40%. Q refunds. W drains twice. E drinks. R "heals for all of it" (`kits-v4.md:82-92`). Her Q, E and R cannot miss.
- **Fenna.** By my arithmetic 24 HP/s from three flowers, doubled near the tree, plus 25 HP/s from the tree: up to 73 HP/s for 8 s (`:191`, `:200`). The older kits deal 28-39 damage per second in CPU fights (`STATUS.md:475`). On paper she cannot be out-damaged while she stands there. The trample is a good answer, but it is competing with this number.

### Principle 10. The opponent can see the state and need not study

[Riot] Scruffy, October 30, 2020: playing as a complex champion is opt-in, but facing one should not need extensive study. [Riot via wiki] on Ryze: power windows only the expert could read. [Riot] June 25, 2021: Irelia's stacks were made visible to enemies. `riot-design-values.md`: the duel opponent carries this alone.

**Good:** Sirix's wasps, Shiori's strokes, Fenna's flowers, Kaia's rods, Tempo's ghost hands, Oblivion's hole. Chill and Heat should use the stack pips that already exist (`traits/fx.ts:6`, `duel.ts:952-953`).

**Miss, all built:**
- Vex's reagents sit in `t.mem`, not stacks (`traits/alchemy.ts:13`). The 4 s reagent outlasts its 2-3 s visual (`kit-alchemy.md:44-52`).
- Zephyr's Gusts also sit in `t.mem` (`traits/sky.ts:19-20`), with a floating word when gained.
- Mortis's piles and Marin's tide are in the table above.

The badge for all of these is on the owner's HUD only (`heroMode.ts:1256`).

**Worst by design:** Nyx, whom you cannot see at all. Cantor is the odd case. The beat is visible, but the window is ±0.25 s of a 1 s pulse, so half of all moments are in tune and reading it tells the opponent little (`kits-v4.md:283-284`).

### Principle 11. "Cannot be hit" stays scarce, and no interaction blanks a whole kit

[Riot] Meddler, January 25, 2019: Akali's untargetability cost too much in counterplay and frustration. [Riot] /dev: Balancing New Champions, 2020: her true invisibility was removed as unhealthy. [Riot] Mel Midscope, 2026: reflect could not be tuned to be strong without frustrating opponents. `fandom-pages.md` ([Community] Fandom, flagged outdated) counts pure invulnerability as very rare.

**Ours on basics:** Vesper W, Sefu E, Marin E (a full second on a 10 s timer, `traits/tide.ts:8`), Zephyr W and E, Oblivion E, Tempo E. Zephyr's R adds 1.6 s.

**Interactions that blank a kit:**
- Nyx's veil switches off targeted spells, and 16 of 20 heroes own at least one (`kits-v4.md:177`, `:369`).
- Oblivion's sphere stops all casting and eats bolts, for a 3 s window that walks with him (`:314`).
- Auriel's R punishes attacking for 5 s of a 20 s round (`:212`). It reflects damage, not projectiles, so it is not Mel's mechanic, but the warning applies: the opponent's best move is to stop playing.

Tempo's and Auriel's Rs are easy to change now. Nyx is the expensive one (`kits-v4.md:408`).

### Principle 12. Theme delivered by the kit, and floor separate from ceiling

[Riot] Scruffy, September 4, 2020: does the gameplay hook deliver on the theme? [Riot, mirror] Morello, 2012: floor and ceiling are separate dials.

**We are strong here.** Every hero can be named in one line, and the kit does what the line says (`kits-v4.md:34-37`). As an artist's game that is its best asset.

**Good separate dials:**
- Opaline: a straight Q works, banks are the ceiling (`:301`).
- Lyra: tap or hold.
- Cantor: 50% in tune by accident, 100% with skill.

**Note a risk:** rhythm and frame-tight skill act as a ping gate online ([Riot] June 25, 2021, on Irelia's E). Cantor's wide window is the right call.

## 3. Per hero

Built heroes are judged from code. The rest are judged from `kits-v4.md` text only. Line references are to that file unless marked.

### Vesper, the Crimson Countess (design, lines 80-92)
- **Core decision:** how low to let herself go, since each spell costs HP and under 40% she drinks at 40%.
- **Opponent:** stay past 7 m or behind cover, stop casting for 4 s while cursed, stun or break sight during R.
- **Biggest gap:** she heals on every button, her three attack spells cannot miss, and she has no skillshot.
- **Change:** R heals only when the third pulse lands, and drop its drag. Interrupting or stepping behind cover then denies the heal.

### Brannoc, the Ashen Smith (design, 94-105)
- **Core decision:** which spell gets Tempered: hook stun, slam knock-up, or rivet amp.
- **Opponent:** sidestep the hook, keep Heat under 3, walk away during R.
- **Biggest gap:** kiting is his one weakness, and W gives him +25% speed while its counterplay line says kite him.
- **Change:** remove the speed from Forge Roar. Keep armour and slam.

### Isolde, the Winter Warden (design, 107-118)
- **Core decision:** none found as written. "A frozen enemy counts as 5" means reach 5, then R, with no trade.
- **Opponent:** dodge the icicle, keep out of 8 m, stop attacking during E.
- **Biggest gap:** freeze into R is about 2.2 s of lock and about 317 damage on paper.
- **Change:** R on a frozen enemy deals its damage but adds no stun. Now the choice is real: R at 3-4 for the stun now, or one more hit for the freeze.

### Lyra, the Star Archer (built, `src/kits/astral.ts`, `src/traits/astral.ts`)
- **Core decision:** how long to hold the draw: 39 damage at 9 m now, or 78 at 14 m a second later while they close.
- **Opponent:** close in to lose Far Sight, stay 1.5 m off walls, break sight during Twin Stars.
- **Biggest gap:** Meteor Mark cannot be walked out of (principle 2). Second: she has no answer when caught, and Twin Stars is a plain steroid.
- **Change:** let the meteor land 0.8 s after the spot fixes, not 0.5 s. A walker then gets out with about 0.25 s to react.

### Vex, the Plague Alchemist (built, `src/kits/alchemy.ts`, `src/traits/alchemy.ts`)
- **Core decision:** which two reagents to join. In numbers it is thinner: Combust is +55, while Corrode's +20% for 3 s is worth about 18 at 30 damage per second (my arithmetic).
- **Opponent:** dodge the dart so the vial has nothing to react with, keep past 7 m, outrun the homunculus for 3.7 s or spend a spell on it.
- **Biggest gap:** two of the three reactions rarely beat the first, and the opponent cannot see what is primed.
- **Change:** raise Corrode until it competes (for example 35%), so Q then E is a real alternative to Q then W. Her R is the best in the roster, so leave it alone.

### Kaia, the Tempest Caller (design, 147-158)
- **Core decision:** where to plant rods: a net the enemy must stand in, or one anchor for the yank.
- **Opponent:** leave the 6 m around rods, walk 3 m clear in the 1 s before the yank, get away from her during R.
- **Biggest gap:** rods cannot be removed, three can cover up to 75% of the arena by area (my arithmetic, radius 6 in a radius 12 ring), and R could reach 58 per strike, up to 406, if rods arc on every strike.
- **Change:** an arc spends the rod. Rods become a resource she decides when to cash, and they thin out for the opponent to see.

### Sefu, the Dune Sovereign (design, 160-171)
- **Core decision:** none found. The nearest is crook first or seal first, which is an order and not a choice. Judged applies itself.
- **Opponent:** dodge the blind, stay past 6 m. While sealed, nothing.
- **Biggest gap:** a 2 s lock with no answer, and a passive that asks nothing of him.
- **Change:** remove the 0.8 s root when the sarcophagus opens. The lock is then 1.2 s, the immunity rule covers what follows, and he must still land something to keep them Judged.

### Nyx, the Umbral Stalker (design, 173-185)
- **Core decision:** strike now, or step back 2.5 s to fade for +50% and a silence.
- **Opponent:** area spells, back to a wall, walk toward her to face her.
- **Biggest gap:** invisibility blanks every targeted spell and leaves one person with nothing to read. It is also the costliest engine piece (line 408).
- **Change:** while faded she stays drawn as a faint outline and cannot be targeted past 3 m. It keeps the hunt and the fade, costs far less, and gives the opponent something to track.

### Fenna, the Grove Warden (design, 187-200)
- **Core decision:** where to plant, and whether to stay in the garden or glide out.
- **Opponent:** trample flowers, fight away from them, chase her after the glide.
- **Biggest gap:** up to 73 HP/s on paper, and the tree alone heals up to 200, against a limit of 50 on an R in `kit-common.md:101`.
- **Change:** delete the tree's own 25 HP/s. It still doubles flowers, so trampling stays the answer.

### Auriel, the Dawn Paladin (design, 202-212)
- **Core decision:** mostly the opponent's, which is unusual and good: break the shield and eat the burst, or wait. Hers is which shield when. E then Q is a fixed order.
- **Opponent:** stay past 3 m when a shield ends, leave the 6 m cone while Sunmarked, stop hitting during R.
- **Biggest gap:** Ascendant has nothing to do with shields, and its answer is to stop playing for 5 s.
- **Change:** make R a large shield that bursts when it ends, with her other shields doubled meanwhile. That keeps the same question at a bigger size, and it needs no new reflection piece (line 411).

### Marin, the Tide Dancer (built, `src/kits/tide.ts`, `src/traits/tide.ts`)
- **Core decision:** do I want them nearer or farther right now, and is it worth waiting for the flip? It is thin: she cannot choose the tide and no spell rewards either result.
- **Opponent:** dodge the disc, stay out of the spire's circle, count 8 s. Nothing stops R's damage.
- **Biggest gap:** a rule that changes outcomes without asking anything. Her damage was then raised by CPU fights until she won (Q 40 to 68, W 12 to 62, `kit-tide.md:12-16`, `STATUS.md:44`), while the AI ignores the tide. So her numbers measure the AI, not her kit.
- **Change:** Mist Form flips the tide when she reforms. Her escape becomes a choice, and the opponent sees the flip coming.

### Zephyr, the Wind Blade (built, `src/kits/sky.ts`, `src/traits/sky.ts`)
- **Core decision:** spend a Feather Step to bank a Gust, or keep it to dodge. The best weave in the built kits.
- **Opponent:** make him spend both charges, step off Skyward's circle, hold a stun for when he lands.
- **Biggest gap:** Sky Rend has no answer and ignores the passive, and he is untouchable about a fifth of the time.
- **Change:** each Gust he holds adds cuts to Sky Rend, and with none it is three cuts. The opponent can read his strength from visible Gusts, and R stops being a free opener.

### Mortis, the Ossuary Lord (built, `src/kits/bone.ts`, `src/traits/bone.ts`)
- **Core decision:** spend his skeletons on armour now, or use the piles they leave. His opponent also decides: killing a skeleton cuts the shield by 30 but leaves a pile (`kit-bone.md:22`). This is the best two-sided tension among the built kits.
- **Opponent:** leave the fan, kill skeletons far from him, break sight before Grave Grasp.
- **Biggest gap:** the piles the whole kit turns on are invisible to the opponent.
- **Change:** draw piles on the ground for their full 8 s. The part exists (`BonePiles`), and the sheet says only that a trait has no scene (`kit-bone.md:83`).

### Ada, the Artificer (design, 254-265)
- **Core decision:** thin. Where to put turrets and whether to leave their 5 m to grapple away.
- **Opponent:** kill turrets or fight elsewhere, sidestep the hook, kite the mech.
- **Biggest gap:** the mech forgets her turrets, and the passive holds an extra count.
- **Change:** replace the mech with a heavy emplacement she climbs into, rooted, that overclocks all her turrets. It raises her own verb, gives a clear place to walk away from, and removes one transform piece.

### Sirix, the Swarm Warden (design, 267-278)
- **Core decision:** spend wasps on poison or cloud now, or hold six for R.
- **Opponent:** dodge the barb, strike while the swarm is out, bait R when it is small.
- **Biggest gap:** R refills to six at once, which removes the one opening the kit makes. Its visible swarm is otherwise the best-read state in the roster.
- **Change:** remove the refill. After R he is empty and regains one wasp every 2 s.

### Cantor, the Last Verse (design, 280-292)
- **Core decision:** cast now, or wait up to half a second for the beat.
- **Opponent:** stay out of the cone, break sight to deny the charm, stun him inside the ring.
- **Biggest gap:** the opponent has no way to touch the beat, and Siren Song is a sure-hit lock of up to 1.4 s on a basic.
- **Change:** a stun or silence on him breaks the beat for 2 s. The opponent now has a goal and a timing of their own.

### Opaline, the Lightbreaker (design, 294-304)
- **Core decision:** shoot straight now, or bank for +25% per bounce, and where to raise the crystal.
- **Opponent:** watch angles, take away her crystal's line, rush when the flare is down.
- **Biggest gap:** she removes the arena's general answer (cover), and the opponent must do the geometry. Her R also gives no ring size.
- **Change:** the telegraph draws the first bounce for both players. Her ceiling stays, and the study burden drops. The cleanest cover kit in the design.

### Oblivion, the Unmaker (design, 306-316)
- **Core decision:** none found. He walks at you, and the passive and Q do the rest. Blink first or sphere first is an order.
- **Opponent:** stay out of 4 m, walk away from the hole. Once inside, walking does not work.
- **Biggest gap:** a walking silence that eats bolts, combined with a pull you cannot outrun, is a shut-down for any ranged hero. Already strong on his old kit (`STATUS.md:47-48`).
- **Change:** Null Zone stays where he cast it. He gets a place to hold, and the opponent gets a clear way out.

### Shiori, the Last Brush (design, 318-330)
- **Core decision:** where the strokes cross, using her own Q line and E path.
- **Opponent:** stay off the ink, avoid crossings, leave the sigil within 1 s.
- **Biggest gap:** none in structure, with Vex's the best idea in the roster. R's wording is unclear: "40 each to a Stained enemy standing on one" could be 40 or 200.
- **Change:** define R as 40 per stroke under the enemy's feet.

### Tempo, the Unwound Hour (design, 332-342)
- **Core decision:** none found. Echo works on Q only.
- **Opponent:** dodge the bolt, watch the ghost hands, fight after his R.
- **Biggest gap:** the passive is empty on three buttons, and R is unrelated to it.
- **Change:** Time Skip leaves an echo of his last spell at the spot he left. Q then blink becomes a crossfire, and where he stands becomes the decision.

## 4. Where League's virtues do not apply, and where we are fine

### Do not imitate

- **Strategic counterplay, items and counter-building.** [Riot] Scruffy, May 14, 2021 lists counter items, invades and grouping. We have none, and Phroxzon's point about items overriding kits ([Riot] Addressing Mythics, 2023) is a reason to be glad.
- **Long R cooldowns, rank-up scaling and level gates.** The 6.7 ratio spans fights we do not have.
- **Mana attrition.** See section 1.
- **Lane sustain and the share of healing it brings** (49%). Keep ours low.
- **Takedown rewards and carry-over.** A kill ends the round (`kit-anatomy.md`). Carry-over would bring back snowballing (`reworks-and-failures.md`).
- **Global and team-reach tools.** The arena is 24 m across (`docs/architecture/arenas.md:46`).
- **A niche kit for a few.** [Riot, mirror] calls Bard a success on a roster of 150 or more. A roster of 20 cannot carry one.
- **Pro-play balance machinery.**
- **Tags per kit rising over time.** Not a goal.
- **Dash on 65% of kits.** Ours at 55% is enough on a small map.

### What our format allows and League's does not

- **Line of sight as a universal answer.** Anyone, on any hero, can stop a sure-hit by standing behind cover (`multiplayer.md:177`), which is what Scruffy says tactical counterplay should be. League's kits mostly assume open sightlines (`kit-anatomy.md`). This is why our higher targeted share is defensible.
- **Rounds as a learning loop.** [Riot designer, outlet] August: a fair loss should leave the player with a plan, and Vi seemed unfair until people learned her. A best of three lets that happen inside one match. The 3 s break (`multiplayer.md:93`) is free space to show what hit you, and [Riot] May 6, 2022 lists knowing what killed you as a goal.
- **A shared clock.** Round time is common knowledge. The tide runs on it (`traits/tide.ts:21`), and so do arena events (`STATUS.md:73-77`). League has no equal for the whole fight. An R that comes up at a known second would be readable by both players.
- **Cover as a kit's material.** Lyra's pin, Opaline's bounce, Ada's grapple, Marin's spire and Fenna's tree. Breakable temple walls change this during a round (`STATUS.md:293-297`).
- **Letting the loser swap heroes between rounds.** The server already takes a new max HP each round (`multiplayer.md:95`). It would turn a hard counter into a choice. That is strategic counterplay, restated for a duel.

### Answering the premise honestly

**League is actually better at:**
1. Strong moments that carry an answer. Our R key is where sure-hit and no-answer pile up.
2. The second decision. Recast 47% against 20%, refund 27% against 10%, and hits that shorten timers.
3. State the opponent can read (four of five built kits hide theirs).
4. Tested weaknesses. [Riot designer, outlet] August says data is an input judged against what a kit is meant to do. Ours has only one input, and it cannot test a weakness.

**The gap is only polish and playtesting:**
- How hits feel, how readable effects are at speed, balance numbers, and whether a kit is fun. None of this can be judged from text.
- Riot says most of a paper kit dies in testing, and only one or two things survive ([Riot, mirror] Meddler, from a search summary, via `kit-anatomy.md`). So expect v4 to change as well.
- Riot also gets more data in one day after launch than in all of development ([Riot] April 17, 2020).
- Part of the user's impression may come from today's roster: 15 of the 20 heroes in the game are still on older kits, and every fight so far is against a CPU that plays around nothing. A kit's two-sidedness cannot be felt in that setting.

**We are fine, or ahead:**
- Identity. Every kit has one idea, and League's own failures in the notes often start from a missing one (Sion, Urgot, Swain).
- Passives as rules: League's average is plainer.
- Ultimates that raise a verb: 14 of 20 against about half of a sample of twelve.
- Lock rules across the whole engine.
- Few heals.
- Line of sight.
- Reasonable tags per kit.
- No items, so the kit is the whole budget and can be read whole.

## 5. What to do first

Most valuable first. The 15 unbuilt kits cost a text edit today and a rebuild later, so changes to them are cheap now. Changes to the five built kits need a CPU rebalance after.

1. **Make the stated counterplay true on the built kits.** Lyra (meteor delay), Marin (R's damage must be avoidable or cancellable, which needs channel piece 5), Mortis (widen the Q fan or correct its counterplay line), Zephyr (see 4). Check every line of the Counterplay column by arithmetic before batch 2, and do the same for Brannoc W and Oblivion W. Why: the notes' firmest rule, and the column is already the design's best feature.
2. **Show hidden state to the opponent.** Mortis's piles on the ground; Marin's tide ring always on; Vex's reagents and Zephyr's Gusts on the existing pips (`traits/fx.ts`). Rule for batch 2: anything on the enemy or the hero is visible to both. Small cost, and without it a playtest measures confusion.
3. **Play the five built kits against a person before building batch 2.** Ten matches, with questions written first. Did you know why you lost? Could you dodge the dart at 6 m? Did you use the tide on purpose? Did you open with R? This is the only way to test a weakness, and it is Riot's own order: get into the game early, and judge by fairness and whether players have a plan for next time ([Riot designer, outlet] August). It may change items 4-8.
4. **Rewrite the four unrelated ultimates and the empty passive on paper.** Auriel R, Ada R, Tempo R and passive (E), Zephyr R. Free for three of them. Why: principle 5 is otherwise a strength, and these are the only clear holes.
5. **Replace Nyx's invisibility before it is built.** The largest engine item in `kits-v4.md:408`, with Riot's own reversal behind the warning. This also answers open question 3 at `:449`.
6. **Add a second press or a refund to six kits.** Only where it adds a decision. Own ideas to test: Opaline Q refunds per bounce; Lyra's full-draw hit takes time off E; Kaia's W can be recast to fire its rod early; Fenna's tree can be uprooted early to move it; Sefu's Q refunds on a hit to Judged targets; Tempo's Q likewise. The engine has per-slot recasts already (`STATUS.md:328`). Why: the largest gap to League's numbers, cheap in engine terms.
7. **Trim sustain and lock chains on paper, and write the cooldown ladder into the v4 design.** Vesper R, Fenna R, Isolde R on frozen targets, Sefu R root, Cantor W length, Oblivion W anchored. Give each of the 15 a named rhythm tool, commit tool and turning point. Why: these repeat findings the project already made (`kit-common.md:100-101`).
8. **Try two format rules once people play.** R comes up 8 s into a round instead of at 0 (all cooldowns are 0 at the start, `duel.ts:493`, and the CPU's own rule holds R back, `mechanics.md:219`, so a human opening with R is a game no CPU fight has measured). And let the loser of a round swap hero. Both touch every hero and may not be wanted, so test before keeping.

## 6. Where my reading disagrees with the notes

- **`kit-anatomy.md`: "Prefer breadth inside each kit", tagged as transferring.** I disagree. It rests on Jag's argument about a narrow kit being binary in a long lane. A 20 s round is not a long lane. The same notes say the opposite elsewhere: [Riot] Scruffy, April 17, 2020 on sharp strengths, and overload as a top risk in `reworks-and-failures.md`. My resolution: breadth of answers (one way out, one way in), not breadth of tools.
- **`kit-anatomy.md` holds Riven up as a model, while `_patterns.md` batch_09 and `part_4.md` call her depth a weakness because it rests on animation cancels.** I side with the second on cancels and with the first on the weave. Weave yes, cancels no. Online latency makes this firmer.
- **`kit-anatomy.md` "Unknown inputs" (round length, resets).** Now settled: no time limit, about 20-22 s in CPU fights, full reset (`multiplayer.md:90-96`). Its conclusions on R and on mana hold. Note the 20-22 s predates v4 and the new walking, so treat it as approximate.
- **`fandom-pages.md`: "can't be hit at all is kept scarce".** It comes from an outdated Fandom page and counts narrower things. The rows show 35 kits (20%) with untargetable or invulnerable somewhere. The claim is true for basics (8 of 519) and false as a general statement about kits.
- **`_patterns.md` batch_06: Mordekaiser's ultimate is "the only built-in 1v1".** `kit-anatomy.md`'s Camille entry describes a one-target lock zone too. It is the only one needing new engine technology, which is a different claim.
- **`_stats.md` against the rows.** A few counts are a point off, as noted. Nothing changes.

**One disagreement with our own design.** `kits-v4.md:45-49` says a short range of 5-8 m pays for a sure hit. The CPU holds 70% of Q's range (`mechanics.md:223`), which is 6.3 m on a 9 m Q, and ranged basic attacks run 6-8.5 m. So 7 m is the normal fighting distance. Short range is not paying for much. Sight and delay are what really pay.

## 7. What I could not settle

- **Does Vex's homunculus work online?** `kit-alchemy.md:83` and the header of `homunculus.ts:23` say a network duel has no `ctx.summon` and the bomb hits no one. `multiplayer.md:270` says the other player's units spawn and fight, and `arena.ts:802` builds a context with `summon`. If the first is right, her R does nothing online.
- **Everything about people.** Reaction budgets assume 0.25 s. Marin's flip and all "change" lines are untested ideas.
- **Whether a stun should stop Moon's Pull.** I found no status read in `moonPull.ts`, but I did not trace every path that could end an effect from outside.
- **Exact v4 walk speeds for the 15.** The design gives none, so Brannoc's and Oblivion's arithmetic uses their current trait files.
- **Kaia's R total.** The text says "the rods arc too" without saying per strike. The 406 assumes per strike.
- **Whether `untargetable` is the right tag for our "untouchable".** It swallows every hit (`traits/sky.ts:73-75`), which sits between League's two tags. Counting it as `invulnerable` instead would change that row, not the point.

## 8. The tags

Same vocabulary as `champions/_brief.md`. Each cell: aim · parts · effects, with "-" for an empty list. For the five built kits, cooldowns are Q/W/E/R in seconds. The rest have none in the design.

| Hero | P (parts · effects) | Q | W | E | R |
|---|---|---|---|---|---|
| **Vesper**, drain juggernaut, ranged, resource health | - · heal | targeted · recast · damage, mark, heal | ground · - · dash, untargetable, buff, damage, heal | targeted · - · debuff, damage, heal | targeted · channel · damage, pull, heal, execute |
| **Brannoc**, tank, melee, resource none | stacks · mark | direction · - · damage, pull, soft_cc, hard_cc | self · - · buff, damage, hard_cc | targeted · - · damage, debuff | self · form_change · buff, damage |
| **Isolde**, controller, ranged, resource none | stacks · soft_cc, hard_cc, mark | direction · recast · damage, soft_cc | targeted · - · damage, soft_cc | self · - · buff, soft_cc | targeted · stacks · damage, hard_cc |
| **Lyra**, marksman, ranged, resource none, built, cd 4/14/9/24 | - · buff | direction · charge · damage | self · - · buff | direction · - · damage, hard_cc, soft_cc | targeted · delay · damage, mark |
| **Vex**, mage, ranged, resource none, built, cd 3/6/8/25 | stacks · damage, debuff, hard_cc, soft_cc, mark | direction · - · damage, mark | targeted · - · damage, mark | direction · - · damage, hard_cc, mark | ground · summon · damage, hard_cc, soft_cc, debuff |
| **Kaia**, mage, ranged, resource none | summon · damage | targeted · - · damage | ground · zone · damage, soft_cc | targeted · delay · pull, hard_cc | self · zone · damage |
| **Sefu**, controller, ranged, resource none | - · debuff, soft_cc, mark | direction · - · damage, soft_cc | targeted · - · damage, pull, soft_cc | ground · - · dash, untargetable, damage | targeted · delay · hard_cc, damage |
| **Nyx**, assassin, melee, resource none | - · stealth, buff, soft_cc | targeted · - · damage | ground · zone · stealth, soft_cc | direction · summon · dash, damage | self · - · stealth, buff |
| **Fenna**, support, ranged, resource none | zone · heal, soft_cc | direction · - · damage | targeted · - · damage, hard_cc | ground · - · dash, heal | ground · zone · terrain, hard_cc, heal, block |
| **Auriel**, support, ranged, resource none | - · damage | direction · - · damage, shield, hard_cc | self · - · shield, buff | targeted · delay · damage, mark | self · - · buff, damage |
| **Marin**, controller, ranged, resource none, built, cd 4/9/10/22 | stance · hard_cc, pull | direction · - · damage, hard_cc, pull | ground · delay · damage, terrain, hard_cc, pull | ground · delay · dash, untargetable, buff, damage | global · - · damage, pull, buff |
| **Zephyr**, assassin, melee, resource none, built, cd 4/8/7/24 | stacks · damage, buff, attack_reset | direction · recast · damage, dash | ground · delay · damage, dash, untargetable, hard_cc, attack_reset | direction · ammo · dash, untargetable, attack_reset | targeted · - · damage, untargetable, blink |
| **Mortis**, summoner, ranged, resource none, built, cd 5/9/14/22 | summon, stacks · damage | direction · - · damage | ground · summon, delay · damage | self · delay · shield, damage | targeted · delay, summon · damage, hard_cc, pull |
| **Ada**, engineer, ranged, resource none | stacks · buff | targeted · - · damage, mark | ground · summon, ammo · damage | direction · - · dash, pull | self · form_change · shield, buff, damage, hard_cc |
| **Sirix**, bruiser, melee, resource other | stacks · - | direction · recast · damage, dash, mark | self · - · buff, damage | ground · zone, stacks · damage, soft_cc | direction · stacks · damage, hard_cc, soft_cc |
| **Cantor**, support, ranged, resource none | - · buff, reset | direction · - · damage, soft_cc | targeted · - · hard_cc | self · stacks · buff, shield | targeted · zone · terrain, soft_cc |
| **Opaline**, marksman, ranged, resource none | - · buff | direction · - · damage | ground · zone · terrain, block | self · - · hard_cc, soft_cc | targeted · delay · damage |
| **Oblivion**, juggernaut, melee, resource none | zone · pull, buff | self · - · damage, pull | self · zone · soft_cc, block | ground · - · blink, untargetable, buff, damage, debuff | direction · zone · damage, pull, hard_cc |
| **Shiori**, summoner, ranged, resource none | zone · soft_cc, debuff, damage | direction · zone · damage | ground · zone, delay · hard_cc, debuff | direction · zone · dash | ground · delay · damage, hard_cc |
| **Tempo**, mage, ranged, resource none | delay · damage | direction · delay · damage, mark | ground · zone · soft_cc, buff | ground · delay · blink, untargetable | targeted · - · steal, reset, soft_cc, buff, debuff |

Each kit's unique rule, in a few words:

- **Vesper:** spells cost current HP; heal rises as HP falls.
- **Brannoc:** 3 Heat turns the next spell Tempered; the player picks which spell gets it.
- **Isolde:** 5 Chill freezes; R spends Chill and a frozen enemy counts as 5.
- **Lyra:** damage rises with distance; the arrow roots only near cover.
- **Vex:** two different reagents react; the pair decides the reaction.
- **Kaia:** placed rods arc on every spell hit.
- **Sefu:** any CC of his Judges: +20% from him and no dash for 3 s.
- **Nyx:** fades after 2.5 s without damage; back hits double.
- **Fenna:** spells plant flowers that heal her; the enemy can trample them.
- **Auriel:** a shield that ends bursts for 60% of its size.
- **Marin:** an 8 s tide flips her spells between push and pull.
- **Zephyr:** every dash banks a Gust that the next attack spends.
- **Mortis:** dead units leave piles that scale his spells.
- **Ada:** turrets fire faster near her; every third spell loads a heavy bolt.
- **Sirix:** a visible swarm of six wasps that spells spend.
- **Cantor:** spells cast on a 1 s beat are stronger.
- **Opaline:** bolts bounce off cover and gain damage per bounce.
- **Oblivion:** a constant pull within 4 m.
- **Shiori:** ink strokes stay; crossing two bursts.
- **Tempo:** every spell echoes at 40% damage 1.5 s later.
