---
title: Review tools
tags: [pipeline, review, testing, contact-sheet]
updated: 2026-10-29
---

# Review tools

How effects are checked without watching them in real time: contact sheets rendered inside the page, the
`selfTest` that steps an effect frame by frame looking for errors, the full sweep over every effect, and the quirks
of driving the browser pane. All of it runs in the dev server page (`npm run dev`) through `window.vfx`.

## Contact sheets
[pipeline/tools/contact-sheet.js](../../pipeline/tools/contact-sheet.js) is pasted into the page (it is fetched and
evaluated, so it also works when the browser pane is hidden):

```js
eval(await (await fetch('/pipeline/tools/contact-sheet.js')).text());
_review('supernova seed', 'supernova', [0.5, 1.2, 1.8, 2.0, 2.6, 3.6], { dist: 16, h: 6, ty: 3 });
_multi('forge-recheck', [{ label: 'anvil drop', t: 0.6, dist: 13, h: 6, ty: 1.2, dur: 2.6, caster: [0, 0, 7] }, ...]);
```

| Function | Does |
|---|---|
| `_review(label, slug, times, opts)` | Self-tests the effect, then renders it at each time into a 2-column JPEG sheet. Returns `SELF [label, ok, arenaHits, nanFrames, singularFrames, errors] NAME:<slug>|data:image/jpeg...` |
| `_multi(slug, items)` | Several effects (or several times of one) on one sheet; each label is self-tested once. Good for re-checks after fixes |
| `_sheet(times, cam)` | The raw renderer both use |

Options: `dist` / `h` / `ty` (camera distance behind the cast point toward the caster, camera height, look-at
height), `caster` (start position, e.g. `[0, 0, -1]` for self spells, `[0, 0, 6]` for a close single target),
`count` (enemies), `dur` (self-test seconds).

Typical cameras: single target `dist 12, h 3.6, ty 1.6, caster [0,0,6]`; ground zone `dist 13, h 6–7, ty 0.8–1.2,
caster [0,0,7]`; self aura `dist 11–12, h 5–6, ty 1.4, caster [0,0,-1], count 6`; ultimate `dist 16, h 8, ty 3,
caster [0,0,8], count 6` (the gameplay framing).

The result is too large to return inline; the browser tool saves it to a file. Decode it with
`python pipeline/tools/decode-sheets.py <saved file> docs/spells`, which writes `docs/spells/<slug>_sheet.jpg` and
prints the SELF line. Slugs use dashes, not underscores.

## Self-test and sweep
`vfx.selfTest(label, seconds)` selects the effect, plays it and steps it at 60 fps. It reports `ok`, frames, max
shake, zones, arena hits, NaN frames, singular frames (a lit mesh or instance with a zero-scale matrix) and errors
(shader compile errors from the console and exceptions thrown in a frame).

The full sweep runs it over every registered effect:

```js
window._names = [...vfx.slots.keys()].filter((n) => n !== 'particles');
// durations: 6.5 s normally, 25 s for the cinematic heroes, 50 s for colossus drop and genesis collapse
```

Run it in chunks of about 40 effects per tool call; one long call can time out. Take the names from `vfx.slots`,
not from a dropdown (the dropdown order changes when panel controls are added).

## Browser-pane quirks
- The pane's animation loop does not tick while the pane is hidden. Scripts that need time to pass call
  `vfx.step(1/60)` themselves instead of waiting.
- Keys sent by the automation sometimes don't reach the page; dispatch them instead:
  `window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyH', key: 'h' }))`.
- A file edit by a worker reloads the page, which drops anything defined by `eval` (re-load the helper).
- Set a fixed viewport (1280×800) for comparable sheets, and reset it afterwards.

## See also
- [Workflow](workflow.md)
- [Overview](../architecture/overview.md) (the `vfx` debug handle)
- [Lessons](../knowledge/lessons.md)
- [Docs home](../README.md)
