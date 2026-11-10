"""Isolde, the Winter Warden (controller): tall and calm. A halo of ice shards standing behind her head like a frozen sun,
an ice tiara, silver hair, ice-crystal shoulder spikes, a pale blue bodice over a white bell skirt with a shard hem, a
deep blue sash, and an ice spear taller than she is with a big crystal head."""
import math

from mathutils import Vector

from realkit import PI, Real


def build():
    R = Real("frost", sex="f", height=1.03, skin="#f6e9e4")
    z = R.z
    R.mat("bodice", "#8fc4e8", rough=0.5)
    R.mat("white", "#eef3f7", rough=0.7, double=True)
    R.mat("sash", "#1f4f9a", rough=0.6, double=True)
    R.mat("ice", "#cfeeff", rough=0.15, metal=0.2, emit="#5ab8f0", strength=0.35)
    R.mat("core", "#f4fbff", rough=0.2, emit="#bfe8ff", strength=1.0)
    R.mat("silver", "#d6dde4", rough=0.3, metal=0.85)
    R.mat("deep", "#16305e", rough=0.6)
    R.hair("Hair_Buns", "#e6edf3")

    R.fitted("Bodice", ["spine", "pelvis", "clavicle", "upperarm"], "bodice")
    R.fitted("Gloves", ["lowerarm"], "white", offset=0.005)
    R.fitted("Hose", ["thigh", "calf"], "deep", offset=0.003)
    R.boots("deep", top=z["knee"] - 0.05, cuff="silver")
    R.cuffs("silver", at=(0.08, 0.95))
    hem = z["ankle"] + 0.05
    f = R.skirt("white", hem=hem, flare=2.1, depth=1.15, trim="ice", trim_h=0.02)
    # the shard hem: ice points hanging all round it
    ch, rxh, ryh = R.ring(z["hip"] - 0.02)
    for k in range(18):
        a = 2 * PI * k / 18
        p = Vector((ch.x + rxh * 2.1 * math.sin(a), ch.y - 0.01 - ryh * 2.1 * 1.15 * math.cos(a), hem + 0.01))
        f.tube("ice", [p, p + Vector((0.03 * math.sin(a), -0.03 * math.cos(a), -0.05 - 0.03 * (k % 2)))], [0.02, 0.001], seg=5)
    R.band("sash", z["waist"], height=0.07, grow=1.12, how=R.hang_w(z["waist"], hem))
    cw, rxw, ryw = R.ring(z["waist"])
    f = R.piece(R.hang_w(z["waist"], hem))
    for s in (1, -1):
        f.tube("sash", [Vector((0.03 * s, cw.y - ryw * 1.25, z["waist"] - 0.02)), Vector((0.06 * s, cw.y - ryw * 1.8, z["hip"] - 0.1)), Vector((0.08 * s, cw.y - ryw * 2.5, z["knee"] + 0.1))],
               [0.03, 0.035, 0.02], seg=8, squash=((0, 1, 0), 0.2))
    f, gem = R.collar("silver")
    f.ellipsoid("core", gem, (0.018, 0.01, 0.024), seg=(12, 8))

    # ice crystals on the shoulders
    for s, n in ((1, "l"), (-1, "r")):
        f = R.piece(f"clavicle_{n}")
        sh = R.bone(f"upperarm_{n}")
        for k, (dx, dy, ln) in enumerate(((0.0, 0.0, 0.17), (0.05, -0.03, 0.11), (-0.04, 0.03, 0.12))):
            b = sh + Vector((dx * s, dy, 0.02))
            f.tube("ice", [b, b + Vector(((0.06 + dx) * s, dy * 0.5, ln))], [0.03, 0.002], seg=5)

    # the halo of ice shards behind her head, and the tiara
    f, c, r = R.head_piece()
    back = c + Vector((0, r + 0.07, 0.02))
    for k in range(11):
        a = PI * (-0.12 + 1.24 * k / 10)
        d = Vector((math.cos(a), 0, math.sin(a)))
        ln = 0.26 if k % 2 == 0 else 0.17
        f.tube("ice", [back + d * 0.13, back + d * (0.13 + ln)], [0.026, 0.001], seg=5, squash=((0, 1, 0), 0.4))
    f.torus("silver", back, 0.13, 0.008, normal=(0, 1, 0), seg=(32, 6))
    for k in range(5):
        a = -0.7 + 0.35 * k
        p = c + Vector((r * 0.92 * math.sin(a), -r * 0.92 * math.cos(a), r * 0.72))
        f.tube("ice", [p, p + Vector((0.02 * math.sin(a), -0.01, 0.07 - 0.02 * abs(k - 2)))], [0.014, 0.001], seg=5)

    # the ice spear
    # (in the left hand, upright: the pack's torch-holding arm carries it)
    f, o, d, up = R.held("l")
    f.tube("silver", [o - d * 1.28, o + d * 0.5], 0.013, seg=8)
    f.ellipsoid("ice", o - d * 1.29, (0.022, 0.022, 0.022), seg=(8, 6))
    f.tube("ice", [o + d * 0.46, o + d * 0.58, o + d * 0.9], [0.012, 0.06, 0.001], seg=6, squash=(tuple(up), 0.55))
    f.tube("core", [o + d * 0.52, o + d * 0.6, o + d * 0.78], [0.006, 0.022, 0.001], seg=5)
    f.torus("silver", o + d * 0.47, 0.024, 0.007, normal=d, seg=(16, 6))
    return R
