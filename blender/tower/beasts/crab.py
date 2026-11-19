"""
The Climb's brine crab as a model (2026-11-19; "lets make more models even for the tower", "Yes, do them all"). Until now it was drawn in
code (`crabLook` in src/tower/world/looks.ts): a squashed sphere, a torus and some cones. The Drowned Coast's brute: a big shore crab of
the drowned harbour, its carapace dark sea-green and crusted with barnacles, a little weed trailing from its rim, rust-red claws, pale cold
eyes on stalks under a hard brow. One claw is a crusher, the other a small pincer; eight walking legs in four pairs, each with a knee that
stands high over the shell. Mythic and heavy, never cartoon (docs/ART_BIBLE.md §1).

Built with the Raid bosses' toolkit (blender/bosses/boss_bodies.py, the wyrm's helpers in boss_wyrm.py): rigid parts in a named
hierarchy, no armature, every part's origin the point it turns about, flat facets, a few materials. The game poses it in code.
Faces -Y, z up, metres; about 1.5 m across the legs, 0.8 m nose to rear, 0.52 m over the shell (the unit draws it at its scale, 1.4).
Its left is +x; the crusher is the RIGHT claw (-x).

Parts: crab > body > (eyeL, eyeR, armL > clawL > pinchL, armR > clawR > pinchR, legL1..legL4 > tipL1..tipL4, legR1..legR4 > tipR1..tipR4).

    blender --background --factory-startup --python blender/tower/beasts/run.py -- crab
"""
import math
import random

from mathutils import Vector

import boss_bodies as bb
from boss_bodies import Boss, R, T, interp
from boss_wyrm import S, cone, panel, plate, seg

HEIGHT = 1.0


def build_crab():
    B = Boss("crab", 1.0)
    rng = random.Random(11)
    shell = B.m("shell", "#2f4d44", 0.0, 0.85)
    shell_dk = B.m("shell_dark", "#1b2f2b", 0.0, 0.9)
    rust = B.m("rust", "#92401f", 0.0, 0.8)
    rust_dk = B.m("rust_dark", "#5e2814", 0.0, 0.85)
    barn = B.m("barnacle", "#b8b29c", 0.0, 0.9)
    weed = B.m("weed", "#41622c", 0.0, 0.9)
    bone = B.m("bone", "#d6ceb4", 0.0, 0.7)
    eye_dk = B.m("eye_dark", "#0f1a1c", 0.0, 0.5)
    eye = B.m("eye", "#d4eef4", 0.0, 0.4, emit="#8cc8dc", strength=0.5)


    BZ = 0.35
    # --- the carapace: wide and low, a toothed front rim, a shallow dome, knobbly ridges ---------------------------------------
    outline = [(0, -0.34), (0.2, -0.33), (0.38, -0.22), (0.52, -0.06), (0.52, 0.1), (0.42, 0.27), (0.25, 0.36), (0, 0.38)]
    body = B.part("body", (0, 0, BZ))
    pts = []
    for sx in (-1, 1):
        for (x, y) in outline:
            if x == 0 and sx == 1:
                continue
            pts.append((sx * x * 0.95, y * 0.95, 0.28))
            pts.append((sx * x, y, 0.39))
            pts.append((sx * x * 0.62, y * 0.62, 0.52))
    body.hull(pts, shell)
    # a belly plate and a darker lip round the rim
    body.hull([(sx * x * 0.9, y * 0.9, z) for sx in (-1, 1) for (x, y) in outline for z in (0.25, 0.31)], shell_dk)

    def top(x, y):
        k = max(0.0, 1 - (x / 0.5) ** 2 - (y / 0.36) ** 2)
        return 0.38 + 0.14 * math.sqrt(k)

    # knobbly ridges across the back, rust, each a plate with a knob at its ends
    for y, w in ((-0.1, 0.22), (0.07, 0.26), (0.23, 0.2)):
        for sx in (-1, 1):
            zc = top(sx * w, y)
            plate(body, (sx * w * 0.9, y, zc - 0.005), (sx, 0, 0), (0, 0.1, 1), (w, 0.07, 0.05), rust_dk, taper=(0.9, 0.7), bevel=0.014)
            body.rock(Vector((sx * w * 1.5, y, top(sx * w * 1.5, y) - 0.005)), (0.038, 0.038, 0.032), rust_dk, n=10, rough=0.15)
    # front-edge teeth, three a side, and a low brow ridge between the eyes
    for sx in (-1, 1):
        for (x, y) in ((0.2, -0.33), (0.32, -0.27), (0.43, -0.17)):
            cone(body, (sx * x, y, 0.35), (sx * (x + 0.05), y - 0.07, 0.37), 0.038, shell_dk, sides=4)
    plate(body, (0, -0.33, 0.4), (1, 0, 0), (0, -0.2, 1), (0.26, 0.05, 0.05), shell_dk, taper=(0.85, 0.8), bevel=0.015)
    # barnacles: crowded in clusters of cones, each its own height
    spots = []
    for cx, cy, n in ((0.18, 0.1, 6), (-0.22, 0.2, 5), (0.03, -0.03, 4), (-0.32, -0.05, 4), (0.35, 0.0, 3), (0.0, 0.28, 4)):
        for _ in range(n):
            spots.append((cx + rng.uniform(-0.09, 0.09), cy + rng.uniform(-0.07, 0.07)))
    for x, y in spots:
        if (x / 0.5) ** 2 + (y / 0.36) ** 2 > 0.75:
            continue
        r = rng.uniform(0.02, 0.04)
        h = rng.uniform(0.03, 0.07)
        z = top(x, y) - 0.01
        cone(body, (x, y, z), (x + rng.uniform(-0.01, 0.01), y, z + h), r, barn, sides=5)
    # weed trailing from the rim at the back
    for i in range(6):
        a = -0.8 + i * 0.32
        x, y = math.sin(a) * 0.36, 0.26 + math.cos(a) * 0.08
        base = Vector((x, y, 0.37))
        tip = base + Vector((math.sin(a) * 0.07, 0.17 + 0.03 * (i % 2), -0.1))
        panel(body, [base - Vector((0.025, 0, 0)), base + Vector((0.025, 0, 0)), tip], weed, th=0.007)
    body.finish()

    # --- eyes: a short stalk, a small dark eye with a cold pale glint, a low brow ---------------------------------------------
    for s, n in ((1, "L"), (-1, "R")):
        b0 = Vector((s * 0.13, -0.29, 0.46))
        b1 = Vector((s * 0.15, -0.33, 0.54))
        e = B.part("eye" + n, b0, "body")
        seg(e, b0, b1, 0.024, 0.02, shell_dk, sides=5)
        e.rock(b1 + Vector((0, -0.005, 0.015)), (0.04, 0.04, 0.04), eye_dk, n=12, rough=0.04)
        e.rock(b1 + Vector((s * 0.008, -0.034, 0.03)), (0.015, 0.012, 0.015), eye, n=8, rough=0.02)
        e.hull([(s * 0.1, -0.335, 0.575), (s * 0.19, -0.325, 0.57), (s * 0.19, -0.365, 0.55), (s * 0.1, -0.37, 0.555),
                (s * 0.11, -0.32, 0.59), (s * 0.18, -0.32, 0.585)], shell_dk)
        e.finish()

    # --- claws: a crusher (right) and a pincer (left): upper arm, a hand with its fixed finger, the moving finger ----------
    # --- claws: a crusher (right) and a pincer (left): upper arm, a hand with its fixed finger, the moving finger ----------
    def claw(n, s, k, elbow, palm, spread):
        shoulder = Vector((s * 0.4, -0.26, 0.4))
        arm = B.part("arm" + n, shoulder, "body")
        seg(arm, shoulder, elbow + (elbow - shoulder) * 0.1, 0.1 * k ** 0.5, 0.085 * k ** 0.5, rust_dk, sides=6)
        arm.rock(shoulder, (0.1 * k ** 0.5,) * 3, shell_dk, n=10, rough=0.05)
        arm.finish()

        hand = B.part("claw" + n, elbow, "arm" + n)
        d = (Vector((-s * 0.3, -1.0, 0)).normalized())
        out = Vector((s, 0, 0))
        out = (out - d * out.dot(d)).normalized()  # outward, square to the finger
        up = Vector((0, 0, 1))
        c = Vector(palm)
        seg(hand, elbow, c - d * 0.1, 0.07 * k ** 0.5, 0.1 * k ** 0.5, rust_dk, sides=6)
        hand.rock(c, (0.17 * k, 0.25 * k, 0.14 * k), rust, n=18, rough=0.06, rot=None, xf=None)
        # the palm's ridges and a few barnacles
        for i in range(3):
            hand.hull([c + out * (0.04 + 0.05 * i) * k + up * 0.12 * k + d * (-0.1 + 0.08 * i) * k,
                       c + out * (0.02 + 0.05 * i) * k + up * 0.17 * k + d * (-0.05 + 0.08 * i) * k,
                       c + out * (0.06 + 0.05 * i) * k + up * 0.12 * k + d * (0.0 + 0.08 * i) * k], rust_dk)
        for i in range(3 if k > 0.8 else 1):
            p0 = c + up * 0.12 * k + out * rng.uniform(-0.08, 0.1) * k + d * rng.uniform(-0.12, 0.05) * k
            cone(hand, p0, p0 + up * 0.06, 0.035 * k, barn, sides=5)
        # the fixed finger, outer side
        fb = c + d * 0.2 * k + out * 0.08 * k
        ft = c + d * 0.62 * k - out * 0.02 * k
        fm = c + d * 0.42 * k + out * 0.1 * k

        def finger(part, base, mid, tip, wb, m, lowz=0.0):
            side = up.cross((tip - base).normalized()).normalized()
            hp = []
            for sd in (-1, 1):
                for sz in (-1, 1):
                    hp.append(base + side * sd * wb + up * sz * wb * 0.9)
                    hp.append(mid + side * sd * wb * 0.8 + up * sz * wb * 0.75)
            hp.append(tip)
            part.hull(hp, m)

        finger(hand, fb, fm, ft, 0.07 * k, rust)
        # teeth on the inner edge
        for i in range(3 if k > 0.8 else 2):
            q = fb.lerp(ft, 0.3 + 0.25 * i) - out * 0.045 * k
            cone(hand, q, q - out * 0.05 * k + d * 0.02, 0.022 * k, bone, sides=4)
        hand.finish()

        # the moving finger: pivot at the inner base of the hand
        pb = c + d * 0.18 * k - out * 0.08 * k
        pin = B.part("pinch" + n, pb, "claw" + n)
        pt = c + d * 0.6 * k + out * (0.05 - spread) * k
        pm = c + d * 0.4 * k - out * 0.13 * k
        finger(pin, pb + d * 0.02 * k, pm, pt, 0.065 * k, rust)
        for i in range(3 if k > 0.8 else 2):
            q = pb.lerp(pt, 0.3 + 0.22 * i) + out * 0.04 * k
            cone(pin, q, q + out * 0.05 * k + d * 0.02, 0.02 * k, bone, sides=4)
        pin.finish()

    # right: the crusher, big, held forward; left: a small pincer

    # right: the crusher, big, held forward; left: a small pincer
    claw("R", -1, 0.75, Vector((-0.6, -0.42, 0.46)), Vector((-0.4, -0.72, 0.36)), 0.0)
    claw("L", 1, 0.45, Vector((0.52, -0.42, 0.44)), Vector((0.35, -0.66, 0.34)), 0.0)

    # --- legs: eight, in four pairs, splayed out to the sides: up and out to a knee, then down to a point; rust at the joints ----
    ys = [-0.2, -0.07, 0.07, 0.2]
    knee_dy = [-0.06, -0.01, 0.04, 0.09]
    tip_dy = [-0.2, -0.09, 0.08, 0.22]
    for s, n in ((1, "L"), (-1, "R")):
        for i in range(4):
            hip = Vector((s * 0.38, ys[i], 0.34))
            knee = Vector((s * 0.64, ys[i] + knee_dy[i], 0.46 - 0.01 * i))
            tip = Vector((s * (0.76 - 0.02 * i), ys[i] + tip_dy[i], 0.0))
            up_ = B.part(f"leg{n}{i + 1}", hip, "body")
            seg(up_, hip, knee + (knee - hip) * 0.06, 0.06, 0.052, shell, sides=6, belly=1.1)
            up_.rock(knee, (0.062, 0.062, 0.062), rust_dk, n=10, rough=0.05)
            cone(up_, knee + Vector((0, 0, 0.03)), knee + Vector((0, 0, 0.11)), 0.022, shell_dk, sides=4)
            up_.finish()
            lo = B.part(f"tip{n}{i + 1}", knee, f"leg{n}{i + 1}")
            seg(lo, knee, tip, 0.06, 0.02, shell, sides=5, belly=1.0)
            cone(lo, tip + Vector((0, 0, 0.05)), tip - Vector((0, 0, 0.005)), 0.02, shell_dk, sides=4)
            lo.finish()
    return B


def register():
    bb.BUILD["crab"] = build_crab
