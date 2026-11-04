# Bone kit: Mortis, the Ossuary Lord (summoner), v4

Rebuilt from `pipeline/designs/kits-v4.md` (section "Mortis, the Ossuary Lord"). All four spells are new; the v3 spells
(Bone Spear, Grave Call, Ossuary Ward, Bone Colossus) are replaced. **Raise Dead** is the kept idea: the summoner's core,
now scaled by bone piles.

**Hero:** a gaunt robed necromancer in bone-grey and teal, 470 HP, walks at 3.8 m/s, ranged basic attack (range 6,
10 damage, every 1.0 s). **Category:** `hero: bone`. **Parts:** `src/effects/parts/bone.ts`. **Kit:** `src/kits/bone.ts`
(`boneKit`). **Trait:** `src/traits/bone.ts`.

**Signature shape: bone architecture.** Chunky, carved, stacked bone (ribs, vertebrae, spires, cages, a giant hand),
ivory with dark brown crevices, lit from inside by small unlit teal soulfire wisps. Palette (`BONE` / `BONE_CSS`):
core `#f4fffb`, hot `#b8fff0`, body `#3fd8b8` (soulfire), accent `#ff5a3a` (ember, a few frames at hits), dark `#0a1412`;
foil bone `#ece4d0`.

## v5 (2026-11-04)
Design source: `kits-v5.md`, section "Mortis". Where this differs from the v4 text below, v5 wins.
- Bone piles are drawn on the ground for their full 8 s on both screens (`marks`).
- Bone Fan: shards 18 degrees apart, radius 0.2, 8 m, 0.3 s wind-up at 20 m/s (reaches 6 m at about 0.56 s). Telegraph: one line per shard.
- Grave Grasp: still a click on the enemy, but the hand rises at the spot the enemy stood at the cast (1.6 m ring, 0.7 s). Still inside at
  0.7 s: pull 4 m, a plain 1 s root (one `status` on the burst's hit, no second root), two skeletons. Stepped out: nothing happens.
  This replaces the as-built hold of 0.6 s to 2.7 s.
- Bone Armour recast (Shatter, slot 2, window 4 s, arms at 0.3 s, the AI waits): breaks the shield and fires the shards at once. The
  `armourbroke` value tells the other screen, where `ownChanged` writes the broke record.

## Passive: Ossuary (`src/traits/bone.ts`)
- **Bone piles.** Every summoned unit that dies by damage, his or the enemy's, leaves a bone pile for 8 s
  (`deathSpots(8)` in the trait, `ctx.deathSpots?.(8)` in an effect; both sides count, expiry leaves none). His spells
  read the piles: Bone Fan (within 3 m of him), Raise Dead (within 4 m of the spot). Piles are not used up.
- **The fifth attack.** Every fifth basic attack that lands (`landed`, `hit.kind === 'attack'`) raises a small skeleton at
  his feet (`t.summon`: melee, 36 HP, 6 s, 7 damage per second, `skeletonLook`).
- **Bone Armour's shield** is made here (`afterCast`, slot 2): 30 plus 30 per living skeleton (`t.units().length`), at most
  120, for 4 s. The trait also opens a `boneArmours` record (keyed by his figure) and adds up the damage he takes
  (`taken`); when it uses the shield up it sets `broke`, which the effect reads to fire the shards early.
- **Badge:** attacks toward the next skeleton ("3/5"), plus the live piles ("3/5 +2").
- No twist. There is no resource bar any more.

## Q · Bone Fan (`boneFan.ts`, `bone fan`, `ground`, `aim: 'line'`, range 8, cd 5)
SHOT (a fan). Three shards, 30 each, 8 m, in an 8 degree fan; one more per bone pile within 3 m of him, six shards at
most. Each shard is its own `ctx.projectile` (speed 20, radius 0.32). 0 to 0.3 s: the shards gather in a fan at his hand
at chest height; the piles that lend a shard shake, soulfire stirs on them and a shard arcs from each into the fan.
0.3 s: they leave and ride their bolts; every hit throws chips, dust and a small ember star; at max range a shard
clatters apart. Telegraph: a cone as wide as the fan, armed at the launch. Clean by 1.3 s. Counterplay: stand between the
shards; fight away from his piles.

## W · Raise Dead (`raiseDead.ts`, `raise dead`, `ground`, `summon`, range 9, cd 9)
SUMMON. The ground at the spot cracks open (2.4 m hole, a circle telegraph) with soulfire in the cracks. Piles within 4 m
of the spot (at most three) stir and fling bones at it. At 0.7 s a skeleton claws out, plus one per pile (`ctx.summon`,
melee, 40 HP, 8 s, 10 damage per second, at most four, never past the cap of six units), in a burst of dust, chips and six
bone spires (two with skulls); enemies in the hole take 15 and a small knock-back. The spires sink; the skeletons stay.
Clean by 2.0 s. Counterplay: kill skeletons away from piles.

## E · Bone Armour (`boneArmour.ts`, `bone armour`, `self` radius 8, cd 14)
SELF. A cage of ribs grows round him in 0.45 s (radius 1.1, 2 m high, follows him) with soulfire in its joints. Shield:
30 plus 30 per living skeleton (120 at most) for 4 s, given by the trait. The cage shivers in its last half second. When the
armour breaks (the trait's record) or at 3.5 s, whichever is first (not before 0.6 s), the cage flies apart, five ribs
turn into darts that curve at the enemy's live chest and land 0.3 s later: 38 damage, homing (`projectile: true`, one
hit), an ember star, chips and a ground ripple. The cast is 3.5 s old at the latest, inside the duel's 4.2 s window. Clean
by 4.6 s. Counterplay: kill his skeletons first (a thin shield breaks early, and the shards are the same 38).

AI: the duel casts a self spell only when the enemy is within `radius - 0.6` = 7.4 m, so he armours as the enemy closes in.

## R · Grave Grasp (`graveGrasp.ts`, `grave grasp`, `enemy`, `cc`, range 9, cd 22)
TGT, PULL. A ring on the floor marks the enemy's feet and follows them, soulfire flickering up round it, the ground
trembling (the screen darkens a little). At 0.6 s a giant skeletal hand (`BoneHand`, scale 0.62) bursts up behind the
enemy, palm toward Mortis: bone spires, dust, chips, a ground ripple, an impact frame, 55 damage and a root of 0.85 s
(`projectile: true`: a sure hit). At 0.85 s the fingers close; from 0.9 s the hand drags the enemy toward Mortis, 4 m at
most and never closer than 1.1 m to him, over 0.8 s (`ctx.carry` every frame, eased out). At 1.7 s it squeezes (28
damage, root 1 s, a second impact frame) while two skeletons claw out beside the enemy (`ctx.summon`: melee, 50 HP, 7 s,
8 damage per second) and two skull-capped spires rise. The hand opens at 2.5 s and sinks; clean by 3.3 s. Counterplay:
break line of sight; keep out of 9 m.

## Numbers
| | Damage | Other |
|---|---|---|
| Basic attack | 10 | range 6, every 1.0 s, 5th hit raises a skeleton (36 HP, 6 s, 7/s) |
| Bone Fan | 30 per shard, 3 to 6 shards | range 8, cd 5 |
| Raise Dead | 15 in the hole | 1 to 4 skeletons (40 HP, 8 s, 10/s), range 9, cd 9 |
| Bone Armour | 38 (shards) | shield 30 + 30/skeleton, max 120, 4 s, cd 14 |
| Grave Grasp | 55 + 28 | drag 4 m in 0.8 s, root 1 s, 2 skeletons (50 HP, 7 s, 8/s), range 9, cd 22 |

## Online
- Statuses, shields, skillshots and pulls follow `docs/architecture/multiplayer.md`. Units made by a spell
  (`ctx.summon`) are synced like Grave Call's were; units made by the trait (the fifth-attack skeleton) are local to
  this screen: they fight the pack but deal no damage to the other hero.
- Bone piles come from the units this screen simulates (his own), so the other player's units leave none for him.
- Bone Armour: the other screen has no `boneArmours` record, so there the shards fly at 3.5 s.
- Grave Grasp: the victim's client carries its own hero (`ctx.carry`); on the caster's screen the hand follows the
  streamed position of the enemy.

## Parts added to `parts/bone.ts`
- `BoneDarts`: pointed bone darts placed by hand each frame (`set(i, pos, dir, size)`), for the fan and the armour shards.
- `BonePiles`: the bone piles on the ground (`set(spots, k)`), one instanced mesh. The effects draw the piles they use; the
  engine does not draw them all the time (a trait has no scene).
- Already there and now used: `RibCage` (armour), `BoneHand` (grasp), `BoneSpire`, `BoneShards`, `BoneDust`, `SoulWisps`,
  `GroundCracks`, `skeletonLook`. `colossusLook` is no longer used by any spell.
