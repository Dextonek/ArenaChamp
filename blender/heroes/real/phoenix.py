"""Anka, the Firebird (mage, ranged): a slender fire dancer. An ember-red sleeveless bodice, dark wine leggings and
soft boots with gold toes, a red skirt to the knee under a layer of amber feather scallops, a pale ash sash with a gold
clasp and a teal stone. Bare arms with gold bands. Long dark-red hair under a gold circlet with a crest of three
feathers. Two wings of flame feathers swept down and back from the shoulder blades like a cloak (Auriel's are raised
plates of light; these hang), a train of five long tail feathers with eyes, and an open feather fan upright in the LEFT hand
(hold = torch: she casts with it as others do with a staff, and flicks it to throw a feather)."""
import math

from realkit import PI, Real
from real import parts_a as P
from real.parts_a import V


def feather(f, a, b, width, normal, eye=True, vane="red", n=7):
    """One long feather from a (the quill) to b: a vane, a flame tip over its last third, a gold shaft, an eye."""
    P.blade(f, vane, a, b, width, normal, thick=0.07, belly=0.62, root=0.3, n=n)
    P.blade(f, "flame", a.lerp(b, 0.6), b + (b - a) * 0.04, width * 0.86, normal, thick=0.09, belly=0.35, root=0.75, n=4)
    f.tube("gold", [a, a.lerp(b, 0.9)], [0.006, 0.002], seg=5)
    if eye:
        e = a.lerp(b, 0.74)
        nn = V(*normal).normalized() * 0.006
        for s in (1, -1):
            f.ellipsoid("gold", e + nn * s, (width * 0.5, width * 0.5, width * 0.5), seg=(10, 6))
            f.ellipsoid("teal", e + nn * 1.9 * s, (width * 0.27, width * 0.27, width * 0.27), seg=(8, 6))


def build():
    R = Real("phoenix", sex="f", height=1.0, width=0.95, depth=0.95, skin="#c98e66")
    z = R.z
    R.mat("red", "#c23a22", rough=0.55, double=True)
    R.mat("deep", "#4c1410", rough=0.6)
    R.mat("amber", "#e0802a", rough=0.5, double=True)
    R.mat("ash", "#eadcc4", rough=0.65, double=True)
    R.mat("gold", "#e0a935", rough=0.28, metal=0.85)
    R.mat("teal", "#2fb8a8", rough=0.25)
    R.mat("flame", "#ffb54a", rough=0.4, emit="#ff8a2a", strength=0.7, double=True)
    hair = P.hair(R, "Hair_Long", "#6e1c12")
    cc, rxc, ryc = R.ring(z["chest"])

    R.fitted("Bodice", ["spine", "pelvis", "clavicle"], "red")
    R.fitted("Leggings", ["thigh", "calf"], "deep", offset=0.003)
    R.boots("deep", top=z["ankle"] + 0.12, cuff="gold", toe="gold")
    R.cuffs("gold", at=(0.08, 0.93), offset=0.007, thick=0.007)
    P.arm_band(R, "gold", 0.45, offset=0.006, thick=0.008)
    P.arm_band(R, "flame", 0.53, offset=0.005, thick=0.005)
    # gold piping down the bodice, a collar with a teal stone
    f = R.piece("near")
    for s in (1, -1):
        f.tube("gold", [P.surf(R, zz, a * s, out=0.011) for zz, a in ((z["neck"] - 0.065, 0.7), (z["chest"] + 0.05, 0.42), (z["chest"] - 0.05, 0.2), (z["chest"] - 0.12, 0.0))], 0.006, seg=6)
    fc, gem = R.collar("gold", height=0.035, grow=1.0)
    fc.ellipsoid("teal", gem + V(0, -0.003, 0), (0.016, 0.009, 0.02), seg=(10, 6))

    # the skirt: red to the knee, a layer of amber scallops like body feathers, the ash sash and its clasp
    hem = z["knee"] - 0.04
    R.skirt("red", hem=hem, flare=1.62, depth=1.15, trim="gold", trim_h=0.016)
    P.wavy_skirt(R, "amber", z["knee"] + 0.17, flare=1.6, depth=1.15, grow=1.05, waves=9, amp=0.05, trim="gold")
    P.wavy_skirt(R, "flame", z["hip"] - 0.06, flare=1.42, depth=1.12, grow=1.1, waves=9, amp=0.04, phase=PI)
    hang = R.hang_w(z["waist"], hem)
    R.band("ash", z["waist"], height=0.07, grow=1.14, how=hang)
    cw, rxw, ryw = R.ring(z["waist"])
    f = R.piece("pelvis")
    clasp = V(0, cw.y - ryw * 1.2, z["waist"])
    f.star("gold", clasp, 0.04, 0.02, thick=0.008, points=8, normal=(0, -1, 0), turn=PI / 8)
    f.ellipsoid("teal", clasp + V(0, -0.008, 0), (0.014, 0.008, 0.014), seg=(10, 6))

    # the train: five long tail feathers from the back of the sash, the middle one longest
    f = R.piece(P.spine_w(R))
    root = V(0, cw.y + ryw * 1.1, z["waist"] - 0.03)
    for i, (a, ln) in enumerate(((-0.62, 0.62), (-0.31, 0.78), (0.0, 0.9), (0.31, 0.78), (0.62, 0.62))):
        tip = root + V(math.sin(a) * ln * 0.62, 0.2 + 0.1 * math.cos(a), -ln * (0.86 + 0.1 * math.cos(a)))
        feather(f, root + V(math.sin(a) * 0.05, 0.004 * i, 0), tip, 0.05, (math.cos(a) * 0.25, 1, 0.3), eye=True)

    # the circlet and its crest of three feathers
    f, c, r = R.head_piece()
    zc = P.face_z(R, 0.72)
    band = P.outline(R, zc, -2.2, 2.2, n=24, out=0.016)
    f.tube("gold", band, 0.008, seg=6)
    front = band[len(band) // 2]
    f.ellipsoid("teal", front + V(0, -0.006, 0.004), (0.011, 0.007, 0.014), seg=(8, 6))
    for x, ln, lean in ((0.0, 0.26, 0.5), (0.05, 0.2, 0.62), (-0.05, 0.2, 0.62)):
        base = front + V(x * 0.6, 0.0, 0.012)
        feather(f, base, base + V(x * 1.6, ln * lean, ln * (1.0 - lean * 0.45)), 0.022, (0, 1, 0.55), eye=False, n=5)

    # the wings: a short gold arm out from each shoulder blade, eight flame feathers hanging from it, swept down and back
    f = R.piece("spine_03")
    by = cc.y + ryc + 0.06
    for s in (1, -1):
        root, elbow, wrist = V(0.05 * s, by - 0.02, z["chest"] + 0.1), V(0.2 * s, by + 0.06, z["chest"] + 0.13), V(0.4 * s, by + 0.1, z["chest"] + 0.04)
        arm = P.smooth([root, elbow, wrist], 6)
        f.tube("gold", arm, [0.018 - 0.008 * i / 12 for i in range(13)], seg=8)
        for i in range(8):
            t = i / 7
            b = arm[min(12, 1 + int(round(11 * t)))]
            th = -1.5 + 1.0 * t ** 0.9          # the inner ones hang straight down, the outer ones sweep out
            ln = 0.72 - 0.26 * t
            tip = b + V(math.cos(th) * ln * s, 0.1 + 0.03 * i, math.sin(th) * ln)
            feather(f, b + V(0, 0.01 + 0.006 * i, 0), tip, 0.058, (0, 1, 0), eye=i in (1, 3, 5))
        # small coverts over the arm, so its top is feathers and not a rod
        for i in range(6):
            b = arm[2 * i + 1]
            P.blade(f, "amber", b + V(0, -0.004, 0.012), b + V(0.05 * s, 0.03, -0.16), 0.04, (0, 1, 0), thick=0.1, belly=0.45, root=0.5, n=4)

    # the fan in the LEFT hand, as a staff or a wand is: the pack's torch arm holds it upright in front of her, its face
    # to the front, and her attack (the left hand's push) flicks it at the enemy. Nine gold ribs from the palm, a red
    # leaf between them with a scalloped flame edge.
    f, o, d, up = R.held("l")
    d = d * (R.build[2] / R.build[1])
    fwd = R.bone("hand_l") - R.bone("middle_01_l")
    fwd.y = fwd.z = 0.0
    fwd.normalize()
    side = d.normalized().cross(fwd).normalized()
    spread, r0, r1, ribs = 1.1, 0.06, 0.3, 9

    def at(a, rad, lift=0.0):
        return o + (d * math.cos(a) + side * (math.sin(a) * d.length)) * rad + fwd * lift

    P.grid(f, "red", lambda u, v: at(-spread + 2 * spread * u, r0 + (r1 - r0) * v), 32, 4)
    P.grid(f, "flame", lambda u, v: at(-spread + 2 * spread * u, r1 - 0.004 + v * (0.035 + 0.03 * abs(math.sin(u * (ribs - 1) * PI))), 0.002), 32, 2)
    for i in range(ribs):
        a = -spread + 2 * spread * i / (ribs - 1)
        for lift in (0.004, -0.004):
            f.tube("gold", [at(a, 0.0, lift), at(a, r1 + 0.02, lift)], [0.006, 0.003], seg=5)
            f.ellipsoid("teal" if i % 2 == 0 else "gold", at(a, r1 * 0.8, lift * 1.8), (0.011, 0.011, 0.011), seg=(8, 6))
    f.ellipsoid("gold", o, (0.022, 0.022, 0.022), seg=(10, 8))
    f.tube("gold", [o - d * 0.09, o], 0.012, seg=8)
    f.ellipsoid("teal", o - d * 0.1, (0.016, 0.016, 0.016), seg=(8, 6))
    return R
