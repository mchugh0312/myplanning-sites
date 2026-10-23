#!/usr/bin/env bash
# Builds the editor's REAL RichEditor (the Content box) from Website.txt into a
# bare page and drives it in Chromium: design body style, the I button lit in
# default italic, un-italic saved as font-style:normal, title and dress-code
# marks, the RSVP placeholder. Softr-only imports are replaced by stubs/.
#   bash run.sh path/to/Website.txt     (the editor code you paste into Softr)
#   With no argument it looks for myplanning-sites/Website.txt.
# Needs node (npx), python3 + playwright.
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
SRC="${1:-$HERE/../../../Website.txt}"
WORK="$(mktemp -d)"; trap 'rm -rf "$WORK"; kill ${SRV:-0} 2>/dev/null || true' EXIT
cp -r "$HERE/stubs" "$HERE/entry.jsx" "$HERE/entry_dividers.jsx" "$WORK/"
tr -d '\r' < "$SRC" > "$WORK/editor.jsx"; echo 'export { RichEditor };' >> "$WORK/editor.jsx"
( cd "$WORK" && npm init -y >/dev/null && npm i --silent esbuild@0.24.0 react@18.3.1 react-dom@18.3.1 lucide-react@0.383.0 >/dev/null )
( cd "$WORK" && npx esbuild entry.jsx --bundle --outfile=bundle.js --loader:.jsx=jsx --jsx=automatic \
    --alias:@/lib/datasource=./stubs/datasource.js --alias:@/components/ui/switch=./stubs/switch.js \
    --alias:sonner=./stubs/sonner.js --define:process.env.NODE_ENV='"development"' --log-level=error )
( cd "$WORK" && npx esbuild entry_dividers.jsx --bundle --outfile=bundle_dividers.js --loader:.jsx=jsx --jsx=automatic \
    --alias:@/lib/datasource=./stubs/datasource.js --alias:@/components/ui/switch=./stubs/switch.js \
    --alias:sonner=./stubs/sonner.js --define:process.env.NODE_ENV='"development"' --log-level=error )
echo '<!doctype html><html><body><div id="root"></div><script src="bundle.js"></script></body></html>' > "$WORK/index.html"
echo '<!doctype html><html><body style="background:#fff"><div id="root"></div><script src="bundle_dividers.js"></script></body></html>' > "$WORK/index_dividers.html"
PORT="${PORT:-8899}"; ( cd "$WORK" && exec python3 -m http.server "$PORT" >/dev/null 2>&1 ) & SRV=$!; sleep 1
echo "== Content box: styles, buttons, RSVP placeholder"
python3 "$HERE/test_box.py" "$PORT"
echo "== Dividers (MP-918); screenshots go to \$SHOT_DIR (default: this folder)"
SHOT_DIR="${SHOT_DIR:-$HERE}" python3 "$HERE/test_dividers.py" "$PORT"
