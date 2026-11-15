"""Oblivion the Unmaker (src/kits/void.ts): black as a colour, the void's crimson at the edges of what it unmakes, a cold
cyan glint for what it swallows (art bible section 2, the Void row)."""
import math

from vclib import *  # noqa: F401,F403
from vclib import GOLD, PAL

PAL["oblivion"] = row("#ffffff", "#ffc4d4", "#ff2a55", "#7affff", "#000000", ash="#d8d4e0", deep="#8a0c2a")
PAL["oblivion"].update(lit="#2a0a14", mid="#12040a")


def void_orb(ic, c, r, rim=None):
    """A sphere of nothing: black, with the void's crimson burning round its edge."""
    p = ic.p
    glow(ic, c[0], c[1], r * 1.7, p["body"], opacity=70)
    disc(ic, c[0], c[1], r, ic.grad("#000000", (0.55, "#14030a"), (1, "#6a0a22"), kind="radial", start=[c[0] + r * 0.15, c[1] + r * 0.15],
                                    end=[c[0] + r * 1.15, c[1]]), ink_w=4)
    ic.line(poly(arc_pts(c, r * 0.72, 200, 250, 6), closed=False), p["hot"], 1.4, ink=False, opacity=85)
    e = ic.add("shape.ellipse", x=c[0] - r, y=c[1] - r, width=2 * r, height=2 * r)
    ic.paint(ic.id(e), fill="none", stroke=rim or ic.grad(p["hot"], (0.4, p["body"]), (1, p["deep"])), weight=1.9)


def obl_q(ic):
    """Gravity Slam: he brings the void down on the floor; all within it are dragged in."""
    p = ic.p
    ring(ic, 34, 45, 21, 6.2, ic.grad(p["hot"], (0.5, p["body"]), (1, p["deep"])), w=2.8)
    ring(ic, 34, 45, 11, 3.2, p["body"], w=1.8)
    for x, ang in ((54, 180), (26.5, 0)):
        chevron(ic, (x + (4 if ang == 0 else -4), 45), ang, 3.0, p["hot"], 2.2)
    streaks(ic, [(28, 7, 28, 17), (40, 6, 40, 15), (34, 4, 34, 12)], color=p["hot"], weight=2.0)
    crater = ic.add("shape.ellipse", x=27, y=42.6, width=14, height=4.8)
    ic.paint(ic.id(crater), fill="#000000", stroke="none")
    cracks(ic, (34, 45), [(-15, 9), (200, 8)], color=p["hot"], weight=1.2)
    void_orb(ic, (34, 28), 11.5)


def obl_w(ic):
    """Null Zone: a sphere of void that holds still; a bolt that enters it comes apart."""
    p = ic.p
    void_orb(ic, (35, 33), 17)
    shard(ic, (6, 12), 37, 15, 2.6, ic.grad(p["core"], (1, p["accent"])), back=0.7, ink_w=2.6)
    for x, y, a, L in ((21.5, 21.5, 30, 4.2), (24, 26, 60, 3.4), (26, 21, 10, 3)):
        shard(ic, (x, y), a, L, 1.2, p["accent"], back=0.5, shadow=False, ink_w=2.0)
    star(ic, 35, 33, 6, 1.0, p["hot"], ink_w=0)
    ic.add("object.setProps", ids=[ic.live[-1]], opacity=70)


def rift(ic, c, h, w):
    """A tear in the world: a black lens with burning crimson lips and a white-hot seam."""
    p = ic.p
    d = curve([(c[0], c[1] - h), (c[0] + w, c[1]), (c[0], c[1] + h), (c[0] - w, c[1])], sharp=(0, 2), k=0.75)
    glow(ic, c[0], c[1], w * 2.4, p["body"], opacity=70, ry=h * 1.1)
    s = ic.add("path.create", d=d)
    ic.solid(ic.id(s), "#000000", shadow=False, ink_w=4.6)
    s2 = ic.add("path.create", d=d)
    ic.paint(ic.id(s2), fill="none", stroke=ic.grad(p["hot"], (0.5, p["body"]), (1, p["deep"])), weight=1.8)
    ic.line(poly([(c[0], c[1] - h * 0.7), (c[0], c[1] + h * 0.7)], closed=False), p["hot"], 0.9, ink=False)


def obl_e(ic):
    """Phase Step: he steps into the void at one tear and out of another, and his next blow rips."""
    p = ic.p
    rift(ic, (17, 24), 10, 3.2)
    for i in range(4):
        x = 22 + i * 5.4
        ic.line(poly([(x, 23 + i * 1.4), (x + 2.8, 23.7 + i * 1.4)], closed=False), p["body"], 1.8, ink=False)
    rift(ic, (40, 31), 17, 5.6)
    for k in range(3):
        x0 = 47 + k * 3.2
        ic.line(poly([(x0, 33 + k * 2.2), (x0 + 6, 41 + k * 2.2)], closed=False), ic.grad(p["core"], (1, p["body"])), 2.2,
                ink_w=4.6)


def obl_r(ic):
    """Black Hole: a hole in the world crawls forward, its burning disc pulling everything round it in."""
    p = ic.p
    c = (32, 31)
    # The back of the accretion disc, then the hole, then its front half over it.
    back = swoosh_d(c, 23, 190, 350, 5.0, ry=8, head=0.5)
    s = ic.add("path.create", d=back)
    ic.solid(ic.id(s), ic.grad(p["deep"], (1, p["body"])), shadow=False, ink_w=2.6)
    glow(ic, c[0], c[1], 21, p["body"], opacity=80)
    disc(ic, c[0], c[1], 11.5, "#000000", ink_w=3)
    e = ic.add("shape.ellipse", x=c[0] - 11.5, y=c[1] - 11.5, width=23, height=23)
    ic.paint(ic.id(e), fill="none", stroke=ic.grad(p["core"], (0.3, p["hot"]), (1, p["body"])), weight=1.6)
    swoosh(ic, c, 23, 0, 180, 6.0, (p["core"], (0.35, p["hot"]), (1, p["body"])), ry=8, head=0.45, ink_w=2.6)
    for a, r in ((-60, 24), (-130, 22), (40, 26)):
        x, y = c[0] + r * math.cos(math.radians(a)), c[1] + r * 0.8 * math.sin(math.radians(a))
        spark(ic, x, y, 2.6, p["accent"])
    for a in (-40, -140):
        ic.line(poly(arc_pts(c, 18, a, a + 50, 6), closed=False), p["hot"], 1.4, ink=False, opacity=80)


ICONS = {"q": obl_q, "w": obl_w, "e": obl_e, "r": obl_r}
