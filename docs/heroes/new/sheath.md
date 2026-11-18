---
title: New hero, Kagen
tags: [heroes, new-hero, checklist]
updated: 2026-11-18
status: draft; gate 1 next
---

# Kagen, the Scarlet Sheath: the gates

Made by `python pipeline/tools/new-hero.py "Kagen"` on 2026-11-18. The rules and the gates:
[docs/pipeline/new-hero.md](../../pipeline/new-hero.md). Each gate ends in a picture and the user's yes; no work of a later
gate starts before it. A draft is not in the game (`draft: true` on its card): it plays on the hero workbench
(`/workbench.html` on the dev server, `npm run dev`), and the tools fight it with `--drafts`.

Theme `sheath`, icon stem `kagen`, faction `loners`, assassin, melee, 700 HP, accent
`#cf4a1c`, foil `#ebe8e2`. The checks of one hero, all at once: `python pipeline/tools/hero-check.py "Kagen"`.

## Gate 1: card (rule 0 first: the lore)
- [x] Its lore: people, realm and home, faction, age, legend (80-150 words), line, two to four ties, its origin
      (`docs/lore/LORE.md`); its codex page (`docs/lore/codex/heroes/kagen.md`). `python pipeline/tools/lore-page.py --check`
      lists what a draft still lacks as notes.
- [ ] The card in `pipeline/designs/kit-sheath.md`: sentence, shape, colours, role, the new thing, question, weakness, second decision
      (rules 1 to 3).
- [ ] Name, title, spell names and theme word new (`python pipeline/tools/kits20.py` checks names taken).
- [x] **The user's yes to the idea.**

## Gate 2: look
- [x] `blender/heroes/real/sheath.py`, one `build()`; `public/models/heroes/sheath_v4.glb` 300-600 KB, at most about 25,000 triangles
      (`hero-check.py "Kagen" --only model`).
- [x] The card's `body` measured on the model; what it holds and how it strikes (`src/motion/real.ts`, `REAL_STYLE`).
- [x] Pictures: front, face, back, walking, its attack at the hit, the game camera; the line-up between Sefu and Kaia.
- [ ] **The user's yes to the figure.**

## Gate 3: kit on paper
- [ ] The sheet's table: per spell its key, name, cooldown, rule, and the answer with its arithmetic (rule 4).
- [ ] Which block each spell is (`src/heroes/framework/blocks.ts`): bolt, circle, lane, sure hit, zone; and what is new code.
- [ ] What the CPU does with each spell, and against it.
- [ ] **The user's yes to the kit.**

## Gate 4: spells
- [ ] `numbers.ts` from the sheet; the spells on the blocks (`spells/`); the look of each (a class in place of the sketch).
- [ ] The passive (`trait.ts`); the icons (`pipeline/icons/vectorcraft/draw/kagen.py`, `make.py kagen`); the portrait
      (`icons.ts`) drawn from the agreed model.
- [ ] On the workbench: every spell's reach and timing drawn on the floor match the sheet.
- [ ] `npx tsc --noEmit -p .` and `npm run build`.
- [ ] **One picture a spell from the game camera; the user's yes.**

## Gate 5: plays
- [ ] `aiHold`, `aiGoal`, `enemyGoal` in `trait.ts`.
- [ ] `python pipeline/tools/hero-check.py "Kagen"`: the simulator 40-60% over at least 96 fights, the icons at 32 px, the model,
      the lore; no errors.
- [ ] The Raid's first boss (`_raid(['Kagen', ...], 30)`, `pipeline/tools/raid-tool.js`).
- [ ] **A clip of a CPU duel; the user has played it once.**

## Gate 6: release
- [ ] Delete `draft: true` from `src/heroes/sheath/hero.ts`; its row in `HERO_SHOP` (`server/protocol.mjs`), `PROTOCOL` plus one.
- [ ] Its LORE.md status `roster`; `python pipeline/tools/lore-game.py` and `python pipeline/tools/lore-codex.py`.
- [ ] Its fight prints taken (`python pipeline/tools/hero-prints.py take "Kagen"` and `take "Kagen" --foe Brannoc`); then
      `hero-check.py "Kagen"` again: the online pair check runs once the server knows it.
- [ ] Catalog page and row, palette row (`docs/ART_BIBLE.md`), the counts, `src/game/changelog.ts`, `docs/STATUS.md`.
- [ ] **The user asks for the push, then for the deploy.**

## Made by the command
- `src/heroes/sheath/numbers.ts`
- `src/heroes/sheath/spells/firstSpell.ts`
- `src/heroes/sheath/spells/secondSpell.ts`
- `src/heroes/sheath/spells/thirdSpell.ts`
- `src/heroes/sheath/spells/ultimate.ts`
- `src/heroes/sheath/fight.ts`
- `src/heroes/sheath/hero.ts`
- `src/heroes/sheath/trait.ts`
- `src/heroes/sheath/icons.ts`
- `pipeline/icons/vectorcraft/draw/kagen.py`
- `blender/heroes/real/sheath.py`
- `pipeline/designs/kit-sheath.md`
- `docs/lore/codex/heroes/kagen.md`
- `docs/heroes/new/sheath.md`
- `docs/lore/LORE.md`: its entry (status `draft`), `Kagen` in the members of `loners`, its line under Origins

To take the draft out again (its files and its lore stub): `python pipeline/tools/new-hero.py "Kagen" --remove --yes`.
