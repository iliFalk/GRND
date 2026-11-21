#!/usr/bin/env python3
"""Turn numbers into a line chart on the ARC grammar.

    python3 tools/chart.py --data 12,18,15,22,9,17,24 --labels Mon,Tue,Wed,Thu,Fri,Sat,Sun \
        --label "Runs · 7 days" --aria "Runs per day, peak 24 on Sunday"

Writes the figure to stdout; `--out docs/x.html` writes it to a file instead.

Why a generator: a hand-written path is a coordinate typed by a person, and the first
change of data makes it wrong. The geometry below is the plot's coordinate system — the
viewBox is 100 × 100 and the box is stretched by CSS, so a path is normalised and no value
of the frame enters the numbers. Colours, stroke widths and the marker size come from
tokens/tokens.json through var(--arc-*); this script writes no colour.

The plot stretches with its container and the strokes do not: every mark carries
`vector-effect: non-scaling-stroke`, and the marker is a zero-length round-capped segment,
which a stretched viewBox cannot turn into an ellipse.
"""
import argparse
import html
import json
import pathlib
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
TOKENS = ROOT / "tokens" / "tokens.json"

# Plot geometry: three gridlines, the top one at y = 0 so the marker can sit on it.
GRID = (0.0, 50.0, 100.0)
SIZE = 100.0  # the viewBox is 100 × 100 whatever the frame
# The first and last point sit one unit inside the box, because the marker is a dot centred on the
# newest value: on the edge, half of it would paint outside the plot and over the frame.
PLOT_MIN, PLOT_MAX = 1.0, 99.0


def series(values: list[float]) -> tuple[float, float]:
    return min(values), max(values)


def points(values: list[float], floor: float, ceiling: float) -> list[tuple[float, float]]:
    span = (ceiling - floor) or 1.0
    width = PLOT_MAX - PLOT_MIN
    step = width / (len(values) - 1) if len(values) > 1 else width
    return [
        (PLOT_MIN + i * step, SIZE - (v - floor) / span * SIZE) for i, v in enumerate(values)
    ]


def number(value: float) -> str:
    """Two decimals, no trailing zeros: a coordinate, not a measurement to the micron."""
    text = f"{value:.2f}".rstrip("0").rstrip(".")
    return text or "0"


def axis_values(floor: float, ceiling: float) -> tuple[str, str, str]:
    mid = floor + (ceiling - floor) / 2
    fmt = lambda v: number(v) if v != int(v) else str(int(v))
    return fmt(ceiling), fmt(mid), fmt(floor)


def figure(
    values: list[float],
    labels: list[str],
    label: str,
    aria: str,
    floor: float | None,
    ceiling: float | None,
) -> str:
    lo, hi = series(values)
    floor = lo if floor is None else floor
    ceiling = hi if ceiling is None else ceiling
    pts = points(values, floor, ceiling)
    top, mid, bottom = axis_values(floor, ceiling)

    grid = "\n".join(
        f'        <line x1="0" y1="{number(y)}" x2="{SIZE}" y2="{number(y)}"/>' for y in GRID
    )
    area = (
        f"M{number(pts[0][0])} {number(SIZE)} "
        + " ".join(f"L{number(x)} {number(y)}" for x, y in pts)
        + f" L{number(pts[-1][0])} {number(SIZE)} Z"
    )
    line = "M" + " L".join(f"{number(x)} {number(y)}" for x, y in pts)
    px, py = pts[-1]
    peak = max(range(len(values)), key=lambda i: values[i])

    x_labels = [labels[0], labels[len(labels) // 2], labels[-1]] if len(labels) >= 3 else labels
    x_row = "".join(f"<span>{html.escape(text)}</span>" for text in x_labels)

    return f"""<figure class="arc-chart">
  <figcaption class="arc-chart__head">
    <span class="arc-chart__label">{html.escape(label)}</span>
    <span class="arc-chart__peak">{html.escape(labels[peak])} · {number(values[peak])}</span>
  </figcaption>
  <div class="arc-chart__body">
    <div class="arc-chart__y" aria-hidden="true"><span>{top}</span><span>{mid}</span><span>{bottom}</span></div>
    <svg class="arc-chart__plot" viewBox="0 0 100 100" preserveAspectRatio="none" role="img"
         aria-label="{html.escape(aria)}">
      <g class="arc-chart__grid">
{grid}
      </g>
      <path class="arc-chart__area" d="{area}"/>
      <path class="arc-chart__line" d="{line}"/>
      <path class="arc-chart__point" d="M{number(px)} {number(py)} L{number(px)} {number(py)}"/>
    </svg>
    <div class="arc-chart__x" aria-hidden="true">{x_row}</div>
  </div>
</figure>
"""


def main(argv: list[str]) -> int:
    parser = argparse.ArgumentParser(description="Emit an ARC line chart as HTML.")
    parser.add_argument("--data", required=True, help="comma separated numbers")
    parser.add_argument("--labels", required=True, help="comma separated labels, one per number")
    parser.add_argument("--label", default="", help="the chart's own name, above the plot")
    parser.add_argument("--aria", default="", help="the sentence a reader who cannot see it gets")
    parser.add_argument("--min", type=float, default=None, help="floor of the axis (default: the low value)")
    parser.add_argument("--max", type=float, default=None, help="ceiling of the axis (default: the high value)")
    parser.add_argument("--out", default="", help="write to this file instead of stdout")
    args = parser.parse_args(argv)

    values = [float(v) for v in args.data.split(",")]
    labels = [v.strip() for v in args.labels.split(",")]
    if len(values) != len(labels):
        parser.error("--data and --labels must have the same length")
    if len(values) < 2:
        parser.error("a line needs two points")
    if not args.aria:
        parser.error("--aria is required: a chart without its sentence is decoration")

    text = figure(values, labels, args.label or args.aria, args.aria, args.min, args.max)
    if args.out:
        pathlib.Path(args.out).write_text(text, encoding="utf-8")
        print(f"{args.out} written — {len(values)} points")
    else:
        sys.stdout.write(text)
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
