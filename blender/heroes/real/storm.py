"""Kaia, the Tempest Caller (mage), of the Coast folk (docs/lore/codex/heroes/kaia.md; revamped 2026-11-15 by
docs/lore/codex/revamp.md): a storm caller of the Spires, not a lady of a court. Sea-tanned skin; her silver hair kept,
salt-bleached, streaked sea-green and bound up; the tide lines of nine great floods round both bare forearms (her sleeves
rolled to the elbow); sea-glass in her ears. A knee-length rain-blue oilskin storm coat open over a dark tunic, with a high
collar and a short cape, the storm clouds on her shoulders and the gold bolt on her chest as before; dark leggings and sea
boots; and the tall silver hooked staff in the LEFT hand with a spark caught in its hook (hold = torch)."""
import math

from mathutils import Vector

from realkit import PI, Real
from real import parts_a as P
from real.parts_a import V
from real.parts_d import on_skin


def _soft(d, r):
    t = max(0.0, 1.0 - d / r)
    return t * t * (3 - 2 * t)


def build():
    R = Real("storm", sex="f", height=0.99, width=0.96, skin="#c08a64")
    z = R.z
    R.mat("coat", "#3b6a96", rough=0.46, double=True)
    R.mat("lining", "#1a2e48", rough=0.7, double=True)
    R.mat("dark", "#161a2c", rough=0.55, double=True)
    R.mat("boot", "#23272f", rough=0.4)
    R.mat("cloud", "#7486a8", rough=0.85)
    R.mat("gold", "#d2ae55", rough=0.32, metal=0.85)
    R.mat("silver", "#d8e2ea", rough=0.3, metal=0.8)
    R.mat("spark", "#eaffff", rough=0.25, emit="#6ac4ff", strength=1.0)
    R.mat("glass", "#86e0c8", rough=0.12, metal=0.1, emit="#3fb8a0", strength=0.25)
    R.mat("streak", "#5fb39c", rough=0.4)

    # the tide lines: nine thin blue rings round each forearm, painted on the skin
    for n in "lr":
        e, w = R.bone(f"lowerarm_{n}"), R.bone(f"hand_{n}")
        ax, ln = (w - e).normalized(), (w - e).length
        lines = [0.16 + 0.68 * k / 8 for k in range(9)]

        def tide(p, d, e=e, ax=ax, ln=ln, lines=lines, n=n):
            if not d.startswith(("lowerarm_" + n, "hand_" + n)):
                return 0.0
            t = (p - e).dot(ax) / ln
            return max(_soft(abs(t - ti) * ln, 0.0032) for ti in lines)
        R.paint(tide, "#24609e", 0.85)

    # silver hair, salt-bleached, bound up in one knot at the crown, streaked sea-green strand by strand
    eye, half = R.eye_box()
    hair = R.hair("Hair_Long", "#e3e7ea", rough=0.42)
    hk = [k for k in R.M if k.startswith("hair_")][-1]
    # gathered up: nothing hangs below the ears at the back; the front keeps two short locks by the cheeks
    R.trim_hair(hair, keep=lambda co: co.z > eye.z - 0.03 or (co.y < -0.02 and co.z > eye.z - 0.075))
    hair.data.materials.append(R.M["streak"])
    import bmesh
    bm = bmesh.new()
    bm.from_mesh(hair.data)
    bm.faces.ensure_lookup_table()
    seen, mw = set(), hair.matrix_world
    for f0 in bm.faces:
        if f0.index in seen:
            continue
        isl, todo = [], [f0]
        seen.add(f0.index)
        while todo:
            fc = todo.pop()
            isl.append(fc)
            for e in fc.edges:
                for g in e.link_faces:
                    if g.index not in seen:
                        seen.add(g.index)
                        todo.append(g)
        c = sum((mw @ fc.calc_center_median() for fc in isl), Vector()) / len(isl)
        if any(abs(c.x - x0) < 0.013 for x0 in (0.035, -0.05)) and c.z > eye.z - 0.02:
            for fc in isl:
                fc.material_index = 1
    bm.to_mesh(hair.data)
    bm.free()
    f, hc, hr = R.head_piece()
    # the knot high at the back of the crown, clear of the collar: a twisted bun, bound in sea-green and gold
    knot = hc + V(0, hr * 1.42, hr * 0.5)
    f.ellipsoid(hk, knot, (0.058, 0.05, 0.05), seg=(16, 10))
    f.ellipsoid(hk, knot + V(0, -0.03, -0.035), (0.062, 0.05, 0.04), seg=(14, 8))
    f.torus("streak", knot + V(0, -0.006, -0.02), 0.05, 0.009, normal=(0, 0.75, -0.66), seg=(18, 6))
    f.torus("gold", knot + V(0, -0.002, -0.03), 0.052, 0.0045, normal=(0, 0.75, -0.66), seg=(18, 5))
    f.ellipsoid("glass", knot + V(0.035, 0.03, 0.02), (0.009, 0.009, 0.009), seg=(8, 6))

    R.fitted("Tunic", ["spine", "pelvis", "clavicle"], "coat")
    R.fitted("Sleeves", ["upperarm"], "coat", offset=0.007)
    R.fitted("Leggings", ["thigh", "calf"], "dark", offset=0.003)
    R.boots("boot", top=z["knee"] - 0.03, cuff="boot", toe="boot")
    # the sleeves rolled to the elbow
    for n in "lr":
        c, r = R.arm_r(n, 0.04)
        e, w = R.bone(f"lowerarm_{n}"), R.bone(f"hand_{n}")
        f = R.piece(f"lowerarm_{n}")
        f.torus("coat", c, r + 0.012, 0.014, normal=(w - e), seg=(20, 8))
        f.torus("lining", c + (w - e).normalized() * 0.016, r + 0.008, 0.009, normal=(w - e), seg=(20, 6))

    # the coat's skirt to the knee, open in front over a short dark tunic
    R.skirt("dark", hem=z["hip"] - 0.14, flare=1.12, depth=1.0)
    hem = z["knee"] - 0.02
    R.skirt("coat", hem=hem, flare=1.6, depth=1.2, arc=(0.4, 2 * PI - 0.4), trim="gold", grow=1.05, seg=40)
    R.band("dark", z["waist"], height=0.07, grow=1.13, how=R.hang_w(z["waist"], hem))
    cw, rxw, ryw = R.ring(z["waist"])
    f = R.piece("pelvis")
    f.ellipsoid("gold", V(0, cw.y - ryw * 1.24, z["waist"]), (0.036, 0.014, 0.036), seg=(12, 8))
    f.ellipsoid("spark", V(0, cw.y - ryw * 1.24 - 0.012, z["waist"]), (0.017, 0.008, 0.017), seg=(10, 6))
    # the coat's gold edges down the front
    cc, rxc, ryc = R.ring(z["chest"])
    for s in (1, -1):
        R.piece("near").tube("gold", [P.surf(R, zz, 0.4 * s, out=0.011) for zz in [z["neck"] - 0.07 - (z["neck"] - 0.07 - z["waist"]) * k / 8 for k in range(9)]], 0.006, seg=5)

    # the gold bolt on the chest
    f = R.piece("spine_03")
    y = cc.y - ryc - 0.012
    bolt = [V(0.022, y + 0.012, z["chest"] + 0.105), V(-0.02, y, z["chest"] + 0.045), V(0.016, y, z["chest"] + 0.03), V(-0.018, y + 0.01, z["chest"] - 0.04)]
    f.tube("gold", bolt, [0.013, 0.012, 0.011, 0.002], seg=6, squash=((0, 1, 0), 0.4))

    # storm clouds on the shoulders, a gold clasp on each
    for s, n in ((1, "l"), (-1, "r")):
        f = R.piece(f"upperarm_{n}")
        sh = R.bone(f"upperarm_{n}")
        for dx, dy, dz, k in ((0.015, 0.0, 0.035, 1.0), (0.07, -0.035, 0.02, 0.72), (0.065, 0.045, 0.02, 0.75), (-0.03, 0.01, 0.045, 0.7)):
            f.ellipsoid("cloud", sh + V(dx * s, dy, dz), (0.075 * k, 0.07 * k, 0.05 * k), seg=(14, 8))
        f.ellipsoid("gold", sh + V(-0.035 * s, -0.075, 0.02), (0.02, 0.012, 0.02), seg=(10, 6))

    # a short cape to the small of the back, lined dark, gold at its hem
    P.cloak(R, "coat", hem=z["waist"] + 0.02, width=0.33, depth=0.8, spread=1.25, top_spread=1.7, lining="lining", trim="gold")
    # the high collar, open at the throat
    cn = R.ring(z["neck"], dz=0.02)[0]
    f = R.piece("spine_03")
    col = [(V(0, cn.y - 0.005, z["neck"] - 0.05), 0.1, 0.1), (V(0, cn.y, z["neck"] + 0.02), 0.072, 0.078), (V(0, cn.y + 0.006, z["neck"] + 0.07), 0.078, 0.084)]
    f.loft("coat", col, seg=22, arc=(0.55, 2 * PI - 0.55))
    f.loft("lining", [(c, rx - 0.006, ry - 0.006) for c, rx, ry in col], seg=22, arc=(0.55, 2 * PI - 0.55))

    # sea-glass in her ears
    f = R.piece("Head")
    for s in (1, -1):
        p, nrm = on_skin(R, V(0.3 * s, 0.012, eye.z - 0.03), V(-s, 0, 0), out=0.004)
        f.torus("gold", p + V(0, 0, -0.008), 0.006, 0.0018, normal=(0, 1, 0), seg=(10, 4))
        f.ellipsoid("glass", p + V(0.002 * s, 0, -0.024), (0.0065, 0.006, 0.011), seg=(8, 6))

    # the hooked staff: silver, a spark caught in the hook
    f, o, d, up, out = P.staff(R, "silver", back=1.28, front=0.6, r=0.013)
    f.ellipsoid("gold", o - d * 1.29, (0.022, 0.022, 0.022), seg=(8, 6))
    base = o + d * 0.6
    P.hook(f, "silver", base, d, out, 0.125, r=0.014, turn=1.45 * PI, taper=0.45)
    for t in (0.3, 0.56):
        f.torus("gold", o + d * t, 0.019, 0.006, normal=d, seg=(14, 6))
    core = base + out * 0.125 + d * 0.015
    f.ellipsoid("spark", core, (0.042, 0.042, 0.042), seg=(14, 10))
    for k in range(4):
        a = PI / 4 + PI / 2 * k
        dirv = out * math.cos(a) + d * math.sin(a)
        f.tube("spark", [core + dirv * 0.03, core + dirv * 0.085], [0.011, 0.001], seg=5)
    f.torus("gold", core, 0.05, 0.005, normal=up, seg=(20, 6))
    return R
