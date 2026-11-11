"""The Hall of Noon: the Sun Warden's boss room for a party of up to 40 (user, 2026-11-11: "what if the arena is not
like a round arena, let's just forget all and let's make boss room"). Not a ring: a hall in the shape of a cross, cut
out of dark stone, the Sun Well at its crossing where the Warden waits.

    the nave      26 m wide, 44 m long, from the gate in the south up to the crossing: the party's way in, between two
                  rows of hour stones, a broken halo lying across it
    the crossing  the court for two as it was: the Sun Well, six hour screens (they break), eight sun obelisks
    the transepts two arms 34 m out to the west and east: a halo arc, column stumps, braziers
    the choir     the north arm, 40 m, more hour stones, and at its end the Warden's empty throne in an alcove under a
                  great gold halo

The walls are the stone the hall is cut from: 1.3 m on the camera's side (it looks over them), 9 to 11 m to the north
and at the ends, with lit windows and gold cornices. Everything a hero can hide behind is an obstacle; the hall's own
walls are obstacles that never break (`fixed`). Run:
    blender --background --factory-startup --python blender/arenas/real/sunhall.py [-- <check picture path>]
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
A = Arena("sunhall")
rnd = random.Random(12)
V = Vector
CX, CZ = 0.0, 7.0
W, SOUTH, EAST, NORTH, OUT = 13.0, 44.0, 34.0, 40.0, 75.0     # the cross: half its arms' width, how far each arm reaches, how far the stone goes

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


def throne():
    """The Warden's empty throne on five steps, a great gold halo on the wall behind it."""
    f = A.fig()
    for k in range(5):
        block(f, "stone", 11 - k * 1.3, 6.4 - k * 0.9, 0.4, z0=k * 0.4, y0=-0.4 * k)
    block(f, "slate", 3.4, 2.4, 1.0, z0=2.0, y0=-2.0)
    block(f, "slate", 3.4, 0.7, 5.6, z0=2.0, y0=-3.0, top=(0.78, 1.0))
    for sx in (-1, 1):
        f.box("slate", (sx * 1.95, -2.0, 2.8), (0.5, 2.4, 1.6))
        f.box("gold", (sx * 1.95, -2.0, 3.65), (0.6, 2.5, 0.12))
    f.torus("gold", (0, -3.55, 8.2), 4.6, 0.42, normal=(0, 1, 0), seg=(56, 10))
    f.torus("copper", (0, -3.5, 8.2), 3.7, 0.16, normal=(0, 1, 0), seg=(48, 8))
    f.turned("glow", (0, -3.7, 8.2), (0, -3.62, 8.2), [(0, 1.5), (1, 1.5)], seg=28)
    for k in range(12):
        a = k * TAU / 12
        solid(f, "gold", [(math.cos(a) * 5.0 + math.sin(a) * 0.3, -3.6, 8.2 + math.sin(a) * 5.0 - math.cos(a) * 0.3), (math.cos(a) * 5.0 - math.sin(a) * 0.3, -3.6, 8.2 + math.sin(a) * 5.0 + math.cos(a) * 0.3),
                          (math.cos(a) * 5.0, -3.3, 8.2 + math.sin(a) * 5.0), (math.cos(a) * (6.6 if k % 2 == 0 else 5.9), -3.6, 8.2 + math.sin(a) * (6.6 if k % 2 == 0 else 5.9))])
    A.built("throne", f, bevel=0.02)


def window(key, h):
    """A tall lit window for a wall's face (it looks along +y): a gold frame, a light behind dark bars."""
    f = A.fig()
    block(f, "gold", 2.0, 0.24, h + 0.5, z0=1.5)
    block(f, "glow", 1.5, 0.3, h, z0=1.75)
    solid(f, "gold", [(-1.0, -0.12, h + 2.0), (1.0, -0.12, h + 2.0), (-1.0, 0.12, h + 2.0), (1.0, 0.12, h + 2.0), (0, -0.12, h + 3.0), (0, 0.12, h + 3.0)])
    for k in (-1, 0, 1):
        f.box("lacquer", (k * 0.5, 0, 1.75 + h / 2), (0.09, 0.36, h))
    block(f, "lacquer", 1.5, 0.36, 0.09, z0=1.75 + h * 0.6)
    A.built(key, f, bevel=0.01)


def pilaster(key, h):
    f = A.fig()
    block(f, "stone", 1.5, 0.7, 0.5)
    block(f, "cream", 1.0, 0.5, h - 1.2, z0=0.5)
    block(f, "gold", 1.4, 0.7, 0.3, z0=h - 0.7)
    A.built(key, f, bevel=0.012)


well(); screen(); halo_seg(3.3); shard(); brazier(); drum(); throne()
obelisk("obelisk", 3.4)
for n in range(1, 5):
    obelisk(f"hour{n}", 4.3, r=0.8, notches=n)
for k, h in enumerate((1.1, 1.9, 2.8)):
    stump(f"stump{k}", h)
window("window", 4.6)
pilaster("pilaster", 9.0)

# ---- the layout: (x, s) is metres east and SOUTH of the Sun Well -------------------------------------------------------
def P(x, s):
    return CX + x, CZ + s


def fixed(x0, s0, x1, s1, height):
    """A stretch of the hall's own wall: an obstacle that never breaks, with no mesh of its own (the stone is the backdrop)."""
    (ax, az), (bx, bz) = P(x0, s0), P(x1, s1)
    A.cover(dict(wall(ax, az, bx, bz, 0.6, height), fixed=True))


def prop(key, x, s, yaw=0.0, **kw):
    gx, gz = P(x, s)
    return A.put(key, gx, gz, yaw=yaw, scale=1.0, **kw)


def stone_pillar(key, x, s, r, h, mark=None):
    gx, gz = P(x, s)
    A.cover(pillar(gx, gz, r, h))
    A.put(key, gx, gz, yaw=math.atan2(-x, -s) if (x or s) else 0.0, scale=1.0)
    if mark:
        A.mark(mark[0], gx, gz, mark[1])


def beam(x0, s0, x1, s1):
    """A piece of fallen halo from (x0, s0) to (x1, s1)."""
    (ax, az), (bx, bz) = P(x0, s0), P(x1, s1)
    A.cover(wall(ax, az, bx, bz, 0.5, 1.0))
    A.put("halo", (ax + bx) / 2, (az + bz) / 2, yaw=math.atan2(bx - ax, bz - az), scale=1.0, tilt=(0.0, rnd.uniform(-0.05, 0.05)),
          stretch=(1.0, math.hypot(bx - ax, bz - az) / 3.3, 1.0))


# the crossing: the court for two, as it was
A.cover(pillar(CX, CZ, 1.0, 1.45))
A.put("well", CX, CZ, scale=1.0)
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

# the nave and the choir: two rows of hour stones, a broken halo lying across each
n = 0
for rows in ((18.5, 25.5, 32.5, 39.5), (-18.5, -25.5, -32.5)):
    for s_ in rows:
        for x in (-7.5, 7.5):
            stone_pillar(f"hour{n % 4 + 1}", x, s_, 0.9, 4.3, ("lantern", 3.05))
            n += 1
for s_ in (29.0, -22.0):
    bow = 0.9 if s_ > 0 else -0.9
    for sx in (-1, 1):
        beam(sx * 12.0, s_ - bow, sx * 8.9, s_)
        beam(sx * 8.7, s_ + 0.05, sx * 5.4, s_ + bow)
for x, s_, turn in ((-3.6, 21.5, 0.5), (3.9, 35.5, -0.4), (3.4, -14.8, 2.2), (-3.8, -28.8, 1.2)):
    gx, gz = P(x, s_)
    dx, dz = math.sin(turn) * 2.0, math.cos(turn) * 2.0
    A.cover(wall(gx - dx, gz - dz, gx + dx, gz + dz, 0.45, 1.5))
    A.put("shard", gx, gz, yaw=turn + PI, scale=1.0)
for x, s_ in ((-11, 15.5), (11, 15.5), (-11, 42), (11, 42), (-11, -15.5), (11, -15.5), (-5.6, -37.5), (5.6, -37.5)):
    stone_pillar("brazier", x, s_, 0.7, 1.2, ("lamp", 1.3))

# the transepts: a halo arc, two hour stones, column stumps at the end, braziers in the corners
for sx in (-1, 1):
    for k in range(3):
        a0, a1 = math.radians(-21 + k * 14), math.radians(-7 + k * 14)
        beam(sx * 23 * math.cos(a0), 23 * math.sin(a0), sx * 23 * math.cos(a1), 23 * math.sin(a1))
    for s_ in (-8.6, 8.6):
        stone_pillar(f"hour{n % 4 + 1}", sx * 17.2, s_, 0.9, 4.3, ("lantern", 3.05))
        n += 1
    for k, s_ in enumerate((-7.0, 0.0, 7.0)):
        kind = (k + (sx > 0)) % 3
        stone_pillar(f"stump{kind}", sx * 29.5, s_, 0.7, (1.1, 1.9, 2.8)[kind])
    for s_ in (-10.6, 10.6):
        stone_pillar("brazier", sx * 31.6, s_, 0.7, 1.2, ("lamp", 1.3))

# the hall's own walls, round the cross (they never break). The gate's passage in the south stays open; the ring ends it.
GATE = 3.2
for sx in (-1, 1):
    fixed(sx * W, SOUTH, sx * W, W, 1.3)            # the nave's side
    fixed(sx * W, W, sx * EAST, W, 1.3)             # the transept's south side
    fixed(sx * EAST, W, sx * EAST, -W, 9.0)         # its end
    fixed(sx * EAST, -W, sx * W, -W, 9.0)           # its north side
    fixed(sx * W, -W, sx * W, -NORTH, 9.0)          # the choir's side
    fixed(sx * W, SOUTH, sx * GATE, SOUTH, 1.3)     # the south end, beside the gate
    fixed(sx * GATE, SOUTH, sx * GATE, SOUTH + 5.0, 1.3)
    fixed(sx * W, -NORTH, sx * 6.0, -NORTH, 11.0)   # the north end, beside the throne's alcove
fixed(-6.0, -NORTH, 6.0, -NORTH, 2.0)               # the throne's steps

# ---- the stone the hall is cut from, and what is on its walls ---------------------------------------------------------
A.back()


def mass(key, x0, x1, s0, s1, h):
    """A block of the stone from (x0..x1, s0..s1), `h` high: a gold line along its top, burnt copper at its foot."""
    f = A.fig()
    block(f, "stone", x1 - x0, s1 - s0, h)
    block(f, "gold", x1 - x0 + 0.24, s1 - s0 + 0.24, 0.14, z0=h - 0.34)
    block(f, "lacquer", x1 - x0 + 0.1, s1 - s0 + 0.1, 0.2, z0=h - 0.2)
    block(f, "copper", x1 - x0 + 0.16, s1 - s0 + 0.16, 0.3)
    A.built(key, f)
    A.put(key, *P((x0 + x1) / 2, (s0 + s1) / 2), scale=1.0)


def span(sx, near, far):
    """From `near` to `far` on the side `sx`, as (low, high)."""
    return (sx * far, sx * near) if sx < 0 else (sx * near, sx * far)


LOW, HIGH, END = 1.3, 9.0, 11.0
for i, sx in enumerate((-1, 1)):
    mass(f"sw{i}", *span(sx, W, OUT), W, OUT, LOW)                        # south-west and south-east: low, the camera looks over
    mass(f"nw{i}", *span(sx, W, OUT), -OUT, -W, HIGH)                     # north-west and north-east
    mass(f"end{i}", *span(sx, EAST, OUT), -W, W, HIGH)                    # past the transept's end
    mass(f"gate{i}", *span(sx, GATE, W), SOUTH, OUT, LOW)                 # beside the gate's passage
    mass(f"north{i}", *span(sx, 6.0, W), -OUT, -NORTH, END)               # beside the throne's alcove
mass("alcove", -6.0, 6.0, -OUT, -NORTH - 7.5, END)                        # the alcove's back wall

prop("throne", 0, -NORTH - 3.9, yaw=PI)
A.mark("beacon", *P(0, -NORTH - 6.8), 8.2)

# lit windows and pilasters on the walls the camera sees: the transepts' north sides, the choir's sides, the ends
for sx in (-1, 1):
    for x in (15.5, 20.5, 25.5, 30.5):                                    # the transept's north wall looks south
        prop("window", sx * x, -W - 0.05, yaw=PI)
        A.mark("lamp", *P(sx * x, -W + 0.4), 4.2)
        prop("pilaster", sx * (x + 2.5), -W + 0.2, yaw=PI)
    for s_ in (-17.0, -23.5, -30.0, -36.5):                               # the choir's walls look east and west
        prop("window", sx * (W + 0.05), s_, yaw=-sx * PI / 2)
        A.mark("lamp", *P(sx * (W - 0.4), s_), 4.2)
    for s_ in (-8.0, 0.0, 8.0):                                           # the transept's end
        prop("window", sx * (EAST + 0.05), s_, yaw=-sx * PI / 2)
        A.mark("lamp", *P(sx * (EAST - 0.4), s_), 4.2)
    for x in (8.0, 11.0):                                                 # beside the throne
        prop("pilaster", sx * x, -NORTH + 0.2, yaw=PI)
    # braziers on the low stone along the nave, and at the gate
    for s_ in (17.0, 24.0, 31.0, 38.0, 45.0):
        ob = prop("brazier", sx * (W + 2.2), s_)
        ob.data.transform(Matrix.Translation((0, 0, LOW)))
        A.mark("lamp", *P(sx * (W + 2.2), s_), LOW + 1.3)

A.finish()
args = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
if args:
    A.render(args[0])
