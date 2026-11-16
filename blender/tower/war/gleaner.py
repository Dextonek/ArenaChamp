"""The Gleaner (a walker of the War's floors, docs/tower/life/index.html): one of Harrowmark's last people, who farm the
Field's edges and, while the armies fight, glean the spent arrows from the furrows and sell them back to both banners.
Plainer than the named people: no light, no gold. Fair, her brown hair in buns. A russet dress to mid-calf with full
sleeves to the wrist, a sage shawl over the shoulders, a dun apron (no lighter than the darkened cream: nothing of hers
blooms in the War's light), a band of undyed linen on her left arm that marks her as neither side's, low boots. Across
her back a long leather arrow sack on a strap, full of gathered arrows fletched crimson and azure, both banners'. The
hands are free (walkers play the pack's walking clip with both arms). Signature shape: the sack of arrows over the
shoulder."""
import math

from mathutils import Vector

from realkit import PI, Real
from real import parts_a as PA
from real import parts_c as P
import folk as K


def build():
    R = Real("war_gleaner", sex="f", height=0.99, width=1.0, depth=1.0, skin="#c99a7c")
    z = R.z
    R.mat("russet", "#6e3a2a", rough=0.72, double=True)
    R.mat("sage", "#5a5e52", rough=0.85, double=True)
    R.mat("dun", "#a39272", rough=0.85, double=True)
    R.mat("linen", "#c8bc9a", rough=0.85, double=True)
    R.mat("leather", "#3e2c20", rough=0.58, double=True)
    R.mat("shaft", "#8a6a44", rough=0.8)
    R.mat("crimson", "#7a1a24", rough=0.65, double=True)
    R.mat("azure", "#24427e", rough=0.65, double=True)
    R.hair("Hair_Buns", "#5a3a26", rough=0.6)

    # the dress with full sleeves to the wrist, the shawl on the shoulders, the linen band on the left arm
    R.fitted("Dress", ["spine", "pelvis", "clavicle", "upperarm", "lowerarm"], "russet", offset=0.008)
    for n in "lr":
        P.sleeve(R, n, "russet", t0=0.4, t1=0.9, r0=0.008, r1=0.045, seg=14, n=3)
    R.cuffs("russet", at=(0.9,), offset=0.02, thick=0.008)
    PA.cowl(R, "sage", grow=1.06, low=0.11)
    PA.arm_band(R, "linen", 0.55, offset=0.012, width=0.07, sides="l")
    R.fitted("Hose", ["thigh", "calf"], "leather", offset=0.004)
    R.boots("leather", top=z["ankle"] + 0.08)
    P.toes(R, "leather")
    hem = z["knee"] - 0.18
    P.skirt(R, "russet", hem, flare=1.55, depth=1.12, folds=9, amp=0.022, seg=52)
    P.skirt(R, "dun", hem + 0.07, flare=1.6, depth=1.13, arc=(-0.95, 0.95), folds=4, amp=0.01, grow=1.05, seg=24)
    up = R.piece(P.trunk_w(R))
    P.wrap(R, up, "dun", z["waist"] - 0.02, z["chest"] + 0.02, -0.55, 0.55, off=0.02, taper=(1.0, 0.75))
    R.band("dun", z["waist"] - 0.02, height=0.035, grow=1.16)

    # the arrow sack across her back (over the left shoulder), on a strap from the left shoulder to the right hip
    PA.strap(R, "leather", width=0.045, lift=0.2, grow=1.12, high_side=1, out=0.022)
    bf, bc, (cc, rxc, ryc), ny = K.back_frame(R)
    by = cc.y + ryc + 0.075
    s0 = Vector((-0.13, by, z["waist"] - 0.1))
    s1 = Vector((0.12, by + 0.01, z["chest"] + 0.14))
    d = (s1 - s0).normalized()
    pts = [s0, s0.lerp(s1, 0.08), s0.lerp(s1, 0.5), s1]
    P.hull(bf, "leather", pts, [0.03, 0.06, 0.065, 0.062], [0.03, 0.05, 0.055, 0.052], seg=16, side=Vector((1, 0, 0)))
    bf.torus("leather", s1, 0.064, 0.008, normal=d, seg=(20, 5))
    side = d.cross(Vector((0, 1, 0))).normalized()
    fwd = side.cross(d).normalized()
    for k in range(13):
        a = 2.4 * k
        rr = 0.045 * math.sqrt((k + 0.5) / 13)
        o = side * rr * math.cos(a) + fwd * rr * math.sin(a) * 0.85
        ln = 0.2 + 0.05 * ((k * 5) % 3) / 2
        q0 = s1 - d * 0.06 + o
        q1 = s1 + d * ln + o * 1.6
        bf.tube("shaft", [q0, q1], 0.005, seg=5)
        key = "crimson" if k % 2 else "azure"
        for v in (side, fwd):
            bf.tube(key, [q1 - d * 0.07, q1 - d * 0.01], [0.004, 0.004], seg=4, squash=(tuple(v), 0.05))
            P.hull(bf, key, [q1 - d * 0.075, q1 - d * 0.04, q1 - d * 0.005], [0.003, 0.016, 0.006], [0.002, 0.002, 0.002], seg=4, side=v)
    return R
