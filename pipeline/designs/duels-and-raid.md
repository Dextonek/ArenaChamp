# Better duels and the Raid

Design for four features the user picked on 2026-11-06: **Loser picks**, **Arenas that change**, **Friend brackets
and spectating**, and the **Raid** (the Gauntlet idea, changed by the user: instead of a chain of CPUs, "boss cpu one
or two" with "rich mechanics u need to dodge", "like raid").

Nothing here is built. Every number is a starting value to tune, not a measured one. Bosses, moves and names are
original: take principles from raid games, never a boss, kit or name.

## Order and size

| # | Feature | Size | Why here |
|---|---|---|---|
| 0 | Version check | small | The new rules make an old tab and a new tab disagree more often |
| 1 | Loser picks | small | Stands alone, changes every online match |
| 2 | Arenas that change | medium | Builds what the Raid also needs: standing zones, damage by HP share, CPUs that keep out of zones |
| 3 | Raid: Sun Warden, solo | large | First boss, proves the mode |
| 4 | Raid: upgrades, Ash and Ember, tiers | medium | The run around the boss |
| 5 | Friend brackets | medium | Stands alone, can move earlier |
| 6 | Spectating | large | Bigger than the "medium" first suggested, see below |

## 0. Version check

Both screens work out arenas, hazards and parcels from the same seed with no server field, so an old tab against a
new one sees different cover and events (arenas.md, *Limits*). A deploy today does not stop that. Add `PROTOCOL`, a
number bumped by hand when the rules change, sent with `login` and `resume`. The hub answers a lower number with
"A new version is out: reload".

## 1. Loser picks

### Rules

- After a round that does not end the match, its loser has 15 s to choose **one** of: swap hero, choose the next
  arena, or keep things as they are. Running out of time means keep. The winner sees "Ada is choosing".
- A best of three gives each player at most one pick: the loser of round 1 picks, and if they win round 2, the other
  player picks for round 3.
- A swap can be any hero except the one the other player is on: one match can't hold the same hero twice (the client
  has one effect instance per spell label).
- An arena choice can be any of the five, including the one just played.
- The winner can't answer the pick. The choice shows on the loading page ("Ada swaps to Bram") for at least 2 s.
- Applies to queue and lobby matches. CPU fights are one round, so they don't change.

### Stats

`accounts.record` takes one hero per match. The match counts for the hero the player **finished on**; the history
line shows the swap (`Lyra → Bram`).

### Code

| Where | Change |
|---|---|
| `server/hub.mjs` | New state `pick` after `break`. New `round_pick { hero?, arena? }`, taken only from the round's loser in that state. `round_end` gains `pick` (you or the foe, seconds). `round_start` gains both heroes and `arena` (an id, or null for the seeded one). The hub needs the five arena ids. |
| `src/duel.ts` | `startNet` splits `arena` into `seed` (still `<match id>-<round>`, so hazards stay shared) and an optional `arenaId`. |
| `src/game/match.ts` | `beginRound` calls `api.setKit` when the hero changed and takes the new opponent from `round_start`. Pick panel on the round break. |
| Pick panel | Reuses the hero tiles and adds an arena row. Must work on a phone: 39 tiles in 15 s need large tiles and a scroll. |

### Risks

- A strong counterpick may decide the match. `kit-balance.js` already prints wins per opponent, but at 39 fights a
  pair is mostly noise, so judge this from real matches.
- A hidden tab can't pick: the timeout covers it.

## 2. Arenas that change

### Rules

A round has three stages on the fight clock. A stage is announced by a banner, shows its zones for 3 s (permanent
changes get longer than a hazard's 1.2 s) and lasts until the round ends. Hazards keep running.

| Stage | Starts at | Purpose |
|---|---|---|
| 1 | 35 s | Short rounds never see it: CPU rounds average about 23 s (hazards off) |
| 2 | 60 s | The safe floor gets smaller |
| 3 | 85 s | Safe floor about 6 m across the middle, little cover left |
| Last stand | 105 s | The whole floor hurts, and more each 5 s, so a round always ends |

**Decision for the user:** on 2026-10-30 the user set "a round has no time limit". Last stand adds no timer, draw or
limit screen, but it does force an ending. Recommended, because today two careful players can stand off for ever.

Standing damage is a share of the hero's max HP (HP runs from 450 to 840), about 3 % per 0.8 s at stage 3, rising in
Last stand. It stays under the hub's 60 per hit.

### The five arenas

All point-symmetric about (0, 7), like the hazards.

| Arena | Banner | Stage 1 | Stage 2 | Stage 3 |
|---|---|---|---|---|
| Night Temple | The temple falls | The four screen walls crack and fall (the art exists: `wallState`) | The six side columns topple along a shown line (hit where they land), then are gone | Sunfire burns the floor outside 6 m |
| Frostfall Lake | The ice breaks | The rifts stay open as two water channels: slow while in them, no damage | Outer ice sinks: freezing water beyond 9 m, slow and damage | The same beyond 6.5 m |
| Ember Caldera | The lava rises | Lava beyond 10 m | Lava beyond 8 m and over the vent to 2 m | Lava beyond 6.5 m and over the vent to 2.5 m: fight on a ring |
| Verdant Glade | The forest closes in | Roots raise four new low walls in the gaps (cover grows, fights get close) | Thorns beyond 9 m, slow and damage | Thorns beyond 6.5 m |
| Sky Ruins | The platform breaks up | The outer ring breaks off to 10 m | To 8 m | To 6.5 m |

Sky Ruins really shrinks the walkable ring (`arena.bounds.r`) and pushes heroes inward. The other four use zones,
because a player may choose to stand in one and pay for it. The ring's centre and start spots never move.

Sky Ruins is the only arena that changes the ring's size, which arenas.md says the AI, the camera focus and the
network position stream all assume is 12 m. All of those need checking. The server's `clampRing` stays at 12 m, so
the smaller ring is a rule each client keeps, the same trust level as the rest of the game.

### Code

- **Timeline:** a new `ArenaShift`, seeded and driven by `Duel.hazardClock`, so both screens match the way hazards
  do. It holds the stage, its zones and a `safe(x, z)` check.
- **Cover changes:** through the live `arena.obstacles`. Nav already replans when the list changes. A wall a stage
  breaks also clears its `wallHp`.
- **`ArenaHazard`:** `HazardHit` gains a share-of-HP damage. A zone with a long `to` already works, and `danger()`
  already respects it.
- **CPU:** the walk-out check rolls once per event, which doesn't suit a zone that stays. CPU walk goals get clamped
  into `safe()`, and a goal inside a zone is dropped. Pip's parcels can end up in lava: a player can still fetch one
  at a cost, a CPU drops the goal.
- **Balance runs:** a new `shiftsInRuns` switch, off by default like `hazardsInRuns`, so old numbers stay comparable.
  A separate run measures how many rounds reach each stage and which heroes gain or lose. Melee should gain.
- **Online:** one two-player test per arena. The docs still list arena events as not two-player tested.

### Art needed

| Arena | Pieces |
|---|---|
| Temple | Column topple and rubble, sunfire floor |
| Frost | Open water channels, sinking ice sheets |
| Caldera | Rising lava edge and vent |
| Glade | Root walls growing in, thorn floor |
| Sky Ruins | Outer floor split in chunks that fall away |

## 3 and 4. The Raid

### The run

Pick a hero (kept for the whole run), then:

1. Pick one of three upgrades.
2. Fight the **Sun Warden**.
3. Pick an upgrade.
4. Fight **Ash and Ember**.
5. Repeat at the next tier. **One loss ends the run.**

HP is full at each fight. The score is bosses beaten and total time, kept in `localStorage` like `cpu.won`, on the
account later. This keeps the Gauntlet's "harder and harder" with only two bosses to build.

Each tier: boss HP +15 %, shown times 10 % shorter (never under 1.0 s) and one extra move. **Tier 1 must be kind:** the
user found the CPUs too hard on 2026-11-04, so no zone shows for under 1.5 s.

### What makes it a raid

Hero fights are about aim and cooldowns. Boss fights are about reading and moving.

| Rule | Detail |
|---|---|
| Cast bar | The boss's move name and charge sit under its HP bar, so a player can learn each move |
| Colours | Pale orange means leave. Gold means **stand here**. Never the spells' red |
| Phases | HP thresholds, with a pause and a banner when the fight changes |
| Stagger | Hard control doesn't hold a boss. Stun, root, charm, silence and knock-up fill a gauge instead. A full gauge makes it kneel for 6 s, taking +50 %. Control heroes keep their role |
| Exposed | After its biggest moves the boss stands open for 5 s, taking +50 %. A reward for surviving |
| Not moved | Knockback, pull and carry don't move a boss. Slow works at half strength |
| Damage | A share of max HP, about 15 to 30 %. Three or four mistakes kill, the big moves more |

Start values: boss HP about 4,000, for about 3 minutes (from about 26 damage per second in today's duels, less while
dodging). Tune with the raid tool below.

### Boss 1: The Sun Warden (Night Temple, solo boss)

A giant stone guardian, walking at about 2 m/s. The temple is the natural first room: it has cover that stops rays
and walls that break.

**Phase 1, Awake (100 to 70 %): teaches the language**

| Move | Shown | What happens | What you do |
|---|---|---|---|
| Stone Sweep | 1.6 s | Cone in front, 6 m, 120° | Walk out, or get behind him |
| Pillar Fall | 1.5 s, then 0.7 s apart | Three circles, each where you stood | Keep walking |
| Sun Ray | 2.5 s | A line across the ring through your spot, stopped by cover; cracks the wall it hits | Step aside or get behind cover |

**Phase 2, High Noon (70 to 35 %): cover becomes the puzzle**

| Move | Shown | What happens | What you do |
|---|---|---|---|
| Noon | 4 s | He blasts the whole ring; only cover between you and him is safe; a screen wall that saved you breaks. Exposed after | Hide, and think about which wall to spend. The columns never break, so it stays survivable |
| Sun Order | 2.5 s | Four wedges round the altar show 1-2-3-4, then fire in that order, 0.8 s apart | Stand in 1, then step into it once it has fired |

Phase 1's moves stay.

**Phase 3, Last Light (35 to 0 %): everything at once**

| Move | Shown | What happens | What you do |
|---|---|---|---|
| Eclipse | 1.6 s each | Near him, then far from him, then near again | Read and swap |
| Anchors | 3 s | Gold circle: you must stand in it when it lands, or the whole ring takes 30 %. Two in a row, on opposite sides | Go *into* the zone, against every habit |
| Walking Sun | 12 s | A slow ray turns round the altar while other moves go on | Keep moving ahead of it |

If the fight passes 5 minutes, the Temple's Sunfire (from Arenas that change) closes in.

### Boss 2: Ash and Ember (Ember Caldera, tag team)

Two bosses, one HP bar, **one in the ring at a time**. The other stands on the rim and keeps throwing moves. They swap
at 66 % and 33 %, then every 12 s near the end. The player learns two sets of moves, then has to read both together.

Why a tag team: the duel code assumes one enemy hero (`Duel.foe`, one figure, `t.enemy()` in all traits). Swapping who
that is costs little. Two attackable bosses at once means reworking those, and would make heroes with single-target
spells feel worse.

**Ash:** huge, close range, breaks up the floor.

| Move | Shown | What happens | What you do |
|---|---|---|---|
| Ground Slam | 1.4 s | Circle round him, 5 m | Back away |
| Charge | 1.5 s | A line to the rim, stopped by cover, which stuns him 2 s | Put cover behind you |
| Drag Under | 2 s | Pulls you in, then a ring hits far from him | Stay close, then walk out in time |
| Burning Trail | none | Lava puddles where he walked, 15 s | Plan your route |

**Ember:** quick, from range, makes you the problem.

| Move | Shown | What happens | What you do |
|---|---|---|---|
| Fan | 1.5 s | Five lines from her | Stand in a gap |
| Marked | 3 s | A bomb circle follows you, then lands with a puddle | Carry it somewhere you don't need |
| Vent Bombs | 1.5 s | Lava bombs in pairs, from the existing hazard | Walk between |
| Lava Wave | 2.5 s | A ring grows from the vent with one gap, which turns | Walk through the gap |

**Together (33 to 0 %):** The Caldera's rising lava starts, and the partner on the rim adds a move every 8 s.

### Upgrades

Three are offered at each pick, only ones this hero can use. Starting list:

| Upgrade | Effect | Only for |
|---|---|---|
| Ricochet | Bolts bounce once off cover | Heroes with line bolts |
| Quick Hands | Cooldowns -15 % | |
| Last Light | R cooldown -25 % | |
| Long Stride | Walk speed +15 % | |
| Glass Edge | Damage +25 %, max HP -15 % | |
| Stone Skin | Max HP +20 % | |
| Stubborn | Once a fight, a killing hit leaves 1 HP | |
| Opportunist | +60 % damage while the boss is exposed or kneeling | |
| Bone Breaker | Stagger fills 40 % faster | Heroes with control |
| Fresh Start | A shield of 10 % max HP at each phase | |

Upgrades join the existing trait hooks (`castMods`, `cooldown`, `attackMods`, `speed`) as one more layer on top of the
hero's own trait. Ricochet uses the existing `spell.bank` and `bankPath` on a per-run copy of the kit.

### Code

Keep it out of `duel.ts` (already 2,221 lines). New folder `src/raid/`:

| File | Role |
|---|---|
| `boss.ts` | `BossDef`: model, HP, phases, moves |
| `script.ts` | `BossScript extends ArenaHazard`: it already gives seeded timing, zones, telegraphs and `danger()`. It needs a phase-driven schedule instead of the fixed 8 s and 9 to 13 s, plus several zone colours |
| `run.ts` | `RaidRun`, the run's state, shaped like `CpuMatch` in `src/game/cpu.ts` |
| `upgrades.ts` | The list and the filter by kit |

Small hooks in `duel.ts`: `startBoss(def, seed)`, and `update` calls the boss brain where it now calls `this.ai`.
Boss hits go through `damagePlayer` as normal hits, not the no-credit hazard path, so a parry or ice block can save a
good player. Each boss move calls `enemyCast` too, so Vesper's Hemocurse and the Referee's count still work.

### What must be checked for all 39 heroes

- **Every kit against a boss:** the boss is a `HeroKit` with no spells, which no kit has met. A run of all 39 finds
  the errors.
- **Share-of-HP damage:** a rough search finds it in four trait files (blood, chef, dawn, twins). Against 4,000 HP
  these may be far too strong, so they need caps.
- **Melee and summoners:** Stone Sweep punishes standing close, and bosses need to treat units sensibly. Check melee
  can win without being in every zone.
- **Raid tool:** `_raid(heroes, boss, cpuLevel)`, like `_balance`, runs the autopilot at CPU levels as a stand-in for a
  person's reactions. It reports clears, time, errors and which move killed. Goal: all 39 can clear tier 1, and a
  Normal-level autopilot clears about half the time. Anchors need the autopilot to walk *into* a zone. The tool can't
  judge whether it's fun, so a person has to play it.

### Art needed

- **Sun Warden:** model with idle, walk, slam, charge, kneel and fall. It can grow from the hooded guardian statues
  already in the temple backdrop.
- **Ash and Ember:** two models with the same set.
- **Move effects** in the particle editor: ray, Noon flash, Sun Order wedges, anchors, slam, trail, bomb, wave.
- **Boss HUD:** HP bar with phase marks, cast bar, stagger gauge. Must read on a phone.
- **Placeholders first:** a scaled hero stands in for each boss until the fight is proven, so no art is wasted.

### Solo or co-op

**Decision for the user.** A raid is often played as a group. Two players against a boss would be a far bigger job:
each screen holds exactly two bodies today (`castSpell` and `hitFilter` assume this hero and that foe), and the server
would have to own the boss's HP.

**Recommended:** build solo first. Keep every boss choice seeded and never `Math.random`, because seeded moves are
what would let two screens run the same boss later. Decide on co-op after a person has played the Sun Warden.

## 5. Friend brackets

- The host makes a tournament (4 or 8 seats) and shares a 4-letter code, the same as lobbies. The host can start early
  with fewer players: empty seats become byes.
- Seats are shuffled. Each match opens a room like the lobby's, with a hero pick and 60 s to be ready. No pick means a
  random hero; someone who has left loses that match.
- Matches are the normal best of three with Loser picks, and count on the profile. One new count: tournaments won.
- The hero rule is per match, so a hero can return in the next match.
- After a match everyone returns to the bracket screen with the live score of matches still running. Showing the score
  is small and gives waiting players something before spectating exists.

### Limits to accept

| Limit | Why |
|---|---|
| A reload or a sleeping phone loses the current match | There is no reconnect into a running match. The seat is held by account name, so the player stays in the tournament if they were not knocked out |
| A deploy or a restart ends the tournament | Lobbies and sessions live in memory; `cf:deploy` drops every connection |

### Code

New messages `cup_create`, `cup_join`, `cup_leave`, `cup_start`, `cup_pick`, `cup_ready` and a `cup` state message.
Holds a `cups` map in `server/hub.mjs`; `endMatch` reports to the cup. A new bracket screen in `src/game/main.ts`.
`server/smoke-test.mjs` gets a full 4-player cup.

## 6. Spectating

Bigger than "medium". The hub only relays, and each screen knows one hero it controls and one foe it replays. A
spectator controls neither, and that view doesn't exist yet.

| Piece | Work |
|---|---|
| Hub | `match.watchers` (at most 8). Sends both players' `move`, `cast` and `attack`, and all HP and hit messages, marked by side |
| `Duel.startWatch` | Both figures driven from reports. `peerCast` only plays foe at hero today, so it needs the other direction. All local hits dropped, HP only from the server. Camera from AI-vs-AI runs (`hm.spectate`, `hm.focus`) |
| Joining | From the next round start, because the state a spectator would need mid-round (walls, hazard clock, marks) isn't all on the server |

### What the spectator sees differently

- Units can stand in different places, as they already do between the two players' screens. Units from a passive only
  exist on their owner's screen, so a spectator wouldn't see them.
- Marks and counters that come from a trait's own simulation may differ or be missing.
- HP, the winner and the casts are exact.

### Other notes

- Watchers multiply messages: about 40 a second per watcher through one Durable Object. Check Cloudflare's free limits
  before raising the cap.

## Not in this design

Reconnecting into a running match, ranked ladders, hero bans, co-op raid (see above), more than two bosses.

## Decisions waiting on the user

1. Raid: solo first or co-op? Recommended: solo first.
2. "One or two" bosses is read as two boss fights in a run, the second a tag-team pair. Correct?
3. Last stand forces a round to end. Recommended: yes.
4. Build order as in the table at the top.
