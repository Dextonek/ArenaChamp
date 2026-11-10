# Working on Arena of Kits (VFXTool)

Read this first in every session, on any computer, then `docs/STATUS.md` (what is done, live, in progress and next),
then `docs/README.md` (the map of the docs). Setting up a new computer: `docs/SETUP.md`.

## The project
- A browser game, Arena of Kits: 1v1 MOBA duels online and against the CPU, and a co-op Raid against bosses
  (`/game`). Beside it, the VFX tool it grew out of (`/`). Three.js, Vite, TypeScript; game server on Cloudflare
  Workers (a Durable Object) or Node. 39 heroes.
- The user is the game artist and designer, often on a phone. They judge by eye: show pictures, sheets and clips,
  not only numbers. Write closing messages that stand alone, in plain words.
- Live: https://arena-of-kits.arenachamp.workers.dev/game. GitHub: `Dextonek/ArenaChamp`, branch `main`.

## Rules the user set (keep them)
- **Commits:** commit finished batches without asking. Stage by explicit path, never `git add -A` or `git add docs`.
  Never commit `blender/meshy/`, `docs/heroes/void-meshy-ingame_sheet.jpg`, `docs/heroes/void_meshy_15.png`,
  `docs/heroes/void_meshy_posed_15.png` (they are not ignored; they show as `??`), nor anything in `server/data/`
  (local accounts and test passwords).
- **Push only when asked:** `git push origin feat/particle-editor:main` (local branch `feat/particle-editor`, GitHub
  `main`). If a push fails, stop and give the user the exact command; do not debug SSH keys. The remote is HTTPS; with SSH on
  Windows git may need `git config core.sshCommand "C:/Windows/System32/OpenSSH/ssh.exe"`.
- **Each deploy needs its own request** (`npm run cf:deploy`). A deploy drops every live connection. "Push and
  deploy" covers that one deploy only. After new work, list what is not live and ask.
- **Credentials:** never type or repeat passwords in chat. Local test logins come from the git-ignored
  `server/data/test-accounts.local.json`; let the page fetch it in JS. No test accounts on the live server.
- **Agents:** at most 3 subagents at once, counting ones that subagents start themselves. Blender (MCP): one agent at a
  time. One writer at a time on the shared engine files (`src/heroMode.ts`, `src/arena.ts`, `src/duel.ts`,
  `src/main.ts`).
- **Loops:** every wait or poll ends by itself within 10 minutes. Never kill processes by name. "stop", "sstop" or
  "slowly finish" means stop all agents and loops at once, then summarise.
- **Scope:** "brainstorm" or "just ideas" means no code. Use a named model, path or tool exactly; ask before choosing
  another. Ask before widening into another system.
- **Windows:** scripts the user runs must work in Windows PowerShell 5.1 (no `?:`, `??`, `&&`, `||`). No file names
  with `: ? * < > |`.
- **Hand-over:** keep `docs/STATUS.md` current (done, in progress with the exact command, blocked with the reason,
  waiting on the user, next). Put the steps the user must do into one numbered block.
- **Change log:** anything a player can see goes into `src/game/changelog.ts` (the game's News page); its head
  comment says how.

## Lessons (what the user accepted and rejected)
- **Heroes must match `docs/ART_BIBLE.md` §1: mythic and elegant, never cartoon-goofy.** The first versions of the 19
  newer heroes (a weatherman, a janitor, a near-naked sumo...) were rejected as "too funky" and rebuilt as mythic
  roles (`pipeline/designs/heroes-restyle.md`). Jokes can live in names and kits, not in the figure. Before a new
  hero, render it in a line-up next to Sefu and Kaia.
- **One hero style, the fourth: realistic, one continuous body (decided 2026-11-10).** The user compared seven
  directions for Lyra (`pipeline/designs/style-v4/README.md`) and chose "real", for all 39 heroes: Quaternius'
  Universal Base Characters bodies (CC0) on the skeleton of his Universal Animation Library, whose clips play on them
  as they are (`src/motion/real.ts`). All 39 are built (`blender/heroes/realkit.py`, one `build()` per hero in
  `blender/heroes/real/`, `real_build.py`; models `*_v4.glb`) and are the default; `?figs=old` shows the older models.
  A new or changed hero is made the same way; staffs go in the left hand, weapons in the right (that README).
- **Motion comes from an animator's clips, not hand-built poses.** Standing comes from Quaternius' Universal Animation
  Library (CC0, a realistic figure like ours: `pipeline/assets/ual/`, `pipeline/tools/bake-ual.js`) since 2026-11-10,
  after fits of the KayKit idle onto our heroes were rejected (docs/knowledge/retargeting-arms.md); the rest is still
  KayKit's. Hand-built holds and strikes were rejected three
  times, even when matched to real footage. Walking, running, attacks and four casts replay the
  KayKit Character Animations pack (CC0; `src/motion/clips.ts`, baked by `pipeline/tools/bake-motion.html`). For new
  motion look in that pack first (https://kaylousberg.itch.io/kaykit-character-animations: hit reactions, deaths,
  dodges, strafes, blocks, bows are not used yet). Measure the copy (`pipeline/tools/motion-check.js`) and show the
  game beside the pack's figure at the same moments. Do not commit other people's footage. Write-up:
  `pipeline/designs/hero-holds.md`.
- **Boss difficulty** is measured with `_raid(...)` (`pipeline/tools/raid-tool.js`) in tool-page tabs: four tabs in
  parallel, about 10 minutes for 39 heroes each; any edit under `src/` or `pipeline/` reloads the tabs and kills the
  runs; one run of 39 fights swings by about ±8 points.

## Working habits that pay off
- Dev servers come from `.claude/launch.json` (`vfx-dev` on 5173: tool page `/` and game `/game`; `sheet-dev` on 5175
  for the model sheet pages). Type check `npx tsc --noEmit -p .`, build `npm run build`, server test
  `npm run test:server`.
- In a hidden browser pane CSS animations freeze and timers slow down: inject `*{animation:none!important}` before a
  screenshot, and drive the game with `vfx.step` in a loop instead of waiting.
- Pictures from the page: the sheet tools leave a data URL in a window variable; return it, and if the result is
  saved to a file, `python -I pipeline/tools/save-shot.py <file> <out.jpg>`.
- Clips: `pipeline/tools/clip-film.js` with `node pipeline/tools/frame-sink.mjs <folder>` and `ffmpeg`.
- Long Python edit scripts: write the script to a file, then run it (shell here-docs with many quotes break).
