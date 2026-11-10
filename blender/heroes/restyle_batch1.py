"""Restyle batch 1 (pipeline/designs/heroes-restyle.md): Silvane, Bram, Hank, Professor Puff, Sir Whiskers. Loaded by moba_figures._restyle_batches()."""
from moba_figures import *  # noqa: F401,F403  (MobaFigure, the helpers, kit, figure_kit, math, Vector, Euler, the old classes)


class _Restyle:
    """Redresses an old figure class: OVR = {material part: (colour, extra material args)} replaces the colours it asks for,
    drop() removes the parts of the old look after the old body() has built, tilt() turns the parts of one weight."""

    OVR = {}

    def mat(self, part, color, **kw):
        if part in self.OVR:
            color, extra = self.OVR[part]
            kw = {**kw, **extra}
        return super().mat(part, color, **kw)

    def drop(self, *prefixes):
        keep = []
        for ob, w in self.parts:
            if ob.name.startswith(prefixes):
                bpy.data.objects.remove(ob, do_unlink=True)
            else:
                keep.append((ob, w))
        self.parts = keep

    def drop_chains(self, *names):
        self.chains = [c for c in self.chains if c[0] not in names]

    def tilt(self, parts, deg, pivot_z):
        m = Matrix.Translation((0, 0, pivot_z)) @ Matrix.Rotation(math.radians(deg), 4, "X") @ Matrix.Translation((0, 0, -pivot_z))
        for ob, _ in parts:
            kit.transform(ob, m)


class MirrorMythic(_Restyle, Mirror):
    """
    Silvane, the Mirror Duchess (marksman): a floor-length gown in dark violet with a silver front panel and a gold hem,
    a silver-violet bodice, dark opera gloves, a small calm smile and sleek violet hair swept back in one smooth fall.
    Signature: a standing collar of mirror shards fanned behind her head, and the hand mirror held out in her right hand,
    its pale blue glass the one glowing piece.
    """

    OVR = {
        "gown": ("#34285c", dict(metallic=0.3, roughness=0.4)),
        "lining": ("#1a1432", {}),
        "bodice": ("#7b789f", dict(metallic=0.4, roughness=0.34)),
        "collar": ("#a3abc2", dict(metallic=0.5, roughness=0.28, double_sided=True)),
        "collarin": ("#4a3a82", {}),
        "glove": ("#4c4372", {}),
        "bow": ("#4b3a8a", {}),
        "boot": ("#1f1a33", {}),
        "legs": ("#34285c", {}),
        "glass": ("#5a94c8", dict(roughness=0.1, emission="#a8d8ff", strength=0.9)),
        "skin": ("#e2bda8", {}),
        "hair": ("#3f2d78", dict(roughness=0.42)),
        "hairroll": ("#4f3b90", {}),
        "lid": ("#6a4fa8", {}),
        "lips": ("#a23a62", {}),
        "iris": ("#4aa8e8", dict(roughness=0.2, emission="#4aa8e8", strength=0.7)),
    }
    PAINT = {"skin": dict(warm=0.7), "hair": dict(shadow=(0.5, 0.42, 0.85)), "gown": dict(shadow=(0.5, 0.45, 0.8)),
             "bodice": dict(shadow=(0.6, 0.62, 0.9))}

    def body(self):
        super().body()
        J = self.J
        # the old look out: sequin mirrors, the bow, the pendant and earrings, the fan collar, the hair tower, the long nose
        self.drop("Sequin", "BowKnot", "BowLoop", "BowTail", "Pendant", "Earring", "Collar", "HairTower", "HairBun", "Strand", "HairPin",
                  "NoseBridge", "CurlFront")
        self.drop_chains("bowL", "bowR")
        trim = self.mat("trim", "#a3abc2", metallic=0.5, roughness=0.3, double_sided=True)
        gold = self.mat("gold", "#e6b840", metallic=0.75, roughness=0.26)
        glassin = self.mat("shardglass", "#5a4a98", roughness=0.25, metallic=0.3)
        skin = self.mat("skin", "#e2bda8", roughness=0.5)
        hair = self.mat("hair", "#3f2d78", roughness=0.42)
        skirt = short_skirt(J["hip"], J["knee"], 0.14)
        # a silver front panel down the gown with gold edges
        front = [Vector(v) for v in [(0, -0.097, 1.1), (0, -0.14, 0.98), (0, -0.194, 0.62), (0, -0.24, 0.24), (0, -0.265, 0.1)]]
        self.add(chain("SkirtPanel", front, [(0.045, 0.007), (0.06, 0.007), (0.085, 0.007), (0.12, 0.007), (0.135, 0.007)], trim, seg=8), skirt)
        for s, x in SIDES:
            self.add(chain(f"SkirtEdge{s}", [p + Vector((q * x, -0.005, 0)) for p, q in zip(front, (0.047, 0.062, 0.087, 0.122, 0.137))], [0.0065] * 5, gold, seg=6), skirt)
        # the head parts built so far are tipped back 18 degrees: bring them to 5
        old = [(ob, w) for ob, w in self.parts if w == "head"]
        self.tilt(old, 13, J["head"])
        first = len(self.parts)
        hc = Vector((0, -0.005, 1.725))
        r = (0.116, 0.122, 0.14)
        self.add(blob("Nose", hc + Vector((0, -0.118, -0.03)), (0.014, 0.016, 0.017), skin, (10, 8)), "head")
        # sleek hair: swept back off the brow and down the back in one broad smooth fall
        fall = [hc + Vector(v) for v in [(0, 0.085, -0.02), (0, 0.125, -0.1), (0, 0.15, -0.26), (0, 0.17, -0.46), (0, 0.17, -0.6)]]
        self.add(chain("HairFall", fall, [(0.085, 0.05), (0.09, 0.055), (0.085, 0.05), (0.07, 0.042), (0.012, 0.01)], hair, seg=12), ["head", "chest"])
        # the mirror-shard collar: eight flat silver shards fanned behind her head, a violet glass inlay on each, a gold socket at each foot
        for k, phi_d in enumerate((-66, -48, -30, -12, 12, 30, 48, 66)):
            phi = math.radians(phi_d)
            length = 0.46 - 0.003 * abs(phi_d) * 1.05
            base = Vector((0.115 * math.sin(phi) * 1.1, 0.075, 1.5))
            d = Vector((math.sin(phi) * 0.9, 0.3, math.cos(phi))).normalized()
            side = Vector((math.cos(phi), 0, -math.sin(phi) * 0.9)).normalized()
            tip = base + d * length
            self.add(tube(f"CollarShard{k}", base, tip, [(0, 0.03, 0.007), (0.4, 0.056, 0.007), (0.8, 0.04, 0.006), (1, 0.004, 0.004)], trim, seg=6, side=side), "chest")
            self.add(tube(f"CollarInlay{k}", base + d * 0.04, base + d * length * 0.8, [(0, 0.018, 0.005), (0.4, 0.036, 0.005), (1, 0.003, 0.003)], glassin, seg=6, side=side), "chest")
            self.add(band(f"CollarSocket{k}", base, 0.022, 0.007, gold, seg=(14, 5), axis=d), "chest")
        self.tilt(self.parts[first:], -5, J["head"])


class MasonMythic(_Restyle, Mason):
    """
    Bram, the Stonewright (bruiser): a temple mason, as broad as before. A dark warm tunic with rolled sleeves, a deep
    brown leather apron with a gold hem and gold-bound tools, leather bracers on the big forearms, a gold gorget, iron-grey
    cropped hair and a calm square-jawed face. Signature: carved limestone pauldrons in thin gold-edged lames, a
    rune-cut stone maul in the right fist, and a glowing amber rune in a gold ring on the chest.
    """

    OVR = {
        "shirt": ("#40383a", {}),
        "roll": ("#5f544c", {}),
        "trousers": ("#2b2a2d", {}),
        "boot": ("#241d1a", {}),
        "bootcap": ("#4a4540", {}),
        "leather": ("#6a4222", {}),
        "leatherdark": ("#2f1f14", {}),
        "hair": ("#6c665e", {}),
        "mallet": ("#69645c", dict(roughness=0.85)),
        "malletend": ("#7d786e", dict(roughness=0.85)),
        "haft": ("#503420", {}),
        "iron": ("#c9a24a", dict(metallic=0.7, roughness=0.3)),
        "steel": ("#8c9096", dict(metallic=0.6, roughness=0.35)),
        "skin": ("#c08a64", {}),
    }
    PAINT = {"skin": dict(warm=1.0), "leather": dict(shadow=(0.6, 0.45, 0.4)), "shirt": dict(shadow=(0.6, 0.55, 0.6)), "stone": dict(shadow=(0.6, 0.6, 0.66))}

    def body(self):
        super().body()
        J = self.J
        self.drop("DustPalm", "DustFinger", "Pencil", "Kerchief", "Teeth", "Mouth", "Nose", "ApronHem")
        gold = self.mat("brass", "#d8a838", metallic=0.7, roughness=0.3)
        gold2 = self.mat("gold", "#d2ae55", metallic=0.7, roughness=0.3, double_sided=True)
        stone = self.mat("stone", "#8a8476", roughness=0.85)
        leatherdark = self.mat("leatherdark", "#2f1f14", roughness=0.75, double_sided=True)
        skin = self.mat("skin", "#c08a64", roughness=0.6)
        rune = self.mat("rune", "#ffb347", roughness=0.15, emission="#ff9a2a", strength=2.4)
        hc = Vector((0, -0.035, 1.635))
        r = (0.135, 0.132, 0.15)
        skirt = short_skirt(J["hip"], J["knee"], 0.2)
        front = -math.pi / 2
        # the apron's hem bound in gold
        hem = [(0.53, 0.383, 0.333, -0.03), (0.48, 0.388, 0.338, -0.032)]
        self.add(arc_shell("ApronHem", hem, front - 1.27, front + 1.27, gold2, thick=0.014, seg=40), skirt)
        # a small calm face: a small nose and a closed, level mouth
        self.face(hc, r, skin, self.mat("lips", "#6e3a2c", roughness=0.5), nose=0.017, smile=0.004, width=0.03, z=-0.5, out=0.003)
        # a gold gorget at the throat
        self.add(torus("Gorget", (0, 0.0, 1.475), 0.125, 0.022, gold, seg=(32, 8)), ["chest", "neck"])
        # carved limestone pauldrons: two thin lames on each shoulder, a gold plate under each so a gold edge shows
        for s, x in SIDES:
            def plate_w(p, arm=f"upper_arm.{s}"):
                return {"chest": 0.3, arm: 0.7}
            for k, (c, rad, tilt) in enumerate((((0.335, 0.02, 1.5), (0.14, 0.16, 0.03), 0.4), ((0.425, 0.02, 1.43), (0.12, 0.145, 0.028), 0.85))):
                cen = Vector((c[0] * x, c[1], c[2]))
                rot = Euler((0, tilt * x, 0))
                self.add(kit.blob(f"PlateGold{s}{k}", cen - Vector((0.003 * x, 0, 0.007)), (rad[0] + 0.013, rad[1] + 0.013, rad[2]), gold, segs=(28, 10), rotation=rot), plate_w)
                self.add(kit.blob(f"Plate{s}{k}", cen, rad, stone, segs=(28, 10), rotation=rot), plate_w)
            # leather bracers with gold bands on the huge forearms
            sh, el, wr = self.shoulder_pts(x)
            a, b = el.lerp(wr, 0.42), el.lerp(wr, 0.9)
            self.add(tube(f"Bracer{s}", a, b, [(0, 0.142, 0.138), (0.5, 0.124, 0.12), (1, 0.101, 0.098)], leatherdark, seg=18, cap=(False, False)), f"forearm.{s}")
            for k, (p, rad) in enumerate(((a, 0.144), (b, 0.103))):
                self.add(band(f"BracerRim{s}{k}", p, rad, 0.009, gold, seg=(26, 6), axis=wr - el), f"forearm.{s}")
        # the glowing amber rune in a gold ring on the chest, flat on the apron bib
        cc = Vector((0, -0.318, 1.24))
        self.add(torus("RuneRing", cc, 0.092, 0.014, gold, seg=(36, 8), axis=(0, 1, 0)), "chest")
        self.add(blob("RuneDisc", cc + Vector((0, 0.002, 0)), (0.084, 0.012, 0.084), rune, (24, 8)), "chest")
        glyph = [((0, 0.062), (0, -0.062)), ((0, 0.024), (-0.044, 0.06)), ((0, 0.024), (0.044, 0.06)), ((0, -0.012), (-0.04, -0.054)), ((0, -0.012), (0.04, -0.054))]
        for k, (p0, p1) in enumerate(glyph):
            self.add(tube(f"RuneLine{k}", cc + Vector((p0[0], -0.012, p0[1])), cc + Vector((p1[0], -0.012, p1[1])), [(0, 0.008, 0.007), (1, 0.008, 0.007)], leatherdark, seg=6), "chest")
        # gold-bound tools: a gold band on the chisel handle's loop is already there; add a gold cap on the haft end of the maul
        h = self.hand_grip(-1)
        d = Vector((-0.45, -0.1, 0.89)).normalized()
        self.add(band("MaulFoot", h - d * 0.2, 0.034, 0.01, gold, seg=(14, 6), axis=d), "hand.R")


class TimberMythic(_Restyle, Timber):
    """
    Hank, the Moss Hewer (bruiser): a huge forest warden. Moss-green woven tunic and bark-brown leather leggings with
    leather wraps, dark boots, brown leather straps in place of suspenders, a fur mantle heaped round his shoulders, bare
    brown hair with a thick braid down his back, and the same huge beard, now with two braids tied in brass.
    Signature: the huge double-bitted axe, its steel dark and its two cutting edges glowing green.
    """

    OVR = {
        "plaidred": ("#40583a", {}),
        "plaidblack": ("#374e32", {}),
        "jeans": ("#3d3023", {}),
        "jeansdark": ("#2c2218", {}),
        "turnup": ("#6b5636", {}),
        "boot": ("#2a1c10", {}),
        "belt": ("#2a1a10", {}),
        "suspenders": ("#4a3220", {}),
        "skin": ("#cf9468", {}),
        "beard": ("#6e4020", dict(roughness=0.85)),
        "axesteel": ("#59616b", dict(metallic=0.55, roughness=0.35)),
        "axeedge": ("#8ff0a0", dict(metallic=0.2, roughness=0.15, emission="#3ad868", strength=2.4)),
        "haft": ("#6a4424", {}),
        "haftpaint": ("#c9a24a", dict(metallic=0.6, roughness=0.35)),
    }
    FUSE = Timber.FUSE + (("Fur", "fur", (), 0.006, 3200, None, 12),)
    PAINT = {"skin": dict(warm=1.0), "beard": dict(shadow=(0.62, 0.42, 0.34)), "jeans": dict(shadow=(0.6, 0.5, 0.45)), "fur": dict(shadow=(0.6, 0.5, 0.45))}

    def body(self):
        super().body()
        J = self.J
        # the old look out: the woolly hat, the red nose, the moustache, the mouth, the buttons
        self.drop("Hat", "Bobble", "NoseBall", "Moustache", "Mouth", "Button", "AxeEdge")
        fur = self.mat("fur", "#6e5a44", roughness=0.95)
        braid = self.mat("braid", "#6e4020", roughness=0.85)
        brass = self.mat("brass", "#d8a838", metallic=0.7, roughness=0.3)
        hair = self.mat("hair", "#6a3c1c", roughness=0.8)
        belt = self.mat("belt", "#2a1a10", roughness=0.7)
        skin = self.mat("skin", "#cf9468", roughness=0.6)
        hc = Vector((0, -0.05, 1.735))
        self.add(blob("Nose", hc + Vector((0, -0.132, -0.036)), (0.02, 0.022, 0.024), skin, (10, 8)), "head")
        # bare brown hair: a cap, and a thick braid down his back
        self.add(blob("HairCap", hc + Vector((0, 0.03, 0.055)), (0.138, 0.136, 0.125), hair, (22, 14), keep=lambda co: co.z > hc.z + 0.03 or co.y > hc.y + 0.02), "head")
        self.add(band("BrowBand", (0, hc.y + 0.012, hc.z + 0.06), 0.139, 0.01, belt, seg=(32, 6)), "head")
        path = [hc + Vector(v) for v in [(0, 0.12, -0.05), (0, 0.16, -0.2), (0, 0.19, -0.36), (0, 0.2, -0.52)]]
        for i in range(10):
            u = i / 9
            k = int(u * 3.0)
            f = u * 3.0 - k
            c = path[min(k, 2)].lerp(path[min(k + 1, 3)], f)
            self.add(kit.blob(f"BackBraid{i}", c + Vector((0.012 * (1 if i % 2 else -1), 0, 0)), (0.045 - 0.0025 * i, 0.04, 0.05), braid, segs=(14, 8)), ["head", "chest"])
        self.add(band("BackBraidTie", path[3] + Vector((0, 0, -0.04)), 0.03, 0.01, brass, seg=(14, 5)), ["head", "chest"])
        # two braids down the front of the beard, tied in brass
        for s, x in SIDES:
            top = Vector((0.07 * x, hc.y - 0.2, 1.5))
            for i in range(9):
                u = i / 8
                p = top + Vector((-0.02 * x * u, -0.1 * u - 0.03 * math.sin(u * 3.1), -0.4 * u))
                self.add(kit.blob(f"BeardBraid{s}{i}", p + Vector((0.012 * (1 if i % 2 else -1), 0, 0)), (0.035 - 0.0015 * i, 0.034, 0.04), braid, segs=(12, 8)), "chest")
            self.add(band(f"BraidTie{s}", top + Vector((-0.02 * x, -0.13, -0.42)), 0.028, 0.009, brass, seg=(14, 5)), "chest")
        # the fur mantle: puffs heaped round the neck and over the shoulders, wider than the shoulders
        def mantle_w(p):
            a = 0.45 * figure_kit.smooth(0.16, 0.34, abs(p.x))
            return {"chest": 1 - a, f"upper_arm.{'L' if p.x > 0 else 'R'}": a}
        puffs = []
        for k in range(10):
            a = -0.2 + (math.pi + 0.4) * k / 9
            rr = 0.3 + 0.015 * math.sin(k * 1.9)
            puffs.append(((rr * math.cos(a), -0.005 + 0.215 * math.sin(a), 1.56 + 0.02 * math.cos(k * 2.3)), 0.082 + 0.014 * ((k * 5) % 3)))
        for s, x in SIDES:
            puffs += [((0.4 * x, 0.02, 1.55), 0.088), ((0.46 * x, 0.03, 1.49), 0.07)]
        for k, (c, rad) in enumerate(puffs):
            self.add(kit.blob(f"FurPuff{k}", c, (rad * 1.1, rad, rad * 0.85), fur, segs=(18, 12)), mantle_w)

        # the axe's two cutting edges, thicker than before, glowing green, and a rune on each blade
        edge = self.mat("axeedge", "#8ff0a0", metallic=0.2, roughness=0.15, emission="#3ad868", strength=2.4)
        h = self.hand_grip(-1)
        d = Vector((-0.2, -0.015, 0.98)).normalized()
        c = h + d * 1.1
        M = Matrix.Translation(c) @ Matrix.Rotation(math.atan2(d.x, d.z), 4, "Y")
        strip = [(0.4, 0.262), (0.445, 0.19), (0.475, 0.1), (0.487, 0.0), (0.475, -0.1), (0.445, -0.19), (0.4, -0.262)]
        for f in (1, -1):
            e = kit.chain(f"AxeEdgeGlow{f}", [Vector((u * f, 0, v)) for u, v in strip], [(0.008, 0.03), (0.03, 0.03), (0.036, 0.032), (0.04, 0.034), (0.036, 0.032), (0.03, 0.03), (0.008, 0.03)], edge, seg=8, side=(1, 0, 0))
            kit.transform(e, M)
            self.add(e, "hand.R")
            for yy in (-1, 1):
                for k, (a, b) in enumerate((((0.3, 0.07), (0.3, -0.07)), ((0.3, 0.0), (0.37, 0.05)), ((0.3, 0.0), (0.37, -0.05)))):
                    r_ = kit.tube(f"AxeRune{f}{yy}{k}", Vector((a[0] * f, 0.02 * yy, a[1])), Vector((b[0] * f, 0.02 * yy, b[1])), [(0, 0.011, 0.007), (1, 0.011, 0.007)], edge, seg=6)
                    kit.transform(r_, M)
                    self.add(r_, "hand.R")


class BalloonMythic(_Restyle, Balloon):
    """
    Professor Puff, the Aeronaut (mage): an alchemist of the air, small and round as before. A long aubergine coat with
    brass buttons and a brass-bound hem, dark leggings and brown shoes, silver wild side hair, big calm eyes and a small
    mouth, brass goggles pushed up on his brow, a brass gas tank on his back with its hose to a nozzle in his right hand.
    Signature: four glass gas spheres glowing rose pink, each in a brass cradle on a chain, floating above and beside his
    head where the balloons were.
    """

    OVR = {
        "coat": ("#3a2540", {}),
        "coatskirt": ("#33203a", {}),
        "lining": ("#1c1220", {}),
        "pocket": ("#4a3150", {}),
        "belt": ("#2a1a10", {}),
        "legs": ("#2a2434", {}),
        "shoe": ("#2a1a12", {}),
        "skin": ("#e4b08c", {}),
        "hair": ("#9a98a0", dict(roughness=0.9)),
        "hose": ("#2a2a32", {}),
    }
    PAINT = {"skin": dict(warm=1.0), "coat": dict(shadow=(0.62, 0.5, 0.72)), "coatskirt": dict(shadow=(0.62, 0.5, 0.72))}

    def body(self):
        super().body()
        J = self.J
        self.drop("BowKnot", "BowWing", "Mouth", "Teeth", "Nose", "Goggle", "String", "Balloon", "BeltKnot")
        self.drop_chains("balloon0", "balloon1", "balloon2", "balloon3", "balloon4")
        brass = self.mat("brass", "#d8a032", metallic=0.75, roughness=0.28)
        skin = self.mat("skin", "#e4b08c", roughness=0.55)
        smoke = self.mat("smoke", "#3a2a30", roughness=0.15, metallic=0.2)
        gas = self.mat("gas", "#ff5c9c", roughness=0.1, emission="#ff3f8a", strength=1.5)
        skirt = short_skirt(J["hip"], J["knee"], 0.22)
        hc = Vector((0, -0.03, 1.29))
        r = (0.165, 0.158, 0.16)
        # a calm small face
        self.face(hc, r, skin, self.mat("lips", "#8a4036", roughness=0.5), nose=0.017, smile=0.004, width=0.03, z=-0.56, out=0.003)
        # a brass-bound hem and three more buttons down the long coat
        z0, rx, ry = 0.38, 0.395, 0.37
        pts = [Vector(((rx + 0.006) * math.cos(a), (ry + 0.006) * math.sin(a), z0)) for a in (2 * math.pi * k / 48 for k in range(49))]
        self.add(chain("Hem", pts, [0.012] * len(pts), brass, seg=6), skirt)
        for k, (z, y) in enumerate(((0.58, -0.344), (0.48, -0.364), (0.4, -0.378))):
            self.add(kit.blob(f"CoatButton{k}", (0, y, z), (0.02, 0.009, 0.02), brass, segs=(10, 6)), skirt)
        # the goggles pushed up on his brow: a strap round the head, two brass rims with smoked glass
        zz = hc.z + 0.105
        strap = [Vector((0.168 * math.cos(a), hc.y + 0.004 + 0.162 * math.sin(a), zz)) for a in (-0.5 + (math.pi + 1.0) * k / 20 for k in range(21))]
        self.add(kit.chain("GoggleStrap", strap, [(0.008, 0.02)] * 21, self.mat("strap", "#2c2420", roughness=0.7), seg=8, side=(1, 0, 0)), "head")
        for s, x in SIDES:
            c = Vector((0.07 * x, hc.y - 0.158 * 0.74, zz + 0.012))
            n = Vector((0.3 * x, -1, 0.75)).normalized()
            self.add(torus(f"GoggleRim{s}", c, 0.058, 0.016, brass, seg=(32, 8), axis=n), "head")
            self.add(kit.blob(f"GoggleGlass{s}", c, (0.054, 0.054, 0.01), smoke, segs=(16, 6), rotation=n.to_track_quat("Z", "Y").to_euler()), "head")
        self.add(tube("GoggleBridge", hc + Vector((-0.02, -0.152, 0.12)), hc + Vector((0.02, -0.152, 0.12)), [(0, 0.01, 0.01), (1, 0.01, 0.01)], brass, seg=8), "head")
        # signature: glowing glass gas spheres in brass cradles on chains from the belt, floating above and beside his head
        specs = [(0.34, -0.08, 0.72, 0.52, 0.0, 1.5, 0.12), (0.32, 0.05, 0.72, 0.6, 0.08, 1.78, 0.135),
                 (-0.34, 0.02, 0.72, -0.52, 0.04, 1.56, 0.125), (-0.31, 0.1, 0.72, -0.6, 0.14, 1.86, 0.14)]
        for k, (bx, by, bz, tx, ty, tz, rad) in enumerate(specs):
            base, top = Vector((bx, by, bz)), Vector((tx, ty, tz - rad - 0.06))
            sg = 1 if bx > 0 else -1
            pts = [base, base.lerp(top, 0.34) + Vector((0.03 * sg, 0, 0)), base.lerp(top, 0.68) + Vector((-0.015 * sg, 0, 0)), top]
            bones = self.sway(f"gas{k}", "pelvis", pts)
            self.add(kit.chain(f"GasChain{k}", pts, [0.008] * 4, brass, seg=6), bones)
            c = Vector((tx, ty, tz))
            bone = bones[-1]
            self.add(kit.blob(f"GasSphere{k}", c, (rad, rad, rad), gas, segs=(20, 14)), bone)
            self.add(band(f"GasCradle{k}", c - Vector((0, 0, rad * 0.55)), rad * 0.84, 0.01, brass, seg=(24, 6)), bone)
            self.add(band(f"GasCradleTop{k}", c + Vector((0, 0, rad * 0.55)), rad * 0.84, 0.01, brass, seg=(24, 6)), bone)
            self.add(kit.tube(f"GasFoot{k}", c - Vector((0, 0, rad * 0.9)), c - Vector((0, 0, rad + 0.05)), [(0, 0.03, 0.03), (1, 0.012, 0.012)], brass, seg=8), bone)
            self.add(kit.blob(f"GasCap{k}", c + Vector((0, 0, rad + 0.01)), (0.026, 0.026, 0.02), brass, segs=(10, 6)), bone)
            self.add(kit.blob(f"BeltRing{k}", base, (0.022, 0.022, 0.022), brass, segs=(8, 6)), "pelvis")


class CatMythic(_Restyle, Cat):
    """
    Sir Whiskers, the Lynx Duelist (assassin): the cat as a fencer. A tawny lynx-coloured head with dark ear tufts, a
    cream muzzle, dark stripes and half-closed gold-green eyes, in dark gunmetal plate with gold edges and filigree
    lines, a short wine-red cape over the shoulders and no plume. Signature: a long striped tail curling up behind him
    like a question mark, and a long rapier in the right paw with a glowing amber gem in its guard.
    """

    OVR = {
        "fur": ("#c68a4a", dict(roughness=0.85)),
        "stripe": ("#5e3414", dict(roughness=0.85, double_sided=True)),
        "cream": ("#e2d2b2", {}),
        "pink": ("#d48a98", {}),
        "plate": ("#3c4458", dict(metallic=0.6, roughness=0.28)),
        "plate2": ("#465068", dict(metallic=0.6, roughness=0.28)),
        "boot": ("#2a2e3a", dict(metallic=0.5, roughness=0.3)),
        "under": ("#22242e", {}),
        "gold": ("#d2ae55", dict(metallic=0.75, roughness=0.26)),
        "whisker": ("#d6d2c6", {}),
        "eyewhite": ("#a8c850", dict(roughness=0.25)),
        "blade": ("#cfd8e2", dict(metallic=0.6, roughness=0.18)),
    }
    PAINT = {"fur": dict(warm=0.5, shadow=(0.8, 0.62, 0.55)), "plate": dict(shadow=(0.6, 0.62, 0.8))}

    def body(self):
        super().body()
        J = self.J
        # the old look out: the red plume, the fish emblem
        self.drop("Plume", "Fish", "SwordBlade")
        gold = self.mat("gold", "#d2ae55", metallic=0.75, roughness=0.26)
        dark = self.mat("dark", "#2a1a14", roughness=0.5)
        cape = self.mat("cape", "#5a1f2e", roughness=0.7)
        gem = self.mat("gem", "#ffc060", roughness=0.1, emission="#ffa028", strength=2.4)
        steel = self.mat("blade", "#cfd8e2", metallic=0.6, roughness=0.18)
        hc = Vector((0, -0.02, 1.32))
        # lynx tufts on the ear tips
        for s, x in SIDES:
            tip = hc + Vector((0.175 * x, 0.02, 0.33))
            self.add(tube(f"EarTuft{s}", tip - Vector((0, 0, 0.015)), tip + Vector((0.012 * x, 0.0, 0.1)), [(0, 0.018, 0.012), (1, 0.002, 0.002)], dark, seg=6, side=(1, 0, 0)), "head")
        # gold filigree on the breastplate: a ridge down the middle, two curls across the chest, a ring at the waist
        ridge = [Vector(v) for v in [(0, -0.162, 1.04), (0, -0.172, 0.94), (0, -0.178, 0.84), (0, -0.172, 0.74)]]
        self.add(chain("BreastRidge", ridge, [0.006] * 4, gold, seg=6), "chest")
        for s, x in SIDES:
            curl = [Vector(v) for v in [(0.01 * x, -0.17, 0.97), (0.06 * x, -0.176, 0.99), (0.1 * x, -0.17, 0.95), (0.1 * x, -0.164, 0.9), (0.07 * x, -0.166, 0.87)]]
            self.add(chain(f"BreastCurl{s}", curl, [0.0055] * 5, gold, seg=6), "chest")
        self.add(torus("BreastRing", Vector((0, -0.18, 0.85)), 0.026, 0.006, gold, seg=(24, 6), axis=(0, 1, 0)), "chest")
        # a short wine-red cape over the shoulders, on three sway chains
        self.cape("Cape", cape, 1.06, 0.4, 0.44, tails=3, parent="chest", ragged=0.15, back=0.115)
        # the long rapier: a thin bright blade, and a glowing amber gem set in the guard
        h = self.hand_at(-1)
        d = Vector((-0.42, -0.34, 0.84)).normalized()
        g = h + d * 0.085
        self.add(kit.tube("SwordBlade", g, g + d * 0.86, [(0, 0.02, 0.008), (0.85, 0.014, 0.006), (1, 0.002, 0.002)], steel, seg=6, side=(1, 0, 0)), "hand.R")
        self.add(kit.blob("SwordGem", g + d * 0.02, (0.046, 0.046, 0.046), gem, segs=(14, 10)), "hand.R")
        self.add(band("SwordGuardRing", g, 0.058, 0.007, gold, seg=(24, 6), axis=d), "hand.R")


def register(FIGURES):
    FIGURES["mirror_v3"] = MirrorMythic
    FIGURES["mason_v3"] = MasonMythic
    FIGURES["timber_v3"] = TimberMythic
    FIGURES["balloon_v3"] = BalloonMythic
    FIGURES["cat_v3"] = CatMythic
