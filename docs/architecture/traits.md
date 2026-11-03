---
title: Hero identity layer (traits)
tags: [architecture, duel, heroes, traits, passives, buffs, multiplayer]
updated: 2026-11-03
---

# Hero identity layer (traits)

Every hero has, on top of its four spells (design: [hero-identity.md](../../pipeline/designs/hero-identity.md)):

- a **passive** (an always-on rule), shown in the **passive slot** left of Q on the hero bar (name, badge, tooltip);
- a **twist**: its own **resource** (a bar under the passive and under the duel HP bar, for both heroes), a different
  **input** on one spell (hold to charge, a free recast, ammo charges) or **stacks** on the enemy;
- its own **basic attack** (range, damage, speed) and **walk speed**;
- **buffs and debuffs** from its spells: `HeroSpell.buff` (on itself when it casts) and `HeroSpell.debuff` (on what
  the spell hits).

The layer only runs inside a duel (AI or network). Plain hero mode in the editor plays the kits as before.

## Buffs and debuffs

Kept per figure in its `StatusSet` (`src/effects/status.ts`), next to the crowd-control statuses. `amount` is a
fraction, capped at 0.5; a buff lasts at most 6 s; a new one of a kind keeps the stronger amount and the longer time.

| Kind | Effect |
|---|---|
| haste | walks faster (x 1 + amount) |
| might | deals more damage (x 1 + amount) |
| armor | takes less damage (x 1 - amount) |
| vulnerable (debuff) | takes more damage (x 1 + amount) |
| weaken (debuff) | deals less damage (x 1 - amount) |

Slow (x 0.6) stays a status. Hits carry a debuff in `HitOptions.debuff`; `arena.applyBuff(figure, kind, amount,
seconds)` gives one directly (floating word, icon on the bars).

## Files

| File | Role |
|---|---|
| `src/traits/types.ts` | `Trait` (the hooks), `TraitView` (what a hook can see and do), `CastMods`, `TraitHit`, `isBehind` |
| `src/traits/runtime.ts` | `TraitRuntime`: one side's state (resource, stacks, ammo, recast window, `mem`) |
| `src/traits/index.ts` | `TRAITS` by kit name, `traitFor(name)` |
| `src/traits/<theme>.ts` | one hero's trait (same theme name as its kit file) |

## How a hit is resolved

Every hit in a duel passes `Duel.resolve(dealer, victim, opts, mods, kind, slot)` once:

1. damage = spell damage x the cast's `mods.power` (set at the cast: the trait's `castMods`, times the caster's
   might / weaken);
2. x the victim's `takenMul` (armor, vulnerable), when the victim is a hero;
3. the dealer's `dealt` hook, then the victim's `taken` hook (they change `hit.damage` and `hit.opts`);
4. the cast's `status`, `debuff` and `knock` extras are added to the hit;
5. the dealer's `landed` hook learns the hit (resources, heals from damage).

A victim's `taken` hook can set `hit.blocked` (Isolde's ice block, Oblivion's void maw): the hit lands with no damage,
status, debuff, knockback or pull, the dealer's `landed` does not run, and `HitOptions.blocked` carries the swallowed
damage. Online the victim's client reports it as soaked (`hit` with damage 0), so the other screen shows a blue number.

Where it runs: the player's hits on the opponent and its units in the arena's `hitMod` (after `hitFilter`); the
opponent's hits on the player and the player's units in `hitPlayer`, `hitUnit` and the opponent's attacker.

## Trait hooks

| Hook | When | Typical use |
|---|---|---|
| `castMods(t, slot, charge)` | a cast goes out (charge 0..1 on a `hold` slot) | spend combo points for power; every third cast stuns |
| `afterCast(t, slot)` | after it | counters |
| `cooldown(t, slot, base)` | the cooldown the cast gets | half cooldown when empowered; 0 at full tide |
| `canCast(t, slot)` | before aiming | "needs a full meter"; return a reason string |
| `attackMods(t)` | a basic attack is released | every third hit knocks back |
| `dealt(t, hit)` / `taken(t, hit)` | a hit is resolved | backstab +30%; 15% less while standing still |
| `landed(t, hit)` | a hit of this hero's landed | gain a combo point; heal 20% of the damage |
| `tick(t, dt)` | every frame of the fight | momentum from walking; regen when not hit |
| `badge(t)` | the HUD | "3", "2/3" on the passive slot |

Fields: `resource { name, max, color, start }`, `speed` (m/s, default 4), `attack` (overrides of the melee or ranged
default), `hold`, `charges { slot, count, every }`, `recast`, `shieldMul`.

**Per-slot hold and recast (2026-11-03).** `hold` and `recast` take one object or an array, one entry per slot:

- `hold: { slot, seconds }` (or `[...]`): aiming that slot longer charges it, full after `seconds`; `castMods(t, slot,
  charge)` gets 0..1. Mouse: press the key, wait, click. Phone: hold the slot button (a tap casts uncharged), then
  release. The HUD slot shows the charge as a percentage and a gold wedge. A recast and the autopilot cast at charge 1.
- `recast: { slot, window, name, power?, replay? }` (or `[...]`): a free second cast of that slot within `window` s at
  `power` x damage (default 0.6); `recastAct(t, slot)` runs then. Each slot has its own window.
  `replay: false` makes the recast **act only**: it is not aimed, plays no effect and sends no cast message online;
  only `recastAct` runs (blink to the orb with `t.moveTo`, pop a mark). The first cast's cooldown keeps running.
- `TraitRuntime` has `holdOf(slot)`, `recastOf(slot)`, `recastLeft(slot)`, `charge(slot, aimedSeconds)`, `canRecast(slot)`;
  `cast()` returns `{ mods, cooldown, replay }`.

**Order inside a cast.** `castRules` (hero mode) and the AI's `castSpell` run the trait first (`castMods`, `cooldown`,
`afterCast`, or `recastAct` on a recast) and only then play the effect: **`afterCast` runs before the effect's
`play()`**, so before the effect builds its `CastContext`. A `moveTo` in `afterCast` starts a dash; the context's
`from` is still the old spot, because a dash only moves the hero from the next frame on.

**History and moving the hero.** `TraitView.past(secondsAgo)` returns `{ x, z, hp }` of this hero up to 3 s back
(sampled every frame by `tick`; the oldest sample when the round is younger; null before the first). Only the player's
own hero is sampled online, so the other side's `past` is null there. `TraitView.moveTo(p, seconds)` slides this
side's hero with the same dash as `ctx.moveCaster` (`arena.moveFigure`: eased, clamped into the ring and out of the
obstacles, nothing else moves it meanwhile; 0 s is near-instant). Online the opponent side's `moveTo` does nothing:
the other player's client moves its own hero. A jump of more than 4 m between two move reports snaps the hero on the
receiving screen instead of gliding (`Duel.peerMove`, `PEER_JUMP`).

`TraitView` gives: `side`, `time`, `still` (seconds standing still), `self()`, `enemy()`, `status(figure)`, `hp()`,
`maxHp()`, `res` / `addRes(n)`, `say(text)`, `heal(n)`, `buff(kind, amount, s)`, `shield(n, s)`, `payHp(n)`,
`stacks(name)` / `addStacks(name, n, s, max)` / `clearStacks(name)` (stacks this hero keeps on the enemy hero),
`mem` (free counters, cleared every round), `setCooldown(slot, s)` / `cooldownLeft(slot)`, `unitDeaths()`,
`enemyDistance()`, `units()` (where this hero's live summons stand: Sirix's wasps, Ada's turret) and `hold(s)` (this hero
cannot walk or attack; Isolde's ice block, with `canCast` blocking spells).

**Rule:** a trait never makes hits or units of its own. It changes the hits of casts and attacks (damage, status,
debuff, knock), gives its own hero buffs, heals, shields and HP costs, moves resources and stacks, and sets
cooldowns. That keeps it working online, where each client decides the hits on its own hero.

## Online

- A cast and a basic attack carry their `mods` (`cast.mods`, `attack.mods`); the server clamps power to 0.25-3 and
  the extras to the status / buff caps. The victim's client resolves the hit with them.
- `landed` for this side's hits on the other hero runs when the server's `peer_hit` confirms them (it names the cast).
- The other hero's resource travels with its moves (`move.r`), its buffs with `buff` → `peer_buff`, its HP costs with
  `spend` → `peer_spend`. Stacks are decided on the victim's screen and sent back with `stacks` → `peer_stacks`.
- Heals are batched (twice a second).

## Visuals (all new, 2026-10-30)

| What | File | Look |
|---|---|---|
| Buffs / debuffs on a figure | `src/effects/parts/buffs.ts` (`BuffFx`, pooled by the arena per figure) | haste: wind ribbons circling the feet · might: rising embers and a hot waist band · armor: six hexagon plates orbiting the chest · vulnerable: a cracked red sigil over the head · weaken: falling violet drops and a down chevron. A buff pulses in its last second. |
| Stack pips | `src/traits/fx.ts` (`TraitFx.pips`) | tokens over the hero who carries them: toxin drops, chill snowflakes, seed sprouts, void marks, a gem for other kinds |
| Proc bursts | `TraitFx.burst` | a ground ring, a light pillar and shards: small at a hero whose passive fires (its floating word), big where stacks pop |
| Basic attacks | `src/attacks/fx.ts` (`AttackSpec.look`) | 16 missiles (arrow, spear, prism, icicle, dart, spark, note, rivet, gear, bone, petal, drop, wave, sand, ink, orb) and 6 swings (slash, twin, smash, claw, sweep, cleave) with an impact ring |

Sheet: [attack-looks_sheet.jpg](../traits/attack-looks_sheet.jpg).

| Hero | Attack look |
|---|---|
| Nyx twin · Zephyr sweep · Brannoc smash · Oblivion cleave · Sirix claw | melee |
| Vesper drop · Kaia spark · Vex dart · Tempo gear · Lyra arrow · Opaline prism · Auriel spear · Fenna petal · Cantor note · Isolde icicle · Sefu sand · Marin wave · Mortis bone · Ada rivet · Shiori ink | ranged |

## AI

The duel AI uses the same runtime: a hold slot is always fully charged, ammo and `canCast` gate its spell choice,
an open recast counts as a ready spell, its walk speed is the hero's speed scaled to the AI's pace. It holds its spells
while the other hero sits in an ice block, and casts only Q (bait) into an open void maw (`Duel.ward`).

## Basic-attack families (2026-10-31)

Same damage per second, different feel (pipeline/designs/kit-uniqueness.md):

| Family | Range / damage / interval | Heroes |
|---|---|---|
| fast, short | 5.5 m / 8 / 0.7 s (Marin 6.5 m) | Vesper, Fenna, Sefu, Auriel, Marin |
| standard | 6–6.5 m / 9–10 / 1.0 s | Kaia, Vex, Tempo, Cantor, Shiori, Ada, Mortis |
| long, slow | 8–8.5 m / 13 / 1.4 s | Lyra, Opaline, Isolde |
| melee | own numbers | Nyx, Zephyr, Brannoc, Oblivion, Sirix |
