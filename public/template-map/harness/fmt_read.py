import os as _os
TEMPLATE_DIR = _os.environ.get('TEMPLATE_DIR', _os.path.abspath(_os.path.join(_os.path.dirname(__file__), '..', '..')))
MAP_OUT = _os.environ.get('MAP_OUT', _os.path.join(_os.path.dirname(_os.path.abspath(__file__)), 'out'))
HERE = _os.path.dirname(_os.path.abspath(__file__))
PORT = int(_os.environ.get('MAP_PORT', '8765'))
_os.makedirs(MAP_OUT, exist_ok=True)
import json
import glob, os
MARKS = json.load(open(_os.path.join(MAP_OUT, 'fmt-marks.json')))
R = {os.path.basename(p)[4:-5]: json.load(open(p)) for p in sorted(glob.glob(_os.path.join(MAP_OUT, 'fmt-*.json'))) if 'marks' not in p}
def verdict(kind, hits):
    if not hits: return 'GONE'
    h = hits[0]
    if kind is None: return 'ok'
    if kind == 'b':
        w, bw = int(h['weight']), int(h['blockWeight'])
        return 'ok' if w >= 600 and w > bw else ('same' if bw >= 600 else 'LOST')
    if kind == 'i':
        if h['italic'] == 'italic': return 'ok' if h['blockItalic'] != 'italic' else 'same'
        return 'FACE:' + h['font'] if h['font'] != h['blockFont'] else 'LOST'
    if kind == 'u': return 'ok' if h['underline'] else 'LOST'
    if kind == 'font': return 'ok' if h['font'] == 'Courier New' else 'LOST'
SYM = lambda v: {'ok': '✓', 'same': '=', 'LOST': '✗', 'GONE': '∅'}.get(v, v)
table = {}
for t, vs in R.items():
    table[t] = {}
    for var, fields in vs.items():
        for field, words in fields.items():
            table[t].setdefault(field, {})
            for w, hits in words.items():
                table[t][field][w] = verdict(MARKS[var][w], hits)
json.dump(table, open(_os.path.join(MAP_OUT, 'formatting-verdicts.json'), 'w'), indent=1)
for t in table:
    for f in table[t]:
        for key, var, kind in [('_wi', 'whole-i', 'i'), ('_wu', 'whole-u', 'u'), ('_wf', 'whole-font', 'font')]:
            table[t][f][key] = ' '.join(SYM(verdict(kind, R[t][var][f][w])) for w in ['Quebec', 'Romeo', 'Sierra', 'Tango'])
json.dump(table, open(_os.path.join(MAP_OUT, 'formatting-verdicts.json'), 'w'), indent=1)
cols = ['Kilo', 'Lima', 'Mike', 'Oscar', 'Bravo', 'Charlie', 'Delta', 'Echo', 'Papa', 'Quebec', 'Romeo', 'Sierra', 'Tango']
if __name__ == '__main__':
    print(' ' * 30 + 'TITLE: b  i  u  f | BODY: b  i  u  f | 2nd | WHOLE-I q r s t | WHOLE-U q r s t | WHOLE-FONT q r s t')
    for t, fs in table.items():
        print('==', t)
        for f, r in fs.items():
            row = ' '.join(SYM(r[c])[:12].rjust(2) for c in cols[:9])
            wi = ' '.join(SYM(R[t]['whole-i'][f] and verdict('i', R[t]['whole-i'][f][c]))[:8] for c in ['Quebec','Romeo','Sierra','Tango'])
            wu = ' '.join(SYM(verdict('u', R[t]['whole-u'][f][c])) for c in ['Quebec','Romeo','Sierra','Tango'])
            wf = ' '.join(SYM(verdict('font', R[t]['whole-font'][f][c])) for c in ['Quebec','Romeo','Sierra','Tango'])
            print('  %-20s %s | %s | %s | %s' % (f, row, wi, wu, wf))
