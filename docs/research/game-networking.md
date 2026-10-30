# How networking works in real-time games, and where Arena of Kits should go

Research from 2026-10-30. The question: how real games keep two or more players in sync, how that compares with
Arena of Kits, and what to change next. Sources are linked inline. **[memory]** marks claims no fetched page
confirmed this session (the Valve wiki, the GDC talks and the Age of Empires paper could not be fetched).

## Where Arena of Kits is today

- **Connection:** one WebSocket (TCP) per player to one Cloudflare Durable Object; round trip about 34 ms (from Vienna).
- **Server:** a referee and relay. It handles accounts, matchmaking, HP, the winner and stats.
- **Movement:** each client moves its own hero and sends its position 20 times a second with its own clock. The
  other client draws that hero 100 ms in the past, between two reports ([Smooth movement](../architecture/multiplayer.md#smooth-movement)).
- **Spells:** casts are relayed and replayed on the other client. The *victim's* client decides whether it was hit
  and reports `took_hit`; the server subtracts HP.
- **Not synced yet:** shields, statuses, summons and skillshot projectiles.
- **Not cheat-proof:** a modified client can move anywhere or never report a hit.

## The four main models

| Model | How it works | Used by | Fit for us |
|---|---|---|---|
| **Deterministic lockstep** | Only inputs travel; every machine runs the same exact simulation and waits for everyone's inputs for each turn | RTS (Age of Empires, "1500 Archers on a 28.8", GDC 2001 **[memory]**) | Poor. Every action is delayed, the slowest player paces the game, and 20 kits with random elements would have to be bit-exact |
| **Authoritative server + prediction + interpolation** | Clients send inputs; the server simulates and decides. Your own hero is predicted at once and corrected (reconciled) when the server answers; other entities are drawn slightly in the past | Source games, Overwatch, Battlerite, most shooters | **The target.** Real fairness and anti-cheat |
| **Rollback** | Each peer guesses the other's input ("same as last time"), and when the real input differs it rewinds and replays | Fighting games (GGPO **[memory]**) | Possible for 1v1, but the whole simulation must be deterministic and cheap to replay. Too costly with summons, statuses and 20 kits |
| **Lag compensation (rewind)** | The server rewinds the targets to where the attacker saw them, then tests the hit ("favour the shooter") | Valve's Source games | Useful later, inside the authoritative model |

Client prediction and reconciliation in detail ([Gambetta](https://www.gabrielgambetta.com/client-side-prediction-server-reconciliation.html)):
1. The client numbers every input and applies it at once.
2. The client keeps every input the server hasn't confirmed yet.
3. Each server state says which input it has processed up to.
4. The client takes the server state, drops the confirmed inputs and replays the rest on top.

## Numbers from real games

| Game | Server tick | Updates to clients | Interpolation delay | Source |
|---|---|---|---|---|
| Source engine (default) | 66/s | 20/s | 100 ms | [Valve wiki](https://developer.valvesoftware.com/wiki/Source_Multiplayer_Networking) (search excerpt) |
| Overwatch | 60 Hz after an update (was 21 Hz on PC) | 60 Hz | about 60 ms, then about 20 ms | [GamesBeat](https://gamesbeat.com/overwatch-netcode-tick-rate-60hz/), [GDC 2017 talk](https://gdcvault.com/play/1024001) |
| VALORANT | 128 | — | — | [PC Gamer](https://www.pcgamer.com/valorant-peekers-advantage-interview) |
| Dota 2 | 30/s reported **[memory]** | — | — | third-party tables only |
| **Arena of Kits** | no simulation on the server | 20/s (relayed) | 100 ms | this repo |

Our 20 updates a second and 100 ms delay match Valve's defaults.

## How MOBAs handle it

- **Battlerite** (the closest relative, [Stunlock dev blog 008](https://blog.stunlock.com/dev-blog-008/)): the
  server decides movement, casts and projectile hits. The client predicts its own movement and sends movement
  commands; the server checks them and sends valid positions to the others. When they disagree, the client is
  pulled toward the server's position.
- **Dota 2**: reportedly no client prediction for movement beyond showing the move-order arrow at once **[memory,
  secondary]**. Click-to-move waits a full round trip, and the game accepts that.
- **League of Legends**: Riot's engineering posts cover making the server replayable by recording its inputs,
  because making the whole server deterministic wasn't feasible ([Riot tech blog 68](https://technology.riotgames.com/node/68),
  [73](https://technology.riotgames.com/node/73)). Riot Direct is their private network to cut ping. No primary
  source on how LoL hides movement lag.
- **Heroes of the Storm, Pokémon Unite**: no primary sources found.

## Hits, statuses, summons

- **Favour the shooter** (Valve): the attacker's view wins. The victim is sometimes hit "behind cover".
- **Favour the victim** (us): it feels fair to the victim, because a spell you dodged on your screen never hits you.
  But the attacker sees spells pass through, and a cheater can simply never report a hit.
- **Skillshots:** the usual pattern is a server-owned projectile with an id (start time, origin, direction, speed).
  Its position is a function of time, so every client draws it locally and only the server tests collisions.
- **Dashes and knockbacks:** server-applied "movement effects" (start, direction, distance, duration) that every
  client replays; the server's position wins.
- **Statuses** (stun, root): the server applies them with a start time and duration and tells both clients.
  **[memory]**: general practice, no citation.
- **Summons and shields:** summons are server-owned entities with ids (spawn and despawn events plus their state
  in regular updates). A shield is part of the hero's server state, next to HP. Without that, each screen shows
  different HP.

## Transport: is a WebSocket good enough?

- TCP (and so a WebSocket) delivers in order. A single lost packet holds back everything behind it until it is
  resent ([Gaffer on Games, UDP vs TCP](https://gafferongames.com/post/udp_vs_tcp/)). Browsers can't send raw UDP
  ([Gaffer on Games](https://gafferongames.com/post/why_cant_i_send_udp_packets_from_a_browser/)).
- For a 1v1 with small messages, 20 a second and a 34 ms round trip, TCP is acceptable. On a bad mobile connection a
  lost packet shows as a freeze of maybe 100-300 ms, then a catch-up. Sending whole positions (not deltas) lets the
  client skip stale ones.
- The UDP-like browser options are WebRTC data channels (need signalling and STUN/TURN; a Durable Object can't
  easily be the other end **[memory]**) and WebTransport (not supported everywhere). Not worth it until players
  complain about freezes.

## Cloudflare Durable Objects as a game server

From the official docs ([limits](https://developers.cloudflare.com/durable-objects/platform/limits/),
[WebSockets](https://developers.cloudflare.com/durable-objects/best-practices/websockets/),
[alarms](https://developers.cloudflare.com/durable-objects/api/alarms/)):
- **Requests:** a soft limit of 1,000 a second per object. Two players at 20 a second each way is far below it.
- **CPU:** 30 s per request by default for SQLite-backed objects, configurable up to 5 minutes.
- **A game loop:** a `setInterval` loop keeps the object awake (no hibernation), which is fine for a 20-25 s match.
  The docs suggest batching updates every 50-100 ms. How evenly such a timer fires isn't documented, so measure it
  first.
- **Alarms:** don't use them for a 20-60 Hz loop. There is one alarm per object, retries on failure, and no
  documented timing precision.
- **Deploys:** a deploy disconnects every WebSocket, which ends any running match.

## Libraries

All from memory; check before adopting. **Colyseus** (authoritative rooms with state sync, runs on Node, not on
Workers), **Geckos.io** (WebRTC data channels for Node), **Lance.gg** (prediction plus an authoritative server;
maintenance unclear), **netplayjs** (rollback or lockstep for 2-player browser games, needs a deterministic sim).
None runs as-is inside a Durable Object. Our own hub is already the right shape.

## Recommended path

**Stage 1: harden the relay (1-3 days, low risk)**
- **Status sync:** relay shields, statuses and summons as events with ids, plus a full-state "keyframe" two to five
  times a second (HP, shield, statuses, live summons), so a missed event heals itself. This also closes the online
  gaps listed in [STATUS](../STATUS.md) for hero waves 3-5.
- **Plausibility checks on the server:**
  - casts must respect cooldowns;
  - positions can't move faster than the walk speed (plus dashes);
  - damage is capped per spell;
  - `took_hit` is only accepted for a spell the server saw cast, within a time window.
- **Shared clock:** use the server's clock for both players (ping/pong). Today each receiver maps the sender's clock
  separately, which works but can't be compared across events.
- **What it fixes:** desyncs and casual cheating.
- **What remains:** a client can still refuse to report hits.

**Stage 2: the server owns projectiles, HP and statuses (1-3 weeks, medium risk)**
- The Durable Object runs a 20-30 Hz loop during a match and owns projectiles, area hits, summons, HP, shields and
  statuses. Clients still move their own hero (Battlerite-style, the server clamps speed) and draw projectiles from
  their spawn data.
- Hits are decided on the server, with a short rewind (100-200 ms) so a dodge on the victim's screen still counts.
- This needs the projectile motion and hit shapes as shared TypeScript the server can run. Migrate by category:
  projectiles, then areas, then summons and statuses.
- Measure the Durable Object's timer evenness first.

**Stage 3: fully authoritative (1-3 months, high risk)**
- The server runs the whole fight at a fixed tick (for example 30 Hz); clients send only inputs.
- Your own hero is predicted and reconciled; everything else is interpolated.
- Dashes and knockbacks live in the shared simulation.
- This needs the engine split into a headless simulation and the renderer, and all 20 kits turned into event streams.
- It enables spectating and replays.

**Recommendation:** Stage 1 now; it is also how the online sync of the new mechanics should be built. Then Stage 2
for projectiles and statuses, where desyncs and cheating matter most. Stage 3 only if cheating or fairness
complaints appear. Not rollback or lockstep.

## Gaps

Not fetched this session: "1500 Archers", GGPO, the Valve wiki page itself (search excerpts only), the Overwatch
GDC talk. No primary source for LoL's tick rate, Dota's 30 Hz, Heroes of the Storm or Pokémon Unite. Library and
WebRTC/WebTransport-on-Cloudflare statements are from memory.

## See also

- [MOBA design research](moba-design.md): the other half of this research
- [Multiplayer duel game](../architecture/multiplayer.md): our server, protocol and smooth movement
