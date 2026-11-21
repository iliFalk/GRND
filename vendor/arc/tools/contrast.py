#!/usr/bin/env python3
"""Measure the contrast pairs declared in tokens/tokens.json.

    python3 tools/contrast.py          # print the table, exit 1 on a failing pair
    python3 tools/contrast.py --all    # also print every colour against every ground

A pair is compared as (foreground composited over background) against the background, so a
translucent hairline is measured as the colour a reader actually sees. A failed pair is a
blocking defect: fix the value in tokens.json, never the required minimum.
"""
import json
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
TOKENS = ROOT / "tokens" / "tokens.json"


def channel(value: float) -> float:
    return value / 12.92 if value <= 0.04045 else ((value + 0.055) / 1.055) ** 2.4


def parse(colour: str) -> tuple[float, float, float, float]:
    """Return r, g, b in 0..1 and alpha."""
    colour = colour.strip()
    if colour.startswith("#"):
        r, g, b = (int(colour[i:i + 2], 16) for i in (1, 3, 5))
        return r / 255, g / 255, b / 255, 1.0
    match = re.match(r"rgba?\(([^)]+)\)", colour)
    if not match:
        raise ValueError(f"not a colour: {colour}")
    parts = [float(part) for part in match.group(1).split(",")]
    alpha = parts[3] if len(parts) > 3 else 1.0
    return parts[0] / 255, parts[1] / 255, parts[2] / 255, alpha


def over(top: str, bottom: str) -> tuple[float, float, float]:
    tr, tg, tb, ta = parse(top)
    br, bg, bb, _ = parse(bottom)
    return (
        tr * ta + br * (1 - ta),
        tg * ta + bg * (1 - ta),
        tb * ta + bb * (1 - ta),
    )


def luminance(rgb: tuple[float, float, float]) -> float:
    r, g, b = (channel(c) for c in rgb)
    return 0.2126 * r + 0.7152 * g + 0.0722 * b


def ratio(fg: str, bg: str) -> float:
    flat = over(fg, bg)
    hi, lo = sorted((luminance(flat), luminance(parse(bg)[:3])), reverse=True)
    return (hi + 0.05) / (lo + 0.05)


def flatten(tokens: dict, semantic: dict) -> dict[str, str]:
    primitives = tokens["primitive"]["colour"]
    flat = {}
    for group, values in semantic.items():
        if not isinstance(values, dict):
            continue
        for name, value in values.items():
            if isinstance(value, str) and value.startswith("{"):
                value = primitives[value[1:-1]]
            flat[f"{group}.{name}"] = value
    return flat


def main(argv: list[str]) -> int:
    tokens = json.loads(TOKENS.read_text(encoding="utf-8"))
    schemes = {"dark": tokens["semantic"], "light": tokens.get("semantic-light")}
    pairs_by_scheme = tokens["contrast"]
    failed = 0
    measured = 0

    for scheme, semantic in schemes.items():
        if not semantic:
            continue
        colours = flatten(tokens, semantic)
        print(f"ARC — declared contrast pairs · {scheme} scheme")
        print(f"{'pair':<34}{'ratio':>9}{'need':>7}  verdict")
        measured += check(colours, pairs_by_scheme[scheme])
        failed += FAILED[0]
        FAILED[0] = 0
        print("")

    print(f"{measured} pairs measured, {failed} below the required ratio")
    return 1 if failed else 0


FAILED = [0]


def check(colours, pairs) -> int:
    for pair in pairs:
        value = ratio(colours[pair["fg"]], colours[pair["bg"]])
        ok = value >= pair["min"]
        FAILED[0] += 0 if ok else 1
        print(f"{pair['fg'] + ' on ' + pair['bg']:<34}{value:>8.2f}:1{pair['min']:>7.1f}  {'ok' if ok else 'FAIL'}")
    return len(pairs)

    print("")
    print(f"{len(tokens['contrast']['pairs'])} pairs measured, {failed} below the required ratio")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
