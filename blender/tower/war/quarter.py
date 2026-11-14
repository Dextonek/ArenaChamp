"""The Quartermaster (one of the War's two traders): he keeps the stores that both armies left behind, and opens them
for shards. A tall broad man with a grey moustache under a tall black fur hat with a gold plate. A long iron-grey coat to
below the knee, its front closed with gold frogging, a crimson sash on one side and an azure one on the other, black
boots. A great ring of iron keys at his belt. In the LEFT hand, held up, a storm lantern of iron and gold: his one light
(hold: torch). Signature shape: the tall fur hat and the long coat."""
import math

from mathutils import Vector

from realkit import PI, Real
from real import parts_a as PA
from real import parts_c as P
import folk as K


def build():
    R = Real("war_quarter", sex="m", height=1.04, width=1.1, depth=1.08, skin="#c49478")
    z = R.z
    R.mat("grey", "#4a4c54", rough=0.7, double=True)
    R.mat("fur", "#1a181c", rough=0.95, double=True)
    R.mat("crimson", "#7a1a24", rough=0.62, double=True)
    R.mat("azure", "#24427e", rough=0.62, double=True)
    R.mat("black", "#1d1b21", rough=0.45, double=True)
    R.mat("iron", "#3c3f47", rough=0.4, metal=0.75)
    R.mat("glass", "#e8dcc0", rough=0.15)
    R.mat("gold", "#c9a24a", rough=0.32, metal=0.85, double=True)
    R.mat("glow", "#ffe0a0", rough=0.35, emit="#ffb040", strength=1.0)
    P.hair(R, "Hair_Buzzed", "#8a8682", beard="Hair_Beard")

    R.fitted("Coat", ["spine", "pelvis", "clavicle", "upperarm", "lowerarm"], "grey", offset=0.012)
    R.cuffs("gold", at=(0.88,), offset=0.016, thick=0.012)
    R.fitted("Legs", ["thigh", "calf"], "black", offset=0.004)
    R.boots("black", top=z["knee"] + 0.04, cuff="gold")
    P.toes(R, "black")
    P.skirt(R, "grey", z["knee"] - 0.12, flare=1.45, depth=1.12, folds=8, amp=0.016, trim="gold", trim_h=0.02, seg=52)
    up = R.piece(P.trunk_w(R))
    for k in range(5):
        zz = z["waist"] + (z["chest"] - z["waist"] + 0.06) * k / 4
        P.band_on(R, up, "gold", [(zz, -0.32), (zz + 0.005, 0.0), (zz, 0.32)], 0.007, thick=0.005, off=0.02)
        for s in (1, -1):
            p, out = P.on_trunk(R, zz, 0.34 * s, off=0.022)
            up.ellipsoid("gold", p, (0.012, 0.012, 0.012), seg=(8, 6))
    P.collar(R, "grey", height=0.07, grow=1.05, flare=0.05, rim="gold", rim_r=0.006)
    R.pauldrons("grey", size=(0.07, 0.06, 0.025), lift=0.04, out=0.02)
    # the two sashes, crossing at the waist
    for key, hs in (("crimson", 1), ("azure", -1)):
        PA.strap(R, key, width=0.05, lift=0.18, grow=1.14, high_side=hs, out=0.026)
    R.band("black", z["waist"] - 0.04, height=0.05, grow=1.2)
    cw, rxw, ryw = R.ring(z["waist"])
    kg = R.piece("pelvis")
    kc = Vector((rxw * 1.2, cw.y - 0.02, z["waist"] - 0.12))
    kg.torus("iron", kc, 0.06, 0.008, normal=(1, 0, 0), seg=(20, 5))
    for k in range(5):
        a = -0.9 + 0.45 * k
        p = kc + Vector((0, 0.06 * math.sin(a), -0.06 * math.cos(a)))
        q = p + Vector((0.01, 0.02 * math.sin(a), -0.1))
        kg.tube("iron", [p, q], 0.006, seg=5)
        kg.ellipsoid("iron", p + Vector((0, 0, -0.012)), (0.014, 0.014, 0.014), seg=(8, 6))
        kg.tube("iron", [q, q + Vector((0, 0.02, 0))], 0.008, seg=5)

    # the tall fur hat with its gold plate
    hd = P.head(R)
    hp = R.piece("Head")
    b = Vector((0, hd.c.y + 0.01, hd.brow + 0.015))
    P.hull(hp, "fur", [b, b + Vector((0, 0.005, 0.08)), b + Vector((0, 0.01, 0.17)), b + Vector((0, 0.012, 0.2))], [hd.rx * 1.18, hd.rx * 1.24, hd.rx * 1.2, hd.rx * 0.9],
           [hd.ry * 1.22, hd.ry * 1.28, hd.ry * 1.24, hd.ry * 0.92], seg=24, side=Vector((1, 0, 0)))
    pf = b + Vector((0, -hd.ry * 1.3, 0.08))
    P.plate(hp, "gold", [pf + Vector((-0.04, 0, -0.035)), pf + Vector((0.04, 0, -0.035)), pf + Vector((0.03, 0, 0.04)), pf + Vector((0, 0, 0.06)), pf + Vector((-0.03, 0, 0.04))], 0.008, normal=(0, -1, 0))
    hp.tube("crimson", [b + Vector((hd.rx * 1.2, -0.02, 0.12)), b + Vector((hd.rx * 1.3, 0.0, 0.26))], [0.015, 0.006], seg=6)

    # the storm lantern, held up by its bail
    h = K.hand(R)
    h.f.tube("iron", [K.at(h, 0.0, side=-0.05), K.at(h, 0.04), K.at(h, 0.0, side=0.05)], 0.005, seg=5)
    K.lantern(h, K.at(h, 0.0), "iron", "glass", "glow", size=1.4, chain=0.02)
    return R
