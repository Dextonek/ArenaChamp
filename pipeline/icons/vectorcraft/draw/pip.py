"""Pip the Wingfoot (src/kits/courier.ts): a mythic messenger in a hooded travelling cloak, small gold wings at his heels
and on his circlet, a courier's pack; letters and parcels tied with string, sealed in red."""
import math

from vclib import *  # noqa: F401,F403
from vclib import GOLD, PAL

# Proposed row "Wingfoot" (Pip; src/kits/courier.ts S): sun yellow on night blue; paper, string and the red seal as foils.
PAL["pip"] = row("#fff6dc", "#ffe8a0", "#ffd24a", "#8fb0ee", "#141c30",
                 blue="#3a6ac8", blue_lo="#24427e", paper="#eee3c4", paper_lo="#b9a47a", brown="#b98a52", brown_lo="#7a5230",
                 string="#e4d49c", red="#d9463a")
PAL["pip"].update(lit="#26365c", mid="#182238")


def wing(ic, root, ang, s=1.0, flip=1):
    """A small gold wing: three feathers fanned from the root."""
    p = ic.p
    for k, (L, w, da) in enumerate(((11, 2.4, -30), (9, 2.2, -10), (7, 2.0, 10))):
        pts = [(0, 0), (0.3 * L, w * flip), (L, 0.4 * w * flip), (0.75 * L, -0.5 * w * flip)]
        ic.shape(curve(place([(x * s, y * s) for x, y in pts], ang + da * flip, root), sharp=(0, 2), k=0.6),
                 ic.grad(GOLD[0], (0.5, "#e8c060"), (1, GOLD[1])), shadow=False, ink_w=2.2)


def letter(ic, c, ang, w=22, h=14):
    p = ic.p
    pts = [(-w / 2, -h / 2), (w / 2, -h / 2), (w / 2, h / 2), (-w / 2, h / 2)]
    ic.shape(poly(place(pts, ang, c)), ic.grad("#fffaf0", (0.5, p["paper"]), (1, p["paper_lo"])))
    ic.line(poly(place([(-w / 2, -h / 2), (0, h * 0.12), (w / 2, -h / 2)], ang, c), closed=False), p["paper_lo"], 1.3,
            ink=False)
    a, b = place([(0, -h / 2), (0, h / 2)], ang, c)
    ic.line(poly([a, b], closed=False), p["blue"], 1.6, ink=False)
    sx, sy = place([(0, h * 0.12)], ang, c)[0]
    disc(ic, sx, sy, 2.6, ic.grad("#ff8a6a", (1, "#8a1e18")), shadow=False, ink_w=2.2)


def parcel(ic, c, s=1.0):
    """A parcel in brown paper, tied with string both ways, a red seal on the knot."""
    p = ic.p
    x, y = c
    top = poly([(x - 12 * s, y - 6 * s), (x - 2 * s, y - 11 * s), (x + 12 * s, y - 7 * s), (x + 2 * s, y - 2 * s)])
    front = poly([(x - 12 * s, y - 6 * s), (x + 2 * s, y - 2 * s), (x + 2 * s, y + 12 * s), (x - 12 * s, y + 7 * s)])
    side = poly([(x + 2 * s, y - 2 * s), (x + 12 * s, y - 7 * s), (x + 12 * s, y + 7 * s), (x + 2 * s, y + 12 * s)])
    ic.shape(front, ic.grad("#e0b47a", (1, p["brown"])))
    ic.shape(side, ic.grad(p["brown"], (1, p["brown_lo"])), shadow=False, ink_w=3)
    ic.shape(top, ic.grad("#f0d0a0", (1, "#c89a62")), shadow=False, ink_w=3)
    for a, b in ((((x - 7 * s), y - 8.5 * s), (x + 7 * s, y - 4.5 * s)), ((x - 5 * s, y - 4 * s), (x - 5 * s, y + 9.5 * s)),
                 ((x + 7 * s, y - 4.5 * s), (x + 7 * s, y + 9.6 * s))):
        ic.line(poly([a, b], closed=False), p["string"], 1.2, ink=False)
    disc(ic, x - 5 * s, y - 4 * s, 2.4 * s, ic.grad("#ff8a6a", (1, "#8a1e18")), shadow=False, ink_w=2.2)


def pip_q(ic):
    """Express Letter: a letter flicked at you, on gold wings."""
    p = ic.p
    streaks(ic, [(6, 24, 16, 26), (5, 33, 14, 34), (9, 41, 17, 41)], color=p["hot"], weight=2.0)
    wing(ic, (30, 24), -150, 1.1, flip=1)
    letter(ic, (36, 32), -14)
    spark(ic, 54, 22, 3.4, p["core"])


def pip_w(ic):
    """Fragile: a parcel lands on the spot and bursts a moment later."""
    p = ic.p
    ring(ic, 32, 50, 21, 5.4, ic.grad(p["hot"], (1, p["body"])), w=2.2, dash=[3.2, 2.4])
    for a in range(-160, 0, 32):
        ca, sa = math.cos(math.radians(a)), math.sin(math.radians(a))
        ic.line(poly([(32 + ca * 17, 31 + sa * 17), (32 + ca * 23, 31 + sa * 23)], closed=False), p["hot"], 2.0)
    parcel(ic, (32, 33), 1.15)
    ic.line(poly([(26, 38), (28.5, 41), (27, 44)], closed=False), p["dark"], 1.0, ink=False)


def pip_e(ic):
    """Shortcut: a sprint on winged heels."""
    p = ic.p
    streaks(ic, [(5, 20, 18, 20), (4, 29, 15, 29), (8, 38, 17, 38)], color=p["hot"], weight=2.2)
    # A messenger's wrapped boot: soft leather to the calf, bound crosswise, a gold wing at the heel.
    sole = curve([(21, 45), (44, 45), (54, 43.5), (55.5, 46.5), (46, 48.5), (21, 48.5)], sharp=(0, 5), k=0.5)
    ic.shape(sole, ic.grad("#7a5230", (1, "#3a2414")))
    boot = curve([(22, 45), (21, 22), (31, 21), (32, 33), (42, 37), (54, 43.5), (22, 45)], sharp=(0, 1, 2, 6), k=0.55)
    ic.shape(boot, ic.grad("#e0b47a", (0.45, p["brown"]), (1, p["brown_lo"])))
    for y in (25, 30, 35):
        ic.line(poly([(21.5, y), (31.5, y + 3.5)], closed=False), p["blue"], 1.5, ink=False)
        ic.line(poly([(21.5, y + 3.5), (31.5, y)], closed=False), p["blue"], 1.5, ink=False)
    ic.line(poly([(21, 22.5), (31, 21.5)], closed=False), ic.grad(GOLD[0], (1, GOLD[1])), 1.6, ink=False)
    wing(ic, (22, 31), -165, 1.3, flip=1)

def pip_r(ic):
    """Final Delivery: a parcel with your name on it hunts you down, and bursts."""
    p = ic.p
    ring(ic, 47, 47, 10, 3.4, p["red"], w=2.2)
    ic.line(poly([(47, 42), (47, 52)], closed=False), p["red"], 1.4, ink=False)
    ic.line(poly([(39, 47), (55, 47)], closed=False), p["red"], 1.4, ink=False)
    ic.line(curve([(10, 12), (22, 10), (24, 24), (38, 26), (45, 40)], closed=False), p["hot"], 1.8, ink=False,
            dash=[2.6, 2.2])
    wing(ic, (19, 24), -160, 1.0, flip=1)
    wing(ic, (35, 24), -20, 1.0, flip=-1)
    parcel(ic, (27, 29), 0.95)
    chevron(ic, (45.5, 41.5), 60, 3.0, p["hot"], 2.2)


ICONS = {"q": pip_q, "w": pip_w, "e": pip_e, "r": pip_r}
