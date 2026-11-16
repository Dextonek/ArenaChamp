"""Lyra the Star Archer (src/kits/astral.ts): a bow of night and gold, arrows tipped with stars, the sky chart as the
foil (the art bible's Astral row)."""
import math

from vclib import *  # noqa: F401,F403
from vclib import GOLD, PAL

PAL["lyra"] = row("#fffbe8", "#ffe08a", "#5a3fc0", "#7ff3ff", "#070414", chart="#e8e0c8", deep="#2a1a60")


def arrow(ic, nock, tip, starred=True, w=1.6):
    p = ic.p
    ic.line(poly([nock, tip], closed=False), ic.grad(p["chart"], (1, "#a89e80")), w, ink_w=w + 2.6)
    ang = math.degrees(math.atan2(tip[1] - nock[1], tip[0] - nock[0]))
    for side in (-1, 1):
        fl = place([(0, 0), (4.5, side * 0.4), (2, side * 3), (-1, side * 3)], ang, nock)
        ic.shape(poly(fl), ic.grad(p["hot"], (1, p["body"])), shadow=False, ink_w=1.8)
    if starred:
        glow(ic, tip[0], tip[1], 6, p["accent"], opacity=75)
        star(ic, tip[0], tip[1], 5, 1.4, ic.grad(p["core"], (1, p["accent"])), points=4, rotation=ang, ink_w=2)
    else:
        ic.shape(poly(place([(0, -2.4), (5, 0), (0, 2.4)], ang, tip)), ic.grad("#ffffff", (1, "#8a8aa0")), shadow=False,
                 ink_w=2.2)


def bow(ic, top, bottom, bend):
    """A recurved bow of night-lacquer with gold tips, and its string."""
    p = ic.p
    mid = ((top[0] + bottom[0]) / 2 + bend[0], (top[1] + bottom[1]) / 2 + bend[1])
    ic.line(curve([top, mid, bottom], closed=False), ic.grad("#8a6ad8", (0.5, p["body"]), (1, p["deep"])), 3.0, ink_w=5.6)
    for q in (top, bottom):
        dot(ic, q[0], q[1], 1.8, GOLD[1])
    dot(ic, mid[0], mid[1], 1.6, GOLD[0])


def lyr_q(ic):
    """Starfall Arrow: drawn to the full, the star arrow flies farther, hits harder and pierces."""
    p = ic.p
    bow(ic, (24, 9), (14, 47), (-9, 2))
    ic.line(poly([(24, 9), (28, 30), (14, 47)], closed=False), p["chart"], 0.9, ink=False)
    arrow(ic, (28, 30), (54, 20))
    for y, x in ((14, 40), (38, 44)):
        ic.line(poly([(x, y), (x + 6, y - 2.3)], closed=False), p["hot"], 1.4, ink=False)


def lyr_w(ic):
    """Twin Stars: two arrows to every shot, and quicker feet."""
    p = ic.p
    arrow(ic, (10, 30), (46, 16))
    arrow(ic, (14, 42), (50, 28))
    for x, y in ((24, 13), (30, 46)):
        spark(ic, x, y, 2.6, p["hot"])
    chevron(ic, (57, 46), 0, 3.0, p["accent"], 2.0)
    chevron(ic, (52, 46), 0, 3.0, p["accent"], 2.0)


def lyr_e(ic):
    """Pinning Arrow: near a wall it pins you there; anywhere else it slows."""
    p = ic.p
    wall = poly([(40, 8), (56, 8), (56, 54), (40, 54)])
    ic.shape(wall, ic.grad("#b8b0d0", (0.5, "#5a5070"), (1, "#1e1a2c")))
    for y in (20, 32, 44):
        ic.line(poly([(40, y), (56, y)], closed=False), "#1e1a2c", 1.0, ink=False)
    for x, y0, y1 in ((48, 8, 20), (44, 20, 32), (50, 32, 44), (46, 44, 54)):
        ic.line(poly([(x, y0), (x, y1)], closed=False), "#1e1a2c", 1.0, ink=False)
    arrow(ic, (12, 34), (41, 28), starred=False, w=1.8)
    star(ic, 41, 28, 7, 1.6, p["accent"], points=4, ink_w=0)
    for a in (150, 200, 250):
        ca, sa = math.cos(math.radians(a)), math.sin(math.radians(a))
        ic.line(poly([(41 + ca * 4, 28 + sa * 4), (41 + ca * 8, 28 + sa * 8)], closed=False), p["hot"], 1.4, ink=False)
    ring(ic, 28, 44, 9, 2.6, p["accent"], w=1.6)


def lyr_r(ic):
    """Meteor Mark: a star locks on and follows, then a meteor strikes where you stood."""
    p = ic.p
    ring(ic, 40, 46, 13, 4, p["accent"], w=2.0)
    for a in (0, 90, 180, 270):
        ca, sa = math.cos(math.radians(a)), math.sin(math.radians(a))
        ic.line(poly([(40 + ca * 10, 46 + sa * 3), (40 + ca * 16, 46 + sa * 5)], closed=False), p["accent"], 1.6, ink=False)
    comet = curve([(6, 8), (30, 26), (38, 30), (40.5, 36), (34, 37), (29, 32)], sharp=(0,), k=0.6)
    ic.shape(comet, ic.grad((0, p["body"], 0), (0.5, p["hot"]), (1, p["core"]), start=[8, 8], end=[38, 34]), shadow=False,
             ink_w=0)
    disc(ic, 36, 33, 6.5, ic.grad(p["core"], (0.4, p["hot"]), (1, "#e0a020")), ink_w=3.4)
    star(ic, 36, 33, 4, 1.2, "#ffffff", points=4, ink_w=0)
    for x, y in ((50, 14), (56, 26), (22, 44)):
        spark(ic, x, y, 2.2, p["hot"])


ICONS = {"q": lyr_q, "w": lyr_w, "e": lyr_e, "r": lyr_r}
