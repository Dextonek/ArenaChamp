// Made by pipeline/tools/gen-wood11.ts: floor 11, The Walking Wood, at the new size, seed 11000. Made again by that tool; a hand fix is
// kept only until then (pipeline/designs/tower-50.md). Its set pieces are in pieces/floors.ts.
import type { FloorDef } from '../def';
import type { WoodLook } from '../gen/wood';

export const WOOD_11: { seed: number; floor: Omit<FloorDef, 'arena' | 'cover'>; look: WoodLook } = {
 "seed": 11000,
 "floor": {
  "n": 11,
  "id": "wood",
  "name": "The Walking Wood",
  "blurb": "A forest that does not stay where you left it.",
  "tunedAs": 2,
  "ring": 125,
  "start": {
   "x": 0,
   "z": 117.03
  },
  "camp": {
   "x": 0,
   "z": 113.53
  },
  "places": {
   "camp": {
    "id": "camp",
    "name": "The camp",
    "x": 0,
    "z": 111.53,
    "r": 8,
    "stand": {
     "x": 0,
     "z": 115.03
    }
   },
   "den": {
    "id": "den",
    "name": "The hounds’ den",
    "x": -61.15,
    "z": 30.3,
    "r": 9.5,
    "stand": {
     "x": -58.35,
     "z": 29.23
    }
   },
   "bramble": {
    "id": "bramble",
    "name": "The bramble",
    "x": 77.03,
    "z": 29.49,
    "r": 9.5,
    "stand": {
     "x": 77.03,
     "z": 29.49
    }
   },
   "stones": {
    "id": "stones",
    "name": "The old stones",
    "x": 0.82,
    "z": -0.96,
    "r": 7,
    "stand": {
     "x": 0.82,
     "z": -0.96
    }
   },
   "giants": {
    "id": "giants",
    "name": "The giants’ glade",
    "x": 45.53,
    "z": -37.55,
    "r": 9.5,
    "stand": {
     "x": 45.53,
     "z": -37.55
    }
   },
   "thicket": {
    "id": "thicket",
    "name": "The thicket",
    "x": -66.09,
    "z": -40.63,
    "r": 9,
    "stand": {
     "x": -66.09,
     "z": -40.63
    }
   },
   "lampw": {
    "id": "lampw",
    "name": "The west lamp glade",
    "x": -48.01,
    "z": 61.84,
    "r": 7,
    "stand": {
     "x": -48.01,
     "z": 61.84
    }
   },
   "lampe": {
    "id": "lampe",
    "name": "The east lamp glade",
    "x": 39.95,
    "z": 66.24,
    "r": 7,
    "stand": {
     "x": 39.95,
     "z": 66.24
    }
   },
   "heart": {
    "id": "heart",
    "name": "The heart",
    "x": 0,
    "z": -40.84,
    "r": 10,
    "stand": {
     "x": 0,
     "z": -48.84
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
      "x": -8.12,
      "z": 42.47
     },
     "b": {
      "x": -19.64,
      "z": 33.51
     },
     "r": 0.7,
     "height": 3.4,
     "set": 0,
     "name": "the old road"
    },
    {
     "a": {
      "x": -29.11,
      "z": 91.62
     },
     "b": {
      "x": -18.61,
      "z": 81.48
     },
     "r": 0.7,
     "height": 3.4,
     "set": 1,
     "name": "the lamp road"
    },
    {
     "a": {
      "x": 22.8,
      "z": -19.72
     },
     "b": {
      "x": 32.04,
      "z": -8.42
     },
     "r": 0.7,
     "height": 3.4,
     "set": 0,
     "name": "the giants’ road"
    },
    {
     "a": {
      "x": -3.38,
      "z": 50.96
     },
     "b": {
      "x": -4.1,
      "z": 65.54
     },
     "r": 0.7,
     "height": 3.4,
     "set": 1,
     "name": "the east road"
    },
    {
     "a": {
      "x": 26.52,
      "z": 29.07
     },
     "b": {
      "x": 13.9,
      "z": 36.41
     },
     "r": 0.7,
     "height": 3.4,
     "set": 0,
     "name": "the old path"
    },
    {
     "a": {
      "x": -70.7,
      "z": -4.67
     },
     "b": {
      "x": -56.14,
      "z": -5.69
     },
     "r": 0.7,
     "height": 3.4,
     "set": 1,
     "name": "the thicket road"
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
     "x": -61.15,
     "z": 30.3
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
     "x": 77.03,
     "z": 29.49
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
     "x": 45.53,
     "z": -37.55
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
     "x": 2.79,
     "z": -11.31
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
       "x": 2.79,
       "z": -11.31
      },
      {
       "x": 9.33,
       "z": -26.45
      },
      {
       "x": 13.87,
       "z": -32.43
      },
      {
       "x": 9.33,
       "z": -26.45
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
     "z": -42.84
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
     "z": -42.84
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
     "z": -33.84
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
     "z": 113.93
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
     "z": 113.53
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
     "x": -78.36,
     "z": -41.64
    },
    "face": 1.02,
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
     "z": 110.73
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
       "x": -51.49,
       "z": 22.54
      },
      "r": 3,
      "path": [
       {
        "x": -30.16,
        "z": 14.67
       },
       {
        "x": 0.41,
        "z": -20.9
       },
       {
        "x": 0,
        "z": -48.84
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
       "x": 64.04,
       "z": 28.88
      },
      "r": 3,
      "path": [
       {
        "x": 61.28,
        "z": -4.03
       },
       {
        "x": 22.77,
        "z": -39.19
       },
       {
        "x": 0,
        "z": -48.84
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
       "x": -56.16,
       "z": -31.37
      },
      "r": 3,
      "path": [
       {
        "x": -33.04,
        "z": -40.73
       },
       {
        "x": 0,
        "z": -48.84
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
         "x": -48.01,
         "z": 61.84
        }
       },
       {
        "id": "lamp2",
        "at": {
         "x": 39.95,
         "z": 66.24
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
       "x": 65.13,
       "z": 23.38
      },
      "to": {
       "x": 1.6,
       "z": 108.63
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
     "x": -79.17,
     "z": -32.53
    },
    "shards": 25
   },
   {
    "id": "c2",
    "at": {
     "x": 91.18,
     "z": -23.48
    },
    "shards": 30
   },
   {
    "id": "c3",
    "at": {
     "x": -12.58,
     "z": -33.06
    },
    "shards": 20,
    "boon": true
   },
   {
    "id": "c4",
    "at": {
     "x": 40,
     "z": 100.17
    },
    "shards": 25
   },
   {
    "id": "c5",
    "at": {
     "x": -92.51,
     "z": 18.71
    },
    "shards": 30
   },
   {
    "id": "c6",
    "at": {
     "x": 15.24,
     "z": -54.77
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
     "x": -39.22,
     "z": 51.42
    }
   },
   {
    "id": "w2",
    "name": "The bramble road stone",
    "at": {
     "x": 27.85,
     "z": 55.3
    }
   },
   {
    "id": "w3",
    "name": "The thicket stone",
    "at": {
     "x": -51.98,
     "z": -34.85
    }
   },
   {
    "id": "w4",
    "name": "The old road stone",
    "at": {
     "x": -1.64,
     "z": 19.18
    }
   },
   {
    "id": "w5",
    "name": "The giants’ stone",
    "at": {
     "x": 36.51,
     "z": -22.4
    }
   },
   {
    "id": "w6",
    "name": "The den stone",
    "at": {
     "x": -47.22,
     "z": 20.82
    }
   }
  ],
  "lore": {
   "id": "lore",
   "name": "The root stone",
   "at": {
    "x": -13.74,
    "z": -39.8
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
     "z": -59.84
    },
    "r": 2.2,
    "wall": {
     "ax": -3.4,
     "az": -59.84,
     "bx": 3.4,
     "bz": -59.84,
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
     "x": -16,
     "z": 117.7
    },
    "r": 2,
    "locked": ""
   },
   {
    "id": "gate",
    "piece": "gate",
    "name": "The gate up",
    "at": {
     "x": 15.44,
     "z": 118.22
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
     "x": -76.73,
     "z": -47.36
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
    "x": -78.36,
    "z": -41.64
   },
   "boon": true,
   "lines": [
    "Another climber. I am Nyx, and I hunt in the dark. Walk through the arch behind me and we see who is quicker. Win, and I fight beside you."
   ]
  }
 },
 "look": {
  "rim": [
   122.29,
   123.43,
   123.45,
   122.68,
   121.53,
   120.35,
   119.45,
   118.98,
   118.99,
   119.37,
   119.93,
   120.4,
   120.53,
   120.09,
   118.96,
   117.15,
   114.78,
   112.11,
   109.43,
   107.1,
   105.41,
   104.56,
   104.64,
   105.56,
   107.09,
   108.87,
   110.44,
   111.37,
   111.24,
   109.77,
   106.86,
   102.6,
   97.27,
   91.33,
   85.36,
   80,
   75.84,
   74,
   74,
   74.55,
   78.2,
   83.51,
   90,
   97.07,
   104.09,
   110.49,
   115.81,
   119.78
  ],
  "pieces": [
   {
    "look": "edge",
    "o": {
     "ax": 124.49,
     "az": 7,
     "bx": 121.37,
     "bz": 39.52,
     "r": 0.6,
     "height": 3,
     "kind": "wall",
     "fixed": true
    }
   },
   {
    "look": "edge",
    "o": {
     "ax": 121.37,
     "az": 39.52,
     "bx": 107.15,
     "bz": 68.86,
     "r": 0.6,
     "height": 3,
     "kind": "wall",
     "fixed": true
    }
   },
   {
    "look": "edge",
    "o": {
     "ax": 107.15,
     "az": 68.86,
     "bx": 86.02,
     "bz": 93.02,
     "r": 0.6,
     "height": 3,
     "kind": "wall",
     "fixed": true
    }
   },
   {
    "look": "edge",
    "o": {
     "ax": 86.02,
     "az": 93.02,
     "bx": 60.6,
     "bz": 111.95,
     "r": 0.6,
     "height": 3,
     "kind": "wall",
     "fixed": true
    }
   },
   {
    "look": "edge",
    "o": {
     "ax": 60.6,
     "az": 111.95,
     "bx": 31.61,
     "bz": 124.97,
     "r": 0.6,
     "height": 3,
     "kind": "wall",
     "fixed": true
    }
   },
   {
    "look": "edge",
    "o": {
     "ax": 31.61,
     "az": 124.97,
     "bx": 0,
     "bz": 129.73,
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
     "az": 129.73,
     "bx": -31.36,
     "bz": 124.03,
     "r": 0.6,
     "height": 3,
     "kind": "wall",
     "fixed": true
    }
   },
   {
    "look": "edge",
    "o": {
     "ax": -31.36,
     "az": 124.03,
     "bx": -58.49,
     "bz": 108.31,
     "r": 0.6,
     "height": 3,
     "kind": "wall",
     "fixed": true
    }
   },
   {
    "look": "edge",
    "o": {
     "ax": -58.49,
     "az": 108.31,
     "bx": -78.93,
     "bz": 85.93,
     "r": 0.6,
     "height": 3,
     "kind": "wall",
     "fixed": true
    }
   },
   {
    "look": "edge",
    "o": {
     "ax": -78.93,
     "az": 85.93,
     "bx": -93.19,
     "bz": 60.8,
     "r": 0.6,
     "height": 3,
     "kind": "wall",
     "fixed": true
    }
   },
   {
    "look": "edge",
    "o": {
     "ax": -93.19,
     "az": 60.8,
     "bx": -103.2,
     "bz": 34.65,
     "r": 0.6,
     "height": 3,
     "kind": "wall",
     "fixed": true
    }
   },
   {
    "look": "edge",
    "o": {
     "ax": -103.2,
     "az": 34.65,
     "bx": -109.29,
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
     "ax": -109.29,
     "az": 7,
     "bx": -108.8,
     "bz": -22.15,
     "r": 0.6,
     "height": 3,
     "kind": "wall",
     "fixed": true
    }
   },
   {
    "look": "edge",
    "o": {
     "ax": -108.8,
     "az": -22.15,
     "bx": -98.24,
     "bz": -49.72,
     "r": 0.6,
     "height": 3,
     "kind": "wall",
     "fixed": true
    }
   },
   {
    "look": "edge",
    "o": {
     "ax": -98.24,
     "az": -49.72,
     "bx": -77.12,
     "bz": -70.12,
     "r": 0.6,
     "height": 3,
     "kind": "wall",
     "fixed": true
    }
   },
   {
    "look": "edge",
    "o": {
     "ax": -77.12,
     "az": -70.12,
     "bx": -49.74,
     "bz": -79.14,
     "r": 0.6,
     "height": 3,
     "kind": "wall",
     "fixed": true
    }
   },
   {
    "look": "edge",
    "o": {
     "ax": -49.74,
     "az": -79.14,
     "bx": -22.66,
     "bz": -77.58,
     "r": 0.6,
     "height": 3,
     "kind": "wall",
     "fixed": true
    }
   },
   {
    "look": "edge",
    "o": {
     "ax": -22.66,
     "az": -77.58,
     "bx": 0,
     "bz": -71.04,
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
     "az": -71.04,
     "bx": 19.72,
     "bz": -66.6,
     "r": 0.6,
     "height": 3,
     "kind": "wall",
     "fixed": true
    }
   },
   {
    "look": "edge",
    "o": {
     "ax": 19.72,
     "az": -66.6,
     "bx": 40.2,
     "bz": -62.63,
     "r": 0.6,
     "height": 3,
     "kind": "wall",
     "fixed": true
    }
   },
   {
    "look": "edge",
    "o": {
     "ax": 40.2,
     "az": -62.63,
     "bx": 65.2,
     "bz": -58.2,
     "r": 0.6,
     "height": 3,
     "kind": "wall",
     "fixed": true
    }
   },
   {
    "look": "edge",
    "o": {
     "ax": 65.2,
     "az": -58.2,
     "bx": 92.05,
     "bz": -46.15,
     "r": 0.6,
     "height": 3,
     "kind": "wall",
     "fixed": true
    }
   },
   {
    "look": "edge",
    "o": {
     "ax": 92.05,
     "az": -46.15,
     "bx": 113.99,
     "bz": -23.54,
     "r": 0.6,
     "height": 3,
     "kind": "wall",
     "fixed": true
    }
   },
   {
    "look": "edge",
    "o": {
     "ax": 113.99,
     "az": -23.54,
     "bx": 124.49,
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
     "az": 111.03,
     "bx": 0,
     "bz": 111.03,
     "r": 0.9,
     "height": 0.9,
     "kind": "pillar"
    }
   },
   {
    "look": "tent",
    "o": {
     "ax": -8.5,
     "az": 114.03,
     "bx": -8.5,
     "bz": 114.03,
     "r": 1.7,
     "height": 2.6,
     "kind": "pillar"
    }
   },
   {
    "look": "tent",
    "o": {
     "ax": 8.5,
     "az": 110.03,
     "bx": 8.5,
     "bz": 110.03,
     "r": 1.7,
     "height": 2.6,
     "kind": "pillar"
    }
   },
   {
    "look": "crate",
    "o": {
     "ax": -5,
     "az": 107.53,
     "bx": -5,
     "bz": 107.53,
     "r": 0.8,
     "height": 1.2,
     "kind": "pillar"
    }
   },
   {
    "look": "crate",
    "o": {
     "ax": 5.4,
     "az": 113.73,
     "bx": 5.4,
     "bz": 113.73,
     "r": 0.8,
     "height": 1.2,
     "kind": "pillar"
    }
   },
   {
    "look": "stall",
    "o": {
     "ax": 4.2,
     "az": 118.13,
     "bx": 7,
     "bz": 117.13,
     "r": 0.4,
     "height": 1,
     "kind": "wall"
    }
   },
   {
    "look": "house",
    "o": {
     "ax": -24,
     "az": -58.34,
     "bx": -3.4,
     "bz": -59.84,
     "r": 0.6,
     "height": 3.8,
     "kind": "wall"
    }
   },
   {
    "look": "house",
    "o": {
     "ax": 3.4,
     "az": -59.84,
     "bx": 24,
     "bz": -58.34,
     "r": 0.6,
     "height": 3.8,
     "kind": "wall"
    }
   },
   {
    "look": "rock",
    "o": {
     "ax": -30,
     "az": -70.19,
     "bx": -30,
     "bz": -70.19,
     "r": 10.65,
     "height": 1.6,
     "kind": "pillar"
    }
   },
   {
    "look": "rock",
    "o": {
     "ax": -27.5,
     "az": -69.69,
     "bx": -27.5,
     "bz": -69.69,
     "r": 10.15,
     "height": 1.6,
     "kind": "pillar"
    }
   },
   {
    "look": "rock",
    "o": {
     "ax": -25,
     "az": -69.44,
     "bx": -25,
     "bz": -69.44,
     "r": 9.9,
     "height": 1.6,
     "kind": "pillar"
    }
   },
   {
    "look": "rock",
    "o": {
     "ax": -22.5,
     "az": -69.49,
     "bx": -22.5,
     "bz": -69.49,
     "r": 9.85,
     "height": 1.6,
     "kind": "pillar"
    }
   },
   {
    "look": "rock",
    "o": {
     "ax": -20,
     "az": -69.59,
     "bx": -20,
     "bz": -69.59,
     "r": 9.75,
     "height": 1.6,
     "kind": "pillar"
    }
   },
   {
    "look": "rock",
    "o": {
     "ax": -17.5,
     "az": -69.18,
     "bx": -17.5,
     "bz": -69.18,
     "r": 9.16,
     "height": 1.6,
     "kind": "pillar"
    }
   },
   {
    "look": "rock",
    "o": {
     "ax": -15,
     "az": -68.77,
     "bx": -15,
     "bz": -68.77,
     "r": 8.57,
     "height": 1.6,
     "kind": "pillar"
    }
   },
   {
    "look": "rock",
    "o": {
     "ax": -12.5,
     "az": -68.36,
     "bx": -12.5,
     "bz": -68.36,
     "r": 7.98,
     "height": 1.6,
     "kind": "pillar"
    }
   },
   {
    "look": "rock",
    "o": {
     "ax": -10,
     "az": -68.45,
     "bx": -10,
     "bz": -68.45,
     "r": 7.89,
     "height": 1.6,
     "kind": "pillar"
    }
   },
   {
    "look": "rock",
    "o": {
     "ax": -7.5,
     "az": -68.29,
     "bx": -7.5,
     "bz": -68.29,
     "r": 7.55,
     "height": 1.6,
     "kind": "pillar"
    }
   },
   {
    "look": "rock",
    "o": {
     "ax": -5,
     "az": -67.63,
     "bx": -5,
     "bz": -67.63,
     "r": 6.71,
     "height": 1.6,
     "kind": "pillar"
    }
   },
   {
    "look": "rock",
    "o": {
     "ax": -2.5,
     "az": -67.19,
     "bx": -2.5,
     "bz": -67.19,
     "r": 6.15,
     "height": 1.6,
     "kind": "pillar"
    }
   },
   {
    "look": "rock",
    "o": {
     "ax": 0,
     "az": -66.94,
     "bx": 0,
     "bz": -66.94,
     "r": 5.9,
     "height": 1.6,
     "kind": "pillar"
    }
   },
   {
    "look": "rock",
    "o": {
     "ax": 2.5,
     "az": -66.69,
     "bx": 2.5,
     "bz": -66.69,
     "r": 5.65,
     "height": 1.6,
     "kind": "pillar"
    }
   },
   {
    "look": "rock",
    "o": {
     "ax": 5,
     "az": -66.38,
     "bx": 5,
     "bz": -66.38,
     "r": 5.46,
     "height": 1.6,
     "kind": "pillar"
    }
   },
   {
    "look": "rock",
    "o": {
     "ax": 7.5,
     "az": -65.79,
     "bx": 7.5,
     "bz": -65.79,
     "r": 5.05,
     "height": 1.6,
     "kind": "pillar"
    }
   },
   {
    "look": "rock",
    "o": {
     "ax": 10,
     "az": -65.45,
     "bx": 10,
     "bz": -65.45,
     "r": 4.89,
     "height": 1.6,
     "kind": "pillar"
    }
   },
   {
    "look": "rock",
    "o": {
     "ax": 12.5,
     "az": -65.11,
     "bx": 12.5,
     "bz": -65.11,
     "r": 4.73,
     "height": 1.6,
     "kind": "pillar"
    }
   },
   {
    "look": "rock",
    "o": {
     "ax": 15,
     "az": -64.77,
     "bx": 15,
     "bz": -64.77,
     "r": 4.57,
     "height": 1.6,
     "kind": "pillar"
    }
   },
   {
    "look": "rock",
    "o": {
     "ax": 17.5,
     "az": -64.43,
     "bx": 17.5,
     "bz": -64.43,
     "r": 4.41,
     "height": 1.6,
     "kind": "pillar"
    }
   },
   {
    "look": "rock",
    "o": {
     "ax": 20,
     "az": -64.09,
     "bx": 20,
     "bz": -64.09,
     "r": 4.25,
     "height": 1.6,
     "kind": "pillar"
    }
   },
   {
    "look": "rock",
    "o": {
     "ax": 22.5,
     "az": -63.49,
     "bx": 22.5,
     "bz": -63.49,
     "r": 3.85,
     "height": 1.6,
     "kind": "pillar"
    }
   },
   {
    "look": "rock",
    "o": {
     "ax": 25,
     "az": -63.19,
     "bx": 25,
     "bz": -63.19,
     "r": 3.65,
     "height": 1.6,
     "kind": "pillar"
    }
   },
   {
    "look": "rock",
    "o": {
     "ax": 27.5,
     "az": -62.94,
     "bx": 27.5,
     "bz": -62.94,
     "r": 3.4,
     "height": 1.6,
     "kind": "pillar"
    }
   },
   {
    "look": "rock",
    "o": {
     "ax": 30,
     "az": -62.44,
     "bx": 30,
     "bz": -62.44,
     "r": 2.9,
     "height": 1.6,
     "kind": "pillar"
    }
   },
   {
    "look": "rock",
    "o": {
     "ax": -52.05,
     "az": 113.78,
     "bx": -39.87,
     "bz": 103.15,
     "r": 1.7,
     "height": 9,
     "kind": "wall"
    }
   },
   {
    "look": "rock",
    "o": {
     "ax": -39.87,
     "az": 103.15,
     "bx": -28.82,
     "bz": 91.34,
     "r": 1.7,
     "height": 9,
     "kind": "wall"
    }
   },
   {
    "look": "rock",
    "o": {
     "ax": -18.9,
     "az": 81.75,
     "bx": -4.23,
     "bz": 67.58,
     "r": 1.7,
     "height": 9,
     "kind": "wall"
    }
   },
   {
    "look": "rock",
    "o": {
     "ax": -4.02,
     "az": 67.72,
     "bx": 13.83,
     "bz": 83.46,
     "r": 1.7,
     "height": 9,
     "kind": "wall"
    }
   },
   {
    "look": "rock",
    "o": {
     "ax": 26.12,
     "az": 94.31,
     "bx": 39.41,
     "bz": 105.55,
     "r": 1.7,
     "height": 9,
     "kind": "wall"
    }
   },
   {
    "look": "rock",
    "o": {
     "ax": 39.41,
     "az": 105.55,
     "bx": 52.22,
     "bz": 117.33,
     "r": 1.7,
     "height": 9,
     "kind": "wall"
    }
   },
   {
    "look": "rock",
    "o": {
     "ax": 21.41,
     "az": -21.33,
     "bx": 8.61,
     "bz": -21.07,
     "r": 1.7,
     "height": 9,
     "kind": "wall"
    }
   },
   {
    "look": "rock",
    "o": {
     "ax": -7.79,
     "az": -20.73,
     "bx": -32.58,
     "bz": -20.22,
     "r": 1.7,
     "height": 9,
     "kind": "wall"
    }
   },
   {
    "look": "rock",
    "o": {
     "ax": 24.71,
     "az": -66.12,
     "bx": 23.36,
     "bz": -47.37,
     "r": 1.7,
     "height": 9,
     "kind": "wall"
    }
   },
   {
    "look": "rock",
    "o": {
     "ax": 22.17,
     "az": -31.02,
     "bx": 21.5,
     "bz": -21.74,
     "r": 1.7,
     "height": 9,
     "kind": "wall"
    }
   },
   {
    "look": "rock",
    "o": {
     "ax": -32.98,
     "az": -20.24,
     "bx": -33.02,
     "bz": -32.54,
     "r": 1.7,
     "height": 9,
     "kind": "wall"
    }
   },
   {
    "look": "rock",
    "o": {
     "ax": -33.07,
     "az": -48.93,
     "bx": -33.9,
     "bz": -64.58,
     "r": 1.7,
     "height": 9,
     "kind": "wall"
    }
   },
   {
    "look": "rock",
    "o": {
     "ax": -33.9,
     "az": -64.58,
     "bx": -33.17,
     "bz": -80.23,
     "r": 1.7,
     "height": 9,
     "kind": "wall"
    }
   },
   {
    "look": "rock",
    "o": {
     "ax": -40.75,
     "az": -6.31,
     "bx": -33.86,
     "bz": 7.35,
     "r": 1.7,
     "height": 9,
     "kind": "wall"
    }
   },
   {
    "look": "rock",
    "o": {
     "ax": -26.47,
     "az": 21.99,
     "bx": -21.38,
     "bz": 32.08,
     "r": 1.7,
     "height": 9,
     "kind": "wall"
    }
   },
   {
    "look": "rock",
    "o": {
     "ax": -110.51,
     "az": -1.9,
     "bx": -90.31,
     "bz": -1.99,
     "r": 1.7,
     "height": 9,
     "kind": "wall"
    }
   },
   {
    "look": "rock",
    "o": {
     "ax": -90.31,
     "az": -1.99,
     "bx": -70.3,
     "bz": -4.7,
     "r": 1.7,
     "height": 9,
     "kind": "wall"
    }
   },
   {
    "look": "rock",
    "o": {
     "ax": -56.54,
     "az": -5.66,
     "bx": -41.17,
     "bz": -6.73,
     "r": 1.7,
     "height": 9,
     "kind": "wall"
    }
   },
   {
    "look": "rock",
    "o": {
     "ax": -21.35,
     "az": 32.23,
     "bx": -47.01,
     "bz": 42.92,
     "r": 1.7,
     "height": 9,
     "kind": "wall"
    }
   },
   {
    "look": "rock",
    "o": {
     "ax": -62.15,
     "az": 49.22,
     "bx": -77.09,
     "bz": 56.66,
     "r": 1.7,
     "height": 9,
     "kind": "wall"
    }
   },
   {
    "look": "rock",
    "o": {
     "ax": -77.09,
     "az": 56.66,
     "bx": -92.89,
     "bz": 62.03,
     "r": 1.7,
     "height": 9,
     "kind": "wall"
    }
   },
   {
    "look": "rock",
    "o": {
     "ax": 35.03,
     "az": 24.02,
     "bx": 42.64,
     "bz": 4.98,
     "r": 1.7,
     "height": 9,
     "kind": "wall"
    }
   },
   {
    "look": "rock",
    "o": {
     "ax": 43.18,
     "az": 4.48,
     "bx": 53.86,
     "bz": -0.54,
     "r": 1.7,
     "height": 9,
     "kind": "wall"
    }
   },
   {
    "look": "rock",
    "o": {
     "ax": 68.7,
     "az": -7.52,
     "bx": 91.06,
     "bz": -16.13,
     "r": 1.7,
     "height": 9,
     "kind": "wall"
    }
   },
   {
    "look": "rock",
    "o": {
     "ax": 91.06,
     "az": -16.13,
     "bx": 111.96,
     "bz": -27.84,
     "r": 1.7,
     "height": 9,
     "kind": "wall"
    }
   },
   {
    "look": "rock",
    "o": {
     "ax": 95.09,
     "az": 84.8,
     "bx": 80.4,
     "bz": 68.53,
     "r": 1.7,
     "height": 9,
     "kind": "wall"
    }
   },
   {
    "look": "rock",
    "o": {
     "ax": 80.4,
     "az": 68.53,
     "bx": 64.26,
     "bz": 53.69,
     "r": 1.7,
     "height": 9,
     "kind": "wall"
    }
   },
   {
    "look": "rock",
    "o": {
     "ax": 52.72,
     "az": 42.04,
     "bx": 35.26,
     "bz": 24.43,
     "r": 1.7,
     "height": 9,
     "kind": "wall"
    }
   },
   {
    "look": "rock",
    "o": {
     "ax": 21.59,
     "az": -21.19,
     "bx": 23.05,
     "bz": -19.41,
     "r": 1.7,
     "height": 9,
     "kind": "wall"
    }
   },
   {
    "look": "rock",
    "o": {
     "ax": 31.79,
     "az": -8.73,
     "bx": 42.49,
     "bz": 4.35,
     "r": 1.7,
     "height": 9,
     "kind": "wall"
    }
   },
   {
    "look": "rock",
    "o": {
     "ax": -40.79,
     "az": -7.03,
     "bx": -33.14,
     "bz": -19.93,
     "r": 1.7,
     "height": 9,
     "kind": "wall"
    }
   },
   {
    "look": "rock",
    "o": {
     "ax": -3.46,
     "az": 46.09,
     "bx": -8.44,
     "bz": 42.23,
     "r": 1.7,
     "height": 9,
     "kind": "wall"
    }
   },
   {
    "look": "rock",
    "o": {
     "ax": -19.33,
     "az": 33.75,
     "bx": -21.23,
     "bz": 32.28,
     "r": 1.7,
     "height": 9,
     "kind": "wall"
    }
   },
   {
    "look": "rock",
    "o": {
     "ax": 34.64,
     "az": 24.34,
     "bx": 26.17,
     "bz": 29.27,
     "r": 1.7,
     "height": 9,
     "kind": "wall"
    }
   },
   {
    "look": "rock",
    "o": {
     "ax": 14.25,
     "az": 36.21,
     "bx": -2.95,
     "bz": 46.23,
     "r": 1.7,
     "height": 9,
     "kind": "wall"
    }
   },
   {
    "look": "rock",
    "o": {
     "ax": -3.16,
     "az": 46.56,
     "bx": -3.4,
     "bz": 51.36,
     "r": 1.7,
     "height": 9,
     "kind": "wall"
    }
   },
   {
    "look": "rock",
    "o": {
     "ax": -4.08,
     "az": 65.14,
     "bx": -4.2,
     "bz": 67.54,
     "r": 1.7,
     "height": 9,
     "kind": "wall"
    }
   },
   {
    "look": "rock",
    "o": {
     "ax": -61.04,
     "az": 37.7,
     "bx": -61.04,
     "bz": 37.7,
     "r": 1.9,
     "height": 4.2,
     "kind": "pillar"
    }
   },
   {
    "look": "rock",
    "o": {
     "ax": -65.3,
     "az": 36.42,
     "bx": -65.3,
     "bz": 36.42,
     "r": 1.9,
     "height": 4.2,
     "kind": "pillar"
    }
   },
   {
    "look": "rock",
    "o": {
     "ax": -68.07,
     "az": 32.93,
     "bx": -68.07,
     "bz": 32.93,
     "r": 1.9,
     "height": 4.2,
     "kind": "pillar"
    }
   },
   {
    "look": "rock",
    "o": {
     "ax": -68.33,
     "az": 28.49,
     "bx": -68.33,
     "bz": 28.49,
     "r": 1.9,
     "height": 4.2,
     "kind": "pillar"
    }
   },
   {
    "look": "rock",
    "o": {
     "ax": -65.99,
     "az": 24.7,
     "bx": -65.99,
     "bz": 24.7,
     "r": 1.9,
     "height": 4.2,
     "kind": "pillar"
    }
   },
   {
    "look": "stall",
    "o": {
     "ax": -56.03,
     "az": 35.31,
     "bx": -54.76,
     "bz": 31.61,
     "r": 0.5,
     "height": 1.1,
     "kind": "wall"
    }
   },
   {
    "look": "rock",
    "o": {
     "ax": 82.85,
     "az": 33.72,
     "bx": 82.85,
     "bz": 33.72,
     "r": 1.2,
     "height": 1.6,
     "kind": "pillar"
    }
   },
   {
    "look": "rock",
    "o": {
     "ax": 74.81,
     "az": 36.34,
     "bx": 74.81,
     "bz": 36.34,
     "r": 1.2,
     "height": 1.6,
     "kind": "pillar"
    }
   },
   {
    "look": "rock",
    "o": {
     "ax": 69.83,
     "az": 29.49,
     "bx": 69.83,
     "bz": 29.49,
     "r": 1.2,
     "height": 1.6,
     "kind": "pillar"
    }
   },
   {
    "look": "rock",
    "o": {
     "ax": 74.81,
     "az": 22.64,
     "bx": 74.81,
     "bz": 22.64,
     "r": 1.2,
     "height": 1.6,
     "kind": "pillar"
    }
   },
   {
    "look": "rock",
    "o": {
     "ax": 82.85,
     "az": 25.26,
     "bx": 82.85,
     "bz": 25.26,
     "r": 1.2,
     "height": 1.6,
     "kind": "pillar"
    }
   },
   {
    "look": "post",
    "o": {
     "ax": 6.16,
     "az": 2.92,
     "bx": 6.16,
     "bz": 2.92,
     "r": 0.75,
     "height": 2.6,
     "kind": "pillar"
    }
   },
   {
    "look": "post",
    "o": {
     "ax": -1.22,
     "az": 5.32,
     "bx": -1.22,
     "bz": 5.32,
     "r": 0.75,
     "height": 2.6,
     "kind": "pillar"
    }
   },
   {
    "look": "post",
    "o": {
     "ax": -5.78,
     "az": -0.96,
     "bx": -5.78,
     "bz": -0.96,
     "r": 0.75,
     "height": 2.6,
     "kind": "pillar"
    }
   },
   {
    "look": "post",
    "o": {
     "ax": -1.22,
     "az": -7.24,
     "bx": -1.22,
     "bz": -7.24,
     "r": 0.75,
     "height": 2.6,
     "kind": "pillar"
    }
   },
   {
    "look": "post",
    "o": {
     "ax": 6.16,
     "az": -4.84,
     "bx": 6.16,
     "bz": -4.84,
     "r": 0.75,
     "height": 2.6,
     "kind": "pillar"
    }
   },
   {
    "look": "post",
    "o": {
     "ax": 52,
     "az": -32.85,
     "bx": 52,
     "bz": -32.85,
     "r": 0.9,
     "height": 3.4,
     "kind": "pillar"
    }
   },
   {
    "look": "post",
    "o": {
     "ax": 43.06,
     "az": -29.94,
     "bx": 43.06,
     "bz": -29.94,
     "r": 0.9,
     "height": 3.4,
     "kind": "pillar"
    }
   },
   {
    "look": "post",
    "o": {
     "ax": 37.53,
     "az": -37.55,
     "bx": 37.53,
     "bz": -37.55,
     "r": 0.9,
     "height": 3.4,
     "kind": "pillar"
    }
   },
   {
    "look": "post",
    "o": {
     "ax": 43.06,
     "az": -45.16,
     "bx": 43.06,
     "bz": -45.16,
     "r": 0.9,
     "height": 3.4,
     "kind": "pillar"
    }
   },
   {
    "look": "post",
    "o": {
     "ax": 52,
     "az": -42.25,
     "bx": 52,
     "bz": -42.25,
     "r": 0.9,
     "height": 3.4,
     "kind": "pillar"
    }
   },
   {
    "look": "post",
    "o": {
     "ax": -61.47,
     "az": -34.72,
     "bx": -61.47,
     "bz": -34.72,
     "r": 0.9,
     "height": 3.8,
     "kind": "pillar"
    }
   },
   {
    "look": "post",
    "o": {
     "ax": -69.38,
     "az": -33.89,
     "bx": -69.38,
     "bz": -33.89,
     "r": 0.9,
     "height": 3.8,
     "kind": "pillar"
    }
   },
   {
    "look": "post",
    "o": {
     "ax": -73.59,
     "az": -40.63,
     "bx": -73.59,
     "bz": -40.63,
     "r": 0.9,
     "height": 3.8,
     "kind": "pillar"
    }
   },
   {
    "look": "post",
    "o": {
     "ax": -69.38,
     "az": -47.37,
     "bx": -69.38,
     "bz": -47.37,
     "r": 0.9,
     "height": 3.8,
     "kind": "pillar"
    }
   },
   {
    "look": "post",
    "o": {
     "ax": -61.47,
     "az": -46.54,
     "bx": -61.47,
     "bz": -46.54,
     "r": 0.9,
     "height": 3.8,
     "kind": "pillar"
    }
   },
   {
    "look": "post",
    "o": {
     "ax": -51.16,
     "az": 62.4,
     "bx": -51.16,
     "bz": 62.4,
     "r": 0.35,
     "height": 3,
     "kind": "pillar"
    }
   },
   {
    "look": "barrel",
    "o": {
     "ax": -43.78,
     "az": 61.56,
     "bx": -43.78,
     "bz": 61.56,
     "r": 0.6,
     "height": 0.7,
     "kind": "pillar"
    }
   },
   {
    "look": "rock",
    "o": {
     "ax": -46.93,
     "az": 67.44,
     "bx": -46.93,
     "bz": 67.44,
     "r": 1,
     "height": 1.3,
     "kind": "pillar"
    }
   },
   {
    "look": "post",
    "o": {
     "ax": 39.69,
     "az": 69.43,
     "bx": 39.69,
     "bz": 69.43,
     "r": 0.35,
     "height": 3,
     "kind": "pillar"
    }
   },
   {
    "look": "barrel",
    "o": {
     "ax": 40.76,
     "az": 62.08,
     "bx": 40.76,
     "bz": 62.08,
     "r": 0.6,
     "height": 0.7,
     "kind": "pillar"
    }
   },
   {
    "look": "rock",
    "o": {
     "ax": 45.64,
     "az": 66.63,
     "bx": 45.64,
     "bz": 66.63,
     "r": 1,
     "height": 1.3,
     "kind": "pillar"
    }
   },
   {
    "look": "post",
    "o": {
     "ax": -8.33,
     "az": -47.23,
     "bx": -8.33,
     "bz": -47.23,
     "r": 0.9,
     "height": 4,
     "kind": "pillar"
    }
   },
   {
    "look": "post",
    "o": {
     "ax": -3.16,
     "az": -50.85,
     "bx": -3.16,
     "bz": -50.85,
     "r": 0.9,
     "height": 4,
     "kind": "pillar"
    }
   },
   {
    "look": "post",
    "o": {
     "ax": 3.16,
     "az": -50.85,
     "bx": 3.16,
     "bz": -50.85,
     "r": 0.9,
     "height": 4,
     "kind": "pillar"
    }
   },
   {
    "look": "post",
    "o": {
     "ax": 8.33,
     "az": -47.23,
     "bx": 8.33,
     "bz": -47.23,
     "r": 0.9,
     "height": 4,
     "kind": "pillar"
    }
   },
   {
    "look": "rock",
    "o": {
     "ax": 111.01,
     "az": 19.92,
     "bx": 111.01,
     "bz": 19.92,
     "r": 3.58,
     "height": 7.52,
     "kind": "pillar"
    }
   },
   {
    "look": "stall",
    "o": {
     "ax": -5.05,
     "az": 81.28,
     "bx": -4.29,
     "bz": 85.68,
     "r": 0.45,
     "height": 1.1,
     "kind": "wall"
    }
   },
   {
    "look": "rock",
    "o": {
     "ax": -52.59,
     "az": 95.71,
     "bx": -52.59,
     "bz": 95.71,
     "r": 1.1,
     "height": 1.56,
     "kind": "pillar"
    }
   },
   {
    "look": "rock",
    "o": {
     "ax": 86.44,
     "az": -35.22,
     "bx": 86.44,
     "bz": -35.22,
     "r": 3.69,
     "height": 8.87,
     "kind": "pillar"
    }
   },
   {
    "look": "rock",
    "o": {
     "ax": -81.74,
     "az": 50.26,
     "bx": -81.74,
     "bz": 50.26,
     "r": 1.17,
     "height": 1.55,
     "kind": "pillar"
    }
   },
   {
    "look": "post",
    "o": {
     "ax": -45.73,
     "az": -71.88,
     "bx": -45.73,
     "bz": -71.88,
     "r": 0.76,
     "height": 10.26,
     "kind": "pillar"
    }
   },
   {
    "look": "barrel",
    "o": {
     "ax": 81.67,
     "az": -1.76,
     "bx": 81.67,
     "bz": -1.76,
     "r": 0.6,
     "height": 0.7,
     "kind": "pillar"
    }
   },
   {
    "look": "post",
    "o": {
     "ax": 45.86,
     "az": -10.02,
     "bx": 45.86,
     "bz": -10.02,
     "r": 0.9,
     "height": 9.67,
     "kind": "pillar"
    }
   },
   {
    "look": "rock",
    "o": {
     "ax": -79.89,
     "az": -56.96,
     "bx": -79.89,
     "bz": -56.96,
     "r": 3.43,
     "height": 7.92,
     "kind": "pillar"
    }
   },
   {
    "look": "post",
    "o": {
     "ax": -75.76,
     "az": 43.15,
     "bx": -75.76,
     "bz": 43.15,
     "r": 0.89,
     "height": 8.27,
     "kind": "pillar"
    }
   },
   {
    "look": "stall",
    "o": {
     "ax": -6.34,
     "az": -7.73,
     "bx": -7.03,
     "bz": -11.33,
     "r": 0.45,
     "height": 1.1,
     "kind": "wall"
    }
   },
   {
    "look": "post",
    "o": {
     "ax": -55.16,
     "az": 101.92,
     "bx": -55.16,
     "bz": 101.92,
     "r": 0.87,
     "height": 11.01,
     "kind": "pillar"
    }
   },
   {
    "look": "rock",
    "o": {
     "ax": -82.77,
     "az": 6.37,
     "bx": -82.77,
     "bz": 6.37,
     "r": 2.76,
     "height": 8.69,
     "kind": "pillar"
    }
   },
   {
    "look": "post",
    "o": {
     "ax": 27.44,
     "az": 36.08,
     "bx": 27.44,
     "bz": 36.08,
     "r": 0.83,
     "height": 11.27,
     "kind": "pillar"
    }
   },
   {
    "look": "rock",
    "o": {
     "ax": 108.6,
     "az": 42.99,
     "bx": 108.6,
     "bz": 42.99,
     "r": 3.93,
     "height": 8.67,
     "kind": "pillar"
    }
   },
   {
    "look": "rock",
    "o": {
     "ax": -52.5,
     "az": -25.45,
     "bx": -52.5,
     "bz": -25.45,
     "r": 3.76,
     "height": 8.51,
     "kind": "pillar"
    }
   },
   {
    "look": "rock",
    "o": {
     "ax": 73.26,
     "az": -34.46,
     "bx": 73.26,
     "bz": -34.46,
     "r": 3.59,
     "height": 7.45,
     "kind": "pillar"
    }
   },
   {
    "look": "post",
    "o": {
     "ax": -29.28,
     "az": -0.52,
     "bx": -29.28,
     "bz": -0.52,
     "r": 0.88,
     "height": 8.65,
     "kind": "pillar"
    }
   },
   {
    "look": "barrel",
    "o": {
     "ax": -70.32,
     "az": 70.3,
     "bx": -70.32,
     "bz": 70.3,
     "r": 0.6,
     "height": 0.7,
     "kind": "pillar"
    }
   },
   {
    "look": "post",
    "o": {
     "ax": -80.33,
     "az": -18.78,
     "bx": -80.33,
     "bz": -18.78,
     "r": 0.89,
     "height": 10.13,
     "kind": "pillar"
    }
   },
   {
    "look": "rock",
    "o": {
     "ax": -81.03,
     "az": 16.2,
     "bx": -81.03,
     "bz": 16.2,
     "r": 3.6,
     "height": 8.98,
     "kind": "pillar"
    }
   },
   {
    "look": "rock",
    "o": {
     "ax": 23.73,
     "az": 6.22,
     "bx": 23.73,
     "bz": 6.22,
     "r": 2.79,
     "height": 9.18,
     "kind": "pillar"
    }
   },
   {
    "look": "rock",
    "o": {
     "ax": 70.5,
     "az": -17.07,
     "bx": 70.5,
     "bz": -17.07,
     "r": 1.06,
     "height": 1.5,
     "kind": "pillar"
    }
   },
   {
    "look": "barrel",
    "o": {
     "ax": -93.07,
     "az": 28.41,
     "bx": -93.07,
     "bz": 28.41,
     "r": 0.6,
     "height": 0.7,
     "kind": "pillar"
    }
   },
   {
    "look": "stall",
    "o": {
     "ax": 97.48,
     "az": -7.98,
     "bx": 93.68,
     "bz": -9.33,
     "r": 0.45,
     "height": 1.1,
     "kind": "wall"
    }
   },
   {
    "look": "post",
    "o": {
     "ax": -21.95,
     "az": 97.72,
     "bx": -21.95,
     "bz": 97.72,
     "r": 0.77,
     "height": 9.8,
     "kind": "pillar"
    }
   },
   {
    "look": "rock",
    "o": {
     "ax": -90.24,
     "az": 5.19,
     "bx": -90.24,
     "bz": 5.19,
     "r": 1.43,
     "height": 1.58,
     "kind": "pillar"
    }
   },
   {
    "look": "post",
    "o": {
     "ax": 16.1,
     "az": 11.52,
     "bx": 16.1,
     "bz": 11.52,
     "r": 0.87,
     "height": 9.74,
     "kind": "pillar"
    }
   },
   {
    "look": "post",
    "o": {
     "ax": 96.86,
     "az": 17.23,
     "bx": 96.86,
     "bz": 17.23,
     "r": 0.96,
     "height": 8.86,
     "kind": "pillar"
    }
   },
   {
    "look": "rock",
    "o": {
     "ax": -30.31,
     "az": -10.54,
     "bx": -30.31,
     "bz": -10.54,
     "r": 0.94,
     "height": 1.5,
     "kind": "pillar"
    }
   },
   {
    "look": "rock",
    "o": {
     "ax": 57.93,
     "az": 66.42,
     "bx": 57.93,
     "bz": 66.42,
     "r": 4.03,
     "height": 8.88,
     "kind": "pillar"
    }
   },
   {
    "look": "rock",
    "o": {
     "ax": 38.7,
     "az": 112.89,
     "bx": 38.7,
     "bz": 112.89,
     "r": 0.91,
     "height": 1.5,
     "kind": "pillar"
    }
   },
   {
    "look": "stall",
    "o": {
     "ax": 93.32,
     "az": 55.27,
     "bx": 93.08,
     "bz": 50.51,
     "r": 0.45,
     "height": 1.1,
     "kind": "wall"
    }
   },
   {
    "look": "rock",
    "o": {
     "ax": 22.18,
     "az": 22.66,
     "bx": 22.18,
     "bz": 22.66,
     "r": 1.14,
     "height": 1.28,
     "kind": "pillar"
    }
   },
   {
    "look": "rock",
    "o": {
     "ax": -60.95,
     "az": 68.01,
     "bx": -60.95,
     "bz": 68.01,
     "r": 1.15,
     "height": 1.5,
     "kind": "pillar"
    }
   },
   {
    "look": "rock",
    "o": {
     "ax": 42.09,
     "az": -17.98,
     "bx": 42.09,
     "bz": -17.98,
     "r": 0.95,
     "height": 1.5,
     "kind": "pillar"
    }
   },
   {
    "look": "rock",
    "o": {
     "ax": -60.95,
     "az": -65,
     "bx": -60.95,
     "bz": -65,
     "r": 3.68,
     "height": 8.67,
     "kind": "pillar"
    }
   },
   {
    "look": "rock",
    "o": {
     "ax": 33.88,
     "az": 91.15,
     "bx": 33.88,
     "bz": 91.15,
     "r": 1.12,
     "height": 1.5,
     "kind": "pillar"
    }
   },
   {
    "look": "rock",
    "o": {
     "ax": 87.37,
     "az": -25.48,
     "bx": 87.37,
     "bz": -25.48,
     "r": 0.95,
     "height": 1.5,
     "kind": "pillar"
    }
   },
   {
    "look": "rock",
    "o": {
     "ax": 14.66,
     "az": 102.05,
     "bx": 14.66,
     "bz": 102.05,
     "r": 1.14,
     "height": 1.5,
     "kind": "pillar"
    }
   },
   {
    "look": "rock",
    "o": {
     "ax": -86.21,
     "az": -38.16,
     "bx": -86.21,
     "bz": -38.16,
     "r": 1.03,
     "height": 1.16,
     "kind": "pillar"
    }
   },
   {
    "look": "stall",
    "o": {
     "ax": -83.51,
     "az": 29.96,
     "bx": -86.58,
     "bz": 31.24,
     "r": 0.45,
     "height": 1.1,
     "kind": "wall"
    }
   },
   {
    "look": "rock",
    "o": {
     "ax": -24.88,
     "az": -50.59,
     "bx": -24.88,
     "bz": -50.59,
     "r": 2.88,
     "height": 9.28,
     "kind": "pillar"
    }
   },
   {
    "look": "rock",
    "o": {
     "ax": -96.08,
     "az": -20.88,
     "bx": -96.08,
     "bz": -20.88,
     "r": 3.18,
     "height": 8.8,
     "kind": "pillar"
    }
   },
   {
    "look": "rock",
    "o": {
     "ax": -56.37,
     "az": 78.76,
     "bx": -56.37,
     "bz": 78.76,
     "r": 4.39,
     "height": 7.97,
     "kind": "pillar"
    }
   },
   {
    "look": "rock",
    "o": {
     "ax": 96.11,
     "az": 41.83,
     "bx": 96.11,
     "bz": 41.83,
     "r": 3.43,
     "height": 8.82,
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
   "log",
   "rock",
   "grove",
   "rock",
   "tree",
   "stump",
   "tree",
   "grove",
   "tree",
   "log",
   "tree",
   "grove",
   "tree",
   "grove",
   "grove",
   "grove",
   "tree",
   "stump",
   "tree",
   "grove",
   "grove",
   "thorn",
   "stump",
   "log",
   "tree",
   "rock",
   "tree",
   "tree",
   "thorn",
   "grove",
   "thorn",
   "log",
   "rock",
   "thorn",
   "thorn",
   "grove",
   "thorn",
   "thorn",
   "thorn",
   "rock",
   "log",
   "grove",
   "grove",
   "grove",
   "grove"
  ],
  "places": [
   {
    "id": "camp",
    "kind": "camp",
    "x": 0,
    "z": 111.53,
    "r": 8
   },
   {
    "id": "den",
    "kind": "den",
    "x": -61.15,
    "z": 30.3,
    "r": 9.5
   },
   {
    "id": "bramble",
    "kind": "bramble",
    "x": 77.03,
    "z": 29.49,
    "r": 9.5
   },
   {
    "id": "stones",
    "kind": "stones",
    "x": 0.82,
    "z": -0.96,
    "r": 7
   },
   {
    "id": "giants",
    "kind": "giants",
    "x": 45.53,
    "z": -37.55,
    "r": 9.5
   },
   {
    "id": "thicket",
    "kind": "thicket",
    "x": -66.09,
    "z": -40.63,
    "r": 9
   },
   {
    "id": "lampw",
    "kind": "lamps",
    "x": -48.01,
    "z": 61.84,
    "r": 7
   },
   {
    "id": "lampe",
    "kind": "lamps",
    "x": 39.95,
    "z": 66.24,
    "r": 7
   },
   {
    "id": "heart",
    "kind": "heart",
    "x": 0,
    "z": -40.84,
    "r": 10
   }
  ],
  "paths": [
   [
    [
     -58.35,
     22.23
    ],
    [
     -55.44,
     30.42
    ],
    [
     -54.58,
     39.07
    ]
   ],
   [
    [
     -54.58,
     39.07
    ],
    [
     -51.83,
     47.18
    ],
    [
     -48.01,
     54.84
    ]
   ],
   [
    [
     0,
     -55.84
    ],
    [
     -1.68,
     -41.84
    ],
    [
     0.41,
     -27.9
    ]
   ],
   [
    [
     0.41,
     -27.9
    ],
    [
     -1.46,
     -17.89
    ],
    [
     0.82,
     -7.96
    ]
   ],
   [
    [
     0,
     -55.84
    ],
    [
     12.1,
     -52.71
    ],
    [
     22.77,
     -46.19
    ]
   ],
   [
    [
     22.77,
     -46.19
    ],
    [
     33.99,
     -43.11
    ],
    [
     45.53,
     -44.55
    ]
   ],
   [
    [
     77.03,
     22.49
    ],
    [
     66.24,
     30.14
    ],
    [
     58.49,
     40.87
    ]
   ],
   [
    [
     58.49,
     40.87
    ],
    [
     49.32,
     50.15
    ],
    [
     39.95,
     59.24
    ]
   ],
   [
    [
     0,
     -55.84
    ],
    [
     -16.29,
     -50.87
    ],
    [
     -33.04,
     -47.73
    ]
   ],
   [
    [
     -33.04,
     -47.73
    ],
    [
     -49.56,
     -46.09
    ],
    [
     -66.09,
     -47.63
    ]
   ],
   [
    [
     77.03,
     22.49
    ],
    [
     67.46,
     6.53
    ],
    [
     61.28,
     -11.03
    ]
   ],
   [
    [
     61.28,
     -11.03
    ],
    [
     51.71,
     -26.99
    ],
    [
     45.53,
     -44.55
    ]
   ],
   [
    [
     0,
     108.03
    ],
    [
     7.62,
     93.15
    ],
    [
     19.98,
     81.89
    ]
   ],
   [
    [
     19.98,
     81.89
    ],
    [
     29.75,
     70.38
    ],
    [
     39.95,
     59.24
    ]
   ],
   [
    [
     -58.35,
     22.23
    ],
    [
     -43.04,
     17.3
    ],
    [
     -30.16,
     7.67
    ]
   ],
   [
    [
     -30.16,
     7.67
    ],
    [
     -13.93,
     1.32
    ],
    [
     0.82,
     -7.96
    ]
   ],
   [
    [
     0.82,
     -7.96
    ],
    [
     -8,
     10.96
    ],
    [
     -13.88,
     30.99
    ]
   ],
   [
    [
     -13.88,
     30.99
    ],
    [
     -30.11,
     44.11
    ],
    [
     -48.01,
     54.84
    ]
   ],
   [
    [
     0,
     108.03
    ],
    [
     -11.11,
     93.11
    ],
    [
     -23.86,
     79.55
    ]
   ],
   [
    [
     -23.86,
     79.55
    ],
    [
     -35.85,
     67.11
    ],
    [
     -48.01,
     54.84
    ]
   ],
   [
    [
     0.82,
     -7.96
    ],
    [
     13.6,
     -15.57
    ],
    [
     27.42,
     -21.07
    ]
   ],
   [
    [
     27.42,
     -21.07
    ],
    [
     34.45,
     -34.37
    ],
    [
     45.53,
     -44.55
    ]
   ],
   [
    [
     -48.01,
     54.84
    ],
    [
     -25.81,
     53.8
    ],
    [
     -3.74,
     51.25
    ]
   ],
   [
    [
     -3.74,
     51.25
    ],
    [
     18.27,
     54.37
    ],
    [
     39.95,
     59.24
    ]
   ],
   [
    [
     0.82,
     -7.96
    ],
    [
     7.94,
     10.37
    ],
    [
     20.21,
     25.74
    ]
   ],
   [
    [
     20.21,
     25.74
    ],
    [
     29.6,
     42.77
    ],
    [
     39.95,
     59.24
    ]
   ],
   [
    [
     -58.35,
     22.23
    ],
    [
     -61.79,
     5.16
    ],
    [
     -63.42,
     -12.18
    ]
   ],
   [
    [
     -63.42,
     -12.18
    ],
    [
     -62.87,
     -30.05
    ],
    [
     -66.09,
     -47.63
    ]
   ]
  ],
  "passes": [
   {
    "x": -54.58,
    "z": 46.07,
    "dx": -0.92,
    "dz": 0.38,
    "w": 6.5
   },
   {
    "x": 0.41,
    "z": -20.9,
    "dx": -1,
    "dz": 0.02,
    "w": 6.5
   },
   {
    "x": 22.77,
    "z": -39.19,
    "dx": -0.07,
    "dz": 1,
    "w": 6.5
   },
   {
    "x": 58.49,
    "z": 47.87,
    "dx": -0.7,
    "dz": -0.71,
    "w": 6.5
   },
   {
    "x": -33.04,
    "z": -40.73,
    "dx": 0,
    "dz": -1,
    "w": 6.5
   },
   {
    "x": 61.28,
    "z": -4.03,
    "dx": 0.91,
    "dz": -0.43,
    "w": 6.5
   },
   {
    "x": 19.98,
    "z": 88.89,
    "dx": 0.75,
    "dz": 0.66,
    "w": 6.5
   },
   {
    "x": -30.16,
    "z": 14.67,
    "dx": 0.45,
    "dz": 0.89,
    "w": 6.5
   },
   {
    "x": -13.88,
    "z": 37.99,
    "dx": -0.79,
    "dz": -0.61,
    "w": 5.2,
    "set": 0
   },
   {
    "x": -23.86,
    "z": 86.55,
    "dx": 0.72,
    "dz": -0.69,
    "w": 5.2,
    "set": 1
   },
   {
    "x": 27.42,
    "z": -14.07,
    "dx": 0.63,
    "dz": 0.77,
    "w": 5.2,
    "set": 0
   },
   {
    "x": -3.74,
    "z": 58.25,
    "dx": -0.05,
    "dz": 1,
    "w": 5.2,
    "set": 1
   },
   {
    "x": 20.21,
    "z": 32.74,
    "dx": -0.86,
    "dz": 0.5,
    "w": 5.2,
    "set": 0
   },
   {
    "x": -63.42,
    "z": -5.18,
    "dx": 1,
    "dz": -0.07,
    "w": 5.2,
    "set": 1
   }
  ],
  "elder": {
   "x": 0,
   "z": -77.84
  },
  "mirror": 1,
  "seed": 1118
 }
};
