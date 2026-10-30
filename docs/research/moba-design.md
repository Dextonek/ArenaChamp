# What makes a MOBA, and what fits Arena of Kits

Research from 2026-10-30. The question: which ingredients define the MOBA genre, which of them a 20-30 s 1v1 duel
can use, and what Arena of Kits should do next. Sources are linked inline. **[unsourced]** marks common knowledge
that no fetched page confirmed. Several wiki pages (LoL Fandom, Liquipedia, Dota Fandom) refused access, so exact
LoL and Dota numbers are thin.

## The genre in one table

| Ingredient | What it gives the player | In Arena of Kits today |
|---|---|---|
| Heroes with fixed kits (Q/W/E/R) | Identity and depth: learning matchups is the long-term skill | ✅ 20 heroes, 4 spells each |
| Roles (tank, support, carry, mage) | Team-composition puzzles | ➖ In 1v1 these shrink to archetypes: burst, sustain, zoner, mobile, melee |
| Lanes, minions, last-hitting | A steady economy and a timing skill | ❌ None |
| Gold and items | Build choices inside a match, a power curve | ❌ None |
| Levels, XP, ability ranks | A feeling of growth | ❌ None |
| Towers and objectives | A goal besides kills, map movement | ❌ None: the only goal is the other hero's HP |
| Fog of war and vision | Information play: flanks, ambush | ➖ Pillars and walls block sight; targeted spells need it |
| Jungle and neutral camps | Another way to gain power | ❌ None |
| Team fights | The spectacle and the main skill test | ❌ 1v1 |
| Comeback mechanics | Stop the leader from snowballing | ❌ None (nothing snowballs either) |
| Match length | 30-40 min (PC); about 15-20 min reported for Wild Rift | 20-25 s |

**[unsourced]** for the pillar descriptions: no single primary "definition of MOBA" exists. Wild Rift's length is
from pre-launch press ([Gfinity](https://www.gfinityesports.com/league-of-legends/league-of-legends-wild-rift-differences-pc-mobile/)).

## What the smaller formats kept and cut

Every short MOBA-like format keeps **heroes, kits and aiming skill**. Each one cuts or flattens the economy and
growth. Each one then has to replace the "somewhere else" that normally absorbs a lost fight.

- **Heroes of the Storm** cut gold and items. Items had to work on every hero, so they kept getting weakened. Talents
  at levels 1/4/7/10/13/16 and team-shared XP replaced them, so each hero stays "self-contained"
  ([Blizzard, From the Bullpen](https://news.blizzard.com/en-us/article/14665104/from-the-bullpen-designing-the-talent-system),
  [Kotaku](https://kotaku.com/why-blizzard-ditched-in-game-items-for-heroes-of-the-st-1713378237)).
- **League of Legends Arena (2v2 teams)** is the best-documented small format
  ([Riot dev post](https://www.leagueoflegends.com/en-us/news/dev/dev-arena/)):
  - **Rounds:** a short buy phase, then a fight; last team standing wins the round, and a team is out after enough lost rounds.
  - **Equal power growth:** everyone grows at about the same rate, because in a small arena there is no "elsewhere"
    to cash in an early lead, and fighting from a big deficit "wasn't fun".
  - **Small arenas favoured melee** (no turrets, closed space), so Riot added *Power Flowers*: pickups (heal, shield,
    cooldown) that ranged heroes can pop from a distance.
  - **Water blocks movement but not sight**, so nobody can hide in a pocket.
  - **Variety:** with few arenas, players moved the same way every round, so Riot added random "Cameo" events.
  - **Ranked:** the first five games can't lose points.
- **Battlerite / Bloodline Champions (Stunlock)**: no levels, gold or items; every ability is aimed and can be
  dodged, no target lock; short 2v2/3v3 fights ([PC Gamer](https://www.pcgamer.com/battlerite-review/),
  [Ten Ton Hammer](https://www.tentonhammer.com/articles/bloodline-champions-pc-review)). These are the nearest
  relatives of Arena of Kits. No developer postmortem was found.
- **Smite Joust / Duel**: 3v3 and 1v1 on one lane, but still 15-30 minutes because the economy stays
  ([Smite 2 wiki](https://wiki.smite2.com/w/Game_Modes)).
- **Pokémon Unite** replaced towers and minions with scoring goals and simplified controls for phones
  ([Pokémon.com](https://www.pokemon.com/uk/pokemon-news/pokemon-unite-delivers-strategic-team-battles-on-nintendo-switch-and-mobile-devices)).

Even the "short" formats last minutes. A 20-25 s duel is far shorter than anything documented, so the closest
precedent is a **series of short rounds** (LoL Arena), not a shorter single match.

## Spell design conventions, compared with ours

| Convention | Source | Arena of Kits |
|---|---|---|
| Every ability needs an answer (dodge, block, cleanse, break sight); a loss should teach, not feel unfair | [Riot, Quick Gameplay Thoughts](https://www.leagueoflegends.com/en-us/news/dev/quick-gameplay-thoughts-may-14/) | Partly: skillshots, dashes, shields, pillars. Targeted spells with sight can't be dodged |
| Skillshots reward aim; targeted spells need a cost (short range, cast time, long cooldown) | Battlerite / Bloodline design; **[unsourced]** for the rule | Mixed: many spells are targeted at the enemy |
| Cooldowns are the readable resource; mana is a slow tax | **[unsourced]** | Cooldowns only. Right for 20 s: mana would never matter |
| The ultimate is the match-defining moment | **[unsourced]** | R has a 20 s cooldown on every hero: exactly once per match |
| Limit crowd-control chains: LoL tenacity (min 0.3 s CC, multiplicative), Dota status resistance | [LoL wiki, Tenacity](https://wiki.leagueoflegends.com/en-us/Tenacity), [Liquipedia](https://liquipedia.net/dota2/Slow_resistance) | ✅ 0.5 s immunity after a stun or knock-up. Root, slow, silence and blind can still chain |
| Clear telegraphs and short cast times make dodging a skill | Riot Arena wants fights "reasonably understandable" | Danger zones exist; cast times vary per spell |
| Typical speeds: Dota heroes 100-550 units/s (Windranger 285) | [Liquipedia, Max Move Speed](https://liquipedia.net/dota2/Max_Move_Speed) | 4 m/s since today: in the same feel range (MOBA units are not metres) |

Our cooldowns by slot, across all 20 heroes: Q 2-3 s (average 2.8), W 6-9 s (7.4), E 9-12 s (9.6), R 20 s. In a
20-25 s match, Q is the rhythm, W and E come up two or three times, and R once.

## Recommendations for Arena of Kits

In order of value for the work involved:

1. **Best-of-3 rounds per match** (first to two round wins, a few seconds between rounds). This is LoL Arena's answer
   to "one fight is too random and too short". It triples a match to about a minute without adding systems, and
   the AI duel already counts rounds. The server would add a `round_end` message and keep `match_end` for the
   match result.
2. **Make every targeted spell answerable** (check against the hero-role redesign in progress,
   `pipeline/designs/hero-roles.md`, which already turns many slots into skillshots, traps and dashes).
   Either a short cast time with a visible wind-up (so a pillar or dash
   breaks it), or keep it targeted but give it a clear counter (shields absorb it, or line of sight is re-checked at
   impact, not only at cast). This is Riot's counterplay rule and the biggest fairness gap now that heroes walk slowly.
3. **Extend chain protection** to roots and silences (for example 50% shorter when one hits within 2 s of another).
   In 1v1 a chain decides the whole fight; there is no teammate to help.
4. **Ring pickups**, one or two per round (heal, shield, cooldown reset), placed so ranged heroes can claim them from
   a distance. This copies the *Power Flowers* fix for "small arenas favour melee", and it gives a reason to move
   around the pillars. Check melee vs ranged win rates first with the existing tournament tool.
5. **Round variety:** a different ring layout or modifier per round. Riot saw players repeat the same movement with
   only four arenas. *In progress:* five random arenas are being built (`pipeline/designs/arenas.md`); with
   best-of-3, each round could use a different one.
6. **A simple rating** (Elo per account, shown on the profile; the first five games can't lose points). A 1v1 result
   maps straight to a rating, and the server already records every match.
7. **Hero pick, not draft.** A ban phase would last longer than the fight. A "random hero" button is enough variety.

**Don't add** lanes, minions, gold, items, levels or XP, jungle, towers, fog of war or mana. Each needs minutes to
matter, and HotS and LoL Arena both show that cutting or flattening them works.

## Gaps

No primary source was found for Battlerite or Bloodline Champions design, Dota 2's 1v1 rules, Pokémon Unite's match
length, or classic diminishing-returns numbers. Next places to look: the Stunlock Studios devblog and the GDC Vault.

## See also

- [Game networking research](game-networking.md): the other half of this research
- [Combat mechanics](../architecture/mechanics.md): statuses, CC immunity, skillshots, summons
- [Multiplayer duel game](../architecture/multiplayer.md)
