import os as _os
TEMPLATE_DIR = _os.environ.get('TEMPLATE_DIR', _os.path.abspath(_os.path.join(_os.path.dirname(__file__), '..', '..')))
MAP_OUT = _os.environ.get('MAP_OUT', _os.path.join(_os.path.dirname(_os.path.abspath(__file__)), 'out'))
HERE = _os.path.dirname(_os.path.abspath(__file__))
PORT = int(_os.environ.get('MAP_PORT', '8765'))
_os.makedirs(MAP_OUT, exist_ok=True)
import json, re, sys
sys.path.insert(0, HERE)
from extract import load

import glob as _g, os as _o
RAW = {_o.path.basename(p)[4:-5]: json.load(open(p)) for p in sorted(_g.glob(_os.path.join(MAP_OUT, 'raw-*.json')))}
RT = open(_os.path.join(TEMPLATE_DIR, 'site-runtime.js'), encoding='utf-8').read()

# ---- runtime config, read from the source rather than retyped ---------------
def cfg_for(tid):
    m = re.search(r"\n    %s: \{([\s\S]*?)\n    \}" % tid, RT)
    b = m.group(1)
    g = lambda k: (re.search(k + r":\s*(null|'([^']*)')", b) or [None, None, None])
    sv, dv, bv = [g(k) for k in ('scriptVar', 'displayVar', 'bodyVar')]
    val = lambda x: x[2] if x and x[1] != 'null' else None
    fonts = re.search(r"fonts:\s*\{\s*display:\s*\"([^\"]*)\",\s*body:\s*\"([^\"]*)\"", b)
    return {'scriptVar': val(sv), 'displayVar': val(dv), 'bodyVar': val(bv),
            'fonts': {'display': fonts.group(1), 'body': fonts.group(2)} if fonts else None}

def colorvars_for(tid):
    m = re.search(r"\n    %s:\s*\{([^}]*)\}" % tid, RT[RT.find('var TEMPLATE_COLOR_VARS'):])
    out = {}
    for k, v in re.findall(r"(\w+):\s*(\[[^\]]*\]|'[^']*')", m.group(1)):
        out[k] = re.findall(r"'([^']*)'", v)
    return out

SLOT_LABEL = {'bg': 'Site Background', 'accent': 'Accent Color', 'accent2': 'Highlight Color',
              'accent3': 'Additional Color', 'ink': 'Text1', 'ink2': 'Text2', 'ink3': 'Text3'}

def lum(c):
    m = re.findall(r'[\d.]+', c or '')
    if len(m) < 3: return None
    def f(v):
        v = float(v) / 255
        return v / 12.92 if v <= 0.03928 else ((v + 0.055) / 1.055) ** 2.4
    return 0.2126 * f(m[0]) + 0.7152 * f(m[1]) + 0.0722 * f(m[2])

def strip(h): return re.sub(r'\s+', ' ', re.sub(r'<[^>]*>', '', re.sub(r'&nbsp;', ' ', h or ''))).strip()
def unent(s):
    import html
    return html.unescape(s)

def first_lines(field_html, split3=False):
    """First line text of every blank-line block."""
    out = []
    for blk in re.split(r'(?:<br\s*/?>\s*){2,}', field_html or '', flags=re.I):
        line = re.split(r'<br\s*/?>', blk, maxsplit=1, flags=re.I)[0]
        t = unent(strip(line))
        if t: out.append(t)
    return out

def italic_lines(field_html):
    out = []
    for line in re.split(r'<br\s*/?>', field_html or '', flags=re.I):
        l = line.strip()
        if re.match(r'^<(em|i)\b[^>]*>[\s\S]*</\1>$', l, re.I):
            out.append(unent(strip(l)))
    return out

FIELD_SECTION = {'weddings_info': 'wedding', 'events_info': 'other_events', 'faqs': 'faqs',
                 'accommodation_info': 'accommodations', 'travel_info': 'travel'}
CONTENT = {'story', 'wedding', 'other_events', 'accommodations', 'travel', 'faqs',
           'things_to_do', 'registry', 'rsvp'}

def short_font(f): return (f or '').split(',')[0].strip().strip('"\'')

def group_key(l):
    last = l['path'].split(' > ')[-1]
    return l['section'] + ' | ' + re.sub(r'#[\w-]+', lambda m: m.group(0), last)

def analyse(tid):
    R = RAW[tid]
    D = R['desktop-sample']; E = R['desktop-editor']; M = R['mobile-sample']
    leaves = D['leaves']
    payload = D['payload']
    msg = D['messages'][-1] if D['messages'] else {}
    headings = set(v for v in (msg.get('headings') or {}).values() if v)
    cfg = cfg_for(tid); cvars = colorvars_for(tid)

    titles = {f: first_lines(payload.get(f)) for f in FIELD_SECTION}
    title_text = {t for v in titles.values() for t in v}
    ital = {f: italic_lines(payload.get(f)) for f in FIELD_SECTION}

    def role(l):
        if l['section'] == 'nav': return 'menu'
        if l['section'] in ('footer', 'other', 'home'): return l['section']
        if l['text'] in headings or l['tag'] in ('h1', 'h2'): return 'section-heading'
        if l['text'] in title_text: return 'block-title'
        if any(l['text'] == t for v in ital.values() for t in v): return 'italic-line'
        return 'body'
    for l in leaves: l['role'] = role(l)

    # ---- fonts -------------------------------------------------------------
    fx = {v: e for v, e in D['effects'].items() if e['kind'] == 'font'}
    font_use = {}
    for v, e in fx.items():
        roles = {}
        for i, _ in e['hits']:
            l = leaves[i]
            roles.setdefault(l['role'], set()).add(l['section'])
        font_use[v] = {'value': e['value'], 'roles': {k: sorted(s) for k, s in roles.items()}}
    nav_vars = sorted({v for v, e in fx.items() for i, _ in e['hits'] if leaves[i]['role'] == 'menu'})
    menu_own = [v for v in nav_vars if set(font_use[v]['roles']) == {'menu'}]
    unreached_font = sorted({(l['section'], l['role'], short_font(l['font']), l['text'][:40])
                             for i, l in enumerate(leaves)
                             if l['section'] in CONTENT | {'nav'}
                             and not any(i == h[0] for e in fx.values() for h in e['hits'])
                             and l['text'] not in ('+', '−', '×', '-')})
    role_var = {'heading': cfg['scriptVar'] or cfg['displayVar'], 'body': cfg['bodyVar'], 'menu': cfg['bodyVar']}
    def moved_by(var):
        if not var or var not in fx: return {}
        out = {}
        for i, _ in fx[var]['hits']:
            out.setdefault(leaves[i]['role'], set()).add(leaves[i]['section'])
        return {k: sorted(v) for k, v in out.items()}
    role_reach = {r: {'var': v, 'moves': moved_by(v)} for r, v in role_var.items()}
    # what each role SHOULD reach and does not
    def faces(role_name):
        return sorted({short_font(l['font']) for l in leaves if l['role'] == role_name and l['section'] in CONTENT | {'nav'}})
    heading_misses = sorted({(l['section'], short_font(l['font'])) for i, l in enumerate(leaves)
                             if l['role'] == 'section-heading' and l['section'] in CONTENT
                             and not any(h[0] == i for h in (fx.get(role_var['heading']) or {'hits': []})['hits'])})

    # ---- colours -----------------------------------------------------------
    cx = {v: e for v, e in D['effects'].items() if e['kind'] == 'color'}
    slot_of_var = {}
    for s, vs in cvars.items():
        for v in vs: slot_of_var.setdefault(v, []).append(s)
    slots = {}
    for s, vs in cvars.items():
        txt, grd = {}, set()
        for v in vs:
            for i, ch in (cx.get(v) or {'hits': []})['hits']:
                l = leaves[i]
                if 'text' in ch: txt.setdefault(l['role'], set()).add(l['section'])
                if 'ground' in ch: grd.add(l['section'])
        slots[s] = {'label': SLOT_LABEL[s], 'vars': vs, 'value': [cx[v]['value'] for v in vs if v in cx],
                    'text': {k: sorted(v) for k, v in txt.items()}, 'ground': sorted(grd)}
    unmapped_vars = {v: {'value': e['value'], 'hits': len(e['hits']),
                         'text': sorted({leaves[i]['section'] + '/' + leaves[i]['role'] for i, ch in e['hits'] if 'text' in ch}),
                         'ground': sorted({leaves[i]['section'] for i, ch in e['hits'] if 'ground' in ch})}
                     for v, e in cx.items() if v not in slot_of_var}
    dead_vars = sorted(v for v, e in D['effects'].items() if not e['hits'])
    slot_vars = {v for vs in cvars.values() for v in vs}
    ink_unreached = []
    for i, l in enumerate(leaves):
        if l['section'] not in CONTENT: continue
        movers = [v for v, e in cx.items() if any(h[0] == i and 'text' in h[1] for h in e['hits'])]
        if not any(v in slot_vars for v in movers):
            ink_unreached.append({'section': l['section'], 'role': l['role'], 'text': l['text'][:40],
                                  'color': l['color'], 'ground': l['bg'],
                                  'via': movers or 'literal or inherited from a non-root value'})
    # text on dark grounds: which slot moves it
    dark = []
    for i, l in enumerate(leaves):
        if l['section'] not in CONTENT | {'nav'}: continue
        L = lum(l['bg'])
        if L is None or L > 0.25: continue
        movers = [v for v, e in cx.items() if any(h[0] == i and 'text' in h[1] for h in e['hits'])]
        dark.append({'section': l['section'], 'role': l['role'], 'text': l['text'][:36],
                     'slots': sorted({s for v in movers for s in slot_of_var.get(v, [])}), 'vars': movers})

    # ---- titles: does the box and the page agree ----------------------------
    rep = {'label': msg.get('labelStyle'), 'title': msg.get('titleStyle'), 'question': msg.get('questionStyle')}
    box_style_for = {'weddings_info': 'title', 'events_info': 'title', 'faqs': 'question',
                     'accommodation_info': 'label', 'travel_info': 'label'}
    title_rows = []
    for f, sec in FIELD_SECTION.items():
        for variant, run in (('sample', D), ('editor', E)):
            pl = run['payload']
            for t in first_lines(pl.get(f))[:2]:
                hits = [l for l in run['leaves'] if l['text'] == t[:60]]
                l = hits[0] if hits else None
                # find a sibling body line in the same block for comparison
                rs = rep[box_style_for[f]] or {}
                title_rows.append({
                    'field': f, 'variant': variant, 'line': t[:40],
                    'onsite': None if not l else {'el': l['path'].split(' > ')[-1], 'font': short_font(l['font']),
                                                  'style': l['style'], 'weight': l['weight'], 'caps': l['caps']},
                    'box': {'font': rs.get('font') or '(heading face)', 'style': rs.get('italic'),
                            'weight': rs.get('weight')}})
    italic_rows = []
    for f in FIELD_SECTION:
        for t in ital[f][:1]:
            hits = [l for l in leaves if l['text'] == t[:60]]
            if hits:
                l = hits[0]
                italic_rows.append({'field': f, 'line': t, 'el': l['path'].split(' > ')[-1],
                                    'font': short_font(l['font']), 'style': l['style'],
                                    'rules': [r['sel'] for r in l['rules']]})

    # ---- section body copy the template restyles ----------------------------
    body_fonts = {short_font(v['value']) for k, v in font_use.items() if 'body' in v['roles']}
    imposed = []
    seen = set()
    for l in leaves:
        if l['section'] not in CONTENT or l['role'] not in ('body', 'italic-line'): continue
        f = short_font(l['font'])
        flags = []
        if l['style'] != 'normal': flags.append(l['style'])
        if l['weight'] not in ('400', 'normal'): flags.append('weight ' + l['weight'])
        if l['caps'] not in ('none',): flags.append(l['caps'])
        if body_fonts and f not in body_fonts: flags.append('face ' + f)
        if not flags: continue
        key = (l['section'], l['path'].split(' > ')[-1], tuple(flags))
        if key in seen: continue
        seen.add(key)
        src = [r['sel'] for r in l['rules'] if any(p in r['props'] for p in ('font-style', 'font-weight', 'font-family', 'font', 'text-transform'))]
        imposed.append({'section': l['section'], 'el': l['path'].split(' > ')[-1], 'flags': flags,
                        'example': l['text'][:40], 'selectors': src[-4:]})

    # ---- static CSS: rules that restyle the couple's own inline tags ---------
    html, soup, rules, scripts = load(_os.path.join(TEMPLATE_DIR, f'template-{tid}.html'))
    inline_rules = []
    for r in rules:
        for sel in r['sel'].split(','):
            sel = sel.strip()
            if re.search(r'(^|[\s>+~])(em|i|strong|b|u|span)(\b|$)(?![-\w])', sel) and not re.search(r'\bi\.|\bfa-', sel):
                props = {k: v for k, v, _ in r['decls'] if k in ('font-family', 'font-style', 'font-weight', 'font', 'color', 'text-decoration', 'text-transform', 'display')}
                if props: inline_rules.append({'sel': sel, 'media': r['media'], 'props': props})
    js_inline = sorted(set(re.findall(r'style=\\?["\'][^"\']*(?:font-(?:family|style|weight)|color)[^"\']*["\']', scripts)))[:12]

    # ---- sections shipped hidden, and what is still hidden with all on ------
    anchors = ['hero', 'home', 'our-story', 'story', 'events-primary', 'wedding', 'event-schedule', 'event-details',
               'weekend', 'itinerary', 'other-events', 'events', 'accommodations', 'travel-section', 'travel',
               'travel-standalone', 'need-to-know', 'ntk', 'faq-section', 'things-to-do', 'gallery',
               'registry-section', 'registry', 'registry-wrap', 'rsvp']
    shipped_hidden = []
    for a in anchors:
        el = soup.find(id=a)
        if el is not None and re.search(r'display\s*:\s*none', el.get('style') or ''):
            shipped_hidden.append(a)
    present = [a for a in anchors if soup.find(id=a) is not None]

    # ---- mobile differences -------------------------------------------------
    def idx(run):
        out = {}
        for l in run['leaves']:
            out.setdefault((l['section'], l['text']), l)
        return out
    di, mi = idx(D), idx(M)
    mobile_diff = []
    for k, ml in mi.items():
        dl = di.get(k)
        if not dl or k[0] not in CONTENT | {'nav'}: continue
        ch = {p: (dl[p], ml[p]) for p in ('color', 'bg', 'font', 'style', 'weight') if dl[p] != ml[p]}
        if 'font' in ch and short_font(ch['font'][0]) == short_font(ch['font'][1]): ch.pop('font')
        if ch: mobile_diff.append({'section': k[0], 'text': k[1][:36], 'changes': {p: [a if p != 'font' else short_font(a), b if p != 'font' else short_font(b)] for p, (a, b) in ch.items()}})

    # ---- runtime CFG vs the template's own variables -------------------------
    allvars = D['vars']
    cfg_check = {}
    for k in ('scriptVar', 'displayVar', 'bodyVar'):
        v = cfg[k]
        cfg_check[k] = {'var': v, 'exists': (v in allvars) if v else None,
                        'face': short_font(allvars.get(v, '')) if v else None}
    cfg_check['unlisted_font_vars'] = [v for v in fx if v not in (cfg['scriptVar'], cfg['displayVar'], cfg['bodyVar'])]
    cfg_check['fallback_fonts'] = cfg['fonts']

    return {
        'template': tid,
        'fonts': {'vars': font_use, 'runtime_cfg': cfg_check, 'role_writes': role_reach,
                  'menu': {'nav_link_vars': nav_vars, 'own_menu_var': menu_own or None,
                           'shares_with': sorted({r for v in nav_vars for r in font_use[v]['roles'] if r != 'menu'})},
                  'section_headings_not_moved_by_heading_control': heading_misses,
                  'content_text_no_font_var': unreached_font},
        'colours': {'slots': slots, 'vars_not_in_any_slot': unmapped_vars, 'dead_vars': dead_vars,
                    'content_text_no_slot': ink_unreached, 'text_on_dark_grounds': dark},
        'titles': {'reported_to_editor': rep, 'rows': title_rows, 'wholly_italic_lines': italic_rows},
        'imposed_on_body_copy': imposed,
        'css_restyling_inline_tags': inline_rules,
        'js_inline_styles': js_inline,
        'sections': {'anchors_present': present, 'shipped_hidden': shipped_hidden},
        'mobile_only': mobile_diff,
        'probe': {'errors': {k: v['errors'] for k, v in R.items()}}
    }

if __name__ == '__main__':
    out = {t: analyse(t) for t in RAW}
    json.dump(out, open(_os.path.join(MAP_OUT, 'template-map.json'), 'w'), indent=1, default=list)
    print('ok', list(out))
