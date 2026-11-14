"""The Amber-Seller (one of the Wood's two traders): she sells the wood's amber, the old resin with the forest's
memories caught in it. Long auburn hair under a gold circlet of oak leaves. A cream blouse with full sleeves, a moss
green bodice edged in gold, a long amber-gold skirt with a bark hem, a pedlar's tray of black lacquer carried at the
waist on a strap round her neck, heaped with amber stones. In the LEFT hand, held up, a great amber drop on a gold chain
that glows: her one light (hold: torch). Signature shape: the tray in front and the hanging amber."""
import math

from mathutils import Vector

from realkit import PI, Real
from real import parts_a as PA
from real import parts_c as P
import folk as K


def build():
    R = Real("wood_amber", sex="f", height=0.98, width=0.96, depth=0.98, skin="#d9b190")
    z = R.z
    R.mat("cream", "#e6dcc4", rough=0.75, double=True)
    R.mat("moss", "#4c6a2a", rough=0.7, double=True)
    R.mat("amber", "#b4782a", rough=0.62, double=True)
    R.mat("bark", "#4a3220", rough=0.7, double=True)
    R.mat("lacquer", "#1d1b21", rough=0.45, double=True)
    R.mat("stone", "#d9902a", rough=0.25)
    R.mat("gold", "#d2ae55", rough=0.32, metal=0.85, double=True)
    R.mat("glow", "#ffd890", rough=0.2, emit="#ffa030", strength=1.0)
    R.hair("Hair_Long", "#5a2a16", rough=0.5)

    # the blouse with full sleeves, the bodice
    R.fitted("Blouse", ["spine", "pelvis", "clavicle", "upperarm", "lowerarm"], "cream", offset=0.008)
    for n in "lr":
        P.sleeve(R, n, "cream", t0=0.2, t1=0.92, r0=0.02, r1=0.06, bones=("upperarm", "lowerarm"), seg=16, n=4)
        P.sleeve(R, n, "cream", t0=0.4, t1=0.9, r0=0.01, r1=0.045, seg=16, n=3)
    R.cuffs("gold", at=(0.9,), offset=0.01, thick=0.007)
    R.fitted("Bodice", lambda i: R.dom[i].startswith(("spine", "pelvis")) and z["waist"] - 0.08 < R.world[i].z < z["chest"] + 0.03, "moss", offset=0.016)
    up = R.piece(P.trunk_w(R))
    P.band_on(R, up, "gold", [(z["chest"] + 0.025, -1.7), (z["chest"] + 0.035, 0.0), (z["chest"] + 0.025, 1.7)], 0.009, thick=0.006, off=0.02)
    P.band_on(R, up, "gold", [(z["waist"] - 0.07, -1.7), (z["waist"] - 0.075, 0.0), (z["waist"] - 0.07, 1.7)], 0.009, thick=0.006, off=0.02)

    # the long amber skirt, a bark hem, soft boots
    R.fitted("Under", ["thigh", "calf"], "bark", offset=0.004)
    R.boots("bark", top=z["ankle"] + 0.06)
    P.toes(R, "bark")
    hem = z["ankle"] + 0.02
    f, rings = P.skirt(R, "amber", hem, flare=1.62, depth=1.14, folds=10, amp=0.028, trim="bark", trim_h=0.05, seg=56)

    # the circlet of gold oak leaves
    hd = P.head(R)
    hp = R.piece("Head")
    cz = hd.brow + 0.05
    pts = [Vector((hd.rx * 1.08 * math.sin(2 * PI * i / 36), hd.c.y - hd.ry * 1.12 * math.cos(2 * PI * i / 36), cz + 0.01 * math.cos(2 * PI * i / 36))) for i in range(37)]
    hp.tube("gold", pts, 0.005, seg=6, caps=False)
    for i in range(-5, 6):
        a = 2 * PI * i / 36
        p = Vector((hd.rx * 1.1 * math.sin(a), hd.c.y - hd.ry * 1.14 * math.cos(a), cz + 0.01 * math.cos(a)))
        out = Vector((math.sin(a), -math.cos(a), 0))
        tip = p + Vector((0, 0, 0.045 - 0.02 * abs(i) / 5)) + out * 0.006
        P.leaf(hp, "gold", p, tip, 0.024, out)

    # the pedlar's tray, heaped with amber
    tf, top = K.tray(R, "lacquer", "gold", depth=0.12, width=0.19, strap="bark")
    for k in range(11):
        x = -0.15 + 0.3 * ((k * 7) % 11) / 10
        y = -0.09 + 0.18 * ((k * 4) % 11) / 10
        r = 0.024 + 0.01 * (k % 3)
        tf.ellipsoid("stone", top + Vector((x, y, r * 0.6)), (r, r * 0.85, r * 0.7), seg=(10, 7))

    # the amber drop on its chain, held up in the left hand
    h = K.hand(R)
    hf = h.f
    hf.torus("gold", K.at(h, 0.02), 0.026, 0.006, normal=h.side, seg=(14, 5))
    a, b = K.at(h, 0.0), K.at(h, -0.2, fwd=0.04)
    links = 9
    for k in range(links):
        p = a.lerp(b, (k + 0.5) / links)
        hf.torus("gold", p, 0.009, 0.0028, normal=h.side if k % 2 else h.fwd, seg=(10, 4))
    hf.ellipsoid("gold", b, P.rr(R, 0.014), seg=(10, 8))
    P.hull(hf, "glow", [b - h.d * 0.005 * h.s, b - h.d * 0.04 * h.s, b - h.d * 0.09 * h.s, b - h.d * 0.12 * h.s], [0.015, 0.045, 0.045, 0.006], seg=16, side=h.fwd)
    return R
