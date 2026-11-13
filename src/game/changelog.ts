/**
 * The change log the game shows on its News screen (`newsScreen` in main.ts): what a player has now, newest first.
 *
 * Keeping it: when something a player can see or feel changes, add an item to the top release if that one is still
 * `live: false` (not deployed yet), or start a new release above it. When a deploy goes out, set that release's `live`
 * to true and its `date` to the day of the deploy. Write what the player gets, not what was built: no file names, no
 * commit subjects. Leave out what was built and then switched off or replaced (Loser picks; Ash's six pillars, now four).
 * Pictures and clips go in `public/news/` (a clip is a short muted MP4 with a poster picture beside it).
 */

/** What an item is about: its chip on the page. */
export type NewsTag = 'Heroes' | 'Motion' | 'Raid' | 'Tower' | 'Arenas' | 'Controls' | 'Menus' | 'Online' | 'CPU' | 'Balance';

export interface NewsItem {
  tag: NewsTag;
  title: string;
  /** One or two plain sentences. */
  text: string;
  /** A picture under the text (a path under `public/`). */
  image?: string;
  /** A short clip under the text instead: the MP4, and the picture shown until it plays. */
  clip?: string;
  poster?: string;
  /** What the picture or clip shows, for someone who cannot see it. */
  alt?: string;
}

export interface Release {
  /** ISO date: the day it went live; for one not out yet the day it was finished; for the oldest, the day it was made. */
  date: string;
  title: string;
  /** false: built and waiting for the next deploy. */
  live: boolean;
  /** A clip across the top of the release: the MP4, its poster picture and what it shows. */
  lead?: { clip: string; poster: string; alt: string };
  items: NewsItem[];
}

export const CHANGELOG: Release[] = [
  {
    date: '2026-11-13',
    title: 'The Drowned Harbour by day',
    live: false,
    items: [
      {
        tag: 'Tower',
        title: 'Floor 1 is a place, not a platform',
        text: 'The Drowned Harbour is now a town on a real coast in daylight: grass and dirt roads, the market\'s cobbles, tidal flats where the tide comes in, a cliff along the north, houses and woods beyond the edge, and a beach running down into the sea with jetties and boats. Where you walk and fight is the same.',
      },
    ],
  },
  {
    date: '2026-11-13',
    title: 'The Tower: five floors that are worlds',
    live: true,
    items: [
      {
        tag: 'Tower',
        title: 'The Climb: every floor a place to walk through',
        text: 'The Tower screen has a new tab, Climb. A floor is no longer one room but a whole place: you arrive at a camp, its keeper gives you work, enemies roam in packs, and somewhere a ruler waits behind a door. Beat the ruler, then win a duel against the gatekeeper, and the floor above is yours. Alone, with no account; your floor is saved if you leave.',
        image: '/news/tower-worlds.jpg',
        alt: 'The camps of the five floors, each with its keeper and trader: a drowned harbour, a dark green wood, a sandstone canyon, a cavern where only a circle around the hero is lit, and a battlefield where four soldiers stand beside the hero. Last, the Tower screen with a tile for each floor.',
      },
      {
        tag: 'Tower',
        title: 'Five floors, each with its own law',
        text: 'The Drowned Harbour, where the tide floods the low ground. The Walking Wood, where roots close one path and open another every two minutes. The Storm Canyon, where a wall of sand crosses and only the lee of a rock is safe. The Lightless Deep, where you see a few steps and wake crystals to light the halls. The Field of Banners, where you take a side and its soldiers fight beside you.',
      },
      {
        tag: 'Tower',
        title: 'Quests, secrets, a trader and a rival',
        text: 'Each floor has a main quest in steps, two side quests, a named enemy with a bounty, three hidden caches, a lore stone and waystones you wake at after a fall. Enemies drop shards to spend at the camp\'s trader. Another climber waits on every floor for a race or a duel: beat them and they fight beside you against the ruler.',
      },
      {
        tag: 'Tower',
        title: 'Three lives, four stars, and a sigil to keep',
        text: 'A fall costs one of three lives a floor. A cleared floor earns up to four stars: cleared, every quest done, no life lost, under the floor\'s time. And you keep one of the boons you carried as a sigil for every later climb. Sigils count in the Tower only.',
      },
      {
        tag: 'Tower',
        title: 'The weekly Tower is now called Trials',
        text: 'The Tower of short rooms is still there, unchanged, on the Trials tab, with its weekly board. One of its rooms also stands behind a trial door on every floor of the Climb.',
      },
    ],
  },
  {
    date: '2026-11-13',
    title: 'A smoother game',
    live: true,
    items: [
      {
        tag: 'Menus',
        title: 'Fights run smoother',
        text: 'Every fight now takes about a third less work to draw, and it looks the same: duels, the Raid and the Tower all gain. The first spells of a fight no longer make the game stutter, and a big raid asks much less of your processor.',
      },
      {
        tag: 'Menus',
        title: 'A Graphics setting',
        text: 'A new Graphics button at the top of the menu (on a phone with an account: on the Profile screen): High (the look as it was), Medium, Low, and Auto. Auto measures your device before each fight and draws just as sharply as it can while staying smooth. The game remembers your choice.',
      },
      {
        tag: 'Menus',
        title: 'A quicker start',
        text: 'The menu comes up in less than half the time it took, and the first fight starts sooner and without the freeze behind its loading page.',
      },
    ],
  },
  {
    date: '2026-11-12',
    title: 'Quick cast',
    live: true,
    items: [
      {
        tag: 'Controls',
        title: 'Quick cast, as in League',
        text: 'Spells can now go off straight from the key. Hold Q, W, E or R to see the aim and let go to cast (Quick + indicator, the new start), or cast at the cursor the moment you press (Quick), or keep the old way: press to aim, click to cast (Normal). A then a click still attack-moves, as before. Switch with "Casting" under your hero\'s name on the spell bar; the game remembers your choice.',
      },
      {
        tag: 'Menus',
        title: 'Told when a new version is out',
        text: 'When a new version of the game goes up while you have it open, a bar at the top says so, with a Reload button, so you are never left playing the old one.',
      },
    ],
  },
  {
    date: '2026-11-12',
    title: 'Watch a duel',
    live: true,
    items: [
      {
        tag: 'Online',
        title: 'Watch the duels being fought',
        text: 'The Lobbies screen now lists every duel being fought under Live now, with its score and round. Press Watch to see it from above, both heroes as their players move them, until the end; Stop watching takes you back. The two players see an eye and how many are watching, but not who.',
      },
      {
        tag: 'Controls',
        title: 'Walk while holding a mouse side button',
        text: 'Holding a side button on the mouse (push-to-talk in Discord, for example) no longer stops clicks from walking your hero, and it no longer sends the page back.',
      },
    ],
  },
  {
    date: '2026-11-12',
    title: 'The Tower, a Raid for forty, and hero 40',
    live: true,
    items: [
      {
        tag: 'Tower',
        title: 'The Tower: a new way to play',
        text: 'Climb floor by floor, alone, with no account. Each floor is one short room: cross a gauntlet of fire, clear a horde of stair keepers, duel the echo of a hero, break a crystal before its time is out, or simply hold out. Your health carries over, a fall costs one of three lives, and after every floor you take one of three boons: a heal, a power or a relic. Every tenth floor is a guardian. The Tower is the same for everyone and new every Monday: how high can you climb this week?',
        image: '/news/tower.jpg',
        alt: 'The guardian of floor 10, a giant echo of Marin, throws a fan of five beams of light across the Tower\'s round room at Kaia, who stands behind a pillar.',
      },
      {
        tag: 'Online',
        title: 'Obols: earned by playing, kept for later',
        text: 'Your account now earns obols. An online duel pays 40, a win 40 more, and the first win of each day 120 on top. A raid boss beaten with others pays everyone 60, and a cleared tier 150 more. Every account starts with 900. There is no real money anywhere: obols only come from playing.',
      },
      {
        tag: 'Menus',
        title: 'The Shop, closed for now',
        text: 'A new Shop screen shows every hero with its page and its kit. The Shop is closed for now: every hero stays free to play, as before. The obols you earn are kept for when it opens.',
      },
      {
        tag: 'Raid',
        title: 'Raid ranks and the week\'s best runs',
        text: 'The most bosses you beat in one raid with others is your raid rank: Ember from one, Ash from three, Noon from six, Eclipse from nine. It stands on your profile and beside your name in a raid room. The Raid screen now lists this week\'s best runs, and the Tower screen the highest floors players reached.',
        image: '/news/raid-board.jpg',
        alt: 'The Raid screen: the rank Ash beside the line about raids with others, and under it this week\'s three best runs with their bosses and times.',
      },
      {
        tag: 'Heroes',
        title: 'Brannoc: Heat in place of cooldowns',
        text: 'His spells have no cooldowns now. Each one heats his hammer, and a hot spell hits harder. With the bar full the hammer is white-hot: nothing slows him and he hits hardest, but he burns until he Quenches with R, a burst that is bigger the hotter he was.',
        image: '/news/rework-brannoc.jpg',
        alt: 'Brannoc in a duel with his Heat bar full: a white ring at his feet and the numbers of his own burn over his head.',
      },
      {
        tag: 'Heroes',
        title: 'Cantor: only on the beat',
        text: 'His spells have no cooldowns now: he may cast one on every pulse of the ring under him. On the pulse it lands and his Crescendo climbs; off the pulse it goes sour and the Crescendo is gone. A chord at the top of the Crescendo silences, and the Crescendo starts again. Siren Song and Rising Chorus spend it: the more of it, the longer the charm and the bigger the shield.',
        image: '/news/rework-cantor.jpg',
        alt: 'Cantor in a duel striking a gold chord on the pulse, the gold ring of the beat swollen under him and his Crescendo bar part full.',
      },
      {
        tag: 'Heroes',
        title: 'Vesper: no cooldowns, she pays in blood',
        text: 'Every spell of hers can be cast again at once and costs her health: 10 at first and 10 more with each spell, falling again when she holds back. Her hits drink some of it back, and so do ripping her needle out and her Feast. Spend without a pause and the price outruns her: she cannot cast what she cannot pay.',
        image: '/news/rework-vesper.jpg',
        alt: 'Vesper in a duel after a burst of spells, the Price bar under her portrait run up and the cost of each spell floating over her head.',
      },
      {
        tag: 'Balance',
        title: 'Brannoc, Cantor and Vesper, evened out',
        text: 'Each of the three now wins about half its duels against the computer. Cantor\'s chord hits for 22 and grows 9% a step; Brannoc\'s Chain Hammer hits a sixth softer; Vesper\'s needle and Feast hit softer, and she drinks less while she is ahead and more while she is Hungry. The computer plays them better too: it keeps Cantor and Vesper out of a brawler\'s reach, and lets Brannoc\'s hammer land before his next spell. Against a raid boss, which cannot be charmed or silenced, Cantor\'s song and his full Crescendo now strike it instead.',
      },
      {
        tag: 'CPU',
        title: 'The computer\'s Cantor aims his chord',
        text: 'Played by the computer, Cantor struck his chord the same way every time, wherever you stood, and missed most of them. Now he strikes it at you.',
      },
      {
        tag: 'Raid',
        title: 'The Sunburst',
        text: 'Three or more players fight the Heart of Noon in a room of its own: the crater where the sun fell, a round well with eight long rays cut into the stone. Its flare leaves four lanes, its rings are locked by holding a row of gold spots out in a ray, and a plate of its crust falls for every five of you. Each shelters five.',
      },
      {
        tag: 'Raid',
        title: 'The Sunburst turns',
        text: 'The Heart\'s room changes as it does. When its second phase begins, the floor of the well becomes three rings: the inner one stands, the other two turn against each other and carry whoever stands on them. Gold arrowheads show which way each goes. Being carried is not walking, so you can stand still through a heartbeat while the floor moves you; its beams turn against the floor.',
        image: 'news/heart-floor-turns.jpg',
        alt: 'The Sunburst from above: three gold seams round the Heart of Noon, gold arrowheads on the two turning rings pointing opposite ways, the party spread over them, two beams of light across the floor.',
      },
      {
        tag: 'Raid',
        title: 'The crust falls',
        text: 'In the Heart\'s last phase the rings stop, and after each Heartbeat one ray of the room, with its slice of the well, glows along its cracks for nine seconds and drops into the sun for good. Get off it. What is gone burns whoever steps on it. The middle, a spoke of crust to each plate, and the way out never fall, but a long fight ends on very little floor.',
        image: 'news/heart-crust-falls.jpg',
        alt: 'The Sunburst late in a fight: five of its eight rays have fallen away and show the molten sun below; the party stands on the round middle, on narrow spokes of crust and in the rays that are left.',
      },
      {
        tag: 'Raid',
        title: 'Shade the Heart together: for a raid of six or more',
        text: 'A plate of crust falls for every five heroes standing, and each still shelters only five. Raise them all: every plate left lying when the heart beats lets the fire through, and costs everyone a little more, sheltered or not.',
      },
      {
        tag: 'Raid',
        title: 'Take the Blade: for sixteen or more',
        text: 'The Heart throws its two sun blades down beside it. Walk onto one and you hold it aloft for up to twelve seconds: your hits on the Heart count twice, you walk a little slower, and the Heart hunts you with lances of light. A lance that reaches you knocks the blade from your hands, where it lies for someone else. So the rest stand in the lance\'s way: it stops at the first hero in its line, and costs that hero far less.',
        image: 'news/heart-take-the-blade.jpg',
        alt: 'Kaia holds a great gold sun blade over her head, a small sun at its point. From the Heart of Noon a pale orange lane runs toward her and ends at Vesper, who stands in its way.',
      },
      {
        tag: 'Raid',
        title: 'The Ring of Hands: for a full raid',
        text: 'With more than thirty in the raid, the Heart calls the ring: a gold spot for every hero standing appears round it. Hold one for a second and it is yours. Four in five held before the ring closes and the Heart is stunned and kneels; a broken ring burns everyone. The count shows on its cast bar, and its heartbeat goes on meanwhile: walk between the beats.',
        image: 'news/heart-ring-of-hands.jpg',
        alt: 'Forty heroes stand in two rings round the Heart of Noon, each on a small gold circle. The cast bar reads The Ring of Hands, 31 of 32.',
      },
      {
        tag: 'Heroes',
        title: 'Anka, the Firebird: hero 40',
        text: 'A fire dancer with wings of flame and a feather fan, and the first true fire hero. Her feathers stay on the floor as embers, three at most: Fan the Flames makes them burst, Ember Flight carries her to one, and Firebird crosses the arena as a great burning bird. She has less health than any other mage, 460.',
        image: '/news/anka.jpg',
        alt: 'Anka from the front, from behind, walking and striking: a dancer in an ember-red bodice and a feathered skirt, with flame wings swept back and an open feather fan in her left hand.',
      },
      {
        tag: 'Heroes',
        title: 'She rises once from her ashes',
        text: 'The newest ember is her nest and wears a crown of flame. Once a round, a hit that would fell her while a nest burns turns her to ash: an egg glows at the nest, and a moment later she rises there with a quarter of her health, in a flare. Stand on an ember for a second to stamp it out: no ember, no second life.',
        clip: '/news/anka-rise.mp4',
        poster: '/news/anka-rise.jpg',
        alt: 'Anka against Isolde on the Drowned Harbour: she crosses the quay as a firebird, flies back to an ember, falls, an egg glows on the floor, and she rises from it and throws a feather.',
      },
      {
        tag: 'Raid',
        title: 'The Hour Strikes',
        text: 'A raid of three or more fights the Sun Warden in the Hall of Noon, a hall in the shape of a cross. There he calls an hour: three of its four arms fill with sunfire, and the sun road lights up gold in the one safe arm. Run there before the bell strikes. He keeps fighting on the way.',
        image: 'news/hour-strikes.jpg',
        alt: 'The Hall of Noon from above: three arms of the cross glow orange, and a gold road runs up the fourth.',
      },
      {
        tag: 'Raid',
        title: 'The Hall of Noon breaks open',
        text: 'The Warden\'s hall changes as he does. When his second phase begins, the four great blocks of stone between the hall\'s arms crack and fall: stand clear of the walls. The cross becomes one round court strewn with rubble to hide behind, and his rays now reach from one arm into the next.',
        image: 'news/hall-breaks-open.jpg',
        alt: 'The Hall of Noon from far above after its corners have fallen: one round court with rubble in its four corners, the nave and the choir running out of it.',
      },
      {
        tag: 'Raid',
        title: 'The sun comes down',
        text: 'In the Warden\'s last phase sunfire wells up from the Sun Well and spreads for two and a half minutes. It burns whoever stands in it, pushes the party out to the edges of the court and splits it up, and he comes out of the middle to hunt one group at a time.',
        image: 'news/sun-comes-down.jpg',
        alt: 'A wide disc of orange sunfire over the middle of the round court, the party in small groups round its edge.',
      },
      {
        tag: 'Raid',
        title: 'Branded: for a raid of six or more',
        text: 'One hero in eight gets a sun over its head. Five seconds later it bursts. If it is yours, run out of the crowd: the burst burns everyone near you, and one that goes off in a crowd costs the whole party.',
      },
      {
        tag: 'Raid',
        title: 'Carry the Sun: for sixteen or more',
        text: 'A sun shard for every five heroes falls at the far ends of the hall. Carry them home to the Sun Well before Noon lands. His ray comes for the carriers and throws them back, so stand in its way for them. Every shard left out there burns everyone; all home, and he kneels.',
      },
      {
        tag: 'Raid',
        title: 'The Four Hours: for a full raid',
        text: 'With more than thirty in the raid, all four arms of the hall get a task at once: carry shards home, hold the gold circles, break his hour stones, stand in the gold lane. The raid splits into four. Each arm done fills a quarter of his stagger gauge; each arm failed burns the whole hall.',
        image: 'news/four-hours.jpg',
        alt: 'The hall from far above with a word over each arm: CARRY, HOLD, BREAK and STAND, with gold circles, orange lanes and sun shards on the floor.',
      },
      {
        tag: 'Raid',
        title: 'Twin Flames',
        text: 'A party of three or more now fights Ash and Ember both at once, in a room of their own: the Twin Forge, two halls under one roofless forge with a wall of fire down the middle. Half the party fights Ash among his pillars, half Ember over her vents. Bring them down together. Both health bars show on every screen, and if one gets more than 12 points ahead, the other grows furious until you are level again. When one falls the wall goes out, and the last one is everyone\'s. For one or two players they are the tag team they were.',
        image: 'news/twin-flames.jpg',
        alt: 'Half of a party fighting Ember in her hall of the Twin Forge, her fan of fire spread toward them; the wall of fire on the left, and across it Ash among his crystal pillars.',
      },
      {
        tag: 'Raid',
        title: 'The forge cracks into islands',
        text: 'As each twin\'s second phase begins, the floor of its hall cracks: lava opens along four channels and the hall becomes five islands. Bridges of cooled crust join them, but each stands only a while: it glows before it sinks, and another rises somewhere else. Ash\'s Charge shatters every bridge it runs over.',
        image: 'news/twin-forge-cracks.jpg',
        alt: 'Ash among his crystal pillars on an island of dark stone, lava channels crossing his hall with grey bridges over them, the wall of fire running down the middle of the forge.',
      },
      {
        tag: 'Raid',
        title: 'The forge floods',
        text: 'When the first of the two reaches its last phase, the wall of fire goes out for good and lava rises from the walls inward. Both halves of the party are driven onto one island in the middle, where the twins fight side by side and hit harder. Their moves now reach everyone there. Seal a vent to hold the lava back.',
        image: 'news/twin-forge-floods.jpg',
        alt: 'The Twin Forge from far above, flooded with lava from wall to wall except for one rounded island in the middle where the whole party fights both twins.',
      },
      {
        tag: 'Raid',
        title: 'Lantern Chain: for a raid of six or more',
        text: 'Ember\'s lanterns chain heroes together in pairs. Stay close to your partner: drift more than a few steps apart and the chain snaps and burns you both. Then Ash\'s rocks fall on the line through the pair, so step off it, both to the same side.',
        image: 'news/twin-lantern-chain.jpg',
        alt: 'Two pairs of heroes chained by light: in Ash\'s hall a gold chain from Kaia to Brannoc past a crystal pillar, and across the wall of fire a red chain between Vesper and Isolde in Ember\'s hall.',
      },
      {
        tag: 'Raid',
        title: 'Seal the Vents: for sixteen or more',
        text: 'In the last phase each twin opens a vent for every five heroes of its half. One hero must stand on a vent for four seconds to seal it. Every vent sealed draws the lava back, every one left open brings it on faster for both halves, and all of one cast sealed staggers that twin.',
      },
      {
        tag: 'Raid',
        title: 'The Changing of the Flames: for a full raid',
        text: 'With more than thirty in the raid, Ash calls the changing: half of each team is marked, and gates open in the wall of fire for eight seconds. The marked must step through and fight the other twin. Whoever stays is dragged through the fire when the gates shut, and anyone else who steps into a gate burns.',
        image: 'news/twin-changing.jpg',
        alt: 'Two gates of pale light stand open in the wall of fire between Ash\'s hall and Ember\'s; Kaia steps through the middle one, with Vesper and Brannoc beside it.',
      },
      {
        tag: 'Raid',
        title: 'The Heart of Noon',
        text: 'A third boss waits under the hall, through a new gate in the north: the fallen sun itself, a gold face in a molten heart, with two sun blades for hands. Walk through the gaps of its Solar Flare, hold the gold spots on the rim to stop its turning rings, and raise fallen plates of its crust as cover when its heart beats. A tier is now the Warden, Ash and Ember, then the Heart.',
        image: 'news/heart-of-noon.jpg',
        alt: 'The Heart of Noon over its molten floor, its rings down as turning beams of light.',
      },
      {
        tag: 'Raid',
        title: 'Hold Still',
        text: 'The Heart of Noon has a heartbeat. White light runs in over the floor and a ring closes at your feet: when it lands, stand still. Anyone walking on the beat is burnt; standing costs nothing, and you can keep casting. Between beats, run. The rhythm quickens as the heart dies.',
        image: 'news/heart-hold-still.jpg',
        alt: 'White rings of light running in over the floor to the Heart of Noon, and a white ring closing round a hero who stands still.',
      },
      {
        tag: 'Raid',
        title: 'Omens',
        text: 'Each tier of a raid now brings omens that twist both of its fights: lava where a circle lands, a dark room, a boss that rests less or enrages sooner. One at the first tier, two from then on. The hall shows them before you pick.',
      },
      {
        tag: 'Raid',
        title: 'Rare, legendary and dark upgrades',
        text: 'Altars can now glow blue, gold or dark red. Blue upgrades are stronger, gold ones change how you fight (a near miss speeds your cooldowns, a fall leaves you standing once), and a dark pact gives a lot for a price. They come more often the deeper the run goes.',
      },
      {
        tag: 'Raid',
        title: 'Side doors: the Vault and the Shrine',
        text: 'From the second hall on, two side doors open beside the gate. The Vault gives one more upgrade, rare or better, but another omen follows you. The Shrine lifts an omen for some time on your score. Or walk straight on. With a partner, both have to choose the same door.',
      },
    ],
  },
  {
    date: '2026-11-11',
    title: 'Balance: Sirix, Cantor and Nyx',
    live: false,
    items: [
      {
        tag: 'Balance',
        title: 'Sirix: less health',
        text: 'Sirix won far too many duels. His health goes from 720 to 640.',
      },
      {
        tag: 'Balance',
        title: 'Cantor: more health, a louder chord',
        text: 'Cantor lost most of his duels. His health goes from 680 to 740, and Resounding Chord hits for 60 instead of 52.',
      },
      {
        tag: 'Balance',
        title: 'Nyx: more health, a deeper cut',
        text: 'Nyx lost most of her duels. Her health goes from 640 to 680, and Umbral Cut hits for 58 instead of 54 (93 from behind instead of 86).',
      },
    ],
  },
  {
    date: '2026-11-11',
    title: 'Every hero remade, and four new arenas',
    live: true,
    lead: { clip: '/news/duel4.mp4', poster: '/news/duel4.jpg', alt: 'Lyra and Hank duel on the quay of the Drowned Harbour: a wave washes across the stone, tide pools stand on the floor and Hank fells a tree.' },
    items: [
      {
        tag: 'Arenas',
        title: 'Four new arenas, nine in all',
        text: 'The Drowned Harbour, the Sandstone Canyon, the Crystal Cavern and the Fallen Battlefield join the five arenas you know. They are built like the heroes: clean shapes, plain colours, gold on the edges, lantern light.',
        image: '/news/arenas4.jpg',
        alt: 'The four new arenas from the game camera and from the floor: a stone quay with a ship, a canyon court, a crystal cave with a mine track, a battlefield with shields and banners.',
      },
      {
        tag: 'Arenas',
        title: 'Each has its own event',
        text: 'In the harbour two waves wash across the quay and slow whoever they catch. In the canyon two dust devils wander the floor. In the cavern rocks drop from the roof where their shadows show. On the battlefield arrows fall in strips.',
        image: '/news/events4.jpg',
        alt: 'The canyon, the cavern and the battlefield from the game camera, each twice: during its event, and late in a round with quicksand, the cave closing in and fires on the floor.',
      },
      {
        tag: 'Arenas',
        title: 'And its own way of closing in',
        text: 'A long round changes the floor instead of only shrinking it: the tide rises in pools, quicksand pits widen, stone slabs fall and stand as new cover before the cave comes in, and fires spread from the wreckage.',
      },
      {
        tag: 'Heroes',
        title: 'All 39 heroes have a new look',
        text: 'Every hero is rebuilt in one style: realistic bodies with smooth, continuous shapes, each in its own colours and with its signature: Lyra\'s crescent bow and star halo, Isolde\'s crown of ice, Brannoc\'s forge pack, Sir Whiskers\' rapier. Before, the roster was three different styles side by side.',
        image: '/news/heroes4.jpg',
        alt: 'All 39 heroes and the twins Pim and Pom standing in rows, each on a dark round stand with a gold rim, in the new style.',
      },
      {
        tag: 'Motion',
        title: 'Hand-animated motion made for these bodies',
        text: 'Heroes stand, walk, jog, sprint, strike, cast, flinch and fall with animations made for exactly this kind of body, so arms no longer sink into robes and legs no longer fold. Blades are swung, fists and claws strike in turn, flasks and parcels are thrown overhand, and Gus thrusts his staff.',
        clip: '/news/attack4.mp4',
        poster: '/news/attack4.jpg',
        alt: 'Hank lifts his axe over his shoulder and chops down, twice.',
      },
      {
        tag: 'Motion',
        title: 'Staffs upright, shields up',
        text: 'A staff, scepter, spear, wand, lyre, mirror or lantern is carried upright in the left hand, standing and walking; Auriel keeps her shield raised. Swords, hammers and axes are swung in the right hand.',
        clip: '/news/run4.mp4',
        poster: '/news/run4.jpg',
        alt: 'Lyra runs with her crescent bow in her left hand.',
      },
      {
        tag: 'Heroes',
        title: 'Hank\'s axe and Sirix\'s wings',
        text: 'Hank carries a woodsman\'s axe with one blade, held by the end of its haft and low at his side. Sirix has two pairs of pale, see-through wings rising behind his shoulders.',
      },
    ],
  },
  {
    date: '2026-11-10',
    title: 'A new look, and heroes that move like fighters',
    live: true,
    lead: { clip: '/news/fight.mp4', poster: '/news/fight.jpg', alt: 'Big Yoko and Hank duel in Ember Caldera: charges, a felled tree and axe blows.' },
    items: [
      {
        tag: 'Motion',
        title: 'Heroes stand, run and strike with hand-animated motion',
        text: 'Every hero now stands, walks, runs and attacks with clips made by an animator instead of poses built in code: a two-handed chop that lunges in, a fencer\'s stab, a punch with the whole body behind it. Short-legged heroes sprint where tall ones jog.',
        clip: '/news/attack.mp4',
        poster: '/news/attack.jpg',
        alt: 'Hank brings his long axe down in a two-handed chop, then Oblivion swings his greatsword across.',
      },
      {
        tag: 'Motion',
        title: 'Weapons are held the way the weapon asks',
        text: 'A greatsword, a hammer and a long axe are carried across the body in both hands, and both hands stay on through the swing. A sword hangs ready at the side, bare-handed fighters keep their fists up, and a tall staff is walked with like a staff.',
        image: '/news/stances.jpg',
        alt: 'Eight heroes standing, each holding its weapon in its own way.',
      },
      {
        tag: 'Motion',
        title: 'Running',
        text: 'The run is a real run now, with the arms pumping and the weapon carried along. It keeps time with how fast the hero really moves.',
        clip: '/news/run.mp4',
        poster: '/news/run.jpg',
        alt: 'Sir Whiskers runs across the arena with his rapier.',
      },
      {
        tag: 'Heroes',
        title: 'The 19 newest heroes redrawn',
        text: 'Silvane, Bram, Hank, Professor Puff, Sir Whiskers, Mr. Ledger, Mum, Referee Whistler, Madame Cleaver, Gus, Mabel, Grandma Ironknit, Big Yoko, The Great Zambini, Bo, Wick, Barry Cloudsley, Pip, and Pim and Pom have new models, portraits and titles in the mythic look of the first twenty. Their spells play as before.',
        image: '/news/heroes.jpg',
        alt: 'The redrawn heroes side by side.',
      },
      {
        tag: 'Menus',
        title: 'Menus in lacquer and gold',
        text: 'Every menu screen was redrawn: dark lacquer panels with gold corners, screens that rise into place, and on a phone a tab bar along the bottom. The login screen opens with two doors that need no account: duel the CPU, or raid the bosses.',
        image: '/news/menu.jpg',
        alt: 'The Play screen with a hero turning on the left and the roster on the right.',
      },
      {
        tag: 'CPU',
        title: 'The CPU duel lives inside Play',
        text: 'Play has two big tabs over the roster: an online match, or a duel against the CPU with its level and opponent. The hero you see turning on the Play screen now stands and breathes with its weapon in hand.',
      },
      {
        tag: 'Controls',
        title: 'Clicks on cover, and a clearer attack-move',
        text: 'A click on a pillar or a wall walks the hero up to it, not round the far side. Holding A shows your attack reach and rings the enemy the click would hit. Attack-move takes the enemy nearest your click and walks on when it falls, a left-click on an enemy attacks it, and a click made during a dash is carried out on landing.',
      },
      {
        tag: 'Menus',
        title: 'This page',
        text: 'News keeps a record of what changed and when.',
      },
    ],
  },
  {
    date: '2026-11-09',
    title: 'Noonfall, harder bosses and a new Play screen',
    live: true,
    items: [
      {
        tag: 'Raid',
        title: 'Noonfall, the Raid\'s own place',
        text: 'A run is now one place you walk through. Between fights you step onto one of three altars to take an upgrade and leave through a lit gate, and each boss waits in a lair of its own.',
        image: '/news/hall.jpg',
        alt: 'The hall of Noonfall: three altars, each with an upgrade to take.',
      },
      {
        tag: 'Raid',
        title: 'Bosses with bodies of their own',
        text: 'The Sun Warden is a stone sentinel, Ash a magma brute and Ember a flame wraith. Every attack is acted out and strikes at the moment it lands, and each boss has a move that uses its own body: the Warden\'s fists, Ash\'s knuckles, Ember\'s lanterns.',
        image: '/news/raid.jpg',
        alt: 'The Sun Warden sweeps beams of light across his court while a hero dodges.',
      },
      {
        tag: 'Raid',
        title: 'Mechanics you play, and bosses that bite',
        text: 'Turn the light, break the ray, burn your own, seal the vent. Each boss gains a stage at half health and an enrage timer, and Ember a blast that has to be soaked. Ash raises four pillars: his Charge kills, only a pillar stops it, and the pillar breaks.',
      },
      {
        tag: 'Menus',
        title: 'Play became a hero select',
        text: 'Your hero turns on the left with its health, its passive and its four spells; the roster is on the right, and one bar along the bottom starts the fight.',
      },
    ],
  },
  {
    date: '2026-11-07',
    title: 'The Raid',
    live: true,
    items: [
      {
        tag: 'Raid',
        title: 'The Raid: co-op against bosses',
        text: 'The Raid has its own tab for every player, with or without an account. Fight a boss alone or with a friend who joins your room by code. The Sun Warden holds the Sun Court; Ash and Ember are a tag team in the Cinder Pit. A run offers upgrades before each fight, gets harder tier by tier, and ends with a score.',
      },
      {
        tag: 'Raid',
        title: 'Easier to see, kinder to build',
        text: 'A boss standing between the camera and your hero fades so the hero shows through. Three small upgrades can be taken again, so the offers never run out. Ember backs away when you get close and goes round cover to do it.',
      },
    ],
  },
  {
    date: '2026-11-06',
    title: 'Arenas that change',
    live: true,
    items: [
      {
        tag: 'Arenas',
        title: 'Arenas change as a round runs long',
        text: 'Night Temple\'s walls fall and its columns topple, Frostfall Lake\'s ice sinks, Ember Caldera\'s lava rises, Verdant Glade grows roots and thorns, and the floor of Sky Ruins breaks away. A round that still is not over ends in Last stand.',
        image: '/news/arena.jpg',
        alt: 'Night Temple late in a round: its walls are down and sunfire covers the outer floor.',
      },
      {
        tag: 'Online',
        title: 'Old tabs are told to reload',
        text: 'A tab left open across an update shows a Reload bar instead of failing quietly.',
      },
    ],
  },
  {
    date: '2026-11-05',
    title: 'Cover that counts',
    live: true,
    items: [
      {
        tag: 'Controls',
        title: 'Line of sight',
        text: 'The aim strip and the cast strip stop at cover, a skillshot fires where its strip points, and a melee attack needs to see its target. On a phone a tap on a skillshot walks into sight first.',
      },
      {
        tag: 'CPU',
        title: 'A CPU that does not get stuck',
        text: 'The CPU no longer freezes at walls or waits for ever on a goal it cannot reach, and a chase replans when cover gets in the way.',
      },
      {
        tag: 'Menus',
        title: 'Readable spell text',
        text: 'The spell text on every hero\'s panel was made readable, and nothing squeezes on a small laptop screen.',
      },
    ],
  },
  {
    date: '2026-11-04',
    title: '39 heroes',
    live: true,
    items: [
      {
        tag: 'Heroes',
        title: '19 new heroes',
        text: 'The roster went from 20 to 39, among them Hank, Sir Whiskers, Big Yoko, Mabel, Bo, Wick, and the twins Pim and Pom, a hero of two halves.',
      },
      {
        tag: 'Heroes',
        title: 'The first 20 kits rebuilt',
        text: 'Each of the first twenty heroes got a revised kit: a passive, three spells and an ultimate that work together and can be played around.',
      },
      {
        tag: 'Controls',
        title: 'Walking and controls like a MOBA',
        text: 'Right-click to move and attack, A to attack-move, S to stop, an outline on the enemy under the mouse, and heroes that find their way round cover.',
      },
      {
        tag: 'Menus',
        title: 'Small comforts',
        text: 'A Random tile leads every hero picker, a loading page sits between the menu and a fight, and health and resource bars float over both heroes.',
      },
      {
        tag: 'Balance',
        title: 'Tuning passes',
        text: 'The whole roster was tuned against tournaments of CPU duels: new heroes raised, the strongest old kits trimmed.',
      },
    ],
  },
  {
    date: '2026-11-03',
    title: 'Play vs CPU',
    live: true,
    items: [
      {
        tag: 'CPU',
        title: 'Five levels of CPU',
        text: 'Duel the computer at five levels, from Novice to Master, with any hero against any hero.',
      },
    ],
  },
  {
    date: '2026-11-02',
    title: 'Five arenas remade, and play on a phone',
    live: true,
    items: [
      {
        tag: 'Arenas',
        title: 'All five arenas remade',
        text: 'Night Temple, Frostfall Lake, Ember Caldera, Verdant Glade and Sky Ruins were rebuilt with their own cover, and some walls can be broken.',
      },
      {
        tag: 'Controls',
        title: 'Phone play',
        text: 'A stick to move and spells you drag to aim.',
      },
      {
        tag: 'Heroes',
        title: 'Sculpted heroes',
        text: 'The first heroes got new sculpted models.',
      },
    ],
  },
  {
    date: '2026-10-30',
    title: 'Twenty heroes, basic attacks and best of three',
    live: true,
    items: [
      {
        tag: 'Heroes',
        title: 'Twenty heroes',
        text: 'Five waves of heroes brought the roster to twenty, each with a role and a kit shape of its own.',
      },
      {
        tag: 'Controls',
        title: 'Basic attacks',
        text: 'Every hero has a basic attack, melee or ranged, and kits were rebalanced around it.',
      },
      {
        tag: 'Online',
        title: 'Best of three',
        text: 'Online matches are best of three rounds, a round ends on a knock-out, and the server checks what each side claims.',
      },
    ],
  },
  {
    date: '2026-10-29',
    title: 'Arena of Kits begins',
    live: true,
    items: [
      {
        tag: 'Online',
        title: '1v1 duels online',
        text: 'Accounts, matchmaking, lobbies by code and a profile with your record.',
      },
      {
        tag: 'Heroes',
        title: 'The first heroes and their combat',
        text: 'Statuses, shields, dashes, skillshots and summons, and a ring with cover to fight round.',
      },
    ],
  },
];
