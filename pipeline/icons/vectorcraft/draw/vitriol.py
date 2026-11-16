"""Vitriol the Plague Alchemist (src/kits/alchemy.ts): glass and gold, three reagents that react (green toxin, orange
fire, violet acid), and the Homunculus that carries all three (the art bible's Alchemy row, glass as its foil)."""
import math

from vclib import *  # noqa: F401,F403
from vclib import GOLD, PAL

PAL["vitriol"] = row("#f4ffe0", "#c8ff4a", "#4fbf2a", "#ff5ad8", "#0c1606", glass="#dcefe6", fire="#ff8a2a",
                     acid="#a04aff", gold="#e8b84a")


def toxin(ic):
    p = ic.p
    return ic.grad(p["core"], (0.35, p["hot"]), (1, p["body"]))


def glass_line(ic, d, w=1.6):
    p = ic.p
    ic.line(d, p["glass"], w, ink=True, ink_w=w + 2.6)


def flask(ic, c, r, fill, neck=5):
    """A round-bottomed flask of glass: the liquid inside, a gold collar, a cork."""
    p = ic.p
    x, y = c
    body = ic.add("shape.ellipse", x=x - r, y=y - r, width=2 * r, height=2 * r)
    ic.solid(ic.id(body), ic.grad((0, p["glass"], 0.55), (1, "#6a8a80", 0.55)), ink_w=3.6)
    liq = curve([(x - r * 0.92, y + r * 0.1), (x + r * 0.92, y - r * 0.15), (x + r * 0.6, y + r * 0.78), (x, y + r * 0.96),
                 (x - r * 0.6, y + r * 0.78)], sharp=(0, 1), k=0.6)
    ic.path(liq, fill=fill, stroke="none")
    ic.shape(poly([(x - 2.2, y - r + 0.6), (x - 2.2, y - r - neck), (x + 2.2, y - r - neck), (x + 2.2, y - r + 0.6)]),
             ic.grad((0, p["glass"], 0.7), (1, "#6a8a80", 0.6)), shadow=False, ink_w=2.6)
    ic.line(poly([(x - 3.2, y - r - neck + 1), (x + 3.2, y - r - neck + 1)], closed=False), ic.grad(GOLD[0], (1, GOLD[2])),
            2.0, ink=True, ink_w=3.6)
    ic.line(poly(arc_pts(c, r * 0.72, 200, 245, 5), closed=False), "#ffffff", 1.4, ink=False)


def vit_q(ic):
    """Toxin Dart: a fast glass dart: it stings, and leaves the green toxin on you."""
    p = ic.p
    streaks(ic, [(6, 26, 14, 28), (6, 35, 13, 35)], color=p["hot"], weight=1.8)
    ang, c = -18, (14, 34)
    body = place([(0, -3), (22, -3), (34, 0), (22, 3), (0, 3)], ang, c)
    ic.shape(poly(body), ic.grad((0, p["glass"], 0.7), (1, "#6a8a80", 0.6)))
    liq = place([(2, -1.8), (21, -1.8), (21, 1.8), (2, 1.8)], ang, c)
    ic.path(poly(liq), fill=toxin(ic), stroke="none")
    for side in (-1, 1):
        fl = place([(0, 0), (-6, side * 5), (-3, side * 1)], ang, c)
        ic.shape(poly(fl), ic.grad(GOLD[0], (1, GOLD[2])), shadow=False, ink_w=2)
    tip = place([(34, 0)], ang, c)[0]
    for x, y in ((tip[0] + 4, tip[1] + 6), (tip[0] + 8, tip[1] + 2)):
        dot(ic, x, y, 1.6, p["hot"])


def vit_w(ic):
    """Fire Vial: a vial of fire that cannot miss: it burns, and leaves the orange fire on you."""
    p = ic.p
    fire = ic.grad("#fff0c0", (0.4, "#ffc04a"), (1, p["fire"]))
    flask(ic, (30, 34), 12, fire)
    for x, ang, h, w in ((24, -110, 10, 4.4), (31, -88, 13, 5), (38, -70, 9, 4.2)):
        ic.shape(curve(place(tongue_pts(h, w, lean=0.15), ang, (x, 32))), fire, shadow=False, ink_w=2.4)
    for x, y in ((46, 18), (50, 26), (44, 12)):
        spark(ic, x, y, 2.6, "#ffc04a")


def vit_e(ic):
    """Acid Splash: a cone of violet acid in front of her shoves you back and leaves the acid on you."""
    p = ic.p
    acid = ic.grad("#f0c8ff", (0.4, p["acid"]), (1, "#4a1a8a"))
    for k, (a, L) in enumerate(((-26, 30), (-8, 36), (10, 34), (26, 28))):
        ca, sa = math.cos(math.radians(a)), math.sin(math.radians(a))
        x, y = 20 + ca * L, 30 + sa * L
        ic.shape(curve(place(tongue_pts(14, 6, lean=0.1 * (k - 1.5)), a, (20 + ca * (L - 14), 30 + sa * (L - 14)))), acid,
                 shadow=False, ink_w=2.6)
        dot(ic, x + 2, y, 1.6, "#f0c8ff")
    flask(ic, (18, 28), 8, acid, neck=4)


def vit_r(ic):
    """Homunculus: a little walking bomb climbs out at her feet with all three reagents in it, and walks at you."""
    p = ic.p
    for a, b in (((25, 44), (19, 54)), ((39, 44), (45, 54)), ((32, 46), (32, 55))):
        ic.line(poly([a, b], closed=False), ic.grad(GOLD[0], (1, GOLD[2])), 2.0, ink_w=4.2)
    x, y, r = 32, 30, 15
    body = ic.add("shape.ellipse", x=x - r, y=y - r, width=2 * r, height=2 * r)
    ic.solid(ic.id(body), ic.grad((0, p["glass"], 0.5), (1, "#4a6a60", 0.6)), ink_w=4)
    for fill, a0 in ((toxin(ic), 90), (ic.grad("#fff0c0", (1, p["fire"])), 210),
                                    (ic.grad("#f0c8ff", (1, p["acid"])), 330)):
        wedge = [(x, y)] + arc_pts((x, y), r - 2.5, a0, a0 + 116, 8)
        ic.path(curve(wedge, sharp=(0, 1, 9), k=0.3), fill=fill, stroke="none")
    disc(ic, x, y, 4.2, ic.grad("#ffffff", (1, p["accent"])), shadow=False, ink_w=2.2)
    ic.line(poly(arc_pts((x, y), r * 0.75, 200, 245, 5), closed=False), "#ffffff", 1.6, ink=False)
    ic.line(curve([(32, 15), (34, 10), (38, 8)], closed=False), "#8a6a4a", 1.6, ink_w=3.4)
    spark(ic, 39.5, 7, 3.4, p["hot"])


ICONS = {"q": vit_q, "w": vit_w, "e": vit_e, "r": vit_r}
