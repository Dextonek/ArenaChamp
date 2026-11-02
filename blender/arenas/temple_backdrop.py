"""
Night Temple backdrop props, in the cover's sculpted-and-painted style (blender/arenas/temple_props.py): the grand
ruined gate (two variants), colonnade columns (intact with a capital, and two broken ones), the architrave that
spans two intact columns, fallen column drums, rubble heaps, a temple stair fragment, a hooded guardian statue, an
obelisk and a banner pole. Exported to public/models/arenas/temple_backdrop.glb as objects named "<Prop>__<material>"
and placed (seeded) by src/arenas/temple.ts.

The materials are the cover's (temple_props_stone / dark / light / gold), so in three.js the backdrop shares the
cover's tuned materials. Cheaper than the cover (few segments, flat boxes): it is seen from 14 m and further.

Run inside Blender (through the MCP server), one or two props per call (painting is the slow part):

    import sys, importlib
    sys.path.insert(0, r"C:\\VFXTool\\blender\\arenas")
    import temple_backdrop as tb; importlib.reload(tb)
    tb.build("GateA")   # ... see BACKDROP
    tb.export()         # builds what is missing, writes the GLB
    tb.clear()

Blender coordinates: metres, z up, props face -Y (in three.js the model's -Y becomes +Z).
"""
import importlib
import math
import os
import random
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
for p in (HERE, os.path.join(os.path.dirname(HERE), "heroes"), r"C:\projectG\xianxia\blender"):
    if p not in sys.path:
        sys.path.insert(0, p)

import bpy  # noqa: E402
from mathutils import Euler, Matrix, Vector  # noqa: E402

import dao_blender as dao  # noqa: E402
import kit  # noqa: E402
import sculpt  # noqa: E402
import skyruins_props as sp  # noqa: E402  (shape helpers: _chisel, _nick, _break, _shard, _rough, _flute, _tidy)
import temple_props as tp  # noqa: E402  (the cover's materials)

OUT = os.path.join(os.path.dirname(os.path.dirname(HERE)), "public", "models", "arenas", "temple_backdrop.glb")
PREFIX = "TempleBack"

#: The colonnade's column height (to the top of the abacus) and the architrave module length (column spacing).
COL_H = 9.0
ARCH_L = 6.2

SHARP = {"stone": 35, "dark": 35, "light": 35, "gold": 50}


def _mats(P):
    stone, dark, light, gold, _ = P.materials()
    return stone, dark, light, gold


def _block(name, centre, size, mat, rnd, cuts=0, el=(0.5, 1.3), depth=(0.88, 0.96), bevel=0.04, rotation=None):
    """A bevelled stone block, its top or edges broken by `cuts` plane cuts, worn at the edges."""
    ob = kit.box(name, centre, size, mat, bevel=bevel, segments=1, rotation=rotation)
    if cuts:
        sp._chisel(ob, rnd, cuts, el=el, depth=depth, centre=centre)
    return ob


# ---- the gate --------------------------------------------------------------------------------------------------

def gate(P, coll, seed=1, intact=1):
    """The grand ruined gate on its stepped platform (front -Y): two pylons, the one at -x * `intact` whole (16.9 m
    with its attic), the other snapped off at ~9.5 m; the lintel broken short of the snapped pylon with a gold sun
    disc on its face; a fallen block; ruined walls running out to both sides (to |x| ~ 18.5)."""
    rnd = random.Random(seed)
    stone, dark, light, gold = _mats(P)
    s = intact
    out = [kit.box("Platform", (0, 0, 0.3), (15.0, 5.0, 0.6), dark, bevel=0.06, segments=1)]
    for k in range(3):
        d = 0.9 * (3 - k)
        st = kit.box(f"Step{k}", (0, -2.5 - d / 2, 0.1 + 0.2 * k), (13.4 - k * 0.8, d, 0.2), stone, bevel=0.03, segments=1)
        sp._nick(st, rnd, 3, size=(0.15, 0.4))
        out.append(st)
    for side in (-1, 1):
        whole = side == -s
        x = side * 5.6
        out.append(kit.box(f"Plinth{side}", (x, 0, 1.05), (3.4, 3.4, 0.9), dark, bevel=0.06, segments=1))
        out.append(kit.box(f"PlinthStep{side}", (x, 0, 1.6), (3.0, 3.0, 0.2), light, bevel=0.03, segments=1))
        shaft = kit.box(f"Pylon{side}", (x, 0, 8.1), (2.6, 2.6, 13.0), stone, bevel=0.06, segments=1)
        panel = kit.box(f"Panel{side}", (x, -1.28, 7.4), (1.5, 0.12, 9.2), dark, bevel=0.03, segments=1)
        if whole:
            sp._rough(shaft, 0.03, 0.8, seed)
            out += [shaft, panel,
                    kit.box(f"Cap{side}", (x, 0, 14.95), (3.2, 3.2, 0.7), light, bevel=0.05, segments=1),
                    kit.box(f"CapGold{side}", (x, 0, 14.55), (3.26, 3.26, 0.14), gold, bevel=0.02, segments=1)]
        else:
            out.append(sp._break(shaft, [((x, 0, 9.4), (0.35 * side, -0.25, 1)), ((x + side * 0.6, 0.4, 9.9), (-0.4 * side, 0.5, 1))], light, f"Break{side}"))
            sp._rough(shaft, 0.03, 0.8, seed + 1)
            pz = 7.4 - (9.2 - 6.4) / 2
            out += [shaft, kit.box(f"Panel{side}", (x, -1.28, pz), (1.5, 0.12, 6.4), dark, bevel=0.03, segments=1)]
            bpy.data.objects.remove(panel, do_unlink=True)
            # the top that fell: a block leaning against the plinth, a smaller one on the step
            out.append(_block(f"Fallen{side}", (x + side * 2.6, -1.2, 1.25), (1.8, 1.5, 1.3), stone, rnd, cuts=4, el=(-0.4, 1.0),
                              rotation=Euler((0.25, -0.2 * side, 0.5))))
            out.append(_block(f"Fallen2{side}", (x - side * 0.6, -3.4, 0.62), (0.9, 0.8, 0.6), light, rnd, cuts=3, el=(-0.4, 1.0),
                              rotation=Euler((0.1, 0.3, 1.1))))
    # the lintel: from past the whole pylon to a jagged end short of the snapped one
    x0, x1 = -s * 7.0, s * 2.8
    lin = kit.box("Lintel", ((x0 + x1) / 2, 0, 13.7), (abs(x1 - x0), 2.4, 1.8), stone, bevel=0.05, segments=1)
    out.append(sp._break(lin, [((x1 - s * 0.3, 0, 13.7), (s, 0.25, 0.35))], light, "LinBreak"))
    out.append(lin)
    c0, c1 = -s * 7.3, s * 1.6
    cor = kit.box("Cornice", ((c0 + c1) / 2, 0, 14.85), (abs(c1 - c0), 2.8, 0.5), light, bevel=0.04, segments=1)
    out.append(sp._break(cor, [((c1 - s * 0.2, 0, 14.85), (s, -0.3, 0.2))], stone, "CorBreak"))
    out.append(cor)
    out.append(_block("Attic", (-s * 4.1, 0, 15.95), (4.8, 2.0, 1.7), stone, rnd, cuts=3, el=(0.4, 1.2), depth=(0.9, 0.97)))
    # gold sun disc on the lintel's face
    sx, sy, sz = -s * 1.4, -1.24, 13.7
    out.append(kit.torus("Sun", (sx, sy, sz), 0.62, 0.07, gold, seg=(24, 4), axis=(0, 1, 0)))
    out.append(kit.blob("SunCore", (sx, sy - 0.02, sz), (0.3, 0.08, 0.3), gold, segs=(12, 6)))
    for r in range(8):
        a = r * math.pi / 4
        out.append(kit.tube(f"Ray{r}", (sx + math.cos(a) * 0.78, sy, sz + math.sin(a) * 0.78), (sx + math.cos(a) * 1.05, sy, sz + math.sin(a) * 1.05),
                            [(0, 0.06, 0.06), (1, 0.02, 0.02)], gold, seg=4))
    # ruined walls running out to the sides, with pilaster strips, their tops broken
    for side, (cx, w, h) in ((-s, (-s * 11.6, 8.0, 5.4)), (s, (s * 12.4, 9.0, 3.4))):
        wl = _block(f"Wall{side}", (cx, 0.6, h / 2), (w, 1.6, h), stone, rnd, cuts=6, el=(0.7, 1.35), depth=(0.82, 0.95))
        out.append(wl)
        for k in range(3):
            px = cx + (k - 1) * w / 3
            ph = h * (0.55 + rnd.random() * 0.35)
            out.append(_block(f"Pil{side}{k}", (px, -0.3, ph / 2), (0.6, 0.5, ph), light, rnd, cuts=2, el=(0.7, 1.3)))
        out.append(kit.box(f"WallFoot{side}", (cx, 0.6, 0.2), (w + 0.4, 2.0, 0.4), dark, bevel=0.04, segments=1))
    ex = s * 17.6
    out.append(_block("EndPier", (ex, 0.6, 3.9), (2.0, 1.8, 7.8), stone, rnd, cuts=4, el=(0.6, 1.3)))
    out.append(kit.box("EndPierFoot", (ex, 0.6, 0.3), (2.4, 2.2, 0.6), dark, bevel=0.04, segments=1))
    for k in range(5):
        out.append(sp._shard(f"Shard{k}", (rnd.uniform(-8, 8), rnd.uniform(-5.5, -3.8), 0.0), 0.7, 0.5, 0.35 + rnd.random() * 0.2, rnd.random() * 6, 0.25, stone, rnd))
    return out


# ---- the colonnade ---------------------------------------------------------------------------------------------

def column(P, coll, seed=3, H=COL_H, broken=None):
    """A colonnade column (cheap: 24 sides, 12 shallow flutes): square plinth, torus base, shaft, gold necking,
    echinus and abacus; `H` to the top of the abacus. `broken` = [(point, normal)] snaps the shaft (no capital)
    and drops a few fragments at its foot."""
    rnd = random.Random(seed)
    stone, dark, light, gold = _mats(P)
    out = [kit.box("Plinth", (0, 0, 0.25), (2.2, 2.2, 0.5), dark, bevel=0.04, segments=1),
           kit.torus("Torus", (0, 0, 0.62), 0.86, 0.13, light, seg=(24, 5))]
    top = H - 1.15
    shaft = kit.lathe("Shaft", [(0.0, 0.6), (0.86, 0.6), (0.84, 2.4), (0.79, top * 0.6), (0.73, top), (0.0, top)], light, seg=24)
    sp._flute(shaft, 12, 0.05, 0.8, top - 0.1, lambda z: 0.86 - 0.13 * (z - 0.6) / (top - 0.6))
    sp._rough(shaft, 0.02, 1.4, seed)
    if broken:
        out.append(sp._break(shaft, broken, stone, "Break"))
        out.append(shaft)
        for k in range(3):
            a = rnd.random() * 6.28
            out.append(sp._shard(f"Frag{k}", (math.cos(a) * 1.5, math.sin(a) * 1.5, 0.0), 0.55, 0.45, 0.3 + rnd.random() * 0.2, a, 0.3, light, rnd))
        return out
    out += [shaft,
            kit.torus("Necking", (0, 0, top + 0.03), 0.74, 0.05, gold, seg=(24, 4)),
            kit.lathe("Echinus", [(0.0, top), (0.74, top), (1.0, H - 0.75), (1.06, H - 0.62), (0.0, H - 0.62)], stone, seg=16),
            kit.box("Abacus", (0, 0, H - 0.31), (2.3, 2.3, 0.62), light, bevel=0.04, segments=1)]
    return out


def architrave(P, coll, seed=4, L=ARCH_L):
    """The beam over two intact columns (`L` between their centres, along x), from z 0 (the abacus top) to 1.35:
    a stone beam with a thin gold fascia on its front and a moulded cornice, the ends worn."""
    rnd = random.Random(seed)
    stone, dark, light, gold = _mats(P)
    beam = _block("Beam", (0, 0, 0.5), (L + 1.9, 1.7, 1.0), stone, rnd, cuts=3, el=(-0.3, 0.6), depth=(0.95, 0.99))
    return [beam,
            kit.box("Fascia", (0, -0.86, 0.32), (L + 1.4, 0.05, 0.12), gold),
            _block("Cornice", (0, 0, 1.18), (L + 2.1, 2.0, 0.35), light, rnd, cuts=3, el=(-0.2, 0.8), depth=(0.95, 0.99))]


# ---- low debris: drums, rubble, stairs -------------------------------------------------------------------------

def drums(P, coll, seed=5):
    """Fallen column drums lying in a line (one cracked open), a capital block on its side and fragments. < 1.4 m."""
    rnd = random.Random(seed)
    stone, dark, light, gold = _mats(P)
    out = []
    for k in range(3):
        d = sp._drum(f"D{k}", -0.5, 0.5, 0.78, 0.78, light, rnd, seed + k, seg=20, rows=2, flutes=10, chips=2)
        m = Matrix.Translation((k * 1.1 + (0.2 if k == 2 else 0), 0.15 * k, 0.74)) @ Matrix.Rotation(0.18 * k, 4, "Z") @ Matrix.Rotation(1.57, 4, "Y")
        if k == 1:
            brk = sp._break(d, [((0, 0, 0.25), (0.4, 0.3, 1))], stone, "Brk")
            brk.data.transform(m)
            out.append(brk)
        d.data.transform(m)
        out.append(d)
    out.append(_block("Abacus", (-1.6, 0.6, 0.3), (1.9, 1.9, 0.6), light, rnd, cuts=3, el=(-0.2, 0.7), rotation=Euler((0.12, 0.05, 0.4))))
    for k in range(4):
        out.append(sp._shard(f"S{k}", (rnd.random() * 3.5 - 1.2, 1.4 * (1 if k % 2 else -1), 0.0), 0.5, 0.4, 0.25, rnd.random() * 6, 0.25, stone, rnd))
    return out


def rubble(P, coll, seed=6, n=7, R=1.6, h=1.1):
    """A heap of tumbled, broken blocks (stone and dark), `R` across and up to `h` high."""
    rnd = random.Random(seed)
    stone, dark, light, gold = _mats(P)
    out = []
    for k in range(n):
        a, d = rnd.random() * 6.28, R * (0.15 + 0.6 * rnd.random()) * (0.3 if k == 0 else 1)
        w, dd, hh = rnd.uniform(0.6, 1.1) * R / 1.6, rnd.uniform(0.5, 0.9) * R / 1.6, rnd.uniform(0.4, 0.7) * h * (1.4 if k == 0 else 1)
        z = hh / 2 + (h * 0.35 if 0 < k < 3 else 0)
        out.append(_block(f"B{k}", (math.cos(a) * d, math.sin(a) * d, z), (w, dd, hh), (stone, dark, stone, light)[k % 4], rnd, cuts=3,
                          el=(-0.5, 1.2), rotation=Euler((rnd.uniform(-0.3, 0.3), rnd.uniform(-0.3, 0.3), rnd.random() * 3))))
    for k in range(3):
        a = rnd.random() * 6.28
        out.append(sp._shard(f"S{k}", (math.cos(a) * R * 0.9, math.sin(a) * R * 0.9, 0.0), 0.4, 0.35, 0.2, a, 0.3, stone, rnd))
    return out


def stairs(P, coll, seed=7):
    """A temple stair fragment (rising toward +Y, away from the ring): five steps 6 m wide between two cheek walls,
    the top step and one cheek broken off. 1.6 m high."""
    rnd = random.Random(seed)
    stone, dark, light, gold = _mats(P)
    out = []
    for k in range(5):
        y0 = -1.5 + k * 0.6
        out.append(_block(f"Step{k}", (0, y0 + (3.0 - k * 0.6) / 2, 0.125 + k * 0.25), (6.0, 3.0 - k * 0.6, 0.25), stone if k % 2 else light, rnd,
                          cuts=2 if k == 4 else 1, el=(-0.2, 0.6), depth=(0.9, 0.98), bevel=0.03))
    out.append(_block("CheekL", (-3.35, 0.0, 0.8), (0.7, 3.0, 1.6), dark, rnd, cuts=3, el=(0.6, 1.3)))
    out.append(_block("CheekR", (3.35, -0.4, 0.5), (0.7, 2.2, 1.0), dark, rnd, cuts=4, el=(0.3, 1.3)))
    out.append(kit.box("CheekGold", (-3.35, -1.52, 1.1), (0.5, 0.05, 0.08), gold))
    for k in range(3):
        out.append(sp._shard(f"S{k}", (rnd.uniform(-2.5, 2.5), rnd.uniform(-2.6, -1.8), 0.0), 0.5, 0.4, 0.25, rnd.random() * 6, 0.25, stone, rnd))
    return out


# ---- tall landmarks: statue, obelisk, banner pole --------------------------------------------------------------

def statue(P, coll, seed=8):
    """A hooded guardian (front -Y) on a pedestal, hands folded on the pommel of a long sword planted before it;
    the hood's edge and one shoulder chipped. About 8.6 m."""
    rnd = random.Random(seed)
    stone, dark, light, gold = _mats(P)
    z0 = 1.9
    out = [kit.box("Ped", (0, 0, 0.8), (3.0, 3.0, 1.6), dark, bevel=0.06, segments=1),
           kit.box("PedCap", (0, 0, 1.75), (3.3, 3.3, 0.3), light, bevel=0.04, segments=1),
           kit.box("PedGold", (0, -1.66, 1.2), (2.2, 0.05, 0.12), gold)]
    # a robe like a bell (wide hem, narrow waist, broad shoulders), the hood, arms bent forward to the hands
    robe = kit.lathe("Robe", [(0.0, z0), (1.25, z0), (1.22, z0 + 0.35), (1.02, z0 + 1.8), (0.86, z0 + 3.3), (0.98, z0 + 4.2),
                              (0.82, z0 + 4.7), (0.0, z0 + 4.75)], stone, seg=24)
    robe.data.transform(Matrix.Diagonal((1.0, 0.78, 1.0, 1.0)))
    body = [robe,
            kit.blob("Shoulders", (0, 0.05, z0 + 4.45), (1.12, 0.66, 0.4), stone, segs=(16, 8)),
            kit.blob("Hood", (0, 0.1, z0 + 5.25), (0.6, 0.62, 0.72), stone, segs=(14, 10)),
            kit.blob("HoodPeak", (0, 0.3, z0 + 5.85), (0.3, 0.32, 0.36), stone, segs=(10, 8)),
            kit.blob("Hands", (0, -0.86, z0 + 3.3), (0.36, 0.26, 0.26), stone, segs=(10, 8))]
    for side in (-1, 1):
        body.append(kit.chain(f"Arm{side}", [(side * 0.95, 0.0, z0 + 4.3), (side * 0.92, -0.42, z0 + 3.55), (side * 0.3, -0.82, z0 + 3.3)],
                              [0.3, 0.27, 0.22], stone, seg=10))
    fig = sculpt.fuse(body, "Figure", voxel=0.08, smooth=4, target=2600)
    sculpt.folds(fig, below=z0 + 3.1, n=13, amp=0.035, seed=seed)
    sp._chisel(fig, rnd, 2, el=(0.4, 1.0), depth=(0.95, 0.98), centre=(0, 0, z0 + 3.0))
    out.append(fig)
    # the face: a dark hollow under the hood; a small gold sun on the chest
    out.append(kit.blob("Face", (0, -0.4, z0 + 5.15), (0.34, 0.2, 0.42), dark, segs=(10, 8)))
    out.append(kit.torus("Medal", (0, -0.7, z0 + 4.1), 0.16, 0.035, gold, seg=(16, 4), axis=(0, 1, 0)))
    # the sword: blade down to the pedestal, gold guard under the hands and pommel above them
    out.append(kit.box("Blade", (0, -1.0, z0 + 1.45), (0.3, 0.1, 2.9), light, bevel=0.02, segments=1))
    out.append(kit.box("Guard", (0, -1.0, z0 + 2.98), (0.9, 0.16, 0.12), gold, bevel=0.02, segments=1))
    out.append(kit.blob("Pommel", (0, -0.98, z0 + 3.62), (0.12, 0.12, 0.12), gold, segs=(8, 6)))
    return out


def obelisk(P, coll, seed=9):
    """A tall four-sided obelisk on a two-step base with a gold pyramidion; its edges chipped. 10.8 m."""
    rnd = random.Random(seed)
    stone, dark, light, gold = _mats(P)
    out = [kit.box("Base0", (0, 0, 0.3), (2.9, 2.9, 0.6), dark, bevel=0.05, segments=1),
           kit.box("Base1", (0, 0, 0.85), (2.2, 2.2, 0.5), light, bevel=0.04, segments=1)]
    sh = kit.lathe("Shaft", [(0.0, 1.1), (1.0, 1.1), (0.86, 5.0), (0.68, 9.7), (0.0, 9.7)], stone, seg=4, smooth=False)
    sh.data.transform(Matrix.Rotation(math.pi / 4, 4, "Z"))
    sp._nick(sh, rnd, 5, size=(0.06, 0.16))
    out.append(sh)
    py = kit.lathe("Pyramidion", [(0.0, 9.7), (0.68, 9.7), (0.0, 10.8)], gold, seg=4, smooth=False)
    py.data.transform(Matrix.Rotation(math.pi / 4, 4, "Z"))
    out.append(py)
    # carved bands: dark inset strips on the faces
    for k, z in enumerate((3.0, 6.2)):
        w = 1.25 - 0.22 * k
        for a in range(4):
            r = Euler((0, 0, a * math.pi / 2))
            c = r.to_matrix() @ Vector((0, -w / 2 - 0.01, z))
            out.append(kit.box(f"Band{k}{a}", tuple(c), (w * 0.8, 0.04, 0.16), dark, rotation=r))
    return out


def banner_pole(P, coll, seed=10):
    """A banner pole: a footing, the pole, a crossbar at 7.6 m (the cloth hangs from it, drawn in three.js) and a
    gold finial and bar ends. 8.4 m."""
    stone, dark, light, gold = _mats(P)
    return [kit.box("Foot", (0, 0, 0.25), (1.0, 1.0, 0.5), dark, bevel=0.04, segments=1),
            kit.box("Foot2", (0, 0, 0.6), (0.6, 0.6, 0.2), light, bevel=0.03, segments=1),
            kit.tube("Pole", (0, 0, 0.6), (0, 0, 8.1), [(0, 0.11, 0.11), (1, 0.08, 0.08)], dark, seg=8),
            kit.tube("Bar", (-1.15, -0.12, 7.6), (1.15, -0.12, 7.6), [(0, 0.06, 0.06), (1, 0.06, 0.06)], dark, seg=6),
            kit.blob("EndL", (-1.2, -0.12, 7.6), (0.1, 0.1, 0.1), gold, segs=(8, 6)),
            kit.blob("EndR", (1.2, -0.12, 7.6), (0.1, 0.1, 0.1), gold, segs=(8, 6)),
            kit.lathe("Finial", [(0.0, 8.05), (0.16, 8.15), (0.2, 8.3), (0.0, 8.55)], gold, seg=8)]


BACKDROP = {
    "GateA": (gate, {"seed": 11, "intact": 1}),
    "GateB": (gate, {"seed": 13, "intact": -1}),
    "ColTall": (column, {"seed": 15}),
    "ColBrokenA": (column, {"seed": 17, "broken": [((0, 0, 5.6), (0.45, 0.2, 1)), ((0.3, -0.2, 6.0), (-0.5, 0.35, 1))]}),
    "ColBrokenB": (column, {"seed": 19, "broken": [((0, 0, 3.1), (-0.4, -0.5, 1)), ((-0.25, 0.25, 3.5), (0.5, -0.3, 1))]}),
    "Architrave": (architrave, {"seed": 21}),
    "Drums": (drums, {"seed": 23}),
    "RubbleA": (rubble, {"seed": 25, "n": 7, "R": 1.6, "h": 1.1}),
    "RubbleB": (rubble, {"seed": 27, "n": 5, "R": 1.1, "h": 0.7}),
    "Stairs": (stairs, {"seed": 29}),
    "Statue": (statue, {"seed": 31}),
    "Obelisk": (obelisk, {"seed": 33}),
    "BannerPole": (banner_pole, {"seed": 35}),
}


def _merge(name, parts):
    """Joins a prop's parts by material: objects named "<Prop>__<material>"."""
    by = {}
    for ob in parts:
        if ob.name not in bpy.data.objects or ob.type != "MESH" or not len(ob.data.polygons):
            if ob.name in bpy.data.objects:
                bpy.data.objects.remove(ob, do_unlink=True)
            continue
        by.setdefault(ob.data.materials[0].name, []).append(ob)
    out = []
    for mname, obs in by.items():
        short = mname.replace("temple_props_", "")
        ob = kit.join(f"{name}__{short}", obs) if len(obs) > 1 else obs[0]
        ob.name = f"{name}__{short}"
        sp._tidy(ob, SHARP.get(short, 40))
        out.append(ob)
    return out


def build(name):
    """Builds one backdrop prop into the collection "TempleBack <name>" (emptied first). Returns its stats."""
    importlib.reload(sculpt)
    dao.setup_scene()
    if bpy.context.object and bpy.context.object.mode != "OBJECT":
        bpy.ops.object.mode_set(mode="OBJECT")
    fn, kw = BACKDROP[name]
    kit.clear(f"{PREFIX} {name}")
    coll = kit.collection(f"{PREFIX} {name}")
    objs = _merge(name, fn(tp.Props(), coll, **kw))
    top = max((ob.matrix_world @ v.co).z for ob in objs for v in ob.data.vertices)
    sculpt.paint(coll, height=max(top, 1.0), ao_dist=0.25 if top < 6 else 0.8)
    st = kit.stats(coll)
    st.update(sp.footprint(coll))
    return st


def export():
    colls = []
    for name in BACKDROP:
        c = bpy.data.collections.get(f"{PREFIX} {name}")
        if c is None or not c.objects:
            build(name)
            c = bpy.data.collections[f"{PREFIX} {name}"]
        colls.append(c)
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    if bpy.context.object and bpy.context.object.mode != "OBJECT":
        bpy.ops.object.mode_set(mode="OBJECT")
    bpy.ops.object.select_all(action="DESELECT")
    objs = [o for c in colls for o in c.objects]
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    dao._export(
        OUT, export_format="GLB", use_selection=True, export_apply=True, export_yup=True, export_animations=False,
        export_skins=False, export_morph=False, export_cameras=False, export_lights=False,
        export_draco_mesh_compression_enable=False, export_meshopt_compression_enable=True,
        export_vertex_color="ACTIVE", export_all_vertex_colors=False,
    )
    tris = {c.name: kit.stats(c)["triangles"] for c in colls}
    return {"triangles": tris, "kb": round(os.path.getsize(OUT) / 1024), "path": OUT}


def clear():
    """Deletes the backdrop collections (after exporting: keep the shared scene light)."""
    for name in BACKDROP:
        kit.clear(f"{PREFIX} {name}")
    kit.purge()
