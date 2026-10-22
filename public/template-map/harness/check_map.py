"""Drift gate. Reruns nothing itself: compares a FRESH template-map.json (in
MAP_OUT, produced by run_all.sh) with the COMMITTED one, on the facts the
typography and colour work is built on. Exit 1 on any difference.

Usage:  python3 check_map.py path/to/committed/template-map.json

What it compares, per template:
  - each font variable's face and the sections/roles it paints
  - which variable(s) the menu uses on desktop and on mobile
  - for each colour control: the text and backgrounds it reaches, and whether
    it changes anything visible at rest
  - text that no colour control reaches, and the rule colouring it
  - for each block title: the element and face on the page vs the box
  - CSS rules that restyle the couple's own tags
  - the formatting-survival verdicts
  - sections shipped hidden, and section visibility behaviour

It never compares a value against a literal written into this file, so a
template that changes fails here until the map is regenerated and the change
is reviewed in the diff of template-map.json.
"""
import json, sys, os
MAP_OUT = os.environ.get('MAP_OUT', os.path.join(os.path.dirname(os.path.abspath(__file__)), 'out'))

def facts(d):
    f, c = d['fonts'], d['colours']
    return {
        'font vars': {v: [u['value'], u['roles']] for v, u in f['vars'].items()},
        'menu': [f['menu']['desktop_vars'], f['menu']['mobile_vars'], f['menu']['menu_control_writes'], f['menu']['menu_control_reaches_menu']],
        'heading control': f['role_writes']['heading'],
        'colour slots': {s: [i['vars'], i['text'], i['ground'], i['visible_at_rest']] for s, i in c['slots'].items()},
        'unreachable text': sorted({(x['section'], x.get('rule') or '') for x in c['content_text_no_slot']}),
        'titles': sorted({(r['field'], r['variant'], (r['onsite'] or {}).get('el') or '', (r['onsite'] or {}).get('font') or '', r['box']['font'] or '') for r in d['titles']['rows']}),
        'inline-tag css': sorted({(x['sel'], json.dumps(x['props'], sort_keys=True)) for x in d['css_restyling_inline_tags']}),
        'formatting': d.get('formatting', {}),
        'shipped hidden': d['sections']['shipped_hidden'],
        'visibility': d['sections'].get('visibility', {}),
    }

def norm(x):
    return json.loads(json.dumps(x, sort_keys=True, default=list))

def main():
    committed = json.load(open(sys.argv[1]))
    fresh_path = os.path.join(MAP_OUT, 'template-map.json')
    # A map older than the measurements it should be built from means a build
    # step failed and this would compare a stale map: refuse rather than pass.
    import glob
    measured = [p for p in glob.glob(os.path.join(MAP_OUT, '*.json'))
                if os.path.basename(p) not in ('template-map.json', 'formatting-verdicts.json')]
    if not os.path.exists(fresh_path) or any(os.path.getmtime(p) > os.path.getmtime(fresh_path) for p in measured):
        print('template map: STALE - template-map.json is missing or older than the measurements; rerun the build steps')
        sys.exit(2)
    fresh = json.load(open(fresh_path))
    bad = 0
    for t in sorted(set(committed) | set(fresh)):
        if t not in fresh or t not in committed:
            print(f'FAIL {t}: present in only one map'); bad += 1; continue
        a, b = norm(facts(committed[t])), norm(facts(fresh[t]))
        for k in a:
            if a[k] != b.get(k):
                bad += 1
                print(f'FAIL {t}: {k} changed')
                print('   committed:', json.dumps(a[k])[:300])
                print('   now:      ', json.dumps(b.get(k))[:300])
    print('template map: %s (%d difference%s)' % ('OK' if not bad else 'DRIFT', bad, '' if bad == 1 else 's'))
    sys.exit(1 if bad else 0)

if __name__ == '__main__':
    main()
