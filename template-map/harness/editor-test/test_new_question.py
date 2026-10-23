import os, sys
if os.path.isdir('/opt/pw-browsers'): os.environ.setdefault('PLAYWRIGHT_BROWSERS_PATH', '/opt/pw-browsers')
from playwright.sync_api import sync_playwright
R = "document.getElementById('host').shadowRoot"
STATE = "() => { const b = %s.querySelector('[contenteditable]'); const sr = %s; const s = sr.getSelection ? sr.getSelection() : getSelection(); return { titles: [...b.querySelectorAll('mp-t')].map(m => m.textContent.trim()), dividers: b.querySelectorAll('mp-t[data-follows]').length, selected: String(s) }; }" % (R, R)
BTN = "() => { const b = [...%s.querySelectorAll('#fmt button')].find(x => /Question/.test(x.textContent)); const r = b.getBoundingClientRect(); return [r.x + r.width/2, r.y + r.height/2]; }" % R
with sync_playwright() as p:
    br = p.chromium.launch(); pg = br.new_page(viewport={'width': 640, 'height': 700}); errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto(f'http://localhost:{sys.argv[1]}/index_faq.html'); pg.wait_for_timeout(600)
    print('start            ', pg.evaluate(STATE))
    b = pg.evaluate(BTN); pg.mouse.click(*b); pg.wait_for_timeout(300)
    print('+ Question once  ', pg.evaluate(STATE))
    b = pg.evaluate(BTN); pg.mouse.click(*b); pg.wait_for_timeout(300)
    print('+ Question twice ', pg.evaluate(STATE))
    pg.keyboard.type('Can we bring kids?'); pg.wait_for_timeout(300)
    print('typed            ', pg.evaluate(STATE))
    print('saved:', pg.evaluate('window.__val'))
    print('errors', errs); br.close()
