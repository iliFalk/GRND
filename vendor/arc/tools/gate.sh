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
python3 tools/lint.py --markup index.html

echo "gate: clean"
