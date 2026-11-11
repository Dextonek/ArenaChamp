"""The Great Dial: the Sun Warden's court for a party of up to 40 (user, 2026-11-11: "make like custom arena in blender
... for the boss, it don't need to follow the other arenas"). Not a duel ring made wider: one vast sundial, 46 m from
the Sun Well in its middle to its rim, that the fallen sun broke.

From the middle outward (everything a hero can hide behind is an obstacle):
  0      the Sun Well (low)
  6.5    six hour screens (low walls, they break)            | the court for two, as it was,
  11     eight sun obelisks (tall)                           | so the Warden's fight keeps its middle
  19     THE FALLEN HALO: a broken gold ring 38 m across lying on the floor, in five arcs with gaps to run through (low)
  27     the twelve HOUR STONES of the dial, each cut with its count of notches, a sun disc lit in its head (tall)
  34     ten RAY SHARDS, gold blades of the sun stuck slanting in the floor (walls), and ten braziers between them (low)
  41     the broken colonnade: sixteen column stumps of different heights, fallen drums beside them
Round it: the gnomon, a blade of dark stone 40 m high rising north behind the Warden's empty throne; twelve hour pylons
on the rim (low stubs on the camera's side); a second great halo standing half sunk in the ground to the north-east.
Nothing tall on the camera's side (+z). Run:
    blender --background --factory-startup --python blender/arenas/real/greatdial.py [-- <check picture path>]
"""
import math
import os
import random
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bmesh  # noqa: E402
from mathutils import Matrix, Vector  # noqa: E402

from kit import Arena, pillar, wall  # noqa: E402

PI, TAU = math.pi, math.tau
A = Arena("greatdial")
rnd = random.Random(12)
V = Vector
CX, CZ, RIM = 0.0, 7.0, 46.0

A.mat("stone", "#2c3140", rough=0.85)
A.mat("slate", "#3a4052", rough=0.8)
A.mat("lacquer", "#1d1b21", rough=0.45)
A.mat("gold", "#c9a24a", rough=0.32, metal=0.85)
A.mat("copper", "#8a4a1c", rough=0.4, metal=0.8)      # the arena's own colour: the sun's metal, burnt
A.mat("cream", "#d8cfb4", rough=0.8)
A.mat("glow", "#ffcf80", rough=0.4, emit="#ffb03a", strength=1.0)


def at(a, r):
    """The game's (x, z) at angle `a` from the camera's side (+z), `r` from the middle."""
    return CX + r * math.sin(a), CZ + r * math.cos(a)


def solid(f, key, pts):
    """A clean faceted solid: the hull of the points."""
    bm = f.bm(key)
    vs = [bm.verts.new(V(p)) for p in pts]
    bmesh.ops.convex_hull(bm, input=vs)


def block(f, key, w, d, h, z0=0.0, top=(1.0, 1.0), y0=0.0):
    """A box `w` by `d` standing from `z0` to `z0 + h`, its top face scaled by `top`."""
    pts = []
    for sx in (-1, 1):
        for sy in (-1, 1):
            pts.append((sx * w / 2, y0 + sy * d / 2, z0))
            pts.append((sx * w / 2 * top[0], y0 + sy * d / 2 * top[1], z0 + h))
    solid(f, key, pts)


# ---- props, in metres, standing on z = 0; +y looks to the middle of the dial ---------------------------------------
def well():
    f = A.fig()
    f.turned("stone", (0, 0, 0), (0, 0, 1.3), [(0, 1.05), (0.12, 1.05), (0.2, 0.9), (0.85, 0.9), (0.9, 1.0), (1, 1.0)], seg=28)
    f.torus("gold", (0, 0, 1.3), 0.95, 0.07, seg=(36, 8))
    f.torus("gold", (0, 0, 0.2), 1.0, 0.04, seg=(36, 6))
    f.turned("glow", (0, 0, 1.18), (0, 0, 1.26), [(0, 0.86), (1, 0.86)], seg=28)
    A.built("well", f)


def screen():
    """An hour screen: a low wall of dark stone, a gold cap, a sun's half disc let into each face."""
    f = A.fig()
    block(f, "stone", 0.7, 3.4, 1.35, top=(0.8, 0.97))
    block(f, "gold", 0.62, 3.34, 0.08, z0=1.35)
    for sx in (-1, 1):
        f.turned("copper", (sx * 0.3, 0, 0.62), (sx * 0.37, 0, 0.62), [(0, 0.42), (1, 0.4)], seg=20)
    A.built("screen", f, bevel=0.012)


def obelisk(key, h, r=0.55, notches=0, disc=True):
    """A square obelisk of dark stone: a gold band, a gold point, a lit sun disc in its head, `notches` cut under it."""
    f = A.fig()
    block(f, "stone", r * 2.3, r * 2.3, 0.3)
    block(f, "slate", r * 1.9, r * 1.9, h - 0.9, z0=0.3, top=(0.74, 0.74))
    w = r * 1.9 * 0.74
    block(f, "gold", w * 1.06, w * 1.06, 0.1, z0=h - 0.6)
    solid(f, "gold", [(sx * w / 2, sy * w / 2, h - 0.5) for sx in (-1, 1) for sy in (-1, 1)] + [(0, 0, h)])
    if disc:
        for sy in (-1, 1):
            f.turned("glow", (0, sy * (w * 0.5 + 0.06), h - 1.25), (0, sy * (w * 0.5 + 0.1), h - 1.25), [(0, 0.2), (1, 0.19)], seg=16)
    for k in range(notches):
        zz = h - 1.75 - k * 0.2
        ww = r * 1.9 * (0.74 + 0.26 * (1 - (zz - 0.3) / (h - 0.9)))
        block(f, "gold", ww * 0.6, ww + 0.03, 0.06, z0=zz)
    A.built(key, f, bevel=0.012)


def halo_seg(length):
    """A piece of the fallen halo: a thick gold beam lying on the floor, rune blocks of dark stone let into its back."""
    f = A.fig()
    block(f, "gold", 1.1, length, 0.95, top=(0.72, 1.0))
    block(f, "copper", 1.2, length * 0.985, 0.14)
    for k in (-1, 0, 1):
        block(f, "lacquer", 0.5, length * 0.16, 0.06, z0=0.95, y0=k * length * 0.3)
    A.built("halo", f, bevel=0.015)


def shard():
    """A ray of the sun, broken off: a long gold blade stuck slanting in the floor, its edge burnt copper."""
    f = A.fig()
    solid(f, "gold", [(-0.5, -2.1, 0), (0.5, -2.1, 0), (-0.38, 2.1, 0), (0.38, 2.1, 0), (0, -1.9, 1.7), (0, 1.6, 0.5)])
    solid(f, "copper", [(-0.56, -2.15, 0), (0.56, -2.15, 0), (-0.44, 2.15, 0), (0.44, 2.15, 0), (-0.5, -2.1, 0.16), (0.5, -2.1, 0.16), (-0.38, 2.1, 0.12), (0.38, 2.1, 0.12)])
    A.built("shard", f, bevel=0.01)


def brazier():
    f = A.fig()
    f.turned("lacquer", (0, 0, 0), (0, 0, 0.9), [(0, 0.5), (0.1, 0.5), (0.2, 0.22), (0.75, 0.2), (1, 0.62)], seg=24)
    f.turned("gold", (0, 0, 0.9), (0, 0, 1.12), [(0, 0.62), (0.5, 0.72), (1, 0.7)], seg=24)
    f.ellipsoid("glow", (0, 0, 1.12), (0.58, 0.58, 0.16), seg=(20, 8))
    A.built("brazier", f)


def stump(key, h):
    """A column of the old colonnade, broken off at `h`: a base, a fluted drum, gold where the next drum sat."""
    f = A.fig()
    f.turned("stone", (0, 0, 0), (0, 0, 0.35), [(0, 0.82), (0.6, 0.82), (1, 0.66)], seg=24)
    f.turned("cream", (0, 0, 0.35), (0, 0, h), [(0, 0.6), (1, 0.56)], seg=12)
    f.torus("gold", (0, 0, h), 0.55, 0.05, seg=(24, 6))
    A.built(key, f)


def drum():
    f = A.fig()
    f.turned("cream", (0, -0.55, 0.56), (0, 0.55, 0.56), [(0, 0.56), (1, 0.56)], seg=12)
    A.built("drum", f)


def pylon(key, h):
    """An hour pylon on the rim: a great stepped pier with a lantern head."""
    f = A.fig()
    block(f, "stone", 4.0, 4.0, 0.8)
    block(f, "slate", 3.2, 3.2, h - 2.2, z0=0.8, top=(0.7, 0.7))
    block(f, "gold", 2.5, 2.5, 0.22, z0=h - 1.4)
    block(f, "glow", 1.5, 1.5, 0.9, z0=h - 1.18)
    solid(f, "lacquer", [(sx * 1.25, sy * 1.25, h - 0.28) for sx in (-1, 1) for sy in (-1, 1)] + [(0, 0, h + 0.9)])
    A.built(key, f, bevel=0.03)


def gnomon():
    """The dial's blade: a wedge of dark stone rising away from the court to 40 m, a gold edge along its back."""
    f = A.fig()
    solid(f, "lacquer", [(-2.2, 0, 0), (2.2, 0, 0), (-2.2, -34, 0), (2.2, -34, 0), (-0.5, -34, 40), (0.5, -34, 40)])
    solid(f, "gold", [(-0.6, 0.4, 0.2), (0.6, 0.4, 0.2), (-0.6, -34.2, 40.5), (0.6, -34.2, 40.5), (-0.3, 0.1, 0.9), (0.3, 0.1, 0.9), (-0.3, -34.0, 41.2), (0.3, -34.0, 41.2)])
    # the Warden's empty throne at its foot, on five steps
    for k in range(5):
        block(f, "stone", 14 - k * 1.6, 9 - k * 1.2, 0.5, z0=k * 0.5, y0=5.0)
    block(f, "slate", 3.6, 2.6, 1.0, z0=2.5, y0=4.4)
    block(f, "slate", 3.6, 0.8, 5.5, z0=2.5, y0=3.4, top=(0.8, 1.0))
    f.torus("gold", (0, 3.0, 8.4), 1.5, 0.16, normal=(0, 1, 0), seg=(36, 8))
    for sx in (-1, 1):
        block(f, "gold", 0.5, 2.6, 0.3, z0=3.5, y0=4.4, top=(1, 1))
        f.bm("gold").verts.ensure_lookup_table()
    A.built("gnomon", f, bevel=0.03)


def great_halo():
    f = A.fig()
    f.torus("gold", (0, 0, 0), 15.0, 1.1, normal=(0, 1, 0), seg=(56, 10))
    f.torus("copper", (0, 0, 0), 15.0, 1.25, normal=(0, 1, 0), seg=(56, 6), arc=(0.2, 1.1))
    A.built("greathalo", f)


well(); screen(); halo_seg(3.3); shard(); brazier(); drum(); gnomon(); great_halo()
obelisk("obelisk", 3.4)
for n in range(1, 5):
    obelisk(f"hour{n}", 4.3, r=0.8, notches=n)
for k, h in enumerate((1.1, 1.9, 2.8)):
    stump(f"stump{k}", h)
pylon("pylon", 12.0)
pylon("pylonlow", 3.0)

# ---- the layout ------------------------------------------------------------------------------------------------------
A.cover(pillar(CX, CZ, 1.0, 1.45))
A.put("well", CX, CZ, scale=1.0)

# the court for two, as it was: six screens on 6.5 m, eight obelisks on 11 m
for deg in (30, 90, 150, 210, 270, 330):
    a = math.radians(deg)
    x, z = at(a, 6.5)
    tx, tz = math.cos(a) * 1.6, -math.sin(a) * 1.6
    A.cover(wall(x - tx, z - tz, x + tx, z + tz, 0.4, 1.4))
    A.put("screen", x, z, yaw=math.atan2(2 * tx, 2 * tz), scale=1.0)
for k in range(8):
    a = math.radians(22.5 + k * 45)
    x, z = at(a, 11)
    A.cover(pillar(x, z, 0.6, 3.4))
    A.put("obelisk", x, z, yaw=a, scale=1.0)
    A.mark("lantern", x, z, 2.2)

# the fallen halo on 19 m: five arcs of four pieces, the gaps on the camera's axis and between
HALO = 19.0
for arc in range(5):
    mid = math.radians(36 + arc * 72)
    for k in range(4):
        a0, a1 = mid + math.radians(-20 + k * 10), mid + math.radians(-10 + k * 10)
        (ax, az), (bx, bz) = at(a0, HALO), at(a1, HALO)
        A.cover(wall(ax, az, bx, bz, 0.5, 1.0))
        A.put("halo", (ax + bx) / 2, (az + bz) / 2, yaw=math.atan2(bx - ax, bz - az), scale=1.0, tilt=(0.0, rnd.uniform(-0.05, 0.05)))

# the twelve hour stones on 27 m, none on the camera's axis
for k in range(12):
    a = math.radians(15 + k * 30)
    x, z = at(a, 27)
    A.cover(pillar(x, z, 0.9, 4.3))
    A.put(f"hour{k % 4 + 1}", x, z, yaw=a, scale=1.0)
    A.mark("lantern", x, z, 3.05)

# ray shards and braziers in turn on 34 m
for k in range(20):
    a = math.radians(9 + k * 18)
    x, z = at(a, 34)
    if k % 2:
        A.cover(pillar(x, z, 0.7, 1.2))
        A.put("brazier", x, z, scale=1.0)
        A.mark("lamp", x, z, 1.3)
    else:
        turn = a + PI / 2 + rnd.uniform(-0.5, 0.5)
        dx, dz = math.sin(turn) * 2.0, math.cos(turn) * 2.0
        A.cover(wall(x - dx, z - dz, x + dx, z + dz, 0.45, 1.5))
        A.put("shard", x, z, yaw=turn + PI, scale=1.0)

# the broken colonnade on 41 m
for k in range(16):
    a = math.radians(11.25 + k * 22.5)
    x, z = at(a, 41)
    kind = (k * 5 + 1) % 3
    A.cover(pillar(x, z, 0.7, (1.1, 1.9, 2.8)[kind]))
    A.put(f"stump{kind}", x, z, scale=1.0)
    if k % 2 == 0:
        dx, dz = at(a + 0.05, 43.2)
        A.put("drum", dx, dz, yaw=a + rnd.uniform(0, PI), scale=1.0)

# ---- round it --------------------------------------------------------------------------------------------------------
A.back()
gx, gz = at(PI, RIM + 14)
A.put("gnomon", gx, gz, yaw=0.0, scale=1.0)
for k in range(12):
    a = math.radians(k * 30 + 15)
    x, z = at(a, RIM + 6.5)
    low = abs(math.degrees(a) - 0) < 62 or abs(math.degrees(a) - 360) < 62     # the camera's side: nothing tall
    A.put("pylonlow" if low else "pylon", x, z, yaw=a, scale=1.0)
    A.mark("beacon", x, z, 2.3 if low else 11.3)
hx, hz = at(math.radians(128), RIM + 30)
A.put("greathalo", hx, hz, yaw=math.radians(128) + 0.5, scale=1.0, y=4.0, tilt=(0.0, 0.28))

A.finish()
args = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
if args:
    A.render(args[0])
