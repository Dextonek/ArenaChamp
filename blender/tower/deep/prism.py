"""The Prism Mother (the Deep's first ruler, a boss drawn about 2.5 to 2.7 times a hero's size: the Prism Mother, the
Hollow Queen, Mother of Echoes): the mother of the crystals, who throws their light through the halls. Built as a giantess:
tall, broad-shouldered, a smaller head, big hands. Grey-violet skin, long silver hair; a tall crown of amethyst crystals in
a ring, rising highest at the back; a veil of fine silver chains over her face from the crown's rim. A gown of deep
violet-black to the floor in long folds with a silver hem, a silver girdle of linked plates, a high collar; long sleeves.
In the LEFT hand a tall staff of dark silver, a great clear prism in a cage of silver at its top, lit cold mint: her one
light (hold: torch). Signature shape: the crown of crystals and the prism staff."""
import math

from mathutils import Vector

from realkit import PI, Real
from real import parts_a as PA
from real import parts_b as PB
from real import parts_c as P
import folk as K


def build():
    R = Real("deep_prism", sex="f", height=1.06, width=1.18, depth=1.12, head=0.86, skin="#a49cb4", eyes="#d8fff0")
    z = R.z
    R.mat("gown", "#1c142a", rough=0.6, double=True)
    R.mat("violet", "#3a2a5a", rough=0.6, double=True)
    R.mat("silver", "#c8ccd8", rough=0.28, metal=0.85, double=True)
    R.mat("amethyst", "#8a5ad0", rough=0.1, metal=0.1)
    R.mat("clear", "#e6f6ff", rough=0.05, alpha=0.55)
    R.mat("glow", "#e6fff6", rough=0.2, emit="#5affd2", strength=1.3)
    PB.big_hands(R, 1.25)
    z = R.z
    R.hair("Hair_Long", "#c8c8d0", rough=0.45)

    R.fitted("Gown", ["spine", "pelvis", "clavicle", "upperarm", "lowerarm"], "gown", offset=0.009)
    R.fitted("Under", ["thigh", "calf", "foot", "ball"], "gown", offset=0.005)
    for n in "lr":
        P.sleeve(R, n, "gown", t0=0.5, t1=1.02, r0=0.01, r1=0.09, rim="silver", rim_r=0.006, seg=16, n=4)
    hem = z["ankle"] - 0.03
    P.skirt(R, "gown", hem, flare=1.85, depth=1.15, folds=14, amp=0.03, seg=60, trim="silver", trim_h=0.03)
    how = R.hang_w(z["waist"], hem)
    cw, rxw, ryw = R.ring(z["waist"])
    g = R.piece(how)
    for k in range(16):
        a = -PI + 2 * PI * k / 16
        p, out = P.on_trunk(R, z["waist"], a, off=0.018)
        g.ellipsoid("silver", p, (0.035, 0.012, 0.02), seg=(8, 5))
    for k in range(6):
        g.ellipsoid("silver", Vector((0, cw.y - ryw * 1.2, z["waist"] - 0.05 - 0.06 * k)), (0.025 - 0.002 * k, 0.01, 0.025), seg=(8, 5))
    P.collar(R, "violet", height=0.1, grow=1.2, flare=0.2, rim="silver", rim_r=0.006)
    PA.cloak(R, "violet", hem=z["ankle"] + 0.02, width=0.46, depth=0.85, spread=1.3, top_spread=1.7, lining="gown", trim="silver", nu=18, nv=12)

    # the crown of crystals, the chain veil
    h = P.head(R)
    hp = R.piece("Head")
    zc = h.c.z + h.rz * 0.5
    ring = [Vector((h.rx * 1.06 * math.sin(a), h.c.y - h.ry * 1.06 * math.cos(a), zc)) for a in [-PI + 2 * PI * k / 28 for k in range(29)]]
    hp.tube("silver", ring, 0.012, seg=6)
    for k in range(13):
        a = -PI + 2 * PI * k / 13
        base = Vector((h.rx * 1.06 * math.sin(a), h.c.y - h.ry * 1.06 * math.cos(a), zc))
        back = 0.5 - 0.5 * math.cos(a)
        ln = 0.1 + 0.16 * back + (0.03 if k % 2 else 0)
        out = Vector((math.sin(a), -math.cos(a), 0))
        PB.shard(hp, "amethyst", base - Vector((0, 0, 0.01)), base + out * 0.03 + Vector((0, 0, ln)), 0.022, n=6)
    for k in range(13):
        a = -0.95 + 1.9 * k / 12
        top = Vector((h.rx * 1.06 * math.sin(a), h.c.y - h.ry * 1.08 * math.cos(a), zc - 0.01))
        hp.tube("silver", [top, top + Vector((0, -0.01, -0.06)), top + Vector((0, -0.008, -0.11))], 0.0025, seg=4)
        hp.ellipsoid("silver", top + Vector((0, -0.008, -0.115)), (0.005, 0.005, 0.005), seg=(6, 4))

    # the prism staff in the left hand
    hd = K.hand(R)
    f = hd.f
    K.pole(hd, "silver", back=1.3, front=0.55, r=0.018, butt="silver", rings=(-0.4, 0.2), ring_key="violet")
    top = K.at(hd, 0.72)
    PB.shard(f, "clear", K.at(hd, 0.55), top + hd.d * 0.14, 0.06, n=6, mid=0.45)
    f.ellipsoid("glow", K.at(hd, 0.66), P.rr(R, 0.035), seg=(12, 8))
    for k in range(4):
        a = PI / 2 * k + PI / 4
        u = hd.fwd * math.cos(a) + hd.side * math.sin(a)
        f.tube("silver", [K.at(hd, 0.55), K.at(hd, 0.62) + u * 0.07, K.at(hd, 0.75) + u * 0.07, top + hd.d * 0.06], 0.006, seg=5)
    return R
