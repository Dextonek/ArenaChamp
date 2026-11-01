# Hero identity layer: design (approved 2026-10-30, being built)

The user, after the roles pass: "the skill set is still kinda same". The roles pass gave every hero its own spell
*shapes* (dash, hook, trap, boomerang, beam), but every hero still runs on the same rules: four spells on cooldowns,
the same walk speed, one of two basic attacks, no passive, no resource, no spell pressed differently. This sheet adds
the layer under the spells. Nothing here is built yet; the spells themselves stay as they are.

The online sync of the mechanics (2026-10-30) comes first, so everything below is planned to work in network duels.

## What each hero gets

1. **A passive**: one always-on rule that changes how you fight.
2. **A twist**, one of:
   - **its own resource** (a second bar under HP) that spells build or spend;
   - **a different input** on one spell: hold to charge, press again for a second part (recast), ammo charges, or a
     stance switch.
3. **Its own basic attack**: range, speed, wind-up, and an on-hit rule (every 3rd hit, a slow, a heal, a stack).
4. **Its own walk speed** (3.6 to 4.6 m/s; today everyone walks 4).

## The 20 heroes

| Hero | Role | Passive | Twist | Basic attack | Walk | Plays like |
|---|---|---|---|---|---|---|
| **Nyx** | assassin | **Backstab**: hits from behind (outside the target's front 120°) deal +30% | **Combo points** (0-5): each spell that hits adds 1; R spends all, +25% damage per point | double dagger, 1.9 m, fast (0.7 s) | 4.6 | circle behind, build to 5, then execute |
| **Zephyr** | assassin | **Tailwind**: walks fastest; +10% speed for 2 s after each spell | **Momentum** (0-100): walking fills it; at 100 the next spell also knocks back 3 m and costs half its cooldown | wind slash, 2.4 m, pushes 1 m | 4.6 | never stop moving |
| **Brannoc** | tank | **Anvil stance**: 15% less damage while standing still | **Heat** (0-100): each spell +35; at 100 the next spell is empowered (+50% damage, stun +0.3 s), then heat vents to 0 and he is slowed 1 s | hammer, 2.6 m, slow (1.6 s); every 3rd hit knocks back 2 m | 3.6 | plant, trade, time the overheat |
| **Oblivion** | juggernaut | **Event horizon**: enemies within 3 m are slowed 10% | **Recast R**: R opens the rift; press R again within 3 s to collapse it (pull everything in and hit again) | void cleave, 2.6 m; hits mark the target, the 3rd mark silences 0.8 s | 3.8 | pull in, keep them in the horizon |
| **Vesper** | juggernaut | **Blood price**: heals 20% of all damage she deals | **HP as cost**: her spells have short cooldowns but cost 4-8% of her max HP; at under 30% HP they cost nothing and deal +20% | drain bolt, 6 m, heals 6 per hit | 4.0 | gamble health, drain it back |
| **Sirix** | juggernaut | **Hive**: every 4th hit he lands spawns a wasp (one at a time, 4 s) | **Stance switch** (E): swarm mode (+20% damage, wasps) or carapace mode (30% less damage, slower); E toggles, 2 s cooldown | claw, 2.4 m; in swarm mode 2 quick swipes | 4.0 | switch at the right moment |
| **Kaia** | mage | **Static**: every 3rd spell she casts stuns 0.4 s on hit | **Hold Q**: hold up to 1.2 s; range 8 → 14 and damage ×1 → ×1.8 with the hold | spark, 6.5 m, jumps to one unit | 4.0 | charge from afar, count to three |
| **Vex** | mage | **Toxin**: her hits add a stack (max 5, 4 s); at 5 stacks they burst for 60 and clear | her spells deal less up front; the stacks do the work (W adds 2, R adds 3) | poison dart, 6.5 m, adds a stack | 4.0 | stack, stack, burst |
| **Tempo** | mage | **Echo**: remembers where he stood and his HP 3 s ago (a ghost shows it) | **Recast E**: E sends him back to the ghost: position, HP and the cooldown of his last spell as they were 3 s ago | clock hand, 6 m, slows 0.5 s | 4.0 | take a bad trade, then undo it |
| **Lyra** | marksman | **Focus**: each second standing still +10% range and damage on Q (max +40%); moving resets it | **Ammo Q**: 3 charges, one back every 2 s, instead of one cooldown | arrow, 8 m (longest), slow (1.2 s) | 4.0 | stand back and pick, reposition between volleys |
| **Opaline** | marksman | **Refraction**: a bolt that misses splits once toward the nearest enemy (half damage) | **Prism charges**: spells that hit store a light (max 3); R fires one extra sweep per light | prism ray, 7 m, every 3rd hit blinds 0.5 s | 4.2 | land shots to power the ultimate |
| **Auriel** | support | **Aegis**: every shield she makes is 30% stronger; while shielded her attacks hit +20% | **Recast W**: the dome lands; press W again to slam it early (stun if inside) | sun spear thrust, 3 m | 3.9 | shield up, punish the overcommit |
| **Fenna** | support | **Regrowth**: heals 2% of her max HP per second while not hit for 3 s | **Seeds** (0-4): every hit plants a seed on the target; Q on a seeded target makes it bloom (root 0.6 s per 2 seeds) | thorn, 6 m, plants a seed | 4.0 | stay healthy, plant, bloom |
| **Cantor** | support | **Rhythm**: casting spells in a new order each time (no slot twice in a row) gives +15% damage | **Song meter** (0-100): every spell adds 25; R needs a full meter (no cooldown otherwise) | note, 6.5 m, every 3rd hit silences 0.4 s | 4.0 | play the kit like a melody |
| **Isolde** | controller | **Frostbite**: slowed enemies take +15% from her | **Chill stacks** on the target (max 3): each hit adds one; at 3 the next hit freezes (stun 0.8 s) | ice shard, 6.5 m, adds chill | 3.9 | slow, chill, shatter |
| **Sefu** | controller | **Sandstorm**: rooted enemies take +20% from her | **Hold W**: the longer she holds (up to 1 s), the bigger the quicksand (r 2 → 4) and the longer the root | sand whip, 4 m, slows 0.4 s | 4.0 | trap first, then the teeth |
| **Marin** | controller | **Undertow**: enemies she pulls or knocks up are slowed 1 s after | **Tide** (0-100): rises 10 per second, her spells spend it; at full tide her spells are free of cooldown for one cast | water lash, 5 m, pulls 0.5 m | 4.1 | drag them where she wants |
| **Mortis** | summoner | **Grave harvest**: every unit that dies (either side) gives him a bone (max 10) | **Bones** spent by W and R: each bone = one more skeleton or +10% damage | bone bolt, 6.5 m | 3.8 | let things die, then raise an army |
| **Ada** | summoner | **Overclock**: her turrets shoot 30% faster while she stands within 4 m of them | **Scrap** (0-100): her hits make scrap; E with 50+ upgrades the newest turret (more HP, slows on hit) | rivet, 6 m, every 3rd hit +10 scrap | 3.9 | build a nest and fight next to it |
| **Shiori** | summoner | **Ink trail**: her familiars leave ink; enemies in ink are slowed 10% | **Recast E**: cranes out; press E again to make them all dive at her target at once | brush stroke, 5 m | 4.1 | draw the field, then strike with everything |

Twists used: 8 own resources (Nyx, Zephyr, Brannoc, Opaline, Cantor, Marin, Mortis, Ada), 4 recasts (Oblivion R,
Tempo E, Auriel W, Shiori E), 3 stacks on the target (Vex, Fenna, Isolde), 2 holds (Kaia Q, Sefu W), 1 ammo
(Lyra Q), 1 stance (Sirix), 1 HP cost (Vesper). No two heroes share a passive and a twist.

## Engine pieces (what has to be built once)

| Piece | What | Where |
|---|---|---|
| Passive hooks | `onHitDealt`, `onHitTaken`, `onCast`, `onTick` per kit; damage multipliers from position (backstab), status (frostbite) or stillness | new `src/kits/traits/`, called from `arena.hit` / `Duel.damagePlayer` / hero mode |
| Resource bar | per-kit `resource { name, max, color, gain rules }`, a bar under the HP bar in the HUD and the duel bar | `heroMode` HUD, duel HUD |
| Target stacks | stacks on a figure (count, timer, icon over the head) | the status slot in `arena.ts` |
| Input twists | `hold` (charge on key held, release casts with a power 0-1), `recast` (second press within a window), `charges` (ammo), `toggle` (stance) | `heroMode` key handling, `HeroSpell` fields |
| Spell power | every spell reads a `ctx.power` multiplier (charge, empowered, combo points) | `CastContext`, then each spell's damage line |
| Basic attack profiles | `AttackSpec` per kit (range, interval, wind-up, speed) plus an on-hit rule | `src/attacks/` |
| Walk speed | `HeroKit.speed` | `heroMode`, duel AI |

**Online:** the client whose hero takes a hit decides it, so anything the *caster* knows (charge time, combo points,
heat, focus) must travel with the cast: `cast.power` (one number) covers it. Stacks and statuses on the victim are
already decided on the victim's side. Passives that change damage taken (Brannoc's stance) run on the victim's side;
passives that change damage dealt travel in `cast.power`.

**AI:** the duel AI needs a small rule per twist (hold = always full charge, recast = after 1 s, ammo = fire when a
charge is ready, stance = swarm when close, carapace when low). Balance comes from the tournament again (target
40-60% each).

## Order of work (after approval)

1. The engine pieces above, tested on two heroes that use most of them (Nyx: resource + passive; Kaia: hold).
2. The other 18 heroes by role, tsc and a tournament after each group.
3. Per-hero basic attack looks (the bolt and slash in each kit's style).
4. Online test with two players, balance rounds, docs, STATUS, contact sheets.

## Decisions (2026-10-30)

- The user approved the sheet ("Yes, build it") and added: **a passive slot for every hero** on the hero bar, and
  **buffs and debuffs** (spells that debuff the enemy, heroes that buff themselves, slowness).
- Walk speeds stay in the small spread (3.6-4.6 m/s), as written above (the open question was not answered; the
  sheet's default was kept).
- Resource bars show for both heroes (under each duel HP bar), so a player can read the enemy's state.
- Buffs / debuffs: haste, might, armor (buffs), vulnerable, weaken (debuffs); slow stays a status. Each hero has one
  spell with a buff or a debuff in its kit data. Engine: [traits.md](../../docs/architecture/traits.md).
- Hold-to-charge: the charge builds while the spell is aimed (key press to the confirming click), so the control scheme
  stays "key aims, click casts".
- Recast: a free second cast of the same spell (at 60% damage) within the window, not a separate action.

## As built (2026-10-30)

**Revised 2026-10-31** by the uniqueness pass ([kit-uniqueness.md](kit-uniqueness.md)): several passives and twists
below changed (Lyra, Opaline, Oblivion, Sirix, Ada, Shiori, Cantor, Fenna, Isolde, Sefu, Mortis). The trait files and
that review are the current rules.

Engine: [traits.md](../../docs/architecture/traits.md). Rule that shaped the deviations: a trait never makes hits or
units of its own (online, each client decides the hits on its own hero), so anything that needed a new hit became a
change to the hero's existing hits. Changes from the table above:

- **Nyx:** combo points +15% per point (balance; was +25%). Vulnerable 15% on Umbral Blink.
- **Zephyr:** momentum fills at 20 per second of walking; at full, the next spell knocks back and gets half its cooldown.
  Tailwind is a 10% haste for 2 s after each spell.
- **Brannoc:** the 1 s self-slow after venting is dropped (no self-debuff); the empowered cast stuns with every hit.
- **Oblivion:** the slow aura became a 0.5 s slow on his own hits within 3 m; the third mark (basic attacks only)
  silences. Recast R "Collapse" is a free second cast at 60%.
- **Vesper:** spells cost 4/5/6/8% max HP, cooldowns x0.7; under 30% HP free and +20%. Heals 20% of damage dealt.
- **Sirix:** no wasp summons; every 4th hit slows 1 s. Stance switch on E (8 s cooldown): swarm +10% damage, carapace
  20% armor.
- **Kaia:** the charged lance gives up to +50% damage, not range (a trait cannot change a spell's range).
- **Vex:** each spell adds its stacks once per cast; the burst is +50.
- **Tempo:** the "ghost 3 s ago" Echo is not buildable; Echo winds his other cooldowns back 0.75 s per cast, and the
  twist is a free second Rewind (recast E).
- **Lyra:** Focus gives +5% Starshot damage per second still (max +20%), not range; 3 Starshot charges, one back every
  3 s; every third arrow slows 0.8 s.
- **Opaline:** Refraction is +20% on a blinded enemy (no "missed bolt" event); each light gives R +15% (not an extra
  sweep).
- **Auriel:** "+20% while shielded" became a 3 s might after each shield spell; Slam is a free second W at 60%.
- **Fenna:** regen 2.5% max HP per second after 2 s without being hit; bloom roots 0.3 s per seed.
- **Isolde:** as designed (chill 3 → 0.8 s stun; +15% on slowed).
- **Sefu:** the charge gives power and a longer root (the radius cannot grow); Sandstorm +30% on rooted, +15% on slowed.
- **Marin:** tide rises 15 per second; the basic attack's small pull is not built.
- **Mortis:** starts each round with 3 bones; bones from every slain unit; W and R spend all for +12% each.
- **Ada:** the turret is her W in the kit (not E), so scrap powers W; Overclock is "+20% after standing still 1 s".
- **Shiori:** ink weakens 15% for 2 s instead of slowing; Second flight is a free second E at 80%.
- **Basic attacks:** Auriel and Sefu use ranged attacks (5 m); melee ones pulled their AI into close range.
