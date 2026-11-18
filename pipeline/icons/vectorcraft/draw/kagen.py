"""Kagen (src/heroes/sheath/): its four spell icons, a STUB made by pipeline/tools/new-hero.py.

Gate 4: draw each spell as the hero's signature shape at work, in the family's rules (vclib.py: the frame, the ink, the
light from the upper left; one idea an icon, readable at 32 px), then
    python pipeline/icons/vectorcraft/make.py kagen
writes the command files (pipeline/icons/vectorcraft/kagen/) and exports public/icons/spells/kagen-q.svg ... and the
PNGs in docs/icons/new/. Look at them at 32 px: python pipeline/tools/hero-check.py "Kagen" --only icons.
The spells: Q First Spell (bolt); W Second Spell (circle); E Third Spell (dash); R Ultimate (circle).
"""
from vclib import *  # noqa: F401,F403  the builder, the geometry and the rules
from vclib import PAL

# the palette row: core, hot, body (the accent), accent (the foil's partner), dark; as docs/ART_BIBLE.md's row for the hero
PAL["kagen"] = row("#fff6e8", "#ebe8e2", "#cf4a1c", "#ebe8e2", "#14100c")


def kagen_q(ic):
    """Q: a stand-in (a disc in the accent). Replace with the spell's picture."""
    disc(ic, 32, 32, 14, ic.grad(ic.p["hot"], (1, ic.p["body"])))


def kagen_w(ic):
    """W: a stand-in."""
    disc(ic, 32, 32, 14, ic.grad(ic.p["hot"], (1, ic.p["body"])))


def kagen_e(ic):
    """E: a stand-in."""
    disc(ic, 32, 32, 14, ic.grad(ic.p["hot"], (1, ic.p["body"])))


def kagen_r(ic):
    """R: a stand-in."""
    disc(ic, 32, 32, 14, ic.grad(ic.p["hot"], (1, ic.p["body"])))


ICONS = {"q": kagen_q, "w": kagen_w, "e": kagen_e, "r": kagen_r}
