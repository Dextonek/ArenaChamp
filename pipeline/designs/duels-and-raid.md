# Better duels and the Raid

Design for four features the user picked on 2026-11-06: **Loser picks**, **Arenas that change**, **Friend brackets
and spectating**, and the **Raid** (the Gauntlet idea, changed by the user: instead of a chain of CPUs, "boss cpu one
or two" with "rich mechanics u need to dodge", "like raid").

Every number is a starting value to tune, not a measured one. Bosses, moves and names are original: take principles
from raid games, never a boss, kit or name.

**Decided by the user, 2026-11-06:** the Raid is co-op; it is a first boss, then a second boss; Last stand stays, so a
long round always ends; the build order below stands. Loser picks is built, then switched off for every match: the
code stays, and nothing else in this design depends on it.

## Order and size

| # | Feature | Size | Why here |
|---|---|---|---|
| 0 | Version check | small | The new rules make an old tab and a new tab disagree more often |
| 1 | Loser picks | small | Built, then switched off for every match (user, 2026-11-06) |
| 2 | Arenas that change | medium | Builds what the Raid also needs: standing zones, damage by HP share, CPUs that keep out of zones |
| 3 | Raid: Sun Warden on one screen | large | First boss, proves the fight is good before a second screen makes it harder to test |
| 4 | Raid: the co-op link | large | Two players against that boss: the partner on your screen, the boss's HP on the server |
| 5 | Raid: upgrades, Ash and Ember, tiers | medium | The run around the bosses |
| 6 | Friend brackets | medium | Stands alone |
| 7 | Spectating | large | Bigger than the "medium" first suggested, see below. Step 4's partner figure is half of it |

Co-op about doubles the Raid. Steps 3 and 4 only count as done together: nothing of the Raid goes live with one screen
only unless the user asks for that.

## 0. Version check

Both screens work out arenas, hazards and parcels from the same seed with no server field, so an old tab against a
new one sees different cover and events (arenas.md, *Limits*). A deploy today does not stop that. Add `PROTOCOL`, a
number bumped by hand when the rules change, sent with `login` and `resume`. The hub answers a lower number with
"A new version is out: reload".

## 1. Loser picks

**Switched off for every match (user, 2026-11-06).** The code stays, and the rest of this section describes it switched
on. See `docs/architecture/multiplayer.md`, *Loser picks*.

### Rules

- After a round that does not end the match, its loser has 15 s to choose **one** of: swap hero, choose the next
  arena, or keep things as they are. Running out of time means keep. The winner sees "Ada is choosing".
- A best of three gives each player at most one pick: the loser of round 1 picks, and if they win round 2, the other
  player picks for round 3.
- A swap can be any hero except the one the other player is on: one match can't hold the same hero twice (the client
  has one effect instance per spell label).
- An arena choice can be any of the five, including the one just played.
- The winner can't answer the pick. The choice shows on the loading page ("Ada swaps to Bram") for at least 2 s.
- CPU fights are one round, so they don't change.

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

**Decided by the user, 2026-11-06: yes.** This changes the 2026-10-30 ruling that a round has no time limit. Last stand
adds no timer, draw or limit screen, but it does force an ending. The comment at `ROUNDS_TO_WIN` in `server/hub.mjs`
and step 5 of *Match flow* in `docs/architecture/multiplayer.md` still state the old ruling: change them when this
stage is built.

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

## 3, 4 and 5. The Raid

### The run

Two players open a raid room (a 4-letter code, the same as a lobby). Each picks a hero, kept for the whole run, and
not the same one: one match can't hold a hero twice. Then:

1. Each player picks one of three upgrades, from their own three offers (30 s; time out takes the first).
2. Fight the **Sun Warden**.
3. Each player picks an upgrade.
4. Fight **Ash and Ember**.
5. **Beat both and the Raid is cleared.** The clear screen offers the next tier, keeping the upgrades, for a higher score.

HP is full at each fight. **One loss ends the run:** a loss is both heroes down at the same time. The score is bosses
beaten, tier and total time, kept on both accounts. It doesn't count as a win or a loss on the profile, which stays
about duels against people.

Each tier: boss HP +15 %, shown times 10 % shorter (never under 1.0 s) and one extra move. **Tier 1 must be kind:** the
user found the CPUs too hard on 2026-11-04, so no zone shows for under 1.5 s.

**Falling and getting up:** a hero at 0 HP lies where it fell. The partner stands within 2.5 m for 3 s (hits don't stop
it, casting does) and the fallen hero gets up with half its HP. Twice a fight at most.

**Alone:** a room can start with one player, against 4,000 HP and with the moves marked below. The same path runs
offline with no account, like Play vs CPU, and it's how the raid tool tests a boss. The user asked for co-op; this one
stays because it costs nothing extra and a friend isn't always online.

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
| Who it aims at | A move aimed at "you" takes the hero it aimed at less recently, and a seeded coin when level. The cast bar names them. A fallen hero is never picked. Everyone inside a zone is hit, so a target can also walk a zone away from a partner |

Start values: boss HP about 6,500 for two players, for about 3 minutes (from about 26 damage per second per hero in
today's duels, less while dodging). Tune with the raid tool below.

### Boss 1: The Sun Warden (Night Temple)

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
| Noon | 4 s | He blasts the whole ring; only cover between you and him is safe; a screen wall that saved either hero breaks. Exposed after | Hide, and agree which wall to spend: two heroes behind one wall spend only one. The columns never break, so it stays survivable |
| Sun Order | 2.5 s | Four wedges round the altar show 1-2-3-4, then fire in that order, 0.8 s apart | Stand in 1, then step into it once it has fired |
| Shared Burden | 3 s | A gold circle on one hero, 40 % of max HP, split between the heroes inside: 20 % each when the partner steps in. Not used alone | Come together, right after a move that spread you out |

Phase 1's moves stay.

**Phase 3, Last Light (35 to 0 %): everything at once**

| Move | Shown | What happens | What you do |
|---|---|---|---|
| Eclipse | 1.6 s each | Near him, then far from him, then near again | Read and swap |
| Anchors | 3 s | Two gold circles on opposite sides at once: each needs a hero in it when it lands, or the whole ring takes 30 %. With a hero down, or alone: one, then the other | Split up and go *into* the zones, against every habit |
| Walking Sun | 12 s | A slow ray turns round the altar while other moves go on | Keep moving ahead of it |

If the fight passes 5 minutes, the Temple's Sunfire (from Arenas that change) closes in.

### Boss 2: Ash and Ember (Ember Caldera, tag team)

Two bosses, one HP bar, **one in the ring at a time**. The other stands on the rim and keeps throwing moves. They swap
at 66 % and 33 %, then every 12 s near the end. The players learn two sets of moves, then have to read both together.
The one in the ring aims at the nearer hero and the one on the rim at the farther, so two players can split the work:
one keeps the big one busy, the other watches the rim.

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
| Marked | 3 s | A bomb circle follows one hero, then lands with a puddle, and hits anyone inside | Carry it away from your partner, somewhere neither of you needs |
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
| `link.ts` | `RaidLink`: what a screen tells the rest of the raid. A local version for alone and the raid tool, a network version for co-op |
| `partner.ts` | The other player's hero on this screen |

Small hooks in `duel.ts`: `startBoss(def, seed, link)`, and `update` calls the boss brain where it now calls `this.ai`.
Boss hits go through `damagePlayer` as normal hits, not the no-credit hazard path, so a parry or ice block can save a
good player. Each boss move calls `enemyCast` too, so Vesper's Hemocurse and the Referee's count still work.

### Co-op: two screens, one boss

**Each screen stays one hero against one enemy, plus a third body it only draws.** That's what keeps this from being
a rewrite of the duel code, which holds exactly two bodies today:

| Body | On your screen | How the code has it |
|---|---|---|
| Your hero | `arena.caster`, as always | No change |
| The boss | `Duel.foe` and `Duel.figure`, on the **vs CPU path** (`start`, not `startNet`): your spells land and count here (`opponentHit`), and `t.enemy()`, `liveFoes()` and the aim code need no change | `this.ai` becomes the boss brain or follower. `arena.remoteFigure` stays null, and the local HP is corrected from the server |
| Your partner | A second hero figure, **not in `liveFoes()`** | Nothing of yours can target or hit it, so `hitFilter` needs no change. `netFollow` is split from `Duel.foe` so it can walk any figure from a track of reports |

The partner's casts need a new `Duel.partnerCast`. `peerCast` can't be reused: it aims at your hero and its hits land on
you, and `peerAttack` does too (`oppAttack.releaseNow(arena.caster)`). The new path plays the same effect from the
partner, aimed at the boss or the relayed spot, with every hit dropped. What the effect's context does is decided one
call at a time:

| Context call | In the partner's replay |
|---|---|
| Hits, damage, statuses, carry, pull | Dropped: only the caster's own screen counts them |
| Temporary walls, `blastWalls` | Kept, as in a duel, so boss rays stop at the same cover on both screens |
| Summoned units | Not raised. They'd be enemies to your hero, and units already differ between screens. **A summoner's partner sees fewer bodies**, the same limit as units from a passive today |
| Dashes and blinks | Nothing to do: they arrive as moves |

Marks, stacks and combos stay on their owner's screen and don't cross: your mark means nothing to your partner's hero.
That keeps every trait as it is. Players help each other through Stagger, Exposed, Anchors, Shared Burden and getting
each other up. No hero heals or shields a partner in this design.

**Who decides what:**

| Thing | Who decides | How |
|---|---|---|
| The boss's walk, its next move, who it aims at | **Side 0's screen runs the brain.** Side 1 follows | `boss_move` (position, 20 a second) and `boss_cast { id, move, x, z, target, seed }` through the hub. Side 1 draws the boss with the split `netFollow`, 100 ms behind, as it draws any other player |
| A hit on a hero | That hero's own screen, today's rule, so walking out of a zone is a real dodge | `boss_hit { id, damage, color }`. The hub takes it only for a `boss_cast` it relayed in the last 12 s, at most one per 0.3 s, capped at 35 % of that hero's max (`HAZARD_MAX` 60 is too low for 15-30 % moves) |
| The boss's HP | **The hub** | `boss_damage { amount }` from each screen's own hits, capped like spell hits and by a budget per second. `boss_hp { hp, max }` to both, at most 10 a second. Your own hits show at once and the next `boss_hp` corrects the bar |
| Phases | The hub, from that HP | `boss_phase { phase }`, so both screens change at once. The brain only starts new moves from it |
| Stagger | The hub | `boss_stagger { amount }` when your hard control lands; `boss_kneel { seconds }` to both when full |
| Exposed | The brain | Part of the big move's `boss_cast` |
| Anchors, Shared Burden, Noon's walls | Each screen reports its own hero, the brain answers | `boss_stood { id, part }` to the brain, which sends the result as a `boss_cast`. A wall that saved a hero breaks on both screens from that answer |
| Falling and getting up | The hub keeps who is down | `peer_down { side }`, `revive`. Both down: `raid_end` |

**Why not the same seed on both screens, like hazards:** moves aim at where a hero stood and the boss chases, and each
screen sees the other hero about 100 ms late (`PEER_DELAY`). Over 3 minutes two copies of the boss would drift apart.
The brain's own rolls stay seeded, so a run can be replayed in a test. The server doesn't run the brain because it
would need the walking and cover code, which lives in the client.

**Hub:** a raid has exactly two people, so `players[1 - c.side]` still means "the other one" and the relay cases
(`move`, `cast`, `attack`, `heal`, `status`, `shield`, `buff`, `stacks`, `spend`) work as they are, once a room of one
is guarded against. New: `match.kind = 'raid'`, `match.boss`, and the states `upgrade`, `loading`, `fight`, `cleared`.
`took_hit` isn't used, because players don't hit each other. Today `hazard` and `took_hit` call `endRound` at 0 HP; in a
raid that goes through a new `heroDown`. Stats go through a new `accounts.recordRaid`, not `record`, and the profile
gains the raid count and best score.

**On the receiving side:** `peer_heal`, `peer_status`, `peer_shield`, `peer_buff` and `peer_spend` all write to
`Duel.foe` today, which here is the boss. In a raid they go to the partner's bar instead, in a new `RaidController` next
to `MatchController`.

**Someone leaves:** a closed socket or a reload counts as leaving, since there's no reconnect into a running match. The
other hero fights on, with the boss's HP as it stands, and the leaver's run ends with the score so far. If side 0 left,
side 1 starts the brain at the next move: it already knows the phase, the boss's spot and the moves in the air.

**Both on one code path:** alone is the same fight with the local `RaidLink`, so one screen is always tested first.
What a local run can't prove has to be tried with two tabs: every message above, side 0 leaving mid-move, a fall and a
revive, and both heroes in different zones of one move.

### What must be checked for all 39 heroes

- **Every kit against a boss:** the boss is a `HeroKit` with no spells, which no kit has met. A run of all 39 finds
  the errors.
- **Share-of-HP damage:** a rough search finds it in four trait files (blood, chef, dawn, twins). Against 4,000 HP
  these may be far too strong, so they need caps.
- **Melee and summoners:** Stone Sweep punishes standing close, and bosses need to treat units sensibly. Check melee
  can win without being in every zone.
- **Every kit as a partner:** replay all four spells and the basic attack of all 39 on the other screen, and check that
  neither your hero's HP nor the boss's changes and nothing hostile appears.
- **Raid tool:** `_raid(heroes, boss, cpuLevel)`, like `_balance`, runs the autopilot at CPU levels as a stand-in for a
  person's reactions. It reports clears, time, errors and which move killed. Goal: all 39 can clear tier 1, and a
  Normal-level autopilot clears about half the time. Anchors need the autopilot to walk *into* a zone. The tool can't
  judge whether it's fun, so a person has to play it.

### Art needed

- **Sun Warden:** model with idle, walk, slam, charge, kneel and fall. It can grow from the hooded guardian statues
  already in the temple backdrop.
- **Ash and Ember:** two models with the same set.
- **Move effects** in the particle editor: ray, Noon flash, Sun Order wedges, anchors, slam, trail, bomb, wave.
- **Boss HUD:** HP bar with phase marks, cast bar, stagger gauge, the partner's bar. Must read on a phone.
- **Partner:** a name and a colour ring, so two heroes in a busy fight can tell whose is whose.
- **Placeholders first:** a scaled hero stands in for each boss until the fight is proven, so no art is wasted.

## 6. Friend brackets

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

## 7. Spectating

Bigger than "medium". The hub only relays, and each screen knows one hero it controls and one foe it replays. A
spectator controls neither, and that view doesn't exist yet. The Raid's partner figure (a hero drawn from reports, with
its casts replayed and no hits) is what a spectator needs twice over, so this gets cheaper once step 4 is in.

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

Reconnecting into a running match, ranked ladders, hero bans, more than two bosses, more than two players in a raid,
heroes healing or shielding a partner.

## Decided (user, 2026-11-06)

1. The Raid is co-op: two players against the boss.
2. A first boss, then a second boss. The second is the tag-team pair, one in the ring at a time.
3. Last stand stays: a long round always ends.
4. The build order in the table at the top.
