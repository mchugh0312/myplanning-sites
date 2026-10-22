import os as _os
TEMPLATE_DIR = _os.environ.get('TEMPLATE_DIR', _os.path.abspath(_os.path.join(_os.path.dirname(__file__), '..', '..')))
MAP_OUT = _os.environ.get('MAP_OUT', _os.path.join(_os.path.dirname(_os.path.abspath(__file__)), 'out'))
HERE = _os.path.dirname(_os.path.abspath(__file__))
PORT = int(_os.environ.get('MAP_PORT', '8765'))
_os.makedirs(MAP_OUT, exist_ok=True)
import json, os, glob
if os.path.isdir('/opt/pw-browsers'): os.environ.setdefault('PLAYWRIGHT_BROWSERS_PATH', '/opt/pw-browsers')
from playwright.sync_api import sync_playwright
J = open(_os.path.join(HERE, 'paint.js')).read()
import sys
TIDS = sys.argv[1:] or [os.path.basename(p)[9:-5] for p in sorted(glob.glob(_os.path.join(TEMPLATE_DIR, 'template-*.html')))]
res = {}
with sync_playwright() as p:
    br = p.chromium.launch()
    for tid in TIDS:
        res[tid] = {}
        for name, vp in [('desktop', (1280, 900)), ('mobile', (390, 844))]:
            ctx = br.new_context(viewport={'width': vp[0], 'height': vp[1]}, is_mobile=name == 'mobile', has_touch=name == 'mobile')
            pg = ctx.new_page()
            pg.goto(f'http://localhost:{PORT}/template-{tid}.html', wait_until='domcontentloaded')
            pg.wait_for_function('typeof window.hydrateTemplate === "function" && !!window.SAMPLE_DATA')
            pg.evaluate("""() => { const d = JSON.parse(JSON.stringify(window.SAMPLE_DATA)); d.events = (d.events || []).map(e => ({ id: String(e.id || ''), name: String(e.name || '') })); 
              d.menu_config = Object.assign({}, d.menu_config||{}, {home:true,story:true,wedding:true,other_events:true,accommodations:true,things_to_do:true,faqs:true,travel:true,gallery:false,registry:true,rsvp:true});
              if (!d.things_to_do) d.things_to_do = 'Probe things to do line.';
              window.postMessage({type:'HYDRATE_TEMPLATE', payload:d}, '*'); }""")
            pg.wait_for_function('!document.body.classList.contains("hydrating")', timeout=9000)
            pg.wait_for_timeout(500)
            res[tid][name] = pg.evaluate(J)
            ctx.close()
        print(tid, flush=True)
    br.close()
_p = _os.path.join(MAP_OUT, 'paint.json')
_prev = json.load(open(_p)) if _os.path.exists(_p) else {}
_prev.update(res)
json.dump(_prev, open(_p, 'w'))
