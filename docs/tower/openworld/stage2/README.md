# The Climb's open world, stage 2: the two-tab test (2026-11-15, on the final build)

Two real tabs (two separate browser sessions in headless Chrome) on the local dev server, each signed in with its own local test
account read by the page from the git-ignored `server/data/test-accounts.local.json`: climber1 as Lyra (screen A) and climber2 as
Kaia (screen B), both on floor 2 in shard 2.1. The heroes fought with the game's autopilot. Every number below is in `run.json`.
How it works: [docs/architecture/multiplayer.md](../../../architecture/multiplayer.md), "The Climb's open world, stage 2".

| Picture | What it shows |
|---|---|
| `a-owner-fight.jpg`, `b-copy-fight.jpg` | The same moment on both screens: the net market's pack (two dockers, a netter, a crab) as A runs it and as B draws it, the same health on every bar |
| `a-owner-red-zone.jpg`, `b-copy-red-zone.jpg` | The crab's slam: its red circle filling at the same spot on both screens. A's red line on B's screen is the netter's charge |
| `a-after-clear.jpg`, `b-after-clear.jpg` | The pack cleared: both quest lines say "Light the north light and the signal fire", the step after "Clear the net market" |
| `b-before-owner-left.jpg`, `b-took-over.jpg` | B's screen in the broken galley's fight, before and 2.5 s after A's tab was closed: B runs the pack now, the units where they were, their health as it was |
| `a-respawned.jpg`, `b-respawned.jpg` | Three minutes after the net market was cleared, with nobody within 30 m: it is back, asleep at home, whole, on both screens |

## What was checked
- **One pack, the same units.** A woke the net market's pack and runs it; B was told and draws it. Unit places sampled ten times a
  second on both screens (on the same wall clock) and laid over each other:

  | Fight | Samples | Raw distance (median / p95 / largest) | Shifted by the 100 ms the copies are drawn late |
  |---|---|---|---|
  | The net market (4 units, 4.4 s) | 128 | 0.00 / 0.09 / 0.27 m | 0.00 / 0.03 / 0.05 m |
  | The broken galley (5 units, 4 s) | 170 | 0.17 / 0.36 / 0.45 m | 0.02 / 0.07 / 0.13 m |

  So a copy stands where the owner had it 100 ms before, to a few centimetres; the raw gap is a walk of 100 ms.
- **Tougher with two.** A alone when it woke: docker 71, netter 50, crab 171 health, blows x1. B walked within 20 m: the hub set it
  for two and both screens showed docker 113, netter 81, crab 274 (x1.6), blows x1.15.
- **Hits and blows.** B's 12 hits went to A's screen through the hub and came off there; A's pack struck B nine times (B's screen took
  them on its own hero: 25% of its health in all, 580 to 435).
- **The kill on both quests.** Both had the main quest's first step, "Clear the net market". A counted 3 kills, B 4 (each hit the units
  it counted in their last 10 s); the pack is in both runs' cleared packs and both quests went on to the next step.
- **The owner's tab closes mid-fight.** B's screen ran the galley's pack 322 ms after the tab closed. The largest step of any unit
  between two samples around the change was 0.37 m (the same as the largest in the copy's own walk before it); the units kept their
  health (crab 246 before, 96 of 274 when the fight went on, never back to full) and the pack stayed set for two. B cleared it.
- **Back after three minutes.** A came back (a new tab): the hub told it the net market was cleared. 180.1 s after it was cleared,
  with both 80 m away, it came back on both screens at once, whole and set for one again.
- **Not signed in** the Climb plays as before. On the game page (a third tab, no login, floor 2, the pack at f with the autopilot) the
  pack stayed this screen's own the whole fight, set for one, the summon cap 6, nothing sent; it was cleared and counted (3 kills). The
  route bot (the tool page: no link, no share) on floors 1, 11 and 41 clears each with four stars (it varies from run to run with the
  same code, so times differ by up to a minute), and `perf.py` plays the same `gen-2` and `duel-temple` fights.
- No clip was made; the pictures are stills.
