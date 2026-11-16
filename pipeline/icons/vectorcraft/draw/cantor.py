"""Cantor the Last Verse (src/kits/bard.ts): a lyre of night-lacquer and gold, the beat and the Crescendo, notes that
charm (the art bible's Bard row, parchment as its foil)."""
import math

from vclib import *  # noqa: F401,F403
from vclib import GOLD, PAL

PAL["cantor"] = row("#ffffff", "#ffb8e6", "#e04aa8", "#ffd24a", "#1e0a1a", parchment="#f2e6d0", deep="#7a1a5a")


def song(ic):
    p = ic.p
    return (p["core"], (0.45, p["hot"]), (1, p["body"]))


def lyre(ic, c, s=1.0):
    """A lyre: two curved horns of dark lacquer with gold tips, a crossbar, strings."""
    p = ic.p
    x, y = c
    for side in (-1, 1):
        arm = curve([(x + side * 3 * s, y + 9 * s), (x + side * 9 * s, y + 4 * s), (x + side * 8 * s, y - 6 * s),
                     (x + side * 4.5 * s, y - 12 * s)], closed=False)
        ic.line(arm, ic.grad("#8a3a7a", (1, "#2a0a24")), 3.2 * s, ink_w=6 * s)
        dot(ic, x + side * 4.5 * s, y - 12 * s, 1.8 * s, GOLD[0])
    ic.line(poly([(x - 8 * s, y - 7 * s), (x + 8 * s, y - 7 * s)], closed=False), ic.grad(GOLD[0], (1, GOLD[2])), 2.0 * s,
            ink_w=4 * s)
    base = ic.add("shape.rectangle", x=x - 5 * s, y=y + 7 * s, width=10 * s, height=4 * s, radius=1.4 * s)
    ic.solid(ic.id(base), ic.grad(GOLD[0], (1, GOLD[2])), shadow=False, ink_w=2.4)
    for k in (-2.4, 0, 2.4):
        ic.line(poly([(x + k * s, y - 7 * s), (x + k * s, y + 7 * s)], closed=False), p["parchment"], 0.8, ink=False)


def note(ic, c, s=1.0, fill=None):
    """A note: an oval head, a stem, a curling flag."""
    p = ic.p
    head = ic.add("shape.ellipse", x=c[0] - 4 * s, y=c[1] - 3 * s, width=8 * s, height=6 * s, rotation=-22)
    ic.solid(ic.id(head), fill or ic.grad(p["core"], (0.5, p["hot"]), (1, p["body"])), shadow=False, ink_w=2.6)
    ic.line(poly([(c[0] + 3.4 * s, c[1] - 1), (c[0] + 3.4 * s, c[1] - 14 * s)], closed=False), p["hot"], 1.6 * s,
            ink_w=3.8 * s)
    ic.line(curve([(c[0] + 3.4 * s, c[1] - 14 * s), (c[0] + 8 * s, c[1] - 10 * s), (c[0] + 7 * s, c[1] - 5 * s)],
                  closed=False), p["hot"], 1.6 * s, ink_w=3.8 * s)


def can_q(ic):
    """Resounding Chord: a chord in a cone; on the beat it builds the Crescendo."""
    p = ic.p
    for r, w, a in ((10, 4.0, 40), (16, 3.8, 38), (22, 3.2, 34)):
        swoosh(ic, (28, 30), r, -a, a, w, song(ic), head=0.5, ink_w=2.6)
    lyre(ic, (17, 31), 1.05)
    for k in range(5):
        dot(ic, 24 + k * 5, 52, 1.5, p["accent"] if k < 3 else p["deep"])


def can_w(ic):
    """Siren Song: a note flies at you and charms you: you walk to him and cannot act."""
    p = ic.p
    ic.line(curve([(8, 42), (18, 30), (28, 38), (36, 28)], closed=False), ic.grad((0, p["body"], 0), (1, p["hot"])), 2.6,
            ink=False)
    note(ic, (40, 30), 1.4)
    disc(ic, 52, 46, 4.4, ic.grad(p["core"], (1, p["accent"])), shadow=False, ink_w=2.4)
    for x in (45, 49):
        chevron(ic, (x - 3.5, 43), 205, 2.4, p["hot"], 1.6)


def can_e(ic):
    """Rising Chorus: the Crescendo spent as a shield, and quicker feet."""
    p = ic.p
    sh = curve([(18, 14), (32, 10), (46, 14), (46, 30), (32, 50), (18, 30)], sharp=(0, 2, 4), k=0.5)
    ic.shape(sh, ic.grad("#ffd8f0", (0.45, p["body"]), (1, p["deep"])))
    ic.line(curve([(21, 16.5), (32, 13), (43, 16.5)], closed=False), ic.grad(GOLD[0], (1, GOLD[1])), 1.2, ink=False)
    note(ic, (29, 34), 1.15, fill=ic.grad(p["core"], (1, p["accent"])))
    for x in (10, 54):
        chevron(ic, (x, 18), -90, 3.0, p["accent"], 2.2)
        ic.line(poly([(x, 19), (x, 27)], closed=False), p["accent"], 2.2)


def can_r(ic):
    """Duet: a ring closes round him and holds you both inside; each beat it pulses."""
    p = ic.p
    ring(ic, 32, 34, 25, 25, ic.grad(p["hot"], (1, p["body"])), w=2.6)
    ring(ic, 32, 34, 20, 20, p["body"], w=1.2, dash=[2.4, 2.4])
    note(ic, (22, 36), 0.95)
    note(ic, (38, 36), 0.95, fill=ic.grad(p["core"], (1, p["accent"])))
    for k in range(4):
        a = math.radians(-90 + k * 90 + 45)
        star(ic, 32 + 25 * math.cos(a), 34 + 25 * math.sin(a), 3.6, 1, p["core"], points=4, ink_w=0)


ICONS = {"q": can_q, "w": can_w, "e": can_e, "r": can_r}
