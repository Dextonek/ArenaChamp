---
title: Ramet, the Lion of the Gate (new hero 13 of 20)
tags: [design, heroes, kits, sphinx]
updated: 2026-11-14
status: gate 1 card and gate 3 on paper, written before the look (gate 2); the numbers may move after the look; nothing is built
---

# Ramet, the Lion of the Gate

New hero 13 of the twenty ([the cards](../../docs/heroes/next20/index.html), [all twenty kits](../../docs/heroes/kits20/index.html), [the lore](../../docs/lore/index.html)). Made by `python pipeline/tools/kits20.py` from `pipeline/tools/kits20_data/` on 2026-11-14; until the user's yes, change the data and run it again. After the yes this sheet is edited by hand, as `kit-phoenix.md` was.

**The order of the gates.** [The rules](../../docs/pipeline/new-hero.md) put the look (gate 2) before this sheet. The user asked for the full design of all twenty now, so this sheet comes first, and its numbers may move once the look is agreed.

## Gate 1: the card

| | |
|---|---|
| **Sentence** | The captain of the city gate, who rides a lion of sandstone and gold. |
| **Shape** | A lion's head in profile with a spear behind it. |
| **Colours** | Accent desert rose `#b27480`, foil bleached bone `#f0e6da`. Nearest colours: Zephyr accent (26), Grandma Ironknit (27) (Lab distance; under 12 reads as the same).   |
| **Theme word** | `sphinx` |
| **Role** | Tank, melee |
| **Faction** | The Dune Throne (lore: Captain of Tamerit's gate, who let the Uncrowned go free the night her brother took the crown.) |
| **The new thing** | A mount the enemy can break. His health bar is two: the lion's 280 in front, his own 560 behind. Break the lion and he is thrown and fights on foot with other spells; once a round the lion can rise again, unless the enemy scatters its rubble. |
| **The question** | "Hit the lion, or wait for the man?" |
| **The weakness** | Mounted he is a big target and the lion takes every hit first; on foot he is a plain spearman until the lion rises. |
| **The second decision** | Call the lion back early, standing still at its rubble for 1.5 s, or fight on foot until it rises by itself after 15 s; either way he must keep the enemy off the rubble. |
| **How it looks** | A strong, steady man in a lion-mane hood and gold-banded armour, a long spear in the right hand, riding a great lion of sandstone with gold inlays and a turquoise eye; thrown, the lion lies as a heap of carved stone. |
| **Nearest heroes** | Sefu (sandstone and gold; his king), Sir Whiskers (feline), Big Yoko (tank) |

## Gate 3: the kit on paper

Ramet. Theme `sphinx`. Tank, melee. **840 HP**, 4.4 m/s mounted, 4.0 on foot, basic attack mounted 15 per 1.2 s at 3.0 m (the paw); on foot 13 per 1.1 s at 3.0 m (the spear). Accent `#b27480`, foil `#f0e6da`.

| Key | Spell | Shape | CD (s) | Range | Size | Damage | Rule |
|---|---|---|---:|---|---|---|---|
| P | **The Lion Wakes** | PASSIVE | - | - | - | - | His bar: the lion's 280, then his 560 (a cut shows between). Mounted: 4.4 m/s, a body 0.3 m wider, the mounted spells. When the lion's part is gone it crumbles where it stood and he is thrown (0.5 s, he cannot act): on foot, 4.0 m/s, the foot spells. Once a round, 15 s later, the lion rises at its rubble with 150 and he mounts it by walking there (or calls it sooner, E2). An enemy who stands on the rubble for 1.0 s scatters it: no lion for the rest of the round. |
| Q | **Lion's Paw** | CONE | 3.5 | 3.5 m | 90 degrees | 48 and knock 1.5 m | Mounted. 0.35 s wind-up, the lion swipes. |
| Q2 | **Spear Thrust** | LINE | 3 | 4.5 m | 1 m wide | 52 | On foot. 0.4 s wind-up, a long thrust. |
| W | **Gate Ward** | SELF | 12 | 4 m | radius 4 m | - (a 60 shield; mounted, slow 30% 1.5 s) | A shield of 60 for 2.5 s; mounted, the lion roars too: enemies within 4 m are slowed 30% for 1.5 s. |
| E | **Lion's Leap** | DASH | 10 | 7 m | landing 1.5 m | 40 and stun 0.4 s | Mounted. 0.3 s wind-up, the lion leaps 7 m in 0.4 s and lands: 40 and a 0.4 s stun within 1.5 m. |
| E2 | **Call the Lion** | CHANNEL | 15 | its rubble | - | - | On foot, standing at the lion's rubble: 1.5 s, then it rises with 150 and he mounts. A stun or a knock-up breaks it. |
| R | **The Gate Shuts** | LINE | 22 | 10 m | lane 2.5 m wide | 110 and stun 0.5 s mounted; 90 on foot | A roar for 1.0 s while the lane shows; then the lion charges 10 m along it in 0.6 s, carrying the first enemy it meets to the end (4 m at most) and slamming them: 110 and a 0.5 s stun. On foot he hurls the spear down the lane instead: 90. |

### The answers, checked (rule 4)

A hero walks 4 m/s and reacts in 0.25 s; a circle warns at least 0.25 + radius / 4 s; a bolt reaches 6 m no sooner than 0.5 s; the ultimate never lands the moment it is cast.

- **P The Lion Wakes.** Spend your burst on the lion to put him on foot, then stand on its rubble for a second and it never rises.
- **Q Lion's Paw.** Stand beyond 3.5 m. *(spacing: stand outside its reach (no reaction can beat a blow up close); first hit 0.35 s after the cast)*
- **Q2 Spear Thrust.** Step aside: 0.25 + 0.5/4 = 0.38 s against 0.4 s, or stand beyond 4.5 m. *(lane 1 m wide: 0.25 + 0.5/4 = 0.38 s needed, warned 0.4 s OK; first hit 0.4 s after the cast)*
- **W Gate Ward.** Wait the shield out; step out of 4 m while he braces.
- **E Lion's Leap.** The landing shows: leave 1.5 m from it, 0.25 + 1.5/4 = 0.63 s against 0.7 s. *(circle 1.5 m: 0.25 + 1.5/4 = 0.63 s needed, warned 0.7 s OK; first hit 0.7 s after the cast)*
- **E2 Call the Lion.** Hit him while he calls: 1.5 s standing still.
- **R The Gate Shuts.** Leave the lane: half of 2.5 m, 0.25 + 1.25/4 = 0.56 s against 1.0 s. *(lane 2.5 m wide: 0.25 + 1.25/4 = 0.56 s needed, warned 1 s OK; first hit 1 s after the cast)*

### The question, the weakness, the second decision

- **Question:** "Hit the lion, or wait for the man?"
- **Weakness:** Mounted he is a big target and the lion takes every hit first; on foot he is a plain spearman until the lion rises.
- **Second decision:** Call the lion back early, standing still at its rubble for 1.5 s, or fight on foot until it rises by itself after 15 s; either way he must keep the enemy off the rubble.

### Budget

Tank, 840 HP in two parts (lion 280, rider 560). Mounted damage Q 48, E 40; the ultimate 110 with a 0.5 s stun mounted, 90 on foot. The lion's rise (150, once a round) is sustain, far over the heal rule; like Anka's second life it is allowed only because the enemy can take it away (stand on the rubble 1.0 s), and gate 5 decides both numbers. The balance runs at gate 5 decide the final numbers ([kit-common.md](kit-common.md), 40-60% wins).

### What the engine needs, and on which screen it is decided

**Engine work: small.** His bar is cut in two unequal parts (`hpChunks` cuts equal ones today) and his kit changes when the first is gone, with the swap Pim and Pom use (`HeroKit.alt`, `swapKit`). The risk is the look, not the engine: the animation packs have no riding clips, and rule 5 allows only the packs' clips. Build order: 9 of 20 ([the kits page](../../docs/heroes/kits20/index.html)); the engine sizes come from reading the docs (`docs/architecture/mechanics.md`, `pipeline/designs/kit-build-brief.md`), not `src/traits/types.ts`, so the order is to be confirmed by whoever reads the code first.

**Risk:** The look: a rider on a lion needs riding motion the animation packs do not have (rule 5). Settle it at gate 2 before anything else.

| Key | Needs | Decided on |
|---|---|---|
| P The Lion Wakes | Unequal `hpChunks`; `swapKit` on the own client when the first part is gone, `show` for the other screen. | His client. |
| Q Lion's Paw | A cone. | The victim's screen. |
| Q2 Spear Thrust | A short line. | The victim's screen. |
| W Gate Ward | `ctx.shieldSelf`; a self ring with a slow. | His client; the slow on the victim's screen. |
| E Lion's Leap | `ctx.moveCaster`; a circle at the landing. | The victim's screen. |
| E2 Call the Lion | A channel (`ChannelBar`), then `swapKit`. | His client. |
| R The Gate Shuts | A dash with a carry (`HitOptions.pull` toward the lane's end, 4 m). | The victim's screen. |

### What the CPU does

**As Ramet** (`aiHold`, `aiGoal`):

- Mounted: E to engage, Q in reach, W under fire, R when the enemy is in a lane within 10 m.
- On foot: keeps away until the lion rises; E2 when the enemy is more than 7 m away.

**Against Ramet** (`enemyGoal`):

- Fights as usual while he is mounted; presses him on foot.
- Stays off his rubble when it rises; leaves the R lane.

### The effects, part by part

In the hero's palette: accent desert rose with a pale bleached bone foil beside every dark part, a dark layer under the brightest, nothing in the enemy's red, every shape at least 0.15 m thick from the play camera; what the opponent must read (the wind-up, the circle, the line) is the best-drawn part, and the drawn shape is exactly what hits.

- **P The Lion Wakes:** The lion of sandstone with gold inlays and a glowing turquoise eye; thrown, it cracks into carved blocks with gold dust.
- **Q Lion's Paw:** A sandstone paw swipe with desert-rose dust.
- **Q2 Spear Thrust:** A spear thrust with a desert-rose streak.
- **W Gate Ward:** A gold-banded shimmer round him; the roar a ring of blown sand.
- **E Lion's Leap:** The lion leaping, sand bursting at the landing.
- **E2 Call the Lion:** The rubble lifting stone by stone into a lion.
- **R The Gate Shuts:** A desert-rose lane drawn in sand on the floor; the lion charges with a gate's shadow behind it; a slam of sand at the end.

### Names and files (checked free on 2026-11-14)

Labels: 'lion's paw', 'spear thrust', 'gate ward', 'lion's leap', 'call the lion', 'the gate shuts'. Files: `src/heroes/sphinx/spells/lionsPaw.ts`, `src/heroes/sphinx/spells/spearThrust.ts`, `src/heroes/sphinx/spells/gateWard.ts`, `src/heroes/sphinx/spells/lionsLeap.ts`, `src/heroes/sphinx/spells/callTheLion.ts`, `src/heroes/sphinx/spells/theGateShuts.ts`; in `src/heroes/sphinx/` also `hero.ts` (the card), `icons.ts`, `trait.ts` and `parts.ts`. Checked against the cards (`src/heroes/*/hero.ts`) and the labels and file names in `src/heroes/*/spells/` and `src/spells/targeted/` by the script.
