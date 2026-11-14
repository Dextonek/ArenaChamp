---
title: Kessa, the Chainwarden (new hero 5 of 20)
tags: [design, heroes, kits, chain]
updated: 2026-11-14
status: gate 1 card and gate 3 on paper, written before the look (gate 2); the numbers may move after the look; nothing is built
---

# Kessa, the Chainwarden

New hero 5 of the twenty ([the cards](../../docs/heroes/next10/index.html), [all twenty kits](../../docs/heroes/kits20/index.html), [the lore](../../docs/lore/index.html)). Made by `python pipeline/tools/kits20.py` from `pipeline/tools/kits20_data/` on 2026-11-14; until the user's yes, change the data and run it again. After the yes this sheet is edited by hand, as `kit-phoenix.md` was.

**The order of the gates.** [The rules](../../docs/pipeline/new-hero.md) put the look (gate 2) before this sheet. The user asked for the full design of all twenty now, so this sheet comes first, and its numbers may move once the look is agreed.

## Gate 1: the card

| | |
|---|---|
| **Sentence** | The warden of a drowned prison, who never lets a prisoner go. |
| **Shape** | Two links of a chain, one copper, one steel. |
| **Colours** | Accent tarnished copper `#c08a4a`, foil pale steel `#d8dde2` |
| **Theme word** | `chain` |
| **Role** | Juggernaut, melee |
| **Faction** | The Concord of the Ring (lore: Warden of the Gaol of Oaths under the Drowned Harbour; Asenet is the one prisoner who slipped her chain.) |
| **The new thing** | Trading places. Chained to the enemy, she can swap places with them in a blink: off a ledge of fire, behind a wall, into her own trap. |
| **The question** | "Where will you be in a second: here, or where I stand?" |
| **The weakness** | Everything needs the chain: dodge the shackle and she is a slow fighter. A dash breaks the chain. |
| **The second decision** | Swap now, or hold the chain and drag them. |
| **How it looks** | A broad warden in dark plate with copper rivets, a long sea-worn coat, a great ring of keys, chains wound round both forearms; a heavy shackle in the right hand. |
| **Nearest heroes** | Brannoc (forge), Ada (hook), Wick (keys, the same faction) |

**Changed from the card shown on 2026-11-14:** Exchange is named for what it is, a swap of places, which moves the enemy farther than the engine's 4 m pull cap; it reaches only as far as the chain (7 m). The chain's reach is 7 m (the card said 8).

## Gate 3: the kit on paper

Kessa. Theme `chain`. Juggernaut, melee. **760 HP**, 3.8 m/s, basic attack 14 per 1.2 s at 2.6 m (a shackle swung on its chain). Accent `#c08a4a`, foil `#d8dde2`.

| Key | Spell | Shape | CD (s) | Range | Size | Damage | Rule |
|---|---|---|---:|---|---|---|---|
| P | **Iron Will** | PASSIVE | - | - | chain 7 m | - | She takes 15% less while a chain holds. A chained enemy cannot go farther than 7 m from her: at the end of the chain they are held, and walking against it they are slowed 30%. A dash breaks the chain (her own swap does not). |
| Q | **Shackle** | HOOK | 7 | 8 m | radius 0.35 | 45 and a chain for 4 s | 0.3 s wind-up, 18 m/s: a heavy chain. On a hit the shackle snaps shut and the enemy is chained to her for 4 s. |
| W | **Bulwark of Links** | SELF | 10 | self | radius 3 m | 50, and stun 0.6 s if chained | Chains wrap her: 35% less damage for 3 s. Recast (from 0.8 s) or at the end: the chains burst out 0.3 s later in a 3 m ring: 50, and a chained enemy inside is stunned 0.6 s. |
| E | **Exchange** | BLINK | 12 | the chain, 7 m | - | 20 | Only while a chain holds: both figures blur into links for 0.35 s and land in each other's place. |
| R | **The Iron Oath** | ZONE | 22 | 8 m | post 1.5 m, leash 6 m | 70 under the post; +20% from her on the leashed | An iron post's shadow marks a point for 1.2 s; the post hammers down (70 within 1.5 m), and every hero within 6 m of it, her too, is chained to it for 3 s: nobody goes farther than 4 m from the post. Dashes do not break this chain. |

### The answers, checked (rule 4)

A hero walks 4 m/s and reacts in 0.25 s; a circle warns at least 0.25 + radius / 4 s; a bolt reaches 6 m no sooner than 0.5 s; the ultimate never lands the moment it is cast.

- **P Iron Will.** Dash to break it, or fight within 7 m.
- **Q Shackle.** Sidestep: it reaches 6 m at 0.3 + 6/18 = 0.63 s. *(bolt: 0.3 + 6/18 = 0.63 s to 6 m (at least 0.5) OK; first hit 0.35 s after the cast)*
- **W Bulwark of Links.** The wrap shows for at least 0.8 s before the burst and the burst takes 0.3 s: 1.1 s, against 0.25 + 3/4 = 1.0 s to leave 3 m from beside her. *(circle 3 m: 0.25 + 3/4 = 1.00 s needed, warned 1.1 s OK; first hit 1.1 s after the cast)*
- **E Exchange.** Break the chain with a dash first, or stand where her place is no worse than yours (not by her post, a wall or a hazard). The blur shows 0.35 s. *(first hit 0.35 s after the cast)*
- **R The Iron Oath.** Step out of the shadow (0.25 + 1.5/4 = 0.63 s), and be past 6 m when it lands: from 4 m that is 2 m, 0.25 + 2/4 = 0.75 s, against 1.2 s. *(circle 1.5 m: 0.25 + 1.5/4 = 0.63 s needed, warned 1.2 s OK; first hit 1.2 s after the cast)*

### The question, the weakness, the second decision

- **Question:** "Where will you be in a second: here, or where I stand?"
- **Weakness:** Everything needs the chain: dodge the shackle and she is a slow fighter. A dash breaks the chain.
- **Second decision:** Swap now, or hold the chain and drag them.

### Budget

Juggernaut, 760 HP (620-780). Her damage sits under the budget (Q 45, W 50, R 70) because the chain, the swap and the leash are control. The balance runs at gate 5 decide the final numbers ([kit-common.md](kit-common.md), 40-60% wins).

### What the engine needs, and on which screen it is decided

**Engine work: medium.** A leash round a moving hero (`ctx.confine` keeps a fixed ring today) and a swap of places that both screens make from the cast's recorded positions. Build order: 11 of 20 ([the kits page](../../docs/heroes/kits20/index.html)).

| Key | Needs | Decided on |
|---|---|---|
| P Iron Will | The new leash (above). | The victim's screen (it moves its own hero). |
| Q Shackle | A bolt; the chain as a status with her figure as its anchor. | The victim's screen. |
| W Bulwark of Links | `RecastSpec.arm` at 0.8 s; a self ring. | The victim's screen. |
| E Exchange | New: a swap of places. Her client moves her (`moveCaster`); the victim's screen moves its hero to her position at the cast (`carryEnemy`). Both use the cast's recorded positions, so they agree. | Her client for her; the victim's screen for the enemy. |
| R The Iron Oath | `ctx.confine` round the post for both heroes. | The victim's screen for the enemy; her client for her. |

### What the CPU does

**As Kessa** (`aiHold`, `aiGoal`):

- Q whenever the enemy is within 8 m and not behind cover.
- W when the enemy is chained and within 3 m; recast at 2.5 s or when they are within 2.5 m.
- E when the enemy stands somewhere better (by her post, by a wall), or to get her out of a zone.
- R when the enemy is within 6 m.

**Against Kessa** (`enemyGoal`):

- When chained and holding a dash: dashes away half the time.
- Stays out of 3 m while she is wrapped in chains.
- Leaves the post's shadow outward.

### The effects, part by part

In the hero's palette: accent tarnished copper with a pale pale steel foil beside every dark part, a dark layer under the brightest, nothing in the enemy's red, every shape at least 0.15 m thick from the play camera; what the opponent must read (the wind-up, the circle, the line) is the best-drawn part, and the drawn shape is exactly what hits.

- **P Iron Will:** Links glow warm copper along her arm; the chain itself heavy copper-iron links that go taut and glow when held.
- **Q Shackle:** The chain uncoiling, the shackle snapping shut with sparks.
- **W Bulwark of Links:** Chains wrapping her like mail, then bursting out in a ring of links.
- **E Exchange:** Both figures dissolve into links and form again in each other's place.
- **R The Iron Oath:** An iron post with a copper cap hammered into the floor, a ring of dust, two chains drawing tight to it, the 4 m leash ring etched in pale steel.

### Names and files (checked free on 2026-11-14)

Labels: 'shackle', 'bulwark of links', 'exchange', 'the iron oath'. Files: `src/spells/targeted/shackle.ts`, `src/spells/targeted/bulwarkOfLinks.ts`, `src/spells/targeted/exchange.ts`, `src/spells/targeted/theIronOath.ts`; `src/effects/parts/chain.ts`, `src/kits/chain.ts`, `src/traits/chain.ts`. Checked against `src/kits/` and the labels and file names in `src/spells/targeted/` by the script.
