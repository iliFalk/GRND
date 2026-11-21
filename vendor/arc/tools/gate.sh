#!/usr/bin/env bash
# The gate a commit must pass. Run from anywhere: bash tools/gate.sh
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."

python3 tools/build.py
python3 tools/build.py --check
python3 tools/contrast.py
python3 tools/icons_sprite.py --check
python3 tools/icons.py --quiet
python3 tools/elements.py --quiet
python3 tools/markup.py --check
# Geometry runs against the page itself: a file origin loads the sheet and the fonts, and boxes are what
# this tool reads, so the sprite's HTTP requirement does not apply here.
node tools/geometry.mjs --url "file://$PWD/index.html" --contract tokens/geometry.json --widths 390,768 --height 844
python3 tools/lint.py --markup index.html

echo "gate: clean"
