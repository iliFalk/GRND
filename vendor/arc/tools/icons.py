#!/usr/bin/env python3
"""Check the icon sprite: one grid, closed bounds, unique names.

    python3 tools/icons.py          # prints every glyph, exits 1 on a violation
    python3 tools/icons.py --quiet  # the count only

Why a tool: a glyph with a point outside the 24-unit grid is clipped by the viewBox, and a clipped
glyph still draws a shape — it reads as a design choice until somebody compares it with the row.
The frame audit catches a glyph that draws *nothing*; this catches one that draws the wrong thing.

The path walker understands the absolute and relative forms of M, L, H, V, C, S, Q, T, A and Z, so a
relative step like `l-6 6` is measured at the point it lands on rather than as a stray -6.
"""
import json
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
SPRITE = ROOT / "assets" / "icons.svg"
GRID = 24.0
NAME = re.compile(r"^[a-z][a-z0-9-]*$")
SYMBOL = re.compile(r"<symbol\b([^>]*)>(.*?)</symbol>", re.S)
SHAPE = re.compile(r"<(path|circle|rect|line|polyline|polygon|ellipse)\b([^>]*)>")
ATTR = re.compile(r'([a-zA-Z-]+)="([^"]*)"')
TOKEN = re.compile(r"[MmLlHhVvCcSsQqTtAaZz]|-?\d*\.?\d+")
# numbers each command consumes
ARITY = {"M": 2, "L": 2, "T": 2, "H": 1, "V": 1, "C": 6, "S": 4, "Q": 4, "A": 7, "Z": 0}


def path_points(d: str) -> list[tuple[float, float]]:
    """Every point a path lands on, plus its curve handles. Enough to bound the drawing."""
    tokens = TOKEN.findall(d)
    out: list[tuple[float, float]] = []
    x = y = 0.0
    start = (0.0, 0.0)
    command = "M"
    i = 0
    while i < len(tokens):
        token = tokens[i]
        if token.isalpha():
            command = token
            i += 1
            if command in "Zz":
                x, y = start
                out.append((x, y))
            continue
        upper = command.upper()
        count = ARITY.get(upper, 0)
        if count == 0:
            i += 1
            continue
        args = [float(v) for v in tokens[i : i + count]]
        if len(args) < count:
            break
        i += count
        relative = command.islower()

        if upper in ("H", "V"):
            if upper == "H":
                x = x + args[0] if relative else args[0]
            else:
                y = y + args[0] if relative else args[0]
            out.append((x, y))
            continue

        pairs = list(zip(args[0::2], args[1::2]))
        if upper == "A":
            pairs = [(args[5], args[6])]
        # A curve's handles are all measured from the point the command started at, not chained:
        # `c3-4 5.6-6 10-6` is three points around one base. A line chains.
        chained = upper == "L"
        base = (x, y)
        for px, py in pairs:
            origin = (x, y) if chained else base
            nx = origin[0] + px if relative else px
            ny = origin[1] + py if relative else py
            out.append((nx, ny))
            if upper == "M":
                start = (nx, ny)
                command = "l" if relative else "L"
                chained = True
            x, y = nx, ny
    return out


def shape_points(kind: str, attrs: dict[str, str]) -> list[tuple[float, float]]:
    if kind == "path":
        return path_points(attrs.get("d", ""))
    if kind == "circle":
        cx, cy, r = (float(attrs.get(k, 0)) for k in ("cx", "cy", "r"))
        return [(cx - r, cy - r), (cx + r, cy + r)]
    if kind == "ellipse":
        cx, cy = float(attrs.get("cx", 0)), float(attrs.get("cy", 0))
        rx, ry = float(attrs.get("rx", 0)), float(attrs.get("ry", 0))
        return [(cx - rx, cy - ry), (cx + rx, cy + ry)]
    if kind == "line":
        return [(float(attrs.get(k, 0)), 0) for k in ("x1", "x2")] + [
            (0, float(attrs.get(k, 0))) for k in ("y1", "y2")
        ]
    if kind in ("polyline", "polygon"):
        numbers = [float(n) for n in TOKEN.findall(attrs.get("points", ""))]
        return list(zip(numbers[0::2], numbers[1::2]))
    x, y = float(attrs.get("x", 0)), float(attrs.get("y", 0))
    w, h = float(attrs.get("width", 0)), float(attrs.get("height", 0))
    return [(x, y), (x + w, y + h)]


def check() -> tuple[list[str], list[tuple[str, int, float, float]]]:
    text = SPRITE.read_text(encoding="utf-8")
    problems: list[str] = []
    rows: list[tuple[str, int, float, float]] = []
    seen: set[str] = set()

    for raw_attrs, body in SYMBOL.findall(text):
        attrs = dict(ATTR.findall(raw_attrs))
        name = attrs.get("id", "")
        if not name:
            problems.append("a symbol carries no id")
            continue
        if not NAME.match(name):
            problems.append(f"{name}: the name is not kebab-case")
        if name in seen:
            problems.append(f"{name}: the name is used twice")
        seen.add(name)

        if attrs.get("viewBox", "").split() != ["0", "0", "24", "24"]:
            problems.append(f"{name}: viewBox is {attrs.get('viewBox', 'missing')}, want 0 0 24 24")

        shapes = SHAPE.findall(body)
        if not shapes:
            problems.append(f"{name}: carries no shape")
            continue

        points: list[tuple[float, float]] = []
        for kind, raw in shapes:
            points.extend(shape_points(kind, dict(ATTR.findall(raw))))
        if not points:
            problems.append(f"{name}: carries no coordinates")
            continue
        low = min(min(px, py) for px, py in points)
        high = max(max(px, py) for px, py in points)
        if low < 0 or high > GRID:
            problems.append(f"{name}: a point is outside the grid ({low:g}…{high:g})")
        rows.append((name, len(shapes), low, high))

    if not rows and not problems:
        problems.append("the sprite holds no symbol")

    manifest = ROOT / "assets" / "icons-manifest.json"
    catalogue = ROOT / "assets" / "icons"
    if manifest.exists():
        wanted = json.loads(manifest.read_text(encoding="utf-8"))["glyphs"]
        if catalogue.is_dir():
            absent = [n for n in wanted if not (catalogue / f"{n}.svg").exists()]
            if absent:
                problems.append("not in the catalogue: " + ", ".join(absent))
        if set(wanted) != seen:
            extra = sorted(seen - set(wanted))
            gone = sorted(set(wanted) - seen)
            problems.append(f"the sprite and the manifest differ — extra {extra}, missing {gone}")
    return problems, rows


def main(argv: list[str]) -> int:
    problems, rows = check()
    if "--quiet" not in argv:
        print(f"{len(rows)} glyphs · grid {GRID:g} · stroke from the stylesheet")
        for name, shapes, low, high in rows:
            print(f"  {name:<14} {shapes} shape(s)   bounds {low:g}…{high:g}")
    for problem in problems:
        print(f"FAIL {problem}", file=sys.stderr)
    if problems:
        return 1
    print(f"icons: {len(rows)} glyphs within the grid")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
