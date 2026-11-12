---
title: The Heart of Noon, the Raid's third boss
tags: [raid, boss, design]
updated: 2026-11-12
---

# The Heart of Noon

Asked for (user, 2026-11-11, "evolve the raid", option C of `pipeline/designs/raid-next.html`): a third boss, so a tier ends in a
place of its own instead of only looping. **The look is shown first and waits for the user's nod** (the lesson of the arenas):
`docs/bosses/heart_sheet.jpg`, built by `build_heart()` in `blender/bosses/boss_bodies.py`.

## What it is

The fallen sun itself, under the hall. The Warden keeps the court above it, Ash and Ember the pit beside it; the Heart is what both
of them guard. A molten heart in a cracked crust of basalt plates, a calm gold face set in the front of it (looking a little up, to
the camera), a broken armillary of three gold rings round it, a crown of rays behind it (most of them snapped), and two great sun
blades floating beside it for hands. About 6.4 m high; 8,846 triangles.

| Part | What the game does with it |
|---|---|
| `core` | The heart and its crust. Seams brighten each phase; plates fall away in the last |
| `mask` | The face. Its eyes flare before its gaze; it tilts to whom it looks at |
| `ringA`, `ringB`, `ringC` | Turn slowly round it; in the second phase they come down as beams over the floor |
| `crown` | Turns a little; flares with Solar Flare |
| `bladeL`, `bladeR` | Its hands: they sweep and fall, as the Warden's fists do |
| `shards` | Float round its foot |

## The fight (as designed; built 2026-11-11, below)

The room: the Sunken Heart, round, radius 12, a floor of cooled gold crust with molten rivers in its cracks. Its gate stands at the
north centre of the hall, behind the broken ray, between the two others (the hall's west and east edges stay free for side doors). A
run becomes Warden, Ash and Ember, then the Heart; beat it and the tier is cleared.

| Phase | Its moves | What players do |
|---|---|---|
| Embers Wake (100 to 66 %) | Blade Sweep (an arc in front), Blade Fall (two lines on a hero), Solar Flare (rings of fire running out from it, each with a gap to walk through) | Walk through the gaps |
| The Rings Turn (66 to 33 %) | The three rings come down as beams that turn over the floor | **Lock a ring:** three gold spots on the rim; hold one 2 s and that ring stops for 8 s; +40 on the gauge |
| Noon Falls (33 to 0 %) | All of them, and Heartbeat: every 20 s a pulse over the whole floor | **Shade the heart:** crust plates fall as gold spots; hold one 3 s and it stands up as cover; only cover between you and the heart saves you from Heartbeat |

Every mechanic works alone and for two. The rules of `docs/architecture/raid.md` hold: a move never reads a hero's position, each
step is its own cast, each screen decides the hits on its own hero.

## What was built (2026-11-11)

The look was agreed; the fight is in. How it works now: [docs/architecture/raid.md](../../docs/architecture/raid.md), "The Heart of
Noon". Pictures from the game's camera: `docs/bosses/heart-fight-room.jpg`, `-flare`, `-rings`, `-plates`, `-blades`, `-phone`, and the
hall's new gate `docs/bosses/heart-hall-gate.jpg`.

| Piece | Where |
|---|---|
| The boss: numbers, phases, moves | `src/raid/heart.ts`; numbers the hub keeps in `RAID_BOSSES.heart`, its reward in `RAID_REWARDS.heart` (`server/protocol.mjs`) |
| Its body, posed in code | `src/raid/bodies/heart.ts` (`heartLook`, `HEART_LIVE`) on `public/models/bosses/heart.glb` |
| Its room | `src/arenas/sunkenHeart.ts` |
| The run, the hall's gate | `RAID_RUN = ['sun', 'ash', 'heart']`, `PROTOCOL` 7; `HALL_GATES.heart` (`src/arenas/noonfall.ts`), the hall draws a gate for each boss of the run |
| Its check | `_raidHeart()` in `pipeline/tools/raid-check.js`: 38 rows then, 71 with Hold Still |

**Numbers.** Alone 3,300 HP, for two 7,100; phases at 66 % and 33 %; gauge 100, kneel 6 s; enrage 2:45. Blade Sweep 18 % (6.8 m,
130°, within 8.5 m), Blade Fall 15 % a line, Solar Flare 12 % a ring, a beam 10 % a second, the Heartbeat 40 % every 20 s, the Crown of
Rays 15 %. Tier extras: the Crown of Rays, then the rings, then the Heartbeat, from the first phase on.

**Changed from the design while building:**
- **Solar Flare's gaps.** Each gap somewhere else could not be reached: from the far side half the room lies between you and it before
  the first ring arrives. Now each ring has two gold gaps opposite each other, the first 20 to 45° to one side of the hero it aims at
  (the brain's aim), each pair 12 to 20° on from the last: two lanes that drift.
- **A fourth move, the Crown of Rays,** for the last phase and the tiers: four rays, then the four between them.
- **A lock puts its beam out** for 8 s and warns 0.8 s before it burns again, rather than holding the beam still: two screens hear
  the lock a moment apart, and a beam's angle stays a pure function of the time since its cast.
- **The plates fall as part of the Heartbeat's look,** not off the model: the crust is one mesh. A raised plate is cover on both
  screens (`addStone`) until the same moment after the cast.
- **The gold of the face, crown, rings and blades is less polished in the game** (roughness 0.58, set in code): under the game's sun the
  face, tilted up to the camera, bloomed white. The face itself is duller still and a shade darker, its eyes lit on their own. Its glow
  is kept low as the other bosses' are. The Blender file is unchanged. The sheet's face beside the game's: `docs/bosses/heart-face-compare.jpg`.
- **Its room's gates stand out in the lava** (`BossDef.gates.r`, 16.2 m): at the edge of so small a floor the way in stood over the
  bottom of the screen.

**Measured** (the autopilot alone, tier 1, `pipeline/tools/raid-tool.js`, the same ten heroes, 4 fights each, 2026-11-11): the Heart
14 of 40 (35 %, 98 s a fight on average), Ash and Ember 11 of 40 (28 %). An earlier run of 2 each: the Warden 10 of 20, Ash and Ember
4 of 20. Inside the noise of 40 fights, so the HP was left at Ash and Ember's. What hit the autopilot most at the Heart: the beams (114
hits in 40 fights), Solar Flare (85), Blade Sweep (36); what killed it: the Heartbeat (9), the beams (8), Blade Sweep (5). The
autopilot finds a flare's lane but drifts out of its edge as it goes back to fighting, so Solar Flare costs it more than it should
cost a person. No errors.

## Hold Still, its own mechanic (2026-11-11)

Picked by the user from `pipeline/designs/raid-mechanics.html` (card H1; `raid-party.md`, "Unique mechanics, one per boss"): **"The
heart beats in a slow rhythm you can see on the floor. On the beat, stand still: anyone moving is burnt. Between beats, run. The
rhythm speeds up as it dies."** How it works now: `docs/architecture/raid.md`, "The Heart of Noon". Pictures from the game:
`docs/bosses/heart-holdstill-announce.jpg` (the light running in), `-now` (the floor turns white: stop), `-still` (the beat passes a
hero that stood), `-strike` (it burns one that walked), `-rings` (with the beams and a gold spot), `-phone` and `-phone-strike`
(390 x 844); retaken by `python pipeline/tools/heart-holdstill-shots.py docs/bosses`.

| What | Number |
|---|---|
| A run | 3 s of warning, then 3 beats 2.6 s apart (Embers Wake), 4 at 2.1 s (The Rings Turn), 5 at 1.6 s (Noon Falls) |
| When | By the clock: 9 s into the first phase and every 21 s; 11 s into the second and 13 s into the third, then every 20 s |
| A beat | 12 % of max HP, only for a hero that went more than 0.25 m by its own walk or dash in the 0.25 s before |
| The cue | White lines run in along the floor's joints and land on the beat; the joints turn white 0.45 s before it; a ring closes at your feet |

**Decided while building:**
- **By the clock, not a move in its lists.** The card says "hard to do while dodging", so it has to run over its other moves. A move
  in the lists would hold the Heart for the whole run (`lock`), and with nothing else going on a hero would simply stand and cast
  through it. By the clock (`BossPhase.timed`) every phase has it for sure, and it takes neither the cast bar (the Heartbeat's 10 s
  bar stays) nor the Heart's turn.
- **A third colour, white.** Orange says leave and gold says stand here; "don't move, wherever you are" is neither. Fine white lines,
  never a filled zone: the first try, broad bright rings, buried the floor and everything on it.
- **A ring at your own feet.** A phone held upright can't always see the heart; the beat must read where the eyes are.
- **Forgiving by a little.** The floor turns white 0.2 s before the moment that counts, and a last 0.25 m of a step is let pass, so
  stopping when you see white is in time.
- **What moves a hero that isn't a walk:** a blow's knock, a pull, a carry, a plate raised under it. None counts.
- **The overlaps** were looked at one by one (the list in `raid.md`); nothing had to be moved except the first run of each later
  phase, which waits until the last phase's run has ended, and the third phase's clock, set between two Heartbeats.

**Measured** (the autopilot alone, tier 1, ten heroes x 4 fights a run: Lyra, Bram, Kaia, Sefu, Brannoc, Isolde, Vesper, Nyx, Cantor,
Marin; not the same ten as above, whose names were not kept). Before: 11 and 9 of 40 (20 of 80, 106 s a fight). After: 8 and 12 of
40 (20 of 80, 106 s). No change, so the beat's cost stayed at its first number and the HP was not touched. **The 12 % is therefore
a designer's number, not a measured one:** the autopilot stood for 227 of 227 beats in 12 fights and no fight ended on a beat, so the
tool can't say what a beat costs a person. What the autopilot pays is small and indirect (a blade it could not step out of in that
moment). Tier 3: 0 of 20 with it, 2 of 20 without; tier 5: 0 of 20 with it, 1 of 20 without: the autopilot without upgrades loses
there anyway. Ash and Ember as a control, same ten: 9 of 40. No errors in any run. `_raidHeart()`: 71 rows pass, `_raidCheck()` 95,
`_raidAsh()` 77, `_raidUpgrades()` 40.

**A fault found on the way:** the brain's clock for a move that comes by the clock started at zero in the first phase (only a later
phase set its `first`), so the first run came as the fight began. One line in `BossBrain`'s constructor; `_raidHeart()` now runs the
clock live and checks the 9 s and the 21 s. Ash and Ember's vent, the only earlier such move, is in their fourth phase and never saw it.

**Not done for Hold Still:** a person playing it, on a desktop or a phone, so the feel of the 0.25 s and the look of the lines are
unjudged by hand; a raid for two or a party (each screen judges its own hero, by the same code as alone); a sound for the beat.

**Not done:** a raid for two in two tabs (`_raidHeart()` checks a partner's lock and plate on this screen); a person playing it; a real
phone. The artist has not yet directed the room (first pass, drawn in code).

## A room and a fight for a party: the Sunburst (2026-11-12)

Asked for (user, 2026-11-11): "make the boss room bigger much bigger so that the 40 player will be lost there", "make like custom arena
in blender ... for the boss it dont need to follow the others arenas", "what if the arena have not like round arena lets just forget all
and lets make boss room". The Warden got the Hall of Noon; this is the Heart's. The room and why it is a sun:
`pipeline/designs/raid-party.md`. How the fight works in it: `docs/architecture/raid.md`, "A party: the Sunburst". One or two heroes keep
the Sunken Heart and the fight above, unchanged (`_raidHeart()`'s first 71 rows).

| Piece | Where |
|---|---|
| The room, built | `blender/arenas/real/sunburst.py` -> `public/models/arenas/sunburst.glb`, `src/arenas/real/sunburst.json` |
| The room in the game: floor, lanterns, far wall, its measures | `src/arenas/sunburst.ts` (`BURST`, `burstAt`, `rayAngle`, `spurAngle`) |
| Which room, and what a party must do | `HEART_OF_NOON.resize(band)`, `party` and `band` in `src/raid/heart.ts`; `partyRing: 35` in `server/protocol.mjs` |
| A shelter that holds five; an AI's margin in a lane | `Threat.most`, `Threat.margin` (`src/raid/types.ts`, `src/raid/script.ts`) |
| Its check | `_raidHeart()`: 57 more rows, 128 in all |
| Its pictures | `python pipeline/tools/heart-room-shots.py docs/raid` -> `docs/raid/heartroom-*.jpg` |

**Decided while building:**
- **A sun, eight rays.** Its attacks are all radial, so a shape whose every bay is a radius lets each of them run to a wall and gives
  no free shelter from the beat. Eight because its fight is eights: 4 + 4 rays of the crown, up to 8 plates.
- **The plates fall at the spurs' noses, and shelter by count.** One plate for five heroes means nothing if forty can stand behind one:
  heroes do not push each other. So a raised plate's pocket (from the plate out to the stone, about 15 m²) is a gold zone the hub
  counts, as it counts Shared Burden: five are sheltered, and with more in it each pays its share of what the rest would have taken
  (8 in one pocket: 15 % each instead of 40 %). While the beat's orange floor shows, a pocket with more than five in it says how many
  over its plate ("7/5"), from where the heroes are drawn on that screen. The first plate falls at the spur nearest the hero the Heart
  looks at.
- **A ring's spots stand in a row down one ray, all to be held.** The party rule is that what must be held grows with the band. Spread
  over many rays, a party that has lost heroes could never lock a ring; in one row, one hero can still take them one after another
  (four spots: about 11 s of the 14 the spots show).
- **Solar Flare, three tries.** (1) Each ring open over one half of every ray, the next ring over the other half: nowhere is clear for
  the whole flare, and the autopilot, which looks for such a place, cleared 2 of 20. (2) A gap in every ray, drifting: a lane is 1 m
  wide where the party stands to hit the Heart; 1 and 2 of 40. (3) Four gaps over four spurs, the same for all three rings, each
  reaching over the near half of the ray on either side: lanes 4.4 m wide at the Heart, and in every bay one half open. Kept.
- **Cover stops what runs along the floor, not the beat.** Far out in a bay a beam's end moves at up to 13 m/s (a hero walks 4), so
  a bay needs a place to stand: a piece of the fallen armillary across half of each. It stops a beam and the flare's rings (and so does
  a raised plate: without that, half the pockets lay in the flare's fire and the Heartbeat killed the autopilot most). If the pieces
  also shaded the beat, eight of them would give a party eight beats with no plate raised, so the beat comes from above.
- **The band, not the heroes standing.** The brain knows how many stand, but the hub's relay of a cast passes only the fields it knows.
  The band is known to every screen before the fight; a count needs one more field in `server/hub.mjs` (`case 'boss_cast'`).

**Measured** (the autopilot alone, tier 1, the same ten heroes x 4 fights, one session, 2026-11-12; in the Sunburst one hero meets the
mechanics of band 10: two plates, one spot a ring): the Sunken Heart 10 of 40 (99 s a fight), the Sunburst 14 of 40 (119 s; the walk in
from the gate is 7 s of it). Inside the noise of 40 fights, so no number of the fight was changed for the room. On the way: 1 and 2 of
40 with a gap in every ray; 7 of 40 with four lanes; 7 of 40 with the AI's margin (the flare's hits fell from 174 to 57 in 40 fights, but
the Heartbeat then killed 10: a pocket under the flare's fire); 14 of 40 once cover stopped the flare. What hits it most in the Sunburst:
the beams (151 in 40 fights), the flare (57), Blade Fall (38); what kills it: the beams (10), the Heartbeat (8). No errors in any run.
From the end of a ray the autopilot finds its way to a spot in another ray (7 of 8 starts locked a ring within 14 s; the eighth was
still walking). `_raidHeart()` 128 rows pass, and after the two small additions to the script the other bosses' checks as before
(`_raidCheck()` 95, `_raidAsh()` 77, `_raidUpgrades()` 40); type check, build and `npm run test:server` pass.

**What the 14 of 40 is, and is not.** One hero, with one hero's HP, against the mechanics of band 10, one run of 40 fights, with a
margin added for the autopilot in the flare's lanes. It says the room and its moves can be read and walked by the autopilot about as
well as the room for two. It says nothing of a party: a pocket's count, a row held by several heroes and the hub's part in both were
run on one screen only, with the other players' reports fed in by hand.

**Not done:** a party of real screens through the hub in this room (the partner's side of every row is a report fed in by hand); a
person playing it; a real phone; tiers above 1; the molten floor past five minutes was not looked at in this room; the numbers of the
fight (HP, shares, the enrage) are the room for two's times the band, untouched; no sound; `PROTOCOL` needs a new number when it goes
out; it is not on the News page (the party raid and the Hall of Noon are not there yet either). The hub's limit of 400 spots and
rewards a fight (`TAKEN_MAX`) is near for a band of 40 at tier 4 and up: about 340 in six minutes (`docs/architecture/raid.md`). The
room is first pass for the artist to direct.

