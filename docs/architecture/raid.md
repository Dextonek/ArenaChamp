# The Raid

A boss fight on the duel's vs-CPU path, alone or for two. What the Raid is and why: [duels-and-raid.md](../../pipeline/designs/duels-and-raid.md).
The order it was built in and how each piece was checked: [raid-build.md](../../pipeline/designs/raid-build.md). This file says
how it works now.

It shows to everyone: in the top bar, and on the login screen for a raid with no account. An old `/game?raid` link still works, because the page ignores the `?raid`.

**Noonfall** (user, 2026-11-07: a place of their own, bosses unlike heroes, mechanics to do; design and decisions in
[raid-noonfall.md](../../pipeline/designs/raid-noonfall.md)). A sun fell into a mountain at noon. The Sun Warden keeps the court above it, Ash and
Ember the pit below, and the run waits in the hall between them. Under the hall lies the fallen sun itself, the Heart of Noon
([raid-heart.md](../../pipeline/designs/raid-heart.md), 2026-11-11).

## The run

Walk onto an altar in the hall to take an upgrade, walk through the gate, fight the Sun Warden. Back to the hall, another altar, the next gate,
Ash and Ember; then a third altar and the north gate, the Heart of Noon. Beat all three (`RAID_RUN`) and the next tier is offered, keeping the
upgrades, for a higher score. HP is full at each fight. One loss ends the run: alone that is one fall, for two it is both down at once.

## Noonfall's hall

`src/raid/hall.ts` and `src/arenas/noonfall.ts`. Round, radius 13, not in `ARENAS`. A gold wheel half sunk in the middle with lava in its
cracks; marble and gold on the Court's side (west), hex basalt on the Pit's (east); three broken gold rays standing between the two gates, and behind
them, at the north centre, the gate down to the Sunken Heart (`HALL_GATES.heart`; its lintel carries a heart in a ring, its light is white gold).
The hall draws one gate for each boss of `RAID_RUN`. All drawn in code with the temple's and the caldera's props: first-pass, for the artist to direct.

| What | How |
|---|---|
| Altars | Three low daises in an arc before the wheel, each with a light and a card naming its upgrade. Walk onto one to take it (1.5 m), or tap its card and the hero walks there. 30 s; time running out takes the first. Taking one drops the walk order, so the hero isn't held on the altar |
| The gate | Opens once the pick is in (for two, once both are). Walk into it (2 m) and the screen fades into the fight. For two the fight starts when both are in, or after 15 s |
| A hall visit | About 8 s for two bots from arriving to the fight: the pick, the walk, the gate |
| Only walking | No spells and no attacks in the hall: the spell panel hides (`HeroMode.setWalkOnly`) and the autopilot only walks |
| How it is made | A boss fight with no boss (`BossDef.hall`): the same duel path, so the hero walks and the partner shows as in a fight. The altars and the gate are objectives (below), so the edge arrows, the autopilot and the bots find them with no code of their own. `HallLink` keeps everything on this screen |
| Loading | A fade (`fadeTo`), and the loading page only when a room takes over 1.2 s |

Each boss room has the hall's gates too (`KeepGate`, `BossDef.gates`): one in at the south, lit until the fight starts, and one out, lit when
the boss falls. In the Cinder Pit the way out stands between two of the rim's perches.

## Bodies

Not heroes drawn big: each boss has its own model of rigid parts in a named hierarchy, no skeleton, posed in code by a look
(`src/raid/bodies/`: `BodyLook`, `BodyParts`; `HeroKit.look`). `HeroFigure` hands a kit with a look to it instead of the hero's walk, so the
duel, the rim and the partner's screen call the same methods. Built by `blender/bosses/boss_bodies.py`; sheets in `docs/bosses/`.

| Boss | Model | Parts | Phases |
|---|---|---|---|
| Sun Warden | A floating stone sentinel: a gold-inlaid monolith, slab shoulders, a carved mask, a halo round a small sun, two free fists, a ring of floating stones. 5,554 triangles | `core`, `mask`, `halo`, `sun` (`corona`), `slabL`, `slabR`, `fistL`, `fistR`, `stones` | The sun dims to black with a corona, the halo turns, the slabs break away |
| Ash | A hunched magma brute on his knuckles: basalt plates over a glowing core, huge forearms. 6,780 | `torso`, `head`, `core`, `armL`/`foreL`/`fistL`, the same on the right, `legL`, `legR`, `plateA` to `plateE` | Plates fall away, seams burn hotter |
| Ember | A flame in a burnt mantle: a hollow hood, a white-hot core, a torn mantle with glowing tips, two orbiting lanterns. 2,597 | `hood`, `mantle`, `core`, `lanternL`, `lanternR` | The lanterns orbit faster, the flame grows |
| The Heart of Noon | The fallen sun: a molten heart in a crust of basalt plates, a calm gold face in front, three armillary rings, a crown of snapped rays, two sun blades for hands. 8,846 | `core` (holds `mask`, `crown`, `ringA`, `ringB`, `ringC`), `bladeL`, `bladeR`, `shards` | The seams burn brighter; in The Rings Turn the rings come down round its foot and lie flat, each turning with its beam (a locked one goes dark); in Noon Falls the crown turns and each Heartbeat swells it. The crust is one mesh, so the plates that fall are drawn by the Heartbeat itself |

**Every attack strikes when it lands** (user, 2026-11-08: "if the boss is attacking he should make some animation for it so that it makes
sense"). A cast's pose winds up over the whole cast bar and strikes as the zone lands (`beat` in `look.ts`, one for all three bosses), at the
cast bar's time for the tier. A boss's pose is not capped at 2.5 s as a hero's is, so Gathering Noon's strike comes at 8 s, not at 1.75.

**A move can act itself out** (`BossMove.body`): it names an action the look knows, played for each step and timed to that step's landing
(`actBeat`), and the body sends a part to where the zone is (`BodyParts.toward`, which works in the world because a model's own nodes may be
turned; `facing` for an arc across the front). A move's steps overlap (Pillar Fall calls its second stone before the first lands), so a body
keeps every live action (`BodyState.acts`) and each limb shows the step striking with it (`lead`), easing across to the next. The one on the rim
acts too (`BossWorld.actRim`).

| Boss | Acted out |
|---|---|
| The Warden | Stone Sweep: drawn round to his right, the fists swing across the cone as it lands. Pillar Fall: a fist up over him, then down at each stone, left then right. Fists of the Court: a fist flies to where you stood. Sun Order: fists at the shoulders, a punch with each wedge. Eclipse: fists down beside him for the near circle, flung wide for the far ring |
| Ash | Knuckle Quake: reared up, then both fists thrown down far ahead along the cracks (his Ground Slam brings them down beside him). Cinder Rock, from the rim: one arm back over his head, thrown up half a second before the rock lands, one arm then the other |
| Ember | Lantern Toss: the lanterns fly out either side of you. Vent Bombs: the lanterns lift, and one is flung toward you as each pair lands |
| The Heart | Blade Sweep: both blades drawn round to its right, swung across the arc as it lands. Blade Fall: one blade a step, up over you and down point-first on the line. The rings follow their beams (`HEART_LIVE` in `bodies/heart.ts`: the moves on each screen set it, the body reads it) |

The rest strike with their cast pose, now on time: Sun Ray thrusts as the ray fires, Gathering Noon comes down at 8 s, Ground Slam, Fan,
Lava Wave, Falling Star. `pipeline/tools/boss-anim.js` (`_strip`) lays frames of a move round its landing side by side, to check the strike
and the zone land in the same frame; sheets `docs/bosses/anim-*.jpg`. Not sheeted (the shared timing only): Drag Under, Marked, Lava
Wave, Tag, Anchors, Shared Burden. Ash's Charge has its own (`_fx.charge()` in the same tool): `docs/bosses/charge-1` to `charge-3`, and
`charge-phone`. Its wind-up is the `lunge` pose, his right fist raking the floor quicker as he is about to go.
**The glow** of each body is kept low on purpose (`GLOW_HALO`, the core's share): under the game's bloom a bright halo, core or flame hid the whole
body from above. `pipeline/tools/boss-poses.js` poses a boss through idle, walk, each cast, phases, kneel and fall on one sheet to judge that.

## Mechanics players do

All by walking, so a phone needs no new button. What each earns is in one table (`RAID_REWARDS` in `server/protocol.mjs`), paid once per cast
by the hub online and by `LocalLink` alone. Only the screen that runs the brain asks for it (`link.reward`).

| Boss, phase | Mechanic | What you do | The reward |
|---|---|---|---|
| Warden, Awake | Break the ray | Pillar Fall's stones stay 8 s as cover. Keep one between you and him when Sun Ray comes | It breaks on the stone: +40 on the gauge |
| Warden, High Noon on | Turn the light | Gathering Noon fills for 8 s while sun shards fall 9 m from the altar. Walk over one to carry it (15 % slower, it glows over your head), and walk it to the altar. One alone, one each for two | No Noon. He kneels and takes 5 % of his max HP |
| Warden, Last Light | Anchors | As before | |
| Warden, in the Hall of Noon (a party of three or more) | The Hour Strikes | He calls an hour: three of the hall's four arms and its crossing fill with sunfire, and the sun road lights gold in the one safe arm. Be in that arm when the bell strikes, 23 s after the call | No 60 % from the bell |
| Ash, in the ring | Hide behind a pillar | His Charge comes every 14 s he is in the ring and kills whoever it reaches. Get one of the four pillars between you and him | He crashes into it and it breaks; he kneels 5 s (a stun: the gauge keeps what it had) |
| Ember, any | Burn your own | Carry Marked onto whichever of them is in the ring. The brain says in the landing cast whether the boss stood under it | 4 % of max HP and +40 on the gauge |
| Together | Seal the vent | The vent opens at 6 s, then again 25 s later. Stand on it for 4 s, hits or not, casting stops it | The lava waits 20 s longer, and +40 on the gauge |
| Ash and Ember, a party | Twin Flames | Both fight at once, one each side of a wall of fire that splits the room and the party. Bring their health down together: both bars and the gap show on every screen | Nothing: more than 12 points apart and the one with more health grows furious until they are within 6 again (below) |
| Heart, every phase | Hold Still | Its heart beats in runs: white light runs in along the floor's rings and lands on them on each beat, and a white ring closes round your own hero. Stop walking before each beat (let go of the stick, or S); casting is fine. Between beats, run | Nothing: a beat burns only who is walking, 12 % |
| Heart, The Rings Turn on | Lock a ring | Each ring's beam has a gold spot on the rim. Hold it 2 s, hits or not, casting stops it | That ring's beam goes out for 8 s, then warns 0.8 s and burns again; +40 on the gauge, once per ring |
| Heart, Noon Falls | Shade the heart | Each Heartbeat throws three crust plates out as gold spots 6.8 m from it. Hold one 3 s and it stands up on the heart's side of its spot (cover, `addStone`), for both screens. Only cover between you and the heart saves you from the beat | No 40 % from the beat |

**Objectives** (`Objective` in `types.ts`): spots a hero takes, at once or by holding. A move's `play` returns them beside its threats. Each screen
watches its own hero and reports once (`link.objective`); the hub gives each to the first report and tells both screens who (`boss_obj`, then
`boss_done`). The edge arrows point to them and the autopilot goes for them (`BossScript.objectiveGoal`). A move that comes by the clock rather
than the brain's pick (the vent) is `BossPhase.timed`.

| Tier | What changes |
|---|---|
| Each one | Boss HP +15 % (`raidHp`). Shown times 10 % shorter and never under 1 s (`p.shown`, `raidTierFactor`). One extra move (`BossDef.extra`) |
| Sun Warden's extras | Sun Order, then Walking Sun, then Eclipse, each from the first phase on |
| Ash and Ember's extras | Ash throws rocks in the ring too, Ember marks from the rim as well, then her wave from there |
| The Heart's extras | The Crown of Rays, then The Rings Turn, then the Heartbeat, each from the first phase on |

**The score** is the most bosses beaten, then the fastest time. Alone it stays in this browser (`raid.best`). For two it goes on both
accounts (`recordRaid`) and does not count as a win or a loss: the profile's record stays about duels with people.

## Paths between bosses

`src/raid/paths.ts` (user, 2026-11-11, option D). From the second hall of a run on, once the pick is in, two side doors open with the
gate, at the hall's west and east edges: **the Vault** (three blue or gold cards, take one more; then one more omen to the end of the
tier) and **the Shrine** (lifts the tier's first omen; 15 s on the run's time, `RAID_SHRINE_S`). Or straight through the gate. A side
room is the hall again with its own altars, then the gate; one side room a hall. Alone it is all on the screen (`RaidRun.takeDoor`).
For two a door opens only when both walk into the same one: `raid_side` to the hub, `raid_side_go` back, then a pick and the gate as
usual (`raidSide` in `server/hub.mjs`); if they part, the gate's time takes both to the boss. Both screens keep the tier's omens in a
`TierOmens` and change them only on what the hub says, so they agree.

## Omens

`src/raid/omens.ts` (user, 2026-11-11: "evolve the raid"). Each tier rolls omens that hold for both of its fights: one at tier 1 (from
the kind ones), two from tier 2 on. The hall shows them under the words on top, the loading page names them. Both screens of a raid for
two roll them from the match's id and the tier, so the hub knows nothing of them: each acts on this screen's own hero, on its own
clock, or on the brain (which runs on one screen, with the same omens).

| Omen | Effect | Where it acts |
|---|---|---|
| Molten Ground (kind) | An orange circle that lands leaves lava for 4 s, at most 2.4 m wide: 4 % of max HP a second in it. The autopilot walks round it | `BossScript.pour`, `burn`, `danger` |
| Long Night (kind) | The screen is dark beyond a few metres of the hero (a page layer over the 3D, under the HUD) | `BossFight` (`raid-night`) |
| Brittle (kind) | Hits on you cost 20 % more; your control fills the gauge 50 % faster | `RunUpgrades.harmMul`, `staggerMul` |
| Heavy Air (kind) | Walk 10 % slower, cooldowns 10 % shorter | `RunUpgrades.speedMul`, `cooldownMul` |
| Quickened Court | The boss rests 25 % less between moves (and the rim acts sooner) | `BossBrain.quick` |
| Short Fuse | The enrage comes 25 % sooner | `BossFight.enrageAt` |

`_raid(names, reps, { omens: ['molten'] })` (`pipeline/tools/raid-tool.js`) measures one.

## Upgrades

`src/raid/upgrades.ts`. Three offered before each fight, only what this hero can use and hasn't got, from a seed; 30 s, and time
running out takes the first. They live on the hero's own screen, like its HP and cooldowns, so the hub only waits for the picks.

| Upgrade | Effect | Only for | Where it acts |
|---|---|---|---|
| Ricochet | Bolts bounce once off cover | Heroes with line bolts (26 of 39) | `Arena.heroBolt` |
| Quick Hands | Cooldowns 15 % shorter | | `castRules` |
| Ready Again | Ultimate 25 % sooner | | `castRules` |
| Long Stride | Walk 15 % faster | | `HeroMode.speedBonus` |
| Glass Edge | 25 % more damage, 15 % less max HP | | `resolve`, `startBoss` |
| Stone Skin | 20 % more max HP | | `startBoss` |
| Stubborn | Once a fight, a killing hit leaves 1 HP | | `damagePlayer` |
| Opportunist | 60 % more damage while the boss stands open or kneels | | `resolve` |
| Bone Breaker | Control fills the gauge 40 % faster | Heroes with `cc` spells | `BossFight.control` |
| Fresh Start | A shield of 10 % of max HP as each phase begins | | `phaseShield` |

The design called the third one Last Light, which is also the Warden's third phase, so it has its own name here.

**Rarer ones** (user, 2026-11-11). Each card may come up blue (rare) or gold (legendary), more often deeper in the run: gold 6 % at the
first hall, +4 % each hall, at most 30 %; blue 20 %, +5 %, at most 45 % (`offersFor`, its `depth` is the halls before this one). From
the second hall the third card is a dark pact one time in three. Time running out takes the first card, never a pact. The card's edge
and name, its altar's light and orb take the rarity's colour (`RARITY_COLOR`).

| Upgrade | Rarity | Effect | Where it acts |
|---|---|---|---|
| Sun Drinker | Blue | Heal 5 % of the damage you deal to the boss | `resolve` |
| Sure Feet | Blue | A sun shard no longer slows you; the boss's blows push you half as far | `heavy`, `hitMe` |
| Bulwark | Blue | A shield of 12 % of max HP when the boss kneels | `BossFight.onKneel`, `BossWorld.shieldMe` |
| Close Call | Gold | An orange zone landing within 1.2 m of you (not on you) takes 1.5 s off each cooldown, once a cast | `BossScript.land`, `BossWorld.nearMiss` |
| Kneel Fury | Gold | While the boss kneels or stands open, cooldowns run twice as fast | `HeroMode.cooldownRate` |
| Phoenix Heart | Gold | Once a fight, a killing hit leaves you at 40 % HP (before Stubborn's 1 HP) | `damagePlayer` |
| Sun Eater | Gold | Standing in a gold zone as it lands: a shield of 10 % of max HP | `BossScript.land`, `BossWorld.shieldMe` |
| Reckless Pact | Dark | 35 % more damage; the boss's hits cost 25 % more | `resolve`, `BossScript.harm` |
| Haste Pact | Dark | Cooldowns 30 % shorter; 25 % less max HP | `castRules`, `startBoss` |
| Blood Pact | Dark | Ultimate 40 % sooner; nothing heals you | `castRules`, `healPlayer` |

**When they run out.** Once fewer than three of those are left, about tier 4 to 6 depending on the hero, three small ones fill the cards. Each can be
taken again and again, so a long run always has three choices (`STACKING`):

| Upgrade | Effect, each time | Where it acts |
|---|---|---|
| Whetstone | 8 % more damage | `resolve` |
| Thick Hide | 10 % more max HP | `startBoss` |
| Steady Breath | Cooldowns 5 % shorter | `castRules` |

A boss's hit and its floor are a share of the hero's own max HP, before upgrades (`Duel.hitBase`). If they were a share of the max HP with
upgrades, Stone Skin would change the number on the bar and not how many hits it takes to fall, and Glass Edge would cost nothing.

**On a phone.** Held upright it sees about 14 m across a floor of 32, so a boss fight starts with the camera as far back as it goes (a pinch
still works), and the distance goes back when the fight ends. On any screen, an arrow at the edge of what the bars and buttons leave free points
to a gold zone or a fallen partner out of view (`BossHud.pointTo`, gold and green).

## The four rules

Everything else follows from these, and they are why two screens work without rewriting the duel.

1. **A move never reads a hero's position.** Only the brain does, and it puts the result in a `BossCast`, a plain JSON object.
2. **A move with later steps sends each step as its own cast**, so a step can't drift between screens.
3. **Each screen decides hits on its own hero only.** Walking out of a zone is a real dodge, as in a duel.
4. **Everything both screens must agree on goes through the `RaidLink`:** boss HP, phase, stagger, kneeling, who is down, how it ended.

For a party, rule 1 needs more than one hero's spot. `AimContext.heroes` gives a move's `aim` the heroes standing (it runs on the
brain's screen only), and `aim` may name a `target` of its own for the cast. The hub passes a cast on field by field, so what the
brain found rides in the fields there are (a hero in `target`, a count in `x`, yes or no in `flag`): see the Sun Warden's party
mechanics. And for rule 4, a `stand` zone with `Threat.tally` is only counted: the hub says how many stood in it, and its move says
what that means for everyone. `BossDef.choose` lets a boss name whom its brain goes for next.

## The pieces (`src/raid/`)

| File | Role |
|---|---|
| `types.ts` | `BossDef`, `BossMove`, `BossCast`, `Threat`, `RaidLink`, `BossWorld` |
| `fight.ts` | `BossFight`: ties the rest together. `Duel.startBoss` builds it, and `update` calls it where a duel calls its AI |
| `brain.ts` | `BossBrain`: who it aims at, which move comes next, where it walks. Runs on one screen. Its rolls are seeded |
| `script.ts` | `BossScript`: plays casts, draws their zones, lands them, decides the hits on this screen's hero. Several run at once, in both colours |
| `sunWarden.ts`, `ashEmber.ts`, `heart.ts` | The bosses: numbers, phases, moves. `ashEmber.ts` makes Ash's and Ember's moves for a room (`movesFor`): the pit for two, and a party's pit for Twin Flames (`twinFlames`) |
| `wardenHall.ts` | The Sun Warden's fight for a party beyond his own moves: the hall breaking open, the sunfire of his last phase, Branded, Carry the Sun, The Four Hours, the turns his great mechanics take, and whom he hunts |
| `twin.ts` | Twin Flames: the ghost world and link that let one screen play the other boss's script as a look, the furious numbers, and `TwinLocalLink`, the two HP pools on one screen for the check tool |
| `stage.ts` | `stageMove`: a boss's stage, its adds and their shots, from a few numbers. Both bosses have one |
| `fxShow.ts` | The big moments' effects: `ShowFx`, one per fight (`PlayContext.show`), plays pooled one-shot pieces on its own clock: a shockwave over the floor, a rising column, shards, a meteor, a lava arc, rays along the floor, a charge-up, a beam's flash, and `triumph` for a mechanic done right. `Shell` (a stage's barrier, lit at its rim) and `RageAura` (the red heat round an enraged boss) |
| `bodies/` | Each boss's look: the parts of its own model, posed by code. `adds.ts`: the adds' looks |
| `hall.ts` | `RaidHall`: Noonfall's hall between fights, and `fadeTo` |
| `link.ts` | `LocalLink`: one screen, no server. Decides on the spot what the hub decides online |
| `net.ts` | `NetLink`: the same calls through the hub |
| `coop.ts` | `RaidController`: a raid for two, next to `MatchController` |
| `partner.ts` | `Partner`, the other player's hero on this screen, and `Track`, a figure walked from reports |
| `hud.ts`, `fx.ts` | The boss's bar, cast bar and gauge; first-pass looks in code |
| `run.ts` | `RaidRun`: a raid alone, shaped like `CpuMatch` |

Small hooks elsewhere: `Arena.pinned`, `statusGate`, `foeFloor`, `onFoeDamage` and `untargetable`; `StatusSet.hold`; `HeroFigure.setScale`;
`ArenaDef.ring`; for adds, `SummonOptions.still`, `Summon.onHurt` and `SummonSystem.slay` and `dismiss`. Numbers the hub must know live in `server/protocol.mjs` (`RAID_BOSSES`), and the boss's definition reads them from there.

## The boss's rules

| Rule | How |
|---|---|
| Colours | Pale orange means leave, gold means stand here (`LEAVE_COLOR`, `STAND_COLOR`). Gold zones also get a rising light, because the two colours are close. White means stand still, wherever you are (`STILL_COLOR`: the Heart's Hold Still, drawn by its move as fine lines, never a filled zone) |
| Only who walks | A zone can burn only a hero that is walking as it lands (`Threat.moving`): one that went more than 0.25 m in the 0.25 s before (`STILL_SLACK`, `STILL_WINDOW`) by its own walk or a dash. The duel keeps that (`BossWorld.walked`, `Duel.logWalk`) and takes off what a blow, a pull, a carry or a stone raised under the hero moved it (`Duel.shove`). Such a zone is no danger to an AI's walk, pours no lava, counts no near miss and leaves units alone; an AI stops walking 0.36 s before it (`BossScript.stillIn`) and starts no dash within 0.9 s |
| Not moved | `Arena.pinned`: knockback, pull, carry and displacement leave it alone. Its own walk still moves it |
| Control | `Arena.statusGate` asks `BossFight.control` first. Stun, knock-up, root, charm, sealed, silence and blind add to the gauge instead of landing (per second of it). Slow lands at half length |
| Kneeling | A full gauge: `StatusSet.hold`, so rules that look for a stunned target see it, and +50 % damage taken for 6 s. Steps not yet sent are dropped; what already shows still lands |
| Exposed | After a Noon nobody turned, +50 % damage taken for 5 s (`vulnerable`) |
| Damage | A share of the hero's max HP, through `resolve` and `damagePlayer` as a normal hit, so parries, shields and ice blocks work. `weaken` on the boss lowers it |
| Wide | A zone that touches any of its body counts as a hit on it (`inCastReach` with a pad) |
| Enrage | A timer next to its name (`BossDef.enrage`: the Warden 2:30, Ash and Ember 2:50, the Heart 2:45; at a higher tier later by as much as its HP grows). Then every hit costs twice as much and the quiet between moves is half (`BossFight.enrage`): past it a fight is meant to be nearly lost |
| Too long | Past 5 minutes sunfire closes in, at 6 Last stand (`BossDef.late`), so nobody can stall a fight for ever |
| A stage | At 50 %: it can't be hurt or held (hits show IMMUNE, `Arena.untargetable` makes spells aim past it) from the phase's start until the stage is won or fails. Win: it kneels, and acts again after (`BossMove.stage`). Fail: a blow over the whole floor. A big hit past two phases still gets the stage first. Its cast bar is its clock: no other move takes the bar meanwhile. The guard is in `hitFilter`: in a boss fight every hit on the boss goes through `Arena.hit`, and nothing else takes its HP |
| A move that holds the floor | `BossMove.holds` (The Hour Strikes): from its cast until it lands he does only the moves it names, an opener waits, and its cast bar stays up. A stage calls it off. `BossMove.least`: its cast bar never fills faster than that, whatever the tier (`moveTime`) |
| Units | Whatever stands in an orange zone takes 60. Units don't dodge |
| Big moments | Each mechanic has its effect, started from its cast, its landing or its objective, never from a hero, so both screens draw it (`fxShow.ts`). A stage: the boss goes up in a column with a shockwave, each add rises out of a column; a stone's eye charges before its beam, a heart throws a burning lump on an arc; an add bursts when it dies; the shell shatters when it is won; failed, the Warden's flare rays out along the floor, or the vent's geyser throws lava over the pit. Falling Star is a meteor with a streak. The light turned, the ray broken, burn your own and the vent sealed each get a column and a shockwave. Enraged: a red blast, red heat round the boss, its body lit red (`BodyParts.rage`), a slow red throb on the screen. The camera shakes a little (`PlayContext.shake`, at most 0.2), only in play. Flashes are white or warm white, never gold on the floor, and short |
| Hiding a hero | A boss between the camera and a hero, yours or your partner's, fades to 10 % so the hero shows through, the one on the rim too (`Duel.bossFade`, `Hero.setFade`). The camera stays where it is, because the controls follow it |

## The Sun Warden

Numbers as they are; tune by playing. Alone 4,300 HP, for two 8,700. Walks at 2 m/s, stops 4.5 m from its target.

| Phase | From | Move | Shown | Costs | What you do |
|---|---|---|---|---|---|
| Awake | 100 % | Stone Sweep | 1.6 s | 20 % | Leave the 120° cone, or get behind him |
| | | Pillar Fall | 1.5 s, 0.7 s apart | 15 % each | Keep walking: three stones, each where you stood. They stay 8 s as cover |
| All | | Fists of the Court | 1.4 s, 1 s apart | 16 % each | One fist, then the other, flies out and lands where you stood. Keep walking |
| | | Sun Ray | 2.5 s | 22 % | Step aside or get behind cover. Cracks the wall it hits |
| High Noon | 70 % | Gathering Noon | 8 s, shadows for the last 4 | 40 % | Turn the light (above), or hide: gold shadows behind cover are safe. A wall that saved someone falls, a column stays. He stands open after |
| | | Sun Order | 2.5 s, then 0.8 s apart | 16 % | Four wedges fire 1-2-3-4: step into 1 once it has fired |
| | | Shared Burden (for two) | 3 s | 40 %, split | Come together in the gold circle |
| The Long Hour | 50 % | The Long Hour (the stage) | 30 s | 8 % a beam, 55 % if it fails | He floats behind the Sun Well and can't be hurt. Break three Hour Stones; their beams cross where you stand, so step aside. If any stand when his bar fills, hide behind cover from him |
| Last Light | 35 % | Eclipse | 1.6 s each | 15 % | Near him, far from him, near again |
| | | Anchors | 3 s | 25 % | Stand in the gold circle. Alone: one, then the other. For two: both at once, or the whole court pays |
| | | Walking Sun | Runs 10 s alongside other moves | 12 % a pass | Keep ahead of the ray, or behind cover |

**From the design:** Shared Burden's circle stays where the target stood instead of following it, so nobody needs the other
hero's exact position to draw it. If nobody stands in it, everyone pays in full.

### In the Hall of Noon (a party)

A raid of three or more (a band over 2) fights him in the Hall of Noon (`src/arenas/sunhall.ts`, below under The lairs), and
`SUN_WARDEN.resize(band)` switches the room before the fight is built. His numbers and moves are the court's, with these differences,
all behind `party` in `src/raid/sunWarden.ts`, so the fight for two reads none of them:

| What | In the hall |
|---|---|
| The Hour Strikes | Only here, in every phase (`hallPhases`). Below |
| The hall itself | Breaks open as The Long Hour begins; sunfire spreads from the Sun Well in Last Light. Below: "The hall transforms" |
| Branded, Carry the Sun, The Four Hours | Only in a fight tuned for 10, 20 and 40 (`BossMove.minBand`). Below |
| Enrage | 3:15 instead of 2:30: the party walks 40 m up the nave to him first, and each hour takes the fight away from him for a while |
| What he aims (Pillar Fall, Fists, the ray) | Kept 1.8 m inside the hall's walls (`intoHall`), so no stone lands in the stone. At a hero in the gate's passage: down its middle |
| Sun Order | Its wedges reach 19 m from the Sun Well (the crossing and its corners), not the whole floor: deep in an arm no edge of a wedge is near enough to step over |
| Eclipse | Its far ring ends 20 m from him instead of at the rim |
| Gathering Noon, the Long Hour's blow, Walking Sun, the late sunfire | The whole hall, as in the court. The stone round the hall hides what is drawn past its walls |
| The hall's own walls | Cover like any other: round a corner Noon, the ray and the dial's blow do not reach. They never fall (`Obstacle.fixed`): a wall that saved a hero is only reported when it is a screen |
| Sun shards | Whoever picks one up brings it in (one way in for each of the 40 seats). Gathering Noon still has two shards, for a party under 16; for 16 and more Carry the Sun stands in its place, with a shard for every five |
| Starts | Rows of eight just inside the south gate (`starts`, `partyStart` in `src/duel.ts`). Seat 39 of 40 stands on a fallen halo piece and is pushed off it |
| Gates | The way in stands in the gate's passage; the way out before the throne, 4 m from the choir's end (`BossDef.gates.exitR`) |

**The Hour Strikes** (user, 2026-11-11, picked from `pipeline/designs/raid-mechanics.html`, card W1: "He calls an hour. Three of the
hall's four arms fill with sunfire; the sun road on the floor lights up in the one safe arm. The whole party runs there before the
bell."). Pictures: `docs/raid/hour-called.jpg`, `hour-called-far.jpg`, `hour-late.jpg`, `hour-bell.jpg`, `hour-bell-far.jpg`,
`hour-phone.jpg`, `hour-phone-bell.jpg` (`pipeline/tools/hour-shots.js`).

| | |
|---|---|
| Which arm | From the cast's seed: `seed % 4`, its place in `HALL_ARMS` (the nave, the east transept, the choir, the west transept). The brain's `aim` only turns him to it |
| What shows | The three other arms and the crossing as pale orange zones that fill from the crossing outward, embers and tongues of flame that grow as the bell nears; in the safe arm the sun road lit gold with chevrons running outward, and a gold line across the arm's mouth: past it is safe. The bell tolls four times on the way (a ring from the Sun Well) |
| The bell | 23 s after the call at tier 1 (`HOUR.seconds`). Shorter each tier and never under 19 s (`HOUR.least`, `BossMove.least`, `moveTime`): the longest way in the hall, the gate's passage to the choir (58 m), took the autopilot 17.7 s at 3.5 m/s, which is also a slow hero under Heavy Air (`pipeline/tools/hour-walk.js`: all 24 ways, 7 to 18 s) |
| What it costs | 60 % of max HP to whoever is not in the safe arm (`HOUR.share`). More than anything else he has (Noon 40 %, the dial 55 %), because it is the one blow the whole party can walk out of; not a kill from full HP at tier 1, even with Brittle and a Reckless Pact (90 %). Enraged it doubles |
| Who decides | Each screen for its own hero: `inArm(arm, x, z)`, past the crossing's edge on the arm's side. One `Threat.hits`, so the gate's passage and the stone count as "not in the safe arm" too |
| What he does meanwhile | He stands still 3 s for the call, then walks and fights on, with Stone Sweep, Pillar Fall, Fists and Sun Ray only (`BossMove.holds`). Nothing that covers the floor or asks for a spot comes until the bell: Noon, Sun Order, Shared Burden, Eclipse, Anchors and Walking Sun wait, and so does a phase's opener. A Walking Sun already turning runs out |
| A stage | Does not wait: when the Long Hour's phase begins the hour is called off on every screen (`BossScript.yieldFloor`, from the phase and again from the stage's cast) |
| When | By his own clock (`BossMove.due`): first 20 s into the fight, then 55 s after each call, so about three in a fight. It is picked like any move, so never while he is locked in Noon or his stage |
| His cast bar | Stays "The Hour Strikes" until the bell, as a stage's does; the small moves between show their zones and no bar |
| His body | The call: he rises, the fists go up and are thrown down the arm he calls, the halo swells (`strikes`). A toll: the halo and the sun swell (`toll`, on top of whatever he does). The bell: the fists struck together over his head (`bell`). The last two are started by the move's look through `PlayContext.act`, because a body keeps only its eight newest actions |
| The big moment | At the bell: light over the whole screen, a column over the Sun Well, three rings out to the hall's far walls, and the three arms and the crossing go up in columns of sunfire, the nearest first; the camera shakes |
| The arrow and the autopilot | Each screen has one objective of its own in the safe arm that nobody ever takes (`hold: Infinity`), open while its hero is not 2 m into that arm: it is the gold arrow at the screen's edge, and where an AI walks (`BossScript.objectiveGoal`), with no change to `src/duel.ts`. In the last 3 s the zone is also a danger an AI steps out of (`Threat.look`) |

In forty fights of ten heroes alone on the autopilot in the hall, about three hours were called a fight, and the bell hit five times
in all.

### The hall transforms, and what comes only for a big party (2026-11-12)

User, 2026-11-12: "when there will be second stage the arena will transform, and also at the final stage", and "mechanics that only
is cast when there is at least 10 players, and for 20 and 40". All of it is in `src/raid/wardenHall.ts`; none of it is named by a
phase of the court for two. Pictures (`pipeline/tools/warden-shots.js`): `docs/raid/warden-cracking.jpg`, `warden-falling.jpg`,
`warden-open-far.jpg`, `warden-open.jpg`, `warden-hour-open-far.jpg`, `warden-sunfire-far.jpg`, `warden-sunfire.jpg`, `warden-branded.jpg`,
`warden-branded-burst.jpg`, `warden-carry-far.jpg`, `warden-carry.jpg`, `warden-four-far.jpg`, `warden-four.jpg`,
`warden-phone-open.jpg`, `warden-phone-sunfire.jpg`.

| | When | For |
|---|---|---|
| The hall breaks open (`breach`) | As The Long Hour begins (50 % HP), beside his stage | Any party |
| The sun comes down (`sunfall`) | As Last Light begins (35 % HP) | Any party |
| Branded (`brand`) | From High Noon on, about every 28 s, by its own clock | A fight tuned for 10 or more |
| Carry the Sun (`carry`) | It opens High Noon where Gathering Noon did, and then takes turns with the hour | 20 or more |
| The Four Hours (`four`) | From High Noon on, in the turns below | 40 |

**What the hub lets through decides how they are built.** The hub passes a cast on field by field (`boss_cast` in `server/hub.mjs`:
id, move, step, x, z, fx, fz, dir, seed, target, alone, rim, form, flag, which), so a new field on `BossCast` would not arrive. What
the brain reads of the heroes therefore rides in the fields there are: **who** in `target` (one cast for each hero: `BossMove.aim` may
return a `target` of its own), **how many** in `x` of a move with no body, **yes or no** in `flag`. `AimContext.heroes` gives `aim` the
heroes standing: `aim` runs on the brain's screen only, so rule 1 holds. What the whole party must agree on comes back from the hub:
who took a shard or broke a stone (`done`), and how many stood in a zone (`stood`). A zone that is only counted has `Threat.tally`:
the move says what the count means, and what it returns the whole party pays.

**The hall breaks open.** The four corner blocks of the stone crack for 6 s (`BREACH.warn`; 3 s when it has to come with the sunfire):
a pale orange band 4 m wide runs along each wall that goes, the blocks tremble, chips and dust come off them, and the camera jolts
three times. Then they fall in clouds of dust, the low south ones first and each from the hall's corner outward (32 pieces, `falls` in
`src/arenas/real/sunhall.json`, cut in `blender/arenas/real/sunhall.py`). What changes in the game at that moment, on every screen
from the same cast:

| | |
|---|---|
| The walls between the arms | The eight stretches listed as `opens` leave the game (`PlayContext.breakCover`): walk, sight, bolts and his ray go through |
| The floor | The cross and the round court between its arms, 36.4 m from the Sun Well to its wall (`HALL_COURT`: a circle through the transepts' far corners). The ends of the nave (to 44 m) and of the choir (to 40 m) stay beyond it. `inHall`, `intoHall` and so his aim answer for the new shape |
| An arm | Its quarter of the court: the quarter turn round the arm's line, from 13 m off the Sun Well outward (`inArm`). The Hour Strikes burns three quarters and the crossing, drawn as three wedges and a quarter disc; the gold line across the safe arm's mouth is a bow 13 m from the well |
| Rubble | 24 pieces, six in each corner: low slabs and blocks in the south (1.1 m, under the 1.3 m of stone that hid them), tall ones in the north (2.6 m). Cover like any other; the twelve slabs are walls and can be broken |
| The court's own wall | 24 stretches of fixed wall on its circle |
| Who is hit | Whoever stands within 4 m of a wall that goes, as it goes: 30 % of max HP (`BREACH.share`). Nobody is pushed |
| The walk planner | Charts the floor anew by itself: its chart is keyed by the room's fixed walls (`Navigator.chart`) |

**How the rubble and the court's wall are "added".** They are not: they are in the room's obstacle list from the start, standing
inside the stone, where no walk, look or ray reaches them until the walls in front of them go. So nothing has to be added at the
same moment on every screen, a stone raised by `addStone` (which is timed, round, and breaks under his ray for a reward) is not
misused for it, and nobody can stand where rubble lands, so nobody has to be pushed out of it. It is why the hall's file has 138
obstacles, not 86.

**The cast.** `breach` comes by the phase's clock (`BossPhase.timed`, at once), not as the phase's opener: that is the stage, whose
cast is cut short when its stones are broken early, and the fall must not be. One hit can take him through two phases at once; then
The Long Hour's clock never runs, and `sunfall` breaks the hall itself. The room's state (`hallBreak` in `src/arenas/sunhall.ts`,
`hallFight`) is set only from a cast and reset by `resize` before each fight.

**The sun comes down.** Sunfire wells up at the Sun Well for 5 s, then burns and spreads: 6 m from the well at first, 0.12 m a
second, 24 m at last, after two and a half minutes (`SUNFIRE`, `fireRadius`). It costs 6 % of max HP a second (twice that once he
has enraged). That leaves a ring 12 m wide inside the court's wall, and the ends of the nave and the choir. Its edge is drawn in the
zones' "leave" colour. One `Threat.hits` that stays to the fight's end, so each screen works out its own hero from the cast's time.

| What | In the sunfire |
|---|---|
| He | Leaves the middle: 3 m/s instead of 2, and he comes within 2.2 m of his target instead of 4.5, so a hero who fights hand to hand need not stand in the fire for it (`SUN_WARDEN.speed`, `keepAt`) |
| Whom he goes for | One quarter of the court at a time, 14 s each, then the next with someone in it (`BossDef.choose`, `wardenChoice`). Alone and for two the brain's own rule, as it was |
| The Hour Strikes | Three of the four quarters and the crossing, as before; the lit road's goal lies past the fire. Branded may come during it |
| Gathering Noon | Its shards fall 7 m past the fire, and are home 3.5 m outside its edge |
| Carry the Sun, The Four Hours | A shard is home 1.6 m outside the fire's edge, and that edge moves; the arms' tasks lie past it |
| Anchors | Its circles lie either side of him, 7.6 m off, where the group he is with can reach them; never nearer the fire than 4 m |
| What closes in past 5 minutes (`late`) | In the hall it comes from the walls inward to 26 m ("The hall burns"), so the two leave nothing to stand on. The court for two keeps "The sun comes down", from 7 m outward |

**His great mechanics take turns.** The Hour Strikes, Carry the Sun and The Four Hours each hold the floor for about half a minute
(`BossMove.holds`) and come as soon as they are ready. Left alone they followed one another without a gap (measured: Carry the Sun,
the hour, Carry the Sun, the hour, back to back). Now only the one whose turn it is stands in his list, and none for 16 s after one
ends (`REST`, `nextGreat`, on the brain's screen): the hour for any party; the hour and Carry the Sun in turn for 20 or more; the
hour, Carry the Sun, the hour, The Four Hours for 40. In his last phase Branded may come during any of them: two mechanics at once.

**Branded** (10 or more).

| | |
|---|---|
| Who | One standing hero in eight, five at most, drawn by the cast's seed from those the brain sees standing (`BRAND.per`, `most`). Ten standing: one; twenty: three; forty: five |
| What shows | A sun over each branded hero's head that grows, and an orange ring 5 m round it that follows it. Only a look (`heroAt`): to an AI the ring of another is a zone to walk out of that never lands |
| The burst | 5 s later, where the brain sees each of them stand then: a cast of its own for each (the move's last five steps), landing 0.4 s after it comes |
| What it costs | Whoever else stands in it 30 %, the branded hero 8 % |
| The whole party | The hub counts who stood in each burst. Two or more beside the branded hero: everyone pays 6 % for each of them, 24 % at most ("the brand burns the crowd") |
| A kneel or a new phase | Drops the bursts still to come, as it drops any move's later steps: the brands go out |

**Carry the Sun** (20 or more). The party's Gathering Noon, in its place.

| | |
|---|---|
| Shards | One for every five standing, eight at most (`CARRY.per`, `most`), counted by the brain. In the hall whole: in turn at three quarters of each arm's length (33 m down the nave, 30 m up the choir, 25.5 m out each transept), from the fifth on two an arm. In the round court: evenly round it, 30 m from the well. Each on open floor (`freeSpot`, from the hall as it was built, so every screen finds the same spot) |
| Carrying | Whoever walks over one carries it, 15 % slower, and brings it to the Sun Well; one shard a hero. The hub says who took which |
| His ray | Comes for a carrier (`wardenChoice`), and throws back 5 m whoever it hits. It breaks on cover and on a fallen stone as always, and on a hero: the brain finds the first hero standing in its way and flags the cast with that hero's spot; the ray ends there, and that hero takes it for the carrier |
| Meanwhile | He stands 3 s for the call, then does only Sun Ray and Pillar Fall (whose stones break the ray) |
| Noon | 36 s after the call (never under 32 s at a higher tier). Everyone pays 12 % and 56 % shared out over the shards not home: none home 68 %, one of four missing 26 %. No cover saves from it. All home: no Noon, 5 % of his HP, and he kneels (`RAID_REWARDS.sun.carry`) |

**The Four Hours** (40). Each arm gets a task at the same time; the seed turns the tasks round the arms. A word stands over each arm
(CARRY, HOLD, BREAK, STAND), and his cast bar names the arms still open ("The Four Hours · NAVE EAST CHOIR WEST").

| Arm | What it asks, of forty standing | Done when |
|---|---|---|
| Carry | Two shards near its far end, to the Sun Well | Both are home |
| Hold | Three gold circles | Each has a hero in it as the tasks end |
| Break | Three of his hour stones (1,392 HP each at band 40) | All three are broken |
| Stand | Three lanes down the arm: two burn (25 %), one is gold | Five heroes stand in the gold lane as the tasks end |

The tasks end 34 s after the call, 4 s before the hall burns, so the hub's counts are back by then. Each arm done pays a quarter of
his stagger gauge (`RAID_REWARDS.sun.foura` to `fourd`): all four, and he kneels. Each arm not done burns the whole hall for 18 % of
max HP: all four, 72 %. With fewer standing each arm asks less (twenty: one shard, two circles, three in the lane, stones of half
the HP).

**Measured** (2026-11-12). One autopilot hero, the boss's HP for one, the same ten heroes as before (Lyra, Kaia, Sefu, Isolde,
Vesper, Brannoc, Nyx, Bram, Zephyr, Sirix), two fights each at every size (`_raid(names, 2, { band })`). No errors, and no fight that never ended.
Twenty fights swing by more than the rows differ, so read them as: nothing is broken, and one hero alone is not what these are for.

| Tuned for | Clears | Seconds a fight | Damage a second | Fights that enraged | Hits by the new things, in 20 fights | What killed most |
|---|---|---|---|---|---|---|
| 5 | 6 of 20 | 131 to 210 | 13 to 24 | 6 | the sunfire 3 | Fists 6, Noon 2, the sunfire 2, Anchors 1 |
| 10 | 4 of 20 | 134 to 199 | 12 to 24 | 6 | the falling walls 1, the sunfire 10, Branded 29 | Fists 5, Stone Sweep 4, the dial 2, Sun Order 1 |
| 20 | 2 of 20 | 96 to 237 | 14 to 23 | 6 | Branded 38, Carry the Sun's Noon 1 | Branded 8, Fists 5, Pillar Fall 2, Carry the Sun's Noon 1 |
| 40 | 0 of 20 | 146 to 227 | 13 to 21 | 11 | the sunfire 9, Branded 34, The Four Hours 5 | The Four Hours 4, Fists 3, Stone Sweep 3, Anchors 2 |

One hero stands for the whole party here. So it is always the branded one: the light hit about every 28 s, which nothing avoids
(29 to 38 of them in twenty fights; at 20 it was the last blow eight times). It carries the one shard itself: Noon landed on it
once in twenty fights. It cannot do four arms at once: The Four Hours hit it five times in twenty fights, and four of those were
the last blow. The falling walls caught it once in the 80 fights, and the sunfire burnt it 22 times in them.

**A real party through the real hub** (`python pipeline/tools/party-raid.py <out> --players 6 --seconds 240 --boost 30 --hall`: six
headless pages, six throwaway accounts, a fight tuned for ten, every bot also taking 30 HP a second off him so the fight ends).
Run twice. The second: the hall broke open on all six screens within 0.36 s of each other (the cast goes through the hub, and each
screen counts its 6 s from when it came); the sunfire had come 12.1 m on every screen when he fell; every screen had the same cover
at the end (130 pieces) and the same boss HP all the way, within one message; the screens' cover differed on 3 of 165 seconds, by one fallen stone that
one screen had a moment longer; nobody fell, no errors, won after 2:38 of fight (the hall broke at 1:10, the sunfire began at
1:41). The first run: won after 3:02 with three of six standing and no errors; its bots were burnt by the sunfire 7 to 13 times
each, the second run's 0 to 7. Pictures with the game's own HUD:
`docs/raid/warden-online-breaking.jpg`, `warden-online-open.jpg`, `warden-online-sunfire.jpg`.

**Sixteen bots, a fight tuned for twenty,** once (`--players 16 --boost 60 --hall`; this computer runs sixteen pages, slowly). Carry
the Sun was cast (it is in the lists of the two screens that were read; the other fourteen's were cut off the output) and the
host's bot carried a shard, so the hub had said who took it (`hall-carry.png` of that run). The hall broke, the sunfire came,
nobody fell, no errors on any of the sixteen. Its end was not seen: the boost had him at 51 % HP nine seconds into it, and his stage
begins at 50 % and calls it off. The screens' hall broke within 5 s of each other in that run, against 0.36 s with six pages: most
likely sixteen pages on one computer running slowly, but that was not looked into.

**What the room costs to draw** (one frame at 390 x 844 with eleven partners, counted by the renderer): 684 draw calls and 458,000
triangles with the hall whole, 615 and 450,000 once it is open, 665 with the sunfire. The 32 falling pieces are about 70 of the
calls while they stand; the rubble is not drawn until they fall. Not measured on a real phone, and not against the hall as it was:
its file had 70 objects in 236 drawn parts, and has 126 in 438 now.

## Ash and Ember

`src/raid/ashEmber.ts`. Two bosses, one HP bar, one in the ring at a time. The other stands on the rim, out of reach, and adds a move
now and then. Alone 3,300 HP, for two 7,100. The one in the ring aims at the nearer hero, the one on the rim at the farther.

| Phase | From | Who | Notes |
|---|---|---|---|
| Ash and Ember | 100 % | Ash in the ring, Ember on the rim | A move from the rim every 10-14 s |
| Ember steps in | 66 % | They swap | Every 9-13 s |
| Eruption | 50 % | The stage: Ember sinks into the vent | Every 8-11 s, through the stage. Put out three Coal Hearts in 30 s; their lobs land on you and round you, 8 % each. If any burn when the bar fills, 45 % to everyone |
| Together | 33 % | They swap every 12 s | Every 9 s. The lava rises from the rim, three steps, then Last stand. The vent opens twice |

| Who | Move | Shown | Costs | What you do |
|---|---|---|---|---|
| Ash | Ground Slam | 1.5 s | 18 % | Back away from the 5 m circle |
| | Charge | 4.5 s, first at 6 s, then every 14 s in the ring | Kills | He fixes on one of you and runs through where you are then. Only a pillar stops him: get one between you and him. He breaks it and kneels 5 s |
| | Drag Under | 2 s | 16 % | It pulls you in, and a ring burns far from him. Stay close, then walk away before the next thing |
| | Knuckle Quake | 1.8 s | 15 % | Two cracks from his fists cross where you stand. Step aside, or in close between them |
| | Burning Trail | None | 4 % a second | Puddles where he walked, for 15 s. Plan your route |
| | Cinder Rock (from the rim) | 1.7 s | 12 % | Two rocks, each where you stood |
| Ember | Fan | 1.5 s | 14 % | Five lines. Stand in a gap, or behind cover |
| | Marked | Follows you 2.5 s, then 1 s | 18 %, and a puddle | Carry it onto the one in the ring, and walk out when it stops |
| | Vent Bombs | 1.5 s | 12 % | Pairs either side of you. Stay between them |
| | Lava Wave | 2.5 s | 16 % | A ring grows from the vent. Walk through the gold gap, which turns |
| | Lantern Toss | 1.8 s | 14 % | Her lanterns hang either side of you and burst. Stand still between them |
| | Falling Star | 3.2 s | Under it: 10 % alone, 30 % split for two. Nobody: 30 % alone, 45 % for two | A soak: stand under it, together if you can |
| Both | Tag | 1.5 s | 12 % | Leave the circle where the next one lands |

**Ember backs away.** She wants 9 m. With a hero under 6 m she steps back between her moves, at 2.4 m/s against a hero's 4 or more, so she can always be caught,
above all during a cast, when she stands still (`BossForm.backAt`). She goes round cover, keeps off the floor's edge and off the rising lava, and stands when cornered.

**How it stays within the rules.** A tag is a cast, so both screens swap at one moment. Marked's circle follows its target as a look only:
what counts is its second step, at the spot the brain read. Only the brain's screen moves Ash down his Charge (`BossMove.act`), and it says in
the cast whether he hit a pillar, so each screen doesn't judge that for itself. The one on the rim is a `HeroFigure` the duel only draws.

**The four pillars and the Charge** (user, 2026-11-08: "6 pillars noticeable from others, a charge attack that targets the player, the player
goes behind the pillar, the boss gets stunned and there is a window to damage him, if he hits you it's a one-shot, so kill him before all the
pillars are down"; 2026-11-09, after six outlasted most fights: "fewer pillars (4)").

- **The pillars** (`PILLARS` in `src/arenas/cinderpit.ts`, drawn by `src/arenas/cinderPillars.ts`) are the pit's only cover: four at 7.5 m
  from the vent, on the diagonals. Six-sided basalt with veins and a crown of pale blue-white sun-glass, the one cool colour
  in the pit, with a glass ring on the floor round each. A pillar the Charge hits leaves the cover list (`PlayContext.breakCover`, through
  `Duel.removeCover`), topples away from Ash (`ArenaScene.coverFall`) and breaks into a stump and chunks. A new fight stands all four up again
  (`resetShift`). The bar shows a pip for each one standing (`BossDef.pillars`, `BossHud.setPillars`), red when one is left.
- **The wind-up** (4.5 s at tier 1, the cast bar: time to reach the far side of a pillar from anywhere; with four 90 degrees apart that can be 15 m from the rim): he turns to follow the one he fixed on (`BossMove.tracks`) and rakes the floor. A lane of
  chevrons runs from him through that hero to the rim, cut at the first pillar in its way, and that pillar lights up blue: you are safe. The
  floor the pillars hide from him shows in gold (`ShadowFloor`), as Noon's shadows do.
- **The run**: the second step is aimed by the brain at where the hero is then, so stepping aside doesn't save you; only a pillar does. He
  crashes into a pillar if his line passes within its radius and 0.5 m more, and stops 1 m short. The zone grows with him
  (`Threat.shapeAt`), so it reaches you when he does, and it is `lethal`: `hitMe` takes HP and every shield, past any toughness. Only Sealed
  and the run's Stubborn save you. In front of a pillar is no cover: he runs through you and into it.
- **The crash**: the brain's screen asks for the `charge` reward, a **stun** (`RAID_REWARDS`, `stun: 5`): the hub's kneel event for 5 s, which
  leaves the stagger gauge as it is (`raidStun` in `server/hub.mjs`). He kneels and takes 50 % more.
- **The clock**: the Charge comes before any other move as soon as it is ready (`BossMove.due`): first 6 s into the fight, then every 14 s,
  but only while Ash is in the ring (the first phase, and his turns in Together). A slow fight runs out of pillars, and after that every
  Charge kills the one it fixes on.
- **The autopilot**: the first step carries a warning (`Threat.warn`) whose zone is everywhere no standing pillar hides from Ash. It never
  hits. An AI never ignores it (`BossScript.mustHide`), looks up to 14.4 m for a hidden spot, even one only reached round cover, and stays
  there casting nothing until the run has passed (`BossScript.hidden`).

**From the design:** Drag Under's second half, "walk out in time", has no zone of its own: it's whatever move comes next. Vent Bombs fall round
the target and not from the vent. Ash's Charge only comes from the ring, so he has Cinder Rock for the rim.

### Twin Flames: a party fights both at once

User, 2026-11-11 (card A1 of `pipeline/designs/raid-mechanics.html`): "For a party they both fight at once, one on each side of a wall
of fire that splits the room and the party. Their health must fall together: if one is far ahead, the other grows furious." Built
2026-11-12; pictures `docs/bosses/twin-*.jpg`. It is for a party (band over 2: `raidTwin` in `server/protocol.mjs`). For one or two
they stay the tag team above, and nothing new goes over the wire.

| What | How |
|---|---|
| The room | `src/arenas/twinpit.ts`, drawn in code like the pit for two; every layout number is in `TWIN_LAYOUT`. 30 m to the rim (`RAID_BOSSES.ash.partyRing`), split from the south gate to the far side by a wall of fire 1.8 m thick: an obstacle that never breaks (`Obstacle.fixed`), so it stops walking, sight and bolts. West: Ash, with four pillars round him and one more for every three heroes of his half (5 at band 5, 6 at 10, 8 at 20, 11 at 40). East: Ember over her great vent, six small vents round it, no cover |
| Sides | The wall stands from the start. The hub deals the players present west, east, west... in the order of their seats as the fight loads (`dealHalves`), so neither half can be empty; the host is in the west. Each half comes in at the south gate on its own side, in rows of four. Nobody chooses a side yet |
| One enemy a screen | The boss in this hero's half is `Duel.foe`. The other is a body the duel only draws (`rimFigure`, `Duel.twin`), walked from its brain's `boss_move`, with its own bar |
| Two of everything | Each has its own def (`twinFlames(which)`: 0 Ash, 1 Ember), half the band's HP, its phases at 66, 50 and 33 % of its own HP, half the band's gauge, its own kneel, brain and watchdog. A brain runs on a screen of its own half. A half everyone has left has no brain until the wall is out |
| Two scripts a screen | `src/raid/twin.ts`. Each boss's casts play in its own `BossScript`. The other boss's script is a **ghost**: it draws everything, cut off at the wall (`TelegraphLayer.clip`), but this hero stands in none of it, takes no spot of it, reports nothing, and none of its side effects (a stage's guard, a drag, a hint, a flash) reach this screen's own fight. So the engine's rule holds: one hero, one enemy, and bodies it only draws |
| Health falls together | The hub: when their HP shares are more than 12 points apart the one with **more** health is furious (`boss_rage`), until they are within 6 (`RAID_TWIN`). Furious: its hits cost 1.5 times as much and the quiet between its moves is 0.6 of what it was (`FURY_HIT`, `FURY_GAP`); red heat round it, a red bar, a banner on every screen. The clock's enrage (2:50: 2 times, 0.5) is the stronger, and the two never multiply |
| The bars | Two bars in place of the one, Ash's on the left as he is in the room, each draining toward the middle; this screen's enemy has the bright edge. Between them the gap in points, amber past 6, red past 12, with an arrow at the one with more health (`BossHud.setTwin`) |
| One falls | `boss_fell`: its moves stop, the wall of fire goes out (the obstacle is gone, the flames fade over 2.5 s), and the other is furious to its end and is everyone's. On the screens of the fallen one the other becomes the enemy (`Duel.twinFell`: its model, spot and HP, as a tag swaps a model); their hits and control go to it, its script stops being a ghost, and the fallen one lies where it stood. The raid is won when both are dead |
| Their moves | No tag, no rim: both have their own moves all the time. Ash: Ground Slam, Charge, Knuckle Quake, and from 66 % Drag Under. Ember: Fan, Vent Bombs, Lantern Toss, Marked, and from 66 % Lava Wave and Falling Star |
| The stage | Each has its own Eruption at half of its own HP, at its own place, with its own three Coal Hearts 6.5 m round it, and its own half to erupt over if they still burn. Each half puts out its own; the other boss stays open to hits meanwhile |
| The vent | In Together each has a vent at its own place, twice, as for two. The lava rises from the rim for the whole room as soon as **either** is in Together, and sealing either vent holds it back 20 s for everyone |
| A hero stays in its half | A walk and a blow stop at the wall as at any cover. A dash, a blink or a leap would pass cover, so a hero found across the wall or in it is put back at its face (`Duel.holdHalf`). A fallen hero can be got up only from its own half, until the wall is out. The autopilot plans only inside its half (`Duel.reachable`) |

What reaches the whole floor for two, and what it does in a party's pit:

| Move | For two | For a party |
|---|---|---|
| Charge | To the rim | To the rim or the wall of fire, whichever comes first (no reward for the wall) |
| Knuckle Quake, Fan | Lines to the rim, or the first cover | The same; the wall is cover |
| Drag Under | A ring from 4.5 m to the far rim | From 4.5 to 14 m from him, cut off at the wall |
| Lava Wave | From the vent over the pit | From Ember's great vent over her half (33 m, at 6.5 m/s instead of 5), cut off at the wall |
| Falling Star | 30 % shared by who stands under it; 45 % each if nobody does | 45 % shared (three under it: 15 % each); 45 % each if nobody. Counted among her half only |
| Eruption, failed | 45 % over the whole pit | 45 % over that boss's half |
| Marked | Carry it onto the one in the ring | Carry it onto Ember |
| The lava | From the rim in to 12, 10, 8 m | From the rim in to 24, 20, 16 m, both halves alike |

**The messages** (PROTOCOL 9). `which` (0 Ash, 1 Ember) is on a message only in a twin fight; a raid for two and the other bosses send
and get what they always did.

| Message | With `which` |
|---|---|
| `raid_stage` | gains `twin: { half, hp, brain, staggerMax }`: each side's half (0 west, 1 east, -1 gone), each boss's HP and brain, one boss's gauge. `hp`, `brain` and `staggerMax` stay the pair's |
| `boss_cast`, `boss_move` | From a brain: taken only from the screen that runs **that** boss's brain. Ember's cast ids start at 1,000,000 (`RAID_TWIN.ids`), so the two brains never share one |
| `boss_damage`, `boss_stagger`, `boss_debuff` | Which boss this hero hit. While the wall stands only its own half's counts; a hit named for one that has fallen is dropped |
| `boss_reward` | From that boss's brain. A mechanic fills half of what it fills for one boss |
| `boss_hp`, `boss_phase`, `boss_gauge`, `boss_kneel`, `peer_debuff` | Which boss it is about |
| `boss_brain`, `brain_moved` | Whose brain moved. The watchdog and a leaver's hand-over pick a screen of the same half |
| `boss_rage { which, on }` | New: that boss grows furious, or calms |
| `boss_fell { which }` | New: that boss fell (its last `boss_hp` of 0 comes just before) |
| `boss_stood`, `revive` | No `which`: a gold zone waits only for the half of whoever reported first, and nobody gets a hero up through the wall |

Measured through the real hub (`python pipeline/tools/party-raid.py <out> --players 6 --seconds 280 --port 5197 --boss ash`): six
bots, band 10, 17,750 HP each, times on the fight's own clock. Left alone they kept the two within 7 points for three minutes (nobody
furious until 3:14), had both at half after 1:30, and then each half took close to the full 30 s over its Eruption (three heroes for
three Coal Hearts of 621 HP). Ash fell at 3:17, 27 s past the enrage, with Ember at 16 %; five of the six were down three seconds
later, and at 4:02, when the run was stopped, Ember still had 10 %. A half took 78 to 92 HP a second off its boss, 26 to 31 a bot. So
six at the HP for ten is slow here too, as it is against the Warden. All six screens agreed on both bars within 1.7 % of a bar (a hit
on its way), nobody was across the standing wall in any sample, no errors. With `--twin --boost 60` the tool steers the fight through
every moment (one far ahead, level again, one falls, the last one falls) and takes the pictures.

## The Heart of Noon

`src/raid/heart.ts`. The fallen sun itself. It never walks (`speed` 0): it floats over the middle of its room and turns to whom it looks at.
Alone 3,300 HP, for two 7,100. Enrage 2:45. Its body reaches 2 m: its rings, beams and the beat start there.

| Phase | From | Move | Shown | Costs | What you do |
|---|---|---|---|---|---|
| Embers Wake | 100 % | Blade Sweep | 1.7 s | 18 % | Leave the 130° arc 6.8 m in front of it, or get round it. Only when you are within 8.5 m |
| | | Blade Fall | 1.4 s, 1 s apart | 15 % each | A blade comes down on a line 11 m long through where you stand; the second across the first, where you are then |
| | | Solar Flare | 2.4 s, then three rings 1.6 s apart | 12 % a ring | Each ring has two gold gaps opposite each other, the first 20 to 45° to one side of you, each pair 12 to 20° further round. Get into a lane and drift with it |
| The Rings Turn | 66 % | The Rings Turn | 2.5 s, then 15 s | 10 % a second in a beam | Three beams from its foot to the rim, turning at 18, 13 and 23° a second, two one way and one the other. Lock a ring (above) |
| Noon Falls | 33 % | Heartbeat | 10 s, every 20 s | 40 % | Shade the heart (above). The floor burns from 2.2 m to the rim; at its foot is a hole, so Molten Ground leaves no pool under it |
| | | Crown of Rays | 2.2 s, then 1 s apart | 15 % | Four rays (one at you), then the four between them. Stand between, then step into where the first fired |
| All | | Hold Still | 3 s, then a run of beats: 3 beats 2.6 s apart, then 4 at 2.1 s, then 5 at 1.6 s | 12 % a beat, only if you are walking | Stop walking before each beat. Runs come by the clock: 9 s into Embers Wake and every 21 s; 11 s into The Rings Turn and 13 s into Noon Falls, then every 20 s |

Noon Falls has all its moves.

**Hold Still** (user, 2026-11-11: "The heart beats in a slow rhythm you can see on the floor. On the beat, stand still: anyone moving is
burnt. Between beats, run. The rhythm speeds up as it dies."; pictures `docs/bosses/heart-holdstill-*.jpg`). Its signature, and the
only thing in the game that asks you not to move.

- **By the clock, on top of the rest** (`BossPhase.timed`, `alongside`, `quiet`): it takes no cast bar, no pose and no turn of the Heart,
  and its other moves go on through it. That is the point of it: easy to understand, hard to do while dodging. A move can't see the
  phase, so each phase has its own move from one recipe (`still`, `still2`, `still3`), which is how the rhythm quickens. A whole run is
  one cast that aims at nobody, so its beats can't drift between screens; each screen judges its own hero, so it is the same for one
  hero or forty.
- **What you see.** Fine white lines run in along the floor from each joint between its rings of plates to the next, and land on the
  joint on the beat; 0.45 s before it the joints turn white (stop now), and they flash as it strikes. Round your own hero a white ring
  closes onto a second one on the beat (`PlayContext.heroAt`, a look only), so the beat reads at your feet on a phone that can't see the
  heart. The Heart fills as the light runs in and clenches on the beat (`HEART_LIVE.fill`, `clench`).
- **With its other mechanics.** Nothing is made impossible, because the moment that counts is short (0.25 s) and standing is what
  several of them ask anyway. Solar Flare: where its three rings' gaps overlap you can stand through flare and beats alike. Lock a
  ring and Shade the heart: holding a spot is standing still. Blade Fall (shown 1.4 s) and Blade Sweep (1.7 s) leave over a second to
  step out before or after a beat. The beams are the hard one, and meant to be: stop a step ahead of a beam. In Noon Falls a run
  falls between two Heartbeats when both keep their clocks; when the Heartbeat slips later, the beats come while you already stand
  behind your plate. A new phase's first run comes after the last phase's has ended. `_raidHeart()` checks the flare and the plate.
- **It doesn't stop for a kneel or a phase's pause:** a move by the clock runs through both (`BossBrain.timedStep`). The first
  phase's clock starts at its `first` too (the brain's constructor; before, only a later phase's did).
- **Tiers.** The 3 s before the first beat and the time between beats shorten as other shown times do (`p.shown`), never under 1 s
  between beats. **How it stays within the rules.** Each ring of The Rings Turn is its own step and cast (`steps: [0, 0, 0]`),
so each has its own spot and each lock is paid once (`RAID_REWARDS.heart.lock`, `${id}:lock`). A beam's angle depends only on the time since
its cast; a lock puts it out for 8 s rather than pausing it, so two screens that hear the lock a moment apart still agree on where it is.
A raised plate stands until the same moment after its cast on every screen (`addStone` with the seconds left), whenever that screen heard of
it. Solar Flare's first gap is the brain's aim (the cast's `dir`), the rest is the seed's.

**For the autopilot.** Each ring of Solar Flare tells an AI its whole run at once (`Threat.look`): it grows, so a spot clear for the next
moment is not clear. The AI still drifts out of a lane's edge as it goes back to fighting, so Solar Flare costs it more than it should cost a
person. For Hold Still it stops walking 0.36 s before each beat and goes on casting (`BossScript.stillIn`; in `Duel.pilot` it counts as
unable to move), and starts no dash within 0.9 s of one. It stood for 227 of 227 beats in 12 fights, so a beat costs it nothing
directly, and the raid tool can't measure the beat's 12 %: what the autopilot pays is a zone it could not step out of in that moment.

## The lairs

The boss rooms are where the bosses live, not duel arenas (user, 2026-11-07). Neither is in `ARENAS`, so no duel picks them. **The Sun Court's
cover is where it was** (spots and sizes): the moves were tuned on it. The Cinder Pit's became the four pillars of Ash's Charge (2026-11-08, six at first). Each has its own prop kit, loaded with `loadKit` (`src/arenas/temple.ts`), built by
`blender/arenas/sanctum_props.py` and `den_props.py`; sheets in `docs/arenas/`.

**The Sun Court, the Warden's sanctum** (`src/arenas/suncourt.ts`). Radius 16 against a duel ring's 12, under an eclipse. Six screen walls at
6.5 m become carved sun-stone slabs (whole, cracked, rubble, through `templeCover` with the sanctum's kit), eight columns at 11 m become sun
obelisks, the altar in the middle is the Sun Well where shards are delivered, and the rim's bowls are sun bowls. The floor is his sundial:
hour stones, the gnomon's shadow frozen when the sun fell, and thin cracks of warm light toward the north (not gold: gold on this floor means a
zone to stand in). Past the north gate his empty throne; obelisks and broken sun arches along the sides; rocks like his own drifting round;
motes of light rising.

**The Hall of Noon, the Warden's room for a party** (`src/arenas/sunhall.ts`, built by `blender/arenas/real/sunhall.py`; how it came
about: [raid-party.md](../../pipeline/designs/raid-party.md)). A hall in the shape of a cross cut out of dark stone. Seen from the Sun
Well at its crossing (the game's `RING`, (0, 7)): the nave 44 m south to the gate, the choir 40 m north to the throne, the transepts
34 m west and east; every arm 26 m wide. The game's floor is still a ring (46 m); the hall's shape is its walls, obstacles that never
break (`Obstacle.fixed`). The file also says where its floor is: `inHall`, `intoHall` (the nearest spot on it), `HALL_ARMS`, `inArm`
and `armSpot`, which the Warden's moves use.

Two things a room that is not round needed in the walk planner (`src/nav.ts`):
- **Its map is no longer worked out whole.** With the hall's 86 pieces of cover, joining every point of the map to every other took
  about 2 s each time the cover changed (every fallen stone). The links of a point are now found when a plan first comes to it, and
  cover far from a walk is skipped: under 0.1 s for the map, and 5 ms for a plan from inside the hall. The routes are the same as
  before: compared on 2,000 random walks in the court and four duel arenas, and on every walk between two spots on the hall's floor.
- **An order into the stone ends at the nearest spot the walker can reach.** A room with walls of its own has floor inside its ring
  that nobody can reach. Planning to such a spot searched the whole map (0.4 to 0.8 s). The floor is charted once a room in 1 m
  squares, by the part each can be reached in (`Navigator.parts`); only an order into another part, or into one of the room's own
  walls, is moved. A room without such walls has no chart and nothing changes.

**It breaks open** (2026-11-12). The four corner blocks are cut in the Blender file into what stays (past the round court's wall,
36.4 m from the Sun Well) and 32 pieces that fall, each an object of its own (`fall<corner>_<piece>`, listed in the json as `falls`
beside `opens`, the walls that go, `rubble` and `court`). `hallBreak` in `src/arenas/sunhall.ts` is the room's state: `crack` makes
the pieces tremble, `fall` drops them (each after its own delay, the tall north ones last) and makes `inHall`, `intoHall` and
`inArm` answer for the round court; `reset` before each fight. The lights on the blocks go out with them, and the court's own
windows are lit once they are down. The floor under the blocks is drawn from the start: bare rock in rough slabs round the well,
cracked from the hall's corners. Rubble and the court's wall are obstacles from the start (see the Sun Warden, above).

Six of its corners lie behind a brazier that stands a body's width from both walls. A hero pushed in there stood in a pocket the
planner knows no way out of, so each is solid to the game, from the brazier to the corner (`CORNERS`), with nothing drawn for it.

**The Cinder Pit, Ash and Ember's den** (`src/arenas/cinderpit.ts`). Radius 16, a floor of black glass plates over the buried sun, its light
coming up through thin seams, brightest in the middle, and Ash's claw marks across it. Its only cover is the four pillars of sun-glass at 7.5 m
(above), which Ash's Charge breaks; they took the place of the spires, slag walls and anvil stones on 2026-11-08. Ember's lantern perches on the lip at the five spots the one on the rim can
stand (their tops at 0.7 m). Out in the lava the fallen sun's shard, the ribs of something that burned, lantern posts on the far side, rocks;
embers rising.

**The Cinder Pit for a party** (`src/arenas/twinpit.ts`, 2026-11-12). Twin Flames' room: the same black glass floor 30 m to the rim, a
wall of fire down the middle from the south gate to the far side (a row of flames over a strip of molten floor, a burnt line once it is
out), Ash's pillars in the west half, Ember's vents with dark stone collars in the east, the pit's props pushed out into a wider lake.
First-pass, drawn in code; a room built in Blender is to come, and every number of its layout is in `TWIN_LAYOUT`.

**The Sunken Heart, the Heart's own room** (`src/arenas/sunkenHeart.ts`, 2026-11-11). Radius 12, round, no cover of its own: the only cover
is what the fight raises. A floor of cooled gold crust gone dark bronze, broken into rings of plates round the heart, molten light only in the
cracks; a basalt lip with gold edges; a molten lake beyond. The keepers' lanterns stand on the lip (basalt posts, gold caps, a caged sun: the
only glow besides the cracks), short on the camera's side. Out in the lake what broke off as it fell: two arcs of its armillary, a snapped ray
of its crown, slabs of crust with gold edges; gold motes rising. All drawn in code from clean forms (the arenas lesson: no scans), first-pass
for the artist to direct.

## Two screens

**Each screen stays one hero against one enemy, plus a third body it only draws.** The partner is not in `liveFoes()`, so nothing
of this hero's can target or hit it.

| Thing | Who decides | Messages |
|---|---|---|
| The boss's walk, next move, target | Side 0's brain | `boss_move`, `boss_cast` |
| A hit on a hero | That hero's own screen | None: each client owns its hero's HP and reports it (`raid_hp`, `partner_hp`) |
| The boss's HP and phase | The hub | `boss_damage`, then `boss_hp` and `boss_phase` to both |
| Stagger and kneeling | The hub | `boss_stagger`, then `boss_gauge` and `boss_kneel` to both |
| Slow, Weakened and Vulnerable on the boss | The screen of the hero who landed it | `boss_debuff`, then `peer_debuff` to the other, which applies it and sends nothing back. The brain's screen walks the boss slower, and both heroes take less and deal more |
| A gold zone | The hub counts who stood in it | `boss_stood { id, part, inside }`, then `boss_stood { id, part, count }` to both, after both have said or 1 s |
| A wall that saved someone | The hub, once | `boss_wall { index }` to both |
| Falling and getting up | The hub keeps who is down | `hero_down`, `peer_down`; `revive`, `revived` |
| Someone leaves | The hub | `partner_left`, and `boss_brain` if the leaver ran it. The next fight is at the HP for one |
| An objective | The hub, to the first report | `boss_obj { id, part }`, then `boss_done { id, part, side }` to both |
| An add's HP | Each screen its own copy | A hit on it: `boss_add { id, part, amount }`, then `peer_add` to the other, which takes it off and sends nothing back |
| An add's death | The first screen that sees it: an objective | `boss_obj`, then `boss_done`: both kill it. The last one's reward is the brain's `boss_reward` |
| The enrage timer | Each screen's own clock | None |
| What a mechanic earns | The hub, from `RAID_REWARDS`, once per cast | `boss_reward { key, id }` from the brain's screen only, then `boss_hp`, `boss_gauge` or `boss_kneel` |
| The run's order | The hub | `raid_offer`, `raid_pick`, `raid_gate`, `raid_enter`, `raid_stage`, `raid_won`; after the last boss `raid_next` from both, or the end after 30 s. A hero's walk in the hall is clamped to its 13 m |
| The end | The hub | `raid_end` with the score |

**Against the design:** the hub doesn't check a hero's own HP (`boss_hit` with caps is gone). A cheat there only helps both players,
and the hub already says it is fine for friends and not cheat-proof. The boss's HP stays capped by the hit and by the second, because
both players add to it. A room always has two seats: **alone is always offline**, so the hub's relay cases need no guard for a room of one.

**The partner's spells** (`Duel.partnerCast`): the same effect plays from the partner's figure with every hit dropped. Off in the
replay: shields, heals, dashes (they arrive as moves), units, carries, confine rings and bolt walls, because each would act on this
screen's hero or differ from the partner's own screen. Kept: temporary walls and `blastWalls`, so boss rays stop at the same cover on
both screens. Its red zones are not drawn: they are not a danger here.

**Getting up:** a fallen hero lies where it fell with a gold ring round it. The partner stands within 2.5 m for 3 s (hits don't stop
it, casting does), and it gets up with half its HP. Twice a fight per hero. Both down ends the raid.

## Limits

- **The Hall of Noon was fought only by one autopilot hero at a time** (`_raid(..., { band: 5 })`), never by a party of people or of
  bots through the hub. What forty heroes do to The Hour Strikes (a crowd in one arm's mouth) was not seen. Its cost on a phone was
  not measured, only counted: late in the count about 45 tongues of flame and 300 embers at once, and 42 columns more for under a
  second at the bell; each tongue and column is a draw call of its own.
- **The Warden's older mechanics are not scaled to the band.** Gathering Noon (under 16 players) still asks for two shards and
  Anchors for two circles; his stage has three stones whatever the party's size.
- **The Four Hours has not crossed the real hub, and Carry the Sun only its beginning.** Six bots are a fight tuned for ten, which
  has Branded and the hall's two changes. Sixteen bots saw Carry the Sun cast and a shard picked up, not its end; thirty-one pages
  were not tried. Both are built from what the hub already carries (who took a spot, how many stood in a zone, a reward by its
  key), and `_raidCheck` feeds those by hand.
- **A shard's carrier can still cast.** The design says it cannot; that needs `src/duel.ts`.
- **A carrier that falls keeps its shard,** and gets it home only if someone gets the hero up in time.
- **A kneel or a new phase puts the brands out:** it drops the bursts still to come, as it drops any move's later steps.
- **The hall has 138 obstacles** with the rubble and the court's wall. A walk's plan there costs more than it did with 86: an
  autopilot fight of about 150 s ran in 3 to 11 s here, against about 4 s before. Not measured on a phone.
- **A screen that takes the brain over** starts his great mechanics' turns from the first, with no breath before it.
- **The autopilot fights worse in the hall than in the court:** 9 clears of 40 against 8 of 20 for the same ten heroes, and its
  fights are 30 to 70 s longer. It walks 40 m to him first, and during an hour it stands at the safe arm's mouth, where a melee hero
  does not reach him. A person would lead him into the arm.
- **A screen that takes the brain over during an hour** keeps to its small moves (`BossFight.takeBrain`), but an opener the old
  brain was holding back is lost with it.
- **A reward rides on the brain's screen.** If that player leaves between a mechanic and its reward, the reward is lost.
- **Twin Flames was played by bots only,** six of them through the real hub (above). Whether 12 and 6 points, and a furious one at 1.5
  times, feel right is for a party of people to say. Nobody chooses a side: the hub deals them by seat.
- **Twin Flames, when one falls:** what the other already has on the floor counts for everyone from that moment, still drawn to where
  the wall stood. A stage of the other's goes on to its end. After it Ash's Charge reaches Ember's half, which has no pillar.
- **Twin Flames, the other boss on a screen:** it does not flinch or flash when hit (its hits are another screen's), and a partner's
  spell replayed at it aims at a stand-in with no body (every hero's spells were replayed at it: no errors). Its Coal Hearts are real
  units here: a spell that needs no sight could hit them, which changes nothing on their own side. The red heat round this screen's
  enemy keeps the size of the boss it started with after the other takes its place.
- **Twin Flames, not checked:** a player leaving, in the browser (on the hub it is: the brain goes to a screen of the same half); more
  than six screens; what two scripts and the other half's adds cost a phone; tier 2 and up; a gold zone still open at the moment the
  wall goes out (the hub settles it after its 1.5 s wait).
- **Zones can be cut off along a line** (`TelegraphLayer.clip` in `src/effects/telegraph.ts`, which spells use too): the fill's shader
  carries the cut for every zone, set to cut nothing unless a boss's script asks. Spells never set it.
- **Twin Flames, a half with nobody standing:** its boss has nobody to aim at and waits. A half everyone left can't be hurt until the
  other falls; it is then furious, at full health.
- **The first big moment in a session builds its shaders,** as the first fade does: a short pause the first time a stage starts. Not measured on a phone.
- **The effects' cost was measured on a desktop only:** about 10 ms a frame (simulation and drawing) in a quiet moment, 11 to 14 ms in a stage's call, the flare and the geyser.
- **An add's HP can differ a little between screens,** by a hit whose message is still on its way. Its death can't: that is an objective.
- **The partner's attacks are drawn at the boss,** also while the partner is hitting an add. Its spells land where they were aimed. Cosmetic.
- **Each screen's enrage timer starts on its own,** so the two can be apart by the time a message takes.
- **A screen that takes the brain over in a stage** starts from the next move: the stage goes on to its end on both screens, but the boss may act during it.
- **The bodies' poses were judged on screen only in passing** (a fight each, desktop and phone size). Glow strengths come from the Blender
  file and may need tuning against the game's bloom; Ash's core is the brightest.
- **Ash's body is 1.8 m wide for hits,** his forearms reach about 2.5 m: a hit on a fist's tip still misses.
- **The Heart's body state is one per page** (`HEART_LIVE`): its moves set it and its body reads it. One fight a page, as the game and the
  tools run; the kit clears it when a fight starts.
- **The Heart at higher tiers.** From tier 3 The Rings Turn is in its first phase's list too and also opens the second, so for a moment six
  beams can turn. From about tier 8 the Heartbeat gathers too briefly to raise a plate in time: the plates' fall and the 3 s hold don't
  shorten with the tier. Tiers 3 and 4 ran with no errors.
- **Some upgrades and omens barely touch the Heart:** Sun Eater has no gold zone to stand in, and Molten Ground pours only where a plain
  orange circle lands, which the Heart's lines, cones and rings are not.
- **Hold Still was not played by a person,** on a desktop or a phone: whether the 0.25 s and the white lines feel fair is for a hand to
  say. A walk order by tap or click goes on to its end, so a hero sent far keeps walking into the beat: let go of the stick, press S,
  or tap near. A hero's own spell that moves it without being marked a dash (`HeroSpell.dash`) counts as walking, and the autopilot
  doesn't know to hold it. The ring at the feet stays round a fallen hero until the run ends.
- **The Heart was not played for two in two tabs.** `_raidHeart()` gives a partner's lock and plate on this screen through the same `done`
  the hub sends; a bot raid online through the local server was not run for it.
- **The hall's cards are page elements over the 3D**, placed each frame. On a small phone they can sit over each other near the edge.
- **A summoner's partner sees fewer bodies:** units are raised only on their owner's screen.
- **Marks, stacks and meters stay on their owner's screen.** The partner's bar shows HP only.
- **Its body is wider than the walk planner assumes,** so it can clip a wall corner while walking.
- **A hero's words and marks on the enemy still land on the boss** (`enemyLabel`, `marks`). Only `enemyScale` is off for it. Cosmetic.
- **Vesper's Sanguine Feast reads the HP she has taken off the target,** which grows large against a boss. All 39 heroes ran with nothing odd, but it has not been looked at on its own.
- **A reload or a lost connection ends that player's raid.** There is no way back in, and the other hero fights on.
- **A deploy ends every raid,** as it ends every match.
- **A Ricochet bolt still cracks the wall it bounces off, and its aim strip stops there.** On the partner's screen it doesn't bounce, since
  the partner's upgrades aren't sent: only the look differs.
- **A hero's upgrades don't change the partner's replay.** A Glass Edge hit looks the same; the HP comes from the hub.
- **The first fade in a session builds a shader.** The first time a boss fades there is one short pause, about 50 ms on a desktop and not measured
  on a phone. Nyx's veil does the same in a duel.
- **A brain in a tab hidden for over 5 minutes nearly stops.** A hidden tab goes on simulating from a timer, about once a second, which works
  (checked: nothing piles up when it comes back). After 5 minutes Chrome slows timers to once a minute, and the boss hardly acts for the other
  player. A phone that freezes the page and drops the socket hands the brain over at once.

## Tools

- `pipeline/tools/raid-check.js`: `_raidCheck()` forces each of the Warden's moves and checks what it costs, walking out, cover and the
  boss's own rules, his stage (adds, the relay, the kneel, the fail and its cover) and the enrage. `_raidAsh()` does the same for Ash and Ember,
  with the tag, the lava, Eruption and Falling Star. `_raidHeart()` for the Heart: each move, both ways through Solar Flare's gaps, a beam,
  a lock by this hero and by the partner (paid once), plates raised by both, cover against the beat, and the plates all going at one moment;
  Hold Still: walking and a dash are burnt, standing, a knock, a carry and a stone raised under the hero are not, the rhythm by phase and by the brain's live clock, and standing through a flare and behind a plate (71 rows). `_raidUpgrades()` checks each upgrade's number and
  each tier's. `_raidPartners(names)` replays each hero's spells and attack as a partner and checks nothing touches this screen's hero or the boss.
  `_raidTwin()` for Twin Flames, with the two HP pools kept on the page (`TwinLocalLink`): the room and the wall (walk, sight, bolt, blow,
  carry, dash), each boss's moves in its half and the other's as a look only, the Charge at the wall and at a pillar, the furious rule
  on, off and with the enrage, a fall on either side of the wall, each half's stage and vent, Falling Star, the two brains' ids, and the
  autopilot staying in its half (72 rows). `_raidTwinPartners()` replays every hero's spells and attack as a partner in the other half,
  aimed at the other boss's stand-in: no errors, and nothing touches this screen's hero or its boss (200 replays).
- `pipeline/tools/boss-anim.js`: `_strip(title, setup, plan)` plays a move in a stepped fight and lays frames of it side by side round its
  landing, cropped on the boss and the hero.
- `pipeline/tools/raid-tool.js`: `_raid(heroes, reps, { level, boss })` runs the autopilot and reports clears, time, damage per second,
  which move killed, stages won of those reached, and how many fights enraged. It can't tell whether the fight is fun.
  `{ band: 5 }` runs it in a party's room (the Hall of Noon), with the boss's HP still the one for one hero; `wall` is how long a
  fight took to run, in real seconds.
- `_raidCheck()` also has the hall's rows: the hour never comes in the court for two; in the hall each seed's arm is safe and the
  rest is hit; the bell's time and its floor at a higher tier; what he may do meanwhile; a stage calling it off; the autopilot's run
  from the gate to the choir; the hall's walls as cover that stands; his aim and his floor-wide moves in the hall.
- `_raidCheck()` also has the party's rows (101 of its 234): which band sees which mechanic, and his great mechanics' turns; the
  hall's shape before and after it breaks, who is struck, the autopilot walking clear, the hour in the round court, the fall coming
  with The Long Hour and from Last Light when one hit passed two phases; the sunfire's cost, its edge by its clock, the autopilot
  keeping out; Branded by the brain's `aim` for 40 and 10 standing, what a burst costs whom, a burst in the crowd (the hub's count
  fed by hand); Carry the Sun's shards on open floor in both shapes, a shard carried home, what Noon costs with some home, the kneel,
  the ray stopped by a hero's body; The Four Hours' tasks, each arm done by what the hub would say, and the cast bar naming the
  arms; whom he goes for (a carrier, then quarter by quarter in the sunfire), asked by hand. One row checks that every cast he
  sends has only the fields the hub passes on.
- `pipeline/tools/warden-shots.js`: the pictures of the party fight from the game's camera, with eleven partners who stand where
  they are put. `pipeline/tools/party-raid.py --hall`: when the hall broke open on each screen, and whether their cover agrees.
- `pipeline/tools/hour-walk.js`: the autopilot's seconds from the far end of each arm to each other arm, for the hour's time.
  `pipeline/tools/hour-shots.js`: the pictures of The Hour Strikes from the game's camera. Both run headless with
  `pipeline/tools/page-shots.py`.
- `pipeline/tools/heart-holdstill-shots.py`: the Hold Still pictures, from the game page with its HUD, by the browser's own screenshot.
- `pipeline/tools/online-bot.js`: `_botRoom(hero)` and `_botJoin(hero, code)` play a raid for two in two tabs with bots.
- `pipeline/tools/party-raid.py`: a party of bots through the real hub in hidden pages. `--boss ash` starts the run at Ash and Ember
  (Twin Flames for a party); `--twin --boost 60` steers that fight through all its moments and takes its pictures; `--phone` makes the
  last screen a phone.
