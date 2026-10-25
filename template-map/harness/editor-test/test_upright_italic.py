import os, sys
if os.path.isdir('/opt/pw-browsers'): os.environ.setdefault('PLAYWRIGHT_BROWSERS_PATH', '/opt/pw-browsers')
from playwright.sync_api import sync_playwright
R = "document.getElementById('host').shadowRoot"
def box(pg, b): return pg.evaluate("(b) => { const e = %s.querySelector('#' + b + ' [contenteditable]'); const tw = document.createTreeWalker(e, NodeFilter.SHOW_TEXT); let n; const st = []; while ((n = tw.nextNode())) if (n.textContent.trim()) st.push(getComputedStyle(n.parentElement).fontStyle); return st.join('/'); }" % R, b)
def lit(pg, b): return pg.evaluate("(b) => { const x = [...%s.querySelectorAll('#' + b + ' button')].find(y => (y.title || '').startsWith('Italic')); return getComputedStyle(x).backgroundColor !== 'rgba(0, 0, 0, 0)'; }" % R, b)
def press(pg, b): xy = pg.evaluate("(b) => { const x = [...%s.querySelectorAll('#' + b + ' button')].find(y => (y.title || '').startsWith('Italic')); const r = x.getBoundingClientRect(); return [r.x + r.width/2, r.y + r.height/2]; }" % R, b); pg.mouse.click(*xy); pg.wait_for_timeout(250)
def select(pg, b, words=None):
    pg.evaluate("([b, w]) => { const e = %s.querySelector('#' + b + ' [contenteditable]'); e.focus(); const r = document.createRange(); if (!w) r.selectNodeContents(e); else { const tw = document.createTreeWalker(e, NodeFilter.SHOW_TEXT); let n; while ((n = tw.nextNode())) if (n.textContent.includes(w)) { const i = n.textContent.indexOf(w); r.setStart(n, i); r.setEnd(n, i + w.length); break; } } const s = %s.getSelection ? %s.getSelection() : getSelection(); s.removeAllRanges(); s.addRange(r); document.dispatchEvent(new Event('selectionchange')); }" % (R, R, R), [b, words]); pg.wait_for_timeout(200)
with sync_playwright() as p:
    br = p.chromium.launch(); pg = br.new_page(viewport={'width': 640, 'height': 500}); errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)[:120]))
    pg.goto(f'http://localhost:{sys.argv[1]}/index_ital.html'); pg.wait_for_timeout(600)
    print('start            box', box(pg, 'story'))
    select(pg, 'story'); print('select all       I lit:', lit(pg, 'story'))
    press(pg, 'story'); print('1. press I       box', box(pg, 'story'), '| I lit:', lit(pg, 'story'), '| saved:', pg.evaluate('window.__story'))
    select(pg, 'story'); press(pg, 'story'); print('2. press I again box', box(pg, 'story'), '| saved:', pg.evaluate('window.__story'))
    select(pg, 'story', 'rainy Tuesday'); press(pg, 'story'); print('3. two words     box', box(pg, 'story'), '| saved:', pg.evaluate('window.__story'))
    select(pg, 'story', 'rainy Tuesday'); press(pg, 'story')
    select(pg, 'story'); pg.keyboard.press('Control+i'); pg.wait_for_timeout(250); print('4. Ctrl+I        box', box(pg, 'story'), '| saved:', pg.evaluate('window.__story')[:60])
    select(pg, 'plain', 'Plain'); press(pg, 'plain'); print('5. upright box   saved:', pg.evaluate('window.__plain'))
    print('errors', errs); br.close()
