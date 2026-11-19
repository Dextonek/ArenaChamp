"""
The Eclipse Wyrm's stage add, the Cast shade, as a model (2026-11-19; the user: "lets make more models for the raid too"). Until now it was
drawn in code from a few angular pieces (`castShadeLook` in src/raid/bodies/wyrmShade.ts). A shadow thrown by the sun's last light that
stood up and walked away (docs/lore/LORE.md `### fallborn`; pipeline/designs/raid-wyrm.md): a tall, hunched, faceless figure of matte
near-black facets with a violet sheen, long thin arms to its knees ending in claws, torn violet membranes at the shoulders like the wyrm's
wings, no legs (the body frays into tatters of shadow that hover above the floor) and one pale gold eye where its beam leaves. Mythic,
never cartoon (docs/ART_BIBLE.md section 1). Matte and dark against the Roost's slate floor, so it keeps a thin rim of the Tear's
violet-pink on its spine, spars and claws, and glows little (under the game's bloom a bright glow is a white blob).

Built with the Raid bosses' toolkit (blender/bosses/boss_bodies.py, helpers from boss_wyrm.py). Faces -Y, z up, metres; about 2.3 m tall,
its eye at 1.9 m (the stage's `SHOT_Y.beam`), the tatters' lowest point 0.12 m over the floor.

Parts: castshade > body > (head > eye, armL > handL, armR > handR, memL, memR, tatters, tatters2).

    blender --background --factory-startup --python blender/raid/run.py -- castshade
"""
import math

from mathutils import Vector

import boss_bodies as bb
from boss_bodies import Boss, R, T, interp
from boss_wyrm import S, cone, panel, plate, seg

HEIGHT = 2.3  # run.py's cameras


def build_castshade():
    B = Boss("castshade", 1.0)
    sh = B.m("shade", "#0d0a16", 0.0, 0.85)
    sh_hi = B.m("shade_sheen", "#1e1633", 0.0, 0.7)
    sh_vi = B.m("shade_violet", "#2f2252", 0.0, 0.65)
    memb = B.m("memb", "#6a49c8", 0.0, 0.8, emit="#6a49c8", strength=0.12)
    rim = B.m("rim", "#b04aa0", 0.0, 0.6, emit="#b04aa0", strength=0.25)
    claw = B.m("claw", "#8d78c4", 0.0, 0.5)
    eye = B.m("eye", "#f2dc9a", 0.0, 0.4, emit="#f2dc9a", strength=1.1)

    # --- the body: a hunched torso tipped forward, narrow at the waist, broad at the shoulders; a lathe along its own tilted axis -----
    BZ = 0.72
    prof = [(0.0, 0.07), (0.15, 0.12), (0.4, 0.15), (0.65, 0.26), (0.85, 0.3), (0.95, 0.2), (1.0, 0.08)]
    body = B.part("body", (0, 0, BZ))
    body.lathe(prof, [sh, sh, sh_hi, sh, sh_hi, sh], sides=8, xf=T(0, 0, BZ) @ R(x=0.46) @ S(1.25, 0.85, 1.0), rot0=math.pi / 8)
    # facets over the chest and back: slabs of a little lighter dark, lying on the figure like torn bark
    for i, (z, w) in enumerate(((1.0, 0.2), (1.18, 0.26), (1.36, 0.28))):
        y = -0.1 - (z - BZ) * 0.48
        plate(body, (0, y - 0.1, z), (0, 0.3, 0.8), (0, -1, 0.4), (w, 0.2, 0.03), sh_hi if i % 2 else sh_vi, taper=(0.6, 0.7), bevel=0.01)
        plate(body, (0, y + 0.2, z), (0, 0.3, -0.4), (0, 1, 0.3), (w * 1.1, 0.2, 0.03), sh_hi, taper=(0.6, 0.7), bevel=0.01)
    # a ridge of thorns down the stooped back, in the rim's pink
    for i, z in enumerate((1.0, 1.2, 1.4, 1.58)):
        yb = 0.14 - (z - BZ) * 0.5
        cone(body, (0, yb, z), (0, yb + 0.2 - 0.02 * i, z + 0.1 + 0.03 * i), 0.035, rim if i % 2 else sh_vi, sides=4)
    # the shoulder blades' masses: dark, angular
    for s in (-1, 1):
        plate(body, (s * 0.3, -0.2, 1.55), (s * 0.6, 0.1, 0), (0, 0.1, 1), (0.3, 0.16, 0.09), sh_hi, taper=(0.7, 0.7), bevel=0.025)
    body.finish()

    # --- tatters: strips of shadow hanging from the waist, ragged, hovering over the floor; two groups so they stir apart -----------
    def tatters(name, ids, seed):
        t = B.part(name, (0, -0.05, 0.78), "body")
        for k in ids:
            a = k * math.tau / 14 + 0.17 * seed
            r0 = 0.15 + 0.03 * (k % 3)
            rb = r0 + 0.1 + 0.05 * (k % 2)
            L = 0.46 + 0.14 * ((k * 5) % 4) / 3.0  # 0.46 .. 0.60 below the waist
            wd = 0.065 + 0.02 * (k % 3)
            ca, sa = math.cos(a), math.sin(a)
            ta, tb = (-sa, ca), (sa, -ca)
            top = Vector((r0 * ca, -0.05 + r0 * sa * 0.8, 0.8))
            col = sh_vi if k % 4 == 0 else (sh_hi if k % 3 == 0 else sh)
            p0 = top + Vector((ta[0] * wd, ta[1] * wd, 0))
            p1 = top + Vector((tb[0] * wd, tb[1] * wd, 0))
            tip = Vector((rb * ca, -0.05 + rb * sa * 0.8, 0.8 - L))
            tip.z = max(0.14 + 0.02 * (k % 3), tip.z)
            mid = top.lerp(tip, 0.55) + Vector((ta[0] * wd * 1.3, ta[1] * wd * 1.3, 0))
            panel(t, [p0, mid, tip], col, th=0.012)
            panel(t, [p1, mid, tip], col, th=0.012)
        t.finish()

    tatters("tatters", range(0, 14, 2), 0)
    tatters("tatters2", range(1, 14, 2), 1)

    # --- the head: a bare wedge, no face, a hard brow and one gold eye sunk under it -----------------------------------------------
    HZ = 1.7
    head = B.part("head", (0, -0.42, HZ), "body")
    head.hull([(-0.11, -0.340, 1.68), (0.11, -0.340, 1.68), (-0.14, -0.260, 1.96), (0.14, -0.260, 1.96), (0, -0.320, 2.12), (0, -0.320, 2.1),
               (-0.1, -0.620, 1.98), (0.1, -0.620, 1.98), (0, -0.580, 1.77), (-0.07, -0.540, 1.76), (0.07, -0.540, 1.76), (0, -0.640, 1.88)], sh)
    # a swept crest back from the crown, like the wyrm's horns
    cone(head, (0, -0.320, 2.06), (0, 0.08, 2.2), 0.05, sh_vi, sides=4)
    for s in (-1, 1):
        cone(head, (s * 0.1, -0.320, 2.0), (s * 0.2, 0.0, 2.16), 0.03, rim, sides=4)
        # the brow: a hard ridge over the eye
        head.hull([(s * 0.0, -0.620, 1.955), (s * 0.12, -0.610, 1.97), (s * 0.12, -0.660, 1.925), (s * 0.0, -0.665, 1.92)], sh_hi)
    head.hull([(-0.1, -0.620, 1.94), (0.1, -0.620, 1.94), (0, -0.670, 1.97), (0, -0.650, 1.9)], sh)
    head.finish()
    e = B.part("eye", (0, -0.640, 1.9), "head")
    e.hull([(0, -0.615, 1.945), (0.075, -0.625, 1.9), (0, -0.640, 1.855), (-0.075, -0.625, 1.9), (0, -0.660, 1.9)], eye)
    e.finish()

    # --- arms: long and thin, to the knees, an angular elbow, claws; each hangs from a shoulder --------------------------------------
    def arm(s, n):
        shp, el, wr = Vector((s * 0.42, -0.3, 1.5)), Vector((s * 0.52, -0.4, 1.02)), Vector((s * 0.54, -0.3, 0.58))
        a = B.part("arm" + n, shp, "body")
        seg(a, shp, el, 0.07, 0.048, sh, sides=5, belly=1.05)
        seg(a, el, wr, 0.048, 0.034, sh_hi, sides=5, belly=1.0)
        cone(a, el, el + Vector((s * 0.1, 0.16, 0.0)), 0.04, rim, sides=4)  # a spur at the elbow
        a.hull([shp + Vector((s * 0.04, -0.02, 0.06)), shp + Vector((s * 0.2, 0.02, 0.0)), shp + Vector((0, 0.1, 0.05)),
                shp + Vector((s * 0.06, -0.1, -0.05)), shp + Vector((s * 0.05, 0.04, -0.12))], sh_vi)
        a.finish()
        h = B.part("hand" + n, wr, "arm" + n)
        h.hull([wr + Vector((s * dx, dy, dz)) for dx, dy, dz in ((0.04, 0.03, 0.03), (-0.04, 0.03, 0.03), (0.04, -0.03, -0.03), (-0.04, -0.03, -0.03), (0, 0, -0.14))], sh)
        # four long clawed fingers and a thumb, hooked
        for k, (dx, dy) in enumerate(((0.045, -0.025), (0.015, -0.035), (-0.015, -0.035), (-0.045, -0.02))):
            f0 = wr + Vector((s * dx, dy, -0.08))
            ln = 0.3 - 0.04 * abs(k - 1.2)
            f1 = f0 + Vector((s * dx * 0.5, -0.07, -ln * 0.85))
            f2 = f1 + Vector((s * dx * 0.2, -0.06, -0.09))
            cone(h, f0, f1, 0.018, sh_hi, sides=4)
            cone(h, f1, f2, 0.012, claw, sides=4)
        t0 = wr + Vector((-s * 0.04, -0.01, -0.06))
        cone(h, t0, t0 + Vector((-s * 0.1, -0.09, -0.13)), 0.015, claw, sides=4)
        h.finish()

    arm(1, "L")
    arm(-1, "R")

    # --- membranes: torn violet sheets spread from a spar over each shoulder, like the wyrm's wings, ragged along the edge -----------
    def membrane(s, n):
        o = Vector((s * 0.38, -0.2, 1.6))
        m = B.part("mem" + n, o, "body")
        tip = o + Vector((s * 0.7, 0.4, 0.42))
        mid = o + Vector((s * 0.5, 0.3, 0.36))
        seg(m, o, tip, 0.03, 0.012, sh_vi, sides=4)  # the spar
        # the torn sheet: fingers of membrane hanging from the spar, each its own length
        spar = [o.lerp(tip, u) for u in (0.0, 0.25, 0.5, 0.75, 1.0)]
        drops = [(-0.4, 0.0), (-0.75, 0.08), (-0.5, 0.14), (-0.62, 0.2)]
        for i in range(4):
            a0, a1 = spar[i], spar[i + 1]
            dz, dy = drops[i]
            b0 = a0 + Vector((s * 0.02, 0.1 + dy, dz * 0.6))
            b1 = a1 + Vector((s * 0.01, 0.12 + dy, dz))
            panel(m, [a0, a1, b1, b0], memb, th=0.008)
            # a ragged tooth at the lower edge, and the rim's thin line along the spar edge
            panel(m, [b0, b1, b0.lerp(b1, 0.5) + Vector((0, 0.04, -0.2))], memb, th=0.008)
        for i in range(4):
            cone(m, spar[i], spar[i + 1].lerp(spar[i], 0.1) + Vector((0, 0.04, 0.05)), 0.014, rim, sides=3)
        cone(m, mid, mid + Vector((s * 0.08, 0.1, 0.12)), 0.02, rim, sides=3)
        m.finish()

    membrane(1, "L")
    membrane(-1, "R")
    return B


def register():
    bb.BUILD["castshade"] = build_castshade
