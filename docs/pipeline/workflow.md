---
title: Effect workflow
tags: [pipeline, workflow, process]
updated: 2026-10-29
---

# Effect workflow

How an effect goes from an idea to a registered, reviewed effect: the design note, the build (usually by a worker
agent with a brief), contact-sheet review rounds, registration, the self-test sweep, and the records that keep the
catalog and the hand-over current. Hero kits follow the same steps with one kit sheet for four spells.

## The steps

| # | Step | Output | Where |
|---|---|---|---|
| 1 | **Decide what it is**: name, element, who uses it, how strong (a starter slash or a finisher cutscene) | one line | the design note's first lines |
| 2 | **Pick the palette row and references** (art bible §2, `pipeline/library`, the user's videos) | palette, 2–3 references | the design note |
| 3 | **Design note**: the shape that makes it ours, model / drawn assets, distortion, camera, timeline in seconds, telegraphs, damage, what to exaggerate | `pipeline/designs/<slug>.md` | [designs](../../pipeline/designs) |
| 4 | **Build**: one effect file (an `Effect` class plus its `EffectModule`), using the parts kit | `src/spells/<family>/<name>.ts` | worker agent with a brief |
| 5 | **Register**: import and list entry in the family's `index.ts` | registry entry | `src/spells/*/index.ts` |
| 6 | **Type-check**: `npx tsc --noEmit` | clean | |
| 7 | **Review**: contact sheets at the key beats, from the camera the player will use; fix notes in one message per round; usually 2 rounds | `docs/spells/<slug>_sheet.jpg` | [review tools](review-tools.md) |
| 8 | **Sweep**: the self-test over every registered effect | all ok | [review tools](review-tools.md) |
| 9 | **Record**: `pipeline/forged.json`, the catalog row, `docs/STATUS.md`; a lesson row in the art bible if one was learned | records | |

## Briefs for worker agents
Workers get a short prompt that points at a brief and a design note, never a retelling:

| Brief | For |
|---|---|
| [SPELL_BRIEF.md](../SPELL_BRIEF.md) | Writing a set-piece effect (style, kit, brightness rules, hard rules) |
| [TARGETED_SPELL_BRIEF.md](../TARGETED_SPELL_BRIEF.md) | Writing a targeted effect (CastContext, telegraphs, hits) |
| [REFINE_BRIEF.md](../REFINE_BRIEF.md) | Polishing an existing effect with mechanical changes |
| [WEAPON_AURA_BRIEF.md](../WEAPON_AURA_BRIEF.md) | A looping weapon aura |
| [kit-common.md](../../pipeline/designs/kit-common.md) | A hero kit: file ownership, MOBA timing, look lessons |

Rules that keep parallel workers from colliding: each worker owns its own files and never edits shared files
(`parts/index.ts`, `targeted/index.ts`, `src/heroes.ts`, `main.ts`); the reviewer registers and wires; workers do not
use the browser and do not commit; at most three workers run at once.

## The forge-vfx skill
`/forge-vfx <ideas, recipe ids or a query>` in Claude Code runs steps 1–9 for targeted spells from free-text ideas
or recipes in the reference library (`pipeline/library/index.json`, rebuilt and validated with
`node pipeline/build-index.mjs`). The skill: [.claude/skills/forge-vfx/SKILL.md](../../.claude/skills/forge-vfx/SKILL.md).

## Hero kits
A kit is four spells for one hero plus its model:
1. Kit sheet `pipeline/designs/kit-<theme>.md` (blood: `blood-kit.md`): hero line, palette row with a pale foil,
   the signature shape, material rules, the shared parts API, and the four spells inline with MOBA timing
   (Q/W/E hit at 0.4–0.8 s and clean by ~2 s; R hits around 2.0–2.5 s and is clean by 4.5 s, under the gameplay
   camera, with one dead beat and one short impact frame).
2. One worker per kit builds `src/effects/parts/<theme>.ts`, the four spells and `src/kits/<theme>.ts`.
3. The reviewer registers the spells, adds the kit to `HERO_KITS`, reviews all four in rounds, and adds the
   palette row and lessons to the art bible.
4. The model: concept, Blender build, export (see [models](../architecture/models.md)).

## Records
| File | Holds |
|---|---|
| `pipeline/forged.json` | One entry per forged effect: label, file, mode, recipes, date, tier, kit, slot, note, self-test result |
| `pipeline/designs/*.md` | The design note of every designed effect and kit |
| `docs/spells/*_sheet.jpg` | The latest review sheet per effect (and combined sheets for re-checks) |
| [catalog/effects.md](../catalog/effects.md) | The human-readable list of every effect |
| [STATUS.md](../STATUS.md) | Done, in progress, blocked, waiting on the user, known issues, next steps |

## See also
- [Review tools](review-tools.md)
- [Art bible](../ART_BIBLE.md) (§5 "How I work as the artist" is the same loop from the art side)
- [Effects and parts](../architecture/effects-and-parts.md)
- [Docs home](../README.md)
