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
waiting for the nod.** Not done or not checked: a fight in it (the boss's and the autopilot's way round the hall's corners; his
floor-wide moves; cover from Noon behind the hall's own walls); the north gate is inside the stone; the Cinder Pit's and the Heart's
party rooms; his mechanics scaled to the band.

## The server half is merged (2026-11-11)

Branch `t3/raid-party-server-protocol-8` merged (`bfbb252`): PROTOCOL 8, lobbies of 40, `raid_go`, `party_moves`, `side` on relayed
messages, the band, majority side doors, the brain's watchdog. The client now sends a keep-alive from the brain's screen once a second,
handles `brain_moved` (`BossFight.dropBrain`) and takes the gauge's size from `raid_stage`. Not done: a raid of bots through the real
hub; `docs/architecture/raid.md` and `multiplayer.md` for the new messages; the Heart's branch still says PROTOCOL 7 (take 8).

## State (2026-11-11)

- Not started in code. The Heart of Noon is being built by a helper in its own worktree (its `PROTOCOL` 6 -> 7 is only there; main
  carries omens and side doors at 6, so one bump must be on main before any deploy).
- The friend brackets' server half was moved out of the working tree into `git stash` ("friend brackets: server half"), so the hub
  can be rebuilt for parties. Popping it later will conflict with the party hub.
- Not verified yet: the side doors for two were run only on the server; the Shrine's room was not looked at in the browser.
