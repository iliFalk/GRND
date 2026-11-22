#!/usr/bin/env python3
"""Build dist/arc.css from tokens/tokens.json plus the hand-written CSS in src/.

    python3 tools/build.py           # write dist/arc.css
    python3 tools/build.py --check    # exit 1 when dist/arc.css is stale

No dependency, no watcher: the file is small and the whole dictionary is read on every run.
Element CSS keeps var(--arc-*) only, so a value lives in tokens.json and nowhere else.
"""
import json
import pathlib
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
TOKENS = ROOT / "tokens" / "tokens.json"
DIST = ROOT / "dist" / "arc.css"

# semantic group -> CSS prefix. Text colours become --arc-fg-* so the size scale keeps --arc-fs-*.
PREFIX = {
    "bg": "bg",
    "line": "line",
    "fg": "fg",
    "accent": "accent",
    "status": "status",
    "graphic": "graphic",
    "overlay": "overlay",
    "opacity": "opacity",
}

HEADER = """/* ARC {version} — generated file. Do not edit.
   Source: tokens/tokens.json · builder: tools/build.py
   Element CSS lives in src/*.css and uses var(--arc-*) only. */
"""


def load() -> dict:
    return json.loads(TOKENS.read_text(encoding="utf-8"))


def resolve(value: str, primitives: dict) -> str:
    """Turn {cyan-400} into #00D4FF. One level is enough: semantics never chain."""
    if not isinstance(value, str):
        return value
    if value.startswith("{") and value.endswith("}"):
        return primitives[value[1:-1]]
    return value


def scheme_block(d: dict, semantic: dict, indent: str = "  ") -> list[str]:
    prim = d["primitive"]["colour"]
    out = []
    for group, prefix in PREFIX.items():
        values = semantic.get(group)
        if not values:
            continue
        for name, value in values.items():
            out.append(f"{indent}--arc-{prefix}-{name}: {resolve(value, prim)};")
    return out


def tokens_css(d: dict) -> str:
    prim = d["primitive"]["colour"]
    out = [":root {"]

    unit = d["fluid"]["unit"]
    out.append(f"  --arc-u: clamp({unit['min']}, {unit['pref']}, {unit['max']});")
    tunit = d["fluid"]["text-unit"]
    out.append(f"  --arc-fs: clamp({tunit['min']}, {tunit['pref']}, {tunit['max']});")
    out.append("")

    for group, prefix in PREFIX.items():
        values = d["semantic"].get(group)
        if not values:
            continue
        for name, value in values.items():
            out.append(f"  --arc-{prefix}-{name}: {resolve(value, prim)};")
        out.append("")
    dark_colours = [line for line in out if line.strip().startswith("--arc-") and "space" not in line and "fs-" not in line]

    for name, multiplier in d["space"].items():
        out.append(f"  --arc-space-{name}: calc(var(--arc-u) * {multiplier});")
    out.append("")

    for name, multiplier in d["size"].items():
        out.append(f"  --arc-fs-{name}: calc(var(--arc-fs) * {multiplier});")
    out.append("")

    for name, value in d.get("control", {}).items():
        if name != "note":
            out.append(f"  --arc-control-{name}: {value};")
    out.append("")

    for name, value in d["radius"].items():
        if name != "note":
            out.append(f"  --arc-radius-{name}: {value};")
    out.append("")

    for name, value in d["stroke"].items():
        out.append(f"  --arc-stroke-{name}: {value};")
    out.append("")

    for name, value in d.get("effect", {}).items():
        if name != "note":
            out.append(f"  --arc-effect-{name}: {value};")
    out.append("")

    for name, value in d.get("shadow", {}).items():
        if name != "note":
            out.append(f"  --arc-shadow-{name}: {value};")
    out.append("")

    for name, value in d.get("chart", {}).items():
        if name != "note":
            out.append(f"  --arc-chart-{name}: {value};")
    out.append("")

    for name, value in d.get("tracking", {}).items():
        out.append(f"  --arc-tracking-{name}: {value};")
    out.append("")

    for name, value in d["glow"].items():
        if name != "note":
            out.append(f"  --arc-glow-{name}: {value};")
    out.append("")

    for name, value in d["motion"].items():
        css_name = f"--arc-ease-{name[5:]}" if name.startswith("ease-") else f"--arc-motion-{name}"
        out.append(f"  {css_name}: {value};")
    out.append("")

    out.append(f"  --arc-font-ui: \"{d['typeface']['ui']}\", system-ui, sans-serif;")
    out.append(f"  --arc-font-mono: {d['typeface']['mono']}, ui-monospace, monospace;")
    out.append("}")

    # the light scheme: the same role names, the values inverted
    light = d.get("semantic-light")
    if light:
        block = scheme_block(d, light)
        out.append("")
        out.append("@media (prefers-color-scheme: light) {")
        out.append('  :root:not([data-scheme="dark"]) {')
        out.extend("  " + line for line in block)
        out.append("  }")
        out.append("}")
        out.append("")
        out.append('[data-scheme="light"] {')
        out.extend(block)
        out.append("}")

    return "\n".join(out) + "\n"


def sources() -> list[pathlib.Path]:
    return sorted((ROOT / "src").glob("*.css"))


def build() -> str:
    d = load()
    parts = [HEADER.format(version=d["meta"]["version"]), tokens_css(d)]
    for path in sources():
        parts.append(f"\n/* src/{path.name} */\n{path.read_text(encoding='utf-8').rstrip()}\n")
    return "".join(parts)


def main(argv: list[str]) -> int:
    css = build()
    if "--check" in argv:
        current = DIST.read_text(encoding="utf-8") if DIST.exists() else ""
        if current != css:
            print("dist/arc.css is stale — run: python3 tools/build.py")
            return 1
        print("dist/arc.css is current")
        return 0
    DIST.parent.mkdir(parents=True, exist_ok=True)
    DIST.write_text(css, encoding="utf-8")
    lines = css.count("\n")
    print(f"dist/arc.css written — {lines} lines, {len(css)} bytes")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
