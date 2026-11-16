"""Tempo the Unwound Hour (src/kits/chrono.ts): clock hands, an ivory dial, and the echo: every spell happens twice, the
second a pale copy of the first (the art bible's Chrono row)."""
import math

from vclib import *  # noqa: F401,F403
from vclib import GOLD, PAL

PAL["tempo"] = row("#ffffff", "#f4ffd0", "#d4ff5a", "#ff4a4a", "#0c100a", dial="#f4ecd8", dial_lo="#b8ac90")


def hand(ic, pivot, ang, L, fill=None, opacity=None):
    """A clock hand: a slim arrow with a ring near its tail, pointing along ang."""
    p = ic.p
    pts = [(-0.18 * L, 0), (-0.05 * L, -1.4), (0.62 * L, -1.0), (0.66 * L, -3.4), (L, 0), (0.66 * L, 3.4), (0.62 * L, 1.0),
           (-0.05 * L, 1.4)]
    m = ic.mark()
    ic.shape(poly(place(pts, ang, pivot)), fill or ic.grad(p["core"], (0.4, p["hot"]), (1, p["body"])), ink_w=3)
    e = ic.add("shape.ellipse", x=pivot[0] - 2.6, y=pivot[1] - 2.6, width=5.2, height=5.2)
    ic.solid(ic.id(e), ic.grad(GOLD[0], (1, GOLD[2])), shadow=False, ink_w=2.4)
    if opacity is not None:
        ic.add("object.setProps", ids=[ic.group(m)], opacity=opacity)


def dial(ic, c, r, ticks=12, fill=True):
    p = ic.p
    if fill:
        disc(ic, c[0], c[1], r, ic.grad("#ffffff", (0.45, p["dial"]), (1, p["dial_lo"])), ink_w=4.4)
        e = ic.add("shape.ellipse", x=c[0] - r, y=c[1] - r, width=2 * r, height=2 * r)
        ic.paint(ic.id(e), fill="none", stroke=ic.grad(GOLD[0], (0.4, GOLD[1]), (1, GOLD[2])), weight=1.6)
    for k in range(ticks):
        a = math.radians(k * 360 / ticks)
        r0 = r * (0.74 if k % 3 == 0 else 0.82)
        ic.line(poly([(c[0] + r0 * math.cos(a), c[1] + r0 * math.sin(a)),
                      (c[0] + r * 0.9 * math.cos(a), c[1] + r * 0.9 * math.sin(a))], closed=False),
                p["dark"] if fill else p["hot"], 1.4 if k % 3 == 0 else 0.9, ink=False)


def tem_q(ic):
    """Tick: a spinning clock hand flies at you; its echo follows the same line a moment later."""
    p = ic.p
    for r, op in ((16, 100), (11, 100)):
        ic.line(poly(arc_pts((30, 32), r, 200, 320, 8), closed=False), p["hot"], 1.6, ink=False, opacity=op)
    hand(ic, (17, 40), -28, 26, fill=ic.grad(p["hot"], (1, p["body"])), opacity=40)
    hand(ic, (28, 36), -28, 30)
    streaks(ic, [(48, 14, 54, 11)], color=p["core"], weight=1.6)


def tem_w(ic):
    """Slow Time: time thickens in a circle: everyone inside is slowed, and he is quicker."""
    p = ic.p
    glow(ic, 32, 40, 22, p["body"], opacity=40, ry=9)
    e = ic.add("shape.ellipse", x=10, y=31, width=44, height=18)
    ic.paint(ic.id(e), fill="none", stroke=p["dark"], weight=5)
    e2 = ic.add("shape.ellipse", x=10, y=31, width=44, height=18)
    ic.paint(ic.id(e2), fill="none", stroke=ic.grad(p["hot"], (1, p["body"])), weight=2.4)
    for k in range(12):
        a = math.radians(k * 30)
        ic.line(poly([(32 + 19 * math.cos(a), 40 + 7.8 * math.sin(a)), (32 + 22 * math.cos(a), 40 + 9 * math.sin(a))],
                     closed=False), p["hot"], 1.4, ink=False)
    # An hourglass over the circle: the sand running slow.
    glass = [(24, 9), (40, 9), (34, 22), (40, 35), (24, 35), (30, 22)]
    ic.shape(poly(glass), ic.grad((0, p["core"], 0.9), (1, p["body"], 0.5)), ink_w=3.4)
    ic.path(poly([(27, 12), (37, 12), (33, 19), (31, 19)]), fill=ic.grad(p["hot"], (1, p["body"])), stroke="none")
    ic.path(poly([(31, 26), (33, 26), (38, 33), (26, 33)]), fill=ic.grad(p["hot"], (1, p["body"])), stroke="none")
    for y in (8, 36):
        bar = ic.add("shape.rectangle", x=21, y=y - 1.6, width=22, height=3.2, radius=1)
        ic.solid(ic.id(bar), ic.grad(GOLD[0], (1, GOLD[2])), shadow=False, ink_w=2.4)


def tem_e(ic):
    """Time Skip: he steps out of time and back in six metres on, with a pulse; the echo pulses again."""
    p = ic.p
    ring(ic, 18, 44, 7, 2.4, p["hot"], w=1.6, dash=[1.6, 1.8])
    ring(ic, 45, 41, 11, 3.6, ic.grad(p["hot"], (1, p["body"])), w=2.4)
    ring(ic, 45, 41, 16, 5.2, p["body"], w=1.4, opacity=60)
    ic.line(curve([(18, 40), (24, 22), (38, 18), (44, 33)], closed=False), p["hot"], 1.8, ink=False, dash=[2.4, 2.2])
    chevron(ic, (44.5, 34), 80, 3.2, p["hot"], 2.2)
    dial(ic, (31, 19), 8.5)
    hand(ic, (31, 19), -60, 7)


def tem_r(ic):
    """Stolen Hour: a clock face forms over you; it strikes, slows you, and lends him your hour."""
    p = ic.p
    glow(ic, 32, 29, 24, p["body"], opacity=60)
    dial(ic, (32, 29), 20)
    hand(ic, (32, 29), -90, 15)
    hand(ic, (32, 29), 25, 10)
    ic.line(poly(arc_pts((32, 29), 13, -90, 25, 10), closed=False), p["accent"], 2.0, ink=False)
    ring(ic, 32, 52, 13, 3.2, p["accent"], w=1.8)


ICONS = {"q": tem_q, "w": tem_w, "e": tem_e, "r": tem_r}
