"""Pom of Pim and Pom (src/kits/twins.ts, twinsKit.alt): the blue twin, with a slingshot of bark; Pim's row turned
round (blue body, amber accent). Tag Out is Pim's file (pim-r)."""
import math

from vclib import *  # noqa: F401,F403
from vclib import GOLD, PAL
from draw.pim import bark, leaf

PAL["pom"] = row("#f2fbff", "#bfe8ff", "#6ac8ff", "#ffb04a", "#1a1424",
                 bark="#6e4a2a", bark_hi="#b07a40", leaf="#7fbf4a", rope="#b89a62", blue_lo="#2a6a98", amber_lo="#2a6a98")
PAL["pom"].update(lit="#1c2c3e", mid="#121a26")


def pom_q(ic):
    """Pebble: a pebble from the slingshot, quick and straight."""
    p = ic.p
    # The fork: a Y of bark, the band drawn back.
    for a, b in (((25, 47), (25, 33)), ((25, 33), (17, 22)), ((25, 33), (32, 23))):
        ic.line(poly([a, b], closed=False), bark(ic), 3.6, ink_w=6.4)
    ic.line(poly([(17, 22), (13.5, 28), (32, 23)], closed=False), ic.grad(p["hot"], (1, p["body"])), 1.4, ink=False)
    leaf(ic, (17, 22), -120, 6, fill=ic.grad("#c8f08a", (1, p["leaf"])))
    streaks(ic, [(22, 18, 37, 18), (24, 25, 38, 25)], color=p["hot"], weight=2.0)
    disc(ic, 46, 21, 5.8, ic.grad("#d8d4cc", (0.5, "#8a8478"), (1, "#3a3630")), ink_w=3.8)
    spark(ic, 44.5, 19.2, 1.6, "#ffffff")
    star(ic, 55, 21, 6, 1.4, p["hot"], points=4, ink_w=0)


def pom_w(ic):
    """Snare: a net drops on the spot and holds whoever is inside."""
    p = ic.p
    ring(ic, 32, 47, 21, 6, ic.grad(p["hot"], (1, p["body"])), w=2.2)
    c = (32, 29)
    rim = ic.add("shape.ellipse", x=c[0] - 20, y=c[1] - 13, width=40, height=26)
    ic.paint(ic.id(rim), fill=ic.grad((0, p["body"], 0.25), (1, p["blue_lo"], 0.4)), stroke="none")
    for k in range(-3, 4):
        x = c[0] + k * 5.6
        h = 13 * math.sqrt(max(0.0, 1 - (k * 5.6 / 20) ** 2))
        ic.line(poly([(x - 3, c[1] - h), (x + 3, c[1] + h)], closed=False), p["rope"], 1.3, ink=True, ink_w=2.8)
        ic.line(poly([(x + 3, c[1] - h), (x - 3, c[1] + h)], closed=False), p["rope"], 1.3, ink=True, ink_w=2.8)
    ring(ic, c[0], c[1], 20, 13, ic.grad("#e8d8a8", (1, p["rope"])), w=2.4)
    for a in range(0, 360, 60):
        x, y = c[0] + 20 * math.cos(math.radians(a)), c[1] + 13 * math.sin(math.radians(a))
        disc(ic, x, y, 2.0, ic.grad("#d8d4cc", (1, "#6a6458")), shadow=False, ink_w=2.2)
    for x in (18, 46):
        chevron(ic, (x, 47), 90, 2.6, p["core"], 1.8)


def pom_e(ic):
    """Backflip: she flips back four metres and leaves a fae popper behind, which goes off."""
    p = ic.p
    swoosh(ic, (33, 34), 15, 10, -190, 6, (p["core"], (0.5, p["hot"]), (1, p["body"])), head=0.8, ink_w=3)
    chevron(ic, (16.5, 37.5), 100, 4.4, p["core"], 2.8)
    # The popper where she stood: a paper cone, bursting in sparks.
    cone = poly([(45, 49), (51.5, 37.5), (55, 41.5)])
    ic.shape(cone, ic.grad(p["accent"], (1, "#b0601e")), shadow=False, ink_w=2.6)
    star(ic, 53.5, 38.5, 8, 2.2, ic.grad("#fff6e0", (1, p["accent"])), points=6, ink_w=2.4)
    for x, y, c in ((46, 27, p["accent"]), (57.5, 29, p["hot"]), (59, 47, "#ffd24a")):
        spark(ic, x, y, 2.4, c)


ICONS = {"q": pom_q, "w": pom_w, "e": pom_e}
