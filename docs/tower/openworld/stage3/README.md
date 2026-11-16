# The Climb's open world, stage 3: the two-tab test (2026-11-16, on the final build)

Two real tabs (two separate headless Chrome sessions) on the local dev server, each signed in with a new throwaway account made in the
page (its password made by `crypto.randomUUID()` in the page and never printed; the accounts are in the git-ignored `server/data/`):
A as Kaia, B as Lyra. Both heroes fought with the game's autopilot. Run again with
`python -I pipeline/tools/climb-doors-two.py docs/tower/openworld/stage3 --port 5267`; every number below is in `run.json`.
How it works: [docs/architecture/multiplayer.md](../../../architecture/multiplayer.md), "The Climb's open world, stage 3".

| Picture | What it shows |
|---|---|
| `a-door-held.jpg`, `b-invited.jpg` | Floor 1: A walked into the Drowned Captain's lair with B 5 m off. A's line: "held for others near, 6 s", and the Go in now button; B's line: "… waits at The Drowned Captain's lair: walk in within 6 s to fight beside them" |
| `a-fight-zone.jpg`, `b-fight-zone.jpg` | The fight on both screens at the same moment: the same ruler where it stands, both heroes, both bars in the party list |
| `a-fight.jpg`, `b-fight.jpg` | A few seconds later |
| `b-down.jpg`, `a-partner-down.jpg` | B's hero struck down: it lies with its gold ring ("stand here") on A's screen, 0 / 520 in the party list |
| `b-revived.jpg` | A's autopilot walked over and stood by it: B is up again with half its health |
| `b-runs-brain.jpg` | A's tab frozen for 5.5 s (as a tab put away): B's screen runs the ruler now |
| `a-ruler-falls.jpg`, `b-ruler-falls.jpg` | The ruler falls: both are back on the floor, "its ruler falls, the gate up is unsealed" on both |
| `a-out-together.jpg`, `b-out-together.jpg` | Both in front of the lair's door, side by side, in shard 1.1, each sees the other ("1 other on this floor") |
| `run2-a-door-held.jpg`, `run2-b-invited.jpg` | Floor 2, the Drowned Admiral's lair, the same way in |
| `b-before-a-closes.jpg`, `b-took-over.jpg` | B's screen in the fight before and 3 s after A's tab (the brain's) was closed: B runs the Admiral alone |
| `b-out-alone.jpg` | B back on floor 2 after winning alone |
| `drop-a-fight.jpg`, `drop-b-fight.jpg`, `drop-a-out.jpg`, `drop-b-out.jpg` | Floor 3 (`--drop`): both connections dropped mid-fight (as a deploy drops them): both back in front of the Salt King's door, "Nothing counted for you", three lives each |

## What was checked
- **Into the door together.** A walked in: the door was held (B was within 30 m) and B was invited. B walked in: nobody else was near,
  so the fight started at once for both, A's screen running the brain. Both screens were in the fight, loaded and past the countdown
  4.1 s after B walked in. The ruler was set for two: 4900 health (2800 x 1.75), gauge 175, blows x1.15.
- **Both screens agree** (sampled ten times a second on each, on the same wall clock, 120 pairs before the freeze, 78 after it):

  | | median | p95 | largest |
  |---|---|---|---|
  | The ruler on the follower's screen against the brain's, raw | 0.00 m | 0.28 m | 3.9 m (a lunge) |
  | … against where the brain had it 100 ms before (the play-back delay) | 0.00 m | 0.05 m | 1.25 m |
  | Each hero as the other draws it, against its own screen, 100 ms before | 0.00 m | 0.35 m | 0.98 m |
  | The ruler's health on the two screens (share of its health) | 0 | 0.001 | 0.013 |

  After the brain moved to B (the freeze), the same: the ruler within 0.04 m p95, heroes within 0.11 m p95. The ruler's casts: 10 on A's
  screen, 10 on B's, 9 of them the same casts on both (the samples begin a moment apart). The largest gaps are a fast move (the ruler's
  lunge, a hero's dash) caught between two reports.
- **Both hit it.** Their own screens' hits on the ruler: A 604, B 762 (the test then added damage through the hub on both screens to end
  the fight in a few seconds).
- **A fall and a revive.** B's hero was struck down; A's autopilot went to it and stood by it: B was up 4.3 s later with half its health.
- **The brain hand-over.** A's page frozen for 5.5 s: the hub gave the brain to B 4.7 s after (it waits 4 s of silence); A's screen
  followed again when it woke. A's tab closed mid-fight (run 2): B ran the brain 0.37 s later; the Admiral's largest step between two
  samples around the change was 0.27 m (0.24 m before it); B won alone.
- **The clear counts for both, and they come out together.** The ruler fell 8.6 s after the added damage began. Both runs: the lair won,
  40 shards, "piece ruler won (with others)" in the log; both back on floor 1 in shard 1.1, side by side in front of the door
  (1.6 m apart), each seeing the other. Run 2: B won alone after A left, and it counted for B.
- **A dropped connection** (`--drop`, floor 3, `drop.json`): both pages' sockets closed 6 s into the fight. Both came out in front of
  the door at once, side by side, with nothing counted (no win, no shards, three lives still); the page signed in again by itself and
  both were back in shard 3.1, each seeing the other.
- No errors on either page.
- **Alone as before.** The route bot (the tool page, not signed in: no link) clears floors 1, 11, 21, 31 and 41 (stars 1-1-0-1, 4, 4,
  1-1-0-1, 4; the bot's own luck). `perf.py` plays the same fights as the baseline: duel-temple 90b1abaa, raid-party 9c4a9c48, raid-solo
  ff20c830, world-1 d862aa08 (`docs/perf/data/stage3.json`).
- The server's side: `npm run test:server`, 364 checks, the doors' 35 among them (multiplayer.md lists them).
- Not checked here: three or more people in one door (the server tests cover a party of three), a guarded or still ruler (floors 11,
  41), a phone, a person's hands. A crown floor's lair is played alone (not shared).
