"""Mr. Ledger the Tithe-Keeper (src/kits/ledger.ts): an arcane notary of the Long Dead in black and oxblood: a great book
chained to his wrist, a quill staff, vellum notices, and the glowing red wax seal of a debt come due."""
import math

from vclib import *  # noqa: F401,F403
from vclib import GOLD, PAL

# Proposed row "Tithe / seal" (Mr. Ledger; src/kits/ledger.ts S): vellum, the seal's red, his ember eyes as the accent.
PAL["mr-ledger"] = row("#fff4e0", "#e6d9ae", "#c8302a", "#ff7a4a", "#161214",
                       vellum="#efe4c0", vellum_lo="#b9aa7c", oxblood="#7a2230", cover="#6a1a26", ink="#1c211c")
PAL["mr-ledger"].update(lit="#3a1a1e", mid="#201014")


def vellum(ic):
    p = ic.p
    return ic.grad("#fffaf0", (0.45, p["vellum"]), (1, p["vellum_lo"]))


def seal(ic, c, r):
    """A red wax seal: a lumpy disc, a sigil pressed in it, glowing faintly."""
    p = ic.p
    glow(ic, c[0], c[1], r * 1.8, p["accent"], opacity=60)
    ic.shape(blob_d(c, r, n=7, wobble=0.07), ic.grad("#ff8a6a", (0.45, p["body"]), (1, "#6a0e10")), shadow=False,
             ink_w=2.6)
    ic.line(poly([(c[0] - r * 0.45, c[1] - r * 0.1), (c[0], c[1] - r * 0.5), (c[0] + r * 0.45, c[1] - r * 0.1),
                  (c[0], c[1] + r * 0.45)]), "#7a1418", 1.0, ink=False)


def lines_on(ic, x0, x1, ys, ang=0, c=(0, 0), color=None):
    for y in ys:
        a, b = place([(x0, y), (x1, y)], ang, c)
        ic.line(poly([a, b], closed=False), color or ic.p["vellum_lo"], 1.0, ink=False)


def led_q(ic):
    """Invoice: a sealed paper flies at you: the damage goes on your tab."""
    p = ic.p
    streaks(ic, [(8, 22, 17, 25), (6, 31, 15, 33)], color=p["hot"], weight=2.0)
    c, ang = (34, 30), -18
    env = [(-15, -10), (15, -10), (15, 10), (-15, 10)]
    ic.shape(poly(place(env, ang, c)), vellum(ic))
    flap = place([(-15, -10), (0, 2), (15, -10)], ang, c)
    ic.line(poly(flap, closed=False), p["vellum_lo"], 1.4, ink=False)
    lines_on(ic, -11, 2, (5, 7.5), ang, c)
    seal(ic, place([(0, 1.5)], ang, c)[0], 4.6)


def led_w(ic):
    """Late Fee: a notice comes down on a circle: the charge on your tab, and you are slowed."""
    p = ic.p
    ring(ic, 33, 51, 19, 4.6, ic.grad(p["accent"], (1, p["body"])), w=2.2)
    chevron(ic, (33, 47.5), 90, 3.4, p["accent"], 2.2)
    # The notice: a vellum sheet with a curled top and bottom, pinned with a seal.
    sheet = poly([(21, 11), (45, 11), (44, 39), (22, 39)])
    ic.shape(sheet, vellum(ic))
    for y, r in ((11, 2.6), (39, 2.6)):
        rl = ic.add("shape.rectangle", x=19.5, y=y - r, width=27, height=2 * r, radius=r)
        ic.solid(ic.id(rl), ic.grad("#fffaf0", (1, p["vellum_lo"])), shadow=False, ink_w=2.6)
    ic.line(poly([(26, 18), (40, 18)], closed=False), p["ink"], 1.8, ink=False)
    lines_on(ic, 26, 40, (23, 26.5), color=p["vellum_lo"])
    seal(ic, (36, 32), 4.4)


def book(ic, c, w, h, open_deg=0):
    p = ic.p
    cover = ic.add("shape.rectangle", x=c[0] - w / 2, y=c[1] - h / 2, width=w, height=h, radius=1.6)
    ic.solid(ic.id(cover), ic.grad("#b8384a", (0.45, p["oxblood"]), (1, "#2a0a10")))
    pages = poly([(c[0] + w / 2 - 0.6, c[1] - h / 2 + 1.6), (c[0] + w / 2 + 2.2, c[1] - h / 2 + 2.6),
                  (c[0] + w / 2 + 2.2, c[1] + h / 2 - 0.6), (c[0] + w / 2 - 0.6, c[1] + h / 2 - 1.6)])
    ic.shape(pages, vellum(ic), shadow=False, ink_w=2.2)
    for k in (-1, 1):
        for kk in (-1, 1):
            x, y = c[0] + k * (w / 2 - 2.2), c[1] + kk * (h / 2 - 2.2)
            ic.shape(poly([(x - 2, y), (x, y - 2), (x + 2, y), (x, y + 2)]), ic.grad(GOLD[0], (1, GOLD[2])), shadow=False,
                     ink_w=1.8)
    r = ic.add("shape.rectangle", x=c[0] - w / 2 + 3.6, y=c[1] - h / 2 + 3.6, width=w - 7.2, height=h - 7.2, radius=1)
    ic.paint(ic.id(r), fill="none", stroke=ic.grad(GOLD[0], (1, GOLD[2])), weight=1.0)


def led_e(ic):
    """Call It In: the ledger is slammed shut, and the tab comes due at once."""
    p = ic.p
    for a in range(-150, -20, 26):
        ca, sa = math.cos(math.radians(a)), math.sin(math.radians(a))
        ic.line(poly([(32 + ca * 20, 33 + sa * 16), (32 + ca * 27, 33 + sa * 22)], closed=False), p["accent"], 2.2)
    book(ic, (31, 34), 26, 20)
    seal(ic, (31, 34), 5.4)
    ic.line(curve([(45, 40), (50, 46), (56, 45)], closed=False), GOLD[1], 1.6, ink_w=3.4, dash=[2, 1.4])
    for x in (12, 50):
        ic.line(poly([(x, 46), (x + (4 if x < 32 else -4), 50)], closed=False), p["hot"], 1.6, ink=False)


def led_r(ic):
    """Foreclosure: a huge stamp falls on the spot: the whole tab is paid now, and more."""
    p = ic.p
    ring(ic, 33, 49, 22, 6, ic.grad(p["accent"], (1, p["body"])), w=2.4)
    mark = ic.add("shape.ellipse", x=21, y=45, width=24, height=8)
    ic.paint(ic.id(mark), fill=p["body"], stroke="none")
    ic.add("object.setProps", ids=[ic.id(mark)], opacity=70)
    # The stamp: a dark handle with a gold knob, a broad oxblood block, its red face.
    knob = ic.add("shape.ellipse", x=27.5, y=4.5, width=11, height=8)
    ic.solid(ic.id(knob), ic.grad(GOLD[0], (0.5, GOLD[1]), (1, GOLD[2])), ink_w=3)
    neck = poly([(30.5, 11), (35.5, 11), (36.5, 22), (29.5, 22)])
    ic.shape(neck, ic.grad("#5a4048", (1, "#1a0e12")), shadow=False, ink_w=3)
    block = poly([(19, 22), (47, 22), (49, 35), (17, 35)])
    ic.shape(block, ic.grad("#b8384a", (0.45, p["oxblood"]), (1, "#2a0a10")))
    ic.line(poly([(19.5, 23), (46.5, 23)], closed=False), ic.grad(GOLD[0], (1, GOLD[1])), 1.3, ink=False)
    face = poly([(16.5, 35), (49.5, 35), (49.5, 39), (16.5, 39)])
    ic.shape(face, ic.grad("#ff8a6a", (0.5, p["body"]), (1, "#6a0e10")), shadow=False, ink_w=2.6)
    for x in (12, 54):
        ic.line(poly([(x, 24), (x, 33)], closed=False), p["core"], 1.8)


ICONS = {"q": led_q, "w": led_w, "e": led_e, "r": led_r}
