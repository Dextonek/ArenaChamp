---
title: The hero framework (design)
tags: [pipeline, heroes, design]
updated: 2026-11-16
---

# The hero framework: the audit and the design

Steps 1 and 2 of `docs/pipeline/hero-framework-brief.md` (the user's yes, 2026-11-16): what the 40 heroes are made of today,
how one hero will live in one folder, the spell building blocks, what must keep working, the risks, and Anka's move planned
file by file. The fight prints that prove a move changes nothing are taken (section 7). **Step 3 is done: Anka is moved
(section 10; the page [hero-framework/anka.html](hero-framework/anka.html)). Step 4's folder move (4a) is done: the other 39 are in folders too,
their spells as they were, none on the blocks yet (section 11; the page [hero-framework/progress.html](hero-framework/progress.html)).** **The blocks trial (section 12):
eight spells of Sefu, Professor Puff and Big Yoko on the blocks, four stayed code; recommendation: some shapes only (the page
[hero-framework/blocks-trial.html](hero-framework/blocks-trial.html)).** The page for
the user: [hero-framework/index.html](hero-framework/index.html).

## 1. In short

- **One folder per hero, `src/heroes/<theme>/`** (`src/heroes/phoenix/` for Anka): a small card (`hero.ts`: name, colours,
  HP, model, body size, shop row, lore and model pointers, and the four spells' card data), the numbers (`numbers.ts`), the
  passive (`trait.ts`), one file per spell (`spells/`), the look parts (`parts.ts`) and the canvas icons (`icons.ts`, now only the
  fallback of the VectorCraft icons). The game finds the folders with `import.meta.glob`; nobody edits a registry.
- **The page's start gets smaller, not bigger.** Today the game's first download is 7.5 MB of script (2.1 MB compressed), and
  every one of the 301 spell effects is in it, 126 of them never needed by the game: 63 tool-page showcases, 60 retired hero
  spells and 3 tests, which no hero, boss, floor or kept file uses (about 18% of that script). The move keeps those on the tool page only, and loads a hero's spells for the fight it is in.
- **Blocks for the rules, code for the look.** Of the 163 spells, 55 are plain blocks, 102 are blocks plus a small hook into
  the hero's own passive, and 6 stay code. But the rules are only about an eighth of a spell's lines: the look (particles,
  meshes, timing of the picture) is the rest, and it moves as it is. The blocks make a spell's rules short and in one place, and
  its danger zone, its tooltip and its hit come from the same numbers; they do not make a spell file short.
- **Nothing is renamed:** a hero's id stays its display name, a spell's id its label, the slot order stays (it is the network
  protocol), and today's import paths stay as facades for the many tools that use them.
- **The proof** is two fight prints per hero (against a ranged foe and a melee one): all 80 taken, every one the same run after
  run (section 7). Five spells are never cast in them and must be checked by hand when their hero moves.

## 2. Today: one hero over many files

Anka, measured (2026-11-16). The brief's list held four files that are not hers: `redLotusInferno.ts` and
`vermilionPhoenixDive.ts` are tool-page showcases, `phoenixFan.ts` and `phoenixGale.ts` are tool-page weapon demos.

| File | Lines | What is in it |
|---|---:|---|
| `src/kits/phoenix.ts` | 650 | the kit (name, HP, four spell cards) and **about 540 lines of canvas icons and portrait** |
| `src/spells/targeted/emberQuill.ts` | 363 | Q: rules and look in one class |
| `src/spells/targeted/fanTheFlames.ts` | 307 | W |
| `src/spells/targeted/emberFlight.ts` | 288 | E |
| `src/spells/targeted/firebird.ts` | 341 | R |
| `src/traits/phoenix.ts` | 487 | the passive (Ashborn, the embers) **and every number of the four spells** |
| `src/effects/parts/phoenix.ts` | 833 | look parts (feathers, nest, egg) |
| `src/heroes.ts` | 3 lines | `MODELS`, `HERO_BODIES`, `HERO_KITS` |
| `src/traits/index.ts`, `src/spells/targeted/index.ts` | 1 + 8 lines | registries |
| `src/icons/vc.ts`, `public/icons/spells/anka-*.svg`, `pipeline/icons/vectorcraft/anka/` | | the VectorCraft icons (merged 2026-11-16) |
| `server/protocol.mjs` | 2 lines | `HERO_SHOP` row, `SHOP.newest` |
| `docs/lore/LORE.md` -> `src/game/lore.ts`, codex | | lore (generated) |
| `blender/heroes/real/` | | the model's build |
| tools by path | | `pipeline/tools/anka-shots.js`, `hero-gate5/raid-cases.js` (import her trait by path), `sim-cells.py`, `lore-page.py`, `kits20.py` (glob `src/kits/`) |

Over all 40 (audit, 2026-11-16): the kit files are 13,109 lines, 11,074 of them icon and portrait drawing; the 163 spells are
43,002 lines, of which the auditors counted about 5,000 as rules (12%, an estimate). A new hero is added by hand in about a dozen
places: `HERO_KITS`, `MODELS`, `HERO_BODIES` (`src/heroes.ts`), `TRAITS` (`src/traits/index.ts`), `targetedModules`,
`REAL_STYLE` (`src/motion/real.ts`), `DUELLISTS` (`src/heroFigure.ts`), `DRAWN` (`src/icons/vc.ts`), `HERO_SHOP` and `PROTOCOL`
(`server/protocol.mjs`), the lore, and the Rust port's lists if ported.

**The Raid and the Climb have no per-hero code.** Raid upgrades and Climb boons read only spell flags (`aim`, `overCover`, `bank`,
`cc`); partners need the kit, its model and its basic attack. The Climb's hand-picked lists (`ECHOES`, the four `ROSTER` copies,
rulers and villagers by name) are content, seeded: they stay as they are, and a new hero is simply not in them until added.

## 3. The folder

```
src/heroes/
  index.ts                 finds the folders (import.meta.glob) and sorts them by `order`
  framework/               the blocks, the block runner, the card helpers (no hero in it)
  phoenix/
    hero.ts                the card (eager, small, no three.js): name, title, order, accent, foil, maxHp, melee, model,
                           body {radius, height}, motion style, shop {kind, shelf}, passive {name, blurb}, twist, speed,
                           attack, icon stem, pointers (lore entry, model build, design doc), and the four spells' cards:
                           key, label, name, range, cooldown, flags (aim, cc, dash ...), targeting, blurb
    numbers.ts             every number of the kit and the passive, once (today at the top of traits/phoenix.ts)
    trait.ts               the passive's hooks and its state (embers), as today
    spells/emberQuill.ts   one file a spell: its rules (blocks and hooks) and its look (today's drawing code)
    spells/...
    parts.ts               look parts shared by her spells and passive
    fight.ts               what one fight needs, loaded lazily: `export { spells, parts }` (a line or two)
    icons.ts               the canvas icons and portrait, the fallback behind public/icons/spells/anka-*.svg
```

- **Found by itself.** `src/heroes/index.ts` reads `import.meta.glob('./*/hero.ts', { eager: true })` (the cards: what the menu,
  the CPU, the protocol and the shop need at once) and `import.meta.glob('./*/fight.ts')` (lazy: each hero's spells, parts and
  look, loaded for a fight). The order is the card's `order` (today's place in `HERO_KITS`, Vesper 0 to Anka 39): a glob comes
  back sorted by path, and the order decides the start hero, the menu ring, the open world's guests and which opponent a seed
  draws, so it must not change.
- **Kept as facades:** `src/heroes.ts` (`HERO_KITS`, `HERO_BODIES`, `modelV4`), `src/traits/index.ts` (`traitFor`, `TRAITS`) and
  `src/spells/targeted/index.ts` (`targetedModules`) re-export from the folders. At least ten tools import these paths
  (`rustfull/export.js`, `rustsim/export.js`, `raid-tool.js`, `tower-tool.js`, `world-tool.js`, `heroes20-engine` ...).
- **By name, on purpose:** the passive, the body and the motion style stay looked up by the hero's name, never put on the kit
  object: the Climb's echo kits copy a real kit under a new name precisely so the boss does not run the hero's passive
  (`tower/floors.ts:94-100`, `tower/world/pieces/ruler.ts:43-47`).
- **Outside Vite:** the server cannot glob. `HERO_SHOP` stays in `server/protocol.mjs` (its key order seeds the weekly free six);
  a check compares it with the cards' `shop` fields, and the new-hero command (step 5) appends the row.
- **Icons** (folded in from the merged icon job): the SVGs stay in `public/icons/spells/<stem>-<slot>.svg` (public files are
  served as they are) and their sources in `pipeline/icons/vectorcraft/<stem>/`; the card names its `stem`, so `src/icons/vc.ts`
  can take its `DRAWN` set from the cards instead of the list `make.py` rewrites. The canvas icons move to `icons.ts`, loaded
  only where an SVG is missing. The alternative, the SVGs inside the folder (`src/heroes/phoenix/icons/q.svg`, found with
  `import.meta.glob('./*/icons/*.svg', { query: '?url' })` and hashed by the build), puts the whole hero in one place but moves
  164 files and the icon tool's output path: worth it only if the user wants the icons in the folder too.

### The start of the page

Measured on today's code (`npm run build`, 2026-11-16): `game-*.js` 2,503 KB and `runtime-*.js` 5,043 KB, 7,546 KB of script
(2,090 KB compressed) before the first picture; nothing hero-related is lazy (only the lore, the codex and the phone recorder are).
What that script is made of (a build of the game page alone, each module's share of the start):

| Part | Share |
|---|---:|
| the Climb (`src/tower/`) | 32% |
| spell effects (`src/spells/targeted/`) | 29% |
| - of which the game never needs them (126 files: 63 showcases, 60 retired hero spells, 3 tests) | 18% |
| - of which the heroes' 163 spells | 10% |
| - of which other spells the game uses (a Climb ruler's burrow, files the kept ones import) | 1% |
| three.js | 10% |
| shared effects and parts (`src/effects/`) | 9% |
| kits (mostly canvas icons) | 4% |
| arenas, Raid, motion | 9% |
| traits | 2% |

How it stays the same or shrinks, in three steps, each measured with `python pipeline/tools/perf.py load` before and after:
1. **With the first moved hero:** the game registers only the spells a card, a boss or a floor names; the showcases and the
   retired spells stay in the tool page's list (`src/effects/index.ts`). Counted by label (single or double quotes) and by
   import: none of the 126 is imported by a kit, a passive, a boss, the Climb or another kept spell. About a fifth of the start goes at once, with no lazy loading at all.
2. **Spells per fight:** each hero's `fight.ts` (spells, parts) is loaded before the fight's warm-up. Another tenth.
3. **Icons:** the canvas icons load only where an SVG is missing. A few per cent.
The traits stay in the start at first (2%), and so do the look parts the 24 passives import (part of the 9% of `src/effects/`):
the duel builds a hero's passive in `start()`, before any wait, and the menu reads its name and blurb. They can follow once the
card holds the menu's part.

**What lazy spells require (a hook in the shared engine, for step 3, one writer at a time):** the load must be awaited, not raced,
before `Duel.whenReady` builds the effects (today it races a 12 s timer, `duel.ts:2056`; a spell built after the fight starts rolls
the fight's dice and changes it); `heroMode.ts:1040` asserts a spell's targeting exists, and `castAs` silently plays nothing for an
unknown label (`runtime.ts:468`), so the targeting spec moves to the eager card. Heroes that arrive without warning: an online
opponent (loaded before its countdown), Raid partners (`whenReady` lists them already), and other players met on a Climb floor
(`tower/world/others.ts:313`): they show the pose until their spells have loaded, as a shared label does today. The tool page
and every pipeline driver on it stay eager.

## 4. The spell building blocks

### What the 163 spells are made of

Each spell's main shape (one per spell), from reading all 40 kits (the four audit files, 2026-11-16):

| Main shape | Spells | | Main shape | Spells |
|---|---:|---|---|---:|
| bolt (a straight skillshot) | 26 | | wall (cover) | 8 |
| bolt, several / piercing / banked | 9 | | ring round the caster | 6 |
| ground circle with a delay | 19 | | lasting zone | 6 |
| sure hit on the chosen enemy | 18 | | shield / self buff | 10 |
| dash | 15 | | summon / placed thing | 10 |
| leap, blink, charge, hook | 8 | | lane | 3 |
| cone | 11 | | channel, stance, mark, ring, wind wall, veil | 9 |
| | | | something else (storm aura, cheat death, homing mark, forecast, moving zone) | 5 |

Counting every shape a spell uses, not only its main one: a delayed circle 30, a placed thing (ember, dish, mirror, tree, Gerald)
27, a bolt 26, a sure hit 23, a dash 19, a summon 14, a zone 13, a recast 12, a ring 12, a cone 11, a wall 11, a self buff 10,
a lane 9, a pull 7, a mark 7, a veil 6, a shield 6.

What they do to the enemy: slow 23, knockback 21, stun 13, pull 10, damage over time 10, root 10, silence 9, vulnerable 8,
blind 6, knock-up 5, lifesteal 2, grounded 2, weaken 2, execute, sealed, charm 1 each. To the caster: haste 8, shield 7, rooted
while casting 6, untargetable 5, heal 4, armour 4, veiled 3, might 3, sealed 3.

How they would fit: **55 plain blocks, 102 blocks plus a hook, 6 stay code** (The Shove, Final Delivery, Cast On, Hat Trick,
Wick Door, Grand Lobby). The hooks are almost always the same few things: lay or spend something the passive keeps (embers,
dishes, rods, ink), read a resource or a stack, pick a target from the passive's state (which ember to fly to).

### The vocabulary

Rules only (no three.js, no dice), in `src/heroes/framework/blocks.ts`. A sketch of the types; the names are the design, the
details are settled with Anka:

```ts
type Shape =
  | { kind: 'bolt'; speed: number; range: number; radius: number; pierce?: true; bounces?: number; count?: number; spread?: number }
  | { kind: 'circle'; at: 'aim' | 'self' | 'target' | ((c: Cast) => P[]); radius: number }
  | { kind: 'cone'; range: number; angle: number }
  | { kind: 'lane'; length: number; width: number }
  | { kind: 'target' };                                   // the chosen enemy: a sure hit

interface Hit {
  damage: number; knock?: number; pull?: number; from?: 'caster' | 'centre';
  status?: [StatusKind, number]; debuff?: [BuffKind, number, number];
  ticks?: { every: number; times: number; damage: number };   // damage over time
}

interface Rules {
  windup: number;                     // seconds before the release; she is rooted until the latest impact
  shape: Shape;
  delay?: number;                     // release to impact (a circle's fuse)
  hit: Hit;
  judge?: 'live' | 'atCast';          // who is hit: where they are at the impact (default), or who was inside at the cast
  move?: { kind: 'dash' | 'blink' | 'leap'; to: 'aim' | 'end' | ((c: Cast) => P | null); seconds: number };
  zone?: { seconds: number; every: number; hit: Hit };
  self?: { shield?: [number, number]; heal?: number; buff?: [BuffKind, number, number] };
  summon?: SummonOptions; wall?: WallSpec; boltWall?: BoltWallSpec;
  on?: { release?(c: Cast): void; hit?(c: Cast, target: Enemy, at: P): void; stop?(c: Cast, at: P): void; land?(c: Cast, at: P): void; end?(c: Cast): void };
}
```

`spell({ card, rules, look })` makes the `EffectModule` the engine knows today: the block runner calls `ctx.projectile`,
`ctx.hit`, `ctx.moveCaster`, `ctx.summon` ... at the moments the rules say, builds the **danger zones from the same shape and
times** (today each spell writes its own `telegraphs`), builds walls, rings and lanes from `sentFrom` and `point` so both
screens agree, and gives the look a small set of moments:
`cast`, `frame(t)`, `released`, `flying(pos, dir)`, `hit(at)`, `stopped(at)`, `landed(at)`. The card's blurb is written as a
function of the numbers, so a tooltip can no longer disagree with the hit.

**What stays code:** the passives (their state, resources, boards and relays are each hero's own idea); the six spells above; the
CPU's `aiHold` choices; the engine pieces in `src/mech`; anything a hero does on the other screen through `show`, `noteOwner`
and `stacks`. A code spell lives in the same folder and plugs in as an `EffectModule`, as every spell does today.

### Three spells, today and in the new form

**Cobra Spit** (Sefu, Q: a bolt). Today 223 lines; the rules are spread over them: constants at the top (`WIND_T`, `REACH`,
`SPEED`, `RADIUS`), a `fired` flag, the `ctx.projectile` call at line 161, a `telegraphs()` that rebuilds the same line, and a
`settings` object for the tool page; the blurb in `src/kits/sand.ts` repeats 9 m, 62 and 1.2 s by hand.

```ts
// today, src/spells/targeted/cobraSpit.ts (rules lines only)
const WIND_T = 0.25, REACH = 9, SPEED = 20, RADIUS = 0.35;
if (!this.fired && t >= WIND_T) {
  this.fired = true;
  this.bolt = ctx.projectile({ from: this.from.clone(), dir: this.fwd.clone(), speed: SPEED, range: REACH, radius: RADIUS,
    hit: { damage: this.settings.damage, knock: 1, color: SAND_CSS.body, status: { kind: 'blind', seconds: this.settings.blind } } });
  this.bolt.onHit((target, at) => this.onHit(target.group.position, at));
}
telegraphs(effect) { /* the same line again, from sentFrom, start 0.02, impact WIND_T, until flightEnd */ }
```
```ts
// new, src/heroes/sand/spells/cobraSpit.ts
export default spell({
  card: { key: 'Q', label: 'cobra spit', name: 'Cobra Spit', range: 9, cooldown: 5, aim: 'line',
    blurb: (r) => `A cobra rears and spits venom ${r.shape.range} m down the aim: ${r.hit.damage} damage and blinded ` +
      `${r.hit.status[1]} s on the first enemy it touches. Half the cooldown back when it hits a Judged enemy. Step off the line to dodge it.` },
  rules: { windup: 0.25, shape: { kind: 'bolt', speed: 20, range: 9, radius: 0.35 }, hit: { damage: 62, knock: 1, status: ['blind', 1.2] } },
  look: CobraLook,   // the hood, the venom, the splash: today's drawing code, moved as it is
});
```

**Helium Bomb** (Professor Puff, W: a delayed circle). Today 232 lines: the pop at `BOMB_DELAY` loops `ctx.enemies()` on live
positions and hits within `BOMB_RADIUS` with a push of 5 from the centre (`heliumBomb.ts:193-196`), and `telegraphs()` draws
the circle with impact 1.0. The 3 Air comes from the passive's `dealt`, unchanged.

```ts
rules: { windup: 0, shape: { kind: 'circle', at: 'aim', radius: 2.5 }, delay: 1.0, hit: { damage: 50, knock: 5, from: 'centre' } },
```

**The Shove** (Bram, W: stays code). Gerald, a placed pillar with HP, slides along the aim; his obstacle is taken out and stood
again at the end, whoever he touches is carried along and stunned against a wall. That is obstacle surgery in mid-flight, no
block says it, and it moves into `src/heroes/mason/spells/theShove.ts` as the class it is (347 lines), with its card in `hero.ts`.

## 5. What must keep working

- **Ids.** A hero's id is its display name (passive, body, model, motion style, icon stem, the server's shop and the accounts'
  owned heroes). A spell's id is its label, one effect per label (which is why there are no mirror matches). Duels, raids and
  watchers send the **slot** (so the order of `spells` is protocol), the open world sends the **label**. Changing either bumps
  `PROTOCOL`. Four labels share their text with unrelated things (`'icicle'` an attack look, `'flood'` a boss move, `'pounce'` a
  pack move, `'snare'` a prop): the registry stays per kind.
- **Aim kinds and the flags change the rules, not only the AI:** `aim: 'line'|'arc'`, `bank`, `overCover`, `passesOwnWalls`
  decide whether a cast's zones are cut at cover (`runtime.ts:480` `BOLT_LINES`), and those zones are the hit and dodge check
  (`duel.ts:3214`, `3510`); `bank`, `aim`, `range` and slot 3 decide wall damage (`duel.ts:3455-3479`); `dash`, `summon`, `range`,
  `cc`, `aim` pick the cast pose (`heroFigure.ts:28-37`); the Raid's upgrades and the Climb's boons read `aim`, `overCover`,
  `bank`, `cc`. The CPU reads `cc`, `dash`, `escape`, `anytime`, `save`, `parry`, `barrier`, `summon`, `range`, `melee`
  (`duel.ts:2651-2699`, autopilot `2787-2880`). `HeroSpell.buff` is given by the duel at the cast, `debuff` is the cast's default.
- **The order inside one cast** (`heroMode.ts:1105-1124`): the passive's rules (`canCast`, `castMods`, ammo, recast clock,
  `afterCast`, cooldown) run before the effect builds its context; `afterCast` may start a dash the effect sees; one `play()`
  raises `arena.castSeq` by exactly one (the duel maps hits to casts by it, `duel.ts:1820`).
- **The passive's hooks:** `dealt`, `taken`, `landed` (in `resolve`, `duel.ts:1909-1953`), `victimTick` (on the screen that
  decides the victim), `enemyCast`, `aiHold`, `aiGoal`, `enemyGoal`, `castOrigin`, `ring`, `marks`, `meter`, `ownLook`,
  `ownChanged`, `peerNote`, `figureVeil`, `figureHidden`, `enemyScale`, `enemyLabel`, `hold`, `charges`, `recast`; `mechFor(ctx.caster)`
  and `t.mech` for the engine pieces.
- **Online:** what a spell must do today and the runner will do for it: build walls, rings and bolt walls from `sentFrom` and
  `point`; judge a catch on the target's live position; keep shared state in a WeakMap keyed by the caster; call
  `shieldSelf`, `healSelf`, `moveCaster` (undefined on the replaying screen), `summon`, `carry`, `confine`, `boltWall`
  (undefined for Raid partners and open-world players) only when present. Names sent by `show`/`noteOwner` stay 15 characters
  or less, stacks 16, values whole 0..999 (`hub.mjs:623`).
- **The Rust port:** `pipeline/rustfull/export.js` reads each spell's `create().settings` as plain numbers, and the Rust code
  asks for them by key (`spell.num("damage")`) and stops if one is missing: a block spell keeps a `settings` object with the same
  keys. `guard.py` finds a ported hero's files by path (`src/kits/`, `src/traits/<theme>.ts`, the first `label:` in
  `src/spells/targeted/`) and stops unless it finds six: it must read the hero's folder, and the block runner's files join its
  `CORE` list. Seven heroes are ported (Brannoc, Isolde, Kaia, Auriel, Sirix, Mr. Ledger, Barry Cloudsley).
- **The tool page** lists effects by `label` and `category` (`hero: <theme>`), reads `create`, `bloom`, `frameCamera`,
  `buildGui`, `telegraphs`, `targeting`, and drives `vfx.selfTest(label)` and `vfx.step` for every pipeline tool.

## 6. Risks

1. **A print can change when nothing that matters changed.** The fight's dice also give three.js its object ids (four rolls an
   object) and the look its sparks. A moved spell that builds one more object or rolls one more spark mid-fight is "another fight"
   with every rule the same. **The rule for step 3:** the block runner makes no objects and rolls no dice; a spell's look keeps its
   code and its order of rolls; effects are still built in the warm-up, in the same label order. When a print does differ, find
   the first frame where the two runs part with the trace option (`--set "{\"trace\": ...}"`, docs/pipeline/performance.md) before
   believing either.
2. **Something that arrives mid-fight changes the fight.** Seen while taking the prints: in a duel that drew a new opponent each
   round (Isolde against herself is refused, so the duel drew one by lot), two runs of the same code parted at 41.5 s, in a later
   round. Most likely the new opponent's model (or its spells, built at their first cast) came in at a moment real time chose; not
   traced further. The prints avoid it (both heroes and all their spells are ready before the fight); lazy spells must do the same.
3. **Lazy loading** (section 3): the 12 s race in `whenReady`, the asserted targeting in `heroMode.ts:1040`, the silent empty
   `castAs`, open-world players. The safe order is the one in section 3: showcases out first, spells per fight second.
4. **The shared engine files** (`heroMode.ts`, `duel.ts`, `arena.ts`, `main.ts`) need small changes for lazy spells and for the
   two things they import from heroes (`isOwnWall` from Mum's passive, `heroMode.ts:14`; the dead `ward()` keys, `duel.ts:2780`):
   one writer at a time.
5. **Heroes lean on each other.** `shapeMove` lives in Marin's passive and is used by Opaline, Sirix and Vitriol; Wick uses
   Silvane's `Gleam`; Bo's and Pim and Pom's parts re-export Mabel's; spells import other spells (`noCasting` <- `noRunning`,
   `magRail` <- `cogTurret`, `echoBrushstroke` <- `brushstroke`). These move to `framework/` or stay with one owner and are
   imported from there.
6. **Tools that find heroes by path go quiet instead of failing:** `lore-page.py` (name clashes), `sim-cells.py`, `kits20.py`
   glob `src/kits/`; `anka-shots.js` and `hero-gate5/raid-cases.js` import `traits/phoenix.ts`. Each moved hero updates them.
7. **What the prints cannot prove:** hooks no hero uses today (`castOrigin`, `enemyAvoid`, `aiHoldAttack`, `barCuts`, arc aim,
   `barrier`, the spell `debuff` field, the `src/mech` pieces), online play, the Raid and the Climb. These keep their code paths
   untouched, and online is checked with two tabs per batch (the brief's condition).

## 7. The fight prints

`python pipeline/tools/hero-prints.py take|check|show [Name,...] [--foe Brannoc]` (step 2, done 2026-11-16). Each hero plays a
fixed duel: the autopilot at its keys against a fixed foe in the Harbour, both at the CPU's balance level, the arena's hazards on,
dice 7, the performance tool's own clock (`pipeline/tools/perf-page.js`, scene `hero`), 3,600 frames (60 s: two or three rounds).
Every half second the print notes both heroes' health, places, cooldowns, units, and how many times each side has cast each slot.
The scene refuses to run if the foe is not the one asked for or a spell was not built before the fight. Two sets:

- **Against Isolde** (`docs/perf/data/hero-prints.json`; Isolde herself fights Brannoc), who keeps her distance. **All 40 repeat.**
  Each hero was run six times: twice before the icon merge, twice after it, twice more once the cast counts were added to the
  print. Every run of a hero played the same fight (the merge, icons only, changed no fight).
- **Against Brannoc** (`hero-prints-brannoc.json`; Brannoc himself fights Isolde), who closes in: the dashes, escapes and self
  spells the CPU casts only up close. **All 40 repeat** (each run twice).
- **Coverage.** A print proves only the spells cast in it. The heroes cast 1,177 spells in the Isolde set and 1,272 in the Brannoc set. Slots never
  cast in either fight, so not proven by the prints: **Sefu E (Scarab Stride), Tempo E (Time Skip), Mr. Ledger E and R (Call It In,
  Foreclosure), Pip R (Final Delivery)**. Against Isolde alone ten slots were missing; the Brannoc set covers Vesper W, Sirix W,
  Silvane R, Bram E, Zambini E (and Nyx's E, which only the Isolde set casts). The five left are what the CPU keeps for moments these
  duels never reach: check them by hand when their hero moves (cast them in the tool page's fight, or a scripted cast). Pim and Pom's
  counts add both halves per slot, so a print does not say which half cast.
- About 25 s a hero with five browsers at once: one set of 40, twice each, in about 10 minutes; `check` on one hero in under a
  minute. The page shows every print: [hero-framework/index.html](hero-framework/index.html).
- After a move: `hero-prints.py check` and `check --foe Brannoc` for every hero (a shared file may have moved), `sim.py hero <Name>`
  inside its noise, `pipeline/rustfull/guard.py` no worse than today (it already lists 15 changes, section 8), and two tabs online.

## 8. Found broken (for the user; nothing was fixed)

Checked by me in the code (file and line), unless marked *by reading*: then an auditor traced it and nobody played it.

**Rules and numbers**
- Madame Cleaver's table also heals the enemy 50 when they eat at it (`traits/chef.ts:329` `healEnemy(TABLE_HEAL)`); the blurb says
  "for her 50 HP", and a comment at `traits/chef.ts:179` says the enemy is never healed.
- Gus's Flood bonus does nothing: `FLOOD_MOP` 60 equals `MOP_DAMAGE` 60 (`traits/janitor.ts:6,53,186`).
- Late Fee, Foreclosure and Lightning Risk hit only those inside the circle at the cast (`lateFee.ts:172`, `foreclosure.ts:182`,
  `lightningRisk.ts:159` loop `ctx.targets`): someone who walks in during the fuse is not hit. Mr. Ledger and Barry are ported to
  Rust: the port should be checked for the same.
- The CPU's rule that holds spells during Isolde's ice block and Oblivion's maw never fires: no passive writes `iceUntil`,
  `mawCast` or `mawUntil` any more (`duel.ts:2780-2784`).
- Kit flags that do not match what the spell does (they may be meant: the user decides): Ember Flight has no `dash` (it has its
  own `aiHold` and ember pick; the flag would hand it to the CPU's gap-closer rule), World Tree and Sinkhole (they root) no `cc`,
  Shadow Double (it summons) no `summon`, Stampede no `aim: 'line'`; Chain Hammer and Shepherd's Crook have `cc` but only pull and
  slow. Each changes what the CPU does, so none is touched by the move.
- Rules timed on the wall clock (`performance.now()`) instead of the round's clock, *by reading*: the recasts of Crosswind,
  Barbed Stinger and Oblivion's Collapse, Tempo's Stolen Hour and Slow Time, Big Yoko's ring, and the objects of Gus, Mabel,
  Grandma Ironknit, Wick and Pip's Final Delivery. 30 spell files and 22 passives read it, some only for their look.

**Online** (*by reading*)
- Fenna's Uproot may be recast up to 9.2 s after World Tree (`traits/grove.ts:214`), but the server lets a second R through only
  within 4 s (`server/hub.mjs:39`): a late Uproot never reaches the other screen. Hank's Timber sits on the 4 s edge.
- Pim and Pom's Tag Out has an 8 s cooldown; the server allows one R in 10 s: a second Tag Out in that gap plays no effect there.
- The server refuses a hit tied to a cast older than 12 s, while the victim's screen has already taken the HP off: long-lived
  units and passives' hits drift the two HP counts until the next `hp` message.
- A CPU's or the other player's repeat cast of a spell still playing restarts the first (`runtime.ts:467-477`); one's own gets a
  copy. Matters for the heroes with charges.
- Starfall Arrow always flies 14 m and pierces on the victim's screen; Meteor Mark always strikes for the flat 120 online.
- Firebird's hit can run about 1.2 m past where a wall stops her while the danger zone shows the full 12 m.
- Bram's Gerald has no message when he breaks; he may stay standing on the other screen.

**Docs and tidiness**
- About 80 spell head comments give old numbers (Fan the Flames "60", code and blurb 54; Sky Strike "50", code 60; The Shove
  "60", code 70; Invoice "50", code 72 ...). The kit blurbs match the code except the table heal above and two, *by reading*:
  Nyx's Smoke Veil says she fades "even mid-fight" (the code waits 1.5 s), Kaia's Supercell says every 0.8 s for 6 s (its
  checks stop at 4.8 s).
- `src/effects/targeting.ts` says network duels have no bolts or summons and ignore pull, status and shields; the code does all of
  these now. `rust-sim.md` says six heroes are ported; there are seven. `heroes.ts:197` says no body is under 2.33 m; five are.
- Two modules are both exported as `blackHoleModule` (`effects/blackHole.ts:463`, `spells/targeted/blackHole.ts:418`).
- `pipeline/rustfull/guard.py` already fails today (15 changes since its last stamp).
- 126 spell files the game never uses ship in its start (section 3).
- Ember Quill's "no bolt on this screen" branch (`emberQuill.ts`, the `nominalStop` path) never runs in the game: every cast
  context has `ctx.projectile`, online too (`arena.ts:401`, `922`); a bolt flies on both screens and her passive moves the ember to
  where the deciding screen says (`noteOwner('lay')`). Its header comment, and the same claim in `targeting.ts`, are out of date.
- The audit files with every finding (177 entries, most of them stale comments) are kept with this design's working notes in
  the session; the list above is what matters for play.

## 9. Anka's move, file by file (the plan; done, section 10)

| Today | Becomes | Note |
|---|---|---|
| `src/kits/phoenix.ts` (650) | `src/heroes/phoenix/hero.ts` (~90: the card, the four spell cards with blurbs from the numbers) and `icons.ts` (~550, moved as is) | `order: 39`, `model: 'models/heroes/phoenix_v4.glb'`, `body: { radius: 0.4, height: 2.4 }`, `shop: { kind: 'caster', shelf: 3 }`, `icons: 'anka'` |
| top of `src/traits/phoenix.ts` (the 30 numbers) | `numbers.ts` | read by the card, the spells, the passive and the Rust export |
| `src/traits/phoenix.ts` (the rest) | `trait.ts` | the ember book and its hooks as they are |
| `emberQuill.ts` (363) | `spells/emberQuill.ts` | bolt (22 m/s, 10 m, r 0.3, wind-up 0.3), hit 54 and knock 1; `on.stop` lays the ember (`layEmber`) where the quill stops (the hit, a wall or its full reach); the passive's `lay` note keeps both screens' ember in one place, as today. The dead no-bolt branch is not carried over (or kept as is, if the print says it matters) |
| `fanTheFlames.ts` (307) | `spells/fanTheFlames.ts` | circles at her embers (`at: (c) => embers`, r 2.2), delay 0.8, one hit of 54 however many rings, live positions; `on.end` burns the embers out (`burnOut`) |
| `emberFlight.ts` (288) | `spells/emberFlight.ts` | `move: dash` to the chosen ember (a hook: the CPU's pick or the one nearest the aim), 0.25 + 0.45 s; circle r 1.8 at the landing, hit 40; `on.land` spends the ember. Gains the missing `dash` flag only if the user says so (it changes the CPU) |
| `firebird.ts` (341) | `spells/firebird.ts` | wind-up 1.0 (rooted), lane 12 x 3, `move: dash` along it in 0.5 s, hit 120 as the bird's front passes; `on.release` lays the take-off ember |
| `src/effects/parts/phoenix.ts` (833) | `parts.ts` | moved as is |
| 3 lines in `src/heroes.ts`, 1 in `src/traits/index.ts`, 8 in `src/spells/targeted/index.ts` | gone (found by the glob) | the facades re-export |
| `src/icons/vc.ts` `DRAWN` entry | the card's `icons` | `public/icons/spells/anka-*.svg` stay |
| `server/protocol.mjs` row | stays | checked against the card |
| `pipeline/tools/anka-shots.js`, `hero-gate5/raid-cases.js` | import `src/heroes/phoenix/trait.ts` | |
| `pipeline/tools/lore-page.py`, `sim-cells.py`, `kits20.py` | read the cards | |

Checks for her move: `hero-prints.py check` (all 40, since the shared runner is new), `sim.py hero Anka` inside the noise of her
last result, `guard.py` no worse, two tabs online (Anka against another moved hero), `npx tsc --noEmit -p .`, `npm run build` and
`perf.py load` (the start must not grow). What to show the user: the folder, her kit before and after, the lines, the checks.

## 10. Step 3 done: Anka moved (2026-11-16)

The page for the user: [hero-framework/anka.html](hero-framework/anka.html). Six commits, each checked with her two prints, so a
changed print could be found by halves: the files moved as they were (3a), the game's own list of spells (3b), then her spells
onto the blocks one at a time (3c Ember Quill with the blocks and their runner, 3d Fan the Flames, 3e Ember Flight, 3f Firebird).

**What is where now**
- `src/heroes/phoenix/`: `hero.ts` (her card: order 39, kit, model, body, shop row, icon stem, pointers; tooltips written from the
  numbers), `numbers.ts`, `trait.ts`, `parts.ts`, `icons.ts` (the canvas icons and portrait, exported as `portrait`, `icons.Q`...),
  `spells/*.ts`, `fight.ts` (`spells`).
- `src/heroes/framework/`: `card.ts` (the `HeroCard` type), `blocks.ts` (the vocabulary), `spell.ts` (the runner `Cast` and `spell()`).
- `src/heroes/index.ts` (the cards: `HERO_CARDS`, `CARD_BY_FOLDER`; in dev it checks each card's shop row against the server's
  `HERO_SHOP`), `src/heroes/traits.ts` (`FOLDER_TRAITS`), `src/heroes/spells.ts` (`FOLDER_SPELLS`). Kept apart so that a tool which
  imports `src/heroes.ts` for the roster does not pull in every spell; `./heroes` from `src/` still resolves to the file `heroes.ts`,
  so the folder is imported as `./heroes/index`.
- Facades: `src/heroes.ts` puts each card's kit at its `order` and fills the other places with the listed kits in their order (two
  cards wanting one place stop the page); `HERO_BODIES` takes the cards' bodies; `useVcIcons` takes the cards' icon stems (Anka left
  the `DRAWN` list; `make.py` no longer writes a stem a card names). `src/traits/index.ts` adds `FOLDER_TRAITS` at the end of
  `TRAITS` (nothing iterates it). `src/spells/targeted/index.ts` is the tool page's list: its own 141, then the game's.
- `src/spells/targeted/game.ts`: what the game registers (`src/game/main.ts`), the 160 spells of the heroes not moved yet and the
  Climb ruler's `burrow`, then `FOLDER_SPELLS`. The 141 left out: 129 that no kit, passive, boss, floor or kept spell names or
  imports (by label in single, double or back quotes, and by import path; checked inside the kept spell files too: none), and the
  12 test spells of `src/kits/test.ts`, which only the tool page imports. The design counted 126; the difference is the tests and
  how they were counted, not a spell the game uses: the page's roster snapshot (below) finds every label the 40 kits name.
- Tools that found her by path read the folder: `anka-shots.js` and the four `hero-gate5/*.js` import `src/heroes/phoenix/trait.ts`
  (a second module instance would have its own empty embers); `sim-cells.py`, `kits20.py`, `lore-page.py` also glob
  `src/heroes/*/hero.ts`. `hero-gate5/srv.py` takes `GATE5_PORT` (its 5193 was another agent's).

**The blocks as built** (only what Anka needs; the next heroes add theirs): a `bolt` (released at `windup` along the aim; stops in
an enemy, at a wall or at its reach, a step short), `circle` (centres given at the cast, a fuse `delay`, `still` to put some out at
the impact, every enemy inside one that still burns hit once from the first it stands in, on live positions), `lane` (swept by a
front from the release over the move's `seconds`, `front` to change it, `late` seconds of grace), and a `move` of the caster at
`play` or at the `release`. Hooks: `on.cast`, `on.release`, `on.stop`, `on.impact`. A hit is `{ damage, knock, color }`; the damage is
the spell's `settings.damage` (the tool page's slider and the Rust export's key, as before). The danger zones come from the shape:
`warn` (default 0.04 s) to the impact, a bolt's until its reach is flown, a lane's until the move ends.

**The runner's order inside one frame** is each old file's, so no dice move: the look's `tick` (particles age), the clock, the end,
the release (rules, then the look's `released`), a bolt's stop, the look's `frame`, circles' impact (hits, `on.impact`, the look's
`impact`), a lane's sweep (the look's `struck` per hit), then the look's `after`. The runner makes no three.js object: the effect's
group first, then the look makes its objects in the old field order. Shake and the screen effect belong to the look.

**Things found on the way** (none changes play):
- Fan the Flames' rings must be copies of the embers' places at the cast (an ember the other screen's `lay` note moves later did
  not move the old ring), while Ember Flight hits where its ember lies when she lands (the live record). The runner keeps both.
- Ember Flight takes no cast number (`castNo`); a runner that numbered every cast would have shifted her ember ids on both screens.
- Ember Quill's no-bolt branch never ran (every cast context has a bolt, the Climb's other players too) and is gone.
- The shared engine files: `src/game/main.ts` changed two lines (it registers `gameModules`); `duel.ts`, `arena.ts`, `heroMode.ts`
  and `runtime.ts` are untouched.
- For the next heroes: `guard.py` still finds a ported hero under `src/kits`, `src/traits` and `src/spells/targeted` (and the runner
  is not in its `CORE` yet): teach it the folders before Brannoc, Isolde, Kaia, Auriel, Sirix, Mr. Ledger or Barry move. The icon
  stems from the cards are keyed by hero name, so Pim and Pom (two stems, `pim` and `pom`) need the card to name both.
- `src/runtime.ts:72` still says the game registers `targetedModules`: left, because `runtime.ts` is in the Rust guard's core list.

**The checks** (all on 2026-11-16, the frozen code before the move in a scratch worktree at 4da4503d):
- Fight prints: Anka's two the same after each of the six commits; all 40 heroes against both foes the same after 3b and again on
  the finished code (80 of 80). Her prints cast every spell (Isolde set Q 16, W 5, E 5, R 2; Brannoc set 16, 5, 3, 3); her rise is not
  in them, and its code did not change.
- The roster as the game page sees it (taken again on the finished code) (a script that reads `HERO_KITS` field by field, `HERO_BODIES`, `TRAITS`, every spell's
  targeting, bloom and settings): identical to the old code; every label a kit names is in the game's list.
- The tool page's self test of her four spells (shake, zones, durations, impact times, no errors): identical before and after.
- `sim.py hero Anka --fights 32`: 52.1% ±7.1 (the old code the same day: 49.5% ±7.1; her last result, 2026-11-11: 54.2% ±10).
- `guard.py`: the same 18 lines before and after (10 engine files, Brannoc's four, Kaia's, Sirix's, Mr. Ledger's and Barry's kits);
  none of Anka's (she is not ported).
- Perf prints (desktop): the 12 scenes of `prints.json` (menu, two duels, two raids, the Tower, six Climb floors) play the same fights as the old code
  measured the same day (`fw-before-*.json` against `fw-after-*.json` in `docs/perf/data/`). `world-5` played another fight once while
  the 40-hero prints ran beside it; run again alone it was the same on both codes (636b681b, twice on the old). The saved baseline
  `prints.json` is already out of date for `world-1` and `world-5` on the old code too (later Climb work): compare with a fresh run.
- Online: `hero-gate5/online.py` (two headless screens, bots through the dev server's real hub, Anka against Kaia, `GATE5_PORT=5194`), twice.
  All spells: no errors, the same embers in 99% of 492 paired moments, ember places at most 0.3 m apart, her rise at the same spot on
  both. Kaia keeping away and sidestepping: 98.1% of 421, the nest more than 1 m apart in 2 moments (before the `lay` note arrives),
  both rises at the same spots. Gate 5 measured 99% on the old code. The bots' accounts were removed.
- The game's first download (`npm run build`, `game` and `runtime` chunks): 7,576 KB -> 6,065 KB (2,098 KB -> 1,645 KB compressed), a fifth less. The tool page's own chunk grew
  (509 KB -> 2,017 KB): the 141 spells moved there.
- `npx tsc --noEmit -p .`, `npm run build`: pass. `npm run test:server`: 364 checks pass, first run.

## 11. Step 4a done: the other 39 moved into folders, their spells not yet on the blocks (2026-11-16)

The page for the user: [hero-framework/progress.html](hero-framework/progress.html) (per batch the heroes, their lines before
and after, the checks, the start size). Five batches, each its own commit after all its checks: 1 Vesper, Lyra, Vitriol, Sefu,
Nyx, Fenna, Marin, Zephyr (77347871); 2 Mortis, Ada, Opaline, Cantor, Oblivion, Shiori, Tempo, Silvane (ff959f7e); 3 Bram, Hank,
Professor Puff, Sir Whiskers, Big Yoko, Mum, Referee Whistler, Madame Cleaver (d2fdd7db); 4 Pip, Gus, Mabel, Grandma Ironknit, Bo,
the Great Zambini, Wick, Pim and Pom (a1fc8891); 5 the Rust-ported Brannoc, Isolde, Kaia, Auriel, Sirix, Mr. Ledger, Barry
Cloudsley (adb0510d), after the guard learned the folders (b53ca76c).

**What a move is** (Anka's 3a, by a script, in the session's notes): the kit becomes the card `hero.ts` (order, the kit literal as
it was, model, body, shop row, icon stem) and `icons.ts` (the rest of the kit file, its drawings now `portrait` and `icons.Q` ...);
the passive moves to `trait.ts` (plus a default export), the look parts to `parts.ts`, the four spells to `spells/` unchanged but
for their imports; `fight.ts` lists the spells. Every relative import of a moved file in `src/` and `pipeline/` was rewritten (the
tool page's showcases and the Climb ruler's burrow use heroes' parts and passives; `src/effects/parts/index.ts` re-exports
Vesper's blood kit; Sirix's Swarm Surge uses Marin's `shapeMove`; `heroMode.ts` imports Mum's `isOwnWall`, one line).
- **Nothing names a hero by hand any more:** `src/heroes.ts` builds `HERO_KITS`, `HERO_BODIES` and the models from the cards (two
  cards on one place or a gap stop the page), `src/traits/index.ts` is `FOLDER_TRAITS`, the game's spell list is the Climb ruler's
  `burrow` and `FOLDER_SPELLS`, and the icon list `DRAWN` in `src/icons/vc.ts` is empty (every card names its stem).
- **Pim and Pom:** their card was written by hand: Pim's kit with Pom's as `alt` and the one Tag Out they share (one object, so the
  icon hook wraps it once). A card may name two icon stems, one a half (`icons: ['pim', 'pom']`; `HeroCard`, `useVcIcons`, `make.py`).
- **The pointers** (lore entry, model build, design) are no longer on the card but beside it (`export const pointers`): the game
  imports only the card, so the build leaves the text out (it was 6 KB of the start). Anka's card too.
- **Spells on the blocks: none besides Anka's four.** The move kept every spell file as it was; the blocks conversion of the other
  155 spells is still to do, a spell at a time with its hero's two prints (the dice order of each look must be kept: the runner
  releases before the look's frame, where several old spells did their look first; bolts need status, pull and `from` in `Hit`).
  The Rust-ported heroes' spells should stay as they are until the port is graded again (`export.js` reads their `settings` keys).

**The checks, per batch** (now `sh pipeline/tools/hero-checks.sh <ref> <out>`): `npx tsc`; the roster as the game page sees it
(`python pipeline/tools/hero-roster.py take` and `diff`: every kit field by field, tooltips letter for letter, models, bodies,
passives' fields, a pixel hash of every canvas icon and portrait, the SVGs each hero asks for, every registered spell's targeting,
bloom, settings and length) identical to the code before step 4; the tool page's self test of the never-cast spells (Sefu E, Tempo
E, Mr. Ledger E and R, Pip R: `hero-roster.py selftest`) identical; all 80 fight prints the same (`hero-prints.py check` and
`check --foe Brannoc`); the Rust guard; `npm run build`. Every batch passed every check (batch 3's Brannoc set was run again: its
first page load timed out before any fight). The main branch was merged three times on the way (before batches 4 and 5 and at the
end); before batch 5 its merge was checked alone (80 of 80).

**After the last batch:**
- The simulator, mine against the main branch without my moves, 32 fights a foe, through `heavy.py`: Sefu 44.3% against 47.4%,
  Mum 41.7% against 39.6%, Kaia 33.1% against 33.1% (each about ±7).
- The Rust guard (`guard.py`, taught the folders and `--moved`): the 18 lines of the morning, plus `src/effects/projectile.ts` from
  the merged shot heights (another job's change; 19). The 42 moved files of the ported heroes and Swarm Surge's import are in
  `pipeline/rustfull/data/moved.json` (and the seven cards again after the pointers left them: only that changed); `--stamp` empties it when the port is graded again. The Rust files' comments still name the
  old paths.
- Online (`pipeline/tools/hero-gate5/online_pair.py Sefu Mum`, two headless screens through the dev server's hub): no errors, three
  rounds; Sefu's HP the same on both screens in 96% of 612 paired moments (the main branch: 99.5% of 444), Mum's in 94% (94%), both
  heroes' places 0 m apart at the median. Sefu cast Scarab Stride (never cast in the prints) six times. The bots' accounts removed.
- Perf prints (desktop, the 12 scenes): the same fights as the main branch without my moves (`hm-after.json`, `hm-base.json`); world-1
  played another fight once on the main branch's run and the same one when both ran again alone (twice each). Against the morning's
  before-runs (`hm-before*.json`) only world-5 moved: the merged Climb work changed floor 41.
- The game's first download (`game` and `runtime`): the main branch alone 6,117 KB (1,664 KB packed); with the 39 moved 6,123 KB
  (1,671 KB), the cards and their files, 0.1% (12 KB before the pointers left the cards).
- `SMOKE_SLOW=2 npm run test:server`: 364 checks pass.
- The built game (`vite preview` of `dist`, `/game.html`): 40 heroes in the roster's order, every spell label, no page or console
  error. The fight prints cannot run there (the scene imports source modules); all other checks ran on the dev server.
- The tools that find heroes by path see all 40: `sim-cells.py` (max HP), `kits20.py` (names taken), `lore-page.py` (names in the
  game), `make.py` (41 icon stems named by the cards, none listed by hand). The icon drawings' `draw/*.py` name `src/kits/` only in
  their head comments. The online check was one run each (mine and the main branch's).
- **For other branches:** a kit edited on a branch made before these moves now conflicts (its file was split into `hero.ts` and
  `icons.ts` and moved): redo the edit in the hero's folder.

**Found on the way** (nothing changed; for the list in section 8):
- `src/effects/parts/index.ts` (the shared parts kit) re-exports Vesper's blood parts, so the shared kit now imports a hero folder.
- `src/icons/vc.ts` keeps `heroStem` and the empty `DRAWN` for heroes without a card; there are none now.
- `pipeline/tools/kits20.py` still writes `src/kits/` and `src/traits/` paths into the designs it makes (step 5's command replaces it).


## 12. The blocks trial: three more heroes' spells, to learn the cost (2026-11-16)

The page for the user: [hero-framework/blocks-trial.html](hero-framework/blocks-trial.html). Before deciding on the other ~150
spells, the twelve spells of three heroes chosen for simple shapes and not ported to Rust (Sefu, Professor Puff, Big Yoko) were
tried, one commit per step, each with its hero's two prints (and Anka's after every change to the runner).

**Moved (8):** Cobra Spit (a bolt with a blind), Shepherd's Crook (a sure hit: pull, slow), Helium Bomb (a circle at the aim), the
plain ones; Sarcophagus (a sure hit that must still find them inside 1.6 m; the burst a frame after the seal is a hook, `on.frame`),
Hot Air (a zone round him, a push, then a move away from the aim at the impact; "away" is an `on.cast` hook), Stomp, Salt Throw,
Palm Strike (zones judged once: a circle round him, a cone and a strip the way he faces; his ring and the shove are hooks).
**Stayed code (4):** Scarab Stride (a bite judged on the stretch of the eased dash run this frame, nearest only, poison ticks: the
lane judges differently), Air Hose (a muzzle 0.8 m ahead, aimed at the point, ends when its bubbles clear, its own drawn bolt
without `projectile`, no loop switch), Pop! (fizzles without sight or beyond 11 m, knocks from his live spot, its circle follows
the enemy: three options to the sure hit), Sumo Charge (catch and carry: a block worth building with Pim's Charge and The Shove).

**The blocks gained** (`blocks.ts`, `spell.ts`; 393 -> 556 lines): the `target` shape (a sure hit, `inside`), the `zone` shape (any
`TelegraphShape`, judged once with the engine's `insideTelegraph`, so the danger zone is the hit's shape; `until`); `tune` sliders
and `Num` (a number of the rules may name a slider or be worked out from them); a `Hit` with `pull`, `status`, `projectile`,
`from` and `none`; `facing`; `move.at: 'impact'` and `c.moved`; `on.frame`; `noDamage`, `noLoop`, `noScreen` (settings and the effect's fields keep their old keys: the roster checks
`'screen' in effect`); and
the look's `releasing`, `impacting` (before the rules: the old files drew first, and the dice must keep their order) and `idle`
(files that aged their particles while not playing). `c.landed` is set before `impacting`; `stopped` names whom a bolt hit.

**Counts:** the eight files 1,917 -> 1,522 lines (-21%); their rules blocks 19-47 lines each (the hooks 3-20 of that); the looks
moved as they were. Time (from the commits): 8 spells and 3 block steps written in about 40 minutes (about 5 minutes a spell; the
checks of one step ran while the next was written), the references 13 minutes, the final gate 26 minutes of machine time.
Estimate for the rest (~120 spells of 29 heroes, not ported): about 12-15 hours of agent work, a third staying code; likely slower,
since these three were picked as the simplest. **Recommendation: some shapes only** (the user's page says why): new heroes on the
blocks, a hero's fitting spells when that hero is next opened anyway, with its prints and the look check; no conversion project.

**The look check** (new, `pipeline/tools/spell-look-compare.py`): the prints see health, places and cooldowns, not particles. The
tool plays a spell on the tool page of two checkouts (two dev servers) with the same dice and 360 steps and compares a fingerprint
of everything the effect draws every frame. The eight moved spells: the same for 360 frames (Air Hose, unchanged, as a control);
a dust puff raised 1 cm on purpose was caught at frame 16. About 10 s a spell.

**The checks:** Sefu's, Puff's, Yoko's and Anka's prints the same after every commit; all 80 prints the same on the finished code;
the roster (`hero-roster.py take` / `diff`) identical; the self test of the eight moved spells and of the five never cast identical
(Scarab Stride, never cast in the prints, stayed code); the looks frame by frame the same; `tsc`, `build`; the Rust guard the
same lines.
