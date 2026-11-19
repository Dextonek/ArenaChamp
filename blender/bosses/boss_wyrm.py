"""
A Raid boss candidate (2026-11-19): the Eclipse Wyrm, a dragon that came down the Gnomon when the Noonfall's sun went dark.
The user asked for a boss "at this level of model" after a study of AI-made low-poly Roblox dragons: a designed creature
(head, jaw and teeth, horns, crown, armour plates, wings with membranes, claws) instead of a heap of chunks.

Built like the other bosses (blender/bosses/boss_bodies.py, whose helpers it uses): rigid parts in a named hierarchy, NO
armature, every part's origin the point it turns about, flat facets, a palette of a few materials. The game would pose it
in code (src/raid/bodies/*.ts) as it does the Warden and Ash. Faces -Y, z up, metres.

Parts: wyrm > torso > (neck1 > neck2 > neck3 > neck4 > head > jaw, crown), wingL > wingTipL, wingR > wingTipR,
legFL, legFR, legBL, legBR, tail1 > tail2 > tail3 > tail4 > tail5.

    import sys; sys.path.insert(0, r"C:\\VFXTool\\blender\\bosses")
    import boss_bodies, boss_wyrm
    boss_wyrm.register()
    boss_bodies.sheet("wyrm")      # docs/bosses/wyrm_sheet.jpg
    boss_bodies.export("wyrm")     # public/models/bosses/wyrm.glb
"""
import math

from mathutils import Matrix, Vector

import boss_bodies as bb
from boss_bodies import Boss, R, T, _limb_xf, interp


def S(x=1.0, y=1.0, z=1.0):
    return Matrix.Diagonal((x, y, z, 1.0))


def seg(part, p0, p1, r0, r1, m, sides=8, belly=1.0, rot0=0.3):
    """A faceted tube from p0 to p1 (radius r0 to r1)."""
    L = (Vector(p1) - Vector(p0)).length
    part.lathe([(0, r0), (L * 0.5, (r0 + r1) / 2 * belly), (L, r1)], m, sides=sides, xf=_limb_xf(p0, p1), rot0=rot0)


def cone(part, base, tip, r, m, sides=6):
    """A spike from `base` (radius r) to a point at `tip`."""
    L = (Vector(tip) - Vector(base)).length
    part.lathe([(0, r), (L * 0.55, r * 0.55), (L, 0.012)], m, sides=sides, xf=_limb_xf(base, tip), rot0=0.5)


def panel(part, pts, m, th=0.045):
    """A thin flat solid through 3-4 points (a wing membrane, a plate)."""
    a, b, c = (Vector(p) for p in pts[:3])
    n = (b - a).cross(c - a).normalized() * th
    part.hull([Vector(p) + n for p in pts] + [Vector(p) - n for p in pts], m)


def plate(part, centre, along, up, size, m, taper=(0.75, 0.8), bevel=0.05):
    """A chamfered plate at `centre`, its length on `along`, its thickness on `up`."""
    y = Vector(along).normalized()
    z = Vector(up).normalized()
    x = y.cross(z).normalized()
    z = x.cross(y).normalized()
    M = Matrix((x, y, z)).transposed().to_4x4()
    part.chunk(size, m, xf=T(*centre) @ M, bevel=bevel, taper=taper)


def lerp(a, b, t):
    return Vector(a).lerp(Vector(b), t)


def build_wyrm():
    B = Boss("wyrm", 9.0)
    body = B.m("body", "#34419c", 0.05, 0.65)
    dark = B.m("dark", "#1e2560", 0.05, 0.75)
    bone = B.m("bone", "#e4d9c2", 0.0, 0.7)
    gold = B.m("gold", "#dca63c", 0.75, 0.35)
    horn = B.m("horn", "#2b2236", 0.1, 0.6)
    memb = B.m("memb", "#6a49c8", 0.0, 0.6)
    memb_hi = B.m("memb_hi", "#a28cf0", 0.0, 0.55)
    eclipse = B.m("eclipse", "#0b0a12", 0.2, 0.5)
    glow = B.m("glow", "#ffe2a0", 0.0, 0.4, emit="#ffd27a", strength=2.2)

    # --- torso: a lathe along the body (local z -> world -y), taller than wide ---------------------------------------
    TZ = 2.8
    prof = [(-2.9, 0.5), (-2.4, 1.05), (-1.7, 1.32), (-0.7, 1.22), (0.4, 1.38), (1.4, 1.55), (2.1, 1.35), (2.6, 0.75)]
    torso = B.part("torso", (0, 0, TZ))
    tx = T(0, 0, TZ) @ R(x=math.pi / 2) @ S(0.95, 1.12, 1.0)
    torso.lathe(prof, [dark, body, body, body, body, body, dark], sides=12, xf=tx, rot0=math.pi / 12)
    # shoulder and hip masses: the legs grow out of muscle, not out of a barrel
    for s in (-1, 1):
        torso.rock(Vector((s * 1.05, -1.5, 2.75)), (0.72, 0.95, 0.95), body, n=20, rough=0.08)
        torso.rock(Vector((s * 1.0, 1.65, 2.75)), (0.72, 1.0, 0.92), body, n=20, rough=0.08)
        torso.rock(Vector((s * 0.55, -1.9, 3.5)), (0.6, 0.7, 0.55), body, n=16, rough=0.1)

    def r_at(y):
        return interp(prof, -y)

    # belly plates (bone), a row under the chest and belly
    for i in range(9):
        y = -2.1 + i * 0.5
        r = r_at(y)
        plate(torso, (0, y, TZ - r * 1.12 - 0.02), (0, 1, 0), (0, 0.15, -1), (1.25 - abs(i - 3) * 0.06, 0.46, 0.2), bone)
    # spine spikes (gold), along the back, leaning back
    for i in range(8):
        y = -1.7 + i * 0.55
        top = TZ + r_at(y) * 1.12
        h = 0.75 - abs(i - 2.5) * 0.06
        cone(torso, (0, y, top - 0.12), (0, y + 0.35, top + h), 0.2, gold)
    # side armour bands (gold), three on each flank
    for y in (-1.2, 0.0, 1.2):
        for s in (-1, 1):
            r = r_at(y)
            plate(torso, (s * r * 0.92, y, TZ + 0.25), (0, 1, 0), (s, 0, 0.35), (0.9, 0.34, 0.12), gold, taper=(0.8, 0.9))
    # chest armour: a gold breastplate with a sun boss
    torso.hull([(sx * 0.95, -2.35, z) for sx in (-1, 1) for z in (2.0, 3.5)] + [(sx * 0.55, -2.75, z) for sx in (-1, 1) for z in (2.2, 3.2)], gold)
    torso.lathe([(0, 0.34), (0.1, 0.3), (0.16, 0.0)], glow, sides=8, xf=T(0, -2.76, 2.75) @ R(x=math.pi / 2))
    torso.finish()

    # --- neck: four segments curving up and forward -------------------------------------------------------------------
    npts = [(0, -2.05, 3.55), (0, -2.65, 4.55), (0, -3.05, 5.45), (0, -3.25, 6.25), (0, -3.32, 6.9)]
    nrad = [0.86, 0.74, 0.64, 0.56, 0.5]
    parent = "torso"
    for i in range(4):
        p0, p1 = Vector(npts[i]), Vector(npts[i + 1])
        nk = B.part(f"neck{i + 1}", p0, parent)
        seg(nk, p0, p1 + (p1 - p0) * 0.12, nrad[i], nrad[i + 1], body, sides=8, belly=1.04)
        d = (p1 - p0).normalized()
        front = Vector((0, -d.z, d.y))  # forward-facing side of the neck
        mid = (p0 + p1) / 2
        for k in range(2):
            c = p0.lerp(p1, 0.3 + 0.45 * k)
            plate(nk, c + front * (nrad[i] * 0.9), d, front, (nrad[i] * 1.45, (p1 - p0).length * 0.62, 0.15), bone, taper=(0.6, 0.85))
        cone(nk, mid - front * (nrad[i] * 0.8), mid - front * (nrad[i] * 0.8 + 0.55) + d * 0.25, 0.16, gold)
        # a gold collar ring at the base of the first segment
        if i == 0:
            nk.lathe([(0, nrad[0] * 1.12), (0.18, nrad[0] * 1.12)], gold, sides=10, xf=_limb_xf(p0, p1))
        nk.finish()
        parent = f"neck{i + 1}"

    # --- head: a long wedge skull, brow, eyes, teeth, horns, a gem --------------------------------------------------
    hp = Vector(npts[-1])
    head = B.part("head", hp, "neck4")
    skull = []
    for sx in (-1, 1):
        skull += [(sx * 0.52, -3.05, 6.75), (sx * 0.55, -3.1, 7.45), (sx * 0.6, -3.85, 6.85), (sx * 0.56, -3.85, 7.5),
                  (sx * 0.38, -4.9, 6.85), (sx * 0.34, -4.85, 7.18), (sx * 0.24, -5.35, 6.9), (sx * 0.2, -5.3, 7.06)]
    head.hull(skull, body)
    # brow ridges (dark) over the eyes, and the eyes (glow slits)
    for sx in (-1, 1):
        head.hull([(sx * 0.62, -3.6, 7.42), (sx * 0.3, -3.62, 7.62), (sx * 0.62, -4.25, 7.38), (sx * 0.28, -4.2, 7.55),
                   (sx * 0.5, -3.7, 7.68), (sx * 0.4, -4.1, 7.6)], dark)
        head.hull([(sx * 0.6, -3.72, 7.33), (sx * 0.6, -4.12, 7.3), (sx * 0.66, -3.9, 7.26), (sx * 0.52, -3.95, 7.37)], glow)
        # nostril ridge and cheek plate
        plate(head, (sx * 0.46, -4.3, 6.98), (0, -1, -0.1), (sx, -0.2, 0.1), (0.36, 0.7, 0.1), bone, taper=(0.7, 0.7))
        # upper teeth
        for k in range(5):
            y = -3.95 - k * 0.27
            x = sx * (0.42 - k * 0.04)
            cone(head, (x, y, 6.88), (x * 1.02, y - 0.03, 6.58 - (0.06 if k == 0 else 0)), 0.065, bone, sides=4)
        # horns: three tapered segments sweeping back, gold rings between
        hpts = [(sx * 0.36, -3.3, 7.45), (sx * 0.66, -2.75, 7.95), (sx * 0.86, -1.95, 8.2), (sx * 0.8, -1.2, 8.05)]
        hr = [0.27, 0.21, 0.13, 0.025]
        for k in range(3):
            seg(head, hpts[k], hpts[k + 1], hr[k], hr[k + 1] + 0.012, horn, sides=6)
        for k in (1, 2):
            head.lathe([(-0.06, hr[k] * 1.35), (0.06, hr[k] * 1.35)], gold, sides=6, xf=_limb_xf(hpts[k], hpts[k + 1]))
        # a small back-swept ear fin
        panel(head, [(sx * 0.55, -3.15, 7.1), (sx * 1.15, -2.7, 7.3), (sx * 0.6, -2.95, 7.4)], memb_hi, th=0.035)
    # forehead gem in a gold setting
    head.hull([(0, -3.55, 7.72), (0.2, -3.75, 7.62), (-0.2, -3.75, 7.62), (0, -4.0, 7.58), (0, -3.75, 7.78)], gold)
    head.hull([(0, -3.65, 7.8), (0.11, -3.77, 7.74), (-0.11, -3.77, 7.74), (0, -3.92, 7.7), (0, -3.77, 7.86)], glow)
    head.finish()

    jaw = B.part("jaw", (0, -3.3, 6.78), "head")
    open_ = R(x=-0.24)  # a little open at rest
    jx = T(0, -3.3, 6.78) @ open_ @ T(0, 3.3, -6.78)
    jpts = []
    for sx in (-1, 1):
        jpts += [(sx * 0.46, -3.25, 6.5), (sx * 0.5, -3.3, 6.78), (sx * 0.36, -4.6, 6.5), (sx * 0.38, -4.6, 6.74),
                 (sx * 0.2, -5.15, 6.58), (sx * 0.2, -5.1, 6.72)]
    jaw.hull([jx @ Vector(p) for p in jpts], body)
    jaw.hull([jx @ Vector(p) for p in [(sx * 0.4, -3.4, 6.48) for sx in (-1, 1)] + [(sx * 0.18, -5.0, 6.55) for sx in (-1, 1)] +
              [(sx * 0.32, -3.6, 6.42) for sx in (-1, 1)]], bone)
    for sx in (-1, 1):
        for k in range(4):
            y = -4.05 - k * 0.27
            x = sx * (0.34 - k * 0.035)
            jaw.lathe([(0, 0.055), (0.12, 0.03), (0.22, 0.01)], bone, sides=4, xf=jx @ T(x, y, 6.74))
    jaw.finish()

    # --- crown: an eclipse disc behind the head with a gold corona of rays --------------------------------------------
    cc = Vector((0, -2.75, 8.05))
    crown = B.part("crown", cc, "head")
    cx = T(*cc) @ R(x=math.pi / 2)
    crown.lathe([(-0.08, 0.0), (-0.08, 0.62), (0.08, 0.62), (0.08, 0.0)], eclipse, sides=14, xf=cx, cap=False)
    crown.lathe([(-0.1, 0.62), (-0.1, 0.72), (0.1, 0.72), (0.1, 0.62)], gold, sides=14, xf=cx, cap=False, loop=True)
    for k in range(11):
        a = math.pi * (0.06 + 0.88 * k / 10)  # rays over the top half and down the sides
        d = Vector((math.cos(a), 0, math.sin(a)))
        ln = 0.75 if k % 2 == 0 else 0.48
        cone(crown, cc + d * 0.7, cc + d * (0.7 + ln), 0.1 if k % 2 == 0 else 0.07, gold, sides=4)
    crown.finish()

    # --- legs ----------------------------------------------------------------------------------------------------------
    def leg(name, s, hip, knee, ankle, foot, front):
        lg = B.part(name, hip, "torso")
        seg(lg, hip, knee, 0.68, 0.42, body, sides=8, belly=1.22)
        seg(lg, knee, ankle, 0.4, 0.28, body, sides=7, belly=1.1)
        # gold greave on the shin, bone knee cap
        mid = lerp(knee, ankle, 0.5)
        d = (Vector(ankle) - Vector(knee)).normalized()
        plate(lg, mid + Vector((0, -0.24, 0.02)), d, (0, -1, 0.15), (0.5, (Vector(ankle) - Vector(knee)).length * 0.8, 0.12), gold)
        lg.rock(Vector(knee) + Vector((0, -0.18 if front else 0.12, 0)), (0.3, 0.26, 0.26), bone, n=12, rough=0.12)
        # thigh armour (gold) on the outside
        tm = lerp(hip, knee, 0.45)
        plate(lg, tm + Vector((s * 0.42, 0, 0)), (Vector(knee) - Vector(hip)), (s, 0, 0.1), (0.62, 0.95, 0.12), gold)
        # foot and three claws
        f = Vector(foot)
        lg.chunk((0.62, 0.78, 0.32), dark, xf=T(f.x, f.y, f.z + 0.02), bevel=0.08, taper=(0.85, 0.8))
        for k, dx in enumerate((-0.2, 0.0, 0.2)):
            base = Vector((f.x + dx, f.y - 0.33, f.z + 0.02))
            cone(lg, base, base + Vector((dx * 0.25, -0.38, -0.12)), 0.09, gold, sides=4)
        lg.finish()

    for s, side in ((1, "L"), (-1, "R")):
        leg(f"legF{side}", s, (s * 1.15, -1.5, 2.5), (s * 1.6, -1.55, 1.35), (s * 1.42, -2.0, 0.42), (s * 1.42, -2.3, 0.16), True)
        leg(f"legB{side}", s, (s * 1.15, 1.65, 2.45), (s * 1.62, 0.95, 1.5), (s * 1.48, 2.05, 0.72), (s * 1.48, 1.8, 0.16), False)

    # --- tail: five segments curling out, spikes on top, a gold sun-blade at the tip --------------------------------
    tpts = [(0, 2.55, 2.95), (0, 3.75, 2.55), (0.25, 4.85, 1.95), (0.85, 5.75, 1.35), (1.65, 6.35, 0.95), (2.45, 6.7, 0.75)]
    trad = [0.62, 0.5, 0.38, 0.28, 0.2, 0.12]
    parent = "torso"
    for i in range(5):
        p0, p1 = Vector(tpts[i]), Vector(tpts[i + 1])
        tl = B.part(f"tail{i + 1}", p0, parent)
        seg(tl, p0, p1 + (p1 - p0) * 0.1, trad[i], trad[i + 1], body if i % 2 == 0 else dark, sides=7)
        mid = (p0 + p1) / 2
        cone(tl, mid + Vector((0, 0, trad[i] * 0.8)), mid + Vector((0, 0.2, trad[i] * 0.8 + 0.42 - i * 0.05)), 0.13, gold)
        plate(tl, mid + Vector((0, 0, -trad[i] * 0.85)), p1 - p0, (0, 0, -1), (trad[i] * 1.3, (p1 - p0).length * 0.75, 0.1), bone)
        if i == 4:
            tip = p1
            dirn = (p1 - p0).normalized()
            side = dirn.cross(Vector((0, 0, 1))).normalized()
            tl.hull([tip + side * 0.45, tip - side * 0.45, tip + dirn * 1.1, tip + side * 0.18 + Vector((0, 0, 0.1)),
                     tip - side * 0.18 + Vector((0, 0, 0.1)), tip + Vector((0, 0, -0.08))], gold)
        tl.finish()
        parent = f"tail{i + 1}"

    # --- wings: an arm (shoulder, elbow, wrist), four fingers from the wrist, membranes between ------------------------
    for s, side in ((1, "L"), (-1, "R")):
        sh = Vector((s * 1.0, -1.15, 4.0))
        el = Vector((s * 2.7, -0.55, 5.7))
        wr = Vector((s * 4.3, 0.15, 6.7))
        root_back = Vector((s * 1.1, 1.55, 3.7))
        wg = B.part(f"wing{side}", sh, "torso")
        seg(wg, sh, el, 0.32, 0.24, body, sides=6)
        seg(wg, el, wr, 0.24, 0.17, body, sides=6)
        wg.rock(el, (0.27, 0.27, 0.27), gold, n=10, rough=0.1)
        cone(wg, el + Vector((0, 0, 0.15)), el + Vector((s * 0.2, -0.35, 0.75)), 0.14, gold, sides=4)
        # inner membrane: body side to elbow to wrist
        panel(wg, [sh + Vector((0, 0.25, -0.2)), el, root_back], memb)
        panel(wg, [el, wr + Vector((0, 0.35, -0.45)), root_back], memb_hi)
        wg.finish()

        tip = B.part(f"wingTip{side}", wr, f"wing{side}")
        fingers = [Vector((s * 5.7, -0.45, 7.75)), Vector((s * 6.45, 1.35, 5.4)), Vector((s * 5.55, 2.75, 3.55)),
                   Vector((s * 3.75, 3.0, 2.75))]
        for k, ft in enumerate(fingers):
            seg(tip, wr, ft, 0.15 - k * 0.02, 0.05, body if k else dark, sides=5)
            cone(tip, ft, ft + (ft - wr).normalized() * 0.42, 0.07, gold, sides=4)
        tip.rock(wr, (0.22, 0.22, 0.22), gold, n=10, rough=0.1)
        cone(tip, wr + Vector((0, -0.1, 0.12)), wr + Vector((s * 0.15, -0.55, 0.55)), 0.11, gold, sides=4)
        pts = [wr] + fingers + [root_back]
        for k in range(len(fingers)):
            a, b = pts[k + 1], pts[k + 2] if k + 2 < len(pts) - 1 else fingers[-1]
            if k == len(fingers) - 1:
                b = Vector((s * 2.2, 2.4, 3.3))
            # each panel sags inward a little at its trailing edge
            mid = (a + b) / 2
            sag = (wr - mid) * 0.12
            panel(tip, [wr, a, mid + sag], memb if k % 2 == 0 else memb_hi)
            panel(tip, [wr, mid + sag, b], memb_hi if k % 2 == 0 else memb)
        tip.finish()

    return B


def register():
    bb.BUILD["wyrm"] = build_wyrm
