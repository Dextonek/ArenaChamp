"""The Ore-Carrier (a walker of the Deep's floors, docs/tower/life/index.html): a Kilnborn of the far halls, who kept
the old colour because the fire never reached them (docs/lore/codex/climb/deep.md); he carries ore from the seams to
the miners' camp in the dark. Plainer than the named people: no gold, no crown. Short and broad, his beard long and
braided as those who do not work the fire keep it, a leather skullcap. A dusky tunic with the sleeves to the elbow,
leather bracers, a leather apron with two copper rivets, dark trousers, heavy boots. On his back an ore pannier, its
pick slid in beside it; at his belt a small caged shard of crystal that gives a dim light (in the Deep only crystals
give light). The hands are free (walkers play the pack's walking clip with both arms). Signature shape: the broad
figure under the pannier."""
import math

from mathutils import Vector

from realkit import PI, Real
from real import parts_a as PA
from real import parts_c as P
import folk as K


def build():
    R = Real("deep_miner", sex="m", height=0.97, width=1.16, depth=1.12, skin="#a8907e")
    z = R.z
    R.mat("dusk", "#4a4250", rough=0.75, double=True)
    R.mat("leather", "#3a2a20", rough=0.55, double=True)
    R.mat("dark", "#25222a", rough=0.75, double=True)
    R.mat("copper", "#b0683a", rough=0.35, metal=0.8, double=True)
    R.mat("wicker", "#6a5236", rough=0.9)
    R.mat("ore", "#5a5462", rough=0.9)
    R.mat("iron", "#4a4d55", rough=0.42, metal=0.75)
    R.mat("glow", "#e2f0ff", rough=0.25, emit="#8ab8ff", strength=0.6)
    P.hair(R, "Hair_Buzzed", "#1e1b1c", beard="Hair_Beard")

    # the leather skullcap; the beard's braid with a copper clasp
    PA.hair_cap(R, "leather", grow=1.09, line=0.42)
    h = P.head(R)
    ch = h.chin
    PA.braid(R, "dark", [ch + Vector((0, -0.01, -0.02)), ch + Vector((0, -0.03, -0.08)), ch + Vector((0, -0.045, -0.15))], r0=0.02, r1=0.013, n=6, head_n=6, clasp=None)
    R.piece("Head").torus("copper", ch + Vector((0, -0.045, -0.15)), 0.015, 0.005, seg=(12, 5))

    # the tunic to the elbows, bracers on the forearms; the apron; trousers and boots
    el = R.bone("lowerarm_l").x
    R.fitted("Tunic", lambda i: R.dom[i].startswith(("spine", "pelvis", "clavicle", "upperarm")) or (R.dom[i].startswith("lowerarm") and abs(R.world[i].x) < el + 0.04), "dusk", offset=0.009)
    for n in "lr":
        P.sleeve(R, n, "dusk", t0=-0.02, t1=0.14, r0=0.014, r1=0.0, bones=("lowerarm", "hand"), seg=14, n=2)
    wr = R.bone("hand_l").x
    R.fitted("Bracers", ["lowerarm"], "leather", offset=0.008, where=lambda p: el + (wr - el) * 0.5 < abs(p.x) < el + (wr - el) * 0.92)
    P.collar(R, "dusk", height=0.05, grow=0.98, flare=0.05)
    R.fitted("Trousers", ["thigh", "calf", "pelvis"], "dark", offset=0.004)
    R.boots("leather", top=z["knee"] - 0.1, cuff="leather")
    P.toes(R, "leather", size=1.1)
    P.skirt(R, "dusk", z["hip"] - 0.12, flare=1.18, depth=1.1, folds=7, amp=0.012, seg=44)
    P.skirt(R, "leather", z["knee"] - 0.04, flare=1.35, depth=1.1, arc=(-1.0, 1.0), folds=4, amp=0.01, grow=1.07, seg=24)
    up = R.piece(P.trunk_w(R))
    P.wrap(R, up, "leather", z["waist"] - 0.02, z["chest"] + 0.03, -0.6, 0.6, off=0.022, taper=(1.0, 0.8))
    for s in (1, -1):
        p, out = P.on_trunk(R, z["chest"] + 0.02, 0.45 * s, off=0.028)
        up.ellipsoid("copper", p, (0.012, 0.012, 0.012), seg=(8, 6))
    R.band("leather", z["waist"] - 0.02, height=0.05, grow=1.17)

    # the small caged shard at his left hip: a dim light
    cw, rxw, ryw = R.ring(z["waist"] - 0.02)
    pf = R.piece("pelvis")
    sc = Vector((rxw * 1.18, cw.y - ryw * 0.3, z["waist"] - 0.1))
    pf.tube("copper", [sc + Vector((0, 0, 0.08)), sc + Vector((0, 0, 0.05))], 0.004, seg=5)
    P.hull(pf, "glow", [sc + Vector((0, 0, -0.035)), sc, sc + Vector((0, 0, 0.045))], [0.004, 0.017, 0.004], [0.004, 0.014, 0.004], seg=6, side=Vector((1, 0, 0)))
    for a in range(4):
        u = Vector((math.cos(PI / 4 + a * PI / 2), math.sin(PI / 4 + a * PI / 2), 0))
        pf.tube("copper", [sc + Vector((0, 0, 0.05)), sc + u * 0.026, sc + Vector((0, 0, -0.045))], 0.003, seg=4)

    # the ore pannier on his back, on two straps, the ore heaped in it; the pick beside it
    bf, bc, (cc, rxc, ryc), ny = K.back_frame(R)
    base = Vector((0, cc.y + ryc + 0.15, z["waist"] - 0.12))
    top = K.basket(bf, "wicker", "leather", base, 0.14, 0.16, 0.34, bands=(0.5,), band_key="leather")
    for k in range(8):
        a = 2.4 * k
        rr = 0.1 * math.sqrt((k + 0.5) / 8)
        p = top + Vector((rr * math.cos(a), rr * math.sin(a) * 0.8, 0.015 + 0.03 * (k % 3) / 2))
        bf.ellipsoid("ore", p, (0.05, 0.045, 0.04), seg=(7, 5))
    bf.ellipsoid("ore", top + Vector((0, 0, 0.05)), (0.07, 0.06, 0.05), seg=(8, 5))
    K.shoulder_straps(R, bf, "leather", cc.y + ryc + 0.03)
    p0 = Vector((0.2, base.y - 0.02, z["waist"] - 0.14))
    p1 = Vector((0.18, base.y + 0.0, z["chest"] + 0.2))
    bf.tube("wicker", [p0, p1], 0.014, seg=8)
    hd = p1 - Vector((0, 0, 0.02))
    bf.tube("iron", [hd + Vector((0, -0.14, 0.02)), hd + Vector((0, -0.04, 0.01)), hd, hd + Vector((0, 0.06, 0.01)), hd + Vector((0, 0.15, -0.03))],
            [0.004, 0.013, 0.018, 0.013, 0.004], seg=8)
    return R
