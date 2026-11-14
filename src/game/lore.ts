// Made by pipeline/tools/lore-game.py from docs/lore/LORE.md: edit the lore there and run the script again.
// The world of the Dial, its factions and places, and each hero's lore (faction, home, age, line, legend, ties).

export interface LoreFaction { name: string; colours: string[]; home: string; wants: string; sigil: string }
export interface LoreTie { other: string; kind: string; pair: string; what: string; strong: boolean }
export interface LoreHero { faction: string; place: string; from: string; age: string; line: string; legend: string; ties: LoreTie[] }

export const FACTIONS: Record<string, LoreFaction> = {
 "truce": {
  "name": "The Truce of the Ring",
  "colours": [
   "#1a1a1a",
   "#f2f2f2",
   "#6a2a2a",
   "#d9c27a"
  ],
  "home": "The Ring at the Tower's foot: its stands, the Hundred Doors beneath them, the Truce Table and the Tally-house",
  "wants": "Every quarrel in the Ring and no army on the Dial; the Tower's gate opened only to a champion who earned it",
  "sigil": "A ring with the Tower's shadow standing across it"
 },
 "noonsworn": {
  "name": "The Noonsworn",
  "colours": [
   "#f2b83c",
   "#efe6d2",
   "#ff7b3a",
   "#e04aa8"
  ],
  "home": "Aubade, the white city on the morning cliffs, whose bells ring the thin sun up every day",
  "wants": "To hang the sun again over the Tower: a champion of theirs to win the climb and carry the Ember of Aubade to the Noon Seat",
  "sigil": "A sun disc whose crack is mended in gold"
 },
 "dusk": {
  "name": "The Court of Dusk",
  "colours": [
   "#8c0f22",
   "#6a2ec0",
   "#cfe6ff",
   "#ece4d0"
  ],
  "home": "Gloaming, the castle-city round the Night Temple in the north-west, above the ossuaries",
  "wants": "The Noon Seat kept empty: no new sun to burn them, and their roads, their dead and their secrets kept",
  "sigil": "A crescent moon held in a hand mirror"
 },
 "greenwood": {
  "name": "The Greenwood Moot",
  "colours": [
   "#4caf50",
   "#e8dcc0",
   "#f0b020",
   "#3f6b3a"
  ],
  "home": "The Walking Wood in the west; the Moot meets under the antlered trees of the Antler Glades",
  "wants": "The Tower's roots cut, and the Wood left to walk where it likes, as long as it does not walk over the villages",
  "sigil": "A leaf with a spiral vein, crowned with antlers"
 },
 "windward": {
  "name": "The Windward",
  "colours": [
   "#1f9fd6",
   "#4aa8ff",
   "#eef3f6",
   "#7fe6c8"
  ],
  "home": "The Spires, the broken sky towers standing in the sea off the Drowned Coast, and the harbour towns behind them",
  "wants": "The sky mended, by whoever can do it, and the roads of the sea and the wind kept open",
  "sigil": "A wave curling up into a cloud"
 },
 "underforge": {
  "name": "The Underforge",
  "colours": [
   "#ff5a12",
   "#d9773a",
   "#c9b48a",
   "#ffcf5a"
  ],
  "home": "The Deep under the southern hills: halls lit by crystals and forges, the great forge in the Ember Caldera",
  "wants": "The Heart of Noon left below and its fire brought up through the rock: a sun underground, lighting the Deep and warming the Dial",
  "sigil": "An anvil under a lantern"
 },
 "dune": {
  "name": "The Dune Throne",
  "colours": [
   "#c8913f",
   "#e8d8b4",
   "#3fd4c8",
   "#3fbf9a"
  ],
  "home": "Tamerit, the city of the Throne in the eastern Sands, between the Glass Flats and the Storm Canyon",
  "wants": "The Noon Seat for their king: Sefu as the new sun, if the climb can be won",
  "sigil": "A crook across a sun half sunk in a dune"
 },
 "hourkeepers": {
  "name": "The Hourkeepers",
  "colours": [
   "#d4ff5a",
   "#3a5ae8",
   "#5a3fc0",
   "#e8e0c8"
  ],
  "home": "Frostfall, the observatory and the frozen library on the lake at the top of the Dial, under the pole star",
  "wants": "The hours running true again: a sun over the Tower, the Tear sewn shut, and a record of everything kept until then",
  "sigil": "An hourglass set in a four-point star"
 },
 "loners": {
  "name": "Loners",
  "colours": [],
  "home": "",
  "wants": "",
  "sigil": ""
 }
};

export const PLACES: Record<string, string> = {
 "tower": "The Tower",
 "frostfall": "Frostfall",
 "aubade": "Aubade",
 "sands": "The Sands",
 "coast": "The Drowned Coast",
 "deep": "The Deep",
 "banners": "The Field of Banners",
 "wood": "The Walking Wood",
 "gloaming": "Gloaming"
};

export const LORE: Record<string, LoreHero> = {
 "Referee Whistler": {
  "faction": "truce",
  "place": "tower",
  "from": "The Ring, in the Arbiter's box over the sand",
  "age": "Looks 34. He was 14, sweeping the Ring's sand, when the sun fell (Noon-touched).",
  "line": "\"That is a dash. I saw it. Everyone saw it.\"",
  "legend": "Whistler was a mason's boy who swept the Ring's sand the year the Truce was sworn. He watched the first champions cheat, all of them, and wrote down how. The founders laughed, then made him Arbiter, and he has not laughed since. He wears the black and ivory tabard so that no realm can claim his colour, and his silver horn is the one sound both armies of the Banners still stop for. His sigil tablets carry the Truce's rules: when he holds one up, that rule binds whoever stands under it. He does not fight to win. He fights because a rule nobody enforces is only a rumour, and he has a long list of rumours to put down.",
  "ties": [
   {
    "other": "The Great Zambini",
    "kind": "rival of",
    "pair": "rivals",
    "what": "The Arbiter has never caught Zambini cheating, and has never once believed he didn't",
    "strong": true
   },
   {
    "other": "Pim and Pom",
    "kind": "rival of",
    "pair": "rivals",
    "what": "The twins hold the Ring's record for cards: thirty-one, all for swapping without asking",
    "strong": false
   }
  ]
 },
 "Mr. Ledger": {
  "faction": "truce",
  "place": "tower",
  "from": "The Tally-house under the Ring's stands",
  "age": "Nobody knows. He looks about 70, and has looked it for a hundred years.",
  "line": "\"No, no. Don't pay now. I insist.\"",
  "legend": "Every duel in the Ring settles a debt, and somebody has to write it down. Mr. Ledger has kept the Tally since the day the Truce was sworn: who owes what, to whom, and at what interest, in a great red book chained to his wrist so that nobody can borrow it. He is older than he looks, and he looks very old. The realms fear him more than any champion, because a debt in his book does not fade; it waits. His spells work the same way: nothing hurts now, everything comes due. He steps into the Ring when a debtor will not pay any other way, and he has never once lost the paperwork.",
  "ties": [
   {
    "other": "Vesper",
    "kind": "is owed by",
    "pair": "owes",
    "what": "The Court's long nights were bought on credit from the Tally, and Ledger holds the note, with interest",
    "strong": false
   },
   {
    "other": "Pip",
    "kind": "comrade of",
    "pair": "comrades",
    "what": "Pip delivers every bill Ledger writes, and has never once been tipped",
    "strong": false
   },
   {
    "other": "Grandma Ironknit",
    "kind": "old flame of",
    "pair": "old flames",
    "what": "Fifty years ago he asked to write her into his book; she knitted him a scarf instead, which he still wears",
    "strong": false
   },
   {
    "other": "Shiori",
    "kind": "rival of",
    "pair": "rivals",
    "what": "Two keepers of the record: she says his book has no pictures, he says hers has no totals",
    "strong": false
   }
  ]
 },
 "Wick": {
  "faction": "truce",
  "place": "tower",
  "from": "The Hundred Doors under the Ring",
  "age": "Looks 70. He was 50 and already keeping doors when the sun fell (Noon-touched).",
  "line": "\"This way, please. No, the other this way.\"",
  "legend": "Champions come to the Ring from every realm of the Dial, and every one of them comes through a door that Wick keeps. He is the keeper of thresholds, old and thin, in a long oxblood coat with gold braid, and his ring of keys opens the Hundred Doors under the Ring's stands: doors to the Sands, the Deep, the white north and back. A door, he says, is a promise that the other side is still there. That is why he hates the Tear above the Tower, a hole with no frame and no other side, and the thing that came through it. In the Ring he opens his doors in pairs and shows his enemies out, politely, through the one they did not expect.",
  "ties": [
   {
    "other": "Oblivion",
    "kind": "sworn enemy of",
    "pair": "sworn enemies",
    "what": "The keeper of every door, against the thing that makes holes where no door should be",
    "strong": true
   }
  ]
 },
 "Pip": {
  "faction": "truce",
  "place": "tower",
  "from": "The couriers' loft above the Ring",
  "age": "19. Born 81 years after the Fall, the youngest of the Truce's officers.",
  "line": "\"Sign here. And here. And there, where it's on fire.\"",
  "legend": "A challenge to the Ring is not real until it is delivered by hand, and Pip delivers them: sealed scrolls from countess to king, from the Deep to the white north, in a courier's pack wider than he is. He is the youngest of the Truce's officers and by far the fastest. The gold wings on his circlet and his heels were the Truce's gift after he crossed the whole Dial in a day and a night. He has never opened a letter, never lost one, and never been paid on time. He fights in the Ring to settle races, mostly, and once to deliver a challenge to a champion who would not take it any other way.",
  "ties": [
   {
    "other": "Mr. Ledger",
    "kind": "comrade of",
    "pair": "comrades",
    "what": "Pip delivers every bill Ledger writes, and has never once been tipped",
    "strong": false
   },
   {
    "other": "Zephyr",
    "kind": "rival of",
    "pair": "rivals",
    "what": "The fastest feet against the fastest blade; they race across the Dial every spring and the score is even",
    "strong": false
   }
  ]
 },
 "Madame Cleaver": {
  "faction": "truce",
  "place": "banners",
  "from": "The old camps of the Banners; now the Truce Table at the Ring",
  "age": "Looks 45. She was 25, cooking for both armies, in the year of the Fall (Noon-touched).",
  "line": "\"Sit. Eat. Then you can hit each other.\"",
  "legend": "The Truce has one law older than the Ring: nobody who has eaten at the Truce Table may strike in anger outside it. Madame Cleaver keeps that table. She was a cook in the camps of the Banners when the war was still a war, feeding both armies from one fire, and she walked away from it with her cleaver, her cauldron, and the certainty that everyone fights better fed. Now every duel in the Ring ends at her table, winner and loser side by side, and she fights to get them there. Her cleaver came from Brannoc's forge, her recipes from nobody, and her temper from the fact that champions never say thank you.",
  "ties": [
   {
    "other": "Big Yoko",
    "kind": "friend of",
    "pair": "friends",
    "what": "She has fed the Mountain since he was a boy; nobody else owns a pot big enough",
    "strong": false
   },
   {
    "other": "Brannoc",
    "kind": "old flame of",
    "pair": "old flames",
    "what": "Her cleaver came from his forge, and so did a promise neither of them kept",
    "strong": false
   }
  ]
 },
 "Big Yoko": {
  "faction": "truce",
  "place": "aubade",
  "from": "The shrine cliffs below Aubade",
  "age": "Looks 38. He was 18 and already a giant when the sun fell (Noon-touched).",
  "line": "\"The ring is small. The world outside it is large. Choose.\"",
  "legend": "Before the Ring had walls it had a circle of straw rope, and Yoko stood in it. He is the Truce's first champion and its living boundary: the ring stamped on the floor of every duel is drawn after the one he defends. He was a shrine wrestler from the cliffs below Aubade, a giant even as a boy, and he came to the Ring to lose, to show that a giant can be pushed out by a quicker hand. Nobody has managed it since the Ring was opened. He throws salt before every bout to keep the circle clean, which Gus has asked him, many times, to stop. He fights because the Ring is a promise, and a promise needs someone to stand in it.",
  "ties": [
   {
    "other": "Madame Cleaver",
    "kind": "friend of",
    "pair": "friends",
    "what": "She has fed the Mountain since he was a boy; nobody else owns a pot big enough",
    "strong": false
   },
   {
    "other": "Bram",
    "kind": "rival of",
    "pair": "rivals",
    "what": "Every year at the Ring's opening they push the same stone, and neither has moved it farther than the other",
    "strong": false
   },
   {
    "other": "Gus",
    "kind": "friend of",
    "pair": "friends",
    "what": "Yoko throws the salt and Gus sweeps it up, and both think the other is very patient",
    "strong": false
   }
  ]
 },
 "Auriel": {
  "faction": "noonsworn",
  "place": "aubade",
  "from": "The White Barracks of Aubade",
  "age": "Looks 20. Born on the first morning after the Fall, a hundred years ago (Noon-touched).",
  "line": "\"Every night ends. I am how.\"",
  "legend": "Auriel was born in Aubade on the first morning after the Fall, the morning the sun rose thin and late, and the Noonsworn took it for a sign. They raised her in white and gold plate, taught her the oath of the dawn, and gave her the white wings of the paladins who once guarded the sun's road across the sky. Noon-touched, she is young still, and very certain. She believes the sun can be hung again over the Tower, and that it must be carried up by someone who has earned the climb in the Ring. Her shields burst outward when they break, the way a dawn does. She fights the Court of Dusk on sight, and Vesper first.",
  "ties": [
   {
    "other": "Vesper",
    "kind": "sworn enemy of",
    "pair": "sworn enemies",
    "what": "The dawn, and the countess who would keep it from coming. Every duel between them is the Noonsworn against the Court",
    "strong": true
   },
   {
    "other": "Sefu",
    "kind": "rival of",
    "pair": "rivals",
    "what": "Who owns the sun: the sky, says the Paladin; my father, says the King",
    "strong": false
   }
  ]
 },
 "Anka": {
  "faction": "noonsworn",
  "place": "coast",
  "from": "The surf off the Drowned Coast, where she first rose",
  "age": "A hundred years since she first walked out of the sea; each fire makes her about 20 again.",
  "line": "\"Put me out. Go on. I'll wait.\"",
  "legend": "When the sun broke, a spark of it fell into the sea off the Drowned Coast and did not go out. The next morning Anka walked out of the surf, a dancer in ember-red and gold with a fan of feathers, and she has burned and risen many times since. The Noonsworn call her the sun's promise: proof that what falls can rise. She is fragile, and she always knows where she will come back, because she leaves her embers on the ground for it. Mortis has buried her three times. She has never stayed. She climbs to find the rest of the fire she came from, and to give it back to the sky.",
  "ties": [
   {
    "other": "Mortis",
    "kind": "sworn enemy of",
    "pair": "sworn enemies",
    "what": "He keeps the dead in the ground; she will not stay there. He has buried her three times",
    "strong": true
   }
  ]
 },
 "Cantor": {
  "faction": "noonsworn",
  "place": "aubade",
  "from": "The choir loft of Aubade; once the Tower's top",
  "age": "Looks 50. He was 30 and singing the Hymn of Noon when the sun fell (Noon-touched).",
  "line": "\"On the beat. Always on the beat.\"",
  "legend": "The sun was held up, the old songs say, by the Hymn of Noon, sung every midday from the Tower's top by a choir of a hundred. On the day of the Fall the choir sang and the sun fell anyway, and only two singers came down: Cantor and Mum. He still knows every verse, and he is the last who does. He sings on the beat, because the Hymn was a beat before it was a song, and a note off the beat goes sour. He has walked the Field of Banners singing the dead armies their marching songs. He fights in the Ring for the right to climb, to sing the Hymn once more where it was meant to be sung.",
  "ties": [
   {
    "other": "Mum",
    "kind": "old flame of",
    "pair": "old flames",
    "what": "They sang the Hymn of Noon side by side on the day it failed. She has made no sound since; he has not stopped singing to her",
    "strong": true
   }
  ]
 },
 "Opaline": {
  "faction": "noonsworn",
  "place": "deep",
  "from": "A glass-cutter's house at the top of the Prism Stair",
  "age": "Looks 28. She was 8 when the sun fell (Noon-touched); her sister Silvane was 12.",
  "line": "\"White is only every colour, waiting.\"",
  "legend": "When the sun fell, its light did not all go out. Much of it ran down into the Deep and hid in the crystals there, which is why the Deep's halls glow. Opaline goes down the Prism Stair and breaks that light out again, cutting it into its colours to find the one the sun has lost. She is calm, pale and patient, with a ring of prisms circling her head and a voice that never rises. The Noonsworn want every drop of the old light for the sun; the miners want it for their lamps, and Mabel has told her so with her claws. Her sister Silvane keeps light the other way, in a mirror, and they no longer speak.",
  "ties": [
   {
    "other": "Silvane",
    "kind": "sister of",
    "pair": "sisters",
    "what": "Two sisters of the glass: one breaks the sun's light free for the Noonsworn, one keeps it in a mirror for the Court",
    "strong": true
   },
   {
    "other": "Mabel",
    "kind": "rival of",
    "pair": "rivals",
    "what": "Opaline takes the Deep's light up to Aubade; Mabel wants it left for the miners who dug to it",
    "strong": false
   }
  ]
 },
 "Vesper": {
  "faction": "dusk",
  "place": "gloaming",
  "from": "Her castle on the Gloaming heights",
  "age": "She was 35 when the light left her lands, and blood has kept her there for a hundred years.",
  "line": "\"Come closer. I'm already paying.\"",
  "legend": "Vesper was a countess of Gloaming when the sun still rose there, and a pale one even then. On the day of the Fall the light left her lands first and came back last, and in that long twilight she found she no longer needed it. She needed blood. She pays for every spell in her own and drinks it back from her enemies, and she has learned to go low, close to empty, before she feeds. She leads the Court of Dusk, which owes its age to the dark, and she will not let the Noonsworn hang a sun that would burn her where she stands. The Court's long nights are bought on credit, and Mr. Ledger holds the note.",
  "ties": [
   {
    "other": "Auriel",
    "kind": "sworn enemy of",
    "pair": "sworn enemies",
    "what": "The dawn, and the countess who would keep it from coming. Every duel between them is the Noonsworn against the Court",
    "strong": true
   },
   {
    "other": "Mr. Ledger",
    "kind": "owes",
    "pair": "owes",
    "what": "The Court's long nights were bought on credit from the Tally, and Ledger holds the note, with interest",
    "strong": false
   },
   {
    "other": "Nyx",
    "kind": "ward of",
    "pair": "guardian",
    "what": "Nyx is the Countess's knife, and stands in her shadow wherever she goes",
    "strong": false
   }
  ]
 },
 "Silvane": {
  "faction": "dusk",
  "place": "gloaming",
  "from": "The Mirror Hall of Gloaming",
  "age": "Looks 32. She was 12 when she caught the sun's last light in a hand mirror (Noon-touched).",
  "line": "\"Look at yourself. Now look again.\"",
  "legend": "Silvane keeps the Court of Dusk's mirrors, and through them its secrets. She is a duchess of Gloaming, tall and calm, in violet and silver, with a collar of mirror shards fanned behind her head. When the sun fell she caught its last light in a hand mirror and has never let it out: its glass still glows pale blue. Her sister Opaline went to the Noonsworn to set light free; Silvane stayed to keep it. She fights with real mirrors, throwing them off walls and walking to catch them, and the one glass she will not throw is that first mirror, which is the only thing on the Dial that can turn Lithea's gaze.",
  "ties": [
   {
    "other": "Opaline",
    "kind": "sister of",
    "pair": "sisters",
    "what": "Two sisters of the glass: one breaks the sun's light free for the Noonsworn, one keeps it in a mirror for the Court",
    "strong": true
   },
   {
    "other": "Sir Whiskers",
    "kind": "owes",
    "pair": "owes",
    "what": "He spent one of his lives for her, and she has not paid it back",
    "strong": false
   }
  ]
 },
 "Mortis": {
  "faction": "dusk",
  "place": "gloaming",
  "from": "The ossuaries under Gloaming",
  "age": "His bones are some three hundred years old. He stopped counting the rest.",
  "line": "\"Rest is for those who have somewhere to be.\"",
  "legend": "Under Gloaming lie the ossuaries, halls of bone older than the Court, and Mortis is their lord. Every dead thing that falls near him leaves its bones, and every bone is his to raise. Since the Fall the dead of the Dial have been restless, and Mortis offers them work: walls, spires, soldiers, a place to stand. He thinks of it as a kindness. Ostrel, who ferries the dead across to rest, thinks of it as theft, and Morwen lays her salt so that his skeletons cannot reach the Ring's crowd. He has buried Anka three times, the only body that would not stay. He fights in the Ring for more ground, and to bury her a fourth time.",
  "ties": [
   {
    "other": "Anka",
    "kind": "sworn enemy of",
    "pair": "sworn enemies",
    "what": "He keeps the dead in the ground; she will not stay there. He has buried her three times",
    "strong": true
   }
  ]
 },
 "Nyx": {
  "faction": "dusk",
  "place": "gloaming",
  "from": "The walls of the Night Temple, where her shadow first fell",
  "age": "A hundred years old, every one of them as a shadow; she looks 25.",
  "line": "\"You looked away. That's all it takes.\"",
  "legend": "Nyx is the Court's knife. In Gloaming they say she was a shadow before she was a woman: a shape thrown long across a wall by the sun's last light at the moment of the Fall, which simply walked away from the wall. She wears matte black with a violet edge and nothing that could catch the light. She fades when she is left alone, and her first strike out of the fade is the one that counts. She guards Vesper and hunts whoever the Court names, mostly in the thickets of the Walking Wood. Lyra's stars are the one light she cannot step out of, and Arden has tracked her for ten years without finding a footprint.",
  "ties": [
   {
    "other": "Lyra",
    "kind": "rival of",
    "pair": "rivals",
    "what": "The shadow and the star archer: Lyra's stars are the one light Nyx cannot step out of",
    "strong": true
   },
   {
    "other": "Vesper",
    "kind": "guardian of",
    "pair": "guardian",
    "what": "Nyx is the Countess's knife, and stands in her shadow wherever she goes",
    "strong": false
   }
  ]
 },
 "Mum": {
  "faction": "dusk",
  "place": "gloaming",
  "from": "The harlequins' hall of the Court of Dusk",
  "age": "Looks 46. She was 26 and singing beside Cantor when the sun fell (Noon-touched).",
  "line": "\"(Nothing. A pale glove rises, palm out. The wall is already there.)\"",
  "legend": "Mum sang in the Hymn of Noon on the day of the Fall, beside Cantor, and when the sun fell anyway she stopped making sound of any kind. She came down from the Tower in a porcelain mask and found a home at the Court of Dusk, which values people who say nothing. She is its harlequin: she plays the Court's revels in her coat of ivory diamonds, and nobody at court has heard her laugh. In the Ring her walls and her ball cannot be seen, only the chalk lines she leaves on the floor, as if the world had to be drawn back in by hand. Cantor still sings to her. She has never answered, and never left the room.",
  "ties": [
   {
    "other": "Cantor",
    "kind": "old flame of",
    "pair": "old flames",
    "what": "They sang the Hymn of Noon side by side on the day it failed. She has made no sound since; he has not stopped singing to her",
    "strong": true
   }
  ]
 },
 "Fenna": {
  "faction": "greenwood",
  "place": "wood",
  "from": "The Moot under the Antler Glades",
  "age": "Looks 35. She was 15 when the Wood began to walk (Noon-touched).",
  "line": "\"Stand still. Let something grow.\"",
  "legend": "The Walking Wood began walking on the day of the Fall, as if it had felt the sun go and set off to find it, and Fenna has kept it from trampling the Dial ever since. She is the Grove Warden of the Moot: a cloak of layered leaves, a pale bark collar, branches like antlers round her head, and a living staff that blooms in her hand. Wherever she fights she plants flowers, and she draws strength from standing among them. She holds the gate of the Wood. She argues with Hank about every tree he fells, and has never once won the argument, or lost it. Vitriol's fumes killed a whole garden of hers, and she has not forgotten.",
  "ties": [
   {
    "other": "Hank",
    "kind": "rival of",
    "pair": "rivals",
    "what": "She grows them, he fells them. They argue every day and share a fire every winter",
    "strong": true
   },
   {
    "other": "Vitriol",
    "kind": "sworn enemy of",
    "pair": "sworn enemies",
    "what": "His fumes killed a whole garden of hers, and he called it a successful test",
    "strong": false
   }
  ]
 },
 "Hank": {
  "faction": "greenwood",
  "place": "wood",
  "from": "A woodcutter's hut at the Walking Wood's edge",
  "age": "Looks 42. He was 22 and already felling trees when the sun fell (Noon-touched).",
  "line": "\"Timber. Mind your heads.\"",
  "legend": "When the Walking Wood walks into a village, someone has to ask it to leave, and Hank asks with an axe. He is the Moot's woodcutter: huge and quiet, with a braided beard, a moss-green tunic, a fur mantle and a great axe whose edges glow green. He grows trees too, fast, because a felled tree must be paid back with a planted one. Fenna calls him a butcher and he calls her a gardener; both are right, and they have shared a fire every winter for twenty years. He hunts with Arden and drinks with Bo. He fights in the Ring for the villages at the Wood's edge, which have no champion of their own.",
  "ties": [
   {
    "other": "Fenna",
    "kind": "rival of",
    "pair": "rivals",
    "what": "She grows them, he fells them. They argue every day and share a fire every winter",
    "strong": true
   },
   {
    "other": "Bo",
    "kind": "friend of",
    "pair": "friends",
    "what": "They have shared a fire, a flock and a great many silences",
    "strong": false
   }
  ]
 },
 "Bo": {
  "faction": "greenwood",
  "place": "wood",
  "from": "The high pastures above the Walking Wood",
  "age": "Looks 60. He was 40, with a beard just going silver, when the sun fell (Noon-touched).",
  "line": "\"Easy now. They're only sheep. Mostly.\"",
  "legend": "Bo herds the great flocks of the high pastures where the Walking Wood meets the hills, and has done for longer than his beard has been silver. He is a herdsman-druid: ram horns curling from a bronze headband, a shaggy umber cloak, and a crook hung with a bell that his sheep will follow anywhere. Really they follow whoever is nearest, which he will tell you is a lesson about leaders. He sits on the Moot because somebody has to speak for the hills, and he speaks slowly. He trusts Barry Cloudsley's forecasts, which makes one of them. He fights in the Ring when a quarrel reaches his pastures, and sends the flock in first.",
  "ties": [
   {
    "other": "Hank",
    "kind": "friend of",
    "pair": "friends",
    "what": "They have shared a fire, a flock and a great many silences",
    "strong": false
   },
   {
    "other": "Barry Cloudsley",
    "kind": "friend of",
    "pair": "friends",
    "what": "Shepherds watch the sky, and Bo is the one man on the Dial who trusts Barry's forecasts",
    "strong": false
   }
  ]
 },
 "Pim and Pom": {
  "faction": "greenwood",
  "place": "wood",
  "from": "Grandma Ironknit's cottage, since the winter after the Fall",
  "age": "They look 10 and have for ninety-nine years: fae children age as they please.",
  "line": "\"Pim: Tag! Pom: You're it.\"",
  "legend": "Pim and Pom were left in a woven satchel on Grandma Ironknit's doorstep the winter after the Fall: two fae children with pointed ears who swapped places whenever anybody looked away. Nobody knows which court of the Wood they came from, or whether anyone wants them back. Ironknit raised them anyway. Pim is the one in the acorn-cap helm with the wooden sword, who runs in first; Pom is the one in the blue leaf hood with the slingshot, who stays back and laughs. They share one life between them and tag in and out of a fight as if it were a game, because for them it is. The Moot keeps them because nobody else can.",
  "ties": [
   {
    "other": "Referee Whistler",
    "kind": "rival of",
    "pair": "rivals",
    "what": "The twins hold the Ring's record for cards: thirty-one, all for swapping without asking",
    "strong": false
   },
   {
    "other": "Grandma Ironknit",
    "kind": "ward of",
    "pair": "guardian",
    "what": "She found them on her doorstep the winter after the Fall and raised them as her own",
    "strong": false
   },
   {
    "other": "The Great Zambini",
    "kind": "friend of",
    "pair": "friends",
    "what": "His favourite audience, and his worst assistants",
    "strong": false
   }
  ]
 },
 "Sirix": {
  "faction": "greenwood",
  "place": "wood",
  "from": "The hive-trees of the Walking Wood",
  "age": "Looks 40. He was 20 when the hives woke after the Fall (Noon-touched).",
  "line": "\"Hold still. They only sting what moves.\"",
  "legend": "The hive-trees of the Walking Wood are hollow oaks the size of towers, full of amber wax and wasps, and Sirix is their warden. He wears black chitin plate with hexagonal pauldrons and a crested insect helm, and a swarm follows him like a cloak. The wasps are not his, he says: he is theirs. The hives fly where he asks because he keeps the Wood's flowers safe, and he guards Fenna's gardens because the hives need them. Vela's moths keep the night and his wasps the day. Professor Puff's gas once floated a whole hive-tree out of the Wood, by accident, and the swarm has not forgotten.",
  "ties": [
   {
    "other": "Professor Puff",
    "kind": "rival of",
    "pair": "rivals",
    "what": "Puff's gas once floated a whole hive-tree out of the Wood, and the swarm remembers his face",
    "strong": false
   }
  ]
 },
 "Marin": {
  "faction": "windward",
  "place": "coast",
  "from": "The sea temple of the Drowned Harbour",
  "age": "Looks 32. She was a girl of 12 dancing in the temple when the sea came in (Noon-touched).",
  "line": "\"The sea comes in. The sea goes out. You don't.\"",
  "legend": "When the sun fell, its heat lifted the sea, and the sea came in over the Drowned Harbour and stayed. Marin was a dancer of the harbour's sea temple then, a barefoot girl in sea-glass, and she danced the water back out of the temple with ribbons of tide. She has danced the tide ever since. It turns every few seconds in her hands: high, it pushes; low, it pulls. She holds the gate of the Sea, keeps the harbour lights with the Windward, and lets Gus keep her temple floor wet. Under her tide lies the Gaol of Oaths, and Kessa blames her for every flood.",
  "ties": [
   {
    "other": "Gus",
    "kind": "friend of",
    "pair": "friends",
    "what": "She danced the water out of his temple, and he has kept her floor wet ever since",
    "strong": false
   }
  ]
 },
 "Kaia": {
  "faction": "windward",
  "place": "coast",
  "from": "A storm-callers' tower on the Spires",
  "age": "28. Born 72 years after the Fall, to a sky that had no master.",
  "line": "\"Stand by the rod. It's safer. For me.\"",
  "legend": "Since the Fall the weather of the Dial has had no master, and Kaia means to be one. She is a storm caller of the Spires, in rain-blue, her silver hair bound up, with a tall staff that catches lightning and plants it in the ground as rods. Storms that once came with the seasons now come when they like, and she bends them to the Windward's ships. Barry Cloudsley forecasts the weather; Kaia changes it, mostly to prove him wrong, and they have argued in public for twelve years. Saga's northern light and her lightning have never shared a sky politely. She fights in the Ring because a storm needs somewhere to land.",
  "ties": [
   {
    "other": "Barry Cloudsley",
    "kind": "rival of",
    "pair": "rivals",
    "what": "He forecasts the weather and she changes it to prove him wrong: twelve years of public argument",
    "strong": true
   }
  ]
 },
 "Zephyr": {
  "faction": "windward",
  "place": "coast",
  "from": "The Spires, the sky towers standing in the sea",
  "age": "24. Born on the Spires 76 years after the Fall.",
  "line": "\"Catch up. I'll wait. No, I won't.\"",
  "legend": "Zephyr was born on the Spires, the broken sky towers that stand in the sea, and learned to walk on the wind before he walked on stone. He is lean and quick, in a short teal coat and a very long jade scarf, with a curved blade the Windward's elders forged from a gust. Every dash he makes gives him another gust to spend. He races Pip across the Dial every spring and has lost exactly as often as he has won. He races Ramet's lion across the Glass Flats too, and loses less. He races climbers to the lighthouse of the Sea for practice. He fights in the Ring because standing still bores him.",
  "ties": [
   {
    "other": "Pip",
    "kind": "rival of",
    "pair": "rivals",
    "what": "The fastest feet against the fastest blade; they race across the Dial every spring and the score is even",
    "strong": false
   }
  ]
 },
 "Barry Cloudsley": {
  "faction": "windward",
  "place": "coast",
  "from": "The weather post on the highest Spire",
  "age": "Looks 50. He was 30 and already reading the sky when the sun fell (Noon-touched).",
  "line": "\"And now, the weather. You won't like it.\"",
  "legend": "Barry is the Windward's augur: he reads the sky. Since the Fall that has been the hardest job on the Dial, because the sky no longer keeps its own appointments. He stands on the Spires in a long storm-slate coat with a cloud on his shoulders and a weathervane staff taller than he is, and he calls the forecast every eight seconds, which is as long as any forecast now holds. He is right about the weather more often than anyone alive and still mostly wrong, which he blames, loudly, on Kaia. Bo trusts him, and Professor Puff flies with him. In the Ring his weather hits both heroes, and he is the only one who knows what is coming.",
  "ties": [
   {
    "other": "Kaia",
    "kind": "rival of",
    "pair": "rivals",
    "what": "He forecasts the weather and she changes it to prove him wrong: twelve years of public argument",
    "strong": true
   },
   {
    "other": "Bo",
    "kind": "friend of",
    "pair": "friends",
    "what": "Shepherds watch the sky, and Bo is the one man on the Dial who trusts Barry's forecasts",
    "strong": false
   },
   {
    "other": "Professor Puff",
    "kind": "friend of",
    "pair": "friends",
    "what": "His oldest flying companion: one reads the sky, the other maps it",
    "strong": false
   }
  ]
 },
 "Professor Puff": {
  "faction": "windward",
  "place": "coast",
  "from": "His basket, moored to the Spires between flights",
  "age": "Looks 60. He was 40 and mapping the sky when the sun fell (Noon-touched).",
  "line": "\"Hold your breath. No, really. It helps.\"",
  "legend": "Professor Puff mapped the sky of the Dial before the Fall, from a basket under glass spheres of glowing rose gas, and now that the sky has changed he is mapping it again. He is a small round scholar of the air in an aubergine coat with brass buttons, goggles up on his brow and a brass tank on his back, and he is completely serious about everything. His gas makes whatever it touches swell, which makes enemies larger and easier to hit, and which once floated a whole hive-tree out of the Wood. Sirix has not forgiven him. He argues engines with Ada at every Truce dinner, and Barry is his oldest flying companion.",
  "ties": [
   {
    "other": "Sirix",
    "kind": "rival of",
    "pair": "rivals",
    "what": "Puff's gas once floated a whole hive-tree out of the Wood, and the swarm remembers his face",
    "strong": false
   },
   {
    "other": "Ada",
    "kind": "rival of",
    "pair": "rivals",
    "what": "Two inventors at one table: she wins every argument about engines, he wins every one about flying",
    "strong": false
   },
   {
    "other": "Barry Cloudsley",
    "kind": "friend of",
    "pair": "friends",
    "what": "His oldest flying companion: one reads the sky, the other maps it",
    "strong": false
   }
  ]
 },
 "Gus": {
  "faction": "windward",
  "place": "coast",
  "from": "The sea temple of the Drowned Harbour",
  "age": "65. Born 35 years after the Fall; he has swept the temple for forty years.",
  "line": "\"Mind the floor. I did warn you.\"",
  "legend": "Gus keeps the sea temple of the Drowned Harbour, the one Marin danced dry after the Fall, and he has kept it clean for forty years against the sea, the salt and everyone who walks in. He is a stocky, calm old keeper in grey-blue robes and a broad lacquered hat, with a sweeping staff hung with paper streamers and a bronze urn of glowing temple water. The temple floor is always wet, because he holds that a clean floor is a wet one, and he has put up signs. People slide. That, he will tell you, is their own business. He comes to the Ring when Big Yoko has thrown his salt about again.",
  "ties": [
   {
    "other": "Big Yoko",
    "kind": "friend of",
    "pair": "friends",
    "what": "Yoko throws the salt and Gus sweeps it up, and both think the other is very patient",
    "strong": false
   },
   {
    "other": "Marin",
    "kind": "friend of",
    "pair": "friends",
    "what": "She danced the water out of his temple, and he has kept her floor wet ever since",
    "strong": false
   }
  ]
 },
 "Brannoc": {
  "faction": "underforge",
  "place": "deep",
  "from": "The great forge in the Ember Caldera",
  "age": "Looks 50. He was 30 and already a master smith when the sun fell (Noon-touched).",
  "line": "\"Hotter. Again. Hotter.\"",
  "legend": "Brannoc keeps the great forge of the Underforge, sunk in the Ember Caldera, where the fire of the fallen sun still rises through the rock. He is huge and ash-bearded, in a scorched leather apron, and a forge glows in his own chest: he has no cooldowns, only heat, and at white heat he burns. He taught Ada everything about metal and nothing about patience. Long ago he followed Isolde north, and she froze his forge solid to send him home; it took him a year to light it again, and he has not followed anyone since. He wants the Ember of Aubade for his fire, and fights Orren for it whenever the Ring allows.",
  "ties": [
   {
    "other": "Isolde",
    "kind": "old flame of",
    "pair": "old flames",
    "what": "Fire followed frost north once. She froze his forge solid to send him home, and neither has married",
    "strong": true
   },
   {
    "other": "Madame Cleaver",
    "kind": "old flame of",
    "pair": "old flames",
    "what": "Her cleaver came from his forge, and so did a promise neither of them kept",
    "strong": false
   },
   {
    "other": "Ada",
    "kind": "teacher of",
    "pair": "teacher",
    "what": "He taught her everything about metal, and she built a hammer that swung itself",
    "strong": false
   }
  ]
 },
 "Ada": {
  "faction": "underforge",
  "place": "deep",
  "from": "A workshop above the Underforge's great lift",
  "age": "26. Born 74 years after the Fall; Brannoc's apprentice until her hammer swung itself.",
  "line": "\"Give me ten seconds and something to bolt it to.\"",
  "legend": "Ada was Brannoc's apprentice until she built a hammer that swung itself. She is a slim inventor in a copper coat, with a backpack of brass gears and goggles pushed up on her leather cap, and she builds turrets, drones and hooks faster than she can name them. Most of the Underforge's lifts, pumps and lamps are hers now. She thinks the Heart of Noon is the finest engine the Dial has ever had, and she would like to run the Deep on it. She argues engines with Professor Puff at every Truce dinner, and she has won every argument that did not involve flying.",
  "ties": [
   {
    "other": "Professor Puff",
    "kind": "rival of",
    "pair": "rivals",
    "what": "Two inventors at one table: she wins every argument about engines, he wins every one about flying",
    "strong": false
   },
   {
    "other": "Brannoc",
    "kind": "student of",
    "pair": "teacher",
    "what": "He taught her everything about metal, and she built a hammer that swung itself",
    "strong": false
   }
  ]
 },
 "Bram": {
  "faction": "underforge",
  "place": "deep",
  "from": "The masons' halls of the Underforge",
  "age": "Looks 38. He was 18 when the sun fell (Noon-touched). Gerald is older than the Deep.",
  "line": "\"Gerald says hello. Gerald says goodbye.\"",
  "legend": "Bram builds the halls of the Underforge stone by stone, and he has one friend: Gerald, a limestone pillar with a carved face, who goes everywhere with him. Bram is broad and calm, with carved limestone pauldrons, a leather apron, a rune-cut maul and a glowing amber rune on his chest. He carved the ledge on the Night Temple's eaves where Corbel woke, and they are, oddly, friends. Every year at the Ring's opening he pushes the same stone against Big Yoko, and neither has won. Hesk's golems and Tova's powder both offend him: the first because it is not stone, the second because it is not building.",
  "ties": [
   {
    "other": "Big Yoko",
    "kind": "rival of",
    "pair": "rivals",
    "what": "Every year at the Ring's opening they push the same stone, and neither has moved it farther than the other",
    "strong": false
   }
  ]
 },
 "Mabel": {
  "faction": "underforge",
  "place": "deep",
  "from": "The deepest seams under the southern hills",
  "age": "Looks 40 in mole-folk years. She was 20 when she saw the light run into the crystals (Noon-touched).",
  "line": "\"Mind the hole. Well. Mind the next one.\"",
  "legend": "Mabel is a mole-folk miner of the deepest seams, stout and dark-furred, with a bronze helm topped by a glowing amber crystal lantern and claws as long as daggers, tipped in gold. Her people lived in the Deep before anyone, and they were the first to see the sun's light run down into the crystals after the Fall. She holds that the light belongs to the miners who dug down to it, and she has told Opaline so, with her claws. She keeps the Lamp Road open, digs with Tova and sorts glass with Itzel. In the Ring she goes under the floor, and comes up under you.",
  "ties": [
   {
    "other": "Opaline",
    "kind": "rival of",
    "pair": "rivals",
    "what": "Opaline takes the Deep's light up to Aubade; Mabel wants it left for the miners who dug to it",
    "strong": false
   }
  ]
 },
 "Sefu": {
  "faction": "dune",
  "place": "sands",
  "from": "Tamerit, on the Dune Throne",
  "age": "Looks 44. He was 24 when the sun fell, and took the throne the year after (Noon-touched).",
  "line": "\"Kneel, or be judged standing.\"",
  "legend": "The kings of the Sands always called the sun their father, and when it fell, the Sands said it fell there, into the dunes, which are still warm. Sefu took the Dune Throne the year after, from his sister Asenet, and declared himself the sun's heir: if a sun is to hang over the Tower again, he says, it should be his. He wears layered linen, a gold collar and a striped gold headdress, and carries a sandstone crook. His crook and his sarcophagus Judge his enemies, and a Judged enemy cannot run far. He holds the gate of the Sands and sends his champions to the Ring to win the climb. Auriel calls it heresy. Asenet calls it theft.",
  "ties": [
   {
    "other": "Auriel",
    "kind": "rival of",
    "pair": "rivals",
    "what": "Who owns the sun: the sky, says the Paladin; my father, says the King",
    "strong": false
   }
  ]
 },
 "Vitriol": {
  "faction": "dune",
  "place": "sands",
  "from": "The embalmers' house of Tamerit",
  "age": "Nobody knows: nobody has seen his face. His hands are old.",
  "line": "\"Breathe in. Now let's see what you're made of.\"",
  "legend": "Vitriol is the embalmer of the Dune Throne, the alchemist who keeps its dead kings whole. He wears a dark hood, a pale glass beak mask with round green lenses, and a coat with a bandolier of vials, and nobody at court has seen his face. He knows every reagent that preserves and every one that does the opposite, and in the Ring he lays one on you, then another, and lets them meet. He brewed the curse that Asenet laid on the crown before her exile, and she never paid for it; he has not forgotten. His fumes once killed a garden of Fenna's by the road where he was testing them, and she has not forgotten either.",
  "ties": [
   {
    "other": "Fenna",
    "kind": "sworn enemy of",
    "pair": "sworn enemies",
    "what": "His fumes killed a whole garden of hers, and he called it a successful test",
    "strong": false
   }
  ]
 },
 "Tempo": {
  "faction": "hourkeepers",
  "place": "frostfall",
  "from": "The Hourkeepers' observatory at Frostfall",
  "age": "He looks 40. He has lived a hundred years since the Fall, every moment twice.",
  "line": "\"Again. And again.\"",
  "legend": "When the sun fell, the Tower's shadow stopped telling the hour, and time on the Dial began to slip: an hour here runs long, a morning there comes twice. Tempo is what the Hourkeepers call an unwound hour, a man who fell out of time at the moment of the Fall and has lived every moment twice since. He wears a long dark coat with a clock-dial halo, carries a staff shaped like a minute hand, and every spell he casts plays again. He keeps the great clock at Frostfall, and races the dark through the Deep for practice. He has sworn to wind the Dial up again before Oblivion unmakes the hours altogether.",
  "ties": [
   {
    "other": "Oblivion",
    "kind": "sworn enemy of",
    "pair": "sworn enemies",
    "what": "One keeps the hours; the other wants none left",
    "strong": true
   },
   {
    "other": "Shiori",
    "kind": "comrade of",
    "pair": "comrades",
    "what": "He keeps the hours and she writes them down, and both are always a little behind",
    "strong": false
   }
  ]
 },
 "Shiori": {
  "faction": "hourkeepers",
  "place": "frostfall",
  "from": "The frozen library at Frostfall",
  "age": "30. Born 70 years after the Fall, the last of the great calligraphers.",
  "line": "\"Hold still. You are being written.\"",
  "legend": "The Hourkeepers write the Dial down before it changes, and Shiori is the last of their great calligraphers, the one whose writing comes true. She wears a rice-paper robe with its hem washed in ink and an indigo sash, long black hair held by a brush-shaped pin, and she carries a brush as tall as she is. Her strokes lie wet on the floor, and where two cross, the ink bursts. She taught Lian to fold paper, and Hesk to write the word on a golem's brow. She thinks Mr. Ledger's book is the worst-written history on the Dial, and he thinks hers has too many pictures.",
  "ties": [
   {
    "other": "Mr. Ledger",
    "kind": "rival of",
    "pair": "rivals",
    "what": "Two keepers of the record: she says his book has no pictures, he says hers has no totals",
    "strong": false
   },
   {
    "other": "Tempo",
    "kind": "comrade of",
    "pair": "comrades",
    "what": "He keeps the hours and she writes them down, and both are always a little behind",
    "strong": false
   }
  ]
 },
 "Lyra": {
  "faction": "hourkeepers",
  "place": "frostfall",
  "from": "The observatory at Frostfall, under the pole star",
  "age": "22. Born 78 years after the Fall, under a sky that still kept time.",
  "line": "\"Run. The sky is very big, and I can see all of it.\"",
  "legend": "The stars still keep time, even with the sun gone wrong, and Lyra reads them. She is the Hourkeepers' archer, a night hunter in a starry violet cloak with a gold crescent bow, and her arrows draw constellations between them as they fly. She charts the northern sky with Saga from the observatory at Frostfall, and she hits harder the farther away you stand, because a star is always far. Her stars are the one light Nyx cannot step out of, and the two have duelled in the dark more often than either has told anyone. Sahar of the Sands calls himself the better archer, and she lets him.",
  "ties": [
   {
    "other": "Nyx",
    "kind": "rival of",
    "pair": "rivals",
    "what": "The shadow and the star archer: Lyra's stars are the one light Nyx cannot step out of",
    "strong": true
   }
  ]
 },
 "Grandma Ironknit": {
  "faction": "hourkeepers",
  "place": "wood",
  "from": "A cottage at the Walking Wood's edge, on the Frostfall road",
  "age": "Looks 70. She was 50 and already spinning when the sun fell (Noon-touched).",
  "line": "\"Sit down, dear. You're coming unravelled.\"",
  "legend": "The Hourkeepers say every life on the Dial is a thread, and Grandma Ironknit holds the spindle. She is a tiny old fate-spinner in a dark hooded shawl knitted in bands of rose thread, with two needles as long as swords and a grey cat called Mr. Biscuit, and she knits lives into the cloth of the Dial at Frostfall. She raised Pim and Pom when they turned up on her doorstep, taught Thessa to sew, and fifty years ago turned down Mr. Ledger, who wanted to write her into his book; she knitted him a scarf instead, and he still wears it under the collar. In the Ring she ties her lines across the floor and sends the cat.",
  "ties": [
   {
    "other": "Mr. Ledger",
    "kind": "old flame of",
    "pair": "old flames",
    "what": "Fifty years ago he asked to write her into his book; she knitted him a scarf instead, which he still wears",
    "strong": false
   },
   {
    "other": "Pim and Pom",
    "kind": "guardian of",
    "pair": "guardian",
    "what": "She found them on her doorstep the winter after the Fall and raised them as her own",
    "strong": false
   }
  ]
 },
 "Isolde": {
  "faction": "hourkeepers",
  "place": "frostfall",
  "from": "Frostfall Lake, at the top of the Dial",
  "age": "Looks 48. She was 28 when the sun fell (Noon-touched).",
  "line": "\"Slower. Slower. There.\"",
  "legend": "At the top of the Dial, where the stars turn round the pole, the cold keeps time still, and Isolde guards it. She is the Winter Warden, in white and frost-blue, with a crown of ice spikes fanned behind her head and a long ice spear, and the Hourkeepers' library at Frostfall lies in ice under her watch, where nothing written can fade. Her hits stack the cold on her enemies until they freeze. Long ago Brannoc followed her north, fire to her frost, and she froze his forge solid to send him home; it was the kindest thing she knew how to do. Saga, who dances the northern light, is her sister. Isolde fights to keep the cold, and the past, as they are.",
  "ties": [
   {
    "other": "Brannoc",
    "kind": "old flame of",
    "pair": "old flames",
    "what": "Fire followed frost north once. She froze his forge solid to send him home, and neither has married",
    "strong": true
   }
  ]
 },
 "Oblivion": {
  "faction": "loners",
  "place": "tower",
  "from": "The Tear in the sky above the Tower",
  "age": "Not born. It came through the Tear on the day of the Fall, a hundred years ago.",
  "line": "\"There was something here. Was there?\"",
  "legend": "When the sun fell it tore the sky above the Tower, and something came through the Tear that the Dial has no word for. The Hourkeepers call it the Unmaker. It wears the shape of a towering knight in black plate cracked with glowing pink rifts, with a horned helm, one burning slit for an eye, and a greatsword of void. While it stands still it pulls in whatever is near, and what it pulls in does not always come back. It wants no throne: it wants the Dial unmade, hour by hour, door by door. It holds the gate of the War, where the Banners cannot stop fighting because nothing it touches can end. Wick, Tempo and Thessa have sworn to send it back.",
  "ties": [
   {
    "other": "Wick",
    "kind": "sworn enemy of",
    "pair": "sworn enemies",
    "what": "The keeper of every door, against the thing that makes holes where no door should be",
    "strong": true
   },
   {
    "other": "Tempo",
    "kind": "sworn enemy of",
    "pair": "sworn enemies",
    "what": "One keeps the hours; the other wants none left",
    "strong": true
   }
  ]
 },
 "Sir Whiskers": {
  "faction": "loners",
  "place": "banners",
  "from": "The lynx knights' old keep by the Field of Banners",
  "age": "31 in this life; he is on his fourth of nine.",
  "line": "\"En garde. And do try. It's so much nicer when they try.\"",
  "legend": "Sir Whiskers counts his life in nines, as the lynx knights of old did, and spends lives like coin: on a wager, a lady, a point of honour. He is an upright tawny lynx with black ear tufts, in gunmetal plate with gold filigree and a short wine-red cape, with a long rapier whose amber gem glows, and he is extremely pleased with himself. He has served many courts and belongs to none now; he duels for whoever is most interesting, and lands on his feet. He once spent a life for Silvane, who still owes him for it. He has been trying to catch Kohaku for longer than either will admit, and she has been letting him.",
  "ties": [
   {
    "other": "Silvane",
    "kind": "is owed by",
    "pair": "owes",
    "what": "He spent one of his lives for her, and she has not paid it back",
    "strong": false
   }
  ]
 },
 "The Great Zambini": {
  "faction": "loners",
  "place": "",
  "from": "Everywhere. He says Aubade, Tamerit and Gloaming, on alternate days",
  "age": "He says 39. He has said 39 for sixty years.",
  "line": "\"Pick a hat. Any hat. Wrong.\"",
  "legend": "Nobody knows where The Great Zambini comes from, which is how he likes it. He has played every court on the Dial under a violet spotlight, in a deep violet cape and a tall top hat with a gold star, and he has sworn loyalty to all of them, in writing, more than once. He vanishes under hats, saws things in half and pulls the rabbit out last. Referee Whistler has watched every one of his duels and has never caught him cheating, which convinces Whistler that he always does. He has tried to hire Sahar for the stage, twice. Pim and Pom are his favourite audience and his worst assistants. He fights for the applause.",
  "ties": [
   {
    "other": "Referee Whistler",
    "kind": "rival of",
    "pair": "rivals",
    "what": "The Arbiter has never caught Zambini cheating, and has never once believed he didn't",
    "strong": true
   },
   {
    "other": "Pim and Pom",
    "kind": "friend of",
    "pair": "friends",
    "what": "His favourite audience, and his worst assistants",
    "strong": false
   }
  ]
 }
};

/** The tie between two heroes, as the first one sees it (null: none). */
export function tieBetween(a: string, b: string): LoreTie | null {
  return LORE[a]?.ties.find((t) => t.other === b) ?? null;
}
