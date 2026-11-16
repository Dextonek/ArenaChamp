"""Cantor the Last Verse (src/kits/bard.ts): a lyre of night-lacquer and gold, the beat and the Crescendo, notes that
charm (the art bible's Bard row, parchment as its foil).

Redrawn 2026-11-16 (the parent's decision 7: "the pink notes redrawn as engraved gold"): the notes are engraved gold glyphs
(the icon round offered it: docs/icons/index.html, batch 5), the one gold object of each icon, as Sefu's sarcophagus is his;
the song, the shield and the ring are night-lacquer plum with a parchment light and a gold edge, the candy pink gone."""
import math

from vclib import *  # noqa: F401,F403
from vclib import GOLD, PAL

PAL["cantor"] = row("#ffffff", "#ffb8e6", "#e04aa8", "#ffd24a", "#1e0a1a", parchment="#f2e6d0", deep="#7a1a5a")


PLUM = ("#5a1a48", "#3a0c2e", "#24081c")  # lacquered plum: lit, body, deep (the row's deep and dark, warmed)


def song(ic):
    """The song's colour: parchment light at the upper left into lacquered plum (no candy pink)."""
    p = ic.p
    return (p["parchment"], (0.4, "#c58aa8"), (1, PLUM[0]))


def gilt(ic):
    return ic.grad(GOLD[0], (0.5, GOLD[1]), (1, GOLD[2]))


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
    """A note as an engraved gold glyph: an oval head, a stem, a curling flag, gold lit from the upper left, with a line cut
    into the head and a pale highlight along the flag."""
    head = ic.add("shape.ellipse", x=c[0] - 4 * s, y=c[1] - 3 * s, width=8 * s, height=6 * s, rotation=-22)
    ic.solid(ic.id(head), fill or gilt(ic), shadow=True, ink_w=2.6)
    stem = poly([(c[0] + 3.4 * s, c[1] - 1), (c[0] + 3.4 * s, c[1] - 14 * s)], closed=False)
    ic.line(stem, ic.grad(GOLD[0], (1, GOLD[1])), 1.8 * s, ink_w=4.0 * s)
    flag = curve([(c[0] + 3.4 * s, c[1] - 14 * s), (c[0] + 8 * s, c[1] - 10 * s), (c[0] + 7 * s, c[1] - 5 * s)], closed=False)
    ic.line(flag, ic.grad(GOLD[0], (1, GOLD[1])), 1.8 * s, ink_w=4.0 * s)
    # the engraving: a cut across the head, and the flag's lit edge
    ic.line(curve([(c[0] - 2.4 * s, c[1] + 0.9 * s), (c[0] + 0.2 * s, c[1] - 0.2 * s), (c[0] + 2.4 * s, c[1] - 1.6 * s)],
                  closed=False), GOLD[2], 0.7 * s, ink=False)
    ic.line(curve([(c[0] + 3.9 * s, c[1] - 13.2 * s), (c[0] + 7.2 * s, c[1] - 10 * s)], closed=False), "#fff4d0", 0.6 * s,
            ink=False)


def can_q(ic):
    """Resounding Chord: a chord in a cone; on the beat it builds the Crescendo."""
    p = ic.p
    for r, w, a in ((10, 4.0, 40), (16, 3.8, 38), (22, 3.2, 34)):
        swoosh(ic, (28, 30), r, -a, a, w, song(ic), head=0.5, ink_w=2.6)
    lyre(ic, (17, 31), 1.05)
    for k in range(5):
        dot(ic, 24 + k * 5, 52, 1.5, GOLD[1] if k < 3 else PLUM[0])


def can_w(ic):
    """Siren Song: a note flies at you and charms you: you walk to him and cannot act."""
    p = ic.p
    ic.line(curve([(8, 42), (18, 30), (28, 38), (36, 28)], closed=False), ic.grad((0, PLUM[0], 0), (1, "#c58aa8")), 2.6,
            ink=False)
    note(ic, (40, 30), 1.4)
    disc(ic, 52, 46, 4.4, ic.grad(p["parchment"], (1, "#c58aa8")), shadow=False, ink_w=2.4)
    for x in (45, 49):
        chevron(ic, (x - 3.5, 43), 205, 2.4, p["parchment"], 1.6)


def can_e(ic):
    """Rising Chorus: the Crescendo spent as a shield, and quicker feet."""
    p = ic.p
    sh = curve([(18, 14), (32, 10), (46, 14), (46, 30), (32, 50), (18, 30)], sharp=(0, 2, 4), k=0.5)
    ic.shape(sh, ic.grad("#b07098", (0.4, "#6a2456"), (1, PLUM[2])))
    ic.line(sh, ic.grad(GOLD[0], (1, GOLD[2])), 1.7, ink=False)
    ic.line(curve([(21, 16.5), (32, 13), (43, 16.5)], closed=False), ic.grad(GOLD[0], (1, GOLD[1])), 1.2, ink=False)
    note(ic, (29, 34), 1.15)
    for x in (10, 54):
        chevron(ic, (x, 18), -90, 3.0, GOLD[0], 2.2)
        ic.line(poly([(x, 19), (x, 27)], closed=False), GOLD[1], 2.2)


def can_r(ic):
    """Duet: a ring closes round him and holds you both inside; each beat it pulses."""
    p = ic.p
    ring(ic, 32, 34, 25, 25, ic.grad("#8a4a76", (1, PLUM[1])), w=3.0)
    ring(ic, 32, 34, 25, 25, ic.grad(GOLD[0], (1, GOLD[2])), w=0.9, ink_w=0.1)
    ring(ic, 32, 34, 20, 20, p["parchment"], w=1.0, dash=[2.4, 2.4], opacity=70)
    note(ic, (22, 36), 0.95)
    note(ic, (38, 36), 0.95)
    for k in range(4):
        a = math.radians(-90 + k * 90 + 45)
        star(ic, 32 + 25 * math.cos(a), 34 + 25 * math.sin(a), 3.6, 1, GOLD[0], points=4, ink_w=0)


ICONS = {"q": can_q, "w": can_w, "e": can_e, "r": can_r}
