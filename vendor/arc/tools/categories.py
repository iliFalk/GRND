#!/usr/bin/env python3
"""Check a product's categorical palette against the system accent and status colours.

    python3 tools/categories.py                      # the shipped example set
    python3 tools/categories.py path/to/categories.json

A product may own category colours (CANON §2, D9). Two conditions keep them from being read as a
signal of the system:

  1. contrast  — 3:1 or more on the base ground (a category is used as a mark or a rule, not as body text)
  2. hue       — at least 40° away from the accent and from every status colour, unless the colour is
                 near-neutral (saturation below 0.25), where hue carries nothing

The rule exists because a category hue inside the status range turns "Legs" into "warning".
"""
import json
import pathlib
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
TOKENS = ROOT / "tokens" / "tokens.json"
EXAMPLE = ROOT / "tokens" / "categories.example.json"

MIN_CONTRAST = 3.0
MIN_HUE_GAP = 40.0
NEUTRAL_SATURATION = 0.25

SYSTEM = {
    "accent.primary": "accent",
    "status.attention": "attention",
    "status.critical": "critical",
    "status.error": "error",
    "status.ok": "ok",
}


def parse(hex_colour: str) -> tuple[float, float, float]:
    h = hex_colour.strip().lstrip("#")
    return tuple(int(h[i:i + 2], 16) / 255 for i in (0, 2, 4))


def channel(value: float) -> float:
    return value / 12.92 if value <= 0.04045 else ((value + 0.055) / 1.055) ** 2.4


def luminance(rgb: tuple[float, float, float]) -> float:
    r, g, b = (channel(c) for c in rgb)
    return 0.2126 * r + 0.7152 * g + 0.0722 * b


def contrast(a: str, b: str) -> float:
    hi, lo = sorted((luminance(parse(a)), luminance(parse(b))), reverse=True)
    return (hi + 0.05) / (lo + 0.05)


def hsl(hex_colour: str) -> tuple[float, float, float]:
    r, g, b = parse(hex_colour)
    high, low = max(r, g, b), min(r, g, b)
    delta = high - low
    lightness = (high + low) / 2
    if delta == 0:
        return 0.0, 0.0, lightness
    saturation = delta / (1 - abs(2 * lightness - 1))
    if high == r:
        hue = ((g - b) / delta) % 6
    elif high == g:
        hue = (b - r) / delta + 2
    else:
        hue = (r - g) / delta + 4
    return hue * 60, saturation, lightness


def hue_gap(a: float, b: float) -> float:
    gap = abs(a - b) % 360
    return min(gap, 360 - gap)


def load_system() -> dict[str, str]:
    tokens = json.loads(TOKENS.read_text(encoding="utf-8"))
    primitives = tokens["primitive"]["colour"]
    resolved = {}
    for key, label in SYSTEM.items():
        group, name = key.split(".")
        value = tokens["semantic"][group][name]
        resolved[label] = primitives[value[1:-1]] if value.startswith("{") else value
    return resolved


def main(argv: list[str]) -> int:
    tokens = json.loads(TOKENS.read_text(encoding="utf-8"))
    ground = tokens["primitive"]["colour"][
        tokens["semantic"]["bg"]["base"].strip("{}")
    ]
    path = pathlib.Path(argv[0]) if argv else EXAMPLE
    if not path.is_file():
        print(f"no category file: {path}")
        return 2
    categories = json.loads(path.read_text(encoding="utf-8"))["categories"]

    system = load_system()
    system_hues = {label: hsl(value)[0] for label, value in system.items()}

    print(f"categorical palette — {path.name} against {TOKENS.relative_to(ROOT)}")
    print(f"ground {ground} · minimum contrast {MIN_CONTRAST}:1 · minimum hue gap {MIN_HUE_GAP:.0f}°")
    print("")
    print(f"{'category':<16}{'hex':>10}{'contrast':>10}{'hue':>7}{'sat':>6}  nearest system hue")

    failed = 0
    for name, value in categories.items():
        hue, saturation, _ = hsl(value)
        ratio = contrast(value, ground)
        nearest = min(system_hues.items(), key=lambda item: hue_gap(hue, item[1]))
        gap = hue_gap(hue, nearest[1])
        neutral = saturation < NEUTRAL_SATURATION
        problems = []
        if ratio < MIN_CONTRAST:
            problems.append(f"contrast {ratio:.2f} < {MIN_CONTRAST}")
        if not neutral and gap < MIN_HUE_GAP:
            problems.append(f"{gap:.0f}° from {nearest[0]}")
        failed += 1 if problems else 0
        verdict = "ok" if not problems else "FAIL " + ", ".join(problems)
        print(
            f"{name:<16}{value:>10}{ratio:>9.2f}:1{hue:>7.0f}{saturation:>6.2f}  "
            f"{nearest[0]:<10}{gap:>5.0f}°  {verdict}"
        )

    print("")
    print(f"{len(categories)} categories, {failed} outside the rule")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
