---
title: League kit design
tags: [knowledge, kits, design, research, league-of-legends]
updated: 2026-11-04
---

# League kit design

**League wins on answers, not ideas.** League's kits are good because almost every strong thing in them comes with a price and an answer the other player can actually use. (A kit is one hero's full set of abilities.) The gap with our 20 kits is real, but it is smaller and more exact than the feeling that League is far ahead. Our ideas hold up: every hero has one clear idea, and by the comparison note's reading 14 of 20 ultimates raise that idea. League is really ahead in four places: its strongest moments carry more of an answer, its buttons hold a second decision after the press, its state is easier for the opponent to see, and its weaknesses have been tested on people. The first three can be fixed in the design, and for the 15 kits not yet built the fix costs only a text edit today. The fourth cannot be fixed by any document: League has more than fifteen years of play and live data, and nobody has yet played our kits with a person. Part of the feeling also has another cause: 15 of our 20 heroes still run older kits in the game, and every fight so far is against a CPU that cannot test a weakness. Designers building the next 15 kits can start with the checklist and the ranked list at the end.

## Every claim here shows how far you can trust it

The notes behind this report were read through a tool that summarises web pages. Exact wording and small numbers can be off, so check them at the source before you quote them further. All source text is paraphrased, with one short quote in the whole report. Where the notes found no Riot source, the report says so.

The full notes sit beside this report: [riot-design-values.md](league-research/riot-design-values.md), [kit-anatomy.md](league-research/kit-anatomy.md), [reworks-and-failures.md](league-research/reworks-and-failures.md) and [our-kits-comparison.md](league-research/our-kits-comparison.md). The catalogue of all 173 kits is [league-champion-kits.md](league-champion-kits.md). Slot letters and cooldowns for League examples come from that catalogue unless another source is linked.

| Source label | What it means |
|---|---|
| **Riot** | Written by Riot and read on Riot's own site. |
| **Riot, mirror** | Riot's text read on a community site that reposts it, such as Surrender at 20. The site is not the author. |
| **Riot via wiki** | A Riot post read as copied on a League wiki development page. |
| **Riot designer, outlet** | A named designer reported by a news site or tracker. The words are the designer's, the framing is the outlet's. |
| **Excerpt** | Seen only in a search summary. The page itself was not read. This is the weakest grade. |
| **Wiki** | The community wiki. Used for game mechanics only. |
| **Community** | Players, guides and opinion writers. Never used to show what Riot intended. |
| **Notes' reading** | Our researchers' own inference. No Riot statement stands behind it. |

Each principle below ends with a verdict: it transfers to a 1v1, or it depends on 5v5 (League's normal game of five against five). These verdicts are our judgement. Riot did not make them, and no source tests them in a 1v1.

| Word | Meaning in this report |
|---|---|
| P, Q, W, E, R | League's five ability slots: a passive (always on), three basic buttons, and the ultimate (R), the biggest one. |
| Cooldown | The wait before a button works again. |
| Skillshot | A spell you aim in a direction. It can miss. |
| Targeted | A spell you aim at a person. Once cast it cannot miss: a sure hit. |
| Telegraph | A visible warning before a hit lands. |
| Crowd control (CC) | Effects that limit the target. Hard CC takes away action (stun, root, knock-up). Soft CC only weakens it (slow, blind, silence). |
| Kite | To stay out of an enemy's reach while hitting them. |
| Recast | A second press of the same button, with a new effect. |
| Refund | A hit that gives back cooldown or resource. |
| Bait | To make the opponent waste a key spell with a cheap or fake move. |
| Floor, ceiling | Floor: the skill needed to play a kit at all. Ceiling: the extra power that practice can earn. |
| Tag | A label our researchers gave an ability, such as dash or shield, so that kits could be counted. |

## Fourteen principles explain the quality, and most survive in a duel

Riot wrote most of these as goals, not as a description of the game. Morello's 2014 values blog calls them a direction and says many existing designs fail them ([Riot, mirror: Design Values, 2014](https://www.surrenderat20.net/2014/05/red-post-collection-design-values-of.html)). So League is not a set of perfect kits. It is a set of kits measured against these goals for a long time, with the worst ones rebuilt.

Riot gives direct statements for most of these principles. Principles 4, 6, 7 and parts of 5 and 8 are the notes' reading of the kits, and they say so.

### 1. One sharp strength, paid for by a weakness the opponent can reach

This is Riot's most repeated rule. Scruffy says Riot avoids the jack-of-all-trades kit by pairing a very sharp strength with a clear weakness that players can reach. Mordekaiser and Sett are very strong fighters, but they can be kited. Senna and Aphelios have huge range and utility, but cannot escape an assassin ([Riot: Quick Gameplay Thoughts, April 2020](https://www.leagueoflegends.com/en-gb/news/dev/quick-gameplay-thoughts-april-17/)).

In 2021 he set a limit. A weakness should give a moderate disadvantage, not a complete counter, because a complete counter takes away the player's power to change the result ([Riot: Quick Gameplay Thoughts, May 2021](https://www.leagueoflegends.com/en-us/news/dev/quick-gameplay-thoughts-may-14/)). The most useful test comes from the notes: in what situation is this kit bad? Riot's complaint about K'Sante fits that test. He was too safe and too reliable in nearly any situation ([Riot: Patch 14.19 notes, September 2024](https://www.leagueoflegends.com/en-us/news/game-updates/patch-14-19-notes/)).

The notes disagree on one point. The anatomy note recommends breadth inside each kit, from Jag's argument that a kit with one narrow strength is too binary in a long lane ([Riot, mirror: Jag, December 2016](https://www.surrenderat20.net/2016/12/red-post-collection-dev-blog-on.html)). The comparison note rejects this for rounds of about 20 seconds. It asks for breadth of answers (one way in, one way out), not breadth of tools ([our-kits-comparison.md](league-research/our-kits-comparison.md)). This report follows the comparison note, because a 20-second round is not a long lane. Nobody has tested either view.

**Duel: transfers, and matters more.** No teammate can use the weakness or cover for it.

### 2. Counterplay lives in a moment you can read, and stronger effects carry more of it

Scruffy defines counterplay as an action, choice or strategy that lets a player "mitigate or overcome an enemy threat" ([Riot: Quick Gameplay Thoughts, May 2021](https://www.leagueoflegends.com/en-us/news/dev/quick-gameplay-thoughts-may-14/)). He gives two benefits. A loss feels fairer when a clear answer existed, even if you could not yet execute it. And fights become exchanges of skill, not single events.

He splits it in two. Tactical counterplay happens in the moment: dodge a skillshot, break a channel, react to a long windup. Strategic counterplay happens before the fight: counter items, invading a weak jungler, grouping against an assassin. Tactical counterplay matters most for high-impact moments, and it works best when anyone can use it, not only heroes with a dash. Too much of it makes a kit clunky, so not every spell needs it.

The best League example is Ashe's R. Its stun grows with the distance it flies, and that same distance gives more time to dodge. Riot uses it to show that a stronger effect should carry more counterplay.

Sure hits are not banned. Ghostcrawler says the value is broken when you have no options at all, not simply because one combo is hard to counter. Zenon accepts Annie's targeted Q because its range is short. The same blog also asks designers to avoid hard counters and abilities that leave no room to react ([Riot, mirror: Design Values, 2014](https://www.surrenderat20.net/2014/05/red-post-collection-design-values-of.html)).

**Duel: tactical counterplay transfers, strategic counterplay depends on 5v5.** Cover can do the job that standing behind allies or minions does in League. That is our extrapolation. No Riot source discusses it.

### 3. Every tool is paid for: power budget, overload and mobility

**Power budget.** The notes found no formal Riot definition. The nearest is Phroxzon in 2023: Riot balances a champion's total power across kit, items, summoner spells and runes, so a large share in items leaves less for abilities ([Riot: Addressing Mythics, September 2023](https://www.leagueoflegends.com/en-us/news/dev/quick-gameplay-thoughts-addressing-mythics/)). The idea is clear in use. Riot Llama says Skarner's basics were deliberately weak to pay for his R ([Riot: Champion Roadmap, October 2023](https://www.leagueoflegends.com/en-us/news/dev/champion-roadmap-october-2023/)). Xenogenic says cutting ghost control from Mordekaiser freed the budget that lets his Q hit so hard ([Riot: Ask Riot, July 2020](https://www.leagueoflegends.com/en-us/news/dev/ask-riot-winter-on-the-rift/)).

**Overload.** The notes disagree about this word, and neither found a formal definition. One note found Scruffy, in replies to his own 2016 post, naming four costs of overloading a kit: more complexity, messy tooltips, patching over weaknesses the champion should have, and power spread so thin that the core cannot shine. He also agreed that Ekko is overloaded ([Riot, mirror: Champion Gameplay Values, February 2016](https://www.surrenderat20.net/2016/02/red-post-collection-scruffy-on-champion.html)). Meddler is reported using the idea for Gnar ([Riot, mirror: Champion Prototypes, October 2016](https://www.surrenderat20.net/2016/10/red-post-collection-champion-prototype.html)).

A second note found no Riot post using the word for newer kits such as Yone, Viego, Briar, Zeri or K'Sante. There Riot says too safe or too many options, and the word overload comes from community writing ([reworks-and-failures.md](league-research/reworks-and-failures.md)). The older readings came through a mirror and a summarising tool, so treat the exact word as unconfirmed. Community writers also split on whether overload is bad at all ([Community, excerpt: RiftFeed](https://riftfeed.gg/champions/overloaded-kits-in-league-of-legends); [Community, excerpt: Tech4Gamers](https://tech4gamers.com/why-i-think-overloaded-character-kits-are-good-for-league)).

Ryan Scott gives the simplest form: complexity is a cost, so add as little as you can for as much depth as you can ([Riot designer, outlet: GamesBeat, March 2015](https://gamesbeat.com/league-of-legends-developer-on-fighting-with-fun-depth-and-complexity/)).

**Mobility** is the sharpest case, and Scruffy writes it in 1v1 terms. Mobile champions should be weaker elsewhere, in range, damage or defence, so they cannot easily win a 1v1 against less mobile foes. Good forms have a constraint (Yasuo's E cannot hit the same target again for several seconds) or a very long cooldown (Flash). Poor forms break a class weakness, go past the normal range and speed, or are free-aimed on a low cooldown ([Riot: Quick Gameplay Thoughts, May 28 2021](https://www.leagueoflegends.com/en-us/news/dev/quick-gameplay-thoughts-may-28/)).

**Duel: transfers, and matters more.** With no items, runes or summoner spells, the whole budget sits inside the kit. League's limits based on minions must be rebuilt around cover or targets. That substitution is ours.

### 4. A ladder of time: a rhythm tool, commit tools, one turning point

No Riot source states a budget per slot, so this shape is the notes' reconstruction from the kits. At first rank, the median League kit has Q 8 s, W 14 s, E 13 s and R 120 s. Q is the shortest basic in 72% of kits. R is a median 6.7 times the longest basic ([counts in the catalogue](league-champion-kits.md#counts-across-the-roster)).

The short button sets the rhythm. The middle buttons decide when someone can really commit. R is the turning point. Zed shows it well: Q every 6 s, W at 20-16 s gates his whole pattern, and E trims W. Many kits also keep one price button, where the opponent can read the fight. Ezreal's E at 26-14 s is his only button with a real price. Fiora's W at 24-16 s is her long answer, and the opponent must guess whether it is up.

Jag contrasts two melee shapes. A kit that sticks to its target either snowballs or fails. A kit with short bursts and downtime between them needs repeated outplays to win. He also names the cost: being traded on every 5 to 10 seconds tires a player, and so does tracking many separate cooldowns ([Riot, mirror: Jag, December 2016](https://www.surrenderat20.net/2016/12/red-post-collection-dev-blog-on.html)). A community critic argues that cooldowns alone carry only opportunity cost, and that startup, recovery and travel must carry the rest ([Community: The Cooldown Effect, August 2016](https://critpoints.net/2016/08/18/the-cooldown-effect/)).

The notes group these downtime moments as windows of weakness. That phrase is not Riot's: the notes found no Riot source that uses it, though the idea appears under other names.

**Duel: the shape transfers, the numbers do not.** A 120-second R spans fights we do not have. Mana's pacing job also disappears with a full reset between rounds. Only its cost for a miss survives.

### 5. One idea: the kit delivers the theme, and the player can name one question

Scruffy's early screen asks whether the theme speaks to the intended players and whether the gameplay delivers on it ([Riot: Quick Gameplay Thoughts, September 2020](https://www.leagueoflegends.com/en-us/news/dev/quick-gameplay-thoughts-september-4/)). Riot says a slow on Void Spike turned Kha'Zix into a kiting champion, against his fantasy ([Riot: Balancing for Pro Play, August 2020](https://www.leagueoflegends.com/en-us/news/dev/dev-balancing-for-pro-play/)). August says he will change a kit to fit a theme the artist or writer considers important, as with Jhin's death effects ([Riot designer, outlet: PCGamesN, 2016](https://www.pcgamesn.com/league-of-legends/designing-a-league-of-legends-champion-sometimes-you-get-vayne-and-sometimes-you-get-yorick)). That matters for an art-led game like ours.

The notes' reading goes one step further: kits that stand out ask one simple question. Fiora asks where she hits you. Camille asks when she comes back. Riven asks what she does between swings. Sett asks how much he lets you hit him. The memory then comes from one visible thing: the weak spot, the Grit bar, the shadow, the count of four, the ball ([kit-anatomy.md](league-research/kit-anatomy.md)). Katarina's daggers do this too. They are her route and her tell at once, and the patch notes say the update was meant to show her movement to opponents ([Riot, mirror: 6.22 notes](https://archive.runeterra.net/na/riot-official/chOkE7Z4)).

**Duel: transfers.** Theme needs no team, and a duel shows a kit's question plainly. Riot's strategic identity (a reason to pick a champion for a team) depends on 5v5. It only transfers if restated as a matchup niche.

### 6. The passive is a rule of play, not a bonus

This is the notes' reading of individual kits. The notes found no general Riot theory of passives. The best passives change where you stand or how you attack. Fiora's weak spot makes every trade about the angle. Jhin's four-shot reload forces a pause the opponent can use. Twin Enso says Sett's alternating punches change how players think about positioning, since he wants to take damage up front ([Riot: Champion Insights Sett, January 2020](https://www.leagueoflegends.com/en-us/news/dev/champion-insights-sett/)). Zileas uses Yasuo's Flow bar as his example of mastery ([Riot, mirror: Depth of Mastery, July 2014](https://www.surrenderat20.net/2014/07/red-post-collection-in-depth-with.html)).

There are two warnings. Riot judged Aurelion Sol's star passive too far outside the norm, so it reached only a small audience ([Riot, mirror: Scruffy, February 2017](https://www.surrenderat20.net/2017/02/dev-on-champions-of-2016.html)). And a passive should not argue with the buttons. A Blitzcrank rework aimed to stop discouraging spell use ([Excerpt: GosuGamers](https://www.gosugamers.net/lol/news/48939-big-blitzcrank-changes-are-headed-to-league-of-legends-pbe)).

Rule passives are League's best cases, not its average. By tags, 51% of League passives carry a plain buff.

**Duel: the rule transfers.** Passives that feed on kills, minions or long games (Thresh's souls, Ahri's stacks) depend on 5v5.

### 7. The ultimate raises a verb the kit already teaches

The notes found no Riot theory of ultimates, so the two groups here are the notes' reading. The first group raises something the kit has already taught. Riven's R extends the reach of her Q and W. Jhin's R repeats his four-shot rule. Fiora's R reveals all four weak spots at once. About half of the twelve kits sampled do this. The second group changes the state of the fight, such as Camille's hex zone or Sett's carry and slam.

The counts show the variety: 79% of ultimates deal damage, 36% have hard CC, 29% are self-cast, 22% have a recast and 17% are channels. So the big stun is common, but it is not the rule.

There is one warning. Players remembered Skarner's R and little else ([Riot: Searching for Skarner's Sting, March 2023](https://www.leagueoflegends.com/en-gb/news/dev/dev-searching-for-skarner-s-sting/)). Poppy's old R defined her whole kit and forced the rest to stay weak ([Riot via wiki: Champion Insights Poppy](https://wiki.leagueoflegends.com/en-us/Poppy/Development)).

**Duel: transfers.** Treat R as a once-per-round moment. Level gates at 6, 11 and 16 and kill rewards depend on 5v5, since a kill ends the round.

### 8. A second decision after the press, so that a miss costs something

Lee Sin's basics each have a cheap second press, within about 3 seconds ([Wiki: Lee Sin](https://wiki.leagueoflegends.com/en-us/Lee_Sin)). It asks a real question: is this worth following up? Camille's second Q pays far more if she waits, and waiting is when she is most exposed. Riven's three Q casts share one cooldown, so they form one burst window. Refunds work the same way. Fiora's Q halves its cooldown when it hits, Zed's E shortens his W, and a hit with Ezreal's Q takes 1.5 s off his other spells.

The roster is full of this. Recast appears in 47% of kits, on every slot (Q 15%, W 12%, E 14%, R 22%). Cooldown refunds appear in 27% and attack resets in 26%.

Riot Axes gives the reason. A missed high-impact spell should cost something, and mana makes a missed Blitzcrank hook costly. Cooldowns alone can raise the stakes only so far ([Riot: Ask Riot, July 2021](https://www.leagueoflegends.com/en-us/news/dev/ask-riot-manaless-champions/)). In a game with no mana, second presses, refunds and recovery time must do that job. One cheap form, in the catalogue's reading, is one resource with two exits. Tahm Kench spends three stacks on a stun or a swallow. Syndra's spheres are a stun now or R damage later.

There is a limit. Free reset chains leave no opening. Xypherous rejected a Riven idea in which abilities and attacks reset each other ([Riot via wiki: Riven development](https://wiki.leagueoflegends.com/en-us/Riven/Development)). Riot's retrospective says Kled's Q-to-E combo weakened the counterplay to his tether ([Riot, mirror: February 2017](https://www.surrenderat20.net/2017/02/dev-on-champions-of-2016.html)).

The notes disagree on Riven. The anatomy note holds her up as a model. The catalogue calls her depth a weakness, because it rests on animation cancelling, which only secondary sources describe. This report takes the weave (attacks between spells) and leaves the cancels. Riot's own evidence supports this: Irelia's E was nearly guaranteed for experienced low-ping players and hard for others, so Riot fixed its timing even though a unique combo was lost ([Riot: Quick Gameplay Thoughts, June 2021](https://www.leagueoflegends.com/en-gb/news/dev/quick-gameplay-thoughts-june-25/)).

**Duel: transfers.** It needs only two players.

### 9. Short locks, little forced movement, and always a window to react

Scruffy says a crowd-controlled enemy should always have a brief window to react, neither helpless nor already dead. He also says the damage-to-CC ratio matters more than raw CC. Low damage can carry a lot of CC, as on Nautilus, while high burst makes even short CC a problem ([Riot, mirror: Q&A, January 2015](https://www.surrenderat20.net/2015/01/red-post-collection-riotscruffy-q-on.html)). On the duelist kits, hard locks on basics are short: about 0.75 s on Riven's W and Camille's dive, about 1 s on Sett's E ([kit-anatomy.md](league-research/kit-anatomy.md)).

Forced movement has a similar cost. Sett began as a grappler who seized and moved opponents. Riot Axes says this caused clarity problems and frustration and was costly to animate, so it was cut ([Riot: Champion Insights Sett, January 2020](https://www.leagueoflegends.com/en-us/news/dev/champion-insights-sett/)). Only 16% of League kits have a pull.

**Duel: transfers with full weight.** One lock removes all the agency of the only opponent. A pull also takes the target out of cover.

### 10. Sustain must not undo an exchange you already won

Phroxzon says healing is a problem when it breaks a champion's intended counterplay, even at a balanced win rate. Sustained burst healing is the worst case, because it rewards standing in damage. Aatrox could miss half his spells against a kiting player and still return to full. Kayn's red form is his workable example: easy to kite, and he must land spells to heal ([Riot: Quick Gameplay Thoughts, July 2022](https://www.leagueoflegends.com/en-us/news/dev/quick-gameplay-thoughts-7-29/)).

Heal appears in 49% of League kits. Do not read that as a target. The comparison note links much of it to lane sustain, which we do not need.

**Duel: the principle transfers.** League's remedy, an anti-heal item, does not.

### 11. The opponent can see the state and need not study

Riot defines clarity as being able to understand what is happening and respond to it. It sets three goals: visuals and audio convey the gameplay, the most important thing draws the most attention, and noise stays low. Its negative example is Arcane Comet, whose large ground circle suggests more chance to dodge than it allows. Hitboxes must match their effects ([Riot: Clarity in League, March 2021](https://www.leagueoflegends.com/en-us/news/dev/clarity-in-league/)).

Scruffy adds a firm limit: playing as a complex champion is opt-in, but facing one should not need extensive study ([Riot: Quick Gameplay Thoughts, October 2020](https://www.leagueoflegends.com/en-au/news/dev/quick-gameplay-thoughts-october-30/)). The cases follow this. A later Ryze update said only the expert could read his power windows ([Riot via wiki: Ryze development](https://wiki.leagueoflegends.com/en-us/Ryze/Development)). Irelia's stacks were made visible to enemies in 2021 ([Riot, June 2021](https://www.leagueoflegends.com/en-gb/news/dev/quick-gameplay-thoughts-june-25/)). Zeri's stacks were made more predictable in 2022 ([Riot: Patch 12.7 notes](https://www.leagueoflegends.com/en-us/news/game-updates/patch-12-7-notes/)). The 2022 durability update lists knowing what killed you as a goal ([Riot: Quick Gameplay Thoughts, May 2022](https://www.leagueoflegends.com/en-us/news/dev/quick-gameplay-thoughts-5-6/)).

There is another side. Jag says some hidden information, such as whether Lee Sin still has Flash, makes high-risk plays possible ([Riot, mirror: Jag, December 2016](https://www.surrenderat20.net/2016/12/red-post-collection-dev-blog-on.html)). Morello asks for transparent mechanics. Both can hold: a small unknown is a mind game, while a hidden core state is homework for the opponent.

**Duel: transfers, and binds harder.** One opponent carries all of it, with no teammate to call it out. Cover makes this harder still, because a hidden timer is even harder to track when sight breaks. That last point is our reasoning, not Riot's.

### 12. Cannot be hit stays scarce, and no single interaction blanks a kit

Meddler says Akali's untargetability in her shroud under towers cost too much in counterplay and frustration, and that the team was divided over it for a long time. He says this class of champion needed more meaningful weaknesses ([Riot, mirror: Quick Gameplay Thoughts, January 2019](https://archive.runeterra.net/na/developer-corner/RgwqT7KP)). Riot later called her true invisibility unhealthy and removed it ([Riot: Balancing New Champions, July 2020](https://www.leagueoflegends.com/en-us/news/dev/dev-balancing-new-champions/)). The Mel case in the failures section below is the newest example.

The counts make this exact. Untargetable appears somewhere in 18% of kits and invulnerable in 6%. On basic buttons untargetable is rare: 8 of 519 slots. An older community page says this kind of effect is scarce in general ([Community: Fandom, marked outdated](https://leagueoflegends.fandom.com/wiki/Champion_ability)). That holds for basics, but not for whole kits.

The notes see one repeated shape in Riot's reversals: a novel or generous mechanic ships, then comes back because of frustration or lost counterplay. Reflect and true invisibility both fit ([riot-design-values.md](league-research/riot-design-values.md)).

**Duel: transfers, and matters more.** With no team to punish it, an unanswerable tool decides the round.

### 13. Floor and ceiling are separate dials

Morello's 2012 point is Riot's core claim here. A kit can raise its ceiling without raising its floor. His own hypothetical is a slower Diana skillshot with a shorter recovery ([Riot, mirror: Skill Floor and Ceiling, September 2012](https://www.surrenderat20.net/2012/09/on-khazix-void-champions-skill-floor.html)). Hwei is a shipped case: pressing Q, W or E twice gives a reasonable result for a beginner, and mixing his spells is the long-term depth ([Riot: Champion Insights Hwei, November 2023](https://www.leagueoflegends.com/en-us/news/dev/champion-insights-hwei/)). August says complexity is only a problem when it stops people picking a champion up ([Riot, mirror: February 2017](https://www.surrenderat20.net/2017/02/dev-on-champions-of-2016.html)).

Scruffy scores complexity on three axes: mechanical, knowledge, and playing with or against. They move separately. Fiddlesticks is low, medium, high, so he is easy to execute and hard to face ([Riot: October 2020](https://www.leagueoflegends.com/en-au/news/dev/quick-gameplay-thoughts-october-30/)).

Riot has changed its mind on this repeatedly:

| When | Position |
|---|---|
| Before 2014 | Leaned toward a low floor ([Riot, mirror: Zenon, 2015](https://www.surrenderat20.net/2015/10/red-post-collection-dev-blog-on-data.html)). |
| 2014 | Over-indexed on ceiling with Azir, Kalista and Rek'Sai (same source). |
| February 2016 | Scruffy wanted much more accessibility ([Riot, mirror](https://www.surrenderat20.net/2016/02/red-post-collection-scruffy-on-champion.html)). |
| June 2018 | Scruffy said Riot would likely not add many more simple champions ([Riot, mirror](https://www.surrenderat20.net/2018/06/red-post-collection-quick-gameplay_14.html?m=1)). |
| April 2023 | A group of releases had leaned complex, and Milio marked a return to simpler design ([Riot](https://www.leagueoflegends.com/en-ph/news/dev/champion-roadmap-april-2023/)). |
| October 2023 | A high-complexity champion was still missing, and Hwei filled it ([Riot](https://www.leagueoflegends.com/en-us/news/dev/champion-roadmap-october-2023/)). |

The notes draw the lesson that a single target does not hold for long. Riot's later answer is a spread across the roster, which a small roster can only partly copy. Simple kits also have a cost: Scruffy says they run much stronger at low rank, so balancing them can leave them weak higher up ([Riot, mirror: Ask Riot, June 2018](https://www.surrenderat20.net/2018/06/red-post-collection-quick-gameplay_14.html?m=1)).

**Duel: transfers.** Riot's niche kits for small audiences depend on a roster of 150 or more. Twenty heroes cannot carry one.

### 14. Kits are found by playing, and most of a paper kit dies

Scruffy describes an eight-week cycle. Leads pick three directions, each gets two weeks of prototyping, and the last two weeks strengthen the winner ([Riot: Quick Gameplay Thoughts, September 2020](https://www.leagueoflegends.com/en-us/news/dev/quick-gameplay-thoughts-september-4/)). The notes found no Riot statement that this is still used in 2026. Meddler says models and effects are borrowed, because experiments are often thrown away within days. A placeholder must also evoke the right personality, or it skews feedback. Kled's first placeholder was clear but lacked character, and a better one greatly improved feedback ([Riot, mirror: Champion Prototypes, October 2016](https://www.surrenderat20.net/2016/10/red-post-collection-champion-prototype.html)).

Most of a paper kit dies. August says often only one skill from an early kit survives ([Riot designer, outlet: Millenium, February 2022](https://us.millenium.gg/news/26339.html)). Meddler says much the same in a 2014 remark, seen only in a search summary ([Excerpt: Surrender at 20 mirror](https://www.surrenderat20.net/2014/08/red-post-collection-meddler-champion.html?m=1)).

Riot also watches what players avoid. K'Sante's testers held back his W before his R, to save it for the outplay. So the team made its cooldown refresh on entering R ([Riot: Champion Insights K'Sante, October 2022](https://www.leagueoflegends.com/en-gb/news/dev/champion-insights-k-sante/)). August judges by early traction, whether players have a plan for next time, and whether the champion seems fair ([Millenium](https://us.millenium.gg/news/26339.html)). He treats data as an input, judged against what a kit is meant to do ([PCGamesN, 2016](https://www.pcgamesn.com/league-of-legends/designing-a-league-of-legends-champion-sometimes-you-get-vayne-and-sometimes-you-get-yorick)). Scruffy says players generate more data on the first day than the team gathers in all of development ([Riot: April 2020](https://www.leagueoflegends.com/en-gb/news/dev/quick-gameplay-thoughts-april-17/)).

**Duel: transfers.** A small team can copy the discipline of testing three directions. Launch-scale data needs a large player base, and it does not transfer.

### What does not carry over

Phroxzon says many kits stop working properly when played 1v1, and that ADC kits are not built for it ([Riot designer, outlet: RFT.GG, 2026; the page date 06/08 could mean June or August](https://rft.gg/news/riot-phroxzon-interview)). The strengths below depend on 5v5 or on League's size. Copying them would be a mistake.

| League strength | Why it does not carry over | What it means here |
|---|---|---|
| Counter items, invades, grouping | No items, jungle or team | Counterplay must live inside the fight |
| Teamwork mastery, such as Thresh's lantern | No ally | Mastery must be personal |
| Enchanter, catcher, vanguard and warden shapes | Defined by what allies do next | Do not copy these shapes |
| Marksman and late-scaling shapes | Need item spikes and a front line | Power must exist from the first second |
| Mana attrition | Our rounds fully reset | Keep only the cost of a miss |
| 120-second ultimates, level gates | Span fights we do not have | R is once per round |
| Kill rewards and kill resets | A kill ends the round | Drop them |
| Round-to-round carry-over | Brings back snowballing | Keep the full reset |
| Healing on half the roster | Serves long lanes | Keep heals rare |
| Pro-play balance bands | Built on 5v5 draft data | Not useful before launch |
| Global and team-reach tools | Our arena is 24 m across ([arenas.md:46](../architecture/arenas.md)) | Drop them |

## All 173 kits, counted, support some beliefs and reject others

Our researchers gave every ability of all 173 kits a set of tags from one vocabulary, then counted them ([counts in the catalogue](league-champion-kits.md#counts-across-the-roster), rows in [champion-tags.json](league-research/champion-tags.json)). The cooldowns were checked against Riot's own data, version 16.22.1.

**The tags are judgements,** read from summarised pages by our researchers. Treat single percentage points as noise and read the shape. Do not over-read small groups either.

| Common belief | What the counts show | Verdict |
|---|---|---|
| Kits keep getting busier | Tags per kit: 14.4 (2009-12), 15.2, 16.9, 16.3, 16.9, then 18.0 (2025-26) | **Partly.** A rise to about 17 by 2016-18, then flat. The last group is only eight kits, so it proves nothing alone. |
| Mobility keeps creeping up | Can dash or blink: 55%, 60%, 75%, 75%, 62%, 62% | **Partly.** It rose until 2016-21, then eased. This fits Scruffy's 2016 remark about too many dashes. |
| A busy kit is a hard kit | No link to Riot's difficulty rating (below) | **Not supported.** |
| Each letter has a fixed job | Q is a skillshot in 52% and shortest in 72%. W is self-cast in 40%. E has a dash or blink in 31%. Hard CC on R: 36% | **Partly.** Tendencies, not rules. |
| Every kit needs a dash | 65% overall, but Assassin 100%, Marksman 50%, Battlemage 27%, Enchanter 11% | **Not supported.** It depends on the class. |
| Everyone has crowd control | 94% of kits have some, 75% have hard CC. On any one slot, hard CC is only 19% to 36% | **True for kits, not for buttons.** |
| Cannot be hit is rare | 20% of kits have it somewhere. On basics: 8 of 519 slots | **True for basics, false for kits.** |
| Mana is standard | Mana 84%, none 4% | **True in League.** It does not transfer to full-reset rounds. |
| Ultimates are on long timers | Median 120 s at first rank, 80 s at last rank | **True in League.** The ratio is not a target for us. |

### Busyness does not track difficulty

Riot's data rates each champion's difficulty from 1 to 10. Tags per kit measures how much a kit contains. The two do not move together:

| Riot difficulty | Kits | Tags per kit | Recast in kit | Stance or form change |
|---:|---:|---:|---:|---:|
| 1-3 | 24 | 16.8 | 33% | 29% |
| 4-5 | 58 | 15.9 | 59% | 16% |
| 6-7 | 46 | 15.5 | 37% | 11% |
| 8-10 | 41 | 16.1 | 49% | 27% |

A correlation test across the 169 rated kits gives r = -0.006, which is effectively zero. This is this report's own arithmetic from the same rows. **Four kits have no rating** (Riot's data lists 0): Akshan, Rell, Seraphine and League's own Vex. They are left out.

The single kits make the point better. Briar has 29 tags and difficulty 3. Fiora has 20 tags and difficulty 3. Sett has 18 tags and difficulty 2. Yasuo, Aphelios, Rumble and Cassiopeia each have 15 tags, below the average of 16.0, and difficulty 10. Vayne has 10 tags and difficulty 8.

Aphelios is the clearest lesson. The batch notes call him one of the most overloaded kits, yet his tag count is below average. Tags do not see what makes him hard, which is remembering weapon pairs and their order. So difficulty comes from what a kit asks of you, not from how many parts it has.

There are limits on this reading. The notes found no explanation of how Riot sets this one number. It is also a different thing from Scruffy's three-axis framework, which scores execution, knowledge and playing against separately. **For our designers:** do not use tag count as a target or as a measure of difficulty. Riot's newest kits run near 18, and that is not a goal.

### The shape over time and by class

| Kit year | Kits | Can dash or blink | Recast in kit | Defensive tool | Tags per kit |
|---|---:|---:|---:|---:|---:|
| 2009-2012 | 38 | 55% | 42% | 79% | 14.4 |
| 2013-2015 | 35 | 60% | 31% | 69% | 15.2 |
| 2016-2018 | 36 | 75% | 50% | 78% | 16.9 |
| 2019-2021 | 24 | 75% | 46% | 92% | 16.3 |
| 2022-2024 | 32 | 62% | 59% | 81% | 16.9 |
| 2025-2026 | 8 | 62% | 75% | 100% | 18.0 |

A kit's year is its last rework, if it has one, so old champions rebuilt late count as late. Recast has risen most clearly, which fits principle 8. The 100% and 75% in the last row are eight kits, so read them as a hint at most.

By primary class, the busiest are Diver (18.5), Warden (18.3), Juggernaut (17.6) and Vanguard (17.5). The plainest are Marksman (13.5) and Enchanter (13.9). Groups here hold 6 to 26 kits, so small differences mean little. One number looks odd: 62% of Juggernauts can dash or blink, while Riot says the class is defined by low mobility ([Riot: May 28 2021](https://www.leagueoflegends.com/en-us/news/dev/quick-gameplay-thoughts-may-28/)). The tag counts any dash in any slot, including an ultimate's reach such as Sett's. So this may be a limit of the tag and not a true conflict.

### Most lessons transfer, even when the kit does not

Each catalogue entry ends with a verdict on its lesson for a duel: **106 transfer, 59 partly, and 8 are 5v5 only** (Kayle, Master Yi, Milio, Nasus, Rakan, Taric, Viego, Yuumi). This does not contradict Phroxzon's point that many kits stop working in a 1v1. The verdict is about one lesson, not the whole kit. That is why this report takes principles and not champions.

## Reworks fail in fifteen ways, and eleven of them fit a duel

Reworks are the best evidence of what Riot thinks went wrong, because Riot wrote down its reasons. Two limits apply. Riot publishes no list of kit failures, so these patterns are the notes' own grouping. And **Riot-authored verdicts on whether a rework worked exist for only about half of the cases.** The notes found none for Sion, Urgot, Poppy, Swain, Mordekaiser, Volibear or Fiddlesticks ([reworks-and-failures.md](league-research/reworks-and-failures.md)).

| Pattern that fits a duel | Cases | Why it matters with two players |
|---|---|---|
| **Theme and play do not match** | Sion, a caster with an axe ([Riot via wiki](https://wiki.leagueoflegends.com/en-us/Sion/Development)). Urgot's tangled ideas ([Riot via wiki](https://wiki.leagueoflegends.com/en-us/Urgot/Development)). Swain, billed as a tactician, played as a drain tank ([Riot via wiki](https://wiki.leagueoflegends.com/en-us/Swain/Development)). Aurelion Sol's unmet fantasy ([Riot via wiki](https://wiki.leagueoflegends.com/en-us/Aurelion_Sol/Development)). | Fit between kit and character needs no team. |
| **No window for the opponent** | Akali's shroud ([Riot, mirror](https://archive.runeterra.net/na/developer-corner/RgwqT7KP)). Swain's barely answerable spells. Skarner's rejected venom ([Riot](https://www.leagueoflegends.com/en-gb/news/dev/dev-searching-for-skarner-s-sting/)). | Nobody can peel for you. Akali and Swain are the cleanest evidence. Yuumi needs an ally, so she is not a direct precedent. |
| **Frustration that win rate does not show** | Mel: ban rate stayed near 15-30% while win rate fell to 45-47% ([Riot](https://www.leagueoflegends.com/en-us/news/dev/dev-mel-midscope/)). | A duel is nothing but the matchup. |
| **Hidden state to memorise** | Ryze's power windows ([Riot via wiki](https://wiki.leagueoflegends.com/en-us/Ryze/Development)). Irelia's stacks ([Riot](https://www.leagueoflegends.com/en-gb/news/dev/quick-gameplay-thoughts-june-25/)). A Mel test that needed knowledge of every projectile in the game ([Riot](https://www.leagueoflegends.com/en-us/news/dev/dev-mel-midscope/)). | No teammate can call it out. |
| **Stat check** (numbers decide, not choices) | Old Irelia ([Riot via wiki](https://wiki.leagueoflegends.com/en-us/Irelia/Development)). Old Sion's fixed pattern. Udyr's damage-only Q and R ([Riot](https://www.leagueoflegends.com/en-gb/news/dev/udyr-vgu-rebuilding-the-spirit-walker/)). | With one fight, nothing else can decide it. |
| **Too many tools** | Akali, able to do everything without committing ([Riot: Patch 10.3](https://www.leagueoflegends.com/en-us/news/game-updates/patch-10-3-notes/)). K'Sante, too safe ([Riot: Patch 14.19](https://www.leagueoflegends.com/en-us/news/game-updates/patch-14-19-notes/)). | Each extra tool removes a weakness the opponent could use. |
| **One ability defines and starves the kit** | Poppy's old R ([Riot via wiki](https://wiki.leagueoflegends.com/en-us/Poppy/Development)). Skarner's R. Mel's reflect. | In short rounds, play collapses onto that one cooldown. |
| **One interaction blanks a kit** | Mel's W against Seraphine ([Riot designer, outlet: PCGamesN, April 2026](https://www.pcgamesn.com/league-of-legends/phroxzon-debate-mel-balance)). The evidence is thin: this is the only well-documented case at ability level. | The opponent has nowhere else to contribute. |
| **Expert gap** | Ryze, Azir ([Riot: Patch 13.5](https://www.leagueoflegends.com/en-gb/news/game-updates/patch-13-5-notes/)). Irelia's E. Skarner ([Riot designer, outlet: Dexerto, July 2024](https://dexerto.com/league-of-legends/lol-devs-admit-they-failed-with-skarner-rework-vow-to-fix-him-2821206)). | The gap shows directly between two players. Riot accepts some of it for aspirational kits. |
| **Rework erases what players valued** | Aatrox ([Riot: Lessons from Dev, January 2021](https://www.leagueoflegends.com/en-us/news/dev/ask-riot-lessons-from-dev/)). | Applies once a kit is live and has fans. |
| **Copying another kit's state** | Mordekaiser's clone broke across the engine and needed support from every future champion ([Riot: March 2020](https://www.riotgames.com/en/news/welcome-death-dimension)). | Engine cost does not depend on team size. |

Four more patterns depend on 5v5: balance skewed by coordinated pro play, gold and lane snowball, item power spikes, and power that comes from allies. **The pro-play split is all over Riot's reasons** (K'Sante, Azir, Yuumi, Akali), so it is tempting to learn from it. It comes from team coordination, though, so it is a poor guide for a duel.

In the notes' reading, four patterns matter most for a duel: no window, hidden state, too many tools, and one defining ability. They appear most often in Riot's own words and lose nothing when the team is removed.

### Tuning cannot fix a mechanic that is itself the problem

Mel is the clearest case, and Riot's own position moved during 2026.

| Date | Who | Position |
|---|---|---|
| February 2026 | Riot, reported by an outlet | A small rework did not resolve the frustration ([Insider Gaming](https://insider-gaming.com/league-of-legends-mel-midscope-rework-removes-her-reflect/)). |
| April 2026 | Phroxzon, via an outlet | Mel is balanced. Near-impossible matchups are part of the game's appeal, and hard counters are fine up to a limit. He concedes her W can seem to shut down all of Seraphine's kit ([PCGamesN](https://www.pcgamesn.com/league-of-legends/phroxzon-debate-mel-balance)). |
| October 20, 2026 | Kevin Huang, Riot | Reflect was a bet that did not work. It could not be strong without frustrating opponents. A shorter range, stealing only the first projectile, and moving it to R were all tested and rejected ([Riot: Mel Midscope](https://www.leagueoflegends.com/en-us/news/dev/dev-mel-midscope/)). |
| November 3, 2026 | Riot | The change shipped ([Riot: Patch 26.22 notes](https://www.leagueoflegends.com/en-us/news/game-updates/league-of-legends-patch-26-22-notes/)). |

The catalogue's Mel entry describes her kit after this change. In the notes' reading, Phroxzon's defence rests on players learning for next time and on other roles carrying the game. In a duel a hard counter can fill the whole match, so League's tolerance should not be copied.

Poppy points the same way. Riot judged that a nerf would cost her old R its appeal anyway, so it removed the ability. The cases where the disputed mechanic stayed, such as Yuumi's attach, Azir's soldiers and Ryze's core combo, keep coming back to the balance queue. **But removal is promising, not proven.** Poppy has no Riot verdict, and Mel's change is only days old. The notes also found no full kit revert anywhere.

### Reworks often move the failure instead of ending it

Irelia traded a stat-check problem for an expert-gap problem: three years after her rework, Riot said her power was concentrated in high-level play ([Riot: June 2021](https://www.leagueoflegends.com/en-gb/news/dev/quick-gameplay-thoughts-june-25/)). Aatrox traded low usage for lost trust. Reav3 says a dedicated group played him far more, but many long-time players were alienated. Riot then made player trust the first goal of updates ([Riot: January 2021](https://www.leagueoflegends.com/en-us/news/dev/ask-riot-lessons-from-dev/)). A community writer reads Aatrox the opposite way, as proof that discarding an unhealthy kit works ([Community: Dexerto, September 2024](https://dexerto.com/league-of-legends/ksante-is-lols-greatest-failure-patch-14-19-proves-it-2897572)).

Skarner is the plainest admission. Phreak says he failed and wishes he had caught the issues before release: very strong in pro play, poor in normal games, with pick rate back to pre-rework levels ([Riot designer, outlet: Dexerto, July 2024](https://dexerto.com/league-of-legends/lol-devs-admit-they-failed-with-skarner-rework-vow-to-fix-him-2821206)).

### Rejected ideas teach as much as shipped ones

Riot rejected a venom direction for Skarner partly because a target already holding lethal damage over time has few responses left ([Riot: March 2023](https://www.leagueoflegends.com/en-gb/news/dev/dev-searching-for-skarner-s-sting/)). That matters directly for short rounds. The same post rejects a cycling kit as flashy but disjointed. Riot also cut Mordekaiser's ghost control after months of attempts ([Riot: Ask Riot, July 2020](https://www.leagueoflegends.com/en-us/news/dev/ask-riot-winter-on-the-rift/)), and Sett's grapple. In each case the reason was written down. Our kit sheets can keep the same habit.

### Complaint volume is a weak signal

Riot's first answer is nearly always numbers, then moving power inside the kit, and rarely a statement about kit size. On K'Sante, Riot said too safe, and it made a large structural change in Patch 14.19. A community writer called him a design failure that numbers cannot fix, using his own tally of 142 adjustments ([Community: Dexerto, September 2024](https://dexerto.com/league-of-legends/ksante-is-lols-greatest-failure-patch-14-19-proves-it-2897572)). Briar drew the opposite complaint: too little agency, since her frenzy stops her choosing targets ([Community: RiftFeed, September 2023](https://riftfeed.gg/champions/briar-champion-design-failure)).

For a duel, the notes prefer one concrete question over the word overload: what situation is this kit bad in? It can be checked hero by hero.

Respect for simple kits has thin evidence. The notes found no poll, only community praise such as a thread calling Ezreal a peak of design ([Community: Millenium, December 2022](https://us.millenium.gg/news/28958.html)). Riot's position is firmer: simple kits should exist on purpose, with complexity spread across a bell curve ([Riot: October 2020](https://www.leagueoflegends.com/en-au/news/dev/quick-gameplay-thoughts-october-30/)).

## Our kits fall short in four places and hold up in most others

**What is judged, and how firmly.** Five kits are built: Lyra, our Vex, Marin, Mortis and Zephyr. They are judged from code and kit sheets. The other 15 exist in v4 only as text in [kits-v4.md](../../pipeline/designs/kits-v4.md). The game still runs older kits for them, and those older kits are not judged here. All of this comes from [our-kits-comparison.md](league-research/our-kits-comparison.md), checked in part against the code on 2026-11-04.

**Nobody has played any of these kits with a person** ([STATUS.md:49, :69](../STATUS.md)). The only numbers are CPU fights. So a verdict below says what a kit asks for in code or on paper, not how it feels. The comparison is also unfair in one way: League's best kits have survived more than fifteen years of live play, while ours are first drafts. No design document can replace that testing.

A note on names: **our Vex** always means our Plague Alchemist. League also has a champion called Vex ([catalogue](league-champion-kits.md)). The notes do not discuss this, but the name deserves a check, since we do not take League's names.

### The same count, run on our 20

With only 20 kits, one hero is 5 points, so read the shape. The tags are the comparison note's judgement, and a few calls could go the other way.

| Measure | League | Ours | Reading |
|---|---:|---:|---|
| R over longest basic | 6.7 | 2.2 (5 built) | **Not a flaw.** Fights last about 20-22 s and a round fully resets, so R at 22-25 s is once per round ([kit-common.md:103](../../pipeline/designs/kit-common.md), [multiplayer.md:90-96](../architecture/multiplayer.md)). |
| No resource | 4% | 90% | **Good.** Mana's pacing job is gone. Its cost for a miss is not. |
| Heal | 49% | 10% | **Good.** Sustain was the strongest thing in our own tests ([kit-common.md:100-101](../../pipeline/designs/kit-common.md)). |
| Targeted, all slots | 17% | 28% | **Fine.** The project asked for it, it is easy on a phone, and line of sight gives everyone an answer ([multiplayer.md:177](../architecture/multiplayer.md)). |
| Targeted on R | 20% | 45% | **Bad.** Sure hits pile up on the strongest button. |
| Untargetable on basics | 8 of 519 | 7 of 60 | **Bad.** About eight times the rate, on a quarter of our E keys. |
| Pull | 16% | 40% | **Risky.** The project asked for pulls. Keep them where the pull is the verb. |
| Recast | 47% | 20%, Q only | **Bad.** No W, E or R has a second press. |
| Cooldown refund | 27% | 10% | **Bad.** None of ours rewards a hit. |
| Attack reset | 26% | 5% | **Mostly fine** for ranged heroes. Of 5 melee heroes, only Zephyr has one. |
| Channel | 26% | 5% | **Mixed.** Most of League's are team-fight ultimates, but a channel is a clear commit moment. |
| Melee heroes | 51% | 25% | **Open.** Riot found closed arenas favour melee ([Riot: /dev Arena, June 2023](https://www.leagueoflegends.com/en-us/news/dev/dev-arena/)). This needs people. |
| Q is a skillshot, W never | 52% / 23% | 75% / 0% | **Mildly bad.** Our columns are more templated than League's, despite rule 2 in the design. |
| Stacks | 67% | 40% | **Fine.** Many of League's are long-game scaling. |
| Tags per kit | 16.0 | 14.3 | **Fine.** Not a target. |

### Scorecard by principle

| Principle | Ours | Names |
|---|---|---|
| 1. Sharp strength, clear weakness | Mixed | Good: Lyra, our Vex, Mortis, Sirix, Shiori. Miss: Zephyr, Oblivion, Vesper, Brannoc. |
| 2. Readable counterplay | **Biggest miss** | On the R key. |
| 3. Tools paid for | Mixed | Zephyr and Oblivion break the mobility rule. |
| 4. Ladder of time | Fine when built | The 15 paper kits have no cooldowns. |
| 5. One idea, one question | **Strong** on idea | No question found: Isolde, Sefu, Oblivion, Tempo. Thin: our Vex, Marin, Ada, Auriel. |
| 6. Passive as rule | Mostly good | Miss: Tempo, Sefu, Oblivion, Ada, Marin, Vesper. |
| 7. R raises a verb | Mostly good, 14 of 20 | Miss: Auriel, Ada, Tempo, Zephyr. |
| 8. Second decision | **Thin** | Recast only on four Q keys. |
| 9. Locks and movement | Engine good | Miss: Isolde, Sefu, Mortis, Cantor. |
| 10. Sustain | Good roster | Miss: Vesper, Fenna. |
| 11. Readable state | **Miss** on 4 of 5 built | Nyx is the worst by design. |
| 12. Cannot be hit | **Too common** on basics | Seven E or W keys, plus Nyx's veil. |
| 13. Floor and ceiling | Good | Opaline, Lyra, Cantor. |
| 14. Found by playing | **Not yet** | Nobody has played. |

### Gap 1: our strongest button carries the fewest answers

Nine of our ultimates are targeted: Vesper, Isolde, Lyra, Sefu, Zephyr, Mortis, Cantor, Opaline and Tempo. Isolde, Sefu, Zephyr, Tempo and Mortis have no answer once cast. Sefu's and Zephyr's own lines say so ([kits-v4.md:171, :239](../../pipeline/designs/kits-v4.md)). Line of sight and range at the moment of the cast are a real defence, but they are preparation, not a moment you can read.

**The Counterplay column is the best thing in the v4 design, but some of its lines fail by arithmetic.** The first three rows were checked directly against the code on 2026-11-04 and hold. The others come from the comparison note, and their line references were spot-checked. Three engine facts used later were also read in the code and hold: a new stun can refresh on a target already stunned ([status.ts:113](../../src/effects/status.ts)), the stack badge is drawn only on its owner's HUD ([heroMode.ts:1256](../../src/heroMode.ts)), and every cooldown, R included, starts at 0 each round ([duel.ts:493](../../src/duel.ts)).

| Hero, ability | The line says | What the numbers say |
|---|---|---|
| **Lyra R, Meteor Mark** (built, checked) | Move in the last half-second ([kits-v4.md:129](../../pipeline/designs/kits-v4.md)) | The spot fixes 0.5 s before impact, with radius 2.2 m. A 4 m/s hero covers 2.0 m and is still inside. Only Nyx and Zephyr (4.6 m/s) get out, with no time to react. It hits for 135, or 175 at 10 m ([meteorMark.ts](../../src/spells/targeted/meteorMark.ts), [traits/astral.ts](../../src/traits/astral.ts)). |
| **Mortis Q, Bone Fan** (built, checked) | Stand between the shards ([kits-v4.md:249](../../pipeline/designs/kits-v4.md)) | Lines are 8 degrees apart with a 0.82 m hit width. At 8 m they are 1.12 m apart, so the midpoint is hit by both. A safe gap needs 1.64 m, which is past the spell's range. Standing between is the worst place ([boneFan.ts](../../src/spells/targeted/boneFan.ts)). |
| **Marin R, Moon's Pull** (built, checked) | Walk against the pull; stun her ([kits-v4.md:225](../../pipeline/designs/kits-v4.md)) | Up to 145 damage lands from anywhere, with no telegraph. Walking only shortens the drag. The file has no stun check ([moonPull.ts](../../src/spells/targeted/moonPull.ts)). The notes did not trace every outside path that could end the effect. Channel cancelling is an unbuilt piece ([kits-v4.md:406](../../pipeline/designs/kits-v4.md)). |
| **Mortis P and W** (built) | Fight away from piles; kill skeletons away from piles ([kits-v4.md:249-250](../../pipeline/designs/kits-v4.md)) | Piles are drawn only while a spell uses them ([kit-bone.md:83](../../pipeline/designs/kit-bone.md)). The count is on his own HUD. The opponent cannot see them. |
| **Marin P** (built) | Read the tide ([kits-v4.md:222](../../pipeline/designs/kits-v4.md)) | The ring shows only while one of her spells plays ([kit-tide.md:9-11](../../pipeline/designs/kit-tide.md)). The opponent gets a floating word at each flip, or must count 8 s. |
| **Brannoc W, Forge Roar** (paper) | Kite him for 3 s ([kits-v4.md:103](../../pipeline/designs/kits-v4.md)) | The spell gives him +25% speed. At his current 3.6 m/s that is 4.5 m/s, faster than most heroes ([traits/forge.ts](../../src/traits/forge.ts)). |
| **Oblivion W, Null Zone** (paper) | Keep 3 m away for 3 s ([kits-v4.md:314](../../pipeline/designs/kits-v4.md)) | The sphere moves with him and his passive pulls at 0.6 m/s. A 4 m/s hero nets 3.4 m/s against his current 3.8 ([traits/void.ts](../../src/traits/void.ts)). Once inside, you cannot walk out. |
| **Nyx Q, Backstab** (paper) | Keep turning to face her ([kits-v4.md:182](../../pipeline/designs/kits-v4.md)) | There is no turn command. Facing follows the walk ([mechanics.md:134](../architecture/mechanics.md)). You face her only by walking toward her. |

Skillshots raise the same question. This table shows the time left to react: seconds from cast to arrival, minus the seconds a 4 m/s hero needs to step clear. The comparison note assumes a person needs about 0.25 s to react. **That number is an assumption, not a measurement.**

| Spell | Time left at 6 m | Time left at max range |
|---|---:|---:|
| Toxin Dart | 0.16 s | 0.26 s |
| Pinning Arrow | 0.17 s | 0.27 s |
| Bone Fan, clearing all three | 0.14 s | 0.17 s |
| Wave Disc | 0.25 s | 0.38 s |
| Starfall Arrow, full draw | 0.25 s | 0.56 s |

So below about 9 m, most of these can only be dodged by moving first. The CPU dodges 65% at 0.12 s on Normal ([mechanics.md:105](../architecture/mechanics.md)), which may not describe people at all. Kits tuned against that CPU could land far more often on a person. Test this before treating it as a verdict.

One point in our own design also needs a check. The rules say a short range of 5-8 m pays for a sure hit ([kits-v4.md:45-49](../../pipeline/designs/kits-v4.md)). But the CPU holds about 70% of Q's range ([mechanics.md:223](../architecture/mechanics.md)), and ranged basic attacks reach 6-8.5 m. So 7 m is already a normal fighting distance, and short range pays for little. Sight and delay are what really pay.

Many of our answers are good and varied, and rule 4 of the design is why. Stop casting while cursed (Vesper E). Trample a flower by standing on it (Fenna). Break the shield and eat the burst, or wait (Auriel W). Outrun or shoot the bomb on legs (our Vex R). Stay off walls (Lyra E). Step out within 0.8 s (Opaline R). Walk away from a slow hole (Oblivion R).

### Gap 2: our buttons rarely hold a second decision

Recast exists on Vesper's, Isolde's, Zephyr's and Sirix's Q, and nowhere else. **No kit gives a cooldown back for landing a skillshot,** which is the cheapest way to make a miss cost something when there is no mana. Today a miss costs only a short timer.

Basic attacks deal 9-13 against spells of 30-78. Zephyr's Gust is the one real weave in a built kit: spend a dash now to bank an empowered attack, or keep it to dodge. Lyra's hold (decide during the press) is a good one too, and so is Vesper's Q recast. The gap is large in the numbers, and our engine already has per-slot recasts ([STATUS.md:328](../STATUS.md)), so it is cheap to close.

### Gap 3: the opponent cannot see the state

Four of five built kits hide what matters.

- **Our Vex:** reagents sit in `t.mem`, not on the stack pips, and a 4 s reagent outlasts its 2-3 s visual ([traits/alchemy.ts:13](../../src/traits/alchemy.ts), [kit-alchemy.md:44-52](../../pipeline/designs/kit-alchemy.md)).
- **Zephyr:** Gusts also sit in `t.mem`, with a floating word when gained ([traits/sky.ts:19-20](../../src/traits/sky.ts)).
- **Mortis and Marin:** see the table above.

The badge for all of these is on the owner's HUD only ([heroMode.ts:1256](../../src/heroMode.ts)). The stack pips already exist ([traits/fx.ts](../../src/traits/fx.ts)).

The worst case by design is Nyx, whom you cannot see at all. Her veil also switches off targeted spells, and 16 of 20 heroes own at least one ([kits-v4.md:177, :369](../../pipeline/designs/kits-v4.md)). Cantor is an odd case. His beat is visible, but half of all moments are in tune, so reading it tells the opponent little ([kits-v4.md:283-284](../../pipeline/designs/kits-v4.md)).

Good examples already exist on paper: Sirix's wasps, Shiori's strokes, Fenna's flowers, Kaia's rods, Tempo's ghost hands and Oblivion's hole. Designers can copy these within our own roster.

### Gap 4: no weakness has been tested on a person

The CPU cannot test counterplay. It plays no tide policy ([kit-tide.md:75-76](../../pipeline/designs/kit-tide.md)), and the rules for playing against Lyra are marked for later ([kit-astral.md:88](../../pipeline/designs/kit-astral.md)). A single matchup is 16 fights, about ±25 points at two standard deviations (the note's arithmetic). Marin's damage was raised through CPU fights until she won, Q from 40 to 68 and W from 12 to 62, while the AI ignores her tide ([kit-tide.md:12-16](../../pipeline/designs/kit-tide.md)). So her numbers measure the AI, not her kit.

The CPU numbers still give one warning about shape. Against old-kit opponents, Lyra wins 0 of 16 against Oblivion, Mortis 0 of 16 against Sirix and 16 of 16 against Cantor, and Zephyr 16 of 16 against Kaia ([STATUS.md:46-48](../STATUS.md)). If people confirm gaps that wide, each one is a complete counter, not the moderate disadvantage Riot asks for. Our queue pairs heroes blind and the hero stays for the match ([multiplayer.md:73](../architecture/multiplayer.md)), so a hard counter here is a lost match with no way out.

### Smaller misses, cheap to fix while the kits are text

**No kit-wide question.** Isolde's frozen-counts-as-5 clause means reach 5, then R, with no trade. Sefu's passive fires by itself. Oblivion walks at you. Riot's complaint about old Swain was close to this: in play he simply walked at enemies ([Riot via wiki](https://wiki.leagueoflegends.com/en-us/Swain/Development)).

**Passives that ask nothing.** Tempo's echo is damage only, and his W, E and R deal no damage, so it works on Q alone ([kits-v4.md:334-342](../../pipeline/designs/kits-v4.md)). Sefu's Decree and Oblivion's Event Horizon are automatic. Ada's passive holds two unrelated rules, one of them a count. Marin's rule is real, but no button cares whether the enemy was pushed or pulled. Vesper's 4% price barely bites, and her Q's recast refunds it.

**Ultimates unrelated to the kit.** Auriel's Ascendant has nothing to do with shields ([kits-v4.md:212](../../pipeline/designs/kits-v4.md)). Ada's mech ignores her turrets ([:265](../../pipeline/designs/kits-v4.md)). Tempo's Time Theft does not echo ([:342](../../pipeline/designs/kits-v4.md)). Zephyr's Sky Rend is not a dash, and it neither gives nor spends a Gust ([traits/sky.ts](../../src/traits/sky.ts)). Three of the four are not built.

**Mobility without a price.** Zephyr has three dash buttons, three untouchable windows and 690 HP. By the note's arithmetic he is untouchable about a fifth of the time if everything is used on cooldown ([traits/sky.ts:4-8](../../src/traits/sky.ts)). Oblivion is a juggernaut with a blink, two drags, a constant pull and a walking silence ([kits-v4.md:308-316](../../pipeline/designs/kits-v4.md)).

**Lock chains.** The engine is better than League's here: every status has a cap, and stuns and knock-ups add 0.5 s of immunity ([status.ts:14, :28](../../src/effects/status.ts)). But a new stun is refused only when the target is not already stunned ([status.ts:113](../../src/effects/status.ts)). So Isolde's R during her 1 s freeze refreshes it to about 2.2 s of no action, with about 317 damage on paper in that window. This is the case Scruffy's ratio warns about. Sefu's R is 1.2 s of stun, then 0.8 s of root, then his crook. Mortis's R as built holds the target from 0.6 s to 2.7 s after the cast, against a 1 s root in the design, though the target can still cast ([graveGrasp.ts](../../src/spells/targeted/graveGrasp.ts)). Cantor's W is a sure-hit charm of up to 1.4 s on a basic.

**Sustain.** Only 2 of 20 heal, and those two repeat our own finding. Vesper heals on every button, and her Q, E and R cannot miss. Fenna reaches up to 73 HP per second for 8 s on paper, while older kits deal 28-39 damage per second in CPU fights ([STATUS.md:475](../STATUS.md)). Trampling is a good answer, but it competes with that number.

**Answers that mean stop playing.** Oblivion's sphere stops all casting and eats bolts for 3 s while it walks with him ([kits-v4.md:314](../../pipeline/designs/kits-v4.md)). Auriel's R punishes attacking for 5 s of a round of about 20 s. It reflects damage and not projectiles, so it is not Mel's mechanic, but the warning applies.

**Pulls that fight their own answer.** Vesper's R drags 1 m per pulse, which fights its stated counter of stepping behind a pillar ([kits-v4.md:92](../../pipeline/designs/kits-v4.md)). Ada's reel adds a pull for no clear reason. There is also an engine trap: a knock moves a foe v/7 m but the player only 0.18 m per unit up to a cap, so knock-backs are worth less against a person than against the CPU ([kit-tide.md:30-35](../../pipeline/designs/kit-tide.md)). Marin worked around it. Our Vex's Concussion did not: 3 m on a foe, 1.44 m on the player ([kit-alchemy.md:93-94](../../pipeline/designs/kit-alchemy.md)).

**No time ladder on paper.** [kits-v4.md](../../pipeline/designs/kits-v4.md) gives no cooldowns for the 15 paper kits. The one shape consistent across League's kits is missing from the design.

### Answering the premise

**League is really better at four things:** strong moments that carry an answer, a second decision on its buttons, state the opponent can read, and weaknesses tested on people.

**The gap is only polish and playtesting** for how hits feel, how readable effects are at speed, balance numbers, and whether a kit is fun. None of that can be judged from text. Expect v4 to change too, because Riot expects most of a paper kit to die. Part of the impression may also come from today's roster: 15 of 20 heroes run older kits, and two-sided play cannot be felt against a CPU that plays around nothing.

**We are fine, on paper, at:** identity (every hero fits one line), passives as rules, ultimates that raise a verb, the engine-wide lock rules, few heals, a reasonable number of parts per kit, and no items, so the whole kit can be read at once. The 14-of-20 count for ultimates is one writer's reading, set against about half of a twelve-kit League sample. So it shows we are not behind. It does not prove we are ahead.

### What our format can do that League's main game cannot

Riot's nearest comparison is its Arena mode, which fully refreshes each round, but it is built around 2v2 and has items ([Wiki: Arena](https://wiki.leagueoflegends.com/en-us/Arena)). These five openings are ours, and none has been tested.

**Line of sight as a universal answer.** Anyone on any hero can stop a sure hit by standing behind cover ([multiplayer.md:177](../architecture/multiplayer.md)). That is what Scruffy says tactical counterplay should be, and it is why our higher share of targeted spells is defensible. A pull can undo it, so pulls need care.

**Rounds as a learning loop.** August says a fair loss should leave a plan ([Riot designer, outlet: PCGamesN, 2016](https://www.pcgamesn.com/league-of-legends/designing-a-league-of-legends-champion-sometimes-you-get-vayne-and-sometimes-you-get-yorick)). A best of three lets that happen inside one match. The 3 s break is free space to show what hit you ([multiplayer.md:93](../architecture/multiplayer.md)).

**A shared clock.** Round time is known to both players. The tide and the arena events already run on it ([traits/tide.ts:21](../../src/traits/tide.ts)). An R that comes up at a known second would be readable by both.

**Cover as a kit's material.** Lyra's pin, Opaline's bounce, Ada's grapple, Marin's spire and Fenna's tree all use it, and breakable walls change it during a round. Riot's Arena work shows that blocking and hiding are separate levers: its Deep Water blocks movement but not vision ([Riot: /dev Arena, June 2023](https://www.leagueoflegends.com/en-us/news/dev/dev-arena/)).

**Letting the loser swap heroes between rounds.** The server already takes a new max HP each round ([multiplayer.md:95](../architecture/multiplayer.md)). This would turn a hard counter into a choice: strategic counterplay, restated for a duel.

### What this report could not settle

These questions stay open. Does our Vex's homunculus work online? [kit-alchemy.md:83](../../pipeline/designs/kit-alchemy.md) says it hits no one in a network duel, and [multiplayer.md:270](../architecture/multiplayer.md) says the other player's units spawn and fight. Does any outside path stop Moon's Pull when Marin is stunned? The design gives no walk speeds for the 15, so the Brannoc and Oblivion arithmetic uses their current trait files. Kaia's R total of 406 assumes her rods arc on every strike. The 20-22 s fight length predates v4 and the new walking. Riot's GDC talks on its production framework were seen only as listings ([GDC Vault: Creating League of Legends Champions](https://www.gdcvault.com/play/1024101/Creating-League-of-Legends-Champions)). No source tests any League principle in a 1v1.

## Conclusion: hold the answers to a stricter standard than League does

The most useful result here is that a counterplay line can be tested with arithmetic before anyone plays. Speed, radius and reaction time are quick to check, and they caught false lines in three built kits. League learned many of these lessons through patches and live data. We can catch the plain cases for free, in text, while 15 kits still cost nothing to change. That check does not replace people. It means the first playtest measures the design and not errors in the text.

The other result changes how to read League. Much of what League tolerates, such as hard counters and low-agency moments, it can afford because a team and a long match absorb them. Riot's designers have defended such moments on those grounds ([Riot designer, outlet: Phroxzon, April 2026](https://www.pcgamesn.com/league-of-legends/phroxzon-debate-mel-balance); [Riot designer, outlet: Phreak, 2023](https://devtrackers.gg/leagueoflegends/p/0e34c7f1-why-it-s-hard-to-balance-for-pro-and-preview-of-worlds-meta-phreak)). A duel of short rounds has no such cushion. So copy League's standards for answers, and go further than League on hard counters, forced movement and hidden state. On the things that exist only because of its size and its team, do not copy League at all.

### Checklist for designing or reviewing a kit

Every answer should be yes. A no means fix it or write down why not.

| # | Question | What it catches |
|---:|---|---|
| 1 | Can you state the kit's repeated question in one sentence? | No core decision |
| 2 | Does the one-line theme describe what the buttons really do? | Theme mismatch |
| 3 | Can you name the situation in which this kit is bad? | Too safe, too many tools |
| 4 | Can the opponent reach that weakness on any hero? | Paper weakness |
| 5 | Is that weakness a moderate disadvantage, short of a lost match? | Hard counter in a blind queue |
| 6 | If the hero has a dash or blink, is it clearly weaker somewhere else? | Free mobility |
| 7 | Does each slot have a written cooldown, forming a rhythm tool, commit tools and one turning point? | Flat timing |
| 8 | Have you run the numbers on every counterplay line, with a 4 m/s walker, the real hit radius and time to react? | False counterplay |
| 9 | Can a hero with no dash use each stated answer? | Answers only some heroes own |
| 10 | Does each answer use controls that exist in the game? | The Nyx facing problem |
| 11 | Does the strongest button have a moment the opponent can read after the cast? | Sure hit with no answer on R |
| 12 | Does the kit keep some damage that can be avoided? | Undodgeable kit |
| 13 | Does at least one button hold a second decision after the press? | One-press kit |
| 14 | Does a miss cost more than a short timer, or a hit buy something? | Spam with no stakes |
| 15 | On a melee kit, does the basic attack have a job between spells? | Spell rotation only |
| 16 | Does the passive change where the player stands or how they attack? | Passive as a stat |
| 17 | Does the passive matter on most buttons, and does no button argue with it? | The Tempo echo problem |
| 18 | Does the R raise a verb the kit already teaches, or is there a written reason it does not? | Unrelated ultimate |
| 19 | Does every chain of the kit's own locks stay within the engine cap, with nothing refreshing it? | Lock chains |
| 20 | If every spell lands during the lock, is a full-health victim still alive and able to act when it ends? | Lock plus burst |
| 21 | If the kit moves the opponent, is movement its verb, and does cover still work as an answer? | Pulls that undo cover |
| 22 | Do its heals stay within the limits in [kit-common.md:100-101](../../pipeline/designs/kit-common.md)? | Sustain |
| 23 | Can the opponent deny a heal by an action of their own? | Undoing a won exchange |
| 24 | Is every stack, mark, pile or timer visible to the opponent, on the hero or on the ground? | Hidden state |
| 25 | Can someone who has never read the kit say what hit them after one round? | Study burden |
| 26 | Does the telegraph match the real hit area? | Misleading shapes |
| 27 | Are untargetable windows absent from basics, or short and clearly paid for? | Cannot be hit |
| 28 | Does no single interaction switch off most of an opposing kit? | Blanked kits |
| 29 | Is the opponent's best answer something other than to stop playing for seconds? | Answers that remove play |
| 30 | Does a plain press give a decent result for a new player? | High floor |
| 31 | Does skill add more reward, mainly through decisions and not frame-tight input that ping can break? | Low ceiling, ping gate |
| 32 | Is it written how each spell meets cover: blocked, needs sight, or ignores it? | Undefined cover rules |
| 33 | Is the kit free of mechanics that copy or swap another kit's state? | Engine debt across the roster |
| 34 | Do all effects have a job with no ally, minion, item or later fight? | Leftover 5v5 parts |
| 35 | Has a person played it against a person, with written questions, and did the loser have a plan? | Untested weakness |

### What to do first, ranked

The 15 unbuilt kits cost a text edit today and a rebuild later. Changes to the five built kits need a CPU rebalance afterwards. All change ideas here are ours and untested.

| Rank | Do this | Why here |
|---:|---|---|
| 1 | **Make the stated counterplay true on built kits.** Lyra's meteor delay, Marin's R damage avoidable or cancellable (needs channel piece 5), Mortis's Q fan or its line, Zephyr's R. Then run the numbers on every line of the column before batch 2, including Brannoc W and Oblivion W. | The firmest rule in the notes, and the column is already the design's best feature. |
| 2 | **Show hidden state to the opponent.** Mortis's piles on the ground, Marin's tide ring always on, our Vex's reagents and Zephyr's Gusts on the existing pips. Rule for batch 2: anything on the enemy or the hero is visible to both. | Small cost. Without it, a playtest measures confusion. |
| 3 | **Play the five built kits against a person before building batch 2.** Ten matches, with questions written first. Did you know why you lost? Could you dodge the dart at 6 m? Did you use the tide on purpose? Did you open with R? | The only way to test a weakness. It may change items 4 to 8. |
| 4 | **Rewrite the unrelated ultimates and the empty passive on paper.** Auriel R, Ada R, Tempo R and passive, Zephyr R. | Otherwise a strength. These are the clear holes, and three are free. |
| 5 | **Replace Nyx's invisibility before it is built.** | The largest engine item ([kits-v4.md:408](../../pipeline/designs/kits-v4.md)), with Riot's own reversal behind the warning. It also answers open question 3 at [:449](../../pipeline/designs/kits-v4.md). |
| 6 | **Add a second press or a refund to six kits, only where it adds a decision.** Ideas to test: Opaline Q refunds per bounce, Lyra's full-draw hit takes time off E, Kaia's W can be recast to fire a rod early, Fenna's tree can be uprooted to move it, Sefu's Q refunds on a hit against a Judged target, Tempo's Q refunds on a hit. | The largest gap to League's numbers, and cheap in the engine. |
| 7 | **Trim sustain and lock chains on paper, and write the time ladder into v4.** Vesper R, Fenna R, Isolde R on frozen targets, Sefu R root, Cantor W length, Oblivion W anchored. Give each of the 15 a named rhythm tool, commit tool and turning point. | These repeat findings the project already made. |
| 8 | **Try two format rules once people play.** R comes up 8 s into a round, not at 0 ([duel.ts:493](../../src/duel.ts), [mechanics.md:219](../architecture/mechanics.md)). The loser of a round may swap hero. | Both touch every hero and may not be wanted. Test before keeping. |

### Verdict on all 20 heroes

Built heroes are judged from code, the others from their text in [kits-v4.md](../../pipeline/designs/kits-v4.md), with line ranges shown. All are unplayed by a person. Each last column is one idea of ours to test.

| Hero | Core question | Biggest gap | One change to test |
|---|---|---|---|
| **Vesper** (80-92) | Clear: how low to let herself go | Heals on every button, and three attack spells cannot miss | R heals only if the third pulse lands; drop its drag |
| **Brannoc** (94-105) | Clear: which spell gets Tempered | Kiting is his one weakness, and W gives +25% speed | Remove the speed from Forge Roar |
| **Isolde** (107-118) | None as written: reach 5, then R | About 2.2 s of lock and 317 damage on paper | R on a frozen enemy adds no stun |
| **Lyra** (built, [astral.ts](../../src/kits/astral.ts)) | Clear: how long to hold the draw | Meteor Mark cannot be walked out of | Meteor lands 0.8 s after the spot fixes |
| **Our Vex** (built, [alchemy.ts](../../src/kits/alchemy.ts)) | Thin: Combust outvalues the rest | Two of three reactions rarely win; primed state hidden | Raise Corrode until it competes, such as 35% |
| **Kaia** (147-158) | Clear: net of rods or one anchor | Rods cannot be removed; three can cover up to 75% of the arena | An arc spends the rod |
| **Sefu** (160-171) | None: Judged applies itself | A 2 s lock with no answer | Remove the 0.8 s root when the seal opens |
| **Nyx** (173-185) | Clear: strike now, or fade for more | Invisibility blanks targeted spells; costliest engine piece | Faint outline while faded; untargetable only past 3 m |
| **Fenna** (187-200) | Clear: where to plant, stay or glide | Up to 73 HP/s; the tree alone heals up to 200 | Delete the tree's own 25 HP/s |
| **Auriel** (202-212) | Thin: the real question is the opponent's | Ascendant ignores shields; its answer is to stop playing | R is a large shield that bursts at its end |
| **Marin** (built, [tide.ts](../../src/kits/tide.ts)) | Thin: she cannot choose the tide | Her rule asks nothing; numbers measure the AI | Mist Form flips the tide when she reforms |
| **Zephyr** (built, [sky.ts](../../src/kits/sky.ts)) | Clear: bank a Gust or keep the dodge | Sky Rend has no answer; untouchable about a fifth of the time | Gusts held add cuts to Sky Rend; with none, three cuts |
| **Mortis** (built, [bone.ts](../../src/kits/bone.ts)) | Clear: two-sided, spend skeletons or use piles | The piles are invisible to the opponent | Draw piles on the ground for their full 8 s |
| **Ada** (254-265) | Thin: mostly stay near turrets | The mech forgets her turrets; extra count in the passive | A rooted emplacement that overclocks her turrets |
| **Sirix** (267-278) | Clear: spend wasps or hold six | R refills at once, closing the kit's one opening | No refill; regain one wasp every 2 s |
| **Cantor** (280-292) | Clear: cast now or wait for the beat | The opponent cannot touch the beat; long sure-hit charm | A stun or silence breaks his beat for 2 s |
| **Opaline** (294-304) | Clear: shoot straight or bank | Removes cover as an answer; opponent must do geometry | Telegraph draws the first bounce for both players |
| **Oblivion** (306-316) | None: he walks at you | Walking silence plus a pull you cannot outrun | Null Zone stays where he cast it |
| **Shiori** (318-330) | Clear: where the strokes cross | None in structure; R's wording is unclear | Define R as 40 per stroke under the enemy's feet |
| **Tempo** (332-342) | None: the echo works on Q only | Passive empty on three buttons; R unrelated | Time Skip leaves an echo of his last spell |
