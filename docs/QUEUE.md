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
| 3 | The Tower, first version (alone, the week's Tower) | | `src/tower/`, `src/game/main.ts` | **done, merged** (pictures: `docs/tower/tower.html`; the autopilot's middle climb is floor 12 to 14; nobody has played it) |
| 4 | Sun Warden: the hall transforms (second and last phase) + his mechanics for 10, 20, 40 (Branded, Carry the Sun, The Four Hours) | | `sunWarden.ts`, `sunhall.ts`, `sunhall.py` | **done, merged** (`_raidCheck` 234 rows; six bots through the hub won twice; pictures `docs/raid/warden-*.jpg`). Left: a shard's carrier can still cast (needs `duel.ts`); The Four Hours not seen through the hub |
| 5 | Twenty new hero ideas (a page; ideas only, no hero is built) | | `pipeline/designs/` | **done**: `pipeline/designs/heroes-new-20.html` |
| 6 | The heroes we have, reworked: the plan (each hero's own rule that breaks the Q W E R mould) | | `pipeline/designs/` | **done**: `pipeline/designs/heroes-rework.md` (all forty, in waves) |
| 7 | Heart of Noon: the room transforms + its mechanics for 10, 20, 40 (Shade together, Take the Blade, The Ring of Hands) | 2 | `heart.ts`, `sunburst.ts`, `sunburst.py` | **done, merged** (`386becb` and its last two fixes `db36894`; type check, build; raid checks: Warden 234, Ash 77, Heart 242 before the last two, upgrades 40, twin 72; pictures `docs/raid/heart-*.jpg`). Take the Blade and The Ring of Hands not seen through the hub |
| 8 | Ash and Ember: the pit transforms + their mechanics for 10, 20, 40 (Lantern Chain, Seal the Vents, The Changing of the Flames); a boss room built in Blender (the Twin Forge) | 1 | `ashEmber.ts`, `twin.ts`, `twinForge.ts`, `twinpit.ts`, `hub.mjs`, `duel.ts` | running: the night's helper, in `t3/twin-flames-party-boss-room` (ports 5212, 5213); at 10:00 the hub's half, 140 check rows and the first bot fights were in |
| 9 | The hero shop and the rewards: obols, owned heroes, the Shop screen, raid ranks, the week's boards | 1, 3 | `accounts.mjs`, `hub.mjs`, `protocol.mjs`, `src/game/main.ts` | **done, merged** (PROTOCOL 11; the server test's 217 checks pass; pictures `docs/shop/shop.html`). The shop is ON in the code; bot tools need `SHOP=off`. Not checked on the live store |
| 10 | Heroes reworked, wave 1a: Vesper, Brannoc, Cantor | 6 | their kits, traits, spells | **built, merged; NOT yet fair**: after the rework and the CPU's aim fix (`b05bf09`) Cantor beats Kaia and Auriel 32 of 32 and loses to Oblivion 31 of 32; Brannoc beats Kaia 32 of 32 |
| 10t | Wave 1a tuning: no matchup of theirs past 80 to 20; each 40 to 60 % on the player's side | 10 | the three heroes' files | **merged** (`3963f59`; page `docs/balance/rework-1a-tuning.html`): Cantor 58 % and 54 % as the player's hero, no pairing past 80 to 20; Brannoc 51 % and 54 %, Kaia still 91 % for him (older than his rework); Vesper 47 to 50 % but five pairings one-sided (Oblivion 5 %, Kaia 9 %, Sirix 97 %, Auriel 92 %, Lyra 86 %) |
| 10v | Vesper alone: her five one-sided pairings, 90 minutes at most (port 5218) | 10t | Vesper's files | running since 10:45 |
| 10b | Heroes reworked, wave 1b: Zephyr, Sir Whiskers, Big Yoko | 10t (the benchmark heroes must be right first) | their kits, traits, spells | **not started; after the deploy, on the user's word** |
| 11 | Heroes reworked, wave 2 and on | 10 | their kits, traits, spells | **not started; after the deploy, on the user's word** |
| 12 | Engine hooks the helpers asked for: the Tower's (`TOWER-HOOK`), a carrier that cannot cast | 1, 3 | `duel.ts` | inside job 8 (`215d937`) |
| 13 | Before the deploy: all checks on the merged whole, a party of bots through all three bosses, docs, `STATUS.md`, a page of everything with pictures | 8, 10t | docs | queued |
| 14 | Research (the user, 10:55: "make deep resrch on all wow raid boss mechanics and docs it", "and also make deepl reserch at newwer expansion"): World of Warcraft's raid boss mechanics, every raid, deepest on the newest expansions; the report to `docs/knowledge/wow-raid-mechanics.md` | | `research_notes/WoW raid boss mechanics/`, `reports/` | by the deep-research skill, one researcher a free slot (three agents at once): (A) Classic, TBC, Wrath: running since 10:58 -> `era1_classic_tbc_wrath.md`; (B) Cataclysm, Mists, Warlords, Legion; (C) Battle for Azeroth, Shadowlands; (D) Dragonflight, The War Within, Midnight, in depth; (E) the types of mechanic, how they scale with raid size and difficulty, what the designers said; (F, the user at 11:05: "serach most fun and best and popuarl mechanic by players find some statisctic about the most best mechanics note ot to docs") what players call the best, most fun and most hated bosses and mechanics, with numbers: polls, rankings, pull and wipe counts; then one report writer (the report ends with the players' favourites and what they mean for our raid); then copy the report to `docs/knowledge/` and commit. Not part of the deploy |

## The morning (2026-11-12, 09:00): where the night stopped, and what the user decided

The night's loop stood still from about 04:00 to 08:57 (most likely the computer slept): the three helpers committed nothing
in between. **They were not gone:** this thread could not read their threads any more, but they woke with the computer, went
on in their own checkouts and report here when done. Two duplicates started at 09:30 by mistake were stopped at 10:25 (their
checkouts hold nothing worth keeping). The server test's timing checks fail while helpers run bots (the computer is at full
load): run it once more on a quiet machine before the deploy.

The user, awake, asked "can you like slowly push it and deploy it when finish", and chose:

1. **When:** after the two half-done jobs (8 and 10t). No new jobs are started before the deploy.
2. **The shop: off for now.** `wrangler.jsonc` says `"SHOP": "off"`: every hero stays free; obols are earned and kept. The
   News item about the Shop must say so before the deploy (it describes prices and locks today).

So the order is: jobs 8 and 10t report -> merge each (type check, build, server test, raid checks) -> job 13 -> the News
item for the closed shop, the release's `live: true` and its date -> `git push origin feat/particle-editor:main` ->
`npm run cf:deploy` -> look at the live page. **This word covers this one push and this one deploy only.**

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
