# Status

_Last updated: 2026-11-10 (legs, Hank's axe; friend brackets half built)_

## Current state (2026-11-05)
**2026-11-10, second computer: committed, not pushed, not deployed**
- `b2246ee` Heroes stand tall (user, with screenshots of Isolde and Brannoc: "in the showcase of champ some of the champ
  has werid legs"). The pack's figure has a long thigh and a short shin, so its leg directions copied as they were put our
  heroes' feet behind the hips with the knees pushed forward. Standing, walking and running now fit the legs to each hero
  (`fitLeg` in `src/heroFigure.ts`); the Heroes stand shows everyone at ease (`atEase`: 35% of the idle's crouch, no fist
  guard). Knees on the stand 16-22° (were 31-56°); walking foot slide down (Sefu 42 → 33%, Hank 36 → 28%). Write-up:
  [hero-holds.md](../pipeline/designs/hero-holds.md) "Legs fitted to the hero".
- `2313c57` Hank's axe (user, with a drawing: "hank shoud have axe like this and holding it like this"): one bit on a
  one-handed haft, held low by its end at his side, head out in front, swung in one hand; portrait, Q icon and thrown axe
  match. New hold `low` in `heroFigure.ts`. The model was patched in Blender here (`blender/heroes/patch_hank_axe.py`),
  because the figure build needs helper modules from `C:\projectG\xianxia\blender`, which this computer does not have
  (SETUP.md now says so). `restyle_batch1.py` builds the same axe (`hank_axe.py`) but that path is **not run yet**: on
  the first computer, rebuild `timber_v3` once and compare it with the committed model.
- `0e5ad3c` Items held up stay up (user: "check more heroes which have wrong direction holding their weapon"): the
  stance, walk and run clips' empty hand pointed every held-up item level and ahead; a caster's scepter, wand, mirror or
  needles now stay as modelled, a fighter's blade on guard (Vesper, Opaline, Shiori, Silvane, Madame Cleaver, Grandma
  Ironknit, Zambini, Sir Whiskers, Pim and Pom).
- `ec4642b` Arms hang by the side when standing (user: "look at all heroes spotlight and make it be correct"): the
  idle's arms were the pack figure's 40° out; now each hero's own modelled hang (`Hero.armOut`). Walk and run unchanged.
- `ceb6c6b` Sirix's wings (user: "sirix wings are not correct"): rebuilt after his portrait, two pairs rising behind the
  shoulders; and the game now keeps a model's own see-through parts (it drew Sirix's wings and Marin's water sash
  solid). Patched in Blender here (`patch_sirix_wings.py`); `hero_figures.py` builds the same wings but that path is not
  run yet: rebuild `hive` once on the first computer and compare.
- Waiting on the user: Gus's mop is modelled head-up; Grandma Ironknit's needles now point up; Shiori's brush stands
  bristles-down. Each is as the model has it; the user may want them changed.
- `00ec31a` Arms kept out of the body (a body outline per hero, arms pushed clear); research in
  [knowledge/retargeting-arms.md](knowledge/retargeting-arms.md). The user still found it wrong.
- `0fb938c` Standing from a new pack: Quaternius' Universal Animation Library (CC0), a realistic figure like ours
  (`pipeline/assets/ual/`, `pipeline/tools/bake-ual.js`, `src/motion/ual.json`). **Approved by the user ("this looks
  good", 2026-11-10).** Baked and ready, not in use: its walk, jog and sprint; offered to the user next.
- All of these are in the News page's next release (`live: false`).
- Not checked: a person playing; a phone; Hank in a real fight from the game camera (pictures were taken on the Heroes
  stand rig, stepped by hand).

**Second computer set up (2026-11-10):** cloned, branch `feat/particle-editor` tracking `origin/main`, `npm ci`, and
the type check, build and server test all pass. The lock file named a private registry from the first computer
(`npm ci` failed with 401); it now names the public npm addresses, same versions and checksums (`9a3947e`). `SETUP.md`
now also sets the git author (Dextonek). Not pushed.

**Continuing on another computer (2026-11-10):** everything is on GitHub `main` (`Dextonek/ArenaChamp`). Set up with
[SETUP.md](SETUP.md), read the rules in [CLAUDE.md](../CLAUDE.md), then this file. Not in git by design: the Meshy
files, `server/data/` (local accounts and test passwords) and three old gameplay recordings (SETUP.md, section 4).

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

- **Pushed:** GitHub `main` carries `56b9f2b` and this status commit (2026-11-10, at the user's request: "puish it and uplaod it", then "Yes, fix and deploy"). Push: `git push origin feat/particle-editor:main`, when asked.
- **Live:** `56b9f2b`, deployed 2026-11-10 at the user's request ("Yes, fix and deploy"; `npm run cf:deploy`, worker version `309d2aeb-2c7f-4323-ab65-6efa6d84c4a4`). Only the Worker changed: the News clips (`/news/*.mp4`) are answered in byte ranges (`clip` in `worker/index.mjs`, `/news/*` added to `run_worker_first` in `wrangler.jsonc`), because Cloudflare's static assets sent the whole file for a range request and Safari on iOS will not play a video without ranges. The standalone Node server answers ranges for every file too. Page bundles unchanged (`game-Ba4uYuza.js`). **Checked:** locally on `wrangler dev` and the Node server, then on the live site: each clip whole (200), its first two bytes and its last 500 (206 with the right `Content-Range`), a range past the end (416, locally), the bytes of a range equal to the file's; the three clips play and seek in the browser pane; no console errors; server smoke test. **Not checked:** an actual iPhone.
- **Live before that:** `8b52de2`, deployed 2026-11-10 at the user's request ("puish it and uplaod it"; `npm run cf:deploy`, worker version `45ee8a52-05e8-45bd-bfce-0936b0d5cb8c`), https://arena-of-kits.arenachamp.workers.dev/game. Brings everything since `755ce08`: click walking and A+click, the 19 restyled heroes, the menu restyle, the CPU duel inside Play, the hero motion from the KayKit clips (standing, walking, running, attacks, four casts) and the News page. `PROTOCOL` stays 5 (no server message changed), so a tab left open keeps the old page until it is reloaded. Type check, build and server smoke test passed before the push. Checked on the live site, no account used: the page loads bundles `game-Ba4uYuza.js` and `game-BeQAXgqF.css`, the names this build made; the News page opens from the login screen with its ten releases and "Live now" on the newest; the lead clip plays in the browser pane (Chromium); the three clips are served as `video/mp4`; no console errors. The clips were then sent whole to a byte-range request, which Safari on iOS needs: fixed in `56b9f2b` (above).
- **Before that:** `755ce08`, deployed 2026-11-09 at the user's request (`npm run cf:deploy`, worker version `05e1070e-d1ed-4954-b666-849893a688ee`), https://arena-of-kits.arenachamp.workers.dev/game. Brings the Play screen remade as a hero select (entry below). Only the page changed (`game.html`, `game-DFxnDJrd.css`, `game-B2r-VA2X.js`); the server and `PROTOCOL` (5) did not, so a tab left open keeps the old Play screen until it is reloaded. Checked on the live site, no account used: those bundle names, the script holds "Choose your hero" and the full-kit link, the CSS the new `.hs-` rules; vs CPU by a real click shows all 40 hero tiles the same size; no console errors. Not checked on the live site: the Play screen itself (it needs an account, and none is made on the live server), a real phone.
- **Before that:** `7438db2`, deployed 2026-11-09 at the user's request (`npm run cf:deploy`, worker version `ec3bfa29-b84f-4b58-8bd7-06a4e829502a`), https://arena-of-kits.arenachamp.workers.dev/game. Brings everything since `1d80674`: Noonfall, the bosses' upgrades and lairs, stages, enrage, soak and summons, the hard bosses, the mechanics' effects, the attack animations, and Ash's four pillars with his one-shot Charge. `PROTOCOL` is 5, so a tab left open gets the Reload bar. The type check, build, server test and raid checks passed before the push. Checked on the live site, no account used: bundles `game-hBU5S4cq.js` and `runtime-B8xrUy3F.js`, the names the deploy uploaded; the server takes protocol 5 (a made-up resume token is refused) and answers protocol 4 with "A new version is out: reload the page"; "Raid · no account needed", Start alone and the upgrade altars before the Sun Warden by real clicks; the live runtime holds the Charge's CRUSHED and STUNNED, the pillar breaking, the pillar pips and the hiding autopilot; no console errors. Not checked on the live site: Ash's pit itself (a run starts with the Warden), anything needing an account, a person playing, two real people, a real phone.
- **Before that:** `1d80674`, deployed 2026-11-07 at the user's request (`npm run cf:deploy`, worker version `5662ee54-cee3-49d8-9bb3-55401ec436b0`), https://arena-of-kits.arenachamp.workers.dev/game. The Raid shows to everyone. `PROTOCOL` is 4, so a tab left open gets the Reload bar. Checked on the live site, no account used: bundles `game-BdYwCsFd.js` and `runtime-kEr1sT5w.js`, the names the deploy uploaded; the online server accepts a connection; on plain `/game` the button "Raid · no account needed", Start alone, an upgrade card by a real click, the Sun Warden in the Sun Court; a real click on the hero's own portrait left the same fight, the same boss and the same hero; Leave back to the Raid screen; no console errors. Not checked on the live site: anything needing an account, so no room for two and no online match; a person playing, two real people, a real phone.
- **Earlier still:** `6fc031d`, deployed 2026-11-06 at the user's request (`npm run cf:deploy`, worker version `6cf44f13-74d8-4aea-9486-967c13205cc1`). The Raid only at `/game?raid`. `PROTOCOL` is 3, so a tab left open gets the Reload bar. The type check, build and server test passed before the push. Checked on the live site, no account used: bundles `game-DKp8yfgp.js` and `runtime-mlvnutja.js`, the names the deploy uploaded; at `/game?raid` the button "Raid · no account needed", Start alone, an upgrade card by a real click, then the Sun Warden in the Sun Court on the autopilot with both HP bars falling and no errors; on plain `/game` no Raid button; the online server accepts a connection. Not checked on the live site: anything needing an account, so no room for two and no online match; a CPU duel (run locally on this code); a person playing, two real people, a real phone.
- **The deploy before that:** `3dfa9c6`, deployed 2026-11-05 at the user's request (`npm run cf:deploy`, worker version `2e61dff4-d62f-4c14-829d-439c823b92e8`). All 39 heroes. Build and server tests passed before the push. Checked on the live site: bundles `game-DvC1lgcZ.js` and `runtime-Dlw_1tV3.js`, byte for byte the local build; the first fetch a moment after the deploy still served the old page, and the new one followed within a minute; the online server connects (no account used); 12 stepped CPU fights in the real game on all 5 maps, including Pip and Bram on Frostfall Lake, every one with a winner and no errors, with 5 bolt hits on walls waiting for the bolt and all 5 landing. Not checked on the live site: a person playing a real fight, two real people, a real phone.
- **And before that:** `5abd80b`, 2026-11-05 at the user's request (`npm run cf:deploy`, worker version `a2055259-90f5-4bfe-ab88-56d8c79c53f3`), https://arena-of-kits.arenachamp.workers.dev/game. All 39 heroes. Checked on the live site: bundle `game-MAwePjzM.js`, the online server connects, a CPU fight from the real buttons with a real right-click to a result card (Nyx against Opaline on Normal), a CPU fight at phone size with the touch layout and the attack button (Nyx against Oblivion), no console errors. Not checked live: two players (no accounts were made on the live server), login, a real phone.
- **The fight with no winner, found (user, 2026-11-05: "Check the pip, one small quirk fix and run tournament"):** it did not come back in 195 Pip fights on the code of that day or 1,482 on the older `33efe70`, so it was rare; a forced unreachable parcel did not cause it either (78 fights). `kit-balance.js` now names any fight with no winner and where it stood, and the tournament caught it: Bram against Pip on Frostfall Lake, 208 HP to 64 HP after 120 s. Gerald had landed on Pip's knocked-loose parcel, so both CPUs wanted a spot inside him. The route put Bram's goal on the far side of a snow drift, 2.86 m from Gerald, and he stops walking at 2.8 m (reproduced on `33efe70`: walking in from the south he stops at the recorded (2.10, 9.42) and stands; a forced run held for at least 7 s, not the whole 120 s, because the other CPU broke it). Pip stood just past his 4 m rule and just out of pick-up reach. With no sight of each other neither acted. Fixed in `6dd7ec5`: a CPU that stands still short of a trait's goal drops it for 4 s and fights (`Duel.reachableGoal`; Bram leaves that spot after about 2 s and lands a hit at 4.5 s), and a parcel with cover raised on it is reached from the edge of that cover.
- **Found on the way (`6d05058`):** Pip and Sir Whiskers still read the old duel ring's cover, which no arena has any more. About 1 in 16 of Pip's parcels and drops lay inside a real wall or pillar on Temple, and an enemy on open floor where the old ring had a pillar signed for Final Delivery and took nothing (old code 0 damage, new code 80). Traits now have `t.cover()` and `t.arenaCover()`; all parcels on all 5 maps are at least 1.7 m from real cover, and the old layout is gone. Online, both screens placed the parcels the same on every round.
- **The wall quirk, fixed (`1bb3b1e`):** a bolt's hit on a breakable wall is still counted at the cast on both screens, but the wall cracks or falls after the longest wind-up and slowest flight of any bolt (0.5 s + distance / 12 m/s), so the bolt stops at it. Checked: last hit, enemy behind the wall takes 0, the wall falls at 0.75 s, the next shot goes through; the slowest bolts from 6.5 m (Swarm Surge, Caber Toss, Sawn in Half) stop too; two bolts on the way; an area spell still breaks at once; a new round forgets what was on its way. Online on Temple: hit at the cast, the wall falls about 0.6 s later on both screens, the same wall state, 0 errors.
- **Tournament (`6d05058`, the commit before the goal rule), all 39 against all 39, 1,521 fights, no spell errors, 1 with no winner (above), average 23.3 s:** Pip 67, Mortis 64, Grandma 64, Bram 61, Auriel 56, Opaline 56, Mum 56, Isolde 54, Lyra 54, Tempo 54, Vesper 51, Sefu 51, Zephyr 51, Sirix 51, Puff 51, Gus 51, Bo 51, Vitriol 49, Kaia 49, Fenna 49, Whiskers 49, Ada 46, Oblivion 46, Shiori 46, Hank 46, Ledger 46, Cleaver 46, Barry 46, Marin 44, Yoko 44, Zambini 44, Brannoc 41, Silvane 41, Mabel 41, Wick 38, Cantor 36, Whistler 31, Pim and Pom 26, Nyx 23. Noise is about ±15 at 39 fights. The goal rule was then measured on the 11 heroes with a CPU goal, no errors, every fight with a winner. 78 fights each: Pip 58, Bram 51, Nyx 28, and Pim and Pom 29, who has no goal but was low. 39 fights each: Brannoc 54, Kaia 49, Yoko 46, Cleaver 44, Wick 44, Silvane 41, Fenna 38, Gus 33. All within noise of the tournament except Gus, down 18, a little outside it. In those last 312 fights the rule fired 28 times, about once in 11 fights. Nyx and Pim and Pom are really low. Not tuned: nobody asked yet.
- **Sight, third pass (user, 2026-11-05: "recheck this and fix them, push and deploy"):** the hero who stood still after a cancelled wind-up was a pathfinding bug, not Lyra or the wind-up. A walk order into cover ends on the walker's side, and that route stayed in use for any new order within 0.6 m of the old spot, so a target across the cover left the walker standing on its old goal until the target moved. Reproduced on purpose and by replaying the first failure (Bo clicking behind the pillar just before). Fixed in `src/nav.ts` (`982d4c0`). A phone tap on a skillshot fired into the wall with no strip shown (found by the touch test); it now follows the enemy into sight (`0ed8d46`, `5abd80b`). An independent reviewer read the code and found 7 things, all reproduced or checked in the game and fixed in `5abd80b`: a cast at a spot just behind cover left the hero standing with it queued; a melee CPU froze across thin cover (Mum's wall); Mum's strip ended at her own wall; a recast's strip ended at cover; a tap fired at the spot where the enemy stood at the tap; a bolt cracked a second wall behind the first, or none with a short aim; lightness tests read linear values (Bo's pale accent missed the grey blocked colour, and Barry, Mabel, Pim and Pom, Grandma and Brannoc lost their foil colour on the HUD). **Left as it is:** a bolt that takes a breakable wall's last hit removes the wall at the cast, so that one bolt flies on past where its strip ended. Both screens agree and it happens once per wall.
- **Sight (user, 2026-11-05: "make the line of sight also visible for that ghost projection"; taken as a yes to melee needing sight too):** the aim strip of line skillshots and targeted spells ends where cover stops the spell and turns the kit's pale `foil`; the red cast strip ends there too, on both sides' casts (`bd94efc`). Checked by stepping the game: strip 2.71 m where the real bolt dies, 9 m on open floor, Nyx's strip at the pillar, and The Shove, Gerald, No!, Feather Step, TIMBER! and Black Hole keep the whole strip (`overCover`). Basic attacks, melee or ranged, need line of sight (`src/attacks/attacker.ts`). A kept route is planned anew when cover stands between the walker and its next point (`src/nav.ts`), so an attack order across a wall walks round and hits in 1.3-1.6 s. 12 melee heroes, 39 fights each, no errors, nothing outside noise: Whiskers 46, Brannoc 41, Sirix 49, Gus 46, Bram 44, Mabel 54, Nyx 31, Zephyr 46, Yoko 46, Hank 56, Pim and Pom 51, Oblivion 49.
- **Sight, second pass (user, 2026-11-05: "fix them and refine it", taken as the open items of the sight work):** clicking through a cut strip walked the hero round instead of firing, and so did spells that pass over cover and bank shots when the cursor lay behind a wall: a line skillshot now fires along its aim at once (`HeroMode.confirm`). A cut strip ends flat at the wall with no arrow (`capStrip`). The blocked colour is no longer the kit's `foil`, which is nearly black on Referee Whistler: it is pale, or grey on a kit whose accent is pale (`blockedTint`). The range ring is pale on every kit. Cover coming between attacker and target cancels a wind-up (`src/attacks/attacker.ts`); a released bolt flies on. Commit `3e1a61b`. The hero panel's text and rims no longer use a dark `foil` (`hudInk`), and the panel no longer squeezes at 1024 px (`0042b2e`).
- **Checked for that pass:** real mouse and keyboard events on the tool page's duel (Marin): the strip ends at the wall, a click fires at once, the bolt dies there, no damage. Scripted pointer events: Opaline and Silvane bank, Feather Step, Black Hole and TIMBER! fire at once, Nyx and Kaia still walk into sight and then cast. Each line skillshot whose strip stops at cover was fired with the foe in the open and behind a pillar, except Shear (it needs a sheep) and the Pebble of Pim and Pom (on the second twin; by reading, it is a real bolt like the rest): all reached the foe in the open, none through the pillar. A wind-up cancelled by cover, 55 runs: in 54 the hero walks round and hits within a second. In the first run Lyra stood still after the cancel; the third pass found the cause. All 546 balance fights below reached a result, so none stalled. Online through the local server with bots, 4 pairs (Bram v Gus, Hank v Whiskers, Brannoc v Nyx, Mabel v Marin), 0 errors, both screens agreeing on the winner; the winner's last HP matched exactly in the one pair sampled at the same moment. 1 of 62 attacks was released with cover between them on the receiving screen (positions lag; the receiver trusts it by design). `npm run build` and `npm run test:server` pass. Balance after the pass, 78 fights each against all 39, no errors: Nyx 36 (the same as before the sight work), Brannoc 46, Mabel 49, Lyra 53, Marin 56, Sir Whiskers 49, Hank 55. Noise is about ±11 at 78 fights.
- **Checked for the third pass:** a sweep of all 5 maps, 47 obstacles, 8 directions, a melee and a ranged hero, with and without a leftover order in cover: 1,016 chases with no frame showing the stall. One run recorded no hit because Lyra died mid-test: the arena hazards wear a hero down between runs in a play duel (glade 210 HP a minute); that case alone, fresh, hits in 0.4 s. 254 casts at spots just behind cover all went off. A full fight against the live CPU with real mouse and keyboard events (Marin against Nyx, a result at 19.9 s, 1,192 frames, no stall, no errors). A real right-click on an enemy behind a pillar walks 3.4 m round and hits in 1.3 s. At phone size (375x812, touch emulated, not a phone): tap, drag-aim, ground spell, attack button, joystick and a whole fight on the game page. Two screens through the local server, one desktop tab on the mouse against one phone-size tab on taps (Marin against Mabel): 2-0 in 89.5 s, positions and HP the same on both screens, the same result text, 0 errors. Bots: Brannoc v Nyx, Hank v Whiskers, 0 errors. Online on Temple, Marin v Lyra with the arena forced in both tabs: both screens hold the same wall HP in every round, and a skillshot past two walls and one aimed short both crack only the first wall. `npm run build` and `npm run test:server` pass on `5abd80b`. Balance, no errors: Nyx 29 at 78 fights (26 and 28 at 39 fights), Lyra 41, Mabel 54, Pip 59, Mum 49, Bo 54, Brannoc 49 at 39 fights. Nyx may really be down from 36 (the first balance figure after her last raise); not tuned, since she was reported too strong and tuning waits for a person playing.
- **Not checked:** a person playing a real fight, two real people, a real phone. The tests above used real mouse events, emulated touch and two tabs on one machine.
- **Built:** all 20 v5 kits and all 19 new heroes, each filmed in a real fight (`pipeline/tools/fight-film.js`). Docs cover all 39: `docs/catalog/heroes/`, `effects.md`, `hero-mode.md`, `mechanics.md`; HP, basic attacks and cooldowns were compared with the code by script.
- **CPU wall fix (`160d5c0`):** someone pressed against a wall counted as inside cover (a rounding error at touching distance), so a chasing CPU walked to its own side of the wall and stopped as if it had arrived. Half the ranged CPUs tested never got sight of a wall-hugger; now all do, with a first hit in 3-5 s (`src/nav.ts`). A trait's own goal now takes the planned route round cover (`Duel.goalStep`); Nyx's straight walk froze both heroes in 4 of 12 fights against Sefu. None froze in 62 always-behind fights after the fix, 20 of them against Sefu.
- **Nyx (`src/traits/shadow.ts`, `umbralCut.ts`, `src/kits/shadow.ts`):** Q 54, 86 from behind; attack 11; 640 HP. Measured two ways, because the balance AI plays her worse than a person should: 36% against everyone (78 fights); 18 of 32 against eight strong heroes when she always strikes from behind. Before: 7 of 8 always behind at 108 a strike (too strong); then 19% and 5 of 16 at 80 with attack 9 and 610 HP (too weak); then 26-38% over three runs at 85 with attack 11 and 640 HP (still a little low). The user confirmed on 2026-11-05 that "kinda broken" meant too strong.
- **Balance, the tournament before that, 39 fights each, no spell errors:** Vesper 51, Brannoc 38, Isolde 56, Lyra 56, Vitriol 69, Kaia 54, Sefu 41, Nyx 26, Fenna 21, Auriel 64, Marin 72, Zephyr 44, Mortis 67, Ada 41, Opaline 46, Sirix 51, Cantor 41, Oblivion 54, Shiori 51, Tempo 49, Silvane 46, Bram 41, Hank 49, Puff 31, Whiskers 46, Ledger 38, Yoko 38, Mum 49, Whistler 23, Cleaver 38, Pip 61, Gus 46, Mabel 51, Grandma 69, Barry 46, Bo 54, Zambini 41, Wick 46, Pim and Pom 38. Noise is about ±15. The outliers re-measured at 78 fights: Marin 49, Vitriol 55, Grandma 50, Mortis 56, Fenna 40, Whistler 42, so those swings were noise. Nyx and Puff stayed low and got a last raise (`33efe70`): Nyx 36, Puff 44. Tuning is finished unless a person playing finds otherwise. One of those 1,521 fights ended with no winner (a Pip fight): see the fight with no winner above.
- **Checked:** `npm run test:server`, `npm run build` and the type check pass on `33efe70`. Online with bots through the real local server (`pipeline/tools/online-bot.js`), 13 pairs, all with rounds running, 0 errors and both screens agreeing on HP: Ledger v Puff, Bram v Zambini, Pim and Pom v Zambini, Wick v Silvane, Bram v Kaia, Gus v Mum, Yoko v Mabel, Shiori v Whiskers, Cleaver v Whistler, Bo v Silvane, Grandma v Mum, Pip v Barry, Hank v Whiskers. That testing found the server refusing the name "Mr. Ledger" (fixed). A local phone-size layout: login, Heroes table, hero detail, a fight with the touch controls, a tag from a tap. CPU levels against the balance AI, 24 fights each: Novice 0%, Easy 13%, Normal 38%, Hard 67%, Master 58% (noise about ±20).
- **Known, not changed:** The 19 new heroes have no `ART_BIBLE` rows. `kit-tide.md`, `kit-bone.md`, `kit-shadow.md` and `kits-v5.md` show older numbers in places; the code is the truth. These files stay uncommitted on purpose: `blender/meshy/`, `docs/heroes/void-meshy-ingame_sheet.jpg`, `docs/heroes/void_meshy_15.png`, `docs/heroes/void_meshy_posed_15.png`.
- **Cleaned up:** the bench worktree and its `launch.json` entry, preview servers, 18 throwaway local accounts (`v5check####`, `v5bot*`). The older local test accounts stay.
- **Designed (user, 2026-11-06):** `pipeline/designs/duels-and-raid.md`: Loser picks, Arenas that change, Friend brackets, Spectating and the Raid. Decided by the user the same day: the Raid is co-op, a first boss then a second boss; Last stand stays, so a long round always ends (this changes the 2026-10-30 ruling of no time limit); the build order stands: version check, Loser picks, Arenas that change, Raid, brackets, spectating.
- **Live since 2026-11-06 (build order steps 0 and 1):** the version check (`ab20b51`): `PROTOCOL` in `server/protocol.mjs`; a tab on an older build gets a Reload bar and stops reconnecting, and a tab from before the check gets the same text on its login screen. **A deploy of this makes every tab left open reload first:** tabs from before the check see the text on their login screen. Arenas that change raises `PROTOCOL` to 2 in its own commit. **Loser picks is switched off for every match (user, 2026-11-06):** the code stays (`8e562d9`), `createHub({ loserPicks: true })` turns it on, and only the smoke test does. Off, the break between rounds stays 3 s and no panel opens. With it on, a round's loser has 15 s to swap hero, choose the next arena or keep things as they are. Checked with it on, before it was switched off: `npm run test:server` (a refused swap, a refused second pick, both directions, a pick nobody answers, keep, stats); the type check and build; two tabs through the local dev server with bots: a swap reaching both screens with the right HP on each (Mabel to Bram, 800), a swap to a long name and to Pim and Pom with no errors over a whole match, the same arena and event seed on both screens after a choice, the note on the loading page for 2.2 s, a pick nobody answers changing nothing (the 15 s itself is timed by the server test), a 2-0 with no second pick, the other player leaving during a pick, `Mabel → Bram` in the history, the panel at phone size (375x812, emulated) with a real click. Not checked: a person playing, two real people, a real phone, a two-kit hero swapped while in its other form (the forced test did not leave Pim and Pom in it). Whether a counterpick decides matches can only be judged from real matches.
- **Pushed and live on 2026-11-06:** everything from `017746b` to `6fc031d`: the designs, the version check, Loser picks (switched off), Arenas that change, the Raid (behind `?raid`).
- **Live since 2026-11-06 (build order step 2): Arenas that change** (`src/arenas/shifts/`, `docs/architecture/arenas.md`, stage 3 pictures in `docs/arenas/stage3-*.jpg`): stages at 35, 60 and 85 s, Last stand at 105 s. Temple's walls fall, its columns topple and hit for 45, then sunfire; Frost gets water channels, then sinking ice; Caldera's lava rises and covers the vent; Glade's roots rise, then thorns; Sky Ruins' floor really breaks away and the ring shrinks. CPUs keep out of the hurting floor. `PROTOCOL` is 2. Checked: `npm run test:server`, the type check and build; a CPU fight through every stage on each arena; a CPU on Caldera at stage 3 never on hurting floor (63 samples) and walking round the ridge to the hero; one online match per arena in two tabs with bots, with the clock jumped forward: each arena reached Last stand and each match finished, no errors, no pick panel, a 3 s break, and no HP difference between the screens lasting past one 0.5 s sample (657 pairs of samples). Everything stands again next round (Temple and Sky Ruins checked). Not checked: a person playing, two real people, a real phone (the floor shader is the new cost there), rounds that reach the stages at their real times online (the tests jump the clock). **Not measured:** how often real rounds reach each stage, and which heroes gain or lose: the balance run the design asks for has not been run. All the art is drawn in code, a first pass for the artist to direct.
- **Live since 2026-11-06, behind `?raid` (build order steps 3 and 4): the Raid, first boss, alone and for two** (`src/raid/`, `docs/architecture/raid.md`, plan `pipeline/designs/raid-build.md`). The Sun Warden with all three phases and nine moves, a placeholder model (Bram's, drawn twice the size). Shown only at `/game?raid`. His own arena, the Sun Court, at the user's request ("different dedicated arena for the raid"; `src/arenas/suncourt.ts`, pictures `docs/arenas/suncourt*.jpg`): radius 16, under an eclipse, not in the duel list; the temple's cover code moved unchanged into `templeCover`. For two: a room by code, the boss's HP, phases and stagger on the hub, side 0 runs the brain, falling and getting up, someone leaving. `PROTOCOL` is 3. **Checked:** `npm run test:server` plays a whole raid; the type check and build; `_raidCheck()` forces each move: what it costs, walking out, cover, the boss's own rules, the shadows drawn for Noon against what blocks the light (2.4 % of spots wrong, at their edges); all 39 heroes against the boss with no errors; all 39 heroes' four spells and attack replayed as a partner (195 replays) with no change to this hero or the boss; two tabs with bots: a whole raid cleared in 95 s at 5,600 boss HP, then one in 127 s at the final 6,500, ending with 23 and 30 HP left, with the same boss HP and phase on both screens within a report's lag, a fall and a revive, no errors; side 0 leaving mid-fight, the other screen taking the brain; after the last edits a normal CPU duel on each of the five arenas and a normal lobby match in two tabs, with no errors and Find match open again afterwards; Anchors and Shared Burden with one, both or no heroes in the gold (a late report could settle a zone twice: fixed); desktop and phone-size layouts (375x812, emulated). **Not checked:** a person playing, two real people, a real phone. **Not measured:** real difficulty. The balance autopilot cleared 8 of 34 alone before the last cut in damage; two bots cleared both full runs, the last one barely. **Known:** a hero behind the giant is hidden by it. All art is a first pass: a placeholder model, moves and floor drawn in code, the temple's props in the court. Found on the way: leaving a lobby's fight left the page offering "Back to lobby"; the hub now clears it.
- **Live since 2026-11-06, behind `?raid` (build order step 5): the run round the bosses** (user, 2026-11-06: "Continue", taken as: build it before any deploy). Ten upgrades, three seeded offers before each fight, 30 s, time out takes the first (`src/raid/upgrades.ts`, `offer.ts`). Tiers: boss HP +15 %, shown times 10 % shorter and never under 1 s, one extra move. The second boss, Ash and Ember, a tag team with one HP bar and nine moves plus the tag (`src/raid/ashEmber.ts`), in their own arena, the Cinder Pit (`src/arenas/cinderpit.ts`, picture `docs/arenas/cinderpit.jpg`). For two, the hub leads the run (`raid_offer`, `raid_stage`, `raid_won`, `raid_next`); upgrades stay on each screen. The score goes on both accounts, apart from the duel record; alone it stays in the browser. Still only at `/game?raid`. **Checked:** `npm run test:server` plays a whole run through both bosses into tier 2; `_raidUpgrades()` each upgrade's number and each tier's; `_raidAsh()` each new move, walking out, the tag, the lava at Together; all 39 heroes against each boss with no errors; through the real page alone, the upgrade cards by a real click, then a whole run in two tabs with bots: both bosses cleared in 2:44, then tier 2 at 7,475 boss HP with the upgrades kept, a partner leaving there, the other taking the brain, and the run ending with its score on the card and the profile; the upgrade screen at phone size (375x812, emulated), one card a row with nothing off screen; after the last edits one normal CPU duel through the real page at phone size (Lyra's autopilot beat Easy Mortis), no errors. **Not checked:** a person playing, two real people, a real phone, the new clear-card line on a real clear for two (its text was read from the code's output). **Not measured:** real difficulty; the numbers are starting values. The balance autopilot alone, all 39 heroes once each, no errors: the Sun Warden 24 of 39, about 96 s, damage per second 23 to 45; Ash and Ember 28 of 39, about 101 s, 23 to 41, at 3,000 HP, since raised to 3,300 so the second boss isn't the easier one (that raise not re-measured). All ten upgrades on six heroes at tier 3 against Ash and Ember: no errors, 5 of 6 cleared. These say the tier-1 fight can be won and is not free; they say nothing about a person. All art a first pass: placeholder models (Brannoc and Vesper for Ash and Ember), moves drawn in code, the caldera's props in the pit.
- **Retested 2026-11-07 (user: "retest all the functionality and refine it"), committed (`6ce58ff`, `8181c57`; `PROTOCOL` is now 4, so open tabs had to reload), pushed and live since the same day.** Real taps at phone size (375x812, emulated, touch layout on), bots for the second player, and one read-only code review. **Bugs fixed:** a click on your own portrait replaced a raid with a frozen duel on another arena and changed hero in any fight, **this one was on the live game until this deploy**: the shortcut is now the tool's only (`heroCycle`); Stone Skin and Glass Edge's HP did nothing, because a boss's share was of the max HP with upgrades (`hitBase`); a hero still down when the boss fell had the run ended under them if the partner left at the pick, with no way off the screen; being signed in elsewhere left a raid running that no longer counted; a Noon death left a flash stuck over the card, and the boss's bar stopped short of 0; the late floor's clock stopped on a fallen hero's screen, so the two screens drifted; Pim and Pom's second half was never told to the partner's screen; leaving a solo run lost its score; no way out of the upgrade screen; an empty offer showed a blank screen; a hostile client could crash the partner's frame or end the run. **Refined:** the phone starts a boss fight zoomed out; arrows to off-screen gold zones and a fallen partner; a countdown on the clear card; raid stats on the Profile; screens open at their top; Leave and Forfeit clear of the duel's bar; "1 match". **Checked:** `npm run test:server` with new cases; the type check and build; `_raidCheck`, `_raidAsh`, `_raidUpgrades` (two new checks for the HP upgrades); all 39 heroes in a normal duel before and after, no errors, no timeouts; all 39 against the Sun Warden and against Ash and Ember at tier 2 with four upgrades, no errors; a solo run by taps through both bosses, clear card and tier 2; two players through both bosses, the 30 s running out, going on to tier 2, a fall and a revive, the partner leaving at the pick, Tag Out on the partner's screen, a sign-in elsewhere; a queue match with rounds and a forfeit; a CPU duel with a summoner and a two-kit hero through the stages; every boss move looked at mid-warning at phone size. **Measured:** the autopilot alone clears Ash and Ember at 3,300 HP 23 of 39 in about 107 s and the Sun Warden 23 of 39 in about 96 s, so they are now level. A hidden tab was checked too: it keeps simulating from a timer and nothing piles up on its return. **Not checked:** a person playing, two real people, a real phone (touch was dispatched pointer events, and taps were mouse clicks at phone size), how hard it really is. **Left for the user to choose:** five things, done in the entry below.
- **The five open choices, done 2026-11-07 (user: "Yes fix all"; which way to take each was my call), committed (`73fcbd7` to `c2117a9`), pushed and live since the same day.** `PROTOCOL` stays 4: it isn't live yet, so the new messages ride on it. **The Raid shows to everyone**, in the top bar and on the login screen, in its own commit (`73fcbd7`) so it can be held back: a deploy now shows it to all. **Upgrades don't run out:** once fewer than three are left, Whetstone (8 % damage), Thick Hide (10 % max HP) and Steady Breath (cooldowns 5 % shorter) fill the cards, and each can be taken again. **Ember backs away** from a hero under 6 m, between her moves, at 2.4 m/s, round cover and off the edge and the rising lava. Backing straight into a rock cluster left her stuck at first (found by the test below, fixed in `af196e6`). **Slow, Weakened and Vulnerable on a boss count on both screens** (`boss_debuff`, `peer_debuff`); Vulnerable wasn't asked for, but had the same bug. **A boss between the camera and a hero fades** to 10 %, for this hero or the partner, the one on the rim too. The camera stays put because the controls follow it. 40 % still looked solid and hid the hero, because it blends in linear light. **Checked:** the type check, build and `npm run test:server` with new relay cases; `_raidCheck`, `_raidAsh`, `_raidUpgrades` with new checks; Ember stepped from 16 directions: none stuck, no jitter, and in Together she stayed on the safe floor; two tabs with bots: the boss walks 2.0 m/s, 1.2 m/s when slowed from the other screen, then 2.0 again; a hit of 160 became 112 when weakened from the other screen; a hit of 130 became 169 when made vulnerable from the other screen; the fade on this hero and on the partner, seen in a screenshot on desktop and at phone size (375x812, emulated); a filler card picked by a click at tier 5; Leave on the upgrade screen by a click; the autopilot against Ember on the real page, no console errors; 36 normal CPU duels with six heroes who use the changed code, no errors, every one with a winner. **Measured, autopilot alone, all 39 once each, no errors:** Ash and Ember 22 of 39 in about 124 s (23 in about 107 s before her retreat). Melee heroes clear them 36 % with the retreat (4 of 11) and 36 % without (8 of 22), at 23 and 26 damage a second, so there is no sign the retreat is why melee is low there, though samples this small can't say much. **Not checked:** a person playing, two real people, a real phone, how hard it really is, whether the fade feels right in a real fight, and whether a hero skirting the boss's edge makes it pulse. Not run on this code: the 39 heroes against the Sun Warden, and a whole run for two. **Known:** the first fade in a session builds a shader, a pause of about 50 ms on a desktop, not measured on a phone.
- **Noonfall, built 2026-11-07, committed (`cd7b5ce` to `85b0ffd` and the status commits), pushed and live 2026-11-09 (`7438db2`)** (user: "make like dedication like new place for them", "make the bosses be different than from heroes", "all should have like phases and spells to dodge", "so players can do mechanics of the boss when playing"; asked and answered the same day: one place to walk through, the same bosses with new bodies). Design: `pipeline/designs/raid-noonfall.md`; how it works: `docs/architecture/raid.md`. `PROTOCOL` is now 5, so a deploy makes open tabs reload. **The hall:** between fights a hero walks onto one of three altars to take its upgrade (or taps its card and walks there), then through the gate to the next boss, with a fade instead of menus; for two the hub's order is offer, gate, loading, fight (`raid_gate`, `raid_enter`). The boss rooms got the hall's gates, in and out; their floors and cover are as they were. **The bodies:** the Warden is a floating stone sentinel with a halo, a sun and two free fists; Ash a magma brute on his knuckles; Ember a flame in a burnt mantle with two lanterns. Rigid parts posed in code, a look per phase, built by a Blender subagent (`blender/bosses/boss_bodies.py`, sheets in `docs/bosses/`). **Mechanics players do, all by walking:** Turn the light (carry a sun shard to the altar while Noon gathers: he kneels and pays 5 %), Break the ray (Pillar Fall's stones stay 8 s, and his ray breaks on them: +40 on the gauge), Burn your own (carry Ember's mark onto the one in the ring: 4 % and +40), Seal the vent (hold the vent 4 s in Together: the lava waits 20 s, +40). What each earns is in one table the hub pays once per cast (`RAID_REWARDS`). **Found and fixed on the way:** Turn the light could never finish for two, because each screen had only its own hero's delivery and the partner's report found nothing (found by the final review; seen working after the fix in two tabs with bots: both shards, both deliveries, a kneel on both screens and exactly 5 % off); in a raid for two the hall's gate waited out its 15 s, because a tap on a card kept the hero on the altar; the autopilot walked back onto a spot something was about to hit; the cards overlapped on a phone. **Checked:** the type check, build and `npm run test:server` (new cases: a spot to the first report, rewards from the brain's screen only and once per cast, capped, the gate); `_raidCheck` 55 rows (three for Turn the light for two), `_raidAsh` 43, `_raidUpgrades` 37, with new rows for each mechanic; a solo run by real clicks through the hall's card, the gate, the Warden with his new body, then Ash and Ember; two tabs with bots through hall, Warden, hall, Ash and Ember into tier 2, a hall visit about 8 s, no errors; the hall at phone size (375x812, emulated) with a real tap on a card and through the gate; 36 normal CPU duels with six heroes, no errors and every one with a winner. **Also seen online:** a vent held by the partner holding back the lava on this screen. **Measured, autopilot alone, all 39 once each, no errors:** the Sun Warden 34 of 39 in about 98 s on the final code (23 before): turning the light takes his deadliest hit away, and at 3,600 HP he was still 33 of 39, so his HP stays 3,200 and how hard he should be waits for a person; Ash and Ember 23 of 39 in about 119 s at 3,000 HP alone (cut from 3,300, at which they fell to 17 with the mechanics). For two the HP is unchanged. **Not checked:** a person playing, two real people, a real phone, how the bodies' poses feel in a long fight (each seen on screen in passing), the glow strengths against the game's bloom (Ash's core is the brightest). **Known:** Ash's model is wider than his body, so a hit on a forearm counts only where the body is; a reward rides on the brain's screen.
- **The bosses upgraded and their lairs, 2026-11-07, committed (`4a5c895` to `6e19e6a` and the docs commit), pushed and live 2026-11-09 (`7438db2`)** (user: "Continue to upgrade them", then "make the boss room different from the arena, it is supposed to be where the boss lives"). **Bodies:** a pose sheet tool (`pipeline/tools/boss-poses.js`) showed the halo, Ash's core and Ember's flame blooming over the rest of each body; their glow is held down so the shapes read. **A move each that uses the body:** Fists of the Court (the Warden's fists fly out and land where you stood, three of them), Knuckle Quake (cracks from Ash's fists cross where you stand), Lantern Toss (Ember's lanterns burst either side of you: stand still). A move names a body action (`BossMove.body`) and the body sends a part to where its zone is (`BodyParts.toward`). Ash's body widened to 1.8 m. **The lairs:** the Sun Court is the Warden's sanctum, the Cinder Pit Ash and Ember's den, each with its own Blender prop kit (`sanctum_props.glb`, `den_props.glb`, sheets in `docs/arenas/`), floor, backdrop and air (drifting rocks and motes; embers). Every obstacle is where it was, so no move changed. The hall shows both kits. **Checked:** the type check, build and `npm run test:server`; `_raidCheck` 57 rows and `_raidAsh` 47, with rows for each new move; each new move's body seen on screen landing in its zone (a fist lands at its target at 1.4 s, the lanterns in their circles, Ash's slam over the crossing cracks); both lairs and the hall in the game page with no console errors; the sanctum's cracked and broken walls drawn from its kit; six CPU duels on the Temple, whose cover code now takes a kit, with no errors and a winner each; both lairs at phone size (375x812, emulated), the south gate and props clear of the hero. Pictures: `docs/arenas/suncourt.jpg`, `cinderpit.jpg`, `noonfall-hall.jpg`, `suncourt-phone.jpg`, `cinderpit-phone.jpg` (the old Noon picture of the temple look is gone). **Measured, autopilot alone, all 39 once each, no errors:** the Warden 32 of 39 in about 102 s after one tune (37 with two fists, before three fists and shorter pauses); Ash and Ember 26 of 39 in about 130 s. The autopilot dodges circles perfectly, so these say little about a person. **Not checked:** a person playing, two real people, a real phone, the lairs at phone size, the new moves for two (they are casts like any other), the props' look against the game's bloom beyond these screenshots. **Known:** Ember's core still glows white; the Ridge reads as a mound from above; the floating rocks are plain; the props are first pass for the artist to direct.
- **Boss stages, enrage, a soak and summons, 2026-11-08, committed (`cb1b9c4`, `2f5899f` and the notes after), pushed and live 2026-11-09 (`7438db2`)** (user: "refine how the boss works: more phases/stages and an enrage timer, and more mechanics like dodge, soak or summons"). Design and numbers: `pipeline/designs/raid-noonfall.md` ("Stages, enrage, soak and summons"); how it works: `docs/architecture/raid.md`. **Four phases each, one of them a stage at 50 %:** the Warden's **The Long Hour** (he floats behind the Sun Well, unhittable; three Hour Stones beam through one hero and then the other; break them in 32 s and he kneels, or the dial strikes for 55 % unless cover is between you and him) and Ash and Ember's **Eruption** (the one in the ring sinks into the vent, the one on the rim keeps throwing; three Coal Hearts lob lava on and round you; put them out or the vent erupts for 45 %, no cover). One move builds both (`src/raid/stage.ts`); the adds are summon units on the boss's side (looks in `src/raid/bodies/adds.ts`), with each screen's hits passed to the other (`boss_add` → `peer_add`) and each death an objective. **Enrage:** a timer in the boss's name row, 4:00; then hits cost half as much again and the quiet between moves is 60 %. **Soak:** Ember's Falling Star (10 % alone under it, 30 % split for two; 30 % / 45 % if nobody). **Checked:** the type check, build and `npm run test:server` (new: a hit on an add reaches the other screen, capped; a bad one doesn't); `_raidCheck` 88 rows, `_raidAsh` 65, `_raidUpgrades` 37, with rows for the stages (adds, unhittable, the relay, kneel, fail and its cover, a kneel landing with the phase, a big hit past two phases), Falling Star alone and for two, and the enrage; a two-tab bot raid online through the local server: both stages opened at the same moment on both screens, each add's HP matched across screens with both heroes hitting, all died on both, both knelt, no errors (the Warden fell; the Ash fight was left at 13 %); both stages seen at phone size (`docs/bosses/long-hour-phone.jpg`, `eruption-phone.jpg`); `_raidPartners` over all 39 heroes (195 replays) touched nothing, with the summon system's changes in. The online run came before two client fixes (the kneel landing with the phase, the cast bar held by the stage); those have `_raidCheck` rows. **Protocol:** the phase lists changed in `RAID_BOSSES`, inside `PROTOCOL` 5, which has never been pushed (the live server is on `d58db64`): no new number needed, and the deploy makes every open tab reload. **Fixed on the way:** a kneel landing with the stage's phase let the boss be hit before the stage came (it now stays safe until the stage's cast comes); a move from the rim took the stage's cast bar; the timer under the bar pushed the cast bar into Leave on a phone. **Measured, autopilot alone, all 39 once each, no errors:** the Warden 32 of 39 in about 114 s (102 before), every hero won the Long Hour; Ash and Ember 22 of 39 in about 130 s (26 before), Eruption won 38 of 38, after Falling Star was cut from 20 % and taken off the rim (9 of 39 with it). No fight reached the enrage. **Not checked:** a person playing, two real people, a real phone, the enrage online. **Known:** the partner's attacks are drawn at the boss while it hits an add; the adds' looks and the shell are first pass for the artist to direct.
- **The bosses made hard, 2026-11-08, committed, pushed and live 2026-11-09 (`7438db2`)** (user: "test it by playing it and make sure the bosses are hard"). Played a solo run through the real menus at the autopilot's Normal level (Bram: the Warden won at 1 HP thanks to Stubborn, then Ash and Ember killed him at 27 %; hall, upgrades, gate and the result card all worked, no errors). Then measured every hero at Normal (the stand-in for a person) and Hard: before, the Warden was beaten 64 % / 79 % of the time, Ash and Ember 38 % / 51 %, no fight reached the enrage, and the stages were nearly always won. **Now:** the Warden 36 % at Normal, 54 % at Hard; Ash and Ember 22 % and 45 % (78 fights each). **Changed:** HP alone 4,300 and 3,300, for two 8,700 and 7,100; the enrage at 2:30 and 2:50 (later at higher tiers by the HP's growth); enraged hits cost twice as much and moves come twice as often; the stage 30 s, its shots 8 %. Table and knobs: `pipeline/designs/raid-noonfall.md`, "Made hard". **Checked:** the type check, `npm run test:server` (its boss HP now read from `RAID_BOSSES`), `_raidCheck` 89 rows (new: the enrage at tier 3), `_raidAsh` 65, `_raidUpgrades` 37. **Not checked:** a person playing (the autopilot dodges better than one, so a person will find it harder), two players with the new HP, a real phone, tiers above 1 (there the stage's window shrinks with the shown times while its adds' HP grows with the boss's, so it gets harder from both sides).
- **Big effects for the bosses' mechanics, 2026-11-08, committed (`401f664`, `cf5219a` and the fix after), pushed and live 2026-11-09 (`7438db2`)** (user: "make some VFX super effect for the mechanics"). A new effect player per fight (`src/raid/fxShow.ts`, `PlayContext.show`): shockwaves, rising columns, shards, a meteor with a streak, lava arcs, floor rays, charge-ups, beam flashes, a rim-lit stage shell and the enrage's red heat; a small camera shake for the biggest moments. On every stage moment (call, shots, an add's death, the win's shattering shell, the Warden's flare and the vent's geyser on a fail), Falling Star (now a meteor), the four mechanics done right (the light turned, the ray broken, burn your own, the vent sealed), and the enrage (red blast, red heat, the bodies lit red, a red throb). Table: `pipeline/designs/raid-noonfall.md`; pictures `docs/bosses/fx-1` to `fx-7` and two at phone size. **Checked:** the type check and build; `_raidCheck` 92 rows (new: the stage leaves nothing in the scene and no effect still playing; a new boss after an enraged fight isn't red), `_raidAsh` 65, `_raidUpgrades` 37, so no zone, time or cost changed; every moment seen on screen at desktop size, the beams and the meteor at phone size (emulated); 50 frames through the geyser with no blank frame; about 10 ms a frame on this desktop in a quiet moment, 11 to 14 ms in the heaviest. **Fixed on the way:** the meteor first fell from above the top of the screen; the summon's shockwave was gold (gold on the floor means stand here); the win's column and the enraged red tint were too strong; the red tint put the boss's light back every frame and so wiped its hit flash (it now only shifts the light while enraged, and a hit still lights the boss up); a fight left with Leave while enraged left the next boss red (`_raidCheck` row). **Not checked:** a real phone (the frame cost and the first stage's shader build), a person's eye on the shake, two players (the effects run from casts on both screens).
- **Every boss attack acted out on time, 2026-11-08, committed (`cfe1ab5`, `5442d29` and the notes after), pushed and live 2026-11-09 (`7438db2`)** (user: "if the boss is attacking he should make some animation for it so that it does make sense", then "look at it closely"). **What was wrong:** a cast's pose struck at 70 % of the cast bar, so the boss hit up to 1.5 s before its zone landed; the shared figure code capped a cast pose at 2.5 s (meant for heroes), so Gathering Noon struck at 1.75 s of 8 and Sun Order, Eclipse, Pillar Fall and Falling Star early too; the pose ignored the tier; the steps of a move that overlap (Pillar Fall, Fists, Vent Bombs, Cinder Rock, Eclipse) replaced each other before they landed, so a fist sent for the first stone never came down; and the one on the rim never acted. **Now:** one strike timing for all three bosses, landing with the zone, at the tier's time, no cap for a boss; a body keeps every live step and each limb shows the step striking with it; the rim acts. New actions: Stone Sweep (the fists across the cone), Pillar Fall (a fist up, then down at each stone), Sun Order (a punch with each wedge), Eclipse (near: fists down; far: flung wide), Knuckle Quake (fists thrown down ahead, unlike Ground Slam's beside him), Cinder Rock (thrown from the rim), Vent Bombs (a lantern flung with each pair). Table: `docs/architecture/raid.md`, "Bodies". **Checked:** the type check and build; `_raidCheck` 95 rows (new: Noon's strike at 8 s, the tier's timing, two overlapping steps live together), `_raidAsh` 65, `_raidUpgrades` 37, `_raidPartners` over all 39 heroes clean (the hero figure shares this code). **Looked at frame by frame round the landing** (`pipeline/tools/boss-anim.js`, sheets `docs/bosses/anim-1` to `anim-8`), the strike and the zone in the same frame: Stone Sweep, Pillar Fall, Fists of the Court, Sun Ray, Gathering Noon, Sun Order, Eclipse, Ground Slam, Knuckle Quake, Cinder Rock (from Ash's perch on the rim), Vent Bombs and Fan (from the rim), Lantern Toss, Falling Star. **Not looked at, on the shared timing only:** Charge, Drag Under, Marked, Lava Wave, Tag, Anchors, Shared Burden. **A visible change not asked for by name:** the stages' channel pose (The Long Hour, Eruption) now holds for their whole 30 s, not 2.8. **Known:** from the camera's height Ember's lanterns are small, so her actions read less than the others'; Sun Order's punches go left and right, not at each wedge's own direction; a cast pose's wind-up fades over 0.1 s while its strike comes down over 0.18 s, a small overlap. **Not checked:** a person playing, a real phone.
- **Ash's six pillars and his one-shot Charge, 2026-11-08, committed, pushed and live 2026-11-09 (`7438db2`)** (user: "6 pillars noticeable from others, a charge attack that targets the player, the player goes behind the pillar, the boss gets stunned and there is a window to damage him, if he hits you it's a one-shot, so kill him before all pillars are down"). On Ash, whose Charge already stopped at cover. **The pillars:** the Cinder Pit's only cover now, six at 7.5 m from the vent (`PILLARS` in `src/arenas/cinderpit.ts`, drawn in code by `src/arenas/cinderPillars.ts`): basalt with veins and a crown of pale blue sun-glass, a glass ring on the floor round each; a pip each in the boss bar, red with one left. The old spires, slag walls and anvil stones are gone. **The Charge:** first 6 s in, then every 12 s Ash is in the ring, before any other move (`BossMove.due`). 3.5 s wind-up: he turns after the one he fixed on and rakes the floor; a lane runs from him through you to the rim, the pillar that would stop him lights up blue, and the floor the pillars hide shows gold. Then he runs through where you are then (aimed at that moment, so stepping aside doesn't help) and kills whoever he reaches (`Threat.lethal`: past every shield; only Sealed and Stubborn save). A pillar in his way breaks (it topples away and shatters) and he is stunned 5 s (`RAID_REWARDS.ash.charge = { stun: 5 }`, a new reward that kneels without emptying the gauge; hub `raidStun`). With no pillars left every Charge kills. **The autopilot:** a warning zone (`Threat.warn`) it never ignores, a wider and finer search for a hidden spot, and it stays hidden until the run passes. **Measured** (39 heroes twice, tier 1): level 3 21/78 (27 %, was 22 %), level 4 27/78 (35 %, was 45 %); about 3 Charges blocked a fight and 2.8 pillars standing at the end; the autopilot hides from 93 % of Charges, and most it doesn't were from 10 m or more from any hidden spot once pillars had broken. **So the pillars run out only in long fights, around the enrage at 2:50:** Ash is in the ring about half a fight. To make them the main clock: fewer pillars, a faster Charge, or Ash charging from the rim too (a bigger change: the one on the rim can't be hit). **Checked:** type check, build, server test (new: the stun on both screens, the gauge kept), `_raidAsh` 76 (new Charge rows: the wind-up hurts nobody, in the open it kills, in front of a pillar it kills, behind one it doesn't and the pillar breaks, he stops against it and kneels, a broken pillar saves nobody, a shield doesn't help, a new fight stands all six up), `_raidCheck` 95, `_raidUpgrades` 37. Pictures: `docs/bosses/charge-1` to `charge-3`, `charge-phone`. **Not checked:** a person playing, a real phone, two players online (the second screen breaks the same pillar from the cast; tested only alone).
- **Ash's pillars cut to four, 2026-11-09, committed, pushed and live 2026-11-09 (`7438db2`)** (user, given the choice after six outlasted most fights: "Fewer pillars (4)"). Four pillars on the diagonals at 7.5 m (where the old spires stood), four pips in the bar. **First try, same timing (3.5 s wind-up, every 12 s):** level 3 10/78 (13 %), level 4 14/78 (18 %), 107 of 132 losses to the Charge. The logged Charges showed why: with pillars 90 degrees apart a hero near the rim with Ash beside them can be 12-17 m from any hidden spot, and 11 of 12 such Charges killed. Unfair, not hard. **So:** the wind-up is 4.5 s at tier 1 (about 15 m of running for a person after a moment to see it) and the Charge comes every 14 s he is in the ring (still 5 s stunned, so his other moves keep a slot). **Measured** (39 heroes twice, tier 1): level 3 13/78 (17 %), level 4 21/78 (27 %); about 2.5 Charges blocked a fight and 1.5 pillars standing at the end (2.8 with six), so a slower fight does run out. Harder than six pillars (27 % and 35 %) and than before the pillars (22 % and 45 %). **Checked:** type check, `_raidAsh` 77 (new: four pillars; the positions now come from the first pillar), `_raidCheck` 95, `_raidUpgrades` 37. Pictures redone: `docs/bosses/charge-1` to `charge-3`, `charge-phone`. **Not checked:** a person playing, a real phone, two players online.
- **The Play screen remade as a hero select, 2026-11-09, committed (`f1bf868`, `755ce08`), pushed and live 2026-11-09** (user, with a screenshot of the old screen at 1920x1032: "can u remade this so it will be better"). `src/game/main.ts` (`menuScreen`, `heroShowcase`, `playBar`, `howToFight`), `src/game/game.css` (`.hs-*`). **Left:** the chosen hero on the Heroes page's turning model (the big portrait for Random), name, title, HP and melee or ranged (Pim and Pom: both), the passive and Q W E R as icons; pointing at one or tapping it explains it (range, cooldown), and the slot stays open from hero to hero; a link opens the Heroes page with that hero's row just under the header (checked at 1920 and on the phone, where the header is 134 px). **Right:** the roster. **Bottom:** one bar with Lobbies, Play vs CPU and Find match; while searching, the search and Cancel sit in that bar (no second bar over it; on the phone it wraps to two lines inside the bar). "How to fight" folds away and no longer says every hero has 600 HP. The stat tiles left the Play screen (they are on Profile; W-L is in the header). **On a desktop** it fits the window (checked at 1920x1032, 1600x900 and 1280x720: no page scroll; at 1280x720 the roster scrolls inside itself and keeps its place when a hero is picked). **Stacked** under 860 px with the bar pinned to the bottom; **on a phone** (375x812, touch emulated) a compact card, so the first row of heroes shows above the bar; the explanation is cut to three lines and a tap shows the rest. **Shared:** the hero grid now has even tiles everywhere it is used (vs CPU, Raid, a lobby, a lost round's pick), checked on vs CPU, Raid (all 40 tiles one size) and a lobby; a lost round's pick was not opened. `HeroPreview` now resizes on a height change too. Type check and build pass; no console errors. Not checked: a real phone, a person using it.
- **The CPU duel moved into Play, 2026-11-10, committed (`bf56b3c`), not pushed, not deployed** (user: "lets move the cpu page into play somewhere ttry to figure something out"). The Play screen has two tabs over the roster, Online match and CPU duel (`playMode`, kept in `localStorage` as `play.mode`); the CPU tab shows difficulty and opponent over the hero grid (`cpuOptions`) and the bar's button becomes Fight (`cpuBar`). The vs CPU tab is gone from the header and `cpuScreen` is deleted; `state.screen === 'cpu'` still exists for a player without an account (the same screen, CPU tab only, the online tab leads to the login) and as where a finished CPU fight returns (with an account it is turned into Play in CPU mode in `render`). **Checked** in the browser: a real click on the CPU tab, level and opponent change the button ("Fight Kaia · Hard"), a fight started from it and Leave duel lands back on Play in CPU mode, the online mode's bar (Lobbies, Find match), the screen without an account, phone size (no overflow); type check and build. **Not checked:** the greyed CPU tab while a search or a lobby is on (read in the code only), a real phone.
- **Interface restyle, part 1 (the menu screens), 2026-11-10, committed (`357bbfc`), not pushed, not deployed** (user: "restyle all interfaces we have make it look user friednly and exaiting"). Direction, before and after, and what is left: [ui-restyle.md](../pipeline/designs/ui-restyle.md). `src/game/game.css` is rewritten and `src/game/main.ts` changed: every menu screen on the darkened key art with embers rising; lacquer panels with a gold hairline and corner marks; gold display headings; buttons that lift, press and catch the light; a new screen rises in and the hero tiles deal in; tabs with icons. Login puts the two fights that need no account first. vs CPU and Raid use the Play screen's hero select (and get a small header without an account). On a phone the tabs sit along the bottom and the header is one line. No font file added (a display-serif stack). Sheets in `docs/ui/`. **Checked** in the browser at 1280 and at phone size (375): login, Play, vs CPU (also without an account), Raid, Lobbies, Heroes, Profile; no layout overflow; type check and build. **Not checked:** the motion itself (the browser pane was hidden, so animations stood still in the screenshots), a lobby with two players, the round pick panel, the loading page, a real phone. **Found on the way:** a Python rewrite of `game.css` left Vite serving an empty stylesheet (it read the file mid-write); `touch src/game/game.css` fixed it. **Part 2, not started:** the screens over a fight (hero panel, duel bar, result cards, touch controls, raid HUD and hall), about 80 inline styles in `src/heroMode.ts`, `src/duel.ts`, `src/touch.ts`, `src/raid/`; the shared engine files, so one writer at a time.
- **Hand-over to any computer, 2026-11-10, pushed** (user: "put everything into git hub so taht i can continue elsewhere on diffrent computer and upadte docs"). New: `CLAUDE.md` at the root (the user's rules and the lessons, which until now lived only in this computer's Claude memory, so a session elsewhere starts with them), `docs/SETUP.md` (install, clone, checks, what is not in git and how to make or copy it, deploying, Blender's path), `docs/SHOWCASE.md` (the pictures and clips), a "Start here" table in `docs/README.md`. Two tools that lived only in a temporary folder are in the repo now: `pipeline/tools/frame-sink.mjs` (saves filmed frames for `clip-film.js`) and `pipeline/tools/save-shot.py` (saves a picture a browser call returned). **Checked:** a fresh clone of GitHub `main` into an empty folder installs (`npm ci`), type-checks, builds and passes the server test.
- **News: the change log page, with pictures and clips, 2026-11-10, committed, pushed and live 2026-11-10 (`8b52de2`)** (user: "Make also new page with the change log and fill it out. And also after you are done make some representative photo and small clips"). A News tab in the game's header (the sixth tab on a phone; it fits at 375 px), also open without an account and linked from the login screen ("What's new: ..."). Content in `src/game/changelog.ts`: ten releases from 2026-10-29 to now, written as what a player has, checked against this file (left out: Loser picks, switched off; Ash's six pillars, now four; the hand-built strikes, replaced; the in-fight restyle, not built). The newest release is marked "Coming next" until it is deployed, the newest deployed one "Live now". **Keeping it:** add each change a player can see to the top release while it is `live: false`; on a deploy set `live: true` and the deploy's date (the file's head comment says how). Pictures and clips in `public/news/` (1.5 MB): three clips filmed frame by frame at true speed (`fight.mp4` Big Yoko vs Hank in a real AI duel, 5 s; `attack.mp4` Hank's chop and Oblivion's slice, 6 s; `run.mp4` Sir Whiskers, 2.3 s; H.264, muted, poster pictures, nothing loads until play is pressed) and six pictures. Clip tool: `pipeline/tools/clip-film.js` (`_clip` films a real duel, `_showClip` one hero) with a small local sink for the frames and `ffmpeg`. The standalone Node server now sends `.mp4` as video. **Checked:** type check, build (the files land in `dist/news/`), the page on desktop and at 375 px logged in and out, every picture and clip loads (durations read back), no sideways scroll, no console errors; screenshots `docs/ui/news_desktop.jpg`, `news_phone.jpg`, `news_phone_2.jpg`. **Not checked:** the clips playing on a real phone (Safari wants range requests: the live site's Cloudflare assets do them, the standalone Node server does not); the raid and arena pictures are reused from earlier docs, not new shots.
- **Hero motion replays an animator's clips (KayKit, CC0), 2026-11-10, committed (`941855c` the attacks, `aec3d67` standing, walking and running, and the commit after it), pushed and live 2026-11-10 (`8b52de2`)** (user: "Or just find some free asset for this and replicate it", then "Try it"). Standing, walking, running, every basic attack and four cast styles (`thrust`, `point`, `raise`, `channel`) are clips from the free KayKit Character Animations pack (Kay Lousberg, CC0; four clip files and the licence in `pipeline/assets/kaykit/`), baked by `pipeline/tools/bake-motion.html` to what any humanoid can follow (`src/motion/kaykit.json`, `src/motion/clips.ts`) and replayed on our rig (`HeroFigure.replay`, `Hero.turnBone` / `pointBone`). This replaces the hand-built strikes of `a3be66a` and the hand-built idle and walk. Which clip plays for which hero, how a clip is fitted to the game's attack timing and to each hero's speed, and where the copy leaves the clip on purpose (a two-hander's second hand, a tall staff, the fist guard at 60%, robes): [hero-holds.md](../pipeline/designs/hero-holds.md), "An animator's clips, replayed". **Checked:** `pipeline/tools/motion-check.js` on all 39 heroes: every limb the clip drives is within 3 degrees of the clip through the basic attack, but for the four two-handers' arms, which are moved so both hands stay on the weapon (within 0.13 m); all 39 through walk, idle and seven cast styles with no error; four AI fights with no error; strips of the hand-built casts (`slam`, `burst`, `lunge`, `swing`) over the new stances on Hank, Oblivion, Big Yoko and Zephyr, of an attack with the hero walking off after the hit, of a backpedal and a side-step; sheets beside the pack's own figure (`docs/heroes/motion_kaykit_*.jpg`); type check, build. `follow()` costs about 0.27 ms a frame per hero on the development machine. **Not checked:** a person playing; a close look from the game camera in a real match (the fight film's cells are too small to judge a pose); a phone, where the frame cost matters most; online. **Not done:** hit reactions and deaths from the pack, the cast styles `slam`, `burst`, `lunge`, `swing`, a backpedal and strafes (still the built walk), turning on the spot. **Known:** where the pack's walk and run are mixed (most heroes at their game speed) a foot on the ground still drifts: 37% of the way the hero goes for a long-legged hero at 4 m/s, 10% for a short-legged one (numbers in hero-holds.md).
- **Strikes rebuilt frame by frame against real footage, 2026-11-10, committed (`a3be66a`), not pushed, not deployed** (user: "still; it is not good and revise it agian and lets compare frame by frame with real movment of weapons from pepoles"). Real clips (a slow-motion longsword cut from the side, a man walking with one pole) were cut into frame strips in the browser, and the game filmed at the same moments (`pipeline/tools/motion-strip.js`). Against the real frames the old attack lifted straight arms, snapped back in one frame, had no reach, no lean, no step and no follow-through. Now a weapon's strike runs the real phases (`STRIKES`, `strikeOf` and `carry` in `src/heroFigure.ts`): drawn back to the shoulder, driven to full reach as the hit lands (slow off the mark, fastest at the end), carried through, recovered over 0.42 s; the body turns, leans and steps into it. Four strikes: `cut` (Oblivion, Hank, Pim), `smash` (Brannoc, Bram), `thrust` (Sir Whiskers), `sweep` (Zephyr, Gus); bare hands and claws keep the old swings. A staff swings and leans more while walking. The twins' own attack is read from the kit now (Pim was treated as ranged). Write-up with the sources: [hero-holds.md](../pipeline/designs/hero-holds.md). **Checked:** 16-frame strips of each strike beside the real frames, eight AI fights of 10 s with no error, type check, build. **Not checked:** a person playing; thrust, smash and sweep against clips of their own; casts; online (a remote attack arrives with no wind-up, so only the hit and the recovery play there).
- **Heroes hold their weapons the way people do, 2026-11-10, committed (`04a06a2`), not pushed, not deployed** (user: "lets look at all movment animation for everyonw and try to correct the weapon taht they are holding", then "reserch ho the real human hold the weapons in real life ... and reamke it"). The research, with sources, and the design: [hero-holds.md](../pipeline/designs/hero-holds.md). Before, a weapon did whatever its arm did: staffs swung with the walk, pointed backward on a cast, and every arm hung straight. Now `Hero.measureHeld` reads from each model what each hand holds, and `HeroFigure.carry` holds it by kind: a staff like a walking staff (elbow bent, tip on the ground, planted with the opposite foot), a melee sword in a guard (hilt at the hip, point at the enemy), a wand or mirror up in front, a hammer, greatsword, mallet or long axe in both hands. The weapon hand casts and attacks (mirrored for Kaia, Isolde, Vesper); a held-up weapon is cocked back and brought down. New in `src/effects/weapons/hero.ts`: `held`, `arm`, `reachHand` (two-bone reach), `steadyHand`, `slideItem` (a staff slid down through the fist at load, so a raised hand keeps its foot on the floor). The hero select's turntable (`src/game/heroPreview.ts`) now uses the same figure, at rest. Also toned down three parts that bloomed white in the game (Silvane's mirror, Mum's gloves, Barry's cloud mantle; those three models re-exported). Sheets: `docs/heroes/motion_holds_before.jpg`, `motion_holds_after.jpg`, `motion_holds_closeup.jpg`. **Checked:** all 39 on the pose sheet (idle, walk, thrust cast, basic attack), twelve AI fights of 10 s with no error, the Play screen's turntable, type check, build. **Not checked:** a person playing, each hero from the game camera in a real match, the other cast styles on every hero, a phone, online.
- **All 19 new heroes restyled, 2026-11-10, committed (`e92e193`), not pushed, not deployed** (user: "Yes, all 16", after the three pilots). Each is rebuilt as the mythic version of its job (dark cloth, gold trim, one glow in the kit's colour, a clean face); names, kits and spells are unchanged. The table of all 16 with what is still open on each: [heroes-restyle.md](../pipeline/designs/heroes-restyle.md). Built by three parallel workers into `blender/heroes/restyle_batch1.py`, `2`, `3`; exported with `blender/heroes/export_cli.py` (Blender in the background); the game loads the `_v3` files (`MODELS` in `src/heroes.ts`, the two `model:` lines in `src/kits/twins.ts`); `HERO_BODIES` follows where a build or a tall piece changed. Portraits redrawn, titles changed with the look (for example Hank "the Moss Hewer", Gus "the Temple Keeper", Pim and Pom "the Changeling Twins"), catalog pages, heroes README, `hero-mode.md` and `effects.md` updated. Sheets: `docs/heroes/lineup_39_before.jpg`, `lineup_39_after.jpg`. Tools: `pipeline/tools/hero-sheet.html` on the `sheet-dev` server (port 5175, no hot reload): `_sheet`, `_lineup`, `_size`, `_tris`, `_holds`. **Checked:** each model from the front and the game camera, the 39 lineup, eight short AI fights with no error, type check, build. **Not checked:** a person playing, the game's bloom on each model, a phone, online. **Open, the user's call:** the kit effects that stay cartoon (comic words, the FRAGILE parcel, smiling clouds) and the goofy names.
- **The new heroes restyled to the game's look: three pilots, 2026-11-09, committed (`fac86ba`), not pushed, not deployed** (user, after a sheet of all 39: "the new batch of herous are too funky", then "kinda no in the style of the game let's revise it deppply"). Why they read as another game, the rules and a re-concept for all 19: [heroes-restyle.md](../pipeline/designs/heroes-restyle.md) (the art bible's "mythic and elegant, never cartoon-goofy"; the 19 were modern-job jokes in bright plastic colours). **Built as `_v3` beside the `_v2` models and used in the game:** Barry as the Sky Augur (a storm-slate coat, a cloud mantle, a weathervane staff with a glowing orb), Big Yoko as the Mountain (the same giant dressed like a grand champion: rope belt, paper charms, crimson stole, apron with a glowing crest, plates and guards), Pip as the Wingfoot (capelet, winged circlet and heels, a pack of sealed scrolls with a glowing seal). Classes `WeatherMythic`, `SumoMythic`, `CourierMythic` in `blender/heroes/moba_figures.py`; `export("<theme>_v3")` writes `<theme>_v3.glb`. Their canvas portraits are redrawn and their titles follow the look (names kept); catalog pages, the heroes README, `hero-mode.md` and `effects.md` follow. `HERO_BODIES`: radii kept (same bodies), Barry's height 3.06 for the staff, Pip's 2.36. Sheets: `docs/heroes/lineup_39_before.jpg` (all 39 before), `docs/heroes/restyle_pilots_sheet.jpg` (old and new). **Checked:** front and game-camera renders, AI fights with the camera close (Barry against Pip, Big Yoko against Sefu) with walk, casts and arms following, a vs CPU fight on the game page, no console errors, type check and build. **Not checked:** a person playing, a phone, online. **Next:** the other 16 wait on the user, with two questions in the design note: restyle the kit effects that stay cartoon (comic words, smiling clouds, the FRAGILE parcel), and rename the goofy names.
- **Click walking and A+click refined, 2026-11-09, committed (`d70acee`), not pushed** (user: "lets refine the movement with click and that A+click autoatack"). All in `src/heroMode.ts`, plus one line in the Play screen's "How to fight" and the HUD hint. **Clicks on cover:** the mouse ray met the floor behind a pillar or wall (a 4.5 m pillar hides about 3 m of floor), so a click on one sent the hero round the far side (measured: a click on Sky Ruins' tall pillar at z 4 ordered z -2). Now the ray is walked down each obstacle (`cursorOffCover`): a walk goes where the ray meets the cover and the route stops the hero against it on the side it comes from (front: z 5.4; from behind: z 2.5), and the marker shows where it will stop; spell aims use the foot of the face under the mouse. Same check in Verdant Glade (a tree: the old point 4 m behind it, now the hero stops in front). **A held:** the basic attack's reach shows round the hero, as in League, and the enemy the click would hit gets a ring (red in reach, pale when the hero must walk up first) and the duel outline; the pick is the enemy under the mouse, else the one nearest the cursor (2.2 m), as the click itself now uses. **Attack-move:** picks up the enemy in reach nearest the click (was nearest the hero), and when that enemy goes (down, or untargetable) walks on to the click and picks up the next; before, it stood still. **Left-click on an enemy** attacks it, like right-click (it walked to the floor behind it, under the sword cursor). **A click during a dash or knockback** is kept and carried out on landing (it was dropped). **Checked by scripted clicks in a vs CPU duel with the CPU held still:** each case above with positions read back; right-click and left-click walks on open floor and S unchanged; A-click on the floor with the enemy in reach attacks at once without a step; Marin's Coral Spire aimed at an Ember Caldera pillar's top puts its circle at the pillar's front foot in her colour (not the blocked one); a held right-click dragged across that pillar to the floor beyond follows the cursor and arrives (no give-up); no console errors; type check and build. **Known:** a hero standing behind a pillar whose mouse strays onto it now aims a ground spell at its front foot, out of sight from there (before: the hidden floor on the hero's side); rare. **Not checked:** a person playing it, two enemies at once (the nearest-the-click pick is only exercised with one), touch (taps share the cover fix but were not tried), online.
- **Next in the build order:** friend brackets, then spectating. Before those, a person should play the Raid: nothing in it has been played by anyone.
- **Waiting on the user:** playing the Raid (live since 2026-11-09) and saying how hard it is, the Warden above all now; whether to raise Nyx (reported too strong before her nerf, a person playing her has not been measured) and Pim and Pom, and whether Gus, down to 33 at 39 fights after the goal rule, needs a longer run.
- **Not checked by anyone yet:** a person playing any v5 kit, a real phone, two real people online.

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
- **Friend brackets (2026-11-10, user chose it as the next build step): the server half is written, not tested, not
  committed.** In the working tree only: `server/hub.mjs` (cups: `cup_create`, `cup_join`, `cup_leave`, `cup_start`,
  `cup_pick`, `cup_ready`, the `cup` state message; byes; rooms with 60 s to pick; seats held by account name),
  `server/accounts.mjs` (tournaments won), `server/game-server.mjs` (room timings for tests), `server/protocol.mjs`
  (`PROTOCOL` 6). Still to do: the client (`src/net/client.ts` types, a bracket screen in `src/game/main.ts`, back to the
  bracket after a match), a 4-player cup in `server/smoke-test.mjs` (with a bye and a reconnect), docs
  (`docs/architecture/multiplayer.md` messages), News. **Do not deploy with these files as they are**: `npm run
  cf:deploy` builds the working tree. To set them aside: `git stash push server/hub.mjs server/accounts.mjs
  server/game-server.mjs server/protocol.mjs`.
- Older: nothing running (2026-11-03). Next: v4 batch 2. Side sessions: the multiplayer shell one is idle; the older kit
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
- Nothing blocking (2026-11-09). Push and deploy happen only when you ask:
  - Push: `git push origin feat/particle-editor:main`. GitHub `main` and the live site are both at `56b9f2b` (2026-11-10); nothing waits to be pushed.
    All commits are authored as Dextonek (old history in `refs/backup/before-dextonek`).
  - Deploy: `npm run cf:deploy` (drops every live WebSocket: running matches end). Live is `755ce08`.
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
