"""The Turncloak (the War's quest giver at the camp): he fought for both banners, one after the other, and now keeps
his head down between them. A grizzled soldier with a grey beard under an iron kettle hat with a gold rim. A grey padded
coat to the knee, an iron breastplate with gold rivets, iron vambraces, a cloak whose two halves are crimson and azure,
tall black boots. On his LEFT arm a round shield painted half crimson and half azure, a gold boss in the middle that holds
a pale stone, his one light (hold: shield, as the hero Auriel holds hers). Signature shape: the kettle hat and the
halved shield."""
import math

from mathutils import Vector

from realkit import PI, Real
from real import parts_a as PA
from real import parts_c as P
import folk as K


def build():
    R = Real("war_turncloak", sex="m", height=1.0, width=1.06, depth=1.05, skin="#b08068")
    z = R.z
    R.mat("grey", "#55565c", rough=0.8, double=True)
    R.mat("iron", "#3c3f47", rough=0.4, metal=0.75, double=True)
    R.mat("crimson", "#7a1a24", rough=0.62, double=True)
    R.mat("azure", "#24427e", rough=0.62, double=True)
    R.mat("black", "#1d1b21", rough=0.5, double=True)
    R.mat("leather", "#4a3220", rough=0.6, double=True)
    R.mat("gold", "#c9a24a", rough=0.32, metal=0.85, double=True)
    R.mat("glow", "#fff6e0", rough=0.25, emit="#ffe0a0", strength=1.0)
    P.hair(R, "Hair_Buzzed", "#8a8682", beard="Hair_Beard")

    R.fitted("Coat", ["spine", "pelvis", "clavicle", "upperarm", "lowerarm"], "grey", offset=0.01)
    R.fitted("Legs", ["thigh", "calf", "pelvis"], "black", offset=0.004)
    R.boots("black", top=z["knee"] + 0.04, cuff="gold")
    P.toes(R, "black")
    P.skirt(R, "grey", z["knee"] - 0.02, flare=1.38, depth=1.12, folds=8, amp=0.014, trim="leather", trim_h=0.02, seg=48)
    up = R.piece(P.trunk_w(R))
    # the breastplate
    R.fitted("Plate", lambda i: R.dom[i].startswith(("spine",)) and z["waist"] - 0.03 < R.world[i].z < z["chest"] + 0.07 and R.world[i].y < R.bone("spine_03").y + 0.02,
             "iron", offset=0.026)
    for s in (1, -1):
        for k in range(3):
            p, out = P.on_trunk(R, z["waist"] + 0.02 + 0.09 * k, 0.55 * s, off=0.03)
            up.ellipsoid("gold", p, (0.01, 0.01, 0.01), seg=(8, 6))
    P.band_on(R, up, "gold", [(z["chest"] + 0.07, -1.0), (z["chest"] + 0.09, 0.0), (z["chest"] + 0.07, 1.0)], 0.008, thick=0.005, off=0.03)
    R.band("leather", z["waist"] - 0.02, height=0.05, grow=1.18)
    R.fitted("Vambrace", ["lowerarm"], "iron", offset=0.018, where=lambda p: abs(p.x) > R.bone("lowerarm_l").x + 0.06)
    R.cuffs("gold", at=(0.25, 0.85), offset=0.022, thick=0.006)
    P.collar(R, "grey", height=0.06, grow=1.05, flare=0.05)

    # the cloak: its left half crimson, its right half azure
    f = R.piece(PA.spine_w(R))
    cc, rxc, ryc = R.ring(z["chest"])
    sh = R.bone("upperarm_l").x
    ny = R.bone("neck_01").y
    top, hem = z["neck"] - 0.04, z["knee"] - 0.1
    lvls = [(top, ny, sh * 0.66, 0.105), (z["chest"], cc.y + 0.01, rxc * 1.14, ryc * 1.32), (z["hip"], cc.y + 0.02, 0.3, 0.25), (hem, cc.y + 0.03, 0.4, 0.33)]

    def at(zz):
        for (z0, y0, a0, b0), (z1, y1, a1, b1) in zip(lvls, lvls[1:]):
            if zz >= z1 - 1e-6:
                t = (z0 - zz) / max(1e-6, z0 - z1)
                return y0 + (y1 - y0) * t, a0 + (a1 - a0) * t, b0 + (b1 - b0) * t
        return lvls[-1][1:]

    def sheet(key, a0, a1):
        def fn(u, v):
            zz = top + (hem - top) * v
            cy, rx, ry = at(zz)
            sp = 1.7 + (1.3 - 1.7) * min(1.0, (top - zz) / max(1e-6, top - z["chest"]))
            a = PI + sp * (a0 + (a1 - a0) * u)
            return Vector((rx * math.sin(a), cy - ry * math.cos(a), zz))
        PA.grid(f, key, fn, 8, 10)
        f.tube("gold", [fn(i / 8, 1.0) for i in range(9)], 0.006, seg=5)
    sheet("azure", -1.0, 0.0)
    sheet("crimson", 0.0, 1.0)

    # the kettle hat
    hd = P.head(R)
    hp = R.piece("Head")
    hc = Vector((0, hd.c.y + 0.005, hd.top - 0.08))
    hp.ellipsoid("iron", hc + Vector((0, 0, 0.02)), (hd.rx * 1.18, hd.ry * 1.22, 0.11), seg=(24, 12), keep=lambda co: co.z > hc.z - 0.005)
    hp.ellipsoid("iron", hc, (hd.rx * 1.75, hd.ry * 1.8, 0.012), seg=(28, 6))
    rim = [Vector((hd.rx * 1.75 * math.sin(2 * PI * i / 40), hc.y - hd.ry * 1.8 * math.cos(2 * PI * i / 40), hc.z)) for i in range(41)]
    hp.tube("gold", rim, 0.007, seg=6, caps=False)
    hp.tube("gold", [Vector((0, hc.y - hd.ry * 1.2, hc.z + 0.01)), Vector((0, hc.y, hc.z + 0.135)), Vector((0, hc.y + hd.ry * 1.2, hc.z + 0.01))], 0.008, seg=6)

    # the round shield on the left forearm, halved
    sf = R.piece("lowerarm_l")
    c0, r0 = R.arm_r("l", 0.5)
    sc = c0 + Vector((0, 0, r0 + 0.03))
    rad = 0.26
    for key, a0 in (("crimson", 0.0), ("azure", PI)):
        pts = [sc + Vector((rad * math.cos(a0 + PI * k / 16), rad * math.sin(a0 + PI * k / 16), 0.0)) for k in range(17)]
        P.plate(sf, key, pts, 0.018, normal=(0, 0, 1))
    sf.torus("gold", sc, rad, 0.012, normal=(0, 0, 1), seg=(36, 6))
    sf.tube("gold", [sc + Vector((-rad, 0, 0.012)), sc + Vector((rad, 0, 0.012))], 0.008, seg=6)
    sf.ellipsoid("gold", sc + Vector((0, 0, 0.012)), (0.06, 0.06, 0.03), seg=(14, 8))
    sf.ellipsoid("glow", sc + Vector((0, 0, 0.038)), (0.022, 0.022, 0.012), seg=(10, 6))
    for t in (0.25, 0.75):
        c1, r1 = R.arm_r("l", t)
        sf.torus("leather", c1, r1 + 0.024, 0.008, normal=(1, 0, 0), seg=(16, 6))
    return R
