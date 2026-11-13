---
title: The Tower, floors as worlds
tags: [tower, mode, design]
updated: 2026-11-13
---

# The Tower: floors as worlds

Page for the user: [tower-worlds.html](tower-worlds.html). The Tower of short rooms built on 2026-11-12, which stays as
"Trials": [tower.md](tower.md), [docs/architecture/tower.md](../../docs/architecture/tower.md). What of this is built
and how it works: [docs/architecture/tower-worlds.md](../../docs/architecture/tower-worlds.md), once it exists.

## What the user asked (2026-11-13)

Asked what the game should be, the user chose **boss fights first** ("players and fun, lets go with boss fights first")
and then: "what if we make that tower mode like those tower manhwas where on each floor there is like whole world and
there is some quest npc, open world mobs and boss, and then the gates to upper floor that is guarded by gatekeeper".
Shown the first page: **"add there more content and yes after that lets build it and lets build at least 5 floors"**.
That is a yes to the five proposed decisions (below) and the word to build floors 1 to 5.

## The idea in one line

Climb a tower where every floor is a small world: arrive at a camp, take quests, fight what roams, beat the floor's
ruler, then win a duel against the gatekeeper to go up. What you reached is kept; you grow as you climb.

"A whole world" taken literally is an MMO. The design keeps the feeling and sets the size: **one zone a floor, about
20 minutes, alone first, later with two friends.**

## One floor

| Part | What it is | Made from |
|---|---|---|
| The camp | Where you arrive. Safe. The floor's keeper gives the main quest, a second figure gives side quests, a trader sells for shards, the gate up is in sight, sealed | Heroes of the roster as the people |
| The zone | One map about four times an arena across (radius about 50 m against 13 to 16), five or six places joined by paths, in one arena's look | The arena looks; the follow camera and the path finding the game has |
| The floor's law | One rule of the floor that changes how you move through it (the tide, the walking wood, the storm, the dark, the war) | The arenas' own events where they fit |
| What roams | Three kinds of small enemy a floor in packs of three to five, one elite, and one **named** enemy that walks the zone and is worth hunting. They guard places; cleared stays cleared | The Tower's keepers (units that walk, strike and shoot) with new looks and pack behaviour |
| The main quest | Three steps that lead across the zone and end at the ruler's door | New: a small quest system (go there, fell these, carry this, hold out here, light these) |
| Side quests | Two a floor, each paid with a boon | The Tower's 17 boons |
| A bounty | The named enemy: paid with shards and a relic | |
| Secrets | Three hidden caches a floor (shards, sometimes a boon) off the paths, and one lore stone that tells the floor's story in two lines | |
| Waystones | Two or three a floor: touch one and you can step back to it from the camp, and you return there after a fall | |
| A trial door | One a floor: a door in the world into one short room, for a relic | The six kinds of room the Tower has today |
| The rival | Another climber, a hero of the roster, met on the floor: on the road with a word, then at one place as a short duel or a race. Beat them and they pay a boon and fight beside you against the ruler | The CPU duel; a summoned ally |
| The ruler | The floor's boss, in its lair at the far end, with three phases and one mechanic made of the floor's law. Every tenth floor a Raid boss | First the Tower's guardian (a giant, three phases, kneels) with each floor's own moves; a body of its own per floor later |
| The gatekeeper | At the gate: a duel, one against one, against a hero of the roster with its real spells, played by the computer, in a small ring under the floor's law. Win and the floor above is yours | The CPU duel; the CPU's level rises with the floor |

## Shards and the trader

Enemies, caches and quests drop **shards**, the floor's coin (they are spent on the floor; what is left turns into a
few obols at the gate). The trader in the camp sells: a heal, one boon of three shown, a second life back, the key
to the trial door if the quest for it was skipped, and a hint to a cache.

## Falling

Three lives a floor. A fall takes one and puts you at the last waystone touched (or the camp) with half health; what
was cleared stays cleared and quests keep their progress. With none left the climb of this floor ends: begin the floor
again from its camp, with the boons you arrived with.

## Growing as you climb

- **On a floor:** quests, the rival, the trial and the bounty pay boons (a heal, a power, a relic); they last for this climb.
- **For good:** each gatekeeper beaten opens the next floor on the account (begin at any camp reached), and lets the
  climber keep **one** of the boons carried, as a **sigil**, for every later climb. Sigils count in the Tower only:
  never in a duel against a player, never in the Raid.
- **Mastery:** four stars a floor: cleared; every quest done; no life lost; under the floor's time. Stars show on the
  floor's tile and add up to a title.
- **Records:** the highest floor, and each floor's best time, on the week's board the accounts have.

## The five floors

| | 1 · The Drowned Harbour | 2 · The Walking Wood | 3 · The Storm Canyon | 4 · The Lightless Deep | 5 · The Field of Banners |
|---|---|---|---|---|---|
| Look | Drowned Harbour | Verdant Glade | Sandstone Canyon | Crystal Cavern | Fallen Battlefield |
| The law | **The tide.** Every 80 s the sea comes in for 15 s: the low ground floods (slow, and it hurts); quays and decks stay dry | **The wood walks.** Every 2 minutes roots close one path and open another; the map changes under you | **The storm.** A wall of sand crosses the canyon every 90 s: in it you see a few steps and take harm unless behind a rock | **The dark.** Only crystals give light. Beyond it you see nothing and the lurkers hunt. A carried shard lights a few steps | **The war.** Two ghost armies fight for ever. Take a banner in the camp: its soldiers leave you be, the others hunt you |
| Keeper (main quest) | Gus, the harbour's keeper | Bo, the shepherd | Pip, the courier | Mabel, the delver | Cantor, the war singer |
| Side quests from | Anka, washed ashore | Mortis, digging | Kaia, storm watcher | Isolde, lost her lantern | Sir Whiskers, deserter |
| Roams | Drowned dockers (strike), net casters (shoot, root), brine crabs (slow, armoured) | Bark hounds (fast packs), thorn sprites (shoot), moss giants (slow, heavy) | Raiders (strike), slingers (shoot), dust wraiths (only in the storm) | Shard mites (swarms), lurkers (wait in the dark, leap), crystal golems (slow, reflect a bolt) | Footmen (strike), bowmen (shoot), knights (charge) of the other banner |
| Elite | The Harbourmaster's Mate | The Stag-Crowned | The Raider Chief | The Lantern Thief | The Banner Bearer |
| Named (bounty) | Old Barnacle | The Hollow Oak | Dune Mother | The Pale One | The Deserter Knight |
| Main quest | Clear the fish market; light the lighthouse; bring the captain's key from the wreck | Free three bound wisps; follow them to the heart; cut the three roots that feed it | Carry water to the three wells; shelter the caravan through a storm; break the raiders' gate | Carry a great shard to three dark crystals and wake them; each one lights a hall | Take three standards; hold the hill for a minute; break the siege line |
| The rival | Zephyr: a race to the lighthouse | Nyx: a duel in the thicket | Vesper: a duel on the bridge | Tempo: a race against the dark | Brannoc: a duel between the lines |
| The ruler | **The Drowned Captain.** Anchor sweeps, a cannon volley from the wreck; at half he calls the tide early and fights in the water where only the deck is safe | **The Elder Root.** A heart tree that does not move: cut its feeding roots (they regrow) while it throws thorns and raises walls of roots | **The Scarab Colossus.** Burrows and bursts up under you; in its last phase it calls the storm and only its own shell casts shelter | **The Prism Mother.** Beams turn between her crystals; break a crystal to make a dark gap to stand in. Last phase: the light goes out | **The Last Marshal.** Fights with his guard: waves of both banners; fell the standard and his guard kneels. Last phase alone, on a horse of smoke |
| Gatekeeper | Marin, the tide | Fenna, the grove | Sefu, the sand | Opaline, the prism | Oblivion, the void |
| The gate's ring | The tide comes in once | Roots rise as cover mid-duel | A storm crosses once | Half the ring is dark | Arrows fall on a line now and then |

Floor 5's gate opens on a landing that says the climb goes on: floors 6 to 10 are the next work, the tenth with the
Sun Warden for a party.

## What happens to the Tower of today

The weekly Tower of short rooms stays, under the name **Trials**: the quick mode with its weekly board, and the rooms
behind the trial doors on every floor. Nothing built is thrown away.

## How the three modes fit

Duels are how a gate is won. The Raid's bosses rule every tenth floor (a party fight). The Tower is the road between
them. One game: climb, fight bosses, with friends or alone.

## What is new work (and the risk in each)

1. **A map four times as wide.** The camera follows already; the floor, the lights, the path finding and the frame
   rate at that size are untried. The performance session started on 2026-11-13 matters here.
2. **Enemies that roam.** The keepers walk at the hero and strike; a pack that waits, wakes, calls and goes home is new.
3. **Quests and people to talk to.** New: a quest list on the screen, a mark over a quest giver, a few lines of text,
   all usable on a phone.
4. **Keeping the climb.** In the browser first (as the Tower's best floor is), on the account after.
5. **Friends on one floor.** The Raid's party code carries heroes and one boss; a zone with packs of enemies on
   several screens is more. Alone first.
6. **Content.** Each floor is a map, enemy looks, a ruler, quest texts. A floor must be cheap to make, so floor 1 is
   built as a template and floors 2 to 5 are data on it.

## First version: what "built" means for floors 1 to 5

Alone, offline, no account, as the Tower's first version was. Honest limits, to be lifted with the artist:

- **The zones are drawn in code** from the arenas' own pieces and materials, first pass, for the artist to direct; no
  new Blender scene per floor yet.
- **A ruler is a giant with the floor's own moves** (the guardian's way: a hero's model drawn big), not yet a body of
  its own. Its mechanic and phases are real.
- **Enemies' looks are drawn in code** as the keepers' are.
- **No friends yet,** and the climb is kept in the browser, not on the account.

## The order to build it

| Step | What | Done when |
|---|---|---|
| 1 | **The world system and floor 1, alone, the whole loop** | The autopilot goes from camp to gate; pictures of every part; then the user plays it |
| 2 | **Floors 2 to 5** as data on the template, each with its law, enemies, quests, rival, ruler and gatekeeper | The autopilot climbs all five; pictures of each |
| 3 | **What playing it showed;** bodies of their own for the rulers; zones built in Blender | The user's word |
| 4 | **Friends:** up to three on a floor; the climb kept on the account; the board | Two browsers climb floor 1 together |
| 5 | **Floors 6 to 10,** the tenth with the Sun Warden for a party | A season's Tower |

## Decisions (the user's "yes", 2026-11-13)

| # | Question | Decided |
|---|---|---|
| 1 | Does power stay for good? | Yes, as sigils, one a floor, in the Tower only |
| 2 | The Tower of today | Kept as Trials |
| 3 | The gatekeeper | Every climber duels alone; the others watch |
| 4 | Where to start | Floor 1, alone, the whole loop; then floors 2 to 5 |
| 5 | The first floor's look | The Drowned Harbour |
