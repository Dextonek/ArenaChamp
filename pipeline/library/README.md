# VFX recipe library

Breakdowns of professional real-time VFX (games, ArtStation, Real-Time VFX forum, GDC talks, artist breakdown
videos), each split into the parts our kit can build. The prompt-to-effect pipeline (`.claude/skills/forge-vfx`)
reads these as recipes: pick one or mix several, then write a targeted spell from them.

Every entry is our own written analysis of the technique, with a link to where the effect can be seen. No copied
text, images or assets. Use the reference for timing, layering and colour, and build the look in our own style.

## User reference videos (batches d–g)
Recipes made from the user's own downloaded videos have `"kind": "video"`. Their `source.url` is a placeholder
(`http://user-reference.local/<video file name>`) that exists only to pass the validator's `http` check; the real
file is `source.localUrl` (`file:///C:/Users/...`). Each recipe names the time span in the video in
`phases[0].what`. Frame sheets for them live only in the session scratchpad.

## Files
- `batch-*.json` — arrays of recipes, one per research batch. Ids start with the batch letter (`h-…`).
  **Before writing a new batch, check which letters exist and take the next free one** — two sessions once wrote
  the same file. Taken: a–g, i (session "VFX pipeline with enemy targeting"), h and j (tutorial videos); next free: k.
- `index.json` — every recipe merged, sorted by `id` (built by the pipeline).

## Recipe format (JSON)
```jsonc
{
  "id": "kebab-case-unique-id",          // e.g. "lol-lux-final-spark-style-beam"
  "name": "short descriptive name",
  "source": {
    "title": "game / artist / talk",
    "url": "https://...",                 // page where the effect is shown or broken down
    "kind": "game | artstation | breakdown | talk | forum | video"
  },
  "archetype": "projectile | beam | chain | ground-aoe | meteor | melee-slash | buff-aura | summon | nova | channel | dash | other",
  "targeting": "enemy | enemies | ground | self",   // what it needs from our arena
  "element": "fire | ice | lightning | holy | shadow | void | arcane | nature | blood | water | wind | earth | tech | other",
  "durationSec": 3.5,
  "phases": [                              // anticipation → release → impact → aftermath, seconds from start
    { "name": "anticipation", "start": 0, "end": 0.8, "what": "energy gathers in the hand, inward-sucking motes" }
  ],
  "layers": [                              // map each visible part to one of our building blocks
    {
      "part": "core-flash | glow-sphere | emitter-sparks | emitter-smoke | emitter-wisps | emitter-embers | ring-shockwave | ground-decal | rune-circle | light-pillar | beam-ribbon | trail-ribbon | mesh-projectile | mesh-debris | lightning-arc | distortion | screen-flash | camera-shake | light",
      "phase": "impact",
      "blend": "additive | normal",
      "colors": ["#fff6e0", "#ff9a2a", "#5a1a08"],  // hot → mid → cool
      "motion": "radial burst, drag 1.2, gravity 6",
      "notes": "what makes this layer read well"
    }
  ],
  "palette": ["#...", "#...", "#..."],
  "shake": "none | light | medium | heavy",
  "whyItLooksGood": ["shape language / contrast / timing reasons, in our words"],
  "buildNotes": "how to build it with src/effects/common.ts + Emitter, and what to exaggerate"
}
```
