# The Raid's bosses (4 models: the Sun Warden, Ash, Ember, the Heart of Noon)

Checked 2026-11-16, three of the four, through their own pose code in their own rooms (`pipeline/tools/boss-poses.js`: idle, walking,
each cast pose's wind-up and strike, the phases, kneeling, the fall), from the front and from the side as well as the game's camera,
with the lowest point measured.

Front: [the Sun Warden](bosses/warden-front.jpg), [Ash](bosses/ash-front.jpg), [Ember](bosses/ember-front.jpg).
Side: [the Sun Warden](bosses/warden-side.jpg), [Ash](bosses/ash-side.jpg) (a pylon of the room stands between the camera and him).

## Found

Nothing to fix. The Warden's base rests on the floor (its lowest point 3 cm under it, as a hero's sole) and sinks only in its fall,
as built; Ash stands on his feet and knuckles and his plates fall away by phase; Ember floats with no legs, as designed. Each faces the
way it casts. The red disc in front of Ash and Ember in the front views is the room's centre (its lava vent at the ring's middle), not
their ring.

**Not checked this round:** the Heart of Noon (the boss pose tool does not take it; its own pictures are made by
`pipeline/tools/heart-phase-shots.py` and `heart-room-shots.py`, last reviewed with its room).
