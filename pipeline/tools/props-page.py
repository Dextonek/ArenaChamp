"""
The props pass's pages (2026-11-14, "lets look at all props one by one and make the correct"): one page a chapter,
docs/tower/props/<chapter>/index.html, with every fault found (what was wrong, the pair of pictures from the same spot before and
after, the cause, the fix), what was seen and left, the numbers (the probe's counts, the "nothing else moved" check, the route bot, the
speed) and the sheets of every kind of prop.

    python -I pipeline/tools/props-page.py

The pictures are made by pipeline/tools/props-shots.js (before: on the branch's base, a git worktree; after: on the branch), the sheets by
props-sheet.js, the numbers by props-probe.js, props-same.js and perf.py (docs/tower/props/numbers.json).
"""
import html
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'docs' / 'tower' / 'props'

# (picture name, title, floors and how many, what was wrong, the cause, the fix)
SEA = [
    ('road-lantern', 'Roadside lanterns hung beside their arm', 'floors 1-10, 102 lanterns',
     'The lantern hung on the far side of its post from the arm meant to hold it: a box in the air, an arm holding nothing.',
     'depth.ts: the arm was turned a quarter the wrong way (left and right swapped).', 'The arm is turned over its lantern.'),
    ('market-net', 'Market nets across their poles', 'floors 1-10, 24 nets',
     'The net hung square across the line of its two poles, touching neither.', 'depth.ts: the net was turned a quarter too far.',
     'The net runs from pole to pole.'),
    ('fish-rack', 'Fish racks: the bar across the posts, the fish in the air', 'floors 1-10, 16 racks (80 fish)',
     'The bar lay square across its two posts; the fish hung in a row in the air under nothing.', 'depth.ts: the bar was turned a quarter too far, and the fish hung 10 cm below it.',
     'The bar runs from post to post and the fish hang from it.'),
    ('washing-line', 'Washing lines across their posts', 'floors 1-10, 19 lines',
     'The line ran square across its two posts; the washing hung in the air.', 'depth.ts: the line was turned a quarter too far.', 'The line runs from post to post; the washing hangs on it.'),
    ('well', 'The village well: roof over its posts, water over the rim', 'floors 1-10, 10 wells',
     'The roof floated 5 cm over its posts and the dark water stood 2 cm over the stone rim, like a lid.', 'depth.ts: heights.', 'The roof sits on its posts; the water is below the rim.'),
    ('boat-sail-and-boats', 'Boats: the sail beside the mast; boats in each other', 'floors 1-10, 59 sails, 4 pairs of boats, boats on jetties',
     'Each sail stood 0.9 m out from its mast, held by nothing. Boats were set down at random in the bay, so some lay inside each other or across a jetty.',
     'land.ts: the sail was moved forward instead of sideways; the boats were never kept apart.',
     'The sail\'s edge is on the mast. A boat that would lie in another or across a jetty is not drawn (the scenes keep off its water as before).'),
    ('jetty', 'Jetty piles short of the deck', 'floors 1-10, 26 jetties',
     'The piles stopped 9 cm under the deck: seen from low, the deck floated over them with light between.', 'land.ts: the piles\' height.', 'The piles reach the deck.'),
    ('house-on-slope', 'Houses on the hillside with a side in the air', 'floors 1-10, about 240 houses on slopes',
     'A house stood at the height of the ground under its middle, so on a slope its low side stood up to 2 m in the air.', 'land.ts: the plinth was a fixed 0.5 m.',
     'The plinth reaches down to the lowest ground under the house.'),
    ('wall-through-house', 'The town wall through houses', 'floors 1-10',
     'Stretches of the dry-stone wall at the edge of town ran into the corners of houses.', 'land.ts: the wall did not know the houses.', 'The wall stops short of a house.'),
    ('cliff-boulders', 'Boulders hanging off the cliff\'s foot; trees through them', 'floors 1-10, about 120 boulders, 72 trees',
     'Set by the ground under their middle, boulders on the steep cliff foot hung out over the slope on their low side; pines grew through some.',
     'land.ts: the height from the middle only; trees were placed without the rocks.',
     'On steep ground a boulder sits lower, so its low side comes down to the ground (by 0.4 of its size at most, so it still shows). A tree inside a boulder is left out of the drawing.'),
    ('crate-band', 'Crates: the gold band square to the world', 'floors 1-10, every crate (about 25 a floor); the Wood too',
     'The crate was turned, its gold band was not: the band\'s corners stuck out of the crate\'s sides as gold triangles.', 'zone.ts: the band had no turn.', 'The band turns with its crate.'),
    ('stall-poles', 'Market stalls: poles in the wrong places', 'floors 1-10, the tall stalls',
     'One pole stood in the middle of the counter, the other half a stall\'s length past its end (on the road); the awning hung between them over nothing at one end.',
     'zone.ts: the poles were measured from one end of the stall instead of its middle.', 'A pole at each end, under the awning\'s ends.'),
    ('wreck-ribs-mast', 'The wreck\'s ribs leaned the world\'s way', 'floors 1-10, every wreck',
     'The ribs along the wreck all leaned north and south, whatever way the hull lay, so on most wrecks they leaned along it.', 'zone.ts: the lean was not turned with the hull.',
     'The ribs lean in across the hull, each side towards the other. (The broken mast was fine: it starts inside the hull.)'),
    ('lighthouse-roof', 'The lighthouse roof on nothing', 'floors 1-10, 10 lighthouses',
     'The lantern\'s roof floated a metre above the gallery with nothing under it.', 'zone.ts: no lantern room.', 'Six posts from the gallery up to the roof, the light between them.'),
    ('place-lantern-road', 'Plaza lanterns on the road', 'floors 1-10, 29 lanterns on a road, 20 on a floor spot',
     'The lantern post at each plaza\'s rim stood towards the middle: often on the road into the plaza, and sometimes on a person, a waystone or a quest spot.',
     'zone.ts: always the same direction.', 'It is turned along the plaza\'s rim until it stands off the roads, the floor\'s spots and the cover.'),
    ('place-lantern-spot', 'Plaza lantern on a floor spot', 'one of the 20', 'The lantern post stood where a person stands.', 'zone.ts, as above.', 'As above.'),
    ('signpost-on-spot', 'Signposts and others on floor spots', 'floors 1-10, 6 signposts, 2 graves, 3 washing lines, a garden',
     'The depth\'s props kept off roads and cover but not the floor\'s spots: a signpost stood through a waystone, a grave on a quest step.',
     'depth.ts: the spots were not asked.', 'A prop planned on a spot is not drawn. It is planned as before, so the random stream and every other prop stay where they were.'),
    ('harbour-props-overlap', 'Two piles of chests in each other', 'floors 2-10, 10 pairs',
     'The harbour\'s own props (chests, barrels, cannons, boats on chocks) were set by the floors\' maker without keeping apart: two piles of chests stood inside each other.',
     'zone.ts / the floor data: no spacing between them.', 'A copy that would stand in one drawn before it is left out.'),
    ('rack-in-harbour-props', 'Depth props inside the harbour\'s props', 'floors 1-10, about 10',
     'A fish rack or a net stood inside a pile of chests.', 'depth.ts: the harbour props load later and the depth did not keep off them.', 'Such a depth prop is not drawn (planned as before).'),
    ('caulk-keel', 'A boat being caulked: its keel in the air', 'floors 2-5',
     'The keel was a straight bar on the boat\'s rounded bottom: it touched in the middle and stood clear of it towards both ends.', 'scenes/sea.ts: a straight keel.',
     'The keel follows the hull\'s curve.'),
    ('capsized-keel', 'The capsized ship\'s keel', 'floors 1-10, one or two a floor',
     'As above, on the big hull out on the rocks: a 15 m beam lying over the hull.', 'scenes/sea.ts.', 'The keel follows the hull\'s curve.'),
    ('fishrack-beach', 'Fish racks on the beach', 'floors 8-10',
     'The strings the fish hung by lay flat, so the fish hung 20 cm under the pole; on a slope the frames and the pole stood apart.',
     'scenes/sea.ts: the strings lay along x; each part stood on the ground under its own middle.', 'The strings hang from the pole; the scene is laid as one piece on its slope (below).'),
    ('tidecart', 'The cart stuck at the tide line', 'floors 3, 6, 9',
     'The hubs sat on the tops of the wheels, not in their middles; on the steep beach the cart, its wheels and its shafts stood apart in the air.',
     'scenes/sea.ts: the hub\'s height; each part on its own ground.', 'The hubs are in the wheels\' middles, sunk to the hubs in the sand; the scene is laid as one piece on its slope.'),
    ('mooring-slope', 'A mooring on the beach: the anchor sunk out of sight', 'floors 2-10',
     'The anchor beside the mooring post stood on the ground under its own middle; on the slope it went 92 % into the sand, only its shaft showing.',
     'scenes/sea.ts: each part on its own ground.', 'The scene is laid as one piece on its slope (below): the anchor stands in the sand by its post.'),
    ('rowboat', 'A rowing boat drawn up on the beach', 'floors 1-3', 'On the slope the boat, its oars and its sail stood a little apart.', 'As above.', 'As above.'),
    ('memorial-bow', 'The memorial: the bow under the cairn', 'floors 1-10, the bow kind (10)',
     'The broken bow lay under the cairn of stones and the cloth meant to lie on it floated 17 cm in the air beside it.', 'scenes/sea.ts: the bow was turned half round.',
     'The bow lies before the cairn with the cloth on it.'),
    ('island-trees', 'Trees on the far islands', 'floors 1-10',
     'The island\'s trees all stood at one height: sunk in its middle, a little in the air at its edge (far out at sea, hard to see).', 'depth.ts: one height for all.',
     'Each tree stands on the island\'s green where it is.'),
]
SEA_ALSO = [
    ('Beach scenes on a slope', 'Every scene past the outline (a rowing boat, a boat being caulked, the fish rack, the cart, the mooring) stood each part on the ground under its own middle, so on a slope a part stood off the one it sits on. Now the scene is turned to the plane that fits the ground under it (8 degrees at most, so posts stay near upright) and let down until none of its feet is in the air; small loose things (tools, shells, a tar pot on its stones) keep their own ground. Shown in the fish rack, cart, caulking, mooring and rowing-boat pairs above.'),
]
SEA_LEFT = [
    ('Cover on the roads', 'Some rocks, stalls and ruin walls (the floor\'s cover, which the fights use) stand on a painted road. They are the floor\'s layout, not looks: left where they are.'),
    ('The lair wall', 'On a few floors the back wall of the ruler\'s lair runs into a dune or a hill at one end (lair-wall pair, unchanged). It reads as a wall built into the slope; left.'),
    ('Boulders in piles', 'Fallen rocks overlap each other at the cliff\'s foot: a pile, as it should be.'),
    ('The wreck\'s broken mast', 'The probe called it loose; it starts inside the hull and leans out of it (wreck pair). Fine.'),
    ('Small things under the sand', 'A few shells, seaweed strips and a cloth of the beach scenes lie a few cm under the sand, as they did before the fixes; at the steepest cliff foot 4 small boulders (2 before) are wholly in the slope: not seen.'),
    ('A signpost board over a spot', 'On floor 3 a signpost\'s board reaches over a quest spot at 2 m; the post itself is clear of it. Left.'),
    ('Baskets of the catch, the chapel benches', 'The white catch in the market baskets reads bright from above and the benches are plain blocks: a matter of taste, not a mistake. Left for the artist.'),
]
WOOD = [
    ('elder', 'The Elder tree: roots sideways', 'floors 11-20, 8 roots each',
     'The great roots round the Elder leaned north or south whatever side of the trunk they stood on: from most sides they looked like fallen poles across its foot.', 'woodZone.ts: the lean was not turned to the trunk.',
     'Each root stands on its own ground and leans in to the trunk.'),
    ('elder-roots', 'The Elder\'s glowing heart', 'floors 11-20',
     'The glowing heart was inside the trunk: only its glow showed.', 'woodZone.ts: 4.4 m out on a trunk 6.3 m wide.', 'It sits half out of the trunk\'s face towards the wood.'),
    ('hollow-roots', 'The hollow oak\'s roots', 'floors 12-20, 6 roots each',
     'Its roots stuck out sideways from the trunk like poles.', 'woodZone.ts: the same lean as the Elder\'s.', 'They flare from its foot and lean in to the trunk.'),
    ('menhir-band', 'Standing stones: the gold band square to the world', 'floors 11-20, every standing stone',
     'The stone was turned and leaned, its gold band was not: gold triangles stuck out of its sides.', 'woodZone.ts.', 'The band turns and leans with its stone.'),
    ('crate-band', 'Crates: the gold band square to the world', 'floors 11-20', 'As on the Sea.', 'woodZone.ts.', 'The band turns with its crate.'),
    ('hut-ridge', 'The burners\' hut: a ridge on a peaked roof', 'floors 12-20',
     'The roof is a four-sided peak, but a long gold ridge ran along it: it stuck out of the roof\'s slopes in the air.', 'woodZone.ts: a ridge for a gabled roof.', 'A small gold cap on the peak.'),
    ('place-lantern-trail', 'Glade lanterns on the trail', 'floors 11-20, 21 lanterns',
     'The lantern post at each glade\'s rim stood on the trail into it.', 'woodZone.ts: always towards the middle.', 'Turned along the rim until it stands off the trails, the spots and the cover.'),
    ('cooking-tripod', 'The camp\'s cooking tripod', 'floors 11-20',
     'Its three legs leaned sideways and never met; the pot hung in the air under nothing.', 'woodDepth.ts: the legs\' lean was turned the wrong way.',
     'The legs lean in and meet over the pot, which hangs from them on a chain.'),
    ('bramble-berries', 'Berries beside the bramble shoots', 'floors 11-16, 47 berries',
     'The berries floated in the air beside the shoots.', 'woodDepth.ts: placed at random near them.', 'Each berry is on its shoot.'),
    ('hunters-stand', 'The hunter\'s stand: rails off the posts', 'floors 11-20',
     'The top rails hung 5 cm outside the posts.', 'woodDepth.ts.', 'The rails sit on the posts.'),
    ('cottage-trees', 'Trees through the woodcutter\'s cottage', 'floors 11-20, 8 trees',
     'Trees of the far wood stood through the cottage; on the hills its plinth had a side in the air.', 'woodDepth.ts / woodZone.ts: the wood was planted without it.',
     'A tree in the cottage (or the watchtower) is left out of the drawing; the plinth reaches the lowest ground.'),
    ('watchtower-trees', 'Trees through the watchtower', 'floors 12-16, 4 trees', 'As above, at the watchtower on the ridge.', 'As above.', 'As above.'),
    ('woodshed-slope', 'The woodshed: its roof the wrong way; scenes past the outline on a slope', 'floors 11-19',
     "The shed's roof sloped up over its short front posts and down to the tall back ones, so it stood off its posts and its gilt edge hung under it. And each part of a scene past the outline stood on the ground under its own middle, so on the hills a part stood off the one it sits on.",
     "scenes/wood.ts: the roof's lean had the wrong sign; each part on its own ground.",
     'The roof slopes down to the front posts. The scene is laid as one piece on the plane of its ground (8 degrees at most) and let down until none of its feet is in the air; small loose things keep their own ground.'),
    ('cover-on-trail', 'Standing stones on the trail (left)', 'floors 11-20',
     'Some cover (standing stones, rocks, logs) stands on a painted trail. The lantern beside it moved off; the gold band was fixed; the stones are the floor\'s cover and stay.',
     'The floor\'s layout.', 'Left (the lantern and the band fixed).'),
]
WOOD_LEFT = [
    ("The Wood's trail lanterns", 'woodDepth.ts has lanterns for the trails, but they ask for 3 m of room off the trail while standing at 2.8 m, so none is ever placed on any floor. Nothing to see; left (placing them would add props).'),
    ('Cover on the trails', 'Standing stones, rocks, logs, mounds and crates of the floor\'s cover stand on painted trails on most floors. They are the fights\' layout: left.'),
    ('The Elder\'s root mound', 'Behind the lair a mound of bark with roots poking out of it in every direction; they cross the trees round it. Looks rough but is a mound of roots: left.'),
    ('zoneWood.ts', 'The old 48 m wood (zoneWood.ts) is no longer used by any floor: not looked at.'),
]


def page(chapter, title, faults, also, left, numbers, sheets):
    e = html.escape
    pr = numbers['probe'][chapter]
    kinds = sorted(set(pr['before']) | set(pr['after']))
    floors = range(1, 11) if chapter == 'sea' else range(11, 21)
    same = [s for s in numbers['same'] if s['floor'] in floors]
    route = [r for r in numbers['route'] if r['floor'] in floors]
    perf = numbers.get('perf', {}).get(chapter, [])
    rows = ''.join(f"<tr><td>{e(k)}</td><td>{pr['before'].get(k, 0)}</td><td>{pr['after'].get(k, 0)}</td></tr>" for k in kinds)
    cards = ''
    for name, t, where, wrong, cause, fix in faults:
        cards += f"""<section class="f"><h3>{e(t)}</h3><p class="w">{e(where)}</p>
<p><b>Wrong:</b> {e(wrong)}</p><p><b>Cause:</b> {e(cause)}</p><p><b>Fix:</b> {e(fix)}</p>
<figure><img src="{name}-before.jpg" alt="{e(t)}, before" loading="lazy"><figcaption>Before (the branch's base): the game's camera, close, and low beside it</figcaption></figure>
<figure><img src="{name}-after.jpg" alt="{e(t)}, after" loading="lazy"><figcaption>After, the same spot and cameras</figcaption></figure></section>"""
    also_html = ''.join(f'<li><b>{e(a)}.</b> {e(b)}</li>' for a, b in also)
    left_html = ''.join(f'<li><b>{e(a)}.</b> {e(b)}</li>' for a, b in left)
    same_rows = ''.join(f"<tr><td>{s['floor']}</td><td>{s['scenes']}</td><td>{'yes' if s['scenesSame'] else 'NO'}</td><td>{'yes' if s['packsSame'] and s['doorsSame'] else 'NO'}</td><td>{s['cellsChanged']} of {s['cells']}</td></tr>" for s in same)
    route_rows = ''.join(f"<tr><td>{r['floor']}</td><td>{'cleared' if r['floorCleared'] else 'NOT cleared'}</td><td>{r['seconds']:.0f} s</td><td>{r['falls']}</td><td>{r['restarts']}</td></tr>" for r in route)
    perf_rows = ''.join(f"<tr><td>{e(p['scene'])}</td><td>{e(p['profile'])}</td><td>{e(p['before'])}</td><td>{e(p['after'])}</td></tr>" for p in perf)
    sheet_html = ''.join(f'<figure><img src="kinds/{s}" alt="Sheet of prop kinds {e(s)}" loading="lazy"><figcaption>{e(s)}</figcaption></figure>' for s in sheets)
    return f"""<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>{e(title)}</title><style>
:root {{ --bg:#f6f3ec; --fg:#1d1b21; --mut:#6b6458; --card:#fffdf8; --line:#ddd5c4; --acc:#5e1a28; }}
@media (prefers-color-scheme: dark) {{ :root {{ --bg:#141317; --fg:#ece6d8; --mut:#a59d8c; --card:#1d1b21; --line:#38343c; --acc:#c9a24a; }} }}
body {{ margin:0; background:var(--bg); color:var(--fg); font:15px/1.5 system-ui, sans-serif; }}
main {{ max-width:1320px; margin:0 auto; padding:16px; }}
h1 {{ font-size:24px; margin:8px 0; }} h2 {{ margin-top:32px; border-bottom:1px solid var(--line); }} h3 {{ margin:0 0 4px; color:var(--acc); }}
.f {{ background:var(--card); border:1px solid var(--line); border-radius:8px; padding:12px; margin:14px 0; }}
.w {{ color:var(--mut); margin:0 0 6px; }} p {{ margin:4px 0; }}
figure {{ margin:8px 0; }} img {{ width:100%; height:auto; display:block; border-radius:4px; }} figcaption {{ color:var(--mut); font-size:13px; }}
table {{ border-collapse:collapse; margin:8px 0; }} td, th {{ border:1px solid var(--line); padding:3px 8px; text-align:left; }}
.grid {{ display:grid; grid-template-columns:repeat(auto-fit, minmax(300px, 1fr)); gap:12px; }}
</style></head><body><main>
<h1>{e(title)}</h1>
<p>The user, 2026-11-14: "lets look at all props one by one and make the correct". Every kind of prop on these ten floors was drawn on its own beside the hero
(the sheets at the bottom), every floor was walked by a probe that checks each placed part against the ground, the other props, the cover, the roads and the floor's
spots (<code>pipeline/tools/props-probe.js</code>), and every fault below was fixed at its cause, so every floor gets the fix. Nothing that was right was moved:
the scenes, packs, doors and quests stand where they stood (table below).</p>
<h2>The faults and the fixes</h2>{cards}
<h2>Also fixed</h2><ul>{also_html}</ul>
<h2>Seen and left</h2><ul>{left_html}</ul>
<h2>The probe, before and after</h2>
<p>Counts over the ten floors. What is left is mostly by design: plinths and roots sunk into the ground ("sunk"), cover drawn on the roads ("road"), a pile of rocks
("overlap"), the side of a house's wall above its now deep plinth ("side"), parts of one prop the probe counts apart (the Elder's crown, a long jetty's deck).</p>
<table><tr><th>kind</th><th>before</th><th>after</th></tr>{rows}</table>
<h2>Nothing else moved</h2>
<p>Every vertex the floor draws, in 4 m squares, on the base and on the branch (<code>pipeline/tools/props-same.js</code>): only the squares with a fixed prop change.
The scenes (kind and place), the packs and the doors are the same.</p>
<table><tr><th>floor</th><th>scenes</th><th>scenes in place</th><th>packs and doors the same</th><th>4 m squares changed</th></tr>{same_rows}</table>
<h2>The scenes' own probe</h2><p><code>pipeline/tools/scenes-probe.js</code> on all twenty floors after the fixes: 0 hits on every floor (spots 3 m, roads, cover, places, flats, the outline), every scene kind placed.</p>
<h2>The route bot</h2><table><tr><th>floor</th><th>result</th><th>game time</th><th>falls</th><th>restarts</th></tr>{route_rows}</table>
<h2>Speed</h2><p>perf.py, the base (a git worktree) and the branch, twice each, in turn. Frame time median in ms (and draw calls).</p>
<table><tr><th>scene</th><th>profile</th><th>base</th><th>branch</th></tr>{perf_rows}</table><p>{e(numbers.get('perfNote', ''))}</p>
<h2>Every kind, on its own</h2><p>Each kind (the line of code that placed it, a scene, a harbour prop) alone on the floor's ground, the hero beside it: the game's camera and low beside it.
Sheets marked "before" are of kinds only drawn there (taken before the fixes).</p><div class="grid">{sheet_html}</div>
</main></body></html>"""


def main():
    numbers = json.loads((OUT / 'numbers.json').read_text(encoding='utf-8'))
    for chapter, title, faults, also, left in (('sea', 'The Sea\'s props, set right', SEA, SEA_ALSO, SEA_LEFT), ('wood', 'The Wood\'s props, set right', WOOD, [], WOOD_LEFT)):
        sheets = sorted(p.name for p in (OUT / chapter / 'kinds').glob('*.jpg'))
        (OUT / chapter / 'index.html').write_text(page(chapter, title, faults, also, left, numbers, sheets), encoding='utf-8')
        print('wrote', OUT / chapter / 'index.html')


if __name__ == '__main__':
    main()
