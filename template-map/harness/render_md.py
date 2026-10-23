"""TEMPLATE-MAP.md, generated from template-map.json. Do not edit by hand."""
import os as _os
TEMPLATE_DIR = _os.environ.get('TEMPLATE_DIR', _os.path.abspath(_os.path.join(_os.path.dirname(__file__), '..', '..')))
MAP_OUT = _os.environ.get('MAP_OUT', _os.path.join(_os.path.dirname(_os.path.abspath(__file__)), 'out'))
HERE = _os.path.dirname(_os.path.abspath(__file__))
PORT = int(_os.environ.get('MAP_PORT', '8765'))
_os.makedirs(MAP_OUT, exist_ok=True)
import json, os
OUT = MAP_OUT
M = json.load(open(f'{OUT}/template-map.json'))
NAMES = {'blacktietimeless': 'Black Tie Timeless', 'coastalchic': 'Coastal Chic', 'goldenhour': 'Golden Hour',
         'heirloombloom': 'Heirloom Bloom', 'modernminimal': 'Modern Minimal', 'pressedpetals': 'Pressed Petals',
         'regalboho': 'Regal Boho', 'sageandstill': 'Sage & Still', 'vintagelovestory': 'Vintage Love Story',
         'whimsicalromance': 'Whimsical Romance'}
short = lambda f: (f or '').split(',')[0].strip().strip('"\'')
SECS = ['story', 'wedding', 'other_events', 'accommodations', 'travel', 'faqs', 'things_to_do', 'registry', 'rsvp']
def where(roles, keep=('section-heading', 'block-title', 'body', 'italic-line', 'menu')):
    parts = []
    for r in keep:
        if r in roles:
            s = [x for x in roles[r] if x != 'nav']
            parts.append(r.replace('-', ' ') + (': ' + ', '.join(s) if s else ''))
    return '; '.join(parts) or '-'
SYM = {'ok': '✓', 'same': '=', 'LOST': '✗', 'GONE': '∅'}
L = []
w = L.append
w('# Template map\n')
w('Generated from `template-map.json` by `render_md.py`. Do not edit by hand; rerun the harness.\n')
w('Every fact here was measured in a rendered page, not read from a hand-written list. '
  'Fonts and colours: each `:root` variable was set to a sentinel value and the visible text that changed was recorded. '
  'Formatting: marked words were injected into each field and checked on the page. '
  'Payloads are shaped the way the editor sends them (`events` carry id and name only; `accommodation_info` is empty and the runtime cuts the Travel box). '
  'Chromium, desktop 1280px and mobile 390px, transitions disabled, resting state only (no hover, focus, or later RSVP steps).\n')
w('Role words used below: **section heading** (e.g. "Our Story"), **block title** (first line of an event, question, or hotel/flights card), '
  '**italic line** (a line wholly in `<em>`, e.g. a dress code), **body** (everything else in a section).\n')
w('Formatting key: ✓ shows on the page, = invisible because the text already had it, ✗ lost, ∅ the text never appeared.\n')
for t, d in M.items():
    f = d['fonts']; c = d['colours']
    w(f'\n## {NAMES[t]} (`{t}`)\n')
    w('### Fonts\n')
    w('| Variable | Face | Paints |\n|---|---|---|')
    for v, u in f['vars'].items():
        w(f"| `{v}` | {short(u['value'])} | {where(u['roles'])} |")
    rw = f['role_writes']; m = f['menu']
    w('')
    w(f"Headings control writes `{rw['heading']['var']}`, which reaches: {where(rw['heading']['moves'])}.  ")
    w(f"Body control writes `{rw['body']['var']}`, which reaches: {where(rw['body']['moves'])}.  ")
    w(f"Menu Links writes `{m['menu_control_writes']}`. The menu is set in `{', '.join(m['desktop_vars'])}` on desktop and "
      f"`{', '.join(m['mobile_vars'])}` on mobile. Own menu variable: {'yes' if m['own_menu_var'] else '**none**'}. "
      f"Menu Links reaches the menu: desktop **{'yes' if m['menu_control_reaches_menu']['desktop'] else 'no'}**, mobile **{'yes' if m['menu_control_reaches_menu']['mobile'] else 'no'}**.")
    if f['section_headings_not_moved_by_heading_control']:
        w(f"\nSection headings the Headings control does not reach: " + ', '.join(f'{s} ({face})' for s, face in f['section_headings_not_moved_by_heading_control']) + '.')
    if f['runtime_cfg']['unlisted_font_vars']:
        w(f"\nFont variables the runtime config does not know: " + ', '.join(f'`{v}`' for v in f['runtime_cfg']['unlisted_font_vars']) + '.')
    w('\n### Colour slots\n')
    w('| Control | Variable | Text it colours | Backgrounds it paints | Other paint at rest (borders, buttons, inputs) |\n|---|---|---|---|---|')
    for s, i in c['slots'].items():
        other = ', '.join(sorted(i['other_paint'])) if i['other_paint'] else ''
        flag = '' if i['visible_at_rest'] else ' **(nothing visible at rest)**'
        w(f"| {i['label']}{flag} | {', '.join('`'+v+'`' for v in i['vars'])} | {where(i['text'])} | {', '.join(x for x in i['ground'] if x not in ('other',)) or '-'} | {other or '-'} |")
    if c['content_text_no_slot']:
        w('\nText no colour control can reach:\n')
        seen = set()
        for x in c['content_text_no_slot']:
            k = (x['section'], x.get('rule'))
            if k in seen: continue
            seen.add(k)
            w(f"- {x['section']}, {x['role'].replace('-', ' ')} (\"{x['text'][:28]}\"): `{x.get('rule', 'literal')}` on {x['ground']}")
    w('\n### Block titles: Content box vs page\n')
    w('| Field | First line | Page | Box shows |\n|---|---|---|---|')
    for r in d['titles']['rows']:
        if r['variant'] != 'editor' or r['field'] == 'accommodation_info': continue
        o = r['onsite']
        page = f"{o['font']} {o['weight']}{' ' + o['style'] if o['style'] != 'normal' else ''}{' ' + o['caps'] if o['caps'] != 'none' else ''} (`{o['el']}`)" if o else '**not a title on the page**'
        b = r['box']
        w(f"| {r['field']} | {r['line'][:28]} | {page} | {b['font']}{' ' + str(b['weight']) if b['weight'] else ''} |")
    if d['titles']['wholly_italic_lines']:
        w('\nWholly italic lines (dress codes, notes):\n')
        for r in d['titles']['wholly_italic_lines']:
            w(f"- {r['field']} \"{r['line'][:24]}\": page shows {r['font']} {r['style']}" + (f" via `{r['rules'][-1]}`" if r['rules'] else ''))
    rs = [x for x in d['css_restyling_inline_tags'] if any(k in x['props'] for k in ('font-family', 'font-style', 'font-weight', 'font'))]
    if rs:
        w('\n### CSS that restyles the couple\'s own tags\n')
        for x in rs: w(f"- `{x['sel']}` → " + '; '.join(f'{k}: {v}' for k, v in x['props'].items()))
    if d['imposed_on_body_copy']:
        w('\n### Defaults imposed on body copy (must stay overridable)\n')
        for x in d['imposed_on_body_copy']:
            w(f"- {x['section']} `{x['el']}`: {', '.join(x['flags'])}" + (f" (`{x['selectors'][-1]}`)" if x['selectors'] else ''))
    if d['formatting']:
        w('\n### Formatting survival\n')
        w('| Field | Title b i u font | Body b i u font | Whole box italic | Whole box underline | Whole box font |\n|---|---|---|---|---|---|')
        for fld, r in d['formatting'].items():
            if fld == 'accommodation_info': continue
            g = lambda ks: ' '.join(SYM.get(r.get(k, ''), r.get(k, '')[:4]) for k in ks)
            w(f"| {fld} | {g(['Kilo','Lima','Mike','Oscar'])} | {g(['Bravo','Charlie','Delta','Echo'])} | {g(['Quebec','Romeo','Sierra','Tango']) if False else ''} | | |".replace('|  | | |', '| see JSON | | |') if False else
              f"| {fld} | {g(['Kilo','Lima','Mike','Oscar'])} | {g(['Bravo','Charlie','Delta','Echo'])} | {r.get('_wi','')} | {r.get('_wu','')} | {r.get('_wf','')} |")
    w('\n### Sections\n')
    w(f"Shipped with `display:none` until hydrated: {', '.join('`#'+a+'`' for a in d['sections']['shipped_hidden']) or 'none'}.")
    vis = d['sections'].get('visibility', {})
    odd = []
    for s, r in vis.items():
        if r.get('toggle off', '').startswith('shown'): odd.append(f'{s} shows with its toggle off')
        if s not in ('registry', 'accommodations') and r.get('box empty', '').startswith('shown'): odd.append(f'{s} shows with its box empty')
        if r.get('filler br only', '').startswith('shown') and s != 'registry': odd.append(f'{s} shows with only a filler <br>')
    w('Visibility: ' + ('; '.join(odd) if odd else 'every section hides with its toggle off and (except Registry, by design) when its box is emptied.'))
    if d['mobile_only']:
        mo = {}
        for x in d['mobile_only']:
            for k, v in x['changes'].items(): mo.setdefault((x['section'], k), v)
        w('\n### Mobile only\n')
        for (s, k), v in mo.items(): w(f'- {s}: {k} {v[0]} → {v[1]}')
open(f'{OUT}/TEMPLATE-MAP.md', 'w').write('\n'.join(L) + '\n')
print(len(L), 'lines')
