---
title: VFX Tool documentation
tags: [index, home]
updated: 2026-11-10
---

# VFX Tool documentation

The knowledge base for VFX Tool, a browser-based real-time VFX editor (Three.js 0.186, Vite, TypeScript). It holds
287 effects (plus 13 test spells for the combat mechanics): particle presets, set pieces, cinematic hero spells and 40 playable MOBA hero kits with rigged hero
models. Start with the guide if you want to use the tool, the architecture section if you want to change it, and
the art direction and pipeline sections if you want to make new effects the way the existing ones were made.

![The first five heroes in the game](heroes/ingame_sheet.jpg)

## Start here
| Page | What it answers |
|---|---|
| [CLAUDE.md](../CLAUDE.md) | The working rules the user set (commits, pushes, deploys, credentials, agents) and the lessons learned |
| [Status](STATUS.md) | What is done, live, in progress, waiting on the user, and next |
| [Setup](SETUP.md) | A new computer: install, clone, check, what is not in git, deploying |
| [Showcase](SHOWCASE.md) | Pictures and clips of the game as it looks now |
| [Change log](../src/game/changelog.ts) | What players got and when (shown in the game's News tab) |

## Map of content

### Guide (use the tool)
| Page | What it answers |
|---|---|
| [Using the tool](guide/using-the-tool.md) | How to run it, the modes (particles, effects, targeted arena, play mode, hero mode), every control and key |

### Architecture (change the tool)
| Page | What it answers |
|---|---|
| [Overview](architecture/overview.md) | How the shared runtime (`runtime.ts`) builds, plays, updates and renders effects for the VFX tool and the game; post chain; distortion; screen feedback; the `vfx` debug handle |
| [Effects and parts](architecture/effects-and-parts.md) | The `Effect` / `EffectModule` contract and every shared part (core kit and the hero-kit parts files) |
| [Targeting and arena](architecture/targeting-and-arena.md) | `CastContext`, targeting modes, the arena (caster, enemies, HP, hits), danger zones |
| [Hero mode](architecture/hero-mode.md) | The MOBA test mode: input, aim, cooldowns, HUD, hero switching, overlapping spells, hero figures |
| [Hero identity layer](architecture/traits.md) | Passives, own resources, hold / recast / ammo inputs, stacks, per-hero attacks and walk speeds, buffs and debuffs; how a duel hit is resolved; online rules |
| [Basic attacks](architecture/attacks.md) | Right-click attack, A attack-move, S stop; melee swing and ranged homing bolt; blind, stun and shield rules; the attacker in hero mode and the duel AI |
| [Duel arenas](architecture/arenas.md) | The five arenas (layouts, looks, stages), how a duel picks one (random, or from the match id online), and the rules for a new arena |
| [Combat mechanics](architecture/mechanics.md) | Statuses, shield / heal / dash, skillshots, summons, melee kits, the duel AI rules, the test kits and the tournament tool |
| [Models](architecture/models.md) | The Blender pipelines for weapons and hero figures, and how the game loads and poses them |
| [The hero shop](../pipeline/designs/hero-shop.md) | Heroes bought with obols earned by playing: the starters, the prices, the week's free heroes, founders, what pays, the raid ranks and the week's boards; every decision, the messages and how to switch it off. How the server does it: [multiplayer.md](architecture/multiplayer.md#the-hero-shop-raid-ranks-and-the-weeks-boards). Pictures: [shop/shop.html](shop/shop.html) |
| [The Tower](architecture/tower.md) | The third mode: a climb of the week's Tower, floor by floor. The run, the six kinds of floor, the boons, the week's seed, the room, and the hooks the engine should get. Pictures: [tower/tower.html](tower/tower.html) |
| [Multiplayer duel game](architecture/multiplayer.md) | `/game.html`: the game server (accounts, lobbies, queue, referee), the protocol, network matches, the ring's pillars and walls, line of sight |
| [Research: MOBA design](research/moba-design.md) | What defines a MOBA, what short formats (HotS, LoL Arena, Battlerite) kept and cut, and seven recommendations for our 1v1 duel |
| [Research: game networking](research/game-networking.md) | Lockstep, authoritative server + prediction, rollback, lag compensation; real tick rates; a three-stage path for our netcode |

### Art direction (how it should look)
| Page | What it answers |
|---|---|
| [Art bible](ART_BIBLE.md) | Our look, palette rows (one per element and hero kit), shape language, the artist's workflow, the do/don't table |
| [VFX principles](VFX_PRINCIPLES.md) | The technique checklist: shape → timing → colour, layering, impact frames, readability |
| [Weapon VFX guide](WEAPON_VFX_GUIDE.md) | Looping weapon "enchant" auras, learned from a reference set |

### Pipeline (how effects are made)
| Page | What it answers |
|---|---|
| [Rules for creating a hero](pipeline/new-hero.md) | The ten rules, the six gates (each ends in a picture and the user's yes) and the checklist of every file, from the idea to the deploy |
| [Performance tool](pipeline/performance.md) | `python pipeline/tools/perf.py`: fixed scenes of the real game timed frame by frame with the real graphics card, loading, where a frame's time goes; what was found, the rules that keep the game fast, the Graphics setting. The results: [perf/performance.html](perf/performance.html) |
| [Fight simulator](pipeline/simulator.md) | `python pipeline/sim/sim.py`: CPU duels on the game's own code in many hidden browsers at once, the results as a page (win rates, who beats whom, where the damage comes from) |
| [Rough Rust model](pipeline/rust-model.md) | `rustsim whatif "Anka" hp=480`: a quick estimate from sheets fitted to the real simulator's fights; how close it is, what it cannot see, how to refresh it |
| [Full Rust simulator](pipeline/rust-sim.md) | The fight rules written again in Rust: in the making. What is ported, how it is graded against real fights, and the finding that the duel's two computer players are not equal |
| [Workflow](pipeline/workflow.md) | From idea to registered effect: design note, build, review rounds, registration, sweep, records |
| [Review tools](pipeline/review-tools.md) | Contact sheets, the self-test, the full sweep, decoding, browser-pane gotchas |
| [Spell brief](SPELL_BRIEF.md), [Targeted spell brief](TARGETED_SPELL_BRIEF.md), [Refine brief](REFINE_BRIEF.md), [Weapon aura brief](WEAPON_AURA_BRIEF.md) | The briefs given to worker agents that write or polish effects |
| [Hero kit rules](../pipeline/designs/kit-common.md) | The shared rules every hero kit follows (files, MOBA timing, look lessons) |

### Catalog (what exists)
| Page | What it answers |
|---|---|
| [Effects](catalog/effects.md) | Every registered effect by category, with links to source, design note and contact sheet |
| [Heroes](catalog/heroes/README.md) | The 40 heroes and their kits. The original twenty: Vesper (blood), Brannoc (forge), Isolde (frost), Lyra (astral), Vitriol (alchemy), Kaia (storm), Sefu (sand), Nyx (shadow), Fenna (grove), Auriel (dawn), Marin (tide), Zephyr (sky), Mortis (bone), Ada (clockwork), Opaline (prism), Sirix (hive), Cantor (bard), Oblivion (void), Shiori (ink), Tempo (chrono); and 19 newer ones from Silvane (mirror) to Wick (door) and Pim and Pom (twins); and hero 40, Anka (phoenix), the first made by the rules for creating a hero |

### Knowledge (what we learned)
| Page | What it answers |
|---|---|
| [Lessons](knowledge/lessons.md) | Technical gotchas and fixes (shaders, post passes, instancing, materials, the browser pane) |
| [Retargeting arms](knowledge/retargeting-arms.md) | How the animator's clips are fitted to our heroes: rest poses, foot and hand goals, keeping arms out of robes and bellies, with the sources |
| [Glossary](knowledge/glossary.md) | The project's words: impact frame, telegraph, foil, dead beat, kit, lingering, ... |
| [League kit design](knowledge/league-kit-design.md) | Why League's kits work: 14 principles, what its reworks fixed, how our 20 kits compare, a kit checklist and what to do first |
| [WoW raid mechanics](knowledge/wow-raid-mechanics.md) | World of Warcraft's raid bosses, Classic to Midnight (2026): about 25 kinds of mechanic with the bosses that use them, how they scale with raid size, the newest raids boss by boss, what players love and hate (with the few numbers that exist), and what it means for our three bosses. The researchers' notes per era: `knowledge/wow-raid-research/` |
| [League champion kits](knowledge/league-champion-kits.md) | All 173 League champions read as a designer would, with counts across the roster |

### Project state
| Page | What it answers |
|---|---|
| [Status](STATUS.md) | The hand-over: what is done, in progress, blocked, waiting on the user, known issues, next steps |

## Where things live
| Path | Contents |
|---|---|
| `src/` | The apps: `runtime.ts` (shared scene), `tool/` (VFX tool), `game/` (duel game), `arena.ts`, `heroMode.ts`, `heroes.ts`, `duel.ts`, `obstacles.ts`, `kits/`, `effects/` (framework, parts, weapons), `spells/` (effects by family), `game/` + `net/` (the duel game page) |
| `server/` | The duel game's Node server (`game-server.mjs`, `accounts.mjs`, `standalone.mjs`, `smoke-test.mjs`); accounts in `server/data/` (git-ignored) |
| `game.html` | The duel game's page (the editor is `index.html`) |
| `worker/`, `wrangler.jsonc` | The Cloudflare deployment (Worker + Durable Object running `server/hub.mjs`) |
| `public/models/` | Exported models: `weapons/`, `figures/`, `heroes/` |
| `blender/` | Blender scripts that build the models (`weapons/`, `heroes/`) |
| `pipeline/` | The effect pipeline: `designs/` (one note per effect or kit), `library/` (reference breakdowns), `forged.json` (record of forged effects), `tools/` (review tools) |
| `docs/` | This knowledge base; `spells/` (contact sheets), `heroes/` (concept and model sheets), `weapons/` (weapon sheet) |
| `.claude/skills/forge-vfx/` | The `/forge-vfx` skill (prompt-to-effect pipeline) |

## How to keep this current
- A new effect: its design note in `pipeline/designs/`, a row in [catalog/effects.md](catalog/effects.md), an entry
  in `pipeline/forged.json`.
- A new hero kit: a page in `catalog/heroes/`, a palette row in the art bible, an entry in `src/heroes.ts`.
- A new lesson: a row in the art bible's do/don't table (look) or in [knowledge/lessons.md](knowledge/lessons.md)
  (technique).
- Every session: [STATUS.md](STATUS.md).
