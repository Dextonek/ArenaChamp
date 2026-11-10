"""Bram, the Stonewright (bruiser): a broad, calm temple mason. A dark warm tunic with rolled sleeves, a deep brown leather
apron with a bib and a gold hem, a chisel through the belt, leather bracers with gold bands on the big forearms, a gold
gorget, iron-grey cropped hair. Carved limestone pauldrons in two gold-edged lames on each shoulder, a glowing amber
rune in a gold ring on the chest, and a rune-cut stone maul with gold bands in the right fist."""
import math

from mathutils import Vector

from realkit import PI, Real
from real.parts_b import box, ellipse, flats, neck_band, on_back, on_front, path, ring_pt


def rune(f, key, c, u, v, s=1.0, r=0.009):
    """Othala, the rune of the home ground: a diamond standing on two legs. `u` across, `v` up."""
    pts = [(0, 0.075), (0.05, 0.02), (0, -0.035), (-0.05, 0.02), (0, 0.075)]
    f.tube(key, [c + u * a * s + v * b * s for a, b in pts], r, seg=5)
    for sx in (1, -1):
        f.tube(key, [c + v * -0.035 * s, c + u * 0.045 * sx * s + v * -0.085 * s], r, seg=5)


def build():
    R = Real("mason", sex="m", height=1.0, width=1.18, depth=1.22, head=0.95, skin="#dcae8c")
    z = R.z
    R.mat("tunic", "#30251f", rough=0.75, double=True)
    R.mat("leather", "#5b3a22", rough=0.75, double=True)
    R.mat("stone", "#bab5a8", rough=0.92)
    R.mat("gold", "#c9a24a", rough=0.32, metal=0.85)
    R.mat("rune", "#ffd08a", rough=0.4, emit="#ffa52e", strength=1.0)
    R.mat("wood", "#3d2a1c", rough=0.7)
    R.mat("dark", "#1c1a18", rough=0.6)
    R.hair("Hair_Buzzed", "#7a7a80", rough=0.6)

    R.fitted("Tunic", ["spine", "pelvis", "clavicle", "upperarm"], "tunic", offset=0.007)
    R.fitted("Trousers", ["thigh", "calf"], "dark", offset=0.004)
    R.boots("dark", top=z["knee"] - 0.04, cuff="leather", toe="leather")
    e, w = R.bone("lowerarm_l"), R.bone("hand_l")
    x0 = e.x + (w.x - e.x) * 0.36
    R.fitted("Bracers", ["lowerarm"], "leather", offset=0.011, where=lambda p: abs(p.x) > x0)
    R.cuffs("gold", at=(0.38, 0.94), offset=0.006, thick=0.009)
    for n in "lr":   # the rolled sleeves
        c, r = R.arm_r(n, 0.02)
        R.piece(f"upperarm_{n}").torus("tunic", c, r + 0.012, 0.022, normal=(1, 0, 0), seg=(20, 8))
    R.collar("gold", height=0.06, grow=1.22)
    neck_band(R, "tunic")

    # the leather apron: a bib over the chest with straps over the shoulders, a skirt to below the knee, the belt
    bib = [(R.ring(zz)[0], R.ring(zz)[1] * 1.08 + 0.008, R.ring(zz)[2] * 1.1 + 0.012) for zz in (z["waist"] - 0.02, z["waist"] + 0.1, z["chest"], z["chest"] + 0.1)]
    f = R.piece("near")
    f.loft("leather", bib, seg=14, arc=(-0.72, 0.72))
    f.tube("gold", [ring_pt(bib, -0.72 + 1.44 * k / 12, z["chest"] + 0.1, 0.002) for k in range(13)], 0.008, seg=5)
    for s in (1, -1):
        tz = max(p.z for p, dom in zip(R.world, R.dom) if abs(p.x - 0.105 * s) < 0.03 and dom.startswith(("spine", "clavicle")))
        strap = [ring_pt(bib, 0.6 * s, z["chest"] + 0.09, 0.004), on_front(R, 0.105 * s, tz - 0.05, 0.016), Vector((0.105 * s, 0.03, tz + 0.02)), on_back(R, 0.1 * s, z["chest"] + 0.12, 0.016),
                 on_back(R, 0.03 * s, z["chest"] - 0.06, 0.016), on_back(R, -0.08 * s, z["waist"] + 0.03, 0.02)]
        f.tube("leather", path(strap, 4), 0.026, seg=6, squash=((0, 1, 0.5), 0.3))
    hem = z["knee"] - 0.1
    R.skirt("leather", hem=hem, flare=1.28, depth=1.1, arc=(-1.3, 1.3), seg=18, trim="gold", trim_h=0.028, grow=1.03)
    R.band("dark", z["waist"], height=0.075, grow=1.14)
    cw, rxw, ryw = R.ring(z["waist"])
    f = R.piece("pelvis")
    box(f, "gold", Vector((0, cw.y - ryw * 1.24, z["waist"])), (0.042, 0.012, 0.036))
    box(f, "dark", Vector((0, cw.y - ryw * 1.25, z["waist"])), (0.024, 0.012, 0.02))
    # the chisel through the belt on the right hip, a pouch on the left
    a = -1.0
    top = Vector((cw.x + rxw * 1.22 * math.sin(a), cw.y - ryw * 1.26 * math.cos(a), z["waist"] + 0.12))
    low = top + Vector((-0.012, -0.012, -0.3))
    f.tube("wood", [top, top.lerp(low, 0.42)], [0.019, 0.016], seg=8)
    f.torus("gold", top.lerp(low, 0.42), 0.017, 0.005, normal=(low - top), seg=(10, 5))
    f.tube("stone", [top.lerp(low, 0.42), top.lerp(low, 0.9), low], [0.01, 0.012, 0.004], seg=6, squash=((0, 1, 0), 0.5))
    a = 1.05
    pc = Vector((cw.x + rxw * 1.3 * math.sin(a), cw.y - ryw * 1.36 * math.cos(a), z["waist"] - 0.075))
    f.ellipsoid("leather", pc, (0.05, 0.05, 0.06), seg=(12, 8))
    f.ellipsoid("gold", pc + Vector((0.035, -0.03, 0.01)), (0.01, 0.01, 0.01), seg=(6, 5))

    # the glowing rune in a gold ring on the chest
    f = R.piece("spine_03")
    g = ring_pt(bib, 0.0, z["chest"] + 0.01, 0.012)
    f.torus("gold", g, 0.095, 0.012, normal=(0, 1, 0), seg=(30, 6))
    f.ellipsoid("dark", g + Vector((0, 0.012, 0)), (0.09, 0.012, 0.09), seg=(18, 8))
    rune(f, "rune", g + Vector((0, -0.006, 0.005)), Vector((1, 0, 0)), Vector((0, 0, 1)), s=0.82, r=0.0085)

    # carved limestone pauldrons: two lames on each shoulder, gold at their edges, a cut groove across each
    for s, n in ((1, "l"), (-1, "r")):
        sh = R.bone(f"upperarm_{n}")
        f = R.piece(f"upperarm_{n}")
        c = sh + Vector((0.085 * s, 0, 0.0))
        f.ellipsoid("stone", c, (0.125, 0.12, 0.08), seg=(18, 10), keep=lambda co, c=c: co.z > c.z - 0.045)
        f.tube("gold", ellipse(c, 0.105, 0.1, n=24, z=c.z - 0.045), 0.011, seg=6)
        f = R.piece(f"clavicle_{n}")
        c = sh + Vector((-0.005 * s, 0, 0.062))
        f.ellipsoid("stone", c, (0.135, 0.125, 0.07), seg=(18, 10), keep=lambda co, c=c: co.z > c.z - 0.03)
        f.tube("gold", ellipse(c, 0.123, 0.114, n=24, z=c.z - 0.03), 0.011, seg=6)
        for dy in (-0.045, 0.045):
            f.tube("tunic", [c + Vector((0.115 * math.cos(t) * s, dy, 0.066 * math.sin(t) + 0.002)) for t in [PI * (0.12 + 0.76 * k / 8) for k in range(9)]], 0.006, seg=4)
        box(f, "stone", c + Vector((0, 0, 0.068)), (0.03, 0.03, 0.012))

    # the maul: a rune-cut block of limestone between gold bands, on a dark haft
    f, o, d, up = R.held("r")
    side = d.cross(up)
    f.tube("wood", [o - d * 0.16, o + d * 0.8], 0.024, seg=10)
    f.ellipsoid("gold", o - d * 0.17, (0.032, 0.032, 0.032), seg=(10, 8))
    f.torus("gold", o + d * 0.09, 0.027, 0.007, normal=d, seg=(12, 5))
    h = o + d * 0.8
    ax = (side, d, up)
    box(f, "stone", h, (0.1, 0.105, 0.2), ax)
    box(f, "stone", h, (0.085, 0.09, 0.215), ax)
    for s in (1, -1):
        box(f, "gold", h + up * 0.125 * s, (0.107, 0.112, 0.018), ax)
        rune(f, "rune", h + side * 0.101 * s + up * 0.012, d, up, s=0.85, r=0.009)
    box(f, "gold", h + d * 0.11, (0.03, 0.012, 0.03), ax)
    return flats(R)
