# The hero framework: brief (the user said yes, 2026-11-16)

The user asked for "a fully custom engine for this game, with the idea of adding new heroes, so it's easier to build new heroes".
The parent advised against a new engine (months of rewriting the duels, the Raid, the Climb, online play and the simulators,
and a new hero would still need the same spells, model, icons and lore) and proposed instead rebuilding **how heroes are made** on
the engine we have. The user said yes, with Anka as the first sample.

## Why

One hero today is spread over about 16 files in different folders. Anka: `src/kits/phoenix.ts` (the kit, 650 lines),
`src/spells/targeted/` (`emberFlight`, `emberQuill`, `fanTheFlames`, `firebird`, `redLotusInferno`, `vermilionPhoenixDive`),
`src/spells/weapons/phoenixFan.ts` and `strikes/phoenixGale.ts`, `src/traits/phoenix.ts`, `src/effects/parts/phoenix.ts`, the
registry in `src/heroes.ts` and `src/spells/weapons/index.ts`, the Raid's `src/raid/upgrades.ts`. Then her model (`blender/heroes/real/`),
lore (`docs/lore/`), icons (`src/icons/`, `pipeline/icons/`), balance (`pipeline/sim/`), and the full Rust simulator if ported
(`pipeline/rustfull/`). Each new hero means touching all of these by hand, in the right order (`docs/pipeline/new-hero.md`).

## What to build

1. **One folder per hero** (e.g. `src/heroes/anka/`): kit, spells, passive (trait), weapon and strikes, effect parts, icon
   files or their loader entry, the look's entry (model path, body size), and a pointer to its lore and model build. The game
   finds heroes by itself (e.g. `import.meta.glob`), so no registry is edited by hand; lazy loading stays as it is today or better
   (the page's start must not grow).
2. **Spell building blocks.** Read all 40 kits and list what their spells are made of (a bolt, a line skillshot, a dash or blink, a
   ground zone with a delay, a cone, a shield or buff, a summon, a status: slow, stun, root, silence, knockback...; the effects in
   `src/effects/` and the engine pieces in `src/mech/`). Make these blocks a small, typed vocabulary, so a typical spell is a short
   description (numbers, shape, timing, look) and code is written only for what is truly new. Keep every existing hook (aim kinds,
   bank shots, over-cover, buffs and debuffs, `mechFor`, traits' `dealt` / `victimTick`, the CPU's use of a spell).
3. **A "new hero" command** (`python pipeline/tools/new-hero.py <name>` or a node script) that makes the folder, the lore entry in
   `docs/lore/LORE.md` (rule 0: the lore first), the kit outline from the blocks, the model build file in `blender/heroes/real/`, the
   icon command-file stubs, and the checklist of `docs/pipeline/new-hero.md`'s gates filled in for that hero.
4. **A hero workbench page** on the tool page (`/`, which already edits VFX): pick a hero, change its numbers and blocks live, fight
   the CPU or a dummy, see each spell's reach and timing, and run its balance check (`pipeline/sim/sim.py hero <Name>`) from there.
5. **Automatic checks on a hero change:** the simulator's win rate inside the noise, online sync (both screens agree; the `stacks`
   / `#` relay), the icon at 32 px, the model's size and triangles, the lore's checks (`lore-page.py`, `lore-codex.py`), and the
   hero's **fight print** (below). One command runs them all for one hero.

## The condition: no hero plays differently

Moving heroes into the new shape is a refactor. Prove it, hero by hero:
- **Fight prints.** The perf tool's prints are now the same every run (`docs/perf/data/prints.json`, `pipeline/tools/perf-page.js`:
  a clock that starts at the same moment and dice of their own for late arrivals). Add a fixed scripted duel per hero (each hero
  against a fixed opponent on a fixed arena, the same inputs) whose print is taken **before** the move and must be identical after.
  All 40 prints before any change; each moved hero's print equal after.
- **The simulator** on the moved hero (`sim.py hero <Name>`) inside the noise of its last result.
- **The Rust simulator's guard** (`python pipeline/rustfull/guard.py`): it already failed before; don't make it worse; say what it
  lists.
- **Online:** two tabs, one moved hero against another, both screens agree.

## Order

1. Audit (read all 40 kits, the effects, traits, weapons, mech, how the CPU uses spells, how the Raid and Climb use heroes, the
   Rust port) and write the design: the folder layout, the blocks' vocabulary, what stays code. `docs/pipeline/hero-framework.md`.
2. Take all 40 fight prints on today's code.
3. Move **Anka** as the sample, with the blocks she needs; show before and after: files touched, lines, how her kit reads now, the
   checks passing. That is the sample for the user.
4. Then the other 39 in batches (about 8 a batch), each batch with its prints equal and a commit.
5. The "new hero" command and the workbench page, then `docs/pipeline/new-hero.md` rewritten for the new way.

## Rules

- Shared engine files (`src/heroMode.ts`, `src/arena.ts`, `src/duel.ts`, `src/main.ts`): one writer at a time (CLAUDE.md). Start only
  when no other agent writes them, or have the parent hold the others.
- Don't change any hero's numbers, look or behaviour on the way: anything found broken goes in a list for the user.
- Commit by explicit path; no push, no deploy; every wait ends within 10 minutes.
