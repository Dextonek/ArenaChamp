"""
The Climb's bark hound as a model (2026-11-19; the user: "lets make more models even for the tower"). Until now it was drawn in code
(`hound` in src/tower/world/looksWild.ts): a few cylinders and cones. The Walking Wood's pack hunter: a lean wolf whose hide grew into
bark, moss in the seams of its plates, a mane of leaves lying down its neck and over its shoulders, amber
eyes, a brush of a tail in leaves. Mythic and lean, never cartoon (docs/ART_BIBLE.md §1; the creatures' lesson in CLAUDE.md: lean and
angular, the eyes sunk under a hard brow).

Built with the Raid bosses' toolkit (blender/bosses/boss_bodies.py, and the wyrm's helpers in boss_wyrm.py): rigid parts in a named
hierarchy, no armature, every part's origin the point it turns about, flat facets, a few materials. The game poses it in code.
Faces -Y, z up, metres; about 1.9 m from nose to tail tip, 0.72 m at the shoulder (the unit draws it at its scale, 1.2).

Parts: hound > body > (neck > head > jaw), legFL > footFL, legFR > footFR, legBL > footBL, legBR > footBR, tail1 > tail2.

    blender --background --factory-startup --python blender/tower/beasts/run.py -- hound
"""
import math

from mathutils import Vector

import boss_bodies as bb
from boss_bodies import Boss, R, T, _limb_xf, interp
from boss_wyrm import S, cone, panel, plate, seg


def build_hound():
    B = Boss("hound", 1.0)
    bark = B.m("bark", "#4e3420", 0.0, 0.9)
    bark_dk = B.m("bark_dark", "#2e1e14", 0.0, 0.92)
    moss = B.m("moss", "#55702c", 0.0, 0.95)
    leaf = B.m("leaf", "#8fae3e", 0.0, 0.8)
    leaf_gold = B.m("leaf_gold", "#c79a3a", 0.0, 0.75)
    bone = B.m("bone", "#cfc2a4", 0.0, 0.7)
    claw = B.m("claw", "#1e1610", 0.05, 0.6)
    eye = B.m("eye", "#ffc060", 0.0, 0.4, emit="#ffb040", strength=1.6)

    # --- the body: a deep chest, a tucked waist, lean hips; a lathe along its length (local z -> world +y) -------------------
    BZ = 0.58
    prof = [(-0.47, 0.06), (-0.42, 0.17), (-0.3, 0.235), (-0.14, 0.225), (0.04, 0.165), (0.22, 0.17), (0.38, 0.16), (0.47, 0.08)]
    body = B.part("body", (0, 0, BZ))
    body.lathe(prof, [bark_dk, bark, bark, bark, bark, bark, bark_dk], sides=10, xf=T(0, 0, BZ) @ R(x=-math.pi / 2) @ S(0.95, 1.22, 1.0),
               rot0=math.pi / 10)

    def r_at(y):
        return interp(prof, y)

    # bark plates down the back and over the shoulders and hips, overlapping like scales; moss shows in the seams between
    # (small shingles that lie on the hide: big blocks read as bags strapped to it)
    for i in range(9):
        y = -0.4 + i * 0.1
        top = BZ + r_at(y) * 1.2
        plate(body, (0, y, top - 0.012), (0, 1, 0.1), (0, -0.1, 1), (0.13 - abs(i - 3) * 0.006, 0.11, 0.022), bark_dk, taper=(0.65, 0.8),
              bevel=0.008)
        for s in (-1, 1):
            for j, (lift, out) in enumerate(((0.06, 0.62), (0.13, 0.86))):
                if (i + j) % 2:
                    continue
                plate(body, (s * r_at(y) * out * 0.95, y + 0.02, top - lift - 0.02), (0, 1, 0), (s, 0, 1.4 - j), (0.09, 0.08, 0.018), bark_dk,
                      taper=(0.7, 0.8), bevel=0.006)
    # the ruff: leaves fanning back from the nape over the shoulders, green going gold at the tips
    for i in range(5):
        y = -0.46 + i * 0.07
        top = BZ + r_at(max(-0.42, y)) * 1.2 + 0.02
        for s in (-1, 0, 1):
            a = s * 0.75
            base = Vector((math.sin(a) * 0.08, y, top - 0.02 * abs(s)))
            tip = base + Vector((math.sin(a) * 0.12, 0.2 + 0.02 * i, 0.05 - 0.012 * i))
            side = Vector((math.cos(a) * 0.05, 0, -math.sin(a) * 0.05))
            panel(body, [base - side, base + side, tip], leaf_gold if (i == 4 and s == 0) else leaf, th=0.012)
    # belly: moss under the chest
    plate(body, (0, -0.24, BZ - r_at(-0.24) * 1.15), (0, 1, 0), (0, 0, -1), (0.2, 0.3, 0.05), moss, taper=(0.8, 0.85))
    body.finish()

    # --- neck and head: a long wolf's skull, the eyes sunk under a hard brow, ears and two twig horns swept back --------------
    n0, n1 = Vector((0, -0.4, 0.68)), Vector((0, -0.6, 0.8))
    neck = B.part("neck", n0, "body")
    seg(neck, n0, n1 + (n1 - n0) * 0.15, 0.15, 0.115, bark, sides=8, belly=1.05)
    for k in range(3):
        c = n0.lerp(n1, 0.2 + 0.3 * k)
        plate(neck, c + Vector((0, 0.02, 0.11)), (n1 - n0), (0, -0.4, 1), (0.16, 0.1, 0.035), bark_dk, taper=(0.7, 0.85))
        for s in (-1, 1):
            panel(neck, [c + Vector((s * 0.05, 0.02, 0.1)), c + Vector((s * 0.11, 0.05, 0.05)), c + Vector((s * 0.15, 0.19, 0.07))], leaf, th=0.01)
    neck.finish()

    hp = Vector((0, -0.66, 0.84))
    head = B.part("head", hp, "neck")
    skull = []
    for sx in (-1, 1):
        skull += [(sx * 0.105, -0.6, 0.79), (sx * 0.1, -0.6, 0.92), (sx * 0.115, -0.72, 0.8), (sx * 0.09, -0.74, 0.93),
                  (sx * 0.06, -0.86, 0.79), (sx * 0.05, -0.86, 0.86), (sx * 0.035, -1.0, 0.78), (sx * 0.03, -0.99, 0.82)]
    head.hull(skull, bark)
    # the brow: a hard ridge over each eye, the eye an amber slit under it
    for s in (-1, 1):
        head.hull([(s * 0.05, -0.73, 0.925), (s * 0.115, -0.71, 0.915), (s * 0.11, -0.79, 0.895), (s * 0.05, -0.8, 0.9),
                   (s * 0.06, -0.74, 0.95), (s * 0.1, -0.73, 0.94)], bark_dk)
        head.hull([(s * 0.075, -0.77, 0.875), (s * 0.112, -0.745, 0.88), (s * 0.108, -0.76, 0.862), (s * 0.072, -0.785, 0.86),
                   (s * 0.09, -0.77, 0.868)], eye)
        # ears, tall and pointed, laid a little back
        cone(head, (s * 0.075, -0.64, 0.9), (s * 0.115, -0.55, 1.0), 0.042, bark_dk, sides=4)
    # the nose, dark, at the snout's tip
    head.hull([(sx * 0.028, y, z) for sx in (-1, 1) for (y, z) in ((-0.985, 0.795), (-1.005, 0.81), (-0.975, 0.825))], claw)
    # upper teeth along the jaw line
    for i in range(4):
        y = -0.8 - i * 0.045
        for s in (-1, 1):
            cone(head, (s * (0.045 - i * 0.004), y, 0.785), (s * (0.043 - i * 0.004), y - 0.005, 0.755), 0.009, bone, sides=4)
    head.finish()

    jaw = B.part("jaw", Vector((0, -0.66, 0.78)), "head")
    jp = []
    for sx in (-1, 1):
        jp += [(sx * 0.08, -0.64, 0.79), (sx * 0.075, -0.66, 0.73), (sx * 0.04, -0.94, 0.77), (sx * 0.03, -0.95, 0.745)]
    jaw.hull(jp, bark_dk)
    for i in range(3):
        y = -0.84 - i * 0.04
        for s in (-1, 1):
            cone(jaw, (s * 0.035, y, 0.765), (s * 0.034, y, 0.79), 0.008, bone, sides=4)
    jaw.finish()

    # --- legs: upper and lower, a joint each; long and lean; bark greaves, dark claws --------------------------------------
    def leg(name, hip, knee, ankle, paw_y, front):
        up = B.part("leg" + name, hip, "body")
        seg(up, hip, knee, 0.075 if front else 0.09, 0.05, bark, sides=7, belly=1.15)
        plate(up, hip.lerp(knee, 0.4) + Vector((math.copysign(0.04, hip.x), 0, 0)), (knee - hip), (math.copysign(1, hip.x), 0, 0.2),
              (0.08, 0.13, 0.03), bark_dk)
        up.finish()
        lo = B.part("foot" + name, knee, "leg" + name)
        seg(lo, knee, ankle, 0.045, 0.034, bark, sides=6, belly=1.05)
        foot = Vector((ankle.x, paw_y, 0.03))
        seg(lo, ankle, foot, 0.036, 0.04, bark_dk, sides=6)
        lo.chunk((0.085, 0.11, 0.05), bark_dk, xf=T(foot.x, foot.y - 0.025, 0.025), bevel=0.012, taper=(0.75, 0.7))
        for k in (-1, 0, 1):
            cone(lo, (foot.x + k * 0.025, foot.y - 0.07, 0.02), (foot.x + k * 0.028, foot.y - 0.115, 0.004), 0.011, claw, sides=4)
        lo.finish()

    for s, n in ((1, "L"), (-1, "R")):
        x = s * 0.13
        leg("F" + n, Vector((x, -0.3, 0.56)), Vector((x * 1.05, -0.27, 0.32)), Vector((x * 1.05, -0.3, 0.1)), -0.33, True)
        leg("B" + n, Vector((x, 0.33, 0.56)), Vector((x * 1.05, 0.44, 0.33)), Vector((x * 1.02, 0.47, 0.13)), 0.42, False)

    # --- tail: two pieces, a brush of leaves -------------------------------------------------------------------------------
    t0, t1, t2 = Vector((0, 0.45, 0.62)), Vector((0, 0.66, 0.5)), Vector((0, 0.86, 0.27))
    tail1 = B.part("tail1", t0, "body")
    seg(tail1, t0, t1 + (t1 - t0) * 0.1, 0.06, 0.05, bark, sides=6)
    tail1.finish()
    tail2 = B.part("tail2", t1, "tail1")
    seg(tail2, t1, t2, 0.05, 0.02, bark_dk, sides=6)
    for i in range(7):
        c = t1.lerp(t2, 0.1 + 0.13 * i)
        for s in (-1, 1):
            tip = c + Vector((s * (0.09 - 0.006 * i), 0.07, -0.02 - 0.01 * i))
            panel(tail2, [c + Vector((0, -0.02, 0.015)), c + Vector((0, 0.03, -0.01)), tip], leaf_gold if i > 4 else leaf, th=0.01)
    tail2.finish()
    return B


def register():
    bb.BUILD["hound"] = build_hound
