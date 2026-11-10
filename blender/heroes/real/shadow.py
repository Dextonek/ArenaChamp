"""Nyx, the Umbral Stalker (melee assassin): slim, all in matte black, no skin showing. A fitted black suit and a
featureless black face with one glowing mint slit for the eyes, a deep hood and a torn cloak that are black outside and
violet inside with a pale violet edge line, a violet sash with a hanging end, crossed leather straps with a moon-silver
clasp, dark leather bracers and thigh boots, and twin curved moon-silver daggers, one in each hand."""
import math

from mathutils import Vector

from realkit import PI, Real
from real import parts_a as P
from real.parts_a import V

FINGERS = ["hand_", "index_", "middle_", "ring_", "pinky_", "thumb_"]


def build():
    R = Real("shadow", sex="f", height=0.98, width=0.94, depth=0.95)
    z = R.z
    R.mat("suit", "#19121f", rough=0.8, double=True)
    R.mat("cloak", "#0c0910", rough=0.9, double=True)
    R.mat("violet", "#6a2ec0", rough=0.6, double=True)
    R.mat("edge", "#c88cff", rough=0.5)
    R.mat("leather", "#2c2040", rough=0.45, metal=0.1)
    R.mat("steel", "#cfcad8", rough=0.25, metal=0.9)
    R.mat("mint", "#c8fff0", rough=0.3, emit="#5affd2", strength=1.0)
    R.faceless()

    R.fitted("Suit", ["spine", "pelvis", "clavicle", "upperarm", "thigh", "neck", "Head"] + FINGERS, "suit", offset=0.003)
    R.fitted("Bracers", ["lowerarm"], "leather", offset=0.007)
    R.boots("leather", top=z["knee"] + 0.12, cuff="edge")
    P.arm_band(R, "edge", 0.1, bones=("lowerarm", "hand"), offset=0.009, thick=0.005)
    P.arm_band(R, "edge", 0.92, bones=("lowerarm", "hand"), offset=0.009, thick=0.005)
    R.pauldrons("leather", size=(0.075, 0.07, 0.035), lift=0.035, out=0.03)
    for s, n in ((1, "l"), (-1, "r")):
        f = R.piece(f"upperarm_{n}")
        f.torus("edge", R.bone(f"upperarm_{n}") + V(0.03 * s, 0, 0.03), 0.072, 0.004, normal=(0.2 * s, 0, 1), seg=(20, 5))

    # the mint slit across the eyes
    f, c, r = R.head_piece()
    ez = P.face_z(R, 0.47)
    f.tube("mint", P.outline(R, ez, -0.78, 0.78, n=12, out=0.004), [0.004] + [0.0095] * 11 + [0.004], seg=6, squash=((0, 0, 1), 0.7))

    # a split tunic skirt, front and back, with the violet edge
    hem = z["knee"] + 0.14
    for a0, a1 in ((-0.75, 0.75), (PI - 0.95, PI + 0.95)):
        R.skirt("suit", hem=hem, flare=1.28, depth=1.1, arc=(a0, a1), seg=14, trim="edge", trim_h=0.008, grow=1.03)
    R.band("violet", z["waist"], height=0.075, grow=1.12, how=R.hang_w(z["waist"], hem))
    cw, rxw, ryw = R.ring(z["waist"])
    f = R.piece(R.hang_w(z["waist"], hem))
    k0 = V(rxw * 1.05, cw.y - ryw * 0.75, z["waist"] - 0.01)
    f.ellipsoid("violet", k0, (0.032, 0.03, 0.032), seg=(10, 8))
    for dx, ln in ((0.0, 0.42), (0.035, 0.3)):
        P.blade(f, "violet", k0 + V(dx, -0.01, 0), k0 + V(dx * 2 + 0.05, -0.03, -ln), 0.034, (0.6, -1, 0), thick=0.12, belly=0.7, root=0.7)

    # crossed straps, a moon clasp
    for hs in (1, -1):
        P.strap(R, "leather", width=0.032, lift=0.2, grow=1.06, out=0.008, high_side=hs)
    g = P.surf(R, (z["chest"] + z["waist"]) / 2 + 0.03, 0, out=0.022)
    f = R.piece("spine_02")
    f.ellipsoid("steel", g, (0.03, 0.01, 0.03), seg=(12, 8))
    f.torus("edge", g, 0.031, 0.004, normal=(0, 1, 0), seg=(16, 5))

    # the cloak and the hood: black outside, violet inside, a pale violet edge
    P.cloak(R, "cloak", hem=z["knee"] - 0.14, width=0.4, depth=0.8, spread=1.5, top_spread=2.0, lining="violet", trim="edge", ragged=0.13, teeth=7,
            nu=28, nv=12, trim_r=0.005)
    P.cowl(R, "cloak", grow=1.05, high=0.0)
    f, c, hr, rim = P.hood(R, "cloak", lining="violet", edge="edge", grow=1.4, open=0.48, tilt=0.3, peak=0.03, edge_r=0.006)
    R.piece("spine_03").tube("cloak", [c + V(0, hr * 0.95, hr * 0.25), c + V(0, hr * 1.5, -hr * 0.5), c + V(0, hr * 1.4, -hr * 1.7)], [0.075, 0.055, 0.006], seg=10)

    # twin curved daggers
    for side, s in (("r", -1), ("l", 1)):
        f, o, d, up = R.held(side)
        out = V(s, 0, 0)
        f.tube("leather", [o - d * 0.1, o + d * 0.045], 0.014, seg=8)
        f.ellipsoid("steel", o - d * 0.11, (0.018, 0.018, 0.018), seg=(8, 6))
        f.tube("steel", [o + d * 0.05 - out * 0.035, o + d * 0.05 + out * 0.045], 0.01, seg=6)
        P.blade(f, "steel", o + d * 0.05, o + d * 0.47 - out * 0.02, 0.03, up, thick=0.14, belly=0.3, root=0.75, bend=out * 0.05, n=8)
        f.tube("edge", [o + d * (0.07 + 0.4 * i / 8) + out * (0.05 * math.sin(PI * i / 8) + 0.026 * math.cos(PI / 2 * i / 8) - 0.02 * i / 8) for i in range(9)], 0.0035, seg=4)
    return R
