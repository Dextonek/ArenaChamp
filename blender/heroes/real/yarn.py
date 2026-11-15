"""Grandma Ironknit, the Weaver, a Briarkin of the Spindle court who chose to live among mortals at the Wood's edge
(docs/lore/codex/heroes/grandma-ironknit.md; revamped 2026-11-15 by docs/lore/codex/revamp.md): long pointed ears out
through the hood's rolled edge, eyes of one colour, silver from lid to lid, skin with the faint dapple of light through
leaves, fingers a little too long. Otherwise as before: a tiny old fate-spinner, unhurried. A long dark aubergine robe with a gold hem and a rose-thread
belt, a dark wine hooded shawl with a gold brooch, the hood up round her face with a rolled rose edge and its point down
her back, silver hair. Two silver knitting needles as long as swords, gold at the butts, and a spindle behind her left
shoulder with three glowing rose yarn spools in gold flanges."""
import math

import bpy
from mathutils import Vector

from realkit import PI, Real
from real.parts_b import reshape
from real.parts_c import head

FINGER_CHAINS = ("index", "middle", "ring", "pinky")


def long_fingers(R, k=1.3):
    """The fingers (not the palm or thumb) `k` times as long, from their knuckles: skin and bones, so the clips bend them."""
    body, rig = R.body, R.rig
    chains = {}
    for n in "lr":
        for fg in FINGER_CHAINS:
            names = [f"{fg}_0{j}_{n}" for j in (1, 2, 3) if f"{fg}_0{j}_{n}" in rig.data.bones]
            if names:
                chains[(fg, n)] = (R.bone(names[0]), set(names))
    idx = {g.index: g.name for g in body.vertex_groups}
    knuckle = {}
    for (fg, n), (o, names) in chains.items():
        for nm in names:
            knuckle[nm] = o
    moves = {}
    for v in body.data.vertices:
        acc, tot = Vector(), 0.0
        for g in v.groups:
            nm = idx.get(g.group)
            if nm in knuckle and g.weight > 0.01:
                acc += knuckle[nm] * g.weight
                tot += g.weight
        if tot > 0.01:
            moves[v.index] = (acc / tot, min(1.0, tot))

    def fn(p, i):
        m = moves.get(i)
        if not m:
            return None
        o, w = m
        return o + (p - o) * (1 + (k - 1) * w)
    reshape(R, fn)
    bpy.context.view_layer.objects.active = rig
    bpy.ops.object.mode_set(mode="EDIT")
    inv = rig.matrix_world.inverted()
    for b in rig.data.edit_bones:
        if b.name not in knuckle:
            continue
        o = inv @ knuckle[b.name]
        b.head = o + (b.head - o) * k
        b.tail = o + (b.tail - o) * k
    bpy.ops.object.mode_set(mode="OBJECT")
    R._read()


def build():
    R = Real("yarn", sex="f", height=0.74, width=0.88, depth=0.94, head=1.18, skin="#ead8c6")
    long_fingers(R, 1.3)
    z = R.z
    # the dapple of light through leaves, faint, on all her skin
    R.paint(lambda p, d: max(0.0, math.sin(p.x * 61 + p.z * 23) * math.sin(p.y * 57 - p.z * 41 + 1.3) * math.sin(p.z * 37 + p.x * 29 + 0.7)) ** 0.6,
            "#b7b48a", 0.4)
    # eyes of one colour, silver from lid to lid
    R.eye_look(color="#c9d2dc", emit="#9fb0c8", strength=0.2, solid=True)
    R.mat("ear", "#e6d2c0", rough=0.62)
    R.mat("robe", "#3a2540", rough=0.7, double=True)
    R.mat("shawl", "#5a1f3a", rough=0.8, double=True)
    R.mat("rose", "#d86a94", rough=0.6)
    R.mat("gold", "#d2ae55", rough=0.32, metal=0.85)
    R.mat("silver", "#d6dde4", rough=0.25, metal=0.9)
    R.mat("dark", "#1d1420", rough=0.6)
    R.mat("spool", "#ff8fc0", rough=0.4, emit="#ff5fa8", strength=0.9)
    R.hair("Hair_Buns", "#c9c9d2")

    R.fitted("Dress", ["spine", "pelvis", "clavicle", "upperarm", "lowerarm", "thigh", "calf"], "robe")
    R.fitted("Shawl", ["spine_03", "clavicle", "upperarm"], "shawl", offset=0.016, above=z["chest"] - 0.02, keep_skin=True)
    R.boots("dark", top=z["ankle"] + 0.06)
    hem = z["ankle"] + 0.03
    R.skirt("robe", hem=hem, flare=1.7, depth=1.25, trim="gold", trim_h=0.03)
    R.band("rose", z["waist"], height=0.035, grow=1.12, how=R.hang_w(z["waist"], hem))
    f, gem = R.collar("shawl", height=0.07, grow=1.25)
    f.ellipsoid("gold", gem + Vector((0, -0.012, -0.015)), (0.026, 0.012, 0.026), seg=(12, 8))
    R.cuffs("rose", at=(0.9,), offset=0.012, thick=0.008)

    # the hood, up round her face, a rolled rose edge, its point down her back
    f, c, r = R.head_piece()
    hr = r * 1.32
    c = c + Vector((0, 0.02, 0.0))
    f.ellipsoid("shawl", c, (hr, hr * 1.05, hr * 1.08), seg=(26, 16), keep=lambda co: co.y > c.y - hr * 0.42)
    f.torus("rose", Vector((c.x, c.y - hr * 0.42, c.z)), hr * 0.93, 0.016, normal=(0, 1, 0), seg=(28, 6))
    f.tube("shawl", [c + Vector((0, hr * 0.8, hr * 0.5)), c + Vector((0, hr * 1.35, -hr * 0.2)), c + Vector((0, hr * 1.2, -hr * 1.3))], [0.07, 0.05, 0.006], seg=10)

    # the long pointed ears, out through the hood's rolled edge
    H = head(R)
    for s in (1, -1):
        e = Vector((H.ear.x * s * 0.94, H.ear.y - 0.01, H.ear.z))
        f.tube("ear", [e + Vector((-0.012 * s, -0.004, -0.014)), e + Vector((0.032 * s, -0.008, 0.012)), e + Vector((0.09 * s, -0.016, 0.052)),
                       e + Vector((0.15 * s, -0.022, 0.1))], [0.021, 0.031, 0.021, 0.003], seg=8, squash=((0, 1, 0), 0.34))

    # the needles, as long as swords
    for side in "rl":
        f, o, d, up = R.held(side)
        f.tube("silver", [o - d * 0.12, o + d * 0.5, o + d * 0.66], [0.009, 0.008, 0.0015], seg=6)
        f.ellipsoid("gold", o - d * 0.13, (0.02, 0.02, 0.02), seg=(10, 8))
        if side == "r":  # half a scarf on the right one
            for k in range(4):
                p = o + d * (0.2 + 0.07 * k)
                f.tube("rose" if k % 2 else "shawl", [p + up * 0.01, p - up * (0.16 + 0.02 * k)], 0.03, seg=8, squash=((1, 0, 0), 0.25))

    # the spindle behind her left shoulder, three glowing spools
    cc, rx, ry = R.ring(z["chest"])
    f = R.piece("spine_03")
    b = Vector((0.11, cc.y + ry + 0.07, z["chest"] - 0.12))
    f.tube("gold", [b, b + Vector((0.03, 0.02, 0.56))], 0.009, seg=6)
    for k in range(3):
        p = b + Vector((0.03, 0.02, 0.56)) * (0.4 + 0.25 * k)
        f.ellipsoid("spool", p, (0.05, 0.05, 0.04), seg=(14, 8))
        for dz in (-0.04, 0.04):
            f.torus("gold", p + Vector((0, 0, dz)), 0.045, 0.007, seg=(18, 6))
    return R
