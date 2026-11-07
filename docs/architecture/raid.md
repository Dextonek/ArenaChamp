# The Raid

A boss fight on the duel's vs-CPU path, alone or for two. What the Raid is and why: [duels-and-raid.md](../../pipeline/designs/duels-and-raid.md).
The order it was built in and how each piece was checked: [raid-build.md](../../pipeline/designs/raid-build.md). This file says
how it works now.

It shows to everyone: in the top bar, and on the login screen for a raid with no account. An old `/game?raid` link still works, because the page ignores the `?raid`.

**Noonfall** (user, 2026-11-07: a place of their own, bosses unlike heroes, mechanics to do; design and decisions in
[raid-noonfall.md](../../pipeline/designs/raid-noonfall.md)). A sun fell into a mountain at noon. The Sun Warden keeps the court above it, Ash and
Ember the pit below, and the run waits in the hall between them.

## The run

Walk onto an altar in the hall to take an upgrade, walk through the gate, fight the Sun Warden. Back to the hall, another altar, the other gate,
Ash and Ember. Beat both and the next tier is offered, keeping the upgrades, for a higher score. HP is full at each fight. One loss ends the
run: alone that is one fall, for two it is both down at once.

## Noonfall's hall

`src/raid/hall.ts` and `src/arenas/noonfall.ts`. Round, radius 13, not in `ARENAS`. A gold wheel half sunk in the middle with lava in its
cracks; marble and gold on the Court's side (west), hex basalt on the Pit's (east); three broken gold rays standing between the two gates. All drawn
in code with the temple's and the caldera's props: first-pass, for the artist to direct.

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

## Mechanics players do

All by walking, so a phone needs no new button. What each earns is in one table (`RAID_REWARDS` in `server/protocol.mjs`), paid once per cast
by the hub online and by `LocalLink` alone. Only the screen that runs the brain asks for it (`link.reward`).

| Boss, phase | Mechanic | What you do | The reward |
|---|---|---|---|
| Warden, Awake | Break the ray | Pillar Fall's stones stay 8 s as cover. Keep one between you and him when Sun Ray comes | It breaks on the stone: +40 on the gauge |
| Warden, High Noon on | Turn the light | Gathering Noon fills for 8 s while sun shards fall 9 m from the altar. Walk over one to carry it (15 % slower, it glows over your head), and walk it to the altar. One alone, one each for two | No Noon. He kneels and takes 5 % of his max HP |
| Warden, Last Light | Anchors | As before | |
| Ash, any | Charge into cover | As before | |
| Ember, any | Burn your own | Carry Marked onto whichever of them is in the ring. The brain says in the landing cast whether the boss stood under it | 4 % of max HP and +40 on the gauge |
| Together | Seal the vent | The vent opens at 6 s, then again 25 s later. Stand on it for 4 s, hits or not, casting stops it | The lava waits 20 s longer, and +40 on the gauge |

**Objectives** (`Objective` in `types.ts`): spots a hero takes, at once or by holding. A move's `play` returns them beside its threats. Each screen
watches its own hero and reports once (`link.objective`); the hub gives each to the first report and tells both screens who (`boss_obj`, then
`boss_done`). The edge arrows point to them and the autopilot goes for them (`BossScript.objectiveGoal`). A move that comes by the clock rather
than the brain's pick (the vent) is `BossPhase.timed`.

| Tier | What changes |
|---|---|
| Each one | Boss HP +15 % (`raidHp`). Shown times 10 % shorter and never under 1 s (`p.shown`, `raidTierFactor`). One extra move (`BossDef.extra`) |
| Sun Warden's extras | Sun Order, then Walking Sun, then Eclipse, each from the first phase on |
| Ash and Ember's extras | Ash throws rocks in the ring too, Ember marks from the rim as well, then her wave from there |

**The score** is the most bosses beaten, then the fastest time. Alone it stays in this browser (`raid.best`). For two it goes on both
accounts (`recordRaid`) and does not count as a win or a loss: the profile's record stays about duels with people.

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
| `sunWarden.ts`, `ashEmber.ts` | The bosses: numbers, phases, moves |
| `bodies/` | Each boss's look: the parts of its own model, posed by code |
| `hall.ts` | `RaidHall`: Noonfall's hall between fights, and `fadeTo` |
| `link.ts` | `LocalLink`: one screen, no server. Decides on the spot what the hub decides online |
| `net.ts` | `NetLink`: the same calls through the hub |
| `coop.ts` | `RaidController`: a raid for two, next to `MatchController` |
| `partner.ts` | `Partner`, the other player's hero on this screen, and `Track`, a figure walked from reports |
| `hud.ts`, `fx.ts` | The boss's bar, cast bar and gauge; first-pass looks in code |
| `run.ts` | `RaidRun`: a raid alone, shaped like `CpuMatch` |

Small hooks elsewhere: `Arena.pinned`, `statusGate`, `foeFloor` and `onFoeDamage`; `StatusSet.hold`; `HeroFigure.setScale`;
`ArenaDef.ring`. Numbers the hub must know live in `server/protocol.mjs` (`RAID_BOSSES`), and the boss's definition reads them from there.

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
| Too long | Past 5 minutes sunfire closes in, at 6 Last stand (`BossDef.late`), so nobody can stall a fight for ever |
| Units | Whatever stands in an orange zone takes 60. Units don't dodge |
| Hiding a hero | A boss between the camera and a hero, yours or your partner's, fades to 10 % so the hero shows through, the one on the rim too (`Duel.bossFade`, `Hero.setFade`). The camera stays where it is, because the controls follow it |

## The Sun Warden

Numbers as they are; tune by playing. Alone 3,200 HP, for two 6,500. Walks at 2 m/s, stops 4.5 m from its target.

| Phase | From | Move | Shown | Costs | What you do |
|---|---|---|---|---|---|
| Awake | 100 % | Stone Sweep | 1.6 s | 20 % | Leave the 120° cone, or get behind him |
| | | Pillar Fall | 1.5 s, 0.7 s apart | 15 % each | Keep walking: three stones, each where you stood. They stay 8 s as cover |
| | | Sun Ray | 2.5 s | 22 % | Step aside or get behind cover. Cracks the wall it hits |
| High Noon | 70 % | Gathering Noon | 8 s, shadows for the last 4 | 40 % | Turn the light (above), or hide: gold shadows behind cover are safe. A wall that saved someone falls, a column stays. He stands open after |
| | | Sun Order | 2.5 s, then 0.8 s apart | 16 % | Four wedges fire 1-2-3-4: step into 1 once it has fired |
| | | Shared Burden (for two) | 3 s | 40 %, split | Come together in the gold circle |
| Last Light | 35 % | Eclipse | 1.6 s each | 15 % | Near him, far from him, near again |
| | | Anchors | 3 s | 25 % | Stand in the gold circle. Alone: one, then the other. For two: both at once, or the whole court pays |
| | | Walking Sun | Runs 10 s alongside other moves | 12 % a pass | Keep ahead of the ray, or behind cover |

**From the design:** Shared Burden's circle stays where the target stood instead of following it, so nobody needs the other
hero's exact position to draw it. If nobody stands in it, everyone pays in full.

## Ash and Ember

`src/raid/ashEmber.ts`. Two bosses, one HP bar, one in the ring at a time. The other stands on the rim, out of reach, and adds a move
now and then. Alone 3,000 HP, for two 7,000. The one in the ring aims at the nearer hero, the one on the rim at the farther.

| Phase | From | Who | Notes |
|---|---|---|---|
| Ash and Ember | 100 % | Ash in the ring, Ember on the rim | A move from the rim every 10-14 s |
| Ember steps in | 66 % | They swap | Every 9-13 s |
| Together | 33 % | They swap every 12 s | Every 9 s. The lava rises from the rim, three steps, then Last stand. The vent opens twice |

| Who | Move | Shown | Costs | What you do |
|---|---|---|---|---|
| Ash | Ground Slam | 1.5 s | 18 % | Back away from the 5 m circle |
| | Charge | 1.5 s | 20 % | Step off the line. Put cover behind you: he stops dead at it and stands open for 2 s |
| | Drag Under | 2 s | 16 % | It pulls you in, and a ring burns far from him. Stay close, then walk away before the next thing |
| | Burning Trail | None | 4 % a second | Puddles where he walked, for 15 s. Plan your route |
| | Cinder Rock (from the rim) | 1.7 s | 12 % | Two rocks, each where you stood |
| Ember | Fan | 1.5 s | 14 % | Five lines. Stand in a gap, or behind cover |
| | Marked | Follows you 2.5 s, then 1 s | 18 %, and a puddle | Carry it onto the one in the ring, and walk out when it stops |
| | Vent Bombs | 1.5 s | 12 % | Pairs either side of you. Stay between them |
| | Lava Wave | 2.5 s | 16 % | A ring grows from the vent. Walk through the gold gap, which turns |
| Both | Tag | 1.5 s | 12 % | Leave the circle where the next one lands |

**Ember backs away.** She wants 9 m. With a hero under 6 m she steps back between her moves, at 2.4 m/s against a hero's 4 or more, so she can always be caught,
above all during a cast, when she stands still (`BossForm.backAt`). She goes round cover, keeps off the floor's edge and off the rising lava, and stands when cornered.

**How it stays within the rules.** A tag is a cast, so both screens swap at one moment. Marked's circle follows its target as a look only:
what counts is its second step, at the spot the brain read. Only the brain's screen moves Ash down his Charge (`BossMove.act`), and it says in
the cast whether he hit cover, so each screen doesn't judge that for itself. The one on the rim is a `HeroFigure` the duel only draws.

**From the design:** Drag Under's second half, "walk out in time", has no zone of its own: it's whatever move comes next. Vent Bombs fall round
the target and not from the vent. Ash's Charge only comes from the ring, so he has Cinder Rock for the rim.

## The Cinder Pit

`src/arenas/cinderpit.ts`: their own room, not in `ARENAS`. Radius 16, a basalt floor in a lava lake, a vent in the middle that stops
nobody, an obsidian lip with five perches for whoever is on the rim. Four tall basalt clusters at 7.5 m, two ridges on the wings, four
low stumps further out. None of it breaks. The floor comes from the caldera's textures and the cover from its props. All first-pass.

## The Sun Court

`src/arenas/suncourt.ts`: the Warden's own room (user, 2026-11-06). It is not in `ARENAS`, so no duel picks it. Radius 16 against a
duel ring's 12, under an eclipse. Six screen walls at 6.5 m and eight columns at 11 m, with the altar in the middle, and both heroes
start on the south side. The floor and rim are drawn in code; the cover and backdrop are the temple's sculpted props (`templeCover`).
The floor is cool and dark on purpose, so orange and gold stand out on it. All first-pass, for the artist to direct.

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

- **A reward rides on the brain's screen.** If that player leaves between a mechanic and its reward, the reward is lost.
- **The bodies' poses were judged on screen only in passing** (a fight each, desktop and phone size). Glow strengths come from the Blender
  file and may need tuning against the game's bloom; Ash's core is the brightest.
- **Ash's model is wider than his body** (1.3 m): his forearms reach about 2.5 m out, and a hit on a forearm counts only where the body is.
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
  boss's own rules. `_raidAsh()` does the same for Ash and Ember, with the tag and the lava. `_raidUpgrades()` checks each upgrade's number and
  each tier's. `_raidPartners(names)` replays each hero's spells and attack as a partner and checks nothing touches this screen's hero or the boss.
- `pipeline/tools/raid-tool.js`: `_raid(heroes, reps, { level, boss })` runs the autopilot and reports clears, time, damage per second
  and which move killed. It can't tell whether the fight is fun.
- `pipeline/tools/online-bot.js`: `_botRoom(hero)` and `_botJoin(hero, code)` play a raid for two in two tabs with bots.
