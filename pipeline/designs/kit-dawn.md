# Dawn kit: Auriel, the Dawn Paladin

## v5 (2026-11-04)
550 HP, 3.9 m/s, ranged attack 5.5 m, 8 per 0.7 s. Design: [kits-v5.md](kits-v5.md) "Auriel". Passive **Oath of Dawn**: when one of her shields breaks
or runs out it bursts in light (3 m) for about 60% of its size. The v4 `shieldMul` is gone. Code: `src/traits/dawn.ts` (shield record `aurielShields`, `burstHit`),
spells `firstLight.ts`, `dawnward.ts`, `oathbrand.ts`, `sunrise.ts` in `src/spells/targeted/`, kit data `src/kits/dawn.ts`.

| Key | Spell (label) | Numbers |
|---|---|---|
| Q | First Light (`first light`), QUICK cone, self radius 6.6 | 6 m, 70 degrees, hit at 0.45 s: 40. A hit on the hero gives a 14 shield for 3 s (not while W or R holds); its end bursts 8 in 3 m. cd 4 |
| W | Dawnward (`dawnward`), self, recast Pop (arms 0.2 s, window 3 s) | 45 shield for 3 s, basic attacks +3 m reach, `show('ward')`. End: 27 in 3 m at her live position. Refused while Sunrise holds. cd 9 |
| E | Oathbrand (`oathbrand`), enemy, 7 m | Beam 0.5 s later if `stillSees`: 44, brand 2.5 s. A burst on a branded enemy stuns 0.8 s. cd 11 |
| R | Sunrise (`sunrise`), self, recast Pop (arms 0.3 s, window 5.2 s) | 130 shield for 5 s, she floats (look only). End: 5 m ring fixed at her spot, closes 1.6 s, bursts 80. cd 24 |

How the bursts work: they are spell hits inside long-lived effects (`projectile: true`, live positions), not trait hits, so they are decided on the victim's screen. The trait
writes a shared record per figure (`kind` 0..3, `broke`), `tick` flips `broke` when `shieldAmount()` is 0, and `show('shield', kind)` / `show('sunbreak', n)` rebuild it on
the other screen. The stun marker is a module flag set only around `burstHit` (the whole hit pipeline is synchronous), read by `dealt`. Self radius of W and R is 30 so the
frozen `targets` list holds the enemy when the burst comes; the trait's `aiHold` keeps the CPU to 6.5 m (W) and 8 m (R). Q gives no shield while W or R holds, and
a Sunrise cast replaces a live Dawnward record (no 27 burst). The CPU never pops (`aiWait`).


## Role (2026-10-30)
**Support**, 640 HP. Signature: *Aegis*. Every spell shields her; the stun dome and the orbit punish whoever stays close. Numbers are first guesses for the tournament.
- Q Radiant Spear: a piercing skillshot (`aim: 'line'`, range 12, speed 24, radius 0.5, 50 damage); a hit gives a 20 shield for 4 s. The six-shard spear rides the bolt, the spray fans out of the target on the first hit.
- W Aegis Wall: a trap (`cc`). The shield ring stands open for 1.2 s, then the dome slams: 45 damage and **stun 0.8** to whoever is still inside radius 4 (live position), a 10 tick at 1.7 s.
- E Radiant Parry (batch 3, replaces Halo of Blades): a sun-shield stance for 0.6 s. The first hit on her in the window is parried (no damage); the enemy hero takes 20 and is stunned 0.6 s. A parried summoned-unit hit closes the window without the stun. Nothing hit: the stance fades (a quiet whiff). cd 11 (balance pass: it was 0.8 s, a 1 s stun and cd 8; she won 79% of AI duels).
- R Dawn Descent (batch 3, replaces Judgement of Dawn): a leap up to 12 m in a high arc, untouchable while airborne (1.0 s), landing on a 2.5 m zone that deals 40 and stuns 1 s, then a shield of 40 for 3 s. cd 16 (balance pass: 50 damage and a 60 shield before).

**Signature shape: hard-light geometry.** Light is solid: **flat gold panels with crisp edges** (hexagons, kite shields,
long blade shards) that click together into shapes (a shield wall, a halo of blades, a great sword), lit from inside
with a white core line and a darker amber rim. Things assemble panel by panel and shatter into panels. Not soft holy
glow and not stained glass (the existing sanctum): opaque, geometric, assembled light.

Read `kit-common.md` first (files, timing, balance budget, look lessons).

- **Hero:** a young paladin in white and gold plate with a halo ring; protects and smites. **Category:** `hero: dawn`.
  **Parts file:** `src/effects/parts/dawn.ts`. **Kit:** `src/kits/dawn.ts` (`dawnKit`).
- **Palette** (`DAWN` / `DAWN_CSS`): core `#fffdf2` (tiny core lines) → hot `#ffe7a0` → body `#f2b83c` (gold) →
  accent `#7fd8ff` (sky blue, 2–3 frames at hits) → dark `#3a2408` (amber-brown rims and shadows); **foil** ivory
  `#efe6d2` (panel faces, the halo's inner band).
- **Material rules:** hard-light panels = unlit flat shapes, ivory/gold face with a thin white core line and a dark
  amber rim (the dark layer), only the core lines may bloom; never a soft glow sphere; light rays = thin crisp
  tapered wedges, low opacity, few.

## Shared parts (`dawn.ts`)
- `DAWN`, `DAWN_CSS`.
- `LightPanels`: instanced hard-light panels (hex, kite, shard shapes): `place(i, pos, quat, size, shape)`,
  `assemble(positions, seconds, stagger)` (fly in and click into place), `shatter(speed, life)`.
- `HaloRing`: a crisp gold ring with an ivory inner band and short ray ticks: `set(center, normal, radius)`, `spin`,
  `opacity`.
- `SunRays`: a few thin crisp tapered wedges fanning from a point: `fan(origin, dir, count, length, spread)`, `fade`.
- `Sigil`: a gold ground circle with a sun-wheel pattern (canvas): `set(center, radius)`, `reveal`, `opacity`, centre
  hide option.

## Q · Radiant Spear (`radiantSpear.ts`, label `radiant spear`, `enemy`, range 11, cd 3, damage 50)
0–0.2: a spear of hard-light shards assembles over her shoulder (6 shards clicking into a long blade, 2.6 long).
**0.45 hit**: it flies and pierces the target: the shards burst out of its back in a fan, a sky-blue accent (2
frames), a small sun-wheel sigil flashes under it, small ground `ShockRefraction` (0.03), one impact frame `[1]` at
0.03 s. `ctx.hit(target, { damage: 50, knock: 3, color: DAWN_CSS.body })`. 0.6–1.4: the shards fade out panel by
panel. Clean by 1.5.

## W · Aegis Wall (`aegisWall.ts`, label `aegis wall`, `ground`, radius 4, range 10, cd 7, damage 45 + 10)
0–0.3: a sun-wheel sigil (radius 4) draws on at the point. 0.3–0.7: a ring of 10 kite-shield panels assembles around
the edge, standing upright, then tilts inward over the enemies like a closing dome. **0.75 hit**: the dome slams shut
(panels click together at the top), a flash of the core lines, shake 0.35, ground `ShockRefraction` (1 → 5, 0.04).
`ctx.hit(e, { damage: 45, knock: 0 })` within 4; a tick at 1.3 as the dome pulses: `ctx.hit(e, { damage: 10, knock: 0 })`.
1.4–2.2: the dome shatters outward into panels that fade, the sigil fades. Clean by 2.3.

## E · Radiant Parry (`radiantParry.ts`, label `radiant parry`, `self`, radius 12, cd 8, damage 20 + stun 1)
0–0.14: a kite shield of hard light clicks together in front of her chest, six hexes turning round it, four spokes, a halo behind, a sun sigil under her feet. 0.14–0.8: the stance holds, core lines building. The trait (`src/traits/dawn.ts`, `PARRY_SECONDS` 0.8) swallows the FIRST hit and records it in `dawnParries` (keyed by her figure). **Parry:** impact frames `[1, 2]`, a white star and flare, a full sun-ray burst, a refraction ring, shake 0.55, the shield bursts into panels 0.12 s later; at +0.05 s `ctx.hit(enemy, { damage: 20, status: stun 1, projectile: true, knock: 0 })` (not for a unit's hit). **Whiff** (0.86): the glow cuts off, the panels crumble slowly, no flash or shake. Clean by 1.85. Online: the other screen's trait gets no hit reports, so the stun is offline only.

## R · Dawn Descent (`dawnDescent.ts`, label `dawn descent`, `ground`, radius 2.5, range 12, cd 16, damage 50 + stun 1, shield 60)
0–0.12: a sigil draws under her feet, eight blades stand round her. 0.12: the blades burst up and out, a refraction ring leaves her feet, she leaps. 0.12–1.0 (`DESCENT_AIR`, shared with the trait, which blocks every hit meanwhile): a high arc (2.6–5.2 high by distance), a sun disc behind her, falling shard trail, a shadow sigil sliding on the ground; the landing zone (radius 2.5 sun-wheel plus a closing gold ring) is on the ground from the cast and is the telegraph. **1.0 touchdown:** impact frames, sky-blue star, sun rays, panel ring, ground refraction, shake 0.7; whoever is in the zone (live) takes `ctx.hit(e, { damage: 50, knock: 2, status: stun 1 })`; `ctx.shieldSelf(60, 3)`. Clean by 2.6. Flags `dash` and `cc`.
