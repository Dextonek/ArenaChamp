"""Tempo, the Unwound Hour (mage): a slim man in a long green-black coat edged in chartreuse over an ivory waistcoat with
gold buttons and a watch chain, loose white hair, a gold monocle on a chain, an ivory dial plate on the left shoulder,
a clock-dial halo behind his head whose ticks and hands glow, and a staff shaped like a giant minute hand in the left
hand, a red second hand at its pivot."""
import math

from mathutils import Vector

from realkit import PI, Real
from real.parts_b import blade, disc, edge_line, flats, lapels, legs_under, on_front, open_front, plate, skirt_rings, staff_back


def build():
    R = Real("chrono", sex="m", height=1.02, width=0.88, depth=0.86, skin="#ead2c0")
    z = R.z
    R.mat("coat", "#1b2416", rough=0.6, double=True)
    R.mat("ivory", "#f4ecd8", rough=0.7, double=True)
    R.mat("dark", "#0c100a", rough=0.5, metal=0.3)
    R.mat("lime", "#93b536", rough=0.55, double=True)
    R.mat("glow", "#ecffb0", rough=0.3, emit="#d4ff5a", strength=1.0)
    R.mat("gold", "#c9a24a", rough=0.32, metal=0.85)
    R.mat("red", "#ff4a4a", rough=0.4)
    R.hair("Hair_SimpleParted", "#eeeee8", rough=0.45)

    # an ivory waistcoat, the coat open over it, chartreuse lapels
    R.fitted("Waistcoat", ["spine", "pelvis", "clavicle"], "ivory", offset=0.004)
    R.fitted("Sleeves", ["upperarm", "lowerarm"], "coat", offset=0.011)
    R.fitted("Coat", ["spine", "pelvis", "clavicle"], "coat", offset=0.012, where=open_front(R, 0.085, 0.05), keep_skin=True)
    f = R.piece("near")
    lapels(R, f, "lime", 0.085, 0.05, r=0.016)
    for k in range(4):
        f.ellipsoid("gold", on_front(R, 0, z["chest"] + 0.02 - 0.065 * k, 0.008), (0.012, 0.007, 0.012), seg=(8, 6))
    chain = [on_front(R, x, zz, 0.01) for x, zz in ((0.0, z["chest"] - 0.045), (-0.02, z["chest"] - 0.1), (-0.045, z["chest"] - 0.115), (-0.07, z["chest"] - 0.09))]
    f.tube("gold", chain, 0.004, seg=5)
    legs_under(R, "dark", name="Trousers")
    R.boots("dark", top=z["knee"] - 0.03, cuff="gold")
    R.cuffs("lime", at=(0.88,), offset=0.014, thick=0.012)
    R.cuffs("gold", at=(0.96,), offset=0.012, thick=0.007)

    # the long coat's skirt, open at the front, chartreuse at the hem and down the opening
    hem = z["knee"] - 0.2
    R.skirt("coat", hem=hem, flare=1.5, depth=1.15, trim="lime", trim_h=0.028, arc=(0.34, 2 * PI - 0.34))
    rings = skirt_rings(R, hem, 1.5, 1.15)
    f = R.piece(R.hang_w(z["waist"], hem))
    for a in (0.34, -0.34):
        edge_line(f, "lime", rings, a, hem, z["waist"], r=0.011)
    R.band("dark", z["waist"], height=0.05, grow=1.1, how=R.hang_w(z["waist"], hem))
    cw, rxw, ryw = R.ring(z["waist"])
    f = R.piece("pelvis")
    disc(f, "gold", Vector((0, cw.y - ryw * 1.2, z["waist"])), (0, -1, 0), 0.034, thick=0.012, seg=12)
    disc(f, "ivory", Vector((0, cw.y - ryw * 1.2 - 0.005, z["waist"])), (0, -1, 0), 0.025, thick=0.012, seg=12)
    f, gem = R.collar("coat", height=0.08, grow=1.32)
    f.ellipsoid("ivory", gem + Vector((0, 0.012, -0.01)), (0.04, 0.02, 0.04), seg=(12, 8))
    f.ellipsoid("gold", gem + Vector((0, -0.008, 0.0)), (0.009, 0.007, 0.009), seg=(8, 6))

    # the ivory dial plate on the left shoulder
    f = R.piece("clavicle_l")
    sh = R.bone("upperarm_l") + Vector((0.01, 0, 0.055))
    nrm = Vector((0.45, -0.1, 1)).normalized()
    disc(f, "ivory", sh, nrm, 0.095, thick=0.022, seg=20)
    f.torus("gold", sh + nrm * 0.008, 0.095, 0.009, normal=nrm, seg=(26, 6))
    u = nrm.cross(Vector((0, 1, 0))).normalized()
    v = nrm.cross(u).normalized()
    f.tube("dark", [sh + nrm * 0.014, sh + nrm * 0.014 + u * 0.06], 0.005, seg=5)
    f.tube("dark", [sh + nrm * 0.014, sh + nrm * 0.014 + v * 0.04], 0.006, seg=5)
    f.ellipsoid("gold", sh + nrm * 0.014, (0.011, 0.011, 0.011), seg=(8, 6))
    f = R.piece("upperarm_r")
    f.ellipsoid("coat", R.bone("upperarm_r") + Vector((-0.03, 0, 0.03)), (0.075, 0.065, 0.035), seg=(14, 8))

    # the clock-dial halo behind his head: a gold ring, glowing ticks and hands, a red second hand
    f, c, r = R.head_piece()
    hc = c + Vector((0, r + 0.1, 0.035))
    back = Vector((0, 1, 0))
    f.torus("gold", hc, 0.29, 0.011, normal=back, seg=(44, 6))
    f.torus("gold", hc, 0.215, 0.005, normal=back, seg=(36, 5))
    for k in range(12):
        a = 2 * PI * k / 12
        dr = Vector((math.sin(a), 0, math.cos(a)))
        long = k % 3 == 0
        f.tube("glow", [hc + dr * (0.2 if long else 0.228), hc + dr * 0.275], 0.011 if long else 0.007, seg=5)
    for a, ln, wd in ((0.62, 0.25, 0.04), (-1.25, 0.17, 0.05)):
        dr = Vector((math.sin(a), 0, math.cos(a)))
        blade(f, "glow", hc, dr, dr.cross(back), ln, wd, thick=0.014, tip=0.35, root=0.012)
    dr = Vector((math.sin(2.6), 0, math.cos(2.6)))
    f.tube("red", [hc - dr * 0.06, hc + dr * 0.25], 0.004, seg=4)
    f.ellipsoid("gold", hc, (0.022, 0.014, 0.022), seg=(10, 6))

    # the monocle over his right eye, its chain to the collar
    ez = z["head"] + (z["top"] - z["head"]) * 0.47
    m = Vector((-0.034, c.y - r * 0.84, ez))
    f.torus("gold", m, 0.019, 0.0035, normal=(0.15, 1, 0), seg=(18, 5))
    disc(f, "glow", m + Vector((0, 0.003, 0)), (0.15, 1, 0), 0.017, thick=0.003, seg=14)
    f.tube("gold", [m + Vector((-0.018, 0.004, -0.005)), m + Vector((-0.05, 0.03, -0.06)), m + Vector((-0.045, 0.045, -0.13))], 0.0025, seg=4)

    # the staff: a giant minute hand (flat to the viewer), a counterweight ring at the floor, the red second hand at the pivot
    f, o, d, up = R.held("l")
    L = staff_back(R)
    side = d.cross(up)
    f.tube("dark", [o - d * (L - 0.1), o + d * 0.32], 0.014, seg=8)
    f.torus("gold", o - d * (L - 0.06), 0.052, 0.012, normal=side, seg=(20, 6))
    f.torus("gold", o - d * 0.1, 0.02, 0.006, normal=d, seg=(12, 5))
    f.torus("gold", o + d * 0.1, 0.02, 0.006, normal=d, seg=(12, 5))
    hub = o + d * 0.34
    disc(f, "gold", hub, side, 0.05, thick=0.03, seg=18)
    disc(f, "ivory", hub, side, 0.034, thick=0.036, seg=14)
    sec = (d * 0.75 + up * 0.66).normalized()
    f.tube("red", [hub - sec * 0.07, hub + sec * 0.2], [0.006, 0.003], seg=5)
    f.ellipsoid("red", hub - sec * 0.07, (0.012, 0.012, 0.012), seg=(8, 6))
    blade(f, "dark", hub + d * 0.03, d, up, 0.72, 0.15, thick=0.022, tip=0.3, waist=(0.34, 0.2), root=0.04)
    blade(f, "glow", hub + d * 0.28, d, up, 0.4, 0.085, thick=0.03, tip=0.42, waist=(0.12, 0.25), root=0.012)
    return flats(R)
