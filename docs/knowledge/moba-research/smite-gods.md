# Smite and Smite 2: every god's abilities, how they are cast and aimed (reference for a top-down 1v1 MOBA)

Research date: 19 November 2026. **Smite 2 data** comes from the Smite 2 wiki's god pages (read through its MediaWiki API on 19 Nov 2026). The newest patch it covers is **Open Beta 48, the "Sleeping Giant Update", 16–17 Nov 2026**, which added Kumbhakarna ([smite2.live OB48 notes](https://smite2.live/news/open-beta-48-notes)). Smite 2 is still numbered "Open Beta" even though it is the live game. **Smite 1 data** comes from the Smite 1 wiki (smite.fandom.com). Its patch list ends at **12.1, 21 Jan 2025**, Smite 1's last numbered update ([Smite 1 wiki, Patch notes](https://smite.fandom.com/wiki/Patch_notes)).

How to read the entries:
- **Units.** Smite 2 states ranges in metres. Smite 1 used "units" (u). The two games' own numbers give the conversion: a ranged basic attack is 55 u in Smite 1 and 8.8 m in Smite 2, and a melee basic is 12 u and 1.92 m. So **1 u = 0.16 m**. A typical Smite 2 skillshot is 8.8–11.2 m, a typical circle radius 2.4–3.2 m, and melee reach is 1.92 m (2.56 m for long-reach melee).
- **Slots.** P = passive, 1/2/3 = abilities, U = ultimate. The damage numbers are rank 1 to rank 5. Cooldowns (CD) and costs are the wiki's values for this patch. Where only a range of values was captured, read it as approximate.
- **Tag legend** (the `[TAGS]` on each line; the tally at the end counts these):
  - LINE-PROJ: a fired projectile that stops on the first enemy hit, or the first god for "passes minions" shots. Walls usually block it.
  - LINE-PIERCE: a line or projectile that passes through enemies, and often through walls.
  - LINE: a non-projectile line or rectangle in front of the god.
  - CONE: a cone or arc in front of the god.
  - GROUND: a circle placed on the ground at a range cursor. GROUND-PROJ: a lobbed projectile that lands on the cursor.
  - DELAY: has a visible wind-up or a delayed detonation.
  - SELF-AOE: a circle around the god.
  - LEAP: an arcing jump to a spot, which goes over units and sometimes walls. DASH: a ground dash that collides with things. BLINK / TELEPORT: instant relocation.
  - SELF-BUFF, AURA, NEXT-ATTACK: empowers the god's next basic attack(s).
  - STANCE / TOGGLE / TRANSFORM.
  - CHANNEL: the god must keep holding it. CHARGE: hold to power up, release to fire.
  - RECAST / MULTI-STAGE: press again for a second effect.
  - DEPLOY: a placed object such as a wall, totem, trap or turret. SUMMON: a pet or minion.
  - GLOBAL: reaches the whole map. TARGET-ALLY: aimed onto an ally.
  - PULL / GRAB, UNTARGETABLE, STEALTH, STEERED: the god or the projectile is steered after it is cast.
- **Aiming.** Smite has no unit-click targeting. Every ability is aimed by facing (the third-person camera points the god) with a targeter drawn in front of the god (line, cone or arrow), or by a ground circle at a cursor distance in front of the god. The rare enemy "target" abilities pick the enemy nearest the centre of a small aimed area: Raijin's 2 is described this way ([Smite 1 wiki, Raijin](https://smite.fandom.com/wiki/Raijin)), and Loki's teleport locks onto the god nearest its centre ([S2 wiki API, Loki](https://wiki.smite2.com/api.php?action=query&prop=revisions&rvprop=content&rvslots=main&titles=Kumbhakarna|Kuzenbo|Loki|Maman_Brigitte&format=json)). How ally-targeted abilities (Athena's ult, Geb's shield, Horus' leap) choose their ally is from background knowledge and unconfirmed: they snap to the ally nearest the reticle.
- **General counterplay rules (inference, not stated per ability).**
  - In Smite 2, every player starts with Purification Beads in a unique slot: an active that cleanses the user ([S2 wiki, Alpha Weekend 1 snippet](https://wiki.smite2.com/api.php?action=query&list=search&srsearch=Purification%20Beads%20Aegis%20cleanse%20immune&srnamespace=0&srlimit=20&format=json)). The Crowd Control page adds only that "some abilities and items provide CC immunity or cleanse" ([S2 wiki, Crowd Control](https://wiki.smite2.com/w/Crowd_Control)).
  - Inference: any hard CC (stun, root, silence, fear, taunt, mesmerize, knock-up/back, pull, grab, banish, polymorph, disarm) can be cleansed or pre-empted with Beads or a CC-immunity ability. The brief CC immunity after Beads, and an Aegis-style damage-immunity item, are from background knowledge and were not confirmed on a Smite 2 item page. Abilities whose notes say "CC immune while active" ignore enemy CC. "Displacement immune" ignores knockbacks, pulls and knock-ups only. In Smite 2, hard-CC diminishing returns work like this: each hard CC adds 2 stacks and each displacement 4, up to 4 stacks; each stack cuts hard-CC duration by 10%; the stacks last 6 s; some abilities ignore DR ([S2 wiki, Crowd Control](https://wiki.smite2.com/w/Crowd_Control)).

## For each god, what are its abilities and how is each cast and aimed?

### Takeaway
All 96 gods with a Smite 2 god page (out of the 98 the wiki's Gods page lists) and all 38 Smite-1-only gods are covered below. Smite kits are built almost entirely from aimed lines, cones and ground circles fired in the god's facing direction, plus many leaps and dashes. Nearly every god has one "mobility or immunity" tool and one "hard CC" tool, and the projectiles' notes say exactly what blocks them: minions, gods or walls. That last point is the main lever for counterplay.

### Cited Findings

#### Roster and versions
- The Smite 2 wiki's Gods page lists 98 gods but says "There are currently 96 playable gods in the game." Heimdallr and Maman Brigitte are listed and linked, but both god pages return 404, so they are treated here as not yet in Smite 2 and given their Smite 1 kits ([S2 wiki, Gods](https://wiki.smite2.com/w/Gods); [S2 wiki, Heimdallr (404)](https://wiki.smite2.com/w/Heimdallr)).
- The Smite 2 "List of gods" table gives each god's role (Solo, Jungle, Mid, Carry, Support), not a class. The Smite 2 infobox has no class field: it has `role1`, `role2`, `attack type` and `attack damage` ([S2 wiki, List of gods](https://wiki.smite2.com/w/List_of_gods); [S2 wiki API, Zeus](https://wiki.smite2.com/api.php?action=query&prop=revisions&rvprop=content&rvslots=main&titles=Zeus&format=json)). The class shown for each god below (Guardian, Warrior, Assassin, Mage, Hunter) is its **Smite 1** class from the Smite 1 list ([Smite 1 wiki, List of gods](https://smite.fandom.com/wiki/List_of_gods)). Aladdin, Hecate, Mordred and Princess Bari exist only in Smite 2, so no class is confirmed for them.
- Smite 1 had 130 gods. 39 of them are not on the Smite 2 roster pages. Two of those (Heimdallr, Maman Brigitte) are listed but not live in Smite 2, and Mulan was reworked as "Hua Mulan" ([Smite 1 wiki, List of gods](https://smite.fandom.com/wiki/List_of_gods)).
- In Smite 2, ranged basic attacks are almost all an 8.8 m, 0.48 m-radius projectile that stops on the first target and is blocked by walls. Melee basics are a 120° cone of 1.92 m (2.56 m on Achilles, Awilix, Gilgamesh and Cu Chulainn) that hits the enemy nearest the cone's centre. Many melee gods have 3- to 5-hit "chains", each hit with its own damage multiplier and swing time, and the last hit often cleaves (the per-god pages, e.g. [S2 wiki API batch](https://wiki.smite2.com/api.php?action=query&prop=revisions&rvprop=content&rvslots=main&titles=Athena|Atlas|Awilix|Bacchus&format=json)).

#### Smite 2 roster (current), A to Z

##### Achilles (Greek; S1 class Warrior; S2 role Solo; melee physical)
Source: [S2 wiki API, Achilles](https://wiki.smite2.com/api.php?action=query&prop=revisions&rvprop=content&rvslots=main&titles=Achilles&format=json)
- Basic: melee 120° cone, 2.56 m (longer than the 1.92 m melee standard); hits the enemy nearest the cone centre.
- **P Gift of the Gods** `[STANCE]` Armored (bonus health, protections) or Unarmored (strength, move speed); swap only in the fountain. Changes how 2 and 3 behave.
- **1 Shield of Achilles** `[CONE]` 80° cone, inner 3.2 m hits hard, outer "radiated force" to 8 m hits weaker; stun 0.8 s (+0.2 s armored). Dmg 100–320. CD 14 s, 60–80 mana. Counter: short-range telegraphed swing; beads/aegis.
- **2 Radiant Glory** `[SELF-BUFF]` 6.1 s: +strength, +protections, CC reduction 20–30%, heals per hit; armored adds a shield; unarmored shreds protections on hits from behind. CD 9 s.
- **3 Combat Dodge / Spear Strike** `[DASH,RECAST]` short dodge (3.2 m) in any direction, then within 4 s a spear thrust (5.6 m line, 0.96 m wide); god hit allows one more dodge. Dmg 65–225; armored version slows 7.5%/stack. CD 14–12 s.
- **U Fatal Strike** `[DASH,RECAST]` 1 s wind-up (CC immune), then dash 5.6 m that stops on the first god; executes gods under 35% HP; each kill allows a recast (up to 5). Dmg 180–540. CD 90 s. Counter: wind-up is the tell; walls stop it.
- Aspect of Prowess: dodge recast also off jungle monsters; spear scales more; Radiant Glory loses protections/CC reduction.

##### Agni (Hindu; Mage; Mid; ranged magical)
Source: [S2 wiki API, Agni](https://wiki.smite2.com/api.php?action=query&prop=revisions&rvprop=content&rvslots=main&titles=Agni&format=json)
- Basic: projectile 8.8 m, 0.48 m radius, stops on first target, blocked by walls (standard ranged basic in S2).
- **P Combustion** `[PASSIVE]` basic hits (+1) and god hits (+2) build 4 stacks; next Flame Wave or Rain Fire ignites (burn 3 s). A god kill gives 10 s of unlimited ignites.
- **1 Noxious Fumes** `[GROUND]` cloud at 8.8 m range, 3.2 m radius, lasts 10 s, ticks small damage; any other Agni ability detonates it for burst + 0.8 s stun + 40% anti-heal. CD 13 s. Counter: walk out before he detonates; beads.
- **2 Flame Wave** `[LINE-PIERCE]` 8 m wave, 2.59 m wide, passes all enemies and walls. Dmg 100–320. CD 15–13 s.
- **3 Path of Flames** `[DASH]` 9.6 m dash leaving a burning trail (3 s); displacement immune while dashing. CD 16 s.
- **U Rain Fire** `[GROUND,CHARGES]` meteor at 10.4 m range, 3.2 m radius; 3 charges; Agni is slowed 50% while calling. Dmg 115–295 each. CD 20 s per charge, 10 mana. Counter: small circles, short travel time; dodge sideways.
- Aspect (Combustion): basics stack ignite; Wave and Rain consume ignites for burst; Rain Fire base lowered.

##### Ah Puch (Maya; Mage; Mid; ranged magical)
Source: [S2 wiki API, Ah Puch](https://wiki.smite2.com/api.php?action=query&prop=revisions&rvprop=content&rvslots=main&titles=Ah_Puch&format=json)
- **P Hollow Ground** `[PASSIVE]` abilities leave corpses (max 6, 45 s); walking over one cuts CDs by 1 s and restores 3% HP/mana; enemy gods can destroy corpses in 2 hits.
- **1 Undead Surge** `[LINE-PROJ,RECAST]` 9.6 m line, 3.2 m wide wave of undead that stops on first hit; slow 20–40% (2 s), 25% anti-heal; reactivate to explode early. Blocked by walls. CD 10 s.
- **2 Corpse Explosion** `[GROUND]` 8.8 m range, 3.2 m radius; corpses inside explode for extra damage. CD 10 s.
- **3 Fleeting Breath** `[GROUND]` 2.08 m radius miasma for 4 s, ending with burst + 1.5 s stun; enemies who heal inside take more and are stunned at the end. CD 10 s.
- **U Empty the Crypts** `[SELF-AOE]` huge 16 m radius field around him for 6 s, ticks every 0.5 s, stacking anti-heal and damage-dealt reduction; his next 3 attacks launch zombies. CD 110 s. Counter: leave the zone; it is not a channel in S2 (unlike S1).
- Aspect of Death March: Corpse Explosion becomes Wraith Call (summoned wraiths), ult slows.

##### Aladdin (Tales of Arabia; S2-original, no S1 class; Jungle; melee magical)
Source: [S2 wiki API, Aladdin](https://wiki.smite2.com/api.php?action=query&prop=revisions&rvprop=content&rvslots=main&titles=Aladdin&format=json)
- Basic: 5-hit chain, last three cleave.
- **P Three Wishes** `[PASSIVE]` gains Genie charges (one per 10 s, faster from kills); three one-time wishes: Wealth (gold), Immortality (revive), Power (reset cooldowns). Tied to his god item Genie's Lamp.
- **1 Kufic Invocation** `[CHARGE,CONE,LINE-PIERCE]` hold to charge: the 90° spread of symbols narrows; full charge merges them into one long shot (11.2 m). Symbols return to him and hit again. Passes walls. Refire with a Genie charge within 5 s. CD 13 s.
- **2 Sultan's Grace** `[DASH,RECAST]` 6.4 m dash punch, more damage the lower his HP; with a charge the Genie adds 5 punches; refire within 5 s. CD 16–14 s.
- **3 Agile Run** `[DASH,WALL-RUN,LEAP]` dash 7.2 m; if he hits a wall he runs along it, then leaps 8.8 m to a 3.2 m circle, knocking up; Genie knocks back. Landing on a god cuts CD. CD 18 s.
- **U Into The Lamp** `[LINE-PROJ,DUEL]` 13.6 m projectile that stops on the first enemy god and pulls both into a lamp for a 16 s private duel (escape opens at 8 s; interact 0.5 s, interrupted by damage); outsiders deal/take 33% less. CD 90 s. Counter: sidestep the projectile or body-block it with another god; beads before impact.
- Aspect: none listed on the page.

##### Amaterasu (Japanese; Warrior; Solo; melee physical)
Source: [S2 wiki API batch](https://wiki.smite2.com/api.php?action=query&prop=revisions&rvprop=content&rvslots=main&titles=Amaterasu|Anhur|Anubis|Aphrodite&format=json)
- **P Illuminating Strike** `[PASSIVE]` 3 basic/ult hits mark the target and enemies within 4.8 m: +10% damage taken for 6 s.
- **1 Divine Presence** `[SELF-BUFF,AURA]` 5.6 m aura alternating Gold (shield, speed) and Red (attack speed, power); heals her over 4 s. CD 12 s.
- **2 Heavenly Reflection** `[CHARGE,LINE-PIERCE]` mirror charges from damage dealt and taken (15% damage reduction meanwhile, up to 5 s), then fires an 8.8 m projectile through all enemies and walls; full charge doubles base damage. CD 12 s.
- **3 Glorious Charge** `[DASH]` silences (1 s) enemies in front, then dashes 8.8 m; stops on walls and gods. CD 15 s.
- **U Dazzling Offensive** `[CONE,MULTI-STAGE]` CC immune, three strikes in a 110° cone of 5.6 m: 2nd slows 30%, 3rd stuns 1.2 s. CD 90 s.
- Aspect of Valor: aura locked to Red with haste and basic-attack power.

##### Anhur (Egyptian; Hunter; Carry; ranged physical)
Source: [S2 wiki API batch](https://wiki.smite2.com/api.php?action=query&prop=revisions&rvprop=content&rvslots=main&titles=Amaterasu|Anhur|Anubis|Aphrodite&format=json)
- **P Enfeeble** `[PASSIVE]` damage shreds physical protection (4 s).
- **1 Shifting Sands** `[GROUND,DEPLOY]` obelisk at 11.2 m with a 9.6 m sand field (slow 15%, more near the obelisk; enemies take 12–24% more basic damage); the obelisk is a wall (lasts 7.5 s, reactivate to remove). CD 14–12 s.
- **2 Impale** `[LINE-PROJ,WALL-STUN]` 8.8 m spear passes minions, pushes the first god; if the god hits a wall, stun 0.9–1.1 s; the pushed god damages enemies it collides with. CD 11 s. Counter: stand away from walls; sidestep.
- **3 Disperse** `[LEAP]` 8.8 m leap; knockback in 2.4 m on landing. CD 15–13 s.
- **U Desert Fury** `[LINE-PIERCE,CHANNEL]` 4 spears then a wider final spear over 1.5 s, 12.8 m, pierce all enemies and walls; CC immune while firing; re-aimable during the volley. CD 90–70 s.
- Aspect of Pride: passive becomes stacking attack speed on one god.

##### Anubis (Egyptian; Mage; Mid; ranged magical)
Source: [S2 wiki API batch](https://wiki.smite2.com/api.php?action=query&prop=revisions&rvprop=content&rvslots=main&titles=Amaterasu|Anhur|Anubis|Aphrodite&format=json)
- **P The Scales** `[PASSIVE]` lifesteal and protections, more as his HP drops.
- **1 Plague of Locusts** `[CONE,CHANNEL]` 110° cone, 5.6 m, 12 ticks over 2.5 s; Anubis is self-slowed 35–15%, displacement immune. CD 10–8 s.
- **2 Mummify** `[LINE-PROJ]` 11.2 m bandage, passes minions, stops on first god or wall: stun 0.85–1.05 s. CD 16–14 s. Counter: sidestep, or stand behind another god.
- **3 Grasping Hands** `[GROUND]` 3.2 m circle at 8.8 m, 4 hits over 1.5 s, slow 25%. CD 14–10 s.
- **U Death Gaze** `[LINE-PIERCE,CHANNEL]` 11.2 m beam, 0.72 m wide, initial burst then 24 ticks over 2.4 s; rooted but CC immune; the beam turns with his aim. CD 90 s. Counter: beam is thin; strafe out; he cannot move.
- Aspect: none listed on the page.

##### Aphrodite (Greek; Mage; Mid/Support; ranged magical)
Source: [S2 wiki API batch](https://wiki.smite2.com/api.php?action=query&prop=revisions&rvprop=content&rvslots=main&titles=Amaterasu|Anhur|Anubis|Aphrodite&format=json)
- **P Center of Attention** `[PASSIVE]` +protections per nearby god (friend or foe).
- **1 Kiss** `[LINE-PROJ,TARGET-ALLY]` 8.8 m projectile passes minions and walls, stops on gods: on an ally it links them as Soul Mate; on an enemy it stuns 0.8 s. CD 14–12 s.
- **2 Back Off!** `[SELF-AOE]` 3.2 m knockback + 30% slow around her, and a second blast around her Soul Mate. CD 14–12 s.
- **3 Love Birds** `[LINE-PIERCE,HEAL]` 11.2 m dove passes all; damages enemies, heals her and the Soul Mate over 3 s. CD 16–14 s.
- **U Undying Love** `[SELF-BUFF,TARGET-ALLY]` she and the Soul Mate become damage- and CC-immune for 0.8–2 s; reactivate to leap to the Soul Mate. CD 100–90 s.
- Aspect of Heartbreak: Kiss charms and links an enemy instead; the kit turns around linked enemies.

##### Apollo (Greek; Hunter; Carry; ranged physical)
Source: [S2 wiki API batch](https://wiki.smite2.com/api.php?action=query&prop=revisions&rvprop=content&rvslots=main&titles=Apollo|Ares|Artemis|Artio&format=json)
- **P Audacity** `[PASSIVE]` 10 stacks → next 5 basics +100% attack speed, +20% projectile speed.
- **1 So Beautiful** `[LINE-PIERCE]` 8.8 m piercing shot, passes walls. CD 11 s.
- **2 Serenade** `[SELF-AOE]` mesmerize 1.5–2.3 s in 3.2 m around him; +protections 5 s. CD 15 s. Counter: mesmerize breaks on damage; keep distance.
- **3 The Moves** `[DASH]` 7.2 m dash knocks enemies aside; at the end slows enemies and speeds allies (3.2 m). CD 15 s.
- **U Across the Sky** `[GLOBAL,UNTARGETABLE,LEAP]` rises into a chariot, flies anywhere (mana per second), up to 2 allies can hop in; chooses where to land: 3.2 m area, damage ticks and knockback. CD 110 s.
- Aspect of Harmony: passive grants free So Beautiful casts; Serenade shields allies.

##### Ares (Greek; Guardian; Support; melee magical)
Source: [S2 wiki API batch](https://wiki.smite2.com/api.php?action=query&prop=revisions&rvprop=content&rvslots=main&titles=Apollo|Ares|Artemis|Artio&format=json)
- **P Blessed Armaments** `[AURA]` strength/intelligence aura (allies get half).
- **1 Shackles** `[LINE-PROJ,RECAST]` 8.8 m shackle, stops on gods, passes walls/minions: slow 15% + cripple 4 s, damage ticks while chained; up to 3 shackles (refire within 2 s after a god hit). CD 15 s.
- **2 Call to Arms** `[AURA,SELF-BUFF]` 5.6 m: protections and attack damage for him and allies, extended by hitting 3 gods. CD 15–13 s.
- **3 Searing Flesh** `[CONE,CHANNEL]` 45° cone, 5.6 m, damage + %max HP + 40% anti-heal; displacement immune. CD 12 s.
- **U No Escape** `[SELF-AOE,PULL,CHANNEL]` chains enemy gods within 5.6 m, 2.5 s channel (CC immune, 40–60% mitigation); at 2.17 s they are dragged to him and stunned 0.75 s (2.8 m). CD 90 s. Counter: beads/aegis break the chain; leaving range before the chain lands.
- Aspect of Reverberation: No Escape roots instead of pulling.

##### Artemis (Greek; Hunter; Carry; ranged physical)
Source: [S2 wiki API batch](https://wiki.smite2.com/api.php?action=query&prop=revisions&rvprop=content&rvslots=main&titles=Apollo|Ares|Artemis|Artio&format=json)
- **P Still Target** `[PASSIVE]` +15% basic damage to CC'd gods.
- **1 Transgressor's Fate** `[DEPLOY,TRAP]` trap at 6.4 m (0.8 m), up to 4: an enemy god stepping in is rooted + crippled 1.75 s and takes damage over 3 s. CD 14–10 s. Counter: traps are visible; walk around or destroy.
- **2 Vengeful Assault** `[SELF-BUFF]` +25% move, +20–60% attack speed, cleanses slows; 4 god hits extend 3 s. CD 14 s.
- **3 Suppress the Insolent** `[GROUND]` 2.4 m circle at 8.8 m, slow 20% 2 s. CD 9 s.
- **U Calydonian Boar** `[SUMMON]` boar (350–750 HP) charges the nearest enemy god within 9.6 m: stun 0.9–1.3 s, keeps hunting gods. CD 100 s. Counter: kill the boar after its first hit; beads.
-
- Aspect of the Wild: trap no longer roots/cripples gods but can catch minions, heals her and hits a larger area.

##### Artio (Celtic; Guardian; Solo/Support; ranged in Druid, melee in Bear)
Source: [S2 wiki API batch](https://wiki.smite2.com/api.php?action=query&prop=revisions&rvprop=content&rvslots=main&titles=Apollo|Ares|Artemis|Artio&format=json)
- **P Decompose** `[PASSIVE]` ability hits shred 2% protections per stack (5).
- **U Shapeshift** `[STANCE]` toggles Druid and Bear; each form has its own 1/2/3; hits build Invigoration stacks.
- Druid **1 Energy Surge** `[CONE]` 120°, 4 m, damage + 40% anti-heal, heals allies near gods hit. **2 Entangling Vines** `[SELF-AOE]` 3.2 m vines around her cripple and cut enemy power while inside, 4 s. **3 Life Tap** `[LINE-PIERCE,CHANNEL]` 2 s 8.8 m drain, slows per hit, roots 1 s if all 5 hits land.
- Bear **1 Maul Prey** `[CONE]` two swipes 120° 4 m, anti-heal. **2 Ferocious Roar** `[SELF-AOE]` 3.2 m stun 1–1.4 s + protections. **3 Heavy Charge** `[DASH]` 3 s run at +100% speed, enemies passed take damage, slow 20%; displacement immune.
- CDs 12–15 s. Aspect of the Denmother: stance swap only in fountain; enhanced abilities and a form-specific ult.

##### Athena (Greek; Guardian; Support; melee magical)
Source: [S2 wiki API batch](https://wiki.smite2.com/api.php?action=query&prop=revisions&rvprop=content&rvslots=main&titles=Athena|Atlas|Awilix|Bacchus&format=json)
- Basic: 3-hit chain, final cleaves.
- **P Reach** `[PASSIVE]` after any ability her next basic is an 8.8 m projectile that pierces all enemies and walls.
- **1 Preemptive Strike** `[DASH]` 0.66 s build-up, then 8.8 m dash; slow 20–30%, protections if it hits a god; stops on walls/gods. CD 14 s.
- **2 Confound** `[CONE]` 90°, 5.6 m: taunt 0.75–1.35 s (+ with protections) and slow. CD 16–14 s.
- **3 Shield Wall** `[SELF-AOE,DELAY]` 3.2 m around her, hits now and again 2 s later, slowing each time. CD 12 s.
- **U Defender of Olympus** `[GLOBAL,TARGET-ALLY,CHANNEL]` choose an ally anywhere, shield them, channel 3.34 s (CC immune), teleport and damage on landing. CD 120–100 s.
- Aspect of War: ult targets a visible enemy god instead.

##### Atlas (Greek; S1 Guardian; Support; melee magical)
Source: [S2 wiki API batch](https://wiki.smite2.com/api.php?action=query&prop=revisions&rvprop=content&rvslots=main&titles=Athena|Atlas|Awilix|Bacchus&format=json)
- **P The Astrolabe** `[PASSIVE,INTERACT]` Energy from damage dealt/taken; at 20 press interact for an empowered strike (tremble 2 s on gods).
- **1 Unburden** `[GROUND,DEPLOY,RECAST]` throw the Astrolabe 8 m (4 m radius, slow); while deployed his basics trigger explosions that cost mana; returns after 5 s or refire. CD 14–10 s.
- **2 Gravity Pull** `[CONE,PULL]` 75° cone 5.6 m pulls enemies to him (or to the deployed Astrolabe), then launches them in his facing direction (or toward him). Not through walls. CD 16 s.
- **3 Kinetic Charge** `[DASH]` up to 3 s charge, cleanses allies he passes (speed), explodes on an enemy god for a slow that grows per ally cleansed. CD 16–14 s.
- **U Gamma-Ray Burst** `[GROUND,DELAY,LINE-PIERCE]` huge-range (320 m) burst area that ticks and stacks Radiation; after 5 s (or refire) it focuses into a travelling beam through walls. CD 90 s.
-
- Aspect of the Unburdened: basics throw the Astrolabe, Unburden repositions it, the passive cuts ult CD.

##### Awilix (Maya; Assassin; Jungle; melee physical)
Source: [S2 wiki API batch](https://wiki.smite2.com/api.php?action=query&prop=revisions&rvprop=content&rvslots=main&titles=Athena|Atlas|Awilix|Bacchus&format=json)
- **P Initiative** `[PASSIVE]` after 5 s out of combat, first strike grants +25% power for 4 s.
- **1 Summon Suku** `[SELF-BUFF,LEAP,RECAST]` mount the panther (+30% speed, lower strafe speed), recast to leap off onto an 8.8 m target circle (2.24 m). CD 15 s.
- **2 Feather Step** `[LEAP,TARGET-LAST-HIT]` flip over the last enemy hit (within 1.5 s): root + cripple 0.6 s, briefly untargetable in the air. CD 9 s.
- **3 Moonlight Charge** `[LINE-PIERCE]` Suku rushes 11.2 m through walls; knocks up only enemies hit from the side or behind. CD 12 s.
- **U Gravity Surge** `[PULL,AUTO-TARGET]` pulls the closest knocked-up or leaping enemy god within 12 m, stun 0.5 s on landing; she gains attack speed and root/slow/displacement protection 6 s. CD 90–70 s. Counter: needs an airborne target.
-
- Aspect: none listed on the page.

##### Bacchus (Roman; Guardian; Support; melee magical)
Source: [S2 wiki API batch](https://wiki.smite2.com/api.php?action=query&prop=revisions&rvprop=content&rvslots=main&titles=Athena|Atlas|Awilix|Bacchus&format=json)
- **P Drunk-O-Meter** `[PASSIVE,RESOURCE]` drunkenness 0–100% (Tipsy 30%, Smashed 60%) gives power and protections, decays 2%/s.
- **1 Chug** `[SELF-BUFF]` drink: heal, drunkenness, next basic empowered. CD 10 s.
- **2 Belly Flop** `[LEAP]` 8.8 m leap, 2.4 m knock-up, slow if Tipsy. CD 14 s.
- **3 Belch of the Gods** `[CONE,CHANNEL]` 90°, 5.6 m, 1.5 s: damage + anti-heal; final hit stuns 0.9–1.1 s if Tipsy. CD 12–10 s.
- **U Intoxicate** `[SELF-AOE]` 5.6 m: damage + intoxicate 4 s (drunk-walking: movement drifts). CD 90 s.
-
- Aspect of Revelry: after Chug his basics cleave with Strength-scaled bonus damage.

##### Baron Samedi (Voodoo; Mage; Mid/Support; ranged magical)
Source: [S2 wiki API batch](https://wiki.smite2.com/api.php?action=query&prop=revisions&rvprop=content&rvslots=main&titles=Baron_Samedi|Bastet|Bellona|Cabrakan&format=json)
- **P Hysteria** `[PASSIVE,RESOURCE-ON-ENEMY]` his damage builds Hysteria on enemies (max 70); above 30 his abilities gain extras. Team can buy Baron's Brew.
- **1 Vivid Gaze** `[LINE-PIERCE,X-SHAPE]` skulls in an X (9.6 m), pierce walls; overlap +25%; above 30 Hysteria reduces stats. CD 11–9 s.
- **2 Consign Spirits** `[GROUND]` 2.88 m circle, heals allies when it hits gods. CD 14 s.
- **3 Wrap It Up** `[LINE-PROJ]` 9.6 m snake, passes minions, stops on gods/walls: slow then root 0.75 s; above 30 Hysteria explodes into a mesmerize. CD 16–14 s.
- **U Life of the Party** `[CONE,PULL,CHANNEL]` 60° cone 9.6 m vortex pulls enemies toward him (50% damage reduction while channelling, cancel anytime), slam stuns 1.3 s. CD 110–90 s.
- Aspect of Hysteria: Hysteria above max deals damage; his Brew can be thrown every 20 s.

##### Bastet (Egyptian; Assassin; Jungle; melee physical)
Source: [S2 wiki API batch](https://wiki.smite2.com/api.php?action=query&prop=revisions&rvprop=content&rvslots=main&titles=Baron_Samedi|Bastet|Bellona|Cabrakan&format=json)
- **P Nightstalker** `[PASSIVE]` lifesteal, strength stacks and reveal on god hits.
- **1 Pounce** `[LEAP,RECAST]` 8.8 m leap (3.2 m), recast to leap back. CD 14 s.
- **2 Razor Whip** `[CONE]` 68° 5.6 m bleed. CD 10 s; resets cat dashes.
- **3 Ensnaring Claw** `[LINE-PROJ,SUMMON]` 11.2 m cat, roots 0.5 s around the hit, then fights 4 s. CD 16 s.
- **U Cat Call** `[SUMMON]` 3 spirit cats follow and attack; brief CC immunity on cast. CD 90 s.
- Aspect of the Watchful Pride: no return leap, Razor Whip disarms, Claw stuns.

##### Bellona (Roman; Warrior; Solo; melee physical)
Source: [S2 wiki API batch](https://wiki.smite2.com/api.php?action=query&prop=revisions&rvprop=content&rvslots=main&titles=Baron_Samedi|Bastet|Bellona|Cabrakan&format=json)
- **P Master of War** `[PASSIVE,WEAPON-SWAP]` each ability switches her basic-attack weapon (sword+shield, hammer cleaves, scourge heals); stacks speed/protections.
- **1 Shield Bash** `[DASH,CONE]` 2.8 m dash + 4 m 120° bash, slow, Block stacks that absorb basic attacks. CD 14 s.
- **2 Bludgeon** `[SELF-AOE,LINE]` spin 4 m, then slam a 4.8 m line. CD 14–10 s.
- **3 Scourge** `[LINE]` 8.8 m whip: disarm 1.25–1.85 s. CD 16–12 s.
- **U Eagle's Rally** `[LEAP,DEPLOY]` 8.8 m leap (CC immune), stun 0.75 s in 2.4 m, flag buffs allies. CD 90 s.
- Aspect of Vindication: Block stacks and Scourge healing also go to nearby allies.

##### Cabrakan (Maya; Guardian; Solo/Support; melee magical)
Source: [S2 wiki API batch](https://wiki.smite2.com/api.php?action=query&prop=revisions&rvprop=content&rvslots=main&titles=Baron_Samedi|Bastet|Bellona|Cabrakan&format=json)
- **P Shadow Zone** `[AURA]` mitigation aura (4.8 m).
- **1 Seismic Crush** `[SELF-BUFF,NEXT-ATTACK]` 5 s haste; next basic stuns 0.8 s (ignores diminishing returns). CD 14–12 s.
- **2 Refraction Shield** `[CONE,RECAST]` 120° 3.2 m blast; taking damage charges it; at max stacks the blast stuns 0.9–1.3 s. CD 12 s.
- **3 Tremors** `[SELF-AOE,CHANNEL,RECAST]` up to 10 s of slams (4.8 m) that tremble 0.55 s and vortex enemies in; refire for a crippling quake. CD 4 s, mana per slam.
- **U Tectonic Shift** `[GROUND,DEPLOY,WALL]` fissure 5.6 m, then 5 earth pieces rise as a wall (15 s, 1 HP each piece); refire to break. CD 90–70 s.
- Aspect of the Rotund Jotunn: Seismic Crush stealths and slows instead of stunning; weaker walls.

##### Cerberus (Greek; Guardian; Solo/Support; melee magical)
Source: [S2 wiki API batch](https://wiki.smite2.com/api.php?action=query&prop=revisions&rvprop=content&rvslots=main&titles=Cerberus|Cernunnos|Chaac|Charon&format=json)
- **P Spirit of Death** `[PASSIVE]` steals part of nearby enemy heals.
- **1 Paralyzing Spit** `[LINE-PIERCE]` 8 m venom through enemies and walls; stuns 1.1–1.5 s only if all three heads are "alert" (basic attacks / Breath alert them); 75% weaker stun within 2.5 m. CD 13–11 s.
- **2 Ghastly Breath** `[CONE,CHANNEL]` 90° 5.6 m, slow + magical shred stacks. CD 14 s.
- **3 Soul Expulsion** `[LEAP]` 8.8 m leap (2.4 m), severs souls that heal him. CD 15 s.
- **U Stygian Torment** `[SELF-AOE,LIFT,PULL]` lifts every enemy god in 4.8 m, then throws them 3.6 m in front of him. CD 105 s. Cleansable.
- Aspect of Souls: Breath gains ticks from soul kills; ult only knocks up.

##### Cernunnos (Celtic; Hunter; Carry/Jungle; ranged physical)
Source: [S2 wiki API batch](https://wiki.smite2.com/api.php?action=query&prop=revisions&rvprop=content&rvslots=main&titles=Cerberus|Cernunnos|Chaac|Charon&format=json)
- **P Heavy Glaive** `[PASSIVE]` basics cleave in melee range.
- **1 Shifter of Seasons** `[STANCE]` toggles 4 basic-attack seasons (heal, damage, shred, slow); no cooldown.
- **2 Bramble Blast** `[LINE-PROJ,GROUND-ZONE]` 8.8 m bramble stops on first enemy/wall: root 1 s (+cripple) on direct hit, leaves a 3.2 m damage field 5 s. CD 15 s.
- **3 Horn Charge** `[DASH]` 8.8 m dash through all enemies. CD 15–13 s.
- **U The Wild Hunt** `[GROUND]` 4 m circle at 8.8 m: polymorph gods into boars 1.5 s (silence + disarm). CD 90 s.
- Aspect of Strife: basics become melee cleaves; Horn Charge cooldown drops on hits.

##### Chaac (Maya; Warrior; Solo; melee physical)
Source: [S2 wiki API batch](https://wiki.smite2.com/api.php?action=query&prop=revisions&rvprop=content&rvslots=main&titles=Cerberus|Cernunnos|Chaac|Charon&format=json)
- **P Overflow** `[PASSIVE]` 5 basics → next ability free, -2 s, heals.
- **1 Thunder Strike** `[GROUND,DEPLOY]` throws the axe 9.6 m (3.2 m area); the axe stays 5 s and empowers Torrent/Rain Dance. CD 10 s.
- **2 Torrent** `[SELF-AOE,TELEPORT]` spin around himself; if the axe is down, dash to it through walls. CD 10–8 s.
- **3 Rain Dance** `[SELF-AOE]` 6.4 m storm heals him, slows enemies; second storm at the axe. CD 13 s.
- **U Storm Call** `[SELF-AOE,CHANNEL]` charge (CC immune, 50–70% mitigation), then 5.6 m blast: knock-up + 1.5 s silence. CD 75 s.
- Aspect of Fulmination: Rain Dance damages and anti-heals instead of healing.

##### Charon (Greek; Guardian; Support; ranged magical)
Source: [S2 wiki API batch](https://wiki.smite2.com/api.php?action=query&prop=revisions&rvprop=content&rvslots=main&titles=Cerberus|Cernunnos|Chaac|Charon&format=json)
- **P Ferryman of Souls** `[PASSIVE]` coins from deaths; allies can ride with him.
- **1 Spectral Surge** `[LINE-PROJ]` 9.6 m soul stops on first god: slow, then explodes (2.4 m) for 1 s silence. CD 13 s.
- **2 Damnation** `[GROUND,DELAY]` 2.4 m burst after a delay marks gods; allies hitting marked gods get shields. CD 16–14 s.
- **3 Swift Voyage** `[DASH]` 2.5 s charge at +100% speed, root 1 s on collision, wake roots 0.5 s. CD 17–15 s.
- **U Summon Styx** `[GLOBAL,LINE-PIERCE]` CC immune; a wave crosses the map (320 m), fear 0.8–1.2 s on gods in its wake; allies behind get speed. CD 110 s.
- Aspect of the Tollkeeper: coins pulled to him; Damnation summons a damaging soul instead of shields.

##### Chiron (Greek; Hunter; Carry; ranged physical)
Source: [S2 wiki API batch](https://wiki.smite2.com/api.php?action=query&prop=revisions&rvprop=content&rvslots=main&titles=Chiron|Chronos|Cu_Chulainn|Cupid&format=json)
- **P Herbal Medicine** `[PASSIVE,AUTO-TARGET-ALLY]` every 12 s a charge; next ability throws a heal at the lowest-HP ally in range.
- **1 Training Exercise** `[GROUND,DELAY]` 2.8 m circle at 8.8 m: allies inside get CC immunity 0.5 s; explodes on enemies after 1 s. CD 13 s.
- **2 Masterful Shot** `[MARK,HOMING]` damage marks enemies; activating fires homing arrows at every marked target (slow 25–35%). Needs a mark to cast. CD 15 s. Counter: unusual: no aim, homing.
- **3 Giddyup!** `[DASH]` charge knocks back gods, knocks up minions; can attack while charging. CD 16 s.
- **U Centaurus** `[LINE-PIERCE,CHANNEL]` becomes a constellation (slowed 40%, cannot die until the shots run out) and fires 3 arrows 19.2 m through walls. CD 90 s.
- Aspect of the Heroic Tutor: the mark hits one target and copies 10% of damage dealt.

##### Chronos (Greek; Mage; Mid/Carry; ranged magical)
Source: [S2 wiki API batch](https://wiki.smite2.com/api.php?action=query&prop=revisions&rvprop=content&rvslots=main&titles=Chiron|Chronos|Cu_Chulainn|Cupid&format=json)
- **P Time Lord** `[PASSIVE]` +5 intelligence every 1.5 min, permanent, max 25 stacks.
- **1 Time Rift** `[GROUND]` 1.6 m circle at 8.8 m; god hits permanently add 2 damage. CD 5 s.
- **2 Accelerate** `[SELF-BUFF,RANDOM]` speed + attack speed; a wheel decides an extra buff (heal, free abilities, +intelligence). CD 12 s.
- **3 Stop Time** `[LINE-PIERCE,DELAY]` 11.2 m gears through walls: attack-speed slow that turns into a 1 s stun after 1 s. CD 16–14 s.
- **U Rewind** `[SELF,REWIND]` teleport to where he was 8 s ago, restoring that HP/mana and resetting cooldowns; CC immune. CD 100–80 s.
- Aspect of Relativity: a persistent Time Field buffs allies when he casts.

##### Cu Chulainn (Celtic; Warrior; Solo; melee physical)
Source: [S2 wiki API batch](https://wiki.smite2.com/api.php?action=query&prop=revisions&rvprop=content&rvslots=main&titles=Chiron|Chronos|Cu_Chulainn|Cupid&format=json)
- **P Berserk** `[TRANSFORM,RESOURCE]` uses Rage instead of mana; at 85 Rage turns Berserk 20 s (strength, shield), with a second kit.
- Human: **1 Barbed Spear** `[LINE]` 7.2 m thrust, anti-heal; **2 Vent Anger** `[SELF-AOE,TOGGLE]` steam aura that drains Rage; **3 Salmon's Leap** `[LEAP]` 5.6 m leap slam; **U Spear of Mortal Pain** `[SELF-AOE]` 4.8 m knock-up, CC immune while channelling.
- Berserk: **1 Ground Slam** `[LINE]` root 1–1.4 s; **3 Furious Charge** `[DASH]` stun 1 s and carry; **U War Cry** `[SELF-AOE]` 4.8 m tremble 1 s, CD 35 s.
- Aspect of the Warped: starts Berserk; at 100 Rage becomes Warped (Rage decays fast).

##### Cupid (Roman; Hunter; Carry; ranged physical)
Source: [S2 wiki API batch](https://wiki.smite2.com/api.php?action=query&prop=revisions&rvprop=content&rvslots=main&titles=Chiron|Chronos|Cu_Chulainn|Cupid&format=json)
- **P Lovestruck** `[PASSIVE]` basic stacks (16) raise damage and healing; abilities consume 8.
- **1 Heart Bomb** `[LINE-PROJ,DELAY]` 8.8 m arrow stops on first hit: slow; 3 s later the heart explodes (4 m), stun 0.8 s with 8 stacks. CD 12 s.
- **2 Share the Love** `[GROUND,DELAY]` lobbed bomb (0.75 s) spawns healing hearts for allies. CD 13 s.
- **3 Flutter** `[DASH]` 8.8 m dash leaving a speed trail for allies. CD 16–12 s.
- **U Fields of Love** `[GROUND,DELAY]` 5.6 m field at 8.8 m: slow + cripple, arrows grow 2 s then explode: mesmerize 1 s (stun with stacks), heals allies. CD 100 s.
- Aspect of Love: Heart Bomb heals allies; 8 stacks give allies a shield.

##### Da Ji (Chinese; Assassin; Jungle; melee physical)
Source: [S2 wiki API batch](https://wiki.smite2.com/api.php?action=query&prop=revisions&rvprop=content&rvslots=main&titles=Da_Ji|Danzaburou|Discordia|Eset&format=json)
- **P Torture Blades** `[PASSIVE]` basics and non-ult abilities apply a 2 s bleed, stacking without limit.
- **1 Horrible Burns** `[NEXT-ATTACK]` next hit slows 15–25% 3 s and burns; marks the nearest god under 30% HP; haste while active. CD 9 s.
- **2 One Thousand Cuts** `[CONE,CHANNEL]` 180° 3.2 m, 4 strikes; she gets speed, slow immunity and 15–35% frontal mitigation, no strafe penalty. CD 11 s.
- **3 Trickster Spirit** `[TELEPORT,DELAY]` after a short delay teleports to any character or ward within 8.8 m, damaging 1.6 m around. CD 15 s.
- **U Paolao** `[CHANNEL,LINE-PROJ,PULL,LEAP]` rises on the torture pillar up to 5 s (CC immune), fires 3 chains (12.8 m) that cripple and vortex gods toward it; gods reaching it are stunned 0.5 s; leaps off after 3 shots or cancel. CD 120 s.
- Aspect of Ferocity: Burns give lifesteal; Cuts swing more with attack speed.

##### Danzaburou (Japanese; Hunter; Carry; ranged physical)
Source: [S2 wiki API batch](https://wiki.smite2.com/api.php?action=query&prop=revisions&rvprop=content&rvslots=main&titles=Da_Ji|Danzaburou|Discordia|Eset&format=json)
- **P Dishonest Duplication** `[PASSIVE,SUMMON]` basic hits can spawn a 3 s clone that attacks the target.
- **1 Fool's Gold** `[LINE-PROJ,BOUNCE]` 3 money bags roll 11.2 m, pass minions, bounce off walls, stop on gods: tremble + explosion. CD 11 s.
- **2 Alluring Spirits** `[GROUND,SELF-HEAL]` drink (heal over time) then a bottle at 7.2 m: stacking slow, taunt 1 s at 3 stacks; taunt ends if the target loses >30% HP. CD 14–12 s.
- **3 Tanuki Trickery** `[SELF-AOE,STEALTH]` 3.84 m field: speed, slow immunity; leaving it turns him into a leaf with decoys (stealth). CD 14 s.
- **U Uproarious Rocket** `[CHANNEL,STEERED-PROJECTILE]` fires a rocket he steers (within 180°, max 4 s), or rides it himself (damage-immune); stuns 1–1.4 s the first god hit and explodes 4.8 m; rooted and CC immune while steering; stops on walls and gods. CD 90 s. Counter: watch the rocket and sidestep late.
- Aspect of Fellowship: Alluring Spirits spawns 2 clones instead of the bottle.

##### Discordia (Roman; Mage; Mid; ranged magical)
Source: [S2 wiki API batch](https://wiki.smite2.com/api.php?action=query&prop=revisions&rvprop=content&rvslots=main&titles=Da_Ji|Danzaburou|Discordia|Eset&format=json)
- **P Contest of Gods** `[PASSIVE]` top team damage dealer gets power; levels/kills grant random buffs.
- **1 Unruly Magic** `[GROUND-PROJ,BOUNCE]` orb travels 10 m through enemies and walls, explodes at the target spot, then splits into minor projectiles that bounce off walls. CD 12 s.
- **2 Strife** `[GROUND]` 3.2 m circle at 9.4 m: one enemy hit = root 1 s; several = Madness 1 s (they attack their nearest ally). CD 13 s.
- **3 Erratic Behavior** `[LEAP,SELF-AOE,STEALTH]` 6.4 m leap creates a 2.4 m field: stealth, speed, cooldown ticks. CD 14 s.
- **U Golden Apple of Discord** `[LINE-PROJ,LONG-RANGE]` 35 m apple passes minions, bounces off walls, stops on a god; explodes 5.6 m, cripple + tremble 2 s, spreads apple effects. CD 90 s.
- Aspect of the Gilded Victor: Intelligence becomes attack damage; Unruly Magic returns; Apple no longer spreads.

##### Eset (Egyptian; Mage; Mid; ranged magical)
Source: [S2 wiki API batch](https://wiki.smite2.com/api.php?action=query&prop=revisions&rvprop=content&rvslots=main&titles=Da_Ji|Danzaburou|Discordia|Eset&format=json)
- Basic: 3-hit chain, third explodes 0.96 m.
- **P Funeral Rites** `[PASSIVE]` nearby god deaths give regen stacks; empowered third attack.
- **1 Wing Gust** `[LINE-PIERCE,CHANNEL]` 4 projectiles in a line, 8.8 m, through enemies and walls. CD 12–10 s.
- **2 Spirit Ball** `[LINE-PIERCE,RECAST]` 12.8 m ball through enemies/walls; reactivate to detonate (1.6 m): stun 1 s, 1.5 s and more damage at max range. CD 14–10 s.
- **3 Dispel Magic** `[GROUND]` 2.4 m at 8.8 m: silence 1 s + slow on gods, magical shred; allies near get shields. CD 16–14 s.
- **U Circle of Protection** `[GROUND,DELAY,RECAST]` 4.8 m circle at 6.4 m: allies take 30% less damage; stores damage dealt inside; explodes after 5 s or early for damage and heal. CD 90 s.
- Aspect of the Lifewarden: Dispel Magic gives Transference; Wing Gust adds a speed aura and heals.

##### Fenrir (Norse; Assassin; Jungle; melee physical)
Source: [S2 wiki API batch](https://wiki.smite2.com/api.php?action=query&prop=revisions&rvprop=content&rvslots=main&titles=Fenrir|Ganesha|Geb|Gilgamesh&format=json)
- **P Unbound Runes** `[PASSIVE,RESOURCE]` 5 runes empower the next 1 or 3.
- **1 Unchained** `[LEAP]` 8.8 m leap (2.4 m); empowered stuns 0.75 s. CD 15 s (-30% on god hit).
- **2 Seething Howl** `[SELF-BUFF]` strength, attack speed, lifesteal 6 s. CD 13 s.
- **3 Brutalize** `[LEAP,GRAB,CHANNEL]` short leap (4.8 m) onto a target, holds and mauls 4 times (1.08 s), anti-heal; displacement immune. CD 12 s.
- **U Ragnarok** `[SELF-BUFF,NEXT-ATTACK,GRAB]` grows huge 4 s (CC immune, +75% speed); next basic grabs a god and carries it 1.75 s. CD 110 s. Counter: beads/aegis before the bite; kite.
- Aspect of Loyalty: Brutalize slows; Howl buffs allies.

##### Ganesha (Hindu; Guardian; Support; melee magical)
Source: [S2 wiki API batch](https://wiki.smite2.com/api.php?action=query&prop=revisions&rvprop=content&rvslots=main&titles=Fenrir|Ganesha|Geb|Gilgamesh&format=json)
- Basic: 5-hit chain.
- **P Good Fortune** `[PASSIVE]` his last hits are credited to the nearest allied god.
- **1 Turn of Fate** `[LINE-PIERCE]` 8.8 m curse through walls; marked enemies give allies bonus damage. CD 14–12 s.
- **2 Ohm** `[CONE,CHANNEL]` 45° 5.6 m silence; allies gain protections; self-slow 15%, displacement immune. CD 14–10 s.
- **3 Remove Obstacles** `[DASH]` 7.5 m dash through minions, stops on the first god: stun 0.75 s + knock-up; destroys non-ultimate player walls. CD 13–11 s.
- **U Dharmic Pillars** `[GROUND,DEPLOY]` 4 pillars at 8.8 m; enemies crossing the lines between them take damage, 30% slow and protection shred. CD 75 s.
- Aspect of the Triumphant: Ohm deals damage and speeds; kills give permanent cooldown rate.

##### Geb (Egyptian; Guardian; Support/Carry; melee magical)
Source: [S2 wiki API batch](https://wiki.smite2.com/api.php?action=query&prop=revisions&rvprop=content&rvslots=main&titles=Fenrir|Ganesha|Geb|Gilgamesh&format=json)
- **P Hard as Rock** `[PASSIVE]` no single hit can deal more than 20% of his max HP; takes less from crits.
- **1 Roll Out** `[DASH,CHARGE,RECAST]` roll forward up to 6 s, gaining speed (and CC immunity after 3 s); stops on the first god (slow + knockback); recast to leap 5.6 m and knock up. CD 14–10 s.
- **2 Shock Wave** `[CONE]` 90° 8.8 m knock-up. CD 14 s.
- **3 Stone Shield** `[TARGET-ALLY]` shield on himself or an ally within 8.8 m, cleanses CC. CD 15 s.
- **U Cataclysm** `[SELF-AOE]` 4.8 m: stun 1.4–1.8 s + % current HP damage; CC immune while casting. CD 90 s.
- Aspect of Calamity: ranged piercing basics; circular Shock Wave.

##### Gilgamesh (Babylonian; Warrior; Solo/Jungle; melee physical)
Source: [S2 wiki API batch](https://wiki.smite2.com/api.php?action=query&prop=revisions&rvprop=content&rvslots=main&titles=Fenrir|Ganesha|Geb|Gilgamesh&format=json)
- **P Epic of Gilgamesh** `[PASSIVE,QUEST]` four in-match quests upgrade his abilities.
- **1 Sun-forged Scimitar** `[SELF-AOE,SELF-BUFF]` ignite the sword (3–6 s): slow around him, empowered basics. CD 12–10 s.
- **2 Drop Kick** `[CONE,WALL-STUN]` kicks the nearest enemy in front 9.6 m forward; stun 1.2 s if it hits a god or a wall. CD 14 s.
- **3 Hero's Advance** `[LEAP,DEPLOY]` 8.8 m leap (4.8 m), +12.5% damage taken debuff; leaves a beacon that speeds allies toward it. CD 16 s.
- **U Winds of Shamash** `[GROUND,WALL-RING]` 5.44 m ring of wind at 7.2 m for 6 s: crossing the wall slows 40%, inside ticks; roots at 6 s; his attacks knock enemies back inside. CD 90 s.
- Aspect of Shamash: the wind ring is no longer his ultimate and transforms once (attack speed, tenacity or pathfinding).

##### Guan Yu (Chinese; Warrior; Solo/Support; melee physical)
Source: [S2 wiki API batch](https://wiki.smite2.com/api.php?action=query&prop=revisions&rvprop=content&rvslots=main&titles=Guan_Yu|Hachiman|Hades|Hecate&format=json)
- **P Battle Fervor** `[PASSIVE]` damage stacks attack speed.
- **1 Conviction** `[SELF-AOE,HEAL]` heal self and allies 4.8 m; castable during other abilities. CD 14 s.
- **2 Warrior's Will** `[DASH]` 5 m dash, slow 30–40%. CD 13 s.
- **3 Taolu Assault** `[SELF-AOE,CHANNEL]` 3 s flurry in 4.8 m, steals protections. CD 13 s.
- **U Cavalry Charge** `[SELF-BUFF,STEERED]` mount up to 4 s (CC immune), hits around him slow; dismount swing stuns 1.5 s. CD 90 s.
- Aspect of the General: Fervor gives Intelligence; Conviction heals over time; no Strength scaling.

##### Hachiman (Japanese; S1 Hunter; Carry; ranged physical)
Source: [S2 wiki API batch](https://wiki.smite2.com/api.php?action=query&prop=revisions&rvprop=content&rvslots=main&titles=Guan_Yu|Hachiman|Hades|Hecate&format=json)
- **P Master of Arms** `[PASSIVE]` attack speed and mana regen stacks.
- **1 Eagle Eye** `[NEXT-ATTACK]` next 4 basics fly 12.8 m with bonus damage. CD 12–10 s.
- **2 Heavenly Banner** `[GROUND,DEPLOY]` 3.2 m strike at 8.8 m leaves a banner aura of attack speed 6 s. CD 14 s.
- **3 Iaijutsu** `[DASH,SELF-AOE]` 8.8 m dash through enemies then a 3.2 m sweep; gods hit by both are stunned 1 s; Parry stacks block attacks. CD 15 s.
- **U Mounted Archery** `[STEERED,AUTO-TARGET]` horse charge up to 3 s (CC immune), aims separately, fires an arrow at each god in a 45° cone (13.6 m), slow. CD 110 s.
- Aspect of the Steel Wind: Eagle Eye 1 charge with a dash-sweep; interact key becomes a backward dash.

##### Hades (Greek; Mage; Solo; ranged magical)
Source: [S2 wiki API batch](https://wiki.smite2.com/api.php?action=query&prop=revisions&rvprop=content&rvslots=main&titles=Guan_Yu|Hachiman|Hades|Hecate&format=json)
- **P Blight** `[PASSIVE]` attacks/abilities apply Blight 8 s (power reduction); blighted targets get extra effects.
- **1 Death From Below** `[LEAP]` 8.8 m underground leap (3.2 m), slows blighted. CD 14–12 s.
- **2 Shroud of Darkness** `[CONE]` 110° 5.6 m silence 0.75–1.15 s; blighted are feared. CD 14–10 s.
- **3 Devour Souls** `[SELF-AOE]` 3.2 m; blighted explode in chains, heal him and allies. CD 10–8 s.
- **U Pillar of Agony** `[SELF-AOE,CHANNEL,PULL]` 4 s vortex 4.8 m (rooted, CC immune, bonus protections); can cast one other ability during it. CD 110 s. Counter: beads/aegis or knock-back out; walk perpendicular.
- Aspect: none listed on the page.

##### Hecate (Greek; S2 original, no S1 class; Mid; ranged magical)
Source: [S2 wiki API batch](https://wiki.smite2.com/api.php?action=query&prop=revisions&rvprop=content&rvslots=main&titles=Guan_Yu|Hachiman|Hades|Hecate&format=json)
- **P Mythic Ritual** `[PASSIVE,INTERACT]` 2 s rituals on an allied tower (regen zone) or on an ally who just killed a god (power for both).
- **1 Triplicate Form** `[LINE-PIERCE,ALTERNATING]` alternating projectiles 11.2 m through enemies and walls: Power form marks for bonus damage, Hex form mesmerizes 1 s. CD 9–7 s.
- **2 Spell Eater** `[GLOBAL,GROUND,DELAY]` a sigil stores charges whenever gods within 20 m cast abilities; reactivate to call it down anywhere on the map (3.2 m, lands in 0.75 s), +5% per charge. CD 9 s.
- **3 Repel Magic** `[TARGET-ALLY]` magic shield on herself or an ally within 8.8 m, damage around them. CD 12 s.
- **U Open the Gates** `[GROUND,DELAY,TELEPORT-ENEMY]` two portals (one in front of her, one at up to 14 m); after 1.5 s stuns gods 1 s and swaps them to the other portal. Cleansing or immunity avoids the teleport. CD 90 s.
- Aspect of Ruin: Spell Eater auto-fires at enemy casts and reduces enemy ability damage; no refire.

##### Hel (Norse; Mage; Mid/Support; ranged magical)
Source: [S2 wiki API batch](https://wiki.smite2.com/api.php?action=query&prop=revisions&rvprop=content&rvslots=main&titles=Heimdallr|Hel|Hercules|Horus&format=json) (released in S2 22 Sep 2026)
- **P Stance Attunement** `[PASSIVE]` after 3 s in a stance: Dark +20% damage; Light reduces nearby enemy power 12%.
- **U Switch Stances** `[STANCE]` toggle Dark/Light (1 s CD); mana regen and stance buffs for herself and allies.
- Dark: **1 Decay** `[LINE-PROJ]` 8.8 m orb, passes walls/minions, stops on gods, 3.4 m explosion (CD 8 s); **2 Hinder** `[GROUND]` 3.4 m slow 20–40% + protections shred 3 s (CD 10 s); **3 Repulse** `[SELF-AOE]` 4.8 m burst (CD 12 s).
- Light: **1 Restoration** `[LINE-PROJ,TARGET-ALLY]` orb heals the ally god it hits; **2 Cleanse** `[GROUND]` 3.4 m: removes CC from allies + 1.5 s CC immunity (CD 12 s); **3 Inspire** `[SELF-AOE]` heal and speed for allies 4.8 m.
- Aspect of Divergence: attune to Dark or Light by damage/healing; stance locks, abilities enhanced, new ult.

##### Hercules (Roman; Warrior; Solo; melee physical)
Source: [S2 wiki API batch](https://wiki.smite2.com/api.php?action=query&prop=revisions&rvprop=content&rvslots=main&titles=Heimdallr|Hel|Hercules|Horus&format=json)
- **P Apotheosis** `[PASSIVE]` strength stacks when hit by gods.
- **1 Driving Strike** `[DASH]` 5.6 m dash that stuns 0.6–1 s and pushes enemies along. CD 13 s.
- **2 Earthbreaker** `[LINE,PULL]` 7.2 m rift; enemies at the far end are pulled toward him. CD 13 s.
- **3 Mitigate Wounds** `[SELF-BUFF,HEAL]` heal, then heal again for 25–30% of damage taken over 4 s. CD 15 s.
- **U Excavate** `[GROUND,BOUNCE]` throws a boulder 7.2 m: knock-up on landing (2.4 m), then it rolls 7.2 m and bounces off walls (2.2 s). CD 90–70 s.
- Aspect of Preservation: Mitigate Wounds stacks from basic hits and heals nearby allies.

##### Horus (Egyptian; S1 Warrior; S2 Support/Solo; melee physical)
Source: [S2 wiki API batch](https://wiki.smite2.com/api.php?action=query&prop=revisions&rvprop=content&rvslots=main&titles=Heimdallr|Hel|Hercules|Horus&format=json)
- **P Resolute** `[PASSIVE]` protections stacks when damaged; heals when they expire.
- **1 Updraft** `[SELF-AOE,NEXT-ATTACK]` 2.08 m knock-up; the next basic within 5 s fires an 8.8 m gust (piercing, walls) that slows. CD 14–12 s.
- **2 Fracture** `[DASH,CONE]` 6.4 m dash stops on the first god: stun 1.25 s, then a 100° cleave. CD 14–12 s.
- **3 Protector's Surge** `[LEAP,TARGET-ALLY]` leap to an ally within 9.6 m, heal 3.2 m. CD 14 s.
- **U To The Skies!** `[TELEPORT,TEAM,CHANNEL]` a mirror image runs to pick the landing; 1 s channel (CC immune), lands with knockback and shields; nearby allies follow 1 s later. CD 105 s.
- Aspect of the Falcon: Fracture no stun but bigger cleave; Surge targets enemies/locations; ult no ally teleport.

##### Hou Yi (Chinese; Hunter; Carry; ranged physical)
Source: [S2 wiki API batch](https://wiki.smite2.com/api.php?action=query&prop=revisions&rvprop=content&rvslots=main&titles=Hou_Yi|Hua_Mulan|Hun_Batz|Ishtar&format=json)
- **P (Suntouched)** `[PASSIVE]` big hits on him reduce his cooldowns and mark the attacker.
- **1 Ricochet** `[LINE-PIERCE,BOUNCE]` 11.2 m arrow passes enemies and bounces off walls, +40% damage per bounce; stuns marked targets 1 s. CD 10 s.
- **2 Mark of the Golden Crow** `[GROUND,MARK]` 1.6 m mark at 8.8 m that other abilities exploit. CD 14 s.
- **3 Divebomb** `[LEAP,STEERED]` jumps up, flies freely up to 1.5 s, then lands (3.2 m); knocks marked enemies away. CD 17–15 s.
- **U Sunbreaker** `[GROUND,MULTI-HIT]` 9 suns over 4.5 s into a 4.8 m area at 8.8 m, slow; first sun stays as a bounce wall. CD 90 s.
- Aspect of the Mark: basics ricochet; Ricochet stops stunning and applies Mark.

##### Hua Mulan (Chinese; S1 "Mulan", Warrior, renamed; Solo; melee physical)
Source: [S2 wiki API batch](https://wiki.smite2.com/api.php?action=query&prop=revisions&rvprop=content&rvslots=main&titles=Hou_Yi|Hua_Mulan|Hun_Batz|Ishtar&format=json)
- **P Training Arc (weapon mastery)** `[PASSIVE,PROGRESSION]` damage dealt with each weapon levels that weapon's abilities (Skilled/Adept/Mastered).
- **1 Cross Strike** `[CONE]` double slash 100° 4 m. CD 14–12 s.
- **2 Spear Thrust** `[LINE]` 4 m (5.6 m Adept) thrust, slow 25% 3 s. CD 14 s.
- **3 Grapple** `[LINE-PROJ,PULL,DASH]` 9.6 m roped arrow: on a god stun 1 s, pull, then she dashes in (CC immune and untargetable while dashing). CD 16–14 s.
- **U Divine Mastery** `[DASH,MULTI-STAGE]` sword dash 10.4 m (root 1 s), spear knock-up, bow shot 13.6 m. CD 90 s.
- Aspect: none listed on the page.

##### Hun Batz (Maya; Assassin; Jungle; melee physical)
Source: [S2 wiki API batch](https://wiki.smite2.com/api.php?action=query&prop=revisions&rvprop=content&rvslots=main&titles=Hou_Yi|Hua_Mulan|Hun_Batz|Ishtar&format=json)
- **P** `[PASSIVE]` after an ability, next basic +20% and strength stacks.
- **1 Somersault** `[LEAP]` 8.8 m, slow 30–40% on landing. CD 13 s.
- **2 Overhand Smash** `[CONE,CHANNEL]` 110° 5.6 m, physical shred. CD 12–10 s.
- **3 Sacred Monkey** `[LINE-PROJ,RECAST,TELEPORT]` thrown monkey bounces between enemies; recast teleports to the last one hit. CD 13 s.
- **U Fear No Evil** `[GROUND,DEPLOY]` totem at 7.2 m fears in 5.6 m (0.5 s repeatedly, max 1 s), lifetime 1–2 s. CD 120–100 s.
- Aspect of Disruption: post-ability basics slow; Overhand Smash stuns gods 0.55–0.75 s for less damage.

##### Ishtar (Babylonian; Hunter; Carry; ranged physical)
Source: [S2 wiki API batch](https://wiki.smite2.com/api.php?action=query&prop=revisions&rvprop=content&rvslots=main&titles=Hou_Yi|Hua_Mulan|Hun_Batz|Ishtar&format=json)
- **P** `[PASSIVE,MARK]` below 75% HP marks the god who hit her; attacks on it stack speed.
- **1 Imbue Arrows** `[STANCE,NEXT-ATTACK]` choose Strike (lobs over walls, area), Spread (side arrows) or Storm (long range, attack speed). CD 12 s.
- **2 Rolling Thunder** `[LINE,MULTI-HIT]` 4 lightning strikes along an aimed 8.8 m line; mesmerize 0.75 s if hit by 2+. CD 13.5 s.
- **3 Jolt** `[DASH,LEAP]` short dash roots the god hit, then she backflips and fires. CD 15–13 s.
- **U Blades of Retribution** `[CONE,RECAST]` CC immune; 5 swords in a cone 12.8 m: cripple 1.25 s, stun 1 s; refire within 3 s to recall them (hit again). CD 90 s.
- Aspect of the Passionate Storm: Imbue gives attack speed and Storm's Kiss stacks that Jolt consumes.

##### Ix Chel (Maya; Mage; Mid/Support; ranged magical)
Source: [S2 wiki API batch](https://wiki.smite2.com/api.php?action=query&prop=revisions&rvprop=content&rvslots=main&titles=Ix_Chel|Izanami|Janus|Jing_Wei&format=json)
- **P Rainbow Weaver** `[PASSIVE]` 6 stacks → empowered long basic (11.2 m).
- **1 Gleaming Blast / Threads of Light** `[LINE-PROJ,RECAST,CONE]` 11.2 m bolt, stops on gods, becomes Threads: 10 m narrow cone that blinds enemies facing it 1 s. CD 6 s.
- **2 Lunar Invocation** `[GROUND,DELAY]` 3.2 m at 8.8 m, knock-up + ally heal. CD 14 s.
- **3 Rainbow Crash** `[GROUND-PROJ,ARC]` arcing rainbow lands 8.8 m: root 1.25 s (2.4 m), orbs give speed. CD 14 s.
- **U Great End** `[LINE,CHANNEL]` 11.2 m beam 3–6 s, damages enemies and heals allies; CC immune. CD 110 s.
- Aspect of Mother's Light: Gleaming Blast and Great End deal no damage; Blast shields allies and slows gods; heals much larger.

##### Izanami (Japanese; Hunter; Carry; ranged physical)
Source: [S2 wiki API batch](https://wiki.smite2.com/api.php?action=query&prop=revisions&rvprop=content&rvslots=main&titles=Ix_Chel|Izanami|Janus|Jing_Wei&format=json)
- Basic: piercing projectile that returns (hits twice).
- **P Death Draws Nigh** `[PASSIVE]` damage taken grants penetration and power.
- **1 Sickle Storm** `[SELF-BUFF]` 6 s: attack speed, bleeding single-target basics. CD 11 s.
- **2 Spectral Projection** `[LINE-PIERCE]` 11.2 m through walls, slow + anti-heal. CD 14–12 s.
- **3 Fade Away** `[LEAP,STEALTH]` 8.8 m leap into stealth (3–5 s). CD 17–15 s.
- **U Dark Portal** `[GROUND]` 2.4 m at 9.6 m: silence 1.75 s, 60% decaying slow. CD 90 s.
- Aspect of the Sickle: basics stop piercing; Sickle Storm roots gods and wounds.

##### Janus (Roman; Mage; Mid; ranged magical)
Source: [S2 wiki API batch](https://wiki.smite2.com/api.php?action=query&prop=revisions&rvprop=content&rvslots=main&titles=Ix_Chel|Izanami|Janus|Jing_Wei&format=json)
- **P Passages** `[PASSIVE]` going through a portal empowers next ability.
- **1 Portal** `[GROUND,DEPLOY,WALL-PORTAL]` placed on a wall it makes a passage through it; on the ground it banishes him and enemies upward, then damages on landing. CD 12 s.
- **2 Unstable Vortex** `[LINE-PIERCE]` twin helix 11.2 m. CD 9 s.
- **3 Threshold** `[LINE,DEPLOY]` 8.8 m rift: slows enemies crossing, speeds allies. CD 12 s.
- **U Through Space and Time** `[GLOBAL,LINE-PIERCE]` 320 m projectile, more damage with distance, opens portals on walls. CD 110 s.
- Aspect: none listed on the page.

##### Jing Wei (Chinese; Hunter; Carry; ranged physical)
Source: [S2 wiki API batch](https://wiki.smite2.com/api.php?action=query&prop=revisions&rvprop=content&rvslots=main&titles=Ix_Chel|Izanami|Janus|Jing_Wei&format=json)
- **P Rapid Reincarnation** `[PASSIVE,FLIGHT]` flies out of the fountain over terrain (5 s).
- **1 Persistent Gust** `[GROUND]` 1.6 m knock-up at 8.8 m (also lifts herself), ticks. CD 13 s.
- **2 Explosive Bolts** `[NEXT-ATTACK,CHARGES]` wider exploding basics. CD 14 s.
- **3 Agility** `[DASH]` 5.6 m (longer when knocked up; usable while airborne). CD 16–14 s.
- **U Air Strike** `[LEAP,RECAST]` flies 11.2 m dropping bombs, can dash back for a second pass; picks landing. CD 90 s.
- Aspect: none listed on the page.

##### Jormungandr (Norse; Guardian; Solo/Support; S2 melee, S1 ranged; magical)
Source: [S2 wiki API batch](https://wiki.smite2.com/api.php?action=query&prop=revisions&rvprop=content&rvslots=main&titles=Jormungandr|Kali|Khepri|Kukulkan&format=json)
- Basic: unusual: a 45° 5.6 m breath cone hitting everything in front, fires fast then overheats (5/s down to 2/s).
- **P Immovable** `[PASSIVE]` immune to hard displacement (banish, grab, knockback, levitate, vortex); hits stack Dazed (slow, +damage taken).
- **1 Venomous Haze** `[GROUND,DEPLOY]` toxic cloud at up to 12 m: slow + anti-heal; clouds linger 20 s (max 9). CD 13–11 s.
- **2 Consuming Bellow** `[SELF-AOE,CHANNEL]` short channel that eats clouds, then a 3.2–4.8 m roar: slow 30%, tremble 1.5 s. CD 12 s.
- **3 Submerge** `[STEALTH,RECAST]` dive (stealth, speed, max 5 s), recast to burst up: 3.2 m knock-up. CD 14 s.
- **U The World Serpent** `[LEAP,RECAST]` up to 3 dives of 16 m each, knock-up 3.2 m where he lands; CC immune. CD 90 s.
- Aspect of the Unyielding: clouds lose tick damage and give allies damage reduction; Bellow grants power.

##### Kali (Hindu; Assassin; Jungle; melee physical)
Source: [S2 wiki API batch](https://wiki.smite2.com/api.php?action=query&prop=revisions&rvprop=content&rvslots=main&titles=Jormungandr|Kali|Khepri|Kukulkan&format=json)
- **P Marked for Death** `[PASSIVE,MARK]` marks one enemy god for the whole match (penetration, heal on kill); hits stack Rupture.
- **1 Nimble Strike** `[LEAP]` 8.8 m, heals on hit. CD 13 s.
- **2 Lash** `[LINE-PIERCE]` 3 blades 11.2 m through walls, bleed. CD 12–10 s.
- **3 Incense** `[SELF-AOE]` 3.2 m stun 0.8 s, consumes Rupture to heal. CD 15 s.
- **U Destruction** `[SELF-BUFF,UNKILLABLE]` 3.5–4.5 s: cannot die and immune to displacement/slow/root, pulses damage; ends at 15% HP if lower. CD 90 s.
- Aspect of Unbound Destruction: ranged basics; Rupture heals at 5; Incense knocks back.

##### Khepri (Egyptian; Guardian; Support; melee magical)
Source: [S2 wiki API batch](https://wiki.smite2.com/api.php?action=query&prop=revisions&rvprop=content&rvslots=main&titles=Jormungandr|Kali|Khepri|Kukulkan&format=json)
- **P Fortitude** `[PASSIVE]` periodic shields for him and allies.
- **1 Abduct** `[DASH,GRAB]` 6.4 m dash, grabs the first god (silence + grab 1.5–1.9 s) and drags it behind him; stops on walls/gods. CD 14 s.
- **2 Rising Dawn** `[LINE-PIERCE]` sun rolls 11.2 m through enemies and walls, explodes larger at the end, physical shred. CD 12 s.
- **3 Solar Flare** `[GROUND]` 2.4 m at 8.8 m, root 1.25–1.45 s. CD 13–11 s.
- **U Scarab's Blessing** `[TARGET-ALLY,REVIVE]` blesses an ally within 8.8 m for 5 s (cleanse, slow immune); if they die they revive at Khepri. CD 110 s.
- Aspect of Laceration: Abduct roots with constant damage instead of the protections buff.

##### Kukulkan (Maya; Mage; Mid; ranged magical)
Source: [S2 wiki API batch](https://wiki.smite2.com/api.php?action=query&prop=revisions&rvprop=content&rvslots=main&titles=Jormungandr|Kali|Khepri|Kukulkan&format=json)
- **P Power of the Wind Jewel** `[PASSIVE]` intelligence from item mana.
- **1 Zephyr** `[LINE-PROJ]` 11.2 m, stops on first hit, explodes 2.25 m, slow 20–40%. CD 7 s.
- **2 Slipstream** `[SELF-BUFF,DASH]` speed stacks; inside his whirlwind it also dashes 8.8 m. CD 13–11 s.
- **3 Whirlwind** `[GROUND]` 3.2 m at 8.8 m for 4 s, damage over time. CD 15–11 s.
- **U Spirit of the Nine Winds** `[LINE-PIERCE]` 20.8 m tornado through walls, knock-up. CD 90 s.
- Aspect of the Squall: Zephyr fires 3 projectiles; Slipstream always dashes; Whirlwind explodes with knockback.

##### Kumbhakarna (Hindu; Guardian; Support; melee magical; S2 release 17 Nov 2026)
Source: [S2 wiki API batch](https://wiki.smite2.com/api.php?action=query&prop=revisions&rvprop=content&rvslots=main&titles=Kumbhakarna|Kuzenbo|Loki|Maman_Brigitte&format=json)
- **P Sleepy** `[PASSIVE,CHEAT-DEATH]` instead of dying he sleeps 4 s (CC immune, only god basic attacks hurt him), wakes at 40% HP/mana; executes bypass. CD 120 s.
- **1 Throw Back** `[DASH,THROW-MINION]` dash 7.2 m to the first enemy; throws minions 12 m as projectiles. CD 10 s.
- **2 Groggy Strike** `[LINE,DELAY]` wind-up smash 6.4 m: root 1.5 s. CD 10 s.
- **3 Mighty Yawn** `[SELF-AOE]` 6.4 m mesmerize 1.5–2.5 s; usable while asleep. CD 15 s.
- **U Epic Uppercut** `[DASH,KNOCKUP]` 4.8 m dash; the first god is uppercut and lands for 3.2 m knockback; CC immune. CD 90–70 s.
- Aspect of the Rude Awakening: listed as coming soon.

##### Kuzenbo (Japanese; Guardian; Support; melee magical; S2 release 20 Oct 2026)
Source: [S2 wiki API batch](https://wiki.smite2.com/api.php?action=query&prop=revisions&rvprop=content&rvslots=main&titles=Kumbhakarna|Kuzenbo|Loki|Maman_Brigitte&format=json)
- **P Water Bowl** `[PASSIVE]` mitigation stacks from damage taken (hard CC removes half).
- **1 NeNe Kappa** `[LINE-PROJ,BOUNCE,SUMMON]` 11.2 m kappa bounces off walls twice, bursts on a god (slow). CD 14–12 s.
- **2 Shell Spikes** `[SELF-BUFF]` 3 s damage reflect, usable while CC'd. CD 14–12 s.
- **3 Sumo Slam** `[DASH,PUSH]` up to 1.5 s dash: silences and pushes the first god; wall impact damages. CD 14 s.
- **U Watery Grave** `[SELF-AOE]` spin 3.6 m knockback ticks, CC immune. CD 75 s.
- Aspect of Spirits: orbiting Kappa spirits give lifesteal; Shell Spikes throws a spirit (11.2 m) instead of reflecting.

##### Loki (Norse; Assassin; Jungle; melee physical)
Source: [S2 wiki API batch](https://wiki.smite2.com/api.php?action=query&prop=revisions&rvprop=content&rvslots=main&titles=Kumbhakarna|Kuzenbo|Loki|Maman_Brigitte&format=json)
- **P Behind You** `[PASSIVE]` +15% from behind.
- **1 Vanish** `[STEALTH]` 4 s stealth + speed; next hit bleeds. CD 15 s.
- **2 Agonizing Visions** `[GROUND,DEPLOY]` decoy at 8.8 m damages 4 m around it; 4 hits blind 3 s. CD 13 s.
- **3 Flurry Strike** `[CONE,CHANNEL]` 90° 3.2 m, 1.5 s, slow. CD 9 s.
- **U Assassinate** `[TELEPORT,CONE]` teleport 8.8 m (locks onto the nearest god at the point), two strikes: cripple, then stun 0.75 s. CD 90 s.
- Aspect of Agony: Vanish's next hit blinds; Visions can target allies for mitigation.

##### Medusa (Greek; Hunter; Carry; ranged physical)
Source: [S2 wiki API batch](https://wiki.smite2.com/api.php?action=query&prop=revisions&rvprop=content&rvslots=main&titles=Medusa|Mercury|Merlin|Mordred&format=json)
- **P Sidewinder** `[PASSIVE]` no strafe penalty, half backpedal penalty (S2 has movement penalties for strafing/backpedalling).
- **1 Viper Shot** `[NEXT-ATTACK]` next 4 basics become poisoned vipers. CD 12–10 s.
- **2 Acid Spray** `[LINE-PROJ,CONE]` 7.2 m spit stops on first enemy, then a 70° cone sprays behind it, anti-heal. CD 14–12 s.
- **3 Lacerate** `[DASH]` 8.8 m dash through minions, stops before the first god and roots it 1 s. CD 16–14 s.
- **U Petrify** `[CONE,FACING-CHECK]` 40° 11.2 m gaze: stun 2 s if the enemy is facing her, else slow; killed gods become statues. CD 90 s. Counter: turn the camera/body away.
- Aspect: none listed on the page.

##### Mercury (Roman; Assassin; Jungle; melee physical)
Source: [S2 wiki API batch](https://wiki.smite2.com/api.php?action=query&prop=revisions&rvprop=content&rvslots=main&titles=Medusa|Mercury|Merlin|Mordred&format=json)
- **P Fastest God Alive** `[PASSIVE]` distance moved charges next-attack damage.
- **1 Made You Look** `[GROUND,DASH]` zips to a 7.68 m spot and hits the area. CD 11–9 s.
- **2 Maximum Velocity** `[SELF-BUFF]` attack speed, slow immunity 5 s. CD 14–12 s.
- **3 Special Delivery** `[DASH,GRAB]` 8.8 m dash grabs the first god, spins (stun 1 s) and throws it. CD 15 s.
- **U Sonic Boom** `[CHARGE,DASH,GLOBAL-ish]` charge up then dash 0–48 m, spinning enemies (stun 1.25 s); CC immune. CD 90–70 s.
- Aspect: none listed on the page.

##### Merlin (Arthurian; Mage; Mid; ranged magical)
Source: [S2 wiki API batch](https://wiki.smite2.com/api.php?action=query&prop=revisions&rvprop=content&rvslots=main&titles=Medusa|Mercury|Merlin|Mordred&format=json)
- **P Overload** `[PASSIVE]` each ability cast stores a charge (max 3, 5 s); the next basic spends one for bonus magical damage.
- **U Elemental Mastery** `[STANCE,SELF-AOE]` 4 m explosion then choose next stance (Arcane, Fire, Ice); each stance gives a different 1 and 2. CD 40–20 s.
- Arcane: **1 Eclipse** `[LINE-PIERCE]` growing orb 9.6 m; **2 Vortex** `[GROUND,DELAY,PULL]` 3.2 m; Fire: **1 Radiate** `[LINE,CHANNEL]` 2 s beam 7.2 m; **2 Dragonfire** `[GROUND,DEPLOY]` 2 dragons breathe 80° cones 3 s; Ice: **1 Frostbolt** `[LINE-PROJ]` 11.2 m; **2 Blizzard** `[GROUND]` 3.2 m stacking slow.
- **3 Flicker** `[BLINK]` 4.8 m teleport, stance-dependent bonus. CD 24–20 s.
- Aspect of Pandemonium: lower ult cooldown; random stance and two random primaries.

##### Mordred (Arthurian; S2 original; Solo/Jungle; melee physical)
Source: [S2 wiki API batch](https://wiki.smite2.com/api.php?action=query&prop=revisions&rvprop=content&rvslots=main&titles=Medusa|Mercury|Merlin|Mordred&format=json)
- **P Wrath of the Forsaken** `[PASSIVE,RESOURCE]` hits build Wrath, spent on two ultimates (40 and 80). **P2 Shoulder Charge** `[DASH,INTERACT]` within 2 s of an ability/attack, the interact key dashes 4 m. CD 10 s.
- **1 Cruel Strikes** `[CONE,LINE]` 90° slash then a line slam. CD 14–10 s.
- **2 Bloodrage** `[SELF-AOE,SELF-BUFF]` 3.2 m, then speed and shred. CD 14 s.
- **3 Severing Slice** `[LINE-PIERCE]` 9.6 m; direct hit bleeds more the more the target moves; slow 30%. CD 12 s.
- **U1 Heart Slash** `[LINE,CHANNEL]` 6 m; root a god and drain 1.5 s (40 Wrath, CD 20 s). **U2 Pursue the Weak** `[DASH,THROUGH-WALLS]` charge up to 4 s through walls to the first god, stun 0.5 s then knock-up (80 Wrath).
- Aspect of Rage: Bloodrage attacks cut cooldowns; Shoulder Charge hits harder.

##### Morgan Le Fay (Arthurian; Mage; Mid; ranged magical)
Source: [S2 wiki API batch](https://wiki.smite2.com/api.php?action=query&prop=revisions&rvprop=content&rvslots=main&titles=Morgan_Le_Fay|Ne_Zha|Neith|Nemesis&format=json)
- **P Empowered Blade** `[PASSIVE,MARK]` ability hits mark gods with symbols; 5 symbols empower her.
- **1 Sigil Mastery** `[GROUND,MODE-SELECT]` falling sword at 8.8 m with a chosen sigil: Mind fears 0.6–1 s, Body leaves a slow field, Soul spawns a clone. CD 11 s.
- **2 Dragonflight** `[GROUND,LINE-PIERCE]` dragon knocks up at 9.6 m then flies forward knocking back. CD 14–12 s.
- **3 Shroud of Wildfire** `[LINE-PROJ]` 9.6 m, stops on gods, burn that hurts more when the target moves. CD 13 s.
- **U Consuming Power** `[CONE,LINE-PIERCE]` pulls in marks from gods in a 75° cone and fires 3 dark strikes 14.4 m. CD 90 s.
- Aspect of the Cursed Crown: melee basics, Wrath resource, two Consuming Power tiers (cone 6 m or 3 dashes).

##### Ne Zha (Chinese; Assassin; Jungle; melee physical)
Source: [S2 wiki API batch](https://wiki.smite2.com/api.php?action=query&prop=revisions&rvprop=content&rvslots=main&titles=Morgan_Le_Fay|Ne_Zha|Neith|Nemesis&format=json)
- **P Righteous Spirit** `[PASSIVE]` hits build stacks (max 20, 12 s) of move speed and crit damage; crits give 2.
- **1 Universe Ring Toss** `[LINE-PROJ,BOUNCE]` ring bounces between enemies 4–8 times, slow + shred; catch it for an extra throw. CD 10 s.
- **2 Flaming Spear** `[SELF-BUFF]` attack speed + crit. CD 14 s.
- **3 Armillary Sash** `[LINE-PROJ,LEAP]` 11.2 m sash, stops on first god: stun 1 s, then he leaps to them (CC immune, untargetable). CD 12 s.
- **U Wind Fire Wheels** `[DASH,ISOLATE]` 8.8 m dash; on a god both go airborne for a 3-hit combo and a slam. CD 90 s.
- Aspect of the Righteous Flame: damage builds heal reserves; the ring bounces to allies; the spear becomes an area.

##### Neith (Egyptian; Hunter; Carry/Mid; ranged physical)
Source: [S2 wiki API batch](https://wiki.smite2.com/api.php?action=query&prop=revisions&rvprop=content&rvslots=main&titles=Morgan_Le_Fay|Ne_Zha|Neith|Nemesis&format=json)
- **P Broken Weave** `[PASSIVE,DEPLOY]` abilities make/detonate weaves (root 1 s).
- **1 Spirit Arrow** `[LINE-PIERCE]` 10.4 m through everything, root 1 s. CD 13–11 s.
- **2 Unravel** `[GROUND]` 3.2 m at 8.8 m, heals her per hit. CD 12 s.
- **3 Back Flip** `[CONE,LEAP]` 110° cone slow, then leaps backward 9.6 m (can cross walls). CD 15–13 s.
- **U World Weaver** `[GLOBAL,CHARGE,LINE-PIERCE]` charge 0.5–2 s, then an arrow across the whole map through walls and minions; stops on the first god (stun 1 s). CD 100 s. Counter: other gods can body-block; sidestep (long travel time).
- Aspect of Wind: weaves no longer root; more attack speed; World Weaver grants weave stacks.

##### Nemesis (Greek; Assassin; Jungle; melee physical)
Source: [S2 wiki API batch](https://wiki.smite2.com/api.php?action=query&prop=revisions&rvprop=content&rvslots=main&titles=Morgan_Le_Fay|Ne_Zha|Neith|Nemesis&format=json)
- **P Scales of Fate** `[PASSIVE]` basics steal 7% power per stack from the target (3 stacks, 5 s).
- **1 Swift Vengeance** `[DASH,RECAST]` 4.8 m dash, second dash within 2 s. CD 11 s.
- **2 Slice and Dice** `[CONE]` 150° 5.6 m; centre 45° takes more + slow. CD 10 s.
- **3 Retribution** `[SELF-BUFF,REFLECT]` 2 s shield reflects and heals 40% (hard CC breaks it). CD 14 s.
- **U Divine Judgement** `[TARGET-AREA,HOMING]` targeted 1.6 m area at 8.8 m: % current HP damage, steals protections/speed via a homing return. CD 90 s.
- Aspect of Justice: Divine Judgement averages her current HP with the target's.

##### Nike (Greek; Warrior; Solo; melee physical; S2 release Oct 2026)
Source: [S2 wiki API batch](https://wiki.smite2.com/api.php?action=query&prop=revisions&rvprop=content&rvslots=main&titles=Nike|Nox|Nu_Wa|Nut&format=json)
- **P To Victory!** `[PASSIVE]` ability hits give Laurels to her and nearby allies; basics consume them.
- **1 Rend** `[LINE,CHANNEL,MULTI-HIT]` 3 slams 8 m; third disarms 1–2 s; displacement immune. CD 13 s.
- **2 Barrier Formation** `[CHANNEL,WALL]` held shield wall (4 m) blocks ranged basic attacks; enemies touching it are knocked back; reactivate to collapse. CD 15–13 s.
- **3 Valiant Leap** `[LEAP]` 8.8 m, knock-up 2.4 m. CD 16 s.
- **U Sentinel of Zeus** `[SELF-AOE,SELF-BUFF]` 6.4 m slow 40%, big shield. CD 90–70 s.
- Aspect of Victorious Conquest: Laurels only for her, 3 Laurels empower the next ability; barrier travels and knocks up.

##### Nox (Roman; Mage; Mid/Support; ranged magical; S2 Nov 2026)
Source: [S2 wiki API batch](https://wiki.smite2.com/api.php?action=query&prop=revisions&rvprop=content&rvslots=main&titles=Nike|Nox|Nu_Wa|Nut&format=json)
- **P Flame of the Night** `[PASSIVE]` each cast lights a candle (+5% Intelligence, max 4); taking god damage blows one out (at most once per 3 s).
- **1 Shadow Lock** `[LINE-PROJ,TETHER]` 10.4 m shadow passes walls, stops on a god: tether roots + cripples 2 s (ignores CC reduction); breaks past 12.4 m. CD 10 s.
- **2 Siphon Darkness** `[GROUND,DELAY]` 3.2 m void at 8.8 m explodes: silence 2 s; leaving early = partial damage + slow; cancels channels. CD 13 s.
- **3 Shadow Step** `[DASH,ATTACH-ALLY]` dash 8.8 m; entering an ally's shadow rides along up to 8 s, exits with an explosion. CD 15 s.
- **U Night Terror** `[LINE-PROJ]` 19.2 m vortex, stops on first god: 3.5 m silence 1.5 s, -30% damage 5 s. CD 90 s.
- Aspect of Silent Night: Night Terror leaves a 7.5 m weakening dome; Siphon silences without damage; Shadow Step shields and fears.

##### Nu Wa (Chinese; Mage; Mid; ranged magical)
Source: [S2 wiki API batch](https://wiki.smite2.com/api.php?action=query&prop=revisions&rvprop=content&rvslots=main&titles=Nike|Nox|Nu_Wa|Nut&format=json)
- **P Strength of Wood** `[PASSIVE]` every 12 s the next basic roots 1 s.
- **1 Mysterious Fog** `[LINE-PIERCE,SLOW-MOVING]` fog drifts 25 m over 6 s, damaging; allies inside are stealthed. CD 12 s.
- **2 Clay Soldiers** `[SUMMON]` soldiers dash at enemies within 6.4 m. CD 16 s.
- **3 Shining Metal** `[LINE-PIERCE]` 10.4 m; exploding a soldier stuns 0.8–1 s. CD 10 s.
- **U Fire Shards** `[GLOBAL,AUTO-TARGET]` reveals all enemy gods and strikes each one. CD 120 s.
- Aspect of Shining Mist: she can attack while stealthed in the fog; Metal and Shards scale with attack damage.

##### Nut (Egyptian; S1 Hunter (magical-damage hunter); S2 Carry/Mid; ranged magical)
Source: [S2 wiki API batch](https://wiki.smite2.com/api.php?action=query&prop=revisions&rvprop=content&rvslots=main&titles=Nike|Nox|Nu_Wa|Nut&format=json)
- **P Flux** `[PASSIVE]` ability hits build Stellar Flux (attack speed) while Strength > Intelligence, otherwise basics build Astral Flux; max 10, decays every 3 s.
- **1 Convergence** `[NEXT-ATTACK,AMMO]` basics fire 2+ converging side shots, protections shred. CD 10 s.
- **2 Crashing Comet** `[GROUND,SWEETSPOT]` 8.8 m: centre 1.6 m roots 0.9–1.3 s, edge 4 m trembles. CD 15 s.
- **3 Warp** `[BLINK]` 2.4 m teleport in movement direction, homing slows. CD 14–12 s.
- **U Skyfall** `[GROUND-PROJ,DELAY,PULL]` black hole 11.2 m lands after 1 s, 0.5 s later 6.4 m pull. CC immune. CD 100 s.
- Aspect of the Cosmos: Flux heals allies; Comet's centre stuns; Warp gives CC immunity to her and an ally.

##### Odin (Norse; Warrior; Solo/Jungle; melee physical)
Source: [S2 wiki API batch](https://wiki.smite2.com/api.php?action=query&prop=revisions&rvprop=content&rvslots=main&titles=Odin|Osiris|Pele|Poseidon&format=json)
- **P Path to Valhalla** `[PASSIVE]` nearby god deaths give speed and Strength/Intelligence (2 stacks, 10 s).
- **1 Lunge** `[LEAP]` 8.8 m, 3.2 m. CD 14–12 s.
- **2 Raven Shout** `[SELF-BUFF,SHIELD]` shield pulses, then explodes. CD 14–12 s.
- **3 Gungnir's Might** `[SELF-AOE,LINE-PROJ,MULTI-STAGE]` two pulses then a spear throw 8.8 m: stun 0.9 s on first god. CD 14–12 s.
- **U Ring of Spears** `[SELF-AOE,DEPLOY,WALL-RING]` 4.8 m ring of 8 spear segments (5 HP each) traps enemy gods (projectiles pass); no healing inside; 25% slow when leaving. CD 100–80 s. Counter: break a segment (5 basic hits), leap/teleport out.
- Aspect: none listed on the page.

##### Osiris (Egyptian; Warrior; Solo; melee physical)
Source: [S2 wiki API batch](https://wiki.smite2.com/api.php?action=query&prop=revisions&rvprop=content&rvslots=main&titles=Odin|Osiris|Pele|Poseidon&format=json)
- **P Fragmented** `[PASSIVE,RESOURCE]` each ability use breaks a fragment (2% mitigation each); after 8 his basics become 6 piercing spirit attacks.
- **1 Sickle Strike** `[LINE-PROJ]` 8.8 m, stops on first god, slow. CD 6 s.
- **2 Spirit Flail** `[GROUND]` 2.4 m at 8.8 m, slow. CD 11 s.
- **3 Judgement Tether** `[SELF-AOE,TETHER]` tethers gods within 5.6 m for 4 s; those still in range at the end are stunned 1.1 s. CD 15–13 s.
- **U Lord of the Afterlife** `[LEAP]` 10.4 m leap: root 0.8 s, anti-heal, negative CDR. CD 70 s.
- Aspect (name not captured): Intelligence-only scaling; Sickle Strike costs 4 fragments; ult launches a slowing specter.

##### Pele (Polynesian; Assassin; Jungle; melee physical)
Source: [S2 wiki API batch](https://wiki.smite2.com/api.php?action=query&prop=revisions&rvprop=content&rvslots=main&titles=Odin|Osiris|Pele|Poseidon&format=json)
- **P Everlasting Flame** `[PASSIVE]` below 50% HP: Strength + 15% lifesteal for 6 s (30 s CD).
- **1 Pyroclast** `[LINE-PIERCE,CHARGES]` 9.6 m, 2 charges, shards return. CD 13 s.
- **2 Eruption** `[SELF-AOE]` speed burst then rings of knock-up (2.4–5.6 m). CD 14 s.
- **3 Magma Rush** `[TOGGLE,RESOURCE]` consumes fuel for speed + damage aura (no CD).
- **U Volcanic Lightning** `[DASH,SELF-BUFF]` CC immune dash 9.6 m; next 4 basics become 110° cones. CD 90 s.
- Aspect (name not captured): fuel from Pyroclast and damage; Magma Rush heals; the passive gives protections.

##### Poseidon (Greek; Mage; Mid; ranged magical)
Source: [S2 wiki API batch](https://wiki.smite2.com/api.php?action=query&prop=revisions&rvprop=content&rvslots=main&titles=Odin|Osiris|Pele|Poseidon&format=json)
- **P Changing Tides** `[PASSIVE,RESOURCE]` basic hits build Tide (move speed, up to +15% ability damage); abilities spend it.
- **1 Tidal Surge** `[LINE-PIERCE]` 12.8 m wave, knockback. CD 10 s.
- **2 Trident** `[SELF-BUFF]` attack speed; basics and Surge fire 2 extra shots. CD 15 s.
- **3 Whirlpool** `[GROUND]` 3.2 m vortex + cripple 3 s. CD 15–11 s.
- **U Release the Kraken!** `[GROUND]` 7.2 m: inner 2.4 m stun 1–1.8 s + knock-up, outer slow. CD 90 s.
- Aspect (name not captured): basics always fire side waves; Trident focuses them to pierce.

##### Princess Bari (Korean; S2 original; Carry/Mid; ranged magical)
Source: [S2 wiki API batch](https://wiki.smite2.com/api.php?action=query&prop=revisions&rvprop=content&rvslots=main&titles=Princess_Bari|Ra|Rama|Ratatoskr&format=json)
- Basic: projectile with a small 2.4 m splash at 50%.
- **P Mystic Surge** `[PASSIVE,RESOURCE]` damage builds Spirit; at 100 her next 3 abilities within 5 s are free and skip cooldown.
- **1 Sacred Bell** `[GROUND,DEPLOY]` lobbed bell (8.8 m, 2.4 m) stays (max 3); her other abilities push bells, which roll through enemies and bounce off walls, slowing. CD 13 s.
- **2 Warding Gust** `[CONE]` 70° fan, knockback near (4.4 m), weaker far (8.8 m). CD 14 s.
- **3 Reverent Steps** `[DASH,LINE-PIERCE]` dash in any direction, then fires a projectile 8.8 m through everything. CD 16–14 s.
- **U Spirit's Cadence** `[GROUND,MULTI-HIT,ALLY-BUFF]` three pulses in a 5.6 m circle at 8.8 m; allies inside get Guardian Spirits (lethal damage is prevented and the attacker is silenced + disarmed 1.5 s). CD 110 s.
- Aspect: none listed on the page.

##### Ra (Egyptian; Mage; Mid; ranged magical)
Source: [S2 wiki API batch](https://wiki.smite2.com/api.php?action=query&prop=revisions&rvprop=content&rvslots=main&titles=Princess_Bari|Ra|Rama|Ratatoskr&format=json)
- **P Speed of Light** `[PASSIVE]` speed after each ability.
- **1 Celestial Beam** `[LINE-PIERCE,DELAY]` beam travels 12.8 m through walls. CD 10 s.
- **2 Divine Light** `[SELF-AOE,FACING-CHECK]` 4.8 m stacking slow around him; enemies facing him get more stacks and blind; explodes after 2 s. CD 14–12 s.
- **3 Solar Blessing** `[GROUND,HEAL]` 3.2 m pillar at 8.8 m, heals and buffs allies, damages enemies over 6 s. CD 15–13 s.
- **U Searing Pain** `[LINE-PIERCE,CHANNEL]` 19.2 m beam, 1.6 m wide, through walls, + 8% max HP true damage. CD 80–60 s.
- Aspect of Thermotherapy: Beam grants Speed of Light, Blessing attaches to an ally, Searing Pain heals.

##### Rama (Hindu; Hunter; Carry; ranged physical)
Source: [S2 wiki API batch](https://wiki.smite2.com/api.php?action=query&prop=revisions&rvprop=content&rvslots=main&titles=Princess_Bari|Ra|Rama|Ratatoskr&format=json)
- **P Astral Quiver** `[PASSIVE,AMMO]` astral arrows regenerate (5 max); dropped arrows can be picked up.
- **1 Astral Strike** `[TOGGLE]` basics spend arrows to pierce and slow. No CD.
- **2 Infinite Arrows** `[SELF-BUFF]` attack speed 6 s, auto-collects arrows. CD 15–11 s.
- **3 Rolling Assault** `[DASH]` 7.2 m roll in travel direction; next basic cripples 1–2 s. CD 11 s.
- **U Astral Barrage** `[LEAP,UNTARGETABLE,GROUND]` flies up to 5 s within 32 m, fires 3 arrows down (2.4/1.6/1.2 m). CD 90 s.
- Aspect of Precision: Astral Strike always on; slower attacks; manual reload.

##### Ratatoskr (Norse; Assassin; Jungle; melee physical)
Source: [S2 wiki API batch](https://wiki.smite2.com/api.php?action=query&prop=revisions&rvprop=content&rvslots=main&titles=Princess_Bari|Ra|Rama|Ratatoskr&format=json)
- **P Acorn of Yggdrasil** `[PASSIVE,ITEM]` his unique acorn item is upgraded in the shop and changes his abilities.
- **1 Dart** `[DASH]` 8.8 m, slow; stops on gods. CD 14 s (reduced by hits).
- **2 Flurry** `[SELF-AOE]` 4 spins 3.2 m, physical shred. CD 14 s.
- **3 Acorn Blast** `[CONE]` 3 acorns in a 20° cone, 8.8 m; stun 1 s if all 3 hit. CD 12 s.
- **U Through the Cosmos** `[LEAP,RECAST]` up to 2 leaps (14.4 m), slam knock-up 3.2 m; CC immune. CD 90 s.
- Aspect of Thickbark: tier-3 acorn effects (Dart knocks back, Flurry heals, Blast fires five).

##### Ravana (Hindu; Assassin; Jungle; melee physical)
Source: [S2 wiki API batch](https://wiki.smite2.com/api.php?action=query&prop=revisions&rvprop=content&rvslots=main&titles=Ravana|Scylla|Sobek|Sol&format=json)
- **P Chain of Blows** `[PASSIVE,COMBO]` 8 consecutive hits → shield stacks.
- **1 Prana Onslaught** `[CONE]` 120° 3.2 m, slow 25%. CD 9 s.
- **2 Overhead Kick** `[LINE-PIERCE,SELF-IMMUNE]` 5.6 m shockwave; 0.85 s CC + damage immunity. CD 14–16 s.
- **3 10-Hand Shadow Fist** `[LINE-PIERCE]` 7.2 m; first god rooted 1 s, heals him. CD 14 s.
- **U Mystic Rush** `[LEAP]` 8.8 m, +10% damage taken debuff, CC immune. CD 90 s.
- Aspect of the Rakshasa King: Combo stacks to 999; Mystic Rush fires enhanced abilities using Combo.

##### Scylla (Greek; Mage; Mid; ranged magical)
Source: [S2 wiki API batch](https://wiki.smite2.com/api.php?action=query&prop=revisions&rvprop=content&rvslots=main&titles=Ravana|Scylla|Sobek|Sol&format=json)
- **P Quick Learner** `[PASSIVE]` maxed abilities gain extra effects.
- **1 Sic 'Em** `[LINE-PROJ]` 10.4 m, stops on first hit: root + cripple 1.75 s, 2.4 m explosion. CD 10 s.
- **2 Crush** `[GROUND,DELAY,RECAST]` 3.2 m slow field; detonates after 5 s or early. CD 10 s.
- **3 Sentinel** `[DEPLOY,RECAST,LEAP]` vision sentinel at 11.2 m; recast leaps to it. CD 15 s.
- **U I'm a Monster** `[SELF-BUFF,GROUND,RECAST]` 6 s CC immune + 35% speed, recast to strike a 2.4 m circle at 9.6 m; god kills give another strike. CD 90 s.
- Aspect of the Devourer: hits restore mana; ult fires three times, scaling from max mana.

##### Sobek (Egyptian; Guardian; Support; melee magical)
Source: [S2 wiki API batch](https://wiki.smite2.com/api.php?action=query&prop=revisions&rvprop=content&rvslots=main&titles=Ravana|Scylla|Sobek|Sol&format=json)
- **P Blessing of the Nile** `[PASSIVE]` dealing damage stacks protections and cooldown rate (3 stacks).
- **1 Charge Prey** `[DASH,GRAB,THROW]` 8.8 m dash, grabs the first enemy and throws it behind him (stun 0.47 s). CD 16 s.
- **2 Tail Whip** `[SELF-AOE]` 3.2 m knockback after 0.4 s. CD 13 s.
- **3 Sickening Strike** `[CONE]` 110° 5.6 m, anti-heal, heals him. CD 13 s.
- **U Lurking in the Waters** `[SELF-AOE,SUBMERGE,RECAST]` submerge 4 s (CC immune, can move), slow aura; emerge to damage and execute low-HP enemies. CD 90 s.
- Aspect of Prey: Charge Prey passes through all targets.

##### Sol (Norse; Mage; Mid/Carry; ranged magical)
Source: [S2 wiki API batch](https://wiki.smite2.com/api.php?action=query&prop=revisions&rvprop=content&rvslots=main&titles=Ravana|Scylla|Sobek|Sol&format=json)
- **P Unstable Manifestation** `[PASSIVE,RESOURCE]` Heat 0–100.
- **1 Radiance** `[SELF-AOE,HEAL]` 2.4 m flame pool, grows with Heat. CD 10 s.
- **2 Stellar Burst** `[NEXT-ATTACK,LINE-PROJ]` next basic explodes 3.2 m then retracts, slow. CD 10 s.
- **3 Disapparate** `[SELF-BUFF,UNTARGETABLE]` speed + fire trail, then 3 s fully immune and untargetable. CD 16–14 s.
- **U Supernova** `[GROUND,STEERED]` 8 strikes following her moving cursor (8.8 m), first knocks back; CC immune. CD 90–70 s.
- Aspect of Conflagration: Heat gives Intelligence; Radiance castable at range 8 m (OB48 rework).

##### Sun Wukong (Chinese; Warrior; Solo; melee physical)
Source: [S2 wiki API batch](https://wiki.smite2.com/api.php?action=query&prop=revisions&rvprop=content&rvslots=main&titles=Sun_Wukong|Susano|Sylvanus|Thanatos&format=json)
- **P Undefeated Body** `[PASSIVE,CLONE]` below 30% HP spawns a clone (10 s).
- **1 The Magic Cudgel** `[LINE]` 8.8 m slam (longer with intelligence). CD 12 s.
- **2 Master's Will** `[SELF-AOE]` 3.2 m spin, slow + attack-speed slow. CD 11 s.
- **3 72 Transformations** `[DASH,AIM-DISTANCE-PICKS-FORM]` aim distance picks Ox (near, knockback), Tiger (mid, stun 1.4 s) or Eagle (far, fast). CD 16–14 s.
- **U Somersault Cloud** `[UNTARGETABLE,STEALTH,GLOBAL-ish]` rises onto a cloud (CC immune, stealth, heals), a clone stays; land 12 m away early or at the end (4 m damage). CD 110–90 s.
- Aspect of Transformation: lower 72 Transformations CD; the form locks until the ult.

##### Susano (Japanese; Assassin; Jungle; melee physical)
Source: [S2 wiki API batch](https://wiki.smite2.com/api.php?action=query&prop=revisions&rvprop=content&rvslots=main&titles=Sun_Wukong|Susano|Sylvanus|Thanatos&format=json)
- **P Storm's Edge** `[PASSIVE]` empowered post-ability attacks stack debuffs.
- **1 Storm Kata** `[CONE,SELF-AOE,DASH,RECAST]` 3 stages: cone strike, spin, dash 7 m. CD 14–12 s.
- **2 Wind Siphon** `[CONE,PULL]` 105° 5.6 m; inner 40° pulled to where he started. CD 15 s.
- **3 Jet Stream** `[LINE-PROJ,RECAST,TELEPORT]` 7.2 m whirlwind stops on first hit; recast to teleport to it. CD 15 s.
- **U Typhoon** `[CHARGE,LINE-PIERCE,RECAST]` charges a growing typhoon (4–8 m), recast or auto after 2 s to fire 11.2 m; knock-up. CD 90 s.
- Aspect of the Storm Front: Jet Stream buffs allies; Typhoon vortexes instead of damaging.

##### Sylvanus (Roman; Guardian; Support; ranged magical)
Source: [S2 wiki API batch](https://wiki.smite2.com/api.php?action=query&prop=revisions&rvprop=content&rvslots=main&titles=Sun_Wukong|Susano|Sylvanus|Thanatos&format=json)
- Basic: lobbed (ground-targeted) 6.4 m explosion, goes over walls.
- **P Nature's Bounty** `[PASSIVE,PICKUP]` ability hits spawn seed pods to pick up (mana, CDR).
- **1 Verdant Growth** `[GROUND]` pod 7.2 m: root 1.5 s; if it hits nothing it grows into a flower after 6 s. CD 15–11 s.
- **2 Wisps** `[SELF-AOE,HEAL]` 4.8 m heal allies / damage enemies over time. CD 14 s.
- **3 Nature's Grasp** `[LINE-PROJ,PULL]` 9.6 m vine passes walls, stops on the first god: stun 1 s and pull toward him. CD 14–10 s.
- **U Wrath of Terra** `[SELF-AOE]` 5.6 m knock-up, 6 ticks over 5 s. CD 90 s. (S1 version was a global root.)
- Aspect of Grover's Wrath: Anger stacks give attack speed; enrage gives free Wisps or Grasp.

##### Thanatos (Greek; Assassin; Jungle; melee physical)
Source: [S2 wiki API batch](https://wiki.smite2.com/api.php?action=query&prop=revisions&rvprop=content&rvslots=main&titles=Sun_Wukong|Susano|Sylvanus|Thanatos&format=json)
- **P Harvester of Souls** `[PASSIVE]` abilities cost health; kills heal and cut CDs.
- **1 Death Scythe** `[LINE-PROJ]` 11.2 m, stops on first hit, slow, lifesteal. CD 11 s.
- **2 Scent of Death** `[SELF-BUFF]` speed, slow immunity, bonus vs low HP. CD 13 s.
- **3 Soul Reap** `[CONE]` 110° 5.6 m silence 1 s. CD 14–12 s.
- **U Hovering Death** `[LEAP,UNTARGETABLE-ish,STEERED]` flies (CC immune, +125% speed) and dives to a 2.4 m spot: stun 1 s, executes at 24–40% HP. CD 90 s.
- Aspect of Reaping: kills give permanent max HP; Soul Reap scales with max HP.

##### The Morrigan (Celtic; Mage; Mid; ranged magical)
Source: [S2 wiki API batch](https://wiki.smite2.com/api.php?action=query&prop=revisions&rvprop=content&rvslots=main&titles=The_Morrigan|Thor|Tsukuyomi|Ullr&format=json)
- **P Doomsayer** `[PASSIVE]` the third basic of her chain explodes (1.6 m) and burns 3 s.
- **1 Deadly Aspects** `[CONE,RECAST]` summon forms then recast: 45° 4.8 m stun 0.8 s. CD 12 s.
- **2 Dark Omen** `[LINE-PIERCE]` 11.2 m wave marks. CD 7 s.
- **3 Confusion** `[STEALTH,DECOY]` clone walks to target; she is stealthed 3–5 s. CD 15 s.
- **U Changeling** `[TRANSFORM]` becomes any god in the match for 10 s with their abilities and items. CD 120–100 s.

##### Thor (Norse; Assassin; Jungle/Solo; melee physical)
Source: [S2 wiki API batch](https://wiki.smite2.com/api.php?action=query&prop=revisions&rvprop=content&rvslots=main&titles=The_Morrigan|Thor|Tsukuyomi|Ullr&format=json)
- **P Warrior's Madness** `[PASSIVE]` Strength per nearby enemy god (max 3); Barrage/Anvil give Thunderstruck (basics arc to 2 more enemies).
- **1 Mjolnir's Attunement** `[LINE-PIERCE,RECAST,TELEPORT]` hammer 11.2 m returns (200% to gods on return); recast while flying to teleport to it. CD 14 s.
- **2 Tectonic Rift** `[LINE,WALL,DEPLOY]` 11.2 m fissure: stun 1.2–1.4 s, then a wall blocking movement (not projectiles) up to 4 s. CD 15 s.
- **3 Berserker Barrage** `[SELF-AOE,CHANNEL,CONE]` two spins then a 180° cone. CD 12–10 s.
- **U Anvil of Dawn** `[LEAP,UNTARGETABLE,GROUND]` flies up, lands anywhere within 32 m: 3.2 m stun 1.5 s. CD 110–90 s.
- Aspect of Thunderstruck: Thunderstruck always on but weaker; triple hits heal and slow.

##### Tsukuyomi (Japanese; Assassin; Jungle; melee physical)
Source: [S2 wiki API batch](https://wiki.smite2.com/api.php?action=query&prop=revisions&rvprop=content&rvslots=main&titles=The_Morrigan|Thor|Tsukuyomi|Ullr&format=json)
- **P Shingetsu & Mangetsu** `[PASSIVE]` damage empowers his two tonfas: one cleaves and restores mana, the other adds damage and heals.
- **1 Dark Moon Shuriken** `[LINE-PROJ]` 10.4 m, sticks in the first god; retrieve to cut CD. CD 14 s.
- **2 Kusarigama** `[CONE,MULTI-STAGE]` 3 swings: disarm 1 s, then a harder hit. CD 14 s.
- **3 Silver Moon Caltrops** `[GROUND]` caltrop field 6 s: moving enemies take more and are re-slowed. CD 14 s.
- **U Piercing Moonlight** `[LINE-PIERCE,DASH,MULTI-STAGE]` 4 beams mark gods, then dashes through all marked gods (up to 12 strikes); CC immune. CD 100 s.
- Aspect of Mangetsu: ranged Mangetsu attacks; the shuriken no longer sticks.

##### Ullr (Norse; Hunter; Carry; ranged bow / melee axes)
Source: [S2 wiki API batch](https://wiki.smite2.com/api.php?action=query&prop=revisions&rvprop=content&rvslots=main&titles=The_Morrigan|Thor|Tsukuyomi|Ullr&format=json)
- **P Weapon Master** `[PASSIVE]` an ability used in one stance cuts the other stance's cooldowns by 1 s.
- **U Wield Axes / Wield Bow** `[STANCE]` 1 s CD stance swap, cleanses disarm.
- Bow: **1 Bladed Arrow** `[LINE-PIERCE]` 11.2 m (stops on walls); **2 Expose Weakness** `[SELF-BUFF]`; **3 Hail of Arrows** `[GROUND]` 1.6 m at 12.8 m, slow 30%.
- Axe: **1 Thrown Axe** `[LINE-PROJ]` 11.2 m stun 0.8–1.2 s; **2 Invigorate** `[SELF-BUFF]` speed; **3 Glory Bound** `[LEAP]` 8.8 m, shred. All CD 14–15 s.
- Aspect: none listed on the page.

##### Vulcan (Roman; Mage; Mid; ranged magical)
Source: [S2 wiki API batch](https://wiki.smite2.com/api.php?action=query&prop=revisions&rvprop=content&rvslots=main&titles=Vulcan|Xbalanque|Xing_Tian|Yemoja&format=json)
- **P Master Craftsman** `[PASSIVE,ITEM]` buys ability mods in the shop.
- **1 Backfire** `[LINE-PIERCE,DASH-BACK]` shot forward pushes him back. CD 9–7 s.
- **2 Inferno Cannon** `[DEPLOY,TURRET]` turret fires at enemies in a 110° cone 9.6 m. CD 12 s.
- **3 Magma Bomb** `[GROUND]` lobbed 9.6 m, 2.4 m knock-up. CD 10 s.
- **U Earthshaker** `[LINE-PROJ,LONG-RANGE]` 19.2 m, explodes 4.8 m; up to 1.65x damage at max range. CD 90–70 s.
- Aspect of Fortification: nearby turrets raise his and their protections and regen.

##### Xbalanque (Maya; Hunter; Carry; ranged physical)
Source: [S2 wiki API batch](https://wiki.smite2.com/api.php?action=query&prop=revisions&rvprop=content&rvslots=main&titles=Vulcan|Xbalanque|Xing_Tian|Yemoja&format=json)
- **P Dead of Night** `[PASSIVE]` damage dealt to gods unlocks permanent Strength or Intelligence at thresholds (1k to 21k).
- **1 Branching Bola** `[TOGGLE]` basics split into homing bolas. **2 Poison Darts** `[CONE]` 15 darts 110° 8.8 m, slow. CD 13 s. **3 Rising Jaguar** `[DASH,AIRBORNE,HOMING]` dash then rises and fires homing darts, CC immune airborne. CD 16–14 s.
- **U Darkest of Nights** `[GLOBAL,SELF-BUFF]` darkness on every enemy god (60% slow 2 s), he gains range (15.2 m), attack and move speed. CD 90 s.
- Aspect of the Nightstalker: Bola fires three ability shots; Darts need fewer hits; Nights resets Darts.

##### Xing Tian (Chinese; Guardian; Support/Solo; melee magical)
Source: [S2 wiki API batch](https://wiki.smite2.com/api.php?action=query&prop=revisions&rvprop=content&rvslots=main&titles=Vulcan|Xbalanque|Xing_Tian|Yemoja&format=json)
- **P Smouldering Rage** `[PASSIVE]` ability hits stack HP regen and temporary max HP (12 stacks, 18 s).
- **1 Furious Roar** `[LINE-PIERCE]` 7.2 m through walls, basic damage reduction + %HP DoT. CD 14 s.
- **2 Hook Slam** `[CONE,MULTI-STAGE]` knock-up then slam root 1.6–2 s (4 m). CD 14–12 s.
- **3 Sky-Cutting Axe** `[LEAP,RECAST]` two 5.6 m leaps. CD 15 s.
- **U Whirlwind of Rage and Steel** `[SELF-AOE,GRAB,CHANNEL]` wind-up, spin grabbing enemies 3.2 m, then throws them forward; CC immune. CD 90 s.
- Aspect of Relentless Spite: a Spite resource replaces regen/max HP; the ult channels on Spite.

##### Yemoja (Yoruba; Guardian; Support; ranged magical)
Source: [S2 wiki API batch](https://wiki.smite2.com/api.php?action=query&prop=revisions&rvprop=content&rvslots=main&titles=Vulcan|Xbalanque|Xing_Tian|Yemoja&format=json)
- **P Omi** `[PASSIVE,RESOURCE]` uses Omi instead of mana; non-ultimate abilities have NO cooldown (Omi is the limiter); basics heal allies.
- **1 Bouncing Bubble / Moonstrike** `[GROUND-PROJ,BOUNCE,ALTERNATING]` bubble bounces twice (slow), next cast becomes Moonstrike (10.4 m multi-strike, final stun 1 s), then back. 2 Omi.
- **2 Mending Waters** `[LINE-PROJ,BOUNCE-ALLIES]` wave damages enemies then bounces between allies, healing/shielding. 3 Omi.
- **3 Riptide** `[GROUND,DEPLOY]` ring knocks back anyone entering. 3 Omi.
- **U River's Rebuke** `[GROUND,WALL,DELAY]` two water walls (15 m) cage enemies and block projectiles for 4 s, then crash (tremble 2 s, 60% decaying slow). CD 120 s.
- Aspect of Downpour: Mending Waters bounces on enemies stacking Intelligence; Moonstrike loses its stun.

##### Ymir (Norse; Guardian; Support; melee magical)
Source: [S2 wiki API, Ymir](https://wiki.smite2.com/api.php?action=query&prop=revisions&rvprop=content&rvslots=main&titles=Ymir&format=json)
- **P Frostbite** `[PASSIVE]` ability damage/CC frostbites: more attack damage from Ymir, 15% less damage to him, -10% attack speed.
- **1 Ice Wall** `[GROUND,DEPLOY,WALL,RECAST]` wall at up to 11.2 m blocks everyone 2.5–4.5 s, knocks enemies away on placement; cast at his feet to vault himself forward; reactivate to destroy. CD 15–13 s.
- **2 Glacial Strike** `[LINE,MOVING-AOE]` 3.6 m ice field travelling 6 m from him, slow 25% 2 s; he is self-slowed while swinging. CD 8–6 s.
- **3 Frost Breath** `[CONE]` 90° 5.6 m: stun 1–1.4 s (+ with protections); rooted while breathing. CD 14 s.
- **U Shards of Ice** `[SELF-AOE,CHANNEL,CHARGE]` up to 3 s channel (CC immune, rooted), 40% slow aura 5.6 m, then erupts for 50–100% damage by channel time. CD 70 s. Counter: walk out of the 5.6 m circle.
- Aspect: none listed on the page.

##### Zeus (Greek; Mage; Mid; ranged magical)
Source: [S2 wiki API batch](https://wiki.smite2.com/api.php?action=query&prop=revisions&rvprop=content&rvslots=main&titles=Zeus|Heimdallr|Heimdall|Maman_Brigitte&redirects=1&format=json)
- **P Overcharge** `[PASSIVE]` damage applies charges (+15% attack damage taken each, 3 max).
- **1 Chain Lightning** `[LINE-PROJ,BOUNCE]` 8.8 m bolt bounces 5–6 times, slow 20%. CD 12–10 s.
- **2 Thunderclap** `[SELF-AOE,SELF-BUFF]` 3.2 m, then speed and haste 4 s. CD 12 s.
- **3 Detonate Charge** `[UNTARGETED,ALL-CHARGED]` explodes charges on every enemy that has them; 0.5 s stun at max charges. CD 12–10 s.
- **U Lightning Storm** `[GROUND]` 4.8 m at 8.8 m, 5 hits over 4.5 s. CD 90–70 s.

#### Smite-1-only gods (not on the Smite 2 roster as of 19 Nov 2026), from the Smite 1 wiki (final patch 12.1); ranges in units (1 u = 0.16 m)
- Aspect: none listed on the page.

##### Ah Muzen Cab (Maya; Hunter; ranged physical)
Source: [Smite 1 wiki, Ah Muzen Cab](https://smite.fandom.com/wiki/Ah_Muzen_Cab)
- **P Bees!** `[PASSIVE]` basics apply a 2 s bee DoT that reveals and spreads; each basic refreshes it.
- **1 Hive** `[GROUND,DEPLOY]` hive at 55 u (8.8 m); its 90 u aura gives him move/attack speed and regen; 7–11 hives, killable by basics only. CD 12 s.
- **2 Swarm** `[LINE-PIERCE]` 70 u (11.2 m) bee line, applies Bees. CD 15–11 s.
- **3 Honey** `[GROUND,STEERED]` honey patch 10 u radius at 55 u that he can move while it lasts (4 s), slow 20–30%; hive bees attack enemies leaving it. CD 12 s.
- **U Stinger** `[LINE-PIERCE,RETRIEVE]` 70 u line, sticks in the first god: slow + cripple + shred 3 s; then drops; picking it up cuts the CD by 60%. CD 100 s.

##### Ao Kuang (Chinese; Mage, melee magical)
Source: [Smite 1 wiki, Ao Kuang](https://smite.fandom.com/wiki/Ao_Kuang)
- **P Dragon King's Sword** `[PASSIVE]` stacks every 10 s: next damaging ability on a god has -2 s CD and heals 3%.
- **1 Water Illusion** `[BLINK,STEALTH,RECAST]` teleport 30 u forward into stealth (5 s), leaving a water clone; recast detonates the clone (20 u). CD 16 s.
- **2 Dragon Call** `[SELF-BUFF,RECAST,LINE]` 6 dragons empower his basics; recast throws the remaining dragons 55 u as a slowing line. CD 15–13 s.
- **3 Wild Storm** `[CONE]` 30 u cone, stronger while Dragon Call is up. CD 6 s.
- **U King of the Eastern Seas** `[TARGET-CLOSE,GRAB,EXECUTE]` grabs one target in 15 u, knocks it up; below 30% HP he turns into a dragon and executes, then chooses where to land (20 u damage). Cleansing the knock-up before its apex avoids the execute. CD 100 s.

##### Arachne (Greek; Assassin, melee)
Source: [Smite 1 wiki, Arachne](https://smite.fandom.com/wiki/Arachne)
- **P Predator** `[PASSIVE]` basics +1.25% per 5% missing HP of target.
- **1 Venomous Bite** `[NEXT-ATTACK]` next basic within 5 s poisons, anti-heal, heals her. CD 15–11 s.
- **2 Cocoon** `[SELF-BUFF]` 4 s attack speed; 3 empowered hits on one target stun 1–1.4 s and add 2 s to its cooldowns. CD 14 s.
- **3 Web** `[LINE-PROJ,DEPLOY]` 45 u web stops on first enemy/wall; at max range becomes a trap (up to 3); slow 15% 4–6 s, reveal, web trail she runs fast on, broodlings attack. CD 14–12 s.
- **U Night Crawler** `[UNTARGETABLE,LEAP]` climbs onto an overhead web (5 s, fast, can cast 1 and 2), then drops onto a 15 u circle within 50 u, leaving a big web. CC immune, untargetable. CD 90–70 s.

##### Baba Yaga (Slavic; Mage, ranged)
Source: [Smite 1 wiki, Baba Yaga](https://smite.fandom.com/wiki/Baba_Yaga)
- **P Creeping Cabin** `[PASSIVE,PET]` her walking cabin stores essence that stacks items or heals her; it has collision.
- **1 Wild Witchcraft** `[LINE,RANDOM-SHAPE]` magic flies in a random path (left corner, right corner, split, oval) leaving a random field 4 s (ally protections, ally speed, enemy slow, or silence); the passive meter previews it. CD 12 s.
- **2 Baba's Brew** `[GROUND,RANDOM,STORE]` brews a potion of random ingredients (damage, slow, attack-speed/power debuff), 15 u at 60 u; can store it as a consumable for later. CD 10 s.
- **3 Blast Off!** `[LEAP,DELAY]` hides in her mortar (35% mitigation) then 1 s later launches forward 40 u, damaging around the launch. CD 14 s.
- **U Home Sweet Home** `[GROUND,CONTROL-PET]` drops the cabin on herself (knockback), rides it 8 s as a shield and throws 4 witchfire bolts (creeping fire that chases enemies). CC immune. CD 90–70 s.

##### Bakasura (Hindu; Assassin, melee)
Source: [Smite 1 wiki, Bakasura](https://smite.fandom.com/wiki/Bakasura)
- **P Insatiable Hunger** `[PASSIVE]` kills give attack/move speed stacks.
- **1 Take Down** `[LEAP]` 55 u, 15 u radius; +10% damage taken and anti-heal 3 s. CD 12 s.
- **2 Eat Minion** `[TARGET-MINION]` eats a minion in 12 u: heal, mana, CDR; stores up to 6 for the ult. CD 10–8 s.
- **3 Butcher Blades** `[SELF-BUFF]` passive power; active adds true damage per hit 6 s. CD 12 s.
- **U Regurgitate** `[GROUND,SUMMON]` spits stored minions into a 25 u area at 70 u (6 s slow + cripple); his basics become cones; 1.5 s CC immunity. CD 90–70 s.

##### Bake Kujira (Japanese; Guardian, melee; S1 only, added 2024)
Source: [Smite 1 wiki, Bake Kujira](https://smite.fandom.com/wiki/Bake_Kujira)
- **P Curse of the Ghost Whale** `[PASSIVE]` enemies that hard-CC him are Cursed; protections become basic damage; attack speed becomes haste.
- **1 Rough Waters** `[SELF-BUFF]` longer basic range, less movement penalty, protection stacks per hit. CD 14–12 s.
- **2 Sonic Wave** `[CONE]` 40 u, slow + curse (cursed deal less damage); hits on cursed double slow. CD 10 s.
- **3 Twisting Dive** `[DASH,CHARGE]` gathers power, dashes 40 u: stun 1.5 s and carries enemies to his end point. CD 14 s.
- **U Yokai's Lament** `[SELF-AOE,AURA,TIME-DILATION]` 5 s song: enemies 20–50 u away gain time dilation (everything they do is up to 40% slower); within 20 u they take more damage. CD 110–90 s.

##### Camazotz (Maya; Assassin, melee)
Source: [Smite 1 wiki, Camazotz](https://smite.fandom.com/wiki/Camazotz)
- **P Essence Drinker** `[PASSIVE,PICKUP]` bonus lifesteal; god deaths leave pools only he can see and drink from (HP/mana).
- **1 Screech** `[LINE-PROJ,BOUNCE]` 70 u, pierces minions; on a god, the echo bounces off walls; catching it grants vision and power. CD 12 s.
- **2 Vampire Bats** `[LINE-PROJ]` 55 u bats on a single target: slow 40%, anti-heal, return heal. CD 10 s.
- **3 Devour** `[LEAP]` 40 u, heals per hit. CD 13 s.
- **U Bat Out of Hell** `[UNTARGETABLE,DASH,RECAST]` flies 4 s (damage/CC immune), up to 3 swoops of 35 u. CD 120–100 s.

##### Chang'e (Chinese; Mage, ranged)
Source: [Smite 1 wiki, Chang'e](https://smite.fandom.com/wiki/Chang%27e)
- **P Jade Rabbit** `[PASSIVE]` buys items from anywhere; +40% speed while dancing.
- **1 Crescent Moon Dance** `[CONE,SWEEP]` 35 u sweep left to right. CD 6 s.
- **2 Moonlit Waltz** `[SELF,IMMUNE]` 1 s spin immune to damage and CC; restores mana per hit avoided. CD 20–14 s.
- **3 Moonflower Dance** `[SELF-AOE,HEAL]` 30 u heal/damage. CD 12 s.
- **U Waxing Moon** `[LINE-PIERCE]` 70 u: stun 1 s +1 s per god already stunned (up to 5 s). CD 100 s.

##### Charybdis (Greek; Hunter, ranged)
Source: [Smite 1 wiki, Charybdis](https://smite.fandom.com/wiki/Charybdis)
- **P Raging Tides** `[PASSIVE,RESOURCE]` Tide from hits gives attack speed; spent to amplify abilities.
- **1 Spike Shot** `[SELF-BUFF]` 4 s of wider, minion-piercing basics that splinter on gods/walls. CD 14–10 s.
- **2 Capsize** `[CONE,CHARGE]` hold up to 0.75 s (spending Tide) for a wider 45 u cone: decaying slow and shred. CD 14–12 s.
- **3 Whirlpool Form** `[SELF-AOE,UNTARGETABLE,TOGGLE]` dives into a whirlpool (untargetable, damage-immune up to 3 s); re-toggle with Tide for speed and a knock-up on exit. CD 17–15 s.
- **U The Maw Hungers** `[SELF-BUFF,CONE,PULL]` 6 s CC immune; one big bite 70 u that drags enemies back and stuns 1.3 s; god kills grant another bite. CD 90 s.

##### Chernobog (Slavic; Hunter, ranged)
Source: [Smite 1 wiki, Chernobog](https://smite.fandom.com/wiki/Chernobog)
- **P Heart of Cold** `[PASSIVE]` 3 basic hits on a target make it explode in a small area.
- **1 Crystallized Curses** `[GROUND,DELAY]` crystal at 60 u (20 u radius) slows on landing, roots 1 s when it explodes 3 s later (or earlier if shot by 2). CD 15–13 s.
- **2 Vicious Barrage** `[LINE-PIERCE]` 65 u piercing basic-like shard through walls; attack speed after. CD 8 s.
- **3 Into Darkness** `[DASH,WALL-ENTER]` 40 u dash; if he hits a wall he hides inside it (untargetable, damage immune, up to 3 s). CD 16–14 s.
- **U Living Nightmare** `[GLOBAL,TELEPORT]` brief channel, shadows appear at every enemy god for 8 s (stacking slow); he flies to one and takes its place, refreshing his cooldowns. CC immune. CD 120 s.

##### Cliodhna (Celtic; Assassin, melee)
Source: [Smite 1 wiki, Cliodhna](https://smite.fandom.com/wiki/Cliodhna)
- **P Phantasmal** `[PASSIVE,WALL-WALK]` every 12 s she can walk INTO map walls (1 s to enter), moving inside them untargetable, losing HP over time.
- **1 Banshee's Wail** `[CONE,CHANNEL]` 3 hits 30 u, last silences + deafens 1.5 s; from inside a wall a spectral face wails in a 180° cone. CD 12 s.
- **2 Flickering Visions** `[LINE-PROJ]` 60 u bolt explodes 15 u: gods hit cannot see her for 5 s. CD 14 s.
- **3 Lurching Claw** `[DASH,RECAST]` 50 u steerable dash, recast/end claw swipe. CD 15–13 s.
- **U Tearing The Veil** `[LINE-PIERCE,CHARGES,DEPLOY]` 2 charges: 85 u rift line through walls, lingers (slow ticks); from inside a wall it becomes a proximity trap. CD 55–35 s.

##### Cthulhu (Great Old Ones; Guardian, melee)
Source: [Smite 1 wiki, Cthulhu](https://smite.fandom.com/wiki/Cthulhu)
- **P Prey on Fear** `[PASSIVE,FACING-CHECK]` Torment stacks become Insanity (20 s); he gains power per insane god nearby.
- **1 Sanity Break** `[CONE]` 32 u: attack-speed slow, enemies deal less to him; double stacks if facing him; fears 1.5 s if insane. CD 14–12 s.
- **2 The Mire** `[GROUND,CHANNEL]` growing mire at 55 u; two shots: slow, then root 1 s. CD 14 s.
- **3 Rushing Terror** `[DASH]` 50 u charge: stun 0.4 s, knock aside; two side projectiles follow to 70 u. CD 16 s.
- **U Descend into Madness** `[TRANSFORM]` 10–14 s giant form: +20% HP, CC immune, new 1/2/3 (Sever, Devastate, Transfuse) with 1–6 s cooldowns; facing him speeds up Insanity. CD 120 s.

##### Erlang Shen (Chinese; Warrior, melee)
Source: [Smite 1 wiki, Erlang Shen](https://smite.fandom.com/wiki/Erlang_Shen)
- **P Howling Celestial Dog** `[PASSIVE]` his dog also bites on every basic (5% basic power + 2% max HP).
- **1 Spot Weakness** `[SELF-BUFF]` damage/lifesteal per hit; debuffs enemy damage. CD 14 s.
- **2 Pin** `[GROUND,SWEETSPOT]` spear at 60 u: area damage, root 1.5 s only in the 8 u centre; landing delay grows with range (instant to 0.5 s). CD 16–14 s.
- **3 72 Transformations** `[DASH,AIM-DISTANCE-PICKS-FORM]` targeting under 40 u = Turtle (knock-up + shield), over 40 u = Mink (fast, stops on a god). CD 16 s.
- **U 9 Turns Blessing** `[CONE]` 30 u taunt 1.5 s, 35% mitigation 4 s, then heal. CD 70 s.

##### Fafnir (Norse; Guardian, melee)
Source: [Smite 1 wiki, Fafnir](https://smite.fandom.com/wiki/Fafnir)
- **P Endless Greed** `[PASSIVE]` gold in hand gives protections.
- **1 Cursed Strength** `[LINE-PROJ]` 55 u hammer through walls, stops on a god: stun 1–1.4 s + 30 u slow pulse. CD 15–13 s.
- **2 Coerce** `[TARGET-ALLY]` buffs an ally's attack speed; he deals bonus damage when they hit. CD 16–14 s.
- **3 Underhanded Tactics** `[LEAP,CONE]` leap 55 u (70 as dragon) then cone disarm 2 s (dragon also stuns closest god 2 s). CD 15 s.
- **U Draconic Corruption** `[TRANSFORM]` untargetable during the change, then 40–60 s dragon form with altered abilities and a breath basic. CD 90 s.

##### Freya (Norse; Mage, melee)
Source: [Smite 1 wiki, Freya](https://smite.fandom.com/wiki/Freya)
- **P Brisingamen's Blessing** `[PASSIVE]` bonus magical lifesteal.
- **1 Irradiate** `[SELF-BUFF]` basics deal bonus magic 5 s. CD 8 s.
- **2 Pulse** `[SELF-BUFF]` basics become ranged (55 u) with splash slow 6 s. CD 12 s.
- **3 Banish** `[GROUND]` 10 u circle at 55 u: enemies are banished upward 1.5 s (cannot act or be hit). CD 18–16 s.
- **U Valkyrie's Discretion** `[UNTARGETABLE,GROUND,MULTI-HIT]` flies 3.6 s (damage and CC immune when fully up), 4 blasts at 12 u circles. CD 110 s.

##### He Bo (Chinese; Mage, ranged)
Source: [Smite 1 wiki, He Bo](https://smite.fandom.com/wiki/He_Bo)
- **P Steady Flow** `[PASSIVE]` each cast +5% magical power (3 stacks, 5 s).
- **1 Water Cannon** `[CONE]` 35 u. CD 4 s.
- **2 Atlas of the Yellow River** `[LINE,DEPLOY]` 80 u river 7 s: allies fast + slow immune, enemies slowed. CD 14–12 s.
- **3 Waterspout** `[GROUND]` 10 u knock-up at 55 u. CD 10 s.
- **U Crushing Wave** `[DASH,UNTARGETABLE]` becomes a wave 55 u forward (1 s), untargetable, CC immune. CD 90 s.

##### Heimdallr (Norse; Hunter, ranged; listed on the S2 "Gods" page but no S2 god page exists as of 19 Nov 2026, so the S1 kit is given)
Source: [Smite 1 wiki, Heimdallr](https://smite.fandom.com/wiki/Heimdallr)
- **P The Vigilant** `[PASSIVE]` power per enemy god seen; keeps seeing gods 6 s after they vanish (even stealth).
- **1 Piercing Sight** `[DEPLOY,RECAST,GROUND]` throws his sword up (reveals 80 u, up to 10 s); recast calls it down onto a 15 u circle within 60 u. CD 12 s.
- **2 Gjallarhorn** `[CONE,CHANNEL]` 2 s horn 60 u: slow + attack-speed slow; final blast knockback. CD 14 s.
- **3 The Bifrost** `[DEPLOY,TELEPORT]` places two fragments; travelling between them takes 0.8–3.5 s warm-up and the CD scales 16–210 s with distance. Enemies crossing the line are revealed.
- **U Through the Realms** `[DASH,GRAB,BANISH]` charges 55 u; first god hit is stunned, launched through a portal (banished 4 s through fire and ice realms) and returns at a random spot in front of him. CC immune until the banish. CD 90–70 s.

##### Hera (Greek; Mage, ranged)
Source: [Smite 1 wiki, Hera](https://smite.fandom.com/wiki/Hera)
- **P Commanding Presence** `[PASSIVE]` her hits lower Argus/Shroud cooldowns.
- **1 Royal Assault** `[CONE,GROUND]` short cone, then Argus' fists slam the target spot (50 u). CD 8 s.
- **2 Polymorph** `[LINE-PIERCE]` 80 u: polymorph gods 1.6–2 s into jungle monsters (no attacks or abilities). CD 14 s.
- **3 Divine Shroud** `[SELF-BUFF]` shield + speed; empowers Argus. CD 16–14 s.
- **U Argus, the Defender** `[GROUND,SUMMON,RECAST]` drops a controllable guardian pet (40 s, 700–3500 HP) with knock-up on landing; recast directs or recalls him. CD 90 s.

##### King Arthur (Arthurian; Warrior, melee)
Source: [Smite 1 wiki, King Arthur](https://smite.fandom.com/wiki/King_Arthur)
- **P Steadfast** `[PASSIVE,ALTERNATING,RESOURCE]` every ability swaps him between Standard and Combo versions of all three; hits build Energy for the ult; instant-cast; basics dash 15 u.
- **1 Overhead Slash / Hamstring** `[LINE / CONE]` 70 u travelling slash, or 30 u cripple sweep. **2 Battle Stomp / Uppercut** `[SELF-AOE / DASH]` slow, or charge 35 u stopping on a god with a knock-up. **3 Twin Cleave / Bladestorm** `[DASH]` cleaves with shred, or a spinning advance.
- **U Sundering Strike / Excalibur's Wrath** `[LINE,DASH,ENERGY-TIERS]` 35 energy: jab stun 1 s; 80 energy: charge, launch the god (banish) for 6 hits and slam (CC immune, untargetable).

##### Lancelot (Arthurian; Assassin, melee)
Source: [Smite 1 wiki, Lancelot](https://smite.fandom.com/wiki/Lancelot)
- **P Camelot's Quest** `[PASSIVE]` kills stack: speed while mounted, less frontal basic damage taken while on foot.
- **1 Piercing Thrust** `[DASH,RECAST]` short dash + thrust; again within 3 s on a hit. CD 10 s.
- **2 Skilled Strikes** `[CONE]` shield knockback then lance sweep (bonus far). CD 14 s.
- **3 Mount Up** `[STANCE,DASH]` mounts (speed, regenerating shield, CC immune except stuns/time dilation) and gets three mounted abilities: Shining Gallop (horse line through walls, slow), Crashing Dive (root 0.5 s then area), Quick Turn. CD 14 s.
- **U The Grand Joust** `[LINE,DASH]` jousting list cripples in the area, then an 80 u charge; CC immune. CD 90 s.

##### Maman Brigitte (Voodoo; Mage, melee; listed on the S2 "Gods" page but no S2 god page as of 19 Nov 2026)
Source: [Smite 1 wiki, Maman Brigitte](https://smite.fandom.com/wiki/Maman_Brigitte)
- **P Soul Spikes** `[PASSIVE]` 5 stacks burst for missing-HP damage and give a Soul Orb.
- **1 Party Trick** `[CONE,CHANNEL,RECAST]` fire breath up to 2 s (rum meter), then the bottle slam stuns 1.2 s; CD shorter the more rum is left. CD 8–14 s.
- **2 Madame Fangs** `[LINE-PIERCE]` 60 u spectral snake marks enemies for bonus damage (min range 27.5 u). CD 11 s.
- **3 Spirit Seize** `[DASH,ATTACH-ENEMY]` 40 u dash; on a god she possesses them (untargetable, travels with them, 2 s of damage), exits by dash. CD 16 s.
- **U Explosion of Souls** `[GROUND,CHANNEL]` CC immune, throws a soul orb whose size grows with Soul Orbs, knock-up + mark. CD 90 s.

##### Martichoras (Greek; Hunter, ranged)
Source: [Smite 1 wiki, Martichoras](https://smite.fandom.com/wiki/Martichoras)
- **P Monstrosity** `[PASSIVE]` Ferocity to 100 triggers attack speed; permanent lifesteal stacks; basics stack a venom DoT.
- **1 Acid Rain** `[GROUND,MOVING]` rolling rain of spikes that leaves a slowing trail 3 s. CD 14 s.
- **2 Poisoned Barb** `[LINE-PROJ]` 55 u, pierces minions, sticks in the first god 3 s; hit it again to explode: root 1–1.8 s. CD 13 s.
- **3 Stalk Prey** `[DEPLOY,STEALTH-ZONE]` places a patch of stealth grass (120 s, max 3). CD 25–21 s.
- **U Death from Above** `[UNTARGETABLE,GROUND,MULTI-HIT]` CC immune and untargetable in the air, 12 bursts over 3 s, protection shred. CD 110 s.

##### Maui (Polynesian; Guardian, melee)
Source: [Smite 1 wiki, Maui](https://smite.fandom.com/wiki/Maui)
- **P Manaiakalani** `[PASSIVE]` gods hard-CC'd near him are marked; next basic pulls them.
- **1 Master Fisherman** `[LINE-PROJ,CHARGE]` hold 1 s for range 10–55 u; stops on the first god: cripple + vortex toward him 1.5 s. CD 14–12 s.
- **2 Mystical Ulua** `[GROUND,TELEPORT-ALLY]` water pillar: buffs allies; an ally standing in it 1 s is bubbled to Maui. CD 12–10 s.
- **3 Solar Swing** `[LEAP,CHANNEL]` swings up to 3 s then slams: stun 1.5 s. CD 15 s.
- **U Landfall** `[GROUND,UNTARGETABLE,PULL,WALL]` leaps, hooks an island up at 20–60 u: knocks up and pulls enemies in front; the island blocks movement 4 s. CD 90 s.

##### Olorun (Yoruba; Mage, ranged)
Source: [Smite 1 wiki, Olorun](https://smite.fandom.com/wiki/Olorun)
- **P Touch of Fate** `[PASSIVE]` magical power gives crit chance.
- **1 Focused Light** `[LINE-PROJ,CHARGE]` charge up to 2 s for range 45–110 u (200 in his field); passes minions, stops on gods. CD 12 s.
- **2 Overflowing Divinity** `[SELF-BUFF,RECAST,GROUND]` attack speed; recast calls a sun firing stored shots at a 15 u area. CD 12 s.
- **3 Consecration** `[SELF-AOE]` 20 u knockback, slow, heals allies. CD 14 s.
- **U Sanctified Field** `[LINE,DEPLOY,TIME-DILATION]` large field 85 u for 5 s: enemies act 40% slower, he acts 30% faster. CD 120–100 s.

##### Persephone (Greek; Mage, ranged)
Source: [Smite 1 wiki, Persephone](https://smite.fandom.com/wiki/Persephone)
- **P Pomegranate Seeds** `[PASSIVE,DEATH]` while dead she places 6 plants that sprout on respawn.
- **1 Bone Rush** `[LINE-PROJ]` skeleton charges 65 u through minions, stops on gods, slow; drops a Harvest Skull. CD 12–10 s.
- **2 Harvest** `[GROUND,DEPLOY]` explosion leaves 3 skulls; her basics activate plants: skulls heal, flowers charge and bite. CD 13 s.
- **3 Flourish** `[LEAP,SELF-AOE]` hops forward or back by movement direction; activates plants. CD 15–13 s.
- **U Grasp of Death** `[LINE-PROJ,GLOBAL]` vines fly across the map, stop on the first god or wall: root + cripple, then tether nearby gods within 55 u for 5 s. 5 basics destroy it. CD 90 s.

##### Raijin (Japanese; Mage, ranged)
Source: [Smite 1 wiki, Raijin](https://smite.fandom.com/wiki/Raijin)
- **P Charged Tempo** `[PASSIVE]` every 5 casts -1.5 s on all cooldowns; wider basics cut cooldowns 0.2 s.
- **1 Percussive Storm** `[LINE-PIERCE,MULTI-HIT]` 4 widening thunder lines 65 u. CD 10 s.
- **2 Raiju** `[TARGET-AREA,MARK]` marks the enemy nearest the targeter centre (55 u): slow, reveal; his next hit awakens Raiju for bouncing damage. CD 15–11 s.
- **3 Thunder Crash** `[GROUND,TELEPORT]` bolt mesmerizes 0.3 s, he rises (briefly untargetable) and crashes there (60 u). CD 17–15 s.
- **U Taiko Drums** `[LINE,CHANNEL,CHOICE]` flies, 4 drum beats each a chosen line: full damage, taunt 0.5 s, or fear 0.5 s; CC immune. CD 90 s.

##### Serqet (Egyptian; Assassin, melee)
Source: [Smite 1 wiki, Serqet](https://smite.fandom.com/wiki/Serqet)
- **P Catalyst** `[PASSIVE]` basics consume her dormant poisons; 2–3 different poisons = %max HP burst.
- **1 Deathbane** `[DASH,MULTI-STAGE]` three side-to-side dashes (50 u), shred, can crit; knock-up immune. CD 13 s.
- **2 Cobra's Kiss** `[LINE-PROJ,RE-AIM]` two blades fired one after the other (40 u); the second can be re-aimed by turning; Madness 1.2 s (target attacks its allies or walks to her). CD 12 s.
- **3 Ambush** `[STEALTH,ROOTED,LEAP]` she turns invisible but rooted in place; leaps once 65 u (15 u radius) to strike; gods within 12.5 u reveal her. CD 16 s.
- **U Last Breath** `[TARGET-LEAP]` leaps onto a target in a small area: stun 1 s, pushes it 30 u, true-damage poison 5 s that blocks all healing and spreads on death. CC immune. CD 90 s.

##### Set (Egyptian; Assassin, melee)
Source: [Smite 1 wiki, Set](https://smite.fandom.com/wiki/Set)
- **P Relentless** `[PASSIVE]` damage stacks attack speed (10, 6 s), double stacks against Horus.
- **1 Skewer** `[LINE-PIERCE,COMMAND]` 60 u line, slow 25% 3 s; all his spawn also dash to the targeted spot. CD 9 s.
- **2 Spawn of Set** `[GROUND,SUMMON,CHARGES]` 2 charges; untargetable sand spawn at 70 u attack nearby (max 8). CD 11–9 s.
- **3 Sandstorm** `[SELF-AOE,TELEPORT]` 16 u storm (damage reduction, slow immunity, obscures vision); teleport once to a spawn or a 65 u spot. CD 10 s.
- **U Kingslayer** `[SELF-BUFF]` 12 s: speed; his hits mark gods; 4 marks explode, heal him and create spawn. CD 90–70 s.

##### Shiva (Hindu; Warrior, melee)
Source: [Smite 1 wiki, Shiva](https://smite.fandom.com/wiki/Shiva)
- **P Samsara** `[STANCE-AUTO]` damaging gods cycles him between Bliss (ally buffs) and Destruction (enemy debuffs); each switch -2 s CDs.
- **1 Emblazoned Sweep** `[SELF-AOE,PULL]` 20 u spin pulls in and leaves a firewall ring (speed for allies / shred for enemies crossing). CD 12 s.
- **2 Damaru's Tempo** `[CONE,SEGMENT-SELECT]` 45 u cone in 15 u segments; the chosen segment knocks up. CD 13 s.
- **3 Pillar of Dawn** `[DASH,RECAST]` dash into a pillar of fire, meditate up to 4 s (40% mitigation, CC immune except stun), dash out. CD 18–14 s.
- **U Shiva Tandava** `[SELF-AOE,CHANNEL,SEQUENCE-SELECT]` 6 s dance (CC immune), every 1.5 s a pre-selected step: heal allies, amplify next step, or damage enemies. CD 90 s.

##### Skadi (Norse; Hunter, ranged)
Source: [Smite 1 wiki, Skadi](https://smite.fandom.com/wiki/Skadi)
- **P Kaldr** `[PET]` wolf companion (Beast or invulnerable Elemental form).
- **1 Piercing Cold** `[LINE-PIERCE]` 55 u spear, slow 20–40% 3 s; Kaldr deals double to targets hit. CD 12 s.
- **2 Rune of the Hunt** `[TARGET-AREA,TOGGLE,PET-COMMAND]` marks an enemy in a 10 u targeter at 70 u for Kaldr to chase. CD 0.5 s.
- **3 Permafrost** `[GROUND]` ice field 5 s at 55 u: enemies slide (lose movement control) and are slowed; she gains speed on it. CD 16 s.
- **U Winter's Grasp** `[GROUND,PET-LEAP]` snowstorms around her and where Kaldr leaps (70 u): root 1–2 s, 4 s of ticks. CD 100 s.

##### Surtr (Norse; Warrior, melee)
Source: [Smite 1 wiki, Surtr](https://smite.fandom.com/wiki/Surtr)
- **P Obsidian Flesh** `[PASSIVE,PICKUP]` losing HP drops fragments he can pick up (enemies can destroy them by walking over).
- **1 Flames of Muspell** `[NEXT-ATTACK]` haste; next basic ignites and spawns an imp; stacks forever. CD 14–10 s.
- **2 Giant's Grasp** `[PULL,LINE-PROJ]` pulls the closest minion/imp/rock to him and hurls it 55 u: stun 1.2 s. CD 13 s.
- **3 Emberwalk** `[SELF-AOE,RING]` 25 u ember ring expands and contracts (slow), speed buff. CD 15 s.
- **U End of Days** `[LEAP,UNTARGETABLE,GLOBAL-ish]` 2 s CC-immune wind-up, 4 s in the air (damage immune), chooses a landing spot; meteorites hit enemies and spawn imps; knock-up. CD 100 s.

##### Terra (Roman; Guardian, melee)
Source: [Smite 1 wiki, Terra](https://smite.fandom.com/wiki/Terra)
- **P Standing Stones** `[PASSIVE,DEPLOY]` her abilities raise stones (with collision); while any stand she is knock-up immune and basics cleave and slow.
- **1 Force of Nature** `[DASH,RECAST]` 35 u charge; shattering a stone gives a second charge. CD 11 s.
- **2 Crushing Earth** `[GROUND,WALL,RECAST]` two stone walls at 55 u (placeable through map walls); recast slams them together: stun 1.5 s. CD 15–13 s.
- **3 Monolith** `[GROUND,DEPLOY]` healing monolith 10 s; shatter it for a 1 s root. CD 16 s.
- **U Earthen Fury** `[GLOBAL-TEAM]` 10 s: every ally gets mitigation and protective stones, every enemy takes +5% damage and harmful stones (4 damage instances trigger them). CD 90–70 s.

##### Thoth (Egyptian; Mage, ranged)
Source: [Smite 1 wiki, Thoth](https://smite.fandom.com/wiki/Thoth)
- **P Dead Reckoning** `[PASSIVE]` kills unlock magical penetration stacks.
- **1 Hieroglyphic Assault** `[NEXT-ATTACK,LINE-PIERCE]` next 3 basics pierce and deal ability damage, no movement penalty. CD 10 s.
- **2 Evade and Punish** `[DASH,NEXT-ATTACK]` dash in movement direction, then the next basic roots the first god 1.5 s. CD 14–12 s.
- **3 Glyph of Pain** `[DEPLOY,AMPLIFIER]` a glyph in front of him: his projectiles passing through it gain +30 u range and damage; allies' basics gain damage. CD 5 s.
- **U Final Judgement** `[LINE-PIERCE,CHANNEL,CHARGE]` channel up to 3 s adding glyphs (40% + 20% each), fire a 100–130 u beam; recast early. CD 90 s.

##### Tiamat (Babylonian; Mage, ranged)
Source: [Smite 1 wiki, Tiamat](https://smite.fandom.com/wiki/Tiamat)
- **P Death Begets Life** `[STANCE-PASSIVE]` Flying: heals from deaths; Ground: Hardened Scales.
- Flying **1 Primordial Onslaught** `[LINE-PROJ,CHANNEL]` charge then orbs 70 u; **2 Ruination** `[GROUND,SWEETSPOT]` inner stun 1 s; **3 Grounding Dive** `[LEAP]` 50 u, switches to Ground stance.
- **U Children of Creation** `[SUMMON-MENU]` choose a child: Serpents (lane minions from a pit), Beast (guard that charges gods), Storm (chases enemies, knock-up). CD 30–46 s each.
- Ground stance: **1 Consume** `[CONE]` 25 u cone, slow, executes low minions/monsters (CD 12–8 s); **2 Outburst** `[LINE]` 60 u successive rifts knock up (CD 14–10 s); **3 Rising Flight** `[SELF-AOE,LEAP]` blast then hops backward into Flying stance (CD 20–14 s); **U Tempest of Undoing** `[SELF-AOE]` damage + DoT around her, a scale per god hit (CD 20 s).

##### Tyr (Norse; Warrior, melee)
Source: [Smite 1 wiki, Tyr](https://smite.fandom.com/wiki/Tyr)
- **P Unyielding** `[PASSIVE]` stun/taunt/fear/root/mesmerize cannot last more than 1 s on him.
- **1 Fearless** `[DASH]` 40 u charge: Assault pushes enemies along; Guard passes through; both knock up. CD 14–12 s.
- **2 Power Cleave** `[CONE]` 180°, 15 u. CD 12–8 s.
- **3 Change Stance** `[STANCE]` swap Assault (power) / Guard (protections), resets 1 and 2. CD 9 s.
- **U Lawbringer** `[LEAP]` 70 u leap: slow 30%; Guard stance adds stun 1.5 s; CC immune. CD 90–70 s.

##### Vamana (Hindu; Warrior, melee)
Source: [Smite 1 wiki, Vamana](https://smite.fandom.com/wiki/Vamana)
- **P Sleeping Giant** `[PASSIVE]` power and attack speed from his physical protections.
- **1 Clear the Path** `[DASH,STEERED]` umbrella sprint up to 4 s, knocks up everyone once. CD 14 s.
- **2 Armored Umbrella** `[CONE]` 35 u. CD 13–11 s.
- **3 Umbrellarang** `[LINE-PIERCE,BOOMERANG]` 70 u out and back, attack/move slow. CD 13 s.
- **U Colossal Fury** `[TRANSFORM]` giant 5–9 s: CC immune, area basics, shield, longer when hit. CD 90 s.

##### Yu Huang (Chinese; Mage)
Source: [Smite 1 wiki, Yu Huang](https://smite.fandom.com/wiki/Yu_Huang)
- **P Master of the Dao** `[PASSIVE,RESOURCE]` Dao stacks over time; at 6+ his basics chain to a second enemy.
- **1 Flames of the Phoenix** `[GROUND,CONVERGING]` 4 cinders in an X rush inward and explode in a 12.5 u fire field at 55 u. CD 9 s.
- **2 Dao Cultivation** `[LINE-PIERCE,CHARGE]` charge up to 3 s, fire a 60 u projectile that slows; its trail explodes and roots 1 s. CD 13–11 s.
- **3 Celestial Flight** `[UNTARGETABLE,STEERED-LEAP]` banished up on a dragon 1–3 s, floats down where he steers (15 u). CD 18 s.
- **U Dueling Dragons** `[LINE,AIM-WINDOW]` 3 s to aim his dragon; the Pearl Dragon charges back at it; both push, explode where they meet. CC immune. CD 90 s.

##### Zhong Kui (Chinese; Mage, ranged)
Source: [Smite 1 wiki, Zhong Kui](https://smite.fandom.com/wiki/Zhong_Kui)
- **P Demon Bag** `[PASSIVE]` nearby deaths store demons that give protections.
- **1 Expose Evil** `[LINE-PIERCE,MARK]` 55 u card on all enemies hit: DoT + slow 5 s. CD 12 s.
- **2 Exorcism** `[CONE]` 35 u; on marked enemies removes cards and heals him. CD 10 s.
- **3 Book of Demons** `[SELF-AOE,SWEEP]` book circles him (20 u): stun 1 s (2 s on marked). CD 13 s.
- **U Recall Demons** `[SELF-AOE,HOMING]` 5 s of homing demons that chase enemies (even through walls); knockback/slow immune. CD 90 s.

##### Mulan (Chinese; Warrior, melee)
Source: [Smite 1 wiki API, Mulan](https://smite.fandom.com/wiki/Mulan)
- Smite 1 "Mulan" is Smite 2 "Hua Mulan" (above). The Smite 1 page uses the same passive and ability names (P Training Arc, 1 Cross Strike, 2 Spear Thrust, 3 Grapple, U Divine Mastery), so this is a rename; the numbers were not compared.


### Inferences
- In 1v1 terms, the counterplay in almost every Smite kit comes down to three readable facts: what the shot stops on (first enemy, first god, or nothing), whether walls block it, and whether there is a wind-up or delay. A top-down game can show all three on its targeters (a line that ends at the first blocker, a circle with a fill timer).
- Smite's melee basic attack is itself an aimed cone ("nearest the centre"), not a click on a target, and many ranged basics are skillshot projectiles. That is why Smite players feel that "everything is a skillshot", basic attacks included.
- The heavy use of self-centred circles (SELF-AOE) and leaps reflects the camera: an ability centred on the god needs no aim, which keeps melee gods playable from a third-person view. In a top-down game the same abilities read even more clearly.

### Gaps
- Heimdallr and Maman Brigitte are listed on the Smite 2 Gods page without god pages (404). Their Smite 2 status (upcoming or announced) and their Smite 2 kits could not be confirmed, so the Smite 1 kits are given.
- **Damage numbers and mana costs are absent for most abilities.** The entries from Achilles to Ymir carry some of them, but from the Jormungandr batch onward the fetch prompt asked only for cooldowns. So damage, cost and the full rank-by-rank values are largely missing for the Smite 2 roster; only cooldowns are reasonably complete. The Smite-1-only entries likewise give cooldowns more often than costs.
- **Per-ability counterplay is written out on only about 15 lines.** For every other ability, combine its stop rule ("stops on first god", "passes walls", "delay") and its tags with the general counterplay rules in the header.
- Projectile speeds and wind-up times in seconds are mostly absent from the wiki pages, so "dodgeability" is inferred from the projectile's stop rules and range, not measured.
- The summaries of the Smite 2 god pages were produced by an automated reader over the raw wiki text. A few numbers may be misread (one example spotted: Ishtar's Rolling Thunder range and radius came back swapped, as 2.4 m / 8.8 m; the entry uses 8.8 m length).
- Some Smite 2 passives are not named (Hun Batz, Ishtar, Hou Yi); only their effect was captured. Several aspect names (Osiris, Pele, Poseidon) were not captured either.
- Jormungandr's basic attack is listed as Ranged in Smite 1 (a breath cone) and Melee in Smite 2.

## What changed in Smite 2 for ability targeting and design?

### Takeaway
Aiming in Smite 2 is the same third-person, reticle-and-ground-circle system as Smite 1, now with ranges in metres. The design changes are elsewhere:
- **Aspects:** optional kit variants chosen in the lobby.
- **Scaling:** every god scales on Strength and Intelligence (hybrid), not a single physical or magical power.
- **Items:** active items replace most relics.
- Kits built around recasts, interact-key abilities and god-specific items.

The ability kits of the 92 gods present in both games (counting Mulan/Hua Mulan) mostly keep their Smite 1 ability names (a name check found about 10 renamed or replaced abilities). Movement penalties and CC diminishing returns exist in both games, so they are not Smite 2 changes.

### Cited Findings
- **Aspects.** They are optional alternate versions of a god's kit, toggled in the lobby next to skins and shown on the scoreboard. Each changes one or two parts of the kit with a trade-off. Hi-Rez's design note: "We don't intend Aspects to be a completely different version of a God." Twenty gods had Aspects at Open Beta 1 (7 Jan 2025): Anhur, Athena, Bacchus, Bellona, Cernunnos, Chaac, Cupid, Danzaburou, Fenrir, Geb, Hecate, Hercules, Khepri, Loki, Mordred, Neith, Nemesis, Ra, Thanatos and The Morrigan ([S2 wiki, Open Beta 1](https://wiki.smite2.com/w/SMITE_2_Open_Beta_1)). Aspects are locked until account level 5 ([S2 wiki search, Open Beta 12 snippet](https://wiki.smite2.com/api.php?action=query&list=search&srsearch=%22Aspects%22%20introduced%20god%20aspect%20system&srlimit=15&format=json)).
- **What aspects do to targeting** (from the god pages above):
  - Some change the aiming shape entirely. Geb's Aspect of Calamity turns his melee basics into piercing ranged shots and makes Shock Wave circular. Kali's turns her basics ranged. Cernunnos' Aspect of Strife turns his basics melee.
  - Some swap the CC. Ares' No Escape roots instead of pulling. Artemis' trap stops rooting gods. Bastet's Razor Whip disarms and her claw stuns.
  - Some change who an ability targets. Athena's ult targets an enemy instead of an ally. Aphrodite's Kiss links an enemy. Horus' Surge targets enemies or locations.
  - Sources: [S2 wiki API batches](https://wiki.smite2.com/api.php?action=query&prop=revisions&rvprop=content&rvslots=main&titles=Fenrir|Ganesha|Geb|Gilgamesh&format=json) and the other per-god batch links.
- **Stats.** Smite 2 replaced Physical/Magical power with Strength and Intelligence. Abilities scale from one or both, any god can buy either stat, and penetration is one unified stat. This comes from a search-result summary of [Prima Games, "All SMITE 1 and SMITE 2 differences"](https://primagames.com/gaming/all-smite-1-and-smite-2-differences-explained); a direct fetch of the page was blocked (403). The wiki's god data confirms it: every ability lists "% Strength" and/or "% Intelligence" scaling, and Smite 2 has no class field ([S2 wiki API, Achilles](https://wiki.smite2.com/api.php?action=query&prop=revisions&rvprop=content&rvslots=main&titles=Achilles&format=json)).
- **Relics and items.** Search summaries say players now start with Purification Beads and a ward, and most old relics are sold as active items (for example, a Blinking Amulet carries the old Blink). This is from [Prima Games](https://primagames.com/gaming/all-smite-1-and-smite-2-differences-explained) via search snippet, unconfirmed by fetch.
  - The alpha notes instead describe keeping a small Relic slot for "a few strong effects", moving weaker relics toward active items, and adding a new relic, Sundering Arc (Alpha Weekend 4, 18 Jul 2024) ([S2 wiki, Alpha Weekend 4](https://wiki.smite2.com/w/SMITE_2_Alpha_Weekend_4)).
  - Beads' cooldown was 150 s at Open Beta 1 ([S2 wiki, Open Beta 1](https://wiki.smite2.com/w/SMITE_2_Open_Beta_1)). By Open Beta 25, "Talisman of Purification" builds from Purification Beads, i.e. Beads is part of the item tree ([S2 wiki search snippet](https://wiki.smite2.com/api.php?action=query&list=search&srsearch=aspect%20purification%20beads%20relic&srlimit=20&format=json)).
  - Conflict: whether a separate relic slot still exists in Nov 2026 is not confirmed.
- **God-specific items and shop-modified kits.** These are a Smite 2 pattern: Aladdin's Genie's Lamp, Ratatoskr's Acorn of Yggdrasil (upgraded in the shop, changes his abilities), Vulcan's Master Craftsman (buys ability mods), Hua Mulan's Training Grounds consumable ([S2 wiki API batches](https://wiki.smite2.com/api.php?action=query&prop=revisions&rvprop=content&rvslots=main&titles=Princess_Bari|Ra|Rama|Ratatoskr&format=json); [Vulcan batch](https://wiki.smite2.com/api.php?action=query&prop=revisions&rvprop=content&rvslots=main&titles=Vulcan|Xbalanque|Xing_Tian|Yemoja&format=json)).
- **Interact key as an ability input.** Mordred's Shoulder Charge is a dash on the interact key within 2 s of an ability. Atlas' empowered Astrolabe strike is triggered by interact. Hecate's rituals are interact channels on allies or towers. Hachiman's aspect makes interact a backward dash ([S2 wiki API, Medusa/Mercury/Merlin/Mordred](https://wiki.smite2.com/api.php?action=query&prop=revisions&rvprop=content&rvslots=main&titles=Medusa|Mercury|Merlin|Mordred&format=json); [Athena/Atlas batch](https://wiki.smite2.com/api.php?action=query&prop=revisions&rvprop=content&rvslots=main&titles=Athena|Atlas|Awilix|Bacchus&format=json); [Guan Yu/Hachiman batch](https://wiki.smite2.com/api.php?action=query&prop=revisions&rvprop=content&rvslots=main&titles=Guan_Yu|Hachiman|Hades|Hecate&format=json)).
- **Movement penalties (both games, not new).** Smite 1 notes already mention backpedal and strafe penalties: Chang'e has no backpedal penalty while dancing, Thoth's empowered shots ignore the basic-attack movement penalty, and Vamana's and Bake Kujira's penalties are reduced ([Smite 1 wiki, Chang'e](https://smite.fandom.com/wiki/Chang%27e); [Thoth](https://smite.fandom.com/wiki/Thoth); [Vamana](https://smite.fandom.com/wiki/Vamana)). Smite 2 kits keep building around them:
  - Medusa's passive: no strafe penalty, half the backpedal penalty.
  - Da Ji's and Hun Batz's channels remove strafe and backpedal penalties.
  - Morgan's ult ignores movement penalties.
  - Awilix's mount lowers her strafe speed.
  - Hi-Rez tested an "experimental movement system" in an Open Beta 7 hotfix. What it changed is unconfirmed (snippet only).
  - Sources: [S2 wiki API, Medusa](https://wiki.smite2.com/api.php?action=query&prop=revisions&rvprop=content&rvslots=main&titles=Medusa|Mercury|Merlin|Mordred&format=json); [Da Ji batch](https://wiki.smite2.com/api.php?action=query&prop=revisions&rvprop=content&rvslots=main&titles=Da_Ji|Danzaburou|Discordia|Eset&format=json); [S2 wiki search, Open Beta 7 snippet](https://wiki.smite2.com/api.php?action=query&list=search&srsearch=%22Aspects%22%20introduced%20god%20aspect%20system&srlimit=15&format=json).
- **CC rules (Smite 2's current rule set; Smite 1 also had diminishing returns, since its notes mark some CC as "no DR", e.g. Heimdallr's ult stun, [Smite 1 wiki, Heimdallr](https://smite.fandom.com/wiki/Heimdallr)).** The Smite 2 Crowd Control page splits soft CC (blind, cripple, intoxicate, slow, tremble, vortex) from hard CC (banish, disarm, mesmerize, polymorph, root, silence, stun, taunt, displacement). Cripple blocks dashes, leaps and teleports. Tremble forces movement toward the source. Hard-CC diminishing returns are stack-based (above). Page last edited 1 Jun 2026 ([S2 wiki, Crowd Control](https://wiki.smite2.com/w/Crowd_Control)).
- **Kits carried over, by name.** A script compared the Smite 1 wiki's current passive and ability names with the Smite 2 entries for the 91 shared gods plus Mulan/Hua Mulan ([Smite 1 wiki API](https://smite.fandom.com/api.php)). Almost all names match. The differences:
  - Anubis' passive: Sorrow became The Scales.
  - Ares: passive Blessed Presence became Blessed Armaments; 2 Bolster Defenses became Call to Arms.
  - Bastet's ult: Huntress of Bast became Cat Call (Huntress of Bast is now her aspect ult).
  - Danzaburou's passive: Dubious Savings became Dishonest Duplication.
  - Guan Yu's passive: Painless became Battle Fervor.
  - Hercules' passive: Strength from Pain became Apotheosis.
  - Hun Batz's passive: Infused Strikes moved to his aspect.
  - Ishtar: passive Mark of Vengeance; her three separate shots became Imbue Arrows.
  - Susano's passive: Gathering Storm became Storm's Edge.
  - Zeus' 2: Aegis Assault became Thunderclap.
  - Mulan is a rename to Hua Mulan with the same ability names.
  - Matching names do not mean matching numbers or shapes. For example, the Smite 1 Ah Puch ult is a forward wraith swarm (75 u range), while the Smite 2 one is a 16 m field around him ([Smite 1 wiki, Ah Puch](https://smite.fandom.com/wiki/Ah_Puch)). Sylvanus' ult is a self-centred knock-up in both (35 u in Smite 1, 5.6 m in Smite 2) ([Smite 1 wiki, Sylvanus](https://smite.fandom.com/wiki/Sylvanus)).
- **Patch cadence.** OB47 "The Night Update" (Nox) shipped 3 Nov 2026 and OB48 (Kumbhakarna) 16–17 Nov 2026. OB48 balance lines include Nox's Siphon Darkness activation delay dropping from 0.7 s to 0.4 s, and Izanami's aspect root radius from 1.8 m to 1.4 m: tuning of telegraph times and hitbox sizes ([smite2.live OB48 notes](https://smite2.live/news/open-beta-48-notes)).

### Inferences
- Aspects are a cheap way to double kit variety without new art. For a small roster, one alternate per hero that changes one targeting shape or CC type (as Geb's ranged aspect does) gives most of the value.
- Smite 2's notes increasingly state each ability's behaviour on contact ("passes non-god enemies, stops on walls and gods"). It is a useful template for a spell spec sheet.

### Gaps
- No official Hi-Rez page was fetched for the relic/active-item model as of Nov 2026. The two sources disagree (a relic slot kept vs. relics as items), and it is not settled.
- A search snippet named "Titan Forge Games" as the publisher on the Steam news; smite2.live names Hi-Rez. Not resolved.
- Whether Smite 2 added any aiming aids (for example ground-target snapping) beyond Smite 1's could not be confirmed; no source mentioned one.

## Which mechanics are rare or unique to Smite?

### Takeaway
Smite's unusual mechanics come from three places:
- **No target lock:** every ability, including melee basic attacks, is aimed. Reticle tricks follow from it: aim distance picks the form of an ability, and some abilities check which way the target is facing.
- **Terrain is a mechanic:** walls stun, walls are created, gods walk inside walls, portals go through walls.
- **The god itself changes state:** stances, transformations, flights, untargetable dives, possession.

### Cited Findings

#### Tally of activation and aiming types
Counted by script over the `[TAGS]` on every active ability line in this file (passive lines, aspect lines and basic-attack lines excluded). One ability can carry several tags, so the columns do not sum to the number of abilities. Smite 2 roster: 96 gods, 401 tagged active-ability lines (stance alternates count separately). Smite-1-only set: 38 gods, 156 lines. **The tags were assigned by hand while writing the entries, so read the low-count rows (for example DELAY, 20 vs 2) as indicative only.**

| Type (tags merged) | Smite 2 roster | Smite-1-only gods |
|---|---|---|
| Ground-target circle (GROUND, GROUND-PROJ) | 73 | 29 |
| Self-centred circle (SELF-AOE) | 53 | 14 |
| Dash (DASH) | 48 | 21 |
| Line through enemies/walls (LINE-PIERCE) | 48 | 15 |
| Cone (CONE) | 46 | 20 |
| Projectile that stops on first hit (LINE-PROJ) | 40 | 13 |
| Leap (LEAP) | 37 | 12 |
| Self buff (SELF-BUFF, AURA) | 36 | 13 |
| Channel (CHANNEL) | 34 | 10 |
| Recast / multi-stage (RECAST, MULTI-STAGE) | 38 | 13 |
| Deployable (DEPLOY, incl. walls, traps, turrets) | 22 | 11 |
| Visible delay before effect (DELAY) | 20 | 2 |
| Non-projectile line (LINE) | 17 | 10 |
| Pull / grab (PULL, GRAB) | 19 | 6 |
| Empowered next basic attack (NEXT-ATTACK) | 10 | 4 |
| Global or map-wide (GLOBAL) | 8 | 3 |
| Aimed onto an ally (TARGET-ALLY) | 8 | 1 |
| Stance / toggle / transform | 11 | 7 |
| Charge (hold to power) (CHARGE) | 7 | 6 |
| Teleport / blink | 9 | 5 |
| Stealth | 7 | 2 |
| Summon / pet | 5 | 3 |
| Untargetable state | 5 | 9 |
| Creates a wall (WALL, WALL-RING) | 7 | 2 |
| Bouncing projectile (BOUNCE) | 8 | 1 |

(Each row merges the tags named in it. Global or map-wide includes Terra's team-wide ult (GLOBAL-TEAM).)

#### The most unusual mechanics in Smite (one sentence each)
1. **Third-person, no-lock aiming of everything.** Even melee basic attacks are an aimed 120° cone that hits the enemy nearest its centre, and ranged basics are dodgeable projectiles stopped by the first unit or wall ([S2 wiki API batch](https://wiki.smite2.com/api.php?action=query&prop=revisions&rvprop=content&rvslots=main&titles=Athena|Atlas|Awilix|Bacchus&format=json)).
2. **Wall-stun displacement.** Anhur's Impale and Gilgamesh's Drop Kick push a god and stun only if it hits a wall, so terrain decides whether there is a stun ([Amaterasu–Aphrodite batch](https://wiki.smite2.com/api.php?action=query&prop=revisions&rvprop=content&rvslots=main&titles=Amaterasu|Anhur|Anubis|Aphrodite&format=json); [Fenrir–Gilgamesh batch](https://wiki.smite2.com/api.php?action=query&prop=revisions&rvprop=content&rvslots=main&titles=Fenrir|Ganesha|Geb|Gilgamesh&format=json)).
3. **Player-made walls that block everyone.** Ymir's Ice Wall (which can also vault Ymir himself), Thor's Tectonic Rift fissure, Cabrakan's Tectonic Shift, Terra's stone walls and Maui's Landfall island reshape the arena for a few seconds ([Ymir](https://wiki.smite2.com/api.php?action=query&prop=revisions&rvprop=content&rvslots=main&titles=Ymir&format=json); [Thor batch](https://wiki.smite2.com/api.php?action=query&prop=revisions&rvprop=content&rvslots=main&titles=The_Morrigan|Thor|Tsukuyomi|Ullr&format=json)).
4. **Cages.** Odin's Ring of Spears and Yemoja's River's Rebuke trap gods inside walls that must be broken or waited out (Yemoja's also blocks projectiles) ([Odin batch](https://wiki.smite2.com/api.php?action=query&prop=revisions&rvprop=content&rvslots=main&titles=Odin|Osiris|Pele|Poseidon&format=json); [Yemoja batch](https://wiki.smite2.com/api.php?action=query&prop=revisions&rvprop=content&rvslots=main&titles=Vulcan|Xbalanque|Xing_Tian|Yemoja&format=json)).
5. **Private duel dimension.** Aladdin's Into the Lamp sucks one enemy god and Aladdin into a 16 s lamp duel with an escape that opens at 8 s ([Aladdin](https://wiki.smite2.com/api.php?action=query&prop=revisions&rvprop=content&rvslots=main&titles=Achilles|Agni|Ah_Puch|Aladdin&format=json)).
6. **Walking inside walls.** Cliodhna's passive lets her enter map walls and move and cast inside them; Chernobog hides in a wall he dashes into ([Smite 1 wiki, Cliodhna](https://smite.fandom.com/wiki/Cliodhna); [Chernobog](https://smite.fandom.com/wiki/Chernobog)).
7. **Portals through walls.** Janus' Portal placed on a wall makes a passage through it, and his global ult opens wall portals for allies ([Janus batch](https://wiki.smite2.com/api.php?action=query&prop=revisions&rvprop=content&rvslots=main&titles=Ix_Chel|Izanami|Janus|Jing_Wei&format=json)).
8. **Stances that swap the whole kit.** Hel (Dark/Light), Merlin (Arcane/Fire/Ice), Artio (Druid/Bear), Ullr (bow/axes), Cu Chulainn (Human/Berserk) and Tyr; King Arthur alternates every ability between two versions on each cast ([Hel batch](https://wiki.smite2.com/api.php?action=query&prop=revisions&rvprop=content&rvslots=main&titles=Heimdallr|Hel|Hercules|Horus&format=json); [Smite 1 wiki, King Arthur](https://smite.fandom.com/wiki/King_Arthur)).
9. **Aim distance chooses the ability's form.** Sun Wukong's 72 Transformations is Ox up close, Tiger at mid range and Eagle far; Erlang Shen's version is Turtle under 40 u and Mink beyond ([Sun Wukong batch](https://wiki.smite2.com/api.php?action=query&prop=revisions&rvprop=content&rvslots=main&titles=Sun_Wukong|Susano|Sylvanus|Thanatos&format=json); [Smite 1 wiki, Erlang Shen](https://smite.fandom.com/wiki/Erlang_Shen)).
10. **Facing checks.** Medusa's Petrify stuns 2 s only if the victim faces her; Ra's Divine Light blinds those facing him; Cthulhu's Torment builds faster on enemies looking at him ([Medusa batch](https://wiki.smite2.com/api.php?action=query&prop=revisions&rvprop=content&rvslots=main&titles=Medusa|Mercury|Merlin|Mordred&format=json); [Ra batch](https://wiki.smite2.com/api.php?action=query&prop=revisions&rvprop=content&rvslots=main&titles=Princess_Bari|Ra|Rama|Ratatoskr&format=json); [Smite 1 wiki, Cthulhu](https://smite.fandom.com/wiki/Cthulhu)).
11. **Untargetable ultimates that fly the god around the map.** Apollo's chariot (carrying 2 allies), Thor's Anvil of Dawn (32 m), Rama's Astral Barrage, Sun Wukong's cloud, Surtr's meteor and Thanatos' Hovering Death let the god choose where to land ([Apollo batch](https://wiki.smite2.com/api.php?action=query&prop=revisions&rvprop=content&rvslots=main&titles=Apollo|Ares|Artemis|Artio&format=json)).
12. **Team teleports.** Horus' To The Skies! brings nearby allies 1 s after him; Athena teleports to any ally on the map; Maui's Ulua bubbles an ally to him ([Horus batch](https://wiki.smite2.com/api.php?action=query&prop=revisions&rvprop=content&rvslots=main&titles=Heimdallr|Hel|Hercules|Horus&format=json); [Smite 1 wiki, Maui](https://smite.fandom.com/wiki/Maui)).
13. **Enemy-swapping portals.** Hecate's Open the Gates stuns gods in one portal and teleports them to the other unless they cleanse ([Hecate batch](https://wiki.smite2.com/api.php?action=query&prop=revisions&rvprop=content&rvslots=main&titles=Guan_Yu|Hachiman|Hades|Hecate&format=json)).
14. **Become another god.** The Morrigan's Changeling copies any god in the match, with its abilities and items, for 10 s ([Morrigan batch](https://wiki.smite2.com/api.php?action=query&prop=revisions&rvprop=content&rvslots=main&titles=The_Morrigan|Thor|Tsukuyomi|Ullr&format=json)).
15. **Rewind.** Chronos' ult returns him to his position, health and mana of 8 s earlier and resets his cooldowns ([Chronos batch](https://wiki.smite2.com/api.php?action=query&prop=revisions&rvprop=content&rvslots=main&titles=Chiron|Chronos|Cu_Chulainn|Cupid&format=json)).
16. **Cheat-death kits.** Kali's Destruction makes her unkillable for 4.5 s, Kumbhakarna falls asleep instead of dying, and Khepri's blessing revives an ally at his feet ([Kumbhakarna batch](https://wiki.smite2.com/api.php?action=query&prop=revisions&rvprop=content&rvslots=main&titles=Kumbhakarna|Kuzenbo|Loki|Maman_Brigitte&format=json); [Kali/Khepri batch](https://wiki.smite2.com/api.php?action=query&prop=revisions&rvprop=content&rvslots=main&titles=Jormungandr|Kali|Khepri|Kukulkan&format=json)).
17. **Madness.** Discordia's Strife and Serqet's Cobra's Kiss make enemies attack their own allies ([Discordia batch](https://wiki.smite2.com/api.php?action=query&prop=revisions&rvprop=content&rvslots=main&titles=Da_Ji|Danzaburou|Discordia|Eset&format=json); [Smite 1 wiki, Serqet](https://smite.fandom.com/wiki/Serqet)).
18. **Intoxicate and tremble as CC.** Bacchus' Intoxicate scrambles movement controls; tremble pulls a god's movement toward the source ([S2 wiki, Crowd Control](https://wiki.smite2.com/w/Crowd_Control)).
19. **Time dilation.** Olorun's Sanctified Field and Bake Kujira's Lament make enemies do everything (move, attack, animate) up to 40% slower ([Smite 1 wiki, Olorun](https://smite.fandom.com/wiki/Olorun); [Bake Kujira](https://smite.fandom.com/wiki/Bake_Kujira)).
20. **Steered projectiles and areas.** Danzaburou steers his rocket (or rides it), Sol's Supernova follows her moving cursor, and Ah Muzen Cab moves his honey patch after casting ([Danzaburou batch](https://wiki.smite2.com/api.php?action=query&prop=revisions&rvprop=content&rvslots=main&titles=Da_Ji|Danzaburou|Discordia|Eset&format=json); [Sol batch](https://wiki.smite2.com/api.php?action=query&prop=revisions&rvprop=content&rvslots=main&titles=Ravana|Scylla|Sobek|Sol&format=json)).
21. **Map-wide skillshots that can be body-blocked.** Neith's World Weaver (charged 0.5–2 s, passes walls, stops on the first god), Janus' ult, Charon's Styx and Persephone's vines reward aiming across the whole map ([Neith batch](https://wiki.smite2.com/api.php?action=query&prop=revisions&rvprop=content&rvslots=main&titles=Morgan_Le_Fay|Ne_Zha|Neith|Nemesis&format=json)).
22. **Grabs and carries.** Fenrir's Ragnarok picks up and carries a god, Khepri drags one behind him, Sobek throws one behind him, and Mercury spins and throws ([Fenrir batch](https://wiki.smite2.com/api.php?action=query&prop=revisions&rvprop=content&rvslots=main&titles=Fenrir|Ganesha|Geb|Gilgamesh&format=json)).
23. **Possession and riding.** Maman Brigitte possesses an enemy and travels inside them; Nox rides inside an ally's shadow; Charon ferries allies ([Smite 1 wiki, Maman Brigitte](https://smite.fandom.com/wiki/Maman_Brigitte); [Nox batch](https://wiki.smite2.com/api.php?action=query&prop=revisions&rvprop=content&rvslots=main&titles=Nike|Nox|Nu_Wa|Nut&format=json)).
24. **Abilities with no cooldown, limited by a resource.** Yemoja's Omi makes her non-ultimate abilities cooldown-free, and Pele's Magma Rush and Rama's Astral Strike run on fuel or arrows ([Yemoja batch](https://wiki.smite2.com/api.php?action=query&prop=revisions&rvprop=content&rvslots=main&titles=Vulcan|Xbalanque|Xing_Tian|Yemoja&format=json)).
25. **Retrievable projectiles.** Ah Muzen Cab picks up his Stinger for -60% CD, Tsukuyomi retrieves his shuriken, Ne Zha catches his ring, Rama collects dropped arrows, and Thor's hammer returns (and can be teleported to) ([Tsukuyomi batch](https://wiki.smite2.com/api.php?action=query&prop=revisions&rvprop=content&rvslots=main&titles=The_Morrigan|Thor|Tsukuyomi|Ullr&format=json)).
26. **Wall-bounce projectiles.** Hou Yi's Ricochet gains 40% damage per wall bounce, Camazotz's echo bounces off walls, and Danzaburou's money bags and Kuzenbo's kappa bounce ([Hou Yi batch](https://wiki.smite2.com/api.php?action=query&prop=revisions&rvprop=content&rvslots=main&titles=Hou_Yi|Hua_Mulan|Hun_Batz|Ishtar&format=json)).
27. **Projectile amplifiers.** Thoth's Glyph of Pain gives his projectiles that pass through it +30 u range and damage, and allies' basics gain damage too ([Smite 1 wiki, Thoth](https://smite.fandom.com/wiki/Thoth)).
28. **Detonate-your-own-zone combos.** Agni's fumes explode when any of his other abilities touches them, Chernobog shoots his own crystal to detonate it early, and Martichoras shoots his barb ([Agni](https://wiki.smite2.com/api.php?action=query&prop=revisions&rvprop=content&rvslots=main&titles=Achilles|Agni|Ah_Puch|Aladdin&format=json)).
29. **Sweet-spot circles.** Erlang Shen's Pin roots only in its 8 u centre, Nut's Comet roots in the centre and only trembles at the edge, and Poseidon's Kraken stuns only the inner ring ([Nut batch](https://wiki.smite2.com/api.php?action=query&prop=revisions&rvprop=content&rvslots=main&titles=Nike|Nox|Nu_Wa|Nut&format=json)).
30. **Enemy ability casts as a resource.** Hecate's Spell Eater charges whenever any god casts within 20 m, then fires anywhere on the map ([Hecate batch](https://wiki.smite2.com/api.php?action=query&prop=revisions&rvprop=content&rvslots=main&titles=Guan_Yu|Hachiman|Hades|Hecate&format=json)).
31. **Random kits.** Baba Yaga's Wild Witchcraft flies in a random shape with a random field (previewed on her passive meter), and Chronos' Accelerate spins a wheel for its bonus ([Smite 1 wiki, Baba Yaga](https://smite.fandom.com/wiki/Baba_Yaga)).
32. **Basic attacks as a breath cone with overheat.** Jormungandr's basic hits everything in a 45° 5.6 m cone and slows its fire rate as it overheats ([Jormungandr batch](https://wiki.smite2.com/api.php?action=query&prop=revisions&rvprop=content&rvslots=main&titles=Jormungandr|Kali|Khepri|Kukulkan&format=json)).

#### What Smite's targeting model means for counterplay and skill expression
- **No lock-on means every hit is earned and every miss is possible.** In League and Dota, point-and-click stuns (on a selected unit) are guaranteed once cast. In Smite, even the "targeted" ultimates aim at a small area (Ao Kuang, Serqet, Nemesis, Loki's teleport). The defender's main tool is movement: strafing, juking and baiting. Smite 2's strafe and backpedal speed penalties make sideways dodging a real cost, which keeps skillshots landable ([Medusa batch](https://wiki.smite2.com/api.php?action=query&prop=revisions&rvprop=content&rvslots=main&titles=Medusa|Mercury|Merlin|Mordred&format=json)).
- **Blocking is a team skill.** Stop rules such as "passes minions, stops on the first god", or "stops on the first enemy", make body-blocking and minion cover deliberate counterplay. Supports can stand in front of a carry to eat Anubis' Mummify or Neith's global arrow.
- **Ground circles trade speed for certainty.** Ground-target abilities, the largest category, cannot be blocked. Their counterplay is to read the delay (Charon's Damnation, Chiron's 1 s explosion, Nut's 1 s black hole, Hecate's 1.5 s portals). Tuning in Smite 2's notes therefore targets wind-up times and radii (OB48: Nox's delay cut from 0.7 to 0.4 s) ([smite2.live OB48](https://smite2.live/news/open-beta-48-notes)).
- **Hard CC is answered by one shared, timed defensive.** Beads, or immunity on the god's own ult. Skill expression is holding CC until that is spent and baiting it out, which is why many ultimates grant "CC immune while active".
- **Self-centred and leap abilities are the melee answer to aiming.** They remove aiming error. Their counterplay is spacing, plus cripple, the CC that stops leaps and dashes.
- **For a top-down 1v1 game (inference).** The model carries over cleanly. Show each targeter's stop rule (where it ends on the first blocker) and its delay, and give each hero one cleanse/immunity window. Without minions or allies to body-block, "stops on first god" and "passes minions" shots mostly become plain skillshots, so delay and width are the main tuning knobs.

### Inferences
- About a third of Smite's oddest mechanics depend on terrain (walls, portals, wall-stun, bounces). A browser arena with a few pillars or walls would unlock them; an empty arena would not.
- Mechanics that check facing or steer after the cast depend on reading a third-person body. From top-down they need a clear facing indicator (a cone or arrow on the hero) to be fair.

### Gaps
- No source compares Smite's ability-type distribution with League's or Dota's numerically. The "League and Dota do it differently" statements are general knowledge, not cited.
- Projectile speeds (needed to judge how dodgeable each shot is) were not collected for most Smite 2 abilities.
