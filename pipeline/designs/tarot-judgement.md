# Tarot Judgement

- **Label:** `tarot judgement` · **File:** `src/spells/targeted/tarotJudgement.ts` · **Module:** `tarotJudgementModule`
- **Targeting:** `enemies`, `maxTargets: 5`
- **Palette (core → hot → body → accent → dark):** gilt `#ffe8a8` → gold `#d8a83a` → card violet `#5a2a8a` → accent teal `#3ad0c0` → card black `#0c0814`
- **The shape that makes it ours:** giant **tarot cards** (ornate gilt frames, drawn abstract arcana: sun, moon, tower, star, wheel) fan out from the caster's hand like a dealer's spread, fly to the enemies spinning, stand upright before each, **flip over**, and each card's arcana bursts out.
- **Recipes:** `i-chromatic-comet-ring-stack` (stacked ring projectiles), `i-toon-spiked-scribble-ring-pop` (toon ring pop), `e-yougelly-clef-ring-nova` (stacked ring nova)
- **Craft rules:** `docs/ART_BIBLE.md` (drawn hard shapes, black as a colour, value ladder, objects and materials below the bloom threshold, no white blobs, short impact frames `impactFrameAt(t, D, [1, 2], 0.04)`, small dark smoke, few damage ticks).

## Timeline (~4.6 s)
- 0-0.7: darken 0.6 violet. Five cards fan out of the caster's hand (backs showing: violet with a gold geometric pattern), hovering in a fan.
- 0.7-1.6: cards fly to the targets spinning, then stand upright in front of each enemy facing the caster; small ticks (damage 6) as they land.
- 1.6-1.9: all cards flip at once to show their faces (sun, moon, tower, star, wheel drawn on canvas in gold/violet/teal with black lines); dead beat.
- D = 2.0: each card's arcana bursts: the card shatters into gilt shards, a symbol-specific ring pop (sun rays, moon crescent, tower lightning, star burst, wheel spokes), impact frames (gold, short). `ctx.hit(e, { damage: 40, knock: 3 })`.
- 2.0-4.6: gilt shards flutter down; the symbols fade.
