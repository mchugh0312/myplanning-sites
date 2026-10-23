import os, sys
if os.path.isdir('/opt/pw-browsers'): os.environ.setdefault('PLAYWRIGHT_BROWSERS_PATH', '/opt/pw-browsers')
from playwright.sync_api import sync_playwright
R = "document.getElementById('host').shadowRoot"
LIT = "() => Object.fromEntries(['Bold','Italic','Underline'].map(t => { const b = [...%s.querySelectorAll('#fmt button')].find(x => x.title === t); return [t[0], getComputedStyle(b).backgroundColor !== 'rgba(0, 0, 0, 0)']; }))" % R
POS = "(w) => { const box = %s.querySelector('[contenteditable]'); const tw = document.createTreeWalker(box, NodeFilter.SHOW_TEXT); let n; while ((n = tw.nextNode())) if (n.textContent.includes(w)) { const i = n.textContent.indexOf(w); const r = document.createRange(); r.setStart(n, i); r.setEnd(n, i + w.length); const b = r.getBoundingClientRect(); return [b.left + 1, b.top + b.height/2, b.right - 1]; } }" % R
BTN = "(t) => { const b = [...%s.querySelectorAll('#fmt button')].find(x => x.title === t); const r = b.getBoundingClientRect(); return [r.x + r.width/2, r.y + r.height/2]; }" % R
BOX = "() => %s.querySelector('[contenteditable]').innerHTML" % R
STY = "(w) => { const box = %s.querySelector('[contenteditable]'); const tw = document.createTreeWalker(box, NodeFilter.SHOW_TEXT); let n; while ((n = tw.nextNode())) if (n.textContent.includes(w)) { const c = getComputedStyle(n.parentElement); return c.fontWeight + '/' + c.fontStyle; } return 'missing'; }" % R
with sync_playwright() as p:
    br = p.chromium.launch(); pg = br.new_page(viewport={'width': 700, 'height': 600}); errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto(f'http://localhost:{sys.argv[1]}/index_underlined.html'); pg.wait_for_timeout(600)
    x = pg.evaluate(POS, 'The Reception'); pg.mouse.click(x[2], x[1]); pg.wait_for_timeout(200)
    print('1. click at end of "The Reception":', pg.evaluate(LIT))
    b = pg.evaluate(BTN, 'Underline'); pg.mouse.click(b[0], b[1]); pg.wait_for_timeout(250)
    print('2. press U:', pg.evaluate(LIT))
    print('   saved, around Reception:', pg.evaluate('window.__val').split('<br><br>')[1][:80])
    x = pg.evaluate(POS, 'Estancia La Jolla'); pg.mouse.move(x[0], x[1]); pg.mouse.down(); pg.mouse.move(x[2], x[1]); pg.mouse.up(); pg.wait_for_timeout(200)
    b = pg.evaluate(BTN, 'Bold'); pg.mouse.click(b[0], b[1]); pg.wait_for_timeout(300)
    print('3. select "Estancia La Jolla", press B:', pg.evaluate(LIT))
    print('   in the box the words are:', pg.evaluate(STY, 'Estancia La Jolla'))
    print('   saved value has bold:', 'font-weight: bold' in pg.evaluate('window.__val') or '<b>' in pg.evaluate('window.__val'))
    print('   box html (start):', pg.evaluate(BOX)[:300])
    print('errors', errs); br.close()
