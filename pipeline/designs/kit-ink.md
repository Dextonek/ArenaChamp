# Ink kit: Shiori, the Last Brush (ranged control mage + summons)

## v5 (2026-11-04)
580 HP, 4.1 m/s, ranged attack 6 m, 10 per 1.0 s. Design: [kits-v5.md](kits-v5.md) "Shiori". Passive **Wet Ink**: her strokes lie on the ground for 5 s.
An enemy within 0.8 m of a live armed stroke is slowed (0.6 s, refreshed every 0.4 s) and Stained (`stain` stack, 1 s); her hits on a Stained enemy
deal +20% (not zero-damage or `trait` hits). Where a new stroke crosses an armed stroke (or an armed seal, a 2 m stroke across its centre) a crossing
is made: a glowing point, and 0.65 s later it bursts once for 40 within 1.5 m (a `trait` hit from `victimTick`) and takes 1 s off Ink Lash
(`noteOwner('crossing')`, `peerNote`). The old ink resource, the weaken stain and the familiars are gone from the kit (old spell files stay).
Code: `src/traits/ink.ts` (boards per figure in WeakMaps: `addStroke`, `addSeal`, `strokesNear`, `removeStrokes`, the clock `inkNow` written from `marks`;
ground marks `stroke`, `seal`, `sealWet`, `cross`, `crossHot`, `burst`, `sealPop`), spells `inkLash.ts`, `sealOfBinding.ts`, `flowingScript.ts`,
`theLastCharacter.ts` in `src/spells/targeted/`, kit data `src/kits/ink.ts`.

| Key | Spell (label) | Numbers |
|---|---|---|
| Q | Ink Lash (`ink lash`), SHOT, `aim: 'line'` | 0.3 s wind-up, 22 m/s, 9 m, radius 0.35: 50. Reaches 6 m at 0.57 s. The stroke runs from where it left to where it stopped, added at the end of the flight. cd 4 |
| W | Seal of Binding (`seal of binding`), ground 8 m | A 2 m seal at the spot, armed 0.5 s after the cast, for 6 s, one list of seals drawn by `marks`. An enemy within 1 m (live) is rooted 1 s and Stained, the seal is used up. No telegraph (the drying seal is the warning). cd 10 |
| E | Flowing Script (`flowing script`), DASH, `dash: true` | 6 m glide in 0.25 s (`ctx.moveCaster`), a stroke along the path added at the landing. cd 11 |
| R | The Last Character (`the last character`), ground 9 m, `cc` | Circle r 2 telegraph, impact 1.0 s (roots her while she writes). At 1.0 s, live positions: inside 30 and root 1 s; plus 40 per live armed stroke within 0.8 m of the enemy (3 at most), as one hit; outside the circle only the stroke part, as a `projectile: true` hit. The counted strokes vanish. One short light impact frame. cd 22 |

Online notes: Q's stroke ends at the bolt on the victim's screen and at cover or full range on the dealer's (no bolt there); E's end differs where `moveCaster` clamps.
R removes the counted strokes on each screen from its own live positions. Crossings are made by the same effects on both screens; only the victim's screen decides damage.

---

(Older text below: the v4 kit, kept for the old spell files.)


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
