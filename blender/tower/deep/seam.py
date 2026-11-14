"""The Seam King (the Deep's third ruler, a boss drawn about 2.5 times a hero's size: the Glass Abbot, the Seam King, the
Gem Tyrant): the king of the miners who dug too deep and kept what he found. Built as a giant: very broad and deep, a
smaller head, big hands. Grey-brown skin, a broad dark beard braided with silver rings; a heavy iron crown set with raw
crystals in violet and mint; armour of blackened iron plates over thick slate leather, a broad belt with a silver buckle,
iron boots, a short cloak of dark violet. In the RIGHT hand a great war-pick, its iron head set with a long violet crystal
spike, his one light glowing at its heart. Signature shape: the crystal crown and the war-pick."""
import math

from mathutils import Vector

from realkit import PI, Real
from real import parts_a as PA
from real import parts_b as PB
from real import parts_c as P


def build():
    R = Real("deep_seam", sex="m", height=1.0, width=1.4, depth=1.34, head=0.82, skin="#8a7a6c")
    z = R.z
    R.mat("iron", "#5a5e68", rough=0.5, metal=0.55, double=True)
    R.mat("leather", "#2c2e38", rough=0.7, double=True)
    R.mat("violet", "#2e1e44", rough=0.66, double=True)
    R.mat("silver", "#c8ccd8", rough=0.28, metal=0.85)
    R.mat("amethyst", "#8a5ad0", rough=0.1, metal=0.1)
    R.mat("mint", "#6ad8b8", rough=0.1, metal=0.1)
    R.mat("wood", "#1e1812", rough=0.65)
    R.mat("glow", "#f4e8ff", rough=0.2, emit="#a86aff", strength=1.3)
    PB.big_hands(R, 1.35)
    z = R.z
    P.hair(R, "Hair_Buzzed", "#1e1814", beard="Hair_Beard")

    R.fitted("Leather", ["spine", "pelvis", "clavicle", "upperarm", "lowerarm"], "leather", offset=0.008)
    R.fitted("Plate", ["spine_02", "spine_03", "clavicle"], "iron", offset=0.02, above=z["waist"] + 0.04)
    R.fitted("Legs", ["thigh", "calf"], "leather", offset=0.006)
    R.boots("iron", top=z["knee"] + 0.03, toe="silver")
    R.fitted("Vambraces", ["lowerarm"], "iron", offset=0.016)
    hem = z["knee"] + 0.02
    f, rings = P.skirt(R, "leather", hem, flare=1.35, depth=1.12, folds=6, amp=0.012, seg=48)
    for a0, a1 in ((-0.55, 0.55), (PI - 0.55, PI + 0.55), (0.75, 1.9), (-1.9, -0.75)):
        P.cloth(f, "iron", rings, arc=(a0, a1), seg=6, rows=6, off=0.01, z0=z["hip"] - 0.2)
    how = R.hang_w(z["waist"], hem)
    R.band("iron", z["waist"] - 0.01, height=0.1, grow=1.16, how=how)
    cw, rxw, ryw = R.ring(z["waist"] - 0.01)
    R.piece(how).ellipsoid("silver", Vector((0, cw.y - ryw * 1.24, z["waist"] - 0.01)), (0.06, 0.02, 0.05), seg=(14, 8))
    for s, n in ((1, "l"), (-1, "r")):
        sh = R.bone(f"upperarm_{n}")
        sp = R.piece(f"upperarm_{n}")
        sp.ellipsoid("iron", sh + Vector((0.04 * s, 0, 0.06)), (0.15, 0.12, 0.06), seg=(14, 8))
        sp.ellipsoid("iron", sh + Vector((0.11 * s, 0, 0.01)), (0.1, 0.1, 0.05), seg=(12, 6))
        PB.shard(sp, "mint" if n == "l" else "amethyst", sh + Vector((0.02 * s, 0.03, 0.1)), sh + Vector((0.08 * s, 0.06, 0.24)), 0.03, n=6)
    PA.cloak(R, "violet", hem=z["knee"] - 0.05, width=0.42, depth=0.85, spread=1.2, top_spread=1.5, nu=14, nv=8)
    # silver rings in the beard
    h = P.head(R)
    bf = R.piece("Head")
    for k in range(3):
        bf.torus("silver", Vector((0, h.y0 + 0.01, h.jaw - 0.04 - 0.035 * k)), 0.02, 0.006, normal=(0, 0, 1), seg=(12, 5))

    # the iron crown set with raw crystals
    zc = h.c.z + h.rz * 0.35
    ring0 = [Vector((h.rx * 1.08 * math.sin(a), h.c.y - h.ry * 1.08 * math.cos(a), zc)) for a in [-PI + 2 * PI * k / 26 for k in range(27)]]
    bf.tube("iron", ring0, 0.022, seg=8, squash=((0, 0, 1), 1.6))
    for k in range(9):
        a = -PI + 2 * PI * k / 9
        base = Vector((h.rx * 1.08 * math.sin(a), h.c.y - h.ry * 1.08 * math.cos(a), zc + 0.01))
        out = Vector((math.sin(a), -math.cos(a), 0))
        ln = 0.08 + 0.05 * ((k * 5) % 3) / 2
        PB.shard(bf, "amethyst" if k % 2 else "mint", base, base + out * 0.025 + Vector((0, 0, ln)), 0.02, n=5)

    # the war-pick in the right hand
    s = P.along(R)
    f, o, d, upv = R.held("r")
    side = upv.cross(d).normalized()
    f.tube("wood", [o - d * 0.18 * s, o + d * 0.72 * s], 0.03, seg=10)
    f.ellipsoid("iron", o - d * 0.19 * s, P.rr(R, 0.036), seg=(10, 8))
    head = o + d * 0.68 * s
    f.tube("iron", [head - upv * 0.08, head + upv * 0.06], 0.05, seg=10)
    f.tube("iron", [head - upv * 0.06, head - upv * 0.2 - d * 0.04 * s], [0.04, 0.008], seg=8)
    PB.shard(f, "amethyst", head + upv * 0.04, head + upv * 0.32 + d * 0.03 * s, 0.045, n=6, mid=0.3)
    f.ellipsoid("glow", head + upv * 0.1, P.rr(R, 0.026), seg=(10, 8))
    for t in (0.0, 0.5):
        f.torus("silver", o + d * t * s, 0.036, 0.008, normal=d, seg=(14, 5))
    return R
