"""
Sky Ruins' landmark (2026-11-19; the user: "lets make more models for the arenas too and make them special"): a whale of the sky, one of
the old sky-whales of the Spires that glide the high air over the Drowned Coast and graze the cloud sea under the floating ruins. It
circles the ruins in one slow wide ring, below and beyond them (posed and flown in code, src/arenas/landmarks/skywhale.ts).

A humpback's build (second pass, after "it reads as an aeroplane"): a full rounded body, deepest just behind the blunt broad head and
tapering in a long curve to the tail stock, the whole of it bent in a gentle arc (head and tail low) and the tail stock swept up; a long
mouth line and the cream pleated throat; two long narrow pectoral fins, a third of the body in length, swept back and down, gently
curved, with a knobbly leading edge edged by a thin gold line; a wide horizontal fluke with a notch and swept-back tips; only a small
dorsal hump on the back. A dusk-indigo back stripe, a scatter of small stars along the flanks (they hold a low glow).

Built as the arenas' props are (blender/arenas/real/STYLE.md): clean turned forms, smooth shading, the heroes' cream plus the ruins' own
dusk indigo, a thin gold line, one small light (the stars, one material). With the bosses' toolkit for its parts:
skywhale > body > (finL > finTipL; finR > finTipR; tail1 > tail2 > fluke). Faces -Y (its direction of flight), z up, metres.

    blender --background --factory-startup --python blender/arenas/landmarks/run.py -- skywhale
"""
import math

from mathutils import Vector

import boss_bodies as bb
from boss_bodies import Boss, R, interp
from boss_wyrm import S, seg

HEIGHT = 8.0
HERO_X = -9.0
VIEW = 1.9


def bend(y):
    """How far the body's arc lifts or drops a point at length y: head and tail low, the tail stock swept up."""
    return -0.0055 * (y + 2.0) ** 2 if y <= 8.0 else -0.55 + 0.014 * (y - 8.0) ** 2


def build_skywhale():
    B = Boss("skywhale", 8.0)
    B.smooth = True
    skin = B.m("skin", "#aab7cb", 0.0, 0.6)
    belly = B.m("belly", "#d8cfb4", 0.0, 0.75)
    dusk = B.m("dusk", "#46517a", 0.0, 0.65)
    dark = B.m("dark", "#232a40", 0.0, 0.6)
    gold = B.m("gold", "#c9a24a", 0.85, 0.32)
    star = B.m("star", "#ffcf80", 0.0, 0.4, emit="#ffb03a", strength=1.2)

    def P(x, y, z):
        """A pivot on the bent body."""
        return Vector((x, y, z + bend(y)))

    def bent(part):
        """Bend a part's geometry along the body's arc (its points were drawn straight, in the world)."""
        for v in part.bm.verts:
            v.co.z += bend(v.co.y + part.pivot.y)

    # The body, drawn along local z (front at +z) and turned so the front is -Y: full and round, deepest behind the head.
    prof = [(-8.0, 1.0), (-5.0, 1.75), (-2.0, 2.55), (1.0, 3.15), (4.0, 3.55), (6.5, 3.7), (8.5, 3.45), (10.5, 2.9), (11.7, 2.15),
            (12.4, 1.25), (12.8, 0.0)]
    FL = 0.92
    xf = R(math.pi / 2, 0, 0) @ S(1.0, FL, 1.0)

    def rad(y):
        return interp(prof, -y)

    def surf(y, phi, sg, k=1.0):
        """A point on the body's surface at length y, `phi` radians below the side (negative: above), on side sg."""
        r = rad(y) * k
        return Vector((sg * r * math.cos(phi), y, -r * FL * math.sin(phi)))

    body = B.part("body", P(0, 0, 0))
    body.lathe(prof, skin, sides=26, xf=xf, rot0=0.1)
    # the dusk-indigo back: a long ridge of colour down the top
    ys = [-10.0, -7.0, -4.0, -1.0, 2.0, 5.0, 7.5]
    for y0, y1 in zip(ys, ys[1:]):
        z0, z1 = rad(y0) * FL - 0.45, rad(y1) * FL - 0.45
        seg(body, (0, y0, z0), (0, y1 + 0.1, z1), 0.7 * rad(y0) / 3.0 + 0.25, 0.7 * rad(y1) / 3.0 + 0.25, dusk, sides=14)
    # the cream throat: pleats along the underside, from the chin back
    for ph in (1.5, 1.25, 1.0, 0.75):
        for sg in (1, -1):
            ys = [-11.4 + 1.55 * i for i in range(8)]
            for y0, y1 in zip(ys, ys[1:]):
                seg(body, surf(y0, ph, sg, 1.005), surf(y1, ph, sg, 1.005), 0.1, 0.1, belly, sides=5)
    # a small dorsal hump (the only thing standing on the back), the eyes under a dusk brow, the long line of the mouth
    top = rad(5.2) * FL
    body.hull([(0.45, 3.4, top - 0.35), (-0.45, 3.4, top - 0.35), (0.45, 6.8, top - 0.45), (-0.45, 6.8, top - 0.45), (0, 4.6, top + 0.6),
               (0, 5.6, top + 0.6)], dusk)
    for sg in (1, -1):
        body.rock(surf(-8.8, 0.12, sg, 1.0), (0.16, 0.24, 0.2), dark, n=10, rough=0.04)
        body.rock(surf(-8.75, -0.08, sg, 1.0), (0.26, 0.55, 0.14), dusk, n=10, rough=0.04)
        pm = [surf(y, 0.42 + 0.05 * (y + 12.3) / 5.0, sg, 1.006) for y in (-12.25, -11.0, -9.6, -8.2, -6.8)]
        for a, b in zip(pm, pm[1:]):
            seg(body, a, b, 0.075, 0.075, dark, sides=5)
    # stars: a scatter of small lights along the flanks
    for i in range(14):
        y = -8.0 + 1.1 * i
        sg = 1 if i % 2 == 0 else -1
        a = -0.45 - 0.35 * ((i * 5) % 3) / 2
        body.rock(surf(y, a, sg, 1.0), (0.15, 0.15, 0.12), star, n=8, rough=0.05)
    bent(body)
    body.finish()

    # tail: a long stock in two pieces (it bends up and down, in code), then the fluke
    t1 = B.part("tail1", P(0, 8.0, 0.0), "body")
    t1.lathe([(-8.0, 1.0), (-10.2, 0.88), (-12.6, 0.7)], skin, sides=18, xf=xf, rot0=0.1)
    bent(t1)
    t1.finish()
    t2 = B.part("tail2", P(0, 12.6, 0.0), "tail1")
    t2.lathe([(-12.6, 0.7), (-15.0, 0.52), (-17.4, 0.36)], skin, sides=14, xf=xf, rot0=0.1)
    bent(t2)
    t2.finish()
    fl = B.part("fluke", P(0, 17.3, 0.0), "tail2")
    for sg in (1, -1):
        lead = [(0.0, 17.2), (2.0, 17.5), (4.6, 18.5), (6.9, 20.5)]
        trail = [(6.3, 20.9), (4.3, 19.8), (2.2, 19.0), (0.3, 18.5)]
        top, bot = [], []
        for (x, y) in lead + trail:
            th = 0.16 * (1 - min(1.0, x / 7.5)) + 0.04
            top.append((sg * x, y, th))
            bot.append((sg * x, y, -th))
        fl.hull(top + bot, dusk)
        for (x0, y0), (x1, y1) in zip(lead, lead[1:]):
            seg(fl, (sg * x0, y0, 0.0), (sg * x1, y1, 0.0), 0.06, 0.05, gold, sides=5)
    bent(fl)
    fl.finish()

    # pectoral fins: long, narrow and tapering, swept back and down along a curve; the leading edge scalloped with knobs
    cl = [(3.0, -5.0, -1.8), (4.6, -3.9, -2.6), (6.2, -2.5, -3.6), (7.6, -0.9, -4.7), (8.8, 0.8, -5.8), (9.8, 2.6, -6.8), (10.5, 4.2, -7.6)]
    wd = [2.0, 2.2, 2.0, 1.6, 1.1, 0.65, 0.2]
    for sg, nm in ((1, "L"), (-1, "R")):
        pts = [Vector((sg * x, y, z)) for (x, y, z) in cl]
        lead, trail = [], []
        for i, p in enumerate(pts):
            d = (pts[min(i + 1, 6)] - pts[max(i - 1, 0)]).normalized()
            perp = Vector((sg, 0.0, 0.0)).cross(d).normalized()
            if perp.y > 0:
                perp = -perp          # toward the front
            lead.append(p + perp * wd[i] * 0.4)
            trail.append(p - perp * wd[i] * 0.6)
        nrm = Vector((sg, 0.12, 0.0)).normalized()

        def station(i, th):
            return [lead[i] + nrm * th, lead[i] - nrm * th, trail[i] + nrm * th, trail[i] - nrm * th]

        def build(part, i0, i1):
            for i in range(i0, i1):
                part.hull(station(i, 0.22 - 0.03 * i) + station(i + 1, 0.22 - 0.03 * (i + 1)), skin if i < 4 else dusk)
                seg(part, lead[i] + nrm * 0.02, lead[i + 1] + nrm * 0.02, 0.05, 0.04, gold, sides=5)
                for f in (0.0, 0.5):
                    c = lead[i] if f == 0 else lead[i].lerp(lead[i + 1], 0.5)
                    part.rock(c, (0.2 + 0.04 * (5 - i) / 5, 0.28, 0.22), skin if i < 4 else dusk, n=10, rough=0.08)

        fin = B.part("fin" + nm, P(*pts[0]), "body")
        build(fin, 0, 3)
        bent(fin)
        fin.finish()
        tip = B.part("finTip" + nm, P(*pts[3]), "fin" + nm)
        build(tip, 3, 6)
        bent(tip)
        tip.finish()
    # The whole whale was drawn about z = 0; lift it so it floats clear of the studio floor (and of the ground in the sheets).
    B.objs["body"].location.z += 4.0
    return B


def register():
    bb.BUILD["skywhale"] = build_skywhale
