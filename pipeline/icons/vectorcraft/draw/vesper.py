"""Vesper the Crimson Countess (src/kits/blood.ts): blood drawn as the art bible asks (dark crimson body, a dark rim, one
thin hot rim line, a pinpoint highlight, a pale bone foil near it): needles, mist, a curse, a chalice."""
import math

from vclib import *  # noqa: F401,F403
from vclib import GOLD, PAL

PAL["vesper"] = row("#fff1e6", "#ff3b4e", "#8c0f22", "#bff4ff", "#140306", bone="#e9dcc6", bone_lo="#a89a80")


def blood(ic):
    p = ic.p
    return ic.grad("#ff6a6a", (0.25, p["hot"]), (0.6, p["body"]), (1, "#3a040c"))


def drop(ic, c, r):
    p = ic.p
    d = curve([(c[0], c[1] - r * 1.6), (c[0] + r * 0.9, c[1] - r * 0.1), (c[0] + r * 0.7, c[1] + r * 0.75), (c[0], c[1] + r),
               (c[0] - r * 0.7, c[1] + r * 0.75), (c[0] - r * 0.9, c[1] - r * 0.1)], sharp=(0,), k=0.7)
    ic.shape(d, blood(ic), ink_w=3)
    dot(ic, c[0] - r * 0.35, c[1] - r * 0.1, r * 0.16, "#ffffff")


def ves_q(ic):
    """Lancet: a blood needle that stays in you; rip it out for more."""
    p = ic.p
    streaks(ic, [(6, 46, 13, 40), (12, 52, 19, 46)], color=p["hot"], weight=1.6)
    shard(ic, (14, 46), -42, 42, 2.6, blood(ic), back=0.12)
    ic.line(poly(place([(2, 0), (38, 0)], -42, (14, 46)), closed=False), p["hot"], 0.8, ink=False)
    for x, y, r in ((50, 26, 3.2), (44, 18, 2.2)):
        drop(ic, (x, y), r)


def ves_w(ic):
    """Mist Waltz: she flows five metres as crimson mist; her next blows reach farther."""
    p = ic.p
    for k, (r, w) in enumerate(((20, 6.0), (14, 5.0), (8, 4.0))):
        swoosh(ic, (34, 32), r, 160 + k * 40, 400 + k * 40, w, ("#ffb0b8", (0.4, p["hot"]), (1, p["body"])), ry=r * 0.7,
               head=0.7, ink_w=2.6)
    for x, y in ((12, 22), (18, 14)):
        dot(ic, x, y, 1.4, p["hot"])
    drop(ic, (34, 32), 3)


def ves_e(ic):
    """Hemocurse: a curse: every spell you cast costs you blood, and feeds her."""
    p = ic.p
    ring(ic, 32, 31, 19, 19, ic.grad(p["hot"], (1, p["body"])), w=2.2)
    for k in range(8):
        a = k * 45 - 90
        x, y = 32 + 19 * math.cos(math.radians(a)), 31 + 19 * math.sin(math.radians(a))
        ic.shape(poly(place([(-2.4, -1.4), (3, 0), (-2.4, 1.4)], a + 180, (x, y))), p["bone"], shadow=False, ink_w=1.8)
    ring(ic, 32, 31, 13, 13, p["bone_lo"], w=1.0, ink_w=1.0)
    drop(ic, (32, 33), 7)


def ves_r(ic):
    """Sanguine Feast: rooted, she drinks: blood streams from you into her chalice."""
    p = ic.p
    for y0, y1 in ((14, 22), (24, 27), (34, 30)):
        ic.line(curve([(58, y0), (48, (y0 + y1) / 2 - 2), (38, y1)], closed=False), blood(ic), 2.4, ink_w=4.6)
    # A chalice of old bone, a gold rim, a dark stem.
    cup = curve([(16, 18), (40, 18), (37, 30), (28, 35), (19, 30)], sharp=(0, 1), k=0.7)
    ic.shape(cup, ic.grad("#fff8ee", (0.45, p["bone"]), (1, p["bone_lo"])))
    wine = ic.add("shape.ellipse", x=17.5, y=16, width=21, height=5)
    ic.paint(ic.id(wine), fill=blood(ic), stroke="none")
    ic.line(poly([(16.4, 18.4), (39.6, 18.4)], closed=False), ic.grad(GOLD[0], (1, GOLD[1])), 1.2, ink=False)
    ic.shape(poly([(26.5, 35), (29.5, 35), (30, 46), (26, 46)]), ic.grad("#5a2a30", (1, "#1a0608")), shadow=False, ink_w=2.6)
    base = ic.add("shape.ellipse", x=20, y=44.5, width=16, height=5)
    ic.solid(ic.id(base), ic.grad("#5a2a30", (1, "#1a0608")), shadow=False, ink_w=2.6)
    ic.line(poly([(26.2, 40), (29.8, 40)], closed=False), GOLD[1], 1.2, ink=False)
    ic.line(poly(arc_pts((28, 22), 8, 120, 160, 4), closed=False), "#ffffff", 1.2, ink=False)
    ring(ic, 46, 52, 9, 2.6, p["hot"], w=1.6, dash=[2, 2])


ICONS = {"q": ves_q, "w": ves_w, "e": ves_e, "r": ves_r}
