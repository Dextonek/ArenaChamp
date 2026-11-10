"""Restyle batch 2 (pipeline/designs/heroes-restyle.md): Mr. Ledger, Mum, Referee Whistler, Madame Cleaver, Gus. Loaded by moba_figures._restyle_batches()."""
from moba_figures import *  # noqa: F401,F403  (MobaFigure, the helpers, kit, figure_kit, math, Vector, Euler, the old classes)


# ============================================================================================ Mr. Ledger
class LedgerMythic(MobaFigure):
    """
    Mr. Ledger, the Tithe-Keeper (controller): an arcane notary, long and thin. Long black robes to the floor with an
    oxblood front panel edged in gold, a high stiff oxblood collar, wide sleeves with gold cuffs, a gold belt and two
    swags of gold coins on chains across the chest, grey slicked hair and a calm, severe face. Signature: a great red
    book held upright at his left side and chained to his wrist, a glowing red wax seal on its cover, and a quill staff
    in the right hand, taller than he is, with a long feather on top.
    """

    J = dict(hip=1.0, waist=1.12, neck=1.52, head=1.58, top=1.86, shoulder=(0.16, 0.01, 1.47),
             elbow_x=0.27, elbow_z=1.23, wrist_x=0.262, wrist_z=1.0, hand=0.09, leg_x=0.08, knee=0.56)

    SCULPT = True
    FUSE = (("Face", "skin", ("only", "Head", "Nose", "Ear"), 0.0036, 9000, None, 10),
            ("Skin", "skin", ("Face",), 0.0045, 2600, None, 12),
            ("RobeBody", "robe", (), 0.006, 6000, None, 12),
            ("Boots", "boot", (), 0.006, 1500, None, 8))
    FOLDS = ((("RobeSkirt",), dict(below=1.04, n=15, amp=0.011, seed=5.0)),)
    WRAP = (("Mouth", "Face", 0.0012), ("Brow", "Face", 0.002))
    PAINT = {"skin": dict(warm=0.8), "robe": dict(shadow=(0.6, 0.5, 0.62)), "robeskirt": dict(shadow=(0.6, 0.5, 0.62)),
             "panel": dict(shadow=(0.7, 0.45, 0.5)), "hair": dict(shadow=(0.6, 0.6, 0.72))}

    def __init__(self):
        super().__init__("ledger", self.J)

    def body(self):
        boot = self.mat("boot", "#17131a", roughness=0.5)
        legs = self.mat("legs", "#1c1620", roughness=0.8)
        robe = self.mat("robe", "#2c2030", roughness=0.7)
        skirt_m = self.mat("robeskirt", "#271c2b", roughness=0.7)
        lining = self.mat("lining", "#160f1a", roughness=0.7, double_sided=True)
        panel = self.mat("panel", "#7a2230", roughness=0.6)
        dark = self.mat("dark", "#1c1520", roughness=0.55, double_sided=True)
        gold = self.mat("gold", "#d2ae55", metallic=0.7, roughness=0.3, double_sided=True)
        sash = self.mat("sash", "#a8842e", roughness=0.5)
        skin = self.mat("skin", "#d8b496", roughness=0.5)
        hair = self.mat("hair", "#8c8c98", roughness=0.55)
        eyew = self.mat("eyewhite", "#fff8f0", roughness=0.4)
        iris = self.mat("iris", "#a8362c", roughness=0.2, emission="#ff5a40", strength=0.9)
        lash = self.mat("lash", "#2a2430", roughness=0.6)
        cover = self.mat("cover", "#6a1a26", roughness=0.5)
        spine = self.mat("spine", "#3e0e18", roughness=0.5)
        pages = self.mat("pages", "#c8b88e", roughness=0.8)
        seal = self.mat("seal", "#ff5a3c", roughness=0.15, emission="#ff3a24", strength=2.4)
        staff = self.mat("staff", "#241c2a", metallic=0.4, roughness=0.45)
        vane = self.mat("vane", "#8a7a98", roughness=0.7, double_sided=True)
        J = self.J

        self.legs(legs, boot, thigh=(0.066, 0.052), shin=0.046, boot_r=0.05, boot_top=0.3, toe=0.24, cuff=gold)
        # the robe: fitted to the waist, long skirt to the floor with a gold hem, an oxblood panel down the front
        self.add(loft("Torso", [kit.ring_z(z, rx, ry) for z, rx, ry in [(1.02, 0.122, 0.09), (1.14, 0.112, 0.08), (1.28, 0.132, 0.088), (1.4, 0.155, 0.1), (1.48, 0.125, 0.085), (1.54, 0.05, 0.05)]], robe, seg=24), ["chest", "pelvis"])
        skirt = short_skirt(J["hip"], J["knee"], 0.12)
        self.bell("RobeSkirt", [(1.12, 0.118, 0.086), (1.0, 0.16, 0.12), (0.78, 0.215, 0.17), (0.46, 0.26, 0.205), (0.15, 0.29, 0.23)], skirt_m, lining, hem=gold, n=28, weights=skirt)
        self.add(tube("Panel", (0, -0.088, 1.5), (0, -0.092, 1.1), [(0, 0.05, 0.012), (0.5, 0.054, 0.012), (1, 0.05, 0.012)], panel, seg=8, side=(1, 0, 0)), "chest")
        front = [Vector((0, -0.096, 1.1)), Vector((0, -0.136, 0.94)), Vector((0, -0.178, 0.72)), Vector((0, -0.215, 0.44)), Vector((0, -0.236, 0.18))]
        self.add(chain("SkirtPanel", front, [(0.052, 0.008), (0.062, 0.008), (0.074, 0.008), (0.082, 0.008), (0.088, 0.008)], panel, seg=8), skirt)
        for s, x in SIDES:
            self.add(chain(f"PanelEdge{s}", [Vector((0.052 * x, -0.09, 1.5)), Vector((0.054 * x, -0.1, 1.3)), Vector((0.052 * x, -0.1, 1.1))], [0.0065] * 3, gold, seg=6), "chest")
            self.add(chain(f"SkirtEdge{s}", [p + Vector(((0.054 + 0.009 * i) * x, -0.004, 0)) for i, p in enumerate(front)], [0.0065] * 5, gold, seg=6), skirt)
        # a gold belt with a clasp
        self.add(loft("Belt", [kit.ring_z(1.04, 0.138, 0.102), kit.ring_z(1.1, 0.134, 0.098)], sash, seg=24), "pelvis")
        self.add(kit.box("Clasp", (0, -0.104, 1.07), (0.05, 0.012, 0.046), gold, bevel=0.005, segments=1), "pelvis")
        # two swags of gold coins on chains from the collar to the belt
        for s, x in SIDES:
            pts = kit.spline([Vector((0.07 * x, -0.07, 1.5)), Vector((0.095 * x, -0.108, 1.38)), Vector((0.06 * x, -0.122, 1.24)), Vector((0.03 * x, -0.118, 1.12))], 14)
            self.add(kit.chain(f"CoinChain{s}", pts, [0.0045] * len(pts), gold, seg=5), "chest")
            for k in (2, 5, 8, 11):
                self.add(kit.blob(f"Coin{s}{k}", pts[k] + Vector((0, -0.006, -0.012)), (0.017, 0.005, 0.017), gold, segs=(12, 6)), "chest")
        # wide sleeves, gold cuffs
        self.arms(robe, robe, skin, r=(0.056, 0.05, 0.044), flare=0.04, cuff=gold, hand=(0.04, 0.045, 0.062))
        # the high stiff collar, oxblood, flaring away from the head, a gold rim
        self.add(arc_shell("Collar", [(1.74, 0.178, 0.168, 0.035), (1.64, 0.13, 0.12, 0.014), (1.52, 0.118, 0.1, 0.0)], -0.72, math.pi + 0.72, panel, thick=0.012, seg=40), "chest")
        rim = [Vector((0.168 * math.cos(a), 0.035 + 0.16 * math.sin(a), 1.74)) for a in [-0.72 + (math.pi + 1.44) * k / 20 for k in range(21)]]
        self.add(chain("CollarRim", rim, [0.007] * len(rim), gold, seg=6), "chest")

        # head: long and narrow, small nose, calm eyes with a faint red glint, a closed severe mouth
        hc = Vector((0, -0.012, 1.7))
        r = (0.106, 0.115, 0.148)
        self.head_shape(hc, r, skin, chin=0.32)
        for s, x in SIDES:
            self.add(blob(f"Ear{s}", hc + Vector((0.108 * x, 0.005, 0.0)), (0.014, 0.026, 0.034), skin, (10, 8)), "head")
        self.eyes(hc, r, eyew, iris, eyew, spread=0.045, size=(0.024, 0.028), z=0.016, lash=lash)
        for s, x in SIDES:
            self.add(chain(f"Brow{s}", [hc + Vector((0.02 * x, -0.112, 0.074)), hc + Vector((0.05 * x, -0.106, 0.088)), hc + Vector((0.088 * x, -0.076, 0.08))], [0.006, 0.008, 0.004], lash, seg=8), "head")
        self.face(hc, r, skin, self.mat("lips", "#8a4a40", roughness=0.45), nose=0.013, smile=0.002, width=0.022, z=-0.55, out=0.005)
        # grey hair slicked back from the brow, a long fall behind
        self.add(blob("HairCap", hc + Vector((0, 0.022, 0.05)), (0.122, 0.13, 0.148), hair, (22, 14)), "head")
        self.add(blob("HairSweep", hc + Vector((0, 0.1, 0.0)), (0.1, 0.1, 0.13), hair, (16, 10)), "head")
        self.add(blob("HairBack", hc + Vector((0, 0.08, -0.07)), (0.09, 0.08, 0.1), hair, (16, 10)), "head")

        # signature: the great book held upright at his left side, turned to show its cover to the front, the glowing
        # wax seal on it, chained to his wrist
        def bw(p):
            return {"chest": 0.4, "upper_arm.L": 0.3, "forearm.L": 0.3}
        c = Vector((0.285, -0.07, 1.12))
        M = Matrix.Translation(c) @ Matrix.Rotation(math.radians(-48), 4, "Z")
        W, H, T = 0.46, 0.58, 0.13
        parts = [kit.box("BookFront", (0.5 * T - 0.009, 0, 0), (0.018, W, H), cover, bevel=0.006, segments=1),
                 kit.box("BookBack", (-0.5 * T + 0.009, 0, 0), (0.018, W, H), cover, bevel=0.006, segments=1),
                 kit.box("BookSpine", (0, 0.5 * W - 0.012, 0), (T, 0.03, H), spine, bevel=0.01, segments=1),
                 kit.box("BookPages", (0, -0.008, 0), (T - 0.03, W - 0.03, H - 0.03), pages, bevel=0.002, segments=1)]
        for k, (dy, dz) in enumerate(((-0.5, 0.5), (-0.5, -0.5), (0.5, 0.5), (0.5, -0.5))):
            parts.append(kit.box(f"BookCorner{k}", (0, dy * (W - 0.05), dz * (H - 0.05)), (T + 0.012, 0.06, 0.06), gold, bevel=0.006, segments=1))
        for k, z_ in enumerate((0.17, -0.17)):
            parts.append(kit.box(f"BookBand{k}", (0, 0.08, z_), (T + 0.01, W - 0.14, 0.024), gold, bevel=0.003, segments=1))
        parts.append(kit.blob("BookSeal", (0.5 * T + 0.004, -0.02, 0.02), (0.014, 0.085, 0.085), seal, segs=(16, 8)))
        parts.append(kit.blob("BookSealB", (-0.5 * T - 0.004, -0.02, 0.02), (0.014, 0.06, 0.06), seal, segs=(16, 8)))
        for ob in parts:
            kit.transform(ob, M)
            self.add(ob, bw)
        # the wrist cuff and its chain to the book's lower corner
        sh, el, wr = self.shoulder_pts(1)
        f = (wr - el).normalized()
        self.add(band("WristShackle", wr + f * 0.004, 0.05, 0.0085, gold, seg=(20, 6), axis=f), "forearm.L")
        cor = M @ Vector((0, -0.2, -0.28))
        link = kit.spline([wr + Vector((0.0, -0.02, -0.01)), wr.lerp(cor, 0.5) + Vector((0.0, -0.03, -0.06)), cor], 8)
        self.add(kit.chain("BookChain", link, [0.0065] * len(link), gold, seg=6), bw)
        # the quill staff in the right hand, taller than he is, with a long feather on top
        h = self.hand_at(-1)
        a, b = h + Vector((0, -0.01, -0.86)), h + Vector((-0.02, -0.05, 1.05))
        self.add(tube("Staff", a, b, [(0, 0.016, 0.016), (1, 0.02, 0.02)], staff, seg=10), "hand.R")
        self.add(tube("StaffFoot", a, a.lerp(b, 0.04), [(0, 0.024, 0.024), (1, 0.02, 0.02)], gold, seg=10), "hand.R")
        for k, t in enumerate((0.8, 0.86)):
            self.add(band(f"StaffBand{k}", a.lerp(b, t), 0.022, 0.006, gold, seg=(16, 6), axis=b - a), "hand.R")
        self.add(tube("StaffCollar", b - Vector((0, 0, 0.04)), b + Vector((0, 0, 0.05)), [(0, 0.022, 0.022), (0.5, 0.034, 0.034), (1, 0.016, 0.016)], gold, seg=10), "hand.R")
        sp = [b + Vector((0, 0, 0.04)), b + Vector((0.02, 0.01, 0.3)), b + Vector((0.08, 0.02, 0.56)), b + Vector((0.16, 0.02, 0.76))]
        self.add(kit.chain("QuillShaft", kit.spline(sp, 12), [0.009] * 12, gold, seg=6), "hand.R")
        vp = kit.spline([sp[0] + Vector((0.0, 0.0, 0.14)), sp[1] + Vector((0.0, 0.0, 0.08)), sp[2], sp[3]], 14)
        self.add(kit.ribbon("QuillVane", vp, lambda t: 0.11 * math.sin(math.pi * min(1.0, t * 1.05)) ** 0.6 + 0.004, vane, normal=(0, -1, 0)), "hand.R")
        self.joints_fill(neck=(skin, 0.042), shoulder=(robe, 0.058), elbow=(robe, 0.05), wrist=(skin, 0.032), hip=(legs, 0.07), knee=(legs, 0.052))


# ============================================================================================ Mum
class MimeMythic(Mime):
    """
    Mum, the Silent One (controller): a masked harlequin, thin and still. A smooth porcelain mask over the big head with
    large dark eyes and a small closed mouth, a gold diamond on the brow, a dark hood, an ivory ruff, a long dark coat to the
    shins with ivory diamonds down the front and on the sleeves, gold trim. Signature: huge pale gloves with open,
    spread fingers, gold cuffs and a faint glow, the one thing she talks with, and a long dark violet ribbon flying behind
    her on a sway chain.
    """

    SCULPT = True
    FUSE = (("Face", "paint", ("only", "Head", "Nose", "Ear", "Cheek"), 0.0036, 9500, None, 10),
            ("Neck", "skin", (), 0.005, 800, None, 8),
            ("LegsBody", "trousers", (), 0.0055, 4000, None, 12),
            ("Shoes", "shoe", (), 0.0055, 1200, None, 8),
            ("CoatBody", "coat", (), 0.006, 6000, None, 12),
            ("HoodBody", "hood", (), 0.005, 2400, None, 8),
            ("GloveBody", "glove", ("Frill",), 0.0035, 6000, None, 4))
    FOLDS = ((("CoatSkirt",), dict(below=1.06, n=13, amp=0.012, seed=2.0)),)
    WRAP = (("Mouth", "Face", 0.0012), ("Mark", "Face", 0.0035))
    PAINT = {"paint": dict(shadow=(0.72, 0.72, 0.95)), "glove": dict(shadow=(0.62, 0.66, 0.95)), "coat": dict(shadow=(0.55, 0.5, 0.7)),
             "coatskirt": dict(shadow=(0.55, 0.5, 0.7))}

    def body(self):
        shoe = self.mat("shoe", "#15131c", roughness=0.35)
        trousers = self.mat("trousers", "#1c1824", roughness=0.75)
        coat = self.mat("coat", "#3c3452", roughness=0.7)
        skirt_m = self.mat("coatskirt", "#342c48", roughness=0.7)
        lining = self.mat("lining", "#14101c", roughness=0.7, double_sided=True)
        ivory = self.mat("ivory", "#c4bca6", roughness=0.6)
        gold = self.mat("gold", "#d2ae55", metallic=0.7, roughness=0.3, double_sided=True)
        paint_m = self.mat("paint", "#c8c6c0", roughness=0.35)
        skin = self.mat("skin", "#b8b4b0", roughness=0.55)
        hood = self.mat("hood", "#201b2a", roughness=0.8)
        ribbon = self.mat("ribbon", "#5c4a8c", roughness=0.6, double_sided=True)
        lips = self.mat("lips", "#7a3a4c", roughness=0.4, double_sided=True)
        glove_m = self.mat("glove", "#b8b6c8", roughness=0.55, emission="#c4c2ff", strength=0.55)
        eyew = self.mat("eyewhite", "#1c1824", roughness=0.3)
        iris = self.mat("iris", "#b8b4f4", roughness=0.2, emission="#a8a4ff", strength=0.8)
        glint = self.mat("glint", "#ffffff", roughness=0.3)
        J = self.J

        self.legs(trousers, shoe, thigh=(0.066, 0.05), shin=0.045, boot_r=0.05, boot_top=0.3, toe=0.22, cuff=gold)
        self.add(loft("Hips", [kit.ring_z(z, rx, ry) for z, rx, ry in [(1.12, 0.112, 0.08), (1.02, 0.122, 0.088), (0.92, 0.13, 0.092), (0.82, 0.105, 0.078)]], trousers, seg=24), ["pelvis", "thigh.L", "thigh.R"])
        # the coat: fitted, with a long skirt to the shins, a gold hem, ivory diamonds down the front
        tr = [(1.46, 0.07, 0.06), (1.42, 0.135, 0.09), (1.33, 0.16, 0.103), (1.24, 0.14, 0.092), (1.15, 0.115, 0.08), (1.09, 0.11, 0.078)]
        self.add(loft("Torso", [kit.ring_z(z, rx, ry) for z, rx, ry in tr], coat, seg=24), ["chest", "pelvis"])
        skirt = short_skirt(J["hip"], J["knee"], 0.12)
        self.bell("CoatSkirt", [(1.1, 0.118, 0.088), (0.92, 0.17, 0.13), (0.66, 0.225, 0.17), (0.4, 0.27, 0.205)], skirt_m, lining, hem=gold, n=28, weights=skirt)
        self.add(loft("Belt", [kit.ring_z(1.07, 0.114, 0.082), kit.ring_z(1.11, 0.11, 0.08)], gold, seg=24), "pelvis")
        rot = Euler((0, math.radians(45), 0))
        for q in (-1, 1):
            for k, (z, y) in enumerate(((1.36, 0.098), (1.23, 0.095))):
                self.add(kit.box(f"Diamond{q}{k}", (0, q * (y + 0.004), z), (0.058, 0.008, 0.058), ivory, rotation=rot), "chest")
            for k, (z, y, sz) in enumerate(((0.92, 0.136, 0.075), (0.7, 0.176, 0.09), (0.46, 0.208, 0.1))):
                self.add(kit.box(f"SkirtDiamond{q}{k}", (0, q * y, z), (sz, 0.008, sz), ivory, rotation=rot), skirt)
        for s, x in SIDES:
            for k, (z, y, sz) in enumerate(((0.8, -0.1, 0.06), (0.56, -0.12, 0.07))):
                self.add(kit.box(f"SkirtDiamond{s}{k}", (0.15 * x * (1.2 if k else 1.0), y, z), (sz, 0.008, sz), ivory, rotation=rot), skirt)
            sh, el, wr = self.shoulder_pts(x)
            self.add(tube(f"UpperArm{s}", sh, el, [(0, 0.054, 0.054), (1, 0.047, 0.047)], coat, seg=12), [f"upper_arm.{s}", f"forearm.{s}"])
            self.add(tube(f"Forearm{s}", el, el.lerp(wr, 0.86), [(0, 0.047, 0.047), (1, 0.042, 0.042)], coat, seg=14), f"forearm.{s}")
            m = sh.lerp(el, 0.5)
            self.add(kit.box(f"SleeveDiamond{s}", m + Vector((0, -0.05, 0.0)), (0.045, 0.008, 0.045), ivory, rotation=rot), [f"upper_arm.{s}"])
            self.glove(x, glove_m, gold, size=1.8)
        # an ivory ruff at the throat and a gold brooch
        self.add(torus("Ruff", (0, 0.0, 1.46), 0.11, 0.04, ivory, seg=(32, 8)), ["chest", "neck"])
        self.add(kit.box("Brooch", (0, -0.1, 1.43), (0.036, 0.01, 0.036), gold, bevel=0.004, segments=1, rotation=rot), "chest")
        # head: a smooth porcelain mask, big dark eyes with a pale glint, a gold diamond on the brow, a small closed mouth
        hc = Vector((0, -0.012, 1.62))
        r = (0.128, 0.13, 0.152)
        self.head_shape(hc, r, paint_m, chin=0.4)
        self.add(blob("Nose", hc + Vector((0, -0.128, -0.02)), (0.014, 0.016, 0.017), paint_m, (10, 8)), "head")
        spread = 0.054
        self.eyes(hc, r, eyew, iris, glint, spread=spread, size=(0.028, 0.036), z=0.014)
        for s, x in SIDES:
            ex = spread * x
            y = hc.y - r[1] * math.sqrt(max(0.0, 1 - (ex / r[0]) ** 2)) - 0.012
            # a thin gold line down each cheek from the eye, and a high painted brow
            pts = [Vector((ex, y, hc.z + 0.014 - 0.045 - 0.017 * k)) for k in range(5)]
            self.add(kit.ribbon(f"MarkTear{s}", pts, lambda t: 0.006 * (1 - t) + 0.002, gold, normal=(0, -1, 0)), "head")
            self.add(chain(f"Brow{s}", [hc + Vector(v) for v in [(0.024 * x, -0.122, 0.104), (0.05 * x, -0.122, 0.12), (0.082 * x, -0.104, 0.114), (0.108 * x, -0.07, 0.085)]], [0.003, 0.0065, 0.006, 0.002], eyew, seg=8), "head")
        fy = hc.y - r[1] * 0.93
        self.add(kit.ribbon("MarkDiamond", [Vector((0, fy, hc.z + 0.085 + dz)) for dz in (-0.03, -0.015, 0.0, 0.015, 0.03)], lambda t: 0.03 * (1 - abs(2 * t - 1)) + 0.001, gold, normal=(0, -1, 0)), "head")
        self.grin(hc, r, -0.6, 0.026, 0.004, 0.008, lips)
        # the dark hood over the skull and shoulders, its edge framing the mask
        self.add(blob("HoodCap", hc + Vector((0, 0.045, 0.03)), (0.134, 0.138, 0.15), hood, (22, 14)), "head")
        self.add(blob("HoodBack", hc + Vector((0, 0.07, -0.06)), (0.12, 0.09, 0.11), hood, (16, 10)), "head")
        # the long dark ribbon flying behind her on a sway chain
        tail = [Vector(v) for v in [(-0.04, 0.09, 1.45), (-0.09, 0.2, 1.36), (-0.15, 0.31, 1.26), (-0.21, 0.42, 1.15), (-0.26, 0.53, 1.03), (-0.3, 0.64, 0.9), (-0.33, 0.74, 0.78)]]
        bones = self.sway("scarf", "neck", tail)
        for i in range(6):
            self.add(tube(f"RibbonTail{i}", tail[i], tail[i + 1], [(0, 0.08 + 0.004 * i, 0.012), (1, 0.084 + 0.004 * i, 0.012)], ribbon, seg=8, side=(1, -0.4, 0)), bones[i])
        self.joints_fill(neck=(skin, 0.04), shoulder=(coat, 0.056), elbow=(coat, 0.048), hip=(trousers, 0.07), knee=(trousers, 0.052))


# ============================================================================================ Referee Whistler
class RefereeMythic(Referee):
    """
    Referee Whistler, the Arbiter (controller): an arena judge, short and stern, in dark lacquered armour with a black and
    ivory striped tabard hanging front and back, dark greaves, small gold-edged pauldrons, and a black helm with a gold
    brow band and a red crest. A calm square face, a closed mouth. Signature: a silver horn on a gold chain across the
    chest, and red and gold sigil tablets at the belt, front and back, in place of cards, their sigils glowing.
    """

    SCULPT = True
    FUSE = (("Face", "skin", ("only", "Head", "Nose", "Jaw", "Ear", "Cheek"), 0.0038, 8000, None, 9),
            ("Skin", "skin", ("Face",), 0.0055, 2500, None, 12),
            ("ArmorBody", "armor", ("only", "Torso", "Collar", "Joint"), 0.006, 4500, None, 10),
            ("LegsBody", "legs", (), 0.006, 2400, None, 10),
            ("Boots", "boot", (), 0.006, 1800, None, 8),
            ("HelmBody", "helm", (), 0.005, 2200, None, 8))
    FOLDS = ((("Faulds",), dict(below=0.7, n=13, amp=0.008, seed=3.0)),)
    WRAP = (("Mouth", "Face", 0.0012), ("Brow", "Face", 0.002))
    PAINT = {"skin": dict(warm=1.0), "armor": dict(shadow=(0.6, 0.55, 0.75)), "faulds": dict(shadow=(0.6, 0.55, 0.75)),
             "helm": dict(shadow=(0.6, 0.55, 0.75)), "cloth": dict(shadow=(0.6, 0.55, 0.75))}

    def body(self):
        boot = self.mat("boot", "#1c1820", roughness=0.4)
        legs = self.mat("legs", "#201c26", roughness=0.8)
        armor = self.mat("armor", "#38323e", metallic=0.35, roughness=0.4)
        faulds = self.mat("faulds", "#2e2934", metallic=0.3, roughness=0.45, double_sided=True)
        greave = self.mat("greave", "#3a3540", metallic=0.4, roughness=0.4)
        cloth = self.mat("cloth", "#26212c", roughness=0.75, double_sided=True)
        ivory = self.mat("ivory", "#b6b09e", roughness=0.7, double_sided=True)
        gold = self.mat("gold", "#d2ae55", metallic=0.7, roughness=0.3, double_sided=True)
        leather = self.mat("leather", "#3e2e28", roughness=0.65)
        glove = self.mat("glove", "#2c2622", roughness=0.6)
        red = self.mat("red", "#9a2a30", roughness=0.45)
        sigil = self.mat("sigil", "#ff7a42", roughness=0.15, emission="#ff5a2a", strength=2.3)
        silver = self.mat("horn", "#b8bec8", metallic=0.65, roughness=0.25)
        helm = self.mat("helm", "#2c2832", metallic=0.35, roughness=0.4)
        crest = self.mat("crest", "#8c2a32", roughness=0.6, double_sided=True)
        skin = self.mat("skin", "#d6a884", roughness=0.55)
        dark = self.mat("brow", "#1c181e", roughness=0.5)
        eyew = self.mat("eyewhite", "#fff8f0", roughness=0.4)
        iris = self.mat("iris", "#3a3438", roughness=0.25)
        J = self.J

        # legs: dark leggings, greaves with gold bands and a gold knee guard, dark boots
        self.legs(legs, boot, thigh=(0.08, 0.058), shin=0.05, boot_r=0.058, boot_top=0.16, toe=0.2, cuff=gold)
        for s, x in SIDES:
            X = J["leg_x"] * x
            self.add(tube(f"Greave{s}", (X, 0, 0.29), (X, 0, 0.1), [(0, 0.064, 0.064), (1, 0.054, 0.054)], greave, seg=14, cap=(False, False)), f"shin.{s}")
            self.add(band(f"GreaveRim{s}", (X, 0, 0.29), 0.065, 0.007, gold, seg=(20, 6)), f"shin.{s}")
            self.add(band(f"GreaveBand{s}", (X, 0, 0.12), 0.056, 0.006, gold, seg=(20, 6)), f"shin.{s}")
            self.add(kit.blob(f"Knee{s}", (X, -0.04, J["knee"]), (0.05, 0.03, 0.042), gold, segs=(16, 10)), [f"thigh.{s}", f"shin.{s}"])
        # short lacquered faulds over the hips
        self.bell("Faulds", [(0.7, 0.19, 0.155), (0.6, 0.225, 0.18), (0.46, 0.245, 0.195)], faulds, None, hem=gold, n=24, weights=short_skirt(J["hip"], J["knee"], 0.14))
        # the cuirass: dark lacquer, a gold gorget at the throat
        tr = [(1.11, 0.08, 0.075, 0.0), (1.06, 0.17, 0.125, 0.0), (0.98, 0.21, 0.15, -0.005), (0.88, 0.205, 0.165, -0.025), (0.77, 0.2, 0.17, -0.03), (0.68, 0.19, 0.155, -0.012)]
        self.add(loft("Torso", [kit.ring_z(z, rx, ry, cy) for z, rx, ry, cy in tr], armor, seg=26), ["chest", "pelvis"])
        self.add(torus("Collar", (0, 0, 1.092), 0.088, 0.026, armor, seg=(32, 6)), ["chest", "neck"])
        self.add(band("CollarGold", (0, 0, 1.115), 0.09, 0.008, gold, seg=(32, 6)), ["chest", "neck"])
        # the tabard: black cloth with ivory stripes, front and back, to the knees, a gold hem
        skirt = short_skirt(J["hip"], J["knee"], 0.14)
        for side, y0, y1, nm in ((-1, -0.178, -0.232, "F"), (1, 0.182, 0.236, "B")):
            self.add(tube(f"Tabard{nm}", (0, y0, 1.02), (0, y1, 0.36), [(0, 0.12, 0.01), (1, 0.135, 0.01)], cloth, seg=10, side=(1, 0, 0)), skirt)
            for k, dx in enumerate((-0.075, 0.0, 0.075)):
                self.add(tube(f"TabardStripe{nm}{k}", (dx, y0 + side * 0.011, 1.0), (dx * 1.1, y1 + side * 0.011, 0.38), [(0, 0.022, 0.006), (1, 0.024, 0.006)], ivory, seg=8, side=(1, 0, 0)), skirt)
            self.add(chain(f"TabardHem{nm}", [Vector((-0.136, y1 + side * 0.012, 0.36)), Vector((0.136, y1 + side * 0.012, 0.36))], [0.009, 0.009], gold, seg=6), skirt)
            for s, x in SIDES:
                self.add(chain(f"TabardEdge{nm}{s}", [Vector((0.12 * x, y0 + side * 0.011, 1.02)), Vector((0.135 * x, y1 + side * 0.011, 0.36))], [0.006, 0.006], gold, seg=6), skirt)
        # the belt, a buckle, and two sigil tablets in front, two behind, the glowing sigils the only bright thing on him
        self.add(loft("Belt", [kit.ring_z(0.69, 0.197, 0.163, -0.012), kit.ring_z(0.74, 0.2, 0.168, -0.016)], leather, seg=24), "pelvis")
        for q, y, nm in ((-1, -0.247, "F"), (1, 0.252, "B")):
            for k, dx in enumerate((-0.08, 0.08) if q < 0 else (0.0,)):
                c = Vector((dx, y, 0.58))
                big = 1.7 if q > 0 else 1.35
                self.add(kit.box(f"Tablet{nm}{k}", c, (0.075 * big, 0.012, 0.115 * big), red, bevel=0.004, segments=1), "pelvis")
                self.add(kit.box(f"TabletFrame{nm}{k}", c + Vector((0, q * 0.004, 0)), (0.087 * big, 0.008, 0.127 * big), gold, bevel=0.003, segments=1), "pelvis")
                self.add(kit.blob(f"Sigil{nm}{k}", c + Vector((0, q * 0.012, 0.004)), (0.026 * big, 0.007, 0.036 * big), sigil, segs=(14, 8)), "pelvis")
                self.add(chain(f"TabletCord{nm}{k}", [c + Vector((0, 0, 0.06 * big)), Vector((dx, y * 0.83, 0.7))], [0.005, 0.005], gold, seg=5), "pelvis")
        self.add(kit.box("Buckle", (0, -0.17, 0.715), (0.05, 0.012, 0.04), gold, bevel=0.005, segments=1), "pelvis")
        # small gold-edged pauldrons, thin and layered, one lame over a gold plate
        for s, x in SIDES:
            def plate_w(p, arm=f"upper_arm.{s}"):
                return {"chest": 0.3, arm: 0.7}
            for k, (c, rad, tilt) in enumerate((((0.215, 0.0, 1.07), (0.085, 0.1, 0.022), 0.45), ((0.255, 0.0, 1.0), (0.07, 0.085, 0.02), 0.8))):
                cen = Vector((c[0] * x, c[1], c[2]))
                rot = Euler((0, tilt * x, 0))
                self.add(kit.blob(f"PlateGold{s}{k}", cen - Vector((0.002 * x, 0, 0.006)), (rad[0] + 0.01, rad[1] + 0.01, rad[2]), gold, segs=(24, 10), rotation=rot), plate_w)
                self.add(kit.blob(f"Plate{s}{k}", cen, rad, armor, segs=(24, 10), rotation=rot), plate_w)
        # sleeves, gauntlet-like dark gloves, vambraces with gold edges
        self.arms(cloth, cloth, glove, r=(0.056, 0.05, 0.042), cuff=gold, hand=(0.04, 0.045, 0.062))
        for s, x in SIDES:
            sh, el, wr = self.shoulder_pts(x)
            f = (wr - el).normalized()
            g0, g1 = el.lerp(wr, 0.3), el.lerp(wr, 0.92)
            self.add(tube(f"Vambrace{s}", g0, g1, [(0, 0.056, 0.056), (1, 0.046, 0.046)], greave, seg=14, cap=(False, False)), f"forearm.{s}")
            self.add(band(f"VambraceRim{s}", g0, 0.057, 0.006, gold, seg=(20, 6), axis=f), f"forearm.{s}")
        # signature: the silver horn on a gold chain across the chest, its flared bell to his left
        path = kit.spline([Vector((-0.1, -0.2, 0.84)), Vector((-0.04, -0.222, 0.86)), Vector((0.04, -0.228, 0.9)), Vector((0.11, -0.222, 0.97)), Vector((0.17, -0.2, 1.03))], 12)
        radii = [(0.014 + 0.07 * (i / 11) ** 2.4, 0.014 + 0.07 * (i / 11) ** 2.4) for i in range(12)]
        self.add(kit.chain("Horn", path, radii, silver, seg=12), "chest")
        self.add(band("HornBand", path[3], 0.02, 0.006, gold, seg=(16, 6), axis=path[4] - path[2]), "chest")
        self.add(band("HornBand2", path[7], 0.033, 0.006, gold, seg=(16, 6), axis=path[8] - path[6]), "chest")
        for s, x in SIDES:
            pts = kit.spline([path[1 if x < 0 else 9], Vector((0.1 * x, -0.19, 1.02)), Vector((0.09 * x, -0.1, 1.12)), Vector((0.08 * x, 0.0, 1.14))], 10)
            self.add(kit.chain(f"HornChain{s}", pts, [0.0055] * len(pts), gold, seg=5), ["chest"])
        # head: big and square-jawed but calm, level brows, a small closed mouth, a black helm with a gold band and a red crest
        hc = Vector((0, -0.025, 1.28))
        r = (0.155, 0.15, 0.158)
        self.head_shape(hc, r, skin, chin=0.85)
        for s, x in SIDES:
            self.add(blob(f"Ear{s}", hc + Vector((0.154 * x, 0.005, -0.005)), (0.016, 0.028, 0.038), skin, (10, 8)), "head")
        self.add(blob("Nose", hc + Vector((0, -0.153, -0.024)), (0.017, 0.019, 0.02), skin, (12, 10)), "head")
        self.eyes(hc, r, eyew, iris, eyew, spread=0.062, size=(0.031, 0.034), z=0.012)
        for s, x in SIDES:
            brow = [hc + Vector((0.016 * x, -0.15, 0.065)), hc + Vector((0.058 * x, -0.145, 0.078)), hc + Vector((0.104 * x, -0.12, 0.074)), hc + Vector((0.13 * x, -0.09, 0.066))]
            self.add(chain(f"Brow{s}", brow, [0.006, 0.01, 0.008, 0.003], dark, seg=8), "head")
        self.grin(hc, r, -0.6, 0.032, 0.0, 0.0065, self.mat("lips", "#8a4a40", roughness=0.5, double_sided=True))
        self.add(blob("HelmCap", hc + Vector((0, 0.025, 0.05)), (0.168, 0.162, 0.15), helm, (22, 14)), "head")
        self.add(blob("HelmBack", hc + Vector((0, 0.075, -0.05)), (0.15, 0.1, 0.11), helm, (16, 10)), "head")
        self.add(band("HelmBand", hc + Vector((0, 0.01, 0.075)), 0.16, 0.012, gold, seg=(36, 6)), "head")
        ridge = kit.spline([hc + Vector((0, -0.12, 0.14)), hc + Vector((0, -0.07, 0.235)), hc + Vector((0, 0.03, 0.26)), hc + Vector((0, 0.12, 0.22)), hc + Vector((0, 0.17, 0.1))], 14)
        self.add(kit.chain("Crest", ridge, [(0.013, 0.02 + 0.03 * math.sin(math.pi * i / 13)) for i in range(14)], crest, seg=10, side=(1, 0, 0)), "head")
        self.joints_fill(neck=(skin, 0.075), shoulder=(cloth, 0.06), elbow=(cloth, 0.052), wrist=(glove, 0.042), knee=(legs, 0.07))


# ============================================================================================ Madame Cleaver
class ChefMythic(MobaFigure):
    """
    Madame Cleaver, the Feastmistress (support): a war cook, big and proud, chin up. A crimson leather jerkin over a mail
    shirt with a mail collar and sleeves, a long dark leather apron front and back with a gold border, a wide belt and a
    bandolier of small knives, dark leather bracers and boots, a crimson headwrap over auburn hair with a long braid.
    Signature: the great cleaver in the right hand, its edge a glowing ember, and a small iron cauldron on chains at her
    back (a hip prop would hide behind her arm).
    """

    J = dict(hip=0.92, waist=1.05, neck=1.52, head=1.58, top=1.86, shoulder=(0.285, 0.01, 1.45),
             elbow_x=0.37, elbow_z=1.2, wrist_x=0.41, wrist_z=0.95, hand=0.1, leg_x=0.13, knee=0.5)

    SCULPT = True
    FUSE = (("Face", "skin", ("only", "Head", "Nose", "Ear", "Cheek"), 0.0038, 6000, None, 9),
            ("Skin", "skin", ("Face",), 0.0065, 3000, None, 14),
            ("JerkinBody", "jerkin", (), 0.007, 4200, None, 14),
            ("MailBody", "mail", ("only", "UpperArm", "Forearm", "Joint", "MailCollar"), 0.0065, 2800, None, 10),
            ("LegsBody", "trousers", (), 0.0075, 2000, None, 12),
            ("Boots", "boot", (), 0.0075, 1600, None, 8),
            ("HairBody", "hair", (), 0.0055, 1800, None, 8))
    FOLDS = ((("Hauberk",), dict(below=1.08, n=15, amp=0.012, seed=3.0)),
             (("ApronF", "ApronB"), dict(below=1.0, n=7, amp=0.006, seed=5.0)))
    WRAP = (("Mouth", "Face", 0.002), ("Brow", "Face", 0.002))
    PAINT = {"skin": dict(warm=1.0), "jerkin": dict(shadow=(0.62, 0.4, 0.5)), "mail": dict(shadow=(0.6, 0.62, 0.8)),
             "hauberk": dict(shadow=(0.6, 0.62, 0.8)), "apron": dict(shadow=(0.7, 0.5, 0.5)), "headwrap": dict(shadow=(0.7, 0.4, 0.5))}

    def __init__(self):
        super().__init__("chef", self.J)

    def body(self):
        boot = self.mat("boot", "#2a1e1a", roughness=0.55)
        trousers = self.mat("trousers", "#2a2430", roughness=0.8)
        jerkin = self.mat("jerkin", "#7c2230", roughness=0.65)
        mail = self.mat("mail", "#5e626c", metallic=0.55, roughness=0.5)
        hauberk = self.mat("hauberk", "#585c66", metallic=0.55, roughness=0.5, double_sided=True)
        lining = self.mat("lining", "#26202a", roughness=0.8, double_sided=True)
        apron = self.mat("apron", "#34241f", roughness=0.7, double_sided=True)
        leather = self.mat("leather", "#3e2a22", roughness=0.65)
        gold = self.mat("gold", "#d2ae55", metallic=0.7, roughness=0.3, double_sided=True)
        steel = self.mat("steel", "#6e7480", metallic=0.6, roughness=0.3, double_sided=True)
        iron = self.mat("iron", "#4a4852", metallic=0.5, roughness=0.5)
        wrap = self.mat("wrap", "#7a1e28", roughness=0.7)
        ember = self.mat("ember", "#ff7a30", roughness=0.15, emission="#ff5a18", strength=2.4)
        headwrap = self.mat("headwrap", "#8a2630", roughness=0.7)
        skin = self.mat("skin", "#d6a284", roughness=0.55)
        hair = self.mat("hair", "#6a2c18", roughness=0.5)
        lash = self.mat("lash", "#2a1810", roughness=0.5)
        lid = self.mat("lid", "#d89878", roughness=0.5)
        eyew = self.mat("eyewhite", "#fff8f0", roughness=0.4)
        iris = self.mat("iris", "#2c6a48", roughness=0.25)
        J = self.J

        self.legs(trousers, boot, thigh=(0.11, 0.08), shin=0.07, boot_r=0.078, boot_top=0.3, toe=0.2, cuff=gold)
        # the body: a big bust and a proud belly under the crimson jerkin
        self.add(loft("Torso", [kit.ring_z(z, rx, ry, cy) for z, rx, ry, cy in [(1.0, 0.27, 0.215, -0.01), (1.12, 0.265, 0.205, -0.015), (1.26, 0.3, 0.23, -0.02), (1.38, 0.31, 0.225, -0.01), (1.48, 0.23, 0.165, 0.0), (1.55, 0.09, 0.085, 0.0)]], jerkin, seg=28),
                 lambda p: {"chest": figure_kit.smooth(1.02, 1.18, p.z), "pelvis": 1 - figure_kit.smooth(1.02, 1.18, p.z)})
        for s, x in SIDES:
            self.add(blob(f"Bust{s}", (0.125 * x, -0.17, 1.31), (0.135, 0.105, 0.115), jerkin, (18, 12)), "chest")
        self.add(blob("Belly", (0, -0.12, 1.12), (0.22, 0.13, 0.12), jerkin, (18, 12)), ["chest", "pelvis"])
        # the mail hauberk below it, to mid-thigh, a gold hem
        skirt = short_skirt(J["hip"], J["knee"], 0.2)
        self.bell("Hauberk", [(1.09, 0.272, 0.215), (0.98, 0.312, 0.25), (0.82, 0.345, 0.28), (0.66, 0.37, 0.305)], hauberk, lining, weights=skirt, hem=gold, n=30)
        # the long dark leather apron, front and back, to the shins, a gold border and a crimson stripe
        for side, y0, y1, nm in ((-1, -0.25, -0.31, "F"), (1, 0.255, 0.315, "B")):
            self.add(tube(f"Apron{nm}", (0, y0, 1.04), (0, y1, 0.3), [(0, 0.19, 0.012), (1, 0.215, 0.012)], apron, seg=10, side=(1, 0, 0)), skirt)
            self.add(tube(f"ApronStripe{nm}", (0, y0 + side * 0.013, 1.0), (0, y1 + side * 0.013, 0.34), [(0, 0.04, 0.007), (1, 0.045, 0.007)], jerkin, seg=8, side=(1, 0, 0)), skirt)
            self.add(chain(f"ApronHem{nm}", [Vector((-0.213, y1 + side * 0.012, 0.3)), Vector((0.213, y1 + side * 0.012, 0.3))], [0.009, 0.009], gold, seg=6), skirt)
            for s, x in SIDES:
                self.add(chain(f"ApronEdge{nm}{s}", [Vector((0.19 * x, y0 + side * 0.012, 1.04)), Vector((0.215 * x, y1 + side * 0.012, 0.3))], [0.007, 0.007], gold, seg=6), skirt)
        # a wide belt, a brass buckle, a crimson sash end
        self.add(loft("Belt", [kit.ring_z(1.03, 0.285, 0.232, -0.012), kit.ring_z(1.1, 0.284, 0.232, -0.012)], leather, seg=28), "pelvis")
        self.add(kit.box("Buckle", (0, -0.24, 1.065), (0.07, 0.014, 0.06), gold, bevel=0.006, segments=1), "pelvis")
        # a bandolier of small knives across the chest
        strap = kit.spline([Vector((0.17, -0.1, 1.52)), Vector((0.1, -0.265, 1.42)), Vector((-0.02, -0.318, 1.28)), Vector((-0.17, -0.285, 1.14)), Vector((-0.28, -0.2, 1.06))], 14)
        self.add(kit.chain("Bandolier", strap, [(0.034, 0.01)] * len(strap), leather, seg=8), "chest")
        for k, i in enumerate((4, 6, 8, 10)):
            p = strap[i]
            self.add(kit.tube(f"KnifeHilt{k}", p + Vector((0, -0.01, -0.02)), p + Vector((0, -0.012, 0.04)), [(0, 0.011, 0.011), (1, 0.011, 0.011)], iron, seg=8), "chest")
            self.add(kit.tube(f"KnifeBlade{k}", p + Vector((0, -0.012, 0.04)), p + Vector((0, -0.014, 0.115)), [(0, 0.013, 0.004), (1, 0.001, 0.001)], steel, seg=8, side=(1, 0, 0)), "chest")
        # mail sleeves, dark leather bracers with gold rims, gauntlets
        self.arms(mail, mail, leather, r=(0.092, 0.082, 0.074), hand=(0.05, 0.055, 0.075))
        for s, x in SIDES:
            sh, el, wr = self.shoulder_pts(x)
            f = (wr - el).normalized()
            g0, g1 = el.lerp(wr, 0.42), el.lerp(wr, 0.97)
            self.add(tube(f"Bracer{s}", g0, g1, [(0, 0.084, 0.084), (1, 0.076, 0.076)], leather, seg=16, cap=(False, False)), f"forearm.{s}")
            for k, p in enumerate((g0, g1)):
                self.add(band(f"BracerRim{s}{k}", p, 0.085 - 0.008 * k, 0.008, gold, seg=(24, 6), axis=f), f"forearm.{s}")
            self.fist(x, leather, 0.92)
        # a mail collar over the shoulders; no bulky plates
        self.add(loft("MailCollar", [kit.ring_z(z, rx, ry, cy) for z, rx, ry, cy in [(1.6, 0.12, 0.11, 0.0), (1.55, 0.24, 0.19, 0.0), (1.47, 0.31, 0.23, 0.0), (1.41, 0.335, 0.245, 0.0)]], mail, seg=32, cap=(False, False)),
             lambda p: {"chest": 1 - 0.4 * figure_kit.smooth(0.2, 0.34, abs(p.x)), f"upper_arm.{'L' if p.x > 0 else 'R'}": 0.4 * figure_kit.smooth(0.2, 0.34, abs(p.x))})


        # head, tipped back a little, chin up
        first = len(self.parts)
        hc = Vector((0, -0.02, 1.7))
        r = (0.138, 0.135, 0.152)
        self.head_shape(hc, r, skin, chin=0.72)
        for s, x in SIDES:
            self.add(blob(f"Ear{s}", hc + Vector((0.136 * x, 0.005, -0.01)), (0.016, 0.028, 0.038), skin, (10, 8)), "head")
        self.add(blob("Nose", hc + Vector((0, -0.142, -0.03)), (0.019, 0.022, 0.02), skin, (12, 10)), "head")
        spread = 0.06
        self.eyes(hc, r, eyew, iris, eyew, spread=spread, size=(0.031, 0.034), z=0.02)
        for s, x in SIDES:
            ey = hc.y - r[1] * math.sqrt(1 - (spread / r[0]) ** 2) + 0.012
            c = Vector((spread * x, ey, hc.z + 0.02))
            self.add(kit.blob(f"Lid{s}", c + Vector((0, -0.003, 0.018)), (0.035, 0.02, 0.02), lid, segs=(14, 8)), "head")
            arc = [c + Vector((d_ * x, -0.022 + 3 * d_ * d_, 0.006)) for d_ in (-0.034, 0.0, 0.034)] + [c + Vector((0.054 * x, -0.0, 0.018))]
            self.add(kit.chain(f"Lash{s}", arc, [0.004, 0.0065, 0.0065, 0.002], lash, seg=6), "head")
            brow = [hc + Vector((0.026 * x, -0.13, 0.078)), hc + Vector((0.066 * x, -0.122, 0.094)), hc + Vector((0.114 * x, -0.082, 0.07))]
            self.add(chain(f"Brow{s}", brow, [0.007, 0.011, 0.004], hair, seg=8), "head")
        self.grin(hc, r, -0.58, 0.032, 0.006, 0.009, self.mat("lips", "#a8283a", roughness=0.35, double_sided=True))
        # auburn hair under the headwrap, a long braid over her left shoulder
        self.add(blob("HairBack", hc + Vector((0, 0.05, -0.0)), (0.138, 0.105, 0.125), hair, (18, 12)), "head")
        for s, x in SIDES:
            self.add(chain(f"HairSide{s}", [hc + Vector((0.09 * x, -0.1, 0.1)), hc + Vector((0.13 * x, -0.06, 0.04)), hc + Vector((0.14 * x, -0.03, -0.03))], [0.03, 0.028, 0.012], hair, seg=8), "head")
        braid = [hc + Vector(v) for v in [(0.07, 0.11, -0.04), (0.13, 0.1, -0.12), (0.2, 0.06, -0.22), (0.22, 0.0, -0.33), (0.2, -0.02, -0.43)]]
        self.add(chain("HairBraid", braid, [(0.04, 0.035), (0.042, 0.038), (0.04, 0.036), (0.036, 0.034), (0.012, 0.012)], hair, seg=10), "head")
        # the crimson headwrap: a wrapped band round the brow, a soft cap, a knot at the side
        hz = hc.z + 0.07
        self.add(torus("HeadWrapBand", hc + Vector((0, 0.006, 0.075)), 0.148, 0.026, headwrap, seg=(40, 8), axis=(0, 0.05, 1)), "head")
        self.add(blob("HeadWrapCap", hc + Vector((0, 0.025, 0.1)), (0.145, 0.14, 0.085), headwrap, (22, 12)), "head")
        self.add(blob("HeadWrapKnot", hc + Vector((0.12, 0.08, 0.095)), (0.04, 0.035, 0.04), headwrap, (12, 8)), "head")
        self.add(band("HeadWrapGold", hc + Vector((0, 0.006, 0.058)), 0.153, 0.007, gold, seg=(36, 6), axis=(0, 0.05, 1)), "head")
        tilt = Matrix.Translation((0, 0, J["head"])) @ Matrix.Rotation(math.radians(-8), 4, "X") @ Matrix.Translation((0, 0, -J["head"]))
        for ob, _ in self.parts[first:]:
            kit.transform(ob, tilt)

        # signature: the great cleaver in the right hand, a dark blade, its edge a glowing ember
        h = self.hand_grip(-1)
        d = Vector((-0.34, -0.06, 0.94)).normalized()
        self.add(tube("CleaverHandle", h - d * 0.14, h + d * 0.22, [(0, 0.032, 0.026), (1, 0.026, 0.022)], wrap, seg=10), "hand.R")
        for k, t in enumerate((-0.09, 0.14)):
            self.add(kit.blob(f"CleaverRivet{k}", h + d * t + Vector((0, -0.028, 0)), (0.01, 0.006, 0.01), gold, segs=(8, 6)), "hand.R")
        self.add(band("CleaverGuard", h + d * 0.2, 0.034, 0.008, gold, seg=(16, 6), axis=d), "hand.R")
        c = h + d * 0.22
        M = Matrix.Translation(c) @ Matrix.Rotation(math.atan2(d.x, d.z), 4, "Y")
        W, H = 0.44, 0.62
        plate = [(0.05, 0.0), (0.05, H - 0.03), (0.02, H), (-W + 0.03, H), (-W, H - 0.04), (-W, 0.02), (-W + 0.03, -0.015), (-0.05, -0.015)]
        ob = kit.extrude_shape("CleaverBlade", plate, 0.024, steel, bevel=0.004, centre=(0, 0, 0))
        kit.transform(ob, M)
        self.add(ob, "hand.R")
        e = kit.chain("CleaverEdge", [Vector((-W + 0.012, 0, z)) for z in (0.0, 0.15, 0.3, 0.45, H - 0.03)], [(0.03, 0.022)] * 5, ember, seg=8, side=(1, 0, 0))
        kit.transform(e, M)
        self.add(e, "hand.R")
        back = kit.chain("CleaverSpine", [Vector((0.046, 0, z)) for z in (0.0, 0.3, H - 0.04)], [(0.012, 0.018)] * 3, gold, seg=6, side=(1, 0, 0))
        kit.transform(back, M)
        self.add(back, "hand.R")
        hole = kit.torus("CleaverHole", M @ Vector((-0.04, 0, H - 0.07)), 0.03, 0.009, seg=(16, 6), mat=gold, axis=(0, 1, 0))
        self.add(hole, "hand.R")
        # a small iron cauldron on chains at her back, below the shoulder blades, so it shows from behind
        cc = Vector((0.0, 0.42, 0.96))
        self.add(blob("Cauldron", cc, (0.18, 0.16, 0.14), iron, (18, 12)), "pelvis")
        self.add(band("CauldronRim", cc + Vector((0, 0, 0.1)), 0.14, 0.012, gold, seg=(28, 6)), "pelvis")
        for k, (dx, dz) in enumerate(((-0.07, -0.105), (0.07, -0.105), (0.0, -0.11))):
            self.add(kit.tube(f"CauldronLeg{k}", cc + Vector((dx, 0.0 if k < 2 else 0.05, dz)), cc + Vector((dx, 0.0 if k < 2 else 0.05, dz - 0.04)), [(0, 0.014, 0.01), (1, 0.011, 0.008)], iron, seg=6), "pelvis")
        for k, dx in enumerate((-1, 1)):
            pts = kit.spline([cc + Vector((0.1 * dx, 0.0, 0.07)), Vector((0.16 * dx, 0.3, 1.14)), Vector((0.14 * dx, 0.22, 1.1))], 8)
            self.add(kit.chain(f"CauldronChain{k}", pts, [0.008] * len(pts), gold, seg=5), "pelvis")
        self.joints_fill(neck=(skin, 0.075), shoulder=(mail, 0.088), elbow=(mail, 0.082), wrist=(leather, 0.06), hip=(trousers, 0.11), knee=(trousers, 0.08))


# ============================================================================================ Gus
class JanitorMythic(Janitor):
    """
    Gus, the Temple Keeper (controller): stocky, old and calm. Long grey-blue robes to the floor crossed over the chest with
    a pale collar, a dark sash with a bronze cord, sleeves tied up with cords above the elbow, bare wrapped forearms,
    heavy boots, a short grey beard, heavy-lidded peaceful eyes and a broad lacquered hat tied under the chin. Signature: a
    ritual sweeping staff in the right hand, taller than he is, with a head of straw and white paper streamers, and a
    bronze water urn hanging from it on a chain, the water in it glowing aqua.
    """

    SCULPT = True
    FUSE = (("Face", "skin", ("only", "Head", "Nose", "Ear", "Cheek"), 0.0042, 6000, None, 8),
            ("Skin", "skin", ("Face",), 0.006, 1500, None, 10),
            ("RobeBody", "robe", (), 0.0075, 6000, None, 14),
            ("Boots", "boot", (), 0.008, 2000, None, 10),
            ("BeardBody", "beard", (), 0.005, 1500, None, 8),
            ("StrawBody", "straw", (), 0.0065, 2600, None, 4))
    FOLDS = ((("RobeSkirt",), dict(below=0.9, n=13, amp=0.014, seed=6.0)),)
    WRAP = ()
    PAINT = {"skin": dict(warm=0.9), "robe": dict(shadow=(0.55, 0.62, 0.85)), "robeskirt": dict(shadow=(0.55, 0.62, 0.85)),
             "straw": dict(shadow=(0.7, 0.6, 0.45))}

    def body(self):
        boot = self.mat("boot", "#2a2220", roughness=0.7)
        robe = self.mat("robe", "#44546c", roughness=0.75)
        skirt_m = self.mat("robeskirt", "#3e4d66", roughness=0.75)
        lining = self.mat("lining", "#252e40", roughness=0.8, double_sided=True)
        collar = self.mat("collar", "#7a8aa4", roughness=0.7)
        sash = self.mat("sash", "#242a3a", roughness=0.7)
        overrobe = self.mat("overrobe", "#2c3448", roughness=0.75, double_sided=True)
        bronze = self.mat("bronze", "#a07040", metallic=0.65, roughness=0.35, double_sided=True)
        wrapcloth = self.mat("wrapcloth", "#9a9484", roughness=0.85)
        skin = self.mat("skin", "#d0a080", roughness=0.6)
        beard = self.mat("beard", "#a8a4a0", roughness=0.8)
        brow = self.mat("brow", "#8a8680", roughness=0.8)
        hat = self.mat("hat", "#37323f", roughness=0.6)
        wood = self.mat("mophaft", "#5a4030", roughness=0.65)
        straw = self.mat("straw", "#b8a070", roughness=1.0)
        paper = self.mat("paper", "#c4bcaa", roughness=0.8, double_sided=True)
        water = self.mat("water", "#4ab8ff", roughness=0.1, emission="#2aa8ff", strength=2.6)
        eyew = self.mat("eyewhite", "#f6f0e6", roughness=0.4)
        iris = self.mat("iris", "#30343c", roughness=0.25)
        J = self.J

        # heavy boots under the long robe
        self.legs(robe, boot, thigh=(0.112, 0.098), shin=0.092, boot_r=0.095, boot_top=0.2, toe=0.22)
        # the body: a thick sloping torso in grey-blue, the robe's skirt to the floor with a bronze hem
        self.add(loft("Torso", [kit.ring_z(z, rx, ry, cy) for z, rx, ry, cy in [(0.94, 0.265, 0.225, -0.015), (1.08, 0.275, 0.235, -0.02), (1.2, 0.285, 0.215, -0.01), (1.3, 0.265, 0.19, 0.0), (1.38, 0.17, 0.13, 0.0), (1.44, 0.08, 0.075, 0.0)]], robe, seg=26), ["chest", "pelvis"])
        skirt = short_skirt(J["hip"], J["knee"], 0.16)
        self.bell("RobeSkirt", [(1.0, 0.27, 0.235), (0.85, 0.31, 0.26), (0.58, 0.37, 0.3), (0.3, 0.42, 0.34), (0.1, 0.45, 0.36)], skirt_m, lining, hem=bronze, n=30, weights=skirt)
        # the robe crossed over the chest, a pale collar, a dark sash with a bronze cord and a tied bow behind
        for s, x in SIDES:
            top, bot = Vector((0.1 * x, -0.12, 1.4)), Vector((-0.04 * x, -0.248, 1.0))
            self.add(tube(f"Lapel{s}", top, bot, [(0, 0.04, 0.012), (0.5, 0.048, 0.012), (1, 0.03, 0.012)], collar, seg=8, side=(1, 0, 0)), "chest")
        self.add(loft("Sash", [kit.ring_z(0.98, 0.285, 0.248, -0.016), kit.ring_z(1.08, 0.29, 0.252, -0.018)], sash, seg=28), "pelvis")
        self.add(band("SashCord", (0, -0.016, 1.04), 0.292, 0.012, bronze, seg=(32, 6)), "pelvis")
        self.add(blob("SashKnot", (0, 0.25, 1.04), (0.06, 0.04, 0.05), sash, (12, 8)), "pelvis")
        for s, x in SIDES:
            self.add(chain(f"SashTail{s}", [Vector((0.04 * x, 0.27, 1.02)), Vector((0.1 * x, 0.3, 0.8)), Vector((0.12 * x, 0.32, 0.55))], [(0.034, 0.008), (0.04, 0.008), (0.036, 0.008)], sash, seg=8), skirt)
        # a ritual stole: two narrow dark bands from the shoulders to the shins, front and back, edged in bronze
        for nm, y0, y1 in (("F", -0.2, -0.3), ("B", 0.215, 0.32)):
            for s, x in SIDES:
                self.add(tube(f"Over{nm}{s}", Vector((0.14 * x, y0, 1.42)), Vector((0.17 * x, y1, 0.22)), [(0, 0.045, 0.012), (0.5, 0.05, 0.012), (1, 0.055, 0.012)], overrobe, seg=10, side=(1, 0, 0)), skirt)
                self.add(chain(f"OverEdge{nm}{s}", [Vector((0.095 * x, y0 + 0.0, 1.42)), Vector((0.115 * x, y1 * 0.98, 0.22))], [0.007, 0.007], bronze, seg=6), skirt)
        # sleeves tied up: the upper arm in robe cloth, a cord and a bunch of cloth above the elbow, bare wrapped forearms
        for s, x in SIDES:
            sh, el, wr = self.shoulder_pts(x)
            bones = [f"upper_arm.{s}", f"forearm.{s}"]
            self.add(tube(f"UpperArm{s}", sh, el, [(0, 0.094, 0.094), (1, 0.082, 0.082)], robe, seg=12), bones)
            self.add(band(f"SleeveCord{s}", sh.lerp(el, 0.92), 0.088, 0.011, bronze, seg=(24, 6), axis=el - sh), bones)
            self.add(tube(f"Forearm{s}", el, wr + (wr - el) * 0.02, [(0, 0.082, 0.082), (0.6, 0.074, 0.074), (1, 0.066, 0.066)], skin, seg=14), f"forearm.{s}")
            self.add(tube(f"ForeWrap{s}", el.lerp(wr, 0.35), wr, [(0, 0.078, 0.078), (1, 0.07, 0.07)], wrapcloth, seg=14, cap=(False, False)), f"forearm.{s}")
            self.fist(x, skin, 0.86)
        # head: calm and heavy-lidded, a short grey beard, a small closed mouth, a broad lacquered hat tied under the chin
        hc = Vector((0, -0.03, 1.565))
        r = (0.138, 0.135, 0.148)
        self.head_shape(hc, r, skin, chin=0.82)
        for s, x in SIDES:
            self.add(blob(f"Ear{s}", hc + Vector((0.138 * x, 0.005, -0.012)), (0.018, 0.03, 0.04), skin, (10, 8)), "head")
            self.add(blob(f"Cheek{s}", hc + Vector((0.082 * x, -0.104, -0.06)), (0.04, 0.024, 0.034), skin, (12, 8)), "head")
        self.add(blob("Nose", hc + Vector((0, -0.145, -0.036)), (0.022, 0.026, 0.026), skin, (14, 10)), "head")
        spread = 0.06
        self.eyes(hc, r, eyew, iris, eyew, spread=spread, size=(0.03, 0.032), z=0.006)
        for s, x in SIDES:
            ey = hc.y - r[1] * math.sqrt(1 - (spread / r[0]) ** 2) + 0.012
            c = Vector((spread * x, ey, hc.z + 0.006))
            self.add(kit.blob(f"Lid{s}", c + Vector((0, -0.006, 0.012)), (0.036, 0.024, 0.026), skin, segs=(14, 8)), "head")
            self.add(chain(f"Brow{s}", [hc + Vector((0.022 * x, -0.13, 0.068)), hc + Vector((0.064 * x, -0.124, 0.074)), hc + Vector((0.112 * x, -0.09, 0.052))], [0.01, 0.014, 0.006], brow, seg=8), "head")
        self.add(tube("Mouth", hc + Vector((-0.03, -0.136, -0.104)), hc + Vector((0.03, -0.136, -0.104)), [(0, 0.004, 0.004), (0.5, 0.006, 0.006), (1, 0.004, 0.004)], self.mat("lips", "#8a4a40", roughness=0.5), seg=8), "head")
        # a short grey beard, shaped like a spade round the chin, and a thin moustache
        self.add(chain("BeardChin", [hc + Vector(v) for v in [(-0.1, -0.06, -0.09), (-0.07, -0.115, -0.15), (0.0, -0.135, -0.19), (0.07, -0.115, -0.15), (0.1, -0.06, -0.09)]], [0.026, 0.04, 0.05, 0.04, 0.026], beard, seg=10), "head")
        self.add(blob("BeardTip", hc + Vector((0, -0.11, -0.215)), (0.05, 0.04, 0.05), beard, (12, 8)), "head")
        for s, x in SIDES:
            self.add(chain(f"Tache{s}", [hc + Vector((0.004 * x, -0.14, -0.082)), hc + Vector((0.035 * x, -0.133, -0.09)), hc + Vector((0.065 * x, -0.108, -0.1))], [0.007, 0.008, 0.002], beard, seg=8), "head")
        # the broad hat: a low lacquered dome, a wide flat brim with a bronze rim, a boss on top, cords under the chin
        hz = hc.z + 0.115
        cy = hc.y + 0.012
        self.add(loft("HatDome", [kit.ring_z(hz + 0.085, 0.02, 0.02, cy), kit.ring_z(hz + 0.07, 0.085, 0.085, cy), kit.ring_z(hz + 0.035, 0.145, 0.145, cy), kit.ring_z(hz - 0.01, 0.17, 0.17, cy)], hat, seg=28), "head")
        self.add(loft("HatBrim", [kit.ring_z(hz - 0.005, 0.17, 0.17, cy), kit.ring_z(hz - 0.03, 0.235, 0.235, cy), kit.ring_z(hz - 0.04, 0.25, 0.25, cy), kit.ring_z(hz - 0.05, 0.245, 0.245, cy)], hat, seg=36), "head")
        self.add(band("HatRim", (0, cy, hz - 0.045), 0.248, 0.008, bronze, seg=(40, 6)), "head")
        self.add(kit.blob("HatBoss", (0, cy, hz + 0.095), (0.026, 0.026, 0.02), bronze, segs=(12, 8)), "head")
        for s, x in SIDES:
            self.add(kit.chain(f"HatCord{s}", kit.spline([Vector((0.15 * x, cy - 0.05, hz - 0.045)), Vector((0.13 * x, -0.1, hc.z - 0.08)), Vector((0.06 * x, -0.14, hc.z - 0.17)), Vector((0.0, -0.15, hc.z - 0.19))], 10), [0.005] * 10, bronze, seg=5), "head")

        # signature: the ritual sweeping staff in the right hand, a straw head with white paper streamers
        h = self.hand_grip(-1)
        d = Vector((-0.2, -0.04, 0.98)).normalized()
        a, b = h - d * 0.68, h + d * 1.13
        self.add(tube("MopHaft", a, b, [(0, 0.024, 0.024), (1, 0.026, 0.026)], wood, seg=10), "hand.R")
        for k, t in enumerate((0.3, 0.6, 0.86)):
            self.add(band(f"HaftBand{k}", a.lerp(b, t), 0.03, 0.007, bronze, seg=(16, 6), axis=d), "hand.R")
        self.add(tube("StrawClamp", b - d * 0.02, b + d * 0.07, [(0, 0.04, 0.04), (0.5, 0.05, 0.05), (1, 0.04, 0.04)], bronze, seg=12), "hand.R")
        for k in range(17):
            t = (k - 8) / 8
            row = k % 3 - 1
            base = b + d * 0.06 + Vector((0.07 * t, 0.03 * row, 0))
            spr = Vector((0.15 * t, 0.07 * row, 0))
            ln = 0.34 + 0.06 * ((k * 5) % 3)
            pts = [base, base + spr * 0.5 + Vector((0, 0, 0.0)), base + spr * 0.95 + Vector((0, 0, -ln * 0.5)), base + spr * 1.1 + Vector((0, 0, -ln))]
            self.add(kit.chain(f"MopStrand{k}", pts, [0.03, 0.034, 0.03, 0.018], straw, seg=8), "hand.R")
        # zigzag paper streamers (shide) tied under the straw head
        for k, dx in enumerate((-0.07, 0.0, 0.07)):
            y0 = b.y + (-0.06 + 0.06 * k)
            zig = [Vector((b.x + dx + (0.03 if i % 2 else -0.03) * (i > 0), y0, b.z - 0.04 - 0.07 * i)) for i in range(6)]
            self.add(kit.ribbon(f"Streamer{k}", zig, 0.045, paper, normal=(0, -1, 0)), "hand.R")
        # the bronze water urn on a chain from a hook near the staff head, the water in it glowing aqua
        hook = a.lerp(b, 0.9) + Vector((0.0, 0.0, 0.0))
        uc = hook + Vector((-0.2, 0.0, -0.42))
        self.add(kit.chain("UrnHook", [hook, hook + Vector((-0.07, 0, 0.03)), hook + Vector((-0.15, 0, 0.02)), hook + Vector((-0.2, 0, -0.04))], [0.011] * 4, bronze, seg=6), "hand.R")
        self.add(kit.chain("UrnChain", kit.spline([hook + Vector((-0.2, 0, -0.04)), uc + Vector((0.0, 0, 0.12)), uc + Vector((0.0, 0, 0.0)) + Vector((0, 0, 0.08))], 6), [0.008] * 6, bronze, seg=5), "hand.R")
        self.add(lathe("UrnBody", [(0.0, 0.0), (0.065, 0.0), (0.13, 0.045), (0.16, 0.13), (0.15, 0.195), (0.13, 0.24), (0.145, 0.26), (0.0, 0.26)], bronze, centre=uc - Vector((0, 0, 0.11)), seg=24), "hand.R")
        self.add(band("UrnRim", uc + Vector((0, 0, 0.15)), 0.142, 0.012, bronze, seg=(32, 6)), "hand.R")
        self.add(band("UrnBelt", uc + Vector((0, 0, 0.0)), 0.158, 0.009, bronze, seg=(32, 6)), "hand.R")
        self.add(kit.blob("UrnWater", uc + Vector((0, 0, 0.145)), (0.125, 0.125, 0.014), water, segs=(24, 8)), "hand.R")
        self.joints_fill(neck=(skin, 0.075), shoulder=(robe, 0.094), hip=(robe, 0.112), knee=(robe, 0.098))


def register(FIGURES):
    FIGURES["ledger_v3"] = LedgerMythic
    FIGURES["mime_v3"] = MimeMythic
    FIGURES["referee_v3"] = RefereeMythic
    FIGURES["chef_v3"] = ChefMythic
    FIGURES["janitor_v3"] = JanitorMythic
