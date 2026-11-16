"""Auriel the Dawn Paladin (src/kits/dawn.ts): the first light of the morning, a shield of dawn, an oath burnt in light,
the sun rising (the art bible's Dawn row, ivory as its foil)."""
import math

from vclib import *  # noqa: F401,F403
from vclib import GOLD, PAL

PAL["auriel"] = row("#fffdf2", "#ffe7a0", "#f2b83c", "#7fd8ff", "#3a2408", ivory="#efe6d2", deep="#a8701a")


def light(ic):
    p = ic.p
    return ic.grad(p["core"], (0.4, p["hot"]), (1, p["body"]))


def sun(ic, c, r, rays=8):
    p = ic.p
    glow(ic, c[0], c[1], r * 2, p["body"], opacity=75)
    star(ic, c[0], c[1], r * 1.6, r * 0.9, light(ic), points=rays, ink_w=2.6)
    disc(ic, c[0], c[1], r, ic.grad("#ffffff", (0.5, p["hot"]), (1, p["body"])), shadow=False, ink_w=2.6)


def aur_q(ic):
    """First Light: a wave of light in a cone; a hit lends her a shield."""
    p = ic.p
    cone = ic.add("path.create", d=curve([(16, 31), (54, 12), (58, 31), (54, 50)], sharp=(0, 1, 3), k=0.6) )
    ic.paint(ic.id(cone), fill=ic.grad((0, p["hot"], 0.8), (1, p["body"], 0.15), start=[16, 31], end=[58, 31]), stroke="none")
    for a in (-24, -12, 0, 12, 24):
        ca, sa = math.cos(math.radians(a)), math.sin(math.radians(a))
        ic.line(poly([(16 + ca * 12, 31 + sa * 12), (16 + ca * 38, 31 + sa * 38)], closed=False), p["core"], 1.8 if a % 24 else 2.4,
                ink=True, ink_w=3.6)
    swoosh(ic, (16, 31), 34, -30, 30, 4.4, (p["core"], (1, p["hot"])), head=0.5, ink_w=2.4)
    sun(ic, (16, 31), 6)


def kite(ic, c, s, fill):
    x, y = c
    pts = [(x - 12 * s, y - 14 * s), (x, y - 17 * s), (x + 12 * s, y - 14 * s), (x + 12 * s, y + 1 * s), (x, y + 18 * s),
           (x - 12 * s, y + 1 * s)]
    return ic.shape(curve(pts, sharp=(0, 2, 4), k=0.5), fill)


def aur_w(ic):
    """Dawnward: a shield of dawn; while it holds her blows reach farther, and when it ends it bursts."""
    p = ic.p
    glow(ic, 32, 30, 24, p["body"], opacity=50)
    kite(ic, (32, 31), 1.25, ic.grad(p["ivory"], (0.45, p["hot"]), (1, p["deep"])))
    ic.line(curve([(19, 14.5), (32, 11), (45, 14.5)], closed=False), ic.grad(GOLD[0], (1, GOLD[2])), 1.4, ink=False)
    sun(ic, (32, 28), 6.5, rays=12)
    for k in range(5):
        a = math.radians(-160 + k * 35)
        ic.line(poly([(32 + 26 * math.cos(a), 30 + 26 * math.sin(a)), (32 + 30 * math.cos(a), 30 + 30 * math.sin(a))],
                     closed=False), p["hot"], 2.0, ink=True, ink_w=3.6)


def aur_e(ic):
    """Oathbrand: a beam falls on you and brands you; a burst that catches the brand stuns."""
    p = ic.p
    col = ic.add("path.create", d=poly([(26, 2), (38, 2), (36, 44), (28, 44)]))
    ic.paint(ic.id(col), fill=ic.grad((0, p["core"], 0.9), (0.6, p["hot"], 0.6), (1, p["body"], 0.3), angle=-90), stroke="none")
    for x in (26, 38):
        ic.line(poly([(x, 2), (x + (2 if x < 32 else -2), 44)], closed=False), p["core"], 1.4, ink=False)
    ring(ic, 32, 46, 14, 4, light(ic), w=2.4)
    # The brand: a sigil of the oath, a sun's ring crossed by a sword.
    ring(ic, 32, 46, 6.5, 2.2, p["accent"], w=1.6)
    ic.line(poly([(32, 36), (32, 52)], closed=False), p["accent"], 1.8, ink=True, ink_w=3.6)
    star(ic, 32, 14, 6, 1.6, p["core"], points=4, ink_w=0)


def aur_r(ic):
    """Sunrise: a great shield, and she rises; when it breaks a ring closes and bursts."""
    p = ic.p
    ring(ic, 32, 46, 26, 9, ic.grad(p["hot"], (1, p["body"])), w=2.6, dash=[3, 2.4])
    for k in range(6):
        a = k * 60 + 30
        ca, sa = math.cos(math.radians(a)), math.sin(math.radians(a))
        chevron(ic, (32 + ca * 22, 46 + sa * 7.6), a + 180, 2.4, p["hot"], 1.6)
    sun(ic, (32, 28), 11, rays=12)
    horizon = ic.add("path.create", d=poly([(8, 34), (56, 34), (56, 37), (8, 37)]))
    ic.paint(ic.id(horizon), fill=ic.grad((0, p["dark"], 0), (0.5, p["dark"], 1), (1, p["dark"], 0), angle=0), stroke="none")
    ic.line(poly([(12, 34), (52, 34)], closed=False), ic.grad(GOLD[0], (1, GOLD[1])), 1.4, ink=False)


ICONS = {"q": aur_q, "w": aur_w, "e": aur_e, "r": aur_r}
