---
title: The 19 new heroes, restyled to the game's look
tags: [design, heroes, models, art]
updated: 2026-11-10
status: all 19 built as _v3 and used in the game (2026-11-10); the kit effects and the names are open questions
---

# The 19 new heroes, restyled to the game's look (2026-11-09)

The user, after seeing all 39 side by side (`docs/heroes/lineup_39_before.jpg`): the new batch is "too funky", "kinda not
in the style of the game, let's revise it deeply".

## Why they look like another game

The [art bible](../../docs/ART_BIBLE.md) says the look is **mythic and elegant, never cartoon-goofy**, and a hero figure
carries "the spell theme on the body, the silhouette first". The first 20 do that: mages, knights, a smith, a pharaoh, a
countess, in deep colours with gold trim and one glowing focal piece. The 19 new heroes were made as jokes about modern
jobs, and it shows in four places:

| | First 20 | New 19 |
|---|---|---|
| Theme | fantasy archetypes (a priest-king, a winter warden, a void knight) | modern jobs (a TV weatherman, a postman, a janitor, a referee, an accountant, a chef, a bellhop) |
| Costume | robes, plate, coats, capes, mythic jewellery | suits and ties, shorts and trainers, caps, overalls, jeans, a lab coat |
| Colour | dark body, gold structure, one saturated accent, one glow | bright primaries everywhere: red plaid, sky blue, yellow bags and raincoats, pink |
| Face | big head, big clean eyes, small nose and mouth, calm or fierce | caricature: big noses, moustaches, magnifying glasses, toothy grins, a near-naked giant |
| Props | weapons and focus objects with a gem | everyday things: a mop and bucket, party balloons, a pencil, a whistle, a pointer |

What they share with the first 20, and keep: the big head with big eyes (the first 20's concept notes ask for it too),
the 16-bone rig, the build kit (`blender/heroes/moba_figures.py`), about 35k triangles per model.

## The rules for the restyle

1. **Keep the hero's idea and kit.** Bram still has a pillar, Pip still delivers, Barry still calls the weather. Only
   the figure changes. Every object a spell uses (a bag, a staff, a book) stays on the model in a fantasy form, so the
   kit still reads.
2. **Re-cast the job as a mythic role.** A weatherman becomes a storm augur and a postman becomes a winged messenger.
   The joke stays in the name and the kit; the figure takes it seriously.
3. **Palette:** a dark body (lacquer, deep cloth), gold at the joints, edges and ends, one mid-tone colour in the
   kit's accent, and **one glowing focal piece** in the kit's accent (the art bible's object rule, used for figures).
   No bright saturated plastic colours.
4. **Face:** the shared big head and big eyes, a small nose and a closed or small mouth. No moustaches, magnifying
   glasses, toothy grins, red noses or big ears. Beards are fine if they are shaped like Brannoc's or Sefu's.
5. **Silhouette:** one signature shape bigger than life (a mantle, a halo, wings, a tall staff), readable from the
   game camera, which looks down at about 55°.
6. **No modern clothes:** no suits, ties, shorts, trainers, caps, jeans, overalls or lab coats.

## Each hero

The **Kit visuals** column lists what lives in the kit's effects and traits code, not in the model. It stays cartoon
after this pass unless the user asks (see "Open questions").

| Hero | Now | Restyled as | Signature shape and glow | Kit visuals still cartoon |
|---|---|---|---|---|
| **Barry Cloudsley** (mage) | TV weatherman, blue suit, yellow tie, quiff, pointer, raincoat | **the Sky Augur**, a seer of the sky: a long storm-slate coat to the floor (Kaia owns royal blue), a high collar, gold trim | a mantle of cloud on the shoulders and a staff taller than he is, topped by a gold weathervane ring with the sun, rain and wind glyphs round a glowing sky-blue orb | smiling clouds, the weather card |
| **Big Yoko** (tank) | a near-naked sumo in a red belt | **the Mountain**, a ceremonial wrestler: the giant body kept, dressed like a grand champion at a shrine | a thick straw rope belt tied in two great loops at the back with zigzag paper charms, a crimson stole across the chest, a lacquered apron to the shins, crimson shoulder plates and forearm guards; a glowing crimson crest on the apron | none (ring, salt, dust) |
| **Pip** (skirmisher) | a postboy in shorts with a giant yellow mailbag | **the Wingfoot**, a mythic messenger: a short hooded travelling cloak, a fitted tunic, wrapped legs | small gold wings on a circlet and on his heels, and a courier's pack on his back with sealed scrolls and a glowing gold courier seal; a sealed scroll in his hand | the brown parcel with its FRAGILE sticker, SIGN HERE |
| Silvane (marksman) | a silver ball gown, a tower of violet hair | the Mirror Duchess: a dark violet and silver gown, sleek hair | a standing collar of mirror shards fanned behind her head; the hand mirror's glass glows pale blue | none (the mirrors fit) |
| Bram (bruiser) | a friendly mason, grey shirt, wooden mallet | the Stonewright, a temple mason: carved stone pauldrons, a leather apron with gold-bound tools | a rune-cut stone maul; a glowing amber rune on the chest | Gerald's cartoon faces, the sweat drop |
| Hank (bruiser) | a lumberjack in red plaid, jeans, bobble hat, red nose | the Greenwarden: moss and bark leathers, a fur mantle, a braided beard | a huge double axe with a glowing green rune edge | the TIMBER! word, the birds |
| Professor Puff (mage) | a lab coat, goggled giant eyes, party balloons | the Aeronaut, an alchemist of the air: a long brass-buttoned coat, goggles up on the brow | glowing glass gas spheres on chains above his head instead of balloons; a brass tank on his back | glossy party balloons, POP and PFFT |
| Sir Whiskers (assassin) | a round ginger cat in shiny plate | the Lynx Duelist: leaner, dark plate with gold filigree, a short cape | a long striped tail and a rapier with a gem | the comic strokes and words (MROW) |
| Mr. Ledger (controller) | a thin man in a grey suit, bowler, glasses, giant pencil | the Tithe-Keeper, an arcane notary: long black and oxblood robes, a high collar, gold coin chains | a great book chained to his wrist and a quill staff; a glowing red wax seal | none (paper, coins, stamps fit) |
| Mum (controller) | a mime: beret, Breton stripes, white-painted face | the Silent One, a masked harlequin: a white porcelain mask, a dark coat with ivory diamonds | the big pale gloves, now with gold cuffs and a faint glow; a long dark ribbon | none (chalk lines fit) |
| Referee Whistler (controller) | a small striped referee with a flat top | the Arbiter, an arena judge: a tall black and ivory striped tabard over dark armour | a silver horn on a chain and red and gold sigil tablets at the belt in place of cards | the crossed-out pictograms |
| Madame Cleaver (support) | a chef: white jacket, toque, red apron | the Feastmistress, a war cook: dark leather and crimson, a long apron over mail | the great cleaver with a glowing ember edge; a small cauldron at the hip | the cartoon dishes |
| Gus (controller) | a janitor: overalls, cap, mop, bucket | the Temple Keeper: long grey-blue robes with tied-up sleeves, a broad hat | a ritual sweeping staff with paper streamers and a bronze water urn on a chain | the yellow A-frame sign |
| Mabel (assassin) | a mole in thick glasses and a miner's hat | the Deepdelver, a mole-folk miner: leather armour, small goggles | huge gold-tipped claws and a glowing crystal lantern on the helm | none (holes fit) |
| Grandma Ironknit (support) | a tiny granny, magnifying glasses, pink shawl | the Weaver, an old fate-spinner: a dark hooded shawl with rose thread | needles as long as swords and glowing rose yarn spools | the sweater, Mr. Biscuit |
| Bo (summoner) | an angry shepherd with a sheep under his arm | the Ramherd, a mountain herdsman-druid: a ram-horn hood, a shaggy cloak | a crook of dark wood with a glowing bell | the cartoon sheep |
| The Great Zambini (trickster) | a stage magician, tailcoat, top hat | the Illusionist: the same idea, darker and finer, gold filigree, no curled moustache | the tall hat and parted cape; a wand with a glowing star gem | confetti and cards fit |
| Wick (controller) | a bellhop doorman, red coat, pillbox hat | the Doorwarden, keeper of thresholds: a long dark crimson coat with gold braid, a hood | the ring of great keys with a glowing gem, a small lantern | none (doors fit) |
| Pim and Pom (fighter) | two bright children with backpacks | the Changeling Twins, fae children: pointed ears, leaf and bark clothes in two colours | each twin's weapon glows in their colour; a woven satchel instead of a backpack with a head in it | toys, BONK and RAAH |

## Build

- Each restyled figure is a new class in `blender/heroes/moba_figures.py`, registered as `<theme>_v3` and exported to
  `public/models/heroes/<theme>_v3.glb`, so the `_v2` model stays until the user picks. Switching is one line in
  `MODELS` (`src/heroes.ts`).
- After a switch, `HERO_BODIES` in `src/heroes.ts` is measured again from the new model (the width 90% of the body fits
  in, the height 99% does), so bolts and clicks match the new shape.
- Pilots first: Barry (mage), Big Yoko (tank) and Pip (skirmisher), three body types. Shown to the user side by side
  with the old ones before the other 16.

## The pilots, as built (2026-11-09)

Sheet: `docs/heroes/restyle_pilots_sheet.jpg` (old and new beside Sefu and Kaia, front and the game camera from the front and
from behind). Classes `WeatherMythic`, `SumoMythic` (a subclass of `Sumo`, same body) and `CourierMythic`; registered as
`weather_v3`, `sumo_v3`, `courier_v3`; exported with `moba_figures.export("<theme>_v3")`. The game uses them (`MODELS`).

| Hero | Triangles | Size | Notes |
|---|---|---|---|
| Barry | 42.3k (old 32.5k) | 561 KB | Coat in storm slate after a first try in royal blue read too close to Kaia. Hair from behind still shows three big swept locks. |
| Big Yoko | 48.1k | 637 KB | The first shoulder plates (black, big) read as buns from the game camera; now thin, crimson, smaller, and at a lower resolution (they cost 15k triangles at first). The stole was added to break up the bare body. The old model had 30.8k. |
| Pip | 37.6k (old 31.2k) | 490 KB | A hip satchel first, hidden behind him and his arm; now a pack on his back, wider than he is, which reads from the game camera. |

- Checked: two AI fights each in the real duel with the camera close (Barry against Pip, Big Yoko against Sefu): walk, cast, sway
  and arms all follow, no console errors. The type check passes.
- Portraits (canvas-drawn in each kit) redrawn to the new looks. Titles changed with the look, names kept: "the Sky Augur" (not
  "Stormcaller": Kaia is "the Tempest Caller"), "the Mountain", "the Wingfoot". Catalog pages, the heroes README, `hero-mode.md`
  and `effects.md` follow.
- Hit sizes (`HERO_BODIES`): the 2026-11-04 measuring could not be reproduced from vertices (the same rule gave other numbers for
  the old models too), so the radii stay as they were (the same bodies under new clothes); Barry's height rose to 3.06 for his
  staff, as Kaia's counts hers, and Pip's to 2.36 for his taller head.
- Not checked: a person playing them, a real phone, online.

## The other 16, as built (2026-11-10, user: "Yes, all 16")

Three workers in parallel, one batch each, with the rules above and the pilots' lessons as their brief. Classes in
`blender/heroes/restyle_batch1.py`, `restyle_batch2.py`, `restyle_batch3.py` (loaded by `moba_figures._restyle_batches()`),
exported with `blender/heroes/export_cli.py` (Blender in the background, so several build at once). Sheets:
`docs/heroes/lineup_39_after.jpg` (all 39 as the game loads them) beside `lineup_39_before.jpg`.

| Hero | Title now | Class | Triangles | What changed, and what is still open |
|---|---|---|---|---|
| Silvane | the Mirror Duchess | `MirrorMythic` | 31.0k | Dark violet gown, sleek hair, a fan collar of silver mirror shards, the glass as the glow. Open: the shards read a little spiky. |
| Bram | the Stonewright | `MasonMythic` | 38.6k | Dark tunic, limestone pauldrons, a stone maul with gold bands, a glowing amber medallion. His portrait is now Bram, with Gerald small in the corner (it was Gerald's face). |
| Hank | the Moss Hewer | `TimberMythic` | 39.0k | Moss weave, fur mantle, braided beard, the axe's edges and runes glow green. Not "Greenwarden": Fenna is "the Grove Warden". Open: the runes read a little like a K. |
| Professor Puff | the Aeronaut | `BalloonMythic` | 32.9k | Aubergine coat, goggles on the brow, four glowing glass spheres on chains in place of balloons. Open: the spheres read a little like lanterns. |
| Sir Whiskers | the Lynx Duelist | `CatMythic` | 29.8k | Tawny fur, ear tufts, gunmetal plate with gold edges, a short wine cape. Open: not leaner (the old body is kept). |
| Mr. Ledger | the Tithe-Keeper | `LedgerMythic` | 36.9k | Black and oxblood robes, coin chains, a chained book with a glowing wax seal, a quill staff. Open: the cuffs read as rings. |
| Mum | the Silent One | `MimeMythic` | 34.5k | Porcelain mask, dark hood, a violet coat with ivory diamonds, pale gloves with gold cuffs, a long ribbon. Open: the gloves are near white. |
| Referee Whistler | the Arbiter | `RefereeMythic` | 39.7k | Dark armour, a black and ivory tabard, a crested helm, a silver horn, glowing sigil tablets. Open: the horn is small from the game camera. |
| Madame Cleaver | the Feastmistress | `ChefMythic` | 39.1k | Crimson jerkin over mail, a long leather apron, a headwrap, the cleaver with an ember edge. The cauldron is on her back, not her hip (a hip prop hides behind the arm). |
| Gus | the Temple Keeper | `JanitorMythic` | 30.5k | Grey-blue robes, a broad hat, a short beard, a sweeping staff with a bronze urn of glowing water hung from it. Open: the straw head still reads a little like a mop. |
| Mabel | the Deepdelver | `MoleMythic` | 32.1k | Leather cuirass, bronze helm with a crystal lantern, gold-tipped claws. Open: brown on brown. |
| Grandma Ironknit | the Weaver | `YarnMythic` | 26.4k | Aubergine robe, a hooded shawl, no glasses, a spindle of glowing rose spools on her back. |
| Bo | the Ramherd | `SheepMythic` | 33.5k | A shaggy cloak, a ram-horn band, a crook with a glowing bell. The sheep under his arm is gone (his sheep are the kit's). |
| The Great Zambini | the Illusionist | `MagicMythic` | 31.0k | Indigo tailcoat with gold-edged lapels, a goatee for the curled moustache, a glowing star on the wand. Open: from behind it is nearly the old shape. |
| Wick | the Doorwarden | `DoorMythic` | 34.0k | An oxblood coat with gold braid, a hood, the key ring with a glowing gem, a small lantern. |
| Pim and Pom | the Changeling Twins | `PimMythic`, `PomMythic` | 31.3k, 31.7k | Fae children with pointed ears in leaf tunics (amber and blue), a glowing sword and a glowing sling, a woven satchel for the backpack. |

- The game uses all of them: `MODELS` in `src/heroes.ts` and the two `model:` lines in `src/kits/twins.ts`. The `_v2` files stay.
- `HERO_BODIES`: measured old and new (the vertices' 90% radius and 99% height, `_size` on the sheet page). Radii follow where
  the build changed (Grandma Ironknit 0.54 to 0.4, Bo 0.53 to 0.42, Referee Whistler 0.41 to 0.44); heights follow where a
  tall piece went (Silvane 2.73 to 2.34, Madame Cleaver 2.63 to 2.33, Sir Whiskers 2.39 to 2.33, Mum 2.58 to 2.49, Wick 2.44 to 2.37).
- Portraits, titles and catalog pages follow for each; the heroes README, `hero-mode.md` and `effects.md` too.
- Checked: every model on the sheet page from the front and the game camera; all 39 in one lineup; eight AI fights of 5 s with
  the new heroes (Hank, Mabel, Grandma, Bo, Ledger, Cleaver, Silvane, Wick, the twins, Gus, Puff, Whistler, Whiskers, Mum,
  Zambini, Bram) with no error; type check and build.
- Not checked: a person playing them, the game's own bloom on each (the sheet page has none), a phone, online.

## Open questions for the user

1. (Answered 2026-11-10: "Yes, all 16".)
2. **Kit visuals:** the last column above stays cartoon. Restyle those too (another pass of effects work), or keep the
   jokes in the spells?
3. **Names:** "Barry Cloudsley", "Referee Whistler", "Grandma Ironknit", "Mr. Ledger", "Big Yoko" still sound like the
   old look in the hero select. Renaming touches the kits, the catalog, the server's name check and saved picks.
   Keep them, or rename too?
