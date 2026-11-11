"""Fallen Battlefield: a field after the battle under a heavy evening sky. Built in the heroes' way (kit.py, STYLE.md):
clean turned and boxed forms in a few plain materials, gold on the edges, brazier fire as the only glow. Solemn and
tidy: what tells of the fight is how things lie, not dirt or damage. Its own colour is the banners' blue.

Cover (point-symmetric about (0, 7)): a war drum in the middle (low), two rows of great shields on a sill guarding the
starts (low), two banner standards on a stone foot flanking the middle (tall), two field catapults with the arm down
and a wheel off on the wings (low), two supply wagons in the far corners (low).

Round it: a siege tower fallen on its side along the left, a palisade with a gate and the road through it on the
right, more palisade on the left, braziers at the kerb, stake hedges (low) toward both cameras, where nothing may be
over 2 m, planted spears off the z axis, a camp of pavilions and tall banners far out, low hills beyond. Run:
    blender --background --factory-startup --python blender/arenas/real/battlefield.py [-- <check picture path> [draft]]
With `draft` nothing in the repo is written: the GLB and the json go next to the check pictures (the game's dev server
reloads every tab when a file under src/ or public/ changes).
"""
import math
import os
import random
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bpy  # noqa: E402
from mathutils import Matrix, Vector  # noqa: E402

import kit  # noqa: E402
from kit import Arena, G, S, pillar, twin, wall  # noqa: E402

ARGS = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
DRAFT = len(ARGS) > 1 and ARGS[1] == "draft"
if DRAFT:
    kit.REPO = os.path.dirname(os.path.abspath(ARGS[0]))
    os.makedirs(os.path.join(kit.REPO, "public", "models", "arenas"), exist_ok=True)

PI = math.pi
A = Arena("battlefield")
rnd = random.Random(11)
V = Vector

# the heroes' materials (STYLE.md) and the arena's own blue; src/arenas/battlefield.ts dims them a little
A.mat("wood", "#4a3220", rough=0.7)
A.mat("plank", "#6b4226", rough=0.75)
A.mat("lacquer", "#1d1b21", rough=0.45)
A.mat("blue", "#2a4a7a", rough=0.6)
A.mat("iron", "#3c3f47", rough=0.42, metal=0.75)
A.mat("gold", "#c9a24a", rough=0.32, metal=0.85)
A.mat("rope", "#b89a5a", rough=0.9)
A.mat("stone", "#2c3140", rough=0.85)
A.mat("cream", "#d8cfb4", rough=0.8)
A.mat("glow", "#ffcf80", rough=0.4, emit="#ffb03a", strength=1.0)
# the backdrop's own: the same wood and cream, which the game dims further (the far things must fade toward the sky)
A.mat("timber", "#4a3220", rough=0.75)
A.mat("canvas", "#d8cfb4", rough=0.85)


# ---- helpers the kit does not have --------------------------------------------------------------------------------
def plate(f, key, o, u, v, pts, th):
    """A flat plate `th` thick: the outline `pts` [(a, b)] in the plane through `o` spanned by `u` and `v`."""
    bm = f.bm(key)
    o, u, v = V(o), V(u).normalized(), V(v).normalized()
    n = u.cross(v).normalized() * (th / 2)
    front = [bm.verts.new(o + u * a + v * b + n) for a, b in pts]
    back = [bm.verts.new(o + u * a + v * b - n) for a, b in pts]
    bm.faces.new(front)
    bm.faces.new(list(reversed(back)))
    for i in range(len(pts)):
        j = (i + 1) % len(pts)
        bm.faces.new((front[j], front[i], back[i], back[j]))


def facing(n):
    """The rotation that turns z to `n` (for an ellipsoid lying in a plane)."""
    return V(n).normalized().to_track_quat("Z", "Y").to_matrix().to_4x4()


def wheel(f, c, axis, r, spokes=8, seg=20, cap=1, wood="wood"):
    """A spoked wheel round `c` on `axis`: a wooden rim, an iron tyre line, a gold hub cap on the `cap` side."""
    c, ax = V(c), V(axis).normalized()
    u = ax.orthogonal().normalized()
    w = ax.cross(u).normalized()
    f.torus(wood, c, r - 0.045 * r / 0.3, 0.045 * r / 0.3, normal=ax, seg=(seg, 6))
    for k in range(spokes):
        a = 2 * PI * k / spokes
        d = u * math.cos(a) + w * math.sin(a)
        f.tube(wood, [c + d * 0.05, c + d * (r - 0.06 * r / 0.3)], 0.022 * r / 0.3, seg=5, caps=False)
    f.tube(wood, [c - ax * 0.07 * r / 0.3, c + ax * 0.07 * r / 0.3], 0.075 * r / 0.3, seg=10)
    f.ellipsoid("gold", c + ax * cap * 0.07 * r / 0.3, (0.055 * r / 0.3,) * 3, seg=(10, 6))


def brazier_on(f, c, r=0.3):
    """An iron fire basket with a gold rim, its coals and one clean flame, the bowl's foot at `c`. Returns the flame's
    height above `c`."""
    c = V(c)
    f.turned("iron", c, c + V((0, 0, 0.3)), [(0, 0.3 * r), (0.35, 0.8 * r), (1, 1.06 * r)], seg=16)
    f.torus("gold", c + V((0, 0, 0.3)), 1.06 * r, 0.02, seg=(16, 5))
    f.ellipsoid("glow", c + V((0, 0, 0.3)), (0.9 * r, 0.9 * r, 0.3 * r), seg=(12, 6))
    f.turned("glow", c + V((0, 0, 0.3)), c + V((0, 0, 0.3 + 1.15 * r)), [(0, 0.42 * r), (0.25, 0.5 * r), (0.6, 0.3 * r), (1, 0.02)], seg=10)
    return 0.3 + 0.45 * r


# ---- cover props, at life size, standing on z = 0 -----------------------------------------------------------------
def drum():
    """A great war drum on a dark foot: a blue shell, a cream skin, gold hoops, rope lacing, two sticks laid across."""
    f = A.fig()
    f.turned("lacquer", (0, 0, 0), (0, 0, 0.17), [(0, 0.52), (0.7, 0.52), (1, 0.44)], seg=28)
    f.turned("blue", (0, 0, 0.15), (0, 0, 0.93), [(0, 0.43), (0.22, 0.57), (0.6, 0.64), (1, 0.635)], seg=28)
    f.turned("cream", (0, 0, 0.92), (0, 0, 0.955), [(0, 0.62), (1, 0.6)], seg=28)
    f.torus("gold", (0, 0, 0.93), 0.64, 0.026, seg=(28, 6))
    f.torus("gold", (0, 0, 0.33), 0.578, 0.022, seg=(28, 6))
    n, pts = 12, []
    for k in range(4 * n + 1):
        a = k * PI / (2 * n)
        r, z = ((0.668, 0.9), (0.672, 0.62), (0.6, 0.35), (0.672, 0.62))[k % 4]
        pts.append((r * math.cos(a), r * math.sin(a), z))
    f.tube("rope", pts, 0.013, seg=5, caps=False)
    for k, (p, q) in enumerate((((-0.36, -0.2), (0.3, 0.26)), ((-0.3, 0.3), (0.34, -0.22)))):
        z = 0.975 + 0.034 * k
        f.tube("lacquer", [(p[0], p[1], z), (q[0], q[1], z)], 0.017, seg=8)
        f.ellipsoid("gold", (q[0], q[1], z), (0.045, 0.045, 0.045), seg=(10, 6))
    return A.built("drum", f)


PAVISE_W = 0.72
STANDARD = 3.1   # a standard's pole; its gold point adds 0.36


def pavise():
    """A great shield with a round head, its width along y and its face toward +x: blue, a gold rim, a gold star and
    boss; a dark back and the strut that props it."""
    f = A.fig()
    w, h, th, x = PAVISE_W, 0.6, 0.045, 0.1
    line = [(-w / 2, 0.02), (w / 2, 0.02)] + [(w / 2 * math.cos(PI * k / 14), h + w / 2 * math.sin(PI * k / 14)) for k in range(15)]
    plate(f, "blue", (x, 0, 0), (0, 1, 0), (0, 0, 1), line, th)
    f.tube("gold", [(x, a, b) for a, b in line + line[:1]], 0.03, seg=6, caps=False)
    f.star("gold", (x + th / 2 + 0.004, 0, 0.52), 0.25, 0.07, thick=0.014, points=4, normal=(1, 0, 0), turn=PI / 2)
    f.ellipsoid("gold", (x + th / 2, 0, 0.52), (0.045, 0.085, 0.085), seg=(14, 8))
    inner = [(a * 0.84, 0.07 + (b - 0.02) * 0.9) for a, b in line]
    plate(f, "lacquer", (x - th / 2 - 0.004, 0, 0), (0, 1, 0), (0, 0, 1), inner, 0.012)
    f.tube("wood", [(x - th / 2, 0, 0.74), (x - 0.36, 0, 0.02)], 0.024, seg=8)
    f.torus("gold", (x - th / 2 - 0.035, 0, 0.66), 0.03, 0.01, normal=(-0.4, 0, -0.74), seg=(10, 5))
    return A.built("pavise", f)


SILL = 2.8


def sill():
    """The beam a row of shields stands on, along y: wood with gold caps."""
    f = A.fig()
    f.box("wood", (0, 0, 0.045), (0.54, SILL, 0.09))
    for sy in (1, -1):
        f.box("gold", (0, sy * (SILL / 2 - 0.03), 0.047), (0.56, 0.07, 0.098))
    return A.built("sill", f, bevel=0.012)


def standard(h=STANDARD):
    """A banner standard: a stone foot with three round shields leant on it, a tall pole with a gold point, a blue
    swallow-tailed banner on a crossbar (its face toward -y and +y)."""
    f = A.fig()
    f.turned("stone", (0, 0, 0), (0, 0, 0.36), [(0, 0.5), (0.12, 0.52), (0.88, 0.47), (1, 0.43)], seg=24)
    f.torus("gold", (0, 0, 0.3), 0.475, 0.018, seg=(24, 5))
    f.turned("wood", (0, 0, 0.3), (0, 0, h), [(0, 0.062), (1, 0.045)], seg=12)
    f.turned("gold", (0, 0, 0.36), (0, 0, 0.5), [(0, 0.1), (0.5, 0.075), (1, 0.066)], seg=12)
    f.turned("gold", (0, 0, h - 0.03), (0, 0, h + 0.36), [(0, 0.05), (0.12, 0.085), (0.3, 0.05), (0.45, 0.075), (1, 0.0)], seg=10)
    zc = h - 0.24
    f.tube("wood", [(-0.42, 0, zc), (0.42, 0, zc)], 0.024, seg=8)
    for sx in (1, -1):
        f.ellipsoid("gold", (sx * 0.42, 0, zc), (0.045, 0.045, 0.045), seg=(10, 6))
    # the cloth, in two halves that meet in the middle, hung just in front of the pole
    w, ln, cut, y = 0.33, 1.2, 0.95, -0.07
    plate(f, "blue", (0, y, zc), (1, 0, 0), (0, 0, -1), [(-w, 0.0), (0, 0.0), (0, cut), (-w, ln)], 0.016)
    plate(f, "blue", (0, y, zc), (1, 0, 0), (0, 0, -1), [(0, 0.0), (w, 0.0), (w, ln), (0, cut)], 0.016)
    edge = [(-w, 0.0), (w, 0.0), (w, ln), (0, cut), (-w, ln), (-w, 0.0)]
    f.tube("gold", [(a, y, zc - b) for a, b in edge], 0.014, seg=5, caps=False)
    for sy in (1, -1):
        f.star("gold", (0, y + sy * 0.012, zc - 0.45), 0.2, 0.06, thick=0.01, points=4, normal=(0, sy, 0), turn=PI / 2)
    for sx in (1, -1):
        f.torus("gold", (sx * 0.27, y / 2, zc), 0.042, 0.01, normal=(1, 0, 0), seg=(10, 4))
    # three round shields leant against the foot
    lean, r, rc = math.radians(24), 0.27, 0.53
    for k in range(3):
        a = PI / 2 + k * 2 * PI / 3
        n = V((math.cos(a) * math.cos(lean), math.sin(a) * math.cos(lean), math.sin(lean)))
        c = V((rc * math.cos(a), rc * math.sin(a), r * math.cos(lean) + 0.012))
        f.ellipsoid("blue", c, (r, r, 0.045), seg=(20, 6), rot=facing(n))
        f.torus("gold", c, r, 0.02, normal=n, seg=(20, 5))
        f.ellipsoid("gold", c + n * 0.035, (0.07, 0.07, 0.045), seg=(10, 6), rot=facing(n))
    return A.built("standard", f)


def catapult():
    """A light field catapult along y, its front toward -y. After the fight: the arm down across the frame, a wheel off
    and leant on its end, a block under that corner. Wood, a rope skein, a dark padded bar, gold caps."""
    f, bx = A.fig(), A.fig()     # round parts; boxes, which get a bevel
    zb = 0.39
    for sx in (1, -1):
        bx.box("wood", (sx * 0.3, 0, zb), (0.12, 2.2, 0.14))
        for sy in (1, -1):
            bx.box("gold", (sx * 0.3, sy * 1.1, zb), (0.132, 0.03, 0.152))
        # the frame that stops the arm: an upright, a brace
        bx.box("wood", (sx * 0.3, 0.42, zb + 0.07 + 0.29), (0.1, 0.1, 0.58))
        f.tube("wood", [(sx * 0.3, 0.46, zb + 0.56), (sx * 0.3, 1.0, zb + 0.07)], 0.035, seg=6)
    for y in (-1.0, -0.2, 1.0):
        bx.box("wood", (0, y, zb - 0.01), (0.6, 0.12, 0.12))
    zt = zb + 0.07 + 0.56
    f.tube("lacquer", [(-0.4, 0.42, zt), (0.4, 0.42, zt)], 0.075, seg=14)
    for sx in (1, -1):
        f.ellipsoid("gold", (sx * 0.4, 0.42, zt), (0.03, 0.078, 0.078), seg=(12, 6))
    # the skein the arm turns in, with its gold washers
    f.tube("lacquer", [(-0.37, -0.2, zb + 0.05), (0.37, -0.2, zb + 0.05)], 0.085, seg=14)
    for sx in (1, -1):
        f.torus("gold", (sx * 0.375, -0.2, zb + 0.05), 0.085, 0.022, normal=(1, 0, 0), seg=(14, 5))
    # the arm, down toward the front, its cup on the cross beam
    a, b = V((0, -0.2, zb + 0.07)), V((0, -1.08, zb + 0.17))
    f.tube("wood", [a - (b - a) * 0.12, b], [0.055, 0.042], seg=10)
    for t in (0.25, 0.7):
        f.torus("gold", a.lerp(b, t), 0.057 - 0.012 * t, 0.012, normal=b - a, seg=(12, 5))
    f.turned("iron", b + V((0, 0, -0.05)), b + V((0, 0, 0.07)), [(0, 0.05), (0.4, 0.13), (1, 0.15)], seg=14)
    f.torus("gold", b + V((0, 0, 0.07)), 0.15, 0.014, seg=(14, 5))
    f.ellipsoid("iron", b + V((0, 0, 0.09)), (0.115, 0.115, 0.115), seg=(14, 8))
    # three wheels on, the fourth leant against the back end; a block where it was
    for sx, y in ((1, -0.72), (1, 0.72), (-1, 0.72)):
        wheel(f, (sx * 0.405, y, 0.3), (sx, 0, 0), 0.3)
    for y in (-0.72, 0.72):
        f.tube("iron", [(-0.4, y, 0.3), (0.4, y, 0.3)], 0.03, seg=8)
    bx.box("wood", (-0.3, -0.72, 0.16), (0.2, 0.26, 0.32))
    wheel(f, (0, 1.2, 0.29), (0, 1, 0.3), 0.3)
    A.built("catapult", f)
    A.built("catapult_b", bx, bevel=0.012)


def wagon():
    """A supply wagon along y: a plank bed with a gold rail on four spoked wheels, two barrels in front, the load behind
    under a blue cover lashed with rope."""
    f, bx = A.fig(), A.fig()     # round parts; boxes, which get a bevel
    zb, w, ln = 0.47, 0.7, 2.26
    bx.box("plank", (0, 0, zb), (w, ln, 0.07))
    for sx in (1, -1):
        bx.box("plank", (sx * (w / 2 - 0.025), 0, zb + 0.17), (0.05, ln, 0.28))
        bx.box("gold", (sx * (w / 2 - 0.025), 0, zb + 0.32), (0.064, ln + 0.014, 0.025))
        for sy in (1, -1):
            bx.box("gold", (sx * (w / 2 - 0.02), sy * (ln / 2 - 0.02), zb + 0.15), (0.075, 0.075, 0.33))
    for sy in (1, -1):
        bx.box("plank", (0, sy * (ln / 2 - 0.025), zb + 0.17), (w - 0.1, 0.05, 0.28))
    for y in (-0.7, 0.7):
        f.tube("iron", [(-0.4, y, 0.36), (0.4, y, 0.36)], 0.032, seg=8)
        bx.box("wood", (0, y, 0.41), (0.56, 0.12, 0.07))
        for sx in (1, -1):
            wheel(f, (sx * 0.415, y, 0.36), (sx, 0, 0), 0.36)
    # the load under its cover
    f.tube("blue", [(0, -0.16, zb + 0.3), (0, -0.1, zb + 0.3), (0, 0.98, zb + 0.3), (0, 1.04, zb + 0.3)], [0.275, 0.32, 0.32, 0.275], seg=20, squash=((0, 0, 1), 0.8))
    for y in (0.1, 0.44, 0.78):
        f.tube("rope", [(0, y - 0.02, zb + 0.3), (0, y + 0.02, zb + 0.3)], 0.332, seg=20, squash=((0, 0, 1), 0.8))
    for sx in (1, -1):
        c = V((sx * 0.16, -0.76, zb + 0.035))
        f.turned("wood", c, c + V((0, 0, 0.5)), [(0, 0.125), (0.12, 0.143), (0.5, 0.158), (0.88, 0.143), (1, 0.125)], seg=18)
        for t, r in ((0.14, 0.148), (0.86, 0.148)):
            f.torus("gold", c + V((0, 0, 0.5 * t)), r, 0.012, seg=(18, 5))
    A.built("wagon", f)
    A.built("wagon_b", bx, bevel=0.012)


# ---- the backdrop's props -------------------------------------------------------------------------------------------
def brazier():
    """A fire basket on an iron tripod. Returns the flame's height."""
    f = A.fig()
    for k in range(3):
        a = k * 2 * PI / 3 + 0.4
        f.tube("iron", [(0.34 * math.cos(a), 0.34 * math.sin(a), 0), (0.1 * math.cos(a), 0.1 * math.sin(a), 0.68)], 0.022, seg=6)
    f.torus("iron", (0, 0, 0.36), 0.225, 0.014, seg=(14, 5))
    up = brazier_on(f, (0, 0, 0.64))
    A.built("brazier", f)
    return 0.64 + up


def hedge(n=5, ln=2.5):
    """A stake hedge along y: a beam with crossed, pointed stakes through it. Low: it may stand before a camera."""
    f = A.fig()
    f.tube("timber", [(0, -ln / 2, 0.5), (0, ln / 2, 0.5)], 0.085, seg=10)
    for sy in (1, -1):
        f.ellipsoid("gold", (0, sy * ln / 2, 0.5), (0.09, 0.03, 0.09), seg=(10, 6))
    for k in range(n):
        y = -ln / 2 + 0.3 + (ln - 0.6) * k / (n - 1)
        for sx in (1, -1):
            f.tube("timber", [(-sx * 0.5, y + sx * 0.07, 0.0), (0, y + sx * 0.07, 0.5), (sx * 0.42, y + sx * 0.07, 0.92), (sx * 0.5, y + sx * 0.07, 1.0)], [0.04, 0.04, 0.04, 0.004], seg=5)
    return A.built("hedge", f)


def palisade(n=7, step=0.44):
    """A length of palisade along y: pointed stakes, a rail on each side lashed with rope."""
    f = A.fig()
    ln = n * step
    for k in range(n):
        y, h = -ln / 2 + (k + 0.5) * step, 2.2 + (0.16 if k % 2 else 0.0)
        f.turned("timber", (0, y, -0.2), (0, y, h), [(0, 0.2), (0.86, 0.19), (1, 0.01)], seg=7)
    for z in (0.75, 1.55):
        f.box("plank", (0.2, 0, z), (0.07, ln, 0.13))
        f.tube("rope", [(0.245, -ln / 2, z), (0.245, ln / 2, z)], 0.02, seg=4)
    return A.built("palisade", f)


def spears(n=5):
    """Spears planted in a row along y, each a little off the upright: iron points, gold collars, blue pennons."""
    f = A.fig()
    for k in range(n):
        y = (k - (n - 1) / 2) * 0.42
        top = V((rnd.uniform(-0.12, 0.12), y + rnd.uniform(-0.1, 0.1), 2.25))
        base = V((0, y, -0.1))
        d = (top - base).normalized()
        f.tube("timber", [base, top], 0.02, seg=5)
        f.turned("iron", top, top + d * 0.32, [(0, 0.014), (0.25, 0.04), (1, 0.002)], seg=6)
        f.torus("gold", top, 0.024, 0.01, normal=d, seg=(8, 4))
        if k % 2 == 0:
            plate(f, "blue", top - d * 0.06, (1, 0, 0), -d, [(0.02, 0.0), (0.5, 0.14), (0.02, 0.28)], 0.012)
    return A.built("spears", f)


def tent(key, r=2.5, wall_h=2.1, h=5.0, band="blue"):
    """A round pavilion: cream walls and roof, a band of colour at the eave, a gold point with a pennon."""
    f = A.fig()
    f.turned("canvas", (0, 0, -0.3), (0, 0, wall_h), [(0, r), (1, r)], seg=18, caps=False)
    f.turned(band, (0, 0, wall_h - 0.35), (0, 0, wall_h + 0.12), [(0, r + 0.05), (0.75, r + 0.24), (1, r + 0.2)], seg=18, caps=False)
    f.turned("canvas", (0, 0, wall_h + 0.1), (0, 0, h), [(0, r + 0.2), (0.45, r * 0.42), (0.85, 0.2), (1, 0.08)], seg=18)
    f.turned("gold", (0, 0, h - 0.05), (0, 0, h + 0.5), [(0, 0.1), (0.3, 0.16), (0.6, 0.07), (1, 0.0)], seg=8)
    f.box("lacquer", (0, -r - 0.01, 0.95), (1.0, 0.06, 1.9))
    return A.built(key, f)


def flag(h=7.0):
    """A tall camp banner: a pole, a gold point, a long blue cloth (facing -y and +y)."""
    f = A.fig()
    f.turned("timber", (0, 0, -0.3), (0, 0, h), [(0, 0.1), (1, 0.06)], seg=8)
    f.turned("gold", (0, 0, h - 0.03), (0, 0, h + 0.5), [(0, 0.07), (0.2, 0.13), (1, 0.0)], seg=8)
    f.tube("timber", [(-0.1, 0, h - 0.3), (1.0, 0, h - 0.3)], 0.035, seg=6)
    plate(f, "blue", (0.12, 0, h - 0.33), (1, 0, 0), (0, 0, -1), [(0, 0), (0.84, 0), (0.84, 3.1), (0.42, 2.7), (0, 3.1)], 0.03)
    f.box("gold", (0.54, 0, h - 0.33 - 0.5), (0.84, 0.04, 0.07))
    return A.built("flag", f)


def gate(h=4.3, half=2.0):
    """The gate in the palisade, the way through along y: two stout posts with gold caps, a beam, a banner under it."""
    f = A.fig()
    for sx in (1, -1):
        f.turned("timber", (sx * half, 0, -0.3), (sx * half, 0, h), [(0, 0.26), (1, 0.21)], seg=12)
        f.ellipsoid("gold", (sx * half, 0, h), (0.23, 0.23, 0.12), seg=(12, 6))
        f.torus("gold", (sx * half, 0, h * 0.32), 0.265, 0.03, seg=(12, 5))
    f.box("timber", (0, 0, h - 0.55), (2 * half + 0.9, 0.24, 0.26))
    f.box("gold", (0, 0, h - 0.41), (2 * half + 0.94, 0.26, 0.03))
    w, top = 0.75, h - 0.72
    plate(f, "blue", (0, 0, top), (1, 0, 0), (0, 0, -1), [(-w, 0), (w, 0), (w, 1.5), (0, 1.15), (-w, 1.5)], 0.03)
    f.tube("gold", [(-w, 0, top), (w, 0, top), (w, 0, top - 1.5), (0, 0, top - 1.15), (-w, 0, top - 1.5), (-w, 0, top)], 0.02, seg=5, caps=False)
    for sy in (1, -1):
        f.star("gold", (0, sy * 0.02, top - 0.55), 0.36, 0.11, thick=0.012, points=4, normal=(0, sy, 0), turn=PI / 2)
    return A.built("gate", f)


def tower(h=9.0, w0=1.6, w1=1.2, z0=0.6):
    """A siege tower, built upright (its front toward -y): four posts drawing in toward the top, five floors with a gold
    line round each, the front in dark panels, the sides in boards with round shields hung on them, the back open with
    its ladder, a low dark roof with a pennon, four great wheels. It is laid on its side when it is placed."""
    f = A.fig()
    half = lambda z: w0 + (w1 - w0) * (z - z0) / (h - z0)   # noqa: E731
    for sx in (1, -1):
        for sy in (1, -1):
            f.turned("timber", (sx * w0, sy * w0, z0 - 0.25), (sx * w1, sy * w1, h + 0.1), [(0, 0.17), (1, 0.14)], seg=8)
    floors = [z0 + (h - z0) * k / 4 for k in range(5)]
    for z in floors:
        hw = half(z) + 0.16
        f.box("plank", (0, 0, z), (2 * hw, 2 * hw, 0.16))
        f.tube("gold", [(-hw, -hw, z + 0.09), (hw, -hw, z + 0.09), (hw, hw, z + 0.09), (-hw, hw, z + 0.09), (-hw, -hw, z + 0.09)], 0.035, seg=4, caps=False)
    for za, zb in zip(floors, floors[1:]):
        ha, hb = half(za), half(zb)
        ln = math.hypot(zb - za, hb - ha)
        # the front, then the two sides
        plate(f, "lacquer", (0, -ha, za), (1, 0, 0), (0, ha - hb, zb - za), [(-ha + 0.1, 0.05), (ha - 0.1, 0.05), (hb - 0.1, ln - 0.05), (-hb + 0.1, ln - 0.05)], 0.07)
        for sx in (1, -1):
            plate(f, "timber", (sx * ha, 0, za), (0, 1, 0), (sx * (hb - ha), 0, zb - za), [(-ha + 0.1, 0.05), (ha - 0.1, 0.05), (hb - 0.1, ln - 0.05), (-hb + 0.1, ln - 0.05)], 0.07)
    for sx in (1, -1):
        for k, z in enumerate((floors[3] + 1.05, floors[2] + 1.05, floors[1] + 1.05)):
            for y in (-0.5, 0.5):
                c = V((sx * (half(z) + 0.07), y * (1 - 0.12 * k), z))
                f.ellipsoid("blue", c, (0.06, 0.4, 0.4), seg=(16, 6))
                f.torus("gold", c, 0.4, 0.028, normal=(1, 0, 0), seg=(16, 4))
                f.ellipsoid("gold", c + V((sx * 0.05, 0, 0)), (0.05, 0.1, 0.1), seg=(8, 5))
    # the ladder up the open back
    for sx in (1, -1):
        f.tube("timber", [(sx * 0.32, w0 - 0.25, z0), (sx * 0.32, w1 - 0.25, h)], 0.045, seg=5)
    for k in range(18):
        z = z0 + 0.3 + k * 0.46
        f.tube("timber", [(-0.32, half(z) - 0.25, z), (0.32, half(z) - 0.25, z)], 0.03, seg=4)
    # the top: a low dark roof with a gold line at its eave, the pennon
    hw = w1 + 0.3
    f.loft("lacquer", [((0, 0, h + 0.08), hw * 1.4142, hw * 1.4142), ((0, 0, h + 0.5), 0.12, 0.12)], seg=4, arc=(PI / 4, 2.25 * PI))
    f.turned("timber", (0, 0, h + 0.4), (0, 0, h + 2.9), [(0, 0.08), (1, 0.05)], seg=6)
    f.turned("gold", (0, 0, h + 2.87), (0, 0, h + 3.3), [(0, 0.06), (0.2, 0.11), (1, 0.0)], seg=6)
    plate(f, "blue", (0, 0, h + 2.8), (1, 0, 0), (0, 0, -1), [(0.05, 0), (1.5, 0.3), (0.05, 0.75)], 0.03)
    # the wheels
    for sx in (1, -1):
        for sy in (1, -1):
            wheel(f, (sx * (w0 + 0.36), sy * 1.05, 0.72), (sx, 0, 0), 0.72, spokes=10, seg=24, wood="timber")
    for sy in (1, -1):
        f.tube("iron", [(-w0 - 0.36, sy * 1.05, 0.72), (w0 + 0.36, sy * 1.05, 0.72)], 0.07, seg=6)
    return A.built("tower", f)


def hill(key, rx, ry, rz):
    """A far, low hill: one flat tone against the sky."""
    f = A.fig()
    f.ellipsoid("stone", (0, 0, -rz * 0.25), (rx, ry, rz), seg=(18, 8), keep=lambda co: co.z > -0.5)
    return A.built(key, f)


drum()
pavise()
sill()
standard()
catapult()
wagon()
FLAME = brazier()
hedge()
palisade()
spears()
tent("tent0")
tent("tent1", r=3.2, wall_h=2.3, h=6.2)
flag()
gate()
tower()
for i, (rx, ry, rz) in enumerate(((30, 16, 7.5), (22, 14, 5.5), (38, 18, 10))):
    hill(f"hill{i}", rx, ry, rz)


# ---- cover --------------------------------------------------------------------------------------------------------
def along(o):
    """A wall's middle, its yaw (a prop's y axis along it) and its length with the round ends."""
    ax, az, bx, bz = o["ax"], o["az"], o["bx"], o["bz"]
    return (ax + bx) / 2, (az + bz) / 2, math.atan2(bx - ax, bz - az), math.hypot(bx - ax, bz - az) + 2 * o["r"]


def drums(o, turn):
    A.put("drum", o["ax"], o["az"], yaw=turn)


def shields(o, turn):
    """Four great shields on their sill, leant back on their struts, facing the middle of the field."""
    cx, cz, yaw, length = along(o)
    ux, uz = math.sin(yaw), math.cos(yaw)
    A.put("sill", cx, cz, yaw=yaw, stretch=(1.0, length / (SILL * S), 1.0))
    n = 4
    step = (length - 0.1) / n
    for i in range(n):
        t = (i - (n - 1) / 2) * step
        A.put("pavise", cx + ux * t, cz + uz * t, yaw=yaw, y=0.09 * S, tilt=(0.0, -0.15), stretch=(1.0, step / (PAVISE_W * S) * 0.97, 1.0))


def standards(o, turn):
    A.put("standard", o["ax"], o["az"], yaw=turn + 0.5, scale=o["height"] / (STANDARD + 0.36))


def catapults(o, turn):
    cx, cz, yaw, length = along(o)
    A.put("catapult", cx, cz, yaw=yaw)
    A.put("catapult_b", cx, cz, yaw=yaw)


def wagons(o, turn):
    cx, cz, yaw, length = along(o)
    A.put("wagon", cx, cz, yaw=yaw)
    A.put("wagon_b", cx, cz, yaw=yaw)


LAYOUT = [
    (pillar(0, 7, 0.9, 1.3), drums),
    (wall(1.8, 9.9, 4.6, 10.7, 0.4, 1.3), shields),
    (pillar(-4.4, 8.6, 0.7, 4.5), standards),
    (wall(7.2, 8.4, 9.0, 7.2, 0.4, 1.4), catapults),
    (wall(-5.6, 12.6, -7.4, 11.2, 0.4, 1.4), wagons),
]
o, build = LAYOUT[0]
A.cover(o)
build(o, 0.4)
for o, build in LAYOUT[1:]:
    A.cover(o)
    build(o, 0.0)
    A.cover(twin(o))
    build(twin(o), PI)

# ---- backdrop -----------------------------------------------------------------------------------------------------
A.back()


def polar(a, r):
    """The spot `r` from the ring's centre at angle `a` (0 toward the +z camera, a quarter turn toward +x)."""
    return r * math.sin(a), 7 + r * math.cos(a)


# braziers at the kerb, on the four diagonals
for a in (0.72, PI - 0.72, PI + 0.72, -0.72):
    x, z = polar(a, 13.75)
    A.put("brazier", x, z, yaw=a)
    A.mark("brazier", x, z, FLAME * S)

# the siege tower, fallen on its side along the left (well off the z axis: it is over 2 m high even so)
t = A.put("tower", -18.8, 1.6, scale=1.0, tilt=(0.0, PI / 2), yaw=-PI / 2 + 0.16)
t.data.transform(Matrix.Translation((0, 0, -min(v.co.z for v in t.data.vertices) - 0.02)))

# the palisade: an arc on each side, the gate and the road through it on the right
PAL = 7 * 0.44 * S
for side, r in ((1, 17.5), (-1, 23.0)):     # the left one stands behind the tower
    for k in range(-6, 7):
        a = side * PI / 2 + k * (PAL / r)
        x, z = polar(a, r)
        if abs(x) > 13.4 and not (side == 1 and k == 0):
            A.put("palisade", x, z, yaw=a + PI / 2)
gx, gz = polar(PI / 2, 17.4)
A.put("gate", gx, gz, yaw=PI / 2, scale=1.0)
for sz in (1, -1):
    A.put("brazier", gx - 1.6, gz + sz * 3.3, yaw=sz)
    A.mark("brazier", gx - 1.6, gz + sz * 3.3, FLAME * S)

# stake hedges, low, toward both cameras and between the braziers
for a in (0.0, 0.36, -0.36, PI, PI + 0.36, PI - 0.36, 1.12, -1.12, PI + 1.12, PI - 1.12):
    x, z = polar(a, 15.6)
    A.put("hedge", x, z, yaw=a + PI / 2)

# planted spears, off the z axis
for a, r in ((1.02, 16.3), (2.1, 16.3), (-1.0, 16.6), (-2.12, 16.6), (1.35, 21.5), (1.8, 21.5), (-0.74, 21.0)):
    x, z = polar(a, r)
    A.put("spears", x, z, yaw=a + PI / 2 + rnd.uniform(-0.3, 0.3))

# the camp far out: pavilions and tall banners, beyond 26 m or well off the z axis
for k, (a, r) in enumerate(((0.5, 33), (1.05, 29), (1.45, 36), (2.0, 30), (2.6, 34), (3.3, 38), (3.9, 31), (4.45, 35), (5.0, 29.5), (5.65, 34), (0.05, 42), (1.7, 45), (4.2, 46))):
    x, z = polar(a, r)
    A.put(f"tent{k % 2}", x, z, yaw=a + PI, scale=1.0)
for a, r in ((0.78, 30), (1.25, 33.5), (2.3, 28.5), (3.6, 34), (4.7, 31.5), (5.3, 33), (1.42, 24.5), (1.72, 24.5), (-1.25, 26.5)):
    x, z = polar(a, r)
    A.put("flag", x, z, yaw=a + 0.3, scale=1.0)

# low hills against the sky
for k, (a, r) in enumerate(((0.3, 86), (1.2, 92), (2.2, 84), (3.0, 95), (3.9, 88), (4.8, 90), (5.6, 96))):
    x, z = polar(a, r)
    A.put(f"hill{k % 3}", x, z, yaw=a, scale=1.0)

out = A.finish()

# ---- checks -------------------------------------------------------------------------------------------------------
back = next(ob for ob in out if ob.name == "back")
bad = [v.co for v in back.data.vertices if v.co.z > 2.0 and abs(v.co.x) <= 12 and math.hypot(v.co.x, -v.co.y - 7) <= 26]
print(f"CAMERA RULE: {len(bad)} backdrop vertices over 2 m near the z axis" + (f", e.g. {sorted({(round(c.x), round(-c.y)) for c in bad})[:8]}" if bad else ""))
for i, ob in enumerate(A.obstacles):
    mesh = next(m for m in out if m.name == f"cover{i}")
    cx, cz, yaw, length = along(ob)
    ux, uz = math.sin(yaw), math.cos(yaw)
    pts = [(v.co.x - cx, -v.co.y - cz, v.co.z) for v in mesh.data.vertices]
    al = [p[0] * ux + p[1] * uz for p in pts]
    ac = [p[0] * uz - p[1] * ux for p in pts]
    print(f"COVER {i} {ob['kind']} r {ob['r']} length {length:.2f} height {ob['height']}: mesh along {min(al):.2f}..{max(al):.2f}, across {min(ac):.2f}..{max(ac):.2f}, "
          f"up {max(p[2] for p in pts):.2f}")

if ARGS:
    A.render(ARGS[0], floor="#2b2826")
    if DRAFT:
        cam, sc = A.scene.camera, A.scene
        for tag, pos, look in (("near", G(3.5, 16.5, 4.2), G(1.0, 8.6, 0.6)), ("wing", G(13.5, 13.0, 4.0), G(6.5, 6.0, 0.6)), ("left", G(-3, 24, 10), G(-15, 6, 1)),
                               ("corner", G(-11.5, 17.5, 3.6), G(-5.6, 10.2, 0.8)), ("right", G(6, 22, 7), G(17, 7, 1.5))):
            cam.location = pos
            cam.rotation_euler = (look - pos).to_track_quat("-Z", "Y").to_euler()
            sc.render.filepath = f"{ARGS[0]}_{tag}.jpg"
            bpy.ops.render.render(write_still=True)
