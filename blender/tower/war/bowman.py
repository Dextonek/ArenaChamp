"""The Bowman (the War's ranged enemy, "shoots from a distance"; the crimson army's and the azure army's): a crossbowman of
the endless war. A soldier's build, lighter than the footman. A steel chapel helm with a narrow brim over a padded coif, a
padded jack in dark grey to mid-thigh under a short tabard in his army's colour (the `livery` material), a quiver of bolts
on the right hip, leather bracers, dark hose and boots. A crossbow in the RIGHT hand, held level: a dark wooden stock, a
steel bow and a pale string, a bolt laid in it (he thrusts it at his mark to shoot). A pale cold light under the brim: his
one glow. Signature shape: the chapel helm and the crossbow."""
import math

from mathutils import Vector

from realkit import PI, Real
from real import parts_a as PA
from real import parts_b as PB
from real import parts_c as P

LIGHT = {"faces": 10000, "keep": ("livery",)}


def build():
    R = Real("war_bowman", sex="m", height=1.0, width=0.94, depth=0.94, head=0.98, skin="#b0aaa4", eyes="#e8eef8")
    z = R.z
    R.mat("livery", "#8c1e22", rough=0.66, double=True)
    R.mat("jack", "#3a3c44", rough=0.75, double=True)
    R.mat("steel", "#9aa0ac", rough=0.35, metal=0.8, double=True)
    R.mat("leather", "#2e2218", rough=0.6, double=True)
    R.mat("dark", "#1c1c22", rough=0.7, double=True)
    R.mat("wood", "#3a2a1c", rough=0.7)
    R.mat("string", "#d8d0bc", rough=0.8)
    R.mat("glow", "#f0f6ff", rough=0.2, emit="#c0d8ff", strength=1.0)
    R.hair(None, "#1a1410")

    R.fitted("Jack", ["spine", "pelvis", "clavicle", "upperarm", "lowerarm"], "jack", offset=0.01)
    R.fitted("Hose", ["thigh", "calf"], "dark", offset=0.005)
    R.fitted("Bracers", ["lowerarm"], "leather", offset=0.014)
    R.boots("leather", top=z["knee"] - 0.08)
    hem = z["knee"] + 0.12
    P.skirt(R, "jack", hem, flare=1.25, depth=1.1, folds=5, amp=0.01, seg=36)
    R.fitted("Tabard", lambda i: R.dom[i].startswith(("spine", "pelvis")) and abs(R.world[i].x) < 0.12 and R.world[i].z > z["hip"] - 0.06, "livery", offset=0.018, keep_skin=True)
    f, rings = P.skirt(R, "livery", z["hip"] - 0.1, flare=1.2, depth=1.1, folds=3, amp=0.008, seg=30, arc=(-0.45, 0.45), grow=1.06)
    P.cloth(f, "livery", rings, arc=(PI - 0.45, PI + 0.45), seg=8, rows=6, off=0.0)
    how = R.hang_w(z["waist"], hem)
    R.band("leather", z["waist"] - 0.01, height=0.05, grow=1.16, how=how)
    # the quiver of bolts on the right hip
    cw, rxw, ryw = R.ring(z["hip"])
    qf = R.piece(how)
    q0 = Vector((-rxw * 1.2, cw.y + 0.02, z["hip"] - 0.12))
    q1 = q0 + Vector((-0.02, 0.03, 0.24))
    qf.tube("leather", [q0, q1], [0.04, 0.045], seg=10)
    for k in range(5):
        a = 2 * PI * k / 5
        b = q1 + Vector((0.018 * math.cos(a), 0.018 * math.sin(a), 0))
        qf.tube("wood", [b, b + Vector((0, 0, 0.07))], 0.005, seg=5)
        qf.ellipsoid("steel", b + Vector((0, 0, 0.075)), (0.007, 0.007, 0.012), seg=(6, 4))

    # the chapel helm with a narrow brim; the cold eyes
    h = P.head(R)
    hp = R.piece("Head")
    P.shell(hp, "jack", h.c + Vector((0, 0.01, -0.02)), (h.rx * 1.1, h.ry * 1.1, h.rz * 1.12), lambda a: -0.75 if abs(math.sin(a / 2)) > 0.4 else -0.2, seg=24, rows=8)
    P.shell(hp, "steel", h.c + Vector((0, 0.01, 0.035)), (h.rx * 1.16, h.ry * 1.16, h.rz * 1.15), lambda a: 0.05, seg=28, rows=7)
    brim = h.c + Vector((0, 0.01, 0.04))
    hp.loft("steel", [(brim + Vector((0, 0, -0.012)), h.rx * 1.45, h.ry * 1.42), (brim, h.rx * 1.17, h.ry * 1.17)], seg=28)
    hp.tube("steel", [h.c + Vector((0, -h.ry * 1.1, h.rz * 0.3)), h.c + Vector((0, 0, h.rz * 1.2)), h.c + Vector((0, h.ry * 1.1, h.rz * 0.3))], 0.008, seg=5)
    for s in (1, -1):
        hp.ellipsoid("glow", Vector((0.032 * s, h.y0 + 0.032, h.eye + 0.002)), (0.013, 0.006, 0.007), seg=(10, 6))

    # the crossbow in the right hand: the stock along the forearm, the bow across its front
    s = P.along(R)
    f, o, d, upv = R.held("r")
    side = upv.cross(d).normalized()
    f.tube("wood", [o - d * 0.1 * s + upv * 0.02, o + d * 0.42 * s + upv * 0.03], [0.022, 0.018], seg=8, squash=(tuple(side), 0.7))
    front = o + d * 0.4 * s + upv * 0.035
    bow = [front + side * 0.24 * sg - d * 0.06 * s * abs(sg) for sg in (-1, -0.5, 0, 0.5, 1)]
    bow[2] = front + d * 0.02 * s
    f.tube("steel", PA.smooth(bow, 3), 0.012, seg=6)
    f.tube("string", [bow[0], o + d * 0.18 * s + upv * 0.045, bow[-1]], 0.003, seg=4)
    f.tube("wood", [o + d * 0.14 * s + upv * 0.05, o + d * 0.44 * s + upv * 0.05], 0.006, seg=5)
    f.tube("steel", [o + d * 0.44 * s + upv * 0.05, o + d * 0.5 * s + upv * 0.05], [0.009, 0.001], seg=5)
    f.torus("steel", front + d * 0.02 * s, 0.02, 0.006, normal=upv, seg=(12, 5))
    return R
