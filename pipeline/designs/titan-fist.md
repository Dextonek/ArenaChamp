# Titan Fist

- **Label:** `titan fist` · **File:** `src/spells/targeted/titanFist.ts` · **Module:** `titanFistModule`
- **Targeting:** `enemy`
- **Palette (value ladder core → hot → body → accent → dark):** lava white `#fff0c8` → lava orange `#ff7a1a` → magma red `#c02a0a` → basalt `#2a2624` → ash black `#0c0a0a`
- **The shape that makes it ours:** a **colossal stone fist** (blocky basalt knuckles with glowing lava cracks, drawn faceted geometry) bursts out of the ground under the target in an **uppercut**, launching it, then the arm crumbles.
- **Recipes:** `c-ground-slam-shockwave-ring` (ground shock ring), `h-beyondfx-botw-bomb-explosion` (dark lit smoke, colour in small accents), `f-swipe-launch-slam` (launch upward then slam)
- **Theme note:** not eastern/xianxia. Follow the art bible's craft rules (drawn hard shapes, black as a colour, value ladder, objects below the bloom threshold, short impact frames `impactFrameAt(t, D, [1, 2], 0.04)`).

## Timeline (~4.2 s)
- 0-0.6: the ground under the target cracks (glowing lava lines, hard edges), rumble (small shake), pebbles jump.
- 0.6-0.9: the ground bulges; dead beat.
- D = 0.95: the fist erupts (rising 6 m in 0.2 s, faceted basalt with glowing cracks only in the seams, not a glowing blob), launching the enemy upward (`ctx.displace` up to 4 m then back down over 1.2 s); impact frames (orange, short), rock slabs tilt up in a ring, dark lit smoke column. `ctx.hit(e, { damage: 60, knock: 2 })`.
- 0.95-2.0: the fist holds at the top, the enemy hangs; lava drips; at 2.0 the enemy falls back and lands with a dust ring (second small hit damage 10).
- 2.0-4.2: the arm crumbles from the wrist down into falling boulders that sink; cracks cool from orange to dark.

## Exaggerate
A fist bigger than a house; the hang at the top before the fall.
