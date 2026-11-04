---
title: New heroes, full kits
tags: [design, heroes, kits]
updated: 2026-11-04
status: design, being built
---

# New heroes: the 19 kits (2026-11-04)

The user asked for all of [new-heroes.md](new-heroes.md). These are the kits to build from. They follow the rules and the arithmetic in [kits-v5.md](kits-v5.md):
walker 4 m/s, reaction 0.25 s, a circle's delay at least `0.25 + radius / 4`, and a bolt reaching 6 m no sooner than 0.5 s. CD is the cooldown in seconds. Numbers are first guesses for the balance run.

None of them comes from a League champion, and every spell name below was written for this game. Check them against the catalogue before release.

Each hero's **Look** is the brief for its model, in the current style ([moba_figures.py](../../blender/heroes/moba_figures.py)). **Engine** is what it needs beyond what exists.

---

## 1. Bram and Gerald, the Pillar Mason
Theme `mason`. Bruiser, melee. 760 HP, 3.8 m/s, attack 2.5 m, 15 per 1.2 s. Accent `#c9b48a`, foil `#6d6a66`.
**Look:** a broad stonemason in a leather apron with a chisel and a big mallet, dust on him, a kind face. Gerald is drawn by the kit.
**Question:** keep Gerald as cover, or throw him at you? **Weakness:** without Gerald he is a plain fighter, and anyone can break him or walk away from him. **Second decision:** Gerald is cover, weapon and escape, and using one spends the others.

| Key | Spell | CD | Rule | Answer, checked |
|---|---|---:|---|---|
| P | Best Friends | | One Gerald: a real pillar (blocks walking, sight, bolts), 220 HP, a carved face that changes. Within 3 m Bram takes 15% less | Fight away from him, or break him |
| Q | Raise Gerald | 6 | At a spot (9 m), 0.7 s warning: 50 and a 0.5 s knock-up within 1.5 m. An old Gerald crumbles | Step off: 0.63 s with reaction |
| W | The Shove | 7 | Gerald within 3 m: he slides 8 m away from Bram at 8 m/s, line shown from the cast with a 0.3 s wind-up. Hit: 60, carried along; pinned on a wall: stunned 0.9 s | Sidestep: he needs 1.05 s to reach 6 m, you need 0.6 s |
| E | A Good Lean | 11 | Dash to Gerald from up to 8 m, and a 60 shield for 2 s | Break Gerald first |
| R | Gerald, No! | 24 | Gerald topples along a 10 m line, 1.6 m wide; shadow for 1.0 s, then 150. He breaks into rubble that slows for 3 s | Leave the shadow: 0.45 s with reaction. Bram has no pillar afterwards |

**Engine:** a moving obstacle, shared with Hank's falling tree. Floating words: SORRY GERALD.

## 2. Silvane, the Vain
Theme `mirror`. Marksman, ranged. 560 HP, 4.1 m/s, attack 7.5 m, 12 per 1.2 s. Accent `#cfe6ff`, foil `#d9b8ff`.
**Look:** a tall elegant duelist in a silver gown with a high collar, carrying a hand mirror, hair perfect, nose in the air.
**Question:** chase the mirror coming back, or stay where the shot is good? **Weakness:** open ground gives no bounces; close up she has no damage. **Second decision:** every thrown mirror asks whether to walk to the catch.

| Key | Spell | CD | Rule | Answer, checked |
|---|---|---:|---|---|
| P | Fairest of All | | Each bounce adds 25%. A mirror returning to within 1 m of her is caught: its cooldown ends and she is 20% faster for 2 s ("GORGEOUS") | Hit her on the catch: you can see where she must walk |
| Q | Hand Mirror | 3.5 | A spinning mirror (10 m, 22 m/s, 0.3 s wind-up, 3 bounces): 40. First bounce drawn for both | Sidestep: it reaches 6 m at 0.57 s |
| W | Vanity Stand | 12 | A standing mirror at a spot (8 m) for 6 s, 60 HP. Blocks bolts; her mirrors reflect off it. Whoever breaks it has Bad Luck: 15% less damage for 7 s | Move so it gives no angle, or break it and take the luck |
| E | Through the Glass | 10 | Step into the Stand and out beyond it, up to 9 m. With no Stand, a 3 m step | Stand by the mirror: you know where she comes out |
| R | Hall of Mirrors | 22 | 8 mirrors outward (16 m/s, 0.6 s wind-up, 2 bounces): 30 each, each hits once | Get close: the gap between mirrors at 3 m is 2.3 m, wider than a body |

**Engine:** bank shots exist. A catch check; a debuff.

## 3. Hank Birchwood, the Lumberjack
Theme `timber`. Bruiser, melee. 740 HP, 3.8 m/s, attack 2.5 m, 16 per 1.3 s. Accent `#b5763a`, foil `#3f6b3a`.
**Look:** a huge bearded man in a red plaid shirt, suspenders, a big double axe, boots, a woolly hat.
**Question:** let this tree grow for more damage, or chop it now? **Weakness:** he needs time; saplings are weak and he has no dash. **Second decision:** every tree is cover now or damage later.

| Key | Spell | CD | Rule | Answer, checked |
|---|---|---:|---|---|
| P | Fresh Cut | | 3 trees. Sapling (30 HP, blocks nothing), young at 1.2 s, full at 2.5 s (real cover, 120 HP). Bigger falls harder. A stump stays | Break saplings early. Size is plain to see |
| Q | Axe Swing | 3 | A 3 m swing: 40. A tree it touches falls away from him: 8 m long, 1.6 m wide, shadow 0.6 s. Sapling 30, young 60, full 110 | Step out: 0.8 m takes 0.45 s with reaction |
| W | Fast Growth | 7, 2 charges | A tree at a spot up to 6 m in front; on you: 0.7 s warning, 40 and a 0.5 s knock-up within 1.5 m | Step off: 0.63 s with reaction |
| E | Caber Toss | 9 | Rips up the nearest tree within 3 m and hurls it (9 m, 16 m/s, 0.3 s wind-up, radius 0.9): 30, 60 or 90, and a knock-back. With no tree: throws his axe for 30, and Q is gone until he walks to it | Sidestep: 0.68 s at 6 m. Press him when the axe is away |
| R | TIMBER! | 24 | 5 trees in a row in 1 s, 10 m long, real cover. Recast within 4 s: they fall like dominoes along the row, 90 each, 3 at most | Go round to his side, or through before they close. They also shield you until he swings |

**Engine:** the same falling obstacle as Gerald. Floating word: TIMBER! Birds fly out.

## 4. Professor Puff, balloon scientist
Theme `balloon`. Mage, ranged. 560 HP, 3.9 m/s, attack 6 m, 10 per 1.0 s. Accent `#ff8fb8`, foil `#fff1a8`.
**Look:** a small round scientist in a lab coat and goggles, with a brass pump and a hose on his back, balloons tied to his belt.
**Question:** pop you now, or inflate you more? **Weakness:** you can deflate, by standing still or by hitting him. He is fragile. **Second decision:** the pop's damage grows with waiting, and waiting is when you deflate.

| Key | Spell | CD | Rule | Answer, checked |
|---|---|---:|---|---|
| P | Inflate | | His hits add Air (10 at most, 6 s). Your hero **really swells** by 6% per Air, and is pushed 8% farther per Air. Standing still for 1 s lets out 1 Air per 0.3 s; hitting him lets out 1 | Stand still or hit him. Your own size shows the danger |
| Q | Air Hose | 3.5 | A jet (8 m, 22 m/s, 0.3 s wind-up): 45, 3 Air, and a 1 m push | Sidestep: 0.57 s at 6 m |
| W | Helium Bomb | 9 | A balloon floats to a spot (9 m) and pops after 1.0 s within 2.5 m: 40, 3 Air | Leave: 0.88 s with reaction |
| E | Hot Air | 10 | He inflates himself and floats 6 m away, and a push of 3 m on anyone within 2.5 m where he left | The landing is shown. He is out of position after |
| R | Pop! | 22 | A pin flies at you (9 m, 0.6 s, sight when it lands): 50 plus 20 per Air, and all your Air goes in a shove of 3 m | Reach cover: 1.4 m in 0.6 s, or get your Air down first |

**Engine:** a scale on the enemy's figure, on both screens. Funny sound words: BLOAT, POP.

## 5. Sir Whiskers, a cat knight
Theme `cat`. Assassin, melee. 450 HP in 9 lives of 50, 4.5 m/s, attack 2 m, 9 per 0.7 s. Accent `#e8a13a`, foil `#f4e6c8`.
**Look:** an upright ginger cat in shining plate armour, a small sword, a plume, a tail out the back, very pleased with himself.
**Question:** when do I spend a life on purpose? **Weakness:** many small hits cut him apart, and he has no answer to a slow. **Second decision:** at a full life, attack; on a low one, spend it for a pounce.

| Key | Spell | CD | Rule | Answer, checked |
|---|---|---:|---|---|
| P | Nine Lives | | His bar is 9 chunks of 50. No single hit takes more than the life he is on. Damage carries no further | Use fast attacks and damage over time: a big spell is wasted on him |
| Q | Scratch | 3 | A 2.5 m claw: 40. Next attack within 2 s is free of its wind-up | Stay out of 2.5 m |
| W | Knock It Over | 9 | He bats something off a pillar: within 4 m of cover, a pot falls on you at a shown spot after 0.7 s (1.5 m): 50 and a 0.5 s stun. In the open it does nothing | Step off: 0.63 s with reaction. Fight in the open |
| E | Pounce | 8 | Spends the life he is on: leap 7 m onto you, 60. He lands and can't cast for 0.4 s | He loses a life doing it: hit him when he lands |
| R | Land on My Feet | 24 | For 4 s the next life he would lose is not lost, and he lands on his feet: a 3 m leap away. His attacks are 30% faster until then | Hit him once with something small first, to use it up |

**Engine:** chunks on the HP bar for both players. `taken` caps a hit.

## 6. Mr. Ledger, debt collector
Theme `ledger`. Controller, ranged. 600 HP, 4.0 m/s, attack 6 m, 8 per 0.8 s. Accent `#d9c27a`, foil `#3f4a3a`.
**Look:** a thin man in a grey suit and bowler hat with a huge ledger under one arm and a pencil, glasses on a chain.
**Question:** bill you now, or let the interest grow? **Weakness:** you can pay your tab early by hitting him, and he is weak if you press him. **Second decision:** call the tab in now for less, or wait for more.

| Key | Spell | CD | Rule | Answer, checked |
|---|---|---:|---|---|
| P | On Your Tab | | His spell damage goes on your **tab**, a number over your head. It comes due 4 s after the last charge, at +30%. Each hit you land on him pays off 20 | Hit him to pay it. Running away makes it worse |
| Q | Invoice | 3.5 | A paper flies (9 m, 20 m/s, 0.25 s wind-up): 50 on the tab | Sidestep: 0.55 s at 6 m |
| W | Late Fee | 9 | At a spot (9 m), 1.0 s, 2.5 m: 40 on the tab, and slowed 1.5 s | Leave: 0.88 s with reaction |
| E | Call It In | 8 | Your tab comes due now, without the interest. No target needed | Keep your tab low. The number is on you |
| R | Foreclosure | 24 | A 0.8 s stamp on you (9 m, sight when it lands): your whole tab now at +60%, and for 3 s you take +20% from him | Reach cover: 2.2 m in 0.8 s, or pay your tab first |

**Engine:** a number over a hero's head. Words: PAST DUE, FINAL NOTICE.

## 7. Madame Cleaver, arena chef
Theme `chef`. Support, ranged. 640 HP, 3.9 m/s, attack 5.5 m, 9 per 0.8 s. Accent `#f2efe6`, foil `#d84a3a`.
**Look:** a big proud chef in a white double-breasted jacket and tall hat, a huge cleaver and a ladle.
**Question:** cook for myself where you can't reach, or bait you with a bad one? **Weakness:** you can eat her food, and without it she is plain. **Second decision:** a dish left longer gets better, and is more worth stealing.

| Key | Spell | CD | Rule | Answer, checked |
|---|---|---:|---|---|
| P | Today's Special | | Her spells leave dishes on the floor (3 at most, 8 s). **Whoever walks over one eats it.** Fresh: +15% speed for 3 s. After 3 s it is good: also heals 30. Burnt ones look burnt | Eat it yourself. Her own dish is your food too |
| Q | Thrown Cleaver | 3.5 | A cleaver (9 m, 20 m/s, 0.25 s wind-up): 50, and a dish where it stops | Sidestep: 0.55 s at 6 m |
| W | Hot Soup | 9 | A pot at a spot (8 m), 1.0 s, 2.5 m: 40, slowed 1.5 s, and a dish at its centre | Leave: 0.88 s with reaction |
| E | Burnt Offering | 12 | A dish that looks burnt. If you eat it: 60 and a 0.8 s stun. If she walks on it nothing happens | Burnt ones are black and smoking. Walk round |
| R | Dinner Is Served | 24 | A long table 8 m long rises in front of her for 5 s, real cover, with 3 dishes on it. She eats them all if she stands at it for 1 s: heals 50, +25% damage for 5 s. Break the table: 150 HP | Break the table, or get there first: the dishes are yours too |

**Engine:** nothing new, marks and `victimTick`. Heal limit: an R heal of at most 50.

## 8. Wick, the Doorman
Theme `door`. Controller, ranged. 590 HP, 4.0 m/s, attack 6 m, 10 per 1.0 s. Accent `#b08a4a`, foil `#6a2a2a`.
**Look:** an old thin hotel doorman in a long red coat with brass buttons, white gloves, a little round hat, a ring of keys.
**Question:** where do I put the doors so only I profit? **Weakness:** you can use them too, or break them. Without them he is weak. **Second decision:** a door placed for escape is not there to shoot through.

| Key | Spell | CD | Rule | Answer, checked |
|---|---|---:|---|---|
| P | This Way, Please | | Two doors at a time. **Anyone who walks into one leaves by the other; a bolt that flies in comes out of the other**, either hero's. A door has 40 HP | Use his doors against him, or break them |
| Q | Key Toss | 3.5 | A key (9 m, 22 m/s, 0.3 s wind-up): 50 | Sidestep: 0.57 s at 6 m |
| W | Door | 4, 2 charges | A door at a spot (9 m), for 10 s | Break it: 40 HP |
| E | Slam | 9 | Both doors slam: 40 and a 0.5 s stun on an enemy within 1.5 m of either, after 0.7 s | Step off: 0.63 s with reaction |
| R | Grand Lobby | 24 | 4 more doors ring you (radius 3 m, 9 m, sight) for 4 s; walking through any leaves you at the far side of the ring, and his Q flies through them all | Walk out through the gap: gaps are 2 m. Stand still, and you are safe from walking but not from Q |

**Engine:** portals for bolts and for heroes.

## 9. Bo, the angry shepherd
Theme `sheep`. Summoner, ranged. 620 HP, 3.9 m/s, attack 6 m, 9 per 0.9 s. Accent `#f0ead6`, foil `#7a5a3a`.
**Look:** a furious old shepherd with a wide hat, a long crook, a wool coat, a huge beard, one sheep under his arm.
**Question:** herd them at you, or keep them as a wall? **Weakness:** sheep follow whoever is nearest, including you, and you can shear them. **Second decision:** where he stands decides where the flock goes.

| Key | Spell | CD | Rule | Answer, checked |
|---|---|---:|---|---|
| P | Wool Over Your Eyes | | Sheep walk to whoever is **nearest**. Touching you adds Wool; at 5 Wool you are a sheep for 1 s (*Baa*: no casting, walks slowly). A sheep blocks bolts | Lead them away, or kill them: 30 HP each |
| Q | Crook Whack | 3.5 | A 4 m cone: 45, and a sheep at your feet | Stay out of 4 m |
| W | Spare Sheep | 8 | 3 sheep at a spot (8 m), 6 s | One spell kills a sheep |
| E | Shear | 11 | He shears a sheep within 6 m: it runs naked and bleating, and you get 3 Wool from 40 HP worth of wool thrown (bolt, 8 m) | Sidestep the wool: 0.55 s at 6 m |
| R | Stampede | 22 | 8 sheep run down a 12 m line, 4 m wide, after 0.8 s at 8 m/s: 25 each, 3 at most, and 1 Wool each | Sidestep: 2 m plus 0.25 s is 0.75 s. The stampede ends at the wall |

**Engine:** a summon that targets the nearest hero of either side.

## 10. Pim and Pom, the twins
Theme `twins`. Fighter, melee or ranged. 620 HP, 4.2 m/s. Accent `#ffb04a`, foil `#6ac8ff`.
**Look:** two small bright children, one in an orange helmet with a wooden sword (Pim), one in a blue hood with a slingshot (Pom). Only one is on the field; the other rides in a backpack.
**Question:** who should be in right now? **Weakness:** the tag has a 0.5 s delay you can read. **Second decision:** the rested twin heals, and each has a spell the other wants.

| Key | Spell | CD | Rule | Answer, checked |
|---|---|---:|---|---|
| P | Tag Team | | R swaps twins, with a 0.5 s hold. The resting twin heals 4 HP/s. Each twin has its own HP bar | Hit the tag: 0.5 s |
| Q | Pim: Bonk (3 m cone, 50). Pom: Pebble (9 m, 22 m/s, 45) | 3 | | Stay out of 3 m; sidestep the pebble |
| W | Pim: Charge (5 m dash, 40). Pom: Snare (7 m, 1.0 s, 2 m, root 1 s) | 9 | | Step off the charge; leave the snare: 0.75 s |
| E | Pim: Shield Up (50 shield, 2 s). Pom: Backflip (4 m back, 30 to what it leaves) | 10 | | Wait it out, or take the space |
| R | Tag Out | 8 | Swap twins. The one who comes in has the next spell's cooldown cut by 2 s | Read the swap: a 0.5 s window |

**Engine:** a second set of spells on one hero, a model swap, two HP pools. Largest of all.

## 11. Pip, the last courier
Theme `courier`. Skirmisher, ranged. 580 HP, 4.7 m/s, attack 5 m, 8 per 0.8 s. Accent `#ffd24a`, foil `#3a6ac8`.
**Look:** a skinny running postman in a blue cap and shorts, an enormous bag, one sock down.
**Question:** deliver, or fight you now? **Weakness:** you can read his route, and stand on the drop point. Weakest in a straight fight. **Second decision:** a delivery charge is damage or speed.

| Key | Spell | CD | Rule | Answer, checked |
|---|---|---:|---|---|
| P | Sign Here | | A parcel appears on the arena; carry it to the drop point (both shown): +1 Charge, 3 at most. A hit on him while carrying knocks it loose | Stand on the drop point, or hit him |
| Q | Express Letter | 3 | A letter (8 m, 24 m/s, 0.25 s wind-up): 35, +15 per Charge | Sidestep: 0.5 s at 6 m |
| W | Fragile | 9 | A parcel thrown at a spot (9 m), bursting after 1.0 s, 2.5 m: 50, slow 1 s | Leave: 0.88 s with reaction |
| E | Shortcut | 9 | A 6 m sprint; can spend a Charge to refund it | He spent his damage to do so |
| R | Final Delivery | 24 | Spends all Charges: a parcel with your name follows you for 1.5 s (5 m/s), then bursts: 80 plus 40 per Charge within 2 m, unless you touch cover first: a signature, and it is returned | Reach any cover within 1.5 s: 5 m. Or walk, as it gains only 1 m/s |

**Engine:** nothing new, marks and a homing mark.

## 12. Gus, the janitor
Theme `janitor`. Controller, melee. 700 HP, 3.9 m/s, attack 2.8 m, 14 per 1.3 s. Accent `#ffd23a`, foil `#3a6a8a`.
**Look:** a stocky tired janitor in grey overalls and a cap, a mop, a bucket on wheels, a keyring, a moustache.
**Question:** where do I mop, so you slide into what I want? **Weakness:** the wet shows, and sliding is fast, so you can use it. **Second decision:** mop in your way or where he wants you to end.

| Key | Spell | CD | Rule | Answer, checked |
|---|---|---:|---|---|
| P | Wet Floor | | Mopped floor stays wet 6 s, shining. On it heroes keep sliding the way they were going (turn half as fast); he alone doesn't. His mop wipes enemy ground things it touches: rods, flowers, ink | Walk round the shine, or slide on purpose: it is fast |
| Q | Big Mop | 3.5 | A 3.5 m swipe: 45, and a strip of wet 6 m long | Stay out of 3.5 m |
| W | Wet Floor Sign | 8, 2 charges | A yellow sign at a spot (8 m): a real obstacle for 6 s, 40 HP. A hero who slides into it: 40, stunned 0.6 s | Don't slide at a sign. Break it first |
| E | Bucket | 10 | A wheeled bucket flies (8 m, 16 m/s, 0.3 s wind-up): 40, wet in 2.5 m round where it stops | Sidestep: 0.68 s at 6 m |
| R | Flood | 24 | The whole floor in 7 m round him is wet for 5 s, after a 1 s warning, and he surfs: +35% speed, and his Q is 60 | Leave before it floods: 7 m takes too long, so stand near cover, which stops a slide, or walk straight lines |

**Engine:** a slide on the hero. A wipe hook on ground lists.

## 13. Mum, the mime
Theme `mime`. Controller, ranged. 580 HP, 4.1 m/s, attack 5.5 m, 9 per 0.9 s. Accent `#f7f7f2`, foil `#20202a`.
**Look:** a thin mime with a white face, striped shirt, black beret, red scarf, white gloves. **Never** a floating word: gestures only.
**Question:** which wall is real? **Weakness:** one hit breaks a wall, and chalk lines show them. **Second decision:** a wall for cover is not a wall to trap you.

| Key | Spell | CD | Rule | Answer, checked |
|---|---|---:|---|---|
| P | Silence Is Golden | | She makes up to 3 **invisible walls**, shown only as faint chalk lines. A wall blocks walking and bolts for both for 5 s, and one hit of any size breaks it | Read the chalk. Break it with one hit |
| Q | Invisible Ball | 3.5 | She throws a ball you cannot see, shown as a line on the floor (9 m, 22 m/s, 0.3 s wind-up): 50 | The line is drawn: sidestep, 0.57 s at 6 m |
| W | Wall | 3, 3 charges | A wall 4 m long at a spot (9 m) | One hit |
| E | Rope Trick | 11 | She mimes a rope to you (7 m, 0.5 s, sight when it lands): pulled 3 m, and 30 | Step behind cover: 1 m in 0.5 s |
| R | The Box | 22 | Four walls close round your spot (9 m, sight) after 0.8 s, 3 m wide, for 3 s. She can shoot in; you can't get out until you break one. Each takes a hit | Step out: 1.5 m takes 0.63 s with reaction, inside the 0.8 s |

**Engine:** nothing new: obstacles and chalk marks.

## 14. Referee Whistler
Theme `referee`. Controller, ranged. 620 HP, 4.0 m/s, attack 6 m, 9 per 0.9 s. Accent `#f2f2f2`, foil `#1a1a1a`.
**Look:** a stern little man in a black and white striped shirt, black shorts, long socks, a whistle on a cord, cards in his pocket.
**Question:** which rule hurts you most right now? **Weakness:** you can obey it, and his damage is low without cards. **Second decision:** a card now, or the bigger rule later?

| Key | Spell | CD | Rule | Answer, checked |
|---|---|---:|---|---|
| P | By the Book | | A rule he calls shows over your head for 3 s. Break it: a **yellow card**. Two yellows: a **red**: 60 and silenced 1.5 s. Cards last the round | Obey it for 3 s, or take the card when it is worth it |
| Q | Whistle Blast | 3.5 | A sound ring (8 m, 22 m/s, 0.3 s wind-up): 50 | Sidestep: 0.57 s at 6 m |
| W | No Running | 9 | Rule: no dashes, blinks or leaps for 3 s (7 m, sight) | Walk instead |
| E | No Casting | 13 | Rule: no spells except basic attacks for 2 s (7 m, sight). Casting anyway is a yellow, not blocked | Attack, walk, or take the card if your spell is worth it |
| R | Show the Card | 24 | Rule: hit him for 3 s and you get a yellow; at once, he points: a yellow now (9 m, 0.6 s, sight when it lands) | Cover within 1.4 m. Keep your card count low: it shows on you |

**Engine:** nothing new: `enemyCast`, `victimTick`, words over the head.

## 15. The Great Zambini, stage magician
Theme `magic`. Trickster, ranged. 570 HP, 4.1 m/s, attack 6 m, 10 per 1.0 s. Accent `#b05aff`, foil `#ffe08a`.
**Look:** a tall magician in a tailcoat and top hat with a star-tipped wand, a thin moustache, a cape lined in purple.
**Question:** which hat do I come out of? **Weakness:** the hats really move, so watching beats him, and area spells hit all three. **Second decision:** hide for safety, or stay out for damage.

| Key | Spell | CD | Rule | Answer, checked |
|---|---|---:|---|---|
| P | Ta-da! | | His first spell after coming out of a hat deals +40%, and a rabbit runs at you (20 HP, 8 damage) | Kill the rabbit, and hit him on the way out |
| Q | Card Spray | 3.5 | Three cards in a 24° fan (8 m, 22 m/s, 0.3 s wind-up): 22 each | Past 5 m stand in a gap. Close up it is a wall |
| W | Sawn in Half | 10 | A blade slides at you (8 m, 18 m/s, 0.3 s wind-up): 50 and slowed 1.5 s | Sidestep: 0.63 s at 6 m |
| E | The Hat Trick | 13 | Three hats at his feet shuffle for 1.5 s and he vanishes under one. Hit the right hat: he pops out stunned 1 s. Wrong: confetti. At 1.5 s he appears at his hat | Watch the shuffle. An area spell hits all three |
| R | The Grand Finale | 24 | He vanishes; three hats ring you (radius 3 m) for 1.2 s, then swords fly from all, 30 each, and he steps out of one | Step out of the ring: 1 m in the 1.2 s. Walls stop swords |

**Engine:** hide the figure, hats as summons. Secret spot sent only when he appears.

## 16. Big Yoko, sumo
Theme `sumo`. Tank, melee. 840 HP, 3.6 m/s, attack 2.4 m, 16 per 1.2 s. Accent `#e63a3a`, foil `#f4ead0`.
**Look:** a giant sumo in a red belt with a topknot and a calm face, huge arms, bare feet.
**Question:** shove you now, or get you nearer the edge first? **Weakness:** walk out of the ring before he finishes it; the ring is a place, and he is slow. **Second decision:** the push counts only when it crosses the edge.

| Key | Spell | CD | Rule | Answer, checked |
|---|---|---:|---|---|
| P | Dohyo | | One ring at a time, 5 m radius, 8 s, drawn on the floor. A push of his that takes you out of it is a **ring-out**: +80 damage and stunned 0.5 s | Fight in the middle, or stay out |
| Q | Palm Strike | 3 | A 2.8 m push: 40, shoved 3 m | Keep away: you walk faster |
| W | Stomp | 11 | He stomps a new ring at his feet, 0.5 s wind-up: 40 and slowed 1 s within 3 m | Leave 3 m: he is slower |
| E | Charge | 10 | 6 m charge (0.4 s wind-up, line shown): 40, shoved along it, ring-out counts | Sidestep: 0.6 s |
| R | Salt Throw | 22 | Throws salt: 6 m cone after 0.6 s: blinded 1.5 s, and the ring gets 2 m smaller for the rest of its life. Then he is 30% faster for 4 s | Stay out of the cone. Leave the ring |

**Engine:** nothing new.

## 17. Barry Cloudsley, the weatherman
Theme `weather`. Mage, ranged. 570 HP, 4.0 m/s, attack 6 m, 10 per 1.0 s. Accent `#6ac8ff`, foil `#f4e65a`.
**Look:** a smiling man in a blue suit with a bad tie and perfect hair, a pointer, a raincoat over one arm.
**Question:** change the forecast, or trust it? **Weakness:** everyone sees the forecast, and the weather hits both. **Second decision:** a change spends his damage spell.

| Key | Spell | CD | Rule | Answer, checked |
|---|---|---:|---|---|
| P | And Now the Weather | | Every 8 s the arena changes: Rain (everyone slower), Sun (everyone heals 4 a second), Wind (a push of 1 m/s across). A forecast shows the next one for 3 s. 1 in 5 is wrong. He is +20% in the weather he forecast | Read the forecast, on screen for both |
| Q | Cold Front | 3.5 | A gust (9 m, 20 m/s, 0.25 s wind-up): 50. In Rain it slows; in Wind it pushes 2 m | Sidestep: 0.55 s at 6 m |
| W | Lightning Risk | 9 | Marks your spot (9 m), 0.8 s, 1.5 m: 45 | Step off: 0.63 s with reaction |
| E | Update | 12 | The forecast changes now, to the one you need least | The new one is shown |
| R | Severe Warning | 24 | Tornado at a spot (9 m), 1.0 s warning, then it walks at you at 2.5 m/s for 4 s: 25 a second within 2 m | Walk away: you walk faster. It is a chase, not a trap |

**Engine:** weather on the arena. Both screens agree by round time and a change count.

## 18. Grandma Ironknit
Theme `yarn`. Support, ranged. 620 HP, 3.8 m/s, attack 5.5 m, 9 per 0.9 s. Accent `#e86a9a`, foil `#c8c0a8`.
**Look:** a tiny old woman in a shawl and thick glasses, knitting needles as long as swords, a basket of yarn, a big grey cat at her feet.
**Question:** where do I string the yarn before you get there? **Weakness:** one hit cuts a line, and in the open she has nothing to tie to. **Second decision:** yarn on your path, or round her for safety.

| Key | Spell | CD | Rule | Answer, checked |
|---|---|---:|---|---|
| P | Keep Warm | | Yarn lines tie between pillars, walls and her. 3 at most. Crossing one: stuck 0.4 s, then slowed 1 s. One hit cuts it | Cut it. Fight in the open |
| Q | Knitting Needle | 3.5 | A needle (9 m, 22 m/s, 0.3 s wind-up): 50 | Sidestep: 0.57 s at 6 m |
| W | Cast On | 6, 2 charges | A line from her to the nearest cover in the aimed direction (9 m) | One hit cuts it |
| E | Sweater | 11 | Thrown on you (7 m, 0.5 s, sight when it lands): slowed 2 s, then it shrinks: 40 | Reach cover: 1 m in the 0.5 s. Or wait |
| R | Mr. Biscuit | 24 | The cat, 200 HP, 6 s: runs at you at 4.5 m/s and sits on you: 25 a second, slowed. Shoot it, or lead it away: it stops for yarn | Shoot it. Cut a line near it and it plays |

**Engine:** the line check, in `victimTick`.

## 19. Mabel, the mole
Theme `mole`. Assassin, melee. 640 HP, 4.3 m/s, attack 2.2 m, 11 per 0.9 s. Accent `#8a6a4a`, foil `#ffcf5a`.
**Look:** a stout mole woman in a miner's helmet with a lamp, thick round glasses, huge digging claws, a little pickaxe.
**Question:** where do I dig, and where do I come up? **Weakness:** her mound shows you where she is, and she cannot cast underground. **Second decision:** underground is safe, but she can only come up once.

| Key | Spell | CD | Rule | Answer, checked |
|---|---|---:|---|---|
| P | Dig Site | | Holes she digs last 8 s (3 at most). Anyone who walks in falls: rooted 0.8 s, and -15% speed for 2 s climbing out. She walks across hers | Walk round them. Knock her into one |
| Q | Claw | 3 | A 2.5 m swipe: 45 | Stay out of 2.5 m |
| W | Dig | 7 | A hole at a spot (6 m), opening after 0.7 s, 1.5 m | Step off: 0.63 s with reaction |
| E | Tunnel | 10 | She dives (0.3 s) and moves underground for up to 1.2 s at +40%, a mound on the surface, cannot be hit, then pops up: 40 and a 0.5 s knock-up within 1.5 m | Watch the mound: step off as it slows. She cannot cast down there |
| R | Sinkhole | 24 | A 4 m pit at your spot (9 m, sight), 1.3 s warning: rooted 1 s and 90 | Leave: 1.25 s from the centre, inside the 1.3 s, or stand by cover at its edge |

**Engine:** reuses the old `burrow.ts` idea for moving underground.

---

## Build order

The first three, then by engine cost. Each hero: model, kit, effects, spell check, sheet, commit per group.

1. Bram and Gerald, Silvane, Hank.
2. Professor Puff, Sir Whiskers, Mum, Big Yoko, Madame Cleaver, Mr. Ledger, Referee Whistler.
3. Gus, Bo, Grandma Ironknit, Mabel, Pip, Barry Cloudsley, Wick, The Great Zambini.
4. Pim and Pom, the largest.

## Known gaps

- These answers have not had a second reader. Two look tight and need checking when built: Gus's Flood and Mabel's Sinkhole.
- With 39 heroes the hero picker and the Heroes table get long. Both still work, and the table scrolls.
- CPU play: each hero's mechanic needs a simple CPU rule, or the CPU will play them badly.
