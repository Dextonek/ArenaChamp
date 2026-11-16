"""Zephyr the Wind Blade (src/kits/sky.ts): wind as shape: crescent cuts, feathers, a leap into the sky (the art bible's
Sky row, cloud as its foil)."""
import math

from vclib import *  # noqa: F401,F403
from vclib import GOLD, PAL

PAL["zephyr"] = row("#ffffff", "#e6fff6", "#7fe6c8", "#ff8fb0", "#0d2a2a", cloud="#eef3f6", deep="#2a8a7a")


def wind(ic):
    p = ic.p
    return (p["core"], (0.4, p["hot"]), (1, p["body"]))


def zep_q(ic):
    """Crosswind: a cross-cut of wind; again, and he dashes through."""
    p = ic.p
    swoosh(ic, (38, 46), 30, -170, -95, 6.4, wind(ic), head=0.6)
    swoosh(ic, (26, 46), 30, -85, -10, 6.4, wind(ic), head=0.4)
    star(ic, 32, 26, 5.6, 1.4, p["core"], points=4, ink_w=0)
    chevron(ic, (56, 50), 30, 3.4, p["accent"], 2.2)


def feather(ic, back, tip, w):
    p = ic.p
    L = math.dist(back, tip)
    ang = math.degrees(math.atan2(tip[1] - back[1], tip[0] - back[0]))
    ic.shape(curve(place(feather_pts(L, w), ang, back), sharp=(0,)), ic.grad(p["core"], (0.5, p["cloud"]), (1, p["body"])))
    ic.line(poly(place([(-0.04 * L, 0), (0.94 * L, 0)], ang, back), closed=False), ic.grad(GOLD[0], (1, GOLD[1])), 1.2,
            ink=False)
    for u in (0.35, 0.55, 0.75):
        a, b = place([(u * L, 0), (u * L + 3, w * 0.8)], ang, back)
        ic.line(poly([a, b], closed=False), p["body"], 0.9, ink=False)


def zep_w(ic):
    """Skyward: he leaps into the air, untouchable, and comes down on the spot."""
    p = ic.p
    ring(ic, 44, 50, 11, 3.2, p["accent"], w=2.0)
    swoosh(ic, (30, 50), 15, 180, 330, 4.6, wind(ic), ry=36, head=0.8)
    chevron(ic, (43, 46), 100, 3.6, p["core"], 2.6)
    feather(ic, (12, 24), (26, 8), 3.6)
    for x, ang, h in ((37, -130, 7), (51, -50, 7)):
        ic.shape(curve(place(tongue_pts(h, 3.6, lean=0.1), ang, (x, 50))), ic.grad(p["core"], (1, p["body"])), shadow=False,
                 ink_w=2.2)


def zep_e(ic):
    """Feather Step: a quick step any way; two charges."""
    p = ic.p
    streaks(ic, [(6, 22, 18, 22), (5, 31, 16, 31), (8, 40, 18, 40)], color=p["hot"], weight=2.0)
    feather(ic, (20, 44), (52, 18), 6.4)
    for x in (44, 51):
        disc(ic, x, 48, 2.6, ic.grad(p["core"], (1, p["accent"])), shadow=False, ink_w=2.2)


def zep_r(ic):
    """Sky Rend: he marks you, vanishes, and cuts from every side."""
    p = ic.p
    c = (32, 32)
    ring(ic, c[0], c[1], 5, 5, p["accent"], w=1.8)
    for k in range(6):
        a = k * 60 + 15
        x, y = c[0] + 13 * math.cos(math.radians(a)), c[1] + 13 * math.sin(math.radians(a))
        swoosh(ic, (x, y), 12, a - 60 + 90, a + 60 + 90, 3.8, wind(ic), head=0.5, ink_w=2.4)
    star(ic, c[0], c[1], 3.6, 1.2, p["core"], points=4, ink_w=0)


ICONS = {"q": zep_q, "w": zep_w, "e": zep_e, "r": zep_r}
