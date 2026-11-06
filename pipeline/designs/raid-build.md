# Raid: how it gets built

The plan for building steps 3, 4 and 5 of [duels-and-raid.md](duels-and-raid.md). That file says what the Raid is. This
one says in what order it gets built, the rules the code keeps so co-op stays possible, and how each slice is checked.
Written 2026-11-06, after reading `src/duel.ts`, `src/arena.ts`, `src/arenas/hazards/`, `src/game/match.ts` and
`server/hub.mjs`.

**As built, 2026-11-06:** slices 1 to 4 are done, plus the Sun Court the user asked for on the way. Slice 5 is not started. How it
all works now: [docs/architecture/raid.md](../../docs/architecture/raid.md). This file stays as the plan it was built from.

## The rules the code keeps

These four are what stops step 4 from being a rewrite of step 3.

1. **A move never reads a hero's position.** Only the brain does. It puts the result in a cast: a plain JSON object
   (`BossCast { id, move, step, x, z, dir, seed, target }`). The script plays casts and nothing else. Alone, the local
   link hands a cast straight back to the script. In co-op the same object goes through the hub to the other screen.
2. **A move with later steps sends each step as its own cast.** Pillar Fall is three casts 0.7 s apart, each at the
   spot the target stood at that moment. A step therefore can't drift between screens, however late the other hero's
   position arrives.
3. **Each screen decides hits on its own hero only.** The script tests the zones against this screen's hero, and walking
   out is a real dodge, as in a duel. The partner's figure is never tested.
4. **Everything both screens must agree on goes through the link:** the boss's HP, its phase, the stagger gauge, kneeling,
   who is down, how the run ended. Offline the local link decides these on the spot; online the hub does.

## Changes from the design

| Design said | Built instead | Why |
|---|---|---|
| `BossScript extends ArenaHazard` | A class of its own, with the same `danger`, `active` and `eventId`, so the CPU code reads either | `ArenaHazard` runs one event at a time, in one colour, on a fixed schedule, with one lockout, all private. Walking Sun runs alongside other moves, and gold and orange zones show together |
| A room can start with one player on the server | **Alone is always offline.** Only two-player raids reach the hub | Every relay case in the hub says `players[1 - c.side]`. With always two seats, the only guard needed is for someone who left. A one-seat room adds a class of bugs and gives nothing |
| Stats for a solo run on the account | Not in the first version | Follows from the line above. Can be sent at the end of a run later |
| The Sun Warden in the Night Temple | **His own room, the Sun Court** (user, 2026-11-06: "different dedicated arena for the raid") | A wider court with cover laid out for his moves. Ash and Ember get their own when they are built |
| `boss_hit` with caps on the hub | **Each client owns its hero's HP** and reports it (`raid_hp`) | A cheat there only helps both players. The boss's HP stays on the hub with caps, because both add to it |
| Shared Burden's circle follows the target | **It stays where the target stood** | Nobody needs the other hero's exact position to draw it. If nobody stands in it, everyone pays in full |

Also new: a **`?raid` switch**. The Raid's button only shows at `/game?raid` until steps 3 and 4 are both done. So the
finished arena work can still be pushed and deployed at any time, and nothing of the Raid shows to players, which is
the design's rule. Whether it comes off after step 4 or waits for the run around the bosses is the user's call.

## Small hooks outside `src/raid/`

Four small gates in `src/arena.ts`, so nothing else has to know about bosses:

| Hook | Does | Needed for |
|---|---|---|
| `pinned: Enemy` | Knockback, pull, carry and dashes don't move this figure. Its own walk does | "Not moved" |
| `statusGate(target, kind, seconds)` | Decides a status before it lands | Stagger instead of stun, root, charm, silence, knock-up and sealed; slow at half length |
| `foeFloor` | Local HP can't go below this | Online only the hub kills a boss. A screen stops at 1 and waits |
| `onFoeDamage(target, dealt)` | Reports what really came off HP, after shields | `boss_damage` online, and the raid tool's damage count |

And in `src/duel.ts`, kept short because the file is already long:

- `startBoss(def, seed, link)`, next to `start` and `startNet`, on the vs-CPU path as the design says.
- A boss branch in `update`, where `this.ai` is called.
- The CPU's walk-out code reads the boss script when there is one.
- The HUD shows you and your partner in place of the two duelists. The plate over the boss's head goes.
- A hazard or zone never hurts the boss itself.

`HeroFigure` gains `setScale`: today nothing scales a model.

## Slices

Each slice ends in a commit. Nothing is pushed or deployed without a request.

### Slice 1: the empty fight

The boss stands in the temple on a loading page, a countdown, a HUD and a result card, and can be killed. It has one
move, Stone Sweep, so the whole path from brain to cast to script to hit runs from the start.

- `src/raid/types.ts`, `boss.ts` (placeholder model and `BossDef`), `brain.ts`, `script.ts`, `link.ts` (local), `hud.ts`,
  `run.ts`, `sunWarden.ts`.
- Screen: **Raid**, from the Play card and the login screen, behind `?raid`. Pick a hero, Start.
- Boss rules: not moved, stagger, kneel, exposed.

**Check:** a hero kills it and it kills a hero, by real clicks in the game page. Knockback, pull, stun and root don't
hold it, and they fill the gauge. A full gauge makes it kneel, taking +50 %. No errors. At phone size the HUD fits.

### Slice 2: the Sun Warden

All of phase 1, 2 and 3, with the alone versions, the phase pause and banner, and a first pass of the looks in code.

| Phase | Moves |
|---|---|
| Awake | Stone Sweep, Pillar Fall, Sun Ray |
| High Noon | Noon, Sun Order (Shared Burden only in co-op) |
| Last Light | Eclipse, Anchors, Walking Sun |

Noon's safe spots are the shadows behind cover seen from the boss, drawn in gold, because gold means stand here. Past
5 minutes the temple's sunfire closes in; past 6, Last stand: nobody can stall a fight for ever.

Pale orange and gold are close colours, which the design doesn't address. Gold zones also get a rising light and a
double rim, so they differ by shape as well.

**Check:** each move forced in turn: its zone matches what it hits, walking out dodges it, standing in takes the listed
share. Noon: behind a wall safe and the wall breaks; behind a column safe and the column stays. Pictures of every move
go to the user, who decides the art.

### Slice 3: the raid tool and all 39 heroes

`pipeline/tools/raid-tool.js`: `_raid(heroes, boss, reps)`, like `_balance`. It reports clears, time, errors and which
move killed. The autopilot learns to walk out of zones with a real reaction time and to walk into gold ones.

- Every hero against the boss: errors are bugs to fix.
- Effects that assume a hero's HP: blood, chef, dawn and twins, per the design. Reading them today, the shares are mostly
  of the hero's own HP, so this may be smaller than the design feared; the tool's damage per second finds out.
- Tune boss HP to the design's goal: all 39 can clear, a Normal autopilot about half the time.

**Check:** 39 heroes, no errors. Numbers in `STATUS.md`. Not proven by this: whether it's fun.

### Slice 4: co-op (step 4)

Written in this order, because each piece can be tested by the next:

1. **Hub:** raid lobbies (the lobby code with `raid: true`, hidden from the public list), `match.kind`, `boss_cast`,
   `boss_move`, `boss_hit`, `boss_damage`, `boss_hp`, `boss_phase`, `boss_stagger`, `boss_kneel`, `boss_stood`,
   `peer_down`, `revive`, `raid_end`, `accounts.recordRaid`. `PROTOCOL` goes to 3. The smoke test plays a whole raid on
   the server, including the caps.
2. **`src/raid/partner.ts`:** the third body. Split `netFollow` from `Duel.foe`, so it can walk any figure.
3. **`Duel.partnerCast`:** plays the partner's spell with every hit dropped, walls kept, units not raised.
4. **`NetLink`, `RaidController`:** next to `MatchController`. Side 0 runs the brain; side 1 follows.
5. **Falling and getting up.** Shared Burden, and two-player Anchors. Someone leaving; side 1 taking over the brain.

**Check:** two tabs with bots through the local server: the same boss HP and phase on both, a move hitting one hero and
not the other, a fall and a revive, side 0 leaving mid-move. All 39 heroes' spells replayed as a partner: neither your
HP nor the boss's changes and nothing hostile appears. **Still not proven: two real people.**

### Slice 5: the run (step 5)

The user said to go on with it before anyone has played the Sun Warden (2026-11-06), so every number here waits on a person.
It is written in this order, alone first, because one screen is always tested first.

**5a. The run, alone.** Pick a hero, take one of three upgrades, fight, take another, fight the next boss, then the next tier or
stop. A loss ends it. Bosses are a list (`RAID_RUN` in `server/protocol.mjs`), so the run works with one boss before the second exists.

| Piece | Where |
|---|---|
| Upgrades: the list, the filter by kit, three seeded offers | `src/raid/upgrades.ts` |
| Upgrades as one more layer on the hero | Hooks in `Duel`: cooldown in `castRules`, damage in `resolve`, max HP in `setup`, a saved life in `damagePlayer`, `HeroMode.speedBonus`, `Arena.heroBolt` for Ricochet. Each reads a `RunUpgrades` the fight is given, and does nothing without one |
| The pick screen, 30 s, time out takes the first | `src/raid/offer.ts` |
| The run's state and order | `RaidRun`, `src/raid/run.ts` |
| Tiers: boss HP +15 %, shown times 10 % shorter and never under 1 s, one extra move | `raidHp` in `protocol.mjs`, `p.shown()` in moves, `tier` in the brain |
| Score: bosses beaten, tier, total time | In this browser alone; on both accounts for two |

**5b. Ash and Ember.** One HP bar, one in the ring at a time, in their own room (the Cinder Pit), for the same reason the Warden has his.

- `BossDef.forms`: each form has a model and its moves in the ring and from the rim. A phase says who is in the ring.
- The rim boss is a second `HeroFigure` the duel only draws, like the partner. Nothing can hit it.
- **The tag is a cast,** so both screens swap at the same moment: a zone where the new one lands, then the swap.
- New in the script: a zone with its own hit test (the Lava Wave's gap), zones that stay and hurt (trail, puddles), and a drag on this
  screen's hero (Drag Under).
- Marked follows its target with a look only. What counts is the later step, with the spot the brain read, so rule 1 holds.
- Charge needs one thing only the brain's screen may do, move the boss: `BossMove.act`.
- Rising lava reuses `ArenaShift` and `ZoneFloor`, started by the phase and not by the clock.

**5c. The run for two.** The hub gets the stages: `raid_offer`, `raid_pick`, `raid_stage`, `raid_won`, `raid_cleared`, `raid_next`. Upgrades
stay on each client, so the hub only waits for the picks. The smoke test plays a whole run with both bosses.

**5d. The tool.** All 39 heroes against both bosses, and each upgrade forced on. Numbers in `STATUS.md`.

**Check:** each new move forced in turn as with the Warden; each upgrade changes the number it says, and goes away with the run; two tabs
through a whole run. **Not proven by any of it: whether it's fun, or how hard it really is.**

## What only a person can answer

No tool can tell whether the fight is good. So when slice 2 is in, the `?raid` route is ready to play on the dev server,
and that's the moment for the user to try it, before the tool's numbers are trusted.

## Risks

| Risk | What happens if it's real | Plan |
|---|---|---|
| A placeholder boss hides how big it reads | The camera and the zones may feel wrong with the real model | Set its scale from `BossDef`, and take the model's size from the design's giant. Check the frame from the hero's view on desktop and phone |
| Its body is wider than the nav assumes | It clips through a wall corner while walking | Accept for now: stone giant, gaps of at least 2 m. Note it for the art pass |
| Share damage ignores a tank's HP | Tank heroes get nothing from their HP | That's the design: a mistake costs everyone the same. Armor and shields still count, so tanks keep something |
| Heroes that need a stunned target | A combo never fires, since a boss can't be stunned | Look for them with the tool. Kneeling may need to count as stunned for them |
| The floor shader and many zones on a phone | Frame drops, as with Arenas that change | Not checkable here. Named in the closing report |
| `duel.ts` is shared with the multiplayer work | Conflicts | No other session is on it now (checked 2026-11-06). Check `git log` before each commit |
