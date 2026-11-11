---
title: Anka, the Firebird (hero 40)
tags: [design, heroes, kits, phoenix]
updated: 2026-11-11
status: gate 1 (card) agreed by the user's pick; gate 2 (look) in the making
---

# Anka, the Firebird

The first hero made by [the rules for creating a hero](../../docs/pipeline/new-hero.md). The user picked her from
four ideas on 2026-11-11: "Phoenix fire dancer: the first true fire hero, a mage in ember-red and gold with flame
wings and a fan. Feather darts, a fire trail dash, and once per round she rises from her ashes."

## Gate 1: the card

| | |
|---|---|
| **Sentence** | A fire dancer who rises once from her own ashes. |
| **Shape** | The long feather with an eye near its tip: a gold shaft, an ember-red vane, a small teal eye. Every spell is made of them. |
| **Colours** | Ember red `#c23a22` and gold `#e0a935` with flame `#ffb54a`; foil: pale ash `#eadcc4`; one small accent, the teal `#2fb8a8` of the feather's eye. |
| **Theme word** | `phoenix` |
| **Role** | Mage, ranged, fragile. |
| **The new thing** | **A second life that the enemy can take away.** Her feathers stay on the floor as embers. When she would fall, she turns to ash and rises again at an ember. No ember, no second life: the enemy can stamp embers out by walking over them. No hero has a revive, and no hero's life depends on things lying on the floor. |
| **The question she asks** | Do you chase her, or do you first stamp out her embers? |
| **Her weakness** | Without an ember she is the most fragile mage in the game, and every feather she lays as an ember is a feather not thrown at you. Embers lie still: anyone can walk to them. |
| **Her second decision** | Each ember is damage now or a life later: her fan can make every ember flare (it burns out), or she can keep it. And she rises where the ember lies, so where she leaves them decides whether the enemy is waiting there. |
| **How she looks** | A slender dancer in an ember-red bodice and a feathered skirt, bare arms with gold bands, long dark-red hair under a gold circlet with a three-feather crest. Two wings of flame feathers swept down and back from her shoulder blades like a cloak (not raised like Auriel's), a train of five long tail feathers with eyes, and an open feather fan held up in her left hand. |

**Nearest heroes, and why she is not them.** Brannoc (the Ashen Smith) has the fire colours: molten orange under a
black crust, with iron and ash. Anka has no black and no metal but gold: feathers, not slag. Vesper is crimson with
bone. Auriel has wings: raised, pale plates of light, on armour. Fenna's flowers and Kaia's rods also lie on the floor
and can be trampled or touched; none of them is a life.

## Gate 2: the look

Model: `blender/heroes/real/phoenix.py` -> `public/models/heroes/phoenix_v4.glb` (600 KB). Built 2026-11-11, shown
to the user, waiting on the yes.

![Anka between Sefu and Kaia](../../docs/heroes/anka_look.jpg)

![The model as built](../../docs/heroes/anka_model.jpg)

The fan is in her LEFT hand, upright (`hold: 'torch'`), as a staff or wand is: the pack's attack for a caster is
the left hand's push, so in the right hand the fan stayed at her side while the empty left hand struck.

## Gate 3: the kit on paper

To be written after the look is agreed. First thoughts, not numbers: Q a feather dart that stays where it ends as an
ember; W the fan makes every ember flare in a ring; E a short dash that leaves a strip of fire; R she crosses the
arena as a great firebird and leaves an ember where she took off. What the engine has for the second life: a hit can
be changed where it is taken (`taken`), a hero can be made safe and hidden for a moment (`sealed`, `figureHidden`),
moved (`moveTo`) and healed; marks on the floor are drawn on both screens (`marks`).
