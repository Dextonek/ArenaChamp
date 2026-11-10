"""Mortis, the Ossuary Lord (summoner): tall, gaunt and ashen. A tattered grave robe in grey over dark teal, a deep teal
hood with a bright teal edge over a shaved head, a short mantle with a ribcage of bone over the chest, a skull on each
shoulder, hanging sleeves, a belt with a small skull, and a bone staff in the LEFT hand, floor to above his head,
topped by a skull whose eyes burn with teal soulfire under a wisp of it (hold = torch)."""
import math

from mathutils import Vector

from realkit import PI, Real
from real import parts_a as P
from real.parts_a import V


def build():
    R = Real("bone", sex="m", height=1.08, width=0.86, depth=0.84, head=0.95, skin="#b9b3a5")
    z = R.z
    R.mat("robe", "#4d5856", rough=0.8, double=True)
    R.mat("teal", "#1d3a36", rough=0.75, double=True)
    R.mat("dark", "#141a19", rough=0.65, double=True)
    R.mat("edge", "#2fa890", rough=0.5)
    R.mat("bone", "#ddd4bc", rough=0.55)
    R.mat("soul", "#d0fff4", rough=0.3, emit="#3fd8b8", strength=1.0)
    P.hair(R, None, "#4a4a44")
    sh = R.bone("upperarm_l").x

    R.fitted("Robe", ["spine", "pelvis", "clavicle", "upperarm", "lowerarm", "thigh", "calf"], "robe")
    R.fitted("Mantle", ["spine_03", "clavicle", "upperarm"], "teal", offset=0.02, keep_skin=True, above=z["chest"] + 0.03, where=lambda p: abs(p.x) < sh + 0.1)
    R.boots("dark", top=z["ankle"] + 0.09)
    P.bell_sleeve(R, "robe", flare=2.3, drop=0.07, cuff="edge")

    # the grave robe: teal underneath, grey over it, open in front, both torn at the hem
    hem = z["ankle"] + 0.1
    f = R.skirt("teal", hem=hem, flare=1.5, depth=1.2)
    P.rag_hem(R, f, "teal", hem, 1.5, 1.2, n=14, drop=0.085, width=0.06)
    arc = (0.42, 2 * PI - 0.42)
    f = R.skirt("robe", hem=hem + 0.09, flare=1.66, depth=1.2, arc=arc, grow=1.04, seg=40)
    P.rag_hem(R, f, "robe", hem + 0.09, 1.66, 1.2, n=17, drop=0.13, width=0.07, grow=1.04, arc=arc)
    sfn = P.skirt_fn(R, hem + 0.09, 1.66, 1.2, 1.04)
    hang = R.hang_w(z["waist"], hem)
    f = R.piece(hang)
    for s in (1, -1):  # a teal edge down the open front
        f.tube("edge", [sfn(0.42 * s, zz, 0.004) for zz in (z["waist"] - 0.03, z["hip"], (z["hip"] + hem) / 2, hem + 0.12)], 0.006, seg=6)
    R.band("dark", z["waist"], height=0.055, grow=1.14, how=hang)
    cw, rxw, ryw = R.ring(z["waist"])
    f = R.piece("pelvis")
    P.skull(f, "bone", "dark", V(rxw * 0.75, cw.y - ryw * 1.2 - 0.03, z["waist"] - 0.05), 0.04, front=(0.4, -1, 0), fit=R)
    for k in range(3):  # finger bones hanging from the belt
        b = V(-rxw * (0.5 + 0.22 * k), cw.y - ryw * (1.22 - 0.1 * k) - 0.012, z["waist"] - 0.03)
        f.tube("bone", [b, b + V(0, -0.004, -0.085 - 0.02 * (k % 2))], [0.008, 0.005], seg=5)
        f.ellipsoid("bone", b + V(0, -0.004, -0.09 - 0.02 * (k % 2)), (0.009, 0.009, 0.009), seg=(6, 4))

    # the ribcage over the chest: a breastbone and four ribs a side
    f = R.piece("spine_03")
    top = z["chest"] + 0.12
    f.tube("bone", [P.surf(R, zz, 0, out=0.03) for zz in (top + 0.02, top - 0.07, top - 0.14, top - 0.21)], [0.016, 0.014, 0.012, 0.006], seg=6)
    for i in range(4):
        zz = top - 0.055 * i
        for s in (1, -1):
            pts = P.outline(R, zz, 0.06 * s, (1.5 - 0.08 * i) * s, n=8, groups=("spine", "clavicle"), out=0.026, xmax=0.19)
            pts = [p + V(0, 0, -0.035 * (1 - k / 8) ** 2 - 0.012 * i * (k / 8)) for k, p in enumerate(pts)]
            f.tube("bone", pts, [0.011 - 0.004 * k / 8 for k in range(9)], seg=6)

    # a skull on each shoulder
    for s, n in ((1, "l"), (-1, "r")):
        f = R.piece(f"upperarm_{n}")
        P.skull(f, "bone", "dark", R.bone(f"upperarm_{n}") + V(0.035 * s, -0.012, 0.082), 0.066, front=(0.35 * s, -1, -0.1), jaw=False, fit=R)

    # the deep hood with its teal edge
    P.cowl(R, "teal", grow=1.08, low=0.085, high=0.0)
    f, c, hr, rim = P.hood(R, "teal", lining="dark", edge="edge", grow=1.44, open=0.52, tilt=0.32, peak=0.07, edge_r=0.009)
    R.piece("spine_03").tube("teal", [c + V(0, hr * 0.95, hr * 0.2), c + V(0, hr * 1.45, -hr * 0.55), c + V(0, hr * 1.35, -hr * 1.6)], [0.075, 0.055, 0.008], seg=10)

    # the bone staff: knuckled, a skull with burning eyes, a wisp of soulfire
    f, o, d, up, out = P.staff(R, "bone", back=1.28, front=0.58, r=0.014)  # out: the hero's front when it stands upright
    for t in (-1.28, -0.9, -0.5, 0.25, 0.56):
        f.ellipsoid("bone", o + d * t, (0.023, 0.03, 0.023), seg=(8, 6))
    sk = o + d * 0.66
    P.skull(f, "bone", "dark", sk, 0.072, front=out, up=d, eye="soul", fit=R)
    for s in (1, -1):  # two rib horns cradling the skull
        f.tube("bone", [o + d * 0.55 + up * 0.02 * s, sk + up * 0.1 * s - d * 0.03, sk + up * 0.1 * s + d * 0.07, sk + up * 0.06 * s + d * 0.13], [0.011, 0.01, 0.007, 0.002], seg=5)
    f.tube("soul", [sk + d * 0.06, sk + d * 0.12 + out * 0.02, sk + d * 0.19 - out * 0.015, sk + d * 0.27 + out * 0.01], [0.03, 0.036, 0.022, 0.002], seg=8)
    return R
