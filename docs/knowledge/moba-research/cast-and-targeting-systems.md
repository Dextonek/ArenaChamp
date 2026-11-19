# How abilities are activated, aimed and resolved in League of Legends, Dota 2 and Smite (1 and 2), as of late 2026

Scope: the cast and targeting systems themselves, not individual champions, heroes or gods. Written for the designers of a 1v1 browser MOBA (top-down camera, mouse and keyboard, also phones). This builds on `docs/knowledge/league-research/kit-anatomy.md` (section "What is the targeting mix...") and `docs/knowledge/league-kit-design.md`, and does not repeat them. Those files cover targeting as a source of risk, reliability and power. This file covers the mechanics.

**How far to trust this file**
- **League:** pages on wiki.leagueoflegends.com loaded directly, but each fetch read only the first 100,000 characters of a long page. The "Cast time" page is marked outdated by the wiki itself.
- **Dota 2:** the web fetcher was blocked (Fandom 402, Liquipedia 403). Seven Dota Fandom pages were then read in the built-in browser, each capped at 5,000 to 12,000 characters: Disjoint, Cast Animation, Cast range, Dispel, Channeling, Abilities and Disable. Bullets marked "[Fandom, read]" come from that page text. Bullets tagged "(search summary)" come from a search engine's summary, not from the page. Other Dota bullets come from community guide sites. The teamsmurf.com pages belong to a boosting site and are SEO content, so read them with care.
- **Smite:** wiki.smite2.com loaded, first at an older revision and then live in the built-in browser. Both give the same rules. Some Smite 1 rules come from a 2014 community guide.
- **Phone MOBAs:** sources are community settings guides only. No official Riot, Moonton or Tencent document was retrieved.
- **Anything from memory** is never in Cited Findings. It sits in Gaps, marked "unconfirmed, from memory".

## 1. Activation modes: every way an ability can be switched on

### Takeaway
All three games build on the same few input shapes, though each names them differently:
- no target (self or proximity)
- a unit
- a ground point
- a direction
- a two-point vector

On top of those sit activation patterns: passive, toggle, channel, charged channel, recast, ammo and stance. League's wiki gives the most precise list, including the engine's own types. Dota adds autocast and makes vector targeting a general system. Smite has almost no unit-targeting, so almost everything is aimed.

### Cited Findings

#### League of Legends: targeting inputs (the wiki's five types, plus forgiveness)
- The targeting input is whatever the cursor must supply to cast an active, a summoner spell or an item. A passive-only ability needs none — [Wiki: Targeting](https://wiki.leagueoflegends.com/en-us/Targeting)
- **Auto-targeted:** needs no input and picks its targets itself. Sub-types:
  - Self-buffs and point-blank AoEs centred on the caster.
  - Proximity-targeted spells, which need at least one valid target nearby before they can be cast, such as Katarina's Death Lotus and Kai'Sa's Icathian Rain. Some of these detect targets that are not visible.
  - [Wiki: Targeting](https://wiki.leagueoflegends.com/en-us/Targeting)
- **Direction-targeted:** the player gives only a direction. The length and offset are fixed and start from an origin the player does not choose, wherever the cursor is. Rules:
  - Projectiles and dashes travel toward the cursor and often stop at max range.
  - Hits come in three kinds. Pass-through hits every unit. Collision hits the first unit only. Whole-area affects the full shape at once.
  - Shapes are mostly lines (the usual "skillshots") or cones. Ashe's Volley is several lines fanned into a cone.
  - The origin can be something other than the caster, as with Zed's shuriken thrown from his shadow.
  - Some interact with terrain.
  - Some store the target point at cast time, so the ability can bend back toward the original point if the caster Flashes during the cast.
  - [Wiki: Targeting](https://wiki.leagueoflegends.com/en-us/Targeting)
- **Location-targeted:** the player picks a point within range and the spell centres there. Rules:
  - The area is mostly a circle. Exceptions are wall shapes (Jinx's Chompers, Karthus's Wall of Pain) and some blinks with no area.
  - A cast beyond range does one of three things, depending on the ability: it casts at max range, it walks the champion into range first, or it does not cast.
  - Dashes with neither a fixed length nor a target unit are of this type.
  - [Wiki: Targeting](https://wiki.leagueoflegends.com/en-us/Targeting)
- **Unit-targeted:** a valid unit must be selected within range, and the caster needs sight of it. Rules:
  - The caster can be one of several valid targets, but is never the only one.
  - Casting on yourself means clicking yourself, unless a self-cast bind is used.
  - Delayed unit-targeted spells and attacks can cancel if sight of the target is lost.
  - Range is usually centre to centre ("centered range"), which makes these spells weaker against large units.
  - Only Janna's Eye of the Storm and Senna's Piercing Darkness can target allied turrets.
  - [Wiki: Targeting](https://wiki.leagueoflegends.com/en-us/Targeting)
- **Vector-targeted:** a location plus a direction, from an origin the player chooses. The first input sets the origin like a location cast, and the second sets the direction measured from that origin, not from the caster. With quick cast, the origin is set on key press and the direction on release. Examples are Viktor's Hextech Ray, Brand's Pillar of Flame and Rumble's The Equalizer — [Wiki: Targeting](https://wiki.leagueoflegends.com/en-us/Targeting)
- **Proximity passives:** some passives only take effect when a valid non-caster target is nearby — [Wiki: Targeting](https://wiki.leagueoflegends.com/en-us/Targeting)
- **Targeting forgiveness:** when a unit-targeted spell is cast on an invalid target, the game searches a forgiveness radius and casts on the nearest valid unit. Radii:
  - The default is 175 units. It applies to many ally-target spells, among them Annie's Molten Shield, Bard's Caretaker's Shrine, Braum's Stand Behind Me, Janna's Eye of the Storm, Karma's Inspire, Morgana's Black Shield, Soraka's Astral Infusion, Taric's Bastion, Yuumi's You and Me! and Zilean's Chronoshift.
  - Exceptions: K'Sante's Footwork 150, K'Sante's All Out 50 (edge range), Shen's Stand United 100, Mikael's Blessing 200.
  - An older system, possibly with priority rules: Lulu's Help, Pix! 75, Kindred's Mounting Dread 100, Heal 200, Smite 300, Teleport 400 (only when the target unit is more than 3,000 units away).
  - [Wiki: Targeting](https://wiki.leagueoflegends.com/en-us/Targeting)
- **Engine targeting types.** The wiki uses these only as a guide, because scripts can override them. Warwick's Infinite Duress is a Location type with 25,000 range, yet the player picks only a direction.

  | Engine type | Meaning | Examples |
  |---|---|---|
  | `Self` | Always the caster | |
  | `Target` | The default unit target | |
  | `Area` | Rare now | |
  | `Cone` | Cone | Nidalee's Swipe |
  | `SelfAOE` | Checks up to 64 targets in range | Morgana's Soul Shackles, Blitzcrank's Static Field |
  | `TargetOrLocation` | A unit or a point | Riven's Broken Wings, Bard's Caretaker's Shrine, Kayle's Celestial Blessing |
  | `Location` | A point | |
  | `Direction` | A direction | Ezreal's Mystic Shot, Cho'Gath's Feral Scream, Ashe's Volley |
  | `DragDirection` | The engine's vector cast | Viktor's Hextech Ray, Rumble's The Equalizer, Taliyah's Seismic Shove |
  | `AreaClamped`, `LocationClamped` | Snap to max range if the cursor is beyond it | Malphite's Unstoppable Force, Ziggs's Bouncing Bomb, Corki's Valkyrie |
  | `TerrainLocation` | Can only be cast on walls | Only Bard's Magical Journey |
  | `TerrainType` | Location with a terrain check | Only Qiyana's Terrashape |
  | `LineTargetToCaster` | Unused | Removed Quinn's Vault |

  [Wiki: Targeting](https://wiki.leagueoflegends.com/en-us/Targeting)
- **Range terms:**
  - Centered range runs from the centre of the source to the centre of the target. Most unit-target spells use it.
  - Edge range runs from the edge of one hitbox to the edge of the other. Basic attacks, skillshots and point-blank areas, including auras, use it.
  - Selection radius is how far from a model's centre the cursor can be and still select it.
  - Sight is always measured centre to centre and is required for unit targeting.
  - Some abilities, usually ultimates, have global range.
  - [Wiki: Targeting](https://wiki.leagueoflegends.com/en-us/Targeting); [Wiki: Ability](https://wiki.leagueoflegends.com/en-us/Ability)

#### League of Legends: activation patterns
- **Passive and active:** an ability can carry any number of passive and active parts — [Wiki: Ability](https://wiki.leagueoflegends.com/en-us/Ability)
- **Toggle:** drains a resource continuously until the player turns it off or the resource runs out — [Wiki: Ability](https://wiki.leagueoflegends.com/en-us/Ability)
- **Recast:** a second cast part. Sylas recasts a stolen ultimate at no cost. Yuumi recasts to change ally or to detach. Cast-blocking crowd control also blocks recasts, unless the ability says otherwise — [Wiki: Ability](https://wiki.leagueoflegends.com/en-us/Ability); [Wiki: Crowd control](https://wiki.leagueoflegends.com/en-us/Crowd_control)
- **Ammo, two kinds:**
  - *Stock:* charges regenerate up to a maximum, and ability haste speeds the recharge.
  - *Barrage:* charges are granted on activation and last for the ability's duration. Unused ones are lost. They cost nothing and are gated by a fixed recast timer.
  - [Wiki: Ability](https://wiki.leagueoflegends.com/en-us/Ability)
- **Stance:** a shapeshift of the champion or its abilities. Persistent effects are mutually exclusive. Swaps usually share a brief global cooldown, and some stances replace the basic abilities. Jayce's Mercury Hammer and Mercury Cannon are listed as pseudo-ultimates — [Wiki: Ability](https://wiki.leagueoflegends.com/en-us/Ability)
- **Channel types:**
  - **Normal:** fixed potency. It must be held to the end, and the cast bar counts down.
  - **Charged:** the first press starts charging and a second press releases at the potency reached, while the bar fills. Most allow movement while charging. Briar's Chilling Scream, K'Sante's Path Maker and Sion's Decimating Smash lock their direction at the first press, while the others can be re-aimed during the charge. Xerath's Arcanopulse charges to gain range.
  - **Movement channels:** dashes or blinks over time. Root and ground can interrupt them.
  - **Objective channels:** require being out of combat, and taking damage breaks them (Ornn's forge, Zilean's Time in a Bottle).
  - **Uninterruptible channels:** ignore crowd control (Irelia's Defiant Dance, Pantheon's Aegis Assault), though death still ends them.
  - [Wiki: Channel](https://wiki.leagueoflegends.com/en-us/Channel); [Wiki: Ability](https://wiki.leagueoflegends.com/en-us/Ability)
- **What a channel lets the caster do:**
  1. Move but not cast or attack (Akshan's Comeuppance, Kayn's Umbral Trespass).
  2. Not move, but cancel early (Briar's Chilling Scream, Irelia's Defiant Dance).
  3. Nothing at all, with no early cancel (Caitlyn's Ace in the Hole, Karthus's Requiem, Teleport).
  - Some channels allow everything but end the moment you act: Katarina's Death Lotus, Jhin's Curtain Call and Recall.
  - Ryze's Realm Warp disables nothing and cannot be cancelled.
  - Some actions do not break a channel: Annie's Summon: Tibbers recast, Yuumi's Zoomies, consumables, trinkets.
  - [Wiki: Channel](https://wiki.leagueoflegends.com/en-us/Channel)
- **Cost and cooldown on interruption:** an enemy interrupt usually refunds nothing, while a self-cancel may refund, depending on the ability — [Wiki: Channel](https://wiki.leagueoflegends.com/en-us/Channel)

#### Dota 2: activation modes
- **The wiki's taxonomy [Fandom, read]:**
  - Ability types: Active, Passive, Autocast and "Alternative Cast".
  - Targeting types: No Target (with Toggle as a sub-type), Target Point (with Target Area and Vector Targeting as sub-types), Target Unit, and combinations ("Target Point or Unit", "Target Unit with Area Effect").
  - The same page also lists sub-abilities, innate abilities, linked abilities, charge-based abilities and transformation abilities.
  - A possibly outdated line says ultimates can usually target spell-immune units and apply their stuns. This predates 7.33, see section 3.
  - [Fandom: Abilities](https://dota2.fandom.com/wiki/Abilities)
- **Channeling [Fandom, read]:** the caster stops acting for the whole duration, and a time-remaining bar shows on screen. Two kinds:
  - Do-nothing-if-interrupted (TP scroll, Tinker's Rearm, Primal Beast's Onslaught).
  - Power-scales-with-time-channelled (Fiend's Grip, Freezing Field, Black Hole, Shackles, Life Drain, Powershot, Illuminate, Death Ward).
  - Unlike channels, long non-channel casts such as Sniper's Assassinate spend no mana and start no cooldown until they finish.
  - Patch 7.07 added an option so that only Stop or Hold interrupts your own channels.
  - [Fandom: Channeling](https://dota2.fandom.com/wiki/Channeling)
- **Vector targeting:** two points, where the first sets the start and the second the direction. Inputs:
  - Normal cast: hold the mouse button at the start point, drag, and release.
  - Key-up quick cast: hold the hotkey to fix the start, aim, then release the key.
  - Key-down quick cast: press the key to fix the start, aim, then left-click.
  - Cast point timing: the cast point starts when the hotkey is pressed and the direction chosen.
  - (search summary) [Liquipedia: Abilities](https://liquipedia.net/dota2/Abilities); [Fandom: Abilities](https://dota2.fandom.com/wiki/Abilities)
- **Vector-targeted abilities in Liquipedia's list:** Bane's Nightmare, Broodmother's Spinner's Snare, Clinkz's Burning Army, Dark Seer's Wall of Replica, Disruptor's Kinetic Fence, Grimstroke's Stroke of Fate, Gyrocopter's Call Down, Marci's Rebound, Muerta's Dead Shot, Pangolier's Swashbuckle, Puck's Illusory Orb and Tusk's Walrus Kick. Some need a facet, Scepter, Shard or talent. Bane, Disruptor and Puck need facets, and Tusk needs Scepter. Fandom's shorter list leaves out Bane, Disruptor, Grimstroke, Marci and Puck — (search summary) [Liquipedia: Abilities](https://liquipedia.net/dota2/Abilities)
- **A quick-cast change in 2022:** a user thread from 2022 reports that a quick-cast change altered how Pangolier's Swashbuckle and Marci's Rebound cast, and that a setting could revert it. This is unverified — [Dotabuff forum, 2022](https://www.dotabuff.com/topics/2022-04-24-pango-swashbuckle-changed)
- **Self-cast and autocast:**
  - Double-tapping the hotkey, or double-clicking, casts an ability on yourself.
  - Players report that double-tap does not work while quick cast is on, and that Alt plus the hotkey self-casts instead. Alt self-cast was added in 2016.
  - The "Smart Double Tap" option makes Alt plus a hotkey try a self-cast.
  - "Advanced Quickcast/Autocast Hotkeys" gives cast, quick cast and autocast separate keys for each slot.
  - (search summary) [Liquipedia: Settings](https://liquipedia.net/dota2/Settings); [Liquipedia: Hotkeys](https://liquipedia.net/dota2/Hotkeys); [Steam discussion](https://steamcommunity.com/app/570/discussions/0/617336568072951257/)

#### Smite: activation modes
- **Stances, Smite 1:** Hel's Cleanse acts only in her light stance. It removes all crowd control from allies at a ground-targeted point and protects them for 0.5 to 1.3 seconds by rank — [Smite Academy guide, Oct 2014 (Smite 1)](https://smiteacademy.wordpress.com/2014/10/17/guide-crowd-control-in-smite/)
- **Unit-targeted, Smite 1:** Geb's Stone Shield targets self or an ally. It blocks knockback and cleanses crowd control on application — [Smite Academy guide, Oct 2014 (Smite 1)](https://smiteacademy.wordpress.com/2014/10/17/guide-crowd-control-in-smite/)
- **Relics in Smite 2:** each player carries one relic instead of Smite 1's two.
  - Purification Beads: about 2 seconds of crowd-control immunity, usable while crowd-controlled.
  - Blink Rune: a short teleport of about 5.6 metres to a targeted point. It can be used even during another ability. Digital Trends gives a 240-second cooldown in Smite 2, against 120 seconds in Smite 1.
  - Aegis: 1.5 seconds of invulnerability to damage and healing. Only movement is allowed, so it effectively silences and disarms.
  - [Digital Trends: Smite 2 relics](https://www.digitaltrends.com/gaming/smite-2-relics-when-to-pick/); [Smite 2 Wiki: Purification Beads](https://wiki.smite2.com/w/Purification_Beads); [Chaotic Corner: Smite 2 relics](https://resistthesun.co.uk/smite-2-god-roster-roles/smite-2-relics/)

### Inferences
- **The five League input shapes cover nearly every spell in all three games:** none, unit, point, direction, vector. Everything else (channel, charge, recast, ammo, stance, toggle) is a pattern in time layered on one of those five. A small engine could model a spell as one input shape, one timing pattern and one hit rule.
- **League's engine stores data that a duel engine should also store:**
  - whether the cast clamps to max range or walks into range
  - whether the target point is stored at cast time or tracks the caster (the Flash redirect)
  - which hit rule applies: first hit, pierce or whole area
- **Targeting forgiveness of about 175 units on ally spells** is a cheap way to make unit-targeting work on phones. In a 1v1 with no allies, the same idea can apply to enemy targeting: snap to the one enemy when the tap lands near them.
- **Vector targeting needs the most input on a phone.** Both League (press for the origin, release for the direction) and Dota (key-up or key-down quick cast) map it to one press, a drag and a release. That is exactly a phone drag gesture, so vectors port to touch better than people expect.
- **League's "stock" versus "barrage" ammo split** is useful vocabulary:
  - Stock charges refill over time and invite banking them.
  - Barrage charges are granted at once and must be spent within a window.
  - [Ties to kit-anatomy.md's resource and cooldown section.]

### Gaps
- **Dota (unconfirmed, from memory).** Autocast attack modifiers such as Drow's Frost Arrows are toggled by right-clicking the icon or with the autocast key. Facets and innate abilities, added in 7.36, are not covered here. The Abilities page was cut off before its sections on Autocast, Alternative Cast and the targeting types, so their definitions were not read.
- **Smite (unconfirmed, from memory).** Smite abilities are almost all aimed with a reticle: lines, cones, ground circles and leaps to a point. Few are unit-targeted lock-ons. Basic attacks are themselves aimed projectiles or melee swings, not unit-targeted. Stance and transform gods include Hel (light and dark), Ullr (bladed and ranged) and a few others. Item actives were reworked in Smite 2 to a relic plus active items. No Smite 2 source on activation types (passive, toggle, channel, charge) was retrieved.
- **League (unconfirmed, from memory).** League-specific charged and recast numbers were not re-fetched. These include Varus Q and Xerath Q charge times, Lee Sin Q's recast window, Riven Q's three-part window and Ahri R's three dashes. Item actives and summons ("pet" control via Alt plus right-click) were not researched.
- **Terrain creation** (Anivia's W, Trundle's E, Jarvan's R, Taliyah's R; Dota's Earthshaker Fissure and Dark Seer's wall; Smite's Ymir Ice Wall): only the League spell-shield rule that terrain-making spells cannot be blocked was retrieved (section 3). The rest is unconfirmed, from memory.

## 2. Input and aiming: how the player tells the game where and when

### Takeaway
All three PC games converge on three casting modes:
- **Normal:** press, then click to confirm.
- **Quick:** fire on press, at the cursor.
- **Quick with indicator:** hold to see the indicator, fire on release.

Each also offers a self-cast modifier. Dota adds double-tap self-cast, per-slot cast and autocast keys, and turn rate (a hero must face within 11.5° of the target before acting). Smite is third-person with a reticle and offers Normal, Quick and Instant per god. Phone MOBAs turn the same three modes into gestures:
- tap auto-aims, at a target chosen by a priority rule
- drag aims manually
- dragging onto a cancel zone aborts

### Cited Findings

#### League of Legends: cast modes and binds
- **Normal cast:** pressing the key shows the range indicator, and a left-click fires.
  - Some channels need one tap to start and another to finish.
  - Vectors take a tap for the origin, a mouse move, then a tap for the direction.
  - Pantheon's Comet Spear, Pyke's Bone Skewer and K'Sante's Path Maker are exceptions to the channel rule.
  - [Wiki: Quick cast](https://wiki.leagueoflegends.com/en-us/Quick_cast)
- **Quick cast ("use on key-down"):** fires on press at the cursor, with no indicator. Charged spells start on press and fire on release. Vectors are held and dragged — [Wiki: Quick cast](https://wiki.leagueoflegends.com/en-us/Quick_cast)
- **Quick cast with indicator ("use on key-release"):** holding shows the indicator and releasing fires at the cursor. It can be cancelled before release, which is faster than normal cast because no second key is needed to confirm — [Wiki: Quick cast](https://wiki.leagueoflegends.com/en-us/Quick_cast)
- **Self-cast fallback:** an ally-or-self ability with no valid unit under the cursor casts on your own champion.
  - Normal plus self-cast prompts for a target, then falls back to self.
  - Quick plus self-cast checks the target on press.
  - Quick plus self-cast with indicator checks it on release.
  - [Wiki: Quick cast](https://wiki.leagueoflegends.com/en-us/Quick_cast)
- **Cancelling a pending cast:** right-click (move, attack-move or pet-move commands) cancels it, as does Escape. A quick cast with indicator can be cancelled any time before the key is released — [Wiki: Quick cast](https://wiki.leagueoflegends.com/en-us/Quick_cast)
- **Per-ability settings:**
  - Each hotkey has its own Normal or Quick toggle, and items and summoner spells have separate binds.
  - "Quick cast with indicator" applies only to hotkeys set to Quick.
  - "Cast the pressed spell upon pressing another spell" helps when casting two spells back to back.
  - Some spells always quick-cast and cannot be changed: Ahri's Spirit Rush, Fizz's Playful/Trickster, Yasuo's Steel Tempest, Flash and all self or auto-targeted spells. The wiki notes this list is incomplete.
  - [Wiki: Quick cast](https://wiki.leagueoflegends.com/en-us/Quick_cast)
- **Bind history:**
  - Smart cast was Alt plus key in V1.0.0.79, moved to Shift with Alt for self-cast in V1.0.0.98, and gained separate Self plus Smart binds in V1.0.0.123.
  - "Smart cast" was renamed "Quick cast" in V3.12.
  - Attack-move is a separate bind, as is an "attack only" click bind.
  - In 2009, holding tilde selected champions only.
  - [Wiki: Quick cast](https://wiki.leagueoflegends.com/en-us/Quick_cast)
- **WASD movement (new in 2025 and 2026):**
  - V25.24 added WASD movement, with left-click as basic attack, Q moved to right-click and W moved to Shift.
  - V26.02 removed the attack delay while moving for melee champions and reduced it for non-marksman ranged champions.
  - V26.03 announced a WASD setting for the direction of Flash and other movement abilities.
  - Under WASD, movement input cannot cancel a committed attack, but moving out of vision or casting an ability before the attack fires still cancels it.
  - [Wiki: Quick cast](https://wiki.leagueoflegends.com/en-us/Quick_cast)
- **In-game tooltips** do not show an ability's range or targeting. Hovering the HUD icon shows them — [Wiki: Ability](https://wiki.leagueoflegends.com/en-us/Ability)

#### League of Legends: selection and hitboxes
- **Unit radius stats:**
  - Gameplay radius is the closest thing to a hitbox. It sets reach for edge-range effects (basic attacks, line-collision missiles, rectangular areas). Most champions are 65, small ones 55 (Annie, Teemo, Ziggs, Vex), large ones 80 (Alistar, Blitzcrank, Malphite, Sion), Ivern 70 and Warwick 74.
  - Pathing radius is the space used for unit collision and pathfinding. It is usually 35 and 50 for big tanks, with outliers such as Graves at 10 and Darius at 25.
  - Selection radius is the cursor-pick distance, about 100 to 150.
  - Selection height runs from 85 to 302, because the camera is 3D while gameplay is 2D.
  - Acquisition radius runs from 200 to 900.
  - [Wiki: Unit radius](https://wiki.leagueoflegends.com/en-us/Unit_radius)

#### Dota 2: cast modes, facing and range
- **Normal and quick cast:** normal cast is press, then click. Quick cast fires at the cursor on press, or on release, depending on the setting — (search summary) [Liquipedia: Settings](https://liquipedia.net/dota2/Settings); [Dota Gamers, Oct 2026](https://www.dota-gamers.com/2026/10/how-to-setup-dota-2-quickcast-and.html)
- **Mixing modes:** many players quick-cast abilities but normal-cast items they target precisely, such as Eul's — (search summary) [Liquipedia: Hotkeys](https://liquipedia.net/dota2/Hotkeys)
- **Facing:** a hero must be within 11.5° of facing the target position before it can move, attack, cast or use an item. That is a 23° cone in front of the hero, inside which actions are instant — (search summary) [Liquipedia: Archive: Turn Rate](https://liquipedia.net/dota2/Archive:Turn_Rate)
- **Turn rate:**
  - Most heroes turn at 0.5 to 0.6, taking 0.15 to 0.19 seconds to turn 180°.
  - Turn rate is measured in radians per 0.03 seconds, and a unit ramps up to its maximum.
  - Patch 7.29 sped up turning by 20%.
  - Turn-rate slows stack multiplicatively.
  - Every cast, point-targeted or not, requires turning to face the cast direction.
  - (search summary) [Fandom: Turn rate](https://dota2.fandom.com/wiki/Turn_rate); [Liquipedia: Turns](https://liquipedia.net/dota2/Turns)
- **Cast range:**
  - A cast ordered beyond range makes the hero walk into range first, then cast.
  - For point-targeted spells, flat range bonuses and the edge-to-edge distance by collision size count, but the motion buffer range does not.
  - (search summary) [Fandom: Cast range](https://dota2.fandom.com/wiki/Cast_range)
- **Cast range items:** Aether Lens gives +225 cast range, and Dagon gives +60 to +180 by level. The two do not stack. Range does not change AoE size. Old guides that add Telescope or Psychic Headband predate the 7.38 neutral-item rework. The page cites patch 7.41f — [Dotasense: Cast range guide, 2026](https://dotasense.com/guides/cast-range)

#### Smite 2: cast modes and aiming settings
- **Cast modes, set per god:**
  - Normal: press, aim, click to fire.
  - Quick: hold to aim and release to fire. A tap without holding fires at once.
  - Instant: fires at the cursor or reticle position immediately.
  - [Item Level Gaming, Aug 2024 (Smite 2 alpha)](https://itemlevel.net/smite-2-best-settings-guide/)
- **Targeting settings:**
  - Ground-target indicator style, recommended "Arrow".
  - Distance line indicator, recommended "Ruler".
  - Reticle shape.
  - "Show Targeter 3D Elements".
  - "Bracket Highlighting".
  - "Double Tap to Fire", which the guide calls clunky and turns off.
  - "Restrict Camera Pitch", recommended off.
  - [Item Level Gaming, Aug 2024](https://itemlevel.net/smite-2-best-settings-guide/)
- **Switching modes:** instant and normal cast are switched in Settings, and many competitive players prefer instant — [TutorialTactic: Smite 2 keybinds](https://tutorialtactic.com/blog/smite-shortcuts/)

#### Phone MOBAs: aiming by touch
- **Mobile Legends (community guides):**
  - Skill cancel lets you abort by dragging off the skill button, or with a sweep gesture.
  - Hero Lock overrides every targeting priority once set. "Smart Targeting" can steal the lock and redirect onto a minion, so guides advise turning it off when using Hero Lock.
  - Targeting-priority options include Lowest HP, Lowest HP %, Closest and sometimes Lowest Effective HP.
  - Manual targeting means aiming every attack. Aim Assist is often advised off for precise skillshots. Aim Panning moves the camera while aiming long skillshots.
  - [BitTopup MLBB controls 2026](https://bittopup.com/article/Mobile-Legends-Controls-Guide-2025-Pro-Settings-Setup); [1v9.gg MLBB settings](https://1v9.gg/blog/mobile-legends-mlbb-best-settings-and-options-guide); [Boostroom MLBB settings](https://boostroom.com/blog/best-settings-for-mobile-legends-sensitivity-controls)
- **Wild Rift (community guides, about 2024):**
  - Tapping an enemy portrait or the enemy focuses attacks on it. Dragging to target risks picking the wrong one in a fight.
  - "Locked Button Centers", off by default: when on, you must touch the exact centre of the button to aim, and a short drag may cast by accident.
  - "Manual Aim Time Limit": how long you can hold manual aim before the ability casts by itself.
  - Portrait lock, with Priority or Fixed display.
  - Aim Panning for extra vision while aiming.
  - A warding aim-assist.
  - [TheGamer: Wild Rift settings](https://www.thegamer.com/league-of-legends-lol-wild-rift-best-settings-guide/); [Trucoteca: Wild Rift controls](https://trucoteca.com/en/how-lol-wild-rift-controls-are-configured/)
- **Pokémon Unite:**
  - "Move Aim Snaps to Nearby Targets" locks a move's aim onto the nearest enemy. It can include wild Pokémon, and guides advise turning it off if you want to aim moves away to escape.
  - "Move Aim: Movement" aims by dragging toward the target.
  - "Lock-On Icon" allows manual target switching.
  - "Sensitivity Assist" slows the aim as it nears a target.
  - "Advanced Controls" separates the attack-wild-Pokémon button from the attack-opponent button.
  - Nintendo's guidance: Advanced Controls, Lock-On Icon on, and "Camera Follows Moves" and "Move Aim Follows Movement Direction" on.
  - [Upcomer: Pokémon Unite settings](https://upcomer.com/how-to-achieve-the-optimal-settings-for-pokemon-unite); [GamingOnPhone](https://gamingonphone.com/guides/pokemon-unite-guide-best-settings-for-mobile); [Sportskeeda](https://www.sportskeeda.com/pokemon/best-settings-pokemon-unite-mobile-players)

### Inferences
- **Release-to-fire is the common ground between mouse and touch.** League's "quick cast with indicator", Smite's "Quick", Dota's key-up quick cast and the phone drag-and-release are the same idea: hold to preview, release to commit, with a way to back out before release. One code path can serve both keyboard and phone if the press, drag and release events are the same.
- **Self-cast fallback is the duel version of forgiveness.** League's rule is that no valid target under the cursor means the spell targets you. Dota's double-tap and Alt cast on yourself. On a phone, a tap with no drag on a self or ally spell should just cast it.
- **Dota's 11.5° facing cone and turn rate make turning part of the cast time.** A top-down 1v1 can use turn speed as a hidden wind-up that rewards pre-facing. It is also a common source of "I pressed it and nothing happened" complaints (see section 5).
- **Phone auto-aim needs one priority rule.** With only one enemy hero in a 1v1, "nearest enemy hero, then nearest anything" is enough. Mobile Legends' problem of smart targeting stealing the lock for a minion is a warning to never auto-aim at a summon over the hero unless the player asks for it.
- **League keeps gameplay radius (65) and selection radius (100 to 150) separate.** Clicking is easier than hitting, which a top-down browser game can copy: generous tap and click areas, honest hitboxes.

### Gaps
- **Dota (unconfirmed, from memory; no source retrieved):**
  - Shift-queue: Shift plus any order appends it to an order queue, and abilities, items and moves can be chained.
  - Ctrl-queue / "Shift-casting" items during a channel such as a TP.
  - Cancelling with Stop (S) or Halt (H) is now cited in section 3 from Fandom's Cast Animation page. A move order also cancels it, which is still from memory.
  - Autocast toggled by right-clicking the icon.
  - "Unified orders" (Ctrl) for controlling summons, and Tab to cycle units.
- **Smite (unconfirmed, from memory):** in third person the ground-target circle follows the camera's aim point, and range lines are drawn from the god along the camera's yaw. No primary Hi-Rez source on targeters was retrieved.
- **Phones (unconfirmed, from memory):**
  - Wild Rift shows a cancel zone near the top of the screen during a drag. Releasing over it cancels.
  - Wild Rift's tap-to-cast targets by its "targeting priority" setting.
  - Arena of Valor (Honor of Kings) has similar tap, drag and cancel areas and a "lock enemy hero" mode.
  - No official Riot, Moonton or Tencent document was found. Community guides are 1 to 2 years old and their menu names may have changed.
- **Dota and Smite hitbox sizes:** Dota hero hull and collision sizes, and Smite god hitbox sizes, were not retrieved.

## 3. Timing and resolution: wind-up, travel, hit rules, cancels and defences

### Takeaway
Each game splits a cast into a pre-commit phase and a resolve phase, and lets defences step in at different moments:
- **League:** a cast time (most often 0.25 seconds) that only death interrupts. Then missiles or areas resolve, and a spell shield eats the first enemy ability.
- **Dota:** a cast point that the player or a stun can interrupt for free (no mana, no cooldown), then a backswing that can be cancelled. Since patch 7.33, BKB debuff immunity no longer prevents targeting, but blocks debuffs unless they pierce.
- **Smite:** hard and soft crowd control, with hard ones interrupting channels and feeding diminishing returns. Smite 2 added "CC buffering", so a cast whose animation has just started survives crowd control.

Crowd-control tables are close across the three games. They differ in which effects tenacity or status resistance shortens, and whether repeated CC loses duration (only Smite does this).

### Cited Findings

#### League of Legends: cast time
- **Cast time** is the most common lockout. Rules:
  - Cooldown and cost usually apply after the cast.
  - The cast bar fills left to right, while channels drain right to left.
  - During a cast, movement, basic attacks, other abilities and most item actives are off. Exceptions include Shurelya's, Youmuu's, Randuin's and consumables.
  - Flash is usable by default, but some casts seal it.
  - Teleport, Recall and Hexflash are disabled, while Barrier, Heal, Ignite and Smite are usable.
  - Nothing interrupts a cast time except death. Some casts end on entering a resurrection state.
  - A cast can pause earlier orders, which resume afterward.
  - Whether orders buffer during a cast is set per champion.
  - When an ability has both, the cast time comes before the channel.
  - [Wiki: Cast time (marked outdated)](https://wiki.leagueoflegends.com/en-us/Cast_time); [Wiki: Ability](https://wiki.leagueoflegends.com/en-us/Ability)
- **Cast time values:** most are 0.25 seconds, and many fall between 0.25 and 1 second (0.4, 0.5, 0.75). The range runs from 0.1 to 1.25 seconds, and some scale down with attack speed or attack windup — [Wiki: Cast time](https://wiki.leagueoflegends.com/en-us/Cast_time)
- **Cooldown at cast start:** some abilities start their cooldown when the cast begins instead of when it ends: Jinx's Zap!, Kayle's Divine Judgment, Senna's Piercing Darkness, Thresh's Death Sentence and Yasuo's Steel Tempest — [Wiki: Cast time](https://wiki.leagueoflegends.com/en-us/Cast_time)

#### League of Legends: hits and hitboxes
- **Edge range:** basic attacks, skillshots and point-blank areas measure edge to edge on the gameplay radius, so large champions are easier to hit — [Wiki: Unit radius](https://wiki.leagueoflegends.com/en-us/Unit_radius)
- **Lollipop effect (community claim):** a skillshot that visibly misses can still hit a champion inside a small circle at the end of its path. The perspective camera also makes visuals drift from hitboxes depending on map position — [EUW forum: "How did that hit me"](https://boards.euw.leagueoflegends.com/en/c/new-player-advice-euw/aLOAwg9r-mini-tutorial-how-did-that-hit-me)
- **Hitbox changes:** patch 14.9 changed several champion hitboxes among the values 55, 65 and 80 — [Sportskeeda: PBE 14.9](https://sportskeeda.com/esports/league-legends-pbe-14-9-cycle-all-nerfs-hitbox-changes-far)

#### League of Legends: crowd control
The CC table below comes from a fetch that summarised the first 100,000 characters of the page. The silence row was re-checked on the Silence page.

| CC | Move | Attack | Cast | Interrupts channel | Summoner spells blocked | Tenacity | Cleanse / QSS |
|---|---|---|---|---|---|---|---|
| Airborne (knock up, back, aside; pull) | no | no | no | yes | Flash, Teleport, Hexflash, Mark/Dash | no | listed abilities only |
| Stun / Suspension | no | no | no | yes | same | yes | yes / yes |
| Sleep | no | no | no | yes | same | yes | yes / yes |
| Suppression | no | no | no | yes | **all** | no | QSS only |
| Stasis | no | no | no | yes | **all** | no | none |
| Forced action (Berserk, Charm, Flee, Taunt) | uncontrolled | uncontrolled or no | no | yes | Flash, Teleport, Hexflash, Mark/Dash | yes | yes / yes |
| Polymorph | yes (slowed) | no | no | yes | same | yes | yes / yes |
| Silence | yes | yes | no | yes | same | yes | yes / yes |
| Root | no | yes | partial | movement channels only | Flash, Teleport, Dash, Hexflash | yes | yes / yes |
| Ground | partial | yes | partial | movement channels only | Flash, Teleport, Dash, Hexflash | yes | yes / yes |
| Disarm | yes | no | yes | no | none | yes | yes / yes |
| Blind | yes | attacks miss | yes | no | none | yes | yes / yes |
| Cripple | yes | slower attack speed | yes | no | none | yes | yes / yes |
| Slow | reduced | yes | yes | no | none | yes | yes / yes |
| Drowsy | reduced | yes | yes | no | none | no | yes / yes |
| Nearsight | yes | partial | partial | no | none | no | QSS only |
| Kinematics (drag to a unit or point) | partial | yes | yes | no | none | no | none |

[Wiki: Crowd control](https://wiki.leagueoflegends.com/en-us/Crowd_control); [Wiki: Silence](https://wiki.leagueoflegends.com/en-us/Silence)

- **Only three things interrupt a dash or displacement:** airborne, knockdown and stasis. Knockdown also puts an airborne unit back on the ground — [Wiki: Crowd control](https://wiki.leagueoflegends.com/en-us/Crowd_control); [Wiki: Silence](https://wiki.leagueoflegends.com/en-us/Silence)
- **Polymorph** is the only CC that interrupts an uncancellable basic-attack windup — [Wiki: Crowd control](https://wiki.leagueoflegends.com/en-us/Crowd_control)
- **Forced actions:**
  - They share one debuff and override each other.
  - All but berserk end if the source dies.
  - Charm walks the target toward the source and flee away from it, both at reduced speed. Taunt makes the target attack the source.
  - Taunt and berserk are the only CC that could, in theory, break stealth.
  - [Wiki: Crowd control](https://wiki.leagueoflegends.com/en-us/Crowd_control)
- **Stasis** makes the unit untargetable and invulnerable — [Wiki: Crowd control](https://wiki.leagueoflegends.com/en-us/Crowd_control)
- **Silence and mobility:** silence blocks abilities and item actives, including mobility abilities such as Akali's Shuriken Flip and Kayn's Shadow Step, but it does not stop a dash already under way — [Wiki: Silence](https://wiki.leagueoflegends.com/en-us/Silence)
- **Tenacity and resistance:**
  - Tenacity shortens blind, cripple, disarm, forced action, ground, root, silence, polymorph, sleep, slow and stun.
  - It does not shorten airborne, kinematics, nearsight, drowsy, stasis or suppression.
  - Brittle cuts tenacity by 30% and ends when the unit is immobilised.
  - Self-applied or ally-applied CC cannot be reduced or removed, though some self-slows (Pyke's Bone Skewer, Galio's Shield of Durand, Varus's Piercing Arrow) are reduced by slow resist.
  - [Wiki: Crowd control](https://wiki.leagueoflegends.com/en-us/Crowd_control)
- **Assist credit:** every CC except blind and cripple counts toward assist credit — [Wiki: Crowd control](https://wiki.leagueoflegends.com/en-us/Crowd_control)

#### League of Legends: channels and spell shields
- **What interrupts a channel:**
  - Airborne, forced action, silence (including disrupt and polymorph), sleep, stasis, stun, suspension and suppression. These also prevent a channel from starting.
  - Root and ground interrupt movement channels only.
  - Taking damage interrupts objective channels.
  - "Disrupt" is a CC that only interrupts channels.
  - [Wiki: Channel](https://wiki.leagueoflegends.com/en-us/Channel); [Wiki: Ability](https://wiki.leagueoflegends.com/en-us/Ability)
- **Spell shield:** cancels one hostile ability.
  - It blocks active effects from champion abilities, epic monsters, summoned units and items.
  - It does not block runes or summoner spells, except Arcane Comet and the upgraded Smites.
  - Persistent area damage, terrain-creating spells (Crystallize, Pillar of Ice, Weaver's Wall) and dragon attacks are not blocked.
  - Multi-hit casts landing within 0.1 seconds are all blocked. Since V7.19 a shield that breaks does not also block other abilities landing at the same instant.
  - Delayed area effects of a spell are blocked even if an earlier part already applied. Already-applied debuffs are not.
  - Tethers: the first application can be blocked, later effects not.
  - Buffs, refunds and dashes on the caster's side still happen.
  - Priority: spell shield beats damage shields and CC, displacement and slow immunity. Ability shields go before item shields.
  - Sources: Sivir's Spell Shield, Nocturne's Shroud of Darkness, Banshee's Veil, Edge of Night and Verdant Barrier.
  - [Wiki: Spell shield](https://wiki.leagueoflegends.com/en-us/Spell_shield)

#### Dota 2: cast point and backswing
- **Cast point ("cast time"):** if the unit is interrupted before the cast point, the cast is cancelled, the effect does not apply, the ability does not go on cooldown and no mana is spent — [Fandom, read] [Fandom: Cast Animation](https://dota2.fandom.com/wiki/Cast_Animation)
- **Animation versus cast point:** the cast point is separate from the visible animation. The animation starts at once and so signals the cast point, and almost always lasts longer than the cast point — [Fandom, read] [Fandom: Cast Animation](https://dota2.fandom.com/wiki/Cast_Animation)
- **Backswing:** the rest of the animation after the cast point. The unit usually stays rooted and cannot act until the animation ends or is cancelled [Fandom, read]. Most items and all toggles have no cast point and no backswing [Fandom, read]. Attack backswing works the same way, and a move order after the attack point cancels it — (search summary) [Liquipedia: Cast Animation](https://liquipedia.net/dota2/Cast_backswing); [Liquipedia: Attack Animation](https://liquipedia.net/dota2/Attack_backswing)
- **Vector abilities:** for vector-targeted abilities, the cast point starts when the hotkey is pressed and the direction chosen — [Fandom, read] [Fandom: Cast Animation](https://dota2.fandom.com/wiki/Cast_Animation)
- **More cast animation rules [Fandom, read]:**
  - The animation starts as soon as a target is chosen, or on the hotkey for no-target spells.
  - Stop (S) or Halt (H) during the cast point cancels the cast for free.
  - A no-target ability with an instant cast point takes effect on the key press. Any ability that needs a target, unit or ground, interrupts the caster's own channel even when its cast point is instant.
  - Kinds of "instant":
    - *Zero cast point:* backswing still plays (Homing Missile).
    - *Immediate flag:* no point and no backswing, so it fires on the same server tick (Borrowed Time).
    - *Toggles:* none of either (Pulse Nova).
    - *Ignore-channel flag.*
  - Most items and all toggles never interrupt a channel. They can even be used between chained disables, because they have the highest cast-order priority.
  - Example: casting Shadow Walk then Marci's Force, Force goes off after 0.067 seconds: one server tick for its non-instant cast time, plus one tick between the two commands.
  - Rubick's stolen spells have a minimum cast point of 0.15 seconds.
  - Vector-targeting list on this page: Broodmother's Spinner's Snare, Clinkz's Burning Army, Dark Seer's Wall of Replica, Gyrocopter's Call Down (talent), Muerta's Dead Shot, Pangolier's Swashbuckle, Tusk's Walrus Kick, Void Spirit's Aether Remnant, Windranger's Gale Force and the creep Wildwing Ripper's Hurricane.
  - [Fandom: Cast Animation](https://dota2.fandom.com/wiki/Cast_Animation)
- **Cast range and the motion buffer [Fandom, read]:**
  - No-target, vector and area abilities: range is base plus bonuses. Bonuses do not grow the area of effect.
  - Unit-target: max range = base + bonuses + caster's collision size + target's collision size + 250. That last 250 is the "motion buffer": if the target walks out of range during the cast point but stays within range + 250, the spell still fires. The target must get 251 or more past range to cancel it.
  - Exceptions: Sniper's Assassinate has a 600 buffer and Spirit Breaker's Nether Strike 500. A zero-cast-point ability has no buffer.
  - Example: Luna's Lucent Beam, 800 range, on a 27-collision target, reaches 1104.
  - Point-target: base + bonuses + caster's collision size, with no buffer.
  - Ordering a cast from too far away walks the hero into range first.
  - [Fandom: Cast range](https://dota2.fandom.com/wiki/Cast_range)
- **What interrupts a channel [Fandom, read]:**
  - Any new order (move, stop, attack), casting another ability or using an item, with exceptions.
  - Any disable that blocks casting: stun, cyclone, hex, sleep, being hidden.
  - Most roots, though roots do not block casting.
  - Silence interrupts ability channels only, and Mute interrupts item channels only.
  - Some forced movements (Vacuum, X Marks the Spot), even from allies. Force Staff and Boulder Smash do not.
  - Usable without breaking a channel: toggles, invisibility abilities and a list of items (Glimmer Cape, Shadow Blade, Blade Mail, Phase Boots and others).
  - An interrupted channel keeps its mana and cooldown cost. Some, such as Illuminate and Powershot, still fire weaker.
  - [Fandom: Channeling](https://dota2.fandom.com/wiki/Channeling)

#### Dota 2: spell immunity and debuff immunity
- **Patch 7.33 rework:** spell immunity became debuff immunity.
  - Debuff-immune units can now be targeted by any spell, but blocked debuffs do not apply.
  - A blocked debuff that outlasts the immunity applies for its remaining time once the immunity ends.
  - Piercing debuffs apply at once.
  - Piercing is shown in the tooltip, is often per component of a spell, and can be added by Scepter or Shard.
  - Physical attacks still deal full damage. Pure and reflected damage are said to be negated by one source, while teamsmurf says pure damage hits normally. This is a conflict.
  - [ONE Esports: BKB 7.33](https://www.oneesports.gg/dota2/black-king-bar-debuff-immunity-7-33/); [GGScore: 7.33 debuff immunity](https://ggscore.com/en/dota-2/news/46223); [Player.one](https://www.player.one/dota-2-spell-immunity-debuff-immunity-bkb-155522)
- **BKB numbers conflict between sources:** 50% or 60% magic resistance; duration 9 seconds, falling by 1 second per use to a 5-second minimum, against 9/8/7 elsewhere — [ONE Esports](https://www.oneesports.gg/dota2/black-king-bar-debuff-immunity-7-33/); [teamsmurf: states, Oct 2026](https://teamsmurf.com/invulnerable-debuff-immune-banished-ethereal-dota-2/)

#### Dota 2: protective states
These come from a boosting-site guide that claims patch 7.41f.
- **Invulnerable:** cannot be targeted. Takes no damage. New disables are blocked and damage-over-time pauses. Examples: Puck's Phase Shift, Phoenix's Supernova, Brewmaster's Primal Split, Meepo's Poof (briefly).
- **Banished ("hidden"):** cannot act or be targeted. "Banished" is teamsmurf's word, and Fandom's Disable page calls this state "Hide".
  - "Lift" banishes: Eul's Cyclone (2.5 seconds, self or enemy) and Invoker's Tornado.
  - "Removal" banishes: Disruption, Astral Imprisonment.
  - Many area spells carry a "does not affect banished units" flag.
- **Ethereal:** physical attacks do nothing in either direction, and magic damage is amplified by 40% (Ghost Scepter, Ethereal Blade, Decrepify).
- [teamsmurf: states, Oct 2026](https://teamsmurf.com/invulnerable-debuff-immune-banished-ethereal-dota-2/)

#### Dota 2: Linken's Sphere, dispels and status resistance
- **Linken's Sphere:** Spellblock blocks most single-target spells aimed at the wearer, once every 14 seconds. It does not block allies' spells and does not dispel existing debuffs — (search summary) [Fandom: Linken's Sphere](https://dota2.fandom.com/wiki/Linken's_Sphere); [Liquipedia: Linken's Sphere](https://liquipedia.net/dota2/Linken's_Sphere)
- **Dispels [Fandom, read]:** three tiers, Basic < Strong < Death.
  - Basic removes stat-changing effects (slows, damage bonuses, silences) but not most hard disables (stuns, forced movement).
  - Strong removes every debuff except those that only death clears.
  - Dispelling an ally removes only debuffs, and dispelling an enemy removes only buffs.
  - Aura effects cannot be dispelled.
  - Basic sources include Manta Style, Lotus Orb, BKB's Avatar, Eul's and Wind Waker's Cyclone, Invoker's Tornado, Satanic and Nullifier.
  - Strong sources include Abaddon's Aphotic Shield and Borrowed Time, Aeon Disk, Oracle's False Promise, Slark's Dark Pact, Tidehunter's Kraken Shell, Ursa's Enrage, Weaver's Time Lapse, Phoenix's Supernova and Legion Commander's Press the Attack.
  - This **refutes** a boosting-site claim that Manta, Lotus and Tornado are strong dispels.
  - [Fandom: Dispel](https://dota2.fandom.com/wiki/Dispel); contradicts [teamsmurf: disables](https://teamsmurf.com/stun-root-silence-hex-break-dota-2-disables-explained/)
- **Status resistance:** shortens most debuffs, with a base of 0. At 20%, a 3-second stun lasts 2.4 seconds. It stacks with dispels and is not a dispel itself — (search summary) [Liquipedia: Mechanics](https://liquipedia.net/dota2/Mechanics); [teamsmurf: dispels](https://teamsmurf.com/basic-dispel-vs-strong-dispel-dota-2/)

#### Dota 2: disables
- **Disables [Fandom, read]:**

  | Disable | Move | Attack | Abilities | Items |
  |---|---|---|---|---|
  | Stun | no | no | no | no |
  | Sleep / Cyclone | no | no | no | no |
  | Silence | yes | yes | no | yes |
  | Break | yes | yes | passives off | yes |
  | Mute | yes | yes | yes | no |
  | Root | no (can still turn) | yes | situational | situational |
  | Leash | confined | yes | situational | situational |
  | Hex | set to a fixed speed | no | no | no |
  | Taunt | forced | forced | no | no |
  | Fear | forced | no | no | no |
  | Hide | no | no | no | no |
  | Ethereal | situational | no | yes | yes |
  | Disarm | yes | no | yes | yes |
  | Blind | yes | misses | yes | yes |
  | Trap | confined | yes | yes | yes |

  Notes:
  - Stuns share modifiers by group, so stuns of the same group refresh rather than add up. "Unique" stuns (Shackles, Black Hole) stack their own modifiers.
  - Sleep breaks on damage. Some sleeps grant invulnerability (Nightmare), others do not (Echo Stomp).
  - Cyclone lifts the target, which is invulnerable, and some cyclones also basic-dispel.
  - Movement slows are percentages and do not stack from the same source. Haste makes a unit immune to movement slows.
  - Silence freezes toggles in their current state and turns off autocast.
  - Hex silences, mutes and disarms, sets a fixed movement speed and destroys illusions.
  - Forced movement comes in fully disabling (Meat Hook on an enemy), non-disabling (Meat Hook on an ally), upward (cyclone) and pulling (Gale Force) kinds.
  - Root blocks mobility spells, and some roots also disarm.
  - Leash blocks blinks but does not cancel a cast in progress. It does not interrupt channels, except that it always cancels a TP.
  - A trap is either a pathing blocker (Fissure) or a barrier (Kinetic Field).
  - [Fandom: Disable](https://dota2.fandom.com/wiki/Disable)
- **More detail from a boosting-site guide:**
  - Stun stops everything.
  - Silence stops active spells, instant and channelled, and toggles.
  - Hex sets movement to about 140.
  - Break from Silver Edge and Diffusal pierces debuff immunity.
  - Knockbacks and forced moves: Dragon Tail, Meat Hook, Skewer, Flaming Lasso.
  - [teamsmurf: disables](https://teamsmurf.com/stun-root-silence-hex-break-dota-2-disables-explained/)

#### Dota 2: disjoint and dodging
- **Disjoint, defined [Fandom, read]:**
  - A disjoint is when a homing projectile loses track of its target. Outrunning a projectile until it expires is not a disjoint.
  - Nothing grants disjoint as its main effect. It comes as a side effect of three things:
    - **Blinks:** every blink disjoints, whatever the distance. Anti-Mage's Blink, Blink Dagger, Puck's Ethereal Jaunt, Weaver's Time Lapse and the TP scroll do. Reverse Polarity and other teleports not on the list do not.
    - **Invisibility:** a moment of it during the flight is enough, unless the enemy has True Sight. Fade time does not count, and entering fog of war is not invisibility.
    - **Listed cast-time disjoints:** Manta, Puck's Phase Shift, Storm Spirit's Ball Lightning, Riki's Tricks of the Trade, Naga's Mirror Image and others.
  - Invulnerability and being hidden do not disjoint. The projectile still arrives, but has no effect.
  - All attack projectiles can be disjointed, including attack modifiers.
  - Disjointable spells include Stifling Dagger, Magic Missile, Storm Hammer (which also cancels its area), Chaos Bolt, Shackleshot, Wraithfire Blast, Viper Strike and Assassinate. Assassinate reveals its target, so only Shadow Dance or Smoke escape it.
  - Undisjointable spells include Chain Frost, Arcane Bolt, Homing Missile, Spark Wraith, Paralyzing Cask, Leech Seed and Echo Slam. Some special cases: Huskar's Life Break cancels if the distance passes 1450. Tiny's Toss and Tusk's Snowball can only be outrun. Mystic Snake cannot be disjointed but misses a target that turned invisible.
  - 7.00 removed disjoint from Borrowed Time, True Form, Pounce, Metamorphosis and Leap.
  - [Fandom: Disjoint](https://dota2.fandom.com/wiki/Disjoint)
- **Manta Style:** its brief invulnerability, about 0.1 seconds by player report, can dodge non-instant spells if timed well. Players call it mostly luck because of latency — [Steam discussion: Manta dodging](https://steamcommunity.com/app/570/discussions/0/1489987634003382735/)

#### Smite: crowd control and immunity
- **Smite 2 hard CC:**
  - Stun: no attacks or movement.
  - Mesmerize: like stun, but ends on damage.
  - Root: holds in place. Abilities and attacks work, except leaps.
  - Silence: no abilities.
  - Disarm: no basic attacks.
  - Taunt: walk toward the source using basic attacks only.
  - Polymorph: no abilities or attacks, often with extra movement limits.
  - Banish.
  - Displacement: knock back or knock up. Some abilities grant displacement immunity.
  - [Smite 2 Wiki: Crowd Control (old revision)](https://wiki.smite2.com/w/Crowd_Control)
- **Smite 2 soft CC:**
  - Blind: limits vision of enemies and objectives.
  - Cripple: blocks movement abilities such as dashes, leaps and teleports.
  - Intoxicate: distorts vision and movement controls.
  - Slow.
  - Tremble: forced movement toward the source, with partial control.
  - Vortex: a pull toward a point that is harder to walk out of.
  - [Smite 2 Wiki: Crowd Control](https://wiki.smite2.com/w/Crowd_Control)
- **Smite 2 diminishing returns (wiki):**
  - Each stack cuts hard-CC duration by 10%, up to 4 stacks (40%).
  - A hard CC adds 2 stacks and a displacement adds 4.
  - Stacks last 6 seconds, refresh on each new stack and expire together.
  - Some abilities ignore diminishing returns.
  - [Smite 2 Wiki: Crowd Control](https://wiki.smite2.com/w/Crowd_Control)
- **The current wiki page agrees:** read in the built-in browser in November 2026, the live page gives the same 10% per stack, 4 stacks maximum, 2 per hard CC, 4 per displacement and 6-second stacks. It still leaves the Banish, Knock Back and Knock Up sections empty, and still classes Root as hard CC — [Smite 2 Wiki: Crowd Control, live](https://wiki.smite2.com/w/Crowd_Control)
- **Diminishing returns, older or conflicting figures** (the live wiki's version is preferred):
  - A Smite 2 explainer says 20% per stack with 2 stacks — [JustAbout](https://justabout.com/smite-2/38078/diminishing-returns-reward)
  - Smite 1 was 100%, then 66%, then 33%, with knockups and banishes exempt and slows included. Smite 1 example: Ymir's 2.25-second stun, then 1.5, then 0.75 — [Smite Academy, 2014](https://smiteacademy.wordpress.com/2014/10/17/guide-crowd-control-in-smite/)
  - A 2016 talk describes a 33%/66% model with a 0.5-second floor — [Speaker Deck: DR in Smite](https://speakerdeck.com/gane5ha/diminishing-returns-on-hard-crowd-control-in-smite)
- **Smite 1 classification, 2014:**
  - Hard CC is anything that interrupts channelling: Banish, Carry, Fear, Intoxicate, Knockback, Knockup, Madness, Mesmerize, Pull, Silence, Stasis, Stun and Taunt.
  - Soft CC: Blind, Cripple, Disorient (the camera spun randomly), Root and Slow.
  - Root counts as soft CC here but as hard CC on the Smite 2 wiki, which is a conflict.
  - CC-immune gods show a golden glow, and most ultimates grant immunity for their duration.
  - Purification Beads cleanses and grants immunity, has a short activation an auto-attack can interrupt, and cannot remove blind.
  - Magi's Blessing absorbs one hard CC every 45 seconds, then grants 1 second of immunity.
  - Equipment CC reduction capped at 40%.
  - Aegis put its user in stasis.
  - [Smite Academy, Oct 2014](https://smiteacademy.wordpress.com/2014/10/17/guide-crowd-control-in-smite/)
- **Ramp-up stuns:** hard-CC immunity blocks a ramp-up stun, and slow-prevention does not. Such an effect counts as the CC it ends in — (search summary) [Smite Fandom: Crowd Control](https://smite.fandom.com/wiki/Crowd_Control)
- **Smite 2 CC buffering:** an ability can still go off if CC lands as its animation begins. In Smite 1, CC landing mid-animation cancelled the ability entirely. This was a community concern at the time — (search summary; the article itself returned 404) [ZLeague: Smite 2 CC buffering](https://www.zleague.gg/theportal/smite-2-update-exploring-cc-buffering-and-player-reactions/)
- **Beads cooldown conflict:** 150 seconds in Smite 2, against 160 or 170 seconds in older Smite 1 sources — [SmiteSource: Beads](https://smitesource.com/item/purification-beads); [Smite Fandom: Beads](https://smite.fandom.com/wiki/Purification_Beads)

### Inferences
- **Two rival models of wind-up:**
  - League: the cast cannot be interrupted, so a started cast always comes out. It reads as reliable, and counterplay comes after the cast: dodging the missile, a shield.
  - Dota: an interrupted cast point refunds everything. It reads as fair to the interrupter, and counterplay comes before resolution.
  - Smite 2 moved from Dota-like cancelling toward League-like reliability ("CC buffering").
  - For a 1v1, choose one model per spell class and show it. One sensible split: short wind-ups (0.25 seconds or less) cannot be interrupted, and long, telegraphed ones (0.5 seconds or more) can be stopped by a stun with a full refund.
- **One-shot negation is the cheapest readable defence.** League's spell shield, Dota's Linken's and Smite's Beads are all "cancel the next thing". The rules needed are:
  - what counts as "one ability" (League: all hits within 0.1 seconds of one cast)
  - whether delayed parts are blocked
  - whether the caster still gets refunds and dashes
  League's wiki gives a ready rule set for these.
- **Dota 7.33 shows a trend away from "cannot target".** Immune units became targetable, with debuffs blocked rather than the click refused. A spell cast on an immune target should still visibly land and show "immune". The alternative, a click that does nothing, feels like a bug.
- **Diminishing returns matter more in a 1v1, with only one target to chain on.** Smite's model (stacks that expire together after 6 seconds, displacement counting double) stops chain-stun locks. League relies instead on tenacity and kit design. [Transfers to 1v1: one player chaining all their CC onto the only other player is the duel's worst case.]
- **League's "only airborne, knockdown or stasis stop a dash" rule** makes dashes very reliable. A 1v1 that wants dashes to be interruptible needs to decide which CC does it.
- **Dota's 250-unit motion buffer is a ready rule for targeted wind-ups.** A target that just steps out of range during the wind-up still gets hit. Walking well clear cancels the spell, with no cost. This keeps unit-targeting reliable while still rewarding a real escape.
- **Dota's disjoint list amounts to a design rule.** Homing projectiles are dodged by blinks and invisibility, but not by invulnerability. Each spell carries its own flag: Assassinate is disjointable, while many basic spells such as Arcane Bolt and Paralyzing Cask are not. A 1v1 with homing spells needs the same explicit flag for each spell, plus a visible difference between dodgeable and undodgeable homing projectiles.
- **Dota's channel cost rule is the opposite of its cast-point rule.** An interrupted channel loses its mana and cooldown, while an interrupted cast point loses nothing. Channels are therefore a real commitment, and some (Powershot, Illuminate) fire weaker rather than not at all, which softens the loss.

### Gaps
- **Dota (unconfirmed, from memory):** typical hero cast points are 0.0 to 0.5 seconds, with 0.3 to 0.4 common. No table of cast points was read. The backswing half of the Cast Animation page fell past the character cap, including its rules for cancelling backswing and how talents or items change cast point.
- **League (unconfirmed, from memory):**
  - The server decides hits in fixed steps, often cited as 30 per second.
  - Untargetable dashes (Fizz's E, Vladimir's W) and "unstoppable" CC-immune states (Malphite's R, Olaf's R) exist. The wiki's "UnstoppableForceMarker" and immunity sections were in the truncated part of the page.
  - Missile widths add to the gameplay radius for collision. Not confirmed: the Unit radius page names gameplay radius as the reach for line missiles but gives no formula.
- **Smite (unconfirmed, from memory):** projectiles stop on the first enemy god or minion unless they pierce, and player-made walls block projectiles. No retrieved source covers hit rules for Smite projectiles, travel speed, the server tick or a numeric definition of the CC-buffer window.
- **Dota taunt detail:** the Disable page's taunt section was cut off past the character cap.

## 4. Telegraphs and readability: what the enemy is shown

### Takeaway
Riot is the only one of the three studios with a public, specific rule set:
- Hitboxes must match visuals.
- Visual weight scales with damage, CC strength, how dodgeable a spell is and how much it changes play.
- Every effect has anticipation, then the main effect, then dissipation, with short lingering.
- Projectiles show their direction even when still.
- Ally indicators are blue, enemy indicators red.
- Skins never read less clearly than the base ("clarity parity").

Dota's main telegraph is the cast animation, which starts at once and therefore signals the cast point. No Valve or Hi-Rez design text was retrieved.

### Cited Findings
- **Riot's three clarity goals:** gameplay should be clear, so players can identify and react to champions, spells and attacks. Hierarchy should hold, so the most important moment on screen draws the most attention. Noise, visual and audio, should be minimal, though big spells may be louder — [Riot: Clarity in League, Mar 2021](https://www.leagueoflegends.com/en-us/news/dev/clarity-in-league/)
- **Hitbox rule:** hitboxes must match the visual effects — [Riot: Clarity in League](https://www.leagueoflegends.com/en-us/news/dev/clarity-in-league/)
- **Visual weight scales with importance:**
  - Damage: Zoe's Q is bright and saturated, with an audio cue beforehand.
  - Hard or long CC: Taric's stun is bright, with an audio wind-up and a well-defined hitbox.
  - Dodgeability: dodgeable spells should draw more attention. Arcane Comet is a bad example, because its big ground circle suggests more dodgeability than it really has.
  - Impact on play: Kayle's ultimate is bold.
  - [Riot: Clarity in League](https://www.leagueoflegends.com/en-us/news/dev/clarity-in-league/)
- **Projectiles** must show their travel direction even when still, often by blurring the tail — [Riot: Clarity in League](https://www.leagueoflegends.com/en-us/news/dev/clarity-in-league/)
- **Silhouettes:** facing direction should be readable at a glance, and each champion keeps one primary silhouette feature that skins never change — [Riot: Clarity in League](https://www.leagueoflegends.com/en-us/news/dev/clarity-in-league/)
- **Skins:**
  - Skin abilities must be at least as clear as the base ("clarity parity").
  - Established shape language should be reused, such as scrolling lines for spell shields.
  - Skins must read on every map.
  - Lasting transformations should be avoided.
  - [Riot: Clarity in League](https://www.leagueoflegends.com/en-us/news/dev/clarity-in-league/)
- **Cosmetic animations** give no competitive edge, and a champion must not leave its hitbox during one — [Riot: Clarity in League](https://www.leagueoflegends.com/en-us/news/dev/clarity-in-league/)
- **Riot's internal VFX style guide** ("The Complete Guide to Creating Visual Effects Within League of Legends"). This comes through a secondhand student-wiki summary dated April 2026.
  - Goals in order: clarity, minimal clutter, theme, surprise.
  - Each effect has one primary element (focal, high value, clear silhouette, strong shape, high opacity) and secondary elements (lower value, softer shape, lower opacity).
  - Palettes are analogous, and a complementary colour must be demoted to secondary.
  - UI, character, VFX and environment each occupy their own value and saturation band. VFX should avoid 0% and 100% values.
  - Every effect has anticipation, a main part and dissipation, with dissipation lower in value and opacity.
  - Timing is non-linear for impact (Ekko's R), and lingering is kept short.
  - The importance ladder runs: idle particle, basic attack, defensive spell, damage spell, game changer, ultimate.
  - AoE visuals show the true radius at ground level so the camera angle cannot mislead. Teemo's mushroom and Sona's ultimate were redesigned to fix this.
  - Ally indicators are blue and enemy indicators red.
  - Fast particles need motion blur.
  - [GDAD wiki summary of the Riot VFX guide](https://gdad.wiki/wiki/sources/source-lol-vfx-style-guide)
- **Valorant parallel:** Riot's Valorant uses a friend-or-foe rim light, red for enemies, on characters. Ability VFX vary too much to scale one way and are held to performance budgets instead — [Riot: Valorant shaders and gameplay clarity](https://www.riotgames.com/en/news/valorant-shaders-and-gameplay-clarity)
- **Dota's telegraph:** the cast animation starts immediately and so signals the cast point, while the cast point itself is separate from the animation's length — [Fandom, read] [Fandom: Cast Animation](https://dota2.fandom.com/wiki/Cast_Animation)
- **Smite telegraphs:** CC-immune gods glow gold — [Smite Academy, 2014](https://smiteacademy.wordpress.com/2014/10/17/guide-crowd-control-in-smite/)
- **Tooltips:** League's in-game tooltips hide range and targeting, which show only by hovering the HUD icon. Dota marks BKB-piercing per spell in the tooltip — [Wiki: Ability](https://wiki.leagueoflegends.com/en-us/Ability); [ONE Esports](https://www.oneesports.gg/dota2/black-king-bar-debuff-immunity-7-33/)

### Inferences
- **A telegraph checklist for each spell:**
  1. The hitbox equals the drawn area at ground level.
  2. There is an anticipation phase whose length matches the wind-up.
  3. The primary shape is strong and secondary flourishes are faint.
  4. Size, saturation and sound rise with damage, CC strength and dodgeability.
  5. Enemy-owned telegraphs use the enemy colour (red) and own or ally ones use the ally colour (blue).
  6. Lingering stays short.
  7. Projectiles show their heading.
- **Dodgeability should be legible.** Arcane Comet's lesson is that a big circle promises a dodge. A spell that cannot really be dodged should not draw a large dodge-looking circle. [Transfers fully to 1v1.]
- **In a top-down camera, ground-level truth is easier than in League's tilted view.** The "lollipop" and camera-angle complaints mostly come from the tilt. A browser MOBA with a steep camera can draw hitboxes almost exactly.
- **Show protective states on the body**, like Smite's gold glow for CC immunity, Dota's BKB and League's spell-shield scrolling lines. In a 1v1 the opponent's whole question is "can I hit them right now".

### Gaps
- **Which League indicators the enemy sees** was not retrieved. From memory and unconfirmed: many delayed ground spells (Xerath's W, Ziggs's E, Brand's W, Veigar's E) show a warning circle to enemies, while normal skillshot indicators are private to the caster.
- **No Valve design text on Dota readability was retrieved.** Unconfirmed, from memory: Dota relies on cast animations, sound cues for big ultimates (some play globally) and "particle warnings" such as Kunkka's Torrent bubbles and Leshrac's Split Earth.
- **No Hi-Rez notes on Smite telegraphs were retrieved.** Unconfirmed, from memory: Smite draws enemy ground targeters for some ultimates, and audio voice lines announce ultimates.
- **Team-coloured telegraphs as an option** (red or blue indicators for enemy spells) could not be confirmed for Dota or Smite.

## 5. What each game does uniquely well, and what players complain about

### Takeaway
- **League:** the richest input options (three cast modes per key, self-cast fallback, forgiveness radii, WASD since 2025) and the clearest public readability rules. Complaints centre on hitboxes not matching what players see.
- **Dota:** deeper mechanical expression (cast point cancels for free, turn rate, vector casts with two input styles, the 250 motion buffer, disjoints; shift-queue too, from memory), plus a 2023 rework that made immunity readable. Complaints centre on latency-dependent dodges.
- **Smite:** casting through a third-person reticle, with per-god cast modes and the only formal diminishing returns. Its newest change, CC buffering, was controversial.

Phone MOBAs make the same choices through settings for auto-aim priority and lock-on. Smart retargeting onto the wrong unit is the main complaint.

### Cited Findings
- **League does well:**
  - Quick cast with indicator lets players preview and still cancel at the speed of quick cast.
  - Self-cast fallback.
  - Targeting forgiveness of 175 units on ally spells.
  - Separate gameplay and selection radii.
  - Per-key cast modes, with always-quick-cast exceptions for movement spells such as Flash, Ahri's Spirit Rush and Fizz's Playful/Trickster.
  - [Wiki: Quick cast](https://wiki.leagueoflegends.com/en-us/Quick_cast); [Wiki: Targeting](https://wiki.leagueoflegends.com/en-us/Targeting); [Wiki: Unit radius](https://wiki.leagueoflegends.com/en-us/Unit_radius)
- **League complaints:** skillshots hit when they look like misses (the "lollipop" end and the camera angle). A players' thread asks Riot to fix hitboxes — [EUW forum](https://boards.euw.leagueoflegends.com/en/c/new-player-advice-euw/aLOAwg9r-mini-tutorial-how-did-that-hit-me); [NA forum: fix hitboxes](https://boards.na.leagueoflegends.com/en/c/gameplay-balance/ExYsl4pm-can-we-finally-fix-hitboxes-please)
- **League hitbox tuning:** Riot still changes champion hitboxes between 55, 65 and 80 to tune how easy they are to hit — [Sportskeeda: PBE 14.9](https://sportskeeda.com/esports/league-legends-pbe-14-9-cycle-all-nerfs-hitbox-changes-far)
- **Dota does well:**
  - Cancelling before the cast point costs nothing, which allows feints and baiting.
  - Vector targeting is a general system across many heroes, with key-up and key-down quick-cast variants.
  - Facing and turn rate make positioning matter.
  - Since 7.33, debuff-immune units stay targetable while blocking debuffs, with piercing marked in each tooltip.
  - [Fandom: Cast Animation](https://dota2.fandom.com/wiki/Cast_Animation); [Fandom: Cast range](https://dota2.fandom.com/wiki/Cast_range); (search summary) [Liquipedia: Abilities](https://liquipedia.net/dota2/Abilities); [ONE Esports](https://www.oneesports.gg/dota2/black-king-bar-debuff-immunity-7-33/)
- **Dota complaints:**
  - Manta dodging feels like luck because of latency.
  - A 2022 quick-cast change to Pangolier's and Marci's vector spells upset players until a setting restored the old behaviour.
  - Double-tap self-cast does not work with quick cast.
  - [Steam: Manta dodging](https://steamcommunity.com/app/570/discussions/0/1489987634003382735/); [Dotabuff forum, 2022](https://www.dotabuff.com/topics/2022-04-24-pango-swashbuckle-changed); [Steam: Quick self cast](https://steamcommunity.com/app/570/discussions/0/617336568072951257/)
- **Smite does well:**
  - Per-god Normal, Quick or Instant cast.
  - Configurable ground-target arrow and range "ruler".
  - Formal diminishing returns that expire together.
  - A one-relic choice between CC immunity (Beads) and damage immunity (Aegis).
  - [Item Level Gaming](https://itemlevel.net/smite-2-best-settings-guide/); [Smite 2 Wiki: CC](https://wiki.smite2.com/w/Crowd_Control); [Digital Trends](https://www.digitaltrends.com/gaming/smite-2-relics-when-to-pick/)
- **Smite complaints:** "Double Tap to Fire" is called clunky. CC buffering raised community concern because a stun no longer cancels a cast that has just begun — [Item Level Gaming](https://itemlevel.net/smite-2-best-settings-guide/); (search summary) [ZLeague](https://www.zleague.gg/theportal/smite-2-update-exploring-cc-buffering-and-player-reactions/)
- **Phone complaints:**
  - Mobile Legends' smart targeting can steal a Hero Lock and aim at a minion.
  - Wild Rift's centre-locked buttons cast by accident on short drags.
  - Pokémon Unite's aim snap prevents aiming a move away from enemies to escape.
  - [BitTopup MLBB](https://bittopup.com/article/Mobile-Legends-Controls-Guide-2025-Pro-Settings-Setup); [TheGamer: Wild Rift](https://www.thegamer.com/league-of-legends-lol-wild-rift-best-settings-guide/); [GamingOnPhone: Unite](https://gamingonphone.com/guides/pokemon-unite-guide-best-settings-for-mobile)

### Inferences
These are ideas to take for a 1v1 top-down browser MOBA:
1. **Cast modes:** offer the three modes per key, with release-to-fire plus cancel as the default. It is the same gesture on touch.
2. **Forgiveness:** self-cast fallback, and a forgiveness snap of about 175 game units for unit-targeted spells (in our units, about one hero width plus a bit).
3. **Aim snap:** auto-aim on tap that snaps to the enemy hero, never to a summon unless the player chooses it, plus a way to aim away from the enemy on purpose.
4. **Wind-up model:** declare per spell whether the wind-up can be interrupted (with a full refund) or not, and show that with the telegraph.
5. **Stun chains:** apply Smite-style diminishing returns or League-style limits on chaining, because the 1v1 has one target.
6. **Immunity:** make immune states visible on the body, and make spells cast on them land visibly with an "immune" result rather than being refused.
7. **Telegraph rules:** follow Riot's rules (section 4).

**Risks to avoid:**
- Hitboxes that differ from visuals.
- Dodges that depend on latency. In a browser game, ping varies more than on a native client.
- Lock-on that retargets on its own.

### Gaps
- **Systematic player-complaint data** was not found for any of the three games. The complaints above are single threads and guide warnings, not measured volume.
- **No developer post-mortems** on casting input (Valve on vector targeting, Hi-Rez on the third-person targeter, Riot on quick cast) were retrieved. Unconfirmed, from memory: Riot added "quick cast with indicator" and made it a common default, and Dota introduced vector targeting around 2018 to 2019 with Pangolier's Swashbuckle and Grimstroke.
- **Honor of Kings and Arena of Valor** casting systems (a cancel zone, "lock hero" targeting) were not researched with sources.
