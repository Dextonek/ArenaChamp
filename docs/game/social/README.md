# Leaderboards and clans: pictures (2026-11-14)

Two real tabs (two separate browser sessions in headless Chrome) on the local dev server, each signed in with its own local test
account read by the page from the git-ignored `server/data/test-accounts.local.json`: climber1 founded the clan Harbour Lanterns
[LAN] on its Clan screen, climber2 joined it by typing the invite code into its own, and both chatted; climber3 stayed in no clan. Eight made-up players
(Maren, Tobias, Ilsa and others; local server only) fought real 30-second duels, reported Climb and Tower floors and founded Salt
Wardens [SALT], so the boards are not empty. Desktop is 1280 wide; the phone pictures are 375 x 812. The bar of a signed-in player was measured at 700 to 1920 px wide:
Log out and all ten tabs stay inside the window at every width.
How it works: [docs/architecture/multiplayer.md](../../architecture/multiplayer.md), "Leaderboards and clans".

| Picture | What it shows |
|---|---|
| `clan-none-desktop.jpg`, `clan-none-phone.jpg` | climber3 in no clan: found a clan, join with a code, the clans looking for members, and Salt Wardens' page opened from the list (members, ratings, Ask to join) |
| `clan-chat-a-desktop.jpg`, `clan-chat-a-phone.jpg` | climber1 (the leader): [LAN] Harbour Lanterns, 2 of 30, both online (green dots), the invite code with Copy and New code, the chat with the founding and joining lines and four messages |
| `clan-chat-b-desktop.jpg`, `clan-chat-b-phone.jpg` | climber2's screen of the same room; no invite code (only the leader sees it); on a phone the chat comes first |
| `clan-members-leader-phone.jpg` | climber1 taps climber2: Mute for me, Mute in room 24 h, Make leader, Remove |
| `fight-no-chat-desktop.jpg` | climber2 in a CPU duel while climber1 writes twice: the fight only, nothing of the chat over it (the menus are hidden; checked in the page as well) |
| `after-fight-unread-desktop.jpg` | climber2 back on the menus after leaving the fight: a red 2 beside Clan in the bar |
| `unread-on-clan-tab-phone.jpg` | climber2 on the Leaderboards while climber1 writes twice: a red 2 on the Clan tab in the bottom bar; climber2's own row under the rating board ([LAN] climber2, 1000, no duel counted yet) |
| `boards-duels-rating-desktop.jpg`, `boards-duels-phone.jpg` | the duel rating, all time: Maren 1048 (3 W 0 L) to Rook 952, each with the hero played most and the clan tag; the player's own row under the list |
| `boards-duels-week-desktop.jpg` | the week's duel wins |
| `boards-raid-desktop.jpg`, `boards-raid-phone.jpg` | the week's raid board (empty on this local server: no raid was played) |
| `boards-tower-desktop.jpg`, `boards-tower-phone.jpg` | the week's Tower floors, as each page reported them |
| `boards-climb-desktop.jpg`, `boards-climb-phone.jpg` | the Climb, all time: floor and stars, with the note that it is each page's own word and earns nothing |
| `boards-clans-desktop.jpg`, `boards-clans-phone.jpg` | the clans by their members' wins this week (Salt Wardens 7), then the rating's average |
| `profile-rating-phone.jpg` | the profile's tiles, with the duel rating and the clan |
