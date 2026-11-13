"""The Drowned Admiral (the Sea's ruler, a boss drawn about 2.2 times a hero's size): the admiral who went down with his
fleet and still holds the harbour. Built as a giant, not a hero made big: broad and deep, a smaller head on a thick
neck, big hands. Grey-green drowned skin and a dark beard. A long deep-teal admiral's coat to the calves, open in front
over a wine waistcoat, its skirts lined in wine, broad gold braid down the fronts and at the hem, gold cuffs; heavy gold
epaulettes with a fringe; a wine sash from the right shoulder; cream breeches and tall black lacquer boots; a black
bicorne edged in gold, a sea-glass gem in its cockade: his one light. Coral has grown on his left shoulder in clean
branches, barnacles crust his right forearm and boot. In the RIGHT hand a great iron anchor with gold bands, held by
its shank (his move: the Anchor Sweep). Signature shape: the anchor and the bicorne."""
import math

from mathutils import Vector

from realkit import PI, Real
from real import parts_a as PA
from real import parts_b as PB
from real import parts_c as P


def build():
    R = Real("sea_admiral", sex="m", height=1.0, width=1.3, depth=1.25, head=0.86, skin="#8ea6a0")
    z = R.z
    R.mat("coat", "#14444e", rough=0.62, double=True)
    R.mat("wine", "#5e1a28", rough=0.62, double=True)
    R.mat("cream", "#d8cfb4", rough=0.8, double=True)
    R.mat("lacquer", "#141619", rough=0.45, double=True)
    R.mat("gold", "#d2ae55", rough=0.3, metal=0.85, double=True)
    R.mat("iron", "#5c626c", rough=0.48, metal=0.6)
    R.mat("coral", "#e8835e", rough=0.55)
    R.mat("barnacle", "#e2dcc6", rough=0.7)
    R.mat("glow", "#e6fdff", rough=0.2, emit="#8ff5ff", strength=1.0)
    PB.big_hands(R, 1.3)
    z = R.z
    P.hair(R, "Hair_SimpleParted", "#16211f", beard="Hair_Beard")

    R.fitted("Coat", ["spine", "clavicle", "upperarm", "lowerarm"], "coat", offset=0.012)
    R.fitted("Waistcoat", lambda i: R.dom[i].startswith(("spine", "pelvis")) and R.world[i].y < 0 and abs(R.world[i].x) < 0.075 and R.world[i].z > z["hip"] + 0.02, "wine", offset=0.017, keep_skin=True)
    R.fitted("Breeches", ["thigh", "pelvis"], "cream", offset=0.005)
    R.boots("lacquer", top=z["knee"] + 0.07, cuff="gold", toe="lacquer")
    P.gloves(R, "lacquer")
    for n in "lr":
        P.sleeve(R, n, "coat", t0=0.66, t1=0.95, r0=0.016, r1=0.0, seg=14, n=2)
    R.cuffs("gold", at=(0.68, 0.94), offset=0.02, thick=0.01)

    # the coat's long skirts, open at the front, lined in wine, broad gold braid at the fronts and the hem
    hem = z["knee"] - 0.2
    gap = 0.38
    f, rings = P.skirt(R, "coat", hem, flare=1.55, depth=1.15, arc=(gap, 2 * PI - gap), folds=9, amp=0.026, trim="gold", trim_h=0.045, seg=56)
    P.cloth(f, "wine", rings, arc=(gap - 0.12, 2 * PI - gap + 0.12), seg=56, rows=8, off=-0.012)
    for s in (1, -1):
        a0, a1 = sorted((gap * s, (gap + 0.1) * s))
        P.cloth(f, "gold", rings, arc=(a0, a1), seg=2, rows=10, off=0.007)
    up = R.piece(P.trunk_w(R, hem))
    top = z["neck"] - 0.05
    for s in (1, -1):
        P.band_on(R, up, "gold", [(z["waist"] - 0.01, (gap + 0.05) * s), (z["chest"], 0.42 * s), (top, 0.3 * s)], 0.05, thick=0.012, off=0.022)
        for k in range(4):
            zz = z["waist"] + 0.04 + (z["chest"] - z["waist"]) * k / 3
            p, _ = P.on_trunk(R, zz, 0.36 * s, off=0.034)
            up.ellipsoid("gold", p, (0.014, 0.014, 0.014), seg=(8, 6))
    R.band("lacquer", z["waist"] - 0.02, height=0.06, grow=1.14, how=R.hang_w(z["waist"], hem))
    cw, rxw, ryw = R.ring(z["waist"] - 0.02)
    R.piece("pelvis").ellipsoid("gold", Vector((0, cw.y - ryw * 1.2, z["waist"] - 0.02)), (0.04, 0.014, 0.032), seg=(12, 8))
    fc, foot, _ = P.collar(R, "gold", height=0.06, grow=1.08, flare=0.0, arc=(0.5, 2 * PI - 0.5))
    # the wine sash from the right shoulder to the left hip
    sf, pt = PA.strap(R, "wine", width=0.09, lift=0.2, grow=1.14, high_side=-1, out=0.03)

    # the epaulettes: a gold board on each shoulder and a fringe of gold cords
    for sx, n in ((1, "l"), (-1, "r")):
        ep = R.piece(f"upperarm_{n}")
        c = R.bone(f"upperarm_{n}") + Vector((0.035 * sx, 0, 0.075))
        ep.ellipsoid("gold", c, (0.1, 0.085, 0.022), seg=(18, 8))
        ep.ellipsoid("coat", c + Vector((0, 0, 0.016)), (0.075, 0.062, 0.012), seg=(16, 6))
        for k in range(11):
            a = -1.3 + 2.6 * k / 10
            p = c + Vector((0.1 * sx * math.cos(a) * 0.95, 0.085 * math.sin(a) * 0.95, -0.01))
            ep.tube("gold", [p, p + Vector((0.025 * sx, 0, -0.07))], 0.008, seg=5)
        if n == "l":
            # coral grown through the left epaulette: a rounded mound and short branches that fork twice, round tips
            base = c + Vector((0.025, 0.025, 0.02))
            ep.ellipsoid("coral", base, (0.05, 0.045, 0.03), seg=(14, 8))

            def branch(p, dv, ln, r, depth):
                tip = p + dv * ln
                ep.tube("coral", [p, p + dv * ln * 0.55, tip], [r, r * 0.85, r * 0.7], seg=8)
                if depth == 0:
                    ep.ellipsoid("coral", tip, (r * 0.85,) * 3, seg=(8, 6))
                    return
                side = dv.cross(Vector((0.3, 0.6, 0.1))).normalized()
                for sgn in (1, -1):
                    branch(tip, (dv + side * 0.75 * sgn).normalized(), ln * 0.62, r * 0.72, depth - 1)
            for (dx, dy, dz, ln) in ((0.25, 0.1, 1.0, 0.075), (-0.45, 0.45, 0.9, 0.065), (0.75, -0.25, 0.65, 0.06), (0.05, 0.85, 0.5, 0.055), (-0.2, -0.7, 0.7, 0.05)):
                branch(base + Vector((dx, dy, 0)) * 0.03, Vector((dx, dy, dz)).normalized(), ln, 0.016, 2)

    # barnacles on the right forearm and the left boot
    def cluster(f, c, nrm, n, r):
        nrm = Vector(nrm).normalized()
        u = nrm.orthogonal().normalized()
        v = nrm.cross(u)
        for k in range(n):
            a = 2.4 * k
            p = c + (u * math.cos(a) + v * math.sin(a)) * r * math.sqrt((k + 0.5) / n)
            sz = 0.02 * (1.2 - 0.5 * k / n)
            f.tube("barnacle", [p - nrm * 0.004, p + nrm * sz * 0.9, p + nrm * sz * 1.2], [sz, sz * 0.75, sz * 0.45], seg=8)
            f.ellipsoid("lacquer", p + nrm * sz * 1.2, (sz * 0.38,) * 3, seg=(6, 4))
    cr, rr_ = R.arm_r("r", 0.35)
    cluster(R.piece("lowerarm_r"), cr + Vector((0, -0.01, rr_ + 0.02)), (0, -0.3, 1), 6, 0.05)
    lc, lr = R.leg_r("l", z["knee"] - 0.18)
    cluster(R.piece("calf_l"), lc + Vector((0.01, -lr - 0.012, 0)), (0.3, -1, 0), 5, 0.045)

    # the bicorne: worn crosswise, two raised flaps edged in gold, a gold cockade with a sea-glass gem
    h = P.head(R)
    hp = R.piece("Head")
    P.shell(hp, "lacquer", h.c + Vector((0, 0.005, 0.0)), (h.rx * 1.08, h.ry * 1.08, h.rz * 1.02), lambda a: 0.15, seg=28, rows=6)
    bz = h.c.z + h.rz * 0.15
    span, tall = 0.27, 0.13
    for fy in (-1, 1):
        def flap(u, v, fy=fy):
            x = span * (2 * u - 1)
            k = 1 - (2 * u - 1) ** 2
            zz = bz - 0.012 + (0.035 + tall * k ** 0.7) * v
            y = h.c.y + fy * (h.ry * 0.95 + 0.012) - fy * 0.035 * v * k
            return Vector((x, y, zz))
        PA.grid(hp, "lacquer", flap, 24, 4)
        hp.tube("gold", [flap(i / 24, 1.0) for i in range(25)], 0.0075, seg=6)
    for sx in (1, -1):
        hp.ellipsoid("lacquer", Vector((span * 0.97 * sx, h.c.y, bz + 0.012)), (0.02, h.ry * 0.95 + 0.015, 0.03), seg=(10, 8))
    ck = Vector((0.07, h.c.y - h.ry * 0.95 - 0.03, bz + 0.07))
    hp.torus("gold", ck, 0.03, 0.008, normal=(0, 1, 0), seg=(18, 6))
    hp.ellipsoid("wine", ck + Vector((0, 0.004, 0)), (0.026, 0.008, 0.026), seg=(12, 6))
    hp.ellipsoid("glow", ck + Vector((0, -0.006, 0)), (0.015, 0.01, 0.015), seg=(10, 6))

    # the anchor in the right hand, held by the shank: the ring and the stock behind the fist, the crown and flukes ahead
    # (it hangs crown-down by his boots at rest). Pale iron and gold, thick enough to read from the game camera.
    s = P.along(R)
    f, o, d, upv = R.held("r")
    side = upv.cross(d).normalized()
    f.torus("gold", o - d * 0.19 * s, 0.065, 0.017, normal=side, seg=(22, 8))
    f.tube("iron", [o - d * 0.12 * s, o + d * 0.84 * s], [0.036, 0.042], seg=12)
    f.tube("lacquer", [o - d * 0.06 * s, o + d * 0.06 * s], 0.042, seg=12)
    stock = o - d * 0.1 * s
    f.tube("iron", [stock - side * 0.22, stock + side * 0.22], 0.026, seg=10)
    for q in (stock - side * 0.23, stock + side * 0.23):
        f.ellipsoid("gold", q, P.rr(R, 0.032), seg=(10, 8))
    for t in (0.12, 0.45, 0.78):
        f.tube("gold", [o + d * (t - 0.02) * s, o + d * (t + 0.02) * s], 0.048, seg=12)
    crown = o + d * 0.86 * s
    f.ellipsoid("gold", crown, P.rr(R, 0.06), seg=(14, 10))
    # two straight-ish arms out from the crown, angled back toward the hand, a broad gold-edged fluke on each
    for sx in (1, -1):
        dv = (side * sx * 0.82 - d * s * 0.57).normalized()
        mid = crown + dv * 0.15 + d * s * 0.03
        end = crown + dv * 0.3
        f.tube("iron", [crown, mid, end], [0.042, 0.036, 0.03], seg=10)
        fl = (end - mid).normalized()
        PA.blade(f, "iron", end - fl * 0.06, end + fl * 0.13, 0.085, upv, thick=0.22, belly=0.4, root=0.55, n=6, seg=8)
        PA.blade(f, "gold", end - fl * 0.07, end + fl * 0.145, 0.06, upv, thick=0.5, belly=0.4, root=0.5, n=6, seg=8)
    cluster(f, o + d * 0.6 * s + upv * 0.04, upv, 5, 0.04)
    return R
