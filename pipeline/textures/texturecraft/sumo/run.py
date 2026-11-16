"""Big Yoko textured with TextureCraft, from the game's model to the sample GLB, in four steps:

    python pipeline/textures/texturecraft/sumo/run.py [prep] [bake] [paint] [finish] [--work <folder>] [--out <glb>]

With no step named, all four run (4 to 7 minutes; the Blender prep and the bake are most of it).
1. prep   (Blender) the costume laid out in one atlas; carrier.glb, skin_base.png, underwear_id.png   prep.py
2. bake   (TextureCraft) shadow, curvature and the other mesh maps of the costume; the underwear map    bake.json
3. paint  (TextureCraft) the layers: the palette's colours per part, a contact shadow, gold edges, the
          underwear covered; exports costume_color and skin_color as PNG                                paint.json
4. finish (Blender) the textures put on the hero; the GLB written as the build writes heroes              finish.py

The game's model (public/models/heroes/sumo_v4.glb) is only read. Work files (about 40 MB) go to --work, by default a
folder in the system's temp folder. The output defaults to docs/heroes/texturecraft-sample/sumo_tc_v4.glb.
Blender and TextureCraft are found at their usual places on this computer, or by the BLENDER and TEXTURECRAFT
environment variables.
"""
import argparse
import os
import shutil
import subprocess
import sys
import tempfile
import time
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[3]
BLENDER = os.environ.get("BLENDER", r"C:\Program Files\Blender Foundation\Blender 5.2\blender.exe")
TEXTURECRAFT = os.environ.get("TEXTURECRAFT", str(Path(os.environ.get("LOCALAPPDATA", "")) / "Programs" / "ArtCraft" / "TextureCraft"
                                                   / "texturecraft-0.6.1-windows-x64-portable" / "texturecraft-cli.exe"))


def run(cmd, cwd=None, log=None):
    t = time.time()
    p = subprocess.run(cmd, cwd=cwd, capture_output=True, text=True, encoding="utf-8", errors="replace")
    out = p.stdout + p.stderr
    if log:
        Path(log).write_text(out, encoding="utf-8")
    keep = [l for l in out.splitlines() if l.startswith(("UNWRAPPED", "CARRIER", "SKIN", "UNDERWEAR", "JPEG", "SWATCHES", "WROTE", "saved"))
            or "error" in l.lower() or "Traceback" in l]
    for l in keep:
        print("  " + l[:300])
    if p.returncode != 0:
        sys.exit(f"failed ({p.returncode}): {' '.join(map(str, cmd))[:200]}" + (f"; see {log}" if log else ""))
    print(f"  ({time.time() - t:.0f} s)")


def main():
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("steps", nargs="*", default=["prep", "bake", "paint", "finish"])
    ap.add_argument("--work", default=str(Path(tempfile.gettempdir()) / "texturecraft-sumo"))
    ap.add_argument("--out", default=str(ROOT / "docs" / "heroes" / "texturecraft-sample" / "sumo_tc_v4.glb"))
    a = ap.parse_args()
    work = Path(a.work)
    work.mkdir(parents=True, exist_ok=True)
    for step in a.steps:
        print(step)
        if step == "prep":
            run([BLENDER, "--background", "--factory-startup", "--python", str(HERE / "prep.py"), "--", str(work)],
                log=work / "prep.log")
        elif step in ("bake", "paint"):
            if step == "paint" and (work / "tex").exists():
                shutil.rmtree(work / "tex")
            run([TEXTURECRAFT, "batch", str(HERE / f"{step}.json")], cwd=work, log=work / f"{step}.log")
        elif step == "finish":
            Path(a.out).parent.mkdir(parents=True, exist_ok=True)
            run([BLENDER, "--background", "--factory-startup", "--python", str(HERE / "finish.py"), "--", str(work), a.out],
                log=work / "finish.log")
        else:
            sys.exit(f"unknown step {step}")


if __name__ == "__main__":
    main()
