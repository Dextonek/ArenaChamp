"""
Saves a picture that a browser-tool call returned as a data URL. A big result does not come back inline: the tool
writes it to a text file (a JSON list of {type, text}, or plain text) and gives the path. This finds the first JPEG or
PNG data URL in that file and writes it out:

    python -I pipeline/tools/save-shot.py <tool-result file> <out.jpg>

Used with `_motionStrip`, `_mannequin`, `_compare` and the other sheet tools, which leave their picture in a window
variable for the next call to return.
"""
import base64
import json
import re
import sys

src, out = sys.argv[1], sys.argv[2]
raw = open(src, encoding='utf-8').read()
try:
    text = '\n'.join(x.get('text', '') for x in json.loads(raw))
except Exception:
    text = raw
m = re.search(r'data:image/(?:jpeg|png);base64,([A-Za-z0-9+/=]+)', text)
if not m:
    sys.exit('no picture in ' + src)
open(out, 'wb').write(base64.b64decode(m.group(1)))
print('saved', out)
