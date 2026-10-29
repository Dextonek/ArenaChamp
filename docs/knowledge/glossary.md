---
title: Glossary
tags: [knowledge, glossary]
updated: 2026-10-29
---

# Glossary

The words this project uses, with what they mean here and where the thing lives in the code.

| Term | Meaning | Where |
|---|---|---|
| **Effect** | One playable timed piece of VFX: a class with `group`, `play()`, `update(dt)`, `shake`, optional `screen` and `cinematic` | `src/effects/types.ts` |
| **Effect module** | The registry entry for an effect: label, category, targeting, bloom, camera framing, GUI, telegraphs | `EffectModule` in `types.ts` |
| **Category** | The family an effect is listed under in the dropdown (set pieces, targeted, hero: forge, ...) | `module.category` |
| **Parts kit** | Shared building blocks: star bursts, crescents, lightning, toon smoke, screen feedback, cinematic camera, distortion | `src/effects/parts/` |
| **Hero kit** | Four spells for one hero (Q W E R) plus a parts file, a palette row, kit data and a model | `pipeline/designs/kit-*.md`, `src/kits/` |
| **Q / W / E / R** | Hero-kit slots: Q a quick strike, W a zone, E a self aura, R the ultimate | `src/heroes.ts` |
| **Targeted** | An effect that aims at enemies or a ground spot picked in the arena | `src/effects/targeting.ts` |
| **Cast context** (`CastContext`) | What a targeted effect gets before each play: caster, origin, aim, targets, point, `hit`, `displace` | `targeting.ts` |
| **Arena** | The shared playground: the caster, enemies with HP, hits, knockback, death | `src/arena.ts` |
| **Telegraph / danger zone** | A red ground shape that fills as a countdown before a hit; the player can dodge it | `src/effects/telegraph.ts` |
| **Impact frame** | One or two full-screen frames at a big hit: black silhouettes on a pale card (or the reverse), with focus lines | `impactFrameAt` in `parts/screen.ts` |
| **Dead beat** | A short moment where everything stops just before the real hit | design notes |
| **Darken** | Dimming the world during a big move so the energy reads | `ScreenFx.darken` |
| **Foil** | A pale shape near dark or saturated energy so it reads against the dark floor (bone sigil, rime, star chart, glass) | art bible §2 |
| **Value ladder** | A palette row ordered core → hot → body → accent → dark; white only in the core | art bible §2 |
| **Signature shape** | The one shape that makes an effect or kit ours (frost ferns, cooling slag, constellations) | design notes |
| **Distortion** | Screen-space refraction: heat haze and shock rings drawn on their own layer | `parts/distortion.ts` |
| **Cinematic** | An effect that runs its own scripted camera with letterbox bars | `parts/cinematic.ts` |
| **Hero mode** | The MOBA test mode: click to move, aim and cast a hero kit, cooldowns, hero figures | `src/heroMode.ts` |
| **Lingering** | Hero-mode effects replaced by a newer cast that keep playing until they end | `main.ts` |
| **Persist** | Arena flag: HP and deaths carry over between casts; dead enemies respawn | `Arena.persist` |
| **Hero figure** | A rigged hero model on the Dao rig, posed at runtime | `src/effects/weapons/hero.ts`, `public/models/heroes/` |
| **Contact sheet** | A grid of frames of an effect at chosen times, used for review | `pipeline/tools/contact-sheet.js` |
| **Self-test / sweep** | Stepping an effect frame by frame for errors; the sweep does it for every effect | `vfx.selfTest` in `main.ts` |
| **Design note** | The written spec of an effect or kit, written before it is built | `pipeline/designs/` |
| **Forge** (`/forge-vfx`) | The skill that turns ideas or library recipes into targeted spells | `.claude/skills/forge-vfx/` |
| **Library / recipe** | Breakdowns of reference VFX into the layers our kit builds | `pipeline/library/` |

## See also
- [Lessons](lessons.md)
- [Art bible](../ART_BIBLE.md)
- [Docs home](../README.md)
