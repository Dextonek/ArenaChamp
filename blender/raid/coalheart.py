"""
The Cinder Pit's Coal Heart as a model (2026-11-19; the user: "lets make more models for the raid too"). Until now (`coalHeartLook` in
src/raid/bodies/adds.ts) a ball and four lumps over a cone. Ash and Ember's stage add: a burning heart of the fallen sun's embers,
a skin of slag cooling over it in plates with the fire between, held in a cage of five slag shards that float round it, over a little
cone of cooled lava with a molten dish on top. Mythic and lean, never cartoon (docs/ART_BIBLE.md §1).

Built with the Raid bosses' toolkit (blender/bosses/boss_bodies.py, boss_wyrm.py): rigid parts in a named hierarchy, no armature, every
part's origin the point it turns about. The game poses it in code (src/raid/adds/coalHeart.ts): the cage turns, the shards open at its shot.
Faces -Y, z up, metres; about 2 m tall, the heart's centre at 1.35 m (where its lob leaves).

Parts: coalheart > base, heart, cage > shard1..shard5.

    blender --background --factory-startup --python blender/raid/run.py -- coalheart
"""
import math

from mathutils import Vector

import boss_bodies as bb
from boss_bodies import Boss, T, ellipsoid_tiles, emit_tile

HEIGHT = 2.0
HY = 1.35  # the heart's centre (m)
SHARDS = 5
CAGE_R = 0.82


def build_coalheart():
    B = Boss("coalheart", HEIGHT)
    slag = B.m("slag", "#2c1c16", 0.05, 0.9)
    slag_hi = B.m("slag_hi", "#4c3429", 0.05, 0.82)
    seam = B.m("seam", "#4a1608", 0.0, 0.6, "#ff6a1f", 1.3)
    B.m("heart", "#5a1a08", 0.0, 0.5, "#ff6a20", 1.5)
    heart_m = B.mat["heart"]

    # --- the cone of cooled lava, a molten dish on its top, cracks along its ridges --------------------------------------------
    base = B.part("base", (0, 0, 0))
    rings = [(0.0, 0.9), (0.1, 0.86), (0.32, 0.64), (0.55, 0.38), (0.66, 0.26)]
    base.lathe(rings, [slag, slag_hi, slag, slag_hi], sides=7, rot0=0.2, jitter=0.0)
    base.lathe([(0.64, 0.2), (0.7, 0.2)], seam, sides=7, rot0=0.2)
    for k in (0, 2, 5):
        a = 0.2 + k * math.tau / 7
        ca, sa = math.cos(a), math.sin(a)
        p = [(ca * rings[i][1], sa * rings[i][1], rings[i][0]) for i in (4, 3, 2, 1)]
        t = Vector((-sa, ca, 0)) * 0.017
        pts = []
        for q in p[:3]:
            v = Vector(q) + Vector((ca, sa, 0)) * 0.014
            pts += [v + t, v - t]
        base.hull(pts, seam)
    for k in range(4):
        a = 0.4 + k * 1.6
        base.rock((math.cos(a) * 0.95, math.sin(a) * 0.95, 0.07), (0.17, 0.14, 0.1), slag_hi if k % 2 else slag, n=10, rough=0.25)
    base.finish()

    # --- the heart: embers under a skin of slag plates with the fire between them --------------------------------------------
    C = Vector((0, 0, HY))
    heart = B.part("heart", C)
    heart.rock(C, (0.46, 0.46, 0.46), heart_m, n=34, rough=0.04)
    for t in ellipsoid_tiles(0.5, 0.5, 0.5, 4, 6, 0.06, 0.2, heart.rng):
        emit_tile(heart, t, T(*C), slag if heart.rng.random() < 0.7 else slag_hi, seam, heart.rng)
    heart.finish()

    # --- the cage: five shards of slag standing round it, each a part of its own (they open at the shot) ---------------------------
    B.empty("cage", C, "coalheart")
    for k in range(SHARDS):
        a = k * math.tau / SHARDS + 0.3
        z = HY + (0.12 if k % 2 else -0.1)
        c = Vector((math.cos(a) * CAGE_R, math.sin(a) * CAGE_R, z))
        sh = B.part(f"shard{k + 1}", c, "cage")
        rv = Vector((math.cos(a), math.sin(a), 0))
        tv = Vector((-math.sin(a), math.cos(a), 0))
        up = Vector((0, 0, 1))
        ln = 0.5 + 0.07 * (k % 3)
        # a long blade of slag, broad at the middle, pointed at both ends, leaning in at the top toward the heart
        pts = [c + up * ln + rv * -0.08, c - up * (ln * 0.85) + rv * 0.05]
        for s in (-1, 1):
            pts += [c + tv * (0.1 * s) + rv * 0.08 + up * 0.05, c + tv * (0.075 * s) + rv * -0.1 + up * -0.05,
                    c + tv * (0.055 * s) + up * (ln * 0.55), c + tv * (0.05 * s) + rv * 0.04 - up * (ln * 0.5)]
        sh.hull(pts, slag if k % 2 else slag_hi)
        # the fire it holds: a thin glowing seam down its inner face
        e = c - rv * 0.1
        sh.hull([e + up * (ln * 0.62) + tv * 0.012, e + up * (ln * 0.62) - tv * 0.012, e - up * (ln * 0.55) + tv * 0.012, e - up * (ln * 0.55) - tv * 0.012,
                 e + up * (ln * 0.55) + rv * 0.03 + tv * 0.012, e + up * (ln * 0.55) + rv * 0.03 - tv * 0.012,
                 e - up * (ln * 0.45) + rv * 0.03 + tv * 0.012, e - up * (ln * 0.45) + rv * 0.03 - tv * 0.012], seam)
        sh.finish()
    return B


def register():
    bb.BUILD["coalheart"] = build_coalheart
