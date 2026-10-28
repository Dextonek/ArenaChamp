"""Decode a saved javascript_tool result holding several 'NAME:<slug>|<jpeg data url>' parts (plus 'SELF <json>' lines).

usage: python decode_multi.py <result.txt> <out_dir>
"""
import base64
import json
import os
import re
import sys

src, out_dir = sys.argv[1], sys.argv[2]
raw = open(src, encoding="utf-8").read()
try:
    data = json.loads(raw)
    text = "".join(part.get("text", "") for part in data) if isinstance(data, list) else str(data)
except json.JSONDecodeError:
    text = raw
text = text.encode().decode("unicode_escape") if '\\"' in text else text
for m in re.finditer(r"SELF ([^|]*?\]) ", text):
    print("self", m.group(1))
for m in re.finditer(r"NAME:([a-z0-9-]+)\|data:image/jpeg;base64,([A-Za-z0-9+/=]+)", text):
    path = os.path.join(out_dir, m.group(1) + "_sheet.jpg")
    with open(path, "wb") as f:
        f.write(base64.b64decode(m.group(2)))
    print("wrote", path)
