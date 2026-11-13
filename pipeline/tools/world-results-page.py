"""Builds docs/tower/worlds/results.html: one self-contained page (pictures inside it) of the five floors as built and checked."""
import base64
import subprocess
import tempfile
from pathlib import Path

ROOT = Path('C:/VFXTool-worlds')
PICS = ROOT / 'docs/tower/worlds'
TMP = Path(tempfile.mkdtemp())


def img(name, w=560):
    out = TMP / (Path(name).stem + f'-{w}.jpg')
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', str(PICS / name), '-vf', f'scale={w}:-2', '-q:v', '6', str(out)], check=True)
    return 'data:image/jpeg;base64,' + base64.b64encode(out.read_bytes()).decode()


FLOORS = [
    dict(n=1, c='#6fc3d8', name='The Drowned Harbour', law='The tide', what='Every 80 seconds the sea comes in. The low ground floods, slows and hurts; quays and decks stay dry.',
         pics=[('f1-tide-in.jpg', 'The tide in: the low ground is under water'), ('p1-ruler-phase2-cannons.jpg', 'The Drowned Captain, second phase')],
         bot='9 to 16 min', falls='0 to 1 falls', ruler='about 56 % alone, 80 % with Zephyr beside you', gate='about 64 % (Marin, Normal)', note='Five of six heroes clear it. Vesper does not when the computer plays her.'),
    dict(n=2, c='#8fd69a', name='The Walking Wood', law='The wood walks', what='Every 2 minutes three root barriers sink and three rise, with an 8 second warning. You cannot be walled in.',
         pics=[('f2-paths-warn.jpg', 'The warning before the paths change'), ('jf2-ruler-fight.jpg', 'The Elder Root')],
         bot='9 to 11 min', falls='0 to 1 falls, at the gate', ruler='6 of 12 (after I gave it more health)', gate='2 of 8 (Fenna, Hard)', note='The gate is Hard here while floors 3 and 4 are Normal. At Normal the computer won 12 of 12. Your call which.'),
    dict(n=3, c='#e6b072', name='The Storm Canyon', law='The storm', what='Every 90 seconds a wall of sand crosses for 40. In it you see a few steps and lose health, unless you stand behind a rock.',
         pics=[('f3-storm-wall.jpg', 'The wall of sand coming'), ('jf3-ruler-fight.jpg', 'The Scarab Colossus')],
         bot='16 to 18 min', falls='0 to 1 falls, at the gate', ruler='4 of 8', gate='6 of 8 (Sefu, Normal)', note='The longest floor: the computer misses the time star (15 min).'),
    dict(n=4, c='#b79cf0', name='The Lightless Deep', law='The dark', what='You see 8 steps, 11 with a great shard in your hands. Wake a crystal and its hall stays lit for good. Lurkers hunt in the dark.',
         pics=[('f4-law-carried-shard-dark.jpg', 'Carrying a shard through the dark'), ('f4-law-hall-woken.jpg', 'A crystal woken: the hall is lit')],
         bot='9 to 16 min', falls='0 to 4 falls', ruler='6 of 8', gate='7 of 8 (Opaline, Normal)', note='The hardest zone for the computer: Sefu once did not finish in 30 minutes, Vesper needed restarts.'),
    dict(n=5, c='#f0907a', name='The Field of Banners', law='The war', what='Take the crimson or the azure banner. Four of its soldiers fight beside you; the other army hunts you.',
         pics=[('f5-banner-choice-card.jpg', 'Choosing a side'), ('f5-allies-fight-azure.jpg', 'Your soldiers in a fight')],
         bot='9 to 13 min', falls='0 to 3 falls, all at the gate', ruler='4 of 8', gate='4 of 8 (Oblivion, Hard)', note='Both banners play through. Vesper does not clear it when the computer plays her.'),
]

cards = ''
for f in FLOORS:
    pics = ''.join(f'<figure><img src="{img(p)}" alt="{cap}"><figcaption>{cap}</figcaption></figure>' for p, cap in f['pics'])
    cards += f'''
<div class="floor" style="--c:{f['c']}">
  <div class="fn">{f['n']}</div><h3>{f['name']}</h3>
  <p class="law"><b>{f['law']}.</b> {f['what']}</p>
  <div class="pics">{pics}</div>
  <dl>
    <dt>Computer's climb</dt><dd>{f['bot']}, {f['falls']}</dd>
    <dt>Ruler won</dt><dd>{f['ruler']}</dd>
    <dt>Gate won</dt><dd>{f['gate']}</dd>
  </dl>
  <p class="note">{f['note']}</p>
</div>'''

html = f'''<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>The Tower: five floors built</title>
<style>
  :root {{ --bg: #0e0c11; --panel: #1a161f; --panel2: #221c29; --line: #3a3242; --ink: #efe4cf; --ink2: #b3a895; --gold: #e0a83a; --gold2: #ffd27a; --green: #8fd69a; --red: #f0907a; }}
  * {{ box-sizing: border-box; }}
  html {{ background: var(--bg); }}
  body {{ margin: 0 auto; max-width: 940px; padding: 18px 16px 40px; color: var(--ink); font: 15px/1.5 system-ui, -apple-system, 'Segoe UI', sans-serif; }}
  h1 {{ font: 700 26px/1.15 Georgia, 'Palatino Linotype', serif; letter-spacing: .03em; color: var(--gold2); margin: 8px 0 6px; }}
  h2 {{ font: 700 18px/1.2 Georgia, serif; letter-spacing: .03em; color: var(--gold2); margin: 30px 0 8px; }}
  h3 {{ margin: 0 0 4px; font: 700 17px/1.2 Georgia, serif; color: var(--c, var(--gold2)); }}
  p {{ margin: 0 0 10px; }}
  .sub {{ color: var(--ink2); }}
  .tag {{ display: inline-block; font-size: 11px; font-weight: 800; letter-spacing: .12em; text-transform: uppercase; color: #1a1206; background: linear-gradient(180deg, #ffe7a8, #c9902e); padding: 2px 9px; border-radius: 999px; }}
  .box {{ background: var(--panel); border: 1px solid var(--line); border-radius: 10px; padding: 14px; }}
  .three {{ display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 10px; }}
  .k {{ font-size: 11px; font-weight: 800; letter-spacing: .1em; text-transform: uppercase; color: var(--gold); }}
  .big {{ font: 700 22px/1.2 Georgia, serif; color: var(--gold2); }}
  .floor {{ position: relative; background: var(--panel); border: 1px solid var(--line); border-left: 3px solid var(--c); border-radius: 10px; padding: 14px 14px 10px 54px; margin: 0 0 12px; }}
  .fn {{ position: absolute; left: 12px; top: 12px; width: 30px; height: 30px; border-radius: 50%; border: 1px solid var(--c); color: var(--c); font: 700 16px/28px Georgia, serif; text-align: center; }}
  .law {{ color: var(--ink2); }}
  .law b {{ color: var(--ink); }}
  .pics {{ display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 8px; margin: 0 0 10px; }}
  figure {{ margin: 0; }}
  img {{ display: block; width: 100%; height: auto; border-radius: 8px; border: 1px solid var(--line); }}
  figcaption {{ font-size: 12.5px; color: var(--ink2); margin-top: 4px; }}
  dl {{ display: grid; grid-template-columns: max-content 1fr; gap: 3px 14px; margin: 0 0 8px; font-size: 14px; }}
  dt {{ color: var(--gold); font-size: 11px; font-weight: 800; letter-spacing: .1em; text-transform: uppercase; padding-top: 3px; }}
  dd {{ margin: 0; }}
  .note {{ font-size: 13.5px; color: var(--ink2); margin: 0 0 4px; }}
  ul, ol {{ margin: 0; padding-left: 20px; color: var(--ink2); }}
  li {{ margin: 5px 0; }}
  li b {{ color: var(--ink); }}
  @media (max-width: 520px) {{ .floor {{ padding-left: 14px; padding-top: 50px; }} dl {{ grid-template-columns: 1fr; }} }}
</style>
</head>
<body>
<span class="tag">Built 13 November · checked by the computer · not live</span>
<h1>The Tower: five floors built</h1>
<p class="sub">Your idea of floors that are worlds, as it stands now. Every number here comes from the computer playing; nobody has played a floor by hand yet.</p>

<div class="three">
  <div class="box"><div class="k">Floors</div><div class="big">5</div><p class="sub" style="margin:0">Each a place to walk through, with its own law</p></div>
  <div class="box"><div class="k">A floor takes the computer</div><div class="big">9 to 18 min</div><p class="sub" style="margin:0">Camp, quests, ruler, gate</p></div>
  <div class="box"><div class="k">Played by a person</div><div class="big" style="color:var(--red)">Not yet</div><p class="sub" style="margin:0">That is the next step, and it is yours</p></div>
</div>

<h2>Where it is in the game</h2>
<div class="pics">
  <figure><img src="{img('j-climb-tab-all-five-open.jpg', 720)}" alt="The Tower screen's Climb tab"><figcaption>The Tower screen has two tabs now: Climb (new) and Trials (the weekly Tower, unchanged). A tile a floor; the next opens when you win a gate.</figcaption></figure>
  <figure><img src="{img('j-result-card-floor2-climb-to-3.jpg', 720)}" alt="A floor's result card"><figcaption>A cleared floor: up to four stars, and a button to climb on.</figcaption></figure>
</div>

<h2>The five floors</h2>
{cards}

<h2>What every floor has</h2>
<ul>
  <li><b>A camp</b> with a keeper (main quest), a second person (two side quests) and a trader who sells for shards.</li>
  <li><b>Three kinds of enemy in packs,</b> an elite, and a named enemy with a bounty.</li>
  <li><b>Three hidden caches,</b> a lore stone, and waystones you wake at after a fall.</li>
  <li><b>A rival climber:</b> a race on floors 1 and 4, a duel on floors 2, 3 and 5. Beat them and they fight beside you against the ruler.</li>
  <li><b>A trial door</b> into one room of the weekly Tower, for a relic.</li>
  <li><b>The ruler behind a door,</b> then <b>the gatekeeper's duel,</b> where your boons are set aside.</li>
  <li><b>Three lives, four stars,</b> and one boon kept as a sigil for later climbs. Your floor is saved in the browser if you leave or reload.</li>
</ul>

<h2>What is not done</h2>
<ul>
  <li><b>Nobody has played it.</b> The computer finds stuck quests and unreachable spots, but not whether it is fun or clear.</li>
  <li><b>Difficulty is rough.</b> The win rates above are from 8 to 12 fights each.</li>
  <li><b>Looks are first pass.</b> Grounds, props and enemies are plain shapes drawn in code; each ruler is a hero's model drawn big. This is where your eye is needed.</li>
  <li><b>Not measured on a phone.</b> On this computer a floor costs 10 to 14 ms a frame, a duel about 8.</li>
  <li><b>Alone only,</b> and kept in the browser, not on the account. Friends on a floor is a later step.</li>
</ul>

<h2>To try it</h2>
<ol>
  <li>Open the game, press <b>Tower</b>, stay on the <b>Climb</b> tab.</li>
  <li>Pick a hero and press <b>Start floor 1</b>.</li>
  <li>Talk to Gus in the camp (walk up to him), then follow the arrow.</li>
</ol>
<p class="sub" style="margin-top:10px">It runs on this computer's dev server now. It is not on the live site: putting it there needs your word for a push and a deploy.</p>
</body>
</html>
'''
out = PICS / 'results.html'
out.write_text(html, encoding='utf-8', newline='\n')
print(out, round(len(html) / 1024), 'kB')
