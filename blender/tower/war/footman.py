"""The Footman (the War's common melee enemy, "strikes up close"; the crimson army's and the azure army's, and the ashen
soldier of neither, all in this figure): a ghost of the endless war still in the line. A soldier's build. A steel kettle
helm with a wide brim over a mail coif, a mail shirt to mid-thigh under a long tabard in his army's colour (the `livery`
material: the game paints it crimson, azure or ash), a broad leather belt with a steel buckle, steel greaves over dark
hose, leather boots. A round shield on the LEFT arm, steel-rimmed with a livery field and a steel boss (hold: shield); a
spear in the RIGHT hand with a leaf blade. A pale cold light under the helm's brim where his eyes are: his one glow.
Signature shape: the kettle helm, the round shield and the spear."""
import math

from mathutils import Vector

from realkit import PI, Real
from real import parts_a as PA
from real import parts_b as PB
from real import parts_c as P

LIGHT = {"faces": 10000, "keep": ("livery",)}


def build():
    R = Real("war_footman", sex="m", height=1.02, width=1.0, depth=1.0, head=0.96, skin="#b0aaa4", eyes="#e8eef8")
    z = R.z
    R.mat("livery", "#8c1e22", rough=0.66, double=True)
    R.mat("mail", "#6a6e78", rough=0.55, metal=0.5, double=True)
    R.mat("steel", "#9aa0ac", rough=0.35, metal=0.8, double=True)
    R.mat("leather", "#2e2218", rough=0.6, double=True)
    R.mat("dark", "#1c1c22", rough=0.7, double=True)
    R.mat("wood", "#3a2a1c", rough=0.7)
    R.mat("glow", "#f0f6ff", rough=0.2, emit="#c0d8ff", strength=1.0)
    R.hair(None, "#1a1410")

    R.fitted("Mail", ["spine", "pelvis", "clavicle", "upperarm", "lowerarm"], "mail", offset=0.008)
    R.fitted("Hose", ["thigh", "calf"], "dark", offset=0.005)
    R.boots("leather", top=z["ankle"] + 0.12)
    for n in "lr":
        R.fitted(f"Greave_{n}", lambda i, n=n: R.dom[i] == f"calf_{n}" and R.world[i].y < R.bone(f"calf_{n}").y + 0.01 and z["ankle"] + 0.1 < R.world[i].z < z["knee"] + 0.02, "steel", offset=0.012)
    hem = z["knee"] + 0.08
    P.skirt(R, "mail", hem + 0.04, flare=1.25, depth=1.1, folds=0, amp=0.0, seg=36)
    # the tabard: a long panel front and back in the livery, over the mail
    R.fitted("Tabard", lambda i: R.dom[i].startswith(("spine", "pelvis")) and abs(R.world[i].x) < 0.13, "livery", offset=0.016, keep_skin=True)
    f, rings = P.skirt(R, "livery", hem - 0.04, flare=1.26, depth=1.12, folds=4, amp=0.01, seg=36, arc=(-0.5, 0.5), grow=1.04)
    P.cloth(f, "livery", rings, arc=(PI - 0.5, PI + 0.5), seg=8, rows=8, off=0.0)
    how = R.hang_w(z["waist"], hem)
    R.band("leather", z["waist"] - 0.01, height=0.06, grow=1.16, how=how)
    cw, rxw, ryw = R.ring(z["waist"] - 0.01)
    R.piece(how).ellipsoid("steel", Vector((0, cw.y - ryw * 1.24, z["waist"] - 0.01)), (0.03, 0.012, 0.025), seg=(10, 6))
    for s, n in ((1, "l"), (-1, "r")):
        R.piece(f"upperarm_{n}").ellipsoid("steel", R.bone(f"upperarm_{n}") + Vector((0.04 * s, 0, 0.04)), (0.085, 0.075, 0.04), seg=(12, 6))

    # the mail coif and the kettle helm with its wide brim; the cold eyes
    h = P.head(R)
    hp = R.piece("Head")
    P.shell(hp, "mail", h.c + Vector((0, 0.01, -0.02)), (h.rx * 1.12, h.ry * 1.12, h.rz * 1.15), lambda a: -0.75 if abs(math.sin(a / 2)) > 0.4 else -0.2, seg=24, rows=8)
    P.shell(hp, "steel", h.c + Vector((0, 0.01, 0.03)), (h.rx * 1.18, h.ry * 1.18, h.rz * 1.1), lambda a: 0.05, seg=28, rows=7)
    brim = h.c + Vector((0, 0.01, 0.03 + h.rz * 1.1 * 0.05))
    hp.loft("steel", [(brim + Vector((0, 0, -0.02)), h.rx * 1.75, h.ry * 1.7), (brim, h.rx * 1.2, h.ry * 1.2)], seg=28)
    for s in (1, -1):
        hp.ellipsoid("glow", Vector((0.032 * s, h.y0 + 0.032, h.eye + 0.002)), (0.013, 0.006, 0.007), seg=(10, 6))

    # the round shield on the left forearm
    lf = R.piece("lowerarm_l")
    c0, r0 = R.arm_r("l", 0.55)
    sc = c0 + Vector((0, 0, r0 + 0.035))
    PB.disc(lf, "livery", sc, (0, 0, 1), 0.2, thick=0.025)
    lf.torus("steel", sc + Vector((0, 0, 0.004)), 0.2, 0.012, normal=(0, 0, 1), seg=(32, 6))
    lf.ellipsoid("steel", sc + Vector((0, 0, 0.018)), (0.05, 0.05, 0.03), seg=(12, 8))
    for t in (0.3, 0.8):
        c1, r1 = R.arm_r("l", t)
        lf.torus("leather", c1, r1 + 0.012, 0.007, normal=(1, 0, 0), seg=(14, 5))

    # the spear in the right hand
    s = P.along(R)
    f, o, d, upv = R.held("r")
    side = upv.cross(d).normalized()
    f.tube("wood", [o - d * 0.5 * s, o + d * 0.9 * s], 0.017, seg=8)
    f.ellipsoid("steel", o - d * 0.51 * s, P.rr(R, 0.022), seg=(8, 6))
    sock = o + d * 0.9 * s
    f.tube("steel", [sock - d * 0.05 * s, sock + d * 0.03 * s], [0.022, 0.018], seg=8)
    PB.blade(f, "steel", sock + d * 0.02 * s, d, side, 0.24 * s, 0.065, thick=0.018, tip=0.4, waist=(0.35, 1.1), root=0.02)
    return R
