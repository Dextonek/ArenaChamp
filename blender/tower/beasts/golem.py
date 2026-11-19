"""
The Climb's crystal golem as a model (2026-11-19; the user: "Yes, do them all"). Until now it was three grey dodecahedra stacked into a man
(`golemLook` in src/tower/world/f45/looks.ts). The Lightless Deep's caster: a hulking figure of dark basalt plates on two short thick legs,
arms long enough to hang to its knees, crystal clusters growing out of the shoulders and the back in a cold violet and cyan, one crystal
eye deep under a stone brow. Mythic and heavy, never cartoon (docs/ART_BIBLE.md §1). The glow is kept low: under the bloom a bright crystal
is a white blob.

Built with the Raid bosses' toolkit (blender/bosses/boss_bodies.py, helpers from boss_wyrm.py): rigid parts in a named hierarchy, no
armature, every part's origin the point it turns about. Faces -Y, z up, metres, feet on z = 0; about 2.1 m to the crystals' tips
(the unit draws it at its scale, 1.4).

Parts: golem > body > (head, armL > foreL > handL, armR > foreR > handR, legL, legR).

    blender --background --factory-startup --python blender/tower/beasts/run.py -- golem
"""
import math

from mathutils import Vector

import boss_bodies as bb
from boss_bodies import Boss, R, T
from boss_wyrm import S, cone, panel, plate, seg

HEIGHT = 2.1


def build_golem():
    B = Boss("golem", 2.1)
    rock = B.m("basalt", "#2c2d39", 0.0, 0.9)
    rock_lt = B.m("basalt_light", "#474a5e", 0.0, 0.88)
    seam = B.m("seam", "#15161d", 0.0, 0.95)
    cv = B.m("crystal_violet", "#7a5cff", 0.1, 0.35, emit="#5a3cd8", strength=0.6)
    cc = B.m("crystal_cyan", "#4fd0e8", 0.1, 0.35, emit="#2ea8c8", strength=0.6)
    eye = B.m("eye", "#aaf4ff", 0.0, 0.3, emit="#6ae0ff", strength=1.3)

    def crystals(part, base, specs, mats=(cv, cc)):
        """A cluster: (dx, dy, dz, length, radius) leaning out of `base`, alternating violet and cyan."""
        base = Vector(base)
        for i, (dx, dy, dz, ln, r) in enumerate(specs):
            d = Vector((dx, dy, dz)).normalized()
            cone(part, base + Vector((dx, dy, 0)) * 0.12, base + Vector((dx, dy, 0)) * 0.12 + d * ln * 0.85, r * 1.7, mats[i % 2], sides=6)

    # --- the body: a deep chest and wide shoulders over a narrow waist, a hump on the back --------------------------------
    body = B.part("body", (0, 0, 0.75))
    body.hull([(sx * hw, sy * hd, z) for (hw, hd, z) in ((0.3, 0.2, 0.74), (0.42, 0.28, 1.05), (0.56, 0.36, 1.3), (0.46, 0.27, 1.5))
               for sx in (-1, 1) for sy in (-1, 1)], rock)
    body.hull([(sx * 0.36, y, z) for sx in (-1, 1) for (y, z) in ((0.15, 0.95), (0.4, 1.05), (0.3, 1.42), (0.12, 1.5))], rock)
    for sx in (-1, 1):
        body.rock((sx * 0.55, 0.0, 1.4), (0.2, 0.26, 0.17), rock_lt, n=14, rough=0.15)
    body.chunk((0.7, 0.44, 0.14), seam, xf=T(0, 0, 0.78), bevel=0.04)
    # basalt plates down the chest and belly, overlapping like shingles; lighter on top, dark seams between
    for i, (z, w) in enumerate(((1.32, 0.46), (1.14, 0.42), (0.96, 0.36), (0.82, 0.3))):
        plate(body, (0, -0.31 + i * 0.015, z), (1, 0, 0), (0, -1, 0.35), (w, 0.2, 0.05), rock_lt if i < 2 else rock, taper=(0.85, 0.8), bevel=0.03)
    for s in (-1, 1):
        plate(body, (s * 0.31, -0.3, 1.2), (0.3, -0.1, 1), (s * 0.5, -1, 0.3), (0.18, 0.34, 0.05), rock_lt, taper=(0.8, 0.8), bevel=0.03)
        for z in (0.95, 1.2, 1.42):
            plate(body, (s * 0.36, 0.2, z), (1, 0, 0), (s * 0.3, 1, 0.3), (0.28, 0.2, 0.05), rock_lt if z > 1.3 else rock, taper=(0.8, 0.8), bevel=0.03)
    for z in (1.0, 1.2, 1.38):
        plate(body, (0, 0.36, z - 0.02), (1, 0, 0), (0, 1, 0.15), (0.4 - (z - 1.0) * 0.2, 0.22, 0.05), rock_lt, taper=(0.8, 0.8), bevel=0.03)
    # the back's crystals: a cluster from the hump, tall in the middle and fanned to the sides
    crystals(body, (0, 0.3, 1.3), [(0, 0.35, 1, 0.75, 0.075), (-0.5, 0.3, 1, 0.55, 0.06), (0.55, 0.3, 1, 0.5, 0.06), (-0.9, 0.5, 1, 0.38, 0.05),
                                   (0.9, 0.4, 1, 0.36, 0.05), (0.15, 0.95, 0.5, 0.4, 0.055), (-0.4, 0.9, 0.5, 0.32, 0.045)])
    body.finish()

    # --- the head: a heavy block sunk between the shoulders, a stone brow over one crystal eye ----------------------------
    head = B.part("head", (0, -0.08, 1.5), "body")
    head.hull([(sx * hw, y, z) for (hw, y, z) in ((0.24, -0.04, 1.44), (0.26, -0.04, 1.76), (0.29, -0.26, 1.46), (0.31, -0.3, 1.72), (0.18, -0.36, 1.44),
                                                   (0.2, -0.38, 1.62)) for sx in (-1, 1)], rock)
    head.hull([(sx * hw, y, z) for (hw, y, z) in ((0.29, -0.24, 1.66), (0.3, -0.42, 1.64), (0.22, -0.44, 1.7), (0.27, -0.1, 1.76)) for sx in (-1, 1)]
              + [(sx * 0.05, -0.4, 1.76) for sx in (-1, 1)], rock_lt)
    head.hull([(sx * hw, y, z) for (hw, y, z) in ((0.17, -0.3, 1.45), (0.19, -0.38, 1.47), (0.12, -0.4, 1.43)) for sx in (-1, 1)], seam)
    head.hull([(0, -0.405, 1.5), (0.1, -0.39, 1.56), (0, -0.405, 1.62), (-0.1, -0.39, 1.56), (0, -0.34, 1.56)], eye)
    crystals(head, (0, -0.02, 1.7), [(-0.5, 0.5, 1, 0.34, 0.045), (0.5, 0.45, 1, 0.3, 0.04), (0, 0.6, 1, 0.42, 0.05)])
    head.finish()

    # --- arms: long, hanging to the knees; a pauldron with crystals, plates on the arm, a great fist ----------------------
    for s, n in ((1, "L"), (-1, "R")):
        sh = Vector((s * 0.68, 0.0, 1.36))
        el = Vector((s * 0.78, -0.07, 0.92))
        wr = Vector((s * 0.8, -0.14, 0.56))
        arm = B.part("arm" + n, sh, "body")
        seg(arm, sh + Vector((0, 0, 0.05)), el, 0.17, 0.14, rock, sides=7, belly=1.1)
        arm.rock((s * 0.7, 0.0, 1.43), (0.27, 0.25, 0.19), rock_lt, n=16, rough=0.18)
        plate(arm, (s * 0.78, -0.1, 1.1), (0, 0, 1), (s, -0.3, 0), (0.16, 0.26, 0.05), rock_lt, taper=(0.8, 0.8), bevel=0.03)
        crystals(arm, (s * 0.72, 0.0, 1.55), [(s * 0.6, 0, 1, 0.55, 0.07), (s * 0.15, 0.3, 1, 0.6, 0.065), (s * 1.0, -0.2, 0.8, 0.38, 0.05),
                                              (-s * 0.1, -0.45, 0.9, 0.34, 0.045)])
        arm.finish()
        fore = B.part("fore" + n, el, "arm" + n)
        seg(fore, el, wr, 0.15, 0.18, rock, sides=7, belly=1.12)
        plate(fore, el.lerp(wr, 0.45) + Vector((0, -0.12, 0)), (0, 0, 1), (0, -1, 0), (0.2, 0.24, 0.06), rock_lt, taper=(0.85, 0.8), bevel=0.03)
        fore.finish()
        hand = B.part("hand" + n, wr, "fore" + n)
        hand.chunk((0.32, 0.3, 0.3), rock, xf=T(wr.x, wr.y - 0.02, wr.z - 0.14), bevel=0.06, taper=(1.1, 1.0))
        for k in (-1, 0, 1):
            hand.chunk((0.09, 0.08, 0.1), rock_lt, xf=T(wr.x + k * 0.1, wr.y - 0.18, wr.z - 0.1), bevel=0.02)
        hand.finish()

    # --- legs: short and thick, a stone greave, a broad foot ----------------------------------------------------------------
    for s, n in ((1, "L"), (-1, "R")):
        hip = Vector((s * 0.26, 0.0, 0.8))
        kn = Vector((s * 0.29, -0.07, 0.43))
        an = Vector((s * 0.29, -0.03, 0.14))
        leg = B.part("leg" + n, hip, "body")
        seg(leg, hip, kn, 0.21, 0.19, rock, sides=7, belly=1.12)
        seg(leg, kn, an, 0.18, 0.2, rock, sides=7, belly=1.05)
        leg.rock((kn.x, kn.y - 0.1, kn.z), (0.17, 0.14, 0.15), rock_lt, n=14, rough=0.15)
        plate(leg, kn.lerp(an, 0.5) + Vector((0, -0.17, 0)), (0, 0, 1), (0, -1, 0), (0.2, 0.22, 0.06), rock_lt, taper=(0.85, 0.8), bevel=0.03)
        leg.chunk((0.38, 0.54, 0.16), seam, xf=T(an.x, -0.12, 0.08), bevel=0.05, taper=(0.8, 0.8))
        leg.chunk((0.3, 0.2, 0.1), rock_lt, xf=T(an.x, -0.3, 0.1), bevel=0.04, taper=(0.8, 0.7))
        leg.finish()
    return B


def register():
    bb.BUILD["golem"] = build_golem
