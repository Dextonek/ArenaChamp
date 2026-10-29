# Combat mechanics: status effects and spell types (proposal, 2026-10-29)

User request: "different mechanics like stun or blinded or whatever status effect, and different kinds of spells
like shielding, stunning, AoE, single target, summoning, or a projectile type that can split".

Today every spell is the same kind of thing: damage plus knockback, landing on a timer at a telegraphed zone
(`HitOptions = { damage, knock, from, color }`). This note adds a small status system and five spell archetypes,
gives each of the 11 existing heroes one of them, and builds waves 3–5 around them.

## 1. Status effects (engine)
One `status` field on a hit: `ctx.hit(e, { damage: 30, status: { kind: 'stun', seconds: 1.0 } })`.

| Status | What it does | Hero mode / duel hook | Look (shared parts, `parts/status.ts`) |
|---|---|---|---|
| stun | No move, no cast | extends the existing `rooted` timer and blocks casting | three small stars circling the head |
| root | No move, can cast | blocks `moveTo` only | dark ring plus clamps at the feet, coloured by the caster's kit |
| slow | Move speed × 0.6 | speed multiplier | dragging streaks at the feet |
| silence | Can move, no cast | the HUD greys QWER, and the AI skips casting | a crossed rune over the head |
| blind | Casts land on a random spot near the aim point (miss) | the aim gets a 2.5 random offset; on the player a dark vignette | a dark band over the eyes, plus the screen vignette |
| knock-up | Stun plus lifted 1.2 m | the figure's y offset | uses the figure lift, no extra VFX |

Blind: the offset is rolled at cast time, and the telegraph is drawn at the offset spot, so the target sees the miss
coming and the existing zone dodge checks stay correct.

Skillshot projectiles are a new hit path, not an option on the current one. Hits today land at a fixed impact time
inside a telegraph zone; a bolt needs collision every frame along its path, and a dodge means stepping off the line
before it arrives.

Rules:
- Duration caps: stun ≤ 1.2 s, knock-up ≤ 0.8 s, root ≤ 1.5 s, slow ≤ 2.5 s, silence ≤ 1.5 s, blind ≤ 2 s.
- Re-applying the same status refreshes it; it never stacks.
- A 0.5 s immunity to stun and knock-up follows each one, so no chain-lock.
- The status shows as a floating word ("STUNNED") on the first frame, plus an icon in the HP bar.

## 2. Spell archetypes (what a spell can be)
| Archetype | New engine piece | Example |
|---|---|---|
| Shield | `ctx.shieldSelf(amount, seconds)`: absorbs damage first; a shield bar over the HP bar | Auriel E: halo blades become a 60 shield |
| Skillshot projectile | `ctx.projectile(...)`: flies at speed and hits the first enemy it touches. Dodgeable by moving, not by leaving a zone; the telegraph is a line | Kaia Q: a fast bolt |
| Split / bounce / pierce | Projectile options `split: n` (fans out on hit or at max range), `bounce: n`, `pierce` | wave 4 prism: a beam splits into 3 |
| Summon | `ctx.summon(kind, pos, seconds)`: a small AI unit (`Minion`) that walks to the enemy and attacks, with its own HP; the enemy AI targets it if it is closer | wave 3 bone: skeletons; wave 4 hive: a swarm |
| Dash / blink | `ctx.moveCaster(to, seconds)`: the caster moves as part of the spell | Nyx Q blinks behind the target |
| Heal / lifesteal | `ctx.healSelf(amount)` | Vesper Q heals 30% of its damage |
| AoE / single target | exist today (ground / enemy modes) | |

## 2b. Melee heroes (user, 2026-10-29: "there should also be melee heroes")
A melee kit trades range for toughness and sticking power:
- **HP:** `HeroKit.maxHp` (default 600; melee 750–800).
- **Spells:** short-range swings (Q range 2.5–3.5) with a `cone` telegraph (the shape exists), so they can be
  side-stepped like everything else; one gap closer (dash) to reach a ranged hero; a hard status on contact (stun,
  knock-up or root) so it can make a hit stick.
- **Damage:** the same per-slot budget, but Q cooldown 2.5 s.
- **AI** (`HeroKit.melee: true`): it closes to about 2 m instead of keeping 70% of Q range, dashes in when out of
  range and the dash is ready, and keeps chasing a target that kites.
- **Look:** the hits come from the hero's weapon. The swing arcs are big readable crescents (the `CrescentArc` part),
  with impacts at the weapon tip.

Roster for waves 3–5 (3 of 9 melee): Zephyr (sky, wind-blade skirmisher, dash + knock-up), Sirix (hive, a brawler
with insect claws plus a swarm summon), Oblivion (void, a juggernaut with a pull + silence). The rest stay ranged.

## 3. Existing heroes: one mechanic each (retrofit, small; NOT doing this, the user chose waves 3–5 only)
| Hero | Spell | New mechanic |
|---|---|---|
| Vesper (blood) | Q | lifesteal 30% |
| Brannoc (forge) | W | knock-up 0.6 s |
| Isolde (frost) | W | root 1.2 s |
| Lyra (astral) | Q | skillshot projectile |
| Vex (alchemy) | W | slow 2 s |
| Kaia (storm) | E | stun 0.8 s (first pulse only) |
| Sefu (sand) | E | shield 50 |
| Nyx (shadow) | Q blink, R | blind 1.5 s |
| Fenna (grove) | W | root 1.0 s |
| Auriel (dawn) | E | shield 60 |
| Marin (tide) | W | pull plus slow 1.5 s |

The visuals mostly stay; some get a small cue (Isolde's root: ice at the feet). The damage budget per slot drops a
little where a strong status is added: a stun or root takes ~10 off the slot. The tournament checks the result.

## 4. Waves 3–5 designed around archetypes
- Wave 3: sky Zephyr (melee: dash + knock-up), bone Mortis (summon skeletons), clockwork Ada (turret summon + slow).
- Wave 4: prism Opaline (split beams), hive Sirix (melee brawler + swarm summon), bard Cantor (silence + team shield).
- Wave 5: void Oblivion (melee juggernaut: pull + silence), ink Shiori (blind), chrono Tempo (stun + rewind = heal back to HP 2 s ago).

## 5. AI and multiplayer
- **AI** (`duel.ts`):
  - It casts a crowd-control spell first when the enemy is in range.
  - It shields when its HP is under 50% or an enemy ultimate is coming.
  - It dodges skillshots by stepping sideways.
  - It attacks summons that block it.
- **Network duels**:
  - The status, shield and summon events travel as cast results: `tookHit` gets `status`, plus `shield` and
    `summon` messages.
  - This touches `src/net/` and `src/game/`, which the multiplayer session owns, so that part goes to that session
    (or waits until it is idle).

## 6. Order of work
1. Engine, one piece at a time, by risk, each with a test spell and a quick tournament check:
   - statuses (built on `rooted`), plus the zone-hit fix from the STATUS known issues;
   - shield;
   - dash and heal, plus melee support (`maxHp`, the `melee` AI, a cone-swing test spell);
   - skillshot projectile with split, bounce and pierce;
   - summons (a new unit type with HP and AI targeting, the biggest piece).

   This work touches `arena.ts`, `heroMode.ts` and `duel.ts`, which the multiplayer session also edits in this
   folder. Only one writer at a time.
2. Retrofit the 11 heroes (table 3), review the sheets, run the tournament.
3. Waves 3–5 with these archetypes.
4. Network sync, in the multiplayer session.
