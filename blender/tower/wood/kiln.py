"""The Kiln-Mother (the Wood's quest giver out in the clearing): she tends the charcoal stacks whose smoke keeps the
hounds of the wood away. A broad strong woman, dark hair in buns, a moss kerchief at her neck. A burnt-umber dress to the
calf with cream sleeves rolled to the elbow and bare forearms, a black leather apron front with a bib and gold rivets, a
tall woven basket of charcoal on her back. In the LEFT hand a long iron fire-rake, an ember glowing in its tines: her
one light (hold: torch). Signature shape: the basket on the back and the rake."""
import math

from mathutils import Vector

from realkit import PI, Real
from real import parts_a as PA
from real import parts_c as P
import folk as K


def build():
    R = Real("wood_kiln", sex="f", height=0.99, width=1.08, depth=1.06, skin="#a8724f")
    z = R.z
    R.mat("rust", "#6a3c1c", rough=0.72, double=True)
    R.mat("moss", "#3f5222", rough=0.8, double=True)
    R.mat("cream", "#ddd2b2", rough=0.8, double=True)
    R.mat("leather", "#1f1a1c", rough=0.5, double=True)
    R.mat("rope", "#7a5a30", rough=0.9)
    R.mat("coal", "#18171b", rough=0.9)
    R.mat("iron", "#3c3f47", rough=0.42, metal=0.75)
    R.mat("wood", "#4a3220", rough=0.7)
    R.mat("gold", "#c9a24a", rough=0.32, metal=0.85, double=True)
    R.mat("glow", "#ff9a40", rough=0.4, emit="#ff6a1a", strength=1.0)
    R.hair("Hair_Buns", "#2a1e18", rough=0.6)

    # the dress to the elbows, sleeves rolled, bare forearms; the skirt to the calf
    el = R.bone("lowerarm_l").x
    R.fitted("Dress", lambda i: R.dom[i].startswith(("spine", "pelvis", "clavicle")) or R.dom[i].startswith("upperarm"), "rust", offset=0.008)
    for n in "lr":
        P.sleeve(R, n, "cream", t0=0.5, t1=1.04, r0=0.014, r1=0.0, bones=("upperarm", "lowerarm"), seg=14, n=3)
        P.sleeve(R, n, "cream", t0=-0.02, t1=0.1, r0=0.02, r1=0.0, seg=14, n=2)
    R.fitted("Hose", ["thigh", "calf"], "leather", offset=0.004)
    R.boots("leather", top=z["ankle"] + 0.1)
    P.toes(R, "leather")
    hem = z["knee"] - 0.2
    P.skirt(R, "rust", hem, flare=1.55, depth=1.12, folds=9, amp=0.022, trim="gold", trim_h=0.02, seg=52)
    # the apron: a front panel to just above the hem, a bib on the chest, gold rivets, ties
    P.skirt(R, "leather", hem + 0.05, flare=1.6, depth=1.13, arc=(-0.95, 0.95), folds=4, amp=0.01, grow=1.05, seg=24)
    up = R.piece(P.trunk_w(R))
    P.wrap(R, up, "leather", z["waist"] - 0.02, z["chest"] + 0.04, -0.62, 0.62, off=0.02, taper=(1.0, 0.75))
    for s in (1, -1):
        p, out = P.on_trunk(R, z["chest"] + 0.03, 0.5 * s, off=0.026)
        up.ellipsoid("gold", p, (0.012, 0.012, 0.012), seg=(8, 6))
    R.band("leather", z["waist"], height=0.04, grow=1.15)
    # the kerchief at her neck, knotted at the front
    fc, foot, top = P.collar(R, "moss", height=0.05, grow=1.12, flare=0.12)
    fc.ellipsoid("moss", foot + Vector((0, -0.01, -0.01)), (0.03, 0.02, 0.025), seg=(10, 8))
    fc.tube("moss", [foot + Vector((0.0, -0.015, -0.02)), foot + Vector((0.025, -0.02, -0.08))], [0.022, 0.01], seg=8, squash=((0, 1, 0), 0.35))

    # the tall charcoal basket on her back, on two straps
    bf, bc, (cc, rxc, ryc), ny = K.back_frame(R)
    base = Vector((0, cc.y + ryc + 0.15, z["waist"] - 0.1))
    top = K.basket(bf, "rope", "wood", base, 0.13, 0.17, 0.4, bands=(0.35, 0.7), band_key="wood")
    for k in range(9):
        a = 2 * PI * k / 9
        rr = 0.1 * (0.4 + 0.6 * ((k * 3) % 4) / 3)
        bf.ellipsoid("coal", top + Vector((rr * math.cos(a), rr * math.sin(a) * 0.8, 0.02 + 0.03 * (k % 2))), (0.06, 0.05, 0.05), seg=(10, 6))
    bf.ellipsoid("coal", top + Vector((0, 0, 0.06)), (0.08, 0.07, 0.07), seg=(10, 6))
    K.shoulder_straps(R, bf, "leather", cc.y + ryc + 0.03)

    # the fire-rake in the left hand: an iron pole, a crossbar with five tines bent forward, an ember caught in them
    h = K.hand(R)
    top = K.pole(h, "iron", back=1.2, front=0.6, r=0.013, butt="iron", rings=(-0.5, 0.25), ring_key="gold")
    f = h.f
    bar = [top - h.side * 0.16, top + h.side * 0.16]
    f.tube("iron", bar, 0.016, seg=8)
    f.ellipsoid("gold", top, P.rr(R, 0.02), seg=(10, 8))
    for k in range(5):
        b = bar[0].lerp(bar[1], k / 4)
        f.tube("iron", [b, b + h.d * 0.08 * h.s + h.fwd * 0.02, b + h.d * 0.13 * h.s + h.fwd * 0.09], [0.011, 0.009, 0.004], seg=6)
    f.ellipsoid("glow", top + h.d * 0.07 * h.s + h.fwd * 0.04, P.rr(R, 0.032), seg=(12, 8))
    return R
