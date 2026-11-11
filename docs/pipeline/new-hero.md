---
title: Rules for creating a hero
tags: [pipeline, heroes, rules, checklist]
updated: 2026-11-11
status: used once; Anka the Firebird (hero 40) was built by them, and what she showed is at the end
---

# Rules for creating a hero

Written 2026-11-11, when the user asked for a 40th hero and said: "don't follow the same path, let's just make new
rules for hero creation". The first 39 heroes were made in waves, and most of them were made twice: these rules are
there so that the next one is made once.

Part 1 is the rules. Part 2 is the six gates a hero passes, each ending in a picture and the user's yes. Part 3 is
the checklist of every file and number, for whoever builds.

## What changes from before

| Before | What went wrong | Now |
|---|---|---|
| Kits first, models later, portraits whenever | 19 figures rejected as "too funky" and redone; three model styles side by side until all 39 were rebuilt; portraits and catalog pages that no longer match the models | **The look is shown and agreed before any spell is built** (gate 2), and portrait, catalog page and model are made from the same sheet |
| A hero was "one more of the template" | "all heroes seem kinda the same" and a whole rework (kits v5) | **A hero brings one thing the game does not have yet** (rule 2), named on its card before anything else |
| Poses and motion built by hand | Rejected three times | **Only the animation pack's clips** (rule 5); a hero that needs a new move gets a new clip from the pack, looked at beside the pack's own figure |
| Checked by "it loads and the test passes" | Heroes lying on the floor at their hit, an axe held upright, hit boxes that did not match the drawing | **Every gate ends in a picture from the game's own camera**, and the user's yes |
| Balance and the CPU done in a later pass | Swings from 13% to 100% wins | **Measured before release** (rule 9): no hero ships outside 40-60% |
| Done when the code was in | Docs, News, counts and the login picture trailing behind | **One checklist** (part 3); a hero is done when every line of it is ticked |

Kept as they are, because the user decided them: mythic and elegant figures, never cartoon-goofy (ART_BIBLE §1); the
one model style ("real", v4); the line-up beside Sefu and Kaia; push and deploy only on request.

## Part 1: the ten rules

1. **One sentence, one shape, two colours.** A hero is a mythic role you can say in one sentence ("a fire dancer who
   rises from her own ashes"), a signature shape you can draw as a 64-pixel icon (a feather, a door, a gear), and an
   accent with a pale foil. None of the three may be mistaken for an existing hero's: check the roster table in
   `docs/catalog/heroes/README.md` and the palette rows in `docs/ART_BIBLE.md`. Jokes may live in a name or a spell,
   never in the figure.
2. **One thing the game does not have yet.** Before any number is written, name the new thing: a mechanic, a kind
   of spell, or a way to win that no hero has. If the honest answer is "it is like X but with fire", the idea is not
   ready. Her four spells must also not be the four shapes of any other hero.
3. **A question, a weakness, a second decision.** Her card says which question she asks the opponent every few
   seconds, the weakness any hero can use against her, and the choice her own player keeps making (a recast, a
   resource with two exits, a thing to walk to). A kit without all three is a damage table.
4. **Answers first, on paper.** Every spell has a written answer ("step out", "break it", "stand behind cover"),
   checked with the game's numbers before it is built: a hero walks 4 m/s, a person reacts in 0.25 s, a circle warns
   for at least `0.25 + radius / 4` seconds, a bolt reaches 6 m no sooner than 0.5 s. If the numbers fail, the spell
   changes, not the answer. The ultimate never lands the moment it is cast.
5. **One body, one motion.** The figure is built the fourth way: the pack's body, costume and props built from clean
   forms, on the animation pack's skeleton (`pipeline/designs/style-v4/README.md`). She moves only with the pack's
   clips. A staff, wand or instrument goes in the left hand, a weapon in the right.
6. **Readable from the game's camera.** Everything is judged from the steep play camera on a dark floor: shapes at
   least 0.15 m thick, a pale foil beside every dark colour, the enemy's red never used, nothing brighter than the
   floor can bear. What the opponent must read (the wind-up, the circle, the line) is the best-drawn part, and the
   drawn shape is exactly what hits.
7. **The same on both screens.** Every stack, mark, timer and stance shows on the hero or on the floor for both
   players, and every rule is decided on the screen that owns it (`pipeline/designs/kit-build-brief.md`, "The trait
   API"). Nothing both screens must agree on uses chance.
8. **The computer can play her, and against her.** The CPU is told when to hold each spell and where to walk
   (`aiHold`, `aiGoal`), and what to do about her (`enemyGoal`). A hero the CPU cannot use is not finished: most
   players meet her first as a CPU opponent.
9. **Measured, not guessed.** She starts inside her role's budget (`pipeline/designs/kit-common.md`) and ships
   between 40% and 60% wins against the six benchmark heroes, clears the Raid's first boss like her role does, and
   costs no more to draw than the heroes beside her.
10. **Finished means everywhere.** Model, portrait, icons, catalog page, palette row, News, the counts ("40
    heroes"), the server's protocol number, and the pictures taken new. Part 3 is the list; nothing is "later".

## Part 2: the six gates

Each gate ends with something to look at and waits for the user's yes. No work of a later gate starts before it,
except reading. One hero at a time goes through gates 2 to 5.

| Gate | What is made | What the user is shown | Done when |
|---|---|---|---|
| **1. Card** | One page: sentence, shape, colours, role, the new thing, question, weakness, second decision, a line on how she looks | The card, and the nearest existing heroes beside it | The user says yes to the idea |
| **2. Look** | The model (`blender/heroes/real/<theme>.py`), her held thing, her stance | Front, face, back, walking, her attack at its hit, the game camera; then **the line-up between Sefu and Kaia** | The user says yes to the figure. Only now are colours and shapes fixed for everything else |
| **3. Kit on paper** | The kit sheet (`pipeline/designs/kit-<theme>.md`): four spells and the passive, every number, every answer checked (rule 4) | The sheet as a table, in plain words | The user says yes, or changes spells while they are still words |
| **4. Spells** | Palette and parts, four spells, the trait, icons and portrait drawn from the agreed look, registration | One picture per spell from the game camera at its key moments, and the hero's page in the game | Each spell reads as hers without its name; type check and build pass |
| **5. Plays** | The CPU's use of her, balance numbers, the Raid | A clip of a CPU duel in an arena; the simulator's page (win rate, who beats her, where her damage comes from) | 40-60% over at least 96 fights; no errors; the user has played her once |
| **6. Release** | Part 3's last block: docs, News, counts, protocol, pictures | The list of what is not live yet | The user asks for the push, then for the deploy |

If a gate's picture gets a no, go back one gate, not forward with a patch: a rejected look is rebuilt, a rejected
spell is rewritten on the sheet first.

## Part 3: the checklist

`<theme>` is one lower-case word (`phoenix`); the hero's name is what players see.

### Gate 1: card
- [ ] `pipeline/designs/kit-<theme>.md` started with the card (rules 1 to 3).
- [ ] Name, title, spell names and theme word are new: search `src/kits/`, `src/spells/targeted/` (file names and
      `label`s) and the roster table.
- [ ] Accent and foil are not a neighbour of an existing hero's (`docs/ART_BIBLE.md`, the kit palette rows).

### Gate 2: look
- [ ] `blender/heroes/real/<theme>.py` with one `build()`; run
      `blender --background --factory-startup --python blender/heroes/real_build.py -- <theme> --shots <folder>`
      (Blender: one agent at a time). It writes `public/models/heroes/<theme>_v4.glb`: 300-600 KB, about 25,000
      triangles at most, emissive at most 1.
- [ ] `src/heroes.ts`: `MODELS` gets `'<Name>': 'models/heroes/<theme>_v4.glb'`, `HERO_BODIES` her hit size (radius
      and height as measured on the model, at the heroes' 1.3x).
- [ ] `src/motion/real.ts` `REAL_STYLE`: what she holds and how she strikes, when the default is wrong. A clip she
      needs that is not used yet: `pipeline/tools/strip-anim.mjs`, then looked at with `pipeline/tools/v4-clips.js`
      beside the pack's own figure.
- [ ] Pictures: `_v4sheet` and `_v4lineup` (`pipeline/tools/v4-sheet.js`) with Sefu and Kaia. Saved under
      `docs/heroes/`.

### Gate 3: kit on paper
- [ ] The sheet's table: per spell its key, name, cooldown, rule, and the answer with its arithmetic. Role, HP, walk
      speed and basic attack from the role budget in `pipeline/designs/kit-common.md`.
- [ ] What each rule needs from the engine, and on which screen it is decided. Anything the engine does not have is
      named here and built first, by one writer (`src/duel.ts`, `src/arena.ts`, `src/heroMode.ts` are shared).
- [ ] What the CPU does with each spell, and against it.

### Gate 4: spells
- [ ] `src/effects/parts/<theme>.ts`: the palette (numbers and a `_CSS` twin) and her pooled parts.
- [ ] `src/spells/targeted/<camelName>.ts`, one per spell, `category: 'hero: <theme>'`; registered in
      `src/spells/targeted/index.ts`.
- [ ] `src/kits/<theme>.ts`: name, title, accent, foil, HP, the four spells with blurbs a player can act on, icons,
      and **the portrait drawn from the agreed model** (same colours, same held thing, same hair). Added to
      `HERO_KITS` in `src/heroes.ts`, at the end.
- [ ] `src/traits/<theme>.ts`: passive, twist, speed, attack, the hooks; registered in `src/traits/index.ts`.
- [ ] One contact sheet per spell (`pipeline/tools/contact-sheet.js`, `_review`), saved under `docs/spells/`.
- [ ] `npx tsc --noEmit -p .` and `npm run build`.

### Gate 5: plays
- [ ] `aiHold` (and `aiGoal`, `enemyGoal` where she has things on the floor): written down in the sheet what the
      CPU does.
- [ ] `python pipeline/sim/sim.py hero <Name>` ([the fight simulator](simulator.md), 96 fights in 45 s): 40-60%, no
      fight without a winner, no errors, and every spell showing in "where the damage comes from" (one that does not
      is one the CPU cannot use). Numbers changed here go back into the sheet and the blurbs. Before release,
      once with `--fights 32` and once with `--events`.
- [ ] `_raid(['<Name>', '<two of her role>'], 30)` (`pipeline/tools/raid-tool.js`, through `page-shots.py`): clears the first
      boss like her role; `_raid.errors()` empty. Four fights are noise: 30 a hero take a minute. A boss's hit is not a
      hero's: if her passive answers a hit (a save, a block, a counter), try it with an ordinary boss hit and with a
      `lethal` one, and write down what each does.
- [ ] A CPU duel on the game page through its own menus: pick her in the hero grid (also at phone width), fight,
      lose or win, rematch; then as the CPU's hero. No console errors.
- [ ] Two screens online with bots (`pipeline/tools/online-bot.js`, two headless pages on one dev server). Equal HP on
      both screens is not enough: read what each screen has of her things on the floor ten times a second and lay the
      two records over each other. Throw her spells into each other's wind-ups: that is where the screens part.
- [ ] A clip (`pipeline/tools/clip-film.js`, headless through `page-shots.py`; one take a page load) for the user and
      the News.
- [ ] `npm run test:server`.

### Gate 6: release
- [ ] `docs/catalog/heroes/<theme>.md` and her row in `docs/catalog/heroes/README.md`; her spells in
      `docs/catalog/effects.md`; her palette row in `docs/ART_BIBLE.md`.
- [ ] The counts: "39 heroes" becomes "40" in `CLAUDE.md`, `docs/README.md`, `docs/catalog/heroes/README.md`,
      `docs/SHOWCASE.md` and wherever a search for the old number finds it as a current fact (not in history).
- [ ] `src/game/changelog.ts`: a News item with her picture or clip (`public/news/`).
- [ ] `server/protocol.mjs`: `PROTOCOL` plus one. A tab left open from before does not know her, so it must reload.
- [ ] Pictures that show the roster, taken new: the line-up (`_v4lineup`), `public/news/` if the News shows the
      roster, the login picture only if she should stand in it.
- [ ] `docs/STATUS.md`: done, not pushed, not live; then the user's push, and the deploy as its own request. Before
      a deploy: `npx wrangler deployments list` shows the version STATUS names as live (two Cloudflare accounts).

## What hero 40 showed (2026-11-11)

Anka went through all six gates. What her last two gates found, as rules for the next hero:

- **Order things by the cast, never by the landing.** Her embers were numbered and ranked "newest" in the order they
  landed, and a quill lands at a different moment on the two screens. Thrown during her ultimate's wind-up or just
  after her fan, it landed before the other spell's moment on one screen and after it on the other, and the screens
  then disagreed on her nest for 12 s. Her HP agreed all the while, so only a record of both screens side by side
  showed it. An effect's `cast` runs once a cast on each screen, in the same order: count there
  (`castNo` in `src/traits/phoenix.ts`).
- **A rule that asks "would this hit fell her" must ask about the rounded damage.** The duel takes 55.6 as 56.
- **The Raid has hits that pass no trait** (`lethal`: Ash's Charge), as the arena's own damage does. A passive that
  saves a life does not save it from those; say so in its text.
- **A passive's text is read on a card with six lines** (the Play screen at laptop height). Hers is the longest in
  the game and runs past its box there, as Vitriol's does.

The questions this page asked before she was built:

- **A portrait made from the model.** Hers was drawn by hand from the agreed sheet, by a helper who had the model's
  pictures beside it. A portrait rendered from the model itself is still a proposal, not built.
- **A hero born in the fourth style** has no older model: `?figs=old` shows her as she is, and a duel there runs without errors.
- **An old tab meeting a new hero.** Her release raises no protocol number of its own: the raid change that ships
  with her raises it, and that covers her. What an old tab really does when it meets her was not looked at.
- **Tools with their own hero lists:** none needed her name. The simulator, the raid tool, the clip tool, the
  online bots and the picture tools all took `'Anka'` as they are.
- **Shown as pages.** Her looks are one page (`docs/heroes/anka.html`), her balance runs are pages
  (`docs/balance/anka-gate5-*.html`), and gate 5 is one page (`docs/heroes/anka-gate5.html`).
- **The costs in rule 9:** her effects cost 0.18 ms a fight step against 0.23 for the heroes beside her, read by
  hand; there is still no tool.

## Where the details live

- The trait hooks and what runs on which screen: `pipeline/designs/kit-build-brief.md` (written for worker agents:
  its "never edit" list and its `C:\VFXTool` path are theirs, not yours).
- Budgets by role, look lessons for effects: `pipeline/designs/kit-common.md`.
- The eleven kit rules and the answer arithmetic: `pipeline/designs/kits-v5.md`.
- The model: `pipeline/designs/style-v4/README.md` ("What a finished model must meet").
- Review pictures from a hidden browser tab: `docs/pipeline/review-tools.md`.
