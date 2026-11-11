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

## The pieces (`src/raid/`)

| File | Role |
|---|---|
| `types.ts` | `BossDef`, `BossMove`, `BossCast`, `Threat`, `RaidLink`, `BossWorld` |
| `fight.ts` | `BossFight`: ties the rest together. `Duel.startBoss` builds it, and `update` calls it where a duel calls its AI |
| `brain.ts` | `BossBrain`: who it aims at, which move comes next, where it walks. Runs on one screen. Its rolls are seeded |
| `script.ts` | `BossScript`: plays casts, draws their zones, lands them, decides the hits on this screen's hero. Several run at once, in both colours |
| `sunWarden.ts`, `ashEmber.ts`, `heart.ts` | The bosses: numbers, phases, moves |
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
| Colours | Pale orange means leave, gold means stand here (`LEAVE_COLOR`, `STAND_COLOR`). Gold zones also get a rising light, because the two colours are close |
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
| The Hour Strikes | Only here, in every phase (`HALL_PHASES`). Below |
| Enrage | 3:15 instead of 2:30: the party walks 40 m up the nave to him first, and each hour takes the fight away from him for a while |
| What he aims (Pillar Fall, Fists, the ray) | Kept 1.8 m inside the hall's walls (`intoHall`), so no stone lands in the stone. At a hero in the gate's passage: down its middle |
| Sun Order | Its wedges reach 19 m from the Sun Well (the crossing and its corners), not the whole floor: deep in an arm no edge of a wedge is near enough to step over |
| Eclipse | Its far ring ends 20 m from him instead of at the rim |
| Gathering Noon, the Long Hour's blow, Walking Sun, the late sunfire | The whole hall, as in the court. The stone round the hall hides what is drawn past its walls |
| The hall's own walls | Cover like any other: round a corner Noon, the ray and the dial's blow do not reach. They never fall (`Obstacle.fixed`): a wall that saved a hero is only reported when it is a screen |
| Sun shards | Whoever picks one up brings it in (one way in for each of the 40 seats). Still two shards, whatever the party's size |
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

Noon Falls has all its moves. **How it stays within the rules.** Each ring of The Rings Turn is its own step and cast (`steps: [0, 0, 0]`),
so each has its own spot and each lock is paid once (`RAID_REWARDS.heart.lock`, `${id}:lock`). A beam's angle depends only on the time since
its cast; a lock puts it out for 8 s rather than pausing it, so two screens that hear the lock a moment apart still agree on where it is.
A raised plate stands until the same moment after its cast on every screen (`addStone` with the seconds left), whenever that screen heard of
it. Solar Flare's first gap is the brain's aim (the cast's `dir`), the rest is the seed's.

**For the autopilot.** Each ring of Solar Flare tells an AI its whole run at once (`Threat.look`): it grows, so a spot clear for the next
moment is not clear. The AI still drifts out of a lane's edge as it goes back to fighting, so Solar Flare costs it more than it should cost a
person.

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

Six of its corners lie behind a brazier that stands a body's width from both walls. A hero pushed in there stood in a pocket the
planner knows no way out of, so each is solid to the game, from the brazier to the corner (`CORNERS`), with nothing drawn for it.

**The Cinder Pit, Ash and Ember's den** (`src/arenas/cinderpit.ts`). Radius 16, a floor of black glass plates over the buried sun, its light
coming up through thin seams, brightest in the middle, and Ash's claw marks across it. Its only cover is the four pillars of sun-glass at 7.5 m
(above), which Ash's Charge breaks; they took the place of the spires, slag walls and anvil stones on 2026-11-08. Ember's lantern perches on the lip at the five spots the one on the rim can
stand (their tops at 0.7 m). Out in the lava the fallen sun's shard, the ribs of something that burned, lantern posts on the far side, rocks;
embers rising.

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
- **The Warden's mechanics are not scaled to the band.** Noon still asks for two shards and Anchors for two circles, whatever the
  party's size; only his HP and gauge grow.
- **The autopilot fights worse in the hall than in the court:** 9 clears of 40 against 8 of 20 for the same ten heroes, and its
  fights are 30 to 70 s longer. It walks 40 m to him first, and during an hour it stands at the safe arm's mouth, where a melee hero
  does not reach him. A person would lead him into the arm.
- **A screen that takes the brain over during an hour** keeps to its small moves (`BossFight.takeBrain`), but an opener the old
  brain was holding back is lost with it.
- **A reward rides on the brain's screen.** If that player leaves between a mechanic and its reward, the reward is lost.
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
  a lock by this hero and by the partner (paid once), plates raised by both, cover against the beat, and the plates all going at one moment. `_raidUpgrades()` checks each upgrade's number and
  each tier's. `_raidPartners(names)` replays each hero's spells and attack as a partner and checks nothing touches this screen's hero or the boss.
- `pipeline/tools/boss-anim.js`: `_strip(title, setup, plan)` plays a move in a stepped fight and lays frames of it side by side round its
  landing, cropped on the boss and the hero.
- `pipeline/tools/raid-tool.js`: `_raid(heroes, reps, { level, boss })` runs the autopilot and reports clears, time, damage per second,
  which move killed, stages won of those reached, and how many fights enraged. It can't tell whether the fight is fun.
  `{ band: 5 }` runs it in a party's room (the Hall of Noon), with the boss's HP still the one for one hero; `wall` is how long a
  fight took to run, in real seconds.
- `_raidCheck()` also has the hall's rows: the hour never comes in the court for two; in the hall each seed's arm is safe and the
  rest is hit; the bell's time and its floor at a higher tier; what he may do meanwhile; a stage calling it off; the autopilot's run
  from the gate to the choir; the hall's walls as cover that stands; his aim and his floor-wide moves in the hall.
- `pipeline/tools/hour-walk.js`: the autopilot's seconds from the far end of each arm to each other arm, for the hour's time.
  `pipeline/tools/hour-shots.js`: the pictures of The Hour Strikes from the game's camera. Both run headless with
  `pipeline/tools/page-shots.py`.
- `pipeline/tools/online-bot.js`: `_botRoom(hero)` and `_botJoin(hero, code)` play a raid for two in two tabs with bots.
