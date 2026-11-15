# The top bar and the tabs on a phone (2026-11-15)

Before and after pictures of the game page's bar: `before-*` is the code before the change, `after-*` after it.
Names: `<when>-<who>-<width>`; `who` is `guest` (no account), `short` (a 3-letter name) or `long` (16 letters, the
longest the server allows, with 123,456 obols). Phone widths (375, 320) are the whole screen; wider ones (1920, 1280,
900, 700) show only the bar. `-more` is the More sheet open, `-codex` a screen kept in the sheet (the More tab takes its
name). `after-short-375-clan-count` shows the Clan tab's count of unread messages.

What was wrong: at 375 and 320 a long name pushed the obols and Log out off the screen (a guest's Log in too at 320), and
the eleven tabs' labels were 7.5 px. Now: four tabs and More along the bottom in 11 px letters; the other tabs, Graphics
and Log out in the sheet; the name ends in "..." and opens the Profile. Desktop is the same, except that a name only ends in
"..." when the bar has no room left for it (a 16-letter name of wide letters at 1280 px, and of the widest ones at 1920 px;
before, it pushed Log out off the edge), and a guest's Log in now fits at 900 px. (The names are random, so the "before"
and "after" names differ by a few letters.)

Checked by a script at every width: every control of the bar and the sheet inside the screen; on a phone each at least
36 px tall with text of at least 11 px.

Real taps at 375 px (Playwright, a touch phone): More opens the sheet; Profile in it opens the Profile and closes it, and
the More tab then reads "Profile"; a tap on the dark veil closes it; Escape closes it; the name opens the Profile; the
obols open the Shop; Log out in the sheet logs out.
