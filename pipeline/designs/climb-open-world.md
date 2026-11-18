# The Climb as an open world (design, 2026-11-14)

The user: "will it be like multiplayer in the floors, so that others will see each other?", then, asked which kind: **"let's make it
like open world, can we?"**, and for enemies that grow stronger the more attack them: **more players** (not summons).

Today the Climb is single-player: a floor runs in one browser, its progress is kept in that browser (`tower.world.*` in localStorage),
and the server never hears of it. The game already has what an open world needs underneath: one WebSocket to one hub (`server/hub.mjs`,
a Durable Object on Cloudflare), client-owned heroes with a server referee (docs/architecture/multiplayer.md), relayed `move`/`cast`, and
the Raid's party fights where one screen runs a boss (its "brain") and the others mirror it (`NetLink`, docs/architecture/raid.md).

## What "open world" means here
- **Everyone on a floor is in the same place.** Signed-in players who start the same floor join one of its *shards* (at most 8 players
  each; a full shard opens another). You see the others walk, fight, cast, fall and leave, with their name over their head.
- **The world is shared, your progress is your own.** Packs, gatekeepers and rulers are the same for everyone in the shard; quests,
  stars, lives, shards (the currency) and sigils stay each player's own. A pack someone else cleared comes back after a while (an open
  world's enemies return), and a kill counts for everyone who hit it.
- **Not signed in, or offline:** the Climb plays as today, alone.

## Scaling with players (the user's pick)
A pack, gatekeeper or ruler counts the players fighting it (in the fight and within 20 m, or hit it in the last 10 s): with `n` of them,
health x (1 + 0.6 (n - 1)) and damage x (1 + 0.15 (n - 1)); gatekeepers and rulers x (1 + 0.75 (n - 1)) health. Set when it wakes,
raised (never lowered, so it cannot be gamed by leaving) when another joins. Numbers to be tuned with the route bot in pairs.

## Stages (each one ends in a test on two screens and the user's look before the next)
1. **Presence.** `world_join { floor, hero }` / `world_leave`; the hub keeps shards per floor and relays `world_move` (place, facing,
   walk, hero, health share, at 10 a second) and `world_cast` (the spell's look only) to the shard. Other heroes drawn as the Raid draws its
   partners (lite figures past 4), with names; no fighting together yet. Cheap on the hub: relay only.
2. **Shared packs.** Each pack has one owner screen (the first to wake it; handed on when it leaves, as the Raid's brain is): it runs the
   pack (tactics.ts and all) and sends its units' places, health and specials' zones at 10 a second; the others draw mirrors and send
   their hits to the owner through the hub. Scaling by players here. Respawn of packs after a set time.
3. **Shared gatekeepers and rulers.** The fights behind doors: whoever stands in when it starts is in the fight; the Raid's party machinery
   (boss brain, `NetLink`, revives) carries it. Scaling here.
4. **Together on purpose.** Invite a friend to your floor's shard, quick lines (no free chat at first: it needs moderation), see where
   friends are on the Climb screen.
5. **Progress on the account** (so a climb follows a login across devices): later, its own decision.

## Trust and cost
As the duels: each screen owns its hero and its hits; the hub clamps and rate-limits (places inside the floor's outline, at most 12
moves a second, casts as in duels). A pack's owner could cheat its pack: acceptable for a co-op world, not for ranked play. One hub for
everyone holds: 8 players x 10 moves a second a shard is small; the hub stays alive while players are connected (no hibernation).

## Rules that hold
`PROTOCOL` goes up with stage 1 (old clients are told to reload: the build-id bar). Each deploy only on the user's word, and a deploy
drops every connection. Two-tab tests with the local test accounts (fetched by the page from the git-ignored file, never typed).

## Progress
- **Stage 1, presence: built (2026-11-14, branch `tower-50`), not deployed.** The hub keeps each floor's shards (8 a shard, the
  fullest with room first) and relays `world_join` / `world_move` / `world_cast` / `world_leave` (PROTOCOL 16); the page joins with
  each zone it builds, leaves with each one it puts away, sends its place 10 times a second and its casts as their spell's name,
  and draws the others as the Raid's partners (full for the nearest 3, light past them, names over their heads, casts as looks
  only). How it works and the messages: docs/architecture/multiplayer.md, "The Climb's open world, stage 1". The two-tab test:
  docs/tower/openworld/stage1/. Waiting on the user's look before stage 2.
- **What stage 2 builds on:** the shard (`WorldShard.members`) is the set a pack's owner and its mirrors live in; `world_roster`
  and `world_joined` / `world_left` already tell every screen who is there and in what order they came (the first to come, or the
  oldest member, can own a pack, handed on at `world_left` as the Raid's brain is); `world_cast` is where a hit on a pack would ride
  to its owner; `WorldOthers` has each player's figure, place and caster figure for a pack's AI to see as targets.
- **Stage 2, shared packs: built (2026-11-14, branch `t3/climb-shared-packs`), not deployed (PROTOCOL 18).** One screen runs each pack
  (the first to wake it; handed to the oldest member near it when it leaves or goes quiet for 4 s), sends its units, health and red
  zones ten times a second, and its blows on other heroes to their screens; the others draw copies through the same `Pack.spawn` and
  send their hits to it. A kill counts for whoever hit the unit in its last 10 s; a pack counts for a player's quests only then. The
  hub counts the players in each fight and sets the pack for them: health x (1 + 0.6 (n - 1)), blows x (1 + 0.15 (n - 1)), only ever up.
  A cleared pack comes back after 3 minutes when nobody is within 30 m of it (only with two or more on the floor). How it works and
  the messages: docs/architecture/multiplayer.md, "The Climb's open world, stage 2". The two-tab test: docs/tower/openworld/stage2/.
  - **The numbers: kept as the design gave them (0.6 and 0.15).** Measured on floor 2 with the game's autopilot on two signed-in tabs
    (not the route bot: it has no link and always plays alone; a route bot that plays a floor in pairs through the hub is not built),
    the packs a, b and f, two tries each: Lyra alone took 31 and 32 s for the three, Kaia alone 28 and 28 s, the two together 26 and
    22 s. Health lost over the three: Lyra alone 0.15 and 0.35 of hers, Kaia alone 0.65 and 0.27; together Kaia (in front) 0.62 and
    0.53, Lyra 0.10 and 0. So a pair clears about a fifth faster than one hero, and the two together lose about what one loses alone,
    most of it the one in front. Playing together is a little easier for each, not a walk-over; one try a pack is noisy, so this is the
    direction, not a fine tuning.
  - **The trust:** the owner is trusted with its pack (acceptable for co-op, written down in multiplayer.md).
- **What stage 3 needs from this.** The gatekeepers and rulers are set pieces behind doors (`doors.ts`, `pieces/*`): today a door
  takes the hero out of the zone and out of the shard (`WorldGame.startPiece` calls `presence.leave()`), so a shared fight there needs:
  (1) a piece that keeps the shard: who stands in the door's ring when it starts is in the fight, the others stay in the zone and see
  the door shut; (2) the boss run as the Raid runs one (one brain screen, `NetLink`, revives), not as a pack: its moves are boss casts,
  not summon units, so `Pack` and `share.ts` do not carry it; what carries over is the hub's side: the fight counted (`packFight`,
  `WORLD_PACKS.fightR`/`hitS`), never counted down, hand-over to the oldest near (`packHandOn`), the quiet owner (`quietMs`), a per-floor
  table of what may be fought (`server/climb-packs.mjs` grows a list of doors), and `packScale` with the gatekeepers' own health factor
  (0.75 a player, this design); (3) the result of the piece for each player in it (a won ruler counts for all who were in, as a kill
  does), and what a player who was not in sees when the door opens again (the ruler down for a while, as a cleared pack).
- **Stage 3, doors together: built (2026-11-16, branch `t3/climb-stage3-doors-together`), not deployed (PROTOCOL 19).** Only a ruler's
  lair is fought together; a gate, a trial, a rival and a crown floor's lair stay alone (the gate and the rival are duels with a CPU
  hero, not on the boss path; a crown's Raid boss was not played on two screens: the hub's side would take its table row as it is). Walking into a lair with another player of the shard
  within 30 m holds the door 6 s ("held for others near", a Go in now button for the first one in; the others near are invited to walk
  in); whoever walks in by then fights the ruler with them, on the Raid's machinery as the design asked (one screen runs the brain, the
  others follow by `NetLink`, revives, the hand-over to the next screen when the brain's leaves or goes quiet). The ruler is set for the
  party: health and gauge x (1 + 0.75 (n - 1)), blows x (1 + 0.15 (n - 1)). The players keep their seats in the shard, out of the
  floor's sight, and come out in front of the door together; a clear counts for whoever hit, nothing counts for one who never did, all
  down is a life each. The hub's checks: a door id the floor does not have refused, a player far from the door not taken in, only the
  brain speaks for the ruler, places clamped, hits capped, `door_enter` rate-limited; the table grew each floor's doors and ruler
  (`CLIMB_DOORS`, `node pipeline/tools/climb-packs.mjs`). How it works and the messages: docs/architecture/multiplayer.md, "The Climb's
  open world, stage 3". The two-tab test: docs/tower/openworld/stage3/ (`python -I pipeline/tools/climb-doors-two.py <out>`).
- **What stage 4 needs from this.** Together on purpose: an invite into a friend's shard (the hub puts a player in the fullest shard; an
  invite names one), so friends who are on the same floor but in two shards meet; then they can walk into a door together as above. A
  door's fight could take a late friend in only if the Raid's fight took late seats (it does not: the party is set when it starts). The
  Climb screen could show where friends are from the hub's shards (`worlds`). Gates and rivals together need a CPU hero that fights
  several heroes (the duel's AI is one against one).
