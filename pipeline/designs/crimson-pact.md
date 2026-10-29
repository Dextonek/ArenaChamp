# Crimson Pact (blood kit E: self drain aura)

- **Label:** `crimson pact` · **File:** `src/spells/targeted/crimsonPact.ts` · **Module:** `crimsonPactModule`
- **Category:** `'hero: blood'` · **Targeting:** `self`, radius 6 (enemies within 6 of the caster are the targets)
- **Kit:** read `pipeline/designs/blood-kit.md` first, and use the shared parts in `src/effects/parts/blood.ts`
  (look at `src/spells/targeted/hemolance.ts` for how they are used).
- **The shape that makes it ours:** a **heart of blood** forms over the caster and **beats**. Every beat pulls a
  thread of blood out of each nearby enemy, and the blood orbits the caster as a slow ring of tendrils, a
  living cage. Three blood beads settle into orbit at the end (the beads the ultimate spends).
- **Loop:** with `settings.loop` on, the 1.4–4.2 section repeats seamlessly (the beat period is the loop period).

## MOBA timing (supersedes the times below; the beats and their order stay)
A normal E: open 0–0.3, heart 0.3–0.6, beats 0.6–2.6 (lub-dub period 1.0 s, so two beats; one hit per beat),
seal into three beads 2.6–3.0, clean by 3.2 (the beads fade). Loop section 0.6–2.6. Telegraph: start 0, impact 0.6,
until 2.6.

## Timeline (~5.5 s)
1. **0–0.5 Open.** The caster spreads her arms. A bone `BloodSigil` (radius 2.2) draws on under her feet. Blood
   rises from both palms as two `BloodTendril`s that meet above her head (about 2.6 up).
2. **0.5–1.4 Heart.** The tendrils knot into a heart-sized blob (radius 0.45, the liquid shader; an organic, slightly
   lumpy sphere made with vertex noise, NOT a glowing sphere) with two short vein tendrils hanging from it.
3. **1.4–4.2 Beats.** The heart beats twice per 1.4 s (a lub-dub: scale 1 → 1.18 → 1 → 1.1 → 1, sharp attack and a
   slow release). On each first beat:
   - a thin bone ring pulses out across the floor from the caster (a `createRing` or the sigil's outer line, radius
     0.5 → 6, fading), with a faint ground `ShockRefraction` (strength 0.025);
   - from every enemy in range, a thin `BloodTendril` thread (width 0.035) whips from the enemy to the heart and
     carries a short run of drops (`BloodDrops.drain`), then pulls back in;
   - `ctx.hit(e, { damage: 9, knock: 0, color: 0x8c0f22 })` (two beats, so two hits per enemy in the 5.5 s).
   - Around the caster, 4 long tendrils orbit at waist height (radius 1.4–1.8, slow, tilted ±12°), each a little
     thicker after each beat.
4. **4.2–5.0 Seal.** The heart contracts and splits into **three blood beads** (radius 0.12) that settle into a
   slow orbit around the caster's shoulders; the orbit tendrils unravel into drops that fall and splat; the sigil
   fades.
5. **5.0–5.5 Clean.** Only the three beads remain (they fade out at 5.5 unless looping). A crimson pulse at the
   caster's chest at 5.0 (she is healed).

## Telegraphs
A circle around the caster, radius 6: start 0.5, impact 1.4, until 4.2.

## Exaggerate
The heartbeat rhythm (it should feel like a pulse you can count), and the threads snapping taut on the beat.
