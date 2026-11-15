// Made by pipeline/tools/lore-codex.py from docs/lore/codex/: edit the codex there and run the script again.
// Every page of the Codex: its id, book, title and line (the pages themselves are in codex-<book>.ts, loaded on first need).

export interface CodexEntry { id: string; book: string; title: string; sub: string; hero: string }
export const CODEX_BOOKS: [string, string][] = [["world", "The world"], ["peoples", "Peoples"], ["realms", "Realms"], ["factions", "Factions"], ["heroes", "Heroes"]];
export const CODEX_INDEX: CodexEntry[] = [
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
"id": "realms/aubade",
"book": "realms",
"title": "Aubade",
"sub": "The white city on the morning cliffs, at the first hour of the Dial.",
"hero": ""
},
{
"id": "heroes/auriel",
"book": "heroes",
"title": "Auriel, the Dawn Paladin",
"sub": "The Noonsworn · Aubade folk · from Aubade",
"hero": "Auriel"
},
{
"id": "heroes/orren",
"book": "heroes",
"title": "Orren, the Sunbearer",
"sub": "The Noonsworn · Aubade folk · from Aubade",
"hero": "Orren"
},
{
"id": "heroes/vesper",
"book": "heroes",
"title": "Vesper, the Crimson Countess",
"sub": "The Court of Dusk · Gloaming folk · from Gloaming",
"hero": "Vesper"
}
];
