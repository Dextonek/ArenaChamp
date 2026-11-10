"""Opaline, the Lightbreaker (mage): slim and bright. A long lavender robe open over a white underskirt, narrow sleeves,
loose platinum hair, a faceted crystal on each shoulder, a dark sash with the four thin spectrum bands, a crystal brooch,
a ring of floating prisms behind her head, and a wand in the left hand whose crystal tip is the one bright light."""
import math

from mathutils import Vector

from realkit import PI, Real
from real.parts_b import ellipse, flats, legs_under, shard


def build():
    R = Real("prism", sex="f", height=1.0, width=0.95, depth=0.95, skin="#f4e4de")
    z = R.z
    R.mat("robe", "#8478d0", rough=0.55, double=True)
    R.mat("white", "#eef0fa", rough=0.7, double=True)
    R.mat("dark", "#14102a", rough=0.6, double=True)
    R.mat("glass", "#c4bcff", rough=0.12, metal=0.25, emit="#8f84ff", strength=0.4)
    R.mat("core", "#ffffff", rough=0.2, emit="#e6e0ff", strength=1.0)
    R.mat("gold", "#d2ae55", rough=0.3, metal=0.85)
    R.mat("red", "#ff5a6a", rough=0.45)
    R.mat("green", "#5aff9a", rough=0.45)
    R.mat("blue", "#5ab8ff", rough=0.45)
    R.hair("Hair_Long", "#e9e4f2", rough=0.4)

    R.fitted("Dress", ["spine", "pelvis", "clavicle", "upperarm", "lowerarm"], "robe")
    legs_under(R, "white", offset=0.003)
    R.boots("white", top=z["ankle"] + 0.1, toe="gold")
    R.cuffs("gold", at=(0.93,), offset=0.009, thick=0.008)

    # the robe: a white underskirt, the lavender robe open over it at the front
    hem = z["ankle"] + 0.04
    R.skirt("white", hem=hem, flare=1.7, depth=1.2)
    R.skirt("robe", hem=hem - 0.01, flare=1.8, depth=1.2, trim="gold", trim_h=0.025, arc=(0.42, 2 * PI - 0.42), grow=1.04)
    ch, rxh, ryh = R.ring(z["hip"] - 0.02)
    cw, rxw, ryw = R.ring(z["waist"])
    f = R.piece(R.hang_w(z["waist"], hem))
    for s in (1, -1):  # gold down both edges of the opening
        a = 0.42 * s
        top = Vector((cw.x + rxw * 1.12 * math.sin(a), cw.y - ryw * 1.16 * math.cos(a), z["waist"]))
        mid = Vector((ch.x + rxh * 1.3 * math.sin(a), ch.y - ryh * 1.42 * math.cos(a), ch.z))
        low = Vector((ch.x + rxh * 1.8 * 1.04 * math.sin(a), ch.y - 0.01 - ryh * 1.8 * 1.2 * 1.04 * math.cos(a), hem))
        half = Vector((ch.x + rxh * 1.56 * math.sin(a), ch.y - 0.005 - ryh * 1.78 * math.cos(a), (hem + ch.z) / 2))
        f.tube("gold", [top, mid, half, low], 0.008, seg=6)

    # the dark sash and its four spectrum bands
    R.band("dark", z["waist"], height=0.12, grow=1.1, how=R.hang_w(z["waist"], hem))
    f = R.piece(R.hang_w(z["waist"], hem))
    for k, key in enumerate(("red", "gold", "green", "blue")):
        zz = z["waist"] + 0.036 - 0.024 * k
        f.tube(key, ellipse(cw, rxw * 1.135, ryw * 1.17, PI, 3 * PI, n=40, z=zz), 0.0065, seg=5)
    # the sash's two ends down the left of the front
    for dx, ln in ((0.075, 0.42), (0.115, 0.32)):
        p = Vector((dx, cw.y - ryw * 1.25, z["waist"] - 0.03))
        q = Vector((dx + 0.03, ch.y - ryh * 1.75, z["waist"] - ln))
        f.tube("dark", [p, p.lerp(q, 0.5) + Vector((0, -0.02, 0)), q], [0.026, 0.03, 0.034], seg=8, squash=((0, 1, 0), 0.22))
        f.tube("gold", [q + Vector((-0.034, 0, 0)), q + Vector((0.034, 0, 0))], 0.007, seg=6)

    # a short white cape down the back, gold at its hem
    R.cape("white", hem=z["hip"] - 0.08, width=0.3, trim="gold")

    # the collar and the crystal brooch
    f, gem = R.collar("gold", height=0.05)
    shard(f, "glass", gem + Vector((0, -0.012, 0.03)), gem + Vector((0, -0.012, -0.075)), 0.03, n=6, mid=0.3, flat=((0, 1, 0), 0.5))

    # a faceted crystal on each shoulder, pointing out and up
    for s, n in ((1, "l"), (-1, "r")):
        f = R.piece(f"clavicle_{n}")
        sh = R.bone(f"upperarm_{n}") + Vector((0, 0, 0.035))
        shard(f, "glass", sh + Vector((-0.07 * s, 0, 0.0)), sh + Vector((0.13 * s, 0, 0.09)), 0.062, n=6, mid=0.42, flat=((0, 0, 1), 0.55))
        shard(f, "glass", sh + Vector((-0.03 * s, -0.05, 0.0)), sh + Vector((0.09 * s, -0.07, 0.05)), 0.03, n=5, mid=0.4)
        shard(f, "glass", sh + Vector((-0.03 * s, 0.05, 0.0)), sh + Vector((0.08 * s, 0.08, 0.06)), 0.03, n=5, mid=0.4)
        f.torus("gold", sh + Vector((-0.015 * s, 0, -0.012)), 0.06, 0.007, normal=(0.35 * s, 0, 1), seg=(20, 6))

    # the ring of floating prisms behind her head
    f, c, r = R.head_piece()
    back = c + Vector((0, r + 0.085, 0.03))
    for k in range(9):
        a = PI * (-0.18 + 1.36 * k / 8)
        d = Vector((math.cos(a), 0, math.sin(a)))
        big = k % 2 == 0
        shard(f, "glass", back + d * 0.2, back + d * (0.38 if big else 0.33), 0.042 if big else 0.03, n=4, mid=0.38, flat=((0, 1, 0), 0.6))
    shard(f, "core", back + Vector((0, 0, 0.215)), back + Vector((0, 0, 0.27)), 0.014, n=4, mid=0.5)
    # a thin gold circlet with a crystal at the brow
    f.torus("gold", c + Vector((0, 0.005, r * 0.55)), r * 0.98, 0.005, normal=(0, 0.25, 1), seg=(28, 5))
    brow = c + Vector((0, -r * 0.93, r * 0.6))
    shard(f, "glass", brow + Vector((0, -0.004, 0.022)), brow + Vector((0, -0.012, -0.022)), 0.011, n=4, mid=0.45)

    # the wand: gold, a crown of small crystals, and the bright tip
    f, o, d, up = R.held("l")
    side = d.cross(up)
    f.tube("gold", [o - d * 0.2, o + d * 0.4], [0.009, 0.013], seg=8)
    f.ellipsoid("gold", o - d * 0.21, (0.02, 0.02, 0.02), seg=(10, 8))
    f.torus("gold", o + d * 0.4, 0.03, 0.008, normal=d, seg=(16, 6))
    shard(f, "core", o + d * 0.38, o + d * 0.68, 0.05, n=6, mid=0.32)
    for k in range(4):
        a = PI / 4 + PI / 2 * k
        out = up * math.cos(a) + side * math.sin(a)
        shard(f, "glass", o + d * 0.37 + out * 0.03, o + d * 0.52 + out * 0.085, 0.022, n=4, mid=0.4)
    return flats(R)
