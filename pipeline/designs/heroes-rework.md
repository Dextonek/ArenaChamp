---
title: The heroes we have, reworked
tags: [heroes, rework, design]
updated: 2026-11-12
---

# The heroes reworked: each one its own rule

## What the user asked (2026-11-12)

> "and also try to rework the herous that we have now amke them unieq or atleast not follow that old rule of spells and make them
> waht ever you want"

The old rule: every hero is four spells on Q W E R, each on its own cooldown, and a passive. Most heroes already have a signature
(`docs/catalog/heroes/README.md`), but it sits beside the four cooldowns. **The rework: each hero's signature becomes the way the
hero is played**, in place of the cooldown mould: a resource instead of cooldowns, spells that are things on the field, a kit that
turns with a clock, an order that matters. The look, the name, the theme and the model of each hero stay.

## Rules for a rework

- One own rule a hero, said in one sentence a player can repeat. It must change what the player thinks about, not only numbers.
- Built in the hero's own files (`src/kits/<theme>.ts`, `src/traits/<theme>.ts`, its spells in `src/spells/targeted/`) through the
  hooks a trait already has (`cooldown`, `canCast`/`blocked`, `castMods`, `afterCast`, `recastAct`, `resource`, `meter`, stacks,
  `tick`, `dealt`, `taken`, `landed`, `aiHold`, `aiGoal`, `enemyGoal`). No engine file unless a wave's one writer is named for it.
- The computer must play it (both computer players: the opponent's and the autopilot), or the simulator's numbers mean nothing.
- Measured: `python pipeline/sim/sim.py hero <Name> --port <own port>` 40 to 60 % against the six benchmark heroes, no errors, every
  spell in use; `--sides both`; then the raid's partner check (`_raidPartners`) and one raid run. Numbers go into its catalog page
  and blurbs; a News item (tag Heroes); the passive's text says the rule.
- The Rust copies (`pipeline/rustfull`, paused) go stale: run nothing there, say so in STATUS.

## The forty, each with its rule

| Hero | Today's signature | The rule it is rebuilt round |
|---|---|---|
| Vesper | Blood price | **No cooldowns: she pays in blood.** Every spell costs health and can be cast again at once; her drain gives it back. Greed kills her |
| Brannoc | Hot Iron | **Heat.** No cooldowns: each spell heats the hammer; hot spells hit harder; at white heat he must Quench or burn |
| Isolde | Deep Winter | **The cold is her ammunition.** Her spells unlock by how chilled the enemy is (one at any time, the next at 2 Chill, 4, 6) and spend it |
| Lyra | Far Sight | **The draw.** Every spell is held: a tap is quick and weak, a full draw is slow and strong. No number is fixed |
| Vitriol | Reaction | **Mixes.** Q W E are reagents; any two in a row brew one of six reactions. She has no spell, only recipes |
| Kaia | Lightning Rods | **The rods are the caster.** Her spells strike from her rods, not from her; with no rod standing she can only plant one |
| Sefu | Pharaoh's Decree | **Decrees.** Each spell is a command the enemy may obey (stand still, do not cast) or break; obeying costs time, breaking costs health |
| Nyx | Umbral Veil | **Two bodies.** Her shadow double never leaves; she trades places with it freely, and her cut comes from whichever is behind the enemy |
| Fenna | Living Garden | **The garden grows.** Her spells only plant and tend; flowers grow through three ages on their own and do the fighting |
| Auriel | Oath of Dawn | **The shield is her purse.** Spells cost shield, not time; it grows back while she is not hit |
| Marin | Turning Tide | **The tide turns by itself**, every six seconds, for both to see; each spell is two spells, in and out. She plans by the clock |
| Zephyr | Following Wind | **Momentum.** Moving fills her wind; every spell spends it; standing still she has nothing |
| Mortis | Ossuary | **Bones are the only resource.** Everything that falls or breaks leaves a pile; every spell spends piles; no cooldowns |
| Ada | Overclock | **The mainspring.** She winds it up (standing), then for a few seconds her spells have no cooldown at all; then it runs down |
| Opaline | Prismatic | **Only bent light burns.** A direct hit does little; each bounce off a surface adds a colour and its harm |
| Sirix | The Swarm | **The swarm is his health and his ammunition.** Sending wasps out strips his armour until they return |
| Cantor | On the Beat | **Only on the beat.** No cooldowns; a spell cast on the beat lands, off it fizzles; a run of clean beats builds the crescendo |
| Oblivion | Deep Gravity | **Mass.** Each hit makes him heavier: his pulls and spells grow, he slows, and at full mass he collapses into the black hole |
| Shiori | Wet Ink | **She writes.** Strokes left on the floor are her fuel; the character they add up to decides what her last spell does |
| Tempo | Echo | **Everything can be cast back.** Any spell replays from where it was three seconds later; her last spell rewinds herself |
| Silvane | Fairest of All | **Her mirrors cast with her.** Alone she is weak; every standing mirror repeats each spell from its own place |
| Bram | Best Friends | **Gerald is the kit.** All four spells are orders to the pillar; away from Gerald he has his fists |
| Hank | Fresh Cut | **Trees are the cooldowns.** Spells spend standing trees; planting is the only thing that takes time |
| Professor Puff | Inflate | **Pressure.** The fuller he is the bigger his spells and the slower he floats; hit at full, he pops |
| Sir Whiskers | Nine Lives | **Lives are his coin.** His strong spells cost a life; at the last life everything is free and he is at his most dangerous |
| Mr. Ledger | On Your Tab | **He never hurts you now.** Everything goes on the tab, the tab grows interest, and he chooses when it falls due |
| Big Yoko | The ring | **Ring-out.** In his ring he cannot be moved; pushing the enemy out of it is his real blow |
| Mum | Silence Is Golden | **What she makes cannot be seen** until it is touched: walls, boxes, the ball. No warning zones, small harm |
| Referee Whistler | By the Book | **Cards.** He declares rules; breaking one earns a yellow card, the second a red: the red is his only heavy blow |
| Madame Cleaver | Today's Special | **Courses.** Her dishes lie on the floor for whoever reaches them; starter, main and sweet eaten in order make the feast |
| Pip | Sign Here | **Deliveries.** Parcels wait at addresses; he arms them by running through them, so his speed and his route are his kit |
| Gus | Wet Floor | **The floor is the weapon.** Wet tiles stay; every spell acts along them |
| Mabel | Dig Site | **Above and below.** Underground she cannot be hit and cannot see; each spell is another spell down there |
| Grandma Ironknit | Keep Warm | **One piece of knitting.** Spells add rows; what she finishes (shawl, net, noose) is chosen by the rows |
| Barry Cloudsley | And Now the Weather | **The forecast.** Three weathers queued for both to see; his spells are whatever the sky is now |
| Bo | Wool Over Your Eyes | **The flock.** His spells are commands to the sheep standing; with none he can only call |
| The Great Zambini | Ta-da! | **Three hats.** He is in one; every spell comes out of any of them; the enemy has to guess |
| Wick | This Way, Please | **Doors are the map.** He and his bolts go through any door to any other; his spells are routes |
| Pim and Pom | Tag Team | (already two kits) **Both on the field:** the one not played follows and copies at half strength |
| Anka | Ashborn | (already her own rule: the ember book) stays |

## Order of work

- **Wave 1 (tonight): the six whose rule is one resource in place of cooldowns:** Vesper, Brannoc, Cantor, Zephyr, Sir Whiskers, Big
  Yoko. They prove the method (a rule in a trait, the computer playing it, the simulator's band) with the least risk.
- **Wave 2:** Isolde, Auriel, Mortis, Hank, Ada, Sirix (a resource that is on the field or on the enemy).
- **Wave 3 and on:** the kits that turn (Marin, Barry, Mabel), then the ones whose spells are things (Kaia, Bram, Silvane, Bo), then
  the rest. Each wave: three heroes a helper, measured, merged.

## Wave 1a (built 2026-11-12): Vesper, Brannoc, Cantor

All three play by their rule now, in their own files, through the trait's hooks; no engine file was touched. The numbers
are from the fight simulator (`python pipeline/sim/sim.py hero <Name> --sides both`, 160 to 190 fights a run; a run
swings by about 7 points, and the same code run twice differed by 6 to 8). Pages: `docs/balance/rework-<hero>-before.html`
and `-after.html`, the two bystanders `rework-bench-before.html` and `-after.html`. Pictures: `docs/heroes/rework-<hero>.jpg`
(`python pipeline/tools/rework-shots.py docs/heroes --port <a running dev server>`).

| Hero | The rule as built | Before | After (both sides) | After (the player's side alone) |
|---|---|---:|---:|---:|
| Vesper | No cooldowns. Each spell costs the **Price** in HP (her bar): 10, +10 with every spell and every Rip, 100 at most, falling 11 a second after 1 s without casting; R twice the Price. She cannot cast what she cannot pay. Spell hits drink back 15% (65% below 45% HP), the Rip half of what its needle cost, the Feast 45 | 46% | 57%; tuned: 47 to 50% | 57%; tuned: 46 to 50% |
| Brannoc | No cooldowns. Q +40, W +30, E +30 **Heat** (his bar, 100); a spell hits at 55% cold to 115% white-hot; Heat cools 10 a second after 2.5 s of rest. At 100 the hammer stays white: -14 HP a second, 35 HP a spell, attacks +15, no slow, root or knock-up, until R Quench (30 + 0.5 a point of Heat, stun 0.75 s from white heat) | 68% | 53% and 59%; tuned: 51% | 34% and 43%; tuned: 54% |
| Cantor | No cooldowns, one spell a beat (1.2 s, a window of 0.25 s each side). On the beat: +9% per step of **Crescendo** (his bar, 0 to 5) and a step more. Off it: a quarter of the power, nothing else, the Crescendo gone. Q and R build; the Chord cast at 5 silences and starts it again; W spends it for 0.25 s of charm a step, E for a 15 shield a step. A charm or silence that cannot take hold (a raid boss) strikes for 36 a step instead | 31% | 50%; tuned: 58% | 36%; tuned: 54% |

(The table's "tuned" numbers are from the section "Wave 1a tuning" below; the rest of this section is the wave as it was built, before it.)

The first target (40 to 60% as the player's side) is met by Vesper only: Brannoc and Cantor sit under it there and inside it
on both sides, because each wins about 60 to 70% as the opponent (see "Found on the way"). No errors and no fight without
a winner in any run. Casts in a fight (Q, W, E, R): Vesper 3.4, 2.6, 4.2, 0.8; Brannoc 4.1, 3.1, 5.3, 1.9; Cantor 13.3, 0.9,
2.7, 1.4. The damage table cannot show Vesper's W (a dash; its two shots count as basic attacks), Brannoc's W (its slam
counts as a basic attack) nor Cantor's W and E (a charm and a shield deal nothing).

### The greedy line of each rule (what a person can do that the careful computer does not)

The computer plays each rule with restraint (`aiHold`), so its win rate says nothing about a player who does not. Each
rule's most greedy line was played by a computer changed for one run (not committed), 96 or 80 fights:

| Hero | The greedy line | Win rate | Against the careful line |
|---|---|---:|---:|
| Vesper | needle, Rip, needle, as fast as they come, whatever the Price | 14% | 57% |
| Brannoc | no breath between spells | 44% | 53 to 59% |
| Cantor | never spend the Crescendo | 40% | 50% |

Two of the three rules were broken by their greedy line as first built, and were changed:

- **Vesper:** with the Rip free of the climb, a refund of half the nominal price, the drink on the Rip too and a top of
  60, the needle-and-Rip loop cost almost nothing and won 90%. Now the Rip raises the Price like any spell and does not
  drink, the refund is half of what the needle really cost, the top is 100 and a spell she cannot pay cannot be cast.
- **Cantor:** with the Crescendo staying at 5 (every chord +60% with a silence), never spending it won 74%. Now the chord
  at 5 is the release: it silences and the Crescendo starts again.

### What differs from the plan, and why

- **"No cooldowns" has two numbers the game server sets.** `server/hub.mjs` drops a slot cast twice inside 0.35 s and a
  second ultimate inside 10 s (it measures arrival, so 10 s exactly could be dropped). Q, W, E carry 0.5 s and every R 11 s.
  For R to be free the hub needs a per-hero gap (not edited: not ours to edit). It also takes at most 100 HP in one
  `spend`, so Vesper's Feast pays its double Price in two payments.
- **The blood and the burn cannot kill.** `payHp` stops at 1 HP (the server's `spend` too). "Greed kills her" is built
  as: she cannot cast what she cannot pay, so a greedy Vesper stands at low health with nothing to cast, and loses.
  "Quench or burn" is: the burn takes him to 1 HP and the next touch kills. A hook that lets a hero's own rule take the
  last HP is missing.
- **Vesper's price climbs.** A flat price with no cooldown is either free or unplayable; the climbing Price is what makes
  "cast again at once" a choice. Hemocurse's cost went 30 -> 20 a spell: against heroes that cast without cooldowns (more
  each wave) 30 was a quarter of her damage. The computer uses Mist Waltz as a getaway now (`escape`), so it is played.
- **Brannoc's R is the Quench alone.** The six-second Molten Core is gone from the game (the VFX tool still plays it): its
  gifts (no slows, stronger attacks) are white heat's now. The old Heat pips on the enemy and the Tempered bonuses are gone
  too: a stun on a hook without a cooldown would lock the enemy down.
- **Cantor fizzles in earnest.** An off-beat cast still goes out (a quarter of the power, rose and not gold) and costs the
  whole Crescendo; "the beat breaks on a hit of 50" is gone, since any spell does that much.

### Found on the way

- **A computer opponent's self-aimed cone goes due north.** `Duel.castSpell` gives a CPU's self-mode cast no aim, so
  `contextFor` works one out from the caster to its own feet: 0. The old Cantor's chord hit a quarter of the time as the
  opponent (he won 1 of 80 there, 45 of 80 on the player's side); it is why STATUS says "the opponent CPU plays him
  badly". His chord now takes his facing in that case (`resoundingChord.ts`). The true fix is one line in `src/duel.ts`
  (pass the foe's facing as `aim` for a self-mode cast), and other QUICK cones (Auriel's First Light, perhaps Hank) will
  have the same fault: Auriel's "76% as the player's side, weak as the opponent" fits.
- **The benchmark moved, through Cantor and not through Brannoc.** Kaia and Lyra against the six, before and after
  (32 fights a cell; three runs after): Lyra 48% -> 43 to 47% (inside the noise; her Brannoc cell 10/32 -> 4/32 to 9/32,
  her Cantor cell 28/32 -> 20/32 to 24/32). Kaia 42% -> 17 to 22%: her Brannoc cell did not move (0/32 before and after),
  her Cantor cell went 32/32 -> 0/32 or 1/32, and her Sirix cell read 15/32, 14/32, 6/32, 6/32 with nothing of Sirix's or
  hers changed. A benchmark Cantor who used to miss was a free win for every hero; now he is a real fight. How much of
  Kaia's fall is the aim alone and how much his new numbers was not measured apart. Every hero's number against the six
  will sit lower for it, the ranged and fragile ones most. Not tuned round.
- **The Brannoc and Cantor pairing is won by whoever the opponent's side is** (15 of 16 each way): the fights end with the
  winner at 20 to 30 HP, and the two computer players are not quite equal. It is most of why each is weaker as the
  player's side than as the opponent.

### The raid (`_raidPartners`, `_raid(names, 3)` against the Sun Warden)

As partners nothing of theirs touches the wrong side (15 checks, none flagged, before and after); no errors in any run.

| Hero | Clears before | Clears after | Damage a second before | after |
|---|---:|---:|---:|---:|
| Vesper | 2/3 | 3/6 | 25 | 22 |
| Brannoc | 0/3 | 0/3 | 21 | 22 |
| Cantor | 3/3 | 1/3 (0/3 and 2/3 in two earlier runs) | 27 | 19 to 20 |

Three fights say little about clears; the damage is the steadier number. Vesper is a little weaker against a boss and
Cantor a quarter weaker: they do not clear as before. Cantor's cause: with the chord aimed for both computer players it
had to come down (60 every 2 to 3 s became 25 a beat) to keep him in the band as the opponent, and the autopilot, busy
dodging, plays only 63% of his beats (81% in a duel). Raising the chord to 27 or 28 would give the raid some back and make
the benchmark Cantor harder still: the user's call.

## Wave 1a tuning (2026-11-12)

The page: `docs/balance/rework-1a-tuning.html` (every pairing before and after; `python pipeline/tools/rework-1a-page.py` writes it
from the simulator's kept runs). Tools made for it: `pipeline/tools/sim-cells.py` (a kept run split by pairing and by side, with
how far ahead the winner ended) and `pipeline/tools/duel-trace.js` (one duel written down cast by cast).

**What the numbers are now** (against the six benchmark heroes, 64 fights a pairing):

| Hero | Both sides | As the player's hero | Pairings past 80 to 20 (of 8: the six, Vesper, Auriel, Lyra) | The greedy line |
|---|---:|---:|---|---:|
| Cantor | 58% (it was 54%) | 54% (38%) | none (five: Kaia 100, Auriel 100, Isolde 91, Oblivion 9, Lyra 19) | 38% |
| Brannoc | 51% (56%) | 54% (31%) | Kaia 91 (two: Kaia 100, Vesper 94) | 25% |
| Vesper | 47 to 50% (53%) | 46 to 50% (55%) | five: Oblivion 5, Kaia 9, Sirix 97, Auriel 92, Lyra 86 (seven) | 0% |

**The numbers changed:** Cantor: Resounding Chord 25 -> 22, a step of Crescendo +12% -> +9%, HP 740 -> 720. Brannoc: Chain Hammer
40 -> 34. Vesper: Lancet 33 -> 30, the Rip 24 -> 22, the Feast 35, 35, 40 -> 18, 18, 24 and 60 -> 45 back, the drink 25% -> 15% and
50% -> 65% Hungry, Hemocurse 20 -> 15 a spell and its Hungry heal 15 -> 20, HP 660 -> 640.

**What was really wrong** (found by reading kept fights and one trace, not by turning numbers):

- **These duels are races with almost no chance in them.** The same casts and hits every fight: a hero 12% ahead at the end wins 32
  of 32. The older heroes miss with skillshots; these three hit with nearly everything. So a pairing's win rate is a step, not a
  slope: tune on how far ahead the winner ends (`sim-cells.py` prints it), not on the win rate, and expect a volatile pairing to
  flip (Vesper against Kaia read 100, 81, 22 and 9% over four small steps).
- **The two computer players do not treat a basic attack alike** (`src/duel.ts`, `src/heroMode.ts`; not edited). On the player's
  side a cast drops a swing in its wind-up (`castNow` calls `attacker.cancel()`); on the opponent's side nothing cancels
  `oppAttack`, and the swing lands during the cast. Brannoc cast into his own swings and lost a third of them on the player's side:
  31% there, 81% as the opponent, and all of Cantor's gap too (0 of 32 and 31 of 32 against Brannoc). His computer now casts as a
  swing lands (`aiHold`, told by `attackMods`). The plain fix is one line, `this.oppAttack.cancel()` in `Duel.castSpell`; every
  hero who casts often will meet this.
- **Brannoc's computer stood and burned.** White-hot under half HP it cast nothing, and it Quenched only with the enemy within
  2.5 m, while the enemy's computer steps back from white heat (`enemyGoal`). Now it drags them back with the chain and after 5 s
  Quenches anyway.
- **Cantor's computer walked to 2.6 m from everyone**, inside every Gravity Slam and the Null Zone (Oblivion won 29 of 32). Once a
  brawler's swing has hit him it keeps 4.3 m.
- **Vesper's computer never threw a needle at a brawler** (the CPU tries R, E, W before Q, and the waltz took her out of Lancet's
  reach each time: 0.2 needles a fight against Brannoc), and **never started the Feast against anyone with a ranged attack** (only
  within 4 m; it is 5.5 m now).
- **Not solved:** Vesper against Oblivion (his Null Zone swallows her bolts and spells for a quarter of the fight, and he pulls her
  in), against Sirix (he has to walk to her), and her other one-sided pairings; Brannoc against Kaia; Cantor against Lyra (she
  out-ranges his whole kit). The first three and the last two went the same way before the rework. Two plays that were tried for
  Vesper and taken out again: a waltz straight after a Rip (no change), and a waltz to make room for the Feast (she waltzed four
  times a fight and never Feasted: 19%).
- **Oblivion's Black Hole** lands on the opponent's Brannoc every fight and on the player's one in five (it is cast from on top of
  him and goes astray). Not ours.

**The roster's view** (the six bystanders against the six, both sides): Kaia 39% (she had fallen to 28%; 50% in the last roster
run), Auriel 57% (33%: the engine's aim fix), Lyra 58% (58%), Isolde 43% (40%), Sirix 52% (60%), Oblivion 62% (50%). Kaia (down 11)
and Oblivion (up 11) moved only because the benchmark changed: listed, not retuned.

**The raid** (`_raid(['Vesper', 'Brannoc', 'Cantor'], 3)`, the Sun Warden): Vesper 2 of 3 and 24 a second, Brannoc 0 of 3 and 21,
Cantor 1 of 3 and 20, then, with the strike (a charm or silence that cannot take hold strikes for 36 a step of Crescendo: a boss
can be neither charmed nor silenced) 3 of 4 and 28. Before the rework he was 3 of 3 and 27.

### Not checked

- No network duel was played: what the other screen shows (the bars, the white ring, a sour chord, the Quench) rests on
  reading the code, not on two browsers.
- No person has played them: whether the beat's window of half a second is kind enough to a thumb on a phone is unknown.

### Left for the lead

- `docs/STATUS.md` is not touched here (one writer). To say there: wave 1a done and not live; the Rust copies of Brannoc
  (`pipeline/rustfull`) and the rough model (`pipeline/rustsim`) are stale, nothing was run there.
- The game's hero page prints "cooldown 0.5 s" for these spells (`src/game/main.ts`, two places): true, but "no cooldown"
  would read better; left alone so two helpers do not edit the same lines.
- The raid's `cooldownMul` upgrades multiply 0.5 s and 11 s: they do next to nothing for these three now.
