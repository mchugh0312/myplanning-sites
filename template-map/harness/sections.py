import os as _os
TEMPLATE_DIR = _os.environ.get('TEMPLATE_DIR', _os.path.abspath(_os.path.join(_os.path.dirname(__file__), '..', '..')))
MAP_OUT = _os.environ.get('MAP_OUT', _os.path.join(_os.path.dirname(_os.path.abspath(__file__)), 'out'))
HERE = _os.path.dirname(_os.path.abspath(__file__))
PORT = int(_os.environ.get('MAP_PORT', '8765'))
_os.makedirs(MAP_OUT, exist_ok=True)
import json, os, glob, sys
if os.path.isdir('/opt/pw-browsers'): os.environ.setdefault('PLAYWRIGHT_BROWSERS_PATH', '/opt/pw-browsers')
from playwright.sync_api import sync_playwright
ANCH = {'story': ['our-story', 'story'], 'wedding': ['events-primary', 'wedding', 'event-schedule', 'event-details', 'weekend', 'itinerary'],
        'other_events': ['other-events', 'events'], 'accommodations': ['accommodations'],
        'travel': ['travel-section', 'travel', 'travel-standalone'], 'faqs': ['need-to-know', 'ntk', 'faq-section'],
        'things_to_do': ['things-to-do'], 'registry': ['registry-section', 'registry', 'registry-wrap'], 'rsvp': ['rsvp']}
FIELD = {'story': 'story', 'wedding': 'weddings_info', 'other_events': 'events_info', 'accommodations': 'accommodation_info',
         'travel': 'travel_info', 'faqs': 'faqs', 'things_to_do': 'things_to_do', 'registry': 'registry_info'}
VIS = """(ids) => ids.map(id => { const e = document.getElementById(id); if (!e) return [id, 'absent'];
  const r = e.getBoundingClientRect(); const cs = getComputedStyle(e);
  return [id, (cs.display !== 'none' && cs.visibility !== 'hidden' && r.height > 1) ? 'shown' : 'hidden']; })"""
FAQHEAD = """() => [...document.querySelectorAll('h2, .section-title, [class*="ntk-header"], [class*="faq-header"]')]
  .filter(e => /need to know|faq/i.test(e.textContent) && e.getClientRects().length && getComputedStyle(e).visibility !== 'hidden')
  .map(e => e.textContent.trim().slice(0, 30))"""
FAQITEMS = """() => [...document.querySelectorAll('.faq-item, .ntk-item, .faq-question, .ntk-question, .faq-q')].filter(e => e.getClientRects().length).length"""
def case(pg, tid, mutate):
    pg.goto(f'http://localhost:{PORT}/template-{tid}.html', wait_until='domcontentloaded')
    pg.wait_for_function('typeof window.hydrateTemplate === "function" && !!window.SAMPLE_DATA')
    pg.evaluate("""(m) => { const d = JSON.parse(JSON.stringify(window.SAMPLE_DATA));
      d.events = (d.events || []).map(e => ({ id: String(e.id || ''), name: String(e.name || '') }));
      d.menu_config = Object.assign({}, d.menu_config||{}, {home:true,story:true,wedding:true,other_events:true,accommodations:true,things_to_do:true,faqs:true,travel:true,gallery:false,registry:true,rsvp:true});
      if (!d.things_to_do) d.things_to_do = 'Things probe.'; if (!d.registry_info) d.registry_info = 'Registry probe.';
      if (!d.story) d.story = 'Story probe.';
      (new Function('d', m))(d);
      window.postMessage({type:'HYDRATE_TEMPLATE', payload:d}, '*'); }""", mutate)
    pg.wait_for_function('!document.body.classList.contains("hydrating")', timeout=9000); pg.wait_for_timeout(300)
out = {}
TIDS = sys.argv[1:] or [_os.path.basename(p)[9:-5] for p in sorted(glob.glob(_os.path.join(TEMPLATE_DIR, 'template-*.html')))]
with sync_playwright() as p:
    br = p.chromium.launch()
    for tid in TIDS:
        out[tid] = {}
        ctx = br.new_context(viewport={'width': 1280, 'height': 900}); pg = ctx.new_page()
        for sec, ids in ANCH.items():
            row = {}
            for label, m in [('all on', ''), ('toggle off', f"d.menu_config.{sec} = false;"),
                             ('box empty', f"d.{FIELD.get(sec,'_x')} = '';"),
                             ('filler br only', f"d.{FIELD.get(sec,'_x')} = '<br data-mp-filler=\"1\">';")]:
                if label != 'all on' and label != 'toggle off' and sec not in FIELD: continue
                case(pg, tid, m)
                v = [s for _, s in pg.evaluate(VIS, ids) if s != 'absent']
                row[label] = 'shown' if 'shown' in v else ('hidden' if v else 'no anchor')
                if sec == 'faqs':
                    row[label] += ' head=%s items=%d' % (bool(pg.evaluate(FAQHEAD)), pg.evaluate(FAQITEMS))
            out[tid][sec] = row
        ctx.close(); print(tid, flush=True)
    br.close()
for t in out: json.dump(out[t], open(_os.path.join(MAP_OUT, 'sec-%s.json' % t), 'w'))
