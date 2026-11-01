# Bard kit: Cantor, the Last Verse (ranged support / control)

## Role (2026-10-30)
**Support**, 640 HP. Signature: *Silence*. Q: bolt with a delayed echo beat (no bounce); W unchanged; E: sound rings and a heal (no shield).
- R Crescendo: a SELF-R (`cc`, range 0): the lyre rises in front of him, the chord (radius 7 to 5) hits for 95 within 5 m (no stun), then an **encore aura** follows him for `encore` 4 s (golden notes and staff lines orbiting at waist height, a gold ground ring pulsing 2 beats/s); his spells have no cooldown meanwhile.

**Signature shape: sound made visible.** Music is drawn as **flowing five-line staves**, **floating notes and clefs**
riding them, and **concentric sound rings** that ripple out from struck strings. Notes are dark ink shapes with a
glowing rose edge; staves are thin parallel ribbons; rings are crisp, thin and quick. A golden lyre sounds every
spell. Not the dawn kit (gold hard-light panels), not the astral kit (stars) and not the tide kit (water ribbons).

Read `kit-common.md` first (files, naming, timing, budgets including the **Mechanics budget**, look lessons) and
`docs/architecture/mechanics.md` (skillshots with bounce, silence, shield, heal, stun). Cantor is a **ranged
support**: silences, a shield and a heal, and a stunning crescendo.

- **Hero:** a lean travelling bard in a rose and plum coat with a feathered hat, a parchment scarf printed with
  notes, and a golden lyre. **Category:** `hero: bard`. **Parts file:** `src/effects/parts/bard.ts`. **Kit:**
  `src/kits/bard.ts` (`bardKit`, name `Cantor`, title `the Last Verse`).
- **Palette** (`BARD` / `BARD_CSS`): core `#ffffff` → hot `#ffb8e6` → body `#e04aa8` (rose magenta) → accent
  `#ffd24a` (lyre gold, 2–3 frames at hits) → dark `#1e0a1a` (ink, note heads); **foil** parchment `#f2e6d0`.
- **Material rules:** staves = 5 thin parallel ribbons (each ≥ 0.05 wide, spaced ~0.1) in parchment with a rose glow
  edge, unlit, gently waving; notes = flat billboard glyphs (quarter, eighth, beamed pairs, a treble clef) in dark ink
  with a rose rim, chunky enough to read (≥ 0.35 tall); sound rings = thin crisp rings that expand fast and fade,
  rose with a white leading edge.

## Shared parts (`bard.ts`)
- `BARD`, `BARD_CSS`.
- `Stave`: a 5-line music stave ribbon along a path: `setPath(points, width, head, tail)`, `wave(amplitude)`.
- `Notes`: pooled note glyphs (canvas textures: quarter, eighth, beamed, clef): `emit(pos, vel, count, life)`,
  `ride(stave, u, glyph)` to slide along a stave.
- `SoundRings`: quick expanding rings: `pulse(center, radius, seconds, normal)`.
- `Lyre`: a golden lyre that appears over a point and strums: `show(pos, scale)`, `strum()`, `hide()`.

## Q · Discordant Note (`discordantNote.ts`, label `discordant note`, `ground`, `aim: 'line'`, range 12, cd 3, damage 50, echo beat)
A skillshot. 0–0.2: he strums; a big dark note glyph (0.5 tall) forms with sound rings. 0.2: `ctx.projectile({ from,
dir, speed: 20, range: 12, radius: 0.45, hit: { damage: 50, knock: 2, color: BARD_CSS.body } })`. The note
rides the bolt trailing a short stave ribbon; each hit bursts into small notes and a sound ring, a gold accent (2
frames). The first hit arms an echo: a faint gold ring marks the burst spot for 0.8 s, then a smaller beat lands there
and hits whoever stands within 1.6 m at that moment for 30% of the damage (a ground check, not homing). Clean by 2.3.

## W · Silencing Refrain (`silencingRefrain.ts`, label `silencing refrain`, `ground`, radius 4, range 10, cd 7, damage 40 + silence)
0–0.3: a stave ribbon spirals in from his lyre and coils around the zone edge (radius 4). 0.3–0.7: notes ride the
coil inward, tightening. **0.75 hit**: a hush — every note freezes, a single huge rest glyph appears over the
centre, and a dark sound ring snaps inward: every enemy inside `ctx.hit(e, { damage: 40, knock: 0, color:
BARD_CSS.body, status: { kind: 'silence', seconds: 1.5 } })`. 1.0–2.0: the notes fall and fade, the stave unwinds.
Clean by 2.2.

## E · Ballad of Valor (`balladOfValor.ts`, label `ballad of valor`, `self`, radius 4, cd 9, heal 55 + 2 × 10)
0–0.3: two stave ribbons circle him (radius 1.3) with notes riding them. At
1.0 and 2.0 he strums and a sound ring races out to radius 4: every enemy inside `ctx.hit(e, { damage: 10, knock: 2
})`. At 2.0 golden notes rise around him: `ctx.healSelf(55)`. 2.6–3.0: the staves unwind into falling notes. Clean by
3.2. Telegraph ends at the first pulse.

## R · Crescendo (`crescendo.ts`, label `crescendo`, `ground`, radius 7, range 13, cd 20, damage 100, encore aura, `cc`)
The ultimate: **a great organ of sound** rises over the zone and plays one deafening chord.
0–0.4: the world darkens to plum-black (`darken` 0.55, tint `#1e0a1a`); a circle of staves marks radius 7.
0.3–1.6: behind the point a giant golden lyre (~6 tall) rises, strings glowing; staves spiral up from the zone edge
into it, carrying hundreds of notes; the lyre's strings shimmer faster; enemies are pulled 0.4 toward the centre.
1.6–1.85: every note stops mid-air, the strings draw back — **dead beat 1.85–2.0**. **2.0–2.2**: the chord: the
strings snap forward and a wall of sound rings races down onto the point. **2.2 hit**: impact frames `[1, 2]` at
0.04 s, concentric sound rings burst out across the radius, all the notes scatter outward, a gold accent at the
centre, ground `ShockRefraction` (1 → 12, 0.07), shake 0.75: every enemy within 7 `ctx.hit(e, { damage: 100, knock:
4, from: point })` (no stun). 2.2–4.5: the notes drift down and fade, the lyre dissolves into notes, the darken
lifts. **Encore aura 2.2–5.2** (`encore` = 3 s, fades over 0.4, clean by 5.6): 9 golden notes and 3 staff-line rings
orbit the caster at waist height (y 1.1, radius ~1.15), a soft gold ground ring and a beat ring pulse 2 times a
second; it follows the caster figure.
