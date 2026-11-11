---
title: The Raid for up to 40 players
tags: [raid, online, design]
updated: 2026-11-11
---

# The Raid for up to 40 players

## What the user asked (2026-11-11)

> "can we make like lobby for 40 players but they can have whatever players and difficulty will scale like this if they have 1-2
> players difficulty will be set for two players if 3-5 difficulty will be for 5, 5-10 difficulty set to 10 players, 10-15 diff up
> to 15, 15-20 diff up to 20 players and then it will scale 20-30 will be 30 and 30-40 will be 40"

Decided the same day: build it **now** (Rewards, option E, waits until after it); players find a raid by **a public list and a code**
(open raids in a list anyone can join, a code for a private one; the host starts). Alone, offline, stays as it is.

| Players in the raid | The boss is tuned for |
|---|---|
| 1-2 | 2 |
| 3-5 | 5 |
| 6-10 | 10 |
| 11-15 | 15 |
| 16-20 | 20 |
| 21-30 | 30 |
| 31-40 | 40 |

The band is taken from the players present when each fight starts.

## Rules that must change with the band (they break silently at 40)

- **Boss HP** grows with the band (the duo's HP times band / 2).
- **The stagger gauge** fills from every player's control: its size grows with the band, and so do what mechanics put in it.
- **Gold zones, sun shards, split soaks:** how many must stand or carry grows with the band; a split zone shared by 40 would be free.
- **Damage caps per player** stay per player; the hub's cap on the boss's HP per second grows with the band.
- **Side doors:** a door opens on a majority of those present (not all), or the host's choice; the label says so.
- **The brain's screen:** the hub moves the brain to another screen when none of its casts or moves arrive for a few seconds (one
  phone in a pocket must not freeze the boss for 39 others).
- **Revive:** the message names whom; anyone standing by a fallen hero gets them up.
- **Same hero twice:** to be checked: a partner's replay of a spell another player also casts must not cut the other's cast short.
- **Cost on a phone:** 39 other heroes drawn and their spells replayed. Measured before deciding a cheaper far figure and a cap on
  replays.

## How it is built

A vertical slice first, shown as a clip: 5 bots through one Warden fight, then 10, then 40 with the performance work. A party of 1
or 2 must behave exactly as today's raid for two (the server smoke test passes unchanged). Server and lobby first; the boss files
(`types.ts`, `brain.ts`, `script.ts`, the bosses) are moved to N players in one pass once the Heart of Noon is merged.

## Measured before building (2026-11-11)

- **Same hero twice.** The game keeps one effect per spell label (`castAs` in `src/runtime.ts` restarts it), so a partner's replay of a
  spell this screen's own hero also has would cut this hero's own cast short, hits and all. Rule: a screen never replays a partner's
  cast whose label is in its own hero's kit (both forms); it shows only the partner's cast pose. Partners' replays of each other's
  labels only restart a picture, which is harmless. So any number of players may take the same hero in a party.
- **39 other heroes on screen** (the Warden's room, a desktop at 60 fps): no cost on the desktop. With the CPU slowed six times (a
  phone's stand-in), 16.7 ms a frame alone, 104 ms with 39 walking partners; drawing them is most of it (88 ms drawn and still, 20 ms
  hidden). So only the nearest partners are drawn in full (8 on a phone, 16 on a desktop); the rest are light stand-ins. Their look
  is shown to the user first.

## The messages (PROTOCOL 8)

Everything that works for two today keeps working for two: the server smoke test passes unchanged.

**Lobby.** A raid lobby holds up to 40 seats (`RAID_PARTY_MAX`). `lobby_create { raid, open }`: `open` lists it publicly. The lobby
state gains `open`, `max`, `band` (from its seats now) and `host` (seat 0). Anyone may pick any hero (duplicates allowed in a raid
lobby of more than two; a lobby of two keeps today's rule). `lobbies` answers `{ list, raids }`: `raids` are the open raid lobbies with
a free seat (`code`, `host`, `count`, `raid`). The host starts: `raid_go` (every seat must have a hero; a lobby of two also starts as
today, when both are ready).

**Start.** `raid_start { id, side, you, partner?, party: [{ side, name, hero }], band }` (`partner` only when there are two).

**Moves.** With more than two players the hub batches walks: `party_moves { list: [[side, x, z, yaw, ts], ...] }` to each player, the
newest of each other player, 10 times a second. With two, `peer_move` as today. Clients send `move` at 10 Hz when the party is over two.

**Who did it.** Every relayed `peer_cast`, `peer_attack`, `peer_form`, `peer_debuff`, `peer_add`, `partner_hp`, `partner_left`
carries `side`. `revive { side }` names whom. `peer_down` and `revived` already carry `side`.

**The band.** `raidBand(n)`: 1-2 → 2, 3-5 → 5, 6-10 → 10, 11-15 → 15, 16-20 → 20, 21-30 → 30, 31-40 → 40. Taken from the players
present (not left) when a fight starts, sent in `raid_stage { band }`. The boss's HP: `raidHp(id, band, tier)` = the duo's HP × band / 2
(band 2 is today's duo exactly; alone offline keeps its own). The stagger gauge's size: `staggerMax × band / 2` (sent too).

**Gold zones.** `boss_stood` counts the players standing, of those not down and not left, once all of them have said or the wait ran out.

**Side doors.** A door opens when more than half of those present walked into the same one (for two: both, as today).

**The brain.** If no `boss_cast` or `boss_move` comes from the brain's screen for 4 s during a fight, the hub gives the brain to the
next player present (`boss_brain`).

## The room grows with the party (user, 2026-11-11)

> "make the boss room bigger much bigger so that the 40 player will be lost there"

`raidRing(id, band)` in `server/protocol.mjs`: the room for two as it was (16 m), then 20, 26, 30, 34, 40 and 46 m for the bands 5 to
40. A boss with `BossDef.resize` fits its room before the fight is built (`Duel.startBoss({ band })`). **Built for the Sun Court
only, as the look to agree first** (`setCourtSize` in `src/arenas/suncourt.ts`): the old court stays as the middle; an outer court of
the same slate runs to the new rim, with rings of columns and breakable screen walls every 4.5 m (100 pieces of cover at 46 m), more
fire bowls on the rim, the backdrop pushed out. His moves that cover the floor reach the new rim; heroes come in at the south gate;
an arrow points to the boss when he is out of sight. Pictures: `docs/raid/court-40-overview.jpg`, `court-40-play.jpg`,
`court-40-phone.jpg`. **To do:** the hub clamps walks to the old 16 m (use `raidRing` once the server branch is merged); the Cinder
Pit and the Heart's room the same way; the fight for two is untouched but was not measured again.

## A boss room, not a round arena: the Hall of Noon (user, 2026-11-11)

> "okay but bro make like custom arena in blender or where you want for the boss it dont need to follow the others arenas"
> "and what if the arena have not like round arena lets just forget all and lets make boss room"

Two tries before this were dropped: the Sun Court made wider with rings of columns, and the Great Dial (a round sundial 46 m to the
rim, built in Blender). **The Sun Court stays the room for two, 16 m, as it was.** A party (band over 2) fights the Warden in **the
Hall of Noon**: a hall in the shape of a cross cut out of dark stone. `blender/arenas/real/sunhall.py` ->
`public/models/arenas/sunhall.glb` (865 KB) and `src/arenas/real/sunhall.json`; `src/arenas/sunhall.ts` draws its floor and lanterns
and breaks its screens. The nave (26 m wide, 44 m long) runs from the south gate to the crossing, where the Warden waits at the Sun
Well with the court for two round him; transepts 34 m west and east; the choir 40 m north to his throne under a gold halo. Cover: hour
stones in rows, fallen halo pieces, ray shards, braziers, column stumps (89 obstacles with the walls).

How a room that is not round works: the game's floor stays a ring (46 m, `RAID_BOSSES.sun.partyRing`, `raidRing`; the hub clamps
walks to it); the hall's shape is its own walls, obstacles that never break (`Obstacle.fixed`). The stone is 1.3 m high on the
camera's side and 9 to 11 m to the north; a zone drawn wider than the floor is hidden inside it. One size for every party: the band
only sets the boss's HP and gauge. Pictures: `docs/raid/hall-overview.jpg`, `hall-play.jpg`, `hall-phone.jpg`. **Shown to the user,
waiting for the nod.** A fight in it has been run and fixed since (below: The first fights in the hall). Not done: the Cinder Pit's
and the Heart's party rooms; his mechanics scaled to the band.

## The server half is merged (2026-11-11)

Branch `t3/raid-party-server-protocol-8` merged (`bfbb252`): PROTOCOL 8, lobbies of 40, `raid_go`, `party_moves`, `side` on relayed
messages, the band, majority side doors, the brain's watchdog. The client now sends a keep-alive from the brain's screen once a second,
handles `brain_moved` (`BossFight.dropBrain`) and takes the gauge's size from `raid_stage`. Not done: a raid of bots through the real
hub; `docs/architecture/raid.md` and `multiplayer.md` for the new messages; the Heart's branch still says PROTOCOL 7 (take 8).

## Unique mechanics, one per boss (user, 2026-11-11)

> "and can we make like uniques mechanics for the bosses"

Nine ideas were shown (`pipeline/designs/raid-mechanics.html`); the user picked one per boss:
- **The Sun Warden: The Hour Strikes.** In the Hall of Noon he calls an hour: three of the hall's four arms fill with sunfire, the sun
  road on the floor lights in the one safe arm, and the whole party runs there before the bell. A party's mechanic (the hall).
- **Ash and Ember: Twin Flames.** For a party both fight at once, one on each side of a wall of fire that splits the room and the
  party; their health must fall together, or the one behind grows furious. Each screen still has one enemy (its side's boss) and the
  other is only drawn, so the engine's rule holds; the hub keeps two HP pools. The biggest of the three; built after the other two.
- **The Heart of Noon: Hold Still.** The heart beats in a rhythm shown on the floor; on the beat anyone moving is burnt; between
  beats, run. The rhythm quickens as it dies.

## The first fights in the hall, and The Hour Strikes (2026-11-11)

Built in the worktree branch `t3/c65abf91`; how it works now is in `docs/architecture/raid.md` (The Sun Warden, In the Hall of Noon).

**What broke in the hall, and what was done.**

| What | Fix |
|---|---|
| The walk planner worked its whole map out anew each time the cover changed: 2.2 s with the hall's 86 pieces, on every fallen stone. One autopilot fight took 50 s to run; in play it would be a freeze on the brain's screen and for whoever taps to walk | `src/nav.ts` finds a point's links when a plan first comes to it and skips far cover: under 0.1 s. A fight runs in 4 s. Same routes as before in the court and the duel arenas |
| A walk ordered into the stone round the hall searched the whole map for a way (0.4 to 0.8 s) | The hall's floor is charted once; such an order ends at the nearest spot the walker can reach |
| A hall wall that hid a hero from Noon was reported as "the wall that saved" and taken out of the game (`removeCover` does not ask whether it is fixed) | `BossScript.strike` reports only a screen; `BossFight` never breaks a fixed wall, whoever says so |
| Six corners behind braziers: a hero put or pushed in there could not be planned out, and stood there to the end | Solid to the game (`CORNERS` in `src/arenas/sunhall.ts`) |
| The way out stood in the stone north of the throne | `BossDef.gates.exitR`: it stands before the throne |
| Five of a party's 40 start spots lay on a fallen halo piece | `starts` puts the first row just inside the gate: one spot of 40 is left on it (seat 39), and that hero is pushed off. A clean fix is in `src/duel.ts` (below) |
| Deep in an arm Sun Order's wedges and Eclipse's far ring could not be walked out of | In the hall the wedges reach 19 m from the Sun Well and the far ring 20 m from him |
| A shard picked up by seat 3 or higher could not be brought in (only seats 0 and 1 had a way in) | One way in for each seat |
| His aim could put a stone into the wall beside a hero | `intoHall`: 1.8 m inside the walls |

Checked and left as it is: Gathering Noon, the Long Hour's blow, Walking Sun and the late sunfire cover the whole hall, and the stone
hides what is drawn past its walls (looked at from far out). The hall's corners are cover from Noon and the ray, on purpose: light
does not go round a corner, and the gold shadows show it. His stage's Hour Stones rise 9 m from the Sun Well, inside the crossing.

**Measured** (one autopilot hero, the boss's HP for one; `_raid(names, 2, { band })`, ten heroes: Lyra, Kaia, Sefu, Isolde, Vesper,
Brannoc, Nyx, Bram, Zephyr, Sirix):

| | Clears | Seconds a fight | Damage a second | Fights that enraged | Errors, fights that never ended |
|---|---|---|---|---|---|
| The Sun Court (band 2) | 8 of 20 | 131 to 163 | 20 to 30 | 6 | none |
| The hall (band 5), enrage 2:30 | 6 of 20 | 133 to 211 | 12 to 25 | 16 | none |
| The hall (band 5), enrage 3:15 | 3 of 20 | 132 to 182 | 13 to 23 | 4 | none |

Twenty fights swing by more than these differences, so the two hall rows are one finding: about 9 of 40. The hall is harder for
one autopilot hero: it walks 40 m to him, and during an hour it waits at the safe arm's mouth, where a melee hero does not reach him.
That is why the hall's enrage was moved to 3:15; it is a number to judge by playing. The fight for two is untouched: `_raidCheck()`
passes its 95 rows as before, and 37 new ones for the hall.

**The Hour Strikes' numbers.** The bell 23 s after the call, never under 19 s at a higher tier: the longest way in the hall (the
gate's passage to the choir, 58 m) took the autopilot 17.7 s at 3.5 m/s; all 24 ways between the arms' far ends took 7 to 18 s
(`pipeline/tools/hour-walk.js`). 60 % of max HP. First 20 s into the fight, then 55 s after each call. He stands 3 s for the call and
fights on with his four small moves.

**Needs `src/duel.ts`** (not edited: another helper is its one writer):
- `partyStart(first, side)` lays rows of eight from one spot. In the hall no spot keeps all 40 off the nave's cover. It should take
  the spots from the boss (`BossDef.starts` with a list for a party), or skip a spot that lies in cover.
- `removeCover(i)` should refuse an `Obstacle.fixed` wall itself; today the raid's files guard it.
- The autopilot stands at the safe arm's mouth during an hour. To make it lead him into the arm, `pilot` would have to treat an
  open objective that cannot be taken as "stay near", not "walk to it and do nothing else".

**Not done or not checked:** a party of people or bots in the hall through the hub; forty heroes in one arm; the bell's cost on a
phone; his mechanics scaled to the band (Noon's two shards, Anchors' two circles); the Cinder Pit's and the Heart's party rooms.

## State (2026-11-11)

- Not started in code. The Heart of Noon is being built by a helper in its own worktree (its `PROTOCOL` 6 -> 7 is only there; main
  carries omens and side doors at 6, so one bump must be on main before any deploy).
- The friend brackets' server half was moved out of the working tree into `git stash` ("friend brackets: server half"), so the hub
  can be rebuilt for parties. Popping it later will conflict with the party hub.
- Not verified yet: the side doors for two were run only on the server; the Shrine's room was not looked at in the browser.
