"""The Dockhand (a walker of the Sea's floors, docs/tower/life/index.html): a living Coast man who still works the quays
on the morning the water came. Plainer than the named people: no light, no gold. Wiry, sea-tanned, his hair bleached
pale by salt, bare-headed; the tide lines of his people, thin blue rings, on his bare forearms. An undyed linen shirt with
the sleeves rolled to the elbow, a short sea-blue waistcoat, a sea-green sash, canvas trousers to mid-calf over bare
shins, low brown boots. On his back a wooden crate lashed with rope on a porter's frame, a coil of spare rope hung on it.
The hands are free: walkers play the pack's walking clip with both arms (src/tower/world/life/walkers.ts), so everything
he carries is bound to his back. Read beside the Drowned docker (the Sea's common enemy): warm skin, pale hair, light
clothes, no hook. Signature shape: the crate on the back."""
import math

from mathutils import Vector

from realkit import PI, Real
from real import parts_c as P
import folk as K


def build():
    R = Real("sea_dockhand", sex="m", height=1.0, width=1.04, depth=1.02, skin="#b88760")
    z = R.z
    R.mat("linen", "#cbbf9f", rough=0.82, double=True)
    R.mat("blue", "#2e4a66", rough=0.7, double=True)
    R.mat("sea", "#2f6a5e", rough=0.66, double=True)
    R.mat("canvas", "#6c624c", rough=0.85, double=True)
    R.mat("leather", "#4a3222", rough=0.6, double=True)
    R.mat("wood", "#8a6440", rough=0.75)
    R.mat("rope", "#a68c58", rough=0.9)
    R.mat("tide", "#3a6c9a", rough=0.5)
    P.hair(R, "Hair_SimpleParted", "#cdb88a")

    # the linen shirt with the sleeves rolled to the elbow, bare forearms with the tide lines
    el = R.bone("lowerarm_l").x
    R.fitted("Shirt", lambda i: R.dom[i].startswith(("spine", "pelvis", "clavicle", "upperarm")) or (R.dom[i].startswith("lowerarm") and abs(R.world[i].x) < el + 0.04), "linen", offset=0.008)
    for n in "lr":
        P.sleeve(R, n, "linen", t0=-0.02, t1=0.16, r0=0.016, r1=0.0, bones=("lowerarm", "hand"), seg=14, n=2)
    R.cuffs("tide", at=(0.5, 0.58, 0.66), offset=0.001, thick=0.0026)
    P.collar(R, "linen", height=0.05, grow=0.98, flare=0.05)

    # the waistcoat: open at the front, to the waist; the sash; the trousers to mid-calf, bare shins, low boots
    up = R.piece(P.trunk_w(R))
    for s in (1, -1):
        P.wrap(R, up, "blue", z["waist"] - 0.05, z["chest"] + 0.07, 0.28 * s, 3.1 * s if s > 0 else -3.1, off=0.016, taper=(1.0, 0.9))
    for s in (1, -1):
        P.band_on(R, up, "blue", [(z["waist"] - 0.05, 0.28 * s), (z["chest"] + 0.06, 0.42 * s)], 0.012, thick=0.006, off=0.018)
    R.fitted("Trousers", lambda i: R.dom[i].startswith(("thigh", "pelvis")) or (R.dom[i].startswith("calf") and R.world[i].z > z["knee"] - 0.16), "canvas", offset=0.005)
    R.boots("leather", top=z["ankle"] + 0.05)
    P.toes(R, "leather")
    f, rings = P.skirt(R, "linen", z["hip"] - 0.1, flare=1.14, depth=1.08, folds=6, amp=0.01, seg=40)
    R.band("sea", z["waist"] - 0.01, height=0.07, grow=1.15)
    cw, rxw, ryw = R.ring(z["waist"] - 0.01)
    sf = R.piece(R.hang_w(z["waist"], z["knee"]))
    knot = Vector((rxw * 0.85, cw.y - ryw * 0.95, z["waist"] - 0.02))
    sf.ellipsoid("sea", knot, (0.03, 0.022, 0.026), seg=(10, 8))
    for dx, ln in ((0.0, 0.17), (0.025, 0.13)):
        sf.tube("sea", [knot + Vector((dx, -0.005, -0.01)), knot + Vector((dx + 0.012, -0.012, -ln))], [0.022, 0.016], seg=8, squash=((0, 1, 0), 0.3))

    # the porter's frame on his back: two uprights, a crossbar, a crate lashed to it, a coil of rope hung on the side
    bf, bc, (cc, rxc, ryc), ny = K.back_frame(R)
    by = cc.y + ryc + 0.035
    for sx in (1, -1):
        bf.tube("wood", [Vector((0.12 * sx, by, z["waist"] - 0.14)), Vector((0.13 * sx, by + 0.01, z["chest"] + 0.16))], 0.014, seg=8)
    bf.tube("wood", [Vector((-0.15, by + 0.01, z["chest"] + 0.13)), Vector((0.15, by + 0.01, z["chest"] + 0.13))], 0.013, seg=8)
    bf.tube("wood", [Vector((-0.14, by + 0.02, z["waist"] - 0.1)), Vector((0.14, by + 0.02, z["waist"] - 0.1))], 0.016, seg=8)
    K.shoulder_straps(R, bf, "leather", by - 0.005)
    c = Vector((0, by + 0.135, (z["waist"] + z["chest"]) / 2 + 0.02))
    half = (0.17, 0.11, 0.17)
    P.box(bf, "wood", c, half)
    # the crate's battens (darker edges) and the rope lashed round it, crossed at the back
    for sx in (1, -1):
        for sy in (1, -1):
            P.box(bf, "leather", c + Vector((half[0] * sx, half[1] * sy, 0)), (0.012, 0.012, half[2] + 0.004))
    for zz in (-0.08, 0.08):
        pts = [c + Vector((x, y, zz)) for x, y in ((-0.18, -0.115), (0.18, -0.115), (0.18, 0.12), (-0.18, 0.12), (-0.18, -0.115))]
        bf.tube("rope", pts, 0.008, seg=6)
    bf.tube("rope", [c + Vector((-0.17, 0.12, 0.17)), c + Vector((0.17, 0.12, -0.17))], 0.008, seg=6)
    bf.tube("rope", [c + Vector((0.17, 0.12, 0.17)), c + Vector((-0.17, 0.12, -0.17))], 0.008, seg=6)
    # the coil of spare rope hanging on the frame's right upright
    rc = Vector((-0.2, by + 0.11, z["waist"] - 0.02))
    for k in range(4):
        bf.torus("rope", rc + Vector((0.004 * k, 0.006 * k, 0.0)), 0.075 - 0.003 * k, 0.011, normal=(1, 0, 0), seg=(22, 6))
    bf.tube("rope", [rc + Vector((0.0, 0.0, 0.07)), Vector((-0.13, by + 0.02, z["chest"] + 0.0))], 0.009, seg=6)
    return R
