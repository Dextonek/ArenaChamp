"""Fenna the Grove Warden (src/kits/grove.ts): seeds, vines, pollen and flowers, and the World Tree; the art bible's Grove
row, the bark's cream as its foil."""
import math

from vclib import *  # noqa: F401,F403
from vclib import GOLD, PAL

PAL["fenna"] = row("#fffbe0", "#ffe36a", "#4caf50", "#ff7ab8", "#14260f", bark="#e8dcc0", wood="#7a5a3a",
                   leaf_lo="#2a6a2c")


def leafy(ic):
    p = ic.p
    return ic.grad("#c8f08a", (0.45, p["body"]), (1, p["leaf_lo"]))


def flower(ic, c, r, petals=5):
    p = ic.p
    for k in range(petals):
        a = math.radians(k * 360 / petals - 90)
        x, y = c[0] + r * 0.62 * math.cos(a), c[1] + r * 0.62 * math.sin(a)
        e = ic.add("shape.ellipse", x=x - r * 0.42, y=y - r * 0.42, width=r * 0.84, height=r * 0.84)
        ic.solid(ic.id(e), ic.grad("#ffd8ea", (0.5, p["accent"]), (1, "#b83a78")), shadow=False, ink_w=2.2)
    disc(ic, c[0], c[1], r * 0.32, ic.grad(p["core"], (1, p["hot"])), shadow=False, ink_w=1.8)


def leaf(ic, at, ang, L):
    p = ic.p
    pts = [(0, 0), (0.35 * L, 0.32 * L), (L, 0), (0.35 * L, -0.32 * L)]
    ic.shape(curve(place(pts, ang, at), sharp=(0, 2), k=0.7), leafy(ic), shadow=False, ink_w=2.2)


def fen_q(ic):
    """Seed Shot: a seed flies, and a flower grows where it stops."""
    p = ic.p
    streaks(ic, [(6, 18, 16, 21), (6, 27, 15, 28)], color=p["hot"], weight=1.8)
    seed = curve(place([(0, 0), (6, -4), (14, 0), (6, 4)], -14, (17, 25)), sharp=(0, 2), k=0.75)
    ic.shape(seed, ic.grad("#f0d8a0", (0.5, "#b08040"), (1, "#5a3a18")))
    ic.line(curve([(30, 24), (38, 28), (42, 40)], closed=False), p["hot"], 1.4, ink=False, dash=[2, 2])
    ic.line(curve([(44, 52), (44, 44), (45, 38)], closed=False), leafy(ic), 2.2, ink_w=4.4)
    leaf(ic, (44, 47), -150, 8)
    flower(ic, (45, 35), 9)


def fen_w(ic):
    """Strangle Vine: vines coil round one enemy and hold it."""
    p = ic.p
    ring(ic, 32, 50, 14, 3.8, p["hot"], w=1.8)
    for k, (x0, d) in enumerate(((22, 1), (42, -1))):
        pts = [(x0, 52)]
        for i in range(1, 7):
            y = 52 - i * 7
            pts.append((32 + d * (10 - i * 0.6) * math.cos(i * 1.4 + k * 3.1), y))
        ic.line(curve(pts, closed=False), leafy(ic), 3.0, ink_w=5.6)
    for x, y, a in ((24, 36, 200), (40, 26, -20), (26, 18, 210), (38, 44, -30)):
        leaf(ic, (x, y), a, 7)
    for x, y in ((31, 30), (35, 40), (29, 22)):
        ic.shape(poly([(x, y - 1.6), (x + 2.6, y), (x, y + 1.6)]), p["bark"], shadow=False, ink_w=1.6)


def fen_e(ic):
    """Pollen Glide: she glides on a gust of pollen; a flower grows where she lands."""
    p = ic.p
    swoosh(ic, (28, 44), 22, 190, 330, 6, (p["core"], (0.5, p["hot"]), (1, p["body"])), ry=24, head=0.7)
    for x, y, r in ((14, 30, 1.4), (20, 18, 1.8), (30, 13, 1.4), (24, 26, 1.1), (40, 16, 1.6)):
        dot(ic, x, y, r, p["hot"])
        glow(ic, x, y, r * 3, p["hot"], opacity=70)
    flower(ic, (47, 42), 8)
    leaf(ic, (47, 48), 160, 7)


def fen_r(ic):
    """World Tree: a tree bursts up and stands: a wall, a root for whoever is near, and her flowers heal more."""
    p = ic.p
    ic.shape(poly([(29, 52), (30, 36), (25, 30), (31, 32), (32, 26), (34, 32), (40, 29), (35, 36), (36, 52)]),
             ic.grad(p["bark"], (0.5, "#a88a60"), (1, p["wood"])))
    for x0, d in ((29, -1), (36, 1)):
        ic.line(curve([(x0, 50), (x0 + d * 6, 52), (x0 + d * 12, 55)], closed=False), p["wood"], 2.2, ink_w=4.4)
    for x, y, r in ((22, 22, 9), (42, 21, 10), (32, 14, 11), (32, 26, 8)):
        ic.shape(blob_d((x, y), r, n=6, wobble=0.12, phase=x), leafy(ic), ink_w=3.6)
    for x, y in ((18, 48), (47, 48), (24, 18), (40, 14)):
        flower(ic, (x, y), 4.6)


ICONS = {"q": fen_q, "w": fen_w, "e": fen_e, "r": fen_r}
