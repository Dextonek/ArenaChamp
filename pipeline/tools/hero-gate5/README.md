# Gate 5 tools, as used for Anka (hero 40)

The checks of gate 5 that have no tool elsewhere (docs/pipeline/new-hero.md, "Gate 5: plays"). Written for Anka on
2026-11-11 and kept as they ran: the hero names are constants in the files and the samplers read her embers. For the
next hero, copy and change what is hers.

| File | What it does |
|---|---|
| `cpu_duel.py` | A CPU duel through the game page's own menus at 1280x800 and on a phone screen with touch: pick, fight, rematch, then as the CPU's hero. `drive.js` is the hand on the hero |
| `online.py`, `read_online.py` | Two screens online with bots, each screen's view of her floor things read ten times a second and compared. `strafe`: the enemy keeps away and sidesteps |
| `raid-second-life.js` | The raid tool's loop with her embers and her passive read every step, then five cases by hand |
| `raid-cases.js` | A boss's `lethal` hit, a hit in the egg, Blood Pact, Stubborn and Phoenix Heart, given inside the game's own frame |
| `one-screen-embers.js`, `one-screen-embers-raid.js` | CPU duels and raid fights: count the embers that move after they were laid (none must: the message that tells a quill's true end is for the other screen only) |
| `srv.py` | The dev server on 5193 for the two Python tools: started and stopped by them |

The `.js` files (but `drive.js`) are bodies of an async function for the tool page:
`python pipeline/tools/page-shots.py pipeline/tools/hero-gate5/raid-cases.js <out folder> --json cases.json --port 5192`.

Needs `pip install playwright` and Google Chrome. Everything the Python tools write goes to `pipeline/sim/out/gate5/`
(git-ignored). Each run ends by itself: `cpu_duel.py` within 10 minutes a size, `online.py` within 9.
