"""The Crow King (the War's third ruler, a boss drawn about 2.4 to 2.6 times a hero's size: the Crow King, the Black
Herald, the Grey Captain): he eats what the war leaves, and the crows are his court. Built as a giant: tall, broad, a
smaller head, big hands. His face hidden by a long black beak-mask of lacquer with silver round the eyes; an iron crown
of narrow spikes; a great cloak of layered black feathers from the shoulders to the floor, a high feathered collar; under
it a long coat of dark grey with silver buttons and a crimson sash. In the LEFT hand a tall black staff topped by a
silver crow with spread wings, a red gem in its breast: his one light (hold: torch). Signature shape: the beak and the
feather cloak."""
import math

from mathutils import Vector

from realkit import PI, Real
from real import parts_a as PA
from real import parts_b as PB
from real import parts_c as P
import folk as K


def build():
    R = Real("war_crow", sex="m", height=1.06, width=1.24, depth=1.2, head=0.84, skin="#9a948e")
    z = R.z
    R.mat("feather", "#121216", rough=0.55, double=True)
    R.mat("feather2", "#22222a", rough=0.5, double=True)
    R.mat("coat", "#34363e", rough=0.66, double=True)
    R.mat("crimson", "#7a1418", rough=0.62, double=True)
    R.mat("lacquer", "#16161c", rough=0.42, double=True)
    R.mat("silver", "#c8ccd4", rough=0.28, metal=0.85, double=True)
    R.mat("iron", "#3a3a40", rough=0.45, metal=0.6)
    R.mat("glow", "#ffd8d0", rough=0.2, emit="#ff3a30", strength=1.3)
    R.faceless()
    PB.big_hands(R, 1.3)
    z = R.z

    R.fitted("Coat", ["spine", "pelvis", "clavicle", "upperarm", "lowerarm"], "coat", offset=0.01)
    R.fitted("Legs", ["thigh", "calf"], "coat", offset=0.005)
    R.boots("lacquer", top=z["knee"] - 0.02)
    P.gloves(R, "lacquer")
    hem = z["knee"] - 0.12
    P.skirt(R, "coat", hem, flare=1.45, depth=1.12, folds=8, amp=0.018, seg=48, arc=(0.2, 2 * PI - 0.2))
    for k in range(5):
        p, _ = P.on_trunk(R, z["waist"] + 0.04 + 0.07 * k, 0.12, off=0.016)
        R.piece("spine_02" if k > 1 else "pelvis").ellipsoid("silver", p, (0.012, 0.012, 0.012), seg=(8, 6))
    how = R.hang_w(z["waist"], hem)
    R.band("crimson", z["waist"] - 0.01, height=0.08, grow=1.15, how=how)
    PA.strap(R, "crimson", width=0.06, lift=0.2, grow=1.14, high_side=1, out=0.03)

    # the feather cloak: a cloak to the floor, rows of long feathers over it, a high collar of feathers
    fig, fn = PA.cloak(R, "feather", hem=z["ankle"] - 0.02, width=0.55, depth=0.85, spread=1.45, top_spread=1.75, lining="feather2", nu=20, nv=14)
    cf = R.piece(PA.spine_w(R))
    for row in range(7):
        v = 0.12 + row * 0.13
        for k in range(11):
            u = (k + 0.5 * (row % 2)) / 10.5
            p = fn(u, v)
            q = fn(u, min(1.0, v + 0.14))
            out = (p - Vector((0, R.ring(p.z)[0].y, p.z))).normalized()
            PA.blade(cf, "feather" if (k + row) % 2 else "feather2", p + out * 0.008, q + out * 0.014, 0.05, out, thick=0.15, belly=0.45, root=0.4)
    cc, rxc, ryc = R.ring(z["chest"])
    col = R.piece("spine_03")
    for k in range(22):
        a = -PI + 2 * PI * k / 22
        if abs(a) < 0.45:
            continue
        p, out = P.on_trunk(R, z["chest"] + 0.13, a, off=0.04)
        PA.blade(col, "feather", p - Vector((0, 0, 0.04)), p + out * 0.06 + Vector((0, 0, 0.14)), 0.035, Vector((0, 0, 1)).cross(out), thick=0.12, belly=0.4, root=0.5)

    # the beak-mask and the iron crown
    h = P.head(R)
    hp = R.piece("Head")
    hp.ellipsoid("lacquer", h.c + Vector((0, 0.0, -0.01)), (h.rx * 1.12, h.ry * 1.1, h.rz * 1.12), seg=(20, 12))
    beak = [Vector((0, h.y0 + 0.02, h.eye - 0.02)), Vector((0, h.y0 - 0.08, h.eye - 0.05)), Vector((0, h.y0 - 0.2, h.eye - 0.1)), Vector((0, h.y0 - 0.26, h.eye - 0.15))]
    hp.tube("lacquer", PA.smooth(beak, 4), [0.06 * (1 - 0.95 * i / 12) + 0.002 for i in range(13)], seg=10, squash=((1, 0, 0), 0.75))
    for s in (1, -1):
        e = Vector((0.04 * s, h.y0 - 0.0, h.eye + 0.01))
        hp.torus("silver", e, 0.022, 0.006, normal=(0.3 * s, -1, 0), seg=(16, 5))
        hp.ellipsoid("glow", e + Vector((0, 0.004, 0)), (0.012, 0.006, 0.012), seg=(8, 6))
    zc = h.c.z + h.rz * 0.6
    ring = [Vector((h.rx * 1.12 * math.sin(a), h.c.y - h.ry * 1.1 * math.cos(a), zc)) for a in [-PI + 2 * PI * k / 28 for k in range(29)]]
    hp.tube("iron", ring, 0.014, seg=6)
    for k in range(9):
        a = -PI + 2 * PI * k / 9
        base = Vector((h.rx * 1.12 * math.sin(a), h.c.y - h.ry * 1.1 * math.cos(a), zc))
        hp.tube("iron", [base, base + Vector((0, 0, 0.12 + 0.03 * (k % 2)))], [0.012, 0.001], seg=5)

    # the crow staff in the left hand
    hd = K.hand(R)
    f = hd.f
    K.pole(hd, "lacquer", back=1.3, front=0.6, r=0.018, butt="silver", rings=(0.2,), ring_key="silver")
    top = K.at(hd, 0.66)
    f.ellipsoid("silver", top, (0.045, 0.06, 0.05), seg=(12, 8))
    f.ellipsoid("silver", top + hd.fwd * 0.04 + hd.d * 0.05, P.rr(R, 0.032), seg=(10, 8))
    f.tube("silver", [top + hd.fwd * 0.06 + hd.d * 0.05, top + hd.fwd * 0.12 + hd.d * 0.035], [0.012, 0.001], seg=6)
    for sg in (1, -1):
        root = top + hd.side * 0.03 * sg
        for kk, (ln, rise) in enumerate(((0.22, 0.12), (0.18, 0.04), (0.13, -0.04))):
            PA.blade(f, "silver", root, root + hd.side * ln * sg + hd.d * rise - hd.fwd * 0.03, 0.03, hd.fwd, thick=0.12, belly=0.4, root=0.6)
    f.ellipsoid("glow", top + hd.fwd * 0.04, P.rr(R, 0.016), seg=(8, 6))
    return R
