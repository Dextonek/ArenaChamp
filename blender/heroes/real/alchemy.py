"""Vitriol, the Plague Alchemist (ranged): lean and upright, no skin showing. A long dark coat over a moss robe, a short
shoulder cape, a deep hood, a pale glass beak mask with round green lenses in brass rims, a leather apron and gloves, a
bandolier of glowing vials across the chest, a brass-bound alembic of acid on his back and a round flask in the RIGHT
hand, ready to throw (attack = throw)."""
import math

from mathutils import Vector

from realkit import PI, Real
from real import parts_a as P
from real.parts_a import V

FINGERS = ["hand_", "index_", "middle_", "ring_", "pinky_", "thumb_"]


def build():
    R = Real("alchemy", sex="m", height=1.0, width=0.86, depth=0.86)
    z = R.z
    R.mat("coat", "#1d261b", rough=0.72, double=True)
    R.mat("robe", "#34432f", rough=0.7, double=True)
    R.mat("leather", "#4f3a26", rough=0.7, double=True)
    R.mat("dark", "#10140e", rough=0.6, double=True)
    R.mat("glass", "#dcefe6", rough=0.14, metal=0.15)
    R.mat("brass", "#b89a4a", rough=0.34, metal=0.85)
    R.mat("acid", "#d6ff6a", rough=0.25, emit="#7fdc2e", strength=1.0)
    R.mat("vial", "#b4e85a", rough=0.25, emit="#6cc428", strength=0.4)
    R.faceless()

    R.fitted("Robe", ["pelvis", "thigh", "calf", "neck"], "robe", offset=0.004)
    R.fitted("Coat", ["spine", "clavicle", "upperarm", "lowerarm"], "coat", offset=0.008)
    R.fitted("Gloves", FINGERS, "leather", offset=0.005)
    R.fitted("Capelet", ["spine_03", "clavicle", "upperarm"], "dark", offset=0.024, keep_skin=True, above=z["chest"] + 0.02,
             where=lambda p: abs(p.x) < R.bone("upperarm_l").x + 0.1)
    R.boots("dark", top=z["knee"] - 0.02, cuff="brass")
    R.cuffs("leather", at=(0.72, 0.95), offset=0.016, thick=0.011)

    # the coat's skirt, open in front, and the leather apron
    hem = z["knee"] - 0.2
    R.skirt("robe", hem=z["knee"] - 0.05, flare=1.3, depth=1.15)
    R.skirt("coat", hem=hem, flare=1.6, depth=1.2, arc=(0.55, 2 * PI - 0.55), trim="brass", trim_h=0.016, grow=1.06, seg=40)
    sfn = P.skirt_fn(R, z["knee"] - 0.05, 1.3, 1.15)
    f = R.piece(R.hang_w(z["waist"], hem))
    P.panel(R, f, "leather", sfn, -0.62, 0.62, z["waist"] - 0.02, z["knee"] + 0.02, out=0.012, nu=8, nv=6, taper=0.12)
    R.band("leather", z["waist"], height=0.07, grow=1.17, how=R.hang_w(z["waist"], hem))
    cw, rxw, ryw = R.ring(z["waist"])
    f = R.piece("pelvis")
    f.ellipsoid("brass", V(0, cw.y - ryw * 1.3, z["waist"]), (0.036, 0.014, 0.036), seg=(10, 8))
    for s in (1, -1):  # belt pouches, a vial hanging beside one
        f.ellipsoid("leather", V(rxw * 1.22 * s, cw.y - 0.02, z["waist"] - 0.07), (0.045, 0.06, 0.06), seg=(10, 8))
        f.ellipsoid("brass", V(rxw * 1.22 * s + 0.04 * s, cw.y - 0.02, z["waist"] - 0.05), (0.01, 0.014, 0.014), seg=(6, 4))
    v0 = V(-rxw * 1.0, cw.y - ryw * 1.25, z["waist"] - 0.05)
    f.tube("glass", [v0, v0 + V(0, 0, -0.1)], 0.02, seg=8)
    f.ellipsoid("vial", v0 + V(0, 0, -0.1), (0.027, 0.027, 0.03), seg=(10, 8))
    f.ellipsoid("brass", v0, (0.022, 0.022, 0.014), seg=(8, 6))

    # the bandolier of vials
    fs, pt = P.strap(R, "leather", width=0.05, lift=0.21, grow=1.1, out=0.03)
    for u in (0.92, 0.97, 0.02, 0.07, 0.12):
        p = pt(u)
        a = 2 * PI * u
        n = V(math.sin(a), -math.cos(a), 0)
        fs.tube("glass", [p + n * 0.02 + V(0, 0, -0.035), p + n * 0.02 + V(0, 0, 0.03)], 0.013, seg=7)
        fs.ellipsoid("vial", p + n * 0.02 + V(0, 0, -0.035), (0.0145, 0.0145, 0.018), seg=(8, 6))
        fs.ellipsoid("brass", p + n * 0.02 + V(0, 0, 0.034), (0.011, 0.011, 0.009), seg=(6, 4))

    # the hood and the beak mask
    P.cowl(R, "dark", grow=1.06, low=0.08, high=0.03)
    f, c, hr, rim = P.hood(R, "coat", lining="dark", edge="leather", grow=1.4, open=0.42, tilt=0.26, peak=0.06, edge_r=0.011)
    R.piece("spine_03").tube("coat", [c + V(0, hr * 0.95, hr * 0.2), c + V(0, hr * 1.45, -hr * 0.6), c + V(0, hr * 1.35, -hr * 1.5)], [0.07, 0.05, 0.008], seg=10)
    m = c + V(0, -0.028, -0.012)
    f.ellipsoid("glass", m, (0.082, 0.088, 0.108), seg=(18, 12))
    f.tube("glass", [m + V(0, -0.06, -0.022), m + V(0, -0.14, -0.045), m + V(0, -0.215, -0.095), m + V(0, -0.25, -0.15)], [0.05, 0.036, 0.02, 0.003], seg=10)
    f.tube("brass", [m + V(0, -0.087, 0.045), m + V(0, -0.15, 0.0), m + V(0, -0.225, -0.07)], 0.005, seg=5)
    for s in (1, -1):
        e = m + V(0.038 * s, -0.074, 0.03)
        n = V(0.42 * s, -1, 0.12).normalized()
        f.ellipsoid("vial", e, (0.027, 0.013, 0.027), seg=(12, 6), rot=P.frame_rot((1, 0.42 * s, 0), n, (0, 0, 1)))
        f.torus("brass", e + n * 0.004, 0.029, 0.006, normal=n, seg=(16, 6))
        f.tube("leather", [e + V(0.03 * s, 0.012, 0), m + V(0.082 * s, 0.01, 0.02)], 0.007, seg=5)

    # the alembic on his back: a bulb of acid in brass bands, a glass neck bent over his shoulder
    cc, rxc, ryc = R.ring(z["chest"])
    f = R.piece("spine_03")
    b = V(0, cc.y + ryc + 0.13, z["chest"] - 0.02)
    f.ellipsoid("acid", b, (0.115, 0.105, 0.125), seg=(16, 12))
    f.torus("brass", b, 0.118, 0.009, seg=(24, 6))
    f.torus("brass", b, 0.112, 0.008, normal=(1, 0, 0), seg=(24, 6))
    f.tube("brass", [b + V(0, -0.03, -0.13), b + V(0, -0.03, -0.15)], [0.07, 0.085], seg=10)
    f.tube("glass", [b + V(0, 0, 0.11), b + V(0, 0, 0.23), b + V(0.07, -0.02, 0.3), b + V(0.16, -0.05, 0.27)], [0.04, 0.03, 0.026, 0.018], seg=8)
    f.torus("brass", b + V(0, 0, 0.13), 0.04, 0.007, seg=(14, 6))
    f.ellipsoid("leather", b + V(0.165, -0.052, 0.268), (0.02, 0.02, 0.02), seg=(8, 6))
    for s in (1, -1):
        f.tube("leather", [b + V(0.09 * s, -0.06, 0.06), V(0.1 * s, cc.y + ryc + 0.02, z["chest"] + 0.1)], 0.012, seg=5)

    # the flask in his throwing hand
    f, o, d, up = R.held("r")
    f.tube("glass", [o - d * 0.03, o + d * 0.06], [0.016, 0.02], seg=8)
    f.ellipsoid("vial", o + d * 0.11, (0.055, 0.055, 0.055), seg=(14, 10))
    f.torus("brass", o + d * 0.065, 0.022, 0.006, normal=d, seg=(12, 6))
    f.ellipsoid("leather", o - d * 0.04, (0.017, 0.017, 0.017), seg=(8, 6))
    return R
