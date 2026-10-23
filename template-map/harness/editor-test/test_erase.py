import os, sys
if os.path.isdir('/opt/pw-browsers'): os.environ.setdefault('PLAYWRIGHT_BROWSERS_PATH', '/opt/pw-browsers')
from playwright.sync_api import sync_playwright
INIT = '<b>Alpha</b> <i>Bravo</i> <span style="font-family: Courier New;">Charlie</span> <u>Delta</u> end'
with sync_playwright() as p:
    br = p.chromium.launch()
    for shadow in ['0', '1']:
        R = "(document.getElementById('host').shadowRoot || document.getElementById('host'))"
        POS = "(w) => { const box = %s.querySelector('[contenteditable]'); const tw = document.createTreeWalker(box, NodeFilter.SHOW_TEXT); let n; while ((n = tw.nextNode())) if (n.textContent.includes(w)) { const i = n.textContent.indexOf(w); const r = document.createRange(); r.setStart(n, i); r.setEnd(n, i + w.length); const b = r.getBoundingClientRect(); return [b.left + 1, b.top + b.height/2, b.right - 1]; } }" % R
        BTN = "() => { const b = [...%s.querySelectorAll('#fmt button')].find(x => /Clear formatting/.test(x.title)); const r = b.getBoundingClientRect(); return [r.x + r.width/2, r.y + r.height/2]; }" % R
        SELTXT = "() => { const r = %s; const s = (r.getSelection && r !== document.getElementById('host')) ? r.getSelection() : getSelection(); return String(s); }" % R
        print('==', 'inside a shadow root' if shadow == '1' else 'ordinary page')
        for label, word in [('select "Charlie" (font), erase', 'Charlie'), ('select "Echo" (font + bold), erase', 'Echo'), ('select "Alpha" (bold), erase', 'Alpha'), ('nothing selected, erase', None)]:
            pg = br.new_page(viewport={'width': 640, 'height': 300})
            pg.goto(f'http://localhost:{sys.argv[1]}/index_erase.html?shadow={shadow}'); pg.wait_for_timeout(500)
            if word:
                x = pg.evaluate(POS, word); pg.mouse.move(x[0], x[1]); pg.mouse.down(); pg.mouse.move(x[2], x[1]); pg.mouse.up(); pg.wait_for_timeout(150)
            else:
                x = pg.evaluate(POS, 'end'); pg.mouse.click(x[2], x[1]); pg.wait_for_timeout(150)
            b = pg.evaluate(BTN); pg.mouse.click(b[0], b[1]); pg.wait_for_timeout(250)
            print(f'   {label:34} saved: {pg.evaluate("window.__val")}')
            print(f'   {"":34} selection after: {pg.evaluate(SELTXT)!r}')
            pg.close()
    br.close()
