import os as _os
TEMPLATE_DIR = _os.environ.get('TEMPLATE_DIR', _os.path.abspath(_os.path.join(_os.path.dirname(__file__), '..', '..')))
MAP_OUT = _os.environ.get('MAP_OUT', _os.path.join(_os.path.dirname(_os.path.abspath(__file__)), 'out'))
HERE = _os.path.dirname(_os.path.abspath(__file__))
PORT = int(_os.environ.get('MAP_PORT', '8765'))
_os.makedirs(MAP_OUT, exist_ok=True)
import json, os, glob
if os.path.isdir('/opt/pw-browsers'): os.environ.setdefault('PLAYWRIGHT_BROWSERS_PATH', '/opt/pw-browsers')
from playwright.sync_api import sync_playwright
FONT = 'font-family:&quot;Courier New&quot;'
FIELDS = ['weddings_info', 'events_info', 'faqs', 'accommodation_info', 'travel_info', 'story', 'things_to_do']
def partial(tag):
    # Title-line marks: Kilo Lima Mike Oscar. Body-line marks: Bravo Charlie Delta Echo.
    return ('Heading <b>Kilo</b> <i>Lima</i> <u>Mike</u> <span style="%s">Oscar</span><br>'
            'Body <b>Bravo</b> <i>Charlie</i> <u>Delta</u> <span style="%s">Echo</span> end<br>'
            'Another line here<br><br>Second Heading<br>Second body Papa words') % (FONT, FONT)
def whole(open_, close):
    return open_ + 'Heading Quebec<br>Body Romeo words<br><br>Second Heading Sierra<br>Second body Tango words' + close
VARIANTS = {'partial': {f: partial(f) for f in FIELDS},
            'whole-i': {f: whole('<i>', '</i>') for f in FIELDS},
            'whole-u': {f: whole('<u>', '</u>') for f in FIELDS},
            'whole-font': {f: whole('<span style="%s">' % FONT, '</span>') for f in FIELDS}}
MARKS = {'partial': {'Kilo': 'b', 'Lima': 'i', 'Mike': 'u', 'Oscar': 'font', 'Bravo': 'b', 'Charlie': 'i', 'Delta': 'u', 'Echo': 'font', 'Papa': None},
         'whole-i': {'Quebec': 'i', 'Romeo': 'i', 'Sierra': 'i', 'Tango': 'i'},
         'whole-u': {'Quebec': 'u', 'Romeo': 'u', 'Sierra': 'u', 'Tango': 'u'},
         'whole-font': {'Quebec': 'font', 'Romeo': 'font', 'Sierra': 'font', 'Tango': 'font'}}
SEC = {'weddings_info': 'wedding', 'events_info': 'other_events', 'faqs': 'faqs', 'accommodation_info': 'accommodations',
       'travel_info': 'travel', 'story': 'story', 'things_to_do': 'things_to_do'}
CHECK = """(args) => {
  const [word, anchors] = args;
  const res = [];
  const tw = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  let n;
  while ((n = tw.nextNode())) {
    if (!n.textContent.includes(word)) continue;
    const el = n.parentElement;
    if (!el.getClientRects().length) continue;
    let sec = null, a = el;
    while (a && a !== document.body) { if (a.id && anchors.includes(a.id)) { sec = a.id; break; } a = a.parentElement; }
    let underline = false; a = el;
    while (a && a !== document.body) { if ((getComputedStyle(a).textDecorationLine || '').includes('underline')) { underline = true; break; } a = a.parentElement; }
    const cs = getComputedStyle(el);
    /* the block the word sits in, for a baseline */
    let blk = el; while (blk.parentElement && getComputedStyle(blk).display === 'inline') blk = blk.parentElement;
    const bs = getComputedStyle(blk);
    res.push({ sec, weight: cs.fontWeight, italic: cs.fontStyle, underline, font: cs.fontFamily.split(',')[0].replace(/["']/g,''),
               blockWeight: bs.fontWeight, blockItalic: bs.fontStyle, blockFont: bs.fontFamily.split(',')[0].replace(/["']/g,''), blockCls: blk.className || blk.tagName });
  }
  return res;
}"""
ANCH = {'wedding': ['events-primary', 'wedding', 'event-schedule', 'event-details', 'weekend', 'itinerary'],
        'other_events': ['other-events', 'events'], 'accommodations': ['accommodations'],
        'travel': ['travel-section', 'travel', 'travel-standalone', 'accommodations'],
        'faqs': ['need-to-know', 'ntk', 'faq-section'], 'things_to_do': ['things-to-do', 'need-to-know', 'ntk', 'faq-section'],
        'story': ['our-story', 'story']}
out = {}
with sync_playwright() as p:
    br = p.chromium.launch()
    import sys
    for tid in (sys.argv[1:] or [_os.path.basename(p)[9:-5] for p in sorted(glob.glob(_os.path.join(TEMPLATE_DIR, 'template-*.html')))]):
        out[tid] = {}
        for var, fieldsHtml in VARIANTS.items():
            out[tid][var] = {}
            for field in FIELDS:
                ctx = br.new_context(viewport={'width': 1280, 'height': 900}); pg = ctx.new_page()
                pg.add_init_script("document.addEventListener('DOMContentLoaded',()=>{const s=document.createElement('style');s.textContent='*{transition:none!important;animation:none!important}';document.head.appendChild(s);});")
                pg.goto(f'http://localhost:{PORT}/template-{tid}.html', wait_until='domcontentloaded')
                pg.wait_for_function('typeof window.hydrateTemplate === "function" && !!window.SAMPLE_DATA')
                pg.evaluate("""([field, html]) => { const d = JSON.parse(JSON.stringify(window.SAMPLE_DATA)); d.events = (d.events || []).map(e => ({ id: String(e.id || ''), name: String(e.name || '') })); 
                  d.menu_config = Object.assign({}, d.menu_config||{}, {home:true,story:true,wedding:true,other_events:true,accommodations:true,things_to_do:true,faqs:true,travel:true,gallery:false,registry:true,rsvp:true});
                  d[field] = html; window.postMessage({type:'HYDRATE_TEMPLATE', payload:d}, '*'); }""", [field, fieldsHtml[field]])
                pg.wait_for_function('!document.body.classList.contains("hydrating")', timeout=9000); pg.wait_for_timeout(300)
                anchors = ANCH[SEC[field]]
                out[tid][var][field] = {w: pg.evaluate(CHECK, [w, anchors]) for w in MARKS[var]}
                ctx.close()
        print(tid, flush=True)
    br.close()
for t in out: json.dump(out[t], open(_os.path.join(MAP_OUT, 'fmt-%s.json' % t), 'w'))
json.dump(MARKS, open(_os.path.join(MAP_OUT, 'fmt-marks.json'), 'w'))
