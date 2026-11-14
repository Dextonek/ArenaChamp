"""The Scarab King (the Sands' first ruler, a boss drawn about 2.5 times a hero's size: the Scarab Colossus, the Scarab
King, the Dune Colossus): the beetle-god's champion, armoured in his god's shell. Built as a giant: very broad and deep,
a smaller head, big hands. Dark sun-bronze skin; a helm made of a great scarab's head, its horn sweeping up over his brow,
a gold sun disc held between its front legs on his forehead; armour of iridescent blue-black shell plates edged in gold on
the chest, shoulders and forearms, two shell wing-cases hanging down his back like a cape; a kilt of white linen pleats
under a gold belt, a lapis apron in front. In the RIGHT hand a great khopesh, its hooked bronze blade long. The sun disc
glows: his one light. Signature shape: the horned scarab helm and the wing-cases."""
import math

from mathutils import Vector

from realkit import PI, Real
from real import parts_a as PA
from real import parts_b as PB
from real import parts_c as P
from foes import slab


def build():
    R = Real("sands_scarab", sex="m", height=1.02, width=1.38, depth=1.32, head=0.82, skin="#7a4a2c", eyes="#2a1e14")
    z = R.z
    R.mat("shell", "#1a2638", rough=0.42, metal=0.35, double=True)
    R.mat("shell2", "#1e4444", rough=0.42, metal=0.35, double=True)
    R.mat("linen", "#e6dcc4", rough=0.75, double=True)
    R.mat("lapis", "#1e3a8a", rough=0.4, double=True)
    R.mat("gold", "#d2ae55", rough=0.3, metal=0.85, double=True)
    R.mat("bronze", "#a8743a", rough=0.32, metal=0.85)
    R.mat("dark", "#141414", rough=0.6)
    R.mat("glow", "#fff0b8", rough=0.2, emit="#ffc247", strength=1.2)
    R.faceless()
    PB.big_hands(R, 1.35)
    z = R.z

    R.fitted("Body", ["spine", "pelvis", "clavicle", "upperarm"], "shell", offset=0.012, above=z["waist"] - 0.05)
    R.fitted("Arms", ["lowerarm"], "shell2", offset=0.014)
    R.boots("dark", top=z["knee"] - 0.06, toe="gold")
    hem = z["knee"] - 0.02
    f, rings = P.skirt(R, "linen", hem, flare=1.4, depth=1.12, folds=20, amp=0.012, seg=60, trim="gold", trim_h=0.02)
    P.cloth(f, "lapis", rings, arc=(-0.32, 0.32), seg=8, rows=8, off=0.008, z1=z["waist"])
    R.band("gold", z["waist"] - 0.02, height=0.08, grow=1.16, how=R.hang_w(z["waist"], hem))
    # the chest's shell plates in rows, gold-edged
    bf = R.piece("spine_02")
    for row in range(3):
        zz = z["waist"] + 0.07 + row * 0.1
        for k in range(7):
            a = -1.2 + 2.4 * (k + 0.5 * (row % 2)) / 7
            p, out = P.on_trunk(R, zz, a, off=0.014)
            slab(bf, "shell2" if (k + row) % 2 else "shell", p, out, 0.07, 0.055, 0.014, tilt=0.2)
    for s, n in ((1, "l"), (-1, "r")):
        sh = R.bone(f"upperarm_{n}")
        sp = R.piece(f"upperarm_{n}")
        sp.ellipsoid("shell2", sh + Vector((0.04 * s, 0, 0.06)), (0.14, 0.12, 0.06), seg=(14, 8))
        sp.torus("gold", sh + Vector((0.04 * s, 0, 0.04)), 0.13, 0.01, normal=(0.3 * s, 0, 1), seg=(24, 6))
    # the wing-cases down the back
    cc, rxc, ryc = R.ring(z["chest"])
    wf = R.piece("spine_03")
    for s in (1, -1):
        top = Vector((0.12 * s, cc.y + ryc + 0.05, z["chest"] + 0.12))
        pts = [top, top + Vector((0.06 * s, 0.07, -0.25)), top + Vector((0.04 * s, 0.08, -0.55)), top + Vector((-0.02 * s, 0.05, -0.72))]
        PA.blade(wf, "shell2", top, pts[-1], 0.13, (0, 1, 0), thick=0.15, belly=0.35, root=0.7, bend=(0.03 * s, 0.05, 0))
        wf.tube("gold", [p + Vector((-0.1 * s * (1 - i / 3), 0.006, 0)) for i, p in enumerate(pts)], 0.007, seg=5)

    # the scarab helm: a domed shell over the skull, the head plate with its horn, the sun disc
    h = P.head(R)
    hp = R.piece("Head")
    hp.ellipsoid("shell", h.c + Vector((0, 0.01, 0.0)), (h.rx * 1.25, h.ry * 1.22, h.rz * 1.18), seg=(20, 12))
    hp.ellipsoid("dark", Vector((0, h.y0 + 0.01, h.eye - 0.03)), (h.rx * 0.78, 0.05, 0.08), seg=(14, 8))
    for s in (1, -1):
        hp.ellipsoid("glow", Vector((0.03 * s, h.y0 - 0.025, h.eye)), (0.014, 0.006, 0.008), seg=(8, 6))
    horn = [Vector((0, h.y0 - 0.02, h.brow + 0.04)), Vector((0, h.y0 - 0.06, h.brow + 0.14)), Vector((0, h.y0 - 0.04, h.top + 0.14)), Vector((0, h.y0 + 0.03, h.top + 0.2))]
    hp.tube("shell", PA.smooth(horn, 4), [0.05 - 0.045 * i / 12 for i in range(13)], seg=10)
    disc = Vector((0, h.y0 - 0.05, h.brow + 0.02))
    PB.disc(hp, "gold", disc, (0, -1, 0.2), 0.055, thick=0.012)
    hp.ellipsoid("glow", disc + Vector((0, -0.01, 0.002)), (0.04, 0.008, 0.04), seg=(14, 6))
    for s in (1, -1):
        hp.tube("gold", [disc + Vector((0.07 * s, 0.02, -0.04)), disc + Vector((0.055 * s, -0.005, 0.0)), disc + Vector((0.035 * s, -0.012, 0.03))], 0.008, seg=5)

    # the khopesh in the right hand
    s = P.along(R)
    f, o, d, upv = R.held("r")
    side = upv.cross(d).normalized()
    f.tube("dark", [o - d * 0.1 * s, o + d * 0.1 * s], 0.022, seg=8)
    f.ellipsoid("gold", o - d * 0.12 * s, P.rr(R, 0.03), seg=(10, 8))
    f.tube("gold", [o + d * 0.1 * s - upv * 0.05, o + d * 0.1 * s + upv * 0.05], 0.014, seg=6)
    pts = [o + d * (0.1 + 0.35 * t) * s for t in (0, 0.5, 1)]
    a0 = pts[-1]
    for a in range(1, 9):
        th = PI * 0.95 * a / 8
        pts.append(a0 + (d * math.sin(th) * 0.2 + upv * (1 - math.cos(th)) * 0.18) * s)
    f.tube("bronze", pts, [0.03, 0.034, 0.04, 0.05, 0.055, 0.055, 0.05, 0.045, 0.035, 0.022, 0.003], seg=6, squash=(tuple(side), 0.14))
    return R
