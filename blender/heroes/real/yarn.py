"""Grandma Ironknit, a tiny old fate-spinner, unhurried. A long dark aubergine robe with a gold hem and a rose-thread
belt, a dark wine hooded shawl with a gold brooch, the hood up round her face with a rolled rose edge and its point down
her back, silver hair. Two silver knitting needles as long as swords, gold at the butts, and a spindle behind her left
shoulder with three glowing rose yarn spools in gold flanges."""
from mathutils import Vector

from realkit import PI, Real


def build():
    R = Real("yarn", sex="f", height=0.74, width=0.88, depth=0.94, head=1.18, skin="#f2ddd0")
    z = R.z
    R.mat("robe", "#3a2540", rough=0.7, double=True)
    R.mat("shawl", "#5a1f3a", rough=0.8, double=True)
    R.mat("rose", "#d86a94", rough=0.6)
    R.mat("gold", "#d2ae55", rough=0.32, metal=0.85)
    R.mat("silver", "#d6dde4", rough=0.25, metal=0.9)
    R.mat("dark", "#1d1420", rough=0.6)
    R.mat("spool", "#ff8fc0", rough=0.4, emit="#ff5fa8", strength=0.9)
    R.hair("Hair_Buns", "#c9c9d2")

    R.fitted("Dress", ["spine", "pelvis", "clavicle", "upperarm", "lowerarm", "thigh", "calf"], "robe")
    R.fitted("Shawl", ["spine_03", "clavicle", "upperarm"], "shawl", offset=0.016, above=z["chest"] - 0.02, keep_skin=True)
    R.boots("dark", top=z["ankle"] + 0.06)
    hem = z["ankle"] + 0.03
    R.skirt("robe", hem=hem, flare=1.7, depth=1.25, trim="gold", trim_h=0.03)
    R.band("rose", z["waist"], height=0.035, grow=1.12, how=R.hang_w(z["waist"], hem))
    f, gem = R.collar("shawl", height=0.07, grow=1.25)
    f.ellipsoid("gold", gem + Vector((0, -0.012, -0.015)), (0.026, 0.012, 0.026), seg=(12, 8))
    R.cuffs("rose", at=(0.9,), offset=0.012, thick=0.008)

    # the hood, up round her face, a rolled rose edge, its point down her back
    f, c, r = R.head_piece()
    hr = r * 1.32
    c = c + Vector((0, 0.02, 0.0))
    f.ellipsoid("shawl", c, (hr, hr * 1.05, hr * 1.08), seg=(26, 16), keep=lambda co: co.y > c.y - hr * 0.42)
    f.torus("rose", Vector((c.x, c.y - hr * 0.42, c.z)), hr * 0.93, 0.016, normal=(0, 1, 0), seg=(28, 6))
    f.tube("shawl", [c + Vector((0, hr * 0.8, hr * 0.5)), c + Vector((0, hr * 1.35, -hr * 0.2)), c + Vector((0, hr * 1.2, -hr * 1.3))], [0.07, 0.05, 0.006], seg=10)

    # the needles, as long as swords
    for side in "rl":
        f, o, d, up = R.held(side)
        f.tube("silver", [o - d * 0.12, o + d * 0.5, o + d * 0.66], [0.009, 0.008, 0.0015], seg=6)
        f.ellipsoid("gold", o - d * 0.13, (0.02, 0.02, 0.02), seg=(10, 8))
        if side == "r":  # half a scarf on the right one
            for k in range(4):
                p = o + d * (0.2 + 0.07 * k)
                f.tube("rose" if k % 2 else "shawl", [p + up * 0.01, p - up * (0.16 + 0.02 * k)], 0.03, seg=8, squash=((1, 0, 0), 0.25))

    # the spindle behind her left shoulder, three glowing spools
    cc, rx, ry = R.ring(z["chest"])
    f = R.piece("spine_03")
    b = Vector((0.11, cc.y + ry + 0.07, z["chest"] - 0.12))
    f.tube("gold", [b, b + Vector((0.03, 0.02, 0.56))], 0.009, seg=6)
    for k in range(3):
        p = b + Vector((0.03, 0.02, 0.56)) * (0.4 + 0.25 * k)
        f.ellipsoid("spool", p, (0.05, 0.05, 0.04), seg=(14, 8))
        for dz in (-0.04, 0.04):
            f.torus("gold", p + Vector((0, 0, dz)), 0.045, 0.007, seg=(18, 6))
    return R
