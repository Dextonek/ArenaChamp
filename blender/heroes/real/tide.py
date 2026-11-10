"""Marin, the Tide Dancer (ranged): a slim dancer, bare arms and shins. A deep teal sleeveless dress with three layers of
skirt (teal, sea blue, sea glass), a coral sash knotted at the hip, gold armlets and anklets, soft slippers (she was
barefoot; bare toes do not carry over), sea-green hair in buns and a long braid with a coral clip, a coral flower at the
temple, glowing water rings round her wrists and two sashes of water swirling round her."""
import math

from mathutils import Vector

from realkit import PI, Real
from real import parts_a as P
from real.parts_a import V


def build():
    R = Real("tide", sex="f", height=0.97, width=0.93, depth=0.94, skin="#c89878")
    z = R.z
    R.mat("teal", "#0d5576", rough=0.55, double=True)
    R.mat("sea", "#1f8fc0", rough=0.5, double=True)
    R.mat("glass", "#a9dfe6", rough=0.35, double=True)
    R.mat("coral", "#e8825a", rough=0.6, double=True)
    R.mat("gold", "#d2ae55", rough=0.32, metal=0.85)
    R.mat("water", "#c8f4ff", rough=0.2, emit="#3fb4e8", strength=0.9, double=True, alpha=0.8)
    hair = P.hair(R, "Hair_Buns", "#2a8a7a")
    cc, rxc, ryc = R.ring(z["chest"])

    R.fitted("Dress", ["spine", "pelvis", "clavicle"], "teal")
    R.fitted("Shorts", ["thigh"], "teal", offset=0.003, above=z["knee"] + 0.14)
    R.boots("teal", top=z["ankle"] + 0.045, toe="glass")
    P.arm_band(R, "gold", 0.5, offset=0.006, thick=0.008)
    P.arm_band(R, "glass", 0.58, offset=0.005, thick=0.005)
    for n in "lr":
        c, r = R.leg_r(n, z["ankle"] + 0.085)
        f = R.piece(f"calf_{n}")
        f.torus("gold", c, r + 0.01, 0.007, seg=(18, 6))
        f.torus("gold", c + V(0, 0, 0.022), r + 0.012, 0.005, seg=(18, 6))
    # sea-glass piping on the bodice, a pearl collar with a coral stone
    f = R.piece("near")
    for s in (1, -1):
        f.tube("glass", [P.surf(R, zz, a * s, out=0.011) for zz, a in ((z["neck"] - 0.065, 0.7), (z["chest"] + 0.05, 0.42), (z["chest"] - 0.05, 0.2), (z["chest"] - 0.12, 0.0))], 0.006, seg=6)
    fc, gem = R.collar("gold", height=0.035, grow=1.0)
    fc.ellipsoid("coral", gem + V(0, -0.003, 0), (0.016, 0.009, 0.02), seg=(10, 6))

    # three layers of skirt, the coral sash and its knot
    hem = z["knee"] - 0.13
    R.skirt("teal", hem=hem, flare=1.72, depth=1.15, trim="glass", trim_h=0.014)
    P.wavy_skirt(R, "sea", z["knee"] + 0.1, flare=1.8, depth=1.15, grow=1.05, waves=5, amp=0.05, trim="glass")
    P.wavy_skirt(R, "glass", z["hip"] - 0.11, flare=1.55, depth=1.12, grow=1.1, waves=5, amp=0.045, phase=PI)
    hang = R.hang_w(z["waist"], hem)
    R.band("coral", z["waist"], height=0.075, grow=1.14, how=hang)
    cw, rxw, ryw = R.ring(z["waist"])
    f = R.piece(hang)
    k0 = V(rxw * 1.12, cw.y - ryw * 0.6, z["waist"] - 0.005)
    f.ellipsoid("coral", k0, (0.036, 0.034, 0.036), seg=(10, 8))
    sfn = P.skirt_fn(R, z["knee"] + 0.08, 1.78, 1.15, 1.04)
    for a, ln, w in ((1.15, 0.44, 0.04), (1.42, 0.33, 0.034)):
        P.ribbon(f, "coral", [k0, sfn(a, z["hip"] - 0.05, 0.03), sfn(a + 0.05, z["waist"] - ln, 0.035)], lambda t, w=w: w * (0.55 + 0.45 * t), (math.cos(a), math.sin(a), 0), k=4)

    # hair: a long braid with a coral clip, a coral flower at the temple
    f, c, r = R.head_piece()
    back = c + V(0, r * 1.05, -0.03)
    P.braid(R, hair, [back, back + V(0, 0.04, -0.1), V(0, cc.y + ryc + 0.05, z["chest"] + 0.04), V(0, cc.y + ryc + 0.04, z["chest"] - 0.13), V(0, cc.y + ryc + 0.05, z["waist"] - 0.02)],
            r0=0.032, r1=0.02, n=12, head_n=2, clasp="coral")
    bl = c + V(0.088, -0.045, 0.03)
    for k in range(5):
        a = 2 * PI * k / 5
        P.blade(f, "coral", bl, bl + V(0.022, 0.045 * math.sin(a), 0.045 * math.cos(a)), 0.02, (1, 0, 0), thick=0.3, belly=0.55, root=0.4, n=4)
    f.ellipsoid("gold", bl + V(0.012, 0, 0), (0.01, 0.013, 0.013), seg=(8, 6))

    # water: rings round the wrists
    for n in "lr":
        cwr, rw = R.arm_r(n, 0.9)
        f = R.piece(f"lowerarm_{n}")
        f.torus("water", cwr, rw + 0.03, 0.009, normal=(1, 0.15, 0.1), seg=(24, 6))
        f.torus("water", cwr + V(-0.04 if n == "l" else 0.04, 0, 0), rw + 0.045, 0.006, normal=(1, -0.2, -0.15), seg=(24, 6))

    # two sashes of water swirling round her: each crosses the height of her arms behind her back
    def sash(a_start, turns, z0, z1, r0, r1, width):
        def wv(co):
            t = max(0.0, min(1.0, (co.z - z["hip"]) / (z["chest"] - z["hip"])))
            return {"spine_03": t, "pelvis": 1 - t}
        f = R.piece(wv)
        n = int(26 * turns) + 4
        pts = []
        for i in range(n + 1):
            t = i / n
            a = a_start + 2 * PI * turns * t
            rad = r0 + (r1 - r0) * t + 0.03 * math.sin(t * 9)
            pts.append(V(rad * math.sin(a), 0.02 - rad * 0.9 * math.cos(a), z0 + (z1 - z0) * t + 0.04 * math.sin(t * 7)))
        P.ribbon(f, "water", pts, lambda t: width * (0.12 + 0.88 * math.sin(PI * t) ** 0.6), (0.0, 0.0, 1.0), k=0)
        for p in (pts[0], pts[-1]):
            f.ellipsoid("water", p, (0.02, 0.02, 0.02), seg=(8, 6))
    # the arms are at 1.42: sash 1 passes that height at the back (angle pi), sash 2 stays below them
    arm = z["chest"] + 0.13
    z0, z1, turns = z["hip"] - 0.2, z["top"] + 0.05, 1.3
    a_at_arm = turns * 2 * PI * (arm - z0) / (z1 - z0)
    sash(PI - a_at_arm, turns, z0, z1, 0.47, 0.3, 0.042)
    sash(0.6, 1.1, z["knee"] - 0.1, z["chest"] - 0.02, 0.56, 0.42, 0.038)
    return R
