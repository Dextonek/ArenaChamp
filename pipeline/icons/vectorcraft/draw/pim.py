"""Pim of Pim and Pom, the Changeling Twins (src/kits/twins.ts): fae children in leaf and bark, Pim in amber with a
wooden sword, Pom in blue with a slingshot; their sign is the leaf. Tag Out (R) is one spell for both: pim-r."""
import math

from vclib import *  # noqa: F401,F403
from vclib import GOLD, PAL

# Proposed row "Changeling" (Pim and Pom; src/kits/twins.ts S): Pim's amber, Pom's blue as the accent; bark and leaf foils.
PAL["pim"] = row("#fff6e0", "#ffd24a", "#ffb04a", "#6ac8ff", "#1a1424",
                 bark="#6e4a2a", bark_hi="#b07a40", leaf="#7fbf4a", rope="#b89a62", blue_lo="#2a6a98", amber_lo="#b0601e")
PAL["pim"].update(lit="#3a2a1c", mid="#201810")


def bark(ic):
    p = ic.p
    return ic.grad("#d8a868", (0.45, p["bark_hi"]), (1, p["bark"]))


def leaf(ic, at, ang, L, fill=None, ink_w=2.4):
    """A leaf: two arcs to a point, a vein down the middle."""
    p = ic.p
    pts = [(0, 0), (0.35 * L, 0.32 * L), (L, 0), (0.35 * L, -0.32 * L)]
    ic.shape(curve(place(pts, ang, at), sharp=(0, 2), k=0.7), fill or ic.grad(p["hot"], (0.5, p["body"]), (1, p["amber_lo"])),
             shadow=False, ink_w=ink_w)
    ic.line(poly(place([(0.08 * L, 0), (0.85 * L, 0)], ang, at), closed=False), p["dark"], 0.8, ink=False, opacity=60)


def wooden_sword(ic, hilt, ang, L):
    p = ic.p
    blade = [(0, -2.6), (0.78 * L, -2.6), (L, 0), (0.78 * L, 2.6), (0, 2.6)]
    ic.shape(poly(place(blade, ang, hilt)), bark(ic))
    ic.line(poly(place([(0.05 * L, -0.6), (0.75 * L, -0.6)], ang, hilt), closed=False), "#e8c890", 1.0, ink=False)
    guard = place([(-1.6, -6), (1.6, -6), (1.6, 6), (-1.6, 6)], ang, hilt)
    ic.shape(poly(guard), ic.grad(GOLD[0], (1, GOLD[2])), shadow=False, ink_w=2.6)
    grip = place([(-1.6, -1.8), (-9, -1.8), (-9, 1.8), (-1.6, 1.8)], ang, hilt)
    ic.shape(poly(grip), ic.grad("#6a4a3a", (1, "#2a1a10")), shadow=False, ink_w=2.6)
    leaf(ic, place([(-9.5, 0)], ang, hilt)[0], ang + 160, 6)


def pim_q(ic):
    """Bonk: the wooden sword swings across a short cone."""
    p = ic.p
    swoosh(ic, (26, 40), 24, -150, -20, 7, (p["core"], (0.5, p["hot"]), (1, p["body"])), head=0.62)
    wooden_sword(ic, (24, 42), -52, 30)
    for x, y, a in ((50, 28, 40), (54, 37, 10)):
        leaf(ic, (x, y), a, 5.5)


def acorn_helm(ic, c, s=1.0):
    """Pim's acorn-cap helm: a cap of bark scales over an amber dome, a stem on top, a leaf."""
    p = ic.p
    dome = curve([(c[0] - 10 * s, c[1]), (c[0] - 8.5 * s, c[1] + 8 * s), (c[0], c[1] + 11 * s), (c[0] + 8.5 * s, c[1] + 8 * s),
                  (c[0] + 10 * s, c[1])], sharp=(0, 4), k=0.8)
    ic.shape(dome, ic.grad(p["hot"], (0.5, p["body"]), (1, p["amber_lo"])))
    cap = curve([(c[0] - 12 * s, c[1] + 1), (c[0] - 10 * s, c[1] - 7 * s), (c[0], c[1] - 10 * s), (c[0] + 10 * s, c[1] - 7 * s),
                 (c[0] + 12 * s, c[1] + 1)], sharp=(0, 4), k=0.8)
    ic.shape(cap, bark(ic))
    for k in range(-2, 3):
        ic.line(poly([(c[0] + k * 4.4 * s - 1.6, c[1] - 4 * s + abs(k)), (c[0] + k * 4.4 * s + 1.6, c[1] - 1 * s + abs(k))],
                     closed=False), p["bark"], 1.0, ink=False)
    ic.line(curve([(c[0], c[1] - 10 * s), (c[0] + 1.5 * s, c[1] - 14 * s), (c[0] + 4 * s, c[1] - 15 * s)], closed=False),
            p["bark"], 2.0, ink_w=4)
    leaf(ic, (c[0] + 4 * s, c[1] - 15 * s), -10, 7 * s, fill=ic.grad("#c8f08a", (1, p["leaf"])))


def pim_w(ic):
    """Charge: head down, he runs down the lane and bowls over whoever is in it."""
    p = ic.p
    streaks(ic, [(5, 22, 15, 22), (4, 31, 13, 31), (7, 40, 15, 40)], color=p["hot"], weight=2.2)
    lane = ic.add("path.create", d=poly([(14, 25), (44, 25), (44, 37), (14, 37)]))
    ic.paint(ic.id(lane), fill=ic.grad((0, p["body"], 0), (1, p["body"], 0.35), start=[14, 31], end=[44, 31]), stroke="none")
    # The charge: a wedge of bark pointed down the lane, its edge in amber, a leaf crest on top.
    ic.shape(poly([(18, 16), (34, 16), (48, 31), (34, 46), (18, 46), (30, 31)]), bark(ic))
    ic.line(poly([(34, 16.6), (47.2, 31), (34, 45.4)], closed=False), ic.grad(p["hot"], (1, p["body"])), 2.0, ink=False)
    leaf(ic, (26, 16), -40, 9, fill=ic.grad("#c8f08a", (1, p["leaf"])))
    star(ic, 53, 31, 9, 2.4, ic.grad(p["core"], (0.5, p["hot"]), (1, p["body"])), points=4, ink_w=2.6)


def pim_e(ic):
    """Shield Up: a little round shield of bark and a leaf, a shell of light round it for two seconds."""
    p = ic.p
    glow(ic, 32, 31, 22, p["hot"], opacity=40)
    ring(ic, 32, 31, 22, 22, ic.grad(p["core"], (1, p["body"])), w=1.6, dash=[3, 2.6])
    disc(ic, 32, 31, 15, bark(ic), ink_w=5)
    e = ic.add("shape.ellipse", x=19, y=18, width=26, height=26)
    ic.paint(ic.id(e), fill="none", stroke=ic.grad(GOLD[0], (0.4, GOLD[1]), (1, GOLD[2])), weight=1.8)
    for a in range(0, 360, 60):
        x, y = 32 + 10.5 * math.cos(math.radians(a)), 31 + 10.5 * math.sin(math.radians(a))
        dot(ic, x, y, 0.9, GOLD[1])
    leaf(ic, (25, 37), -45, 14, fill=ic.grad(p["hot"], (0.5, p["body"]), (1, p["amber_lo"])), ink_w=2.8)


def pim_r(ic):
    """Tag Out: the twins swap: an amber arrow and a blue one chase each other round."""
    p = ic.p
    for a0, colors, ang in ((200, (p["hot"], (1, p["body"])), 40), (20, ("#d6f2ff", (1, p["accent"])), 220)):
        swoosh(ic, (32, 31), 17, a0, a0 + 140, 7, colors, head=0.75, ink_w=3)
        a1 = math.radians(a0 + 140)
        tip = (32 + 17 * math.cos(a1 + 0.22), 31 + 17 * math.sin(a1 + 0.22))
        star(ic, tip[0], tip[1], 5.2, 1.2, colors[0], points=3, rotation=a0 + 140 + 90 + 90, ink_w=2.6)
    leaf(ic, (26, 33), -45, 11)
    leaf(ic, (38, 29), 135, 11, fill=ic.grad("#d6f2ff", (0.5, p["accent"]), (1, p["blue_lo"])))


ICONS = {"q": pim_q, "w": pim_w, "e": pim_e, "r": pim_r}
