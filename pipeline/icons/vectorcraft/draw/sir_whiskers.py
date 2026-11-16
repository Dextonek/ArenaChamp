"""Sir Whiskers the Lynx Duelist (src/kits/cat.ts): a lynx-folk duellist in gunmetal plate with gold edges, a wine cape,
a rapier with a gem, ear tufts, and his nine lives, drawn as gems."""
import math

from vclib import *  # noqa: F401,F403
from vclib import GOLD, PAL

# Proposed row "Lynx" (Sir Whiskers; src/kits/cat.ts S): his tawny gold, the plume's red as the accent, gunmetal foils.
PAL["sir-whiskers"] = row("#fff6e0", "#ffc060", "#e8a13a", "#c8423a", "#2a1608",
                          plate="#3c4458", steel="#c4ced8", steel_lo="#7d8a98", cape="#5a1f2e", fur="#c68a4a",
                          clay="#b5653a", clay_lo="#6e3a20")


def steel(ic):
    p = ic.p
    return ic.grad("#ffffff", (0.45, p["steel"]), (1, p["steel_lo"]))


def wh_q(ic):
    """Scratch: three claw strokes at once, and his next blow is ready."""
    p = ic.p
    for r in (34, 41, 48):
        swoosh(ic, (60, 62), r, -172, -100, 4.2, (p["core"], (0.4, p["hot"]), (1, p["body"])), head=0.5, ink_w=2.6)
    star(ic, 47, 15, 7, 1.8, p["core"], points=4, ink_w=2.2)


def pot(ic, c, ang, s=1.0):
    """A clay pot: round belly, narrow neck, a gold band."""
    p = ic.p
    pts = [(-3.4, -11), (3.4, -11), (3, -8), (8.5, -3), (9.5, 3), (6.5, 9), (-6.5, 9), (-9.5, 3), (-8.5, -3), (-3, -8)]
    ic.shape(curve(place([(x * s, y * s) for x, y in pts], ang, c), sharp=(0, 1, 6, 7), k=0.6),
             ic.grad("#e8a070", (0.45, p["clay"]), (1, p["clay_lo"])))
    a, b = place([(-8.6 * s, -1.4 * s), (8.6 * s, -1.4 * s)], ang, c)
    ic.line(poly([a, b], closed=False), ic.grad(GOLD[0], (1, GOLD[1])), 1.4, ink=False)
    a, b = place([(2.4 * s, 1 * s), (5 * s, 6.5 * s)], ang, c)
    ic.line(poly([a, (a[0] + 1.6, a[1] + 2.4), b], closed=False), p["dark"], 1.0, ink=False)


def wh_w(ic):
    """Knock It Over: a pot pushed off the cover falls on the spot."""
    p = ic.p
    ring(ic, 34, 50, 15, 4.2, ic.grad(p["hot"], (1, p["body"])), w=2.2)
    sh = ic.add("shape.ellipse", x=26, y=47.8, width=16, height=4.4)
    ic.paint(ic.id(sh), fill=p["dark"], stroke="none")
    ic.add("object.setProps", ids=[ic.id(sh)], opacity=70)
    for x in (26, 42):
        ic.line(poly([(x, 9), (x, 17)], closed=False), p["core"], 1.8)
    pot(ic, (34, 28), 24, 1.25)
    for r in (13,):
        ic.line(poly(arc_pts((34, 28), r + 4, 200, 250, 6), closed=False), p["hot"], 1.6, ink=False)


def lynx(ic, c, s=1.0, ang=0):
    """A lynx at full stretch, leaping: tufted ears, a short tail, legs reaching."""
    p = ic.p
    pts = [(-14, 1), (-9, -3), (-1, -4.5), (7, -4), (11, -7), (13.5, -9.5), (14, -6.5), (17, -6), (19, -3), (16, -1.5),
           (12, -0.5), (10, 2), (16, 6), (14, 7.5), (7, 3.5), (-3, 3), (-10, 6), (-17, 8), (-17.5, 6), (-11, 3)]
    ic.shape(curve(place([(x * s, y * s) for x, y in pts], ang, c), k=0.5),
             ic.grad("#f0c890", (0.45, p["fur"]), (1, "#6a4020")))
    tuft = place([(13.2 * s, -9.4 * s), (12.6 * s, -12.5 * s)], ang, c)
    ic.line(poly(tuft, closed=False), p["dark"], 1.0, ink=False)
    ex, ey = place([(15 * s, -4.4 * s)], ang, c)[0]
    dot(ic, ex, ey, 0.8 * s, p["hot"])


def wh_e(ic):
    """Cat Leap: he spends a life and leaps seven metres onto you."""
    p = ic.p
    ic.line(curve([(10, 46), (20, 20), (36, 13), (52, 32)], closed=False), p["hot"], 1.6, ink=False, dash=[2.6, 2.4])
    lynx(ic, (30, 26), 1.2, 16)
    star(ic, 51, 43, 9, 2.4, ic.grad(p["core"], (0.5, p["hot"]), (1, p["body"])), points=4, ink_w=2.8)
    # The life he spends: a gem going dark.
    gem = ic.add("shape.polygon", cx=13, cy=15, radius=4.4, sides=4, rotation=0)
    ic.solid(ic.id(gem), ic.grad("#8a6a5a", (1, "#2a1a14")), shadow=False, ink_w=2.6)
    ic.line(poly([(11, 12.5), (14.5, 17.5)], closed=False), p["hot"], 1.0, ink=False)


def wh_r(ic):
    """Land on My Feet: nine lives round a lynx's eye; the next one he would lose is kept."""
    p = ic.p
    for k in range(9):
        a = math.radians(-90 + k * 40)
        x, y = 32 + 21 * math.cos(a), 31 + 21 * math.sin(a)
        lit = k != 8
        gem = ic.add("shape.polygon", cx=x, cy=y, radius=3.4 if lit else 3.0, sides=4, rotation=k * 40)
        ic.solid(ic.id(gem), ic.grad(p["core"], (0.4, p["hot"]), (1, p["body"])) if lit else ic.grad("#7a5a4a", (1, "#2a1a14")),
                 shadow=False, ink_w=2.4)
    eye = curve([(14, 31), (32, 18), (50, 31), (32, 44)], sharp=(0, 2), k=0.75)
    ic.shape(eye, ic.grad(p["core"], (0.35, p["hot"]), (0.8, p["body"]), (1, "#a8601a")), ink_w=4.4)
    pupil = curve([(32, 20.5), (35.4, 31), (32, 41.5), (28.6, 31)], sharp=(0, 2), k=0.7)
    ic.path(pupil, fill=p["dark"], stroke="none")
    spark(ic, 27, 26, 2.6, "#ffffff")
    ic.line(curve([(14, 31), (32, 18), (50, 31)], closed=False), ic.grad(GOLD[0], (1, GOLD[2])), 1.2, ink=False)


ICONS = {"q": wh_q, "w": wh_w, "e": wh_e, "r": wh_r}
