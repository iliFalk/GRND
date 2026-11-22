#!/usr/bin/env python3
"""Check that every element in the canon is rendered once, and every icon drawn exists.

    python3 tools/elements.py          # prints the surface, exits 1 on a drift
    python3 tools/elements.py --quiet  # the count only

Two rules from §10 that nothing measured before: "add it to `index.html` once, at the real size" and "the
sprite is the only place a mark is drawn". Both drift silently — an element that is documented and never
rendered looks finished in the canon, and a `<use>` that names a glyph outside the manifest draws an empty
box the frame audit would only catch on a page it renders.
"""
import json
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
CANON = ROOT / "docs" / "CANON.md"
PAGE = ROOT / "index.html"
MANIFEST = ROOT / "assets" / "icons-manifest.json"

HEADING = re.compile(r"^### 8\.\d+ .*?— `([^`]+)`", re.M)
CLASS = re.compile(r"\.([a-z][a-z0-9_-]*)")
USE = re.compile(r'icons\.svg#([a-z0-9-]+)')


def check() -> tuple[list[str], int, int]:
    problems: list[str] = []
    if not CANON.exists():
        # a consumer's copy of the system keeps no canon: this check belongs to the system repository
        raise SystemExit("no docs/CANON.md in this tree — the surface check belongs to the system repository")
    canon = CANON.read_text(encoding="utf-8")
    page = PAGE.read_text(encoding="utf-8")

    classes = set()
    for selector in HEADING.findall(canon):
        classes.update(CLASS.findall(selector))
    if not classes:
        problems.append("no element heading parsed out of the canon")

    rendered = set()
    for attr in re.findall(r'class="([^"]+)"', page):
        rendered.update(attr.split())

    missing = sorted(c for c in classes if c not in rendered)
    for name in missing:
        problems.append(f"{name}: named in §8 and not rendered in index.html")

    manifest = json.loads(MANIFEST.read_text(encoding="utf-8"))["glyphs"]
    used = sorted(set(USE.findall(page)))
    for name in used:
        if name not in manifest:
            problems.append(f"{name}: drawn in index.html and not in the sprite")
    return problems, len(classes), len(used)


def main(argv: list[str]) -> int:
    problems, elements, glyphs = check()
    if "--quiet" not in argv:
        print(f"{elements} element selectors in §8 · {glyphs} glyphs drawn in the page")
    for problem in problems:
        print(f"FAIL {problem}", file=sys.stderr)
    if problems:
        return 1
    print(f"surface: {elements} elements rendered, {glyphs} glyphs resolve")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
