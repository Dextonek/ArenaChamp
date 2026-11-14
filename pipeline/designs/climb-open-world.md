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
