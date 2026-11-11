"""Drowned Harbour: the round head of a stone quay at dusk, the sea all round it. Built in the heroes' way (kit.py):
clean turned and boxed forms in a few plain materials, gold on the edges, lantern light as the only glow.

Cover (point-symmetric about (0, 7)): three barrels in the middle (low), two rows of stacked sea chests guarding the
starts (low), two mooring posts of three lashed piles with a lantern each flanking the middle (tall), two cannons on the
wings aimed out to sea (low), two boats laid keel-up on trestles in the far corners (low).

Round it: a three-master with furled sails moored on the left, a pier leading off to the right with a lamp arch at its
end, low pier stubs toward both cameras (the cameras sit there: nothing over 2 m), basalt sea stacks far out, a
lighthouse among them. Run:
    blender --background --factory-startup --python blender/arenas/real/harbour.py [-- <check picture path>]
"""
import math
import os
import random
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from mathutils import Vector  # noqa: E402

from kit import Arena, S, pillar, twin, wall  # noqa: E402

PI = math.pi
A = Arena("harbour")
rnd = random.Random(7)
V = Vector

# the heroes' materials (blender/heroes/real/*.py); src/arenas/harbour.ts dims them a little: the arena must not
# outshine the heroes
A.mat("wood", "#4a3220", rough=0.7)
A.mat("plank", "#6b4226", rough=0.75)
A.mat("lacquer", "#1d1b21", rough=0.45)
A.mat("hull", "#1d1b21", rough=0.45, double=True)
A.mat("deck", "#6b4226", rough=0.75, double=True)
A.mat("wine", "#5e1a28", rough=0.6)
A.mat("iron", "#3c3f47", rough=0.42, metal=0.75)
A.mat("gold", "#c9a24a", rough=0.32, metal=0.85)
A.mat("rope", "#b89a5a", rough=0.9)
A.mat("stone", "#2c3140", rough=0.85)
A.mat("cream", "#d8cfb4", rough=0.8)
A.mat("glow", "#ffcf80", rough=0.4, emit="#ffb03a", strength=1.0)


# ---- props, at life size, standing on z = 0 -----------------------------------------------------------------------
def lantern(f, c, r=0.11, h=0.34):
    """A square lantern hanging with its top ring at `c`: gold base and roof, four dark posts, the light inside."""
    c = V(c)
    top, bot = c.z - 0.06, c.z - 0.06 - h
    f.box("gold", (c.x, c.y, bot + 0.02), (2.4 * r, 2.4 * r, 0.04))
    f.box("glow", (c.x, c.y, (top + bot) / 2), (1.5 * r, 1.5 * r, h - 0.08))
    for sx in (1, -1):
        for sy in (1, -1):
            f.tube("lacquer", [(c.x + sx * r, c.y + sy * r, bot + 0.03), (c.x + sx * r, c.y + sy * r, top - 0.02)], 0.014, seg=5)
    f.turned("gold", (c.x, c.y, top - 0.03), (c.x, c.y, top + 0.1), [(0, 1.75 * r), (0.2, 1.8 * r), (0.75, 0.6 * r), (1, 0.02)], seg=4)
    f.torus("gold", (c.x, c.y, c.z), 0.045, 0.01, normal=(1, 0, 0), seg=(12, 5))


def barrel():
    f, h = A.fig(), 0.94
    f.turned("wood", (0, 0, 0), (0, 0, h), [(0, 0.3), (0.1, 0.335), (0.5, 0.375), (0.9, 0.335), (1, 0.3)], seg=28)
    for t, r in ((0.1, 0.34), (0.3, 0.366), (0.7, 0.366), (0.9, 0.34)):
        f.torus("gold", (0, 0, h * t), r, 0.015, seg=(28, 5))
    f.turned("lacquer", (0, 0, h - 0.01), (0, 0, h + 0.012), [(0, 0.27), (1, 0.27)], seg=24)
    f.torus("gold", (0, 0, h + 0.004), 0.285, 0.012, seg=(28, 5))
    return A.built("barrel", f)


def chest():
    """A sea chest, its length along y: a wine body under a rounded lid, gold straps, corners and lock plates."""
    f = A.fig()
    w, ln, h, r = 0.56, 1.2, 0.4, 0.28
    f.box("wine", (0, 0, h / 2), (w, ln, h))
    f.tube("wine", [(0, -ln / 2, h), (0, ln / 2, h)], r, seg=20, squash=((0, 0, 1), 0.5))
    for y in (-0.42, 0.0, 0.42):
        f.box("gold", (0, y, h / 2), (w + 0.03, 0.075, h + 0.012))
        f.tube("gold", [(0, y - 0.0375, h), (0, y + 0.0375, h)], r + 0.016, seg=20, squash=((0, 0, 1), 0.5))
    for sx in (1, -1):
        for sy in (1, -1):
            f.box("gold", (sx * (w / 2 - 0.03), sy * (ln / 2 - 0.03), 0.05), (0.09, 0.09, 0.1))
        for y in (0.21, -0.21):
            f.box("gold", (sx * (w / 2 + 0.01), y, h - 0.03), (0.03, 0.11, 0.15))
    return A.built("chest", f, bevel=0.012)


def coil():
    """A coil of rope laid flat."""
    f = A.fig()
    for k, r in enumerate((0.26, 0.24, 0.22)):
        f.torus("rope", (0, 0, 0.045 + 0.075 * k), r, 0.045, seg=(22, 6))
    f.tube("rope", [(0.22, 0, 0.2), (0.3, 0.1, 0.12), (0.34, 0.28, 0.04)], 0.04, seg=6)
    return A.built("coil", f)


def post(h=3.0):
    """Three piles driven in together and lashed, gold caps, a lantern on an iron arm (toward +x). Returns how far out
    and how high the lantern's light is."""
    f = A.fig()
    for k in range(3):
        a = k * 2 * PI / 3 + PI / 6
        base, top = V((0.34 * math.cos(a), 0.34 * math.sin(a), 0)), V((0.17 * math.cos(a), 0.17 * math.sin(a), h * (1.0 - 0.07 * k)))
        f.turned("wood", base, top, [(0, 0.17), (0.5, 0.16), (1, 0.14)], seg=18)
        f.ellipsoid("gold", top, (0.15, 0.15, 0.07), seg=(18, 8))
    for z, r in ((h * 0.3, 0.44), (h * 0.3 + 0.08, 0.435), (h * 0.3 + 0.16, 0.43), (h * 0.7, 0.36), (h * 0.7 + 0.08, 0.355), (h * 0.7 + 0.16, 0.35)):
        f.torus("rope", (0, 0, z), r, 0.045, seg=(22, 6))
    arm = V((0.62, 0, h * 0.86))
    f.tube("iron", [(0.2, 0, h * 0.8), (0.42, 0, h * 0.9), arm + V((0, 0, 0.03))], 0.022, seg=6)
    lantern(f, arm, r=0.12, h=0.36)
    A.built("post", f)
    return arm.x, arm.z - 0.26


def cannon():
    """A ship's gun on its carriage, the muzzle toward -y: an iron barrel with gold rings, a wooden carriage on four wheels."""
    f = A.fig()
    z = 0.64
    f.turned("iron", (0, 0.86, z), (0, -1.5, z), [(0, 0.05), (0.03, 0.085), (0.06, 0.06), (0.09, 0.185), (0.3, 0.17), (0.93, 0.115), (0.965, 0.15), (1, 0.14)], seg=24)
    for t, r in ((0.1, 0.19), (0.34, 0.172), (0.62, 0.146), (0.95, 0.152)):
        f.torus("gold", (0, 0.86 - 2.36 * t, z), r, 0.016, normal=(0, 1, 0), seg=(24, 5))
    f.tube("lacquer", [(0, -1.46, z), (0, -1.505, z)], 0.085, seg=16)
    f.tube("iron", [(-0.34, 0.0, z - 0.02), (0.34, 0.0, z - 0.02)], 0.05, seg=10)
    for sx in (1, -1):
        f.box("wood", (sx * 0.27, 0.2, 0.33), (0.08, 1.45, 0.3))
        f.box("wood", (sx * 0.27, -0.15, 0.53), (0.08, 0.75, 0.12))
        f.box("gold", (sx * 0.27, -0.15, 0.6), (0.095, 0.3, 0.02))
        for y in (-0.38, 0.62):
            f.turned("wood", (sx * 0.33, y, 0.17), (sx * 0.42, y, 0.17), [(0, 0.17), (1, 0.17)], seg=20)
            f.ellipsoid("gold", (sx * 0.425, y, 0.17), (0.02, 0.05, 0.05), seg=(10, 6))
    f.box("wood", (0, 0.2, 0.22), (0.5, 1.3, 0.08))
    for y in (-0.38, 0.62):
        f.tube("iron", [(-0.34, y, 0.17), (0.34, y, 0.17)], 0.035, seg=8)
    for k in range(3):
        f.ellipsoid("iron", (0.62, 0.55 - 0.2 * k, 0.085), (0.085, 0.085, 0.085), seg=(14, 8))
    return A.built("cannon", f, bevel=0.01)


def skiff(ln=2.7, beam=0.52, depth=0.5, z0=0.3):
    """A rowing boat laid keel-up on two trestles, its length along y: lacquer, a gold keel and gunwale."""
    f = A.fig()
    st = []
    for i in range(19):
        u = 1 - abs(2 * i / 18 - 1) ** 2.4
        st.append((-ln / 2 + ln * i / 18, 0.02 + beam * u ** 0.55, 0.04 + depth * u ** 0.5, 0.0))
    f.hull("hull", st, up=-1.0, z0=z0)
    f.tube("gold", [(0, y, z0 + d + 0.012) for y, b, d, _ in st], 0.022, seg=6)
    for sx in (1, -1):
        f.tube("gold", [(sx * b, y, z0) for y, b, d, _ in st], 0.02, seg=6)
    for y in (-0.75, 0.75):
        f.box("wood", (0, y, z0 - 0.05), (1.15, 0.12, 0.1))
        for sx in (1, -1):
            f.box("wood", (sx * 0.5, y, (z0 - 0.1) / 2), (0.1, 0.3, z0 - 0.1))
    return A.built("skiff", f, bevel=0.008)


def pier(ln=4.0, w=2.4):
    """A length of pier along y, its deck's top at z = 0: straight planks, round piles with gold caps, rope rails."""
    f = A.fig()
    n = 10
    for k in range(n):
        f.box("plank", (0, -ln / 2 + (k + 0.5) * ln / n, -0.04), (w, ln / n - 0.035, 0.08))
    for sx in (1, -1):
        f.box("wood", (sx * (w / 2 - 0.25), 0, -0.16), (0.16, ln, 0.16))
        for y in (-ln / 2 + 0.2, ln / 2 - 0.2):
            f.turned("wood", (sx * (w / 2 + 0.04), y, -4.2), (sx * (w / 2 + 0.04), y, 0.85), [(0, 0.15), (1, 0.125)], seg=14)
            f.ellipsoid("gold", (sx * (w / 2 + 0.04), y, 0.85), (0.135, 0.135, 0.06), seg=(14, 6))
        f.tube("rope", [(sx * (w / 2 + 0.04), -ln / 2 + 0.2 + (ln - 0.4) * t, 0.7 - 0.28 * math.sin(PI * t)) for t in (0, 0.25, 0.5, 0.75, 1)], 0.03, seg=6)
    return A.built("pier", f, bevel=0.008)


def arch():
    """The lamp arch at a pier's end: two posts, a beam, a lantern under it. Returns the light's height."""
    f = A.fig()
    for sx in (1, -1):
        f.turned("wood", (sx * 1.24, 0, -4.2), (sx * 1.24, 0, 3.1), [(0, 0.16), (1, 0.13)], seg=14)
        f.ellipsoid("gold", (sx * 1.24, 0, 3.1), (0.14, 0.14, 0.065), seg=(14, 6))
    f.box("wood", (0, 0, 2.75), (2.9, 0.16, 0.18))
    f.box("gold", (0, 0, 2.85), (2.95, 0.17, 0.025))
    lantern(f, (0, 0, 2.62), r=0.15, h=0.46)
    A.built("arch", f, bevel=0.008)
    return 2.62 - 0.33


def ship():
    """A three-master along y (the bow toward -y), sails furled: a lacquer hull with one gold line, a stern cabin with lit
    windows, masts with gold caps, cream sails rolled on their yards, a few stays. The rim amidships is at z = 0."""
    f = A.fig()
    ln, n = 26.0, 26
    st = []
    for i in range(n + 1):
        t = 2 * i / n - 1
        u = 1 - abs(t) ** (2.0 if t < 0 else 3.4)
        st.append((-ln / 2 + ln * i / n, 0.12 + 3.3 * u ** 0.6, 0.5 + 3.9 * u ** 0.45, 1.3 * t * t + (0.9 * t ** 3 if t > 0 else 0)))
    f.hull("hull", st, seg=16)
    f.hull("deck", [(y, b * 0.97, 0.3, s - 0.45) for y, b, d, s in st[1:-1]], seg=8)
    for sx in (1, -1):
        f.tube("gold", [(sx * b, y, s) for y, b, d, s in st], 0.09, seg=6)
    # the stern cabin and its windows
    f.box("lacquer", (0, 9.4, 1.55), (4.6, 4.8, 1.9))
    for sx in (1, -1):
        f.tube("gold", [(sx * 2.3, 7.0, 2.5), (sx * 2.3, 11.8, 2.5)], 0.06, seg=6)
    for y in (7.0, 11.8):
        f.tube("gold", [(-2.3, y, 2.5), (2.3, y, 2.5)], 0.06, seg=6)
    for x in (-1.3, 0, 1.3):
        f.box("glow", (x, 11.82, 1.7), (0.7, 0.06, 0.6))
    f.tube("wood", [(0, -12.6, 1.2), (0, -17.5, 3.0)], [0.2, 0.09], seg=10)
    tops = []
    for y, h, sails in ((-6.8, 17.0, (7.5, 11.5)), (0.6, 21.0, (8.0, 12.5, 16.5)), (7.2, 14.5, (8.5,))):
        f.turned("wood", (0, y, -1.5), (0, y, h), [(0, 0.3), (0.6, 0.22), (1, 0.11)], seg=14)
        f.ellipsoid("gold", (0, y, h), (0.16, 0.16, 0.22), seg=(12, 8))
        f.torus("gold", (0, y, h * 0.55), 0.55, 0.06, seg=(18, 5))
        for k, z in enumerate(sails):
            half = 4.6 - 0.9 * k
            f.tube("wood", [(-half, y, z), (half, y, z)], 0.11, seg=8)
            f.tube("cream", [(-half * 0.92 + half * 1.84 * i / 6, y, z - 0.26 - 0.07 * math.sin(PI * i / 6) - (0.05 if i % 2 else 0)) for i in range(7)],
                   [0.14, 0.3, 0.26, 0.32, 0.26, 0.3, 0.14], seg=10)
        tops.append(V((0, y, h)))
    stays = [V((0, -17.4, 3.0)), tops[0], tops[1], tops[2], V((0, 12.6, 2.6))]
    for a, b in zip(stays, stays[1:]):
        f.tube("rope", [a, b], 0.035, seg=4)
    for top in tops:
        for sx in (1, -1):
            f.tube("rope", [top - V((0, 0, top.z * 0.12)), V((sx * 3.0, top.y + 1.2, 0.3))], 0.03, seg=4)
    f.box("wine", (0, tops[1].y + 0.9, tops[1].z + 0.75), (0.03, 1.7, 0.55))
    return A.built("ship", f, bevel=0.02)


def stack(key, r, h, lean):
    """A sea stack: three basalt prisms of seven sides grown together, one tall. Its water line is z = 0."""
    f = A.fig()
    for dx, dy, sr, sh in ((0, 0, 1.0, 1.0), (0.75, 0.3, 0.72, 0.62), (-0.5, 0.65, 0.62, 0.42)):
        base = V((dx * r, dy * r, -4.0))
        top = V((dx * r + lean * h * sh, dy * r + lean * 0.4 * h * sh, h * sh))
        f.turned("stone", base, top, [(0, sr * r * 1.25), (0.45, sr * r), (0.85, sr * r * 0.8), (1, sr * r * 0.55)], seg=7)
    return A.built(key, f)


def lighthouse(h=11.0, rock=3.0):
    """A lighthouse on its own rock (the water line at z = 0): a cream tower with two wine bands, a gold gallery, the
    light, a dark cap. Returns the light's height."""
    f = A.fig()
    f.turned("stone", (0, 0, -4.0), (0, 0, rock), [(0, 4.6), (0.6, 3.6), (1, 2.6)], seg=7)
    f.turned("cream", (0, 0, rock), (0, 0, rock + h), [(0, 1.5), (0.5, 1.2), (1, 1.0)], seg=24)
    for t in (0.28, 0.6):
        f.turned("wine", (0, 0, rock + h * t), (0, 0, rock + h * (t + 0.12)), [(0, 1.5 - 0.55 * t + 0.03), (1, 1.5 - 0.55 * (t + 0.12) + 0.03)], seg=24, caps=False)
    f.torus("gold", (0, 0, rock + h), 1.3, 0.1, seg=(24, 5))
    f.turned("glow", (0, 0, rock + h), (0, 0, rock + h + 1.5), [(0, 0.75), (1, 0.75)], seg=16)
    f.turned("lacquer", (0, 0, rock + h + 1.5), (0, 0, rock + h + 2.7), [(0, 1.0), (0.15, 1.05), (1, 0.05)], seg=16)
    f.ellipsoid("gold", (0, 0, rock + h + 2.75), (0.14, 0.14, 0.2), seg=(10, 6))
    A.built("lighthouse", f)
    return rock + h + 0.75


barrel()
chest()
coil()
LANTERN_OUT, LANTERN_UP = post()
cannon()
skiff()
pier()
ARCH_LAMP = arch()
ship()
for i, (r, h, lean) in enumerate(((2.2, 9.0, 0.06), (1.7, 6.5, -0.08), (2.8, 12.0, 0.04))):
    stack(f"stack{i}", r, h, lean)
BEACON = lighthouse()


# ---- cover --------------------------------------------------------------------------------------------------------
def barrels(o, turn):
    x, z = o["ax"], o["az"]
    for k in range(3):
        a = turn + k * 2 * PI / 3
        A.put("barrel", x + 0.5 * math.sin(a), z + 0.5 * math.cos(a), yaw=a * 1.7)
    A.put("coil", x, z, y=0.94 * S, scale=S * 0.95)


def chests(o, turn):
    """A row of sea chests two high along a wall, the top row broken by a coil of rope."""
    ax, az, bx, bz = o["ax"], o["az"], o["bx"], o["bz"]
    length = math.hypot(bx - ax, bz - az) + 2 * o["r"]
    yaw = math.atan2(bx - ax, bz - az)
    cx, cz, ux, uz = (ax + bx) / 2, (az + bz) / 2, math.sin(yaw), math.cos(yaw)
    cl, ch = 1.2 * S, 0.4 * S
    n = max(2, round(length / cl))
    step = length / n
    for i in range(n):
        t = (i - (n - 1) / 2) * step
        A.put("chest", cx + ux * t, cz + uz * t, yaw=yaw, stretch=(1.15, step / cl * 0.985, 1.0))
        if i != (1 if turn else n - 2):
            A.put("chest", cx + ux * t, cz + uz * t, yaw=yaw + rnd.uniform(-0.07, 0.07), y=ch + 0.14 * S, stretch=(1.05, step / cl * 0.9, 0.95))
        else:
            A.put("coil", cx + ux * t, cz + uz * t, y=ch + 0.14 * S, yaw=1.0)


def posts(o, turn):
    x, z = o["ax"], o["az"]
    k, a = o["height"] / 3.0, turn + 0.6
    A.put("post", x, z, yaw=a, scale=k)
    A.mark("lantern", x + LANTERN_OUT * k * math.cos(a), z - LANTERN_OUT * k * math.sin(a), LANTERN_UP * k)


def cannons(o, turn):
    ax, az, bx, bz = o["ax"], o["az"], o["bx"], o["bz"]
    yaw = math.atan2(bx - ax, bz - az) + PI      # the muzzle looks from a to b, out to sea
    A.put("cannon", (ax + bx) / 2, (az + bz) / 2, yaw=yaw, scale=S * 1.05)


def skiffs(o, turn):
    ax, az, bx, bz = o["ax"], o["az"], o["bx"], o["bz"]
    A.put("skiff", (ax + bx) / 2, (az + bz) / 2, yaw=math.atan2(bx - ax, bz - az) + turn)


LAYOUT = [
    (pillar(0, 7, 0.9, 1.4), barrels),
    (wall(-2.6, 3.8, -5.6, 2.4, 0.4, 1.3), chests),
    (pillar(4.3, 4.7, 0.7, 3.9), posts),
    (wall(7.3, 7.5, 9.0, 8.4, 0.4, 1.1), cannons),
    (wall(6.0, 1.5, 7.9, 3.3, 0.45, 1.1), skiffs),
]
o, build = LAYOUT[0]
A.cover(o)
build(o, 0.3)
for o, build in LAYOUT[1:]:
    A.cover(o)
    build(o, 0.0)
    A.cover(twin(o))
    build(twin(o), PI)

# ---- backdrop -----------------------------------------------------------------------------------------------------
A.back()
SEA = -1.7
# the three-master, moored along the left side (|x| > 12), her bows toward the far camera
A.put("ship", -22.5, 8.0, scale=1.0, y=SEA + 2.7)
A.mark("lamp", -22.5, 8.0 - 11.9, SEA + 2.7 + 1.7)
# the pier to the right, level with the kerb, the lamp arch at its far end
for i in range(4):
    A.put("pier", 15.4 + i * 4.0 * S, 7.0, yaw=PI / 2, y=0.17)
end = 15.4 + 3.5 * 4.0 * S - 0.3
A.put("arch", end, 7.0, yaw=PI / 2, y=0.17)
A.mark("lamp", end, 7.0, 0.17 + ARCH_LAMP * S)
# low pier stubs toward both cameras: nothing over 2 m on the z axis
for sgn in (1, -1):
    A.put("pier", 0.0, 7 + sgn * (12.8 + 2.0 * S), y=0.17)
# basalt stacks far out (tall ones beyond 26 m or well off the z axis), and the lighthouse
for k, (a, r, sc) in enumerate(((0.6, 34, 1.0), (1.3, 30, 0.8), (2.0, 39, 1.2), (2.65, 31, 0.9), (4.35, 29, 0.75), (5.0, 41, 1.3), (5.7, 33, 1.0), (0.08, 47, 1.1),
                                (3.2, 49, 1.2))):
    A.put(f"stack{k % 3}", r * math.sin(a), 7 + r * math.cos(a), yaw=a * 2.3, scale=sc * 1.25, y=SEA)
LX, LZ = 36 * math.sin(3.8), 7 + 36 * math.cos(3.8)
A.put("lighthouse", LX, LZ, scale=1.0, y=SEA)
A.mark("beacon", LX, LZ, SEA + BEACON)

A.finish()
args = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
if args:
    A.render(args[0], sea=SEA)
