# Dota 2 heroes N to Z: every ability, how it is cast, and its counterplay (patch 7.42)

## For each hero N-Z, what are its abilities and how is each cast and targeted?

### Takeaway
The 61 heroes from Naga Siren to Zeus have 346 ability entries in patch 7.42. That count includes innate abilities, abilities granted by Aghanim's Scepter (13) or Shard (22), and Ringmaster's four souvenir abilities. Facets no longer exist: they were removed in 7.41.

Activation splits into four big groups: Passive 88, Unit Target 79, No Target 75 and Point Target 64. The rarer kinds together make up about 12% of entries: channel 14, autocast attack modifier 8, unit-or-point 7, vector 5, toggle 5, plus 11 abilities with base charges (counted across the other kinds; 5 of the 11 are Ringmaster's souvenir stacks and Viper Strike's unconfirmed value). These rare kinds hold most of the distinctive design in this half: Swashbuckle, Aether Remnant, Rearm, Phase Shift, Shrapnel, Proximity Mines and Astral Step.

### Cited Findings
**Sources and patch**
- **Current patch: 7.42**, released 2026-11-18 (timestamp 1794988800), one day before this research. The patch before it is 7.41f. — [Dota 2 patch list feed](https://www.dota2.com/datafeed/patchnoteslist?language=english); [7.42 notes feed](https://www.dota2.com/datafeed/patchnotes?version=7.42&language=english)
- **Facets are gone.** The 7.41 notes say "Facets removed from the game". They also say innate abilities no longer scale with other abilities. The hero feed still carries leftover per-ability `facets_loc` strings (for example on Rubick and Naga) and an empty `facets` list, so facets are not listed here. — [7.41 notes feed](https://www.dota2.com/datafeed/patchnotes?version=7.41&language=english)
- **All hero and ability data comes from Valve's official hero data feed**, one `herodata` call per hero; each hero heading links to its own feed. The feed already reflects 7.42. Checks against the 7.42 notes:
  - Pangolier's Swashbuckle shows 4 strikes of 25/50/75/100 (notes: 3 to 4 strikes, damage lowered).
  - Tinker's Warp Flare shows a 100% slow instead of a root.
  - Undying's new Shard ability Zombie Bite is present.
  - Pugna's Oblivion Savant has the new Scepter charges.
  - Sources: [Pangolier feed](https://www.dota2.com/datafeed/herodata?language=english&hero_id=120); [Tinker feed](https://www.dota2.com/datafeed/herodata?language=english&hero_id=34); [Undying feed](https://www.dota2.com/datafeed/herodata?language=english&hero_id=85); [7.42 notes feed](https://www.dota2.com/datafeed/patchnotes?version=7.42&language=english)
- **No wikis were used.** Liquipedia and the Fandom wiki would still show 7.41f values one day after the patch, so the official feed is the newer source.
- **7.42 rule changes that affect every entry below** — [7.42 notes feed](https://www.dota2.com/datafeed/patchnotes?version=7.42&language=english):
  - Abilities that pierce debuff immunity no longer ignore the magic resistance that debuff immunity gives.
  - Leashes that do not explicitly pierce debuff immunity (for example Slark's Pounce) no longer stop movement abilities.
  - The Break rules of many innate abilities changed. Several innates in this half are now "fully disabled by Break" (Snapfire's Boomstick, Terrorblade's Dark Unity, Tusk's Bitter Chill, Void Spirit's Intrinsic Edge). Others are "partially disabled" (Silencer's Suffer In Silence, Spirit Breaker's Empowering Haste, Techies' M.A.D., Windranger's Tailwind).
  - Most magic and pure spell damage was lowered, and so were the item contributions to spell amplification, area and cast range.
  - A new stat, **Item Potency**, scales the on-hit item effects of attacks. Many N-Z abilities now carry their own potency value: Swashbuckle 60%, Stinger 60%, Assassinate +20-50%, Astral Step +25%, Geminate Attack +15%, Focus Fire 75%, Riki's Backstab +10%. Illusions default to 20%.

**How to read each entry**
- **The first line is decoded by script from the feed:**
  - **Activation** comes from the `behavior` bitmask: Passive, No Target, Unit Target (ally / enemy / ally or enemy / any unit, custom rules), Point Target, Unit or Point Target, AoE, Aura, Vector Target, Toggle, Autocast, attack modifier (orb), and "Channeled up to N s".
  - **Charges** come from `AbilityCharges`, or from `max_charges` when Scepter adds them.
  - **"instant (no cast point)"** means a cast point of 0 or the IMMEDIATE flag.
  - **"pierces immunity"** is the feed's legacy `SPELL_IMMUNITY` field, which in-game is now called debuff immunity.
  - **"dispellable"** reads: basic dispel, strong dispel only, or no. A "no" on an ability without a lingering effect only means "not applicable".
  - **Numbers:** cooldown in seconds, mana cost and cast range per level; the cast point is the wind-up before the effect happens. **"upgraded by"** says whether a Scepter or Shard changes the ability.
- **"What it does"** is my paraphrase of the feed's description, notes and values. Number ranges such as "100-280" run from level 1 to max level.
- **"Aghanim's Scepter / Shard"** paraphrases the feed's `scepter_loc` / `shard_loc` text and values. Where the feed and the 7.42 notes disagree, the entry says so.
- **"Counterplay"** is my analysis using standard Dota rules. It is inferred unless it quotes a feed note. The feed's explicit counterplay statements are collected in the second section.
- **Generic terms:**
  - **Disjoint:** blink, invulnerability or untargetable states make tracking projectiles miss.
  - **Linken's Sphere:** blocks one enemy unit-targeted spell.
  - **Lotus Orb:** reflects one enemy unit-targeted spell.
  - **Basic dispel:** removes most buffs and debuffs, but not stuns.
  - **Strong dispel:** also removes stuns and hard disables.
  - **Break:** turns passives off.
  - **True sight:** reveals invisible units.

**Per-hero reference** (alphabetical by in-game name; abilities in the feed's order. That order is usually the three basic abilities, then any Scepter or Shard ability, then the innate and the ultimate, though not always)

#### Naga Siren | Agility | Melee | attack range 150 | move speed 330 | [feed](https://www.dota2.com/datafeed/herodata?language=english&hero_id=89)

*Illusion carry with a team-wide sleep ultimate.*

- **Mirror Image**: No Target, cast point 0.4 s. Cooldown 40/35/30/25 s; mana 75/90/105/120.
  - What it does: Makes 3 controllable illusions for 26s that deal 25-40% damage and take 350% damage. During the 0.4s cast she is invulnerable for 0.5s and gets a basic dispel on herself; old images are destroyed on recast.
  - Counterplay: The invulnerability disjoints projectiles and dodges stuns, so it is also her escape. Illusions die fast to AoE (350% damage taken); the 0.4s animation and the puff of smoke are the tell.
- **Ensnare**: Unit Target (enemy), cast point 0.3 s. Pierces immunity: no; dispellable: yes (basic dispel); cooldown 21/18/15/12 s; mana 70/80/90/100; cast range 500/525/550/575; upgraded by Scepter.
  - What it does: Throws a net projectile that roots the target 2.75-5s (no walking, no blinking) and interrupts channels. Can target enemies inside her own Song. Nearby illusions throw decoy nets (value fake_ensnare_distance 900; decoy behaviour not confirmed in text).
  - Aghanim's Scepter / Shard: Scepter: longer cast range and faster net, pierces debuff immunity, and the root also applies Break (passives off).
  - Counterplay: Net is a projectile: disjoint (blink, invulnerability) or Linken's Sphere stops it; basic dispel removes the root; debuff immunity blocks it (until Scepter).
- **Rip Tide**: Passive. Magical damage; pierces immunity: no; dispellable: yes (basic dispel).
  - What it does: Every 6th attack by Naga or any of her illusions hits all enemies within 300 for 30-60 magic damage and -3.5 to -8 armor for 4s.
  - Counterplay: Kill the illusions to slow the attack count; armor debuff is basic-dispellable.
- **Eelskin** (Innate): Passive.
  - What it does: Evasion of 4% for every other Naga (real or illusion) within 900. More images = harder to hit.
  - Counterplay: Accuracy items (true strike), magic damage, killing illusions.
- **Song of the Siren** (Ultimate): No Target, cast point 1 s. Pierces immunity: no; dispellable: no; cooldown 160/130/100 s; mana 150/250/350; cast range 900/1150/1400; upgraded by Shard.
  - What it does: After a long 1s cast, every enemy within 900-1400 around Naga falls asleep for 7s: they cannot act and are invulnerable (nobody can damage them). The area follows Naga; enemies she walks away from wake up. Recast ends it early, letting her team set up (e.g., Ensnare on sleepers, then wake).
  - Aghanim's Scepter / Shard: Shard: allies inside also restore health and mana per second (heal values listed 1-3% per second, mana 4% per second with Shard; base-vs-Shard split unclear in the feed).
  - Counterplay: 1s cast point is a clear warning; debuff immunity makes you ignore it; it cannot be dispelled. Used mostly as a reset/escape, so the counter is to disengage or kill Naga before cast.

#### Nature's Prophet | Universal | Ranged | attack range 600 | move speed 295 | [feed](https://www.dota2.com/datafeed/herodata?language=english&hero_id=53)

*Global map presence: teleport anywhere, global nuke, tree summoning.*

- **Sprout**: Unit or Point Target, cast point 0.35 s. Magical damage; cooldown 14/12/10/8 s; mana 70/80/90/100; cast range 625/700/775/850.
  - What it does: Grows a ring of trees around a unit or a point, trapping it for 2.5-4s; deals 70-280 magic damage in 275 radius and gives 400 vision. Trees behave like normal trees (can be cut).
  - Counterplay: No projectile, cannot be dodged; cut a tree (Quelling Blade, Tango, tree-destroying spells), blink/Force Staff/teleport out, or walk out through a pathing gap.
- **Teleportation**: Point Target, AoE, cast point 3 s. Physical damage; pierces immunity: no; dispellable: yes (basic dispel); cooldown 80/60/40/20 s; mana 50/60/70/80.
  - What it does: Teleports to any point on the map after a 3s cast point (the cast point is the teleport time). A visible effect appears at the destination for both teams. No mana or cooldown is spent if interrupted.
  - Counterplay: Any stun, silence or hex in the 3s cancels it; watch the destination marker and wait there.
- **Nature's Call**: Point Target, AoE, cast point 0.5 s. Cooldown 45/40/35/30 s; mana 85/90/95/100; cast range 750.
  - What it does: Turns trees in a 150-375 radius into up to 2-5 treants for 50s (425-500 HP, 1-4 armor, extra damage to heroes, walk through trees). Needs trees in the area.
  - Counterplay: AoE damage farms them (they give bounty); fight away from trees.
- **Curse of the Oldgrowth** (granted by Aghanim's Shard): Passive. Magical damage; pierces immunity: no; dispellable: yes (basic dispel).
  - What it does: Attacks from Prophet put a stacking curse on the target: 24 magic damage per second and a move slow for 5s; treants apply a half-strength curse; each attacker keeps one independent stack.
  - Counterplay: Basic dispel removes it. Note: 7.42 patch notes say 12% slow (6% treants) but the feed lists 10% (5%); conflict unresolved.
- **Spirit of the Forest** (Innate): Passive. Dispellable: no.
  - What it does: Attacks deal +2% base damage per tree within 300 of the target; treants near the target count double. Treants have this too.
  - Counterplay: Fight in open ground; Break-type rules unconfirmed.
- **Wrath of Nature** (Ultimate): Unit or Point Target, cast point 0.5 s. Magical damage; pierces immunity: no; dispellable: yes (basic dispel); cooldown 85 s; mana 130/160/190; upgraded by Scepter.
  - What it does: Global bouncing bolt cast on a unit or point (even through the minimap): hits up to 16 visible enemies starting with the closest to the cast point, 100-180 magic damage, +10% per bounce, 0.15s between jumps.
  - Aghanim's Scepter / Shard: Scepter: every enemy hit is rooted 1.5s, rising to 3s at the last bounce.
  - Counterplay: Only hits units in vision: stay in fog or invisible; magic resistance. Not dodgeable once you are seen.

#### Necrophos | Intelligence | Ranged | attack range 500 | move speed 280 | [feed](https://www.dota2.com/datafeed/herodata?language=english&hero_id=36)

*Sustain mage that heals allies and drains enemies; execute ultimate.*

- **Death Pulse**: No Target, instant (no cast point). Magical damage; pierces immunity: no (allies: yes); cooldown 8/7/6/5 s; mana 115/130/145/160.
  - What it does: Instant pulse around Necrophos: slow projectiles (400 speed) to every enemy within 500 (100-280 magic) and every ally (heal 70-130).
  - Counterplay: Projectiles cannot be disjointed (stated). Only range escapes it: be outside 500 at cast.
- **Ghost Shroud**: No Target, instant (no cast point). Pierces immunity: no; dispellable: yes (basic dispel); cooldown 28/24/20/16 s; mana 75.
  - What it does: Instant self-cast: Necrophos becomes ethereal 3-4.5s (cannot attack or be attacked physically), takes 20% more magic damage, gets +45-75% healing amplification and slows enemies within 700 by 16-25%.
  - Counterplay: Magic burst during the shroud (he takes more); the buff is basic-dispellable (e.g., Nullifier-type effects).
- **Heartstopper Aura**: Passive, Aura. Magical damage; pierces immunity: yes; dispellable: no; upgraded by Scepter.
  - What it does: Aura 700: enemies lose 0.8-2.3% of max health per second as magic damage. Pierces debuff immunity; does not cancel Blink Dagger.
  - Aghanim's Scepter / Shard: Scepter: adds 45% of Necrophos's current health regeneration to the per-second damage.
  - Counterplay: Stay outside 700; Break turns it off (passive). Does not affect ancient creeps.
- **Death Seeker** (granted by Aghanim's Shard): Unit Target (ally or enemy), cast point 0.2 s. Magical damage; pierces immunity: no; dispellable: yes (basic dispel); cooldown 20 s; mana 160; cast range 600.
  - What it does: Shard. Target an ally or enemy within 600: Necrophos travels as a giant Death Pulse to the target's position, then spreads a Death Pulse to nearby units. Values suggest it also applies a 2.5s ethereal state and -25% magic resistance (exact target of these not stated).
  - Counterplay: Cannot be cast while rooted; does not trigger spell reflect. Travel is visible.
- **Sadist** (Innate): Passive.
  - What it does: Each unit he kills gives 3.3 (+0.2 per level per 7.42 notes) health and mana regen for 8s; hero kills count x4.
  - Counterplay: Break stops new stacks (existing ones stay).
- **Reaper's Scythe** (Ultimate): Unit Target (enemy), cast point 0.45 s. Magical damage; pierces immunity: no; dispellable: no; cooldown 100 s; mana 250/375/500; cast range 600.
  - What it does: Targets an enemy hero within 600: stuns 1.5s, then at the end of the stun deals 0.7-0.9 magic damage per point of missing health. Kills during the effect are credited to Necrophos, who gains permanent regen per kill.
  - Counterplay: Linken's Sphere blocks; debuff immunity blocks; not dispellable once applied. Heal up or keep health high (damage scales with missing health); the 0.45s cast point is a short warning.

#### Night Stalker | Strength | Melee | attack range 150 | move speed 295 | [feed](https://www.dota2.com/datafeed/herodata?language=english&hero_id=60)

*Day/night hero: much stronger at night; can force night.*

- **Void**: Unit Target (enemy), cast point 0.3 s. Magical damage; pierces immunity: no; dispellable: yes (basic dispel); cooldown 11/10/9/8 s; mana 90/95/100/105; cast range 525; upgraded by Shard.
  - What it does: Targeted magic nuke (80-320) that slows movement and attack speed by 50% for 1.25s by day, 1.6-3.4s at night; at night it also mini-stuns (interrupts channels).
  - Aghanim's Scepter / Shard: Shard: hits all enemies within 400 of the target.
  - Counterplay: Instant, no projectile; Linken's blocks; slow is basic-dispellable.
- **Crippling Fear**: No Target, instant (no cast point). Magical damage; pierces immunity: no; dispellable: no; cooldown 30/25/20/15 s; mana 50.
  - What it does: Instant self-centred effect: enemies within 350 are silenced and take 25-40 damage per second while they stay near him, 3s by day, 4.5-6s at night.
  - Counterplay: Step outside 350 to drop the silence; not dispellable; debuff immunity blocks.
- **Midnight Feast**: Passive. Pierces immunity: no; cooldown 39/36/33/30 s.
  - What it does: Passive heal of 12-24 per attack (reduced on non-heroes). At night it can also be used on a non-ancient creep in melee range to kill it and restore 12-24% max health and 10-16% max mana (30-39s cooldown).
  - Counterplay: Kill or deny camps; reduce healing (heal reduction effects).
- **Hunter in the Night** (Innate): Passive. Upgraded by Scepter.
  - What it does: At night: +24% move speed and +38 attack speed.
  - Aghanim's Scepter / Shard: Scepter: night bonus rises further (+15% move speed and +70 attack speed per the values) and killing an enemy hero resets his basic ability cooldowns. The feed's Shard text (eat a creep) appears to describe what Midnight Feast now does; treat as possibly stale.
  - Counterplay: Fight him by day.
- **Dark Ascension** (Ultimate): No Target, cast point 0.3 s. Physical damage; dispellable: no; cooldown 140/135/130 s; mana 125/175/225.
  - What it does: Forces night for the whole map for 30s, gives him flying (ignores trees and cliffs, unobstructed vision) and +50-150 attack damage.
  - Counterplay: Enemy vision drops at night; group up, use wards and stay near allies; not dispellable.

#### Nyx Assassin | Universal | Melee | attack range 150 | move speed 310 | [feed](https://www.dota2.com/datafeed/herodata?language=english&hero_id=88)

*Burst and anti-mage ambusher with a reflect shell and long invisibility.*

- **Impale**: Point Target, cast point 0.3 s. Magical damage; pierces immunity: no; dispellable: strong dispel only; cooldown 17/15/13/11 s; mana 90/100/110/120; cast range 750.
  - What it does: A line of spikes (750 long, 140 wide, 1600 speed) from Nyx toward a point: 100-280 magic damage, enemies tossed up and stunned 1.25-2s.
  - Counterplay: Ground wave, sidestep the line; Linken's does not block it; stun needs a strong dispel.
- **Mind Flare**: Unit Target (enemy), AoE, cast point 0.4 s. Magical damage; pierces immunity: no; cooldown 11/9.5/8/6.5 s; mana 100/105/110/115; cast range 800.
  - What it does: Targeted: deals 20-35% of the target's max mana as magic damage and burns 12.5-20% of its mana.
  - Counterplay: Low-mana heroes take little; Linken's blocks; instant.
- **Spiked Carapace**: No Target, instant (no cast point). Pierces immunity: no; dispellable: no; cooldown 20/16/12/8 s; mana 40.
  - What it does: Instant 2s shell: the first damage from each enemy player-controlled source is negated and reflected at 140% (same damage type), and that source is stunned 0.7-1.6s. Does not break Vendetta's invisibility.
  - Counterplay: The spikes are visible: stop attacking and casting for 2s; damage-over-time ticks will trigger it. Reflected damage cannot be reflected back.
- **Burrow** (granted by Aghanim's Scepter): No Target, cast point 1.5 s. Dispellable: no.
  - What it does: Scepter ability. 1.5s to dig in; while burrowed Nyx is stationary, invisible, cannot attack, takes 40% less damage, gets +400 cast range on Impale and Mind Flare, Impale cooldown -25%, Carapace becomes an instant 350-radius stun, and Scarab Metabolism runs at 3x.
  - Counterplay: True sight reveals him; he cannot move, so area damage and dive punish it. Casting Vendetta ends it.
- **Scarab Metabolism** (Innate): Passive. Dispellable: no.
  - What it does: After 3s without taking damage: +5 (+1 per level) move speed and 0.35% max health and mana regeneration per second.
  - Counterplay: Any damage resets the 3s timer; Break disables it.
- **Vendetta** (Ultimate): No Target, instant (no cast point). Pure damage; pierces immunity: yes; dispellable: no; cooldown 80/70/60 s; mana 180/240/300; upgraded by Shard.
  - What it does: Instant (works while channeling): invisible for 45-55s with +16-20% move speed. The attack that breaks invisibility gets +75 range, a 70% faster swing, +300-500 pure bonus damage and applies Break 4s. Breaking invisibility with a spell loses the bonus.
  - Aghanim's Scepter / Shard: Shard: lower cooldown; for the first 15s, +200 move speed and unobstructed pathing (moves through trees and terrain); the Break lands before the damage.
  - Counterplay: True sight (Dust, Sentry Ward, Gem) cancels the ambush; the damage pierces debuff immunity.

#### Ogre Magi | Strength | Melee | attack range 150 | move speed 295 | [feed](https://www.dota2.com/datafeed/herodata?language=english&hero_id=84)

*Strength caster whose ultimate randomly repeats his spells.*

- **Fireblast**: Unit Target (enemy), cast point 0.45 s. Magical damage; pierces immunity: no; dispellable: strong dispel only; cooldown 14/12/10/8 s; mana 85/95/105/115; cast range 525; upgraded by Scepter.
  - What it does: Targeted stun: 100-250 magic damage, 1.2s stun. With Multicast it repeats on the same target every 0.6s.
  - Aghanim's Scepter / Shard: Scepter: lower cooldown and 25% faster cast, plus the Unrefined Fireblast ability below.
  - Counterplay: Instant (no projectile, to our knowledge); Linken's blocks one hit; strong dispel removes the stun.
- **Ignite**: Unit Target (enemy), AoE, cast point 0.35 s. Magical damage; pierces immunity: no; dispellable: yes (basic dispel); cooldown 17 s; mana 80/90/100/110; cast range 700/800/900/1000.
  - What it does: Fire projectile (1000 speed) at the target plus one random other enemy: 10-55 magic damage per second and 25% slow for 7s; re-hits add duration. Multicast copies go to random enemies within 1400.
  - Counterplay: Projectile can be disjointed; burn is basic-dispellable.
- **Bloodlust**: Unit Target (ally), Autocast, cast point 0.45 s. Affects debuff-immune allies: yes; dispellable: yes (basic dispel); cooldown 20/18/16/14 s; mana 40/50/60/70; cast range 650.
  - What it does: Ally buff (towers too, autocast-able): +6-12% move speed and +35-80 attack speed for 30s (+40-100 if self-cast). Multicast adds random allies within 700.
  - Counterplay: Dispel the buff (basic dispel).
- **Unrefined Fireblast** (granted by Aghanim's Scepter): Unit Target (enemy), cast point 0.45 s. Magical damage; pierces immunity: no; dispellable: strong dispel only; cooldown 7 s; mana 400; cast range 525.
  - What it does: Scepter ability. Fireblast that costs 35% of Ogre's current mana and has a 7s cooldown: 150 + 1.5x Strength magic damage and 1.2s stun.
  - Counterplay: Same as Fireblast. Its cost is a percentage of his current mana, so mana burn does not weaken it, but an empty pool stops it.
- **Fire Shield** (granted by Aghanim's Shard): Unit Target (ally), cast point 0.2 s. Magical damage; pierces immunity: no; dispellable: yes (basic dispel); cooldown 15 s; mana 50; cast range 600.
  - What it does: Shard. Shield on an ally or tower for 25s: absorbs 85% of the next 3 hero attacks; each absorbed hit fires a fireball (160 magic) back at the attacker. Multicast spreads it to random allies within 1000.
  - Counterplay: Attack another target, use spells, or dispel the shield (basic dispel).
- **Dumb Luck** (Innate): Passive.
  - What it does: Ogre's Intelligence is locked at 0; he gets mana (6 per point) and mana regen (0.02 per point) from Strength instead.
  - Counterplay: Mana burn hurts him a lot (small pool early).
- **Multicast** (Ultimate): Passive.
  - What it does: Passive chance to cast targeted abilities and items 2, 3 or 4 times; extra copies hit extra random enemies/allies around him, except Fireblast which hits the same target again. +1% chance per 16 Strength. Feed values: 2x 75, 3x 30 (levels 2-3), 4x 15 (level 3); whether those are flat chances or weights is not stated (unconfirmed).
  - Counterplay: Bait spells early; Linken's Sphere only blocks the first of a multicast chain.

#### Omniknight | Strength | Melee | attack range 150 | move speed 310 | [feed](https://www.dota2.com/datafeed/herodata?language=english&hero_id=57)

*Holy healer: pure-damage heal, debuff immunity on an ally, physical-damage immunity ultimate.*

- **Purification**: Unit Target (ally), AoE, cast point 0.2 s. Pure damage; pierces immunity: yes; cooldown 15/14/13/12 s; mana 90/105/120/135; cast range 700; upgraded by Shard.
  - What it does: Heals an ally (or himself) 90-300 and deals the same amount as pure damage to enemies within 260 of that ally. Pierces debuff immunity.
  - Aghanim's Scepter / Shard: Shard: 3s later the target is purified again at 65% strength.
  - Counterplay: Instant; do not stand next to the ally he is saving.
- **Repel**: Unit Target (ally), cast point 0.3 s. Affects debuff-immune allies: yes; dispellable: yes (basic dispel); cooldown 40/35/30/25 s; mana 90/105/120/135; cast range 700.
  - What it does: Ally hero gets debuff immunity, 60% magic resistance and +8-20 health regen for 5s.
  - Counterplay: Physical damage still lands; the buff is dispellable by enemy dispel.
- **Hammer of Purity**: Unit Target (enemy), Autocast, attack modifier (orb), instant (no cast point). Pure damage; pierces immunity: yes; dispellable: yes (basic dispel); cooldown 13/10/7/4 s; cast range 150.
  - What it does: Autocast attack modifier: the next attack gets +75 range, deals pure bonus damage (30-90 plus 25-85% of base damage as listed), slows 75% for 0.2s, and heals Omniknight 40% of the damage over 4s (attack damage included since 7.42). Cooldown 13-4s.
  - Counterplay: Pierces debuff immunity; kite him (melee).
- **Degen Aura** (Innate): Passive, Aura. Pierces immunity: no.
  - What it does: Enemies within 325 are slowed 11% (lingers 1s).
  - Counterplay: Keep distance; debuff immunity ignores it.
- **Guardian Angel** (Ultimate): No Target, cast point 0.4 s. Affects debuff-immune allies: yes; dispellable: no; cooldown 100/90/80 s; mana 125/175/225; upgraded by Scepter.
  - What it does: After 0.4s, all allies within 700 of Omniknight are immune to physical damage for 4-5.5s.
  - Aghanim's Scepter / Shard: Scepter: global radius, includes buildings, and +50% heal and regen amplification.
  - Counterplay: Switch to magic or pure damage, or wait it out; not dispellable.

#### Oracle | Intelligence | Ranged | attack range 625 | move speed 295 | [feed](https://www.dota2.com/datafeed/herodata?language=english&hero_id=111)

*Fate-bending support: heals that hurt, disarm plus magic immunity, delayed death.*

- **Fortune's End**: Unit Target (ally or enemy), AoE, Channeled up to 2.5 s, instant (no cast point). Magical damage; pierces immunity: no; dispellable: yes (basic dispel); cooldown 18/14/10/6 s; mana 80; cast range 850.
  - What it does: Channel up to 2.5s on an ally or enemy, then a bolt (1200 speed) flies to it: 100-280 magic damage in 350 radius, roots 0.75-2.75s (longer the longer he channeled) and basic-dispels enemies' buffs (allies lose debuffs). Affects invulnerable units.
  - Counterplay: Interrupt the channel to cut the root short; bolt is a projectile (disjoint behaviour unconfirmed); root is basic-dispellable.
- **Fate's Edict**: Unit Target (ally or enemy), cast point 0.3 s. Affects debuff-immune allies: no; dispellable: yes (basic dispel); cooldown 14/12/10/8 s; mana 70; cast range 700.
  - What it does: Ally or enemy: disarmed and 100% magic damage resistance for 3.5-5s. Used on an ally to block a magic burst or on an enemy carry to stop its attacks.
  - Counterplay: Physical damage ignores it; basic dispel removes it; debuff immune enemies cannot be targeted.
- **Purifying Flames**: Unit Target (ally or enemy), cast point 0.1 s. Magical damage; pierces immunity: no; dispellable: yes (basic dispel); cooldown 2.5 s; mana 60/65/70/75; cast range 850.
  - What it does: 2.5s cooldown, 0.1s cast. Deals 90-360 magic damage, then heals 15-45 per second for 10s (more healing than damage). Stacks; cannot kill an ally. Pairs with Fate's Edict (ally takes no magic damage but keeps the heal).
  - Counterplay: Burst the ally during the damage tick; dispel the heal-over-time buff off enemies.
- **Rain of Destiny** (granted by Aghanim's Shard): Point Target, AoE, cast point 0.2 s. Magical damage; pierces immunity: no; cooldown 40 s; mana 150; cast range 650.
  - What it does: Shard. 650-radius rain for 10s: enemies take 30 magic damage per second and lose heal amplification; allies are healed and get +15% incoming heal amplification.
  - Counterplay: Leave the area.
- **False Promise** (Ultimate): Unit Target (ally), cast point 0.3 s. Affects debuff-immune allies: yes; dispellable: no; cooldown 110/85/60 s; mana 125/175/225; cast range 800/850/900.
  - What it does: Ally hero gets a strong dispel; for 7-10s every damage and heal it takes is held back and applied at the end, with delayed healing doubled (+100%).
  - Counterplay: Not dispellable. Only enough burst to outweigh the doubled healing kills; hold damage and fight after it ends.
- **Prognosticate** (Innate): Passive.
  - What it does: Tells his team which side the next power rune spawns on and Roshan's exact respawn time.
  - Counterplay: Information only.

#### Outworld Destroyer | Intelligence | Ranged | attack range 450 | move speed 315 | [feed](https://www.dota2.com/datafeed/herodata?language=english&hero_id=76)

*Mana-pool mage: damage scales with his own max mana.*

- **Arcane Orb**: Unit Target (enemy), Autocast, attack modifier (orb), instant (no cast point). Pure damage; pierces immunity: no; cooldown 4.5/3/1.5/0 s; cast range 450.
  - What it does: Autocast attack modifier: each attack spends mana and adds pure damage equal to 9-12% of his remaining mana (cooldown 4.5/3/1.5/0s).
  - Aghanim's Scepter / Shard: Scepter: the orb bounces to one more target for reduced damage.
  - Counterplay: Mana burn shrinks the damage; attacks are projectiles and can be disjointed.
- **Astral Imprisonment**: Unit Target (ally or enemy), AoE, cast point 0.3 s. Magical damage; pierces immunity: no; dispellable: no; cooldown 18/16/14/12 s; mana 150; cast range 650; upgraded by Shard.
  - What it does: Banishes an ally or enemy for 1.75-4s (hidden, invulnerable, cannot act), then deals 90-360 magic damage. Steals 16-25% of the target's max mana capacity for 30-60s.
  - Aghanim's Scepter / Shard: Shard: the end damage hits an area (300); imprisoned allies may walk at 70% speed while untargetable.
  - Counterplay: Linken's blocks; not dispellable. On an ally it is a save. Sanity's Eclipse can still hit the prisoner.
- **Objurgation**: No Target, instant (no cast point). Dispellable: yes (basic dispel); cooldown 36/33/30/27 s; mana 175; upgraded by Scepter.
  - What it does: Passive: +80-320 max mana. Active (instant): barrier against all damage equal to 150-300 + 9-12% of max mana for 10s.
  - Aghanim's Scepter / Shard: Scepter: barrier gets +3% max mana more; damage that would drop him under 20% health is blocked once per 80s, granting a strong dispel and an undispellable barrier.
  - Counterplay: Basic dispel strips the barrier; mana burn shrinks it.
- **Essence Flux** (Innate): Passive.
  - What it does: Each ability cast has a 30% chance to restore mana (40%, or 25% for attack-modifier spells; the feed says of max mana, earlier versions said of the spent cost; unconfirmed).
  - Counterplay: Mana burn and silence.
- **Sanity's Eclipse** (Ultimate): Point Target, AoE, cast point 0.25 s. Magical damage; pierces immunity: no; cooldown 140/130/120 s; mana 200/300/400; cast range 700.
  - What it does: Point AoE (500-550 radius, 700 range): magic damage = 180-360 + 0.35 x (his max mana minus each target's max mana). Hits units inside Astral Imprisonment.
  - Counterplay: Raise your own max mana or magic resistance; spread out.

#### Pangolier | Universal | Melee | attack range 150 | move speed 300 | [feed](https://www.dota2.com/datafeed/herodata?language=english&hero_id=120)

*Mobile skirmisher: vector dash, rolling ball ultimate.*

- **Swashbuckle**: Vector Target, cast point 0.15 s. Physical damage; pierces immunity: yes; cooldown 19/16/13/10 s; mana 85/90/95/100; cast range 575/650/725/800.
  - What it does: Vector cast: click a start point (dash up to 575-800 at 2000 speed), then drag a direction; after the dash he slashes 4 times along an 850-long, 155-wide line in the drawn direction, each slash 25-100 physical plus attack effects (60% item potency) and a 0.6s 100% slow. Pierces debuff immunity.
  - Counterplay: Cannot be cast while rooted. The slash line is drawn after landing, so step sideways out of the line; disjoint is irrelevant (it is attacks).
- **Shield Crash**: No Target, instant (no cast point). Physical damage; pierces immunity: no; dispellable: yes (basic dispel); cooldown 15/12/9/6 s; mana 75; upgraded by Scepter.
  - What it does: Instant hop (0.4s airtime) that lands slightly ahead: 60-240 physical in 500 radius; if it hits a hero he gets an all-damage barrier (60-240) for 6s. During Rolling Thunder it keeps forward momentum and lets the ball jump walls and cliffs.
  - Aghanim's Scepter / Shard: Scepter: each Shield Crash also fires a 2-hit Swashbuckle every 90 degrees around him (4 directions) at 75% damage.
  - Counterplay: Barrier is basic-dispellable; stay out of 500 radius.
- **Lucky Shot**: Passive. Pierces immunity: no; dispellable: yes (basic dispel).
  - What it does: 17% chance on any damage from his attacks or abilities to cut the target's attack speed by 35-140 and armor by 2-8 for 3.5-5s.
  - Counterplay: Basic dispel; debuff immunity blocks.
- **Roll Up** (granted by Aghanim's Shard): No Target, cast point 0.1 s. Magical damage; pierces immunity: no; dispellable: no; cooldown 40 s; mana 75.
  - What it does: Shard. Curls into a stationary ball for 2.25s: debuff immune, 80% magic resistance, can turn freely; can brake Rolling Thunder with it and cast Thunder or Shield Crash from it. If attacked, he rolls away from the attacker, stunning enemies in his path (1-1.5s).
  - Counterplay: Do not attack him while rolled up; reposition for when it ends.
- **Rolling Thunder** (Ultimate): No Target, cast point 1.2 s. Physical damage; pierces immunity: no; dispellable: no; cooldown 100/90/80 s; mana 100/125/150.
  - What it does: After a 1.2s curl-up, he rolls for 10-12s as a debuff-immune ball (80% magic resistance) at 550 speed with poor turning, passing through trees. Enemies he hits are knocked back, take 100-300 plus 80% attack damage, and are stunned 1.2s on landing; walls and cliffs make him bounce back. Takes 1s to reach full speed. Basic dispel on cast.
  - Counterplay: 1.2s wind-up and the slow turn rate: sidestep perpendicular to his path; put a cliff or wall between you and him, since he bounces off them. Disabling him does not stop the roll (stated in the notes); not dispellable.
- **Fortune Favors the Bold** (Innate): Passive.
  - What it does: Enemy chance-based effects (bashes, crits, evasion and similar) within 1200 are 50% less likely (relative) to affect him.
  - Counterplay: Use guaranteed effects instead of chance-based ones.

#### Phantom Assassin | Agility | Melee | attack range 150 | move speed 310 | [feed](https://www.dota2.com/datafeed/herodata?language=english&hero_id=44)

*Crit assassin: dagger, blink-to-target, evasion.*

- **Stifling Dagger**: Unit Target (enemy), cast point 0.3 s. Physical damage; dispellable: yes (basic dispel); cooldown 6 s; mana 30; cast range 700/850/1000/1150.
  - What it does: Dagger projectile (1200 speed, 700-1150 range, 6s CD): 65-80 + 30-75% of her attack damage as physical, carries attack effects (crit-capable), slows 50% for 2.1-3s, grants vision along its path. Increases Coup de Grace chance.
  - Counterplay: Projectile: disjoint or Linken's; slow is basic-dispellable; debuff-immune targets ignore the slow.
- **Phantom Strike**: Unit Target (any unit, custom rules), Charges 2 (restore 21/18/15/12 s), cast point 0.25 s. Pierces immunity: yes; dispellable: yes (basic dispel); cooldown 0.1 s; mana 35/40/45/50; cast range 650/750/850/950.
  - What it does: Blink to any unit (ally or enemy) within 650-950; on an enemy she gains +80-200 attack speed for 3s. 2 charges, 21-12s recharge. Pierces debuff immunity.
  - Counterplay: Cannot be cast while rooted; Linken's blocks the enemy-target version; dispel the attack speed buff.
- **Blur** (Innate): No Target, cast point 0.3 s. Dispellable: no; cooldown 45 s; mana 40; cast range 600; upgraded by Shard.
  - What it does: Innate active (0.3s cast, 45s CD): disjoints incoming projectiles, gives +12% move speed, and for 20s makes her invisible to enemies further than 600; near enemy heroes or towers she becomes visible but untargetable, and she only loses the effect if an enemy stays inside the radius through the whole fade buffer. Breaks on attacking Roshan.
  - Aghanim's Scepter / Shard: Shard: lower cooldown; each hero kill advances all her cooldowns by 60% of their maximum.
  - Counterplay: True sight and area spells; ward vision does not reveal her (7.42 made it invisibility outside the radius).
- **Fan of Knives** (granted by Aghanim's Scepter): No Target, cast point 0.15 s. Physical damage; pierces immunity: yes; dispellable: no; cooldown 14 s; mana 80.
  - What it does: Scepter ability. 0.15s cast: knives fly out to 550 radius (1000 speed): 30% of each victim's max health as physical damage on impact, plus Break and 50% reduced healing (degen) for 4s. Pierces debuff immunity.
  - Counterplay: Range: be beyond 550; not dispellable.
- **Immaterial**: Passive.
  - What it does: 20-50% evasion (stacks diminishingly with other evasion).
  - Counterplay: True strike / accuracy items, magic damage.
- **Coup de Grace** (Ultimate): Passive. Pierces immunity: yes.
  - What it does: Each attack has a 17% chance (34% for Stifling Dagger) to give Deadly Focus for 6-10s; her next attack consumes it for a guaranteed 200-450% crit. Pierces debuff immunity.
  - Counterplay: The Deadly Focus buff is visible: kite or disable before she swings; evasion/blind on her, armor.

#### Phantom Lancer | Agility | Melee | attack range 225 | move speed 285 | [feed](https://www.dota2.com/datafeed/herodata?language=english&hero_id=12)

*Illusion-swarm carry.*

- **Spirit Lance**: Unit Target (enemy), cast point 0.3 s. Magical damage; pierces immunity: no; dispellable: yes (basic dispel); cooldown 10/9/8/7 s; mana 120; cast range 600/650/700/750.
  - What it does: Lance projectile (1000 speed): 100-280 magic damage, slows 14-35% for 3s, and spawns an illusion (15% damage, 400% damage taken, 3.5-8s) that attacks the target. Illusions within 675 mimic the throw (fake lances).
  - Aghanim's Scepter / Shard: Scepter: lance bounces once (prefers heroes) and its illusion deals more damage.
  - Counterplay: Projectile: disjoint or Linken's; slow is basic-dispellable.
- **Doppelganger**: Point Target, AoE, cast point 0.1 s. Cooldown 22/18/14/10 s; mana 70; cast range 575.
  - What it does: Point AoE (575 range, 0.1s cast): PL vanishes for 1s (dodges projectiles, basic dispel), then he and his nearby illusions (within 900) reappear at random spots inside a 325 radius, plus two new doppelgangers: one takes normal damage and deals none, the other deals -80% and takes 500%. Extends existing illusions by 2s. His allies can see which one is real.
  - Counterplay: Cannot be cast while rooted. Area damage reveals the real one (illusions die fast); wait for him to reappear.
- **Phantom Rush**: No Target, Toggle, instant (no cast point). Physical damage; dispellable: yes (basic dispel); cooldown 15/11/7/3 s; upgraded by Scepter.
  - What it does: Toggle (on = rush active). When he targets an enemy for an attack from 275-600/825 away, he rushes at 800 speed and gains 20-50% evasion. Cancelled if the attack order is cancelled. CD 15-3s.
  - Aghanim's Scepter / Shard: Scepter: longer range; rushing through enemies spawns Juxtapose illusions that attack them, plus one illusion per 600 units rushed that rushes with him.
  - Counterplay: Slows and roots during the rush; spot the real PL by the rush.
- **Illusory Armaments** (Innate): Passive.
  - What it does: Any new PL illusion has a minimum outgoing damage of 17% for its first 3s.
  - Counterplay: Kill fresh illusions with AoE.
- **Juxtapose** (Ultimate): Passive. Upgraded by Shard.
  - What it does: Each PL attack has a 40-50% chance (illusions 9%) to spawn an illusion (15% damage, 600% damage taken); max 6-10; 7s from PL, 4s from illusions.
  - Aghanim's Scepter / Shard: Shard: adds an active: PL turns invisible up to 8s with +15% speed and leaves a decoy image.
  - Counterplay: AoE damage, Break (stops new illusions), kill illusions early.

#### Phoenix | Strength | Ranged | attack range 500 | move speed 280 | [feed](https://www.dota2.com/datafeed/herodata?language=english&hero_id=110)

*Health-spending caster that dies and is reborn as a sun.*

- **Icarus Dive**: Point Target, cast point 0.2 s. Magical damage; pierces immunity: no; dispellable: yes (basic dispel); cooldown 40/35/30/25 s.
  - What it does: Point (direction): spends 15% current health and dives 1100-1400 forward in an arc (500 wide), burning everything it touches (20-80 DPS for 4s, 10-25% slow), then curves back to the start over 2s total. Recast stops it early. Cannot be cast while rooted.
  - Counterplay: Stand off the arc; burn is basic-dispellable; root before cast.
- **Fire Spirits**: No Target, instant (no cast point). Magical damage; pierces immunity: no; dispellable: yes (basic dispel); cooldown 50/40/30/20 s; mana 100; cast range 1400.
  - What it does: Instant: spends 20% health and summons orbiting spirits for 20s (the tooltip says 4, the value list says spirit_count 5; conflict unresolved). Each can be launched at a 200-radius spot within 1400 (1000 speed): 20-80 DPS and -35 to -140 attack speed for 4s; reveals the area 1s.
  - Aghanim's Scepter / Shard: Shard: Fire Spirits becomes a charge-based ability with a 7s replenish (no summon step).
  - Counterplay: The launched spirit is visible in flight and lands on a point: move out of the circle; basic dispel.
- **Sun Ray**: Point Target, cast point 0.01 s. Magical damage; pierces immunity: no; dispellable: no; cooldown 30 s; mana 90/105/120/135; cast range 1200; upgraded by Shard.
  - What it does: Beam toward a point (1200 long, 130 wide) for 6s, costs 5% of his health per second: enemies take 20-35 + 1.5-6% max health per second (rising the longer it hits), allies are healed. Phoenix turns very slowly and can drift forward. Can use items and other spells while beaming.
  - Aghanim's Scepter / Shard: Shard: Sun Ray can be cast during Supernova.
  - Counterplay: The beam turns slowly: move sideways out of it; stun, silence, hex, cyclone or sleep cancel it.
- **Dying Light** (Innate): Passive. Dispellable: no.
  - What it does: Deals 3.5% of Phoenix's missing health as magic damage per second to enemies within 400; keeps working inside Supernova.
  - Counterplay: Keep away when he is low; kill fast rather than wear down.
- **Supernova** (Ultimate): No Target, cast point 0.01 s. Magical damage; pierces immunity: yes; dispellable: no; cooldown 120 s; mana 150/200/250; cast range 450; upgraded by Scepter.
  - What it does: Phoenix becomes a sun for 6s (strong dispel on cast): enemies within 1200 take 50-110 magic DPS. The sun has pip health (6-10 hero hits; creeps and illusions do 25%). If it survives, it explodes: stun 1.8-2.4s around it and Phoenix revives with full health, mana and refreshed cooldowns. If killed, Phoenix dies. Pierces debuff immunity.
  - Aghanim's Scepter / Shard: Scepter: more hits needed; can be cast on an allied hero (500 range) so both enter the sun and are reborn together.
  - Counterplay: Count hits: focus the sun with hero attacks; the stun is local, so step away before it ends.

#### Primal Beast | Strength | Melee | attack range 150 | move speed 305 | [feed](https://www.dota2.com/datafeed/herodata?language=english&hero_id=137)

*Big strength brawler with charge, stomp and grab.*

- **Onslaught**: Point Target, instant (no cast point). Physical damage; pierces immunity: no; dispellable: yes (basic dispel); cooldown 25/22/19/16 s; mana 120.
  - What it does: Point direction. Press to start charging up (up to 1.7s, longer = farther, max 2000), then he runs at 1200: enemies (and allies) in his path are knocked back; enemies take 75-360 physical and are stunned 0.7-1.6s. Stop cancels. Cannot be cast while rooted.
  - Counterplay: The charge-up is visible and the run is a fixed line: step aside; stun or root him during the wind-up.
- **Trample**: No Target, instant (no cast point). Magical damage; pierces immunity: no; dispellable: no; cooldown 30/27/24/21 s; mana 100.
  - What it does: Instant (also while channeling): for 5.5s, every 140 units he walks deals 15-60 + 35% attack damage as magic damage around him (200 radius); he is disarmed meanwhile.
  - Counterplay: Keep away from him; slows reduce how many steps he takes.
- **Uproar**: No Target, instant (no cast point). Dispellable: no; upgraded by Scepter.
  - What it does: Each hit of 50+ damage from heroes he takes gives a stack (max 6, 20s). Activate (instant, no cooldown) to roar: enemies within 900 are slowed 4-10% per stack for 3s and he gets +10-40 damage and +2-5 armor per stack for 7s. Break stops new stacks.
  - Aghanim's Scepter / Shard: Scepter: the roar also fires 3 waves of projectiles (2 per stack) that damage and Break, splitting in two after 1.25s.
  - Counterplay: Avoid feeding stacks with many small hits; Break him; not dispellable.
- **Rock Throw** (granted by Aghanim's Shard): Point Target, AoE, cast point 0.25 s. Physical damage; pierces immunity: no; cooldown 20 s; mana 85; cast range 1800.
  - What it does: Shard. Throws a rock at a point 550-1800 away (minimum range 550, 0.65-1.75s flight): 300 + 100% Strength physical and 1.4s stun in 225 radius, then 3 fragments land behind it. Heroes hit add Uproar stacks.
  - Counterplay: Long flight time: walk out of the marked impact.
- **Pulverize** (Ultimate): Unit Target (enemy), AoE, Channeled up to 2.3 s, cast point 0.25 s. Magical damage; pierces immunity: yes; cooldown 45/40/35 s; mana 100; cast range 200.
  - What it does: Channel 2.3s on an adjacent enemy (200 range): grabs and slams it every 0.75s, each slam magic damage (100-250, +20-60 per hit) and a 0.2s mini-stun to enemies within 575. Pierces debuff immunity.
  - Counterplay: Interrupt Primal Beast (stun, hex, silence break the channel); Linken's blocks.
- **Colossal** (Innate): Passive.
  - What it does: 10% base slow resistance, and per 100 max health +1% slow resistance and +0.5% area of effect.
  - Counterplay: Use hard disables rather than slows.

#### Puck | Intelligence | Ranged | attack range 550 | move speed 290 | [feed](https://www.dota2.com/datafeed/herodata?language=english&hero_id=13)

*Elusive initiator: teleport orb, silence, invulnerability channel, leash ultimate.*

- **Illusory Orb**: Point Target, cast point 0.1 s. Magical damage; pierces immunity: no; cooldown 12/11/10/9 s; mana 90/100/110/120; cast range 1950.
  - What it does: Vector-targeted per its tooltip (the feed's flag says Point): launch an orb that travels up to 1950 at 750 speed and can curve along the drawn path; 70-280 magic on contact plus 3% of that every 0.5s while in its 225 radius; Ethereal Jaunt (sub-ability) teleports Puck to the orb, disjointing projectiles. Alt-cast fires it straight. Gives flying vision.
  - Counterplay: Orb is slow and visible: step out of the path; track where Puck will jaunt.
- **Waning Rift**: Point Target, AoE, cast point 0.1 s. Magical damage; pierces immunity: no; dispellable: yes (basic dispel); cooldown 15/14/13/12 s; mana 100/110/120/130.
  - What it does: Puck blinks up to 350 toward a point and releases dust: 60-240 magic and 2-3.5s silence in 400 radius.
  - Counterplay: Silence is basic-dispellable; short range means he must be close.
- **Phase Shift**: No Target, Channeled up to 1/1.75/2.5/3.25 s, cast point 0.01 s. Cooldown 8/7.5/7/6.5 s; upgraded by Shard.
  - What it does: Channel 1-3.25s: Puck vanishes and is invulnerable; any order ends it. Combined with the innate, dodged attacks and spells restore him.
  - Aghanim's Scepter / Shard: Shard: attacks deal +20 magic damage, and every Phase Shift attacks all enemies in attack range.
  - Counterplay: Wait it out next to where it ends; it keeps collision, so body-block.
- **Puckish** (Innate): Passive.
  - What it does: Each disjointed attack restores 3% max health and mana; each dodged targeted spell projectile restores 9%.
  - Counterplay: Do not throw projectiles into Phase Shift or Jaunt.
- **Dream Coil** (Ultimate): Point Target, AoE, cast point 0.1 s. Magical damage; pierces immunity: no; dispellable: no; cooldown 80/75/70 s; mana 125/175/225; cast range 750; upgraded by Scepter.
  - What it does: Point AoE (375 radius, 750 range): leashes enemy heroes to the coil centre for 5-6s with 175-325 magic damage and a 0.5s stun; leaving the 600 break radius snaps it for 200-400 magic and a 1.5-2.5s stun.
  - Aghanim's Scepter / Shard: Scepter: Puck auto-attacks every coiled enemy at 90% of his attack rate, continuing on enemies who snap it.
  - Counterplay: Stay inside the coil; debuff immunity before cast prevents it; not dispellable.

#### Pudge | Strength | Melee | attack range 175 | move speed 280 | [feed](https://www.dota2.com/datafeed/herodata?language=english&hero_id=14)

*Hook hero.*

- **Meat Hook**: Point Target, cast point 0.3 s. Pure damage; pierces immunity: yes; cooldown 18/16/14/12 s; mana 120; cast range 1300; upgraded by Shard.
  - What it does: Point skillshot: a hook (1300 range, 1600 speed, 100 wide) grabs the first unit hit and drags it back; enemies take 150-360 pure, non-ancient creeps die, allies are pulled harmlessly. Passes through trees, cliffs and buildings; hits invisible units; interrupts channels; can drag runes. Pierces debuff immunity.
  - Aghanim's Scepter / Shard: Shard: +100 range and bonus damage based on distance dragged.
  - Counterplay: Pure skillshot: keep a creep between you and Pudge, juke direction changes, disjoint is irrelevant (it hits the body). 0.3s cast point is the tell.
- **Rot**: No Target, Toggle, instant (no cast point). Magical damage; pierces immunity: no; upgraded by Scepter.
  - What it does: Toggle cloud around Pudge (250 radius): 30-120 magic DPS and 14-32% slow to enemies and himself (self damage non-lethal). Does not interrupt channels; hits invisible units; cannot be turned off while silenced.
  - Aghanim's Scepter / Shard: Scepter: +200 radius, +90 damage, and -20% health restoration on enemies.
  - Counterplay: Stay away; debuff immunity blocks.
- **Meat Shield**: No Target, instant (no cast point). Dispellable: no; cooldown 20/19/18/17 s; mana 65/70/75/80.
  - What it does: Instant shield blocking 8-26 damage of every instance (any damage type) for 4-7s.
  - Counterplay: Few big hits beat flat block.
- **Flesh Heap** (Innate): Passive.
  - What it does: +2 Strength permanently per enemy hero that dies within 450 (or that he kills).
  - Counterplay: Do not die near him.
- **Dismember** (Ultimate): Unit Target (enemy), Channeled up to 2.75 s, cast point 0.3 s. Magical damage; pierces immunity: yes; dispellable: strong dispel only; cooldown 30/25/20 s; mana 100/130/170; cast range 200.
  - What it does: Channel 2.75s on an adjacent enemy: disables it (strong-dispel-only), deals 80-120 + 0.3-0.7x Strength magic damage per second, heals Pudge for the same, and pulls the target toward him. Pierces debuff immunity.
  - Aghanim's Scepter / Shard: Shard: cast range rises to 300 and the values list a 5% regen bonus and a 2.75s order lock (details unconfirmed).
  - Counterplay: Allies stun Pudge to break the channel; Linken's blocks; strong dispel frees.

#### Pugna | Intelligence | Ranged | attack range 600 | move speed 325 | [feed](https://www.dota2.com/datafeed/herodata?language=english&hero_id=45)

*Nether caster: delayed blast, banish, anti-spell ward, drain.*

- **Nether Blast**: Point Target, AoE, cast point 0.2 s. Magical damage; pierces immunity: no; cooldown 5 s; mana 100/115/130/145; cast range 600.
  - What it does: Point AoE (400 radius): 95-320 magic after a 0.8s delay; 65% to buildings. 5s cooldown.
  - Counterplay: 0.8s visible delay: walk out.
- **Decrepify**: Unit Target (any unit, custom rules), cast point 0.2 s. Pierces immunity: no; dispellable: yes (basic dispel); cooldown 16/13/10/7 s; mana 50/60/70/80; cast range 550/600/650/700.
  - What it does: Ally or enemy (or his ward): banished 3.5s, cannot attack or be attacked (only magic and pure damage hit). Enemies are slowed 45-60% and take 16-40% more magic damage; allies get more incoming and outgoing healing.
  - Counterplay: Basic dispel removes; on an ally it saves from physical carries.
- **Nether Ward**: Point Target, cast point 0.2 s. Magical damage; pierces immunity: no; cooldown 40 s; mana 75/100/125/150; cast range 175; upgraded by Shard.
  - What it does: Places a ward (pip health 3-6 hero hits, 21-30s) near him; any enemy hero casting a spell within 1400 takes 50-110 + 1-1.6x the mana spent as magic damage, applied before the spell. Only one ward.
  - Aghanim's Scepter / Shard: Shard: ward can be placed 375 away.
  - Counterplay: Kill the ward first (few hits), do not cast near it; it can be decrepified.
- **Oblivion Savant** (Innate): Passive, Charges with Scepter: 2 (restore 20 s). Upgraded by Scepter.
  - What it does: Pugna can cast spells and use items while channeling (so he keeps Life Drain going). +1.5% spell amp per destroyed tower.
  - Aghanim's Scepter / Shard: Scepter: 2 charges (20s restore) that let him recast any ability while it is on cooldown (0.25s buffer).
  - Counterplay: Interrupting Pugna's drain needs a real disable, not a silence of other actions.
- **Life Drain** (Ultimate): Unit Target (ally or enemy), Channeled up to 10 s, cast point 0.2 s. Magical damage; pierces immunity: no; dispellable: no; cooldown 7 s; mana 100/150/200; cast range 700; upgraded by Shard.
  - What it does: Channel up to 10s: on an enemy, drains 150-350 magic per second and heals Pugna for damage dealt; on an ally, heals it while Pugna takes the healing as non-lethal damage. Several drains at once on different targets. Break range 200 beyond cast range.
  - Aghanim's Scepter / Shard: Shard: target your Nether Ward to drain every enemy hero within 700 of it at 75% strength.
  - Counterplay: Stun/silence Pugna, or move out of range; Linken's blocks; debuff immunity blocks.

#### Queen of Pain | Intelligence | Ranged | attack range 550 | move speed 290 | [feed](https://www.dota2.com/datafeed/herodata?language=english&hero_id=39)

*Blink mage with pure ultimate.*

- **Shadow Strike**: Unit Target (enemy), cast point 0.3 s. Magical damage; pierces immunity: no; dispellable: yes (basic dispel); cooldown 11/9/7/5 s; mana 100/105/110/115; cast range 450/500/550/600; upgraded by Scepter.
  - What it does: Dagger projectile (900 speed): 50-140 magic on hit plus 25-100 every 3s for 13s and a 25-55% slow that decays. Allies can deny the target below 25% health.
  - Aghanim's Scepter / Shard: Scepter: becomes 300 AoE; when it ends or is re-applied on a hero, that hero emits a Scream of Pain.
  - Counterplay: Projectile: disjoint or Linken's; basic dispel.
- **Blink**: Point Target, cast point 0.33 s. Cooldown 12/10/8/6 s; mana 65; cast range 1075/1150/1225/1300; upgraded by Shard.
  - What it does: Short teleport, 1075-1300 range (minimum 200), 0.33s cast. Dodges projectiles.
  - Aghanim's Scepter / Shard: Shard: a sonic boom at both ends: 125 damage and 1.75s silence in 300.
  - Counterplay: Root prevents it.
- **Scream Of Pain**: No Target, instant (no cast point). Magical damage; pierces immunity: no; cooldown 7.5/7/6.5/6 s; mana 120.
  - What it does: No-target scream: projectiles to every enemy within 600 (900 speed): 90-345 magic; 25% of hero damage is reflected to her (non-lethal). Hits invisible units; cannot be disjointed.
  - Counterplay: Range only.
- **Succubus** (Innate): Passive.
  - What it does: Spell lifesteal also works on pure damage; she has 3% spell lifesteal, rising to 17% when an enemy is within 150.
  - Counterplay: Healing reduction.
- **Sonic Wave** (Ultimate): Point Target, cast point 0.45 s. Pure damage; pierces immunity: yes; cooldown 105/90/75 s; mana 250/400/550; cast range 700.
  - What it does: Wave toward a point: travels 900 at 900 speed, widening from 100 to 450 (hits up to 1150 away), 325-585 pure damage and a 350 knockback. Pierces debuff immunity.
  - Counterplay: Narrow at the start: dodge sideways early; 0.45s cast point.

#### Razor | Agility | Ranged | attack range 475 | move speed 280 | [feed](https://www.dota2.com/datafeed/herodata?language=english&hero_id=15)

*Lightning ranged carry who steals attack damage.*

- **Plasma Field**: No Target, instant (no cast point). Magical damage; pierces immunity: no; dispellable: yes (basic dispel); cooldown 13/12/11/10 s; mana 125.
  - What it does: Instant ring that expands to 700 and contracts over 2.2s; hits each enemy twice, damage (35-185) and slow (5-40%, 1.5s) rising with distance from Razor.
  - Counterplay: Stand close to Razor or outside 700; basic dispel.
- **Static Link**: Unit Target (enemy), cast point 0.3 s. Pierces immunity: yes; dispellable: no; cooldown 44/36/28/20 s; mana 45/50/55/60; cast range 550.
  - What it does: Tethers an enemy hero for 10s drain then holds it 12-18s: steals 6-24 attack damage per second from target to Razor; Razor can attack while moving. Link breaks if they get 250 beyond cast range apart or one dies. Pierces debuff immunity; not dispellable.
  - Aghanim's Scepter / Shard: Shard: longer cast range; the target is slowed in proportion to the damage stolen.
  - Counterplay: Run away to break the leash distance; Linken's blocks.
- **Storm Surge**: Passive. Magical damage; upgraded by Shard.
  - What it does: When attacked (20% chance) or always when targeted by a spell, lightning forks to the attacker and up to 3 nearby enemies (700 search): 65-170 magic and 25-40% slow 1s; 2.5s internal cooldown. Counts as reflected damage.
  - Aghanim's Scepter / Shard: Shard: during Eye of the Storm, chance doubled, cooldown -2s, and it hits all enemies in the Eye's radius.
  - Counterplay: Expect retaliation per hit; spread out.
- **Unstable Current** (Innate): Passive.
  - What it does: Passive bonus move speed (amount not given in the feed).
  - Counterplay: None specific.
- **Eye of the Storm** (Ultimate): No Target, instant (no cast point). Physical damage; pierces immunity: yes; dispellable: no; cooldown 80/70/60 s; mana 100/150/200; upgraded by Scepter.
  - What it does: Instant: for 30s, every 0.5-0.7s a bolt hits the lowest-health enemy within 500 (prioritises the Static Link target): 60-90 physical and -1 armor stacking. Casts stack. Pierces debuff immunity.
  - Aghanim's Scepter / Shard: Scepter: strikes two units at once and can hit towers, barracks and the Ancient.
  - Counterplay: Leave 500 radius; keep low-health units out of range.

#### Riki | Agility | Melee | attack range 150 | move speed 315 | [feed](https://www.dota2.com/datafeed/herodata?language=english&hero_id=32)

*Permanent-invisibility backstabber.*

- **Smoke Screen**: Point Target, AoE, cast point 0.2 s. Pierces immunity: no; dispellable: no; cooldown 15/14/13/12 s; mana 75; cast range 550; upgraded by Shard.
  - What it does: Point AoE (400 radius) cloud for 4.5-6s: enemies inside are silenced and miss 55-70% of attacks. Items still usable.
  - Aghanim's Scepter / Shard: Shard: enemies inside lose 5 armor and cannot be targeted by their allies.
  - Counterplay: Walk out of the cloud; debuff immunity blocks; not dispellable.
- **Blink Strike**: Unit Target (any unit, custom rules), cast point 0.3 s. Physical damage; pierces immunity: yes; cooldown 13/10/7/4 s; mana 50/55/60/65; cast range 600/700/800/900.
  - What it does: Blinks behind any unit (600-900 range); on an enemy, 100% slow briefly (0.75s) and an attack with +25-55 damage (triggers Backstab). Pierces debuff immunity.
  - Counterplay: Rooted Riki cannot cast; Linken's blocks enemy target.
- **Tricks of the Trade**: Point Target, AoE, Channeled up to 2 s, cast point 0.3 s. Physical damage; pierces immunity: yes; cooldown 21/18/15/12 s; mana 65; cast range 400; upgraded by Scepter.
  - What it does: Channel 2s at a point within 400: Riki disappears (untargetable) and hits 2 random enemies within 425 from behind several times with fixed attack damage (25-100 bonus). Pierces debuff immunity.
  - Aghanim's Scepter / Shard: Scepter: 500 cast range, can hide inside an allied unit (ally gets +15% speed), +1s and +2 attacks.
  - Counterplay: Leave the 425 circle; interrupt is impossible while he is hidden (to our knowledge) so walk away.
- **Backstab** (Innate): Passive. Physical damage.
  - What it does: Attacks from behind (105 degree arc) add 0.55x Agility physical damage and +10% item potency (more per 15 levels).
  - Counterplay: Face him.
- **Cloak and Dagger** (Ultimate): Passive. Pierces immunity: yes; dispellable: no.
  - What it does: Ultimate passive: Riki is invisible until he attacks, re-fading after 2-4s; bonus experience on hero kills and assists. Pierces debuff immunity.
  - Counterplay: True sight (Dust, Sentry, Gem) reveals him. Area spells can still hit him while he is invisible.

#### Ringmaster | Intelligence | Ranged | attack range 575 | move speed 310 | [feed](https://www.dota2.com/datafeed/herodata?language=english&hero_id=131)

*Circus showman support: fear whip, box escape, dagger skillshots, hypnotic wheel, random single-use souvenirs.*

- **Tame the Beasts**: Point Target, AoE, Channeled up to 1 s, instant (no cast point). Magical damage; pierces immunity: no; dispellable: yes (basic dispel); cooldown 16/14/12/10 s; mana 90/105/120/135; cast range 700.
  - What it does: Channel up to 1s aimed at a point, then crack the whip in a cone/line area: longer channel = exponentially more damage (50-125 up to 180-480 magic) and longer fear (0.1-0.4s up to 0.6-1.2s), but the hit area narrows from 450 to 200 wide.
  - Counterplay: Watch the twirl: short casts are weak, long casts are narrow, so sidestep; fear is basic-dispellable.
- **Escape Act**: Unit Target (ally), Charges with Scepter: 2 (restore 38/32/26/20 s), cast point 0.4 s. Pierces immunity: no; dispellable: yes (basic dispel); cooldown 38/32/26/20 s; mana 120; cast range 600; upgraded by Scepter.
  - What it does: Packs himself or an allied hero into a moving box for 2-3.2s: phased movement, 100% slow resistance, 50-80% magic resistance, +0-24% speed, untargetable, but muted, silenced and disarmed. Pops when time ends or the box leaves a 500 leash area.
  - Aghanim's Scepter / Shard: Scepter: 2 charges; when the box opens, 8 Impalement Arts daggers fly out to 1200 and enemies around take 300 damage (225 radius).
  - Counterplay: Area damage still hits (it is untargetable, not invulnerable, as written); wait at the leash edge.
- **Impalement Arts**: Point Target, Charges 3 (restore 17 s), cast point 0.3 s. Magical damage; pierces immunity: no; dispellable: yes (basic dispel); cooldown 1 s; mana 50; cast range 2400.
  - What it does: Skillshot dagger to a point up to 2400 (1350 speed, 130 wide): 20-80 magic impact, 100% slow 0.5-0.8s, and a bleed of 3-6% max health per second (heroes) for 4s. 3 charges, 17s each, 1s between throws.
  - Counterplay: Sidestep; bleed is basic-dispellable; long range means watch his facing.
- **Spotlight** (granted by Aghanim's Shard): Point Target, AoE, cast point 0.5 s. Magical damage; pierces immunity: no; dispellable: no; cooldown 30 s; mana 50; cast range 1500.
  - What it does: Shard. Three spotlights sweep a 450-radius area for 8s: enemies in the light have 45% miss chance and are revealed; illusions lose 30% max health per second. Lingers 0.3s.
  - Counterplay: Move out of the moving beams.
- **Wheel of Wonder** (Ultimate): Point Target, AoE, cast point 0.2 s. Magical damage; pierces immunity: no; dispellable: no; cooldown 90/80/70 s; mana 150/225/300; cast range 1400.
  - What it does: Rolls a wheel (minimum 700, up to 1400 away) that knocks aside enemies on the way. At rest it slows enemies around it 50% with 50-90 DPS; enemy heroes who face it for 0.5s are mesmerized and drawn toward it. The first mesmerized hero starts its timer; it explodes for 275-575 magic and a 2.5-3s stun (auto-explodes after 4s).
  - Counterplay: Turn your hero away from the wheel (facing check), stay out of 500; debuff immunity blocks.
- **Dark Carnival Barker** (Innate): Passive.
  - What it does: When an enemy hero dies within 925, Ringmaster gets one random single-use souvenir (held as charges); he also gets one if he dies without any. The souvenirs are the four abilities below.
  - Counterplay: Deny him kills near him.
- **Funhouse Mirror**: No Target, held as stacked single-use charges, instant (no cast point). Cooldown 3 s.
  - What it does: Souvenir. 0.2s invulnerable cast, then 1 distorted illusion for 18s (100% damage if ranged, 33% if melee, 300% damage taken, 25% item potency).
  - Counterplay: The illusion is fragile.
- **Strongman Tonic**: Unit Target (ally), held as stacked single-use charges, instant (no cast point). Dispellable: yes (basic dispel); cooldown 3 s; cast range 750.
  - What it does: Souvenir. Tosses a drink to an allied hero (750 range): +5 + 1 per Ringmaster level Strength for 8s (full 4s, then fading).
  - Counterplay: Basic dispel.
- **Whoopee Cushion**: No Target, held as stacked single-use charges, instant (no cast point). Cooldown 3 s.
  - What it does: Souvenir. Leaps him 400 forward and leaves a 300-radius cloud for 3s that slows enemies 35%.
  - Counterplay: Do not chase through the cloud.
- **Unicycle**: No Target, held as stacked single-use charges, cast point 0.5 s. Cooldown 3 s.
  - What it does: Souvenir. 0.5s mount, then ride a fast unicycle (up to 750 speed, turning limits) for 15s; hero damage over 20 (after 1.5s), attacking, channeling or crashing dismounts; trees are destroyed.
  - Counterplay: Any hero damage knocks him off.

#### Rubick | Intelligence | Ranged | attack range 550 | move speed 290 | [feed](https://www.dota2.com/datafeed/herodata?language=english&hero_id=86)

*Grand magus who steals enemy spells.*

- **Telekinesis**: Unit Target (enemy), cast point 0.1 s. Pierces immunity: no; dispellable: strong dispel only; cooldown 22/19/16/13 s; mana 110; cast range 550/575/600/625; upgraded by Shard.
  - What it does: Lifts an enemy 0.95-1.7s (disabled), then drops it; landing stuns other enemies within 300-375 for 0.9-1.5s. During the lift a sub-ability throws the target up to 375 in a chosen direction.
  - Aghanim's Scepter / Shard: Shard: can lift himself or allies (a repositioning save) with a quicker 0.5s throw delay and longer throw.
  - Counterplay: Linken's blocks; strong dispel only.
- **Fade Bolt**: Unit Target (enemy), cast point 0.1 s. Magical damage; pierces immunity: no; dispellable: yes (basic dispel); cooldown 16/14/12/10 s; mana 110/125/140/155; cast range 800.
  - What it does: Chain bolt (800 range) jumping between enemies within 440 (0.25s per jump): 85-325 magic, each jump -6%; hit units deal 6-24 less attack and spell damage for 9s.
  - Counterplay: Spread out; basic dispel.
- **Arcane Supremacy**: Passive.
  - What it does: +50-200 cast range and +9-21% spell amplification.
  - Counterplay: None.
- **Spell Steal** (Ultimate): Unit Target (enemy), cast point 0.1 s. Pierces immunity: yes; dispellable: no; cooldown 16/10/4 s; mana 25; cast range 1000; upgraded by Scepter and Shard.
  - What it does: Targets an enemy hero within 1000: Rubick copies the last spell that hero cast and keeps it 180-300s or until death; stolen spells have shorter cooldowns (10-30%). Cannot steal items. Pierces debuff immunity; not reflected.
  - Aghanim's Scepter / Shard: Scepter: hold 2 stolen spells, more range, stolen spells get their Scepter upgrade. Shard: stolen spells get their Shard upgrade.
  - Counterplay: Linken's blocks; cast a harmless spell last before he steals (decoy).
- **Curiosity** (Innate): Passive.
  - What it does: Stacks give +1 damage, +0.3% buff/debuff duration and +2 area per stack; 1 per level; +2 for 20s when an enemy hero casts within 1200 of him; +1 permanent if a hero he damaged in the last 3s dies while he holds its Curiosity.
  - Counterplay: Cast less near him.

#### Sand King | Universal | Melee | attack range 150 | move speed 290 | [feed](https://www.dota2.com/datafeed/herodata?language=english&hero_id=16)

*Burrowing initiator with an invisibility storm and a 2-second wind-up ultimate.*

- **Burrowstrike**: Point Target, instant (no cast point). Magical damage; pierces immunity: no; dispellable: strong dispel only; cooldown 14/13/12/11 s; mana 100/110/120/130; cast range 550/625/700/775; upgraded by Scepter.
  - What it does: Point dash: burrows at 2000 speed along a line (550-775) and erupts: enemies in a 150-wide path take 80-290 magic, are stunned 1.2-1.8s and poisoned with Caustic Finale. No cast point; alt-cast fires in the facing direction. Not blocked or reflected by Linken's/Lotus.
  - Aghanim's Scepter / Shard: Scepter: +425 range, slower burrow (1000), and spines along the path become Stinger strikes after 0.8s at 75% damage.
  - Counterplay: Line: step off his path; strong dispel removes the stun; cannot be cast while rooted.
- **Sand Storm**: No Target, instant (no cast point). Magical damage; pierces immunity: no; dispellable: no; cooldown 40/34/28/22 s; mana 85.
  - What it does: Instant storm (475-700 radius) for 16-28s: 30-90 magic DPS to enemies; Sand King is invisible while inside (visible 0.7s after attacking or casting). Leaving ends it. Dodges projectiles on cast.
  - Counterplay: True sight; leave the area; it is static.
- **Stinger**: Point Target, AoE, cast point 0.4 s. Physical damage; cooldown 15/12/9/6 s; mana 35/40/45/50; cast range 200.
  - What it does: Point AoE strike close to him (200 range, 230-290 radius): attacks every enemy with +50-140 bonus damage (60% item potency), +40% inside the inner 120-180 radius; applies slow 10-16% and Caustic Finale.
  - Aghanim's Scepter / Shard: Shard: a Caustic Finale explosion bursts around every hero hit in the inner circle.
  - Counterplay: 0.4s cast point; avoid the inner circle.
- **Caustic Finale** (Innate): Passive. Magical damage; pierces immunity: no; dispellable: yes (basic dispel).
  - What it does: His attacks poison enemies for 4.5s; if a poisoned unit dies it explodes for 17 + 2.5% of its max health in 400 radius.
  - Counterplay: Basic dispel; keep creeps that are poisoned away from heroes.
- **Epicenter** (Ultimate): No Target, cast point 2 s. Magical damage; pierces immunity: no; dispellable: no; cooldown 120/110/100 s; mana 150/225/300; upgraded by Shard.
  - What it does: 2s cast point (very visible), then 12-20 pulses around Sand King's current position over 6s, each 60-80 magic and 30-50% slow; radius grows from 450 by 13 per pulse. Typically channelled out of sight, then Blink in.
  - Aghanim's Scepter / Shard: Shard: a small 425 pulse every 3s passively. Scepter: random Stinger strikes during pulses (this upgrade appears in the feed text, while 7.42 notes say Epicenter is no longer Scepter-upgraded and the Scepter moved to Burrowstrike; treat the Epicenter Scepter text as stale).
  - Counterplay: Interrupt him during the 2s cast; spread out. It is a ground effect, so dodging projectiles does not help.

#### Shadow Demon | Intelligence | Ranged | attack range 500 | move speed 290 | [feed](https://www.dota2.com/datafeed/herodata?language=english&hero_id=79)

*Banish-and-copy support with poison stacks and a buff purge.*

- **Disruption**: Unit Target (ally or enemy), charges only via a talent, cast point 0.3 s. Pierces immunity: no; dispellable: no; cooldown 26/24/22/20 s; mana 120; cast range 675.
  - What it does: Banishes an ally or enemy hero for 2.75s (invulnerable, hidden); when it returns, 2 illusions of it appear under Shadow Demon's control (20-50% damage + flat bonus, 300% damage taken, 8-14s). Used to save allies or to set up stacking spells on the return point. Charge-style restore listed (26-20s).
  - Counterplay: Linken's blocks; not dispellable; the return point is known so stand away from it.
- **Disseminate**: Unit Target (ally or enemy), AoE, cast point 0.3 s. Pierces immunity: no; cooldown 26/22/18/14 s; mana 100; cast range 700/775/850/925.
  - What it does: 6s mark on an ally or enemy: 16-40% of damage the target takes is copied to every enemy within 675 of it (including the target if enemy). Paused while target is banished.
  - Counterplay: Spread away from the marked unit.
- **Shadow Poison**: Point Target, AoE, cast point 0.25 s. Magical damage; pierces immunity: no; dispellable: no; cooldown 2.5 s; mana 40; cast range 1500.
  - What it does: Line skillshot to 1500 (200 wide, 1200 speed): 24-60 damage and a stack; after 10s or on Release, stacks detonate for 1/2/4/8/16x stack damage (then +60 per extra stack). 2.5s CD. Not dispellable.
  - Counterplay: Sidestep the projectile; stacks build only on hits.
- **Demonic Cleanse** (granted by Aghanim's Shard): Unit Target (ally), cast point 0.3 s. Pierces immunity: yes; dispellable: no; cooldown 40 s; mana 150; cast range 800.
  - What it does: Shard. Ally (800 range) is basic-dispelled continuously for 5s, then healed 425. Works on banished allies; pierces debuff immunity.
  - Counterplay: None directly.
- **Demonic Purge** (Ultimate): Unit Target (enemy), Charges with Scepter: 2 (restore 70/65/60 s), cast point 0.3 s. Magical damage; pierces immunity: yes; dispellable: no; cooldown 70/65/60 s; mana 150/175/200; cast range 800; upgraded by Scepter.
  - What it does: Enemy target (800 range): basic dispel of buffs continuously for 5s, slow from 100% fading to 20%, then 300-550 magic damage. Works on banished targets; pierces debuff immunity.
  - Aghanim's Scepter / Shard: Scepter: also Breaks the target, and 2 charges.
  - Counterplay: Linken's blocks; save buffs until it ends.
- **Menace** (Innate): Passive. Dispellable: no.
  - What it does: Attacks apply a stacking 8s debuff: +1.9% damage taken per stack.
  - Counterplay: Break stops new stacks.

#### Shadow Fiend | Agility | Ranged | attack range 525 | move speed 305 | [feed](https://www.dota2.com/datafeed/herodata?language=english&hero_id=11)

*Soul-collecting ranged carry with three fixed-distance razes.*

- **Shadowraze**: No Target, cast point 0.55 s. Magical damage; pierces immunity: no; dispellable: yes (basic dispel); cooldown 9 s; mana 75; upgraded by Shard.
  - What it does: Three separate no-target razes (only the first, 200 range, is in the feed; the others hit circles at about 450 and 700 in front of him): 250-radius circle, 85-280 magic (+2 per soul) and a stacking amp of +20-80 raze damage per stack (6s). 0.55s cast point.
  - Aghanim's Scepter / Shard: Shard: -2s cooldown per hero hit and a stacking 12% slow.
  - Counterplay: Fixed distances in front of him: move closer or further than the circles, or sideways; basic dispel clears stacks.
- **Feast of Souls**: No Target, instant (no cast point). Dispellable: yes (basic dispel); cooldown 21 s; mana 60/65/70/75.
  - What it does: Instant 8s: +35-80 attack speed, +4-10% move speed; every 0.5s pulls souls from 2 enemies within 600 (3 per hero, 1 per creep, up to 4-10); souls of still-living owners are lost after the buff.
  - Counterplay: Leave 600 radius; dispel.
- **Presence of the Dark Lord**: Passive, Aura. Pierces immunity: yes.
  - What it does: Aura 1200: -2.5 to -7 armor and -4 to -10% magic resistance on enemies. Pierces debuff immunity.
  - Counterplay: Break, distance.
- **Requiem of Souls** (Ultimate): No Target, cast point 1.67 s. Magical damage; pierces immunity: no; dispellable: yes (basic dispel); cooldown 120/110/100 s; mana 150/175/200; upgraded by Scepter.
  - What it does: 1.67s cast point, then up to 20 lines (1 per soul) burst outward to 1000 (700 speed, widening 125-300): 80-160 magic per line, fear and 20-30% slow 1.2-1.8s +0.1s per extra line. Auto-cast on death (no fear/slow then).
  - Aghanim's Scepter / Shard: Scepter: lower cooldown, faster lines, and the lines return to SF, healing him for the damage dealt.
  - Counterplay: The long cast point is the tell: interrupt or back off; standing far reduces lines hitting you; fear is basic-dispellable.
- **Necromastery** (Innate): Passive.
  - What it does: +1 damage per soul (max 20), 1 per kill, 4 per hero kill; loses 30% on death. Break stops new souls.
  - Aghanim's Scepter / Shard: Scepter: more max souls.
  - Counterplay: Kill him to strip souls.

#### Shadow Shaman | Intelligence | Ranged | attack range 400 | move speed 285 | [feed](https://www.dota2.com/datafeed/herodata?language=english&hero_id=27)

*Disable support: hex, channelled bind, serpent wards.*

- **Ether Shock**: Unit Target (enemy), cast point 0.3 s. Magical damage; pierces immunity: no; cooldown 14/12/10/8 s; mana 90/105/120/135; cast range 600.
  - What it does: Cone from Shaman toward a target (600 range, 200-300 wide): 125-320 magic to up to 3-9 enemies (can reach 1000).
  - Counterplay: Spread out.
- **Hex**: Unit Target (enemy), instant (no cast point). Pierces immunity: no; dispellable: strong dispel only; cooldown 24/20/16/12 s; mana 120/140/160/180; cast range 550.
  - What it does: Hex: instantly turns an enemy into a harmless critter for 2-2.9s (no attacks or spells, 100 base speed). Kills illusions. 0 cast point.
  - Counterplay: Linken's blocks; strong dispel only; debuff immunity blocks.
- **Shackles**: Unit Target (enemy), Channeled up to 2.4/3/3.6/4.2 s, cast point 0.3 s. Magical damage; pierces immunity: no; dispellable: strong dispel only; cooldown 14/13/12/11 s; mana 125/140/155/170; cast range 450; upgraded by Scepter.
  - What it does: Channel 2.4-4.2s on an enemy: it cannot move or attack, takes 100-280 magic total, Shaman heals for it.
  - Aghanim's Scepter / Shard: Scepter: more range; every 0.9s the shackled unit emits an Ether Shock to all within 600; can shackle allies and wards (not disabling them) to spread shocks.
  - Counterplay: Interrupt Shaman; Linken's blocks; strong dispel.
- **Fowl Play** (Innate): Passive. Cooldown 120 s.
  - What it does: On lethal damage (120s cooldown): strong dispel, survives as a 1-HP chicken (3s) with 100% damage reduction for 1s, plus 3 decoy chickens.
  - Aghanim's Scepter / Shard: Shard: 0.1s invulnerability on trigger, uncontrollable decoy chickens, and he can use items while transformed.
  - Counterplay: Does not stop Culling Blade or Reaper's Scythe kills; burst again after the protection.
- **Urnaconda** (granted by Aghanim's Shard): Point Target, AoE, cast point 0.3 s. Pierces immunity: yes; cooldown 50 s; mana 140; cast range 650.
  - What it does: Shard. Throws a jar to a point (650 range): 275 damage in 225 radius and a Massive Serpent Ward (4x damage and pips) for 15s. Pierces debuff immunity.
  - Counterplay: Kill the ward with hero attacks.
- **Mass Serpent Ward** (Ultimate): Point Target, AoE, cast point 0.3 s. Physical damage; pierces immunity: yes; cooldown 110 s; mana 200/350/550; cast range 550.
  - What it does: Summons 10 serpent wards (45s, 2 hero hits each, immune to magic) that attack enemy units and buildings for 50-120.
  - Aghanim's Scepter / Shard: Shard: enables Urnaconda.
  - Counterplay: Hero attacks kill them fast; creeps and illusions do 25%.

#### Silencer | Intelligence | Ranged | attack range 600 | move speed 300 | [feed](https://www.dota2.com/datafeed/herodata?language=english&hero_id=75)

*Anti-caster: silences, Intelligence theft, global silence.*

- **Arcane Curse**: Point Target, AoE, cast point 0.3 s. Magical damage; pierces immunity: no; dispellable: yes (basic dispel); cooldown 22/20/18/16 s; mana 120/130/140/150; cast range 850.
  - What it does: Point AoE (350, 850 range): 20-80 impact then 16-40 DPS and 16-25% slow for 6s; each spell the victim casts adds 2s; timer pauses while silenced.
  - Counterplay: Do not cast while cursed; basic dispel.
- **Glaives of Wisdom**: Unit Target (enemy), Autocast, attack modifier (orb), instant (no cast point). Magical damage; pierces immunity: no; dispellable: no; mana 12/14/16/18; cast range 600; upgraded by Shard.
  - What it does: Autocast attack modifier: +35-80% of his Intelligence as magic damage per hit and steals 2-5 Intelligence for 10-40s.
  - Aghanim's Scepter / Shard: Shard: bounces to one more enemy within 450 and steals more.
  - Counterplay: Attacks are projectiles; magic resistance.
- **Last Word**: Unit Target (enemy), cast point 0.3 s. Magical damage; pierces immunity: no; dispellable: yes (basic dispel); cooldown 22/18/14/10 s; mana 100/105/110/115; cast range 900.
  - What it does: Mark an enemy (900 range) for 3-6s with vision: if it casts a spell (or when the timer ends) it takes 120-240 + Intelligence-difference x1-2.5 magic and is silenced 4s.
  - Counterplay: Do not cast during the mark; basic dispel removes it.
- **Suffer In Silence** (Innate): Passive.
  - What it does: Takes 5% less damage from and deals 5% more to silenced targets; enemy heroes dying within 925 or with his debuff lose 1 Intelligence permanently to him (+1 if silenced).
  - Aghanim's Scepter / Shard: Shard: steals more Intelligence per kill.
  - Counterplay: Break removes the damage part only (7.42).
- **Global Silence** (Ultimate): No Target, cast point 0.3 s. Pierces immunity: yes; dispellable: yes (basic dispel); cooldown 120 s; mana 300/450/600; upgraded by Scepter.
  - What it does: 0.3s cast: every enemy hero and unit on the map is silenced for 4.5-6s. Works on invisible and debuff-immune units at cast, but gaining debuff immunity later removes it.
  - Aghanim's Scepter / Shard: Scepter: also applies Arcane Curse to every hero hit.
  - Counterplay: Activate debuff immunity after it lands; basic dispel removes it.

#### Skywrath Mage | Intelligence | Ranged | attack range 625 | move speed 325 | [feed](https://www.dota2.com/datafeed/herodata?language=english&hero_id=101)

*Glass-cannon magic nuker.*

- **Arcane Bolt**: Unit Target (enemy), cast point 0.1 s. Magical damage; pierces immunity: no; cooldown 5/4/3/2 s; mana 70; cast range 875; upgraded by Shard.
  - What it does: Slow homing bolt (500 speed): 60-150 + 1.5x Intelligence magic. Cannot be disjointed. 5-2s CD.
  - Aghanim's Scepter / Shard: Shard: two extra bolts at random enemies within 500 of the target.
  - Counterplay: Out-range or block with Linken's; magic resistance.
- **Concussive Shot**: No Target, instant (no cast point). Magical damage; pierces immunity: no; dispellable: yes (basic dispel); cooldown 15/14/13/12 s; mana 80/85/90/95; cast range 1600; upgraded by Scepter.
  - What it does: No-target homing shot that seeks the closest visible enemy hero within 1600 (creep if none): 120-300 magic and 40% slow in 250 for 4s.
  - Aghanim's Scepter / Shard: Scepter: a second shot at another random enemy within 500.
  - Counterplay: Stay in fog or out of 1600; let a creep/hero closer take it.
- **Ancient Seal**: Unit Target (enemy), cast point 0.1 s. Pierces immunity: no; dispellable: yes (basic dispel); cooldown 14 s; mana 80/90/100/110; cast range 700/750/800/850; upgraded by Scepter.
  - What it does: Silence for 3-6s and -16 to -28% magic resistance (heroes only).
  - Aghanim's Scepter / Shard: Scepter: also seals another random enemy within 500.
  - Counterplay: Linken's blocks; basic dispel.
- **Shield of the Scion** (Innate): Passive.
  - What it does: Each time his spells deal magic damage to an enemy hero he gains +1 Intelligence (25s) and a 13.5 magic barrier (10s), stacking independently.
  - Counterplay: Avoid long trades.
- **Mystic Flare** (Ultimate): Point Target, AoE, cast point 0.1 s. Magical damage; pierces immunity: no; cooldown 55/35/15 s; mana 300/550/800; cast range 1200; upgraded by Scepter.
  - What it does: Point AoE with tiny 170 radius: 800-1450 magic damage over 2s, split evenly among heroes inside (only creeps if no heroes). Kills illusions.
  - Aghanim's Scepter / Shard: Scepter: a second flare on another random enemy within 500.
  - Counterplay: Simply walk out of the small circle; stand next to an ally to split it.

#### Slardar | Strength | Melee | attack range 150 | move speed 300 | [feed](https://www.dota2.com/datafeed/herodata?language=english&hero_id=28)

*Armor-shredding melee initiator.*

- **Guardian Sprint**: No Target, instant (no cast point). Dispellable: yes (basic dispel); cooldown 33/28/23/18 s; mana 25.
  - What it does: Instant, works while channeling: +10-34% speed for 10s, phases through units, 100% slow resistance for the first 2.5s.
  - Counterplay: Basic dispel.
- **Slithereen Crush**: No Target, cast point 0.25 s. Physical damage; pierces immunity: no; dispellable: strong dispel only; cooldown 8.5/8/7.5/7 s; mana 100; upgraded by Shard.
  - What it does: 0.25s cast: stuns enemies within 325 for 0.8s, 60-300 physical, then slows 20-35% (move and attack) for 3-6s; leaves a water puddle.
  - Aghanim's Scepter / Shard: Scepter: bigger and longer puddle. Shard: applies Corrosive Haze for 5s to those hit.
  - Counterplay: Stay outside 325; strong dispel removes stun.
- **Bash of the Deep**: Passive. Physical damage; pierces immunity: yes; dispellable: strong dispel only.
  - What it does: Every 4th attack (after 3) bashes for 1s with +35-200 physical. Pierces debuff immunity.
  - Counterplay: Count his hits, kite.
- **Seaborn Sentinel** (Innate): Passive. Upgraded by Scepter.
  - What it does: In puddles, his water trail or the river: +move speed, regen, armor and attack damage.
  - Aghanim's Scepter / Shard: Scepter: much more regen and armor, +40% status resistance in water, puddles 75% bigger and 5s longer.
  - Counterplay: Fight him away from water.
- **Corrosive Haze** (Ultimate): Unit Target (enemy), cast point 0.3 s. Pierces immunity: yes; dispellable: yes (basic dispel); cooldown 5 s; mana 25; cast range 900.
  - What it does: 5s cooldown: -8 to -20 armor on an enemy for 18s, vision and true sight (reveals invisibility); the target leaves a water trail. Pierces debuff immunity.
  - Counterplay: Basic dispel; Linken's blocks.

#### Slark | Agility | Melee | attack range 150 | move speed 300 | [feed](https://www.dota2.com/datafeed/herodata?language=english&hero_id=93)

*Slippery agility thief with self-purge.*

- **Dark Pact**: No Target, cast point 0 s. Magical damage; pierces immunity: no; cooldown 9/8/7/6 s; mana 65.
  - What it does: Instant cast, then after a 1.5s delay 10 pulses over 1s: each strong-dispels Slark and deals 75-300 total magic to enemies within 325 (he takes 30%, non-lethal).
  - Counterplay: Stun him again after the pulses; the 1.5s delay is the window.
- **Pounce**: No Target, Charges with Scepter: 2 (restore 12 s), instant (no cast point). Magical damage; pierces immunity: no; dispellable: no; cooldown 24/20/16/12 s; mana 75; upgraded by Scepter.
  - What it does: Instant leap forward 700 at 933 speed; the first enemy hero touched is leashed for 2.5-3.25s within 400 of the landing point and gets Essence Shift stacks. Debuff immune units cannot be leashed. Leashes no longer stop movement abilities (7.42 rule).
  - Aghanim's Scepter / Shard: Scepter: 2 charges (12s) and 900 distance.
  - Counterplay: Sidestep the leap path; blink/dash out of the leash; not dispellable.
- **Saltwater Shiv**: Unit Target (enemy), Autocast, attack modifier (orb), instant (no cast point). Physical damage; pierces immunity: no; dispellable: yes (basic dispel); cooldown 12/10.5/9/7.5 s; mana 25/30/35/40; cast range 150.
  - What it does: Autocast attack modifier on heroes: steals 4-16% move speed, health regen and health restoration per hit (independent stacks, 12s).
  - Counterplay: Basic dispel.
- **Depth Shroud** (granted by Aghanim's Shard): Point Target, AoE, cast point 0.1 s. Cooldown 75 s; mana 75; cast range 400.
  - What it does: Shard. Point cloud (225 radius) for 2s: allies inside are hidden as with Shadow Dance.
  - Counterplay: Area damage on the cloud.
- **Essence Shift** (Innate): Passive, Aura. Pierces immunity: yes; dispellable: no.
  - What it does: Each attack on a hero steals 1 of each attribute for 10s and gives Slark +3 Agility; a kill near him steals 1 Agility permanently. Pierces debuff immunity.
  - Counterplay: Short fights; Break stops new temporary stacks.
- **Shadow Dance** (Ultimate): No Target, instant (no cast point). Dispellable: no; cooldown 50/40/30 s; mana 100.
  - What it does: Passive: when unseen by enemies he gets +20-40% speed and 60-120 regen. Active (instant): hides him from all detection for 4-4.5s; enemies see only the cloud.
  - Counterplay: Hit the cloud with area spells; fight where he is always seen (wards, vision) to stop the passive.

#### Snapfire | Universal | Ranged | attack range 400 | move speed 300 | [feed](https://www.dota2.com/datafeed/herodata?language=english&hero_id=128)

*Granny gunslinger riding a frog (Mortimer): shotgun cone, ally-launching cookie, artillery ultimate.*

- **Scatterblast**: Point Target, cast point 0.4 s. Magical damage; pierces immunity: no; dispellable: yes (basic dispel); cooldown 17/14/11/8 s; mana 85/90/95/100; cast range 800.
  - What it does: Cone shotgun toward a point (800 range, 250 to 400 wide, 3000 speed): 100-280 magic and a 1s 100% move and attack slow; within 450 (point-blank) +25% damage and +50% slow strength and duration.
  - Aghanim's Scepter / Shard: Shard: point-blank hits knock back 250 and stun 1.4s with +85% bonus.
  - Counterplay: Stay far: the point-blank zone is where it hurts; basic dispel.
- **Firesnap Cookie**: Unit Target (ally), charges only via a talent, cast point 0.2 s. Magical damage; dispellable: strong dispel only; cooldown 18/17/16/15 s; mana 105; cast range 650; upgraded by Shard.
  - What it does: Feeds a cookie (1200-speed projectile, 650 range) to herself (0.3s delay), an ally or a creep: the eater hops 425 forward and on landing stuns enemies within 300 for 1-2.2s with 60-270 magic. Charge-style restore listed.
  - Aghanim's Scepter / Shard: Shard: cookie also heals the eater 175 and fires a Mortimer glob (40% damage) at the landing spot.
  - Counterplay: Landing point is fixed in front of the eater: step out of it; strong dispel; it can be used as an ally escape over cliffs.
- **Lil' Shredder**: No Target, instant (no cast point). Physical damage; cooldown 21/18/15/12 s; mana 70/80/90/100; cast range 800.
  - What it does: Instant: next 5 attacks within 6s get +20-65 + 35% damage, +300 attack speed (1.0 BAT), +160-400 range, and each strips 0.5 armor for 5s.
  - Counterplay: Hide behind units or disengage until the 5 shots are spent.
- **Gobble Up** (granted by Aghanim's Scepter): Unit Target (any unit, custom rules), cast point 0.3 s. Cooldown 40 s; mana 120; cast range 150.
  - What it does: Scepter ability. Mortimer swallows a creep or allied hero next to her (150 range), holding it up to 3s.
  - Counterplay: Kill or stun Snapfire before the spit.
- **Spit Out** (granted by Aghanim's Scepter): Point Target, AoE, cast point 0.3 s. Magical damage; pierces immunity: no; dispellable: yes (basic dispel); cast range 3000.
  - What it does: Scepter ability. Spits the swallowed unit to a point up to 3000 away (no minimum range): 400-radius impact with 1.2s stun and a firespit pool (slow 25%, burn).
  - Counterplay: The lob shows its landing zone: move out.
- **Mortimer Kisses** (Ultimate): Point Target, AoE, cast point 0.5 s. Magical damage; pierces immunity: no; dispellable: yes (basic dispel); cooldown 120/110/100 s; mana 125/150/175; cast range 3000.
  - What it does: Over 5.5s Mortimer lobs 8 globs at a point 600-3000 away (she steers the aim by right-clicking, turning slowly): each 180-320 magic in 275 radius and a pool that burns 60-100 per second and slows 15-25% for 3.5s. Travel time 0.8-2s.
  - Counterplay: Each glob's landing marker is visible and slow: keep moving; minimum range 600 means hug her; Stop/another ability cancels it, so stun her.
- **Boomstick** (Innate): Passive.
  - What it does: Her damage is amplified up to 35% against enemies close to her (strongest within 50, fading to 0 at about 495).
  - Counterplay: Keep distance. Fully disabled by Break (7.42).

#### Sniper | Agility | Ranged | attack range 550 | move speed 285 | [feed](https://www.dota2.com/datafeed/herodata?language=english&hero_id=35)

*Long-range glass cannon.*

- **Shrapnel**: Point Target, AoE, Charges 3 (restore 35 s), cast point 0.3 s. Magical damage; pierces immunity: no; dispellable: no; mana 75; cast range 1800.
  - What it does: Charge-based (3 charges, 35s each): point AoE to 1800, after 1.2s a 400-475 radius shower for 10s: 30-75 magic per second and 10-25% slow; reveals the area; no building damage.
  - Counterplay: Leave the area; not dispellable; 1.2s delay before damage.
- **Headshot**: Passive. Physical damage; pierces immunity: no.
  - What it does: 40% chance per attack: +20-110 physical, small knockback (stronger up close) and 100% move and attack slow for 0.2-0.5s.
  - Counterplay: Close in; evasion.
- **Take Aim**: No Target, instant (no cast point). Dispellable: yes (basic dispel); cooldown 22/20/18/16 s; mana 50.
  - What it does: Passive +160-400 attack range. Active (instant): 3s of 100% Headshot chance, +75-300 more range and +500-1250 vision, but he is slowed 65% and sees only a forward cone.
  - Counterplay: Dive him during the active (he is slow).
- **Concussive Grenade** (granted by Aghanim's Shard): Point Target, AoE, cast point 0.1 s. Magical damage; pierces immunity: no; dispellable: yes (basic dispel); cooldown 10 s; mana 50; cast range 600.
  - What it does: Shard. Point AoE (600 range, 375 radius): 200 magic, knocks enemies (and Sniper himself) back 475, then disarm and 50% slow for 3s.
  - Counterplay: Basic dispel; the self-knockback also moves him away.
- **Keen Scope** (Innate): Passive.
  - What it does: +1.5 attack damage per 100 distance from his target.
  - Counterplay: Stand close to him.
- **Assassinate** (Ultimate): Unit Target (enemy), cast point 2 s. Magical damage; pierces immunity: no; dispellable: no; cooldown 20/15/10 s; mana 175; cast range 3000; upgraded by Scepter.
  - What it does: Locks on an enemy up to 3000 away; after a 2s aim (crosshair visible only to his team), fires a bullet (2500 speed) dealing his attack damage + 300-500 with +20-50% item potency, mini-stun. Refreshes on hero kills. Invisibility does not dodge it.
  - Aghanim's Scepter / Shard: Scepter: 0.5s aim and a 0.8-1.2s stun.
  - Counterplay: Interrupt the 2s aim with a stun, silence or hex (running away does not help, because the shot tracks the target). Disjoint the bullet with a blink or a moment of invulnerability. Linken's blocks it.

#### Spectre | Agility | Melee | attack range 150 | move speed 295 | [feed](https://www.dota2.com/datafeed/herodata?language=english&hero_id=67)

*Global-presence carry: Haunt sends illusions at every enemy hero.*

- **Spectral Dagger**: Unit or Point Target, cast point 0.3 s. Magical damage; dispellable: yes (basic dispel); cooldown 22/20/18/16 s; mana 100/110/120/130; cast range 1800.
  - What it does: Dagger to a unit or point (1800 range, 800 speed): 80-200 magic and a slow on everything it touches, leaving a 12s shadow path (heroes hit trail their own 7s path). On the path Spectre gets +14-20% speed and walks through terrain. Not blocked or reflected by Linken's/Lotus.
  - Counterplay: Basic dispel the slow; move off the trail.
- **Shadow Step**: Unit Target (enemy), AoE, cast point 0.3 s. Pierces immunity: yes; cooldown 24/21/18/15 s; mana 60/65/70/75; cast range 1000.
  - What it does: Sends an uncontrollable illusion (900 speed) to chase and attack an enemy hero for 3.5-5s; Spectre can use Reality to teleport to it. Pierces debuff immunity.
  - Counterplay: Kill the illusion (it takes 175%) or expect her to arrive.
- **Dispersion**: Passive. Pierces immunity: yes; upgraded by Shard.
  - What it does: 9-18% of damage she takes is not taken and is reflected as the same type to enemies within 350 (full) to 700 (fading).
  - Aghanim's Scepter / Shard: Shard: activate (25s CD, 50 mana) for +50% absorb and reflect for 5s.
  - Counterplay: Avoid prolonged fights with her; reflected damage cannot be reflected; Break disables it.
- **Desolate** (Innate): Passive. Pure damage; pierces immunity: yes.
  - What it does: Bonus pure damage (23.5) per hit against enemies with no allied units within 350. Illusions too.
  - Counterplay: Stay grouped.
- **Haunt** (Ultimate): No Target, cast point 0.3 s. Pierces immunity: yes; cooldown 160/150/140 s; mana 125/175/225; upgraded by Scepter.
  - What it does: 0.3s cast: an uncontrollable illusion appears next to every enemy hero on the map and attacks for 6s (35-65% damage, 200% damage taken, ignores terrain); Spectre can Reality to any one.
  - Aghanim's Scepter / Shard: Scepter: -20s cooldown and the first Reality fears enemies within 400 for 2s with 50% slow.
  - Counterplay: Group up, so whichever illusion she teleports to, she lands in a fight on your terms. Kill the illusions (they take 200% damage). Spell block does not help, because Haunt is not a targeted spell.

#### Spirit Breaker | Strength | Melee | attack range 170 | move speed 295 | [feed](https://www.dota2.com/datafeed/herodata?language=english&hero_id=71)

*Charging bully.*

- **Charge of Darkness**: Unit Target (enemy), cast point 0.1 s. Pierces immunity: no; dispellable: no; cooldown 22/19/16/13 s; mana 80/90/100/110.
  - What it does: Targets any enemy (any distance) after 0.1s and charges through units, trees and cliffs, ramping from 25% to full bonus speed (+275-425) over 1.5s; gains vision of the target; on arrival a Greater Bash with 1.3-2.2s stun; enemies he passes through are bashed too. If the target dies, retargets the nearest enemy. Charge line visible only to his allies.
  - Aghanim's Scepter / Shard: Shard: more charge speed.
  - Counterplay: Interrupt with any stun, hex or root (cannot be cast while rooted); units in his path do not stop him (he passes through and bashes them); invisibility or a long blink makes him lose time; allies see the line, the victim only sees him coming.
- **Bulldoze**: No Target, instant (no cast point). Dispellable: yes (basic dispel); cooldown 22/20/18/16 s; mana 30/40/50/60.
  - What it does: Instant 7s: +8-20% move speed and 40-70% status resistance; usable while charging.
  - Counterplay: Basic dispel.
- **Greater Bash**: Passive. Magical damage; pierces immunity: yes; dispellable: strong dispel only; cooldown 1.2 s; upgraded by Scepter.
  - What it does: 17% chance (1.2s cooldown) on attack to stun 0.9-1.5s and knock back, dealing 24-36% of his move speed as magic damage; also gives him bonus speed. Pierces debuff immunity. Break disables only the random chance.
  - Aghanim's Scepter / Shard: Scepter: farther knockback; a knocked enemy that collides with another bashes it too and takes 25% of the bash again.
  - Counterplay: Slow him (damage scales with speed); strong dispel.
- **Planar Pocket** (granted by Aghanim's Shard): Unit Target (ally or enemy), instant (no cast point). Pierces immunity: no; dispellable: strong dispel only; cooldown 30 s; mana 100; cast range 700.
  - What it does: Shard. Instant on any hero within 700 for 6s: enemy unit-targeted spells cast at that hero are redirected to Spirit Breaker, who gains 50% magic resistance. Ends if they are 900 apart.
  - Counterplay: Use area spells or wait it out.
- **Empowering Haste** (Innate): Passive. Dispellable: no.
  - What it does: Each stun he inflicts gives +8% speed for 2s (creeps 2% for 1s), stacking, can exceed the speed cap; pauses during Charge.
  - Counterplay: Break stops new stacks.
- **Nether Strike** (Ultimate): Unit Target (enemy), cast point 1 s. Magical damage; pierces immunity: yes; dispellable: strong dispel only; cooldown 75/55/35 s; mana 125/150/175; cast range 700; upgraded by Scepter.
  - What it does: 1s cast point, then teleports behind an enemy within 700 and applies a Greater Bash with +150-350 damage and double knockback. Pierces debuff immunity.
  - Aghanim's Scepter / Shard: Scepter: much bigger knockback.
  - Counterplay: The 1s cast point is a window to interrupt or blink away; Linken's blocks; cannot be cast while rooted.

#### Storm Spirit | Intelligence | Ranged | attack range 480 | move speed 285 | [feed](https://www.dota2.com/datafeed/herodata?language=english&hero_id=17)

*Mana-hungry teleport mage.*

- **Static Remnant**: Point Target per its tooltip and values (the feed flag says No Target; can be self-cast to drop it in place), instant (no cast point). Magical damage; pierces immunity: no; cooldown 3.5 s; mana 70/80/90/100; cast range 800.
  - What it does: Instant: an electric copy walks to a point (300 speed) and arms after 0.75s; if an enemy comes within 235 it explodes for 100-280 magic in 300 radius. Lasts 12s; gives flying vision. 3.5s CD.
  - Counterplay: Walk around remnants; let creeps trigger them.
- **Electric Vortex**: Unit Target (enemy), cast point 0.3 s. Pierces immunity: no; dispellable: strong dispel only; cooldown 20/18/16/14 s; mana 60/70/80/90; cast range 300; upgraded by Scepter.
  - What it does: Pulls an enemy (300 range) toward Storm for 1.1-2s, up to 180-300 distance, disabling it; Storm is slowed 50% for 3s after.
  - Aghanim's Scepter / Shard: Scepter: pulls every enemy within 475.
  - Counterplay: Linken's blocks; strong dispel only.
- **Overload**: Passive. Magical damage; pierces immunity: no; dispellable: yes (basic dispel); upgraded by Shard.
  - What it does: Each spell cast charges his next attack to burst for 25-100 magic in 300 radius with 80% move and 90% attack slow (0.8s). Charges do not stack.
  - Aghanim's Scepter / Shard: Shard: active that gives himself and allies within 750 three Overload charges and +40 attack speed for 12s.
  - Counterplay: Keep distance from his hits after casts.
- **Ball Lightning** (Ultimate): Point Target, cast point 0.3 s. Magical damage; pierces immunity: no; mana 30.
  - What it does: Turns into lightning and flies (1400-2300 speed) to a point; he is invulnerable in flight, damages enemies along the way (6-14 per 100 distance traveled), and keeps going until he arrives or runs out of mana. Costs 25 + 7.5% max mana to start plus 10 + 0.65% per 100 units. Destroys trees; items and spells usable while traveling. No cooldown.
  - Counterplay: Drain his mana (mana burn, silence before he casts); he cannot be hit in flight, so guard where he lands; cannot be cast while rooted.
- **Galvanized** (Innate): Passive. Dispellable: no.
  - What it does: +0.25 mana regen per charge from kills and every 3 levels (+0.1 permanent per gained charge); loses 2 charges per death.
  - Counterplay: Kill him.

#### Sven | Strength | Melee | attack range 150 | move speed 325 | [feed](https://www.dota2.com/datafeed/herodata?language=english&hero_id=18)

*Stun-and-cleave strength carry.*

- **Storm Hammer**: Unit Target (enemy), AoE, cast point 0.2 s. Magical damage; pierces immunity: no; dispellable: strong dispel only; cooldown 21/18/15/12 s; mana 110; cast range 600; upgraded by Scepter.
  - What it does: Hammer projectile (1000 speed) at an enemy: 80-320 magic and 1-1.75s stun to enemies within 250-310 of the target.
  - Aghanim's Scepter / Shard: Scepter: more range and speed, basic dispel on the target, hits invulnerable units; alt-cast makes Sven ride the hammer and deal +180.
  - Counterplay: Disjoint (blink, invulnerability) or Linken's; strong dispel only.
- **Great Cleave**: Passive. Pierces immunity: yes.
  - What it does: Attacks cleave 60-90% damage in a cone 150 to 270-360 wide and 400-700 long. Pierces debuff immunity.
  - Counterplay: Spread out; Break.
- **Warcry**: No Target, instant (no cast point). Affects debuff-immune allies: yes; dispellable: yes (basic dispel); cooldown 36/32/28/24 s; mana 45; upgraded by Shard.
  - What it does: Instant: allied heroes within 700 get +5-14 armor and +6-15% speed for 8s.
  - Aghanim's Scepter / Shard: Shard: bigger radius, more speed, undispellable, and a 350 physical-damage barrier.
  - Counterplay: Basic dispel (unless Shard).
- **God's Strength** (Ultimate): No Target, cast point 0.3 s. Dispellable: no; cooldown 110/105/100 s; mana 100/125/150.
  - What it does: 0.3s cast: +110-190% damage (base plus primary attribute) and 40% slow resistance for 30s.
  - Counterplay: Disable or kite; not dispellable.
- **Wrath of God** (Innate): Passive.
  - What it does: +0.08 attack damage per point of Strength.
  - Counterplay: None.

#### Techies | Universal | Ranged | attack range 600 | move speed 310 | [feed](https://www.dota2.com/datafeed/herodata?language=english&hero_id=105)

*Explosives trap-layer.*

- **Sticky Bomb**: Point Target, AoE, cast point 0.1 s. Magical damage; pierces immunity: no; dispellable: yes (basic dispel); cooldown 16/13/10/7 s; mana 100/115/130/145; cast range 1000.
  - What it does: Lobs a bomb (1000 range, 500 speed) to a point; if an enemy hero is next to it, it sticks and chases (up to 4s), slowing 25-55%; explodes after 1.5s for 95-320 magic in 350 and a 15-45% slow for 3s.
  - Counterplay: Outrun the chase or dispel; basic dispel.
- **Reactive Tazer**: Unit Target (ally), cast point 0.1 s. Magical damage; pierces immunity: no; dispellable: yes (basic dispel); cooldown 26/22/18/14 s; mana 60; cast range 600.
  - What it does: Ally buff 6s: +18-30% speed; enemies who attack the ally take damage, are disarmed 2.25-3s and get a basic dispel; at the end (or early via sub-ability) it explodes, disarming and damaging enemies within 400.
  - Counterplay: Stop attacking that ally; basic dispel the buff.
- **Blast Off!**: Point Target, AoE, cast point 1 s. Magical damage; pierces immunity: no; dispellable: yes (basic dispel); cooldown 40/35/30/25 s; mana 100/125/150/175; cast range 1000.
  - What it does: 1s cast, then Techies leap to a point within 1000 (0.75s air): 200-500 magic and 0.8-1.4s stun in 400 radius; Techies lose 20% current health (non-lethal pure). Destroys trees; cannot be cast while rooted.
  - Counterplay: The 1s wind-up and the landing circle are the warning: move out.
- **M.A.D.** (Innate): Passive. Magical damage; pierces immunity: no; upgraded by Shard.
  - What it does: Bonus mana regen equal to 0.1% of max mana; on death a barrel explodes after 1.5s for 50 + 30% max mana magic in 400. Break removes only the regen.
  - Aghanim's Scepter / Shard: Shard: becomes an active: plant one M.A.D. barrel (3 pip health) and detonate it manually, with 45% max mana as damage.
  - Counterplay: Back off after killing him.
- **Minefield Sign** (granted by Aghanim's Scepter): Point Target, AoE, cast point 1.25 s. Cooldown 60 s; cast range 10.
  - What it does: Scepter ability (1.25s cast, next to him): a sign for 240s that makes nearby mines invulnerable and +15% damage; when an enemy hero comes within 200, a 1000-radius minefield activates for 10s that damages heroes as they move (300 per 200 moved).
  - Counterplay: Do not move inside the triggered field, or leave fast; avoid the sign.
- **Proximity Mines** (Ultimate): Point Target, AoE, Charges 3 (restore 14/13/12 s), instant (no cast point). Magical damage; pierces immunity: no; dispellable: yes (basic dispel); cooldown 0.25 s; mana 125/175/225; cast range 450.
  - What it does: Charge-based (3 charges, 14-12s, 0.25s between): plants an invisible mine (not revealed by true sight) that becomes visible to an enemy within 500; if an enemy stays within 500 for 1s it explodes for 400-700 magic (full within 150, down to 50% at the edge) and -12-20% magic resistance; 30% to buildings. Mines need 350 spacing and have 1 pip.
  - Counterplay: Move through quickly (1s trigger); destroy mines (30 gold); triggered by invisible units.

#### Templar Assassin | Agility | Ranged | attack range 250 | move speed 315 | [feed](https://www.dota2.com/datafeed/herodata?language=english&hero_id=46)

*Shielded, invisible ranged assassin.*

- **Refraction**: No Target, instant (no cast point). Physical damage; pierces immunity: yes; dispellable: no; cooldown 14 s; mana 95; upgraded by Shard.
  - What it does: Instant 17s: 3-6 instances of protection (each a 30 barrier that fully absorbs any single hit that exceeds it) and, separately, 3-6 attacks with +15-60 damage. Pierces debuff immunity; not dispellable.
  - Aghanim's Scepter / Shard: Shard: more bonus damage and castable while disabled.
  - Counterplay: Break the charges with many small hits (DoTs, illusions, Rot); HP-removal bypasses it.
- **Meld**: No Target, instant (no cast point). Physical damage; pierces immunity: yes; dispellable: no; cooldown 11/9/7/5 s; mana 35/40/45/50.
  - What it does: Invisible while standing still; her next attack from Meld deals +50-200 bonus damage and -2 to -8 armor for 6s, also on Psi Blades split targets. Any action except staying put or Psionic Projection breaks it.
  - Counterplay: True sight; move out of her attack line.
- **Psi Blades**: Passive. Pure damage; pierces immunity: yes.
  - What it does: +50-200 attack range; attacks spill through the target in a 90-wide line 400-700 long dealing 70-100% as pure damage to units behind. Hits invisible units.
  - Counterplay: Do not stand behind your creep/ally in line with her.
- **Psionic Projection** (granted by Aghanim's Scepter): Point Target, Channeled up to 2 s, cast point 0.2 s. Cooldown 10 s; mana 50.
  - What it does: Scepter ability. Channel 2s, then teleport to any of her traps; it detonates fully charged with +400 damage. Does not break Meld.
  - Counterplay: Interrupt the channel; destroy traps.
- **Psionic Trap** (Ultimate): Point Target, cast point 0.3 s. Magical damage; pierces immunity: no; dispellable: yes (basic dispel); cooldown 11/8/5 s; mana 15; cast range 1600/1800/2000; upgraded by Scepter.
  - What it does: Places invisible traps (up to 5-11, 1600-2000 range, last forever, fade in 2s, 2 fragile pips); she triggers one via a sub-ability: slow 20% rising to 50% over 3.5s in 400 radius, then 200-400 damage.
  - Aghanim's Scepter / Shard: Scepter: triggered traps also silence (0.25s up to 3s).
  - Counterplay: Detection (sentry/dust) and destroy traps; leave the radius before 3.5s.
- **Inner Peace** (Innate): Passive.
  - What it does: After 0.2s standing still without damage she meditates, ramping up to +2.7 health and +2.2 mana regen over 1.85s.
  - Counterplay: Poke her.

#### Terrorblade | Agility | Melee | attack range 150 | move speed 315 | [feed](https://www.dota2.com/datafeed/herodata?language=english&hero_id=109)

*Illusion and demon-form carry with health swap.*

- **Reflection**: Point Target, AoE, cast point 0.3 s. Pierces immunity: no; dispellable: yes (basic dispel); cooldown 23/20/17/14 s; mana 60/65/70/75; cast range 700.
  - What it does: Point AoE (400, 700 range): each enemy hero inside is slowed 15-30% (move and attack) and attacked by its own invulnerable, untargetable reflection (30-75% damage) for 5s.
  - Counterplay: Basic dispel removes the slow and the reflection.
- **Conjure Image**: No Target, cast point 0.15 s. Cooldown 16 s; mana 50/60/70/80.
  - What it does: 0.15s cast: one illusion for 34s (25-40% damage, 250% damage taken).
  - Counterplay: AoE damage.
- **Metamorphosis**: No Target, instant (no cast point). Physical damage; dispellable: no; cooldown 145/140/135/130 s; mana 100.
  - What it does: Instant (0.35s transform): demon form for 35-50s with ranged attack (450-600), +20-80 damage, BAT 1.5; illusions within 1200 transform too.
  - Counterplay: Kite and wait out; not dispellable.
- **Demon Zeal** (granted by Aghanim's Shard): No Target, cast point 0.2 s. Dispellable: no; cooldown 45 s.
  - What it does: Shard. Costs 20% current health: he and illusions within 1200 get +90 attack speed, +60 speed, +20 regen for 25s. Not in Metamorphosis.
  - Counterplay: Burst him after the health cost.
- **Terror Wave** (granted by Aghanim's Scepter): No Target, instant (no cast point). Magical damage; dispellable: yes (basic dispel); cooldown 85 s; mana 75.
  - What it does: Scepter ability. A ring expands from him to 1600 (1000 speed): 250 magic, 2s fear to enemy heroes, and Terrorblade gets 15s of Metamorphosis.
  - Counterplay: Ring is slow: distance gives time; basic dispel the fear.
- **Sunder** (Ultimate): Unit Target (ally or enemy), cast point 0.35 s. Pierces immunity: no; cooldown 110/75/40 s; mana 100/75/50; cast range 475.
  - What it does: Swaps health percentages between Terrorblade and a target hero (ally or enemy) within 475; neither can be dropped below 25-35% (the minimum is ignored for enemies per the values, unclear). Debuff-immune enemies are unaffected.
  - Counterplay: Linken's or debuff immunity; stay out of 475 when he is low.
- **Dark Unity** (Innate): Passive.
  - What it does: His illusions within 1200 get +60% attack damage. Fully disabled by Break (7.42).
  - Counterplay: Separate illusions from him; Break.

#### Tidehunter | Strength | Melee | attack range 150 | move speed 300 | [feed](https://www.dota2.com/datafeed/herodata?language=english&hero_id=29)

*Tanky initiator with the classic big-radius stun ultimate.*

- **Gush**: Unit Target (enemy), cast point 0.3 s. Magical damage; pierces immunity: no; dispellable: yes (basic dispel); cooldown 12 s; mana 100; cast range 700; upgraded by Scepter.
  - What it does: Water projectile (2500 speed, 700 range): 100-280 magic, 40% slow and -3 to -6 armor for 4s.
  - Aghanim's Scepter / Shard: Scepter: becomes a line wave toward a point (2200 range, 260 wide, 1500 speed), 7s cooldown.
  - Counterplay: Projectile: disjoint or Linken's; basic dispel.
- **Kraken Shell**: No Target, instant (no cast point). Dispellable: no; cooldown 30 s; mana 45.
  - What it does: Passive: blocks 15-75 of each physical attack (half vs creeps); if he takes 600-450 damage within 7s, he gets a strong dispel. Active (instant): double block for 4s at -40% move speed.
  - Counterplay: Magic damage ignores the block; spread damage so the dispel threshold is not reached at the wrong time (or burst through it).
- **Anchor Smash**: No Target, cast point 0.4 s. Physical damage; pierces immunity: no; dispellable: yes (basic dispel); cooldown 7/6/5/4 s; mana 40/45/50/55.
  - What it does: 0.4s cast: attacks all enemies within his attack range +225 with +50-200 damage and cuts their attack damage 25-40% for 6s.
  - Counterplay: Basic dispel; stay out of melee range +225.
- **Dead in the Water** (granted by Aghanim's Shard): Unit Target (enemy), cast point 0.3 s. Magical damage; pierces immunity: no; dispellable: no; cooldown 35 s; mana 110; cast range 350.
  - What it does: Shard. Anchor projectile (1000 speed) chained to an enemy hero within 350 for 10s: if it moves more than 350 from the anchor it drops to 100 move speed dragging it. The anchor has 4 pips.
  - Counterplay: Destroy the anchor (4 hero hits); stay within the chain; not dispellable.
- **Ravage** (Ultimate): No Target, cast point 0.3 s. Magical damage; pierces immunity: no; dispellable: strong dispel only; cooldown 150/145/140 s; mana 125/225/325.
  - What it does: 0.3s cast: tentacles burst outward in rings to 1250 at 725 speed: 275-455 magic and a 2-2.4s stun. Hits invisible units.
  - Counterplay: Outer enemies are hit later (wave speed), so a reaction blink or debuff immunity at the edge can avoid it; strong dispel only.
- **Leviathan's Catch** (Innate): Passive. Dispellable: no.
  - What it does: Heroes killed by him or dying with his debuffs drop a fish (30s): eating gives +5 health, +2 attack range, +1 damage block permanently; a free fish every even level. Enemies can destroy fish.
  - Counterplay: Kill the fish.

#### Timbersaw | Strength | Melee | attack range 150 | move speed 280 | [feed](https://www.dota2.com/datafeed/herodata?language=english&hero_id=98)

*Tree-chopping mobility tank (Timbersaw).*

- **Whirling Death**: No Target, instant (no cast point). Pure damage; pierces immunity: no; dispellable: yes (basic dispel); cooldown 7.5/7/6.5/6 s; mana 100.
  - What it does: Instant spin: 60-240 pure damage within 325, +7-28 per tree cut; enemy heroes lose 13% of their primary attribute (5% for universal) for 7-13s.
  - Counterplay: Fight away from trees; basic dispel the attribute loss.
- **Timber Chain**: Point Target, cast point 0.3 s. Pure damage; pierces immunity: no; cooldown 4 s; mana 60/70/80/90; cast range 750/900/1050/1200.
  - What it does: Point skillshot: chain (750-1200 range, 90 wide, 2200-2800 speed) latches the first tree it touches and pulls him there; enemies in 225 of his path take 45-225 pure. Cannot be cast while rooted; 4s CD.
  - Counterplay: Fight in the open with no trees; root him.
- **Reactive Armor**: Passive. Magical damage; dispellable: no; upgraded by Scepter.
  - What it does: Each attack on him gives a stack (hero attacks 4): +0.4-0.7 armor and +0.5-0.8 regen each, up to 10-40 stacks for 10-16s.
  - Aghanim's Scepter / Shard: Scepter: becomes activatable: max stacks plus a barrier of 150 + 100 per second + 75 per second per nearby enemy hero (max 800); after 8s it explodes on heroes within 450 for 200 + remaining barrier.
  - Counterplay: Burst with spells; Break stops new stacks.
- **Flamethrower** (granted by Aghanim's Shard): No Target, instant (no cast point). Magical damage; pierces immunity: no; dispellable: yes (basic dispel); cooldown 20 s; mana 100.
  - What it does: Shard. Instant: a 400-long, 275-wide flame in front of him for 8s; enemies inside burn for 70 DPS and are slowed 40% (lingers 2s); half damage to buildings.
  - Counterplay: Stay out of his front.
- **Chakram** (Ultimate): Point Target, AoE, cast point 0.15 s. Pure damage; pierces immunity: no; dispellable: no; cooldown 8 s; mana 90/120/150; cast range 1200.
  - What it does: Throws a saw blade to a point within 1200 (900 speed): 70-210 pure on pass, then spins in 200 radius doing 50-90 pure per second and slowing 5% per 5% missing health; costs 10-20 mana per second while out; he cannot attack while it is out; returns on recast, out of mana, or 2000 distance. Cuts trees.
  - Counterplay: Leave the blade's circle; burn his mana (the blade returns when he is out of mana). The feed lists no Scepter text for Chakram other than a cast-point value; whether Scepter still adds a second blade could not be confirmed.
- **Exposure Therapy** (Innate): Passive.
  - What it does: Each tree he destroys restores 4 mana.
  - Counterplay: None.

#### Tinker | Intelligence | Ranged | attack range 500 | move speed 305 | [feed](https://www.dota2.com/datafeed/herodata?language=english&hero_id=34)

*Refresher mage that resets his own cooldowns.*

- **Laser**: Unit Target (enemy), cast point 0.4 s. Pure damage; pierces immunity: no; dispellable: yes (basic dispel); cooldown 19/18/17/16 s; mana 95/105/115/125; cast range 600; upgraded by Scepter.
  - What it does: 0.4s cast, 600 range: 75-300 pure and blind (100% physical miss) for 3-4.5s.
  - Aghanim's Scepter / Shard: Scepter: Shrink Ray: also shrinks the target and cuts its current and max health 9% (stacking).
  - Counterplay: Linken's blocks; basic dispel removes the blind.
- **March of the Machines**: Point Target, AoE, cast point 0.53 s. Magical damage; pierces immunity: no; cooldown 35/33/31/29 s; mana 100/120/140/160; cast range 300; upgraded by Scepter.
  - What it does: 0.53s cast at a point within 300: for 6s, robots (24 per second) march from a 900 area in that direction over 1800, each exploding on the first enemy for 13-40 magic in 150.
  - Aghanim's Scepter / Shard: Scepter: robots passing through allied heroes give a 45/s heal for 4s.
  - Counterplay: Leave the march direction; it scales with density of units.
- **Deploy Turrets**: Point Target, AoE, cast point 0.1 s. Magical damage; pierces immunity: no; cooldown 24/22/20/18 s; mana 100/120/140/160; cast range 600; upgraded by Scepter.
  - What it does: Drops 3 turrets at a point (600 range) after 0.5s: 40-160 magic and a 100 push on landing (pushes Tinker 400 if he is hit); turrets (4.5s) fire missiles every 1.5s at the nearest enemy hero (20-80 magic, 650-800 range).
  - Aghanim's Scepter / Shard: Scepter: faster firing, longer range and faster missiles (+20%).
  - Counterplay: Move out of missile range; kill turrets.
- **Warp Flare** (granted by Aghanim's Shard): Unit Target (enemy), cast point 0.2 s. Magical damage; pierces immunity: no; dispellable: yes (basic dispel); cooldown 15 s; mana 80; cast range 700.
  - What it does: Shard. Flare at an enemy (700 range): 150 magic, teleports it away from Tinker (up to 60% of cast range, more the closer it is), 100% slow and -40% cast and attack range for 3s (7.42: no longer roots).
  - Counterplay: Linken's blocks; basic dispel.
- **Rearm** (Ultimate): No Target, Channeled up to 2.75/2/1.25 s, instant (no cast point). Cooldown 5.5/5/4.5 s; mana 100/150/200.
  - What it does: Channel 2.75/2/1.25s: resets the cooldowns of his abilities (5.5-4.5s cooldown).
  - Counterplay: Interrupt the channel (stun, silence, hex) to stop the reset loop.
- **Eureka!** (Innate): Passive.
  - What it does: 1% item cooldown reduction per 3 Intelligence, max 60%.
  - Counterplay: None.

#### Tiny | Strength | Melee | attack range 150 | move speed 275 | [feed](https://www.dota2.com/datafeed/herodata?language=english&hero_id=19)

*Rock giant: stun combo, toss, tree club, growing ultimate.*

- **Avalanche**: Point Target, AoE, instant (no cast point). Magical damage; pierces immunity: no; dispellable: strong dispel only; cooldown 23/20/17/14 s; mana 105/120/135/150; cast range 600.
  - What it does: Point AoE (325-370 radius, 600 range, 1500-speed projectile): 5 hits over 1.5s, 90-360 magic total and repeated 0.3s stuns.
  - Counterplay: Strong dispel only; dodge the landing area if the projectile is slow enough.
- **Toss**: Unit Target (any unit, custom rules), AoE, charges only via a talent, instant (no cast point). Magical damage; cooldown 20/17/14/11 s; mana 125; cast range 800/900/1000/1100.
  - What it does: Grabs the nearest unit within 300 (ally or enemy) and throws it at a target unit (800-1100 range) over 1.1s: 90-360 magic in 275 radius on landing (allies are not hurt). Debuff-immune units cannot be tossed.
  - Counterplay: Stand away from Tiny (grab radius 300) so you are not the thrown unit; debuff-immune units cannot be thrown; the landing hurts everyone near the target unit, so spread out.
- **Tree Grab**: Unit Target (any unit, custom rules), cast point 0.2 s. Physical damage; pierces immunity: yes; dispellable: no; cooldown 16/13/10/7 s; mana 40/35/30/25; cast range 275.
  - What it does: Picks up a tree (275 range): next 5-8 attacks get +10-40 damage (+30-60 vs buildings), 300 attack range and 70-100% splash in 200x400; the tree can be thrown via Tree Throw. Cooldown starts on throw.
  - Counterplay: Fight away from trees.
- **Tree Volley** (granted by Aghanim's Scepter): Point Target, AoE, Channeled up to 2.5 s, cast point 0.2 s. Physical damage; pierces immunity: yes; cooldown 17 s; mana 150; cast range 1200.
  - What it does: Scepter ability. Channel 2.5s: throws random nearby trees (700 radius) at a point (1200 range) every 0.5s, each an attack with Tree Throw bonuses and 400 splash.
  - Counterplay: Interrupt; leave the target area.
- **Insurmountable** (Innate): Passive. Dispellable: no.
  - What it does: Gets status resistance and slow resistance from Strength.
  - Counterplay: Use damage instead of disables late.
- **Grow** (Ultimate): Passive. Physical damage; upgraded by Shard.
  - What it does: Passive ultimate: +5-15 armor, +60-180 damage, +10-30 move speed, more Toss damage, but -35 attack speed.
  - Aghanim's Scepter / Shard: Shard: Toss, Tree Throw and Tree Volley landings also slow 35% move and 45% attack speed for 3s in a larger area.
  - Counterplay: Kite (slow attacks).
- **Tree Throw**: Unit or Point Target, cast point 0.2 s. Physical damage; pierces immunity: no; cast range 1000.
  - What it does: Throws the held tree at a unit or point (1000 range, 900 speed), applying his attack with splash (275).
  - Counterplay: Sidestep the tree if thrown at a point.

#### Treant Protector | Strength | Melee | attack range 150 | move speed 280 | [feed](https://www.dota2.com/datafeed/herodata?language=english&hero_id=83)

*Tree healer with a mass root ultimate.*

- **Nature's Grasp**: Point Target, cast point 0.2 s. Magical damage; pierces immunity: no; cooldown 23/21/19/17 s; mana 90; cast range 1500.
  - What it does: Grows a line of vines toward a point (1500 range) for 9-12s: enemies walking through take 35-80 magic per second and are slowed 25-40%. Vines count as trees.
  - Counterplay: Walk around the vines.
- **Leech Seed**: Unit Target (enemy), Autocast, attack modifier (orb), instant (no cast point). Magical damage; pierces immunity: no; dispellable: yes (basic dispel); cooldown 15/12/9/6 s; mana 20; cast range 150.
  - What it does: Autocast attack modifier: the seed projectile (450 speed) deals 20-80 magic, roots and disarms 0.75-1.5s, and emits 2 healing pulses to up to 5 allies within 650.
  - Counterplay: Basic dispel; kite him (melee).
- **Living Armor**: Unit or Point Target, cast point 0.3 s. Affects debuff-immune allies: yes; dispellable: yes (basic dispel); cooldown 24/21/18/15 s; mana 80.
  - What it does: Global target: an allied hero or building gets 4-13 regen and a damage block (60-120 per instance, shrinking by 20 each block) for 12s; ignores hits under 10.
  - Aghanim's Scepter / Shard: Shard: more block, and Treant passively has his own Living Armor that resets after not taking damage.
  - Counterplay: Many small hits strip it; basic dispel.
- **Eyes In The Forest** (granted by Aghanim's Shard): Unit Target, AoE, Charges 2 (restore 135 s), cast point 0.2 s. Mana 30; cast range 350.
  - What it does: Shard. Enchant a tree within 350 for 360s: 800 unobstructed vision; invisible (seen with true sight); dies to 2 hits or tree loss; Overgrowth also hits enemies near enchanted trees. 2 charges.
  - Counterplay: True sight to find and cut the trees.
- **Nature's Guise** (Innate): Passive. Cooldown 36 s.
  - What it does: +10% speed near trees; after 2.75s without damage he can tree-walk; while tree-walking, activate (36s CD) to turn invisible until he attacks or leaves trees.
  - Counterplay: Damage him to stop tree-walking; true sight.
- **Overgrowth** (Ultimate): No Target, cast point 0.5 s. Magical damage; pierces immunity: yes; dispellable: yes (basic dispel); cooldown 110/100/90 s; mana 200/250/300; upgraded by Scepter.
  - What it does: 0.5s cast: every enemy within 800 is entangled 3-5s: no moving, blinking, turning invisible or attacking, 95 magic per second. Works on debuff-immune units at cast but they break free if they gain debuff immunity later.
  - Aghanim's Scepter / Shard: Scepter: 25s cooldown, and Treant grows huge for 16s: phased fixed 345 speed, +100% Strength, 60% splash in 300.
  - Counterplay: Activate debuff immunity after it lands; basic dispel removes it.

#### Troll Warlord | Agility | Ranged | attack range 500 | move speed 290 | [feed](https://www.dota2.com/datafeed/herodata?language=english&hero_id=95)

*Stance-switching attack-speed carry.*

- **Battle Stance** (Innate): No Target, Toggle, cast point 0.2 s.
  - What it does: Innate toggle (0.2s): switch between ranged (500 range) and melee (BAT 1.4); gains 1 armor per 30 bonus attack speed. Swaps which Whirling Axes and which Berserker's Rage effect he has.
  - Counterplay: Melee form must reach you: kite; ranged form is weaker per hit.
- **Whirling Axes (Ranged)**: Unit or Point Target, cast point 0.2 s. Magical damage; pierces immunity: no; dispellable: yes (basic dispel); cooldown 9 s; mana 50; cast range 950; upgraded by Scepter.
  - What it does: Cone of 5 axes toward a unit or point (950 range, 1500 speed): 60-120 magic and 40% slow for 2.5-4s. Not blocked or reflected by Linken's/Lotus.
  - Aghanim's Scepter / Shard: Scepter: also basic-dispels enemies hit; cheaper and shorter cooldown.
  - Counterplay: Dodge between axes at long range; basic dispel.
- **Whirling Axes (Melee)**: No Target, instant (no cast point). Magical damage; pierces immunity: no; dispellable: yes (basic dispel); cooldown 9 s; mana 50; upgraded by Scepter.
  - What it does: Instant: two axes circle out to 450 around him for 3s: 75-210 magic and 60% blind (miss) for 5s.
  - Aghanim's Scepter / Shard: Scepter: basic-dispels Troll himself; cheaper and shorter cooldown.
  - Counterplay: Keep beyond 450; basic dispel.
- **Fervor**: Passive. Dispellable: no; upgraded by Shard.
  - What it does: Each consecutive hit on the same target gives +15-30 attack speed (max 10 stacks); switching targets resets.
  - Aghanim's Scepter / Shard: Shard: 16% + 3% per stack chance for an extra ranged attack on another unit in range +175.
  - Counterplay: Make him switch targets (illusions, body-blocking allies).
- **Berserker's Rage**: Passive. Physical damage; pierces immunity: yes.
  - What it does: Melee form: +15-45 speed and 20% chance to ensnare (root, no mobility spells) 0.8-2s. Ranged form: 20% chance to maim (bonus damage, 8-32% move and attack slow, 0.8-2s). Pierces debuff immunity.
  - Counterplay: Kite when he is melee; Break.
- **Battle Trance** (Ultimate): instant (no cast point). Dispellable: no; cooldown 90/80/70 s; mana 150; cast range 525.
  - What it does: The feed gives no static targeting flag (behaviour is set in code); listed range 525 and notes about vision over 'the target'. Effect: 6.5s trance: Troll auto-attacks the closest enemy within 900 (heroes first), cannot die from damage, is unslowable while attacking, gets 40-80% lifesteal, +140-200 attack speed, +35 move speed, 15-25% status resistance and a basic dispel. He can still use items and spells.
  - Counterplay: Run away (he must chase), disarm/ethereal/kiting, or Culling Blade (the feed says it still kills him); damage keeps lowering his health, so he can be finished right after the 6.5s end. Survive the 6.5s.

#### Tusk | Strength | Melee | attack range 150 | move speed 310 | [feed](https://www.dota2.com/datafeed/herodata?language=english&hero_id=100)

*Walrus gank initiator.*

- **Ice Shards**: Point Target, cast point 0.1 s. Magical damage; pierces immunity: no; cooldown 23/20/17/14 s; mana 100; cast range 1400.
  - What it does: Fires a ball (1200 speed, 200 wide) toward a point within 1400: 75-300 magic on contact; at the destination 7 ice shards form a curved impassable wall for 4-7s.
  - Counterplay: Shards trap movement but not blinks; the ball is visible; Directional cast means sidestep the ball.
- **Snowball**: Unit Target (enemy), cast point 0.1 s. Magical damage; pierces immunity: no; dispellable: no; cooldown 21/19/17/15 s; mana 75; cast range 1150.
  - What it does: Targets an enemy within 1150: Tusk curls into a snowball for up to 3s (allies within 325 can be added); it rolls to the target (575-650 speed, follows), stunning and damaging (80-260 magic + per ally) enemies in its path; each ally adds damage and 0.2s stun. Can launch early.
  - Counterplay: The ball is slow-ish and homing: blink or disjoint away (target can move); cannot be cast while rooted; not dispellable.
- **Tag Team**: No Target, instant (no cast point). Physical damage; pierces immunity: no; dispellable: no; cooldown 24/21/18/15 s; mana 70.
  - What it does: Instant 6s aura (350): enemies attacked inside take +25-100 physical per hit and are slowed 75% for 0.5s.
  - Counterplay: Leave his 350 radius.
- **Drinking Buddies** (granted by Aghanim's Shard): Unit Target (ally), cast point 0.1 s. Dispellable: yes (basic dispel); cooldown 14 s; mana 80; cast range 1000.
  - What it does: Shard. Tags an ally within 1000 and pulls them together (if more than 250 apart): both get +30% speed and +7 armor for 7s.
  - Counterplay: Basic dispel.
- **Walrus Kick** (granted by Aghanim's Scepter): Vector Target, cast point 0.2 s. Magical damage; pierces immunity: yes; dispellable: yes (basic dispel); cooldown 12 s; mana 100; cast range 250.
  - What it does: Scepter ability. Vector: kicks the nearest enemy (250 range) in the drawn direction 1200 over 1s air time: 550 magic to heroes near landing, 40% slow 2s. Pierces debuff immunity. Half cooldown if it kicks a creep.
  - Counterplay: Do not stand next to Tusk; the kick direction is chosen by him.
- **Walrus PUNCH!** (Ultimate): Unit Target (enemy), Autocast, attack modifier (orb), instant (no cast point). Pierces immunity: yes; dispellable: yes (basic dispel); cooldown 16/13/10 s; mana 75; cast range 150.
  - What it does: Autocast attack modifier: true-strike critical hit (200-300%) +60-120 damage that launches the victim 1s into the air (a disable) and knocks it 1000 forward (push_length). Pierces debuff immunity.
  - Counterplay: Avoid melee range; evasion does not work (true strike).
- **Bitter Chill** (Innate): Passive.
  - What it does: Enemy heroes within 350 have -12 attack speed. Fully disabled by Break (7.42).
  - Counterplay: Break.

#### Underlord | Strength | Melee | attack range 200 | move speed 290 | [feed](https://www.dota2.com/datafeed/herodata?language=english&hero_id=108)

*Area-control tank with team teleport portals.*

- **Firestorm**: Point Target, AoE, cast point 0.5 s. Magical damage; pierces immunity: no; dispellable: yes (basic dispel); cooldown 16/15/14/13 s; mana 110/125/140/155; cast range 675; upgraded by Shard.
  - What it does: Point AoE (425 radius, 675 range, 0.5s cast): 6 waves over 6s, each 30-105 magic plus a burn of 1.5-3% max health per second.
  - Aghanim's Scepter / Shard: Shard: can be cast on an allied hero, following them with more and faster waves.
  - Counterplay: Leave the circle early; basic dispel.
- **Pit of Malice**: Point Target, AoE, cast point 0.25 s. Magical damage; pierces immunity: no; dispellable: yes (basic dispel); cooldown 30/25/20/15 s; mana 110/120/130/140; cast range 675.
  - What it does: Point AoE (400 radius) pit for 12s: enemies entering are rooted 1.5-1.8s and damaged; each unit only every 3.6s.
  - Counterplay: Avoid the circle; basic dispel the root.
- **Atrophy Aura**: Passive, Aura. Physical damage; pierces immunity: no (allies: yes); dispellable: no.
  - What it does: Aura 900: enemies lose 8-32% base damage; deaths inside give him +damage for 30-60s (heroes +30-45).
  - Counterplay: Break disables it; stay outside 900.
- **Invading Force** (Innate): Passive.
  - What it does: After any allied hero teleports, they get a physical barrier (8.5% + 0.25% per Underlord level of their max health) and +9.5% speed for 6s; double through Fiend's Gate.
  - Counterplay: None.
- **Fiend's Gate** (Ultimate): Point Target, instant (no cast point). Dispellable: yes (basic dispel); cooldown 115/105/95 s; mana 175; upgraded by Scepter.
  - What it does: Opens two linked portals (one by him, one at a point at least 1500 away, or fountain with double-click) for 20s; any allied hero channels 3.5-3s to travel through. Portal kills give bounty.
  - Aghanim's Scepter / Shard: Scepter: a Pit of Malice spawns at the far portal, plus lower cooldown (values also list portal shots).
  - Counterplay: Kill or wait at the exit portal; interrupt channels.

#### Undying | Strength | Melee | attack range 150 | move speed 295 | [feed](https://www.dota2.com/datafeed/herodata?language=english&hero_id=85)

*Zombie support tank.*

- **Decay**: Point Target, AoE, cast point 0.3 s. Magical damage; pierces immunity: no; dispellable: no; cooldown 13/10/7/4 s; mana 110; cast range 650; upgraded by Scepter.
  - What it does: Point AoE (325, 650 range): steals 4 Strength from each enemy hero for 21-30s (stacking) and deals 20-140 magic (2x to creeps). Strength steal applies first.
  - Aghanim's Scepter / Shard: Scepter: more Strength stolen.
  - Counterplay: Not dispellable; spread out.
- **Soul Rip**: Unit Target (any unit, custom rules), cast point 0.3 s. Magical damage; pierces immunity: no; cooldown 15/12/9/6 s; mana 80/90/100/110; cast range 750.
  - What it does: Unit target ally or enemy (750): for each unit within 1300 (up to 10, both teams) deals 14-50 damage to the target or heals the ally by that much; heals Tombstone by 1-4 pips.
  - Counterplay: Fewer units around means a weaker rip; invisible/debuff-immune units are not counted.
- **Tombstone**: Point Target, cast point 0.6 s. Physical damage; pierces immunity: no; cooldown 80 s; mana 125/150/175/200; cast range 500.
  - What it does: Places a tombstone (5-8 hero hits, 30s): every 4-2.8s a zombie spawns next to each enemy within 1200 and attacks it (slowing, and enraging below 40% target health).
  - Aghanim's Scepter / Shard: (7.42: no longer has a Shard upgrade; the feed still shows the old bunker text; treat as stale.)
  - Counterplay: Kill the tombstone; leave the 1200 area; zombies die if their target leaves vision.
- **Zombie Bite** (granted by Aghanim's Shard): Unit Target (enemy), attack modifier (orb), instant (no cast point). Physical damage; pierces immunity: no; dispellable: yes (basic dispel); cooldown 18 s; mana 70; cast range 400.
  - What it does: Shard (new in 7.42). Lunges at an enemy (400 range): attack +250 physical, cannot miss, heals Undying for the damage; a bitten hero becomes a melee zombie for 3s (silenced, 25% slow, -40% damage); a bitten non-ancient creep dies and returns as his zombie for 20s.
  - Counterplay: Linken's blocks (presumably); strong dispel only per patch notes (the feed flag says basic dispel; conflict).
- **Ceaseless Dirge** (Innate): Passive. Dispellable: no; cooldown 480 s.
  - What it does: When he dies he respawns in the fountain after 2s (480s cooldown, starts on cooldown, cannot be refreshed or reduced).
  - Counterplay: Pressure him again; it is on a long timer.
- **Flesh Golem** (Ultimate): No Target, instant (no cast point). Magical damage; pierces immunity: no; dispellable: no; cooldown 140 s; mana 100/125/150.
  - What it does: Instant: becomes a golem for 40s: +40-60% Strength, +25% speed; his attacks slow 30-40% and amplify damage taken by 20-30% for 3s, and spawn tombstone zombies.
  - Counterplay: Kite; not dispellable.

#### Ursa | Agility | Melee | attack range 150 | move speed 310 | [feed](https://www.dota2.com/datafeed/herodata?language=english&hero_id=70)

*Bear melee carry with stacking swipes.*

- **Earthshock**: No Target, charges only via a talent, instant (no cast point). Magical damage; pierces immunity: no; dispellable: yes (basic dispel); cooldown 15/13/11/9 s; mana 95; upgraded by Shard.
  - What it does: Instant: hops 250 forward and slams: 80-260 magic and 16-40% slow in 385 for 3.5s. Charge-style restore listed.
  - Aghanim's Scepter / Shard: Shard: adds 3 Fury Swipes stacks to everyone hit.
  - Counterplay: Basic dispel.
- **Overpower**: No Target, cast point 0.3 s. Dispellable: yes (basic dispel); cooldown 12/11/10/9 s; mana 45/50/55/60.
  - What it does: 0.3s cast: next 3-6 attacks within 20s get +400% attack speed; +25% slow resistance. Misses consume charges.
  - Counterplay: Evasion, blind, disarm during the buff; basic dispel.
- **Fury Swipes**: Passive. Physical damage; pierces immunity: yes; dispellable: no.
  - What it does: Each hit on the same target adds +12-36 damage per stack; stacks reset after 8-20s without hitting that target. Pierces debuff immunity.
  - Counterplay: Break; ethereal/disarm; swap targets.
- **Maul** (Innate): Passive.
  - What it does: Bonus attack damage equal to 1.75% of his current health.
  - Counterplay: Damage him first.
- **Enrage** (Ultimate): No Target, instant (no cast point). Pierces immunity: yes; dispellable: no; cooldown 60/45/30 s; upgraded by Scepter.
  - What it does: Instant: strong dispel; 80% damage reduction and 50% status resistance for 4-5s.
  - Aghanim's Scepter / Shard: Scepter: lower cooldown and usable while disabled.
  - Counterplay: Wait it out (kite) then disable.

#### Vengeful Spirit | Agility | Ranged | attack range 400 | move speed 300 | [feed](https://www.dota2.com/datafeed/herodata?language=english&hero_id=20)

*Support with a stun, an armor-shredding wave and a position swap.*

- **Magic Missile**: Unit Target (enemy), cast point 0.3 s. Magical damage; pierces immunity: no; dispellable: strong dispel only; cooldown 14/13/12/11 s; mana 90/95/100/105; cast range 650; upgraded by Shard.
  - What it does: Missile projectile (1350 speed, 650 range): 100-340 magic and 1.2-1.8s stun.
  - Aghanim's Scepter / Shard: Shard: bounces once to another enemy (heroes first) within 75% of cast range.
  - Counterplay: Disjoint or Linken's; strong dispel only.
- **Wave of Terror**: Point Target, cast point 0.3 s. Magical damage; pierces immunity: no; dispellable: yes (basic dispel); cooldown 16/14/12/10 s; mana 50; cast range 1400.
  - What it does: Wave toward a point (1400 range, 325 wide, 2000 speed): 60-120 magic, -3 to -6 armor and -10 to -25% attack damage for 8s; gives vision along the path.
  - Counterplay: Sidestep the line; basic dispel.
- **Vengeance Aura**: Passive, Aura. Affects debuff-immune allies: yes; upgraded by Scepter.
  - What it does: Aura 1200: allied heroes get +10-25% base damage; she gets 25% extra on top. Break disables it.
  - Aghanim's Scepter / Shard: Scepter: on death she leaves a strong illusion (full damage, can cast her spells) that, if alive when she respawns, she replaces; it is not killed outright by illusion-killing spells.
  - Counterplay: Break; kill her.
- **Retribution** (Innate): Passive. Dispellable: no.
  - What it does: Counts as both melee and ranged for item bonuses; when killed by an enemy hero, she deals +20% damage to that killer until it dies.
  - Counterplay: None.
- **Nether Swap** (Ultimate): Unit Target (any unit, custom rules), cast point 0.4 s. Magical damage; pierces immunity: yes; dispellable: yes (basic dispel); cooldown 46/38/30 s; mana 100/150/200; cast range 850/975/1100.
  - What it does: Swaps positions with any hero, ally or enemy (850-1100 range, 0.4s cast); interrupts the target's channel; enemies take 150-450 magic and she and swapped allies get a barrier equal to the damage. Works on debuff-immune units; destroys nearby trees.
  - Counterplay: Linken's blocks; the 0.4s cast is the tell; keep distance beyond cast range.

#### Venomancer | Universal | Ranged | attack range 450 | move speed 280 | [feed](https://www.dota2.com/datafeed/herodata?language=english&hero_id=40)

*Poison area denial with spreading ultimate.*

- **Venomous Gale**: Point Target, AoE, instant (no cast point). Magical damage; pierces immunity: no; dispellable: yes (basic dispel); cooldown 21/20/19/18 s; mana 95/105/115/125; cast range 800; upgraded by Shard.
  - What it does: Instant line projectile toward a point (800 range, 125 radius, 1200 speed): 25-100 magic then 10-100 every 3s for 15s and a 35-50% slow that decays.
  - Aghanim's Scepter / Shard: Shard: +25% range and speed; each enemy hero hit spawns 2 Plague Wards around it.
  - Counterplay: Sidestep; basic dispel.
- **Snakebite**: Unit Target (enemy), cast point 0.2 s. Magical damage; dispellable: yes (basic dispel); cooldown 20/18/16/14 s; mana 70/80/90/100; cast range 600/650/700/750.
  - What it does: A serpent bites an enemy (600-750): 40-130 magic plus 10-40 per second for 6s; every attack the victim makes while bitten repeats the initial damage.
  - Counterplay: Stop attacking while bitten; basic dispel (unless he has the level 20 talent that makes it undispellable).
- **Plague Ward**: Point Target, instant (no cast point). Physical damage; pierces immunity: yes; cooldown 5 s; mana 24/26/28/30; cast range 850.
  - What it does: Instant ward at a point (850 range, 5s CD): attacks enemy units and buildings for 40s, immune to magic, its hits apply a half-strength Poison Sting; attacks the nearest hero when spawned.
  - Counterplay: Kill wards with attacks (they give bounty).
- **Poison Sting** (Innate): Passive. Magical damage; pierces immunity: no; dispellable: yes (basic dispel).
  - What it does: His attacks poison for 4.5s: 9 magic per second and 8% slow. Ward stings stack separately.
  - Aghanim's Scepter / Shard: Shard: each sting adds extra damage per Venomancer debuff on the target.
  - Counterplay: Basic dispel.
- **Noxious Plague** (Ultimate): Unit Target (enemy), cast point 0.15 s. Magical damage; pierces immunity: no; cooldown 100/90/80 s; mana 200/250/300; cast range 900; upgraded by Scepter.
  - What it does: Projectile (1200 speed, 900 range): 150-250 magic, then 2-4% max health per second and 50% slow for 4s; when it ends (for any reason) it and all his debuffs spread to 2 nearby targets within 700, chaining onward. The damage and slow cannot be dispelled (7.42); the spread part can.
  - Aghanim's Scepter / Shard: Scepter: lower cooldown, -20% magic resistance on infected units, full impact damage on later spreads from heroes.
  - Counterplay: Spread out so it cannot jump; Linken's blocks the first cast; disjoint the projectile.

#### Viper | Agility | Ranged | attack range 575 | move speed 275 | [feed](https://www.dota2.com/datafeed/herodata?language=english&hero_id=47)

*Poison ranged carry.*

- **Poison Attack**: Unit Target (enemy), Autocast, attack modifier (orb), instant (no cast point). Magical damage; pierces immunity: no; dispellable: yes (basic dispel); mana 20; cast range 600; upgraded by Shard.
  - What it does: Autocast attack modifier (20 mana): stacking poison (up to 6) of 4-16 magic per second, 3-12% slow and 4-10% magic resistance reduction per stack for 4s.
  - Aghanim's Scepter / Shard: Shard: +2 max stacks, -1 armor per stack, and works on buildings (40%).
  - Counterplay: Basic dispel; attacks are projectiles.
- **Nethertoxin**: Point Target, AoE, cast point 0.2 s. Magical damage; pierces immunity: no; cooldown 14 s; mana 70; cast range 900.
  - What it does: Point AoE (400 radius, 900 range) for 6.5-8s: damage per second rises from 15-45 to 35-125 the longer a unit stays (max after 4s), and attack speed is slowed 30-60. Does not stack.
  - Counterplay: Leave the pool quickly.
- **Corrosive Skin**: Passive. Magical damage; pierces immunity: no; dispellable: yes (basic dispel); upgraded by Scepter.
  - What it does: Enemies within 1200 that damage Viper take 10-25 magic per second and -9 to -36 attack speed for 4s; Viper has +10-25% magic resistance. Counts as reflected damage.
  - Aghanim's Scepter / Shard: Scepter: 4x attack slow within 500, and up to +50% resistance and damage after 4s inside Nethertoxin.
  - Counterplay: Break; magic burst from outside.
- **Nosedive** (granted by Aghanim's Scepter): Point Target, AoE, cast point 0.1 s. Magical damage; pierces immunity: no; dispellable: yes (basic dispel); cooldown 25 s; mana 75; cast range 700.
  - What it does: Scepter ability. Dives to a point within 700 (cannot be cast while rooted), drops a Nethertoxin and applies Corrosive Skin to enemies within 500 for 4s.
  - Counterplay: Leave the pool.
- **Predator** (Innate): Passive. Physical damage; pierces immunity: no; dispellable: yes (basic dispel).
  - What it does: Attacks deal an extra 0.24 physical damage per percent of the target hero's missing health.
  - Counterplay: Keep health high.
- **Viper Strike** (Ultimate): Unit Target (enemy), value list shows 2 charges (restore 30 s; not in tooltip, unconfirmed), cast point 0.2 s. Magical damage; pierces immunity: yes; dispellable: no; cooldown 50/40/30 s; mana 100/150/200; cast range 750.
  - What it does: Projectile (1500 speed, 750 range): 70-150 magic per second over 6s, move and attack slow that decays, and Break (passives off). Pierces debuff immunity; not dispellable. 2 charges (30s) per values.
  - Counterplay: Disjoint the projectile or Linken's; wait it out.

#### Visage | Universal | Ranged | attack range 600 | move speed 285 | [feed](https://www.dota2.com/datafeed/herodata?language=english&hero_id=92)

*Gargoyle summoner with damage-layer cloak.*

- **Grave Chill**: Unit Target (enemy), cast point 0.2 s. Pierces immunity: no; dispellable: yes (basic dispel); cooldown 17/15/13/11 s; mana 75; cast range 625.
  - What it does: Drains 12-30% move speed and 40-70 attack speed from an enemy for 5s, giving it to Visage and familiars within 900.
  - Counterplay: Basic dispel either buff separately.
- **Soul Assumption**: Unit Target (enemy), cast point 0.2 s. Magical damage; pierces immunity: no; cooldown 4 s; mana 110; cast range 1000.
  - What it does: Gains a charge (up to 3-6, 6s) whenever any hero within 1800 takes 100+ damage; release as a projectile (1000 speed): 20 + 70 per charge magic.
  - Counterplay: Disjoint or Linken's; fight short.
- **Gravekeeper's Cloak**: Passive. Upgraded by Shard.
  - What it does: 4 layers, each 8-20% damage reduction (max 32-80%); a player damage instance above 40 removes a layer, which recovers after 7-4s; familiars within 900 share it.
  - Aghanim's Scepter / Shard: Shard: active Stone Form for Visage: stun 0.8-1.2s and 60-140 damage within 375, invulnerable 6s, restore up to 25% health.
  - Counterplay: Many small hits strip layers fast; Break stops recovery.
- **Silent as the Grave** (Innate): No Target, instant (no cast point). Pierces immunity: no; dispellable: no; cooldown 45.75 s; mana 50; upgraded by Scepter.
  - What it does: Instant innate: flying and +12% speed for 20s; the first attack or cast ends it and gives Visage and familiars +10% damage for 2s.
  - Aghanim's Scepter / Shard: Scepter: more speed, damage and duration; Visage and familiars are invisible until flying ends.
  - Counterplay: Flying units ignore terrain; track with vision.
- **Summon Familiars** (Ultimate): No Target, instant (no cast point). Physical damage; cooldown 120/110/100 s; mana 150.
  - What it does: Summons 2 controllable flying familiars (450-750 HP, 430 speed, 100 bounty each) with Stone Form: they drop and turn to stone, stunning enemies below, invulnerable and regenerating. Alt-cast recalls them after 4s. Recasting replaces them.
  - Counterplay: Kill familiars outside stone form (high bounty); dodge the drop.

#### Void Spirit | Universal | Melee | attack range 200 | move speed 290 | [feed](https://www.dota2.com/datafeed/herodata?language=english&hero_id=126)

*Void elemental with vector trap, portals and a 2-charge dash.*

- **Aether Remnant**: Vector Target, instant (no cast point). Magical damage; pierces immunity: no; dispellable: yes (basic dispel); cooldown 17/15/13/11 s; mana 75/80/85/90; cast range 850; upgraded by Shard.
  - What it does: Vector target: place a remnant at a point within 850 and drag the facing direction; after 0.4s it watches a 450-long, 130-wide line for 17s; the first enemy to cross is pulled toward it for 1-1.6s and takes 90-240 magic.
  - Aghanim's Scepter / Shard: Shard: a second watch path rotates around it; gives true sight; ignores creeps but burns them 50%.
  - Counterplay: Do not cross the visible watch line; basic dispel.
- **Dissimilate**: No Target, cast point 0.3 s. Magical damage; pierces immunity: no; cooldown 20/17/14/11 s; mana 110.
  - What it does: 0.3s cast: Void vanishes for 1.1s while a ring of 6 portals (plus centre) appears around him at about 520; he reappears at the portal he chooses (move command), dealing 105-345 magic in 275 radius. Cannot cast while rooted.
  - Counterplay: Watch which portal he moves to; stand outside portal areas.
- **Resonant Pulse**: No Target, Charges with Scepter: 2 (restore 18 s), instant (no cast point). Magical damage; pierces immunity: no; dispellable: yes (basic dispel); cooldown 18 s; mana 115/120/125/130; upgraded by Scepter.
  - What it does: Instant pulse to 500 (1200 speed): 60-210 magic; Void gets a physical barrier 40-100 + 50-110 per hero hit for 10s.
  - Aghanim's Scepter / Shard: Scepter: 2 charges and a 1.75s silence.
  - Counterplay: Basic dispel the barrier; stay out of 500.
- **Intrinsic Edge** (Innate): Passive.
  - What it does: Each attribute point gives 15% more attack damage, and he gets 30% more of the secondary bonuses (regen from Strength, attack speed from Agility, mana regen from Intelligence). Fully disabled by Break.
  - Counterplay: Break.
- **Astral Step** (Ultimate): Point Target, Charges 2 (restore 25/20/15 s), cast point 0.2 s. Magical damage; pierces immunity: yes; mana 90.
  - What it does: Dash to a point 200-1000 away (2 charges, 25-15s): attacks every enemy along the 170-wide path (+25% item potency), marks them with an 40-80% slow; after 1.25s the mark pops for 130-330 magic. Pierces debuff immunity.
  - Counterplay: Root him; the 1.25s delay lets you heal or prepare; spread out of his line.

#### Warlock | Intelligence | Ranged | attack range 600 | move speed 300 | [feed](https://www.dota2.com/datafeed/herodata?language=english&hero_id=37)

*Damage-linking caster with a golem ultimate.*

- **Fatal Bonds**: Unit Target (enemy), cast point 0.2 s. Pierces immunity: no; dispellable: yes (basic dispel); cooldown 42/34/26/18 s; mana 120/130/140/150; cast range 1000.
  - What it does: Links up to 6 visible enemies within 700 of the target for 18s: 15-24% of damage any of them takes is copied to the others (same type).
  - Counterplay: Spread out before cast; basic dispel removes your bond.
- **Shadow Word**: Unit Target (ally or enemy), cast point 0.2 s. Magical damage; pierces immunity: no; dispellable: yes (basic dispel); cooldown 15/14/13/12 s; mana 110/120/130/140; cast range 650/700/750/800.
  - What it does: On an ally: heals it and allies within 250 (15-45 per tick over 10s); on an enemy: damages it and its allies within 250.
  - Aghanim's Scepter / Shard: Scepter: hits extra units nearby at reduced strength and bigger radius.
  - Counterplay: Basic dispel; spread.
- **Upheaval**: Point Target, AoE, Channeled up to 10/12/14/16 s, cast point 0.4 s. Magical damage; pierces immunity: no; dispellable: yes (basic dispel); cooldown 45/40/35/30 s; mana 100; cast range 800; upgraded by Shard.
  - What it does: Channel up to 10-16s at a point (575-650 radius): slow builds 11-20% per second up to 55-100%, damage rises to 35-110 per second. Lingers 1s.
  - Aghanim's Scepter / Shard: Shard: spawns a minor imp every 2s while channeling.
  - Counterplay: Leave the circle early; interrupt Warlock.
- **Eldritch Summoning** (Innate): Passive. Magical damage; pierces immunity: no; dispellable: yes (basic dispel); upgraded by Shard.
  - What it does: Enemies dying while under any of his spells spawn a 15s minor imp that seeks nearby heroes (bonded first) and explodes (20 magic in 400).
  - Aghanim's Scepter / Shard: Shard: tougher imps (80 health) with 45 damage explosions.
  - Counterplay: Kill imps.
- **Chaotic Offering** (Ultimate): Point Target, AoE, cast point 0.5 s. Pierces immunity: yes; dispellable: strong dispel only; cooldown 165 s; mana 200/400/600; cast range 900; upgraded by Scepter.
  - What it does: 0.5s cast, then 0.5s later a golem lands at a point (900 range): 0.8s stun in 600 radius; golem lives 60s (1500-3000 HP, burning aura, flaming fists, spell resistance). Pierces debuff immunity.
  - Aghanim's Scepter / Shard: Scepter: two golems.
  - Counterplay: Spread before it lands; kite the golem; strong dispel only for the stun.

#### Weaver | Agility | Ranged | attack range 425 | move speed 275 | [feed](https://www.dota2.com/datafeed/herodata?language=english&hero_id=63)

*Time-rewinding skirmisher.*

- **The Swarm**: Point Target, cast point 0.3 s. Physical damage; pierces immunity: no; dispellable: no; cooldown 44/36/28/20 s; mana 110/105/100/95; cast range 3000.
  - What it does: Sends 12 beetles in a wide line to 3000: each latches onto the first enemy it touches for 16s, attacking (18-33) and reducing armor by 1 per hit; beetles have 3-5 pips and give vision.
  - Counterplay: Kill beetles with hero attacks (creeps and illusions do 25%).
- **Shukuchi**: No Target, instant (no cast point). Magical damage; pierces immunity: no; dispellable: no; cooldown 15/12/9/6 s; mana 65; upgraded by Shard.
  - What it does: Instant: invisible for 4s, moves through units at very high speed (+200-290, at least 550), and deals 100-190 magic to each enemy he passes within 175 (once each). Works while channeling.
  - Aghanim's Scepter / Shard: Shard: marks damaged enemies; 0.2s after it ends, marked enemies within 1200 take a Geminate attack.
  - Counterplay: True sight; area damage.
- **Geminate Attack**: Unit Target (enemy), Autocast, attack modifier (orb), instant (no cast point). Physical damage; pierces immunity: yes; cooldown 9/7/5/3 s; cast range 425.
  - What it does: Autocast attack modifier: each attack (9-3s cooldown) fires an extra attack 0.25s later with +20-65 damage and +15% item potency, any range. Pierces debuff immunity.
  - Aghanim's Scepter / Shard: Shard: also hits units within 1200 that carry Swarm beetles.
  - Counterplay: Evasion; ghost.
- **Time Lapse (Ally)** (granted by Aghanim's Scepter): Unit Target (ally), instant (no cast point). Cast range 500.
  - What it does: Scepter ability (7.42 moved it out of Time Lapse): rewinds an allied hero within 500 to where it was 5s ago, with its health and mana from then, plus a strong dispel and projectile disjoint. Shares cooldown with Time Lapse.
  - Counterplay: Burst faster than 5s of damage; kill before he casts.
- **Time Lapse** (Ultimate): No Target, cast point 0.3 s. Cooldown 70/55/40 s; mana 150/75/0; upgraded by Scepter.
  - What it does: 0.3s cast: Weaver returns to his position, health and mana of 5s earlier; strong dispel; disjoints projectiles. No cost at level 3.
  - Aghanim's Scepter / Shard: Scepter: lower cooldown (and the ally version above).
  - Counterplay: Burst him within 5s or chain-disable so he cannot cast; follow to his old position.
- **Threads of Fate** (Innate): Passive.
  - What it does: If Weaver damages an enemy hero and stays within 700 for 1.25s, a thread forms: 100% slow for 0.4s, re-applied every 6s while the thread holds (breaks at 890); each thread gives +10 damage.
  - Counterplay: Get more than 890 away to snap it.

#### Windranger | Universal | Ranged | attack range 600 | move speed 285 | [feed](https://www.dota2.com/datafeed/herodata?language=english&hero_id=21)

*Archer with tree-shackle, charged arrow and evasion.*

- **Shackleshot**: Unit Target (enemy), cast point 0.15 s. Pierces immunity: no; dispellable: strong dispel only; cooldown 16/14/12/10 s; mana 70/80/90/100; cast range 800.
  - What it does: Arrow (1650 speed, 800 range): if there is an enemy unit or tree up to 575 behind the target in a 23-degree cone, both are shackled 1.75-3.25s; otherwise 0.6s. Can be disjointed.
  - Counterplay: Avoid standing in line with trees or allies behind you; disjoint; strong dispel only.
- **Powershot**: Point Target, Channeled up to 1 s, instant (no cast point). Magical damage; pierces immunity: no; cooldown 12/11/10/9 s; mana 90/100/110/120; cast range 3000.
  - What it does: Channel up to 1s (point), then an arrow flies 3000 at 3000 speed, 125 wide: 170-470 magic (more the longer charged) and 22-40% slow 3s; -15% per enemy hit; cuts trees.
  - Counterplay: Line skillshot: sidestep the aim; let creeps soak it; interrupt the charge.
- **Windrun**: No Target, cast point 0.3 s. Pierces immunity: no; dispellable: yes (basic dispel); cooldown 14/13/12/11 s; mana 50.
  - What it does: 0.3s cast: +50% speed and evasion of all physical attacks for 3-6s.
  - Counterplay: Magic damage; basic dispel; true strike.
- **Gale Force** (granted by Aghanim's Shard): Vector Target, cast point 0.2 s. Pierces immunity: no; cooldown 25 s; mana 125; cast range 1200.
  - What it does: Shard. Vector target: a 900-radius wind for 3s pushes all enemies inside in the drawn direction (240 strength).
  - Counterplay: Move against it (it is a push, not a disable).
- **Focus Fire** (Ultimate): Unit Target (enemy), instant (no cast point). Pierces immunity: yes; dispellable: no; cooldown 50/40/30 s; mana 75/100/125; cast range 600.
  - What it does: Locks attacks on one enemy unit or building for 20s with +350-500 attack speed but -18% damage and 75% item potency; she can move while attacking (attack on the move); Hold pauses it. Pierces debuff immunity.
  - Counterplay: Evasion, ghost/ethereal, disarm, blind; break line by distance.
- **Tailwind** (Innate): Passive. Dispellable: yes (basic dispel); upgraded by Scepter.
  - What it does: Each spell cast gives a stacking +35% speed burst for 2.5s (fades after half); raises her max speed cap to 600.
  - Aghanim's Scepter / Shard: Scepter: attacks also grant it; lasts longer; undispellable.
  - Counterplay: Break stops new stacks.

#### Winter Wyvern | Intelligence | Ranged | attack range 450 | move speed 285 | [feed](https://www.dota2.com/datafeed/herodata?language=english&hero_id=112)

*Ice dragon: heal-freeze on allies, mind-control ultimate.*

- **Arctic Burn**: No Target, instant (no cast point). Magical damage; pierces immunity: no; dispellable: no; cooldown 29/26/23/20 s; mana 100/105/110/115; upgraded by Scepter.
  - What it does: Instant 7-10s flight (unobstructed movement, cuts trees under her): up to 5 attacks get +250-325 range, faster projectiles and 0.1 attack point, each applying 15-30% slow and 4-10% of current health per second for 3s.
  - Aghanim's Scepter / Shard: Scepter: becomes a toggle draining 20 mana per second; +25% speed.
  - Counterplay: Basic dispel removes the burn (stated in the notes even though the flag says not dispellable).
- **Splinter Blast**: Unit Target (ally or enemy), AoE, cast point 0.3 s. Magical damage; pierces immunity: no; dispellable: yes (basic dispel); cooldown 6 s; mana 105/115/125/135; cast range 1150.
  - What it does: Ice ball (1200 speed, 1150 range) at a unit (ally or enemy, not herself): the target is unaffected, splinters hit enemies within 500 of it for 80-320 magic and 27-36% slow for 4s. Main projectile cannot be disjointed.
  - Counterplay: Do not stand near your own units/allies she targets.
- **Cold Embrace**: Unit Target (ally), cast point 0.3 s. Affects debuff-immune allies: yes; dispellable: no; cooldown 24/21/18/15 s; mana 50/60/70/80; cast range 850/900/950/1000; upgraded by Shard.
  - What it does: Freezes an ally (850-1000 range) for 4s: cannot act or move, immune to physical damage, heals 32-56 + 1.5-4.5% max health per second.
  - Aghanim's Scepter / Shard: Shard: -4s cooldown; the ally emerges with +60% damage for 6s.
  - Counterplay: Switch to magic damage; it cannot be dispelled.
- **Eldwurm's Edda** (Innate): Passive.
  - What it does: Gives her an item (available after 420s per tooltip) that, when consumed, raises one basic ability's current and max level by 1 and her base Intelligence by 25%.
  - Counterplay: None.
- **Winter's Curse** (Ultimate): Unit Target (enemy), AoE, cast point 0.3 s. Pierces immunity: yes; cooldown 100/90/80 s; mana 150/200/250; cast range 800.
  - What it does: Targets an enemy within 800: basic-dispels and freezes it (2s, extendable to 6 by heroes entering); every other enemy within 525 is cursed to attack the frozen ally with +50-80 attack speed. Frozen and cursed units are immune to damage from Wyvern's enemies except Wyvern herself. Pierces debuff immunity only on the main target.
  - Counterplay: Debuff immunity protects the surrounding allies; spread out; Linken's on the target.

#### Witch Doctor | Intelligence | Ranged | attack range 550 | move speed 300 | [feed](https://www.dota2.com/datafeed/herodata?language=english&hero_id=30)

*Voodoo support with a channelled ward ultimate.*

- **Paralyzing Cask**: Unit Target (enemy), cast point 0.2 s. Magical damage; pierces immunity: no; dispellable: strong dispel only; cooldown 20/18/16/14 s; mana 80/100/120/140; cast range 600.
  - What it does: Cask projectile (1200 speed) bounces 3-6 times between enemies within 575: 55-100 magic (+20 per bounce) and 0.8s stun each; can re-hit after another target.
  - Counterplay: Spread out so it cannot bounce; disjoint; strong dispel.
- **Voodoo Restoration**: No Target, Toggle, instant (no cast point). Magical damage; affects debuff-immune allies: yes; dispellable: no; mana 25.
  - What it does: Toggle: heals allies within 650 for 20-50 every 0.33s, costing 9-18 mana per second.
  - Counterplay: Burn his mana or silence him (cannot toggle).
- **Maledict**: Point Target, AoE, cast point 0.35 s. Magical damage; pierces immunity: no; dispellable: no; cooldown 30/26/22/18 s; mana 105/110/115/120; cast range 600.
  - What it does: Point AoE (200 radius, 600 range) on heroes: 18-30 magic per second for 12s, plus bursts every 4s (3 times) of 16-40 per 100 health lost since the cast.
  - Counterplay: Heal back above the cast health (bursts deal 0); not dispellable; dodge the small circle.
- **Voodoo Switcheroo** (granted by Aghanim's Shard): No Target, cast point 0.1 s. Dispellable: no; cooldown 50 s; mana 200.
  - What it does: Shard. WD turns into a Death Ward himself for 2.5s (hidden, -45 attack speed).
  - Counterplay: Stand outside ward range.
- **Gris-Gris** (Innate): Passive.
  - What it does: An undroppable item that collects the gold WD loses on death plus 1 gold every 3s; consume to cash it out.
  - Counterplay: None.
- **Death Ward** (Ultimate): Point Target, Channeled up to 8 s, cast point 0.35 s. Pure damage; pierces immunity: yes; cooldown 100/90/80 s; mana 200/250/300; cast range 500; upgraded by Scepter.
  - What it does: Channel up to 8s: a controllable, invulnerable ward at a point (500 range) attacks enemy heroes every 0.22s for 60-120 pure with +50% accuracy (600-650 range). Ends if WD is interrupted.
  - Aghanim's Scepter / Shard: Scepter: ward attacks bounce between enemies within 575 (and 10% lifesteal per values).
  - Counterplay: Stun, silence or hex WD; it pierces debuff immunity, so BKB does not help; leave its range.

#### Wraith King | Strength | Melee | attack range 150 | move speed 310 | [feed](https://www.dota2.com/datafeed/herodata?language=english&hero_id=42)

*Undying melee carry (Wraith King).*

- **Wraithfire Blast**: Unit Target (enemy), cast point 0.35 s. Magical damage; pierces immunity: no; dispellable: strong dispel only; cooldown 14/12/10/8 s; mana 95/110/125/140; cast range 525.
  - What it does: Fire projectile (1200 speed, 525 range): 80-140 magic, 1.2-1.8s stun, then 20-80 per second and 20% slow for 2s. His skeletons attack the target.
  - Counterplay: Disjoint or Linken's; strong dispel.
- **Bone Guard**: No Target, cast point 0.1 s. Physical damage; pierces immunity: yes; cooldown 45 s; mana 70/80/90/100.
  - What it does: Gains charges (1 per 2 creep kills, 2 per hero kill, max 3-6); activate to spend all to summon skeletons (40s) that each revive once and share his lifesteal.
  - Counterplay: Area damage; Break stops charge gain.
- **Mortal Strike**: Passive. Pierces immunity: yes; cooldown 5 s; upgraded by Shard.
  - What it does: Every 5s an attack crits for 160-280%.
  - Aghanim's Scepter / Shard: Shard: the crit curses the target to take 75% of it again as pure after 3s.
  - Counterplay: None.
- **Vampiric Spirit** (Innate): Passive. Upgraded by Scepter.
  - What it does: 20% lifesteal; when killed he becomes a free-pathing wraith with bonus attack and move speed for 4.25s before dying (not after a Reincarnation death).
  - Aghanim's Scepter / Shard: Scepter: aura that turns allied heroes into wraiths on death too, and longer wraith time.
  - Counterplay: Expect 4s of extra damage after the kill; Break only removes lifesteal.
- **Reincarnation** (Ultimate): Unit Target (ally), instant (no cast point). Pierces immunity: no; dispellable: yes (basic dispel); cooldown 180/150/120 s; mana 220/110/0; upgraded by Scepter.
  - What it does: Passive-like ultimate: on death, if he has mana (220/110/0), he revives after 3s with full health and mana, slows enemies within 600 by 75% for 4s and spawns skeletons. Can be self-cast to die instantly (to trigger it).
  - Aghanim's Scepter / Shard: Scepter: lower cooldown.
  - Counterplay: Drain his mana before the kill; kill him twice.

#### Zeus | Intelligence | Ranged | attack range 365 | move speed 305 | [feed](https://www.dota2.com/datafeed/herodata?language=english&hero_id=22)

*Global lightning nuker.*

- **Arc Lightning**: Unit Target (enemy), cast point 0.2 s. Magical damage; pierces immunity: no; cooldown 1.6 s; mana 85/90/95/100; cast range 800.
  - What it does: 1.6s cooldown chain bolt (800 range): 105-180 magic jumping to 5-11 enemies within 450 (0.25s per jump).
  - Counterplay: Spread out; magic resistance.
- **Lightning Bolt**: Unit or Point Target, cast point 0.3 s. Magical damage; pierces immunity: no; cooldown 6 s; mana 120/125/130/135; cast range 700/750/800/850.
  - What it does: Unit or point: instant bolt from the sky: 140-380 magic, 0.35s mini-stun (interrupts channels), 600 true sight and vision for 5s; ground cast hits the closest enemy hero within 325.
  - Counterplay: Not dodgeable; Linken's blocks the unit version.
- **Heavenly Jump**: No Target, charges only via a talent, instant (no cast point). Magical damage; pierces immunity: no; dispellable: yes (basic dispel); cooldown 26/22/18/14 s; mana 50/60/70/80.
  - What it does: Instant hop 375-600 forward; shocks the closest visible enemy (heroes first) within 700-1000 for 25-100 magic with 80% move and 100% attack slow for 1.4s; 900 vision 3s. Cannot cast while rooted.
  - Counterplay: Basic dispel; stay out of range.
- **Nimbus** (granted by Aghanim's Scepter): Point Target, AoE, cast point 0.2 s. Magical damage; pierces immunity: no; cooldown 45 s; mana 275.
  - What it does: Scepter ability: storm cloud anywhere on the map (450 radius, 30s, 8 fragile pips) that casts his Lightning Bolt on the closest enemy every 2.5s; 125 gold if killed.
  - Counterplay: Kill it with hero attacks (melee take 2 pips per hit).
- **Lightning Hands** (granted by Aghanim's Shard): Toggle, attack modifier (orb), instant (no cast point). Magical damage; pierces immunity: no; dispellable: yes (basic dispel).
  - What it does: Shard toggle: +20 attack speed and his attacks fire Arc Lightning at 50% damage.
  - Counterplay: Treat like Arc Lightning: spread out; the feed marks its effect basic-dispellable (what exactly a dispel removes is unconfirmed).
- **Thundergod's Wrath** (Ultimate): No Target, cast point 0.4 s. Magical damage; pierces immunity: no; cooldown 130 s; mana 250/375/500.
  - What it does: 0.4s cast: hits every enemy hero on the map for 275-575 magic, with true sight around each before the strike.
  - Counterplay: Magic resistance, debuff immunity, high health; cannot be dodged except by invulnerability at cast.
- **Static Field** (Innate): Passive. Magical damage; pierces immunity: no.
  - What it does: Enemies he hits with attacks or abilities take 3.45% of current health as extra magic damage.
  - Counterplay: Magic resistance.

### Inferences
- **The N-Z kits follow Dota's usual shape:** three basic abilities, one ultimate and one innate. Scepter usually changes how an ability behaves, not just its numbers. Examples:
  - Gush becomes a line wave.
  - Shadow Shaman's Shackles chains Ether Shocks and can be cast on allies.
  - Burrowstrike leaves Stinger spines.
  - Ensnare pierces debuff immunity and applies Break.

  Shard usually adds a new button: Death Seeker, Rain of Destiny, Rock Throw, Dead in the Water, Zombie Bite, Gale Force, Urnaconda and others.
- **Many N-Z innates are economy or stat rules rather than buttons:** Dumb Luck, Eureka!, Galvanized, Gris-Gris, Prognosticate, Leviathan's Catch, Eldwurm's Edda, Curiosity. A 1v1 game can borrow the idea of one small, hero-defining passive rule without the item economy behind these.
- **Several 7.42 changes move this half toward clearer counterplay:**
  - Warp Flare's root became a slow.
  - Noxious Plague's damage became undispellable while its spread stayed dispellable.
  - Pudge lost the Shard ally-hook refund.
  - Pugna's Nether Ward got a visible radius.

### Gaps
- **Sub-abilities missing from the feed.** The feed lists only main abilities, so these are named but not given their own entries:
  - Puck's Ethereal Jaunt
  - Tusk's Launch Snowball
  - Phoenix's Launch Fire Spirit, Icarus Dive Stop and Sun Ray Stop
  - Shadow Demon's Shadow Poison Release
  - Spectre's Reality
  - Rubick's Telekinesis Land
  - Templar Assassin's Trap trigger
  - Techies' Reactive Tazer detonate
  - Shadow Fiend's 2nd and 3rd razes
  - Ringmaster's other Dark Carnival souvenirs, if any exist beyond the four in the feed
- **Summoned units' own abilities are not in the hero feed:** Visage's Familiars' Stone Form, Warlock's golem, Nature's Prophet's treants, the serpent wards, Undying's zombies, Wraith King's skeletons and Venomancer's plague wards.
- **Talents are not covered.** Several "charges only via a talent" lines (Disruption, Firesnap Cookie, Toss, Earthshock, Heavenly Jump) come from `AbilityCharges` fields with no base value.
- **Feed text conflicts with the 7.42 notes, or is probably stale:**
  - Curse of the Oldgrowth slow: feed 10% (treants 5%); notes 12% (treants 6%).
  - Zombie Bite: the feed flag says basic-dispellable; the notes say strong dispel only.
  - Tombstone: the feed still shows Shard bunker text; the notes say Tombstone lost its Shard upgrade.
  - Epicenter: the feed still shows Scepter text; the notes say Epicenter is no longer Scepter-upgraded and the upgrade moved to Burrowstrike.
  - Night Stalker: the Shard text on Hunter in the Night (eat a creep) overlaps Midnight Feast.
  - The upgrade flags in the feed already match 7.42: Epicenter is Shard-only, Burrowstrike is Scepter, Tombstone has no upgrade, and Life Drain is Shard-only. So only the leftover description text is stale, not the data.
  - Fire Spirits: the tooltip says 4 spirits, but `spirit_count` is 5.
- **Unclear or zero feed values:**
  - Multicast chances (2x 75, 3x 30, 4x 15): flat chances or weights?
  - Unstable Current's move speed (feed value 0).
  - Viper Strike's listed 2 charges, which are not in the tooltip.
  - Essence Flux: max mana or mana spent?
  - The Song of the Siren heal split between base and Shard.
  - Whether Timbersaw's Scepter still adds a second Chakram.
  - Battle Trance has a `behavior` value of 0 (targeting set in code); its notes mention vision "over the target" and it lists a 525 cast range, so it may be castable on a hero.
- **Undecoded flags:** bits above 2^33 in `behavior` are not decoded with certainty:
  - Bit 42 sits on many innates.
  - Bits 37 and 46 sit on Battle Stance and Lightning Hands.
  - Bit 40 sits on Illusory Orb and Burrowstrike, both of which have alt-casts.

  Illusory Orb is "Vector Targeted" according to its tooltip but carries no vector bit, so it was counted as vector by hand.

## What counterplay does each ability allow?

### Takeaway
N-Z abilities offer the same counterplay levers as A-M:
- telegraphs: long cast points, visible markers, delays;
- dodgeable or disjointable projectiles;
- a dispel tier;
- immunity piercing;
- spell block;
- positional rules.

This half leans unusually hard on two kinds of rule:
1. **"Punish an action" rules:** Nether Ward, Last Word, Arcane Curse, Snakebite, Spiked Carapace, Storm Surge, Dispersion, Fatal Bonds, Disseminate. The victim's counterplay is to stop casting, attacking or damaging for a while.
2. **"Where you stand or face" rules:** Wheel of Wonder, Shackleshot, Desolate, Boomstick, Keen Scope, Backstab, Psi Blades, Crippling Fear, Dream Coil, Static Link, Threads of Fate.

Each ability's specific counter is in its "Counterplay" line above.

### Cited Findings
- **Long cast points of 0.5 s or more (feed `cast_points`)** — clear telegraphs:
  - Teleportation 3 s, with a destination effect "visible to allies and enemies", and no cost if interrupted — [Nature's Prophet](https://www.dota2.com/datafeed/herodata?language=english&hero_id=53)
  - Epicenter 2 s — [Sand King](https://www.dota2.com/datafeed/herodata?language=english&hero_id=16)
  - Assassinate 2 s (0.5 s with Scepter) — [Sniper](https://www.dota2.com/datafeed/herodata?language=english&hero_id=35)
  - Requiem of Souls 1.67 s — [Shadow Fiend](https://www.dota2.com/datafeed/herodata?language=english&hero_id=11)
  - Burrow 1.5 s — [Nyx Assassin](https://www.dota2.com/datafeed/herodata?language=english&hero_id=88)
  - Minefield Sign 1.25 s — [Techies](https://www.dota2.com/datafeed/herodata?language=english&hero_id=105)
  - Rolling Thunder 1.2 s — [Pangolier](https://www.dota2.com/datafeed/herodata?language=english&hero_id=120)
  - Song of the Siren 1 s — [Naga Siren](https://www.dota2.com/datafeed/herodata?language=english&hero_id=89)
  - Nether Strike 1 s — [Spirit Breaker](https://www.dota2.com/datafeed/herodata?language=english&hero_id=71)
  - Blast Off! 1 s — [Techies](https://www.dota2.com/datafeed/herodata?language=english&hero_id=105)
  - Tombstone 0.6 s — [Undying](https://www.dota2.com/datafeed/herodata?language=english&hero_id=85)
  - Shadowraze 0.55 s — [Shadow Fiend](https://www.dota2.com/datafeed/herodata?language=english&hero_id=11)
  - March of the Machines 0.53 s — [Tinker](https://www.dota2.com/datafeed/herodata?language=english&hero_id=34)
  - 0.5 s: Nature's Call and Wrath of Nature ([Nature's Prophet](https://www.dota2.com/datafeed/herodata?language=english&hero_id=53)), Spotlight and Unicycle ([Ringmaster](https://www.dota2.com/datafeed/herodata?language=english&hero_id=131)), Mortimer Kisses ([Snapfire](https://www.dota2.com/datafeed/herodata?language=english&hero_id=128)), Overgrowth ([Treant Protector](https://www.dota2.com/datafeed/herodata?language=english&hero_id=83)), Firestorm ([Underlord](https://www.dota2.com/datafeed/herodata?language=english&hero_id=108)), Chaotic Offering, with a further 0.5 s before the golem lands ([Warlock](https://www.dota2.com/datafeed/herodata?language=english&hero_id=37))
- **Delays after the cast (feed values):**
  - Nether Blast: damage 0.8 s after the cast — [Pugna](https://www.dota2.com/datafeed/herodata?language=english&hero_id=45)
  - Shrapnel: first damage at 1.2 s — [Sniper](https://www.dota2.com/datafeed/herodata?language=english&hero_id=35)
  - Dark Pact: pulses start 1.5 s after the cast — [Slark](https://www.dota2.com/datafeed/herodata?language=english&hero_id=93)
  - Static Remnant: arms after 0.75 s — [Storm Spirit](https://www.dota2.com/datafeed/herodata?language=english&hero_id=17)
  - Sticky Bomb: explodes 1.5 s after sticking — [Techies](https://www.dota2.com/datafeed/herodata?language=english&hero_id=105)
  - Astral Step: mark pops after 1.25 s — [Void Spirit](https://www.dota2.com/datafeed/herodata?language=english&hero_id=126)
  - Psionic Trap: charges to full over 3.5 s — [Templar Assassin](https://www.dota2.com/datafeed/herodata?language=english&hero_id=46)
  - Proximity Mines: the enemy must stand inside for 1 s — [Techies](https://www.dota2.com/datafeed/herodata?language=english&hero_id=105)
  - Mortimer Kisses: globs fly 0.8-2 s — [Snapfire](https://www.dota2.com/datafeed/herodata?language=english&hero_id=128)
  - Rock Throw: flies 0.65-1.75 s — [Primal Beast](https://www.dota2.com/datafeed/herodata?language=english&hero_id=137)
  - Impale: spikes travel at 1600 — [Nyx Assassin](https://www.dota2.com/datafeed/herodata?language=english&hero_id=88)
  - Ravage: tentacles spread outward at 725, so far targets have time to react — [Tidehunter](https://www.dota2.com/datafeed/herodata?language=english&hero_id=29)
  - Onslaught: charge-up of up to 1.7 s — [Primal Beast](https://www.dota2.com/datafeed/herodata?language=english&hero_id=137)
- **The feed says these cannot be disjointed:**
  - Death Pulse — [Necrophos](https://www.dota2.com/datafeed/herodata?language=english&hero_id=36)
  - Scream of Pain — [Queen of Pain](https://www.dota2.com/datafeed/herodata?language=english&hero_id=39)
  - Arcane Bolt — [Skywrath Mage](https://www.dota2.com/datafeed/herodata?language=english&hero_id=101)
  - Splinter Blast's main projectile — [Winter Wyvern](https://www.dota2.com/datafeed/herodata?language=english&hero_id=112)
  - Assassinate's bullet is not dodged by invisibility — [Sniper](https://www.dota2.com/datafeed/herodata?language=english&hero_id=35)
  - In contrast, "Shackleshot can be disjointed" — [Windranger](https://www.dota2.com/datafeed/herodata?language=english&hero_id=21)
- **The feed says these dodge projectiles or disjoint on cast:**
  - Mirror Image (0.5 s invulnerable) — [Naga Siren](https://www.dota2.com/datafeed/herodata?language=english&hero_id=89)
  - Blur — [Phantom Assassin](https://www.dota2.com/datafeed/herodata?language=english&hero_id=44)
  - Doppelganger — [Phantom Lancer](https://www.dota2.com/datafeed/herodata?language=english&hero_id=12)
  - Jaunting to the Illusory Orb, and Puckish rewards it with health and mana — [Puck](https://www.dota2.com/datafeed/herodata?language=english&hero_id=13)
  - Blink — [Queen of Pain](https://www.dota2.com/datafeed/herodata?language=english&hero_id=39)
  - Sand Storm — [Sand King](https://www.dota2.com/datafeed/herodata?language=english&hero_id=16)
  - Time Lapse, both versions — [Weaver](https://www.dota2.com/datafeed/herodata?language=english&hero_id=63)
- **Spell block and reflect exceptions:**
  - Impale "cannot be blocked by Linken's Sphere" — [Nyx Assassin](https://www.dota2.com/datafeed/herodata?language=english&hero_id=88)
  - These do not trigger spell block or reflect:
    - Burrowstrike — [Sand King](https://www.dota2.com/datafeed/herodata?language=english&hero_id=16)
    - Spectral Dagger — [Spectre](https://www.dota2.com/datafeed/herodata?language=english&hero_id=67)
    - Whirling Axes (Ranged) — [Troll Warlord](https://www.dota2.com/datafeed/herodata?language=english&hero_id=95)
  - These do not trigger spell reflect:
    - Death Seeker — [Necrophos](https://www.dota2.com/datafeed/herodata?language=english&hero_id=36)
    - Spell Steal — [Rubick](https://www.dota2.com/datafeed/herodata?language=english&hero_id=86)
- **Indicators hidden from the victim:**
  - Assassinate's crosshair is "only visible to allies" — [Sniper](https://www.dota2.com/datafeed/herodata?language=english&hero_id=35)
  - The Charge of Darkness line is visible only to allies — [Spirit Breaker](https://www.dota2.com/datafeed/herodata?language=english&hero_id=71)
  - Proximity Mines cannot be found with True Sight; they become visible to an enemy within 500 — [Techies](https://www.dota2.com/datafeed/herodata?language=english&hero_id=105)
- **Reflected damage rule:** damage from the following "is considered reflected damage". It gives no lifesteal and cannot be reflected again:
  - Spiked Carapace — [Nyx Assassin](https://www.dota2.com/datafeed/herodata?language=english&hero_id=88)
  - Storm Surge — [Razor](https://www.dota2.com/datafeed/herodata?language=english&hero_id=15)
  - Disseminate — [Shadow Demon](https://www.dota2.com/datafeed/herodata?language=english&hero_id=79)
  - Dispersion — [Spectre](https://www.dota2.com/datafeed/herodata?language=english&hero_id=67)
  - The Kraken Shell-triggered Anchor Smash — [Tidehunter](https://www.dota2.com/datafeed/herodata?language=english&hero_id=29)
  - Corrosive Skin — [Viper](https://www.dota2.com/datafeed/herodata?language=english&hero_id=47)
  - Fatal Bonds — [Warlock](https://www.dota2.com/datafeed/herodata?language=english&hero_id=37)
  - Scream of Pain's self-reflect — [Queen of Pain](https://www.dota2.com/datafeed/herodata?language=english&hero_id=39)
- **Positional counterplay written into the rules:**
  - Wheel of Wonder mesmerizes only heroes who face it for 0.5 s — [Ringmaster](https://www.dota2.com/datafeed/herodata?language=english&hero_id=131)
  - Shackleshot needs a unit or tree up to 575 behind the target; without one the stun is 0.6 s — [Windranger](https://www.dota2.com/datafeed/herodata?language=english&hero_id=21)
  - Desolate only works on an enemy with no allies within 350 — [Spectre](https://www.dota2.com/datafeed/herodata?language=english&hero_id=67)
  - Boomstick is strongest within about 50 and fades by 495 — [Snapfire](https://www.dota2.com/datafeed/herodata?language=english&hero_id=128)
  - Keen Scope adds damage per 100 distance — [Sniper](https://www.dota2.com/datafeed/herodata?language=english&hero_id=35)
  - Backstab works within a 105-degree arc behind the target — [Riki](https://www.dota2.com/datafeed/herodata?language=english&hero_id=32)
  - Psi Blades splits damage onto units behind the target — [Templar Assassin](https://www.dota2.com/datafeed/herodata?language=english&hero_id=46)
  - Dream Coil snaps beyond 600 — [Puck](https://www.dota2.com/datafeed/herodata?language=english&hero_id=13)
  - Static Link breaks at cast range + 250 — [Razor](https://www.dota2.com/datafeed/herodata?language=english&hero_id=15)
  - Threads of Fate breaks at 890 — [Weaver](https://www.dota2.com/datafeed/herodata?language=english&hero_id=63)
  - Crippling Fear silences only within 350 — [Night Stalker](https://www.dota2.com/datafeed/herodata?language=english&hero_id=60)
  - Song of the Siren's area follows Naga — [Naga Siren](https://www.dota2.com/datafeed/herodata?language=english&hero_id=89)
  - Maledict's burst is 0 if the victim heals above their health at the cast — [Witch Doctor](https://www.dota2.com/datafeed/herodata?language=english&hero_id=30)
  - Nethertoxin grows the longer a unit stays inside — [Viper](https://www.dota2.com/datafeed/herodata?language=english&hero_id=47)
  - Meld and Inner Peace require standing still — [Templar Assassin](https://www.dota2.com/datafeed/herodata?language=english&hero_id=46)
  - Hunter in the Night, Void and Crippling Fear are stronger at night — [Night Stalker](https://www.dota2.com/datafeed/herodata?language=english&hero_id=60)
- **Abilities that punish the victim's actions:**
  - Nether Ward damages any enemy who casts nearby, scaled by the mana spent — [Pugna](https://www.dota2.com/datafeed/herodata?language=english&hero_id=45)
  - Last Word triggers when the victim casts; Arcane Curse grows longer with each cast — [Silencer](https://www.dota2.com/datafeed/herodata?language=english&hero_id=75)
  - Snakebite repeats its damage each time the victim attacks — [Venomancer](https://www.dota2.com/datafeed/herodata?language=english&hero_id=40)
  - Spiked Carapace punishes damaging Nyx — [Nyx Assassin](https://www.dota2.com/datafeed/herodata?language=english&hero_id=88)
  - Storm Surge always fires when Razor is targeted by a spell — [Razor](https://www.dota2.com/datafeed/herodata?language=english&hero_id=15)
- **Dispel and immunity counts across the 346 entries (script tally):**
  - 57 entries pierce debuff immunity.
  - 23 are "strong dispel only".
  - 81 carry "not dispellable" (this includes passives and buffs where it does not apply).
  - Basic-dispellable effects are the most common kind among actual debuffs.

### Inferences
- **For a 1v1 MOBA, the most transferable N-Z levers:**
  - Punishing a state the enemy chooses: casting, attacking, standing still, facing a direction, being alone.
  - Telegraphs long enough to react to: a cast point of 1 s or more on the big area disables (Epicenter, Song, Requiem, Blast Off!).
  - Visible ground markers for delayed damage (Mortimer globs, Rock Throw, Nether Blast).

  These need no items to counter, unlike Linken's, Lotus Orb or True Sight.
- **Dodge rewards make dodging a resource, not just a reaction:** Puckish restores health and mana for disjointed attacks and spell projectiles. A 1v1 hero could use the same idea.
- **Hiding the indicator from the victim** (Sniper's crosshair, Spirit Breaker's charge line) makes a skill stronger but fairer only if the effect itself is visible: Spirit Breaker running in, the 2 s aim animation.

### Gaps
- Most "Counterplay" lines are analysis, not sourced statements. The feed has no general "disjointable" field; I assumed tracking unit-target projectiles can be disjointed unless the feed says otherwise. Projectile speeds and animation readability were not checked in game.
- I could not confirm, per ability, whether Linken's Sphere blocks the area-of-effect unit-target spells (for example Sven's Storm Hammer, Mind Flare, Splinter Blast). The feed only states the exceptions.

## Which mechanics are unique or rare?

### Takeaway
In N-Z the rare activation types are:
- **Vector Target (5):** Swashbuckle, Aether Remnant, Gale Force, Walrus Kick, and Illusory Orb (vector per its tooltip).
- **Toggle (5):** Phantom Rush, Rot, Battle Stance, Voodoo Restoration, Lightning Hands.
- **Channeled (14):** Rearm, Death Ward, Dismember, Shackles and others.
- **Base charges (11):** Phantom Strike, Impalement Arts, Shrapnel, Proximity Mines, Astral Step and the Shard ability Eyes in the Forest. The other five are Ringmaster's four souvenirs (held as stacked single-use charges) and Viper Strike (the feed lists 2 charges; not confirmed). Five more abilities get charges from Scepter.
- **Autocast attack modifiers (8).**

The most distinctive designs are about copying, time and identity:
- Spell Steal
- Time Lapse
- False Promise
- Supernova's rebirth
- Haunt's global illusions
- Sunder's health swap
- Nether Swap
- Winter's Curse turning enemies on each other
- Disruption's copies of the enemy

### Cited Findings
**Tally of activation types (computed by script from the feed's `behavior` field)**

Counting rule: every ability entry in the first section is counted: 346 abilities across 61 heroes, including innates, Scepter- and Shard-granted abilities, and Ringmaster's four souvenirs. Each ability gets one primary activation, chosen in this order: vector > channeled > toggle > autocast attack modifier > passive > unit-or-point > unit > point > no target. Hand adjustments:
- Illusory Orb is counted as vector (its tooltip says "Vector Targeted"; the bit is absent).
- Static Remnant is counted as point target (the feed flags it No Target, but its tooltip, its 800 cast range and `is_point_targeted=1` say it walks to a target point).
- Midnight Feast and Nature's Guise are flagged Passive but each has an active part (eat a creep at night; turn invisible while tree-walking). They stay counted as Passive.

Source: the 61 hero feeds linked in the first section.

| Primary activation (each ability counted once) | Count |
|---|---|
| Passive | 88 |
| Unit Target | 79 |
| No Target | 75 |
| Point Target | 64 |
| Channeled | 14 |
| Autocast attack modifier | 8 |
| Unit or Point Target | 7 |
| Vector Target | 5 |
| Toggle | 5 |
| No static flag (Battle Trance; set in code) | 1 |
| **Total** | **346** |

**Flags (one ability can carry several)**

| Flag (raw feed bits, before hand adjustments) | Count |
|---|---|
| Unit Target flag (any) | 100 |
|   of which enemy-only | 63 |
|   of which ally-only | 15 |
|   of which ally or enemy | 13 |
|   of which custom (any unit, e.g. Phantom Strike, Nether Swap) | 8 |
| Point Target flag | 78 |
| No Target flag | 82 |
| AoE flag (shows a radius) | 58 |
| Passive | 88 |
| Aura | 6 |
| Active with a 0 s cast point | 78 |
| Channeled | 14 |
| Toggle | 5 |
| Autocast | 9 |
| Attack modifier (orb), active | 10 |
| Vector bit set (Illusory Orb not included) | 4 |
| Charges without items | 11 |
| Charges added by Scepter | 5 |
| Charges only from a talent | 5 |
| Innate | 61 |
| Ultimate | 61 |
| New ability granted by Scepter | 13 |
| New ability granted by Shard | 22 |
| Pierces debuff immunity | 57 |
| Strong dispel only | 23 |
| Not dispellable (incl. not applicable) | 81 |
| Magical damage | 144 |
| Physical damage | 41 |
| Pure damage | 13 |

**The 28 most unusual mechanics in N-Z**
1. **Rubick's Spell Steal** copies the last spell an enemy hero cast and keeps it for minutes; with Scepter he holds two, with their Scepter versions. — [Rubick](https://www.dota2.com/datafeed/herodata?language=english&hero_id=86)
2. **Weaver's Time Lapse** rewinds his position, health and mana to 5 s earlier. In 7.42 the ally version became a separate Scepter ability with a shared cooldown. — [Weaver](https://www.dota2.com/datafeed/herodata?language=english&hero_id=63)
3. **Oracle's False Promise** holds back all damage and healing on an ally for 7-10 s, doubles the healing, and applies the net result at the end. — [Oracle](https://www.dota2.com/datafeed/herodata?language=english&hero_id=111)
4. **Oracle's paradox spells:** Fate's Edict makes a target magic-immune but disarmed. Purifying Flames damages first, then heals more than it dealt; the pair is meant to be combined. — [Oracle](https://www.dota2.com/datafeed/herodata?language=english&hero_id=111)
5. **Phoenix's Supernova** kills Phoenix into a sun with pip health. If the sun survives 6 s he is reborn with full health, mana and refreshed cooldowns; with Scepter an ally can be taken inside. — [Phoenix](https://www.dota2.com/datafeed/herodata?language=english&hero_id=110)
6. **Naga's Song of the Siren** sleeps enemies while making them invulnerable. The area moves with Naga and it can be ended early, so it works as a reset as much as a disable. — [Naga Siren](https://www.dota2.com/datafeed/herodata?language=english&hero_id=89)
7. **Spectre's Haunt** spawns an illusion beside every enemy hero on the map, and Reality lets her teleport to any one of them. — [Spectre](https://www.dota2.com/datafeed/herodata?language=english&hero_id=67)
8. **Terrorblade's Sunder** swaps health percentages between himself and a target hero, with a floor of 25-35%. — [Terrorblade](https://www.dota2.com/datafeed/herodata?language=english&hero_id=109)
9. **Vengeful Spirit's Nether Swap** trades places with any hero, ally or enemy. Her Scepter leaves a full-power spell-casting illusion that she replaces on respawn. — [Vengeful Spirit](https://www.dota2.com/datafeed/herodata?language=english&hero_id=20)
10. **Winter Wyvern's Winter's Curse** freezes one enemy and forces its nearby allies to attack it, while both are immune to everyone else's damage. — [Winter Wyvern](https://www.dota2.com/datafeed/herodata?language=english&hero_id=112)
11. **Shadow Demon's Disruption** banishes any hero and returns it with two illusions of that hero under Shadow Demon's control. Shadow Poison stores damage that doubles per stack and is released on command. — [Shadow Demon](https://www.dota2.com/datafeed/herodata?language=english&hero_id=79)
12. **Pangolier's vector dash and steerable ball:** Swashbuckle dashes along one vector and slashes along a second. Rolling Thunder is a steered, slow-turning ball that bounces off walls and jumps cliffs with Shield Crash. — [Pangolier](https://www.dota2.com/datafeed/herodata?language=english&hero_id=120)
13. **Void Spirit's Aether Remnant** is a vector-placed sentry that pulls whoever crosses its line of sight. Dissimilate lets him choose his exit from a ring of portals. — [Void Spirit](https://www.dota2.com/datafeed/herodata?language=english&hero_id=126)
14. **Tusk's team spells:** allies can climb into Snowball to add stun and damage. Ice Shards raises a temporary curved wall. — [Tusk](https://www.dota2.com/datafeed/herodata?language=english&hero_id=100)
15. **Puck's Illusory Orb** can be curved along a drawn path and teleported to (Ethereal Jaunt). His innate Puckish restores health and mana whenever he dodges. — [Puck](https://www.dota2.com/datafeed/herodata?language=english&hero_id=13)
16. **Ringmaster's Wheel of Wonder** mesmerizes only heroes who look at it; his innate hands out random single-use "souvenir" abilities after kills near him. — [Ringmaster](https://www.dota2.com/datafeed/herodata?language=english&hero_id=131)
17. **Tinker's Rearm** is a channeled reset of all his cooldowns. Eureka! converts Intelligence into item cooldown reduction. — [Tinker](https://www.dota2.com/datafeed/herodata?language=english&hero_id=34)
18. **Pugna's Nether Ward** punishes enemy casting in proportion to the mana spent. His innate lets him cast while channeling, and with Scepter he can recast any spell while it is on cooldown (2 charges). — [Pugna](https://www.dota2.com/datafeed/herodata?language=english&hero_id=45)
19. **Silencer's anti-caster kit:** Global Silence silences the whole map, Last Word triggers on the victim's own cast, and Arcane Curse lengthens with every spell cast. — [Silencer](https://www.dota2.com/datafeed/herodata?language=english&hero_id=75)
20. **Nyx Assassin's Spiked Carapace** negates and reflects the first hit from every source and stuns each attacker. — [Nyx Assassin](https://www.dota2.com/datafeed/herodata?language=english&hero_id=88)
21. **Techies' Proximity Mines** cannot be seen by True Sight, only by walking close. M.A.D. leaves an exploding barrel on death. The Scepter Minefield Sign makes an area where moving costs health. — [Techies](https://www.dota2.com/datafeed/herodata?language=english&hero_id=105)
22. **Snapfire's ally-launch spells:** Firesnap Cookie makes an ally hop and stun on landing. With Scepter, Mortimer swallows an ally or creep and spits it up to 3000 away. Her Mortimer Kisses artillery is steered by right-click while it fires. — [Snapfire](https://www.dota2.com/datafeed/herodata?language=english&hero_id=128)
23. **Troll Warlord's Battle Stance** is an innate toggle between melee and ranged, which swaps which Whirling Axes and Berserker's Rage he has. Battle Trance makes him unkillable by damage but forces him to attack. — [Troll Warlord](https://www.dota2.com/datafeed/herodata?language=english&hero_id=95)
24. **Primal Beast's Uproar** banks stacks from big hits he takes and spends them on a roar; Onslaught goes farther the longer it is charged. — [Primal Beast](https://www.dota2.com/datafeed/herodata?language=english&hero_id=137)
25. **Death-defying innates:**
    - Undying respawns at the fountain instantly once every 480 s (Ceaseless Dirge) — [Undying](https://www.dota2.com/datafeed/herodata?language=english&hero_id=85)
    - Wraith King becomes a wraith that delays his death, and Reincarnation revives him if he has the mana — [Wraith King](https://www.dota2.com/datafeed/herodata?language=english&hero_id=42)
    - Shadow Shaman survives lethal damage as a chicken among decoy chickens — [Shadow Shaman](https://www.dota2.com/datafeed/herodata?language=english&hero_id=27)
26. **Ogre Magi's Multicast** randomly repeats targeted spells and items 2-4 times. Dumb Luck locks his Intelligence at 0 and gives him mana from Strength instead. — [Ogre Magi](https://www.dota2.com/datafeed/herodata?language=english&hero_id=84)
27. **Damage sharing and spreading:**
    - Fatal Bonds shares damage across up to 6 linked enemies — [Warlock](https://www.dota2.com/datafeed/herodata?language=english&hero_id=37)
    - Disseminate copies damage from one marked unit to everyone near it — [Shadow Demon](https://www.dota2.com/datafeed/herodata?language=english&hero_id=79)
    - Noxious Plague carries all of Venomancer's debuffs to new targets when it ends — [Venomancer](https://www.dota2.com/datafeed/herodata?language=english&hero_id=40)
28. **Unusual movement:**
    - Storm Spirit's Ball Lightning has no cooldown and costs mana per distance traveled — [Storm Spirit](https://www.dota2.com/datafeed/herodata?language=english&hero_id=17)
    - Timbersaw's Timber Chain is a grappling hook to trees — [Timbersaw](https://www.dota2.com/datafeed/herodata?language=english&hero_id=98)
    - Nature's Prophet's Teleportation reaches any point on the map — [Nature's Prophet](https://www.dota2.com/datafeed/herodata?language=english&hero_id=53)
    - Underlord's Fiend's Gate opens two-way portals for the team — [Underlord](https://www.dota2.com/datafeed/herodata?language=english&hero_id=108)
    - Spirit Breaker's Charge of Darkness runs through terrain to any enemy — [Spirit Breaker](https://www.dota2.com/datafeed/herodata?language=english&hero_id=71)
    - Phantom Lancer's Doppelganger reappears at a random spot among decoys — [Phantom Lancer](https://www.dota2.com/datafeed/herodata?language=english&hero_id=12)

**Rare mechanics named in the brief, where they occur in N-Z**
- **Vector targeting:** Swashbuckle, Aether Remnant, Gale Force, Walrus Kick, Illusory Orb.
- **Toggles:** Rot, Phantom Rush, Battle Stance, Voodoo Restoration, Lightning Hands; Arctic Burn becomes a toggle with Scepter.
- **Stances:** Troll Warlord's Battle Stance; Terrorblade's Metamorphosis (ranged demon form).
- **Charges:** Phantom Strike, Impalement Arts, Shrapnel, Proximity Mines, Astral Step, Eyes in the Forest. With Scepter: Escape Act, Demonic Purge, Pounce, Resonant Pulse, Oblivion Savant.
- **Delayed damage:** Reaper's Scythe (at the end of its stun), Shadow Poison, Astral Step, Nether Blast, Sticky Bomb, Mortal Strike's Shard curse, False Promise, Maledict, Psionic Trap.
- **Illusions:** Mirror Image, Doppelganger, Juxtapose, Spirit Lance, Conjure Image, Reflection, Disruption, Shadow Step, Haunt, Funhouse Mirror, Vengeance Aura's Scepter illusion.
- **Terrain creation:** Sprout, Ice Shards, Nature's Grasp vines (counted as trees), Pit of Malice, Fiend's Gate, Proximity Mines and the Minefield Sign.
- **Tethers and leashes:** Static Link, Pounce, Dream Coil, Threads of Fate, Dead in the Water, Life Drain, Shackles.
- **Swaps:** Nether Swap (positions), Sunder (health), Spirit Breaker's Planar Pocket (redirects spells to himself).
- **Time reversal:** Time Lapse.
- **Spell stealing:** Spell Steal.

### Inferences
- **The rarest N-Z mechanics change who controls a unit or a value, not just its health:**
  - Spell Steal: whose spell it is.
  - Nether Swap and Sunder: whose position or health.
  - Winter's Curse: whose side a unit fights on.
  - Disruption: who controls the copy.
  - False Promise: when damage counts.

  These read as signature moments, and each comes with a strict limit: a cooldown of 40-110 s, a short duration, or a floor such as Sunder's 25-35%.
- **Vector targeting stays rare (5 of 346, about 1.4%).** In a 1v1 browser game it is easier to support with mouse drag than in Dota. It suits dashes, walls and pushes, where the second direction is the real decision.

### Gaps
- The tally counts the feed's main abilities only. Sub-abilities and summon abilities are missing (see the Gaps of the first section), so channels, toggles and recasts are slightly undercounted.
- The rule for choosing one primary activation is mine. A different order (for example counting Charges as primary) would shift the counts by a few.
