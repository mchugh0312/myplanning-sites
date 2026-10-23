import os as _os
TEMPLATE_DIR = _os.environ.get('TEMPLATE_DIR', _os.path.abspath(_os.path.join(_os.path.dirname(__file__), '..', '..')))
MAP_OUT = _os.environ.get('MAP_OUT', _os.path.join(_os.path.dirname(_os.path.abspath(__file__)), 'out'))
HERE = _os.path.dirname(_os.path.abspath(__file__))
PORT = int(_os.environ.get('MAP_PORT', '8765'))
_os.makedirs(MAP_OUT, exist_ok=True)
import json, os, re, sys, glob
if os.path.isdir('/opt/pw-browsers'): os.environ.setdefault('PLAYWRIGHT_BROWSERS_PATH', '/opt/pw-browsers')
from playwright.sync_api import sync_playwright

PROBE = open(_os.path.join(HERE, 'probe.js')).read()
TIDS = [os.path.basename(p)[9:-5] for p in sorted(glob.glob(_os.path.join(TEMPLATE_DIR, 'template-*.html')))]
if len(sys.argv) > 1: TIDS = sys.argv[1:]

INIT = """
window.__msgs = [];
window.addEventListener('message', e => { try { if (e.data && e.data.type) window.__msgs.push(JSON.parse(JSON.stringify(e.data))); } catch (x) {} });
"""

# Editor-shaped: what a block typed in today's editor looks like. startNewBlock
# no longer writes <strong>, so a first line is plain text.
STRIP_FIELDS = ['weddings_info', 'events_info', 'faqs', 'accommodation_info', 'travel_info']

def payload_js(variant):
    return """(variant) => {
      const d = JSON.parse(JSON.stringify(window.SAMPLE_DATA)); d.events = (d.events || []).map(e => ({ id: String(e.id || ''), name: String(e.name || '') })); if (d.accommodation_info) { d.travel_info = d.accommodation_info + (d.travel_info ? '<br><br>' + d.travel_info : ''); d.accommodation_info = ''; } 
      d.menu_config = Object.assign({}, d.menu_config || {}, {home:true, story:true, wedding:true,
        other_events:true, accommodations:true, things_to_do:true, faqs:true, travel:true,
        gallery:false, registry:true, rsvp:true});
      if (!d.things_to_do) d.things_to_do = 'Probe things to do line.';
      if (variant === 'editor') {
        %s.forEach(f => { if (typeof d[f] === 'string') d[f] = d[f].replace(/<\\/?strong>/gi, ''); });
      }
      window.__payload = d;
      window.postMessage({ type: 'HYDRATE_TEMPLATE', payload: d }, '*');
      return true;
    }""" % json.dumps(STRIP_FIELDS)

results = {}
with sync_playwright() as p:
    br = p.chromium.launch()
    for tid in TIDS:
        results[tid] = {}
        for vp_name, vp in [('desktop', (1280, 900)), ('mobile', (390, 844))]:
            for variant in ['sample', 'editor']:
                if vp_name == 'mobile' and variant == 'editor':
                    continue
                ctx = br.new_context(viewport={'width': vp[0], 'height': vp[1]},
                                     is_mobile=(vp_name == 'mobile'), has_touch=(vp_name == 'mobile'))
                pg = ctx.new_page()
                pg.add_init_script(INIT)
                errs = []
                pg.on('pageerror', lambda e: errs.append(str(e)))
                pg.goto(f'http://localhost:{PORT}/template-{tid}.html', wait_until='domcontentloaded')
                pg.wait_for_function('typeof window.hydrateTemplate === "function" && !!window.SAMPLE_DATA', timeout=15000)
                pg.evaluate(payload_js(variant), variant)
                forced = False
                try:
                    pg.wait_for_function('!document.body.classList.contains("hydrating") && getComputedStyle(document.documentElement).visibility !== "hidden"', timeout=9000)
                except Exception:
                    forced = True
                    pg.evaluate('document.body.classList.remove("hydrating"); document.documentElement.style.visibility="visible"; var v=document.getElementById("mp-veil"); if(v) v.remove();')
                pg.wait_for_timeout(600)
                data = pg.evaluate(PROBE)
                data['messages'] = [m for m in pg.evaluate('window.__msgs') if m.get('type') == 'MP_SECTION_HEADINGS']
                data['payload'] = pg.evaluate('window.__payload')
                data['errors'] = errs
                data['forcedReveal'] = forced
                results[tid][f'{vp_name}-{variant}'] = data
                ctx.close()
        print(tid, {k: len(v['leaves']) for k, v in results[tid].items()}, flush=True)
    br.close()

for t in results: json.dump(results[t], open(_os.path.join(MAP_OUT, 'raw-%s.json' % t), 'w'))
