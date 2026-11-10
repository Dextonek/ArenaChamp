---
title: How the heroes hold their weapons
tags: [design, heroes, animation, weapons, research]
updated: 2026-11-10
status: built, second pass against real footage done; not yet played by a person
---

# How the heroes hold their weapons (2026-11-10)

The user: "lets look at all movement animation for everyone and try to correct the weapon that they are holding", then, on
the first fix: "this kinda not good, research how the real human hold the weapons in real life ... and remake it".

## What was wrong

Every hero shares one procedural walk, attack and cast (`src/heroFigure.ts`), and it did not know what a hero holds. Each
weapon is part of the model, fixed to a hand bone, so it did whatever the arm did:

- a staff swung back and forth with the walking arm, its foot sweeping through the floor;
- on a cast or a shot the arm went forward and the staff's top pointed backward (the butt led);
- an upright axe raised overhead ended upside down behind the back;
- every arm hung straight: no bent elbow, no guard, never two hands on a big weapon;
- heroes with the weapon in the left hand (Kaia, Isolde, Vesper) cast with the empty right hand.

Sheet before: `docs/heroes/motion_holds_before.jpg`.

## How people hold the real things

| Weapon | How it is held | Source |
|---|---|---|
| Walking staff | The tip on the ground beside the foot, the elbow bent near a right angle, the forearm about level, the shoulder relaxed. It is lifted and planted as you walk. | [REI: trekking poles and hiking staffs](https://www.rei.com/learn/expert-advice/trekking-poles-hiking-staffs.html) |
| Quarterstaff | Two hands: one near the butt or a quarter up, the other toward the middle; guards with the hands at the waist and the tip up. | [Wikipedia: Quarterstaff](https://en.wikipedia.org/wiki/Quarterstaff), [ARMA: Swetnam's staff](https://www.thearma.org/spotlight/Swetnam400-Staffe-Study-Guide.html) |
| Longsword, low guards | Both hands on the hilt. Pflug: the hilt in front of the hip, the point at the opponent's chest or face. Alber: the hands low in front, the point down in front. | [ARMA: the basic guards](https://thearma.org/essays/StancesIntro.htm), [swordfight.uk: principal guards](https://swordfight.uk/principal-guards-of-the-longsword/) |
| Longsword, high guard | Vom Tag: the sword high, at the shoulder or over the head, the point up and back; cuts come down from it. | same |
| One-handed sword | The elbow bent and tucked in (a popped-out elbow is a fault), the body more side-on. | [swordfight.uk: the guards](https://swordfight.uk/?p=1225) |
| Rapier | Guards are named by the arm, not the blade; the elbow slightly bent, the blade in line with the forearm, the point at the opponent. | [The en garde position](https://dkp1500.github.io/website-darrenpollock/engarde.html), [Long Edge Fencing wiki](https://wiki.longedgefencing.com/lef_stance_and_postures) |
| Poleaxe, long axe, hammer | Two hands, the haft held in thirds: the top hand nearest the head, the lower hand near the butt; the grip slides. | [Le Jeu de la Hache (translation)](https://www.hroarr.com/manuals/01-polearms/Jeu%20de%20la%20Hache/Smith-Jason-Le-Jeu-de-la-Hache-translation.pdf), [ARMA forum: pole arm guards](https://thearma.org/forum/viewtopic.php?p=4739) |

The sources differ in detail between masters; the table keeps what they agree on.

## What the game does now

Nothing is set per hero. When a model loads, `Hero.measureHeld` reads from the mesh what each hand holds (the vertices
that follow only that hand bone and lie beyond the hand): how long, which way it points, how far it reaches the other way.
`holdOf` in `src/heroFigure.ts` sorts it into a kind, and `HeroFigure.carry` holds it the way the table says:

| Kind | Which | Carried | Walking | Attack and cast |
|---|---|---|---|---|
| `staff` | long and upright with its foot near the floor: Sefu, Kaia, Isolde, Fenna, Mortis, Shiori, Tempo, Barry, Bo, Gus, Mr. Ledger, Hank's long axe | like a walking staff: the elbow bent to about a right angle, the tip on the ground beside the foot | lifted, swung forward and planted with the opposite foot | the arm reaches less far and the staff's head tips toward the target |
| `up`, melee | a sword, a rapier, a mallet, needles, a cleaver held up: Sir Whiskers, Pim, Bram, Grandma, Madame Cleaver | a guard: the hilt in front of the hip, the elbow bent and in, the point up and forward at the enemy | the guard, with a small bob | cocked back on the wind-up, brought down on the strike |
| `up`, ranged | a wand, a scepter, a mirror, a sling: Zambini, Vesper, Silvane, Opaline, Pom | up in front as modelled, the elbow bent | the same | it tips toward the target |
| `hang`, one hand | a blade or a tool below the hand: Zephyr, Auriel, Wick's keys, Mabel's claws | low at the side (a low guard), as modelled | it follows the arm, which swings less | it follows the arm, so it extends the arm on a strike |
| two hands | a hero whose attack is an overhead smash or cleave and whose other hand is empty: Brannoc, Oblivion, Hank, Bram | both hands on it. A hammer or a greatsword low in front, the head down and forward; a mallet in the guard; a long axe upright like a staff. The second hand sits lower on a long haft, toward a hammer's head, by a sword's pommel | the same | both arms raise it and bring it down |

- **The weapon hand** is the right one unless only the left holds something; then the cast and attack poses are mirrored.
- **One weapon:** that arm does every melee swing. Two alike or bare hands: the arms alternate, as before.
- **A staff is slid down through the fist at load** (`Hero.slideItem`, by 0.4 of the arm's length): the models have it in a
  hanging hand with its foot on the floor, and a bent elbow lifts the hand. The geometry is shared, so it is done once per model.
- **Arms:** a two-bone reach (`Hero.reachHand`) bends shoulder and elbow to put the hand at a point, the elbow back, down
  and out. **Hands:** `Hero.steadyHand` turns the hand so the item points where it should, whatever the arm does.
- The hold gives way smoothly as a cast or an attack takes the arm (`free` in `carry`), and comes back after.
- **The hero select's turntable** (`src/game/heroPreview.ts`) is now the same figure as in a fight, at rest: it breathes
  and holds its things the same way.

Sheets after: `docs/heroes/motion_holds_after.jpg` (idle, walk, cast, attack), `docs/heroes/motion_holds_closeup.jpg`.

## Frame by frame against real footage (second pass, 2026-11-10)

The user, on the holds above: "still it is not good ... lets compare frame by frame with real movement of weapons from
people". Real clips were cut into frame strips in the browser and the game's motion was filmed at the same moments from
the same side (`pipeline/tools/motion-strip.js`: `_motionStrip(hero, 'attack' | 'walk' | 'cast:<style>')`).

| Real footage | What its frames show |
|---|---|
| [A longsword cut from the shoulder, four times slowed](https://www.youtube.com/watch?v=IWiWCkM7HN8), side view | Guard at the shoulder, the point back and up. The hands start forward while the blade still points back; the blade comes over the top as the arms straighten; at the hit the arms are straight out at shoulder height with the blade level, in line with them. The body leans far in and the back leg drives a long step. Then the blade is carried on and the feet pass. |
| [Walking with one hiking pole](https://www.youtube.com/watch?v=o-88ARHLUMU), front view | The pole is planted ahead about every second step, leans back as it lands and forward as he passes it, then is lifted and swung ahead. The pole hand moves little; the free arm swings wide. |
| [Cut mechanics, measured at 100 frames a second](https://science-and-fiction.org/swordfighting/cuts.html) | A cut is mostly the sword turning about a point in the body. The body starts first and the blade barely moves; then it speeds up over 30 to 40 degrees and lands at its fastest; then it is stopped. A quick cut takes 0.25 to 0.35 s, a full one with a step 0.6 s or more. |

What the game's attack did against those frames: the wind-up lifted straight arms like a stick, the hit snapped back to
the starting pose in one frame with no reach, the body stood upright and still, and nothing followed the hit.

**Now a weapon's strike follows the real phases** (`STRIKES` and `carry` in `src/heroFigure.ts`):

1. **Draw back** (the first 45% of the wind-up): the weapon goes to the shoulder with its point back, the body turns away.
2. **Drive in** (the rest of the wind-up, slow off the mark and fastest as it lands): the hand travels from the shoulder
   to full reach, the weapon comes over the top, the body turns in, leans and steps.
3. **The hit** lands with the arm straight and the weapon level, in line with it.
4. **Carry through and recover** (0.42 s, the game's own pulse of 0.18 s was too short for a body): the weapon goes on
   past, then comes back to the guard.

| Strike | Who | From real |
|---|---|---|
| `cut` from the shoulder | Oblivion, Hank, Pim, any one held-up blade | the longsword clip |
| `smash` from overhead | Brannoc, Bram | the same phases with the hands over the head, down into the ground in front |
| `thrust` | Sir Whiskers's rapier | a fencer's lunge: the hand before the foot, the arm straight, the point on the target the whole way |
| `sweep`, level across | Zephyr, Gus | the same phases turned on their side |

Bare hands and claws (Big Yoko, Mabel, Sirix, Nyx) keep the old alternating swings. A staff's walk swings and leans more,
after the pole clip. Sheets: `docs/heroes/motion_strikes_after.jpg` (the game's strikes, 16 frames each). The sheets with
frames of the real clips are not in the repository (they are other people's footage); the links above are the sources.

Not matched to footage: the thrust, the smash and the sweep were built from the cut's phases and from how those are
described, not from clips of their own; casts were not compared at all.

## An animator's clips, replayed (third pass, 2026-11-10)

The user, after the second pass: "Or just find some free asset for this and replicate it", then "Try it". Standing,
walking, running, the basic attacks and four cast styles are no longer poses built here. They are clips from the
**KayKit Character Animations** pack by Kay Lousberg (CC0, free for any use; https://kaylousberg.itch.io/kaykit-character-animations),
replayed on the heroes' own rig. The four clip files used and the licence are in `pipeline/assets/kaykit/`.

**How the motion is copied.** The pack's rig and ours do not share bones or proportions, so bone rotations cannot be
copied. `pipeline/tools/bake-motion.html` plays each clip on the pack's own figure and writes, 30 times a second, what
any humanoid can follow, in the character's own frame: where the hips are from where they rest (in leg lengths), how
the hips, chest and head are turned from rest, which way each upper arm, forearm, thigh and shin points, how each foot
is turned, and which way the item in each hand points (`src/motion/kaykit.json`, 18 clips, read by
`src/motion/clips.ts`). `HeroFigure.replay` (`src/heroFigure.ts`) puts those on our bones with `Hero.turnBone`,
`Hero.pointBone` and `Hero.steadyHand`.

**Which clip plays when** (`attackClip`, `CAST_CLIP` and the stance in `follow`):

| The hero | Stands | Moves | Basic attack |
|---|---|---|---|
| One weapon held up (sword, wand, scepter, mirror) | `Idle_A` | `Walking_A` and `Running_A` mixed | `Melee_1H_Attack_Chop` and `Slice_Diagonal` in turn; `Stab` for Sir Whiskers; `Slice_Horizontal` for a sweep; ranged: `Ranged_Magic_Shoot` |
| Two-handed weapon (Hank, Oblivion, Brannoc, Bram) | `Melee_2H_Idle` | the same legs; the arms stay in `Melee_2H_Idle` | `Melee_2H_Attack_Chop` or `Slice` |
| Bare hands, claws, two alike (Big Yoko, Nyx, Zephyr, Sirix, Mabel) | `Idle_A` with 60% of `Melee_Unarmed_Idle` over it | walk and run | `Melee_Unarmed_Attack_Punch_A`, left and right in turn (Zephyr sweeps: `Melee_1H_Attack_Slice_Horizontal`) |
| Tall staff in one hand | the body from `Idle_A`; the staff arm keeps the walking-staff carry above | the same; the staff is planted with the opposite foot | `Ranged_Magic_Shoot`, the staff tipping 60% of the way (Gus sweeps his broom: `Melee_2H_Attack_Slice`) |

Casts: `thrust` and `point` play `Ranged_Magic_Shoot`, `raise` plays `Ranged_Magic_Raise`, `channel` loops
`Ranged_Magic_Spellcasting`. The others (`slam`, `burst`, `lunge`, `swing`) are still the hand-built poses.

**Fitted to the game, not changed.** The game says when a blow lands, so a clip is played against that moment: up to
0.5 s of it before its own hit runs through the wind-up (never faster than 1.8 times its own speed: a quick attacker
starts later in the clip), up to 0.6 s after it through a 0.42 s recovery. The walk and the run each carry a body at
their own speed (1.6 and 6.2 leg lengths a second): the two are mixed so that the mix goes at the hero's speed on the
hero's own legs, and the cycle advances with that, so a short-legged hero runs where a long-legged one jogs. An
attack clip is entered part-way, where its figure has already stepped back for the blow (0.4 leg lengths in the
two-handed chop): the hero starts from where it stands and is all the way into the clip's lunge as the hit lands. A
hero that walks off while its blow recovers gets its legs back from the walk at once.

**Where the copy is not the clip, on purpose:**
- A two-handed weapon's second hand. The pack's two arms meet on its own figure's weapon; with our longer arms the same
  arm angles leave the second hand up to 0.8 m off ours. So the second hand is put on the weapon (the nearest place
  along a haft, next to the first hand on a hilt), and both hands come in when it cannot reach.
- The fist guard at 60%. It was drawn for a figure with short arms and legs; all of it on a tall hero is a deep lunge
  with the arms held wide.
- A tall staff (the pack has none) and what hangs from a hand (a lantern, a bucket) keep the holds described above.
- Under a long robe the legs swing 45% less, or the robe tears open.
- A backpedal and a side-step are still the walk built here: the four files taken from the pack have none.
- The chest rocking on a start and a stop, the lean into a turn, the slow look round and the fidgets are added on top.

**Measured, not eyeballed** (`pipeline/tools/motion-check.js`): through the basic attack of each of the 39 heroes, every
limb the clip drives is within 3 degrees of the clip at the same moment (most within 1). The exceptions are the ones
listed above: the four two-handers' second arm, and their weapon arm by up to 75 degrees where both hands come in. A two-hander's second hand stays within 0.13 m of the weapon through a whole attack and on it standing
and running. Side by side with the pack's own figure: `docs/heroes/motion_kaykit_chop.jpg`, `_slice.jpg`, `_stab.jpg`,
`_run.jpg`, `_stand.jpg`.

**Not done:** hit reactions and deaths (the pack has `Hit_A`, `Hit_B`, `Death_A`, `Death_B`; the game still flinches on
a spring), the four hand-built cast styles, a backpedal and strafes (`Rig_Medium_MovementAdvanced.glb` in the pack has
them), turning on the spot (the feet pivot). A foot on the ground still drifts where the walk and the run are mixed:
the pack's walk is a slow stroll and its run a sprint, and the heroes move at a speed between the two. Measured at
4 m/s: a planted foot drifts 37% of the way the hero goes for Hank (legs 1.09 m, 44% run), 10% for Sir Whiskers (legs
0.75 m, 80% run); at 2 m/s, where it is nearly all the pack's stroll, 67% and 39% (the stroll itself plants a foot fast,
then drags it).

Cost: `HeroFigure.follow` takes about 0.27 ms a frame for one hero on the development machine (up to five clip samples
a frame: stance, guard, walk, run, attack).

### Legs fitted to the hero (fourth pass, 2026-11-10)

The user saw folded legs on the Heroes stand ("some of the champ has weird legs": Isolde, Brannoc). The pack's figure
has a long thigh and a short shin (0.227 and 0.149 m) and stands with its knees bent 12° even at rest; our heroes' thigh
and shin are about equal. Copying the clip's thigh and shin directions put the foot about 0.12 leg lengths behind the
hip, with the knee pushed forward, and the idle bent our knees 31-56°.

Now standing, walking and running fit the legs (`fitLeg`): the foot goes where the clip puts it from the hip, in leg
lengths and measured from the pack figure's own rest reach, and the knee bends as much as this hero's thigh and shin
need, the way the clip's knee points. Attacks and casts keep the clip's own legs. On the Heroes stand (`atEase`, set by
`HeroPreview`) every hero stands in the plain idle with 35% of its crouch (hips and knees alike, so the feet stay on the
stand), no fist guard, and a two-handed weapon keeps only its idle's arms: knees 16-22°, ankles within 2% of a leg
length of the floor. In a fight the stances keep their depth (knees 28-56°, the fist guard deepest).

Walking at 4 m/s, a planted foot drifts less: Sefu 42 → 33%, Isolde 46 → 33%, Brannoc 28 → 20%, Hank 36 → 28%.
`motion-check.js` now reports the fitted thighs and shins as off the clip; that is by design.

### Hank's axe held low (2026-11-10)

The user drew it: one bit, on a haft held by its end, low at the side, the head out in front. The model's axe was
rebuilt that way (`blender/heroes/hank_axe.py`; on this computer `patch_hank_axe.py` swapped it into the exported model,
since the figure build's helper modules are not in the repo). A new hold, `low` (`heroFigure.ts`): a long item held
level by its end (`len` ≥ 0.9 m, `back` < 0.25 m, neither up nor down; only Hank's axe today). Like a staff its arm is
the carry's, not the stance's: hanging a little out and forward, swinging a little with the walk, the axe keeping its
modelled line. It is never two-handed, and the attack is the one-handed chop (`Melee_1H_Attack_Chop`).

### Arms fitted to the body, standing (2026-11-10)

On the Heroes stand (user: "look at all heroes spotlight and make it be correct") nearly every hero held its arms out
stiffly, a mannequin's A. The pack's figure is wide and round, so its idle hangs the upper arms about 40° out from its
sides; our heroes were modelled with them 9-15° out (Big Yoko 34°, Mabel 28°, Professor Puff 23° for their bulk). The
idle now turns each hanging arm in by the difference (`fitArm`, `Hero.armOut` measured from the model at load), upper
arm and forearm together, so it keeps the clip's small motion. The walk and the run are left as the animator made them:
they swing the arms wide and far back on purpose, and that walk was accepted.

### A new standing clip from a figure like ours (2026-11-10)

The user, after the arm fixes: "still no good, let's use a different approach", and chose a new pack. Standing now
replays Quaternius' Universal Animation Library idle (`Idle_Loop`; a realistic mannequin, CC0), baked by
`pipeline/tools/bake-ual.js`. Its thigh and shin are about equal and its arms hang 17° out, like our heroes, so the fits
do almost nothing. The rest of the motion is still KayKit's. Details: docs/knowledge/retargeting-arms.md.

### Arms kept out of the body (2026-11-10)

The user: "still broken, the arms are in the body; go and learn on the internet how to rig them and write it down". The
research and the method are in [retargeting-arms.md](../../docs/knowledge/retargeting-arms.md): each hero's body outline
is measured from its mesh at load (`Hero.body`), and every frame an arm whose forearm, wrist or fingers are inside it
is swung out from the shoulder by the least angle that clears it (`HeroFigure.clearBody`), off during attacks, casts
and two-handed grips. Vesper's, Silvane's, Professor Puff's and Madame Cleaver's hands no longer sink into skirts and coats.

### Each hero against its design (2026-11-10)

The user asked to look at each hero deeply, as with Sirix's wings. A sheet of all 39 (portrait beside the model from
four sides) against each hero's design text (`docs/catalog/heroes/*.md`, "Look") found, fixed in the figure code:
Brannoc's hammer ("hanging from the right hand") and Oblivion's greatsword ("held low in the right hand") were lifted
into the two-handed carry on the Heroes stand; there they now hang (`twoHanded`; fights keep the two-handed carry).
Grandma Ironknit's needles are "held out like a duellist": she is in `DUELLISTS`, on guard like a fighter. Shiori's
brush reaches 0.88 m below her hand and sank into her robe: a held-up item that reaches well below the hand is tipped
out 0.3 rad (to the side the hand hangs on; Brannoc, Oblivion and Shiori are modelled with the right hand on +x).
Checked against the design and left: Gus's sweeping staff is head-up by design; Mum's ribbon and Zephyr's scarf are
modelled flying.

### Items held up, while standing and walking (2026-11-10)

The user asked for the heroes holding their weapon the wrong way. A sheet of all 39 (standing, walking, the attack)
found one cause behind ten of them: the stance, walk and run clips are a figure with empty hands, and the direction its
hand gives an item in the idle is level and straight ahead. Every `up` item was turned to it, so Vesper's scepter,
Zambini's and Opaline's wands, Silvane's mirror, Madame Cleaver's cleaver and Grandma Ironknit's needles pointed ahead
at hip height, and Sir Whiskers' and Pim and Pom's blades too. Now in those three clips an `up` item stays as modelled
for a caster and in the guard (point raised toward the enemy's face) for a fighter; casts and attacks keep the clip's aim.

## Checked, and not

- Checked on the tool page with the pose sheet (`pipeline/tools/pose-sheet.js`): all 39 heroes idle, walking, in a thrust
  cast and in the basic attack; twelve AI fights of 10 s with no error; the Play screen's turntable with Sefu and Hank;
  type check and build.
- Not checked: a person playing; the game camera in a real match for each hero; the other cast styles on every hero
  (slam, burst, raise, lunge, channel were seen only on a few); a phone; online (the poses are drawn on each screen from
  the same inputs, nothing is sent).
- Known: the dev sheet page (`hero-sheet.html`) shows models unposed, so a staff stands a hand lower there than in the game.
  Zephyr and Auriel keep their blade low at the side in one hand, as modelled.
