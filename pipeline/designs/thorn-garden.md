# Thorn Garden (blood kit W: zone)

- **Label:** `thorn garden` · **File:** `src/spells/targeted/thornGarden.ts` · **Module:** `thornGardenModule`
- **Category:** `'hero: blood'` · **Targeting:** `ground`, radius 4.5 (`ctx.point` is the centre)
- **Kit:** read `pipeline/designs/blood-kit.md` first, and use the shared parts in `src/effects/parts/blood.ts`
  (look at `src/spells/targeted/hemolance.ts` for how they are used).
- **The shape that makes it ours:** the floor becomes a pool of blood inside a bone sigil, it goes still, and then
  the whole pool **freezes upward into a thicket of crystal thorns** (an iron maiden from below). The drained
  enemies leak blood back to the caster.

## MOBA timing (supersedes the times below; the beats and their order stay)
A normal W: hand flick 0–0.2, sigil and pool 0.2–0.6, bulges and the still beat 0.6–0.75, **eruption 0.75**,
hold and drain 0.75–1.5 (the one small tick at 1.2), shatter 1.5–2.2, clean by 2.2. Telegraph: start 0, impact 0.75.

## Timeline (~4.5 s)
1. **0–0.6 Offering.** The caster flicks a hand down: a short `BloodTendril` pours from the hand to the ground
   between the caster and the point (an arc, 0.4 s), then runs along the floor to the point.
2. **0.6–1.4 Pool.** A large bone `BloodSigil` (radius 4.5) draws on around the point (reveal 0 → 1 in 0.6 s,
   clockwise). A `BloodPool` spreads from the centre to radius 4.2 with a slow ripple; small drops fall into it
   from above (a few `BloodDrops`) making ring ripples. Darken the world a little (`darken` 0.35, tint `#140306`).
3. **1.4–2.0 Rise.** Enemies inside are slowed: `ctx.displace` them down 0.1 (sinking into the pool). The pool
   surface bulges in 5–7 places (small smooth blobs, the liquid shader) where thorns will come up. Low shake 0.05.
4. **2.0–2.15 Dead beat.** Everything holds; the bulges stop.
5. **2.15 Eruption.** `BloodThorns.erupt` over the whole circle in a fast ring from the centre outward (0.18 s):
   about 60 thorns, heights 0.8–2.6, the tallest under the enemies, angled slightly outward. Each enemy gets one
   big thorn straight under it and is lifted 1.2 (`ctx.displace`). A ground `ShockRefraction` (radius 1 → 6,
   strength 0.04 → 0), a cold `StarBurst` (3 frames) under each enemy, shake 0.45. No impact frames (that is for Q
   and R). `ctx.hit(e, { damage: 50, knock: 0, color: 0x8c0f22 })` for every enemy inside the radius.
6. **2.15–3.2 Hold and drain.** The thicket holds. From each impaled enemy a thin `BloodTendril` thread (width 0.03)
   runs to the caster's chest and pulses drops along it (`BloodDrops.drain`). One small tick at 2.8:
   `ctx.hit(e, { damage: 10, knock: 0, color: 0x8c0f22 })`.
7. **3.2–4.5 Shatter.** The thorns shatter outward from the centre into dark crystal flakes; the enemies drop back
   down; the pool dries to near-black and fades with the sigil; a few small dark `SmokeBall`s. Clean by 4.5.

## Telegraphs
A circle at the point, radius 4.5: start 0.6, impact 2.15.

## Exaggerate
The stillness before the eruption, and the size of the thorns under the enemies.
