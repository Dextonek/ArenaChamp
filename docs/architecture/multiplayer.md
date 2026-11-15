---
title: Multiplayer duel game
tags: [architecture, multiplayer, server, websocket, accounts, lobby, matchmaking, duel, line-of-sight, climb, open-world]
updated: 2026-11-14
---

# Multiplayer duel game

**Arena of Kits** (`/game.html`) turns the 1 vs 1 duel into a small online game: log in, look at the heroes, open or
join a lobby or queue for a match, and fight another player in the duel ring, each controlling their own hero
(click to move, Q / W / E / R to aim and cast). The server keeps the accounts, pairs the players, referees HP and
the winner, and writes the stats the profile page shows. The editor stays at `/` (`index.html`) unchanged.

![A network match: Isolde (left player) against Lyra round the centre wall](../spells/stage/net-duel.jpg)

## Run it

| Command | What runs |
|---|---|
| `npm run dev` | Vite on 5173: the editor at `/`, the game at `/game.html`, the game server at `ws://…/ws` (attached by a Vite plugin; the plugin also hooks `vite preview`, untested) |
| `npm run build` then `npm run game:server` | the standalone server on 8787 (`PORT=…` to change): serves `dist/` and `/ws`; open `http://localhost:8787/` |
| `npm run test:server` | `server/smoke-test.mjs`: two socket clients through register, lobby, queue, fight, KO, forfeit, resume (no browser); `node server/smoke-test.mjs ws://host/ws` tests a running server |
| `npm run cf:dev` | the Cloudflare version locally (Workers runtime, no account needed): `http://localhost:8788/` |
| `npm run cf:deploy` | publish to Cloudflare (after `npx wrangler login`), see [Cloudflare](#cloudflare) |

Two players on one machine: open `/game.html` in two windows (or two tabs) and create two accounts. A tab in the
background keeps simulating (see *Background tabs*). Players on a LAN open the host's address instead.

## Architecture

```
 browser tab (game.html)                          Node (Vite dev server or server/standalone.mjs)
 ┌─────────────────────────────────┐   /ws JSON   ┌──────────────────────────────────────────────┐
 │ src/game/main.ts  screens        │◄────────────►│ server/game-server.mjs                        │
 │ src/net/client.ts NetClient      │              │  sessions (token → name, in memory)           │
 │ src/game/match.ts MatchController│              │  lobbies, queue, matches (in memory)          │
 │   └─ Duel.startNet (src/duel.ts) │              │ server/accounts.mjs → server/data/accounts.json│
 │ src/runtime.ts (shared scene)    │              └──────────────────────────────────────────────┘
 └─────────────────────────────────┘
```

| Decision | Choice and why |
|---|---|
| Transport | One WebSocket (`ws` 8.18.3, the only new dependency) on the page's own host at `/ws`. The Vite plugin in `vite.config.ts` attaches it to the dev / preview server, filtering upgrades by path so Vite's HMR socket is untouched. |
| Authority | **Server referee, client-owned heroes.** The server owns sessions, lobbies, pairing, match start (countdown), HP, the winner and the stats. Each client owns its own hero's movement and casts, and decides the hits *its own hero* takes: it replays the other side's cast locally and runs the duel's impact-time dodge check where its hero really stood. That keeps "walk out of the red" fair for the dodger and needs no headless effect simulation on the server. |
| Trust | Fine for friends on one machine or a LAN, not cheat-proof: a modified client could ignore its hits or skip cooldowns. The server clamps positions into the ring, drops casts before the countdown ends, drops a cast of the same slot within 0.35 s (R: 10 s, except one free second R within 4 s: a recast), accepts a reported hit only for a cast the other side made in the last 12 s, and caps one reported hit at 250. |
| Accounts | Names 3-16 `[A-Za-z0-9_-]`, passwords 4-64 characters hashed with PBKDF2-SHA256 (Web Crypto, 100 000 iterations, per-user salt; accounts from before the port used scrypt and are re-hashed at their next login, Node only). Stored in `server/data/accounts.json` (git-ignored) on Node, in the Durable Object's SQLite storage on Cloudflare. No e-mail, no external auth. |
| Sessions | A random token per sign-in, kept in memory on the server (a server restart means logging in again) and in **`sessionStorage`** on the client: per tab, so two tabs of one browser can be two players. One connection per account: a second sign-in signs the first out. |
| Same hero | Not allowed in one match (the client has one effect instance per spell label). The lobby greys out the other seat's hero and the server refuses `ready` with it; the queue only pairs different heroes. |
| Scene reuse | `game.html` imports `src/game/main.ts`. It builds the shared runtime (`createRuntime({ modules: targetedModules, background: true })`, `src/runtime.ts`) with only the spell effects, so the VFX tool's panel, particle editor and hotkeys are not in the game's bundle. The game drives `GameApi`: arena, hero mode, duel, kits, `setHeroMode`, `setKit`. No second render pipeline. |

## Files

| File | Role |
|---|---|
| `server/hub.mjs` | `createHub({ accounts, log, loserPicks })`: the runtime-free core (sessions, lobbies, queue, matches, the message handlers); `connect(send)` returns `{ message, closed }`; messages of one connection run one at a time |
| `server/accounts.mjs` | `Accounts(store)`: register, login, `record` a match, `profile` (stats, favourite hero, history of 20), the duel rating, the week's wins and the Climb's board; `store` is `{ load(), put(key, account), getMeta?, putMeta? }` |
| `server/clans.mjs`, `server/filter.mjs` | clans and their rooms, kept as store records; the clan chat's word filter (server only) |
| `server/game-server.mjs` | Node host: `attachGameServer(httpServer, { path, dataFile, log })` (`ws` + `fileStore`: every write re-reads the file and replaces one account, so servers sharing the file don't clobber each other) |
| `worker/index.mjs`, `wrangler.jsonc` | Cloudflare host: the Worker and the `GameHub` Durable Object (see [Cloudflare](#cloudflare)) |
| `server/standalone.mjs` | http server for `dist/` plus the game server (port 8787) |
| `server/smoke-test.mjs` | the socket-level end-to-end test |
| `game.html` | the second Vite entry (`build.rollupOptions.input` has `editor` and `game`) |
| `src/net/client.ts` | `NetClient` (connect, auto-reconnect with backoff, resume by token, typed `on(type, fn)`), the `ServerMsg` union and the `Profile` type |
| `src/game/main.ts` | screens: login / register, play (hero choice, find match), lobbies, lobby room, heroes, profile, play vs CPU; the queue bar; toasts. It sets `duel.onLeave` (the card's leave button ends the CPU fight or the network match) |
| `src/game/social.ts` | the Leaderboards and Clan screens (see *Leaderboards and clans*) |
| `src/game/cpu.ts` | `CpuMatch`: an offline fight against the duel AI at a CPU level (no server, no account): set kit, hero mode on, `duel.cpuLevel`, `duel.start('play')`; a Leave button; a won level is reported to the screen |
| `src/game/match.ts` | `MatchController`: `match_start` → set kit, hero mode on, `duel.startNet`; streams moves at 20 Hz with the sender's clock; warns when its tab is hidden; forwards peer events; the result card; forfeit |
| `src/game/heroPreview.ts` | the heroes page turntable (its own small renderer, renders only while shown) |
| `src/game/game.css` | menu styles (duel HUD palette; hero accent through `--accent`) |
| `src/obstacles.ts` | the ring's pillars and walls: collision, sliding, line of sight, meshes (see below) |

Since PROTOCOL 11 (the hero shop): `createHub` also takes `shop` and `now` (the clock for the shop's days and weeks, for tests);
`Accounts` also keeps obols, owned heroes, the founders, the raid ranks and the week's boards, and its `store` may have
`getMeta(key)` / `putMeta(key, value)` for a few small records beside the accounts; `attachGameServer` takes `shop` and `now` and
passes them on. `pipeline/tools/shop-shots.py` plays bots through the hub and takes the Shop's pictures.

## Match flow

1. Two players are paired (both ready in a lobby, or two different heroes in the queue). The server sends
   `match_start` with each player's `side`: side 0 starts at (0, 0, 13) like the AI duel, side 1 at (0, 0, 1)
   with the camera turned round (`HeroMode.flipCamera`), so both see the opponent ahead. Positions are world
   coordinates on both clients; nothing is mirrored.
2. Each client sets its kit, turns hero mode on, calls `Duel.startNet({ opponent, side, names, net })` (hero locked,
   banner "Waiting for opponent") and sends `match_loaded`. When both are loaded (or after 15 s) the server sends
   `match_fight { countdown: 3 }`; the banner counts 3-2-1-FIGHT and unlocks the hero.
3. During the fight each client sends `move` 20 times a second (only when it changed) and `cast` after every cast
   (`HeroMode.onCast(label, slot, target)`). The other client draws the opponent's figure from its reports (see
   *Smooth movement*) and replays casts with `Duel.peerCast`: the effect starts where the foe is drawn (it snaps to
   the reported spot only when that is more than 3 m off), the effect plays through `castAs` with this side's hero as the target (single-target spells), the relayed aim point
   (ground spells) or the caster's spot (self spells), and the duel's own `hitPlayer` decides hit or dodge.
4. A hit on this side's hero: local number, red edge flash and knockback, then `took_hit { damage }`. The server
   subtracts it from that player's HP, answers `hp` to the victim and `peer_hit { damage, hp }` to the attacker,
   whose client shows the number and flash on the opponent and sets its HP (`Duel.peerHit`, through
   `arena.setHp`). A dodge sends `dodged` → `peer_dodged` (DODGED over the opponent). The attacker's own cast never
   damages the remote hero locally: `arena.hitFilter` drops those hits.
5. **Best of three rounds.** A round ends when a hero's HP reaches 0 (`ko`). The hub has no clock for it, but the arena's
   Last stand makes a long round end (user, 2026-11-06; [arenas.md](arenas.md#arenas-that-change-stages)).
   The server sends `round_end { round, result,
   reason, winner, score, hp, next }` (score as [this player, the foe]); the duel freezes the hero and shows "Round 1
   to <name> · 1-0" (`Duel.netRoundEnd`). A 3 s break follows. Then
   `round_start { round, score, you, foe, picked }`: each client runs
   `Duel.startNet` again (fresh HP, cooldowns and start spots, and its own arena: the seed is `<match id>-<round>`)
   and sends `match_loaded`, then the usual countdown. Every round's HP is the hero's own max (`match_loaded
   { maxHp }`; melee heroes carry more than 600).
6. The second round win, `match_leave` (`forfeit`, the Forfeit button) or a closed socket (`disconnect`, also during
   a break) ends the match: the server records both players with the round score, saves the file, and sends
   `match_end` with the result, `score` and the updated profile. The duel card shows VICTORY / DEFEAT, the time,
   "2-1 in rounds" and the new record; **Back to menu** stops the duel and hero mode.

## Loser picks

**Switched off for every match (user, 2026-11-06).** The code stays: `createHub({ loserPicks: true })` turns it on, and
only `server/smoke-test.mjs` does, to keep it working. With it off, `round_end.pick` is null, the panel never opens, the
break is 3 s and a `round_pick` is ignored. The rest of this section describes it switched on.

After a round that does not end the match, its loser gets 15 s to choose one of: swap hero, choose the next arena, or
keep things as they are (`round_end.pick { you, seconds }`, the panel from `showPick` in `src/game/main.ts`). The winner
reads "<name> is choosing". Best of three gives each player one pick at most by itself. Running out of time keeps things
as they are; an answer ends the wait, but the break still lasts its 3 s.

| Rule | How |
|---|---|
| A swap | Any hero but the other player's (one effect instance per spell label): the hub refuses that one, and the panel greys it. `round_start.you` and `.foe` say who fights next, and `beginRound` calls `api.setKit` when this side's changed |
| An arena | `round_pick.arena`. `Duel.startNet` plays `arenaId`, while the seed still drives the arena's events, so both screens stay on one schedule. The hub doesn't hold the arena list: an id a client doesn't know gets the seeded arena on both screens |
| Reading it | The loading page says "Ada swaps to Bram" for at least 2 s (`LoadingScreen.show({ note })`) |
| Stats | The match counts for the hero the player finished on. The history keeps the one they started on as `from` (`Lyra → Bram`) |

## Play vs CPU (offline)

The CPU duel is a mode of the Play screen (since 2026-11-10; it was a screen of its own): two tabs over the roster,
**Online match** and **CPU duel**. The CPU mode shows five difficulty buttons (Novice to Master,
[cpuLevels.ts](../../src/cpuLevels.ts); a tick on each level already beaten) and an opponent select (a random hero by
default, never your own) over the hero picker, and the bar's button becomes **Fight**. The login screen's **Duel the
CPU** opens the same screen without an account (`state.screen === 'cpu'`): only the CPU mode is open there, and the
online tab leads to the login. The mode is kept in `localStorage` (`play.mode`). Every hero picker starts with a **Random** tile: on the Play card and the CPU screen it stays chosen and is drawn when the match or fight starts, so a Rematch keeps the hero drawn; in a lobby it is drawn at once, so the other player sees the hero. The fight is the
offline AI duel (`CpuMatch` in `src/game/cpu.ts`, `duel.start('play')` at `duel.cpuLevel`) in a random arena: no
server messages, nothing on the profile. One round; the card's Rematch keeps hero, opponent choice and level, and
its Leave duel (or the Leave button during the fight) returns to the Play screen in its CPU mode. The choices and the beaten levels
live in this browser's `localStorage` (`cpu.level`, `cpu.foe`, `cpu.hero` without an account,
`cpu.won.<account or guest>`). Fight is disabled while the player is queued or in a lobby, since a `match_start`
would take the scene over.

## The Raid

A raid room is a lobby with `raid: <boss id>`: `lobby_create { raid }`, joined by its code, not on the public list. When both are
ready the hub sends `raid_start` instead of `match_start`, then leads the run with `raid_offer`, `raid_stage` and `raid_won`; `match_loaded` and `match_fight` work as in a match. The relays of
`move`, `cast` and `attack` are the same; the rest has its own messages and rules: [raid.md](raid.md). Alone is always offline.

**Twin Flames' messages** (a party against Ash and Ember, both at once, in the Twin Forge; the table with every field is in raid.md, "Twin Flames"). The rows marked 13 came with the forge (built as 12 on a branch that was never deployed; the Heart of Noon's merge stayed at 11, so the deploy that brings them is 13):

| Message | Since | What |
|---|---|---|
| `raid_stage.twin { half, hp, brain, staggerMax }` | 9 | Which half each seat is in (0 west with Ash, 1 east with Ember, -1 gone), each boss's HP and brain's screen, one boss's gauge. Since 13 each boss has `RAID_TWIN.share` (0.485) of the band's HP, not half (`raidTwinHp`) |
| `which` on `boss_cast`, `boss_move`, `boss_damage`, `boss_stagger`, `boss_debuff`, `boss_reward`, `boss_hp`, `boss_phase`, `boss_gauge`, `boss_kneel`, `peer_debuff`, `boss_brain`, `brain_moved` | 9 | Which of the two it is about (0 Ash, 1 Ember) |
| `boss_rage { which, on }`, `boss_fell { which }` | 9 | One grows furious or calms; one fell |
| `boss_cast.mate` | 13 | A second hero the step is for, beside `target` (Lantern Chain's pair); passed on only if it is a seat |
| `boss_cast` with `move: 'flood'` | 13 | No new field: from its relay on, the hub takes the wall of fire as out though both stand (revives and gold zones are the whole party's; hits stay each half's own boss's) |
| `boss_reward { key: 'change' }` (client → server, from a brain's screen) | 13 | A request, not a reward: the hub marks every second standing hero of each half for The Changing of the Flames, and says who with `boss_done { id, part: 100 + seat, side: seat }` |
| `boss_obj { id, part: 200 + own seat }` (client → server) | 13 | A marked hero stepped through a gate: the hub deals that seat into the other half. Taken only from that hero, once, within 12 s of the call |
| `boss_reward { key: 'vents' }` (from a brain's screen) | 13 | Every vent of one cast of Seal the Vents sealed: that twin staggers (40, scaled as its gauge is, halved as each twin's gauge is). Each vent itself is an objective (`boss_obj`, `boss_done`) as any spot |
| `twin_halves { half, brain, late }` (server → client) | 13 | The halves as dealt now, whose screen runs each brain, and the seats the gates shut on (those burn). `boss_brain` and `brain_moved` follow for a brain whose screen crossed |

## Messages

Client → server:

| `t` | Fields | Notes |
|---|---|---|
| `register`, `login` | `name`, `password`, `v` | → `session` or `auth_error`, or `update_required` (see *Rules version*) |
| `resume` | `token`, `v` | after a reload in the same tab |
| `logout`, `profile`, `lobbies` | | `lobbies` answers with `live` too (14): the duels being fought now |
| `watch`, `watch_leave` (14) | `id` (watch) | see *Watching a duel*; `error` for a duel that is over, a player in a match, a lobby or the queue |
| `lobby_create`, `lobby_join`, `lobby_leave` | `code` (join) | 4 letters, case-insensitive |
| `lobby_pick` | `hero` | resets that seat's ready; with the shop on, `error` for a hero that is neither owned nor free this week (see *The hero shop*) |
| `lobby_ready` | `ready` | refused without a hero or with the other seat's hero; both ready → match |
| `queue_join`, `queue_leave` | `hero` (join) | a locked hero is refused with `error`, as at `lobby_pick` |
| `shop_buy` (since PROTOCOL 11) | `hero` | → `shop_bought { hero, price, profile }`, or `error`: no such hero, already owned, not enough obols, the shop is closed |
| `boards` (11) | | → `boards`; answered without an account too |
| `tower_report` (11) | `floor`, `hero`, `week` | the floor this player's own page reached in the week's Tower, for the week's board. Not verified, pays nothing; only this week, 1-500, a hero the account may play, only upward → `boards` when it counted |
| `match_loaded` | `maxHp` | the hero's max HP for this match (200-2000; default 600); sent every round |
| `match_leave` | | |
| `round_pick` | `hero` or `arena`, or neither to keep things as they are | ignored while Loser picks is off; on, only from the round's loser during the break; see *Loser picks* |
| `move` | `x`, `z`, `yaw` | clamped to the ring, relayed |
| `cast` | `id`, `slot`, `x`, `z`, `fx`, `fz`, `enemy` | aim point, caster spot, aimed at the enemy; dropped before the countdown ends |
| `cast` (since 2026-10-30) | + `yaw` | which way the hero faced (spells fired straight ahead) |
| `took_hit` | `id`, `damage`, `color`, `soaked`, `blocked` | `damage` got past the hero's own shield, `soaked` is what the shield took; a hit from a basic attack is capped at 40. `blocked`: the victim's passive swallowed it whole (Isolde's ice block, Oblivion's void maw): no HP is taken, and the attacker's passives do not count it |
| `dodged` | `id` | |
| `hazard` | `damage`, `color` | an arena event hit this hero: capped at 60, at most one per 0.3 s, comes off the HP and can KO; the other client gets `peer_hit` with id 0 (no cast, no credit) |
| `attack` | `id` | a basic attack released at the other hero; at most one per 0.5 s |
| `heal` | `amount` | the hero healed itself; the server adds it (at most 150, at most 300 in 2 s, up to the max HP) |
| `status` | `kind`, `seconds`, `color` | a status the hero took (shown on the other screen; ≤ 3 s) |
| `shield` | `amount`, `seconds`, `color` | a shield the hero got (shown on the other screen; ≤ 400, ≤ 10 s) |
| `cast.mods`, `attack.mods` | `power`, `status`, `debuff`, `knock` | the hero identity layer's cast power and extras ([traits.md](traits.md)); power clamped 0.25-3, extras to the status / buff caps; a spell hit may now be up to 400 |
| `buff` | `kind`, `amount`, `seconds` | a buff or debuff on the hero (shown on the other screen; ≤ 50 %, ≤ 6 s) |
| `stacks` | `name`, `n` | stacks the other hero's mechanic keeps on this hero, decided here (≤ 20) |
| `spend` | `amount` | HP the hero paid for a spell (≤ 100, never below 1 HP) |
| `move.r` | | the hero's resource (0-1000), for the other screen's bar |

Server → client: `session { token, profile }`, `auth_error { error }` (empty error = token expired), `update_required { error }`, `logged_out
{ reason }`, `profile`, `error { error }` (shown as a toast), `lobbies { list }`, `lobby { lobby, you }`, `queue
{ on, since, size }`, `match_start { id, side, hp, you, foe }`, `match_fight { countdown, round }`, `round_end { …, pick }`, `round_start { round, score, you, foe, picked }`, `peer_move`,
`peer_cast` (+ `yaw`), `peer_hit { id, damage, soaked, hp, color, blocked }`, `peer_dodged`, `peer_attack { id }`, `peer_heal { amount, hp }`,
`peer_status { kind, seconds, color }`, `peer_shield { amount, seconds, color }`, `peer_buff`, `peer_stacks`, `peer_spend { amount, hp }`, `hp { hp }`, `match_end { result, winner, reason,
seconds, score, hp, stats, profile, earned }`. Since PROTOCOL 11: `shop { on, week, next, free }` (to every connection as it opens,
and again with a session and a profile), `shop_bought { hero, price, profile }`, `obols { earned, total, why }`, `boards { week,
raid, tower }`.

## Watching a duel (since PROTOCOL 14)

Anyone signed in may watch a duel being fought (the user, 2026-11-12: "make so that i can watch ongoing lobbys"; duels only for
now, raids later; the players see how many watch, not who). The Lobbies screen lists them under **Live now**
(`lobbies.live`); Watch sends `watch { id }`.

- **A watcher has no seat.** It gets no `match` on the hub (`Client.watching` instead), so nothing it sends can act in the
  duel, and its leaving ends nothing. At most 20 watch one duel. Joining the queue or a lobby, or logging out, stops watching.
- **What it gets:** `watch_start` (the duel as it stands: both names, heroes, HP and max, where each hero last stood, the round,
  the score, the state, the seconds of countdown left or how long the round has run), then every message of both players
  wrapped as `watch_msg { side, msg }` (`side`: the hero it is about; for `peer_hit`, the one hit), and its own `watch_fight`,
  `watch_round_end { winner, score, picking }`, `watch_round_start { heroes }`, `watch_end { winner, reason, seconds, score }`,
  with sides instead of "you". `watchers { n }` goes to the players and the watchers when the count changes.
- **The screen** (`src/game/watch.ts`, `Duel.startWatch`): side 0 is drawn as this screen's hero, side 1 as the opponent, the
  camera on the whole ring. Side 1 goes through the same `peer*` methods as a player's foe. Side 0 walks a track of its own
  reports and its casts and attacks are replayed (`HeroMode.replayCast`, `replayAttack`) with no check that could stop them.
  Nothing is decided on a watcher's screen: no hit, heal, payment or hazard counts there; all HP is the server's. A watcher
  who comes in mid-round sets the arena's event clock to the round's time, so its events match the players'.
  Messages that come while a round loads are not played; the newest HP and spot of each hero among them are, once it is up.
  Walls broken before a watcher came in still stand on its screen until the next round (the hub does not know them).
- Checked: `npm run test:server` (list, join, counts, a watcher's messages change nothing, the sides, the end); two bot pages
  fighting and a third coming in 4 s into a live round in Chrome: for a minute the same HP on all three, the arena's clock
  within 0.2 s, the same cover, both heroes within 0.3 m of where their own screens had them, no errors.

## The Climb's open world, stage 1 (since PROTOCOL 16)

The user, 2026-11-14: "let's make it like open world, can we?" ([pipeline/designs/climb-open-world.md](../../pipeline/designs/climb-open-world.md)).
Stage 1 is presence: signed-in players who walk the same Climb floor see each other. Nothing else is shared yet: each screen keeps
its own enemies, quests, lives and progress, and nothing one player does can touch another (stage 2 shares the packs).

- **Shards.** The hub keeps each floor's shards (`worlds` in `server/hub.mjs`): at most `WORLD.shardMax` (8) players each, a new
  player goes into the fullest shard that has room, and a full floor opens another ("2.1", "2.2"; an empty shard is dropped). A
  player in a duel, a raid, a lobby, the queue or watching a duel is in no shard: going to any of them leaves the floor first.
- **Relay only.** The hub keeps each player's last place (a newcomer sees everyone where they stand), clamps it (to the mm, inside
  `WORLD.reach` = 500 m of the floor's middle, health share 0-1), drops walks past 12 a second and casts past 8 in 2 s or the same
  spell again within 350 ms, and passes the rest on. No HP, no hits, no referee: there is nothing to referee.
- **The page** (`src/net/world.ts` `WorldLink`, `src/tower/world/others.ts` `WorldOthers`). Each zone built joins the floor's
  shard and each zone put away leaves it: a door to a set piece, a fall that begins the floor again, the result card, Leave. The
  hero's place goes out 10 times a second, only when it changed; its casts go out as their spell's name and aim. The others are
  drawn as the Raid draws its partners: full figures for the nearest 3, light stand-ins past them (looked at twice a second),
  played back 100 ms late between two reports as in *Smooth movement* (the reports go into a fixed ring of slots and are read back without allocating; the figures and the casts' looks allocate as they do in a raid), a
  name over each head. A cast plays its look from their figure at the spot they aimed with no hits, knocks, walls or units, and
  only the pose when this screen's own hero has the same spell or the figure is a stand-in. They are never hit, aimed at or in
  anyone's way. A fallen one lies down (health share 0) and stands when it is up again. The HUD's floor panel says
  "2 others on this floor" (hidden when not signed in).
- **Alone as before.** Not signed in, with no connection, or in the tools (`world-tool.js`, the route bot, the perf scenes): no
  link, and the Climb is the same as before. A connection that drops clears the others; the resume's `session` joins again.
- **Limits.** A tab hidden behind another sends its hero's place about once a second (the browser slows a hidden tab), so that
  hero moves in steps on the others' screens; two windows side by side are smooth. Two others who cast the same spell share one
  effect (the game keeps one per spell), so the second cuts the first short. A set piece behind a door is alone. A newcomer's
  model loads when it first comes near enough to be drawn in full.
- **Test switch:** `game.html?others=7` (or a perf scene with `others`, `gen-2-others`) walks seven made-up others round the hero,
  casting, through the same drawing path, with no server.

| Message | Way | Fields | What |
|---|---|---|---|
| `world_join` | client → hub | `floor`, `hero`, `x`, `z`, `yaw` | into a shard of that floor (the floor it is on: stays in its shard, the roster comes again). A locked hero → `error` |
| `world_roster` | hub → client | `shard`, `floor`, `you`, `max`, `players: [{ id, name, hero, x, z, yaw, walk, hp }]` | the answer: this player's shard and everyone else in it |
| `world_joined` | hub → shard | `id`, `name`, `hero`, `x`, `z`, `yaw`, `walk`, `hp` | someone came in (or changed hero) |
| `world_move` | client → hub | `x`, `z`, `yaw`, `walk`, `hp`, `ts` | this hero's place, facing, whether it walks, its health share; at most 12 a second |
| `world_moved` | hub → shard | `id` + the same | relayed, clamped |
| `world_cast` | client → hub | `label`, `x`, `z`, `tx`, `tz` | a spell cast: its name, the caster's spot, the aim |
| `world_cast` | hub → shard | `id` + the same | relayed (rate-limited as above) |
| `world_leave` | client → hub | | out of the shard |
| `world_left` | hub → shard | `id` | left, or the connection dropped, or went to a lobby, the queue or a duel |

Checked (2026-11-14): `npm run test:server` (a page not signed in is refused; two on floor 2 share shard 2.1 and see each other;
walks relayed and clamped, a flood of 30 cut to 12; casts relayed, a repeat and a long name dropped; floor 3 hears nothing; eight
fill 2.1 and the ninth opens 2.2; joining again keeps the shard; `world_leave`, a dropped connection and a lobby each send
`world_left`). Three tabs on the dev server with local test accounts (floor 2, floor 2, floor 3): pictures in
[docs/tower/openworld/stage1/](../tower/openworld/stage1/).

Speed (`perf.py scenes --scenes gen-2,gen-2-others`, 1500 frames, this computer's card, two runs back to back on a quiet machine;
`gen-2-others` has seven made-up others circling the hero, each casting every 3 to 6 s). Median / p99 / longest frame (ms):

| Profile | No others | Seven others |
|---|---|---|
| desktop | 10.5-10.6 / 20-26 / 121-209 | 11.5-12.1 / 25-26 / 366-426 |
| phone-4x | 28.0-28.6 / 66-68 / 376-410 | 33.9-37.9 / 75-78 / 438-580 |

So seven others cost a slowed phone 6 to 10 ms a frame, on a floor that is already at 28 ms there. Where (`perf.py census`, phone):
the others are 50 of the frame's 310 draw calls, 31 of them the three full figures' rigged meshes (79k triangles, no shadows), the
rest the four stand-ins and seven names; the casts' looks add a few more. Memory churn goes from 19-20 to 25 MB/s (the figures'
animation and the casts' effects; the reports themselves allocate nothing). The fight under the others is not the same one (their
casts draw on the scene's seeded dice). The duel and the raid play the same fights as before the change (`duel-temple`,
`raid-party`: the same prints as the commit before, run beside it; `raid-party` itself comes out as one of two prints from run to
run, on both).

## The Climb's open world, stage 2: shared packs (since PROTOCOL 18)

The user, 2026-11-14: "do it" to stage 2 of [the design](../../pipeline/designs/climb-open-world.md), with enemies that grow stronger
"if more enemies are attacking on mob or boss or gatekeeper", by **more players**. In a shard, the players on a floor now fight the same
packs. Gatekeepers and rulers behind doors are still each player's own (stage 3).

- **One owner screen a pack.** A pack woken on a screen is claimed (`pack_claim`). Nobody runs it: that screen does (its *owner*) and
  the shard hears `pack_owner`. Someone does: only the claimer hears whose it is. Until the answer the pack fights on the waking screen
  alone, as before. The owner runs it as a pack always ran (`src/tower/world/packs.ts`, `tactics.ts` and all), with the other players'
  heroes within 30 m of it among its victims: its focus, slots and turns are over every hero (`PackMind` counts another screen's hero as
  a hero), and its swings, bolts and specials reach them (`SummonOptions.others` in `src/effects/summon.ts`: the summon's world and each
  bolt's are widened, and a hit on another screen's hero goes to that screen, never to the arena). It gives up only when no hero is
  within its leash. Ten times a second, and at once when a red zone begins, the owner sends its packs in one `pack_state`: each unit's
  place, facing, health, walk, blow, wind-up and bolts fired, and the red zones.
- **The others draw copies** (`Pack.mode` `mirror`). The copies are the same summoned units made by the same `Pack.spawn` (`lookOf`
  and all: a change of a figure shows on every screen), with no mind: `SummonUnit.mirror` keeps them from falling, being pushed or
  striking here, and their brain places them from the reports, played back 100 ms late through the same ring of slots that draws the
  other players (`Glide`, others.ts). Their swings, wind-ups and bolts are drawn from the reports (a copy's bolt strikes nothing), their
  red zones by the same `TelegraphLayer`. They are real targets: this screen's spells and attacks hit them, the hit is shown at once
  (the bar held down for 400 ms) and goes to the owner (`pack_hit`), who takes it off its unit; the result comes back in the next report.
  A copy falls when the owner's report says so.
- **Each screen owns its own hero.** A blow of the owner's pack on another player's hero goes as a share of that hero's health
  (`pack_hurt`); that screen applies it to its own hero through the same door as its own packs' blows (shields, boons, the floor's law),
  with a root or a slow when the kind's blow holds.
- **Health against boons.** A unit's health on a screen is lowered by that screen's hero's damage boons (hits on units pass no boon).
  So a hit goes to the owner times the hitter's boon (the unit's health before anyone's boons) and comes off divided by the owner's;
  a copy shows health as a share; a pack handed on keeps its share.
- **Credit.** A unit's fall counts (a kill, its shards) on every screen whose hero hit it in its last 10 s; on the owner's also when
  nobody else hit it lately (its law, its hazards: as alone). A pack counts for a player's quests and run (`run.packsCleared`) when that
  player had a counted kill of it. The quests read the run, not the pack: a pack others cleared does not finish your step, and a pack
  that comes back does not undo it. Progress stays in each browser (localStorage).
- **Scaling with players** (`packScale`, server/protocol.mjs). The hub counts `n`, the players in a pack's fight: its owner, whoever
  stands within 20 m of it (its owner's last report), and whoever hit it in the last 10 s. Health x (1 + 0.6 (n - 1)), blows x
  (1 + 0.15 (n - 1)). Set when it wakes (`pack_owner` carries `n`), raised when the fight grows (`pack_scale`), never lowered, so leaving
  cannot make it weaker; the health already lost keeps its share. Two players: x1.6 health, x1.15 blows; three: x2.2, x1.3; eight: x5.2,
  x2.05.
- **Hand-over.** When the owner leaves the shard (a closed tab, a dropped connection, a door, Leave) or sends nothing for 4 s (a tab put
  away), each of its packs goes to the oldest member within 40 m of it, one heard from in the last 4 s first, as the Raid's boss brain is
  handed on (`pack_owner` with the new owner). That screen already draws the copies: they become its own units where they stand, with
  their health, and fight on. With nobody near, an owner that left lets it go (`pack_owner` with owner 0): each screen has it to
  itself again, and it walks home and heals; an owner that is only quiet keeps it (a player alone who puts its tab away for a moment
  comes back to its fight as it was).
- **Leashed home.** A pack its owner's screen sees give up and come home asleep is let go (`pack_release`): the next to wake it claims
  it again, for the players near then.
- **Cleared and back.** The owner says when the last unit fell (`pack_clear`); the shard hears `pack_cleared` (copies still standing
  fall then). A newcomer is told in `world_roster.packs`. After 3 minutes (`WORLD_PACKS.respawnS`), when nobody stands within 30 m of
  its home and two or more walk the shard, the hub brings it back (`pack_respawn`): whole, asleep at home, set for one. Alone in a shard
  nothing comes back (the Climb plays as it always did). The hub looks at this on each walk in the shard.
- **Alone, not signed in, the tools.** Signed in and alone in the shard, a pack is claimed and run here as before, set for one, its
  reports sent to nobody. Not signed in, every pack is local, exactly as before. The tools (`world-tool.js`, the route bot, the perf
  scenes) have no link and no share at all.
- **The hub's checks.** A pack id must be the floor's (`server/climb-packs.mjs`, made from the floors by `node pipeline/tools/climb-packs.mjs`;
  `--check` says whether it is up to date, and the page warns in the console on the dev server when the floor it plays differs from
  it). Only a pack's owner may report it, hurt with it, clear or release it; a non-owner's hit is relayed only for a pack someone else
  runs. Places are clamped as walks are, numbers made finite; a report holds at most 12 units and 8 zones. Rates, each a second and a
  player: 12 reports, 40 hits (at most 600 each), 30 blows; a blow's share is 0-1, its hold at most 3 s. A pack's report goes only to
  the members within 60 m of it.
- **Trust.** The owner is trusted with its pack: its places, health, deaths and blows are taken as it says. A cheating owner could
  make its pack harmless or deadly for the shard. That is acceptable for a co-op world, not for ranked play (as the Raid's boss brain).
- **The summon cap and the copies' cost.** While other players are on the floor, a side may have 24 live units (`CROWD_CAP`,
  share.ts), not 6, so their packs' copies can be drawn beside this screen's own; alone it is 6, as before. A copy is a whole figure
  (about twenty draw calls), so at most 6 copies are drawn at once (`COPY_MAX`), the nearest packs first (looked at twice a second; the
  first pack is always drawn whole), and a copy casts no shadow (as the other players' figures do not; given back when the pack runs
  here). A pack past the budget is drawn when it comes among the nearest.
- **Limits.** The owner judges a blow on another hero where its screen draws that hero (100 ms or more late), not where that hero
  stands: a dodge at the last moment may still be hit. A copy's red zone fills from when its report arrives, a little after the
  owner's (the report goes at once when a zone begins). Waves the zone makes for itself (a hold's, the Sands' dust wraiths) are not
  shared: each screen has its own. A respawned pack pays its shards again. A named enemy's patrol is shared only while it fights.
  With more than 6 copies near (three or more other packs in one place), the farthest are not drawn here, though their owner's screen
  may still strike this hero with them. The hub keeps no record of a pack that came back, so a player whose zone is built again (after a
  door, a fall that begins the floor again) sees a pack its own run cleared as cleared, where the others see it back, until someone
  wakes it (then this screen draws it again).
- **Test switches.** `game.html?others=7&packs=3` (or the perf scenes `gen-2-fight-3`, `gen-2-fight-7`): made-up others, each with
  three made-up packs fighting round the hero as copies, through the same `pack_state` path a real owner's reports take, and this
  hero's own packs fighting the made-up others too.

| Message | Way | Fields | What |
|---|---|---|---|
| `world_roster` | hub → client | + `packs: [{ id, owner, n, cleared }]` | the shard's packs someone woke or cleared; `owner` 0 once cleared |
| `pack_claim` | client → hub | `pack`, `x`, `z` | this screen woke the pack. → `pack_owner` (to the shard when it is this screen's now, to this screen alone when another's), `pack_cleared` (it is cleared), or `error` "No such pack on this floor" |
| `pack_owner` | hub → client | `pack`, `owner`, `n` | whose screen runs it (a shard id; 0: nobody, each screen has it to itself) and how many players it is set for |
| `pack_scale` | hub → shard | `pack`, `n` | the fight grew: set for `n` players |
| `pack_state` | client → hub | `packs: [{ id, x, z, ts, u, zn }]` | the owner's packs, ten times a second: `u` each unit (0 once fallen) as `[x, z, yaw, hp, max, walk, swing, pose, shots]`, `zn` red zones as `[unit, kind, a, b, c, d, e, t, impact]` (kind 0 a circle x, z, radius; 1 a line x1, z1, x2, z2, width) |
| `pack_state` | hub → members near | `packs: [{ id, n, x, z, ts, u, zn }]` | relayed to those within 60 m of each pack, clamped, with `n` |
| `pack_hit` | client → hub | `pack`, `u`, `dmg` | this screen hit unit `u` of a pack another screen runs (`dmg` before anyone's boons) |
| `pack_hit` | hub → owner | `pack`, `u`, `dmg`, `by` | for the owner to take off |
| `pack_hurt` | owner → hub | `pack`, `to`, `share`, `x`, `z`, `kind?`, `net?: { kind, s }` | the owner's pack struck player `to`'s hero |
| `pack_hurt` | hub → that player | `pack`, `share`, `x`, `z`, `kind`, `net`, `by` | for its screen to apply to its own hero |
| `pack_clear` | owner → hub | `pack` | its last unit fell |
| `pack_cleared` | hub → shard | `pack` | cleared (to everyone but the owner); also the answer to a claim of a cleared pack |
| `pack_release` | owner → hub | `pack` | it gave up and is home asleep: nobody runs it (`pack_owner` with owner 0) |
| `pack_respawn` | hub → shard | `pack` | back: whole, asleep at home, set for one |

Checked (2026-11-14): `npm run test:server` (the first to wake a pack runs it and the shard hears; a second who wakes it is told;
a pack id the floor does not have is refused; the fight counted when a second player comes within 20 m, and never counted down; the
owner's report reaches the member near the pack, clamped, and not one 150 m off; a non-owner's report and blow are dropped; a hit goes
to the owner with the hitter's id, 60 in a second cut to 40, a hit past 600 cut; the owner's blow goes to the hero it struck, its hold
cut to 3 s; the owner leaves and the pack goes to the member near it, still set for two; an owner quiet for 4 s is replaced; cleared,
told to a newcomer and to a claim; back after 3 minutes, not before, not while someone stands within 30 m, never alone in a shard;
alone, a quiet owner keeps its pack).
Two tabs on the dev server with local test accounts: [docs/tower/openworld/stage2/](../tower/openworld/stage2/) (the drift between the
two screens, the numbers, the hand-over, the respawn, pictures).

Speed (`perf.py scenes --scenes gen-2,gen-2-fight-3,gen-2-fight-7`, 1500 frames, this computer's card, 2026-11-15). `gen-2-fight-3`
and `-7` put three or seven made-up others in the hero's fight, each with three made-up packs of three fighting round the hero as copies
(the worst case: every pack within a few metres), and the hero's own packs fighting them all. Median frame (ms), draw calls:

| Profile | Alone | 3 others, 9 packs | 7 others, 21 packs |
|---|---|---|---|
| desktop | 12.1, 251 calls | 15.0, 424 calls | 22.2, 465 calls |
| phone-4x | 65.5 (39-43 in quieter runs) | 63.6 (52 in another run with this build) | 69.3 |

The first runs drew every copy (24, the raised cap) with its shadow: 778 draw calls, desktop 30 ms, phone-4x 71 and 86 ms. Hence the
budget of 6 copies with no shadow. The phone-4x numbers moved by 25 ms from run to run on the same build (the computer was busy), so they
say little beyond this: the floor alone already takes more than a frame there, and the copies, the others' figures and the fight's
work on every hero add about 170 to 215 draw calls, 1 to 2 ms of step on desktop. The duel and the raid play as before: `duel-temple`
prints 90b1abaa, as before the change; `raid-party` prints 34f75b29 instead of e83903c0, and so does the commit before this work with a
dead, never-called function added to src/net/world.ts: the raid scene's print follows how the code is loaded, not what this code does
(stage 1 saw it come out as one of two prints). (Since 2026-11-15 the perf tool's clock and dice make the print the same every run: raid-party 9c4a9c48; baseline `docs/perf/data/prints.json`.)

## The hero shop, raid ranks and the week's boards

Design, decisions and what was checked: [`pipeline/designs/hero-shop.md`](../../pipeline/designs/hero-shop.md). Pictures:
[`docs/shop/shop.html`](../shop/shop.html). The table of heroes, prices and the numbers is in `server/protocol.mjs` (`HERO_SHOP`,
`SHOP`, `shopRotation`, `RAID_RANKS`), read by the hub and the page.

- **One switch:** `createHub({ shop })`, on unless told otherwise. The hosts pass it on: `SHOP` in `wrangler.jsonc` (Cloudflare),
  the `SHOP` environment variable for `server/standalone.mjs` and the dev server (`SHOP=off`). Off, every hero is free, nothing is
  sold, and obols are still earned.
- **Who may play what** is the hub's to say: a hero must be owned (a starter, bought, or a founder's) or one of the week's six.
  `lobby_pick`, `queue_join` and `round_pick` answer `error` otherwise. The page draws locks from the same table and keeps a
  locked hero out of the fights it starts itself (the Raid alone, the Tower); the CPU duel is open with every hero.
- **Founders:** the first time a store is opened with the shop on, the hub writes the moment and the heroes there were into a
  small record beside the accounts. An account created before it owns all of those.
- **Obols** are paid only by the hub: at a duel's end (40, a win 40 more, the first win of the server's UTC day 120 more; nothing
  for a duel under 30 s or for whoever left it) and as a raid boss falls to two or more after 20 s or more (60 each, 150 more for
  a tier whose three bosses all counted). The player hears at once (`obols`).
- **Raid ranks** come from `raids.others`, the most such bosses in one run: Ember 1, Ash 3, Noon 6, Eclipse 9. The profile carries
  `rank`; so does each seat of a raid room and each row of the open raids.
- **The week's boards** (the ISO week in UTC, as the Tower's): the best raid runs with others (bosses, then time, the party's names),
  written when a run ends, and the highest Tower floors as each player's own page reported them (`tower_report`, **not verified**).
  The top 20 of each, kept with the accounts, empty again each Monday.
- **The profile** carries `obols`, `owned` (every hero while the shop is off), `founder`, `rank`, `tower` and `raids.others`.

## Leaderboards and clans (since PROTOCOL 17)

The user, 2026-11-14: "also make like online leaderboards", and "let's make like clans, groups, so that people can chat while being
in one clan". Pictures: [`docs/game/social/`](../game/social/README.md). The page's two screens are `src/game/social.ts` (Boards and
Clan in the bar); the hub's side is `server/hub.mjs` (the Leaderboards and clan sections), `server/clans.mjs` (the clans' rules and
what is kept), `server/filter.mjs` (the word filter) and `server/accounts.mjs` (the rating, the week's wins, the Climb). The numbers
are `ELO`, `LEADER_SIZE`, `CLIMB_FLOORS` and `CLAN` in `server/protocol.mjs`.

- **The duel rating:** Elo, 1000 to start, K 32, per account (`rating`, `rated`: the duels that moved it). A duel counts exactly
  as it pays: 30 s or more (`SHOP.minDuelS`); a shorter one moves nobody, and whoever left one that counts loses it. A counted duel
  also goes on the account's week (`duelWeek`). `match_end` carries `rating: { now, change }`; the profile carries `rating`.
- **The boards** (`leaderboards`, answered without an account too): the rating's top 50 (with all online wins and losses and the
  hero played most), the week's top 50 by counted wins, the Climb's all-time top 50 (the highest floor cleared, then the stars of all
  floors), the clans by their members' wins this week then their rating's average, and the week's Raid and Tower boards as they
  were (the Raid and Tower screens keep theirs). `tags` gives the clan tag of every name in the message; `you` the player's own
  rows with its rank on each (0: not listed), which the page shows under a list it is not on.
- **Cheap:** nothing scans every account on a request. The rated accounts are one list in rating order, built once when the hub
  starts and re-sorted when a duel counts; the week's wins and the Climb are kept lists of 50 (store records `duelweek`, `climb`), which
  stay right because each only grows (a new week starts `duelweek` empty); the clans' board adds up at most 30 members a clan. The
  shared part of the message is built once and kept until a duel counts, a Climb report lands or a clan's members change.
- **The Climb's board is the page's word,** as the Tower's is: `climb_report { floor, stars }` from a signed-in page (when a floor is
  cleared, at sign-in, on opening the Boards), read from the Climb's saves (`tower.world.stars`). The hub takes floors 1-50 and at
  most four stars a floor, each only upward; it pays nothing and the screen says so. The one line in `src/tower/world/game.ts` that
  says a floor was cleared is a `climb-cleared` event on the window.
- **A clan:** a name of 3-24 letters, digits and spaces, unique in any case; a tag of 2-4 letters or digits, also unique, shown as
  [TAG]; a leader (the founder) and up to 30 members; one clan a player. In by the invite code (6 characters; the leader can make a
  new one, and the old stops working), or by asking from the clan's page (`clan_ask`) and the leader's yes (`clan_answer`). The
  leader can remove a member, hand on the lead, and mute a member in the room for 24 h. A leader who leaves hands the lead to the
  member who has been in longest; the last one out ends the clan, and its name and tag are free again. Names and tags that hold a
  listed word are refused.
- **The clan chat:** signed-in members only, one room a clan, nothing outside a clan. A message is plain text on one line (control
  characters become spaces), at most 200 characters; the page puts every word in with `textContent`. At most one a second and 10 in
  20 s per sender (in the hub's memory); a refused one is answered `clan_error` with the reason and does not count. The listed words
  (`server/filter.mjs`, server only, a short list of slurs; it catches case, plurals and digits for letters) become `***`. Joins,
  leaves, removals, the lead and the leader's mutes are lines of the room too. The last 100 lines are kept in the store, so a reload
  or a deploy still shows them, and sent on `clan_get`.
- **Safety:** each player can mute anyone for itself (`clan_mute`), kept on its account (`mutes`): the hub sends it none of that
  name's messages, now or in the history. Report (`clan_report { n }`) writes the message with the clan, both names and the time to
  the hub's log (`REPORT clan "…"`), nothing more.
- **Presence:** the hub knows who is signed in; a member's sign-in and its last connection closing send the clan (`clan`) to its
  members online, with the dots. Only members are ever sent anything about a clan unasked.
- **Unread:** the page counts the messages from others newer than the last one it showed on the Clan screen (kept per account and
  clan in localStorage) and shows the count on the Clan tab. Messages still arrive during a fight; the count waits under the fight
  and nothing of the chat is drawn over a duel.
- **The open world:** `world_roster` and `world_joined` carry `tag` beside `name`; the page draws "[TAG] name" over the hero.
- **Stored** as the store's small records, so neither host changed: `clans` (the ids), `clan:<id>` (one clan: name, tag, leader,
  members, code, asks, the room mutes, the last line's number), `chat:<id>` (its last 100 lines); a clan that is gone has both written
  as null. Who is in which clan is worked out in memory when the hub starts. On Cloudflare that is the `meta` table of the Durable
  Object's SQLite storage; on Node the `meta` part of the JSON file.

| Message | Way | Fields | What |
|---|---|---|---|
| `leaderboards` | client → hub | | anyone, signed in or not → `leaderboards` |
| `leaderboards` | hub → client | `week`, `next`, `duels`, `weekly`, `climb`, `clans`, `raid`, `tower`, `tags`, `you` | every list (see above); `you` null when not signed in |
| `climb_report` | client → hub | `floor`, `stars` | the Climb's highest floor cleared and the stars of all floors; not verified, only upward, no answer |
| `clan_get` | client → hub | | → `clan`, and `clan_history` when in one; the page asks at sign-in and on opening the Clan screen |
| `clan` | hub → client | `clan` (or null), `mutes` | the player's clan as members see it: `id`, `name`, `tag`, `leader`, `max`, `created`, `wins`, `members: [{ name, rating, wins, online, role, silenced? }]`, and for the leader `code` and `asks`; sent again on every change and dot |
| `clan_history` | hub → client | `id`, `lines` | the room's kept lines, oldest first, without those of names this player muted |
| `clan_chat` | hub → members | `id`, `line` | a new line: `{ n, at, kind, name, text?, by? }`, `kind` one of `say`, `found`, `join`, `leave`, `remove`, `lead`, `silence`, `unsilence` |
| `clan_list` | client ↔ hub | → `clans: [{ id, name, tag, members, wins, rating, asked }]` | the clans with room, the most wins this week first (50 at most) |
| `clan_view` | client ↔ hub | `id` → `clan: { …row, leader, max, asked, list: [{ name, rating, role }] }` | a clan's page: no dots, no code |
| `clan_create` | client → hub | `name`, `tag` | → `clan` and `clan_history`, or `clan_error` |
| `clan_join` | client → hub | `code` | by the invite code (any case) → `clan`, or `clan_error`: no such code, full, already in a clan |
| `clan_ask` | client → hub | `id` | ask to join → `clan_notice`, and the leader's `clan` shows the ask |
| `clan_answer` | client → hub | `name`, `yes` | the leader only: let the asker in (it gets its `clan` at once) or not |
| `clan_leave` | client → hub | | → `clan` null; the members get a `leave` line (and `lead` when the leader left) |
| `clan_remove`, `clan_lead` | client → hub | `name` | the leader only; the removed player gets `clan` null and `clan_notice` |
| `clan_code` | client → hub | | the leader only: a new invite code |
| `clan_silence` | client → hub | `name`, `on` | the leader only: mute (or let speak) a member in the room for 24 h |
| `clan_say` | client → hub | `text` | → `clan_chat` to every member online (the sender too), or `clan_error` (too long, too fast, muted by the leader) |
| `clan_mute` | client → hub | `name`, `on` | this player's own mute of a name, kept on its account → `clan` with the new `mutes` |
| `clan_report` | client → hub | `n` | a message of the room to the hub's log → `clan_notice` |
| `clan_error`, `clan_notice` | hub → client | `error` / `text` | a refusal, or a word to the player |

## Rules version

Both screens work out arenas, hazards and parcels from the same seed with no server field, so a tab left open from an
older build would see different cover and events from its opponent. `PROTOCOL` in `server/protocol.mjs` is one number
read by the hub and the client; **raise it by hand in any deploy that changes those rules or the messages.** A deploy
drops every socket, and `NetClient` reconnects and sends `resume` with its `v`, so that is when an older tab finds out.

| A tab sends | The hub answers | The tab |
|---|---|---|
| a lower `v` | `update_required` | Stops reconnecting and shows a bar with a Reload button over everything. A CPU fight goes on underneath |
| no `v` (from before the check) | `auth_error` with the same text | Shows it on its login screen. Its token stays, so a reload signs it back in |
| the same or a higher `v` | as usual | A higher one is a page newer than a hub still restarting during a deploy, for a few seconds at most |

**Any other new build (since 2026-11-12).** A change that leaves the rules alone (a control, a menu) used to leave open tabs
on the old code: the reconnect after the deploy said nothing. Each build now has an id (`vite.config.ts`: `__BUILD__` in the
code, `/build.json` beside it). When the socket comes back after a drop, the game page reads `/build.json` (no cache); if it
names another build, the same bar shows "A new version of the game is out." with Reload. Nothing is stopped: the rules are
the same, so the tab keeps playing until the player reloads. `PROTOCOL` 15 was raised only to bring the tabs from before this
check onto it.

## Stats

Per account: `wins`, `losses`, `matches`, per-hero `{ played, wins }` and the last 20 matches (hero, `from` after a swap,
opponent and their hero, result, seconds, reason, round score `rounds`). **Favourite hero** = the most played (ties: more wins). A forfeit or a
disconnect counts as a loss for the leaver and a win for the other player.

## The ring: pillars, walls and line of sight

Each arena (AI duel and network duel alike) has its own cover, `ArenaDef.obstacles` in [src/arenas](../../src/arenas),
see [arenas.md](arenas.md). A round copies it to `arena.obstacles`, where walls fall and spells raise new ones. A trait
reads the live list with `t.cover()`, and the list the arena started with, the same on both screens, with `t.arenaCover()`.

Every obstacle is a capsule on the ground (segment + radius; a pillar has zero length). The arena gets them through
`arena.obstacles` (set by the duel's setup, cleared by `stop`):

- **Collision:** `arena.keepInside` pushes positions out of them (`pushOut`, body clearance 0.5), so walking,
  knockback and network positions all respect them. `arena.walk` and `arena.moveFoe(…, slide = true)` (the AI) turn
  the walk along an obstacle's edge instead of into it (`steer`: the part of the walk along the edge, and a kept side when pressing straight at it, see
  [mechanics.md](mechanics.md#walking-round-cover-navts)).
- **Line of sight:** `arena.lineOfSight(a, b)` is false when the segment a-b passes within 0.9 × an obstacle's radius
  (`blocksSight`). **A spell needs sight of its target to be cast**: an enemy spell needs sight of the enemy, a ground
  spell of the aimed spot; self spells need none. A line skillshot needs none either: it fires along its aim and
  cover stops it (a phone's tap with no drag follows the enemy into sight first). In hero mode a confirmed cast without sight shows "No line of
  sight" and becomes a pending cast: the hero walks toward the target and casts the moment it is in range *and* in
  sight. While aiming, the hover ring and the ground circle turn the blocked colour when the target is out of
  sight. The duel AI (and the autopilot) only picks targeted spells with sight, and closes in to half its usual
  distance while blocked so its strafe comes round the cover.
- Sight is checked when the spell is cast; a spell already on its way still lands by the usual zone rule (walking
  behind a pillar after the cast is not a dodge by itself). In a network match the caster's client checks sight;
  the receiving client trusts the relayed cast.

## Cloudflare

Cloudflare Pages alone only serves static files, so the game is published as a **Worker with static assets and a
Durable Object** (the same Workers product family; the free plan covers SQLite-backed Durable Objects within its
daily limits, check Cloudflare's pricing page):

| Piece | What it does |
|---|---|
| Worker `arena-of-kits` (`worker/index.mjs`) | `/` redirects to `/game.html` (the game is the front page; the editor stays at `/index.html`); `/ws` goes to the hub; every other path is a file from `dist/` (`assets.run_worker_first: ["/ws", "/"]`) |
| Durable Object `GameHub` | one instance (`idFromName('main')`) so every player meets in one place; runs `createHub` from `server/hub.mjs`; WebSockets with `accept()` (no hibernation: the object stays in memory while players are connected) |
| Storage | table `accounts (key, json)` in the object's SQLite storage; loaded once when the object starts, one row written per change. Table `meta (key, json)` (made on first start if it is not there): the day the hero shop arrived, the week's boards, and since PROTOCOL 17 the duel and Climb boards, the clans and their rooms. The Node server keeps the same two under `users` and `meta` in its JSON file |
| `SHOP` (`vars` in `wrangler.jsonc`) | "on": heroes are locked behind the shop. "off": every hero is free |
| Lost on eviction | sessions (players log in again), open lobbies and the queue; a running match keeps the object alive |

Deploy (once per machine: a free Cloudflare account and `npx wrangler login` in a browser):

```
npm run cf:deploy
```

It builds (`tsc` + Vite), uploads `dist/` and the Worker, and prints the address
(`https://arena-of-kits.<account>.workers.dev`). A custom domain is added in the Cloudflare dashboard.
`npm run cf:dev` runs the same setup locally on 8788 (state in `.wrangler/`, git-ignored).

Verified locally (2026-10-29, wrangler 4.150.0): the smoke test's 20 checks against `ws://localhost:8788/ws`; a two-tab
queue match (Isolde vs Brannoc, 24.6 s) with stats on both sides; accounts and stats still there after a restart.
Not yet deployed.

Verified locally again for the hero shop (2026-11-12, `wrangler dev` on its own port and store): a purchase, the obols and a
board row still there after the worker was stopped and started; an account made with `SHOP` "off" is a founder once the same
store is opened with it on. Against a running worker the smoke test plays everything but the shop's cases, and needs `SHOP`
"off" (`npx wrangler dev --var SHOP:off`), since its accounts are new and play any hero. The live worker has not had this build.

## Smooth movement

The round trip to the Cloudflare server is about 35 ms (measured from Vienna, 2026-10-30), so the lag a player
feels is in how the opponent is drawn, not in the connection. `move` carries `ts`, the sender's
`performance.now()`, and the server passes it on in `peer_move`. `Duel.peerMove` puts every report on this side's
clock (the offset is the smallest `now - ts` seen, the quickest delivery) in a short track; `Duel.netFollow` draws
the figure `PEER_DELAY` = 100 ms in the past, between the two reports around that moment, and turns it by the
shorter way. Past the newest report it holds still rather than guessing. A sender that stands still sends nothing,
so a gap over 120 ms is filled with a copy of the old spot just before the new report, and the figure does not
glide across the pause. Without `ts` (an older server) the arrival time is used instead.

Before this the figure eased toward the newest report at 15 Hz: it moved in small steps and jumped forward on
every cast. Measured with a scripted opponent walking at up to 4.5 m/s through 120 ms ± 40 ms of test lag each way,
the frame-to-frame change in its speed dropped from 1.42 to 0.54 m/s (RMS), and a cast moved it by 0.035 m instead of
snapping it to the cast spot.

Test lag: `game.html?lag=120&jitter=40` holds every message that long in each direction, in order (`NetClient`).
Off by default.

## Background tabs

`requestAnimationFrame` stops in a background tab (and in a hidden browser pane), which would freeze that player's
spells before impact, so they would never report a hit. The game's runtime (`background: true`) steps the simulation from a 100 ms
timer whenever no frame came for 250 ms, in 1/30 s substeps of the real time that passed (browsers slow
background timers to about once a second, so a hidden tab catches up in bigger batches).

The same slowdown hits the 20 Hz `move` timer: the other player sees a hidden tab's hero jump about once a second.
That cannot be fixed from the page, so the match shows a toast when its tab is hidden: play in two windows side by
side, not two tabs of one window.

## Verified (2026-10-29)

- `npm run test:server`: 20 checks pass.
- Built page on the standalone server, two tabs of the built-in browser, real input events through hero mode's
  own listeners: queue pairing (Lyra vs Vex, 22.6 s, the winner's and loser's cards and stats), lobby create / join
  from the list / taken hero greyed / ready (Isolde vs Lyra in the ring with cover, 24.5 s), a dodge shown on both
  screens, a hit's knockback replicated, a forfeit by disconnect when a tab reloads, session resume after reload,
  Back to menu and the profile.
- Line of sight in the editor's duel: Q at a foe behind the centre wall and behind a pillar is refused with the
  toast, the hero slides round and casts once in sight (wall 1 s, pillar 0.3 s); AI duels still finish (17-24 s).

## Mechanics online

Since 2026-10-30 the kits' mechanics work in network duels, on the same rule as the hits: **the client whose hero
takes an effect decides it**, and the server records and relays.

| Mechanic | How |
|---|---|
| Statuses (stun, root, slow, silence, blind, knock-up) | applied to this side's hero by the hit (`Duel.damagePlayer`), enforced here; `status` → `peer_status` draws the word and tint on the other screen. Blind on the other hero rolls its miss here, from that relayed status. |
| Knockback, pull | move this side's hero; the move reports carry the new spot. |
| Shields | the hero's own shield soaks here (`arena.absorb`); `took_hit` sends what got through and what was soaked; `shield` → `peer_shield` draws the bubble on the other screen, which takes `soaked` from it and drops it when damage got through. |
| Heals | `arena.casterHeal` → `heal`; the server adds it within its caps and answers `hp` / `peer_heal`. |
| Dashes, blinks | the caster's own client moves it; the other screen sees it through the move reports. |
| Skillshots | the other player's bolts fly on this screen (`ctx.projectile` stays on in the replay); touching this hero is the hit. |
| Spells fired where the hero faces (`self` mode) | `cast.yaw` turns the replayed caster before the spell plays. |
| Arena events and stages | both clients run the same schedule from `<match id>-<round>` on a clock that starts at FIGHT. Each client decides the hits on its own hero and units; the hero's damage goes out as `hazard`. Two tabs with bots agree on HP through Last stand; two real people have not tried it. |
| Summoned units | the other player's units spawn and fight on this screen; their hits on this hero go through `took_hit` with the summoning cast's id. Each screen simulates its own copy, so units can stand in different places or die at different times on the two screens. |
| Basic attacks | see [attacks.md](attacks.md). Echo (Lyra) is folded into one hit; reach (Zephyr) is local. |
| Units from a trait (`TraitView.summon`) | only this player's own passive raises units, on its own screen; the other screen does not see them (a spell's units are replayed through the cast there) and `hitFilter` drops their hits on the other hero, so online they hit the pack only: they do no damage to the other hero. The other side's `summon` is a no-op here. `deathSpots` only know units this screen simulates. |
| Hold-to-charge | the charge becomes `mods.power` in the cast message, like any trait mod. |
| Recast that only acts (`replay: false`) | sends no cast: it moves the hero (a blink, a rewind), which streams as moves. A jump over 4 m between two move reports snaps on the other screen (`PEER_JUMP`) instead of gliding. |
| Skillshot that pulls (`pull` on a bolt hit) | the bolt flies on the victim's screen, the hit carries `from` = the bolt's start, and `damagePlayer` drags the hero toward it (4 m at most). The caster's screen only draws the result through the victim's moves. |
| Carry (`ctx.carry`) | applied by the victim's client when the replayed cast calls it; on the caster's screen `arena.remoteFigure` (the other hero) is left alone and follows its streamed position. The effect must judge the catch with the live position of the target. |
| Arc aim | `cast.bend` (clamped to +-1.5 rad by the server, optional) rides with the cast; both screens fly the same arc. An older server drops the field and the replay flies straight. |
| Temporary walls | both screens build the wall from the cast (`ctx.sentFrom`, `ctx.point`) and time it out on their own clocks; the replay's `from` is not used for the geometry. A new round clears them. |

Tested with two local players (2026-10-30): a Lyra bolt into Auriel's shield (28 through, 25 soaked), Lyra's root
trap and basic attack, Marin's hook pulling Fenna 3 m, Fenna's heal on hit and her turret hitting Marin 4 times.

## Limits and next steps

- Not cheat-proof (see *Trust*); no reconnect into a running match (a reload forfeits).
- Several servers on one data file (two dev ports, the standalone server) write one account at a time; the last
  write wins per account, and sessions and lobbies are per server (both players must use the same one).
- One match per player at a time; no spectators, no rematch button (back to the menu, queue again).
- Mirror matches need a second effect instance per spell label (`castAs` in runtime.ts).
- Projectiles fly through pillars visually; sight is only checked at the cast.
- Pillars can hide a hero from the high camera when it stands right behind one (no see-through fade yet).
- The other session's duel balance numbers predate the cover; re-run its tournament with the obstacles in.

## See also

- [Hero mode and the duel](hero-mode.md)
- [Targeting and arena](targeting-and-arena.md)
- [Using the tool](../guide/using-the-tool.md)
- [Docs home](../README.md)
