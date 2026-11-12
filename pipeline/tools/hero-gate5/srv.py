"""This repo's own dev server on 5193 (the game page with its WebSocket server): started here, stopped here by its PID.
It refuses to run when something already answers on the port. `OUT` is where these tools write: git-ignored.
The server runs with the hero shop off (SHOP=off; pipeline/designs/hero-shop.md): the bots' accounts are new, and with
the shop on a new account could not take a hero it has not bought online."""
import os
import subprocess
import time
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
OUT = ROOT / "pipeline" / "sim" / "out" / "gate5"
OUT.mkdir(parents=True, exist_ok=True)
PORT = 5193
ARGS = ["--mute-audio", "--ignore-gpu-blocklist", "--disable-background-timer-throttling",
        "--disable-renderer-backgrounding", "--disable-backgrounding-occluded-windows"]


def up(port=PORT):
    try:
        with urllib.request.urlopen(f"http://localhost:{port}/", timeout=2) as r:
            return r.status == 200
    except Exception:
        return False


class Server:
    def __enter__(self):
        self.proc = None
        if up():
            raise SystemExit(f"something already answers on {PORT}: not mine, stopping")
        self.proc = subprocess.Popen(["node", str(ROOT / "node_modules" / "vite" / "bin" / "vite.js"), "--port", str(PORT), "--strictPort"],
                                     cwd=str(ROOT), env={**os.environ, "SHOP": "off"}, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        for _ in range(120):
            if up():
                break
            time.sleep(0.5)
        else:
            self.proc.terminate()
            raise SystemExit("the dev server did not answer within 60 s")
        print(f"dev server on {PORT}, pid {self.proc.pid}", flush=True)
        return self

    def __exit__(self, *a):
        if self.proc:
            self.proc.terminate()
            try:
                self.proc.wait(10)
            except Exception:
                self.proc.kill()
            print(f"dev server pid {self.proc.pid} stopped", flush=True)
