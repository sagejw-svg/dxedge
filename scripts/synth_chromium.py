"""Find the Chromium the /synth test scripts launch.

Until 16 Nov 2026 each script carried its own list, led by /opt/pw-browsers/chromium-1194, a folder that
no longer exists on the job boxes (Playwright there ships chromium-1243). Every run fell through to
/opt/google/chrome/chrome, a symlink someone made on 5 Nov; a box without that symlink stopped with a
bare StopIteration. This looks in a fixed order and says what it tried when it finds nothing:

  1. SYNTH_CHROMIUM, when set and present (a set path that does not exist is reported on stderr and skipped,
     as the old lists skipped it)
  2. the newest Playwright-managed Chromium under PLAYWRIGHT_BROWSERS_PATH (default /opt/pw-browsers) or
     ~/.cache/ms-playwright, either folder layout (chrome-linux or chrome-linux64)
  3. the system paths the old lists named
"""
import glob, os, re, sys

_SYSTEM = ["/opt/google/chrome/chrome", "/usr/bin/google-chrome", "/usr/local/bin/chrome", "/usr/bin/chromium"]


def _revision(path):
    m = re.search(r"chromium-(\d+)", path)
    return int(m.group(1)) if m else -1


def candidates():
    roots = [os.environ.get("PLAYWRIGHT_BROWSERS_PATH", "") or "/opt/pw-browsers",
             os.path.expanduser("~/.cache/ms-playwright")]
    managed = []
    for r in roots:
        for layout in ("chrome-linux", "chrome-linux64"):
            managed += glob.glob(os.path.join(r, "chromium-*", layout, "chrome"))
    managed = sorted(set(managed), key=_revision, reverse=True)
    return managed + _SYSTEM


def find_chromium():
    env = os.environ.get("SYNTH_CHROMIUM", "")
    if env:
        if os.path.exists(env):
            return env
        # the job prompts still name the 1194 path, so a stale setting warns and the search goes on
        sys.stderr.write(f"SYNTH_CHROMIUM is set to {env!r}, which does not exist; looking elsewhere\n")
    tried = candidates()
    for p in tried:
        if os.path.exists(p):
            return p
    raise SystemExit("No Chromium found. Set SYNTH_CHROMIUM to a chrome binary. Tried: " + ", ".join(tried))


if __name__ == "__main__":
    print(find_chromium())
