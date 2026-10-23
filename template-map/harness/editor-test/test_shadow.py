import os, sys
if os.path.isdir('/opt/pw-browsers'): os.environ.setdefault('PLAYWRIGHT_BROWSERS_PATH', '/opt/pw-browsers')
from playwright.sync_api import sync_playwright
R = "document.getElementById('host').shadowRoot"
LIT = "() => Object.fromEntries(['Bold','Italic'].map(t => { const b = [...%s.querySelectorAll('#fmt button')].find(x => x.title === t); return [t[0], getComputedStyle(b).backgroundColor !== 'rgba(0, 0, 0, 0)']; }))" % R
WORD = "(w) => { const box = %s.querySelector('[contenteditable]'); const tw = document.createTreeWalker(box, NodeFilter.SHOW_TEXT); let n; while ((n = tw.nextNode())) if (n.textContent.includes(w)) { const i = n.textContent.indexOf(w); const r = document.createRange(); r.setStart(n, i); r.setEnd(n, i + w.length); const b = r.getBoundingClientRect(); return [b.left + 1, b.top + b.height/2, b.right - 1]; } }" % R
BTN = "(t) => { const b = [...%s.querySelectorAll('#fmt button')].find(x => x.title === t); const r = b.getBoundingClientRect(); return [r.x + r.width/2, r.y + r.height/2]; }" % R
with sync_playwright() as p:
    br = p.chromium.launch(); pg = br.new_page(viewport={'width': 600, 'height': 400}); errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)))
    if len(sys.argv) > 2 and sys.argv[2] == 'no-root-getselection':
        pg.add_init_script("try { delete ShadowRoot.prototype.getSelection; } catch (e) {}")
    pg.goto(f'http://localhost:{sys.argv[1]}/index_shadow.html'); pg.wait_for_timeout(600)
    def sel(w):
        x = pg.evaluate(WORD, w); pg.mouse.move(x[0], x[1]); pg.mouse.down(); pg.mouse.move(x[2], x[1]); pg.mouse.up(); pg.wait_for_timeout(200)
    sel('boldword'); print('select a bold word        ', pg.evaluate(LIT))
    sel('italicword'); print('select an italic word     ', pg.evaluate(LIT))
    sel('Plain'); b = pg.evaluate(BTN, 'Bold'); pg.mouse.click(b[0], b[1]); pg.wait_for_timeout(250)
    print('select plain word, press B', pg.evaluate(LIT), '| saved:', pg.evaluate('window.__val')[:40])
    print('errors', errs); br.close()
