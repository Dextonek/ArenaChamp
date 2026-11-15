// Made by pipeline/tools/lore-codex.py from docs/lore/codex/: edit the codex there and run the script again.
// Every page of the Codex: its id, book, title and line (the pages themselves are in codex-<book>.ts, loaded on first need).

export interface CodexEntry { id: string; book: string; title: string; sub: string; hero: string }
export const CODEX_BOOKS: [string, string][] = [["world", "The world"], ["peoples", "Peoples"], ["realms", "Realms"], ["factions", "Factions"], ["heroes", "Heroes"]];
export const CODEX_INDEX: CodexEntry[] = [
{
"id": "world",
"book": "world",
"title": "The Dial",
"sub": "The world of Arena of Kits: a round land laid out like a sundial round a Tower whose shadow stopped.",
"hero": ""
},
{
"id": "history",
"book": "world",
"title": "History of the Dial",
"sub": "From the first star chart to the hundredth summer, and what is happening now.",
"hero": ""
},
{
"id": "peoples/README",
"book": "peoples",
"title": "The peoples of the Dial",
"sub": "",
"hero": ""
},
{
"id": "peoples/aubade",
"book": "peoples",
"title": "Aubade folk",
"sub": "Human. The people of the morning cliffs, who ring the sun up.",
"hero": ""
},
{
"id": "peoples/briar",
"book": "peoples",
"title": "Briarkin",
"sub": "Not human. The fae of the Walking Wood, in their courts under the Underbough.",
"hero": ""
},
{
"id": "peoples/coast",
"book": "peoples",
"title": "Coast folk",
"sub": "Human. The people of the Drowned Coast and the Spires, who read the weather and sail anyway.",
"hero": ""
},
{
"id": "peoples/dune",
"book": "peoples",
"title": "Dune folk",
"sub": "Human. The people of the Sands, children of the oldest court on the Dial.",
"hero": ""
},
{
"id": "peoples/fallborn",
"book": "peoples",
"title": "The Fallborn",
"sub": "Not born. The beings the Noonfall made or let in: the Embers, the Cast, and the Unmade.",
"hero": ""
},
{
"id": "peoples/gloaming",
"book": "peoples",
"title": "Gloaming folk",
"sub": "Human, changed by a hundred years of dusk. The people whose eyes shine back.",
"hero": ""
},
{
"id": "peoples/kiln",
"book": "peoples",
"title": "Kilnborn",
"sub": "Human, changed by the fallen sun's heat. The ash-skinned people of the Deep's halls and forges.",
"hero": ""
},
{
"id": "peoples/longdead",
"book": "peoples",
"title": "The Long Dead",
"sub": "Not living. The bone-lords: the dead of the Dial whose will outlasted their flesh.",
"hero": ""
},
{
"id": "peoples/mole",
"book": "peoples",
"title": "Mole-folk",
"sub": "Not human. The Deep's first people, who call themselves the Loam.",
"hero": ""
},
{
"id": "peoples/ninefold",
"book": "peoples",
"title": "The Ninefold",
"sub": "Not human. The cat-headed knights of the Dial: lynx on the Field, lion at the gate of Tamerit.",
"hero": ""
},
{
"id": "peoples/north",
"book": "peoples",
"title": "Northerners",
"sub": "Human. The people of Frostfall, under the pole star, who write everything down.",
"hero": ""
},
{
"id": "peoples/wood",
"book": "peoples",
"title": "Wood folk",
"sub": "Human, changed by a forest that walks. The horned people of the Walking Wood and the high pastures.",
"hero": ""
},
{
"id": "realms/README",
"book": "realms",
"title": "The realms of the Dial",
"sub": "Nine realms round a Tower, laid out like the hours on a sundial.",
"hero": ""
},
{
"id": "realms/aubade",
"book": "realms",
"title": "Aubade",
"sub": "The white city on the morning cliffs, at the first hour of the Dial.",
"hero": ""
},
{
"id": "realms/banners",
"book": "realms",
"title": "The Field of Banners",
"sub": "The old battlefield at the eighth hour, where the war over the sun was fought and lost by everyone.",
"hero": ""
},
{
"id": "realms/coast",
"book": "realms",
"title": "The Drowned Coast",
"sub": "The south-eastern shore at the fifth hour: the Drowned Harbour, the Lantern Coast, and the Spires standing in the sea.",
"hero": ""
},
{
"id": "realms/deep",
"book": "realms",
"title": "The Deep",
"sub": "The halls under the southern hills, at the sixth and seventh hours, lit by crystals and by the fallen sun's fire.",
"hero": ""
},
{
"id": "realms/frostfall",
"book": "realms",
"title": "Frostfall",
"sub": "The white north at the twelfth hour, under the pole star.",
"hero": ""
},
{
"id": "realms/gloaming",
"book": "realms",
"title": "Gloaming",
"sub": "The castle-city on the north-western heights, at the eleventh hour, where the light fails first.",
"hero": ""
},
{
"id": "realms/sands",
"book": "realms",
"title": "The Sands",
"sub": "The desert of the Dune Throne, at the third and fourth hours, where the sand is still warm.",
"hero": ""
},
{
"id": "realms/tower",
"book": "realms",
"title": "The Tower and the Ring",
"sub": "The centre of the Dial: the Gnomon, the Ring at its foot, the fallen sun beneath, the Tear above.",
"hero": ""
},
{
"id": "realms/wood",
"book": "realms",
"title": "The Walking Wood",
"sub": "The great western forest at the ninth and tenth hours, which began to walk on the day of the Fall.",
"hero": ""
},
{
"id": "climb/README",
"book": "realms",
"title": "The Climb",
"sub": "Fifty floors inside the Tower, in five chapters, each a realm of the Dial as the Tower holds it.",
"hero": ""
},
{
"id": "climb/bestiary",
"book": "realms",
"title": "The bestiary of the Climb",
"sub": "Every kind of enemy on the fifty floors, chapter by chapter, and what it was before the Tower held it.",
"hero": ""
},
{
"id": "climb/deep",
"book": "realms",
"title": "The Deep (floors 31 to 40)",
"sub": "The Climb's fourth chapter: the far halls of the Deep on the night their crystals went out.",
"hero": ""
},
{
"id": "climb/rulers",
"book": "realms",
"title": "The rulers of the Climb",
"sub": "The worst thing each realm had, floor by floor, and the crowns that are the sun's own.",
"hero": ""
},
{
"id": "climb/sands",
"book": "realms",
"title": "The Sands (floors 21 to 30)",
"sub": "The Climb's third chapter: the Storm Canyon in the great storm of the year after the Fall.",
"hero": ""
},
{
"id": "climb/sea",
"book": "realms",
"title": "The Sea (floors 1 to 10)",
"sub": "The Climb's first chapter: the Drowned Harbour on the morning the water came.",
"hero": ""
},
{
"id": "climb/war",
"book": "realms",
"title": "The War (floors 41 to 50)",
"sub": "The Climb's fifth chapter: the Field of Banners in the last days of the war, still being fought.",
"hero": ""
},
{
"id": "climb/wood",
"book": "realms",
"title": "The Wood (floors 11 to 20)",
"sub": "The Climb's second chapter: the Walking Wood in its first year of walking.",
"hero": ""
},
{
"id": "factions/README",
"book": "factions",
"title": "The factions of the Dial",
"sub": "Eight factions and the loners: who wants what from the sun, and how they work against each other.",
"hero": ""
},
{
"id": "factions/dune",
"book": "factions",
"title": "The Dune Throne",
"sub": "The oldest court on the Dial: the sun is the king's father, and the Noon Seat is his.",
"hero": ""
},
{
"id": "factions/dusk",
"book": "factions",
"title": "The Court of Dusk",
"sub": "The nobility of the long evening: the dusk is the Dial's true age, and the Noon Seat must stay empty.",
"hero": ""
},
{
"id": "factions/greenwood",
"book": "factions",
"title": "The Greenwood Moot",
"sub": "The council of the Walking Wood: the Tower drinks the Dial, and its roots must be cut.",
"hero": ""
},
{
"id": "factions/hourkeepers",
"book": "factions",
"title": "The Hourkeepers",
"sub": "The keepers of time and record: nothing can be mended that is not first understood.",
"hero": ""
},
{
"id": "factions/loners",
"book": "factions",
"title": "The loners",
"sub": "Five heroes who belong to no faction, each for a reason of their own.",
"hero": ""
},
{
"id": "factions/noonsworn",
"book": "factions",
"title": "The Noonsworn",
"sub": "The sworn of the dawn: the sun can be hung again, and must be.",
"hero": ""
},
{
"id": "factions/truce",
"book": "factions",
"title": "The Truce of the Ring",
"sub": "The keepers of the Ring: every quarrel settled one against one, and no army on the Dial.",
"hero": ""
},
{
"id": "factions/underforge",
"book": "factions",
"title": "The Underforge",
"sub": "The builders of the Deep: the fallen sun is the best fire the Dial ever had, and it fell to them.",
"hero": ""
},
{
"id": "factions/windward",
"book": "factions",
"title": "The Windward",
"sub": "The readers of the sky and sailors of the sea: mend the sky, by whoever can, and keep the roads open.",
"hero": ""
},
{
"id": "heroes/ada",
"book": "heroes",
"title": "Ada, the Artificer",
"sub": "The Underforge · Kilnborn · from the Deep",
"hero": "Ada"
},
{
"id": "heroes/anka",
"book": "heroes",
"title": "Anka, the Firebird",
"sub": "The Noonsworn · the Fallborn, an Ember · from the Drowned Coast",
"hero": "Anka"
},
{
"id": "heroes/auriel",
"book": "heroes",
"title": "Auriel, the Dawn Paladin",
"sub": "The Noonsworn · Aubade folk · from Aubade",
"hero": "Auriel"
},
{
"id": "heroes/barry-cloudsley",
"book": "heroes",
"title": "Barry Cloudsley, the Sky Augur",
"sub": "The Windward · Coast folk · from the Drowned Coast",
"hero": "Barry Cloudsley"
},
{
"id": "heroes/big-yoko",
"book": "heroes",
"title": "Big Yoko, the Mountain",
"sub": "The Truce of the Ring · Aubade folk · from Aubade",
"hero": "Big Yoko"
},
{
"id": "heroes/bo",
"book": "heroes",
"title": "Bo, the Ramherd",
"sub": "The Greenwood Moot · Wood folk, ram-horned · from the Walking Wood",
"hero": "Bo"
},
{
"id": "heroes/bram",
"book": "heroes",
"title": "Bram, the Stonewright",
"sub": "The Underforge · Kilnborn · from the Deep",
"hero": "Bram"
},
{
"id": "heroes/brannoc",
"book": "heroes",
"title": "Brannoc, the Ashen Smith",
"sub": "The Underforge · Kilnborn · from the Deep",
"hero": "Brannoc"
},
{
"id": "heroes/cantor",
"book": "heroes",
"title": "Cantor, the Last Verse",
"sub": "The Noonsworn · Aubade folk · from Aubade",
"hero": "Cantor"
},
{
"id": "heroes/fenna",
"book": "heroes",
"title": "Fenna, the Grove Warden",
"sub": "The Greenwood Moot · Wood folk · from the Walking Wood",
"hero": "Fenna"
},
{
"id": "heroes/grandma-ironknit",
"book": "heroes",
"title": "Grandma Ironknit, the Weaver",
"sub": "The Hourkeepers · Briarkin, the Spindle court · from the Walking Wood",
"hero": "Grandma Ironknit"
},
{
"id": "heroes/gus",
"book": "heroes",
"title": "Gus, the Temple Keeper",
"sub": "The Windward · Coast folk · from the Drowned Coast",
"hero": "Gus"
},
{
"id": "heroes/hank",
"book": "heroes",
"title": "Hank, the Moss Hewer",
"sub": "The Greenwood Moot · Wood folk · from the Walking Wood",
"hero": "Hank"
},
{
"id": "heroes/isolde",
"book": "heroes",
"title": "Isolde, the Winter Warden",
"sub": "The Hourkeepers · Northerners, lake-born · from Frostfall",
"hero": "Isolde"
},
{
"id": "heroes/kaia",
"book": "heroes",
"title": "Kaia, the Tempest Caller",
"sub": "The Windward · Coast folk · from the Drowned Coast",
"hero": "Kaia"
},
{
"id": "heroes/lyra",
"book": "heroes",
"title": "Lyra, the Star Archer",
"sub": "The Hourkeepers · Northerners · from Frostfall",
"hero": "Lyra"
},
{
"id": "heroes/mabel",
"book": "heroes",
"title": "Mabel, the Deepdelver",
"sub": "The Underforge · Mole-folk · from the Deep",
"hero": "Mabel"
},
{
"id": "heroes/madame-cleaver",
"book": "heroes",
"title": "Madame Cleaver, the Feastmistress",
"sub": "The Truce of the Ring · Dune folk · from the Field of Banners",
"hero": "Madame Cleaver"
},
{
"id": "heroes/marin",
"book": "heroes",
"title": "Marin, the Tide Dancer",
"sub": "The Windward · Coast folk · from the Drowned Coast",
"hero": "Marin"
},
{
"id": "heroes/mortis",
"book": "heroes",
"title": "Mortis, the Ossuary Lord",
"sub": "The Court of Dusk · the Long Dead · from Gloaming",
"hero": "Mortis"
},
{
"id": "heroes/mr-ledger",
"book": "heroes",
"title": "Mr. Ledger, the Tithe-Keeper",
"sub": "The Truce of the Ring · the Long Dead · from the Ring",
"hero": "Mr. Ledger"
},
{
"id": "heroes/mum",
"book": "heroes",
"title": "Mum, the Silent One",
"sub": "The Court of Dusk · Aubade folk · from Gloaming",
"hero": "Mum"
},
{
"id": "heroes/nyx",
"book": "heroes",
"title": "Nyx, the Umbral Stalker",
"sub": "The Court of Dusk · the Fallborn, of the Cast · from Gloaming",
"hero": "Nyx"
},
{
"id": "heroes/oblivion",
"book": "heroes",
"title": "Oblivion, the Unmaker",
"sub": "A loner · the Fallborn, the Unmade · from the Tower",
"hero": "Oblivion"
},
{
"id": "heroes/opaline",
"book": "heroes",
"title": "Opaline, the Lightbreaker",
"sub": "The Noonsworn · Gloaming folk · from the Deep",
"hero": "Opaline"
},
{
"id": "heroes/pim-and-pom",
"book": "heroes",
"title": "Pim and Pom, the Changeling Twins",
"sub": "The Greenwood Moot · Briarkin, the Acorn court · from the Walking Wood",
"hero": "Pim and Pom"
},
{
"id": "heroes/pip",
"book": "heroes",
"title": "Pip, the Wingfoot",
"sub": "The Truce of the Ring · Aubade folk · from the Ring",
"hero": "Pip"
},
{
"id": "heroes/professor-puff",
"book": "heroes",
"title": "Professor Puff, the Aeronaut",
"sub": "The Windward · Coast folk · from the Drowned Coast",
"hero": "Professor Puff"
},
{
"id": "heroes/referee-whistler",
"book": "heroes",
"title": "Referee Whistler, the Arbiter",
"sub": "The Truce of the Ring · Kilnborn · from the Ring",
"hero": "Referee Whistler"
},
{
"id": "heroes/sefu",
"book": "heroes",
"title": "Sefu, the Dune Sovereign",
"sub": "The Dune Throne · Dune folk · from the Sands",
"hero": "Sefu"
},
{
"id": "heroes/shiori",
"book": "heroes",
"title": "Shiori, the Last Brush",
"sub": "The Hourkeepers · Northerners · from Frostfall",
"hero": "Shiori"
},
{
"id": "heroes/silvane",
"book": "heroes",
"title": "Silvane, the Mirror Duchess",
"sub": "The Court of Dusk · Gloaming folk · from Gloaming",
"hero": "Silvane"
},
{
"id": "heroes/sir-whiskers",
"book": "heroes",
"title": "Sir Whiskers, the Lynx Duelist",
"sub": "A loner · the Ninefold, a lynx · from the Field of Banners",
"hero": "Sir Whiskers"
},
{
"id": "heroes/sirix",
"book": "heroes",
"title": "Sirix, the Swarm Warden",
"sub": "The Greenwood Moot · Briarkin, the Hive court · from the Walking Wood",
"hero": "Sirix"
},
{
"id": "heroes/tempo",
"book": "heroes",
"title": "Tempo, the Unwound Hour",
"sub": "The Hourkeepers · Northerners · from Frostfall",
"hero": "Tempo"
},
{
"id": "heroes/the-great-zambini",
"book": "heroes",
"title": "The Great Zambini, the Illusionist",
"sub": "A loner · Briarkin, of no court · from everywhere",
"hero": "The Great Zambini"
},
{
"id": "heroes/vesper",
"book": "heroes",
"title": "Vesper, the Crimson Countess",
"sub": "The Court of Dusk · Gloaming folk · from Gloaming",
"hero": "Vesper"
},
{
"id": "heroes/vitriol",
"book": "heroes",
"title": "Vitriol, the Plague Alchemist",
"sub": "The Dune Throne · Dune folk · from the Sands",
"hero": "Vitriol"
},
{
"id": "heroes/wick",
"book": "heroes",
"title": "Wick, the Doorwarden",
"sub": "The Truce of the Ring · Northerners · from the Ring",
"hero": "Wick"
},
{
"id": "heroes/zephyr",
"book": "heroes",
"title": "Zephyr, the Wind Blade",
"sub": "The Windward · Coast folk · from the Drowned Coast",
"hero": "Zephyr"
}
];
