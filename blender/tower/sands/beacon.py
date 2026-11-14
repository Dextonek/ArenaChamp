"""The Beacon-Keeper (the Sands' quest giver out at the travellers' court): she keeps the watch fires that warn the
road of a storm coming. A strong young woman, a saffron headscarf wound over her hair with its end over one shoulder. A
terracotta tunic to the knee with a sand-coloured sash, loose cream trousers gathered at the ankle, wrapped sandals,
gold bands on her bare forearms. In the LEFT hand a short iron pole with a fire basket at its top, its coals glowing:
her one light (hold: torch). Signature shape: the headscarf and the fire basket."""
import math

from mathutils import Vector

from realkit import PI, Real
from real import parts_a as PA
from real import parts_c as P
import folk as K


def build():
    R = Real("sands_beacon", sex="f", height=0.99, width=1.0, depth=1.0, skin="#8a5636")
    z = R.z
    R.mat("terra", "#9a4a28", rough=0.7, double=True)
    R.mat("saffron", "#d0901e", rough=0.62, double=True)
    R.mat("sand", "#c8a46a", rough=0.75, double=True)
    R.mat("cream", "#e2d6b8", rough=0.8, double=True)
    R.mat("wrap", "#3a2a22", rough=0.8, double=True)
    R.mat("iron", "#3c3f47", rough=0.42, metal=0.75)
    R.mat("coal", "#18171b", rough=0.9)
    R.mat("gold", "#c9a24a", rough=0.32, metal=0.85, double=True)
    R.mat("glow", "#ffb060", rough=0.4, emit="#ff7a20", strength=1.0)
    R.hair(None, "#1a1210")
    R.mat("hair", "#1a1210", rough=0.6)
    PA.hair_cap(R, "hair", grow=1.05)

    # the tunic with short sleeves, bare forearms with gold bands; trousers gathered at the ankle
    el = R.bone("lowerarm_l").x
    R.fitted("Tunic", lambda i: R.dom[i].startswith(("spine", "pelvis", "clavicle", "upperarm")), "terra", offset=0.009)
    for n in "lr":
        P.sleeve(R, n, "terra", t0=0.6, t1=1.02, r0=0.014, r1=0.0, bones=("upperarm", "lowerarm"), seg=14, n=2)
    R.cuffs("gold", at=(0.35, 0.85), offset=0.006, thick=0.006)
    R.fitted("Trousers", ["thigh", "calf"], "cream", offset=0.008)
    R.boots("wrap", top=z["ankle"] + 0.07)
    P.toes(R, "wrap")
    for n in "lr":
        c, r = R.leg_r(n, z["ankle"] + 0.08)
        R.piece(f"calf_{n}").torus("cream", c, r + 0.018, 0.016, seg=(20, 6))
        R.piece(f"calf_{n}").ellipsoid("cream", c + Vector((0, 0, 0.06)), (r + 0.02, r + 0.02, 0.06), seg=(16, 8))
    P.skirt(R, "terra", z["knee"] - 0.04, flare=1.42, depth=1.12, folds=7, amp=0.016, trim="gold", trim_h=0.018, seg=48)
    how = R.hang_w(z["waist"], z["knee"])
    R.band("sand", z["waist"], height=0.07, grow=1.15, how=how)
    cw, rxw, ryw = R.ring(z["waist"])
    g = R.piece(how)
    p0 = Vector((rxw * 0.9, cw.y - ryw * 0.6, z["waist"] - 0.02))
    g.tube("sand", [p0, p0 + Vector((0.02, -0.01, -0.16)), p0 + Vector((0.03, -0.01, -0.3))], 0.03, seg=8, squash=((1, 0, 0), 0.3))

    # the headscarf: a cap wound round the head, a band across the brow, an end down over her left shoulder
    f, c, hr, rim = PA.hood(R, "saffron", grow=1.3, open=0.42, tilt=0.3, shape=(1.0, 1.08, 1.04), shift=(0, 0.02, 0.0), edge="gold", edge_r=0.005)
    hd = P.head(R)
    tw = R.piece(P.head_spine_w(R, hd.base - 0.02, z["chest"]))
    ny = R.bone("neck_01").y
    tw.tube("saffron", [Vector((hd.rx * 0.9, hd.c.y + 0.03, hd.base + 0.02)), Vector((0.12, ny + 0.02, z["neck"] - 0.01)),
                        Vector((0.16, ny - 0.04, z["chest"] + 0.03)), Vector((0.15, ny - 0.08, z["chest"] - 0.12))], [0.03, 0.04, 0.045, 0.035], seg=8, squash=((0, 1, 0), 0.35))
    PA.cowl(R, "saffron", grow=0.96, low=0.06, high=0.02)

    # the fire basket on a short iron pole
    h = K.hand(R)
    top = K.pole(h, "iron", back=0.7, front=0.35, r=0.014, butt="gold", rings=(0.2,))
    hf = h.f
    b0 = top
    hf.torus("gold", b0, 0.03, 0.008, normal=h.d, seg=(16, 5))
    for k in range(8):
        u = h.fwd * math.cos(2 * PI * k / 8) + h.side * math.sin(2 * PI * k / 8)
        hf.tube("iron", [b0 + u * 0.02, b0 + u * 0.07 + h.d * 0.07 * h.s, b0 + u * 0.1 + h.d * 0.16 * h.s], [0.007, 0.006, 0.005], seg=5)
    for t, rr in ((0.07, 0.072), (0.16, 0.1)):
        hf.torus("iron", b0 + h.d * t * h.s, rr, 0.007, normal=h.d, seg=(22, 5))
    for k in range(6):
        u = h.fwd * math.cos(2 * PI * k / 6) + h.side * math.sin(2 * PI * k / 6)
        hf.ellipsoid("coal", b0 + h.d * 0.11 * h.s + u * 0.04, P.rr(R, 0.032), seg=(10, 6))
    hf.ellipsoid("glow", b0 + h.d * 0.14 * h.s, (0.06, 0.06, 0.04), seg=(12, 8), rot=P.rot_to(h.d))
    return R
