---
title: Kit anatomy
tags: [knowledge, research, league-of-legends]
updated: 2026-11-04
---

Research notes behind [League kit design](../league-kit-design.md), kept for their sources. Read through a tool that summarises pages, so check wording and small numbers at the source.

# League of Legends kit anatomy: how the parts of a champion kit work together

Conventions used throughout (accessed 2026-11-04):

- **Source labels.** "Riot" means Riot-authored, including Riot text mirrored on Surrender at 20 (S@20), archive.runeterra.net or devtrackers.gg. "Wiki" means the community-maintained League wiki, used for mechanics only. "Community" means guides, forum posts and essays. "Press" means news coverage. "Inference" means my own reasoning.
- **Riot intent.** Any claim about what Riot intended cites a Riot source. Where Riot's words reached me only through a search summary, the bullet says so.
- **Numbers.** All cooldowns and costs are approximate, come from the wiki page named, and carry that page's "last changed" patch. They were read through a fetch tool that summarises pages, so check a value on the live page before building on it. Cooldowns are in seconds, and ranges run from rank 1 to max rank.
- **Tags.** Every principle carries `[transfers to 1v1: why]` or `[depends on 5v5: why]`. The target game is a 1v1 duel in short rounds on an arena with cover, with no items, lanes, minions, objectives or team.
- **Unknown inputs.** I do not know the target game's round length, or whether cooldowns and resources reset between rounds. Conclusions about cooldown windows and resources depend on both, so recheck them once these are set. Where I assume a reset, I am borrowing it from League's Arena mode.

## How is a kit's power distributed across passive, Q, W, E and R, and how do kit shapes differ by class?

### Takeaway
Letters do not map to fixed jobs. What is consistent across the twelve kits sampled is a ladder of time: a short-cooldown rhythm tool (usually Q), medium-cooldown commit and defence tools, and an ultimate on a timer roughly 4.5 to 12 times the longest basic. I found no Riot source that states a per-slot power budget, so the distribution below is reconstructed from the kits themselves.

### Cited Findings
- A kit is normally one innate ability, three basic abilities and one ultimate. Ultimates can only be learned or ranked at levels 6, 11 and 16, basics usually have five ranks and ultimates three — [Wiki: Ability](https://wiki.leagueoflegends.com/en-us/Ability)
- Aphelios breaks this frame: he cannot rank abilities, and skill points go to stats instead — [Wiki: Aphelios](https://wiki.leagueoflegends.com/en-us/Aphelios)
- Riot Jag argues that laners get many tools (sustain, wave clear, mobility, damage, crowd control) because a champion with one narrow strength is too binary to function in a long lane, with Tryndamere as his example. He wrote that "top lane is the dueling lane" — [Riot: Jag, On Evolving the Laning Fighter, Dec 2016, S@20 mirror](https://www.surrenderat20.net/2016/12/red-post-collection-dev-blog-on.html)
- In tension with that, Morello's 2014 teamplay pillar says champions should fill distinct roles and rely on teammates rather than do everything alone — [Riot: Morello, Design Values, May 2014, mirror](https://archive.runeterra.net/na/riot-official/m1tKGoHQ)
- Riot judges complexity on three axes: mechanical, knowledge, and how hard the champion is to play with or against. I only have this through search summaries, because the two articles reporting Mark Yetter's post would not open — [Press: Dot Esports, not opened](https://dotesports.com/league-of-legends/news/riot-discusses-leagues-champion-design-philosophy-rates-2020-champs-on-their-complexity); [Press: ESN, not opened](https://esn.gg/league-of-legends/riot-examines-leagues-champion-design-philosophy-and-assesses-complexity-of-2020-champs)
- Meddler said in 2014 that an average champion keeps only one or rarely two things from its paper kit, so kits are found in playtesting. This is from a search summary — [Riot: Meddler, S@20 mirror](https://www.surrenderat20.net/2014/08/red-post-collection-meddler-champion.html?m=1)
- Community opinion is split on overloaded kits. One writer defines the term as many aspects squeezed into one kit and says this does not by itself mean overpowered; another argues overload gives more options and outplays. Both come from search summaries — [Community: RiftFeed](https://riftfeed.gg/champions/overloaded-kits-in-league-of-legends); [Community: Tech4Gamers](https://tech4gamers.com/why-i-think-overloaded-character-kits-are-good-for-league)
- Class definitions, in brief — [Wiki: Champion classes](https://wiki.leagueoflegends.com/en-us/Champion_classes):
  - Juggernaut: deals and absorbs heavy damage, has short reach and little gap closing.
  - Diver: a mobile fighter that reaches priority targets, less durable than a tank.
  - Assassin: gets in to kill a priority target, must enter danger, has escape tools.
  - Skirmisher: high sustained damage to nearby enemies with situational defences, lacks burst and reliable gap closers.
  - Burst mage: locks a target down then unloads, weak when it misses.
  - Battlemage: sustained close-to-mid area damage with defensive tools.
  - Artillery: long-range attrition, fragile and immobile.
  - Marksman: reliable sustained ranged damage through attacks, fragile and item-dependent.
  - Enchanter and Catcher: controllers, not built to win 1-on-1, and they rely on allies.
  - Vanguard and Warden: tanks that start fights for allies or protect them.

**Cooldown ladder across the twelve kits** (costs in brackets, approximate):

| Kit | Resource | Q | W | E | R (ranks 1/2/3) | Last changed | Source |
|---|---|---|---|---|---|---|---|
| Fiora | Mana | 13 to 6 (20), half back on hit | 24 to 16 (50) | 11 to 7 (40) | 110/90/70 (100) | V26.19 | [Wiki](https://wiki.leagueoflegends.com/en-us/Fiora) |
| Camille | Mana | 9 to 5 (25) | 12 to 10 (50-70) | 16 to 12 (70) | 140/115/90 (100) | V26.19 | [Wiki](https://wiki.leagueoflegends.com/en-us/Camille) |
| Riven | None | 13 after third cast or lapse | 11 to 7 | 10 to 6 | 120/90/60 | V26.15 | [Wiki](https://wiki.leagueoflegends.com/en-us/Riven) |
| Sett | Grit (W spends all) | 9 to 5 | 18 to 12 | 16 to 10 | 120/100/80 | V25.17 | [Wiki](https://wiki.leagueoflegends.com/en-us/Sett) |
| Lee Sin | Energy | 10 to 6 (50 + 25) | 8 (50 + 25) | 8 (50 + 25) | 110/85/60 | V26.21 | [Wiki](https://wiki.leagueoflegends.com/en-us/Lee_Sin) |
| Zed | Energy | 6 (55-75) | 20 to 16 (20-40, refund 30-50) | 3-5 (40) | 120/110/100 | V26.10 | [Wiki](https://wiki.leagueoflegends.com/en-us/Zed) |
| Thresh | Mana | 19 to 9 (70) | 21 to 17 (50-70) | 13 to 10 (60-80) | 120/100/80 (100) | V26.22 | [Wiki](https://wiki.leagueoflegends.com/en-us/Thresh) |
| Ahri | Mana | 7 (55-95) | 5-9 (30) | 12 (60) | 100-140 (100) | V26.06 | [Wiki](https://wiki.leagueoflegends.com/en-us/Ahri) |
| Jhin | Mana + 4 shots | 7 to 5 (40-60) | 12 (50-70) | 2 charges, 14-24 recharge (30) | 120/105/90 (100) | V26.16 | [Wiki](https://wiki.leagueoflegends.com/en-us/Jhin) |
| Aphelios | Mana + Moonlight | 5-12 by weapon (60 + 10 Moonlight) | Swap, 0.8 | None | 120/110/100 (100) | V26.19 | [Wiki](https://wiki.leagueoflegends.com/en-us/Aphelios) |
| Viego | None | 5 to 3 | 8 | 14 to 6 | 120/100/80 | V26.22 | [Wiki](https://wiki.leagueoflegends.com/en-us/Viego) |
| Orianna | Mana | 7 to 3 (35) | 7 (60-80) | 9 (60) | 110/95/80 (100) | V26.21 | [Wiki](https://wiki.leagueoflegends.com/en-us/Orianna) |

Camille's passive also runs on a timer, about 14/11/8 — [Wiki: Camille](https://wiki.leagueoflegends.com/en-us/Camille)

### Inferences
Counts from the table above (my own arithmetic):
- Q has the shortest max-rank cooldown in 8 of 12 kits (Fiora, Camille, Sett, Lee Sin, Thresh, Jhin, Viego, Orianna). The exceptions are Riven, Zed and Ahri, and Aphelios varies by weapon.
- Rank 1 ultimates sit at about 110 to 140 in all twelve, and rank 3 at about 60 to 100.
- The rank 1 ultimate is roughly 4.5 to 12 times the longest rank 1 basic (Fiora about 4.6, Orianna about 12; Aphelios excluded).

**Slot-to-job table** (my reading of the wiki pages above; Dmg = damage, Mob = mobility, Ctrl = control, Def = defence, Sus = sustain):

| Kit (class is my assignment) | Passive | Q | W | E | R |
|---|---|---|---|---|---|
| Fiora (skirmisher) | Dmg, Sus, speed | Mob, Dmg | Def, Ctrl | Dmg, slow | Dmg, Sus |
| Camille (diver) | Def | Dmg, speed | Slow, Sus | Mob, Ctrl | Ctrl, Dmg |
| Riven (skirmisher or diver) | Dmg | Mob, Dmg, Ctrl | Ctrl, Dmg | Mob, Def | Dmg, range |
| Sett (juggernaut) | Dmg, Sus, resource | Dmg, speed | Def, Dmg | Ctrl | Ctrl, Dmg |
| Lee Sin (diver) | Resource, attack speed | Dmg, Mob | Mob, Def, Sus | Dmg, slow | Ctrl, Dmg |
| Zed (assassin) | Dmg | Dmg | Mob, resource | Dmg, slow | Mob, Dmg |
| Viego (skirmisher) | Sus, transform | Dmg, Sus | Ctrl, Mob | Stealth, speed | Mob, Dmg |
| Ahri (burst mage) | Sus | Dmg | Dmg, speed | Ctrl, Dmg | Mob, Dmg |
| Orianna (mage) | Dmg | Dmg | Dmg, slow, speed | Def | Ctrl, Dmg |
| Thresh (catcher) | Scaling | Ctrl, Mob | Def, ally Mob | Ctrl, Dmg | Ctrl, Dmg |
| Jhin (marksman) | Rule of attack | Dmg | Dmg, Ctrl | Zone, slow | Dmg, range |
| Aphelios (marksman) | Weapon rule | By weapon | Swap | None | Dmg, by weapon |

Principles:
- Build kits as a ladder of time, not as a fixed letter-to-job list: a rhythm tool, commit tools, and one turning point. `[transfers to 1v1: the ladder describes timing, and a duel is decided by timing and position, though the values must be rescaled to round length.]`
- Give a duelist one clear personal defence on its own timer: Fiora W, Camille passive, Riven E, Sett W. The downtime of that timer is the opponent's main opening. `[transfers to 1v1: with no teammate to cover the gap, tracking one defensive timer becomes the central read.]`
- Keep hard locks on basics short. Riven W and Camille's Wall Dive are about 0.75 seconds and Sett E about 1 second. Fiora W stuns only when it catches a disable, and I did not check that duration. `[transfers to 1v1: one lock removes all of the only opponent's agency, so length matters more than in a team fight.]`
- Prefer breadth inside each kit. `[transfers to 1v1: Jag's argument that a narrow kit is binary gets stronger with no team to fill the holes, though kits still need a clear strength so that heroes stay distinct.]`
- Do not copy utility-class shapes such as enchanter, catcher, vanguard or warden. `[depends on 5v5: the wiki defines these by what allies do after them, and no ally exists here.]`
- Marksman and late-scaling shapes do not port as they stand. `[depends on 5v5: they rely on item spikes and a front line, and neither exists here.]`
- Effects aimed at monsters, structures or minions have no job here, for example Sett's monster damage cap and Riven's structure modifier. `[depends on 5v5: they exist to serve wave clear and objectives.]`

### Gaps
- I found no Riot-authored statement on how much power goes into each slot. The tables are reconstruction, not intent.
- The Yetter complexity ratings for individual 2020 champions could not be retrieved, because both reporting pages failed to open.
- Class assignments per champion are my own. The wiki fetch gave the taxonomy, not the membership list.

## How do abilities interact: combos, ordering, setups and payoffs, conditional bonuses, resets, recasts, stances, and shared stacks or marks?

### Takeaway
A kit becomes more than its parts when one ability changes the value of the next. The most useful patterns for a duel are the ones that demand a change of position between beats, as Camille's do, rather than a fixed button order.

### Cited Findings
**Setup and payoff**
- Sett's damage taken fills a Grit bar, and his W spends all of it as a shield and a blast scaled by the amount spent — [Wiki: Sett, V25.17](https://wiki.leagueoflegends.com/en-us/Sett)
- Jhin's W roots only champions already marked by a trap or by recent damage from him or his allies — [Wiki: Jhin, V26.16](https://wiki.leagueoflegends.com/en-us/Jhin)
- Ahri's flames prioritise a target hit by Charm. This is targeting help, not a damage amplifier in the current kit — [Wiki: Ahri, V26.06](https://wiki.leagueoflegends.com/en-us/Ahri)
- Zed's Shadows copy his Q and E wherever they stand, and his R detonates for a share of the damage dealt during the mark — [Wiki: Zed, V26.10](https://wiki.leagueoflegends.com/en-us/Zed)

**Sequencing and ordering**
- Jag describes a Camille sequence of Q, back away, W sweep, then lunge in for a second Q, meant to read like a dance. W can also be primed during the hookshot so that it lands as she dives. Her key cooldowns are grouped around specific windows — [Riot: Champ Insights Camille, Dec 2016, mirror](https://archive.runeterra.net/na/riot-official/FF05yzBv)
- Her Q needs melee contact twice, about 1.5 to 3 seconds apart, without sticking in between, so both sides can reposition. W's strongest outer cone sometimes needs her to leave melee range. Hookshot is easier to land on a target near a wall — [Riot: Jag 2016, S@20 mirror](https://www.surrenderat20.net/2016/12/red-post-collection-dev-blog-on.html)
- A Riven guide orders her early trade as dash, attack, dash, attack, stun, attack, dash, attack. It adds Valor first at level 3 to absorb return damage, and for the all-in it activates R first and uses Wind Slash last as the execute — [Community: Dodge, Mar 2026](https://www.dodge.gg/lol/news/riven-build-2026)
- The community Lee Sin sequence is Q, Q, ward, W, R. It can be delayed by keeping an earlier Q mark on another target — [Community: LeeSinMains wiki mirror](https://pol1.lr.ggtyler.dev/r/LeeSinMains/wiki/combo_guide)

**Recasts**
- Lee Sin's Q, W and E each have a second cast at half the energy (50 then 25), available within about 3 seconds — [Wiki: Lee Sin, V26.21](https://wiki.leagueoflegends.com/en-us/Lee_Sin)
- Riven's Q has three casts with up to about 4 seconds between each and a minimum gap of about 0.31 seconds. Its cooldown starts only after the third cast or a lapse — [Wiki: Riven, V26.15](https://wiki.leagueoflegends.com/en-us/Riven)
- Ahri's R has up to three dashes within about 15 seconds, about 1 second apart — [Wiki: Ahri, V26.06](https://wiki.leagueoflegends.com/en-us/Ahri)
- Thresh's Q has an optional dash to the hooked target, which makes closing the distance a choice — [Wiki: Thresh, V26.22](https://wiki.leagueoflegends.com/en-us/Thresh)
- Viego's W charges while held and is released on recast, with a longer stun for a longer charge — [Wiki: Viego, V26.22](https://wiki.leagueoflegends.com/en-us/Viego)

**Conditional bonuses**
- Fiora's W shock becomes a stun only if it negated an immobilising effect — [Wiki: Fiora, V26.19](https://wiki.leagueoflegends.com/en-us/Fiora)
- Camille's outer W slows, deals extra damage and heals her from that extra damage — [Wiki: Camille, V26.19](https://wiki.leagueoflegends.com/en-us/Camille)
- Sett's W deals true damage only in its central line, and physical damage in the outer area — [Wiki: Sett, V25.17](https://wiki.leagueoflegends.com/en-us/Sett)
- Sett's E stuns only if enemies are caught on both sides of him — [Wiki: Sett, V25.17](https://wiki.leagueoflegends.com/en-us/Sett)
- Execute-style scaling on missing health appears on Lee Sin's second Q, Riven's wave and Jhin's R and fourth shot. Zed's passive instead requires the target to be under 50% health — [Wiki: Lee Sin](https://wiki.leagueoflegends.com/en-us/Lee_Sin); [Wiki: Riven](https://wiki.leagueoflegends.com/en-us/Riven); [Wiki: Jhin](https://wiki.leagueoflegends.com/en-us/Jhin); [Wiki: Zed](https://wiki.leagueoflegends.com/en-us/Zed)

**Resets and refunds**
- Attack resets skip the remainder of the attack timer so a new windup can start sooner — [Wiki: Attack speed](https://wiki.leagueoflegends.com/en-us/Attack_Speed)
- Camille's two Q casts, Sett's Q and each Riven Q are resets — [Wiki: Camille](https://wiki.leagueoflegends.com/en-us/Camille); [Wiki: Sett](https://wiki.leagueoflegends.com/en-us/Sett); [Wiki: Riven](https://wiki.leagueoflegends.com/en-us/Riven)
- Cooldown refunds: Fiora's Q halves when it connects, and each champion hit by Zed's E takes about 3 seconds off his W — [Wiki: Fiora](https://wiki.leagueoflegends.com/en-us/Fiora); [Wiki: Zed](https://wiki.leagueoflegends.com/en-us/Zed)
- Resource refunds: Lee Sin's next two attacks after a spell restore energy (20/30/40, then half that). Zed regains 30 to 50 energy when one cast hits the same target from more than one body — [Wiki: Lee Sin](https://wiki.leagueoflegends.com/en-us/Lee_Sin); [Wiki: Zed](https://wiki.leagueoflegends.com/en-us/Zed)
- Ahri's takedown does not reset R. It extends the recast window and adds a recast — [Wiki: Ahri, V26.06](https://wiki.leagueoflegends.com/en-us/Ahri)
- Riot's Xypherous rejected a Riven ultimate idea in which abilities and attacks reset each other, calling it poorly designed — [Riot: quoted on Wiki: Riven/Development](https://wiki.leagueoflegends.com/en-us/Riven/Development)
- Riot's retrospective wished Kled's Q into E combo did not undermine counterplay — [Riot: Scruffy, On the Champions of 2016, Feb 2017, S@20 mirror](https://www.surrenderat20.net/2017/02/dev-on-champions-of-2016.html)
- Riot removed an unintended Caitlyn animation reset and said it would not return, according to press coverage seen in a search summary — [Press: AltChar](https://www.altchar.com/game-news/lol-caitlyns-auto-attack-resets-accidentally-removed-wont-be-back-aap6x1c1BiWb)

**Stances and shared state**
- Aphelios carries five weapons, two at a time. Each weapon has its own attack and Q, and swaps cost about 0.8 seconds — [Wiki: Aphelios, V26.19](https://wiki.leagueoflegends.com/en-us/Aphelios)
- Riven's R is a 15-second mode that raises her attack range and the reach of Q and W — [Wiki: Riven, V26.15](https://wiki.leagueoflegends.com/en-us/Riven)
- Shared counters that tie the buttons together include Riven's three charges, spent by attacks; Lee Sin's marks on Q and E; Fiora's Vitals; and Aphelios's 50 Moonlight per weapon — [Wiki: Riven](https://wiki.leagueoflegends.com/en-us/Riven); [Wiki: Lee Sin](https://wiki.leagueoflegends.com/en-us/Lee_Sin); [Wiki: Fiora](https://wiki.leagueoflegends.com/en-us/Fiora); [Wiki: Aphelios](https://wiki.leagueoflegends.com/en-us/Aphelios)

### Inferences
- Combos that require stepping out and back in beat combos that are pure button order, because the opponent gets a turn inside them. `[transfers to 1v1: the dance is entirely between two players, and cover adds more ways to step out.]`
- A cheap second press with a time limit turns one spell into a commit decision. Lee Sin's half-cost recast asks whether this is worth following up. `[transfers to 1v1: the decision depends only on the opponent's state, not on team positions.]`
- Reward the read rather than the press: Fiora's stun exists only if she caught a disable, and Sett's true damage only on the centre line. `[transfers to 1v1: each outcome is a direct result of the two players' choices.]`
- Attack between spells should matter. Riven's charges, Lee Sin's refunds and Sett's second punch all stop the kit becoming spell rotation alone. `[transfers to 1v1: the hero has a basic attack, and this is what gives it a job.]`
- Link cooldowns through hits. Fiora's Q and Zed's E shorten a timer when they land, so accuracy buys tempo. `[transfers to 1v1: faster rhythm after a good hit creates visible momentum within a short round.]`
- A shared counter is the cheapest way to make four buttons feel like one system. `[transfers to 1v1: it needs no other players, only a clear on-screen readout.]`
- Takedown rewards such as Ahri's extended R and Viego's possession lose their job. `[depends on 5v5: a kill ends the round, so no next target exists to carry the reward to.]`
- Sett's two-sided E stun does not work as written. `[depends on 5v5: it needs a second enemy, so a duel version would need terrain or a shadow object to serve as the far side.]`
- Lee Sin's W to an ally, Thresh's lantern and Orianna's shield on an ally lose their partner, and Lee Sin's ward route relies on an item-like placement. `[depends on 5v5: they need an ally or a placed friendly object.]`
- Be careful with free reset chains. `[transfers to 1v1: the Xypherous and Kled comments suggest that combos with no opening for the opponent read as unfair, and in a duel nobody else can interrupt them.]`

### Gaps
- I did not retrieve exact frame data for recast lockouts beyond the Riven values above.
- No Riot source compares setup-and-payoff patterns across kits. The taxonomy here is mine.
- Rank order (which spell gets skill points first) was not researched. The ordering above is about cast sequence only. `[depends on 5v5: rank order is a levelling construct, and it returns only if the target game adopts per-round level gain like Arena's.]`

## What do the passive and the ultimate each do for a kit?

### Takeaway
The best passives are rules that change how you move or attack, not passive stats. The best duel ultimates take a verb the kit has already taught and raise it for a few seconds, rather than adding an unrelated effect.

### Cited Findings
**Passive as rule of play**
- Fiora's passive marks one side of an enemy to strike for true damage, a heal and a speed burst. Vitals are identified only while the enemy can see her — [Wiki: Fiora, V26.19](https://wiki.leagueoflegends.com/en-us/Fiora)
- The update notes for her rework frame this as a positioning and execution test for her and something the opponent must protect — [S@20 write-up of Riot's update, Jul 2015, not clearly Riot-authored](https://www.surrenderat20.net/2015/07/champion-update-fiora.html)
- Jhin's gun holds four rounds, the fourth always crits, and reloading takes about 2.5 seconds — [Wiki: Jhin, V26.16](https://wiki.leagueoflegends.com/en-us/Jhin)
- Riot's goal there was that each marksman's attack pattern should feel unique. Target-dummy damage was lower, but real game damage was similar because marksmen reposition between shots anyway — [Riot: Scruffy, Feb 2017, S@20 mirror](https://www.surrenderat20.net/2017/02/dev-on-champions-of-2016.html)
- Sett's alternating punches are a designed attack cadence, and Riot says it changes how players think about standard positioning, since he wants to take damage up front — [Riot: Twin Enso, Champion Insights Sett, Jan 2020](https://www.leagueoflegends.com/en-us/news/dev/champion-insights-sett/)
- Riot's mastery post uses Yasuo's passive as its kit example: maximise a bar through movement and ability use, and avoid wasting gains when it is full — [Riot: Zileas, Design Values Mastery, Jul 2014, mirror](https://archive.runeterra.net/na/riot-official/Ex5oYQW6)

**Passive as engine or timer**
- Lee Sin's refund passive makes attacks the source of his next spell — [Wiki: Lee Sin, V26.21](https://wiki.leagueoflegends.com/en-us/Lee_Sin)
- Camille's shield passive is on a long cooldown, so some of her trades are strong and others need more risk — [Riot: Jag 2016, S@20 mirror](https://www.surrenderat20.net/2016/12/red-post-collection-dev-blog-on.html)

**Passive failure modes**
- A Blitzcrank passive rework was explained by a Riot designer as making it more consistent and not discouraging spell use. This is from a search summary of press coverage — [Press: GosuGamers](https://www.gosugamers.net/lol/news/48939-big-blitzcrank-changes-are-headed-to-league-of-legends-pbe)
- Riot judged Aurelion Sol's star passive too far outside the norm, so it appealed to a small audience, and concluded that large themes should pair with more accessible play — [Riot: Scruffy, Feb 2017, S@20 mirror](https://www.surrenderat20.net/2017/02/dev-on-champions-of-2016.html)

**Ultimate as raised verb**
- Fiora's R reveals all four Vitals on one champion for about 8 seconds, and the update write-up calls it a real-time duel of attacking and defending those spots — [Wiki: Fiora, V26.19](https://wiki.leagueoflegends.com/en-us/Fiora); [S@20, Jul 2015](https://www.surrenderat20.net/2015/07/champion-update-fiora.html)
- Riven's R raises the reach of Q and W for 15 seconds and adds one wave that hits harder on wounded targets — [Wiki: Riven, V26.15](https://wiki.leagueoflegends.com/en-us/Riven)
- Jhin's R repeats the four-shot rule, with a guaranteed crit on the fourth — [Wiki: Jhin, V26.16](https://wiki.leagueoflegends.com/en-us/Jhin)
- Zed's R adds Shadow play and banks damage dealt during the mark — [Wiki: Zed, V26.10](https://wiki.leagueoflegends.com/en-us/Zed)

**Ultimate as state change**
- Camille's R locks one target in a zone for about 2.5 to 4 seconds, with her attacks dealing bonus damage based on current health. Riot describes it as a counter to dashing champions — [Wiki: Camille, V26.19](https://wiki.leagueoflegends.com/en-us/Camille); [Riot: Scruffy, Feb 2017, S@20 mirror](https://www.surrenderat20.net/2017/02/dev-on-champions-of-2016.html)
- Sett's R suppresses, carries and slams one target, damaging others at the impact by the target's bonus health. Lee Sin's R kicks a champion into others — [Wiki: Sett, V25.17](https://wiki.leagueoflegends.com/en-us/Sett); [Wiki: Lee Sin, V26.21](https://wiki.leagueoflegends.com/en-us/Lee_Sin)
- Riot's Xypherous cut Riven ultimate ideas including a rage meter, which he thought excessive on an already aggressive champion, and beams on every ability, which were condensed into one move — [Riot: quoted on Wiki: Riven/Development](https://wiki.leagueoflegends.com/en-us/Riven/Development)
- August Browning said Viego needed a stronger ultimate while possessing because the kit relies on his own powers. This is from a search summary of a dev reply — [Riot: August, devtrackers mirror](https://devtrackers.gg/leagueoflegends/p/0d4fa3fb-i-feel-like-viego-s-possession-mechanic-is-barely-relevant-his-strength-comes-more-from-invulnerability-during-team-fights-and-ultimate-cooldown-resets-than-from-using-possessed-kits)

**Short-round evidence from Arena**
- Arena fully refreshes cooldowns, health and resources at each phase. Champions start at level 3, gain 1 or 2 levels per round and reach 18 by round 12 — [Wiki: Arena](https://wiki.leagueoflegends.com/en-us/Arena)

### Inferences
- Make the passive a rule that shapes where you stand or how you attack. `[transfers to 1v1: Fiora's angle and Jhin's fourth shot are both readable by the one opponent, who can play against them directly.]`
- Check that a passive never argues with the buttons, as Riot's Blitzcrank rework aimed to avoid. `[transfers to 1v1: a passive that discourages casting makes a four-button kit feel smaller.]`
- Keep the rule close to familiar play unless the theme can carry it, given Riot's Aurelion Sol conclusion. `[transfers to 1v1: new players meet each passive under direct duel pressure, with no team to hide behind.]`
- Design R as a louder version of the kit's existing verb. About half of the twelve fit this (Fiora, Riven, Jhin, Zed, Ahri's repeat dash, Camille's attack zone). `[transfers to 1v1: it deepens one known pattern, which is easier to read and more satisfying than a separate effect.]`
- Treat R as a once-per-round moment rather than a timer. At 110 to 140 seconds at rank 1, a League ultimate outlasts any short round, and Arena's reset means it comes back each round. `[transfers to 1v1: the real decision becomes when in the round to spend it, though this rests on the unknown round length.]`
- Level gating at 6, 11 and 16 has no direct place here. `[depends on 5v5: it is tied to long-game levelling, and Arena's per-round levels are the nearest short-format equivalent if a progression across rounds is wanted.]`
- Isolating or pick ultimates change meaning. Camille's knock-out of others and Lee Sin's kick into allies lose their team half. `[depends on 5v5: only the lock and the damage remain.]` The lock itself is still strong: `[transfers to 1v1: an arena inside the arena removes cover for its duration, which is a clear change of state.]`
- Death-triggered payoffs do not work here: Fiora's zone in its on-kill form and Viego's possession. `[depends on 5v5: the round ends at the kill.]` Fiora's four-Vitals trigger still works mid-fight. `[transfers to 1v1: it pays off during the duel, before anyone dies.]`
- Bonus-health scaling such as Sett's R has nothing to scale from. `[depends on 5v5: bonus health comes mainly from items and growth.]`
- Scaling passives such as Thresh's souls and Ahri's fragments have no input. `[depends on 5v5: they feed on kills, minions and long games.]`

### Gaps
- I found no Riot post stating a general theory of ultimates or passives. The categories are mine, supported by individual comments.
- Yasuo, Tryndamere and Rumble came up as Riot examples, but I did not fetch their current kits.

## What are the resource and cooldown shapes, and what decisions do they create?

### Takeaway
Riot treats a resource as a way to set attrition, pacing and the cost of missing. If the target game resets between short rounds, as Arena does, most of mana's job disappears, and pacing inside a round has to come from cooldowns, refunds and secondary bars such as Grit or ammo.

### Cited Findings
- Riot Axes says mana provides three things: a rhythm of action and breaks, especially in lane; a limit on champions who could otherwise stay safe indefinitely; and a cost for a missed high-impact spell. Riot defaults to mana and removes it only for good reason — [Riot: Ask Riot, Manaless Champions, Jul 2021](https://www.leagueoflegends.com/en-gb/news/dev/ask-riot-manaless-champions/)
- The same post says very safe or healing-heavy kits usually keep mana, since it is often their only limit. Energy, Grit and Heat are named as secondary bars that often cover the same values, Rumble's Heat paces his lane, and continuous-pattern champions like Yasuo may go manaless, which puts more pressure on the rest of the kit. Cooldowns can raise spell stakes only so far — [Riot: Ask Riot, Jul 2021](https://www.leagueoflegends.com/en-gb/news/dev/ask-riot-manaless-champions/)
- Viego is manaless because mana confused the transformation design — [Riot: Ask Riot, Jul 2021](https://www.leagueoflegends.com/en-gb/news/dev/ask-riot-manaless-champions/)
- RiotJag frames the resource choice as how a champion should be subject to attrition. Easily poked melee champions can be gated by health instead of mana, being resourceless is a major advantage that must be paid for elsewhere, and Katarina gets low Q poke in exchange — [Riot: RiotJag, 2021, devtrackers mirror](https://devtrackers.gg/leagueoflegends/p/6a7db181-how-does-riot-decide-if-a-champion-has-mana-or-manaless)
- Energy champions are not at long-term risk of running out, but the small capacity limits rapid spell use. Health-cost spells can leave the caster at 1 health. A search summary attributed this to the League wiki, and I did not identify the exact page, so verify it before relying on it.
- Jag contrasts stick-on-target melee, such as Xin Zhao, which either snowballs or fails, with windowed melee: short bursts of power with downtime between them, so winning needs repeated outplays. Yasuo is his example. He notes the cost is mental load, with a player traded on every 5 to 10 seconds feeling taxed, and that tracking many separate Camille cooldowns tires opponents — [Riot: Jag 2016, S@20 mirror](https://www.surrenderat20.net/2016/12/red-post-collection-dev-blog-on.html)
- Community critic Celia Wagar argues that cooldown abilities carry only opportunity cost, skip the startup, recovery and travel that physical moves have, and encourage efficiency-race rotations with little counterplay — [Community: The Cooldown Effect, Aug 2016](https://critpoints.net/2016/08/18/the-cooldown-effect/)
- Arena tunes some cooldowns separately from the main game: Fiora's W rises to about 28 to 20, Orianna's R falls to about 90/80/70, and Zed's W falls to about 18 to 15. No reason is given in the sources I read — [Wiki: Fiora](https://wiki.leagueoflegends.com/en-us/Fiora); [Wiki: Orianna](https://wiki.leagueoflegends.com/en-us/Orianna); [Wiki: Zed](https://wiki.leagueoflegends.com/en-us/Zed)

**Shapes and the decisions they create** (mechanics from the wiki pages linked; decisions are my reading):

| Shape | Example | Decision for the player | Decision for the opponent |
|---|---|---|---|
| Mana pool | [Fiora](https://wiki.leagueoflegends.com/en-us/Fiora) spells 20 to 100, [Thresh](https://wiki.leagueoflegends.com/en-us/Thresh) Q 70 | How many spells this trade is worth | Bait spells until the pool runs dry |
| Energy with refunds | [Lee Sin](https://wiki.leagueoflegends.com/en-us/Lee_Sin) 50 + 25, [Zed](https://wiki.leagueoflegends.com/en-us/Zed) refund 30 to 50 | Spend now or keep enough for the exit | Punish the few seconds after a dump |
| Damage-taken bar | [Sett](https://wiki.leagueoflegends.com/en-us/Sett) Grit up to about 50% max health, decaying about 30% per second after about 4 seconds | Fire now or take one more hit while it decays | Stop feeding the bar, wait out the decay |
| Ammo and reload | [Jhin](https://wiki.leagueoflegends.com/en-us/Jhin) 4 shots, about 2.5 second reload; [Aphelios](https://wiki.leagueoflegends.com/en-us/Aphelios) 50 per weapon, 10 per Q | Where to place the big shot, when to dump a weapon | Attack during the reload, dodge the fourth shot |
| Stock charges | [Jhin](https://wiki.leagueoflegends.com/en-us/Jhin) E, 2 charges | Place now or keep a charge for later | Scout routes, avoid chokes |
| Attack-spent stacks | [Riven](https://wiki.leagueoflegends.com/en-us/Riven) 3 charges for 6 seconds | Attack before the next spell or waste a stack | Move out so stacks expire |
| Cooldown only | [Riven](https://wiki.leagueoflegends.com/en-us/Riven), [Viego](https://wiki.leagueoflegends.com/en-us/Viego), [Sett](https://wiki.leagueoflegends.com/en-us/Sett) | Timing alone | Count cooldowns and re-engage when they lapse ([Community: Dodge](https://www.dodge.gg/lol/news/riven-build-2026)) |

### Inferences
- Mana's attrition job mostly disappears if resources reset each round, as they do in Arena. `[depends on 5v5: mana pacing is built for long lanes, and only the cost of a miss survives into a short round.]`
- Use cooldowns as the primary gate, then add one secondary constraint per kit where it creates a decision. `[transfers to 1v1: Riot's point that cooldowns can only go so far, and Wagar's critique, both argue for a second lever.]`
- Make defensive and bar-type resources respond to the opponent's actions. `[transfers to 1v1: Sett's Grit turns the opponent's choice to attack into something he must weigh, and only one attacker exists to read.]`
- Attach physical costs (startup, recovery, travel) to abilities, not only timers. `[transfers to 1v1: this is Wagar's fix for opportunity-cost play, and a duel makes commitments easy to see and punish.]`
- Use refund loops to reward landing rather than pressing. `[transfers to 1v1: Lee Sin's and Zed's refunds make accuracy visible in the next few seconds.]`
- Reload and ammo give the opponent a known opening. `[transfers to 1v1: Jhin's reload is a shared clock both players can see, and Riot found the damage loss smaller than expected in live play.]`
- Short trade versus all-in is a product of the ladder: rhythm tools alone are a trade, and rhythm plus commit plus R is an all-in. `[transfers to 1v1: the 3-to-9-second tier sets the exchange rate, and the 10-to-24-second tier decides how often someone can really commit.]`
- Watch mental load. `[transfers to 1v1: Jag's warning is about being traded on every 5 to 10 seconds, and short rounds with a reset offer a natural breather that lanes lack.]`
- Parries may need longer timers in short rounds. Arena's longer Fiora W is consistent with this, though Riot gives no reason in what I read. `[transfers to 1v1: a parry available several times per round could dominate exchanges, so long as disables are a large share of a kit's power.]`
- Multi-minute resource starvation and return-to-base rhythm do not port. `[depends on 5v5: they rely on lanes and a shop, both absent here.]`

### Gaps
- None of the twelve kits uses Fury or Rage, and I did not fetch a Fury champion. The only related item is the cut Riven rage meter. A follow-up on Tryndamere, Renekton or Shyvana would fill this.
- Heat is cited only through Riot's remark on Rumble, and I did not fetch his mechanics or a kit that pays in health.
- Round length of the target game is unknown, and every window conclusion scales with it.
- Arena-specific cooldown changes were seen only where they surfaced on the pages I read. I did not read Riot's reasoning or a full list.

## What is the targeting mix, and how does it set a spell's risk, reliability and power?

### Takeaway
Targeting decides where the skill test sits. Skillshots test the cast, unit-targeted spells move the test to timing and follow-through, and self-cast spells make the player's position into the aim. Terrain and cover change all three.

### Cited Findings
- The wiki's targeting types are Auto (including Self), Direction, Location, Unit, Proximity and Vector — [Wiki: Ability](https://wiki.leagueoflegends.com/en-us/Ability)
- **Direction with first-hit collision:** Lee Sin Q, Ahri E, Thresh Q and Jhin's long W — [Wiki: Lee Sin](https://wiki.leagueoflegends.com/en-us/Lee_Sin); [Wiki: Ahri](https://wiki.leagueoflegends.com/en-us/Ahri); [Wiki: Thresh](https://wiki.leagueoflegends.com/en-us/Thresh); [Wiki: Jhin](https://wiki.leagueoflegends.com/en-us/Jhin)
- A community Thresh guide says accuracy mainly comes from throwing many hooks and allowing for the windup — [Community: Mobafire blog](https://www.mobafire.com/profile/scorchone23-528527/blog/tips-for-thresh-hooks-ive-recently-learned)
- **Unit-targeted ultimates:** Fiora, Camille, Sett, Zed and Lee Sin all target one champion. Sett walks into range if needed — [Wiki: Fiora](https://wiki.leagueoflegends.com/en-us/Fiora); [Wiki: Camille](https://wiki.leagueoflegends.com/en-us/Camille); [Wiki: Sett](https://wiki.leagueoflegends.com/en-us/Sett); [Wiki: Zed](https://wiki.leagueoflegends.com/en-us/Zed); [Wiki: Lee Sin](https://wiki.leagueoflegends.com/en-us/Lee_Sin)
- **Self-cast with position as aim:** Riven W (about 300 to 360 radius), Fiora E, Camille Q, Sett Q and Orianna's R, which fires around the ball rather than the caster — [Wiki: Riven](https://wiki.leagueoflegends.com/en-us/Riven); [Wiki: Fiora](https://wiki.leagueoflegends.com/en-us/Fiora); [Wiki: Camille](https://wiki.leagueoflegends.com/en-us/Camille); [Wiki: Sett](https://wiki.leagueoflegends.com/en-us/Sett); [Wiki: Orianna](https://wiki.leagueoflegends.com/en-us/Orianna)
- **Location and delayed:** Jhin's traps stealth after arming and bloom later; Zed's W is placed and swapped within about 5 seconds; Camille's W fires after a delay; Sett's W has about a 0.75-second cast; Viego's W is charged — [Wiki: Jhin](https://wiki.leagueoflegends.com/en-us/Jhin); [Wiki: Zed](https://wiki.leagueoflegends.com/en-us/Zed); [Wiki: Camille](https://wiki.leagueoflegends.com/en-us/Camille); [Wiki: Sett](https://wiki.leagueoflegends.com/en-us/Sett); [Wiki: Viego](https://wiki.leagueoflegends.com/en-us/Viego)
- Riot Axes links missed spells with mana cost, saying a missed high-impact spell should cost something — [Riot: Ask Riot, Jul 2021](https://www.leagueoflegends.com/en-gb/news/dev/ask-riot-manaless-champions/)
- Old Fiora had no dodgeable spells and high damage, so a fed Fiora felt unfair and a behind Fiora had little way back. Riot then added non-damaging tools and reduced some of her undodgeable killing power. The last sentence comes from a search summary — [Riot: Champion Update and the Flawed Fencer, Dec 2015, mirror](https://archive.runeterra.net/na/riot-official/h5k9KJbo)
- Sett's early grappler plan was dropped partly because physically moving other champions caused clarity problems and frustration, and partly because the animations were expensive — [Riot: Axes, Champion Insights Sett, Jan 2020](https://www.leagueoflegends.com/en-us/news/dev/champion-insights-sett/)
- Morello's clarity pillar asks for transparent mechanics, so that players beat opponents rather than hidden information — [Riot: Morello, May 2014, mirror](https://archive.runeterra.net/na/riot-official/m1tKGoHQ)
- Jag's counterpoint: some hidden information, such as whether Lee Sin has Flash, makes high-risk plays possible — [Riot: Jag 2016, S@20 mirror](https://www.surrenderat20.net/2016/12/red-post-collection-dev-blog-on.html)
- Camille's hook is easier to land near walls because the target has less room to sidestep, and her Hookshot dash can be knocked down by immobilising effects — [Riot: Jag 2016, S@20 mirror](https://www.surrenderat20.net/2016/12/red-post-collection-dev-blog-on.html); [Wiki: Camille](https://wiki.leagueoflegends.com/en-us/Camille)
- In Arena, Riot's Deep Water is solid terrain that does not block vision, so it creates no hiding spots. Closed arenas heavily favoured melee, which led to the ranged-reachable Power Flower. Cameos were added because players moved the same way every round. Flash stayed, and other summoner spells were replaced by Flee — [Riot: Maxw3ll, /dev: Arena, Jun 2023](https://www.leagueoflegends.com/en-us/news/dev/dev-arena/)

### Inferences
- Pay for reliability in power or cooldown. Thresh's hook, with a very long early cooldown, and Ahri's Charm trade reliability for a game-changing lock. `[transfers to 1v1: one dodged skillshot or one guaranteed lock has outsized effect with one target.]`
- A unit-target ultimate moves the skill test, as with Fiora's R, which is certain at cast but must still be delivered around four spots. `[transfers to 1v1: the opponent still has a live defence after the cast, which keeps the duel two-sided.]`
- Keep some avoidable damage in every kit. `[transfers to 1v1: Riot's old-Fiora lesson is about exactly this feeling in a duel, with no teammate to absorb a fed opponent.]`
- Limit forced movement of the opponent. `[transfers to 1v1: Riot's Sett finding about clarity and frustration applies with full weight when the player is the only target.]`
- Decide early how each targeting type meets cover: whether skillshots stop at cover, whether unit spells need line of sight, and whether the cover hides or only blocks. Riot's Deep Water shows that blocking and hiding are separate levers. `[transfers to 1v1: cover is a defining feature here, and League's kits assume mostly open sightlines, so the answer changes every value above.]`
- Terrain can raise reliability in return for positional risk, as with Camille's hook and hugging walls. `[transfers to 1v1: cover becomes both safety and a liability.]`
- Check melee and ranged balance in enclosed spaces. `[transfers to 1v1: Riot found closed arenas favoured melee heavily, and an arena with cover is at similar risk.]`
- Vary spawn or arena content between rounds. `[transfers to 1v1: Riot saw players repeat routes, which a short-round format encourages.]`
- Vision-based mechanics such as Fiora's visible-only Vitals are a natural fit for cover. `[transfers to 1v1: hiding becomes a counter to her passive, and it is easy to read.]`
- Long-range pick spells and team-reveal effects lose much of their job. `[depends on 5v5: Jhin's long W and Lee Sin's E reveal gain most value from team follow-up and map-wide fog.]`
- Ward-based Lee Sin routes and other reach tools built for a large map do not port as they are. `[depends on 5v5: they serve a large map with wards, and an arena collapses that range.]`

### Gaps
- I found no Riot-authored general theory of targeting versus power. The inverse relation is my inference from examples.
- I did not read how League's specific spells interact with terrain in detail, and a duel with real cover needs its own rules regardless.

## Where do skill expression and mastery live in a kit?

### Takeaway
Riot asks for a low floor, a high ceiling and depth for both sides of the fight. Mastery lives in timing, spacing, resource sense and reads at least as much as in fast fingers, and the kits that age well reward thinking as well as execution.

### Cited Findings
- Zileas's mastery post names personal expertise (combos, skillshots, in-fight decisions), teamwork and adaptability as the areas of growth. It says champions should offer several levels of mastery, and that counterplay means being hard to master for the opponent as well, so that the better player wins — [Riot: Zileas, Jul 2014, mirror](https://archive.runeterra.net/na/riot-official/Ex5oYQW6)
- Morello's values include meaningful choices with real tradeoffs and counterplay as room to respond after the opening move — [Riot: Morello, May 2014, mirror](https://archive.runeterra.net/na/riot-official/m1tKGoHQ)
- Scruffy's retrospective aims for a low floor and high ceiling, and warns against complex kits that dominate pro play and then get nerfed for everyone. He says Camille rewards precision, timing and decisions at all skill levels, and that she released too strong — [Riot: Scruffy, Feb 2017, S@20 mirror](https://www.surrenderat20.net/2017/02/dev-on-champions-of-2016.html)
- Sett was planned as an easy-to-learn juggernaut — [Riot: Twin Enso, Jan 2020](https://www.leagueoflegends.com/en-us/news/dev/champion-insights-sett/)
- Aphelios aims to reward creative adaptation through ability combinations rather than twitch reflexes, and the player does not choose the weapon order. The kit needed a custom HUD — [Riot: Champion Insights Aphelios, Nov 2019](https://www.leagueoflegends.com/en-gb/news/dev/champion-insights-aphelios/)

**Animation cancels and attack rules**
- An attack's windup must finish before it launches, and interrupting it cancels the attack. After launch, commands can be entered without penalty, which is the basis of stutter-stepping. Windup shrinks as attack speed rises — [Wiki: Attack speed](https://wiki.leagueoflegends.com/en-us/Attack_Speed)
- Community writers separate windup cancels, which lose the hit but can dodge or retarget, from winddown cancels, which skip recovery with an attack, ability or move. They cite Riven as the main example of chained ability cancels, with gains in damage per second, mobility and rotation speed — [Community: Dignitas, Nov 2025](https://dignitas.gg/articles/how-animation-cancels-work-in-league-of-legends)

**Riven**
- The fast Q pattern alternates attack, Q and a move command. An old guide claims it amounts to about 25% more attack speed, but it dates from season 5, so treat this as historical — [Community: Mobafire, not current](https://www.mobafire.com/league-of-legends/build/riven-guide-5-24-429348)
- A 2020 thread says Riot tested making fast Q the default on PBE, then settled on some lockout plus less punishment at high latency, and that most players never reached the speed where it matters — [Community: Rivenmains mirror](https://lr.us.psf.lt/r/Rivenmains/comments/j19wmk/beginner_questions_megathread/gle4w0g/?context=3)
- Wiki timing notes: moving after a cast speeds her next action, the third Q locks her out longer, and some casts during her E dash are labelled bugs — [Wiki: Riven, V26.15](https://wiki.leagueoflegends.com/en-us/Riven)
- Buffering: an attack queued during her R starts about 0.33 seconds after the cast ends, and about 0.53 seconds after Wind Slash. Neither delay applies to commands entered after the cast time, so input timing changes the outcome — [Wiki: Riven, V26.15](https://wiki.leagueoflegends.com/en-us/Riven)
- A site headline reports an unintended Riven bug in 2016 was deemed safe to use. I saw only the title — [Community: NERFPLZ](https://www.nerfplz.com/2016/10/new-unintended-riven-bug-for-620-deemed.html)

**Timing, spacing and reads**
- For Fiora's W, one guide says to save it for the opponent's key disable, and to use it slightly late rather than early because the window is forgiving. Opponents try to bait it with a feint and then engage — [Community: Dodge, Mar 2026](https://www.dodge.gg/lol/news/fiora-build-2026)
- Camille's empowered Q needs a wait of about 1.5 seconds inside a recast window of about 3.5 seconds — [Wiki: Camille, V26.19](https://wiki.leagueoflegends.com/en-us/Camille)
- Jag says unknown Flash on Lee Sin creates the setup for Insec-type plays, which preserve a path to mastery — [Riot: Jag 2016, S@20 mirror](https://www.surrenderat20.net/2016/12/red-post-collection-dev-blog-on.html)
- A failed Lee Sin commit can mean instant death against a team that bursts him during the dash — [Community: Dodge, search summary](https://www.dodge.gg/lol/news/lee-sin-build-2026)
- A 2014 esports piece calls Riven's burst a product of weaving spells between attacks. This is from a search summary — [Community: GosuGamers](https://www.gosugamers.net/lol/features/37671-deep-in-the-rift-wings-of-the-exile-feat-kt-bullets-vs-cj-blaze-champions-winter-2013-2014-ro8)

### Inferences
- Separate mastery into layers and check that a new player can win something at each one: a button order, then attack timing, then cancels, then reads. `[transfers to 1v1: duels make losses personal, so the first layer must already feel good, in line with Riot's low-floor goal.]`
- Keep some depth in decisions rather than speed. `[transfers to 1v1: Aphelios and Fiora show non-twitch depth, and latency hurts frame-tight cancels in online duels, as the Riven thread shows.]`
- Decide on purpose whether cancels are features. `[transfers to 1v1: Riot's handling of Riven, Caitlyn and the Wiki's bug labels shows these techniques can become identity or a bug, and a duel will surface them quickly.]`
- Telegraph high-reward actions and let the threat itself be a tool. Riot's Camille hook is a visible threat, and Fiora's W is known to the opponent. `[transfers to 1v1: a threat changes the only opponent's movement even before it is used.]`
- Hide a small amount of information, like Lee Sin's Flash. `[transfers to 1v1: mind games need a little uncertainty, though Morello's clarity pillar argues for keeping it small and readable.]`
- Make mastery legible to the opponent too. `[transfers to 1v1: Zileas's counterplay test applies directly, and Jag's fatigue warning sets a limit on how many timers to ask someone to track.]`
- Team-based mastery such as lantern coordination has no equivalent. `[depends on 5v5: Riot's own example of lantern mastery is about coordinating with teammates.]`

### Gaps
- I could not confirm current Riven frame data. Riot has altered these windows, and the community figures are old.
- My searches found no long-form video essays on these kits or on MOBA kit design. Community input here is guides and short posts, not the essay-level analysis the brief suggested.

## Case studies: 12 kits, core loop, repeated decision, counterplay, what makes each memorable

### Takeaway
The four dueling kits are each built on a single unusual question: where do I hit you (Fiora), when do I come back (Camille), what do I do between swings (Riven), and how much do I let you hit me (Sett). They transfer best. Team-reliant kits offer useful parts rather than whole templates.

### Cited Findings
Loop, decision and memorable lines are my reading of the mechanics cited in each entry, unless a source is named next to them. Numbers are in the cooldown table above.

#### Fiora (priority)
- **Parts.** The passive gives a place to hit. Q reaches it and refunds half its cooldown on a hit. W is a parry that releases a slow, or a stun if it caught a disable. E gives two better attacks, with a guaranteed crit on the second. R marks all four sides for about 8 seconds, with a heal zone as payoff — [Wiki: Fiora, V26.19](https://wiki.leagueoflegends.com/en-us/Fiora)
- **Core loop.** Approach from the side her Vital is on, hit it with Q or an attack, take the speed and heal, step back out, and wait for the next one, holding W for the opponent's key spell.
- **Repeated decision.** Do I take this Vital from this angle now, and do I keep W or spend it?
- **Opponent.** Poke and kite so she cannot reach Vitals, and feint to draw W, then engage while it is down — [Community: Dodge, Mar 2026](https://www.dodge.gg/lol/news/fiora-build-2026). Protect the marked spots and withhold damage and disables during the parry — [S@20 write-up, Jul 2015](https://www.surrenderat20.net/2015/07/champion-update-fiora.html)
- **Memorable.** A visible target on the enemy's body, plus a parry. It reads as fencing with no explanation.
- **Riot.** Stash Chelluck found the two-player fencing idea after judging that her old pattern asked for little thinking or reacting. Seb Rhee, who led the rework, later said the first version lost sight of what she meant to players, and the backlash was mainly about her art — [Riot: Flawed Fencer, Dec 2015, mirror](https://archive.runeterra.net/na/riot-official/h5k9KJbo)

#### Camille (priority)
- **Parts.** The passive is a shield keyed to the target's damage type, on a long timer. Q is a two-stage attack with a stronger, partly true-damage second stage after a wait of about 1.5 seconds. W is a delayed cone that rewards the outer half with a slow, extra damage and a heal. E hooks to terrain, perches for about 1 second, then dives, stunning for about 0.75 seconds on a champion. R is a single-target lock zone for about 2.5 to 4 seconds — [Wiki: Camille, V26.19](https://wiki.leagueoflegends.com/en-us/Camille)
- **Core loop.** Attack with Q, back off to the outer range of W, sweep, and step back in for the timed second Q, entering or escaping off a wall when E is up.
- **Repeated decision.** Do I wait out the delay while staying at the right range, or take the early hit? Which wall gives a good line?
- **Opponent.** Outrange the cone or punish her when she leaves melee, and track her passive and separate timers. Stay away from walls, which makes the hook harder — [Riot: Jag 2016, S@20 mirror](https://www.surrenderat20.net/2016/12/red-post-collection-dev-blog-on.html). A disable can knock her out of the hook — [Wiki: Camille](https://wiki.leagueoflegends.com/en-us/Camille)
- **Memorable.** Hook movement off terrain and a footwork pattern that Riot wanted to look like a dance — [Riot: Champ Insights, Dec 2016, mirror](https://archive.runeterra.net/na/riot-official/FF05yzBv)
- **Riot.** The goal was to make top lane dynamic and skill-based, and the retrospective says she was too strong at release and was low on a strategic uniqueness scale, with R a niche counter to dashers — [Riot: Jag 2016](https://www.surrenderat20.net/2016/12/red-post-collection-dev-blog-on.html); [Riot: Scruffy 2017](https://www.surrenderat20.net/2017/02/dev-on-champions-of-2016.html)

#### Riven (priority)
- **Parts.** The passive stores up to 3 charges from casts, each spent by an attack for bonus damage. Q is three dashes, each a reset, with the third larger and knocking back. W is a short-range stun of about 0.75 seconds. E is a short dash with a shield of about 1.5 seconds. R gives 15 seconds of range and damage, with one execute wave. No resource — [Wiki: Riven, V26.15](https://wiki.leagueoflegends.com/en-us/Riven)
- **Core loop.** Spell, attack, spell, attack. Every cast is a promise to swing next, and the player stitches dashes, stun and shield into one movement.
- **Repeated decision.** Attack now or move, and is the next Q a gap closer, a damage beat or the way out?
- **Opponent.** Disengage during her cooldown gap and re-engage when abilities are back; poke from range; interrupt with disables — [Community: Dodge, Mar 2026](https://www.dodge.gg/lol/news/riven-build-2026)
- **Memorable.** Flow. Her buttons chain, and skilled hands look different from new ones right away.
- **Riot.** Morello called her a flow-based, momentum fighter whose combos can be mixed to change timing and effect, appealing to players who choose between damage and utility. Xypherous designed the three-part Q and thinned out several ultimate ideas — [Riot: on Wiki: Riven/Development](https://wiki.leagueoflegends.com/en-us/Riven/Development). A news report says Riot has flagged her balance as a problem, seen in a search summary — [Press: GameRiv](https://gameriv.com/rivens-future-league-of-legends/)

#### Sett (priority)
Key mapping is my own, because the wiki fetch listed abilities by order, not key: Q Knuckle Down, W Haymaker, E Facebreaker, R The Show Stopper.
- **Parts.** The passive alternates a normal punch with a much faster, longer second punch, adds regeneration as health falls, and fills Grit from damage taken. Q gives two stronger attacks, with max-health damage and speed towards champions. W spends all Grit on a shield and a wide blast, with true damage in the centre. E pulls enemies from both sides, slowing about 70%, and stuns about 1 second only if both sides were caught. R suppresses, carries and slams — [Wiki: Sett, V25.17](https://wiki.leagueoflegends.com/en-us/Sett)
- **Core loop.** Walk in, punch, accept hits, watch the bar, then fire W when the bar and the enemy's position line up.
- **Repeated decision.** Do I fire W now, or take one more hit while the bar is close to decaying?
- **Opponent.** My reading of the mechanics: stop feeding Grit when it is high, back off during the hold so it decays, and sidestep the centre during the roughly 0.75-second cast. Damage his shields absorb is not stored as Grit, so shields on him slow the bar — [Wiki: Sett, V25.17](https://wiki.leagueoflegends.com/en-us/Sett)
- **Memorable.** Damage received becomes a punch you can see coming. The kit fits on one line.
- **Riot.** Twin Enso wanted an easy-to-learn juggernaut with broad appeal and a one-two cadence. Riot Axes explains why the grappler idea was mostly dropped — [Riot: Champion Insights Sett, Jan 2020](https://www.leagueoflegends.com/en-us/news/dev/champion-insights-sett/). The Grit rationale and the idea of using the front line to reach the back line come from Cashmiir relaying the team, and he says he does not work on champions — [Riot: Cashmiir, Reddit via devtrackers](https://devtrackers.gg/leagueoflegends/p/fb62c41d-champion-insights-sett)

#### Lee Sin
- **Parts.** Attacks after a spell refund energy. Q is a skillshot with a dash to the marked target. W is a dash and shield, then omnivamp. E is an area hit, then a slow. R kicks a target away, knocking up any it collides with — [Wiki: Lee Sin, V26.21](https://wiki.leagueoflegends.com/en-us/Lee_Sin)
- **Core loop.** Cast, attack twice for energy, recast, attack twice, and keep the energy cycle alive.
- **Repeated decision.** Recast for the effect now or attack first for energy, and is the Q dash safe?
- **Opponent.** Dodge the first Q, then punish the dash and the empty energy bar. These are my inference, supported by the risk noted in [Community: Dodge](https://www.dodge.gg/lol/news/lee-sin-build-2026).
- **Memorable.** The kick and Flash play, whose position-swap needs both skill and surprise — [Riot: Jag 2016](https://www.surrenderat20.net/2016/12/red-post-collection-dev-blog-on.html)

#### Zed
- **Parts.** The passive adds damage on targets under 50% health. Q is a line shot and E a short area hit, both repeated by Shadows. W places a Shadow and swaps with it within about 5 seconds. R dashes to the target, leaves a Shadow, and detonates banked damage after about 3 seconds — [Wiki: Zed, V26.10](https://wiki.leagueoflegends.com/en-us/Zed)
- **Core loop.** Place a body, line up both shots, then swap only if the exit is safe.
- **Repeated decision.** Do I swap in for damage, or hold the Shadow as the way out?
- **Opponent.** My inference: dodge between the two Q lines, watch the Shadow's position because it shows his exit, and hold a defensive tool for the R detonation.
- **Memorable.** A second body you control, and a delayed number on the target.

#### Viego
- **Parts.** Passive possession on a takedown, with a heal and a 10-second body swap. Q is a stab with a marked follow-up heal. W charges a dash into a stun. E lays mist for attack speed and, if idle, camouflage. R is a blink that hits the most wounded enemy hardest — [Wiki: Viego, V26.22](https://wiki.leagueoflegends.com/en-us/Viego)
- **Core loop.** Get a takedown, take a body, use it, then leave via R for the next fight.
- **Repeated decision.** Which body do I take, and when do I leave it?
- **Opponent.** My inference: focus him before he reaches the next kill, and deny the reset.
- **Memorable.** Playing the enemy's kit. The hook came from Riot's concept of possessing other champions, and an attached-to-ally version was cut as not feeling like a king — [Wiki: Viego/Trivia](https://wiki.leagueoflegends.com/en-us/Viego/Trivia); [Riot: August, thread on devtrackers](https://devtrackers.gg/leagueoflegends/p/3b353495-champion-insights-viego)

#### Ahri
- **Parts.** The passive heals through stacks and takedowns. Q is an out-and-back orb, with true damage on return. W is three seeking flames plus speed. E is a first-hit charm. R is up to three dashes — [Wiki: Ahri, V26.06](https://wiki.leagueoflegends.com/en-us/Ahri)
- **Core loop.** Poke through both passes of the orb, land a charm, then spend dashes to follow up or leave.
- **Repeated decision.** Spend dashes to attack or keep them to survive.
- **Opponent.** My inference: sidestep the charm and punish when R is down, since she has no other dash.
- **Memorable.** The return pass and the triple dash. I found no Riot intent source for her.

#### Thresh
- **Parts.** Souls scale AP and armour. Q is a stunning hook with an optional dash in. W is a lantern that shields and carries an ally. E is a knockback with a passive attack charge that grows while not attacking. R is a box whose walls break on contact, dealing damage and slowing — [Wiki: Thresh, V26.22](https://wiki.leagueoflegends.com/en-us/Thresh)
- **Core loop.** Threaten with the hook, then choose whether to go in or stay and let others follow.
- **Repeated decision.** Dash in after the hook, or hold position?
- **Opponent.** My inference: stay behind blockers, sidestep with the windup in mind, and treat the box as a price to walk through.
- **Memorable.** Hook and lantern saves. Riot uses the lantern as its example of teamplay mastery — [Riot: Zileas, Jul 2014, mirror](https://archive.runeterra.net/na/riot-official/Ex5oYQW6)

#### Jhin
- **Parts.** The passive is the four-shot rule, with crit-based speed and bonus damage. Q is a bouncing grenade. W is a long line that roots marked targets. E is two trap charges. R is four channelled long-range shots, the last a crit — [Wiki: Jhin, V26.16](https://wiki.leagueoflegends.com/en-us/Jhin)
- **Core loop.** Count to four, reposition through the reload, and set up roots with damage and traps.
- **Repeated decision.** Where does the fourth shot go, and when do I use the reload to move?
- **Opponent.** My inference: go in during the reload, and do not stand on likely trap routes.
- **Memorable.** The count of four in everything he does. Riot says it found a play pattern early, and that the kit's oddities sit near the top of how far a new champion can go — [Riot: Scruffy, Feb 2017, S@20 mirror](https://www.surrenderat20.net/2017/02/dev-on-champions-of-2016.html)

#### Aphelios
- **Parts.** Weapon rotation is the kit. Each of five weapons has its own attack and Q, ammo is 50 per weapon, a swap takes about 0.8 seconds, and an empty weapon goes to the back of a visible queue. R is unlocked by level and applies weapon effects — [Wiki: Aphelios, V26.19](https://wiki.leagueoflegends.com/en-us/Aphelios)
- **Core loop.** Read the pair you hold, use it for what it does best, and plan what comes next in the queue.
- **Repeated decision.** Spend ammo fast to reach a better pair, or conserve what suits this fight?
- **Opponent.** My inference: read his held pair and take fights that suit you, since he cannot pick freely.
- **Memorable.** Thinking instead of aiming. Riot describes adaptation over reflexes, a weapon list redesigned about ten times, and a kit it sees as lacking a usual passive, W and E. The wiki still lists Phase as W — [Riot: Champion Insights Aphelios, Nov 2019](https://www.leagueoflegends.com/en-gb/news/dev/champion-insights-aphelios/)

#### Orianna
- **Parts.** Her ball is the kit's anchor: Q moves it, W pulses around it with slow and speed, E flies it to an ally with a shield, and R stuns and pulls around it. The passive adds on-hit stacks — [Wiki: Orianna, V26.21](https://wiki.leagueoflegends.com/en-us/Orianna)
- **Core loop.** Keep the ball where the opponent has to walk, and threaten R from there.
- **Repeated decision.** Where should the ball sit now, and is moving it worth the short cooldown?
- **Opponent.** My inference: play around the ball's position rather than around her, and force her to spend the ball.
- **Memorable.** A visible second point of threat. I found no Riot intent source for her.

### Inferences
**What the whole adds, per kit, and how much transfers**
- Fiora: the passive gives an aim, Q delivers it, R multiplies it, W punishes overcommitment. `[transfers to 1v1: nearly all of it is one-on-one by design, apart from split-push pressure and on-kill zone.]`
- Camille: footwork between Q stages is the kit's heart, with passive and W timing the trade. `[transfers to 1v1: terrain is already part of the game here, so her wall play is a direct model for cover.]`
- Riven: charges plus resets force weaving, and no resource pushes all gating onto cooldowns. `[transfers to 1v1: it needs only attacks and a target, though armour-based counters do not apply, and ping affects cancels.]`
- Sett: Grit makes the opponent's hits part of his plan. `[transfers to 1v1: the bar reads best when one attacker feeds it.]` His E's stun and R's bonus-health damage do not. `[depends on 5v5: they need a second enemy and items.]`
- Lee Sin: refund loop plus recast decisions. `[transfers to 1v1: the rhythm needs no allies.]` His ally and ward W and kick-into-team plays do not. `[depends on 5v5: they need allies, wards and a team behind the target.]`
- Zed: a second body makes space part of the decision. `[transfers to 1v1: Shadows work well around cover, and swaps give a clear mind game.]`
- Viego: the possession hook does not survive. `[depends on 5v5: a kill ends the round, so no body remains to use.]` Charged W and marked Q do. `[transfers to 1v1: they are self-contained.]`
- Ahri: return-path Q and triple-dash R. `[transfers to 1v1: both reward spacing against one target.]` Stack healing and takedown extension do not. `[depends on 5v5: they feed on minions and multiple kills.]`
- Thresh: mainly team-based. `[depends on 5v5: lantern, souls and pick follow-up all need others or long games.]` The hook's optional dash and the breakable-wall box are useful ideas. `[transfers to 1v1: temporary walls fit an arena with cover directly.]`
- Jhin: the four-shot rule. `[transfers to 1v1: a reload clock is shared knowledge for both players.]` Ally-marked roots and team reach do not. `[depends on 5v5: they rely on teammates and long sightlines.]`
- Aphelios: a rotating toolset. `[transfers to 1v1: a different pair each round could fit, though a custom HUD is a real cost.]` Fifty-shot ammo pools are likely too long for short rounds. `[depends on 5v5: they assume long fights and repeated engagements.]`
- Orianna: a movable threat point. `[transfers to 1v1: the opponent must read two positions, and cover interacts well with it.]` Ally shield and team-flanking R do not. `[depends on 5v5: they need an ally or a group to catch.]`

**Cross-kit lessons for a duel**
- Every kit that stands out asks one simple question that the player can name. `[transfers to 1v1: duels show a kit's core question plainly, so a muddled kit has nowhere to hide.]`
- Memorability tends to come from one visible object or rule: the Vital, the bar, the shadow, the count of four, the ball. `[transfers to 1v1: one clear on-screen element tells both players what the fight is about.]`
- Keep an opponent's plan visible in each entry: every kit above has a stated or inferable answer. `[transfers to 1v1: Riot's counterplay pillar is the test of whether the duel stays two-sided.]`
- Starting a duel kit from these four shapes (hit location, timed return, weave rhythm, damage-taken bar) gives four clearly different identities within one format. `[transfers to 1v1: none of the four requires anything outside the duel.]`

### Gaps
- No Riot-authored intent source was fetched for Zed, Ahri, Orianna or Thresh's kit beyond the lantern comment. Lee Sin's source is one passage in Jag's post. Opponent lines marked as my inference for these kits have no outside support.
- The official Viego Champion Insights page itself was not read, only a Reddit thread about it. Details of its author and date are thin.
- PC Gamer's Camille breakdown would not open past its headline. A search summary says it describes optimal and suboptimal uses of each ability, and I have not relied on it — [Press: PC Gamer](https://www.pcgamer.com/league-of-legends-latest-champion-has-assassins-in-her-sights/)
- Win-rate and matchup data were left out because the samples I saw were small or conflicting.
- Long-form video essays were not found. A direct search of known channels could improve the community layer, which is currently guides and forum posts.
- Ability values come through a summarising fetch tool on very long wiki pages, each read only in part. Sett's page shows a last change of V25.17, older than the others, so check it first.
