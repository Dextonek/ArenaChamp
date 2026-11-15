"""Brannoc, the Ashen Smith (tank), Kilnborn of the first generation born grey (docs/lore/codex/heroes/brannoc.md;
revamped 2026-11-15 by docs/lore/codex/revamp.md): ash-grey skin, darker at the forearms, cracked with ember seams where
the forge in his chest shows through: up from the grate over the open breast to the throat, along both arms; an ash
beard; pale amber eyes. Otherwise as before: a wall of a man. Iron pauldrons with molten seams, an iron breastplate with a furnace
grate glowing in it, a forge visor over a great red beard, bare arms with iron bracers, a leather apron, iron-shod
boots, a forge pack with two chimneys on his back, and a big hammer in the right hand."""
from mathutils import Vector

import math

from realkit import Real
from real.parts_d import V, crack


def build():
    R = Real("forge", sex="m", height=0.98, width=1.24, depth=1.3, head=0.92, skin="#6c6866")
    z = R.z
    # darker toward the hands, from a life at the forge
    for n in "lr":
        e, w = R.bone(f"lowerarm_{n}"), R.bone(f"hand_{n}")
        ax, ln = (w - e).normalized(), (w - e).length
        R.paint(lambda p, d, e=e, ax=ax, ln=ln, n=n: max(0.0, min(1.0, ((p - e).dot(ax) / ln + 0.15) / 0.8))
                if d.startswith(("lowerarm_" + n, "hand_" + n, "index_", "middle_", "ring_", "pinky_", "thumb_")) and p.x * (1 if n == "l" else -1) > 0 else 0.0,
                "#3a3634", 0.85)
    R.eye_look(color="#ffc878", emit="#ff9a3a", strength=0.25)
    R.mat("iron", "#3c3f47", rough=0.42, metal=0.75)
    R.mat("dark", "#1d1b21", rough=0.6)
    R.mat("leather", "#6b4226", rough=0.75, double=True)
    R.mat("wood", "#4a3220", rough=0.7)
    R.mat("gold", "#c9a24a", rough=0.32, metal=0.85)
    R.mat("molten", "#ff7a1c", rough=0.4, emit="#ff5a12", strength=1.0)
    R.mat("seam", "#ff8a3c", rough=0.5, emit="#ff5a14", strength=0.7)
    R.hair("Hair_Buzzed", "#3c3836")
    R.hair("Hair_Beard", "#8a847e", brows=False)

    # the shirt and plate open in a V above the grate: the cracked breast shows, and the forge-light in it
    cc = R.ring(z["chest"])[0]
    vz = z["chest"] + 0.115

    def open_v(p):
        return not (p.y < cc.y and abs(p.x) < 0.125 and p.z > vz + 1.3 * abs(p.x))
    R.fitted("Shirt", ["spine", "pelvis", "clavicle"], "dark", where=open_v)
    R.fitted("Plate", ["spine_02", "spine_03", "clavicle"], "iron", offset=0.022, keep_skin=True, where=open_v)
    R.fitted("Trousers", ["thigh", "calf", "pelvis"], "dark", offset=0.004)
    # the bracers on the wrist half only: the darker forearm shows above them
    ex = R.bone("lowerarm_l").x + (R.bone("hand_l").x - R.bone("lowerarm_l").x) * 0.45
    R.fitted("Bracers", ["lowerarm"], "iron", offset=0.012, where=lambda p: abs(p.x) > ex)
    R.boots("dark", top=z["knee"] - 0.02, cuff="iron", toe="iron")
    R.cuffs("gold", at=(0.47, 0.95), offset=0.014)
    # the edge of the V in iron
    f = R.piece("near")
    for sx in (1, -1):
        pts = []
        for k in range(9):
            x = 0.12 * k / 8 * sx
            hit, nrm = R.surface(V(x, -0.6, vz + 1.3 * abs(x) - 0.006), V(0, 1, 0))
            if hit is not None:
                pts.append(hit + nrm * 0.02)
        if len(pts) > 1:
            f.tube("iron", pts, 0.012, seg=6)

    # the ember seams: up from the grate to the throat, and across the shoulders and arms
    f = R.piece("near")
    fr = V(0, 1, 0)
    for k, pts in enumerate((
            [V(0.0, 0, vz + 0.01), V(0.02, 0, vz + 0.06), V(-0.01, 0, vz + 0.11), V(0.012, 0, z["neck"] + 0.02)],
            [V(0.03, 0, vz + 0.045), V(0.06, 0, vz + 0.1), V(0.085, 0, vz + 0.14)],
            [V(-0.025, 0, vz + 0.04), V(-0.05, 0, vz + 0.09), V(-0.09, 0, vz + 0.145)],
            [V(0.02, 0, vz + 0.075), V(0.045, 0, vz + 0.085)],
            [V(-0.008, 0, vz + 0.11), V(-0.04, 0, vz + 0.125)])):
        crack(R, f, "seam", pts, fr, r=0.0045, seed=k, jag=0.012)
    for s, n in ((1, "l"), (-1, "r")):
        sh, el, wr = R.bone(f"upperarm_{n}"), R.bone(f"lowerarm_{n}"), R.bone(f"hand_{n}")
        g = R.piece("near")
        for k, (way, dz, a, b) in enumerate(((fr, -0.005, 0.18, 1.0), (V(0, 0, -1), 0.0, 0.3, 0.95), (fr, 0.02, 0.5, 0.85))):
            pts = [sh.lerp(el, a + (b - a) * t / 3) + V(0, 0, dz + 0.012 * math.sin(t * 2.1 + k)) for t in range(4)]
            crack(R, g, "seam", pts, way, r=0.0042, seed=10 + k + (5 if s > 0 else 0), jag=0.014, steps=2)
            if k < 2:  # on down the bare forearm, as far as the bracer
                pts = [el.lerp(wr, 0.02 + 0.4 * t / 2) + V(0, 0, dz) for t in range(3)]
                crack(R, g, "seam", pts, way, r=0.0038, seed=20 + k + (5 if s > 0 else 0), jag=0.01, steps=2)
    R.pauldrons("iron", size=(0.12, 0.11, 0.075), lift=0.05, out=0.05)
    for s, n in ((1, "l"), (-1, "r")):
        f = R.piece(f"upperarm_{n}")
        f.torus("molten", R.bone(f"upperarm_{n}") + Vector((0.05 * s, 0, 0.05)), 0.118, 0.008, normal=(0, 0.35, 1), seg=(24, 6))

    # the furnace grate in the chest
    cc, rx, ry = R.ring(z["chest"])
    f = R.piece("spine_03")
    g = Vector((0, cc.y - ry - 0.03, z["chest"] + 0.04))
    f.torus("gold", g, 0.085, 0.012, normal=(0, 1, 0), seg=(28, 6))
    f.ellipsoid("dark", g + Vector((0, 0.012, 0)), (0.08, 0.02, 0.08), seg=(18, 10))
    for k in (-1, 0, 1):
        f.tube("molten", [g + Vector((-0.06, -0.008, 0.035 * k)), g + Vector((0.06, -0.008, 0.035 * k))], 0.009, seg=6)
    # the forge pack: an iron tank and two short chimneys, glowing at the top
    b = Vector((0, cc.y + ry + 0.11, z["chest"] - 0.02))
    f.ellipsoid("iron", b, (0.2, 0.11, 0.2), seg=(18, 12))
    for s in (1, -1):
        f.tube("iron", [b + Vector((0.1 * s, 0.02, 0.12)), b + Vector((0.1 * s, 0.02, 0.36))], [0.045, 0.04], seg=10)
        f.ellipsoid("molten", b + Vector((0.1 * s, 0.02, 0.36)), (0.034, 0.034, 0.012), seg=(10, 6))

    # the leather apron and its belt
    R.skirt("leather", hem=z["knee"] - 0.06, flare=1.25, depth=1.1, arc=(-1.25, 1.25), seg=18)
    R.band("dark", z["waist"], height=0.075, grow=1.12)
    cw, rxw, ryw = R.ring(z["waist"])
    R.piece("pelvis").ellipsoid("gold", Vector((0, cw.y - ryw * 1.2, z["waist"])), (0.045, 0.015, 0.035), seg=(12, 8))

    # the forge visor: an iron band across the eyes with one glowing slit
    f, c, r = R.head_piece()
    eye_z = R.z["head"] + (R.z["top"] - R.z["head"]) * 0.45
    f.torus("iron", Vector((0, c.y, eye_z)), r * 1.03, 0.014, seg=(28, 8))
    f.tube("molten", [Vector((-r * 0.6, c.y - r * 1.04, eye_z)), Vector((0, c.y - r * 1.2, eye_z)), Vector((r * 0.6, c.y - r * 1.04, eye_z))], 0.007, seg=6)

    # the hammer
    f, o, d, up = R.held("r")
    f.tube("wood", [o - d * 0.16, o + d * 0.78], 0.024, seg=10)
    f.ellipsoid("gold", o - d * 0.17, (0.032, 0.032, 0.032), seg=(10, 8))
    h = o + d * 0.78
    f.tube("iron", [h - up * 0.15, h + up * 0.15], 0.09, seg=10)
    f.torus("gold", h, 0.094, 0.012, normal=up, seg=(24, 6))
    for s in (1, -1):
        f.ellipsoid("molten", h + up * 0.152 * s, (0.07, 0.07, 0.012), seg=(14, 6))
    return R
