# Retargeting animation onto our heroes, and keeping arms out of bodies

How an animator's clips made for one figure are replayed on another figure with other proportions, what goes wrong
(arms in the body, feet behind the hips, stiff A-pose arms), how engines and tutorials fix it, and what this game does.
Written 2026-11-10 after the user asked to "learn on the internet how to rig them" when the arms went into the bodies.

## Our situation

- The clips are the KayKit Character Animations pack (`src/motion/clips.ts`, baked by `pipeline/tools/bake-motion.html`).
  The pack's figure is small, round and wide: long thigh, short shin (0.227 and 0.149 m), knees bent 12° even at rest,
  a wide body that makes it hang its idle arms 40° out from its sides.
- Our 39 heroes are tall and slim, with thigh and shin about equal, arms modelled hanging 9-15° out (Big Yoko 34°,
  Mabel 28°, Professor Puff 23°), and many wear flared robes, skirts or round coats.
- The bake does not store bone rotations; it stores directions: which way each upper arm, forearm, thigh and shin points,
  the hips' place in leg lengths, how the hips, chest, head and feet are turned from rest. `HeroFigure.replay` points our
  bones the same way (`Hero.pointBone`).

Copying directions is simple and works across rigs with different bone axes, but it copies the source figure's
proportions too. Every fault below came from that.

## What goes wrong, and the standard fixes

**1. Rest poses that differ.** The most common cause of broken arms in every engine's forums: one rig in a T-pose, the
other in an A-pose, or bones that point differently at rest. The standard fix is to retarget each bone's rotation as a
change from its own rest pose, not as an absolute rotation. In Unreal you edit the retarget pose so both rigs match
before mapping chains; three.js retargeting code stores each bone's rest world rotation and converts every animated
rotation against the source's and the target's rest. A Roblox thread on Mixamo clips ("arms adhesive to the torso")
is our exact symptom: the upper arms bent in onto the torso; the fixes there were an offset on the upper arm's rotation
or a rebuilt rig with matching joints.

**2. Different proportions: feet and hands.** Rotations copied faithfully onto shorter or longer limbs leave the feet
short of the floor or sliding. Engines pin the feet (and hands, for contacts) with IK goals: the retargeter keeps the
point in space where the source had it, scaled by the height or leg-length ratio, and a two-bone IK solves the limb for
the target's own lengths. The pole vector (the direction the knee or elbow points) is taken from the source's joint, so
the bend goes the same way.

**3. Different body shapes: limbs inside the body.** Even with matched rest poses, a slim source's arms go inside a wider
target's chest, belly or skirt. Unreal 5.7 added an experimental "spatially aware retargeting" step (Body Intersect
Goals): the body is covered by spheres and capsules and the hand and foot IK goals are pushed out of them before the IK
is solved. Research does the same more precisely: storing each hand's position relative to the body's surface instead
of its centre (egocentric normalisation, Molla et al. 2015) or using distance fields per body part. Forum advice for
hands that clip into the torso is the same: check each frame and move the hand goal out, blending so it does not snap;
physics capsules for movement do not stop the mesh from clipping.

**4. A blend to the source.** Where the target's own fit looks worse than the clip, engines let a chain blend back toward
the source's motion (Unreal's "blend to source" on IK goals). We do the same per clip: attacks and casts keep the clip's
own legs and arms, because there the exact reach of a blow matters more than the fit.

## What this game does (src/heroFigure.ts, src/effects/weapons/hero.ts)

| Step | Engine name | Ours |
|---|---|---|
| Legs: the foot where the clip puts it, the knee bent for this hero's thigh and shin, the way the clip's knee points | IK goal on the foot + two-bone IK with a pole | `fitLeg`, used for standing, walking and running; the foot's reach measured from the pack figure's own rest reach, so its 12° rest bend is not copied |
| Hips placed in leg lengths | root/pelvis translation scaled by height | `hipsOff` × `legLength` (since the motion pass) |
| Standing arms at the hero's own hang | retarget pose (rest-pose offset on the upper arm) | `fitArm`: the idle's arms are turned in by the difference between the pack's 40° and this hero's modelled hang (`Hero.armOut`); walking and running keep the clip's wide swing |
| No forearm or hand inside the body | Body Intersect Goals (push out of colliders) | `Hero.body` + `HeroFigure.clearBody`, below |
| Attacks and casts keep the clip's limbs | blend to source = 1 | `share.fit` unset for those clips |

### The body outline and the push-out

At load (`Hero.measureBody`), the model at rest is read vertex by vertex. A vertex counts as body when its main bone is
the pelvis, chest or a leg (that takes in the torso, skirts, robes and round coats) and its material is not see-through
(Sirix's wings stay out). Arms, the head and held items are left out. For every 4 cm of height and every 15° round the
body's upright axis, the furthest such vertex is kept: a cheap outline that follows a flared hem or a belly far better
than one capsule would.

Every frame, last (`HeroFigure.clearBody`), for each arm: the middle of the forearm, the wrist and the fingertips (8 cm
past the wrist) must be at least 5 cm (`BODY_MARGIN`, a hand's thickness) outside that outline at their height and
direction. If one is not, the whole arm is swung out from the shoulder, upper arm and forearm together, in steps of
0.03 rad, by the least angle that clears all three. The elbow keeps its bend and the clip's motion stays, only further
out. It is weighted off during attacks, casts and knock-ups, and skipped on a two-handed grip, where the hands must stay
on the weapon.

The first version let each arm stay as far inside the outline as the model's own rest pose had it, thinking the modeller
put it there on purpose. Wrong: a rest pose is a rigging pose, and in several models (Vesper, Silvane) the hands already
touched the skirt at rest, so nothing was pushed. There is no such allowance now.

### Checked (2026-11-10)

Front, three-quarter and side close-ups: Vesper's hands now rest on her skirt instead of in it, Silvane's forearms hang
beside her gown, Professor Puff's nozzle hand stays outside his coat, Madame Cleaver's hands outside her skirt. Sheets
of all 39 standing on the Heroes stand and in their fight stance: no arm inside a robe or skirt, none pushed out
stiffly. Not yet checked: every hero walking and running from the game camera, and a phone.

### Mirrored models

Brannoc, Oblivion and Shiori are modelled with their right hand on +x (facing the other way at rest). Anything that
pushes "out" must use the side the hand or shoulder is actually on (`Math.sign(S.x)`), not the bone's R or L label.

## Further steps, if needed

- Retarget the arms as rotations relative to each rig's rest (fix 1) instead of copying directions plus the idle's
  `fitArm` offset: that would also correct the walk's wide arm swing, which the user accepted as it is.
- Hands that touch the body on purpose (a hand on the hip, a two-handed grip at the chest) would need contact goals: keep
  the source's hand-to-body distance, scaled, instead of only a minimum.
- The outline is measured at rest; a robe that swings with the legs while running is wider or narrower than that. A
  second outline from a mid-stride pose, or a few extra centimetres while running, would cover it.

## Sources

- Unreal Engine, IK Rig and retargeting: https://dev.epicgames.com/documentation/unreal-engine/ik-rig-animation-retargeting-in-unreal-engine
- Spatially aware retargeting and blend to source, Unreal 5.7 (third-party guide): https://unamedia.com/ue5-mixamo/docs/improve-retargeting-results/
- Unreal forum, using the 5.7 spatially aware retargeting: https://forums.unrealengine.com/t/ue-5-7-spatially-aware-retargeting-experimental-how-to-use/2659310
- Unreal retargeting guide (retarget pose, IK goals, root scaling): https://www.strayspark.studio/blog/unreal-engine-animation-retargeting-ik-rig-complete-guide
- three.js forum, retargeting with each bone's rest rotation: https://discourse.threejs.org/t/fixing-skeletonutils-retarget-and-retargetclip-functions/65149
- Roblox forum, Mixamo arms "adhesive to the torso": https://devforum.roblox.com/t/mixamo-animations-looking-for-methods-on-how-to-make-arms-not-adhesive-to-the-torso/1302443
- Babylon.js forum, retargeting needs matching rest poses: https://forum.babylonjs.com/t/retargeted-animation-is-rotated-incorrectly-and-has-hands-misaligned/63218
- Maya, the two-bone IK solver and its pole vector: https://help.autodesk.com/cloudhelp/ENU/MayaCRE-CharacterAnimation/files/GUID-CEA46DDD-40C8-4F78-8928-DEBE1A94E430.htm
- Unreal forum, hands clipping into the body need a per-frame check: https://forums.unrealengine.com/t/how-to-prevent-a-characters-animation-from-clipping-through-objects/2738129
- Molla et al., Egocentric Normalization of Kinematic Path (Eurographics posters 2015): https://diglib.eg.org/items/43c79480-6c38-48dc-83b5-526ecb5d7a85
