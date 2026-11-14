"""The Camp-Mother (one of the War's two traders): she feeds both armies from one fire and takes both armies' shards.
A broad, strong woman, auburn hair in buns, a wide straw hat with two ribbons, one crimson and one azure. A cream blouse
with sleeves rolled up, a black laced bodice, a long dark green skirt with a cream apron, a small cask strapped on her
back with a brass tap. In the LEFT hand, held up, a tall brass jug, a warm glow at its lip from the mulled wine in it:
her one light (hold: torch). Signature shape: the straw hat and the cask on her back."""
import math

from mathutils import Vector

from realkit import PI, Real
from real import parts_a as PA
from real import parts_c as P
import folk as K


def build():
    R = Real("war_camp", sex="f", height=0.99, width=1.1, depth=1.08, skin="#c99070")
    z = R.z
    R.mat("cream", "#e2d6b8", rough=0.78, double=True)
    R.mat("black", "#1d1b21", rough=0.5, double=True)
    R.mat("green", "#26372a", rough=0.7, double=True)
    R.mat("straw", "#c8a45a", rough=0.85, double=True)
    R.mat("crimson", "#7a1a24", rough=0.62, double=True)
    R.mat("azure", "#24427e", rough=0.62, double=True)
    R.mat("wood", "#5a3a22", rough=0.65)
    R.mat("brass", "#c9a24a", rough=0.3, metal=0.85, double=True)
    R.mat("glow", "#ffc890", rough=0.4, emit="#ff8a3a", strength=1.0)
    R.hair("Hair_Buns", "#6a2a14", rough=0.55)

    R.fitted("Blouse", lambda i: R.dom[i].startswith(("spine", "pelvis", "clavicle")) or R.dom[i].startswith("upperarm"), "cream", offset=0.008)
    for n in "lr":
        P.sleeve(R, n, "cream", t0=0.4, t1=1.05, r0=0.02, r1=0.0, bones=("upperarm", "lowerarm"), seg=14, n=3)
    R.fitted("Bodice", lambda i: R.dom[i].startswith(("spine", "pelvis")) and z["waist"] - 0.08 < R.world[i].z < z["chest"] + 0.02, "black", offset=0.016)
    up = R.piece(P.trunk_w(R))
    for k in range(5):
        zz = z["waist"] - 0.05 + (z["chest"] - z["waist"] + 0.05) * k / 4
        P.band_on(R, up, "brass", [(zz, 0.12), (zz + 0.02, 0.0), (zz, -0.12)], 0.005, thick=0.004, off=0.022, n=6)
    R.fitted("Under", ["thigh", "calf"], "green", offset=0.004)
    R.boots("black", top=z["ankle"] + 0.06)
    P.toes(R, "black")
    hem = z["ankle"] + 0.02
    P.skirt(R, "green", hem, flare=1.6, depth=1.14, folds=10, amp=0.026, trim="brass", trim_h=0.02, seg=56)
    P.skirt(R, "cream", z["knee"] - 0.18, flare=1.64, depth=1.15, arc=(-0.85, 0.85), folds=4, amp=0.01, grow=1.05, seg=24)
    R.band("cream", z["waist"] - 0.05, height=0.03, grow=1.17)

    # the straw hat with its two ribbons down her back
    f, hb, nrm = K.wide_hat(R, "straw", "crimson", brim=0.28, crown=(0.11, 0.12, 0.07), tilt=(0.05, 0.1), lift=0.04)
    f.torus("azure", hb + nrm * 0.034, 0.112, 0.01, normal=nrm, seg=(28, 6))
    hd = P.head(R)
    tw = R.piece(P.head_spine_w(R, hd.base - 0.02, z["chest"]))
    ny = R.bone("neck_01").y
    for key, sx in (("crimson", 0.03), ("azure", -0.03)):
        tw.tube(key, [Vector((sx, hd.y1 + 0.01, hd.top - 0.08)), Vector((sx * 1.5, hd.y1 + 0.06, hd.base - 0.02)), Vector((sx * 2, ny + 0.12, z["chest"] - 0.04))],
                [0.02, 0.022, 0.02], seg=6, squash=((0, 1, 0), 0.25))

    # the cask on her back, a brass tap
    bf, bc, (cc, rxc, ryc), ny2 = K.back_frame(R)
    c = Vector((0, cc.y + ryc + 0.15, z["chest"] - 0.12))
    P.hull(bf, "wood", [c - Vector((0.17, 0, 0)), c - Vector((0.08, 0, 0)), c + Vector((0.08, 0, 0)), c + Vector((0.17, 0, 0))], [0.11, 0.135, 0.135, 0.11], seg=20, side=Vector((0, 0, 1)))
    for x in (-0.15, -0.06, 0.06, 0.15):
        bf.torus("black", c + Vector((x, 0, 0)), 0.115 + 0.022 * (1 - abs(x) / 0.17) + 0.005, 0.008, normal=(1, 0, 0), seg=(24, 5))
    bf.tube("brass", [c + Vector((0.17, 0, -0.03)), c + Vector((0.22, 0, -0.03)), c + Vector((0.23, 0, -0.06))], 0.01, seg=6)
    K.shoulder_straps(R, bf, "black", cc.y + ryc + 0.03)

    # the tall jug
    h = K.hand(R)
    hf = h.f
    body = [K.at(h, -0.3, fwd=0.1), K.at(h, -0.24, fwd=0.1), K.at(h, -0.12, fwd=0.1), K.at(h, -0.02, fwd=0.1), K.at(h, 0.04, fwd=0.1)]
    P.hull(hf, "brass", body, [0.05, 0.065, 0.06, 0.04, 0.05], seg=18, side=h.side)
    hf.tube("brass", [K.at(h, 0.02, fwd=0.06), K.at(h, 0.03, fwd=0.0), K.at(h, -0.08, fwd=-0.01), K.at(h, -0.2, fwd=0.05)], 0.01, seg=6)
    hf.ellipsoid("glow", K.at(h, 0.035, fwd=0.1), (0.038, 0.038, 0.012), seg=(12, 6), rot=P.rot_to(h.d))
    return R
