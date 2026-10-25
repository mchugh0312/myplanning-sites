import os, sys
if os.path.isdir('/opt/pw-browsers'): os.environ.setdefault('PLAYWRIGHT_BROWSERS_PATH', '/opt/pw-browsers')
from playwright.sync_api import sync_playwright
R = "document.getElementById('host').shadowRoot"
def weight(pg, b, w): return pg.evaluate("([b, w]) => { const e = %s.querySelector('#' + b + ' [contenteditable]'); const tw = document.createTreeWalker(e, NodeFilter.SHOW_TEXT); let n; while ((n = tw.nextNode())) if (n.textContent.includes(w)) return getComputedStyle(n.parentElement).fontWeight; }" % R, [b, w])
def lit(pg, b): return pg.evaluate("(b) => { const x = [...%s.querySelectorAll('#' + b + ' button')].find(y => (y.title || '').startsWith('Bold')); return getComputedStyle(x).backgroundColor !== 'rgba(0, 0, 0, 0)'; }" % R, b)
def press(pg, b): xy = pg.evaluate("(b) => { const x = [...%s.querySelectorAll('#' + b + ' button')].find(y => (y.title || '').startsWith('Bold')); const r = x.getBoundingClientRect(); return [r.x + r.width/2, r.y + r.height/2]; }" % R, b); pg.mouse.click(*xy); pg.wait_for_timeout(250)
def select(pg, b, w):
    pg.evaluate("([b, w]) => { const e = %s.querySelector('#' + b + ' [contenteditable]'); e.focus(); const tw = document.createTreeWalker(e, NodeFilter.SHOW_TEXT); let n; while ((n = tw.nextNode())) if (n.textContent.includes(w)) { const i = n.textContent.indexOf(w); const r = document.createRange(); r.setStart(n, i); r.setEnd(n, i + w.length); const s = %s.getSelection ? %s.getSelection() : getSelection(); s.removeAllRanges(); s.addRange(r); break; } document.dispatchEvent(new Event('selectionchange')); }" % (R, R, R), [b, w]); pg.wait_for_timeout(200)
with sync_playwright() as p:
    br = p.chromium.launch(); pg = br.new_page(viewport={'width': 640, 'height': 800}); errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)[:100]))
    pg.goto(f'http://localhost:{sys.argv[1]}/index_bold.html'); pg.wait_for_timeout(600)
    select(pg, 'tr', 'Flights Info'); press(pg, 'tr'); print('1. title, B        ', weight(pg, 'tr', 'Flights'), '| B lit', lit(pg, 'tr'), '|', pg.evaluate('window.__tr'))
    pg.mouse.click(620, 780); pg.wait_for_timeout(300); print('   clicked away     ', weight(pg, 'tr', 'Flights'), '|', pg.evaluate('window.__tr'))
    select(pg, 'tr', 'Flights Info'); press(pg, 'tr'); print('2. title, B again  ', weight(pg, 'tr', 'Flights'), '| B lit', lit(pg, 'tr'), '|', pg.evaluate('window.__tr'))
    select(pg, 'tr', 'Info'); press(pg, 'tr'); print('3. part of a title ', weight(pg, 'tr', 'Info'), '|', pg.evaluate('window.__tr'))
    select(pg, 'tr', 'Info'); press(pg, 'tr')
    select(pg, 'tr', 'Hyatt'); press(pg, 'tr'); print('4. body text, B    ', weight(pg, 'tr', 'Hyatt'), '|', pg.evaluate('window.__tr'))
    select(pg, 'cc', 'Flights Info'); print('5. design-bold title, before', weight(pg, 'cc', 'Flights'), '| B lit', lit(pg, 'cc')); press(pg, 'cc')
    print('   B makes it lighter', weight(pg, 'cc', 'Flights'), '| B lit', lit(pg, 'cc'), '|', pg.evaluate('window.__cc'))
    select(pg, 'cc', 'Flights Info'); press(pg, 'cc'); print('   B again          ', weight(pg, 'cc', 'Flights'), '|', pg.evaluate('window.__cc'))
    print('errors', errs); br.close()
