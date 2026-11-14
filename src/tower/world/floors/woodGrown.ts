// Made by pipeline/tools/gen-wood11.ts: floor 11, The Walking Wood, at the new size, seed 11002. Made again by that tool; a hand fix is
// kept only until then (pipeline/designs/tower-50.md). Its set pieces are in pieces/floors.ts.
import type { FloorDef } from '../def';
import type { WoodLook } from '../gen/wood';

export const WOOD_11: { seed: number; floor: Omit<FloorDef, 'arena' | 'cover'>; look: WoodLook } = {
 "seed": 11002,
 "floor": {
  "n": 11,
  "id": "wood",
  "name": "The Walking Wood",
  "blurb": "A forest that does not stay where you left it.",
  "tunedAs": 2,
  "ring": 128,
  "start": {
   "x": 0,
   "z": 99.03
  },
  "camp": {
   "x": 0,
   "z": 95.53
  },
  "places": {
   "camp": {
    "id": "camp",
    "name": "The camp",
    "x": 0,
    "z": 93.53,
    "r": 8,
    "stand": {
     "x": 0,
     "z": 97.03
    }
   },
   "den": {
    "id": "den",
    "name": "The hounds’ den",
    "x": -48.85,
    "z": 24.16,
    "r": 9.5,
    "stand": {
     "x": -46.02,
     "z": 23.17
    }
   },
   "bramble": {
    "id": "bramble",
    "name": "The bramble",
    "x": 84.45,
    "z": 36.01,
    "r": 9.5,
    "stand": {
     "x": 84.45,
     "z": 36.01
    }
   },
   "stones": {
    "id": "stones",
    "name": "The old stones",
    "x": 0.95,
    "z": -8.72,
    "r": 7,
    "stand": {
     "x": 0.95,
     "z": -8.72
    }
   },
   "giants": {
    "id": "giants",
    "name": "The giants’ glade",
    "x": 57.45,
    "z": -41.99,
    "r": 9.5,
    "stand": {
     "x": 57.45,
     "z": -41.99
    }
   },
   "thicket": {
    "id": "thicket",
    "name": "The thicket",
    "x": -48.56,
    "z": -48.22,
    "r": 9,
    "stand": {
     "x": -48.56,
     "z": -48.22
    }
   },
   "lampw": {
    "id": "lampw",
    "name": "The west lamp glade",
    "x": -32.01,
    "z": 55.35,
    "r": 7,
    "stand": {
     "x": -32.01,
     "z": 55.35
    }
   },
   "lampe": {
    "id": "lampe",
    "name": "The east lamp glade",
    "x": 37.84,
    "z": 68.55,
    "r": 7,
    "stand": {
     "x": 37.84,
     "z": 68.55
    }
   },
   "heart": {
    "id": "heart",
    "name": "The heart",
    "x": 0,
    "z": -89.81,
    "r": 10,
    "stand": {
     "x": 0,
     "z": -97.81
    }
   }
  },
  "par": 1848,
  "shop": {
   "heal": 30,
   "boon": 55,
   "life": 80,
   "hint": 15
  },
  "law": {
   "kind": "paths",
   "name": "The wood walks",
   "blurb": "Every two minutes roots close three ways and open three others. A glow marks the ways that are open.",
   "every": 120,
   "warn": 8,
   "first": 0,
   "walls": [
    {
     "a": {
      "x": 9.57,
      "z": -49.38
     },
     "b": {
      "x": -5.03,
      "z": -49.2
     },
     "r": 0.7,
     "height": 3.4,
     "set": 0,
     "name": "the heart’s road"
    },
    {
     "a": {
      "x": 25.6,
      "z": -31.47
     },
     "b": {
      "x": 33,
      "z": -18.89
     },
     "r": 0.7,
     "height": 3.4,
     "set": 1,
     "name": "the giants’ road"
    },
    {
     "a": {
      "x": 2.34,
      "z": 32.51
     },
     "b": {
      "x": -10.64,
      "z": 25.83
     },
     "r": 0.7,
     "height": 3.4,
     "set": 0,
     "name": "the old road"
    },
    {
     "a": {
      "x": 6.84,
      "z": 41.22
     },
     "b": {
      "x": 4.12,
      "z": 55.56
     },
     "r": 0.7,
     "height": 3.4,
     "set": 1,
     "name": "the lamp road"
    },
    {
     "a": {
      "x": -55.81,
      "z": -12.06
     },
     "b": {
      "x": -41.21,
      "z": -12
     },
     "r": 0.7,
     "height": 3.4,
     "set": 0,
     "name": "the thicket road"
    },
    {
     "a": {
      "x": 25.8,
      "z": 26.85
     },
     "b": {
      "x": 12.62,
      "z": 33.15
     },
     "r": 0.7,
     "height": 3.4,
     "set": 1,
     "name": "the east road"
    }
   ]
  },
  "enemies": {
   "hound": {
    "id": "hound",
    "name": "Bark hound",
    "blurb": "Fast, and hunts in a pack.",
    "look": "hound",
    "melee": true,
    "hp": 55,
    "share": 0.02,
    "every": 1.2,
    "speed": 4.6,
    "scale": 1.2,
    "shards": 4,
    "color": "#e0a060"
   },
   "sprite": {
    "id": "sprite",
    "name": "Thorn sprite",
    "blurb": "Floats back and throws thorns.",
    "look": "sprite",
    "melee": false,
    "hp": 40,
    "share": 0.022,
    "every": 2.2,
    "speed": 2.6,
    "range": 10,
    "scale": 1.55,
    "shards": 5,
    "color": "#ff7aa8"
   },
   "giant": {
    "id": "giant",
    "name": "Moss giant",
    "blurb": "Slow, heavy, hits hard.",
    "look": "giant",
    "melee": true,
    "hp": 230,
    "share": 0.045,
    "every": 2.6,
    "speed": 1.7,
    "scale": 1.7,
    "shards": 8,
    "color": "#9acd6a"
   },
   "stag": {
    "id": "stag",
    "name": "The Stag-Crowned",
    "blurb": "Guards the glade.",
    "look": "stag",
    "melee": true,
    "hp": 420,
    "share": 0.055,
    "every": 1.5,
    "speed": 3.4,
    "scale": 1.9,
    "shards": 30,
    "color": "#ffe08a"
   },
   "oak": {
    "id": "oak",
    "name": "The Hollow Oak",
    "blurb": "Walks the old road and strikes hard.",
    "look": "oak",
    "melee": true,
    "hp": 620,
    "share": 0.065,
    "every": 2.2,
    "speed": 2,
    "scale": 2.4,
    "shards": 40,
    "color": "#e0c080"
   },
   "root": {
    "id": "root",
    "name": "Feeding root",
    "blurb": "A root that feeds the Elder Root. It cannot move; it throws thorns.",
    "look": "root",
    "melee": false,
    "hp": 150,
    "share": 0.03,
    "every": 3,
    "speed": 0,
    "range": 11,
    "scale": 1.6,
    "shards": 10,
    "color": "#c8f080"
   }
  },
  "packs": [
   {
    "id": "den",
    "at": {
     "x": -48.85,
     "z": 24.16
    },
    "mix": [
     {
      "kind": "hound",
      "n": 4
     }
    ]
   },
   {
    "id": "bramble",
    "at": {
     "x": 84.45,
     "z": 36.01
    },
    "mix": [
     {
      "kind": "sprite",
      "n": 3
     }
    ]
   },
   {
    "id": "giants",
    "at": {
     "x": 57.45,
     "z": -41.99
    },
    "mix": [
     {
      "kind": "giant",
      "n": 2
     }
    ],
    "elite": "stag"
   },
   {
    "id": "oak",
    "at": {
     "x": -3.63,
     "z": -22.04
    },
    "mix": [
     {
      "kind": "oak",
      "n": 1
     }
    ],
    "named": {
     "name": "The Hollow Oak",
     "speed": 1.6,
     "patrol": [
      {
       "x": -3.63,
       "z": -22.04
      },
      {
       "x": -32.59,
       "z": -23.98
      },
      {
       "x": -26.04,
       "z": -78.59
      },
      {
       "x": 7.16,
       "z": -74.65
      },
      {
       "x": -26.04,
       "z": -78.59
      },
      {
       "x": -32.59,
       "z": -23.98
      }
     ],
     "bounty": {
      "shards": 40,
      "relic": true
     }
    }
   },
   {
    "id": "root1",
    "at": {
     "x": -7,
     "z": -91.81
    },
    "mix": [
     {
      "kind": "root",
      "n": 1
     }
    ]
   },
   {
    "id": "root2",
    "at": {
     "x": 7,
     "z": -91.81
    },
    "mix": [
     {
      "kind": "root",
      "n": 1
     }
    ]
   },
   {
    "id": "root3",
    "at": {
     "x": 0,
     "z": -82.81
    },
    "mix": [
     {
      "kind": "root",
      "n": 1
     }
    ]
   }
  ],
  "people": [
   {
    "id": "bo",
    "hero": "Bo",
    "name": "Bo",
    "role": "keeper",
    "at": {
     "x": -2.6,
     "z": 95.93
    },
    "face": 0.4,
    "greet": [
     "Careful, climber. The wood walks, and my sheep walk with it. Three wisps are bound in it, and the Elder Root at its heart is hungry."
    ],
    "quests": [
     "main",
     "bounty"
    ]
   },
   {
    "id": "mortis",
    "hero": "Mortis",
    "name": "Mortis",
    "role": "giver",
    "at": {
     "x": 3.6,
     "z": 95.53
    },
    "face": -0.5,
    "greet": [
     "I dig. I find. I lose things in the finding. Maybe you can bring them back."
    ],
    "quests": [
     "mortis-lamps",
     "mortis-spade"
    ]
   },
   {
    "id": "nyx",
    "hero": "Nyx",
    "name": "Nyx",
    "role": "rival",
    "at": {
     "x": -48.08,
     "z": -60.08
    },
    "face": 0.62,
    "greet": [],
    "quests": []
   },
   {
    "id": "silvane",
    "hero": "Silvane",
    "name": "Silvane",
    "role": "trader",
    "at": {
     "x": -4.6,
     "z": 92.73
    },
    "face": 0.6,
    "greet": [
     "Shards for what you need. The wood takes nothing back, so I take shards."
    ],
    "quests": []
   }
  ],
  "quests": [
   {
    "id": "main",
    "name": "The Heart of the Wood",
    "giver": "bo",
    "main": true,
    "intro": [
     "Free three wisps: stand by each one and it follows you. Lead them to the heart. Then cut the three roots that feed the Elder Root, and its door opens."
    ],
    "steps": [
     {
      "verb": "lead",
      "text": "Free the wisp in the hounds’ den and lead it to the heart",
      "name": "The wisp",
      "look": "wisp",
      "speed": 3,
      "from": {
       "x": -38.4,
       "z": 14.84
      },
      "r": 3,
      "path": [
       {
        "x": -23.95,
        "z": 7.72
       },
       {
        "x": -23.8,
        "z": -28.47
       },
       {
        "x": -24.28,
        "z": -69.01
       },
       {
        "x": 0,
        "z": -97.81
       }
      ]
     },
     {
      "verb": "lead",
      "text": "Free the wisp in the bramble and lead it to the heart",
      "name": "The wisp",
      "look": "wisp",
      "speed": 3,
      "from": {
       "x": 71.73,
       "z": 33.7
      },
      "r": 3,
      "path": [
       {
        "x": 61.15,
        "z": 52.28
       },
       {
        "x": 18.92,
        "z": 81.04
       },
       {
        "x": -16,
        "z": 74.44
       },
       {
        "x": -40.43,
        "z": 39.76
       },
       {
        "x": -23.95,
        "z": 7.72
       },
       {
        "x": -23.8,
        "z": -28.47
       },
       {
        "x": -24.28,
        "z": -69.01
       },
       {
        "x": 0,
        "z": -97.81
       }
      ]
     },
     {
      "verb": "lead",
      "text": "Free the wisp in the thicket and lead it to the heart",
      "name": "The wisp",
      "look": "wisp",
      "speed": 3,
      "from": {
       "x": -45.45,
       "z": -36.38
      },
      "r": 3,
      "path": [
       {
        "x": -24.28,
        "z": -69.01
       },
       {
        "x": 0,
        "z": -97.81
       }
      ]
     },
     {
      "verb": "fell",
      "text": "Cut the three roots that feed the Elder Root",
      "packs": [
       "root1",
       "root2",
       "root3"
      ]
     },
     {
      "verb": "open",
      "text": "Go to the Elder Root’s door",
      "door": "lair"
     }
    ],
    "outro": [
     "The wisps are home, the roots are cut. The Elder Root’s door stands open, far in the north. Rest first, then go in."
    ],
    "reward": {
     "shards": 60,
     "boon": true
    }
   },
   {
    "id": "bounty",
    "name": "The Hollow Oak",
    "giver": "bo",
    "intro": [
     "An oak walks the old road to the heart. Hollow, and a hundred winters old. Fell it and the wood grows calmer."
    ],
    "steps": [
     {
      "verb": "fell-named",
      "text": "Fell the Hollow Oak",
      "pack": "oak"
     }
    ],
    "outro": [
     "A relic from an oak. Keep it."
    ],
    "reward": {
     "shards": 40,
     "relic": true
    }
   },
   {
    "id": "mortis-lamps",
    "name": "The Spore Lamps",
    "giver": "mortis",
    "intro": [
     "Two spore lamps stand in the glades west and east of the camp. Light both, stand by each a moment, and I can see where to dig."
    ],
    "steps": [
     {
      "verb": "light",
      "text": "Light the two spore lamps",
      "things": [
       {
        "id": "lamp1",
        "at": {
         "x": -32.01,
         "z": 55.35
        }
       },
       {
        "id": "lamp2",
        "at": {
         "x": 37.84,
         "z": 68.55
        }
       }
      ],
      "seconds": 2
     }
    ],
    "outro": [
     "Now I can see. Take this, it was in the dirt."
    ],
    "reward": {
     "shards": 35,
     "boon": true
    }
   },
   {
    "id": "mortis-spade",
    "name": "The Lost Spade",
    "giver": "mortis",
    "intro": [
     "My spade lies in the bramble, where the thorns took it. Carry it back to the camp fire. A hit and you drop it."
    ],
    "steps": [
     {
      "verb": "carry",
      "text": "Bring Mortis’s spade from the bramble to the fire",
      "item": "spade",
      "itemName": "The spade",
      "toName": "the camp fire",
      "look": "bundle",
      "plain": true,
      "from": {
       "x": 78.36,
       "z": 23.95
      },
      "to": {
       "x": 1.6,
       "z": 90.63
      },
      "r": 2.2
     }
    ],
    "outro": [
     "My spade! Here, for the trouble."
    ],
    "reward": {
     "shards": 45
    }
   }
  ],
  "caches": [
   {
    "id": "c1",
    "at": {
     "x": -60.89,
     "z": -39.76
    },
    "shards": 25
   },
   {
    "id": "c2",
    "at": {
     "x": 94.89,
     "z": -17.65
    },
    "shards": 30
   },
   {
    "id": "c3",
    "at": {
     "x": -6.14,
     "z": -54.21
    },
    "shards": 20,
    "boon": true
   },
   {
    "id": "c4",
    "at": {
     "x": 39.34,
     "z": 92.18
    },
    "shards": 25
   },
   {
    "id": "c5",
    "at": {
     "x": -69.65,
     "z": 18.76
    },
    "shards": 30
   },
   {
    "id": "c6",
    "at": {
     "x": 36.56,
     "z": -88.37
    },
    "shards": 20,
    "boon": true
   }
  ],
  "waystones": [
   {
    "id": "w1",
    "name": "The den road stone",
    "at": {
     "x": -22.75,
     "z": 41.22
    }
   },
   {
    "id": "w2",
    "name": "The bramble road stone",
    "at": {
     "x": 26.32,
     "z": 55.27
    }
   },
   {
    "id": "w3",
    "name": "The thicket stone",
    "at": {
     "x": -41.61,
     "z": -33.24
    }
   },
   {
    "id": "w4",
    "name": "The old road stone",
    "at": {
     "x": 2.04,
     "z": 8.39
    }
   },
   {
    "id": "w5",
    "name": "The giants’ stone",
    "at": {
     "x": 45.92,
     "z": -28.33
    }
   },
   {
    "id": "w6",
    "name": "The den stone",
    "at": {
     "x": -34.54,
     "z": 22.25
    }
   }
  ],
  "lore": {
   "id": "lore",
   "name": "The root stone",
   "at": {
    "x": -13.82,
    "z": -90.88
   },
   "text": [
    "The wood was a field once. It walked away from the plough and has been walking since.",
    "What you take for paths are roots, and what you take for roots are paths."
   ]
  },
  "doors": [
   {
    "id": "lair",
    "piece": "ruler",
    "name": "The Elder Root’s door",
    "at": {
     "x": 0,
     "z": -108.81
    },
    "r": 2.2,
    "wall": {
     "ax": -3.4,
     "az": -108.81,
     "bx": 3.4,
     "bz": -108.81,
     "r": 0.6,
     "height": 3.8
    },
    "locked": "Roots hold the door shut. Bo has a quest about the wisps."
   },
   {
    "id": "trial",
    "piece": "trial",
    "name": "The Hollow Stump",
    "at": {
     "x": -15.77,
     "z": 97.98
    },
    "r": 2,
    "locked": ""
   },
   {
    "id": "gate",
    "piece": "gate",
    "name": "The gate up",
    "at": {
     "x": 16.45,
     "z": 99.95
    },
    "r": 2.2,
    "needs": {
     "won": "ruler"
    },
    "locked": "The gate is sealed. Its warden answers only once the Elder Root has fallen."
   },
   {
    "id": "rival",
    "piece": "rival",
    "name": "Nyx’s thicket",
    "at": {
     "x": -55.03,
     "z": -59.3
    },
    "r": 2,
    "locked": ""
   }
  ],
  "rival": {
   "hero": "Nyx",
   "goal": "the thicket",
   "mode": "duel",
   "at": {
    "x": -48.08,
    "z": -60.08
   },
   "boon": true,
   "lines": [
    "Another climber. I am Nyx, and I hunt in the dark. Walk through the arch behind me and we see who is quicker. Win, and I fight beside you."
   ]
  }
 },
 "look": {
  "rim": [
   120.55,
   123.44,
   125.35,
   126.05,
   125.47,
   123.72,
   121.03,
   117.71,
   114.14,
   110.63,
   107.45,
   104.75,
   102.53,
   100.69,
   99.06,
   97.41,
   95.52,
   93.25,
   90.55,
   87.51,
   84.36,
   81.43,
   79.11,
   77.8,
   77.86,
   79.51,
   82.81,
   87.64,
   93.69,
   100.5,
   107.47,
   113.99,
   119.5,
   123.51,
   125.76,
   126.14,
   124.81,
   122.11,
   118.53,
   114.64,
   111.06,
   108.28,
   106.71,
   106.53,
   107.75,
   110.17,
   113.43,
   117.06
  ],
  "pieces": [
   {
    "look": "edge",
    "o": {
     "ax": 122.75,
     "az": 7,
     "bx": 123.2,
     "bz": 40.01,
     "r": 0.6,
     "height": 3,
     "kind": "wall",
     "fixed": true
    }
   },
   {
    "look": "edge",
    "o": {
     "ax": 123.2,
     "az": 40.01,
     "bx": 110.57,
     "bz": 70.83,
     "r": 0.6,
     "height": 3,
     "kind": "wall",
     "fixed": true
    }
   },
   {
    "look": "edge",
    "o": {
     "ax": 110.57,
     "az": 70.83,
     "bx": 87.14,
     "bz": 94.14,
     "r": 0.6,
     "height": 3,
     "kind": "wall",
     "fixed": true
    }
   },
   {
    "look": "edge",
    "o": {
     "ax": 87.14,
     "az": 94.14,
     "bx": 58.17,
     "bz": 107.75,
     "r": 0.6,
     "height": 3,
     "kind": "wall",
     "fixed": true
    }
   },
   {
    "look": "edge",
    "o": {
     "ax": 58.17,
     "az": 107.75,
     "bx": 28.38,
     "bz": 112.91,
     "r": 0.6,
     "height": 3,
     "kind": "wall",
     "fixed": true
    }
   },
   {
    "look": "edge",
    "o": {
     "ax": 28.38,
     "az": 112.91,
     "bx": 0,
     "bz": 111.73,
     "r": 0.6,
     "height": 3,
     "kind": "wall",
     "fixed": true
    }
   },
   {
    "look": "edge",
    "o": {
     "ax": 0,
     "az": 111.73,
     "bx": -26.21,
     "bz": 104.81,
     "r": 0.6,
     "height": 3,
     "kind": "wall",
     "fixed": true
    }
   },
   {
    "look": "edge",
    "o": {
     "ax": -26.21,
     "az": 104.81,
     "bx": -48.86,
     "bz": 91.63,
     "r": 0.6,
     "height": 3,
     "kind": "wall",
     "fixed": true
    }
   },
   {
    "look": "edge",
    "o": {
     "ax": -48.86,
     "az": 91.63,
     "bx": -65.58,
     "bz": 72.58,
     "r": 0.6,
     "height": 3,
     "kind": "wall",
     "fixed": true
    }
   },
   {
    "look": "edge",
    "o": {
     "ax": -65.58,
     "az": 72.58,
     "bx": -74.96,
     "bz": 50.28,
     "r": 0.6,
     "height": 3,
     "kind": "wall",
     "fixed": true
    }
   },
   {
    "look": "edge",
    "o": {
     "ax": -74.96,
     "az": 50.28,
     "bx": -78.54,
     "bz": 28.04,
     "r": 0.6,
     "height": 3,
     "kind": "wall",
     "fixed": true
    }
   },
   {
    "look": "edge",
    "o": {
     "ax": -78.54,
     "az": 28.04,
     "bx": -80.06,
     "bz": 7,
     "r": 0.6,
     "height": 3,
     "kind": "wall",
     "fixed": true
    }
   },
   {
    "look": "edge",
    "o": {
     "ax": -80.06,
     "az": 7,
     "bx": -82.11,
     "bz": -15,
     "r": 0.6,
     "height": 3,
     "kind": "wall",
     "fixed": true
    }
   },
   {
    "look": "edge",
    "o": {
     "ax": -82.11,
     "az": -15,
     "bx": -83.04,
     "bz": -40.94,
     "r": 0.6,
     "height": 3,
     "kind": "wall",
     "fixed": true
    }
   },
   {
    "look": "edge",
    "o": {
     "ax": -83.04,
     "az": -40.94,
     "bx": -77.55,
     "bz": -70.55,
     "r": 0.6,
     "height": 3,
     "kind": "wall",
     "fixed": true
    }
   },
   {
    "look": "edge",
    "o": {
     "ax": -77.55,
     "az": -70.55,
     "bx": -60.85,
     "bz": -98.4,
     "r": 0.6,
     "height": 3,
     "kind": "wall",
     "fixed": true
    }
   },
   {
    "look": "edge",
    "o": {
     "ax": -60.85,
     "az": -98.4,
     "bx": -33.12,
     "bz": -116.6,
     "r": 0.6,
     "height": 3,
     "kind": "wall",
     "fixed": true
    }
   },
   {
    "look": "edge",
    "o": {
     "ax": -33.12,
     "az": -116.6,
     "bx": 0,
     "bz": -120.01,
     "r": 0.6,
     "height": 3,
     "kind": "wall",
     "fixed": true
    }
   },
   {
    "look": "edge",
    "o": {
     "ax": 0,
     "az": -120.01,
     "bx": 31.25,
     "bz": -109.62,
     "r": 0.6,
     "height": 3,
     "kind": "wall",
     "fixed": true
    }
   },
   {
    "look": "edge",
    "o": {
     "ax": 31.25,
     "az": -109.62,
     "bx": 56.63,
     "bz": -91.09,
     "r": 0.6,
     "height": 3,
     "kind": "wall",
     "fixed": true
    }
   },
   {
    "look": "edge",
    "o": {
     "ax": 56.63,
     "az": -91.09,
     "bx": 77.01,
     "bz": -70.01,
     "r": 0.6,
     "height": 3,
     "kind": "wall",
     "fixed": true
    }
   },
   {
    "look": "edge",
    "o": {
     "ax": 77.01,
     "az": -70.01,
     "bx": 95.22,
     "bz": -47.98,
     "r": 0.6,
     "height": 3,
     "kind": "wall",
     "fixed": true
    }
   },
   {
    "look": "edge",
    "o": {
     "ax": 95.22,
     "az": -47.98,
     "bx": 111.69,
     "bz": -22.93,
     "r": 0.6,
     "height": 3,
     "kind": "wall",
     "fixed": true
    }
   },
   {
    "look": "edge",
    "o": {
     "ax": 111.69,
     "az": -22.93,
     "bx": 122.75,
     "bz": 7,
     "r": 0.6,
     "height": 3,
     "kind": "wall",
     "fixed": true
    }
   },
   {
    "look": "fire",
    "o": {
     "ax": 0,
     "az": 93.03,
     "bx": 0,
     "bz": 93.03,
     "r": 0.9,
     "height": 0.9,
     "kind": "pillar"
    }
   },
   {
    "look": "tent",
    "o": {
     "ax": -8.5,
     "az": 96.03,
     "bx": -8.5,
     "bz": 96.03,
     "r": 1.7,
     "height": 2.6,
     "kind": "pillar"
    }
   },
   {
    "look": "tent",
    "o": {
     "ax": 8.5,
     "az": 92.03,
     "bx": 8.5,
     "bz": 92.03,
     "r": 1.7,
     "height": 2.6,
     "kind": "pillar"
    }
   },
   {
    "look": "crate",
    "o": {
     "ax": -5,
     "az": 89.53,
     "bx": -5,
     "bz": 89.53,
     "r": 0.8,
     "height": 1.2,
     "kind": "pillar"
    }
   },
   {
    "look": "crate",
    "o": {
     "ax": 5.4,
     "az": 95.73,
     "bx": 5.4,
     "bz": 95.73,
     "r": 0.8,
     "height": 1.2,
     "kind": "pillar"
    }
   },
   {
    "look": "stall",
    "o": {
     "ax": 4.2,
     "az": 100.13,
     "bx": 7,
     "bz": 99.13,
     "r": 0.4,
     "height": 1,
     "kind": "wall"
    }
   },
   {
    "look": "house",
    "o": {
     "ax": -24,
     "az": -107.31,
     "bx": -3.4,
     "bz": -108.81,
     "r": 0.6,
     "height": 3.8,
     "kind": "wall"
    }
   },
   {
    "look": "house",
    "o": {
     "ax": 3.4,
     "az": -108.81,
     "bx": 24,
     "bz": -107.31,
     "r": 0.6,
     "height": 3.8,
     "kind": "wall"
    }
   },
   {
    "look": "rock",
    "o": {
     "ax": -30,
     "az": -113.76,
     "bx": -30,
     "bz": -113.76,
     "r": 5.55,
     "height": 1.6,
     "kind": "pillar"
    }
   },
   {
    "look": "rock",
    "o": {
     "ax": -25,
     "az": -114.26,
     "bx": -25,
     "bz": -114.26,
     "r": 6.05,
     "height": 1.6,
     "kind": "pillar"
    }
   },
   {
    "look": "rock",
    "o": {
     "ax": -20,
     "az": -114.76,
     "bx": -20,
     "bz": -114.76,
     "r": 6.55,
     "height": 1.6,
     "kind": "pillar"
    }
   },
   {
    "look": "rock",
    "o": {
     "ax": -15,
     "az": -115.26,
     "bx": -15,
     "bz": -115.26,
     "r": 7.05,
     "height": 1.6,
     "kind": "pillar"
    }
   },
   {
    "look": "rock",
    "o": {
     "ax": -10,
     "az": -115.26,
     "bx": -10,
     "bz": -115.26,
     "r": 7.05,
     "height": 1.6,
     "kind": "pillar"
    }
   },
   {
    "look": "rock",
    "o": {
     "ax": -5,
     "az": -115.01,
     "bx": -5,
     "bz": -115.01,
     "r": 6.8,
     "height": 1.6,
     "kind": "pillar"
    }
   },
   {
    "look": "rock",
    "o": {
     "ax": 0,
     "az": -115.01,
     "bx": 0,
     "bz": -115.01,
     "r": 6.8,
     "height": 1.6,
     "kind": "pillar"
    }
   },
   {
    "look": "rock",
    "o": {
     "ax": 5,
     "az": -114.51,
     "bx": 5,
     "bz": -114.51,
     "r": 6.3,
     "height": 1.6,
     "kind": "pillar"
    }
   },
   {
    "look": "rock",
    "o": {
     "ax": 10,
     "az": -113.76,
     "bx": 10,
     "bz": -113.76,
     "r": 5.55,
     "height": 1.6,
     "kind": "pillar"
    }
   },
   {
    "look": "rock",
    "o": {
     "ax": 15,
     "az": -113.26,
     "bx": 15,
     "bz": -113.26,
     "r": 5.05,
     "height": 1.6,
     "kind": "pillar"
    }
   },
   {
    "look": "rock",
    "o": {
     "ax": 20,
     "az": -112.51,
     "bx": 20,
     "bz": -112.51,
     "r": 4.3,
     "height": 1.6,
     "kind": "pillar"
    }
   },
   {
    "look": "rock",
    "o": {
     "ax": 25,
     "az": -111.26,
     "bx": 25,
     "bz": -111.26,
     "r": 3.05,
     "height": 1.6,
     "kind": "pillar"
    }
   },
   {
    "look": "rock",
    "o": {
     "ax": 30,
     "az": -110.01,
     "bx": 30,
     "bz": -110.01,
     "r": 1.8,
     "height": 1.6,
     "kind": "pillar"
    }
   },
   {
    "look": "rock",
    "o": {
     "ax": -42.83,
     "az": 96.93,
     "bx": -22.29,
     "bz": 79.71,
     "r": 1.7,
     "height": 9,
     "kind": "wall"
    }
   },
   {
    "look": "rock",
    "o": {
     "ax": -9.72,
     "az": 69.17,
     "bx": 3.54,
     "bz": 58.06,
     "r": 1.7,
     "height": 9,
     "kind": "wall"
    }
   },
   {
    "look": "rock",
    "o": {
     "ax": 3.77,
     "az": 58.09,
     "bx": 14.4,
     "bz": 74.2,
     "r": 1.7,
     "height": 9,
     "kind": "wall"
    }
   },
   {
    "look": "rock",
    "o": {
     "ax": 23.44,
     "az": 87.88,
     "bx": 30.48,
     "bz": 101.09,
     "r": 1.7,
     "height": 9,
     "kind": "wall"
    }
   },
   {
    "look": "rock",
    "o": {
     "ax": 30.48,
     "az": 101.09,
     "bx": 39.86,
     "bz": 112.75,
     "r": 1.7,
     "height": 9,
     "kind": "wall"
    }
   },
   {
    "look": "rock",
    "o": {
     "ax": 14.97,
     "az": -49.43,
     "bx": 9.17,
     "bz": -49.37,
     "r": 1.7,
     "height": 9,
     "kind": "wall"
    }
   },
   {
    "look": "rock",
    "o": {
     "ax": -4.62,
     "az": -49.21,
     "bx": -7.02,
     "bz": -49.18,
     "r": 1.7,
     "height": 9,
     "kind": "wall"
    }
   },
   {
    "look": "rock",
    "o": {
     "ax": 52.72,
     "az": -94.72,
     "bx": 42.34,
     "bz": -84.3,
     "r": 1.7,
     "height": 9,
     "kind": "wall"
    }
   },
   {
    "look": "rock",
    "o": {
     "ax": 42.34,
     "az": -84.3,
     "bx": 33.97,
     "bz": -72.2,
     "r": 1.7,
     "height": 9,
     "kind": "wall"
    }
   },
   {
    "look": "rock",
    "o": {
     "ax": 23.48,
     "az": -59.6,
     "bx": 15.29,
     "bz": -49.76,
     "r": 1.7,
     "height": 9,
     "kind": "wall"
    }
   },
   {
    "look": "rock",
    "o": {
     "ax": -7.37,
     "az": -49.27,
     "bx": -18.95,
     "bz": -62.79,
     "r": 1.7,
     "height": 9,
     "kind": "wall"
    }
   },
   {
    "look": "rock",
    "o": {
     "ax": -29.61,
     "az": -75.24,
     "bx": -41.11,
     "bz": -90.94,
     "r": 1.7,
     "height": 9,
     "kind": "wall"
    }
   },
   {
    "look": "rock",
    "o": {
     "ax": -41.11,
     "az": -90.94,
     "bx": -54.85,
     "bz": -104.71,
     "r": 1.7,
     "height": 9,
     "kind": "wall"
    }
   },
   {
    "look": "rock",
    "o": {
     "ax": -36.9,
     "az": -11.89,
     "bx": -28.47,
     "bz": 0.88,
     "r": 1.7,
     "height": 9,
     "kind": "wall"
    }
   },
   {
    "look": "rock",
    "o": {
     "ax": -19.43,
     "az": 14.56,
     "bx": -12.93,
     "bz": 24.41,
     "r": 1.7,
     "height": 9,
     "kind": "wall"
    }
   },
   {
    "look": "rock",
    "o": {
     "ax": -82.7,
     "az": -12.17,
     "bx": -55.4,
     "bz": -12.06,
     "r": 1.7,
     "height": 9,
     "kind": "wall"
    }
   },
   {
    "look": "rock",
    "o": {
     "ax": -41.61,
     "az": -12,
     "bx": -37.21,
     "bz": -11.98,
     "r": 1.7,
     "height": 9,
     "kind": "wall"
    }
   },
   {
    "look": "rock",
    "o": {
     "ax": -12.71,
     "az": 24.79,
     "bx": -33.21,
     "bz": 35.86,
     "r": 1.7,
     "height": 9,
     "kind": "wall"
    }
   },
   {
    "look": "rock",
    "o": {
     "ax": -47.65,
     "az": 43.65,
     "bx": -60.21,
     "bz": 51.22,
     "r": 1.7,
     "height": 9,
     "kind": "wall"
    }
   },
   {
    "look": "rock",
    "o": {
     "ax": -60.21,
     "az": 51.22,
     "bx": -73.43,
     "bz": 57.57,
     "r": 1.7,
     "height": 9,
     "kind": "wall"
    }
   },
   {
    "look": "rock",
    "o": {
     "ax": 39.16,
     "az": 20.26,
     "bx": 47.19,
     "bz": 5.27,
     "r": 1.7,
     "height": 9,
     "kind": "wall"
    }
   },
   {
    "look": "rock",
    "o": {
     "ax": 47.33,
     "az": 5.19,
     "bx": 69.27,
     "bz": -3.78,
     "r": 1.7,
     "height": 9,
     "kind": "wall"
    }
   },
   {
    "look": "rock",
    "o": {
     "ax": 69.27,
     "az": -3.78,
     "bx": 91.98,
     "bz": -10.52,
     "r": 1.7,
     "height": 9,
     "kind": "wall"
    }
   },
   {
    "look": "rock",
    "o": {
     "ax": 91.98,
     "az": -10.52,
     "bx": 114.42,
     "bz": -18.04,
     "r": 1.7,
     "height": 9,
     "kind": "wall"
    }
   },
   {
    "look": "rock",
    "o": {
     "ax": 89.48,
     "az": 92.87,
     "bx": 79.04,
     "bz": 74.98,
     "r": 1.7,
     "height": 9,
     "kind": "wall"
    }
   },
   {
    "look": "rock",
    "o": {
     "ax": 79.04,
     "az": 74.98,
     "bx": 65.84,
     "bz": 59,
     "r": 1.7,
     "height": 9,
     "kind": "wall"
    }
   },
   {
    "look": "rock",
    "o": {
     "ax": 56.45,
     "az": 45.56,
     "bx": 49.07,
     "bz": 32.23,
     "r": 1.7,
     "height": 9,
     "kind": "wall"
    }
   },
   {
    "look": "rock",
    "o": {
     "ax": 49.07,
     "az": 32.23,
     "bx": 39.11,
     "bz": 20.71,
     "r": 1.7,
     "height": 9,
     "kind": "wall"
    }
   },
   {
    "look": "rock",
    "o": {
     "ax": 15.25,
     "az": -49.05,
     "bx": 25.8,
     "bz": -31.13,
     "r": 1.7,
     "height": 9,
     "kind": "wall"
    }
   },
   {
    "look": "rock",
    "o": {
     "ax": 32.8,
     "az": -19.24,
     "bx": 46.96,
     "bz": 4.8,
     "r": 1.7,
     "height": 9,
     "kind": "wall"
    }
   },
   {
    "look": "rock",
    "o": {
     "ax": -36.9,
     "az": -12.05,
     "bx": -28.92,
     "bz": -22.06,
     "r": 1.7,
     "height": 9,
     "kind": "wall"
    }
   },
   {
    "look": "rock",
    "o": {
     "ax": -18.69,
     "az": -34.88,
     "bx": -7.59,
     "bz": -48.79,
     "r": 1.7,
     "height": 9,
     "kind": "wall"
    }
   },
   {
    "look": "rock",
    "o": {
     "ax": 7.59,
     "az": 35.21,
     "bx": 1.99,
     "bz": 32.33,
     "r": 1.7,
     "height": 9,
     "kind": "wall"
    }
   },
   {
    "look": "rock",
    "o": {
     "ax": -10.28,
     "az": 26.01,
     "bx": -12.42,
     "bz": 24.92,
     "r": 1.7,
     "height": 9,
     "kind": "wall"
    }
   },
   {
    "look": "rock",
    "o": {
     "ax": 38.8,
     "az": 20.65,
     "bx": 25.44,
     "bz": 27.03,
     "r": 1.7,
     "height": 9,
     "kind": "wall"
    }
   },
   {
    "look": "rock",
    "o": {
     "ax": 12.99,
     "az": 32.97,
     "bx": 8.11,
     "bz": 35.3,
     "r": 1.7,
     "height": 9,
     "kind": "wall"
    }
   },
   {
    "look": "rock",
    "o": {
     "ax": 7.93,
     "az": 35.42,
     "bx": 6.76,
     "bz": 41.61,
     "r": 1.7,
     "height": 9,
     "kind": "wall"
    }
   },
   {
    "look": "rock",
    "o": {
     "ax": 4.2,
     "az": 55.17,
     "bx": 3.75,
     "bz": 57.53,
     "r": 1.7,
     "height": 9,
     "kind": "wall"
    }
   },
   {
    "look": "rock",
    "o": {
     "ax": -48.93,
     "az": 31.56,
     "bx": -48.93,
     "bz": 31.56,
     "r": 1.9,
     "height": 4.2,
     "kind": "pillar"
    }
   },
   {
    "look": "rock",
    "o": {
     "ax": -53.16,
     "az": 30.17,
     "bx": -53.16,
     "bz": 30.17,
     "r": 1.9,
     "height": 4.2,
     "kind": "pillar"
    }
   },
   {
    "look": "rock",
    "o": {
     "ax": -55.83,
     "az": 26.61,
     "bx": -55.83,
     "bz": 26.61,
     "r": 1.9,
     "height": 4.2,
     "kind": "pillar"
    }
   },
   {
    "look": "rock",
    "o": {
     "ax": -55.98,
     "az": 22.16,
     "bx": -55.98,
     "bz": 22.16,
     "r": 1.9,
     "height": 4.2,
     "kind": "pillar"
    }
   },
   {
    "look": "rock",
    "o": {
     "ax": -53.54,
     "az": 18.44,
     "bx": -53.54,
     "bz": 18.44,
     "r": 1.9,
     "height": 4.2,
     "kind": "pillar"
    }
   },
   {
    "look": "stall",
    "o": {
     "ax": -43.87,
     "az": 29.3,
     "bx": -42.5,
     "bz": 25.64,
     "r": 0.5,
     "height": 1.1,
     "kind": "wall"
    }
   },
   {
    "look": "rock",
    "o": {
     "ax": 90.27,
     "az": 40.24,
     "bx": 90.27,
     "bz": 40.24,
     "r": 1.2,
     "height": 1.6,
     "kind": "pillar"
    }
   },
   {
    "look": "rock",
    "o": {
     "ax": 82.23,
     "az": 42.86,
     "bx": 82.23,
     "bz": 42.86,
     "r": 1.2,
     "height": 1.6,
     "kind": "pillar"
    }
   },
   {
    "look": "rock",
    "o": {
     "ax": 77.25,
     "az": 36.01,
     "bx": 77.25,
     "bz": 36.01,
     "r": 1.2,
     "height": 1.6,
     "kind": "pillar"
    }
   },
   {
    "look": "rock",
    "o": {
     "ax": 82.23,
     "az": 29.16,
     "bx": 82.23,
     "bz": 29.16,
     "r": 1.2,
     "height": 1.6,
     "kind": "pillar"
    }
   },
   {
    "look": "rock",
    "o": {
     "ax": 90.27,
     "az": 31.78,
     "bx": 90.27,
     "bz": 31.78,
     "r": 1.2,
     "height": 1.6,
     "kind": "pillar"
    }
   },
   {
    "look": "post",
    "o": {
     "ax": 6.29,
     "az": -4.84,
     "bx": 6.29,
     "bz": -4.84,
     "r": 0.75,
     "height": 2.6,
     "kind": "pillar"
    }
   },
   {
    "look": "post",
    "o": {
     "ax": -1.09,
     "az": -2.44,
     "bx": -1.09,
     "bz": -2.44,
     "r": 0.75,
     "height": 2.6,
     "kind": "pillar"
    }
   },
   {
    "look": "post",
    "o": {
     "ax": -5.65,
     "az": -8.72,
     "bx": -5.65,
     "bz": -8.72,
     "r": 0.75,
     "height": 2.6,
     "kind": "pillar"
    }
   },
   {
    "look": "post",
    "o": {
     "ax": -1.09,
     "az": -15,
     "bx": -1.09,
     "bz": -15,
     "r": 0.75,
     "height": 2.6,
     "kind": "pillar"
    }
   },
   {
    "look": "post",
    "o": {
     "ax": 6.29,
     "az": -12.6,
     "bx": 6.29,
     "bz": -12.6,
     "r": 0.75,
     "height": 2.6,
     "kind": "pillar"
    }
   },
   {
    "look": "post",
    "o": {
     "ax": 63.92,
     "az": -37.29,
     "bx": 63.92,
     "bz": -37.29,
     "r": 0.9,
     "height": 3.4,
     "kind": "pillar"
    }
   },
   {
    "look": "post",
    "o": {
     "ax": 54.98,
     "az": -34.38,
     "bx": 54.98,
     "bz": -34.38,
     "r": 0.9,
     "height": 3.4,
     "kind": "pillar"
    }
   },
   {
    "look": "post",
    "o": {
     "ax": 49.45,
     "az": -41.99,
     "bx": 49.45,
     "bz": -41.99,
     "r": 0.9,
     "height": 3.4,
     "kind": "pillar"
    }
   },
   {
    "look": "post",
    "o": {
     "ax": 54.98,
     "az": -49.6,
     "bx": 54.98,
     "bz": -49.6,
     "r": 0.9,
     "height": 3.4,
     "kind": "pillar"
    }
   },
   {
    "look": "post",
    "o": {
     "ax": 63.92,
     "az": -46.69,
     "bx": 63.92,
     "bz": -46.69,
     "r": 0.9,
     "height": 3.4,
     "kind": "pillar"
    }
   },
   {
    "look": "post",
    "o": {
     "ax": -43.94,
     "az": -42.31,
     "bx": -43.94,
     "bz": -42.31,
     "r": 0.9,
     "height": 3.8,
     "kind": "pillar"
    }
   },
   {
    "look": "post",
    "o": {
     "ax": -51.85,
     "az": -41.48,
     "bx": -51.85,
     "bz": -41.48,
     "r": 0.9,
     "height": 3.8,
     "kind": "pillar"
    }
   },
   {
    "look": "post",
    "o": {
     "ax": -56.06,
     "az": -48.22,
     "bx": -56.06,
     "bz": -48.22,
     "r": 0.9,
     "height": 3.8,
     "kind": "pillar"
    }
   },
   {
    "look": "post",
    "o": {
     "ax": -51.85,
     "az": -54.96,
     "bx": -51.85,
     "bz": -54.96,
     "r": 0.9,
     "height": 3.8,
     "kind": "pillar"
    }
   },
   {
    "look": "post",
    "o": {
     "ax": -43.94,
     "az": -54.13,
     "bx": -43.94,
     "bz": -54.13,
     "r": 0.9,
     "height": 3.8,
     "kind": "pillar"
    }
   },
   {
    "look": "post",
    "o": {
     "ax": -35.06,
     "az": 56.33,
     "bx": -35.06,
     "bz": 56.33,
     "r": 0.35,
     "height": 3,
     "kind": "pillar"
    }
   },
   {
    "look": "barrel",
    "o": {
     "ax": -27.85,
     "az": 54.5,
     "bx": -27.85,
     "bz": 54.5,
     "r": 0.6,
     "height": 0.7,
     "kind": "pillar"
    }
   },
   {
    "look": "rock",
    "o": {
     "ax": -30.19,
     "az": 60.75,
     "bx": -30.19,
     "bz": 60.75,
     "r": 1,
     "height": 1.3,
     "kind": "pillar"
    }
   },
   {
    "look": "post",
    "o": {
     "ax": 37.45,
     "az": 71.73,
     "bx": 37.45,
     "bz": 71.73,
     "r": 0.35,
     "height": 3,
     "kind": "pillar"
    }
   },
   {
    "look": "barrel",
    "o": {
     "ax": 38.82,
     "az": 64.42,
     "bx": 38.82,
     "bz": 64.42,
     "r": 0.6,
     "height": 0.7,
     "kind": "pillar"
    }
   },
   {
    "look": "rock",
    "o": {
     "ax": 43.51,
     "az": 69.17,
     "bx": 43.51,
     "bz": 69.17,
     "r": 1,
     "height": 1.3,
     "kind": "pillar"
    }
   },
   {
    "look": "post",
    "o": {
     "ax": -8.33,
     "az": -96.2,
     "bx": -8.33,
     "bz": -96.2,
     "r": 0.9,
     "height": 4,
     "kind": "pillar"
    }
   },
   {
    "look": "post",
    "o": {
     "ax": -3.16,
     "az": -99.82,
     "bx": -3.16,
     "bz": -99.82,
     "r": 0.9,
     "height": 4,
     "kind": "pillar"
    }
   },
   {
    "look": "post",
    "o": {
     "ax": 3.16,
     "az": -99.82,
     "bx": 3.16,
     "bz": -99.82,
     "r": 0.9,
     "height": 4,
     "kind": "pillar"
    }
   },
   {
    "look": "post",
    "o": {
     "ax": 8.33,
     "az": -96.2,
     "bx": 8.33,
     "bz": -96.2,
     "r": 0.9,
     "height": 4,
     "kind": "pillar"
    }
   },
   {
    "look": "rock",
    "o": {
     "ax": 112.3,
     "az": 7.78,
     "bx": 112.3,
     "bz": 7.78,
     "r": 4.28,
     "height": 9.33,
     "kind": "pillar"
    }
   },
   {
    "look": "rock",
    "o": {
     "ax": 100.03,
     "az": 52.2,
     "bx": 100.03,
     "bz": 52.2,
     "r": 1.27,
     "height": 1.76,
     "kind": "pillar"
    }
   },
   {
    "look": "post",
    "o": {
     "ax": 82.51,
     "az": -49.23,
     "bx": 82.51,
     "bz": -49.23,
     "r": 0.75,
     "height": 9.44,
     "kind": "pillar"
    }
   },
   {
    "look": "post",
    "o": {
     "ax": 13.12,
     "az": -11.31,
     "bx": 13.12,
     "bz": -11.31,
     "r": 0.79,
     "height": 10.86,
     "kind": "pillar"
    }
   },
   {
    "look": "rock",
    "o": {
     "ax": -42.02,
     "az": 2.17,
     "bx": -42.02,
     "bz": 2.17,
     "r": 1.02,
     "height": 1.5,
     "kind": "pillar"
    }
   },
   {
    "look": "rock",
    "o": {
     "ax": 66.09,
     "az": 76.42,
     "bx": 66.09,
     "bz": 76.42,
     "r": 1.66,
     "height": 1.97,
     "kind": "pillar"
    }
   },
   {
    "look": "stall",
    "o": {
     "ax": -62.95,
     "az": 6.63,
     "bx": -65.91,
     "bz": 9.79,
     "r": 0.45,
     "height": 1.1,
     "kind": "wall"
    }
   },
   {
    "look": "post",
    "o": {
     "ax": 101.61,
     "az": 67.39,
     "bx": 101.61,
     "bz": 67.39,
     "r": 0.89,
     "height": 9.86,
     "kind": "pillar"
    }
   },
   {
    "look": "rock",
    "o": {
     "ax": 110.89,
     "az": 33.96,
     "bx": 110.89,
     "bz": 33.96,
     "r": 3.78,
     "height": 9.83,
     "kind": "pillar"
    }
   },
   {
    "look": "post",
    "o": {
     "ax": 89.16,
     "az": -37.55,
     "bx": 89.16,
     "bz": -37.55,
     "r": 0.8,
     "height": 10.19,
     "kind": "pillar"
    }
   },
   {
    "look": "rock",
    "o": {
     "ax": 47.87,
     "az": 81.78,
     "bx": 47.87,
     "bz": 81.78,
     "r": 3.48,
     "height": 7.87,
     "kind": "pillar"
    }
   },
   {
    "look": "rock",
    "o": {
     "ax": 57.73,
     "az": 31.06,
     "bx": 57.73,
     "bz": 31.06,
     "r": 1.67,
     "height": 2.06,
     "kind": "pillar"
    }
   },
   {
    "look": "rock",
    "o": {
     "ax": 101.28,
     "az": 13.06,
     "bx": 101.28,
     "bz": 13.06,
     "r": 3.11,
     "height": 7.69,
     "kind": "pillar"
    }
   },
   {
    "look": "rock",
    "o": {
     "ax": 112.16,
     "az": 23.94,
     "bx": 112.16,
     "bz": 23.94,
     "r": 3.11,
     "height": 9.58,
     "kind": "pillar"
    }
   },
   {
    "look": "rock",
    "o": {
     "ax": 55.72,
     "az": 19.22,
     "bx": 55.72,
     "bz": 19.22,
     "r": 1.01,
     "height": 1.5,
     "kind": "pillar"
    }
   },
   {
    "look": "rock",
    "o": {
     "ax": 58.42,
     "az": -67.15,
     "bx": 58.42,
     "bz": -67.15,
     "r": 3.97,
     "height": 8.97,
     "kind": "pillar"
    }
   },
   {
    "look": "barrel",
    "o": {
     "ax": 30.5,
     "az": 89.11,
     "bx": 30.5,
     "bz": 89.11,
     "r": 0.6,
     "height": 0.7,
     "kind": "pillar"
    }
   },
   {
    "look": "stall",
    "o": {
     "ax": 54.65,
     "az": -22.43,
     "bx": 55.89,
     "bz": -17.81,
     "r": 0.45,
     "height": 1.1,
     "kind": "wall"
    }
   },
   {
    "look": "rock",
    "o": {
     "ax": 73.19,
     "az": 52.58,
     "bx": 73.19,
     "bz": 52.58,
     "r": 1.37,
     "height": 1.54,
     "kind": "pillar"
    }
   },
   {
    "look": "post",
    "o": {
     "ax": 15.09,
     "az": -72.91,
     "bx": 15.09,
     "bz": -72.91,
     "r": 0.72,
     "height": 10.88,
     "kind": "pillar"
    }
   },
   {
    "look": "post",
    "o": {
     "ax": 12.99,
     "az": -67.19,
     "bx": 12.99,
     "bz": -67.19,
     "r": 0.93,
     "height": 10.97,
     "kind": "pillar"
    }
   },
   {
    "look": "rock",
    "o": {
     "ax": -43.39,
     "az": -79.93,
     "bx": -43.39,
     "bz": -79.93,
     "r": 1.1,
     "height": 1.5,
     "kind": "pillar"
    }
   },
   {
    "look": "post",
    "o": {
     "ax": 9.24,
     "az": 25.67,
     "bx": 9.24,
     "bz": 25.67,
     "r": 0.82,
     "height": 9.89,
     "kind": "pillar"
    }
   },
   {
    "look": "post",
    "o": {
     "ax": 105.82,
     "az": 50.79,
     "bx": 105.82,
     "bz": 50.79,
     "r": 0.73,
     "height": 9.15,
     "kind": "pillar"
    }
   },
   {
    "look": "rock",
    "o": {
     "ax": -46.33,
     "az": 71.19,
     "bx": -46.33,
     "bz": 71.19,
     "r": 1,
     "height": 1.13,
     "kind": "pillar"
    }
   },
   {
    "look": "rock",
    "o": {
     "ax": 24.76,
     "az": -97.6,
     "bx": 24.76,
     "bz": -97.6,
     "r": 3.32,
     "height": 8.28,
     "kind": "pillar"
    }
   },
   {
    "look": "barrel",
    "o": {
     "ax": -50.69,
     "az": -71.09,
     "bx": -50.69,
     "bz": -71.09,
     "r": 0.6,
     "height": 0.7,
     "kind": "pillar"
    }
   },
   {
    "look": "post",
    "o": {
     "ax": 68.68,
     "az": -57.91,
     "bx": 68.68,
     "bz": -57.91,
     "r": 0.96,
     "height": 11.48,
     "kind": "pillar"
    }
   },
   {
    "look": "rock",
    "o": {
     "ax": 44.72,
     "az": -64.7,
     "bx": 44.72,
     "bz": -64.7,
     "r": 3.7,
     "height": 9.15,
     "kind": "pillar"
    }
   },
   {
    "look": "barrel",
    "o": {
     "ax": -71.8,
     "az": -39.08,
     "bx": -71.8,
     "bz": -39.08,
     "r": 0.6,
     "height": 0.7,
     "kind": "pillar"
    }
   },
   {
    "look": "rock",
    "o": {
     "ax": 31.63,
     "az": -0.15,
     "bx": 31.63,
     "bz": -0.15,
     "r": 3.43,
     "height": 9.36,
     "kind": "pillar"
    }
   },
   {
    "look": "post",
    "o": {
     "ax": 69.44,
     "az": -24.25,
     "bx": 69.44,
     "bz": -24.25,
     "r": 0.94,
     "height": 9.11,
     "kind": "pillar"
    }
   },
   {
    "look": "rock",
    "o": {
     "ax": 49.81,
     "az": -15.27,
     "bx": 49.81,
     "bz": -15.27,
     "r": 1.32,
     "height": 1.78,
     "kind": "pillar"
    }
   },
   {
    "look": "post",
    "o": {
     "ax": 66.48,
     "az": 11.79,
     "bx": 66.48,
     "bz": 11.79,
     "r": 0.89,
     "height": 11.95,
     "kind": "pillar"
    }
   },
   {
    "look": "rock",
    "o": {
     "ax": 32.62,
     "az": 44.18,
     "bx": 32.62,
     "bz": 44.18,
     "r": 3.6,
     "height": 8.49,
     "kind": "pillar"
    }
   },
   {
    "look": "post",
    "o": {
     "ax": 17.49,
     "az": -9.25,
     "bx": 17.49,
     "bz": -9.25,
     "r": 0.79,
     "height": 10.16,
     "kind": "pillar"
    }
   },
   {
    "look": "rock",
    "o": {
     "ax": 36.52,
     "az": 87.54,
     "bx": 36.52,
     "bz": 87.54,
     "r": 1.13,
     "height": 1.5,
     "kind": "pillar"
    }
   },
   {
    "look": "rock",
    "o": {
     "ax": 112.24,
     "az": 53.25,
     "bx": 112.24,
     "bz": 53.25,
     "r": 1.13,
     "height": 1.46,
     "kind": "pillar"
    }
   },
   {
    "look": "stall",
    "o": {
     "ax": -5,
     "az": 7.74,
     "bx": -8.34,
     "bz": 4.81,
     "r": 0.45,
     "height": 1.1,
     "kind": "wall"
    }
   },
   {
    "look": "rock",
    "o": {
     "ax": 51.92,
     "az": -84.8,
     "bx": 51.92,
     "bz": -84.8,
     "r": 1.27,
     "height": 1.4,
     "kind": "pillar"
    }
   },
   {
    "look": "post",
    "o": {
     "ax": -73.93,
     "az": -43.79,
     "bx": -73.93,
     "bz": -43.79,
     "r": 0.97,
     "height": 8.5,
     "kind": "pillar"
    }
   },
   {
    "look": "rock",
    "o": {
     "ax": 102.13,
     "az": -1.65,
     "bx": 102.13,
     "bz": -1.65,
     "r": 3.05,
     "height": 8.72,
     "kind": "pillar"
    }
   },
   {
    "look": "rock",
    "o": {
     "ax": 37.83,
     "az": 30.95,
     "bx": 37.83,
     "bz": 30.95,
     "r": 0.98,
     "height": 1.5,
     "kind": "pillar"
    }
   },
   {
    "look": "stall",
    "o": {
     "ax": 13.96,
     "az": 101.45,
     "bx": 10.89,
     "bz": 104.68,
     "r": 0.45,
     "height": 1.1,
     "kind": "wall"
    }
   },
   {
    "look": "rock",
    "o": {
     "ax": 74.35,
     "az": 85.01,
     "bx": 74.35,
     "bz": 85.01,
     "r": 3.45,
     "height": 9.41,
     "kind": "pillar"
    }
   },
   {
    "look": "rock",
    "o": {
     "ax": -40.13,
     "az": -24.16,
     "bx": -40.13,
     "bz": -24.16,
     "r": 3.31,
     "height": 7.51,
     "kind": "pillar"
    }
   }
  ],
  "kinds": [
   "edge",
   "edge",
   "edge",
   "edge",
   "edge",
   "edge",
   "edge",
   "edge",
   "edge",
   "edge",
   "edge",
   "edge",
   "edge",
   "edge",
   "edge",
   "edge",
   "edge",
   "edge",
   "edge",
   "edge",
   "edge",
   "edge",
   "edge",
   "edge",
   "fire",
   "tent",
   "tent",
   "crate",
   "crate",
   "log",
   "lair",
   "lair",
   "roots",
   "roots",
   "roots",
   "roots",
   "roots",
   "roots",
   "roots",
   "roots",
   "roots",
   "roots",
   "roots",
   "roots",
   "roots",
   "band",
   "band",
   "band",
   "band",
   "band",
   "band",
   "band",
   "band",
   "band",
   "band",
   "band",
   "band",
   "band",
   "band",
   "band",
   "band",
   "band",
   "band",
   "band",
   "band",
   "band",
   "band",
   "band",
   "band",
   "band",
   "band",
   "band",
   "band",
   "band",
   "band",
   "band",
   "band",
   "band",
   "band",
   "band",
   "band",
   "band",
   "band",
   "rock",
   "rock",
   "rock",
   "rock",
   "rock",
   "log",
   "thorn",
   "thorn",
   "thorn",
   "thorn",
   "thorn",
   "menhir",
   "menhir",
   "menhir",
   "menhir",
   "menhir",
   "menhir",
   "menhir",
   "menhir",
   "menhir",
   "menhir",
   "twist",
   "twist",
   "twist",
   "twist",
   "twist",
   "post",
   "stump",
   "rock",
   "post",
   "stump",
   "rock",
   "twist",
   "twist",
   "twist",
   "twist",
   "grove",
   "rock",
   "tree",
   "tree",
   "thorn",
   "rock",
   "log",
   "tree",
   "grove",
   "tree",
   "grove",
   "rock",
   "grove",
   "grove",
   "thorn",
   "grove",
   "stump",
   "log",
   "rock",
   "tree",
   "tree",
   "thorn",
   "tree",
   "tree",
   "rock",
   "grove",
   "stump",
   "tree",
   "grove",
   "stump",
   "grove",
   "tree",
   "rock",
   "tree",
   "grove",
   "tree",
   "thorn",
   "rock",
   "log",
   "rock",
   "tree",
   "grove",
   "thorn",
   "log",
   "grove",
   "grove"
  ],
  "places": [
   {
    "id": "camp",
    "kind": "camp",
    "x": 0,
    "z": 93.53,
    "r": 8
   },
   {
    "id": "den",
    "kind": "den",
    "x": -48.85,
    "z": 24.16,
    "r": 9.5
   },
   {
    "id": "bramble",
    "kind": "bramble",
    "x": 84.45,
    "z": 36.01,
    "r": 9.5
   },
   {
    "id": "stones",
    "kind": "stones",
    "x": 0.95,
    "z": -8.72,
    "r": 7
   },
   {
    "id": "giants",
    "kind": "giants",
    "x": 57.45,
    "z": -41.99,
    "r": 9.5
   },
   {
    "id": "thicket",
    "kind": "thicket",
    "x": -48.56,
    "z": -48.22,
    "r": 9
   },
   {
    "id": "lampw",
    "kind": "lamps",
    "x": -32.01,
    "z": 55.35,
    "r": 7
   },
   {
    "id": "lampe",
    "kind": "lamps",
    "x": 37.84,
    "z": 68.55,
    "r": 7
   },
   {
    "id": "heart",
    "kind": "heart",
    "x": 0,
    "z": -89.81,
    "r": 10
   }
  ],
  "paths": [
   [
    [
     -46.02,
     16.17
    ],
    [
     -43.94,
     24.7
    ],
    [
     -40.43,
     32.76
    ]
   ],
   [
    [
     -40.43,
     32.76
    ],
    [
     -38.07,
     41.55
    ],
    [
     -32.01,
     48.35
    ]
   ],
   [
    [
     0,
     90.03
    ],
    [
     -8.93,
     79.39
    ],
    [
     -16,
     67.44
    ]
   ],
   [
    [
     -16,
     67.44
    ],
    [
     -25.18,
     58.88
    ],
    [
     -32.01,
     48.35
    ]
   ],
   [
    [
     0,
     90.03
    ],
    [
     18.92,
     74.04
    ]
   ],
   [
    [
     18.92,
     74.04
    ],
    [
     28.6,
     68.13
    ],
    [
     37.84,
     61.55
    ]
   ],
   [
    [
     -46.02,
     16.17
    ],
    [
     -34.05,
     9.77
    ],
    [
     -23.95,
     0.72
    ]
   ],
   [
    [
     -23.95,
     0.72
    ],
    [
     -12.04,
     -8.31
    ],
    [
     0.95,
     -15.72
    ]
   ],
   [
    [
     0,
     -104.81
    ],
    [
     -9.96,
     -88.57
    ],
    [
     -24.28,
     -76.01
    ]
   ],
   [
    [
     -24.28,
     -76.01
    ],
    [
     -35.07,
     -64.04
    ],
    [
     -48.56,
     -55.22
    ]
   ],
   [
    [
     0.95,
     -15.72
    ],
    [
     -10.22,
     -27.11
    ],
    [
     -23.8,
     -35.47
    ]
   ],
   [
    [
     -23.8,
     -35.47
    ],
    [
     -38.02,
     -43.04
    ],
    [
     -48.56,
     -55.22
    ]
   ],
   [
    [
     84.45,
     29.01
    ],
    [
     71.71,
     35.58
    ],
    [
     61.15,
     45.28
    ]
   ],
   [
    [
     61.15,
     45.28
    ],
    [
     48.99,
     52.69
    ],
    [
     37.84,
     61.55
    ]
   ],
   [
    [
     0,
     -104.81
    ],
    [
     14.67,
     -89.13
    ],
    [
     28.73,
     -72.9
    ]
   ],
   [
    [
     28.73,
     -72.9
    ],
    [
     44.81,
     -63.01
    ],
    [
     57.45,
     -48.99
    ]
   ],
   [
    [
     0,
     -104.81
    ],
    [
     -1.05,
     -80.45
    ],
    [
     2.27,
     -56.29
    ]
   ],
   [
    [
     2.27,
     -56.29
    ],
    [
     0.87,
     -36.03
    ],
    [
     0.95,
     -15.72
    ]
   ],
   [
    [
     0.95,
     -15.72
    ],
    [
     13.88,
     -26.09
    ],
    [
     29.3,
     -32.18
    ]
   ],
   [
    [
     29.3,
     -32.18
    ],
    [
     43.37,
     -40.59
    ],
    [
     57.45,
     -48.99
    ]
   ],
   [
    [
     0.95,
     -15.72
    ],
    [
     -3.07,
     3.03
    ],
    [
     -4.15,
     22.17
    ]
   ],
   [
    [
     -4.15,
     22.17
    ],
    [
     -17.02,
     36.39
    ],
    [
     -32.01,
     48.35
    ]
   ],
   [
    [
     -32.01,
     48.35
    ],
    [
     -13.42,
     44.01
    ],
    [
     5.48,
     41.39
    ]
   ],
   [
    [
     5.48,
     41.39
    ],
    [
     22.18,
     50.63
    ],
    [
     37.84,
     61.55
    ]
   ],
   [
    [
     -46.02,
     16.17
    ],
    [
     -47.49,
     -1.41
    ],
    [
     -48.51,
     -19.03
    ]
   ],
   [
    [
     -48.51,
     -19.03
    ],
    [
     -50.65,
     -37.12
    ],
    [
     -48.56,
     -55.22
    ]
   ],
   [
    [
     0.95,
     -15.72
    ],
    [
     8.72,
     4.28
    ],
    [
     19.21,
     23
    ]
   ],
   [
    [
     19.21,
     23
    ],
    [
     27.75,
     42.65
    ],
    [
     37.84,
     61.55
    ]
   ]
  ],
  "passes": [
   {
    "x": -40.43,
    "z": 39.76,
    "dx": -0.88,
    "dz": 0.48,
    "w": 6.5
   },
   {
    "x": -16,
    "z": 74.44,
    "dx": 0.77,
    "dz": -0.64,
    "w": 6.5
   },
   {
    "x": 18.92,
    "z": 81.04,
    "dx": 0.55,
    "dz": 0.83,
    "w": 6.5
   },
   {
    "x": -23.95,
    "z": 7.72,
    "dx": 0.55,
    "dz": 0.83,
    "w": 6.5
   },
   {
    "x": -24.28,
    "z": -69.01,
    "dx": -0.65,
    "dz": -0.76,
    "w": 6.5
   },
   {
    "x": -23.8,
    "z": -28.47,
    "dx": 0.62,
    "dz": -0.78,
    "w": 6.5
   },
   {
    "x": 61.15,
    "z": 52.28,
    "dx": -0.57,
    "dz": -0.82,
    "w": 6.5
   },
   {
    "x": 28.73,
    "z": -65.9,
    "dx": -0.64,
    "dz": 0.77,
    "w": 6.5
   },
   {
    "x": 2.27,
    "z": -49.29,
    "dx": -1,
    "dz": 0.01,
    "w": 5.2,
    "set": 0
   },
   {
    "x": 29.3,
    "z": -25.18,
    "dx": 0.51,
    "dz": 0.86,
    "w": 5.2,
    "set": 1
   },
   {
    "x": -4.15,
    "z": 29.17,
    "dx": -0.89,
    "dz": -0.46,
    "w": 5.2,
    "set": 0
   },
   {
    "x": 5.48,
    "z": 48.39,
    "dx": -0.19,
    "dz": 0.98,
    "w": 5.2,
    "set": 1
   },
   {
    "x": -48.51,
    "z": -12.03,
    "dx": 1,
    "dz": 0,
    "w": 5.2,
    "set": 0
   },
   {
    "x": 19.21,
    "z": 30,
    "dx": -0.9,
    "dz": 0.43,
    "w": 5.2,
    "set": 1
   }
  ],
  "elder": {
   "x": 0,
   "z": -126.81
  },
  "mirror": 1,
  "seed": 1118
 }
};
