---
title: Hero mode and hero kits
tags: [architecture, hero-mode, kits, input, camera, hud]
updated: 2026-11-04
---

# Hero mode and hero kits

A MOBA-style test mode for one hero kit: click to walk, Q / W / E / R to aim and cast four spells, cooldowns, a HUD bar and a fixed follow camera. This page covers the controller ([heroMode.ts](../../src/heroMode.ts)), the kit data ([heroes.ts](../../src/heroes.ts), `src/kits/*.ts`) and how the runtime ([runtime.ts](../../src/runtime.ts)) wires them. Read it before adding a hero, changing the controls or touching how spells overlap.

## Concept

A hero kit is **data only**: four spells bound to Q W E R (R is the ultimate). Each spell is an ordinary registered effect looked up by label, so a new hero is a new `HeroKit` entry plus four targeted effects (category `hero: <kit>`, registered in `src/spells/targeted/index.ts`). Hero mode runs on top of play mode (no auto-framing, effects follow the caster), with its own camera, indicators and HUD. The arena keeps HP between casts and respawns enemies (`arena.persist`, see [targeting-and-arena.md](targeting-and-arena.md#persist-and-respawn)).

## Kit data ([heroes.ts](../../src/heroes.ts))

| Type | Fields |
|---|---|
| `HeroKey` | `'Q'`, `'W'`, `'E'` or `'R'` |
| `HeroSpell` | `key`, `label` (registered effect label), `name` (bar text), `range` (ground units from the hero; ignored for self-cast), `cooldown` (s), `blurb` (tooltip), `icon(g, size)` (canvas 2D draw function), and the optional AI and aim flags (`cc`, `dash`, `escape`, `anytime`, `save`, `parry`, `barrier`, `summon`, `aim`, `bank`, `buff`, `debuff`; see [mechanics.md](mechanics.md)) |
| `HeroKit` | `name`, `title`, `accent` (bar and aim-indicator colour), `foil` (pale colour for rings and text), `portrait(g, size)`, optional `model` (path under `public/`), `maxHp`, `hpChunks`, `alt`, `base`, `attack`, `melee`, `spells` (exactly four; see [mechanics.md](mechanics.md#hero-traits-what-v5-added)) |

`HERO_KITS` lists 39 kits (20 original heroes and 19 added later), each with `model` filled from the `MODELS` map by hero name when the kit has none (`HeroKit.alt` kits set their own). Every kit is in `src/kits/<theme>.ts`. Each hero's page in the [hero catalog](../catalog/heroes/README.md) has its passive, numbers and spells.

| Hero | Title | Kit data | Spells (Q W E R) | Model |
|---|---|---|---|---|
| Vesper | the Crimson Countess | [kits/blood.ts](../../src/kits/blood.ts) | lancet, mist waltz, hemocurse, sanguine feast | `models/heroes/blood_v2.glb` |
| Brannoc | the Ashen Smith | [kits/forge.ts](../../src/kits/forge.ts) | chain hammer, forge roar, red-hot rivet, molten core | `models/heroes/forge_v2.glb` |
| Isolde | the Winter Warden | [kits/frost.ts](../../src/kits/frost.ts) | icicle, hoarfrost, rime armour, winter's shatter | `models/heroes/frost_v2.glb` |
| Lyra | the Star Archer | [kits/astral.ts](../../src/kits/astral.ts) | starfall arrow, twin stars, pinning arrow, meteor mark | `models/heroes/astral.glb` |
| Vitriol | the Plague Alchemist | [kits/alchemy.ts](../../src/kits/alchemy.ts) | toxin dart, fire vial, acid splash, homunculus | `models/heroes/alchemy.glb` |
| Kaia | the Tempest Caller | [kits/storm.ts](../../src/kits/storm.ts) | sky strike, thunder rod, polarity, supercell storm | `models/heroes/storm_v2.glb` |
| Sefu | the Dune Sovereign | [kits/sand.ts](../../src/kits/sand.ts) | cobra spit, shepherd's crook, scarab stride, sarcophagus | `models/heroes/sand_v2.glb` |
| Nyx | the Umbral Stalker | [kits/shadow.ts](../../src/kits/shadow.ts) | umbral cut, smoke veil, shadow double, nightfall | `models/heroes/shadow.glb` |
| Fenna | the Grove Warden | [kits/grove.ts](../../src/kits/grove.ts) | seed shot, strangle vine, pollen glide, world tree | `models/heroes/grove.glb` |
| Auriel | the Dawn Paladin | [kits/dawn.ts](../../src/kits/dawn.ts) | first light, dawnward, oathbrand, sunrise | `models/heroes/dawn_v2.glb` |
| Marin | the Tide Dancer | [kits/tide.ts](../../src/kits/tide.ts) | wave disc, coral spire, mist form, moon's pull | `models/heroes/tide.glb` |
| Zephyr | the Wind Blade | [kits/sky.ts](../../src/kits/sky.ts) | crosswind, skyward, feather step, sky rend | `models/heroes/sky_v2.glb` |
| Mortis | the Ossuary Lord | [kits/bone.ts](../../src/kits/bone.ts) | bone fan, raise dead, bone armour, grave grasp | `models/heroes/bone.glb` |
| Ada | the Artificer | [kits/clockwork.ts](../../src/kits/clockwork.ts) | homing drone, deploy turret, grapple hook, siege mode | `models/heroes/clockwork.glb` |
| Sirix | the Swarm Warden | [kits/hive.ts](../../src/kits/hive.ts) | barbed stinger, hive shell, swarm cloud, swarm surge | `models/heroes/hive.glb` |
| Cantor | the Last Verse | [kits/bard.ts](../../src/kits/bard.ts) | resounding chord, siren song, rising chorus, duet | `models/heroes/bard.glb` |
| Opaline | the Lightbreaker | [kits/prism.ts](../../src/kits/prism.ts) | ricochet light, crystal pillar, blinding flare, shatterlight | `models/heroes/prism.glb` |
| Oblivion | the Unmaker | [kits/void.ts](../../src/kits/void.ts) | gravity slam, null zone, phase step, void black hole | `models/heroes/void_v2.glb` |
| Shiori | the Last Brush | [kits/ink.ts](../../src/kits/ink.ts) | ink lash, seal of binding, flowing script, the last character | `models/heroes/ink.glb` |
| Tempo | the Unwound Hour | [kits/chrono.ts](../../src/kits/chrono.ts) | tick bolt, slow time, time skip, stolen hour | `models/heroes/chrono.glb` |
| Silvane | the Vain | [kits/mirror.ts](../../src/kits/mirror.ts) | hand mirror, vanity stand, through the glass, hall of mirrors | `models/heroes/mirror_v2.glb` |
| Bram | the Pillar Mason | [kits/mason.ts](../../src/kits/mason.ts) | raise gerald, the shove, a good lean, gerald no | `models/heroes/mason_v2.glb` |
| Hank | the Lumberjack | [kits/timber.ts](../../src/kits/timber.ts) | axe swing, fast growth, caber toss, timber call | `models/heroes/timber_v2.glb` |
| Professor Puff | balloon scientist | [kits/balloon.ts](../../src/kits/balloon.ts) | air hose, helium bomb, hot air, pop! | `models/heroes/balloon_v2.glb` |
| Sir Whiskers | the Cat Knight | [kits/cat.ts](../../src/kits/cat.ts) | scratch, knock it over, pounce, land on my feet | `models/heroes/cat_v2.glb` |
| Mr. Ledger | the Debt Collector | [kits/ledger.ts](../../src/kits/ledger.ts) | invoice, late fee, call it in, foreclosure | `models/heroes/ledger_v2.glb` |
| Big Yoko | the Sumo | [kits/sumo.ts](../../src/kits/sumo.ts) | palm strike, stomp, sumo charge, salt throw | `models/heroes/sumo_v2.glb` |
| Mum | the mime | [kits/mime.ts](../../src/kits/mime.ts) | invisible ball, mime wall, rope trick, the box | `models/heroes/mime_v2.glb` |
| Referee Whistler | by the book | [kits/referee.ts](../../src/kits/referee.ts) | whistle blast, no running, no casting, show the card | `models/heroes/referee_v2.glb` |
| Madame Cleaver | Arena Chef | [kits/chef.ts](../../src/kits/chef.ts) | thrown cleaver, hot soup, burnt offering, dinner is served | `models/heroes/chef_v2.glb` |
| Pip | the last courier | [kits/courier.ts](../../src/kits/courier.ts) | express letter, fragile, shortcut, final delivery | `models/heroes/courier_v2.glb` |
| Gus | the Caretaker | [kits/janitor.ts](../../src/kits/janitor.ts) | big mop, wet floor sign, mop bucket, flood | `models/heroes/janitor_v2.glb` |
| Mabel | the Mole | [kits/mole.ts](../../src/kits/mole.ts) | mole claw, mole dig, mole tunnel, sinkhole | `models/heroes/mole_v2.glb` |
| Grandma Ironknit | the Knitter | [kits/yarn.ts](../../src/kits/yarn.ts) | knitting needle, cast on, sweater, mr biscuit | `models/heroes/yarn_v2.glb` |
| Barry Cloudsley | the Weatherman | [kits/weather.ts](../../src/kits/weather.ts) | cold front, lightning risk, forecast update, severe warning | `models/heroes/weather_v2.glb` |
| Bo | the angry shepherd | [kits/sheep.ts](../../src/kits/sheep.ts) | crook whack, spare sheep, shear, stampede | `models/heroes/sheep_v2.glb` |
| The Great Zambini | stage magician | [kits/magic.ts](../../src/kits/magic.ts) | card spray, sawn in half, hat trick, grand finale | `models/heroes/magic_v2.glb` |
| Wick | the Doorman | [kits/door.ts](../../src/kits/door.ts) | key toss, wick door, door slam, grand lobby | `models/heroes/door_v2.glb` |
| Pim and Pom | the twins | [kits/twins.ts](../../src/kits/twins.ts) | bonk / pebble, pim charge / snare, shield up / backflip, tag out | `models/heroes/pim_v2.glb`, `models/heroes/pom_v2.glb` |

Self-cast spells have `range: 0`. Ranges for the others run 10-14, cooldowns 2.5-10 s for Q/W/E and 20 s for R. Icons and portraits are drawn on canvases in each kit's palette (the same palette as that kit's parts file, see [effects-and-parts.md](effects-and-parts.md#hero-kit-parts)). The figures are built by Blender, see [models.md](models.md).

To add a hero: write the four effects (label, `category: 'hero: <name>'`, `targeting`), register them, create a `HeroKit`, add it to `HERO_KITS`, add its model to `MODELS`.

## Controller ([heroMode.ts](../../src/heroMode.ts))

`HeroMode` takes a `HeroModeHost` from the runtime ([runtime.ts](../../src/runtime.ts)):

| Host member | Purpose |
|---|---|
| `arena`, `camera`, `dom` | shared arena, the camera it drives, the canvas element for pointer events |
| `targeting(label)` | the `TargetingSpec` of a registered effect (undefined if unknown or not targeted) |
| `cast(label)` | casts the effect on the arena's current target; returns the seconds the hero stays rooted |
| `nextKit?()` | click on the portrait: switch to the next hero |

### Input model

| Input | Action |
|---|---|
| Right click on ground (not aiming) | walk there, as in League; clears a pending cast; shows a shrinking green marker. Held, the hero keeps walking at the cursor. Left click does the same |
| Mouse on an enemy | a red contour round the enemy hero (`Duel.onHover`, the runtime's `OutlinePass`; no cost unless shown) and a sword cursor. "On" means the mouse ray passes within 0.85 m of the figure's upright body, not a ground point near it |
| `Q` `W` `E` `R` or click a HUD slot | start aiming that spell; same key again cancels. On cooldown: toast "is on cooldown". Non-targeted effect: toast "not a targeted effect". **Self-mode spells cast immediately** |
| Left click while aiming | confirm the cast |
| Right click or `Esc` while aiming | cancel |
| Right click on an enemy or summoned unit (not aiming) | basic attack: walk into range and keep attacking it until another order ([attacks.md](attacks.md)); a red marker under it |
| `A`, then left click | attack-move: on an enemy, attack it; on the ground, walk there and attack the first enemy in range |
| `S` | stop: no walk, no attack, no pending cast |
| Q W E R on a hold spell (traits: Kaia Q, Sefu W) | aim as usual; the longer you aim before the click, the stronger the cast (full after the hero's hold time) |
| Q W E R in a recast window (the slot shows RE) | the same spell once more, free, at 60% damage |
| Mouse wheel | zoom (factor clamped 0.55-1.7, default 1.25) |

`enemy` / `enemies` spells need a living enemy within 2.2 units of the cursor (`HOVER_PICK`), else the toast "No enemy there". `ground` spells aim at the cursor point clamped to the spell's range.

### Aim indicators

All are flat `MeshBasicMaterial` meshes recoloured from the kit by `setKit`:

- range ring around the hero (kit `foil`), radius = spell range;
- single-target spells: an aim strip from the hero to the hovered enemy (or toward the cursor), clamped to range, and a hover ring on the enemy (accent when in range, foil when out of range). Without line of sight the strip ends at the cover in the way (`Arena.coverStop`) and turns `foil`;
- line skillshots (`HeroSpell.aim: 'line'`): a strip and arrow of the spell's range and width. Both end where cover stops the bolt, and turn `foil`, unless the spell has `overCover` (it does not stop at walls). A bank shot draws its bounce instead. The cast's own line zones are cut the same way (`Arena.cutZones`, called from `zonesOf` in runtime.ts), on both sides' casts;
- ground spells: an area circle plus fill at the clamped cursor point, radius from the spec's `radius` (default 5);
- curving skillshots (`HeroSpell.aim: 'arc'`, a ground spell): a ribbon along a circular arc from the hero to the clamped
  cursor point with the arrow head at its end. The bend rule (`arcBendFor`, effects/projectile.ts): the arc bows away
  from the line toward the nearest enemy, so a point left of that line makes the shot launch wide to the left and curl
  back onto the point (round cover on that side), a point right of it bows right; within 12 degrees of the line (aiming
  straight at the enemy) it bows to a resting side that flips after every arc cast, and Shift turns the side round. The
  bend is 70 degrees of total turn. The cast gets it as `CastContext.bend` (`arcShot(from, point, bend, speed)` gives the
  launch direction, curve and range). On a phone the point comes from the drag, so the rule is the same (no Shift: the
  resting side alternates). The AI bends a shot round cover when the straight line is blocked, else fires it straight;
- hold slots (`Trait.hold`) show their charge on the slot button while aimed;
- the move-order marker.

### Range, walk-into-range, rooting, cooldowns

- If the target is out of range when you confirm, the cast becomes `pending` and the hero walks toward the target (`HERO_SPEED = 4`, MOBA-slow since 2026-10-30); once within `spell.range` it casts. Any new move order drops the pending cast. A pending enemy that dies cancels it.
- `castNow` sets the arena target (`setTarget` for an enemy, `setGroundPoint` for a point), calls `host.cast(label)` and stores the returned time as `rooted` (no walking while rooted). The runtime returns the latest danger-zone `impact` of the new cast (capped at 2.5 s), or 0.4 s when the spell has no zones, so the hero stays rooted until the spell lands.
- A targeted spell (mode `enemy` / `enemies`) needs line of sight to its target: `confirm` shows "No line of sight" and walks into sight first, and `castNow` refuses (same hint) if the target is hidden when the cast would go. The AI and the autopilot already require sight for every non-self spell (`Duel.pickSpell`'s `sees`).
- Basic-attack hooks from the trait (`attackReach`, `attackEcho`, `resetAttack`): `HeroMode.attackRange`, `skipEcho`, `onAttack(target, echo)`, `resetAttack()`; see [attacks.md](attacks.md).
- Cooldowns count down in `update`; the slot flashes on cast. `setKit` and `setEnabled` clear cooldowns, aim and pending orders.

### Camera

`followCamera` keeps a fixed top-down offset `CAM_OFFSET = (0, 15, 10.5)` scaled by the zoom, lerped to the hero (rate 12, snapped on entry), looking at `(hero.x, 0.5, hero.z - 1.5)`. The runtime disables `OrbitControls` while hero mode is on.

A tall screen (aspect below 1.25, a phone held upright) sees little to the sides because the field of view is
vertical: the offset is scaled by `fit = 1 + (1.25 - aspect) * 0.6` and the look point moves `(fit - 1) * 4` further
ahead. With touch controls the camera also leads up to 1.6 m toward the joystick's walk direction (rate 3).

### HUD

A fixed bottom bar built by `buildHud` (rebuilt by `setKit`), tinted from the kit `accent`: a round portrait (click = `nextKit`), name and title with a control hint, and four slots with canvas icon, key badge, spell name and a conic cooldown shade with seconds. The R slot is larger with gold framing and an "ULT" label. Hovering a slot shows a tooltip (name, key, blurb, range or "self", cooldown). A toast line shows short messages.

### Touch controls ([touch.ts](../../src/touch.ts))

`TOUCH` is on when the device's main pointer is coarse (phones, tablets; a touch laptop with a mouse keeps the desktop
layout); `?touch=1` / `?touch=0` in the URL force it. HeroMode implements `TouchTarget`, and `buildTouchHud` replaces
the bottom bar:

| Control | What it does |
|---|---|
| Joystick (lower-left 48 vw x 62 vh zone) | Appears under the thumb. `steer` turns the screen direction into a ground direction from the camera (so the flipped online seat works) and keeps `moveTo` 1.5 m ahead; it drops the attack like a click, but a cast still walking into range or sight goes first. Release stops. A short tap in the zone is `tapAt`. |
| Tap on the scene | `tapAt`: an enemy within `HOVER_PICK` (3.2 m on touch) is attacked, else walk there. Two fingers pinch the zoom (`pinchZoom`) and don't order. |
| Spell buttons (arc around the attack button) | `aimButton`: press = `aimPress` (starts the aim, so hold slots charge from the press) and aims at the nearest enemy (`aimAuto`); dragging past the button aims along the drag, up to the full range at 120 px (`aimDrag`); release casts (`aimEnd`); dragged out and released back on the button cancels. A single-target spell released away from enemies drops the aim. While a button aims, the mouse raycast is skipped so the drag owns `cursor`. |
| Attack button (⚔, bottom-right) | Attacks the nearest live enemy until another order; hidden when `attacksEnabled` is off. |
| Portrait plate (top-left) | Portrait, passive badge, resource bar and buffs; a tap on the passive shows its tooltip under it for 4 s. |

Positions use `env(safe-area-inset-*)`. Pointer events are tracked by `pointerId` with pointer capture, so the
joystick and a spell drag work at the same time. game.html turns off page zoom and `touch-action` on the canvas;
game.css moves Forfeit under the duel bar and pins the Find match row on narrow screens; the duel bar shrinks its
portraits and bars (`small` in `Duel.buildHud`).

### Figures: walk, breath, cast

The arena's capsule caster is hidden (its children set invisible) and replaced by the kit's `Hero` figure ([hero.ts](../../src/effects/weapons/hero.ts), options `shade: 0.9, maxEmissive: 1, tintSheen: true`). Figures are cached per model url, so switching back to a hero reuses its loaded figure. `showFigure` swaps them; `poseFigure` runs every frame and layers bone rotations on top of `resetPose()`:

- **walk:** a smoothed `walkAmount` (on when speed is above 0.5) drives a phase at 9 rad/s; thighs, shins and arms swing, the root bobs 0.05, the chest leans;
- **breath:** a slow chest oscillation (`sin(clock * 1.8)`) at rest;
- **cast:** while `rooted > 0` the right arm and forearm are thrown forward and the chest turns into it.

Poses use the bone names `thighL/R`, `shinL/R`, `armL/R`, `foreR`, `chest` (see [models.md](models.md#runtime-srceffectsweaponsherots)). The figure follows the caster's position and yaw.

### `setKit(kit)` and `setEnabled(on)`

`setKit` recolours the indicators, rebuilds the HUD, clears aim, pending orders and cooldowns, and shows the kit's figure. `setEnabled(on)` shows or hides the group and HUD, sets `arena.pickEnabled = !on` and `arena.persist = on`, clears orders, and on entry clears the selection and snaps the camera.

## Wiring in the runtime (and the VFX tool)

- **Creation:** `new HeroMode({ arena, camera, dom, targeting, nextKit, cast }, HERO_KITS[0])`, group added to the scene.
- **Entering** (`setHeroMode(true)`; in the tool `H`, or the "hero mode (H)" checkbox in View): `keepLingering = true`; `setPlayMode(true)`; the tool hides its hotbar; `arena.reset()`; orbit controls disabled; `heroMode.setEnabled(true)`; **kit bloom** `{ enabled: true, strength: 0.45, radius: 0.4, threshold: 0.86 }` applied (the particle preset's low threshold would make pale costumes glow until the first cast; the spell modules' own `bloom` is still applied by `activate` on each cast).
- **Leaving:** `dropLingering()`, `heroMode.setEnabled(false)`, controls back on, `setPlayMode(false)`, `arena.reset()`. `P` also exits hero mode, and unchecking "play mode" does too.
- **Hero choice:** `setKit(name)` sets hero mode's kit and restarts a running offline duel. The tool's View > hero dropdown calls it (and follows it through the `kitChanged` hook); it works with hero mode off too, so the next entry starts with that hero.
- **Portrait cycling:** the `nextKit` callback calls `setKit` with the next kit (modulo the list).
- **Casting:** `cast(label)` calls `selectEffect(label)`, so each spell becomes the `active` effect and plays at the arena's target; the rooted time is derived from `zones` (see above).
- **Overlapping spells:** while `keepLingering` is true, `activate` moves the previous active slot into the `lingering` set if it is still `playing` instead of hiding it. `step` updates lingering effects until they stop, `liveEffects()` includes them for shake, `pickScreen` and the distortion scan. Re-casting the same spell is the `selectEffect` replay path (`play()` restarts the same effect, it does not create a second copy). Only the active effect's cinematic camera is honoured.
- **Disabled elsewhere in hero mode:** hotbar digits 1-5, WASD caster walking (`walk`), `controls.update()`. The stats line shows the hero-mode controls plus hits and kills.
- **Debug:** in the tool `vfx.heroMode`, `vfx.setHeroMode(true)`, `vfx.heroPickCtrl.setValue('Lyra')`; in the game `game.api.setKit('Lyra')`.

## Duel ([duel.ts](../../src/duel.ts))

A 1 vs 1 round on top of hero mode. `Duel` (constructed in runtime.ts with a `DuelHost`: arena, hero mode, kits,
`castAs`, targeting lookup) owns the ring, the opponent and the duel HUD.

| Piece | How |
|---|---|
| Setup (`start`) | Opponent kit = the chosen one or a random other kit (never the player's: one effect instance per label). Arena: one foe, `maxHp` the opponent kit's `maxHp` (default 600), `respawnAfter` Infinity, `bounds` = the ring (centre (0, 7), radius 12); player at (0, 0, 13), opponent at (0, 0, 1). The foe's capsule is hidden under a `HeroFigure`. Each start bumps a round id. |
| Opponent casting | `arena.contextFor({ caster, from, point, targets: [player], hit })` builds a cast context for the foe; the runtime's `castAs(label, ctx)` plays the effect through a one-shot override in the play wrapper and adds it to `lingering`, so the player's active effect, panel and camera stay. It returns the effect's danger zones, drawn by the duel's own `TelegraphLayer` on its own clock. |
| Dodging | The context's `hit` checks the player at the moment of the hit: inside one of that cast's zones (`insideTelegraph`) or within 1.6 of where it aimed → damage (number, red edge flash, knockback inside the ring); otherwise one DODGED label. Hits from an earlier round are ignored. |
| AI | Waits 1.2 s, then each frame: rooted until its spell's latest impact (≤ 2.5 s); else the first ready spell in the order R, E, W, Q that is in reach (R only when the player is under the level's `ultHp` or after `ultTime` s, Normal 45% and 28 s; E when the player is inside its radius); else walk to ~70% of Q's range and strafe, flipping every 1.5–3.5 s. It walks at its CPU level's speed (Normal 3.3 m/s for a hero of base speed 4) and looks where it walks; it faces the player only when it stands still to cast. |
| CPU level | `duel.cpuLevel` ([cpuLevels.ts](../../src/cpuLevels.ts)), five levels: Novice, Easy, Normal, Hard, Master. A level sets the opponent's walk speed, a pause after each cast (`castGap`), a cooldown factor, an aim error and a lead on its ground casts, its bolt dodge and reaction, a zone dodge (walks out of the player's area zones before they land), its guard chance and when its R may go. A level also scales the damage it deals. The kits are balanced against `CPU_BALANCE`, which is not offered to players; the autopilot always plays it (`levelOf`). The HUD names the level ("Lyra · Hard"), the end card too. `onFinish(result)` tells the game a round is over. The numbers are in the table in [mechanics.md](mechanics.md#cpu-levels). |
| End | Opponent HP 0 → VICTORY, player HP 0 → DEFEAT: hero mode `locked`, the loser's figure falls, a card with Rematch / Leave duel. |
| runtime.ts, tool | `setDuel(on)` (the tool's View → duel, key B; turns hero mode on), View → opponent and View → CPU level, a new round when the hero changes, the duel ends with hero mode. |

**Cover and line of sight:** the ring has a centre wall, four pillars and two side walls (`DUEL_OBSTACLES` in
[obstacles.ts](../../src/obstacles.ts), set as `arena.obstacles` while the duel is on). They block walking and line of
sight; a targeted spell needs sight of its target (hero mode turns an unseen cast into walk-then-cast, the AI only
picks spells it can see with), and so does every basic attack, melee or ranged (`Attacker.inRange`; an attack order walks
round the cover first). Details in [multiplayer.md](multiplayer.md#the-ring-pillars-walls-and-line-of-sight).

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
| `follow(dt, pos, yaw, state)` | Every frame. `state` = `{ attack: Attacker.motion, status: StatusSet, held }`. It layers rest (breath, weight on one leg with the other knee eased, a look round, agile heroes bouncing lightly, and every 4-9 s a fidget: a look over the shoulder, a shoulder roll or a shake of one hand), a walk scaled to the real speed (see below), the basic attack (melee slashes alternate arms, hammer and greatsword (attack look `smash`, `cleave`) swing overhead, ranged flicks), the cast pose, stun slump, knock-up flail, root tug, the hit flinch and the sway springs. `held` freezes the pose (ice block). A dt of 0 (paused) only places it. |
| `cast(style, seconds, big)` | Called right after a cast roots the hero (`HeroMode.castNow`, `Duel.castSpell`, so online peers too): wind-up, a snap into the strike with a little overshoot, then settle. `castStyle(spell, slot, onEnemy, melee, seconds)` picks the style from the spell data: dash = lunge, summon = raise, self-cast = burst (a long one without CC = channel), melee range = swing, skillshot = thrust, clicked enemy = point, other ground spells = slam. Slot R plays 18% bigger. |
| `hit(strength, tint, from)` | Flinch away from `from` and a tinted flash (`Hero.setFlash`). The player's hero gets it from `Duel.damagePlayer` (`HeroMode.figureHit`, also a small camera shake on 25+ damage); the opponent from its capsule flash jumping (`Arena.flashOf`). Blocked hits never reach it. |
| `fall(t)`, `stand()` | Knees give, chest folds, tips forward; `stand` drops every running pose. |

**The walk.** One phase drives both legs half a cycle apart: the heel lands with the toes up, the knee bends to take
the weight, the toes push off, and the knee lifts through the swing. The feet stay near flat (they undo the thigh and
knee angles) apart from the push-off and heel strike. The root bobs lowest just after each landing. The hips twist and
drop, the chest turns against them, and the head undoes part of the chest's lean and turn, so it stays level. The arms
swing against the legs a little behind them, and the elbows fold as each arm comes forward. `run` (speed 2.2 to 4.6
blends a slowed walk into a jog) lengthens the stride, lifts the knees, bends and pumps the arms and adds lean. The legs
reach the way the hero moves (forward, backpedal or side-step, each leg stepping out to its own side only), and turning on the spot shuffles the feet. Two damped
springs add momentum: starting or stopping pitches the chest forward with an overshoot, and a stop swings the arms on
through. Any arm motion fades under a cast or a basic attack (`armFree`).

**Robes.** `Hero.robe` (0..1, measured on load) is the share of skinned vertices below the knees that mostly follow a
thigh. A long robe or skirt is skinned that way and tears open on a long, high-kneed step. Robed heroes get a stride
40% shorter, 55% less knee lift and push-off, and a leading knee that stays bent, so the shin hangs inside the hem. In
the current roster only Brannoc and Zephyr (trousers) measure 0.

`pipeline/tools/pose-sheet.js` renders a contact sheet of every pose for one hero (see its header).

## See also

- [Architecture overview](overview.md)
- [Effects and shared parts](effects-and-parts.md)
- [Targeting and arena](targeting-and-arena.md)
- [Models pipeline](models.md)
- [Docs home](../README.md)
- [Art bible](../ART_BIBLE.md), [VFX principles](../VFX_PRINCIPLES.md)
