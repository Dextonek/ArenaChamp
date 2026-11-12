---
title: The Tower, a new game mode
tags: [tower, mode, design]
updated: 2026-11-12
---

# The Tower

## What the user asked (2026-11-12)

> "i want to make like tower idea waht do you think ?"
> "but do new like gameplay like new gamedoed tower letf raid untoch"

A new game mode beside duels and the Raid, with gameplay of its own. **The Raid stays untouched.** Shown as a page
(`pipeline/designs/tower.html`) and agreed: "Yes, build it"; **alone first** (one player, offline, no account needed; friends
later); **the same Tower each week** for everyone (a new one every Monday), so highest floors compare fairly.

## The mode

- **A run:** floor, boon, floor, boon... Each floor is one short room, 30 to 90 seconds. Clear it and the stairs open; walk onto
  them. Every 10th floor is a guardian. How high can you climb?
- **Health carries over.** It does not refill between floors (the Raid refills at each fight). Three lives a run: a fall costs one
  and puts you back at that floor's start with some health.
- **Six kinds of floor:**

| Kind | What you do |
|---|---|
| Gauntlet | No enemy. Cross a room of sweeping fire and falling stones to reach the stairs |
| Horde | Waves of small enemies pour in from the doors. Clear them all |
| Duel | A hero of the roster guards the stairs, played by the computer, with one twist (twice as big, or two of them) |
| Break it | A crystal seals the stairs. Break it before the timer ends while turrets shoot at you |
| Hold out | The stairs open in 45 seconds. Stay alive while the room turns against you |
| Guardian (every 10th) | A giant version of a hero with boss health and new attacks. Beating it saves your progress |

- **Boons, not raid upgrades:** after each floor one of three: a heal, a new power, or a relic that changes a spell. The Tower has
  its own set.
- **It gets stranger as you climb:** from floor 11 floors mix two kinds, and rooms get twists.
- **One number:** your highest floor this week, on a board (in this browser first; a shared board comes with the accounts work).
- **The week's Tower:** the floors, their order and the boons offered come from the week's seed (the ISO week), the same for everyone.

## How it is built (first version)

All new code in `src/tower/` and its own rooms; the Raid's files are not changed (the Tower may import the Raid's engine: a floor is
a fight on the duel's boss path, `Duel.startBoss`, as the Raid's hall is). No server work in the first version.

## What was built (2026-11-12, first version)

How it works: [docs/architecture/tower.md](../../docs/architecture/tower.md). Pictures and the numbers on one page:
[docs/tower/tower.html](../../docs/tower/tower.html). Not pushed, not live. **Nobody has played it:** it was climbed by the
autopilot and looked at in pictures.

- **The mode:** "Tower" in the top bar and on the login, beside Raid. Pick a hero, see this week's Tower floor by floor and your
  best floor, Start. One player, offline, no account.
- **A climb:** floor, landing (three altars: a heal, a power, a relic; then the stairs), next floor. Health carries over, three
  lives, a fall starts the floor again with half health. The week's name (the ISO week, UTC) is the seed of everything: the order
  of the floors, whose echo guards them, the twists, the boons offered. The best floor is kept per week in this browser.
- **Six kinds,** each a fight on the Raid's engine and each made of something else: a room only walked with a brain that casts
  at you (Gauntlet, Hold out), units that walk and strike (Horde), a still boss with a clock and sentries (Break it), a hero's own
  model drawn big with a boss's moves (Duel, Guardian).
- **17 boons** of the Tower's own (3 heals, 5 powers, 9 relics), on the Raid's `RunUpgrades` so the duel takes them.
- **From floor 11:** each floor borrows one thing from a second kind and two in three have a twist (five twists).
- **One place:** a round stair-well room drawn in code, the floor's number inlaid in its middle, three looks by height.
- **The Raid is untouched:** nothing under `src/raid/`, `src/duel.ts`, `src/heroMode.ts`, `src/arena.ts` or `server/` was edited.
  `_raidCheck` (133 rows), `_raidAsh` (77), `_raidHeart` (71) and `_raidUpgrades` (40) pass as before; `npm run test:server` passes.

### Numbers, as measured

`pipeline/tools/tower-climbs.js` (the autopilot at the balance level; ten heroes twice in this week's Tower, 2026-W46, and three
heroes once in each of the two weeks after). No errors, and no floor that could not be finished.

| Hero | The floor each climb ended on |
|---|---|
| Lyra, Mortis | 20, 20 |
| Kaia | 20, 13 |
| Bram | 18, 13 |
| Auriel | 18, 17 |
| Sefu, Nyx | 16, 16 |
| Vesper | 13, 13 |
| Isolde | 11, 12 |
| Brannoc | 10, 10 |
| In 2026-W47: Kaia, Sefu, Brannoc | 13, 12, 10 |
| In 2026-W48: Kaia, Sefu, Brannoc | 10, 10, 7 |

| Kind (this week, 20 climbs) | Cleared of those tried | Seconds | Health lost on a cleared floor | What felled |
|---|---|---|---|---|
| Gauntlet | 52 of 52 | 31 | 21 % | |
| Break it | 61 of 69 | 42 | 14 % | the crystal's strike 6, a beam 1, sweeping fire 1 |
| Hold out | 59 of 63 | 48 | 28 % | stones 3, the tide 1 |
| Horde | 50 of 74 | 38 | 34 % | a keeper 14, a lampbearer 7, sweeping fire 3 |
| Duel | 52 of 66 | 46 | 15 % | starfall 8, a shockwave 6 (all on floor 13) |
| Guardian | 18 of 39 | 87 | 41 % | floor 10: 18 of 29; floor 20: 0 of 10 |

- **Against the aim** ("a middling hero's autopilot reaches about floor 8 to 14, no kind a wall or free"): this week the middle of
  the twenty climbs is floor 16, a little high; in the two other weeks it is 10 to 12. The difference is the guardian of floor 10:
  this week's (Marin, a caster) let 18 of 29 tries through, the other weeks' fewer. With full health and eight boons each of four
  weeks' guardians fell to 4 or 5 of 6 heroes within three lives.
- **Walls for the autopilot:** the guardian of floor 20 (0 of 10), and a horde from floor 16 on (8 of 20, 5 of 14). The autopilot
  stands in the middle of a horde; a person would not.
- **Nearly free:** the first Break it (floor 2: 6 % lost). Its clock is the pressure, and a slow hero meets the strike.
- **How it was tuned,** in four passes: the keepers a guardian calls now ward it (the autopilot ignored them: 35 of its
  39 falls there were to a keeper); nothing is called while a gold circle shows (a stone on it pulled the autopilot out: "stand here" cost 1.8 hits a
  floor); a keeper's blow down from 4.5 % to 2.4 % and at most four at once below floor 12; duels' blows up by a third; a step in
  every number at floors 11 and 21.

### What differs from the design, and why

| The design | What was built | Why |
|---|---|---|
| "Clear it and the stairs open; walk onto them" | The floor ends as its goal is done; 0.9 s later the altars rise in the same room and the stairs open once a boon is taken | A fight that has not ended leaves its foe standing at 1 HP and still casting: only the duel's own end makes a body fall and clears the zones. So the boon and the stairs are a second, short fight in the same room, as Noonfall's hall is |
| Duel: "twice as big, or two of them" | A giant, swift, or warded (two wards to break first) | The boss path has one foe. Two would need the Raid's tag team (one in the ring, one on the rim), which is a fight of its own |
| "A hero of the roster ... played by the computer" | Its echo: the hero's model and name with a boss's five moves, not the hero's spells or passive | On the boss path the duel's AI does not run, and a hero's passive on the boss's side was never played against a boss's rules. Ten heroes can be echoes, those with no staff held upright, because an echo's own name loses the hero's hold (see the hooks) |
| "Beating it saves your progress" | The next climb this week may begin on the floor above the guardian, with the boons the hero had and three lives | The design did not say what is saved; this is the reading that makes a week's Tower something to come back to |
| "Rooms get twists" from floor 11 | Five twists on two floors of three, and one borrowed move a floor | A gauntlet and a time to hold out are only walked, so they borrow no keepers; a crystal borrows none either (its clock would run out behind them) |
| "On a board" | The best floor of this week and last, in this browser | The shared board waits for the accounts work, as the design says |
| Break it: "before the timer ends" | When the time is out the crystal strikes the room (30 %; 35 % and 40 % higher up) and again every 18 s; a pillar saves | An end by the clock would be a second way to lose a life with nothing to do about it. This way a slow hero pays and can still hide |
| Boons: "a heal, a new power, or a relic" | Always exactly one of each | Every landing then asks the same question, and it is the same three cards for everyone that week |

### What is not done or not checked

- Not played by a person, on a desktop or a phone. The pictures at 390x844 are a desktop browser at that size with touch on.
- Friends, a shared board, accounts: not in this version, as agreed.
- The six `TOWER-HOOK` places (docs/architecture/tower.md, "Hooks the engine should get"): done from the Tower's side until the
  engine's one writer adds the small methods.
- A floor's foe vanishes when the altars rise; the crystal has nothing to walk into; a hit near the stairs in a horde's room can
  say IMMUNE.
- Floors above 20 were reached once by one hero in an earlier pass (floor 27) and ran with no errors; they are not tuned.
