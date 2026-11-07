# Noonfall: the Raid's own place, the bosses' own bodies, mechanics players do

User, 2026-11-07: "make like dedication like new place for them", "make the bosses be different than from heroes like something new
extra and all should have like phases and spells to dodge", "so players can do mechanics of the boss when playing". Asked and answered the
same day: **one place to walk through**, and **the same bosses with new bodies**. Every number is a starting value. Names, bodies and
mechanics are original: principles from raid games, never a boss, kit or name.

**As built (2026-11-07):** how it works now is in `docs/architecture/raid.md`. Changes from this plan:
- Built in the order mechanics, bodies, hall, gates (not bodies first), after a review: mechanics were asked for twice.
- A boss's body goes through the same model loader as a hero's (`Hero`), with no skeleton: a `look` on the kit poses its parts. No separate class.
- Rewards are paid by the hub from one table (`RAID_REWARDS`) when the brain's screen asks, never by a client's own numbers.
- Seal the vent makes the lava wait 20 s longer instead of sinking a step: the floor's stages only go forward.
- Noon gathers for 8 s, with the shadows for its last 4.
- The rooms got the hall's gates. Their floors and cover are as they were: the moves were tuned on them.
- Extra parts on the bodies: a `corona` on the Warden's sun, `plateA` to `plateE` on Ash, so phases have something to change.

The rules in `src/raid/types.ts` stay: a move never reads a hero, each step is its own cast, each screen decides hits on its own hero,
shared things go through `RaidLink`.

## The place

**Noonfall Keep.** A sun fell into a mountain at noon. The Sun Warden still keeps the court above it, under the eclipse it left. Ash and Ember
keep the pit below, where it still burns. The hall between them is built round what is left of it.

**The hall** (`src/arenas/noonfall.ts`, not in `ARENAS`): round, radius 13. In the middle a cracked gold sun disc sunk in the floor, lava in the
cracks: marble and gold on the Court's side, basalt on the Pit's. Two gates on the far side, where the camera sees them: the Court's and the Pit's.
Three altars in an arc in front of the disc. Heroes come in from the south.

```
          Court gate      Pit gate
                 \         /
                   (disc)
              [A]   [B]   [C]
                     ^
                   heroes
```

**The run**, with no more cards over a black screen:

1. The hero stands in the hall, and walks. Over each altar floats an upgrade: its name and what it does.
2. **Walk onto an altar to take it**, or tap its card and the hero walks there. 30 s, and time out takes the first, as now.
3. The gate to the next boss opens. **Walk into it.** For two it opens once both have picked, and the fight starts when both are in, or after 15 s.
4. A short fade, and the hero stands at the room's south gate. A loading page only if the room is not ready in about a second.
5. The boss falls: the room's north gate opens, and a fade takes the hero back to the hall. The gate just used stays lit, the next one opens.
6. Lost, or the card's Leave: the result card as now.

No spells in the hall: walking only. The hub's order becomes `offer → gate → loading → fight`; a new message each way (`raid_gate`, `raid_enter`).

**The rooms** stay where the moves were tested (same radius, same cover spots, so no move changes) and get remade to belong to the place: the same gate at their south and north,
the Court with the crack where the sun tore through and lit by what's below it, the Pit with the fallen sun's gold showing in the vent.

## The bodies

Not heroes drawn big. No shared rig, no skinning: **rigid parts in a named hierarchy, animated in code** (`src/raid/bodies/`). Rock and gold don't bend, so this suits them, and no
hero's walk can leak in. Each must read from the game's steep camera, so what matters most is on top and wide. `HeroFigure.setModel` sees a url under `models/bosses/` and hands over to `BossBody`, so the duel
keeps calling the same methods on the same figure, on both screens and on the rim.

| Boss | Height, radius | Body | Parts (node names) | What each phase changes |
|---|---|---|---|---|
| **Sun Warden** | 5.4, 1.2 | A floating stone sentinel with no legs. A tapered monolith with gold inlay, slabs for shoulders, a broad carved mask, a halo ring round a small sun, and two huge fists that float free | `core`, `mask`, `halo`, `sun`, `slabL`, `slabR`, `fistL`, `fistR`, `stones` | Awake: the sun dim, the halo still. High Noon: it blazes and the halo turns. Last Light: the slabs break away and orbit, and the sun goes black with a corona |
| **Ash** | 5.8, 1.3 | A hunched magma brute on his knuckles. Separate plates of basalt over a glowing core, forearms bigger than his body, a small sunk head | `torso`, `head`, `armL`, `foreL`, `fistL`, `armR`, `foreR`, `fistR`, `legL`, `legR`, `core` | Each phase the seams burn hotter and plates fall away, so the core shows more |
| **Ember** | 4.0, 0.9 | A flame in a burnt mantle, no legs, no face. A hollow hood, tatters of ash with glowing edges, a white-hot core, two lanterns that orbit her | `hood`, `mantle`, `core`, `lanternL`, `lanternR` | The lanterns orbit faster and the flame grows |

They keep their rules: hit by what touches the body (`foe.body`), not moved, the stagger gauge, the fade when they hide a hero. The Warden has nothing to walk on, so it glides; Ash knuckle-walks; Ember drifts and backs away.
Files: `blender/bosses/boss_bodies.py`, then `public/models/bosses/warden.glb`, `ash.glb`, `ember.glb`.

## Mechanics players do

All **by walking**, so a phone needs no new button. Every phase of every boss has something to do besides dodging:

| Boss, phase | Mechanic | What the player does | The reward |
|---|---|---|---|
| Warden, Awake | **Break the ray** (new) | Pillar Fall's stones stay 8 s as cover. Stand behind one when Sun Ray comes | The ray shatters the stone: +40 on the stagger gauge |
| Warden, High Noon | **Turn the light** (new) | "Gathering Noon" fills for 7 s and sun shards fall, far from the altar. Walk over one to carry it (walk 15 % slower, it glows over your head), and walk it to the altar. Alone one shard, for two one each. | No Noon, the Warden kneels and takes 5 % of its max HP. Fail, and Noon comes as it does now: hide behind cover |
| Warden, Last Light | Anchors, as now | Stand in the gold, one then the other. For two both at once | No hit |
| Ash and Ember, first | Charge into cover, as now | Put cover behind you | He stops dead, open for 2 s |
| Ash and Ember, Ember steps in | **Burn your own** (new) | Ember's mark follows you, and lands where you stand. Carry it onto whichever of them is in the ring | The burst hits them instead: 4 % of max HP and +40 on the gauge |
| Ash and Ember, Together | **Seal the vent** (new) | The lava rises. Stand on the vent in the middle for 4 s, hits or not, and casting stops it | The lava sinks one step and the one in the ring is staggered +40. Twice a fight |

**One new piece for all of them: an objective** (`Objective` in `types.ts`, played in `script.ts`): a spot a hero can take, at once or after holding. A move's `play` returns them next to its threats. Each screen watches its own hero and reports with
`link.objective(id, part)`. The hub takes the first report only and tells both screens who did it (`boss_obj`, then `boss_done`), and `LocalLink` does that on the spot, so it stays within rule 4. Objectives get the same gold rings and edge arrows as gold zones. A kneel asked for by an objective is the hub's, as any kneel is.

The autopilot (`Duel.pilot`) goes for objectives, so the balance tool and tests exercise them.

## What it costs, what could go wrong

- **Fight time goes down** when a mechanic works, which may make them too easy. Measure with the autopilot, then a person. Numbers are starting values.
- **The hall adds walking** before every fight. It must stay short: the farthest altar about 5 s from the start, the gate about 3 s further.
- **`PROTOCOL` goes to 5**, because the hub's order changes. An old tab gets the Reload bar.
- **A hero left standing in the hall** is covered by the timers, as the pick already is.

## Order

1. **Bodies:** the system with the Warden, then Ash and Ember. Blender runs one job at a time.
2. **Objectives and mechanics,** alone first, then for two: hub, smoke test, `_raidCheck`, `_raidAsh`.
3. **The hall,** alone first, then for two.
4. **The rooms' gates and remake.**
5. **Retest all of it,** measure with the autopilot, docs. No push and no deploy without a new ask.

**Not this job:** a third boss, new moves beyond these, friend brackets, spectating. Sound is not in the game yet.

## The lairs (user, 2026-11-07: "make the boss room different from the arena, it is supposed to be where the boss lives")

The boss rooms still used the duel arenas' props (the temple's for the Court, the caldera's for the Pit), so they read as arenas. Each
becomes the boss's home. **Every obstacle stays where it is, with the same size:** the moves were tuned on that cover. Only the look
changes: props, floor, backdrop, sky and light, and what moves in the air.

| Room | Its story | Cover (same spots) | Floor | Around it | In the air |
|---|---|---|---|---|---|
| **The Warden's sanctum** (the Sun Court) | The top of the mountain, where he keeps watch over the hole the sun tore. His throne faces the eclipse | The six screen walls become carved sun-stone slabs with gold seams (whole, cracked, rubble); the eight columns become sun obelisks with a gold disc on top; the middle altar becomes the Sun Well where shards are delivered | A great sundial: hour marks, a gnomon's shadow, cracks of light | His empty throne on a stepped plinth past the north gate; broken sun arches; floating rocks like his own; tall obelisks | Rocks drifting up and down, motes of light |
| **Ash and Ember's den** (the Cinder Pit) | The crater the sun fell into, where it still burns under the floor. They nest here | The four basalt clusters become obsidian spires with ember cracks; the two ridges become slag walls of cooled lava; the four stumps become anvil stones with live coals; the five rim perches become Ember's lantern perches | Black glass and cooled lava over a buried sun: gold light through the cracks, Ash's claw marks | A great fallen sun shard half sunk in the lava; the ribs of something huge that burned; posts with hanging lanterns round the crater | Embers rising, heat haze on the lava |

Props come from Blender (\`blender/arenas/sanctum_props.py\`, \`den_props.py\`), named \`<Prop>__<material>\` as the other arenas' are, so the
same instancing code places them. The Court keeps its breakable walls: the sanctum's file has \`Wall\`, \`WallCracked\` and \`WallRubble\`.
Nothing over 2 m on the camera's side, as in every arena (\`checkCameraRule\`).
