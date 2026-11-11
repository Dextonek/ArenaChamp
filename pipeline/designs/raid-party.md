---
title: The Raid for up to 40 players
tags: [raid, online, design]
updated: 2026-11-11
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

## State (2026-11-11)

- Not started in code. The Heart of Noon is being built by a helper in its own worktree (its `PROTOCOL` 6 -> 7 is only there; main
  carries omens and side doors at 6, so one bump must be on main before any deploy).
- The friend brackets' server half was moved out of the working tree into `git stash` ("friend brackets: server half"), so the hub
  can be rebuilt for parties. Popping it later will conflict with the party hub.
- Not verified yet: the side doors for two were run only on the server; the Shrine's room was not looked at in the browser.
