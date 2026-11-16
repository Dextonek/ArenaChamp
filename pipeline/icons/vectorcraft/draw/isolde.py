"""Isolde the Winter Warden (src/kits/frost.ts): icicles, rime and the Chill that shatters (the art bible's Frost row,
rime as its foil)."""
import math

from vclib import *  # noqa: F401,F403
from vclib import GOLD, PAL

PAL["isolde"] = row("#f6fcff", "#c9efff", "#4fb4e8", "#ff9ec4", "#081626", rime="#e8f4fa", deep="#1f5a8a")


def ice(ic):
    p = ic.p
    return ic.grad("#ffffff", (0.35, p["hot"]), (0.75, p["body"]), (1, p["deep"]))


def snowflake(ic, c, r, w=1.8):
    p = ic.p
    for k in range(6):
        a = math.radians(k * 60 - 90)
        tip = (c[0] + r * math.cos(a), c[1] + r * math.sin(a))
        ic.line(poly([c, tip], closed=False), p["core"], w, ink=True, ink_w=w + 2.4)
        for side in (-1, 1):
            b = (c[0] + r * 0.6 * math.cos(a), c[1] + r * 0.6 * math.sin(a))
            e = (b[0] + r * 0.3 * math.cos(a + side * 0.9), b[1] + r * 0.3 * math.sin(a + side * 0.9))
            ic.line(poly([b, e], closed=False), p["core"], w * 0.8, ink=False)


def iso_q(ic):
    """Icicle: a piercing icicle; it sticks where it ends, and shatters when she says."""
    p = ic.p
    streaks(ic, [(6, 20, 15, 22), (5, 29, 13, 30)], color=p["hot"], weight=1.8)
    shard(ic, (12, 26), -18, 40, 5, ice(ic), back=0.15)
    ic.line(poly(place([(2, 0), (36, 0)], -18, (12, 26)), closed=False), "#ffffff", 1.0, ink=False)
    shard(ic, (44, 52), -80, 14, 3, ice(ic), back=0.2, ink_w=2.6)
    for x, y, a in ((38, 48, -140), (51, 47, -40)):
        shard(ic, (x, y), a, 5, 1.4, ice(ic), back=0.3, shadow=False, ink_w=2)


def iso_w(ic):
    """Hoarfrost: frost bites you where you stand."""
    p = ic.p
    glow(ic, 32, 30, 20, p["body"], opacity=70)
    for k in range(8):
        a = k * 45 + 22.5
        x, y = 32 + 22 * math.cos(math.radians(a)), 30 + 22 * math.sin(math.radians(a))
        shard(ic, (x, y), a + 180, 10, 2.6, ice(ic), back=0.25, shadow=False, ink_w=2.6)
    snowflake(ic, (32, 30), 11, 2.0)
    disc(ic, 32, 30, 2.6, p["core"], shadow=False, ink_w=2)


def iso_e(ic):
    """Rime Armour: rime grows over her as armour; whoever strikes her is chilled."""
    p = ic.p
    sh = curve([(17, 12), (32, 8), (47, 12), (47, 30), (32, 52), (17, 30)], sharp=(0, 2, 4), k=0.5)
    ic.shape(sh, ice(ic))
    ic.line(curve([(20, 14.5), (32, 11), (44, 14.5)], closed=False), ic.grad(GOLD[0], (1, GOLD[1])), 1.2, ink=False)
    snowflake(ic, (32, 27), 9, 1.6)
    for x, y, a in ((12, 22, 200), (52, 22, -20), (50, 40, 20), (14, 40, 160)):
        shard(ic, (x, y), a, 7, 1.8, ice(ic), back=0.3, shadow=False, ink_w=2.2)


def iso_r(ic):
    """Winter's Shatter: her fist closes on you, and all your Chill shatters at once."""
    p = ic.p
    for k in range(10):
        a = k * 36 + 10
        ca, sa = math.cos(math.radians(a)), math.sin(math.radians(a))
        shard(ic, (32 + ca * 12, 30 + sa * 12), a, 13 if k % 2 else 9, 2.6, ice(ic), back=0.2, shadow=False, ink_w=2.4)
    crystal = ic.add("shape.polygon", cx=32, cy=30, radius=10, sides=6, rotation=0)
    ic.solid(ic.id(crystal), ice(ic), ink_w=4)
    for a, b in (((26, 26), (32, 31)), ((32, 31), (36, 24)), ((32, 31), (34, 38))):
        ic.line(poly([a, b], closed=False), p["dark"], 1.2, ink=False)
    for k in range(5):
        disc(ic, 24 + k * 6, 53 - abs(k - 2) * 0.0, 1.9, ic.grad(p["core"], (1, p["accent"])), shadow=False, ink_w=1.8)


ICONS = {"q": iso_q, "w": iso_w, "e": iso_e, "r": iso_r}
