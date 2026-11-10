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

## Checked, and not

- Checked on the tool page with the pose sheet (`pipeline/tools/pose-sheet.js`): all 39 heroes idle, walking, in a thrust
  cast and in the basic attack; twelve AI fights of 10 s with no error; the Play screen's turntable with Sefu and Hank;
  type check and build.
- Not checked: a person playing; the game camera in a real match for each hero; the other cast styles on every hero
  (slam, burst, raise, lunge, channel were seen only on a few); a phone; online (the poses are drawn on each screen from
  the same inputs, nothing is sent).
- Known: the dev sheet page (`hero-sheet.html`) shows models unposed, so a staff stands a hand lower there than in the game.
  Zephyr and Auriel keep their blade low at the side in one hand, as modelled.
