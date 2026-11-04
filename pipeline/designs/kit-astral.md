# Astral kit: Lyra, the Star Archer (v5, 2026-11-04)

## v5 (2026-11-04)
Source: `pipeline/designs/kits-v5.md`, "Lyra". Changes from v4:
- **Meteor Mark** can be walked out of: the spot still fixes at 1.5 s, the strike lands 0.9 s later (2.4 s, was 2.0 s), radius 1.8 m (was 2.2). The telegraph, closing ring and meteor flight follow the new times; the effect ends at 4.1 s.
- **Pinning Arrow** flies slower: wind-up 0.3 s (was 0.22), bolt 24 m/s (was 30), so it reaches 6 m at about 0.55 s and can be sidestepped. The telegraph arms from the cast to the release.
- **Far Sight** gains a refund: a full-draw Starfall Arrow that hits takes 3 s off Pinning Arrow (once per cast). `castMods` notes the full draw in `t.mem`, `landed` (her own client, so it works online) lowers the cooldown.

(The sections below are the v4 text; the numbers above win.)

Source: `pipeline/designs/kits-v4.md`, "Lyra". The v3 kit (Starshot, Constellation Snare, Orbit Veil, Celestial Hunt) is
replaced entirely. Read `kit-common.md` for files, timing and look lessons.

**Marksman, 550 HP, ranged attack (range 8.5, 13 damage, every 1.4 s, speed 4.0).** Verb: *the farther she is, the
deadlier*. Category `hero: astral`; parts `src/effects/parts/astral.ts`; kit `src/kits/astral.ts`; rules
`src/traits/astral.ts`.

## Passive: Far Sight
Every hit of hers (spell or basic attack) deals +0% within 4 m, rising in a straight line to +30% at 10 m or more
(`farSight(d)`, distance from her figure to the victim at the hit, in the trait's `dealt` hook). The passive badge shows
the current bonus against the enemy. No twist: the four spells need no second rule.

| Key | Spell | Type | Numbers | Flags |
|---|---|---|---|---|
| Q | Starfall Arrow | HOLD, SHOT | cd 4. Hold up to 1 s: range 9 to 14 m, damage 29 to 58, full draw pierces. | `aim: 'line'` |
| W | Twin Stars | SELF | cd 14. 5 s: basic attacks echo at 50%; +20% speed. | `buff` (haste 0.2, 5 s) |
| E | Pinning Arrow | SHOT | cd 9. 9 m, 35. Within 1.5 m of a wall or pillar: root 1.5 s; else slow 1.5 s (x0.6 speed). | `aim: 'line'`, `cc` |
| R | Meteor Mark | TGT, delayed | cd 24. 14 m. Follows 1.5 s, fixes, 0.5 s later 2.2 m strike: 120 + 25% of her damage on the marked enemy. | none |

Cooldowns are not in the design; they are first guesses for the AI duels (4 / 14 / 9 / 24).

## Signature shape
Constellations: four-point stars joined by thin gold lines that draw themselves, then snap and fall. Palette
`ASTRAL` / `ASTRAL_CSS` (starlight core, gold hot, deep indigo body, cyan accent for 2-3 frames at hits, dark, parchment
foil for the chart rings). Every effect follows this: anticipation (bow, nock star, hanging star), a punchy hit (star
pop, impact frame at the big ones), an aftermath (lines snap, stars fall).

## Q · Starfall Arrow (`starfallArrow.ts`, label `starfall arrow`, `ground`, radius 1)
- **Hold:** `Trait.hold {slot 0, 1 s}`. `castMods` writes `lyraDraws` (keyed by her figure) and returns `power = 0.5 +
  0.5 x charge`; the effect's base damage is 58, so 29 to 58 falls out. At full charge she says FULL DRAW.
- **The effect reads the charge** from `lyraDraws` in `cast()` (then deletes the entry): range `9 + 5 x charge`, bow size,
  arrow size and trail, pierce at charge 1.
- 0 to 0.3: a gold crescent bow and string draw on, a nock star swells. 0.3: the arrow leaves (`ctx.projectile`, 26 m/s,
  radius 0.4 to 0.5). Stars drop onto the line every 2 m behind it; once it is gone the lines join them, hold 0.45 s, snap
  and the stars fall. A hit pops a star (cyan edge); a full draw adds an impact frame and a ground ring.
- Telegraph: a line, caster to range, armed at 0.3 s until the flight ends. Clean by about 3 s.

## W · Twin Stars (`twinStars.ts`, label `twin stars`, `self`, radius 9)
- `afterCast(slot 1)` sets `mem.twinUntil = time + 5`; `attackEcho` returns 0.5 while it holds. Haste is the kit's `buff`
  (synced like any buff), not `t.buff`.
- Look only: a parchment chart under her and a refraction ring; two stars spiral out of her hands and orbit her chest,
  joined by a turning gold line that flares every 1.4 s; small stars are left behind her feet while she moves; the orbit
  fades over the last 0.45 s. Everything follows her live position.
- Self radius 9 so the duel AI casts it at attack range (radius minus 0.6 = 8.4).

## E · Pinning Arrow (`pinningArrow.ts`, label `pinning arrow`, `ground`, radius 1)
- A nock flare, then at 0.22 s a thin fast arrow (30 m/s, 9 m). The bolt's hit options carry a getter for `status`: at
  the hit it measures the enemy's live position (the nearest of the cast's targets to the bolt, else a point just ahead
  of it) against `ctx.obstacles()`; surface distance (centre-segment distance minus the obstacle's radius) at most 1.5:
  root 1.5 s, else slow 1.5 s. One hit, one damage number.
- Pinned: a star where the arrow sticks in the wall, a gold line from the enemy to it, a chart locked round their feet for
  the root. Slowed: a chart ring turns at their feet and stars hang behind them. Both snap and fall at 1.5 s.
- Telegraph: a line, armed at 0.22 s.

## R · Meteor Mark (`meteorMark.ts`, label `meteor mark`, `enemy`)
- 0 to 0.35: a star arrow climbs from her hand to a point 12 m up, 4 m to the side of the enemy. A four-point star hangs
  there, tethered to them by a line; a reticle chart turns under their feet. They are tracked smoothly for 1.5 s; the star
  swells with the tally.
- 1.5: **fix.** The spot is the enemy's position at that instant. The reticle collapses, a great chart draws on the spot,
  a ring closes on its centre, the circle telegraph (2.2 m) starts, and the star falls as a meteor (a star arrow with an
  8 m tail and a big head) from where it hung.
- 2.0: **strike.** `ctx.hit(target, { damage: 120 + 25% x tally, projectile: true })` if the target's live position is within
  2.2 m of the spot. The fixed spot is decided late, so a static telegraph cannot gate it (hence `projectile`). Impact
  frame (light, dark), a whiteout blink, a crater with a gold rim, a refraction ring, a blast star, stars thrown outward, a
  constellation of eight spokes that holds 0.55 s, snaps and falls. Shake 0.95. Clean by 3.7 s.
- **Tally:** `lyraMarks` (a WeakMap keyed by her figure, as `bloodBonds`). The effect opens it at `play()` and closes it
  just before the strike; the trait's `dealt` adds each hit on the marked figure (after Far Sight). Her `tick` sets
  `tracked`.
- `telegraphs()` returns nothing until the spot is fixed, so the cast roots her only for the default 0.4 s.

## Online (docs/architecture/multiplayer.md)
- Skillshots (Q, E) fly on the victim's screen, where the hit is decided; the status of E is decided there with the same
  walls. The dealer's screen draws only the bow or the nock.
- Q's charge lives in a map only her own screen's trait fills, so the other screen flies the **full draw** (range 14,
  pierce); the damage is still right (it travels as `mods.power`). The hold's charge reaches the effect nowhere else.
- W: haste is a synced buff; the echo is folded into the one attack message as `power x 1.5`, with no second arrow drawn.
- R: where the trait does not track (`tracked` false) the strike is a flat 120; the hit is decided on the victim's
  screen by the live position against the fixed spot.
- Far Sight runs in the `dealt` hook of whichever screen resolves the hit, with the figures' positions there.

## AI hints
- Q: the duel AI casts a hold spell at full charge (range 14).
- W: self, radius 9: cast when the enemy is within 8.4 m (attack range).
- E: `cc`, so the AI casts it first; reach 9.
- R: only under 55% HP or after 20 s.
- Counterplay the AI should learn (rules for later): stay off walls against E, stay close against Far Sight.

## Balance pass (2026-11-03)
After a 7-of-24 AI tournament: Q full draw 70 to 85 (min about 42), W 4 s to 5 s and echo 0.5 to 0.6, E 30 to 40, R base 120 to 150 (tally share stays 25%). Cooldowns unchanged.

Pass 2 (17 of 24 wins, too strong): Q 85 to 78 (min 39), echo 0.6 to 0.5 (W stays 5 s), E 40 to 35, R base 150 to 135 (flat fallback equals the base).

Pass 3 (tuning, 2026-11-04): Q full draw 78 to 58 (min 29), R base 135 to 120. Attack 13 to 12, HP 550 to 520.
