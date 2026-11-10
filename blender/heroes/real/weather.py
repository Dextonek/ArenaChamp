"""Barry Cloudsley, the Sky Augur (mage): a seer of the sky. A long storm-slate coat to the floor over a sky-blue front
panel with gold buttons and edges, a high standing collar with a gold rim, flared sleeves, a muted sun-gold sash, dark
boots, windswept brown hair. A mantle of cloud heaped over his shoulders, and in the LEFT hand a staff taller than he
is, topped by a gold weathervane: a ring with the sun, rain and wind glyphs round a glowing sky-blue orb, and an arrow
across the top (hold: torch)."""
import math

from mathutils import Vector

from realkit import PI, Real
from real import parts_c as P


def build():
    R = Real("weather", sex="m", height=1.0, width=0.9, depth=0.88, skin="#d29a74")
    z = R.z
    R.mat("coat", "#303c54", rough=0.72, double=True)
    R.mat("panel", "#4a8ac4", rough=0.7, double=True)
    R.mat("sash", "#b8963a", rough=0.7, double=True)
    R.mat("cloud", "#aeb9cf", rough=0.95)
    R.mat("dark", "#1a2232", rough=0.5, metal=0.25)
    R.mat("gold", "#d2ae55", rough=0.32, metal=0.85, double=True)
    R.mat("orb", "#a8e4ff", rough=0.15, emit="#6ac8ff", strength=1.0)
    R.hair("Hair_SimpleParted", "#4e2c14", rough=0.55)

    hem = z["ankle"] + 0.03
    R.fitted("Coat", ["spine", "pelvis", "clavicle", "upperarm", "lowerarm"], "coat", offset=0.01)
    R.fitted("Legs", ["thigh", "calf"], "dark", offset=0.004)
    R.boots("dark", top=z["ankle"] + 0.2)
    P.toes(R, "dark")

    # the coat's skirt, open down the front over the sky-blue panel
    gap = 0.36
    f, rings = P.skirt(R, "coat", hem, flare=1.8, depth=1.2, arc=(gap, 2 * PI - gap), folds=12, amp=0.03, trim="gold", trim_h=0.03, seg=56)
    P.cloth(f, "panel", rings, arc=(-gap - 0.02, gap + 0.02), seg=10, rows=10, off=-0.004)
    for s in (1, -1):
        P.seam(f, "gold", rings, gap * s, r=0.009, off=0.004)
    # the panel on the chest, its gold edges and buttons
    f = R.piece(P.trunk_w(R, hem))
    top = z["neck"] - 0.07
    P.wrap(R, f, "panel", z["waist"] - 0.02, top, -0.42, 0.42, off=0.024, taper=(0.8, 1.0))
    for s in (1, -1):
        P.band_on(R, f, "gold", [(z["waist"] - 0.02, 0.34 * s), (top, 0.42 * s)], 0.016, thick=0.01, off=0.028)
    for k in range(4):
        p, n = P.on_trunk(R, z["waist"] + 0.07 + (top - z["waist"] - 0.1) * k / 3, 0.0, off=0.03)
        f.ellipsoid("gold", p, (0.014, 0.008, 0.014), seg=(10, 6))
    for k in range(5):
        c, rx, ry = P.ring_at(rings, z["waist"] - 0.14 - 0.14 * k)
        f.ellipsoid("gold", Vector((c.x, c.y - ry - 0.002, c.z)), (0.014, 0.008, 0.014), seg=(10, 6))

    # the sash and its two ends
    R.band("sash", z["waist"], height=0.1, grow=1.13, how=R.hang_w(z["waist"], hem))
    cw, rxw, ryw = R.ring(z["waist"])
    f = R.piece(R.hang_w(z["waist"], hem))
    knot = Vector((0.09, cw.y - ryw * 1.25, z["waist"]))
    f.ellipsoid("sash", knot, (0.04, 0.03, 0.04), seg=(12, 8))
    for k, dx in enumerate((0.0, 0.05)):
        f.tube("sash", [knot, knot + Vector((0.02 + dx, -0.03, -0.16)), knot + Vector((0.03 + dx * 1.6, -0.035, -0.38 + 0.06 * k))], [0.028, 0.034, 0.026], seg=8,
               squash=((0, 1, 0), 0.22))
        f.ellipsoid("gold", knot + Vector((0.03 + dx * 1.6, -0.035, -0.39 + 0.06 * k)), (0.026, 0.01, 0.012), seg=(10, 6))

    # the high collar, the flared sleeves
    f, gem, _ = P.collar(R, "coat", height=0.105, grow=1.12, flare=0.18, rim="gold", rim_r=0.007)
    f.ellipsoid("gold", gem + Vector((0, -0.008, 0.0)), (0.022, 0.012, 0.022), seg=(12, 8))
    for n in "lr":
        P.sleeve(R, n, "coat", t0=0.25, t1=0.98, r0=0.012, r1=0.095, rim="gold", rim_r=0.008)

    # the mantle of cloud heaped on his shoulders
    nk = z["neck"]
    cc, rxc, ryc = R.ring(z["chest"])
    back, front = cc.y + ryc, cc.y - ryc
    specs = [("spine_03", (0, back - 0.01, nk + 0.0), (0.16, 0.11, 0.1)),
             ("spine_03", (0.07, back + 0.03, nk + 0.07), (0.09, 0.08, 0.07)),
             ("spine_03", (-0.08, back + 0.02, nk + 0.06), (0.085, 0.075, 0.065))]
    for s, n in ((1, "l"), (-1, "r")):
        sh = R.bone(f"upperarm_{n}")
        specs += [("spine_03", (0.14 * s, back - 0.03, nk - 0.04), (0.13, 0.11, 0.095)),
                  ("spine_03", (0.12 * s, front + 0.035, nk - 0.06), (0.105, 0.08, 0.07)),
                  ("spine_03", (0.05 * s, front + 0.02, nk - 0.115), (0.07, 0.055, 0.05)),
                  ("spine_03", (0.2 * s, back - 0.05, nk - 0.13), (0.1, 0.085, 0.075)),
                  (f"upperarm_{n}", sh + Vector((0.0, 0.0, 0.065)), (0.115, 0.115, 0.085)),
                  (f"upperarm_{n}", sh + Vector((0.075 * s, 0.01, 0.03)), (0.09, 0.1, 0.075)),
                  (f"upperarm_{n}", sh + Vector((0.05 * s, -0.07, 0.035)), (0.07, 0.065, 0.06))]
    P.puffs(R, "cloud", specs)

    # the weathervane staff, upright in the left hand
    f, o, d, up, s = P.held_rod(R, "l", "dark", 1.28, 0.5, r=0.014)
    X = Vector((1, 0, 0))
    f.ellipsoid("gold", o - d * 1.285 * s, P.rr(R, 0.022), seg=(10, 6))
    for t in (-0.9, -0.12, 0.14, 0.46):
        f.torus("gold", o + d * t * s, 0.017, 0.006, normal=d, seg=(14, 6))
    c = o + d * (0.5 * s + 0.135)
    f.tube("gold", [o + d * 0.5 * s, c - d * 0.125], [0.014, 0.01], seg=8)
    f.torus("gold", c, 0.125, 0.012, normal=up, seg=(36, 8))
    f.ellipsoid("orb", c, P.rr(R, 0.066), seg=(18, 12))
    for a in (0.25, 0.75, 1.25, 1.75):   # four small claws holding the orb
        q = X * math.cos(a * PI) + d * math.sin(a * PI)
        f.tube("gold", [c + q * 0.118, c + q * 0.07], [0.007, 0.004], seg=5)
    # the glyphs on the ring: the sun, the rain, the wind
    f.star("gold", c + X * 0.125, 0.04, 0.018, thick=0.012, points=8, normal=up)
    f.tube("gold", [c - X * 0.105, c - X * 0.14, c - X * 0.168], [0.004, 0.02, 0.003], seg=8, squash=(tuple(up), 0.5))
    f.tube("gold", P.curl(c - d * 0.15, X, d, 0.012, 0.034, 0.0, 3.6 * PI, n=18), 0.0045, seg=5)
    # the arrow across the top
    t = c + d * 0.16
    f.tube("gold", [c + d * 0.125, t], 0.007, seg=6)
    f.tube("gold", [t - X * 0.17, t + X * 0.15], 0.007, seg=6)
    P.plate(f, "gold", [t + X * 0.22, t + X * 0.13 + d * 0.04, t + X * 0.13 - d * 0.04], 0.012, normal=up)
    P.plate(f, "gold", [t - X * 0.12, t - X * 0.2 + d * 0.04, t - X * 0.17, t - X * 0.2 - d * 0.04], 0.012, normal=up)
    return R
