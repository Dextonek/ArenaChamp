---
title: Kit identity v2, a fully unique roster
tags: [design, heroes, kits, balance]
updated: 2026-11-01
status: design only, not built
---

# Kit identity v2: every hero unique (2026-11-01)

Follows [kit-uniqueness.md](kit-uniqueness.md), which is built but still leaves shared mechanics. This doc designs a
roster where every hero passes the bar below. It is design only: no code is changed.

Every spell keeps its name and VFX unless it is tagged otherwise:

- **kept**: no change.
- **rider**: the hit logic changes, the VFX stays.
- **shape**: the spell behaves differently; it reuses the same assets but needs new motion.
- **new**: a new name, the old VFX with a new meaning.

## The bar

With 20 heroes and about 6 spell shapes, "nothing shared on any axis" is impossible. These five rules are checkable:

1. **One owned verb per hero.** Each hero has one mechanic that no other hero has (the registry below).
2. **Distinct passives and twists.** Every passive and every twist uses a different mechanism, not just different
   numbers. No two resources share both what fills them and what spends them. Some share one side, for example
   Lyra's ammo and Marin's tide both fill with time but are spent differently.
3. **No repeated shape plus rider on one slot.** The same shape may repeat on a slot (two line skillshots on Q), but
   not with the same rider (what the hit does).
4. **Off rhythm.** Every hero has at least one slot, or a rule, that breaks the standard Q 3 / W 7 / E 9 / R 20
   cooldowns.
5. **The 1v1 lens.** A mechanic that needs a second target does not count.

**Not in the bar:** attack families (20 heroes, 4 families, so they must repeat) and spell ranges (most stay at
10–13 m). See the open questions at the end.

## What goes (the overlaps that still remain)

- **Every-Nth counters:**
  - removed: Isolde's chill freeze, Kaia's every-third-spell Static, Brannoc's every-third-swing knock and Ada's
    every-third-attack scrap.
  - kept: Vex's toxin. It is the only stack that pops on its own, and it is her owned verb.
- **Bonus damage against an enemy with a status (3 heroes):**
  - Sefu keeps rooted +45%.
  - Isolde's passive turns defensive.
  - Opaline gets an attack colour cycle.
- **Standing still:**
  - Lyra keeps Focus.
  - Brannoc's Anvil stance becomes thorns.
- **Shield E:** 3 left (Brannoc, Auriel, Opaline), each with a different rider. Tempo's E loses its shield.
- **Free recasts:**
  - Auriel keeps the early slam.
  - Tempo's second rewind becomes an HP rewind.
  - Oblivion's second collapse becomes Singularity.
- **Pulls:**
  - Oblivion owns area pulls.
  - Marin owns the single-target hook.
  - Lyra's trap, Marin's Whirlpool and Brannoc's Bellows Ward lose their drag.
- **Two holds to charge (Kaia Q, Sefu W):** Kaia keeps hers; Sefu's becomes Grounded.
- **A second turret:** Fenna's Verdant Ward becomes a healing flower; the turret is Ada's.
- **Silence:**
  - Nyx keeps the self burst.
  - Cantor's W becomes sleep.
  - Shiori's R gets silence instead of blind (blind is Opaline's).
- **R that stuns in a circle:**
  - Sefu keeps it.
  - Ada's Gearfall roots and becomes a station.
- **Knock-up in a circle:**
  - Marin keeps it (W).
  - Zephyr's R becomes a moving cyclone that pushes.
- **Ground stun W:**
  - Auriel keeps the dome.
  - Tempo's dial freezes cooldowns instead.
- **Weak shields and plain heals on E:** each E heal now comes with a different rider (drain, cleanse, rewind, shove,
  surf, flower).

## Owned verbs (registry)

| Hero | Owned verb | Where |
|---|---|---|
| Vesper | Spells cost HP, not cooldown | twist (kept) |
| Brannoc | Damage taken fuels him (thorns plus heat from hits) | passive and twist |
| Isolde | Ice block that shatters with what it swallowed | E and twist |
| Lyra | Global ultimate | R (kept) |
| Vex | Toxin stacks that pop and detonate | passive and R |
| Kaia | Hold to charge | Q (kept) |
| Sefu | Burrow: moves under the sand, untouchable | E (new) |
| Nyx | Backstab (bonus from behind); stealth after the clones as a bonus | passive (kept), E |
| Fenna | Leash: rooted if the enemy runs | W |
| Auriel | Slam her own spell early | twist (kept) |
| Marin | Hook to her, tide resets | Q and twist (kept) |
| Zephyr | Momentum from walking, a moving ultimate | twist and R |
| Mortis | Bones from every death | passive (kept) |
| Ada | Stations: casting near her turret or gear | passive and R |
| Sirix | Two stances | twist (kept) |
| Cantor | Sleep, and an ultimate gated by his song | W and twist |
| Opaline | Mirror: her spells also fire from a mirror | twist |
| Oblivion | Swallows enemy spells and grows from them | E and twist |
| Shiori | Mana (ink) | twist (kept) |
| Tempo | Freezes enemy cooldowns, rewinds HP | W and E |

## Per hero

Format: passive, twist, then Q W E R with tags. "Off rhythm" names the slot or rule that breaks the standard cadence.

### Vesper (blood, assassin), score 5, nearly kept
- **Passive Blood price** (kept): heals 18% of the damage she deals.
- **Twist HP as cost** (kept).
- **Q Hemolance** (kept): click target, heals 6 on a hit.
- **W Thorn Garden** (rider): the thorns **wound** instead of slow: the enemy bleeds for 4 a second and heals 50% less
  for 4 s. The bleed keeps it useful against heroes that do not heal. New debuff `wound`.
- **E Crimson Pact** (kept): tether drain.
- **R Sanguine Eclipse** (kept).
- **Off rhythm:** all her spells cool down 25% faster.

### Brannoc (forge, tank)
- **Passive Slag skin** (new): whoever damages him, from any range, is branded: it burns for 3 a second for 2 s, and
  for double that within 3 m. Replaces Anvil stance.
- **Twist Heat** (rider): heat fills from damage he takes (1 per 2 HP), not from his spells.
  - At full heat he **overheats** for 4 s: his attacks cleave 3 m round him and burn.
  - Replaces "next spell +50% and stun".
- **Q Slag Flick** (rider): the slow becomes a burn that keeps ticking while he stays within 3 m.
- **W Anvil Drop** (kept): 5 s.
- **E Bellows Ward** (rider): shield 100; while it holds, heat fills twice as fast. Damage the shield absorbs counts
  as damage taken. The drag goes.
- **R Forgefall** (kept): knock-up round himself.
- The every-third-swing knock goes.
- **Off rhythm:** W 5 s.

### Isolde (frost, controller)
- **Passive Cold blood** (rider): slowed enemies deal 20% less damage to her. Replaces the bonus damage against
  slowed enemies.
- **Twist Shatter** (new): when the ice block ends it bursts for 50% of the damage it swallowed, within 4 m. Replaces
  Chill.
- **Q Rime Spear** (rider): 4 s cooldown, slow 2 s.
- **W Frostfern Field** (kept).
- **E Glacial Mantle** (kept): ice block.
- **R Winter's Crown** (kept).
- **Off rhythm:** Q 4 s.

### Lyra (astral, marksman), kept
- **Passive Focus**: kept.
- **Twist Starshot ammo**: kept.
- **Q Starshot**: kept.
- **W Constellation Snare** (rider): roots only; the drag goes (pulls are Oblivion's).
- **E Orbit Veil**: kept.
- **R Celestial Hunt**: kept.
- **Off rhythm:** Q ammo.

### Vex (alchemy, mage)
- **Passive Toxin**: kept.
- **Twist Slow poison**: kept.
- **Q Volatile Flask**: kept, 2 s.
- **W Caustic Pool**: kept.
- **E Mutagen** (rider): she **cleanses** her slows, roots, blinds and debuffs, heals 30 and gains might. She cannot
  cast while stunned or silenced, so the cleanse never breaks those. New: a cleanse.
- **R Grand Transmutation** (rider): no slow; it **detonates** every toxin stack on the enemy at double damage.
- **Off rhythm:** Q 2 s.

### Kaia (storm, mage)
- **Passive Building storm** (new): +5% spell damage for each second since her last cast, max +25%. It rewards
  patience, the opposite of Cantor. Replaces Static.
- **Twist Charged lance**: kept.
- **Q Arc Lance** (rider): no chain. At full charge it stuns for 0.4 s (Static's stun moves here).
- **W Downpour**: kept.
- **E Static Field**: kept.
- **R Eye of the Storm**: kept, 26 s.
- **Off rhythm:** R 26 s.

### Sefu (sand, controller)
- **Passive Sandstorm** (kept): rooted enemies take 45% more damage from him; his spells other than Quicksand hit 15%
  harder.
- **Twist Grounded** (new): an enemy rooted by Quicksand cannot dash or blink for 2 s after the root. New debuff
  `grounded`. Replaces charged Quicksand (hold to charge is Kaia's).
- **Q Sand Lash** (rider): 4 s cooldown.
- **W Quicksand**: kept.
- **E Dune Ward → Burrow** (new): he sinks into the sand for 1.2 s: untouchable, +40% walk speed. A moving sand mound
  shows exactly where he is (hiding is Nyx's). When he surfaces, a ring of sand slows enemies near him. 14 s
  cooldown.
- **R Tomb of Kings**: kept.
- **Off rhythm:** E 14 s, Q 4 s.

### Nyx (shadow, assassin)
- **Passive Backstab**: kept.
- **Twist Combo points**: kept.
- **Q Umbral Blink**: kept, 5 s.
- **W Grasp of the Deep**: kept; it is now the only self-centred silence.
- **E Night Shroud** (rider): after the clones fly she is **stealthed** for 1.5 s. Enemy auto-aim and the AI cannot
  pick her; the first hit she deals breaks it. New system.
- **R Eclipse Execution**: kept.
- **Off rhythm:** Q 5 s.

### Fenna (grove, support)
- **Passive Regrowth**: kept.
- **Twist Seeds**: kept.
- **Q Bloom Lash**: kept.
- **W Overgrowth** (rider): a **leash**. Vines tie the enemy to the spot for 3 s; if it gets more than 3 m from the
  spot, it is rooted for 1.2 s and the leash snaps. New system.
- **E Verdant Ward** (rider): a healing flower (6 s) that heals her 6 per second while she stands within 3 m of it. It
  does not shoot; the turret is Ada's.
- **R World Blossom**: kept.
- **Off rhythm:** E 12 s.

### Auriel (dawn, support)
- **Passive Aegis**: kept.
- **Twist Slam**: kept.
- **Q Radiant Spear**: kept.
- **W Aegis Wall**: kept; now the only stun dome.
- **E Halo of Blades**: kept.
- **R Judgement of Dawn** (rider): 16 s cooldown, damage −15%.
- **Off rhythm:** R 16 s.

### Marin (tide, controller)
- **Passive Undertow**: kept.
- **Twist Tide**: kept.
- **Q Tide Whip**: kept; the only hook.
- **W Whirlpool** (rider): knock-up only; the pull goes.
- **E Undertow Dance**: kept.
- **R Leviathan's Waltz**: kept.
- **Off rhythm:** tide resets.

### Zephyr (sky, bruiser)
- **Passive Tailwind**: kept.
- **Twist Momentum**: kept.
- **Q Gale Edge**: kept, 1.5 s.
- **W Tailwind Rush**: kept.
- **E Cyclone Guard**: kept.
- **R Thousand Winds** (shape): the cyclone **drifts toward the enemy** for 3 s and pushes it outward on each pulse.
  No knock-up (knock-up circles are Marin's). Balance risk: repeated pushes are a chain of hard CC, so it gets at
  most 3 pulses per cast.
- **Off rhythm:** Q 1.5 s.

### Mortis (bone, summoner)
- **Passive Grave harvest**: kept.
- **Twist Bones**: kept.
- **Q Bone Spear** (rider): 4 s cooldown, ×1.3.
- **W Grave Call**: kept.
- **E Ossuary Ward**: kept.
- **R Legion of the Ossuary**: kept.
- **Off rhythm:** Q 4 s.

### Ada (clockwork, summoner)
- **Passive Overclock** (rider): stations count too. Casting within 5 m of her turret **or of a Gearfall gear** gives
  −15% cooldown.
- **Twist Scrap** (rider): every hit on the enemy gives 3 scrap and each turret hit gives 2. No every-third bonus.
- **Q Rivet Shot**: kept.
- **W Cog Turret** (rider): 11 s cooldown, the turret lasts 8 s.
- **E Gear Field**: kept.
- **R Gearfall** (rider): roots for 1 s instead of a stun, and the gear **stays 5 s as a station**.
- **Off rhythm:** W 11 s.

### Sirix (hive, bruiser), kept
- **Passive Hive**: kept.
- **Twist Stance switch**: kept.
- **Q, W, E and R**: kept.
- **Off rhythm:** Q 2.5 s.

### Cantor (bard, support)
- **Passive Rhythm**: kept.
- **Twist Song meter**: kept.
- **Q Discordant Note**: kept.
- **W Silencing Refrain → Lullaby** (new): the circle makes the enemy drowsy, 30% slow. If it takes no damage for
  1.5 s it falls **asleep** (stunned up to 2 s); any damage wakes it. New status `sleep`.
- **E Ballad of Valor**: kept.
- **R Crescendo**: kept.
- **Off rhythm:** encore, and R gated by the meter.

### Opaline (prism, marksman)
- **Passive Spectrum** (new): each spell she casts turns her next 3 attacks a colour in turn:
  - red: burn;
  - blue: 20% slow;
  - gold: 10 shield per hit.

  Replaces the bonus damage against blinded enemies.
- **Twist Mirror** (new): Mirror Shell leaves a crystal mirror where she stood (4 s). Her Q and W also fire from the
  mirror, at 50%. Replaces Prism charges (the hits-into-points mechanism is Nyx's). New system.
- **Q Prism Bolt**: kept.
- **W Refraction Field**: kept; the only blind.
- **E Mirror Shell** (rider): shield 45, no lights.
- **R Spectrum Lance**: kept.
- **Off rhythm:** Q 2 s.

### Oblivion (void, tank)
- **Passive Event horizon**: kept.
- **Twist Singularity** (new): each enemy spell his maw swallows stores a charge (max 3). Unmaking grows 1 m and deals
  +20% per charge. Replaces Collapse.
- **Q Rift Cleave**: kept.
- **W Null Tether**: kept.
- **E Void Mantle**: kept.
- **R Unmaking** (rider): no recast.
- **Off rhythm:** E 12 s.

### Shiori (ink, summoner)
- **Passive Ink trail**: kept.
- **Twist Ink reserve**: kept.
- **Q Brushstroke**: kept.
- **W Ink Snare**: kept.
- **E Paper Familiars**: kept.
- **R Final Calligraphy** (rider): the seal **silences** for 1.5 s instead of blinding (blind is Opaline's), and
  refills 50 ink.
- **Off rhythm:** ink, not cooldowns.

### Tempo (chrono, controller)
- **Passive Echo**: kept.
- **Twist True rewind** (new): Rewind restores the HP he had at the mark, if it was higher, instead of a flat heal.
  Replaces the free second rewind.
- **Q Second Hand**: kept.
- **W Stopped Moment** (rider): no stun. Time stops on the enemy's **cooldowns**: its spells do not cool down for
  2.5 s. New debuff `timelock`.
- **E Rewind** (rider): no shield.
- **R Twelfth Hour**: kept.
- **Off rhythm:** Echo.

## Collision tables (the proof)

Every row in a table is different. `pipeline/tools/check-kit-v2.py` reads these tables and fails on any duplicate.

### Passive mechanism

| Hero | Mechanism |
|---|---|
| Vesper | heal from damage dealt |
| Brannoc | thorns against melee hitters |
| Isolde | damage reduction from slowed enemies |
| Lyra | standing still plus long-range bonus |
| Vex | stacks that pop on the fifth |
| Kaia | bonus from time since her last cast |
| Sefu | bonus damage against rooted enemies |
| Nyx | bonus from behind |
| Fenna | regen when not hit |
| Auriel | shield strength and post-shield damage |
| Marin | extends her pulls and knock-ups with a slow |
| Zephyr | walk speed per cast |
| Mortis | resource from deaths |
| Ada | cooldown cut near a station |
| Sirix | damage per living summon |
| Cantor | bonus for changing slot |
| Opaline | spells colour her next attacks |
| Oblivion | slow from hits at close range |
| Shiori | her hits weaken |
| Tempo | each cast shortens the other cooldowns |

### Twist: what fills it, what spends it

| Hero | Fill → spend |
|---|---|
| Vesper | HP is paid → spells |
| Brannoc | damage taken → overheated attacks |
| Isolde | swallowed damage → shatter burst |
| Lyra | time → Q charges |
| Vex | pool and ult casts → extra stacks |
| Kaia | holding the aim → Q power and stun |
| Sefu | Quicksand root → enemy grounded |
| Nyx | spell hits → ult damage |
| Fenna | hits → seeds bloomed by Q |
| Auriel | W cast → early slam recast |
| Marin | time → instant cooldown reset |
| Zephyr | walking → empowered spell |
| Mortis | summon deaths → summon power |
| Ada | hits and turret hits → turret upgrade |
| Sirix | E → stance flip |
| Cantor | spell casts → ult unlock and encore |
| Opaline | E → a mirror that recasts Q and W |
| Oblivion | swallowed enemy spells → ult size |
| Shiori | attacks and time → spell cost |
| Tempo | the mark → HP restore |

### Q: shape / rider

| Hero | Q |
|---|---|
| Vesper | click / heal on hit |
| Brannoc | click 3 m / burn while near |
| Isolde | pierce line / slow |
| Lyra | line first hit / long-range bonus |
| Vex | lob circle / toxin |
| Kaia | click / charge to stun |
| Sefu | click / root |
| Nyx | dash strike / vulnerable |
| Fenna | click / seeds and bloom |
| Auriel | pierce line / self shield |
| Marin | click / hook |
| Zephyr | melee cone / knockback |
| Mortis | pierce line / bone scaling |
| Ada | line first hit / stick and pop |
| Sirix | melee cone / double swipe and slow |
| Cantor | line first hit / second beat |
| Opaline | line first hit / split beams |
| Oblivion | melee cone / pull |
| Shiori | line first hit / split at full range |
| Tempo | boomerang / slow both ways |

### W: shape / rider

| Hero | W |
|---|---|
| Vesper | circle / wound |
| Brannoc | lob circle / knock aside and slow |
| Isolde | line strip / root |
| Lyra | trap / root |
| Vex | lingering pool / burn and slow |
| Kaia | repeat strikes / slow |
| Sefu | circle / slow then root, grounded |
| Nyx | self burst / silence |
| Fenna | click / leash |
| Auriel | delayed dome / stun and slam |
| Marin | circle / knock-up |
| Zephyr | dash / knock-up |
| Mortis | summon / skeletons |
| Ada | summon / turret |
| Sirix | leap / wasps |
| Cantor | circle / sleep |
| Opaline | circle / blind and vulnerable |
| Oblivion | zone / drag, slow and weaken |
| Shiori | circle / vulnerable |
| Tempo | circle / timelock |

### E: shape / rider

| Hero | E |
|---|---|
| Vesper | tether / drain heal |
| Brannoc | self / shield and heat |
| Isolde | self / ice block |
| Lyra | backstep / slow lines |
| Vex | self / cleanse and heal |
| Kaia | expanding ring / stun |
| Sefu | burrow / untouchable, slow on surfacing |
| Nyx | auto-aim fan / stealth |
| Fenna | plant / healing flower |
| Auriel | orbit blades / shield |
| Marin | surf dash / heal and foam slow |
| Zephyr | forward dash / cut through, haste |
| Mortis | click cage / root and vulnerable |
| Ada | ground gears / slow pulses |
| Sirix | self / armor and stance |
| Cantor | self rings / shove and heal |
| Opaline | blink / shield and mirror |
| Oblivion | self pulse / spell swallow |
| Shiori | summon / cranes that weaken |
| Tempo | mark and return / HP rewind |

### R: shape / rider

| Hero | R |
|---|---|
| Vesper | zone / harvest heal |
| Brannoc | self 5 m / knock-up |
| Isolde | self 5 m / stun |
| Lyra | global / charge |
| Vex | circle / toxin detonation |
| Kaia | circle / one huge bolt |
| Sefu | circle / stun |
| Nyx | small zone / combo execute |
| Fenna | self 5 m / slow and heal over time |
| Auriel | zone / damage and shield |
| Marin | line / knock-up |
| Zephyr | moving cyclone / push |
| Mortis | zone / summon archers |
| Ada | circle / root and station |
| Sirix | zone / slow and wasps |
| Cantor | self 5 m / damage and encore |
| Opaline | channel beam / sweep |
| Oblivion | zone / drag, grows with swallows |
| Shiori | circle / silence and ink refill |
| Tempo | delayed zone / dodgeable bomb |

## Build cost and order

The cost tiers are the same as in [kit-uniqueness.md](kit-uniqueness.md): T (trait only), S (spell hit logic), N (new
system).

| Batch | Tier | Contents |
|---|---|---|
| 1 | T | Brannoc thorns and heat from damage; Isolde Cold blood and Shatter; Kaia Building storm and stun at full charge; Opaline Spectrum; Oblivion Singularity; Tempo True rewind; Ada scrap and stations; the counter removals; the cooldown changes (Isolde Q, Sefu Q and E, Auriel R, Mortis Q, Ada W). |
| 2 | S | Remove the drags on Lyra W, Marin W and Brannoc E; Brannoc Q burn; Vex R detonation; Fenna E healing flower; Shiori R silence and refill; Ada R root and gear station; Tempo E without the shield; Zephyr R drifting cyclone. |
| 3 | N | New debuffs: `wound` (Vesper W), `grounded` (Sefu), `timelock` (Tempo W), `sleep` (Cantor W). All of them are applied by the victim's client, so they travel with the hit like the current debuffs. |
| 4 | N | Vex cleanse (status removal), Fenna leash (a check on the victim's side). |
| 5 | N | Sefu Burrow and Nyx stealth: the other client must hide the model, so they need a net message. Opaline's mirror: the cast relay needs a second origin. |

**Online:** batches 1–4 stay inside the current victim-decides model. Batch 5 changes what the other player sees and
needs server and net work plus a smoke test each.

**AI:** sleep (don't hit a sleeping enemy unless the burst is ready), leash (don't run), timelock and stealth (no
target) each need a rule in `Duel.ward()` or the target picker.

**Balance:** a tournament after each batch (3 reps, 1,140 fights). The target stays 35–65%.

## Open questions

1. **Ranges:** most aimed spells still reach 10–13 m. Spreading them (for example assassins at 7 m, marksmen at
   14–16 m) would be a separate pass.
2. **Batch 5** is the biggest cost. Without it, Sefu's E stays Dune Ward with haste and a slow (no burrow), and
   Opaline needs a different twist; both would lose their owned verb. Nyx keeps hers (backstab) and only loses the
   stealth bonus. Check first whether the other client already replays a relayed cast's VFX (as for the ice block):
   if so, burrow needs no new net message, only the relayed cast.
3. **The VFX that change most** (tagged shape or new): Zephyr's drifting cyclone, Sefu's burrow (a sand trail,
   surfacing burst), Cantor's lullaby (sleep "Zz" over the head), Opaline's mirror, Isolde's shatter, Fenna's leash
   line, and the overheat state on Brannoc's attacks.
