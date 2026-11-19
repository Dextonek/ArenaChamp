"""
The Climb's feeding root as a model (2026-11-19; the user: "Yes, do them all"). Until now it was a cone, nine thorn cones and a sphere
(`root` in src/tower/world/looksWild.ts). The Walking Wood's one that never walks: a low mound of earth and bark with thorny roots coiling up
round a swollen seed-bulb in its middle, a dark husk split open over a warm amber-pink glow, the roots ending in thorn tips. It throws from the
bulb: the roots draw back and the bulb clenches, then the husk opens as the shot leaves. Mythic and a little cruel, never cartoon
(docs/ART_BIBLE.md §1). The glow is kept low (under the bloom a bright pulp is a white blob).

Built with the Raid bosses' toolkit (blender/bosses/boss_bodies.py, helpers from boss_wyrm.py). Faces -Y (it has no front: it is round), z up,
metres, on z = 0; about 1.9 m to the thorn tips, a mound 1.9 m across (the unit draws it at its scale, 1.6).

Parts: root > mound > (bulb > husk1..husk5, root1..root6 each root<i> > root<i>b > root<i>c).
The husk petals hinge at their feet on the ring round the bulb's neck, at angles 18 + 72 j degrees; the roots start at 10 + 60 i degrees
(angles in Blender's xy plane, x towards the angle 0): the game turns each about the horizontal axis at right angles to that direction.

    blender --background --factory-startup --python blender/tower/beasts/run.py -- root
"""
import math

from mathutils import Vector

import boss_bodies as bb
from boss_bodies import Boss, R, T
from boss_wyrm import S, cone, panel, plate, seg

HEIGHT = 1.9


def P(r, a, z):
    return Vector((r * math.cos(a), r * math.sin(a), z))


def build_root():
    B = Boss("root", 1.9)
    earth = B.m("earth", "#3a2a1c", 0.0, 0.95)
    bark = B.m("bark", "#55391f", 0.0, 0.9)
    bark_dk = B.m("bark_dark", "#2c1d12", 0.0, 0.92)
    moss = B.m("moss", "#55702c", 0.0, 0.95)
    husk = B.m("husk", "#33221a", 0.0, 0.85)
    thorn = B.m("thorn", "#a8966a", 0.0, 0.6)
    pulp = B.m("pulp", "#ff9a6a", 0.0, 0.5, emit="#ff7a48", strength=0.9)

    BZ = 0.95   # the bulb's centre
    onion = [(-0.28, 0.12), (-0.1, 0.3), (0.1, 0.34), (0.28, 0.24), (0.42, 0.1), (0.52, 0.03)]

    # --- the mound: a low dome of earth and bark with a small crater, a little moss, roots lying on the ground ----------------
    mound = B.part("mound", (0, 0, 0.3))
    mound.lathe([(0.0, 1.05), (0.1, 1.0), (0.22, 0.84), (0.34, 0.55), (0.4, 0.28), (0.38, 0.22), (0.3, 0.0)], [earth, earth, bark_dk, bark_dk, earth, earth],
                sides=11, rot0=0.2, jitter=0.06)
    for i in range(6):
        a = i * 1.05 + 0.3
        plate(mound, P(0.78, a, 0.2), (-math.sin(a), math.cos(a), 0), (math.cos(a), math.sin(a), 1.1), (0.3, 0.16, 0.04), bark, taper=(0.8, 0.8),
              bevel=0.025)
    for i in range(8):
        a = i * 0.8 + 0.5
        plate(mound, P(0.9 - 0.12 * (i % 3), a, 0.12 + 0.07 * (i % 3)), (-math.sin(a), math.cos(a), 0), (math.cos(a), math.sin(a), 1.4),
              (0.24, 0.16, 0.035), moss, taper=(0.8, 0.8), bevel=0.02)
    for i in range(7):
        a = i * 0.9 + 0.2
        seg(mound, P(0.95, a, 0.1), P(1.28 + 0.08 * (i % 3), a + 0.2, 0.03), 0.065, 0.02, bark, sides=5)
    mound.finish()

    # --- the bulb: a stem out of the crater, an onion-shaped pulp, and five curved husk shells hugging it, slits between ---------
    bulb = B.part("bulb", (0, 0, BZ), "mound")
    seg(bulb, (0, 0, 0.35), (0, 0, BZ - 0.26), 0.26, 0.15, bark_dk, sides=8, rot0=0.1)
    bulb.lathe([(BZ + z, r * 0.97) for z, r in onion], pulp, sides=10, rot0=0.1)
    bulb.finish()
    w = 0.5   # half the angle a petal covers; the petals sit 1.26 apart, so the slits are about 0.26 wide
    for j in range(5):
        b = math.radians(18 + 72 * j)
        h = B.part(f"husk{j + 1}", P(0.14, b, BZ - 0.28), "bulb")
        for (z0, r0), (z1, r1) in zip(onion, onion[1:]):
            pts = []
            for z, r in ((z0, r0), (z1, r1)):
                ww = w * (1 - max(0.0, z - 0.1) / 0.5)
                for ro in (r * 0.97, r + 0.06):
                    pts += [P(ro, b - ww, BZ + z), P(ro, b + ww, BZ + z), P(ro, b, BZ + z)]
            h.hull(pts, husk)
        # a dark rib down the middle of each petal
        cone(h, P(0.42, b, BZ - 0.02), P(0.14, b, BZ + 0.5), 0.028, bark_dk, sides=4)
        h.finish()

    # --- the roots: six, each in three pieces, out over the mound, up and in round the bulb, ending in a thorn ------------------
    for i in range(6):
        a = math.radians(10 + 60 * i)
        up = 0.1 * (i % 3)
        p0 = P(0.7, a, 0.2)
        p1 = P(1.0, a + 0.55, 0.4)
        p2 = P(0.86, a + 1.25, 0.98)
        p3 = P(0.52, a + 1.95, 1.4 + up)
        p4 = P(0.36, a + 2.3, 1.72 + up)
        r1 = B.part(f"root{i + 1}", p0, "mound")
        seg(r1, p0, p1 + (p1 - p0) * 0.1, 0.14, 0.105, bark, sides=6, belly=1.08)
        r1.finish()
        r2 = B.part(f"root{i + 1}b", p1, f"root{i + 1}")
        seg(r2, p1, p2 + (p2 - p1) * 0.1, 0.105, 0.075, bark, sides=6, belly=1.08)
        c = p1.lerp(p2, 0.55)
        cone(r2, c, c + P(1, a + 0.9, 0.0) * 0.12 + Vector((0, 0, 0.06)), 0.025, thorn, sides=4)
        r2.finish()
        r3 = B.part(f"root{i + 1}c", p2, f"root{i + 1}b")
        seg(r3, p2, p3 + (p3 - p2) * 0.1, 0.075, 0.045, bark_dk, sides=6, belly=1.05)
        cone(r3, p3 - (p4 - p3) * 0.05, p4, 0.045, thorn, sides=5)
        if i % 2 == 0:
            c = p2.lerp(p3, 0.5)
            cone(r3, c, c + P(1, a + 1.6, 0.0) * 0.11 + Vector((0, 0, 0.05)), 0.022, thorn, sides=4)
        r3.finish()
    return B


def register():
    bb.BUILD["root"] = build_root
