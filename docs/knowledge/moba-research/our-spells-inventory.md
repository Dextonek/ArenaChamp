---
title: Our spells by mechanics (inventory for the MOBA comparison)
tags: [knowledge, research, moba, spells, inventory]
updated: 2026-11-19
---

# Our spells by mechanics: every hero spell and every tool spell, in League, Dota 2 and Smite terms

Written 2026-11-19 from the local code and docs only (no web). It covers every hero spell (passive, Q, W, E and R) of the 40 heroes and the draft Kagen, and every tool spell on the VFX tool page. Each one is put in the words the three big MOBAs use: how it is activated, how it is aimed, what it does, the crowd control (CC), the counterplay and the cooldown. Counts and the gaps against League, Dota 2 and Smite are at the end.

**How to read it.**
- The **code wins over the docs.** Every row comes from the hero's card (`src/heroes/<theme>/hero.ts`: key, range, cooldown, flags, tooltip), its spell file's `targeting` and header comment (`src/heroes/<theme>/spells/*.ts`), and its passive (`src/heroes/<theme>/trait.ts`: `hold`, `recast`, `charges`, `resource`, `meter`). The roles table in `docs/catalog/heroes/README.md` (dated 2026-11-11) was only a cross-check. Where it disagrees with the code, the code is used and the conflict is noted.
- **Input** is what the engine asks of the player. It is objective, from `targeting.mode` and the card's `aim`. **Mechanic**, **parts** and **counterplay** are my reading of the tooltip and the file header, in a fixed vocabulary, so they are judgement calls. The tallies are counted by a script from exactly these rows, so every count matches its table.
- **Older docs to build on, not repeated here.** `docs/knowledge/league-research/our-kits-comparison.md` (2026-11-04) judged 20 kits as they were then against League's 173. `docs/knowledge/league-champion-kits.md` holds League's per-kit tags and counts. Those 20 kits have all been rebuilt since, as "v5" and in folders, and 20 heroes were added. This file is the up-to-date inventory that the older comparison lacks.
- **Dota 2 and Smite** have no local source in this repository. Every claim about them below comes from general knowledge, carries the label **(uncited)**, and sits under Inferences or Gaps, never under Cited Findings.

**Glossary of the words used** (the League vocabulary in `docs/knowledge/league-champion-kits.md` lines 58-79, plus our own):
- skillshot: a bolt (`ctx.projectile`) that flies along the aim and hits the first enemy it touches. You dodge it by stepping off the line, and cover stops it.
- bank shot: a skillshot that bounces off walls.
- fan: several bolts at once.
- unit-target: click an enemy.
- unit-target-delayed: click an enemy; the hit lands after a wind-up on their live position (a sure hit) unless sight is lost.
- unit-mark-delayed: click an enemy; a circle is fixed on the spot where they stood, and they dodge it by stepping out.
- ground-fuse: a circle at a point that lands after a delay.
- ground-zone: a lasting area.
- cone-quick: no aim; the hero turns to the nearest enemy and strikes in front.
- self-nova: a ring from the caster.
- terrain: the spell makes a real obstacle.
- trap: armed ground that triggers on a step.
- remote-trigger: a no-target press that detonates things already placed.
- fuse: a delay, shown on the floor, between the cast and the hit.
- sight-check: the spell fizzles if the caster loses sight at impact.
- recast: a second press.
- ammo: charges.
- hold: charge-up while the key is held.
- chaser: a unit or object that walks at the enemy.

## 1. Every hero spell: activation, aim, effect, CC, counterplay, cooldown

### Takeaway
The 41 kits (40 heroes and the draft Kagen) hold 167 spells and 41 passives. The aim is spread fairly evenly: ground point 31%, no aim (self or facing) 26%, line skillshot 25%, click an enemy 16%. The other 2% use the `enemies` mode: Homunculus, Crosswind and Mr. Biscuit. The kits are built on delays you can read, not on sure hits. 38 spells (23%) have a fuse on the floor, and 7 of the 27 click-an-enemy spells mark a spot the enemy can step out of. CC is short and capped: no single hit stuns longer than 1.2 s. Three kinds of input are almost absent. Only Lyra Q charges up, only 3 kits channel, and no kit has a toggle.

### Cited Findings
- **The engine's targeting has four modes:** `enemy` (the clicked enemy, else the nearest), `enemies` (shift-clicked or a nearest-neighbour chain), `ground` (the clicked spot) and `self` (centred on the caster). None targets an ally. — [src/effects/targeting.ts lines 9-19](../../../src/effects/targeting.ts)
- **A card can carry these flags:**
  - AI flags: `cc`, `dash`, `escape`, `anytime`, `save`, `parry`, `barrier` and `summon`.
  - Aim flags: `aim: 'line' | 'arc'`, `bank`, `overCover` and `passesOwnWalls`.
  - Effect flags: `buff` and `debuff`.
  - Except `aim`, the flags only steer the CPU. The rules live in the spell file and the trait.
  - — [src/heroes.ts lines 17-66](../../../src/heroes.ts)
- **The passive layer can add these to slots:**
  - `hold`: a slot that charges while it is aimed.
  - `charges`: ammo.
  - `recast`: a second press within a window, free, at 60% damage by default. With `replay: false`, the recast acts without aim.
  - `resource` and `meter`.
  - `swapKit`: a second kit, used by Pim and Pom.
  - `untouchable`, `figureHidden` and `figureVeil`.
  - — [src/traits/types.ts lines 200-380](../../../src/traits/types.ts)
- **Statuses:**
  - The eight kinds are stun, root, slow, silence, blind, knock-up, charm and sealed. Each has a hard cap per hit: stun 1.2 s, knock-up 0.8, root 1.5, slow 2.5, silence 1.5, blind 2, charm 1.2, sealed 1.2.
  - Hard locks (stun, knock-up, root, charm, sealed) in a row are one lock, capped at 1.5 s in all. A new one inside the 0.5 s immunity after a lock is refused. Slow, silence and blind are not part of a lock.
  - A slow is always 40% (factor 0.6).
  - A blind does two things. The victim's basic attacks miss, as League's blind does. Their aimed casts (not self casts) also land anywhere within 2.5 m of where they aimed.
  - — [src/effects/status.ts lines 10-36 and 117-130](../../../src/effects/status.ts); [src/attacks/index.ts line 12](../../../src/attacks/index.ts); [src/duel.ts line 3119](../../../src/duel.ts)
- **Buffs and debuffs:** haste, might, armour, vulnerable, weaken and grounded. In our engine, grounded means dashes, blinks and leaps go less far (Sefu's Judged, 0.5); it is not League's "cannot dash". Each is capped at 50% and 6 s. — [src/effects/status.ts lines 40-60](../../../src/effects/status.ts)
- **Hit rule: you can dodge every area spell.**
  - A cast with a drawn shape hits the victim only if they stand inside that shape at the impact. The duel shows "DODGED" otherwise.
  - A shape-less cast still hits within 1.6 m of its aim.
  - A skillshot that touched the body skips the check: the touch was the dodge test.
  - A ward between the zone and the hero blocks it ("WARDED").
  - — [src/duel.ts lines 159 and 3207-3243](../../../src/duel.ts)
- **Click-an-enemy spells need sight at the cast.** Most also re-check sight or reach at the impact, and fizzle without it:
  - Lancet and Hemocurse fizzle past 8 m or without sight.
  - Oathbrand, Stolen Hour, Winter's Shatter and Sky Rend fizzle without sight.
  - Rope Trick, Sweater and Pop! need sight "when it lands".

  So against a sure-hit spell, the answer is to break line of sight, not to sidestep. — [docs/architecture/hero-mode.md line 141](../../architecture/hero-mode.md); spell headers in `src/heroes/blood/spells/lancet.ts`, `src/heroes/dawn/spells/oathbrand.ts`, `src/heroes/frost/spells/wintersShatter.ts`, `src/heroes/sky/spells/skyRend.ts` (header comments, line 1 onward)
- **Hard sure hits are rare.** Only some click spells say outright that they cannot miss:
  - Fire Vial: "cannot miss".
  - Homing Drone: "always hits".
  - Red-Hot Rivet: "a sure hit, like Fire Vial".
  - Sky Strike, Hoarfrost and Strangle Vine are judged on the live position with `projectile: true`.
  - — `src/heroes/alchemy/hero.ts`, `src/heroes/clockwork/hero.ts`, `src/heroes/forge/spells/redHotRivet.ts`, `src/heroes/storm/spells/skyStrike.ts`, `src/heroes/frost/spells/hoarfrost.ts`, `src/heroes/grove/spells/strangleVine.ts` (header comments)
- **Only one slot in the roster charges up:** Lyra's Starfall Arrow (`hold: { slot: 0, seconds: 1 }`). Two other docs disagree:
  - `docs/architecture/hero-mode.md` line 94 names "Kaia Q, Sefu W" as hold spells. That is stale: neither trait has a `hold`.
  - The tool spell Thunderlance (old storm kit) also describes a hold on slot 3, but no current hero uses it.
  - — [src/heroes/astral/trait.ts line 44](../../../src/heroes/astral/trait.ts); grep of `hold:` over `src/heroes/*/trait.ts`
- **Channels with a channel bar that a CC breaks:** Vesper's Sanguine Feast, Ada's Siege Mode and Marin's Moon's Pull. All three are roots on the caster that a stun, a silence or a knock-up ends. — [src/effects/channel.ts](../../../src/effects/channel.ts); `channelBroken` is used only in `src/heroes/blood/spells/sanguineFeast.ts`, `src/heroes/clockwork/spells/siegeMode.ts` and `src/heroes/tide/spells/moonPull.ts`
- **Twelve slots across 11 kits have a recast:**
  - Q: Lancet (Rip), Barbed Stinger (leap), Icicle (Shatter), Crosswind (dash-slash).
  - W: Thunder Rod (Discharge), Dawnward (Pop).
  - E: Bone Armour (Shatter).
  - R: World Tree (Uproot), Sunrise (Pop), Siege Mode (Pack up), Timber Call (Timber), Void Black Hole (Collapse).
  - — `recast:` in `src/heroes/{blood,hive,frost,sky,storm,dawn,bone,grove,clockwork,timber,void}/trait.ts`
- **Seven slots use ammo (charges):** Ada's turret (2), Wick's door (2), Gus's sign (2), Mum's wall (3), Hank's tree (2), Zephyr's Feather Step (2) and Grandma Ironknit's yarn (2). — `charges:` in those traits; card tooltips in their `hero.ts`
- **Three kits have no cooldowns and pay instead:** Vesper pays HP (the Price), Brannoc builds Heat and Cantor casts on the beat (one spell per 1.2 s). Their cards carry a 0.5 s engine gap as the cooldown. — `src/heroes/blood/trait.ts`, `src/heroes/forge/trait.ts`, `src/heroes/bard/trait.ts` (passive blurbs)

#### Hero spells, hero by hero

Columns: **Input** is what the code asks of the player (`self` casts at once, `unit` = click an enemy, `enemies` = click an enemy and the spell may hit several, `point` = a ground circle at the cursor, `line` = an aim strip; from the spell file's `targeting` and the card's `aim`). **Spell** is the name on the bar (the twins spells marked Pim or Pom). **Range** is the card `range` (the click reach; 0 for a self cast, whose size is in the tooltip). **Mechanic** is the same spell in MOBA words (my reading of the blurb and the file header). **CD** in seconds (`0.5` on Vesper, Brannoc and Cantor is the engine gap: they pay with HP, Heat or the beat instead). Range in metres.


**Vitriol** (`src/heroes/alchemy/hero.ts`, passive `src/heroes/alchemy/trait.ts`)

| Slot | Spell | Input | Mechanic | Parts | CC on the enemy (self buffs marked self:) | CD | Range | Counterplay | File |
|---|---|---|---|---|---|---|---|---|---|
| P | Reaction | - | passive | mark, detonate, reset | push, silence, vulnerable | - | - | two different reagents set it off: avoid the second spell |  |
| Q | Toxin Dart | line | skillshot | dot, mark |  | 3 | 9 | step off the line (6 m in ~0.5 s) | toxinDart.ts |
| W | Fire Vial | unit | unit-target | dot, mark, sure-hit |  | 6 | 7 | none once cast (sight needed at cast) | fireVial.ts |
| E | Acid Splash | self | cone-quick | mark | push | 8 | 4 | stay out of the 4 m cone | acidSplash.ts |
| R | Homunculus | enemies | summon | summon, chaser, detonate | push, silence | 25 | 10 | shoot the bomb (120 HP) or outrun it | homunculus.ts |

**Lyra** (`src/heroes/astral/hero.ts`, passive `src/heroes/astral/trait.ts`)

| Slot | Spell | Input | Mechanic | Parts | CC on the enemy (self buffs marked self:) | CD | Range | Counterplay | File |
|---|---|---|---|---|---|---|---|---|---|
| P | Far Sight | - | passive | reset |  | - | - | stay within 4 m (no bonus) |  |
| Q | Starfall Arrow | line | skillshot | hold, pierce, reset |  | 4 | 9-14 | step off the line; the draw shows | starfallArrow.ts |
| W | Twin Stars | self | self-buff | buff | self: haste | 14 | 0 | none (a 5 s window to back off) | twinStars.ts |
| E | Pinning Arrow | line | skillshot | terrain-bonus | root, slow | 9 | 9 | step off the line; stay off walls | pinningArrow.ts |
| R | Meteor Mark | unit | unit-mark-delayed | mark, fuse, tally |  | 24 | 14 | walk out of the 1.8 m spot after it fixes (0.9 s) | meteorMark.ts |

**Professor Puff** (`src/heroes/balloon/hero.ts`, passive `src/heroes/balloon/trait.ts`)

| Slot | Spell | Input | Mechanic | Parts | CC on the enemy (self buffs marked self:) | CD | Range | Counterplay | File |
|---|---|---|---|---|---|---|---|---|---|
| P | Inflate | - | passive | stacks, hitbox |  | - | - | stand still or hit him to deflate |  |
| Q | Air Hose | line | skillshot | stacks | push | 3.5 | 8 | step off the line | airHose.ts |
| W | Helium Bomb | point | ground-fuse | fuse, stacks |  | 9 | 9 | leave the 2.5 m circle in 1.0 s | heliumBomb.ts |
| E | Hot Air | point | dash | escape, reverse-dash | push | 10 | 9 | - | hotAir.ts |
| R | Pop! | unit | unit-target | travel, detonate-stacks, execute | push | 22 | 9 | break sight before it lands (0.6 s); deflate first | popPin.ts |

**Cantor** (`src/heroes/bard/hero.ts`, passive `src/heroes/bard/trait.ts`)

| Slot | Spell | Input | Mechanic | Parts | CC on the enemy (self buffs marked self:) | CD | Range | Counterplay | File |
|---|---|---|---|---|---|---|---|---|---|
| P | Only on the Beat | - | passive | rhythm, resource, no-cooldown | silence | - | - | off-beat casts are weak; punish the rests |  |
| Q | Resounding Chord | self | cone-quick | rhythm, stacks | silence | beat | 5 | stay out of 5 m | resoundingChord.ts |
| W | Siren Song | unit | unit-projectile | spend-resource, travel | charm | beat | 8 | step behind cover while the note flies (10 m/s) | sirenSong.ts |
| E | Rising Chorus | self | self-buff | spend-resource, shield | self: haste | beat | 0 | - | risingChorus.ts |
| R | Duet | self | self-nova | zone, cage, fuse | confine, silence | 11 | 0 | leave the 6 m ring in its 0.8 s close | duet.ts |

**Vesper** (`src/heroes/blood/hero.ts`, passive `src/heroes/blood/trait.ts`)

| Slot | Spell | Input | Mechanic | Parts | CC on the enemy (self buffs marked self:) | CD | Range | Counterplay | File |
|---|---|---|---|---|---|---|---|---|---|
| P | Blood Price | - | passive | resource-hp, no-cooldown, lifesteal |  | - | - | make her pay; trade when the Price is high |  |
| Q | Lancet | unit | unit-projectile | recast, reset, sight-check |  | 0.5 (HP) | 7 | break sight or leave 8 m within 0.4 s | lancet.ts |
| W | Mist Waltz | point | dash | escape, empower-attack |  | 0.5 (HP) | 11 | the dash is 5 m (card range 11 is the click reach) | mistWaltz.ts |
| E | Hemocurse | unit | unit-target | tether, spell-tax, sight-check |  | 0.5 (HP) | 7 | break sight / 8 m; do not cast while cursed | hemocurse.ts |
| R | Sanguine Feast | unit | channel | channel, tether, self-root, heal, execute |  | 11 (2x HP) | 8 | stun/silence her, step behind cover, or get 9 m away | sanguineFeast.ts |

**Mortis** (`src/heroes/bone/hero.ts`, passive `src/heroes/bone/trait.ts`)

| Slot | Spell | Input | Mechanic | Parts | CC on the enemy (self buffs marked self:) | CD | Range | Counterplay | File |
|---|---|---|---|---|---|---|---|---|---|
| P | Ossuary | - | passive | ground-objects, summon |  | - | - | fight away from bone piles |  |
| Q | Bone Fan | line | fan | multi-bolt, scales-with-objects |  | 5 | 8 | stand between shards past 5 m | boneFan.ts |
| W | Raise Dead | point | summon | summon, scales-with-objects |  | 9 | 9 | kill the skeletons | raiseDead.ts |
| E | Bone Armour | self | self-shield | shield, recast, detonate |  | 14 | 0 | burst it early or dodge the shards | boneArmour.ts |
| R | Grave Grasp | unit | unit-mark-delayed | fuse, summon | pull, root | 22 | 9 | step out of the 1.6 m ring in 0.7 s | graveGrasp.ts |

**Sir Whiskers** (`src/heroes/cat/hero.ts`, passive `src/heroes/cat/trait.ts`)

| Slot | Spell | Input | Mechanic | Parts | CC on the enemy (self buffs marked self:) | CD | Range | Counterplay | File |
|---|---|---|---|---|---|---|---|---|---|
| P | Nine Lives | - | passive | hp-chunks, damage-cap |  | - | - | many small hits and DoTs |  |
| Q | Scratch | self | cone-quick | attack-reset |  | 3 | 2.5 | stay out of 2.5 m | scratch.ts |
| W | Knock It Over | point | ground-fuse | fuse, needs-cover | stun | 9 | 9 | leave 1.5 m in 0.7 s; fight in the open | knockItOver.ts |
| E | Pounce | point | leap | cost-life, self-lockout |  | 8 | 7 | - | pounce.ts |
| R | Land on My Feet | self | self-buff | cheat-death, auto-leap | self: attack speed | 24 | 0 | wait 4 s before the finishing blow | landOnMyFeet.ts |

**Madame Cleaver** (`src/heroes/chef/hero.ts`, passive `src/heroes/chef/trait.ts`)

| Slot | Spell | Input | Mechanic | Parts | CC on the enemy (self buffs marked self:) | CD | Range | Counterplay | File |
|---|---|---|---|---|---|---|---|---|---|
| P | Today's Special | - | passive | pickups, heal, trap | stun (burnt dish); eater: haste | - | - | eat her dishes first; walk round burnt ones |  |
| Q | Thrown Cleaver | line | skillshot | leaves-pickup |  | 3.5 | 9 | step off the line | thrownCleaver.ts |
| W | Hot Soup | point | ground-fuse | fuse, leaves-pickup | slow | 9 | 8 | leave 2.5 m in 1 s | hotSoup.ts |
| E | Burnt Offering | point | trap | trap | stun | 12 | 8 | do not step on it | burntOffering.ts |
| R | Dinner Is Served | self | terrain | terrain, pickups, buff, heal | self: might | 24 | 0 | break the table (150 HP) or eat the dishes | dinnerIsServed.ts |

**Tempo** (`src/heroes/chrono/hero.ts`, passive `src/heroes/chrono/trait.ts`)

| Slot | Spell | Input | Mechanic | Parts | CC on the enemy (self buffs marked self:) | CD | Range | Counterplay | File |
|---|---|---|---|---|---|---|---|---|---|
| P | Echo | - | passive | repeat-cast |  | - | - | the ghost hands show where it repeats |  |
| Q | Tick Bolt | line | skillshot | echo, reset |  | 3 | 9 | step off the line, twice | tickBolt.ts |
| W | Slow Time | point | ground-fuse | fuse, echo, self-haste | slow | 9 | 9 | leave 3.5 m in 1.2 s | slowTime.ts |
| E | Time Skip | point | blink | untargetable, echo |  | 11 | 6 | - | timeSkip.ts |
| R | Stolen Hour | unit | unit-target-delayed | sight-check, self-buff, echo | slow | 24 | 8 | break sight within 0.8 s | stolenHour.ts |

**Ada** (`src/heroes/clockwork/hero.ts`, passive `src/heroes/clockwork/trait.ts`)

| Slot | Spell | Input | Mechanic | Parts | CC on the enemy (self buffs marked self:) | CD | Range | Counterplay | File |
|---|---|---|---|---|---|---|---|---|---|
| P | Overclock | - | passive | aura-on-summons |  | - | - | keep her away from her turrets |  |
| Q | Homing Drone | unit | unit-target | sure-hit, mark |  | 4 | 8 | none (sight at cast) | homingDrone.ts |
| W | Deploy Turret | point | summon | summon, ammo(2) |  | 10 | 8 | kill the turret (80 HP) | deployTurret.ts |
| E | Grapple Hook | line | skillshot | hook, self-pull-to-terrain | slow | 10 | 9 | step off the line | grappleHook.ts |
| R | Siege Mode | self | stance | self-root, auto-attack, interruptible, recast-end | self: armor | 24 | 9 | stun/silence/knock up to end it; leave 9 m | siegeMode.ts |

**Pip** (`src/heroes/courier/hero.ts`, passive `src/heroes/courier/trait.ts`)

| Slot | Spell | Input | Mechanic | Parts | CC on the enemy (self buffs marked self:) | CD | Range | Counterplay | File |
|---|---|---|---|---|---|---|---|---|---|
| P | Sign Here | - | passive | objective, stacks |  | - | - | hit him while he carries; stand on the drop |  |
| Q | Express Letter | line | skillshot | scales-with-stacks |  | 3 | 8 | step off the line | expressLetter.ts |
| W | Fragile | point | ground-fuse | fuse | slow | 9 | 9 | leave 2.5 m in 1 s | fragile.ts |
| E | Shortcut | point | dash | escape, reset-by-stack |  | 9 | 6 | - | shortcut.ts |
| R | Final Delivery | unit | homing-object | chaser, spend-stacks, reflect | - | 24 | 6 | touch cover first and it goes back | finalDelivery.ts |

**Auriel** (`src/heroes/dawn/hero.ts`, passive `src/heroes/dawn/trait.ts`)

| Slot | Spell | Input | Mechanic | Parts | CC on the enemy (self buffs marked self:) | CD | Range | Counterplay | File |
|---|---|---|---|---|---|---|---|---|---|
| P | Oath of Dawn | - | passive | shield-detonate | stun | - | - | keep out of 3 m when her shield ends |  |
| Q | First Light | self | cone-quick | shield-on-hit |  | 4 | 6 | stay out of the 6 m cone | firstLight.ts |
| W | Dawnward | self | self-shield | shield, recast, detonate, attack-range |  | 9 | 0 | keep out of 3 m when it pops | dawnward.ts |
| E | Oathbrand | unit | unit-target-delayed | sight-check, mark |  | 11 | 7 | break sight within 0.5 s | oathbrand.ts |
| R | Sunrise | self | self-shield | shield, recast, detonate, delayed-ring | stun(branded) | 24 | 0 | leave the 5 m ring in 1.6 s | sunrise.ts |

**Wick** (`src/heroes/door/hero.ts`, passive `src/heroes/door/trait.ts`)

| Slot | Spell | Input | Mechanic | Parts | CC on the enemy (self buffs marked self:) | CD | Range | Counterplay | File |
|---|---|---|---|---|---|---|---|---|---|
| P | This Way, Please | - | passive | portal |  | - | - | use his doors; break them (40 HP) |  |
| Q | Key Toss | line | skillshot | through-portals |  | 3.5 | 9 | step off the line (and its door exit) | keyToss.ts |
| W | Wick Door | point | terrain | portal, ammo(2) |  | 0.6 (2 charges, 4 s) | 9 | break a door | wickDoor.ts |
| E | Door Slam | self | remote-trigger | fuse, detonate | stun | 9 | 0 | stay 1.5 m from his doors for 0.7 s | doorSlam.ts |
| R | Grand Lobby | point | terrain | portal, cage | confine | 24 | 9 | walk through the 2 m gaps | grandLobby.ts |

**Brannoc** (`src/heroes/forge/hero.ts`, passive `src/heroes/forge/trait.ts`)

| Slot | Spell | Input | Mechanic | Parts | CC on the enemy (self buffs marked self:) | CD | Range | Counterplay | File |
|---|---|---|---|---|---|---|---|---|---|
| P | Heat | - | passive | resource, overheat, no-cooldown | self: immune to slow and root | - | - | make him overheat; he burns |  |
| Q | Chain Hammer | line | skillshot | hook | pull, slow | 0.5 (Heat) | 9 | step off the line | chainHammer.ts |
| W | Forge Roar | self | self-buff | buff, empower-attack | knockup (next attack); self: armor | 0.5 (Heat) | 0 | stay out of the next swing | forgeRoar.ts |
| E | Red-Hot Rivet | unit | unit-target | sure-hit, dot |  | 0.5 (Heat) | 6 | none (sight at cast) | redHotRivet.ts |
| R | Molten Core | self | self-nova | fuse, spend-resource | knockback, stun | 11 | 6 | leave 3 m in 0.6 s | moltenCore.ts |

**Isolde** (`src/heroes/frost/hero.ts`, passive `src/heroes/frost/trait.ts`)

| Slot | Spell | Input | Mechanic | Parts | CC on the enemy (self buffs marked self:) | CD | Range | Counterplay | File |
|---|---|---|---|---|---|---|---|---|---|
| P | Deep Winter | - | passive | stacks | slow, stun | - | - | do not take the 5th Chill |  |
| Q | Icicle | line | skillshot | pierce, recast, stacks |  | 4 | 11 | step off the line; stay 2 m from where it sticks | icicle.ts |
| W | Hoarfrost | unit | unit-target-delayed | sure-hit, stacks |  | 9 | 8 | none once cast (sight at cast) | hoarfrost.ts |
| E | Rime Armour | self | self-buff | thorns-stacks | self: armor | 12 | 0 | do not attack her for 3 s | rimeArmour.ts |
| R | Winter's Shatter | unit | unit-target-delayed | consume-stacks, sight-check |  | 22 | 9 | break sight within 0.8 s | wintersShatter.ts |

**Fenna** (`src/heroes/grove/hero.ts`, passive `src/heroes/grove/trait.ts`)

| Slot | Spell | Input | Mechanic | Parts | CC on the enemy (self buffs marked self:) | CD | Range | Counterplay | File |
|---|---|---|---|---|---|---|---|---|---|
| P | Living Garden | - | passive | ground-objects, heal-zone | slow | - | - | trample the flowers (1 m for 0.6 s) |  |
| Q | Seed Shot | line | skillshot | leaves-object |  | 4 | 9 | step off the line | seedShot.ts |
| W | Strangle Vine | unit | unit-target | sure-hit, terrain-bonus | root | 11 | 7 | none once cast; stay 3 m from flowers | strangleVine.ts |
| E | Pollen Glide | point | dash | escape, leaves-object |  | 12 | 6 | - | pollenGlide.ts |
| R | World Tree | point | terrain | fuse, terrain, recast, heal-zone | root | 24 | 9 | leave 3 m in 1.2 s | worldTree.ts |

**Sirix** (`src/heroes/hive/hero.ts`, passive `src/heroes/hive/trait.ts`)

| Slot | Spell | Input | Mechanic | Parts | CC on the enemy (self buffs marked self:) | CD | Range | Counterplay | File |
|---|---|---|---|---|---|---|---|---|---|
| P | The Swarm | - | passive | resource |  | - | - | - |  |
| Q | Barbed Stinger | line | skillshot | mark, recast-leap, dot |  | 6 | 8 | step off the line | barbedStinger.ts |
| W | Hive Shell | self | self-buff | thorns | self: armor | 10 | 0 | do not trade into it | hiveShell.ts |
| E | Swarm Cloud | point | ground-zone | zone, spend-resource | blind | 9 | 9 | leave the cloud before 1 s | swarmCloud.ts |
| R | Swarm Surge | line | line-area | pierce, spend-resource-permanently | push, blind | 22 | 10 | leave the 4 m column | swarmSurge.ts |

**Shiori** (`src/heroes/ink/hero.ts`, passive `src/heroes/ink/trait.ts`)

| Slot | Spell | Input | Mechanic | Parts | CC on the enemy (self buffs marked self:) | CD | Range | Counterplay | File |
|---|---|---|---|---|---|---|---|---|---|
| P | Wet Ink | - | passive | ground-objects, detonate, reset | slow, vulnerable | - | - | stay off the ink; leave crossings in 0.65 s |  |
| Q | Ink Lash | line | skillshot | leaves-zone |  | 4 | 9 | step off the line | inkLash.ts |
| W | Seal of Binding | point | trap | trap, arm-delay | root | 10 | 8 | do not step in | sealOfBinding.ts |
| E | Flowing Script | point | dash | escape, leaves-zone |  | 11 | 6 | do not follow down her line | flowingScript.ts |
| R | The Last Character | point | ground-fuse | fuse, detonate-objects | root | 22 | 9 | leave the 4 m area in 1.0 s | theLastCharacter.ts |

**Gus** (`src/heroes/janitor/hero.ts`, passive `src/heroes/janitor/trait.ts`)

| Slot | Spell | Input | Mechanic | Parts | CC on the enemy (self buffs marked self:) | CD | Range | Counterplay | File |
|---|---|---|---|---|---|---|---|---|---|
| P | Wet Floor | - | passive | ground-modifier | slide | - | - | walk round the shine or slide on purpose |  |
| Q | Big Mop | self | cone-quick | leaves-zone, clears-enemy-objects |  | 3.5 | 3.5 | stay out of 3.5 m | bigMop.ts |
| W | Wet Floor Sign | point | terrain | terrain, ammo(2) | stun(on slide) | 0.8 (2 charges, 8 s) | 8 | do not slide into it | wetFloorSign.ts |
| E | Mop Bucket | line | skillshot | leaves-zone |  | 10 | 8 | step off the line | mopBucket.ts |
| R | Flood | self | self-nova | fuse, zone, self-haste | slide | 24 | 0 | stand near cover, walk straight | flood.ts |

**Mr. Ledger** (`src/heroes/ledger/hero.ts`, passive `src/heroes/ledger/trait.ts`)

| Slot | Spell | Input | Mechanic | Parts | CC on the enemy (self buffs marked self:) | CD | Range | Counterplay | File |
|---|---|---|---|---|---|---|---|---|---|
| P | On Your Tab | - | passive | deferred-damage |  | - | - | hit him to pay down the tab |  |
| Q | Invoice | line | skillshot | deferred-damage |  | 3.5 | 9 | step off the line | invoice.ts |
| W | Late Fee | point | ground-fuse | fuse, deferred-damage | slow | 9 | 9 | leave 2.5 m in 1 s | lateFee.ts |
| E | Call It In | self | remote-trigger | detonate |  | 8 | 0 | - | callItIn.ts |
| R | Foreclosure | point | ground-fuse | fuse, detonate, sight-check | vulnerable | 24 | 9 | leave 2.2 m in 0.8 s, or break sight | foreclosure.ts |

**The Great Zambini** (`src/heroes/magic/hero.ts`, passive `src/heroes/magic/trait.ts`)

| Slot | Spell | Input | Mechanic | Parts | CC on the enemy (self buffs marked self:) | CD | Range | Counterplay | File |
|---|---|---|---|---|---|---|---|---|---|
| P | Ta-da! | - | passive | empower-after-stealth, summon |  | - | - | - |  |
| Q | Card Spray | line | fan | multi-bolt |  | 3.5 | 8 | stand in a gap past 5 m | cardSpray.ts |
| W | Sawn in Half | line | skillshot |  | slow | 10 | 8 | step off the line | sawnInHalf.ts |
| E | Hat Trick | self | self-vanish | untargetable, decoys |  | 13 | 0 | area spell hits all three hats; the right hat stuns HIM 1 s | hatTrick.ts |
| R | Grand Finale | unit | unit-ring-delayed | fuse, vanish, multi-bolt, reposition |  | 24 | 9 | step out of the 3 m ring in 1.2 s; walls stop swords | grandFinale.ts |

**Bram** (`src/heroes/mason/hero.ts`, passive `src/heroes/mason/trait.ts`)

| Slot | Spell | Input | Mechanic | Parts | CC on the enemy (self buffs marked self:) | CD | Range | Counterplay | File |
|---|---|---|---|---|---|---|---|---|---|
| P | Best Friends | - | passive | companion-object, damage-reduction |  | - | - | break Gerald (220 HP) or fight away from him |  |
| Q | Raise Gerald | point | ground-fuse | fuse, terrain | knockup | 6 | 9 | leave 1.5 m in 0.7 s | raiseGerald.ts |
| W | The Shove | line | moving-terrain | needs-object, carry | carry, stun(wall) | 7 | 8 | step off the line; keep off walls | theShove.ts |
| E | A Good Lean | self | dash-to-object | needs-object, shield |  | 11 | 8 | - | aGoodLean.ts |
| R | Gerald, No! | line | line-area | fuse, consume-object, leaves-zone | slow | 24 | 10 | leave the 10 m shadow in 1.0 s | geraldNo.ts |

**Mum** (`src/heroes/mime/hero.ts`, passive `src/heroes/mime/trait.ts`)

| Slot | Spell | Input | Mechanic | Parts | CC on the enemy (self buffs marked self:) | CD | Range | Counterplay | File |
|---|---|---|---|---|---|---|---|---|---|
| P | Silence Is Golden | - | passive | invisible-terrain |  | - | - | read the chalk; break a wall with any hit |  |
| Q | Invisible Ball | line | skillshot | invisible-projectile |  | 3.5 | 9 | read the chalk line; step off it | invisibleBall.ts |
| W | Mime Wall | point | terrain | terrain, ammo(3), invisible |  | 0.6 (3 charges, 3 s) | 9 | break it with one hit | mimeWall.ts |
| E | Rope Trick | unit | unit-target | travel, sight-check | pull | 11 | 7 | break sight within 0.5 s | ropeTrick.ts |
| R | The Box | point | terrain | fuse, cage | confine | 22 | 9 | leave 1.5 m in 0.8 s, or break a wall | theBox.ts |

**Silvane** (`src/heroes/mirror/hero.ts`, passive `src/heroes/mirror/trait.ts`)

| Slot | Spell | Input | Mechanic | Parts | CC on the enemy (self buffs marked self:) | CD | Range | Counterplay | File |
|---|---|---|---|---|---|---|---|---|---|
| P | Fairest of All | - | passive | bounce, pickup-reset | self: haste | - | - | hit her on the catch |  |
| Q | Hand Mirror | line | bank-shot | bounce, pickup-reset |  | 3 | 10 | watch the bounce line | handMirror.ts |
| W | Vanity Stand | point | terrain | terrain, bounce-surface | weaken(breaker) | 12 | 8 | do not break it in a hurry | vanityStand.ts |
| E | Through the Glass | point | blink-via-object | escape |  | 10 | 9 | - | throughTheGlass.ts |
| R | Hall of Mirrors | self | nova-bolts | multi-bolt, bounce, pickup-reset |  | 22 | 0 | stand in a gap | hallOfMirrors.ts |

**Mabel** (`src/heroes/mole/hero.ts`, passive `src/heroes/mole/trait.ts`)

| Slot | Spell | Input | Mechanic | Parts | CC on the enemy (self buffs marked self:) | CD | Range | Counterplay | File |
|---|---|---|---|---|---|---|---|---|---|
| P | Dig Site | - | passive | trap |  | - | - | walk round holes |  |
| Q | Mole Claw | self | cone-quick |  |  | 3 | 2.5 | stay out of 2.5 m | moleClaw.ts |
| W | Mole Dig | point | trap | trap, arm-delay, max(3) | root, slow | 7 | 6 | do not walk in | moleDig.ts |
| E | Mole Tunnel | point | dash | untargetable, cannot-cast | knockup | 10 | 7.2 | the mound shows where; stay 1.5 m from the exit | moleTunnel.ts |
| R | Sinkhole | unit | unit-mark-delayed | fuse | root | 24 | 9 | leave the 4 m pit in 1.3 s | sinkhole.ts |

**Anka** (`src/heroes/phoenix/hero.ts`, passive `src/heroes/phoenix/trait.ts`)

| Slot | Spell | Input | Mechanic | Parts | CC on the enemy (self buffs marked self:) | CD | Range | Counterplay | File |
|---|---|---|---|---|---|---|---|---|---|
| P | Ashborn | - | passive | ground-objects, revive | push | - | - | stamp the embers (1 m for 1 s) |  |
| Q | Ember Quill | line | skillshot | leaves-object |  | 3.5 | 10 | step off the line | emberQuill.ts |
| W | Fan the Flames | self | remote-trigger | fuse, detonate-objects |  | 9 | 0 | stay 2.2 m from embers for 0.8 s | fanTheFlames.ts |
| E | Ember Flight | point | dash-to-object | needs-object, landing-burst |  | 10 | 12 | stay 1.8 m from embers | emberFlight.ts |
| R | Firebird | line | line-dash | fuse |  | 24 | 12 | leave the 3 m lane in 1.0 s | firebird.ts |

**Opaline** (`src/heroes/prism/hero.ts`, passive `src/heroes/prism/trait.ts`)

| Slot | Spell | Input | Mechanic | Parts | CC on the enemy (self buffs marked self:) | CD | Range | Counterplay | File |
|---|---|---|---|---|---|---|---|---|---|
| P | Prismatic | - | passive | bounce, reset |  | - | - | - |  |
| Q | Ricochet Light | line | bank-shot | bounce, reset |  | 3 | 12 | watch the bounce line | ricochetLight.ts |
| W | Crystal Pillar | point | terrain | terrain, bounce-surface |  | 12 | 8 | break it (80 HP) | crystalPillar.ts |
| E | Blinding Flare | self | self-nova |  | blind, push | 10 | 0 | stay out of 3 m | blindingFlare.ts |
| R | Shatterlight | unit | unit-ring-delayed | fuse, multi-bolt, bounce |  | 22 | 10 | step out of the ring in 1.2 s | shatterlight.ts |

**Referee Whistler** (`src/heroes/referee/hero.ts`, passive `src/heroes/referee/trait.ts`)

| Slot | Spell | Input | Mechanic | Parts | CC on the enemy (self buffs marked self:) | CD | Range | Counterplay | File |
|---|---|---|---|---|---|---|---|---|---|
| P | By the Book | - | passive | rules, punish | silence | - | - | obey the rule or take the card |  |
| Q | Whistle Blast | line | skillshot |  |  | 3.5 | 8 | sidestep | whistleBlast.ts |
| W | No Running | self | auto-target-rule | conditional-debuff | ground(no dash) | 9 | 7 | do not dash for 3 s, or take a card | noRunning.ts |
| E | No Casting | self | auto-target-rule | conditional-debuff | silence(soft) | 13 | 7 | do not cast for 2 s, or take a card | noCasting.ts |
| R | Show the Card | point | ground-fuse | fuse, sight-check, conditional-debuff | silence(red) | 24 | 9 | leave the spot or break sight in 0.6 s | showTheCard.ts |

**Sefu** (`src/heroes/sand/hero.ts`, passive `src/heroes/sand/trait.ts`)

| Slot | Spell | Input | Mechanic | Parts | CC on the enemy (self buffs marked self:) | CD | Range | Counterplay | File |
|---|---|---|---|---|---|---|---|---|---|
| P | Pharaoh's Decree | - | passive | mark, reset | vulnerable, half-dash | - | - | - |  |
| Q | Cobra Spit | line | skillshot | reset-on-mark | blind | 5 | 9 | step off the line | cobraSpit.ts |
| W | Shepherd's Crook | unit | unit-target | sure-hit, mark | pull, slow | 10 | 6 | none once cast (sight at cast) | shepherdsCrook.ts |
| E | Scarab Stride | point | line-dash | dot |  | 12 | 11 | the 6 m line shows as he starts (card range 11 is the click reach) | scarabStride.ts |
| R | Sarcophagus | unit | unit-mark-delayed | fuse, mark | sealed | 24 | 9 | step out of the 1.6 m circle in 0.7 s | sarcophagus.ts |

**Nyx** (`src/heroes/shadow/hero.ts`, passive `src/heroes/shadow/trait.ts`)

| Slot | Spell | Input | Mechanic | Parts | CC on the enemy (self buffs marked self:) | CD | Range | Counterplay | File |
|---|---|---|---|---|---|---|---|---|---|
| P | Umbral Veil | - | passive | camouflage, empower | silence | - | - | keep hitting her; she is still targetable |  |
| Q | Umbral Cut | unit | unit-mark-delayed | backstab |  | 4 | 2.5 | leave 3.2 m within 0.35 s; face her | umbralCut.ts |
| W | Smoke Veil | self | self-zone | zone, camouflage | blind | 12 | 0 | leave the 3 m smoke | smokeVeil.ts |
| E | Shadow Double | point | dash | through-walls, summon |  | 10 | 4 | kill the copy (40 HP) | shadowDouble.ts |
| R | Nightfall | self | self-buff | buff, refade | self: haste,  might | 24 | 0 | wait out 5 s; she is slowed after | nightfall.ts |

**Kagen (draft)** (`src/heroes/sheath/hero.ts`, passive `src/heroes/sheath/trait.ts`)

| Slot | Spell | Input | Mechanic | Parts | CC on the enemy (self buffs marked self:) | CD | Range | Counterplay | File |
|---|---|---|---|---|---|---|---|---|---|
| P | Scarlet Sheath | - | passive | stacks, detonate | slow | - | - | stay out of reach 5 s; marks fade |  |
| Q | Issen | line | line-dash | fuse, mark |  | 6 | 6 | leave the 1.2 m line in 0.45 s | issen.ts |
| W | Noto | self | self-nova | fuse, detonate, parry |  | 7 | 0 | leave the 3.5 m ring in 0.5 s; do not hit into the click | noto.ts |
| E | Senbon | point | ground-fuse | fuse, multi-wave, mark |  | 11 | 8 | leave the 3 m ring in 1.0 s | senbon.ts |
| R | Sekai-giri | line | line-area | fuse, detonate-anywhere |  | 26 | 12 | leave the 2.4 m line in 1.3 s | sekaiGiri.ts |

**Bo** (`src/heroes/sheep/hero.ts`, passive `src/heroes/sheep/trait.ts`)

| Slot | Spell | Input | Mechanic | Parts | CC on the enemy (self buffs marked self:) | CD | Range | Counterplay | File |
|---|---|---|---|---|---|---|---|---|---|
| P | Wool Over Your Eyes | - | passive | stacks, summon | polymorph | - | - | kill sheep, lead them off |  |
| Q | Crook Whack | self | cone-quick | summon-on-hit |  | 3.5 | 4 | stay out of 4 m | crookWhack.ts |
| W | Spare Sheep | point | summon | summon, chaser, stacks |  | 8 | 8 | kill them (30 HP) or stand near Bo | spareSheep.ts |
| E | Shear | line | skillshot | needs-summon, stacks |  | 11 | 8 | step off the line | shear.ts |
| R | Stampede | line | line-area | fuse, multi-hit, stacks |  | 22 | 12 | leave the 4 m line in 0.8 s | stampede.ts |

**Zephyr** (`src/heroes/sky/hero.ts`, passive `src/heroes/sky/trait.ts`)

| Slot | Spell | Input | Mechanic | Parts | CC on the enemy (self buffs marked self:) | CD | Range | Counterplay | File |
|---|---|---|---|---|---|---|---|---|---|
| P | Following Wind | - | passive | stacks, attack-reset |  | - | - | - |  |
| Q | Crosswind | enemies | cone-quick | recast-dash |  | 4 | 3 | stay out of 3 m | crosswind.ts |
| W | Skyward | point | leap | untargetable, attack-reset | knockup | 8 | 5 | leave the 1.4 m landing circle | skyward.ts |
| E | Feather Step | line | dash | ammo(2), attack-reset |  | 7 | 4 | - | featherStep.ts |
| R | Sky Rend | unit | unit-target-delayed | sight-check, untargetable, multi-hit, reposition |  | 24 | 7 | break sight or get 9 m away during the 0.8 s stand | skyRend.ts |

**Kaia** (`src/heroes/storm/hero.ts`, passive `src/heroes/storm/trait.ts`)

| Slot | Spell | Input | Mechanic | Parts | CC on the enemy (self buffs marked self:) | CD | Range | Counterplay | File |
|---|---|---|---|---|---|---|---|---|---|
| P | Lightning Rods | - | passive | ground-objects |  | - | - | ground the rods (stand within 1 m) |  |
| Q | Sky Strike | unit | unit-target-delayed | sure-hit, leaves-object |  | 4 | 7 | none once cast (sight at cast) | skyStrike.ts |
| W | Thunder Rod | point | ground-zone | zone, recast | slow | 9 | 9 | leave 3.5 m | thunderRod.ts |
| E | Polarity | unit | unit-target-delayed | sure-hit, conditional | pull, stun | 11 | 8 | stay 4 m+ from her rods | polarity.ts |
| R | Supercell Storm | self | self-aura | zone, auto-target-strikes |  | 24 | 0 | keep moving; each bolt marks 0.6 s ahead | supercellStorm.ts |

**Big Yoko** (`src/heroes/sumo/hero.ts`, passive `src/heroes/sumo/trait.ts`)

| Slot | Spell | Input | Mechanic | Parts | CC on the enemy (self buffs marked self:) | CD | Range | Counterplay | File |
|---|---|---|---|---|---|---|---|---|---|
| P | Dohyo | - | passive | ring-out | stun | - | - | stay out of the ring, or in its middle |  |
| Q | Palm Strike | self | strike-facing | conditional | push | 3 | 2.8 | stay out of 2.8 m in front | palmStrike.ts |
| W | Stomp | self | self-nova | fuse, zone | slow | 11 | 0 | leave 3 m in 0.5 s | stomp.ts |
| E | Sumo Charge | point | line-dash | carry | carry | 10 | 6 | the strip shows 0.4 s | sumoCharge.ts |
| R | Salt Throw | self | cone-quick | fuse, self-haste | blind | 22 | 0 | leave the 6 m cone in 0.6 s | saltThrow.ts |

**Marin** (`src/heroes/tide/hero.ts`, passive `src/heroes/tide/trait.ts`)

| Slot | Spell | Input | Mechanic | Parts | CC on the enemy (self buffs marked self:) | CD | Range | Counterplay | File |
|---|---|---|---|---|---|---|---|---|---|
| P | Turning Tide | - | passive | stance(auto) |  | - | - | the ring shows the tide and the time left |  |
| Q | Wave Disc | line | skillshot | stance-dependent | push|pull | 4 | 9 | step off the line | waveDisc.ts |
| W | Coral Spire | point | terrain | fuse, terrain, stance-dependent | push|pull | 9 | 8 | leave 2.5 m in 0.9 s | coralSpire.ts |
| E | Mist Form | point | dash | untargetable, flips-stance |  | 10 | 6 | - | mistForm.ts |
| R | Moon's Pull | self | channel | channel, self-root, interruptible | pull | 22 | 12 | stun/silence her; break sight; walk away | moonPull.ts |

**Hank** (`src/heroes/timber/hero.ts`, passive `src/heroes/timber/trait.ts`)

| Slot | Spell | Input | Mechanic | Parts | CC on the enemy (self buffs marked self:) | CD | Range | Counterplay | File |
|---|---|---|---|---|---|---|---|---|---|
| P | Fresh Cut | - | passive | growing-terrain |  | - | - | break saplings early |  |
| Q | Axe Swing | self | cone-quick | fells-terrain |  | 3 | 3 | stay out of 3 m and off his tree strips | axeSwing.ts |
| W | Fast Growth | point | terrain | fuse, terrain, ammo(2) | knockup | 7 (2 charges) | 6 | leave 1.5 m in 0.7 s | fastGrowth.ts |
| E | Caber Toss | line | skillshot | consume-object | knockback | 9 | 9 | step off the line | caberToss.ts |
| R | Timber Call | line | terrain | terrain, recast | - | 24 | 10 | stay off the row's fall line | timberCall.ts |

**Pim and Pom** (`src/heroes/twins/hero.ts`, passive `src/heroes/twins/trait.ts`)

| Slot | Spell | Input | Mechanic | Parts | CC on the enemy (self buffs marked self:) | CD | Range | Counterplay | File |
|---|---|---|---|---|---|---|---|---|---|
| P | Tag Team | - | passive | two-forms, shared-hp, heal |  | - | - | hit the tag (0.5 s still) |  |
| R | Tag Out | self | form-swap | form, anytime, heal |  | 8 | 0 | hit the 0.5 s swap | tagOut.ts |
| Q | Pebble (Pom) | line | skillshot |  |  | 3 | 9 | sidestep | pomPebble.ts |
| W | Snare (Pom) | point | ground-fuse | fuse | root | 9 | 7 | leave 2 m in 1 s | pomSnare.ts |
| E | Backflip (Pom) | point | dash | escape, leaves-fuse |  | 10 | 4 | leave 1.5 m of the popper | pomBackflip.ts |
| Q | Bonk (Pim) | point | cone-aimed |  |  | 3 | 3 | stay out of 3 m | pimBonk.ts |
| W | Charge (Pim) | point | line-dash |  |  | 9 | 5 | leave the lane | pimCharge.ts |
| E | Shield Up (Pim) | self | self-shield | shield |  | 10 | 0 | wait 2 s | pimShieldUp.ts |

**Oblivion** (`src/heroes/void/hero.ts`, passive `src/heroes/void/trait.ts`)

| Slot | Spell | Input | Mechanic | Parts | CC on the enemy (self buffs marked self:) | CD | Range | Counterplay | File |
|---|---|---|---|---|---|---|---|---|---|
| P | Deep Gravity | - | passive | stand-still-aura | pull | - | - | make him move; break sight |  |
| Q | Gravity Slam | self | self-nova |  | pull | 4 | 3 | stay out of 3 m | gravitySlam.ts |
| W | Null Zone | self | self-zone | zone, projectile-block | silence | 12 | 0 | leave the 3 m sphere | nullZone.ts |
| E | Phase Step | point | blink | fuse, empower-attack | weaken | 14 | 4 | - | phaseStep.ts |
| R | Void Black Hole | line | moving-zone | zone, recast | pull, stun | 24 | 8 | walk out of its 5 m pull; avoid the core | blackHole.ts |

**Barry Cloudsley** (`src/heroes/weather/hero.ts`, passive `src/heroes/weather/trait.ts`)

| Slot | Spell | Input | Mechanic | Parts | CC on the enemy (self buffs marked self:) | CD | Range | Counterplay | File |
|---|---|---|---|---|---|---|---|---|---|
| P | And Now the Weather | - | passive | global, forecast | slow, heal, push | - | - | read the forecast |  |
| Q | Cold Front | line | skillshot | weather-dependent | slow|knockback | 3.5 | 9 | step off the line | coldFront.ts |
| W | Lightning Risk | point | ground-fuse | fuse |  | 9 | 9 | leave 1.5 m in 0.8 s | lightningRisk.ts |
| E | Forecast Update | self | global-switch | global, costs-other-cd |  | 12 | 0 | - | forecastUpdate.ts |
| R | Severe Warning | point | moving-hazard | fuse, chaser, zone | - | 24 | 9 | walk away (you are faster) | severeWarning.ts |

**Grandma Ironknit** (`src/heroes/yarn/hero.ts`, passive `src/heroes/yarn/trait.ts`)

| Slot | Spell | Input | Mechanic | Parts | CC on the enemy (self buffs marked self:) | CD | Range | Counterplay | File |
|---|---|---|---|---|---|---|---|---|---|
| P | Keep Warm | - | passive | tripwire |  | - | - | cut a line with any hit |  |
| Q | Knitting Needle | line | skillshot |  |  | 3.5 | 9 | step off the line | knittingNeedle.ts |
| W | Cast On | point | terrain | tripwire, ammo(2) | root, slow | 0.6 (2 charges, 6 s) | 9 | cut it with one hit; walk round | castOn.ts |
| E | Sweater | unit | unit-target | travel, sight-check, delayed-damage | slow | 11 | 7 | reach cover within 0.5 s | sweater.ts |
| R | Mr. Biscuit | enemies | summon | summon, chaser | slow | 24 | 0 | (card range 0 with an enemies mode: unclear what the click asks) shoot him (200 HP) or lead him to a cut line | mrBiscuit.ts |



### Inferences
- **What our "targeted" means differs from League's point-and-click.** A League targeted spell (Annie Q, Veigar R) lands once cast. Ours split three ways:
  - 8 are true sure hits (sight checked only at the cast).
  - Most of the rest re-check sight at the impact, so stepping behind a pillar answers them. This works like a Dota projectile dodged by losing vision, though Dota's disjoint works by blinking (uncited).
  - 7 only fix a spot that can be walked out of, which makes them ground spells with a unit-click input: Meteor Mark, Grave Grasp, Sinkhole, Sarcophagus, Umbral Cut, Grand Finale and Shatterlight.
- **Q is the rhythm slot, E is the move slot.** 60% of Q are skillshots and 26% are no-aim melee cones, with a median cooldown of 3.5 s. 40% of E are a dash, blink or leap. W is the "place something" slot: ground circles 21%, terrain 21%. R is spread out, and 6 of 41 ultimates mark a spot to step out of. This matches League's own slot habits (Q direction 52%, E dash 28%) but is more templated by aim on Q.
- **Terrain is our signature, not League's.** 11 kits build real obstacles, portals or tripwires (Fenna, Chef, Wick, Gus, Bram, Mum, Silvane, Opaline, Marin, Hank, Ironknit). Several more read cover as a condition: Lyra's pin, Sir Whiskers's pot, Bram's wall stun, Courier's "touch cover", Ada's grapple.
- **CC is light per spell and spread wide.** 29 of 167 spells carry hard CC (stun, root, knock-up, charm, stasis or cage), 18 slow and 24 displace (push or pull). No spell suppresses, taunts or fears. Polymorph exists only as Bo's passive (5 Wool: a sheep for 1 s).

### Gaps
- Kagen's numbers are templated in his tooltips (`${Q.range}`). They are resolved here from `src/heroes/sheath/numbers.ts`. His HP and mark numbers (`P`) are not listed.
- Some tooltips may be out of date against the spell files' numbers. Only cooldowns and ranges were read from the cards, not checked against the effect files.
- The "sure hit or not" judgement comes from the header comments. It was not tested in a fight.
- `docs/catalog/heroes/README.md` calls Brannoc's Q "HOOK pull" and Sefu's E "DASH bite". Those match. Its roles table still lists some older shapes (for example "Vesper | TGT needle + recast rip"). The row-by-row agreement of that table with the cards was not audited.

## 2. Every tool spell, briefly

### Takeaway
The tool page offers 167 aimable (targeted) tool spells:
- 56 VFX showcases and 15 cinematic "hero tier" cutscenes;
- 59 spells from heroes' earlier kits;
- the gallery of 20;
- Kagen's 4 parked as tool spells;
- 13 mechanics tests.

37 more effects (iconic 20, paladin 13, original 4) have no targeting and cannot be aimed. Without the 13 tests that is 154 + 37 = 191 spell-like effects, which is probably the "about 190" in the request. By mechanics the tool spells lean to ground circles (19%), click-an-enemy (16%), skillshots (15%) and multi-target or homing volleys (10%). Most showcases are looks, not rules: 55 of the 71 showcases and cinematics carry no CC, and neither do 109 of all 167. Their "lift" is a visual offset, not a knock-up.

### Cited Findings
- **The registered list** (`targetedModules`):
  - 62 showcases and cinematics;
  - Kagen's four, parked as tool spells only where drafts are hidden;
  - the gallery's 20;
  - 68 older-kit and later spells;
  - 13 tests;
  - then `gameModules`: every hero spell, plus `burrow`, which a Raid boss casts by label.

  143 module entries and 4 + 20 spread in, so 167 tool spells. — [src/spells/targeted/index.ts lines 150-300](../../../src/spells/targeted/index.ts); [src/spells/targeted/game.ts](../../../src/spells/targeted/game.ts); [src/spells/targeted/gallery/index.ts](../../../src/spells/targeted/gallery/index.ts)
- **The gallery spells are on the tool page only, never in the game.** They were made 2026-11-19 at the user's request, "lets make more like this effects ... 20 more spells in like different action and different style". — [src/spells/targeted/gallery/index.ts lines 14-18](../../../src/spells/targeted/gallery/index.ts); [pipeline/designs/gallery-20.md](../../../pipeline/designs/gallery-20.md)
- **Other categories:**
  - The effect catalog counts 287 effects in 48 categories plus 13 tests: set pieces 8, paladin 13, iconic 20, original 4, targeted 68, weapons 5, weapon attacks 5, and the heroes' categories.
  - The iconic, paladin and original folders declare no `targeting`, so hero mode answers "not a targeted effect".
  - — [docs/catalog/effects.md lines 7-75](../../catalog/effects.md); grep `targeting:` in `src/spells/{iconic,paladin,original,weapons}` finds none; [docs/architecture/hero-mode.md line 88](../../architecture/hero-mode.md)
- `src/spells/targeted/brushstroke.ts` is the base of `echoBrushstroke.ts`, which registers the same label `brushstroke`, so it is listed once. — [src/spells/targeted/echoBrushstroke.ts lines 90-93](../../../src/spells/targeted/echoBrushstroke.ts)

#### Tool spells, one line each

Input is the `targeting` mode (`unit` = enemy, `enemies` = several chosen or chained, `point` = ground, `self`). The tool page has no aim strip: a click picks the enemy or the spot. Group: `showcase` = VFX reference spells, `cinematic` = hero-tier cutscenes (8 to 60 s), `old-kit(theme)` = spells of a hero's earlier kit, `gallery` = the twenty of 2026-11-19 (pipeline/designs/gallery-20.md), `sheath` = Kagen's four parked as tool spells, `test` = mechanics tests. Files under `src/spells/targeted/` unless a path is given.

| # | Spell | Group | Input | Mechanic | CC | What it does | File |
|---:|---|---|---|---|---|---|---|
| 1 | starbreaker lance | showcase | unit | unit-target |  | lance hurled on an arc, detonates on the target (reference spell) | starbreakerLance.ts |
| 2 | glacial ricochet | showcase | enemies | chain |  | orb ricochets target to target, each hop faster and bigger | glacialRicochet.ts |
| 3 | cataclysm sigil | showcase | point | ground-fuse |  | burning sigil countdown, meteor falls on it | cataclysmSigil.ts |
| 4 | abyssal gaze | showcase | unit | beam-channel |  | channelled beam from a void eye onto one enemy | abyssalGaze.ts |
| 5 | parts showcase | showcase | enemies | multi-target |  | exercises every part of the effect kit; lightning locks onto each target | partsShowcase.ts |
| 6 | tempest lattice | showcase | enemies | chain |  | bolt hops through every chosen enemy and closes into a cage | tempestLattice.ts |
| 7 | gale bullet | showcase | unit | unit-target | lift | wind ball bursts into a cyclone that lifts and grinds the target | galeBullet.ts |
| 8 | cinder bow | showcase | unit | unit-target |  | fan of flame ribbons and a fireball from a golden ring | cinderBow.ts |
| 9 | ember comet | showcase | point | ground-fuse |  | comet shadow grows at the point, rock slams down | emberComet.ts |
| 10 | violet severance | showcase | unit | beam |  | beam snaps out and cuts 6 m past the target | violetSeverance.ts |
| 11 | jade dragon ascension | showcase | point | ground-fuse | lift | ribbon dragon rises from a sigil and dives back down | jadeDragonAscension.ts |
| 12 | hundred lily frost | showcase | enemies | multi-target | hold-in-place(visual) | crystal buds punch up under each enemy and open | hundredLilyFrost.ts |
| 13 | taiji thunder seal | showcase | unit | unit-delayed |  | taiji seal spins over the enemy, one thick bolt falls | taijiThunderSeal.ts |
| 14 | golden bell sutra | showcase | self | self-nova |  | giant bell lands over the caster and rings outward | goldenBellSutra.ts |
| 15 | ink moon severance | showcase | enemies | multi-target |  | brush line through the chosen enemies, a crescent cut | inkMoonSeverance.ts |
| 16 | vermilion phoenix dive | showcase | unit | unit-target |  | drawn phoenix dives on the enemy | vermilionPhoenixDive.ts |
| 17 | red lotus inferno | showcase | point | ground-zone |  | fire lotus ticks the enemies inside then erupts | redLotusInferno.ts |
| 18 | nine tail foxfire | showcase | enemies | homing-multi |  | nine wisps on curved seeking arcs, one per target | nineTailFoxfire.ts |
| 19 | paper crane blizzard | showcase | enemies | homing-multi |  | origami cranes dive on up to six enemies | paperCraneBlizzard.ts |
| 20 | mirror ice prison | showcase | unit | unit-delayed | encase(visual) | six ice mirror panels close round one enemy | mirrorIcePrison.ts |
| 21 | flying sword formation | showcase | point | ground-fuse |  | 36 swords on a sky sigil rain onto the spot | flyingSwordFormation.ts |
| 22 | thunder god drums | showcase | point | ground-zone |  | ring of drums beats faster, strikes the area | thunderGodDrums.ts |
| 23 | bamboo leaf gale | showcase | unit | unit-target |  | crescent of leaves swept at one enemy | bambooLeafGale.ts |
| 24 | jade imperial seal | showcase | unit | unit-delayed |  | giant jade seal slams the target | jadeImperialSeal.ts |
| 25 | cloud step cyclone | showcase | self | self-nova | pull,lift | cloud funnel drags in and lifts enemies near the caster | cloudStepCyclone.ts |
| 26 | heavenly buddha palm | showcase | point | ground-fuse |  | colossal palm descends on the spot | heavenlyBuddhaPalm.ts |
| 27 | golden halberd comet | showcase | unit | unit-target |  | halberd hurled like a comet, pierces and plants | goldenHalberdComet.ts |
| 28 | ghost lantern procession | showcase | enemies | homing-multi |  | six lanterns peel off to their own targets | ghostLanternProcession.ts |
| 29 | shadow puppet execution | showcase | unit | unit-delayed |  | shadow-play puppets spear the target behind a screen | shadowPuppetExecution.ts |
| 30 | spider lily soul field | showcase | point | ground-zone |  | lily field ticks, then snaps shut | spiderLilySoulField.ts |
| 31 | taotie bronze maw | showcase | point | ground-fuse | lift | bronze mask halves close on the area | taotieBronzeMaw.ts |
| 32 | supernova seed | showcase | unit | unit-delayed |  | a star planted behind the enemy goes supernova | supernovaSeed.ts |
| 33 | clockwork judgement | showcase | point | ground-fuse |  | clock face ticks to twelve, gears topple inward | clockworkJudgement.ts |
| 34 | kraken grasp | showcase | enemies | multi-target | lift | a tentacle bursts up under each enemy | krakenGrasp.ts |
| 35 | bifrost strike | showcase | point | ground-fuse |  | rainbow bridge grows from the sky onto a rune circle | bifrostStrike.ts |
| 36 | glitch purge | showcase | enemies | multi-target |  | stepped digital reticles tear each target | glitchPurge.ts |
| 37 | sun disk of ra | showcase | unit | unit-target |  | winged sun disk unfolds and strikes | sunDiskOfRa.ts |
| 38 | genesis collapse | cinematic | enemies | cinematic |  | ~60 s cutscene, caster forges a star in orbit | genesisCollapse.ts |
| 39 | thornwood bloom | showcase | point | ground-fuse |  | briar cage arches over the area, roses burst | thornwoodBloom.ts |
| 40 | titan fist | showcase | unit | unit-delayed | lift | basalt fist uppercuts the enemy | titanFist.ts |
| 41 | jellyfish bloom | showcase | enemies | homing-multi |  | twelve jellyfish drift to up to six targets | jellyfishBloom.ts |
| 42 | checkmate | showcase | unit | unit-delayed |  | chessboard flips in, three pieces attack the target tile | checkmate.ts |
| 43 | orbital lance | showcase | unit | unit-delayed |  | satellite fires a lance onto a hex reticle | orbitalLance.ts |
| 44 | stained glass sanctum | showcase | point | ground-fuse |  | ring of gothic windows, area strike | stainedGlassSanctum.ts |
| 45 | murder of crows | showcase | enemies | homing-multi |  | crows form a raven, then dive on each target | murderOfCrows.ts |
| 46 | hellfire chains | showcase | enemies | multi-target | pull | chains drag the enemies to a fire maw | hellfireChains.ts |
| 47 | colossus drop | cinematic | enemies | cinematic |  | ~45 s cutscene, a mech drops from orbit | colossusDrop.ts |
| 48 | tarot judgement | showcase | enemies | multi-target |  | a tarot card stands behind each enemy and flips | tarotJudgement.ts |
| 49 | great wave | showcase | point | ground-fuse |  | woodblock wave curls over the area | greatWave.ts |
| 50 | tesla coil field | showcase | point | ground-zone |  | four coils arc across the area | teslaCoilField.ts |
| 51 | mammoth stampede | showcase | unit | unit-target | knockback | spirit mammoth charges the enemy | mammothStampede.ts |
| 52 | sandstorm djinn | showcase | self | self-nova | pull,lift | sand funnel and djinn round the caster | sandstormDjinn.ts |
| 53 | aurora veil | showcase | point | ground-fuse |  | aurora curtains descend round the area | auroraVeil.ts |
| 54 | event horizon | cinematic | point | cinematic | pull,lift | hero tier: black hole over the point drags enemies | eventHorizon.ts |
| 55 | hyperion railgun | cinematic | enemies | cinematic |  | ~8.5 s: rail cannon locks on and fires | hyperionRailgun.ts |
| 56 | leviathan breach | cinematic | point | cinematic |  | ~11 s: sea serpent crashes on the point | leviathanBreach.ts |
| 57 | ghost galleon broadside | cinematic | enemies | cinematic |  | ~24 s: a ghost galleon fires broadsides | ghostGalleonBroadside.ts |
| 58 | caldera awakening | cinematic | point | cinematic |  | ~22 s: a volcano grows out of the arena | calderaAwakening.ts |
| 59 | ophanim descent | cinematic | point | cinematic |  | ~22 s: wheels of eyes descend | ophanimDescent.ts |
| 60 | thousand-cut iaido | cinematic | enemies | cinematic |  | ~16 s: time stops, straight-line dashes through enemies | thousandCutIaido.ts |
| 61 | world sever | showcase | unit | unit-target |  | one draw cut through the target (Scarlet Sheath look as a spell) | worldSever.ts |
| 62 | thousand swords | showcase | point | ground-fuse |  | katanas rain in waves, then burst | thousandSwords.ts |
| 63 | issen | sheath | point | line-dash |  | Kagen Q parked as a tool spell (see hero table) | src/heroes/sheath/spells/issen.ts |
| 64 | noto | sheath | self | self-nova |  | Kagen W parked as a tool spell | src/heroes/sheath/spells/noto.ts |
| 65 | senbon | sheath | point | ground-fuse |  | Kagen E parked as a tool spell | src/heroes/sheath/spells/senbon.ts |
| 66 | sekai giri | sheath | point | line-area |  | Kagen R parked as a tool spell | src/heroes/sheath/spells/sekaiGiri.ts |
| 67 | kintsugi shatter | gallery | unit | unit-target |  | sure hit, gold crackle under the target | gallery/kintsugiShatter.ts |
| 68 | carnival masquerade | gallery | unit | blink-behind |  | blink behind the chosen enemy and strike | gallery/carnivalMasquerade.ts |
| 69 | quetzal descent | gallery | point | leap |  | leap up to 9 m, 2.4 m slam, 0.85 s warning | gallery/quetzalDescent.ts |
| 70 | runestone fall | gallery | point | ground-fuse |  | 3.6 m circle, stone lands at 1.4 s, 120 | gallery/runestoneFall.ts |
| 71 | mosaic nova | gallery | self | self-nova | knockback | 6 m ring grows from the caster in 0.8 s, hit as it passes | gallery/mosaicNova.ts |
| 72 | celtic knot snare | gallery | point | trap-fuse | root | 2 m knot binds at 1.5 s: 45 and root 1.4 s | gallery/celticKnotSnare.ts |
| 73 | watercolour vortex | gallery | point | ground-fuse | pull | 3.5 m whirlpool at 1.6 s drags up to 4 m to the centre | gallery/watercolourVortex.ts |
| 74 | mandala unbinding | gallery | point | ground-fuse | knockback | 4 m circle swept at 1.75 s: 120 and knocked out | gallery/mandalaUnbinding.ts |
| 75 | molten glass bloom | gallery | point | cone-aimed |  | 6.2 m 66 degree cone judged at 1.2 s | gallery/moltenGlassBloom.ts |
| 76 | charcoal tempest | gallery | point | sweeping-beam |  | beam swept across a 100 degree fan for 1.5 s after 0.9 s | gallery/charcoalTempest.ts |
| 77 | solar orrery | gallery | self | auto-target-multi |  | planets fly to up to five enemies within 7 m | gallery/solarOrrery.ts |
| 78 | art deco arc | gallery | unit | chain |  | sure hit, then hops to up to three more enemies | gallery/artDecoArc.ts |
| 79 | coral bastion | gallery | point | lane-front |  | reef grows along an 8 m lane, front hits once (not an obstacle) | gallery/coralBastion.ts |
| 80 | gargoyle swoop | gallery | point | lane-front | knockback | gargoyle swoops an 11 m lane | gallery/gargoyleSwoop.ts |
| 81 | whiplash fissure | gallery | point | lane-front | knockup | vine races down an 11 m crack, short knock-up | gallery/whiplashFissure.ts |
| 82 | venom orchid | gallery | unit | mark-detonate |  | orchid on the enemy pulses, then detonates | gallery/venomOrchid.ts |
| 83 | geode heart | gallery | point | skillshot | push | slow heavy stone, cracks open where it stops | gallery/geodeHeart.ts |
| 84 | arabesque fan | gallery | point | fan |  | five tile stars in a 50 degree fan, each a bolt | gallery/arabesqueFan.ts |
| 85 | crescent return | gallery | point | boomerang |  | crescent out along 9 m and back, hits both ways | gallery/crescentReturn.ts |
| 86 | whalebone harpoon | gallery | point | hook | pull | 11 m hook drags the first enemy 3.5 m | gallery/whaleboneHarpoon.ts |
| 87 | lunar tide | cinematic | point | cinematic | lift | ~20 s: the moon comes down | lunarTide.ts |
| 88 | abyssal angler | cinematic | point | cinematic | pull | ~18 s: enemies drift to a lure, anglerfish strikes | abyssalAngler.ts |
| 89 | supercell | cinematic | point | cinematic | pull,lift | ~20 s: tornado pulls and spins enemies | supercell.ts |
| 90 | world tree rising | cinematic | point | cinematic | lift | ~22 s: colossal tree grows from a seed | worldTreeRising.ts |
| 91 | hourglass of ages | cinematic | point | cinematic |  | ~18 s: hourglass traps the enemies | hourglassOfAges.ts |
| 92 | midnight circus | cinematic | enemies | cinematic |  | ~20 s: big top erupts round the enemies | midnightCircus.ts |
| 93 | hemolance | old-kit(blood) | point | skillshot |  | 8 m line, blood hardens into a crystal lance | hemolance.ts |
| 94 | blood step | old-kit(blood) | point | dash | slow | 5 m blink leaving a wounding thorn strip | bloodStep.ts |
| 95 | crimson pact | old-kit(blood) | self | tether-drain |  | heartbeat drains the nearest enemy within 6 m, heals | crimsonPact.ts |
| 96 | blood bond | old-kit(blood) | unit | mark-detonate |  | mark tallies her damage, then pops | bloodBond.ts |
| 97 | slag flick | old-kit(forge) | point | skillshot | slow | 7 m slag skillshot | slagFlick.ts |
| 98 | anvil drop | old-kit(forge) | point | ground-fuse | slow | small lob, radius 2 | anvilDrop.ts |
| 99 | bellows ward | old-kit(forge) | self | self-shield | pull | shield plus two chain pulls round him | bellowsWard.ts |
| 100 | forge charge | old-kit(forge) | point | line-dash | carry,stun,root,knockup | 8 m charge carries the first enemy; wall slam | forgeCharge.ts |
| 101 | rime spear | old-kit(frost) | point | skillshot | slow | piercing javelin | rimeSpear.ts |
| 102 | frostfern field | old-kit(frost) | point | line-area | root | 9 m fern strip roots | frostfernField.ts |
| 103 | glacial mantle | old-kit(frost) | self | self-stasis | slow | ice block 1.5 s untouchable, then a blizzard | glacialMantle.ts |
| 104 | glacier wall | old-kit(frost) | point | terrain | slow | 7 m ice wall across the aim line | glacierWall.ts |
| 105 | sand lash | old-kit(sand) | point | skillshot | root | 10 m whip of sand roots | sandLash.ts |
| 106 | quicksand | old-kit(sand) | point | ground-zone | slow,root | lingering zone ticks slow, cobra roots | quicksand.ts |
| 107 | dune surge | old-kit(sand) | point | carry-wave | carry,root | wave 3 m wide rolls 12 m carrying the first enemy | duneSurge.ts |
| 108 | arc lance | old-kit(storm) | enemies | unit-target |  | lightning tree jumps to the target (2 max) | arcLance.ts |
| 109 | ball lightning | old-kit(storm) | point | skillshot-recast | slow | slow orb, recast to blink to it | ballLightning.ts |
| 110 | static field | old-kit(storm) | self | self-nova | stun | ring races out to 5 m, stuns | staticField.ts |
| 111 | thunderlance | old-kit(storm) | point | charged-skillshot |  | held to charge (x0.6-1.5), 20 m piercing line | thunderlance.ts |
| 112 | umbral blink | old-kit(shadow) | unit | blink-to-target |  | blinks to the target and slashes | umbralBlink.ts |
| 113 | shadow swap | old-kit(shadow) | point | skillshot-recast |  | dagger she can swap to (recast teleport) | shadowSwap.ts |
| 114 | night shroud | old-kit(shadow) | self | fan-quick |  | three clone bolts fanned the way she faces | nightShroud.ts |
| 115 | shadow mark | old-kit(shadow) | unit | mark-detonate |  | tallies her damage, she steps out and pops it | shadowMark.ts |
| 116 | bloom lash | old-kit(grove) | unit | unit-target |  | vine coils up the target | bloomLash.ts |
| 117 | overgrowth | old-kit(grove) | unit | unit-delayed | root | root unless the enemy walked 2 m | overgrowth.ts |
| 118 | verdant ward | old-kit(grove) | point | summon |  | flowering turret for 6 s | verdantWard.ts |
| 119 | seed of rebirth | old-kit(grove) | self | cheat-death |  | under 15% HP blooms back up 35% | seedOfRebirth.ts |
| 120 | radiant spear | old-kit(dawn) | point | skillshot |  | piercing spear, shield on hit | radiantSpear.ts |
| 121 | aegis wall | old-kit(dawn) | point | trap-fuse | stun | ring of shields closes like a dome at 1.2 s | aegisWall.ts |
| 122 | radiant parry | old-kit(dawn) | self | parry | stun | timed counter stance: a hit in the window is answered | radiantParry.ts |
| 123 | dawn descent | old-kit(dawn) | point | leap | stun | 12 m leap with a landing zone and shield | dawnDescent.ts |
| 124 | clockwork rivet shot | old-kit(clockwork) | point | skillshot | slow | rivet sticks | clockworkRivetShot.ts |
| 125 | cog turret | old-kit(clockwork) | point | summon |  | turret summon | cogTurret.ts |
| 126 | gear field | old-kit(clockwork) | point | ground-zone | slow | lingering gear field pulses three times | gearField.ts |
| 127 | mag rail | old-kit(clockwork) | point | multi-origin-line |  | rails from her and every turret cross on the point | magRail.ts |
| 128 | prism bolt | old-kit(prism) | point | split-skillshot |  | splits into three on the first hit | prismBolt.ts |
| 129 | refraction field | old-kit(prism) | point | ground-fuse | blind | 4 m blinding zone | refractionField.ts |
| 130 | mirror shell | old-kit(prism) | self | blink-shield |  | 45 shield and a 4 m sideways blink | mirrorShell.ts |
| 131 | spectrum lance | old-kit(prism) | self | beam-channel |  | 2 s held beam sweeping 70 degrees, rooted | spectrumLance.ts |
| 132 | discordant note | old-kit(bard) | point | skillshot |  | note skillshot with an echo | discordantNote.ts |
| 133 | silencing refrain | old-kit(bard) | point | ground-fuse | silence | silence zone, radius 4 | silencingRefrain.ts |
| 134 | ballad of valor | old-kit(bard) | self | self-aura | knockback | two sound rings knock back, then a heal | balladOfValor.ts |
| 135 | crescendo | old-kit(bard) | self | self-nova | pull | R: lyre ultimate round him, radius 5 | crescendo.ts |
| 136 | mandible rend | old-kit(hive) | enemies | cone-quick | slow | double 100 degree claw swipe | mandibleRend.ts |
| 137 | swarm leap | old-kit(hive) | point | leap |  | leap plus two wasp soldiers | swarmLeap.ts |
| 138 | chitin carapace | old-kit(hive) | self | self-buff |  | shell look only; the kit gives armour | chitinCarapace.ts |
| 139 | queen's descent | old-kit(hive) | point | ground-fuse | pull,slow | queen wasp dives, three wasp soldiers | queensDescent.ts |
| 140 | rift cleave | old-kit(void) | enemies | cone-quick | pull | greatsword sweep leaves a tear | riftCleave.ts |
| 141 | null tether | old-kit(void) | point | ground-fuse | pull,slow | tendrils yank everyone in the zone to him | nullTether.ts |
| 142 | void mantle | old-kit(void) | self | self-nova |  | self burst with a rift shell | voidMantle.ts |
| 143 | unmaking | old-kit(void) | point | ground-fuse | pull,silence | R: rift over the point, radius 5 | unmaking.ts |
| 144 | second hand | old-kit(chrono) | point | boomerang | slow | piercing out-and-back | secondHand.ts |
| 145 | stopped moment | old-kit(chrono) | point | ground-fuse | stun | clock dial freezes at 0.75 s | stoppedMoment.ts |
| 146 | quickstep | old-kit(chrono) | point | dash |  | 5 m dash with afterimages | quickstep.ts |
| 147 | unwind | old-kit(chrono) | self | rewind |  | back to where he was 2.5 s ago with that HP | unwind.ts |
| 148 | brushstroke | old-kit(ink) | point | split-skillshot |  | stroke splits into three at max range; echoed by the Ink Double | echoBrushstroke.ts |
| 149 | ink double | old-kit(ink) | point | dash-decoy |  | slides 4 m away, leaves a copy that echoes the next stroke | inkDouble.ts |
| 150 | paper familiars | old-kit(ink) | self | summon |  | two ink cranes that shoot darts | paperFamiliars.ts |
| 151 | final calligraphy | old-kit(ink) | point | curved-skillshot | blind | aim: arc, bows round a pillar | curvingCalligraphy.ts |
| 152 | neon fracture jab | showcase | unit | unit-target |  | dash-punch with impact frames and hit-stop | neonFractureJab.ts |
| 153 | prism overture | showcase | point | ground-fuse |  | ink-and-light star bursts over the area | prismOverture.ts |
| 154 | crimson requiem | showcase | enemies | multi-target |  | red-only world, petals wipe, cut on up to five | crimsonRequiem.ts |
| 155 | status test | test | point | ground-fuse | any(chosen) | 10 damage plus a chosen status at 0.4 s | statusTest.ts |
| 156 | shield test | test | self | self-shield |  | 60 shield for 4 s | shieldTest.ts |
| 157 | heal test | test | self | self-heal |  | +80 HP | healTest.ts |
| 158 | dash test | test | point | dash |  | 0.25 s slide, 2.5 m landing hit | dashTest.ts |
| 159 | cleave test | test | enemies | cone-quick | knockback | 100 degree 3.2 m cone at 0.25 s | cleaveTest.ts |
| 160 | bolt test | test | point | skillshot |  | plain bolt | boltTests.ts |
| 161 | split bolt test | test | point | split-skillshot |  | splits into three on the first hit | boltTests.ts |
| 162 | bounce bolt test | test | point | bounce-skillshot |  | bounces on to the nearest other enemy | boltTests.ts |
| 163 | pierce bolt test | test | point | skillshot |  | fast piercing lance | boltTests.ts |
| 164 | summoner bolt test | test | point | skillshot |  | the summon kit's copy of the plain bolt | boltTests.ts |
| 165 | summon melee test | test | point | summon |  | melee units walk up and hit | summonTests.ts |
| 166 | summon ranged test | test | point | summon |  | ranged units shoot dodgeable bolts | summonTests.ts |
| 167 | turret test | test | point | summon |  | a turret stands and shoots | summonTests.ts |

**Tool spells by input** (n = 167)

| Value | Count | Share |
|---|---:|---:|
| point | 90 | 54% |
| unit | 29 | 17% |
| enemies | 25 | 15% |
| self | 23 | 14% |

**Tool spells by family** (n = 167)

| Value | Count | Share |
|---|---:|---:|
| ground circle / zone | 32 | 19% |
| unit-targeted | 26 | 16% |
| skillshot (line bolt) | 25 | 15% |
| multi-target / chain / homing | 17 | 10% |
| cinematic ultimate | 15 | 9% |
| self nova / aura / cone | 13 | 8% |
| dash / blink / leap | 12 | 7% |
| self buff / shield / heal / save | 8 | 5% |
| lane / line area | 6 | 4% |
| summon | 6 | 4% |
| channel / beam | 4 | 2% |
| trap | 2 | 1% |
| terrain | 1 | 1% |

**Tool spells by group** (n = 167)

| Value | Count | Share |
|---|---:|---:|
| old-kit | 59 | 35% |
| showcase | 56 | 34% |
| gallery | 20 | 12% |
| cinematic | 15 | 9% |
| test | 13 | 8% |
| sheath | 4 | 2% |

**Tool spells by CC or effect (a spell counts once per kind; `lift` is a visual lift, not a status)** (n = 167)

| Value | Count | Share |
|---|---:|---:|
| pull | 14 | 8% |
| slow | 14 | 8% |
| lift | 11 | 7% |
| root | 7 | 4% |
| knockback | 6 | 4% |
| stun | 6 | 4% |
| knockup | 2 | 1% |
| carry | 2 | 1% |
| blind | 2 | 1% |
| silence | 2 | 1% |
| hold-in-place | 1 | 1% |
| encase | 1 | 1% |
| push | 1 | 1% |
| any | 1 | 1% |

**Plus `burrow`** (`src/spells/targeted/burrow.ts`, ground, dash): Sefu's older E. Sefu dives and tunnels 7 m (`ctx.moveCaster`). Hits on him are swallowed while he is under, and he knocks up enemies where he comes out. It is in `gameModules` because a Raid boss or a Climb floor casts it by label.

**The 37 non-targeted effects** have no rules and no aim. They play on the dummies as staged scenes. Their WoW-style mechanic is read from the header comment.
- Iconic (`src/spells/iconic/`):
  - channelled: arcane missiles, army of the dead, blizzard (ground), eye beam, penance;
  - spin: bladestorm, spinning crane kick;
  - chain: chain lightning (five targets);
  - projectile: chaos bolt, death coil, fireball, frostbolt, pyroblast (a long cast);
  - line sweep: deep breath (a dragon down a line);
  - ground: earthquake (a fissure and a big circle), rain of fire, starfall, volley (all ground rain);
  - leap: heroic leap; metamorphosis (a leap and a transform).
- Paladin (`src/spells/paladin/`):
  - avenger's shield: a bouncing throw, three enemies;
  - avenging wrath: a self buff with wings;
  - consecration: a ground zone;
  - crusader strike: a dash strike;
  - divine shield: a self bubble;
  - divine storm: a spin;
  - divine toll: a bell ring;
  - hammer of justice: a stun, the hammer on the target;
  - hammer of wrath: a thrown arc;
  - judgment: a delayed hammer on the target;
  - lay on hands: an ally heal on a kneeling dummy, the only ally-targeted visual in the project;
  - light of dawn: a cone;
  - wake of ashes: a 70 degree fan.
- Original (`src/spells/original/`): corpse finger gravity pull (a central pull), crown of the final star, illusionist rain of doom (five clones), solar verdict.
- Set pieces (8) and weapons and weapon attacks (5 and 5) are not spells. They are listed in `docs/catalog/effects.md`.

### Inferences
- **Mechanics found in tool spells but in no released hero kit:**
  - a sweeping beam held over a fan (Spectrum Lance, Charcoal Tempest; Kagen has no beam);
  - a boomerang that hits out and back (Second Hand, Crescent Return);
  - a split-on-hit bolt (Prism Bolt, Brushstroke);
  - a chain or bounce between enemies (Glacial Ricochet, Tempest Lattice, Art Deco Arc);
  - a multi-origin crossfire (Mag Rail);
  - a rewind to an earlier spot with that HP (Unwind);
  - a timed parry with a stun answer (Radiant Parry);
  - a self stasis in ice (Glacial Mantle);
  - a decoy dash (Ink Double);
  - a recast-to-teleport bolt (Shadow Swap, Ball Lightning);
  - a held charge-up line (Thunderlance);
  - a curving arc shot (Final Calligraphy, `aim: 'arc'`).

  The engine can already do all of these. The kits do not use them: an "already built, unused" shelf for any new kit.
- The multi-target modes (`enemies`, 25 tool spells) have no use in a 1v1 against one hero. They exist for the tool page's packs of dummies, and they would fit the Raid's adds.

### Gaps
- The cinematic spells' rules (damage, statuses) were not read past their header comments. Several apply only `knock` and a visual lift. Whether any applies a status deep in the file was checked only by grepping `status: { kind:`, so a status set in another way could be missed.
- The 37 non-targeted effects are classified by their header only. They have no hit rules to check.

## 3. How a player casts in our game, and the input options the big MOBAs have that ours lacks

### Takeaway
Our input is League's: right-click to walk, Q W E R with three cast modes (normal, quick, and quick with an indicator), an aim strip or circle, walk-into-range casting, and an attack-move. Phones get a joystick and drag-to-aim buttons. Several input forms the big MOBAs use are missing:
- vector (two-point) aiming;
- toggles;
- ally or self targeting with a modifier;
- item and summoner actives;
- skill ranks and level-ups;
- casting while moving: every cast roots the caster until it lands.

### Cited Findings
- **Movement and attacks:**
  - Right-click the ground to walk, as in League. Held, the hero keeps walking at the cursor.
  - Right-click an enemy to attack it.
  - `A` then a left click attack-moves: on an enemy it attacks; on the ground it walks and attacks the first enemy in range.
  - `S` stops.
  - The mouse wheel zooms.
  - — [docs/architecture/hero-mode.md lines 84-96](../../architecture/hero-mode.md)
- **Three cast modes, "League's three"** (the user, 2026-11-12):
  - `normal`: the key shows the aim and a left click fires.
  - `quick`: the key fires at the cursor.
  - `indicator`: the aim shows while the key is held and fires on the release. New players start here.

  A right click or Esc cancels. The mode is kept in `localStorage`. — [src/heroMode.ts lines 17-31](../../../src/heroMode.ts); [docs/architecture/hero-mode.md lines 98-111](../../architecture/hero-mode.md)
- **Self-mode spells cast at once.** `enemy` and `enemies` spells need a live enemy within 2.2 m of the cursor (3.2 m on touch). Ground spells aim at the cursor, clamped to range. — [docs/architecture/hero-mode.md lines 88 and 113](../../architecture/hero-mode.md); [src/heroMode.ts line 51](../../../src/heroMode.ts)
- **Aim indicators:**
  - a range ring;
  - a strip to the hovered enemy, cut flat at cover in a blocked colour;
  - a line strip with an arrow, cut at cover unless `overCover`;
  - a bank shot's first bounce;
  - a ground circle at the clamped cursor;
  - a curving ribbon for `aim: 'arc'`, which bows away from the line to the nearest enemy. Shift flips its side.
  - a hold slot's charge, shown on its button.
  - — [docs/architecture/hero-mode.md lines 115-132](../../architecture/hero-mode.md)
- **Range and casting:**
  - A cast out of range becomes `pending`, and the hero walks into range or sight, then casts. A new move order drops it.
  - A line skillshot never waits: it fires along the aim at once.
  - A cast roots the hero until its danger zone's last impact, at most 2.5 s, or 0.4 s for a spell with no zones.
  - — [docs/architecture/hero-mode.md lines 136-141](../../architecture/hero-mode.md)
- **Second presses:**
  - In a recast window the slot shows RE. The same key casts once more, free, at 60% damage.
  - A recast with `replay: false` (a pop, a pack-up) goes off at once with no aim.
  - A hold slot charges while its key is held, even in quick mode, and fires on the release.
  - — [docs/architecture/hero-mode.md lines 94-95](../../architecture/hero-mode.md); [src/heroMode.ts lines 873-912](../../../src/heroMode.ts)
- **Why a cast is refused:** stunned or silenced, "Your hands are full" (a cast lock), a slot sealed, on cooldown, or the trait's own `canCast` reason ("needs Gerald", "needs an ember", a cost it cannot pay). — [src/heroMode.ts lines 893-912](../../../src/heroMode.ts)
- **Phone and tablet controls:**
  - A floating joystick walks the hero.
  - Each spell slot is also an aim button. A tap casts at the nearest enemy (`aimAuto`). A drag aims, at full range at 120 px. Dragging back onto the button cancels.
  - A round attack button attacks the nearest enemy.
  - Two fingers pinch to zoom.
  - A tap on an enemy attacks it; a tap on the ground walks there.
  - — [src/touch.ts lines 1-41](../../../src/touch.ts); [src/heroMode.ts lines 618-700](../../../src/heroMode.ts); [docs/architecture/hero-mode.md lines 157-174](../../architecture/hero-mode.md)
- **One point per cast.** `CastContext` carries one `point` (the ground aim), one `aim` yaw and the `targets`, plus `bend` for an arc. There is no second point or direction. — [src/effects/targeting.ts lines 66-110](../../../src/effects/targeting.ts)
- **Nothing in a kit toggles.** The passive layer offers `hold`, `charges` and `recast`, and no on/off state. — [src/traits/types.ts lines 325-337](../../../src/traits/types.ts)
- **No items, summoner spells or skill ranks were found:**
  - The shop sells heroes: a card's `shop` is its row in the hero shop.
  - The Raid's upgrades are passive cards picked between fights ("Blue ones are stronger; gold ones change how a fight is played").
  - Searches for summoner spells and item actives in `src/game` and `src/heroMode.ts` found none.
  - — [src/heroes/framework/card.ts lines 20-28](../../../src/heroes/framework/card.ts); [src/raid/upgrades.ts lines 1-30](../../../src/raid/upgrades.ts)
- **League's spells, for comparison:**
  - The usual shape: an innate passive with no ranks, three basics with five ranks, and an ultimate that opens at level 6.
  - The parts: cost, cooldown, ammo, range, a cast time (a quarter, half or one second), channel, charge, recast, toggle, stance or form, summon.
  - — [docs/knowledge/league-champion-kits.md lines 58-79](../league-champion-kits.md)

### Inferences
- **Input forms the big MOBAs have and we lack.** All Dota and Smite examples are from general knowledge (uncited).
  - **Vector targeting** (click a start, drag a direction). League: Viktor E, Rumble R, Irelia E, Taliyah W. Dota: Pangolier's Swashbuckle, Void Spirit's Aether Remnant. Ours: none. The arc aim's side flip is the only second degree of freedom.
  - **Toggles** (on or off, often draining a resource). League: 6% of kits. Dota: Pudge's Rot, Medusa's Mana Shield, Morphling's attribute shift. Ours: 0. Ada's Siege Mode and the twins' Tag Out are the closest, but each is a timed cast.
  - **Self-cast and ally-cast** (Alt+key in League, double-tap in Dota). There are no allies in a 1v1 and no `ally` TargetMode, so every buff is self-only. In the co-op Raid no hero spell can target the partner.
  - **Item actives and summoner spells or relics** (Flash, Ignite; Smite's relics such as Blink and Aegis; Dota's Blink Dagger, Black King Bar). Ours: none, so the whole roster has no shared mobility or answer button.
  - **Skill ranks, levels and the level-6 ultimate.** Ours: full kits from the first second of every round.
  - **Moving while casting.** Many League and Smite abilities can be cast without stopping, or have cast times of a fraction of a second. Ours roots the caster until impact (up to 2.5 s): a long commit on every spell. It is closer to Dota's cast point plus a backswing, but longer.
  - **Smite's third-person reticle** (no click-target at all; uncited). Ours is a top-down click-target game, like League and Dota.
  - **Cast queueing** (Dota's Shift-queue). Ours queues only by walking into range (`pending`).
- **Input forms we have that they lack or rarely use:**
  - A curving skillshot whose bend the player picks (`aim: 'arc'`, Shift flips it). The engine and hero mode support it, but today only the tool spell Final Calligraphy uses it; no released hero card has `aim: 'arc'`. Curving shots are rare in the big three, and their path is not the player's choice.
  - Cast-on-the-beat rhythm timing (Cantor). League's closest is a Seraphine-like passive (uncited).
  - Bank shots shown in the aim line (Opaline, Silvane).
  - Portals that bolts also pass through (Wick).

### Gaps
- No local source covers Dota 2 or Smite input. Every claim about them above is from memory and marked uncited.
- I did not check whether the CPU or a network duel allow any input that the HUD hides, such as quick casting by double-tapping.
- I did not test the touch controls on a real phone. `docs/STATUS.md` says touch was checked only by dispatched pointer events.

## 4. Counts, and the gaps against League, Dota 2 and Smite

### Takeaway
By kit, against League's 173 champions:

| Part | Ours | League |
|---|---:|---:|
| Terrain | 27% | 10% |
| Pull | 17% | 16% |
| Ammo | 17% | 17% |
| Summon | 17% | 19% |
| Recast | 27% | 47% |
| Channel | 7% | 26% |
| Charge-up | 2% | 9% |
| Toggle | 0% | 6% |
| Shield | 12% | 35% |
| Heal | 10% | 49% |
| Hard CC | 59% | 75% |
| Dash or blink | 54% | 65% |

We are well above League on terrain, and level on pull, ammo and summons. We are far below on every other row. Across the big three, our largest holes are:
- input forms: vector aiming, toggles, true channels, charge-ups;
- defensive answer buttons: spell shields, cleanses, spell immunity, item actives;
- CC kinds: taunt, fear, suppression, sleep;
- ally-targeted spells.


### Cited Findings
- **League's counts** (173 kits, tagged from the official wiki on 2026-11-04):
  - Effects: dash 58%, blink 13%, shield 35%, heal 49%, hard CC 75%, pull 16%, untargetable 18%, stealth 12%, terrain 10%, block 9%, invulnerable 6%, execute 13%, reset 27%, attack reset 26%.
  - Parts: recast 47%, channel 26%, summon 19%, ammo 17%, form change 12%, charge 9%, stance 9%, toggle 6%.
  - By slot: R is global in 5% of kits; R channels in 17%.
  - — [docs/knowledge/league-champion-kits.md lines 81-160](../league-champion-kits.md)
- **What the engine has that no released hero or spell uses.** The engine pieces built for a planned set of twenty new heroes include:
  - `sleep` (and waking on a hit);
  - `ward` (a line or circle that no spell crosses);
  - `leash` (cannot go farther than r from an anchor);
  - `holdWalk` / `holdDash` ground (stops one side's walking only);
  - `swap` (trade places);
  - `seal` (disable one slot);
  - `fizzleDash`;
  - `unseen` (no one-target spell can pick the hero);
  - `cleanse` (end chosen statuses);
  - `token` (an object passed by hits);
  - `noteCast` / `lastCast` (copy the enemy's last spell).

  A grep for `mechFor(` and `t.mech` over `src/heroes` and `src/spells` finds no user, so all of these sit idle. — [src/mech/index.ts lines 1-560](../../../src/mech/index.ts); [pipeline/designs/heroes20-engine.md](../../../pipeline/designs/heroes20-engine.md)

#### Tallies of the hero spells (counted by script from the rows in section 1)


**Hero spells by input** (n = 167)

| Value | Count | Share |
|---|---:|---:|
| point | 52 | 31% |
| self | 44 | 26% |
| line | 41 | 25% |
| unit | 27 | 16% |
| enemies | 3 | 2% |

**Hero spells by mechanic** (n = 167)

| Value | Count | Share |
|---|---:|---:|
| skillshot | 27 | 16% |
| ground-fuse | 13 | 8% |
| terrain | 13 | 8% |
| cone-quick | 10 | 6% |
| dash | 10 | 6% |
| unit-target | 9 | 5% |
| self-buff | 7 | 4% |
| self-nova | 7 | 4% |
| unit-target-delayed | 7 | 4% |
| summon | 5 | 3% |
| unit-mark-delayed | 5 | 3% |
| line-dash | 5 | 3% |
| self-shield | 4 | 2% |
| line-area | 4 | 2% |
| trap | 3 | 2% |
| remote-trigger | 3 | 2% |
| unit-projectile | 2 | 1% |
| channel | 2 | 1% |
| fan | 2 | 1% |
| leap | 2 | 1% |
| blink | 2 | 1% |
| ground-zone | 2 | 1% |
| unit-ring-delayed | 2 | 1% |
| dash-to-object | 2 | 1% |
| bank-shot | 2 | 1% |
| auto-target-rule | 2 | 1% |
| self-zone | 2 | 1% |
| stance | 1 | 1% |
| homing-object | 1 | 1% |
| self-vanish | 1 | 1% |
| moving-terrain | 1 | 1% |
| blink-via-object | 1 | 1% |
| nova-bolts | 1 | 1% |
| self-aura | 1 | 1% |
| strike-facing | 1 | 1% |
| form-swap | 1 | 1% |
| cone-aimed | 1 | 1% |
| moving-zone | 1 | 1% |
| global-switch | 1 | 1% |
| moving-hazard | 1 | 1% |

**Hero spells by family** (n = 167)

| Value | Count | Share |
|---|---:|---:|
| skillshot (bolt / bank / fan) | 32 | 19% |
| dash / blink / leap | 22 | 13% |
| unit-targeted | 19 | 11% |
| no-aim cone / strike / nova | 19 | 11% |
| ground circle / zone | 16 | 10% |
| self buff / shield / vanish | 15 | 9% |
| terrain / wall / portal | 14 | 8% |
| unit-targeted (marks a spot, dodgeable) | 7 | 4% |
| summon | 5 | 3% |
| remote trigger / switch | 5 | 3% |
| line area (telegraphed lane) | 5 | 3% |
| channel / stance | 3 | 2% |
| trap | 3 | 2% |
| rule on the enemy (auto-targeted) | 2 | 1% |

**Slot Q by family** (n = 42)

| Value | Count | Share |
|---|---:|---:|
| skillshot (bolt / bank / fan) | 25 | 60% |
| no-aim cone / strike / nova | 11 | 26% |
| unit-targeted | 3 | 7% |
| ground circle / zone | 1 | 2% |
| unit-targeted (marks a spot, dodgeable) | 1 | 2% |
| dash / blink / leap | 1 | 2% |

**Slot W by family** (n = 42)

| Value | Count | Share |
|---|---:|---:|
| ground circle / zone | 9 | 21% |
| terrain / wall / portal | 9 | 21% |
| self buff / shield / vanish | 6 | 14% |
| unit-targeted | 5 | 12% |
| dash / blink / leap | 3 | 7% |
| summon | 3 | 7% |
| trap | 2 | 5% |
| no-aim cone / strike / nova | 2 | 5% |
| skillshot (bolt / bank / fan) | 1 | 2% |
| remote trigger / switch | 1 | 2% |
| rule on the enemy (auto-targeted) | 1 | 2% |

**Slot E by family** (n = 42)

| Value | Count | Share |
|---|---:|---:|
| dash / blink / leap | 17 | 40% |
| unit-targeted | 6 | 14% |
| skillshot (bolt / bank / fan) | 5 | 12% |
| self buff / shield / vanish | 5 | 12% |
| remote trigger / switch | 3 | 7% |
| no-aim cone / strike / nova | 2 | 5% |
| ground circle / zone | 2 | 5% |
| trap | 1 | 2% |
| rule on the enemy (auto-targeted) | 1 | 2% |

**Slot R by family** (n = 41)

| Value | Count | Share |
|---|---:|---:|
| unit-targeted (marks a spot, dodgeable) | 6 | 15% |
| unit-targeted | 5 | 12% |
| terrain / wall / portal | 5 | 12% |
| line area (telegraphed lane) | 5 | 12% |
| no-aim cone / strike / nova | 4 | 10% |
| self buff / shield / vanish | 4 | 10% |
| ground circle / zone | 4 | 10% |
| channel / stance | 3 | 7% |
| summon | 2 | 5% |
| skillshot (bolt / bank / fan) | 1 | 2% |
| dash / blink / leap | 1 | 2% |
| remote trigger / switch | 1 | 2% |

**Hero spells by part, parts on two or more spells (a spell counts once per part; recast, reset and stacks variants merged)** (n = 167)

| Value | Count | Share |
|---|---:|---:|
| fuse | 38 | 23% |
| stacks | 12 | 7% |
| recast | 12 | 7% |
| mark | 11 | 7% |
| detonate | 11 | 7% |
| zone | 10 | 6% |
| sight-check | 10 | 6% |
| terrain | 10 | 6% |
| sure-hit | 8 | 5% |
| reset | 8 | 5% |
| summon | 7 | 4% |
| escape | 7 | 4% |
| leaves-object | 7 | 4% |
| ammo | 7 | 4% |
| shield | 6 | 4% |
| untargetable | 6 | 4% |
| needs-object | 6 | 4% |
| dot | 5 | 3% |
| chaser | 5 | 3% |
| spend-resource | 5 | 3% |
| multi-bolt | 5 | 3% |
| leaves-zone | 5 | 3% |
| buff | 4 | 2% |
| travel | 4 | 2% |
| echo | 4 | 2% |
| bounce | 4 | 2% |
| pierce | 3 | 2% |
| cage | 3 | 2% |
| empower-attack | 3 | 2% |
| self-root | 3 | 2% |
| heal | 3 | 2% |
| attack-reset | 3 | 2% |
| trap | 3 | 2% |
| self-haste | 3 | 2% |
| conditional-debuff | 3 | 2% |
| terrain-bonus | 2 | 1% |
| execute | 2 | 1% |
| tether | 2 | 1% |
| channel | 2 | 1% |
| scales-with-objects | 2 | 1% |
| hook | 2 | 1% |
| interruptible | 2 | 1% |
| portal | 2 | 1% |
| thorns | 2 | 1% |
| arm-delay | 2 | 1% |
| deferred-damage | 2 | 1% |
| reposition | 2 | 1% |
| carry | 2 | 1% |
| bounce-surface | 2 | 1% |
| multi-hit | 2 | 1% |
| conditional | 2 | 1% |
| stance-dependent | 2 | 1% |
Parts on one spell each: anytime, attack-range, auto-attack, auto-leap, auto-target-strikes, backstab, camouflage, cannot-cast, cheat-death, clears-enemy-objects, cost-life, costs-other-cd, decoys, delayed-damage, delayed-ring, fells-terrain, flips-stance, form, global, heal-zone, hold, invisible, invisible-projectile, landing-burst, max, multi-wave, needs-cover, parry, pickups, projectile-block, refade, reflect, reverse-dash, rhythm, self-buff, self-lockout, self-pull-to-terrain, shield-on-hit, spell-tax, summon-on-hit, tally, through-portals, through-walls, tripwire, vanish, weather-dependent.

**Kits that have each part anywhere (passive included), against League** (ours n = 41 kits: 40 heroes and the draft Kagen; League n = 173, from `docs/knowledge/league-champion-kits.md` "Counts across the roster")

| Part | Our kits | Share | League share |
|---|---:|---:|---|
| dash or blink (also a self-pull to a wall or a reposition) | 22 | 54% | 65% (dash 58%, blink 13%) |
| recast | 11 | 27% | 47% |
| channel (held cast the enemy can break) | 3 | 7% | 26% |
| summon | 7 | 17% | 19% |
| ammo (charges) | 7 | 17% | 17% |
| terrain (makes walls, pillars, portals, tripwires) | 11 | 27% | 10% |
| charge-up (hold to charge) | 1 | 2% | 9% |
| stance or form change | 3 | 7% | 9% stance, 12% form change |
| toggle | 0 | 0% | 6% |
| untargetable or stasis on self | 6 | 15% | 18% untargetable, 6% invulnerable |
| shield | 5 | 12% | 35% |
| heal or lifesteal | 4 | 10% | 49% |
| hard CC | 24 | 59% | 75% |
| pull | 7 | 17% | 16% |
| execute (more damage on low HP or by spent stacks) | 2 | 5% | 13% |
| stealth or camouflage | 2 | 5% | 12% |
| projectile block | 1 | 2% | 9% (block) |
| cooldown reset or refund | 9 | 22% | 27% |
| attack reset or empowered attack | 5 | 12% | 26% (attack_reset) |

**Hero spells by crowd control or effect on the enemy** (n = 167 spells; a spell counts once per kind; `|` alternatives such as push or pull both count)

| Kind | Class | Spells | Share |
|---|---|---:|---:|
| stun | hard | 9 | 5% |
| root | hard | 10 | 6% |
| knockup | hard | 5 | 3% |
| charm | hard | 1 | 1% |
| sealed | hard (stasis) | 1 | 1% |
| polymorph | hard | 0 | 0% |
| confine | hard (cage) | 3 | 2% |
| silence | soft | 6 | 4% |
| slow | soft | 18 | 11% |
| blind | soft | 6 | 4% |
| ground | soft (no dashes) | 1 | 1% |
| half-dash | soft | 0 | 0% |
| pull | displacement | 10 | 6% |
| push | displacement (push or knockback) | 13 | 8% |
| carry | displacement | 2 | 1% |
| slide | terrain | 1 | 1% |
| weaken | debuff | 2 | 1% |
| vulnerable | debuff | 1 | 1% |

**Passives with each kind** (n = 41): slow 5, silence 4, stun 4, push 3, vulnerable 3, slide 1, half-dash 1, polymorph 1, pull 1


Spells with any hard CC: 29 of 167; with any CC, displacement or debuff on the enemy: 72 of 167.

- Slot Q: median cooldown 3.5 s over 39 spells with a real cooldown (min 3, max 6)
- Slot W: median cooldown 9 s over 35 spells with a real cooldown (min 6, max 14)
- Slot E: median cooldown 10 s over 39 spells with a real cooldown (min 7, max 14)
- Slot R: median cooldown 24 s over 41 spells with a real cooldown (min 8, max 26)




### Inferences
The gap list against the three big MOBAs. League rows cite the counts above. Dota 2 and Smite examples are from memory (uncited).

| Mechanic | League (cited share of kits) | Dota 2 / Smite (uncited examples) | Ours (from the rows above) | Verdict for a 1v1 |
|---|---|---|---|---|
| Vector targeting (two points) | a handful: Viktor E, Rumble R, Irelia E, Taliyah W (uncited names) | Pangolier, Void Spirit | none; the engine has one point per cast | A real gap. It suits lines placed across a path: walls, lanes, Gerald's shove, Hank's row. |
| Toggle | 6% | many: Pudge's Rot, Medusa's Mana Shield, Witch Doctor's Voodoo Restoration | 0 kits | A gap. A drain toggle needs a resource, and only 3 kits have one. |
| True channel (the enemy can break it) | 26% (R 17%) | very common on Dota ultimates: Crystal Maiden, Bane, Witch Doctor, Enigma | 3 kits (Vesper R, Marin R, Ada R) | Thin. A channel is a clear commit moment in a duel (`our-kits-comparison.md` line 106). |
| Charge-up (hold to charge) | 9% | Smite has a few, Dota rare (uncited) | 1 kit (Lyra Q); the stale doc claims 3 | Thin. The engine supports several slots (`HoldSpec[]`). |
| Recast | 47% | Dota: some (Ember Spirit's remnants) | 11 kits, 12 slots | Below League, now on every slot (2026-11-04 it was Q only). |
| Ammo | 17% | Dota: some (charges) | 7 kits | Level. |
| Stance or form | 9% stance, 12% form | Dota: Troll's swap, Lone Druid | 3 kits (Marin's automatic tide, Pim and Pom, Ada's siege) | Fine. |
| Summon | 19% | Dota: very common, with unit control | 7 kits; no control of the units | Level. Dota's micro of controlled units has no analogue (no unit orders). |
| Terrain or walls | 10% | Dota: Earth Spirit, Earthshaker's Fissure; Smite: walls are common | 11 kits (27%) | Our strength. |
| Ally-targeted spells (heal, shield, buff on an ally) | common on enchanters | common in all three | none possible: no `ally` mode | Not needed in a 1v1. A gap for the co-op Raid only. |
| Unit-targeted sure hit | targeted 17% overall | Dota: very common, and the base of its design | 8 true sure hits; the other 19 click spells need sight at the impact or mark a spot | We are deliberately dodgeable. A Dota-style point-and-click would be new. |
| Spell shield, reflect, block | block 9% | Dota: Linken's, Lotus Orb, Anti-Mage's Counterspell; Smite: Aegis, Beads | parry on Kagen W (draft) only; Null Zone deletes bolts; Final Delivery returns on cover; no one-spell shield | A gap in answers. The engine's `ward` blocks zones, but no hero uses it. |
| Cleanse or purge | QSS-type items, plus some kits | Dota: Purge, Manta, BKB; Smite: Beads | none; `mech.cleanse` exists unused | A gap. Every CC is waited out (the caps and 0.5 s immunity make that bearable). |
| CC or spell immunity | rare (Olaf R, Morgana E; uncited) | Dota: BKB, Lifestealer's Rage, Juggernaut's Blade Fury | Brannoc at white heat is immune to slow and root only | Thin. |
| Untargetable or invulnerable | 18% and 6% | Dota: Puck's Phase Shift, Eul's | 6 kits (Tempo, Zambini, Mabel, Anka's ashes, Zephyr, Marin) plus Sefu's sealed stasis on the enemy | Above League per slot (`our-kits-comparison.md` line 101 flagged it). |
| Disjoint (a blink dodges a projectile in flight) | rare, mostly by untargetability | Dota: a core rule | partial: our homing bolts follow the live position; a lost sight or reach fizzles them; untouchable windows swallow hits | Different. Sight is our disjoint. |
| Interrupt as a rule | stun, silence, knock-up break channels | Dota: the same, plus "cancel on move" | the same: stun, silence and knock-up end our 3 channels | Level, but few channels to interrupt. |
| Taunt | part of hard CC (Rammus, Shen; uncited) | Dota: Axe; Smite: taunts common | none (our charm walks you toward Cantor and is the nearest) | A gap. Charm covers it. |
| Fear or flee | some (Fiddlesticks, Nocturne, Hecarim; uncited) | Dota: Lich, Nevermore; Smite: fears | none | A gap. |
| Suppression | rare (Malzahar, Warwick, Skarner; uncited) | Dota: Bane's Fiend's Grip | none (Sefu's sealed is a stasis on the enemy, both ways) | Fine to skip. |
| Sleep | rare (Zoe E; uncited) | Dota: Bane's Nightmare | none; `mech.sleep` is built but unused | Engine ready. |
| Polymorph or hex | Lulu W (uncited) | Dota: Lion, Shadow Shaman, Hex items | Bo's passive only (5 Wool: a sheep for 1 s) | Thin. |
| Grounding (no dashes) | soft CC (Cassiopeia, Poppy; uncited) | Dota: root disables blinks | Referee W as a rule with a penalty; Sefu's Judged halves dashes | Present in a softer form. |
| Displacement kinds | pull 16%; knock-aside, knock-up and dash-through common | Dota: Vengeful's Swap, Tusk, Earth Spirit; forced movement | pull 7 kits, push or knockback 14 spells, knock-up 5, carry 2 (Sumo, Bram), ring-out (Sumo), slide terrain (Gus); no swap places (engine `swap` unused), no kick into others (Lee Sin R; uncited) | Rich, given the user asked for pulls. Missing: swap and a "knock into" collision. |
| Aura (a passive area around the hero) | some | Dota: very common, team auras | Oblivion's stand-still pull, Ada's turret aura, Kaia's storm (R), Gus's flood (R) | No stat auras; with no teammates, none are needed. |
| Global or map-wide | R global 5% | Dota: Zeus, Spectre, Nature's Prophet | none on a spell; Barry's weather is arena-wide | Not needed in one arena. |
| True stealth (detection needed) | 12% | Dota: Riki, Clinkz, with wards and dust | Nyx's veil (still targetable), Zambini and Mabel hidden but shown, Mum's unseen walls and ball | Deliberately soft (`our-kits-comparison.md` line 32). |
| Heal and shield | 49% and 35% | common | 4 and 5 kits | Deliberately low (`our-kits-comparison.md` line 98). |
| Item actives and summoner spells | Flash and Ignite on every champion | Dota: Blink Dagger, BKB, Force Staff; Smite: relics | none | The biggest structural difference. A shared escape button is absent. |
| Skill ranks and levels | 5 ranks, R at level 6 | the same in Dota and Smite | none | By design: rounds reset. |
| Cast while moving | common | Smite: most abilities | none: every cast roots until impact (at most 2.5 s) | A distinctive commit. It shapes every kit. |

**Things our kits have that the big three rarely or never have** (League shares cited above; the rest my reading):
- deferred damage on a tab that the victim pays down by hitting back (Mr. Ledger);
- a rhythm window for every cast (Cantor);
- automatic repeat-casts (Tempo's echo);
- a cap on damage per hit, with HP in chunks (Sir Whiskers);
- rules that punish with cards (Referee);
- weather that hits both players (Barry);
- a ring-out (Big Yoko);
- invisible walls and an invisible ball (Mum);
- a companion pillar that is cover, weapon and dash target (Bram);
- trees that grow in stages and can be felled (Hank);
- portals for bodies and bolts (Wick);
- a spell tax on the enemy's casts (Vesper's curse);
- pickups both players fight over (Madame Cleaver);
- a map objective inside a duel (Pip's parcel).

### Gaps
- **Dota 2 and Smite.** No local source exists. Every row above about them is from memory and needs checking against the other researchers' notes in `docs/knowledge/moba-research/`. The League champion names given as examples (vector, taunt, fear, suppression, sleep) are also from memory. Only League's shares are cited.
- **The tallies are my classification.** "Mechanic" and "parts" are judgements in a fixed vocabulary. A different reader might tag, for example, Hot Air as an escape rather than a dash, or Duet as a zone rather than a cage. Single counts can move by one or two. The shape of the table should not.
- **Kagen** is a draft (`draft: true`, off the roster). He is counted in the 41 kits. Without him the totals are 40 kits and 163 spells. His parry is the only spell-shield-like part, so dropping him removes that row entirely.
- **Sources named in the brief but not opened:** `pipeline/designs/kits-v5.md`, `kit-uniqueness.md`, `kit-common.md`, `hero-roles.md`, the per-hero pages `docs/catalog/heroes/<theme>.md`, and `src/kits/test.ts`. The inventory rests on the code, which those designs fed. A design-intent column (for example, why a kit has no dash) would need them.
- **Card quirks seen and not resolved:** Mr. Biscuit has `mode: 'enemies'` with card range 0, and Crosswind has `mode: 'enemies'` with range 3. In hero mode an `enemies` spell needs an enemy near the cursor and walks into range and sight first (`src/heroMode.ts` around line 1043). What the click does for a range-0 summon was not tested. Mist Waltz and Scarab Stride have card range 11, but their dashes are 5 m and 6 m: the card range is the click reach.
- **Not measured:** how any of this plays against people. CPU fights cannot test counterplay (`our-kits-comparison.md` line 17).
