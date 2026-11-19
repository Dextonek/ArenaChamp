# Dota 2 heroes A to M: every ability, how it is cast, and its counterplay (patch 7.42)

## For each hero A-M, what are its abilities and how is each cast and targeted?

### Takeaway
The 66 heroes from Abaddon to Muerta (Largo and Kez included) have 390 ability entries in patch 7.42, counting innate abilities, abilities granted by Aghanim's Scepter or Shard, and swap-in sub-abilities. Facets no longer exist: they were removed in 7.41. Activation is spread almost evenly across four kinds: No Target, Passive, Unit Target and Point Target. The rarer kinds (toggle, channel, vector, autocast attack modifier, charges) together make up roughly one ability in eight, and they are where most of the unusual design sits.

### Cited Findings
**Sources and patch**
- The current patch is **7.42**, released on 2026-11-18 (timestamp 1794988800), one day before this research. The patches before it were 7.41f and 7.41e. — [Dota 2 patch list feed](https://www.dota2.com/datafeed/patchnoteslist?language=english); [7.42 notes feed](https://www.dota2.com/datafeed/patchnotes?language=english&version=7.42)
- The 7.41 notes list the removal of Facets from the game as a global change, and also say innate abilities no longer scale with other abilities' levels. The hero feed still carries empty or leftover `facets_loc` strings and an empty `facets` list. Facets are therefore not listed below. — [7.41 notes feed](https://www.dota2.com/datafeed/patchnotes?language=english&version=7.41)
- All hero and ability data below comes from Valve's official hero data feed (one `herodata` call per hero; each hero heading links to its feed). The feed already reflects 7.42: Mist Coil's description now describes a health cost, matching the 7.42 note that its self-damage became a health cost. Kez's Raptor Dance radius (425) and max-health damage (2.75/3.25/3.75%) also match the 7.42 notes. — [Abaddon feed](https://www.dota2.com/datafeed/herodata?language=english&hero_id=102); [7.42 notes feed](https://www.dota2.com/datafeed/patchnotes?language=english&version=7.42)
- The Liquipedia and Fandom wikis were not used. Patch 7.42 was one day old, so the official feed is newer than any wiki page.

**How to read each entry**
- **First line: sourced facts from the feed.**
  - **Activation:** decoded from the feed's `behavior` bitmask: Passive, No Target, Unit Target (ally / enemy / both / special), Point Target, AoE, Vector Target, Toggle, Autocast, Channeled.
  - **Directional:** a point target used only as a direction.
  - **"instant (no queue)":** Dota's IMMEDIATE flag, an ability that fires without waiting in the order queue. These usually have a 0 s cast point.
  - **Charges:** from the `AbilityCharges` and `AbilityChargeRestoreTime` values.
  - **Damage type:** Physical, Magical or Pure.
  - **"pierces immunity":** the feed's old `SPELL_IMMUNITY_*` field. In-game this is now called debuff immunity, and the feed's own descriptions use the newer debuff-immunity wording.
  - **"dispellable":** basic dispel, strong dispel only, or no. When the field is missing, the ability leaves no removable effect or the feed does not say.
  - **Numbers:** cooldown per level (seconds), mana per level, cast point (the wind-up before the effect; 0 means none), cast range ("global" for an unlimited range) and channel time.
  - **"upgraded by":** whether a Scepter or Shard changes the ability.
- **"What it does":** my paraphrase of the feed's description and values. Ranges like "95-320" are level 1 to max level.
- **"Counterplay":** my own analysis as a Dota-literate designer. It is not in the feed, so it is inferred unless the feed says it. The feed explicitly says these cannot be disjointed (Unstable Concoction, Spark Wraith, Chain Frost, Mystic Snake, Life Break), projectile dodging on cast (Blink, Chemical Rage, Crystal Clone, Shadow Realm, Sproink, Pierce the Veil), indicators shown only to allies (Torrent, Call Down, Homing Missile), and spells that do not trigger spell block (Dragon Slave, Breathe Fire, Crypt Swarm, Dual Breath, Earth Spike, Fissure, Starstorm). Where I was unsure, the entry says "inferred" or "not in the feed".
- **Generic terms:**
  - **Disjoint:** a blink, invisibility, invulnerability or untargetable state that makes in-flight projectiles miss.
  - **Linken's / spell block:** items that cancel one unit-targeted spell.
  - **Lotus Orb:** reflects one.
  - **Basic dispel:** removes most buffs and debuffs, but not stuns.
  - **Strong dispel:** also removes stuns and other hard disables.

**Per-hero reference** (alphabetical by in-game name; abilities in the feed's order)

#### Abaddon | Universal | Melee | attack range 150 | move speed 325 | [feed](https://www.dota2.com/datafeed/herodata?language=english&hero_id=102)

- **Mist Coil**: Unit Target (ally or enemy). Magical damage; pierces immunity: no (allies: yes); cooldown 8/7/6/5 s; mana 50/55/60/65; cast point 0.25 s; cast range 625; upgraded by Scepter.
  - What it does: A tracking projectile (speed 1300) sent at one unit, friend or foe (not himself). An enemy takes 95-320 magic damage and a 60% slow for 0.7-1 s; an ally is healed the same amount and sped up. Abaddon pays 40% of that amount as a health cost, which cannot kill him (since 7.42 a true health cost, not self-damage).
  - Aghanim's Scepter: Hits every unit within 400 of the target, and on enemies it also performs an instant attack (100% damage, on-hit effects at 80% item potency).
  - Counterplay: Homing projectile: only a disjoint (blink, invisibility, untargetable state) or a Linken's-type block stops it once cast. Spell immunity blocks the damage on enemies.
- **Aphotic Shield**: Unit Target (ally). Magical damage; pierces immunity: allies: no; dispellable: yes (basic dispel); cooldown 12/10/8/6 s; mana 110/120/130/140; cast point 0.3 s; cast range 550; upgraded by Shard.
  - What it does: Cast on an ally or himself: a strong dispel plus a 12 s barrier that absorbs 120-210 damage of every type. When it breaks or runs out it bursts for its full absorb value as magic damage in 675 radius (units in fog are not hit).
  - Aghanim's Shard: 75% of the damage it absorbed is also dealt to nearby enemies.
  - Counterplay: Burst through it or ignore it; an enemy purge removes it (basic-dispellable). Do not stand next to the shielded unit when it is about to pop.
- **Curse of Avernus**: Passive. Magical damage; pierces immunity: no; dispellable: yes (basic dispel).
  - What it does: Passive on attack: curses the target for 3 s with a 10-25% slow and 12-36 magic damage per second; anyone attacking the cursed unit gets +15-30 attack speed (Abaddon gets 1.5x that).
  - Counterplay: Kite the melee hero; basic dispel removes the curse.
- **Withering Mist** (Innate): Passive. no numeric fields in the feed.
  - What it does: Innate. Any attack or ability damage Abaddon deals cuts the enemy's health restoration for 5 s: 10% at full health, scaling linearly up to 40% (+1% per hero level) as the victim's health approaches zero. Item damage does not apply it.
  - Counterplay: Avoid trading while low; disengage to let it expire.
- **Borrowed Time**: No Target, instant (no queue). dispellable: no; cooldown 85/75/65 s; cast point 0.
  - What it does: Instant self-cast, usable even while stunned or hexed (not while silenced): a strong dispel, then for 4-6 s every point of damage Abaddon takes heals him instead. If it is off cooldown it fires by itself when his health drops below 400, even through silence.
  - Counterplay: Stop damaging him for the duration, or burst him from above 400 to zero in one hit. Break stops the automatic trigger; silence stops only the manual one. Cannot be dispelled.

#### Alchemist | Strength | Melee | attack range 150 | move speed 290 | [feed](https://www.dota2.com/datafeed/herodata?language=english&hero_id=73)

- **Acid Spray**: Point Target / AoE. Physical damage; pierces immunity: no; cooldown 21 s; mana 120; cast point 0.1 s; cast range 900.
  - What it does: Ground zone at a point (radius 350-500, 15 s): enemies inside take 25-40 physical damage per second and lose 3-6 armor.
  - Counterplay: Walk out of the visible puddle; it is pure area denial.
- **Unstable Concoction**: No Target, instant (no queue). Physical damage; pierces immunity: no; dispellable: strong dispel only; cooldown 17 s; mana 100; cast point 0; cast range 775.
  - What it does: Two-step spell. The first press starts brewing (Alchemist keeps moving and acting, 4-16% faster); a countdown over his head, visible to enemies, grows the payload for 5 s (up to 150-360 physical damage and a 1.7-3.2 s stun in 250 radius). He then throws it at an enemy hero (775 range) with the replacement Throw button; at 5.5 s it explodes on himself.
  - Counterplay: Watch the public timer and stay out of 775 range near the 5 s mark; the thrown flask cannot be disjointed, but spell immunity, a spell block or forcing him to hold it too long beats it. Stun is strong-dispel only.
- **Corrosive Weaponry**: Passive. pierces immunity: no.
  - What it does: Passive: attacks add 2 stacks (Concoction adds 1 per second brewed) of a 4 s debuff, each stack slowing 2.5-4% and cutting base attack damage 2.5-4%, up to 7-16 stacks.
  - Counterplay: Avoid long melee trades; basic dispel clears the stacks.
- **Berserk Potion** (granted by Aghanim's Shard): Unit Target (ally). pierces immunity: allies: yes; dispellable: no; cooldown 35 s; mana 75; cast point 0.2 s; cast range 800.
  - What it does: Shard ability. A thrown potion on an ally: basic dispel plus +50 attack speed, +30% move speed and +40 health regen for 15 s.
  - Counterplay: Cannot be dispelled once applied; punish the dispelled ally another way.
- **Greevil's Greed** (Innate): Passive. upgraded by Scepter.
  - What it does: Innate economy passive: each kill gives bonus gold that grows by an extra instance for every further kill within 40 s, and Bounty Runes give double gold.
  - Aghanim's Scepter: Alchemist can consume a Scepter to give an allied hero all its upgrades, keeping +20 damage and more Greed gold for each Scepter melted (a spell that gives an item away, unusual).
  - Counterplay: Contest his farm and runes.
- **Chemical Rage**: No Target. dispellable: no; cooldown 60 s; mana 50/75/100; cast point 0.
  - What it does: Instant transform (0.35 s, during which he is briefly untouchable and can dodge projectiles and stuns): for 30 s his base attack time drops to 1.2-1.0 and he gains 50-120 health regen and 20-40% move speed. The cast also basic-dispels him.
  - Counterplay: Wait it out or burst through the regen with damage that ignores it (healing reduction); the buff itself cannot be dispelled.

#### Ancient Apparition | Intelligence | Ranged | attack range 675 | move speed 285 | [feed](https://www.dota2.com/datafeed/herodata?language=english&hero_id=68)

- **Cold Feet**: Unit Target (enemy). Magical damage; pierces immunity: no; dispellable: yes (basic dispel); cooldown 15/13/11/9 s; mana 110/115/120/125; cast point 0.01 s; cast range 700/800/900/1000.
  - What it does: Unit-targeted curse: 25-85 magic damage per second and a small slow. If the target is still within 725-800 of the spot where it was cursed after 4 s, it is frozen (stunned) for 1.8-3 s.
  - Counterplay: Walk away from the marked spot (a visible ring) before 4 s; basic dispel or spell immunity removes it.
- **Ice Vortex**: Point Target / AoE. Magical damage; pierces immunity: no; dispellable: no; cooldown 10/8/6/4 s; mana 40/55/70/85; cast point 0.01 s; cast range 1200.
  - What it does: Ground vortex at a point (radius 275, 6-12 s): slows 10-25%, lowers magic resistance 14-20%, deals 10-40 magic damage per second and gives vision. Cooldown falls to 4 s, so several can be up at once.
  - Counterplay: Step out of the visible circle.
- **Chilling Touch**: Autocast attack modifier, Unit Target (enemy). Magical damage; pierces immunity: no; dispellable: yes (basic dispel); cooldown 10/7.5/5/2.5 s; mana 30; cast point 0; upgraded by Scepter.
  - What it does: Autocast attack modifier: the next attack gains 60-150 extra range, 40-160 magic damage and a 100% slow for 0.7-1 s.
  - Aghanim's Scepter: No cooldown: every attack is a Chilling Touch.
  - Counterplay: The empowered attack is a normal attack projectile, so it can be disjointed or evaded.
- **Bone Chill** (Innate): Passive. Magical damage; pierces immunity: no; upgraded by Scepter.
  - What it does: Innate: each instance of AA's magic ability damage on an enemy hero removes 0.2 Strength for 4 s, stacking independently.
  - Aghanim's Scepter: +0.8 Strength removed per instance (1.0 in total).
  - Counterplay: Short durations; avoid sustained exposure to his damage-over-time spells.
- **Ice Blast**: Point Target / AoE. Magical damage; pierces immunity: YES (enemies); dispellable: no; cooldown 50/45/40 s; mana 175; cast point 0.01 s; upgraded by Shard.
  - What it does: Map-wide two-step ultimate. AA launches a tracer in a direction (whether enemies can see it is not stated in the feed) (no cast range), then presses Release to send a ball of hail to where the tracer is; the explosion radius grows with the tracer's travel time (300 + 50 per second, max 1000). Everyone hit, or touched by the hail ball in flight (300 path radius), gets Frostbite for 10-12 s: 12-36 damage per second, no health regen or healing, and an instant shatter (death) if health falls below 12-14%. Pierces spell immunity.
  - Aghanim's Shard: Also freezes the targets as Cold Feet does, for 50% of its stun.
  - Counterplay: The hail ball is visible and slow; run out of its landing circle. Frostbite cannot be dispelled and stops almost all healing (only Sunder, Time Lapse and Supernova get round it), so play to stay above the shatter line.

#### Anti-Mage | Agility | Melee | attack range 150 | move speed 315 | [feed](https://www.dota2.com/datafeed/herodata?language=english&hero_id=1)

- **Mana Break**: Passive. Physical damage; pierces immunity: no; upgraded by Scepter.
  - What it does: Passive: every attack burns 25-40 mana plus 1.8-4.5% of the target's max mana and deals 65% of the mana burned as physical damage (illusions burn 25%).
  - Aghanim's Scepter: Larger max-mana burn per hit.
  - Counterplay: Heroes with little mana care less; keep distance.
- **Blink**: Point Target. cooldown 10.5/9/7.5/6 s; mana 60/55/50/45; cast point 0.4 s; cast range 875/950/1025/1100; upgraded by Scepter.
  - What it does: Point-target teleport, 875-1100 range, 0.4 s cast point.
  - Aghanim's Scepter: The first Mana Break within 5 s after a Blink burns an extra 20% of max mana and blocks mana regeneration and gain for 6 s (undispellable).
  - Counterplay: The 0.4 s cast point can be interrupted; roots and leashes stop it.
- **Counterspell**: No Target, instant (no queue). dispellable: yes (basic dispel); cooldown 15/11/7/3 s; mana 50; cast point 0; upgraded by Shard.
  - What it does: Passive 14-35% magic resistance. Active for 1.3 s: a shell that blocks and reflects any unit-targeted spell back at its caster.
  - Aghanim's Shard: Reflecting a spell also creates a blinking illusion fragment of Anti-Mage next to the enemy caster.
  - Counterplay: Bait the shell with a cheap spell, use ground-targeted or area spells, or wait out the short window (15-3 s cooldown). Break turns off the passive resistance.
- **Persecutor** (Innate): Passive. pierces immunity: no.
  - What it does: Innate: attacks slow by 12-24% depending on how much mana the target is missing (none above 60% mana, full at 0%). Works fully from illusions.
  - Counterplay: Keep mana high near him.
- **Mana Void**: Unit Target (enemy) / AoE. Magical damage; pierces immunity: no; cooldown 100/85/70 s; mana 100/150/200; cast point 0.3 s; cast range 600.
  - What it does: Unit-targeted blast: damage equal to the main target's missing mana (x1) is dealt to the target and every enemy within 400-500; the main target is mini-stunned 0.3 s.
  - Counterplay: Keep mana high when he is near; a spell block or Lotus Orb stops it; spell immunity protects.

#### Arc Warden | Universal | Ranged | attack range 625 | move speed 300 | [feed](https://www.dota2.com/datafeed/herodata?language=english&hero_id=113)

- **Flux**: Unit Target (enemy). Magical damage; pierces immunity: no; dispellable: yes (basic dispel); cooldown 16 s; mana 75; cast point 0.3 s; cast range 625/700/775/850; upgraded by Scepter.
  - What it does: Unit-target debuff that only works on an isolated target: if no other enemy unit of the target's own team stands within 225, it takes 15-60 magic damage per second and a 20-35% slow for 6 s.
  - Aghanim's Scepter: Also silences while the target is alone, more damage, +2 s.
  - Counterplay: Stand next to an allied unit (even a creep) to switch it off; basic dispel removes it.
- **Magnetic Field**: Point Target / AoE, self-castable. pierces immunity: allies: yes; cooldown 20/19/18/17 s; mana 60/70/80/90; cast point 0.3 s; cast range 900.
  - What it does: Point area (radius 300, 4-7 s): allied units inside evade 100% of attacks coming from outside the field and gain 30-120 attack speed. It also pulls Runes toward it and auto-activates runes that enter it.
  - Counterplay: Walk into the field to attack, use spells, or True Strike items.
- **Spark Wraith**: Point Target / AoE. Magical damage; pierces immunity: no; cooldown 4 s; mana 80; cast point 0.3 s; cast range 2000.
  - What it does: Point-placed trap: after 1.5 s a wraith hovers for 16 s; when an enemy enters 375 radius it homes in (speed 550) for 100-310 magic damage, a 100% slow and a 0.7-1 s mini-stun. 4 s cooldown, so a field of them is possible.
  - Counterplay: The wraith cannot be disjointed once it chases; avoid the visible wraiths or let a creep trigger them.
- **Runic Infusion** (Innate): Passive. no numeric fields in the feed.
  - What it does: Innate: every Power Rune he or his Double activates gives +1.5 to all attributes permanently.
  - Counterplay: Contest runes.
- **Tempest Double**: Point Target. cooldown 60/55/50 s; cast point 0.15 s; cast range 700; upgraded by Shard.
  - What it does: Creates a full copy of Arc Warden at a point (700 range) for 18-24 s, with all his current spells and most items and separate cooldowns, so every spell and item can be used twice. The copy decays over its life (up to 35% blind and 35% slow) and gives 100 gold if killed.
  - Aghanim's Shard: The copy spawns with Arcane, Invisibility and Haste rune effects for 12 s.
  - Counterplay: Kill or disable the copy first (it is a separate unit with its own cast points); avoid fighting during its first seconds.

#### Axe | Strength | Melee | attack range 150 | move speed 315 | [feed](https://www.dota2.com/datafeed/herodata?language=english&hero_id=2)

- **Berserker's Call**: No Target. pierces immunity: YES (enemies); dispellable: no; cooldown 18/16/14/12 s; mana 90/100/110/120; cast point 0.3 s; upgraded by Shard.
  - What it does: No-target taunt in 315 around Axe after a 0.3 s cast point: enemies are forced to attack him for 2.1-3 s, and he gains +12-15 armor. Pierces spell immunity.
  - Aghanim's Shard: Also applies Battle Hunger to everyone taunted.
  - Counterplay: Stay out of the small radius and watch for Blink Dagger; it is short, but it cannot be dispelled and goes through spell immunity.
- **Battle Hunger**: Unit Target (enemy). Pure damage; pierces immunity: no; dispellable: yes (basic dispel); cooldown 20/15/10/5 s; mana 50/60/70/80; cast point 0.3 s; cast range 600/700/800/900; upgraded by Shard.
  - What it does: Unit-target debuff for 12 s: 12-24 pure damage per second until the target kills a unit; while it faces away from Axe it is also slowed 16-25%.
  - Aghanim's Shard: Several instances can stack on one target.
  - Counterplay: Last-hit any creep (or a building) to end it; basic dispel removes it; turn toward Axe to drop the slow.
- **Counter Helix**: Passive. Pure damage; pierces immunity: YES (enemies); cooldown 0.3 s; upgraded by Scepter.
  - What it does: Passive counter: after Axe has been attacked 7-4 times he spins, dealing 100-160 pure damage in 275 radius (0.3 s cooldown). Pierces immunity.
  - Aghanim's Scepter: Hits also give a stacking debuff (up to 5, 7 s) that cuts the victims' attack damage against Axe; no cooldown, and Axe's own attacks advance the counter.
  - Counterplay: Do not stand next to Axe trading blows; illusions and summons trigger it too.
- **Culling Blade**: Unit Target (enemy). Pure damage; pierces immunity: YES (enemies); dispellable: yes (basic dispel); cooldown 80/75/70 s; mana 100/125/150; cast point 0.3 s; cast range 175.
  - What it does: Melee-range (175) unit-target strike for 275-475 pure damage that cannot be stopped by death-preventing effects such as Shallow Grave. A hero kill with it resets the cooldown, gives nearby allies (900) +25% move speed and +10-20 armor for 6 s, and adds a permanent armor stack (1-2) to Axe. The feed also lists a 1200 "charge speed" value, which may mean a short charge to the target (not confirmed).
  - Counterplay: Keep health above the damage when Axe is near; a spell block, Lotus Orb or a save before the swing; it pierces spell immunity.
- **One Man Army** (Innate): Passive. dispellable: no.
  - What it does: Innate: while no allied hero is within 700, Axe gains Strength equal to 50% of his armor; the bonus fades over 3 s after an ally comes close.
  - Counterplay: Fight him where his team is.

#### Bane | Universal | Ranged | attack range 425 | move speed 305 | [feed](https://www.dota2.com/datafeed/herodata?language=english&hero_id=3)

- **Enfeeble**: Unit Target (enemy). Pure damage; pierces immunity: no; dispellable: yes (basic dispel); cooldown 22/17/12/7 s; mana 100/110/120/130; cast point 0.2 s; cast range 700/800/900/1000.
  - What it does: Unit-target debuff for 9 s: 12-30 pure damage per second, -55-70% attack damage and -30% cast range.
  - Counterplay: Basic dispel; spell immunity blocks it.
- **Brain Sap**: Unit Target (enemy). Pure damage; pierces immunity: YES (enemies); cooldown 17/15/13/11 s; mana 105/120/135/150; cast point 0.2 s; cast range 625; upgraded by Shard.
  - What it does: Unit-target drain: 90-300 pure damage to the target, healing Bane the same. Pierces spell immunity.
  - Aghanim's Shard: Becomes a 550-radius area spell (secondary targets heal 30%) with 4 s less cooldown.
  - Counterplay: Instant, no projectile; only a spell block or Lotus stops it.
- **Nightmare**: Unit Target (ally or enemy). pierces immunity: allies: no; dispellable: yes (basic dispel); cooldown 25/22/19/16 s; mana 120/130/140/150; cast point 0.4 s; cast range 550/600/650/700.
  - What it does: Unit-target sleep on an enemy or ally hero for 3-6 s: the sleeper walks slowly (110) in a direction Bane chose (or stands still with alt-cast) and is invulnerable for the first second. Any damage wakes it; if someone other than Bane attacks it directly, the Nightmare jumps to the attacker. Recast ends all Nightmares.
  - Counterplay: Allies wake the target with a damaging spell, not an attack; basic dispel removes it; Bane can use it to save an ally.
- **Fiend's Grip**: Unit Target (enemy), Channeled. Pure damage; pierces immunity: YES (enemies); dispellable: strong dispel only; cooldown 125/110/95 s; mana 200/300/400; cast point 0.2 s; cast range 625; channel 4.75/5.25/5.75 s; upgraded by Scepter.
  - What it does: Channeled for 4.75-5.75 s on one unit: the target is fully disabled, takes 70-150 pure damage per second and loses 5% max mana every 0.5 s. Pierces spell immunity.
  - Aghanim's Scepter: Two uncontrollable illusions also channel the Grip (killing Bane alone no longer frees the target), cooldown -35 s.
  - Counterplay: Interrupt Bane (and his illusions with Scepter) with any stun, silence or hex; Linken's blocks it; strong dispel only.
- **Ichor of Nyctasha** (Innate): Passive. Pure damage.
  - What it does: Innate: an enemy hero killed by Bane or dying under his debuff gets a permanent Terror stack (max 6), each lowering its status resistance against Bane's later debuffs by 4%.
  - Counterplay: Do not die to him.

#### Batrider | Universal | Ranged | attack range 400 | move speed 310 | [feed](https://www.dota2.com/datafeed/herodata?language=english&hero_id=65)

- **Sticky Napalm**: Point Target / AoE. Magical damage; pierces immunity: no; dispellable: yes (basic dispel); cooldown 4 s; mana 25; cast point 0; cast range 600; upgraded by Shard.
  - What it does: Point area (375) with no cast point and no turning: each cast adds a 7 s stack (max 10) that adds 6-24 damage per stack to all of Batrider's attacks and spells, slows movement 2-8% and turn rate 10-55%, and deals a small hit. 4 s cooldown and 25 mana make it a spam spell.
  - Aghanim's Shard: No stack limit, and it damages buildings.
  - Counterplay: Leave the area between casts; basic dispel clears the stacks.
- **Flamebreak**: Point Target / AoE. Magical damage; pierces immunity: no; dispellable: yes (basic dispel); cooldown 22/19/16/13 s; mana 110; cast point 0.2 s; cast range 1300.
  - What it does: Thrown cocktail to a point (1300 range): explodes in 400 radius for 30-120 magic damage, a 250 knockback, a slow and a burn over 2-5 s.
  - Counterplay: It has travel time; move out of the target spot.
- **Firefly**: No Target, instant (no queue). Magical damage; pierces immunity: no; dispellable: no; cooldown 48/42/36/30 s; mana 100; cast point 0.
  - What it does: Instant self buff for 15 s: Batrider flies (passes over trees, units and cliffs), gains speed that ramps up to +12-30%, and leaves a burning trail (radius 250, 20-80 magic damage per second) that destroys trees.
  - Counterplay: Do not walk through the fire trail; it cannot be dispelled.
- **Smoldering Resin** (Innate): Passive. no numeric fields in the feed.
  - What it does: Innate: attacks apply a 2 s burn dealing 20% of the attack damage each second.
- **Flaming Lasso**: Unit Target (enemy). Magical damage; pierces immunity: YES (enemies); dispellable: strong dispel only; cooldown 90/75/60 s; mana 125/150/175; cast point 0.3 s; cast range 200; upgraded by Scepter.
  - What it does: 200-range unit-target leash: for 2.25-3.25 s the target is dragged behind Batrider and cannot move, attack or cast, taking 125-375 magic damage. Breaks if Batrider moves more than 425 units in an instant (blink, teleport) or either dies. Pierces spell immunity.
  - Aghanim's Scepter: Also grabs the target's nearest allied hero within 650, tethered behind the first.
  - Counterplay: Respect the tiny 200 range (Blink Dagger initiation); Linken's or a strong dispel frees the target; stun or kill Batrider.

#### Beastmaster | Universal | Melee | attack range 150 | move speed 305 | [feed](https://www.dota2.com/datafeed/herodata?language=english&hero_id=38)

- **Wild Axes**: Point Target. Magical damage; pierces immunity: no; dispellable: yes (basic dispel); cooldown 8 s; mana 65; cast point 0.3 s; cast range 1500; upgraded by Shard.
  - What it does: Two axes fly to a point (up to 1500) on curved paths and return, cutting trees; each hits an enemy once for 45-165 magic damage and a 10-13 s stacking debuff that raises damage from Beastmaster and his units by 4-7%.
  - Aghanim's Shard: His attacks on heroes also apply the debuff.
  - Counterplay: Side-step the visible curved paths; basic dispel.
- **Summon Razorback**: No Target. Physical damage; cooldown 30 s; mana 60; cast point 0.3 s.
  - What it does: Summons a Boar for 60 s whose attacks poison (slowing movement and attack speed for 3 s).
  - Counterplay: Kill the summon.
- **Summon Raptors**: No Target. Magical damage; cooldown 25 s; mana 50; cast point 0.3 s.
  - What it does: Summons 2 hawks for 25 s that circle Beastmaster and dive at enemies (heroes first) every ~4 s for 70-190 magic damage and a 0.4-1 s root.
  - Aghanim's Shard: A third hawk and longer duration.
  - Counterplay: Kill the hawks (they have 30-60% magic resistance); distance from Beastmaster.
- **Inner Beast** (Innate): Passive. pierces immunity: allies: yes.
  - What it does: Innate aura: +7 attack speed for Beastmaster and his units within 1200.
  - Counterplay: Break disables it.
- **Summon Ancient Thunderhide** (granted by Aghanim's Scepter): No Target. cooldown 60 s; mana 100; cast point 0.3 s.
  - What it does: Scepter ability: summons an Ancient Thunderhide (2200 health) that can Slam to damage and slow nearby enemies and drums to raise the damage and max health of Beastmaster and his units when they attack.
  - Counterplay: Kill it or fight away from it.
- **Primal Roar**: Unit Target (enemy). Magical damage; pierces immunity: YES (enemies); dispellable: strong dispel only; cooldown 90/75/60 s; mana 100/125/150; cast point 0.5 s; cast range 600.
  - What it does: Unit-target roar (600 range, 0.5 s cast point): stuns the target 3-4 s and deals 150-300 magic damage; units along the path take damage and are shoved aside and slowed 60% (movement and attack). Beastmaster and his units gain 40% speed for 2 s. Pierces spell immunity.
  - Counterplay: Linken's or Lotus; strong dispel only; the 0.5 s cast point gives a short window to interrupt.

#### Bloodseeker | Agility | Melee | attack range 150 | move speed 290 | [feed](https://www.dota2.com/datafeed/herodata?language=english&hero_id=4)

- **Bloodrage**: No Target, instant (no queue). Pure damage; pierces immunity: YES (enemies); dispellable: yes (basic dispel); cooldown 14/12/10/8 s; cast point 0; upgraded by Shard.
  - What it does: Instant self buff for 8 s: +55-130 attack speed and +12-24% spell amplification, costing 1.2% of his max health per second (non-lethal).
  - Aghanim's Shard: Attacks also deal 1.5% of the target's max health as pure damage.
  - Counterplay: Basic dispel removes it; his health drain makes him easier to burst.
- **Blood Rite**: Point Target / AoE. Pure damage; pierces immunity: no; dispellable: yes (basic dispel); cooldown 15/14/13/12 s; mana 90/100/110/120; cast point 0.3 s; cast range 1500.
  - What it does: Point area (600 radius, 1500 range): after a 2.6 s delay plus 0.3 s cast point the ritual completes, silencing enemies inside for 3-6 s and dealing 100-265 pure damage.
  - Counterplay: The circle is visible for ~2.9 s: walk out.
- **Thirst**: Passive. pierces immunity: YES (enemies).
  - What it does: Passive: gains move speed (up to +12-36%) for every enemy hero below full health, anywhere on the map, more as they get lower; below 25% he also sees that hero and has True Sight on it. No move-speed cap.
  - Counterplay: Heal up or stay out of reach when low; invisibility does not hide you below 25%.
- **Sanguivore** (Innate): Passive. pierces immunity: YES (enemies).
  - What it does: Innate: killing a unit heals him for 30 + a percentage of its max health (less from creeps); half if an ally kills an enemy hero near him.
- **Rupture**: Unit Target (enemy); Scepter gives 2 charges. Pure damage; pierces immunity: YES (enemies); dispellable: no; cooldown 75/70/65 s; mana 125/175/225; cast point 0.4 s; cast range 800; upgraded by Scepter.
  - What it does: Unit-target (800) debuff for 7-11 s: an initial hit of 10% of current health, then pure damage equal to 45-55% of every unit of distance the target moves. Pierces spell immunity and cannot be dispelled.
  - Aghanim's Scepter: Initial damage 15%, two charges, cooldown -10 s.
  - Counterplay: Stand still or move as little as possible (fight in place); Linken's or Lotus blocks the cast.

#### Bounty Hunter | Agility | Melee | attack range 150 | move speed 325 | [feed](https://www.dota2.com/datafeed/herodata?language=english&hero_id=62)

- **Shuriken Toss**: Unit Target (enemy). Magical damage; pierces immunity: no; cooldown 5 s; mana 75/85/95/105; cast point 0.3 s; cast range 375/425/475/525; upgraded by Scepter.
  - What it does: Unit-target thrown shuriken (375-525): 100-310 magic damage and a 0.35 s full slow; it bounces to every Tracked enemy within 1200 of each other.
  - Aghanim's Scepter: Longer cast range and applies Jinada on hit.
  - Counterplay: A projectile: disjointable; stay away from Tracked allies.
- **Jinada**: Autocast attack modifier, Unit Target (enemy). Physical damage; pierces immunity: YES (enemies); cooldown 9/7/5/3 s; cast point 0; cast range 150.
  - What it does: Autocast attack modifier on a 9-3 s cooldown: the next hit deals +70-175 physical damage and steals 15-36 unreliable gold.
- **Shadow Walk**: No Target, instant (no queue); Shard gives charges (15/14/13/12 s each). dispellable: no; cooldown 18/17/16/15 s; mana 50; cast point 0.
  - What it does: Instant invisibility (fade 1-0.25 s) for up to 20-35 s with +9-18% move speed and free pathing through units; an attack that breaks it stuns for 0.9-1.5 s.
  - Aghanim's Shard: Gains charges (restore 15-12 s) and the Friendly Shadow ally version.
  - Counterplay: True Sight (Dust, Sentry, Gem); hit him during the fade time.
- **Friendly Shadow** (granted by Aghanim's Shard): Unit Target (ally), instant (no queue). pierces immunity: no (allies: yes); dispellable: no; cooldown 15 s; mana 50; cast point 0; cast range 650.
  - What it does: Shard ability: Shadow Walk on an ally (650 range, 0.5 s fade) without breaking his own invisibility.
  - Counterplay: True Sight.
- **Big Game Hunter** (Innate): Passive. no numeric fields in the feed.
  - What it does: Innate: 20% more kill and assist gold on enemy heroes in the top 3 of their team's net worth.
- **Track**: Unit Target (enemy). pierces immunity: YES (enemies); dispellable: yes (basic dispel); cooldown 6/5/4 s; mana 50; cast point 0.3 s; cast range 1000.
  - What it does: Unit-target mark (1000 range) for 25 s: True Sight on the target, +6-14% damage taken, its gold shown; if it dies, Bounty Hunter and nearby allies collect bonus gold. Does not break his invisibility and is visible only to his team. Pierces spell immunity.
  - Counterplay: Basic dispel removes it.

#### Brewmaster | Universal | Melee | attack range 150 | move speed 310 | [feed](https://www.dota2.com/datafeed/herodata?language=english&hero_id=78)

- **Thunder Clap**: No Target. Magical damage; pierces immunity: no; dispellable: yes (basic dispel); cooldown 18/16/14/12 s; mana 100; cast point 0.3 s.
  - What it does: No-target slam in 400 around him: 80-320 magic damage and a 15-60% movement and attack-speed slow for 3.5-4.25 s.
  - Counterplay: Keep out of melee radius; basic dispel.
- **Cinder Brew**: Point Target / AoE. Magical damage; pierces immunity: no; dispellable: yes (basic dispel); cooldown 19/17/15/13 s; mana 50/60/70/80; cast point 0.2 s; cast range 950.
  - What it does: A barrel rolls to a point (projectile speed 950), hitting enemies on its path, then spills in 400 radius: slowed 24-36% for 5 s. Any magic or pure damage on a drenched enemy ignites it (+3 s, 75-300 total burn).
  - Counterplay: Dodge the visible barrel path and spill circle; basic dispel.
- **Drunken Brawler**: No Target, instant (no queue). dispellable: no; cast point 0.
  - What it does: Instant stance switch (no cost, no cooldown) among three: Earth (magic resistance and armor), Storm (evasion and move speed) and Fire (attack speed and 20% crit). Casting any ability makes him Brewed Up: stance bonuses +150% for 5 s (+2 s per further cast), followed by a 9 s hangover before he can be Brewed Up again.
  - Counterplay: Read his current stance and play around the 5 s Brewed Up windows.
- **Liquid Courage** (Innate): Passive. upgraded by Shard.
  - What it does: Innate: after taking 400 damage from player units (counter resets after 7 s without damage), he gets +10% status resistance for 5 s and his move speed alternates every second between faster and slower; once per 15 s.
  - Aghanim's Shard: Becomes an active thrown drink (800 range) on himself or an ally granting the effect and 3% max health regen per second for 5 s.
  - Counterplay: Time disables after it ends.
- **Primal Split**: No Target. dispellable: no; cooldown 140/130/120 s; mana 150/200/250/250; cast point 0.55 s; upgraded by Scepter.
  - What it does: No-target ultimate (0.55 s cast point): Brewmaster disappears and splits into three controllable brewlings (Earth, Storm, Fire) for 16-24 s, each with its own spells and its stance. If any brewling lives to the end he reappears in its place (Earth first, then Storm, then Fire); if all die, he dies. Earth carries his auras and True Sight; Fire has free pathing.
  - Aghanim's Scepter: +1 level for the brewlings and their spells, can be ended early, and brewlings start Brewed Up.
  - Counterplay: Focus and kill all three; ending all three kills Brewmaster. Cannot be dispelled.

#### Bristleback | Strength | Melee | attack range 150 | move speed 295 | [feed](https://www.dota2.com/datafeed/herodata?language=english&hero_id=99)

- **Viscous Nasal Goo**: Unit Target (enemy). pierces immunity: no; dispellable: yes (basic dispel); cooldown 1.75 s; mana 10/15/20/25; cast point 0.3 s; cast range 650.
  - What it does: Unit-target spit (650) on a 1.75 s cooldown: stacking 5 s debuff (max 6) reducing armor 1-4 per stack and slowing 12% plus 3-12% per stack.
  - Counterplay: Basic dispel; stay out of range.
- **Quill Spray**: Autocast, No Target, instant (no queue). Physical damage; pierces immunity: YES (enemies); dispellable: no; cooldown 3 s; mana 35; cast point 0.
  - What it does: Instant (also autocastable) spray in 700 around him every 3 s: 25-85 physical damage plus 30 per previous Quill hit in the last 14 s (max 500). Pierces spell immunity and ignores damage block.
  - Counterplay: Do not stay near him; the stacks fade after 14 s.
- **Bristleback**: Passive. upgraded by Scepter.
  - What it does: Passive facing armour: takes 8-20% less damage from the side and 16-40% less from behind; every 275-200 damage taken from behind releases a free Quill Spray.
  - Aghanim's Scepter: Adds an active: he turns to a chosen direction and after 0.5 s fires 5 Quill Sprays in a tight cone out of his back every 0.4 s; while doing it he is disarmed, slowed 40% and his facing is locked.
  - Counterplay: Hit him from the front; break turns it off. Do not stand behind him during the Scepter volley.
- **Hairball** (granted by Aghanim's Shard): Point Target / AoE. pierces immunity: allies: yes; dispellable: yes (basic dispel); cooldown 15 s; mana 60; cast point 0.1 s; cast range 750.
  - What it does: Shard ability: a hairball thrown to a point (750) that bursts in 700 radius, applying 2 Goo stacks and a Quill Spray.
  - Counterplay: Leave the area; basic dispel for the goo.
- **Warpath**: Passive. dispellable: no.
  - What it does: Passive: every spell he casts adds a stack (16-20 s, max 8-12) of +12-20 damage and +2-3% move speed.
  - Counterplay: Break stops new stacks (existing ones stay).
- **Prickly** (Innate): Passive. Physical damage; pierces immunity: no; dispellable: yes (basic dispel).
  - What it does: Innate: +5% damage and debuff duration against enemy heroes behind him.

#### Broodmother | Agility | Melee | attack range 175 | move speed 285 | [feed](https://www.dota2.com/datafeed/herodata?language=english&hero_id=61)

- **Insatiable Hunger**: No Target. Physical damage; dispellable: no; cooldown 45/40/35/30 s; mana 70; cast point 0.2 s; upgraded by Shard.
  - What it does: Instant self buff for 8-14 s: +40-70 attack damage and 40-100% lifesteal for her and nearby spiderlings.
  - Aghanim's Shard: The bonus damage grows by 4% every second while active.
  - Counterplay: Disarm, evasion, healing reduction; wait it out.
- **Spin Web**: Point Target / AoE; Charge-based: 3/5/7/9 charges, 27 s each. dispellable: no; mana 40; cast point 0.4 s; cast range 1200.
  - What it does: Charge-based point area (3-9 webs, one per 27 s): permanent webs on which she has +10-40% move speed, more turn rate and free pathing. A new web may be placed anywhere it touches an existing web; above the limit the oldest web vanishes.
  - Counterplay: Fight her off her webs; webs show where she is strong.
- **Incapacitating Bite**: Passive. pierces immunity: no; dispellable: yes (basic dispel).
  - What it does: Passive on attack: for 2 s the target is slowed 15-30%, misses 30-60% of its attacks, and takes 3-12 more attack damage.
  - Counterplay: Basic dispel; avoid melee trades.
- **Spinner's Snare** (granted by Aghanim's Scepter): Vector Target, Channeled; Charge-based: 2 charges, 30 s each. Magical damage; pierces immunity: no; dispellable: yes (basic dispel); mana 70; cast point 0.2 s; cast range 600.
  - What it does: Scepter ability, vector/line targeted: draws an invisible web line (900 wide) that must touch an existing web; it forms after 2 s. An enemy hero crossing it is rooted 3 s, revealed and takes 100 magic damage per second, and her team gets a minimap alert. Up to 5 lines (2 charges, 30 s restore); one line can catch several heroes.
  - Counterplay: Avoid her webbed areas; True Sight shows invisible lines (inferred); basic dispel the root.
- **Spider's Milk** (Innate): Passive. dispellable: no.
  - What it does: Innate: when she or a nearby unit of hers kills an enemy, her units near the victim heal a share of the victim's health every 0.5 s for 3 s.
- **Spawn Spiderlings**: Unit Target (enemy). Magical damage; pierces immunity: no; dispellable: yes (basic dispel); cooldown 9/8/7 s; mana 100; cast point 0.2 s; cast range 900.
  - What it does: Unit-target spell (900): 220-420 magic damage and a 25-45% slow for 4 s; if the target dies within 20 s, 4-6 spiderlings (40 s) hatch from it, and units they kill spawn more.
  - Counterplay: Do not let marked creeps die to her; kill spiderlings for gold.

#### Centaur Warrunner | Strength | Melee | attack range 150 | move speed 295 | [feed](https://www.dota2.com/datafeed/herodata?language=english&hero_id=96)

- **Hoof Stomp**: No Target, instant (no queue). Magical damage; pierces immunity: no; dispellable: strong dispel only; cooldown 18/16/14/12 s; mana 100/110/120/130; cast point 0.
  - What it does: Instant start of a 0.5 s windup (he can move but not attack), then a stomp in 325 radius: 70-280 magic damage and a 1.6-2.2 s stun.
  - Counterplay: Walk out during the visible windup; strong dispel only.
- **Double Edge**: Unit Target (enemy) / AoE. Magical damage; pierces immunity: no; cooldown 3.5 s; cast point 0.25 s; cast range 175; upgraded by Shard.
  - What it does: Melee unit-target hit (175) every 3.5 s, no mana: 120-330 magic damage plus a share of his Strength to the target area, and the same to himself (cannot kill him).
  - Aghanim's Shard: Slows enemy heroes 25% for 2 s and gives him +12% Strength per hero hit for 12 s (max 5 stacks).
  - Counterplay: It costs him health: trade when he is low.
- **Retaliate**: Passive. Physical damage; pierces immunity: YES (enemies); dispellable: yes (basic dispel).
  - What it does: Passive: every attack against him returns 15-45 plus 14-35% of his Strength as physical damage (reflected, so no lifesteal on it). Pierces spell immunity; half against towers.
  - Counterplay: Avoid right-clicking him with low health; use spells.
- **Work Horse** (granted by Aghanim's Scepter): No Target. pierces immunity: YES (enemies); dispellable: no; cooldown 35 s; mana 75; cast point 0.
  - What it does: Scepter ability: for 6 s Centaur gets his Stampede effect and hitches a cart; he can cast Hitch a Ride on an ally to carry it in the cart.
  - Counterplay: Slow or stop Centaur to stop the passengers too.
- **Stampede**: No Target, instant (no queue). Magical damage; pierces immunity: no (allies: yes); dispellable: no; cooldown 100/95/90 s; mana 150/200/250; cast point 0.
  - What it does: Instant global team buff for 3.5-4.5 s: every allied hero moves at max speed through units; each enemy trampled (radius 105) is slowed 3 s and takes 2-2.5x Centaur's Strength as magic damage, once per enemy.
  - Aghanim's Scepter: +1 s duration.
  - Counterplay: Disable or slow the runners; it cannot be dispelled.
- **Horsepower** (Innate): Passive. no numeric fields in the feed.
  - What it does: Innate: 40% of his Strength as bonus move speed (does not stack with boots).

#### Chaos Knight | Strength | Melee | attack range 150 | move speed 325 | [feed](https://www.dota2.com/datafeed/herodata?language=english&hero_id=81)

- **Chaos Bolt**: Unit Target (enemy). Magical damage; pierces immunity: no; dispellable: strong dispel only; cooldown 13/12/11/10 s; mana 110; cast point 0.4 s; cast range 600; upgraded by Shard.
  - What it does: Unit-target bolt (600): stuns 1.25-3.25 s and deals 90-410 magic damage at random, with long stuns paired with low damage and the reverse. Nearby illusions mimic the cast animation (a feint).
  - Aghanim's Shard: Also creates a full-damage Phantasm illusion attacking the target for 6 s.
  - Counterplay: A projectile: disjointable; Linken's blocks it; strong dispel only for the stun.
- **Reality Rift**: Unit Target (enemy). pierces immunity: no; dispellable: yes (basic dispel); cooldown 15/12/9/6 s; mana 50; cast point 0.25 s; cast range 600/650/700/750.
  - What it does: Unit-target pull (600-750): Chaos Knight, all his illusions and the target teleport to a point on the line between them (the target moves 300-450), face each other and start attacking; the target loses 4-7 armor for 6 s.
  - Aghanim's Shard: Can be cast on any enemy hero within 1200 of him or of one of his illusions, gathering all of them on the target.
  - Counterplay: Linken's blocks; keep distance; basic dispel for the armor loss.
- **Chaos Strike**: Passive. pierces immunity: YES (enemies).
  - What it does: Passive: one in three attacks (also from illusions) is a critical strike of random size (120% up to 150-270%) with 30-60% lifesteal.
  - Counterplay: Evasion, armor, disarm.
- **Ahead, Armageddon** (Innate): Point Target (directional). Physical damage; pierces immunity: YES (enemies); cooldown 30 s; mana 50; cast point 0.4 s.
  - What it does: Innate. Passively, the longer Chaos Knight keeps walking without stopping or attacking, the faster he gets (+5% per second, up to +20%), lost on attacking. While at least one illusion from an active Phantasm lives, it can be activated in a direction: after a short windup he gathers his illusions within 1300 and they charge over any terrain, accelerating to double speed, attacking units they run over (charge time about 1 s).
  - Counterplay: A stun, hex, fear, taunt or root during the windup cancels the charge; kill the Phantasm illusions to disable it.
- **Phantasm**: No Target. cooldown 85/80/75 s; mana 100/200/300; cast point 0.4 s; upgraded by Scepter.
  - What it does: No-target ultimate (0.4 s cast point): Chaos Knight is invulnerable for 0.5 s, sheds most debuffs (basic dispel) and creates 3 illusions for 30 s that deal 60-100% damage and take 350% damage.
  - Aghanim's Scepter: Passive 50% chance to create an extra illusion whenever any of his illusions is made; the active also creates an illusion of every allied hero, anywhere on the map.
  - Counterplay: Area damage kills the fragile illusions; the real one shows no difference, so look for buffs and item use.
- **Heel, Armageddon** (Innate): No Target, instant (no queue). cooldown 0.3 s; cast point 0; cast range unlimited (global or direction only).
  - What it does: Hidden sub-button of Ahead, Armageddon (no description in the feed); by its name and flags, an instant recast that ends the charge early.

#### Chen | Intelligence | Ranged | attack range 650 | move speed 305 | [feed](https://www.dota2.com/datafeed/herodata?language=english&hero_id=66)

- **Penitence**: Unit Target (enemy). Pure damage; pierces immunity: no; dispellable: yes (basic dispel); cooldown 20/17/14/11 s; mana 80/90/100/110; cast point 0.3 s; cast range 800.
  - What it does: Unit-target debuff (800) for 5-8 s: 60-240 pure damage, a 12-30% slow and +20-80 attack speed for anyone attacking the target.
  - Counterplay: Basic dispel.
- **Holy Persuasion**: Unit Target (ally or enemy). pierces immunity: YES (enemies); dispellable: no; cooldown 15 s; mana 110/130/150/170; cast point 0.3 s; cast range 600; upgraded by Shard.
  - What it does: Unit-target control of an enemy or neutral creep (count and level limits by level, 1-4 creeps); Chen gets part of its bounty. Recast globally on his own creep to unsummon it, or on himself to call all his creeps to him after a 6-3 s delay (cancelled by damage from enemy heroes).
  - Aghanim's Shard: Can take Ancient creeps (1-3 by Hand of God level) and raises some creep spells by a level.
  - Counterplay: Kill the creeps (they give gold); damage Chen to cancel the recall.
- **Divine Favor**: Unit Target (ally). pierces immunity: allies: yes; dispellable: no; cooldown 20/18/16/14 s; mana 75; cast point 0.2 s; cast range 1200.
  - What it does: Passive health-regen aura; active on an ally (1200 range) for 6 s: +5-20 armor and +5-20% healing received. Cast on Chen, every unit he controls gets it.
  - Counterplay: Cannot be dispelled; switch targets.
- **Zealot** (Innate): No Target. cooldown 60 s; cast point 0.3 s.
  - What it does: Innate with an active part: his controlled non-hero units get bonus health, damage and speed; once per 60 s he can anoint a creep as his Zealot (bonus base damage, a Martyrdom spell, immune to instant creep-kill effects) or respawn the current one. He starts with a melee lane creep as his Zealot.
  - Counterplay: Kill the Zealot and his creeps.
- **Hand of God**: No Target. pierces immunity: allies: yes; dispellable: yes (basic dispel); cooldown 150/130/110 s; mana 200/300/400; cast point 0.3 s; upgraded by Scepter.
  - What it does: Global no-target heal: every allied hero and every unit Chen controls gets 200-400 health at once and 20-40 per second for 10 s. Reaches invulnerable and hidden allies.
  - Aghanim's Scepter: Cooldown 40 s and becomes a channel of up to 6 s: the burst heal at the start, then nearby allies are debuff-immune with 60% magic resistance and the heal-over-time is tripled.
  - Counterplay: Burst targets faster than the heal; interrupt the Scepter channel.

#### Clinkz | Agility | Ranged | attack range 600 | move speed 285 | [feed](https://www.dota2.com/datafeed/herodata?language=english&hero_id=56)

- **Strafe**: No Target, instant (no queue). pierces immunity: YES (enemies); dispellable: yes (basic dispel); cooldown 24/21/18/15 s; mana 55/60/65/70; cast point 0; cast range 1200.
  - What it does: Instant self buff for 3.5 s: +120-240 attack speed and +200 attack range; skeleton archers within 1200 get the range and 40% of the speed. Does not break invisibility.
  - Counterplay: Short window: hide, disarm, evasion.
- **Searing Arrows**: Autocast attack modifier, Unit Target (enemy). Physical damage; pierces immunity: YES (enemies); mana 10; cast point 0; cast range 600.
  - What it does: Autocast attack modifier (10 mana per arrow): +20-65 physical damage on each attack, also against buildings; skeleton archers fire 50% versions at his target.
- **Death Pact**: Unit Target; Charge-based: 1/1/2/2 charges, 40 s each. dispellable: no; mana 50; cast point 0.2 s; cast range 700.
  - What it does: Unit-target (700) consumption of an enemy creep or his own skeleton archer: heals him and raises his max health by 175-400 for 45 s; he keeps the creep's gold and experience. Charges 1-2 (40 s each). Does not break his invisibility.
  - Counterplay: Deny creeps near him; kill skeletons.
- **Burning Barrage** (granted by Aghanim's Shard): Point Target (directional), Channeled. Physical damage; pierces immunity: YES (enemies); cooldown 17 s; mana 75; cast point 0.2 s; channel 2 s.
  - What it does: Shard ability, channeled 2 s in a direction: fires 6 waves of piercing arrows (850 range, longer with attack range) that hit every enemy in the line for 75% attack damage with attack modifiers.
  - Counterplay: Step out of the line; interrupt the channel.
- **Burning Army** (granted by Aghanim's Scepter): Vector Target. Physical damage; cooldown 70 s; mana 150; cast point 0; cast range 600.
  - What it does: Scepter ability, vector-targeted: places a line of 6 burning skeleton archers (900 long) starting at a point.
  - Counterplay: Each archer dies to 2 hero hits; kill them or leave their range.
- **Skeleton Walk**: No Target, instant (no queue). dispellable: no; cooldown 24/21/18 s; mana 80/105/130; cast point 0.
  - What it does: Instant invisibility (0.6 s fade) for 35-45 s with +25-45% move speed and free pathing, ended by attacking or using items (not by his own spells). On leaving it, 2-4 immobile skeleton archers (2 hits to kill, 20-30 s) appear and shoot with 20% of his damage.
  - Counterplay: True Sight; kill the archers right away (creeps and illusions only do 25% to them).
- **Infernal Shred** (Innate): Passive. dispellable: no.
  - What it does: Innate: his attacks (3% each) and his skeletons' (1%) stack a 5 s debuff letting their attacks ignore up to 20% of the target's armor.
  - Counterplay: Break stops new stacks.

#### Clockwerk | Strength | Melee | attack range 150 | move speed 310 | [feed](https://www.dota2.com/datafeed/herodata?language=english&hero_id=51)

- **Battery Assault**: No Target, instant (no queue). Magical damage; pierces immunity: no; dispellable: no; cooldown 24/22/20/18 s; mana 70/75/80/85; cast point 0.
  - What it does: Instant self buff for 10.5 s: every 0.7 s a shrapnel hits a random enemy within 275 for 20-95 magic damage and a mini-stun. Keeps going while Clockwerk is disabled.
  - Counterplay: Stay out of melee radius; it cannot be dispelled.
- **Power Cogs**: No Target. Magical damage; pierces immunity: YES (enemies); cooldown 21/19/17/15 s; mana 90; cast point 0.2 s.
  - What it does: No-target ring of cogs (radius 215) around him for 5-8 s, trapping anyone inside. Enemies outside touching a cog are knocked back, burned for 40-145 mana and hit for 55-220 magic plus half the mana burned; a cog shuts off after one shock. Cogs die to 2 enemy attacks; Clockwerk can hit one to fling it up to 850-1000 away and walks through them freely.
  - Counterplay: Attack two hits on a cog to break out; leave melee range before he casts.
- **Rocket Flare**: Point Target / AoE. Magical damage; pierces immunity: no; cooldown 20/18/16/14 s; mana 35/40/45/50; cast point 0.3 s.
  - What it does: Global point-target rocket: after a travel time it explodes in 600 radius for 80-200 magic damage and a 0.4 s 100% slow, and gives vision there for 6 s.
  - Counterplay: Visible flight time over long distances; move out of the explosion.
- **Overclocking** (granted by Aghanim's Scepter): No Target, instant (no queue). pierces immunity: YES (enemies); dispellable: no; cooldown 45 s; cast point 0.
  - What it does: Scepter ability, instant: for 18 s all his spells are supercharged (larger Battery Assault and Cogs radius, cog armor, more and stronger flares, wider and longer Hookshot stun, faster Jetpack). Afterwards he is slowed to a crawl for 3 s.
  - Counterplay: Survive 18 s and punish the 3 s exhaustion.
- **Jetpack** (granted by Aghanim's Shard): No Target. dispellable: yes (basic dispel); cooldown 16 s; mana 75; cast point 0.
  - What it does: Shard ability: 6 s of flying movement and vision with +20% move speed, a very low turn rate and no attacks; can be toggled on and off within the duration.
  - Counterplay: Slow turn rate makes him predictable; basic dispel.
- **Hookshot**: Point Target. Magical damage; pierces immunity: YES (enemies); dispellable: strong dispel only; cooldown 60/45/30 s; mana 100/125/150; cast point 0.3 s; cast range 2000/2500/3000.
  - What it does: Point-target grappling hook (2000-3000 range) flying fast in a line; the first unit hit pulls Clockwerk to it, stunning 1.2-1.6 s and dealing 75-275 magic damage in 175 around the target, and stunning enemies he collides with on the way. Hitting an ally just pulls him there. Pierces spell immunity.
  - Counterplay: Hide behind creeps (the hook stops on the first unit); sidestep the line; strong dispel only.
- **Armor Power** (Innate): Passive. no numeric fields in the feed.
  - What it does: Innate: +0.56% outgoing damage per point of his armor. He can self-cast to consume a Chainmail for +4 permanent armor (stackable).
  - Counterplay: Armor-reduction lowers his damage too.

#### Crystal Maiden | Intelligence | Ranged | attack range 600 | move speed 280 | [feed](https://www.dota2.com/datafeed/herodata?language=english&hero_id=5)

- **Crystal Nova**: Point Target / AoE. Magical damage; pierces immunity: no; dispellable: yes (basic dispel); cooldown 11/10/9/8 s; mana 115/135/155/175; cast point 0.3 s; cast range 700.
  - What it does: Point area (700 range, 425 radius): 110-260 magic damage and a 20-50% move, 30-75% attack-speed slow for 4 s, with vision there.
  - Counterplay: Basic dispel; spread out.
- **Frostbite**: Unit Target (enemy). Magical damage; pierces immunity: no; dispellable: yes (basic dispel); cooldown 9/8/7/6 s; mana 125/135/145/155; cast point 0.3 s; cast range 600.
  - What it does: Unit-target root (600): the target cannot move or attack for 1.5-3 s and takes 100 magic damage per second (4x to non-ancient creeps). Counts as a root, so it does not stop casting.
  - Counterplay: Basic dispel; the target can still cast spells and use items.
- **Arcane Aura**: Passive. pierces immunity: allies: yes.
  - What it does: Global passive aura: mana regen for all allies on the map, more within 1200 of her; she gets 20-80% mana regen amplification.
  - Counterplay: Break.
- **Crystal Clone** (granted by Aghanim's Shard): Point Target, instant (no queue). pierces immunity: no; cooldown 12 s; mana 150; cast point 0; cast range unlimited (global or direction only).
  - What it does: Shard ability, instant in a direction: she slides 275, disjoints incoming projectiles and leaves a crystal clone (150 health, 5 s) where she stood; when it is destroyed or times out, it shatters and Frostbites enemies in 425.
  - Counterplay: Do not stand next to the clone; hit it to pop it early from range.
- **Glacial Guard** (Innate): Passive. pierces immunity: no; dispellable: yes (basic dispel).
  - What it does: Innate: part of the mana she spends on abilities becomes a physical-damage barrier for 8 s.
  - Counterplay: Use magic damage.
- **Freezing Field**: No Target, Channeled. Magical damage; pierces immunity: no; cooldown 110/100/90 s; mana 250/425/600; cast point 0; channel 10 s; upgraded by Scepter.
  - What it does: Channeled for 10 s, no target: 100 random explosions (one per 0.1 s) in 810 radius around her, 130-250 magic damage each; all enemies in the radius are slowed 40% (move) and 80-160 (attack).
  - Aghanim's Scepter: She can move (75% slower), attack and cast while channeling it (it can still be interrupted), 20% more explosions, and anyone inside for 3 s gets Frostbite.
  - Counterplay: Interrupt her (any stun, silence or hex); walk out of the big circle; she is fragile.

#### Dark Seer | Intelligence | Melee | attack range 150 | move speed 295 | [feed](https://www.dota2.com/datafeed/herodata?language=english&hero_id=55)

- **Vacuum**: Point Target / AoE. Magical damage; pierces immunity: no; dispellable: strong dispel only; cooldown 50/42/34/26 s; mana 60/90/120/150; cast point 0.4 s; cast range 450/500/550/600.
  - What it does: Point area (450-600 range, 325-550 radius): pulls every enemy to the centre over 0.3-0.6 s, then deals 70-250 magic damage; interrupts channels and destroys trees at the centre.
  - Counterplay: Spread out; spell immunity; the 0.4 s cast point.
- **Ion Shell**: Unit Target (ally or enemy). Magical damage; pierces immunity: no; dispellable: yes (basic dispel); cooldown 9 s; mana 100/110/120/130; cast point 0.2 s; cast range 800.
  - What it does: Unit-target shield on any unit, ally or enemy (800 range), for 20-26 s: it deals 30-90 magic damage per second to Dark Seer's enemies within 275 of the shielded unit (never to the shielded unit itself), so on an enemy creep it hurts that creep's allies.
  - Counterplay: Basic dispel; stay away from the shielded unit.
- **Surge**: Unit Target (ally). pierces immunity: allies: yes; dispellable: yes (basic dispel); cooldown 24/19/14/9 s; mana 50; cast point 0.4 s; cast range 600; upgraded by Shard.
  - What it does: Unit-target on an ally (600) for 3-6 s: max move speed, free pathing and immunity to slows.
  - Aghanim's Shard: The surged unit leaves a 150-radius fire trail (7 s) that slows 35% and burns 40 per second; alt-cast disables the trail.
  - Counterplay: Roots and stuns still work; basic dispel removes it.
- **Normal Punch** (granted by Aghanim's Scepter): Passive. pierces immunity: no; cooldown 10 s.
  - What it does: Scepter passive (10 s cooldown): his next attack on a hero is a true strike that knocks a 6 s replica (60% strength) out of the victim and stuns and damages it more the farther he moved in the last 3 s (max 1.25 s and 400 damage at 1100 distance).
  - Counterplay: Avoid him after he has moved a lot.
- **Quick Wit** (Innate): Passive. no numeric fields in the feed.
  - What it does: Innate: +1 attack speed per point of Intelligence, and each level-up restores 8.5% of his max health and mana.
- **Wall of Replica**: Vector Target. pierces immunity: YES (enemies); cooldown 100 s; mana 125/250/375; cast point 0.2 s; cast range 1000.
  - What it does: Vector-targeted wall (1000 range) for 30 s: any enemy hero crossing it takes damage, a 40% slow, and spawns a replica (60% strength, 70-90% damage, takes 200% damage) that fights for Dark Seer until killed or the wall ends. Pierces spell immunity.
  - Aghanim's Scepter: Twice the wall length.
  - Counterplay: Do not cross it (go round); kill the replicas.

#### Dark Willow | Intelligence | Ranged | attack range 475 | move speed 290 | [feed](https://www.dota2.com/datafeed/herodata?language=english&hero_id=119)

- **Bramble Maze**: Point Target / AoE. Magical damage; pierces immunity: no; dispellable: yes (basic dispel); cooldown 22 s; mana 100/120/140/160; cast point 0.3 s; cast range 1000/1100/1200/1300.
  - What it does: Point area (1000-1300 range): after 0.3 s, 8 brambles grow in 500 radius for 12 s; an enemy walking into one is rooted 1-2.5 s and burned 50-65 per tick.
  - Counterplay: Walk around the visible brambles; basic dispel.
- **Shadow Realm**: No Target, instant (no queue). Magical damage; pierces immunity: no; dispellable: no; cooldown 21/19/17/15 s; mana 80/90/100/110; cast point 0; upgraded by Scepter.
  - What it does: Instant for 5 s: she becomes untargetable (disjoints projectiles, free pathing); her next attack gains 600 range and 120-360 bonus magic damage (full after 3 s) and ends the effect.
  - Aghanim's Scepter: Attacks no longer end it, each still empowered.
  - Counterplay: Untargetable but not invulnerable: area spells still hit her. Wait for the reveal attack.
- **Cursed Crown**: Unit Target (enemy). pierces immunity: no; dispellable: yes (basic dispel); cooldown 17/15/13/11 s; mana 80/90/100/110; cast point 0.2 s; cast range 700; upgraded by Shard.
  - What it does: Unit-target delayed stun: after 4 s the target and enemies within 360 are stunned 1.5-2.4 s.
  - Aghanim's Shard: Also spawns 4 brambles around the target when it goes off, even if dispelled; cooldown -1.5 s.
  - Counterplay: Move away from allies during the countdown; basic dispel removes it (except the Shard brambles).
- **Bedlam**: No Target, instant (no queue). Magical damage; pierces immunity: no; dispellable: no; cooldown 30 s; mana 100/150/200; cast point 0.
  - What it does: Instant: for 5.5 s her wisp circles her and attacks enemies within 300 every 0.25 s for 70-150 magic damage. Shares exclusivity with Terrorize.
  - Counterplay: Leave the 300 radius.
- **Pixie Dust** (Innate): Passive. no numeric fields in the feed.
  - What it does: Innate: +20% health and mana regen, +100% while she is untargetable or invulnerable.
- **Terrorize**: Point Target / AoE. Magical damage; pierces immunity: no; dispellable: yes (basic dispel); cooldown 100/90/80 s; mana 150; cast point 1 s; cast range 1200.
  - What it does: Point area (1200) with a long 1 s cast point: after a short delay, enemies in 450-550 radius are feared for 2.8-3.2 s and run toward their own fountain.
  - Counterplay: Watch the 1 s cast and the wisp's flight; basic dispel; spell immunity.

#### Dawnbreaker | Strength | Melee | attack range 150 | move speed 300 | [feed](https://www.dota2.com/datafeed/herodata?language=english&hero_id=135)

- **Starbreaker**: Point Target, self-castable. Physical damage; pierces immunity: YES (enemies); cooldown 17/15/13/11 s; mana 110; cast point 0.1 s; upgraded by Shard.
  - What it does: Point-directed combo (self-cast moves forward): for 1.1 s she walks at 215 speed and swings her hammer three times (300 radius, attack damage + 20-65; the first two briefly freeze movement), then smashes in front of her for a 0.6-1.2 s stun. Pierces spell immunity.
  - Aghanim's Shard: She is debuff immune with 50% magic resistance and free pathing during it, slowed 35%.
  - Counterplay: Back off from the front; she is slow during it; interrupt her at the start.
- **Celestial Hammer**: Point Target. Magical damage; pierces immunity: no; dispellable: yes (basic dispel); cooldown 18/16/14/12 s; mana 100/110/120/130; cast point 0.2 s.
  - What it does: Point-target throw (700-1300): the hammer damages enemies on the way out and back (50-140 magic), waits 2 s at the end, and returns leaving a fire trail that slows 24-36% and burns. She can recall it at any time (Converge), flying to meet it halfway.
  - Counterplay: Dodge the line; expect a gap-closer when the hammer is out.
- **Luminosity**: Passive. pierces immunity: allies: yes.
  - What it does: Passive: after 3 attacks her next attack is a critical hit (the feed's value is 125-200) that heals her for 35-50% of its damage and allied heroes within 650 for half that; less healing from creeps.
  - Aghanim's Scepter: Two empowered attacks per power-up.
  - Counterplay: Break stops the stacks; healing reduction.
- **Break of Dawn** (Innate): Passive. upgraded by Scepter.
  - What it does: Innate: at sunrise she gains up to +8% base damage and +15% vision, fading over the day; full all day if she caused the day herself.
  - Aghanim's Scepter: Also grants healing amplification equal to the current damage bonus.
  - Counterplay: Fight her at night.
- **Solar Guardian**: Point Target, Channeled. Magical damage; pierces immunity: YES (enemies); cooldown 110/100/90 s; mana 150/200/250; cast point 0.1 s; channel 1.7 s; upgraded by Scepter.
  - What it does: Global channel (1.7 s) at a point within 350 of any allied hero: pulses in 500 radius heal allies and damage enemies and create daylight; then she flies in and lands (0.8 s air time) for 130-190 magic damage and a 1.2-1.6 s stun. Cannot be cancelled once channeled.
  - Aghanim's Scepter: The pulsing aura follows her for 2 s after landing.
  - Counterplay: Interrupt the channel; leave the 500 circle before she lands.

#### Dazzle | Universal | Ranged | attack range 575 | move speed 305 | [feed](https://www.dota2.com/datafeed/herodata?language=english&hero_id=50)

- **Poison Touch**: Unit Target (enemy). Physical damage; pierces immunity: no; dispellable: yes (basic dispel); cooldown 24/21/18/15 s; mana 125/130/135/140; cast point 0.3 s; cast range 500/600/700/800.
  - What it does: Unit-target spell released as a cone, hitting 2-8 enemies: 16-52 physical damage per second and a 13-22% slow for 3.5-8 s; each Dazzle attack refreshes the duration and adds slow. Not reduced by damage block.
  - Counterplay: Basic dispel; spread out.
- **Shallow Grave**: Unit Target (ally). pierces immunity: allies: yes; dispellable: no; cooldown 30/26/22/18 s; mana 90/100/110/120; cast point 0.3 s; cast range 900.
  - What it does: Unit-target save on an ally (900): for 4-5.5 s its health cannot drop below 1, and its healing received is amplified more the lower it is. Culling Blade still kills through it.
  - Counterplay: Wait out the grave, then finish; disable or silence Dazzle first. Cannot be dispelled.
- **Shadow Wave**: Unit Target (ally). Physical damage; pierces immunity: YES (enemies); cooldown 10/9/8/7 s; mana 90; cast point 0.3 s; cast range 800; upgraded by Scepter.
  - What it does: Unit-target bouncing heal on allies (always also heals Dazzle, 4-7 units, 475 bounce): each healed unit deals 85-145 physical damage to enemies within 185 of it. Pierces spell immunity.
  - Aghanim's Scepter: Can target and bounce through enemies too, damaging them and healing nearby allies, and Dazzle attacks every enemy it bounces to.
  - Counterplay: Stay away from his allies when it lands.
- **Through the Realm** (granted by Aghanim's Shard): No Target, instant (no queue). cast point 0.
  - What it does: Shard ability, only during Nothl Projection: pulls his body through the spirit realm to his spirit, ending the projection there (blocked if the body is rooted or leashed).
  - Counterplay: Root the body.
- **Weave** (Innate): Passive. no numeric fields in the feed.
  - What it does: Innate: each of his abilities that affects a unit adds a 6.9 s Weave stack: +1 armor on allies, -1 armor on enemies, stacking.
  - Aghanim's Shard: Each stack on an ally also heals it.
  - Counterplay: Break stops new stacks.
- **Nothl Projection**: Point Target. dispellable: no; cooldown 70/60/50 s; mana 100/150/200; cast point 0.2 s; cast range 450; upgraded by Shard.
  - What it does: Point-target (450): his spirit leaves his body for 1-12 s as an invulnerable spirit that can attack, cast and use items, while the vulnerable body stays behind on a visible tether that pulls him back beyond 1600. While projected, Poison Touch hexes (1.4-1.8 s), Shallow Grave heals on expiry, and Shadow Wave has 30-50% less cooldown. Can be ended early.
  - Aghanim's Shard: +250 cast range and +500 leash range.
  - Counterplay: Kill the body left behind.

#### Death Prophet | Universal | Ranged | attack range 500 | move speed 295 | [feed](https://www.dota2.com/datafeed/herodata?language=english&hero_id=43)

- **Crypt Swarm**: Unit or Point Target (enemy); Shard gives 2 charges. Magical damage; pierces immunity: no; cooldown 10/9/8/7 s; mana 80/90/100/110; cast point 0.2 s; cast range 900; upgraded by Shard.
  - What it does: A cone/wave of bats (900 range) that can be cast on a unit or a point: 100-325 magic damage to every enemy in it; does not trigger spell block.
  - Aghanim's Shard: Two charges and a 0.5 s 100% slow.
  - Counterplay: Sidestep the wave.
- **Silence**: Point Target / AoE. pierces immunity: no; dispellable: yes (basic dispel); cooldown 17/15/13/11 s; mana 80/90/100/110; cast point 0.2 s; cast range 900.
  - What it does: Point area (900 range, 450 radius) fired as a projectile: silences enemies for 3.5-5 s (items still usable).
  - Counterplay: Basic dispel; spread out.
- **Spirit Siphon**: Unit Target (enemy); Charge-based: 1/2/3/4 charges, 35 s each. Magical damage; pierces immunity: YES (enemies); dispellable: no; mana 60; cast point 0.1 s; cast range 500; upgraded by Scepter.
  - What it does: Charge-based (1-4 charges, 35 s each) unit-target tether for 6 s: drains 25-100 magic damage per second from the enemy and heals her; breaks if the tether is stretched too far (inferred). Pierces spell immunity and cannot be dispelled.
  - Aghanim's Scepter: Also steals 120 attack speed and drains 2% of max health per second.
  - Counterplay: Run out of the tether range.
- **Witchcraft** (Innate): Passive. no numeric fields in the feed.
  - What it does: Innate: each attack also sends a ghost that hits for 15% of her attack damage and returns to heal her for half of it; she gains speed and ghost damage with levels.
- **Exorcism**: No Target. Physical damage; pierces immunity: YES (enemies); dispellable: no; cooldown 145/135/125 s; mana 200/300/400; cast point 0.5 s.
  - What it does: No-target ultimate: 10-26 spirits fly out from her (700 acquisition radius) and repeatedly hit enemies and buildings for physical damage, returning to her between hits; she heals 25% of the damage at the end. Pierces spell immunity.
  - Counterplay: Kite her away from your team; slows reduce how often the spirits cycle (inferred); cannot be dispelled.

#### Disruptor | Intelligence | Ranged | attack range 625 | move speed 300 | [feed](https://www.dota2.com/datafeed/herodata?language=english&hero_id=87)

- **Thunder Strike**: Unit Target (enemy). Magical damage; pierces immunity: no; dispellable: yes (basic dispel); cooldown 18/15/12/9 s; mana 115/120/125/130; cast point 0.05 s; cast range 800.
  - What it does: Unit-target (800): 4 strikes 2 s apart, each 30-120 magic damage in 260 radius and a 0.3 s full slow; gives vision of the target.
  - Aghanim's Shard: More range and strikes; can be ground-placed to lie in wait 4 s and attach to the first enemy that comes near.
  - Counterplay: Basic dispel; stay apart from the target.
- **Glimpse**: Unit Target (enemy). Magical damage; pierces immunity: no; dispellable: no; cooldown 24/22/20/18 s; mana 70/85/100/115; cast point 0.05 s; cast range 600/1000/1400/1800.
  - What it does: Unit-target (600-1800): sends the hero back to where it was 4 s ago, flying there over a time that depends on the distance, and deals 20-35% of the distance as damage (25 to 100-280); kills illusions instantly.
  - Counterplay: Use it knowing where you were 4 s ago; cannot be dispelled; Linken's blocks.
- **Kinetic Field**: Point Target / AoE. pierces immunity: no; cooldown 20/18/16/14 s; mana 70; cast point 0.05 s; cast range 900; upgraded by Shard.
  - What it does: Point area (900): after 1 s it forms a circular barrier of 350 radius for 2.6-4.4 s that enemies cannot cross either way.
  - Aghanim's Shard: Enemies touching it are struck by Electromagnetic Repulsion.
  - Counterplay: Leave the circle during the 1 s formation; debuff-immune units walk through; Force Staff and blinks cross it (inferred).
- **Kinetic Fence** (granted by Aghanim's Shard): Vector Target. pierces immunity: no; cooldown 12 s; mana 50; cast point 0.05 s; cast range 1200.
  - What it does: Shard ability, vector-targeted: a straight wall 1200 wide for 4.4 s after 0.5 s formation; enemies cannot pass, and touching it triggers Repulsion.
  - Counterplay: Walk round its ends.
- **Electromagnetic Repulsion** (Innate): Passive. dispellable: no; cooldown 5 s.
  - What it does: Innate (5 s cooldown): when he takes over 250 damage within 7 s from sources within 400, nearby enemies take 1.5x his Intelligence as damage and are pushed up to 400 away.
  - Counterplay: Burst him in one go or from range.
- **Static Storm**: Point Target / AoE. Magical damage; pierces immunity: no; dispellable: no; cooldown 100/85/70 s; mana 125/175/225; cast point 0.05 s; cast range 800; upgraded by Scepter.
  - What it does: Point area (800 range, 550 radius) for 6 s: silences enemies inside and deals magic damage in 20 pulses that grow stronger over time (up to 200-350 per pulse).
  - Aghanim's Scepter: Also mutes items.
  - Counterplay: Leave early, since late pulses hurt most; cannot be dispelled.

#### Doom | Strength | Melee | attack range 175 | move speed 290 | [feed](https://www.dota2.com/datafeed/herodata?language=english&hero_id=69)

- **Devour**: Unit Target (special); Shard gives 2 charges. dispellable: no; cooldown 66 s; mana 66; cast point 0.3 s; cast range 300; upgraded by Shard.
  - What it does: Unit-target (300) on an enemy or neutral creep: eats it, gives its bounty plus 35-140 gold, and copies its active abilities (alt-cast keeps his current ones). Doom keeps the stolen spells.
  - Aghanim's Shard: Two charges, can eat Ancients, stolen spells get 15% more area and 40% spell amplification.
  - Counterplay: Shapes his kit: watch which creep he ate.
- **Scorched Earth**: No Target. Magical damage; pierces immunity: no; dispellable: no; cooldown 45/42/39/36 s; mana 60/70/80/90; cast point 0; cast range 666.
  - What it does: No-target 666-radius burning area following Doom for 10-16 s: 20-50 magic damage per second to enemies, and +6.66 health regen and 7-10% speed for him.
  - Counterplay: Keep out of the radius; cannot be dispelled.
- **Infernal Blade**: Autocast attack modifier, Unit Target (enemy). Magical damage; pierces immunity: no; dispellable: yes (basic dispel); cooldown 13/10/7/4 s; mana 35; cast point 0; cast range 200.
  - What it does: Autocast attack modifier: a 0.66 s mini-stun and a 4 s burn of 18-66 + 0.5-4.25% max health per second. Interrupts channels.
  - Counterplay: Basic dispel for the burn.
- **Doom**: Unit Target (ally or enemy). Pure damage; pierces immunity: YES (enemies); dispellable: no; cooldown 140/130/120 s; mana 150/200/250; cast point 0.5 s; cast range 400; upgraded by Scepter.
  - What it does: Unit-target curse (400, 0.5 s cast point) for 12-16 s: a basic dispel on the target, then it cannot cast spells or receive any healing and takes 22-66 pure damage per second. Pierces spell immunity and cannot be dispelled.
  - Aghanim's Scepter: Also Breaks the target, spreads to the target's allies within 350, and can be self-cast to Doom enemies around him.
  - Counterplay: Only a spell block or Lotus Orb before it lands; items still work, so buy them before.
- **Lvl ? Pain** (Innate): Passive. no numeric fields in the feed.
  - What it does: Innate: his attacks curse enemy heroes; after 2.5 s the hero bursts in fire for 10% of the damage Doom dealt it meanwhile (66 radius), 66% stronger if the victim's level is a multiple of 6; at max level every attack curses.

#### Dragon Knight | Strength | Melee | attack range 150 | move speed 310 | [feed](https://www.dota2.com/datafeed/herodata?language=english&hero_id=49)

- **Breathe Fire**: Unit or Point Target (enemy). Magical damage; pierces immunity: no; dispellable: yes (basic dispel); cooldown 14/13/12/11 s; mana 90/95/100/105; cast point 0.2 s; cast range 1000.
  - What it does: A cone of fire (1000 range, 150 to 250 wide) cast at a unit or point: 80-320 magic damage and -20-32% attack damage for 8-11 s; does not trigger spell block.
  - Counterplay: Sidestep the cone; basic dispel.
- **Dragon Tail**: Unit Target (enemy). Magical damage; pierces immunity: no; dispellable: strong dispel only; cooldown 16/14/12/10 s; mana 70/80/90/100; cast point 0; cast range 150.
  - What it does: Melee unit-target (150) shield bash: 1.8-2.4 s stun and 60-150 magic damage to the target and units close to it; in Dragon Form it becomes ranged (cast range +350) with a projectile (inferred from the form's cast-range bonus).
  - Counterplay: Linken's blocks; strong dispel only.
- **Wyrm's Wrath**: Passive. Magical damage.
  - What it does: Passive: +10-40 magic damage on attacks and +40-100 area of effect for his spells and items.
- **Fireball** (granted by Aghanim's Shard): Point Target / AoE. Magical damage; pierces immunity: no; cooldown 20 s; mana 80; cast point 0.2 s; cast range 600.
  - What it does: Shard ability: a burning area (radius 275, 6 s) at a point that deals magic damage per second, which lingers 2 s on units that leave; shorter range in melee form.
  - Counterplay: Leave it.
- **Dragon Blood** (Innate): Passive. no numeric fields in the feed.
  - What it does: Innate: bonus health regen and armor, 50% more in Elder Dragon Form.
- **Elder Dragon Form**: No Target. Magical damage; pierces immunity: YES (enemies); dispellable: no; cooldown 100 s; mana 50; cast point 0; upgraded by Scepter.
  - What it does: Instant 60 s transformation into a ranged dragon (+350 attack range and cast range, +25-40% speed) whose attacks grow with level: Green adds a corrosive poison that also hits buildings; Red adds splash; Blue adds a frost slow on attack that pierces debuff immunity.
  - Aghanim's Scepter: One level higher, up to a Level 4 Black Dragon with free pathing, extra magic resistance and stronger bonuses.
  - Counterplay: Long duration: avoid fights during it; cannot be dispelled.

#### Drow Ranger | Agility | Ranged | attack range 625 | move speed 310 | [feed](https://www.dota2.com/datafeed/herodata?language=english&hero_id=6)

- **Frost Arrows**: Autocast attack modifier, Unit Target (enemy). Physical damage; pierces immunity: no; dispellable: yes (basic dispel); mana 9/10/11/12; cast point 0; cast range 625; upgraded by Scepter.
  - What it does: Autocast attack modifier (9-12 mana per arrow): +12-30 physical damage and a 15-45% slow that refreshes on each hit.
  - Aghanim's Scepter: Each arrow adds a Hypothermia stack (max 7, 7 s): +22 Frost Arrow damage and -13% health restoration per stack; a unit dying with stacks bursts in 650 radius for 70 per stack and a 40% slow.
  - Counterplay: The arrow is an attack projectile, so disjoints and evasion work; basic dispel removes the slow.
- **Gust**: Point Target. pierces immunity: no; dispellable: yes (basic dispel); cooldown 18/16/14/12 s; mana 55; cast point 0.25 s; cast range 900.
  - What it does: Point-direction wave (900 range, 250 wide): silences 3-6 s, knocks enemies back up to 450 (farther the closer they were to Drow) and reveals invisible units.
  - Counterplay: Sidestep the wave; basic dispel.
- **Multishot**: Point Target (directional), Channeled. Physical damage; pierces immunity: YES (enemies); cooldown 24/21/18/15 s; mana 70/85/100/115; cast point 0; channel 1.75 s.
  - What it does: Channeled for up to 1.75 s in a direction: 3 waves of 4 arrows each in a cone reaching her attack range + 475, each arrow 80-140% attack damage and Frost Arrows. She can walk slowly (35% speed) and use items while channeling. Arrow damage pierces spell immunity (Frost effects do not).
  - Counterplay: Interrupt her; leave the cone; at close range one target takes many arrows.
- **Glacier** (granted by Aghanim's Shard): No Target. Magical damage; pierces immunity: no; cooldown 25 s; mana 50; cast point 0.1 s; cast range 400.
  - What it does: Shard ability: raises an ice hill under her for 8 s, knocking nearby enemies away; units on it get flying vision, she and ranged allies on it get +200 attack range, and she gets +25 damage against units below. The front blocks vision and movement for everyone but Drow. Does not interrupt Multishot.
  - Counterplay: Come at her from the sides or with gap-closers that ignore terrain (inferred).
- **Precision Aura** (Innate): Passive. no numeric fields in the feed.
  - What it does: Innate: bonus Agility based on her Agility and level; ranged allied heroes within 1200 get half of it.
- **Marksmanship**: Passive. Physical damage; pierces immunity: YES (enemies).
  - What it does: Passive: 30-40% chance per attack for +60-90 damage, ignoring the target's base armor and never missing (true strike). Switched off while an enemy hero is within 300 of her.
  - Counterplay: Stand close to her (melee range turns it off).

#### Earth Spirit | Strength | Melee | attack range 150 | move speed 290 | [feed](https://www.dota2.com/datafeed/herodata?language=english&hero_id=107)

- **Boulder Smash**: Unit or Point Target (ally or enemy). Magical damage; pierces immunity: no; dispellable: yes (basic dispel); cooldown 20/17/14/11 s; mana 100; cast point 0; cast range 150.
  - What it does: Melee kick (150) on an enemy, ally or Stone Remnant, or at a point (kicks the nearest unit within 200, remnants first), sending it the way he faces: units travel 500-800, remnants 2000, at 900 speed, hitting enemies on the path for 110-320 magic damage; a remnant also slows 40% for 1.75-4 s.
  - Counterplay: Stay out of the line from him through his remnant.
- **Rolling Boulder**: Point Target. Magical damage; pierces immunity: no; dispellable: strong dispel only; cooldown 16/12/8/4 s; mana 50; cast point 0; cast range 3000.
  - What it does: Point-target roll (up to 800, speed 1000) after a 0.6 s gather, during which and while rolling he is untargetable and invulnerable: 60-90 + 100% Strength magic damage and a 0.3-0.9 s stun; stops on the first enemy hero. Rolling over a remnant doubles distance, speeds it up (1600) and lengthens the stun.
  - Counterplay: The 0.6 s gather shows the direction; units in the path stop him; stuns stop the roll.
- **Geomagnetic Grip**: Unit or Point Target (ally). Magical damage; pierces immunity: no; dispellable: yes (basic dispel); cooldown 13 s; mana 75; cast point 0.1 s; cast range 1000/1100/1200/1300; upgraded by Shard.
  - What it does: Unit- or point-target pull (1000-1300) of a Stone Remnant or allied unit toward him at 900 speed; enemies the pulled object hits are silenced 2.3-3.5 s, and remnants also deal 75-300 magic damage. Shorter range on allies.
  - Aghanim's Shard: 3 s cooldown, longer range and faster pull on allies.
  - Counterplay: Watch for remnants placed behind you; basic dispel removes the silence.
- **Stone Remnant** (Innate): Point Target; Charge-based: 7 charges, 18 s each. cast point 0; cast range 1100.
  - What it does: Innate, charge-based (7 charges, one per 18 s): places an invulnerable Stone Remnant (60 s, no vision) at a point (1100). Remnants are the ammunition for his other spells. He gets +3% damage per unused charge and +7.5% for 10 s when he uses a remnant.
  - Counterplay: Count the remnants: each one is a possible combo.
- **Enchant Remnant** (granted by Aghanim's Scepter): Unit Target (special). Magical damage; pierces immunity: no; dispellable: no; cooldown 45 s; mana 150; cast point 0.2 s; cast range 175.
  - What it does: Scepter ability: turns a hero (enemy at 175, ally at 500) into a Stone Remnant for 2.4 s, so he can kick, pull or roll it; then it shatters for 450 magic damage in 450 radius. On a real remnant it has only 5 s cooldown.
  - Counterplay: Spell block or Lotus; cannot be dispelled.
- **Magnetize**: No Target. Magical damage; pierces immunity: YES (enemies); dispellable: yes (basic dispel); cooldown 100/90/80 s; mana 100; cast point 0.2 s; cast range 350.
  - What it does: No-target ultimate in 350 around him: enemies take 40-120 magic damage per second for 6 s. A magnetized hero near a Stone Remnant (600) detonates it and refreshes Magnetize on everyone nearby, which can chain. Grip or Smash on one magnetized hero is shared by all of them. Pierces spell immunity.
  - Counterplay: Spread out; stay away from remnants; basic dispel removes it.

#### Earthshaker | Strength | Melee | attack range 150 | move speed 315 | [feed](https://www.dota2.com/datafeed/herodata?language=english&hero_id=7)

- **Fissure**: Point Target. Magical damage; pierces immunity: no; dispellable: strong dispel only; cooldown 18/17/16/15 s; mana 115/120/125/130; cast point 0.69 s; cast range 1600; upgraded by Shard.
  - What it does: Point-target line (1600 long) with a long 0.69 s cast point: a ridge of impassable stone for 6.5-8 s, stunning enemies on the line 1-1.6 s and dealing 100-280 magic damage. Not blocked by Linken's.
  - Aghanim's Shard: Cooldown -2 s; casting another spell sends an Aftershock along the Fissure for a shorter stun.
  - Counterplay: The long cast animation shows it; step out of the line; the wall itself can be crossed by blinks or Force Staff (inferred); strong dispel only.
- **Enchant Totem**: No Target. dispellable: yes (basic dispel); cooldown 5 s; mana 45/55/65/75; cast point 0.5 s; upgraded by Scepter.
  - What it does: No-target buff (0.5 s cast point): his next attack within 14 s gains +100 range and 100-400% bonus damage.
  - Aghanim's Scepter: Becomes point-targeted: he leaps (up to 950) and lands at the spot, casting it there; self-cast keeps the old version; attacks also cleave.
  - Counterplay: Back away while it is charged; disarm.
- **Aftershock**: Passive. Magical damage; pierces immunity: no; dispellable: strong dispel only.
  - What it does: Passive: every ability he casts (not items) deals 65-140 magic damage and a 1-1.3 s stun to enemies within 350.
  - Counterplay: Distance; strong dispel only.
- **Echo Slam**: No Target. Magical damage; pierces immunity: no; cooldown 125/115/105 s; mana 150/200/250; cast point 0.
  - What it does: Instant no-target ultimate: 100-180 magic damage to enemies within 700, then every unit hit sends an echo of 60-100 to the others (real heroes send two), so damage grows with crowd size.
  - Counterplay: Spread out and keep creeps away from heroes.
- **Slugger** (Innate): Passive. dispellable: no.
  - What it does: Innate: an enemy killed by his Totem or abilities flies as a missile (1200 range, 1600 speed), damaging enemies it hits (135 + 7% health for heroes).

#### Elder Titan | Strength | Melee | attack range 150 | move speed 305 | [feed](https://www.dota2.com/datafeed/herodata?language=english&hero_id=103)

- **Echo Stomp**: No Target, Channeled. Physical damage; pierces immunity: no; dispellable: strong dispel only; cooldown 14/13/12/11 s; mana 100; cast point 0.4 s; cast range 500; channel 1.3 s; upgraded by Shard.
  - What it does: Channeled 1.3 s (0.4 s cast point) no-target stomp, done by both Elder Titan and his Astral Spirit in 475 radius each: 65-200 damage (physical from the Titan, magic from the Spirit) and a 2-4.4 s sleep, broken after the sleeper takes 100-250 damage.
  - Aghanim's Shard: Cooldown -2 s; alt-cast swaps him to the Spirit's place as the stomp completes.
  - Counterplay: Interrupt the channel; leave both circles; strong dispel only.
- **Astral Spirit**: Point Target / AoE. Magical damage; pierces immunity: YES (enemies); dispellable: yes (basic dispel); cooldown 23/21/19/17 s; mana 80/90/100/110; cast point 0.4 s; cast range 1200; upgraded by Scepter.
  - What it does: Point-target spirit (1200) that walks to the spot (radius 275), damages units it passes, can stomp on its own, and returns after up to 10 s (or on Return Spirit), giving the Titan bonus damage and speed per unit passed (more per hero). Pierces spell immunity.
  - Aghanim's Scepter: On return he becomes debuff immune with 50% magic resistance for 2 s per enemy hero hit.
  - Counterplay: Avoid the spirit's path; it also carries the magic-resistance part of Natural Order.
- **Natural Order**: Passive aura. pierces immunity: no.
  - What it does: Passive aura (375): enemies near Elder Titan lose 40-100% of their base armor; enemies near his Astral Spirit lose 40-100% of their base magic resistance (both around him if the spirit is not out).
  - Aghanim's Shard: Enemy heroes staying inside lose additional armor and magic resistance over time, stacking.
  - Counterplay: Stay out of melee range of him and his spirit.
- **Momentum** (Innate): Passive. pierces immunity: no.
  - What it does: Innate: armor equal to 7% of his bonus move speed.
  - Counterplay: Slows reduce it.
- **Earth Splitter**: Point Target. Magical damage; pierces immunity: YES (enemies); dispellable: yes (basic dispel); cooldown 100/95/90 s; mana 125/175/225; cast point 0.4 s; cast range 2400.
  - What it does: Point-direction crack (2400 long, 315 wide): after about 2.7 s it implodes, slowing 40-50% for 3-5 s and dealing 34-50% of each enemy's max health, half magic and half physical. Pierces spell immunity.
  - Counterplay: The crack is visible for almost 3 s: step out of the line; basic dispel for the slow.

#### Ember Spirit | Agility | Melee | attack range 150 | move speed 295 | [feed](https://www.dota2.com/datafeed/herodata?language=english&hero_id=106)

- **Searing Chains**: No Target. Magical damage; pierces immunity: no; dispellable: yes (basic dispel); cooldown 13/12/11/10 s; mana 80/90/100/110; cast point 0; cast range 400.
  - What it does: Instant no-target: bolas fly to 2 random enemies within 400, rooting them for 1.25-2.75 s and dealing 100 magic damage per second. Ignores debuff-immune and invisible units.
  - Counterplay: Basic dispel; stay out of 400 when other enemies are around to share the random picks.
- **Sleight of Fist**: Point Target / AoE. Physical damage; pierces immunity: YES (enemies); cooldown 13/11/9/7 s; mana 60; cast point 0; cast range 650.
  - What it does: Point area (650 range, 250-550 radius): Ember becomes untouchable and dashes to each enemy in the circle, attacking each every 0.25 s with 80% attack plus 40-160 bonus to heroes and all attack modifiers, then returns to his start point. He can cast other spells during it.
  - Counterplay: Targets are locked on cast, so step out early; he is untargetable while dashing but returns to the start spot.
- **Flame Guard**: No Target. Magical damage; pierces immunity: no; dispellable: yes (basic dispel); cooldown 32 s; mana 65/80/95/110; cast point 0; cast range 400.
  - What it does: Instant self shield for 9-18 s: absorbs 70% of incoming magic damage up to 60-300, and burns enemies within 500 for 20-50 magic damage per second until the shield breaks.
  - Counterplay: Pop it with magic damage, or purge it (basic dispel).
- **Activate Fire Remnant**: Point Target. Magical damage; pierces immunity: no; mana 100/125/150; cast point 0.2 s; cast range unlimited (global or direction only).
  - What it does: Second half of Fire Remnant (100-150 mana, global): Ember dashes to every active remnant, each exploding for 100-270 magic damage in 450 radius, and ends at the remnant nearest to the clicked point.
  - Counterplay: Remnants are visible: stay away from them.
- **Immolation** (Innate): Passive. Magical damage; pierces immunity: no; dispellable: yes (basic dispel); upgraded by Shard.
  - What it does: Innate burn aura: 10 magic damage per second to enemies within 200 at all times.
  - Aghanim's Shard: Larger and stronger, and remnants carry it too.
  - Counterplay: Break.
- **Fire Remnant**: Point Target; Charge-based: 3 charges, 35 s each. Magical damage; pierces immunity: no; cooldown 0.5 s; cast point 0; cast range 1400; upgraded by Scepter and Shard.
  - What it does: Charge-based (3 charges, one per 35 s) point-target: sends a remnant of himself running to the spot (1400 range) at 250% of his speed; it stays 45 s until activated. A mobility, damage and escape spell in one.
  - Aghanim's Scepter: Range 3000, double initial speed, 5 charges.
  - Aghanim's Shard: A charge returns when an enemy hero dies near him, and a remnant spawns where he dies.
  - Counterplay: Track where remnants are; silence him before he activates.

#### Enchantress | Intelligence | Ranged | attack range 575 | move speed 320 | [feed](https://www.dota2.com/datafeed/herodata?language=english&hero_id=58)

- **Impetus**: Autocast attack modifier, Unit Target (enemy). Pure damage; pierces immunity: no; cooldown 6/4/2/0 s; mana 40/45/50/55; cast point 0; cast range 575.
  - What it does: Autocast attack modifier: bonus pure damage equal to 5-20% of the distance to the target (measured on impact, capped at 1750); double to illusions.
  - Counterplay: Close the distance: the damage is about range.
- **Enchant**: Unit Target (enemy). pierces immunity: no; dispellable: yes (basic dispel); cooldown 30/24/18/12 s; mana 70; cast point 0.3 s; cast range 500/600/700/800; upgraded by Scepter.
  - What it does: Unit-target (500-800): on a hero, a basic dispel plus a 30-60% slow for 3.5-5 s, and her units get more attack range against it; on a creep, she takes control of it for 45-120 s.
  - Aghanim's Scepter: She can control several creeps.
  - Counterplay: Basic dispel removes the slow.
- **Nature's Attendants**: No Target. pierces immunity: allies: yes; dispellable: no; cooldown 35 s; mana 140; cast point 0.3 s.
  - What it does: Instant: 9 wisps heal her and allies within 275 for 4-16 per wisp per second over 7-13 s, skipping units at full health.
  - Counterplay: Burst damage; healing reduction.
- **Sproink** (granted by Aghanim's Shard): No Target, instant (no queue). pierces immunity: no; cooldown 10 s; mana 60; cast point 0.
  - What it does: Shard ability: she leaps 500 backward, dodging incoming projectiles, and fires Impetus attacks at the two farthest enemies within her attack range + 100.
- **Little Friends** (granted by Aghanim's Scepter): Unit Target (enemy) / AoE. pierces immunity: no; dispellable: no; cooldown 20 s; mana 75; cast point 0; cast range 750.
  - What it does: Scepter ability: roots one enemy (2 s + 0.5 s per attacker) and makes every creep within 1200 (allied, enemy or neutral) gain speed and attack that target for 6 s.
  - Counterplay: Fight away from creeps and neutral camps.
- **Untouchable**: Passive. pierces immunity: YES (enemies); dispellable: yes (basic dispel).
  - What it does: Passive: anyone starting an attack on her gets a heavy attack-speed slow (-110 to -210). Pierces spell immunity.
  - Counterplay: Use spells instead of attacks; basic dispel removes the slow.
- **Rabble-Rouser** (Innate): Passive aura. pierces immunity: YES (enemies).
  - What it does: Innate aura: neutral creeps and units under her control deal more damage to enemy heroes (scales up, base 0).

#### Enigma | Universal | Ranged | attack range 500 | move speed 280 | [feed](https://www.dota2.com/datafeed/herodata?language=english&hero_id=33)

- **Malefice**: Unit Target (enemy). Magical damage; pierces immunity: no; dispellable: yes (basic dispel); cooldown 20/18/16/14 s; mana 100/110/120/130; cast point 0.3 s; cast range 450/500/550/600; upgraded by Shard.
  - What it does: Unit-target (450-600): three pulses 2 s apart, each a 0.3-0.9 s stun with 55-100 magic damage.
  - Aghanim's Shard: Each stun is 0.3 s longer and spawns an Eidolon next to a hero target.
  - Counterplay: Basic dispel; spell block.
- **Demonic Summoning**: Point Target. Physical damage; cooldown 45/40/35/30 s; mana 70/80/90/100; cast point 0.3 s; cast range 400.
  - What it does: Point-target summon at a health cost: 3 Eidolons (40 s, health boosted by 3% of his current health) that split into more after 6 successful attacks, healing when they do.
  - Counterplay: Kill them early with area damage.
- **Midnight Pulse**: Point Target / AoE. Magical damage; pierces immunity: YES (enemies); cooldown 40/35/30/25 s; mana 65/90/115/140; cast point 0.1 s; cast range 700.
  - What it does: Point area (700 range, 600 radius) for 9-12 s: enemies inside take 5-20 + 4-10% of their current health per second as magic damage; destroys trees. Pierces spell immunity.
  - Counterplay: Leave the area right away.
- **Event Horizon** (Innate): Passive. dispellable: no.
  - What it does: Innate: units within 600 moving away from Enigma are slowed by 5%.
- **Black Hole**: Point Target / AoE, Channeled. Pure damage; pierces immunity: YES (enemies); cooldown 180/170/160 s; mana 300/400/500; cast point 0.3 s; cast range 275; channel 4 s; upgraded by Scepter.
  - What it does: Channeled for 4 s at a point (275 range, 420 radius): enemies inside are pulled toward the centre and cannot move, attack or cast, taking 90-180 pure damage per second. Pierces spell immunity.
  - Aghanim's Scepter: Also 4% max health per second and a slow non-disabling pull in 1000 radius.
  - Counterplay: Interrupt Enigma (often hard because he blinks in first); spread out to limit how many are caught.

#### Faceless Void | Agility | Melee | attack range 150 | move speed 300 | [feed](https://www.dota2.com/datafeed/herodata?language=english&hero_id=41)

- **Time Walk**: Point Target (directional). pierces immunity: allies: yes; cooldown 21/16/11/6 s; mana 40; cast point 0.3 s; upgraded by Scepter.
  - What it does: Point-direction dash (650-800 range, 0.3 s cast point), invulnerable while dashing, that also undoes all damage he took in the last 2 s.
  - Aghanim's Scepter: Applies Time Lock to all units in 325 at the landing spot, and for 1.5 s after landing he can Reverse Time Walk to his starting point.
  - Counterplay: Burst him harder than 2 s of healing can undo; roots and leashes stop it.
- **Time Dilation**: No Target. Magical damage; pierces immunity: no; dispellable: yes (basic dispel); cooldown 24/21/18/15 s; mana 90; cast point 0.1 s; upgraded by Shard.
  - What it does: Instant 700-radius debuff for 6-9 s: enemies' ability cooldowns progress 30-60% slower; each enemy gets a stack plus one per ability on cooldown, each stack dealing damage and slowing movement and attack. Paused while inside Chronosphere.
  - Aghanim's Shard: More slow per stack, and Void gains speed stacks equal to the stacks applied.
  - Counterplay: Basic dispel; keep few spells on cooldown when he is near.
- **Time Lock**: Passive. Magical damage; pierces immunity: YES (enemies); dispellable: strong dispel only.
  - What it does: Passive: 12-24% chance per attack to freeze the target in time for 0.5 s and strike again for bonus magic damage. Pierces spell immunity.
  - Counterplay: Avoid melee range.
- **Reverse Time Walk** (granted by Aghanim's Scepter): No Target. pierces immunity: allies: yes; cooldown 0.5 s; cast point 0.
  - What it does: Scepter sub-ability: for 1.5 s after a Time Walk, sends him back to where he cast it (without healing or Time Lock).
- **Distortion Field** (Innate): Passive. no numeric fields in the feed.
  - What it does: Innate: enemy attack projectiles aimed at him or allied heroes within 1200 fly 40% slower once they are within 500 of their target.
- **Chronosphere**: Point Target / AoE. pierces immunity: YES (enemies); dispellable: no; cooldown 155/145/135 s; mana 125/200/275; cast point 0.35 s; cast range 500.
  - What it does: Point area (500 range, 500 radius) for 3.75-4.75 s: every unit and building inside except Faceless Void and his units is frozen in time, and invisible enemies are revealed; Void moves very fast inside. Pierces spell immunity, cannot be dispelled.
  - Counterplay: Spread out; be out of range of a Blink; units outside can still hit Void if he is inside.

#### Grimstroke | Intelligence | Ranged | attack range 600 | move speed 290 | [feed](https://www.dota2.com/datafeed/herodata?language=english&hero_id=121)

- **Stroke of Fate**: Point Target. Magical damage; pierces immunity: no; dispellable: yes (basic dispel); cooldown 11/9/7/5 s; mana 100/110/120/130; cast point 0.6 s; cast range 1400.
  - What it does: Point-direction ink stroke (1400 range, 0.6 s cast point) along a curve (alt-cast: straight): 100-280 magic damage, more per unit already hit, and a 50-80% slow for 1.75 s.
  - Counterplay: The cast animation warns; sidestep; basic dispel.
- **Phantom's Embrace**: Unit Target (enemy). Magical damage; pierces immunity: no; dispellable: no; cooldown 30/26/22/18 s; mana 80/100/120/140; cast point 0; cast range 900.
  - What it does: Unit-target (900): a phantom runs to the target and latches on for 5 s, silencing it and dealing damage; if it survives the whole latch it rends for 120-360 extra and refreshes its own cooldown. It dies to 2-3 hero attacks (creeps and illusions do 25%).
  - Counterplay: Allies (or the victim's own attacks, inferred) kill the phantom; going invisible or spell immune drops it.
- **Ink Swell**: Unit Target (ally). Magical damage; pierces immunity: no (allies: yes); dispellable: yes (basic dispel); cooldown 27/24/21/18 s; mana 120/130/140/150; cast point 0.15 s; cast range 650/700/750/800; upgraded by Shard.
  - What it does: Unit-target on an ally (or himself, 650-800): +20% speed for 3 s while ink tendrils damage enemies within 375; when it ends it stuns and damages enemies around the ally in proportion to how long they stayed near (up to 1.6-2.8 s and 120-360).
  - Aghanim's Shard: Basic dispels the ally, deals 40% more damage and heals the ally for 40% of it.
  - Counterplay: Run from the inked ally; basic dispel on the ally ends it.
- **Dark Portrait** (granted by Aghanim's Scepter): Unit Target (enemy). pierces immunity: YES (enemies); cooldown 40 s; mana 200; cast point 0; cast range 1200.
  - What it does: Scepter ability: makes an illusion of an enemy hero (1200 range) under Grimstroke's control for 25 s: debuff immune, 90% magic resistance, faster, 125% damage dealt, 275% taken.
  - Counterplay: Kill it with attacks.
- **Soulbind**: Unit Target (enemy) / AoE. pierces immunity: YES (enemies); dispellable: no; cooldown 70/65/60 s; mana 150/200/250; cast point 0.15 s; cast range 700/800/900.
  - What it does: Unit-target (700-900): links the enemy hero to its nearest allied hero within 600 for 6-8 s; neither can move away from the other or blink, and any unit-targeted spell cast on one is duplicated on the other. Pierces spell immunity, cannot be dispelled.
  - Counterplay: Stand apart from teammates (over 600) when he is near.
- **Ink Trail** (Innate): Passive. pierces immunity: no.
  - What it does: Innate: enemies hit by his attacks or spells leave an ink trail (vision of them) and deal 5% less damage to him for 4 s.

#### Gyrocopter | Agility | Ranged | attack range 365 | move speed 315 | [feed](https://www.dota2.com/datafeed/herodata?language=english&hero_id=72)

- **Rocket Barrage**: No Target, instant (no queue). Magical damage; pierces immunity: no; dispellable: yes (basic dispel); cooldown 7/6.5/6/5.5 s; mana 75; cast point 0.
  - What it does: Instant 3 s salvo: 10 rockets per second at random visible enemies within 400, 8-26 magic damage each.
  - Counterplay: Distance; creeps soak rockets.
- **Homing Missile**: Unit Target (enemy). Magical damage; pierces immunity: no; dispellable: strong dispel only; cooldown 26/21/16/11 s; mana 120; cast point 0; cast range 1050; upgraded by Shard.
  - What it does: Unit-target (1050) missile that accelerates toward its target and hits for 90-360 magic damage and a 1.3-2.5 s stun; it follows invisible units. Enemies can destroy it with 3 hero attacks (creeps and illusions do 25%).
  - Aghanim's Shard: The missile fires Rocket Barrage around it after 1 s, aimed at its target first.
  - Counterplay: Shoot the missile down; run so it travels further (it accelerates, so only early on); strong dispel only.
- **Flak Cannon**: No Target, instant (no queue). Physical damage; pierces immunity: YES (enemies); dispellable: no; cooldown 25 s; mana 50/60/70/80; cast point 0.
  - What it does: Instant: his next 4-7 attacks also hit every enemy within 1050 at 50% effectiveness. Pierces spell immunity.
  - Counterplay: Avoid grouping near creeps he is hitting.
- **Afterburner** (Innate): Passive. no numeric fields in the feed.
  - What it does: Innate: each hit on an enemy (attack or spell) gives a short move-speed stack (4.9 s).
- **Side Gunner** (granted by Aghanim's Scepter): Passive. Physical damage; pierces immunity: YES (enemies); cast range 700.
  - What it does: Scepter passive: a side gunner attacks a unit within 700 every 1.3 s at 75% effectiveness, farthest first, even while he is disabled.
- **Call Down**: Point Target / AoE. Magical damage; pierces immunity: no; dispellable: yes (basic dispel); cooldown 75/65/55 s; mana 150/200/250; cast point 0.3 s; cast range 1000.
  - What it does: Point area (1000): 3 missile strikes 1 s apart, each 500 further along a line, 425 radius, 200-500 magic damage and a 60% slow for 4 s. The indicator is shown only to his team.
  - Counterplay: Keep moving across the line of strikes after the first lands.

#### Hoodwink | Agility | Ranged | attack range 575 | move speed 315 | [feed](https://www.dota2.com/datafeed/herodata?language=english&hero_id=123)

- **Acorn Shot**: Unit or Point Target (enemy). Physical damage; pierces immunity: no; cooldown 19/16/13/10 s; mana 70/80/90/100; cast point 0.2 s; cast range 675/700/725/750.
  - What it does: Unit- or point-target (675-750): fires an acorn carrying her attack (80% + 45-180) that bounces 2-5 times between nearby enemies (the same one can be hit twice), each a 0.3 s full slow. Point-cast (or alt-cast) plants a tree for 20 s at the spot.
  - Counterplay: Spread out; disjointable projectile (inferred).
- **Bushwhack**: Point Target / AoE. Magical damage; dispellable: strong dispel only; cooldown 15/14/13/12 s; mana 90/100/110/120; cast point 0.2 s; cast range 1000.
  - What it does: Point area (1000 range, 275 radius) net: enemies inside who are near a tree are pulled to the nearest tree and stunned 1.4-2 s with zero vision and 90-360 damage over time. Ignores invisible units.
  - Counterplay: Stay away from trees in her area; destroying the tree frees the victim.
- **Scurry**: No Target, instant (no queue); Charge-based: 2 charges, 30/24/18/12 s each. mana 35; cast point 0; cast range 275.
  - What it does: Charge-based (2 charges, 30-12 s each), instant: +20-32% move speed, free pathing and the ability to walk through trees for 3.5-5 s.
- **Decoy** (granted by Aghanim's Scepter): No Target, instant (no queue). dispellable: yes (basic dispel); cooldown 30 s; mana 60; cast point 0.
  - What it does: Scepter ability, instant: she turns invisible and faster for 6 s and leaves a decoy that starts aiming a 60% Sharpshooter at the nearest enemy hero; if the decoy is attacked or hit by a targeted spell it dies and throws a smaller Bushwhack (1.6 s stun) at the attacker.
  - Counterplay: Do not attack the decoy in melee; True Sight.
- **Hunter's Boomerang** (granted by Aghanim's Shard): Unit or Point Target (ally or enemy). Magical damage; pierces immunity: no; dispellable: yes (basic dispel); cooldown 20 s; mana 125; cast point 0.2 s; cast range 1100.
  - What it does: Shard ability: a boomerang thrown in an arc at a unit or point (1100) that returns after contact, dealing 200 magic damage to enemies it passes and marking them for 6 s (25% slow, +15% spell damage taken).
  - Counterplay: Dodge the arc; basic dispel.
- **Sharpshooter**: Point Target. Magical damage; pierces immunity: no; dispellable: yes (basic dispel); cooldown 45 s; mana 150/200/250; cast point 0; cast range 3000; upgraded by Scepter.
  - What it does: Point-direction charge-up shot (3000 range): she charges while slowed, then fires a bolt (2200 speed) that hits the first enemy hero for up to 550-1200 magic damage, a 30-50% slow and Break for up to 5 s, all scaling with charge time (max after 3 s; auto-fires at 5 s). The recoil knocks her 350 back. Creeps hit take half.
  - Aghanim's Scepter: Faster bolt and stronger slow.
  - Counterplay: Watch her aim line, then sidestep; interrupt her while charging; put a hero between (it stops on the first hero hit).
- **Mistwoods Wayfarer** (Innate): Passive. no numeric fields in the feed.
  - What it does: Innate: 10% chance to redirect an enemy attack to a tree within 275 (destroying the tree).
  - Counterplay: Fight her away from trees.

#### Huskar | Strength | Ranged | attack range 400 | move speed 290 | [feed](https://www.dota2.com/datafeed/herodata?language=english&hero_id=59)

- **Inner Fire**: No Target. Magical damage; pierces immunity: no; dispellable: yes (basic dispel); cooldown 17/15/13/11 s; cast point 0.35 s; cast range 500.
  - What it does: No-target blast in 500 around him (0.35 s cast point), paid in health (75-150): enemies take 110-320 magic damage, are knocked back up to 400 and are disabled for 1.5-3 s. The feed conflicts here: its description says it silences, but the value is named disarm_duration (earlier patches had it disarm).
  - Counterplay: Stay out of 500; basic dispel removes the silence or disarm.
- **Burning Spear**: Autocast attack modifier, Unit Target (enemy). Magical damage; pierces immunity: no; dispellable: no; cast point 0; cast range 450.
  - What it does: Autocast attack modifier costing 2% of his max health per attack (non-lethal): each spear adds an independent, uncapped stack of burn for 9 s (4-16 + 0.5% of max health per second as magic damage).
  - Aghanim's Scepter: Throws extra spears at random enemies in his attack range.
  - Counterplay: Cannot be dispelled; break line with the ranged attacker; spell immunity blocks the burn.
- **Berserker's Blood**: Passive. upgraded by Shard.
  - What it does: Passive: the lower his health, the more attack speed (up to 170-320), health regen (a share of Strength) and magic resistance (up to 15-30%) he gets, linearly to full at 10% health.
  - Aghanim's Shard: Becomes activatable: pays 30% health, basic dispels himself, and after 3 s heals back the health spent plus 3% per debuff removed.
  - Counterplay: Burst him from high health in one go; healing reduction; break.
- **Blood Magic** (Innate): Passive. no numeric fields in the feed.
  - What it does: Innate: he has no mana; all costs are health, and item mana costs become health costs. His health costs count as magic damage and are reduced by his magic resistance.
  - Counterplay: Mana burn does nothing to him.
- **Life Break**: Unit Target (enemy). Magical damage; pierces immunity: YES (enemies); dispellable: yes (basic dispel); cooldown 16/14/12 s; cast point 0.3 s; cast range 550; upgraded by Scepter.
  - What it does: Unit-target leap (550) paid with 32-44% of his current health: he charges the target (debuff immune with 60% magic resistance during the leap) and takes 32-44% of its current health, then slows its movement 60% and attack speed for 3-5 s. Pierces spell immunity; cannot be disjointed.
  - Aghanim's Scepter: The target is also taunted to attack him for 3 s, and +250 range.
  - Counterplay: Stun him during the charge; slow wears off with a basic dispel.

#### Invoker | Intelligence | Ranged | attack range 600 | move speed 280 | [feed](https://www.dota2.com/datafeed/herodata?language=english&hero_id=74)

- **Quas**: No Target, instant (no queue). dispellable: yes (basic dispel); cast point 0; upgraded by Scepter.
  - What it does: Instant orb button (no cost, no cooldown): adds a Quas (ice) orb to his three orb slots, oldest orb dropping out. Each active Quas gives health regen; each level gives +1 Strength. Levels 1-8 (9 with Scepter) set the power of every spell built from it. Does not break invisibility and can be pressed while channeling.
  - Aghanim's Scepter: +1 level (all three orbs).
  - Counterplay: The orbs over his head show enemies which spells he can make next.
- **Wex**: No Target, instant (no queue). dispellable: no; cast point 0; upgraded by Scepter.
  - What it does: Instant orb button: adds a Wex (storm) orb; each active Wex gives move and attack speed; each level +1 Agility.
  - Aghanim's Scepter: +1 level.
  - Counterplay: As Quas.
- **Exort**: No Target, instant (no queue). dispellable: no; cast point 0; upgraded by Scepter.
  - What it does: Instant orb button: adds an Exort (fire) orb; each active Exort gives attack damage; each level +1 Intelligence.
  - Aghanim's Scepter: +1 level.
  - Counterplay: As Quas.
- **Invoke** (Innate): No Target, instant (no queue). cooldown 7 s; cast point 0.
  - What it does: Innate instant: turns the current combination of three orbs (order does not matter) into one of 10 spells and puts it in one of his two spell slots, pushing the older one out. 7 s cooldown, shorter by 0.3 s per orb level; free if it only swaps the two slots. He also picks several Scepter and Shard upgrades among his spells.
  - Counterplay: He holds at most two spells ready; pressure him while he must re-invoke.
- **Cold Snap** (sub-ability): Unit Target (enemy). Magical damage; pierces immunity: no; dispellable: yes (basic dispel); cooldown 19 s; mana 100; cast point 0.05 s; cast range 1000.
  - What it does: Invoked (QQQ), unit-target (1000): for 3-6.2 s, any damage over 10 the target takes freezes it 0.4 s and deals 28-92 extra, at most once per 0.8-0.56 s.
  - Counterplay: Basic dispel; avoid taking many small hits.
- **Ghost Walk** (sub-ability): No Target, instant (no queue). pierces immunity: no; dispellable: no; cooldown 40 s; mana 175; cast point 0.05 s; upgraded by Shard.
  - What it does: Invoked (QQW), instant: invisibility for up to 50 s with health and mana regen; enemies within 450 are slowed 20-60%, and Invoker himself is slowed or sped up by his Wex level.
  - Aghanim's Shard: Also deals 1.25x Ice Wall damage to enemy heroes in its radius.
  - Counterplay: True Sight; the slow aura reveals that he is near.
- **Tornado** (sub-ability): Point Target. Magical damage; pierces immunity: no; dispellable: yes (basic dispel); cooldown 27 s; mana 140; cast point 0.05 s; cast range 2000; upgraded by Scepter.
  - What it does: Invoked (QWW), point-direction: a fast tornado travels 1500-3900 and lifts every enemy it meets for 1.2-2.8 s (invulnerable and helpless), then deals 50 + 45-405 magic damage on landing.
  - Aghanim's Scepter: Leaves twisters on its path that keep damaging in 150 radius.
  - Counterplay: Sidestep the line; the lifted unit is invulnerable, so it is also a save for an enemy.
- **E.M.P.** (sub-ability): Point Target / AoE. Magical damage; pierces immunity: no; cooldown 27 s; mana 125; cast point 0.05 s; cast range 950; upgraded by Shard.
  - What it does: Invoked (WWW), point area (950 range, 675 radius): detonates after 2.9 s, burning 100-700 mana and dealing 60% of the burned mana as damage; Invoker regains 25% of mana burned from heroes.
  - Aghanim's Shard: 50% more damage per mana and a pull toward the centre.
  - Counterplay: Walk out during the 2.9 s; cycloned units are not affected.
- **Alacrity** (sub-ability): Unit Target (ally). Physical damage; pierces immunity: allies: yes; dispellable: yes (basic dispel); cooldown 15 s; mana 75; cast point 0.05 s; cast range 700.
  - What it does: Invoked (WWE), unit-target ally (700): +10-106 attack speed and +10-106 damage for 9 s.
  - Counterplay: Basic dispel.
- **Chaos Meteor** (sub-ability): Point Target. Magical damage; pierces immunity: no; dispellable: yes (basic dispel); cooldown 50 s; mana 200; cast point 0.05 s; cast range 700.
  - What it does: Invoked (EEW), point (700): after 1.3 s a meteor lands and rolls forward at 300 speed for 465-1725 (Wex), hitting 275 radius every 0.5 s for 55-215 magic damage plus a 3 s burn (Exort).
  - Counterplay: Walk sideways out of its rolling path; basic dispel the burn.
- **Sun Strike** (sub-ability): Point Target / AoE. Pure damage; pierces immunity: YES (enemies); cooldown 23 s; mana 175; cast point 0.05 s; upgraded by Scepter and Shard.
  - What it does: Invoked (EEE), global point area: after 1.7 s, a 175-radius beam deals 175-495 pure damage split evenly among enemies under it, with vision beforehand. Pierces spell immunity.
  - Aghanim's Scepter: Double-tap casts Cataclysm instead (90 s cooldown): two 75% Sun Strikes near every enemy hero on the map.
  - Aghanim's Shard: A Forge Spirit appears where it damages a hero.
  - Counterplay: Keep moving: a moving target is hard to hit with the 1.7 s delay; the beam's warning is visible to enemies (inferred).
- **Forge Spirit** (sub-ability): No Target. pierces immunity: no; cooldown 27 s; mana 75; cast point 0.05 s.
  - What it does: Invoked (EEQ), instant summon: 1-3 Forged Spirits (count from the lower of Quas and Exort) with range, health and duration from Quas and damage and armor from Exort; their attacks melt enemy heroes' armor. Recasting replaces them.
  - Counterplay: Kill the spirits (gold); they are frail.
- **Ice Wall** (sub-ability): No Target. Magical damage; pierces immunity: no; dispellable: no; cooldown 23 s; mana 125; cast point 0.05 s; upgraded by Scepter.
  - What it does: Invoked (QQE), instant: a 1200-long wall of ice in front of him for 3-11 s; enemies near it are slowed 30-150% and take 30-78 magic damage per second. Cannot be dispelled.
  - Aghanim's Scepter: Becomes Ice Floe: vector-targeted (600 range), forming after a delay; enemy heroes standing in it for 2.5 s are rooted and damaged.
  - Counterplay: Walk away from the wall, perpendicular to it.
- **Deafening Blast** (sub-ability): Point Target. Magical damage; pierces immunity: no; dispellable: yes (basic dispel); cooldown 36 s; mana 250; cast point 0.05 s; cast range 1000.
  - What it does: Invoked (QWE), point-direction wave (1000): 70-390 magic damage, knockback 1.1-1.9 s (Quas, undispellable) and disarm 1.5-5.5 s (Wex).
  - Counterplay: Sidestep; basic dispel the disarm.

#### Io | Universal | Ranged | attack range 500 | move speed 320 | [feed](https://www.dota2.com/datafeed/herodata?language=english&hero_id=91)

- **Tether**: Unit Target (ally). pierces immunity: allies: yes; dispellable: no; cooldown 12 s; mana 40; cast point 0; cast range 1600; upgraded by Shard.
  - What it does: Unit-target on an ally (1600; beyond 700 Io pulls itself to 300 of it): both gain speed, the ally receives 55-115% of all health and mana Io restores, and the tether line slows enemies who touch it 15-60%. Breaks if they get more than 1000 apart or Io cancels it.
  - Aghanim's Shard: The line also damages enemies (120) and heals Io for half.
  - Counterplay: Kill or stun Io to stop the healing; stay off the tether line.
- **Spirits**: No Target, instant (no queue). Magical damage; pierces immunity: no; dispellable: no; cooldown 15 s; mana 90/100/110/120; cast point 0; upgraded by Scepter.
  - What it does: Instant: 5 spirits orbit Io for 15 s at an adjustable radius (up to 650); a spirit touching an enemy hero explodes for 30-90 magic damage in 360 radius; creeps take small damage without popping them; leftovers explode at the end.
  - Aghanim's Scepter: Spirits respawn every second up to five, slow heroes they hit, and can be detonated on command.
  - Counterplay: Weave between the orbiting spirits; keep creeps between you and Io.
- **Overcharge**: No Target, instant (no queue). dispellable: no; cooldown 25/22/19/16 s; mana 40/60/80/100; cast point 0.
  - What it does: Instant 7 s self buff: +35-110 attack speed, +8-14% spell amp and health regen of 0.5-0.8% max health per second; the tethered ally gets the same.
  - Counterplay: Wait it out; break the tether.
- **Spirits In** (sub-ability): Toggle, instant (no queue). cast point 0.
  - What it does: Toggle that pulls the spirits inward while active.
- **Spirits Out** (sub-ability): Toggle, instant (no queue). cast point 0.
  - What it does: Toggle that pushes the spirits outward while active.
- **Relocate**: Point Target. dispellable: no; cooldown 90/80/70 s; mana 175; cast point 0.
  - What it does: Global point-target teleport with a 3.5-3 s cast delay: Io and the tethered ally teleport to any spot (double-click: own fountain), then both return to where they started after 12 s (Io can return earlier, inferred). Enemies see the destination marker in the world and on the minimap during the delay; a disable on Io cancels it.
  - Counterplay: Stun Io during the delay; prepare at the shown destination; break the tether.
- **Equilibrium** (Innate): Passive. dispellable: no.
  - What it does: Innate: more outgoing damage the closer Io is to full health, more health restoration and healing amplification the closer it is to zero.

#### Jakiro | Intelligence | Ranged | attack range 400 | move speed 290 | [feed](https://www.dota2.com/datafeed/herodata?language=english&hero_id=64)

- **Dual Breath**: Unit or Point Target (enemy). Magical damage; pierces immunity: no; dispellable: yes (basic dispel); cooldown 12/11/10/9 s; mana 135/150/165/180; cast point 0.35 s; cast range 850.
  - What it does: Unit- or point-target cone (850 range, 150 to 275 wide): an ice breath then a fire breath 0.2 s later, slowing movement and attack 25-40% and burning 20-80 per second for 5 s. Does not trigger spell block.
  - Counterplay: Step out of the cone; basic dispel.
- **Ice Path**: Point Target. Magical damage; pierces immunity: no; dispellable: strong dispel only; cooldown 20/17/14/11 s; mana 100; cast point 0.65 s; cast range 1100.
  - What it does: Point-direction line (1100) with a 0.65 s cast point: after 0.2 s a path of ice (radius 150) lasts 3-4.5 s and stuns enemies touching it 1.25-2 s (50 damage).
  - Counterplay: The cast animation and growing path give a short warning; side-step it; strong dispel only.
- **Liquid Fire**: Autocast attack modifier, Unit Target (enemy) / AoE. Magical damage; pierces immunity: no; dispellable: yes (basic dispel); cooldown 13/10/7/4 s; mana 20; cast point 0; cast range 600; upgraded by Shard.
  - What it does: Autocast attack modifier (20 mana): the next attack splashes fire in 300 radius, -30-60 attack speed and 12-48 magic damage per second for 5 s; works on buildings. Shares cooldown with Liquid Frost.
  - Aghanim's Shard: No mana cost and no shared cooldown.
  - Counterplay: Spread out; basic dispel.
- **Liquid Frost**: Autocast attack modifier, Unit Target (enemy). Magical damage; pierces immunity: no; dispellable: yes (basic dispel); cooldown 13/10/7/4 s; mana 20; cast point 0; cast range 600; upgraded by Shard.
  - What it does: Autocast attack modifier: the next attack slows movement 15-30% for 5 s, deals 8-32 and makes each of Jakiro's attacks and spells hit the target for 8-32 extra.
  - Aghanim's Shard: No mana cost and no shared cooldown.
  - Counterplay: Basic dispel.
- **Double Trouble** (Innate): Passive. dispellable: no.
  - What it does: Innate: each attack is two attacks, one from each head, each at half damage (the second ignores damage block).
- **Macropyre**: Point Target. Magical damage; pierces immunity: no; dispellable: no; cooldown 90/80/70 s; mana 225/325/425; cast point 0.4 s; cast range 1400; upgraded by Scepter.
  - What it does: Point-direction line of fire (1400, 500 wide) lasting 10 s: 100-180 magic damage per second to enemies inside (1 s lingering after leaving). Cannot be dispelled.
  - Aghanim's Scepter: +5 s, pure damage, pierces spell immunity, and two ice walls along its edges slow anyone crossing by 60%.
  - Counterplay: Leave the line by the short way (across it).

#### Juggernaut | Agility | Melee | attack range 150 | move speed 305 | [feed](https://www.dota2.com/datafeed/herodata?language=english&hero_id=8)

- **Blade Fury**: No Target, instant (no queue). Magical damage; pierces immunity: no; dispellable: no; cooldown 30/26/22/18 s; mana 110; cast point 0; upgraded by Scepter.
  - What it does: Instant 5 s spin (260 radius): 85-175 magic damage per second to nearby enemies, while he is debuff immune with 80% magic resistance; a basic dispel at start and end. He can walk and use items.
  - Aghanim's Scepter: He can also attack while spinning and moving, at 75% damage.
  - Counterplay: Walk out of the 260 radius and wait 5 s; magic damage is mostly wasted on him, physical attacks are not; it cannot be dispelled.
- **Healing Ward**: Point Target / AoE. pierces immunity: allies: yes; cooldown 60 s; mana 120; cast point 0.3 s; cast range 350; upgraded by Shard.
  - What it does: Point-target summon (350): a mobile ward (325 speed, 1 hero hit to kill) heals allies within 400 by 2-5% of max health per second.
  - Aghanim's Shard: More healing and health.
  - Counterplay: Kill the ward with one attack.
- **Blade Dance**: Passive. no numeric fields in the feed.
  - What it does: Passive: 35% chance of a 140-200% critical strike on attacks and on Blade Fury ticks.
  - Counterplay: Evasion, armor.
- **Bladeform** (Innate): Passive. no numeric fields in the feed.
  - What it does: Innate: every 2 s without taking damage gives a stack (max 10) of +2.5% base Agility and +1% move speed; stacks fade 2 s after he takes damage.
  - Counterplay: Poke him to remove the stacks.
- **Omnislash**: Unit Target (enemy). Physical damage; pierces immunity: YES (enemies); dispellable: no; cooldown 120 s; mana 200/275/350; cast point 0.3 s; cast range 450.
  - What it does: Unit-target (450): Juggernaut leaps to the target and becomes invulnerable for 3-3.5 s, slashing random enemies within 425 (target included) at a rate set by his attack speed, with +25-35 damage and +40 attack speed. Pierces spell immunity; he can use items during it.
  - Counterplay: Stand near creeps to dilute the slashes; ghost form or evasion; reach him after it ends.

#### Keeper of the Light | Intelligence | Ranged | attack range 600 | move speed 310 | [feed](https://www.dota2.com/datafeed/herodata?language=english&hero_id=90)

- **Illuminate**: Point Target, Channeled. Magical damage; pierces immunity: no; cooldown 13 s; mana 100/125/150/175; cast point 0; cast range 1800; channel 3 s.
  - What it does: Channeled (up to 3 s) in a direction: power builds with channel time, then a wave (400 radius, 1550 range) travels out for up to 185-500 magic damage and vision.
  - Counterplay: The light gathering in front of him is visible: move out of the line; interrupt him.
- **Blinding Light**: Point Target / AoE. Magical damage; pierces immunity: no; dispellable: yes (basic dispel); cooldown 24/21/18/15 s; mana 120/130/140/150; cast point 0.3 s; cast range 500/575/650/725.
  - What it does: Point area (500-725 range, 425-500 radius): pushes enemies to the edge (at least 175 over 0.6 s), deals 90-240 magic damage and makes them miss 45% of attacks for 4 s.
  - Counterplay: Basic dispel; True Strike.
- **Chakra Magic**: Unit Target (ally). pierces immunity: allies: yes; cooldown 20/17/14/11 s; cast point 0.3 s; cast range 900.
  - What it does: Unit-target ally or self (900): restores 105-300 mana and cuts the remaining cooldown of all basic spells by 2.5-5.5 s; 30% stronger on himself.
- **Solar Bind** (sub-ability): Unit Target (enemy); Shard gives 2 charges. pierces immunity: no; dispellable: yes (basic dispel); cooldown 14 s; mana 120; cast point 0.2 s; cast range 750; upgraded by Shard.
  - What it does: Unit-target (750) debuff for 6 s: -16-32% magic resistance and a slow that grows the more the target moves.
  - Aghanim's Shard: Two charges.
  - Counterplay: Basic dispel; stand still.
- **Will-O-Wisp** (granted by Aghanim's Scepter): Point Target / AoE. Magical damage; pierces immunity: no; dispellable: yes (basic dispel); cooldown 55 s; mana 150; cast point 0.1 s; cast range 800.
  - What it does: Scepter ability, point (800): an Ignis Fatuus wisp for about 13 s that flicks on and off; while on, it gently pulls enemies within 725 toward it (without disabling) and hits them (8 hits of 85).
  - Counterplay: Kill it with hero attacks; walk against the pull.
- **Spirit Form**: No Target. dispellable: no; cooldown 85/80/75 s; mana 75/125/175; cast point 0; upgraded by Shard.
  - What it does: Instant 40-50 s form: +100-200 cast range, a bigger speed bonus from Bright Speed, and Illuminate is channeled by a separate spirit (so he can move) and also heals allies.
  - Aghanim's Shard: More Illuminate healing.
  - Counterplay: Find the real Keeper while his spirit channels.
- **Bright Speed** (Innate): Passive. no numeric fields in the feed.
  - What it does: Innate: +1 move speed per 3 Intelligence; every 300 distance moved leaves a light spot giving 400 vision for 3 s.

#### Kez | Agility | Melee | attack range 225 | move speed 310 | [feed](https://www.dota2.com/datafeed/herodata?language=english&hero_id=145)

- **Echo Slash**: No Target. Physical damage; cooldown 21/18/15/12 s; mana 75/90/105/120; cast point 0.2 s.
  - What it does: Katana, no-target forward slash in an 800 line (radius 200): attack damage plus 30-75, a brief 100% slow, and a second strike in the same area 1.2 s later; cuts trees.
  - Counterplay: Step out of the line before the echo hits.
- **Grappling Claw**: Unit Target (enemy). pierces immunity: no; cooldown 13/11/9/7 s; mana 40; cast point 0; cast range 650/750/850/950.
  - What it does: Katana, unit-target swing (650-950) to an enemy or a tree: the hooked enemy is slowed 70-100% briefly, and Kez arrives and attacks it.
  - Counterplay: Keep away from trees near him; disables.
- **Kazurai Katana**: Unit Target (enemy). Physical damage; pierces immunity: YES (enemies); dispellable: yes (basic dispel); cooldown 24/18/12/6 s; mana 40; cast point 0; cast range 200; upgraded by Shard.
  - What it does: Katana passive with an active: Katana hits and abilities add a 7 s bleed of 3-12% of the hit's damage, stacking. Active: an attack that impales the target (cannot move or turn, 0.5 s) and bursts part of the bleed stacks at once. Pierces spell immunity.
  - Aghanim's Shard: Impale lifesteals 100% and stuns if done from behind; more burst stacks.
  - Counterplay: Disengage to let the bleed run out; basic dispel.
- **Switch Discipline** (Innate): No Target, instant (no queue). cooldown 8 s; cast point 0; upgraded by Scepter.
  - What it does: Innate stance swap (8 s cooldown) between Katana (225 range, slower, bonus damage on the first Katana hit after switching, abilities Echo Slash / Grappling Claw / Kazurai Katana / Raptor Dance) and Sai (150 range, faster, burst of speed on switching, abilities Falcon Rush / Talon Toss / Shodo Sai / Raven's Veil). The paired abilities level together and share cooldowns.
  - Aghanim's Scepter: The first weapon ability within 3 s of switching does not put its twin on cooldown, and every weapon ability refreshes the switch cooldown.
  - Counterplay: Track which weapon he holds: each set has a different threat.
- **Raptor Dance**: AoE / No Target. Physical damage; pierces immunity: YES (enemies); cooldown 40/35/30 s; mana 100/125/150; cast point 1 s.
  - What it does: Katana ultimate, no-target with a 1 s cast during which he is uncontrollable (invulnerable for the first 0.2 s, basic dispel): if not interrupted, 4 radial slashes in 425 deal 50-150 + 2.75-3.75% max health each with 100% lifesteal. Pierces spell immunity.
  - Counterplay: Interrupt him during the 1 s cast (after the 0.2 s invulnerability); leave 425 radius.
- **Falcon Rush** (sub-ability): No Target, instant (no queue). dispellable: yes (basic dispel); cooldown 21/18/15/12 s; mana 85/90/95/100; cast point 0.
  - What it does: Sai, instant 3.75-6 s state: his attacks make him dash (up to 525, speed 850) to enemies and land extra echo attacks at reduced damage; free pathing and 15-60% slow resistance.
  - Counterplay: Disarm or kite with disables.
- **Talon Toss** (sub-ability): Unit Target (enemy) / AoE. Physical damage; pierces immunity: no; cooldown 13/11/9/7 s; mana 60/65/70/75; cast point 0.2 s; cast range 650/750/850/950.
  - What it does: Sai, unit-target throw (650-950): a true-strike attack worth 60-240 and a 2-2.75 s silence.
  - Counterplay: Basic dispel; Linken's.
- **Shodo Sai** (sub-ability): Point Target, instant (no queue). pierces immunity: YES (enemies); dispellable: strong dispel only; cooldown 24/18/12/6 s; mana 30/20/10/0; cast point 0; upgraded by Shard.
  - What it does: Sai passive with an active: 24% chance to crit (125-200%). Active (directional): for 1.5 s he disarms himself and parries all attacks from the chosen direction; a parried hero is stunned 0.4 s and Marked, and his next hit on a Marked target is a sure crit with a stun.
  - Aghanim's Shard: Stronger Mark from parries.
  - Counterplay: Do not attack into the parry; attack from another side or use spells.
- **Raven's Veil** (sub-ability): No Target. pierces immunity: YES (enemies); dispellable: strong dispel only; cooldown 40/35/30 s; mana 100/125/150; cast point 0.3 s.
  - What it does: Sai ultimate, no-target: a smoke wave out to 1500 marks enemy heroes and cuts their vision for 4 s; Kez is basic-dispelled and becomes invisible with +15-35% speed until he attacks or casts. Pierces spell immunity.
  - Counterplay: True Sight; group up.

#### Kunkka | Strength | Melee | attack range 150 | move speed 315 | [feed](https://www.dota2.com/datafeed/herodata?language=english&hero_id=23)

- **Torrent**: Point Target / AoE. Magical damage; pierces immunity: no; dispellable: yes (basic dispel); cooldown 16/14/12/10 s; mana 90; cast point 0.4 s; cast range 1300.
  - What it does: Point area (1300 range, 250 radius): after 1.6 s a geyser hurls enemies up, stunning 1.4 s (they can still be hit), dealing 110-320 magic damage and slowing 40% for 1-4 s. The bubbles before it are only visible to his team.
  - Counterplay: Keep moving: a moving target is hard to hit with a 1.6 s delay.
- **Tidebringer**: Autocast attack modifier, Unit Target (enemy). Physical damage; cooldown 13/10/7/4 s; cast point 0; cast range 150.
  - What it does: Autocast attack modifier on a 13-4 s cooldown: the next attack gains +35-140 damage and cleaves 150% in a huge cone (650-1025 long).
  - Counterplay: Do not stand in a line behind creeps he is hitting.
- **X Marks the Spot**: Unit Target (ally or enemy). pierces immunity: no; dispellable: no; cooldown 24/20/16/12 s; mana 50; cast point 0.4 s; cast range 675/750/875/1000.
  - What it does: Unit-target on an enemy or allied hero (675-1000): marks its position and after 3 s (6 s on allies) returns it there; Kunkka can trigger the return early. Cannot be dispelled.
  - Counterplay: Expect the snap-back; set up combos (Torrent at the X).
- **Admiral's Rum** (Innate): Passive. cooldown 50.5 s.
  - What it does: Innate (50.5 s cooldown): when damage from heroes, buildings or Roshan would take him below 65% health, he drinks, gaining speed, and 18% of incoming damage for 5 s is delayed and taken later; that delayed damage cannot kill.
  - Counterplay: Burst him after the rum ends.
- **Tidal Wave** (granted by Aghanim's Shard): Point Target. Magical damage; pierces immunity: no; dispellable: yes (basic dispel); cooldown 12 s; mana 75; cast point 0.2 s; cast range 1050.
  - What it does: Shard ability: a wave that starts behind Kunkka and travels toward a point (750 wide, 1800 long), dealing 180 magic damage and dragging enemies along (they cannot attack while dragged).
  - Counterplay: Sidestep; it is wide.
- **Ghostship**: Point Target (directional). Magical damage; pierces immunity: no; dispellable: no; cooldown 90/80/70 s; mana 125/175/225; cast point 0.3 s; cast range 1000; upgraded by Scepter.
  - What it does: Point-direction: a ghost ship sails from behind Kunkka (2000 distance, 450 wide, speed 650) and crashes at the point after about 3.1 s, stunning enemies there 1.2 s and dealing magic damage. Allies it touches get a double-strength Rum (delayed damage, speed).
  - Aghanim's Scepter: A fleet of two ships 2.5 s apart, each firing cannonballs sideways and forward for 40% of its damage.
  - Counterplay: Watch the ship and leave its landing zone.

#### Largo | Strength | Melee | attack range 150 | move speed 290 | [feed](https://www.dota2.com/datafeed/herodata?language=english&hero_id=155)

- **Catchy Lick**: Unit Target (ally or enemy). Magical damage; pierces immunity: no; cooldown 15/12/9/6 s; mana 80/85/90/95; cast point 0.2 s; cast range 700.
  - What it does: Unit-target tongue (700) on an enemy or ally (or a rune): pulls it toward Largo (235-325 for enemies, 375 for allies) with a basic dispel, and deals 85-340 magic damage to enemies. Killing it or removing an effect gives Largo health regen for 8 s.
  - Counterplay: Linken's; stay out of range.
- **Frogstomp**: Point Target / AoE. Magical damage; pierces immunity: no; cooldown 20/18/16/14 s; mana 85/95/105/115; cast point 0.2 s; cast range 800.
  - What it does: Point area (800 range, 350 radius): froglings stomp once per second for 4-7 s, each stomp dealing 36-72 magic damage and a mini-stun, and slowing 12-30%.
  - Counterplay: Leave the area quickly.
- **Croak of Genius**: Unit Target (ally). Magical damage; dispellable: yes (basic dispel); cooldown 25 s; mana 40; cast point 0.2 s; cast range 800.
  - What it does: Unit-target on an allied hero (800) for 15-30 s: 15% cheaper spells and items, and 25-40% of the ally's spell damage echoes again over 5 s; each spending of mana takes 0.5 s off the buff (not on Largo).
  - Counterplay: Basic dispel it off the ally.
- **Encore** (Innate): Passive. upgraded by Shard.
  - What it does: Innate: buffs Largo puts on himself or allies last 15% longer.
  - Aghanim's Shard: Unit-target buffs on an ally are copied to Largo; when he targets himself, the nearest ally also gets them.
- **Amphibian Rhapsody**: Toggle, instant (no queue). Magical damage; cooldown 1.5 s; cast point 0; upgraded by Scepter.
  - What it does: Toggle ultimate (1.5 s cooldown): Largo is disarmed and his bar switches to three songs, which work only if pressed on a 1 s beat. Each on-beat strum gives a Groovin' stack (max 5: +2-4 armor each, cheaper songs); a missed beat removes one. Items still work.
  - Aghanim's Scepter: He can play two songs on the same beat.
  - Counterplay: Disarmed while singing: pressure him; silence ends the songs (inferred).
- **Bullbelly Blitz** (sub-ability): No Target, instant (no queue). Magical damage; cooldown 0.2 s; mana 25/35/45; cast point 0; upgraded by Scepter.
  - What it does: Song (on the beat): 24-50 magic damage around him and, for allies nearby, more spell amplification and magic damage on attacks for a second.
  - Aghanim's Scepter: Extra damage per Groovin' stack when double-strummed.
  - Counterplay: Distance from Largo.
- **Hotfeet Hustle** (sub-ability): No Target, instant (no queue). cooldown 0.2 s; mana 25/35/45; cast point 0.
  - What it does: Song: nearby allies get a burst of move speed and brief 70-80% slow resistance.
- **Island Elixir** (sub-ability): No Target, instant (no queue). cooldown 0.2 s; mana 25/35/45; cast point 0.
  - What it does: Song: heals nearby allied heroes 30-80 per beat.
  - Counterplay: Burst through the heal; silence him.

#### Legion Commander | Strength | Melee | attack range 150 | move speed 325 | [feed](https://www.dota2.com/datafeed/herodata?language=english&hero_id=104)

- **Overwhelming Odds**: AoE / No Target. Magical damage; pierces immunity: no; dispellable: yes (basic dispel); cooldown 18 s; mana 90/105/120/135; cast point 0.3 s; upgraded by Shard.
  - What it does: No-target blast in 600 around her: 40-130 magic damage plus more per enemy hero and unit inside, a 0.3 s full slow, and +50-125 attack speed for her for 6 s.
  - Aghanim's Shard: Larger radius and a damage barrier from the damage dealt to heroes.
  - Counterplay: Spread out and keep creeps away from heroes.
- **Press The Attack**: Unit Target (ally). pierces immunity: allies: no; dispellable: yes (basic dispel); cooldown 16/15/14/13 s; mana 90; cast point 0.2 s; cast range 700; upgraded by Scepter.
  - What it does: Unit-target on an ally or herself (700): a strong dispel plus move speed and 24-60 health regen for 5 s.
  - Aghanim's Scepter: Faster, 500-radius area, always includes her.
  - Counterplay: Disable after the dispel.
- **Moment of Courage**: Passive. cooldown 0.3 s.
  - What it does: Passive counter: after she is attacked 7-4 times, she instantly counter-attacks her attacker with 55-85% lifesteal (0.3 s cooldown).
  - Counterplay: Avoid long trades.
- **Outfight Them!** (Innate): Passive. no numeric fields in the feed.
  - What it does: Innate: whenever she or an allied hero within 1200 casts an ability, that hero gains +1 armor for 6 s (allies 50%), stacking independently.
- **Duel**: Unit Target (enemy). pierces immunity: YES (enemies); dispellable: no; cooldown 60/55/50 s; mana 80/100/120; cast point 0.3 s; cast range 200; upgraded by Scepter.
  - What it does: Unit-target (200) on an enemy hero: for 4-5 s both must attack only each other; neither can use items and the target cannot cast. The winner (if one dies) gains permanent bonus damage (+10-30 for her). Pierces spell immunity; ends if they are pushed 2000 apart.
  - Aghanim's Scepter: Winning a Duel casts Press the Attack around her.
  - Counterplay: Linken's or Lotus; avoid her Blink range; allies can save the target with spells (Glimpse, saves) since only the dueled pair is locked.

#### Leshrac | Intelligence | Ranged | attack range 575 | move speed 325 | [feed](https://www.dota2.com/datafeed/herodata?language=english&hero_id=52)

- **Split Earth**: Point Target / AoE. Magical damage; pierces immunity: no; dispellable: strong dispel only; cooldown 11 s; mana 80/100/120/140; cast point 0.7 s; cast range 650; upgraded by Shard.
  - What it does: Point area (650 range, 150-210 radius) with a long 0.7 s cast point: after 0.35 s more, the ground splits, stunning 1.7 s with magic damage; cuts trees.
  - Aghanim's Shard: Repeats twice at the same spot, 5 s apart and 45 bigger each time, visible to both teams.
  - Counterplay: The long cast animation is the warning: keep moving; strong dispel only.
- **Diabolic Edict**: No Target. Pure damage; pierces immunity: YES (enemies); dispellable: no; cooldown 22/21/20/19 s; mana 90/120/150/180; cast point 0.5 s.
  - What it does: No-target 8 s: 40 explosions hit random enemy units and buildings within 450 for 9-30 pure damage each; fewer targets means more hits on each. Continues if he dies. Pierces spell immunity.
  - Counterplay: Stand among creeps to share the hits; leave the radius.
- **Lightning Storm**: Unit Target (enemy). Magical damage; pierces immunity: no; dispellable: yes (basic dispel); cooldown 4 s; mana 80/100/120/140; cast point 0.3 s; cast range 600.
  - What it does: Unit-target (600, 4 s cooldown): lightning hits the target then jumps to 5-11 more enemies within 450, each 90-240 magic damage and a 75% slow for 0.45-1.2 s.
  - Counterplay: Spread out; basic dispel.
- **Nihilism** (granted by Aghanim's Scepter): No Target, instant (no queue). pierces immunity: no; dispellable: no; cooldown 25 s; mana 125; cast point 0.
  - What it does: Scepter ability, instant 4 s aura (550): disarms nearby enemies and keeps dispelling them, while also keeping Leshrac dispelled.
  - Counterplay: Leave the aura.
- **Defilement** (Innate): Passive. no numeric fields in the feed.
  - What it does: Innate: +0.6 area of effect per point of Intelligence for his spells.
- **Pulse Nova**: Toggle. Magical damage; pierces immunity: no; dispellable: no; cooldown 1 s; mana 50/60/70; cast point 0.
  - What it does: Toggle: while on, a pulse every second hits all enemies within 500 for 80-180 magic damage, draining 20-60 mana per second.
  - Counterplay: Mana burn or silence (inferred: silence does not turn off a toggle already on, unconfirmed); stay out of 500.

#### Lich | Intelligence | Ranged | attack range 550 | move speed 290 | [feed](https://www.dota2.com/datafeed/herodata?language=english&hero_id=31)

- **Frost Blast**: Unit Target (enemy) / AoE. Magical damage; pierces immunity: no; dispellable: yes (basic dispel); cooldown 7 s; mana 105/120/135/150; cast point 0.3 s; cast range 650.
  - What it does: Unit-target (650): 40-160 magic damage to the target plus 80-200 in 200 radius, and a slow of 25% movement and 30-60 attack speed.
  - Counterplay: Basic dispel.
- **Frost Shield**: Unit Target (ally). Magical damage; pierces immunity: no (allies: yes); dispellable: yes (basic dispel); cooldown 30/25/20/15 s; mana 100/110/120/130; cast point 0.2 s; cast range 800.
  - What it does: Unit-target on an ally or building (800) for 4-7 s: 45-60% less damage from attacks, and each second frost pulses around it dealing damage and a slow to nearby enemies.
  - Counterplay: Use spells instead of attacks; basic dispel.
- **Sinister Gaze**: Unit Target (enemy), Channeled. pierces immunity: no; dispellable: yes (basic dispel); cooldown 24/22/20/18 s; mana 25; cast point 0; cast range 600; channel 1.1/1.4/1.7/2 s; upgraded by Scepter.
  - What it does: Unit-target channel for 1.1-2 s: the target walks toward Lich (32-50% of the way) and loses 25% of its current mana.
  - Aghanim's Scepter: 400-radius area version, and Lich can cast other spells while channeling.
  - Counterplay: Interrupt Lich; Linken's; basic dispel.
- **Ice Spire** (granted by Aghanim's Shard): Point Target / AoE. pierces immunity: no; dispellable: no; cooldown 25 s; mana 150; cast point 0.3 s; cast range 750.
  - What it does: Shard ability: an ice spire at a point (750) for 15 s, slowing enemies in 550; 4 hero hits destroy it, which releases a Frost Blast. Chain Frost can bounce to it; Frost Shield heals it.
  - Counterplay: Kill it when no allies are near it (Chain Frost bounce).
- **Sacrifice** (Innate): Unit Target (ally); Charge-based: 3 charges, 120 s each. cast point 0.4 s; cast range 700.
  - What it does: Innate charge-based (3 charges, 120 s each, starts empty): kills an allied creep (700) to turn 42% of its health into mana for Lich and 69% of its experience for him; it counts as a deny.
- **Chain Frost**: Unit Target (enemy). Magical damage; pierces immunity: no; dispellable: yes (basic dispel); cooldown 100/80/60 s; mana 180/300/420; cast point 0.3 s; cast range 750.
  - What it does: Unit-target orb (750, speed 850) that bounces up to 10 times between enemies within 550, each hit 250-500 magic damage (+20 per bounce) and a 65% movement and attack slow for 2.5 s; with no new target it lingers and waits. Cannot be disjointed.
  - Counterplay: Spread out more than 550 apart; spell immunity.

#### Lifestealer | Strength | Melee | attack range 150 | move speed 320 | [feed](https://www.dota2.com/datafeed/herodata?language=english&hero_id=54)

- **Rage**: No Target, instant (no queue). dispellable: no; cooldown 21/20/19/18 s; mana 80/100/120/140; cast point 0.
  - What it does: Instant 3-6 s: debuff immune, 80% magic resistance and +6-15% speed, with a basic dispel.
  - Counterplay: Physical damage and kiting.
- **Open Wounds**: Unit Target (enemy). pierces immunity: no; dispellable: yes (basic dispel); cooldown 30/25/20/15 s; mana 90; cast point 0.2 s; cast range 300/400/500/600.
  - What it does: Unit-target (300-600) for 7 s: a 50% slow that fades in steps, and every ally attacking the target heals 20-50% of the damage dealt.
  - Counterplay: Basic dispel.
- **Feast**: Passive. Physical damage; pierces immunity: YES (enemies); dispellable: no.
  - What it does: Passive: attacks deal 1.45-3.25% of the target's max health as extra physical damage and heal him the same; +1 permanent max health per creep killed, +10 per hero. Pierces spell immunity.
  - Counterplay: High-health heroes feed him; break stops it.
- **Ghoul Frenzy** (Innate): Passive. pierces immunity: no; dispellable: yes (basic dispel).
  - What it does: Innate: bonus attack speed.
- **Infest**: Unit Target (special). Magical damage; pierces immunity: allies: yes; dispellable: no; cooldown 80/65/50 s; mana 100/125/150; cast point 0.2 s; cast range 150; upgraded by Scepter and Shard.
  - What it does: Unit-target (150) on an allied unit or an enemy/neutral creep: Lifestealer hides inside it (undetectable, not targetable), healing part of his max health per second; on a creep he controls it; he can burst out for 150-400 magic damage in 600.
  - Aghanim's Scepter: Range 250, cooldown 20 s, and can infest an enemy hero for a short time, attacking it from inside with faster regen.
  - Aghanim's Shard: The burst applies a 3 s Open Wounds; eating a creep drenches enemies in blood that burns them.
  - Counterplay: Kill the host (he pops out); stay away when an ally he hides in dives.

#### Lina | Intelligence | Ranged | attack range 670 | move speed 290 | [feed](https://www.dota2.com/datafeed/herodata?language=english&hero_id=25)

- **Dragon Slave**: Unit or Point Target (enemy). Magical damage; pierces immunity: no; cooldown 11/10/9/8 s; mana 90/100/110/120; cast point 0.35 s; cast range 1075.
  - What it does: Unit- or point-target wave of fire in a line (1075 cast range, reaches about 1225): 65-245 magic damage to every enemy on the path. Does not trigger spell block.
  - Counterplay: Sidestep the line.
- **Light Strike Array**: Point Target / AoE. Magical damage; pierces immunity: no; dispellable: strong dispel only; cooldown 13/11/9/7 s; mana 100/110/120/130; cast point 0.45 s; cast range 700.
  - What it does: Point area (700 range, 250 radius) with a 0.45 s cast point and 0.5 s delay: 80-215 magic damage and a 1.2-2.4 s stun; cuts trees.
  - Counterplay: Nearly 1 s of warning: keep moving; strong dispel only.
- **Fiery Soul**: Passive. dispellable: no.
  - What it does: Passive: each enemy hit by her spells gives a 16 s stack (max 7) of +7-28 attack speed and +1-2.5% move speed, refreshing.
- **Flame Cloak** (granted by Aghanim's Scepter): No Target, instant (no queue). dispellable: no; cooldown 25 s; mana 50; cast point 0.
  - What it does: Scepter ability, instant 7 s: free pathing over terrain, +30% spell amplification and +35% magic resistance.
  - Counterplay: Wait it out.
- **Slow Burn** (Innate): Passive. Magical damage.
  - What it does: Innate: her abilities deal an extra 64% of their damage as a burn over 4 s.
  - Counterplay: Healing outlasts the burn.
- **Laguna Blade**: Unit Target (enemy). Magical damage; pierces immunity: no; cooldown 70/60/50 s; mana 150/300/450; cast point 0.3 s; cast range 750; upgraded by Shard.
  - What it does: Unit-target bolt (750): 360-690 magic damage after a 0.25 s delay (which lets some spells dodge it).
  - Aghanim's Shard: Casting it gives her 12 Fiery Soul stacks for 5 s.
  - Counterplay: Linken's, Lotus Orb, magic resistance or spell immunity; a well-timed disjoint in the 0.25 s window.

#### Lion | Intelligence | Ranged | attack range 600 | move speed 290 | [feed](https://www.dota2.com/datafeed/herodata?language=english&hero_id=26)

- **Earth Spike**: Unit or Point Target (enemy). Magical damage; pierces immunity: no; dispellable: strong dispel only; cooldown 14/13/12/11 s; mana 90/110/130/150; cast point 0.3 s; cast range 650.
  - What it does: Unit- or point-target line of spikes (650, moving 2800/s): lifts enemies, then 1.3-2.2 s stun and 105-300 magic damage on landing. Does not trigger spell block.
  - Counterplay: Very fast: sidestep only from range; strong dispel only.
- **Hex**: Unit Target (enemy). pierces immunity: no; dispellable: strong dispel only; cooldown 24/20/16/12 s; mana 110/140/170/200; cast point 0; cast range 575/600/625/650.
  - What it does: Unit-target hex (575-650, no cast point): turns the target into a harmless critter for 2-3.2 s (no attacks, spells or items, base speed 120); kills illusions instantly.
  - Counterplay: Linken's or Lotus; strong dispel only; spell immunity.
- **Mana Drain**: Unit Target (enemy), Channeled. pierces immunity: no; dispellable: no; cooldown 15/12/9/6 s; cast point 0.3 s; cast range 850; channel 5.1 s; upgraded by Shard.
  - What it does: Unit-target channel for up to 5 s (850 range): drains 20-120 mana per second and slows the target 15-30% (more once its mana is empty); prevents it from going invisible. On an ally it gives mana and speed at half rate. Breaks beyond 1100 range.
  - Aghanim's Shard: Up to 2 extra enemies, longer break range, and Lion is debuff immune with 60% magic resistance while channeling.
  - Counterplay: Walk out of range or interrupt him.
- **To Hell and Back** (Innate): Passive. dispellable: no.
  - What it does: Innate: +20% debuff duration while a hero he killed or helped kill is dead; +15% spell amplification for 90 s after he respawns, until his next kill or assist.
- **Finger of Death**: Unit Target (enemy) / AoE. Magical damage; pierces immunity: no; cooldown 110/70/30 s; mana 200/400/600; cast point 0.3 s; cast range 900; upgraded by Scepter.
  - What it does: Unit-target (900) for 570-800 magic damage after a 0.25 s delay, +20 permanently per hero killed by it (within 3 s). Afterwards his hand is empowered for 20 s: a cleaving 250-range melee attack with +30% speed (alt-cast turns this off).
  - Aghanim's Scepter: +100 damage, a 325-radius splash on the initial cast, and longer, stronger fist.
  - Counterplay: Linken's, Lotus Orb, spell immunity, a disjoint in the 0.25 s window; do not stand next to the target.

#### Lone Druid | Agility | Ranged | attack range 550 | move speed 300 | [feed](https://www.dota2.com/datafeed/herodata?language=english&hero_id=80)

- **Entangle**: Point Target / AoE. Magical damage; pierces immunity: YES (enemies); dispellable: no; cooldown 20/19/18/17 s; mana 60; cast point 0.3 s; cast range 700; upgraded by Scepter.
  - What it does: Point area (700 range, 350 radius): enemy heroes get 2 stacks (creeps 5); at 5 stacks a target is rooted 1.2-2.4 s and takes 90 damage per second, revealing it and blocking blinks. For 10 s after casting, his attacks on heroes add a stack each, and so does the Spirit Bear's Entangling Claws. Pierces spell immunity.
  - Aghanim's Scepter: Puts 5 stacks on heroes at once (an instant root), larger radius, no stack protection while rooted.
  - Counterplay: Count the stacks; the root itself can be basic-dispelled.
- **Spirit Link**: Passive. no numeric fields in the feed.
  - What it does: Passive: Lone Druid gets +15-60 and the bear +20-80 move speed, and each shares 15-60% of its lifesteal with the other.
  - Aghanim's Scepter: He can sever the link with the bear and link to an allied hero for 20 s, sharing the bonuses (+35% armor sharing and attack speed); each heals from the other's damage; the bear is feared meanwhile unless it has its own Scepter.
  - Counterplay: Break stops the shared lifesteal.
- **Savage Roar**: No Target. pierces immunity: no; dispellable: yes (basic dispel); cooldown 29/26/23/20 s; mana 50; cast point 0.1 s; upgraded by Shard.
  - What it does: Instant roar in 350: enemies are feared toward their base for 1.1-2 s; Lone Druid and the bear gain 20% speed. Shares its cooldown with the bear's copy.
  - Aghanim's Shard: Also a basic dispel and a 700-radius attack- and move-speed buff for allies; casting it on one also casts it on the other.
  - Counterplay: Basic dispel; keep away from both bodies.
- **Summon Spirit Bear** (Innate): No Target. cooldown 120 s; mana 100; cast point 0.5 s.
  - What it does: Innate summon (120 s cooldown, 0.5 s cast point): a Spirit Bear (1500 health) that carries its own items, levels with him and has Demolish, Return (teleport to Lone Druid), Entangling Claws, Savage Roar and Spirit Link. It cannot attack if it is too far from him, and he loses 20% of his max health when it dies.
  - Counterplay: Kill the bear (it damages him); split the two apart.
- **True Form**: No Target. dispellable: no; cooldown 60/55/50 s; mana 80; cast point 0.
  - What it does: Instant 25 s transformation (1.93 s to change) into a melee bear: +10-20 armor, +500-1500 health and +50-130 damage, losing his range.
  - Counterplay: The long change time is a window to hit or disable him.

#### Luna | Agility | Ranged | attack range 330 | move speed 325 | [feed](https://www.dota2.com/datafeed/herodata?language=english&hero_id=48)

- **Lucent Beam**: Unit Target (enemy). Magical damage; pierces immunity: no; dispellable: strong dispel only; cooldown 9/8/7/6 s; mana 90/100/110/120; cast point 0.4 s; cast range 800.
  - What it does: Unit-target (800, 0.4 s cast point): 75-300 magic damage and a 0.6 s stun.
  - Aghanim's Shard: Each hero hit gives her a stacking attack-damage buff.
  - Counterplay: Linken's; strong dispel only.
- **Lunar Orbit**: No Target, instant (no queue). Physical damage; pierces immunity: YES (enemies); dispellable: no; cooldown 40/35/30/25 s; mana 65/70/75/80; cast point 0; upgraded by Shard.
  - What it does: Instant 5-8 s: 4 glaives circle her at 225 radius, each collision dealing 28-40% of her attack damage; she takes 8-20% less damage. Pierces spell immunity.
  - Aghanim's Shard: More damage reduction and +20% move speed.
  - Counterplay: Keep distance.
- **Moon Glaives**: Passive. pierces immunity: YES (enemies).
  - What it does: Passive: her attacks bounce 3-6 times between enemies within 500, losing 35-50% damage per bounce.
  - Counterplay: Do not stand near the unit she attacks.
- **Lunar Blessing** (Innate): Passive aura. pierces immunity: allies: yes.
  - What it does: Innate aura (1200, global at night): bonus attack damage for her and allied heroes (double for Luna), and +225 night vision.
- **Eclipse**: No Target. Magical damage; pierces immunity: no; dispellable: no; cooldown 105 s; mana 150/200/250; cast point 0.5 s; upgraded by Scepter.
  - What it does: No-target ultimate around her (675): 6-12 Lucent Beams fall on random enemies 0.6 s apart (no stun, max 5 per target), and the day turns to night for 10 s. Does not hit invisible units; stops if she dies.
  - Aghanim's Scepter: Castable on an ally, herself (follows them) or an area (2500 range), more beams twice as fast, no per-target limit.
  - Counterplay: Stand among creeps or invisible; kill or disable Luna to stop it.

#### Lycan | Strength | Melee | attack range 150 | move speed 305 | [feed](https://www.dota2.com/datafeed/herodata?language=english&hero_id=77)

- **Summon Wolves**: No Target. cooldown 30 s; mana 115/120/125/130; cast point 0.3 s; upgraded by Shard.
  - What it does: Instant: summons 2 wolves for 50 s (replacing old ones); at level 3 they are permanently invisible, at level 4 they gain a 20% chance to cripple (damage and -60 attack speed for 4 s).
  - Aghanim's Shard: One more wolf, and wolves get Hightail (an active burst of free pathing, evasion and speed).
  - Counterplay: True Sight; kill the wolves for gold.
- **Howl**: No Target. pierces immunity: no; dispellable: yes (basic dispel); cooldown 22/20/18/16 s; mana 40; cast point 0.3 s.
  - What it does: Instant 8 s debuff on all enemies within 2000 of Lycan and his wolves (global at night): -4-7 armor and -25-40% attack damage.
  - Counterplay: Basic dispel.
- **Feral Impulse**: Passive. no numeric fields in the feed.
  - What it does: Passive: +10-40 damage and +2-8 health regen for Lycan and every unit he controls.
- **Wolf Bite** (granted by Aghanim's Scepter): Unit Target (ally). pierces immunity: allies: yes; dispellable: no; cooldown 105/95/85 s; mana 150; cast point 0.3 s; cast range 300.
  - What it does: Scepter ability: bites an allied hero (300 range) to give it Shapeshift's bonuses; it counts as one of Lycan's units for Pack Hunter. Shares Shapeshift's cooldown.
- **Pack Hunter** (Innate): Passive. Physical damage; pierces immunity: no; dispellable: yes (basic dispel).
  - What it does: Innate: attacks from Lycan and his units mark the target for 6 s (one mark per unit); every attack on a marked unit deals +5% damage per mark and heals 3% per mark. Marked units are revealed through fog and invisibility.
  - Counterplay: Kill the wolves to reduce the marks; basic dispel.
- **Shapeshift**: No Target. dispellable: no; cooldown 105/95/85 s; mana 100; cast point 0.
  - What it does: Instant 25 s transformation (1.1 s to change): fixed 550 move speed that cannot be slowed (also for his units), 40% chance for 160-240% crits, more health and 1000 night vision. Hex does not remove the speed.
  - Counterplay: Disable during the transformation time; stuns and roots still work.

#### Magnus | Universal | Melee | attack range 200 | move speed 305 | [feed](https://www.dota2.com/datafeed/herodata?language=english&hero_id=97)

- **Shockwave**: Unit or Point Target (enemy). Magical damage; pierces immunity: no; cooldown 13/12/11/10 s; mana 85/90/95/100; cast point 0.3 s; cast range 1200.
  - What it does: Unit- or point-target wave (1200): 90-300 magic damage to enemies in the line, pulling them toward Magnus and slowing 75% for 0.55-1 s.
  - Counterplay: Sidestep the line.
- **Empower**: Unit Target (ally). pierces immunity: allies: yes; dispellable: yes (basic dispel); cooldown 8 s; mana 45/55/65/75; cast point 0.3 s; cast range 800.
  - What it does: Unit-target on an ally (800) for 30-39 s: +16-40% base damage and the same percentage as cleave (melee only). Magnus always has it at 30% more.
  - Counterplay: Basic dispel.
- **Skewer**: Point Target. Magical damage; pierces immunity: no; dispellable: yes (basic dispel); cooldown 22/20/18/16 s; mana 80; cast point 0.3 s; upgraded by Shard.
  - What it does: Point-direction charge (800-1100, speed 900): Magnus rushes forward; heroes he hits are dragged along to the end, then damaged (80-320 + more by distance) and slowed 20-50% for 3.25 s. Interrupted if he is stunned, hexed or banished.
  - Aghanim's Shard: +300 range and extra damage if the victims hit trees or cliffs.
  - Counterplay: Stun him during the rush; stay off his line toward his team.
- **Horn Toss** (granted by Aghanim's Scepter): No Target. Magical damage; pierces immunity: no; dispellable: yes (basic dispel); cooldown 30 s; mana 100; cast point 0.2 s.
  - What it does: Scepter ability, instant: tosses enemies in front of him over his head to his back (0.6 s in the air, stunned), 325 magic damage and a 0.75 s stun after landing.
  - Counterplay: Do not stand in front of him.
- **Solid Core** (Innate): Passive. no numeric fields in the feed.
  - What it does: Innate: 24% slow resistance and 50% less knockback from enemy spells and items.
- **Reverse Polarity**: No Target. Magical damage; pierces immunity: YES (enemies); dispellable: strong dispel only; cooldown 115 s; mana 150/225/300; cast point 0.3 s; cast range 410.
  - What it does: No-target ultimate (0.3 s cast point): pulls every enemy within 430 to a spot in front of him and stuns them 2.5-3.5 s with 100-300 magic damage. Pierces spell immunity.
  - Counterplay: Spread out, stay away from his Blink range; strong dispel only.

#### Marci | Universal | Melee | attack range 150 | move speed 315 | [feed](https://www.dota2.com/datafeed/herodata?language=english&hero_id=136)

- **Dispose**: Unit Target (ally or enemy). Magical damage; pierces immunity: no; dispellable: yes (basic dispel); cooldown 16/14/12/10 s; mana 80; cast point 0.2 s; cast range 175.
  - What it does: Unit-target grab (175) on an ally or enemy: throws it 250 behind her; enemies take 60-330 magic damage and a 20-50% slow for 3 s, as do enemies where it lands.
  - Counterplay: Linken's; keep out of melee.
- **Rebound**: Unit Target (ally) / Vector Target. Magical damage; pierces immunity: no; dispellable: strong dispel only; cooldown 24/20/16/12 s; mana 70/80/90/100; cast point 0.1 s; cast range 450/550/650/750; upgraded by Shard.
  - What it does: Vector-targeted: Marci runs to an allied unit (450-750), then springs off it in a chosen direction and distance, landing for 75-300 magic damage and a 0.8-1.7 s stun. Alt-cast carries the ally with her; the ally gets +25% speed for 4 s.
  - Aghanim's Shard: More damage, can jump off enemies too, and she also gets the speed.
  - Counterplay: Her run to the ally can be disjointed; watch the landing spot; strong dispel only.
- **Bodyguard**: Unit Target (ally). Physical damage; pierces immunity: allies: yes; dispellable: yes (basic dispel); cooldown 21/20/19/18 s; mana 60; cast point 0.2 s; cast range 600.
  - What it does: Passive lifesteal and damage for Marci; cast on an ally (600) for 7 s: the ally gets 75% of those bonuses and both share a damage barrier (120-300) that is refilled by 30% of her damage to heroes.
  - Counterplay: Break the barrier with burst; basic dispel.
- **Special Delivery** (Innate): No Target. cooldown 200 s; cast point 1 s.
  - What it does: Innate, instant (1 s cast point, 200 s cooldown): her courier teleports to her, bringing items from her stash; all allied couriers get 3 levels and an extra pip.
- **Unleash**: No Target. Magical damage; dispellable: no; cooldown 80/70/60 s; mana 100/125/150; cast point 0.2 s; upgraded by Scepter.
  - What it does: No-target ultimate for 16 s: gives Fury charges; each combo is 5 extremely fast attacks (+700-1150 attack speed, no attack-speed cap), and the last hit releases a pulse in 800 radius (50-150 damage, 30% move and 60-100% attack slow for 2 s). She cannot attack for 1.5 s between combos. +15% speed on cast.
  - Aghanim's Scepter: Cooldown -10 s, a basic dispel on cast, every spell she casts also pulses, and pulses silence 1 s.
  - Counterplay: Disarm, evasion or ghost form shut down the combos; use the 1.5 s gaps.

#### Mars | Strength | Melee | attack range 250 | move speed 310 | [feed](https://www.dota2.com/datafeed/herodata?language=english&hero_id=129)

- **Spear of Mars**: Point Target (directional). Magical damage; pierces immunity: no; dispellable: strong dispel only; cooldown 14/13/12/11 s; mana 90/100/110/120; cast point 0.25 s; upgraded by Shard.
  - What it does: Point-direction spear (900-1200 range): damages every enemy on the line; the first hero hit is carried along, and if it hits a tree, building or cliff it is pinned there and stunned 1.3-2.2 s. Reveals and hits invisible units.
  - Aghanim's Shard: Up to 2 heroes impaled and a fire trail that slows and burns.
  - Counterplay: Stay away from walls and trees in his line; sidestep; strong dispel only.
- **God's Rebuke**: Point Target. Physical damage; cooldown 14/12/10/8 s; mana 90; cast point 0.2 s.
  - What it does: Point-direction shield bash in a half-circle (500-575 radius): a true-strike critical hit (160-280%) plus more against heroes, knocking enemies back and slowing 40% for 2.5 s.
  - Counterplay: Stay out of his front arc.
- **Bulwark**: Point Target, instant (no queue). cast point 0.
  - What it does: Passive and toggle: blocks 40-70% of physical attack damage from the front and 20-35% from the sides. Toggled on, he cannot attack, moves slower with free pathing, faces a fixed direction and pulls 70% of the attack projectiles aimed at allies behind him onto himself.
  - Aghanim's Scepter: Soldiers stand on both sides of him while it is on, attacking and knocking back enemies that come close.
  - Counterplay: Hit him from behind; Break turns the reduction off.
- **Dauntless** (Innate): Passive. no numeric fields in the feed.
  - What it does: Innate: +50 health regen per enemy hero within 900 beyond the number of allies (the more outnumbered, the more).
- **Arena Of Blood**: Point Target / AoE. Magical damage; pierces immunity: no; cooldown 105/95/85 s; mana 150/200/250; cast point 0.2 s; cast range 400; upgraded by Scepter.
  - What it does: Point area (400 range, 550 radius) for 5.5 s after 0.1 s: a ring of ghost soldiers that blocks movement and attacks across it for enemies; enemy heroes near the inside wall are speared (80-260 damage) and pushed back in.
  - Aghanim's Scepter: Cooldown -10 s, longer, and each enemy killed inside heals Mars and allies inside 35% and gives +45% damage for 20 s, stacking.
  - Counterplay: Spells still cross the wall; get out during the 0.1 s formation or stay away from the inside edge (whether blinks cross the wall is not in the feed).

#### Medusa | Agility | Ranged | attack range 600 | move speed 275 | [feed](https://www.dota2.com/datafeed/herodata?language=english&hero_id=94)

- **Split Shot**: Toggle, instant (no queue). pierces immunity: YES (enemies); dispellable: no; cast point 0.4 s; upgraded by Scepter.
  - What it does: Toggle: each attack also fires 4 extra arrows at nearby enemies for 50-80% damage (without on-hit effects). Pierces spell immunity.
  - Aghanim's Scepter: One more arrow and on-hit effects apply to all of them.
  - Counterplay: Spread out from creeps near her.
- **Mystic Snake**: Unit Target (enemy). Magical damage; pierces immunity: no; cooldown 15/14/13/12 s; mana 80/95/110/125; cast point 0.2 s; cast range 750.
  - What it does: Unit-target (750) snake that jumps 3-6 times between enemies within 450 for 90-240 magic damage, rising 25% each jump, and steals 15% of their mana, bringing it back to her. Cannot be disjointed.
  - Counterplay: Spread out; spell immunity.
- **Gorgon's Grasp**: Point Target / AoE. Magical damage; pierces immunity: no; dispellable: yes (basic dispel); cooldown 30/25/20/15 s; mana 65/85/105/125; cast point 0.2 s; cast range 625.
  - What it does: Point-direction (625): arrows land in three groups along a line, each larger (150 radius +50 each), after 0.8 s; enemies hit take 60-240 magic damage, then are rooted, cannot turn, revealed and take 12-48 per second for 0.8-2 s.
  - Counterplay: Sidestep the landing marks; basic dispel.
- **Cold Blooded** (granted by Aghanim's Shard): Passive. Magical damage; pierces immunity: no; cooldown 12 s.
  - What it does: Shard passive (12 s cooldown): when an enemy targets her with a spell, a single-target snake goes back at the caster and petrifies it for 1 s.
  - Counterplay: Use area spells instead of targeted ones.
- **Mana Shield** (Innate): Passive. dispellable: no.
  - What it does: Innate: absorbs 98% of incoming damage at 2 damage per point of her mana (before armor), so her mana pool is extra health.
  - Counterplay: Mana burn or drain first (Anti-Mage, Nyx-style effects).
- **Stone Gaze**: No Target. pierces immunity: YES (enemies); dispellable: no; cooldown 90 s; mana 250; cast point 0.4 s; cast range 1200.
  - What it does: No-target 5-6 s: enemies within 1200 facing her are slowed 35%; after 2 s total of facing her they turn to stone for 2-2.4 s (stunned, taking 35-55% more physical damage). Pierces spell immunity.
  - Counterplay: Turn your hero to face away from her (you cannot attack her while doing it); the facing rule is the whole counterplay.

#### Meepo | Universal | Melee | attack range 150 | move speed 310 | [feed](https://www.dota2.com/datafeed/herodata?language=english&hero_id=82)

- **Earthbind**: Point Target / AoE. pierces immunity: no; dispellable: yes (basic dispel); cooldown 16/14/12/10 s; mana 70/80/90/100; cast point 0.3 s; cast range 750/900/1050/1200.
  - What it does: Point area (750-1200, 220 radius): a net roots enemies 2 s and reveals invisible ones.
  - Counterplay: Dodge the slow net's flight; basic dispel.
- **Poof**: Unit or Point Target (ally). Magical damage; pierces immunity: no; cooldown 12/10/8/6 s; mana 80; cast point 1.5 s.
  - What it does: Unit- or point-target self teleport with a 1.5 s channel-like cast point: a Meepo teleports to another Meepo (or itself), dealing 50-140 magic damage in 400 at both ends. Alt-cast makes all Meepos poof to the target. Castable through the minimap.
  - Counterplay: Interrupt the 1.5 s cast; burst one Meepo before help arrives.
- **Ransack**: Passive. Pure damage; pierces immunity: YES (enemies).
  - What it does: Passive: each hit steals 7-16 health (pure) and heals every other Meepo by that amount (60% against creeps).
- **Dig** (granted by Aghanim's Scepter): No Target. pierces immunity: YES (enemies); dispellable: no; cooldown 40 s; mana 125; cast point 0.2 s.
  - What it does: Scepter ability, instant: Meepo digs underground for 4 s (basic dispel, invulnerable, untargetable) and restores 50% of max health.
  - Counterplay: Switch to another Meepo.
- **Geomancy** (Innate): Passive. dispellable: no.
  - What it does: Innate: each Meepo gives all Meepos a terrain bonus: 1 health regen near a tree, 2% speed on dirt, a 2% slow on attacks in water; stacking.
- **Divided We Stand**: Passive. upgraded by Shard.
  - What it does: Passive ultimate: creates 1-4 full Meepo clones that level up and share items with the original (item stats are split among them). Each Meepo has its own spells and cooldowns; if any Meepo dies, all die.
  - Aghanim's Shard: Becomes castable: picks up a friendly Meepo or creep (250 range), disarming both, to throw it with Fling.
  - Counterplay: Focus the weakest Meepo: one death kills them all.
- **Fling** (granted by Aghanim's Shard): Unit or Point Target (ally or enemy) / AoE. Magical damage; pierces immunity: no; dispellable: yes (basic dispel); cast point 0.2 s.
  - What it does: Shard sub-ability: throws the carried Meepo or creep at a unit or point (600-900), dealing 100-250 magic damage in 200 and a 30-60% slow for 1.5-3 s.

#### Mirana | Agility | Ranged | attack range 630 | move speed 285 | [feed](https://www.dota2.com/datafeed/herodata?language=english&hero_id=9)

- **Starstorm**: No Target. Magical damage; pierces immunity: no; cooldown 12 s; mana 80/90/100/110; cast point 0.4 s.
  - What it does: No-target star shower in 675 around her (0.4 s cast point): 75-300 magic damage to each enemy, and the closest one is hit again for 80%. Not blocked by Linken's; misses invisible units.
  - Counterplay: Distance.
- **Sacred Arrow**: Point Target (directional). Magical damage; pierces immunity: no; dispellable: strong dispel only; cooldown 19/18/17/16 s; mana 90; cast point 0.5 s; cast range 3000; upgraded by Scepter.
  - What it does: Point-direction arrow (3000 range, 0.5 s cast point): the first enemy unit hit is stunned 0.01 s up to 2.3-5 s and takes damage +up to 180, both growing with distance travelled; non-ancient creeps die instantly. Hits invisible units.
  - Aghanim's Scepter: The arrow also triggers a Starstorm along its path and at impact.
  - Counterplay: Sidestep (it is fairly slow), or stay behind creeps; strong dispel only.
- **Leap**: No Target; Charge-based: 2 charges, 45/35/25/15 s each. dispellable: yes (basic dispel); mana 50; cast point 0; upgraded by Shard.
  - What it does: Charge-based (2 charges, 45-15 s each) instant forward leap of 650 in the facing direction; on landing she gains +25-100 attack speed and +6-24% move speed for 5 s.
  - Aghanim's Shard: One extra charge.
  - Counterplay: Roots stop it.
- **Celestial Quiver** (Innate): Autocast attack modifier, Unit Target (enemy); Charge-based: 2 charges, 7 s each. Magical damage; cast point 0; cast range 630; upgraded by Shard.
  - What it does: Innate, charge-based autocast attack modifier (2 charges, 7 s each): her next attack gets +5 magic damage and +20% item potency.
  - Aghanim's Shard: 3 temporary charges while Leap's buff is active.
- **Moonlight Shadow**: No Target. pierces immunity: allies: yes; dispellable: no; cooldown 120/110/100 s; mana 125; cast point 0.5 s.
  - What it does: No-target (0.5 s cast point): Mirana and all allied heroes on the map turn invisible for 18 s with +9-15% speed (she also gets +9-15% damage); if revealed, the invisibility returns after the fade delay while the duration lasts.
  - Counterplay: True Sight (Dust, Sentry, Gem).

#### Monkey King | Agility | Melee | attack range 300 | move speed 300 | [feed](https://www.dota2.com/datafeed/herodata?language=english&hero_id=114)

- **Boundless Strike**: Point Target. Physical damage; pierces immunity: no; dispellable: strong dispel only; cooldown 24/20/16/12 s; mana 85/90/95/100; cast point 0.4 s; cast range 1100; upgraded by Shard.
  - What it does: Point-direction staff slam (1100 line, 0.4 s cast point): stuns enemies on the line 0.75-1.5 s and hits them with a true-strike critical (120-150%) plus 25-100.
  - Aghanim's Shard: Also applies a 35% Primal Spring along the staff; alt-cast makes him leap to the spot instead.
  - Counterplay: Watch the cast animation; sidestep; strong dispel only.
- **Tree Dance**: Unit Target (enemy). cooldown 0.9/0.6/0.3/0 s; cast point 0.2 s; cast range 1000.
  - What it does: Unit-target jump (1000) onto a tree (no damage): he perches on top, gains Primal Spring (a channeled leap attack from the tree), and can hop tree to tree. If the tree is cut he falls and is stunned 3 s; taking damage on the ground puts it on cooldown.
  - Counterplay: Destroy his tree (Quelling Blade, Tango, spells) to stun him.
- **Jingu Mastery**: Passive. Physical damage; pierces immunity: YES (enemies); dispellable: no.
  - What it does: Passive: after 4 hits on the same enemy hero (counter lasts 5.5-10 s), he gets 4 charged attacks with +30-180 damage and 20-80% lifesteal. Pierces spell immunity.
  - Counterplay: Avoid repeated hits; dispel his buff (basic).
- **Mischief** (Innate): No Target. cooldown 24.5 s; cast point 0.
  - What it does: Innate, instant (24.5 s cooldown): disguises him as a nearby object (a tree, rune, courier, creep...) with brief damage immunity; any damage, attack or ability breaks it.
  - Counterplay: Hit suspicious objects; True Sight does not help.
- **Wukong's Command**: Point Target / AoE. Physical damage; cooldown 100/90/80 s; mana 100; cast point 1 s; upgraded by Scepter.
  - What it does: Point area with a 1 s cast point: rings of soldier copies spread around him for 14 s, each attacking an enemy hero every 1.1 s with his attack; Monkey King gets +15-25 armor; leaving the area ends it. He can swap into one of his soldiers.
  - Aghanim's Scepter: Soldiers also spawn near him on a timer and can build Jingu charges on their own.
  - Counterplay: Leave the ring; soldiers target heroes only.
- **Changing of the Guard** (sub-ability): Point Target. cooldown 5 s; cast point 0.3 s.
  - What it does: Sub-ability of Wukong's Command (5 s cooldown): he swaps places with one of his soldiers and looks identical to them for 1.5 s, invulnerable but unable to attack or cast.

#### Morphling | Agility | Ranged | attack range 350 | move speed 285 | [feed](https://www.dota2.com/datafeed/herodata?language=english&hero_id=10)

- **Waveform**: Point Target. Magical damage; pierces immunity: no; cooldown 21/18/15/12 s; mana 115; cast point 0.25 s; cast range 700/775/850/925.
  - What it does: Point-target surge (700-925 range, 0.25 s cast point): he turns to water and slides to the spot, invulnerable, damaging enemies on his path (damage values not given in the feed).
  - Counterplay: Roots stop it; it can be used to dodge projectiles.
- **Adaptive Strike**: Unit Target (enemy). Magical damage; pierces immunity: no; cooldown 17/14/11/8 s; mana 40/50/60/70; cast point 0.25 s; cast range 600/675/750/825.
  - What it does: Unit-target water projectile (600-825, speed 1150): 50-110 + 0.5-2.5x Agility magic damage (the more Agility than Strength, the more), plus a 0.5-2.6 s stun and 50-350 knockback scaled by his Strength.
  - Counterplay: Disjointable projectile; Linken's.
- **Attribute Shift (Agility Gain)**: Toggle. cast point 0; upgraded by Shard.
  - What it does: Toggle: while on, he moves 4-16 points per second from Strength into Agility (mana each step), reversibly.
  - Aghanim's Shard: Works while stunned and costs less.
  - Counterplay: Burst him while he is in Agility form (low health).
- **Attribute Shift (Strength Gain)**: Toggle. cast point 0; upgraded by Shard.
  - What it does: Toggle: moves 4-16 points per second from Agility into Strength.
  - Aghanim's Shard: As above.
- **Morph**: Unit Target (special). pierces immunity: YES (enemies); dispellable: no; cooldown 125/90/55 s; mana 50; cast point 0.25 s; cast range 700/850/1000; upgraded by Scepter.
  - What it does: Unit-target (700-1000) on an enemy hero for 24 s: Morphling turns into that hero, gaining its basic abilities and primary attribute; he can switch back and forth while it lasts. Pierces spell immunity.
  - Aghanim's Scepter: While morphed, every unit-targeted spell he casts is re-cast twice by weaker echo replicants on nearby targets, 0.2 s apart.
- **Ebb and Flow** (Innate): Passive. dispellable: no.
  - What it does: Innate: extra cast range and slow resistance from his Strength, and attack range and move speed from his Agility (kept while morphed).

#### Muerta | Intelligence | Ranged | attack range 575 | move speed 295 | [feed](https://www.dota2.com/datafeed/herodata?language=english&hero_id=138)

- **Dead Shot**: Unit Target (enemy) / Vector Target. Magical damage; pierces immunity: no; dispellable: yes (basic dispel); cooldown 16/14/12/10 s; mana 100/120/140/160; cast point 0.15 s; cast range 1000; upgraded by Scepter.
  - What it does: Vector-targeted trick shot: fires at an enemy unit or a tree (1000), which takes 100-325 magic damage and a 1 s full slow; the bullet then ricochets in the chosen direction (1.5x cast range), damaging units it passes and stopping on the first hero, which is feared away from the impact for 0.8-1.25 s.
  - Aghanim's Scepter: More damage, the ricochet widens and pierces through heroes, fearing each.
  - Counterplay: Do not stand in line behind trees and allies near her target; basic dispel the fear.
- **The Calling**: Point Target / AoE, self-castable. Magical damage; pierces immunity: no; dispellable: yes (basic dispel); cooldown 30/28/26/24 s; mana 135/150/165/180; cast point 0.1 s; cast range 600.
  - What it does: Point area (600): 4 revenants circle the spot for 5-8 s; enemies inside are slowed 20%, and revenants passing through enemies deal 45-180 magic damage and silence 1.5-3 s.
  - Counterplay: Leave the circle; basic dispel.
- **Gunslinger**: Toggle, instant (no queue). cast point 0.
  - What it does: Toggle: while on, each attack has a 20-50% chance to fire a second shot at another target within her range + 175 (or the same target if no other).
- **Spectral Slug** (granted by Aghanim's Shard): Unit Target (enemy); Charge-based: 2 charges, 12 s each. Magical damage; pierces immunity: no; dispellable: yes (basic dispel); mana 75; cast point 0.2 s; cast range 575.
  - What it does: Shard ability, unit-target (575): 125 magic damage, a 250 knockback and ethereal for 2.25 s (immune to physical damage, cannot attack, 30% slow, takes 20% more magic damage).
  - Counterplay: Basic dispel.
- **Pierce the Veil**: No Target. Magical damage; dispellable: no; cooldown 75/60/45 s; mana 150/250/350; cast point 0.
  - What it does: Instant 8 s form (0.35 s change, dodging projectiles): she becomes ethereal (immune to physical attacks) yet can still attack, gains 70-100% bonus base damage and free pathing; all her attack damage becomes magic.
  - Aghanim's Shard: Spell lifesteal while it lasts, and permanent spell amplification for heroes dying near her during it.
  - Counterplay: Magic resistance, spell immunity and magic damage; it cannot be dispelled.
- **Supernatural** (Innate): Passive. no numeric fields in the feed.
  - What it does: Innate: each enemy hero dying within 925 gives her +1% spell amplification (max 5); she loses half on death.


### Inferences
- **The patterns, given the raw numbers:**
  - Most hard disables are cheap to land but have a counter built in. Stuns from unit-targeted spells are almost all "strong dispel only" and blockable by Linken's.
  - Area stuns nearly always have a cast point or a delay: Light Strike Array about 1 s, Torrent 1.6 s, Blood Rite 2.9 s, Earth Splitter 2.7 s, Split Earth 0.7 s plus 0.35 s.
  - Area disables with no delay are mostly melee-range (Berserker's Call, Reverse Polarity, Echo Slam; Hoof Stomp after its 0.5 s wind-up) and need a gap-closer first. The ranged exceptions are softer or need set-up: Static Storm silences at once from 800 range, and Searing Chains roots two random enemies near Ember.
- **The Dota "kit shape" is very consistent:** three basic abilities, one ultimate and one innate. Most heroes have a mobility or utility tool, a damage or disable tool, and a passive that rewards a play style. Scepter usually changes how an ability behaves rather than its numbers; Shard usually adds a small extra rule or a new button.
- **Toggles, vectors and charges are rare (8, 6 and 11 abilities, plus 5 that gain charges from Shard or Scepter) but highly recognisable.** That rarity is part of why heroes like Leshrac, Muerta, Earth Spirit, Ember Spirit and Broodmother feel distinct.

### Gaps
- **Counterplay notes:** these are inferred. The feed has no "disjointable" field except where a note says so, and nothing about animation readability. A wiki pass (Liquipedia or Fandom "Disjointable" fields) would confirm them, but the wikis may not yet show 7.42 values.
- **Sub-units:** the abilities of the Brewmaster brewlings, the Lone Druid Spirit Bear (Demolish, Return, Entangling Claws), Chen's Zealot (Martyrdom), the Beastmaster summons and similar units are not in the hero feed. They are only named here.
- **Missing or zero values in the feed:**
  - Morphling's Waveform damage and speed.
  - Rabble-Rouser's damage amp (0).
  - Ghoul Frenzy's attack speed (0).
  - Some tooltip-only values that show 0 because they scale with level or attributes.
- **Axe's Culling Blade:** the feed lists a 1200 "charge_speed" without explaining it. It is unconfirmed whether 7.42 Culling Blade involves a charge to the target. The feed's description now only mentions pure damage, so it is unclear whether the old instant-kill threshold still exists; a note saying Shallow Grave cannot prevent a Culling Blade death suggests some kill mechanic remains.
- **Undecoded flags:** the feed's `behavior` bitmask has bits above 2^33 that I could not decode with confidence:
  - Bit 38 is on Blink, Tornado and Waveform (possibly "overshoot").
  - Bit 40 is on Nightmare, Devour, Dark Artistry, Acorn Shot, Finger of Death and Poof, which all have an alt-cast mode (possibly the alt-castable flag).
  - Bit 37 and bit 46 are on stance or toggle swappers.
- **Not covered:** talents, and Invoker's list of selectable Scepter and Shard upgrades (the feed says he chooses among several).
- **Cooldowns and mana:** the values are the feed's values for 7.42 and were not cross-checked against in-game tooltips. One mismatch: the 7.42 notes give Raptor Dance (ability id 1501, confirmed in the feed) a base damage of 40/80/120, but the feed shows 50/100/150 (same percentages and radius). The values follow the feed; the cause (a later hotfix or a feed error) is unknown.

## What counterplay does each ability allow?

### Takeaway
Dota builds counterplay into almost every ability through a few repeated levers:
- telegraphs: cast points, delays, and visible zones or timers;
- projectiles that can be dodged;
- a dispel tier (basic, strong-only, or none);
- whether the ability pierces immunity;
- spell block or reflect on unit-targeted spells;
- positioning rules (spread out, stand still or keep moving, face away, stay away from trees or walls, stand next to an ally).

The per-ability notes are in each "Counterplay" line in the per-hero reference above. This section summarises the patterns.

### Cited Findings
- **Telegraphed delays (sourced values):**
  - Blood Rite: 2.6 s delay plus 0.3 s cast point. — [Bloodseeker feed](https://www.dota2.com/datafeed/herodata?language=english&hero_id=4)
  - Torrent: 1.6 s delay; its bubbles are visible only to allies. — [Kunkka feed](https://www.dota2.com/datafeed/herodata?language=english&hero_id=23)
  - Sun Strike: 1.7 s delay. — [Invoker feed](https://www.dota2.com/datafeed/herodata?language=english&hero_id=74)
  - EMP: 2.9 s delay. — [Invoker feed](https://www.dota2.com/datafeed/herodata?language=english&hero_id=74)
  - Earth Splitter: about 2.7 s crack time. — [Elder Titan feed](https://www.dota2.com/datafeed/herodata?language=english&hero_id=103)
  - Kinetic Field: 1 s formation. — [Disruptor feed](https://www.dota2.com/datafeed/herodata?language=english&hero_id=87)
  - Cursed Crown: 4 s delay. — [Dark Willow feed](https://www.dota2.com/datafeed/herodata?language=english&hero_id=119)
  - Light Strike Array: 0.45 s cast point plus 0.5 s delay. — [Lina feed](https://www.dota2.com/datafeed/herodata?language=english&hero_id=25)
  - Chaos Meteor: 1.3 s landing. — [Invoker feed](https://www.dota2.com/datafeed/herodata?language=english&hero_id=74)
  - Call Down: 1 s between strikes; the indicator is visible to allies only. — [Gyrocopter feed](https://www.dota2.com/datafeed/herodata?language=english&hero_id=72)
- **Long cast points (0.5 s or more, from the feed):**
  - Poof 1.5 s — [Meepo](https://www.dota2.com/datafeed/herodata?language=english&hero_id=82)
  - Terrorize 1.0 s — [Dark Willow](https://www.dota2.com/datafeed/herodata?language=english&hero_id=119)
  - Raptor Dance 1.0 s, invulnerable for the first 0.2 s — [Kez](https://www.dota2.com/datafeed/herodata?language=english&hero_id=145)
  - Wukong's Command 1.0 s — [Monkey King](https://www.dota2.com/datafeed/herodata?language=english&hero_id=114)
  - Marci's Special Delivery 1.0 s — [Marci](https://www.dota2.com/datafeed/herodata?language=english&hero_id=136)
  - Split Earth 0.7 s — [Leshrac](https://www.dota2.com/datafeed/herodata?language=english&hero_id=52)
  - Fissure 0.69 s — [Earthshaker](https://www.dota2.com/datafeed/herodata?language=english&hero_id=7)
  - Ice Path 0.65 s — [Jakiro](https://www.dota2.com/datafeed/herodata?language=english&hero_id=64)
  - Stroke of Fate 0.6 s — [Grimstroke](https://www.dota2.com/datafeed/herodata?language=english&hero_id=121)
  - Primal Split 0.55 s — [Brewmaster](https://www.dota2.com/datafeed/herodata?language=english&hero_id=78)
  - Primal Roar 0.5 s — [Beastmaster](https://www.dota2.com/datafeed/herodata?language=english&hero_id=38)
  - Doom 0.5 s — [Doom](https://www.dota2.com/datafeed/herodata?language=english&hero_id=69)
  - Sacred Arrow 0.5 s — [Mirana](https://www.dota2.com/datafeed/herodata?language=english&hero_id=9)
  - Moonlight Shadow 0.5 s — [Mirana](https://www.dota2.com/datafeed/herodata?language=english&hero_id=9)
  - Eclipse 0.5 s — [Luna](https://www.dota2.com/datafeed/herodata?language=english&hero_id=48)
  - Exorcism 0.5 s — [Death Prophet](https://www.dota2.com/datafeed/herodata?language=english&hero_id=43)
  - Hoof Stomp also has a 0.5 s wind-up during which Centaur can move but is disarmed. — [Centaur feed](https://www.dota2.com/datafeed/herodata?language=english&hero_id=96)
- **Projectiles the feed says cannot be disjointed:**
  - Unstable Concoction — [Alchemist](https://www.dota2.com/datafeed/herodata?language=english&hero_id=73)
  - Spark Wraith — [Arc Warden](https://www.dota2.com/datafeed/herodata?language=english&hero_id=113)
  - Chain Frost — [Lich](https://www.dota2.com/datafeed/herodata?language=english&hero_id=31)
  - Mystic Snake — [Medusa](https://www.dota2.com/datafeed/herodata?language=english&hero_id=94)
  - Life Break — [Huskar](https://www.dota2.com/datafeed/herodata?language=english&hero_id=59)
  - Marci's initial run in Rebound is explicitly disjointable. — [Marci](https://www.dota2.com/datafeed/herodata?language=english&hero_id=136)
- **Delayed single-target damage you can dodge:** Laguna Blade and Finger of Death both have a 0.25 s delay before the damage, which the feed notes lets some abilities avoid it. — [Lina feed](https://www.dota2.com/datafeed/herodata?language=english&hero_id=25); [Lion feed](https://www.dota2.com/datafeed/herodata?language=english&hero_id=26)
- **Line and area spells that ignore spell block:** the feed notes that Dragon Slave, Breathe Fire, Crypt Swarm, Dual Breath and Earth Spike do not trigger spell block or reflect, and that Linken's Sphere does not block Fissure or Starstorm. — feeds for [Lina](https://www.dota2.com/datafeed/herodata?language=english&hero_id=25), [Dragon Knight](https://www.dota2.com/datafeed/herodata?language=english&hero_id=49), [Death Prophet](https://www.dota2.com/datafeed/herodata?language=english&hero_id=43), [Jakiro](https://www.dota2.com/datafeed/herodata?language=english&hero_id=64), [Lion](https://www.dota2.com/datafeed/herodata?language=english&hero_id=26), [Earthshaker](https://www.dota2.com/datafeed/herodata?language=english&hero_id=7), [Mirana](https://www.dota2.com/datafeed/herodata?language=english&hero_id=9)
- **Visible-to-enemy warnings:**
  - Alchemist's brew timer — [Alchemist feed](https://www.dota2.com/datafeed/herodata?language=english&hero_id=73)
  - Io's Relocate destination marker, in the world and on the minimap — [Io feed](https://www.dota2.com/datafeed/herodata?language=english&hero_id=91)
  - Leshrac's Shard Split Earth echo location — [Leshrac feed](https://www.dota2.com/datafeed/herodata?language=english&hero_id=52)
  - Dazzle's Nothl Projection tether to the body — [Dazzle feed](https://www.dota2.com/datafeed/herodata?language=english&hero_id=50)
- **Hidden from the enemy:** Track's debuff is visible only to Bounty Hunter's team. Homing Missile's crosshair and Call Down's indicator are visible to allies only. — [Bounty Hunter feed](https://www.dota2.com/datafeed/herodata?language=english&hero_id=62); [Gyrocopter feed](https://www.dota2.com/datafeed/herodata?language=english&hero_id=72)
- **Positional counterplay written into the rules:**
  - Flux only works if the target is alone. — [Arc Warden](https://www.dota2.com/datafeed/herodata?language=english&hero_id=113)
  - Rupture punishes movement. — [Bloodseeker](https://www.dota2.com/datafeed/herodata?language=english&hero_id=4)
  - Cold Feet punishes standing still. — [Ancient Apparition](https://www.dota2.com/datafeed/herodata?language=english&hero_id=68)
  - Stone Gaze needs the victim to face Medusa. — [Medusa](https://www.dota2.com/datafeed/herodata?language=english&hero_id=94)
  - Bristleback takes less damage from behind; Mars blocks from the front. — [Bristleback](https://www.dota2.com/datafeed/herodata?language=english&hero_id=99); [Mars](https://www.dota2.com/datafeed/herodata?language=english&hero_id=129)
  - Marksmanship turns off with an enemy hero within 300. — [Drow Ranger](https://www.dota2.com/datafeed/herodata?language=english&hero_id=6)
  - Spear of Mars stuns only against trees, buildings or cliffs. — [Mars](https://www.dota2.com/datafeed/herodata?language=english&hero_id=129)
  - Bushwhack needs a tree. — [Hoodwink](https://www.dota2.com/datafeed/herodata?language=english&hero_id=123)
  - Battle Hunger ends when the target kills a unit. — [Axe](https://www.dota2.com/datafeed/herodata?language=english&hero_id=2)
  - Nightmare passes to whoever attacks the sleeper. — [Bane](https://www.dota2.com/datafeed/herodata?language=english&hero_id=3)
  - Tree Dance stuns Monkey King for 3 s if his tree is cut. — [Monkey King](https://www.dota2.com/datafeed/herodata?language=english&hero_id=114)
- **Dispel and immunity, counted across the 390 entries:** see the tally table in the next section. About 70 entries pierce enemy immunity. Basic-dispellable effects outnumber strong-only ones by about 4 to 1.

### Inferences
- **For a 1v1 MOBA, the most transferable levers are:**
  - a visible wind-up of at least 0.3 s on any hard disable;
  - delayed ground zones that the target can walk out of;
  - homing projectiles that a dash can dodge;
  - a clear rule for which effects a cleanse can remove.
- **Positional rules suit 1v1 well** (stand still or move, face away, stand near an ally or alone, hit from front or back). They create counterplay without a reaction-time test.
- **Many Dota counters depend on items.** Spell block, Lotus Orb, True Sight and the various dispels all come from items. A game without that layer has to build the counter into the spell itself: a telegraph, a dodgeable projectile, a break condition or a short duration.

### Gaps
- Most counterplay lines are analysis, not sourced statements. Several second-half or recast buttons are not separate entries in the feed and are only described inside their parent ability: Monkey King's Primal Spring (the channeled leap from a tree), Centaur's Hitch a Ride, Elder Titan's Return Spirit, Bane's Nightmare End, Alchemist's Concoction Throw, AA's Ice Blast Release, Dawnbreaker's Converge, the active of Bristleback's Scepter, Shodo Sai's cancel button, and Divided We Stand's pick-up. A per-ability check of animation readability and real projectile speeds would need in-game footage or the wiki's "Disjointable" fields.

## Which mechanics are unique or rare?

### Takeaway
Across A to M, the rare activation types are:
- Toggle: Leshrac's Pulse Nova, Morphling's Attribute Shift, Medusa's Split Shot, Muerta's Gunslinger, Largo's Amphibian Rhapsody, Io's Spirits In/Out.
- Vector Target: Dark Seer's Wall of Replica, Muerta's Dead Shot, Marci's Rebound, Clinkz's Burning Army, Disruptor's Kinetic Fence, Broodmother's Spinner's Snare.
- Channeled: Fiend's Grip, Freezing Field, Black Hole, Multishot, Echo Stomp and others.
- Charge-based: Spin Web, Stone Remnant, Fire Remnant, Spirit Siphon and others.

The most distinctive designs are the systems that rewrite a hero's whole button layout: Invoker's orbs, Kez's weapon swap, Largo's beat-timed songs, Brewmaster's stances and split. Next come time and position tricks: Time Walk, Glimpse, X Marks the Spot, Chronosphere, Relocate.

### Cited Findings
**Tally of activation types (computed from the feed)**

Counting rule: every ability entry listed in Q1 is counted (390 abilities across 66 heroes), including innate abilities, abilities granted by Scepter or Shard, and hidden sub-abilities (Invoker's 10 invoked spells, Kez's Sai set, Largo's songs, recast buttons). Flags come straight from the feed's `behavior` bitmask; "Charge-based (base)" means the ability has charges without any item.

| Primary activation (each ability counted once) | Count |
|---|---|
| No Target | 93 |
| Passive | 88 |
| Unit Target | 83 |
| Point Target | 79 |
| Unit or Point Target | 12 |
| Autocast attack modifier | 11 |
| Channeled | 11 |
| Toggle | 8 |
| Vector Target | 5 |

| Category (an ability can be in several) | Count |
|---|---|
| Unit Target | 111 |
| No Target | 101 |
| Point Target | 100 |
| Passive (incl. innate passives) | 88 |
| Innate | 67 |
| Upgraded by Scepter | 61 |
| Upgraded by Shard | 61 |
| AoE flag | 54 |
| Instant / no-queue flag | 49 |
| Sub-ability (hidden, swapped in) | 21 |
| Granted by Scepter | 18 |
| Granted by Shard | 17 |
| Autocast | 12 |
| Channeled | 11 |
| Charge-based (base) | 11 |
| Directional (point) | 8 |
| Toggle | 8 |
| Vector Target | 6 |
| Charges from Shard/Scepter | 5 |
| Self-castable point/area | 3 |
| Aura | 3 |

| Other field (from the feed) | Count |
|---|---|
| Damage type Magical | 150 |
| Damage type Physical | 41 |
| Damage type Pure | 17 |
| Pierces enemy immunity | 70 |
| Dispellable: yes (basic dispel) | 109 |
| Dispellable: no | 95 |
| Dispellable: strong dispel only | 29 |
| Activated abilities with 0 s cast point | 98 |
| Median cast point of the others | 0.30 s |
| Cast points of 0.5 s or longer | 19 |


**Unusual mechanics in heroes A to M (one sentence each)**
1. **Invoker** has no fixed spells. Three element orbs (Quas, Wex, Exort) are pressed in any combination, and Invoke turns them into one of 10 spells held in two slots. The orb levels scale each spell's numbers. — [Invoker feed](https://www.dota2.com/datafeed/herodata?language=english&hero_id=74)
2. **Kez's Switch Discipline** swaps his whole ability bar between two weapons (Katana and Sai). Paired abilities level together and share cooldowns. — [Kez feed](https://www.dota2.com/datafeed/herodata?language=english&hero_id=145)
3. **Largo's Amphibian Rhapsody** is a rhythm mini-game: songs only work if pressed on a 1 s beat, hits build Groovin' stacks and misses remove them. — [Largo feed](https://www.dota2.com/datafeed/herodata?language=english&hero_id=155)
4. **Brewmaster** cycles three stances. Casting makes him "Brewed Up" for 5 s, followed by a 9 s hangover. His ultimate splits him into three controllable brewlings, and he dies only if all three die. — [Brewmaster feed](https://www.dota2.com/datafeed/herodata?language=english&hero_id=78)
5. **Ancient Apparition's Ice Blast** is a map-wide two-press spell: the explosion grows with the tracer's flight time, and it blocks all healing and executes below 12-14% health. — [AA feed](https://www.dota2.com/datafeed/herodata?language=english&hero_id=68)
6. **Faceless Void's Time Walk** dashes and undoes the damage he took in the last 2 s. With Scepter he can rewind back to the start point. — [Faceless Void feed](https://www.dota2.com/datafeed/herodata?language=english&hero_id=41)
7. **Chronosphere** freezes everything in an area, allies included, except Faceless Void and his own units. — [Faceless Void feed](https://www.dota2.com/datafeed/herodata?language=english&hero_id=41)
8. **Disruptor's Glimpse** sends an enemy back to where it stood 4 s ago, with damage based on the distance. — [Disruptor feed](https://www.dota2.com/datafeed/herodata?language=english&hero_id=87)
9. **Kunkka's X Marks the Spot** marks a hero's position and snaps it back later. Admiral's Rum delays part of the damage he takes, and the delayed part cannot kill. — [Kunkka feed](https://www.dota2.com/datafeed/herodata?language=english&hero_id=23)
10. **Rupture** deals damage per unit of distance the victim moves. **Cold Feet** stuns only if the victim does NOT move away: two opposite movement tests. — [Bloodseeker feed](https://www.dota2.com/datafeed/herodata?language=english&hero_id=4); [AA feed](https://www.dota2.com/datafeed/herodata?language=english&hero_id=68)
11. **Medusa's Stone Gaze** petrifies only units that face her for 2 s in total. Her innate Mana Shield turns mana into extra health. — [Medusa feed](https://www.dota2.com/datafeed/herodata?language=english&hero_id=94)
12. **Directional armour:** Bristleback takes less damage from the side and rear. Mars blocks from the front and can toggle Bulwark to drag attack projectiles aimed at allies onto himself. — [Bristleback feed](https://www.dota2.com/datafeed/herodata?language=english&hero_id=99); [Mars feed](https://www.dota2.com/datafeed/herodata?language=english&hero_id=129)
13. **Bane's Nightmare** is a sleep that can be cast on allies as a save, and it jumps to whoever attacks the sleeper. — [Bane feed](https://www.dota2.com/datafeed/herodata?language=english&hero_id=3)
14. **Grimstroke's Soulbind** chains two enemy heroes together, and every unit-targeted spell on one is copied onto the other. — [Grimstroke feed](https://www.dota2.com/datafeed/herodata?language=english&hero_id=121)
15. **Morphling** shifts Strength and Agility live with two toggles, and Morph copies an enemy hero's basic abilities. With Scepter, echo copies re-cast his targeted spells. — [Morphling feed](https://www.dota2.com/datafeed/herodata?language=english&hero_id=10)
16. **Ability stealing and unit stealing:** Doom eats a creep and keeps its spells, and Chen converts creeps. Anti-Mage's Counterspell reflects targeted spells back at the caster. — [Doom feed](https://www.dota2.com/datafeed/herodata?language=english&hero_id=69); [Chen feed](https://www.dota2.com/datafeed/herodata?language=english&hero_id=66); [Anti-Mage feed](https://www.dota2.com/datafeed/herodata?language=english&hero_id=1)
17. **Earth Spirit's spells use Stone Remnants as ammunition** (7 charges). With Scepter he can turn a hero into a remnant to kick or pull it. — [Earth Spirit feed](https://www.dota2.com/datafeed/herodata?language=english&hero_id=107)
18. **Terrain creation is common in this half:**
    - Fissure — [Earthshaker](https://www.dota2.com/datafeed/herodata?language=english&hero_id=7)
    - Kinetic Field and Fence — [Disruptor](https://www.dota2.com/datafeed/herodata?language=english&hero_id=87)
    - Ice Path — [Jakiro](https://www.dota2.com/datafeed/herodata?language=english&hero_id=64)
    - Ice Wall — [Invoker](https://www.dota2.com/datafeed/herodata?language=english&hero_id=74)
    - Arena of Blood — [Mars](https://www.dota2.com/datafeed/herodata?language=english&hero_id=129)
    - Glacier — [Drow Ranger](https://www.dota2.com/datafeed/herodata?language=english&hero_id=6)
    - Power Cogs — [Clockwerk](https://www.dota2.com/datafeed/herodata?language=english&hero_id=51)
    - planted trees (Acorn Shot) — [Hoodwink](https://www.dota2.com/datafeed/herodata?language=english&hero_id=123)
    - permanent webs — [Broodmother](https://www.dota2.com/datafeed/herodata?language=english&hero_id=61)
19. **Monkey King** stands on top of trees and falls stunned if the tree is cut. Mischief disguises him as a nearby object. — [Monkey King feed](https://www.dota2.com/datafeed/herodata?language=english&hero_id=114)
20. **Hoodwink's Sharpshooter** is a hold-to-charge skillshot (max at 3 s, auto-fires at 5 s) with recoil. Her net stuns only enemies near a tree. — [Hoodwink feed](https://www.dota2.com/datafeed/herodata?language=english&hero_id=123)
21. **Io's Tether** passes Io's healing to an ally. Relocate is a global teleport of both that automatically returns them 12 s later. — [Io feed](https://www.dota2.com/datafeed/herodata?language=english&hero_id=91)
22. **Clones that are the real hero:** Meepo's clones share items, and if one dies all die. Arc Warden's Tempest Double doubles every spell and item, with separate cooldowns. — [Meepo feed](https://www.dota2.com/datafeed/herodata?language=english&hero_id=82); [Arc Warden feed](https://www.dota2.com/datafeed/herodata?language=english&hero_id=113)
23. **Damage-to-heal and cannot-die effects:** Borrowed Time turns damage into healing and fires automatically below 400 health. Shallow Grave keeps health at 1 or above. — [Abaddon feed](https://www.dota2.com/datafeed/herodata?language=english&hero_id=102); [Dazzle feed](https://www.dota2.com/datafeed/herodata?language=english&hero_id=50)
24. **Leaving the body:** Dazzle's Nothl Projection sends out an invulnerable spirit while the body stays behind on a tether. Lifestealer's Infest hides him inside an ally or a creep, and with Scepter inside an enemy hero. — [Dazzle feed](https://www.dota2.com/datafeed/herodata?language=english&hero_id=50); [Lifestealer feed](https://www.dota2.com/datafeed/herodata?language=english&hero_id=54)
25. **Alchemist's Unstable Concoction** is a hold-and-release grenade with a timer the enemy can see, and it blows up on him if held too long. His Scepter can be given away to an ally. — [Alchemist feed](https://www.dota2.com/datafeed/herodata?language=english&hero_id=73)
26. **Huskar** pays health instead of mana (Blood Magic), and Berserker's Blood makes him stronger the lower his health. — [Huskar feed](https://www.dota2.com/datafeed/herodata?language=english&hero_id=59)
27. **Legion Commander's Duel** forces a 1v1 in which neither hero can use items. The winner gains damage permanently. — [Legion Commander feed](https://www.dota2.com/datafeed/herodata?language=english&hero_id=104)
28. **Elder Titan acts from two bodies:** he and his Astral Spirit both cast Echo Stomp. Natural Order strips base armor near him and magic resistance near the spirit. — [Elder Titan feed](https://www.dota2.com/datafeed/herodata?language=english&hero_id=103)
29. **Vector trick shots:** Muerta fires at a unit or a tree and the bullet ricochets in a second chosen direction. Marci bounces off an ally in a chosen direction. — [Muerta feed](https://www.dota2.com/datafeed/herodata?language=english&hero_id=138); [Marci feed](https://www.dota2.com/datafeed/herodata?language=english&hero_id=136)
30. **Randomness and counters:**
    - Chaos Bolt's stun and damage are random and inversely linked. — [Chaos Knight](https://www.dota2.com/datafeed/herodata?language=english&hero_id=81)
    - Axe's Counter Helix fires after a fixed count of attacks. — [Axe](https://www.dota2.com/datafeed/herodata?language=english&hero_id=2)
    - Enchantress's Impetus scales with distance to the target. — [Enchantress](https://www.dota2.com/datafeed/herodata?language=english&hero_id=58)
    - Lich's Chain Frost lingers and waits for a new target. — [Lich](https://www.dota2.com/datafeed/herodata?language=english&hero_id=31)

### Inferences
- **The rare mechanics share one trait: they add a decision on top of "aim and press".** Which orbs to combine, which weapon to hold, whether to press on the beat, which direction to bounce, when to release a held charge, and where to return. In a 1v1 game these decision layers matter more than raw numbers, because there is no team to cover a hero's weak moments.
- **Time and state tricks need a strong visual so the opponent can read them** (Time Walk's rewind, Glimpse's return path, X Marks the Spot's marker, Relocate's minimap marker). Dota gives each a visible marker or trail.

### Gaps
- **N to Z is not covered:** this list covers only heroes A to M. Some classic examples of these mechanics are in the other half (Rubick's spell steal, Pangolier, Spectre, Weaver's Time Lapse, Void Spirit).
