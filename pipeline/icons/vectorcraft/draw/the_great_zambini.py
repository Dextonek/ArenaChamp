"""The Great Zambini the Illusionist (src/kits/magic.ts): a stage illusionist made dark and fine: a tall hat, a parted
cape in violet, cards, a saw blade, swords, and gold filigree on the edges."""
import math

from vclib import *  # noqa: F401,F403
from vclib import GOLD, PAL

# Proposed row "Illusion" (The Great Zambini; src/kits/magic.ts S): violet's ladder, the cards' red pips as the accent.
PAL["the-great-zambini"] = row("#ffffff", "#e8c8ff", "#b05aff", "#d8404a", "#120a1e",
                               purple="#7a30c8", deep="#2a1248", card="#efe8d8", card_lo="#a89e88", steel="#c4cad8")


def card(ic, c, ang, w=10, h=14, pip=True):
    p = ic.p
    r = ic.add("shape.rectangle", x=c[0] - w / 2, y=c[1] - h / 2, width=w, height=h, radius=1.4, rotation=ang)
    ic.solid(ic.id(r), ic.grad("#ffffff", (0.5, p["card"]), (1, p["card_lo"])), ink_w=3.2)
    r2 = ic.add("shape.rectangle", x=c[0] - w / 2 + 1.3, y=c[1] - h / 2 + 1.3, width=w - 2.6, height=h - 2.6, radius=0.8,
                rotation=ang)
    ic.paint(ic.id(r2), fill="none", stroke=ic.grad(GOLD[0], (1, GOLD[1])), weight=0.8)
    if pip:
        ic.shape(poly(place([(0, -3.2), (2.4, 0), (0, 3.2), (-2.4, 0)], ang, c)), ic.grad("#ff7a7a", (1, "#8a1a22")),
                 shadow=False, ink_w=1.6)


def hat(ic, c, s=1.0, fill=None):
    """A tall hat: a crown, a band, a brim."""
    p = ic.p
    x, y = c
    crown = poly([(x - 6.5 * s, y - 15 * s), (x + 6.5 * s, y - 15 * s), (x + 5.8 * s, y), (x - 5.8 * s, y)])
    ic.shape(crown, fill or ic.grad("#5a3a7a", (0.5, p["deep"]), (1, "#08040e")))
    ic.line(poly([(x - 6.2 * s, y - 15 * s), (x + 6.2 * s, y - 15 * s)], closed=False), p["hot"], 1.0, ink=False)
    band = poly([(x - 6 * s, y - 4.6 * s), (x + 6 * s, y - 4.6 * s), (x + 5.9 * s, y - 2 * s), (x - 5.9 * s, y - 2 * s)])
    ic.path(band, fill=ic.grad(p["hot"], (1, p["body"])), stroke="none")
    brim = ic.add("shape.ellipse", x=x - 10.5 * s, y=y - 2.4 * s, width=21 * s, height=4.8 * s)
    ic.solid(ic.id(brim), ic.grad("#5a3a7a", (1, "#08040e")), shadow=False, ink_w=2.8)
    ic.line(poly(arc_pts((x, y), 10.3 * s, 15, 165, 10, ry=2.2 * s), closed=False), ic.grad(GOLD[0], (1, GOLD[1])), 0.9,
            ink=False)


def zam_q(ic):
    """Card Spray: three cards flung in a fan."""
    p = ic.p
    for ang, (x, y) in ((-24, (40, 18)), (0, (46, 31)), (24, (40, 44))):
        a = math.radians(ang)
        ic.line(poly([(14 + 6 * math.cos(a), 31 + 6 * math.sin(a)), (x - 8 * math.cos(a), y - 8 * math.sin(a))],
                     closed=False), p["hot"], 1.6, ink=False, opacity=80)
        card(ic, (x, y), ang + 90, 10, 14)
    star(ic, 14, 31, 6, 1.6, ic.grad(p["core"], (1, p["hot"])), points=4, ink_w=2.2)


def zam_w(ic):
    """Sawn in Half: a saw blade slides at you."""
    p = ic.p
    streaks(ic, [(6, 22, 16, 22), (5, 31, 14, 31), (8, 40, 16, 40)], color=p["hot"], weight=2.0)
    c = (36, 31)
    teeth = []
    n = 16
    for k in range(n * 2):
        a = math.radians(k * 180 / n)
        r = 19 if k % 2 == 0 else 15.5
        teeth.append((c[0] + r * math.cos(a + (0.12 if k % 2 == 0 else 0)), c[1] + r * math.sin(a + (0.12 if k % 2 == 0 else 0))))
    ic.shape(poly(teeth), ic.grad("#ffffff", (0.45, p["steel"]), (1, "#4a4e60")))
    disc(ic, c[0], c[1], 9, ic.grad("#7a4aa0", (0.5, p["purple"]), (1, p["deep"])), shadow=False, ink_w=2.6)
    ring(ic, c[0], c[1], 9, 9, ic.grad(GOLD[0], (1, GOLD[1])), w=1.2, ink_w=1.2)
    star(ic, c[0], c[1], 5.6, 2.2, ic.grad(p["core"], (1, p["hot"])), points=5, ink_w=1.8)
    for a0 in (-40, 140):
        ic.line(poly(arc_pts(c, 23, a0, a0 + 50, 6), closed=False), p["hot"], 1.6, ink=False)


def zam_e(ic):
    """The Hat Trick: three hats shuffle; he is under one of them."""
    p = ic.p
    for x, y, s in ((15, 44, 0.85), (49, 44, 0.85)):
        hat(ic, (x, y), s)
    glow(ic, 32, 30, 12, p["body"], opacity=70)
    hat(ic, (32, 40), 1.1)
    for x0, x1, y in ((18, 28, 18), (36, 46, 18)):
        ic.line(curve([(x0, y + 4), ((x0 + x1) / 2, y - 3), (x1, y + 4)], closed=False), p["hot"], 1.6, ink=True, ink_w=3.2)
    chevron(ic, (28.5, 22), 60, 2.4, p["hot"], 1.6)
    chevron(ic, (35.5, 22), 120, 2.4, p["hot"], 1.6)
    spark(ic, 32, 13, 3.6, p["core"])


def sword(ic, tip, ang, L=16):
    p = ic.p
    blade = [(0, 0), (-0.75 * L, -1.6), (-0.75 * L, 1.6)]
    ic.shape(poly(place(blade, ang, tip)), ic.grad("#ffffff", (0.5, p["steel"]), (1, "#5a5e70")), shadow=False, ink_w=2.6)
    a, b = place([(-0.75 * L, -4), (-0.75 * L, 4)], ang, tip)
    ic.line(poly([a, b], closed=False), GOLD[1], 1.6, ink=True, ink_w=3.2)
    a, b = place([(-0.75 * L, 0), (-L, 0)], ang, tip)
    ic.line(poly([a, b], closed=False), p["purple"], 1.8, ink=True, ink_w=3.6)


def zam_r(ic):
    """The Grand Finale: three hats ring you, and swords fly from all three at the middle."""
    p = ic.p
    c = (32, 34)
    ring(ic, c[0], c[1], 20, 8, p["body"], w=1.6, dash=[2.6, 2.2])
    star(ic, c[0], c[1] - 1, 7, 1.8, ic.grad(p["core"], (1, p["accent"])), points=4, ink_w=0)
    spots = [(-90, 0.8), (30, 0.8), (150, 0.8)]
    for a, s in spots:
        x, y = c[0] + 20 * math.cos(math.radians(a)), c[1] + 15 * math.sin(math.radians(a))
        ang = math.degrees(math.atan2(c[1] - y, c[0] - x))
        tip = (x + 0.62 * (c[0] - x), y + 0.62 * (c[1] - y))
        sword(ic, tip, ang, 11)
    for a, s in spots:
        x, y = c[0] + 20 * math.cos(math.radians(a)), c[1] + 15 * math.sin(math.radians(a))
        hat(ic, (x, y + 5), s)


ICONS = {"q": zam_q, "w": zam_w, "e": zam_e, "r": zam_r}
