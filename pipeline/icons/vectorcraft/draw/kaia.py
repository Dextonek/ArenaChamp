"""Kaia the Tempest Caller (src/kits/storm.ts): a sea-tanned storm caller of the Coast folk who plants iron rods that call
the lightning; the art bible's Storm row, thick bent lightning, rain as the foil."""
import math

from vclib import *  # noqa: F401,F403
from vclib import GOLD, PAL

PAL["kaia"] = row("#ffffff", "#d6f2ff", "#4aa8ff", "#ffe36a", "#0a1220", rain="#c8d4de", iron="#5a6878", copper="#c87a40")


def lightning(ic, pts, w=3.2, colors=None):
    """Thick bent lightning: a zigzag band, wide at the top, with a white core."""
    p = ic.p
    left, right = [], []
    n = len(pts)
    for i, (x, y) in enumerate(pts):
        ww = w * (1 - 0.6 * i / (n - 1))
        left.append((x - ww, y))
        right.append((x + ww, y))
    d = poly(left + list(reversed(right)))
    ic.shape(d, ic.grad(*(colors or (p["core"], (0.4, p["hot"]), (1, p["body"])))), shadow=False, ink_w=3)
    ic.line(poly(pts, closed=False), p["core"], 1.0, ink=False)


def rod(ic, foot, h, s=1.0):
    """One of her iron rods: a spike with copper coils and a ring on top."""
    p = ic.p
    x, y = foot
    ic.shape(poly([(x - 1.6 * s, y), (x - 1.1 * s, y - h), (x + 1.1 * s, y - h), (x + 1.6 * s, y)]),
             ic.grad("#c8d4e0", (0.5, p["iron"]), (1, "#202830")), ink_w=3)
    for k in (0.3, 0.45, 0.6):
        ic.line(poly([(x - 2.4 * s, y - h * k), (x + 2.4 * s, y - h * k - 1)], closed=False), p["copper"], 1.4, ink=True,
                ink_w=2.8)
    e = ic.add("shape.ellipse", x=x - 3.2 * s, y=y - h - 3.2 * s, width=6.4 * s, height=6.4 * s)
    ic.paint(ic.id(e), fill="none", stroke=p["dark"], weight=3.6)
    e2 = ic.add("shape.ellipse", x=x - 3.2 * s, y=y - h - 3.2 * s, width=6.4 * s, height=6.4 * s)
    ic.paint(ic.id(e2), fill="none", stroke=ic.grad(GOLD[0], (1, GOLD[1])), weight=1.6)
    glow(ic, x, y - h, 5 * s, p["body"], opacity=80)


def kai_q(ic):
    """Sky Strike: lightning falls on you, and a rod stands where it struck."""
    p = ic.p
    ring(ic, 30, 49, 12, 3.4, p["accent"], w=1.8)
    lightning(ic, [(26, 4), (33, 17), (24, 24), (34, 36), (30, 48)], w=4.0)
    star(ic, 30, 48, 8, 1.6, p["accent"], points=4, ink_w=0)
    rod(ic, (48, 50), 26, 1.0)
    ic.line(curve([(36, 30), (40, 33), (43, 28), (47, 25)], closed=False), p["hot"], 1.4, ink=False)


def kai_w(ic):
    """Thunder Rod: a great rod at the spot crackles every second, and can be fired once."""
    p = ic.p
    ring(ic, 32, 49, 22, 6, p["body"], w=2.0)
    for a0 in (200, 330):
        ic.line(poly(arc_pts((32, 30), 17, a0, a0 + 50, 6), closed=False), p["hot"], 1.8)
    rod(ic, (32, 50), 38, 1.45)
    for side in (-1, 1):
        ic.line(poly([(32 + side * 5, 22), (32 + side * 10, 18), (32 + side * 9, 25), (32 + side * 15, 22)], closed=False),
                p["accent"], 1.8, ink=True, ink_w=3.6)


def kai_e(ic):
    """Polarity: she magnetises you, and a second later you are yanked to her rod."""
    p = ic.p
    rod(ic, (48, 50), 30, 1.05)
    for r, op in ((10, 90), (16, 70), (22, 50)):
        ic.line(poly(arc_pts((48, 26), r, 140, 220, 8), closed=False), p["hot"], 1.8, ink=False, opacity=op)
    disc(ic, 17, 28, 6.5, ic.grad(p["core"], (0.4, p["hot"]), (1, p["body"])), ink_w=3.4)
    ic.line(poly([(17, 23.5), (17, 32.5)], closed=False), p["dark"], 1.4, ink=False)
    for x in (27, 33):
        chevron(ic, (x, 28), 0, 3.6, p["accent"], 2.6)


def kai_r(ic):
    """Supercell: a storm over her for six seconds; bolt after bolt falls on whoever is near her or a rod."""
    p = ic.p
    cell = ic.add("shape.ellipse", x=6, y=6, width=52, height=24)
    ic.solid(ic.id(cell), ic.grad("#8aa0b8", (0.5, "#3a4a60"), (1, "#141c2a")), ink_w=4.4)
    for r, w in ((19, 2.0), (12, 1.8), (6, 1.6)):
        ic.line(poly(arc_pts((32, 18), r, 150, 400, 12, ry=r * 0.42), closed=False), p["rain"], w, ink=False, opacity=80)
    lightning(ic, [(19, 25), (23, 33), (17, 38), (22, 47)], w=2.6)
    lightning(ic, [(34, 27), (39, 37), (31, 42), (37, 54)], w=3.4)
    lightning(ic, [(48, 25), (51, 32), (46, 36), (50, 44)], w=2.4)
    for x in (27, 43, 55):
        ic.line(poly([(x, 31), (x - 1.6, 37)], closed=False), p["rain"], 1.2, ink=False)


ICONS = {"q": kai_q, "w": kai_w, "e": kai_e, "r": kai_r}
