---
title: Kits v4, every hero designed fresh
tags: [design, heroes, kits, passives]
updated: 2026-11-03
status: design only, waiting on the user
---

# Kits v4: a fresh kit for every hero (2026-11-03)

The user asked for this design: "forget what you know about it and make new idea for every kit fresh". They want:
- more point-and-click (targeted) spells;
- dashes, pulls and buffs;
- passives that fit the new kits;
- "think deeply about it".

The spells below are new. Three ideas are kept on purpose and marked "kept", because they are the theme itself:
- Mortis raising skeletons;
- Ada building turrets;
- Isolde's frost skillshot. Its recast is new.

A few more echo the older kits; swap any you dislike:
- Vesper's Lancet (a targeted drain);
- Fenna's Strangle Vine (a targeted vine root);
- Oblivion's Null Zone (a silence aura);
- Kaia's Sky Strike (a targeted bolt);
- Isolde's Rime Armour (armour round her);
- Opaline's Ricochet Light is the bank shot designed in v3 but never built.

What stays is each hero's name, look, theme and role, because the models and the effect art are built around them. The
numbers are first guesses; AI duels tune them, as in every batch so far.

## The rules every kit follows

1. **One verb per hero.**
   - Each hero has one thing they do that no one else does: spend their own blood, plant lightning rods, turn the tide.
   - The passive is the rule that ties the four spells together. Every spell feeds the verb, spends it or finishes it,
     so a passive is never a flat stat bonus.
2. **Variety in every column, not only across heroes.**
   - No key is the same shape down the roster.
   - Fewer than half the E keys are dashes.
   - One decoy in the game (Nyx).
   - One cooldown-theft ultimate (Tempo).
   - Two transforms (Brannoc, Ada).
   - Every ultimate a different shape.
3. **Targeted spells pay for being sure-hit**, with one of the following:
   - a short range (5–8 m);
   - a delay;
   - a set-up role (the damage comes after);
   - a condition.

   **Every targeted spell needs line of sight**, so the arenas' pillars and walls are the answer to them.
4. **Counterplay varies:**
   - dodge a skillshot;
   - break line of sight;
   - stop casting while cursed;
   - trample or kill what the hero placed;
   - stand away from walls;
   - interrupt a channel;
   - outlast a stance;
   - read the tide or the beat.
5. **It is a 1v1.** There are no allies, so a "support" protects and buffs herself or her summons, and a pull or a cage is
   worth more than a heal.
6. **Phone:**
   - a targeted spell is the easiest input on touch: tap the enemy;
   - holds and arcs already have touch designs;
   - Cantor's beat is the one timing input, so its window is wide.
7. **Every new rule gets a duel-AI rule.** Where a mechanic is hard for the AI (the beat, the tide), the AI gets a simple
   policy that still uses it.

Type key:
- **TGT**: click an enemy, a sure hit that needs line of sight.
- **SHOT**: a line skillshot.
- **HOOK**, **DASH**, **BLINK**, **LEAP**, **PULL**.
- **ZONE**: an area on the ground; **TRAP**.
- **SELF**: a buff or stance on yourself.
- **SUMMON**, **TERRAIN** (it blocks walking), **CHANNEL**, **RECAST**, **HOLD**, **TRANSFORM**.

## The roster

### Vesper, the Crimson Countess (drain juggernaut, ranged attack)
She pays for everything in her own blood and takes it back from the enemy with interest.
- **Passive: Blood Price.**
  - Her spells cost 4% of her current HP.
  - Every hit she lands heals her for 15% of its damage, rising to 40% while she is under 40% HP.
  - Spending HP makes her hungrier, and a hungrier Vesper drinks more.

| Key | Spell | Type | What it does | Counterplay |
|---|---|---|---|---|
| Q | Lancet | TGT, RECAST | A blood needle that cannot miss (7 m): 35, and the enemy is Bled for 4 s. Recast within 4 s: she rips it out for 30 more and regains the HP both casts cost her. | Stay outside 7 m, or break line of sight. |
| W | Mist Waltz | DASH, SELF | She becomes mist for 0.35 s (untouchable) and reforms 5 m away. Her next two basic attacks within 3 s reach 2.5 m farther and drain 25 each. | Do not trade blows right after the waltz. |
| E | Hemocurse | TGT | A blood curse (7 m) for 4 s. Every spell the enemy casts meanwhile costs them 8% of their current HP, and Vesper drinks it. | Do not cast for 4 s, or break line of sight before she curses you. |
| R | Sanguine Feast | TGT, CHANNEL, PULL | For 1.6 s she draws the enemy's blood (8 m): three pulses of 30, the last adding 20% of their missing HP. Each pulse drags them 1 m closer; she heals for all of it and is rooted while she channels. | Stun, knock up or silence her, or step behind a pillar: the channel needs sight. |

### Brannoc, the Ashen Smith (tank, melee)
He heats the enemy like iron, then tempers them with one finishing blow.
- **Passive: Hot Iron.**
  - His hits add Heat to the enemy (max 3, lasts 5 s).
  - His next spell on a 3-Heat enemy is Tempered and gets its bonus (below). Tempering clears the Heat.

| Key | Spell | Type | What it does | Counterplay |
|---|---|---|---|---|
| Q | Chain Hammer | HOOK, PULL | A hammer on a chain (9 m): the first enemy hit is dragged 4 m to him, takes 35 and is 30% slower for 1 s. Tempered: also stunned 0.75 s. | Sidestep it, or stand behind a pillar. |
| W | Forge Roar | SELF | For 3 s: +25% speed and +25% armour. His next basic attack in that time is a slam: +30, a 0.5 s knock-up, 2 Heat. Tempered: a 0.8 s knock-up. | Kite him for 3 s. |
| E | Red-Hot Rivet | TGT | He flicks a glowing rivet into the enemy (6 m): 30, then 20 burn over 2 s, and 2 Heat. Tempered: the enemy takes 20% more from him for 3 s. | Keep out of 6 m, or break line of sight. |
| R | Molten Core | TRANSFORM | For 6 s his chest cracks open: <br>• immune to slows, roots and knock-ups; <br>• 25% bigger; <br>• every basic attack sprays a 3 m slag cone (+20, +1 Heat). | He is no faster: walk away. Stuns and silences still work. |

### Isolde, the Winter Warden (controller, ranged attack)
Cold builds up until the enemy freezes.
- **Passive: Deep Winter.**
  - Her hits add Chill (max 5, lasts 4 s; each stack is 6% slower).
  - At 5 the enemy freezes solid: stunned 1 s, the Chill clears, and the next hit on them deals +30%.

| Key | Spell | Type | What it does | Counterplay |
|---|---|---|---|---|
| Q | Icicle (kept: her frost skillshot) | SHOT, RECAST | A piercing icicle (11 m): 40 and 2 Chill. At the end of its flight it sticks in the ground for 2 s; recast to shatter it: 25 and 1 Chill within 2 m. | Dodge it, and keep away from where it stuck. |
| W | Frostbite | TGT | Frost bites into the enemy (8 m): 30 and 3 Chill at once. | Keep out of 8 m, or break line of sight. |
| E | Rime Armour | SELF | For 3 s: +40% armour. Every basic attack that hits her gives the attacker 2 Chill. | Stop attacking her for 3 s. |
| R | Winter's Shatter | TGT | She closes her fist (9 m) and the enemy's Chill shatters: 40 + 30 per stack, stunned 0.25 s per stack (1.25 s at 5). A frozen enemy, whose stacks have just cleared, counts as 5 while the freeze lasts. | Keep your Chill low: dodge the icicle, keep out of Frostbite range. |

### Lyra, the Star Archer (marksman, ranged attack)
The farther she is, the deadlier.
- **Passive: Far Sight.** Her damage rises with distance, from +0% within 4 m to +30% at 10 m or more.

| Key | Spell | Type | What it does | Counterplay |
|---|---|---|---|---|
| Q | Starfall Arrow | HOLD, SHOT | Hold to draw for up to 1 s: the range grows from 9 to 14 m and the damage from 35 to 70. At full draw it pierces. | Sidestep it, or close in, which also weakens her passive. |
| W | Twin Stars | SELF | For 4 s her basic attacks loose two arrows (the second at 50%), and she is 20% faster. | Break line of sight for 4 s. |
| E | Pinning Arrow | SHOT | An arrow (9 m): 30. If the enemy is within 1.5 m of a wall or pillar when it hits, they are pinned (rooted 1.5 s); otherwise they are 40% slower for 1.5 s. | Fight away from walls. |
| R | Meteor Mark | TGT, delayed | A star locks onto the enemy (14 m) and follows them for 1.5 s. Then it fixes on their spot, and 0.5 s later a meteor strikes there (2.2 m): 120, plus 25% of what she dealt them meanwhile. | Move in the last half-second; the spot is shown. |

### Vex, the Plague Alchemist (mage, ranged attack)
She mixes reagents on the enemy, and two different ones react.
- **Passive: Reaction.**
  - Each spell leaves its reagent on the enemy for 4 s: green toxin (Q), orange fire (W), violet acid (E).
  - A second, different reagent sets off a reaction and clears both:
    - green + orange: Combust, 45 at once;
    - green + violet: Corrode, the enemy takes 20% more for 3 s;
    - orange + violet: Concussion, a 3 m knock-back and a 0.5 s silence.

| Key | Spell | Type | What it does | Counterplay |
|---|---|---|---|---|
| Q | Toxin Dart | SHOT | A fast dart (9 m): 25, then 25 over 3 s. Green. | Dodge it. |
| W | Fire Vial | TGT | A tossed vial that always hits (7 m): 25, then 25 over 2 s. Orange. | Keep out of 7 m, or break line of sight. |
| E | Acid Splash | cone | A 4 m cone of acid in front of her: 30 and a 1.5 m knock-back. Violet. Her answer to being rushed. | Do not rush her head-on. |
| R | Homunculus | SUMMON | She pours her reagents into a homunculus (120 HP) that waddles at the enemy (4 m/s, up to 6 s) and bursts on contact (2 m): 50 and all three reagents, so every reaction goes off at once. | Kill it before it reaches you, or outrun it. |

### Kaia, the Tempest Caller (mage, ranged attack)
She plants lightning rods, and her lightning arcs through every one of them.
- **Passive: Lightning Rods.**
  - Her spells plant rods where they land (max 3, 5 s each).
  - Whenever she damages the enemy with a spell, every rod within 6 m of them arcs to them for 12 more.

| Key | Spell | Type | What it does | Counterplay |
|---|---|---|---|---|
| Q | Sky Strike | TGT | A strike that cannot miss (7 m): 35. It leaves a rod at the enemy's feet. | Keep out of 7 m, or break line of sight. |
| W | Thunder Rod | ZONE | A great rod driven into a spot (9 m). For 3 s it shocks the enemy within 3.5 m each second: 15 and 20% slower. | Stay out of its circle. |
| E | Polarity | TGT, PULL | She magnetises the enemy (8 m). After 1 s they are yanked 3 m toward her nearest rod; if they reach it, they are stunned 0.6 s. | Keep rods away from you, or break line of sight. |
| R | Supercell | SELF, ZONE | A storm over her for 6 s. Every 0.8 s lightning strikes the enemy (22, up to 7 strikes) if they are within 6 m of her or 3 m of a rod; the rods arc too. | Get far from her and her rods. |

### Sefu, the Dune Sovereign (controller, ranged attack)
A pharaoh's judgement: he hooks the enemy in, seals them away, and the judged cannot flee.
- **Passive: Pharaoh's Decree.**
  - An enemy he roots, pulls or stuns is Judged for 3 s.
  - A Judged enemy takes 20% more from him and cannot dash, blink or leap.

| Key | Spell | Type | What it does | Counterplay |
|---|---|---|---|---|
| Q | Cobra Spit | SHOT | Venom from the cobra on his brow (9 m): 35, and they are blinded 1.2 s (their basic attacks miss). | Dodge it. |
| W | Shepherd's Crook | TGT, PULL | He hooks the enemy's neck with his crook (6 m) and pulls them 3 m to him: 30 and 30% slower for 1 s. Judged. | Stay beyond 6 m. |
| E | Scarab Stride | DASH | He bursts into a stream of golden scarabs and skitters 6 m along the ground, untouchable for 0.5 s. Running through the enemy bites them: 25, then 30 poison over 2 s. | Do not stand in his path. |
| R | Sarcophagus | TGT | He seals the enemy in a golden sarcophagus (7 m) for 1.2 s: stunned and untouchable, while he sets up. When it opens, scarabs burst out: 70 and rooted 0.8 s. Judged. | Nothing while it is shut. Expect the root and his crook after. |

### Nyx, the Umbral Stalker (assassin, melee)
You do not see her until she strikes, and she strikes from behind.
- **Passive: Umbral Veil.**
  - After 2.5 s without dealing or taking damage she fades.
  - Faded, she is invisible to the enemy beyond 3 m and cannot be targeted by targeted spells.
  - Her first hit out of the veil deals +50% and silences 0.6 s.

| Key | Spell | Type | What it does | Counterplay |
|---|---|---|---|---|
| Q | Backstab | TGT (melee) | A dagger strike (2 m): 35, doubled if she strikes from behind the enemy (their back 120°). | Keep turning to face her. |
| W | Smoke Veil | ZONE | A 3 m smoke cloud for 3 s. Inside it she is veiled even mid-fight, and the enemy inside is blinded. | Leave the smoke, or hit it with an area spell. |
| E | Shadow Double | DASH, decoy | She darts 4 m and leaves a shadow copy where she stood (2 s). The copy strikes once for half damage, and the AI may chase it. The only decoy in the game. | The copy has no shadow ring; track the real one. |
| R | Nightfall | SELF (global) | The arena darkens for 5 s: she is invisible at any range, 25% faster, and every hit she lands deals +35%. | Area spells. Back to a wall, so she can only come from one side. |

### Fenna, the Grove Warden (support, ranged attack)
She grows a garden mid-fight, and it is hers to stand in.
- **Passive: Living Garden.**
  - Her spells plant a flower where they land (max 4, 8 s each).
  - Within 3 m of a flower she heals 8 HP a second per flower (up to 3 flowers count).
  - An enemy within 1.5 m of a flower is 20% slower.
  - The enemy tramples a flower by standing on it for 1 s.

| Key | Spell | Type | What it does | Counterplay |
|---|---|---|---|---|
| Q | Seed Shot | SHOT | A seed (9 m): 35, and a flower grows where it stops. | Dodge it; trample the flower. |
| W | Strangle Vine | TGT | Vines root the enemy (7 m) for 1.2 s, or 1.8 s if they stand within 3 m of a flower: 30. | Keep out of 7 m; fight away from her flowers. |
| E | Pollen Glide | DASH | She glides 6 m on a pollen gust and heals 40. It leaves nothing behind. | Chase her once she lands. |
| R | World Tree | TERRAIN | A great tree bursts up at a spot (9 m) for 8 s and blocks walking and bolts. <br>• Sprouting roots the enemy within 4 m for 1 s. <br>• The tree counts as a flower that heals 25 a second within 5 m. <br>• Her flowers within 6 m of it heal twice as much. | Fight her away from the tree. |

### Auriel, the Dawn Paladin (support, ranged attack)
Her shields are a threat: break one and it burns you.
- **Passive: Oath of Dawn.** When one of her shields breaks or runs out, it bursts in light (3 m) for 60% of the
  shield's size.

| Key | Spell | Type | What it does | Counterplay |
|---|---|---|---|---|
| Q | Dawnbreak | cone | A wave of morning light in a 6 m cone: 40. Hitting the enemy gives her a 30 shield for 3 s. | Stay out of the cone. |
| W | Bastion | SELF | A 70 shield for 3 s. While it holds, her basic attacks are sunrays that reach 3 m farther and pierce. | Break it fast (and eat the burst) or wait it out. |
| E | Sunmark | TGT, delayed | A beam of dawn falls on the enemy (7 m) after 0.5 s: 45, and they are Sunmarked for 4 s. Her next Dawnbreak on a Sunmarked enemy stuns 1 s. | Leave the cone range while marked. |
| R | Ascendant | SELF | For 5 s she floats off the ground: every hit on her is halved, and half of what she takes is thrown back at the attacker as light. | Stop hitting her for 5 s; crowd control still works. |

### Marin, the Tide Dancer (controller, ranged attack)
Her water pushes at high tide and pulls at low tide.
- **Passive: Riptide.**
  - The tide turns every 8 s, shown on her spell bar and as a ring at her feet.
  - At High tide her spells push the enemy away; at Low tide they pull the enemy toward her.

| Key | Spell | Type | What it does | Counterplay |
|---|---|---|---|---|
| Q | Wave Disc | SHOT | A spinning disc of water (9 m): 40. At High tide a 2.5 m knock-back; at Low tide a 2.5 m pull. | Dodge it, and read the tide. |
| W | Coral Spire | TERRAIN | A coral pillar rises at a spot (8 m) for 5 s, a new obstacle. As it rises, at High tide it shoves the enemy within 2.5 m 3 m away; at Low tide it drags them 2 m to it. | Keep away from where it rises. |
| E | Mist Form | SELF | She turns to water for 1 s: untouchable, 40% faster, and able to pass through the enemy. | Wait for her to reform. |
| R | Moon's Pull | SELF (global) | For 4 s the tide is held at Low and doubled. The enemy is dragged toward her from anywhere in the arena (1.2 m/s), and her pulls are twice as strong. | Walk against the pull; stun her. |

### Zephyr, the Wind Blade (assassin, melee)
Every dash feeds the next strike, a fighter who never stops moving.
- **Passive: Tailwind.**
  - Every dash gives him a Gust (max 3, lasts 4 s).
  - His basic attacks spend a Gust for +25 damage and 1 m more reach.
  - A dash also resets his basic attack.

| Key | Spell | Type | What it does | Counterplay |
|---|---|---|---|---|
| Q | Crosswind | cone, RECAST | A 3 m cross-cut of wind: 40. Recast within 2 s: a 3 m dash-slash (25). | Keep out of 3 m; bait the recast. |
| W | Skyward | LEAP | He leaps into the air (untouchable 0.8 s) and comes down on a spot within 5 m: 30 within 2 m and a 0.5 s knock-up. | Move off the landing spot. |
| E | Feather Step | DASH | A 4 m step in any direction, 2 charges. Untouchable for 0.2 s, enough to slip a bolt. | Make him spend both, then punish. |
| R | Sky Rend | TGT | He vanishes into the wind and strikes the enemy (7 m) six times in 1.2 s, from all sides: 15 each, doubled on an airborne enemy. He is untouchable throughout and ends behind them. | Nothing during it; save your stun for when he lands. |

### Mortis, the Ossuary Lord (summoner, ranged attack)
Every death in the arena is his to use.
- **Passive: Ossuary.**
  - Every unit that dies, his or the enemy's, leaves a bone pile for 8 s, which his spells use.
  - Every fifth basic attack raises a small skeleton.

| Key | Spell | Type | What it does | Counterplay |
|---|---|---|---|---|
| Q | Bone Fan | SHOT (fan) | Three bone shards in a fan (8 m): 25 each, plus one shard per bone pile within 3 m of him (max 6). | Stand between the shards; fight away from his piles. |
| W | Raise Dead (kept: the summoner's core) | SUMMON | A skeleton claws out at a spot (9 m), plus one more for every bone pile within 4 m of it (max 3). | Kill skeletons away from piles. |
| E | Bone Armour | SELF | A shield of 30, plus 30 per living skeleton (max 120), for 4 s. When it breaks, its shards fly at the enemy (homing, 30). | Kill his skeletons first. |
| R | Grave Grasp | TGT, PULL | A giant skeletal hand bursts out under the enemy (9 m) and drags them 4 m to Mortis in 0.8 s. It holds them (rooted 1 s) while two skeletons climb out beside them. | Break line of sight; keep out of 9 m. |

### Ada, the Artificer (engineer, ranged attack)
She builds a battle station, and the station fights with her.
- **Passive: Overclock.**
  - Her turrets within 5 m of her shoot 30% faster.
  - Every third spell she casts overclocks them: their next shot is a heavy bolt (double damage).

| Key | Spell | Type | What it does | Counterplay |
|---|---|---|---|---|
| Q | Homing Drone | TGT | A small drone flies to the enemy (8 m) and always hits: 30. It tags them for 3 s, and her turrets deal 30% more to a tagged enemy. | Keep out of 8 m, or break line of sight. |
| W | Deploy Turret (kept: the engineer's core) | SUMMON | A turret at a spot (8 m) for 8 s. 2 charges. | Kill the turrets, or fight away from them. |
| E | Grapple | HOOK | A grappling hook (9 m). If it catches a wall, pillar or her turret, she reels herself to it (a dash). If it catches the enemy, it reels them 3 m to her (a pull). | Sidestep it. |
| R | Clockwork Mech | TRANSFORM | For 7 s she pilots a walking mech: <br>• a 200 shield; <br>• her basic attacks become rocket punches (4 m reach, 40, a 1 m knock-back); <br>• her Q becomes a 5 m flamethrower cone (3 × 12). | Break the shield; the mech is 10% slower, so kite it. |

### Sirix, the Swarm Warden (bruiser, melee)
He carries a swarm and spends it.
- **Passive: The Swarm.**
  - Up to 6 wasps circle him.
  - He gains one every 2 s and one per basic attack hit, and his spells spend them.

| Key | Spell | Type | What it does | Counterplay |
|---|---|---|---|---|
| Q | Barbed Stinger | SHOT, RECAST | A barbed stinger (8 m): 35, and the barb stays in the enemy for 3 s. Recast to leap onto the barbed enemy (8 m) for 20 more. With 2 wasps spent: 30 poison over 3 s. | Dodge it; expect the leap while barbed. |
| W | Hive Shell | SELF | +40% armour for 3 s. Each hit he takes in that time sends a wasp at the attacker (12). | Do not hit the shell; wait 3 s. |
| E | Swarm Cloud | ZONE | All his wasps fly to a spot (9 m) as a 2.5 m cloud for 3 s: 6 per wasp per second, and blinded inside. | Leave the cloud. Strike while his swarm is spent. |
| R | Swarm Surge | SHOT (wide) | He looses every wasp in a roaring column 10 m down his aim, 4 m wide: 12 per wasp (up to 72), the enemy shoved 4 m and blinded 1 s. His swarm then refills to 6 at once. | Sidestep it; bait it while his swarm is small. |

### Cantor, the Last Verse (support, ranged attack)
A bard whose spells land harder on the beat.
- **Passive: On the Beat.**
  - A beat pulses under him every 1 s.
  - A spell cast within 0.25 s of a pulse is in tune: +30% effect and 1 s off its cooldown.
  - On a phone the pulse ring is large; the AI casts on the beat 70% of the time.

| Key | Spell | Type | What it does | Counterplay |
|---|---|---|---|---|
| Q | Resounding Chord | cone | A chord struck in a 5 m cone: 35. In tune: also silenced 0.8 s. | Stay out of the cone. |
| W | Siren Song | TGT, PULL | A siren song (7 m): the enemy is charmed for 1 s (1.4 s in tune) and walks toward him, unable to act. | Break line of sight. |
| E | Rising Chorus | SELF | For 3 s, every in-tune spell gives him +15% speed and a 20 shield (they stack). | Pressure him before the chorus builds. |
| R | Duet | TGT, TERRAIN | A ring of sound (6 m) closes round him and the enemy for 5 s, and neither can leave it. Every in-tune spell inside it also silences 0.5 s. | Stun him inside, or out-fight him there. |

### Opaline, the Lightbreaker (marksman, ranged attack)
Light bends for her, round walls, pillars and her own crystals.
- **Passive: Prismatic.** Her bolts reflect off walls and pillars (Q up to twice), and every reflection adds +25%
  damage and 2 m range.

| Key | Spell | Type | What it does | Counterplay |
|---|---|---|---|---|
| Q | Ricochet Light | SHOT, bank | A bolt of light (12 m) that reflects up to twice: 35, +25% per reflection. | Watch the angles: cover is not safe from her. |
| W | Crystal | TERRAIN | A crystal pillar at a spot (8 m) for 6 s. Her bolts reflect off it at any angle, and it blocks the enemy's bolts. | Move so the crystal gives her no angle. |
| E | Blinding Flare | ZONE (around her) | A flash round her (3 m): the enemy is blinded 1.5 s and knocked back 2 m. Her answer to being rushed. | Do not rush her head-on. |
| R | Shatterlight | TGT, delayed | Six shards of light form a ring round the enemy (10 m) and fire inward after 0.8 s: 25 each. Each shard reflects once off a wall. | Step out of the ring within 0.8 s. |

### Oblivion, the Unmaker (juggernaut, melee)
Everything falls toward him.
- **Passive: Event Horizon.** An enemy within 4 m of him is pulled toward him at 0.6 m/s, and their spells deal 10%
  less to him.

| Key | Spell | Type | What it does | Counterplay |
|---|---|---|---|---|
| Q | Gravity Slam | SELF (3 m round him) | He slams the ground: 40 within 3 m, and everything there is dragged 1.5 m inward. | Keep out of 3 m. |
| W | Null Zone | SELF (aura) | A 3 m sphere of nothing round him for 3 s: the enemy inside cannot cast, and their bolts that enter it vanish. | Keep 3 m away for 3 s. |
| E | Phase Step | BLINK | He steps 5 m through the void, untouchable for 0.4 s. His next basic attack within 3 s rips for +40 and weakens the enemy 20% for 2 s. | Expect him right after the step. |
| R | Black Hole | SHOT (slow) | A black hole crawls 10 m down his aim (2 m/s, 5 s). It pulls the enemy within 5 m toward it (1.8 m/s); its core (1 m) stuns 1 s and deals 80, once. | Walk against the pull and away; it is slow. |

### Shiori, the Last Brush (summoner, ranged attack)
She writes on the ground, and one great character sets it all off.
- **Passive: Wet Ink.**
  - Her strokes stay on the ground for 5 s.
  - The enemy on wet ink is 15% slower and Stained (+20% damage from her).
  - Where two strokes cross, the crossing bursts at once: 35 within 1.5 m.

| Key | Spell | Type | What it does | Counterplay |
|---|---|---|---|---|
| Q | Ink Lash | SHOT | A lash of ink (9 m): 35. It leaves a stroke on the ground along its path. | Dodge it; avoid the crossings. |
| W | Seal of Binding | TRAP | A seal (2 m) painted at a spot (8 m); it arms in 0.5 s and lasts 6 s. The enemy who steps in is rooted 1 s and Stained. It counts as a stroke for crossings. | Walk round it. |
| E | Flowing Script | DASH | She glides 6 m and paints a stroke along her path. | Do not follow her line. |
| R | The Last Character | ZONE | She writes one great character at a spot (9 m, 4 m wide) in 1 s. Every stroke on the ground erupts (40 each to a Stained enemy standing on one), and the enemy inside the character is rooted 1.2 s. | Leave the sigil within 1 s, and stay off the ink. |

### Tempo, the Unwound Hour (mage, ranged attack)
Every spell happens twice, and he steals time.
- **Passive: Echo.** 1.5 s after each of his spells, a clockwork echo repeats it from the same place at 40% (damage
  only, no crowd control). Ghost clock hands show where it will come from.

| Key | Spell | Type | What it does | Counterplay |
|---|---|---|---|---|
| Q | Tick | SHOT | A clock-hand bolt (9 m): 30. It sets a timer on the enemy that tocks 2 s later for 25 more. | Dodge it. |
| W | Slow Time | ZONE | Time slows in a 4 m circle at a spot for 3 s. The enemy inside is 50% slower and their bolts fly at half speed; Tempo inside is 30% faster. | Keep out of the circle. |
| E | Time Skip | BLINK, delayed | He vanishes for 1 s (untouchable) and reappears up to 6 m away where he aimed. | Be where he reappears. |
| R | Time Theft | TGT | He steals 3 s from the enemy (8 m). <br>• Every cooldown of theirs grows by 3 s, and they are 40% slower for 2 s. <br>• His own cooldowns shrink by 3 s, and he is 30% faster for 3 s. | Break line of sight; fight after his burst. |

## The roster at a glance

| Hero | Targeted (TGT) | Movement | Pull / push / lift | Buff or stance | Ultimate shape |
|---|---|---|---|---|---|
| Vesper | Q, E, R | W mist dash | R drag per pulse | W | channel drain |
| Brannoc | E | – | Q hook, W knock-up | W, R | transform |
| Isolde | W, R | – | – | E | stack finisher |
| Lyra | R | – (W haste) | – | W | mark, then meteor |
| Vex | W | – | E knock-back, reactions | – | walking reaction bomb |
| Kaia | Q, E | – | E yank to a rod | – | storm round her |
| Sefu | W, R | E scarab dash | W crook pull | – | seal, then root |
| Nyx | Q | E dash | – | passive veil, R | global darkness |
| Fenna | W | E glide | – | – | terrain tree |
| Auriel | E | – | – | W, R | reflect stance |
| Marin | – | E water form | Q, W, R by tide | E | global pull |
| Zephyr | R | Q, W, E | W knock-up | passive gusts | untouchable strikes |
| Mortis | R | – | R drag | E | grasp and summon |
| Ada | Q | E grapple | E reel-in | R | transform (mech) |
| Sirix | – | Q leap | R shove | W | swarm column |
| Cantor | W, R | – | W charm walk | E | duel ring |
| Opaline | R | – | E knock-back | – | converging shards |
| Oblivion | – | E blink | passive, Q, R pulls | E | crawling black hole |
| Shiori | – | E glide | – | – | ink detonation |
| Tempo | R | E time skip | – | R | cooldown theft |

- **Targeted spells:** 16 heroes have at least one (22 targeted spells in all). The four without are skillshot,
  terrain or swarm heroes on purpose: Marin's tide, Sirix's barb, Oblivion's gravity, Shiori's ink.
- **Movement:** 11 heroes have a dash, blink or leap. The others have an answer of a different kind:
  - Brannoc's hook and his immunity;
  - Isolde's armour;
  - Lyra's haste;
  - Vex's acid and Opaline's flare (both knock back);
  - Kaia's yank;
  - Auriel's shields;
  - Mortis's bone armour;
  - Cantor's charm.

  Only 9 E keys are dashes.
- **Displacement:** 13 heroes pull, push, carry or lift.
- **Buffs:** 14 heroes have a buff or stance.
- **Ultimates:** 20 different shapes.
  - Two transforms (Brannoc's slag, Ada's mech).
  - Two summons, one a bomb and one at the start of a combo (Vex's homunculus, Mortis's grasp).
  - One cooldown theft (Tempo).
  - Three areas: Kaia's storm round her, Fenna's tree and Shiori's sigil. None is a plain circle that only deals damage.

## New engine pieces this needs

Much of it sits on what is already built:
- projectiles, hooks, carries;
- temporary walls, summons, shields;
- recasts, holds, charges, untouchable windows;
- statuses and the rewind history.

What is new:

| # | Piece | Cost | Who | Notes |
|---|---|---|---|---|
| 1 | **Trait hits**: a hit that comes from a passive or from something a spell left behind, after the duel's 4.5 s cast window | M | Kaia's rods, Shiori's ink, Fenna's flowers, Auriel's shield bursts, Sirix's wasps, Tempo's echoes and timers | Today a hit more than about 4.5 s after its cast is dropped, and a passive cannot hit at all. A `TraitView.hitEnemy`, plus a longer window for effects that declare one. |
| 2 | **Attack changes**: extra reach, a cone splash, an empowered next attack, a second arrow, a piercing ray | M | Vesper, Brannoc, Lyra, Zephyr, Auriel, Oblivion, Ada | `attackMods` today only scales power and adds a status. |
| 3 | **New statuses**: Grounded (no dash, blink or leap), Charm (walks toward the caster, cannot act), and a buff immune to slow, root and knock-up | S each | Sefu, Cantor, Brannoc | `status.ts`; every dash and `moveCaster` checks Grounded. |
| 4 | **Untouchable target**: a spell makes the enemy untouchable for a while (both sides' hits pass through) | S | Sefu's sarcophagus | Today only a hero's own trait can make itself untouchable. |
| 5 | **Channel**: the caster is rooted, and a stun, silence or knock-up cancels it, with a bar on the HUD | S–M | Vesper | The effect reads the caster's status each frame. |
| 6 | **Decoy**: a fake figure the enemy can hit and the AI can target | M | Nyx | A summon with the hero's look. |
| 7 | **Stealth**: invisible beyond a range, not targetable by targeted spells, the AI loses track, the arena darkens | L | Nyx | The biggest single piece. Online, the other screen hides her figure. |
| 8 | **Transform**: size, attack and one spell swapped for N s | M | Brannoc, Ada | Pieces 2 and 3 plus a spell swap. |
| 9 | **Bank shots**: bolts that reflect off walls, pillars and placed crystals | M | Opaline | The projectile system already tests obstacles; reflect instead of ending. |
| 10 | **Zone time**: bolts at half speed inside a zone | S | Tempo | |
| 11 | **Enemy cooldowns, reflected damage, positional bonus**: reach the other side's cooldowns; send a share of a hit back; know whether a hit came from behind | S each | Tempo, Auriel, Nyx | Duel APIs. |
| 12 | **Summon behaviours**: a summon that bursts on contact; skeletons raised by a passive; turrets that focus a tagged enemy | S–M | Vex, Mortis, Ada | `summon.ts`. |
| 13 | **Meters on the HUD**: tide, beat, swarm, heat | S | Marin, Cantor, Sirix, Brannoc | `resource` and `badge` exist. Cantor's beat needs a pulse ring. |
| 14 | **Targeted spells need line of sight** at cast | S | everyone | The AI already checks sight; the player's cast gets the same check and a "no sight" hint. |
| 15 | **AI rules** for the new verbs | M | all | For example: stop casting while cursed, cast in tune, read the tide, trample flowers, keep away from rods, face Nyx, stand off walls against Lyra. |

**What this costs, plainly:**
- It is the largest piece of work in the project so far.
- The engine part alone is several times batch 1's engine.
- The 20 heroes are four batches the size of batch 3, each with a browser check, AI duels and a sheet.

## Build order

1. **A low-engine opener** that is playable early: Lyra, Vex, Marin, Mortis and Zephyr.
   - It needs pieces 2, 12 (part), 13 and 14. None of these five hits from something left behind after the cast
     window, so they need no trait hits.
   - About a batch-3-sized effort.
   - The user plays them before the rest.
2. **Then the heavier batches**, each led by the engine piece it needs, one writer at a time on the shared files
   (`duel.ts`, `arena.ts`, `heroMode.ts`, `projectile.ts`, `status.ts`, `summon.ts`):
   - Vesper, Brannoc, Sefu, Cantor, Tempo (statuses, channel, transform, enemy cooldowns);
   - Isolde, Kaia, Fenna, Auriel, Ada (trait hits, mech);
   - Sirix, Shiori, Opaline, Oblivion, Nyx (bank shots, stealth last).
3. **Every batch:**
   - per-hero workers own only their kit, trait and new effect files;
   - then the registry, the AI rules and a browser check of every spell;
   - AI duels, 40–60% wins against a mixed field;
   - a sheet;
   - a two-player online duel, with the known online gaps written down per spell.
4. **Phone:** the beat ring, the targeted taps and the holds checked on a phone each batch.
5. **Models:** the twelve heroes still on the old look get the current style, two at a time, alongside the kit
   batches (Sefu and Auriel are done).

## Questions for the user

1. Keep every hero's name, look, theme and role (assumed), or change roles too?
2. Should targeted spells need line of sight, so that pillars counter them? Assumed yes.
3. Stealth (Nyx) is the most expensive single piece. Keep it, or give Nyx something cheaper?
4. Two transforms (Brannoc's Molten Core, Ada's mech): fine, or one only?
5. Cantor's beat asks for timing on a phone. Keep it, or make it automatic (every third spell is in tune)?
6. Start with the low-engine opener (Lyra, Vex, Marin, Mortis, Zephyr), or with five you pick?
