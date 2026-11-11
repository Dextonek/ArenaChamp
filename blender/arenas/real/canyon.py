"""Sandstone Canyon: the paved court of an old caravan stop on a canyon floor at dusk, between wind-carved walls.
Built in the heroes' way (kit.py, STYLE.md): clean turned and lofted forms in a few plain materials, gold on the
edges, lantern light as the only glow. The rocks are idealised: smooth lofted bastions with a few broad bands of
darker stone, never lumpy. The arena's own colour is the turquoise of glazed tiles and cloth.

Cover (point-symmetric about (0, 7)): the dry well in the middle (low), two fallen columns guarding the starts (low),
two wind-carved rock pillars with a way lantern each flanking the middle (tall), two clusters of glazed jars on the
wings (low), two fallen statues by their plinths in the far corners (low).

Round it: the canyon runs along z (the cameras sit at its two ends: nothing over 2 m there within 26 m), its walls as
two terraces of rounded bastions left and right, a side canyon opening on the far left, a great rock arch across the
far end, mesas beyond. Beside the court: a broken colonnade on the left, a trader's awning on the right, banners.
Run:
    blender --background --factory-startup --python blender/arenas/real/canyon.py [-- <check picture path>]
"""
import math
import os
import random
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bmesh  # noqa: E402
from mathutils import Matrix, Vector  # noqa: E402

from kit import Arena, S, pillar, twin, wall  # noqa: E402

PI = math.pi
A = Arena("canyon")
V = Vector

# the heroes' materials (STYLE.md) and three tones of rock; src/arenas/canyon.ts dims them: the arena must not
# outshine the heroes. Keys must not contain each other (real.ts matches them as parts of the material's name).
A.mat("rock", "#74493a", rough=0.85)
A.mat("band", "#5a3a31", rough=0.85)
A.mat("far", "#43323e", rough=0.9)
A.mat("cream", "#d8cfb4", rough=0.8)
A.mat("teal", "#1f7a78", rough=0.55, double=True)
A.mat("gold", "#c9a24a", rough=0.32, metal=0.85)
A.mat("lacquer", "#1d1b21", rough=0.45)
A.mat("wood", "#4a3220", rough=0.7)
A.mat("plank", "#6b4226", rough=0.75)
A.mat("rope", "#b89a5a", rough=0.9)
A.mat("iron", "#3c3f47", rough=0.42, metal=0.75)
A.mat("glow", "#ffcf80", rough=0.4, emit="#ffb03a", strength=1.0)


# ---- helpers the kit does not have --------------------------------------------------------------------------------
def smooth(pts, n=3):
    """A smooth curve (Catmull-Rom) through `pts` (tuples of any length), `n` samples per span."""
    p = [pts[0]] + list(pts) + [pts[-1]]
    out = []
    for i in range(1, len(p) - 2):
        p0, p1, p2, p3 = p[i - 1], p[i], p[i + 1], p[i + 2]
        for k in range(n):
            t = k / n
            out.append(tuple(0.5 * (2 * p1[j] + (p2[j] - p0[j]) * t + (2 * p0[j] - 5 * p1[j] + 4 * p2[j] - p3[j]) * t * t
                                    + (3 * p1[j] - p0[j] - 3 * p2[j] + p3[j]) * t ** 3) for j in range(len(p1))))
    out.append(tuple(pts[-1]))
    return out


def strata(f, rows, bands, seg=28, keys=("rock", "band"), top=True):
    """A lofted rock: `rows` [(z, rx, ry, cx, cy)] bottom to top; the heights in `bands` [(z0, z1)] take the darker
    stone, the rest the lighter. One skin, cut only where the colour changes."""
    def key(i):
        z = (rows[i][0] + rows[i + 1][0]) / 2
        return keys[1] if any(a <= z < b for a, b in bands) else keys[0]
    i = 0
    while i < len(rows) - 1:
        j = i + 1
        while j < len(rows) - 1 and key(j) == key(i):
            j += 1
        f.loft(key(i), [((r[3], r[4], r[0]), r[1], r[2]) for r in rows[i:j + 1]], seg=seg, cap_top=top and j == len(rows) - 1)
        i = j


def bbox(f, key, c, size, b=0.012):
    """A box of `size` centred on `c` with its edges rounded by `b`, so they catch the light. (The kit's own bevel
    rounds every crisp edge of a prop, its thin gold rings too, which costs thousands of triangles.)"""
    bm = f.bm(key)
    geo = bmesh.ops.create_cube(bm, size=1.0, matrix=Matrix.Translation(V(c)) @ Matrix.Diagonal((size[0], size[1], size[2], 1.0)))
    bmesh.ops.bevel(bm, geom=list({e for v in geo["verts"] for e in v.link_edges}), offset=min(b, min(size) * 0.3), segments=2, affect="EDGES", profile=0.5)


def sheet(f, key, fn, nu, nv):
    """A cloth: the surface fn(u, v) for u, v in 0..1 (give it a two-sided material)."""
    bm = f.bm(key)
    rows = [[bm.verts.new(fn(i / nu, j / nv)) for i in range(nu + 1)] for j in range(nv + 1)]
    for r0, r1 in zip(rows, rows[1:]):
        for i in range(nu):
            bm.faces.new((r0[i], r0[i + 1], r1[i + 1], r1[i]))


def lantern(f, c, r=0.11, h=0.34):
    """A square lantern hanging with its top ring at `c` (as the harbour's): gold base and roof, dark posts, the light."""
    c = V(c)
    top, bot = c.z - 0.06, c.z - 0.06 - h
    f.box("gold", (c.x, c.y, bot + 0.02), (2.4 * r, 2.4 * r, 0.04))
    f.box("glow", (c.x, c.y, (top + bot) / 2), (1.5 * r, 1.5 * r, h - 0.08))
    for sx in (1, -1):
        for sy in (1, -1):
            f.tube("lacquer", [(c.x + sx * r, c.y + sy * r, bot + 0.03), (c.x + sx * r, c.y + sy * r, top - 0.02)], 0.014, seg=5)
    f.turned("gold", (c.x, c.y, top - 0.03), (c.x, c.y, top + 0.1), [(0, 1.75 * r), (0.2, 1.8 * r), (0.75, 0.6 * r), (1, 0.02)], seg=4)
    f.torus("gold", (c.x, c.y, c.z), 0.045, 0.01, normal=(1, 0, 0), seg=(12, 5))


def jar(f, c, k=1.0, body="teal", band="cream", seg=18, lid=False):
    """A glazed storage jar standing at `c`, `k` times 0.95 m tall: a turned body, a band round the belly between two
    gold lines, a gold lip, the dark of its mouth (or a lid)."""
    c = V(c)
    prof = smooth([(0.0, 0.13), (0.05, 0.15), (0.25, 0.27), (0.45, 0.31), (0.62, 0.27), (0.76, 0.16), (0.84, 0.115), (0.9, 0.12), (0.95, 0.155)], 2)
    at = lambda z: c + V((0, 0, z * k))
    f.tube(body, [at(z) for z, _ in prof], [r * k for _, r in prof], seg=seg)
    f.turned(band, at(0.37), at(0.53), [(0, 0.302 * k), (0.5, 0.315 * k), (1, 0.302 * k)], seg=seg, caps=False)
    for z, r in ((0.37, 0.303), (0.53, 0.303), (0.95, 0.155)):
        f.torus("gold", at(z), r * k, 0.012 * k, seg=(seg, 4))
    if lid:
        f.turned(body, at(0.95), at(1.03), [(0, 0.15 * k), (0.5, 0.11 * k), (1, 0.03 * k)], seg=seg)
        f.ellipsoid("gold", at(1.05), (0.035 * k,) * 3, seg=(10, 6))
    else:
        f.turned("lacquer", at(0.945), at(0.955), [(0, 0.125 * k), (1, 0.125 * k)], seg=seg)


# ---- cover, at life size, standing on z = 0 -----------------------------------------------------------------------
def well():
    """The dry well: a round kerb of pale stone with a band of turquoise tiles, the dark shaft, a low windlass with
    its rope and bucket."""
    f = A.fig()
    R, r, h = 0.68, 0.47, 0.62
    f.loft("cream", [((0, 0, 0), R, R), ((0, 0, 0.07), R, R), ((0, 0, 0.11), R - 0.05, R - 0.05), ((0, 0, h - 0.13), R - 0.05, R - 0.05),
                     ((0, 0, h - 0.08), R, R), ((0, 0, h), R, R), ((0, 0, h), r, r), ((0, 0, 0.16), r, r)], seg=32)
    f.turned("lacquer", (0, 0, 0.15), (0, 0, 0.165), [(0, r), (1, r)], seg=32)
    f.turned("teal", (0, 0, 0.19), (0, 0, 0.41), [(0, R - 0.038), (1, R - 0.038)], seg=32, caps=False)
    for z in (0.19, 0.41):
        f.torus("gold", (0, 0, z), R - 0.038, 0.012, seg=(32, 5))
    f.torus("gold", (0, 0, h), R - 0.012, 0.016, seg=(32, 5))
    f.torus("gold", (0, 0, h), r + 0.012, 0.012, seg=(32, 5))
    # the windlass
    top = h + 0.36
    for sx in (1, -1):
        bbox(f, "wood", (sx * 0.575, 0, h + 0.2), (0.1, 0.1, 0.44))
        bbox(f, "gold", (sx * 0.575, 0, h + 0.43), (0.125, 0.125, 0.03))
    f.turned("wood", (-0.66, 0, top - 0.06), (0.66, 0, top - 0.06), [(0, 0.05), (1, 0.05)], seg=14)
    for k in range(5):
        f.torus("rope", (-0.1 + 0.05 * k, 0, top - 0.06), 0.066, 0.022, normal=(1, 0, 0), seg=(12, 4))
    f.tube("rope", [(0.02, 0.066, top - 0.06), (0.02, 0.066, 0.56)], 0.018, seg=6)
    f.turned("wood", (0.02, 0.066, 0.36), (0.02, 0.066, 0.56), [(0, 0.1), (1, 0.125)], seg=16)
    f.torus("gold", (0.02, 0.066, 0.54), 0.127, 0.011, seg=(16, 5))
    f.tube("iron", [(0.66, 0, top - 0.06), (0.76, 0, top - 0.06), (0.76, 0, top - 0.24), (0.86, 0, top - 0.24)], 0.016, seg=6)
    return A.built("well", f)


def fallen(r=0.25):
    """A column fallen along y and broken into three drums with clean cuts: the capital at the -y end (its neck ringed
    in gold and turquoise), the foot and its plinth at the +y end."""
    f = A.fig()
    # the capital and the top drum: it rests on the abacus' edge
    a, b = V((0.02, -1.4, 0.325)), V((-0.02, -0.52, r))
    bbox(f, "cream", (0.02, -1.45, 0.33), (0.66, 0.1, 0.66))
    bbox(f, "gold", (0.02, -1.395, 0.33), (0.6, 0.02, 0.6))
    f.turned("cream", a, b, [(0, 0.32), (0.1, 0.3), (0.2, r + 0.005), (1, r)], seg=26)
    for t in (0.22, 0.44):
        f.torus("gold", a.lerp(b, t), r + 0.006, 0.014, normal=b - a, seg=(26, 5))
    f.turned("teal", a.lerp(b, 0.22), a.lerp(b, 0.44), [(0, r + 0.012), (1, r + 0.01)], seg=26, caps=False)
    # the middle drum, rolled a little aside
    f.turned("cream", (0.07, -0.44, r), (0.03, 0.46, r), [(0, r), (1, r)], seg=26)
    # the foot: a drum, the base's roll, the plinth
    a, b = V((-0.03, 0.54, r)), V((0.0, 1.4, 0.305))
    f.turned("cream", a, b, [(0, r), (0.78, r), (0.82, r + 0.05), (0.9, r + 0.06), (0.97, r + 0.03), (1, r + 0.03)], seg=26)
    f.torus("gold", a.lerp(b, 0.76), r + 0.006, 0.014, normal=b - a, seg=(26, 5))
    bbox(f, "cream", (0.0, 1.45, 0.31), (0.62, 0.1, 0.62))
    return A.built("fallen", f)


def hoodoo():
    """A wind-carved spire of rock: a broad foot, a long hollow cut by the wind, a shoulder, a little oval and
    leaning, a band of darker stone, and a cap stone of the same darker rock balanced on its neck. A turquoise sash
    tied round the waist, a way lantern on an iron hook (toward +x). Returns how far out and how high the lantern's
    light is."""
    f = A.fig()
    #        z     rx    ry    cx     cy
    stem = [(0.0, 0.73, 0.73, 0.0, 0.0), (0.1, 0.71, 0.71, 0.0, 0.0), (0.45, 0.56, 0.6, 0.01, 0.0), (0.95, 0.41, 0.47, 0.03, 0.01), (1.48, 0.35, 0.4, 0.04, 0.02),
            (1.95, 0.37, 0.42, 0.02, 0.03), (2.35, 0.44, 0.48, -0.02, 0.03), (2.62, 0.47, 0.5, -0.04, 0.02), (2.8, 0.43, 0.46, -0.05, 0.01), (2.9, 0.4, 0.43, -0.05, 0.01)]
    strata(f, smooth(stem, 3), [(0.62, 0.78)], seg=28, top=False)
    # the cap stone: a slab of harder, darker rock lying on its shoulder, a little off the middle
    cap = [(2.84, 0.3, 0.3, -0.05, 0.01), (2.88, 0.55, 0.5, -0.07, 0.02), (2.95, 0.63, 0.57, -0.08, 0.02), (3.08, 0.64, 0.58, -0.09, 0.03), (3.17, 0.6, 0.54, -0.09, 0.03),
           (3.23, 0.46, 0.41, -0.09, 0.03), (3.25, 0.16, 0.14, -0.09, 0.03)]
    strata(f, smooth(cap, 2), [(0.0, 9.0)], seg=28)
    f.loft("teal", [((0.04, 0.02, z), 0.365 + 0.012 * abs(z - 1.47) / 0.11, 0.415 + 0.012 * abs(z - 1.47) / 0.11) for z in (1.36, 1.47, 1.58)], seg=28)
    for z in (1.36, 1.58):
        f.loft("gold", [((0.04, 0.02, z + d), 0.378 + e, 0.428 + e) for d, e in ((-0.014, 0.0), (0.0, 0.012), (0.014, 0.0))], seg=28)
    sheet(f, "teal", lambda u, v: (-0.06 + 0.2 * u + 0.04 * v, -0.4 - 0.03 * math.sin(PI * v) - 0.07 * v, 1.42 - 0.62 * v * (1 - 0.14 * (1 - abs(2 * u - 1)))), 2, 5)
    arm = V((0.8, 0, 2.02))
    f.tube("iron", [(0.36, 0, 1.9), (0.6, 0, 2.06), arm + V((0, 0, 0.03))], 0.022, seg=6)
    lantern(f, arm, r=0.12, h=0.36)
    A.built("hoodoo", f, sharp=60.0)
    return arm.x, arm.z - 0.26


def jars(key="jars", seg=18):
    """Three glazed jars standing together: two turquoise, one of pale clay with a turquoise band, one lidded."""
    f = A.fig()
    jar(f, (0.0, -0.3, 0), 1.0, seg=seg)
    jar(f, (0.27, 0.17, 0), 0.86, body="cream", band="teal", seg=seg)
    jar(f, (-0.28, 0.14, 0), 0.74, lid=True, seg=seg)
    return A.built(key, f)


def statue():
    """A fallen statue along y: its plinth at the +y end with the stump of the robe's hem on it, the figure lying in
    two clean pieces: the robe, and the body with its arms folded, its head and gold crown."""
    f = A.fig()
    bbox(f, "cream", (0, 1.0, 0.21), (0.64, 0.64, 0.42))
    bbox(f, "teal", (0, 1.0, 0.22), (0.655, 0.655, 0.12))
    bbox(f, "gold", (0, 1.0, 0.41), (0.66, 0.66, 0.025))
    f.turned("cream", (0, 1.0, 0.42), (0, 1.0, 0.6), [(0, 0.25), (1, 0.225)], seg=24)
    # the robe, from its break up to the waist
    a, b = V((0.03, 0.58, 0.225)), V((-0.02, -0.34, 0.17))
    f.turned("cream", a, b, [(0, 0.225), (0.6, 0.19), (1, 0.165)], seg=24)
    f.torus("gold", a.lerp(b, 0.93), 0.175, 0.016, normal=b - a, seg=(24, 5))
    # the body lies on its back: waist, chest, shoulders, neck; the arms folded on the breast; the head and its crown
    a, b = V((-0.05, -0.42, 0.17)), V((0.06, -1.05, 0.17))
    d = (b - a).normalized()
    side = V((d.y, -d.x, 0))
    f.tube("cream", [a.lerp(b, t) for t in (0, 0.3, 0.62, 0.8, 0.9, 1)], [0.165, 0.19, 0.225, 0.2, 0.1, 0.075], seg=24, squash=((0, 0, 1), 0.76))
    for sg in (1, -1):
        sh, el, hand = a.lerp(b, 0.74) + side * sg * 0.2, a.lerp(b, 0.36) + side * sg * 0.23 + V((0, 0, 0.03)), a.lerp(b, 0.5) + side * sg * 0.03 + V((0, 0, 0.15))
        f.tube("cream", [sh, sh.lerp(el, 0.5) + side * sg * 0.015, el, el.lerp(hand, 0.5) + V((0, 0, 0.02)), hand], [0.07, 0.062, 0.056, 0.05, 0.045], seg=10)
    f.torus("teal", a.lerp(b, 0.88), 0.125, 0.03, normal=d, seg=(20, 6))
    head = b + d * 0.1
    f.ellipsoid("cream", head, (0.115, 0.14, 0.12), seg=(20, 12))
    f.turned("gold", head + d * 0.04, head + d * 0.24, [(0, 0.118), (0.12, 0.125), (0.2, 0.112), (0.85, 0.135), (1, 0.13)], seg=20)
    return A.built("statue", f)


# ---- round the court, at life size --------------------------------------------------------------------------------
def column(key, h, whole=True):
    """A standing column on its plinth, `h` tall: with its capital, or cut clean where it broke."""
    f = A.fig()
    r = 0.27
    bbox(f, "cream", (0, 0, 0.07), (0.72, 0.72, 0.14))
    f.torus("cream", (0, 0, 0.2), r + 0.03, 0.06, seg=(20, 6))
    if whole:
        f.turned("cream", (0, 0, 0.14), (0, 0, h - 0.12), [(0, r), (0.9, r - 0.03), (0.94, r - 0.02), (1, 0.36)], seg=20)
        bbox(f, "cream", (0, 0, h - 0.06), (0.76, 0.76, 0.12))
        bbox(f, "gold", (0, 0, h - 0.125), (0.7, 0.7, 0.02))
        z0, z1 = 0.14 + (h - 0.26) * 0.78, 0.14 + (h - 0.26) * 0.88
        f.turned("teal", (0, 0, z0), (0, 0, z1), [(0, r - 0.014), (1, r - 0.018)], seg=20, caps=False)
        for z in (z0, z1):
            f.torus("gold", (0, 0, z), r - 0.014, 0.014, seg=(20, 5))
    else:
        f.turned("cream", (0, 0, 0.14), (0, 0, h), [(0, r), (1, r - 0.03 * h / 3.6)], seg=20)
    return A.built(key, f)


def beam(ln):
    """The stone beam two columns still carry, along y, its underside at z = 0."""
    f = A.fig()
    bbox(f, "cream", (0, 0, 0.17), (0.6, ln, 0.34))
    bbox(f, "teal", (0, 0, 0.2), (0.615, ln - 0.3, 0.1))
    bbox(f, "gold", (0, 0, 0.3), (0.64, ln + 0.04, 0.025), b=0.006)
    return A.built("beam", f)


def stall():
    """A trader's awning, open toward -y: four poles with gold caps, a turquoise cloth sagging between them, a low
    table with jars, a lantern under the front edge. Returns the light's height."""
    f = A.fig()
    hx, hy, zf, zb = 1.55, 1.0, 2.15, 2.55
    for sx in (1, -1):
        for sy, z in ((-1, zf), (1, zb)):
            f.turned("wood", (sx * hx, sy * hy, 0), (sx * hx, sy * hy, z + 0.12), [(0, 0.055), (1, 0.045)], seg=10)
            f.ellipsoid("gold", (sx * hx, sy * hy, z + 0.14), (0.06, 0.06, 0.08), seg=(10, 6))
    cloth = lambda u, v: (-hx - 0.12 + (2 * hx + 0.24) * u, -hy - 0.12 + (2 * hy + 0.24) * v, zf + (zb - zf) * v - 0.2 * math.sin(PI * u) * (0.45 + 0.55 * math.sin(PI * v)))
    sheet(f, "teal", cloth, 8, 5)
    for v in (0, 1):
        f.tube("gold", [cloth(i / 8, v) for i in range(9)], 0.022, seg=5)
    bbox(f, "plank", (0, 0.25, 0.62), (2.3, 0.8, 0.06))
    for sx in (1, -1):
        for sy in (1, -1):
            bbox(f, "wood", (sx * 1.05, 0.25 + sy * 0.32, 0.3), (0.08, 0.08, 0.6))
    jar(f, (-0.7, 0.25, 0.65), 0.5, seg=12)
    jar(f, (-0.2, 0.3, 0.65), 0.62, body="cream", band="teal", seg=12, lid=True)
    jar(f, (0.55, 0.25, 0.65), 0.45, seg=12, lid=True)
    lamp = V(cloth(0.5, 0)) - V((0, 0, 0.03))
    lantern(f, lamp, r=0.13, h=0.4)
    A.built("stall", f)
    return lamp.z - 0.3


def banner():
    """A banner on its pole (the cloth toward +x): a gold finial, a cross bar, a long turquoise cloth with a notched
    end and a gold weight bar."""
    f = A.fig()
    f.turned("wood", (0, 0, 0), (0, 0, 4.3), [(0, 0.065), (1, 0.045)], seg=10)
    f.turned("gold", (0, 0, 4.3), (0, 0, 4.62), [(0, 0.05), (0.25, 0.085), (0.5, 0.05), (1, 0.005)], seg=10)
    f.tube("wood", [(-0.1, 0, 4.05), (0.86, 0, 4.05)], 0.028, seg=8)
    f.ellipsoid("gold", (0.88, 0, 4.05), (0.045,) * 3, seg=(10, 6))
    ln = 2.5
    cloth = lambda u, v: (0.1 + 0.7 * u, 0.07 * math.sin(2.3 * PI * v) * v, 4.03 - ln * v * (1 - 0.13 * (1 - abs(2 * u - 1))))
    sheet(f, "teal", cloth, 4, 8)
    sheet(f, "cream", lambda u, v: V(cloth(0.36 + 0.28 * u, 0.06 + 0.8 * v)) + V((0, -0.006, 0)), 1, 8)
    f.tube("gold", [cloth(i / 4, 1) for i in range(5)], 0.02, seg=5)
    return A.built("banner", f)


def waystone():
    """A low way stone beside the road: a turned stub of pale stone with a turquoise band and a gold cap."""
    f = A.fig()
    f.turned("cream", (0, 0, 0), (0, 0, 0.86), [(0, 0.24), (0.08, 0.24), (0.13, 0.2), (0.9, 0.17), (1, 0.12)], seg=14)
    f.turned("teal", (0, 0, 0.5), (0, 0, 0.64), [(0, 0.187), (1, 0.181)], seg=14, caps=False)
    f.ellipsoid("gold", (0, 0, 0.87), (0.125, 0.125, 0.07), seg=(14, 6))
    return A.built("waystone", f)


def stump():
    """What is left of a column: its plinth and a drum, cut clean."""
    f = A.fig()
    bbox(f, "cream", (0, 0, 0.07), (0.72, 0.72, 0.14))
    f.torus("cream", (0, 0, 0.2), 0.3, 0.06, seg=(18, 6))
    f.turned("cream", (0, 0, 0.14), (0, 0, 0.7), [(0, 0.27), (1, 0.265)], seg=18)
    f.torus("gold", (0, 0, 0.6), 0.27, 0.014, seg=(18, 5))
    return A.built("stump", f)


N_BUTTE = 0


def bastion(x, z, rx, rz, h, seed, keys=("rock", "band"), seg=24, fine=True, y=0.0):
    """One rounded bastion of the canyon wall at the game's (x, z), `rx` by `rz` at its foot and `h` high: a flared
    foot, a wind-cut hollow, a full belly, round shoulders and a domed top: slickrock. Two bands of darker stone."""
    global N_BUTTE
    rnd = random.Random(seed)
    f = A.fig()
    waist, belly = 0.22 + 0.1 * rnd.random(), 0.56 + 0.12 * rnd.random()
    prof = [(-0.25, 1.14), (0.0, 1.08), (0.08, 1.0), (waist, 0.91), (waist + 0.14, 0.93), (belly, 1.0), (belly + 0.12, 0.985), (0.84, 0.9), (0.92, 0.76), (0.97, 0.55), (0.995, 0.3), (1.0, 0.1)]
    if not fine:   # far off: the same shape in fewer rings
        prof = [(-0.25, 1.14), (0.0, 1.08), (waist, 0.91), (belly, 1.0), (0.84, 0.9), (0.94, 0.7), (0.99, 0.38), (1.0, 0.1)]
    dx, dy = (rnd.random() - 0.5) * 0.12 * rx, (rnd.random() - 0.5) * 0.12 * rz
    rows = [(t * h, rx * s, rz * s, dx * t * t, dy * t * t) for t, s in prof]
    bands = [(waist * h, (waist + 0.14) * h), ((belly + 0.12) * h, 0.84 * h)] if len(keys) > 1 and fine else [(waist * h, belly * h)] if len(keys) > 1 else []
    strata(f, rows, bands, seg=seg, keys=keys if len(keys) > 1 else (keys[0], keys[0]))
    N_BUTTE += 1
    A.built(f"bastion{N_BUTTE}", f, sharp=62.0)
    A.put(f"bastion{N_BUTTE}", x, z, scale=1.0, y=y)


def arch(span, h, key="far"):
    """The great arch across the canyon's far end, along x: one smooth span, thick at its feet."""
    f = A.fig()
    pts, rad = [], []
    for i in range(21):
        a = PI * i / 20
        pts.append((-span / 2 * math.cos(a), 0, -3.0 + (h + 3.0) * math.sin(a) ** 0.8))
        rad.append(1.1 + 2.3 * abs(math.cos(a)) ** 1.6)
    f.tube(key, pts, rad, seg=14, squash=((0, 1, 0), 0.7))
    return A.built("arch", f)


well()
fallen()
LANTERN_OUT, LANTERN_UP = hoodoo()
jars()
jars("jars_far", seg=12)
statue()
for key, h, whole in (("col_whole", 3.7, True), ("col_half", 2.1, False), ("col_low", 1.2, False)):
    column(key, h, whole)
beam(3.5 + 0.6)
STALL_LAMP = stall()
banner()
waystone()
stump()
arch(36.0, 16.0)


# ---- cover --------------------------------------------------------------------------------------------------------
def wells(o, turn):
    A.put("well", o["ax"], o["az"], yaw=0.5)


def columns(o, turn):
    ax, az, bx, bz = o["ax"], o["az"], o["bx"], o["bz"]
    length = math.hypot(bx - ax, bz - az) + 2 * o["r"]
    A.put("fallen", (ax + bx) / 2, (az + bz) / 2, yaw=math.atan2(bx - ax, bz - az), stretch=(1.12, length / (3.0 * S), 1.0))


def hoodoos(o, turn):
    x, z = o["ax"], o["az"]
    a = turn + 0.5
    A.put("hoodoo", x, z, yaw=a)
    A.mark("lantern", x + LANTERN_OUT * S * math.cos(a), z - LANTERN_OUT * S * math.sin(a), LANTERN_UP * S)


def jar_clusters(o, turn):
    A.put("jars", o["ax"], o["az"], yaw=turn + 0.8)


def statues(o, turn):
    ax, az, bx, bz = o["ax"], o["az"], o["bx"], o["bz"]
    length = math.hypot(bx - ax, bz - az) + 2 * o["r"]
    A.put("statue", (ax + bx) / 2, (az + bz) / 2, yaw=math.atan2(bx - ax, bz - az), stretch=(1.15, length / (2.68 * S), 1.0))


LAYOUT = [
    (pillar(0, 7, 0.9, 1.4), wells),
    (wall(2.0, 4.1, 5.0, 3.2, 0.4, 0.9), columns),
    (pillar(-4.4, 5.0, 0.95, 4.2), hoodoos),
    (pillar(7.8, 6.0, 0.8, 1.3), jar_clusters),
    (wall(-6.2, 1.6, -8.2, 3.4, 0.4, 0.9), statues),
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
# the canyon's walls, left and right of the court (|x| > 12: the cameras look along the canyon). A lower terrace of
# bastions whose feet stand 17 m out, a higher wall behind it. On the far left the wall opens into a side canyon.
LOW_R = [(-36, 6.2, 7.6), (-27, 6.6, 8.6), (-18, 5.8, 7.0), (-9.5, 6.4, 8.8), (-1, 6.0, 7.4), (7.5, 6.6, 8.2), (16, 5.8, 9.0), (24.5, 6.4, 7.2), (33, 6.0, 8.4), (42, 6.6, 7.6)]
LOW_L = [(2, 6.2, 7.4), (10.5, 6.4, 8.8), (19, 5.8, 7.2), (27.5, 6.6, 8.6), (36, 6.0, 7.6), (44.5, 6.4, 8.2), (-31, 6.4, 8.0), (-40, 6.0, 7.4)]
for i, (z, r, h) in enumerate(LOW_R):
    bastion(17.2 + r, z, r, 6.4, h, 10 + i)
for i, (z, r, h) in enumerate(LOW_L):
    bastion(-17.2 - r, z, r, 6.4, h, 30 + i)
HIGH_R = [(-40, 16.0), (-26, 19.0), (-12, 15.5), (2, 18.0), (16, 16.5), (30, 20.0), (44, 17.0)]
HIGH_L = [(4, 17.5), (18, 15.5), (32, 19.5), (46, 16.5), (-36, 18.0)]
for i, (z, h) in enumerate(HIGH_R):
    bastion(35.5, z, 9.5, 10.0, h, 50 + i, seg=18, fine=False)
for i, (z, h) in enumerate(HIGH_L):
    bastion(-35.5, z, 9.5, 10.0, h, 70 + i, seg=18, fine=False)
# the side canyon on the far left: its own far wall, in the far tone
for i, (x, z, h) in enumerate(((-52, -4, 17.0), (-58, -18, 21.0), (-50, -30, 16.0))):
    bastion(x, z, 10.0, 10.0, h, 90 + i, keys=("far",), seg=14, fine=False)
# the great arch across the far end (31 m from the centre) and the mesas beyond both ends, in the far tone
A.put("arch", 0.0, -27.0, scale=1.0)
for i, (x, z, rx, rz, h) in enumerate(((-13, -52, 9, 8, 22.0), (12, -58, 11, 9, 27.0), (30, -62, 9, 9, 19.0), (-34, -66, 12, 10, 24.0), (-4, -78, 14, 10, 30.0),
                                       (-14, 62, 10, 9, 24.0), (10, 56, 8, 8, 20.0), (30, 66, 11, 9, 26.0), (-32, 68, 10, 10, 21.0), (2, 82, 14, 10, 31.0))):
    bastion(x, z, rx, rz, h, 110 + i, keys=("far",), seg=14, fine=False)

# the old caravan stop beside the court. Left: a colonnade, three columns whole (two still carry their beam), two
# broken. Right: a trader's awning. Banners at the court's four quarters.
CX = -14.9
for z, key in ((0.0, "col_low"), (3.5, "col_whole"), (7.0, "col_whole"), (10.5, "col_half"), (14.0, "col_whole")):
    A.put(key, CX, z)
A.put("beam", CX, 5.25, y=3.7 * S, stretch=(1.0, 1.0 / S, 1.0))
A.put("stall", 15.1, 8.6, yaw=-PI / 2)
A.mark("lamp", 15.1 - 1.12 * S, 8.6, STALL_LAMP * S)
for x, z, yaw in ((13.9, 15.2, 0.0), (13.9, -0.4, 0.0), (-13.7, 17.6, PI), (-12.6, -9.8, PI)):
    A.put("banner", x, z, yaw=yaw)
A.put("jars_far", 14.3, 3.4, yaw=2.0)
# low things toward both cameras (nothing over 2 m on the z axis): way stones along the road, column stumps, jars
for sgn in (1, -1):
    for sx in (1, -1):
        A.put("waystone", sx * 2.9, 7 + sgn * 14.4)
        A.put("waystone", sx * 2.9, 7 + sgn * 19.6)
    A.put("stump", sgn * 6.4, 7 + sgn * 14.6, yaw=0.4)
    A.put("stump", sgn * -8.6, 7 + sgn * 16.0, yaw=1.1)
    A.put("jars_far", sgn * -5.6, 7 + sgn * 15.2, yaw=sgn * 1.3, scale=S * 0.85)

A.finish()
args = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
if args:
    A.render(args[0], floor="#2c2a2c")
