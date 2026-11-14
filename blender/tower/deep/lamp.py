"""The Lamp Warden (the Deep's second ruler, a boss drawn about 2.5 to 2.6 times a hero's size: the Lamp Warden, the Blind
Cantor, the Drowned Lantern): the blind keeper of the last great lamp, who sees by it without eyes. Built as a giant:
broad, deep, a smaller head, big hands. Grey skin, a long grey beard; a broad band of silver bound over his eyes; a deep
slate hood and a long slate robe to the floor, a mantle of violet over the shoulders edged in silver, a rope of silver
beads crossed on his chest, iron chains at his belt. In the LEFT hand a tall iron staff from whose hooked top a great iron
lantern hangs, its lavender flame his one light (hold: torch). Signature shape: the blindfold under the hood and the
hanging lantern."""
import math

from mathutils import Vector

from realkit import PI, Real
from real import parts_a as PA
from real import parts_b as PB
from real import parts_c as P
import folk as K


def build():
    R = Real("deep_lamp", sex="m", height=1.04, width=1.3, depth=1.26, head=0.86, skin="#9a98a0")
    z = R.z
    R.mat("slate", "#2c2e3a", rough=0.7, double=True)
    R.mat("deep", "#1a1a22", rough=0.75, double=True)
    R.mat("violet", "#3a2a5a", rough=0.6, double=True)
    R.mat("silver", "#c8ccd8", rough=0.28, metal=0.85, double=True)
    R.mat("iron", "#4a4c54", rough=0.5, metal=0.6)
    R.mat("glass", "#e6dcff", rough=0.15, alpha=0.6)
    R.mat("glow", "#f4e8ff", rough=0.2, emit="#c88cff", strength=1.3)
    PB.big_hands(R, 1.3)
    z = R.z
    P.hair(R, "Hair_SimpleParted", "#8c8a90", beard="Hair_Beard")

    R.fitted("Robe", ["spine", "pelvis", "clavicle", "upperarm", "lowerarm"], "slate", offset=0.01)
    R.fitted("Under", ["thigh", "calf"], "deep", offset=0.005)
    R.boots("deep", top=z["ankle"] + 0.06)
    for n in "lr":
        P.sleeve(R, n, "slate", t0=0.35, t1=0.97, r0=0.015, r1=0.1, rim="silver", rim_r=0.008, seg=16, n=4)
    hem = z["ankle"] + 0.01
    P.skirt(R, "slate", hem, flare=1.7, depth=1.15, folds=11, amp=0.028, seg=56, trim="violet", trim_h=0.05)
    how = R.hang_w(z["waist"], hem)
    R.band("deep", z["waist"], height=0.08, grow=1.14, how=how)
    cw, rxw, ryw = R.ring(z["waist"])
    g = R.piece(how)
    for s in (1, -1):
        p = Vector((0.12 * s, cw.y - ryw * 1.1, z["waist"] - 0.03))
        for k in range(6):
            g.torus("iron", p + Vector((0.004 * k * s, -0.003 * k, -0.035 * k)), 0.016, 0.005, normal=(1, 0, 0) if k % 2 else (0, 1, 0), seg=(12, 5))
    # the violet mantle, edged in silver; the rope of beads
    R.fitted("Mantle", ["spine_03", "clavicle", "upperarm"], "violet", offset=0.024, above=z["chest"] - 0.04, keep_skin=True,
             where=lambda p: abs(p.x) < R.bone("upperarm_l").x + 0.12)
    cf = R.piece("spine_03")
    edge = []
    for k in range(25):
        a = -PI + 2 * PI * k / 24
        p, out = P.on_trunk(R, z["chest"] - 0.035, a, off=0.03)
        edge.append(p)
    cf.tube("silver", edge, 0.008, seg=6)
    for side in (1,):
        sf, pts = PA.strap(R, "silver", width=0.02, lift=0.2, grow=1.14, high_side=side, out=0.035)

    # the hood and the silver blindfold
    PA.hood(R, "slate", lining="deep", grow=1.5, open=0.42, tilt=0.3, peak=0.1, edge="silver", edge_r=0.007)
    h = P.head(R)
    hp = R.piece("Head")
    band = [Vector((h.rx * 1.04 * math.sin(a), h.c.y - h.ry * 1.06 * math.cos(a), h.eye + 0.005)) for a in [-PI + 2 * PI * k / 28 for k in range(29)]]
    hp.tube("silver", band, 0.03, seg=8, squash=((0, 0, 1), 0.3))

    # the lantern staff in the left hand: a tall iron staff, its hooked top, the lantern hanging from it
    hd = K.hand(R)
    f = hd.f
    K.pole(hd, "iron", back=1.3, front=0.62, r=0.02, butt="iron", rings=(0.3,), ring_key="silver")
    top = K.at(hd, 0.62)
    hook = [top, top + hd.d * 0.08 + hd.fwd * 0.04, top + hd.d * 0.1 + hd.fwd * 0.12, top + hd.d * 0.06 + hd.fwd * 0.18]
    f.tube("iron", PA.smooth(hook, 4), 0.014, seg=8)
    K.lantern(hd, hook[-1], "iron", "glass", "glow", size=2.2, chain=0.12)
    return R
