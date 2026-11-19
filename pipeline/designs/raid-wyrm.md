# The Eclipse Wyrm, the Raid's fourth boss

User, 2026-11-19: "could you create boss to arena champs raid boss and this level of model that this account have" (the study of an
account that builds low-poly creatures by code), then, shown the first look (`docs/bosses/wyrm_sheet.jpg`): "Yes, make the fight".

The model: `blender/bosses/boss_wyrm.py` -> `public/models/bosses/wyrm.glb` (5,540 triangles, rigid parts, faces +z in the game).

## Who it is (the lore)

A Fallborn of the Cast kind (LORE.md, `### fallborn`): the shadows thrown by the sun's last light that walked away. The Eclipse Wyrm
is the eldest and the largest of them: **the shadow the sun threw as it fell**, which took wing before it reached the ground. It flew
up, not down, and coiled round the Tower's crown under the Tear, and it wears on its brow the one thing it caught as the sun went by:
a black disc rimmed with the last corona of noon. Its scales are the blue of the sky the moment the light went; its plates are the
sun's gold it swallowed; its wings are the colour of the Tear's edge.

It is the reason the Sun Court is "under an eclipse": its disc hangs over the Court. The Warden keeps the Court below it and has never
been able to reach it. It is not the Unmaker's (Oblivion came through the Tear; the wyrm only roosts under it) and it does not want the
Dial unmade: it wants the light that is left, and it eats it, which is part of why the morning grows paler every year.

Ties: the Sun Warden (his sky is its shadow), Oblivion (it nests under the hole Oblivion came through and fears nothing else), Kagen
(his master's cut at the Tear passed under its wing). Only LORE.md gets these; no hero's kit changes.

## The room: the Roost

`src/arenas/wyrmRoost.ts`. The Tower's crown, above the Sun Court: a round roof of dark slate, radius 14, open to the sky. Overhead to
the north the Tear, black with a burning pink edge. The roof's old sun-dial is broken and scorched: dark bronze lines, never gold (gold
on a floor means a zone to stand in). At the rim the snapped stumps of the crown's pillars with old chains hanging from them, and the
scattered bones and gilded plates of what it ate. No cover: the fight raises none.

The hall's gate to it stands on the Court's side (west) of the hall, between the Court's gate and the west side door: a gate whose sign is
a black disc in a gold ring.

## The numbers

| | |
|---|---|
| HP | alone 3,500, for two 7,500 (`RAID_BOSSES.wyrm`) |
| Phases | Shadowfall 100 %, Taking Wing 66 %, Totality 33 % |
| Gauge | 100, a kneel 6 s |
| Body | radius 2.3 m (its long body and tail reach about 8 m, so a hit on the tail's tip misses), height 6.5 m; walks at 2.2 m/s and stops 4.8 m from its target |
| Enrage | 2:45 (165 s) |
| Tier extras | Tearfall, Wing Gust, The Eclipse Rolls, one a tier |

## The moves

Pale orange means leave, gold means stand here (the Raid's rules). Every move is acted out by the body and strikes as its zone lands.

| Phase | Move (id) | Shown | Costs | What you do | Body |
|---|---|---|---|---|---|
| All | Claw Rake (`rake`) | 1.5 s | 16 % | Three lanes fan out from its front, 10 m long, 1.4 m wide, 22 degrees apart. Step into a gap (they widen as they go) or get round it | Its right foreleg rears and rakes down across the lanes |
| All | Tail Sweep (`tail`) | 1.4 s | 20 %, knock 3 m | The floor behind and beside it, 230 degrees round its back, 7 m: get in front of it, or far away | The tail draws round one way and sweeps the other |
| All | Pin the Tail | 4 s after the sweep | | The tail lies where it ended, its tip a gold spot 6 m behind it. Stand on the spot 1.5 s | +40 on the gauge, once a sweep (`RAID_REWARDS.wyrm.pin`) |
| All | Shadow Breath (`breath`) | 1.6 s, then a 1.8 s sweep | 14 %, once a cast | A 28 degree cone 11 m long sweeps 130 degrees across its front, from one side to the other. Get behind it, or out past its reach, or start on the side it ends | Its head swings with the breath, the jaw wide |
| All, by the clock | Wingshade (`shade`) | 3.2 s | 38 % | The Tear flares. The whole roof burns except under its wings: within 4.8 m of its middle (a gold circle). Go **in** to it | It rears and spreads both wings wide |
| Taking Wing | Shadows Stand (`stand`), the stage | 30 s | | It flies up over the middle in a shell and can't be hurt. Three Cast shades rise 8.5 m out and shoot beams through you: kill them before its bar fills | Hovers, wings beating. Win: it crashes down and kneels. Fail: **Tearfall** over the whole roof, 50 %, no cover |
| Taking Wing on | Tearfall (`rain`) | 1.3 s, 0.9 s apart | 14 % each | Three circles, 2.2 m, each where you stand then. Keep walking | Its head up to the Tear, then down with each shard |
| Taking Wing on | Wing Gust (`gust`) | 1.3 s | 12 %, knock 4 m | An 80 degree cone in front, 9 m | Both wings beat forward |
| Totality (opener) on | The Eclipse Rolls (`roll`) | 1.6 s, then it rolls | 18 %, once a cast | The black disc leaves its brow and rolls 9 m/s in a straight line, a circle 2.6 m wide, from it through where you stood to the rim, and back to it along the same line. Step off the line, and stay off it on the way back | The disc goes from its crown; the crown is bare until it comes back |

The clock for Wingshade: Shadowfall 14 s in, then every 26 s; Taking Wing 36 s into the phase (after the stage), then every 24 s;
Totality 8 s in, then every 20 s.

Gaps between moves: Shadowfall 2 to 3 s, Taking Wing 1.9 to 2.8 s, Totality 1.6 to 2.5 s.

**Why these.** Every other boss in the Raid pushes you away from it; the wyrm's own mechanic asks you to run in under it, and its
rear is its most dangerous side (Tail Sweep), so you have to choose: in front, under its claws and breath, or behind, under its tail
but where its tail can be pinned. A melee hero lives under it; a ranged one must come in for every Wingshade.

## The rules it keeps (from `docs/architecture/raid.md`)

- A move never reads a hero's position; only `aim` does. Each step is its own cast. Move ids are letters only.
- Online: the hub needs `RAID_BOSSES.wyrm`, `RAID_REWARDS.wyrm` and the run (`RAID_RUN` gets `wyrm` as its fourth); `PROTOCOL` goes up.
- A party (a band over 2) fights it in the Roost too, with the HP of its band: it is **not tuned for a party**, only checked to run.

## Not in this pass

A party room and party mechanics; a Blender-built room (the Roost is drawn in code, first-pass, waiting on the user's nod).
