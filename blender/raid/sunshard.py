"""
The sun shard as a model (2026-11-19; the user: "lets make more models for the raid too"): a shard of the fallen sun that a hero carries
to the altar in the Sun Warden's "Turn the light" (Gathering Noon). Until now a gold glow-spot and a sprite. A faceted crystal of warm
gold-white, about 0.6 m tall, a few smaller crystals leaning at its foot, its core cracked open: molten orange runs in the cracks and a lump
of it lies at the base. The glows are low (under the game's bloom a bright glow is a white blob). A still model, foot at z = 0.

Built with the Raid bosses' toolkit: flat facets, a few materials. Faces -Y, z up, metres.

    blender --background --factory-startup --python blender/raid/run.py -- sunshard
"""
import math
import random

from mathutils import Vector

import boss_bodies as bb
from boss_bodies import Boss, R, T
from boss_wyrm import S

HEIGHT = 0.7


def build_sunshard():
    B = Boss("sunshard", HEIGHT)
    crys = B.m("crystal", "#f2cc72", 0.0, 0.25, "#ffd680", 0.55)
    crys_dk = B.m("crystal_dark", "#dca94c", 0.0, 0.3, "#e8a040", 0.45)
    crys_hi = B.m("crystal_hi", "#fff3cf", 0.0, 0.2, "#ffe9b0", 0.6)
    molten = B.m("molten", "#ff8a2a", 0.0, 0.5, "#ff8a2a", 1.8)
    st = B.part("shard", (0, 0, 0))

    # the main crystal: six sides, widest low, drawn to a point that leans a little
    rings = [(0.0, 0.06), (0.14, 0.17), (0.36, 0.16), (0.48, 0.11), (0.62, 0.012)]
    st.lathe(rings, [crys_dk, crys, crys_hi, crys], sides=6, rot0=0.25, jitter=0.07, xf=S(1.0, 0.9, 1.0))
    # smaller crystals leaning out of its foot
    for (x, y, tilt, turn, h, r) in ((0.15, -0.06, 0.55, 0.3, 0.34, 0.075), (-0.13, -0.1, -0.5, -0.4, 0.28, 0.07), (0.02, 0.14, 0.45, 2.9, 0.3, 0.07),
                                     (-0.17, 0.08, -0.6, 4.2, 0.2, 0.055)):
        xf = T(x, y, 0.01) @ R(0, 0, turn) @ R(tilt, 0, 0)
        st.lathe([(0.0, r * 0.7), (h * 0.35, r), (h * 0.8, r * 0.6), (h, 0.01)], [crys, crys_hi, crys_dk], sides=5, xf=xf, rot0=0.4, jitter=0.06)
    # the cracked core: a lump of molten stone at the foot between them, and orange running up the main crystal's cracks
    st.rock((0.0, -0.04, 0.05), (0.15, 0.12, 0.08), molten, n=12, rough=0.25)
    rng = random.Random(5)
    for side in (0.0, 2.2, 4.1):
        z, a = 0.05, side + 0.3
        for i in range(4):
            r0 = 0.16 + 0.0 * i
            a1 = a + rng.uniform(-0.25, 0.25)
            z1 = z + rng.uniform(0.07, 0.11)
            pts = []
            for (aa, zz) in ((a, z), (a1, z1)):
                rr = (0.17 if zz < 0.36 else 0.17 - (zz - 0.36) * 0.4) * 0.97
                for s in (-1, 1):
                    for lift in (-0.02, 0.03):
                        pts.append(Vector(((rr + lift) * math.cos(aa + s * 0.07), (rr + lift) * math.sin(aa + s * 0.07) * 0.9, zz)))
            st.hull(pts, molten)
            a, z = a1, z1
    st.finish()
    return B


def register():
    bb.BUILD["sunshard"] = build_sunshard
