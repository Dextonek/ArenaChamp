"""Vesper, the Crimson Countess (juggernaut caster): tall, pale and regal. A black corset bodice with gold piping and a
ruby at the throat, bare shoulders, long black gloves, a black bell skirt open in front over crimson, a tall fan of
dark collar blades with crimson faces behind her head, a gold crown with ruby points on long black hair, a wine cape
lined in crimson that ends in three pointed tails, and a gold scepter in the LEFT hand with a fist-sized ruby in a
gold claw (hold = torch)."""
import math

from mathutils import Vector

from realkit import PI, Real
from real import parts_a as P
from real.parts_a import V

FINGERS = ["hand_", "index_", "middle_", "ring_", "pinky_", "thumb_"]


def build():
    R = Real("blood", sex="f", height=1.05, width=0.97, skin="#f1dfd8")
    z = R.z
    R.mat("bodice", "#2a1620", rough=0.5)
    R.mat("black", "#191114", rough=0.65, double=True)
    R.mat("wine", "#3d0a14", rough=0.7, double=True)
    R.mat("crimson", "#9a1226", rough=0.6, double=True)
    R.mat("gold", "#d2ae55", rough=0.32, metal=0.85)
    R.mat("ruby", "#ff3048", rough=0.15, emit="#ff1a3a", strength=1.0)
    R.hair("Hair_Long", "#140d12", rough=0.4)

    R.fitted("Bodice", ["spine", "pelvis", "clavicle"], "bodice")
    R.fitted("Gloves", ["lowerarm"] + FINGERS, "bodice", offset=0.004)
    R.fitted("Hose", ["thigh", "calf"], "bodice", offset=0.003)
    R.boots("bodice", top=z["knee"] - 0.1, toe="gold")
    R.cuffs("gold", at=(0.05,), offset=0.009)

    # the bell skirt: black, open in front over crimson
    hem = z["ankle"] + 0.05
    R.skirt("crimson", hem=hem + 0.02, flare=1.75, depth=1.15)
    R.skirt("black", hem=hem, flare=1.9, depth=1.15, arc=(0.5, 2 * PI - 0.5), trim="gold", trim_h=0.028, grow=1.03, seg=40)
    sfn = P.skirt_fn(R, hem, 1.9, 1.15, 1.03)
    f = R.piece(R.hang_w(z["waist"], hem))
    for s in (1, -1):  # gold piping down the open edges
        f.tube("gold", [sfn(0.5 * s, zz, 0.004) for zz in (z["waist"] - 0.03, z["hip"], (z["hip"] + hem) / 2, hem + 0.02)], 0.007, seg=6)
    R.band("gold", z["waist"], height=0.05, grow=1.12, how=R.hang_w(z["waist"], hem))
    cw, rxw, ryw = R.ring(z["waist"])
    f = R.piece("pelvis")
    b = V(0, cw.y - ryw * 1.22, z["waist"] - 0.005)
    f.ellipsoid("gold", b, (0.04, 0.015, 0.045), seg=(12, 8))
    f.ellipsoid("ruby", b + V(0, -0.012, 0), (0.02, 0.01, 0.026), seg=(10, 6))

    # the corset: gold piping from the shoulders to the waist, lacing between
    f = R.piece("near")
    for s in (1, -1):
        f.tube("gold", [P.surf(R, zz, a * s, out=0.011) for zz, a in ((z["neck"] - 0.07, 0.62), (z["chest"] + 0.06, 0.5), (z["chest"] - 0.03, 0.42),
                                                                      (z["chest"] - 0.11, 0.3), (z["waist"] + 0.05, 0.22), (z["waist"] + 0.01, 0.16))], 0.006, seg=6)
    for k in range(3):
        zz = z["waist"] + 0.045 + 0.04 * k
        a = 0.2 + 0.035 * k
        f.tube("crimson", [P.surf(R, zz, -a, out=0.01), P.surf(R, zz + 0.012, 0, out=0.012), P.surf(R, zz, a, out=0.01)], 0.004, seg=5)
    fc, gem = R.collar("gold", height=0.06, grow=1.02)
    fc.ellipsoid("ruby", gem + V(0, -0.004, -0.004), (0.02, 0.011, 0.028), seg=(12, 8))

    # the fan of collar blades behind her head: dark, with crimson faces
    f = R.piece("spine_03")
    ny = R.bone("neck_01").y
    base = V(0, ny + 0.075, z["neck"] - 0.03)
    for k in range(7):
        a = -1.08 + 2.16 * k / 6
        ln = 0.33 + 0.13 * abs(a) / 1.08
        dirv = V(math.sin(a), 0.1, math.cos(a)).normalized()
        b0 = base + V(0.06 * math.sin(a), 0, 0)
        P.blade(f, "bodice", b0, b0 + dirv * ln, 0.056, (0, 1, 0), thick=0.1, belly=0.55, root=0.5)
        P.blade(f, "crimson", b0 + V(0, -0.007, 0.02), b0 + V(0, -0.007, 0) + dirv * (ln - 0.035), 0.04, (0, 1, 0), thick=0.08, belly=0.55, root=0.5)

    # the crown: a gold band, tall points, rubies on the front three
    f, c, r = R.head_piece()
    cz = z["top"] + 0.002
    cc0 = V(0, c.y + 0.02, cz)
    f.torus("gold", cc0, 0.074, 0.009, seg=(28, 6))
    for k in range(9):
        a = 2 * PI * k / 9
        front = (1 + math.cos(a)) / 2
        p = cc0 + V(0.074 * math.sin(a), -0.074 * math.cos(a), 0)
        h = 0.035 + 0.05 * front
        f.tube("gold", [p, p + V(0.012 * math.sin(a), -0.012 * math.cos(a), h)], [0.011, 0.002], seg=5)
        if front > 0.7:
            f.ellipsoid("ruby", p + V(0.004 * math.sin(a), -0.004 * math.cos(a), h * 0.38), (0.011, 0.011, 0.016), seg=(8, 6))

    # the cape: wine outside, crimson inside, three pointed tails
    P.cloak(R, "wine", hem=z["ankle"] + 0.08, width=0.43, depth=0.85, spread=1.22, lining="crimson", trim="gold", tails=3,
            split=z["hip"] - 0.02, back=0.035, nu=24, nv=14)

    # the scepter
    f, o, d, up, out = P.staff(R, "gold", back=0.5, front=0.4, r=0.012)
    f.ellipsoid("gold", o - d * 0.51, (0.024, 0.024, 0.024), seg=(10, 8))
    for t in (-0.25, 0.12, 0.3):
        f.torus("gold", o + d * t, 0.018, 0.006, normal=d, seg=(14, 6))
    g = o + d * 0.47
    f.ellipsoid("ruby", g, (0.05, 0.062, 0.05), seg=(14, 10))
    for k in range(4):
        a = PI / 4 + PI / 2 * k
        side = out * math.cos(a) + up * math.sin(a)
        f.tube("gold", [o + d * 0.39, g - d * 0.03 + side * 0.058, g + d * 0.04 + side * 0.045, g + d * 0.085 + side * 0.012], [0.009, 0.008, 0.006, 0.002], seg=5)
    f.tube("gold", [g + d * 0.06, g + d * 0.13], [0.01, 0.001], seg=5)
    return R
