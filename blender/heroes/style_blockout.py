"""
Style blockouts for the new hero look (user, 2026-11-10: "heroes have different style, let's make one better"; a new style,
new builders, Lyra as the sample). Builds Lyra, the night archer, three ways with figkit.py: flat colours, simple forms,
no rig. Each is a direction to pick from, mix or draw over, not a finished model:

  lacquer : the weapon look on a figure (ART_BIBLE section 1): dark lacquer body, gold structure, one cream face, one glow.
            About 6 heads tall, a statue's calm.
  heroic  : the anime finisher look of the user's reference videos: about 7 heads, long legs, layered asymmetric costume.
  chibi   : groups B and C pushed to one rule: under 4 heads, big head and eyes, big hands, boots and props.

    "C:/Program Files/Blender Foundation/Blender 5.2/blender.exe" --background --factory-startup
        --python blender/heroes/style_blockout.py -- <out folder>

Writes lyra_lacquer.glb, lyra_heroic.glb, lyra_chibi.glb (unrigged, uncompressed) for the game's preview page.
"""
import math
import os
import sys

import bpy
from mathutils import Vector

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import figkit  # noqa: E402

PI = math.pi

STYLES = {
    "lacquer": dict(H=1.75, heads=6.0, head_w=0.98, neck=0.26, leg=0.52, ankle=0.045, shoulder=0.175, leg_x=0.075,
                    hip_w=0.15, hip_d=0.11, waist_w=0.105, waist_d=0.085, chest_w=0.15, chest_d=0.105, neck_r=0.038,
                    thigh_r=0.062, knee_r=0.045, ankle_r=0.032, foot=0.2, arm=0.42, upper_r=0.04, fore_r=0.034, hand=0.05,
                    eye=(0.2, 0.085), eye_x=0.19, eye_z=-0.05),
    "heroic": dict(H=1.82, heads=7.0, head_w=1.0, neck=0.3, leg=0.555, ankle=0.045, shoulder=0.17, leg_x=0.078,
                   hip_w=0.15, hip_d=0.105, waist_w=0.095, waist_d=0.078, chest_w=0.14, chest_d=0.1, neck_r=0.034,
                   thigh_r=0.068, knee_r=0.045, ankle_r=0.03, foot=0.21, arm=0.42, upper_r=0.036, fore_r=0.03, hand=0.048,
                   eye=(0.2, 0.2), eye_x=0.19, eye_z=-0.08),
    "chibi": dict(H=1.5, heads=3.5, head_w=1.06, neck=0.07, leg=0.33, ankle=0.06, shoulder=0.17, leg_x=0.085,
                  hip_w=0.165, hip_d=0.13, waist_w=0.14, waist_d=0.115, chest_w=0.16, chest_d=0.12, neck_r=0.05,
                  thigh_r=0.08, knee_r=0.07, ankle_r=0.062, foot=0.27, arm=0.36, upper_r=0.055, fore_r=0.055, hand=0.078,
                  eye=(0.19, 0.23), eye_x=0.2, eye_z=-0.1),
}


def joints(P):
    H = P["H"]
    hh = H / P["heads"]
    J = dict(H=H, hh=hh)
    J["head_c"] = Vector((0, 0, H - hh * 0.5))
    J["head_r"] = (hh * 0.40 * P["head_w"], hh * 0.44, hh * 0.5)
    J["neck_z"] = H - hh * 0.97
    J["sh_z"] = J["neck_z"] - P["neck"] * hh
    J["hip_z"] = P["leg"] * H
    J["waist_z"] = J["hip_z"] + (J["sh_z"] - J["hip_z"]) * 0.4
    J["chest_z"] = J["hip_z"] + (J["sh_z"] - J["hip_z"]) * 0.74
    J["knee_z"] = J["hip_z"] * 0.52
    J["ankle_z"] = P["ankle"] * H
    ang = math.radians(12)
    ul = P["arm"] * H * 0.5
    for s, n in ((1, "L"), (-1, "R")):
        sh = Vector((P["shoulder"] * s, 0, J["sh_z"] - 0.025))
        el = sh + Vector((math.sin(ang) * s, 0.01, -math.cos(ang))) * ul
        d2 = Vector((math.sin(ang * 0.5) * s, -0.14, -1)).normalized()
        wr = el + d2 * ul * 0.95
        J["sh" + n], J["el" + n], J["wr" + n], J["hand" + n] = sh, el, wr, wr + d2 * P["hand"] * 0.9
        J["hip" + n] = Vector((P["leg_x"] * s, 0, J["hip_z"]))
        J["knee" + n] = Vector((P["leg_x"] * s * 0.96, -0.012, J["knee_z"]))
        J["ank" + n] = Vector((P["leg_x"] * s * 0.92, 0.0, J["ankle_z"]))
    return J


def torso(f, P, J, key):
    f.loft(key, [
        ((0, 0, J["hip_z"] - 0.05), P["hip_w"] * 0.8, P["hip_d"] * 0.8),
        ((0, 0, J["hip_z"]), P["hip_w"], P["hip_d"]),
        ((0, 0, J["waist_z"]), P["waist_w"], P["waist_d"]),
        ((0, 0, J["chest_z"]), P["chest_w"], P["chest_d"]),
        ((0, 0.005, J["sh_z"] - 0.01), P["shoulder"] * 0.95, P["chest_d"] * 0.82),
        ((0, 0.005, J["sh_z"] + 0.025), P["neck_r"] * 1.5, P["neck_r"] * 1.4),
    ], cap_top=True, cap_bot=True)


def head(f, P, J, skin, eye="eye", glint="glint"):
    c, (rx, ry, rz) = J["head_c"], J["head_r"]
    f.tube(skin, [(0, 0, J["sh_z"]), (0, 0, J["neck_z"] + 0.04)], P["neck_r"], seg=12)
    f.ellipsoid(skin, c, (rx, ry, rz), seg=(28, 18))
    hh = J["hh"]
    ew, eh = P["eye"][0] * hh, P["eye"][1] * hh
    for s in (1, -1):
        x = P["eye_x"] * hh * s
        z = P["eye_z"] * hh
        y = -ry * math.sqrt(max(0.05, 1 - (x / rx) ** 2 - (z / rz) ** 2))
        f.ellipsoid(eye, c + Vector((x, y + 0.004, z)), (ew / 2, 0.012, eh / 2), seg=(16, 10))
        f.ellipsoid(glint, c + Vector((x + ew * 0.16 * s, y - 0.008, z + eh * 0.2)), (ew * 0.13, 0.006, eh * 0.13), seg=(8, 6))
    mz = (P["eye_z"] - 0.2) * hh
    f.ellipsoid(eye, c + Vector((0, -ry * math.sqrt(max(0.05, 1 - (mz / rz) ** 2)) + 0.004, mz)), (hh * 0.035, 0.008, hh * 0.008), seg=(10, 6))


def hair_cap(f, J, key, grow=1.09, back=0.3, up=0.1, brow=0.2):
    """The hair as a hood over the head, open over the face."""
    c, (rx, ry, rz) = J["head_c"], J["head_r"]
    hc = c + Vector((0, ry * back, rz * up))
    f.ellipsoid(key, hc, (rx * grow, ry * grow, rz * grow), seg=(28, 18),
                keep=lambda co: not (co.y < c.y - ry * 0.15 and co.z < c.z + rz * brow))


def legs(f, P, J, key, boot, boot_top=None, cuff=None):
    for n in ("L", "R"):
        f.tube(key, [J["hip" + n], J["knee" + n], J["ank" + n]], [P["thigh_r"], P["knee_r"], P["ankle_r"]], seg=12)
        a = J["ank" + n]
        fl = P["foot"]
        f.ellipsoid(boot, Vector((a.x, -fl * 0.3, J["ankle_z"] * 0.55)), (fl * 0.26, fl * 0.56, J["ankle_z"] * 0.75), seg=(16, 10))
        if boot_top:
            top = J["knee" + n].lerp(J["hip" + n], boot_top) if boot_top > 0 else J["ank" + n].lerp(J["knee" + n], -boot_top)
            r_top = (P["knee_r"] + (P["thigh_r"] - P["knee_r"]) * max(0, boot_top)) * 1.12
            pts = [top, J["knee" + n], a] if boot_top > 0 else [top, a]
            rr = [r_top, P["knee_r"] * 1.12, P["ankle_r"] * 1.25] if boot_top > 0 else [P["knee_r"] * 1.15, P["ankle_r"] * 1.3]
            f.tube(boot, pts, rr, seg=12)
            if cuff:
                f.torus(cuff, top, r_top * 1.02, 0.012, normal=(J["hip" + n] - J["knee" + n]))


def arm(f, P, J, n, upper, lower, hand, flare=1.0, r_scale=1.0):
    sh, el, wr = J["sh" + n], J["el" + n], J["wr" + n]
    f.tube(upper, [sh, el], [P["upper_r"] * 1.15 * r_scale, P["upper_r"] * r_scale], seg=12)
    f.tube(lower, [el, wr], [P["fore_r"] * 1.05 * r_scale, P["fore_r"] * flare * r_scale], seg=12)
    f.ellipsoid(hand, J["hand" + n], (P["hand"] * 0.62, P["hand"] * 0.72, P["hand"]), seg=(14, 10))


def bow(f, J, gold, string, length, depth, r=0.02, tilt=0.5, y=0.14, z=None):
    """The crescent bow across the back, its glowing string the chord."""
    u = Vector((math.sin(tilt), 0, math.cos(tilt)))
    b = Vector((math.cos(tilt), 0, -math.sin(tilt)))
    m = Vector((0, y, z if z is not None else J["chest_z"]))
    pts, rad = [], []
    for i in range(25):
        t = -1 + 2 * i / 24
        pts.append(m + u * (t * length / 2) - b * depth * (1 - t * t) + b * depth * 0.5)
        rad.append(r * (1 - 0.72 * abs(t)) + 0.004)
    f.tube(gold, pts, rad, seg=10, squash=((0, 1, 0), 0.55))
    f.tube(string, [pts[0], pts[-1]], 0.006, seg=6)
    f.ellipsoid(string, pts[12], (r * 1.3, r * 0.9, r * 1.3), seg=(10, 8))


def halo(f, J, gold, star, big, ring=True, stars=5, y=None):
    c, (rx, ry, rz) = J["head_c"], J["head_r"]
    hc = Vector((0, (ry + 0.07) if y is None else y, c.z + rz * 0.2))
    if ring:
        f.torus(gold, hc, big, 0.008, normal=(0, 1, 0), seg=(48, 6))
    for i in range(stars):
        a = PI * (0.12 + 0.76 * i / (stars - 1))
        p = hc + Vector((math.cos(a) * big, 0, math.sin(a) * big))
        f.star(star, p, big * (0.2 if i == stars // 2 else 0.13), big * 0.05, thick=0.014, turn=PI / 2)


# ---- the three directions --------------------------------------------------------------------------------------
def lacquer(f, P, J):
    f.mat("lacquer", "#17132b", rough=0.28, metal=0.35)
    f.mat("gold", "#c9a24a", rough=0.32, metal=0.85)
    f.mat("cream", "#efe6cc", rough=0.5)
    f.mat("skin", "#ead9c6", rough=0.55)
    f.mat("hair", "#0d0a1c", rough=0.25, metal=0.3)
    f.mat("eye", "#150f2e", rough=0.3)
    f.mat("glint", "#7ff3ff", emit="#7ff3ff", strength=1.0)
    f.mat("glow", "#7ff3ff", rough=0.3, emit="#7ff3ff", strength=1.0)
    f.mat("star", "#ffe08a", rough=0.4, metal=0.6, flat=True)
    hw = P["hip_w"]
    torso(f, P, J, "lacquer")
    legs(f, P, J, "lacquer", "lacquer")
    # a long column skirt with a cream front panel, gold at every edge
    rings = [((0, 0, J["ankle_z"] + 0.02), hw * 1.7, hw * 1.45), ((0, 0, J["knee_z"]), hw * 1.28, hw * 1.05),
             ((0, 0, J["hip_z"]), hw * 1.1, P["hip_d"] * 1.12), ((0, 0, J["waist_z"] + 0.01), P["waist_w"] * 1.06, P["waist_d"] * 1.08)]
    f.loft("lacquer", rings)
    f.loft("cream", [(c, rx + 0.006, ry + 0.006) for c, rx, ry in rings], arc=(-0.42, 0.42), seg=10)
    for a in (-0.42, 0.42):
        f.tube("gold", [(c[0] + (rx + 0.008) * math.sin(a), c[1] - (ry + 0.008) * math.cos(a), c[2]) for c, rx, ry in rings], 0.008, seg=6)
    f.loft("gold", [((0, 0, J["ankle_z"] + 0.02), hw * 1.72, hw * 1.47), ((0, 0, J["ankle_z"] + 0.06), hw * 1.66, hw * 1.42)])
    f.loft("gold", [((0, 0, J["waist_z"] - 0.035), P["waist_w"] * 1.16, P["waist_d"] * 1.2), ((0, 0, J["waist_z"] + 0.035), P["waist_w"] * 1.12, P["waist_d"] * 1.16)])
    f.tube("gold", [(0.03, -P["waist_d"] * 1.2, J["waist_z"] - 0.03), (0.04, -P["hip_d"] * 1.3, J["hip_z"] - 0.12), (0.035, -hw * 1.1, J["knee_z"] + 0.1)], 0.01, seg=6)
    f.ellipsoid("glow", (0.035, -hw * 1.1, J["knee_z"] + 0.07), (0.02, 0.014, 0.03), seg=(10, 8))
    f.torus("gold", (0, 0.005, J["sh_z"] + 0.012), P["neck_r"] * 1.75, 0.012, seg=(24, 6))
    f.ellipsoid("glow", (0, -P["chest_d"] * 0.98, J["chest_z"] + 0.03), (0.022, 0.012, 0.03), seg=(12, 8))
    for s in (1, -1):
        f.tube("gold", [(P["neck_r"] * 1.6 * s, -P["neck_r"] * 0.9, J["sh_z"] + 0.01), (P["chest_w"] * 0.45 * s, -P["chest_d"] * 0.93, J["chest_z"] + 0.06),
                        (0, -P["waist_d"] * 1.12, J["waist_z"] + 0.04)], 0.007, seg=6)
    for n, s in (("L", 1), ("R", -1)):
        arm(f, P, J, n, "lacquer", "lacquer", "skin", flare=2.1)
        f.ellipsoid("gold", J["sh" + n] + Vector((0.012 * s, 0, 0.012)), (0.062, 0.058, 0.04), seg=(14, 8))
        f.torus("gold", J["el" + n].lerp(J["wr" + n], 0.86), P["fore_r"] * 2.0, 0.009, normal=(J["wr" + n] - J["el" + n]), seg=(20, 6))
    head(f, P, J, "skin")
    hair_cap(f, J, "hair", grow=1.07, back=0.26, up=0.08, brow=0.28)
    c, (rx, ry, rz) = J["head_c"], J["head_r"]
    f.ellipsoid("hair", c + Vector((0, ry * 0.55, rz * 0.95)), (rx * 0.5, ry * 0.5, rz * 0.42), seg=(16, 10))
    f.tube("hair", [c + Vector((0, ry * 1.2, -rz * 0.2)), (0, 0.13, J["chest_z"]), (0, 0.12, J["hip_z"] - 0.05)], [0.07, 0.06, 0.02], seg=10, squash=((0, 1, 0), 0.5))
    f.torus("gold", c + Vector((0, ry * 0.3, rz * 0.98)), rx * 0.62, 0.012, normal=(0, 1, 0), seg=(24, 6), arc=(-0.25, PI + 0.25))
    halo(f, J, "gold", "star", J["hh"] * 0.78)
    bow(f, J, "gold", "glow", length=1.25, depth=0.3, r=0.024, tilt=0.55, y=0.17)


def heroic(f, P, J):
    f.mat("cloth", "#5a3fc0", rough=0.55)
    f.mat("deep", "#1c1636", rough=0.5)
    f.mat("cape", "#2a1f66", rough=0.6, double=True)
    f.mat("gold", "#d2ae55", rough=0.35, metal=0.8)
    f.mat("skin", "#f1d6c2", rough=0.55)
    f.mat("hair", "#241a4d", rough=0.45)
    f.mat("eye", "#2a1a66", rough=0.3)
    f.mat("glint", "#ffffff", emit="#ffffff", strength=0.6)
    f.mat("glow", "#7ff3ff", rough=0.3, emit="#7ff3ff", strength=1.0)
    f.mat("star", "#ffe08a", rough=0.4, metal=0.6, flat=True)
    hw = P["hip_w"]
    torso(f, P, J, "cloth")
    legs(f, P, J, "skin", "deep", boot_top=0.3, cuff="gold")
    # a short flared skirt, a long coat tail behind, a short cape off the left shoulder
    f.loft("cloth", [((0, 0, J["hip_z"] - 0.19), hw * 1.95, hw * 1.7), ((0, 0, J["hip_z"]), hw * 1.3, P["hip_d"] * 1.4),
                     ((0, 0, J["waist_z"]), P["waist_w"] * 1.05, P["waist_d"] * 1.06)])
    f.loft("gold", [((0, 0, J["hip_z"] - 0.2), hw * 1.98, hw * 1.73), ((0, 0, J["hip_z"] - 0.175), hw * 1.9, hw * 1.66)])
    f.loft("cape", [((0, 0.02, J["knee_z"] - 0.12), hw * 2.3, hw * 2.2), ((0, 0.01, J["hip_z"]), hw * 1.4, P["hip_d"] * 1.6),
                    ((0, 0, J["waist_z"]), P["waist_w"] * 1.1, P["waist_d"] * 1.15)], arc=(PI - 1.25, PI + 1.25), seg=16)
    f.loft("gold", [((0, 0, J["waist_z"] - 0.03), P["waist_w"] * 1.14, P["waist_d"] * 1.18), ((0, 0, J["waist_z"] + 0.03), P["waist_w"] * 1.1, P["waist_d"] * 1.14)])
    sx = P["shoulder"]
    f.loft("deep", [((0.02, 0, J["waist_z"] + 0.06), sx * 1.55, sx * 1.3), ((0.01, 0, J["chest_z"]), sx * 1.35, sx * 1.05),
                    ((0, 0, J["sh_z"] + 0.02), sx * 0.7, sx * 0.6)], arc=(0.35, PI + 0.9), seg=16)
    f.torus("gold", (0, 0.005, J["sh_z"] + 0.02), P["neck_r"] * 1.9, 0.011, seg=(24, 6))
    f.ellipsoid("glow", (0, -P["neck_r"] * 1.9, J["sh_z"] + 0.005), (0.02, 0.012, 0.026), seg=(12, 8))
    for n, s in (("L", 1), ("R", -1)):
        arm(f, P, J, n, "skin", "cloth", "skin", flare=2.3)
        f.torus("gold", J["el" + n], P["fore_r"] * 1.25, 0.009, normal=(J["wr" + n] - J["el" + n]), seg=(20, 6))
    head(f, P, J, "skin")
    hair_cap(f, J, "hair", grow=1.16, back=0.22, up=0.1, brow=0.3)
    c, (rx, ry, rz) = J["head_c"], J["head_r"]
    f.tube("hair", [c + Vector((0, ry * 0.9, rz * 0.9)), c + Vector((0, ry * 2.4, rz * 0.5)), (0, 0.33, J["chest_z"]), (0.04, 0.3, J["hip_z"]), (0.1, 0.24, J["knee_z"] + 0.05)],
           [0.06, 0.085, 0.075, 0.055, 0.012], seg=12)
    f.torus("gold", c + Vector((0, ry * 1.35, rz * 0.82)), 0.062, 0.012, normal=(0, 1, -0.4), seg=(20, 6))
    for s in (1, -1):
        f.tube("hair", [c + Vector((rx * 0.95 * s, -ry * 0.25, -rz * 0.1)), (P["chest_w"] * 0.75 * s, -P["chest_d"] * 0.9, J["sh_z"]), (P["chest_w"] * 0.6 * s, -P["chest_d"] * 1.05, J["chest_z"] - 0.05)],
               [0.03, 0.026, 0.006], seg=8)
    f.star("star", c + Vector((rx * 0.75, -ry * 0.75, rz * 0.55)), 0.05, 0.016, thick=0.012, normal=(0.5, -1, 0.2), turn=PI / 2)
    halo(f, J, "gold", "star", J["hh"] * 1.0, ring=False, stars=5)
    bow(f, J, "gold", "glow", length=1.45, depth=0.36, r=0.022, tilt=0.5, y=0.2)


def chibi(f, P, J):
    f.mat("cloak", "#4a34a8", rough=0.6)
    f.mat("deep", "#1c1636", rough=0.5)
    f.mat("gold", "#d2ae55", rough=0.35, metal=0.8)
    f.mat("skin", "#f3d9c4", rough=0.55)
    f.mat("hair", "#2a1f5c", rough=0.5)
    f.mat("eye", "#241a55", rough=0.3)
    f.mat("glint", "#ffffff", emit="#ffffff", strength=0.6)
    f.mat("glow", "#7ff3ff", rough=0.3, emit="#7ff3ff", strength=1.0)
    f.mat("star", "#ffe08a", rough=0.4, metal=0.6, flat=True)
    hw = P["hip_w"]
    torso(f, P, J, "deep")
    legs(f, P, J, "deep", "deep", boot_top=-0.75, cuff="gold")
    # one bell of a cloak from the shoulders to the knees, a gold hem, stars sewn on it
    rings = [((0, 0, J["knee_z"] + 0.02), hw * 2.25, hw * 2.05), ((0, 0, J["hip_z"]), hw * 1.85, hw * 1.6),
             ((0, 0, J["chest_z"]), P["shoulder"] * 1.2, P["chest_d"] * 1.35), ((0, 0, J["sh_z"] + 0.02), P["neck_r"] * 1.7, P["neck_r"] * 1.6)]
    f.loft("cloak", rings)
    f.loft("gold", [((0, 0, J["knee_z"] + 0.02), hw * 2.29, hw * 2.09), ((0, 0, J["knee_z"] + 0.065), hw * 2.22, hw * 2.02)])
    for a, zf in ((0.5, 0.25), (1.3, 0.55), (-0.7, 0.45), (-1.5, 0.2), (2.4, 0.4), (-2.5, 0.6), (0.0, 0.62)):
        z = J["knee_z"] + (J["chest_z"] - J["knee_z"]) * zf
        k = 1 - zf * 0.42
        p = Vector((hw * 2.27 * k * math.sin(a), -hw * 2.07 * k * math.cos(a), z))
        f.star("star", p, 0.04, 0.014, thick=0.012, normal=(math.sin(a), -math.cos(a), 0.25), turn=PI / 2)
    f.torus("gold", (0, 0, J["sh_z"] + 0.03), P["neck_r"] * 1.9, 0.016, seg=(24, 6))
    f.ellipsoid("glow", (0, -P["neck_r"] * 2.0, J["sh_z"] + 0.0), (0.032, 0.018, 0.04), seg=(12, 8))
    for n, s in (("L", 1), ("R", -1)):
        arm(f, P, J, n, "cloak", "cloak", "skin", flare=1.25, r_scale=1.15)
        f.torus("gold", J["el" + n].lerp(J["wr" + n], 0.9), P["fore_r"] * 1.5, 0.012, normal=(J["wr" + n] - J["el" + n]), seg=(20, 6))
    head(f, P, J, "skin")
    hair_cap(f, J, "hair", grow=1.12, back=0.2, up=0.08, brow=0.34)
    c, (rx, ry, rz) = J["head_c"], J["head_r"]
    f.tube("hair", [c + Vector((0, ry * 1.0, -rz * 0.4)), (0, 0.2, J["chest_z"]), (0, 0.24, J["hip_z"]), (0, 0.22, J["knee_z"] + 0.08)], [0.1, 0.095, 0.08, 0.03], seg=12)
    f.torus("gold", (0, 0.235, J["hip_z"] - 0.06), 0.07, 0.014, normal=(0, 0.1, 1), seg=(20, 6))
    f.star("star", c + Vector((rx * 0.7, -ry * 0.72, rz * 0.6)), 0.075, 0.024, thick=0.016, normal=(0.5, -1, 0.3), turn=PI / 2)
    halo(f, J, "gold", "star", J["hh"] * 0.72, stars=5)
    bow(f, J, "gold", "glow", length=1.5, depth=0.4, r=0.034, tilt=0.5, y=0.3, z=J["chest_z"] + 0.02)


BUILD = {"lacquer": lacquer, "heroic": heroic, "chibi": chibi}

if __name__ == "__main__":
    out = os.path.abspath(sys.argv[sys.argv.index("--") + 1])
    os.makedirs(out, exist_ok=True)
    for name, fn in BUILD.items():
        bpy.ops.wm.read_factory_settings(use_empty=True)
        P = STYLES[name]
        fig = figkit.Fig(f"lyra_{name}")
        fn(fig, P, joints(P))
        objs = fig.finish()
        tris = sum(len(o.data.polygons) for o in objs)
        bpy.ops.object.select_all(action="SELECT")
        path = os.path.join(out, f"lyra_{name}.glb")
        bpy.ops.export_scene.gltf(filepath=path, export_format="GLB", use_selection=True, export_apply=True, export_yup=True,
                                  export_animations=False, export_cameras=False, export_lights=False)
        print(f"WROTE {path} {round(os.path.getsize(path) / 1024)} KB, {tris} faces, H {P['H']} m, {P['heads']} heads")
