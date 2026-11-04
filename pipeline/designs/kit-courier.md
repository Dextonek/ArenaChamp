---
title: Pip, the last courier (kit)
tags: [design, heroes, kits, courier]
updated: 2026-11-04
---

# v5 (2026-11-04)

Theme `courier`. Skirmisher, ranged. 580 HP, 4.7 m/s, basic attack 5 m, 8 per 0.8 s (0.2 s wind-up, bolt 20 m/s). Accent `#ffd24a`, foil `#3a6ac8`.
Numbers from [new-heroes-kits.md](new-heroes-kits.md) section 11; the constants live in `src/traits/courier.ts`. Modules: `expressLetter`, `fragile`,
`shortcut`, `finalDelivery` (labels `express letter`, `fragile`, `shortcut`, `final delivery`, category `hero: courier`).

| Key | Spell | CD | Rule | Built as |
|---|---|---:|---|---|
| P | Sign Here | | A parcel lies on the arena, the drop point is shown (marks with a beam of light, a line of dashes between). Carry the parcel to the drop: +1 Charge, 3 at most. A hit on him while carrying knocks it loose where he stood; he can pick it up again after 1.2 s | `jobOf(deliveries, seed)` (pure), `marks` / `markLook` (parcel, drop, carried, dash), `tick` (his), `taken` (his), `show` |
| Q | Express Letter | 3 | 8 m, 24 m/s, 0.25 s wind-up, bolt radius 0.3: 35, +15 per Charge (kept) | Skillshot, line telegraph, a fluttering envelope with one after-image per Charge |
| W | Fragile | 9 | A parcel thrown at a spot (9 m), bursts at 1.0 s, 2.5 m: 50 and slowed 1 s | Ground circle telegraph, live-position hit at the burst, stickers scatter |
| E | Shortcut | 9 | A sprint up to 6 m in 0.3 s. With a Charge he spends one and it is ready again in 0.4 s | `moveCaster`, `cooldown` + `afterCast` in the trait (the `spent` counter tells the effect) |
| R | Final Delivery | 24 | Spends all Charges. A parcel with the enemy's name (URGENT: no trait can read a hero name) homes on them for 1.5 s at 5 m/s, then bursts: 80 + 40 per Charge within 2 m, unless they touch cover first (SIGN HERE, signed, it flies home) | `FinalRec` in `courierBooks`, moved by the effect on both screens; the hit and the signature are `victimTick` |

## Where the places come from

Both screens must draw the parcel and the drop on the same spot and `Math.random` cannot agree, so `jobOf(n, seed)` is a pure function of the delivery count `n`
and `seed`, the round second his client made the last delivery in (shown as `deliv` and `seed`, in that order). A small seeded generator picks a spot in the ring
(centre (0, 7), at most 9.5 m out) at least 1.7 m from the surface of any wall or pillar of `DUEL_OBSTACLES`, then a drop 6 to 13 m from it. The first job of a round
is always the same (round time is 0). Temporary cover other heroes raise is not read (the trait has no view of it).

## Shown values (his `t.show`)

`charge` (0-3, pips), `carry` (1: a mark pip over him), `loose` (1) with its place in `lx`, `lz` (x*10+200, z*10+100), `deliv` and `seed` (the job), `paid` (Charges the last R
spent), `spent` (counts refunded Shortcuts). The other screen reads them with `own`; `ownChanged` copies `charge`, `paid`, `spent` into `courierBooks` for the effects.

## Counterplay (checked with the numbers in kits-v5.md)

- Q: 0.25 + 6 / 24 = 0.5 s to 6 m; the step off needs 0.25 + (0.3 + 0.5) / 4 = 0.45 s.
- W: a circle is leavable when its delay is at least 0.25 + 2.5 / 4 = 0.875 s; it is 1.0 s.
- R: the parcel gains 1 m/s on a walker, so 1.5 s gains 1.5 m; with the 2 m burst a walker that starts 3.5 m away or more is out. Cover within 1.5 s also sees it off.
- Weakness: you can read his route and stand on the drop point, and a hit on him knocks the parcel loose. Weakest in a straight fight.

## The CPU

`aiGoal`: walk to the parcel, then to the drop, unless the enemy is within 4 m. `aiHold`: R only with 1+ Charge; E (which would spend a Charge) held while it has Charges
and the enemy is at least 3.5 m away. Q, W as usual; E is a dash with `escape`, so the CPU sprints away from an enemy within 3.5 m.
