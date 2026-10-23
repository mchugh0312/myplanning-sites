# Template map harness

Produces `template-map.json` and `TEMPLATE-MAP.md`: per template, which CSS
variable paints each colour and font role, what each editor control actually
reaches, how block titles render on the page versus in the Content box, which
template rules restyle the couple's own tags, whether their formatting
survives, and how sections hide.

Everything is measured in a rendered page. Nothing is read from a list
someone wrote by hand.

## How it measures

- **Fonts and colours.** Each template is hydrated in headless Chromium. Every
  `:root` variable is then set, one at a time, to a sentinel value, and every
  visible text element is checked for a change in face, colour or the
  background behind it. This captures inheritance and specificity exactly as the
  browser applies them. `paint.js` does the same for borders, buttons, inputs and
  fills, and records the rule behind each text colour.
- **Formatting.** Marked words (`Kilo`, `Bravo`, ...) carrying `<b>`, `<i>`, `<u>`
  and a font `<span>` are injected into each field. Each is then found on the page
  and its computed style checked. Whole-box variants wrap the entire field.
- **Sections.** Each section is checked with its toggle off, its box empty, and
  its box holding only the editor's filler `<br>`.

Payloads are shaped the way the editor sends them. `events` carry an id and a
name only. `accommodation_info` is empty, and the Travel box holds hotel and
flights, which the runtime cuts apart. Sending the template's richer
`SAMPLE_DATA` as-is makes some templates ignore the typed copy, which produced
false results in early runs.

Transitions and animations are disabled while measuring. A colour mid-transition
reads as unchanged, which hid one result before this was added.

## Limits

- Chromium only. iOS Safari behaviour (e.g. data detectors turning dates blue,
  MP-936) needs a device.
- Resting state only: no hover, focus, open lightbox, or later RSVP steps. A
  control marked "nothing visible at rest" may still paint one of those.
- Web fonts do not load offline. Faces are read from the computed font stack,
  which is what the page asks for.

## Running it

Needs Python 3, `playwright` with Chromium, `tinycss2`, `beautifulsoup4`, and
Node for the trace.

    pip install playwright tinycss2 beautifulsoup4
    python3 -m playwright install chromium
    TEMPLATE_DIR=/path/to/site ./run_all.sh

`TEMPLATE_DIR` is the folder holding `template-*.html` and `site-runtime.js`.
It is served at the root because the templates load `/site-runtime.js`. Output
goes to `./out` (override with `MAP_OUT`). A full run takes about ten minutes.
Every measuring script accepts template ids as arguments, to rerun a subset.

## The gate

    python3 check_map.py path/to/committed/template-map.json

This compares the fresh map in `MAP_OUT` with the committed one, on the facts
the typography and colour work depends on, and exits 1 on any difference. It
compares two measurements, never a measurement against a literal. A template
change therefore fails until the map is regenerated and the diff of
`template-map.json` is reviewed and committed.

Shown to fail on real drift: deleting Pressed Petals'
`.event-card-detail em:last-child` rule produced three named differences and
exit 1. A clean independent rerun produced zero.

To call it from `marker-test.js`, spawn `run_all.sh` then `check_map.py` and
fail the suite on a non-zero exit. Both need a browser, so they suit CI better
than a pre-commit hook.

## Trace

    node trace_title_span.js /path/to/site whimsicalromance

This runs the runtime's own `markStructure` and a template's own `_mpTitle` on a
whole-box font span, and prints where the font is lost. Both functions are
extracted from the files, so the trace always tests the deployed source.

## Files

| File | Does |
|---|---|
| `probe.js` | In-page: text elements, their styles, and which variable moves them |
| `paint.js` | In-page: non-text paint per variable; the rule behind each colour |
| `run.py` | Fonts, colours, titles at desktop and mobile, sample and editor-shaped |
| `run_paint.py` | Runs `paint.js` |
| `fmt.py`, `fmt_read.py` | Formatting matrix and its verdicts |
| `sections.py` | Section visibility |
| `extract.py` | Static CSS parse, used for rules on inline tags and shipped-hidden sections |
| `analyse.py`, `build_map.py` | Turn measurements into `template-map.json` |
| `render_md.py` | `TEMPLATE-MAP.md` from the JSON |
| `check_map.py` | The drift gate |
| `trace_title_span.js` | The whole-box font trace |
