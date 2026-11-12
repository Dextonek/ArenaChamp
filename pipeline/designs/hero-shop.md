---
title: Heroes in a shop, bought with a currency earned by playing
tags: [shop, accounts, heroes, design]
updated: 2026-11-12
---

# The hero shop

## What the user asked (2026-11-12)

> "i want you to think how could we implement herous some lock in shop behind like ingame currency que this idea also and make it
> dont ask just do it"

Decided by me, as told (no questions): everything below. No real money anywhere: the currency is only earned by playing.
**Built the same night: see "Built" at the end** (what was decided where this left a detail open, the messages, what differs).

## The design

- **The currency: obols** (the old coin paid to cross into the underworld; it fits the game's mythic tone). Kept on the account by
  the server, never by the page.
- **What is free:** a starter roster of 12 heroes (two of each kind of play, among them the six benchmark heroes of the balance
  work), and every week 6 more are free to play for that week (the rotation, from the ISO week's seed, the same for everyone).
- **What is locked:** every other hero, until bought. A locked hero can always be tried against the computer (a CPU duel on the
  Play screen), so nobody buys blind. Locked heroes cannot be taken into an online duel, a raid room or a ranked Tower climb.
- **Prices:** three shelves by how hard a hero is to play well: 600, 900 and 1,200 obols. The newest hero costs 1,500 for its first
  four weeks.
- **Earning (server-counted only):** an online duel 40, a win 40 more; the first win of the day 120; a raid boss beaten with others
  60 each, a cleared tier 150 more; a new best floor in the week's Tower, online, 20 a floor (once the Tower is online; the Tower
  alone and offline earns nothing, because the server cannot see it). About one hero for an evening's play.
- **A new account** starts with 900 obols: one hero of its own choice at once.
- **Accounts that exist when the shop arrives own all 40 heroes** (they have been playing them: taking them away would be a
  betrayal). The shop then matters to them for the heroes that come later. They also get the 900.
- **No account, offline:** the starter roster and the week's rotation against the computer, in the raid alone and in the Tower.
- **The server decides.** `lobby_pick`, the queue, raid rooms refuse a hero the account does not own or have free this week. The
  page only shows: a lock on the portrait, the price, "Try against the CPU", "Buy".
- **The shop screen:** a "Shop" entry in the menu: obols at the top; the week's free heroes; then every hero as a card (portrait,
  name, role, price or "Owned"), a filter by kind; a hero's card opens its page with the turning model and its spells (the Heroes
  screen's detail) and the Buy button. Buying asks once ("Buy Nyx for 900 obols?") and cannot be undone.
- **One switch:** `shop: true | false` on the hub (as `loserPicks` is). Off, every hero is free as today and obols are still earned.
  It ships ON in the code; whether it goes live is the user's call at the deploy.

## Why these choices

- Free heroes plus a rotation plus "try before you buy" are what keeps a locked roster from feeling like a wall.
- Earning only where the server counts keeps the currency honest: a page can be edited, the hub cannot.
- Founders keeping everything costs nothing and avoids the one thing that would anger the players the game already has.

## How it is built

`server/accounts.mjs` (obols, owned heroes, the day's first win, founder flag), `server/hub.mjs` (earning at a match's and a raid's
end, the checks at pick and queue, `shop_buy`, the profile carries obols and owned), `server/protocol.mjs` (prices, starter roster,
the rotation from the week, `PROTOCOL` up), `src/net/client.ts`, `src/game/main.ts` (the Shop screen, locks in the pickers),
`src/game/game.css`, `server/smoke-test.mjs`. Together with the Raid's rewards that were waiting (ranks on the profile, the week's
raid and Tower boards): one piece of accounts work.

# Built (2026-11-12)

All of the design above is built, with the Raid's rewards (`raid-next.html`, option E). It is committed, **not pushed and not
live**. Pictures: [`docs/shop/shop.html`](../../docs/shop/shop.html). The shop is **on** in the code; whether it goes live is the
user's call at the deploy (how to switch it off: the last section).

## The decisions that were left open

### The six kinds of play, the 12 starters, the shelves

The roles of `docs/catalog/heroes/README.md` are gathered into six kinds (the Shop's filter). Two of each are starters, and each
kind's first starter is one of the six benchmark heroes of the balance work. The other 28 stand on three shelves by how hard the
hero is to play well. The table is `HERO_SHOP` in `server/protocol.mjs`: the hub and the page read the same one.

| Kind | Starters (free, for good) | 600 | 900 | 1,200 |
|---|---|---|---|---|
| Vanguard (takes the blows) | **Brannoc**, **Oblivion** | Big Yoko | Vesper | |
| Fighter (trades blows up close) | **Sirix**, Bram | Hank | | Pim and Pom |
| Assassin (in, a kill, out) | Nyx, Zephyr | Pip, Mabel | Sir Whiskers | The Great Zambini |
| Caster (mages and marksmen) | **Kaia**, Lyra | Professor Puff, Barry Cloudsley | Vitriol, Tempo, Opaline | Silvane, Anka |
| Controller (holds the foe) | **Isolde**, Sefu | Gus | Marin, Mr. Ledger, Referee Whistler | Mum, Wick |
| Support (shields, heals, summons) | **Cantor**, Auriel | Fenna, Madame Cleaver, Grandma Ironknit | Mortis, Bo | Shiori, Ada |

- 600: a kit that does what it says when the buttons are pressed (ten heroes). 900: one more thing to keep track of, a resource, a
  count or a second step (ten). 1,200: two kits, terrain, mirrors, doors, turrets (eight with Anka).
- **Anka, the newest, costs 1,500 until 2026-12-10** (four weeks from the day the shop was built), then her shelf, 1,200
  (`SHOP.newest`). If she goes live later than this build, move the date at that deploy.
- Everything together costs 24,900 obols. A duel won is 80, the first of a day 200; a cleared tier with others is 330.

### The week's rotation

Six heroes, never a starter, the same for everyone, from the week's name alone ("2026-W46", the ISO week in UTC, the same one the
Tower's seed comes from): `shopRotation` in `server/protocol.mjs`. The 28 heroes that are not starters are shuffled once for each
span of 14 weeks, and each week takes the next six along the shuffle, round and round. So every hero is free three weeks in
fourteen, and no two weeks in a row share a hero (checked over 280 weeks; where one span meets the next, a hero of the last week
steps out of the first). This week: Mum, Marin, Mortis, Pim and Pom, The Great Zambini, Ada. Anka is in the rotation like any other.

### Founders

The first time a store is opened with the shop on, the hub writes down the moment and the heroes there were (`Accounts.openShop`;
a small record beside the accounts, in both stores). **An account is a founder when it was created before that moment**, and then
owns those heroes for good. Nothing is written into the accounts themselves, so nothing has to be migrated, and the record is
written once and never moved: opening the store again changes nobody, and a hero added later is not a founder's by right. Accounts
made while the shop was switched off are founders too, when it is first switched on. Obols: an account with none stored counts as
900, so founders have the 900 as well.

### Earning, and the guards against farming

| What | Obols | Counts when |
|---|---|---|
| An online duel played | 40 | the duel lasted 30 s or more (from the first round's start), and the player did not leave it |
| A win | +40 | the same; a win because the other left after 30 s counts |
| The first win of the day | +120 | once per account per UTC day of the server |
| A raid boss beaten with others | 60 each | two or more were still in the raid as it fell, and the fight lasted 20 s or more |
| A tier cleared with others | +150 | the tier's last boss counted, and so did all three of the tier |

- **A duel under 30 s pays nobody**, which covers a foe who leaves at once and two tabs trading quick wins. **Whoever leaves a
  duel gets nothing from it**, however long it was.
- **A boss that falls in under 20 s pays nothing and counts for no rank or board.** The hub takes each screen's word for the
  damage it does (capped at 1,200 a second a screen), so two tabs could drop a boss in four seconds; nobody does it in under 20 by
  playing. This guard was not in the design; it is `SHOP.minBossS`.
- Not guarded: two accounts of one person can still play slow duels and raids against each other. The hub is fine for friends
  and not cheat-proof (`hub.mjs`, its head comment), and the same is true of obols.
- The player is told at once what the obols are for (`obols`, shown as a toast): after a duel, and in a raid as each boss falls.

### Who may play what

- **The server decides.** `lobby_pick` (a duel lobby and a raid room alike), `queue_join` and a round's hero swap (`round_pick`)
  answer `error` for a hero that is neither owned nor free this week, and for a name that is not in the table.
- **A locked hero can always be tried against the CPU**, with or without an account: the CPU duel is open with every hero.
- **The Raid alone and the Tower** start only with a hero the player may play: without an account the starters and the week's
  six. This is the page's own rule (both run offline, with no server to ask), so it is honest only as far as the page is.
- Random never draws a locked hero. A lobby's first pick is the last hero chosen if it may be played, else the first that may.

### The Raid's rewards

- **Ranks**, from the most bosses beaten in one run with others (bosses that count, as above): Ember from 1, Ash from 3, Noon from
  6, Eclipse from 9 (`RAID_RANKS`). Kept as `raids.others` on the account; shown on the profile, on the Raid screen with what the
  next rank takes, beside each name in a raid room and beside the host on the list of open raids. A founder's older best counts:
  before raids for a party every raid through the hub was for two.
- **The week's raid board**: the best runs with others of this ISO week, bosses beaten then the time, with the names of everyone
  who was in the raid for at least one of them. The top 20, one row a party (its best), kept by the server beside the accounts. On
  the Raid screen under "This week".
- **The week's Tower board**: the highest floor each logged-in player's own page reported, the top 20, on the Tower screen. **Not
  verified**: the Tower is climbed in the page with no server, so the hub cannot check a floor. It says so on the screen and in
  the code (`tower_report` in `hub.mjs`, `Accounts.boardTower`), and it pays no obols. The hub takes only this week's Tower, a
  floor from 1 to 500, a hero the account may play, and only upward. The report is sent from `src/game/main.ts` when a climb ends
  (`towerEnded`, from the Tower's `onExit`), when the Tower screen opens and at sign-in: **nothing in `src/tower/` was changed**.

## The messages (PROTOCOL 11)

| Message | Who sends it | Fields |
|---|---|---|
| `shop` | server, to every connection as it opens, and again with a session and a profile | `on`, `week`, `next` (ms), `free` (the six) |
| `shop_buy` | client | `hero` → `shop_bought { hero, price, profile }` or `error` |
| `obols` | server, when obols are paid | `earned`, `total`, `why: [{ what, n }]` |
| `boards` | client (no account needed) → server answers the same | `week`, `raid: [{ bosses, tier, seconds, names, at }]`, `tower: [{ name, floor, hero, at }]` |
| `tower_report` | client | `floor`, `hero`, `week` → `boards` when it raised the account's floor |
| `profile` (the object) | | + `obols`, `owned`, `founder`, `rank`, `tower`, `raids.others` |
| `lobby.seats[]`, `lobbies.raids[]` | | + `rank` (a raid room's names, the host of an open raid) |
| `match_end` | | + `earned` |

## What differs from the design

- **The Tower pays nothing yet.** The design's "20 a floor, online" waits for a Tower the server can see; the board is there, marked
  as not verified.
- **Without an account the CPU duel is open with every hero**, not only the starters and the rotation: "a locked hero can always be
  tried against the computer" won over the line about offline play, so that nobody has to make an account to look at a hero.
- **Two guards were added**: a boss must be fought for 20 s to count, and whoever leaves a duel earns nothing from it.
- **The switch is also a setting of each host**, so it can be flipped without touching code: `SHOP` in `wrangler.jsonc` for
  Cloudflare, the `SHOP` environment variable for the Node servers (`SHOP=off`).

## Checked

- `npm run test:server`: the 175 older checks unchanged (they run with the shop off, as they were written), and 42 new ones on
  servers of their own with the shop on: a new account's starters, rotation and 900 obols; founders (a store opened with the shop
  off, then on, then on again); a locked hero refused at `lobby_pick`, at the queue and in a raid room, and a name that is no
  hero; buying (enough, not enough, already owned, no such hero); a duel that pays, a win, the first win of the day, a second win
  the same day, the next day; a 5 s duel and a leaver earning nothing; a raid boss, a cleared tier, a boss that fell too fast; the
  rank on the profile, in a room and on the list; the week's raid board; the Tower's board; a new week (other free heroes, last
  week's locked again, empty boards); the shop off (every hero free, nothing sold, obols still earned). `node server/smoke-test.mjs
  --shop` runs only these, in about 100 s.
- `npx tsc --noEmit -p .` and `npm run build`.
- The page, headless, against its own dev server and the real hub (`python pipeline/tools/shop-shots.py`): seven socket bots play
  a duel, three raids and report Tower floors; a browser then buys a hero and takes the pictures at 1280 x 800 and 390 x 844. No
  errors in the page's console. In it a real climb is started from the Tower screen and left with a higher best floor: the page
  sends the floor with the climb's hero, and the board has the row.
- **The Cloudflare store**, on a local `wrangler dev` (not on the live worker): a new account, a refused hero, a purchase and a
  board row are still there after the worker is stopped and started; an account made with `SHOP` "off" is a founder once the
  same store is opened with it on, and a new one is not.

## Not checked, not built

- Not on the live worker, and not with the live accounts: at the deploy the live store gets a new table (`meta`) and the day the
  shop arrived; every account in it then is a founder. This was played through locally only.
- Nobody has played with it: the prices and the pace of earning are a first guess (about one 900 hero for an evening).
- The Shop on a real phone (only a headless 390 x 844 page).
- A raid for a party of bots in real browsers was not played again with the shop on (the hub's side of it is in the test).
- Not built: obols for the Tower, friends, gifts, a refund, anything bought with real money.

## The tools that play with new accounts

A throwaway account is a new account: with the shop on it may only take the starters and the week's six online. So the tools that
make such accounts start their own dev server with the shop off (`SHOP=off`): `pipeline/tools/party-raid.py` (its tenth seat
plays Hank) and `pipeline/tools/hero-gate5/` (`srv.py`). `pipeline/tools/online-bot.js` is pasted into tabs of a server that is
already running: to queue any hero with it, start that server with the shop off (PowerShell: `$env:SHOP = 'off'; npm run dev`).
`pipeline/tools/shop-shots.py` is the one that wants it on. The fight simulator, the raid tool and the Tower's tools use no
accounts and are not touched by the shop. The server test's older part runs with the shop off for the same reason.

## Switching it off

`createHub({ shop: false })` (`server/hub.mjs`): every hero is free as before, nothing is sold, obols are still earned and kept, and
the page draws no locks. On Cloudflare set `"vars": { "SHOP": "off" }` in `wrangler.jsonc` and deploy; on the Node servers start
with `SHOP=off` in the environment. Switching it on again later changes no account: the day the shop first arrived stays.
