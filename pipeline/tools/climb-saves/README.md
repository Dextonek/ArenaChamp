# The Climb's saves across the renumbering: a browser test

The Climb had five floors (1 to 5); it has 50 in five chapters, and the handmade floors 2 to 5 are 11, 21, 31 and 41
(pipeline/designs/tower-50.md, stage 3). `src/tower/world/state.ts` (`migrateSaves`) moves a browser's saves once, with the
version key `tower.world.version`. These four scripts check it in a real browser on the game page, one browser profile kept
between them (so the second run is a real reload of what the first wrote). Each is run by `world-shots.py`, against a dev server
of this checkout (here on port 5240: `node node_modules/vite/bin/vite.js --port 5240 --strictPort`). In Windows PowerShell:

    $P = "$env:TEMP\climb-saves-profile"
    if (Test-Path $P) { Remove-Item -Recurse -Force $P }
    New-Item -ItemType Directory -Force $P
    python -I pipeline/tools/world-shots.py pipeline/tools/climb-saves/1-fresh.js    --page /game.html --port 5240 --size 390x844 --touch --profile $P --out docs/tower/climb50 --browser chrome
    python -I pipeline/tools/world-shots.py pipeline/tools/climb-saves/2-migrated.js --page /game.html --port 5240 --size 390x844 --touch --profile $P --out docs/tower/climb50 --browser chrome
    python -I pipeline/tools/world-shots.py pipeline/tools/climb-saves/3-again.js    --page /game.html --port 5240 --size 1280x800 --profile $P --out docs/tower/climb50 --browser chrome
    python -I pipeline/tools/world-shots.py pipeline/tools/climb-saves/4-new.js      --page /game.html --port 5240 --size 1280x800 --profile $P --out docs/tower/climb50 --browser chrome

(From Git Bash, set `MSYS_NO_PATHCONV=1` first, or `/game.html` is turned into a Windows path.)

1. **Fresh:** no saves; the menu (only floor 1 open); floor 1 started from the menu. Then it writes saves as the five-floor
   Climb left them (no version key): floor 3 reached, stars and times on floors 1 and 2, a run in progress on floor 3.
2. **Migrated (after a reload):** floor reached 21, stars and times on 1 and 11, the run on 21, the version 2; the menu;
   Continue opens the Storm Canyon with the run's quest step, shards and clock; Leave saves it.
3. **Again (after a reload):** nothing moved a second time; calling the migration by hand changes nothing. Then it writes
   saves in the new numbering on floors 2 to 5 (the sea's made floors), with the version set.
4. **New (after a reload):** those stay where they are; floor 2 (a made floor) started from the menu.

Each returns `ok` and a list of `fails`.
