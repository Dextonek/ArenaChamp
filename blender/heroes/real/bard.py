"""Cantor, the Last Verse (support): a slim man in a long plum coat with rose lapels and cuffs over a cream shirt, dark
breeches and tall boots, loose dark hair under a wide plum hat with a long rose feather, a parchment scarf printed with
notes, one end down his chest and one over his shoulder, and a great golden lyre held up in the left hand, its strings
the one glowing thing."""
import math

from mathutils import Vector

from realkit import PI, Real
from real.parts_b import edge_line, flats, lapels, legs_under, on_back, on_front, open_front, path, skirt_rings


def build():
    R = Real("bard", sex="m", height=1.0, width=0.88, depth=0.86, skin="#e9c6aa")
    z = R.z
    R.mat("plum", "#4a1a40", rough=0.6, double=True)
    R.mat("rose", "#b23a7c", rough=0.55, double=True)
    R.mat("cream", "#f2e6d0", rough=0.75, double=True)
    R.mat("dark", "#1e0a1a", rough=0.55)
    R.mat("gold", "#d9b24e", rough=0.3, metal=0.85)
    R.mat("string", "#ffd0ee", rough=0.3, emit="#ff6ac0", strength=1.0)
    R.hair("Hair_Long", "#241419", rough=0.45)

    # a cream shirt, the coat open over it in a V, rose lapels
    R.fitted("Shirt", ["spine", "pelvis", "clavicle"], "cream", offset=0.004)
    R.fitted("Sleeves", ["upperarm", "lowerarm"], "plum", offset=0.011)
    R.fitted("Coat", ["spine", "pelvis", "clavicle"], "plum", offset=0.012, where=open_front(R, 0.085, 0.022), keep_skin=True)
    lapels(R, R.piece("near"), "rose", 0.085, 0.022, r=0.02)
    legs_under(R, "dark", name="Breeches")
    R.boots("dark", top=z["knee"] + 0.02, cuff="gold", toe="gold")
    for n in "lr":   # turned-back rose cuffs
        f = R.piece(f"lowerarm_{n}")
        c0, r0 = R.arm_r(n, 0.72)
        c1, r1 = R.arm_r(n, 0.97)
        f.tube("rose", [c0, c0.lerp(c1, 0.5), c1], [r0 + 0.02, r0 + 0.024, r1 + 0.03], seg=14, caps=False)
        f.torus("gold", c0, r0 + 0.02, 0.006, normal=(1, 0, 0), seg=(18, 5))

    # the coat's skirt, open at the front, gold at the hem and down the opening
    hem = z["knee"] - 0.1
    R.skirt("plum", hem=hem, flare=1.55, depth=1.15, trim="gold", arc=(0.3, 2 * PI - 0.3))
    rings = skirt_rings(R, hem, 1.55, 1.15)
    f = R.piece(R.hang_w(z["waist"], hem))
    for a in (0.3, -0.3):
        edge_line(f, "gold", rings, a, hem, z["waist"], r=0.008)
    R.band("gold", z["waist"], height=0.05, grow=1.1, how=R.hang_w(z["waist"], hem))
    cw, rxw, ryw = R.ring(z["waist"])
    R.piece("pelvis").ellipsoid("rose", Vector((0, cw.y - ryw * 1.2, z["waist"])), (0.035, 0.014, 0.035), seg=(12, 8))

    # the parchment scarf: wound round the neck, one end down the chest, one over the left shoulder; notes in ink
    f, gem = R.collar("cream", height=0.065, grow=1.3)
    f.torus("cream", Vector((0, gem.y + 0.08, z["neck"] + 0.0)), 0.078, 0.022, seg=(22, 8))
    front = [on_front(R, -0.05, z["neck"] - 0.03, 0.02), on_front(R, -0.065, z["chest"] + 0.06, 0.02), on_front(R, -0.07, z["chest"] - 0.08, 0.022),
             on_front(R, -0.075, z["waist"] + 0.05, 0.03)]
    f.tube("cream", front, [0.03, 0.045, 0.048, 0.05], seg=8, squash=((0, 1, 0), 0.2))
    tz = max(p.z for p, dom in zip(R.world, R.dom) if abs(p.x - 0.1) < 0.03 and dom.startswith(("spine", "clavicle")))
    rear = [Vector((0.06, gem.y + 0.03, z["neck"] + 0.0)), Vector((0.1, 0.03, tz + 0.02)), on_back(R, 0.11, z["chest"] + 0.1, 0.022), on_back(R, 0.12, z["chest"] - 0.08, 0.025),
            on_back(R, 0.13, z["waist"] + 0.02, 0.04)]
    f.tube("cream", rear, [0.03, 0.04, 0.046, 0.048, 0.05], seg=8, squash=((0, 1, 0), 0.2))
    for line, sy in ((front, -1), (rear, 1)):
        for k in (1, 2, 3):
            for j, dz in enumerate((0.035, -0.015)):
                p = line[k] + Vector((0.016 * (1 if j else -1), 0.011 * sy, dz))
                f.ellipsoid("dark", p, (0.011, 0.005, 0.008), seg=(8, 5))
                f.tube("dark", [p + Vector((0.009, 0, 0)), p + Vector((0.009, 0, 0.03))], 0.0025, seg=4)
        f.tube("gold", [line[-1] + Vector((-0.05, 0.004 * sy, -0.012)), line[-1] + Vector((0.05, 0.004 * sy, -0.012))], 0.006, seg=5)

    # the hat: a wide tilted brim, a soft crown, a gold band, the long rose feather
    f, c, r = R.head_piece()
    nrm = Vector((0.16, 0.14, 1)).normalized()
    rot = Vector((0, 0, 1)).rotation_difference(nrm).to_matrix().to_4x4()
    hb = Vector((0.005, c.y + 0.02, z["top"] - 0.05))
    f.ellipsoid("plum", hb, (0.27, 0.28, 0.014), seg=(32, 6), rot=rot)
    f.torus("gold", hb, 0.27, 0.006, normal=nrm, seg=(40, 5))
    f.ellipsoid("plum", hb + nrm * 0.035, (0.122, 0.13, 0.085), seg=(22, 12), rot=rot)
    f.torus("gold", hb + nrm * 0.022, 0.123, 0.012, normal=nrm, seg=(28, 6))
    q = hb + nrm * 0.03 + Vector((0.11, -0.04, 0))
    quill = path([q, q + Vector((0.06, 0.08, 0.1)), q + Vector((0.07, 0.24, 0.19)), q + Vector((0.03, 0.42, 0.2)), q + Vector((-0.03, 0.56, 0.12))], 5)
    m = len(quill) - 1
    f.tube("rose", quill, [0.006 + 0.05 * math.sin(PI * (i / m) ** 0.7) for i in range(m + 1)], seg=8, squash=((1, 0, 0.3), 0.18))
    f.tube("gold", quill[:m - 2], 0.004, seg=4)

    # the lyre: big, golden, held up in the left hand (it faces the viewer: it lies in the plane of d and up)
    f, o, d, up = R.held("l")
    f.tube("gold", [o - d * 0.1, o + d * 0.14], [0.014, 0.018], seg=8)
    f.ellipsoid("gold", o - d * 0.11, (0.024, 0.024, 0.024), seg=(10, 8))
    box = o + d * 0.2
    f.ellipsoid("gold", box, (0.045, 0.08, 0.13), seg=(18, 12))
    f.ellipsoid("rose", box, (0.05, 0.035, 0.06), seg=(12, 8))
    for s in (1, -1):
        arm = path([box + up * 0.1 * s, o + d * 0.36 + up * 0.215 * s, o + d * 0.54 + up * 0.225 * s, o + d * 0.67 + up * 0.15 * s, o + d * 0.76 + up * 0.17 * s,
                    o + d * 0.8 + up * 0.235 * s], 5)
        m = len(arm) - 1
        f.tube("gold", arm, [0.028 - 0.016 * i / m for i in range(m + 1)], seg=8)
        f.ellipsoid("gold", arm[-1], (0.02, 0.02, 0.02), seg=(8, 6))
    f.tube("gold", [o + d * 0.66 - up * 0.2, o + d * 0.66 + up * 0.2], 0.013, seg=8)
    for s in (1, -1):
        f.ellipsoid("gold", o + d * 0.66 + up * 0.205 * s, (0.02, 0.02, 0.02), seg=(8, 6))
    for k in range(-3, 4):
        f.tube("string", [box + d * 0.07 + up * 0.022 * k, o + d * 0.66 + up * 0.042 * k], 0.0045, seg=4)
    return flats(R)
