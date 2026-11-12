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
