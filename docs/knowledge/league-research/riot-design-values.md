---
title: Riot's design values
tags: [knowledge, research, league-of-legends]
updated: 2026-11-04
---

Research notes behind [League kit design](../league-kit-design.md), kept for their sources. Read through a tool that summarises pages, so check wording and small numbers at the source.

# Riot's stated design values for League of Legends champion kits

Compiled 2026-11-04. Everything is paraphrased; the file holds one direct quote. Dates are the source's publication date.

**Source labels.** Every finding carries one of these.
- **[Riot]**: Riot-authored page, read on leagueoflegends.com.
- **[Riot, mirror]**: Riot-authored text read on Surrender at 20 (S@20), a community site that reposts Riot posts. S@20 is not the author. The original Riot link is given where S@20 showed one; those old boards and news links were not retrieved.
- **[Riot designer, outlet]**: a named Riot designer in an interview or talk report published by an outside outlet. The statements are the designer's; the framing is the outlet's.
- **[Riot, excerpt only]**: a Riot page seen only as search-engine excerpts, not read in full. Weakest grade. Check it before relying on it.
- **[Community]**: not Riot. Never used to support a claim about intent.

**Tags.** "Transfers to 1v1" and "depends on 5v5" are my judgement against the target game (a 1v1 duel in short rounds on an arena with cover, with no items, lanes, minions, objectives or team). Riot did not assign them.

**Reading caveat.** Pages were read through a fetch tool that returns a summary rather than raw text. Spot-check exact numbers and attributions against the linked page before repeating them as fact.

## How do Riot designers define and apply counterplay, clarity, mastery, identity, power budget, overload and windows of weakness?

### Takeaway
Riot has written definitions for counterplay (2021), clarity (2021) and mastery (2014). Power budget and overload are working terms that it uses in practice and never formally defines in anything I found. "Windows of weakness" is not a Riot term in anything I found, though the idea appears under other names. The strongest recurring rule is that a sharp strength must be paid for by a clear, reachable weakness.

### Cited Findings

#### Counterplay

**Definition.** Riot Scruffy calls it a long-standing key value: an action, choice or strategy that lets a player "mitigate or overcome an enemy threat" (Riot Scruffy, 2021). He gives two benefits. Fairness or agency: a clear response reduces frustration when you lose, even if you cannot yet execute it. Depth: fights become exchanges of skill rather than one-and-done outcomes. — [Riot] [Quick Gameplay Thoughts: May 14](https://www.leagueoflegends.com/en-us/news/dev/quick-gameplay-thoughts-may-14/), 2021-05-14

**Earlier definitions.**
- Morello's design values blog: fights should be two-sided, winning should mean consistently outplaying an opponent rather than one perfect kill, and hard counters and abilities that leave no room to react should be avoided. He describes the values as a direction rather than the current state, and says many existing designs fail them. — [Riot, mirror] [The Design Values of League of Legends](https://www.surrenderat20.net/2014/05/red-post-collection-design-values-of.html), reposted 2014-05-29 (original: http://na.leagueoflegends.com/en/news/game-updates/features/dev-blog-design-values-league-legends)
- Zileas: champions should be hard to master both for the pilot and for the opponent, so nuance, timing and thought decide the winner in both directions. — [Riot, mirror] [LoL Design Values: Depth of Mastery](https://www.surrenderat20.net/2014/07/red-post-collection-in-depth-with.html), reposted 2014-07-25 (original: http://na.leagueoflegends.com/en/news/game-updates/features/lol-design-values-depth-mastery)
- Comments in the Morello thread: Ghostcrawler says the value is violated when you have no options at all, not simply because one strong ability or combo is hard to counter. Zenon says Annie's Q is acceptable because its range is short, and judges Lucian's Q a failed attempt to give a unit-targeted ability skillshot-style dodge counterplay. — [Riot, mirror] [S@20](https://www.surrenderat20.net/2014/05/red-post-collection-design-values-of.html), 2014

**Tactical counterplay. Tag: transfers to 1v1.** It is an in-the-moment answer to a spell or combo, needs no team, and cover gives it a new form.
- Definition: dodging skillshots, interrupting channels, reacting to long windups, and standing behind allies or minions. Same May 14 2021 post.
- Application: it is essential for high-impact moments that often guarantee a kill. It works best when anyone can use it, rather than requiring a dash or immunity. Too much of it makes a kit clunky or unreliable, so not every spell needs it.
- Proportionality rule: stronger effects should carry more counterplay. Riot's example is Ashe's ultimate, whose stun lengthens with travel distance, which also gives more time to dodge.
- Other Riot examples: Blitzcrank's hook and Sion's Q are high-impact starters that need tactical counterplay. Jhin's extreme range is offset by the dodge chances in his W and R.

**Strategic counterplay. Tag: depends on 5v5.** Riot's examples are counter items, invading a weak jungler, grouping against an assassin and pushing into poor waveclear, and none of these exist in the target game.
- Same May 14 2021 post. Riot notes it is harder for players to appreciate because it concerns setting up or avoiding fights. Evelynn and control wards is the example.

**Class-level weakness. Tag: transfers to 1v1.** A kit's matchup weakness is still felt with no team, though it only matters at pick time if the game has a pick or draft step.
- A weakness should give a moderate disadvantage, not a complete counter, because too strong a counter removes agency. A common method is to design around strengths, which then produce the matching weaknesses. Xerath is weak to mobile assassins because he is immobile. Qiyana's burst runs out against tanks. Nasus can be kited by mobile ranged champions. Same May 14 2021 post.
- Scruffy listed counterplay as needing a lot more attention, through intended weaknesses and avoiding kits with so many tools that no real weakness remains. He named Ekko and Kindred as low-counterplay examples. — [Riot, mirror] [Champion Gameplay Values 2016](https://www.surrenderat20.net/2016/02/red-post-collection-scruffy-on-champion.html), 2016-02-06 (original: http://boards.na.leagueoflegends.com/en/c/developer-corner/uOVIbuoi-champion-gameplay-values-2016)

**Burden on the opponent. Tag: transfers to 1v1.** In a duel, your one opponent carries all of this burden, with no teammate to share it.
- Scruffy's 2016 values post says mechanics that demand extra effort from opponents should be much reduced, with Skarner's spires and Rek'Sai's tunnels as examples. In his replies, Illaoi's vessel debuff is another. Same 2016 post.

#### Clarity

**Tag: transfers to 1v1.** All of it concerns reading a threat and reacting, and short rounds raise the cost of a misread.

**Definition.** Riot defines clarity as being able to understand what is happening in a game and respond to it. It sets three goals: gameplay is clearly conveyed by visuals and audio; hierarchy is preserved, so the most important thing draws the most attention; and noise is kept low. — [Riot] [Clarity in League](https://www.leagueoflegends.com/en-us/news/dev/clarity-in-league/), 2021-03-12. An earlier version: players should fight their opponent, not the interface or hidden information, and mechanics should be distinct and transparent. — [Riot, mirror] [Design Values](https://www.surrenderat20.net/2014/05/red-post-collection-design-values-of.html), 2014

**Visual clarity.** All from Clarity in League, 2021.
- Silhouette is the most important recognition factor and needs one unique primary trait: Senna's gun, Diana's moon weapon, Yuumi being a cat.
- Shape should reveal the power source (a bow suggests ranged, a staff suggests casting), size should hint at playstyle, and facing direction should read from the silhouette alone.
- Attention should match importance, judged by damage, hard or long CC, dodgeability and impact on play. Riot's positive examples are Zoe's Q, Taric's stun (bright, audio wind-up, clear hitbox) and Kayle's ultimate.
- Riot's negative example is Arcane Comet, whose large ground circle suggests more dodgeability than it allows.
- Hitboxes must match their effects (Hecarim was first in the 2021 VFX update plan), and projectiles should show direction even when still.
- Skins must keep the champion's primary feature and match base-skin ability clarity, so they are neither pay-to-win nor pay-to-lose.

**Mechanical clarity.** The Clarity post does not separate visual from mechanical clarity. Mechanical examples come from elsewhere.
- Sett began as a grappler who seized and relocated opponents. Riot Axes said the relocation caused clarity problems and frustration and was costly to animate, so it was cut and the kit moved to brawling. — [Riot] [Champion Insights: Sett](https://www.leagueoflegends.com/en-us/news/dev/champion-insights-sett/), 2020-01-14
- The durability update lists being able to tell what killed you as a goal. — [Riot] [Quick Gameplay Thoughts: 5/6](https://www.leagueoflegends.com/en-us/news/dev/quick-gameplay-thoughts-5-6/), 2022-05-06
- Scruffy's 2016 values post says ambitious kits create screen clutter that needs tighter management. — [Riot, mirror] [Champion Gameplay Values 2016](https://www.surrenderat20.net/2016/02/red-post-collection-scruffy-on-champion.html)

**Kit-reading clarity.**
- Scruffy's complexity framework rates how much teammates and opponents must change their play, and says opponents should not need extensive study to handle a champion, while deep study to play as one is opt-in. — [Riot] [Quick Gameplay Thoughts: October 30](https://www.leagueoflegends.com/en-au/news/dev/quick-gameplay-thoughts-october-30/), 2020-10-30
- Scruffy admits a run of high-complexity releases (the Mordekaiser to Sett group) caused confusing moments. — [Riot] [Quick Gameplay Thoughts: April 17](https://www.leagueoflegends.com/en-gb/news/dev/quick-gameplay-thoughts-april-17/), 2020-04-17
- Riot Axes says a resource that is hard to understand is a valid reason to drop it. Viego is manaless partly because mana would complicate his possession transformations and UI. — [Riot] [Ask Riot: Manaless Champions](https://www.leagueoflegends.com/en-us/news/dev/ask-riot-manaless-champions/), 2021-07-02

#### Mastery and skill expression

**Personal mastery. Tag: transfers to 1v1.** Combos, dodging and fight decisions are the entire content of a duel.

**Definition.** Zileas says players mainly stay for the pursuit of mastery and names three areas: personal expertise (direct control such as combos, dodging, last hitting and fight decisions), teamwork, and adaptability. — [Riot, mirror] [Depth of Mastery](https://www.surrenderat20.net/2014/07/red-post-collection-in-depth-with.html), 2014. Morello adds that mastery should keep being rewarded from a player's first game to their thousandth. — [Riot, mirror] [Design Values](https://www.surrenderat20.net/2014/05/red-post-collection-design-values-of.html), 2014

**Application and examples.**
- Yasuo's passive rewards building Flow through movement and ability use and not wasting it once full, which Zileas says separates good Yasuos from great ones. Depth of Mastery, 2014.
- Scruffy rated decision-based mastery as about right, contrasting Bard with Warwick, and rated mechanical execution mastery as needing a little less, wanting high-APM champions to be a small part of the roster. He also wanted more meaningful small constraints, with Vayne's tumble not clearing walls as the example. — [Riot, mirror] [Champion Gameplay Values 2016](https://www.surrenderat20.net/2016/02/red-post-collection-scruffy-on-champion.html)
- Riot measures mastery with curves showing how win rate rises with games played. Even easy champions gain about 4% over roughly 15 games. Neeko has a near-vertical curve (quick to learn), Yuumi a diagonal one, and Yasuo, Katarina and Nidalee have long tails. — [Riot] [/dev: Balancing New Champions](https://www.leagueoflegends.com/en-us/news/dev/dev-balancing-new-champions/), 2020-07-06
- Riot deliberately leaves mastery curves out of its balance framework, because it does not want to punish investment. It expects out-of-line mastered power to show up in pro picks or elite bans anyway. — [Riot] [/dev: Champion Balance Framework](https://www.leagueoflegends.com/en-us/news/dev/dev-champion-balance-framework/), 2019-05-30

**Teamwork mastery. Tag: depends on 5v5.** No teammates exist. Zileas's example is Thresh's lantern, which grows stronger with coordination, and Morello's Teamplay value has champions cover each other's weaknesses in distinct roles.

**Meaningful choices. Tag: transfers to 1v1.** Morello says choices need tradeoffs, and obvious options or decisions with hidden consequences are not engaging. Design Values, 2014.

#### Champion identity and thematic fit

**Theme and gameplay match. Tag: transfers to 1v1.** A fantasy delivered by the kit does not depend on team context.
- Scruffy's early screen asks whether the theme resonates with the intended players and whether the gameplay hook delivers on it. His only example is hypothetical: a lethal assassin themed as a fluffy duckling would be a mismatch. — [Riot] [Quick Gameplay Thoughts: September 4](https://www.leagueoflegends.com/en-us/news/dev/quick-gameplay-thoughts-september-4/), 2020-09-04
- Complexity should also fit the fantasy: an elaborate ninja assassin suits challenge-seekers, a cuddly character suits a simpler kit. — [Riot] [October 30](https://www.leagueoflegends.com/en-au/news/dev/quick-gameplay-thoughts-october-30/), 2020
- Riot says a Void Spike slow turned Kha'Zix into a kiting, peeling champion, against his fantasy. — [Riot] [/dev: Balancing for Pro Play](https://www.leagueoflegends.com/en-us/news/dev/dev-balancing-for-pro-play/), 2020-08-20
- August says he will change a kit to fit a theme the artist or writer considers important, as with Jhin's death effects. — [Riot designer, outlet] [PCGamesN interview](https://www.pcgamesn.com/league-of-legends/designing-a-league-of-legends-champion-sometimes-you-get-vayne-and-sometimes-you-get-yorick), updated 2016-03-04
- Riot Axes says Yasuo is manaless because a continuous pattern is central to who he is. — [Riot] [Ask Riot: Manaless Champions](https://www.leagueoflegends.com/en-us/news/dev/ask-riot-manaless-champions/), 2021

**Strategic identity, or a reason to be picked. Tag: depends on 5v5.** As Riot writes it, this is about a unique contribution to a team and draft. It transfers only if restated as a matchup niche.
- Scruffy's 2016 values post rates strategic identity and thematic synergy as about right.
- Riot Xenogenic gives a three-step order for champion updates: keep iconic abilities, preserve strategic identity, then use the remaining room to deliver the gameplay that the art and lore promise. — [Riot] [Ask Riot: Winter on the Rift?](https://www.leagueoflegends.com/en-us/news/dev/ask-riot-winter-on-the-rift/), 2020-07-31
- In reworks, Scruffy says the first step is finding the core concept (Sion as a tanky undead juggernaut) and keeping old abilities only if they fit it. — [Riot, mirror] [RiotScruffy Q&A](https://www.surrenderat20.net/2015/01/red-post-collection-riotscruffy-q-on.html), 2015-01-12 (original: http://boards.na.leagueoflegends.com/en/c/gameplay-balance/cAWiGbL3-friday-night-red-qa-todays-topic-championupdate-design)

#### Power budget

**Tag: transfers to 1v1.** Removing items, runes and summoner spells moves the whole budget into the kit, so kit-level tradeoffs matter more.

**Definition.** I found no formal Riot definition. The nearest is Phroxzon: Riot balances a champion's total power across kit, items, summoner spells and runes, so a large item share leaves less for abilities. He adds that Legendary item effects were overriding champion gameplay, often as upfront burst. — [Riot] [Quick Gameplay Thoughts: Addressing Mythics](https://www.leagueoflegends.com/en-us/news/dev/quick-gameplay-thoughts-addressing-mythics/), 2023-09-14

**Application and examples.**
- Skarner: Jacob "Riot Llama" Crouch says his basic abilities were deliberately weak to pay for his ultimate. In the update, reliability is the main lever for lowering the ultimate's cost compared with a point-and-click version. — [Riot] [Champion Roadmap: October 2023](https://www.leagueoflegends.com/en-us/news/dev/champion-roadmap-october-2023/), 2023-10-12
- Mordekaiser: Riot Xenogenic says cutting ghost control after months of attempts freed budget for abilities that feel good, which is why his Q hits so hard. — [Riot] [Ask Riot: Winter on the Rift?](https://www.leagueoflegends.com/en-us/news/dev/ask-riot-winter-on-the-rift/), 2020
- Mel: Kevin "Captain Gameplay" Huang says removing her reflect makes the new W less impactful, which frees budget for the rest of her kit. — [Riot] [/dev: Mel Midscope](https://www.leagueoflegends.com/en-us/news/dev/dev-mel-midscope/), 2026-10-20
- Ratio rule: Scruffy says the damage-to-CC ratio matters more than raw CC. Low sustained damage can carry a lot of CC (Nautilus), while high burst makes even short CC a problem. — [Riot, mirror] [RiotScruffy Q&A](https://www.surrenderat20.net/2015/01/red-post-collection-riotscruffy-q-on.html), 2015
- Paying for removing a limiter: Riot Axes says going manaless puts heavy pressure on the rest of Yasuo's kit and can make individual spells feel underwhelming. — [Riot] [Ask Riot: Manaless Champions](https://www.leagueoflegends.com/en-us/news/dev/ask-riot-manaless-champions/), 2021
- Live tuning language: patch notes use the term for moving power between phases, such as tuning Ryze's early game down to keep his power late. — [Riot, excerpt only] [Patch 26.12 Notes](https://www.leagueoflegends.com/en-us/news/game-updates/league-of-legends-patch-26-12-notes/), 2026

#### Kit overload

**Tag: transfers to 1v1.** A kit with no real weakness has no teammate or team composition to exploit it in a duel, and the opponent must read all of it alone.

**Definition.** I found no formal definition. Scruffy, in replies to his own post, lists four costs of overloading a kit: added complexity (he says Riot wants depth rather than complexity), messy tooltips, patching over weaknesses the champion should have, and diluting the power budget so the core cannot shine. He agreed with a commenter that Ekko is overloaded. — [Riot, mirror] [Champion Gameplay Values 2016](https://www.surrenderat20.net/2016/02/red-post-collection-scruffy-on-champion.html)

**Application and examples.**
- Scruffy says Riot avoids the jack-of-all-trades problem by pairing very sharp strengths with a clear, accessible weakness. Mordekaiser and Sett are very strong juggernauts but can be kited. Senna and Aphelios have huge range and utility but cannot escape an assassin or diver. — [Riot] [Quick Gameplay Thoughts: April 17](https://www.leagueoflegends.com/en-gb/news/dev/quick-gameplay-thoughts-april-17/), 2020
- Jhin: a complex Q was removed because it added too much to a kit already built around his other abilities. — [Riot designer, outlet] [PCGamesN interview with August](https://www.pcgamesn.com/league-of-legends/designing-a-league-of-legends-champion-sometimes-you-get-vayne-and-sometimes-you-get-yorick), 2016
- Akali: her ultimate's first cast was originally untargeted, giving engage and escape at once, and Riot removed that. — [Riot] [Quick Gameplay Thoughts: May 28](https://www.leagueoflegends.com/en-us/news/dev/quick-gameplay-thoughts-may-28/), 2021-05-28
- Kled: Riot's retrospective says his Q-to-E combo weakened the counterplay to his tether. — [Riot, mirror] [/dev: On the Champs of 2016](https://www.surrenderat20.net/2017/02/dev-on-champions-of-2016.html), 2017-02-15 (original: http://nexus.leagueoflegends.com/2017/02/dev-on-the-champs-of-2016/)
- Gnar and Rek'Sai: Meddler says Mega Gnar's W was simplified because the kit felt overloaded, and the Mega E's knockup was cut because he had too much CC while the leap stayed useful as pure damage. Stealth on burrowed Rek'Sai was cut because the kit already had too much going on, and her pass-through dash was changed because tunnels already gave enough mobility. — [Riot, mirror] [/dev: On Champion Prototypes](https://www.surrenderat20.net/2016/10/red-post-collection-champion-prototype.html), reposted 2016-10-21 (original: https://nexus.leagueoflegends.com/en-us/2016/10/dev-on-champion-prototypes/, which now redirects to the homepage)

#### Windows of weakness

**Tag: transfers to 1v1.** Round length, cooldown commitments and no outside help make punish moments the main unit of a duel.

**Definition.** I found no Riot source using this phrase. The grouping below is mine. Riot's own framing of each item differs.
- Reaction window: Scruffy says the goal is that a crowd-controlled enemy always has a brief window to react, neither helplessly disabled nor already dead. — [Riot, mirror] [RiotScruffy Q&A](https://www.surrenderat20.net/2015/01/red-post-collection-riotscruffy-q-on.html), 2015
- Commitment: Scruffy says that with low cooldowns and free targeting a champion chooses when to be in or out of fights, and so never takes a risk or commits. A level 16 Kassadin is the nearest case, and he has to survive a disadvantaged early game to get there. — [Riot] [May 28](https://www.leagueoflegends.com/en-us/news/dev/quick-gameplay-thoughts-may-28/), 2021
- Resource downtime: Riot Axes says mana sets a rhythm and creates natural breaks. Rumble's Heat forces downtime or a fight when he overheats, and mana makes a missed Blitzcrank hook costly. — [Riot] [Ask Riot: Manaless Champions](https://www.leagueoflegends.com/en-us/news/dev/ask-riot-manaless-champions/), 2021
- Time to kill: the durability update promises bigger chances for counterplay and says burst dealers must now press one or two more buttons at a given lead. — [Riot] [5/6](https://www.leagueoflegends.com/en-us/news/dev/quick-gameplay-thoughts-5-6/), 2022
- Range-based vulnerability: Mel's E root is shortened against nearby enemies and lengthened against distant ones, adding vulnerability in close fights. — [Riot] [/dev: Mel Midscope](https://www.leagueoflegends.com/en-us/news/dev/dev-mel-midscope/), 2026
- Windup cost: Skarner's Q is costly with a longer cast, so his follow-ups can land. — [Riot] [Roadmap: October 2023](https://www.leagueoflegends.com/en-us/news/dev/champion-roadmap-october-2023/)
- Scaling weakness **(this one: depends on 5v5)**: Kayn's late-game strength is paid for by early-game weakness. A 30-minute scaling curve has no equivalent in short rounds. — [Riot] [May 14](https://www.leagueoflegends.com/en-us/news/dev/quick-gameplay-thoughts-may-14/), 2021

### Inferences
- Tactical counterplay, clarity, and sharp-strength-with-clear-weakness are the core of Riot's value set that survives the move to a duel almost unchanged. Strategic counterplay, Teamplay and strategic identity do not.
- Removing items and summoner spells removes a large share of what Riot lists as budget and as strategic counterplay. Each kit then has to contain its own limiter, and mana, Heat and long windups are Riot's own examples of limiters.
- Cover plausibly replaces the option of standing behind allies or minions in Riot's tactical counterplay list. That is my extrapolation. No Riot source discusses it.

### Gaps
- No Riot source uses "windows of weakness", so that section is a grouping I built.
- No formal Riot definition of power budget or overload was found. Both are inferred from usage.
- S@20 says Morello would detail counterplay in a separate blog. I did not find that post.
- A search excerpt mentions sharpening as a Riot term for balance changes that accentuate a champion's strengths and weaknesses, but I could not attribute it to a specific page, so it is not used as a finding.

## What frameworks does Riot describe for designing a new champion from start to finish?

### Takeaway
Riot describes a staged process: find a player or roster opportunity, settle identity, test several gameplay directions fast with placeholder art, keep the best, then cut hard. Most of a kit is expected to die, and judgement rests on playtest response, repeat play and perceived fairness, with data as an input rather than a verdict.

### Cited Findings

**Order of decisions. Tag: transfers to 1v1.** Nothing in the order needs a team, though "lane or role" starting points become class or matchup starting points.
- August (2022): a champion may start from an opportunity space (a group of players to satisfy), a concept, a role, a story need or a fixed slot. Identity and power source come next, often a signature weapon or tool. Then several kits on paper, of which the ones with traction stay. Then in-game playtests with recoloured models and recycled effects. Then model, VFX and final testing. Theme usually precedes the kit, though Senna started from a mechanic and role, Jinx from concept art, and Viego from a story need. — [Riot designer, outlet] [Millenium interview](https://us.millenium.gg/news/26339.html), 2022-02-17
- August (2016): prefers to start from character, asking what they would do in game and what it should feel like, then builds the kit from that. — [Riot designer, outlet] [PCGamesN](https://www.pcgamesn.com/league-of-legends/designing-a-league-of-legends-champion-sometimes-you-get-vayne-and-sometimes-you-get-yorick), 2016

**Roster-gap analysis. Tag: transfers to 1v1.** Class and difficulty axes still work on a small roster. Riot's role axis does not apply.
- August analysed the roster by role, class and difficulty and found two gaps: a higher-skill tank (K'Sante) and a simple assassin (Naafiri). — [Riot] [Champion Insights: Naafiri](https://www.leagueoflegends.com/en-us/news/dev/champion-insights-naafiri/), 2023-06-22

**Gameplay discovery. Tag: transfers to 1v1.** It is a process for avoiding early attachment to one idea, with no dependence on game mode.
- Scruffy's four questions: does the direction open new gameplay space, does the theme resonate with the intended players, does the gameplay hook deliver on the theme, and is there room for it to be satisfying and healthy (not removing strategy, interaction or counterplay). — [Riot] [Quick Gameplay Thoughts: September 4](https://www.leagueoflegends.com/en-us/news/dev/quick-gameplay-thoughts-september-4/), 2020-09-04
- The eight-week cycle is run by one gameplay designer. The wider team brainstorms and leads pick the top three directions. Each gets two weeks of prototyping (weeks 1-2, 3-4, 5-6), and weeks 7-8 strengthen the winner and reduce its risks. No scoring method is described. The stated benefit is avoiding attachment and gaining confidence that the choice beat real alternatives. Same post.

**Prototyping with placeholders. Tag: transfers to 1v1.** It is a cost-saving method for testing kits, and needs no team mode.
- Meddler says a small team (artist, writer, gameplay designer) sets the core concept, then the champion gets into the game early so that abilities, strengths, weaknesses and technical issues can be tested. Many champions go through dozens of ability variations. Models, effects and sounds are borrowed and modified, because experiments are often thrown away within days. — [Riot, mirror] [/dev: On Champion Prototypes](https://www.surrenderat20.net/2016/10/red-post-collection-champion-prototype.html), 2016-10
- He says a good placeholder is distinct, represents the intended gameplay and evokes the intended personality, because a wrong-feeling placeholder skews playtest feedback. Kled's first placeholder, a pink mini Hecarim, was clear but lacked personality, while binding a Gnar model to the mount greatly improved feedback. Kled's ultimate was temporarily a copy of Riven's so the rest of the kit could be tested. Same post.

**What gets cut. Tag: transfers to 1v1.** Cutting is about focus, frustration and cost, all of which apply in a duel.
- Meddler: Devour began as Gnar's ultimate and moved to Tahm Kench because it felt like it belonged at the core of a kit, and Gnar's focus was meant to stay on his transformation. Kled's ranged area-CC W was dropped because testing showed it did not fit. Bard's many-Meeps experiment was never meant to ship because too much would be on screen. — [Riot, mirror] [/dev: On Champion Prototypes](https://www.surrenderat20.net/2016/10/red-post-collection-champion-prototype.html), 2016-10
- Often only one skill from an early kit survives, and the last skill is usually the hardest. Thresh being nearly complete at the first playtest is described as rare. Zeri's early W, an execute below a health threshold, was cut. — [Riot designer, outlet] [Millenium](https://us.millenium.gg/news/26339.html), 2022
- Jhin's bounty-hunter kit was dropped, and a laser ultimate was buggy and felt wrong. — [Riot designer, outlet] [PCGamesN](https://www.pcgamesn.com/league-of-legends/designing-a-league-of-legends-champion-sometimes-you-get-vayne-and-sometimes-you-get-yorick), 2016
- Hwei's early direction was judged not to be working after several iterations, with ideas such as custom Summoner Spells and terrain manipulation tried along the way. A major reset produced the 10-ability kit. — [Riot] [Champion Insights: Hwei](https://www.leagueoflegends.com/en-us/news/dev/champion-insights-hwei/), 2023-11-19
- Sett's grapple and Mordekaiser's ghost control are covered above. Scruffy says roughly one in five early update explorations is paused and later resumed, as with Warwick. — [Riot, mirror] [RiotScruffy Q&A](https://www.surrenderat20.net/2015/01/red-post-collection-riotscruffy-q-on.html), 2015

**How a kit is tested and judged. Tag: transfers to 1v1.** Except for the scale of public launch data, which needs a large player base.
- K'Sante: playtesters held back his W before ulting to save it for the outplay, so the team made its cooldown refresh on entering the ultimate. The kick through walls was added as a tradeoff, because the ultimate leaves his team without a tank. — [Riot] [Champion Insights: K'Sante](https://www.leagueoflegends.com/en-gb/news/dev/champion-insights-k-sante/), 2022-10-18
- August's criteria: early playtest traction, whether players have a reason to return and a plan for next time, and whether the champion is seen as fair. Vi seemed unfair at release and became easier to counter as players learned her. — [Riot designer, outlet] [Millenium](https://us.millenium.gg/news/26339.html), 2022
- August also says Riot uses data as an input and not the decider: a champion's numbers are judged against what it is meant to do well and badly, and a fair loss should leave the player with a plan. — [Riot designer, outlet] [PCGamesN](https://www.pcgamesn.com/league-of-legends/designing-a-league-of-legends-champion-sometimes-you-get-vayne-and-sometimes-you-get-yorick), 2016
- Riot says some problems only appear once the far larger player base has the champion, as with Akali's true invisibility, and targets a balanced state within one patch of pro data. — [Riot] [/dev: Balancing New Champions](https://www.leagueoflegends.com/en-us/news/dev/dev-balancing-new-champions/), 2020
- Scruffy says players generate more data in the first day than the team gathers in development. — [Riot] [April 17](https://www.leagueoflegends.com/en-gb/news/dev/quick-gameplay-thoughts-april-17/), 2020

**Retrospective lessons. Tag: transfers to 1v1.** Aurelion Sol's lesson about pairing big themes with accessible gameplay is mode-independent. Taliyah's pro-play lesson is the exception and depends on 5v5.
- Aurelion Sol: his unusual inputs and slow payoffs reached only a small group, so the lesson is to pair big themes with more accessible play.
- Taliyah: Riot underestimated how strong her cutoffs were in coordinated play, and now looks harder at pro risk.
- Kled: Riot wishes his skilled plays were clearer, and treats a shoot-first design as something to reuse sometimes.
- Camille: strong moments attract players, but overtuning breeds frustration quickly. — [Riot, mirror] [/dev: On the Champs of 2016](https://www.surrenderat20.net/2017/02/dev-on-champions-of-2016.html), 2017

### Inferences
- Riot's stated process assumes throwaway prototypes on placeholder assets. A small team can copy the discovery structure at much lower scale, because it depends on the discipline of testing three directions, not on Riot's headcount.
- The K'Sante case shows the feedback Riot acts on: watch what players avoid doing, then change the kit so the desired behaviour stops costing them something.

### Gaps
- Jeremy Lee's GDC 2017 talk on Riot's production framework is the most direct source on this question, but I only saw listings. — [GDC Vault listing](https://www.gdcvault.com/play/1024101/Creating-League-of-Legends-Champions); [Game Developer note](https://www.gamedeveloper.com/design/video-how-riot-creates-new-i-league-of-legends-i-champions), 2019-11-22. The Game Developer note says the talk is free on GDC's YouTube channel, and its stages are not recorded here.
- Nathan Blau's GDC 2019 talk on data and champions was also seen only as a listing. — [GDC Vault](https://www.gdcvault.com/play/1026252/Data-Informed-Decisions-with-the/)
- Scruffy's discovery post has no real champion examples, and I found no Riot statement that the eight-week structure is still in use in 2026.
- Riot's own current class or role article was not found. A forum excerpt says roles define what a champion brings rather than a lane, and the League Wiki is the only other description. — [Riot, excerpt only, date unverified] [Updates to Champion Role Names](http://forums.na.leagueoflegends.com/board/showthread.php?t=3672374&page=1#post39858469); [Community] [League Wiki: Champion classes](https://wiki.leagueoflegends.com/en-us/Champion_classes)

## What does Riot say about mechanical depth versus accessibility, and about floor and ceiling?

### Takeaway
Morello's 2012 point stands as Riot's core claim: floor and ceiling are separate dials, so a kit can raise its ceiling without raising its floor. Riot's aim since is low floor and high ceiling, with a spread of complexity across the roster, and it admits repeatedly that it misses the aim in both directions.

### Cited Findings

**Floor and ceiling are independent. Tag: transfers to 1v1.** The dials are properties of a kit, not of team context.
- Morello: the floor is the minimum skill to play without constantly dying and feeding, and the ceiling is the extra power that skill and practice can earn. Slowing Diana's skillshot and shortening its recovery would raise her ceiling with the floor about the same. He adds that not every champion can be built this way, because players want different things. — [Riot, mirror] [On Kha'Zix, Void Champions, Skill Floor & Ceiling](https://www.surrenderat20.net/2012/09/on-khazix-void-champions-skill-floor.html), 2012-09-20
- Zenon gives similar definitions: the ceiling is what a highly skilled player can do, the floor is what a newer player contributes by simply playing. — [Riot, mirror; designer's ask.fm via S@20] [Red Post Collection](https://www.surrenderat20.net/2015/10/red-post-collection-dev-blog-on-data.html), 2015-10-08

**The aim and its failures. Tag: transfers to 1v1.** Except for the pro-coordination half of the pro problem, which depends on team play.
- Scruffy states the aim as low floor and high ceiling and admits Riot does not always reach it. He names the pro problem: overly complex or coordination-heavy kits dominate pro play and are then nerfed until unappealing to most players. — [Riot, mirror] [/dev: On the Champs of 2016](https://www.surrenderat20.net/2017/02/dev-on-champions-of-2016.html), 2017
- In that post's comments, August says complexity itself is not the issue, only complexity that makes a champion hard to pick up. Lee Sin, Yasuo and Vayne are easy to start and hard to master, while Azir and Aurelion Sol are harder to begin. Scruffy adds that strong fantasy, clear feedback on mistakes and avoiding all-or-nothing mastery keep the learning phase fun. Same page.
- Hwei: pressing Q, W or E twice gives reasonable results for beginners, while mixing the 10 abilities is the long-term depth. Riot Emizery says first-time players were mostly pleasantly surprised, and the long-term target is elite players rather than low-skill ones. — [Riot] [Champion Insights: Hwei](https://www.leagueoflegends.com/en-us/news/dev/champion-insights-hwei/), 2023

**Complexity framework. Tag: transfers to 1v1.** The three axes are usable as written, and the axis on playing against a champion matters most because the opponent has no teammates to share the load.
- Scruffy scores complexity on three axes, each Low, Medium or High. Mechanical: spells that just work, up to high-APM and punishing execution. Knowledge: skills transfer from other champions, up to needing a guide. Playing with or against: others need not change, up to rethinking strategy at a high level. — [Riot] [October 30](https://www.leagueoflegends.com/en-au/news/dev/quick-gameplay-thoughts-october-30/), 2020-10-30
- 2020 ratings (mechanical / knowledge / with-against): Sett M/L/M, Fiddlesticks L/M/H, Volibear L/L/M, Lillia M/L/M, Yone H/M/M, Samira H/M/M. Same post.
- Roster shape: Scruffy wants a bell curve with few very simple and few very complex champions, a range within each class and position, and reworks that stay near their old complexity. Same post. The position part depends on 5v5.

**Simple champions and rank spread. Tag: transfers to 1v1.** Any game with a skill-based ladder has this issue, and duels may amplify it because nothing else compensates for a weak pilot.
- Riot Scruffy says simple champions appeal to new players because they rely more on decisions than execution, but they run much stronger at low elo, so balancing them often makes them non-viable higher up. With fewer outplay tools, they also fall into stat-check play when snowballed. He said old-Taric-style champions already covered that niche and that Riot tries to keep simple champions simple in reworks, as with Warwick. — [Riot, mirror] [Ask Riot: Skins and Champions](https://www.surrenderat20.net/2018/06/red-post-collection-quick-gameplay_14.html?m=1), 2018-06 per the link path (original: https://nexus.leagueoflegends.com/en-us/2018/06/ask-riot-skins-and-champions/)

**Niche champions. Tag: depends on 5v5.** More exactly, it depends on a roster of 150 or more that can absorb a champion few people play, which a small duel roster cannot afford in the same way.
- Scruffy says niche champions are deliberate strategy even with small audiences, and calls Bard a success. — [Riot, mirror] [/dev: On the Champs of 2016](https://www.surrenderat20.net/2017/02/dev-on-champions-of-2016.html), 2017

**Accessibility through reduced execution. Tag: transfers to 1v1.** The mechanism does, although Riot's stated payoff (macro decisions) largely does not, and a duel would need a different payoff, such as positioning around cover.
- Naafiri's kit reduces execution demands so that players can focus on macro. — [Riot] [Champion Roadmap: April 2023](https://www.leagueoflegends.com/en-ph/news/dev/champion-roadmap-april-2023/), 2023-04-28

### Inferences
- Morello's Diana example gives a usable recipe: tune a skillshot's speed and recovery so that the entry cost is flat and the reward for skill grows. It is Riot's own hypothetical, not a shipped change.
- Riot's accessibility model assumes the burden of learning falls on the player who chooses the champion. Its rule against forcing study on opponents is more binding in a duel.

### Gaps
- I found no Riot statement from 2024 to 2026 on the complexity spread, and no statement on this from Phroxzon or Reav3.
- Ghostcrawler's GDC 2017 talk may address this, but I only read an outlet report (see the next section).

## What does Riot say about balance frameworks that affect kit shape: mobility, damage and durability creep, pro play versus solo queue?

### Takeaway
Riot treats mobility, damage and sustain as systems that drift upward and need deliberate correction, and it ties each back to counterplay and class weakness. Its pro-versus-everyone framework is mostly about 5v5 draft data, so little of that machinery transfers, but its underlying rule (raw kit power must not outweigh player skill) does.

### Cited Findings

**Mobility must be paid for. Tag: transfers to 1v1.** Scruffy states this rule in explicitly 1v1 terms, and chase and escape around cover are a duel's main spatial contest. The minion-based constraints in his examples do not carry over.
- Scruffy says mobile champions should be weaker elsewhere (range, damage, defences) so that they cannot easily win 1v1 against less mobile foes. Item and rune mobility should compete with other options. — [Riot] [Quick Gameplay Thoughts: May 28](https://www.leagueoflegends.com/en-us/news/dev/quick-gameplay-thoughts-may-28/), 2021-05-28
- Good forms: constrained mobility (Irelia's Q against minions, Tristana's W reset, Yasuo's E) and very long cooldowns (Flash). Poor forms: breaking a class weakness (juggernauts are defined by low mobility), creeping past established range, speed and dash norms, and unconstrained low-cooldown free-target mobility. Same post.
- Riot admits it overreached on systemic mobility in the item update and its follow-up. Same post.
- Earlier: Scruffy says Riot was getting more selective and tying mobility to costs, asking what Lucian, Tristana and Corki pay. — [Riot, mirror] [RiotScruffy Q&A](https://www.surrenderat20.net/2015/01/red-post-collection-riotscruffy-q-on.html), 2015. In 2016 he said too many champions had dashes they did not need. — [Riot, mirror] [Champion Gameplay Values 2016](https://www.surrenderat20.net/2016/02/red-post-collection-scruffy-on-champion.html)
- Later: Phroxzon says Riot wants to stop designing new champions around item-granted mechanics, such as building every ADC around a dash. — [Riot] [Addressing Mythics](https://www.leagueoflegends.com/en-us/news/dev/quick-gameplay-thoughts-addressing-mythics/), 2023

**Damage and durability. Tag: transfers to 1v1.** Time to kill sets how many decisions fit in a round, which applies directly. The Baron and turret side effects do not.
- The team says there was too much damage in League, with the costs being squishy carries struggling to matter, unclear causes of death and short, confusing teamfights. Raising base stats for every champion was chosen over weakening specific offensive sources. Burst should still punish poor positioning, and players should have to execute a champion's core skill test to land combos. — [Riot] [Quick Gameplay Thoughts: 5/6](https://www.leagueoflegends.com/en-us/news/dev/quick-gameplay-thoughts-5-6/), 2022-05-06
- Earlier: Morello says power creep had gone too far. New champions and items gradually create an arms race that gets in the way of decisions and counterplay, and the goal is for players to respond with skill rather than one champion simply beating another. Riot's plan was to reset item baselines and lower overall power, and he cites AP Tryndamere as a strong concept nerfed because it weakened gameplay. — [Riot designer, outlet] [PCGamesN](https://www.pcgamesn.com/leagueoflegends/league-legends-apply-heavy-nerfs-champions-power-creep-has-gotten-out-hand), page marked updated 2014-05-29; the statement concerns Season 3 and appears to date from 2013.
- Meddler says burst was on average too high, and that kit damage had changed little while non-kit damage had grown, with more of it landing at the start of a fight instead of spread across a champion's combat pattern. — [Riot, mirror] [Quick Gameplay Thoughts: August 3](https://www.surrenderat20.net/2018/08/red-post-collection-stats-tab-now-live.html), 2018-08-03 (original: https://boards.na.leagueoflegends.com/en/c/developer-corner/yTorNEcE-quick-gameplay-thoughts-august-3)

**Sustain and healing. Tag: transfers to 1v1.** A heal that undoes a won exchange has the same effect in a duel. The Grievous Wounds remedy depends on items and does not transfer.
- Phroxzon says healing is a problem when it breaks a champion's intended counterplay, even at a balanced win rate. Sustained burst healing is the worst case because it encourages drain tanking. Aatrox could miss half his spells against a kiting player and still return to full. Red Kayn is his example of workable counterplay: easy to kite, poor target access, and he must land spells to heal. If Irelia can facetank and heal without skilled use of her W, it has gone too far. He splits Core Healers from Incidental Healers. — [Riot] [Quick Gameplay Thoughts: 7/29](https://www.leagueoflegends.com/en-us/news/dev/quick-gameplay-thoughts-7-29/), 2022-07-29

**Skill versus raw power. Tag: transfers to 1v1.** With no team to mask it, power that replaces skill shows immediately.
- Greg "Ghostcrawler" Street says balance should never let raw champion strength outweigh player skill, and notes that all ranks share one ruleset. He targets balance where the most players can give useful feedback, and warns against both focusing only on pros and ignoring the players who drive the metagame. — [Riot designer, outlet] [PCGamesN report of his GDC 2017 talk](https://www.pcgamesn.com/league-of-legends/league-of-legends-balance-philosophy-esports), 2017-04-16

**Pro play versus everyone else. Tag: depends on 5v5.** The metrics are draft presence in top leagues and the risks are coordinated team strategies, and a pre-launch 1v1 game has neither.
- RiotRepertoir: four audiences (Average, Skilled, Elite, Professional). A champion is overpowered if it crosses the top band for any audience, and underpowered only if below the bottom band for all. Win rate and ban rate are the main signals for most tiers, and play rate is not one, since Yasuo and Lee Sin are played regardless of performance. Riven's cooldown change in 9.10 targeted both power and frustration. — [Riot] [/dev: Champion Balance Framework](https://www.leagueoflegends.com/en-us/news/dev/dev-champion-balance-framework/), 2019-05-30
- Pro is judged by presence (picks plus bans), since one patch gives only about 200 games. A champion needs to be weak at all levels before a buff, so Amumu being absent from pro is acceptable. Every change affects everyone on the shared Rift. Locked-in champions harm draft: Pantheon in 2019, after which Riot required new champions to be enabled in playoffs before internationals. — [Riot] [/dev: Balancing for Pro Play](https://www.leagueoflegends.com/en-us/news/dev/dev-balancing-for-pro-play/), 2020-08-20
- The framework finds outliers but does not say how to change a kit. Designers decide that and must respect the champion's playstyle. Yuumi was a case handled directly, by limiting how far she could act as a late-game healing hypercarry given her limited interaction with enemies. — [Riot] [/dev: Balance Framework Update](https://www.leagueoflegends.com/en-us/news/dev/dev-balance-framework-update/), 2020-06-30

**Kits are built for team context. Tag: depends on 5v5.** This is direct Riot evidence for the limit on transfer: many League kits are not self-contained duel kits.
- Phroxzon says ADC kits are not built for 1v1 and many have supportive parts that rely on an ally, using Jinx's trap as his example, and that many kits stop working properly when played 1v1. — [Riot designer, outlet] [RFT.GG interview](https://rft.gg/news/riot-phroxzon-interview), page date 06/08/2026. The format is ambiguous. A search result aged it about 89 days, which points to 6 August 2026 rather than 8 June.

**Riot's nearest round-based mode. Tag: transfers to 1v1.** It is a short-round format, the closest Riot comparison I found, although it is 2v2-based and has items.
- Riot's Arena FAQ says it wants all champions and strategies to be somewhat viable. A later post lists stale builds at high rank and strategies that are too reliable and uninteractive among lessons learned. Neither is about kit design as such. — [Riot, excerpt only] [/modes: Arena FAQ](https://www.leagueoflegends.com/en-us/news/dev/modes-arena-faq/); [/dev: Arena Round Three](https://www.leagueoflegends.com/en-gb/news/dev/dev-arena-round-three/). Dates of both not retrieved.

### Inferences
- Porting a League kit directly will often produce a kit with parts that do nothing, per Phroxzon. Ally-dependent setups and wave or objective tools need replacing rather than rebalancing.
- Scruffy's mobility list works as a checklist for a duel, with one change: constraints based on minions must be rebuilt around cover, targets or terrain. That substitution is mine.

### Gaps
- I found no Riot source that links the durability update to the balance framework. They are separate threads.
- Riot's approach to balance in 1v1 is not addressed anywhere I found, apart from the Phroxzon and Scruffy remarks above.
- Morello and Lantz's GDC 2015 talk and the Street GDC 2017 talk were not watched; only listings or reports were read. — [GDC 2015 listing](https://www.gdcvault.com/play/1021851/Building-a-Sport-The-Design); [GDC 2017 listing](https://www.gdcvault.com/play/1024237/Balancing-League-of-Legends-for)

## Where have Riot's designers disagreed with one another, or changed their position over the years?

### Takeaway
Riot's public record shows many reversals and no open disagreements that I could find. Changes of position are well documented, and designers often admit them directly. I found only one difference of emphasis between named designers, and that reading is mine.

### Cited Findings

**Position changes documented by Riot.** Each line carries the tag of the underlying principle.

- **Floor versus ceiling. Tag: transfers to 1v1.** The swing is the lesson, and it is not mode-specific.
  - Before 2014 Riot leaned towards floor, and in 2014 it over-indexed on ceiling with Azir, Kalista and Rek'Sai, per Zenon. — [Riot, mirror] [S@20](https://www.surrenderat20.net/2015/10/red-post-collection-dev-blog-on-data.html), 2015
  - In 2016 Scruffy wanted much more accessibility, since only one of nine reviewed champions fell below the Vel'Koz and Tahm Kench level. — [Riot, mirror] [2016 values](https://www.surrenderat20.net/2016/02/red-post-collection-scruffy-on-champion.html)
  - In 2018 Scruffy said Riot would likely not add many more simple champions. — [Riot, mirror] [Ask Riot: Skins and Champions](https://www.surrenderat20.net/2018/06/red-post-collection-quick-gameplay_14.html?m=1)
  - In April 2023 Riot Lexical said a prior group of releases leaned complex and that Milio marked a return to simpler design. — [Riot] [Roadmap: April 2023](https://www.leagueoflegends.com/en-ph/news/dev/champion-roadmap-april-2023/). That October, Riot said Milio and Briar were medium complexity, Naafiri simpler, and that a high-complexity champion was still missing, which Hwei filled. — [Riot] [Roadmap: October 2023](https://www.leagueoflegends.com/en-us/news/dev/champion-roadmap-october-2023/)
- **Launch power. Tag: transfers to 1v1.** Launch-state choice applies to any new kit, though the sample sizes differ.
  - Riot used to tune launches to match the pool after about two weeks, partly as training wheels. Bard, Ivern and Ornn launched below 40% and were seen as failures. The new approach launches at the long-term balance point, even though champions look weak at first. — [Riot] [Balancing New Champions](https://www.leagueoflegends.com/en-us/news/dev/dev-balancing-new-champions/), 2020; [April 17](https://www.leagueoflegends.com/en-gb/news/dev/quick-gameplay-thoughts-april-17/), 2020. Scruffy admits Senna, Sett and Aphelios launched too strong.
- **Mythic items. Tag: depends on 5v5.** No items in the target game. The relevant lesson is limited to items overriding kits.
  - Phroxzon reports that Mythics satisfied about half of champions, that fully satisfying everyone would have needed about 30% more items, and that they created design debt, so they were removed. — [Riot] [Addressing Mythics](https://www.leagueoflegends.com/en-us/news/dev/quick-gameplay-thoughts-addressing-mythics/), 2023
- **Pro thresholds. Tag: depends on 5v5.** Draft-presence numbers have no equivalent in the target game.
  - The bands went from 90% and 80% in 2019 to 95% and 85% in 2020, with 90% and 80% kept for MSI and Worlds. — [Riot] [2019 framework](https://www.leagueoflegends.com/en-us/news/dev/dev-champion-balance-framework/); [Pro Play 2020](https://www.leagueoflegends.com/en-us/news/dev/dev-balancing-for-pro-play/). Riot also says it had been too aggressive with Worlds buffs, with Kha'Zix as the main example.
- **Power creep safeguard. Tag: transfers to 1v1.** A habit of buffing over nerfing is a risk in any balance process.
  - Buffs had outpaced nerfs since Worlds 2019, so Riot tightened bands and added a rule to consider nerfs if over half of its changes are buffs. — [Riot] [Balance Framework Update](https://www.leagueoflegends.com/en-us/news/dev/dev-balance-framework-update/), 2020
- **Kit-level reversals. Tag: transfers to 1v1.** Both concern a mechanic that could not be made fair.
  - Akali's true invisibility was removed as an unhealthy mechanic. — [Riot] [Balancing New Champions](https://www.leagueoflegends.com/en-us/news/dev/dev-balancing-new-champions/), 2020
  - Mel's reflect was first meant to be an exciting new mechanic. Riot later found it could not be tuned to be strong without frustrating opponents, and any version outside the ultimate slot was still frustrating or unappealing. — [Riot] [/dev: Mel Midscope](https://www.leagueoflegends.com/en-us/news/dev/dev-mel-midscope/), 2026

- **Mechanical execution as a goal. Tag: transfers to 1v1.** It is a kit property, independent of team context.
  - Scruffy's 2016 call for less of it sits next to later kits that Riot rates or describes as high-execution or high-skill (Yone and Samira in 2020, K'Sante in 2022, Hwei in 2023). Riot's bell-curve framing reconciles these, since a few very complex champions are always intended, so this reads as a change of emphasis over time. — [Riot] [October 30](https://www.leagueoflegends.com/en-au/news/dev/quick-gameplay-thoughts-october-30/), 2020

**The one difference of emphasis between designers. Tag: transfers to 1v1.** It concerns kits, not team context. The reading is my interpretation, and no source frames it as a dispute.
- **Whether complexity itself is the risk.** Scruffy in February 2016 wanted more accessibility and less mechanical execution. — [Riot, mirror] [2016 values](https://www.surrenderat20.net/2016/02/red-post-collection-scruffy-on-champion.html). August in March 2016 said the bigger danger is a champion whose weaknesses are fully negated by perfect play. — [Riot designer, outlet] [PCGamesN](https://www.pcgamesn.com/league-of-legends/designing-a-league-of-legends-champion-sometimes-you-get-vayne-and-sometimes-you-get-yorick). August in 2017 repeated that complexity is only a problem when it stops people picking a champion up. — [Riot, mirror] [S@20](https://www.surrenderat20.net/2017/02/dev-on-champions-of-2016.html)

### Inferences
- The pendulum on floor and ceiling suggests that a single target does not hold for long. Riot's later answer is a spread across the roster, which a small roster can only partly copy.
- Riot's reversals follow a repeated shape: a novel or generous mechanic ships, then comes back because of frustration or lost counterplay. Reflect, true invisibility and Mythics all fit. It is a warning for any kit whose appeal rests on removing an opponent's options.

### Gaps
- I found no Riot-authored record of named designers openly disagreeing. Searches for a Morello and CertainlyT dispute returned only fan commentary, which is not used.
- Interview-based sources I could not open (403 or 404): the [GameSpot Morello interview](https://www.gamespot.com/articles/balancing-an-esport-and-designing-the-jungle-an-in/1100-6425770/) and an esports.gg piece reporting that Reav3 said Riot would stop focusing on monstrous champions, which would be a position change on theme. The Reav3 claim is unverified and not used. — [esports.gg](https://esports.gg/news/league-of-legends/does-lol-champion-design-lack-personality/)
- web.archive.org could not be fetched with the tools available, so dead nexus and boards originals could not be compared against the S@20 reposts.
