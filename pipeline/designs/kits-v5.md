---
title: Kits v5, all 20 heroes revised against the League checklist
tags: [design, heroes, kits, passives, counterplay]
updated: 2026-11-04
status: design, being built
---

# Kits v5: all 20 heroes (2026-11-04)

The user asked for this: "All kits should be remade", after the League research
([league-kit-design.md](../../docs/knowledge/league-kit-design.md)). v5 replaces [kits-v4.md](kits-v4.md). Every kit below was
gone through against that doc's 35-question checklist and its verdict table. A second reader then recomputed every counterplay line
against the code, and this version carries those corrections.

Decisions the user made for this design (2026-11-04):
- **Nyx loses full invisibility.** She stays a shadow stalker, but the opponent can always find her.
- **Vex is renamed Vitriol.** League has a champion called Vex. Only the shown name changes.
- Each hero keeps their look, theme and role, because the models and effect art are built around them.

The kits take principles from League, never its champions. No kit, spell name or character comes from League. Auriel's v4 kit had drifted
close to one League champion, so its mark and its shield were changed and its spells renamed.

## The rules every kit follows

1. **Answers first.** Every counterplay line is checked with the numbers below before it is written down. If the numbers fail,
   the spell changes, not the line.
2. **The strongest button has a moment to read.** No R lands the moment it is cast. Each one has a delay, a channel, a wind-up or
   a warning the opponent can act on.
3. **Everything is visible to both players.** Any stack, mark, pile, timer, armed attack or stance shows on the hero or on the ground, on both
   screens. The owner's HUD is not enough.
4. **A second decision on every kit.** A recast, a refund, a hold, or one resource with two exits, so a miss costs more than a
   short timer.
5. **A ladder of time.** Each kit has a named rhythm tool (3-5 s), commit tools (9-14 s) and one turning point (22-25 s). The rhythm tool
   need not be Q.
6. **Cannot be hit stays scarce.** Only three basic spells keep a window (Zephyr W 0.6 s, Tempo E 0.6 s, Marin E 0.25 s), each paid for.
7. **Locks stay short.** New engine rule: stuns, knock-ups and roots in a row count as one lock, and one lock lasts at most 1.5 s.
8. **Pulls only where pulling is the hero's verb.** Brannoc, Marin, Mortis, Oblivion, Kaia, Sefu. Cover stops a pull that needs sight.
9. **Heals can be denied.** Only Vesper and Fenna heal, within the limits in [kit-common.md](kit-common.md): 15 per spell, 50 on an R.
10. **Each kit has a written weakness** that any hero can use, with or without range, a stun or a silence, and it falls short of a lost match.
11. **A recast cannot hit the moment it opens.** Where a recast would make the first cast's answer false, it arms late.

## How the counterplay numbers were run

| Value | Number | Source |
|---|---:|---|
| Walker speed | 4 m/s | The default hero. Slower heroes (3.6-3.9) get a smaller margin |
| Slowed walker | 2.4 m/s | `SLOW_FACTOR` 0.6 |
| Reaction time | 0.25 s | An assumption, not a measurement. Only a person can test it |
| Body radius against a bolt | 0.5 m | `BODY_RADIUS` in projectile.ts |
| Circle hit test | hero's centre inside the radius | How zone spells judge a hit |

**A bolt** can be stepped off when `wind-up + distance / speed` is at least `0.25 + (bolt radius + 0.5) / 4`. For a bolt of radius
0.35 that is 0.46 s. Budget for every skillshot in v5: it reaches 6 m no sooner than **0.5 s** after the cast starts. Inside about
5 m a bolt becomes hard to dodge. That is the reward for standing close and the price of being close.

**A circle** can be left from its centre when its delay is at least `0.25 + radius / 4`. A slowed target cannot leave most of them in time,
so landing a slow first is how a player earns a hit. That is intended.

## Damage budget

These start from the numbers the five built kits reached after their balance passes, so the first run needs smaller changes. AI
duels tune them afterwards, as in every batch. Target: 40-60% wins against a mixed field at Normal. The CPU cannot test counterplay, so a good
score there does not prove that a kit is fair. Checklist question 35, "has a person played it against a person", is still **no** for all 20.

## Table key

- **TGT** click an enemy. **SHOT** a line skillshot. **ZONE** an area on the ground. **SELF** on yourself. **DASH**, **BLINK**, **LEAP**. **HOOK**, **PULL**.
  **TERRAIN** blocks walking. **SUMMON**. **CHANNEL**. **RECAST** a second press. **HOLD**.
- **Cover:** `blocked` a bolt that cover stops. `sight` needs line of sight at the cast. `sight+` also needs it when the spell lands or while it runs, so stepping
  behind cover cancels it. `ignores` goes over or round cover.

---

## The roster

### Vesper, the Crimson Countess (drain juggernaut, ranged attack)
660 HP, 4.0 m/s, attack 5.5 m, 8 per 0.7 s. Theme file `blood`.

- **Question:** how low do I let myself go?
- **Weakness:** cover. Her Q's rip, her E and her R all need sight, and she pays HP for every spell. A hero who fights round a pillar starves her.
- **Passive, Blood Price:** each spell costs 20 HP (R costs 40). Below 45% HP she is **Hungry**: her body burns crimson and her spells heal her for 15% of their damage. Above
  45% she heals nothing, and E's and R's heals only work while she is Hungry. She has to go low to drink, and a burst at the right moment ends her.
- **Visible:** the Hungry glow, the mist on her hands while W's attacks are armed, a blood-drop pip on the needled or cursed enemy.
- **Ladder:** rhythm Q, commit W and E, turning point R.
- **Second decision:** rip the needle now or wait for a better moment (Q recast); dash in for empowered attacks or dash away to live (W).
- **Changed from v4:** healing now has a condition and stays within budget, W's untouchable window and R's drag are gone, E became shorter and can be escaped.

| Key | Spell | Type | CD | What it does | Cover | Counterplay, checked |
|---|---|---|---:|---|---|---|
| Q | Lancet | TGT, RECAST | 4 | A blood needle (7 m): 36, and it stays in the enemy for 3 s. From 1 s on she can recast: she rips it out for 26 more and regains the 20 HP, but only while the enemy is in sight and within 8 m. | sight+ | She must wait 1 s, so you can act. From 6 m you pass 8 m in 0.75 s with reaction, or step behind cover. |
| W | Mist Waltz | DASH | 11 | She flows 5 m as mist. Her next two basic attacks within 3 s reach 1.5 m farther and deal +18. | none | It is 36 damage at most. Keep a pillar between you, because attacks need sight, or trade spells with her. |
| E | Hemocurse | TGT | 12 | A curse (7 m): 25, for 3 s. Each spell the enemy casts costs them 30 HP, and if she is Hungry she heals 15. It breaks at 8 m or without sight. | sight+ | Walk: 8 m is 0.75 s from 6 m with reaction, and she has to follow to keep it. Or step behind cover, or cast and pay. |
| R | Sanguine Feast | TGT, CHANNEL | 24 | She roots herself and drinks (8 m) for 1.6 s: pulses of 35, 35, then 40 plus 20% of their missing HP. If she is Hungry, that third pulse heals her 45. A stun, silence or knock-up ends it. So do cover and 9 m of distance. | sight+ | Walk out of 9 m: from 5 m or farther you beat the third pulse (1.25 s). From 3 m you cannot, so reach cover: 5.4 m of walking fits inside the 1.6 s. |

### Brannoc, the Ashen Smith (tank, melee)
780 HP, 3.6 m/s, attack 2.6 m, 18 per 1.6 s. Theme file `forge`.

- **Question:** which spell gets Tempered?
- **Weakness:** kiting. He is the slowest hero, nothing in his kit makes him faster, and the hook is his only way in. Any hero can walk away from him.
- **Passive, Hot Iron:** his hits add Heat to the enemy (3 at most, 5 s), shown as pips over them. His next spell on a 3-Heat enemy is Tempered: it gets its
  bonus and clears the Heat.
- **Visible:** Heat pips on the enemy, the hammer glowing while the slam is armed, the Molten Core glow on him.
- **Ladder:** rhythm E, commit Q and W, turning point R.
- **Second decision:** which spell to Temper; when to Quench (R recast).
- **Changed from v4:** Forge Roar gives no speed, so "kite him" is true. R has a recast. E is his rhythm tool, not Q.

| Key | Spell | Type | CD | What it does | Cover | Counterplay, checked |
|---|---|---|---:|---|---|---|
| Q | Chain Hammer | HOOK, PULL | 9 | A hammer on a chain (9 m, 18 m/s, 0.3 s wind-up): 40, dragged 4 m to him and slowed 1 s. Tempered: also stunned 0.75 s. | blocked | Sidestep it: it reaches 6 m at 0.63 s, and you need 0.49 s. |
| W | Forge Roar | SELF | 11 | For 3 s: +30% armour. His next basic attack in that time is a slam: +35, a 0.5 s knock-up, 2 Heat. Tempered: a 0.8 s knock-up. | none | Kite him for 3 s. You walk 4.0 m/s against his 3.6, so the gap grows. |
| E | Red-Hot Rivet | TGT | 4 | He flicks a rivet (6 m): 25, then 12 burn over 2 s, and 2 Heat. Tempered: the enemy takes 20% more from him for 3 s. | sight | Stay past 6 m, or break sight. He walks slower than you, so this holds. |
| R | Molten Core | SELF, RECAST | 24 | For 6 s his chest cracks open: immune to slows, roots and knock-ups, and every basic attack sprays a 3 m cone: +25, +1 Heat. Recast to Quench: he plants himself, a 3 m ring shows for 0.6 s, then it bursts for 30 plus 10 per second left. Tempered: also stunned 0.75 s. | none | He is no faster: walk away, and the gap grows 0.4 m/s. Out of a Quench: from 1.6 m or farther, 0.6 s is enough. |

### Isolde, the Winter Warden (controller, ranged attack)
570 HP, 3.9 m/s, attack 8 m, 12 per 1.4 s. Theme file `frost`.

- **Question:** freeze them now, or shatter them for more?
- **Weakness:** no dash and a slow start. A hero who dodges the icicle and keeps behind cover carries no Chill, so her R does little.
- **Passive, Deep Winter:** her hits add Chill (5 at most, 4 s), shown as snowflake pips. At 3 or more the enemy is slowed. With 5 on the enemy, her next hit freezes them: stunned 0.9 s, the Chill
  clears, and that hit deals +30%. A frozen enemy gains no Chill until the freeze ends.
- **Visible:** snowflake pips on the enemy, the armour shell on her, the icicle in the ground.
- **Ladder:** rhythm Q, commit W and E, turning point R.
- **Second decision:** at 5 Chill, any spell freezes; R spends the Chill for burst instead. Q has a recast.
- **Changed from v4:** a frozen enemy holds no Chill, so R on them is weak and there is no freeze-into-R lock.

| Key | Spell | Type | CD | What it does | Cover | Counterplay, checked |
|---|---|---|---:|---|---|---|
| Q | Icicle | SHOT, RECAST | 4 | A piercing icicle (11 m, 22 m/s, 0.3 s wind-up): 42, 2 Chill. It sticks in the ground at the end of its flight for 2 s; from 0.8 s after it sticks she can recast to shatter it: 26 and 1 Chill within 2 m. | blocked | Sidestep: it reaches 6 m at 0.57 s. Keep 2 m from where it stuck: 0.75 s to clear, and it arms at 0.8 s. |
| W | Hoarfrost | TGT | 9 | Frost bites the enemy (8 m): 36, 2 Chill. | sight | Stay past 8 m, or break sight. |
| E | Rime Armour | SELF | 12 | For 3 s: +40% armour, and every basic attack that hits her gives the attacker 2 Chill. | none | Use spells on her instead of basic attacks. |
| R | Winter's Shatter | TGT | 22 | She closes her fist (9 m). 0.8 s later the Chill shatters if she still has sight: 50 plus 30 per Chill (200 at 5). | sight+ | Keep your Chill low: the pips show what it would deal. Or reach cover: 2.2 m in the 0.8 s, or 1.3 m if slowed. |

### Lyra, the Star Archer (marksman, ranged attack, built)
520 HP, 4.0 m/s, attack 8.5 m, 12 per 1.4 s. Theme file `astral`.

- **Question:** how long do I hold the draw?
- **Weakness:** close range. Her bonus damage is gone within 4 m, and she has no dash.
- **Passive, Far Sight:** her damage rises with distance, from +0% within 4 m to +30% at 10 m. A full-draw hit also takes 3 s off Pinning Arrow.
- **Visible:** the bow and hold on her, the star tracking the enemy, the orbiting stars of W, the fixed circle.
- **Ladder:** rhythm Q, commit E and W, turning point R.
- **Second decision:** hold or loose (Q). A long draw pays twice when it lands.
- **Changed from v4:** Meteor Mark can be walked out of now. Pinning Arrow flies slower so it can be sidestepped.

| Key | Spell | Type | CD | What it does | Cover | Counterplay, checked |
|---|---|---|---:|---|---|---|
| Q | Starfall Arrow | HOLD, SHOT | 4 | Hold up to 1 s: range 9 to 14 m, damage 29 to 58. Full draw pierces. | blocked | Sidestep: it reaches 6 m at 0.53 s, and you need 0.46 s. Or close in. |
| W | Twin Stars | SELF | 14 | For 5 s her basic attacks loose two arrows (the second at half damage), and she moves 20% faster. | none | Keep cover between you: arrows need sight. It only adds to her basic attack, so a spell trade still favours you up close. |
| E | Pinning Arrow | SHOT | 9 | An arrow (9 m, 24 m/s, 0.3 s wind-up): 35. Within 1.5 m of a wall or pillar the enemy is rooted 1.5 s; elsewhere slowed 1.5 s. | blocked | Fight away from walls. Sidestep: it reaches 6 m at 0.55 s. |
| R | Meteor Mark | TGT, delayed | 24 | A star tracks the enemy (14 m) for 1.5 s, then fixes on their spot. 0.9 s later a meteor strikes it (1.8 m): 120 plus 25% of what she dealt them meanwhile. | sight, then ignores | Walk out when it fixes: 1.8 m takes 0.45 s plus 0.25 s, 0.70 s in all, and you have 0.9 s. A slowed target needs 1.0 s and is caught. |

### Vitriol, the Plague Alchemist (mage, ranged attack, built)
510 HP, 4.0 m/s, attack 6.5 m, 9 per 1.0 s. Theme file `alchemy`. Renamed from Vex.

- **Question:** which reaction do I want this time?
- **Weakness:** being rushed after her E is spent. She has no dash and the lowest damage until a reaction goes off.
- **Passive, Reaction:** each spell leaves a reagent on the enemy for 4 s: green (Q), orange (W), violet (E). A second, different reagent sets off a reaction and clears both, and the
  reaction takes 2 s off the spell that took no part.
  - green + orange, **Combust:** 34 at once.
  - green + violet, **Corrode:** the enemy takes 35% more for 3 s.
  - orange + violet, **Concussion:** moved 2.5 m away (a pull, so it is the same for a player and the CPU) and a 0.5 s silence.
- **Visible:** reagent pips on the enemy, and they last exactly as long as the reagent does.
- **Ladder:** rhythm Q, commit W and E, turning point R.
- **Second decision:** which second reagent, because it changes both the effect and which spell comes back sooner.
- **Changed from v4:** reagents are visible, Corrode can compete with Combust (20% to 35%), Concussion moves a player as far as it moves the CPU, and the homunculus starts at her feet.

| Key | Spell | Type | CD | What it does | Cover | Counterplay, checked |
|---|---|---|---:|---|---|---|
| Q | Toxin Dart | SHOT | 3 | A dart (9 m, 20 m/s, 0.25 s wind-up): damage now and a poison over 3 s. Green. | blocked | Sidestep: it reaches 6 m at 0.55 s. |
| W | Fire Vial | TGT | 6 | A tossed vial that always hits (7 m): damage now and a burn over 2 s. Orange. | sight | Stay past 7 m, or break sight. |
| E | Acid Splash | ZONE (cone) | 8 | A 4 m cone: damage and a shove. Violet. Her answer to being rushed. | ignores | Bait it: step in and out of 4 m, then commit once it is spent. It is back in 8 s, or 6 s after a reaction. |
| R | Homunculus | SUMMON | 25 | A homunculus (120 HP) climbs out at her feet and waddles at the enemy (4 m/s, up to 3.7 s). It bursts on contact (2 m): damage and all three reagents, so the reactions go off at once. | ignores | Hit it (120 HP is about three spells), or walk away: it never gains on a 4 m/s walker. |

Spell damage stays as tuned in [kit-alchemy.md](kit-alchemy.md) until the balance run.

### Kaia, the Tempest Caller (mage, ranged attack)
580 HP, 4.0 m/s, attack 6 m, 10 per 1.0 s. Theme file `storm`.

- **Question:** build a net of rods, or spend them now?
- **Weakness:** the enemy can ground her rods by touching them, and away from rods she deals plain damage.
- **Passive, Lightning Rods:** her spells plant rods where they land (3 at most, 6 s each). When she damages the enemy with a spell, every rod within 5 m of them arcs to them for 18, and **an arc uses up that rod**. An
  enemy who touches a rod (within 1 m) grounds it.
- **Visible:** rods stand on the ground on both screens, and each shows a 5 m ring as the enemy nears. A magnet mark over the enemy during Polarity.
- **Ladder:** rhythm Q, commit W and E, turning point R.
- **Second decision:** a rod spent now is a rod that cannot catch them with Polarity later; W can be fired early.
- **Changed from v4:** rods can be removed and are spent, Sky Strike's rod lands short so it survives, and R's bolts now show where they land.

| Key | Spell | Type | CD | What it does | Cover | Counterplay, checked |
|---|---|---|---:|---|---|---|
| Q | Sky Strike | TGT | 4 | A strike falls on the enemy (7 m) 0.35 s later: 60, and a rod 1.5 m in front of them, toward her. | sight | Stay past 7 m, or break sight. Then touch the rod: it takes 0.13 s of walking. |
| W | Thunder Rod | ZONE, RECAST | 9 | A great rod at a spot (9 m) for 3 s. Each second from 1.2 s on, enemies within 3.5 m take 24 and are slowed. From 1.2 s she can recast: it fires once for 50 and is gone. | ignores | Leave the circle: 3.5 m from the centre takes 1.13 s, before anything can land at 1.2 s. |
| E | Polarity | TGT, PULL | 11 | She magnetises the enemy (8 m): 20, then after 1 s they are yanked 3 m toward her nearest rod (toward her if there are none). If they end within 1 m of it they are stunned 0.6 s. | sight | Walk away from the rod: in the 0.75 s after you react you cover 3 m, so the yank only brings you back. Rods land at least 1.5 m away, so you are never within 1 m. |
| R | Supercell | SELF | 24 | A storm over her for 6 s. Every 0.8 s, if the enemy is within 7 m of her or 3 m of a rod, a bolt marks their spot (1.2 m) and falls 0.6 s later: 32. Rods arc as normal. | ignores | Keep moving: 1.2 m takes 0.55 s with reaction, inside the 0.6 s. Standing still takes every bolt. |

### Sefu, the Dune Sovereign (controller, ranged attack)
620 HP, 4.0 m/s, attack 5.5 m, 9 per 0.7 s. Theme file `sand`.

- **Question:** when do I Judge them, and can I keep them Judged?
- **Weakness:** cover. His crook needs sight, and it is his only way to Judge you before his R. Fight round a pillar and his damage stays low.
- **Passive, Pharaoh's Decree:** an enemy he pulls or seals is **Judged** for 3 s: a gold ankh over their head. A Judged enemy takes 20% more from him, and their dashes, blinks and leaps go half as far. A hit with Cobra Spit on a Judged
  enemy halves its cooldown.
- **Visible:** the ankh on the enemy, and the circle under the Sarcophagus.
- **Ladder:** rhythm Q, commit W and E, turning point R.
- **Second decision:** spend the crook to Judge first, or keep it to pull a fleeing target. Judged gives Q a faster rhythm.
- **Changed from v4:** R is aimed at a spot and can be dodged, and its root is gone. E lost its untouchable window. Judged shortens dashes instead of switching a dash hero off.

| Key | Spell | Type | CD | What it does | Cover | Counterplay, checked |
|---|---|---|---:|---|---|---|
| Q | Cobra Spit | SHOT | 5 | Venom (9 m, 20 m/s, 0.25 s wind-up): 62, and blinded 1.2 s. Half cooldown if the target was Judged. | blocked | Sidestep: it reaches 6 m at 0.55 s. |
| W | Shepherd's Crook | TGT, PULL | 10 | He hooks the enemy's neck (6 m) and pulls them 3 m: 35 and slowed 0.5 s. Judged. | sight | Stay past 6 m, or break sight. |
| E | Scarab Stride | DASH | 12 | He skitters 6 m as scarabs in 0.5 s. Running through the enemy bites them: 30, then 30 poison over 2 s. | none | The dash line is shown when it starts: step off it. Half a metre is enough in the 0.5 s. |
| R | Sarcophagus | ZONE at the enemy | 24 | A gold sarcophagus forms at the enemy's spot (9 m). 0.7 s later, if they are still inside 1.6 m, it shuts: sealed 1.2 s, unable to act and unable to be hit. When it opens scarabs burst out: 110. Judged. | sight, then ignores | Step out: 1.6 m takes 0.40 s plus 0.25 s, 0.65 s in all, inside the 0.7 s. It is tight. Straight after the crook's slow you reach only 1.4 m and are caught. |

### Nyx, the Umbral Stalker (assassin, melee)
610 HP, 4.6 m/s, attack 1.9 m, 9 per 0.7 s. Theme file `shadow`.

- **Question:** strike now, or fade for more?
- **Weakness:** the open middle of the arena. She fades slowly away from cover, and any hero can choose to fight in the open.
- **Passive, Umbral Veil:** after 2.5 s without dealing or taking damage she **fades**, or after 1.2 s within 2 m of cover. Faded, she is a dark see-through figure with a clear outline, visible to both players at any range, and
  10% faster. Her first hit out of the veil deals +50% and takes 3 s off Shadow Double. It also silences 0.6 s, at most once per 5 s. She can still be targeted.
- **Visible:** the faded look itself, on both screens. No part of her is ever hidden.
- **Ladder:** rhythm Q, commit E and W, turning point R.
- **Second decision:** fight now for steady damage, or back off to cover to fade.
- **Changed from v4:** no invisibility and no blanking of targeted spells. This removes the costliest engine piece. The facing line now uses a control that exists.

| Key | Spell | Type | CD | What it does | Cover | Counterplay, checked |
|---|---|---|---:|---|---|---|
| Q | Umbral Cut | TGT | 4 | A 0.35 s wind-up, then a dagger strike (2.5 m): 50, 80 if she is behind the enemy (their back 120°) when it lands. | sight | Walk a step toward her in the wind-up: 0.25 s to react and 0.08 s for the body to turn, 0.33 s in all. Running in a straight line gives her your back. |
| W | Smoke Veil | ZONE | 12 | A 3 m smoke cloud for 3 s at her feet. Inside it she counts as faded even mid-fight, and an enemy inside is blinded. | ignores | Leave the smoke: 1.0 s at worst from its centre. Blind makes aimed spells land off target, so use a self spell or a basic attack until you are out. |
| E | Shadow Double | DASH, SUMMON | 10 | She darts 4 m, through cover if the line crosses it. A shadow copy (40 HP, 2.5 s, 15 per 0.9 s) stays and walks at the enemy. | ignores | The copy has no ground ring, and one spell kills it. Do not spend your biggest spell on it. |
| R | Nightfall | SELF | 24 | The arena darkens for 5 s. She fades again 0.8 s after each hit she lands, moves 25% faster and deals 20% more. Her outline burns brighter in the dark. When it ends she is slowed 1 s. | none | She still takes full damage and has to reach you: hit her as she arrives. Back to a wall, she can only come from one side. Hit her hardest in the slow at the end. |

### Fenna, the Grove Warden (support, ranged attack)
600 HP, 4.0 m/s, attack 5.5 m, 10 per 0.7 s. Theme file `grove`.

- **Question:** where do I plant, and do I stay or glide?
- **Weakness:** away from her garden she has low damage and no healing. Every flower can be trampled.
- **Passive, Living Garden:** her spells plant a flower where they land (4 at most, 7 s each). Within 3 m of flowers she heals 3 HP a second per flower (2 flowers count), 4 near her tree. An enemy within 1.5 m of a flower is slowed. An enemy standing on a
  flower for 0.6 s tramples it.
- **Visible:** flowers on the ground, on both screens.
- **Ladder:** rhythm Q, commit W and E, turning point R.
- **Second decision:** aim the seed at the enemy for damage, or short for a safe flower. Keep the tree as a wall, or uproot it for a burst.
- **Changed from v4:** healing cut from up to 73 HP/s to at most 6, every point of it can be denied, E no longer heals, and the tree has no heal of its own.

| Key | Spell | Type | CD | What it does | Cover | Counterplay, checked |
|---|---|---|---:|---|---|---|
| Q | Seed Shot | SHOT | 4 | A seed (9 m, 20 m/s, 0.25 s wind-up): 64. A flower grows where it stops. | blocked | Sidestep: it reaches 6 m at 0.55 s. Then trample the flower: 0.6 s standing on it. |
| W | Strangle Vine | TGT | 11 | Vines (7 m): 40 and rooted 1.0 s, or 1.4 s if the enemy is within 3 m of a flower. | sight | Stay past 7 m, or break sight. Fight away from her flowers. |
| E | Pollen Glide | DASH | 12 | She glides 6 m on a pollen gust, and a flower grows where she lands. | none | Chase her once she lands, and trample what she planted. |
| R | World Tree | TERRAIN, RECAST | 24 | A tree bursts up at a spot (9 m) after 1.2 s for 8 s. It blocks walking and bolts, roots an enemy within 3 m as it sprouts for 1 s, and her flowers within 6 m heal 4 HP a second each instead of 3. Recast: Uproot, the tree ends after a 0.6 s warning in a 3 m burst of thorns: 60. | ignores | Step out: 3 m takes 0.75 s plus 0.25 s, inside the 1.2 s, and a 3.6 m/s hero makes it too. Then fight her away from the tree, or trample its flowers. |

### Auriel, the Dawn Paladin (support, ranged attack)
550 HP, 3.9 m/s, attack 5.5 m, 8 per 0.7 s. Theme file `dawn`.

- **Question:** do I let the shield run, or pop it now? And for the opponent: do I break it, and from where?
- **Weakness:** every threat she has is a burst you can walk away from. She has no dash and a 5.5 m attack, and she walks slower than you.
- **Passive, Oath of Dawn:** when one of her shields breaks or runs out, it bursts in light (3 m) for about 60% of its size.
- **Visible:** the shield bubble, the burst ring, the brand over the enemy.
- **Ladder:** rhythm Q, commit W and E, turning point R.
- **Second decision:** W and R both pop early when pressed again. E lets a burst stun, so when she pops matters.
- **Changed from v4:** R is the shield verb at its largest, not a reflect stance. The answer is no longer "stop hitting her for 5 s". The mark and its stun changed, and the spells were renamed, to move away from a League champion's kit. The old `shieldMul` of 1.3 is gone.

| Key | Spell | Type | CD | What it does | Cover | Counterplay, checked |
|---|---|---|---:|---|---|---|
| Q | First Light | ZONE (cone) | 4 | A wave of light in a 6 m cone: 40. Hitting the enemy gives her a 14 shield for 3 s, but not while Dawnward or Sunrise holds. | ignores | Stay out of 6 m: she walks 3.9 against your 4.0. |
| W | Dawnward | SELF, RECAST | 9 | A 45 shield for 3 s. While it holds, her basic attacks reach 3 m farther. Recast: pop it now. It cannot be cast while Sunrise holds. | none | Stay past 3 m when it pops: the burst is 27. Break it, or let it run, from there. |
| E | Oathbrand | TGT, delayed | 11 | A beam falls on the enemy (7 m) 0.5 s later if she still has sight: 44, and branded for 2.5 s. A burst that catches a branded enemy also stuns them 0.8 s. | sight+ | While branded, keep 3 m from her, or 5 m if Sunrise is up. The brand shows over you. From 5.6 m or less it takes 0.25 s to react and walking to clear. |
| R | Sunrise | SELF, RECAST | 24 | A 130 shield for 5 s, and she floats. When it breaks, runs out or she recasts, a 5 m ring appears fixed at her spot, closes for 1.6 s and bursts for 80. | none | Walk out of the ring: at most 1.25 s plus 0.25 s, inside the 1.6 s, and it does not follow her. |

### Marin, the Tide Dancer (controller, ranged attack, built)
610 HP, 4.1 m/s, attack 6.5 m, 10 per 0.7 s. Theme file `tide`.

- **Question:** do I spend my escape to turn the tide?
- **Weakness:** after Mist Form she has no way out for 10 s, and the tide she chose can be read by anyone. Walk toward her at Low tide and her spells have no drag left to give.
- **Passive, Turning Tide:** the tide turns every 8 s. At High tide her spells push the enemy away; at Low tide they pull the enemy to her. A ring at her feet always shows the tide and the time left, on both screens.
- **Visible:** the tide ring, always on.
- **Ladder:** rhythm Q, commit W and E, turning point R.
- **Second decision:** Mist Form flips the tide when she reforms. It is her only dash, so she pays for the choice with her way out.
- **Changed from v4:** she now chooses the tide. Moon's Pull became a channel that can be broken and walked against, so nothing lands from across the arena with no warning.

| Key | Spell | Type | CD | What it does | Cover | Counterplay, checked |
|---|---|---|---:|---|---|---|
| Q | Wave Disc | SHOT | 4 | A spinning disc (9 m, 20 m/s, 0.3 s wind-up, radius 0.8): damage. High tide: pushes 2.5 m. Low tide: pulls 2.5 m. | blocked | Sidestep: it reaches 6 m at 0.60 s, and you need 0.58 s. Read the ring to know which way you will go. |
| W | Coral Spire | TERRAIN | 9 | A coral pillar rises at a spot (8 m) after 0.9 s for 5 s. As it rises, High tide shoves enemies within 2.5 m away; Low tide drags them 2 m to it. | ignores | Keep off the telegraphed spot: 2.5 m takes 0.88 s from the centre. |
| E | Mist Form | DASH | 10 | She runs 6 m as water, untouchable for its 0.25 s, then reforms with a splash: damage. The tide flips. | none | The ring shows the new tide at once, so plan for it. She has no escape for the next 10 s. |
| R | Moon's Pull | SELF, CHANNEL | 24 | She roots herself under a moon for 3 s. An enemy within 12 m she can see is dragged toward her at 2.4 m/s and takes 24 a second. If they are within 2.5 m when it ends, the tide crashes: 110. A stun, silence or knock-up ends it. Her Wave Disc still works, and its pull is 4 m during this. | sight+ | Walk against the pull: 4.0 less 2.4 is 1.6 m/s away, so the crash misses unless her disc catches you. Or step behind cover: the drag stops there. |

### Zephyr, the Wind Blade (assassin, melee, built)
620 HP, 4.6 m/s, attack 2.4 m, 7 per 0.9 s. Theme file `sky`.

- **Question:** bank a Gust for Sky Rend, or spend it on a strike?
- **Weakness:** low HP for a melee hero. He has to come to you, and once his dashes are spent he has no way out.
- **Passive, Following Wind:** every dash gives him a Gust (3 at most, 4 s), shown as pips round him. A dash resets his basic attack. A basic attack spends a Gust for +20 damage and 1 m more reach.
- **Visible:** Gust pips and step charges on both screens, the mark during Sky Rend's wind-up.
- **Ladder:** rhythm Q, commit W and E, turning point R.
- **Second decision:** every Gust is either a strike now or two more cuts on Sky Rend.
- **Changed from v4:** Sky Rend now scales with Gusts, has a real wind-up, and no bonus on airborne targets. Feather Step lost its untouchable window. Skyward's air time and circle are smaller. HP 690 to 620.

| Key | Spell | Type | CD | What it does | Cover | Counterplay, checked |
|---|---|---|---:|---|---|---|
| Q | Crosswind | ZONE (cone), RECAST | 4 | A 3 m cross-cut: 34. Recast within 2 s: a 3 m dash-slash. | ignores | Step out of the strip when you see the first cut: the dash only comes after it. |
| W | Skyward | LEAP | 8 | He leaps (untouchable 0.6 s) and lands on a spot within 5 m: damage within 1.4 m and a 0.5 s knock-up. The landing circle shows at take-off. | none | Leave the circle: 0.60 s with reaction, exactly the air time. It is tight, and it is his main reward. |
| E | Feather Step | DASH | 7, 2 charges | A 4 m step. | none | His charges show as pips. Save your best spell for when he has none. |
| R | Sky Rend | TGT, delayed | 24 | He marks the enemy (7 m) for 0.8 s. If he still has sight he vanishes and strikes from all sides: 3 cuts plus 2 per Gust he spends, up to 9, 22 each. He ends behind them and cannot cast for 0.6 s. | sight+ | Read his pips: no Gusts is 66 damage, three is 198. Reach cover in the mark: 2.2 m in the 0.8 s. Hit him in the 0.6 s after. |

### Mortis, the Ossuary Lord (summoner, ranged attack, built)
470 HP, 3.8 m/s, attack 6 m, 10 per 1.0 s. Theme file `bone`.

- **Question:** spend skeletons for armour, or let them die for piles?
- **Weakness:** he is the slowest ranged hero, with low damage while his skeletons are down. Killing skeletons away from his piles starves him.
- **Passive, Ossuary:** every unit that dies leaves a bone pile for 8 s, drawn on the ground for its full life on both screens. His spells use them. Every fifth basic attack raises a small skeleton.
- **Visible:** piles on the ground, always. The armour on him.
- **Ladder:** rhythm Q, commit W and E, turning point R.
- **Second decision:** Bone Armour can be shattered early to fire its shards.
- **Changed from v4:** the fan has real gaps at range, piles are visible, and Grave Grasp now has a warning and a fixed hold.

| Key | Spell | Type | CD | What it does | Cover | Counterplay, checked |
|---|---|---|---:|---|---|---|
| Q | Bone Fan | SHOT (fan) | 5 | Three shards, 18° apart, radius 0.2 (8 m): damage each, plus one shard per pile within 3 m of him (6 at most). The fan widens as it grows. | blocked | Past 5 m stand between two shards: the gap is 0.5 m at 6 m and 1.1 m at 8 m. Inside 4.4 m the fan is a wall: that is his reward for catching you close. |
| W | Raise Dead | SUMMON | 9 | A skeleton claws up at a spot (9 m), plus one for every pile within 4 m of it (3 at most). | ignores | Kill skeletons away from piles. |
| E | Bone Armour | SELF, RECAST | 14 | A shield of 30 plus 30 per living skeleton (120 at most) for 4 s. When it breaks or he recasts it, the shards fly at the enemy (homing, 38). | none | Kill his skeletons first: the shield is smaller with fewer of them. |
| R | Grave Grasp | ZONE at the enemy, PULL | 22 | A hand rises at the enemy's spot (9 m). 0.7 s later, if they are inside 1.6 m, it drags them 4 m to him and roots them 1 s, and two skeletons climb out. | sight, then ignores | Step out: 0.65 s with reaction, inside the 0.7 s. |

### Ada, the Artificer (engineer, ranged attack)
550 HP, 3.9 m/s, attack 6 m, 10 per 1.0 s. Theme file `clockwork`.

- **Question:** stay by my turrets, or leave them to get an angle?
- **Weakness:** rushed before her turrets are up, or after they die. Her R roots her, so it is a target.
- **Passive, Overclock:** her turrets within 5 m of her shoot 30% faster. A ring at her feet shows the 5 m, and a turret inside it glows. That is the whole rule. It decides where she stands.
- **Visible:** the 5 m ring, the turret glow, the tag over the enemy.
- **Ladder:** rhythm Q, commit W and E, turning point R.
- **Second decision:** grapple to a turret or a wall; stay in Siege Mode or pack up early.
- **Changed from v4:** one rule in the passive, no pull on Grapple, and R now raises her turrets, not a mech that ignores them.

| Key | Spell | Type | CD | What it does | Cover | Counterplay, checked |
|---|---|---|---:|---|---|---|
| Q | Homing Drone | TGT | 4 | A drone flies to the enemy (8 m) and always hits: 45. It tags them for 3 s, and her turrets deal 30% more to a tagged enemy. | sight | Stay past 8 m, or break sight. The tag shows over you: fight away from turrets for 3 s. |
| W | Deploy Turret | SUMMON | 2 charges, 10 s each | A turret at a spot (8 m) for 8 s: 80 HP, 9 per 1.4 s, range 8. | ignores | Kill the turrets: two spells each. Or fight out of their reach. |
| E | Grapple | HOOK | 10 | A hook (9 m, 20 m/s, 0.25 s wind-up). On a wall, pillar or her turret, she reels herself to it. On the enemy: 30 and slowed 1 s, and she stays put. | blocked | Sidestep it. If it hits a wall, she has spent her escape, so press her. |
| R | Siege Mode | SELF, RECAST, CHANNEL | 24 | She locks down for 6 s, rooted, with +20% armour. Turrets within 8 m fire twice as fast, and she fires heavy rounds at an enemy within 9 m she can see (23 every 0.8 s). A stun, silence or knock-up ends it. Recast: pack up now. | sight+ | Leave 9 m or step behind cover: she cannot follow. Or kill the turrets and press her. She has no dash while rooted. |

### Sirix, the Swarm Warden (bruiser, melee)
720 HP, 4.0 m/s, attack 2.4 m, 13 per 1.2 s. Theme file `hive`.

- **Question:** spend the swarm now, or hold six?
- **Weakness:** after he spends the swarm he is a plain fighter for seconds. The count shows it, so that is the moment to hit him.
- **Passive, The Swarm:** up to 6 wasps circle him, one per pip. He gains one every 2 s and one per basic attack hit. His spells spend them.
- **Visible:** the wasps themselves, on both screens.
- **Ladder:** rhythm attacks and E, commit Q and W, turning point R.
- **Second decision:** recast Q to leap in, or keep the barb as a threat; spend 2 wasps on the poison or keep them.
- **Changed from v4:** R no longer refills the swarm, which restores his one opening.

| Key | Spell | Type | CD | What it does | Cover | Counterplay, checked |
|---|---|---|---:|---|---|---|
| Q | Barbed Stinger | SHOT, RECAST | 6 | A stinger (8 m, 20 m/s, 0.25 s wind-up): 42, and the barb stays for 3 s. Recast: he leaps onto the barbed enemy: 25. If he has 2 wasps he spends them: 30 poison over 3 s. | blocked | Sidestep: it reaches 6 m at 0.55 s. While barbed, expect the leap: keep your own dash or spell for when he lands. |
| W | Hive Shell | SELF | 10 | +40% armour for 3 s. Each hit he takes sends a wasp at the attacker: 15. | none | It counts hits, not damage: one big spell costs you one wasp, and it costs him a wasp he could have spent. Walk out of his reach if you have nothing big. |
| E | Swarm Cloud | ZONE | 9 | All his wasps fly to a spot (9 m) as a 2.5 m cloud for 3 s. From 1.0 s on: 7 per wasp each second, and blinded inside. | ignores | Leave the cloud: 0.88 s with reaction, before the first tick. Then strike him: his swarm is away. |
| R | Swarm Surge | SHOT (wide) | 22 | He looses every wasp down a 10 m column, 4 m wide (12 m/s, 0.5 s wind-up): 18 per wasp (108 at most), shoved 4 m and blinded 1 s. | ignores | Sidestep: you need 0.88 s, and it reaches 6 m at 1.0 s. Bait it while his swarm is small: the wasps show its damage. |

### Cantor, the Last Verse (support, ranged attack)
680 HP, 4.0 m/s, attack 6 m, 10 per 1.0 s. Theme file `bard`.

- **Question:** cast now, or wait for the beat?
- **Weakness:** any hit of 50 or more breaks his beat, which takes his bonus away, and he has no dash.
- **Passive, On the Beat:** a beat pulses under him every 1.2 s. A spell cast within 0.2 s of a pulse is in tune: +30% effect and 1 s off its cooldown. A stun, a silence or a hit of 50 or more breaks the beat for 2 s.
- **Visible:** the pulse ring under him, a stopped ring when the beat is broken, a glow while E runs.
- **Ladder:** rhythm Q, commit W and E, turning point R.
- **Second decision:** cast now out of tune, or wait up to 1.2 s for more.
- **Changed from v4:** a third of moments are in tune, not half, so reading the beat tells the opponent something. The charm flies and can be blocked. Duet can be escaped before it closes, and it pulses on the beat.

| Key | Spell | Type | CD | What it does | Cover | Counterplay, checked |
|---|---|---|---:|---|---|---|
| Q | Resounding Chord | ZONE (cone) | 3 | A chord in a 5 m cone: 52. In tune: also silenced 0.5 s. | ignores | Stay out of 5 m. Move on his pulse: that is when the good one comes. |
| W | Siren Song | TGT, bolt | 12 | A note flies at the enemy (8 m, 10 m/s). It charms them for 0.8 s (1.1 s in tune): they walk toward him and cannot act. | blocked | Step behind cover as it flies: from 8 m away you reach cover within 2.2 m, from 4 m only 0.6 m. So keep your distance and stay near a pillar. |
| E | Rising Chorus | SELF | 11 | For 3 s, every in-tune spell gives him +25% speed for 1.5 s and a 30 shield. | none | Hit him hard now: 50 damage breaks the beat, and the chorus gives nothing without it. |
| R | Duet | SELF, TERRAIN | 24 | A ring (6 m) closes round him in 0.8 s and holds for 3.4 s. Neither of you can leave it. Each beat it pulses for 18, and in-tune spells inside it also silence 0.5 s. If the enemy is outside when it closes, half its cooldown comes back. He cannot cast it while his charm runs. | ignores | Keep more than 3.8 m from him while R is up, and you can step out in time. Inside, hit him for 50 to break the beat. |

### Opaline, the Lightbreaker (marksman, ranged attack)
600 HP, 4.2 m/s, attack 8.5 m, 15 per 1.4 s. Theme file `prism`.

- **Question:** shoot straight, or bank it?
- **Weakness:** open ground gives her nothing to bounce from, and she has no dash. Any hero can draw her into the open or rush her after Flare is spent.
- **Passive, Prismatic:** her bolts reflect off walls and pillars. Each reflection adds 25% damage and 2 m of range, and a hit after a reflection takes 1 s per reflection off Ricochet Light. Her aim line draws the first bounce, on both screens.
- **Visible:** the bounce line, the crystal, the shard ring.
- **Ladder:** rhythm Q, commit W and E, turning point R.
- **Second decision:** an easy straight shot, or a harder bank shot that pays more and comes back sooner.
- **Changed from v4:** the opponent no longer has to work out the geometry alone, and a bank shot gives a refund.

| Key | Spell | Type | CD | What it does | Cover | Counterplay, checked |
|---|---|---|---:|---|---|---|
| Q | Ricochet Light | SHOT | 3 | A bolt (12 m, 24 m/s, 0.3 s wind-up) that reflects up to twice: 64, +25% per reflection. | reflects | Sidestep: it reaches 6 m at 0.55 s. Cover is not safe, but the line shows you the bounce. |
| W | Crystal | TERRAIN | 12 | A crystal at a spot (8 m) for 6 s, or until 80 damage breaks it. Her bolts reflect off it at any angle, and it blocks the enemy's. | ignores | Break it, or move so it gives her no angle. |
| E | Blinding Flare | ZONE round her | 10 | A flash (3 m): blinded 1.5 s, knocked back 2 m. | ignores | Hover at 3.5 m while it is up: it reaches 3 m. Once it is spent she has nothing close for 10 s. |
| R | Shatterlight | TGT, delayed | 22 | Six shards ring the enemy (10 m, ring 2.5 m) and fire inward after 1.2 s: 36 each. Each reflects once off a wall. | sight, then ignores | Step out: the shards are bolts, so clear 3.35 m along any line: 1.09 s with reaction, inside the 1.2 s. Stay away from walls, because shards come back off them. |

### Oblivion, the Unmaker (juggernaut, melee)
780 HP, 3.8 m/s, attack 2.6 m, 15 per 1.2 s. Theme file `void`.

- **Question:** walk at them, or stand still and let the pull grow?
- **Weakness:** walking, he has no pull and is slower than almost everyone, so any hero can keep away. Standing still, he cannot reach you unless you are close.
- **Passive, Deep Gravity:** while he stands still, a ring grows round him and pulls in any enemy inside it that he can see. After 1 s it is 3 m and 0.4 m/s; each further second adds 1 m and 0.2 m/s, up to 6 m and 1.0 m/s. One step ends it.
- **Visible:** the ring on the ground, growing as he stands, and the void on his fist while E's rip is armed.
- **Ladder:** rhythm Q, commit W and E, turning point R.
- **Second decision:** stand or walk; recast R to collapse the hole early.
- **Changed from v4:** Null Zone stays where he cast it, so you can walk out. The blink is shorter on a long cooldown and has no untouchable window. The passive now asks him a question, and walking gives him no pull.

| Key | Spell | Type | CD | What it does | Cover | Counterplay, checked |
|---|---|---|---:|---|---|---|
| Q | Gravity Slam | SELF (3 m) | 4 | He slams the ground: 60 within 3 m, and enemies there are dragged 1.5 m in. | ignores | Stay out of 3 m. His ring pulls at most 1.0 m/s, and you walk 4. |
| W | Null Zone | ZONE at his feet | 12 | A 3 m sphere for 3 s, fixed where he cast it. Enemies inside cannot cast, and bolts entering it vanish. | ignores | Walk out: at most 3 m at 3 m/s against a full ring, 1.25 s with reaction. Your basic attacks still work. |
| E | Phase Step | BLINK | 14 | He steps 4 m through the void after a 0.25 s mark. His next basic attack within 3 s rips for +40 and weakens the enemy 20% for 2 s. | ignores | Back off for 3 s after the step: he is slower than you. He has no escape for the next 14 s. |
| R | Black Hole | SHOT (slow), RECAST | 24 | A black hole crawls 8 m down his aim (2 m/s, 4 s). It pulls enemies within 5 m at 1.8 m/s; touching its core (1 m) stuns 1 s and deals 105, once. Recast: it collapses now: 85 within 3 m, after a 0.5 s warning. | ignores | Walk sideways off its line: the core only crawls along the line. Walking straight ahead of it barely gains. |

### Shiori, the Last Brush (summoner, ranged attack)
600 HP, 4.1 m/s, attack 6 m, 10 per 1.0 s. Theme file `ink`.

- **Question:** where do my strokes cross?
- **Weakness:** she has little burst until strokes are down, and a hero who keeps to clean ground takes plain damage.
- **Passive, Wet Ink:** her strokes stay on the ground for 5 s. An enemy on wet ink is slowed and Stained (+20% damage from her, shown over them). Where two strokes cross, a point glows and 0.65 s later bursts: 40 within 1.5 m, and it takes 1 s off Ink Lash.
- **Visible:** strokes on the ground, the glowing crossing, the Stain mark.
- **Ladder:** rhythm Q, commit W and E, turning point R.
- **Second decision:** paint now for damage, or paint to set up a crossing.
- **Changed from v4:** R has one clear definition, crossings have a fuse, and they give a refund.

| Key | Spell | Type | CD | What it does | Cover | Counterplay, checked |
|---|---|---|---:|---|---|---|
| Q | Ink Lash | SHOT | 4 | A lash (9 m, 22 m/s, 0.3 s wind-up): 66, and a stroke along its path. | blocked | Sidestep: it reaches 6 m at 0.57 s. Step off the stroke, and off any crossing: 0.63 s with reaction, inside the 0.65 s fuse. |
| W | Seal of Binding | TRAP | 10 | A 2 m seal at a spot (8 m), armed after 0.5 s, for 6 s. An enemy who steps in is rooted 1 s and Stained. Once armed it counts as a stroke. | ignores | Walk round it. If it lands on you, 1 m takes 0.5 s with reaction, exactly the arming time. |
| E | Flowing Script | DASH | 11 | She glides 6 m and paints a stroke along her path. | none | Do not follow her down the line. |
| R | The Last Character | ZONE | 22 | She writes one great character at a spot (9 m, 4 m wide) in 1.0 s: 40 inside and rooted 1 s. Every stroke under the enemy erupts for 50 each, 3 at most. | ignores | Leave within 1.0 s: 2 m takes 0.75 s with reaction. Stay off the ink: the strokes are on the ground for you to see. |

### Tempo, the Unwound Hour (mage, ranged attack)
580 HP, 4.0 m/s, attack 6 m, 10 per 1.0 s. Theme file `chrono`.

- **Question:** where will I be when my spell repeats?
- **Weakness:** his damage comes late and can be dodged twice. Rushed by a melee hero, he has one short blink and little else.
- **Passive, Echo:** 1.5 s after each of his spells, a clockwork echo repeats it from the same place at 40%. All four spells echo. Ghost clock hands show where it will come from, on both screens.
- **Visible:** the ghost hands, the clock over the enemy during R, the golden hands on him while his echoes run strong.
- **Ladder:** rhythm Q, commit W and E, turning point R.
- **Second decision:** a Q hit takes 1 s off itself. The echo fires from where he stood, so where he casts from is a decision.
- **Changed from v4:** the passive now works on all four spells, because W and E deal damage and R echoes. R raises the echo and has a window to answer. It no longer touches the enemy's cooldowns, which stopped a kit from playing at all.

| Key | Spell | Type | CD | What it does | Cover | Counterplay, checked |
|---|---|---|---:|---|---|---|
| Q | Tick | SHOT | 3 | A clock-hand bolt (9 m, 20 m/s, 0.25 s wind-up): 50. A hit takes 1 s off Q. Echo: 20 along the same line. | blocked | Sidestep: it reaches 6 m at 0.55 s. Do not step back onto the line: the echo comes 1.5 s later. |
| W | Slow Time | ZONE | 9 | Time thickens in a 3.5 m circle at a spot (9 m). At 1.2 s, enemies inside take 30 and are slowed for 2 s, and he moves 30% faster inside it for 3 s. Echo: 12 and the slow again. | ignores | Leave: 1.13 s with reaction, before the 1.2 s hit. |
| E | Time Skip | BLINK | 11 | He vanishes for 0.6 s (untouchable), and a marker shows where he will return, up to 6 m away. He returns with a 1.4 m pulse: 35. Echo: 14 at the same spot. | none | Step off the marker: 1.4 m takes 0.6 s with reaction. Then hit him where he stands. |
| R | Stolen Hour | TGT, delayed | 24 | A clock face forms over the enemy (8 m) for 0.8 s. If he still has sight: 70 and slowed 2 s, and for the next 4 s all his echoes are 80% and he moves 30% faster. Echo: 28. | sight+ | Break sight: cover within 2.2 m can be reached in the 0.8 s. Then stay off his lines for 4 s: the hands show them. |

---

## Second decisions across the roster

| Hero | Recast | Refund or hold | Other |
|---|---|---|---|
| Vesper | Q | | when to go below 45% |
| Brannoc | R | | which spell to Temper |
| Isolde | Q | | freeze or shatter at 5 Chill |
| Lyra | | Q hold, E refund | |
| Vitriol | | reaction refund | which reaction |
| Kaia | W | | spend a rod or keep it |
| Sefu | | Q refund on Judged | |
| Nyx | | E refund from the veil | fade or fight |
| Fenna | R | | where a seed stops |
| Auriel | W, R | | when to pop on a brand |
| Marin | | | E flips the tide |
| Zephyr | Q | E charges | spend or bank a Gust |
| Mortis | E | | spend or let die |
| Ada | R | W charges | grapple target |
| Sirix | Q | | hold six or spend |
| Cantor | | beat refund | cast now or wait |
| Opaline | | Q refund per bounce | straight or bank |
| Oblivion | R | | stand or walk |
| Shiori | | Q refund per crossing | where strokes cross |
| Tempo | | Q refund | where to cast from |

Against League's counts: a recast on 55% of kits (it was 20%, Q only), a refund on 40% (it was 10%). Untouchable on a basic spell: 3 of 60 (it was 7). Sure-hit R with no window: 0 (it was 5).

## Engine pieces this needs

Only what v5 uses. Nyx's stealth, the transforms, the bolt time zone and enemy cooldowns from v4's list are gone.

| # | Piece | Who | Notes |
|---|---|---|---|
| E1 | **Lock cap:** stuns, knock-ups and roots in a row count as one lock of at most 1.5 s, then 0.5 s of immunity to all three | everyone | `status.ts`. Today a stun can refresh on a target already stunned, and roots are not counted |
| E2 | **Own state, visible:** a hero's own count, stance or armed attack shown on them, or as a ring at their feet, on both screens | Zephyr, Sirix, Vesper, Ada, Cantor, Marin, Oblivion, Nyx, Brannoc, Tempo | Enemy stacks already show as pips. Online it reuses the `stacks` message with a `@` prefix, so the server does not change |
| E3 | **Trait hits:** a passive, or something a spell left behind, can hit | Kaia, Shiori, Auriel, Sirix | `TraitView.hitEnemy`, a new hit kind so a passive does not trigger itself |
| E4 | **Channel:** the caster is rooted and a stun, silence or knock-up ends it; a bar shows on both screens | Vesper R, Marin R, Ada R | The effect reads the caster's status each frame, through one helper |
| E5 | **New statuses:** Charm (walks to the caster, cannot act), Sealed (cannot act or be hit), a buff that ignores slow, root and knock-up, and halved dashes for Judged | Cantor, Sefu, Brannoc | `status.ts`. `moveFigure` halves the distance on a Judged hero |
| E6 | **Basic-attack cone:** an attack also sprays a cone | Brannoc R | `attackMods` scales power today; this adds the shape. Extra reach already exists |
| E7 | **Veil look:** a dark see-through figure with a clear outline, on both screens | Nyx | The hover outline already draws an outline to reuse |
| E8 | **Bank shots:** bolts reflect off walls, pillars and placed crystals, and the aim line draws the first bounce for both players | Opaline | The projectile system tests obstacles already; reflect instead of ending |
| E9 | **Enemy-cast hook:** a trait learns when the other hero casts | Vesper E | Runs on both screens; each does its own part |
| E10 | **Victim-side passive:** the attacker's rule runs on the victim's screen | Oblivion, Fenna, Kaia, Shiori | Online, only the victim's screen can move its own hero or decide a hit on it |
| E11 | **Recast arming and auto-recast:** a recast that opens late, and a trait that fires its own free recast | Vesper Q, Isolde Q, Kaia W, Auriel, Mortis, Sirix | `RecastSpec.arm`. An auto-recast goes out as a normal cast, so hits are decided on the victim's screen |
| E12 | **Shield report:** a trait learns how its shield ended, and a kept shield is not refreshed by a smaller one | Auriel, Mortis | `shieldFigure` restarts the clock today, so Auriel's Q could hold Sunrise up forever |
| E13 | **Confine ring:** neither hero can leave a circle for N seconds | Cantor R | The same clamp the duel ring uses; each screen applies it to its own hero |
| E14 | **AI rules** for the new verbs | all | Rules below |

Not needed: Null Zone eats bolts with eight existing bolt-wall segments in a circle, and Nyx's copy is an ordinary summon with its own look.

**AI rules (one simple policy per hero, so the CPU still uses the mechanic):**
- Opponent side, all heroes: walk off a shown circle in time at the CPU level's reaction; stop casting while cursed if HP is under half; touch rods and trample flowers when near; walk away from Brannoc while he is in Molten Core.
- Vesper: R only within 4 m. Isolde: at 5 Chill, R if it would kill or the enemy is over half HP, otherwise freeze. Marin: Mist Form when the tide is wrong and she has room. Nyx: back off to cover when no spell is ready. Zephyr: bank Gusts when R is ready and the enemy is over half HP. Cantor: cast on the beat 70% of the time. Oblivion: stand still when the enemy is inside 6 m and Q is cooling. Auriel: pop R when the enemy is inside 5 m. Ada: Siege Mode only with a turret up. Sirix: R at 4 or more wasps.

## Known gaps kept on purpose

- **No person has played these kits.** The CPU cannot test counterplay, so every line above is arithmetic, not a playtest.
- The 0.25 s reaction time is an assumption, and network lag makes the tight lines tighter (Sarcophagus, Grave Grasp, Supercell, Skyward).
- Two format ideas stay untried and are not part of this work: R coming up 8 s into a round, and the loser swapping hero.
- Models: the twelve heroes still on the old look get the current style separately, not in this work.

## Build order

1. Engine pieces E1-E14, one writer.
2. The five built kits changed and rebalanced first, because they are already in play.
3. Vesper, Brannoc, Sefu, Cantor, Tempo. Then Isolde, Kaia, Fenna, Auriel, Ada. Then Sirix, Shiori, Opaline, Oblivion, Nyx.
4. Every batch: per-hero workers own only their kit, trait and new effect files. Then the registry, AI rules, a browser check of every spell, a sheet, AI duels (40-60% against a mixed field), and a commit.
5. Then a full tournament, the docs and catalog refresh, and the Vitriol rename everywhere it shows.
