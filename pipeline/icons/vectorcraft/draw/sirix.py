"""Sirix the Swarm Warden (src/kits/hive.ts): wasps, a barbed stinger, honeycomb chitin (the art bible's Hive row, wax as
its foil)."""
import math

from vclib import *  # noqa: F401,F403
from vclib import GOLD, PAL

PAL["sirix"] = row("#fffbe0", "#ffe08a", "#f0b020", "#7aff5a", "#120e06", wax="#f6e6b0", chitin="#3a2a10")


def amber(ic):
    p = ic.p
    return ic.grad(p["core"], (0.35, p["hot"]), (0.75, p["body"]), (1, "#8a5a08"))


def wasp(ic, c, ang, s=1.0):
    """A wasp seen from above: two wings, a thorax, a striped abdomen and its sting."""
    p = ic.p
    for side in (-1, 1):
        wx, wy = place([(1 * s, side * 4.2 * s)], ang, c)[0]
        w = ic.add("shape.ellipse", x=wx - 3.6 * s, y=wy - 1.8 * s, width=7.2 * s, height=3.6 * s,
                   rotation=ang + side * 30)
        ic.paint(ic.id(w), fill=ic.grad((0, "#ffffff", 0.9), (1, "#c8e8ff", 0.6)), stroke=p["dark"], weight=0.8)
    abd = place([(-1, 0), (-4 * s, -2.6 * s), (-9 * s, 0), (-4 * s, 2.6 * s)], ang, c)
    ic.shape(curve(abd, sharp=(2,), k=0.7), amber(ic), shadow=False, ink_w=2.2)
    for u in (-3.4, -5.6):
        a, b = place([(u * s, -2.2 * s), (u * s, 2.2 * s)], ang, c)
        ic.line(poly([a, b], closed=False), p["chitin"], 1.0 * s, ink=False)
    disc(ic, *place([(1.6 * s, 0)], ang, c)[0], 2.0 * s, ic.grad("#6a5020", (1, p["chitin"])), shadow=False, ink_w=1.8)
    disc(ic, *place([(4.2 * s, 0)], ang, c)[0], 1.5 * s, ic.grad("#6a5020", (1, p["chitin"])), shadow=False, ink_w=1.6)


def hexagon(ic, c, r, fill, ink_w=2.6):
    h = ic.add("shape.polygon", cx=c[0], cy=c[1], radius=r, sides=6, rotation=30)
    return ic.solid(ic.id(h), fill, shadow=False, ink_w=ink_w)


def sir_q(ic):
    """Barbed Stinger: a stinger flies; its barb stays in you, and he can leap to it."""
    p = ic.p
    streaks(ic, [(6, 24, 14, 26), (5, 33, 12, 34)], color=p["hot"], weight=1.8)
    ang, o, L = -14, (12, 32), 40
    body = [(0, -4.2), (0.5 * L, -3.4), (L, 0), (0.5 * L, 3.4), (0, 4.2), (-2, 0)]
    ic.shape(curve(place(body, ang, o), sharp=(2,), k=0.5), ic.grad("#7a6040", (0.5, p["chitin"]), (1, "#0a0602")))
    for u in (0.12, 0.3):
        a, b = place([(u * L, -3.9), (u * L, 3.9)], ang, o)
        ic.line(poly([a, b], closed=False), amber(ic), 2.2, ink=False)
    # The barbs: hooks along its edge, pointing back.
    for u in (0.55, 0.68, 0.81):
        w = 3.4 * (1 - u) / 0.5 + 0.4
        ic.shape(poly(place([(u * L, -w), (u * L - 5, -w - 3.4), (u * L - 2.6, -w + 0.2)], ang, o)), amber(ic), shadow=False,
                 ink_w=2)
        ic.shape(poly(place([(u * L, w), (u * L - 5, w + 3.4), (u * L - 2.6, w - 0.2)], ang, o)), amber(ic), shadow=False,
                 ink_w=2)
    tip = place([(L, 0)], ang, o)[0]
    dot(ic, tip[0] + 2.6, tip[1] + 3.2, 1.6, p["accent"])
    ic.line(curve([(46, 20), (53, 28), (49, 40)], closed=False), p["accent"], 1.4, ink=False, dash=[2, 2])
    chevron(ic, (49, 41), 110, 2.6, p["accent"], 1.8)


def sir_w(ic):
    """Hive Shell: plates of chitin close round him; every hit he takes sends a wasp back at you."""
    p = ic.p
    for q in range(-2, 3):
        for r in range(-2, 3):
            x = 32 + q * 8.6 + (r % 2) * 4.3
            y = 31 + r * 7.5
            if math.dist((x, y), (32, 31)) > 19:
                continue
            hexagon(ic, (x, y), 4.6, amber(ic) if (q + r) % 2 else ic.grad(p["wax"], (1, p["body"])), ink_w=2.2)
    ic.line(poly(arc_pts((32, 31), 23, 200, 340, 10), closed=False), ic.grad(GOLD[0], (1, GOLD[2])), 1.8, ink=True,
            ink_w=3.6)
    wasp(ic, (52, 48), -40, 1.0)


def sir_e(ic):
    """Swarm Cloud: his wasps hang over a spot as a cloud: they sting and blind whoever is inside."""
    p = ic.p
    ring(ic, 32, 50, 20, 5, p["body"], w=2.0)
    glow(ic, 32, 30, 20, p["body"], opacity=50, ry=14)
    for x, y, a, s in ((20, 24, 20, 0.9), (32, 16, -10, 1.0), (44, 24, 160, 0.9), (26, 36, 200, 0.85), (40, 37, -20, 0.95),
                       (33, 28, 40, 1.1), (50, 34, 190, 0.7), (14, 34, 0, 0.7)):
        wasp(ic, (x, y), a, s)


def sir_r(ic):
    """Swarm Surge: every wasp goes down a wide column at once: it shoves and blinds; they do not come back."""
    p = ic.p
    col = ic.add("path.create", d=poly([(10, 20), (58, 14), (58, 50), (10, 44)]))
    ic.paint(ic.id(col), fill=ic.grad((0, p["body"], 0.05), (1, p["body"], 0.35), start=[10, 32], end=[58, 32]), stroke="none")
    for x, y, s in ((16, 28, 0.6), (18, 38, 0.6), (26, 24, 0.75), (28, 33, 0.8), (27, 42, 0.75), (38, 21, 0.9), (40, 31, 1.0),
                    (38, 42, 0.9), (50, 26, 1.1), (51, 38, 1.1)):
        wasp(ic, (x, y), 0, s)
    chevron(ic, (59, 32), 0, 3.6, p["core"], 2.4)


ICONS = {"q": sir_q, "w": sir_w, "e": sir_e, "r": sir_r}
