"""Hank, the Moss Hewer (bruiser): a huge forest warden. A moss-green tunic, bark-brown leather leggings and wrapped
bracers, dark fur-topped boots, leather straps crossed on the chest, a fur mantle heaped round his shoulders, brown hair
under a leather brow band, a thick braid down his back and a great beard in two braids tied in brass. His axe (the
user's drawing, 2026-11-10; blender/heroes/hank_axe.py): one bit on a one-handed haft held by its end and carried
low, the head down by his shin, the blade flaring to a curved edge that glows green, a green rune on each face."""
import math

from mathutils import Vector

from realkit import PI, Real
from real.parts_b import braid, ellipse, flats, hair_key, legs_under, on_back, on_front, path, plate

# the axe head's outline, from hank_axe.py: (along the haft from the eye, up)
OUTLINE = [(-0.065, 0.085), (0.065, 0.085), (0.072, 0.0), (0.092, -0.12), (0.14, -0.235), (0.172, -0.305), (0.125, -0.342), (0.045, -0.362), (-0.045, -0.358),
           (-0.125, -0.334), (-0.19, -0.292), (-0.15, -0.212), (-0.105, -0.13), (-0.078, -0.05), (-0.066, 0.0)]
EDGE = [(0.165, -0.296), (0.12, -0.33), (0.045, -0.349), (-0.045, -0.346), (-0.122, -0.322), (-0.18, -0.283)]
BUTT, END, HEAD_AT = 0.0, 0.62, 0.52


def build():
    R = Real("timber", sex="m", height=1.1, width=1.22, depth=1.3, head=0.92, skin="#d9aa8a")
    z = R.z
    R.mat("moss", "#44602e", rough=0.85, double=True)
    R.mat("bark", "#4a3322", rough=0.75, double=True)
    R.mat("fur", "#7b6852", rough=1.0)
    R.mat("dark", "#1c120b", rough=0.6)
    R.mat("brass", "#b08a3a", rough=0.35, metal=0.85)
    R.mat("steel", "#33373d", rough=0.38, metal=0.85)
    R.mat("green", "#b4ff8a", rough=0.35, emit="#6fe04a", strength=1.0)
    R.hair("Hair_Long", "#5b3b24", rough=0.6)
    hk = hair_key(R)
    beard = R.hair("Hair_Beard", "#5b3b24", brows=False)
    beard.data.materials.clear()
    beard.data.materials.append(R.M[hk])

    R.fitted("Tunic", ["spine", "pelvis", "clavicle", "upperarm"], "moss", offset=0.008)
    legs_under(R, "bark", offset=0.005, name="Leggings")
    R.fitted("Bracers", ["lowerarm"], "bark", offset=0.011)
    R.cuffs("brass", at=(0.08, 0.95), offset=0.006, thick=0.009)
    R.cuffs("dark", at=(0.3, 0.52, 0.74), offset=0.003, thick=0.006)
    top = z["knee"] - 0.03
    R.boots("dark", top=top, toe="steel")
    for n in "lr":
        c, r = R.leg_r(n, top - 0.01)
        R.piece(f"calf_{n}").torus("fur", c, r + 0.022, 0.028, seg=(20, 8))
        c, r = R.arm_r(n, 0.02)
        R.piece(f"upperarm_{n}").torus("moss", c, r + 0.012, 0.018, normal=(1, 0, 0), seg=(20, 8))

    # the tunic's skirt, the belt and its brass buckle
    hem = z["hip"] - 0.3
    R.skirt("moss", hem=hem, flare=1.32, depth=1.12, trim="brass", trim_h=0.02)
    zb = z["waist"] - 0.02
    R.band("bark", zb, height=0.095, grow=1.13, how=R.hang_w(z["waist"], hem))
    cw, rxw, ryw = R.ring(zb)
    f = R.piece("pelvis")
    bk = Vector((0, cw.y - ryw * 1.22, zb))
    f.torus("brass", bk, 0.05, 0.012, normal=(0, 1, 0), seg=(20, 6))
    f.tube("brass", [bk + Vector((-0.05, 0, 0)), bk + Vector((0.05, 0, 0))], 0.008, seg=5)

    # leather straps crossed on the chest and the back, a brass ring where they meet
    f = R.piece("near")
    for s in (1, -1):
        for surf in (on_front, on_back):
            pts = [surf(R, x * s, zz, 0.016) for x, zz in ((0.15, z["neck"] - 0.06), (0.09, z["chest"] + 0.07), (0.0, z["chest"] - 0.03), (-0.09, z["chest"] - 0.13), (-0.15, z["waist"] + 0.04))]
            f.tube("bark", pts, 0.03, seg=6, squash=((0, 1, 0), 0.3))
    g = on_front(R, 0, z["chest"] - 0.03, 0.026)
    f.torus("brass", g, 0.045, 0.011, normal=(0, 1, 0), seg=(20, 6))

    # the fur mantle heaped round the shoulders: two rows of lumps, tufts along its edge, a brass clasp and chain
    f = R.piece("spine_03")
    mc = Vector((0, 0.045, z["neck"] - 0.035))
    for k in range(14):
        a = 2 * PI * (k + 0.5) / 14
        if abs(math.sin(a)) < 0.3 and math.cos(a) > 0:
            continue   # open at the throat
        back = max(0.0, -math.cos(a))
        p = Vector((mc.x + 0.265 * math.sin(a), mc.y - (0.15 + 0.03 * back) * math.cos(a), mc.z + 0.012 * (k % 2) + 0.02 * back - 0.045 * abs(math.sin(a))))
        f.ellipsoid("fur", p, (0.115, 0.105, 0.08 + 0.012 * (k % 3)), seg=(12, 8))
    for k in range(9):
        a = PI - 1.35 + 2.7 * k / 8
        p = Vector((mc.x + 0.275 * math.sin(a), mc.y - 0.2 * math.cos(a), mc.z - 0.1 - 0.02 * (k % 2)))
        f.ellipsoid("fur", p, (0.105, 0.095, 0.09), seg=(12, 8))
    for k in range(22):
        a = 0.55 + (2 * PI - 1.1) * k / 21
        back = max(0.0, -math.cos(a))
        p = Vector((mc.x + 0.33 * math.sin(a), mc.y - (0.2 + 0.07 * back) * math.cos(a), mc.z - 0.06 - 0.09 * back - 0.03 * abs(math.sin(a))))
        out = Vector((math.sin(a), -math.cos(a), 0))
        f.tube("fur", [p, p + out * 0.03 + Vector((0, 0, -0.055 - 0.025 * (k % 3)))], [0.055, 0.012], seg=6)
    for s in (1, -1):
        cl = Vector((0.105 * s, mc.y - 0.2, mc.z - 0.055))
        f.ellipsoid("brass", cl, (0.03, 0.014, 0.03), seg=(10, 6))
    f.tube("brass", [Vector((0.105 * math.sin(t), mc.y - 0.2 - 0.012, mc.z - 0.06 - 0.04 * math.cos(t))) for t in [-PI / 2 + PI * k / 8 for k in range(9)]], 0.006, seg=5)

    # the braid down the back, out from under the mantle
    pts = [on_back(R, 0, zz, 0.05) for zz in [z["chest"] + 0.04 - 0.062 * k for k in range(7)]]
    braid(f, hk, pts, [0.048 - 0.003 * k for k in range(7)])
    f.torus("brass", pts[-1] + Vector((0, 0, -0.02)), 0.03, 0.009, seg=(12, 5))
    f.tube(hk, [pts[-1] + Vector((0, 0, -0.02)), pts[-1] + Vector((0, 0.01, -0.11))], [0.03, 0.006], seg=7)

    # the brow band, and the great beard in two braids tied in brass
    f, c, r = R.head_piece()
    bz = z["head"] + (z["top"] - z["head"]) * 0.68
    f.torus("bark", Vector((0, c.y + 0.012, bz)), r * 1.06, 0.013, normal=(0, 0.2, 1), seg=(28, 6))
    f.ellipsoid("brass", Vector((0, c.y - r * 1.08, bz - 0.012)), (0.016, 0.008, 0.016), seg=(8, 6))
    # (the pack's long hair leaves the male crown bare: hair combed back over it, in locks)
    f.ellipsoid(hk, Vector((0, c.y + 0.03, z["head"] + (z["top"] - z["head"]) * 0.5)), (r * 1.06, 0.125, (z["top"] - z["head"]) * 0.53), seg=(18, 12), keep=lambda co: co.z > bz - 0.012)
    hc = Vector((0, c.y + 0.03, z["head"] + (z["top"] - z["head"]) * 0.5))
    for k in range(-4, 5):
        th = 0.26 * k
        lock = []
        for i in range(10):
            ph = 0.32 + 3.2 * i / 9
            lock.append(hc + Vector((r * 1.08 * math.sin(th), -0.128 * math.cos(th) * math.cos(ph), 0.108 * math.cos(th) * math.sin(ph) - 0.012 * (i / 9) ** 2)))
        f.tube(hk, lock, [0.015 + 0.008 * math.sin(PI * i / 9) for i in range(10)], seg=6)
    chin = Vector((0, c.y - r * 0.8, z["head"] - 0.012))
    f.tube(hk, [chin + Vector((0, 0.035, 0.03)), chin + Vector((0, -0.015, -0.03)), chin + Vector((0, -0.03, -0.12)), chin + Vector((0, -0.03, -0.19))], [0.05, 0.085, 0.08, 0.05], seg=12,
           squash=((0, 1, 0), 0.6))
    for s in (1, -1):
        f.ellipsoid(hk, chin + Vector((0.062 * s, 0.045, 0.028)), (0.036, 0.045, 0.05), seg=(10, 8))
        pts = [chin + Vector((0.042 * s + 0.004 * s * k, -0.035 - 0.004 * k, -0.16 - 0.052 * k)) for k in range(5)]
        braid(f, hk, pts, [0.04 - 0.004 * k for k in range(5)])
        f.torus("brass", pts[-1] + Vector((0, 0, -0.015)), 0.024, 0.008, seg=(12, 5))
        f.tube(hk, [pts[-1] + Vector((0, 0, -0.015)), pts[-1] + Vector((0, -0.005, -0.08))], [0.024, 0.004], seg=6)

    # the axe: one bit, held by the haft's end. It lies along the hand, not across the fist as other weapons do: the
    # pack's standing arm then carries it low, the head down in front of his shin (the user's drawing), and the pack's
    # tree-chopping swing brings it from over his head down to level in front. Across the fist it stood up in front of
    # his chest and the chop ended with it upright (tried with pipeline/tools/v4-clips.js `_v4rods`, 2026-11-11).
    f, o, thumb, _ = R.held("r")
    d = Vector((-1, 0, 0))
    up = (thumb - d * thumb.dot(d)).normalized()
    side = d.cross(up)
    f.tube("bark", [o + d * t for t in (-BUTT, END * 0.3, END * 0.75, END)], [0.03, 0.033, 0.036, 0.032], seg=12)
    knob = o - d * (BUTT + 0.012)
    f.tube("brass", [knob - d * 0.03, knob, knob + d * 0.03], [0.026, 0.044, 0.03], seg=12)
    for t in (0.09, HEAD_AT - 0.1):
        f.tube("brass", [o + d * (t - 0.012), o + d * (t + 0.012)], 0.041, seg=12)
    head = o + d * HEAD_AT
    thick = lambda a, b: 0.012 + 0.05 * max(0.0, min(1.0, (b + 0.36) / 0.44))
    plate(f, "steel", head, OUTLINE, d, up, thick)
    f.tube("steel", [head + d * (END - HEAD_AT - 0.03), head + d * (END - HEAD_AT + 0.012)], [0.04, 0.03], seg=12)
    f.tube("green", [head + d * a + up * b for a, b in EDGE], [0.006, 0.013, 0.015, 0.015, 0.013, 0.006], seg=8)
    # the rune on each face: a pine (a trunk and two boughs)
    for s in (1, -1):
        for a, b in (((-0.01, -0.07), (-0.01, -0.26)), ((-0.01, -0.2), (0.055, -0.13)), ((-0.01, -0.2), (-0.075, -0.13))):
            off = side * s * (thick(0, 0.5 * (a[1] + b[1])) / 2)
            f.tube("green", [head + d * a[0] + up * a[1] + off, head + d * b[0] + up * b[1] + off], 0.009, seg=6)
    return flats(R)
