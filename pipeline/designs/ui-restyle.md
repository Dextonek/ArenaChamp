---
title: Interface restyle
tags: [design, ui, game, menus, hud]
updated: 2026-11-10
status: part 1 (the menu screens) built; part 2 (the in-fight screens) waits on the user
---

# Interface restyle (2026-11-10)

The user: "restyle all interfaces we have, make it look user friendly and exciting". The game's interfaces are the menu
screens of `game.html` (`src/game/main.ts`, `src/game/game.css`) and what is drawn over a fight (the hero panel and the duel
bar in `src/heroMode.ts` and `src/duel.ts`, the touch controls in `src/touch.ts`, the raid HUD and hall in `src/raid/`, the
result cards in `src/game/match.ts` and `cpu.ts`). The VFX tool (`index.html`) is the artist's own tool and is not part of this.

## The look

The same rule as the [art bible](../../docs/ART_BIBLE.md) sets for objects: **a dark lacquer body, gold structure, one bright
piece.** Before, every screen was a plain card on black in system fonts; it worked, but nothing moved and nothing said "game".

| | Before | Now |
|---|---|---|
| Behind the screens | flat black | the key art, darkened, with a violet light from above, a warm one from below and embers rising |
| Panels | a flat dark card | lacquer with a gold hairline, a top highlight and a gold mark in each corner |
| Headings | Georgia, one flat colour | a display serif in a gold gradient; section labels in small gold capitals with a line running off |
| Buttons | flat | gold with a light that sweeps across under the hand; the one button a screen is for breathes; every button lifts and presses |
| Tabs | text | an icon and a label, a glowing gold line under the open one |
| Motion | none | a new screen rises in, hero tiles deal in one after another, the chosen tile's ring breathes, a slow light turns behind the hero |
| Phone | the header wrapped to three lines | the tabs sit along the bottom under the thumb; the header is one line |

Anyone whose device asks for reduced motion gets none of the movement (`prefers-reduced-motion`).

Fonts: no font file is added. The display stack is `Cinzel, Trajan Pro, Palatino Linotype, Book Antiqua, Palatino, Noto
Serif, Georgia`, so it uses the best serif the device has. Bundling a real display font (for example Cinzel, an open
licence) would make headings the same on every device; that needs a download, so it is a question for the user.

## Friendlier, screen by screen (part 1, built)

- **Login:** the two fights that need no account come first, as two big doors ("Duel the CPU", "Raid the bosses"), then
  "or play online" and the form. The roster drifts by under the panel. A phone no longer opens its keyboard at once.
- **vs CPU and Raid:** the same hero select as Play (the turning model and the kit on the left, the choices on the right,
  the fight button along the bottom), instead of one long card. Without an account they get a small header with the two
  screens and a Log in button. Difficulty buttons run from green to red.
- **Lobbies:** an empty list says what to do next. **Profile, Heroes:** the new panels, tables and tiles.
- **Loading, the round pick, the toast:** the same fonts and glow.

Files: `src/game/game.css` (rewritten), `src/game/main.ts` (`icon`, `header`, `loginScreen`, `heroStrip`, `cpuScreen`,
`raidScreen`, the `enter` class in `render`). Sheets: `docs/ui/before_*.jpg`, `docs/ui/after_*.jpg`.

## Part 2, not built: the screens over a fight

| Interface | Where | What it needs |
|---|---|---|
| Hero panel (portrait, passive, Q W E R, cooldowns, hint) | `src/heroMode.ts` | the lacquer and gold of the menus, clearer cooldown and ready states, a flash when a spell comes back |
| Duel bar (both HP bars, rounds, clock) | `src/duel.ts` | bigger HP numbers, a damage trail on the bar, round pips in gold |
| 3-2-1 and DUEL!, the result card | `src/duel.ts`, `src/game/match.ts`, `cpu.ts` | the display font, a bigger entrance, Victory and Defeat with their own colour and motion |
| Touch controls | `src/touch.ts` | the same rings and gold as the hero panel |
| Raid: upgrade cards, boss bar, hall | `src/raid/hud.ts`, `hall.ts`, `run.ts`, `coop.ts` | the menu panels and buttons |

`src/heroMode.ts` and `src/duel.ts` are the shared engine files (one writer at a time), so part 2 is its own pass.
