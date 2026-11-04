---
title: Referee Whistler kit
tags: [design, heroes, kits, referee]
updated: 2026-11-04
---

# Referee Whistler (theme `referee`)

## v5 (2026-11-04)

Controller, ranged. 620 HP, 4.0 m/s, attack 6 m, 9 per 0.9 s. Accent `#f2f2f2`, foil `#1a1a1a`. Numbers from
[new-heroes-kits.md](new-heroes-kits.md) section 14. Stern, not silly: the funny part is how serious he is.

| Key | Spell | CD | Numbers (all in `src/traits/referee.ts`) |
|---|---|---:|---|
| P | By the Book | | Rules show over the enemy's head (`enemyLabel`). A broken rule is a yellow card; two yellows are a red: 60 and silenced 1.5 s, yellows reset to none. Cards last the round |
| Q | Whistle Blast | 3.5 | Ring-of-sound bolt, 8 m, 22 m/s, 0.3 s wind-up, radius 0.4: 50. Reaches 6 m at 0.57 s |
| W | No Running | 9 | Self circle 7 m, lands 0.5 s, sight: NO RUNNING 3 s (no dashes, blinks or leaps) |
| E | No Casting | 13 | Same ring: NO CASTING 2 s. Casting anyway is never blocked, it is a yellow |
| R | Show the Card | 24 | Ground circle radius 1.2 at the aim (9 m), lands 0.6 s, sight: a yellow now and HANDS OFF 3 s (hit him: another yellow) |

## Where each rule runs (two screens)

- Rules are stacks on the enemy (`norun`, `nocast`, `hands`, hidden pips), added in `dealt` from W/E/R (hit damage 1, set to 0). They
  live on the screen that decides the enemy's hits and reach Whistler's screen through `stacksChanged`; both read them in `enemyLabel`.
- Cards are decided only on that screen (`victimTick`, `dealt`). The book (`refereeBooks`, per figure) holds yellow, reds, words; the
  deciding screen tells his own client with `noteOwner('cards' | 'word')` (`peerNote`). Both draw them with `marks`: a yellow card in
  front and up to three red cards behind it hover at the left of the enemy's head, bobbing, all round. RED CARD / YELLOW CARD words and
  a whistle ring (red only) pop over them for 1.6 s. A new round (the clock goes back) clears the book.
- NO CASTING: `enemyCast` (both screens) counts casts in the book; `victimTick` cards a new cast while `nocast` runs. The cast goes on.
- NO RUNNING: the trait cannot read the enemy's `HeroSpell.dash`, so `victimTick` watches the enemy's real position: 2 m in 0.2 s within
  1.3 s of a cast while the rule runs is a dash, blink or leap.
- HANDS OFF: a hit on Whistler is decided on his own client, so `taken` counts it into `show('hit', n)` while `hands` runs; the deciding
  screen reads `own('hit')` in `victimTick` and cards (the same route as Mr. Ledger's payments).
- Each rule ends with the card it gave: one rule is at most one card.
- The red is `t.hitEnemy` (a 'trait' hit that no hook of his answers).

## Effects

`src/effects/parts/referee.ts`: `SoundRings` (pooled flat or standing rings), `CardFlight` (cards flipping end over end), `GroundSign`
(runner, wand and open-hand prohibition signs), `PointingArm`, `buildWhistle`, `cardLook` / `wordLook` / `ringLook` (marks). Whites stay
under a base of 0.72.

- Whistle Blast: whistle rises to his lips; the bolt is a pulsing fat hoop with a smaller one inside, a train of thin rings behind it,
  three rings bursting out of the target and a dark floor ring.
- No Running / No Casting (`RuleWhistle` in `noRunning.ts`): the ring rushes out along the floor to 7 m with a dark one behind and an
  echo; at 0.5 s a crossed-out runner (or wand) stamps down under each enemy hit.
- Show the Card: a big sleeved arm swings up and points, a dashed line runs along the floor to the circle, a yellow card is thrown and
  flips to the spot, the finger jabs at 0.6 s with one impact frame, a ring of sound and a HANDS OFF sign.

## The CPU (`aiHold`)

Q: as usual (a skillshot at the enemy in reach). W and E: only with the enemy within 7 m and no rule running. R: only with the enemy
within 9 m (and then by the CPU's usual ultimate rule).
