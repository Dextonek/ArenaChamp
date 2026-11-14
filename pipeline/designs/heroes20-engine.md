---
title: The fight engine's new mechanics for the twenty new heroes
tags: [design, engine, heroes, traits, network]
updated: 2026-11-14
status: in progress (one writer on the shared engine files; no hero, no kit, nothing a player sees)
---

# The engine pieces the twenty new heroes need

The user, 2026-11-14, of the twenty heroes designed that day: "all of them, and already match them to lore, okay". Gate 3 of
[new-hero.md](../../docs/pipeline/new-hero.md) says that anything the engine does not have is named and built first, by one
writer. This page is that list, checked against the code (the sheets, `pipeline/designs/kit-<theme>.md`, were written from
the docs), and then each piece as it was built: its API, what is drawn, how it travels online, what the CPU sees, and its test.

No hero is built here. A mechanic is general: the hero who first needs it is named, others may use it.

## The list

"Sheet" is the size the hero's sheet guessed; "Real" is what the code says. "Decides" is the screen whose word counts online
(the victim's screen decides a hit on its own hero; each client moves its own hero). The net column says how the other screen
learns it: **cast** means both screens build it from the cast message (as walls and marks are today), **#** means the new
engine channel over the `stacks` relay (below), **none** means nothing travels.

| # | Mechanic | Heroes | Decides | Online | CPU must know | Sheet | Real |
|---|---|---|---|---|---|---|---|
| 1 | The enemy's HP in a trait (`t.enemyHp()`) | Nebet | the victim's screen (`dealt`) | none: HP is synced | nothing new | none | **tiny**: `TraitView` had only its own HP |
| 2 | Facing as a rule input | Lithea | the victim's screen (its own yaw) | none | that walking away is facing away (it is: a CPU faces where it walks) | small | **tiny**: yaw is on both screens, a helper |
| 3 | Footprint trails | Arden | the victim's screen | none (each screen samples) | to avoid its own prints (`enemyAvoid`, 6) | small | **small**: a recorder, pure |
| 4 | Crossing a line; strips that carry | Saga, Ostrel | the victim's screen | none (marks from the cast) | to walk round them (`enemyAvoid`, 6) | none | **small**: helpers; carrying exists (`carryEnemy`, `carrySelf`) |
| 5 | A second cast origin (the kite) | Lian | her client | cast (the kite is placed from a cast point) | the reach is from the kite | small | **small**: `ProjectileOptions.from` is free already; aim, reach and the CPU's range were the hero's only |
| 6 | Things the enemy CPU plans round, or believes are cover | Saga, Sahar, Itzel, Arden, Ostrel, Campana | the CPU's own screen | none | this is it | (in each) | **small**: a trait hook into the CPU's route and sight |
| 7 | An HP bar cut at given values | Ramet | his client | `show` | nothing new | small | **small**: `hpChunks` cuts equal parts only |
| 8 | The engine channel (`#` over `stacks`) | 9-13, 15, 18 | — | — | — | — | **small**: no server change |
| 9 | Sleep: a stun damage ends, the waking hit +25% (30 at most) | Vela | the victim's screen | # (`#z`) | that a sleeper wakes at the first hit (`aiHoldAttack`) | medium | **medium**: kept out of `StatusKind` (the hub relays only its own eight kinds, `src/net/` types them) |
| 10 | Lines that stop spells, not feet | Morwen | bolts: the screen they fly at; a targeted cast: the caster's client; an area hit: the victim's screen | cast | wards as no sight for its bolts and targeted spells | medium | **medium**: two bolt walls (one per side) stop both sides' bolts with no change to `projectile.ts` |
| 11 | A leash to a moving hero, max length; a swap of places | Kessa | the leashed hero's own client | the leash: the trait's stacks; a break: # (`#l`) | the clamp holds it; nothing to plan | medium | **medium** |
| 12 | Locking an enemy's key; the kind of a spell | Kohaku | the victim's screen (its own client refuses the key) | # (`#s`) | a sealed key is cooling | medium | **small-medium** |
| 13 | A token one hero holds, passed by hits or picked up | Asenet, Orren | the screen of the hero who takes it (a hit's victim, the one who picks up) | # (`#k`), versions and claim times | who holds it, where it lies | medium | **medium** |
| 14 | Ground only its maker can cross | Itzel | the walker's own client | cast | its route plans round them | medium | **medium**: a walk-only obstacle that knows whom it stops |
| 15 | Breaking the arena's cover | Tova | her client | # (`#c`) | it sees the hole (sight and routes read the live list) | large | **medium**: breakable walls, `removeCover` and the toppling look exist already |
| 16 | Bolts that bend into a point (lanterns) | Vela | the screen the bolt flies at | cast (the lantern) | its bolts may be caught | (in 9) | **small**: steered from outside, no change to `projectile.ts` |
| 17 | Placed things with HP that both screens agree on | Campana, Lithea, Vela, Lian, Hesk | the attacker's screen | # | as today (it shoots units in its way) | (assumed to exist) | **medium, found here**: see "Placed things online" |
| 18 | Standing on top of cover | Corbel | his client; the victim's screen skips melee | # | to perch, and to shoot a percher | large | **large** |
| 19 | A summon that can be turned | Hesk | the enemy's screen counts the hits | # | whose the golem is | large | **large** (in `effects/summon.ts`, which another agent touches) |
| 20 | Two places counted as one in every hit test | Thessa | the victim's screen | cast (the pins) | to step off a pin | large | **large** (every spell tests its own hits) |

Twelve of the twenty need nothing more than 1 to 8 (Nebet, Campana, Ostrel, Saga, Sahar, Lithea, Arden, Lian, Ramet, and,
with the channel, Asenet, Kohaku, Morwen); the rest are named in the table.

### What the code says against the sheets

- **Nebet is not "none".** A trait could read only its own HP. `TraitView.enemyHp()` and `enemyMaxHp()` are added (1).
- **The hub relays only the eight status kinds it lists** (`server/hub.mjs`, `STATUS_KINDS`), and `src/net/client.ts` types
  them. A new `StatusKind` would be dropped on its way to the other screen, and `statusTest.ts` walks every kind. Sleep is
  therefore its own state on top of a stun (9), told over the engine channel.
- **The `stacks` relay is the one free channel**: any name the client likes, cut to 16 characters, `n` rounded and held to
  0..999 (`server/hub.mjs`, `case 'stacks'`). Names starting with `@` and `!` are taken (shown state, notes to the owner). The
  engine's messages start with `#` (8).
- **Lian's bolt origin exists**: `ProjectileOptions.from` takes any point. What a kite needs is the aim and the reach measured
  from it, for the player and the CPU (5).
- **Tova is smaller than "large"**: breakable walls (`def.breakable`, `Duel.blastWalls`), `removeCover` and the arena's
  `coverFall` look (Ash's pillars) are there. What is new is HP per piece against one hero's spells and telling the other
  screen (15).
- **Placed things with HP do not agree online** (17): the crystal of `crystalPillar.ts` is a summoned unit, and each screen
  runs its own copy of the units. A hit on a unit is not filtered online (`hitFilter` drops only the hero; `hitUnit` lands the
  other player's replayed casts), so each screen counts its own hits on its own copy. The sheets assumed bells, statues,
  lanterns and the kite could be built "as the crystal is". See the section below for the measured difference.
- **Bolts stop at both sides' walls with two bolt walls**: a `BoltWall` stops the other side's bolts; a ward is one wall
  owned by each side, so nothing in `projectile.ts` changes (10).
- **Kessa's swap moves farther than the 4 m pull cap**: it is a dash of each hero on its own screen to the other's place as
  the cast recorded it (11), not a pull.

## How the pieces are reached

- **From a trait:** `t.mech` (a `MechView`, `src/mech/index.ts`), bound to the trait's side: `t.mech.sleep(...)`,
  `t.mech.seal(...)`, `t.mech.leash(...)`, and so on. Each says on which screen it acts, as `hitEnemy` does today.
- **From a spell:** `mechFor(ctx.caster)` (`src/mech/index.ts`) gives the same view for the caster's side. A spell plays on
  both screens, so what it builds from the cast (a ward, a barrier) is built on both.
- **The CPU:** the new `Trait` hooks `enemyAvoid`, `castOrigin`, `aiHoldAttack`, read in both `Duel.ai` (the opponent) and
  `Duel.pilot` (the autopilot of the simulations).
- **Every hook costs nothing when no hero uses it:** empty lists return before any sum, no `Math.random`, and the order of
  the existing sums is untouched, so the perf tool's fights print the same.

## The engine channel (8)

`src/mech/net.ts`. A message is `stacks(name, n)` with `name = '#' + key + data` (at most 16 characters) and `n` a whole
number 0..999. The duel's `peerStacks` and the watcher's `watchMine` hand `#` names to the round's `Mech`, which hands them
to the mechanic whose key it is. Sides are written relative to the sender (`S`: the sender's hero, `R`: the receiver's), so
nothing needs the match's side numbers. Numbers in the name are base 36: a position is two characters a coordinate (0.1 m
over -64..+64 m), a clock three (0.01 s up to 466 s).

**For the parent (a server change, not made here):** a relay of its own would carry longer data and could be checked:

    case 'mech': relay(c, match, { t: 'peer_mech', k: String(m.k).slice(0, 2), d: String(m.d).slice(0, 40), n: clamp(m.n, 0, 9999) })

with a smoke case "mech relayed". The client side would only need `MechNet.send` to use it. Until then `#` over `stacks`
needs no change on the hub.

## The mechanics, as built

(Filled in as each is built: API, look, online, CPU, test.)

## Placed things online

(The measurement and the fix, or the reason it waits.)

## Left for later, with a simpler spell that keeps the idea

(Filled in for any of 18 to 20 not built.)

## Tests

`pipeline/tools/heroes20-engine/`: one tool-page script per mechanic, each the body of an async function for
`python pipeline/tools/page-shots.py <script> <out> --port 5261`. Each puts a test trait in `TRAITS` under an existing
hero's name for that page only (no file changes: the record is exported and mutable), sets up a CPU duel, plays the
mechanic and returns what it saw. The online checks run two headless game pages against one dev server.
