"""The Net-Father (the Sea's quest giver): the old fisher who mends the nets that hold the sea back from the town. A
broad man, weathered, a grey-brown beard and a close knit cap of the harbour's wine with a gold cuff. A deep sea-green
tunic with the sleeves to the elbow, a rolled cream collar, bare forearms with rope-wound bracers, black lacquer
trousers and knee boots with gold cuffs, a short black lacquer apron with a gold hem. His great net coiled over the
left shoulder and across the chest to the right hip like a bandolier, strung with gold floats, and in it one float of
sea glass that glows: his one light. In the LEFT hand a long steering oar, its blade up, gold at the neck and the tip
(hold: torch). Signature shape: the oar and the coiled net."""
import math

from mathutils import Vector

from realkit import PI, Real
from real import parts_a as PA
from real import parts_c as P


def build():
    R = Real("sea_fisher", sex="m", height=1.0, width=1.1, depth=1.08, head=0.97, skin="#b07a58")
    z = R.z
    R.mat("sea", "#1f4c48", rough=0.66, double=True)
    R.mat("cream", "#dcd2b6", rough=0.8, double=True)
    R.mat("lacquer", "#1d1b21", rough=0.5, double=True)
    R.mat("wine", "#6a1c2c", rough=0.7, double=True)
    R.mat("rope", "#a68c58", rough=0.9)
    R.mat("wood", "#6b4226", rough=0.7)
    R.mat("gold", "#c9a24a", rough=0.32, metal=0.85, double=True)
    R.mat("glow", "#d8f6ff", rough=0.25, emit="#7fdcf5", strength=1.0)
    P.hair(R, "Hair_Buzzed", "#5f564e", beard="Hair_Beard")

    # the tunic to the elbows, cream collar, bare forearms with rope bracers
    el = R.bone("lowerarm_l").x
    R.fitted("Tunic", lambda i: R.dom[i].startswith(("spine", "pelvis", "clavicle", "upperarm")) or (R.dom[i].startswith("lowerarm") and abs(R.world[i].x) < el + 0.05), "sea", offset=0.009)
    for n in "lr":
        P.sleeve(R, n, "sea", t0=-0.02, t1=0.2, r0=0.014, r1=0.0, bones=("lowerarm", "hand"), seg=14, n=2)
    R.cuffs("cream", at=(0.2,), offset=0.018, thick=0.012)
    wr = R.bone("hand_l").x
    R.fitted("Bracers", ["lowerarm"], "rope", offset=0.008, where=lambda p: el + (wr - el) * 0.55 < abs(p.x) < el + (wr - el) * 0.93)
    R.cuffs("gold", at=(0.55, 0.93), offset=0.011, thick=0.006)
    P.collar(R, "cream", height=0.05, grow=1.12, flare=0.25)
    R.fitted("Trousers", ["thigh", "calf", "pelvis"], "lacquer", offset=0.004)
    R.boots("lacquer", top=z["knee"] - 0.04, cuff="gold")
    P.toes(R, "lacquer")

    # the tunic's hem over the hips, a belt, and a short lacquer apron with a gold hem
    f, rings = P.skirt(R, "sea", z["hip"] - 0.12, flare=1.2, depth=1.1, folds=8, amp=0.012, seg=48)
    R.band("wine", z["waist"], height=0.06, grow=1.13)
    cw, rxw, ryw = R.ring(z["waist"])
    R.piece("pelvis").ellipsoid("gold", Vector((0, cw.y - ryw * 1.2, z["waist"])), (0.034, 0.012, 0.03), seg=(12, 8))
    P.skirt(R, "lacquer", z["knee"] - 0.02, flare=1.32, depth=1.1, arc=(-1.05, 1.05), folds=5, amp=0.012, trim="gold", trim_h=0.022, grow=1.06, seg=24)

    # the knit cap: a close round cap of wine, a turned-up gold-edged cuff
    h = P.head(R)
    hp = R.piece("Head")
    P.shell(hp, "wine", h.c + Vector((0, 0.008, 0.006)), (h.rx * 1.16, h.ry * 1.16, h.rz * 1.16), lambda a: 0.1, seg=32, rows=8)
    cz = h.c.z + 0.006 + h.rz * 1.16 * 0.1
    hp.loft("wine", [(Vector((0, h.c.y + 0.008, cz - 0.012)), h.rx * 1.17, h.ry * 1.18), (Vector((0, h.c.y + 0.008, cz + 0.01)), h.rx * 1.22, h.ry * 1.23),
                     (Vector((0, h.c.y + 0.008, cz + 0.032)), h.rx * 1.18, h.ry * 1.19)], seg=32)
    pts = [Vector((h.rx * 1.23 * math.sin(2 * PI * i / 32), h.c.y + 0.008 - h.ry * 1.24 * math.cos(2 * PI * i / 32), cz + 0.01)) for i in range(33)]
    hp.tube("gold", pts, 0.005, seg=6, caps=False)

    # the coiled net over the left shoulder to the right hip, gold floats along it, one float of sea glass
    sf, point = PA.strap(R, "rope", width=0.075, lift=0.2, grow=1.12, high_side=1, out=0.03)
    nf = R.piece("near")
    coil = [point(i / 48, 0.0) for i in range(49)]
    nf.tube("rope", coil, 0.034, seg=10, caps=False)
    for i in range(0, 48, 6):
        nf.torus("rope", coil[i], 0.038, 0.007, normal=(coil[i + 1] - coil[i]), seg=(14, 5))
    for k, u in enumerate((0.06, 0.15, 0.32, 0.62, 0.8, 0.92)):
        p = point(u, 0.0)
        out = Vector((math.sin(2 * PI * u), -math.cos(2 * PI * u), 0))
        nf.ellipsoid("gold", p + out * 0.04, (0.024, 0.024, 0.024), seg=(10, 8))
    p = point(0.97, -0.02)
    nf.ellipsoid("glow", p + Vector((math.sin(2 * PI * 0.97), -math.cos(2 * PI * 0.97), 0)) * 0.05, (0.036, 0.036, 0.036), seg=(12, 10))

    # the steering oar in the left hand, blade up
    s = P.along(R)
    f, o, d, upv = R.held("l")
    back, front = 1.25 * s, 0.42 * s
    f.tube("wood", [o - d * back, o + d * front], 0.017, seg=10)
    f.ellipsoid("gold", o - d * (back + 0.01), P.rr(R, 0.022), seg=(10, 8))
    for t in (-0.75, 0.3):
        f.tube("gold", [o + d * (t - 0.02) * s, o + d * (t + 0.02) * s], 0.021, seg=10)
    fwd = R.bone("hand_l") - R.bone("middle_01_l")
    fwd.y = fwd.z = 0.0
    fwd.normalize()
    nb = o + d * front
    f.tube("gold", [nb - d * 0.02 * s, nb + d * 0.03 * s], 0.02, seg=10)
    # the blade: flat across the oar's face, widening, round at the tip, a gold edge
    side = upv.cross(d).normalized()
    blade = [nb + d * (0.03 + 0.42 * k / 10) * s for k in range(11)]
    wid = [0.022 + 0.06 * math.sin(min(1.0, k / 4) * PI / 2) for k in range(11)]
    wid[-1], wid[-2] = 0.03, 0.065
    P.hull(f, "wood", blade, wid, [0.012] * 11, seg=12, side=side)
    f.tube("gold", [nb + d * 0.448 * s + side * 0.05, nb + d * 0.468 * s + side * 0.02, nb + d * 0.472 * s - side * 0.02, nb + d * 0.448 * s - side * 0.05], 0.007, seg=6)
    return R
