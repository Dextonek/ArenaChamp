# Setting up on another computer

Everything the game and the tools need is in this repository, except the few files listed under "Not in git". Then
read `CLAUDE.md` (the working rules) and `docs/STATUS.md` (where the work stands).

## 1. Install
| Tool | Version used | For |
|---|---|---|
| Git | any recent | |
| Node.js | 24 (24.17 used) | the game, the tools, the server |
| ffmpeg | any recent, on the PATH | only to make clips (`pipeline/tools/clip-film.js`) |
| Blender | 5.2 LTS | only to rebuild hero, weapon, arena or boss models (`blender/`). The hero builds (`blender/heroes/moba_figures.py`) also load helper modules (`dao_blender`, `figure_kit`, `kit`) from `C:\projectG\xianxia\blender`, which is not in this repo: copy that folder from the first computer to the same path |
| Claude desktop app | | the browser pane and `.claude/launch.json` dev servers |

## 2. Get the code
```bash
git clone https://github.com/Dextonek/ArenaChamp.git VFXTool
```
```bash
cd VFXTool
```
```bash
git checkout -b feat/particle-editor origin/main
```
```bash
git config user.name Dextonek
```
```bash
git config user.email 103364418+Dextonek@users.noreply.github.com
```
(All commits are authored as Dextonek. Without these two lines a new computer refuses to commit.)
```bash
npm ci
```
The local branch is called `feat/particle-editor` so the push command stays the same everywhere:
`git push origin feat/particle-editor:main`. The first push asks you to sign in to GitHub (Git Credential Manager
opens a browser window). If you use SSH instead and the push fails with a key error on Windows, run
`git config core.sshCommand "C:/Windows/System32/OpenSSH/ssh.exe"` once in the repo.

## 3. Check it works
```bash
npx tsc --noEmit -p .
```
```bash
npm run build
```
```bash
npm run test:server
```
Then `npm run dev` and open http://localhost:5173/game (the game) or http://localhost:5173/ (the VFX tool). In the
Claude desktop app the same servers start by name from `.claude/launch.json` (`vfx-dev`, `game-dev`, `sheet-dev`, `game-server`, `cf-dev`).

## 4. Not in git (make or copy by hand)
| File | What to do |
|---|---|
| `server/data/test-accounts.local.json` | Local test logins for the dev server. Create it: `{"note": "local only", "accounts": [{"name": "...", "password": "..."}]}`, then register those names once on the local game. Never commit it, never use it on the live server. |
| `server/data/accounts.json` | The local server's accounts. It is made by itself when someone registers; nothing to copy. |
| `blender/meshy/`, `docs/heroes/void-meshy-ingame_sheet.jpg`, `docs/heroes/void_meshy_15.png`, `docs/heroes/void_meshy_posed_15.png` | Meshy experiments the user keeps out of git. Copy them by hand if wanted. |
| `docs/heroes/duel_brannoc_vs_lyra.mp4`, `docs/heroes/moba_v2_fight.mp4`, `docs/arenas/temple_breakable_wall.mp4` | Old gameplay recordings (68 MB), ignored for size. Copy by hand if wanted. The current clips are in `public/news/`. |
| The full Quaternius packs | Only the files in use are in `pipeline/assets/ual/` (animation libraries 1 and 2) and `pipeline/assets/ubc/` (base bodies, hair). The whole packs (CC0, free): https://quaternius.itch.io/universal-animation-library, https://quaternius.itch.io/universal-animation-library-2, https://quaternius.itch.io/universal-base-characters |
| The full KayKit animation pack | Only the four clip files the game uses are in `pipeline/assets/kaykit/`. The whole pack (CC0, 14 MB): https://kaylousberg.itch.io/kaykit-character-animations |

## 5. Deploying (only when the user asks)
```bash
npx wrangler login
```
```bash
npm run cf:deploy
```
It builds and publishes to https://arena-of-kits.arenachamp.workers.dev and drops every live connection. Record the
worker version and what was checked in `docs/STATUS.md`.

## 6. Blender
The scripts call Blender at `D:/blender/blender.exe`. On a computer where it lives elsewhere, use that path in the
commands (for example the hero export in `blender/heroes/export_cli.py`). The Blender MCP add-on is needed only for
working in the open Blender window.
