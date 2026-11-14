"""The Glass-Seller (one of the Sands' two traders): she gathers the glass the lightning leaves in the dunes and sells
it by the light it still holds. A slim woman, long black hair in one braid, a head-band of gold coins on her brow. A short turquoise jacket with gold edges over a cream blouse, a sash of sand, wide
saffron trousers gathered at the ankle, soft boots. A satchel of bottles at her hip. In the LEFT hand, held up, a tall
bottle of lightning glass whose light flickers turquoise: her one light (hold: torch). Signature shape: the coin band,
the wide trousers and the tall bottle."""
import math

from mathutils import Vector

from realkit import PI, Real
from real import parts_a as PA
from real import parts_b as PB
from real import parts_c as P
import folk as K


def build():
    R = Real("sands_glass", sex="f", height=0.98, width=0.93, depth=0.95, skin="#b07a52")
    z = R.z
    R.mat("turq", "#1f7a76", rough=0.62, double=True)
    R.mat("veil", "#8ccac4", rough=0.6, double=True)
    R.mat("cream", "#e2d6b8", rough=0.8, double=True)
    R.mat("saffron", "#a8701e", rough=0.62, double=True)
    R.mat("sand", "#c8a46a", rough=0.75, double=True)
    R.mat("leather", "#5a3a22", rough=0.6, double=True)
    R.mat("glass", "#a8dcd6", rough=0.12)
    R.mat("gold", "#d2ae55", rough=0.32, metal=0.85, double=True)
    R.mat("glow", "#e0fffa", rough=0.25, emit="#40e0d0", strength=1.0)
    R.hair("Hair_Long", "#14100e", rough=0.5)

    # blouse, the short jacket, sash, the wide trousers
    R.fitted("Blouse", ["spine", "pelvis", "clavicle", "upperarm", "lowerarm"], "cream", offset=0.008)
    for n in "lr":
        P.sleeve(R, n, "cream", t0=0.3, t1=0.92, r0=0.012, r1=0.05, seg=14, n=3)
    R.cuffs("gold", at=(0.9,), offset=0.01, thick=0.006)
    R.fitted("Jacket", lambda i: (R.dom[i].startswith(("spine", "clavicle")) and R.world[i].z > z["waist"] + 0.03) or R.dom[i].startswith("upperarm"),
             "turq", offset=0.016, where=PB.open_front(R, top=0.07, bottom=0.1))
    PA.shoulder_ring(R, "gold", thick=0.005, t=0.85, offset=0.02)
    up = R.piece(P.trunk_w(R))
    for s in (1, -1):
        P.band_on(R, up, "gold", [(z["waist"] + 0.04, 0.5 * s), (z["chest"] + 0.02, 0.42 * s), (z["neck"] - 0.04, 0.62 * s)], 0.007, thick=0.004, off=0.022)
    R.band("sand", z["waist"], height=0.06, grow=1.14)
    R.fitted("Trousers", ["thigh", "calf", "pelvis"], "saffron", offset=0.01, below=z["waist"] - 0.02)
    R.boots("leather", top=z["ankle"] + 0.05)
    P.toes(R, "leather")
    for n in "lr":
        P.sleeve(R, n, "saffron", t0=0.1, t1=0.9, r0=0.04, r1=0.12, bones=("thigh", "calf"), seg=16, n=4)
        c, r = R.leg_r(n, z["ankle"] + 0.07)
        R.piece(f"calf_{n}").torus("gold", c, r + 0.014, 0.008, seg=(20, 5))
    P.skirt(R, "saffron", z["hip"] - 0.1, flare=1.3, depth=1.15, folds=6, amp=0.014, seg=40)

    # the satchel of bottles on her right hip
    cw, rxw, ryw = R.ring(z["waist"])
    sb = R.piece("pelvis")
    sc = Vector((-rxw * 1.25, cw.y, z["hip"] - 0.03))
    P.box(sb, "leather", sc, (0.035, 0.08, 0.07))
    for k in range(3):
        p = sc + Vector((-0.005, -0.05 + 0.05 * k, 0.07))
        P.hull(sb, "glass", [p, p + Vector((0, 0, 0.05)), p + Vector((0, 0, 0.08))], [0.018, 0.014, 0.006], seg=10)

    # the coin band with its veil over the lower face
    hd = P.head(R)
    hp = R.piece("Head")
    cz = hd.brow + 0.03
    pts = [Vector((hd.rx * 1.1 * math.sin(2 * PI * i / 36), hd.c.y - hd.ry * 1.14 * math.cos(2 * PI * i / 36), cz + 0.01 * math.cos(2 * PI * i / 36))) for i in range(37)]
    hp.tube("gold", pts, 0.006, seg=6, caps=False)
    for i in range(-8, 9, 2):
        p = pts[i % 36]
        hp.tube("gold", [p, p + Vector((0, 0, -0.022))], 0.002, seg=4)
        hp.ellipsoid("gold", p + Vector((0, -0.004, -0.03)), (0.009, 0.003, 0.009), seg=(8, 4))

    # the tall bottle of lightning glass, held up by its neck
    h = K.hand(R)
    hf = h.f
    pts = [K.at(h, 0.06), K.at(h, 0.0), K.at(h, -0.06), K.at(h, -0.1), K.at(h, -0.2), K.at(h, -0.32), K.at(h, -0.35)]
    P.hull(hf, "glass", pts, [0.016, 0.016, 0.02, 0.05, 0.055, 0.05, 0.03], seg=16, side=h.fwd)
    hf.torus("gold", K.at(h, 0.06), 0.02, 0.006, normal=h.d, seg=(12, 5))
    hf.torus("gold", K.at(h, -0.1), 0.05, 0.006, normal=h.d, seg=(18, 5))
    hf.ellipsoid("glow", K.at(h, -0.22), (0.035, 0.035, 0.06), seg=(12, 8), rot=P.rot_to(h.d))
    return R
