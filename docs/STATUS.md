# Status

_Last updated: 2026-11-04_

## Current state (2026-11-04)
Everything below is committed on `feat/particle-editor` unless marked. The 2026-11-02 and 2026-11-03 entries that
said "uncommitted" now name the commit that holds them.

**Commits since 2026-10-30, newest first**
- `45bb30f` League kit research: docs only, no code or kit change (entry below).
- `bc0f830` A Random tile first in every hero picker (entry below).
- `a0832f4` Zephyr and Marin rebalanced for the CPU's new walking (entry below).
- `e0b96b4` League walking and controls, the hover outline (entry below).
- `ae9e4cb` Arena events and real pathfinding round cover (entry below).
- `ebfaebb` Play vs CPU with five levels, Novice to Master (entry below).
- `0a0279a` The first five v4 kits: Lyra, Vex, Marin, Mortis, Zephyr ("v4 opener done" below;
  [kits-v4.md](../pipeline/designs/kits-v4.md)).
- `c17cfc2` The VFX tool and the game as two apps on one runtime (`src/runtime.ts`, `src/tool/`, `src/game/`).
- `af47bbe` Kit shapes v3, batches 1-3 (15 heroes); Sefu and Auriel models; the v4 design.
- `0ed55d1` Arena remake, breakable walls, sculpted v2 heroes, phone play.
- `c7f2039` Hero identity (traits and passives), kit identity v2, the motion pass.

- **Pushed:** GitHub `main` is at `bc0f830` (2026-11-04, `git push origin feat/particle-editor:main`). `45bb30f` is local only.
- **Live:** `bc0f830`, deployed 2026-11-04 at the user's request (`npm run cf:deploy`, worker version
  `aaf3b0e5-49f0-4e40-9dcf-722e32ef55df`), https://arena-of-kits.arenachamp.workers.dev/game. Checked on the live site: the
  page serves the new bundle (`game-XTrx3sBE.js`), the online server connects, the CPU screen shows 21 tiles with Random
  first, a fight from the real buttons drew a hero (Auriel against Zephyr), and "Leave duel" came back with Random still
  chosen. No console errors. Not checked live: Random in a real queue or lobby, two players online, login, a phone, the
  in-fight Leave button (its confirm dialog closes by itself in the test browser, so it could not be answered).
- **In progress:** the v5 remake of all 20 kits ("All kits should be remade", entry below). Design done, building next.
- **Next:** engine pieces E1-E14 in [kits-v5.md](../pipeline/designs/kits-v5.md), then the five built kits, then three batches of five.

**Kit remake v5 (2026-11-04, user: "All kits should be remade")**
- Design: [kits-v5.md](../pipeline/designs/kits-v5.md), all 20 heroes against the League checklist, with cooldowns and every counterplay
  line checked with the numbers. A second reader recomputed every line against the code; its corrections are in. It replaces kits-v4.md.
- User's decisions: Nyx loses full invisibility; Vex is renamed Vitriol (shown name only); commit after each finished batch without asking.
  Push and deploy still wait for the user. Never commit the Meshy files.
- Each hero keeps look, theme and role. Spell and passive names were checked against League's 865 ability names: no exact match.
- Build order: engine E1-E14, then the five built kits, then Vesper, Brannoc, Sefu, Cantor, Tempo; Isolde, Kaia, Fenna, Auriel, Ada; Sirix,
  Shiori, Opaline, Oblivion, Nyx. Then a full tournament, the catalog refresh and the rename.
- Balance tool: `pipeline/tools/kit-balance.js` and `pipeline/tools/duel-tourney.js`, in the VFX tool page (`vfx-dev` in launch.json).
- Done: the five built kits (Lyra, Vitriol, Marin, Zephyr, Mortis) and these engine pieces: lock cap, own state visible, trait hits,
  channel, recast arming, charm, sealed, grounded, confine ring, victim-side and enemy-cast hooks. How workers build a hero:
  [kit-build-brief.md](../pipeline/designs/kit-build-brief.md).
- Balance so far, 96 fights each against the six old-kit heroes: Vitriol 53%, Lyra 42%, Mortis 29%, Zephyr 17%, Marin 15%. Then a first raise for
  the last three, not re-measured. Those foes still run old kits, so the real tuning is a full tournament once all 20 are in. Do not chase these numbers per batch.
- Notes for later batches: `isBehind`'s default cone is the front 120° (back 240°), so Nyx's "back 120°" needs `cone = 4 * PI / 3`. A pull stops 1.0 m short, so Kaia's
  "within 1 m" must allow equal. Auriel needs a shield that a smaller one does not refresh (`shieldFigure` restarts the clock), and her `shieldMul` 1.3 goes.
- Also done on the way, at the user's request (2026-11-04): easier CPU levels (`CPU_LEVELS`; the kits now balance against a separate `CPU_BALANCE`), a tab
  icon (`public/favicon.svg`), a login background (`public/login-bg.jpg`, made with `pipeline/tools/key-art.js`), a loading page then 3-2-1 and "DUEL!" for both
  CPU and online fights (`src/game/loading.ts`), the eight `_v2` models as the default everywhere (they were behind `?figs=v2`), the Heroes tab as one table of rows, and a
  vs CPU tab when logged in. Hit boxes: a spell no longer hits outside its drawn shape (the old 1.6 m rule only applies to casts with no shape), and each hero has
  a hit size measured from its model (`HERO_BODIES`), which also fixes clicks on tall heroes' heads. Not measured yet: how the easier levels play.
- New heroes: the user asked for all of [new-heroes.md](../pipeline/designs/new-heroes.md) ("Yes make them", then "All"): 19 heroes, each with a kit, effects and a model,
  for 39 in total, after the 20 kits. First write full kits for the 16 still sketched and run their numbers. Build order: Bram and Gerald, Silvane and Hank first, then the
  rest, with the largest (Pim and Pom, Pip) late.
- Server edit waiting on the next deploy: `server/hub.mjs` allows the statuses `charm`, `sealed` and the debuff `grounded`. A deploy also brings the renamed Vitriol.

**League kit research (2026-11-04, user: "research deeply the kits from League of Legends... make docs knowledge", then
"go through all champions... make big docs"; committed `45bb30f`, not pushed)**
- [knowledge/league-kit-design.md](knowledge/league-kit-design.md): why the kits work, how ours compare, a 35-question checklist,
  a ranked list of what to do first, a verdict on each of our 20 heroes. About 12,000 words.
- [knowledge/league-champion-kits.md](knowledge/league-champion-kits.md): all 173 champions, about 55,000 words, with counts across
  the roster. Notes and tags in [knowledge/league-research/](knowledge/league-research/).
- Sources: the two Fandom pages the user named (read in a browser, since Fandom refuses automated reading, and out of date), the
  official wiki for champion pages, Riot's Data Dragon 16.22.1 for checks. About 40 of 173 entries were corrected against Riot's text,
  6 of them with swapped slots. Pages were read through a summarising tool, so small errors can remain.
- Main finding: the counterplay lines of three built kits fail on the numbers, checked in the code: Lyra's Meteor Mark, Mortis's Bone
  Fan, Marin's Moon's Pull. The doc also finds hidden state on 4 of 5 built kits, and few second decisions.
- Not changed: no code or kit design. **To decide (user):** which items of the ranked list to do, before v4 batch 2. Also League has a
  champion named Vex, the same as ours.

**Random pick in the hero grid (2026-11-04, user: "make also icon for random pick at first place"; committed `bc0f830`, pushed, deployed)**
- A Random tile comes first in every hero picker (`src/game/main.ts`), with its own icon: a gold question mark in a ring
  of one dot per hero, in each hero's colour. The CPU screen's random opponent shows the same icon.
- Play card and CPU screen: Random stays chosen and is drawn when the match or fight starts, never the chosen opponent. A
  Rematch keeps the hero drawn. Lobby: drawn at once, never a hero already in the lobby. A toast names a queue or lobby draw.
- Checked in the browser, desktop and 375 px: the real tile, 14 CPU draws (10 different heroes, never the opponent), the
  choice surviving a reload. The Play card and lobby used a fake profile with the server messages captured, not sent.

**Five v4 kits rebalanced for the new walking (2026-11-04, user: "yes do it"; committed `a0832f4`, deployed)**
- Before, 48 fights each against Brannoc, Kaia, Isolde, Sirix, Cantor and Oblivion: Zephyr 71%, Marin 23%, Mortis 48%,
  Vex 50%, Lyra 44%.
- Changes: Zephyr's Gust +25 to +20, Q 42 to 38 (recast 25). Marin's Q 60 to 68, W 55 to 62, basic attack 8 to 10.
- After, 96 fights each (`pipeline/tools/kit-balance.js`, new): Zephyr 51%, Marin 49%, Lyra 47%, Vex 53%, Mortis 54%.
- Wide single matchups remain: wins of 16 against Brannoc, Kaia, Isolde, Sirix, Cantor, Oblivion are Zephyr 2 16 15 6 8 2,
  Marin 1 14 8 8 9 7, Lyra 3 14 13 2 13 0, Vex 3 13 9 6 11 9, Mortis 10 12 3 0 16 11. Brannoc and Oblivion are strong and
  Kaia weak; all three are still on kits from before v4.
- Not rerun after this: the CPU level ladder, the other 15 heroes. Not played by a person.

**Walking and controls like League, hover outline (2026-11-04, user: "do it like league of legends", "make like outline
on enemy hero when u hover mouse over the hero", "retest it multiple times"; committed `e0b96b4`, not pushed, deployed
with `a0832f4`)**
- Sliding (`steer` in `src/obstacles.ts`) rewritten: the part of the push along the edge, never against it; pressing
  straight at cover goes round by the nearer end and keeps that side. The stick's dead zone now stops the hero (it kept
  walking the old way). The CPU no longer dances at corners (`Duel.steer`).
- Like League: hold the right button to keep walking at the cursor; a right-click counts as "on the enemy" only when the
  mouse is on its body (it used to be anything within 2.2 m on the ground); green marker for a walk, red for an attack;
  the body turns very fast instead of snapping. Left click still walks too.
- Hover: a red contour round the enemy hero (`OutlinePass` in `src/runtime.ts`, off unless shown) and a red sword cursor.
  A first try with grown mesh copies left patches inside the figures. Units get the cursor, not the contour.
- Tested: `pipeline/tools/walk-test.js`, new, seven suites over five arenas and five seeds, before-and-after table in
  [mechanics.md](architecture/mechanics.md#walking-round-cover-navts). Real right-clicks and hover in the game page;
  hold, and the touch stick at phone size, with pointer events dispatched in the page (not a finger).
- Ladder after the walking change, 50 fights per level: 0 / 26 / 46 / 68 / 76 %.
- Hero balance moved, since melee heroes now reach their targets, and was rebalanced (entry above).
- Not found: in 2 of 5 AI runs a figure stood inside cover for 22-38 frames of about 70,000. It did not come back in 30
  more fights watching for it; the seven earlier runs had 0-2 frames.
- Not checked: a real phone; two players online; a person playing it.

**Arena events and pathfinding (2026-11-04, user: "make like some effect for arenas like ray-laser" and "fix
pathfinding", then "push it and build it"; committed `ae9e4cb` and pushed; deployed with `a0832f4`)**
- Arena events: every arena has its own timed event (`src/arenas/hazards/`, table in
  [arenas.md](architecture/arenas.md#arena-events-hazards)): the temple's sweeping rays (walls and columns stop them),
  ice rifts, the lava vent and bombs, spore pods, marching lightning. First at 8 s, then every 9-13 s after the last;
  pale zones in their own colour for at least 1.2 s; 35-45 damage, at most a slow; both heroes alike.
- Online: seeded schedule from match and round, on a clock that starts at FIGHT; each client decides its own hero's
  hits and sends the new `hazard` message (server capped at 60, can KO; smoke test passes). **No two-player test yet.**
- Off in AI-vs-AI runs unless `duel.hazardsInRuns`, so `_tourney` and `_ladder` stay comparable. In 20 AI fights with
  them on: 1.1 events per fight, 8 hits (hero 3, opponent 5), no timeouts.
- Pathfinding: `src/nav.ts` plans real routes round cover for clicks, walking into range, attack chases, the CPU and
  summoned units. The stick still walks straight and slides. Same 200 clicked walks before and after: walks with 3+
  sharp turns 81 → 0; clicks on cover that end 0 of 40 → 40 of 40; path length 1.05× → 1.02× a straight line.
  Normal against Normal afterward: 52% over 64 fights, no timeouts. The Hard and Master numbers in mechanics.md were
  measured before routes: spot runs since gave Novice 0 of 12 and Master 8 of 12, not a full ladder.
- Fixed on the way: the Night Temple's see-through floor hid warning zones on its far half, spell zones too (lessons.md).
- Not checked: two players online; a person playing the events; walking on a real phone.

**Play vs CPU with five levels (2026-11-03, user: "add button as play against cpu ... 5 difficulty of cpu";
committed `ebfaebb`, not pushed, not deployed)**
- The game: **Play vs CPU** on the Play card and **Play vs CPU · no account needed** on the login screen open a CPU
  screen: Novice, Easy, Normal, Hard, Master (a tick on beaten levels), your hero, the opponent (random by default),
  Fight. An offline AI duel, one round, Rematch on the card, a Leave button during the fight
  (`src/game/cpu.ts`, `src/game/main.ts`, `game.css`). No server messages; choices and ticks in `localStorage`.
- The levels: `src/cpuLevels.ts`, read by `Duel.cpuLevel` (`src/duel.ts`): walk speed, a pause after casts,
  cooldown factor, aim error, lead, bolt dodge, a new zone dodge, guard chance and R timing. Normal is the AI the kits
  are balanced with (the old constants, no extra rules); the autopilot always plays Normal. The tool has View → CPU
  level. Table and numbers: [mechanics.md](architecture/mechanics.md#cpu-levels).
- Measured against the Normal autopilot (`pipeline/tools/duel-ladder.js`, new): the CPU won 2% / 25% / 52% / 63% /
  85% from Novice to Master (48-80 fights each). Lyra at Normal against her six balance foes: 56% (54% before).
- Hard and Master stayed near 64% on speed, dodge and lead alone; a cooldown factor (Hard ×0.85, Master ×0.8)
  separates them. A fixed long lead missed more than it hit; the lead now follows each spell's own time to land.
- Checked in the browser (game.html, desktop and 375 px): the login button, the CPU screen, a fight on Hard and on
  Master (HUD "Lyra · Hard"), defeat and victory cards, Rematch, the tick after a win, Leave back to the CPU screen,
  the logged-in Play card's three buttons (with a fake profile in the page, nothing sent). tsc clean, no console
  errors. Not checked: a human playing the levels through; the live site.

## State on 2026-10-30 (end of day)
The game ("Arena of Kits") is a 1v1 MOBA-style duel: 20 heroes, each with a role, four spells of its own shapes and a
basic attack, fought in one of five arenas. Everything below is committed on `feat/particle-editor` unless marked.

**Done today (commits, newest first)**
- `4f39f41` Rebalance hero kits for basic attacks: every hero wins 42-57% of AI duels (1,520-fight tournament).
- `68f976c` Give every hero a role and a kit shape of its own (`pipeline/designs/hero-roles.md`, 7 new spell types).
- `63c232d` MOBA basic attacks: right-click attack, A attack-move, S stop; melee swing / ranged homing bolt
  (`src/attacks/`, `docs/architecture/attacks.md`). Off in network duels.
- `cc0ac85` Five duel arenas picked at random (Night Temple, Frostfall Lake, Ember Caldera, Verdant Glade, Sky Ruins;
  `src/arenas/`, `docs/architecture/arenas.md`) and the heavier Oblivion model (v2; the first is `void_v1`).
- `955b850` Smooth online opponent movement, MOBA-slow walking (hero 4 m/s, AI 3.5).
- `68e2d10` Balance pass, `e8e4326` hero wave 5 (Oblivion, Shiori, Tempo).

**Live (deployed 2026-10-30, freeze lifted by the user)**
- `484d7fd` Best-of-3 rounds online + server checks committed, pushed to GitHub `main`
  (https://github.com/Dextonek/ArenaChamp) and deployed to https://arena-of-kits.arenachamp.workers.dev (Worker version
  `adafbe2c-d0b0-4e1e-b72f-ef7fd527ecb3`). Before the deploy: `npm run build` clean, `npm run test:server` passed. After:
  the live page serves the new bundle, no console errors, the game WebSocket opens. The live game now has the five
  arenas, the hero roles, the new Oblivion, smooth movement and the rounds.
- Not committed on purpose: the Meshy experiment (`blender/meshy/`, 35 MB GLB; `docs/heroes/void-meshy*`, `void_meshy_*`).

**Online sync of the mechanics (2026-10-30, `24fec40`, live)**
- Statuses, shields, heals, pulls, skillshots, summons and basic attacks now work in network duels (the victim's
  client decides; new messages `attack`, `heal`, `status`, `shield`, `cast.yaw`, `took_hit.soaked`; see
  `docs/architecture/multiplayer.md#mechanics-online`). Rounds have no time limit any more (user): they end on a KO.
  `npm run test:server` 32/32 (6 new checks); two-player browser test passed (Lyra vs Auriel, Fenna vs Marin).
- Also in `24fec40`: two round-start fixes. The side-0 hero turned upside down in round 2
  (`src/effects/weapons/hero.ts` restored a quaternion; now the Euler angles), and the 3-2-1 counted on frame time
  (`src/duel.ts`, now the wall clock).
- Known gap: each screen simulates its own copy of the summoned units (positions and unit HP can drift).
  Basic attacks on units stay local.
- Pushed to GitHub `main` and deployed (Worker version `d4fee4c5-be7f-4753-8c11-4dab08c03d81`); the live page serves
  `game-DSwok-2F.js`, no console errors, the game WebSocket opens.

**Hero identity layer (2026-10-30, committed c7f2039, deployed 2026-11-01)**
- Every hero has a passive (new passive slot left of Q), a twist (own resource bar, hold-to-charge, free recast,
  ammo charges or stacks on the enemy), its own basic attack look, range and speed, its own walk speed, and one spell
  with a buff or debuff. New buffs / debuffs: haste, might, armor, vulnerable, weaken. Engine and rules:
  `docs/architecture/traits.md`; design and as-built deviations: `pipeline/designs/hero-identity.md`.
- New VFX (user: "make new ones"): buff / debuff looks on the hero models (`src/effects/parts/buffs.ts`), stack pips
  and proc bursts (`src/traits/fx.ts`), 16 missile and 6 swing looks for basic attacks (`src/attacks/fx.ts`); sheet
  `docs/traits/attack-looks_sheet.jpg`.
- Code: `src/traits/` (types, runtime, fx, index, one file per hero), hooks in `src/duel.ts` (`resolve`, `setupTraits`),
  `src/heroMode.ts` (passive slot, hold / recast / ammo), `src/arena.ts` (`hitMod`, `applyBuff`, `shieldScale`),
  `src/effects/status.ts` (buffs). 18 of the 20 trait files were written by three worker agents, then registered and
  balanced here.
- Online: casts and attacks carry `mods`; new messages `buff`, `stacks`, `spend`, `move.r`; spell hits capped at 400.
  Two-player test passed (Nyx vs Vex: power with might, toxin stacks decided on the
  victim's screen and relayed, combo points counted once per confirmed hit, the ultimate at power 1.3).
- Balance: six tournament rounds (about 5,200 AI fights, no errors, no timeouts). Last full run (1,140 fights, after the
  review fixes) out of 114 each: Kaia 70, Opaline 69, Lyra 64, Sirix 64, Nyx 62, Cantor 58, Isolde 55, Mortis 53,
  Shiori 53, Vesper 53, Brannoc 52, Marin 51, Sefu 51, Oblivion 47, Auriel 47, Ada 46, Fenna 43, Zephyr 42; Vex (91, a
  bug in her once-per-cast guard) and Tempo (69) were fixed after and re-checked against everyone: Vex 33/76, Tempo
  40/76. So every hero is about 37-61%. Fights average 21 s (were 29 s).
- Review fixes (advisor, 2026-10-30): a hook that replaced `hit.opts` lost its change (Sirix's slow); the server's
  0.8 s slot gap and 10 s R gap dropped Lyra's ammo and Oblivion's recast online (now 0.35 s, plus one free second R
  within 4 s); once-per-cast rules now key on a cast id (`TraitHit.cast`), not `afterCast` (Vex online); the player's
  summons now carry the cast's power (Mortis, Ada); Fenna's regen heals in chunks; trait clocks stop while the hero is
  locked. `npm run test:server` 38/38.
- Client and server change together: deploy both.

**Kit uniqueness pass (2026-10-31, committed c7f2039, deployed 2026-11-01)**
- Review and as-built notes: `pipeline/designs/kit-uniqueness.md` (all three batches done; C won over B for Isolde E
  and Oblivion E).
- Fewer copies: 5 of the 9 shield Es lost their shield; no more bounce Qs (Lyra, Cantor, Ada); Cantor and Fenna Rs no
  longer stun / root; Oblivion Q pulls, Sirix Q swipes twice, Zephyr E dashes forward through the enemy; Brannoc's Q is
  "Slag Flick"; four "every Nth hit" counters removed.
- New mechanics: Isolde's ice block (1.5 s, nothing lands, she can't act), Oblivion's void maw (swallows the next enemy
  spell within 2 s), Cantor's encore (3 s of 1 s cooldowns after Crescendo), Shiori's ink (the only mana hero), Ada's
  turret Overclock, Sirix's damage per living wasp, Ada's sticking rivet, Cantor's echo beat.
- New VFX (worker agents): ice block, void maw shell, encore aura, sticky rivet, echo ring, forward wind dash, second
  Sirix swipe. Ice block toned down under bloom by hand. Sheets `docs/traits/newfx_sheet.jpg` (ice block there is the rejected bright one) and `docs/traits/iceblock_sheet.jpg` (the fixed one).
- Engine: `TraitHit.blocked` (a victim's passive swallows a hit), `TraitView.units()` and `hold()`; AI holds spells
  into an ice block and only baits Q into a maw (`Duel.ward`); basic-attack families (fast / standard / long).
- Online: `took_hit` / `peer_hit` carry `blocked` (no HP taken, attacker's passives don't count it).
  `npm run test:server` 39/39. Two-player test (local, test accounts in git-ignored `server/data/`): ice block and void
  maw both swallowed real hits and showed BLOCKED on the attacker's screen.
- Balance: six tournament rounds (about 5,700 fights, no timeouts). Last 1,140-fight run: 34-65% (Ada 65 highest,
  Nyx 34 lowest; runs of 760 swing about +-10 points per hero). Fights average 20 s.
- Isolde's ice block lock is a floor under the spell's cast root and ends at the shatter (free at 1.52 s, checked).
- Not checked: in the online test Isolde's Rime Spear did not register on Oblivion, but only after I had moved him by
  script (screens out of sync); offline it hits at 2.7 m and 7 m. Cantor's echo beat online not tested.

**Kit identity v2 design (2026-11-01, design only, nothing built)**
- `pipeline/designs/kit-identity-v2.md`: every hero gets one owned mechanic; passives, twists and every slot's
  shape plus rider differ across all 20. `python pipeline/tools/check-kit-v2.py` checks the tables (7 of 7 ok).
- Build in 5 batches (trait only → spell logic → 4 new debuffs → cleanse / leash → burrow, stealth, mirror with net
  work), a tournament after each. Waiting on the user: build it, and whether batch 5 is in.

**Deployed again (2026-11-02, at the user's request "Deploy yes"; nothing committed or pushed to git)**
- `npm run cf:deploy`, worker version 78e57f31-b6d5-47de-9a4f-4a2a4936d5cb. The live `/game` serves the same
  bundle hashes as `dist/` (main-zonWtTYw.js).
- Contents: all five remade arenas (cover, backdrops, breakable temple walls) for every player; the heroes still
  only behind `/game?figs=v2c` or `?figs=v2`.
- Not verified live, because the game needs a login. Phone performance and a two-player match with breakable walls
  are untested.
- Open risk: there is no game-version check in matchmaking, so a player who doesn't reload can be matched against
  the new build and see different cover.

**Arena remake, done (2026-11-02, committed `0ed55d1`, deployed 78e57f31): user asked to "rearrange the arenas and all the objects in arena, make them high quality"**
- Probe first: Night Temple only, both the new layout and high-quality props, then a before/after sheet for the
  user's OK. The other four arenas wait for that OK.
- Style rules:
  - Cover props get the hero pipeline: Blender `kit` shapes, `sculpt.fuse`, `sculpt.paint`; one meshopt GLB per arena
    (`public/models/arenas/<id>_props.glb`), loaded in `build()`, cached per arena, and drawn with `InstancedMesh`
    for repeats.
  - Budget: cover props about 40–60k triangles per arena.
  - Floor, backdrop silhouettes and particles stay procedural.
  - Prop footprints match the capsules: pillar base radius ≥ `o.r`, wall depth = 2·`o.r`.
  - Floors stay in the `0x15131a` luminance band. Camera rule for the backdrop. Cover on the z axis stays low (the
    gameplay camera looks along it).
  - At most ~60 draw calls; `dispose()` frees the loaded props too.
- Layout rules (docs/architecture/arenas.md):
  - point-symmetric about (0, 7); starts (0, 1) and (0, 13) clear for 3 m;
  - nothing within 1.5 m of the rim; gaps ≥ 2 m; pillar r ≤ 1.0, wall half-thickness ≤ 0.4.
  - Every new layout is checked by a validator script (scratchpad `layout_check.py`; it also passes the old layout).
- Night Temple done (probe):
  - New layout `TEMPLE_OBSTACLES` in `src/arenas/temple.ts`: a low sun altar in the middle (r 1.0, 1.45 m), four
    angled screen walls round it, six columns at the sides. It replaces `DUEL_OBSTACLES` for the temple.
  - Props: `blender/arenas/temple_props.py` → `public/models/arenas/temple_props.glb` (392 KB): column 6.2k
    triangles, wall module 5.9k, altar 6.0k, brazier 1.6k. 75k triangles in the arena (over the 60k target), 18
    instanced draw calls.
  - In three.js the stone is darkened (×0.58) and the gold and altar glow toned down.
  - Checked in game: before/after sheet `docs/arenas/temple_remake.jpg`; an AI duel on it ran to a KO.
  - Not deployed. The user then said "you do it all": the other four follow, one helper at a time (Blender is shared).
- Frostfall Lake done:
  - `FROST_OBSTACLES`: a low frozen boulder in the middle, four ice spires, four snow drifts.
  - Props: `blender/arenas/frost_props.py` → `frost_props.glb` (305 KB), 30.7k triangles placed, 15 draw calls.
  - Sheet `docs/arenas/frost_remake.jpg`; the AI duel ran to a KO.
  - Small open points: a spire's fallen shard can touch hero feet; the drift snow is a little grey.
- Ember Caldera done:
  - `CALDERA_OBSTACLES`: the centre lava vent stays open; low obsidian ridges beside the middle lane; tall and
    snapped basalt clusters; bladed ridges on the wings.
  - Props: `blender/arenas/caldera_props.py` → `caldera_props.glb` (190 KB), 15k triangles placed.
  - Sheet `docs/arenas/caldera_remake.jpg`; the AI duel ran to a KO.
  - Open points: the glow cracks barely show; the cover reads smaller than before.
- Verdant Glade done, cover and backdrop:
  - `GLADE_OBSTACLES`: a fallen log across the middle (1.1 m), giant stumps, rune stones, mushroom clusters, and
    fallen trunks with root plates.
  - Props: `blender/arenas/glade_props.py` → `glade_props.glb` (923 KB, 52.9k triangles placed) and
    `glade_backdrop.glb` (154 KB, about 79k triangles of trees, bushes, ferns, rocks and rim stones).
  - Unique placements are merged into one mesh per material: 9 draw calls for all props.
  - The old trees broke the camera rule; the new ones don't.
  - Sheet `docs/arenas/glade_remake.jpg`; the AI duel ran to a KO.
  - Open points: the moss is flat up close; the GLB is the heaviest so far.
- Sky Ruins done, cover and backdrop:
  - `SKYRUINS_OBSTACLES`: low drum stacks on the cross axis, low balustrades off the starts, tall intact and
    broken columns, and broken arch bases on the wings.
  - Props: `blender/arenas/skyruins_props.py` → `skyruins_props.glb` (843 KB, about 37k triangles placed) and
    `skyruins_backdrop.glb` (361 KB, about 34k triangles: islands, the far arch, edge balustrades, rocks).
  - 39 draw calls. Sheet `docs/arenas/skyruins_remake.jpg`; the AI duel ran to a KO.
  - Open point: the marble reads pale (×0.36).
- Night Temple backdrop done:
  - `blender/arenas/temple_backdrop.py` → `temple_backdrop.glb` (367 KB, about 51.7k triangles placed): two ruined
    gates, colonnades with architraves, guardian statues, obelisks, banner poles, stair fragments, drums, rubble;
    instanced banners with a wind ripple.
  - 47 drawables. Sheet `docs/arenas/temple_backdrop.jpg`.
  - The camera rule is now checked when the backdrop loads (it logs an error and leaves the backdrop out).
  - temple_backdrop.py imports its shape helpers from skyruins_props.py.
- Frostfall Lake backdrop done:
  - `blender/arenas/frost_backdrop.py` → `frost_backdrop.glb` (209 KB, 72.5k triangles placed): shore ice plates and
    pressure ridges, snow-capped boulders, scrub and snow-laden pines, frozen dead trees, far peaks.
  - 46 drawables. Sheet `docs/arenas/frost_backdrop.jpg`.
  - frost.ts now tunes each material once (the old per-mesh factors written as `x ** 5`, the same look).
- Ember Caldera backdrop done:
  - `blender/arenas/caldera_backdrop.py` → `caldera_backdrop.glb` (293 KB, 75.5k triangles): an obsidian rim lip,
    prism clusters, boulders, vents, lava-crusted spires, and crater-wall segments with thin lava falls.
  - 38 drawables. Sheet `docs/arenas/caldera_backdrop.jpg`.
  - The `OBSTACLES is not defined` console entry was stale history from a mid-edit hot reload; the browser pane keeps
    console entries across navigations. It is not a real error.
- All arenas done (2026-11-02). Final check:
  - `npm run build` passes.
  - A fresh load of all five arenas shows no errors; drawables are temple 46, frost 46, caldera 38, glade 22, sky
    ruins 25.
  - Overview sheet: `docs/arenas/arenas_remake_all.jpg`. Arena GLBs total 4.2 MB.
  - Not deployed. Breakable walls are on the temple only, and untested in a live two-player match.
- Material tuning: GLTFLoader shares one material between props that use it. temple.ts now tunes each material
  once, with the same resulting look. frost.ts was fixed the same way in its backdrop pass.
- Backdrops too (user, 2026-11-02: "remake all the outside props and backgrounds of the arena"):
  - Each arena's surroundings (outside radius 12) get the same Blender sculpt-and-paint treatment, instanced.
  - Budget: backdrop ≤ 80k triangles extra; the whole arena ≤ 60 draw calls.
  - Camera rule: anything taller than 2 m is > 26 m from the centre or |x| > 12.
  - Order: Glade (added to its running helper), Sky Ruins (cover and backdrop together), then backdrop passes for
    Temple, Frost and Caldera, one at a time.
- Breakable walls (user idea, approved: "Do it"), prototype on Night Temple:
  - `ArenaDef.breakable`, `ArenaScene.wallState`; `Duel.blastWalls`, `resetWalls` and `playerBlast` in duel.ts.
  - Walls take 3 hits; an ultimate counts as 2. Area spells hit walls within their radius, line spells walls on
    their path; single-target spells never hit walls.
  - A broken wall leaves `arena.obstacles` (a per-round copy), so heroes walk and see through it. Walls stand again
    each round.
  - Online: both screens run it from the cast message (`peerCast` uses the sender's position and aim point, also
    for spells aimed at the hero), no server change.
  - Temple: whole, cracked (`WallCracked`) and rubble (`WallRubble`) props in temple_props.glb (now 565 KB), plus
    flying stone chunks that stay on the floor until the round ends.
  - Gotcha: an instanced mesh that starts hidden (zero-scale matrices) gets culled forever; the wall sets and
    chunks use `frustumCulled = false`.
  - Tuning: `WALL_HP` 5; an area spell hits a wall inside 60 % of its radius (`WALL_BLAST_REACH`).
  - AI duels on the temple: the first wall falls 7–13 s into a round of 16–25 s, and most walls end the round
    damaged.
  - Clip: `docs/arenas/temple_breakable_wall.mp4` (440 KB, git-ignored).
  - Not tested in a real two-player online match yet.

**Deployed the working tree to Cloudflare (2026-11-02, at the user's request; nothing committed or pushed)**
- `npm run cf:deploy`, worker version 79de928c-0b0a-442e-8008-fc223f0b1331. This lifts the deploy freeze for this
  build only.
- New heroes: https://arena-of-kits.arenachamp.workers.dev/game?figs=v2c (concept Brannoc and Kaia) or `?figs=v2`.
  Use the `/game` address: the redirect from `/` drops the query.
- Default play, without `?figs`, still uses the old models. Not checked live, because the live game needs a login.

**Kit shapes v3 design (2026-11-03, design only, nothing built, waiting on the user)**
- The user: kits feel the same (one skillshot, then circles), ultimates are mostly big circles. Counted from the
  built kits: W is a circle on 13 of 20 heroes, R a big circle on 16 of 20; Q is already varied.
- `pipeline/designs/kit-shapes-v3.md`: 16 new ultimates (rewind, charged line, terrain wall, curving stroke, charge
  and wall slam, mark and recast, cheat death, spell steal, ...), 4 new Ws, 4 Qs turned into skillshots, 2 new Es,
  18 engine pieces with cost, and a build order: 5 engine pieces, then a play-test of Tempo, Kaia, Isolde, Shiori
  and Brannoc before the other 15. Keeps kit-identity-v2's passives; its slot shapes are replaced.
- Second pass the same day (user: "remade more and make it"): circle Ws 13 → 4, self-burst Es 8 → 3; 16 Rs, 8 Ws,
  7 Es new, 4 Qs become skillshots. v2's passives are not part of it (not answered).
- **Build in progress (2026-11-03), batch 1 of about 4:**
  1. Engine pieces (one worker, sole writer of traits/heroMode/touch/arena/obstacles/projectile/duel): per-slot
     hold and recast, trait history plus `moveTo` with online snap, temporary obstacles, curving projectile with
     an arc aim, a carry and wall-slam sweep, and a skillshot hook. Running.
  2. Then the five play-test heroes in parallel, per-hero files only: Tempo plus Kaia, Isolde plus Brannoc,
     Shiori. Their registry lines and AI rules come back to me to add.
  3. Then a browser pass and AI-vs-AI duels per hero (slot R actually cast), then batches 2 to 4 (the other 15).
  - Resume: read `pipeline/designs/kit-shapes-v3.md`, then `git diff --stat`, to see which pieces landed.
- **Batch 1 done (2026-11-03, committed `af47bbe`, not deployed, not tested online):**
  - Engine pieces built (APIs in docs/architecture/traits.md, hero-mode.md, targeting-and-arena.md,
    multiplayer.md); `server/hub.mjs` relays `cast.bend`. Projectile hooks were broken (pull measured from the bolt,
    so 0 m) and are fixed. `CastContext.obstacles()` added for sweeps.
  - New spells: Tempo Unwind (R) and Quickstep (E, 2 charges); Kaia Thunderlance (R, hold 1.5 s) and Ball Lightning
    (W, recast to blink); Isolde Glacier Wall (R); Brannoc Slag Flick (Q skillshot) and Forge Charge (R, wall slam);
    Shiori Final Calligraphy (R, curving) and Ink Double (W). The 9 replaced effect files are deleted (git rm).
  - Checked in the browser: all 9 cast in a duel (sheet `docs/heroes/kits_v3_batch1_sheet.jpg`); Thunderlance's
    lightning drew black only (quad buffer full, outline layer first), fixed with a bigger buffer. AI-vs-AI: every
    hero casts all four slots; 12 duels each vs Lyra, Zephyr, Vex, Auriel, Sirix, Mortis: Tempo 7, Kaia 6, Isolde 6,
    Brannoc 6, Shiori 5 wins. No console errors.
  - Not checked: a two-player online match with the new spells, phone controls for hold and arc aim.
  - Next: batches 2 to 4 (the other 15 heroes, same pattern: per-hero workers, then registry, browser, AI duels).
- **Batch 2 done (2026-11-03, committed `af47bbe`, not deployed, not tested online):**
  - Vesper's kit moved out of `src/heroes.ts` into `src/kits/blood.ts` (like every other kit).
  - New spells: Vesper Hemolance (Q, now a line skillshot), Blood Step (W, 5 m blink plus a thorn strip) and
    Blood Bond (R, mark, recast pops 60 plus 50% of the damage dealt since); Nyx Shadow Swap (W, dagger, recast swaps
    to it) and Shadow Mark (R, 2 s later she strikes from behind for 80 plus 30%); Vex Volatile Leap (E, blast and a
    5 m jump back) and Elixir of Unmaking (R, 5 s of Q at 0.4 s with double toxin and +20% damage); Fenna Seed of
    Rebirth (R, cheat death to +35%); Marin Tide Whip (Q, hook pulls 3.5 m) and Bubble Prison (W, knock-up plus a
    2 m drift). The 10 replaced effect files are deleted (git rm).
  - New AI flag `HeroSpell.save`: the AI casts it when its own HP is under 45% (Seed of Rebirth). Before it, Fenna
    never cast her R.
  - Balance: 24-36 AI duels each against Lyra, Zephyr, Auriel, Sirix, Mortis and Ada. Wins: Vesper 39%, Vex about
    46%, Nyx 42%, Fenna 54%, Marin 46%. To get there: Vesper HP 620 → 700, HP cost 4-8% → 2.5-6%, Hemolance
    42 → 50; Vex spell penalty 15% → 12%, Leap 26 → 40, Elixir gives might; Nyx dagger 45 → 35, mark 110 → 80.
    No console errors. Sheet: `docs/heroes/kits_v3_batch2_sheet.jpg`.
  - Known: Blood Bond and Nyx's dagger behave differently online (the other screen pops a flat 90; the swap aims at
    full range when that screen cannot see the hit). Vex's E and R icons are still the old drawings.
  - Next: batch 3 (five more of: Lyra, Sefu, Auriel, Zephyr, Mortis, Ada, Sirix, Cantor, Opaline, Oblivion).
- **Batch 3 done (2026-11-03, committed `af47bbe`, not deployed, not tested online):**
  - New spells (replaced files deleted with git rm):
    - Sefu: Sand Lash (Q, line skillshot, root), Burrow (E, 7 m tunnel, untouchable 1.1 s), Dune Surge (R, wave carries
      the enemy 12 m, root).
    - Auriel: Radiant Parry (E, 0.6 s stance; the first hit is blocked and the enemy stunned 0.6 s), Dawn Descent (R,
      12 m leap, untouchable in the air, 2.5 m landing stun, shield 40).
    - Zephyr: Wind Barrier (E, a 5 m wall that destroys the enemy's bolts for 3 s), Gale Cyclone (R, a 2.5 m cyclone
      that moves with him for 4 s).
    - Mortis: Bone Colossus (R, one giant skeleton: 280 HP, 28 per hit, 8 s).
    - Ada: Mag Rail (R, rails from her and from each live turret, crossing on the target).
  - Look-only refresh of the spells Sefu and Auriel keep: Quicksand (a striped sand cobra rears out), Radiant Spear
    (a feather-plate spear), Aegis Wall (kite shields with sun emblems).
  - Engine:
    - Bolt walls: `ProjectileSystem.wall`, `CastContext.boltWall`.
    - `contextFor` now has a default `displace` that moves arena figures, so an AI Auriel visibly leaps.
    - Two new AI flags, `HeroSpell.parry` and `HeroSpell.barrier`. The AI casts them only when a bolt is due or the
      enemy's attack winds up, before it would sidestep, and only on a 60% roll per threat.
    - A dash-flagged ultimate may now be cast inside Q range.
  - Checked: tsc clean, no console errors, every new spell cast and seen in a duel (sheets in the scratchpad), every
    hero casts all four slots.
  - AI duels (24 each against Lyra, Vex, Sirix, Cantor, Opaline and Oblivion), last pass:
    - Sefu 50% and Auriel 62%, after buffs to Sefu and nerfs to Auriel.
    - Mortis 33%: the colossus was cut from 360 HP / 34 per hit / 9.5 s, when he won 75%. It overshot.
    - Zephyr 33%; Ada 46%.
    - Not balanced further, because the user asked for a fresh redesign of every kit next (see below).
- **Sefu and Auriel models in the current style (2026-11-03, committed `af47bbe`, `?figs=v2`):**
  - Classes `Sand` and `Dawn` in `blender/heroes/moba_figures.py`.
  - New helpers: `arc_shell` (a curved band open at the front) and `band` (a low-resolution decorative ring).
  - Exports: `sand_v2.glb` (34.9k triangles, 452 KB) and `dawn_v2.glb` (37.8k, 499 KB). Both are in `MODELS_V2`.
  - Sefu: a striped gold-and-turquoise nemes flaring past his shoulders like a sphinx headdress, a rearing cobra on
    the brow, a jewelled collar, a pleated kilt with a royal apron, gold greaves and bracers, a crook taller than he
    is.
  - Auriel: raised wings (a gold arm and nine feather plates each), a winged circlet, a golden braid, ivory plate, a
    light sword and a big kite shield with a sun.
  - Her first ivory was near-white and bloomed over the whole figure in the game, so the colours are now mid-value.
    Isolde's white skirt shows the same bloom, not fixed.
- **The VFX tool and the game are separate apps (2026-11-03, committed `c17cfc2`, not pushed, not deployed):**
  - The user asked to separate them.
  - Before, `game.html` ran the tool's `src/main.ts` with its panel hidden and shipped all of it.
  - **`src/runtime.ts`** (`createRuntime({ modules, background })`) is the shared scene: renderer, sky, post chain,
    effect slots, arena, hero mode, duel, loop.
  - **`src/tool/`** is the VFX tool (`index.html`): `tool/main.ts` with the panel, particle editor, play mode and
    `window.vfx`, plus `tool/player.ts` (dodge dummy) and `tool/hotbar.ts`. It plugs into `runtime.hooks`.
  - **`src/game/main.ts`** builds its own runtime with only `targetedModules` and keeps stepping in a hidden tab. Its
    console handle is `game.api`.
  - The `data-mode="game"` flag is gone.
  - Run with `npm run tool` or `npm run game`.
  - Build: `game.html` loads `game-*.js` (21 KB) and `runtime-*.js` (3.19 MB). Neither has lil-gui or editor strings.
    Before, the game loaded a 3.7 MB chunk with the whole tool.
  - Checked in the browser:
    - **The tool:** all `vfx` members, a spell and a set-piece self-test, particles, play mode with the hotbar, three
      AI duels with every slot cast.
    - **The game:** the login screen, 20 kits, 162 spell slots, an offline AI duel via `game.api`.
    - No console errors.
  - Docs point at `runtime.ts`, `tool/` or `game/` instead of `main.ts` (architecture overview: "Two apps, one
    runtime").
  - Deploy is unchanged (the worker still sends `/` to `game.html`; the tool stays at `/index.html`).
- **Next: a fresh design of all 20 kits** (user, 2026-11-03: forget the current kits; new ideas for every hero, more
  targeted spells, dashes, pulls and buffs, passives that fit the new kits). Design first, for the user's approval,
  then build in batches.
  - Design: [pipeline/designs/kits-v4.md](../pipeline/designs/kits-v4.md). It holds:
    - all 20 kits and passives;
    - 15 engine pieces with costs;
    - a low-engine opener: Lyra, Vex, Marin, Mortis, Zephyr;
    - six questions for the user.
  - Waiting on the user:
    - answers to those six questions;
    - whether to commit batches 1–3 and the two models first, which is recommended (v4 rewrites every kit again).
  - Nothing of v4 is built.
  - **User, 2026-11-03: "U decide make it as best as you can".** The six questions are answered with the
    recommendations:
    1. Keep the names, looks, themes and roles.
    2. Targeted spells need line of sight.
    3. Keep stealth, built last.
    4. Two transforms are fine.
    5. Keep the beat (window ±0.25 s; the AI casts in tune 70% of the time).
    6. Start with the low-engine opener.
- **v4 opener build log (2026-11-03, committed `0a0279a`; on top of the separation commit `c17cfc2`): Lyra, Vex,
  Marin, Mortis, Zephyr.**
  - Running together:
    - an engine worker, the only writer of `traits/types.ts`, `traits/runtime.ts`, `attacks/*`, `heroMode.ts`,
      `duel.ts`, `summon.ts`, `targeting.ts`, `arena.ts`. It builds:
      - basic-attack reach and echo hooks, and `TraitView.resetAttack`;
      - `TraitView.summon`;
      - death spots (`TraitView.deathSpots`, `CastContext.deathSpots`);
      - line of sight for targeted spells in hero mode;
    - the Vex worker (alchemy kit, trait, new effects);
    - the Marin worker (tide).
  - Waiting on the engine worker's report with the exact signatures: Lyra (astral), Mortis (bone), Zephyr (sky).
  - Then the lead (me):
    - registry swaps and git rm of each hero's old effect files;
    - AI rules;
    - a browser check of every spell;
    - AI duels, 40–60% wins;
    - a sheet;
    - STATUS.
  - Resume: read `pipeline/designs/kits-v4.md`, then `git status`, to see which kits and engine pieces have landed.
  - **Update (later on 2026-11-03):**
    - The engine pieces are done:
      - `Trait.attackReach` and `attackEcho`, `TraitView.resetAttack`, `TraitView.summon`, `TraitView.deathSpots`;
      - `CastContext.deathSpots`, `DeathSpot` in `summon.ts`;
      - line of sight checked in `castNow`.
    - All five kits are built, registered and their old effect files removed (git rm):
      - Lyra: starfallArrow, twinStars, pinningArrow, meteorMark.
      - Vex: toxinDart, fireVial, acidSplash, homunculus.
      - Marin: waveDisc, coralSpire, mistForm, moonPull.
      - Mortis: boneFan, raiseDead, boneArmour, graveGrasp.
      - Zephyr: crosswind, skyward, featherStep, skyRend.
    - The duel AI: a `parry` spell that is also a `dash` (Zephyr's Feather Step) still closes gaps.
    - Tournament (24 each against Brannoc, Kaia, Isolde, Sirix, Cantor, Oblivion):
      - first: Lyra 29%, Vex 25%, Marin 0%, Mortis 12%, Zephyr 21%. The damage was far too low (Marin 13/s, Mortis 19/s; the old kits deal 28-39/s).
      - after a damage pass: Lyra 71%, Vex 58%, Marin 12%, Mortis 83%, Zephyr 71%.
    - Pass 2 is running: Lyra, Mortis and Zephyr trimmed about halfway. Marin gets more damage, a wider disc, +60 HP and a fix for her Mist Form splash, which never hit.
    - Then: re-run the tournament, clean per-spell sheets, STATUS.
- **v4 opener done (2026-11-03, committed `0a0279a`, not pushed, not deployed, not tested online): Lyra, Vex, Marin, Mortis, Zephyr.**
  - Balance passes 2-4, final numbers in each hero's `pipeline/designs/kit-<theme>.md`:
    - Marin's Mist Form became a 6 m water dash with a 40 splash where she reforms (`dash` + `parry`). Her old
      splash never hit, because the AI keeps 4-6 m away.
    - Marin HP 620 → 670.
  - Last tournament, 24 duels each against Brannoc, Kaia, Isolde, Sirix, Cantor and Oblivion: Lyra 54%, Zephyr 54%,
    Vex 58%.
  - Over 72 duels: Mortis 61%; Marin 37.5% before her final +20 HP, never beating Brannoc. The new HP is not re-run.
  - The noise at 24 duels is about ±10%: Marin read 71% and then 37.5% after a small trim.
  - Sheets: `docs/heroes/kits_v4/<hero>_v4_sheet.jpg`, the four spells of each against a frozen opponent. All 20
    cast and play.
  - Line of sight: targeted spells refuse an unseen target. The sheet run hit this in the frost and temple arenas;
    that is intended.
  - No console errors; tsc clean.
  - Known:
    - Online: trait summons (Mortis's fifth-attack skeleton) are local only, and the attack echo (Lyra's second
      arrow) folds into one hit.
    - The effect headers of some spells still quote first-pass numbers in comments.
    - The bolt-wall engine and the `barrier` flag are unused now that Zephyr's Wind Barrier is gone.
    - The hero catalog (`docs/catalog/heroes/`, `docs/catalog/effects.md`) and the hero table in
      `docs/architecture/hero-mode.md` still list kits from before v3 (batches 1-3 never reached them either).
      Refresh them once all 20 v4 kits are in, not per batch.
  - Next: the other 15 heroes in three batches (kits-v4.md build order), each led by its engine pieces; Nyx's stealth
    last.

**Two duel bugs fixed (2026-11-03, committed `af47bbe`, not deployed)**
- The last match's spell (often an ult) showed at the start of the next one, mostly after a forfeit or a reload:
  turning hero mode on replayed the spell that was cast last. `clearEffects()` (now in `src/runtime.ts`) ends every spell
  on screen when hero mode turns on or off and at every duel round (`DuelHost.clearEffects`, called from
  `Duel.setup` / `stop`); switching modes no longer replays anything. Checked in the browser: Vesper's ult cast, the
  duel left mid-cast, a new duel started: no effect visible; recasting it still works.
- Heroes stuck at gaps between obstacles: `steer` in `src/obstacles.ts` turned for every obstacle within 1.2 m, so
  the two sides of a gap turned the hero back and forth. It now turns only for the nearest obstacle the straight walk
  would hit, looking no further than the walk's goal. Every gap is at least 2.0 m (body 1.0). A walk-through test
  of every gap in all five arenas: 140 of 184 walks passed before, 184 of 184 now.

**The concept look chosen; all six v2 heroes rebuilt in it (2026-11-02, committed `0ed55d1`)**
- The user picked the concept shapes ("the new look"). Brannoc and Kaia's concept builds are now the regular v2
  files (`forge_v2.glb`, `storm_v2.glb`; the `_c` files are gone). `moba_figures.FIGURES["forge"]` and `["storm"]`
  build the concept classes; `forge_a` and `storm_a` still build the earlier shapes.
- `src/heroes.ts`: `?figs=v2` shows all six; `?figs=v2c` is kept as an alias so the old link still works.
- Vesper, Isolde, Zephyr and Oblivion rebuilt in the concept style with the sculpted finish (`SCULPT`, `FUSE`, `WRAP`,
  `PAINT` on `Blood`, `Frost`, `Sky`, `Void`; they had no sculpt pass before). One signature shape each:
  - Vesper: bigger head and eyes, the blade fan 1.5× (a crimson V), a wider skirt, a long scepter with a big ruby in a
    gold claw. 33.6k triangles, 430 KB.
  - Isolde: bigger head and eyes, the shard halo 1.5× wide, an ice tiara instead of the bun, a spear taller than she
    is with a crystal head; ice glow lowered to 0.45 so the halo does not bloom over her face. 35.3k, 454 KB.
  - Zephyr: bigger head, sharp eyes, hair swept back in big blades, the scarf 1.5× longer and wider, a longer
    curved blade. 38.2k, 491 KB.
  - Oblivion: a tower instead of Brannoc's wedge (straight-sided cuirass, long tassets), horns 1.5× taller, taller
    pauldron spikes, a pale greatsword nearly his height with thick void edges. 34.2k, 418 KB.
- Sheet: `docs/heroes/moba_v2_concept_six.jpg` (all six in game: face, 3/4, full, walk, attack, game cam).
- Not done: the other 14 heroes (later batches); default play without `?figs` still uses the old models for all 20.
- Waiting on the user: feedback on the four, and whether to commit.

**Concept-shape variants of Brannoc and Kaia, smoothed (2026-11-02, superseded by the entry above)**
- Smoothing pass: Brannoc's iron body and helmet, trousers, boots, chimney stacks and smoke, and Kaia's legs and
  boots, are each fused into one smooth shape (extra `FUSE` groups on the concept classes). Brannoc now has 40.7k
  triangles (518 KB), Kaia 35.8k (458 KB).
- The user asked to try the shapes "what they were", which I read as the first concept sheet
  (`docs/heroes/moba_concept_sheet.png`).
- Built as variants next to the current models (`CONCEPT = True`; classes `ForgeConcept` and `StormConcept`; builder
  names `forge_c` and `storm_c`). Files: `forge_c_v2.glb` (40.3k triangles, 494 KB) and `storm_c_v2.glb` (34.4k,
  437 KB). See them in game with `?figs=v2c`; `?figs=v2` still shows the current shapes.
  - Brannoc: an inverted-triangle torso; the head sunk between the shoulders; smoking chimney stacks on the
    shoulders instead of round pauldrons; fists 1.3× bigger; a welding mask with one glowing slit.
  - Kaia: a bigger head with bigger eyes; a thundercloud of hair fused into one mass instead of spikes; the staff
    0.45 m taller with three prongs round a bigger orb.
- Sheet: `docs/heroes/moba_v2_concept_shapes.jpg`. Waiting on the user: keep the concept shapes, the current ones,
  or a mix.

**Sculpted trial, refine pass on Brannoc and Kaia (2026-11-02, committed `0ed55d1`)**
- The user's choice: keep the sculpted look on these two only for now and keep experimenting with them.
- Smoother faces: the head is fused on its own, finer than the body (`FUSE` entries with `("only", ...)` part
  prefixes). The face is remeshed to even quads with QuadriFlow; where QuadriFlow refuses a mesh, the code falls back
  to decimate plus a light relax. Decimate alone left visible facets on Kaia's small face.
- Fused Brannoc's beard and moustache into one mass, and each of Kaia's cloud shoulders into one puff.
- Kaia's mouth is shrink-wrapped onto the fused face (`WRAP`).
- Coloured paint (`PAINT` tints in `sculpt.paint`):
  - shadows lean violet; skin gets warm shadows plus a blush on the nose, cheeks, ears and knuckles;
  - Kaia's hair turns cyan toward the spike tips;
  - edge light is averaged over neighbouring vertices.
- Triangle budget (`CAPS`, collapse decimate on merged meshes): Brannoc 51k → 38.5k (479 KB), Kaia 60k → 33.2k
  (427 KB). This is about 35k, my own target for phones, not the user's.
- Checked in the game with `?figs=v2`: face, walk, attack (swing) and cast (raise) poses, with no tearing at the
  shoulders or elbows. Sheet: `docs/heroes/moba_v2_sculpt2.jpg`.

**Sculpted and painted trial: Brannoc and Kaia (2026-11-02, committed `0ed55d1`)**
- Code: [blender/heroes/sculpt.py](../blender/heroes/sculpt.py). A figure class with `SCULPT = True` lists `FUSE`
  groups and `FOLDS`.
  - `fuse`: melts one material's parts into one surface (voxel remesh, a volume-preserving smooth, decimate) and
    transfers the bone weights from the original parts. This covers skin plus added muscle and face shapes, and
    Kaia's coat body.
  - `folds`: presses cloth folds into open skirts.
  - `paint`: bakes a painted look into vertex colours (exported as glTF COLOR_0): ambient occlusion, light on edges,
    darker feet and a lighter head, and light from above.
- Checked in the game with `?figs=v2`: the painted shading reaches 11/13 and 12/14 meshes (emissive ones are left
  unpainted), and the walk and game camera look right. Sheet: `docs/heroes/moba_v2_sculpt.jpg`.
- Heavy: Brannoc 51k triangles (619 KB), Kaia 60k (709 KB). Needs a budget pass before more heroes use it.
- The other four v2 heroes still use the non-sculpted build.

**MOBA-style redesign trial: six heroes (2026-11-02, committed `0ed55d1`)**
- Added Vesper (`blood_v2.glb`, 19k triangles), Isolde (`frost_v2.glb`, 17k), Zephyr (`sky_v2.glb`, 19k) and
  Oblivion (`void_v2.glb`, 24k), each with one signature shape:
  - Vesper: a collar-blade fan and a crimson cape;
  - Isolde: an ice-shard halo and an ice spear;
  - Zephyr: a long scarf and a curved blade;
  - Oblivion: a horned helm with an eye slit, a void greatsword and a tattered cape.
- Shared parts (legs, arms, eyes, bell skirts, capes on sway chains) are helpers on `MobaFigure`.
- All six load with every bone found and `robe` 0. Sheet: `docs/heroes/moba_v2_six.jpg`. Zephyr's scarf was
  lowered after that sheet was made.
- When re-exporting, the browser can keep serving the old GLB: reload it with `fetch(url, {cache: 'reload'})`.
- Refinement pass:
  - Joints: `joints_fill` adds a neck column and balls at the shoulders, elbows, wrists, hips and knees, each blended
    between its two bones. Limb skin weights use a softer falloff (`power=3.5`), so a bent joint curves instead of
    creasing.
  - Heads: `head_shape` makes one smooth skull with a chin. `face` adds a nose and a curved mouth. `mitten` builds
    hands with a thumb and knuckles.
  - Per hero:
    - Brannoc: moustache curls, cheeks, hair at the back and a topknot, a forge backpack with chimneys, and an apron
      edge, pocket and tongs.
    - Kaia: pointed bangs and a bolt on the back.
    - Vesper: a gold V neckline and lacing.
    - Isolde: frost flakes on the skirt and the sash tied at the back.
    - Zephyr: shin wraps that sit tight on the leg, a strap buckle and a coat edge.
    - Oblivion: lighter plates against dark under-layers, tasset plates and rift veins.
  - Triangle counts went up: Brannoc 48k, Kaia 40k, Oblivion 37k, the others about 28k (the old models are about
    26k). Not checked on a phone.
  - Sheets: `docs/heroes/moba_v2_faces.jpg` and `moba_v2_refined.jpg`.
- New figures built from scratch in [blender/heroes/moba_figures.py](../blender/heroes/moba_figures.py):
  - each has its own joint positions on the game's 16 bones;
  - sway chains: Brannoc's beard braid, Kaia's coat tails.
- Exports: `public/models/heroes/forge_v2.glb` (30k triangles, 229 KB) and `storm_v2.glb` (31k triangles, 223 KB).
- Smoothed: the shape wrappers in `moba_figures.py` give large parts about 1.6x the segments round the curve and
  boxes a four-step bevel, while small parts keep their own resolution. Subdividing every part was tried and dropped:
  it shrank the thin parts. In-game sheet: `docs/heroes/moba_v2_smooth.jpg`.
- They show only with `?figs=v2` in the URL (`MODELS_V2` in `src/heroes.ts`). Without it the game is unchanged.
- Concept and comparison sheets:
  - `docs/heroes/moba_concept_sheet.png`: follows the silhouette, value and colour rules from the Dota 2 and League
    art guides;
  - `docs/heroes/moba_v2_compare.jpg`.
- Checked in the vfx tool:
  - all 16 bones are found and `robe` is 0;
  - the walk, standing pose and high game camera look right;
  - tsc is clean.
- Not checked: casts and attacks on the new bodies, a full duel, and the phone.
- Also from the style experiments (committed in `0ed55d1`):
  - `blender/heroes/stylize.py` (proportion styles);
  - the `style` option and prop tagging in `hero_figures.py`;
  - the live models are not affected.

**Livelier walk and idle (2026-11-02, committed `0ed55d1`)**
- Changed only `src/heroFigure.ts` and `src/effects/weapons/hero.ts` (`Hero.robe`), plus the walk and robe notes in
  [hero-mode.md](architecture/hero-mode.md). These are kept separate from the phone files, so the two can be committed apart.
- Added:
  - feet that roll (heel strike, toe push-off);
  - the knee taking the weight;
  - a walk-to-jog blend by speed;
  - arms with a bigger swing and the elbows following through;
  - a head that stays level;
  - backpedal and side-step legs (side-stepping legs never cross), and shuffling when turning on the spot;
  - a chest that rocks on start and stop, and arms that swing on through on a stop;
  - idle weight on one leg, a light bounce for agile heroes, and fidgets every 4-9 s.
- Robed heroes (18 of 20, measured from the mesh) take shorter, flatter steps with the leading knee bent, so the shin
  stays inside the hem.
- Checked in the vfx tool by stepping frames:
  - contact sheets of Brannoc (trousers) and of Kaia, Isolde and Marin (robes), with the robes compared against the
    previous walk;
  - all 20 heroes at two stride points on the final code;
  - side-steps in a duel (the AI strafes while facing its target; about 12% of walking frames are strongly sideways),
    where each leg now steps out to its own side and never crosses;
  - the high game camera;
  - a stop, a 180° turn and idle fidgets;
  - a 30 s AI duel with no broken values;
  - tsc clean.
- Known: a robe's lining still shows on the long step, and a toe can poke out behind the hem. Both happened with the
  previous walk too, because the robes are skinned to the thighs.

**Phone play (2026-11-02, committed `0ed55d1`)**
- Touch controls in `src/touch.ts` + `HeroMode` (`TouchTarget`, `buildTouchHud`): joystick lower-left, tap to walk /
  attack, spell buttons in an arc (tap = cast at the nearest enemy, drag = aim, drag back = cancel), attack button,
  pinch zoom. Camera pulls back on tall screens and leads toward the joystick. Duel bar, Forfeit, Find match row and
  queue bar fit a 375 px phone; game.html blocks page zoom and touch scrolling. Docs: hero-mode.md "Touch controls".
- Checked in the browser pane (mobile preset, synthetic touch events): joystick walks toward the enemy in a real
  online match (phone tab vs desktop tab) and the right way with the camera flip toggled by hand (the other seat's
  view), tap walks, spell tap / drag / cancel, attack button, joystick held while a spell is dragged and cast (two
  pointer ids; the cast fires, then the stick walks on), defeat card, portrait and landscape layouts, queue bar
  above the pinned Find match row, desktop layout unchanged. tsc, build and server smoke test pass.
- Not checked: a real phone (real multi-touch, iOS Safari safe areas, performance on a mid-range phone).

**Hero motion pass (2026-11-01, committed c7f2039, deployed 2026-11-01)**
- Pushed `c7f2039` to main and ran `npm run cf:deploy` (worker version 9707d9fa-ef2c-4091-80ca-05628e89c2d9), live at https://arena-of-kits.arenachamp.workers.dev. Showcase video `docs/heroes/duel_brannoc_vs_lyra.mp4` (20 MB, untracked): an AI duel stepped frame by frame with a close follow camera, frames posted to a local receiver and stitched with ffmpeg. Online peer figure motion is still not checked.
- Procedural animation on the shared hero rig, no clips (`src/heroFigure.ts`, rig additions in
  `src/effects/weapons/hero.ts`): idle (breath, weight shift, look round), speed-scaled walk with hip / chest
  counter-turn and leaning, a cast pose per spell type (thrust, point, slam, burst, raise, lunge, swing, channel; R
  bigger), basic-attack swings, hit flinch plus tinted flash, stun slump, knock-up flail, root tug, ice-block freeze,
  crumpling death, spring-driven hair / sashes / robes. Small camera shake on big hits to the player.
- Visual only: 30 AI fights after it averaged 20.8 s, no timeouts, no console errors. tsc, build and
  `npm run test:server` pass. Cost about 0.15 ms per figure per frame.
- Pose sheets: `docs/heroes/motion_{brannoc,nyx,lyra,isolde}.jpg` (Nyx's hit frame shows a slightly stronger flash than
  the final one); tool `pipeline/tools/pose-sheet.js`. Ice block checked in a duel: the pose stays frozen for 1.5 s.
- Not checked: the online peer's figure (its moves arrive in steps; the speed is smoothed for that).

**Next step candidates (game)**
- Commit and deploy the identity layer and the uniqueness pass (client and server together).
- Ada is the most likely to need a nerf (60-65% in every late run).
- A full tournament after the last Marin / Tempo fix; then per-hero balance passes with real players' feedback.
- Per-hero basic-attack looks and role traits (crit, every-third-shot, slowing or healing hits).
- AI: attack summoned units, not only the hero; re-check summon balance at the slower walk speed.
- Arena refinement round 2 if wanted; more Blender model upgrades like Oblivion v2.

## Done
- Vite + TypeScript + Three.js scaffold, exact versions pinned (three 0.186.1, vite 8.3.5, typescript 7.0.2).
- Particle mode: emitter with presets (fire, smoke, sparks, magic, snow), bloom + ACES tone mapping.
- Effect framework: `src/effects/types.ts` (`Effect`, `EffectModule` with `category` and `telegraphs`),
  `src/effects/common.ts` kit, registries in `src/effects/index.ts` and `src/spells/*/index.ts`. Effects are built
  lazily; a failing one shows its error in the overlay. Category dropdown: set pieces / paladin / iconic / original.
- **49 effects, all verified in the browser** (stepping the timeline via `window.vfx`):
  - Set pieces (8): divine sword, gate of babylon, meteor shower, shockwave punch, lightning strike, spiral sphere,
    energy beam, black hole.
  - Paladin (13): judgment, crusader strike, divine storm, wake of ashes, consecration, avenging wrath, divine shield,
    hammer of wrath, avenger's shield, hammer of justice, lay on hands, light of dawn, divine toll.
  - Iconic (20): fireball, pyroblast, frostbolt, blizzard, arcane missiles, chain lightning, chaos bolt, rain of fire,
    death coil, army of the dead, starfall, penance, earthquake, bladestorm, heroic leap, volley, eye beam,
    metamorphosis, spinning crane kick, deep breath.
  - Original from the user's names (4): corpse finger gravity pull, illusionist rain of doom, solar verdict,
    crown of the final star.
- **Refinement pass** (`docs/REFINE_BRIEF.md`, research in `docs/VFX_PRINCIPLES.md`) applied to every effect:
  3-stop colours, eroded wisps, size variance, dark normal-blended smoke/dust layers, GlowSphere flashes, staggered
  dissipation, soft sprites. Avenging wrath has two real wings now.
- **Emitter look options:** `colorMid`, `sizeJitter`, `erosion`, `spin`, `groundFade` (opt-in).
- **FinishPass** (`src/post.ts`): vignette, grain, chromatic aberration ∝ shake, impact-frame flash on shake jumps.
- **Danger zones + player dummy:**
  - `src/effects/telegraph.ts`: circle / ring / cone / line zones that fill as a countdown, flash on impact,
    optional lingering `until`. Every damaging effect declares `telegraphs(effect)`; heals/buffs have none.
    View → danger zones toggles them.
  - `src/player.ts`: blue player dummy (View → player dummy, WASD/arrows, camera-relative). Inside a zone at
    impact → HIT (flash + knockback), near but outside → DODGED; counts in the stats line.
- **Targeting + arena** (`src/effects/targeting.ts`, `src/arena.ts`): optional `EffectModule.targeting` and
  `Effect.cast(ctx)`. A shared caster and 1–10 clickable enemies (100 HP, damage numbers, knockback, death). Click
  an enemy (shift = add) or the ground to aim. View → Targets panel: enemy count, shuffle, clear selection.
- **Play mode** (P / View → play mode): WASD walks the caster, the camera follows, and mouse drag orbits. The hotbar
  (`src/hotbar.ts`) casts slots 1–5; click a slot name to assign any effect (localStorage). Non-targeted effects
  are moved onto the caster and turned toward the target (their own ground is hidden).
- **Pipeline `/forge-vfx`** (`.claude/skills/forge-vfx/SKILL.md`, brief `docs/TARGETED_SPELL_BRIEF.md`): design
  note → worker agents → register → `vfx.selfTest` → screenshots → `pipeline/forged.json`.
- **Recipe library** `pipeline/library/`: 54 pro VFX breakdowns (batch a: hero games, b: ARPG/MMO, c: artist
  breakdowns). `node pipeline/build-index.mjs` merges and validates. Most sources are wiki or overview pages, so the
  timings are estimates. Pro polish rules were added to `docs/VFX_PRINCIPLES.md` §6.
- **Targeted spells (4, browser-verified):** starbreaker lance (reference, enemy), glacial ricochet (enemies),
  cataclysm sigil (ground), abyssal gaze (enemy, channel).
- **Video tutorials → batch h** (`pipeline/library/batch-h.json`, 9 recipes, ids `h-…`): watched 7 YouTube
  tutorials in the built-in browser (full transcripts from the caption track + paused frames): onetupthree slash
  anatomy (basic/ember/frost variants) and mech explosion, Stylized Station Igni cone, Beyond-FX Zelda explosion,
  Gabriel Aguiar mesh smoke, Noggi anime wind streaks, Le Lu magic-circle textures. Techniques in
  `docs/VFX_PRINCIPLES.md` §11.
  - Incident: this batch was first written to `batch-g.json` and overwrote the other session's batch g (user
    reference videos). Moved to batch-h; the other session was asked to re-write its batch-g.json and re-run
    `build-index`.
- **Video tutorials, round 2 → batch j** (`pipeline/library/batch-j.json`, 6 recipes, ids `j-…`): Dan Root 2D
  lightning timing, CGHOW outlined stylised bolt, Gabriel Aguiar layered laser beam, A Bit Of Game Dev refraction
  bubble shield, Flex Unit swirl portal, Le Lu twisted wind tornado. Techniques in `docs/VFX_PRINCIPLES.md` §11b.
  `build-index` validates (116 recipes with a–h + j; the other session's batch i is not on disk yet).
- `vfx.selfTest(label)` also reports `singularFrames` (a zero-scale lit mesh → NaN normals → black bloomed frame).
- **User reference videos → library:** 21 videos broken down by frame (ffmpeg contact sheets) into batches d–g
  (47 recipes; the library now has 101). Their style rules are `docs/VFX_PRINCIPLES.md` §7–§10.
- **Parts kit** `src/effects/parts/` (usage example: `parts showcase`, category "parts kit"):
  - `ScreenFx` on `effect.screen`: world darken + grade, anime impact frames with flat silhouettes (mask render on
    layer 7 in main.ts), and focus lines (`src/post.ts`);
  - `StarBurst`, `CrescentArc` (soft / toon wind and slash strokes), `LightningArc` (thick, camera-facing,
    flicker), `SmokeBall` (toon black smoke → flakes).
- **Spells forged from the user's videos (browser-verified):** tempest lattice (John Kler lightning cage), gale
  bullet (seo wind bullet), cinder bow (Fuga), ember comet (html meteor).
- **Violet severance** (targeted, `enemy`, `src/spells/targeted/violetSeverance.ts`, design
  `pipeline/designs/violet-severance.md`), forged from `j-aguiar-layered-laser-beam` + `j-cghow-outlined-stylized-bolt`:
  a 3 s laser whose look is all shader layers (dark wide under-beam as an outline, scrolling streak core with
  end-fade + pinch + UV distortion, alpha-clipped electric copy). The beam cuts through the target and scorches
  the ground behind it; 10 ticks + a cut with impact frames. selfTest ok (11 hits, 1 zone, 0 NaN / singular),
  also after shuffle. One fix round: white only in the hottest centre, beam width 0.5, under-beam 2.1× core.
- The world-darken curve keeps bright mids (fire, glows) bright: `smoothstep(0.22, 0.6, lum)` in `src/post.ts`.
- `selfTest` now also renders during the timeline and reports shader compile errors.
- **YouTube study (batch i):** 14 videos studied frame by frame in the browser (view only) → 28 recipes, frame
  logs in `pipeline/frame-logs/youtube-i/`, rules in VFX_PRINCIPLES §12. The library has 144 recipes.
- **New screen parts** (ScreenFx): `flashBeat` (anti-flash → whiteout), `chromaPulse` + `edgeTint`,
  `desaturate` + `keepHue`, `crack` → `shatter`, impact modes 3 (X-ray card) and 4 (outline card).
- **Forged from batch i (browser-verified):** crimson requiem (Acheron), prism overture (Chromatic Opus), neon
  fracture jab (righteous X-ray punch). The sweep of all 71 effects passes.
- Fixed the zero-scale lit instances in 8 older effects (gate of babylon, meteor shower, black hole, pyroblast,
  frostbolt, earthquake, volley, metamorphosis): hidden instances use scale 1e-4. The sweep of all 54 effects passes.
- `npm run build` passes (only the >500 kB chunk warning).
- **Weapon models (5, Blender)** from `C:\projectG\weapons\`: dragon sword, ice sword, guandao, thunder hammer,
  fire fan → `public/models/weapons/*.glb` (14–30k tris, plain glTF, origin at the grip, head +Y in three).
  Build scripts `blender/weapons/` (`_wp.run("<id>")`), renders `docs/weapons/`, conventions + per-weapon VFX
  notes in `public/models/weapons/README.md`.
- **Weapon auras (5, browser-verified, category "weapons")** made with /forge-vfx from the user's Spiderlily
  reference: phoenix fan (reference, hand-written), frost lily sword, azure dragon sword, thunder drum hammer,
  green dragon crescent. Kit `src/effects/weapons/` (WeaponModel: GLB load + darken + fresnel rim; FlowRibbon;
  StarFlare; LilyBurst; PetalSwarm; PolylineSpawner; sockets), base `WeaponAura` + `weaponModule`, brief
  `docs/WEAPON_AURA_BRIEF.md`, designs in `pipeline/designs/`, entries in `pipeline/forged.json`. All selfTest ok
  (0 NaN / singular frames); idle loops of 4 s (hammer 3 s) with a one-time ignition.
- **Weapon attacks (5, browser-verified, category "weapon attacks")**: a rigged hero
  (`public/models/figures/hero.glb`, the Azure Cloud disciple copied from the Dao Archive, meshopt, scaled ×1.3)
  replaces the capsule caster, holds the weapon with its aura and attacks the arena enemies: azure dragon slash,
  frost lily thrust, green dragon sweep (enemies), thunder drum slam, phoenix gale (enemies, ranged). Framework
  `src/effects/weapons/hero.ts` (bone posing, calibrated hand grip) + `strike.ts` (key poses, dash, capsule
  hide/restore via the group's `visible`, hits, telegraph, close camera); `BladeTrail` in the kit. Design
  `pipeline/designs/weapon-attacks.md`. Verified: selfTest ok + after shuffle, mode switch restores the capsule,
  play mode (hero follows WASD, hotbar casts).

- **Art bible** `docs/ART_BIBLE.md` (2026-10-26): the target look (lacquer, gold, jade + hard anime light),
  material and per-element palettes with hex codes, shape language, reference set, the artist's workflow and
  self-critique list, and the taste calls made (§6, waiting on the user's yes/no). Linked from the forge-vfx skill,
  both briefs and the README. **Read it first in a new session.**

- **First art-bible batch (3 targeted spells, browser-verified, 1 art-review fix round each)**, designs in
  `pipeline/designs/`, review frames in `docs/spells/`:
  - **jade dragon ascension** (ground, jade qi row): a gold spark draws a sigil, a silk-ribbon dragon coils up to
    11 m, holds, dives head-first through the sigil; jade impact frames, ground plates, dust vortex. Second pass:
    the head is a drawn eastern-dragon profile (canvas texture: open jaw, fangs, gold eye that flares at the top,
    antlers, mane, beard, black outline, white brow edge); the body turns over for the dive.
  - **hundred lily frost** (enemies, frost row): crystal lily buds close round each enemy in order, bloom into
    cups, snap shut, then all shatter at once into petal-shaped shards.
  - **taiji thunder seal** (enemy, thunder row): a 7 m taiji seal tilted toward the caster spins up, freezes, drops
    one bolt with a black under-copy; ground discharge and toon smoke.
  - selfTest ok for all three (also after shuffle and with 10 enemies).

- **Art-bible batches 2 + 3 (18 targeted spells, all browser-verified, 0-2 art-review fix rounds each)**, designs in
  `pipeline/designs/`, one contact sheet per spell in `docs/spells/<slug>_sheet.jpg`:
  golden bell sutra (self), ink moon severance, vermilion phoenix dive, red lotus inferno, nine tail foxfire,
  paper crane blizzard, mirror ice prison, flying sword formation, thunder god drums, bamboo leaf gale,
  jade imperial seal, cloud step cyclone (self), heavenly buddha palm, golden halberd comet,
  ghost lantern procession, shadow puppet execution, spider lily soul field, taotie bronze maw.
  selfTest ok for all (0 NaN / singular frames, hits land; self-mode spells need enemies within the radius, so
  test them with the caster moved into the pack, e.g. `vfx.arena.caster.group.position.set(0,0,-1)`).
- **Reliable frame capture when the browser pane is hidden:** screenshots of a hidden pane show stale frames. Render
  frames inside the page and copy the WebGL canvas into a 2D contact sheet in the same task (paste
  `pipeline/tools/contact-sheet.js` into the page, return `'NAME:<slug>|' + _sheet(times, cam)`; the tool saves the
  large result to a file; decode it with `python pipeline/tools/decode-sheets.py <result.txt> docs/spells`).

- **Tinted arena hit flash** (2026-10-26): `ctx.hit` no longer flashes enemies bloomed white. `Enemy.setFlash(v, tint)`
  in `src/effects/common.ts` takes an optional tint (peak 0.45 x the colour, below the bloom threshold); the arena
  passes the hit's `color` (else warm orange, gold for big hits). Calls without a tint (older set pieces) keep the
  old white flash. Before/after check: `docs/spells/hit-flash-after_sheet.jpg`.

- **Open-theme batch (11 targeted spells incl. a 60 s cutscene, browser-verified via contact sheets, 0-2 fix rounds
  each)** after the user asked for "not xianxia, anything, even a 2 min cutscene" (art bible theme opened, §1/§6):
  clockwork judgement, supernova seed, kraken grasp, bifrost strike (Norse), sun disk of ra (Egypt), glitch purge,
  thornwood bloom, titan fist, jellyfish bloom, checkmate, and **genesis collapse** (~60 s cinematic ultimate:
  ascend → orbit → forge a star → hurl it → impact seen from orbit → aftermath). Sheets in
  `docs/spells/<slug>_sheet.jpg`; designs in `pipeline/designs/`.
- **Cinematic camera part** `src/effects/parts/cinematic.ts` (`createCinematic`, `sampleShots` with keyed shots, cuts,
  easing, fov, roll; letterbox bars drawn into the canvas): optional `Effect.cinematic`; main.ts renders through it
  while `active` and restores the orbit camera after each frame.

- **Open-theme batch 2 (11 targeted spells incl. a 45 s cutscene, browser-verified via contact sheets, 0-1 fix
  rounds each):** orbital lance (sci-fi), stained glass sanctum (gothic), hellfire chains (infernal), murder of crows
  (gothic horror), great wave (woodblock print), tarot judgement (occult), mammoth stampede (ice age), tesla coil
  field (steampunk), sandstorm djinn (desert, self), aurora veil (polar), and **colossus drop** (~45 s mecha
  cutscene: drop from orbit, landing, cannon charge, beam sweep, exit). Sheets in `docs/spells/<slug>_sheet.jpg`.

- **Stage upgrade (2026-10-28)** lifting every effect at once: canvas-drawn stone-slab ground with radial
  darkening (`createGround` in `src/effects/common.ts`), a gradient night-sky dome with stars and a horizon glow,
  distance fog (both off while an effect's cinematic camera runs), soft shadows from the sun on figures, a cool rim
  light, FXAA at the end of the post chain, grid off by default. Figures (`Enemy`) are now hooded robed figures with
  curved horns, a bone mask and glowing eye slits (caster: gold robe, mantle, circlet), same footprint and API
  (`material` + new `trim`, both driven by `setFlash`). All 111 registered effects pass `selfTest`; both cutscenes
  re-checked. Before/after: `docs/spells/stage/before-after_sheet.jpg`.

- **Screen distortion (2026-10-28):** `src/effects/parts/distortion.ts` (`HeatHaze`, `ShockRefraction`, `DISTORT_LAYER`)
  plus a distortion pass in `src/main.ts` (a half-res float buffer of UV offsets, bent before bloom, with a slight
  RGB split; skipped when nothing is on the layer). Fix found on the way: `ShaderPass` clones uniforms, so the buffer
  texture is re-linked after construction. Added to 15 big spells (red lotus, titan fist, phoenix dive, supernova,
  hellfire chains, colossus, clockwork, orbital lance, halberd comet, genesis, tesla, thunder drums, golden bell,
  jade seal, taiji seal); all 15 pass `selfTest`. Before/after: `docs/spells/stage/distort-before-after_sheet.jpg`.

- **Hero batch (2026-10-28), a higher bar:** three new effects, each through 2-3 contact-sheet review rounds:
  **event horizon** (a black hole with a live gravitational lens, an accretion disk, enemies dragged in and
  stretched, a freeze, then a collapse), **hyperion railgun** (an ~8.5 s cutscene: a rail cannon assembles,
  copper coils charge with heat haze, one hypersonic shot with a refraction tunnel and a muzzle shock, then it
  disassembles) and **leviathan breach** (an ~11 s cutscene: a sea dragon erupts from a whirlpool, arcs over the
  arena, a head close-up, a dive into a water crown splash). Designs in `pipeline/designs/event-horizon.md`,
  `hyperion-railgun.md`, `leviathan-breach.md`; sheets in `docs/spells/<slug>_sheet.jpg`. 114 effects registered;
  the full `selfTest` sweep passes except the known corpse-finger item below.
- **Cinematic hero batch (2026-10-28):** three fully cinematic hero effects (every second a placed shot,
  letterbox, explicit cameras), each through 2-3 contact-sheet review rounds: **ghost galleon broadside**
  (~24 s: a spectral galleon sails out of a fog bank, two rippling broadsides of ghost-fire cannonballs, sinks into
  the stone like water), **ophanim descent** (~22 s: three bronze wheels covered in eyes descend through a cloud
  hole, all eyes open, wings unfold, a cascade of eye beams and a converged final beam) and **caldera awakening**
  (~22 s: a stamp, a racing crack, a basalt volcano grows from the floor, a lava fountain, lava bombs, lava rivers
  and an ash cloud). Designs in `pipeline/designs/ghost-galleon-broadside.md`, `ophanim-descent.md`,
  `caldera-awakening.md`; sheets `docs/spells/ghost-galleon_sheet.jpg`, `ophanim_sheet.jpg`, `caldera_sheet.jpg`.
  117 effects registered; the full `selfTest` sweep passes.
- **Seven more cinematic heroes (2026-10-28):** **lunar tide** (the moon rises huge, lifts the enemies, cracks and
  drops a shard), **thousand-cut iaido** (time-stop to greyscale, a dash between enemies with afterimages, the
  sheath click, then every cut appears at once), **abyssal angler** (the arena sinks into the deep sea, a lure, a
  silhouette reveal, the jaws snap), **world tree rising** (a colossal tree grows from a seed, roots coil the enemies,
  fruit falls, autumn), **supercell** (a wall cloud, a tornado lifts the enemies, a bolt down the funnel, hail),
  **hourglass of ages** (a brass hourglass traps the enemies in sand, time reverses, the glass shatters) and
  **midnight circus** (a big top rises, the lights go down, spotlights, a jack-in-the-box lunges, confetti and a
  curtain). Each went through 2-4 contact-sheet review rounds. Designs in `pipeline/designs/<slug>.md`, sheets in
  `docs/spells/` (lunar-tide, iaido, angler, world-tree, supercell, hourglass, midnight-circus). 124 effects
  registered; the full `selfTest` sweep passes. One real bug found and fixed on the way: a GLSL variable named
  `flat` (reserved) broke Lunar Tide's moon-glow shader on first compile.
- **Blood hero kit (Vesper, the Crimson Countess)**, the first four-spell hero kit, MOBA style (user: Q/W/E are
  normal abilities, R is the ultimate, all under the gameplay camera). Kit sheet `pipeline/designs/blood-kit.md`
  (palette, shapes, materials, timings), new art-bible palette row "Blood" (foil: bone). Shared parts in
  `src/effects/parts/blood.ts`: `BLOOD`/`BLOOD_CSS`, `BloodTendril`, `BloodDrops` (+`BloodSplats`), `BloodPool`,
  `BloodThorns` (`shatter(perSpike, speed, life)`), `BloodSigil` (`inner: false` hides the centre marks).
  Spells (category `hero: blood`): **hemolance** (Q, `enemy`, hit 0.55 s), **thorn garden** (W, `ground` 4.5,
  hit 0.75 s), **crimson pact** (E, `self` 6, two heartbeats, loopable), **sanguine eclipse** (R, `ground` 7,
  bleeding moon, blood sphere freezes into a thorn-star, hit 2.4 s, 4.5 s total). 2-3 contact-sheet rounds each;
  sheets in `docs/spells/` (hemolance, thorn-garden, crimson-pact, sanguine-eclipse). 128 effects registered;
  the full `selfTest` sweep passes.
- **Hero balance pass**: spell damage and cooldowns tuned with AI vs AI tournaments (`pipeline/tools/duel-tourney.js`,
  `_tourney(5)` = 100 fights). Win rates over 200 fights: Vesper 57%, Brannoc 53%, Lyra 48%, Isolde 46%, Vex 46%
  (before: 88 / 67 / 8 / 50 / 38). Starshot's first hit moved 0.75 → 0.52 s. Numbers in `docs/catalog/heroes/README.md`.
- **Play / run duel** (user 2026-10-29): **play duel (B)** you vs the AI, **run duel (N)** AI vs AI with a ring
  camera and a "<HERO> WINS" card. Both sides share the AI (`pickSpell`, `steer`; the player's hero through hero
  mode's `autoCast` with `spectate` and `focus`), and both sides dodge (arena `hitFilter` checks the opponent
  against the player's recent cast zones). All 20 matchups × 3 runs (AI vs AI, by stepping): Vesper 21/24 wins,
  Brannoc 16/24, Isolde 12/24, Vex 9/24, Lyra 2/24; no timeouts; fights 15–43 s. Lyra is far behind (her AI holds
  ~8.4 away, so Orbit Veil never fires, and Starshot's 45 damage is meant for three targets).
- **1v1 duel** (B, or View → duel; `src/duel.ts`, `src/heroFigure.ts`): the hero vs an AI hero of another kit in a
  ring (radius 12, gold rim). 600 HP each, HUD bars with portraits, the opponent's spells via `castAs` (one-shot
  context override, lingering) with their own danger zones, impact-time dodge check (DODGED), AI (distance, strafe,
  R/E/W/Q priority, rooted to impact), VICTORY / DEFEAT card, rematch, opponent picker. Arena gained `maxHp`,
  `bounds`/`keepInside`, `moveFoe`, `placeFoe`, `hpOf`, `contextFor`, public `say`. Verified by stepping: AI casts
  and damages, standing still in Anvil Drop costs 65 while walking out shows DODGED and costs 0, defeat after
  17.6 s idle, victory card, old-round hits ignored. Sweep 144/144. Screenshot `docs/heroes/duel.jpg`.
- **Documentation knowledge base** (user 2026-10-29: "rewrite the whole thing like docs"): `docs/README.md` (home,
  map of content), `guide/using-the-tool.md`, `architecture/` (overview, effects-and-parts, targeting-and-arena,
  hero-mode, models), `pipeline/` (workflow, review-tools), `catalog/` (effects.md: all 144 by category with links;
  `heroes/` roster + one page per hero), `knowledge/` (lessons, glossary). Existing docs (art bible, principles,
  briefs, status) stay at their paths (the skill and the design notes link them) and are part of the map. Front
  matter on every new page, relative links only (784 links checked). Root README rewritten as a short front door.
- **Four more hero kits + hero models** (user 2026-10-29): forge (Brannoc, the Ashen Smith: rivet shot, anvil drop,
  bellows ward, forgefall), frost (Isolde, the Winter Warden: rime spear, frostfern field, glacial mantle, winter's
  crown), astral (Lyra, the Star Archer: starshot, constellation snare, orbit veil, celestial hunt), alchemy (Vex, the
  Plague Alchemist: volatile flask, caustic pool, mutagen, grand transmutation). Shared rules
  `pipeline/designs/kit-common.md`, sheets `pipeline/designs/kit-<theme>.md`, parts `src/effects/parts/<theme>.ts`,
  kit data `src/kits/<theme>.ts`, categories `hero: <theme>`. Every spell reviewed in 2 rounds (sheets in
  `docs/spells/`, incl. the multi-spell `_multi` helper now in `pipeline/tools/contact-sheet.js`). Hero switcher (View
  → hero, or click the portrait). Hero models: hand-drawn concept `docs/heroes/lineup_concept.svg`, rigged figures from
  `blender/heroes/hero_figures.py` in `public/models/heroes/`, shown in hero mode with walk / breath / cast poses
  (`docs/heroes/ingame_sheet.jpg`). 144 effects registered; the full `selfTest` sweep passes (names from `vfx.slots`).
- **Hero mode (H, or View → hero mode)**: a MOBA-style test of a hero kit on top of play mode. Click (or
  right-click) the ground to walk there; Q/W/E/R aim (range ring at the hero, a strip to the hovered enemy for
  single-target spells, the area circle at the cursor clamped to range for ground spells), click casts, right-click
  / Esc / the same key cancels; self spells (Crimson Pact) cast at once. An enemy out of range: the hero walks into
  range, then casts. Rooted until the spell's impact (from its danger zones). HUD: portrait and name, four slots with
  canvas icons, key badges, cooldown sweep and seconds, tooltips; R is the gold ultimate slot. Fixed top-down follow
  camera, wheel zoom. Enemies keep HP between casts and respawn 4 s after dying. Kits are data in `src/heroes.ts`
  (blood kit: Q hemolance r11 cd2.5, W thorn garden r10 cd6, E crimson pact self cd9, R sanguine eclipse r13 cd20);
  code in `src/heroMode.ts`, Arena got `setTarget`, `setGroundPoint`, `liveFoes`, `pickEnabled`, `persist`.
  Verified by driving it in the browser (move, aim, cast each slot, kills and respawn); screenshots
  `docs/spells/hero-mode_aim.jpg`, `docs/spells/hero-mode_ult.jpg`. Sweep still 128/128.
  Spells overlap: in hero mode an earlier cast that is still playing when a new spell is cast keeps updating and
  drawing until it ends (`lingering` in `main.ts`); shake is the max over live effects, distortion covers all of
  them, and one screen-feedback state is picked per frame (`pickScreen`). Editor and play mode still play one
  effect at a time. Verified W then Q 0.3 s apart: both visible, both hit (50 and 60), Thorn Garden dropped when it
  ended. Fresh sweep 128/128.

- **Multiplayer duel game "Arena of Kits" (2026-10-29)** at `/game.html` (editor unchanged at `/`): login /
  register (local accounts, scrypt, `server/data/accounts.json`, git-ignored), main menu, heroes overview (kits, spells,
  icons, portraits, turning model), profile (wins, losses, matches, win rate, favourite hero, per-hero table, last 20
  matches), lobbies (create / join by code or list, pick heroes, the other seat's hero greyed, ready up) and a
  matchmaking queue that pairs two different heroes. Network matches run in the duel ring (`Duel.startNet`); server
  referee (HP, winner, stats), each client owns its hero and the hits it takes. Server `server/game-server.mjs` on
  `/ws`, attached to Vite by a plugin (`npm run dev`) or standalone (`npm run build && npm run game:server`, port
  8787). New dependency `ws` 8.18.3. Docs: `docs/architecture/multiplayer.md`.
  - Verified: `npm run test:server` (20 checks); two built-in-browser tabs on the built page with real input events:
    queue match (22.6 s), lobby match in the ring with cover (24.5 s), dodges on both screens, knockback replicated,
    disconnect = forfeit, session resume, Back to menu, profile. `tsc --noEmit` clean; selfTest sweep 156/156 ok.
  - Background tabs keep simulating in game mode (a timer steps the scene when no frame came for 250 ms).
- **Best-of-3 rounds online + server checks (2026-10-30, user request; committed `484d7fd` and deployed the same day):**
  `server/hub.mjs` runs rounds (first to two; 60 s cap, more HP share wins, a tie replays; 3 s break; `round_end` /
  `round_start`), per-hero max HP from `match_loaded { maxHp }` (was a flat 600 for everyone), and accepts a hit only
  for a cast the other side made in the last 12 s, with one cast per slot per 0.8 s (R: 10 s). Client:
  `MatchController.beginRound` re-runs `startNet` each round (each round in its own arena), `Duel.netRoundEnd`
  shows the round banner, the card shows "2-1 in rounds". Smoke test 26/26 on Node and on the local Cloudflare runtime (`wrangler dev`, twice; the test's lobby step had an
  ordering race between two sockets, now fixed) (three rounds 2-1, the 740 HP hero, an
  unknown cast's hit and a too-fast Q dropped); built page vs a scripted player: a full 2-1 match in 41.9 s with
  the round banners, the final card and its own arena seed per round (rounds 1 and 3 landed in Sky Ruins and
  Verdant Glade), no console errors. A time-up tie replayed the round (seen by accident); a time-up win on HP share
  is not tested yet. `match_start.hp` is now unused (the max comes from `match_loaded`).
  Commit together with the kit redesign: `src/duel.ts` and `src/game/match.ts` also carry that session's uncommitted work. Research behind it:
  docs/research/moba-design.md, docs/research/game-networking.md.
- **Waiting: online sync of statuses, shields, summons and skillshots (Stage 1).** The hero-roles session confirmed
  (2026-10-30) the sync inputs stay the same (`HitOptions.status/pull`, `ctx.shieldSelf/healSelf/moveCaster/
  projectile/summon`), now used by all 20 heroes; the peer must also get the caster's yaw (facing-aimed `self`
  spells), Tempo Q's return to the caster's live spot, Vesper E's tether, and traps/zones that hit up to 4.2 s
  later. The uncommitted `src/duel.ts`, `src/arena.ts`, `src/main.ts`, `src/game/match.ts` edits besides mine
  belong to the arena session (five duel arenas), not the hero-roles session.
  Basic attacks (Project Game Artist, `src/attacks/`, docs/architecture/attacks.md) are off online
  (`hm.attacksEnabled = false` in `startNet`); the sync needs its own `attack` message (attacker, target, damage;
  it homes in, no dodge), not a spell slot. Skillshots still show nothing online: a hero whose Q is a line spell (Lyra, Isolde) can't hurt
  anyone with it in a network duel.
- **MOBA-slow walking (2026-10-30, user choice):** hero `HERO_SPEED` 8 → 4 m/s (`src/heroMode.ts`), duel AI and
  autopilot `AI_SPEED` 6 → 3.5 (`src/duel.ts`). Six AI duels still finish in 19-25 s (before: 17-24 s). Melee
  summons walk 3.6 m/s, close to a hero now: re-check summon balance. Not deployed (freeze).
- **Smooth online movement (2026-10-30, user request, not deployed: freeze):** the opponent is drawn 100 ms behind
  between timestamped reports instead of chasing the newest one (`Duel.peerMove` / `netFollow`), moves go out at
  20 Hz with the sender's clock (`move.ts`, relayed in `peer_move`), casts no longer snap the caster, a toast warns
  when a match tab is hidden, and `game.html?lag=120&jitter=40` simulates lag. Frame-to-frame speed change of a
  walking opponent 1.42 → 0.54 m/s RMS under 120 ± 40 ms test lag; smoke test 20/20, tsc clean.
  docs/architecture/multiplayer.md#smooth-movement.
- **Cloudflare deployment (2026-10-29; live since 2026-10-30 at https://arena-of-kits.arenachamp.workers.dev):** the server core is runtime-free (`server/hub.mjs`,
  accounts with a pluggable store and PBKDF2), hosted by Node (`server/game-server.mjs`) or by a Cloudflare Worker +
  SQLite Durable Object (`worker/index.mjs`, `wrangler.jsonc`, wrangler 4.150.0 pinned). `npm run cf:dev` (local,
  8788) passed the smoke test, a two-tab match and a restart. Deployed with `npm run cf:deploy` (workers.dev
  subdomain `arenachamp`); page and game socket answer.
  **Deploy freeze (user, 2026-10-30): do not run `npm run cf:deploy` / `wrangler deploy` until the user says so.**
- **Duel ring cover + line of sight (2026-10-29, user request):** centre wall, four pillars, two side walls
  (`src/obstacles.ts`, `DUEL_OBSTACLES`) in both the AI duel and the network duel. They block walking (push-out +
  sliding round edges) and sight; targeted spells need sight of their target (hero mode: toast "No line of sight",
  walks round, then casts; the AI only picks spells it can see with). AI duels still finish (17-24 s).

## In progress
- Nothing running (2026-11-03). Next: v4 batch 2. Side sessions: the multiplayer shell one is idle; the older kit
  one ("Make the 20 hero kits play differently", `68f976c` and `4f39f41`, since replaced by v3 and v4) is idle; the user
  chose to leave it.
- **Hero roles, committed `68f976c` + `4f39f41`** (user 2026-10-30: "all heroes seem kinda the same ... should be different, like competitive").
  Proposal `pipeline/designs/hero-roles.md`: a role and signature per hero (assassin, tank, juggernaut, mage, marksman,
  support, controller, summoner) and, after the user rejected the old Q/W/E/R template (revision 2), its own kit shape
  per hero (dash, skillshot, hook, trap, buff, summon, lingering field, execute, line, self-centred ultimate); about
  32 shape changes (T3) plus ~25 status/shield/heal fields. **Approved 2026-10-30**, plus revision 3 (user: "invent new
  types of spells"): QUICK no-aim casts, NOVA, ORBIT, BOOMERANG, CHANNEL, GLOBAL, TRAIL. Building with 3 workers (brief:
  side-session-notes `hero-roles-worker-brief.md`): A assassins + marksmen, B mages + tank/juggernauts, C supports,
  controllers, summoners. All 20 kits built; tsc clean; selfTest of the 80 hero spells: no errors, no NaN frames;
  contact sheets checked, fixes done (Nyx R scaled to r 2.5, Opaline channel beam, Kaia nova ring, Fenna blossom
  turret, Auriel blades). Tournaments run on a static build (`tourney-preview` in launch.json, port 5181, outDir in
  the session scratchpad) because the arena session's edits reload the dev page. First run (3 reps): Vesper 100%
  (heal on dodged hits), Fenna 84, Sefu/Auriel/Marin 75 ... Oblivion 13, Brannoc 17, Sirix 22. Balance round 1
  applied (Vesper heal only on a landed lance, drain heals half; sustain down; melee up). Round 2 (3 reps) 38-63%,
  round 3 small tweaks, final `_tourney(4)` (1520 fights, 0 timeouts, avg 29 s): Vesper 51, Brannoc 59, Isolde 46,
  Lyra 48, Vex 55, Kaia 41, Sefu 51, Nyx 55, Fenna 44, Auriel 49, Marin 49, Zephyr 52, Mortis 53, Ada 49, Sirix 45,
  Cantor 41, Opaline 51, Oblivion 45, Shiori 61, Tempo 55; then Brushstroke 58 -> 54 for Shiori; her
  re-check (152 fights, both sides, 4 each): 41%. Every hero is inside 40-60%.
  Balance edits are scripted (session scratchpad `balance.py` + `round*.json`). Docs: hero-roles.md "As built",
  kit-common.md "Roles and spell shapes" + "Role budget", mechanics.md "Spell shapes", heroes README roles table,
  20 hero pages, kit sheets' "Role (2026-10-30)" sections (their numbers are the pre-balance ones). Nothing committed.
  Online duels still ignore the mechanics (multiplayer session is adding the sync; told it what the new shapes need).
  Final checks: tsc clean; selfTest sweep of all 80 hero spells on the final build passes (0 errors, 0 NaN/singular
  frames). Player-side QUICK test: `arena.context` turns the caster to the nearest enemy within a self spell's radius,
  so Nyx E / Opaline R fire at the nearest enemy in reach; with nobody in reach they fire toward -z (one-line fix in
  arena.ts, owned by the arena session; follow-up). The temporary preview configs were removed from launch.json.
  **Committed `68f976c`** (my files only; STATUS.md left uncommitted because it carries other sessions' lines).
  Caveat: basic attacks (`63c232d`, Project Game Artist) reached the duel AI after the final `_tourney(4)` build, so
  those win rates were measured without them (Shiori's re-check had them). Next: re-run `_tourney(4)` with basic
  attacks and retune if anyone leaves 40-60%.
  **Re-checked with basic attacks (2026-10-30):** first run 32-88% (Brannoc 88, Zephyr 65, Tempo 63; Shiori 32,
  Mortis 36, Lyra/Vex 39; fights 29 s -> 22 s). Three retune rounds (scratchpad `round5-7.json`): final `_tourney(4)`
  (1520 fights, 0 timeouts): Vesper 51, Brannoc 63 -> 47 after HP 800 -> 780 + Forgefall 98 -> 92 (his re-check, 152
  fights), Isolde 51, Lyra 49, Vex 48, Kaia 57, Sefu 47, Nyx 43, Fenna 52, Auriel 51, Marin 47, Zephyr 57, Mortis 42,
  Ada 42, Sirix 53, Cantor 44, Opaline 54, Oblivion 51, Shiori 48, Tempo 50. All 40-60%. **Committed `4f39f41`.**
  Baseline (`_tourney(4)`, cover + halved walk speed): 21–64%; skillshot heroes fell (Opaline 21, Shiori 24, Sirix 26,
  Tempo 27, Ada 30), template heroes rose (Brannoc, Marin 64). Numbers in the proposal file.
- **15 more heroes** (user 2026-10-29), five waves of three; same pipeline as the four kits (kit sheet → worker →
  2 review rounds → model → register → sweep → tournament). Balance budget now in `pipeline/designs/kit-common.md`.
  - Wave 1 DONE: storm (Kaia), sand (Sefu), shadow (Nyx). Kits built, reviewed (sand 1 round; storm, shadow 2),
    registered; concept `docs/heroes/wave1_concept.svg/.jpg`; models exported (`storm/sand/shadow.glb`); tournament
    with 8 heroes × 3 (168 fights): 38–60% each, no outliers (Isolde and Sefu lowest at 38%).
  - Wave 2 DONE: grove (Fenna), dawn (Auriel), tide (Marin). Kits built, reviewed (grove, dawn 2 rounds; tide 4,
    the serpent ultimate needed framing work), registered; concept `docs/heroes/wave2_concept.svg/.jpg`; models
    `grove/dawn/tide.glb`; full sweep 168/168 (only the known corpse-finger long-run quirk). Tournament, each new
    hero × 10 opponents × 5 × both sides: Auriel 58%, Marin 54%, Fenna 47%, after balance tweaks (Auriel and Marin
    Q range 11 → 10, Fenna Verdant Ward 13 → 15 per pulse, Bloom Lash knock 1 → 3). Docs: hero pages, catalog,
    parts page, art bible palettes, forged.json (123 entries).
    `duel-tourney.js` now yields through a MessageChannel: the hidden pane throttled its `setTimeout` waits to ~1/min.
    A run longer than 45 s must be started without awaiting it (push results to a window array, read it later).
  - Wave 3 DONE (first kits on the combat mechanics): sky (Zephyr, melee: dash, knock-ups, shield), bone (Mortis,
    summoner: pierce skillshot, skeletons, archers), clockwork (Ada, ranged control: bouncing skillshot + slow, turret,
    root). Reviewed 2-3 rounds (sky's giant crescent and bone's hand needed measuring); concept
    `docs/heroes/wave3_concept.svg/.jpg`; models `sky/bone/clockwork.glb`; `MinionRig.barY` added for tall unit looks.
    First tournament Zephyr 92%, Mortis 82%, Ada 26%; after the mechanics budget (kit-common.md) 60 / 60 / 56%
    (each × 13 opponents × 3 × both sides). Sweep 193/193 (known quirk only). Q of Ada is `clockwork rivet shot`
    (forge owns `rivet shot`).
  - Wave 4 DONE: prism (Opaline, mage: splitting skillshot, blind field, mirror shield, spectrum-lance ultimate),
    hive (Sirix, melee: claw cone + slow, swarm leap with wasp summons, chitin shield, queen-wasp dive + stun),
    bard (Cantor, support: bouncing note skillshot, silence, shield + heal, giant-lyre crescendo + stun). Reviewed
    1-2 rounds (bard passed first sheet; prism crystals rendered white, hive swarm read as confetti); concept
    `docs/heroes/wave4_concept.svg/.jpg`; models `prism/hive/bard.glb` (load checked in game,
    `docs/heroes/wave4-ingame_sheet.jpg`). Tournament with the mechanics budget on the first try: Opaline 63% → 53%
    after Refraction Field 45 → 40, Sirix 45%, Cantor 46% (each × 16 opponents × 3 × both sides). Sweep 205/205
    (known quirk only). Contact sheets need a wide canvas: the pane once shrank to 510×846 and zoomed every frame;
    set the viewport to 1400×850 before `_multi`.
    Committed `3379f3c`.
  - Wave 5 DONE (committed `e8e4326`): void (Oblivion, melee juggernaut: rift cleave, null tether pull + slow, void mantle
    shield + silence, unmaking R with pull + silence), ink (Shiori, control mage: brushstroke skillshot that splits at
    the end of its range, ink snare root, paper familiars ranged crane summons, final calligraphy R with blind), chrono
    (Tempo: piercing second-hand bolt with slow, stopped moment stun, rewind dash back + heal, twelfth hour R stun).
    Sheets `pipeline/designs/kit-{void,ink,chrono}.md`. New engine option `HitOptions.pull` (arena.ts, duel.ts; docs
    in mechanics.md "Pull" and the kit-common budget). Review: chrono passed the first sheet; void needed 1 fix (Null
    Tether's effects were not added to the scene); ink needed 1 round (purple hit tint, thin strokes, R paper flooded
    the frame). Rewind has no `dash` flag on purpose (the duel AI aims dash spells at the enemy). Concept
    `docs/heroes/wave5_concept.svg/.jpg`; models `void/ink/chrono.glb` (load checked in game,
    `docs/heroes/wave5-ingame_sheet.jpg`). Tournament first run: Oblivion 26%, Shiori 72%, Tempo 51%; after Rift
    Cleave 40 -> 46, Null Tether 30 -> 36 and pull 3 -> 4, Unmaking 100 -> 110, Brushstroke 55 -> 48 (split 15 -> 12),
    Final Calligraphy 105 -> 95 and blind 2.0 -> 1.5 s: Oblivion 54%, Shiori 58%, Tempo 51% (each x 19 opponents x 3
    x both sides). Sweep 217/217 clean.
    Committed `e8e4326`.
  - Basic attacks (2026-10-30): MOBA controls in hero mode (right-click an enemy or unit to attack it,
    A + click attack-move, S stop; a cast pauses the attack, moving cancels the wind-up). Melee swing 13 dmg / 1.2 s
    at 2.6 m, ranged homing bolt 10 / 1.0 s at 6.5 m; blind misses, stun stops, silence/root do not. Code
    `src/attacks/` (spec per kit by `kit.melee`, `Attacker`, `AttackFx`), wiring in heroMode.ts, duel.ts
    (`damagePlayer`, AI + autopilot attack when nothing can be cast; ranged AI holds within attack range),
    `HitOptions.attack`. Off in network duels (server relays only spell slots). Docs `docs/architecture/attacks.md`.
    Tournament `_tourney(2)` with attacks (melee 16 then 13): avg fight 22 s (was ~40), no timeouts; 38-64% except
    Brannoc 83, Mortis 29, Kaia 34 (noise about +-8). Retune waits for the kit redesign commit (one joint pass).
  - Duel arenas (2026-10-30): five arenas picked at random per round: Night Temple (the old ring),
    Frostfall Lake, Ember Caldera, Verdant Glade, Sky Ruins. Registry `src/arenas/` (one file each), design
    `pipeline/designs/arenas.md`, docs `docs/architecture/arenas.md`, sheet `docs/arenas/arenas-five_sheet.jpg`.
    Duel wiring: `Duel.arenaChoice`, `useArena`, `host.setStage` (main.ts), `arena.showGround`; network duels pick
    from a hash of the match id (`match.ts` passes `arena: m.id`), no server change. Each arena ran Sirix vs Opaline
    AI duels with no timeouts (38-41 s). Live site still has only the temple (deploy freeze).
    Refinement round 1 (3 workers, notes in the design sheet): every arena got a detailed floor, a specific edge and a
    backdrop; review fixed temple rubble colours, brazier glow, black silhouettes, bright snow/ice/moss and glare.
    Re-checked: duels 38-43 s, no timeouts; sheets `docs/arenas/arenas-five_sheet.jpg`, `arenas-gameplay_sheet.jpg`.
  - Oblivion v2 (2026-10-30): the game's Oblivion is now the heavier model: `hero_figures.py` look `void` (great-helm,
    spiked pauldrons on shoulder caps, chest rift core, fists round the sword grip, tattered cape on a clasp bar,
    floating shards, wider sword); the first model is kept as look `void_v1`. Compare sheets
    `docs/heroes/void-v2-compare_sheet.jpg`, `void-v2-ingame_sheet.jpg`. A Meshy model was tried and dropped; the
    rig tool `blender/heroes/meshy_rig.py` stays (the Meshy files in `blender/meshy/` are not committed).
  - Final balance pass (2026-10-30, committed): full 20-hero tournament (`_tourney`, every ordered pairing).
    Run 1 (3 reps): Vesper 70, Cantor 68, Ada 64, Opaline 61 high; Isolde 33, Sefu 34, Lyra 35, Zephyr 37 low.
    Three tuning rounds (damage only, in each spell's `default<Name>()`): Hemolance 53 -> 47, Sanguine Eclipse slam
    120 -> 110, Discordant Note 50 -> 47, Crescendo 100 -> 95, Clockwork Rivet Shot 55 -> 50, Gearfall 125 -> 115,
    Prism Bolt 45 -> 42, Spectrum Lance 125 -> 118, Rime Spear 50 -> 53, Winter's Crown 125 -> 130, Frostfern Field
    56 -> 58, Sand Lash 50 -> 53, Quicksand 45 -> 48, Tomb of Kings 125 -> 130, Starshot 52 -> 55, Celestial Hunt
    135 -> 138, Gale Edge 40 -> 45, Thousand Winds 125 -> 132, Rivet Shot 46 -> 50, Forgefall 115 -> 122, Volatile
    Flask 45 -> 49, Grand Transmutation gold 80 -> 86, Bloom Lash 50 -> 54, World Blossom 125 -> 130, Brushstroke
    48 -> 45. Final run (4 reps, 152 fights per hero, no timeouts): Vesper 46, Brannoc 59, Isolde 59, Lyra 52, Vex
    55, Kaia 49, Sefu 47, Nyx 43, Fenna 55, Auriel 44, Marin 51, Zephyr 53, Mortis 54, Ada 41, Sirix 41, Cantor 43,
    Opaline 43, Oblivion 61, Shiori 45, Tempo 58. Run-to-run noise is about +-6 points. Hero pages and the heroes README
    carry the new numbers.
- **Combat mechanics** (user 2026-10-29; plan `pipeline/designs/mechanics.md`; used by waves 3-5 only, the 11 existing
  heroes stay as they are). Engine built in 4 steps, committed in `0cd338d`:
  1. Statuses: `HitOptions.status` (stun, root, slow, silence, blind, knockup), `src/effects/status.ts`, markers
     `parts/status.ts`; AI obeys them and prefers `cc` spells. Zone-hit fix in 6 spells.
  2. Shield / heal / dash (`ctx.shieldSelf`, `healSelf`, `moveCaster`, `parts/shield.ts`), melee support
     (`HeroKit.maxHp`, `melee`, `HeroSpell.dash`). Duel side-bias fix: `opponentHit` checks the hit's own cast.
  3. Skillshots: `ctx.projectile` (pierce, bounce, split; `src/effects/projectile.ts`, `parts/bolt.ts`); duel filters
     accept projectile hits; AI dodges ~65%.
  4. Summons: `ctx.summon` (melee, ranged, turret; `src/effects/summon.ts`, `parts/minion.ts` with a pluggable look);
     AI shoots the hero first; hero-mode line aim (`HeroSpell.aim: 'line'`); hero-mode recast keeps the old instance.
  Test kits (not in the roster): `vfx.testKits.melee` / `ranged` / `summon`; test spells in category
  `test: mechanics`. Duel recipe for kit objects: comment above `Duel.start()`. Results: melee 59%, ranged 59%,
  summoner 48%. Budgets: `kit-common.md` (Summon budget). Network duels ignore shields, dashes, projectiles and
  summons for now (phantom units on the player side): the sync goes to the multiplayer session, which holds off
  `arena.ts`, `heroMode.ts`, `duel.ts` and `targeting.ts` until told.
  Melee heroes: Zephyr, Sirix and Oblivion (mechanics.md 2b).
  After the engine (new AI targeting, per-cast dodge rule): 11-hero tournament `_tourney(3)` = 330 fights, 0 timeouts,
  wins out of 60: Vesper 45 (75%, outlier), Kaia 35, Nyx 33, Auriel 32, Marin 32, Brannoc 29, Lyra 29, Vex 27,
  Fenna 24, Isolde 23, Sefu 21 (35%). Vesper checked: dodges against her casts are normal on both sides, so it is
  balance, not a filter leak. Left for the planned balance pass after waves 3-5. Sweep 181/181 (known
  corpse-finger quirk only).

## Blocked
- Nothing.

## Waiting on you
- Nothing blocking (2026-11-03). Push and deploy happen only when you ask:
  - Push: `git push origin feat/particle-editor:main`. GitHub `main` and the live site are both at `bc0f830`; `45bb30f` (docs only, so no deploy needed) is local.
    All commits are authored as Dextonek (old history in `refs/backup/before-dextonek`).
  - Deploy: `npm run cf:deploy` (drops every live WebSocket: running matches end). Live is `bc0f830`.
- Play online: https://arena-of-kits.arenachamp.workers.dev in two browsers (online accounts start empty).
- Try it in two windows: `npm run dev`, then http://localhost:5173/game.html twice (see the guide's duel game section).

## Known look issues (small)
- Duel game: not cheat-proof (clients report their own hits); a reload during a match forfeits it; no mirror
  matches (one effect per spell label); projectiles fly through pillars (sight is checked at the cast); a pillar can
  hide a hero from the high camera. The kit balance numbers predate the ring's cover: re-run the duel tournament.
- Duel v1: the opponent uses one telegraph set at a time (a new cast replaces the old zones); it never dodges; the
  two heroes can't share a kit. Not watched in real time (the browser pane doesn't animate while hidden).
- Hero figures: poses are procedural (walk swing, one casting arm); not checked closely from the gameplay camera.
  Isolde's back still glows fairly bright (ice fan emission + pale robe).
- Volatile flask: a faint stain is still on the floor at 1.75 (gone at 1.8).
- Hero mode: a hero who walks during Crimson Pact leaves the heart behind; the follow camera centres on the hero, so
  the ultimate's moon sits at the top edge unless you zoom out with the wheel. With overlapping spells, only the
  newest one's danger zones are drawn, and one screen-feedback state wins per frame (an impact frame, else the
  strongest darken/whiteout).
- Sweep flake (2026-10-29, not reproduced): one sweep run reported errors for abyssal angler, supercell, world tree
  rising, hourglass of ages and midnight circus; the error text was not captured. Each passed alone, the same chunk
  passed when re-run, and a fresh full sweep passed 128/128. If it comes back, capture `r.errors[0]`.
- Thorn garden: the thicket thorns still read a little thin from far away.
- Sanguine eclipse: the blood sphere keeps a small specular highlight.
- World tree rising: the 6.2-8 s canopy shot frames only the upper tree (the 17-21.8 s wide shot shows the full scale).
- Supercell: the enemies take a light violet tint from the arena hit flash during the vortex ticks.
- Thousand-cut iaido: the 2.8 s blade glint star is still a bit large.
- Ophanim descent: the opening omen shot (0-3 s) is sparse: dark sky, small clouds, the caster's head at the frame edge.
- `corpse finger gravity pull` (old set piece, untouched): `selfTest` reports 19 singular frames only when run
  longer than its own length (7 s); it passes at 6.5 s. Something scales to 0 after the effect ends.
- Event horizon: the lens bends the disk's tips into two small leaf shapes at the disk ends (likely the lens bending the disk tips; kept).
- Hyperion railgun: the arena telegraph line shows as a red slab in the low cutscene shots (arena owned).
- Batch 2: mammoth spirits cover the caster at the start; the djinn could be bigger; murder of crows leaves
  heavy dark smoke at the targets; colossus drop's 12 s falling shot is a fireball more than a mech.
- Open-theme batch: glitch purge reads small at gameplay distance; jellyfish chain lightning is faint; checkmate's
  ivory tile edges catch white specular highlights; genesis collapse's orbit-impact ring blooms bright (intended
  whiteout beat) and the 43-47 s orbit shot was not re-framed after the planet grew.
- Nine tail foxfire: the cream tail tips bloom a little. Flying swords: the giant sword reads thin. Heavenly palm:
  the hand is cartoonish. Thunder drums: the converging strike is white-heavy at D.
- Jade dragon ascension: a faint glow remains where the body coil turns edge-on near the neck, and the hold glint
  briefly sits over the snout. The impact centre is still near white. The head is a camera-facing drawing, so it
  shows the same profile from every side.
- Taiji thunder seal: the strike frame still blooms white round the target for ~2 frames (partly the arena's hit
  flash, see weapon attacks). The design's nova hit on nearby enemies is not possible in `enemy` mode, so it is
  visual only.
- The red danger-zone rings dominate the ground sigils of every targeted spell (global telegraph look).
- Weapon auras: the ice sword's frost ring reads a bit heavy from the low front camera; hammer eye/bell flares are
  depth-test-off sprites and show through the head from behind (turntable). Kit wish: a `reveal` / travelling-band
  uniform on `FlowRibbon` (the dragon sword and guandao fake it with group scaling and overlapping pieces).
- Weapon attacks: the arena's hit flash (white, bloomed) briefly swallows the impact VFX on the enemy; the hero
  slides during the dash (no leg walk cycle); poses are hand-keyed (no IK), so the off-hand never touches the weapon.
- Glacial ricochet / abyssal gaze: the lightning arcs are 1px lines and read thin.
- Violet severance: from the default side camera the beam is still fairly thin, and the dark outline only shows
  up close; the beam runs flat at hand height, so it passes the target at 1.5 m instead of chest height.
- Spinning crane kick: surrounding enemies still look pale under the jade light.
- Starfall's `dust` emitter is never burst (harmless).
- FinishPass impact-frame also fires on every earthquake pulse.

- Zone hits that skip a position check at impact: `aegisWall`, `judgementOfDawn` (loop `ctx.targets`, chosen at cast),
  `whirlpool`, `leviathansWaltz` (`victims`, frozen at cast), `graspOfTheDeep` tick, `eclipseExecution`. An enemy that
  walks out of the zone before impact is still hit. The duel hides it (`opponentHit` re-checks the telegraph); hero
  mode does not. Fix: re-check position at impact like `overgrowth.eachInside`. Planned with the status-effect work.
- `docs/architecture/effects-and-parts.md` has no sections yet for the wave 1 parts files (storm, sand, shadow).

## Notes
- The browser pane only animates while visible; checks pause the loop (View → paused) and step with
  `vfx.step(1/60)` + `vfx.render()`. Screenshots can show a stale frame when the pane is hidden.
- Brightness rules: emissive ≤ 1, additive opacity ≤ 0.5, bloom threshold ≥ 0.8, mid-tone colours for lit surfaces,
  `setRGB`/`setHSL` are linear (pass `THREE.SRGBColorSpace`), PointsMaterial needs `softDotTexture()`.

## Next step candidates
- **v4 batches 2-4** ([kits-v4.md](../pipeline/designs/kits-v4.md) build order), each led by its engine pieces;
  Nyx's stealth last. Then refresh the hero catalog, and test online with two players and on a phone.
- Run `/forge-vfx` on more video recipes: `d-kler-1-singularity-*` (black hole), `g-castorice-*` (cutscene finishers
  need a scripted camera, which the kit does not have yet), `f-swipe-*` (smoke slashes), `g-dark-lord-slash`.
- A cutscene camera part (shot list: close → wide → ground → held reveal, whip-pan smears) for the §10 finishers.
- Forge the new tutorial recipes, e.g. `h-onetupthree-ember-blade-slash`, `h-beyondfx-botw-bomb-explosion`,
  `h-onetupthree-mech-self-destruct`, and from batch j `j-lelu-twisted-wind-tornado`, `j-cghow-outlined-stylized-bolt` (the black outline also fixes the thin-arc issue).
- Run `/forge-vfx` on more library recipes, e.g. `5 random ground`, `a-lol-ashe-enchanted-crystal-arrow`,
  `b-genshin-raiden-musou-isshin`, and on the user's reference videos (batch d).
- Export: PNG frame / WebM recording / sprite sheet (to use the effects in other engines and 2D games).
- Save/load effect settings as JSON.
- Shared `Debris` class (duplicated in ~5 spell files).
