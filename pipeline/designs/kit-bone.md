# Bone kit: Mortis, the Ossuary Lord (summoner)

## Role (2026-10-30)
**Summoner**, 580 HP. Signature: *Raise the dead*. Q, W and R unchanged (pierce bolt, skeletons, hand and archers).
- E Ossuary Ward: a CAGE (`enemy` mode, range 9, `cc`): the ribs grow round the chosen enemy (radius 1.0); at 0.8 s they close and cut with shards (radius 2): 12 damage and **root 1.2**, flex again at 1.9 s for another 12. No self shield any more.

**Signature shape: bone architecture.** Bone is **chunky, carved and stacked**: ribs, vertebrae, skull-capped spires
and bone cages that grow out of the ground in segments, lit from inside by **teal soulfire wisps** that flicker in
the eye sockets and cracks. Bones are ivory with dark brown crevices (not white blobs). Not the blood kit (red, wet,
thorns) and not the shadow kit (violet void, hands from the dark).

Read `kit-common.md` first (files, timing, budgets including the **Summon budget**, look lessons) and
`docs/architecture/mechanics.md` (projectiles, summons with a pluggable `look`, shield). This is the first
**summoner**: skeletons fight for him.

- **Hero:** a gaunt robed necromancer in bone-grey and teal with a ribcage mantle, a skull-topped staff and soulfire
  eyes. **Category:** `hero: bone`. **Parts file:** `src/effects/parts/bone.ts`. **Kit:** `src/kits/bone.ts`
  (`boneKit`, name `Mortis`, title `the Ossuary Lord`).
- **Palette** (`BONE` / `BONE_CSS`): core `#f4fffb` → hot `#b8fff0` → body `#3fd8b8` (soulfire teal) → accent
  `#ff5a3a` (ember orange, 2–3 frames at hits) → dark `#0a1412` (crevices, soot); **foil** bone `#ece4d0`.
- **Material rules:** bone = toon-lit ivory (`#ece4d0`) with dark brown crevice lines and slight segment variation
  (no gloss, no identical repeats); soulfire = small unlit teal wisps with eroding edges in sockets and cracks, never
  spheres; dust = small grey-brown puffs.

## Shared parts (`bone.ts`)
- `BONE`, `BONE_CSS`.
- `BoneSpire`: a segmented bone spike that grows from the ground in steps: `grow(pos, height, seconds, lean)`,
  `crumble(seconds)`.
- `SoulWisps`: pooled teal flame wisps: `attach(pos, count)`, `puff(pos, count)`.
- `BoneDust`: grey-brown dust puffs: `burst(pos, count)`.
- **Skeleton look** for summons: a `MinionLook` (see `src/effects/parts/minion.ts`) that builds a small skeleton
  (skull, ribcage, limbs, teal eye wisps) for `melee` units and a skeleton archer with a bow for `ranged` units. Pass
  it as `look` in `ctx.summon`.

## Q · Bone Spear (`boneSpear.ts`, label `bone spear`, `ground`, `aim: 'line'`, range 11, cd 3, damage 50)
A skillshot. 0–0.2: a vertebra spear (2.2 long, chunky) assembles from bones beside him with soulfire in its joints.
0.2: `ctx.projectile({ from, dir, speed: 22, range: 11, radius: 0.45, pierce: true, hit: { damage: 50, knock: 2,
color: BONE_CSS.body } })`; the spear follows the bolt's position; on each hit a bone-chip burst, a small ember
accent and dust. At max range it clatters apart into bones that fade. Clean by 1.5.

## W · Grave Call (`graveCall.ts`, label `grave call`, `ground`, radius 3, range 10, cd 9, damage 25, `summon`)
0–0.3: the ground cracks in a circle (radius 3) with teal light in the cracks. **0.6 hit**: two skeletons claw out of
the ground in a burst of dust and bone spires; enemies inside `ctx.hit(e, { damage: 25, knock: 1 })`. At 0.6
`ctx.summon({ kind: 'melee', at: point, count: 2, hp: 40, seconds: 6, damage: 6, attackEvery: 1, look:
skeletonLook })`. The spell's own visual is clean by 2.0 (the skeletons live on as units).

## E · Ossuary Ward (`ossuaryWard.ts`, label `ossuary ward`, `self`, radius 4, cd 9, shield 50 + 2 × 12)
0–0.3: a cage of curved ribs grows around him (radius 1.4); `ctx.shieldSelf(50, 3, BONE_CSS.body)`. At 1.0 and 2.0
the ribs flex outward and fire a ring of bone shards to radius 4: every enemy inside `ctx.hit(e, { damage: 12,
knock: 1 })`. 2.6–3.0: the cage crumbles into dust. Clean by 3.2. Telegraph ends at the first pulse.

## R · Bone Colossus (`boneColossus.ts`, label `bone colossus`, `ground`, radius 2.6, range 9, cd 20, damage 25, `summon`)
Replaces Legion of the Ossuary (v3 batch 3). One giant skeleton the enemy has to deal with. 0–0.75: the ground trembles
(rising shake, `darken` 0.4, cracks with teal light spread over radius 3.6, wisps, rim spires shove up from 0.35).
**0.75 split**: impact frames `[1, 2]`, ember star, ground `ShockRefraction`, dust ring, 26 bone chips, shake 0.8;
`ctx.hit` on everyone within 2.6 (damage 25, knock 4), and `ctx.summon({ kind: 'melee', count: 1, hp: 280, seconds: 8,
damage: 28, attackEvery: 1.5, speed: 2.6, look: colossusLook })`. The look (`parts/bone.ts`) is the skeleton at 2.5x with
horns, shoulder and back spikes, a bigger soulfire heart and a bone club; it climbs out over 0.85 s and the club is raised
and slammed on `pose.swing`. The effect follows the Summon handle: every landed swing cracks the ground in front of him
(small crack decal, dust ring, chips, `ShockRefraction`, shake 0.4), every ~0.6 s of walking a dust puff and a small shake.
On death (slain or timed out) he collapses into bones (chips, ring, dust, soulfire, impact frame, shake 0.55); the effect
ends 1.6 s later. Damage comes from the unit's own attack, not `ctx.hit`. Without `ctx.summon` (network) only the look
plays and the effect ends at 2.6. Trait: the colossus counts as one unit death (+1 bone); Bones spend gives it +8% per bone.
