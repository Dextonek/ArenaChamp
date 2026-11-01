# Ink kit: Shiori, the Last Brush (ranged control mage + summons)

## Role (2026-10-30)
**Summoner**, 580 HP. Signature: *Ink familiars*. Shape unchanged (split bolt, root zone, cranes, blind R).
- E Paper Familiars: cooldown 14 to 12 (kit data only).

**Signature shape: the wet brushstroke.** Everything is **calligraphy painted in the air and on the ground**:
tapered strokes that start fat and end in a dry-brush tail (the bristle gaps show as streaks), splatter drops flung
off the stroke ends, ink that **bleeds** into pale rice-paper decals, and a square vermilion seal stamped where a
spell lands. Strokes are black, with a thin indigo glow on their edges so they read on the darkened floor. Not the
shadow kit (flat, hard-edged cut-paper silhouettes, no texture) and not the `ink moon severance` recipe (one giant
crescent slash): ink is **brush texture, wet edges, paper and seals**.

Read `kit-common.md` first (files, naming, timing, budgets including the **Summon budget** and **Mechanics
budget**, look lessons) and `docs/architecture/mechanics.md` (skillshots with a split at the end, root, blind,
summons with a pluggable `look`). Shiori is a **ranged control mage**: a splitting stroke, a root, two ink
familiars and a blinding ultimate.

- **Hero:** a calligrapher-mage in a rice-paper white robe whose hem is washed in ink that bleeds upward, an indigo
  sash with a vermilion seal tassel, long black hair held by a hairpin shaped like a brush, a huge calligraphy brush
  as tall as she is, and paper talisman strips floating around her. **Category:** `hero: ink`. **Parts file:**
  `src/effects/parts/ink.ts`. **Kit:** `src/kits/ink.ts` (`inkKit`, name `Shiori`, title `the Last Brush`).
- **Palette** (`INK` / `INK_CSS`): core `#ffffff` → hot `#c8d4ff` → body `#3a5ae8` (indigo glow on stroke edges) →
  accent `#ff4a2a` (vermilion seal, and 2–3 frames at hits) → dark `#0b0a0e` (sumi ink, the strokes themselves);
  **foil** rice paper `#efe6d2`.
- **Material rules:** strokes = flat ribbons (≥ 0.2 wide at the fat end) with a canvas texture of bristle streaks
  and a dry, broken tail; sumi black body with an indigo rim glow ≥ 0.04; never uniform width. Paper = matte pale
  decals with a soft torn edge under any ink that lands on the ground (the foil). Seals = a square vermilion stamp
  with a pale border and a simple carved glyph, flat on the ground, one per spell at most. Splatter = few drops (≤ 12)
  with a short life.

## Shared parts (`ink.ts`)
- `INK`, `INK_CSS`.
- `Stroke`: a brushstroke ribbon painted along a path over time: `paint(points, width, seconds)` (the head draws
  in, the tail dries out), `dissolve(seconds)` (breaks into flakes and fades).
- `Splatter`: ink drops flung from a point: `fling(pos, dir, count, speed)`.
- `InkBleed`: a ground decal where ink spreads into rice paper: `spread(center, radius, seconds)`, `fade(seconds)`.
- `Seal`: a vermilion seal stamp: `stamp(center, size)`, `fade(seconds)`.
- **Ink-crane look** for summons: a `MinionLook` that builds a folded paper crane (~0.8 m, rice-paper body with
  painted ink wing tips and a vermilion dot) that hovers, for `ranged` units; its shots are short ink darts. Pass it
  as `look` in `ctx.summon`.

## Q · Brushstroke (`brushstroke.ts`, label `brushstroke`, `ground`, `aim: 'line'`, range 12, cd 3, damage 55 + end split)
A skillshot. 0–0.2: she sweeps the big brush; a fat stroke head forms at its tip. 0.2: `ctx.projectile({ from, dir,
speed: 20, range: 12, radius: 0.45, hit: { damage: 55, knock: 2, color: INK_CSS.body }, split: { count: 3,
spreadDeg: 40, at: 'end', hit: { damage: 15, knock: 1, color: INK_CSS.body }, range: 4 } })`. The bolt is a flying
stroke head trailing a painted ribbon that dries out behind it; on a hit it bursts in splatter on a small paper
bleed; at max range it flicks into three splatter drops (the child bolts). Clean by 1.6.

## W · Ink Snare (`inkSnare.ts`, label `ink snare`, `ground`, radius 3.5, range 10, cd 8, damage 35)
0–0.35: an `InkBleed` spreads over the zone on the ground (paper first, then ink bleeding into it). 0.35–0.65: three
or four strokes paint themselves across the pool in a quick character. **0.7 hit**: the ink rises in short grasping
strokes around each foot, a seal stamps the centre, a vermilion accent (2 frames): every enemy inside (re-check at
impact) `ctx.hit(e, { damage: 35, knock: 0, color: INK_CSS.body })` (no root; the kit adds a vulnerable debuff).
1.0–2.0: the strokes dry and flake, the pool fades. Clean by 2.2.

## E · Paper Familiars (`paperFamiliars.ts`, label `paper familiars`, `self`, cd 14, summon, hit 10)
0–0.4: two paper sheets unfold beside her and fold themselves into cranes with ink-brushed wing tips; a seal
stamps under each. **0.5**: `ctx.summon({ kind: 'ranged', at: caster, count: 2, hp: 35, seconds: 6, damage: 8,
attackEvery: 1.5, look: inkCraneLook })`; a splash of ink rings out to radius 3: every enemy inside `ctx.hit(e, {
damage: 10, knock: 1 })`. Clean by 1.4 (the cranes live on as units). No telegraph beyond a radius-3 circle that
ends at 0.5.

## R · Final Calligraphy (`finalCalligraphy.ts`, label `final calligraphy`, `ground`, radius 7, range 13, cd 20, damage 105 + blind, `cc`)
The ultimate: **she writes one giant character across the zone.**
0–0.4: the world darkens (`darken` 0.55, tint `#0b0a0e`); a vast rice-paper sheet (radius 7, torn edge) unrolls on
the ground. 0.3–1.6: a giant brush (~5 tall, built from strokes) appears ~5 up over the point and paints a huge
character on the paper, stroke by stroke (4–5 strokes, each ≥ 0.6 wide), splatter flying off each stroke end;
enemies drift toward the centre (`ctx.displace` up to 0.4, reset after). 1.6–1.85: the brush lifts away —
**dead beat 1.85–2.0**. **2.0–2.2**: a giant vermilion seal (~3 wide) drops from above onto the centre of the
character. **2.2 hit**: impact frames `[1, 2]` at 0.04 s, the character's ink erupts upward as a wall of splatter
and stroke flakes, a vermilion accent at the centre, ground `ShockRefraction` (1 → 12, 0.07), shake 0.7: every enemy
within 7 `ctx.hit(e, { damage: 105, knock: 3, from: point, color: INK_CSS.body, status: { kind: 'blind',
seconds: 2.0 } })`. 2.2–4.5: the flakes drift down, the paper fades, the darken lifts. Clean by 4.5.
