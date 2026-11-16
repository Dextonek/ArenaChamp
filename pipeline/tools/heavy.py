"""
One timing-sensitive job at a time on this computer (the user, 2026-11-16: "make adjustments so there will be not that much load
and agents can work well").

Several agents share one machine. Their builds, dev servers and hidden browsers are fine side by side, but a job that MEASURES
time (frame times in perf.py, phone profiles, --headed loading runs, the full simulator's roster) gives noisy numbers when other
heavy jobs run beside it. Run such a job through this lock: it waits until no other agent's measured job runs, then runs yours.

    python pipeline/tools/heavy.py run -- python pipeline/tools/perf.py ...      # waits for the lock (at most 9 min), then runs
    python pipeline/tools/heavy.py status                                       # who holds it, since when

The lock is a file in the system temp folder shared by every worktree (%TEMP%/arenachamp-heavy.lock) holding the holder's PID, its
command and the time. A lock whose PID is gone, or that is older than 2 hours, is stale and taken over. Waiting ends by itself
after 9 minutes (CLAUDE.md: every wait ends within 10 minutes): the job then runs anyway and says the numbers may be noisy.
Fight prints (hero-prints.py, perf prints) are the same however busy the machine is: they do not need the lock.
"""
import json
import os
import subprocess
import sys
import tempfile
import time

LOCK = os.path.join(tempfile.gettempdir(), 'arenachamp-heavy.lock')
MAX_WAIT = 9 * 60
STALE = 2 * 3600


def alive(pid: int) -> bool:
    if pid <= 0:
        return False
    if os.name == 'nt':
        out = subprocess.run(['tasklist', '/FI', f'PID eq {pid}', '/NH'], capture_output=True, text=True).stdout
        return str(pid) in out
    try:
        os.kill(pid, 0)
        return True
    except OSError:
        return False


def holder():
    try:
        with open(LOCK, encoding='utf-8') as f:
            return json.load(f)
    except (OSError, ValueError):
        return None


def take() -> bool:
    h = holder()
    if h and (not alive(int(h.get('pid', 0))) or time.time() - h.get('since', 0) > STALE):
        try:
            os.remove(LOCK)
        except OSError:
            pass
    try:
        fd = os.open(LOCK, os.O_CREAT | os.O_EXCL | os.O_WRONLY)
    except FileExistsError:
        return False
    with os.fdopen(fd, 'w', encoding='utf-8') as f:
        json.dump({'pid': os.getpid(), 'since': time.time(), 'cmd': ' '.join(sys.argv[3:])[:200], 'cwd': os.getcwd()}, f)
    return True


def release():
    h = holder()
    if h and h.get('pid') == os.getpid():
        try:
            os.remove(LOCK)
        except OSError:
            pass


def main():
    if len(sys.argv) >= 2 and sys.argv[1] == 'status':
        h = holder()
        if not h:
            print('free')
        else:
            state = 'running' if alive(int(h.get('pid', 0))) else 'stale'
            print(f"held ({state}) by pid {h.get('pid')} for {int(time.time() - h.get('since', 0))} s: {h.get('cmd')}  [{h.get('cwd')}]")
        return 0
    if len(sys.argv) < 4 or sys.argv[1] != 'run' or sys.argv[2] != '--':
        print(__doc__)
        return 2
    cmd = sys.argv[3:]
    start, said = time.time(), False
    got = take()
    while not got and time.time() - start < MAX_WAIT:
        if not said:
            h = holder() or {}
            print(f"heavy.py: waiting for the lock (held by pid {h.get('pid')}: {h.get('cmd')})", flush=True)
            said = True
        time.sleep(5)
        got = take()
    if not got:
        print('heavy.py: waited 9 min; running anyway: timings may be noisy', flush=True)
    try:
        return subprocess.call(cmd)
    finally:
        if got:
            release()


if __name__ == '__main__':
    sys.exit(main())
