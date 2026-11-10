"""
Second round of style blockouts (user, 2026-11-10, after the lacquer / heroic / chibi round: "let's try some unique
design"). Three bolder directions for Lyra, each a way of making a whole figure rather than a costume:

  figurine : a jointed lacquer puppet, a precious game piece: rigid lacquer segments, gold ball joints, a porcelain mask
             face with painted eyes, a skirt of rigid lacquer petals. Nothing bends, so nothing can clip or stretch.
  spirit   : a masked spirit: one tall cloak with no legs, a hood with a floating crescent mask and glowing eyes, hands
             that float free in gold cuffs, a long ribbon. The silhouette is the character.
  origami  : folded paper and gold leaf: every surface a flat fold, a paper mantle like a crane's wings, gold along
             the creases, diamond eyes.

    blender --background --factory-startup --python blender/heroes/style_blockout2.py -- <out folder>

Writes lyra_figurine.glb, lyra_spirit.glb, lyra_origami.glb (unrigged) for the game's preview page.
"""
import math
import os
import sys

import bpy
from mathutils import Vector

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import figkit  # noqa: E402
from style_blockout import arm, bow, hair_cap, halo, head, joints, legs, torso  # noqa: E402

PI = math.pi

STYLES = {
    "figurine": dict(H=1.62, heads=4.6, head_w=1.0, neck=0.14, leg=0.47, ankle=0.05, shoulder=0.19, leg_x=0.08,
                     hip_w=0.13, hip_d=0.105, waist_w=0.08, waist_d=0.07, chest_w=0.16, chest_d=0.115, neck_r=0.034,
                     thigh_r=0.056, knee_r=0.046, ankle_r=0.04, foot=0.22, arm=0.41, upper_r=0.036, fore_r=0.036, hand=0.06,
                     eye=(0.25, 0.07), eye_x=0.2, eye_z=-0.06),
    "spirit": dict(H=1.85, heads=5.4, head_w=1.0, neck=0.2, leg=0.5, ankle=0.045, shoulder=0.2, leg_x=0.08,
                   hip_w=0.15, hip_d=0.11, waist_w=0.1, waist_d=0.085, chest_w=0.15, chest_d=0.105, neck_r=0.036,
                   thigh_r=0.06, knee_r=0.045, ankle_r=0.032, foot=0.2, arm=0.42, upper_r=0.04, fore_r=0.034, hand=0.062,
                   eye=(0.2, 0.09), eye_x=0.19, eye_z=-0.05),
    "origami": dict(H=1.72, heads=5.4, head_w=1.0, neck=0.22, leg=0.52, ankle=0.045, shoulder=0.18, leg_x=0.078,
                    hip_w=0.15, hip_d=0.11, waist_w=0.095, waist_d=0.08, chest_w=0.15, chest_d=0.105, neck_r=0.036,
                    thigh_r=0.06, knee_r=0.045, ankle_r=0.034, foot=0.2, arm=0.42, upper_r=0.038, fore_r=0.034, hand=0.052,
                    eye=(0.2, 0.12), eye_x=0.2, eye_z=-0.06),
}


def figurine(f, P, J):
    f.mat("lacquer", "#17132b", rough=0.22, metal=0.4, double=True)
    f.mat("violet", "#4a34a8", rough=0.3, metal=0.3, double=True)
    f.mat("gold", "#c9a24a", rough=0.3, metal=0.9)
    f.mat("mask", "#efe6cc", rough=0.35)
    f.mat("hair", "#0d0a1c", rough=0.2, metal=0.35)
    f.mat("eye", "#150f2e", rough=0.3)
    f.mat("glint", "#7ff3ff", emit="#7ff3ff", strength=1.0)
    f.mat("glow", "#7ff3ff", rough=0.3, emit="#7ff3ff", strength=1.0)
    f.mat("star", "#ffe08a", rough=0.4, metal=0.6, flat=True)
    hw, hd, ww, wd, sx = P["hip_w"], P["hip_d"], P["waist_w"], P["waist_d"], P["shoulder"]
    # the chest piece, a gold ball for a waist, the hip piece
    f.loft("lacquer", [((0, 0, J["waist_z"] + 0.035), ww * 0.85, wd * 0.85), ((0, 0, J["chest_z"]), P["chest_w"], P["chest_d"]),
                       ((0, 0.005, J["sh_z"] - 0.01), sx * 0.96, P["chest_d"] * 0.85), ((0, 0.005, J["sh_z"] + 0.03), P["neck_r"] * 1.7, P["neck_r"] * 1.6)],
           cap_top=True, cap_bot=True)
    f.ellipsoid("gold", (0, 0, J["waist_z"]), (ww * 0.9, wd * 0.9, 0.05), seg=(18, 10))
    f.loft("lacquer", [((0, 0, J["hip_z"] - 0.06), hw * 0.7, hd * 0.7), ((0, 0, J["hip_z"]), hw, hd), ((0, 0, J["waist_z"] - 0.035), ww * 0.95, wd * 0.95)],
           cap_top=True, cap_bot=True)
    f.ellipsoid("glow", (0, -P["chest_d"] * 0.97, J["chest_z"] + 0.02), (0.028, 0.012, 0.038), seg=(12, 8))
    f.torus("gold", (0, -P["chest_d"] * 0.95, J["chest_z"] + 0.02), 0.045, 0.007, normal=(0, 1, 0), seg=(20, 6))
    # legs in two rigid pieces, gold balls at hip, knee and ankle, a flared boot
    for n in ("L", "R"):
        hip, knee, ank = J["hip" + n], J["knee" + n], J["ank" + n]
        f.ellipsoid("gold", hip, (P["thigh_r"] * 0.95,) * 3, seg=(14, 10))
        f.tube("lacquer", [hip.lerp(knee, 0.1), hip.lerp(knee, 0.9)], [P["thigh_r"], P["knee_r"] * 0.85], seg=14)
        f.ellipsoid("gold", knee, (P["knee_r"] * 1.05,) * 3, seg=(14, 10))
        f.tube("violet", [knee.lerp(ank, 0.12), ank + Vector((0, 0, 0.02))], [P["knee_r"] * 0.8, P["ankle_r"] * 2.0], seg=14)
        f.torus("gold", ank + Vector((0, 0, 0.022)), P["ankle_r"] * 2.02, 0.009, seg=(20, 6))
        f.ellipsoid("lacquer", Vector((ank.x, -P["foot"] * 0.3, J["ankle_z"] * 0.5)), (P["foot"] * 0.27, P["foot"] * 0.55, J["ankle_z"] * 0.7), seg=(16, 10))
    # the skirt: six rigid petals hung from the waist, the front one cream, gold along every rim
    for i in range(6):
        ac = i * 2 * PI / 6
        a0, a1 = ac - 0.44, ac + 0.44
        key = "mask" if i == 0 else ("violet" if i % 2 else "lacquer")
        rings = [((0, 0, J["knee_z"] - 0.1), hw * 2.15, hw * 1.95), ((0, 0, J["hip_z"] - 0.05), hw * 1.55, hd * 1.7), ((0, 0, J["waist_z"] - 0.03), ww * 1.3, wd * 1.35)]
        f.loft(key, rings, arc=(a0, a1), seg=6)
        c, rx, ry = rings[0]
        rim = [(rx * math.sin(a0 + (a1 - a0) * k / 8), -ry * math.cos(a0 + (a1 - a0) * k / 8), c[2]) for k in range(9)]
        side = lambda a: [(r[1] * math.sin(a), -r[2] * math.cos(a), r[0][2]) for r in rings]  # noqa: E731
        f.tube("gold", list(reversed(side(a0))) + rim[1:-1] + side(a1), 0.007, seg=6)
    f.torus("gold", (0, 0, J["waist_z"] - 0.03), ww * 1.34, 0.012, seg=(28, 6))
    # arms: ball, thin upper piece, ball, a bell of a forearm, gold cuff, a porcelain hand
    for n, s in (("L", 1), ("R", -1)):
        sh, el, wr = J["sh" + n], J["el" + n], J["wr" + n]
        f.ellipsoid("gold", sh, (0.05, 0.05, 0.05), seg=(14, 10))
        f.tube("lacquer", [sh.lerp(el, 0.14), sh.lerp(el, 0.9)], [P["upper_r"] * 1.05, P["upper_r"] * 0.8], seg=12)
        f.ellipsoid("gold", el, (P["upper_r"] * 1.0,) * 3, seg=(12, 8))
        f.tube("violet", [el.lerp(wr, 0.12), wr], [P["fore_r"] * 0.85, P["fore_r"] * 2.3], seg=14)
        f.torus("gold", wr, P["fore_r"] * 2.32, 0.008, normal=(wr - el), seg=(20, 6))
        f.ellipsoid("mask", J["hand" + n], (P["hand"] * 0.6, P["hand"] * 0.7, P["hand"]), seg=(14, 10))
    f.ellipsoid("gold", (0, 0.005, J["sh_z"] + 0.035), (P["neck_r"] * 1.5,) * 3, seg=(14, 10))
    head(f, P, J, "mask")
    c, (rx, ry, rz) = J["head_c"], J["head_r"]
    # painted marks on the mask: a gold star on the brow, a cyan tear line
    f.star("star", c + Vector((0, -ry * 0.93, rz * 0.42)), 0.03, 0.01, thick=0.008, turn=PI / 2)
    hair_cap(f, J, "hair", grow=1.08, back=0.24, up=0.08, brow=0.3)
    f.ellipsoid("hair", c + Vector((0, ry * 0.5, rz * 1.02)), (rx * 0.42, ry * 0.42, rz * 0.4), seg=(16, 10))
    f.torus("gold", c + Vector((0, ry * 0.5, rz * 0.82)), rx * 0.36, 0.012, seg=(20, 6))
    tail = [c + Vector((0, ry * 1.15, -rz * 0.1)), Vector((0, 0.2, J["sh_z"])), Vector((0, 0.19, J["chest_z"] - 0.06)), Vector((0, 0.17, J["hip_z"] + 0.02))]
    for i in range(3):
        f.tube("hair", [tail[i].lerp(tail[i + 1], 0.08), tail[i].lerp(tail[i + 1], 0.92)], [0.07 - 0.015 * i, 0.055 - 0.018 * i], seg=10, squash=((0, 1, 0), 0.6))
        f.ellipsoid("gold", tail[i + 1], (0.03 - 0.006 * i,) * 3, seg=(10, 8))
    halo(f, J, "gold", "star", J["hh"] * 0.78)
    bow(f, J, "gold", "glow", length=1.3, depth=0.33, r=0.028, tilt=0.55, y=0.26, z=J["chest_z"])


def spirit(f, P, J):
    f.mat("cloak", "#2a1f66", rough=0.7)
    f.mat("deep", "#0b0820", rough=0.6, double=True)
    f.mat("gold", "#d2ae55", rough=0.32, metal=0.85)
    f.mat("mask", "#efe6cc", rough=0.4)
    f.mat("glow", "#7ff3ff", rough=0.3, emit="#7ff3ff", strength=1.0)
    f.mat("star", "#ffe08a", rough=0.4, metal=0.6, flat=True)
    f.mat("ribbon", "#5a3fc0", rough=0.6, double=True)
    sx = P["shoulder"]
    # one tall cloak to the floor: no legs, a dark slit down the front
    rings = [((0, 0, 0.02), 0.42, 0.38), ((0, 0, J["knee_z"]), 0.32, 0.28), ((0, 0, J["hip_z"]), 0.25, 0.2),
             ((0, 0, J["chest_z"]), sx * 1.28, 0.16), ((0, 0, J["sh_z"]), sx * 1.12, 0.13), ((0, 0, J["sh_z"] + 0.06), 0.06, 0.06)]
    f.loft("cloak", rings, cap_top=True)
    f.loft("deep", [(c, rx + 0.004, ry + 0.004) for c, rx, ry in rings[:5]], arc=(-0.2, 0.2), seg=6)
    for a in (-0.2, 0.2):
        f.tube("gold", [(c[0] + (rx + 0.006) * math.sin(a), c[1] - (ry + 0.006) * math.cos(a), c[2]) for c, rx, ry in rings[:5]], 0.007, seg=6)
    f.loft("gold", [((0, 0, 0.02), 0.425, 0.385), ((0, 0, 0.07), 0.41, 0.37)])
    for a, zf in ((0.6, 0.15), (1.4, 0.45), (-0.8, 0.35), (-1.6, 0.12), (2.5, 0.3), (-2.6, 0.5), (0.9, 0.62), (-1.1, 0.7), (3.1, 0.6)):
        z = 0.05 + (J["chest_z"] - 0.05) * zf
        k = 1 - zf * 0.52
        f.star("star", (0.43 * k * math.sin(a), -0.39 * k * math.cos(a), z), 0.035, 0.012, thick=0.01, normal=(math.sin(a), -math.cos(a), 0.3), turn=PI / 2)
    for s in (1, -1):
        f.tube("gold", [(sx * 0.9 * s, 0, J["sh_z"] - 0.01), (sx * 1.35 * s, 0, J["sh_z"] + 0.03), (sx * 1.85 * s, 0, J["sh_z"] + 0.12)], [0.075, 0.055, 0.004], seg=10, squash=((0, 1, 0), 0.6))
    f.torus("gold", (0, 0, J["sh_z"] + 0.05), 0.075, 0.014, seg=(24, 6))
    f.ellipsoid("glow", (0, -0.085, J["sh_z"] + 0.03), (0.026, 0.014, 0.034), seg=(12, 8))
    # the hood, open at the front; inside it a crescent mask with two glowing eyes
    c, (rx, ry, rz) = J["head_c"], J["head_r"]
    f.ellipsoid("deep", c + Vector((0, ry * 0.15, 0)), (rx * 1.3, ry * 1.35, rz * 1.25), seg=(28, 18), keep=lambda co: co.y > c.y - ry * 0.62)
    f.tube("deep", [c + Vector((0, ry * 0.9, rz * 0.9)), c + Vector((0, ry * 2.0, rz * 0.5)), c + Vector((0, ry * 2.4, -rz * 0.6))], [0.1, 0.07, 0.004], seg=10)
    f.ellipsoid("mask", c + Vector((0, -ry * 0.45, -rz * 0.05)), (rx * 0.78, 0.035, rz * 0.86), seg=(22, 14))
    for s in (1, -1):
        f.ellipsoid("glow", c + Vector((rx * 0.36 * s, -ry * 0.45 - 0.034, rz * 0.02)), (rx * 0.2, 0.01, rz * 0.075), seg=(12, 8),
                    rot=__import__("mathutils").Matrix.Rotation(0.3 * s, 4, "Y"))
    f.torus("gold", c + Vector((0, -ry * 0.1, rz * 1.02)), rx * 0.95, 0.014, normal=(0, 1, 0), seg=(28, 6), arc=(0.15, PI - 0.15))
    # hands that float free, in gold cuffs
    for s in (1, -1):
        h = Vector(((sx + 0.27) * s, -0.16, J["hip_z"] + 0.13))
        f.ellipsoid("mask", h, (P["hand"] * 0.62, P["hand"] * 0.72, P["hand"]), seg=(14, 10))
        f.torus("gold", h + Vector((0, 0, P["hand"] * 1.05)), P["hand"] * 0.62, 0.012, seg=(20, 6))
        f.ellipsoid("glow", h + Vector((0, 0, P["hand"] * 1.3)), (0.014, 0.014, 0.014), seg=(8, 6))
    # a long ribbon from the neck
    f.tube("ribbon", [(0, 0.12, J["sh_z"] + 0.02), (0.12, 0.42, J["chest_z"] + 0.05), (-0.06, 0.74, J["hip_z"] + 0.22), (0.14, 1.02, J["hip_z"] + 0.02), (0.05, 1.25, J["hip_z"] + 0.1)],
           [0.05, 0.06, 0.055, 0.04, 0.006], seg=8, squash=((0, 0, 1), 0.18))
    halo(f, J, "gold", "star", J["hh"] * 0.92, y=ry * 1.55)
    bow(f, J, "gold", "glow", length=1.5, depth=0.38, r=0.026, tilt=0.5, y=0.42, z=J["chest_z"] + 0.05)


def origami(f, P, J):
    f.facet = True
    f.mat("paper", "#e8e0c8", rough=0.85, double=True)
    f.mat("violet", "#5a3fc0", rough=0.8, double=True)
    f.mat("deep", "#1c1636", rough=0.8)
    f.mat("gold", "#d2ae55", rough=0.35, metal=0.85)
    f.mat("hair", "#241a4d", rough=0.8)
    f.mat("eye", "#1c1636", rough=0.5)
    f.mat("glint", "#7ff3ff", emit="#7ff3ff", strength=1.0)
    f.mat("glow", "#7ff3ff", rough=0.3, emit="#7ff3ff", strength=1.0)
    f.mat("star", "#ffe08a", rough=0.4, metal=0.6)
    hw, sx = P["hip_w"], P["shoulder"]
    torso(f, P, J, "violet")
    legs(f, P, J, "deep", "deep")
    # an A-line skirt of eight folds, gold leaf along every crease
    rings = [((0, 0, J["ankle_z"] + 0.14), hw * 2.5, hw * 2.3), ((0, 0, J["hip_z"]), hw * 1.25, P["hip_d"] * 1.3), ((0, 0, J["waist_z"]), P["waist_w"] * 1.08, P["waist_d"] * 1.1)]
    f.loft("violet", rings)
    for k in range(8):
        a = 2 * PI * k / 8
        f.tube("gold", [(rx * 1.01 * math.sin(a), -ry * 1.01 * math.cos(a), c[2]) for c, rx, ry in rings], 0.006, seg=4)
    f.loft("paper", [((0, 0, J["waist_z"] - 0.05), P["waist_w"] * 1.25, P["waist_d"] * 1.3), ((0, 0, J["waist_z"] + 0.04), P["waist_w"] * 1.12, P["waist_d"] * 1.15)])
    # a paper mantle folded like a crane's wings, and a folded collar
    f.loft("paper", [((0, 0.02, J["hip_z"] - 0.12), 0.72, 0.5), ((0, 0.01, J["chest_z"]), sx * 1.7, 0.2), ((0, 0, J["sh_z"] + 0.03), 0.07, 0.07)], arc=(PI - 1.35, PI + 1.35), seg=4)
    f.loft("paper", [((0, 0, J["chest_z"] + 0.02), sx * 1.15, P["chest_d"] * 1.25), ((0, 0, J["sh_z"] + 0.05), 0.07, 0.07)], arc=(-1.9, 1.9), seg=4)
    f.star("glow", (0, -P["chest_d"] * 1.2, J["chest_z"] + 0.08), 0.04, 0.016, thick=0.012, points=2, turn=PI / 2)
    for n, s in (("L", 1), ("R", -1)):
        arm(f, P, J, n, "violet", "paper", "paper", flare=2.6)
    head(f, P, J, "paper", eye="glint", glint="glint")
    c, (rx, ry, rz) = J["head_c"], J["head_r"]
    hh = J["hh"]
    for s in (1, -1):
        x = P["eye_x"] * hh * s
        f.star("eye", c + Vector((x, -ry * 0.93, P["eye_z"] * hh)), hh * 0.11, hh * 0.045, thick=0.01, points=2, turn=0)
    hair_cap(f, J, "hair", grow=1.12, back=0.24, up=0.1, brow=0.3)
    f.tube("hair", [c + Vector((0, ry * 0.9, rz * 0.75)), c + Vector((0, ry * 2.2, rz * 0.4)), (0, 0.36, J["chest_z"]), (0.06, 0.34, J["hip_z"] - 0.1)], [0.07, 0.1, 0.08, 0.004], seg=5)
    f.star("star", c + Vector((0, ry * 1.2, rz * 0.9)), 0.07, 0.024, thick=0.012, normal=(0, 1, 0.5), turn=PI / 2)
    halo(f, J, "gold", "star", hh * 0.85, ring=False, stars=5)
    bow(f, J, "gold", "glow", length=1.4, depth=0.36, r=0.024, tilt=0.5, y=0.3, z=J["chest_z"] + 0.02)


BUILD = {"figurine": figurine, "spirit": spirit, "origami": origami}

if __name__ == "__main__":
    out = os.path.abspath(sys.argv[sys.argv.index("--") + 1])
    os.makedirs(out, exist_ok=True)
    for name, fn in BUILD.items():
        bpy.ops.wm.read_factory_settings(use_empty=True)
        P = STYLES[name]
        fig = figkit.Fig(f"lyra_{name}")
        fn(fig, P, joints(P))
        objs = fig.finish()
        bpy.ops.object.select_all(action="SELECT")
        path = os.path.join(out, f"lyra_{name}.glb")
        bpy.ops.export_scene.gltf(filepath=path, export_format="GLB", use_selection=True, export_apply=True, export_yup=True,
                                  export_animations=False, export_cameras=False, export_lights=False)
        print(f"WROTE {path} {round(os.path.getsize(path) / 1024)} KB, {sum(len(o.data.polygons) for o in objs)} faces")
