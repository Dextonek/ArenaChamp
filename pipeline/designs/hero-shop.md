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
