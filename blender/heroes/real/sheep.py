"""Bo, the Ramherd (summoner): a mountain herdsman-druid, old, grave and unhurried. A deep umber shaggy wool cloak to
the knees in tiers, a grey fleece mantle on the shoulders and a fleece hem, long dark sleeves with wool-wrapped
forearms, a dark leather belt with a gold buckle, dark boots with gold cuffs, grey hair and a silver beard under a
bronze headband. A pair of great curled ram horns springing from the headband, and in the LEFT hand a tall crook of
dark wood with a glowing warm bell hanging from its hook (hold: torch)."""
import math

from mathutils import Vector

from realkit import PI, Real
from real import parts_c as P


def build():
    R = Real("sheep", sex="m", height=0.97, width=0.98, depth=1.04, head=1.0, skin="#c8906c")
    z = R.z
    R.mat("coat", "#5a4632", rough=1.0, double=True)
    R.mat("fleece", "#9c927e", rough=1.0, double=True)
    R.mat("dark", "#2a2018", rough=0.8, double=True)
    R.mat("gold", "#d2ae55", rough=0.32, metal=0.85, double=True)
    R.mat("bronze", "#a07040", rough=0.38, metal=0.75)
    R.mat("horn", "#b09a70", rough=0.5)
    R.mat("wood", "#3a2616", rough=0.7)
    R.mat("bell", "#ffc462", rough=0.3, metal=0.3, emit="#ffa840", strength=1.0)
    P.hair(R, "Hair_SimpleParted", "#9c9a94", beard="Hair_Beard", rough=0.85)

    R.fitted("Tunic", ["spine", "pelvis", "clavicle", "upperarm", "lowerarm"], "dark", offset=0.006)
    R.fitted("Legs", ["thigh", "calf"], "dark", offset=0.004)
    R.fitted("Cloak", ["spine", "clavicle"], "coat", offset=0.022, keep_skin=True)
    R.fitted("Wraps", ["lowerarm"], "fleece", offset=0.014, keep_skin=True)
    R.cuffs("dark", at=(0.2, 0.38, 0.56, 0.74), offset=0.016, thick=0.006)
    for n in "lr":
        for t0, t1 in ((0.0, 0.07), (0.9, 0.97)):
            P.sleeve(R, n, "gold", t0=t0, t1=t1, r0=0.018, r1=0.0, seg=14, n=2)
    R.boots("dark", top=z["knee"] - 0.08, cuff="gold")
    P.toes(R, "dark")

    # the shaggy cloak: two tiers of deep folds to the knees, fleece at the hems
    hem = z["knee"] - 0.02
    f, rings = P.skirt(R, "coat", hem, flare=1.5, depth=1.2, folds=13, amp=0.036, seg=56, rows=10, power=0.9)
    P.cloth(f, "fleece", rings, seg=56, rows=2, folds=13, amp=0.036, power=0.9, z0=hem - 0.035, z1=hem + 0.05, off=0.016)
    mid = z["hip"] - 0.17
    rings2 = P.skirt_rings(R, mid, flare=1.42, depth=1.2, grow=1.12)
    P.cloth(f, "coat", rings2, seg=66, rows=6, folds=22, amp=0.024, phase=1.1, power=0.7)
    R.band("dark", z["waist"], height=0.075, grow=1.26, how=R.hang_w(z["waist"], hem))
    cw, rxw, ryw = R.ring(z["waist"])
    b = R.piece("pelvis")
    b.ellipsoid("gold", Vector((0, cw.y - ryw * 1.36, z["waist"])), (0.045, 0.014, 0.036), seg=(12, 8))

    # the fleece mantle on the shoulders: a thick fitted layer and heaped tufts
    sh = R.bone("upperarm_l").x
    R.fitted("Mantle", ["spine_03", "clavicle", "upperarm"], "fleece", offset=0.03, keep_skin=True,
             where=lambda p: (p.z > z["chest"] + 0.1 and abs(p.x) < sh + 0.02) or (abs(p.x) >= sh + 0.02 and abs(p.x) < sh + 0.1))
    nk = z["neck"]
    cc, rxc, ryc = R.ring(z["chest"])
    specs = []
    for k in range(12):   # the yoke: tufts heaped all round the chest and the back
        a = 2 * PI * (k + 0.5) / 12
        if abs(math.sin(a)) > 0.9:   # none under the arms
            continue
        zz = z["chest"] + 0.085 + 0.02 * (k % 2)
        p, n = P.on_trunk(R, zz, a, off=0.012)
        specs.append(("spine_03", p, (0.085, 0.075, 0.062 + 0.012 * (k % 3))))
    for k in range(7):
        a = PI + (k - 3) * 0.42
        p, n = P.on_trunk(R, nk - 0.03, a, off=0.0)
        specs.append(("spine_03", p, (0.07, 0.06, 0.05)))
    for s, n in ((1, "l"), (-1, "r")):
        j = R.bone(f"upperarm_{n}")
        specs += [(f"upperarm_{n}", j + Vector((0.0, 0.0, 0.05)), (0.1, 0.1, 0.065)),
                  (f"upperarm_{n}", j + Vector((0.07 * s, 0.012, 0.022)), (0.075, 0.085, 0.06)),
                  (f"upperarm_{n}", j + Vector((0.04 * s, -0.06, 0.02)), (0.06, 0.055, 0.05))]
    P.puffs(R, "fleece", specs, seg=(14, 8))
    f, gem, _ = P.collar(R, "dark", height=0.045, grow=1.15)

    # the bronze headband, and the great curled ram horns springing from it
    H = P.head(R)
    f = R.piece("Head")
    hz = H.brow + 0.012
    f.tube("bronze", [Vector((H.rx * 1.06 * math.sin(a), H.c.y - (H.ry * 1.08) * math.cos(a), hz + 0.012 * math.cos(a))) for a in [2 * PI * k / 28 for k in range(30)]], 0.012, seg=6,
           caps=False, squash=((0, 0, 1), 1.6))
    f.ellipsoid("gold", Vector((0, H.c.y - H.ry * 1.1, hz + 0.014)), (0.018, 0.009, 0.022), seg=(8, 6))
    for s in (1, -1):
        c = Vector(((H.rx + 0.03) * s, H.c.y + 0.035, H.eye + 0.02))
        u, v = Vector((0.12 * s, 1, 0)), Vector((0.2 * s, 0, 1))
        pts = P.curl(c, u, v, 0.092, 0.05, 2.3, 2.3 - 2.15 * PI, n=22, drift=(0.1 * s, -0.015, 0.0))
        rad = [(0.046 - 0.04 * (k / 22) ** 1.3) * (1 + 0.09 * math.sin(k * 2.6)) for k in range(23)]
        # the horn springs from inside the head, under the headband
        f.tube("horn", [Vector((H.rx * 0.45 * s, H.c.y - 0.01, H.eye + 0.06))] + pts, [0.044] + rad, seg=10)

    # the tall crook, upright in the left hand, a glowing bell on its hook
    f, o, d, up, s = P.held_rod(R, "l", "wood", 1.28, 0.6, r=0.017)
    X = Vector((1, 0, 0))
    f.ellipsoid("bronze", o - d * 1.285 * s, P.rr(R, 0.024), seg=(10, 6))
    for t in (-0.1, 0.12):
        f.torus("gold", o + d * t * s, 0.02, 0.006, normal=d, seg=(14, 6))
    t0 = o + d * 0.6 * s
    hook = P.curl(t0 + X * 0.1, -X, d, 0.1, 0.07, 0.0, 1.4 * PI, n=18)
    f.tube("wood", hook, [0.017 - 0.006 * k / 18 for k in range(19)], seg=8)
    e = hook[-1]
    f.ellipsoid("wood", e, (0.016, 0.016, 0.016), seg=(8, 6))
    f.tube("gold", [e, e - d * 0.045], 0.004, seg=5)
    prof = [(-0.04, 0.008), (-0.05, 0.022), (-0.075, 0.036), (-0.11, 0.045), (-0.135, 0.056), (-0.14, 0.05)]
    f.tube("bell", [e + d * t for t, r in prof], [r for t, r in prof], seg=14)
    f.torus("gold", e - d * 0.137, 0.056, 0.006, normal=d, seg=(18, 6))
    f.ellipsoid("gold", e - d * 0.155, P.rr(R, 0.016), seg=(8, 6))
    return R
