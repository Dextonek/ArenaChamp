"""
Adds the palette rows proposed for the spell icons to docs/ART_BIBLE.md section 2 (the energy table), after its last
row, each once: the hero's row as its draw/<stem>.py module holds it (PAL), named as in batches.json's "bible".

    python -I pipeline/icons/vectorcraft/bible_rows.py 1      # the rows of batch 1
"""
import json
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
ROOT = HERE.parents[2]
BIBLE = ROOT / "docs" / "ART_BIBLE.md"


def main():
    import make
    make.heroes()
    from vclib import PAL
    batch = json.loads((HERE / "batches.json").read_text(encoding="utf-8"))[sys.argv[1]]
    text = BIBLE.read_text(encoding="utf-8")
    lines = text.split("\n")
    last = max(i for i, l in enumerate(lines) if l.startswith("| Dusk / chalk") or (l.startswith("| ") and "`#" in l and
                                                                                   i < text[:text.index("## 3.")].count("\n")))
    added = []
    for stem, (name, foils) in batch.get("bible", {}).items():
        p = PAL[stem]
        line = f"| {name} ({foils}) | " + " | ".join(f"`{p[k]}`" for k in ("core", "hot", "body", "accent", "dark")) + " |"
        if f"| {name} (" in text:
            continue
        last += 1
        lines.insert(last, line)
        added.append(name)
    BIBLE.write_text("\n".join(lines), encoding="utf-8")
    print("added:", ", ".join(added) or "nothing")


if __name__ == "__main__":
    main()
