"""The Knight (the War's big enemy, "charges, and hits hard"; the crimson army's and the azure army's knights, the Banner
Bearer and his castellan and champion in black and gold, and the Deserter Knight in mossy grey, all in this figure under
their own colours): a knight of the endless war, still in full plate. Built heavy: broad, deep, a smaller head. Full plate
in steel grey with rounded pauldrons, a closed great helm with a narrow eye slit and a tall plume in his colour; a long
surcoat over the plate in his colour (the `livery` material: the game paints it crimson, azure, black or grey), a steel
belt; mail at the joints. A long lance in the RIGHT hand, a steel vamplate over his grip and a leaf head. A pale cold light
in the eye slit: his one glow. Signature shape: the great helm and its plume, the lance."""
import math

from mathutils import Vector

from realkit import PI, Real
from real import parts_a as PA
from real import parts_b as PB
from real import parts_c as P

LIGHT = {"faces": 10000, "keep": ("livery",)}


def build():
    R = Real("war_knight", sex="m", height=1.04, width=1.18, depth=1.16, head=0.9, skin="#b0aaa4")
    z = R.z
    R.mat("livery", "#8c1e22", rough=0.66, double=True)
    R.mat("steel", "#8a909c", rough=0.36, metal=0.8, double=True)
    R.mat("mail", "#5a5e68", rough=0.55, metal=0.5, double=True)
    R.mat("dark", "#1c1c22", rough=0.6, double=True)
    R.mat("wood", "#3a2a1c", rough=0.7)
    R.mat("glow", "#f0f6ff", rough=0.2, emit="#c0d8ff", strength=1.2)
    R.faceless()
    z = R.z

    R.fitted("Plate", ["spine", "clavicle", "upperarm", "lowerarm"], "steel", offset=0.014)
    R.fitted("Legs", ["thigh", "calf"], "steel", offset=0.01)
    R.boots("steel", top=z["ankle"] + 0.12, offset=0.014)
    R.fitted("Mail", ["pelvis"], "mail", offset=0.008)
    P.gloves(R, "steel")
    for n in "lr":
        k = R.bone(f"calf_{n}")
        R.piece(f"calf_{n}").ellipsoid("steel", k + Vector((0, -0.05, 0.01)), (0.055, 0.035, 0.05), seg=(10, 6))
        e = R.bone(f"lowerarm_{n}")
        R.piece(f"lowerarm_{n}").ellipsoid("steel", e + Vector((0, 0, 0.01)), (0.05, 0.05, 0.04), seg=(10, 6))
    for s, n in ((1, "l"), (-1, "r")):
        sh = R.bone(f"upperarm_{n}")
        sp = R.piece(f"upperarm_{n}")
        sp.ellipsoid("steel", sh + Vector((0.04 * s, 0, 0.05)), (0.12, 0.105, 0.055), seg=(14, 8))
        sp.ellipsoid("steel", sh + Vector((0.1 * s, 0, 0.0)), (0.085, 0.085, 0.045), seg=(12, 6))
    # the long surcoat in the livery, split front and back
    hem = z["knee"] - 0.08
    R.fitted("Surcoat", lambda i: R.dom[i].startswith(("spine", "pelvis")) and R.world[i].z > z["waist"] - 0.05 and abs(R.world[i].x) < 0.16, "livery", offset=0.022, keep_skin=True)
    f, rings = P.skirt(R, "livery", hem, flare=1.45, depth=1.12, folds=6, amp=0.016, seg=48, arc=(0.12, PI - 0.12), grow=1.05)
    P.cloth(f, "livery", rings, arc=(PI + 0.12, 2 * PI - 0.12), seg=24, rows=10, folds=3, amp=0.016)
    how = R.hang_w(z["waist"], hem)
    R.band("steel", z["waist"] - 0.01, height=0.05, grow=1.2, how=how)

    # the great helm: a flat-topped cylinder over the head, an eye slit, breaths, a tall plume in the livery
    h = P.head(R)
    hp = R.piece("Head")
    c = h.c + Vector((0, 0.0, -0.01))
    rings2 = [(c + Vector((0, 0, -h.rz * 1.25)), h.rx * 1.22, h.ry * 1.22), (c + Vector((0, 0, h.rz * 0.6)), h.rx * 1.25, h.ry * 1.25), (c + Vector((0, 0, h.rz * 1.15)), h.rx * 1.12, h.ry * 1.12)]
    hp.loft("steel", rings2, seg=28, cap_top=True)
    slit = c + Vector((0, -h.ry * 1.27, h.rz * 0.15))
    hp.tube("dark", [slit + Vector((-h.rx * 0.8, 0.01, 0)), slit + Vector((h.rx * 0.8, 0.01, 0))], 0.012, seg=6, squash=((0, 0, 1), 0.5))
    hp.ellipsoid("glow", slit + Vector((0, 0.012, 0)), (h.rx * 0.5, 0.004, 0.006), seg=(10, 4))
    hp.tube("steel", [c + Vector((0, -h.ry * 1.3, h.rz * 1.1)), c + Vector((0, -h.ry * 1.3, -h.rz * 1.1))], 0.012, seg=6)
    for k in range(4):
        hp.ellipsoid("dark", c + Vector((0.03 * (1 if k % 2 else -1), -h.ry * 1.25, -h.rz * (0.35 + 0.15 * (k // 2)))), (0.006, 0.004, 0.012), seg=(6, 4))
    top = c + Vector((0, 0, h.rz * 1.15))
    plume = [top, top + Vector((0, 0.02, 0.08)), top + Vector((0, 0.08, 0.16)), top + Vector((0, 0.2, 0.14)), top + Vector((0, 0.3, 0.02))]
    pp = PA.smooth(plume, 4)
    hp.tube("livery", pp, [0.03 + 0.03 * math.sin(PI * i / (len(pp) - 1)) for i in range(len(pp))], seg=8, squash=((1, 0, 0), 0.4))
    hp.ellipsoid("steel", top, (0.03, 0.03, 0.02), seg=(10, 6))

    # the lance in the right hand
    s = P.along(R)
    f, o, d, upv = R.held("r")
    side = upv.cross(d).normalized()
    f.tube("wood", [o - d * 0.3 * s, o + d * 1.25 * s], [0.025, 0.018], seg=10)
    f.tube("steel", [o + d * 0.03 * s, o + d * 0.2 * s], [0.12, 0.03], seg=16)
    f.ellipsoid("steel", o - d * 0.31 * s, P.rr(R, 0.028), seg=(10, 8))
    tip = o + d * 1.25 * s
    PB.blade(f, "steel", tip, d, side, 0.2 * s, 0.05, thick=0.02, tip=0.4, waist=(0.3, 1.1), root=0.02)
    return R
