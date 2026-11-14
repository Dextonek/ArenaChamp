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
| `a-sees-b-fallen.jpg` | Kaia's screen: Lyra has fallen (her own screen took a blow worth twice her health) and lies where she fell; 3 s later she stands at her camp again on both screens |
| `phone-seven-others.jpg` | A phone-size tab (844 x 390, not signed in) with `?others=7`: seven made-up others round Kaia, the nearest three as full figures (Guest 1, 6, 7), the rest as slim stand-ins in their hero's colour, each with its name; the panel says "7 others on this floor" |

Also checked on the two tabs: Lyra's connection closed by hand: Kaia's screen dropped her at once and had her back 0.4 s later
(the page reconnects, resumes and joins again). Walking in a window that is shown, Lyra is drawn 0.4 m behind where her own
screen has her (100 ms at her pace), with about 8 walks a second sent; with her tab behind another tab, the browser lets it send
about once a second, and she moves in steps on Kaia's screen.
