---
title: How the game can tell the story
tags: [lore, codex, story, plan]
updated: 2026-11-16
---

# How the game can tell the story

*A plan, with the texts ready to wire in: cards at the Climb's doors and after its rulers, lines for the Climb's people, the Raid's intro, the
Trials and the Ring.* · [The Long Noon](README.md) · [The canon](../canon.md)

Nothing here is built. The Codex already carries the whole story as its own book (*The Story*). This page is for a later job that wires the
story into the modes themselves, so a player who never opens the Codex still learns it, a piece at a time, in the order the Story tells it.

## The headline

**The Climb tells the story as you climb it.** A short card at each chapter's door says where you are and what the Tower did there; a line after
each ruler says what it was; the Climb's people say a little more each chapter; the five crowns each end on a line that moves the story on. The
Raid's hall gets one card that says what Noonfall is and why winning brightens the morning. The Trials get one line. The Ring gets a pool of
loading lines. None of it stops play for more than one tap.

## Rules for the texts

- **Short.** A door card is at most 60 words, a ruler line one sentence, a person's line at most 25 words. Read on a phone at 375 px without scrolling.
- **One tap to close**, never a wall: a card shows over the floor's first second and closes on a tap or by itself after 8 s.
- **In order.** The texts are written for the year 100: they say what the Dial is learning, not the ending. The ending is in the Codex.
- **Only the forty.** A hero not in the game yet is never named in game text (the parent's ruling, 2026-11-15); these texts use titles or
  nothing. When a hero ships, a line may name them.
- **Once each.** A door card shows the first time a player reaches that door, and again from a "Story" button on the floor's map; a ruler line
  shows on that ruler's first fall.
- **Where they could live:** one file, `src/tower/world/story.ts`, a table keyed by floor and by person, read by the floor's start, its ruler's
  fall and its people's talk. (A suggestion for the later job; this job changed no file under `src/tower/`.)

## The Climb: the cards at the doors

Each shows at the start of a chapter's first floor (1, 11, 21, 31, 41). The three last are for chapters not built yet.

**The Sea (floor 1).** *The first floor of the Tower is a morning a hundred years old: Sallowmouth, the morning after the Fall, with the sea in its
streets and still rising. The Tower took this hour and everyone who stood still in it. The woman ringing the bell does not know the night was a
hundred years long.*

**The Wood (floor 11).** *The Walking Wood in its first year of walking. The Tower drew it east through its roots, and kept the year. At the forest's
heart a girl's oak drinks from the Tower's own root.*

**The Sands (floor 21).** *The Storm Canyon on the night of the great storm, the night the young king took the crown. The caravan towns outside were
dug out in the spring and found empty. Their people are here.*

**The Deep (floor 31).** *The far halls of the Deep on the night their crystals went out. The miners are still standing where the light left them.
Something is digging up from below.*

**The War (floor 41).** *The Field of Banners on the last night of the war. The battle of the Ninth Field has not been fought here, and while the
Unmaker stands at the Field's edge, it cannot end.*

*(Not built yet.)* **Frostfall (the Long Hold).** *The winter after the Fall that did not end until the next summer. The Winter Warden held the lake,
and the Tower passed her by. It took the moors, and the villages she was holding it for.*

*(Not built yet.)* **Aubade (at dusk).** *Aubade at dusk on the day of the Fall. The families of the choir are waiting at the foot of the Dawn Road
for a hundred singers to come down. Every bell in the city is ringing.*

*(Not built yet.)* **Gloaming (the Long Dusk).** *The year without a day. The old are dying in their beds and cannot finish. This is the age the Court
of Dusk called the Dial's true one.*

## The Climb: the crowns

Shown when a crown falls.

- **Floor 10, the Sun Warden (the Tower's keeping of him).** *He went down on one knee, as he was in the instant the Tower took the sun, and his dial
  struck nine times. He said one line in a tongue nobody knows. It is the first line of a verse only one singer alive remembers.*
- **Floor 20, Ash and Ember.** *The sun's two last sparks, as the Tower kept them the instant they fell. "Not yet," said the flame. "When the hand
  opens."*
- **Floor 30, the Heart of Noon.** *The Tower's keeping of the sun's heart in the moment it fell. Weighed against a feather, it is heavier: with grief,
  not with sin. It was not come home. It was taken.*
- **Floor 40, the Sun Warden (himself).** *This time it was not the Tower's keeping of him. He came down to see who was coming. "I cannot tell you what
  it is," he said. "The word will not let me."*
- **Floor 50, Ash and Ember.** *"The hand is opening," said the brute of basalt. "Come up when it opens all the way. Bring the rest." Above them a stair
  goes up into gold.*

## The Climb: a line after each ruler

Shown on a ruler's first fall, under its name. Floors 10, 20, 30, 40 and 50 are the crowns, above.

| Floor | Ruler | Line |
|---|---|---|
| 1, 2 | The Drowned Admiral | He ordered every ship to ride out the strange tide at anchor. He still believes it was the right order. |
| 3 | The Salt King | He cheated every buyer by a fingertip. The sea made him its own, and he weighs climbers now. |
| 4 | Mother of Wrecks | She lit false lights the night before the water came, and lights them still. |
| 5 | The Tide Judge | He set the tide as the drowned debtors' sentence. Now the tide is his. |
| 6 | The Pearl Tyrant | He drowned holding the strongbox, and the pale diver serves him still. |
| 7 | The Bell Below | The harbour's old cracked bell, ringing underwater. What answers it is the new bell, above. |
| 8 | The Lantern Leviathan | It followed the lamps into the harbour on the morning the water rose. |
| 9 | The Gull Queen | She fed the gulls from her hand for forty years. They would not leave her. |
| 11 | The Elder Root | A girl planted this oak at twelve. The Tower drew it here and set it to drink from its root. |
| 12 | The Moss Warden | The Moot's first warden. In the Tower he guards the Wood from everyone. |
| 13 | The Thorn Mother | She wove hedges to keep the folk out. In the Tower she weaves them round everything. |
| 14 | The Antler King | He leads the bark hounds, and the hunt has not ended in a hundred years. |
| 15 | The Hollow Elder | The oldest walking tree, with a light inside it that is not a fire. |
| 16 | The Briar Witch | She sold curses at the Wood's edge, and her own briars took her in the first year. |
| 17 | The Lantern Root | Its amber light lures the lost, and the Wood had a great many lost that year. |
| 18 | The Grey Oak | The Moot's oath-tree before the Fall. It would not fall, so it walks. |
| 19 | The Mire Heart | A bog that woke with the Wood and swallows what walks across it. |
| 21 | The Scarab Colossus | The Dune folk say she rolled the sun across the sky once. She has a right to be angry it is gone. |
| 22 | The Scarab King | Her son, gilded, worshipped by raiders who are still waiting for a caravan. |
| 23 | The Dune Colossus | Made by the first king to guard the Brass Road. It walks with the dunes. |
| 24 | The Brass Sphinx | Her riddle: what holds the noon and has no hands? The answer is the Tower, and it has one. |
| 25 | The Glass Serpent | Born the day the sun's heat struck the sand. |
| 26 | The Mirage Lord | A prince who walked onto the Glass Flats to be alone, and became a mirage of himself. |
| 27 | The Sand Tyrant | He sold water by the cup in a drought, and drowned in sand. |
| 28 | The Red Jackal | He rode for the crimson banner and took his share of the sun. |
| 29 | The Sun-Eater | He tried to swallow a piece of the fallen sun to become it, and burns from inside. |
| 31 | The Prism Mother | What the Deep's light becomes with nowhere to go. |
| 32 | The Hollow Queen | An Old Mother of the mole-folk who dug too deep alone. |
| 33 | The Lamp Warden | He swore the lamps would never go out, and went out with them. |
| 34 | The Glass Abbot | He cut his own eyes into crystal to see in the dark. |
| 35 | Mother of Echoes | She answers every step a third time. |
| 36 | The Seam King | He worked his miners in the dark until the seam went out. |
| 37 | The Blind Cantor | One of the choir the Tower took. "She did not drop it," he says. "It took us because we were in step." |
| 38 | The Gem Tyrant | He hoarded the Deep's light and was buried by it. |
| 39 | The Drowned Lantern | A lamp that fell into the black water and kept burning under it. |
| 41 | The Last Marshal | He led the azure, and the Tower took him from his tent the night before the battle. |
| 42 | The Iron Marshal | He held the siege line through the Winter of Mud. |
| 43 | The Siege Lord | He built the crimson's engines for pay, and stayed to see them fire. |
| 44 | The Ashen General | He died in the first battle and has led the dead since. |
| 45 | The Banner Knight | He swore the banner would never touch the ground. |
| 46 | The Crow King | A lord of Gloaming who rode to the crimson for a share of the sun. |
| 47 | The Black Herald | He carries King Orlan's last orders. Nobody has let him deliver them. |
| 48 | The War Drummer | A boy of the azure whose drum still beats the advance. A cook once fed him. |
| 49 | The Grey Captain | He deserted on the night before the Ninth Field, and has regretted it on every floor. |

## The Climb's people

Two lines for each, the first for a player's first chapters, the second once that player has beaten the chapter's crown. The rival and the
gatekeeper are heroes, and say their heroes' own lines.

**The Sea**
- **The Bell-Warden.** "Have you seen my husband's boat? I'll ring until it's in." / "Is it still morning? It has been morning a very long time."
- **The Net-Father.** "Mind the nets. I know every one of the drowned by name." / "The nets come up heavier every tide. Things from deeper than we fish."
- **The Lamp-Bearer.** "The lamps keep going out. A boat can't find the harbour in the dark." / "Out past the lamps the sea goes on, and on, and stops."
- **The Tide-Broker.** "Old coin. Good coin. A hundred years old? Don't be silly." / "You pay in obols. Nobody should know what an obol is in here."
- **The Coral-Pedlar.** "Charms against drowning. I don't wear them. Never have." / "My charms don't work in here. Nothing ends in here."

**The Wood**
- **The Moss-Abbess.** "Hush. I sound the horn at dusk to help the Wood sleep." / "There's an old woman on my step with my face. She helps me with the horn."
- **The Path-Lighter.** "The paths move while you're on them. Follow the lights." / "The Wood is walking toward something. It never gets there."
- **The Kiln-Mother.** "Charcoal for the forge villages, if the Wood stays put long enough." / "Something under the roots is drinking. You can hear it at night."
- **The Amber-Seller.** "Amber from the hive-trees. The swarm doesn't mind. Much." / "The amber has flowers in it I've never seen in the Wood."
- **The Charm-Pedlar.** "A charm against getting lost? In here? You'll need two." / "Every charm I sell comes back to me. Nothing leaves this year."

**The Sands**
- **The Star-Reader.** "I climb the beacon every night to read the stars through the storm. I have never seen one." / "Is it true there are stars outside? Many?"
- **The Storm-Counter.** "Ninety-one strikes since midnight. It is still midnight." / "The storm has the same lightning every night. Same order. Same count."
- **The Beacon-Keeper.** "Keep the fire lit, the caravan will find us." / "There is no caravan, is there."
- **The Silk-Merchant.** "Silk from Tamerit, for the queen's wedding. Which queen? The queen." / "They say the young king took the crown tonight. They say."
- **The Glass-Seller.** "Glass from the Flats. Still warm. The Father is in it." / "The glass is cooling. I have never known it cool."

**The Deep**
- **The Echo-Hermit.** "Listen. The rock answers. Something on the other side is digging up." / "It has stopped digging. It is waiting."
- **The Candle-Crowned.** "We wear our light. The crystals went out an hour ago." / "An hour. It has been an hour for so long."
- **The Ferryman.** "I bring the living back. Not the dead. That is someone else." / "More of you are going home than come up. That is new."
- **The Crystal-Seller.** "Dead crystals, cheap. They held the light one night and let it go." / "Let it go. Hm. I'd like to learn that."
- **The Firefly-Seller.** "A jar of light for the dark halls. They don't last." / "They last in here. Everything does. It isn't kind."

**The War**
- **The Herald.** "I speak for both banners. Will you carry a truce? Nobody listens." / "A horn, they say. A cook, and a horn. Then maybe."
- **The Turncloak.** "Eight lives for two banners. The helm stays on." / "My brother wears a cape now, they tell me. Red. Short. Ridiculous."
- **The White Sister.** "Crimson or azure, lie down, I mend both." / "I was born in Lowlight. I'd like to see the bells again."
- **The Camp-Mother.** "Sit. Eat. A cook called Cleaver taught me. It doesn't work in here." / "It needs a Truce, she says. We never had one."
- **The Quartermaster.** "Stores for whoever pays. The war's good business." / "Business is slow. Nobody's sure the war is on."

## The Raid: Noonfall

**The hall (first visit).** *Noonfall, under the Ring's west tunnel: the hall between the Sun Court's fallen stone and the Cinder Pit, with the Hall
of Noon beneath. The sun's pieces are here, and they are not free: the Tower bound them to guard the Heart it drinks. Each time a pair beats the Heart,
the next morning's light is a little brighter.*

**Before each boss.**
- **The Sun Warden's sentinel.** *Stone and gold round a small trapped sun: the Tower's likeness of its keeper, set to guard the court.*
- **Ash and Ember.** *The sun's two last sparks, up out of the Cinder Pit. Bound to fight whatever comes near the Heart.*
- **The Heart of Noon.** *The fallen sun's heart. The Tower has drunk its light every morning for a hundred years. It is wounded, and furious.*

**After a full run.** *The Hourkeepers will measure it at dawn: a little more light through the Tower tomorrow, for a day, because for a day less of it
was drunk.*

**A higher tier offered.** *Again. The Tower drinks every morning.*

## The Trials

**The Trials' door (first visit).** *Off the Ring's west tunnel a stair goes up through rooms that are never the same two weeks running. The champions
guarding them are the Tower's echoes of the Ring's own: it keeps one of every hero who ever fought here, and it is weighing them.*

**A guardian floor.** *An echo of {hero}, kept from a duel in the Ring and set here to see whether you are better.*

## The Ring: loading lines

A pool for the duel's loading screen, one at random.

- The Ring stands in the Tower's shadow. The Tower watches every duel, and keeps an echo of every champion.
- The Truce was sworn in the Tower's shadow, and the Tower keeps what is sworn there. The fourth clause is cut in its gate.
- The Mountain's circle is where the Tower's shadow stopped at the Fall. He has not stepped out of it in a hundred years.
- The Arbiter swept this sand on the day of the Fall. His father was in the market. The market is in the Tower.
- The Tally's page for the duel of year 90 was blank for ten years. Then the winner wrote on it, in chalk.
- Every duel ends at the Truce Table. Whoever eats there may not strike in anger outside the Ring.
- A hundred doors lie under the stands. Nobody built them. The Doorwarden keeps them, and while he keeps them, the Tower cannot use them.
- The Hymn of Noon held the sun to the Tower. Only its last verse made it let go.
- The light rises from the Heart through the Tower every morning, and the Tower drinks a little of it. That is why the day pales.
- The sun fell because the Tower took it.

## What the later job should check

- Every text above on a phone at 375 px, in the game's own card, in the floor's camera.
- No unreleased hero named: run the same check `lore-codex.py` runs on the Codex (`_NAMES_RE`) over the new table.
- A News item when the cards go live.
- The Story book's chapters 8 to 14 could unlock in the Codex as a player beats the Climb's crowns (Sea crown: chapter 8, and so on). The
  Codex shows them all today.
