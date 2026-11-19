"""
The Sun Warden's Hour Stone as a model (2026-11-19; the user: "lets make more models for the raid too"). Until now it was drawn in code
(`hourStoneLook` in src/raid/bodies/adds.ts): a hexagonal cylinder, a cone, a torus and an octahedron. One of the Sun Court's sundial
stones risen: a tall six-sided pillar of pale weathered sun-marble, an hour numeral and ray-lines inlaid in gold on its faces, a gold
crown-band that floats and turns round it, one eye near the top (gold-white, a low glow) where its beam leaves. Mythic, never cartoon
(docs/ART_BIBLE.md §1).

Built with the Raid bosses' toolkit (blender/bosses/boss_bodies.py, boss_wyrm.py helpers): rigid parts in a named hierarchy, no
armature, every part's origin the point it turns about, flat facets, a few materials. The game poses it in code
(src/raid/adds/hourStone.ts). Faces -Y, z up, metres; 2.5 m tall, the eye at 1.9 m (stage.ts SHOT_Y: a beam leaves its eye there).

Parts: hourstone > base, body > (band, eye, lid).

    blender --background --factory-startup --python blender/raid/run.py -- hourstone
"""
import math

from mathutils import Vector

import boss_bodies as bb
from boss_bodies import Boss, T, interp
from boss_wyrm import cone, plate

HEIGHT = 2.5
COS30 = math.cos(math.pi / 6)


def build_hourstone():
    B = Boss("hourstone", HEIGHT)
    marble = B.m("marble", "#d8cdb4", 0.0, 0.85)
    marble_dk = B.m("marble_dark", "#a39880", 0.0, 0.9)
    marble_hi = B.m("marble_hi", "#ebe2ca", 0.0, 0.8)
    gold = B.m("gold", "#d2ae55", 0.85, 0.35, "#e0a93a", 0.3)
    eye = B.m("eye", "#fff0c0", 0.0, 0.4, "#ffd27a", 1.4)
    socket = B.m("socket", "#4a4234", 0.0, 0.8)

    # --- base: a stepped hexagonal plinth ------------------------------------------------------------------------------------
    base = B.part("base", (0, 0, 0))
    base.lathe([(0.0, 0.9), (0.09, 0.88), (0.11, 0.8), (0.2, 0.77)], [marble_dk, marble_dk, marble], sides=6)
    base.lathe([(0.1, 0.8), (0.1, 0.815), (0.115, 0.815), (0.115, 0.8)], gold, sides=6, loop=True)
    base.finish()

    # --- body: a tapering hexagonal shaft, a collar, a pointed cap ------------------------------------------------------------
    # (z, radius to a corner); a face's flat is at radius * cos 30. Corners at 0, 60.. degrees, so a flat faces -Y (angle 270).
    prof = [(0.2, 0.60), (0.6, 0.585), (1.6, 0.52), (2.12, 0.465), (2.14, 0.5), (2.28, 0.5), (2.3, 0.42), (2.48, 0.03)]
    body = B.part("body", (0, 0, 0.2), "hourstone")
    body.lathe(prof, [marble_dk, marble, marble, marble_dk, marble_hi, marble_dk, marble], sides=6)

    def strip(k, p0, p1, w, m=gold, lift=0.03):
        """An inlaid line on face k from (t0, z0) to (t1, z1), w wide; face 4 looks along -Y."""
        a0 = math.radians(30 + 60 * k)
        n = Vector((math.cos(a0), math.sin(a0), 0))
        t = Vector((-math.sin(a0), math.cos(a0), 0))
        (t0, z0), (t1, z1) = p0, p1
        L = math.hypot(t1 - t0, z1 - z0) or 1
        nt, nz = -(z1 - z0) / L * w / 2, (t1 - t0) / L * w / 2
        pts = []
        for (tt, zz) in ((t0, z0), (t1, z1)):
            for sg in (-1, 1):
                a = interp(prof, zz + sg * nz) * COS30
                for off in (-0.03, lift):
                    pts.append(n * (a + off) + t * (tt + sg * nt) + Vector((0, 0, zz + sg * nz)))
        body.hull(pts, m)

    # the front face: the hour numeral XII, and rays round the eye
    strip(4, (-0.17, 0.78), (-0.05, 1.3), 0.045)
    strip(4, (-0.05, 0.78), (-0.17, 1.3), 0.045)
    strip(4, (0.07, 0.78), (0.07, 1.3), 0.05)
    strip(4, (0.19, 0.78), (0.19, 1.3), 0.05)
    strip(4, (-0.22, 0.7), (0.26, 0.7), 0.03)
    strip(4, (-0.22, 1.38), (0.26, 1.38), 0.03)
    for i in range(8):
        a = i * math.pi / 4
        c, s = math.cos(a), math.sin(a)
        r1 = min(0.3, 0.225 / max(abs(c), 0.01))
        strip(4, (c * 0.17, 1.9 + s * 0.17), (c * r1, 1.9 + s * r1), 0.028)
    # the other five faces: hour ticks low down, a fan of rays high up
    for k, count in ((0, 1), (1, 2), (2, 3), (3, 4), (5, 5)):
        for i in range(count):
            t = (i - (count - 1) / 2) * 0.085
            strip(k, (t, 0.72), (t, 1.2), 0.03)
        for i in range(5):
            strip(k, (0, 1.76), ((i - 2) * 0.1, 2.08), 0.025)
    # weathering: a crack or two, a chipped corner
    strip(1, (0.1, 0.5), (-0.05, 0.9), 0.02, marble_dk, 0.012)
    strip(1, (-0.05, 0.9), (0.08, 1.3), 0.02, marble_dk, 0.012)
    strip(3, (-0.15, 1.5), (0.0, 1.2), 0.02, marble_dk, 0.012)
    body.rock((0.5, 0.2, 0.42), (0.1, 0.08, 0.07), marble_dk, n=10, rough=0.3)
    body.finish()

    # --- the eye: a plaque on the front with a gold-white gem, and the lid over it --------------------------------------------
    eyep = B.part("eye", (0, -0.45, 1.9), "body")
    eyep.chunk((0.3, 0.1, 0.2), socket, at=(0, -0.41, 1.9), bevel=0.02)
    eyep.hull([(sx * x, y, 1.9 + dz) for sx in (-1, 1) for (x, y, dz) in ((0.12, -0.445, 0.0), (0.06, -0.47, 0.065), (0.06, -0.47, -0.065), (0.0, -0.48, 0.0),
                                                                           (0.06, -0.44, 0.07), (0.06, -0.44, -0.07))], eye)
    eyep.finish()
    lid = B.part("lid", (0, -0.45, 1.97), "body")
    lid.hull([(sx * x, y, z) for sx in (-1, 1) for (x, y, z) in ((0.14, -0.44, 1.975), (0.14, -0.465, 1.99), (0.0, -0.485, 1.99), (0.0, -0.47, 1.965),
                                                                  (0.11, -0.46, 2.03), (0.0, -0.475, 2.04))], marble_hi)
    lid.finish()

    # --- band: a floating gold crown that turns round the stone ---------------------------------------------------------------
    band = B.part("band", (0, 0, 1.55), "body")
    band.lathe([(1.49, 0.65), (1.49, 0.71), (1.61, 0.71), (1.61, 0.65)], gold, sides=12, loop=True)
    for i in range(12):
        a = i * math.tau / 12
        length = 0.2 if i % 2 == 0 else 0.11
        cone(band, (0.71 * math.cos(a), 0.71 * math.sin(a), 1.55), ((0.71 + length) * math.cos(a), (0.71 + length) * math.sin(a), 1.55),
             0.035, gold, sides=4)
        # a dark rune block between the rays
        b = a + math.pi / 12
        plate(band, (0.715 * math.cos(b), 0.715 * math.sin(b), 1.55), (-math.sin(b), math.cos(b), 0), (math.cos(b), math.sin(b), 0),
              (0.12, 0.06, 0.035), marble_dk, taper=(0.8, 0.8), bevel=0.01)
    band.finish()
    return B


def register():
    bb.BUILD["hourstone"] = build_hourstone
