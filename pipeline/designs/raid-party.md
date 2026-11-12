---
title: The Raid for up to 40 players
tags: [raid, online, design]
updated: 2026-11-12
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

## The Heart's room for a party: the Sunburst (2026-11-12)

The same two sentences of the user's, for the third boss. **The Sunken Heart stays the room for two, 12 m, as it was.** A party (band
over 2) fights the Heart in **the Sunburst**: the crater under the hall where the sun fell, in the shape of the sun itself.
`blender/arenas/real/sunburst.py` -> `public/models/arenas/sunburst.glb` (596 KB) and `src/arenas/real/sunburst.json`;
`src/arenas/sunburst.ts` draws its floor, lanterns and far wall. A round well, 18 m to its rim, the Heart over its middle; eight rays,
bays 11.6 m wide, cut straight out to 34 m, one every 45 degrees; the party's way in is the gate at the end of the south ray (five rows
of eight, `partyStart`), the way out an alcove at the end of the north one under the keepers' sun sign.

**Why this shape, and not a ring or the hall's cross.** The Heart never walks, and everything it does runs outward from the middle:
rings of fire, turning beams, rays, the beat. In a sun every bay is a straight lane from the Heart to an end wall, so each of those runs
the whole length of every bay, and no wall ever stands between the Heart and a hero: the Heart sees every spot of its floor, and the
only shelter from its beat is a plate the party raises. The stone between two rays (a spur) splits a party of forty into eight bays
that don't see each other, with the well as the one place they all meet. And its fight falls on the shape: the Crown of Rays fires
down four rays and then the four between, the flare's four lanes lie over four spurs, a plate falls in front of each spur's nose.

How a room that is not round works is the hall's way: the game's floor stays a ring (35 m, `RAID_BOSSES.heart.partyRing`, `raidRing`;
the hub clamps walks to it), the shape is 39 stretches of the room's own wall (`Obstacle.fixed`). The stone is 1.3 m high on the
camera's side and 6.5 to 13 m to the north; where a tall spur would hide the floor of the ray north of it (the two beside the east and
west rays) it has a low shelf 5 m wide along that ray. Cover: one piece of the fallen armillary across half of each ray, 22.5 m out.

**The fight scales with the band** (how: `docs/architecture/raid.md`, "A party: the Sunburst"; decided and measured:
`pipeline/designs/raid-heart.md`). Every move reaches the walls. A ring's gold spots: 1, 1, 2, 2, 3, 4 for bands 5 to 40, in a row down
one ray, all to be held. Plates: 1, 2, 3, 4, 6, 8, each sheltering five. Cover stops a beam and the flare's rings, not the beat.

Pictures: `docs/raid/heartroom-overview.jpg` (from far above), `-play`, `-gate`, `-ray`, `-flare`, `-flare-play`, `-beams`, `-lock`,
`-plates`, `-plates-far`, `-beat`, `-crown`, `-phone` and `-phone-lock` (390 x 844); retaken by `python pipeline/tools/heart-room-shots.py
docs/raid`. **To show the user, waiting for the nod.** Not done or not checked: a party of real screens through the hub in it (only one
screen, with a partner's reports fed in by hand); a person playing it; the count of heroes standing instead of the band (needs one more
field in the hub's relay of `boss_cast`); `PROTOCOL` needs a new number when it goes out; the Cinder Pit's party room.

## The server half is merged (2026-11-11)

Branch `t3/raid-party-server-protocol-8` merged (`bfbb252`): PROTOCOL 8, lobbies of 40, `raid_go`, `party_moves`, `side` on relayed
messages, the band, majority side doors, the brain's watchdog. The client now sends a keep-alive from the brain's screen once a second,
handles `brain_moved` (`BossFight.dropBrain`) and takes the gauge's size from `raid_stage`. Not done: a raid of bots through the real
hub; `docs/architecture/raid.md` and `multiplayer.md` for the new messages; the Heart's branch still says PROTOCOL 7 (take 8).

## The first party raid through the real hub (2026-11-11)

`python pipeline/tools/party-raid.py <out> --players 6 --seconds 150` (`_botParty`, `_botGo` in `pipeline/tools/online-bot.js`): six
headless pages, six throwaway accounts, one public raid room, the host starts, every screen's autopilot plays. Result: the band is 10
(43,500 HP, gauge 500), the room is the Hall of Noon (46 m) on every screen, all six walk from the gate to the crossing and fight,
every screen shows the same boss HP within one message, the five partners show on each, no errors in 150 s (the boss at 62 % then,
past its enrage: six at the HP for ten is slow, as the bands mean it to be). Picture: `docs/raid/party-online-6.jpg`. Not run yet:
more than six (this computer's limit for headless pages is untested), a whole run through all three bosses, a player leaving.

## Unique mechanics, one per boss (user, 2026-11-11)

> "and can we make like uniques mechanics for the bosses"

Nine ideas were shown (`pipeline/designs/raid-mechanics.html`); the user picked one per boss:
- **The Sun Warden: The Hour Strikes.** In the Hall of Noon he calls an hour: three of the hall's four arms fill with sunfire, the sun
  road on the floor lights in the one safe arm, and the whole party runs there before the bell. A party's mechanic (the hall).
- **Ash and Ember: Twin Flames.** For a party both fight at once, one on each side of a wall of fire that splits the room and the
  party; their health must fall together, or the one behind grows furious. Each screen still has one enemy (its side's boss) and the
  other is only drawn, so the engine's rule holds; the hub keeps two HP pools. The biggest of the three. **Built 2026-11-12** (below).
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

## Harder mechanics for the Raid (user, 2026-11-12)

> "but also make the raid beetter like make dificult mechanics"

Said while the Tower was being started as its own mode: the Raid is to get better too, with mechanics that are hard. Plan: build the
six ideas of `pipeline/designs/raid-mechanics.html` the user did not pick the first time, each made to ask something of the whole
party, on top of the three picked (The Hour Strikes, Twin Flames, Hold Still):

| Boss | Mechanic | What makes it hard |
|---|---|---|
| Sun Warden | Carry the Sun | One shard per five players, from the far ends of the hall's arms to the Sun Well. A carrier is slow and cannot cast; the others must put cover or themselves between the carriers and his ray. Shards not home when Noon lands burn everyone |
| Sun Warden | Branded | A few players (one per eight) get a sun over their head that bursts after 5 s round them: they run out of the crowd, into the wings. In his last phase it comes during The Hour Strikes |
| Ash and Ember | Lantern Chain | Two players (more pairs in a bigger party) are chained: more than 8 m apart and it snaps and burns both. Ash's rocks then make the pair move as one |
| Ash and Ember | Seal the Vents | One vent per five players, each held by someone standing on it; every vent left open makes the lava rise faster, for both halves |
| Heart of Noon | Take the Blade | A fallen sun blade: its carrier hits far harder for 12 s, walks slowly and draws the Heart's attacks; the party shields them, also through Hold Still |
| Heart of Noon | Shade the Heart together | One plate per five players, each sheltering only a few: the party must split up behind them before the pulse |

Rules for all of them: the count grows with the band; a failure costs the whole party, not only the one who failed; in the last
phase two mechanics overlap; alone and for two each is either scaled down to something one or two can do or left out. They are built
per boss once that boss's file is free (Twin Flames and the Heart's party room are being built in `ashEmber.ts` and `heart.ts` now).

## Mechanics by party size: 10, 20 and 40 (user, 2026-11-12)

> "like make mechanis that only is cast when there is atleasst 10 players and for 20 and 40 diff also make some"

Each boss gets mechanics that only come in a fight tuned for at least 10, at least 20, and 40 players (the band, taken from who is
there when the fight starts). A smaller party never sees them. The engine's part is in: `BossMove.minBand`, `BossDef.band` (set by
`resize`), `bandFits`; the brain leaves a move out of its lists when the band is too small (`src/raid/types.ts`, `brain.ts`; the
Warden's and the Heart's `band` are wired, Ash and Ember's when their files are free).

| Boss | Any party (3+) | 10+ | 20+ | 40 |
|---|---|---|---|---|
| Sun Warden | The Hour Strikes | **Branded:** one player in eight gets a sun that bursts round them; they run out of the crowd | **Carry the Sun:** a shard per five players from the arms' far ends to the Sun Well; carriers are slow and cannot cast, the rest block his ray; a shard not home burns everyone | **The Four Hours:** all four arms get a task at the same time (carry, hold anchors, break his hour stones, stand in the safe wedge); the raid splits into four squads of ten, and a failed arm burns the whole hall |
| Ash and Ember | Twin Flames | **Lantern Chain:** pairs chained together, more pairs in a bigger party; over 8 m apart it snaps and burns both | **Seal the Vents:** a vent per five players on both halves; every vent left open makes the lava rise faster for all | **The Changing of the Flames:** gates open in the wall of fire for a few seconds and the marked half of each team must cross to the other boss; who stays on the wrong side burns |
| Heart of Noon | Hold Still | **Shade the Heart together:** a plate per five players, each sheltering only a few; the party splits up behind them | **Take the Blade:** two fallen sun blades; each carrier hits far harder for 12 s, walks slowly and draws its attacks; the party shields them, also through Hold Still | **The Ring of Hands:** the whole raid forms a ring round the Heart on forty gold spots (at least 32 held) while it beats; a full ring stuns it, a broken one costs everyone |

Rules: a failure costs the whole party; the numbers come from the players standing, not the band alone; in the last phase two of
them may overlap; each is announced by a name on the cast bar and a first-time hint. **The Sun Warden's three and the Heart of
Noon's three are built** (2026-11-12, both below); Ash and Ember's three are not. The three "any party" ones are all built.

## The room changes with the boss's phases (user, 2026-11-12)

> "also like we can make multyple areans for bos like when there will be secnd staged arena will transform fna also at final stage
> it can be like something just think of ideas and do them they coudl be engaging and hard and challenging to complete"

The user left the ideas to me and said to build them. Each boss's party room becomes three rooms in one: it transforms when the
second phase begins and again for the last. The transformation is itself a thing to survive, and the new room asks for a new way to
play. The rooms for one and two players stay as they are (those fights are measured); they can get lighter versions later.

| Boss | First phase | Second phase: the room transforms | Last phase: it transforms again |
|---|---|---|---|
| Sun Warden, the Hall of Noon | The cross-shaped hall, whole | **The hall breaks open.** The four great corner blocks of stone crack (a warning runs along their edges) and fall: the cross becomes one vast round court strewn with their rubble as new cover. The walls the party hid behind are gone; his rays now reach from one arm into the next | **The sun comes down.** Sunfire wells up from the Sun Well and spreads over the crossing and on outward, a ring that grows for the rest of the fight: the party is pushed out toward the four far ends, split into four, and he comes out to hunt each group in turn. The Hour Strikes now takes three of those four refuges away |
| Ash and Ember, the twin pit | Two halves, a wall of fire between | **The floor cracks into islands.** Lava channels open across both halves; narrow bridges of cooled crust join the islands and each stands only a while (it glows before it sinks). The teams cross from island to island as their own breaks up; Ash's Charge shatters a bridge | **The pit floods.** The wall of fire goes out and lava rises from the rim inward for good: both teams are driven onto one last island in the middle where the twins stand side by side, furious, and the two teams fight shoulder to shoulder at last |
| Heart of Noon, its party room | The cooled crust, whole | **The floor turns.** The room is three rings round the Heart: the inner stands, the middle turns one way, the outer the other, carrying whoever stands on them (being carried is not walking: Hold Still stays fair). The beams turn against them; a hero picks the ring that carries them away from a beam, or steps across at the right moment | **The crust falls.** After each Heartbeat one sector of the floor glows along its cracks and drops into the sun for good. The room shrinks sector by sector; plates and lock spots are lost with their sector. A fight that runs long ends on a floor too small to stand on |

How: a room's pieces that fall are their own objects in its Blender file; walls that go are obstacles removed; ground that burns or
is gone is a zone that stays (as the late sunfire is); a ring that turns carries heroes with the world's carry. Each screen works its
own hero out from the phase's cast, so two screens agree. Built per boss with its mechanics for 10, 20 and 40, once its files are
free. **The Sun Warden's two and the Heart's two are built** (2026-11-12, both below); Ash and Ember's are not.
## Twin Flames is built (2026-11-12)

How it works now: `docs/architecture/raid.md`, "Twin Flames". Pictures: `docs/bosses/twin-west.jpg`, `twin-east.jpg`,
`twin-furious.jpg`, `twin-furious-west.jpg`, `twin-together.jpg`, `twin-wall-out.jpg`, `twin-wall-out-west.jpg`, `twin-last-one.jpg`,
`twin-phone.jpg`.

**What was decided, where the brief left it open.**

- **Sides: the hub deals them.** The wall stands from the start, and the players present are dealt west, east, west... by seat as the
  fight loads. The simplest that can't leave a half empty; walking in and choosing in a few seconds could. So nobody picks a team yet:
  the order of the seats in the lobby does. A choice in the lobby would be the next step.
- **HP: the band's, split in two.** `raid_stage.hp` is still the band's HP for Ash and Ember (35,500 at band 10), and each of the two
  has half of it and half the gauge. A half of the party against a boss of half the size.
- **The stage: one each.** Each has its own Eruption at 50 % of its own HP, in its own half, with its own Coal Hearts. When they fall
  together both stages run at once, and each half has its own to do.
- **The vent: one each, the lava for all.** Each has its own vent in Together. The lava rises for the whole room once either is in
  Together, and sealing either vent holds it back for everyone, so one half can help the other.
- **Whole-floor moves stop at the wall,** on the floor and in the rules: the table in raid.md. Zones are drawn cut off at the wall.
- **When one falls,** the other is furious to its end, at the furious numbers (1.5 times, 0.6), not the enrage's. Killed together, that
  is a few seconds; killed far apart, it is a long fight against a furious one that was already furious for being behind.
- **Pillars:** four round Ash and one more for every three heroes of his half (band / 2): 5, 6, 7, 8, 9 and 11 for the bands 5 to 40.

**Numbers.** 12 points apart on, 6 off (`RAID_TWIN`). Furious: hits 1.5 times, the quiet between moves 0.6 (`FURY_HIT`, `FURY_GAP`).
The room 30 m. Drag Under's ring 4.5 to 14 m. Lava Wave 6.5 m/s over 33 m. Falling Star 45 % shared. Coal Hearts 6.5 m round each
one's place, each 3.5 % of one boss's HP (621 at band 10). The lava at 24, 20, 16 m.

**Measured** (six bots through the real hub, band 10, 17,750 HP each, no help; times on the fight's own clock): the two stayed
within 7 points for three minutes without anyone trying, so the rule only bites when the halves differ. Both at half HP after 1:30;
then each half needed close to the full 30 s for its Eruption (three heroes, three Coal Hearts of 621 HP). Ash down at 3:17, 27 s past
the 2:50 enrage, Ember at 16 %; five of six down three seconds later; the run was stopped at 4:02 with Ember at 10 %, not won. A half
takes 78 to 92 HP a second off its boss, 26 to 31 a bot. All screens agreed on both bars; no bot crossed the wall; no errors. Steered
by the tool (one half helped ahead): Ember furious at 13 points, calm again at 3, Ash down, the wall out, everyone on Ember, won.

**Not done or not checked.** Played by people. More than six screens. A player leaving in a twin fight was checked on the hub only
(the brain goes to the same half; an empty half has none), not in the browser. A higher tier (its extras go to whose they are: Ash
gets Cinder Rock). The room is a first pass in code: a Blender room is to come, with `TWIN_LAYOUT` as its plan. Choosing a side.
The party's list does not say who is in which half. `docs/architecture/multiplayer.md` does not have the new messages (raid.md does).

## The Warden's hall transforms, and his three party mechanics are built (2026-11-12)

How it works now: `docs/architecture/raid.md`, "The hall transforms, and what comes only for a big party". The code is
`src/raid/wardenHall.ts`, with the room's shape in `src/arenas/sunhall.ts` and its pieces in `blender/arenas/real/sunhall.py`.
Pictures: `docs/raid/warden-*.jpg` (fourteen; `pipeline/tools/warden-shots.js`).

**What was decided, where the brief left it open.**

- **How far the hall opens.** To a circle through the transepts' far corners, 36.4 m from the Sun Well. The transepts lie wholly in
  it; the last 10 m of the nave and 6 m of the choir stay beyond it as two short arms. A court out to the game's ring (46 m) would
  have left the transepts' end walls standing in the middle of the floor.
- **Hit, not pushed.** Whoever stands within 4 m of a wall as it goes takes 30 %. Nobody is pushed: the rubble lies where the
  blocks stood, and nobody stood there.
- **The rubble and the court's wall are there from the start,** inside the stone, not added when the blocks fall. Nothing can
  reach them until the walls go, so it is the same to the game, with nothing to add at one moment on every screen. `addStone` was
  the other way: it is timed, makes round stones only, and his ray breaks its stones for a reward.
- **The fall is not the phase's opener.** That slot is his stage, whose cast ends early when its stones are broken. It comes by
  the phase's clock at the same moment, so the hall breaks while the party breaks his hour stones: the two overlap on purpose.
- **The sunfire: 6 m to 24 m in two and a half minutes, 6 % a second.** A party has minutes. At the end a ring 12 m wide is left
  inside the court's wall, with the rubble in it, and the two short arms. He walks faster in it and comes closer, and hunts one
  quarter at a time for 14 s.
- **The Sun Well's objectives move out with the fire.** A shard is home at the fire's edge, not at the well; Gathering Noon's
  shards and Anchors' circles fall past it.
- **What closes in after five minutes** comes from the walls in the hall, not from the middle: the middle is burning already.
- **His great mechanics take turns, with 16 s between.** The first try had Carry the Sun, the hour and Carry the Sun again back to
  back for two minutes. Now: the hour, Carry the Sun, the hour, The Four Hours, each after a breath. Branded has a clock of its
  own (28 s) and may come during any of them in his last phase only.
- **Branded costs the party when it bursts in a crowd:** two or more others caught, and everyone pays 6 % for each (24 % at most).
  Caught alone with the branded hero, a hero pays only its own 30 %.
- **Carry the Sun replaces Gathering Noon** for 20 or more, opener and all, instead of standing beside it: both end in a Noon.
- **A hero can stand in the ray's way.** The design's "the rest block his ray" had nothing a hero could do but bait a stone. Now
  the brain looks for a hero between him and the carrier, and the ray ends on that hero.
- **The Four Hours asks by the heroes standing,** not by the band: with twenty left each arm asks half.

**Numbers.** In the tables of raid.md. In short: the fall 6 s after the warning; Branded one in eight, 5 s, 5 m, 30 % and 8 %; Carry
the Sun a shard for five, 36 s, 12 % and 56 % over the shards missing; The Four Hours 38 s, 18 % an arm, a quarter of the gauge an
arm.

**What differs from the brief, and why.**

- **Carriers can cast.** "Slow and unable to cast" needs the hero's own code: the raid's files can slow this screen's hero
  (`BossWorld.heavy`) but nothing in them can stop its spells. Needs `src/duel.ts` (below).
- **No list field on `BossCast`.** The hub drops any field it does not know, and `server/hub.mjs` was not mine to edit. The
  branded heroes go one to a cast in `target`, the counts in `x`. It works with the hub as it is.
- **The court is not the whole ring.** See the first decision.

**Needs an engine file** (not edited: others are their writers):

- `src/duel.ts` (and `src/heroMode.ts`): a `BossWorld.mute(on)` that stops this screen's hero from casting, for a shard's carrier.
- `src/duel.ts`: `removeCover(i)` takes a fixed wall out when asked, and the hall's opening relies on that
  (`PlayContext.breakCover`). An earlier note here asked for it to refuse fixed walls: if that is done, the hall needs a way of
  its own to open (a row of `_raidCheck` fails if the walls still stand).
- `server/hub.mjs`: nothing. `server/protocol.mjs` has five new rewards (`carry`, `foura` to `fourd`) and `PROTOCOL` must be
  raised before a deploy: the hall's shape and these moves are rules two screens must agree on.

## The Sunburst transforms, and the Heart's three party mechanics are built (2026-11-12)

How it works now: `docs/architecture/raid.md`, "The Sunburst transforms, and what comes only for a big party". The code is in
`src/raid/heart.ts` (the moves), `src/arenas/sunburst.ts` (the room's state and how it is drawn), `src/raid/bodies/heart.ts` (the
blades). Pictures: `docs/raid/heart-*.jpg` (thirteen; `python pipeline/tools/heart-phase-shots.py docs/raid`).

**What was decided, where the brief left it open.**

- **Which rings.** The seams lie on joints the floor's drawing already had: 6.9 m, 12 m and the well's rim at 18 m. So the inner
  ring, where melee heroes fight, stands; whoever fights from range is carried.
- **How fast: 9 and 6 degrees a second.** 1.5 m/s at the middle of each ring: a hero (3.5 m/s) can always walk against its ring,
  but can't ignore it. The middle ring goes round in 40 s, the outer in 60 s.
- **What rides, and what stands outside.** Nothing has to ride. The lock rows and the fallen armillary's pieces were out in the
  rays already; Take the Blade and The Ring of Hands were put on the inner ring; and a plate that falls while the floor still
  turns (only a higher tier's Heartbeat in the second phase) falls on the inner ring, with its pocket. Moving a piece of cover
  every frame would have asked the walk planner and the sight lines to follow it.
- **The rings stop in the last phase.** A sector that falls is a place in the room; a ring that turned over it would carry its
  drawing into the hole. So the three rooms are: whole, turning, falling. Each ring stops on an eighth of a turn, so the burnt
  streaks on its drawing point down the rays again.
- **The Heartbeat waits for the rings to rest.** The first try let it come at once, with its plates on the inner ring (where the
  Blade Sweep reaches a hero behind its plate), and gave even one hero two plates to raise: the Heartbeat killed the autopilot in
  21 of 40 fights, and it won 1. Now its first beat comes 17 to 22 s into the last phase, and five heroes or fewer have one plate.
- **A sector is a ray with its slice of the well,** not a plain eighth of the room: a wedge 15.5 degrees to each side of the ray's
  line, and the whole bay. What two sectors leave between them is a spoke of crust from the inner ring to a spur's nose, and
  that is where the plates fall. So the brief's "its plates with it" is not so: a plate's place never falls. With whole eighths, four
  sectors gone would have left no plate to hide behind, and the fight would end by the next beat however well it was played.
- **Burning ground, not a push.** 40 % for standing on it as it goes, 25 % a second after. A push would have needed walls round a
  pit; a hero knocked into one by the Blade Sweep can walk out.
- **The north ray never falls** (the way out is at its end), and six sectors at most. When the fight ends what fell crusts over.
- **The brain names the sector,** from the Heartbeat's seed and what it sees standing. The other way, each screen working it out
  from the seed and its own memory of what fell, breaks when a screen misses one cast.
- **Shade the Heart together: a plate left lying costs everyone 8 %,** sheltered or not, 32 % at most. That is the "failure costs
  the whole party" for a mechanic whose other cost falls only on whoever stood in the open. The plates are one for every five
  heroes standing, so a raid that has lost ten heroes has two plates fewer to raise.
- **Take the Blade: the blades are out of its hands, so it does nothing that needs them.** No Blade Sweep, no Blade Fall and no
  Heartbeat for 30 s. In their place it throws a lance of light at a carrier every 3.5 s, and that is what the party shields:
  the first hero in the lance's line takes it, for 15 % instead of the carrier's 35 %.
- **A lance that reaches a carrier knocks the blade loose.** Without that, standing in the lance would only save a friend some HP.
  The blade lies where the lance was aimed (a spot every screen has from the cast), so nobody sees it somewhere else.
- **A blade burns 12 s in all,** shared by whoever carries it, and changes hands four times at most.
- **Hits twice as hard,** not more: the hub cuts any one message of a screen's hits at 600 HP.
- **The Ring of Hands: one spot each, by holding it a second,** and the ring holds the moment four in five are held. Counting who
  stands in a zone when it lands could not tell two heroes on one spot from two spots.
- **It adds no beats of its own.** Hold Still comes by the clock every 20 s and lasts about 10, so one of its runs always falls into
  the ring's 16 s.
- **The two great ones take turns, 14 s apart,** the first 9 s after the floor begins to turn (the Warden's way).

**Numbers.** In the tables of raid.md. In short: the floor warns 5 s, then 9 and 6 degrees a second; a sector glows 9 s; a plate
left lying 8 %; a blade doubles hits for 12 s, a lance every 3.5 s for 35 % or 15 %; the ring 16 s, four in five, 45 % if broken.

**Measured.**

- **The autopilot alone, by band** (`pipeline/tools/heart-party-run.js`; one hero with one hero's HP, ten heroes x 2 fights: Lyra,
  Bram, Kaia, Sefu, Brannoc, Isolde, Vesper, Nyx, Cantor, Marin). No errors and no fight that never ended in any of the 80.

  | Band | Clears | Seconds a fight | Reached the last phase | The floor turned | Seconds carried by a ring, a fight | Sectors fallen, a fight | Seconds over the sun, a fight |
  |---|---|---|---|---|---|---|---|
| 5 | 4 of 20 | 112 | 15 of 20 | 20 of 20 | 21 | 0.3 | 0 |
  | 10 | 6 of 20 | 121 | 15 of 20 | 20 of 20 | 18.2 | 0.5 | 0.06 |
  | 20 | 10 of 20 | 115 | 19 of 20 | 20 of 20 | 17.4 | 0.1 | 0 |
  | 40 | 6 of 20 | 112 | 18 of 20 | 20 of 20 | 16.8 | 0.2 | 0 |

  At 20 the lone hero wins more because it takes a blade and hits twice as hard for 12 s of every 44. At 40 its ring is one spot
  of one: a second run of the same 20 fights cleared 9. The first build of the ring cleared 6 and broke 7 rings of 9, because the
  autopilot stops walking 0.7 to 0.8 m from where it is going and a spot was 0.7 m wide: a hero now holds a spot from 0.95 m of
  its middle (a tap ends short of its mark as well), and the ring broke 1 time in 8 and 3 in 9.
- **Band 10, 40 fights** (the same ten x 4, to set against the Sunburst before: 14 of 40, 119 s): 9 of 40, 119 s. The beams hit it
  165 times (151 before), the flare 40 (57); the Heartbeat killed 11 (8 before), the beams 10 (10). 31 of 40 reached the last phase.
  It leaves a sector that glows: 0 s over the sun. So the floor's changes cost the autopilot about a third of its wins, as far as
  one run of 40 can say (the two older runs differed by 4).
- **Six bots through the real hub, twice** (`python pipeline/tools/party-raid.py <out> --players 6 --seconds 250 --port 5209 --boss
  heart --boost 60 --burst`; band 10, 35,500 HP, the boost off once The Rings Turn began). On all six screens: the floor turned, the
  same way; the rings rested at the same angles (11.781 and -7.854 radians on every screen, both runs); every screen saw the
  same casts, Hold Still's of the second and last phase among them. Sectors fell on six of six screens, 4 to 341 ms apart (six
  sectors in the two runs). Nobody stood over the sun. No errors. A hero as another screen draws it against where its own screen
  has it: 0.32 m at the median while the floor turns, 0.35 m while it stands (the walk's own lag), nine in ten under 0.7 m.
- **The floors' clocks.** In the first run the six floors were 2.1 s apart (3.5 m on the outer ring): the game's own time, which a
  cast's clock counts in, falls behind on a screen that draws slowly, and six pages on one computer draw slowly. The floor now
  counts by the computer's clock from the moment its cast came. Second run: 0.2 s apart at the median, 0.4 s at most.
- `_raidHeart()`: 242 rows (the 128 as they were but three, below; 114 new). `_raidCheck()` 234, `_raidAsh()` 77, `_raidTwin()` 72,
  `_raidUpgrades()` 40. Type check, build, `npm run test:server`.
- **Two things seen in the tools, neither from this work.** `_raidCheck()` run in the same page after `_raidHeart()` fails one row
  ("sunfire: the autopilot keeps out of it as it grows"); alone, or after `_raidAsh()`, it passes. It does the same on the commit
  this branch started from (`4e60c65`). And one of the nine autopilot runs logged a burst of shader errors on every kind of
  material at once as its first fight began (the headless browser lost its drawing context); its fights ran on, and the same run
  again had none.

**What differs from the brief, and why.**

- **"Its plates with it".** A plate's place never falls (above).
- **"Walks slowly".** A carrier walks at 85 %, and at full speed with Sure Feet: the only slow the raid's files can lay on this
  screen's hero is a sun shard's (`BossWorld.heavy`). Needs `src/duel.ts` (below).
- **"Raise plates" against the lance.** A raised plate stops a lance, but there is none while the blades are out: the Heartbeat
  waits. The fallen armillary's pieces stop it too.
- **Three of the 128 old rows were changed,** not only added to: at 10 or more a plate left lying now costs everyone, so the row
  that stands behind one raised plate of two has the second raised by a partner, and the two rows that stand in the open with both
  left lying expect 56 % instead of 40 %.
- **A bug found on the way, and fixed.** Hold Still in the Heart's second and last phase never reached the other screens online:
  its moves were named `still2` and `still3`, and the hub passes on a cast only when its move's name is letters. They are `stillb`
  and `stillc`. It was so in the room for two as well: the second player was never burnt for walking in those two phases.

**Needs an engine file** (not edited: others are their writers).

- `src/duel.ts`: a slow of its own for a blade's carrier (`heavy` takes no amount), and a fallen hero carried with its ring.
- `server/hub.mjs`: nothing. A cap of 600 HP a message on a screen's hits is why a blade doubles and does no more.
- `server/protocol.mjs` has one new reward (`hands`), and `PROTOCOL` must be raised before a deploy: the room's rules changed, and
  an old tab would not turn its floor.

**Not done or not checked.**

- Take the Blade and The Ring of Hands through the real hub: six bots are a fight tuned for ten, so neither was cast there. Both
  are checked on one screen, with the hub's answers fed in by hand.
- A person playing any of it. A real phone (two pictures at 390 x 844 only).
- More than six screens. A player leaving while carrying a blade (the blade goes back when its 30 s end).
- Tiers above 1. At tier 4 and up the Heartbeat comes in the second phase, on the turning floor, with its plates on the inner
  ring: built and checked by a row, not played.
- The numbers are first values.

## State (2026-11-11)

- Not started in code. The Heart of Noon is being built by a helper in its own worktree (its `PROTOCOL` 6 -> 7 is only there; main
  carries omens and side doors at 6, so one bump must be on main before any deploy).
- The friend brackets' server half was moved out of the working tree into `git stash` ("friend brackets: server half"), so the hub
  can be rebuilt for parties. Popping it later will conflict with the party hub.
- Not verified yet: the side doors for two were run only on the server; the Shrine's room was not looked at in the browser.
