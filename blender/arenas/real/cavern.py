"""Crystal Cavern: the floor of a great cave that was once a mine. Built in the heroes' way (kit.py, STYLE.md): clean
turned and boxed forms in a few plain materials, gold on the edges, lantern light and a few crystals as the only glow.
Its own colour beside the shared palette is amethyst.

Cover (point-symmetric about (0, 7)): a mine cart loaded with crystals in the middle (low), two stacks of pit timber
guarding the starts (low), two tall clusters of amethyst prisms flanking the middle (tall), two rows of smooth pale
stalagmites on the wings (low), two winch frames with a hanging ore bucket and a lantern in the far corners (tall).

Round it: the cart's track leaves the ring both ways over a short trestle into a timbered tunnel mouth (|x| > 12),
great stalagmites and crystals stand along both sides, low crystals and stalagmites lie scattered on the cave floor,
and walls of dark rock prisms close it in far out (beyond 26 m toward both cameras: nothing tall stands there nearer).
There is no roof: the cameras look down from above. Run:
    blender --background --factory-startup --python blender/arenas/real/cavern.py [-- <check picture path> [--draft]]
With `--draft` the files go beside the check pictures and not into the game: every build of the game's files reloads
every open tab of the dev server.
"""
import math
import os
import random
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from mathutils import Matrix, Vector  # noqa: E402

import kit  # noqa: E402
from kit import Arena, S, pillar, twin, wall  # noqa: E402

ARGS = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
if "--draft" in ARGS:
    ARGS.remove("--draft")
    kit.REPO = os.path.dirname(os.path.abspath(ARGS[0]))
    os.makedirs(os.path.join(kit.REPO, "public", "models", "arenas"), exist_ok=True)

PI = math.pi
A = Arena("cavern")
V = Vector

# the heroes' materials (STYLE.md) and the cavern's own: amethyst, and a lit amethyst for a few prisms. Keys must not
# contain one another: src/arenas/real.ts tunes a material by a part of its name.
A.mat("wood", "#4a3220", rough=0.7)
A.mat("plank", "#6b4226", rough=0.75)
A.mat("lacquer", "#1d1b21", rough=0.45)
A.mat("iron", "#3c3f47", rough=0.42, metal=0.75)
A.mat("gold", "#c9a24a", rough=0.32, metal=0.85)
A.mat("rope", "#b89a5a", rough=0.9)
A.mat("stone", "#2c3140", rough=0.85)
A.mat("rock", "#222534", rough=0.85)
A.mat("cream", "#d8cfb4", rough=0.8)
A.mat("amethyst", "#6a4a9a", rough=0.3, metal=0.3)
A.mat("shine", "#8466c0", rough=0.3, metal=0.3, emit="#7a4ad8", strength=0.5)
A.mat("lamp", "#ffcf80", rough=0.4, emit="#ffb03a", strength=1.0)

# the cave floor outside the ring lies this far below it (src/arenas/cavern.ts builds it)
OUT = -0.6
# the track crosses the ring through its centre along this direction (x, z); src/arenas/cavern.ts draws it on the floor
TRACK = V((1.0, 0.25)).normalized()
GAUGE = 0.72


# ---- shapes -------------------------------------------------------------------------------------------------------
def prism(f, key, a, b, r, tip=None):
    """A six-sided crystal from `a` to its point at `b`: a little narrower at the foot, a pointed end."""
    a, b = V(a), V(b)
    t = min(0.45, (tip if tip is not None else 1.5 * r) / (b - a).length)
    f.turned(key, a, b, [(0, r * 0.84), (1 - t, r), (1, r * 0.05)], seg=6)


def leaning(f, key, base, ln, lean, turn, r):
    """A prism of length `ln` from `base`, leaning `lean` from upright toward the direction `turn`. Returns its middle."""
    base = V(base)
    top = base + V((math.cos(turn), math.sin(turn), 0)) * (ln * math.sin(lean)) + V((0, 0, ln * math.cos(lean)))
    prism(f, key, base, top, r)
    return (base + top) / 2


def taper(f, key, z0, z1, bot, top, cx=0.0, cy=0.0):
    """A box that widens or narrows from `bot` (x, y) at z0 to `top` at z1."""
    bm = f.bm(key)
    rows = [[bm.verts.new((cx + sx * w[0] / 2, cy + sy * w[1] / 2, z)) for sx, sy in ((-1, -1), (1, -1), (1, 1), (-1, 1))] for z, w in ((z0, bot), (z1, top))]
    b, t = rows
    bm.faces.new(list(reversed(b)))
    bm.faces.new(t)
    for k in range(4):
        bm.faces.new((b[k], b[(k + 1) % 4], t[(k + 1) % 4], t[k]))


def stalagmite(f, x, y, r, h, key="stone", z0=0.0, seg=20):
    """A smooth stalagmite: one flowing taper from a wide foot to a blunt point."""
    f.turned(key, (x, y, z0), (x, y, h), [(0, 1.18 * r), (0.1, 0.98 * r), (0.3, 0.72 * r), (0.55, 0.46 * r), (0.8, 0.24 * r), (0.95, 0.09 * r), (1, 0.03 * r)], seg=seg)


def lantern(f, g, c, r=0.11, h=0.34):
    """A square lantern hanging with its top ring at `c`: gold base and roof, four dark posts, the light inside. Its
    boxes go to `f`, its turned parts to `g` (see `built`). Returns the light's middle."""
    c = V(c)
    top, bot = c.z - 0.06, c.z - 0.06 - h
    f.box("gold", (c.x, c.y, bot + 0.02), (2.4 * r, 2.4 * r, 0.04))
    f.box("lamp", (c.x, c.y, (top + bot) / 2), (1.5 * r, 1.5 * r, h - 0.08))
    for sx in (1, -1):
        for sy in (1, -1):
            g.tube("lacquer", [(c.x + sx * r, c.y + sy * r, bot + 0.03), (c.x + sx * r, c.y + sy * r, top - 0.02)], 0.014, seg=5)
    g.turned("gold", (c.x, c.y, top - 0.03), (c.x, c.y, top + 0.1), [(0, 1.75 * r), (0.2, 1.8 * r), (0.75, 0.6 * r), (1, 0.02)], seg=4)
    g.torus("gold", (c.x, c.y, c.z), 0.045, 0.01, normal=(1, 0, 0), seg=(10, 4))
    return V((c.x, c.y, (top + bot) / 2))


PARTS = {}


def built(key, boxed=None, turned=None, bevel=0.01):
    """A prop of two templates: its boxed parts, with a small bevel so their edges catch the light, and its turned parts
    (tubes, rings, prisms), which keep their own edges (a bevel there only costs triangles). `place` puts both."""
    PARTS[key] = []
    for tag, fig, bv in (("_b", boxed, bevel), ("_t", turned, 0.0)):
        if fig is not None and fig.bms:
            A.built(key + tag, fig, bevel=bv)
            PARTS[key].append(key + tag)


# ---- props, at life size, standing on z = 0 -----------------------------------------------------------------------
def cluster(key, h, foot=True, shine=2, bevel=0.008):
    """A cluster of amethyst prisms: a tall one in the middle, five leaning out round it in falling lengths, five short
    ones between them, on a low foot of stone. Prism `shine` of the five is the lit one; returns its middle."""
    f = A.fig()
    r0 = 0.075 * h
    if foot:
        f.turned("stone", (0, 0, 0), (0, 0, 0.075 * h), [(0, 0.23 * h), (0.55, 0.21 * h), (1, 0.15 * h)], seg=7)
    prism(f, "amethyst", (0, 0, 0.02), (0.02 * h, -0.012 * h, h), r0)
    lit = V((0, 0, h / 2))
    for k in range(5):
        a = 0.5 + k * 2 * PI / 5
        ln, lean, r = h * (0.7, 0.5, 0.62, 0.42, 0.56)[k], (0.3, 0.5, 0.4, 0.6, 0.45)[k], r0 * (0.62, 0.5, 0.56, 0.45, 0.5)[k]
        mid = leaning(f, "shine" if k == shine else "amethyst", V((math.cos(a), math.sin(a), 0)) * (0.55 * r0) + V((0, 0, 0.03 * h)), ln, lean, a, r)
        if k == shine:
            lit = mid
        b = a + PI / 5
        leaning(f, "amethyst", V((math.cos(b), math.sin(b), 0)) * (1.25 * r0) + V((0, 0, 0.03 * h)), 0.2 * h, 0.85, b, 0.32 * r0)
    A.built(key, f, bevel=bevel)
    return lit


def stalagmites():
    """A row of three smooth stalagmites of pale flowstone along y, standing clear of one another on one low foot, a
    few small prisms at their feet."""
    f = A.fig()
    f.tube("cream", [(0, -0.66, 0), (0, 0, 0), (0, 0.66, 0)], [0.3, 0.35, 0.3], seg=24, squash=((0, 0, 1), 0.55))
    for x, y, r, h in ((0.02, -0.62, 0.28, 0.84), (-0.02, 0.0, 0.31, 1.07), (0.02, 0.62, 0.27, 0.66)):
        stalagmite(f, x, y, r, h, key="cream", seg=24)
    for x, y, ln, lean, turn, r in ((0.27, 0.3, 0.34, 0.45, 0.2, 0.06), (0.31, 0.16, 0.22, 0.8, -0.5, 0.05), (-0.28, -0.3, 0.3, 0.5, 2.9, 0.06), (-0.31, -0.16, 0.19, 0.85, 3.6, 0.05)):
        leaning(f, "amethyst", (x, y, 0.0), ln, lean, turn, r)
    return A.built("stalagmites", f)


def cart():
    """A mine cart, its length along y: a plank tub that widens upward, two iron bands, a gold rim, four iron wheels with
    gold hubs, loaded with amethyst. Returns the middle of its lit prism."""
    f, g = A.fig(), A.fig()
    for sx in (1, -1):
        for y in (-0.36, 0.36):
            g.turned("iron", (sx * 0.25, y, 0.18), (sx * 0.34, y, 0.18), [(0, 0.2), (0.3, 0.2), (0.3, 0.165), (1, 0.165)], seg=18)
            g.ellipsoid("gold", (sx * 0.345, y, 0.18), (0.02, 0.055, 0.055), seg=(10, 6))
    for y in (-0.36, 0.36):
        g.tube("iron", [(-0.34, y, 0.18), (0.34, y, 0.18)], 0.03, seg=8)
    f.box("wood", (0, 0, 0.3), (0.5, 1.3, 0.1))
    for sy in (1, -1):
        g.tube("iron", [(0, sy * 0.63, 0.3), (0, sy * 0.73, 0.3)], 0.045, seg=10)
        g.ellipsoid("gold", (0, sy * 0.735, 0.3), (0.055, 0.02, 0.055), seg=(10, 6))
    z0, z1 = 0.35, 0.8
    taper(f, "plank", z0, z1, (0.6, 1.0), (0.82, 1.24))
    for y in (-0.31, 0.31):
        taper(f, "iron", z0 - 0.005, z1 + 0.005, (0.63, 0.075), (0.85, 0.075), cy=y)
    taper(f, "gold", z1 - 0.012, z1 + 0.02, (0.85, 1.27), (0.86, 1.28))
    f.box("lacquer", (0, 0, z1 + 0.02), (0.75, 1.17, 0.03))
    lit = V((0, 0, 1.0))
    heap = ((0.0, 0.02, 0.3, 0.08, 0.0, 0.085), (0.16, -0.26, 0.24, 0.45, -0.9, 0.07), (-0.15, 0.3, 0.26, 0.4, 2.2, 0.07), (-0.17, -0.2, 0.2, 0.6, 3.6, 0.06),
            (0.18, 0.22, 0.2, 0.6, 0.6, 0.06), (0.02, -0.44, 0.18, 0.7, -1.6, 0.055), (0.0, 0.47, 0.18, 0.7, 1.55, 0.055))
    for k, (x, y, ln, lean, turn, r) in enumerate(heap):
        mid = leaning(g, "shine" if k == 0 else "amethyst", (x, y, z1 + 0.02), ln, lean, turn, r)
        if k == 0:
            lit = mid
    built("cart", f, g, bevel=0.008)
    return lit


def timber(ln=2.74):
    """A stack of squared pit timber along y: four courses of three beams with thin sticks between the courses, on two
    bearers, two gold straps round it, a pickaxe and a coil of rope on top."""
    f, g = A.fig(), A.fig()
    w, h, gap = 0.2, 0.17, 0.028
    for y in (-0.85, 0.85):
        f.box("wood", (0, y, 0.04), (0.7, 0.14, 0.08))
    for row in range(4):
        z = 0.08 + row * (h + gap)
        for col in range(3):
            off = 0.06 * ((row * 2 + col) % 3 - 1)
            f.box("plank", ((col - 1) * (w + 0.012), off, z + h / 2), (w, ln - 0.16, h))
        if row:
            for y in (-0.95, 0.0, 0.95):
                f.box("wood", (0, y, z - gap / 2), (3 * w + 0.07, 0.07, gap))
    top = 0.08 + 4 * h + 3 * gap
    for y in (-0.6, 0.6):
        f.box("gold", (0, y, (0.08 + top) / 2), (3 * w + 0.06, 0.055, top - 0.08 + 0.03))
    # the pickaxe: a handle laid along the stack, an iron head across it
    g.tube("wood", [(0.1, -0.42, top + 0.03), (0.06, 0.4, top + 0.03)], 0.024, seg=8)
    g.tube("iron", [(-0.22, -0.42, top + 0.035), (-0.07, -0.44, top + 0.075), (0.1, -0.45, top + 0.085), (0.27, -0.44, top + 0.075), (0.42, -0.42, top + 0.035)],
           [0.008, 0.026, 0.034, 0.026, 0.008], seg=6)
    for k, r in enumerate((0.22, 0.2, 0.18)):
        g.torus("rope", (-0.04, 0.9, top + 0.04 + 0.068 * k), r, 0.04, seg=(18, 5))
    built("timber", f, g, bevel=0.01)


def winch(span=0.86, h=2.42):
    """A winch frame along y: two posts on sills and a plank base under a beam with a gold line, braces, a rope drum with cranks between
    the posts, the rope up over a pulley and down to an ore bucket, a lantern hanging from one end of the beam. Returns
    the lantern's light."""
    f, g = A.fig(), A.fig()
    for sy in (1, -1):
        f.box("wood", (0, sy * span, 0.07), (0.86, 0.2, 0.14))
        f.box("wood", (0, sy * span, h / 2), (0.17, 0.17, h))
        for sx in (1, -1):
            f.box("wood", (sx * 0.2, sy * span, 0.36), (0.09, 0.1, 0.6), rot=Matrix.Rotation(-sx * 0.62, 4, "Y"))
        # a brace up to the beam
        f.box("wood", (0, sy * (span - 0.27), h - 0.3), (0.1, 0.1, 0.78), rot=Matrix.Rotation(sy * 0.78, 4, "X"))
    f.box("wood", (0, 0, h + 0.09), (0.2, 2 * span + 0.72, 0.18))
    f.box("gold", (0, 0, h + 0.183), (0.05, 2 * span + 0.66, 0.012))
    for sy in (1, -1):
        f.box("gold", (0, sy * (span + 0.345), h + 0.09), (0.215, 0.035, 0.195))
    f.box("plank", (0, 0, 0.035), (0.6, 2 * span - 0.2, 0.07))
    # the drum, its rope and its cranks
    z = 0.78
    g.turned("plank", (0, -span + 0.14, z), (0, span - 0.14, z), [(0, 0.24), (0.05, 0.24), (0.05, 0.15), (0.95, 0.15), (0.95, 0.24), (1, 0.24)], seg=20)
    for sy in (1, -1):
        g.torus("gold", (0, sy * (span - 0.14 - 0.035), z), 0.24, 0.014, normal=(0, 1, 0), seg=(20, 4))
    for k in range(9):
        g.torus("rope", (0, -0.36 + 0.09 * k, z), 0.175, 0.045, normal=(0, 1, 0), seg=(16, 5))
    g.tube("iron", [(0, -span - 0.16, z), (0, span + 0.16, z)], 0.028, seg=8)
    for sy in (1, -1):
        g.tube("iron", [(0, sy * (span + 0.15), z), (0, sy * (span + 0.15), z + sy * 0.27)], 0.02, seg=6)
        g.tube("wood", [(0, sy * (span + 0.14), z + sy * 0.27), (0, sy * (span + 0.34), z + sy * 0.27)], 0.028, seg=8)
    # the pulley under the beam, the rope and the bucket
    pz = h - 0.2
    g.torus("iron", (0, 0, pz), 0.12, 0.03, normal=(0, 1, 0), seg=(16, 5))
    g.turned("gold", (0, -0.03, pz), (0, 0.03, pz), [(0, 0.05), (1, 0.05)], seg=10)
    g.tube("iron", [(0, 0, pz + 0.05), (0, 0, h)], 0.018, seg=6)
    g.tube("rope", [(0.12, 0.1, z + 0.17), (0.125, 0.02, pz)], 0.024, seg=6)
    bz = 1.22
    g.tube("rope", [(-0.125, 0, pz), (-0.125, 0, bz + 0.5)], 0.024, seg=6)
    g.torus("iron", (-0.125, 0, bz + 0.5), 0.035, 0.012, normal=(0, 1, 0), seg=(8, 4))
    g.turned("plank", (-0.125, 0, bz), (-0.125, 0, bz + 0.34), [(0, 0.15), (1, 0.2)], seg=18)
    for t, r in ((0.12, 0.158), (0.88, 0.196)):
        g.torus("gold", (-0.125, 0, bz + 0.34 * t), r, 0.013, seg=(18, 4))
    g.turned("lacquer", (-0.125, 0, bz + 0.33), (-0.125, 0, bz + 0.345), [(0, 0.185), (1, 0.185)], seg=18)
    g.tube("iron", [(-0.125 + 0.19 * math.cos(PI * i / 8), 0, bz + 0.34 + 0.17 * math.sin(PI * i / 8)) for i in range(9)], 0.012, seg=5)
    for x, y, ln, lean, turn in ((0.0, 0.0, 0.2, 0.1, 0.0), (0.07, 0.05, 0.15, 0.6, 0.7), (-0.07, -0.04, 0.15, 0.6, 3.6), (0.02, -0.08, 0.13, 0.7, -1.4)):
        leaning(g, "amethyst", (-0.125 + x, y, bz + 0.34), ln, lean, turn, 0.045)
    # the lantern, hanging from the beam's end past one post
    light = lantern(f, g, V((0, span + 0.27, h - 0.045)), r=0.115, h=0.34)
    built("winch", f, g, bevel=0.01)
    return light


def track(ln=4.0):
    """A length of track along y on a low trestle, the rails' feet at z = 0: sleepers, two iron rails, two stringers and
    three bents down to the cave floor."""
    f = A.fig()
    n = 8
    for k in range(n):
        f.box("wood", (0, -ln / 2 + (k + 0.5) * ln / n, 0.035), (1.06, 0.17, 0.07))
    for sx in (1, -1):
        f.box("iron", (sx * GAUGE / 2, 0, 0.1), (0.05, ln, 0.06))
        f.box("wood", (sx * GAUGE / 2, 0, -0.07), (0.13, ln, 0.14))
    for y in (-0.75, 0.45, 1.65):
        f.box("wood", (0, y, -0.19), (1.2, 0.15, 0.12))
        for sx in (1, -1):
            f.box("wood", (sx * 0.46, y, -0.5), (0.13, 0.13, 0.62))
    return A.built("track", f)


def portal():
    """A timbered tunnel mouth, opening toward -y, the track's level at z = 0 (its posts reach down to the cave floor):
    two posts, a lintel with a gold line, the dark behind it, a lantern on an arm. Returns the lantern's light."""
    f, g = A.fig(), A.fig()
    for sx in (1, -1):
        f.box("wood", (sx * 0.98, 0, 0.975), (0.26, 0.26, 3.05))
        f.box("wood", (sx * 0.72, 0, 2.22), (0.12, 0.14, 0.8), rot=Matrix.Rotation(sx * 0.78, 4, "Y"))
    f.box("wood", (0, 0, 2.64), (2.6, 0.32, 0.28))
    f.box("gold", (0, 0, 2.786), (2.5, 0.06, 0.014))
    for sx in (1, -1):
        f.box("gold", (sx * 1.285, 0, 2.64), (0.035, 0.335, 0.295))
    f.box("lacquer", (0, 0.6, 1.02), (2.1, 1.0, 3.14))
    arm = V((1.42, -0.1, 2.3))
    g.tube("iron", [(1.1, -0.1, 2.16), (1.26, -0.1, 2.32), arm + V((0, 0, 0.03))], 0.022, seg=6)
    light = lantern(f, g, arm, r=0.14, h=0.42)
    built("portal", f, g, bevel=0.012)
    return light


CRAGS = ((3.4, 13.0, 0.05), (2.8, 9.5, -0.07), (4.2, 17.0, 0.03))


def crag(key, r, h, lean):
    """A piece of cave wall: three rock prisms of seven sides grown together, one tall. The cave floor is z = 0."""
    f = A.fig()
    for dx, dy, sr, sh in ((0, 0, 1.0, 1.0), (0.8, 0.25, 0.74, 0.66), (-0.55, 0.6, 0.64, 0.46)):
        base = V((dx * r, dy * r, -1.0))
        top = V((dx * r + lean * h * sh, dy * r + lean * 0.4 * h * sh, h * sh))
        f.turned("rock", base, top, [(0, sr * r * 1.2), (0.45, sr * r), (0.85, sr * r * 0.82), (1, sr * r * 0.6)], seg=7)
    return A.built(key, f)


def reach(i, scale=1.0):
    """How far crag `i` reaches from where it is put."""
    return CRAGS[i][0] * scale * 1.78


def spire(h=10.0, r=1.5):
    """A great smooth stalagmite with a smaller one grown against it. The cave floor is z = 0."""
    f = A.fig()
    stalagmite(f, 0, 0, r, h, z0=-1.0, seg=22)
    stalagmite(f, 1.25 * r, 0.4 * r, 0.62 * r, 0.5 * h, z0=-1.0, seg=18)
    return A.built("spire", f)


def nub(key, pieces):
    """A low group of stalagmites for the cave floor."""
    f = A.fig()
    for x, y, r, h in pieces:
        stalagmite(f, x, y, r, h, z0=-0.3, seg=12)
    return A.built(key, f)


CLUSTER_LIT = cluster("cluster", 2.7)
cluster("tuft", 0.95, foot=False, shine=-1, bevel=0.0)
GEODE_LIT = cluster("geode", 2.7, foot=False, bevel=0.0)
stalagmites()
CART_LIT = cart()
timber()
WINCH_LIGHT = winch()
track()
PORTAL_LIGHT = portal()
for i, (r, h, lean) in enumerate(CRAGS):
    crag(f"crag{i}", r, h, lean)
spire()
nub("nub0", ((0, 0, 0.3, 1.25), (0.42, 0.2, 0.22, 0.7)))
nub("nub1", ((0, 0, 0.26, 0.9), (-0.36, 0.26, 0.2, 0.55), (0.3, 0.34, 0.17, 0.4)))


def place(key, x, z, yaw=0.0, scale=S, y=0.0, marks=()):
    """`A.put` for every template of the prop, and a mark at each (kind, spot of the prop) of `marks`."""
    for part in PARTS.get(key, (key,)):
        A.put(part, x, z, yaw=yaw, scale=scale, y=y)
    c, s = math.cos(yaw), math.sin(yaw)
    for kind, p in marks:
        A.mark(kind, x + scale * (p.x * c - p.y * s), z - scale * (p.x * s + p.y * c), y + scale * p.z)


# ---- cover --------------------------------------------------------------------------------------------------------
def along(o):
    """The middle of a wall and the yaw that lays a prop's y axis along it."""
    return (o["ax"] + o["bx"]) / 2, (o["az"] + o["bz"]) / 2, math.atan2(o["bx"] - o["ax"], o["bz"] - o["az"])


def carts(o, turn):
    x, z, yaw = along(o)
    place("cart", x, z, yaw=yaw, marks=(("crystal", CART_LIT),))


def timbers(o, turn):
    x, z, yaw = along(o)
    place("timber", x, z, yaw=yaw)


def clusters(o, turn):
    place("cluster", o["ax"], o["az"], yaw=turn + 0.4, scale=o["height"] / 2.7, marks=(("crystal", CLUSTER_LIT),))


def rows(o, turn):
    x, z, yaw = along(o)
    place("stalagmites", x, z, yaw=yaw)


def winches(o, turn):
    x, z, yaw = along(o)
    place("winch", x, z, yaw=yaw, marks=(("lantern", WINCH_LIGHT),))


LAYOUT = [
    # the cart is long and narrow: a short wall along the track fits it, a pillar would stand out 0.3 m past its sides
    (wall(round(-TRACK.x * 0.55, 3), round(7 - TRACK.y * 0.55, 3), round(TRACK.x * 0.55, 3), round(7 + TRACK.y * 0.55, 3), 0.4, 1.4), carts),
    (wall(-2.0, 3.8, -4.8, 3.1, 0.4, 1.2), timbers),
    (pillar(3.4, 4.0, 0.8, 3.5), clusters),
    (wall(9.0, 8.0, 9.4, 6.4, 0.4, 1.4), rows),
    (wall(6.6, 2.2, 8.0, 3.6, 0.4, 3.3), winches),
]
o, build = LAYOUT[0]
A.cover(o)
build(o, 0.0)
for o, build in LAYOUT[1:]:
    A.cover(o)
    build(o, 0.0)
    A.cover(twin(o))
    build(twin(o), PI)

# ---- backdrop -----------------------------------------------------------------------------------------------------
A.back()
rnd = random.Random(11)


def both(key, x, z, yaw=0.0, scale=1.0, y=OUT, marks=()):
    """A prop and its twin through the ring's centre: both cameras see the same cave."""
    place(key, x, z, yaw=yaw, scale=scale, y=y, marks=marks)
    place(key, -x, 14 - z, yaw=yaw + PI, scale=scale, y=y, marks=marks)


# the track out of the ring over a trestle, into a tunnel mouth in the cave's side (|x| > 12)
for sgn in (1, -1):
    d = TRACK * sgn
    yaw = math.atan2(-d.x, -d.y)          # the prop's +y points outward
    place("track", d.x * 14.6, 7 + d.y * 14.6, yaw=yaw, y=0.0)
    place("portal", d.x * 16.2, 7 + d.y * 16.2, yaw=yaw, y=0.0, marks=(("lamp", PORTAL_LIGHT),))
    place("crag1", d.x * 21.0, 7 + d.y * 21.0, yaw=yaw + 0.4, scale=1.25, y=OUT)
    for side in (1, -1):
        n = V((-d.y, d.x)) * side
        place("crag0" if side > 0 else "crag2", d.x * 21.5 + n.x * 6.2, 7 + d.y * 21.5 + n.y * 6.2, yaw=yaw + side * 1.1, scale=0.85, y=OUT)

# great stalagmites and great crystals along both sides, off the z axis (|x| > 12)
both("spire", 16.6, 0.2, yaw=0.3)
both("spire", 16.0, 18.8, yaw=2.4, scale=0.8)
both("geode", 20.0, 4.8, yaw=0.9, scale=2.1, marks=(("geode", GEODE_LIT),))
both("geode", 18.2, 14.8, yaw=2.6, scale=1.5)
both("crag1", 22.5, 2.0, yaw=0.5, scale=1.1)
both("crag0", 24.0, 13.0, yaw=2.2)
both("crag2", 21.5, 23.5, yaw=1.4)
both("crag1", 19.0, -6.5, yaw=4.0, scale=1.2)

# the cave's far walls: toward both cameras nothing tall stands nearer than 26 m
for k in range(9):
    a = -0.62 + 1.24 * k / 8                      # the arc behind the far rim; `both` gives the near one
    i, sc = k % 3, 1.0 + 0.1 * (k % 2)
    r = 26.6 + reach(i, sc) + 1.5 * (k % 2)
    both(f"crag{i}", r * math.sin(a), 7 - r * math.cos(a), yaw=a * 3.1 + k, scale=sc)
for k in range(6):
    a = -0.55 + 1.1 * k / 5
    both(f"crag{(k + 1) % 3}", 43.0 * math.sin(a), 7 - 43.0 * math.cos(a), yaw=a * 2.3 + 2 * k, scale=1.45)
both("geode", -9.5, 7 - 29.5, yaw=0.3, scale=2.9, marks=(("geode", GEODE_LIT),))

# low things on the cave floor (all under 2 m): crystals and stalagmites, clear of the track
LOW = 0
while LOW < 26:
    a, r = rnd.uniform(0, PI), rnd.uniform(13.6, 23.5)
    x, z = r * math.sin(a), 7 - r * math.cos(a)
    off = abs(x * TRACK.y - (z - 7) * TRACK.x)            # distance from the track's line
    if off < 2.6 and abs(x) > 10:
        continue
    kind = ("tuft", "nub0", "nub1")[LOW % 3]
    both(kind, x, z, yaw=rnd.uniform(0, 2 * PI), scale=S * rnd.uniform(0.85, 1.3) if kind == "tuft" else rnd.uniform(0.95, 1.4))
    LOW += 1

out = A.finish()

# every obstacle's mesh against its capsule: how far it reaches along the capsule's line and across it
for i, ob in enumerate(A.obstacles):
    mesh = next(m for m in out if m.name == f"cover{i}")
    dx, dz = ob["bx"] - ob["ax"], ob["bz"] - ob["az"]
    ln = math.hypot(dx, dz)
    ux, uz = (dx / ln, dz / ln) if ln else (1.0, 0.0)
    mx, mz = (ob["ax"] + ob["bx"]) / 2, (ob["az"] + ob["bz"]) / 2
    pts = [(v.co.x - mx, -v.co.y - mz) for v in mesh.data.vertices if v.co.z < 1.6]
    al = max(abs(x * ux + z * uz) for x, z in pts)
    ac = max(abs(x * uz - z * ux) for x, z in pts)
    print(f"COVER {i} {ob['kind']}: mesh reaches {al:.2f} along (capsule {ln / 2 + ob['r']:.2f}), {ac:.2f} across (capsule {ob['r']:.2f})")

# the camera rule, per vertex: outside the ring anything taller than 2 m is more than 26 m from (0, 7) or at |x| > 12
back = next(ob for ob in out if ob.name == "back")
bad = [v.co for v in back.data.vertices if v.co.z > 2.0 and abs(v.co.x) <= 12.0 and math.hypot(v.co.x, -v.co.y - 7.0) <= 26.0]
print(f"CAMERA RULE: {len(bad)} vertices break it" + (f", e.g. x {bad[0].x:.1f} z {-bad[0].y:.1f} y {bad[0].z:.1f}" if bad else ""))
if bad:
    raise SystemExit("cavern: the backdrop breaks the camera rule")

if ARGS:
    A.render(ARGS[0])
