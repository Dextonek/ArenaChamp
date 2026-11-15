"""The Siege Lord (the War's second ruler, a boss drawn about 2.4 to 2.5 times a hero's size: the Siege Lord, the Ashen
General, the War Drummer): the breaker of walls, sooted by a hundred sieges. Built as a giant: very broad and deep, a
smaller head, big hands. Ash-grey skin, a shaved head under a heavy iron helm with a face-guard of bars and two curling
ram's horns of iron; heavy soot-black iron plate with dull bronze rims, a great gorget, a mantle of dark grey fur; a
leather kilt studded in bronze; iron boots. Embers glow in the seams of his breastplate: his one light. In the RIGHT hand a
great siege hammer, a long haft and a heavy iron head banded in bronze. Signature shape: the ram-horned helm and the
hammer."""
import math

from mathutils import Vector

from realkit import PI, Real
from real import parts_a as PA
from real import parts_b as PB
from real import parts_c as P


def build():
    R = Real("war_siege", sex="m", height=1.0, width=1.42, depth=1.36, head=0.8, skin="#9a948e")
    z = R.z
    R.mat("iron", "#4c4c52", rough=0.56, metal=0.55, double=True)
    R.mat("bronze", "#8a6a3a", rough=0.4, metal=0.75, double=True)
    R.mat("fur", "#3a3634", rough=1.0, double=True)
    R.mat("leather", "#2a1e16", rough=0.65, double=True)
    R.mat("wood", "#2a1e14", rough=0.65)
    R.mat("glow", "#ffe0b0", rough=0.3, emit="#ff7a20", strength=1.3)
    R.faceless()
    PB.big_hands(R, 1.35)
    z = R.z

    R.fitted("Plate", ["spine", "clavicle", "upperarm", "lowerarm"], "iron", offset=0.016)
    R.fitted("Legs", ["thigh", "calf"], "iron", offset=0.01)
    R.boots("iron", top=z["ankle"] + 0.12, toe="bronze", offset=0.014)
    P.gloves(R, "iron")
    R.cuffs("bronze", at=(0.1, 0.92), offset=0.012, thick=0.01)
    # ember seams on the breastplate
    bf = R.piece("spine_02")
    for row in range(3):
        pts = []
        for k in range(9):
            a = -0.9 + 1.8 * k / 8
            p, out = P.on_trunk(R, z["waist"] + 0.08 + row * 0.09 + 0.015 * math.sin(k * 1.7 + row), a, off=0.02)
            pts.append(p)
        bf.tube("glow", pts, 0.006, seg=5)
    for s, n in ((1, "l"), (-1, "r")):
        sh = R.bone(f"upperarm_{n}")
        sp = R.piece(f"upperarm_{n}")
        sp.ellipsoid("iron", sh + Vector((0.05 * s, 0, 0.06)), (0.16, 0.13, 0.07), seg=(14, 8))
        sp.torus("bronze", sh + Vector((0.05 * s, 0, 0.035)), 0.15, 0.012, normal=(0.4 * s, 0, 1), seg=(24, 6))
    hem = z["knee"] - 0.02
    f, rings = P.skirt(R, "leather", hem, flare=1.4, depth=1.12, folds=6, amp=0.014, seg=48)
    for k in range(12):
        a = 2 * PI * k / 12
        for zz in (hem + 0.06, hem + 0.18):
            c, rx, ry = P.ring_at(rings, zz)
            f.ellipsoid("bronze", Vector((c.x + (rx + 0.008) * math.sin(a), c.y - (ry + 0.008) * math.cos(a), zz)), (0.012, 0.012, 0.012), seg=(6, 4))
    how = R.hang_w(z["waist"], hem)
    R.band("iron", z["waist"] - 0.01, height=0.1, grow=1.18, how=how)
    # the fur mantle and the gorget
    PA.cowl(R, "fur", grow=1.22, low=0.1, high=0.02)
    P.collar(R, "iron", height=0.08, grow=1.12, flare=0.05)

    # the helm: a heavy iron dome, a face-guard of bars, ram's horns curling at the sides
    h = P.head(R)
    hp = R.piece("Head")
    c = h.c + Vector((0, 0.01, 0.0))
    hp.ellipsoid("iron", c, (h.rx * 1.2, h.ry * 1.2, h.rz * 1.22), seg=(22, 12))
    for k in range(5):
        x = -0.04 + 0.02 * k
        hp.tube("bronze", [Vector((x, h.y0 - 0.02, h.eye + 0.03)), Vector((x, h.y0 - 0.03, h.eye - 0.09))], 0.006, seg=5)
    hp.tube("bronze", [Vector((-h.rx * 0.9, h.y0 + 0.0, h.eye + 0.035)), Vector((0, h.y0 - 0.025, h.eye + 0.04)), Vector((h.rx * 0.9, h.y0 + 0.0, h.eye + 0.035))], 0.009, seg=5)
    hp.ellipsoid("glow", Vector((0, h.y0 - 0.005, h.eye - 0.02)), (h.rx * 0.5, 0.006, 0.03), seg=(10, 6))
    for s in (1, -1):
        base = c + Vector((h.rx * 1.05 * s, 0.0, h.rz * 0.35))
        pts = [base]
        for k in range(1, 15):
            t = k / 14
            ang = 1.6 * PI * t
            r = 0.14 * (1 - 0.45 * t)
            pts.append(base + Vector((0.05 * s * t + r * math.sin(ang) * 0.35 * s, -r * math.sin(ang), r * (math.cos(ang) - 1) * -1 + 0.02 * t)))
        hp.tube("bronze", pts, [0.045 * (1 - 0.8 * k / 14) + 0.005 for k in range(15)], seg=8)

    # the siege hammer in the right hand
    s = P.along(R)
    f, o, d, upv = R.held("r")
    side = upv.cross(d).normalized()
    f.tube("wood", [o - d * 0.3 * s, o + d * 0.85 * s], 0.03, seg=10)
    f.ellipsoid("iron", o - d * 0.31 * s, P.rr(R, 0.036), seg=(10, 8))
    head = o + d * 0.85 * s
    PB.box(f, "iron", head, (0.085, 0.085, 0.16), axes=(d, side, upv))
    for sg in (1, -1):
        f.tube("bronze", [head + upv * 0.13 * sg - d * 0.0, head + upv * 0.17 * sg], 0.09, seg=12)
    for t in (0.2, 0.6):
        f.torus("bronze", o + d * t * s, 0.036, 0.009, normal=d, seg=(14, 5))
    return R
