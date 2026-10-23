import os, sys
if os.path.isdir('/opt/pw-browsers'): os.environ.setdefault('PLAYWRIGHT_BROWSERS_PATH', '/opt/pw-browsers')
from playwright.sync_api import sync_playwright
SEL = """(w) => { const box = document.querySelector('#gap [contenteditable]'); const tw = document.createTreeWalker(box, NodeFilter.SHOW_TEXT); let n; while ((n = tw.nextNode())) if (n.textContent.includes(w)) { const r = document.createRange(); r.selectNodeContents(n); const b = r.getBoundingClientRect(); return [b.left + 1, b.top + b.height/2, b.right - 1]; } }"""
BTN = "(t) => { const b = [...document.querySelectorAll('#gap button')].find(x => x.title === t); const r = b.getBoundingClientRect(); return [r.x + r.width/2, r.y + r.height/2]; }"
LIT = "() => { const b = [...document.querySelectorAll('#gap button')].find(x => x.title === 'Bold'); return getComputedStyle(b).backgroundColor !== 'rgba(0, 0, 0, 0)'; }"
def select(pg, w):
    xy = pg.evaluate(SEL, w); pg.mouse.move(xy[0], xy[1]); pg.mouse.down(); pg.mouse.move(xy[2], xy[1]); pg.mouse.up(); pg.wait_for_timeout(150)
def click(pg, xy): pg.mouse.click(xy[0], xy[1]); pg.wait_for_timeout(200)
with sync_playwright() as p:
    br = p.chromium.launch(); pg = br.new_page(viewport={'width': 700, 'height': 900}); errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto(f'http://localhost:{sys.argv[1]}/index_group.html'); pg.wait_for_selector('#gap [contenteditable]'); pg.wait_for_timeout(300)
    pg.evaluate("window.__set_gap('The Ceremony<br>4pm<br><br>The Reception<br>7pm')"); pg.wait_for_timeout(300)
    # 1. font on the whole title
    select(pg, 'The Reception'); click(pg, pg.evaluate(BTN, 'Font for the selected words'))
    opt = pg.evaluate("() => { const b = [...document.querySelectorAll('button')].find(x => /Dancing Script/.test(x.textContent)); b.scrollIntoView({block:'center'}); const r = b.getBoundingClientRect(); return [r.x + r.width/2, r.y + r.height/2]; }")
    click(pg, opt); click(pg, [690, 890])
    print('1. font on a whole title, saved:', pg.evaluate('window.__val_gap'))
    # 2. bold on the whole title, then click away and select it again
    pg.evaluate("window.__set_gap('The Ceremony<br>4pm<br><br>The Reception<br>7pm')"); pg.wait_for_timeout(300)
    select(pg, 'The Reception'); click(pg, pg.evaluate(BTN, 'Bold')); click(pg, [690, 890])
    print('2. bold on a whole title, saved:', pg.evaluate('window.__val_gap'))
    select(pg, 'The Reception'); print('   reselected after clicking away - B lit:', pg.evaluate(LIT))
    click(pg, pg.evaluate(BTN, 'Bold')); click(pg, [690, 890]); print('   pressed B again to undo, saved:', pg.evaluate('window.__val_gap'))
    # 3. bold on a body word, reselect
    select(pg, '7pm'); click(pg, pg.evaluate(BTN, 'Bold')); click(pg, [690, 890]); select(pg, '7pm')
    print('3. bold body word reselected - B lit:', pg.evaluate(LIT), '| saved:', pg.evaluate('window.__val_gap'))
    print('errors', errs); br.close()
