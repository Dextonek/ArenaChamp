"""Mr. Ledger, the Tithe-Keeper (controller): a long thin arcane notary. Black robes to the floor with an oxblood front
panel edged in gold, a high stiff oxblood collar, wide sleeves with gold cuffs, a gold belt, two swags of gold coins on
chains across the chest, grey slicked hair. A great red book hangs chained at his left hip, a red wax seal glowing on
its cover, and a quill staff taller than he is stands in the left hand: a gold nib at the floor, a long feather on top."""
import math

from mathutils import Vector

from realkit import PI, Real
from real.parts_b import bell_sleeves, box, disc, edge_line, flats, legs_under, neck_band, on_front, path, plate, skirt_band, skirt_rings, staff_back


def build():
    R = Real("ledger", sex="m", height=1.12, width=0.84, depth=0.82, head=0.94, skin="#dccfc6")
    z = R.z
    R.mat("robe", "#17151b", rough=0.65, double=True)
    R.mat("ox", "#611619", rough=0.55, double=True)
    R.mat("gold", "#d9c27a", rough=0.3, metal=0.85)
    R.mat("red", "#9c231f", rough=0.5)
    R.mat("paper", "#e6d9ae", rough=0.8, double=True)
    R.mat("seal", "#ff7a66", rough=0.35, emit="#d9453a", strength=1.0)
    R.hair("Hair_SimpleParted", "#8f8f94", rough=0.35)

    R.fitted("Robe", ["spine", "pelvis", "clavicle", "upperarm", "lowerarm"], "robe", offset=0.008)
    cc = R.ring(z["chest"])[0]
    R.fitted("Panel", ["spine", "pelvis", "clavicle"], "ox", offset=0.013, where=lambda p: abs(p.x) < 0.078 and p.y < cc.y, keep_skin=True)
    legs_under(R, "robe", offset=0.003)
    R.boots("robe", top=z["ankle"] + 0.08)
    bell_sleeves(R, "robe", k0=1.35, k1=2.9, t0=0.02, drop=0.6, trim="gold", trim_r=0.013)
    R.cuffs("gold", at=(0.95,), offset=0.008, thick=0.006)
    f = R.piece("near")
    for s in (1, -1):
        f.tube("gold", [on_front(R, 0.082 * s, zz, 0.017) for zz in [z["neck"] - 0.04 - (z["neck"] - 0.04 - z["waist"]) * k / 8 for k in range(9)]], 0.007, seg=5)

    # the robe's skirt to the floor, the oxblood panel down its front between gold edges
    hem = z["ankle"] + 0.03
    flare = 1.5
    R.skirt("robe", hem=hem, flare=flare, depth=1.2, trim="gold", trim_h=0.025)
    rings = skirt_rings(R, hem, flare, 1.2)
    f = R.piece(R.hang_w(z["waist"], hem))
    a1 = 0.5
    skirt_band(f, "ox", rings, hem + 0.025, z["waist"], off=0.006, arc=(-a1, a1), seg=8, steps=6)
    for a in (-a1, a1):
        edge_line(f, "gold", rings, a, hem + 0.025, z["waist"], r=0.007, off=0.008, n=10)
    R.band("gold", z["waist"], height=0.05, grow=1.1, how=R.hang_w(z["waist"], hem))

    # the high stiff collar, open at the throat, a close oxblood band round the neck inside it
    neck_band(R, "ox")
    cn = R.ring(z["neck"], dz=0.02)[0]
    f = R.piece("spine_03")
    col = [(Vector((0, cn.y - 0.01, z["neck"] - 0.04)), 0.1, 0.1), (Vector((0, cn.y, z["neck"] + 0.05)), 0.112, 0.118), (Vector((0, cn.y + 0.012, z["neck"] + 0.16)), 0.15, 0.158)]
    f.loft("ox", col, seg=20, arc=(0.62, 2 * PI - 0.62))
    top = [Vector((0.15 * math.sin(a), cn.y + 0.012 - 0.158 * math.cos(a), z["neck"] + 0.16)) for a in [0.62 + (2 * PI - 1.24) * k / 20 for k in range(21)]]
    f.tube("gold", top, 0.007, seg=5)
    for a in (0.62, 2 * PI - 0.62):
        f.tube("gold", [Vector((rx * math.sin(a), c.y - ry * math.cos(a), c.z)) for c, rx, ry in col], 0.006, seg=5)

    # two swags of gold coins on chains across the chest
    for x0, zt, sag in ((0.15, z["chest"] + 0.13, 0.11), (0.165, z["chest"] + 0.06, 0.17)):
        pts = []
        for k in range(13):
            t = -1 + 2 * k / 12
            pts.append(on_front(R, x0 * t, zt - sag * (1 - t * t), 0.02))
        f.tube("gold", pts, 0.004, seg=4)
        for p in pts[1:-1:2]:
            disc(f, "gold", p + Vector((0, -0.004, -0.014)), (0, -1, 0), 0.019, thick=0.006, seg=10)

    # the great red book at the left hip: boards, a spine, pages, gold corners, a clasp, the glowing wax seal, its chain
    ch, rxh, ryh = R.ring(z["hip"] - 0.02)
    f = R.piece("pelvis")
    bk = Vector((ch.x + rxh * 1.5 + 0.06, ch.y - 0.02, z["hip"] - 0.03))
    for sx in (1, -1):
        box(f, "red", bk + Vector((0.046 * sx, 0, 0)), (0.009, 0.15, 0.2))
    box(f, "red", bk + Vector((0, 0.142, 0)), (0.055, 0.012, 0.2))
    box(f, "paper", bk + Vector((0, -0.006, 0)), (0.038, 0.136, 0.19))
    for sy in (1, -1):
        for sz in (1, -1):
            box(f, "gold", bk + Vector((0.05, 0.125 * sy, 0.175 * sz)), (0.008, 0.03, 0.03))
    box(f, "gold", bk + Vector((0, -0.15, 0.0)), (0.058, 0.006, 0.02))
    sc = bk + Vector((0.058, 0, 0.01))
    disc(f, "seal", sc, (1, 0, 0), 0.06, thick=0.016, seg=18)
    f.torus("gold", sc, 0.066, 0.008, normal=(1, 0, 0), seg=(22, 5))
    for a in (0.4, 2.0, 3.6, 5.2):
        f.tube("gold", [sc + Vector((0.006, 0.02 * math.cos(a), 0.02 * math.sin(a))), sc + Vector((0.006, 0.045 * math.cos(a), 0.045 * math.sin(a)))], 0.004, seg=4)
    cw, rxw, ryw = R.ring(z["waist"])
    for y0 in (0.11, -0.11):
        chain = path([bk + Vector((0, y0, 0.2)), bk + Vector((-0.03, y0 * 0.8, 0.27)), Vector((cw.x + rxw * 1.12, cw.y + y0 * 0.45, z["waist"] - 0.01))], 4)
        f.tube("gold", chain, 0.006, seg=5)
        for p in chain[1::2]:
            f.ellipsoid("gold", p, (0.012, 0.012, 0.012), seg=(6, 5))

    # the quill staff: a gold nib at the floor, a pale shaft, the long feather on top (flat to the viewer)
    f, o, d, up = R.held("l")
    L = staff_back(R)
    f.tube("paper", [o - d * (L - 0.14), o + d * 0.3], [0.013, 0.011], seg=8)
    f.tube("gold", [o - d * (L - 0.2), o - d * (L - 0.13), o - d * (L - 0.05), o - d * L], [0.014, 0.022, 0.014, 0.002], seg=8, squash=(tuple(d.cross(up)), 0.6))
    f.torus("gold", o - d * 0.1, 0.018, 0.006, normal=d, seg=(12, 5))
    f.torus("gold", o + d * 0.1, 0.018, 0.006, normal=d, seg=(12, 5))
    base = o + d * 0.24
    vane = [(0.0, 0.01), (0.07, 0.05), (0.22, 0.09), (0.45, 0.105), (0.66, 0.09), (0.8, 0.055), (0.88, 0.0), (0.82, -0.035), (0.68, -0.058), (0.46, -0.066), (0.24, -0.055),
            (0.08, -0.03), (0.0, -0.01)]
    plate(f, "paper", base, vane, d, up, 0.008)
    f.tube("gold", [base, base + d * 0.45, base + d * 0.87], [0.008, 0.006, 0.002], seg=5)
    for t, ln in ((0.3, 0.07), (0.52, 0.075), (0.7, 0.06)):   # the dark bars of the feather
        plate(f, "robe", base + d * t, [(0, 0.012), (ln * 0.5, 0.09 - 0.05 * (t - 0.3)), (ln * 0.5 + 0.03, 0.085 - 0.05 * (t - 0.3)), (0.03, 0.012)], d, up, 0.011)
    return flats(R)
