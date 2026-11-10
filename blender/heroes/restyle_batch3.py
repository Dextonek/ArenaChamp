"""Restyle batch 3 (pipeline/designs/heroes-restyle.md): Mabel, Grandma Ironknit, Bo, The Great Zambini, Wick, Pim and Pom. Loaded by moba_figures._restyle_batches()."""
from moba_figures import *  # noqa: F401,F403  (MobaFigure, the helpers, kit, figure_kit, math, Vector, Euler, the old classes)


# ============================================================================================ Mabel
class MoleMythic(Mole):
    """
    Mabel, the Deepdelver (assassin): a mole-folk miner in dark velvet fur, built like the old Mabel (stout, no neck, long
    muzzle) but armoured: a studded dark leather cuirass and skirt with a gold-buckled belt, leather straps over the shoulders,
    gold-banded bracers, dark leather boots, a close bronze helm with a gold ridge and small brass goggles pushed up on its
    brow. Calm small black eyes, a smaller dusky-rose nose, a closed mouth. Signature: huge spade paws with five long pale
    claws each, every one tipped in gold, and a glowing amber crystal lantern in a gold cage on top of the helm; a pick
    slung across her back.
    """

    PAINT = {"fur": dict(shadow=(0.72, 0.62, 0.8)), "leather": dict(shadow=(0.7, 0.55, 0.45)), "helm": dict(shadow=(0.7, 0.6, 0.55))}
    FUSE = (("Face", "fur", ("only", "Head", "Muzzle", "Ear", "Cheek"), 0.004, 7500, None, 8),
            ("ArmsBody", "fur", ("only", "Arm", "Paw"), 0.0065, 4200, None, 12),
            ("FurBody", "fur", ("Face", "ArmsBody"), 0.0075, 6000, None, 14),
            ("FeetBody", "boot", ("only", "Foot"), 0.006, 1400, None, 8))

    def body(self):
        fur = self.mat("fur", "#5a4842", roughness=0.95)
        boot = self.mat("boot", "#2a1c14", roughness=0.55)
        leather = self.mat("leather", "#7a5030", roughness=0.7, double_sided=True)
        leather2 = self.mat("leatherdark", "#3a2416", roughness=0.75, double_sided=True)
        gold = self.mat("gold", "#d2ae55", metallic=0.7, roughness=0.3, double_sided=True)
        helm = self.mat("helm", "#3c2e28", metallic=0.5, roughness=0.35)
        bone = self.mat("claw", "#d8cfae", roughness=0.4)
        nose = self.mat("nose", "#a85a6a", roughness=0.35)
        glass = self.mat("goggle", "#b8742a", roughness=0.1)
        crystal = self.mat("crystal", "#ffb040", roughness=0.1, emission="#ff9a20", strength=2.6)
        eye = self.mat("eye", "#100c0c", roughness=0.2)
        white = self.mat("glint", "#ffffff", roughness=0.2)
        mouth = self.mat("mouth", "#2a1414", roughness=0.5)
        wood = self.mat("haft", "#3a2616", roughness=0.6)
        steel = self.mat("steel", "#8c97a2", metallic=0.7, roughness=0.3)
        J = self.J
        lx = J["leg_x"]

        # short thick legs, dark leather boots with a gold-banded greave, pale toe claws
        for s, x in SIDES:
            X = lx * x
            self.add(tube(f"Thigh{s}", (X, 0, 0.62), (X, 0, 0.28), [(0, 0.12, 0.12), (1, 0.09, 0.09)], fur, seg=14), [f"thigh.{s}", f"shin.{s}", "pelvis"])
            self.add(tube(f"Shin{s}", (X, 0, 0.3), (X, 0, 0.07), [(0, 0.09, 0.09), (1, 0.08, 0.08)], fur, seg=14), [f"shin.{s}", f"thigh.{s}"])
            self.add(tube(f"Greave{s}", (X, 0, 0.24), (X, 0, 0.09), [(0, 0.096, 0.096), (1, 0.088, 0.088)], leather, seg=14, cap=(False, False)), f"shin.{s}")
            self.add(band(f"GreaveRim{s}", (X, 0, 0.24), 0.097, 0.008, gold, seg=(24, 6)), f"shin.{s}")
            self.add(blob(f"Foot{s}", (X, -0.09, 0.05), (0.105, 0.19, 0.05), boot, (18, 12)), f"foot.{s}")
            for k in range(4):
                base = Vector((X + (-0.06 + 0.04 * k) * x, -0.255, 0.04))
                self.add(kit.tube(f"ToeClaw{s}{k}", base, base + Vector((0.006 * (k - 1.5) * x, -0.1, -0.022)), [(0, 0.018, 0.015), (1, 0.003, 0.003)], bone, seg=8), f"foot.{s}")
        # a stout pear in fur, a short dark tail for the camera behind her
        rings = [(0.56, 0.27, 0.235, 0.0), (0.68, 0.335, 0.295, -0.015), (0.82, 0.345, 0.3, -0.02), (0.94, 0.3, 0.25, -0.008), (1.04, 0.2, 0.17, 0.0), (1.12, 0.12, 0.105, -0.01)]
        trunk = lambda p: {"chest": figure_kit.smooth(0.68, 0.9, p.z), "pelvis": 1 - figure_kit.smooth(0.68, 0.9, p.z)}
        self.add(loft("Body", [kit.ring_z(z, rx, ry, cy) for z, rx, ry, cy in rings], fur, seg=28), trunk)
        self.add(kit.chain("Tail", [(0, 0.22, 0.68), (0, 0.31, 0.71), (0, 0.36, 0.76)], [0.05, 0.04, 0.016], fur, seg=10), "pelvis")
        # the armour: a leather cuirass (bib) and skirt over the fur, gold at the hem, studs down the front, a gold-buckled belt
        skirt = short_skirt(J["hip"], J["knee"], 0.2)
        front = -math.pi / 2

        def apron_w(p):
            return skirt(p) if p.z < 0.7 else trunk(p)
        bib = [(0.96, 0.31, 0.262, -0.008), (0.86, 0.352, 0.31, -0.018), (0.74, 0.35, 0.312, -0.018)]
        self.add(arc_shell("Cuirass", bib, front - 0.6, front + 0.6, leather, thick=0.012, seg=20), apron_w)
        low = [(0.75, 0.352, 0.312, -0.018), (0.62, 0.352, 0.31, -0.012), (0.48, 0.355, 0.315, -0.01), (0.36, 0.36, 0.318, -0.01)]
        self.add(arc_shell("Tasset", low, front - 1.15, front + 1.15, leather, thick=0.012, seg=32), apron_w)
        self.add(arc_shell("TassetHem", [(0.385, 0.362, 0.32, -0.01), (0.345, 0.365, 0.323, -0.01)], front - 1.17, front + 1.17, gold, thick=0.012, seg=32), apron_w)
        self.add(loft("Belt", [kit.ring_z(0.72, 0.353, 0.314, -0.018), kit.ring_z(0.77, 0.356, 0.316, -0.019)], leather2, seg=28), "pelvis")
        self.add(kit.box("BeltBuckle", (0, -0.338, 0.745), (0.075, 0.018, 0.062), gold, bevel=0.006, segments=1), "pelvis")
        for k in range(5):
            for s, x in SIDES:
                z = 0.9 - 0.075 * k
                self.add(kit.blob(f"Stud{s}{k}", (0.1 * x * (1 + 0.15 * k), -(0.31 + 0.002 * k) - 0.012 - 0.03 * (k > 2), z), (0.014, 0.007, 0.014), gold, segs=(8, 6)), apron_w)
        for s, x in SIDES:
            pts = [(0.16 * x, -0.255, 0.95), (0.14 * x, -0.17, 1.05), (0.13 * x, -0.01, 1.1), (0.11 * x, 0.14, 1.03), (0.0, 0.25, 0.9), (-0.14 * x, 0.285, 0.76)]
            self.add(chain(f"Strap{s}", pts, [(0.03, 0.009)] * len(pts), leather2, seg=8), ["chest", "pelvis"])
        # a collar of dark leather with a gold ring where the head meets the shoulders
        self.add(torus("Collar", (0, -0.01, 1.085), 0.135, 0.036, leather2, seg=(36, 8)), ["chest", "neck"])
        self.add(torus("CollarRing", (0, -0.01, 1.115), 0.14, 0.009, gold, seg=(36, 6)), ["chest", "neck"])
        # arms: thick and short, a gold-banded leather bracer on each forearm, then the huge spade paws
        for s, x in SIDES:
            sh, el, wr = self.shoulder_pts(x)
            self.add(blob(f"ArmShoulder{s}", sh, (0.115, 0.115, 0.11), fur, (16, 12)), f"upper_arm.{s}")
            self.add(tube(f"ArmUpper{s}", sh, el, [(0, 0.112, 0.112), (1, 0.092, 0.092)], fur, seg=14), [f"upper_arm.{s}", f"forearm.{s}"])
            self.add(blob(f"ArmElbow{s}", el, (0.092, 0.092, 0.092), fur, (14, 10)), [f"upper_arm.{s}", f"forearm.{s}"])
            self.add(tube(f"ArmFore{s}", el, wr, [(0, 0.092, 0.092), (0.5, 0.098, 0.095), (1, 0.09, 0.09)], fur, seg=14), [f"forearm.{s}", f"upper_arm.{s}"])
            f = (wr - el).normalized()
            g0, g1 = el.lerp(wr, 0.5), wr + f * 0.005
            self.add(tube(f"Bracer{s}", g0, g1, [(0, 0.104, 0.104), (1, 0.097, 0.097)], leather, seg=14, cap=(False, False)), f"forearm.{s}")
            for k, p in enumerate((g0, g1)):
                self.add(band(f"BracerRim{s}{k}", p, 0.105 - 0.007 * k, 0.008, gold, seg=(24, 6), axis=f), f"forearm.{s}")
            h = self.hand_grip(x)
            self.add(blob(f"Paw{s}", h, (0.135, 0.07, 0.125), fur, (20, 14)), f"hand.{s}")
            self.add(kit.blob(f"PawPad{s}", h + Vector((0, -0.066, -0.012)), (0.1, 0.012, 0.09), leather2, segs=(18, 10)), f"hand.{s}")
            for k in range(5):
                u = (k - 2) / 2
                base = h + Vector((0.112 * u, -0.012, -0.1 + 0.022 * abs(u)))
                pts = kit.spline([base, base + Vector((0.03 * u, -0.012, -0.1)), base + Vector((0.052 * u, -0.05, -0.2)), base + Vector((0.064 * u, -0.1, -0.27))], 8)
                rad = [(0.03, 0.022), (0.03, 0.022), (0.027, 0.02), (0.023, 0.018), (0.019, 0.015), (0.014, 0.011), (0.009, 0.007), (0.002, 0.002)]
                self.add(kit.chain(f"Claw{s}{k}", pts[:6], rad[:6], bone, seg=8), f"hand.{s}")
                self.add(kit.chain(f"ClawTip{s}{k}", pts[4:], rad[4:], gold, seg=8), f"hand.{s}")
        # the head: wide and low on the shoulders; everything points along the muzzle to the nose
        hc = Vector((0, -0.05, 1.235))
        r = (0.17, 0.158, 0.155)
        self.head_shape(hc, r, fur, chin=0.8)
        tip = hc + Vector((0, -0.34, -0.075))
        self.add(tube("Muzzle", hc + Vector((0, -0.09, -0.012)), tip, [(0, 0.128, 0.118), (0.45, 0.086, 0.074), (0.85, 0.044, 0.036), (1, 0.03, 0.025)], fur, seg=16), "head")
        for s, x in SIDES:
            self.add(blob(f"Cheek{s}", hc + Vector((0.12 * x, -0.07, -0.07)), (0.06, 0.07, 0.056), fur, (14, 10)), "head")
            self.add(blob(f"Ear{s}", hc + Vector((0.155 * x, 0.02, 0.03)), (0.024, 0.03, 0.03), fur, (10, 8)), "head")
        self.add(blob("NoseTip", tip + Vector((0, -0.015, 0.012)), (0.036, 0.032, 0.03), nose, (14, 10)), "head")
        for s, x in SIDES:
            self.add(kit.blob(f"Nostril{s}", tip + Vector((0.014 * x, -0.044, 0.006)), (0.007, 0.004, 0.005), eye, segs=(8, 4)), "head")
            for k, dz in enumerate((0.02, -0.005, -0.028)):
                a = hc + Vector((0.052 * x, -0.25, -0.062 + dz))
                self.add(kit.chain(f"Whisker{s}{k}", [a, a + Vector((0.06 * x, 0.012, dz * 0.8)), a + Vector((0.12 * x, 0.03, dz * 1.8))], [0.0045, 0.0035, 0.0012], bone, seg=5), "head")
        # a small closed mouth under the muzzle
        lip = kit.spline([hc + Vector(v) for v in [(-0.05, -0.235, -0.125), (-0.025, -0.268, -0.13), (0.0, -0.278, -0.13), (0.025, -0.268, -0.13), (0.05, -0.235, -0.125)]], 9)
        self.add(kit.chain("Mouth", lip, [0.003, 0.005, 0.006, 0.006, 0.006, 0.006, 0.006, 0.005, 0.003], mouth, seg=6), "head")
        # small calm black eyes where the muzzle meets the brow, bright glints
        for s, x in SIDES:
            c = hc + Vector((0.085 * x, -0.128, 0.07))
            self.add(blob(f"Eye{s}", c, (0.026, 0.014, 0.032), eye, (12, 8)), "head")
            self.add(kit.blob(f"EyeGlint{s}", c + Vector((0.008 * x, -0.012, 0.012)), (0.008, 0.004, 0.009), white, segs=(6, 4)), "head")
        # the helm: a close bronze dome with a narrow brim, a gold band and ridge, brass goggles pushed up on the brow
        hz = hc.z + 0.125
        cy = hc.y + 0.015
        self.add(lathe("Helmet", [(0.178, 0.0), (0.178, 0.04), (0.165, 0.09), (0.138, 0.135), (0.09, 0.165), (0.03, 0.178), (0.0, 0.18)], helm, centre=(0, cy, hz), seg=22), "head")
        self.add(loft("HelmetBrim", [kit.ring_z(hz - 0.006, 0.176, 0.176, cy), kit.ring_z(hz - 0.012, 0.205, 0.2, cy - 0.004), kit.ring_z(hz + 0.004, 0.208, 0.203, cy - 0.004), kit.ring_z(hz + 0.016, 0.178, 0.178, cy)], helm, seg=26), "head")
        self.add(band("HelmetBand", (0, cy, hz + 0.03), 0.18, 0.011, gold, seg=(40, 6)), "head")
        self.add(band("HelmetBrimRim", (0, cy - 0.004, hz - 0.006), 0.207, 0.008, gold, seg=(40, 6)), "head")
        self.add(kit.chain("HelmetRidge", [(0, cy + 0.17, hz + 0.08), (0, cy + 0.12, hz + 0.155), (0, cy, hz + 0.198), (0, cy - 0.09, hz + 0.17)], [(0.016, 0.012)] * 4, gold, seg=8), "head")
        for s, x in SIDES:
            gc = Vector((0.074 * x, cy - 0.166, hz + 0.06))
            n = Vector((0.25 * x, -1, 0.35)).normalized()
            rot = n.to_track_quat("Z", "Y").to_euler()
            self.add(kit.blob(f"GoggleLens{s}", gc, (0.036, 0.036, 0.01), glass, segs=(18, 6), rotation=rot), "head")
            self.add(torus(f"GoggleRim{s}", gc, 0.04, 0.009, gold, seg=(28, 6), axis=n), "head")
        self.add(kit.tube("GoggleBridge", (-0.03, cy - 0.176, hz + 0.07), (0.03, cy - 0.176, hz + 0.07), [(0, 0.007, 0.007), (1, 0.007, 0.007)], gold, seg=6), "head")
        # signature: the crystal lantern, a gold cage on the top of the helm round a glowing amber crystal
        top = Vector((0, cy, hz + 0.195))
        self.add(tube("LanternBase", top, top + Vector((0, 0, 0.03)), [(0, 0.05, 0.05), (1, 0.044, 0.044)], gold, seg=14), "head")
        cc = top + Vector((0, 0, 0.16))
        self.add(kit.lathe("Crystal", [(0.0, -0.09), (0.085, -0.04), (0.092, 0.03), (0.0, 0.11)], crystal, seg=6, smooth=False, centre=cc), "head")
        for k in range(4):
            a = k * math.pi / 2 + math.pi / 4
            d = Vector((math.cos(a), math.sin(a), 0))
            self.add(kit.chain(f"Cage{k}", [top + d * 0.044 + Vector((0, 0, 0.03)), cc + d * 0.105 + Vector((0, 0, -0.04)), cc + d * 0.108 + Vector((0, 0, 0.03)), cc + d * 0.01 + Vector((0, 0, 0.13))], [0.005] * 4, gold, seg=6), "head")
        self.add(kit.blob("LanternCap", cc + Vector((0, 0, 0.135)), (0.024, 0.024, 0.022), gold, segs=(10, 8)), "head")
        # a pick slung across her back on a strap, the head standing up over her right shoulder
        a, b = Vector((0.2, 0.33, 0.62)), Vector((-0.12, 0.27, 1.26))
        self.add(tube("PickHaft", a, b, [(0, 0.02, 0.02), (1, 0.017, 0.017)], wood, seg=10), "chest")
        for k, t in enumerate((0.08, 0.5)):
            self.add(band(f"PickBand{k}", a.lerp(b, t), 0.024, 0.006, gold, seg=(14, 6), axis=b - a), "chest")
        d = (b - a).normalized()
        side = Vector((0.9, 0.1, 0.42)).normalized()
        for f_ in (-1, 1):
            pts = kit.spline([b, b + side * f_ * 0.08 + d * 0.01, b + side * f_ * 0.15 - d * 0.02, b + side * f_ * 0.2 - d * 0.06], 8)
            self.add(kit.chain(f"PickHead{f_}", pts, [(0.022, 0.022), (0.022, 0.021), (0.02, 0.019), (0.018, 0.016), (0.015, 0.013), (0.011, 0.01), (0.007, 0.006), (0.002, 0.002)], steel, seg=8, side=d), "chest")
        self.add(kit.blob("PickEye", b, (0.03, 0.03, 0.03), gold, segs=(12, 8)), "chest")
        self.joints_fill(neck=(fur, 0.1))


# ============================================================================================ Grandma Ironknit
class YarnMythic(Yarn):
    """
    Grandma Ironknit, the Weaver (support): an old fate-spinner, tiny and unhurried. A long dark aubergine robe with a gold
    hem and a rose-thread belt, a dark wine hooded shawl knitted in bands of rose thread, the hood up round her face with a
    rolled rose edge and its point falling down her back, silver hair at the brow, calm big eyes and a small kind smile (the
    glasses are gone). Signature: two silver knitting needles as long as swords held out like a duellist, gold at the
    butts, half a rose-and-wine scarf on the right one, and a spindle standing up behind her left shoulder with three
    glowing rose yarn spools in gold flanges.
    """

    FUSE = (("Face", "skin", ("only", "Head", "Nose", "Ear", "Cheek"), 0.004, 8000, None, 9),
            ("Skin", "skin", ("Face",), 0.0045, 2600, None, 8),
            ("DressBody", "dress", (), 0.0055, 3200, None, 10),
            ("LegsBody", "legs", (), 0.007, 800, None, 8),
            ("Shoes", "shoe", (), 0.006, 900, None, 8),
            ("HairBody", "hair", (), 0.005, 2400, None, 6))
    FOLDS = ((("Skirt",), dict(below=0.56, n=11, amp=0.005, seed=2.0)),)
    WRAP = (("Mouth", "Face", 0.002),)
    PAINT = {"skin": dict(warm=0.9), "skirt": dict(shadow=(0.62, 0.5, 0.8)), "hood": dict(shadow=(0.6, 0.45, 0.7))}

    def body(self):
        shoe = self.mat("shoe", "#1e1418", roughness=0.5)
        legs = self.mat("legs", "#3a2a40", roughness=0.8)
        dress = self.mat("dress", "#3e2a48", roughness=0.75)
        skirt_m = self.mat("skirt", "#46304f", roughness=0.75)
        lining = self.mat("lining", "#241628", roughness=0.8, double_sided=True)
        wine = self.mat("shawlwine", "#5a2a4a", roughness=0.9)
        rose = self.mat("shawlrose", "#8a3258", roughness=0.9)
        hood = self.mat("hood", "#4c2644", roughness=0.9)
        edge = self.mat("hoodedge", "#9c3e64", roughness=0.9)
        gold = self.mat("gold", "#d2ae55", metallic=0.7, roughness=0.3, double_sided=True)
        skin = self.mat("skin", "#d2a68c", roughness=0.6)
        hair = self.mat("hair", "#a8a6b4", roughness=0.8)
        eyew = self.mat("eyewhite", "#fff8f0", roughness=0.4)
        iris = self.mat("iris", "#8a3a6a", roughness=0.2)
        lash = self.mat("lash", "#3a2030", roughness=0.6)
        steel = self.mat("needle", "#b4bcc8", metallic=0.7, roughness=0.22)
        wood = self.mat("wood", "#3a2418", roughness=0.6)
        spool = self.mat("spool", "#ff5a8a", roughness=0.5, emission="#ff3a78", strength=2.2)
        J = self.J

        self.legs(legs, shoe, thigh=(0.05, 0.04), shin=0.035, boot_r=0.042, boot_top=0.1, toe=0.16)

        def skirt_w(p):
            s = figure_kit.smooth(J["hip"] + 0.02, J["knee"] + 0.03, p.z)
            left = figure_kit.clamp(0.5 + p.x / 0.1)
            wl, wr = 0.85 * s * left, 0.85 * s * (1 - left)
            return {"pelvis": 1 - wl - wr, "thigh.L": wl, "thigh.R": wr}
        rings = [(0.58, 0.13, 0.105), (0.5, 0.17, 0.14), (0.38, 0.205, 0.17), (0.25, 0.235, 0.2), (0.13, 0.26, 0.225), (0.05, 0.27, 0.235)]
        self.bell("Skirt", rings, skirt_m, lining, weights=skirt_w, n=24, hem=gold)
        self.add(loft("Torso", [kit.ring_z(z, rx, ry, cy) for z, rx, ry, cy in [(0.54, 0.128, 0.105, 0.0), (0.66, 0.135, 0.11, 0.008), (0.78, 0.135, 0.105, 0.016), (0.86, 0.09, 0.08, 0.018), (0.92, 0.04, 0.04, 0.012)]], dress, seg=22), ["chest", "pelvis"])
        # a belt of rose thread round the waist, two tassels hanging from the knot
        self.add(loft("Belt", [kit.ring_z(0.56, 0.131, 0.108, 0.0), kit.ring_z(0.6, 0.131, 0.108, 0.0)], rose, seg=22), "pelvis")
        for k, dx in enumerate((-0.012, 0.012)):
            self.add(kit.chain(f"BeltTassel{k}", [Vector((dx, -0.112, 0.58)), Vector((dx * 2, -0.125, 0.46)), Vector((dx * 3, -0.13, 0.38))], [(0.014, 0.01), (0.018, 0.012), (0.012, 0.006)], rose, seg=6), skirt_w)
        self.arms(dress, dress, skin, r=(0.046, 0.04, 0.036), flare=0.02, cuff=gold, hand=(0.04, 0.045, 0.058))
        # signature part one: the shawl, bands of wine and rose thread to her elbows, a point down her back, a gold brooch
        def shawl_w(p):
            a = 0.55 * figure_kit.smooth(0.1, 0.22, abs(p.x))
            return {"chest": 1 - a, f"upper_arm.{'L' if p.x > 0 else 'R'}": a}
        shawl = [(0.91, 0.07, 0.07, 0.012), (0.87, 0.14, 0.125, 0.012), (0.81, 0.205, 0.158, 0.014), (0.73, 0.235, 0.17, 0.016), (0.65, 0.242, 0.172, 0.018)]
        for ob in check_loft("Shawl", [kit.ring_z(z, rx, ry, cy) for z, rx, ry, cy in shawl], (wine, rose), 5, 1, per_row=2, per_col=40):
            self.add(ob, shawl_w)
        back_top, back_tip = Vector((0, 0.18, 0.72)), Vector((0, 0.215, 0.38))
        self.add(tube("ShawlPoint", back_top, back_tip, [(0, 0.2, 0.012), (0.6, 0.1, 0.012), (1, 0.008, 0.008)], wine, seg=12, side=(1, 0, 0)), "chest")
        self.add(tube("ShawlPointB", back_top.lerp(back_tip, 0.1), back_top.lerp(back_tip, 0.75), [(0, 0.12, 0.014), (1, 0.008, 0.008)], rose, seg=8, side=(1, 0, 0)), "chest")
        for k in range(26):
            a = 2 * math.pi * k / 26
            top = Vector((0.242 * math.cos(a), 0.018 + 0.172 * math.sin(a), 0.65))
            self.add(kit.chain(f"Fringe{k}", [top, top + Vector((0.008 * math.cos(a), 0.008 * math.sin(a), -0.055))], [0.01, 0.005], edge, seg=5), shawl_w)
        self.add(blob("Brooch", (0, -0.145, 0.8), (0.03, 0.012, 0.03), gold, (12, 8)), "chest")

        # head: big, soft and old, a small nose, calm eyes, a small kind smile; the hood up round it
        hc = Vector((0, -0.04, 1.05))
        r = (0.138, 0.132, 0.14)
        self.head_shape(hc, r, skin, chin=0.62)
        for s, x in SIDES:
            self.add(blob(f"Ear{s}", hc + Vector((0.136 * x, 0.005, -0.015)), (0.016, 0.028, 0.044), skin, (10, 8)), "head")
            self.add(blob(f"Cheek{s}", hc + Vector((0.08 * x, -0.104, -0.068)), (0.036, 0.018, 0.028), skin, (12, 8)), "head")
        self.add(blob("Nose", hc + Vector((0, -0.132, -0.044)), (0.02, 0.02, 0.019), skin, (10, 8)), "head")
        self.eyes(hc, r, eyew, iris, eyew, spread=0.058, size=(0.03, 0.034), z=0.012, lash=lash)
        for s, x in SIDES:
            brow = [hc + Vector((0.028 * x, -0.13, 0.078)), hc + Vector((0.066 * x, -0.122, 0.09)), hc + Vector((0.106 * x, -0.09, 0.074))]
            self.add(chain(f"HairBrow{s}", brow, [0.006, 0.009, 0.004], hair, seg=8), "head")
        self.grin(hc, r, -0.56, 0.036, 0.01, 0.007, self.mat("lips", "#8a3a4a", roughness=0.5, double_sided=True))
        # silver hair at the brow under the hood's edge
        fringe = kit.spline([hc + Vector(v) for v in [(-0.12, -0.06, 0.07), (-0.07, -0.118, 0.096), (0.0, -0.136, 0.104), (0.07, -0.118, 0.096), (0.12, -0.06, 0.07)]], 11)
        self.add(kit.chain("HairFringe", fringe, [(0.012, 0.012), (0.017, 0.015), (0.02, 0.017), (0.02, 0.018), (0.021, 0.019), (0.021, 0.019), (0.021, 0.019), (0.02, 0.018), (0.02, 0.017), (0.017, 0.015), (0.012, 0.012)], hair, seg=10, side=(0, 0, 1)), "head")
        # the hood: a closed mass behind the face, a rolled rose edge round it, the point hanging down her back
        self.add(kit.blob("HoodMass", hc + Vector((0, 0.05, 0.02)), (0.165, 0.145, 0.16), hood, segs=(26, 16)), "head")
        ring = []
        for j in range(33):
            a = 2 * math.pi * j / 32
            ring.append(hc + Vector((0.14 * math.cos(a), -0.06 + 0.022 * math.sin(a), 0.014 + 0.14 * math.sin(a))))
        self.add(kit.chain("HoodEdge", ring, [0.026] * 33, edge, seg=8, side=(0, 1, 0)), "head")
        tip = kit.spline([hc + Vector(v) for v in [(0, 0.08, 0.12), (0, 0.12, 0.17), (0, 0.19, 0.16), (0, 0.24, 0.1), (0, 0.27, 0.0)]], 8)
        self.add(kit.chain("HoodTip", tip, [(0.07, 0.07), (0.062, 0.062), (0.052, 0.052), (0.044, 0.044), (0.036, 0.036), (0.028, 0.028), (0.02, 0.02), (0.01, 0.01)], hood, seg=12, side=(1, 0, 0)), "head")
        self.add(kit.blob("HoodBead", tip[-1], (0.022, 0.022, 0.022), gold, segs=(10, 8)), "head")

        # signature part two: the needles, up and out from each hand like two swords, a gold knob at the butt of each,
        # half a rose-and-wine scarf on the right one
        for s, x in SIDES:
            h = self.hand_at(x)
            d = Vector((0.4 * x, -0.14, 0.905)).normalized()
            a, b = h - d * 0.1, h + d * 0.92
            self.add(kit.tube(f"Needle{s}", a, b, [(0, 0.021, 0.021), (0.9, 0.018, 0.018), (1, 0.002, 0.002)], steel, seg=10), f"hand.{s}")
            self.add(kit.blob(f"NeedleKnob{s}", a, (0.036, 0.036, 0.036), gold, segs=(14, 10)), f"hand.{s}")
            if x < 0:
                top = h + d * 0.68
                for k in range(5):
                    p = top + Vector((0, 0.002, -0.015 - 0.05 * k))
                    self.add(kit.box(f"ScarfRow{k}", p, (0.15, 0.022, 0.052), rose if k % 2 else wine, bevel=0.008, segments=1), f"hand.{s}")
        # signature part three: a spindle behind her left shoulder with three glowing rose yarn spools in gold flanges
        a, b = Vector((0.2, 0.2, 0.3)), Vector((0.2, 0.2, 1.3))
        self.add(tube("Spindle", a, b, [(0, 0.016, 0.016), (1, 0.011, 0.011)], wood, seg=10), "chest")
        self.add(kit.blob("SpindleTip", b, (0.016, 0.016, 0.026), gold, segs=(10, 8)), "chest")
        for k, t in enumerate((0.45, 0.65, 0.85)):
            c = a.lerp(b, t)
            self.add(kit.blob(f"Spool{k}", c, (0.088, 0.088, 0.058), spool, segs=(20, 12)), "chest")
            for j, dz in enumerate((-0.06, 0.06)):
                self.add(tube(f"SpoolFlange{k}{j}", c + Vector((0, 0, dz)), c + Vector((0, 0, dz + 0.008)), [(0, 0.06, 0.06), (1, 0.06, 0.06)], gold, seg=18), "chest")
        self.joints_fill(neck=(skin, 0.04), elbow=(dress, 0.04), wrist=(skin, 0.03), hip=(legs, 0.05), knee=(legs, 0.04))


# ============================================================================================ Bo
class SheepMythic(Sheep):
    """
    Bo, the Ramherd (summoner): a mountain herdsman-druid, old, grave and unhurried. A deep umber shaggy wool cloak to the
    knees (wool tufts melted into one fleece surface) with a mid-grey fleece mantle on the shoulders and fleece hem, a dark
    leather belt with a gold buckle, dark boots, a weathered face under a bronze headband, a tidy silver beard with gold
    rings at its ends, grey brows and calm eyes (the red face, the shouting mouth, the hat and the sheep under his arm are
    gone). Signature: a pair of great curled ram horns springing from the headband, and a tall crook of dark wood taller
    than he is with a glowing warm bell hanging from its hook.
    """

    FUSE = (("Face", "skin", ("only", "Head", "Nose", "Ear", "Cheek"), 0.0042, 5000, None, 8),
            ("Skin", "skin", ("Face",), 0.006, 2400, None, 12),
            ("CoatBody", "coat", ("only", "Coat", "Torso", "Lump"), 0.0075, 8000, None, 9),
            ("SleeveBody", "coat", ("only", "UpperArm", "Forearm", "Joint", "Fleece"), 0.0075, 3000, None, 5),
            ("TrimBody", "trim", (), 0.0065, 3600, None, 3),
            ("BeardBody", "beard", (), 0.0065, 4500, None, 7),
            ("LegsBody", "trousers", (), 0.0075, 1000, None, 10),
            ("Boots", "boot", (), 0.0075, 1400, None, 8),
            ("HairBody", "hair", (), 0.0045, 2600, None, 6))
    CAPS = {"coat": 7000}
    PAINT = {"skin": dict(warm=1.0), "coat": dict(shadow=(0.62, 0.52, 0.5)), "trim": dict(shadow=(0.68, 0.62, 0.62)), "beard": dict(shadow=(0.62, 0.62, 0.78))}

    def body(self):
        boot = self.mat("boot", "#241810", roughness=0.75)
        cloth = self.mat("trousers", "#2e261c", roughness=0.9)
        coat = self.mat("coat", "#5a4632", roughness=1.0)
        trim = self.mat("trim", "#8e8470", roughness=1.0)
        belt = self.mat("rope", "#2c1e14", roughness=0.7)
        gold = self.mat("gold", "#d2ae55", metallic=0.7, roughness=0.3, double_sided=True)
        skin = self.mat("skin", "#c8906c", roughness=0.55)
        beard = self.mat("beard", "#9c9ca0", roughness=0.9)
        brow = self.mat("brow", "#8a8a8c", roughness=0.9)
        hair = self.mat("hair", "#7e7e84", roughness=0.9)
        horn = self.mat("horn", "#b09a70", roughness=0.45)
        wood = self.mat("crook", "#3a2616", roughness=0.65)
        bell = self.mat("bell", "#ffc462", metallic=0.3, roughness=0.2, emission="#ffa840", strength=2.2)
        eyew = self.mat("eyewhite", "#fff0e0", roughness=0.4)
        iris = self.mat("iris", "#3a4a3c", roughness=0.25)
        J = self.J

        self.legs(cloth, boot, thigh=(0.075, 0.062), shin=0.056, boot_r=0.078, boot_top=0.3, toe=0.22, cuff=gold)
        # the cloak is one closed shape with wool tufts melted on it, so it reads as a shaggy fleece
        table = [(0.42, 0.33, 0.28), (0.6, 0.3, 0.255), (0.8, 0.27, 0.225), (0.96, 0.24, 0.195), (1.1, 0.24, 0.19), (1.24, 0.265, 0.195), (1.34, 0.255, 0.185), (1.42, 0.17, 0.13), (1.46, 0.09, 0.08)]

        def coat_w(p):
            if p.z > 1.0:
                t = figure_kit.smooth(1.0, 1.16, p.z)
                return {"chest": t, "pelvis": 1 - t}
            s = figure_kit.smooth(J["hip"] + 0.05, J["knee"] + 0.0, p.z)
            left = figure_kit.clamp(0.5 + p.x / 0.16)
            wl, wr = 0.85 * s * left, 0.85 * s * (1 - left)
            return {"pelvis": 1 - wl - wr, "thigh.L": wl, "thigh.R": wr}
        self.add(loft("Coat", [kit.ring_z(z, rx, ry) for z, rx, ry in table], coat, seg=28), coat_w)
        for row in range(10):
            z = 0.47 + row * 0.095
            rx, ry = figure_kit.interp(table, z)
            n = int(12 + 10 * rx)
            for k in range(n):
                a = 2 * math.pi * (k + 0.5 * (row % 2)) / n
                rad = 0.05 + 0.012 * ((k * 3 + row) % 3) / 2
                self.add(kit.blob(f"Lump{row}_{k}", (rx * math.cos(a), ry * math.sin(a), z), (rad, rad, rad * 0.85), coat, segs=(8, 6)), coat_w)
        # grey fleece: the hem, a mantle over the shoulders, the front edge; a dark leather belt with a gold buckle
        for k in range(20):
            a = 2 * math.pi * k / 20
            self.add(kit.blob(f"Hem{k}", (0.335 * math.cos(a), 0.285 * math.sin(a), 0.43 + 0.012 * (k % 2)), (0.062, 0.062, 0.05), trim, segs=(10, 8)), coat_w)
        for k in range(18):
            a = 2 * math.pi * k / 18
            self.add(kit.blob(f"Collar{k}", (0.215 * math.cos(a), 0.17 * math.sin(a), 1.4 + 0.014 * (k % 2)), (0.066, 0.06, 0.05), trim, segs=(10, 8)), "chest")
        for k, z in enumerate((0.62, 0.74, 0.86, 1.0, 1.12)):
            rx, ry = figure_kit.interp(table, z)
            self.add(kit.blob(f"FrontEdge{k}", (0.012 * (-1) ** k, -ry - 0.026, z), (0.05, 0.03, 0.058), trim, segs=(10, 8)), coat_w)
        self.add(loft("RopeBelt", [kit.ring_z(1.015, 0.262, 0.216), kit.ring_z(1.05, 0.262, 0.216)], belt, seg=24), "pelvis")
        self.add(kit.box("BeltBuckle", (0, -0.222, 1.034), (0.07, 0.016, 0.06), gold, bevel=0.006, segments=1), "pelvis")
        # sleeves of the same fleece, grey cuffs, big fists
        self.arms(coat, coat, skin, r=(0.082, 0.078, 0.07), hand=(0.05, 0.05, 0.07))
        for ob, _ in list(self.parts):
            if ob.name.startswith(("PalmL", "PalmR", "ThumbL", "ThumbR", "KnucklesL", "KnucklesR")):
                self.parts = [p for p in self.parts if p[0] is not ob]
                bpy.data.objects.remove(ob, do_unlink=True)
        for s, x in SIDES:
            self.fist(x, skin, 0.84)
            sh, el, wr = self.shoulder_pts(x)
            for k, t in enumerate((0.15, 0.42, 0.7)):
                p = sh.lerp(el, t) if t < 0.5 else el.lerp(wr, t)
                for j, a in enumerate((0.0, 2.1, 4.2)):
                    self.add(kit.blob(f"Fleece{s}{k}{j}", p + Vector((0.07 * math.cos(a + k), 0.07 * math.sin(a + k), 0)), (0.04, 0.04, 0.04), coat, segs=(8, 6)), [f"upper_arm.{s}", f"forearm.{s}"])
            for k in range(8):
                a = 2 * math.pi * k / 8
                c = el.lerp(wr, 0.93) + Vector((0.07 * math.cos(a), 0.07 * math.sin(a), 0))
                self.add(kit.blob(f"Cuff{s}{k}", c, (0.038, 0.038, 0.034), trim, segs=(8, 6)), f"forearm.{s}")
        # the head: weathered and calm, a small nose, grey brows level over steady eyes
        hc = Vector((0, -0.035, 1.585))
        r = (0.126, 0.124, 0.135)
        self.head_shape(hc, r, skin, chin=0.75)
        for s, x in SIDES:
            self.add(blob(f"Ear{s}", hc + Vector((0.126 * x, 0.01, -0.005)), (0.018, 0.03, 0.04), skin, (10, 8)), "head")
            self.add(blob(f"Cheek{s}", hc + Vector((0.072 * x, -0.096, -0.03)), (0.034, 0.02, 0.026), skin, (12, 8)), "head")
        self.add(blob("Nose", hc + Vector((0, -0.128, -0.03)), (0.02, 0.022, 0.026), skin, (10, 8)), "head")
        self.eyes(hc, r, eyew, iris, eyew, spread=0.054, size=(0.027, 0.026), z=0.022)
        for s, x in SIDES:
            pts = [hc + Vector((0.012 * x, -0.132, 0.068)), hc + Vector((0.05 * x, -0.128, 0.078)), hc + Vector((0.094 * x, -0.104, 0.074)), hc + Vector((0.136 * x, -0.07, 0.062))]
            self.add(chain(f"Brow{s}", pts, [(0.012, 0.01), (0.016, 0.014), (0.014, 0.012), (0.003, 0.003)], brow, seg=8, side=(0, 0, 1)), "head")
        # the beard: a tidy silver fall, clumps melted together, on sway bones lower down, a gold ring at each end
        pts = [(0, -0.2, 1.46), (0, -0.25, 1.33), (0, -0.3, 1.2), (0, -0.33, 1.02)]
        bones = self.sway("beard", "head", pts)

        def beard_w(p):
            s = figure_kit.smooth(1.34, 1.5, p.z)
            m = figure_kit.smooth(1.18, 1.34, p.z)
            k = figure_kit.smooth(1.05, 1.2, p.z)
            return {"head": s, bones[0]: (1 - s) * m, bones[1]: (1 - s) * (1 - m) * k, bones[2]: (1 - s) * (1 - m) * (1 - k)}
        y0 = hc.y
        clumps = [((0, -0.07, 1.485), (0.13, 0.095, 0.07)), ((0, -0.135, 1.4), (0.15, 0.1, 0.095)), ((0, -0.175, 1.28), (0.12, 0.095, 0.125)), ((0, -0.215, 1.14), (0.075, 0.07, 0.115))]
        for k, (c, rad) in enumerate(clumps):
            self.add(blob(f"BeardMass{k}", (c[0], y0 + c[1], c[2]), rad, beard, (18, 12)), beard_w)
        lobes = [(0.1, -0.03, 1.52, 0.045, 0.055, 0.08), (0.12, -0.06, 1.43, 0.06, 0.07, 0.09), (0.12, -0.1, 1.33, 0.055, 0.06, 0.09), (0.085, -0.15, 1.22, 0.05, 0.06, 0.1)]
        for k, (lx, ly, lz, a, b, c) in enumerate(lobes):
            for s, x in SIDES:
                self.add(blob(f"BeardLobe{s}{k}", (lx * x, y0 + ly, lz), (a, b, c), beard, (12, 8)), beard_w)
        self.add(blob("BeardNape", hc + Vector((0, 0.06, -0.04)), (0.12, 0.08, 0.1), beard, (14, 10)), "head")
        self.add(torus("BeardRing", (0, y0 - 0.31, 1.06), 0.04, 0.009, gold, seg=(20, 6), axis=(0, 0.3, 1)), beard_w)
        # grey hair swept back over the ears and down the neck
        self.add(blob("HairCap", hc + Vector((0, 0.03, 0.075)), (0.134, 0.122, 0.1), hair, (22, 14)), "head")
        self.add(blob("HairBack", hc + Vector((0, 0.07, -0.04)), (0.13, 0.09, 0.12), hair, (16, 10)), "head")
        # signature: a bronze headband with a great ram horn curling from each temple, down past the ear and forward
        cz = hc.z + 0.066
        circ = [Vector((0.129 * math.cos(a), hc.y + 0.124 * math.sin(a) - 0.004, cz + 0.01 * math.sin(a))) for a in [2 * math.pi * k / 32 for k in range(33)]]
        self.add(chain("Headband", circ, [0.009] * len(circ), gold, seg=6), "head")
        for s, x in SIDES:
            curl = kit.spline([hc + Vector(v) for v in [(0.12 * x, 0.0, 0.07), (0.2 * x, 0.03, 0.15), (0.29 * x, 0.04, 0.1), (0.32 * x, 0.0, -0.02), (0.27 * x, -0.07, -0.09), (0.2 * x, -0.095, -0.05), (0.18 * x, -0.07, 0.0)]], 14)
            n = len(curl)
            rad = [(0.036 * (1 - 0.72 * i / (n - 1)) + 0.004, 0.034 * (1 - 0.72 * i / (n - 1)) + 0.004) for i in range(n)]
            self.add(kit.chain(f"Horn{s}", curl, rad, horn, seg=10), "head")
            for k, t in enumerate((0.25, 0.5, 0.72)):
                i = int(t * (n - 1))
                tan = (curl[min(i + 1, n - 1)] - curl[max(i - 1, 0)]).normalized()
                self.add(band(f"HornRing{s}{k}", curl[i], rad[i][0] + 0.004, 0.005, gold, seg=(14, 5), axis=tan), "head")

        # signature: the crook, up from the right fist, far over his head, a big open hook to the outside, a glowing bell on it
        h = self.hand_grip(-1)
        d = Vector((-0.14, -0.02, 0.99)).normalized()
        low, top = h - d * 0.7, h + d * 1.28
        self.add(tube("CrookStaff", low, top, [(0, 0.022, 0.022), (1, 0.026, 0.026)], wood, seg=10), "hand.R")
        for k, t in enumerate((0.0, 0.015)):
            self.add(band(f"CrookFoot{k}", low.lerp(top, 0.02 + t * 2), 0.028, 0.007, gold, seg=(14, 6), axis=d), "hand.R")
        hook = kit.spline([top, top + d * 0.1, top + Vector((-0.035, 0, 0.21)), top + Vector((-0.14, 0, 0.27)), top + Vector((-0.25, 0, 0.21)), top + Vector((-0.285, 0, 0.09)), top + Vector((-0.25, 0, 0.0))], 18)
        self.add(kit.chain("CrookHook", hook, [0.027] * 16 + [0.024, 0.018], wood, seg=10, side=(0, 1, 0)), "hand.R")
        tipc = hook[-1]
        self.add(kit.chain("BellCord", [tipc, tipc + Vector((0, 0, -0.03))], [0.008, 0.008], gold, seg=6), "hand.R")
        bc = tipc + Vector((0, 0, -0.1))
        self.add(kit.lathe("Bell", [(0.0, 0.07), (0.03, 0.065), (0.05, 0.03), (0.075, -0.05), (0.082, -0.07), (0.0, -0.06)], bell, seg=20, centre=bc), "hand.R")
        self.add(band("BellRim", bc + Vector((0, 0, -0.07)), 0.082, 0.009, gold, seg=(24, 6)), "hand.R")
        self.add(kit.blob("BellClapper", bc + Vector((0, 0, -0.082)), (0.018, 0.018, 0.018), gold, segs=(10, 8)), "hand.R")
        self.joints_fill(neck=(skin, 0.075), shoulder=(coat, 0.084), elbow=(coat, 0.078), wrist=(skin, 0.064), hip=(cloth, 0.08), knee=(cloth, 0.062))


# ============================================================================================ The Great Zambini
class MagicMythic(Magic):
    """
    The Great Zambini, the Illusionist (trickster): the same tall showman, darker and finer. A deep indigo-black tailcoat over
    a plum waistcoat with gold buttons and an ivory shirt front, a stiff gold-edged collar closed with a gold brooch, dark
    plum gloves with gold cuffs, slick black hair, a small pointed goatee, level brows and a calm knowing smile (the curled
    moustache, the raised brow and the white gloves are gone). Signature: a tall black top hat with a deep violet band and a
    gold buckle, a cape parted down the back (black outside, deep violet inside) with a gold-rimmed standing collar, and a
    black wand with gold ends carrying a glowing gold star gem.
    """

    def body(self):
        shoe = self.mat("shoe", "#121216", roughness=0.2)
        cloth = self.mat("trousers", "#26222f", roughness=0.7)
        coat = self.mat("coat", "#241f33", roughness=0.5)
        satin = self.mat("satin", "#4a4262", roughness=0.25)
        vest = self.mat("vest", "#5a2a78", roughness=0.5)
        shirt = self.mat("shirt", "#b8b09e", roughness=0.6)
        purple = self.mat("capein", "#5e2a8e", roughness=0.45, double_sided=True)
        black = self.mat("capeout", "#1e1c2a", roughness=0.45, double_sided=True)
        glove = self.mat("glove", "#3a2a4c", roughness=0.55)
        skin = self.mat("skin", "#d2a88a", roughness=0.5)
        hair = self.mat("hair", "#16141c", roughness=0.3)
        hatm = self.mat("tophat", "#1c1c26", roughness=0.28)
        bandm = self.mat("hatband", "#5a2a8a", roughness=0.4)
        eyew = self.mat("eyewhite", "#fff8f0", roughness=0.4)
        iris = self.mat("iris", "#6c2cb0", roughness=0.2)
        wand = self.mat("wand", "#121216", roughness=0.25)
        star = self.mat("star", "#ffc850", roughness=0.25, emission="#ffb030", strength=2.4)
        gold = self.mat("gold", "#d2ae55", metallic=0.7, roughness=0.28, double_sided=True)
        goatee = self.mat("goatee", "#16141c", roughness=0.3)
        J = self.J

        self.legs(cloth, shoe, thigh=(0.07, 0.054), shin=0.048, boot_r=0.05, boot_top=0.08, toe=0.26)
        for s, x in SIDES:
            self.add(kit.chain(f"Stripe{s}", [(0.15 * x, 0.0, 1.02), (0.128 * x, 0.0, 0.6), (0.122 * x, 0.0, 0.14)], [0.006, 0.006, 0.006], gold, seg=5), [f"thigh.{s}", f"shin.{s}"])
        # the tailcoat: cut high at the waist in front, two long tails behind on sway bones
        self.add(loft("Torso", [kit.ring_z(z, rx, ry) for z, rx, ry in [(1.1, 0.135, 0.1), (1.2, 0.128, 0.092), (1.34, 0.158, 0.106), (1.46, 0.178, 0.11), (1.54, 0.13, 0.086), (1.6, 0.05, 0.05)]], coat, seg=24), ["chest", "pelvis"])
        self.add(loft("Hips", [kit.ring_z(z, rx, ry) for z, rx, ry in [(1.2, 0.128, 0.092), (1.08, 0.138, 0.1), (0.98, 0.13, 0.092)]], cloth, seg=22), ["pelvis", "thigh.L", "thigh.R"])
        self.add(tube("ShirtFront", (0, -0.075, 1.57), (0, -0.112, 1.2), [(0, 0.052, 0.03), (1, 0.05, 0.014)], shirt, seg=10, side=(1, 0, 0)), "chest")
        self.add(tube("Waistcoat", (0, -0.092, 1.42), (0, -0.116, 1.12), [(0, 0.052, 0.018), (0.2, 0.086, 0.016), (1, 0.104, 0.016)], vest, seg=12, side=(1, 0, 0)), "chest")
        for s, x in SIDES:
            self.add(tube(f"Lapel{s}", (0.068 * x, -0.082, 1.56), (0.078 * x, -0.128, 1.18), [(0, 0.024, 0.009), (0.45, 0.04, 0.009), (1, 0.02, 0.009)], satin, seg=8, side=(1, 0, 0)), "chest")
            self.add(kit.chain(f"LapelEdge{s}", [Vector((0.09 * x, -0.082, 1.56)), Vector((0.118 * x, -0.13, 1.4)), Vector((0.098 * x, -0.135, 1.18))], [0.0055] * 3, gold, seg=6), "chest")
            pts = [Vector((0.09 * x, 0.075, 1.14)), Vector((0.1 * x, 0.15, 0.94)), Vector((0.11 * x, 0.18, 0.74)), Vector((0.12 * x, 0.2, 0.55))]
            bones = self.sway(f"tail{s}", "pelvis", pts)
            for i in range(3):
                self.add(kit.tube(f"CoatTail{s}{i}", pts[i], pts[i + 1], [(0, 0.075 - 0.012 * i, 0.012), (1, 0.066 - 0.012 * i - (0.04 if i == 2 else 0), 0.012)], black, seg=8, side=(1, 0, 0)), bones[i])
        for k, z in enumerate((1.34, 1.26, 1.18)):
            self.add(kit.blob(f"VestButton{k}", (0, -0.119 - 0.008 * (k == 2), z), (0.012, 0.006, 0.012), gold, segs=(8, 6)), "chest")
        # a stiff collar closed with a gold brooch, a violet gem in it
        self.add(loft("ShirtCollar", [kit.ring_z(1.63, 0.058, 0.056), kit.ring_z(1.57, 0.066, 0.062)], shirt, seg=18, cap=(False, False)), ["chest", "neck"])
        self.add(band("CollarGold", (0, 0, 1.63), 0.058, 0.006, gold, seg=(20, 5)), ["chest", "neck"])
        self.add(blob("Brooch", (0, -0.088, 1.545), (0.022, 0.012, 0.022), gold, (12, 8)), "chest")
        self.add(kit.blob("BroochGem", (0, -0.098, 1.545), (0.011, 0.006, 0.011), bandm, segs=(8, 6)), "chest")
        self.arms(coat, coat, glove, r=(0.055, 0.047, 0.043), cuff=gold, hand=(0.05, 0.056, 0.078))
        # head: long and calm; level brows; a small pointed goatee; slick black hair
        hc = Vector((0, -0.012, 1.765))
        r = (0.11, 0.116, 0.145)
        self.head_shape(hc, r, skin, chin=0.26)
        for s, x in SIDES:
            self.add(blob(f"Ear{s}", hc + Vector((0.112 * x, 0.005, -0.005)), (0.014, 0.026, 0.036), skin, (10, 8)), "head")
        self.add(blob("Nose", hc + Vector((0, -0.116, -0.02)), (0.014, 0.022, 0.022), skin, (10, 8)), "head")
        self.eyes(hc, r, eyew, iris, eyew, spread=0.048, size=(0.026, 0.026), z=0.018)
        for s, x in SIDES:
            brow = [hc + Vector((0.016 * x, -0.116, 0.054)), hc + Vector((0.052 * x, -0.108, 0.07)), hc + Vector((0.098 * x, -0.07, 0.054))]
            self.add(chain(f"Brow{s}", brow, [0.005, 0.0085, 0.003], goatee, seg=8), "head")
        self.grin(hc, r, -0.63, 0.026, 0.006, 0.0065, self.mat("lips", "#8a3438", roughness=0.4, double_sided=True))
        self.add(kit.chain("Goatee", [hc + Vector((0, -0.09, -0.118)), hc + Vector((0, -0.104, -0.16)), hc + Vector((0, -0.108, -0.21))], [0.018, 0.014, 0.003], goatee, seg=8), "head")
        self.add(blob("HairBack", hc + Vector((0, 0.05, 0.015)), (0.112, 0.082, 0.102), hair, (16, 10)), "head")
        for s, x in SIDES:
            self.add(chain(f"Sideburn{s}", [hc + Vector((0.102 * x, -0.025, 0.05)), hc + Vector((0.108 * x, -0.04, -0.03))], [0.014, 0.004], hair, seg=8), "head")
        # the top hat: a stiff brim, a tall flared column, a deep violet band with a gold buckle, a little tilted
        hat_parts = [loft("HatBrim", [kit.ring_z(0.0, 0.118, 0.118), kit.ring_z(-0.006, 0.172, 0.158), kit.ring_z(0.012, 0.18, 0.166), kit.ring_z(0.02, 0.118, 0.118)], hatm, seg=26),
                     lathe("HatColumn", [(0.112, 0.0), (0.108, 0.1), (0.112, 0.25), (0.126, 0.385), (0.126, 0.395), (0.0, 0.397)], hatm, seg=22),
                     band("HatBandV", (0, 0, 0.05), 0.11, 0.021, bandm, seg=(32, 6)),
                     band("HatRimGold", (0, 0, 0.015), 0.178, 0.005, gold, seg=(40, 5)),
                     kit.box("HatBuckle", (0, -0.126, 0.05), (0.05, 0.012, 0.042), gold, bevel=0.005, segments=1)]
        M = Matrix.Translation((0.0, hc.y + 0.0, hc.z + 0.118)) @ Matrix.Rotation(math.radians(-5), 4, "Y")
        for ob in hat_parts:
            kit.transform(ob, M)
            self.add(ob, "head")
        # signature: the cape. A dark yoke across the shoulders, a violet panel down the middle and two wider ones under,
        # the two black halves hanging outside them, parted, so the violet shows from the camera behind him
        self.add(kit.blob("CapeYoke", (0, 0.04, 1.535), (0.24, 0.135, 0.075), black, segs=(22, 12)), "chest")
        top, ln = 1.52, 1.42
        for k, (x0, w) in enumerate(((0.0, 0.12), (-0.19, 0.11), (0.19, 0.11))):
            self.panel(f"capein{k}", purple, x0, 0.11 * (0 if k == 0 else (1 if x0 > 0 else -1)), top, ln, 0.13, w)
        for k, x in enumerate((-1, 1)):
            self.panel(f"capeout{k}", black, 0.215 * x, 0.14 * x, top, ln * 0.99, 0.16, 0.115)
        # a standing collar behind the head, violet inside, a gold rim along its top
        def fan(z, off=0.0):
            t = (z - 1.54) / 0.28
            return (z, 0.12 + 0.1 * t - off, 0.1 + 0.1 * t - off, 0.03 + 0.03 * t)
        cuts = [1.82, 1.74, 1.66, 1.58, 1.54]
        self.add(arc_shell("CollarOut", [fan(z) for z in cuts], -0.2, math.pi + 0.2, black, thick=0.007, seg=30), "chest")
        self.add(arc_shell("CollarIn", [fan(z, 0.009) for z in cuts], -0.2, math.pi + 0.2, purple, thick=0.005, seg=30), "chest")
        t = (1.82 - 1.54) / 0.28
        rim = [Vector(((0.12 + 0.1 * t) * math.cos(a), 0.03 + 0.03 * t + (0.1 + 0.1 * t) * math.sin(a), 1.82)) for a in [-0.2 + (math.pi + 0.4) * k / 24 for k in range(25)]]
        self.add(chain("CollarRim", rim, [0.006] * len(rim), gold, seg=6), "chest")
        # signature: the wand, up and out, gold ends, the glowing gold five-pointed star gem on its tip
        h = self.hand_at(-1)
        d = Vector((-0.48, -0.1, 0.87)).normalized()
        self.add(kit.tube("Wand", h - d * 0.08, h + d * 0.62, [(0, 0.018, 0.018), (1, 0.015, 0.015)], wand, seg=10), "hand.R")
        self.add(kit.tube("WandTipA", h - d * 0.09, h - d * 0.03, [(0, 0.019, 0.019), (1, 0.019, 0.019)], gold, seg=10), "hand.R")
        self.add(kit.tube("WandTipB", h + d * 0.48, h + d * 0.62, [(0, 0.016, 0.016), (1, 0.016, 0.016)], gold, seg=10), "hand.R")
        sc = h + d * 0.72
        pts_ = []
        for k in range(10):
            a = math.pi / 2 + k * math.pi / 5
            rad = 0.15 if k % 2 == 0 else 0.062
            pts_.append((rad * math.cos(a), rad * math.sin(a)))
        ob = kit.extrude_shape("WandStar", pts_, 0.032, star, bevel=0.006, centre=(0, 0, 0))
        kit.transform(ob, Matrix.Translation(sc))
        self.add(ob, "hand.R")
        self.joints_fill(neck=(skin, 0.042), shoulder=(coat, 0.058), elbow=(coat, 0.048), wrist=(glove, 0.036), hip=(cloth, 0.07), knee=(cloth, 0.054))


# ============================================================================================ Wick
class DoorMythic(Door):
    """
    Wick, the Doorwarden (controller): keeper of thresholds, old and thin. A long dark oxblood coat to below the knee with
    wide gold braid down the front, at the hem and at the cuffs, a high stiff collar, small gold shoulder plates, dark gloves,
    a hood lying back on his shoulders with its point down his back and a gold rim, short silver hair swept back, a long
    calm face and a thin polite smile (the pillbox hat, the white side whiskers and the white gloves are gone). Signature:
    a great brass ring of oversized keys hanging from his right hand with a glowing amber gem among the keys, and a small
    dark lantern with a gold frame hanging from his left hand.
    """

    PAINT = {"skin": dict(warm=0.7), "coat": dict(shadow=(0.62, 0.4, 0.5)), "coatskirt": dict(shadow=(0.62, 0.4, 0.5)), "hair": dict(shadow=(0.65, 0.68, 0.85)), "hood": dict(shadow=(0.6, 0.4, 0.5))}

    def body(self):
        shoe = self.mat("shoe", "#141216", roughness=0.25)
        cloth = self.mat("trousers", "#25222c", roughness=0.8)
        coat = self.mat("coat", "#5c1a22", roughness=0.6)
        skirt_m = self.mat("coatskirt", "#541820", roughness=0.6)
        lining = self.mat("lining", "#2e1018", roughness=0.8, double_sided=True)
        trim = self.mat("trim", "#3a1016", roughness=0.6)
        hood = self.mat("hood", "#6c1e28", roughness=0.8, double_sided=True)
        gold = self.mat("gold", "#d2ae55", metallic=0.7, roughness=0.28, double_sided=True)
        brass = self.mat("brass", "#d2a040", metallic=0.72, roughness=0.26)
        glove = self.mat("glove", "#2a1c20", roughness=0.55)
        skin = self.mat("skin", "#d2ac90", roughness=0.55)
        hair = self.mat("hair", "#a4a4ac", roughness=0.85)
        eyew = self.mat("eyewhite", "#fff8f0", roughness=0.4)
        iris = self.mat("iris", "#40505e", roughness=0.25)
        gem = self.mat("gem", "#ffc058", roughness=0.15, emission="#ffa83a", strength=2.4)
        iron = self.mat("iron", "#2a2226", metallic=0.5, roughness=0.4)
        glass = self.mat("glass", "#6a4a28", roughness=0.15, emission="#ff9a30", strength=0.6)
        J = self.J

        self.legs(cloth, shoe, thigh=(0.044, 0.04), shin=0.038, boot_r=0.05, boot_top=0.08, toe=0.24)
        # a thin chest, a long bell of a coat to below the knee, gold at the hem, a slit up the back
        self.add(loft("Torso", [kit.ring_z(z, rx, ry) for z, rx, ry in [(1.02, 0.112, 0.082), (1.14, 0.102, 0.075), (1.28, 0.122, 0.082), (1.4, 0.142, 0.09), (1.47, 0.11, 0.076), (1.53, 0.05, 0.048)]], coat, seg=24), ["chest", "pelvis"])

        def coat_w(p):
            s = figure_kit.smooth(J["hip"] + 0.04, J["knee"] + 0.02, p.z)
            left = figure_kit.clamp(0.5 + p.x / 0.11)
            wl, wr = 0.85 * s * left, 0.85 * s * (1 - left)
            return {"pelvis": 1 - wl - wr, "thigh.L": wl, "thigh.R": wr}
        rings = [(1.13, 0.106, 0.078), (1.0, 0.132, 0.1), (0.82, 0.16, 0.125), (0.62, 0.188, 0.15), (0.44, 0.215, 0.172), (0.34, 0.228, 0.183)]
        self.bell("CoatSkirt", rings, skirt_m, lining, weights=coat_w, n=26)
        z0, rx, ry = rings[-1]
        self.add(loft("CoatHem", [kit.ring_z(z0 + 0.03, rx + 0.0, ry + 0.0), kit.ring_z(z0 + 0.03, rx + 0.009, ry + 0.009), kit.ring_z(z0 - 0.012, rx + 0.009, ry + 0.009), kit.ring_z(z0 - 0.012, rx - 0.002, ry - 0.002)], gold, seg=26, cap=(False, False)), coat_w)
        self.add(kit.chain("BackSlit", [(0, 0.098, 1.0), (0, 0.128, 0.8), (0, 0.164, 0.56), (0, 0.19, 0.33)], [0.006, 0.007, 0.008, 0.008], trim, seg=6), coat_w)
        # wide gold braid down both edges of the front opening, from the collar to the hem, and a dark belt with a gold buckle
        for s, x in SIDES:
            front = [Vector((0.03 * x, -0.082, 1.46)), Vector((0.04 * x, -0.092, 1.3)), Vector((0.045 * x, -0.098, 1.14)), Vector((0.06 * x, -0.118, 0.98)), Vector((0.07 * x, -0.14, 0.8)),
                     Vector((0.078 * x, -0.164, 0.6)), Vector((0.082 * x, -0.186, 0.4))]
            self.add(kit.chain(f"Braid{s}", front, [0.011] * len(front), gold, seg=6), lambda p: {"chest": 1.0} if p.z > 1.14 else coat_w(p))
        self.add(loft("Sash", [kit.ring_z(1.1, 0.112, 0.084), kit.ring_z(1.155, 0.108, 0.081)], trim, seg=24), "pelvis")
        self.add(kit.box("SashBuckle", (0, -0.086, 1.127), (0.062, 0.012, 0.06), gold, bevel=0.006, segments=1), "pelvis")
        for k, (z, yy) in enumerate(((1.39, -0.09), (1.31, -0.087), (1.23, -0.08), (1.03, -0.104), (0.91, -0.119), (0.79, -0.137))):
            self.add(kit.blob(f"Button{k}", (0.0, yy - 0.002, z), (0.014, 0.008, 0.014), gold, segs=(10, 6)), "chest" if z > 1.14 else coat_w)
        # a stiff high collar in dark oxblood and gold
        self.add(loft("CoatCollar", [kit.ring_z(1.5, 0.082, 0.078), kit.ring_z(1.58, 0.068, 0.066)], trim, seg=20), ["chest", "neck"])
        self.add(band("CollarBraid", (0, 0, 1.58), 0.068, 0.0085, gold, seg=(24, 6)), ["chest", "neck"])
        # thin sleeves, braided cuffs, long dark gloved hands, small gold shoulder plates
        self.arms(coat, coat, glove, r=(0.05, 0.042, 0.038), cuff=trim, hand=(0.05, 0.055, 0.078))
        for s, x in SIDES:
            sh, el, wr = self.shoulder_pts(x)
            for k, t in enumerate((0.8, 0.9)):
                self.add(band(f"CuffBraid{s}{k}", el.lerp(wr, t), 0.05, 0.007, gold, seg=(18, 6), axis=wr - el), f"forearm.{s}")
            pc = Vector((0.16 * x, 0.0, 1.495))
            pw = (lambda arm: (lambda p: {"chest": 0.6, arm: 0.4}))(f"upper_arm.{s}")
            self.add(kit.blob(f"Epaulette{s}", pc, (0.07, 0.052, 0.016), gold, segs=(16, 8)), pw)
        # head: long and narrow, a straight nose, calm patient eyes, a thin polite smile, short silver hair swept back
        hc = Vector((0, -0.018, 1.7))
        r = (0.105, 0.112, 0.142)
        self.head_shape(hc, r, skin, chin=0.3)
        for s, x in SIDES:
            self.add(blob(f"Ear{s}", hc + Vector((0.106 * x, 0.005, 0.0)), (0.016, 0.028, 0.04), skin, (10, 8)), "head")
        self.add(chain("NoseBridge", [hc + Vector((0, -0.106, 0.02)), hc + Vector((0, -0.12, -0.024)), hc + Vector((0, -0.128, -0.05)), hc + Vector((0, -0.126, -0.062))], [0.01, 0.011, 0.013, 0.007], skin, seg=10), "head")
        spread = 0.046
        self.eyes(hc, r, eyew, iris, eyew, spread=spread, size=(0.025, 0.026), z=0.012)
        for s, x in SIDES:
            ey = hc.y - r[1] * math.sqrt(1 - (spread / r[0]) ** 2) + 0.012
            c = Vector((spread * x, ey, hc.z + 0.012))
            self.add(kit.blob(f"Lid{s}", c + Vector((0, -0.004, 0.014)), (0.028, 0.018, 0.016), self.mat("lid", "#c49a80", roughness=0.55), segs=(12, 8)), "head")
            brow = [hc + Vector((0.016 * x, -0.112, 0.055)), hc + Vector((0.052 * x, -0.104, 0.068)), hc + Vector((0.098 * x, -0.066, 0.04))]
            self.add(chain(f"Brow{s}", brow, [0.007, 0.009, 0.004], hair, seg=8), "head")
        self.grin(hc, r, -0.66, 0.03, 0.006, 0.006, self.mat("lips", "#843a34", roughness=0.5, double_sided=True))
        self.add(blob("HairCap", hc + Vector((0, 0.03, 0.085)), (0.112, 0.112, 0.1), hair, (20, 12)), "head")
        self.add(blob("HairBack", hc + Vector((0, 0.058, 0.01)), (0.1, 0.07, 0.085), hair, (14, 10)), "head")
        # the hood: lying back on his shoulders, a gold rim, its point hanging down his back
        hz = 1.5
        self.add(kit.blob("HoodCowl", (0, 0.075, hz), (0.18, 0.11, 0.075), hood, segs=(22, 12)), ["chest", "neck"])
        self.add(kit.chain("HoodPoint", [Vector((0, 0.1, hz + 0.0)), Vector((0, 0.15, hz - 0.12)), Vector((0, 0.17, hz - 0.28)), Vector((0, 0.17, hz - 0.4))], [(0.13, 0.014), (0.115, 0.014), (0.09, 0.014), (0.014, 0.014)], hood, seg=8, side=(1, 0, 0)), "chest")
        rim = [Vector((0.15 * math.cos(a), 0.035 + 0.12 * math.sin(a), hz + 0.045)) for a in [0.25 + (math.pi - 0.5) * k / 20 for k in range(21)]]
        self.add(chain("HoodRim", rim, [0.007] * len(rim), gold, seg=6), ["chest", "neck"])

        # signature: the ring of keys: a big brass hoop through the right hand, six oversized keys fanned from its bottom,
        # a glowing amber gem hung among them
        h = self.hand_at(-1)
        c = h + Vector((-0.01, -0.02, -0.16))
        self.add(torus("KeyRing", c, 0.135, 0.017, brass, seg=(40, 8), axis=(0, 1, 0)), "hand.R")
        for k, a in enumerate((-1.12, -0.67, -0.22, 0.22, 0.67, 1.12)):
            dr = Vector((math.sin(a), 0, -math.cos(a)))
            p = c + dr * 0.135 + Vector((0, -0.012 + 0.005 * (k % 2), 0))
            side = Vector((dr.z, 0, -dr.x))
            ln = 0.16 + 0.03 * (k % 2)
            self.add(torus(f"KeyBow{k}", p + dr * 0.032, 0.03, 0.009, brass, seg=(32, 8), axis=(0, 1, 0)), "hand.R")
            self.add(kit.tube(f"KeyShaft{k}", p + dr * 0.062, p + dr * (0.062 + ln), [(0, 0.0095, 0.0095), (1, 0.0095, 0.0095)], brass, seg=8), "hand.R")
            for j, (t, w) in enumerate(((0.8, 0.03), (0.93, 0.04))):
                q = p + dr * (0.062 + ln * t) + side * w * 0.5
                self.add(kit.tube(f"KeyTooth{k}{j}", p + dr * (0.062 + ln * t), q + side * w * 0.5, [(0, 0.008, 0.007), (1, 0.008, 0.007)], brass, seg=6), "hand.R")
        gc = c + Vector((0, -0.01, -0.135 - 0.06))
        self.add(kit.tube("GemLoop", c + Vector((0, -0.01, -0.135)), gc + Vector((0, 0, 0.04)), [(0, 0.006, 0.006), (1, 0.006, 0.006)], gold, seg=6), "hand.R")
        self.add(kit.blob("Gem", gc, (0.046, 0.032, 0.072), gem, segs=(14, 10)), "hand.R")
        self.add(torus("GemRing", gc + Vector((0, 0, 0.01)), 0.04, 0.007, gold, seg=(24, 6), axis=(0, 1, 0)), "hand.R")
        # a small dark lantern with a gold frame hanging from his left hand
        hl = self.hand_at(1)
        lc = hl + Vector((0.07, -0.02, -0.2))
        self.add(kit.chain("LanternChain", [hl + Vector((0, 0, 0.0)), hl + Vector((0.04, -0.01, -0.08)), lc + Vector((0, 0, 0.09))], [0.005, 0.005, 0.005], gold, seg=5), "hand.L")
        self.add(kit.tube("LanternBody", lc + Vector((0, 0, -0.07)), lc + Vector((0, 0, 0.07)), [(0, 0.04, 0.04), (0.5, 0.05, 0.05), (1, 0.04, 0.04)], glass, seg=10), "hand.L")
        for k in range(4):
            a = k * math.pi / 2 + math.pi / 4
            d = Vector((math.cos(a), math.sin(a), 0))
            self.add(kit.tube(f"LanternBar{k}", lc + d * 0.044 + Vector((0, 0, -0.07)), lc + d * 0.044 + Vector((0, 0, 0.07)), [(0, 0.005, 0.005), (1, 0.005, 0.005)], gold, seg=5), "hand.L")
        self.add(kit.tube("LanternCap", lc + Vector((0, 0, 0.07)), lc + Vector((0, 0, 0.1)), [(0, 0.055, 0.055), (1, 0.014, 0.014)], iron, seg=10), "hand.L")
        self.add(kit.tube("LanternBase", lc + Vector((0, 0, -0.085)), lc + Vector((0, 0, -0.065)), [(0, 0.05, 0.05), (1, 0.05, 0.05)], iron, seg=10), "hand.L")
        self.joints_fill(neck=(skin, 0.04), shoulder=(coat, 0.052), elbow=(coat, 0.044), wrist=(glove, 0.034), knee=(cloth, 0.04))


# ============================================================================================ Pim and Pom
class TwinMythic(Twin):
    """
    Pim and Pom, the Changeling Twins (fighter): fae children, one body between them (same joints, head, pointed ears, hair,
    legs, boots, height and stance, so swapping in play changes only what they wear and hold). Each wears a short tunic in
    their colour with a hem of hanging leaves, a collar of small leaves, dark moss leggings, bark boots, bark bracers, a bark
    belt with a gold leaf clasp, and carries a small woven satchel on the back (instead of the backpack with a twin's head in
    it). Calm bright eyes, a small smile, pointed ears. Each twin's weapon glows in their colour.
    """

    FUSE = (("Face", "skin", ("only", "Head", "Nose", "Ear", "Cheek"), 0.0038, 7500, None, 9),
            ("Skin", "skin", ("Face",), 0.0045, 3000, None, 8),
            ("TunicBody", "tunic", (), 0.0052, 4200, None, 10),
            ("LegsBody", "legs", (), 0.0052, 2000, None, 10),
            ("Boots", "boot", (), 0.0052, 2200, None, 8),
            ("HairBody", "hair", (), 0.0048, 1400, None, 6))
    WRAP = (("Mouth", "Face", 0.003),)
    PAINT = {"skin": dict(warm=1.0), "tunic": dict(shadow=(0.62, 0.55, 0.5)), "leaf": dict(shadow=(0.6, 0.6, 0.5))}
    # tunic, leaf (hem), leaf2 (collar), headgear, headgear dark, glow
    TUNIC, LEAF, LEAF2, GEAR, GEAR2, GLOW = ("",) * 6
    KIND = ""

    def leaf(self, name, base, tip, width, mat, weights, side):
        self.add(kit.tube(name, base, tip, [(0, width * 0.35, 0.006), (0.45, width, 0.007), (1, 0.002, 0.002)], mat, seg=6, side=tuple(side)), weights)

    def gear_on(self, hc, gear, gear2, glow, bark):
        raise NotImplementedError

    def weapon(self, h):
        raise NotImplementedError

    def body(self):
        boot = self.mat("boot", "#3e2a1c", roughness=0.6)
        sole = self.mat("sole", "#241810", roughness=0.8)
        legs = self.mat("legs", "#2e3220", roughness=0.8)
        tunic = self.mat("tunic", self.TUNIC, roughness=0.7)
        leaf = self.mat("leaf", self.LEAF, roughness=0.7, double_sided=True)
        leaf2 = self.mat("leaf2", self.LEAF2, roughness=0.7, double_sided=True)
        gear = self.mat("gear", self.GEAR, roughness=0.6)
        gear2 = self.mat("geardark", self.GEAR2, roughness=0.6, double_sided=True)
        bark = self.mat("bark", "#4a3220", roughness=0.8)
        gold = self.mat("gold", "#d2ae55", metallic=0.7, roughness=0.3, double_sided=True)
        skin = self.mat("skin", "#d2a080", roughness=0.55)
        hair = self.mat("hair", "#6a3c1c", roughness=0.6)
        eyew = self.mat("eyewhite", "#fff8f0", roughness=0.4)
        iris = self.mat("iris", "#3a6a4a", roughness=0.2)
        ink = self.mat("ink", "#2a1c1c", roughness=0.4)
        weave = self.mat("weave", "#8a6a3a", roughness=0.9)
        weave2 = self.mat("weavedark", "#5a4220", roughness=0.9)
        J = self.J

        # legs: dark moss leggings, bark boots turned over at the top, dark soles
        for s, x in SIDES:
            X = J["leg_x"] * x
            self.add(tube(f"Thigh{s}", (X, 0, 0.54), (X, 0, 0.27), [(0, 0.058, 0.058), (1, 0.045, 0.045)], legs, seg=12), [f"thigh.{s}", f"shin.{s}", "pelvis"])
            self.add(tube(f"Shin{s}", (X, 0, 0.27), (X, 0, 0.1), [(0, 0.045, 0.045), (1, 0.038, 0.038)], legs, seg=12), [f"shin.{s}", f"thigh.{s}"])
            self.add(tube(f"BootShaft{s}", (X, 0, 0.19), (X, 0, 0.05), [(0, 0.058, 0.058), (1, 0.056, 0.056)], boot, seg=12), f"shin.{s}")
            self.add(band(f"BootCuff{s}", (X, 0, 0.19), 0.06, 0.01, gold, seg=(20, 6)), f"shin.{s}")
            pts = [(X, 0.03, 0.05), (X, -0.05, 0.052), (X, -0.13, 0.052), (X, -0.17, 0.05)]
            self.add(chain(f"BootToe{s}", pts, [(0.064, 0.05), (0.066, 0.05), (0.064, 0.05), (0.03, 0.026)], boot, seg=12), f"foot.{s}")
            self.add(blob(f"Sole{s}", (X, -0.06, 0.016), (0.07, 0.15, 0.016), sole, (16, 8)), f"foot.{s}")
        self.add(loft("Hips", [kit.ring_z(z, rx, ry) for z, rx, ry in [(0.6, 0.125, 0.1), (0.52, 0.14, 0.105), (0.44, 0.1, 0.08)]], legs, seg=20), ["pelvis", "thigh.L", "thigh.R"])
        # the tunic: a fitted body, a short skirt, a hem of hanging leaves, a bark belt with a gold leaf clasp
        self.add(loft("Torso", [kit.ring_z(z, rx, ry) for z, rx, ry in [(0.58, 0.128, 0.104), (0.68, 0.132, 0.11), (0.78, 0.13, 0.102), (0.86, 0.1, 0.08), (0.92, 0.045, 0.045)]], tunic, seg=22), ["chest", "pelvis"])
        skirt = short_skirt(J["hip"], J["knee"], 0.1)
        self.bell("TunicSkirt", [(0.6, 0.128, 0.104), (0.52, 0.16, 0.124), (0.46, 0.178, 0.136)], tunic, self.mat("tunicin", "#2a1e16", roughness=0.8, double_sided=True), n=24, weights=skirt)
        for k in range(18):
            a = 2 * math.pi * (k + 0.5) / 18
            base = Vector((0.178 * math.cos(a), 0.136 * math.sin(a), 0.47 + 0.012 * (k % 2)))
            out = Vector((math.cos(a), math.sin(a), 0)) * 0.018
            self.leaf(f"HemLeaf{k}", base, base + out + Vector((0, 0, -0.14 - 0.02 * (k % 2))), 0.032, leaf if k % 2 else leaf2, skirt, (-math.sin(a), math.cos(a), 0))
        self.add(loft("Belt", [kit.ring_z(0.585, 0.136, 0.112), kit.ring_z(0.625, 0.138, 0.114)], bark, seg=22), "pelvis")
        self.leaf("BeltClasp", Vector((0, -0.118, 0.6)), Vector((0, -0.124, 0.64)), 0.026, gold, "pelvis", (1, 0, 0))
        self.add(kit.blob("BeltClaspGem", (0, -0.126, 0.608), (0.012, 0.005, 0.012), gold, segs=(8, 6)), "pelvis")
        # a collar of small leaves round the neck and shoulders
        for k in range(12):
            a = 2 * math.pi * (k + 0.5) / 12
            base = Vector((0.08 * math.cos(a), 0.01 + 0.07 * math.sin(a), 0.905))
            tip = base + Vector((0.075 * math.cos(a), 0.07 * math.sin(a), -0.065))
            self.leaf(f"CollarLeaf{k}", base, tip, 0.03, leaf2 if k % 2 else leaf, "chest", (-math.sin(a), math.cos(a), 0))
        # arms: short tunic sleeves, bare forearms with bark bracers and gold rims
        self.arms(tunic, skin, skin, r=(0.048, 0.04, 0.036), hand=(0.045, 0.05, 0.066))
        for s, x in SIDES:
            sh, el, wr = self.shoulder_pts(x)
            f = (wr - el).normalized()
            self.add(tube(f"Bracer{s}", el.lerp(wr, 0.35), wr + f * 0.006, [(0, 0.043, 0.043), (1, 0.04, 0.04)], bark, seg=12, cap=(False, False)), f"forearm.{s}")
            self.add(band(f"BracerRim{s}", el.lerp(wr, 0.35), 0.044, 0.006, gold, seg=(18, 6), axis=f), f"forearm.{s}")
        # the head: big and round, big bright eyes, round cheeks, a small calm smile, long pointed ears
        hc = Vector((0, -0.02, 1.05))
        r = (0.145, 0.14, 0.142)
        self.head_shape(hc, r, skin, chin=0.68)
        for s, x in SIDES:
            self.add(blob(f"Cheek{s}", hc + Vector((0.09 * x, -0.112, -0.05)), (0.034, 0.016, 0.026), skin, (12, 8)), "head")
            self.add(kit.tube(f"EarPoint{s}", hc + Vector((0.13 * x, 0.012, -0.012)), hc + Vector((0.235 * x, 0.04, 0.085)), [(0, 0.03, 0.012), (0.5, 0.026, 0.011), (1, 0.002, 0.002)], skin, seg=8, side=(0, 1, 0)), "head")
            self.add(kit.blob(f"EarBase{s}", hc + Vector((0.136 * x, 0.012, -0.012)), (0.018, 0.028, 0.038), skin, segs=(10, 8)), "head")
        self.add(blob("Nose", hc + Vector((0, -0.14, -0.022)), (0.016, 0.016, 0.014), skin, (10, 8)), "head")
        self.eyes(hc, r, eyew, iris, eyew, spread=0.066, size=(0.037, 0.046), z=0.01)
        for s, x in SIDES:
            self.add(chain(f"Brow{s}", [hc + Vector((0.032 * x, -0.135, 0.062)), hc + Vector((0.07 * x, -0.127, 0.074)), hc + Vector((0.11 * x, -0.096, 0.058))], [0.005, 0.008, 0.003], ink, seg=8), "head")
        self.grin(hc, r, -0.58, 0.038, 0.012, 0.009, self.mat("lips", "#8a3028", roughness=0.5, double_sided=True))
        fringe = kit.spline([hc + Vector(v) for v in [(-0.125, -0.05, 0.075), (-0.07, -0.112, 0.103), (0.0, -0.132, 0.112), (0.07, -0.112, 0.103), (0.125, -0.05, 0.075)]], 11)
        self.add(kit.chain("Fringe", fringe, [(0.012, 0.012), (0.018, 0.016), (0.021, 0.018), (0.021, 0.019), (0.022, 0.02), (0.022, 0.02), (0.022, 0.02), (0.021, 0.019), (0.021, 0.019), (0.018, 0.016), (0.012, 0.012)], hair, seg=10, side=(0, 0, 1)), "head")
        self.add(blob("HairBack", hc + Vector((0, 0.06, 0.02)), (0.13, 0.085, 0.1), hair, (16, 10)), "head")
        self.gear_on(hc, gear, gear2, bark)

        # the woven satchel on the back (a strap over one shoulder), a gold leaf clasp on the flap
        def pack_w(p):
            return {"chest": 0.8, "pelvis": 0.2}
        pc = Vector((0, 0.2, 0.7))
        self.add(box("Satchel", pc, (0.3, 0.13, 0.26), weave, bevel=0.04, segments=3), pack_w)
        for k, z in enumerate((-0.07, -0.02, 0.03)):
            self.add(kit.box(f"SatchelWeave{k}", pc + Vector((0, 0.067, z)), (0.3, 0.006, 0.016), weave2, bevel=0.002, segments=1), pack_w)
        self.add(box("SatchelFlap", pc + Vector((0, 0.04, 0.1)), (0.3, 0.1, 0.07), weave2, bevel=0.02, segments=2), pack_w)
        self.leaf("SatchelClasp", pc + Vector((0, 0.1, 0.1)), pc + Vector((0, 0.1, 0.03)), 0.024, gold, pack_w, (1, 0, 0))
        pts = kit.spline([Vector((0.09, -0.07, 0.9)), Vector((0.1, 0.06, 0.88)), Vector((-0.02, 0.15, 0.74)), Vector((-0.1, 0.1, 0.62)), Vector((-0.12, -0.05, 0.66))], 12)
        self.add(kit.chain("SatchelStrap", pts, [(0.022, 0.008)] * 12, bark, seg=8), ["chest", "pelvis"])
        self.weapon(self.hand_at(-1))
        self.joints_fill(neck=(skin, 0.05), shoulder=(tunic, 0.05), elbow=(skin, 0.04), wrist=(skin, 0.034), knee=(legs, 0.045))


class PimMythic(TwinMythic):
    """Pim: an amber tunic and leaf hem, a bark acorn-cap helm with an amber leaf crest, and a wooden sword with a glowing amber edge."""

    TUNIC, LEAF, LEAF2, GEAR, GEAR2, GLOW = "#b0601e", "#c8782a", "#8a4a16", "#6e4a2a", "#4a2e18", "#ffa83a"

    def __init__(self):
        MobaFigure.__init__(self, "pim", self.J)

    def gear_on(self, hc, gear, gear2, bark):
        leaf = self.mats["leaf"]
        self.add(kit.blob("GearDome", hc + Vector((0, 0.006, 0.122)), (0.152, 0.152, 0.112), gear, segs=(26, 16)), "head")
        self.add(band("GearRim", hc + Vector((0, 0.006, 0.092)), 0.154, 0.016, gear2, seg=(36, 6)), "head")
        for k, z in enumerate((0.13, 0.17)):
            self.add(band(f"GearBand{k}", hc + Vector((0, 0.006, z)), 0.145 - 0.035 * k, 0.007, gear2, seg=(32, 5)), "head")
        self.add(kit.tube("GearStalk", hc + Vector((0, 0.006, 0.225)), hc + Vector((0, 0.006, 0.275)), [(0, 0.02, 0.02), (1, 0.012, 0.012)], gear2, seg=8), "head")
        for s, x in SIDES:
            a = hc + Vector((0.04 * x, 0.03, 0.205))
            self.leaf(f"GearLeaf{s}", a, a + Vector((0.07 * x, 0.15, 0.06)), 0.032, leaf, "head", (0.4 * x, 0, 1))

    def weapon(self, h):
        wood = self.mat("sword", "#6a4424", roughness=0.7)
        dark = self.mat("swordgrip", "#3a2414", roughness=0.7)
        gold = self.mats["gold"]
        glow = self.mat("swordglow", "#ffc060", roughness=0.2, emission=self.GLOW, strength=2.6)
        d = Vector((-0.42, -0.18, 0.89)).normalized()
        self.add(kit.tube("SwordGrip", h - d * 0.07, h + d * 0.08, [(0, 0.021, 0.021), (1, 0.021, 0.021)], dark, seg=10), "hand.R")
        self.add(kit.blob("SwordPommel", h - d * 0.085, (0.03, 0.03, 0.03), gold, segs=(10, 8)), "hand.R")
        g = h + d * 0.09
        side = Vector((0.89, 0, 0.42)).normalized()
        self.add(kit.tube("SwordGuard", g - side * 0.11, g + side * 0.11, [(0, 0.022, 0.022), (1, 0.022, 0.022)], gold, seg=10), "hand.R")
        self.add(kit.tube("SwordBlade", g, g + d * 0.62, [(0, 0.058, 0.016), (0.85, 0.054, 0.015), (1, 0.003, 0.003)], wood, seg=8, side=side), "hand.R")
        for f in (-1, 1):
            self.add(kit.tube(f"SwordEdge{f}", g + d * 0.03 + side * f * 0.054, g + d * 0.58 + side * f * 0.05, [(0, 0.013, 0.013), (1, 0.004, 0.004)], glow, seg=6), "hand.R")


class PomMythic(TwinMythic):
    """Pom: a deep blue tunic and leaf hem, a blue leaf hood with a glowing bead on its point (the pointed ears out at the sides), and a slingshot with a glowing blue band and stone."""

    TUNIC, LEAF, LEAF2, GEAR, GEAR2, GLOW = "#2a6a98", "#3a86b8", "#1e4e72", "#2a6a98", "#1c4a6a", "#4ab8ff"

    def __init__(self):
        MobaFigure.__init__(self, "pom", self.J)

    def gear_on(self, hc, gear, gear2, bark):
        glow = self.mat("hoodbead", "#9ad8ff", roughness=0.2, emission=self.GLOW, strength=2.2)
        gold = self.mats["gold"]
        self.add(kit.blob("GearMass", hc + Vector((0, 0.05, 0.02)), (0.158, 0.14, 0.155), gear, segs=(26, 16)), "head")
        ring = []
        for j in range(33):
            a = 2 * math.pi * j / 32
            ring.append(hc + Vector((0.137 * math.cos(a), -0.055 + 0.022 * math.sin(a), 0.012 + 0.137 * math.sin(a))))
        self.add(kit.chain("GearEdge", ring, [0.026] * 33, gear2, seg=8, side=(0, 1, 0)), "head")
        tip = kit.spline([hc + Vector(v) for v in [(0, 0.08, 0.13), (0, 0.11, 0.21), (0, 0.17, 0.235), (0, 0.235, 0.2)]], 8)
        self.add(kit.chain("GearTip", tip, [(0.066, 0.066), (0.056, 0.056), (0.046, 0.046), (0.038, 0.038), (0.03, 0.03), (0.022, 0.022), (0.016, 0.016), (0.008, 0.008)], gear, seg=12, side=(1, 0, 0)), "head")
        self.add(kit.blob("GearBead", tip[-1], (0.03, 0.03, 0.03), glow, segs=(12, 8)), "head")
        self.add(band("GearBeadRing", tip[-1], 0.032, 0.006, gold, seg=(16, 5), axis=(0, 1, 0.2)), "head")

    def weapon(self, h):
        wood = self.mat("sling", "#4a3020", roughness=0.7)
        gold = self.mats["gold"]
        band_m = self.mat("slingband", "#7ac8ff", roughness=0.3, emission=self.GLOW, strength=2.0)
        leather = self.mat("slingpouch", "#2c1c10", roughness=0.7)
        stone = self.mat("stone", "#aee4ff", roughness=0.2, emission=self.GLOW, strength=2.4)
        d = Vector((-0.42, -0.18, 0.89)).normalized()
        side = Vector((0.89, 0, 0.42)).normalized()
        fork = h + d * 0.16
        self.add(kit.tube("SlingGrip", h - d * 0.08, fork, [(0, 0.024, 0.024), (1, 0.027, 0.027)], wood, seg=10), "hand.R")
        self.add(band("SlingGripBand", h + d * 0.1, 0.028, 0.006, gold, seg=(14, 5), axis=d), "hand.R")
        tips = []
        for f in (-1, 1):
            pts = kit.spline([fork, fork + d * 0.09 + side * f * 0.085, fork + d * 0.24 + side * f * 0.125, fork + d * 0.34 + side * f * 0.13], 8)
            self.add(kit.chain(f"SlingArm{f}", pts, [0.027, 0.026, 0.025, 0.024, 0.023, 0.022, 0.023, 0.018], wood, seg=8), "hand.R")
            tips.append(pts[-2])
        pouch = fork + d * 0.14 + Vector((0, 0.1, 0))
        for k, t in enumerate(tips):
            self.add(kit.chain(f"SlingBand{k}", [t, t.lerp(pouch, 0.5) + Vector((0, 0, -0.012)), pouch], [0.014, 0.012, 0.014], band_m, seg=6), "hand.R")
        self.add(kit.blob("SlingPouch", pouch, (0.044, 0.018, 0.032), leather, segs=(12, 8)), "hand.R")
        self.add(kit.blob("SlingStone", pouch + Vector((0, -0.012, 0.004)), (0.028, 0.028, 0.028), stone, segs=(10, 8)), "hand.R")


def register(FIGURES):
    FIGURES["mole_v3"] = MoleMythic
    FIGURES["yarn_v3"] = YarnMythic
    FIGURES["sheep_v3"] = SheepMythic
    FIGURES["magic_v3"] = MagicMythic
    FIGURES["door_v3"] = DoorMythic
    FIGURES["pim_v3"] = PimMythic
    FIGURES["pom_v3"] = PomMythic
