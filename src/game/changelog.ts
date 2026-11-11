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
export type NewsTag = 'Heroes' | 'Motion' | 'Raid' | 'Arenas' | 'Controls' | 'Menus' | 'Online' | 'CPU' | 'Balance';

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
    date: '2026-11-11',
    title: 'The Raid grows',
    live: false,
    items: [
      {
        tag: 'Raid',
        title: 'The Heart of Noon',
        text: 'A third boss waits under the hall, through a new gate in the north: the fallen sun itself, a gold face in a molten heart, with two sun blades for hands. Walk through the gaps of its Solar Flare, hold the gold spots on the rim to stop its turning rings, and raise fallen plates of its crust as cover when its heart beats. A tier is now the Warden, Ash and Ember, then the Heart.',
        image: 'news/heart-of-noon.jpg',
        alt: 'The Heart of Noon over its molten floor, its rings down as turning beams of light.',
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
