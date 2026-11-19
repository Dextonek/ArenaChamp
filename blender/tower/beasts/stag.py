"""
The Stag-Crowned as a model (2026-11-19; the user: "Yes, do them all"). Until now a gold-and-bark figure with a spear (`stag` in
src/tower/world/looksWild.ts). Now what its name says: an old great stag of the Walking Wood, a forest spirit more than an animal. A
powerful deer's body whose hide turns to bark on the legs and flanks, moss on the back, a mane of hanging lichen at the throat, and a
great crown of many-tined antlers, faintly gold along the tines (a low glow: under the game's bloom a bright one is a white blob).
Mythic and lean, never cartoon (docs/ART_BIBLE.md section 1).

Built with the Raid bosses' toolkit (blender/bosses/boss_bodies.py, helpers from boss_wyrm.py). Faces -Y, z up, metres, hooves on z = 0;
about 0.75 m at the shoulder, 2.2 m to the antlers' tips (the unit draws it at its scale, 1.9).

Parts: stag > body > (neck > head > (jaw)), legFL > footFL, legFR > footFR, legBL > footBL, legBR > footBR, tail. The antlers are
part of the head (they turn with it).

    blender --background --factory-startup --python blender/tower/beasts/run.py -- stag
"""
import math

from mathutils import Vector

import boss_bodies as bb
from boss_bodies import Boss, R, T, interp
from boss_wyrm import S, cone, panel, plate, seg

HEIGHT = 1.25  # run.py's cameras
K = 0.7  # everything below is drawn at a shoulder height of 1.05 and scaled by this


def V(x, y, z):
    return Vector((x * K, y * K, z * K))


def sg(part, p0, p1, r0, r1, m, **kw):
    seg(part, V(*p0), V(*p1), r0 * K, r1 * K, m, **kw)


def cn(part, b, t, r, m, **kw):
    cone(part, V(*b), V(*t), r * K, m, **kw)


def pl(part, c, along, up, size, m, bevel=0.03, **kw):
    plate(part, V(*c), along, up, [s * K for s in size], m, bevel=bevel * K, **kw)


def pn(part, pts, m, th=0.012):
    panel(part, [V(*p) for p in pts], m, th * K)


def hl(part, pts, m):
    part.hull([V(*p) for p in pts], m)


def build_stag():
    B = Boss("stag", 1.0)
    hide = B.m("hide", "#6e4a2a", 0.0, 0.9)
    hide_lt = B.m("hide_light", "#7e5d38", 0.0, 0.9)
    bark = B.m("bark", "#4a3322", 0.0, 0.92)
    bark_dk = B.m("bark_dark", "#2c1d13", 0.0, 0.94)
    moss = B.m("moss", "#566f2c", 0.0, 0.95)
    lichen = B.m("lichen", "#a3b58c", 0.0, 0.9)
    horn = B.m("antler", "#cdbb8c", 0.0, 0.7)
    gold = B.m("antler_gold", "#e0b04a", 0.0, 0.5, emit="#c08a20", strength=1.0)
    hoof = B.m("hoof", "#1c1510", 0.05, 0.6)
    eye = B.m("eye", "#ffc060", 0.0, 0.4, emit="#ffb040", strength=1.4)

    # --- the body: a deep chest, a tucked waist, strong hips; a lathe along its length (local z -> world +y) -------------------
    BZ = 1.02
    prof = [(-0.62, 0.08), (-0.55, 0.2), (-0.4, 0.3), (-0.15, 0.335), (0.1, 0.29), (0.35, 0.3), (0.62, 0.26), (0.78, 0.1)]
    body = B.part("body", V(0, 0, BZ))
    body.lathe([(y * K, r * K) for y, r in prof], [bark_dk, hide, hide, hide, hide, hide, bark_dk], sides=12,
               xf=T(0, 0, BZ * K) @ R(x=-math.pi / 2) @ S(0.85, 1.18, 1.0), rot0=math.pi / 10)

    def r_at(y):
        return interp(prof, y)

    def top(y):
        return BZ + r_at(y) * 1.18

    # shingles of bark lying on the hide, small and overlapping like the bark hound's, in the hide's own browns; the moss only as thin
    # strips in a few of the seams, and a ridge down the spine
    for i in range(11):
        y = -0.4 + i * 0.1
        rr = r_at(y)
        pl(body, (0, y, top(y) - 0.012), (0, 1, 0.1), (0, -0.1, 1), (0.1, 0.1, 0.02), bark, taper=(0.65, 0.8), bevel=0.008)
        for s in (-1, 1):
            for j, ph in enumerate((0.2, 0.62, 1.0)):
                if (i + j) % 2:
                    continue
                c = (s * rr * 0.85 * math.cos(ph) * 1.02, y + 0.02 * j, BZ + rr * 1.18 * math.sin(ph) * 1.02 - 0.02)
                nrm = (s * math.cos(ph) / 0.85, -0.12, math.sin(ph) / 1.18)
                pl(body, c, (0, 1, 0), nrm, (0.08, 0.1, 0.018), (bark, hide_lt, hide)[(i + j) % 3], taper=(0.7, 0.8), bevel=0.006)
            if i % 4 == 1:
                ph = 0.4
                c = (s * rr * 0.85 * math.cos(ph) * 1.0, y + 0.05, BZ + rr * 1.18 * math.sin(ph) * 1.0 - 0.02)
                pl(body, c, (0, 1, 0.2), (s * math.cos(ph) / 0.85, 0, math.sin(ph) / 1.18), (0.025, 0.16, 0.012), moss, bevel=0.004)
    body.finish()

    # --- neck: long, with a mane of hanging lichen under the throat ---------------------------------------------------------
    n0, n1 = Vector((0, -0.5, 1.28)), Vector((0, -0.9, 1.78))
    neck = B.part("neck", V(*n0), "body")
    sg(neck, tuple(n0), tuple(n1 + (n1 - n0) * 0.08), 0.27, 0.15, hide, sides=9, belly=1.0)
    for k in range(4):
        c = n0.lerp(n1, 0.1 + 0.25 * k)
        pl(neck, (c.x, c.y + 0.015, c.z + 0.12), tuple(n1 - n0), (0, -0.5, 1), (0.14, 0.14, 0.03), bark_dk, taper=(0.7, 0.85))
        # the lichen: ragged strands hanging from the throat
        for s in (-0.9, -0.3, 0.3, 0.9):
            base = Vector((c.x + s * 0.09, c.y - 0.1, c.z - 0.08))
            pn(neck, [base + Vector((-0.05, 0, 0)), base + Vector((0.05, 0, 0)), base + Vector((s * 0.05, -0.03, -0.38 + 0.08 * ((k + int(s * 3)) % 2)))],
               lichen if (k + int(s * 3)) % 2 else moss, th=0.012)
    neck.finish()

    # --- the head: a long noble skull, the eyes sunk under a hard brow, tall ears, the crown ----------------------------------
    head = B.part("head", V(0, -0.9, 1.78), "neck")
    skull = []
    for sx in (-1, 1):
        skull += [(sx * 0.11, -0.84, 1.74), (sx * 0.1, -0.84, 1.9), (sx * 0.125, -0.99, 1.75), (sx * 0.105, -0.99, 1.92),
                  (sx * 0.075, -1.15, 1.67), (sx * 0.065, -1.15, 1.76), (sx * 0.05, -1.33, 1.6), (sx * 0.048, -1.33, 1.665)]
    hl(head, skull, hide)
    for s in (-1, 1):
        # the brow: a hard ridge over each eye, the eye an amber slit below it
        hl(head, [(s * 0.06, -1.02, 1.915), (s * 0.13, -1.0, 1.9), (s * 0.125, -1.1, 1.87), (s * 0.06, -1.12, 1.88), (s * 0.07, -1.03, 1.94),
                  (s * 0.11, -1.02, 1.93)], bark_dk)
        hl(head, [(s * 0.085, -1.05, 1.85), (s * 0.127, -1.02, 1.855), (s * 0.123, -1.04, 1.835), (s * 0.082, -1.07, 1.83),
                  (s * 0.1, -1.05, 1.842)], eye)
        # ears, long and leaf-shaped, swept out and a little back
        pn(head, [(s * 0.09, -0.89, 1.88), (s * 0.12, -0.9, 1.93), (s * 0.34, -0.84, 2.02), (s * 0.19, -0.97, 1.86)], hide, th=0.01)
        # a bark patch on the cheek
        pl(head, (s * 0.095, -1.2, 1.7), (0, 1, 0), (s, 0, 0.2), (0.07, 0.2, 0.025), bark, taper=(0.7, 0.7))
    # the nose, dark
    hl(head, [(sx * 0.047, y, z) for sx in (-1, 1) for (y, z) in ((-1.32, 1.6), (-1.36, 1.62), (-1.31, 1.67))], hoof)
    # the crown: from each side's burr a beam rising and curving forward, many tines; gold at the points
    for s in (-1, 1):
        a = [(s * 0.065, -0.92, 1.92), (s * 0.27, -0.8, 2.02), (s * 0.45, -0.78, 2.26), (s * 0.58, -0.92, 2.55), (s * 0.6, -1.12, 2.86)]
        radii = [0.075, 0.062, 0.052, 0.04, 0.022]
        for i in range(4):
            sg(head, a[i], a[i + 1], radii[i], radii[i + 1], horn, sides=6)
        tines = [(1, (0.0, -0.34, 0.1)), (1, (s * 0.12, -0.1, 0.34)), (2, (-s * 0.03, -0.38, 0.2)), (2, (s * 0.1, 0.24, 0.34)),
                 (3, (s * 0.2, -0.06, 0.3)), (3, (-s * 0.04, -0.3, 0.28)), (3, (s * 0.04, 0.26, 0.3)), (4, (s * 0.08, -0.16, 0.22))]
        for idx, d in tines:
            b = a[idx]
            t = (b[0] + d[0], b[1] + d[1], b[2] + d[2])
            cn(head, b, t, 0.05 - 0.008 * idx, horn, sides=5)
            m0 = tuple(b[j] + d[j] * 0.6 for j in range(3))
            cn(head, m0, t, 0.026, gold, sides=4)
        cn(head, tuple(a[4][j] - (a[4][j] - a[3][j]) * 0.25 for j in range(3)), (a[4][0] + s * 0.02, a[4][1] - 0.08, a[4][2] + 0.22), 0.03, gold, sides=4)
    head.finish()

    jaw = B.part("jaw", V(0, -0.98, 1.7), "head")
    jp = []
    for sx in (-1, 1):
        jp += [(sx * 0.07, -0.97, 1.72), (sx * 0.065, -0.99, 1.66), (sx * 0.04, -1.3, 1.6), (sx * 0.035, -1.3, 1.575)]
    hl(jaw, jp, bark_dk)
    jaw.finish()

    # --- legs: upper and lower, a joint each; long and lean; the lower leg all bark, dark split hooves ------------------------
    def leg(name, hip, knee, ankle, front):
        x = hip[0]
        up = B.part("leg" + name, V(*hip), "body")
        sg(up, hip, knee, 0.135 if front else 0.19, 0.075, hide, sides=7, belly=1.12)
        pl(up, tuple(Vector(hip).lerp(Vector(knee), 0.45) + Vector((math.copysign(0.05, x), 0, 0))), tuple(Vector(knee) - Vector(hip)),
           (math.copysign(1, x), 0, 0.2), (0.09, 0.2, 0.035), bark_dk)
        up.finish()
        lo = B.part("foot" + name, V(*knee), "leg" + name)
        sg(lo, knee, ankle, 0.07, 0.05, bark, sides=6, belly=1.0)
        # a bark greave at the knee
        pl(lo, tuple(Vector(knee) + Vector((0, 0, -0.06))), (0, 0, -1), (0, -1, 0), (0.09, 0.12, 0.03), bark_dk)
        h = (ankle[0], ankle[1] - 0.02, 0.0)
        sg(lo, ankle, (h[0], h[1] - 0.02, 0.05), 0.04, 0.045, bark_dk, sides=6)
        lo.chunk(tuple(q * K for q in (0.09, 0.14, 0.07)), hoof, xf=T(*V(h[0], h[1] - 0.03, 0.035)), bevel=0.012, taper=(0.75, 0.7))
        lo.finish()

    for s, n in ((1, "L"), (-1, "R")):
        x = s * 0.2
        leg("F" + n, (x, -0.4, 0.95), (x * 1.05, -0.38, 0.55), (x * 1.05, -0.42, 0.14), True)
        leg("B" + n, (x, 0.56, 0.98), (x * 1.05, 0.72, 0.58), (x * 1.0, 0.64, 0.14), False)

    # --- tail: a short tuft ------------------------------------------------------------------------------------------------
    tail = B.part("tail", V(0, 0.76, 1.08), "body")
    cn(tail, (0, 0.74, 1.1), (0, 0.9, 0.82), 0.065, hide_lt, sides=5)
    cn(tail, (0, 0.82, 0.98), (0, 0.9, 0.86), 0.03, lichen, sides=4)
    tail.finish()
    return B


def register():
    bb.BUILD["stag"] = build_stag
