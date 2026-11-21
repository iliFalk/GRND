# ARC-design-system

A design system for high-intensity interfaces, in a dark and a light scheme. Version 2.2.0.

![The dark scheme at the master frame](docs/screenshot.png)

![The light scheme at the same frame](docs/screenshot-light.png)

- **What it is:** one JSON dictionary, the CSS built from it, and a page that renders every element at the phone frame.
- **What it does:** it turns a cyberpunk look into values that can be measured and reused: zero radius with one chamfer, cyan as the system accent, and a contrast gate that fails when a pair drops under 4.5:1. Without it every project re-invents the glow and ships an unreadable button.
- **What it needs:** Python 3.9 for the build and the measurement, Node 22 for the screenshot tool. Nothing to install.
- **How to start:** run `python3 tools/build.py`, then open `index.html` — it renders every element at 390 × 844. `icons.html` shows the icon catalogue, where a new mark is taken from.

## Install

1. Take the release pack (`dist/arc-<version>.tgz` for the version in `tokens/tokens.json`) and unpack it into your project as `vendor/arc/`. It holds the
   dictionary, the sources, the built stylesheet, the sprite and its fonts, `index.html`, the docs and the tools.
2. Link `vendor/arc/dist/arc.css`, then use the element classes and `var(--arc-*)` only. Check what you wrote with
   the filter and the frame audit: `python3 vendor/arc/tools/lint.py .` and
   `node vendor/arc/tools/shot.mjs --url http://127.0.0.1:8000/your-screen.html --audit`.
   `tools/gate.sh` belongs to the system itself — it rebuilds `dist/` and checks the system's own showcase.

For updates, clone the repository instead: `git clone https://github.com/iliFalk/ARC-design-system.git` — then `git pull` fetches later versions.

## Use

| Path | Holds |
|---|---|
| `tokens/tokens.json` | every colour, size, radius and duration, plus the contrast pairs the gate measures |
| `src/base.css`, `src/elements.css` | the written layer: fonts, shell, type, buttons, panels, fields, chips, meters, bar |
| `dist/arc.css` | generated — link this file, never edit it |
| `tools/build.py` | writes `dist/arc.css`; `--check` fails on a stale file |
| `tools/contrast.py` | measures the declared pairs; exits 1 when one fails |
| `tools/shot.mjs` | renders a page at an exact frame and audits it for clipping and small targets |
| `tools/package.py` | writes `dist/arc-<version>.tgz`, the release a project takes |
| `CHANGELOG.md` | what changed between two versions |
| `assets/icons/` | the icon catalogue: 2410 glyphs on a 24-unit grid, Lucide 1.77.0, ISC |
| `assets/icons-manifest.json` | the glyph names the shipped sprite carries — add a name, rebuild |
| `icons.html` | every glyph with its name; `docs/icons.png` is the same page as a picture |

## Docs

- `docs/CANON.md` — the rules, how a project applies them, how an engineer implements them
- `docs/DECISIONS.md` — what is decided, on whose word, and which forks are still open
- `AGENTS.md` — the rules a coding session follows in this folder
- `research/` — the sources behind every number
