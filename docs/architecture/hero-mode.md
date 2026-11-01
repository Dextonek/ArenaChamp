---
title: Hero mode and hero kits
tags: [architecture, hero-mode, kits, input, camera, hud]
updated: 2026-10-29
---

# Hero mode and hero kits

A MOBA-style test mode for one hero kit: click to walk, Q / W / E / R to aim and cast four spells, cooldowns, a HUD bar and a fixed follow camera. This page covers the controller ([heroMode.ts](../../src/heroMode.ts)), the kit data ([heroes.ts](../../src/heroes.ts), `src/kits/*.ts`) and how [main.ts](../../src/main.ts) wires them. Read it before adding a hero, changing the controls or touching how spells overlap.

## Concept

A hero kit is **data only**: four spells bound to Q W E R (R is the ultimate). Each spell is an ordinary registered effect looked up by label, so a new hero is a new `HeroKit` entry plus four targeted effects (category `hero: <kit>`, registered in `src/spells/targeted/index.ts`). Hero mode runs on top of play mode (no auto-framing, effects follow the caster), with its own camera, indicators and HUD. The arena keeps HP between casts and respawns enemies (`arena.persist`, see [targeting-and-arena.md](targeting-and-arena.md#persist-and-respawn)).

## Kit data ([heroes.ts](../../src/heroes.ts))

| Type | Fields |
|---|---|
| `HeroKey` | `'Q'`, `'W'`, `'E'` or `'R'` |
| `HeroSpell` | `key`, `label` (registered effect label), `name` (bar text), `range` (ground units from the hero; ignored for self-cast), `cooldown` (s), `blurb` (tooltip), `icon(g, size)` (canvas 2D draw function) |
| `HeroKit` | `name`, `title`, `accent` (bar and aim-indicator colour), `foil` (pale colour for rings and text), `portrait(g, size)`, optional `model` (path under `public/`), `spells` (exactly four) |

`HERO_KITS = [bloodKit, forgeKit, frostKit, astralKit, alchemyKit]`, each with `model` filled from the `MODELS` map by hero name when the kit has none:

| Hero | Title | Kit data | Spells (Q W E R) | Model |
|---|---|---|---|---|
| Vesper | the Crimson Countess | inline in [heroes.ts](../../src/heroes.ts) | hemolance, thorn garden, crimson pact (self), sanguine eclipse | `models/heroes/blood.glb` |
| Brannoc | the Ashen Smith | [kits/forge.ts](../../src/kits/forge.ts) | rivet shot, anvil drop, bellows ward (self), forgefall | `models/heroes/forge.glb` |
| Isolde | the Winter Warden | [kits/frost.ts](../../src/kits/frost.ts) | rime spear, frostfern field, glacial mantle (self), winter's crown | `models/heroes/frost.glb` |
| Lyra | the Star Archer | [kits/astral.ts](../../src/kits/astral.ts) | starshot, constellation snare, orbit veil (self), celestial hunt | `models/heroes/astral.glb` |
| Vex | the Plague Alchemist | [kits/alchemy.ts](../../src/kits/alchemy.ts) | volatile flask, caustic pool, mutagen (self), grand transmutation | `models/heroes/alchemy.glb` |

Self-cast spells have `range: 0`. Ranges for the others run 10-14, cooldowns 2.5-10 s for Q/W/E and 20 s for R. Icons and portraits are drawn on canvases in each kit's palette (the same palette as that kit's parts file, see [effects-and-parts.md](effects-and-parts.md#hero-kit-parts)). The figures are built by Blender, see [models.md](models.md).

To add a hero: write the four effects (label, `category: 'hero: <name>'`, `targeting`), register them, create a `HeroKit`, add it to `HERO_KITS`, add its model to `MODELS`.

## Controller ([heroMode.ts](../../src/heroMode.ts))

`HeroMode` takes a `HeroModeHost` from main.ts:

| Host member | Purpose |
|---|---|
| `arena`, `camera`, `dom` | shared arena, the camera it drives, the canvas element for pointer events |
| `targeting(label)` | the `TargetingSpec` of a registered effect (undefined if unknown or not targeted) |
| `cast(label)` | casts the effect on the arena's current target; returns the seconds the hero stays rooted |
| `nextKit?()` | click on the portrait: switch to the next hero |

### Input model

| Input | Action |
|---|---|
| Left click on ground (not aiming) | walk there; clears a pending cast; shows a shrinking marker |
| `Q` `W` `E` `R` or click a HUD slot | start aiming that spell; same key again cancels. On cooldown: toast "is on cooldown". Non-targeted effect: toast "not a targeted effect". **Self-mode spells cast immediately** |
| Left click while aiming | confirm the cast |
| Right click or `Esc` while aiming | cancel (right click while not aiming also orders a move) |
| Right click on an enemy or summoned unit (not aiming) | basic attack: walk into range and keep attacking it until another order ([attacks.md](attacks.md)) |
| `A`, then left click | attack-move: on an enemy, attack it; on the ground, walk there and attack the first enemy in range |
| `S` | stop: no walk, no attack, no pending cast |
| Q W E R on a hold spell (traits: Kaia Q, Sefu W) | aim as usual; the longer you aim before the click, the stronger the cast (full after the hero's hold time) |
| Q W E R in a recast window (the slot shows RE) | the same spell once more, free, at 60% damage |
| Mouse wheel | zoom (factor clamped 0.55-1.7, default 1.25) |

`enemy` / `enemies` spells need a living enemy within 2.2 units of the cursor (`HOVER_PICK`), else the toast "No enemy there". `ground` spells aim at the cursor point clamped to the spell's range.

### Aim indicators

All are flat `MeshBasicMaterial` meshes recoloured from the kit by `setKit`:

- range ring around the hero (kit `foil`), radius = spell range;
- single-target spells: an aim strip from the hero to the hovered enemy (or toward the cursor), clamped to range, and a hover ring on the enemy (accent when in range, foil when out of range);
- ground spells: an area circle plus fill at the clamped cursor point, radius from the spec's `radius` (default 5);
- the move-order marker.

### Range, walk-into-range, rooting, cooldowns

- If the target is out of range when you confirm, the cast becomes `pending` and the hero walks toward the target (`HERO_SPEED = 4`, MOBA-slow since 2026-10-30); once within `spell.range` it casts. Any new move order drops the pending cast. A pending enemy that dies cancels it.
- `castNow` sets the arena target (`setTarget` for an enemy, `setGroundPoint` for a point), calls `host.cast(label)` and stores the returned time as `rooted` (no walking while rooted). main.ts returns the latest danger-zone `impact` of the new cast (capped at 2.5 s), or 0.4 s when the spell has no zones, so the hero stays rooted until the spell lands.
- Cooldowns count down in `update`; the slot flashes on cast. `setKit` and `setEnabled` clear cooldowns, aim and pending orders.

### Camera

`followCamera` keeps a fixed top-down offset `CAM_OFFSET = (0, 15, 10.5)` scaled by the zoom, lerped to the hero (rate 12, snapped on entry), looking at `(hero.x, 0.5, hero.z - 1.5)`. main.ts disables `OrbitControls` while hero mode is on.

### HUD

A fixed bottom bar built by `buildHud` (rebuilt by `setKit`), tinted from the kit `accent`: a round portrait (click = `nextKit`), name and title with a control hint, and four slots with canvas icon, key badge, spell name and a conic cooldown shade with seconds. The R slot is larger with gold framing and an "ULT" label. Hovering a slot shows a tooltip (name, key, blurb, range or "self", cooldown). A toast line shows short messages.

### Figures: walk, breath, cast

The arena's capsule caster is hidden (its children set invisible) and replaced by the kit's `Hero` figure ([hero.ts](../../src/effects/weapons/hero.ts), options `shade: 0.9, maxEmissive: 1, tintSheen: true`). Figures are cached per model url, so switching back to a hero reuses its loaded figure. `showFigure` swaps them; `poseFigure` runs every frame and layers bone rotations on top of `resetPose()`:

- **walk:** a smoothed `walkAmount` (on when speed is above 0.5) drives a phase at 9 rad/s; thighs, shins and arms swing, the root bobs 0.05, the chest leans;
- **breath:** a slow chest oscillation (`sin(clock * 1.8)`) at rest;
- **cast:** while `rooted > 0` the right arm and forearm are thrown forward and the chest turns into it.

Poses use the bone names `thighL/R`, `shinL/R`, `armL/R`, `foreR`, `chest` (see [models.md](models.md#runtime-srceffectsweaponsherots)). The figure follows the caster's position and yaw.

### `setKit(kit)` and `setEnabled(on)`

`setKit` recolours the indicators, rebuilds the HUD, clears aim, pending orders and cooldowns, and shows the kit's figure. `setEnabled(on)` shows or hides the group and HUD, sets `arena.pickEnabled = !on` and `arena.persist = on`, clears orders, and on entry clears the selection and snaps the camera.

## Wiring in main.ts

- **Creation:** `new HeroMode({ arena, camera, dom, targeting, nextKit, cast }, HERO_KITS[0])`, group added to the scene.
- **Entering** (`setHeroMode(true)`; `H`, or the "hero mode (H)" checkbox in View): `keepLingering = true`; `setPlayMode(true)`; hotbar hidden; `arena.reset()`; orbit controls disabled; `heroMode.setEnabled(true)`; **kit bloom** `{ enabled: true, strength: 0.45, radius: 0.4, threshold: 0.86 }` applied (the particle preset's low threshold would make pale costumes glow until the first cast; the spell modules' own `bloom` is still applied by `setMode` on each cast).
- **Leaving:** `dropLingering()`, `heroMode.setEnabled(false)`, controls back on, `setPlayMode(false)`, `arena.reset()`. `P` also exits hero mode, and unchecking "play mode" does too.
- **Hero dropdown:** View > hero lists `HERO_KITS` names and calls `heroMode.setKit(kit)`; it works with hero mode off too, so the next entry starts with that hero.
- **Portrait cycling:** the `nextKit` callback sets the dropdown to the next kit (modulo the list) through `heroPickCtrl.setValue`, which fires the same `setKit` path.
- **Casting:** `cast(label)` calls `selectMode(label)`, so each spell becomes the `active` effect and plays at the arena's target; the rooted time is derived from `zones` (see above).
- **Overlapping spells:** while `keepLingering` is true, `setMode` moves the previous active slot into the `lingering` set if it is still `playing` instead of hiding it. `step` updates lingering effects until they stop, `liveEffects()` includes them for shake, `pickScreen` and the distortion scan. Re-casting the same spell is the `selectMode` replay path (`play()` restarts the same effect, it does not create a second copy). Only the active effect's cinematic camera is honoured.
- **Disabled elsewhere in hero mode:** hotbar digits 1-5, WASD caster walking (`walk`), `controls.update()`. The stats line shows the hero-mode controls plus hits and kills.
- **Debug:** `vfx.heroMode`, `vfx.setHeroMode(true)`, `vfx.heroPickCtrl.setValue('Lyra')`.

## Duel ([duel.ts](../../src/duel.ts))

A 1 vs 1 round on top of hero mode. `Duel` (constructed in main.ts with a `DuelHost`: arena, hero mode, kits,
`castAs`, targeting lookup) owns the ring, the opponent and the duel HUD.

| Piece | How |
|---|---|
| Setup (`start`) | Opponent kit = the chosen one or a random other kit (never the player's: one effect instance per label). Arena: one foe, `maxHp` 600, `respawnAfter` Infinity, `bounds` = the ring (centre (0, 7), radius 12); player at (0, 0, 13), opponent at (0, 0, 1). The foe's capsule is hidden under a `HeroFigure`. Each start bumps a round id. |
| Opponent casting | `arena.contextFor({ caster, from, point, targets: [player], hit })` builds a cast context for the foe; main.ts `castAs(label, ctx)` plays the effect through a one-shot override in the play wrapper and adds it to `lingering`, so the player's active effect, panel and camera stay. It returns the effect's danger zones, drawn by the duel's own `TelegraphLayer` on its own clock. |
| Dodging | The context's `hit` checks the player at the moment of the hit: inside one of that cast's zones (`insideTelegraph`) or within 1.6 of where it aimed → damage (number, red edge flash, knockback inside the ring); otherwise one DODGED label. Hits from an earlier round are ignored. |
| AI | Waits 1.2 s, then each frame: rooted until its spell's latest impact (≤ 2.5 s); else the first ready spell in the order R, E, W, Q that is in reach (R only when the player is under 55% HP or after 20 s; E when the player is inside its radius); else walk to ~70% of Q's range and strafe, flipping every 1.5–3.5 s. Speed 6. |
| End | Opponent HP 0 → VICTORY, player HP 0 → DEFEAT: hero mode `locked`, the loser's figure falls, a card with Rematch / Leave duel. |
| main.ts | `setDuel(on)` (View → duel, key B; turns hero mode on), View → opponent, a new round when the hero changes, the duel ends with hero mode. |

**Cover and line of sight:** the ring has a centre wall, four pillars and two side walls (`DUEL_OBSTACLES` in
[obstacles.ts](../../src/obstacles.ts), set as `arena.obstacles` while the duel is on). They block walking and line of
sight; a targeted spell needs sight of its target (hero mode turns an unseen cast into walk-then-cast, the AI only
picks spells it can see with). Details in [multiplayer.md](multiplayer.md#the-ring-pillars-walls-and-line-of-sight).

**Network duel:** `startNet({ opponent, side, names, net })` runs the same ring against another player
(`/game.html`): no AI, the opponent moves and casts from `peerMove` / `peerCast`, hits on the remote hero come from
`peerHit`, this side's hits and dodges go out through `net`, the server ends the round with `netEnd`. `HeroMode`
gained `onCast(label, slot, target)`, `flipCamera` (side 1 looks from -Z) and `snapCameraNow()`. See
[multiplayer.md](multiplayer.md).

`HeroFigure` ([heroFigure.ts](../../src/heroFigure.ts)) is the shared model driver for the player's hero and the
opponent. All motion is procedural, on the rig every hero GLB shares (pelvis, chest, neck, head, arms, legs, feet,
plus `sway_*` chains); there are no animation clips.

| Call | What it does |
|---|---|
| `setModel(url, at, kit)` | Swaps the model (cached per url). The kit sets the style: heavy (HP above 600) plants wider and sways the chest more; fast (speed above 4.1) leans in and runs with bent arms; melee keeps a guard up. |
| `follow(dt, pos, yaw, state)` | Every frame. `state` = `{ attack: Attacker.motion, status: StatusSet, held }`. It layers rest (breath, weight shift, look round), a walk scaled to the real speed (hip twist, chest counter-turn, lean into starts and turns), the basic attack (melee slashes alternate arms, hammer and greatsword (attack look `smash`, `cleave`) swing overhead, ranged flicks), the cast pose, stun slump, knock-up flail, root tug, the hit flinch and the sway springs. `held` freezes the pose (ice block). A dt of 0 (paused) only places it. |
| `cast(style, seconds, big)` | Called right after a cast roots the hero (`HeroMode.castNow`, `Duel.castSpell`, so online peers too): wind-up, a snap into the strike with a little overshoot, then settle. `castStyle(spell, slot, onEnemy, melee, seconds)` picks the style from the spell data: dash = lunge, summon = raise, self-cast = burst (a long one without CC = channel), melee range = swing, skillshot = thrust, clicked enemy = point, other ground spells = slam. Slot R plays 18% bigger. |
| `hit(strength, tint, from)` | Flinch away from `from` and a tinted flash (`Hero.setFlash`). The player's hero gets it from `Duel.damagePlayer` (`HeroMode.figureHit`, also a small camera shake on 25+ damage); the opponent from its capsule flash jumping (`Arena.flashOf`). Blocked hits never reach it. |
| `fall(t)`, `stand()` | Knees give, chest folds, tips forward; `stand` drops every running pose. |

`pipeline/tools/pose-sheet.js` renders a contact sheet of every pose for one hero (see its header).

## See also

- [Architecture overview](overview.md)
- [Effects and shared parts](effects-and-parts.md)
- [Targeting and arena](targeting-and-arena.md)
- [Models pipeline](models.md)
- [Docs home](../README.md)
- [Art bible](../ART_BIBLE.md), [VFX principles](../VFX_PRINCIPLES.md)
