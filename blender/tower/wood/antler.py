"""The Antler King (the Wood's third ruler, a boss drawn about 2.6 to 2.9 times a hero's size: the Antler King, the Lantern
Root, the Grey Oak): the hunt's lord, who wears the great stag he slew. Built as a giant: broad, deep, a smaller head, big
hands. Weathered tan skin, a short dark beard; on his head the bleached skull of a great stag as a helm, its brow over his
face and its two great antlers branching wide, a gold band round its base; amber light in the skull's eye holes. A cloak
of dark fur and green leaves over the shoulders, bark-brown leather armour, a green kilt to the knee with gold edges, tall
boots with fur tops. In the RIGHT hand a great spear of dark wood with a long leaf-shaped blade of bone, gold at the socket.
Signature shape: the antlers and the long bone spear."""
import math

from mathutils import Vector

from realkit import PI, Real
from real import parts_a as PA
from real import parts_b as PB
from real import parts_c as P


def antler(f, key, base, s, scale=1.0):
    """One antler: a beam rising and sweeping out and back, five tines up off it."""
    k = scale
    beam = [base, base + Vector((0.06 * s, 0.02, 0.1)) * k, base + Vector((0.2 * s, 0.06, 0.2)) * k, base + Vector((0.32 * s, 0.1, 0.34)) * k,
            base + Vector((0.4 * s, 0.16, 0.5)) * k, base + Vector((0.42 * s, 0.24, 0.62)) * k]
    pts = PA.smooth(beam, 4)
    f.tube(key, pts, [0.028 - 0.02 * i / (len(pts) - 1) for i in range(len(pts))], seg=8)
    for t, ln, lean in ((0.15, 0.14, -0.4), (0.38, 0.17, 0.0), (0.58, 0.16, 0.2), (0.78, 0.13, 0.35), (0.92, 0.1, 0.5)):
        p = pts[int(t * (len(pts) - 1))]
        tip = p + Vector((lean * 0.1 * s, -0.06 + 0.04 * t, ln)) * k
        f.tube(key, [p, p.lerp(tip, 0.5) + Vector((0.01 * s, 0, 0)), tip], [0.017 * (1 - 0.4 * t), 0.011, 0.003], seg=7)


def build():
    R = Real("wood_antler", sex="m", height=1.04, width=1.32, depth=1.28, head=0.84, skin="#b08a6c", eyes="#ffd890")
    z = R.z
    R.mat("leather", "#3a2a1c", rough=0.7, double=True)
    R.mat("green", "#2c4a28", rough=0.75, double=True)
    R.mat("fur", "#4a3a2c", rough=1.0, double=True)
    R.mat("leaf", "#3a5a2a", rough=0.7, double=True)
    R.mat("bone", "#e2d8bc", rough=0.5)
    R.mat("wood", "#2a1e14", rough=0.65)
    R.mat("gold", "#d2ae55", rough=0.3, metal=0.85, double=True)
    R.mat("glow", "#ffe0a0", rough=0.25, emit="#ffa830", strength=1.2)
    PB.big_hands(R, 1.3)
    z = R.z
    P.hair(R, "Hair_Buzzed", "#2a1e16", beard="Hair_Beard")

    R.fitted("Jerkin", ["spine", "pelvis", "clavicle", "upperarm"], "leather", offset=0.01)
    R.fitted("Bracers", ["lowerarm"], "leather", offset=0.012)
    R.cuffs("gold", at=(0.1, 0.92), offset=0.016, thick=0.008)
    R.fitted("Legs", ["thigh", "calf"], "leather", offset=0.005)
    top = z["knee"] - 0.04
    R.boots("wood", top=top, toe="gold")
    for n in "lr":
        c, r = R.leg_r(n, top - 0.01)
        R.piece(f"calf_{n}").torus("fur", c, r + 0.024, 0.03, seg=(20, 8))
    hem = z["knee"] + 0.02
    f, rings = P.skirt(R, "green", hem, flare=1.4, depth=1.12, folds=8, amp=0.018, seg=48, trim="gold", trim_h=0.025)
    how = R.hang_w(z["waist"], hem)
    R.band("leather", z["waist"] - 0.02, height=0.09, grow=1.14, how=how)
    cw, rxw, ryw = R.ring(z["waist"] - 0.02)
    R.piece(how).ellipsoid("gold", Vector((0, cw.y - ryw * 1.22, z["waist"] - 0.02)), (0.05, 0.02, 0.045), seg=(14, 8))
    # leather straps crossed on the chest
    for side in (1, -1):
        PA.strap(R, "leather", width=0.05, lift=0.2, grow=1.1, high_side=side, out=0.022)

    # the cloak of fur and leaves on the shoulders, down the back
    PA.cloak(R, "fur", hem=z["knee"] - 0.05, width=0.44, depth=0.85, spread=1.25, top_spread=1.6, lining="green", nu=18, nv=12)
    PA.cowl(R, "fur", grow=1.12, low=0.09, high=0.02)
    cc, rxc, ryc = R.ring(z["chest"])
    lf = R.piece("spine_03")
    for k in range(18):
        a = -PI + 0.6 + (2 * PI - 1.2) * k / 17
        if abs(a) < 0.7:
            continue
        p, out = P.on_trunk(R, z["chest"] + 0.1, a, off=0.06)
        PA.blade(lf, "leaf", p, p + out * 0.08 + Vector((0, 0, -0.08)), 0.03, Vector((0, 0, 1)).cross(out), thick=0.15, belly=0.45)

    # the stag skull helm: the brow over his face, the long muzzle bone above it, the antlers, a gold band
    h = P.head(R)
    hp = R.piece("Head")
    hp.ellipsoid("bone", h.c + Vector((0, 0.0, h.rz * 0.25)), (h.rx * 1.12, h.ry * 1.12, h.rz * 0.95), seg=(18, 10), keep=lambda co: co.z > h.c.z + h.rz * 0.0 - 0.01)
    brow = Vector((0, h.y0 - 0.01, h.brow + 0.02))
    hp.tube("bone", [brow + Vector((0, 0.03, 0.05)), brow + Vector((0, -0.01, 0.02)), brow + Vector((0, -0.04, -0.03))], [0.05, 0.045, 0.03], seg=10)
    for s in (1, -1):
        e = brow + Vector((0.038 * s, 0.012, 0.035))
        hp.ellipsoid("wood", e, (0.018, 0.012, 0.014), seg=(10, 6))
        hp.ellipsoid("glow", e + Vector((0, -0.006, 0)), (0.01, 0.006, 0.008), seg=(8, 6))
    zb = h.c.z + h.rz * 0.15
    ring = [Vector((h.rx * 1.14 * math.sin(a), h.c.y - h.ry * 1.14 * math.cos(a), zb)) for a in [-PI + 2 * PI * k / 28 for k in range(29)]]
    hp.tube("gold", ring, 0.01, seg=6)
    for s in (1, -1):
        base = Vector((h.rx * 0.75 * s, h.c.y + 0.0, h.c.z + h.rz * 0.8))
        hp.ellipsoid("bone", base, (0.03, 0.03, 0.03), seg=(10, 8))
        antler(hp, "bone", base, s, scale=1.0)

    # the great spear in the right hand: a dark haft, a gold socket, a long leaf blade of bone
    s = P.along(R)
    f, o, d, upv = R.held("r")
    side = upv.cross(d).normalized()
    f.tube("wood", [o - d * 0.5 * s, o + d * 0.95 * s], 0.024, seg=10)
    f.ellipsoid("gold", o - d * 0.51 * s, P.rr(R, 0.03), seg=(10, 8))
    sock = o + d * 0.95 * s
    f.tube("gold", [sock - d * 0.04 * s, sock + d * 0.05 * s], [0.03, 0.022], seg=10)
    PA.blade(f, "bone", sock + d * 0.04 * s, sock + d * 0.42 * s, 0.07, upv, thick=0.18, belly=0.35, root=0.4, n=8)
    for t in (-0.1, 0.3, 0.7):
        f.torus("leather", o + d * t * s, 0.03, 0.008, normal=d, seg=(14, 5))
    f.tube("leaf", [sock - d * 0.02 * s, sock - d * 0.02 * s - upv * 0.12 + side * 0.02], [0.012, 0.003], seg=6)
    return R
