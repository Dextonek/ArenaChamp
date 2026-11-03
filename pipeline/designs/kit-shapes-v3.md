---
title: Kit shapes v3, no more circle Ws and circle ultimates
tags: [design, heroes, kits]
updated: 2026-11-03
status: design only, not built, waiting on the user
---

# Kit shapes v3 (2026-11-03)

The user's note: "the kits of all heroes are the same: one skillshot, one AoE, another AoE or a shield or damage
around the player, and the ultimates are mostly big AoE spells. A kit should be a skillshot, a shield or a dash, a
unique mechanic like a pull, a stun or a curving or charged skillshot, and the ultimate should not just be an AoE:
for example, return in time 2 s, or one strong skillshot."

[kit-identity-v2.md](kit-identity-v2.md), not built, gave every hero an owned verb through **passives and riders** (what
a hit does). It left the **shapes** (what you aim and dodge) alone, so this doc does the shapes. v2's passives and
twists stay; where both docs touch a slot, this doc's shape wins and v2's rider goes on top if it still fits.

## What is wrong, counted

From the built kits (`src/kits/*`, `src/heroes.ts`, dumped 2026-11-03):

| Slot | Ground or self circle | Other shapes |
|---|---|---|
| Q | 1 (Vex lob) | 9 line skillshots, 6 click targets, 3 melee cones, 1 dash |
| W | **13 of 20** (r 2–4.5) | 1 line, 1 trap, 1 click, 2 dashes, 2 summons |
| E | 8 self bursts, rings or shields | 4 dashes or blinks, 2 summons, 1 ground field, 1 cage, 1 fan, 1 tether, 1 ice block, 1 rewind |
| R | **16 of 20 big circles (r 4–7)** | 1 global, 1 line, 1 channel beam, 1 small zone |

So Q is fine. The sameness is the **W and R columns**, and the self-burst habit on E.

## What the research says

- Riot's counterplay rule: counterplay should **scale with impact**, and not every spell needs it ([Riot, Quick
  Gameplay Thoughts: May 14](https://www.leagueoflegends.com/en-gb/news/dev/quick-gameplay-thoughts-may-14/)). That
  explains how we got here: every big spell was made fair the same way, by a big telegraphed circle you walk out
  of. The fix is to vary **the kind of counterplay**, not to drop it:
  - dodge one projectile (a strong single skillshot);
  - break line of sight behind a pillar (a curve or a bank shot changes this);
  - walk out of a tether's range before it snaps;
  - bait the rewind or the cheat-death, then burst after it;
  - interrupt or outrun a channel or a mark.
- Role rules from shipped MOBAs: hard crowd control sits mostly on tanks and controllers, long skillshots on ranged
  damage, fast dashes on melee damage, and a tank should not also be very mobile ([Ludus devlog, design
  choices](https://itzluzy.itch.io/ludus/devlog/734562/design-choices)).
- Kits get prototyped through many ability variants before they settle ([Riot, On Champion
  Prototypes](https://nexus.leagueoflegends.com/en-us/2016/10/dev-on-champion-prototypes/)), so this doc plans a
  play-test of 5 heroes before the other 15.

Reference abilities per new shape, for looking up how they feel (mechanics only, nothing copied):

| Shape | League of Legends | Dota 2 |
|---|---|---|
| Time rewind | Ekko R | Weaver's Time Lapse |
| Charged skillshot | Xerath Q, Varus Q | Mirana's Sacred Arrow |
| Mark, then recast to strike | Zed R, Lee Sin Q | – |
| Hook | Thresh Q, Blitzcrank Q | Pudge's Meat Hook |
| Charge that slams into walls | Poppy E | Spirit Breaker's Charge |
| Terrain wall | Anivia W, Jarvan R | Earthshaker's Fissure |
| Projectile wall | Yasuo W | – |
| Cheat death | Zilean R, Kayle R | Oracle's False Promise |
| Spell steal | Sylas R | Rubick's Spell Steal |
| Curving shot | – | – (rare in both: it would be ours) |
| Tether that snaps | Karma W, Morgana R | Puck's Dream Coil |

## The rules this roster meets

1. **Q**: a skillshot on most heroes (a line, a lob or a hook). Click targets stay only where the hero's identity
   needs them (Fenna's seeds, Nyx's dash).
2. **W or E**: at least one of them is a dash, a blink, a shield or a block (the defensive or mobility tool).
3. **One slot per hero has an owned mechanic** no one else has (the ★ column below).
4. **No R is a big circle.** At most 2 Rs have a circle at all, each 3 m or less.
5. **W circles from 13 down to 4** (Vex's lingering pool, Sefu's quicksand, Auriel's delayed dome, Tempo's
   timelock), plus Brannoc's small lob. **Self-burst Es from 8 down to 3** (Brannoc's shield, Kaia's ring, Oblivion's
   mantle).

## The roster (★ = new shape, the rest kept)

| Hero | Role | Q | W | E | R |
|---|---|---|---|---|---|
| Vesper | assassin | ★ Hemolance becomes a line skillshot that heals | ★ Blood Step: blink 5 m, leaves a wounding thorn strip | Crimson Pact (tether drain) | ★ **Blood Bond**: mark, then recast to pop for 50% of the damage dealt since |
| Brannoc | tank | ★ Slag Flick becomes a 7 m line that burns | Anvil Drop (small lob) | Bellows Ward (shield) | ★ **Forge Charge**: charges 8 m, carries the enemy, stuns it if he slams it into a wall or pillar |
| Isolde | controller | Rime Spear (line, slow) | Frostfern Field (strip, root) | Glacial Mantle (ice block) | ★ **Glacier Wall**: an ice wall 7 m long that blocks walking and sight for 4 s |
| Lyra | marksman | Starshot (line) | Constellation Snare (trap) | Orbit Veil (backstep) | Celestial Hunt (global), kept |
| Vex | mage | Volatile Flask (lob) | Caustic Pool (lingering pool) | ★ **Volatile Leap**: a blast at her feet throws her 5 m back and knocks enemies away | ★ **Elixir of Unmaking**: for 5 s her Q has no cooldown and doubles toxin |
| Kaia | mage | Arc Lance (hold to charge) | ★ **Ball Lightning**: a slow orb; recast to blink to it | Static Field (expanding ring, stun) | ★ **Thunderlance**: hold up to 1.5 s, a 20 m piercing line that hits harder the longer it was held |
| Sefu | controller | ★ Sand Lash becomes a line skillshot that roots | Quicksand (circle, slow then root) | ★ **Burrow**: tunnels up to 7 m underground (untargetable on the way), surfaces with a small knock-up | ★ **Dune Surge**: a sand wave rolls 12 m down the aim, carries the enemy to its end and roots it |
| Nyx | assassin | Umbral Blink (dash strike) | ★ **Shadow Swap**: throws a shadow dagger; recast within 3 s to swap places with it (or with the enemy it hit) | Night Shroud (fan, stealth in v2) | ★ **Shadow Mark**: marks the enemy; 2 s later she appears behind it and strikes for 30% of the damage it took meanwhile |
| Fenna | support | Bloom Lash (click, seeds) | Overgrowth (leash) | Verdant Ward (summon) | ★ **Seed of Rebirth**: for 5 s, a hit that would drop her under 15% HP blooms her back up by 35% instead |
| Auriel | support | Radiant Spear (line, shield) | Aegis Wall (delayed dome, stun) | ★ **Radiant Parry**: for 0.8 s the next hit is parried: no damage, and the attacker is stunned 1 s | ★ **Dawn Descent**: leaps up to 12 m (untargetable while airborne) and lands on a 2.5 m spot with a stun and a shield |
| Marin | controller | ★ Tide Whip becomes a skillshot **hook** (pulls 3.5 m) | ★ **Bubble Prison**: a slow bubble skillshot; the enemy floats inside for 1 s and drifts 2 m toward her | Undertow Dance (surf dash, trail) | Leviathan's Waltz (line), kept |
| Zephyr | bruiser | Gale Edge (melee cone) | Tailwind Rush (dash, knock-up) | ★ **Wind Barrier**: a 5 m wall of wind for 3 s that destroys enemy projectiles | Drifting cyclone (v2: the ultimate moves with him) |
| Mortis | summoner | Bone Spear (line) | Grave Call (summon) | Ossuary Ward (cage, root) | ★ **Bone Colossus**: one giant skeleton (big HP, stomps) that the enemy has to deal with |
| Ada | summoner | Rivet Shot (line) | Cog Turret (summon) | Gear Field (slow pulses) | ★ **Mag Rail**: a rail shot fires from her **and from each turret**, crossing lines aimed at the enemy |
| Sirix | bruiser | Mandible Rend (melee cone) | Swarm Leap (dash, wasps) | ★ **Molt**: leaves his shell standing (it takes the next hit) and skitters 4 m away | ★ **Infest**: a parasite on the enemy bursts after 3 s into three wasps |
| Cantor | support | Discordant Note (line, second beat) | ★ **Lullaby**: a slow note skillshot that slows, then stuns 1 s later | ★ **Resonant Step**: rides a sound wave 4 m and heals 30 | ★ **Echoing Verse**: for 6 s his next 3 spells are cast twice |
| Opaline | marksman | Prism Bolt (line, splits) | ★ **Refracted Ray**: a beam that reflects off the first wall or pillar it touches (bank shot), blinds | Mirror Shell (blink, shield) | Spectrum Lance (channel beam), kept |
| Oblivion | tank | Rift Cleave (melee cone, pull) | ★ **Null Tether**: a skillshot that latches on; if the enemy is still within 7 m after 1.5 s it is dragged to him | Void Mantle (swallows a spell) | ★ **Unmake**: casts back the last enemy spell he swallowed (else a void rift line) |
| Shiori | summoner | Brushstroke (line, splits) | ★ **Ink Double**: dashes 4 m back; an ink double stays 3 s and repeats her next Q from its spot | Paper Familiars (summon) | ★ **Final Calligraphy**: one giant brushstroke that **curves**; it bends round pillars, blinds what it hits |
| Tempo | controller | Second Hand (boomerang) | Stopped Moment (circle, timelock) | ★ **Quickstep**: dash 5 m, his cooldowns run twice as fast for 2 s | ★ **Unwind**: back to where he stood 2.5 s ago, with the HP he had then; both spots burst |

Counted: 16 Rs, 8 Ws and 7 Es are new shapes, and 4 Qs become skillshots (second pass, 2026-11-03: the user asked
to remake more, so the circle Ws and self-burst Es were cut too). Tempo's old twist (recast Rewind) goes with Rewind:
Quickstep has 2 charges instead. No R is a big circle; Lyra's global
(3 m landing) and Auriel's landing (2.5 m) are the only circles left in the R column.

## New engine pieces, cost and what each touches

Every hero's change sits on one of these. "Net" means the online duel (`src/game/match.ts`, server relay); every new
cast still has to land its hits within 4.2 s of the cast, or the duel drops them.

| # | Piece | Cost | Who | Touches |
|---|---|---|---|---|
| 1 | **Recast mark**: mark on cast, track damage on the target, recast or timeout to strike | S, the recast window already exists in traits | Vesper R, Nyx R, Sirix R, Kaia W | traits, duel hit tally; net: the relayed cast plus a recast flag |
| 2 | **Hold to charge on any slot** (only Kaia's Q has it now) | S | Kaia R | heroMode, touch.ts (hold the button), AI |
| 3 | **State ultimates**: for N s cooldowns or casts change | S, through `castRules` | Vex R, Cantor R, Tempo E | traits; AI casts them when the enemy is in range |
| 4 | **Cheat death**: a damage-taken hook that floors HP and heals | S, through `taken()` | Fenna R | traits; net: the heal message exists |
| 5 | **HP and position rewind**: a 2.5 s history of position and HP, then jump back | M | Tempo R | traits read HP; net: the other screen must snap, not glide (peer smoothing) |
| 6 | **Skillshot hook** (pull on a projectile hit) | S, pull exists | Marin Q | projectile hit options |
| 7 | **Line skillshots** for old click targets | S each | Vesper Q, Brannoc Q, Sefu Q | the effects get a projectile instead of the instant hit |
| 8 | **Charge and carry, wall slam** | M | Brannoc R | moveCaster plus displace, obstacle test at the end |
| 9 | **Moving wave that carries** | M | Sefu R | displace over time |
| 10 | **Tether that snaps** | M | Oblivion W | a distance check 1.5 s later |
| 11 | **Big summon** | S, summons exist | Mortis R | summon options (HP, size, stomp) |
| 12 | **Multi-origin shot** (from each turret) | S | Ada R | summon positions as projectile origins |
| 13 | **Terrain wall** that blocks walking and sight | M, obstacles are already mutable (breakable walls) | Isolde R | arena.obstacles add and remove; both screens build it from the relayed cast |
| 14 | **Projectile wall** | M | Zephyr E | projectile system; online the victim's client decides hits, check where the remote bolts fly |
| 15 | **Bank shot** off obstacles | M | Opaline W | projectile reflection on a capsule; the aim line has to show the bounce |
| 16 | **Curving projectile** | M | Shiori R | ProjectileOptions curve; the aim shows an arc (the cursor sets where it bends to); touch needs an arc aim |
| 17 | **Spell steal** | L | Oblivion R | the swallow keeps the enemy spell's label; `castAs` already plays any effect for a given caster |
| 18 | **Untargetable leap** | M | Auriel R | moveCaster with an untargetable flag |

Every new shape also needs a duel AI rule (when to cast it) and a tooltip; most need new motion in the VFX, while
the art (meshes, palettes) stays.

## Build order

1. **Engine pieces for the play-test**: 1 recast mark, 2 charge on any slot, 5 rewind, 13 terrain wall, 16 curve.
2. **Play-test 5 flagship heroes** (one per new kind of counterplay), offline and in a two-window online duel:
   - Tempo (Unwind)
   - Kaia (Thunderlance and Ball Lightning)
   - Isolde (Glacier Wall)
   - Shiori (curving R)
   - Brannoc (Forge Charge)

   The user plays them and says yes or no before the other 15.
3. **The other 15 heroes**, in three batches of five, with a tournament after each (target 40–60% win rate) and the
   v2 passives and riders folded in where they fit.
4. **Phone**: hold-to-charge and the curve aim need a touch design (`src/touch.ts`); checked on a phone each batch.

## Open questions for the user

1. Is the roster table right? Swap any ★ you dislike before the build.
2. Keep v2's passives and twists (built with this), or only the shapes for now?
3. Lyra, Marin's R and Opaline's R keep their current ultimates (global, line, channel). Change them too?
