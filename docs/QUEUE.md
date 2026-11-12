# The night's queue (2026-11-12)

The user, going to sleep: "yes go it ques it and make improvmnet ... dont ask just do it run the loop until everything is done ...
i want to see it tomorow morning done". **No questions until morning: decide, build, measure, merge, go on.** Not allowed without
the user's word, even so: `git push`, a deploy. Everything stays committed on `feat/particle-editor`, not live.

How the loop runs: at most three helpers at once (the user's rule), each in its own worktree; when one reports, merge its branch
(resolve conflicts, `npx tsc --noEmit -p .`, `npm run build`, `npm run test:server`, the raid checks), tick it off here, start the
next job whose files are free. One writer at a time on `src/duel.ts`, `src/heroMode.ts`, `src/arena.ts`, `src/main.ts`,
`server/hub.mjs`. Each helper's brief names its port (5194 upward; 5181 is the main checkout's).

## Jobs

| # | Job | Needs first | Files it owns | State |
|---|---|---|---|---|
| 1 | Twin Flames: Ash and Ember for a party | | `ashEmber.ts`, `duel.ts`, `hub.mjs` | **done, merged** (PROTOCOL 9; all checks pass) |
| 2 | The Heart's party boss room | | `heart.ts`, a new arena | **done, merged**: the Sunburst (PROTOCOL 10; all checks pass) |
| 3 | The Tower, first version (alone, the week's Tower) | | `src/tower/`, `src/game/main.ts` | running |
| 4 | Sun Warden: the hall transforms (second and last phase) + his mechanics for 10, 20, 40 (Branded, Carry the Sun, The Four Hours) | | `sunWarden.ts`, `sunhall.ts`, `sunhall.py` | running (port 5200) |
| 5 | Twenty new hero ideas (a page; ideas only, no hero is built) | | `pipeline/designs/` | **done**: `pipeline/designs/heroes-new-20.html` |
| 6 | The heroes we have, reworked: the plan (each hero's own rule that breaks the Q W E R mould) | | `pipeline/designs/` | **done**: `pipeline/designs/heroes-rework.md` (all forty, in waves) |
| 7 | Heart of Noon: the room transforms + its mechanics for 10, 20, 40 (Shade together, Take the Blade, The Ring of Hands) | 2 | `heart.ts`, its party room | queued |
| 8 | Ash and Ember: the pit transforms + their mechanics for 10, 20, 40 (Lantern Chain, Seal the Vents, The Changing of the Flames); a boss room built in Blender | 1 | `ashEmber.ts`, its party room | queued |
| 9 | The hero shop and the rewards: obols, owned heroes, the Shop screen, raid ranks, the week's boards | 1, 3 | `accounts.mjs`, `hub.mjs`, `protocol.mjs`, `src/game/main.ts` | queued |
| 10 | Heroes reworked, wave 1a: Vesper, Brannoc, Cantor (ports 5202, 5203) | 6 | their kits, traits, spells | running |
| 10b | Heroes reworked, wave 1b: Zephyr, Sir Whiskers, Big Yoko (ports 5204, 5205) | 6 | their kits, traits, spells | queued |
| 11 | Heroes reworked, wave 2 and on, as the night allows | 10 | their kits, traits, spells | queued |
| 12 | Engine hooks the helpers asked for: the Tower's (`TOWER-HOOK`), `partyStart` taking the boss's spots, `removeCover` refusing a fixed wall, the autopilot staying near an objective it cannot take | 1, 3 | `duel.ts` | queued |
| 13 | A party of bots through all three bosses (10 or more), every new mechanic seen; docs (`raid.md`, `multiplayer.md`), `STATUS.md`, a morning page of everything with pictures | all | docs | queued |

## The designs

- The Raid for 40, the rooms, the mechanics by party size, the rooms that transform: `pipeline/designs/raid-party.md`.
- The Tower: `pipeline/designs/tower.md`. The hero shop: `pipeline/designs/hero-shop.md`.
- Heroes reworked (the user: "try to rework the herous that we have now amke them unieq or atleast not follow that old rule of
  spells and make them waht ever you want"): job 6 writes `pipeline/designs/heroes-rework.md`.

## Done tonight

- Omens; rare, legendary and dark upgrades; side doors (Vault, Shrine).
- The Heart of Noon, the third boss; Hold Still.
- The Raid for up to 40: server, lobby, the game's side; the Hall of Noon; The Hour Strikes; a party of six bots through the real hub.
- Anka, hero 40: gates 5 and 6.
