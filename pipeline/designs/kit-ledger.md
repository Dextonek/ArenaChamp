---
title: Mr. Ledger, the Debt Collector (kit)
tags: [design, heroes, kits, ledger]
updated: 2026-11-04
---

# v5 (2026-11-04)

Theme `ledger`. Controller, ranged. 600 HP, 4.0 m/s, basic attack 6 m, 11 per 0.8 s (a 0.25 s wind-up, 20 m/s). Accent `#d9c27a`, foil `#3f4a3a`.
Numbers from [new-heroes-kits.md](new-heroes-kits.md) section 6; the constants live in `src/traits/ledger.ts`.

| Key | Spell | CD | Rule | Built as |
|---|---|---:|---|---|
| P | On Your Tab | | His Q and W damage goes on the enemy's tab (a number over their head). It comes due 3 s after the last charge, at +40%. Each attack they land on him pays off 2, each spell 10 | `dealt` turns the hit into `addStacks('tab')`; `victimTick` brings it due with a `'trait'` hit; `taken` counts payments |
| Q | Invoice | 3.5 | A paper flies (9 m, 20 m/s, 0.25 s wind-up, bolt radius 0.35): 72 on the tab | A real bolt; reaches 6 m at 0.55 s |
| W | Late Fee | 9 | A notice lands at a spot (9 m) after 1.0 s, radius 2.5: 62 on the tab and slowed 1.5 s | Circle telegraph, live position at impact |
| E | Call It In | 8 | The tab comes due now, without the interest. No target; needs a tab | `afterCast` shows a counter; due 0.5 s later (the book shuts) |
| R | Foreclosure | 24 | A stamp lands at a spot (9 m) after 0.8 s, radius 2.2, needs sight when it lands: the whole tab at +60%, and +20% taken from him for 3 s | Spell hit of damage 1, replaced in `dealt` by tab x 1.6; `vulnerable` 20% for 3 s |

## Network duel

The tab lives on the screen that decides the enemy's hits (offline the one screen, online the victim's). Ledger's own client holds a mirror
of the stack (it arrives through `stacksChanged`) that only feeds the badge, `canCast` and the number.

- Charging: `dealt` (the victim's screen) sets the hit's damage to 0 and adds the stack. `tabAt` (in `mem`) is the time of the last charge.
- Coming due: `victimTick` (the victim's screen), `hitEnemy` with a `damage`. It is a `'trait'` hit, which `dealt` ignores, so it never charges the tab again.
- Paying: the hits on Ledger are decided on his own client. `taken` there does `show('paid', n)`, a counter that goes up by one per step (an attack is one step, a spell five). It reaches the other screen as
  `own('paid')`, and `victimTick` takes 2 off per step of it (an attack is one step, a spell five). (`addStacks` on his client would not do: a stack he sends arrives as a stack the *enemy* keeps on him.
  `noteOwner` on his client only runs his own `peerNote`.) Offline `show` sets the same value and `victimTick` reads it in the same place.
- Call It In: `show('call', n)` from `afterCast`; `victimTick` sees it change, waits 0.5 s and brings the tab due without interest.
- Foreclosure: an ordinary spell hit; `dealt` slot 3 replaces the damage by the tab x 1.6 and empties the tab.
- Round end or a new round: the runtime clears stacks, `mem` and shown values; the words are cleared when the round clock goes back.
- The server caps one spell hit at 400, so a very large tab at +60% is capped there.

## Words

PAST DUE, FINAL NOTICE and CALLED IN are ground marks over the victim (`marks` / `markLook`, a red rubber-stamp sprite 3.4 m wide drawn over everything), written to a
per-figure `bookOf` list by the screen that decides the due and sent to Ledger's own client with `noteOwner('word', n)`.

## The CPU

- Q and W: whenever in reach.
- E: held unless the tab is at least 90; also held while R is ready, the tab is at least 120 and the enemy is within 9 m (R is the better use).
- R: held unless the tab is at least 120.

## Look

Cream paper that flutters (a bent plane rippled each frame), scraps and torn red notices, bouncing gold coins, red ink splats on the floor, a huge brass-banded rubber stamp with
FINAL NOTICE printed in rough ink, and the ledger: dark green cloth, gold corners, a pencil that really fills the right page before the book shuts. Parts:
`src/effects/parts/ledger.ts`.
