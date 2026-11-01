# Hero roles: design (approved 2026-10-30, being built)

The user's note: "all heroes seem kinda the same, with the same kind of spells. They should be different, like
competitive." This sheet gives each of the 20 heroes a role, a signature and **its own kit shape**, and lists per
spell what changes. Nothing here is built yet.

**Revision 2 (user, 2026-10-30): no hero keeps the template.** The first draft mostly added statuses to the old
Q/W/E/R layout; the user does not want that. Now the slots differ in *what kind of spell* they are (dash, skillshot,
hook, trap, buff, summon, lingering field, execute, line, self-centred ultimate), not only in the status they add,
and no two heroes have the same four shapes.

**Revision 3 (user, 2026-10-30, on approving): "you can even invent new types of spells, like ones you just fire
without a target".** Seven new spell types, built inside the spells themselves (no engine or AI change):

| New type | What it is | How it plays | Who |
|---|---|---|---|
| **QUICK** (no aim) | fires the instant the key is pressed, straight where the hero faces; `self` mode, direction = `caster.group.rotation.y` | aim by turning and walking, not by clicking | Nyx E, Opaline R |
| **NOVA** | a ring that expands from the caster to 5 m; it hits once, on the frame its front passes you | stand far, or inside before it starts | Kaia E |
| **ORBIT** | blades circle the caster for 3 s and hit what they touch (once per pass, at most 3 hits) | keep your distance while it spins | Auriel E |
| **BOOMERANG** | a skillshot that flies out, stops and comes back to the caster, hitting on both legs | dodge it twice | Tempo Q |
| **CHANNEL** | a beam held for 2 s while the caster stands rooted, sweeping across a cone | walk out of the sweep's path | Opaline R |
| **GLOBAL** | an ultimate with no range limit: it lands on the enemy's spot anywhere in the ring after a long warning | keep walking | Lyra R |
| **TRAIL** | a dash that leaves a 3 s strip on the ground that slows whoever crosses it | do not chase over it | Marin E |

Rules they follow so the duel judges them fairly: every hit lies inside one of the spell's telegraphs (the duel
records the zones at the cast and drops hits outside them) or is a `projectile`, and every hit lands within 4.2 s of
the cast (the duel keeps a cast's record 4.5 s).

## Why they feel the same
- **Waves 1–2 (11 heroes)** are one template: Q single target ~50, W ground zone ~55, E self aura with 2 pulses,
  R radius-7 ultimate ~125, 600 HP, no crowd control, no shield, no heal, no dash.
- **Waves 3–5 (9 heroes)** use the mechanics engine but keep the same layout: 6 of 9 E slots are "shield + 2 damage
  pulses", every R is a big ground circle, 7 of 9 W slots are a status zone.
- Many wave 1–2 blurbs already describe crowd control the code never applies (Isolde W "hold everyone", Sefu Q
  "stone shackle", Nyx W "pull them down", Marin W "drawing enemies in", Lyra W "snaps tight", Fenna W "vines coil",
  Vesper Q "the blood comes home"). Those get built.

## Limits this design stays inside
1. **The duel AI only reads kit flags**: `maxHp`, `melee`, `cc`, `dash`, `summon`, `aim: 'line'`, Q's range (it holds
   70% of it) and each spell's mode, range and radius. `src/duel.ts` is being edited by the arena session, so the AI
   is not changed. Every shape below maps onto those flags. No "execute below X% HP" (spells cannot read the target's
   HP) and no ally support (duels are 1v1).
2. *(Synced on 2026-10-30, see docs/architecture/multiplayer.md#mechanics-online.)* **Network duels ignore every mechanic** (status, shield, heal, dash, bolts, summons, pull). Online matches keep
   showing damage-only kits until the multiplayer session syncs them.
3. Engine caps: stun 1.2 s, knock-up 0.8, root 1.5, slow 2.5 (×0.6), silence 1.5, blind 2; 0.5 s stun immunity; pull
   ≤ 4 m with `knock: 0`; one status per hit; ≤ 6 units per side.
4. **All numbers are starting points.** The budget predates the walk-speed halving (heroes 4 m/s, AI 3.5); slows,
   roots, pulls and dashes are worth more now. The tournament sets the final numbers (target 40–60% each).

## Cost tiers
- **T1** numbers and flags: damage, cooldown, range, radius, `maxHp`, `melee`, `cc`.
- **T2** one field on an existing hit or one call at an existing moment: `status`, `pull`, `shieldSelf`, `healSelf`,
  dropping a pulse.
- **T3** a shape change: target-mode change, `enemy` → skillshot `projectile`, adding `moveCaster`, a lingering or
  delayed zone, a spell that now plays at the target instead of round the caster. The look (meshes, palette, shaders)
  stays; the motion path, anchor point and timing change. About 32 of these, so this is a large gameplay pass, but
  not an art redo.

## Roles in a 1v1 duel
| Role | HP | How it wins | Weakness |
|---|---|---|---|
| **Assassin** | 560–680 | dives in, bursts, gets out; smallest, hardest ultimate | low HP, long cooldowns on the dive |
| **Tank** | 820 | outlasts: biggest shield, most hard CC | lowest damage, must walk up |
| **Juggernaut** | 700–760 | drags or drains, heals through the trade | slow to reach a kiter |
| **Mage** | 560–580 | burst or poison that lands; big ultimate | squishy; skillshots and lobs can miss |
| **Marksman** | 520 | out-ranges everyone (14+), steady poke, backstep | lowest HP, dies to a dive |
| **Support** | 640 | sustain (heal, shield) plus one debuff; wins attrition | low burst |
| **Controller** | 600–620 | chains slows, roots and displacement | modest damage |
| **Summoner** | 580 | units fight for it; own spells are light | units die to AoE, cap of 6 |

Roster: assassin 2, tank 1, juggernaut 3, mage 3, marksman 2, support 3, controller 3, summoner 3.

## Shape vocabulary
`TGT` instant hit on the enemy · `BOLT` skillshot (pierce / bounce / split / fan) · `LOB` small delayed circle
(r ≤ 2) · `ZONE` ground circle · `LINGER` zone that stays and ticks · `TRAP` zone that arms, then snaps ·
`LINE` long strip from the caster · `CONE` melee swing · `AURA` burst round the caster · `HOOK` pulls the enemy to
the caster · `TETHER` latches onto the nearest enemy and drains · `DASH` moves the caster in · `BACKSTEP` moves the
caster away · `BLINK` short teleport · `BUFF` shield and/or heal, no damage · `SUMMON` / `TURRET` units · `CAGE` a
prison built round the enemy · `EXECUTE` tiny radius, huge hit · `SELF-R` ultimate round the caster · `FUSE` very
late, very big, easy to see · `SWEEP` wide cone.

## The 20 kits at a glance
> 2026-10-31: some spell types below changed in the uniqueness pass (fewer shields, bounces and self-centred CC
> ultimates); see [kit-uniqueness.md](kit-uniqueness.md).

| Hero | Role | Signature | Q | W | E | R |
|---|---|---|---|---|---|---|
| Nyx | assassin | Shadowstep | DASH strike | AURA silence | QUICK fan ×3 | EXECUTE |
| Zephyr | assassin (melee) | Never stands still | CONE | DASH knock-up | BACKSTEP | DASH ultimate |
| Brannoc | tank (melee) | Anvil lock | CONE slow | LOB stun | BUFF shield + chain pull | SELF-R knock-up |
| Oblivion | juggernaut (melee) | Into the rift | CONE | ZONE pull to him | AURA silence | ZONE pull + silence |
| Vesper | juggernaut (drain) | Blood price | TGT drain | ZONE slow | TETHER drain | ZONE heal per hit |
| Sirix | juggernaut (melee) | The swarm | CONE slow | DASH + wasps | BUFF shield | SUMMON queen ultimate |
| Kaia | mage (burst) | Unavoidable lightning | TGT chain | ZONE 3 strikes | NOVA stun | ZONE r5 burst |
| Vex | mage (poison) | Lingering poison | LOB burn | LINGER slow pool | BUFF heal | LINGER gold field |
| Tempo | mage (chrono) | Rewind | BOOMERANG slow | ZONE stun | BACKSTEP rewind | FUSE |
| Lyra | marksman | Out-range | BOLT bounce | TRAP root | BACKSTEP | GLOBAL hunt |
| Opaline | marksman | Refraction | BOLT split | ZONE blind | BLINK + shield | QUICK CHANNEL sweep |
| Auriel | support | Aegis | BOLT pierce + shield | TRAP stun dome | ORBIT blades + shield | ZONE + big shield |
| Fenna | support | Regrowth | TGT + heal | TGT root (vines) | TURRET | SELF-R heal + root |
| Cantor | support | Silence | BOLT bounce | ZONE silence | BUFF heal + shield | SELF-R stun |
| Isolde | controller | Frostbite, then freeze | BOLT pierce slow | LINE root | AURA slow + armour | SELF-R stun |
| Sefu | controller | Shackles and teeth | TGT root | LINGER slow, then root | AURA shield + slow | ZONE stun |
| Marin | controller | Undertow | HOOK | ZONE pull + knock-up | TRAIL dash + heal | LINE knock-up |
| Mortis | summoner | Raise the dead | BOLT pierce | SUMMON skeletons | CAGE root | ZONE + archers |
| Ada | summoner | Turret engineer | BOLT bounce slow | TURRET | LINGER gear field | ZONE root |
| Shiori | summoner | Ink familiars | BOLT split at end | ZONE root | SUMMON cranes | ZONE blind |

Nobody keeps "TGT / ZONE / AURA / ZONE r7". Ultimates come in ten kinds (EXECUTE, DASH, SELF-R, ZONE, LINGER,
FUSE, CHANNEL, GLOBAL, LINE, SUMMON) with radius 2.5–7.

## Per hero
Format: **slot** spell: change (tier). Numbers are first guesses for the tournament.

### Assassins
**Nyx** (shadow), 560 HP. *Shadowstep*: appears on you, silences you, cuts you down.
- Q Umbral Blink: a **real dash**: she slides beside the target (`moveCaster`, range 7), the two blades cut, 55 (T3).
- W Grasp of the Deep: **round herself** (self mode, r 3): the hands rise and **silence 1.0**, 40 (T3).
- E Night Shroud: **QUICK**: no aim; the three clones fly out where she faces as a fan of 3 skillshots
  (`projectile`, 25° apart, range 9), 3 × 22; self mode, radius 8 so the AI fires it inside 7.4 m (T3).
- R Eclipse Execution: **EXECUTE**: radius 7 → 2.5, range 10, 150 (T1).

**Zephyr** (sky), melee, 680 HP. *Never stands still*: three of his four spells move him.
- Q Gale Edge: cd 2.5 → 2 (T1).
- W Tailwind Rush: unchanged (dash in + knock-up 0.4).
- E Cyclone Guard: **BACKSTEP**: the whirl carries him 5 m away from the enemy, one shove flare, shield 30 (T3).
- R Thousand Winds: radius 7 → 4 (T1).

### Tank and juggernauts
**Brannoc** (forge), melee, 820 HP. *Anvil lock*: most hard CC, biggest shield, low damage.
- Q Rivet Shot: range 10 → 3 (point-blank flick), 35, **slow 0.8** (T1+T2).
- W Anvil Drop: **LOB**: radius → 2, range 8, 35, **stun 1.0**, `cc` (T1+T2).
- E Bellows Ward: **shield 80** for 3 s, the chain bursts **pull 1.5 m** toward him, no damage (T2).
- R Forgefall: **SELF-R**: the hammer falls round him (self mode, r 5), **knock-up 0.5**, 90 (T3).

**Oblivion** (void), melee, 760 HP. *Into the rift*.
- Q Rift Cleave, W Null Tether: unchanged (cone; zone pull 4 + slow).
- E Void Mantle: the shield goes; one pulse that **silences 1.2** (T2).
- R Unmaking: radius 7 → 5 (T1).

**Vesper** (blood), 740 HP, short ranges (8). *Blood price*: every spell heals her.
- Q Hemolance: **heal 15** on hit (T2).
- W Thorn Garden: **slow 1.5** (T2).
- E Crimson Pact: **TETHER**: the heart latches onto the nearest enemy within 6 m and drains it 3 times, healing what
  it deals (T3).
- R Sanguine Eclipse: radius 7 → 6, the harvest **heals 20 per hit** (T2).

**Sirix** (hive), melee, 700 HP. *The swarm*.
- Q Mandible Rend, W Swarm Leap: unchanged.
- E Chitin Carapace: pure shield 60, the slow pulses go (T2).
- R Queen's Descent: the dive drops **3 wasp soldiers** (`summon`, melee) where it lands; stun → slow 1.5; 75 (T3).

### Mages
**Kaia** (storm), 560 HP. *Unavoidable lightning*: the only instant hits.
- Q Arc Lance: the bolt **chains** to a second enemy (a unit) at half damage (T2).
- W Downpour: three strikes at three spots inside the zone, each **slows 1.0** (T2).
- E Static Field: **NOVA**: a ring of arcs expands from her to 5 m in 0.5 s; it **stuns 0.6** whoever its front
  passes, `cc` (T3).
- R Eye of the Storm: radius 7 → 5, 150 (T1).

**Vex** (alchemy), 560 HP. *Lingering poison*.
- Q Volatile Flask: **LOB** at the ground (r 1.6), splash plus one burn tick (T3).
- W Caustic Pool: **LINGER** 4 s, ticks **slow 1.0** (T3).
- E Mutagen: **BUFF**: she drinks it, **heal 45**; the orbiting flasks go (T2).
- R Grand Transmutation: **LINGER**: the gold field stays 3 s, **slows 2.0** each tick, then shatters (T3).

**Tempo** (chrono), 580 HP. *Rewind*.
- Q Second Hand: **BOOMERANG**: the hand flies 10 m, hangs a beat and spins back to him; hits on both legs (each
  enemy at most once per leg), **slow 1.0** (T3).
- W Stopped Moment, E Rewind: unchanged (stun zone; back to the mark + heal).
- R Twelfth Hour: **FUSE**: the clock hangs over the zone 3.5 s, then the hand strikes for 180, no stun; walk out or
  take it (T3).

### Marksmen
**Lyra** (astral), 520 HP. *Out-range*.
- Q Starshot: **skillshot** that bounces once, range 14, cd 2, 40, `aim: 'line'` (T3).
- W Constellation Snare: **TRAP**: the net lies 3 s and snaps when the enemy is inside: **root 1.2**, `cc` (T3).
- E Orbit Veil: **BACKSTEP** 5 m away from the enemy; the orbit fires once, **slow 1.0** (T3).
- R Celestial Hunt: **GLOBAL**: range 60 (the whole ring); the stag is drawn over the enemy's spot and charges it
  after 2.5 s, radius 3, 140 (T1+T3 timing).

**Opaline** (prism), 520 HP. *Refraction*.
- Q Prism Bolt: range 14, cd 2 (T1).
- W Refraction Field: unchanged (blind).
- E Mirror Shell: **BLINK** 4 m toward the aim, shield 45, no damage (T3).
- R Spectrum Lance: **QUICK CHANNEL**: no aim; she holds a beam where she faces for 2 s (rooted) and it sweeps
  70° across, 12 m long, 3 ticks; self mode, radius 12 (T3).

### Supports (1v1: sustain plus a debuff)
**Auriel** (dawn), 640 HP. *Aegis*.
- Q Radiant Spear: **skillshot** that pierces, **shield 20** on hit, `aim: 'line'` (T3).
- W Aegis Wall: **TRAP**: the dome stands open 1.2 s, then slams: **stun 0.8** if inside, `cc` (T2).
- E Halo of Blades: **ORBIT**: the six blades circle her at 2.5 m for 3 s and cut whoever they touch (at most 3
  hits × 10), shield 40 (T3).
- R Judgement of Dawn: radius 6, 95, **shield 80** at impact (T2).

**Fenna** (grove), 640 HP. *Regrowth*.
- Q Bloom Lash: **heal 12** on hit (T2).
- W Overgrowth: **on the enemy** (`enemy` mode, range 9): vines coil round them, **root 1.2**, `cc` (T3).
- E Verdant Ward: **TURRET**: one flowering vine (80 HP, 6 s) that fires petals (T3).
- R World Blossom: **SELF-R**: the flower closes over her (r 5), **heal 70**, **root 1.0** round her (T3).

**Cantor** (bard), 640 HP. *Silence*.
- Q, W, E: unchanged (bounce bolt, silence zone, shield + heal).
- R Crescendo: **SELF-R**: the lyre rises over him, the chord stuns everything within 5 m (T3).

### Controllers
**Isolde** (frost), 600 HP. *Frostbite, then freeze*.
- Q Rime Spear: **skillshot** that pierces, **slow 1.5**, `aim: 'line'` (T3).
- W Frostfern Field: **LINE**: the ferns race 9 m from her along the aim, **root 1.2**, `cc` (T3).
- E Glacial Mantle: ice armour **shield 50**, the blizzard **slows 1.0** (T2).
- R Winter's Crown: **SELF-R**: the crown drives down round her (r 5), **stun 1.0** (T3).

**Sefu** (sand), 600 HP. *Shackles and teeth*.
- Q Sand Lash: **root 0.8**, `cc` (T2).
- W Quicksand: **LINGER** 3 s, ticks **slow**, the closing pillars **root 1.0** (T3).
- E Dune Ward: **shield 45**, the rings **slow 1.0** (T2).
- R Tomb of Kings: **stun 1.0** at the implosion, `cc` (T2).

**Marin** (tide), 620 HP. *Undertow*: moves you where she wants.
- Q Tide Whip: **HOOK**: wraps and **pulls 3 m** toward her (T2).
- W Whirlpool: ticks **pull 1.5 m** inward, the column **knocks up 0.4**, `cc` (T2).
- E Undertow Dance: **TRAIL**: she surfs to the aim (ground mode, range 6), leaving a foam strip for 3 s that
  **slows 1.0**; the landing flare **heals 30** (T3).
- R Leviathan's Waltz: **LINE**: the serpent dives along a 12 m strip from her, **knock-up 0.5** (T3).

### Summoners
**Mortis** (bone), 580 HP. *Raise the dead*.
- Q, W, R: unchanged (pierce bolt; skeletons; hand + archers).
- E Ossuary Ward: **CAGE**: the ribs grow round the *enemy* (`enemy` mode, range 9): **root 1.2**, `cc` (T3).

**Ada** (clockwork), 580 HP. *Turret engineer*.
- Q, W, R: unchanged (bounce slow bolt; turret, cd 12 → 9; gear root).
- E Gear Field: **LINGER** placed at the aim (`ground` mode, range 9): the gears lurch three times over 3 s, each
  **slow 1.0** (T3).

**Shiori** (ink), 580 HP. *Ink familiars*.
- Shape unchanged (split bolt, root zone, cranes, blind R): her kit is already unlike the others. E cd 14 → 12 (T1).

## Status spread after the change
| Kind | Heroes |
|---|---|
| stun | Brannoc W, Auriel W, Kaia E, Tempo W, Cantor R, Isolde R, Sefu R |
| root | Isolde W, Sefu Q/W, Fenna W/R, Lyra W, Mortis E, Shiori W, Ada R |
| knock-up | Zephyr W/R, Marin W/R, Brannoc R |
| pull | Oblivion W/R, Marin Q/W, Brannoc E |
| silence | Cantor W, Oblivion E/R, Nyx W |
| blind | Opaline W, Shiori R |
| heal | Vesper (all), Fenna Q/R, Cantor E, Marin E, Vex E, Tempo E |
| dash / blink / backstep | Nyx Q, Zephyr W/E/R, Sirix W, Tempo E, Lyra E, Opaline E, Marin E |

## Work size
- T3 shape changes: about 32 spells. Wave 1–2 heroes get 1–4 each, waves 3–5 get 0–2.
- T2: about 25 single-field additions. T1: kit data in `src/kits/*.ts` and `src/heroes.ts` (Vesper).
- AI fit: dashes in `enemy` mode, backsteps and blinks as self spells, traps and fuses as ground spells, the `summon`,
  `cc` and `aim: 'line'` flags where listed. The AI is not changed, so a trap or a fuse may play a bit clumsily; the
  tournament will show it.
- Then: tournament until every hero is 40–60%, effect sweep, contact sheets of the reshaped spells, kit sheets, hero
  docs, STATUS.

## After approval
Build by role (assassins and marksmen first: the most shape changes), tsc after each group, a tournament after each
group, then the final balance rounds. Blurbs are rewritten where the shape changes.

## Baseline before any change (2026-10-30)
`_tourney(4)` with cover and the halved walk speed, 1520 fights, 0 timeouts, avg 29 s; win rate out of 152 each:
Brannoc 64, Marin 64, Isolde 63, Vex 63, Kaia 63, Fenna 63, Auriel 61, Oblivion 61, Lyra 58, Mortis 58, Sefu 57,
Nyx 56, Zephyr 55, Vesper 46, Cantor 40, Ada 30, Tempo 27, Sirix 26, Shiori 24, Opaline 21.
The old 41–61% balance no longer holds: the instant-hit template heroes went up, and the skillshot heroes (Opaline,
Shiori, Tempo, Ada) fell, most likely because the new walls end bolts and slower walking makes them easier to dodge.
So skillshots need more damage or speed than the old budget, and the Q → skillshot changes above are checked
against this first.

## As built (2026-10-30)
Built by three workers (brief in the session notes), reviewed on contact sheets, then balanced in three tournament
rounds. Where the build differs from the plan above:
- Vex R: the gold field stands 1.8 s, not 3 s (the 2.0 s build plus the 4.2 s hit limit leave no room).
- Vesper: the lance heals only when it lands (target still within 1.5 m of the aim); the tether heals half of what it
  drains. Without that she won 100% of her fights.
- Cantor R stuns 0.8 s; Mortis E is the cage only (no self shield); Sirix R has no `cc` flag (slow, not stun).
- Auriel's ORBIT roots her for 2 s (the cast root follows the telegraph impact) so the blades stay on her.
- QUICK casts: `arena.context` turns the caster toward the nearest enemy inside a self spell's radius before every
  self cast (player and AI), so a QUICK spell fires at the nearest enemy in reach, not along the walking direction.
  With nobody in reach it fires toward −z (arena.ts falls back to a fixed point), not where the hero faces; the fix is
  one line in `arena.ts` (fallback `from + facing`), left to the session that owns that file.
- Silence spells are not flagged `cc` (the AI's `cc` rule is for stuns and roots).
- Final numbers live in each spell's `default<Name>()` and the kit data; the balance table is in
  `docs/catalog/heroes/README.md`.
