# Blood kit: Vesper, the Crimson Countess (drain juggernaut)

## v5 (2026-11-04)
Design source: `kits-v5.md`, section "Vesper". Earlier art and parts notes: `blood-kit.md`. Old spells (Hemolance, Blood Step,
Crimson Pact, Blood Bond, ...) stay as files for the VFX tool; the kit no longer uses them.

**Hero:** 700 HP, 4.0 m/s, ranged attack (5.5 m, 8 per 0.7 s). Category `hero: blood`. Parts: `src/effects/parts/blood.ts`
(new: `BloodMist`). Kit `src/kits/blood.ts`, rules `src/traits/blood.ts`.

**Passive, Blood Price.** Each spell costs 20 HP (R 40; a recast is free; `castMods`, `payHp`, never below 1 HP). Below 45% HP she is
**Hungry**: `tick` shows `hungry` (a crimson ring at her feet, `ring`) and keeps `bloodHungry` (a WeakMap by her figure; the other
screen writes it in `ownChanged`). While Hungry her spell hits of slots 0-2 heal her 15% of their damage (`landed`). Basic attacks
and R do not heal that way. E's heal (15) and R's (45) work only while Hungry.

| Key | Spell (label) | Type | CD | Numbers |
|---|---|---|---:|---|
| Q | Lancet (`lancet`) | TGT, RECAST, `enemy` mode | 4 | range 7. Needle lands at 0.4 s: 40, a needle pip on the enemy for 3 s. Recast (`arm: 1`, window 3): the rip at 0.3 s, 35, only if the first cast struck, `stillSees` and within 8 m; the pip goes. |
| W | Mist Waltz (`mist waltz`) | DASH, `dash`, `ground` mode | 11 | 5 m flow in 0.2 s, no damage. Next two basic attacks within 3 s: +18 damage (power 1 + 18/8), +1.5 m reach, shown as drop pips. AI reach 11. |
| E | Hemocurse (`hemocurse`) | TGT, `enemy` mode | 12 | range 7. Lands at 0.6 s: 25, curse for 3 s. Each spell the enemy casts: 30 HP to them (`enemyCast`, `hitEnemy`) and 15 healed if she is Hungry. Breaks at 8 m or without sight. |
| R | Sanguine Feast (`sanguine feast`) | TGT, CHANNEL, `enemy` mode | 24 | range 8. Held 1.6 s (`t.hold`). Pulses 0.4 / 1.0 / 1.6 s: 35, 35, 40 + 20% missing HP; third heals 45 if Hungry. Ends on stun/silence/knock-up (`channelBroken`), 9 m, or no sight. |

**How it is built**
- **Q.** The effect tells the casts apart with a clock per figure (as `crosswind.ts`): a cast within 3.3 s of an unripped first cast is the
  rip. The needle pip: the trait's `dealt` adds `needle` (1 pip, 3 s) on the first hit and clears it when the rip's hit finds it
  there. The rip's 20 HP refund is given in `landed`, when the rip hit really lands (`mem.ripUntil` is set in `recastAct`), not at
  the cast, so a fizzled rip (cover, past 8 m) gives nothing back.
- **W.** `afterCast` sets `mem.mistUntil`, `mem.mistLeft = 2` and `show('mist', 2)`; `attackMods` spends one and updates the pips;
  `attackReach` returns 1.5 while armed; `tick` ends it at the deadline.
- **E.** The effect owns `hemocurses` (exported from the trait file, as `bloodBonds` is): `live`, `until`. It sets `live` when the
  curse lands and each frame ends it (3 s, past 8 m, no `stillSees`); `reset()` clears it. `enemyCast` reads `live`. The pip
  `curse` is added in `dealt` and cleared in `victimTick` when the record is not live.
- **R.** `afterCast` holds her 1.6 s. The effect runs the channel (`ChannelBar`, `channelBroken`, `stillSees`, 9 m, `releaseCaster`).
  The third pulse's missing HP is **what she has dealt the enemy this round** (`bloodDrawn`, summed in `dealt`, capped at 600),
  because the engine gives a spell no target HP. It over-counts if the enemy heals. The 45 HP heal is `ctx.healSelf` and is not
  gated on the third pulse landing.
- All hits are `projectile: true`; each spell has a red circle on the enemy (`telegraphs`), which is the warning, and checks sight
  and reach again when it lands.

**Counterplay (from kits-v5.md).** Weakness: cover (Q's rip, E and R need sight). The rip and E break past 8 m (0.75 s from 6 m with
reaction); R breaks past 9 m or behind cover; a stun, silence or knock-up ends R.

**Palette.** `BLOOD` / `BLOOD_CSS`: crimson body `#8c0f22`, hot `#ff3b4e`, dark `#140306`, bone foil `#e9dcc6`. Shapes: crystal needle
and thorns, the bone sigil, blood tendrils and drops, and the new mist wisps.
