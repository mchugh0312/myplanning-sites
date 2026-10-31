import os, sys, json
if os.path.isdir('/opt/pw-browsers'): os.environ.setdefault('PLAYWRIGHT_BROWSERS_PATH', '/opt/pw-browsers')
from playwright.sync_api import sync_playwright
T = sys.argv[2:]
KEYS = ['story', 'wedding', 'other_events', 'travel', 'faqs', 'gallery', 'registry', 'rsvp']
ANCH = {'story': ['our-story','story','love-story','story-section'], 'wedding': ['events-primary','wedding','event-schedule','event-details','weekend','itinerary'],
        'other_events': ['other-events','events'], 'travel': ['travel-section','travel','accommodations','travel-standalone'], 'faqs': ['faqs','faq','need-to-know','need-to-knows','faq-section'],
        'gallery': ['gallery','gallery-section'], 'registry': ['registry-section','registry'], 'rsvp': ['rsvp','rsvp-section']}
PROBE = """([ids]) => { const vis = e => e && e.getClientRects().length && e.getBoundingClientRect().height > 8 && getComputedStyle(e).visibility !== 'hidden';
  const secs = ids.map(i => document.getElementById(i)).filter(vis);
  const hrefs = new Set(ids.map(i => '#' + i));
  const phone = [...document.querySelectorAll('.mp-mnav-panel a')].filter(a => hrefs.has(a.getAttribute('href'))).length;
  const desk = [...document.querySelectorAll('nav a, .top-nav a, .menu a, .nav-links a')].filter(a => hrefs.has(a.getAttribute('href')) && !a.closest('.mp-mnav-panel') && a.style.display !== 'none' && !(a.closest('li') && a.closest('li').style.display === 'none')).length;
  return [secs.length, desk, phone]; }"""
with sync_playwright() as p:
    br = p.chromium.launch()
    for t in T:
        pg = br.new_page(viewport={'width': 390, 'height': 800}, is_mobile=True)
        pg.goto(f'http://localhost:{sys.argv[1]}/template-{t}.html', wait_until='domcontentloaded')
        pg.wait_for_function('typeof window.hydrateTemplate === "function" && !!window.SAMPLE_DATA')
        base = pg.evaluate("() => { const d = JSON.parse(JSON.stringify(window.SAMPLE_DATA)); return d; }")
        allon = {k: True for k in ['home','story','wedding','other_events','travel','accommodations','faqs','things_to_do','gallery','registry','rsvp']}
        problems = []
        for k in KEYS:
            res = {}
            for state in [True, False, True]:
                mc = dict(allon); mc[k] = state
                if k == 'travel': mc['accommodations'] = state
                pg.evaluate("(mc) => { const d = JSON.parse(JSON.stringify(window.SAMPLE_DATA)); d.menu_config = mc; d.rsvp_enabled = true; window.postMessage({type:'HYDRATE_TEMPLATE', payload:d}, '*'); }", mc)
                pg.wait_for_timeout(700)
                res.setdefault(state, []).append(pg.evaluate(PROBE, [ANCH[k]]))
            on1, off, on2 = res[True][0], res[False][0], res[True][1]
            if on1[0] == 0 and on1[1] == 0 and on1[2] == 0: continue   # not a section on this design
            if off[0] > 0: problems.append(f'{k}: section still SHOWN when off')
            if off[1] > 0: problems.append(f'{k}: desktop menu link kept when off')
            if off[2] > 0: problems.append(f'{k}: phone menu link kept when off')
            if on2 != on1: problems.append(f'{k}: switching back on gives {on2} not {on1}')
        print(f'{t:17}', 'all switches behave' if not problems else problems)
        pg.close()
    br.close()
