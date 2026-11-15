---
title: The lore of the Dial
tags: [lore, world, factions, heroes]
updated: 2026-11-15
status: first draft, written for the user to read and change; nothing in the game uses it yet
---

# The lore of the Dial

This file is the source. The page `docs/lore/index.html` is made from it by
`python pipeline/tools/lore-page.py`, which also checks it: every hero in exactly one faction or among the loners, two to four ties
each, every tie shown on both sides, every legend 80 to 150 words. Edit here, run the script, look at the page.

How it is written: `## Heroes` has one `### Name | title | theme | faction | pronoun | status` block per hero, then the line they would
say after `>`, then the legend. `## Ties` has one line per tie: `A ~ B` for a tie that is the same both ways (friend, rival, sworn
enemy, old flame, sibling, comrade), `A > B` for one that reads differently from each side (teacher, owes, maker, guardian), and a `!`
in front for the strongest, which the page draws.

## The world

Arena of Kits takes place on **the Dial**, a round land in an Outer Sea, laid out like a sundial. At its centre stands **the Tower**,
which scholars call the Gnomon: the pin of the sundial. Once the sun walked the sky above it, and the Tower's shadow swept round the
Dial and told every realm its hour.

The realms lie around the Tower like the hours on a dial. At the top, the white north of **Frostfall**, where the stars turn round
the pole. In the east, **Aubade** on the morning cliffs, and below it **the Sands**. In the south-east, **the Drowned Coast** and the
broken sky towers of **the Spires** standing in the sea. In the south, **the Deep** under the southern hills. In the south-west, **the
Field of Banners**. In the west, **the Walking Wood**. In the north-west, **Gloaming**, where the light fails first.

## The Noonfall

A hundred years ago, at noon on a midsummer day, the sun stopped over the Tower, cracked, and fell. Nobody agrees why. Its heart fell
at the Tower's foot and still burns beneath it in the Hall of Noon: **the Heart of Noon**, the fallen sun. Its two last embers fell
into the Cinder Pit, where they burn as **Ash and Ember**. Its keeper, **the Sun Warden**, stayed at his post in the Sun Court at the
Tower's top, and his great dial still strikes.

Its heat lifted the sea over the Drowned Harbour. Its light ran down into the crystals of the Deep. The Sands say it fell into their
dunes, and the sand is still warm. Where it had hung, the sky is torn: **the Tear**, black with a burning pink edge, and through it
came the Unmaker.

A day still comes. Each morning a thinner light rises from the Heart through the Tower, and the realms live by it. But it is a little
paler every year, the hours slip, and the weather keeps no appointments.

The slipping hours have a strange gift. Everyone who was alive on the day of the Fall, or born in the week after it, ages slowly,
about a year for every five; the Hourkeepers call them **the Noon-touched**. That is why a dancer who was a girl on the day of the
Fall, a boy who swept the Ring's first sand and a countess who saw the light leave her lands still walk the Dial a hundred years
later, and why the young of the Dial listen to them about the sun. Everyone on the Dial wants something done about the sun:
hang it again, keep it down, burn it, take it, or understand it first.

## Why heroes come to the Ring

In the first years after the Fall the realms went to war over the sun's pieces. The war was fought on the Field of Banners, crimson
against azure, until the field was mud and the king who began it was buried. It would have gone on until the Dial was ash. Instead the
realms swore **the Truce of the Ring**: no realm makes war over the sun again; every quarrel is settled by champions, one against
one, in **the Ring** at the Tower's foot; and the Tower's gate opens only for a champion of the Ring.

That is the Arena. Each duel settles a debt, moves a border, wins a right or answers an insult, and every win is a step toward the
right to climb. Most heroes also bring a reason of their own, and a rival they would very much like to meet in the Ring. The Truce
holds duels in the realms too, on fields it has blessed: the Drowned Harbour, the Verdant Glade, the Sandstone Canyon, the Crystal
Cavern, the Fallen Battlefield, Frostfall Lake, the Night Temple, the Sky Ruins and the Ember Caldera.

## The Tower and the Climb (a proposal)

*The Tower's own story has not been chosen yet (`pipeline/designs/tower-50.md`). This is one way to tell it, built on "a Tower that
collects worlds", for the user to keep or change.*

Since the Fall the Tower has been taking the realms in. Its floors hold them as they were at the hour it took them: **the Sea** as the
Drowned Harbour on the morning the water came, **the Wood** walking, **the Sands** and their storm, **the Deep** without light, and
**the War** on the Field of Banners, where the two armies still fight because nobody inside has told them it is over. The people of
the floors (the Bell-Warden, the Moss-Abbess, the Star-Reader, the Echo-Hermit, the Herald and the rest) were there when the Tower
took them, and they still keep their posts. Each floor's ruler is the worst thing its realm had.

The crowns of the chapters are the sun's own: the Sun Warden on the tenth and fortieth floors, Ash and Ember on the twentieth and
fiftieth, and the Heart of Noon itself on the thirtieth. Above the fiftieth floor is **the Noon Seat**, where the sun rested at noon.
It is empty. Whoever reaches it decides what hangs there.

Each chapter's gate is held by a hero of that realm: Marin at the Sea, Fenna at the Wood, Sefu at the Sands, Opaline at the Deep. At
the War the gatekeeper is Oblivion, because that endless war is the one thing on the Dial it has truly unmade.

## Places

- tower | The Tower | 0 | truce | The Gnomon, on the crater of Noonfall: the Ring at its foot, the Hall of Noon and the Cinder Pit beneath, the Sun Court at its top, the Tear above
- frostfall | Frostfall | 12 | hourkeepers | The observatory and the frozen library on Frostfall Lake, under the pole star
- aubade | Aubade | 1.6 | noonsworn | The white city on the morning cliffs, where the light comes first
- sands | The Sands | 3.6 | dune | Tamerit, the city of the Throne, between the Glass Flats and the Storm Canyon
- coast | The Drowned Coast | 5.0 | windward | The Drowned Harbour, the Lantern Coast, and the Spires standing in the sea
- deep | The Deep | 6.6 | underforge | The halls under the southern hills, the Crystal Cavern, the great forge in the Ember Caldera
- banners | The Field of Banners | 8.0 | none | Where the War of the Banners was fought, crimson against azure
- wood | The Walking Wood | 9.4 | greenwood | The Moot under the Antler Glades, the hive-trees, the high pastures
- gloaming | Gloaming | 10.8 | dusk | The castle-city round the Night Temple, above the ossuaries

## Factions

### truce | The Truce of the Ring
- home: The Ring at the Tower's foot: its stands, the Hundred Doors beneath them, the Truce Table and the Tally-house
- colours: #1a1a1a black, #f2f2f2 ivory, #6a2a2a oxblood, #d9c27a gold
- sigil: A ring with the Tower's shadow standing across it
- members: Referee Whistler, Mr. Ledger, Wick, Pip, Madame Cleaver, Big Yoko, Morwen, Kessa
- wants: Every quarrel in the Ring and no army on the Dial; the Tower's gate opened only to a champion who earned it

The Truce believes a quarrel settled in the Ring is a war that was not fought. It serves the rules, not a side, and it is the
reason the Dial still has realms instead of one long battlefield. Its officers are the Ring's own people: the Arbiter who calls the
rules, the Tithe-Keeper who writes down every debt, the Doorwarden whose doors bring champions in from every realm, the courier who
carries challenges, the cook whose table ends every duel, the Mountain who stands in the first ring, the witch who salts its edge and
the warden of the prison under the sea where oath-breakers go. Every realm needs them, and none of them quite trusts them.

### noonsworn | The Noonsworn
- home: Aubade, the white city on the morning cliffs, whose bells ring the thin sun up every day
- colours: #f2b83c dawn gold, #efe6d2 ivory, #ff7b3a ember, #e04aa8 hymn rose
- sigil: A sun disc whose crack is mended in gold
- members: Auriel, Anka, Cantor, Opaline, Campana, Orren
- wants: To hang the sun again over the Tower: a champion of theirs to win the climb and carry the Ember of Aubade to the Noon Seat

The Noonsworn believe the sun can be hung again, and must be. They keep the oath of the dawn, the last verse of the Hymn of Noon,
the bells that call the morning, and the Ember of Aubade, a piece of the old sun's light kept in a lantern since its last noon. They
are warm, brave and certain, and certainty makes them poor at listening: to the Court of Dusk, who will burn under a new sun, to the
Underforge, who want the sun's fire for themselves, and to the Dune Throne, whose king says the sun is his.

### dusk | The Court of Dusk
- home: Gloaming, the castle-city round the Night Temple in the north-west, above the ossuaries
- colours: #8c0f22 crimson, #6a2ec0 violet, #cfe6ff mirror silver, #ece4d0 bone
- sigil: A crescent moon held in a hand mirror
- members: Vesper, Silvane, Mortis, Nyx, Mum, Kohaku, Corbel
- wants: The Noon Seat kept empty: no new sun to burn them, and their roads, their dead and their secrets kept

When the sun fell, its light left Gloaming first and came back last, and in that long twilight the Court of Dusk came into its own.
The Court believes the dusk is the Dial's true age and that the night has as good a claim as the day. Its people are not monsters,
or not all of them: they keep the night roads safe, bury the dead, and shelter whatever the daylight hunts. But a new sun would end
them, and they will do a great deal to keep the Noon Seat empty. They keep the letter of the Truce and very little of its spirit.

### greenwood | The Greenwood Moot
- home: The Walking Wood in the west; the Moot meets under the antlered trees of the Antler Glades
- colours: #4caf50 leaf, #e8dcc0 bark cream, #f0b020 wax amber, #3f6b3a pine
- sigil: A leaf with a spiral vein, crowned with antlers
- members: Fenna, Hank, Bo, Pim and Pom, Sirix, Vela, Arden
- wants: The Tower's roots cut, and the Wood left to walk where it likes, as long as it does not walk over the villages

The Walking Wood began to walk on the day of the Fall, as if to look for the sun, and the Moot is the people who live in it and
around it: wardens, woodcutters, herders, hunters, hive-keepers, a moth priestess and two changeling children. They believe the Tower
drinks the Dial, and that every floor it fills is a realm it has taken. They argue among themselves about almost everything (Fenna
grows trees, Hank fells them) and agree about the Tower. They distrust the Underforge, whose axes and mines eat the Wood's edge, and
they hate the Court of Dusk, whose dead are buried in their soil.

### windward | The Windward
- home: The Spires, the broken sky towers standing in the sea off the Drowned Coast, and the harbour towns behind them
- colours: #1f9fd6 sea blue, #4aa8ff storm blue, #eef3f6 cloud, #7fe6c8 wind mint
- sigil: A wave curling up into a cloud
- members: Marin, Kaia, Zephyr, Barry Cloudsley, Professor Puff, Lian, Gus
- wants: The sky mended, by whoever can do it, and the roads of the sea and the wind kept open

The Windward believe in what works. Since the Fall the weather has no master, the sea stands higher and the winds keep no seasons,
and someone has to read them and sail anyway. They are sailors, dancers, storm callers, augurs, aeronauts and kite fliers, and the
keeper of a sea temple, and they are the most practical people on the Dial. They will back any faction that can mend the sky, and
they quarrel with the Dune Throne, whose storms come off the Sands and whose king would like the sea to belong to someone.

### underforge | The Underforge
- home: The Deep under the southern hills: halls lit by crystals and forges, the great forge in the Ember Caldera
- colours: #ff5a12 forge orange, #d9773a copper, #c9b48a limestone, #ffcf5a lantern gold
- sigil: An anvil under a lantern
- members: Brannoc, Ada, Bram, Mabel, Itzel, Hesk, Tova
- wants: The Heart of Noon left below and its fire brought up through the rock: a sun underground, lighting the Deep and warming the Dial

The Underforge believe the fallen sun is the best fire the Dial ever had, and that it fell to them: its heat rises through the Ember
Caldera, its light lies in their crystals, and they were the first to see it come. They are smiths, inventors, masons, miners, a herald
of black glass, a golem-maker and a sapper, and they build. They forge the Truce's iron and trade with the Dune Throne, and they
quarrel with the Noonsworn, who want every drop of that light carried up into the sky, and with the Greenwood, who want them to stop
cutting.

### dune | The Dune Throne
- home: Tamerit, the city of the Throne in the eastern Sands, between the Glass Flats and the Storm Canyon
- colours: #c8913f ochre, #e8d8b4 sandstone, #3fd4c8 turquoise, #3fbf9a verdigris
- sigil: A crook across a sun half sunk in a dune
- members: Sefu, Vitriol, Lithea, Nebet, Sahar, Ramet
- wants: The Noon Seat for their king: Sefu as the new sun, if the climb can be won

The kings of the Sands always called the sun their father, and the Sands say it fell into their dunes on purpose. The Dune Throne is
the oldest court on the Dial: a pharaoh, his embalmer, a veiled priestess of the tombs, the judge who weighs the hearts of the dead,
an archer of the mirage and the captain of the lion at the gate. They want the sun's seat for their king. The Noonsworn call it
heresy, the Windward call it weather, and the Court of Dusk, who would rather have a king in the Seat than a sun, call it an alliance.

### hourkeepers | The Hourkeepers
- home: Frostfall, the observatory and the frozen library on the lake at the top of the Dial, under the pole star
- colours: #d4ff5a dial chartreuse, #3a5ae8 ink blue, #5a3fc0 night violet, #e8e0c8 chart parchment
- sigil: An hourglass set in a four-point star
- members: Tempo, Shiori, Lyra, Grandma Ironknit, Isolde, Saga, Thessa
- wants: The hours running true again: a sun over the Tower, the Tear sewn shut, and a record of everything kept until then

The Hourkeepers believe nothing can be mended that is not first understood, and that the Dial's real wound is time: since the Tower's
shadow stopped, the hours slip. They are keepers of clocks, calligraphers, star readers, a fate-spinner, a warden of the cold, a
dancer of the northern light and a seamstress of the sky. They lean toward the Noonsworn, because the shadow only falls when a sun
hangs above the Tower, but they want to know why it fell before anyone hangs it again. The Court of Dusk would keep the hour stopped,
and the Hourkeepers will not allow it.

### loners | Loners
- members: Oblivion, Sir Whiskers, The Great Zambini, Ostrel, Asenet

Five heroes belong to no faction. Oblivion wants no world at all. Sir Whiskers has served too many courts to join another. The Great
Zambini has joined all of them, in writing. Ostrel carries every faction's dead, and so belongs to none. Asenet, the Uncrowned, was
driven out of the Sands and is welcome nowhere else.

## Peoples

Twelve peoples live on the Dial (since 2026-11-15: the user found the heroes "all the same, like human"). Each hero has a
`- people: <id>` line, with a kin after a `|` where it matters (a Briarkin court, a Fallborn kind). The depth is in the codex,
`docs/lore/codex/peoples/`; the revamp plan that brings the figures to their peoples is `docs/lore/codex/revamp.md`.

### aubade | Aubade folk | human
- home: aubade
- look: Tall, warm golden-brown skin, long dark-gold to black hair bound with gold thread; the dawn line, a thin gold tattoo from brow to nose, on the sworn
- life: About eighty years

The people of the morning cliffs, who rang the sun up every day with the bells and sent a choir of a hundred to sing the Hymn of
Noon at the Tower's top. The choir did not come home from the Fall, and the city has been in mourning, and certain, ever since.

### dune | Dune folk | human
- home: sands
- look: Lean, dark bronze to deep brown skin, black hair shaved or in fine braids, kohl to the temples, layered linen with turquoise and gold
- life: About seventy-five years

The people of the Sands and the oldest court on the Dial. They call the sun the Father and say it came home into their dunes, which
are still warm, and that it will rise again in a king.

### gloaming | Gloaming folk | changed
- home: gloaming
- look: Narrow and tall, pale skin with a blue-grey cast, dark lips, black, silver or violet hair; eyes that shine back light
- life: About ninety years

A people of the north-western hills whom a hundred years of dusk changed: their eyes shine in the dark, they burn at noon, and they
live by night. Mirror-makers, vintners and keepers of the night roads, and a nobility that became the Court of Dusk.

### north | Northerners | human
- home: frostfall
- look: Broad and tall, deep brown to umber skin, hair white by thirty in many thin braids, star lines tattooed on the jaw and hands; the lake-born frost-pale and white-haired
- life: Often past ninety

The people of Frostfall, under the pole star, who measure everything and write it down. Their observatory saw the Fall better
than anyone; the lake-born families of Frostfall Lake have always given the Dial its Winter Wardens.

### coast | Coast folk | human
- home: coast
- look: Wiry, sea-tanned, salt-bleached or sea-green hair, tide lines tattooed round the forearms, sea-glass in the ears
- life: About seventy years

The people of the Drowned Coast and the Spires. The sea rose over their great port on the day of the Fall and the weather has had
no master since, so they became the Dial's readers of the sky, and sail anyway.

### kiln | Kilnborn | changed
- home: deep
- look: Short and broad, ash-grey skin, pale amber eyes, short grey hair or braided beards; ember seams at the knuckles and throat on those who work the fire
- life: About sixty-five years

The hill people of the south, who moved down to the heat when the fallen sun's fire came up through their rock. Their skin went
grey as ash within a generation. They call the Fall a gift, and they build.

### wood | Wood folk | changed
- home: wood
- look: Ruddy to bark-brown skin, moss-green eyes, braided hair; those sworn to the Moot grow horns, antlers in the Wood and ram horns in the hills
- life: About seventy years

The woodcutters, herders, hunters and hive-keepers of the Walking Wood. Since the Wood began to walk they follow it, and those who
swear themselves to it grow horns within a year.

### mole | Mole-folk | other
- home: deep
- look: A mole's head on a short, stout frame: velvet dark fur, a long muzzle, small eyes, broad hands with long gilded claws
- life: About sixty years

The Deep's first people, who call themselves the Loam. They dug the deepest seams nine hundred years before the Fall, and were the
first to see the sun's light run into the crystals.

### ninefold | The Ninefold | other
- home: banners
- look: A great cat's head, lynx or lion, on a tall lithe frame; fur at the throat and hands; a count of nine worn on the costume
- life: About eighty years, if all nine lives are kept

Cat-headed knights with nine lives, who swore their first oath at the Keep of Nine on the Field and have served every court since.
Fewer every generation: the keep has eleven knights now.

### briar | Briarkin | other
- home: wood
- look: Pointed ears, eyes of one colour with no white, skin in forest colours; small or tall as they please; each court its own sign (moth wings, a fox's mask and tail, chitin)
- life: They do not age; they fade when forgotten

The fae of the Walking Wood, in their courts under the Underbough. They will not lie, will not cross salt, and will not give their
true names. Since the Fall some of their children are born two for one.

### longdead | The Long Dead | other
- home: gloaming
- look: Skin like old vellum drawn on bone, or bare bone; the brow, jaw and knuckles showing; eyes of cold fire
- life: Until their purpose is finished

The dead whose purpose would not lie down. Since a pact four and a half centuries old they keep the ossuaries under Gloaming, and
keep their promises absolutely, because a broken one would end them.

### fallborn | The Fallborn | other
- home: tower
- look: Three kinds: the Embers, warm skin glowing at its edges and hair like flame; the Cast, a matte black body with no face; the Unmade, a shape of black cracked with pink
- life: Not born, not ageing

Not a people as the others are: those the Noonfall made or let in. The Embers are sparks of the sun that took a shape, the Cast are
shadows thrown by its last light that walked away, and the Unmade came through the Tear.

## Faction ties

- truce | hourkeepers | friends | The Hourkeepers keep the Truce's records, and the Truce keeps their observatory out of every war
- truce | windward | friends | The Windward's ships carry the Ring's champions, and Gus's temple lends it Marin's water
- truce | noonsworn | friends | The Noonsworn believe in oaths, and the Truce is the biggest oath on the Dial
- truce | underforge | friends | The Underforge forged the Ring's iron and the Gaol's chains, and is still paid for both
- truce | dusk | rivals | The Court keeps the letter of the Truce and nothing more; the Arbiter watches its champions twice
- noonsworn | hourkeepers | friends | Both want the sun back over the Tower; the Hourkeepers want to know why it fell first
- noonsworn | dusk | enemies | A new sun would burn the Court of Dusk, and the Court would rather the dawn never came
- noonsworn | dune | rivals | Both claim the sun: the Noonsworn for the sky, the Throne for its king
- noonsworn | underforge | rivals | The Noonsworn would carry the sun's fire up; the Underforge would keep it down and use it
- dusk | dune | friends | An alliance of convenience: better a king in the Noon Seat than a sun
- dusk | greenwood | enemies | The Court's dead are buried in the Wood's soil, and Mortis raises them
- dusk | hourkeepers | enemies | The Court would keep the hour stopped at dusk for ever
- greenwood | windward | friends | Wood and weather: the Moot's trees break the Windward's storms, the Windward's rain feeds the Wood
- greenwood | underforge | enemies | Axes and mines eat the Wood's edge, and the Wood's roots break the Deep's halls
- windward | dune | rivals | The Sands' storms come off the dunes, and their king would like the sea to belong to someone
- underforge | dune | friends | Glass and gold for iron and fire, on the Brass Road, for a hundred years

## Heroes

### Referee Whistler | the Arbiter | referee | truce | he | roster
- people: kiln
- home: tower | The Ring, in the Arbiter's box over the sand
- age: Looks 34. He was 14, sweeping the Ring's sand, when the sun fell (Noon-touched).
> "That is a dash. I saw it. Everyone saw it."

Whistler was a mason's boy who swept the Ring's sand the year the Truce was sworn. He watched the first champions cheat, all of
them, and wrote down how. The founders laughed, then made him Arbiter, and he has not laughed since. He wears the black and ivory
tabard so that no realm can claim his colour, and his silver horn is the one sound both armies of the Banners still stop for. His
sigil tablets carry the Truce's rules: when he holds one up, that rule binds whoever stands under it. He does not fight to win. He
fights because a rule nobody enforces is only a rumour, and he has a long list of rumours to put down.

### Mr. Ledger | the Tithe-Keeper | ledger | truce | he | roster
- people: longdead
- home: tower | The Tally-house under the Ring's stands
- age: Dead some 160 years. He died at his desk sixty years before the Fall, in the middle of a sum, and got up to finish it.
> "No, no. Don't pay now. I insist."

Every duel in the Ring settles a debt, and somebody has to write it down. Mr. Ledger has kept the Tally since the day the Truce was
sworn: who owes what, to whom, and at what interest, in a great red book chained to his wrist so that nobody can borrow it. He is
one of the Long Dead: vellum skin tight on the bone, and two embers where his eyes were. The realms fear him more than any champion, because a debt in his book does not fade; it
waits. His spells work the same way: nothing hurts now, everything comes due. He steps into the Ring when a debtor will not pay any
other way, and he has never once lost the paperwork.

### Wick | the Doorwarden | door | truce | he | roster
- people: north
- home: tower | The Hundred Doors under the Ring
- age: Looks 70. He was 50 and already keeping doors when the sun fell (Noon-touched).
> "This way, please. No, the other this way."

Champions come to the Ring from every realm of the Dial, and every one of them comes through a door that Wick keeps. He is the keeper
of thresholds, old and thin, in a long oxblood coat with gold braid, and his ring of keys opens the Hundred Doors under the Ring's
stands: doors to the Sands, the Deep, the white north and back. A door, he says, is a promise that the other side is still there. That
is why he hates the Tear above the Tower, a hole with no frame and no other side, and the thing that came through it. In the Ring he
opens his doors in pairs and shows his enemies out, politely, through the one they did not expect.

### Pip | the Wingfoot | courier | truce | he | roster
- people: aubade
- home: tower | The couriers' loft above the Ring
- age: 19. Born 81 years after the Fall, the youngest of the Truce's officers.
> "Sign here. And here. And there, where it's on fire."

A challenge to the Ring is not real until it is delivered by hand, and Pip delivers them: sealed scrolls from countess to king, from
the Deep to the white north, in a courier's pack wider than he is. He is the youngest of the Truce's officers and by far the
fastest. The gold wings on his circlet and his heels were the Truce's gift after he crossed the whole Dial in a day and a night. He
has never opened a letter, never lost one, and never been paid on time. He fights in the Ring to settle races, mostly, and once to
deliver a challenge to a champion who would not take it any other way.

### Madame Cleaver | the Feastmistress | chef | truce | she | roster
- people: dune
- home: banners | The old camps of the Banners; now the Truce Table at the Ring
- age: Looks 45. She was 25, cooking for both armies, in the year of the Fall (Noon-touched).
> "Sit. Eat. Then you can hit each other."

The Truce has one law older than the Ring: nobody who has eaten at the Truce Table may strike in anger outside it. Madame Cleaver
keeps that table. She was a cook in the camps of the Banners when the war was still a war, feeding both armies from one fire, and she
walked away from it with her cleaver, her cauldron, and the certainty that everyone fights better fed. Now every duel in the Ring ends
at her table, winner and loser side by side, and she fights to get them there. Her cleaver came from Brannoc's forge, her recipes from
nobody, and her temper from the fact that champions never say thank you.

### Big Yoko | the Mountain | sumo | truce | he | roster
- people: aubade
- home: aubade | The shrine cliffs below Aubade
- age: Looks 38. He was 18 and already a giant when the sun fell (Noon-touched).
> "The ring is small. The world outside it is large. Choose."

Before the Ring had walls it had a circle of straw rope, and Yoko stood in it. He is the Truce's first champion and its living
boundary: the ring stamped on the floor of every duel is drawn after the one he defends. He was a shrine wrestler from the cliffs below
Aubade, a giant even as a boy, and he came to the Ring to lose, to show that a giant can be pushed out by a quicker hand. Nobody has
managed it since the Ring was opened. He throws salt before every bout to keep the circle clean, which Gus has asked him, many times, to stop. He
fights because the Ring is a promise, and a promise needs someone to stand in it.

### Morwen | the Saltwarden | salt | truce | she | next10
- people: coast
> "Step over. I'll wait. The salt will wait longer."

Every dawn before the Ring opens, Morwen walks its edge with a pouch of salt and pours a line that no spell may cross, so that the
crowd goes home with its eyebrows. She is a hedge witch of the Drowned Coast, raised in a cottage the sea took, and she learned early
that a line of salt and a nail of cold iron keep out most of what walks at night. The Truce hired her after a stray bolt of Kaia's
emptied the western stands. She does not much like champions. She likes boundaries, and people who keep to them, and she steps into
the Ring herself to teach that to the ones who do not.

### Kessa | the Chainwarden | chain | truce | she | next10
- people: kiln
> "You can run to the end of the chain. Then you come back."

Under the Drowned Harbour, where the sea came in on the day of the Fall, lies the Gaol of Oaths: the Truce's prison for those who
break the truce. Kessa is its warden. She wears its chains wound round her forearms and carries its great ring of keys, and in all
her years only one prisoner has left without her leave: Asenet, the Uncrowned, who slipped her chain on a spring tide. Kessa has not
forgiven the sea, the tide or herself. She comes up into the Ring when an oath-breaker must be brought in, and she brings them in, one
way or the other. She never lets go of a prisoner, and she is very hard to let go of.

### Auriel | the Dawn Paladin | dawn | noonsworn | she | roster
- people: aubade
- home: aubade | The White Barracks of Aubade
- age: Looks 20. Born on the first morning after the Fall, a hundred years ago (Noon-touched).
> "Every night ends. I am how."

Auriel was born in Aubade on the first morning after the Fall, the morning the sun rose thin and late, and the Noonsworn took it for a
sign. They raised her in white and gold plate, taught her the oath of the dawn, and gave her the white wings of the paladins who once
guarded the sun's road across the sky. Noon-touched, she is young still, and very certain. She believes the sun can be hung again over the Tower, and
that it must be carried up by someone who has earned the climb in the Ring. Her shields burst outward when they break, the way a dawn
does. She fights the Court of Dusk on sight, and Vesper first.

### Anka | the Firebird | phoenix | noonsworn | she | roster
- people: fallborn | an Ember
- home: coast | The surf off the Drowned Coast, where she first rose
- age: A hundred years since she first walked out of the sea; each fire makes her about 20 again.
> "Put me out. Go on. I'll wait."

When the sun broke, a spark of it fell into the sea off the Drowned Coast and did not go out. The next morning Anka walked out of the
surf, a dancer in ember-red and gold with a fan of feathers, and she has burned and risen many times since. The Noonsworn call her the
sun's promise: proof that what falls can rise. She is fragile, and she always knows where she will come back, because she leaves her
embers on the ground for it. Mortis has buried her three times. She has never stayed. She climbs to find the rest of the fire she came
from, and to give it back to the sky.

### Cantor | the Last Verse | bard | noonsworn | he | roster
- people: aubade
- home: aubade | The choir loft of Aubade; once the Tower's top
- age: Looks 50. He was 30 and singing the Hymn of Noon when the sun fell (Noon-touched).
> "On the beat. Always on the beat."

The sun was held up, the old songs say, by the Hymn of Noon, sung every midday from the Tower's top by a choir of a hundred. On the day
of the Fall the choir sang and the sun fell anyway, and only two singers came down: Cantor and Mum. He still knows every verse, and he
is the last who does. He sings on the beat, because the Hymn was a beat before it was a song, and a note off the beat goes sour. He
has walked the Field of Banners singing the dead armies their marching songs. He fights in the Ring for the right to climb, to sing
the Hymn once more where it was meant to be sung.

### Opaline | the Lightbreaker | prism | noonsworn | she | roster
- people: gloaming
- home: deep | A glass-cutter's house at the top of the Prism Stair
- age: Looks 28. She was 8 when the sun fell (Noon-touched); her sister Silvane was 12.
> "White is only every colour, waiting."

When the sun fell, its light did not all go out. Much of it ran down into the Deep and hid in the crystals there, which is why the
Deep's halls glow. Opaline goes down the Prism Stair and breaks that light out again, cutting it into its colours to find the one the
sun has lost. She is calm and patient, with a voice that never rises, a ring of prisms circling her head, and amethyst grown out of
her cheekbones, shoulders and hands where the Deep's light took root in her. The Noonsworn want
every drop of the old light for the sun; the miners want it for their lamps, and Mabel has told her so with her claws. Her sister
Silvane keeps light the other way, in a mirror, and they no longer speak.

### Campana | the Bellwright | bell | noonsworn | she | next10
- people: aubade
> "Listen. Now listen again."

The bells of Aubade ring the sun up every morning, and Campana cast every one of them. She is the bell-founder of the Noonsworn, a
strong woman in a heavy leather apron over temple plum, bronze to her elbows. Her bells answer each other: strike one and the ring
spreads to the next, which is how a whole city wakes at once. She also cast the harbour bell that the Bell-Warden still rings on the
Drowned Coast. She believes the sun fell because the world went quiet, and that enough bells rung together at the Tower's top would
call it back. Cantor thinks she is right. Itzel thinks her bronze would crack in a real fire.

### Orren | the Sunbearer | sunbearer | noonsworn | he | next20
- people: aubade
> "Take it, if you can carry it."

Before the Fall, a piece of the sun's light was kept in a lantern-shrine in Aubade, lit from the sun itself at its last noon. It is
called the Ember of Aubade, and Orren carries it. He is a broad, slow knight in white and gold, bent under a brass shrine on his back,
and he has sworn never to set it down except to fight. Where he stands, the Ember's light falls, and in it he is strong. The Ember is
the Noonsworn's hope: the seed of a new sun, to be carried to the top of the Tower. Brannoc wants to sink it in his forge, and Vesper
wants it out. Orren lets anyone try to take it. Nobody has carried it far.

### Vesper | the Crimson Countess | blood | dusk | she | roster
- people: gloaming
- home: gloaming | Her castle on the Gloaming heights
- age: She was 35 when the light left her lands, and blood has kept her there for a hundred years.
> "Come closer. I'm already paying."

Vesper was a countess of Gloaming when the sun still rose there, and a pale one even then. On the day of the Fall the light left her
lands first and came back last, and in that long twilight she found she no longer needed it. She needed blood. She pays for every
spell in her own and drinks it back from her enemies, and she has learned to go low, close to empty, before she feeds. She leads the
Court of Dusk, which owes its age to the dark, and she will not let the Noonsworn hang a sun that would burn her where she stands. The
Court's long nights are bought on credit, and Mr. Ledger holds the note.

### Silvane | the Mirror Duchess | mirror | dusk | she | roster
- people: gloaming
- home: gloaming | The Mirror Hall of Gloaming
- age: Looks 32. She was 12 when she caught the sun's last light in a hand mirror (Noon-touched).
> "Look at yourself. Now look again."

Silvane keeps the Court of Dusk's mirrors, and through them its secrets. She is a duchess of Gloaming, tall and calm, in violet and
silver, with a collar of mirror shards fanned behind her head. When the sun fell she caught its last light in a hand mirror and has
never let it out: its glass still glows pale blue. Her sister Opaline went to the Noonsworn to set light free; Silvane stayed to keep
it. She fights with real mirrors, throwing them off walls and walking to catch them, and the one glass she will not throw is that
first mirror, which is the only thing on the Dial that can turn Lithea's gaze.

### Mortis | the Ossuary Lord | bone | dusk | he | roster
- people: longdead
- home: gloaming | The ossuaries under Gloaming
- age: His bones are some three hundred years old. He stopped counting the rest.
> "Rest is for those who have somewhere to be."

Under Gloaming lie the ossuaries, halls of bone older than the Court, and Mortis is their lord. Every dead thing that falls near him
leaves its bones, and every bone is his to raise. Since the Fall the dead of the Dial have been restless, and Mortis offers them
work: walls, spires, soldiers, a place to stand. He thinks of it as a kindness. Ostrel, who ferries the dead across to rest, thinks of
it as theft, and Morwen lays her salt so that his skeletons cannot reach the Ring's crowd. He has buried Anka three times, the only
body that would not stay. He fights in the Ring for more ground, and to bury her a fourth time.

### Nyx | the Umbral Stalker | shadow | dusk | she | roster
- people: fallborn | of the Cast
- home: gloaming | The walls of the Night Temple, where her shadow first fell
- age: A hundred years old, every one of them as a shadow; she looks 25.
> "You looked away. That's all it takes."

Nyx is the Court's knife. In Gloaming they say she was a shadow before she was a woman: a shape thrown long across a wall by the sun's
last light at the moment of the Fall, which simply walked away from the wall. She wears matte black with a violet edge and nothing
that could catch the light. She fades when she is left alone, and her first strike out of the fade is the one that counts. She guards
Vesper and hunts whoever the Court names, mostly in the thickets of the Walking Wood. Lyra's stars are the one light she cannot step
out of, and Arden has tracked her for ten years without finding a footprint.

### Mum | the Silent One | mime | dusk | she | roster
- people: aubade
- home: gloaming | The harlequins' hall of the Court of Dusk
- age: Looks 46. She was 26 and singing beside Cantor when the sun fell (Noon-touched).
> "(Nothing. A pale glove rises, palm out. The wall is already there.)"

Mum sang in the Hymn of Noon on the day of the Fall, beside Cantor, and when the sun fell anyway she stopped making sound of any kind.
She came down from the Tower in a porcelain mask and found a home at the Court of Dusk, which values people who say nothing. She is
its harlequin: she plays the Court's revels in her coat of ivory diamonds, and nobody at court has heard her laugh. In the Ring her
walls and her ball cannot be seen, only the chalk lines she leaves on the floor, as if the world had to be drawn back in by hand.
Cantor still sings to her. She has never answered, and never left the room.

### Kohaku | the Foxfire | fox | dusk | she | next10
- people: briar | the Fox court
> "What was that called? Never mind. It's mine now."

Kohaku is a fox spirit of the woods round Gloaming, nine-tailed in the old stories and one-tailed by daylight, and she steals names.
Say a spell aloud near her and she can take it: you forget it for a while, and she casts it back at you in blue foxfire. The Court of
Dusk tolerates her because she steals mostly from its enemies. She wears white and pale grey with a rust-red sash, and a carved fox
mask pushed to the side of her head. She once stole the word from the brow of Hesk's first golem, and it walked into the black water
of the Deep. Sir Whiskers has been trying to catch her for longer than either will admit.

### Corbel | the Stonewing | gargoyle | dusk | he | next20
- people: gloaming | stone-woken
> "I've been sitting here all along. You never look up."

Corbel was a guard of the Night Temple who met Lithea's eyes when she came to Gloaming as the Dune Throne's envoy, and he was stone
before he could look away. The Court set him on the temple's eaves, on a ledge Bram had carved for a statue, and at the first dusk he
woke: grey-winged and stone-skinned, alive from sunset to sunrise. Now he is the Court's watcher from above. He perches on walls and
pillars, drops on his prey, and climbs back up. He cannot forgive Lithea and cannot stop looking for her. Daylight slows him back
toward stone, which is why he hates Auriel's dawn more than any blade.

### Fenna | the Grove Warden | grove | greenwood | she | roster
- people: wood
- home: wood | The Moot under the Antler Glades
- age: Looks 35. She was 15 when the Wood began to walk (Noon-touched).
> "Stand still. Let something grow."

The Walking Wood began walking on the day of the Fall, as if it had felt the sun go and set off to find it, and Fenna has kept it from
trampling the Dial ever since. She is the Grove Warden of the Moot: a cloak of layered leaves, a pale bark collar, branches like
antlers round her head, and a living staff that blooms in her hand. Wherever she fights she plants flowers, and she draws strength
from standing among them. She holds the gate of the Wood. She argues with Hank about every tree he fells, and has never once won the
argument, or lost it. Vitriol's fumes killed a whole garden of hers, and she has not forgotten.

### Hank | the Moss Hewer | timber | greenwood | he | roster
- people: wood
- home: wood | A woodcutter's hut at the Walking Wood's edge
- age: Looks 42. He was 22 and already felling trees when the sun fell (Noon-touched).
> "Timber. Mind your heads."

When the Walking Wood walks into a village, someone has to ask it to leave, and Hank asks with an axe. He is the Moot's woodcutter:
huge and quiet, with a braided beard, a moss-green tunic, a fur mantle and a great axe whose edges glow green. He grows trees too,
fast, because a felled tree must be paid back with a planted one. Fenna calls him a butcher and he calls her a gardener; both are
right, and they have shared a fire every winter for twenty years. He hunts with Arden and drinks with Bo. He fights in the Ring for
the villages at the Wood's edge, which have no champion of their own.

### Bo | the Ramherd | sheep | greenwood | he | roster
- people: wood | ram-horned
- home: wood | The high pastures above the Walking Wood
- age: Looks 60. He was 40, with a beard just going silver, when the sun fell (Noon-touched).
> "Easy now. They're only sheep. Mostly."

Bo herds the great flocks of the high pastures where the Walking Wood meets the hills, and has done for longer than his beard has been
silver. He is a herdsman-druid: ram horns curling from a bronze headband, a shaggy umber cloak, and a crook hung with a bell that his
sheep will follow anywhere. Really they follow whoever is nearest, which he will tell you is a lesson about leaders. He sits on the
Moot because somebody has to speak for the hills, and he speaks slowly. He trusts Barry Cloudsley's forecasts, which makes one of
them. He fights in the Ring when a quarrel reaches his pastures, and sends the flock in first.

### Pim and Pom | the Changeling Twins | twins | greenwood | they | roster
- people: briar | the Acorn court
- home: wood | Grandma Ironknit's cottage, since the winter after the Fall
- age: They look 10 and have for ninety-nine years: fae children age as they please.
> "Pim: Tag! Pom: You're it."

Pim and Pom were left in a woven satchel on Grandma Ironknit's doorstep the winter after the Fall: two fae children with pointed ears
who swapped places whenever anybody looked away. Nobody knows which court of the Wood they came from, or whether anyone wants them
back. Ironknit raised them anyway. Pim is the one in the acorn-cap helm with the wooden sword, who runs in first; Pom is the one in
the blue leaf hood with the slingshot, who stays back and laughs. They share one life between them and tag in and out of a fight as
if it were a game, because for them it is. The Moot keeps them because nobody else can.

### Sirix | the Swarm Warden | hive | greenwood | he | roster
- people: briar | the Hive court
- home: wood | The hive-trees of the Walking Wood
- age: Looks 40. He was 20 when the hives woke after the Fall (Noon-touched).
> "Hold still. They only sting what moves."

The hive-trees of the Walking Wood are hollow oaks the size of towers, full of amber wax and wasps, and Sirix is their warden. He wears
black chitin plate with hexagonal pauldrons and a crested insect helm, and a swarm follows him like a cloak. The wasps are not his, he
says: he is theirs. The hives fly where he asks because he keeps the Wood's flowers safe, and he guards Fenna's gardens because the
hives need them. Vela's moths keep the night and his wasps the day. Professor Puff's gas once floated a whole hive-tree out of the
Wood, by accident, and the swarm has not forgotten.

### Vela | the Dream Moth | moth | greenwood | she | next10
- people: briar | the Moth court
> "Hush. It will all be here when you wake."

The Walking Wood sleeps by night, mostly, and Vela is why. She is a luna-moth priestess of the Moot, slender, with great pale green
wings that trail long tails, and the dust of her wings carries sleep. For years she flew over the Wood at dusk and laid it down to
rest; since the Fall it has grown restless, and the Moss-Abbess now sounds a horn to help her. Vela hangs paper lanterns in the
glades, and travellers sleep safe in their light. She is kind and frail and in no hurry. She fights in the Ring because sleep is a
mercy, and some quarrels deserve one.

### Arden | the Huntmaster | hunt | greenwood | he | next20
- people: wood
> "You walked here. I can see every step."

Arden leads the Hunt of the Moot, the riders who keep the Walking Wood's moving paths clear of what the Wood breeds in its dark.
He is a tall, weathered hunter in olive and russet leathers, with an antler-tipped longbow and a hunting horn at his hip, and he reads
tracks the way Shiori reads ink. Everything that walks leaves a trail, he says, and every trail ends somewhere. He hunts with Hank,
eats with Bo, and has followed Nyx through the thickets for ten years without finding one footprint, which he takes personally. He
fights in the Ring because the Hunt's quarrels are settled there, and because his quarry sometimes shows up.

### Marin | the Tide Dancer | tide | windward | she | roster
- people: coast
- home: coast | The sea temple of the Drowned Harbour
- age: Looks 32. She was a girl of 12 dancing in the temple when the sea came in (Noon-touched).
> "The sea comes in. The sea goes out. You don't."

When the sun fell, its heat lifted the sea, and the sea came in over the Drowned Harbour and stayed. Marin was a dancer of the
harbour's sea temple then, a barefoot girl in sea-glass, and she danced the water back out of the temple with ribbons of tide. She
has danced the tide ever since. It turns every few seconds in her hands: high, it pushes; low, it pulls. She holds the gate of the
Sea, keeps the harbour lights with the Windward, and lets Gus keep her temple floor wet. Under her tide lies the Gaol of Oaths, and
Kessa blames her for every flood.

### Kaia | the Tempest Caller | storm | windward | she | roster
- people: coast
- home: coast | A storm-callers' tower on the Spires
- age: 28. Born 72 years after the Fall, to a sky that had no master.
> "Stand by the rod. It's safer. For me."

Since the Fall the weather of the Dial has had no master, and Kaia means to be one. She is a storm caller of the Spires, sea-tanned, in a
rain-blue oilskin, her silver hair bound up, with a tall staff that catches lightning and plants it in the ground as rods. Storms that once came with the seasons now
come when they like, and she bends them to the Windward's ships. Barry Cloudsley forecasts the weather; Kaia changes it, mostly to
prove him wrong, and they have argued in public for twelve years. Saga's northern light and her lightning have never shared a sky
politely. She fights in the Ring because a storm needs somewhere to land.

### Zephyr | the Wind Blade | sky | windward | he | roster
- people: coast
- home: coast | The Spires, the sky towers standing in the sea
- age: 24. Born on the Spires 76 years after the Fall.
> "Catch up. I'll wait. No, I won't."

Zephyr was born on the Spires, the broken sky towers that stand in the sea, and learned to walk on the wind before he walked on stone.
He is lean and quick, in a short teal coat and a very long jade scarf, with a curved blade the Windward's elders forged from a gust.
Every dash he makes gives him another gust to spend. He races Pip across the Dial every spring and has lost exactly as often as he
has won. He races Ramet's lion across the Glass Flats too, and loses less. He races climbers to the lighthouse of the Sea for
practice. He fights in the Ring because standing still bores him.

### Barry Cloudsley | the Sky Augur | weather | windward | he | roster
- people: coast
- home: coast | The weather post on the highest Spire
- age: Looks 50. He was 30 and already reading the sky when the sun fell (Noon-touched).
> "And now, the weather. You won't like it."

Barry is the Windward's augur: he reads the sky. Since the Fall that has been the hardest job on the Dial, because the sky no longer
keeps its own appointments. He stands on the Spires in a long storm-slate coat with a cloud on his shoulders and a weathervane staff
taller than he is, and he calls the forecast every eight seconds, which is as long as any forecast now holds. He is right about the
weather more often than anyone alive and still mostly wrong, which he blames, loudly, on Kaia. Bo trusts him, and Professor Puff
flies with him. In the Ring his weather hits both heroes, and he is the only one who knows what is coming.

### Professor Puff | the Aeronaut | balloon | windward | he | roster
- people: coast
- home: coast | His basket, moored to the Spires between flights
- age: Looks 60. He was 40 and mapping the sky when the sun fell (Noon-touched).
> "Hold your breath. No, really. It helps."

Professor Puff mapped the sky of the Dial before the Fall, from a basket under glass spheres of glowing rose gas, and now that the sky
has changed he is mapping it again. He is a small round scholar of the air in an aubergine coat with brass buttons, goggles up on his
brow and a brass tank on his back, and he is completely serious about everything. His gas makes whatever it touches swell, which makes
enemies larger and easier to hit, and which once floated a whole hive-tree out of the Wood. Sirix has not forgiven him. He argues
engines with Ada at every Truce dinner, and Barry is his oldest flying companion.

### Lian | the Kite Master | kite | windward | she | next10
- people: coast
> "Look up. No, the other up."

The Windward send their messages from Spire to Spire by kite, and Lian is the best flier they have ever had. She is light and quick,
in a saffron silk coat with indigo cuffs and paper ribbons braided into her hair, and her great kite is a paper dragon that flies
where she points. Shiori taught her to fold paper, and the dragon is folded from a single sheet, as Shiori's way requires. She flies
it on Zephyr's winds, which he never lets her forget. In the Ring the kite is a second place she fights from, and her enemies never
quite know which of the two to watch.

### Gus | the Temple Keeper | janitor | windward | he | roster
- people: coast
- home: coast | The sea temple of the Drowned Harbour
- age: 65. Born 35 years after the Fall; he has swept the temple for forty years.
> "Mind the floor. I did warn you."

Gus keeps the sea temple of the Drowned Harbour, the one Marin danced dry after the Fall, and he has kept it clean for forty years
against the sea, the salt and everyone who walks in. He is a stocky, calm old keeper in grey-blue robes and a broad lacquered hat, with
a sweeping staff hung with paper streamers and a bronze urn of glowing temple water. The temple floor is always wet, because he holds
that a clean floor is a wet one, and he has put up signs. People slide. That, he will tell you, is their own business. He comes to the
Ring when Big Yoko has thrown his salt about again.

### Brannoc | the Ashen Smith | forge | underforge | he | roster
- people: kiln
- home: deep | The great forge in the Ember Caldera
- age: Looks 50. He was 30 and already a master smith when the sun fell (Noon-touched).
> "Hotter. Again. Hotter."

Brannoc keeps the great forge of the Underforge, sunk in the Ember Caldera, where the fire of the fallen sun still rises through the
rock. He is huge and ash-bearded, in a scorched leather apron, and a forge glows in his own chest: he has no cooldowns, only heat, and
at white heat he burns. He taught Ada everything about metal and nothing about patience. Long ago he followed Isolde north, and she
froze his forge solid to send him home; it took him a year to light it again, and he has not followed anyone since. He wants the
Ember of Aubade for his fire, and fights Orren for it whenever the Ring allows.

### Ada | the Artificer | clockwork | underforge | she | roster
- people: kiln
- home: deep | A workshop above the Underforge's great lift
- age: 26. Born 74 years after the Fall; Brannoc's apprentice until her hammer swung itself.
> "Give me ten seconds and something to bolt it to."

Ada was Brannoc's apprentice until she built a hammer that swung itself. She is a slim inventor in a copper coat, with a backpack of
brass gears and goggles pushed up on her leather cap, and she builds turrets, drones and hooks faster than she can name them. Most of
the Underforge's lifts, pumps and lamps are hers now. She thinks the Heart of Noon is the finest engine the Dial has ever had, and she
would like to run the Deep on it. She argues engines with Professor Puff at every Truce dinner, and she has won every argument that
did not involve flying.

### Bram | the Stonewright | mason | underforge | he | roster
- people: kiln
- home: deep | The masons' halls of the Underforge
- age: Looks 38. He was 18 when the sun fell (Noon-touched). Gerald is older than the Deep.
> "Gerald says hello. Gerald says goodbye."

Bram builds the halls of the Underforge stone by stone, and he has one friend: Gerald, a limestone pillar with a carved face, who goes
everywhere with him. Bram is broad and calm, with carved limestone pauldrons, a leather apron, a rune-cut maul and a glowing amber rune
on his chest. He carved the ledge on the Night Temple's eaves where Corbel woke, and they are, oddly, friends. Every year at the Ring's
opening he pushes the same stone against Big Yoko, and neither has won. Hesk's golems and Tova's powder both offend him: the first
because it is not stone, the second because it is not building.

### Mabel | the Deepdelver | mole | underforge | she | roster
- people: mole
- home: deep | The deepest seams under the southern hills
- age: Looks 40 in mole-folk years. She was 20 when she saw the light run into the crystals (Noon-touched).
> "Mind the hole. Well. Mind the next one."

Mabel is a mole-folk miner of the deepest seams, stout and dark-furred, with a bronze helm topped by a glowing amber crystal lantern
and claws as long as daggers, tipped in gold. Her people lived in the Deep before anyone, and they were the first to see the sun's light
run down into the crystals after the Fall. She holds that the light belongs to the miners who dug down to it, and she has told Opaline
so, with her claws. She keeps the Lamp Road open, digs with Tova and sorts glass with Itzel. In the Ring she goes under the floor, and
comes up under you.

### Itzel | the Obsidian Herald | obsidian | underforge | she | next10
- people: kiln
> "The ground has an opinion. Let me show you."

Where the fire of the fallen sun rises through the Ember Caldera, it cools into black glass, and Itzel speaks for that fire. She is the
Herald of the Underforge, a lean warrior in black lacquered armour inlaid with turquoise, under a mantle of jade and white feathers,
with a broad blade of obsidian. Her strikes split the ground in straight lines: a chasm to her enemies, a road to her, as the
fire under the Dial has always been. She cuts the glass that Mabel's miners dig out. She thinks Campana's bronze would crack in a real fire, and has offered more than
once to show her. She fights in the Ring to carry the Underforge's word, and her word is sharp.

### Hesk | the Golemwright | golem | underforge | he | next20
- people: kiln
> "Every word is an order. Watch which one I write."

In the Underforge the heavy work is done by golems, clay and iron bodies that move because a word is written on their brows, and Hesk
makes them. He is a heavy, careful man with clay to the elbows and a stylus behind his ear, and a golem of his obeys whoever wrote the
last word on it. Shiori taught him the script, and he writes it well. Kohaku once stole the word off his first golem's brow and it
walked into the black water of the Deep; he has made a hundred since and keeps them closer. Bram thinks a friend should be made of
stone and should choose you. Hesk thinks that is very sentimental.

### Tova | the Hallbreaker | sapper | underforge | she | next20
- people: mole
> "That was a wall. Now it's a door. You're welcome."

When the old halls of the Deep fall in, someone has to open them, and when something lives in them, someone has to close them. Tova
does both, with powder. She is the Underforge's sapper, in soot-dark leathers with a bandolier of charges, a coil of fuse at her hip
and a long iron pry-bar in her right hand, and she is called whenever a wall must stop being a wall. Her charges burn a bright fuchsia,
from the crystal powder of the Deep. She digs with Mabel, takes her powder from Brannoc's forge, and argues with Bram, who builds what
she knocks down. Mum's unseen walls are the only walls she has never broken.

### Sefu | the Dune Sovereign | sand | dune | he | roster
- people: dune
- home: sands | Tamerit, on the Dune Throne
- age: Looks 44. He was 24 when the sun fell, and took the throne the year after (Noon-touched).
> "Kneel, or be judged standing."

The kings of the Sands always called the sun their father, and when it fell, the Sands said it fell there, into the dunes, which are
still warm. Sefu took the Dune Throne the year after, from his sister Asenet, and declared himself the sun's heir: if a sun is to hang
over the Tower again, he says, it should be his. He wears layered linen, a gold collar and a striped gold headdress, and carries a
sandstone crook. His crook and his sarcophagus Judge his enemies, and a Judged enemy cannot run far. He holds the gate of the Sands
and sends his champions to the Ring to win the climb. Auriel calls it heresy. Asenet calls it theft.

### Vitriol | the Plague Alchemist | alchemy | dune | he | roster
- people: dune
- home: sands | The embalmers' house of Tamerit
- age: Nobody knows: nobody has seen his face. His hands are old.
> "Breathe in. Now let's see what you're made of."

Vitriol is the embalmer of the Dune Throne, the alchemist who keeps its dead kings whole. He wears a dark hood, a pale glass beak mask
with round green lenses, and a coat with a bandolier of vials, and nobody at court has seen his face. He knows every reagent that
preserves and every one that does the opposite, and in the Ring he lays one on you, then another, and lets them meet. He brewed the
curse that Asenet laid on the crown before her exile, and she never paid for it; he has not forgotten. His fumes once killed a garden
of Fenna's by the road where he was testing them, and she has not forgotten either.

### Lithea | the Stone Gaze | gorgon | dune | she | next10
- people: dune
> "Look at me. Everyone does, once."

In the oldest tombs of the Sands lives an order of veiled priestesses who guard the dead kings with their eyes, and Lithea is the last
of them. Whoever meets her gaze turns a little to marble; whoever meets it fully stays that way. She wears a sheer verdigris veil, a
crown of bronze serpent coils and a marble-white gown. She went to Gloaming once as the Throne's envoy, and a guard of the Night Temple
looked at her too long; the Court set him on the eaves, and he woke at dusk as Corbel, who has hunted her since. Silvane carries the
one mirror that can turn her gaze. She fights facing you, and likes it when you look.

### Nebet | the Heartweigher | scale | dune | she | next20
- people: dune
> "Let us see which of us is heavier."

When a king of the Sands dies, his heart is weighed in the tomb against a single feather, and Nebet holds the scale. She is the
Throne's judge of the dead, tall and still, in white linen with a lapis headcloth and a gold collar, with a scale of two gold pans in
her left hand and a hooked bronze blade in her right. The feather in her pan, they say, is one of Anka's, taken from the sea on the
morning after the Fall, and Nebet would like a fresh one. Ostrel brings the dead to her, and she weighs them for Sefu. In the Ring she
weighs the living, and the heavier one pays.

### Sahar | the Mirage | mirage | dune | he | next20
- people: dune
> "Hide behind that. Go on. It's lovely shade."

On the Glass Flats the heat lifts the air until you see water and shade that are not there. Sahar was born on the Flats, and he learned
to make them. He is the Throne's archer, slim and sun-dark, in pale linen wrapped against the heat with a lilac scarf across his face,
and he shoots at enemies sheltering behind walls and palms that were never there. Mum builds walls nobody can see; Sahar builds walls
nobody can trust; each thinks the other is cheating. Lyra is the archer he most wants to beat, and The Great Zambini has twice tried
to hire him for the stage.

### Ramet | the Lion of the Gate | sphinx | dune | he | next20
- people: ninefold | a lion
> "The gate is shut. Climb over me."

The gate of Tamerit is kept by a great lion of sandstone and gold that wakes when its rider sits on its back, and Ramet is its rider.
He is the Throne's gate captain, a strong, steady lion of the Ninefold in gold-banded armour, with a long spear. He was keeping the
gate on the night Sefu took the crown, and when Asenet came to it in the dark he opened it and let her go. Sefu has never asked him
why. Every year he races Zephyr across the Glass Flats, and the lion has never lost on sand. In the Ring, break the lion and he fights
on foot, and he is still a captain.

### Tempo | the Unwound Hour | chrono | hourkeepers | he | roster
- people: north
- home: frostfall | The Hourkeepers' observatory at Frostfall
- age: He looks 40. He has lived a hundred years since the Fall, every moment twice.
> "Again. And again."

When the sun fell, the Tower's shadow stopped telling the hour, and time on the Dial began to slip: an hour here runs long, a morning
there comes twice. Tempo is what the Hourkeepers call an unwound hour, a man who fell out of time at the moment of the Fall and has
lived every moment twice since. He wears a long dark coat with a clock-dial halo, carries a staff shaped like a minute hand, and every
spell he casts plays again. He keeps the great clock at Frostfall, and races the dark through the Deep for practice. He has sworn to
wind the Dial up again before Oblivion unmakes the hours altogether.

### Shiori | the Last Brush | ink | hourkeepers | she | roster
- people: north
- home: frostfall | The frozen library at Frostfall
- age: 30. Born 70 years after the Fall, the last of the great calligraphers.
> "Hold still. You are being written."

The Hourkeepers write the Dial down before it changes, and Shiori is the last of their great calligraphers, the one whose writing comes
true. She wears a rice-paper robe with its hem washed in ink and an indigo sash, long black hair held by a brush-shaped pin, and she
carries a brush as tall as she is. Her strokes lie wet on the floor, and where two cross, the ink bursts. She taught Lian to fold
paper, and Hesk to write the word on a golem's brow. She thinks Mr. Ledger's book is the worst-written history on the Dial, and he
thinks hers has too many pictures.

### Lyra | the Star Archer | astral | hourkeepers | she | roster
- people: north
- home: frostfall | The observatory at Frostfall, under the pole star
- age: 22. Born 78 years after the Fall, under a sky that still kept time.
> "Run. The sky is very big, and I can see all of it."

The stars still keep time, even with the sun gone wrong, and Lyra reads them. She is the Hourkeepers' archer, a night hunter in a
starry violet cloak with a gold crescent bow, and her arrows draw constellations between them as they fly. She charts the northern sky
with Saga from the observatory at Frostfall, and she hits harder the farther away you stand, because a star is always far. Her stars
are the one light Nyx cannot step out of, and the two have duelled in the dark more often than either has told anyone. Sahar of the
Sands calls himself the better archer, and she lets him.

### Grandma Ironknit | the Weaver | yarn | hourkeepers | she | roster
- people: briar | the Spindle court
- home: wood | A cottage at the Walking Wood's edge, on the Frostfall road
- age: Looks 70. She was 50 and already spinning when the sun fell (Noon-touched).
> "Sit down, dear. You're coming unravelled."

The Hourkeepers say every life on the Dial is a thread, and Grandma Ironknit holds the spindle. She is a tiny old fate-spinner in a
dark hooded shawl knitted in bands of rose thread, with two needles as long as swords and a grey cat called Mr. Biscuit, and she knits
lives into the cloth of the Dial at Frostfall. She raised Pim and Pom when they turned up on her doorstep, taught Thessa to sew, and
fifty years ago turned down Mr. Ledger, who wanted to write her into his book; she knitted him a scarf instead, and he still wears it
under the collar. In the Ring she ties her lines across the floor and sends the cat.

### Isolde | the Winter Warden | frost | hourkeepers | she | roster
- people: north | lake-born
- home: frostfall | Frostfall Lake, at the top of the Dial
- age: Looks 48. She was 28 when the sun fell (Noon-touched).
> "Slower. Slower. There."

At the top of the Dial, where the stars turn round the pole, the cold keeps time still, and Isolde guards it. She is the Winter Warden,
in white and frost-blue, with a crown of ice spikes fanned behind her head and a long ice spear, and the Hourkeepers' library at Frostfall lies in ice under her
watch, where nothing written can fade. Her hits stack the cold on her enemies until they freeze. Long ago Brannoc followed her north,
fire to her frost, and she froze his forge solid to send him home; it was the kindest thing she knew how to do. Saga, who dances the
northern light, is her sister. Isolde fights to keep the cold, and the past, as they are.

### Saga | the Northern Light | aurora | hourkeepers | she | next10
- people: north | lake-born
> "Walk through. You'll come out a different colour."

Saga dances the aurora over Frostfall: the curtains of green and violet light that tell the Hourkeepers the hour on nights when the
stars are hidden. She is a tall dancer in deep night-blue with a white fur mantle, silver embroidery like star charts, long pale braids
and a crown of thin silver rays. She hangs her curtains across a fight the way she hangs them across the sky, and whoever walks through
one comes out changed. Isolde is her sister, Lyra her partner at the observatory, Vela a friend of the night. Kaia's storms and Saga's
lights have never shared a sky politely, and the Spires blame her for every green flash at sea.

### Thessa | the Sky-Stitcher | stitch | hourkeepers | she | next20
- people: north
> "Here and there. Now they are the same place."

Above the Tower, where the sun hung, the sky is torn: the Tear, black with a burning pink edge. Thessa means to sew it shut. She learned
to sew at Grandma Ironknit's knee, and she sews places, not cloth: two points of the Dial drawn close with a golden thread, so that what
happens at one happens at the other. She is slim and grave, in a night-blue coat stitched with silver seams, a gold thimble on her
finger and a silver needle as long as her arm. Wick keeps the doors and she keeps the seams, and they are friends. Oblivion has unpicked
every stitch she has put in the Tear. She keeps sewing.

### Oblivion | the Unmaker | void | loners | he | roster
- people: fallborn | the Unmade
- home: tower | The Tear in the sky above the Tower
- age: Not born. It came through the Tear on the day of the Fall, a hundred years ago.
> "There was something here. Was there?"

When the sun fell it tore the sky above the Tower, and something came through the Tear that the Dial has no word for. The Hourkeepers
call it the Unmaker. It wears the shape of a towering knight in black plate cracked with glowing pink rifts, with a horned helm, one
burning slit for an eye, and a greatsword of void. While it stands still it pulls in whatever is near, and what it pulls in does not
always come back. It wants no throne: it wants the Dial unmade, hour by hour, door by door. It holds the gate of the War, where the
Banners cannot stop fighting because nothing it touches can end. Wick, Tempo and Thessa have sworn to send it back.

### Sir Whiskers | the Lynx Duelist | cat | loners | he | roster
- people: ninefold | a lynx
- home: banners | The lynx knights' old keep by the Field of Banners
- age: 31 in this life; he is on his fourth of nine.
> "En garde. And do try. It's so much nicer when they try."

Sir Whiskers counts his life in nines, as the lynx knights of old did, and spends lives like coin: on a wager, a lady, a point of
honour. He is an upright tawny lynx with black ear tufts, in gunmetal plate with gold filigree and a short wine-red cape, with a long
rapier whose amber gem glows, and he is extremely pleased with himself. He has served many courts and belongs to none now; he duels for
whoever is most interesting, and lands on his feet. He once spent a life for Silvane, who still owes him for it. He has been trying to
catch Kohaku for longer than either will admit, and she has been letting him.

### The Great Zambini | the Illusionist | magic | loners | he | roster
- people: briar | of no court
- home:  | Everywhere. He says Aubade, Tamerit and Gloaming, on alternate days
- age: He says 39. He has said 39 for sixty years.
> "Pick a hat. Any hat. Wrong."

Nobody knows where The Great Zambini comes from, which is how he likes it. He has played every court on the Dial under a violet
spotlight, in a deep violet cape and a tall top hat with a gold star, and he has sworn loyalty to all of them, in writing, more than
once. He vanishes under hats, saws things in half and pulls the rabbit out last. Referee Whistler has watched every one of his duels
and has never caught him cheating, which convinces Whistler that he always does. He has tried to hire Sahar for the stage, twice. Pim
and Pom are his favourite audience and his worst assistants. He fights for the applause.

### Ostrel | the Ferryman | ferry | loners | he | next10
- people: longdead
> "Everyone crosses. The question is when."

The dead of the Dial go somewhere, and Ostrel takes them there. He is the ferryman of the dead: tall and gaunt, in a long fog-grey
hooded coat lined in deep blue with coins sewn on its hem, poling his boat along rivers of pale light that run wherever he lays them.
Since the Fall the dead have been restless and the rivers crowded. He serves no faction, because every faction's dead ride with him. He
brings the dead of the Sands to Nebet's scale, and the dead of Gloaming when Mortis lets him, which is never. Marin's tide carries his
rivers to the sea. The Deep's own ferryman, who brings the living back, is not him, and they do not speak.

### Asenet | the Uncrowned | curse | loners | she | next20
- people: dune
> "It's yours now. It never stays."

Asenet was queen of the Sands when the sun fell, and the Sands blamed her. Her brother Sefu took the Dune Throne the next year, and on
the night she was driven out she laid a curse on the crown: it would never stay on one head. It has passed from head to head ever
since, and everyone who wore it too long has fallen. She walks the Dial with no realm and no court, in faded royal linen of wine and
tarnished gold, and she carries the curse with her: a thin circlet that will not stay on any head, hers included. She slipped Kessa's
chain on a spring tide. She owes Vitriol for the curse and Ramet for the gate, and she pays neither.

## Ties

- ! Auriel ~ Vesper | sworn enemies | The dawn, and the countess who would keep it from coming. Every duel between them is the Noonsworn against the Court
- ! Sefu ~ Asenet | siblings | Brother and sister; he took her crown, she cursed it. Each has sworn to see the other fall
- ! Brannoc ~ Isolde | old flames | Fire followed frost north once. She froze his forge solid to send him home, and neither has married
- ! Opaline ~ Silvane | sisters | Two sisters of the glass: one breaks the sun's light free for the Noonsworn, one keeps it in a mirror for the Court
- ! Cantor ~ Mum | old flames | They sang the Hymn of Noon side by side on the day it failed. She has made no sound since; he has not stopped singing to her
- ! Anka ~ Mortis | sworn enemies | He keeps the dead in the ground; she will not stay there. He has buried her three times
- ! Kaia ~ Barry Cloudsley | rivals | He forecasts the weather and she changes it to prove him wrong: twelve years of public argument
- ! Nyx ~ Lyra | rivals | The shadow and the star archer: Lyra's stars are the one light Nyx cannot step out of
- ! Fenna ~ Hank | rivals | She grows them, he fells them. They argue every day and share a fire every winter
- ! Wick ~ Oblivion | sworn enemies | The keeper of every door, against the thing that makes holes where no door should be
- ! Tempo ~ Oblivion | sworn enemies | One keeps the hours; the other wants none left
- ! Referee Whistler ~ The Great Zambini | rivals | The Arbiter has never caught Zambini cheating, and has never once believed he didn't
- ! Nyx ~ Arden | rivals | The Huntmaster has followed the Court's knife for ten years and never found a footprint
- ! Orren ~ Vesper | sworn enemies | He carries a piece of the sun on his back; she would put it out, and it burns her to come near
- ! Thessa ~ Oblivion | sworn enemies | She sews the Tear shut; it unpicks every stitch
- Vesper > Mr. Ledger | owes | The Court's long nights were bought on credit from the Tally, and Ledger holds the note, with interest
- Mr. Ledger ~ Pip | comrades | Pip delivers every bill Ledger writes, and has never once been tipped
- Mr. Ledger ~ Grandma Ironknit | old flames | Fifty years ago he asked to write her into his book; she knitted him a scarf instead, which he still wears
- Mr. Ledger ~ Shiori | rivals | Two keepers of the record: she says his book has no pictures, he says hers has no totals
- Wick ~ Thessa | friends | He keeps the doors and she keeps the seams, and they agree that the Tear is neither
- Pip ~ Zephyr | rivals | The fastest feet against the fastest blade; they race across the Dial every spring and the score is even
- Madame Cleaver ~ Big Yoko | friends | She has fed the Mountain since he was a boy; nobody else owns a pot big enough
- Madame Cleaver ~ Brannoc | old flames | Her cleaver came from his forge, and so did a promise neither of them kept
- Big Yoko ~ Bram | rivals | Every year at the Ring's opening they push the same stone, and neither has moved it farther than the other
- Big Yoko ~ Gus | friends | Yoko throws the salt and Gus sweeps it up, and both think the other is very patient
- Morwen ~ Mortis | sworn enemies | Salt against the risen dead: her lines are why his skeletons cannot reach the Ring's crowd
- Morwen ~ Kohaku | rivals | A line of salt is the one fence a fox spirit cannot cross, and Kohaku has tried every night
- Kessa ~ Marin | rivals | The Gaol of Oaths lies under Marin's sea, and Kessa blames her tide for every flood and every escape
- Kessa ~ Asenet | sworn enemies | The only prisoner who ever left Kessa's chain without leave
- Referee Whistler ~ Pim and Pom | rivals | The twins hold the Ring's record for cards: thirty-one, all for swapping without asking
- Auriel ~ Orren | comrades | She swore him to the Ember of Aubade, and walks in front of him wherever he carries it
- Auriel ~ Sefu | rivals | Who owns the sun: the sky, says the Paladin; my father, says the King
- Auriel ~ Corbel | rivals | Her dawn turns him back toward stone, and he waits on the eaves for her to tire
- Anka ~ Nebet | rivals | Nebet weighs hearts against one of Anka's feathers, and would like a fresh one from the bird herself
- Cantor ~ Campana | friends | Her bells keep his beat, and his Hymn tells her where to hang them
- Opaline ~ Mabel | rivals | Opaline takes the Deep's light up to Aubade; Mabel wants it left for the miners who dug to it
- Campana ~ Itzel | rivals | Bronze against black glass, both born in fire; each says the other's craft would crack
- Orren ~ Brannoc | rivals | Brannoc wants the Ember of Aubade for his forge; Orren will not set it down
- Nyx > Vesper | guardian | Nyx is the Countess's knife, and stands in her shadow wherever she goes
- Mum ~ Sahar | rivals | She builds walls nobody can see, he builds walls nobody can trust, and each calls the other a cheat
- Mum ~ Tova | rivals | The only walls Tova has never broken are the ones she cannot find
- Silvane ~ Lithea | sworn enemies | A mirror is the one thing that turns the gorgon's gaze, and Silvane carries it
- Silvane > Sir Whiskers | owes | He spent one of his lives for her, and she has not paid it back
- Kohaku ~ Sir Whiskers | rivals | The fox and the cat: he chases, she lets him, and neither will say how long it has been
- Kohaku ~ Hesk | sworn enemies | She stole the word from his first golem's brow and it walked into the black water
- Kohaku ~ Arden | rivals | The one fox the Huntmaster has never caught, and the one hunter she has never fooled twice
- Lithea > Corbel | maker | She turned him to stone with one look; the Court gave him wings, and he has hunted her since
- Corbel ~ Bram | friends | Bram carved the ledge where Corbel woke, and the stone remembers its mason
- Fenna ~ Vitriol | sworn enemies | His fumes killed a whole garden of hers, and he called it a successful test
- Hank ~ Arden | friends | The Wood's two hunters: one of trees, one of what lives under them
- Hank ~ Bo | friends | They have shared a fire, a flock and a great many silences
- Bo ~ Barry Cloudsley | friends | Shepherds watch the sky, and Bo is the one man on the Dial who trusts Barry's forecasts
- Grandma Ironknit > Pim and Pom | guardian | She found them on her doorstep the winter after the Fall and raised them as her own
- Pim and Pom ~ The Great Zambini | friends | His favourite audience, and his worst assistants
- Sirix ~ Professor Puff | rivals | Puff's gas once floated a whole hive-tree out of the Wood, and the swarm remembers his face
- Sirix ~ Vela | friends | The hive keeps the day and the moth the night, and between them the Wood's flowers are never alone
- Vela ~ Saga | friends | Two dancers of the night: one lays the Wood to sleep, the other lights the north
- Marin ~ Gus | friends | She danced the water out of his temple, and he has kept her floor wet ever since
- Marin ~ Ostrel | friends | Her tide carries his rivers down to the sea, and she asks him nothing
- Zephyr ~ Lian | friends | She flies her dragon on his wind, and he never lets her forget it
- Zephyr ~ Ramet | rivals | The wind and the lion race across the Glass Flats every year, and the lion has never lost on sand
- Professor Puff ~ Ada | rivals | Two inventors at one table: she wins every argument about engines, he wins every one about flying
- Barry Cloudsley ~ Professor Puff | friends | His oldest flying companion: one reads the sky, the other maps it
- Shiori > Lian | teacher | Shiori taught her to fold paper; the dragon is folded from one sheet, as Shiori's way requires
- Kaia ~ Saga | rivals | Lightning and the northern light have never shared a sky politely
- Brannoc > Ada | teacher | He taught her everything about metal, and she built a hammer that swung itself
- Bram ~ Hesk | rivals | A friend made of stone who chooses you, against a servant made of clay who obeys
- Bram ~ Tova | rivals | He builds what she knocks down, and she knocks down what he builds
- Mabel ~ Tova | friends | They dig the Deep together, one with claws and one with powder
- Mabel ~ Itzel | comrades | Mabel digs the black glass out of the Caldera, and Itzel cuts it
- Shiori > Hesk | teacher | She taught him the script; the word on every golem's brow is in her hand
- Sefu ~ Nebet | comrades | She weighs the dead for his Throne, and once weighed the living for him
- Asenet > Vitriol | owes | He brewed the curse she laid on the crown, and she never paid him for it
- Asenet > Ramet | owes | He opened the gate and let her go free the night her brother took the crown
- Nebet ~ Ostrel | comrades | He brings the dead of the Sands to her scale, and she weighs them true
- Mortis ~ Ostrel | sworn enemies | The ferryman takes the dead across to rest; the Ossuary Lord keeps them back to work
- Sahar ~ The Great Zambini | rivals | The showman wants the mirage for his stage; the archer says real magic does not take a bow
- Sahar ~ Lyra | rivals | Two archers who have never shot at the same target, and argue about it at every Truce dinner
- Lyra ~ Saga | friends | Partners at the observatory: one charts the stars, the other the lights between them
- Isolde ~ Saga | sisters | The warden of the cold and the dancer of its light, daughters of the same frozen lake
- Grandma Ironknit > Thessa | teacher | She taught Thessa to sew, and to sew places once cloth was too easy
- Tempo ~ Shiori | comrades | He keeps the hours and she writes them down, and both are always a little behind
