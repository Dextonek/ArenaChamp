---
title: The Tower, floors as worlds
tags: [tower, mode, design, proposal]
updated: 2026-11-13
---

# The Tower: floors as worlds (a proposal, nothing built)

Page for the user: [tower-worlds.html](tower-worlds.html). The Tower as it is built today: [tower.md](tower.md),
[docs/architecture/tower.md](../../docs/architecture/tower.md).

## What the user asked (2026-11-13)

Asked what the game should be, the user chose **boss fights first** ("players and fun, lets go with boss fights first")
and then: "what if we make that tower mode like those tower manhwas where on each floor there is like whole world and
there is some quest npc, open world mobs and boss, and then the gates to upper floor that is guarded by gatekeeper".

## The idea in one line

Climb a tower where every floor is a small world: arrive at a camp, take quests, fight what roams, beat the floor's
boss, then win a duel against the gatekeeper to go up. What you reached is kept; you grow as you climb.

"A whole world" taken literally is an MMO. The proposal keeps the feeling and sets the size: **one zone a floor, about
20 minutes, alone or with two friends.**

## One floor

| Part | What it is | Made from |
|---|---|---|
| The camp | Where you arrive. Safe. The floor's keeper gives the main quest, a second figure gives side quests, the gate up is in sight, sealed | Heroes of the roster as the people (no new models) |
| The zone | One map about four times an arena across (radius 50 m against 13 to 16), four or five places joined by paths, in one arena's look | The arena kits (harbour, glade, canyon, cavern, battlefield, frost, caldera, sky ruins, temple); the follow camera and the path finding the game has |
| What roams | Three kinds of small enemy a floor in packs of three to five, and one elite. They guard places; they do not come back once cleared | The Tower's keepers (units that walk, strike and shoot) with new looks and a few behaviours: stay near home, call the pack, give up the chase |
| The main quest | Three steps that lead across the zone and end at the boss's door: for example clear the market, light the lighthouse, bring the key from the wreck | New: a small quest system (go there, fell these, carry this, hold out here) |
| Side quests | Two a floor, each paid with a boon | The Tower's 17 boons |
| A trial door | One a floor: a door in the world into one short room, for a relic | The six kinds of room the Tower has today (gauntlet, hold out, break it...) |
| The floor's boss | In its lair at the far end, with phases | First the Tower's guardian (three phases, kneels); later a boss of the floor's own. Every tenth floor a Raid boss: the Sun Warden, Ash and Ember, the Heart of Noon |
| The gatekeeper | At the gate: a duel, one against one, against a hero of the roster played by the computer with its real spells. Win and the floor above is yours | The CPU duel, as it is; the CPU's level rises with the floor |

## Growing as you climb

- **On a floor:** quests and the trial pay boons (a heal, a power, a relic); they last for this climb.
- **For good:** each gatekeeper beaten opens the next floor on the account (begin at any camp reached), and lets the
  climber keep **one** of the boons carried, as a **sigil**, for every later climb. Ten floors, ten sigils. Sigils count
  in the Tower only: never in a duel against a player, never in the Raid.
- **One number to show:** the highest floor, on the week's board the accounts already have.

## What happens to the Tower of today

The weekly Tower of short rooms stays, under the name **Trials**: the quick mode with its weekly board, and the rooms
behind the trial doors on every floor. Nothing built is thrown away.

## How the three modes fit

Duels are how a gate is won. The Raid's bosses rule every tenth floor (a party fight). The Tower is the road between
them. One game: climb, fight bosses, with friends or alone.

## What is new work (and the risk in each)

1. **A map four times as wide.** The camera follows already; the floor, the lights, the path finding and the
   frame rate at that size are untried. The performance session started on 2026-11-13 matters here.
2. **Enemies that roam.** The keepers walk at the hero and strike; a pack that waits, wakes, calls and goes home is new.
3. **Quests and people to talk to.** New: a quest list on the screen, a mark over a quest giver, a few lines of text,
   all usable on a phone.
4. **Keeping the climb.** In the browser first (as the Tower's best floor is), on the account after.
5. **Friends on one floor.** The Raid's party code carries heroes and one boss; a zone with packs of enemies on
   several screens is more. Alone first.
6. **Content.** Each floor is a map, three enemy looks, a boss, quest texts. That is the lasting cost; a floor must be
   cheap to make, so the first one is built as a template.

## The order to build it

| Step | What | Done when |
|---|---|---|
| 1 | **Floor 1, alone, the whole loop:** the Drowned Harbour as a zone; camp with two people; three enemy kinds and an elite; the main quest in three steps; one trial door; the guardian as boss; the gatekeeper's duel; the floor kept in the browser | The user plays it from camp to gate in about 20 minutes and says whether it is fun |
| 2 | **What playing it showed**, then sigils, and floor 2 in another look (Verdant Glade) to prove a floor is a template | A second floor costs days, not weeks |
| 3 | **Friends:** up to three on a floor; the climb kept on the account; the board | Two browsers climb floor 1 together |
| 4 | **Floors 3 to 10**, the tenth with the Sun Warden for a party | A season's Tower |

## Decisions for the user

| # | Question | Proposed |
|---|---|---|
| 1 | Does power stay for good? | Yes, as sigils, one a floor, in the Tower only |
| 2 | The Tower of today | Keep it as Trials |
| 3 | The gatekeeper | Every climber duels alone; the others watch |
| 4 | Where to start | Floor 1, alone, the whole loop, before anything else |
| 5 | The first floor's look | The Drowned Harbour |
