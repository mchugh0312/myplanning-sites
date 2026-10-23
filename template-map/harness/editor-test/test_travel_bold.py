import os, sys
if os.path.isdir('/opt/pw-browsers'): os.environ.setdefault('PLAYWRIGHT_BROWSERS_PATH', '/opt/pw-browsers')
from playwright.sync_api import sync_playwright
R = "document.getElementById('host').shadowRoot"
W = "(w) => { const box = %s.querySelector('[contenteditable]'); const tw = document.createTreeWalker(box, NodeFilter.SHOW_TEXT); let n; while ((n = tw.nextNode())) if (n.textContent.trim() === w || n.textContent.includes(w)) return getComputedStyle(n.parentElement).fontWeight; return 'missing'; }" % R
POS = "(w) => { const box = %s.querySelector('[contenteditable]'); const tw = document.createTreeWalker(box, NodeFilter.SHOW_TEXT); let n; while ((n = tw.nextNode())) if (n.textContent.includes(w)) { const i = n.textContent.indexOf(w); const r = document.createRange(); r.setStart(n, i); r.setEnd(n, i + w.length); const b = r.getBoundingClientRect(); return [b.left + 1, b.top + b.height/2, b.right - 1]; } }" % R
BTN = "(t) => { const b = [...%s.querySelectorAll('#fmt button')].find(x => x.title === t); const r = b.getBoundingClientRect(); return [r.x + r.width/2, r.y + r.height/2]; }" % R
LIT = "() => { const b = [...%s.querySelectorAll('#fmt button')].find(x => x.title === 'Bold'); return getComputedStyle(b).backgroundColor !== 'rgba(0, 0, 0, 0)'; }" % R
BOX = "() => %s.querySelector('[contenteditable]').innerHTML" % R
def show(pg, label):
    print(f"{label:38} box weights: Hotel={pg.evaluate(W, 'Hotel')} Flights={pg.evaluate(W, 'Flights')} body={pg.evaluate(W, 'Hyatt')} | B lit={pg.evaluate(LIT)} | saved bold on Hotel={'Hotel' in pg.evaluate('window.__val') and ('bold' in pg.evaluate('window.__val').split('Hotel')[0][-60:] or '<b>' in pg.evaluate('window.__val').split('Hotel')[0][-10:])}")
with sync_playwright() as p:
    br = p.chromium.launch(); pg = br.new_page(viewport={'width': 640, 'height': 400}); errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto(f'http://localhost:{sys.argv[1]}/index_travel.html'); pg.wait_for_timeout(500)
    x = pg.evaluate(POS, 'Hyatt'); pg.mouse.click(x[0], x[1]); pg.keyboard.press('Control+a'); pg.wait_for_timeout(150)
    b = pg.evaluate(BTN, 'Bold'); pg.mouse.click(b[0], b[1]); pg.wait_for_timeout(300)
    show(pg, '1. select all, press B')
    pg.mouse.click(630, 390); pg.wait_for_timeout(300); show(pg, '2. after clicking outside')
    x = pg.evaluate(POS, 'Hotel'); pg.mouse.move(x[0], x[1]); pg.mouse.down(); pg.mouse.move(x[2], x[1]); pg.mouse.up(); pg.wait_for_timeout(200)
    show(pg, '3. select "Hotel"')
    b = pg.evaluate(BTN, 'Bold'); pg.mouse.click(b[0], b[1]); pg.wait_for_timeout(300); show(pg, '4. press B to unbold')
    print('errors', errs); br.close()
