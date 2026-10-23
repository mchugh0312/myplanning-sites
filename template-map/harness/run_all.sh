#!/usr/bin/env bash
# Regenerate the template map. Needs: python3, playwright (pip) with chromium,
# tinycss2, beautifulsoup4.
#   TEMPLATE_DIR  folder holding template-*.html and site-runtime.js
#                 (default: ../../public if it exists, else ../..)
#   MAP_OUT       where results go (default: ./out)
#   MAP_PORT      local port for the static server (default: 8765)
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
# Default: the repo's public/ folder (myplanning-sites/public), where
# site-runtime.js and the templates live; else the folder two levels up.
ROOT="$(cd "$HERE/../.." && pwd)"
if [ -z "${TEMPLATE_DIR:-}" ]; then
  if [ -f "$ROOT/public/site-runtime.js" ]; then TEMPLATE_DIR="$ROOT/public"; else TEMPLATE_DIR="$ROOT"; fi
fi
if [ ! -f "$TEMPLATE_DIR/site-runtime.js" ]; then
  echo "No site-runtime.js in $TEMPLATE_DIR - set TEMPLATE_DIR to the folder holding the templates." >&2; exit 2
fi
export TEMPLATE_DIR
export MAP_OUT="${MAP_OUT:-$HERE/out}"
export MAP_PORT="${MAP_PORT:-8765}"
mkdir -p "$MAP_OUT"
# The templates load /site-runtime.js from the root, so serve the folder itself.
( cd "$TEMPLATE_DIR" && exec python3 -m http.server "$MAP_PORT" >/dev/null 2>&1 ) &
SRV=$!
trap 'kill $SRV 2>/dev/null || true' EXIT
sleep 1
cd "$HERE"
python3 run.py          # fonts, colours, titles (desktop, mobile, editor-shaped)
python3 run_paint.py    # borders, buttons, inputs; the rule behind each colour
python3 fmt.py          # formatting survival matrix
python3 fmt_read.py > "$MAP_OUT/formatting-matrix.txt"
python3 sections.py     # section visibility
python3 analyse.py
python3 build_map.py
python3 render_md.py
echo "Wrote $MAP_OUT/template-map.json and $MAP_OUT/TEMPLATE-MAP.md"
