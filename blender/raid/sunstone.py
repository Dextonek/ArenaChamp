"""
The sun-stone as a model (2026-11-19; the user: "lets make more models for the raid too"): the stone that falls in the Sun Warden's
Pillar Fall and stands 8 s as cover. Until now a plain cylinder (`stoneGeo` in src/raid/fx.ts). A broken drum of a Sun Court column:
pale fluted marble, rays of gold inlaid in its flutes, the top snapped off in a slant, chipped and cracked, a couple of fallen chips at its
foot. A still model (the class `FallingStone` scales it by the stone's radius and turns it by its place).

Built with the Raid bosses' toolkit: flat facets, a few materials. Faces -Y, z up, metres; about 1.4 m across, 1.3 m high, foot at z = 0.

    blender --background --factory-startup --python blender/raid/run.py -- sunstone
"""
import math
import random

from mathutils import Vector

import boss_bodies as bb
from boss_bodies import Boss
from boss_wyrm import plate

HEIGHT = 1.4
N = 24  # sides: every other vertex is a flute's floor


def build_sunstone():
    B = Boss("sunstone", HEIGHT)
    marble = B.m("marble", "#a89d86", 0.0, 0.85)
    marble_dk = B.m("marble_dark", "#7d735f", 0.0, 0.9)
    marble_hi = B.m("marble_hi", "#bcb197", 0.0, 0.8)
    inner = B.m("inner", "#94876b", 0.0, 0.9)
    gold = B.m("gold", "#d2ae55", 0.85, 0.35, "#e0a93a", 0.3)
    crack = B.m("crack", "#4a4234", 0.0, 0.9)
    rng = random.Random(11)

    st = B.part("stone", (0, 0, 0))
    # (z, radius at a ridge): a foot ring, then a drum swelling a little and drawing in toward the top
    prof = [(0.0, 0.72), (0.14, 0.72), (0.18, 0.69), (0.55, 0.7), (1.15, 0.655)]

    def rad(z):
        for (z0, r0), (z1, r1) in zip(prof, prof[1:]):
            if z0 <= z <= z1 and z1 > z0:
                return r0 + (r1 - r0) * (z - z0) / (z1 - z0)
        return prof[-1][1]

    def V(k, z, r):
        a = k * math.tau / N + 0.13
        flute = 1.0 if k % 2 == 0 else 0.9
        return Vector((r * flute * math.cos(a), r * flute * math.sin(a), z))

    rows = []
    for (z, r) in prof:
        rows.append([V(k, z, r) for k in range(N)])
    # the broken top: a slant and jagged steps, each sector its own height
    top = []
    for k in range(N):
        a = k * math.tau / N + 0.13
        top.append(1.2 + 0.17 * math.cos(a - 2.2) + rng.uniform(-0.1, 0.1) + (0.12 if k % 7 == 0 else 0))
    rows.append([V(k, top[k], prof[-1][1] * 0.985) for k in range(N)])
    # a chipped, concave face: an inner ring lower than the rim, and a hollow in the middle
    inner_ring = [V(k, top[k] - 0.03 - rng.uniform(0, 0.05), prof[-1][1] * 0.8) for k in range(N)]
    mids = [marble_dk, marble, marble, marble_hi, marble]
    for i in range(len(rows) - 1):
        m = mids[min(i, len(mids) - 1)]
        for k in range(N):
            k2 = (k + 1) % N
            st.face([rows[i][k], rows[i][k2], rows[i + 1][k2], rows[i + 1][k]][::-1], m)
    for k in range(N):
        k2 = (k + 1) % N
        st.face([rows[-1][k], rows[-1][k2], inner_ring[k2], inner_ring[k]][::-1], inner if k % 3 else marble_hi)
    hollow = Vector((0.04, -0.03, min(top) - 0.05))
    for k in range(N):
        k2 = (k + 1) % N
        st.face([inner_ring[k], inner_ring[k2], hollow][::-1], inner if k % 2 else marble_dk)
    # the foot's underside
    st.face([rows[0][k] for k in range(N)], marble_dk)

    def surf(a, z, lift=0.012):
        r = rad(z) * 0.9 + lift
        return Vector((r * math.cos(a), r * math.sin(a), z))

    # gold rays: thin inlays lying in the flutes, long and short in turn, like the rays of a sun
    for k in range(1, N, 2):
        a = k * math.tau / N + 0.13
        zt = top[k] - 0.1 - (0.0 if (k // 2) % 2 == 0 else 0.35)
        w = 0.024
        p = [surf(a - w, 0.26, -0.01), surf(a + w, 0.26, -0.01), surf(a - w, zt, -0.01), surf(a + w, zt, -0.01),
             surf(a - w, 0.26, 0.014), surf(a + w, 0.26, 0.014), surf(a - w, zt, 0.014), surf(a + w, zt, 0.014)]
        st.hull(p, gold)
    # cracks: dark zigzags running down from the broken top
    for a, depth in ((0.9, 0.55), (3.6, 0.45), (5.3, 0.38)):
        z = top[int(((a - 0.13) % math.tau) / math.tau * N)] - 0.02
        pts = [(a, z)]
        for i in range(4):
            pts.append((pts[-1][0] + rng.uniform(-0.05, 0.05), pts[-1][1] - depth / 4))
        for (a0, z0), (a1, z1) in zip(pts, pts[1:]):
            st.hull([surf(a0 + s * 0.011, z0, l) for s in (-1, 1) for l in (-0.02, 0.01)] +
                    [surf(a1 + s * 0.011, z1, l) for s in (-1, 1) for l in (-0.02, 0.01)], crack)
    # chips: broken pieces fallen at the foot
    for (x, y, rr) in ((0.78, -0.35, 0.1), (-0.5, -0.74, 0.08), (0.2, 0.8, 0.09)):
        st.rock((x, y, rr * 0.6), (rr * 1.3, rr, rr * 0.7), marble if rr > 0.085 else marble_dk, n=10, rough=0.25)
    plate(st, (0.62, -0.5, 0.1), (1, 0.3, 0), (0, 0, 1), (0.2, 0.14, 0.08), marble_hi, bevel=0.02)
    st.finish()
    return B


def register():
    bb.BUILD["sunstone"] = build_sunstone
