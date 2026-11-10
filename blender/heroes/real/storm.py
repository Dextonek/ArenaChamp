"""Kaia, the Tempest Caller (mage): slim and upright. A navy storm coat open in front over a pale rain tunic, flared
sleeves with pale cuffs, storm-cloud shoulder pads with gold clasps, a gold bolt on the chest, a long slate rain cloak
lined in storm blue with its hood up, white wind-blown hair escaping the hood, and a tall silver hooked staff in the
LEFT hand with a spark caught in its hook (hold = torch)."""
import math

from mathutils import Vector

from realkit import PI, Real
from real import parts_a as P
from real.parts_a import V


def build():
    R = Real("storm", sex="f", height=0.99, width=0.96, skin="#f0d2bc")
    z = R.z
    R.mat("coat", "#27468f", rough=0.6, double=True)
    R.mat("cloak", "#141d36", rough=0.75, double=True)
    R.mat("rain", "#c8d4de", rough=0.65, double=True)
    R.mat("dark", "#161a2c", rough=0.55)
    R.mat("cloud", "#7486a8", rough=0.85)
    R.mat("gold", "#d2ae55", rough=0.32, metal=0.85)
    R.mat("silver", "#d8e2ea", rough=0.3, metal=0.8)
    R.mat("spark", "#eaffff", rough=0.25, emit="#6ac4ff", strength=1.0)
    hair = P.hair(R, None, "#eef3f8")

    R.fitted("Tunic", ["spine", "pelvis", "clavicle", "upperarm"], "coat")
    R.fitted("Sleeves", ["lowerarm"], "coat", offset=0.005)
    R.fitted("Leggings", ["thigh", "calf"], "dark", offset=0.003)
    R.boots("dark", top=z["knee"] - 0.04, cuff="silver", toe="silver")
    P.bell_sleeve(R, "coat", flare=2.0, cuff="rain")

    # the pale tunic's skirt under the open coat
    R.skirt("rain", hem=z["knee"] + 0.1, flare=1.3, depth=1.2)
    hem = z["knee"] - 0.08
    R.skirt("coat", hem=hem, flare=1.62, depth=1.2, arc=(0.42, 2 * PI - 0.42), trim="gold", grow=1.05, seg=40)
    R.band("dark", z["waist"], height=0.07, grow=1.13, how=R.hang_w(z["waist"], hem))
    cw, rxw, ryw = R.ring(z["waist"])
    f = R.piece("pelvis")
    f.ellipsoid("gold", V(0, cw.y - ryw * 1.24, z["waist"]), (0.036, 0.014, 0.036), seg=(12, 8))
    f.ellipsoid("spark", V(0, cw.y - ryw * 1.24 - 0.012, z["waist"]), (0.017, 0.008, 0.017), seg=(10, 6))

    # the gold bolt on the chest
    cc, rxc, ryc = R.ring(z["chest"])
    f = R.piece("spine_03")
    y = cc.y - ryc - 0.012
    bolt = [V(0.022, y + 0.012, z["chest"] + 0.105), V(-0.02, y, z["chest"] + 0.045), V(0.016, y, z["chest"] + 0.03), V(-0.018, y + 0.01, z["chest"] - 0.04)]
    f.tube("gold", bolt, [0.013, 0.012, 0.011, 0.002], seg=6, squash=((0, 1, 0), 0.4))

    # storm clouds on the shoulders, a gold clasp on each
    for s, n in ((1, "l"), (-1, "r")):
        f = R.piece(f"upperarm_{n}")
        sh = R.bone(f"upperarm_{n}")
        for dx, dy, dz, k in ((0.015, 0.0, 0.035, 1.0), (0.07, -0.035, 0.02, 0.72), (0.065, 0.045, 0.02, 0.75), (-0.03, 0.01, 0.045, 0.7)):
            f.ellipsoid("cloud", sh + V(dx * s, dy, dz), (0.075 * k, 0.07 * k, 0.05 * k), seg=(14, 8))
        f.ellipsoid("gold", sh + V(-0.035 * s, -0.075, 0.02), (0.02, 0.012, 0.02), seg=(10, 6))

    # the rain cloak and its hood
    P.cloak(R, "cloak", hem=z["ankle"] + 0.2, width=0.4, depth=0.8, spread=1.42, top_spread=1.9, lining="coat", trim="gold")
    P.cowl(R, "cloak", grow=1.04, high=0.0)
    f, c, hr, rim = P.hood(R, "cloak", lining="coat", edge="gold", grow=1.36, open=0.5, tilt=0.28, peak=0.07, edge_r=0.008)
    # the hood's point down her back
    R.piece("spine_03").tube("cloak", [c + V(0, hr * 0.95, hr * 0.25), c + V(0, hr * 1.5, -hr * 0.5), c + V(0, hr * 1.45, -hr * 1.6)], [0.075, 0.055, 0.008], seg=10)
    # white hair under the hood, a long lock down each side of the face
    P.hair_cap(R, hair, grow=1.06)
    ez = P.face_z(R, 0.58)
    for s in (1, -1):
        for k, (dx, ln, w) in enumerate(((0.08, 0.25, 0.021), (0.092, 0.17, 0.016))):
            a = V(dx * s, c.y - hr * 0.3 + 0.025 * k, ez)
            P.blade(f, hair, a, a + V(0.012 * s, -0.03 + 0.02 * k, -ln), w, (0.3 * s, 1, 0), thick=0.3, belly=0.25, root=0.85, bend=(0.012 * s, -0.018, 0), n=8)
    fc, gem = R.collar("gold", height=0.045)
    fc.ellipsoid("spark", gem, (0.014, 0.008, 0.018), seg=(10, 6))

    # the hooked staff: silver, a spark caught in the hook
    f, o, d, up, out = P.staff(R, "silver", back=1.28, front=0.6, r=0.013)
    f.ellipsoid("gold", o - d * 1.29, (0.022, 0.022, 0.022), seg=(8, 6))
    base = o + d * 0.6
    P.hook(f, "silver", base, d, out, 0.125, r=0.014, turn=1.45 * PI, taper=0.45)
    for t in (0.3, 0.56):
        f.torus("gold", o + d * t, 0.019, 0.006, normal=d, seg=(14, 6))
    core = base + out * 0.125 + d * 0.015
    f.ellipsoid("spark", core, (0.042, 0.042, 0.042), seg=(14, 10))
    for k in range(4):
        a = PI / 4 + PI / 2 * k
        dirv = out * math.cos(a) + d * math.sin(a)
        f.tube("spark", [core + dirv * 0.03, core + dirv * 0.085], [0.011, 0.001], seg=5)
    f.torus("gold", core, 0.05, 0.005, normal=up, seg=(20, 6))
    return R
