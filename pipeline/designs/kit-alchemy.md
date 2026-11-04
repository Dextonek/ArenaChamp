# Alchemy kit: Vitriol, the Plague Alchemist (v5, 2026-11-04; was Vex)

## v5 (2026-11-04)
Source: `pipeline/designs/kits-v5.md`, "Vitriol". **Renamed from Vex to Vitriol** (the theme, files and category stay `alchemy`; `traits/index.ts` and `heroes.ts` follow the rename). Changes from v4:
- **Reagents are stacks on the enemy** (`t.addStacks('toxin' | 'fire' | 'acid', 1, 4, 1)`, read with `t.stacks`, cleared with `t.clearStacks`), so both players see the pips and they sync online. Reactions still happen only in `dealt`, once per cast.
- **Corrode** 35% more damage for 3 s (was 20%). Combust stays 55.
- **Concussion** is a 2.5 m push (`shapeMove(..., true, ...)` from `traits/tide.ts`), the same on a player and the CPU, with the 0.5 s silence.
- **Refund:** a reaction takes 2 s off the spell that took no part (`t.noteOwner('react', slot)`, `peerNote` lowers the cooldown on her own client). Not on the Homunculus burst.
- **Toxin Dart:** wind-up 0.25 s, bolt 20 m/s (reaches 6 m at about 0.55 s).
- **Homunculus** climbs out at her feet, not at the aim spot, then walks at the enemy at 4 m/s as before.

(The sections below are the v4 text; the numbers above win. Read "Vex" below as Vitriol.)

## Role
**Mage (ranged attack), 560 HP.** She mixes reagents on the enemy, and two different ones react. Designed fresh in
`kits-v4.md`; the old kit (Volatile Flask, Caustic Pool, Volatile Leap, Elixir of Unmaking, the toxin stacks) is gone.
Read `kit-common.md` first (files, timing, look lessons).

- **Hero:** a masked alchemist in a coat of vials. **Category:** `hero: alchemy`. **Parts:** `src/effects/parts/alchemy.ts`.
  **Kit:** `src/kits/alchemy.ts`. **Trait:** `src/traits/alchemy.ts`.
- **Basic attack:** ranged, 6.5 m, 9 damage, a dart. Walk speed 4.

## Passive: Reaction
Each spell leaves its reagent on the enemy hero for 4 s: **Q green toxin, W orange fire, E violet acid.** A hit with a
second, different reagent sets off a reaction and clears both:

| Reagents | Reaction | Effect |
|---|---|---|
| green + orange | Combust | +55 damage on that hit |
| green + violet | Corrode | the enemy takes 20% more (`vulnerable`) for 3 s |
| orange + violet | Concussion | a 3 m knock-back and a 0.5 s silence |

- Built in the trait's `dealt` hook. The deadlines are round time in `t.mem` (`r0`..`r2`).
- A spell counts once per cast (`hit.cast`, `t.mem.c<slot>`): the dart's and the vial's burn ticks never add the reagent
  again, and a later tick cannot set off a reaction.
- The homunculus (slot 3) carries all three: one hit sets off all three reactions and clears the reagents.
- A reaction changes the hit being dealt: `hit.damage`, `opts.debuff`, `opts.knock`, `opts.status`.
- The trait writes the reactions of the last hit to a `WeakMap` keyed by her figure; the effect calls `takeReaction` right
  after its `ctx.hit` and plays the burst (`ReactionBurst`, `parts/alchemy.ts`). `t.say` also floats the reaction's name.
- Badge: the reagents on the enemy as letters (T toxin, F fire, A acid).

## The spells
| Key | Spell (label) | Type | Numbers | Reagent |
|---|---|---|---|---|
| Q | Toxin Dart (`toxin dart`) | SHOT, `aim: 'line'` | range 9, cd 3; 30, then 5 x 6 over 3 s | green |
| W | Fire Vial (`fire vial`) | TGT | range 7, cd 6; 30, then 5 x 6 over 2 s; always hits | orange |
| E | Acid Splash (`acid splash`) | cone, self | 4 m, 100 degrees, cd 8; 40 and a knock-back of about 1.4 m | violet |
| R | Homunculus (`homunculus`) | SUMMON | cd 25; 120 HP, 4 m/s, lives 3.7 s; bursts within 1.5 m of an enemy: 70 to everyone within 2 m, all three reagents | all |

Flags: Q `aim: 'line'`; R `summon`. No cc (nothing stuns or roots), no dash. The duel AI: R by its summon rule (enemy
within 10 m); Q and W by range (9 / 7 m); E is `self` with radius 4.5 (cone still 4 m), so it is cast when the enemy is within 3.9 m.

### Q · Toxin Dart (`toxinDart.ts`)
0 to 0.2: a glass dart rises out of the bandolier into her hand, a green glint on its tip at 0.12. 0.2: it flies as a
bolt (`ctx.projectile`, speed 30, radius 0.4), a bubble trail behind it. On a hit: a green splat (impact frame, star,
glass chips, ground ring), and the toxin clings to the body as a pulsing blob with rising bubbles while five ticks of 6
follow every 0.6 s (`ctx.hit`, `projectile: true`). A miss only splashes the floor. Line telegraph from the throw.
Clean by 4.3 s (the last tick is at about 3.5 s: inside the duel's 4.2 s window).

### W · Fire Vial (`fireVial.ts`)
0 to 0.32: she uncorks a vial of orange fire, it flares gold on the cork (0.2). 0.32 to 0.72: a short high lob that follows
the enemy's live position (a sure hit: `projectile: true`, so no zone). 0.72: the vial bursts (fireball flash with a gold
core, star, chips, impact frame, shake), 30 (no knock-back). Flame tongues stand on the enemy for 2 s and five ticks of 6 follow every
0.4 s. No telegraph (nothing to dodge: break line of sight or stay out of 7 m).

### E · Acid Splash (`acidSplash.ts`)
0 to 0.42: the cone fills on the ground (telegraph from 0); she hauls a violet flask up in front of her chest, it swells
and trembles harder as the smash nears. 0.42: she smashes it: a fan of acid shoots across the cone, 20 droplets arc out
and land as bubbles, a ring rolls out of her feet, impact frame if it struck, shake. Whoever is inside the cone then
(live positions) takes 40 and a shove. A violet pool bubbles in the cone and drains at 1.5 s. Clean by 2.1 s.

### R · Homunculus (`homunculus.ts`)
0 to 0.4: the alchemical circle draws on in front of her and three vials (green, orange, violet) fly into it one after
another. 0.4: the circle flares and the homunculus (`ctx.summon`, `homunculusLook`: a glass-bellied creature, three
reagent orbs swirling in its belly, a waddle, a lit fuse) hops out and walks at the nearest enemy. Each frame the effect
checks the enemies: within 1.5 m it bursts, everyone within 2 m takes 70 (`ctx.hit`, `projectile: true`), the unit ends
(`left = 0`), three coloured fireballs, a ring at the blast radius, a star, a double impact frame and a big shake, then the
three reaction bursts on the enemy. The unit can be shot down (120 HP): it then only fizzles. It appears at 0.4 s and lives
3.7 s, so it is gone by 4.1 s (the duel drops a spell hit more than about 4.2 s after the cast). At 4 m/s that is 14 m.
Without `ctx.summon` (network duels) the homunculus is a flask thrown at the enemy that bursts there and hits no one.

## Palette and parts
`ALCHEMY` (core `#f4ffe0`, hot `#c8ff4a`, body `#4fbf2a`, dark `#0c1606`, glass `#dcefe6` as the foil, gold) stays her base.
`REAGENT[0..2]` are the three reagents (toxin green `#7dff3a`, fire orange `#ff8a2a`, acid violet `#b872ff`; each with a
`body`, a bright `hot` and a `deep` colour). New parts: `Flames`, `ReactionBurst` (Combust a round fireball, Corrode three
violet rings closing on the body, Concussion a flat shockwave with a refraction ring), `homunculusLook`. `Flask`, `Bubbles`,
`AcidPool` and `Droplets` take a reagent tint.

## Online
Hits on the other player are decided on the victim's screen, where the replayed cast resolves them and Vex's opponent trait runs. So her
reagents, the badge letters and the reaction bursts exist there (not on her own screen, which only gets the damage numbers
from the server); the reaction's damage, knock-back, silence and vulnerable are part of that hit. To confirm in a network test.
Q fires no bolt on the caster's own screen (the dart is a deterministic look there). Network duels leave `ctx.summon`
undefined: the homunculus is then only a look (a flask thrown at the enemy that hits no one). A hit swallowed by the victim's
`taken` (a block) still plays the burst.

## Tool preview
No trait runs in the VFX tool, so every effect has a `reaction` setting (none, combust, corrode, concussion, all) that plays
that burst on a hit when no real reaction was set off.

## Numbers that differ from the first design
- The homunculus lives 3.7 s (design: up to 6 s): the duel's hit window closes about 4.2 s after the cast.
- Cooldowns (the design gives none): Q 3, W 6, E 8, R 25.
- `HitOptions.knock` is a speed: the foe slides knock / 7 m, the player knock x 0.18 m with knock capped at 8 (1.44 m).
  Acid Splash uses 10 (about 1.4 m); Concussion uses 21 (3 m on a foe, 1.44 m on the player: the engine cap).
