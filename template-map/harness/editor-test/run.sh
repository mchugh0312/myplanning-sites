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
cp -r "$HERE/stubs" "$HERE/entry.jsx" "$HERE/entry_dividers.jsx" "$HERE/entry_group.jsx" "$HERE/entry_shadow.jsx" "$HERE/entry_underlined.jsx" "$HERE/entry_erase.jsx" "$HERE/entry_travel.jsx" "$HERE/entry_imgset.jsx" "$HERE/entry_faq.jsx" "$WORK/"
tr -d '\r' < "$SRC" > "$WORK/editor.jsx"; echo 'export { RichEditor, ImageSet };' >> "$WORK/editor.jsx"
( cd "$WORK" && npm init -y >/dev/null && npm i --silent esbuild@0.24.0 react@18.3.1 react-dom@18.3.1 lucide-react@0.383.0 >/dev/null )
( cd "$WORK" && npx esbuild entry.jsx --bundle --outfile=bundle.js --loader:.jsx=jsx --jsx=automatic \
    --alias:@/lib/datasource=./stubs/datasource.js --alias:@/components/ui/switch=./stubs/switch.js \
    --alias:sonner=./stubs/sonner.js --define:process.env.NODE_ENV='"development"' --log-level=error )
( cd "$WORK" && npx esbuild entry_dividers.jsx --bundle --outfile=bundle_dividers.js --loader:.jsx=jsx --jsx=automatic \
    --alias:@/lib/datasource=./stubs/datasource.js --alias:@/components/ui/switch=./stubs/switch.js \
    --alias:sonner=./stubs/sonner.js --define:process.env.NODE_ENV='"development"' --log-level=error )
( cd "$WORK" && npx esbuild entry_group.jsx --bundle --outfile=bundle_group.js --loader:.jsx=jsx --jsx=automatic \
    --alias:@/lib/datasource=./stubs/datasource.js --alias:@/components/ui/switch=./stubs/switch.js \
    --alias:sonner=./stubs/sonner.js --define:process.env.NODE_ENV='"development"' --log-level=error )
echo '<!doctype html><html><body style="background:#fff"><div id="root"></div><script src="bundle_group.js"></script></body></html>' > "$WORK/index_group.html"
( cd "$WORK" && npx esbuild entry_shadow.jsx --bundle --outfile=bundle_shadow.js --loader:.jsx=jsx --jsx=automatic \
    --alias:@/lib/datasource=./stubs/datasource.js --alias:@/components/ui/switch=./stubs/switch.js \
    --alias:sonner=./stubs/sonner.js --define:process.env.NODE_ENV='"development"' --log-level=error )
echo '<!doctype html><html><body style="margin:0"><div id="host"></div><script src="bundle_shadow.js"></script></body></html>' > "$WORK/index_shadow.html"
( cd "$WORK" && npx esbuild entry_underlined.jsx --bundle --outfile=bundle_hb.js --loader:.jsx=jsx --jsx=automatic \
    --alias:@/lib/datasource=./stubs/datasource.js --alias:@/components/ui/switch=./stubs/switch.js \
    --alias:sonner=./stubs/sonner.js --define:process.env.NODE_ENV='"development"' --log-level=error )
echo '<!doctype html><html><body style="margin:0"><div id="host"></div><script src="bundle_hb.js"></script></body></html>' > "$WORK/index_underlined.html"
( cd "$WORK" && npx esbuild entry_erase.jsx --bundle --outfile=bundle_erase.js --loader:.jsx=jsx --jsx=automatic \
    --alias:@/lib/datasource=./stubs/datasource.js --alias:@/components/ui/switch=./stubs/switch.js \
    --alias:sonner=./stubs/sonner.js --define:process.env.NODE_ENV='"development"' --log-level=error )
echo '<!doctype html><html><body style="margin:0"><div id="host"></div><script src="bundle_erase.js"></script></body></html>' > "$WORK/index_erase.html"
( cd "$WORK" && npx esbuild entry_travel.jsx --bundle --outfile=bundle_travel.js --loader:.jsx=jsx --jsx=automatic \
    --alias:@/lib/datasource=./stubs/datasource.js --alias:@/components/ui/switch=./stubs/switch.js \
    --alias:sonner=./stubs/sonner.js --define:process.env.NODE_ENV='"development"' --log-level=error )
echo '<!doctype html><html><body style="margin:0"><div id="host"></div><script src="bundle_travel.js"></script></body></html>' > "$WORK/index_travel.html"
( cd "$WORK" && npx esbuild entry_imgset.jsx --bundle --outfile=bundle_imgset.js --loader:.jsx=jsx --jsx=automatic \
    --alias:@/lib/datasource=./stubs/datasource.js --alias:@/components/ui/switch=./stubs/switch.js \
    --alias:sonner=./stubs/sonner.js --define:process.env.NODE_ENV='"development"' --log-level=error )
echo '<!doctype html><html><body><div id="root"></div><script src="bundle_imgset.js"></script></body></html>' > "$WORK/index_imgset.html"
( cd "$WORK" && npx esbuild entry_faq.jsx --bundle --outfile=bundle_faq.js --loader:.jsx=jsx --jsx=automatic \
    --alias:@/lib/datasource=./stubs/datasource.js --alias:@/components/ui/switch=./stubs/switch.js \
    --alias:sonner=./stubs/sonner.js --define:process.env.NODE_ENV='"development"' --log-level=error )
echo '<!doctype html><html><body style="margin:0"><div id="host"></div><script src="bundle_faq.js"></script></body></html>' > "$WORK/index_faq.html"
echo '<!doctype html><html><body><div id="root"></div><script src="bundle.js"></script></body></html>' > "$WORK/index.html"
echo '<!doctype html><html><body style="background:#fff"><div id="root"></div><script src="bundle_dividers.js"></script></body></html>' > "$WORK/index_dividers.html"
PORT="${PORT:-8899}"; ( cd "$WORK" && exec python3 -m http.server "$PORT" >/dev/null 2>&1 ) & SRV=$!; sleep 1
echo "== Content box: styles, buttons, RSVP placeholder"
python3 "$HERE/test_box.py" "$PORT"
echo "== Dividers (MP-918); screenshots go to \$SHOT_DIR (default: this folder)"
SHOT_DIR="${SHOT_DIR:-$HERE}" python3 "$HERE/test_dividers.py" "$PORT"
echo "== Content box group (MP-915, MP-916, MP-920, MP-921, MP-935)"
python3 "$HERE/test_box_group.py" "$PORT"
echo "== Formatting a whole title, then coming back to it (MP-915, MP-333)"
python3 "$HERE/test_title_format.py" "$PORT"
echo "== Inside a shadow root, as Softr renders it: B and I light from the selection (MP-915)"
python3 "$HERE/test_shadow.py" "$PORT"
echo "== same, without ShadowRoot.getSelection (the route Firefox takes)"
python3 "$HERE/test_shadow.py" "$PORT" no-root-getselection
echo "== A whole box underlined, in a shadow root: U at a caret removes it from that word; B still applies"
python3 "$HERE/test_underlined.py" "$PORT"
echo "== Clear formatting: the selected words only, or the whole section when nothing is selected"
python3 "$HERE/test_erase.py" "$PORT"
echo "== Travel: select all + B bolds the titles in the box at once; one B un-bolds a title"
python3 "$HERE/test_travel_bold.py" "$PORT"
echo "== Gallery and homepage photos: drag shows where it lands; drop on a photo or a gap; outside abandons (MP-914)"
python3 "$HERE/test_gallery_drag.py" "$PORT"

echo "== + Question: a New answer line, and a divider at once - between new ones too (MP-921)"
python3 "$HERE/test_new_question.py" "$PORT"
