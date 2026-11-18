"""The Coral-Pedlar (one of the Sea's two traders): he sells what grows on the drowned reef, and carries the reef on his
back. A broad man, dark short hair and a short beard, a gold ring in one ear. A sou'wester hat of oiled ochre with its
long brim down his neck; a long black oilskin coat to the knee with gold buttons, open over a sea-green jersey; black
boots. On his back a tall pannier of woven rope from which branches of coral rise over his head. In the LEFT hand,
held up, a great open scallop shell rimmed in gold, a pearl of sea-glass light in it: his one light (hold: torch).
Signature shape: the coral over his shoulders."""
import math

from mathutils import Vector

from realkit import PI, Real
from real import parts_a as PA
from real import parts_b as PB
from real import parts_c as P
import folk as K


def build():
    R = Real("sea_pedlar", sex="m", height=1.0, width=1.12, depth=1.1, skin="#a8764f")
    z = R.z
    R.mat("oil", "#1d1b21", rough=0.4, double=True)
    R.mat("sea", "#2a5a52", rough=0.75, double=True)
    R.mat("cream", "#b8862a", rough=0.55, double=True)
    R.mat("rope", "#8a6a3a", rough=0.9)
    R.mat("coral", "#e0785a", rough=0.6)
    R.mat("shell", "#ead8c4", rough=0.45)
    R.mat("pink", "#d89a8a", rough=0.4)
    R.mat("gold", "#c9a24a", rough=0.32, metal=0.85, double=True)
    R.mat("glow", "#e0faff", rough=0.25, emit="#7fdcf5", strength=1.0)
    P.hair(R, "Hair_Buzzed", "#241812", beard="Hair_Beard")

    # the jersey, the long oilskin coat open in front, boots
    R.fitted("Jersey", ["spine", "pelvis"], "sea", offset=0.008)
    R.fitted("Coat", ["clavicle", "upperarm", "lowerarm"], "oil", offset=0.012)
    R.fitted("Coat2", ["spine", "pelvis"], "oil", offset=0.016, where=PB.open_front(R, top=0.07, bottom=0.08))
    P.collar(R, "sea", height=0.06, grow=1.0, flare=0.04)
    R.cuffs("gold", at=(0.93,), offset=0.014, thick=0.007)
    R.fitted("Trousers", ["thigh", "calf", "pelvis"], "oil", offset=0.004)
    R.boots("oil", top=z["knee"] - 0.04, cuff="gold")
    P.toes(R, "oil")
    P.skirt(R, "oil", z["knee"] - 0.05, flare=1.4, depth=1.12, arc=(0.4, 2 * PI - 0.4), folds=6, amp=0.015, trim="gold", trim_h=0.018, grow=1.05, seg=48)
    up = R.piece(P.trunk_w(R))
    for k in range(4):
        zz = z["chest"] - 0.02 - (z["chest"] - z["waist"] + 0.04) * k / 3
        for s in (1, -1):
            p, out = P.on_trunk(R, zz, 0.36 * s, off=0.024)
            up.ellipsoid("gold", p, (0.013, 0.013, 0.013), seg=(8, 6))
    R.band("rope", z["waist"], height=0.045, grow=1.16)
    # a gold ring in his left ear
    hd = P.head(R)
    R.piece("Head").torus("gold", hd.ear + Vector((0.008, 0.0, -0.035)), 0.012, 0.0028, normal=(1, 0, 0), seg=(12, 4))

    # the sou'wester: a round crown, a brim short in front and long down the back of the neck
    f, c, r = R.head_piece()
    top = z["top"]
    f.ellipsoid("cream", Vector((0, c.y + 0.01, top - 0.06)), (0.125, 0.135, 0.085), seg=(24, 12))
    rim = []
    for i in range(41):
        a = 2 * PI * i / 40
        back = max(0.0, -math.cos(a))
        rr = 0.17 + 0.07 * back ** 1.5
        rim.append(Vector((rr * math.sin(a), c.y + 0.01 - rr * math.cos(a) * 1.03, top - 0.08 - 0.07 * back ** 1.5)))
    inner = [Vector((0.118 * math.sin(2 * PI * i / 40), c.y + 0.01 - 0.128 * math.cos(2 * PI * i / 40), top - 0.075)) for i in range(41)]
    PA.grid(f, "cream", lambda u, v: inner[int(round(u * 40)) % 41].lerp(rim[int(round(u * 40)) % 41], v), 40, 3, close=True)
    f.tube("gold", rim, 0.006, seg=6, caps=False)
    f.torus("sea", Vector((0, c.y + 0.01, top - 0.07)), 0.122, 0.011, seg=(28, 6))

    # the rope pannier on his back, coral rising from it
    bf, bc, (cc, rxc, ryc), ny = K.back_frame(R)
    base = Vector((0, cc.y + ryc + 0.15, z["waist"] - 0.08))
    tp = K.basket(bf, "rope", "gold", base, 0.14, 0.18, 0.42, bands=(0.5,), band_key="oil")
    K.shoulder_straps(R, bf, "oil", cc.y + ryc + 0.03)
    for k, (dx, dy, hgt, lean) in enumerate(((-0.09, 0.0, 0.42, -0.5), (0.0, 0.03, 0.55, 0.1), (0.1, -0.02, 0.36, 0.6), (0.04, -0.06, 0.3, 0.3), (-0.05, 0.06, 0.32, -0.2))):
        b = tp + Vector((dx, dy, -0.04))
        tipp = b + Vector((lean * 0.12, 0.03, hgt))
        bf.tube("coral", [b, b.lerp(tipp, 0.5) + Vector((lean * 0.03, 0, 0)), tipp], [0.022, 0.016, 0.008], seg=8)
        for j in range(2):
            t = 0.45 + 0.25 * j
            p = b.lerp(tipp, t)
            side = 1 if (j + k) % 2 else -1
            bf.tube("coral", [p, p + Vector((side * 0.07, 0.0, 0.08 + 0.02 * j))], [0.012, 0.005], seg=6)
            bf.ellipsoid("coral", p + Vector((side * 0.07, 0.0, 0.085 + 0.02 * j)), (0.009, 0.009, 0.009), seg=(8, 6))
        bf.ellipsoid("coral", tipp, (0.01, 0.01, 0.01), seg=(8, 6))

    # a great scallop shell held up open, a pearl of sea-glass light in it
    h = K.hand(R)
    hf = h.f
    hf.tube("gold", [K.at(h, -0.02), K.at(h, 0.08, fwd=0.03)], 0.012, seg=8)
    hinge = K.at(h, 0.08, fwd=0.03)
    ribs = 9
    edge = []
    for k in range(ribs + 1):
        a = -1.05 + 2.1 * k / ribs
        tip = hinge + h.d * 0.2 * math.cos(a) * h.s + h.side * 0.2 * math.sin(a) + h.fwd * 0.04
        edge.append(tip)
        hf.tube("shell", [hinge, hinge.lerp(tip, 0.5) + h.fwd * 0.03, tip], [0.01, 0.018, 0.016], seg=8, squash=(tuple(h.fwd), 0.6))
    P.plate(hf, "pink", [hinge] + edge, 0.008, normal=h.fwd)
    hf.tube("gold", edge, 0.006, seg=6)
    hf.ellipsoid("glow", hinge + h.d * 0.09 * h.s + h.fwd * 0.04, P.rr(R, 0.032), seg=(12, 8))
    return R
