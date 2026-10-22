"""Merge every pass into template-map.json. Derived only from measurements."""
import os as _os
TEMPLATE_DIR = _os.environ.get('TEMPLATE_DIR', _os.path.abspath(_os.path.join(_os.path.dirname(__file__), '..', '..')))
MAP_OUT = _os.environ.get('MAP_OUT', _os.path.join(_os.path.dirname(_os.path.abspath(__file__)), 'out'))
HERE = _os.path.dirname(_os.path.abspath(__file__))
PORT = int(_os.environ.get('MAP_PORT', '8765'))
_os.makedirs(MAP_OUT, exist_ok=True)
import json, glob, os, re
OUT = MAP_OUT
M = json.load(open(f'{OUT}/template-map.json'))
import glob as _g
RAW = {os.path.basename(p)[4:-5]: json.load(open(p)) for p in sorted(_g.glob(f'{OUT}/raw-*.json'))}
P = json.load(open(f'{OUT}/paint.json'))
V = json.load(open(f'{OUT}/formatting-verdicts.json')) if os.path.exists(f'{OUT}/formatting-verdicts.json') else {}
short = lambda f: (f or '').split(',')[0].strip().strip('"\'')

def nav_vars(run):
    L = run['leaves']; out = set()
    for v, e in run['effects'].items():
        if e['kind'] != 'font': continue
        for i, _ in e['hits']:
            l = L[i]
            if l['section'] == 'nav' and l['tag'] == 'a' and 'registry' not in l['path'].lower():
                out.add(v)
    return sorted(out)

for t, d in M.items():
    d['fonts']['menu']['desktop_vars'] = nav_vars(RAW[t]['desktop-sample'])
    d['fonts']['menu']['mobile_vars'] = nav_vars(RAW[t]['mobile-sample'])
    d['fonts']['menu']['menu_control_writes'] = d['fonts']['role_writes']['menu']['var']
    _w = d['fonts']['role_writes']['menu']['var']
    d['fonts']['menu']['menu_control_reaches_menu'] = {'desktop': _w in d['fonts']['menu']['desktop_vars'],
                                                       'mobile': _w in d['fonts']['menu']['mobile_vars']}
    # paint at rest for every colour var (borders, buttons, fills), not only text
    pd = P[t]['desktop']['paint']
    for s, info in d['colours']['slots'].items():
        other = {}
        for v in info['vars']:
            for prop, els in (pd.get(v) or {}).items(): other.setdefault(prop, []).extend(els)
        info['other_paint'] = other
        info['visible_at_rest'] = bool(info['text'] or info['ground'] or other)
    for x in d['colours']['content_text_no_slot']:
        src = P[t]['desktop']['colorSource']
        k = next((kk for kk in src if kk.startswith(x['text'][:20])), None)
        if k and src[k]['from']: x['rule'] = [r['sel'] + ' { color: ' + r['color'] + ' }' for r in src[k]['from']['rules']][-1]
    d['formatting'] = V.get(t, {})
    sp = f'{OUT}/sec-{t}.json'
    d['sections']['visibility'] = json.load(open(sp)) if os.path.exists(sp) else {}
    d['probe']['notes'] = ['accommodation_info is always sent empty by the editor; the runtime cuts travel_info into the hotel and flights cards, so the formatting row for travel_info is the real Travel box and the accommodation_info row is not meaningful.']
json.dump(M, open(f'{OUT}/template-map.json', 'w'), indent=1, sort_keys=False)
print('merged', len(M))
