---
title: Kit uniqueness review
tags: [design, heroes, kits, balance, review]
updated: 2026-10-30
status: built 2026-10-31 (all batches)
---

# Kit uniqueness review (2026-10-30)

How different the 20 heroes really play, after the identity layer ([hero-identity.md](hero-identity.md)). Roles and
spell types come from [hero-roles.md](hero-roles.md). Status effects and shields were read from the spell code in
`src/spells/targeted/`; the tooltips were used only for flavour.

**Visual identity is fine.** Every hero has its own theme, spell VFX, icons and basic-attack look. This review is about
mechanics only.

**The 1v1 lens.** A mechanic that only matters against a second target (a bounce "to the nearest other enemy") does
nothing in a duel unless the opponent has summons out, so it does not count as identity.

## Structural sameness (before any spell)

- **Cooldowns:** Q 2–3 s, W 7–9 s, E 9–12 s, R 20 s on every hero. Nobody has a 1.5 s spam Q or a 5 s heavy Q, so
  every fight has the same rhythm.
- **Ranges:** 10–13 m on almost every aimed spell, including both marksmen (Lyra 14, Opaline 14 on Q only).
- **Basic attacks:** 15 of 20 are ranged at 5–8 m, 9–10 damage, a hit about every 1.0 s. Only the look differs. The
  5 melee attacks do differ (Nyx fast and light, Brannoc slow and heavy).

## Mechanic clusters (largest first)

| # | Cluster | Heroes | Note |
|---|---|---|---|
| 1 | **E shields the caster** | Isolde, Sefu, Auriel, Brannoc, Sirix, Cantor, Zephyr, Opaline, Tempo | 9 of 20 E spells (code: `shield` in their effects). Auriel's Q and R shield too. |
| 2 | **W = circle on the ground, CC after a delay** | Lyra (root), Tempo (stun), Auriel (stun), Sefu (root), Shiori (root), Brannoc (stun), Marin (knock-up) | 7 Ws. Also 4 Ws that slow in a zone: Vex, Kaia, Vesper, Oblivion. |
| 3 | **"Every Nth" trait procs** | Vex 5th hit, Isolde 3rd hit, Oblivion 3rd attack, Sirix 4th hit, Kaia 3rd spell, Opaline 3rd attack, Lyra 3rd arrow | 7 counters; they stop reading as identity. |
| 4 | **R = 5 m CC round herself** | Isolde (stun), Cantor (stun), Fenna (root + heal), Brannoc (knock-up) | Same shape and radius. Most other Rs are "colossal object slams a 13 m-range zone". |
| 5 | **Q bounces / chains to a second enemy** | Lyra, Cantor, Ada, Kaia | Dead in 1v1 without summons. |
| 6 | **Q = piercing line spear** | Isolde (slow), Mortis, Auriel (shield) | Mortis's has no rider at all. |
| 7 | **Q = melee cone with a shove** | Sirix (slow), Zephyr, Oblivion | Three of the five melee heroes open the same way. |
| 8 | **Standing still is rewarded** | Lyra (Focus), Ada (Overclock), Brannoc (Anvil stance) | |
| 9 | **Free recast at 60–80% damage** | Auriel W, Tempo E, Shiori E, Oblivion R | Auriel's (slam the dome early) is a real timing choice; the other three are "the same again, weaker". |
| 10 | **Meter fills, next spell empowered** | Brannoc (heat), Zephyr (momentum), Marin (tide) | Fill sources differ (spells / walking / time), so this is the mildest cluster. |

**Pairs:**

- Self-centred silence burst: Nyx W (3 m, 1.0 s) and Oblivion E (4 m, 1.2 s). Same spell.
- 5 m backstep that slows or shoves: Lyra E and Zephyr E.
- Click an enemy, small self-heal: Fenna Q (8) and Vesper Q (6).
- "R spends all points, +X% per point": Nyx (combo) and Opaline (light).
- Bonus damage on a CC'd enemy: Isolde (slowed +15%) and Sefu (rooted +35%, **slowed +15%**). Sefu's slowed clause
  copies Isolde's passive exactly.
- **Duplicate name:** "Rivet Shot" is Ada's Q and Brannoc's Q (different spells, same bar name).

## Per hero: mechanical identity (1 low – 5 high)

| Hero | Score | Unique parts | Generic parts |
|---|---|---|---|
| Tempo | 5 | boomerang Q, avoidable fuse R, Echo cooldown wind | shield E, zone-stun W |
| Vesper | 5 | HP as cost, lifesteal, tether drain E | heal Q (shared with Fenna) |
| Marin | 5 | hook Q, trail dash E, line R, tide reset | zone W |
| Nyx | 4 | dash Q, backstab, combo | silence W (Oblivion copy), R spend (Opaline copy) |
| Lyra | 4 | ammo, global R, trap W | bounce Q, backstep E (Zephyr copy), 3rd-arrow slow |
| Opaline | 4 | channel R, blind W, Refraction | shield blink E, R spend (Nyx copy), 3rd-attack blind |
| Kaia | 4 | nova E, hold Q, Static | chain Q, zone-slow W |
| Vex | 4 | toxin stacks, lob Q | heal E, zone-slow W |
| Mortis | 3 | bones, two summon spells | plain pierce Q |
| Auriel | 3 | orbit E, Aegis, early slam | pierce Q, shields everywhere |
| Brannoc | 3 | heat, the only melee tank | shield E, self-R, standing still |
| Zephyr | 3 | momentum, dash W | cone Q, backstep E, shield |
| Fenna | 3 | regen, seeds, turret | heal Q, self-R |
| Oblivion | 2 | pull W | cone Q, silence E (Nyx copy), recast R, 3rd-attack silence |
| Sirix | 2 | stance switch, leap + wasps | cone Q, shield E, 4th-hit slow |
| Isolde | 2 | chill freeze | pierce Q, shield E, self-R, bonus vs slowed |
| Ada | 2 | turret, scrap | bounce Q, zone-slow E, standing still |
| Sefu | 2 | hold W | four CC spells, shield E, copied passive clause |
| Shiori | 2 | ink weaken trail | zone-root W, recast summon, zone R |
| Cantor | 1 | song meter, Rhythm | bounce Q, shield E, self-stun R |

## Fixes

For each cluster: keep the hero whose role fits the mechanic best, change the others. Cost tiers:

- **T** trait only: one file in `src/traits/`, no network change, about an hour each.
- **S** spell hit logic: edit the spell's effect in `src/spells/targeted/`, keep its VFX; online already works if
  it only changes damage, status or movement.
- **N** new system: a new status or net message (stasis, untargetable, spell shield). Separate work.

Every change moves balance, so each batch ends with a tournament rerun (the 37–61% range will shift).

### Batch A: cheap, trait level (T)

1. **Rename Brannoc's Q** "Rivet Shot" → "Slag Flick" (kit data only; the label stays `rivet shot`).
2. **Sefu:** drop the "slowed +15%" clause; rooted +35% stays. Isolde keeps slowed.
3. **Lyra:** drop the every-third-arrow slow (Focus + ammo is enough identity).
4. **Opaline:** drop the every-third-attack blind; lights are spent by **Mirror Shell** (+15 shield and +1 m blink per
   light) instead of the R, so she no longer copies Nyx.
5. **Oblivion:** drop attack marks → silence (copies cluster 3 and his own E). Event horizon stays.
6. **Sirix passive Hive** → "each of his living wasps gives him +6% damage" (ties the passive to his summons; not a counter).
7. **Ada Overclock** → "a spell cast next to her turret (5 m) costs 30% less cooldown" (an engineer working at her
   station, not a standing-still copy).
8. **Shiori twist** → **Ink reserve**: a 100 ink bar, spells cost ink (20/30/30/50), basic attacks refill 15. The only
   mana hero. Replaces the free second flight (cluster 9).

### Batch B: spell hit logic, keep the VFX (S)

| Cluster | Keep | Change |
|---|---|---|
| 1 shields | Auriel, Brannoc (support, tank), Opaline (blink) | **Isolde E** → armor + slow aura, no shield. **Sefu E** → haste + sand rings, no shield. **Cantor E** → heal + shove, no shield. **Zephyr E** → no shield. **Sirix E** → the stance switch only, no shield. |
| 2 zone CC W | Auriel (dome), Lyra (trap), Marin (pull), Tempo (stop) | **Shiori W** → applies weaken + vulnerable, no root (her ink debuffs instead). **Brannoc W** → slow 1.5 s instead of stun (his CC is the R). |
| 4 self-R | Isolde (stun) | **Cantor R** → no stun: for 4 s every spell he casts is free of cooldown (an encore); fills his song identity. **Fenna R** → no root: a big heal over 3 s for her and a slow on enemies in the bloom. Brannoc keeps the knock-up. |
| 5 bounce Q | Kaia (lightning chains) | **Lyra Q** → no bounce, +30% damage beyond 8 m (sniper). **Cantor Q** → no bounce, a second beat lands on the same spot 0.8 s later. **Ada Q** → no bounce, the rivet sticks and pops 1 s later for a second hit. |
| 6 pierce Q | Isolde (slow), Auriel (shield) | **Mortis Q** → damage +8% per bone held (ties Q to his bar). |
| 7 melee cone Q | Zephyr (shove) | **Oblivion Q** → pulls 1.5 m toward him instead of a knock-back (into his Event horizon). **Sirix Q** → no shove, the slow stays and a second swipe follows 0.3 s later. |
| pairs | Nyx W, Lyra E, Vesper Q | **Oblivion E** → see N1. **Zephyr E** → a short forward wind dash through the enemy instead of a backstep. **Fenna Q** → no heal, adds 2 seeds. |

### Batch C: new systems (N), separate work

1. **Spell shield** for Oblivion E ("Void Mantle swallows the next enemy spell within 2 s"): needs a block result on
   the victim side and a net message so the caster sees the swallow.
2. **Stasis** for Isolde (ice block: untouchable and unable to act for 1.5 s) as an alternative to her E.
3. **Cooldown spread:** give each hero one off-rhythm slot (e.g. Kaia Q 1.5 s at 60% damage, Nyx Q 5 s at 150%).
   Not a system, but it changes every kit's numbers and needs its own tournament.
4. **Basic-attack families:** split the 15 ranged attacks into three (fast and short 4 m, standard 6 m, slow and long
   8 m+) by role.

## As built (2026-10-31)

All three batches are in. Where B and C named the same spell, C won: Isolde's E is the ice block (not an armor aura)
and Oblivion's E is the void maw (a spell shield). Changes against the plan:

- **No new net message** for the ice block or the maw: both are the victim's `taken` hook setting `hit.blocked`; the
  victim's client decides hits on its own hero anyway, and reports the swallowed damage as soaked.
- **Sirix E** keeps a body: a 10% armor buff for 3 s plus the stance flip (a stance flip alone was a dead button).
  Hive is +3% damage per living wasp; the second swipe hits for 35%.
- **Cantor:** his every-third-attack silence is gone too (one more "every Nth" counter). The encore lasts 3 s and gives
  his other spells a 1 s cooldown (tuned down from 4 s with no cooldown); the song meter does not fill during it.
- **Fenna:** the World Blossom heal over time is 60 over 3 s on top of the spell's 45; Bloom Lash x1.15 (it lost its
  heal); regen 4%/s; 0.45 s root per seed.
- **Mortis's Q bone bonus** (+5% per bone held) is a trait rule, so tier T, not S.
- **Zephyr E** keeps its haste buff; it is aimed (`aim: 'line'`, 6 m) and is not flagged `dash` for the AI.
- **Cooldown spread:** Nyx Q 5 s at x1.35, Vex Q 2 s, Zephyr Q 1.5 s, Kaia R 26 s at x1.1, Brannoc W 5 s, Isolde E 10 s,
  Oblivion E 12 s.
- **AI:** holds its spells while the other hero is in an ice block and casts only Q into an open maw.
- **Other numbers after balance:** Ada's rivet pops for 25%, her Q x0.9, Overclock 15%, upgraded turret x1.2; Cantor's
  echo 30%; Lyra's long shot +20%; Opaline +10 shield per light; Sefu's non-W spells x1.15 and rooted +45%;
  Vesper heals 18%; Shiori's ink refills 6/s; Auriel's Aegis +25%; Isolde's Frostbite +20%.
- **Balance:** six tournament rounds (about 5,700 fights, no timeouts); last 1,140-fight run 34-65% (Ada highest).
- **Ice block:** the hold is a floor under the spell's own cast root, and the spell's impact is the shatter, so she is
  free again at 1.5 s.

## Order

A (one session, rerun tournament) → B by cluster, biggest first (1, 4, 5, 7, 2, 6, pairs), a tournament after each
cluster → C one at a time.
