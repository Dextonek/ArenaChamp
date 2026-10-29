# Hemolance (blood kit Q: quick strike)

- **Label:** `hemolance` · **File:** `src/spells/targeted/hemolance.ts` · **Module:** `hemolanceModule`
- **Category:** `'hero: blood'` · **Targeting:** `enemy`
- **Kit:** read `pipeline/designs/blood-kit.md` first (palette, shapes, material rules, shared parts).
- **The shape that makes it ours:** liquid that hardens in mid-air. A tendril of blood whips up out of a cut in
  the caster's palm, coils once, and **snaps into a faceted crystal lance** with an audible "freeze" beat; it flies,
  impales the target, and bursts into a crown of thorns. The drops come home.

## MOBA timing (supersedes the times below; the beats and their order stay)
A normal Q: cut 0–0.12, tendril draw 0.12–0.35, harden 0.35–0.42 (the dead beat is 0.06 s), throw 0.42–0.55,
**impact 0.55** (impact frame `[1]` only, 0.03 s), thorns hold to 0.8 then shatter, drain 0.7–1.2, clean by 1.6.
Telegraph: start 0.1, impact 0.55.

## Timeline (~3.0 s)
1. **0–0.35 Cut.** A thin bone-white `CrescentArc` (toon, tiny, 0.6 long) slashes across the caster's raised hand
   (at about shoulder height, in front of the caster toward the target). Five or six drops spray from it.
2. **0.35–0.95 Draw.** A `BloodTendril` pours up out of the hand and coils one loop above the shoulder, then
   straightens toward the target (width 0.12, bead at the tip). A small bone `BloodSigil` (radius 0.7) draws on,
   standing vertical behind the hand, facing the target: the pale foil behind the red.
3. **0.95–1.15 Harden (dead beat).** Everything holds still for 0.15 s. Then in two frames the tendril is replaced by
   one long `BloodThorns` crystal spike (the lance, 2.2 long), with a 1-frame core glint running along its edge.
   A tiny camera-facing `ShockRefraction` at the hand (radius 0.2 → 1.2, strength 0.03).
4. **1.15–1.4 Throw.** The lance flies to the target in 0.22 s, a thin dark-red streak trail behind it and drops
   shed along the path.
5. **1.4 Impact.** `impactFrameAt(t, 1.4, [1, 2], 0.04)` (bone card, black silhouettes). The lance impales the
   target; a ring of 10 `BloodThorns` bursts out of the ground around it (radius 1.3, height 1.4, angled outward);
   `BloodDrops.spray` upward; a cold pale cyan `StarBurst` for 3 frames at the impact (the accent); a ground
   `ShockRefraction` (radius 0.4 → 3, strength 0.035); shake 0.35.
   `ctx.hit(target, { damage: 60, knock: 4, from: caster, color: 0x8c0f22 })`.
6. **1.4–2.2 Drain.** The thorns and the lance hold 0.35 s, then shatter into dark flakes. A `BloodPool` spreads
   under the target (radius 1.4). Eight drops lift out of the target and arc home into the caster's chest
   (`BloodDrops.drain`), arriving one after another; each arrival is a tiny crimson pulse at the chest.
7. **2.2–3.0 Clean.** The pool dries and fades, a small dark `SmokeBall` puffs away. Clean frame by 3.0.

## Telegraphs
A line from the caster to the target (width 1.0): start 0.35, impact 1.4.

## Exaggerate
The freeze from liquid to crystal (the dead beat and the 2-frame swap), and the drops flying home.
