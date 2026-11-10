"""Brannoc, the Ashen Smith (tank): a wall of a man. Iron pauldrons with molten seams, an iron breastplate with a furnace
grate glowing in it, a forge visor over a great red beard, bare arms with iron bracers, a leather apron, iron-shod
boots, a forge pack with two chimneys on his back, and a big hammer in the right hand."""
from mathutils import Vector

from realkit import Real


def build():
    R = Real("forge", sex="m", height=0.98, width=1.24, depth=1.3, head=0.92, skin="#e6bfa4")
    z = R.z
    R.mat("iron", "#3c3f47", rough=0.42, metal=0.75)
    R.mat("dark", "#1d1b21", rough=0.6)
    R.mat("leather", "#6b4226", rough=0.75, double=True)
    R.mat("wood", "#4a3220", rough=0.7)
    R.mat("gold", "#c9a24a", rough=0.32, metal=0.85)
    R.mat("molten", "#ff7a1c", rough=0.4, emit="#ff5a12", strength=1.0)
    R.hair("Hair_Buzzed", "#7a2c14")
    R.hair("Hair_Beard", "#a8401c", brows=False)

    R.fitted("Shirt", ["spine", "pelvis", "clavicle"], "dark")
    R.fitted("Plate", ["spine_02", "spine_03", "clavicle"], "iron", offset=0.022, keep_skin=True)
    R.fitted("Trousers", ["thigh", "calf", "pelvis"], "dark", offset=0.004)
    R.fitted("Bracers", ["lowerarm"], "iron", offset=0.012)
    R.boots("dark", top=z["knee"] - 0.02, cuff="iron", toe="iron")
    R.cuffs("gold", at=(0.08, 0.95), offset=0.014)
    R.pauldrons("iron", size=(0.12, 0.11, 0.075), lift=0.05, out=0.05)
    for s, n in ((1, "l"), (-1, "r")):
        f = R.piece(f"upperarm_{n}")
        f.torus("molten", R.bone(f"upperarm_{n}") + Vector((0.05 * s, 0, 0.05)), 0.118, 0.008, normal=(0, 0.35, 1), seg=(24, 6))

    # the furnace grate in the chest
    cc, rx, ry = R.ring(z["chest"])
    f = R.piece("spine_03")
    g = Vector((0, cc.y - ry - 0.03, z["chest"] + 0.04))
    f.torus("gold", g, 0.085, 0.012, normal=(0, 1, 0), seg=(28, 6))
    f.ellipsoid("dark", g + Vector((0, 0.012, 0)), (0.08, 0.02, 0.08), seg=(18, 10))
    for k in (-1, 0, 1):
        f.tube("molten", [g + Vector((-0.06, -0.008, 0.035 * k)), g + Vector((0.06, -0.008, 0.035 * k))], 0.009, seg=6)
    # the forge pack: an iron tank and two short chimneys, glowing at the top
    b = Vector((0, cc.y + ry + 0.11, z["chest"] - 0.02))
    f.ellipsoid("iron", b, (0.2, 0.11, 0.2), seg=(18, 12))
    for s in (1, -1):
        f.tube("iron", [b + Vector((0.1 * s, 0.02, 0.12)), b + Vector((0.1 * s, 0.02, 0.36))], [0.045, 0.04], seg=10)
        f.ellipsoid("molten", b + Vector((0.1 * s, 0.02, 0.36)), (0.034, 0.034, 0.012), seg=(10, 6))

    # the leather apron and its belt
    R.skirt("leather", hem=z["knee"] - 0.06, flare=1.25, depth=1.1, arc=(-1.25, 1.25), seg=18)
    R.band("dark", z["waist"], height=0.075, grow=1.12)
    cw, rxw, ryw = R.ring(z["waist"])
    R.piece("pelvis").ellipsoid("gold", Vector((0, cw.y - ryw * 1.2, z["waist"])), (0.045, 0.015, 0.035), seg=(12, 8))

    # the forge visor: an iron band across the eyes with one glowing slit
    f, c, r = R.head_piece()
    eye_z = R.z["head"] + (R.z["top"] - R.z["head"]) * 0.45
    f.torus("iron", Vector((0, c.y, eye_z)), r * 1.03, 0.014, seg=(28, 8))
    f.tube("molten", [Vector((-r * 0.6, c.y - r * 1.04, eye_z)), Vector((0, c.y - r * 1.2, eye_z)), Vector((r * 0.6, c.y - r * 1.04, eye_z))], 0.007, seg=6)

    # the hammer
    f, o, d, up = R.held("r")
    f.tube("wood", [o - d * 0.16, o + d * 0.78], 0.024, seg=10)
    f.ellipsoid("gold", o - d * 0.17, (0.032, 0.032, 0.032), seg=(10, 8))
    h = o + d * 0.78
    f.tube("iron", [h - up * 0.15, h + up * 0.15], 0.09, seg=10)
    f.torus("gold", h, 0.094, 0.012, normal=up, seg=(24, 6))
    for s in (1, -1):
        f.ellipsoid("molten", h + up * 0.152 * s, (0.07, 0.07, 0.012), seg=(14, 6))
    return R
