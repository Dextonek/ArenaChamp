"""The Fishwife (a walker of the Sea's floors, docs/tower/life/index.html): a living Coast woman who carries the catch up
from the boats to the fish-market steps. Plainer than the named people: no light, no gold. Sea-tanned, her salt-bleached
hair in buns under a sea-green head band knotted at the back, the tide lines of her people on her bare forearms. An undyed
linen blouse with the sleeves rolled, a deep-blue laced bodice, a slate skirt to mid-calf with a canvas apron edged in
blue, low boots. On her back a wicker creel on two straps, the tails of the morning's catch standing out of it. The hands
are free (walkers play the pack's walking clip with both arms): everything she carries is on her back. Signature shape:
the creel with the fish tails."""
import math

from mathutils import Vector

from realkit import PI, Real
from real import parts_c as P
import folk as K


def build():
    R = Real("sea_fishwife", sex="f", height=0.98, width=1.04, depth=1.03, skin="#c08a66")
    z = R.z
    R.mat("linen", "#cbbf9f", rough=0.82, double=True)
    R.mat("blue", "#2e4a66", rough=0.66, double=True)
    R.mat("slate", "#47525e", rough=0.72, double=True)
    R.mat("canvas", "#a39478", rough=0.85, double=True)
    R.mat("sea", "#2f6a5e", rough=0.66, double=True)
    R.mat("leather", "#4a3222", rough=0.6, double=True)
    R.mat("wicker", "#9a7a46", rough=0.9)
    R.mat("fish", "#8f9ca4", rough=0.35, metal=0.4)
    R.mat("tide", "#3a6c9a", rough=0.5)
    R.hair("Hair_Buns", "#c9b28a", rough=0.6)

    # the blouse, sleeves rolled to the elbow, bare forearms with the tide lines; the laced bodice
    el = R.bone("lowerarm_l").x
    R.fitted("Blouse", lambda i: R.dom[i].startswith(("spine", "pelvis", "clavicle", "upperarm")) or (R.dom[i].startswith("lowerarm") and abs(R.world[i].x) < el + 0.04), "linen", offset=0.008)
    for n in "lr":
        P.sleeve(R, n, "linen", t0=-0.02, t1=0.16, r0=0.016, r1=0.0, bones=("lowerarm", "hand"), seg=14, n=2)
    R.cuffs("tide", at=(0.52, 0.62), offset=0.001, thick=0.0026)
    P.collar(R, "linen", height=0.045, grow=0.98, flare=0.06)
    R.fitted("Bodice", lambda i: R.dom[i].startswith(("spine", "pelvis")) and z["waist"] - 0.07 < R.world[i].z < z["chest"] + 0.02, "blue", offset=0.016)
    up = R.piece(P.trunk_w(R))
    for k in range(4):
        zz = z["waist"] - 0.03 + (z["chest"] - z["waist"]) * k / 3
        P.band_on(R, up, "linen", [(zz, 0.1), (zz + 0.015, 0.0), (zz, -0.1)], 0.005, thick=0.004, off=0.021, n=6)

    # the skirt to mid-calf, the canvas apron in front edged in blue, low boots
    R.fitted("Hose", ["thigh", "calf"], "leather", offset=0.004)
    R.boots("leather", top=z["ankle"] + 0.07)
    P.toes(R, "leather")
    hem = z["knee"] - 0.19
    P.skirt(R, "slate", hem, flare=1.55, depth=1.12, folds=9, amp=0.022, seg=52)
    P.skirt(R, "canvas", hem + 0.06, flare=1.6, depth=1.13, arc=(-0.9, 0.9), folds=4, amp=0.01, trim="blue", trim_h=0.022, grow=1.05, seg=24)
    R.band("canvas", z["waist"] - 0.05, height=0.03, grow=1.17)

    # the head band, knotted at the back with two short tails
    h = P.head(R)
    hp = R.piece("Head")
    bz = h.brow + 0.03
    pts = [Vector((h.rx * 1.06 * math.sin(2 * PI * i / 32), h.c.y - h.ry * 1.1 * math.cos(2 * PI * i / 32), bz + 0.02 * (1 - math.cos(2 * PI * i / 32)) / 2)) for i in range(33)]
    hp.tube("sea", pts, 0.012, seg=6, caps=False, squash=((0, 0, 1), 1.6))
    kn = pts[16] + Vector((0, 0.01, 0.0))
    hp.ellipsoid("sea", kn, (0.022, 0.016, 0.018), seg=(10, 6))
    for dx in (0.018, -0.014):
        hp.tube("sea", [kn + Vector((dx * 0.3, 0.008, -0.005)), kn + Vector((dx, 0.03, -0.08))], [0.014, 0.008], seg=6, squash=((0, 1, 0), 0.35))

    # the creel on her back: wider at the top, on two straps, fish tails standing out of it
    bf, bc, (cc, rxc, ryc), ny = K.back_frame(R)
    base = Vector((0, cc.y + ryc + 0.13, z["waist"] - 0.08))
    top = K.basket(bf, "wicker", "leather", base, 0.11, 0.16, 0.32, bands=(0.5,), band_key="leather")
    K.shoulder_straps(R, bf, "leather", cc.y + ryc + 0.03)
    for k, (x, y, lean, ln) in enumerate(((-0.07, 0.02, -0.25, 0.14), (0.0, -0.03, 0.05, 0.17), (0.06, 0.03, 0.3, 0.13), (0.03, 0.07, 0.12, 0.11))):
        p0 = top + Vector((x, y, -0.06))
        p1 = p0 + Vector((lean * 0.2, 0.01, ln))
        bf.tube("fish", [p0, p0.lerp(p1, 0.5), p1], [0.032, 0.026, 0.012], seg=10, squash=((1, 0, 0), 0.45))
        sd = Vector((math.cos(lean), 0, 0))
        tail = p1 + Vector((lean * 0.03, 0, 0.005))
        for s in (1, -1):
            bf.tube("fish", [tail, tail + Vector((0, 0, 0.04)) + sd * 0.035 * s], [0.012, 0.004], seg=6, squash=((0, 1, 0), 0.3))
    return R
