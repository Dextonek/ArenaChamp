# The deep lore of the Dial, its peoples, a codex in the game, and the plan to revamp the heroes (Arena of Kits)

Read `CLAUDE.md` first: house rules and Lessons, especially the new one, **"Every hero matches the lore"**. Then:
- `docs/pipeline/new-hero.md`: rule 0, "the lore first";
- `docs/lore/LORE.md` and `docs/lore/index.html`: the Dial, the Noonfall, eight factions, places, a legend, home and age for every hero, and
  the ties;
- `pipeline/tools/lore-page.py`, `pipeline/tools/lore-game.py` and `src/game/lore.ts`: how the lore reaches its page and the game;
- the hero pages `docs/catalog/heroes/*.md` and sheets `docs/heroes/`: how each hero looks;
- `docs/ART_BIBLE.md` §1 and `pipeline/designs/style-v4/README.md`: the one style, realistic bodies on one skeleton with the pack's clips,
  never cartoon;
- the twenty new heroes: `docs/heroes/next10/`, `next20/`, `kits20/`, and `pipeline/designs/kit-<theme>.md`;
- the Climb: `pipeline/designs/tower-50.md`, its 25 people (`docs/tower/models/index.html`, `src/tower/world/folk.ts`), and its rulers and
  enemies (`docs/tower/models/`; another agent may still be making them: use what is committed on `feat/particle-editor`).

The user, 2026-11-14: **"I think we need revamps of some heroes now, they seem all the same, like human and stuff. Maybe let's make the
lore better and more deep, make it 10x more lore than now, and let's match heroes to lore, and from now on we will match all heroes to our
lore."**

## 1. The peoples of the Dial (start here: it answers "they all seem human")
Eight to twelve peoples, so the Dial is not only humans. Make them from what the heroes already are:
- mole-folk (Mabel);
- the lynx knights (Sir Whiskers);
- the fae of the Wood (Pim and Pom);
- shades (Nyx);
- the sun-born (Anka);
- the bone-lords (Mortis);
- the Unmade (Oblivion);
- and others you find in the 60 heroes.

For each people:
- origin, homeland, body;
- how they look **within the one style**: on the human skeleton, with the pack's animations, so horns, ears, tails, skin, eyes, scales,
  wings carried as a cloak, stone or glass skin, extra props. Say what the figure can and cannot be;
- lifespan and how the Noonfall touched them, culture, faith, names, how they fight;
- which heroes and Climb people belong to it.

The humans of each realm are peoples of their own too: the Aubade folk, the Dune folk, the Gloaming nobles, the Frostfall northerners. Each
has a different look: build, dress, skin and hair, marks.

## 2. Ten times the lore
Today's `LORE.md` is about 12,000 words. Make the lore about ten times that. Deep, not padded: everything specific, consistent, and
useful to the game (heroes, the Climb, future modes). Keep `LORE.md` as the short source the page and the game read, and put the depth in a
codex: `docs/lore/codex/*.md`, one file a subject, cross-linked.
- **History.** A timeline of the ages before the Fall, the Fall itself, the War of the Banners, the Truce, the century since, and what is
  happening now (hooks for events and seasons).
- **The realms.** Each realm's land, cities and places, people, rulers and law, faith and festivals, food, trade, its old wounds, and
  its stake in the Tower. Make the Climb's five chapters and their floors, people, rulers and enemies part of it: a bestiary of the Climb's
  enemy kinds and the story of each ruler.
- **The factions in depth.** Ranks, rites, symbols, secrets, what each wants from the Tower, and how they work against each other.
- **The heroes in depth**, all sixty (the 40 and the 20 new). For each:
  - a biography of 600 to 1,000 words;
  - their people, appearance and voice;
  - eight short voice lines usable in the game (on picking, winning, losing, meeting a tie);
  - their secrets;
  - what they want from the Tower;
  - deeper ties.

  Keep each hero true to their kit and title. Their look may change only through the revamp plan below.
- **The Tower and the Sun.** Give two or three possible answers to "why the sun fell" and "what the Tower is", and leave the choice
  to the user (they were left open on purpose). Write the lore so either answer fits.

## 3. The revamp plan (no models yet)
For each of the 40 heroes in the game, decide its people from part 1, and whether its figure should change to show it:
- **No:** it already reads as its people.
- **Touch:** a costume or colour detail of its faction or people.
- **Revamp:** a new figure, for example a hero now plainly human who becomes one of the non-human peoples.

Rank the revamps by how much the roster gains: the heroes that look most like each other first. Keep the user's accepted looks where they
work: the lesson is that hand-made poses and cartoon looks were rejected, not that changes are. Give each revamp:
- a short brief of the new figure;
- its kit and title, unchanged unless the people demand otherwise;
- what in its lore changes.

Do the same for the twenty new heroes, whose looks are not made yet: give each its people and its look brief from the lore.

This plan goes to the user for a yes. The models are made later, one at a time in Blender, starting with one sample.

## 4. The codex in the game
A **Codex** screen on the game page, reached from the menu and from a hero's Lore panel ("More about …"). It has:
- the world;
- the peoples;
- the realms (with the map);
- the factions;
- the history timeline;
- each hero's full page: biography, people, voice lines, ties.

Readable at 375 px. Load it on first need, as `src/game/lore.ts` is, with its own chunk; the page's start must not grow. Extend
`pipeline/tools/lore-game.py`, or a new script, to make its data from the codex. Add the people to each hero's Lore panel and the Play card
line ("Noonsworn · Aubade folk · from Aubade"). Write a News line in `src/game/changelog.ts`, in the top release that is not live.

## 5. Checks and pages
- Extend `pipeline/tools/lore-page.py`'s checks: every hero has a people; ties go both ways; every name is new; no name taken from another
  game or franchise.
- `docs/lore/index.html` grows the peoples, the revamp plan as a table, and links to the codex.
- `npx tsc --noEmit -p .` and `npm run build` pass. Take pictures of the Codex screen and a hero's Lore panel, at desktop width and 375 px,
  into `docs/lore/pictures/`.
- Sign in on the local dev server only with a throwaway account made in the page, with a password generated in JS and never printed.
  `server/data/` is never committed.

## Rules
- Work in your own worktree on a branch from `feat/particle-editor`.
- Commit by explicit path: never `git add -A`, never `git add docs`, never anything in `server/data/`. Messages end with
  `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- **Do not push, do not deploy, start no sub-agents.**
- **Files you own:** `docs/lore/**`, `pipeline/tools/lore-*.py`, `src/game/lore.ts` (and new `src/game/codex*.ts`), the lore parts of
  `src/game/main.ts` and `src/game/game.css`, `src/game/changelog.ts`, `docs/heroes/next10|next20|kits20` (for the twenty's peoples and
  looks), and `pipeline/designs/kit-<theme>.md` (their lore lines only).
- **Files you don't touch:** `src/tower/**`, `server/*`, `src/net/*`, `src/duel.ts`, `src/arena.ts`, `src/heroMode.ts`, `src/main.ts`,
  `blender/`, `public/models/`. Other agents work there.
- **Original names only:** check each against `src/kits/`, the spell labels, the roster and the lore.
- **Dev server:** only port 5263 (`node node_modules/vite/bin/vite.js --port 5263 --strictPort`).
  - If node_modules is missing, link it to C:\Users\erich\ArenaChamp\node_modules with a directory junction (PowerShell
    `New-Item -ItemType Junction`), and remove only the link afterwards.
  - The Vite cache is shared: never use --force. Stop only your own server, by its own task. Never kill processes by name.
  - Every wait ends by itself within 10 minutes.
  - In Git Bash a `/game` argument becomes a Windows path: run page scripts from PowerShell.

## Report
- The peoples in a line each.
- The word counts before and after.
- The codex's files.
- The revamp plan: the ranked list, with "no", "touch" or "revamp" for all 40 and the first three to make.
- The choices left to the user (why the sun fell, what the Tower is, names).
- The picture paths.
- What to write in STATUS.
- Your branch and last commit.
