# The Climb's open world, stage 1: the two-tab test (2026-11-14)

Three tabs on the local dev server, each signed in with its own local test account (read by the page from the git-ignored
`server/data/test-accounts.local.json`): climber1 as Kaia on floor 2, climber2 as Lyra on floor 2, climber3 as Sefu on floor 3.
How it works: [docs/architecture/multiplayer.md](../../../architecture/multiplayer.md), "The Climb's open world, stage 1".

| Picture | What it shows |
|---|---|
| `a-sees-b-walk.jpg` | Kaia's screen: Lyra walks past the camp with "climber2" over her head; the panel says "1 other on this floor" |
| `b-sees-a.jpg` | Lyra's screen: Kaia stands by the fire with "climber1" over her head |
| `a-sees-b-cast-0.jpg` | Kaia's screen: Lyra's Starfall Arrow plays from her figure (the look only: Kaia's health stays full) |
| `b-sees-a-cast.jpg` | Lyra's screen: Kaia's Sky Strike comes down where Kaia aimed it, on Lyra's spot; Lyra's health stays 520 / 520 |
| `c-floor3-alone.jpg` | Sefu on floor 3 (Gull Point): nobody else drawn, "No one else on this floor yet" |
| `a-after-b-left.jpg` | Kaia's screen after Lyra pressed Leave: she is gone and the line says "No one else on this floor yet" |

