"""Lyra, the night archer: a fitted night-violet tunic, a short flared skirt, a starry cape, a gold crescent bow across her
back with a glowing string, a constellation halo. Her bow stays on her back: she looses star arrows with a gesture."""
import math

from mathutils import Vector

from realkit import PI, Real
from style_blockout import bow, halo


def build():
    R = Real("astral", sex="f")
    z = R.z
    R.mat("tunic", "#241a5c", rough=0.62)
    R.mat("violet", "#4a34a8", rough=0.6, double=True)
    R.mat("deep", "#17122e", rough=0.5)
    R.mat("leather", "#221a3c", rough=0.42, metal=0.1)
    R.mat("cape", "#1d1648", rough=0.7, double=True)
    R.mat("gold", "#d2ae55", rough=0.32, metal=0.85)
    R.mat("glow", "#7ff3ff", rough=0.3, emit="#7ff3ff", strength=1.0)
    R.mat("star", "#ffe08a", rough=0.4, metal=0.6, flat=True)
    R.hair("Hair_Long", "#16102e", rough=0.42)

    R.fitted("Tunic", ["pelvis", "spine", "clavicle", "upperarm"], "tunic")
    R.fitted("Leggings", ["thigh", "calf", "pelvis"], "deep", offset=0.003)
    R.fitted("Boots", lambda i: R.dom[i].startswith(("foot_", "ball_")) or (R.dom[i].startswith(("calf_", "thigh_")) and R.world[i].z < z["knee"] + 0.09), "leather", offset=0.009)
    R.fitted("Bracers", ["lowerarm"], "leather", offset=0.007)

    hem = z["knee"] + (z["hip"] - z["knee"]) * 0.42
    R.skirt("violet", hem=hem, flare=1.55, trim="gold")
    R.band("gold", z["waist"], height=0.06, how=R.hang_w(z["waist"], hem))
    f, gem = R.collar("gold")
    f.ellipsoid("glow", gem, (0.016, 0.009, 0.022), seg=(12, 8))
    cc, rxc, ryc = R.ring(z["chest"])
    bow(f, {"chest_z": z["chest"] - 0.05}, "gold", "glow", length=1.3, depth=0.33, r=0.02, tilt=0.5, y=cc.y + ryc + 0.12)

    f, rings = R.cape("cape", hem=z["knee"] - 0.02, trim="gold")
    c0, rx0, ry0 = rings[0]
    for a, zf in ((PI - 0.8, 0.2), (PI + 0.6, 0.35), (PI - 0.2, 0.55), (PI + 0.95, 0.7), (PI - 1.0, 0.75), (PI + 0.1, 0.12)):
        k = 1 - zf * 0.55
        f.star("star", (rx0 * 1.02 * k * math.sin(a), c0.y - ry0 * 1.02 * k * math.cos(a), c0.z + (z["chest"] - c0.z) * zf), 0.028, 0.01, thick=0.008,
               normal=(math.sin(a), -math.cos(a), 0.2), turn=PI / 2)

    for s, n in ((1, "l"), (-1, "r")):
        f = R.piece(f"calf_{n}")
        f.torus("gold", R.bone(f"calf_{n}") + Vector((0, 0, 0.085)), 0.066, 0.008, seg=(24, 6))
        f = R.piece(f"foot_{n}")
        heel, toe = R.bone(f"foot_{n}"), R.bone(f"ball_{n}")
        f.ellipsoid("leather", Vector((heel.x, (heel.y + toe.y) / 2 - 0.05, 0.05)), (0.058, 0.155, 0.055), seg=(18, 10))
        f.ellipsoid("gold", Vector((heel.x, toe.y - 0.105, 0.04)), (0.045, 0.04, 0.035), seg=(12, 8))
        f = R.piece(f"lowerarm_{n}")
        e, w = R.bone(f"lowerarm_{n}"), R.bone(f"hand_{n}")
        f.torus("gold", e.lerp(w, 0.1), 0.05, 0.007, normal=(w - e), seg=(20, 6))
        f.torus("gold", e.lerp(w, 0.93), 0.036, 0.007, normal=(w - e), seg=(20, 6))
        f = R.piece(f"upperarm_{n}")
        f.ellipsoid("gold", R.bone(f"upperarm_{n}") + Vector((0.03 * s, 0, 0.035)), (0.07, 0.06, 0.03), seg=(16, 8))

    f = R.piece("Head")
    hh = 0.235
    halo(f, {"head_c": Vector((0, 0.0, z["head"] + 0.1)), "head_r": (hh * 0.4, hh * 0.44, hh * 0.5), "hh": hh}, "gold", "star", hh * 0.85, y=0.17)
    return R
