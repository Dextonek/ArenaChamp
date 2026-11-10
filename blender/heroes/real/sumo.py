"""Big Yoko, the Mountain (tank): a giant dressed like a grand champion at a shrine, by far the widest hero. A great belly
on the body's own skin, a dark crimson belt under a thick twisted straw rope tied at the back in two great loops, four
zigzag paper charms, a crimson stole over the left shoulder and across the belly, a stiff lacquered apron to the shins
with a gold border, a red fringe and a glowing crimson crest, thin crimson shoulder plates, dark forearm guards and shin
wraps with gold edges, a black topknot tied in gold, bare feet. He fights with his hands."""
import math

from mathutils import Matrix, Vector

from realkit import PI, Real
from real.parts_b import arms, back_y, belly, ellipse, flats, front_y, hair_key, plate, ring_pt


def rope(f, key, twist, pts, r, turns, c):
    """A twisted rope along `pts` round `c`: a thick tube and two dark strands wound round it."""
    f.tube(key, pts, r, seg=10)
    n = len(pts) - 1
    for ph in (0.0, PI):
        hel = []
        for i in range(n * 3 + 1):
            t = i / 3
            k = min(n - 1, int(t))
            p = pts[k].lerp(pts[k + 1], t - k)
            out = Vector((p.x - c.x, p.y - c.y, 0)).normalized()
            ang = ph + turns * 2 * PI * i / (n * 3)
            hel.append(p + (out * math.cos(ang) + Vector((0, 0, 1)) * math.sin(ang)) * r * 0.86)
        f.tube(twist, hel, r * 0.3, seg=5)


def build():
    R = Real("sumo", sex="m", height=1.06, width=1.42, depth=1.55, head=0.84, skin="#e6b08a")
    arms(R, length=0.8, thick_y=1.05, thick_z=1.42)
    belly(R, amount=0.17, z=R.z["waist"] + 0.05, spread=0.25, back=0.3)
    z = R.z
    R.mat("crimson", "#8a1f1f", rough=0.55, double=True)
    R.mat("rope", "#d2b46a", rough=0.9)
    R.mat("twist", "#8a6a2c", rough=0.9)
    R.mat("lacquer", "#1e1412", rough=0.35, metal=0.3, double=True)
    R.mat("gold", "#d2ac5a", rough=0.32, metal=0.85)
    R.mat("paper", "#fff8ea", rough=0.8, double=True)
    R.mat("crest", "#ff5a4a", rough=0.35, emit="#e63a3a", strength=1.0)
    R.hair("Hair_Buzzed", "#141012", rough=0.4)
    w, d, h, hd = R.build

    # the belt (mawashi), rolled at the thighs
    zb = z["hip"] + 0.06
    R.fitted("Mawashi", lambda i: R.dom[i].startswith("pelvis") or (R.dom[i].startswith("thigh") and R.world[i].z > z["hip"] - 0.11), "crimson", offset=0.012)
    R.band("crimson", zb, height=0.17, grow=1.05)
    for n in "lr":
        c, r = R.leg_r(n, z["hip"] - 0.115)
        R.piece(f"thigh_{n}").torus("crimson", c, r + 0.012, 0.02, seg=(24, 8))

    # forearm guards, shin wraps
    R.fitted("Guards", ["lowerarm"], "lacquer", offset=0.012)
    R.cuffs("gold", at=(0.1, 0.93), offset=0.006, thick=0.009)
    R.fitted("Wraps", lambda i: R.dom[i].startswith("calf") and z["ankle"] + 0.03 < R.world[i].z < z["knee"] - 0.07, "lacquer", offset=0.008)
    for n in "lr":
        f = R.piece(f"calf_{n}")
        for zz in (z["knee"] - 0.075, z["ankle"] + 0.035):
            c, r = R.leg_r(n, zz)
            f.torus("gold", c, r + 0.01, 0.009, seg=(22, 6))

    # the stole: over the left shoulder, across the belly to the right hip, and down the back
    tz = max(p.z for p, dom in zip(R.world, R.dom) if abs(p.x - 0.15) < 0.03 and dom.startswith(("spine", "clavicle")))
    zw = z["hip"] + 0.16
    front, rear = [], []
    for k in range(9):
        t = k / 8
        x = 0.15 - 0.4 * t
        zz = tz - 0.04 + (zw - tz + 0.04) * t
        front.append(Vector((x, front_y(R, x, zz) - 0.02, zz)))
        rear.append(Vector((x, back_y(R, x, zz) + 0.02, zz)))
    top = Vector((0.15, (front[0].y + rear[0].y) / 2, tz + 0.022))
    pts = list(reversed(front)) + [top] + rear
    rad = [0.09 - 0.045 * (1 - k / 8) ** 2 for k in range(8, -1, -1)] + [0.04] + [0.09 - 0.045 * (1 - k / 8) ** 2 for k in range(9)]
    f = R.piece("near")
    f.tube("crimson", pts, rad, seg=10, squash=((0, 1, 0), 0.2))
    for p in (front[2], front[5], rear[3]):   # gold bars across it
        f.tube("gold", [p + Vector((-0.06, 0, 0.045)), p + Vector((0.06, 0, -0.045))], 0.006, seg=5)

    # thin crimson shoulder plates with gold edges, lying on top of the shoulders (they stay there when the arms hang)
    for s, n in ((1, "l"), (-1, "r")):
        f = R.piece(f"clavicle_{n}")
        j = R.bone(f"upperarm_{n}")
        top = max(p.z for p, dom in zip(R.world, R.dom) if abs(p.x - (j.x + 0.015 * s)) < 0.03 and dom.startswith(("upperarm", "clavicle")))
        c = Vector((j.x + 0.012 * s, j.y, top + 0.004))
        rot = Matrix.Rotation(0.3 * s, 4, "Y")
        f.ellipsoid("crimson", c, (0.115, 0.095, 0.026), seg=(18, 8), rot=rot)
        f.tube("gold", [c + rot @ Vector((0.115 * math.cos(t), 0.095 * math.sin(t), -0.003)) for t in [2 * PI * k / 24 for k in range(25)]], 0.007, seg=5)

    # the lacquered apron: a gold border, a red fringe, the glowing crest
    hem = z["knee"] - 0.2
    cb, rxb, ryb = R.ring(zb)
    apron = [(Vector((cb.x, cb.y - 0.03, hem)), rxb * 1.1, ryb * 1.2), (Vector((cb.x, cb.y - 0.012, z["hip"] - 0.16)), rxb * 1.12, ryb * 1.2),
             (Vector((cb.x, cb.y, zb + 0.02)), rxb * 1.09, ryb * 1.13)]
    a1 = 0.55
    f = R.piece(R.hang_w(zb, hem, hold=0.55))
    f.loft("lacquer", apron, seg=14, arc=(-a1, a1))
    edge = [ring_pt(apron, -a1, zb)] + [ring_pt(apron, -a1, hem + (zb - hem) * (1 - k / 6)) for k in range(1, 7)]
    edge += [ring_pt(apron, -a1 + 2 * a1 * k / 12, hem) for k in range(1, 13)] + [ring_pt(apron, a1, hem + (zb - hem) * k / 6) for k in range(1, 7)]
    f.tube("gold", edge, 0.011, seg=6)
    inner = [ring_pt(apron, -a1 * 0.78 + 2 * a1 * 0.78 * k / 10, hem + 0.07, 0.004) for k in range(11)]
    f.tube("gold", inner, 0.005, seg=5)
    for k in range(15):
        p = ring_pt(apron, -a1 * 0.94 + 2 * a1 * 0.94 * k / 14, hem)
        f.tube("crimson", [p + Vector((0, 0, 0.005)), p + Vector((0, -0.004, -0.075))], [0.013, 0.006], seg=5)
    cz = hem + (zb - hem) * 0.47
    cp = ring_pt(apron, 0.0, cz, 0.008)
    r = 0.12
    f.ellipsoid("crest", cp + Vector((0, 0.004, 0)), (r / w, 0.014, r / h), seg=(24, 10), keep=lambda co: co.y < cp.y + 0.002)
    f.tube("gold", [cp + Vector((r * 1.06 / w * math.sin(a), -0.003, r * 1.06 / h * math.cos(a))) for a in [2 * PI * k / 28 for k in range(29)]], 0.009, seg=6)
    # the mountain in the crest: three gold peaks
    for dx, hh in ((-0.035, 0.035), (0.0, 0.065), (0.035, 0.035)):
        plate(f, "gold", cp + Vector((dx / w * 1.0, -0.016, -0.03 / h)), [(-0.022 / w, 0), (0.022 / w, 0), (0, hh / h)], (1, 0, 0), (0, 0, 1), 0.006)

    # the straw rope, tied at the back in two great loops, and the paper charms
    zr = zb + 0.105
    cr, rxr, ryr = R.ring(zr)
    rr = 0.05
    ring = ellipse(cr, rxr * 1.04 + rr * 0.75, ryr * 1.05 + rr * 0.6, PI, 3 * PI, n=48)
    f = R.piece("pelvis")
    rope(f, "rope", "twist", ring, rr, 26, cr)
    kb = Vector((0, cr.y + ryr * 1.05 + rr * 1.3, zr + 0.02))
    f.ellipsoid("rope", kb, (0.075, 0.05, 0.075), seg=(14, 10))
    for s in (1, -1):
        lc = kb + Vector((0.125 * s, 0.03, 0.115))
        nrm = Vector((0.25 * s, 1, 0.3)).normalized()
        u = nrm.cross(Vector((0, 0, 1))).normalized()
        v = nrm.cross(u).normalized()
        loop = [lc + (u * math.cos(2 * PI * k / 20) * 0.115 + v * math.sin(2 * PI * k / 20) * 0.15) for k in range(21)]
        rope(f, "rope", "twist", loop, 0.04, 9, lc)
        end = [kb + Vector((0.03 * s, 0.02, -0.03)), kb + Vector((0.07 * s, 0.07, -0.2)), kb + Vector((0.09 * s, 0.06, -0.36))]
        f.tube("rope", end, [0.036, 0.034, 0.03], seg=8)
        f.tube("twist", [end[2] + Vector((0, 0, 0.03)), end[2] + Vector((0.01 * s, 0.005, -0.08))], [0.034, 0.05], seg=8)
    ell = lambda a: Vector((cr.x + (rxr * 1.04 + rr * 1.5) * math.sin(a), cr.y - (ryr * 1.05 + rr * 1.35) * math.cos(a), zr))
    for a in (-1.2, -0.82, 0.82, 1.2):
        p = ell(a)
        tan = (ell(a + 0.05) - ell(a - 0.05)).normalized()
        f.tube("paper", [p + Vector((0, 0, 0.0)), p + Vector((0, 0, -0.05))], 0.006, seg=4)
        for k in range(3):
            c = p + Vector((0, 0, -0.065 - 0.05 * k)) + tan * (0.014 if k % 2 else -0.014) / w
            plate(f, "paper", c, [(-0.024 / w, -0.028), (0.024 / w, -0.028), (0.024 / w, 0.028), (-0.024 / w, 0.028)], tan, (0, 0, 1), 0.006)

    # the topknot, folded forward over the crown, tied in gold
    f, c, r = R.head_piece()
    hk = hair_key(R)
    tp = Vector((0, c.y + 0.035, z["top"] - 0.012))
    f.ellipsoid(hk, tp + Vector((0, 0.03, -0.02)), (0.05, 0.05, 0.035), seg=(14, 8))
    f.tube(hk, [tp + Vector((0, 0.04, 0.0)), tp + Vector((0, 0.02, 0.05)), tp + Vector((0, -0.04, 0.052)), tp + Vector((0, -0.095, 0.03))], [0.03, 0.03, 0.026, 0.018], seg=10)
    f.torus("gold", tp + Vector((0, 0.03, 0.022)), 0.032, 0.008, normal=(0, 0.5, 1), seg=(16, 6))
    return flats(R)
