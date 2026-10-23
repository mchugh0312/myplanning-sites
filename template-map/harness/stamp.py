"""Release stamps, the way marker-test.js checks them.

    python3 stamp.py BUILD_NAME [--public DIR] [--website FILE] [--test FILE]

  - names the build in site-runtime.js (MP_RUNTIME_BUILD) and in the editor
    (MP_BLOCK_BUILD): the suite requires them to be the same
  - writes each template's marker, window.__mpTemplate = 'name:hash'
  - re-pins marker-test.js: the build name and the runtime and editor hashes

Hashes are computed exactly as the suite does: h = 5381, then for every UTF-16
code unit h = ((h * 33) ^ unit) >>> 0, over the file without its stamp line.
Run it as the LAST step of a change, after every file is final.
"""
import argparse, glob, os, re

def djb(text):
    h = 5381
    data = text.encode('utf-16-le')
    for i in range(0, len(data), 2):
        h = ((h * 33) ^ (data[i] | (data[i + 1] << 8))) & 0xFFFFFFFF
    return '%08x' % h

def rd(p): return open(p, encoding='utf-8', newline='').read()
def wr(p, s): open(p, 'w', encoding='utf-8', newline='').write(s)

ap = argparse.ArgumentParser()
ap.add_argument('build')
here = os.path.dirname(os.path.abspath(__file__))
root = os.path.abspath(os.path.join(here, '..', '..'))
ap.add_argument('--public', default=os.path.join(root, 'public') if os.path.isdir(os.path.join(root, 'public')) else root)
ap.add_argument('--website', default=None)
ap.add_argument('--test', default=None)
a = ap.parse_args()
if not re.fullmatch(r'[\w.-]+', a.build): raise SystemExit('build name: letters, digits, . _ - only')
pub = a.public
website = a.website or os.path.join(pub, 'Website.txt')
test = a.test or os.path.join(pub, 'marker-test.js')

rt_p = os.path.join(pub, 'site-runtime.js'); rt = rd(rt_p)
assert rt.count("var MP_RUNTIME_BUILD = '") == 1, 'runtime build line not found'
rt = re.sub(r"var MP_RUNTIME_BUILD = '[\w.-]+';", "var MP_RUNTIME_BUILD = '%s';" % a.build, rt)
wr(rt_p, rt)
rt_hash = djb(re.sub(r"var MP_RUNTIME_BUILD = '[\w.-]+';", '', rt))
print('runtime  build %s  hash %s' % (a.build, rt_hash))

ws_hash = None
if os.path.exists(website):
    ws = rd(website)
    assert ws.count("const MP_BLOCK_BUILD = '") == 1, 'editor build line not found'
    ws = re.sub(r"const MP_BLOCK_BUILD = '[\w.-]+';", "const MP_BLOCK_BUILD = '%s';" % a.build, ws)
    wr(website, ws)
    ws_hash = djb(re.sub(r"const MP_BLOCK_BUILD = '[\w.-]+';", '', ws))
    print('editor   build %s  hash %s' % (a.build, ws_hash))

MARK = re.compile(r"\n\s*window\.__mpTemplate = '([a-z]+):([0-9a-f]{8})';\n")
for p in sorted(glob.glob(os.path.join(pub, 'template-*.html'))):
    name = os.path.basename(p)[9:-5]; html = rd(p)
    m = MARK.search(html)
    if not m: raise SystemExit(p + ': no window.__mpTemplate marker to update')
    h = djb(html[:m.start()] + '\n' + html[m.end():])
    line = m.group(0).replace("'%s:%s'" % (m.group(1), m.group(2)), "'%s:%s'" % (name, h))
    wr(p, html[:m.start()] + line + html[m.end():])
    print('template %-17s %s%s' % (name, h, '' if m.group(2) != h else '  (unchanged)'))

if os.path.exists(test):
    t = rd(test)
    def pin(label, value, t):
        pat = re.compile(r"(check\('" + re.escape(label) + r"',\s*\n?\s*[^;]*?, ')([\w.-]+)('\);)")
        assert len(pat.findall(t)) == 1, 'pin not found: ' + label
        return pat.sub(lambda m: m.group(1) + value + m.group(3), t)
    t = pin('the stamp names the change it shipped with', a.build, t)
    t = pin('and nothing in the runtime has moved since', rt_hash, t)
    if ws_hash: t = pin('and nothing in the block has moved since', ws_hash, t)
    wr(test, t)
    print('marker-test.js pins updated')
