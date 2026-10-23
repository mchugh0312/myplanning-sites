import os, sys, json
if os.path.isdir('/opt/pw-browsers'): os.environ.setdefault('PLAYWRIGHT_BROWSERS_PATH', '/opt/pw-browsers')
from playwright.sync_api import sync_playwright
def btn(pg, box, pred):
    xy = pg.evaluate("([box, pred]) => { const b = [...document.querySelectorAll('#' + box + ' button')].find(x => new RegExp(pred).test((x.title || '') + ' ' + (x.textContent || ''))); const r = b.getBoundingClientRect(); return [r.x + r.width/2, r.y + r.height/2]; }", [box, pred])
    pg.mouse.click(xy[0], xy[1]); pg.wait_for_timeout(120)
def caret(pg, box, word, offset):
    pg.evaluate("""([box, w, o]) => { const h = document.querySelector('#' + box + ' [contenteditable]'); h.focus(); const tw = document.createTreeWalker(h, NodeFilter.SHOW_TEXT); let n;
      while ((n = tw.nextNode())) if (n.textContent.includes(w)) break; const r = document.createRange(); r.setStart(n, o < 0 ? n.length : o); r.collapse(true); getSelection().removeAllRanges(); getSelection().addRange(r); }""", [box, word, offset])
gaps = lambda pg, box: pg.evaluate("(b) => document.querySelectorAll('#' + b + ' [contenteditable] .mp-gap').length", box)
blur = lambda pg: (pg.mouse.click(540, 790), pg.wait_for_timeout(250))

LIT = """() => Object.fromEntries(['Bold','Italic','Underline'].map(t => { const b = [...document.querySelectorAll('#fmt button')].find(x => x.title === t);
  const c = getComputedStyle(b).backgroundColor; return [t[0], c !== 'rgba(0, 0, 0, 0)']; }))"""
XY = """(w) => { const box = document.querySelector('#fmt [contenteditable]'); const tw = document.createTreeWalker(box, NodeFilter.SHOW_TEXT); let n;
  while ((n = tw.nextNode())) if (n.textContent.includes(w)) { const r = document.createRange(); r.setStart(n, 3); r.setEnd(n, 4); const b = r.getBoundingClientRect(); return [b.x + 1, b.y + b.height/2]; } }"""
with sync_playwright() as p:
    print('== MP-915: B/I/U lit in formatted text')
    br = p.chromium.launch(); pg = br.new_page(viewport={'width': 560, 'height': 800}); errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto(f'http://localhost:{sys.argv[1]}/index_group.html'); pg.wait_for_selector('#fmt [contenteditable]'); pg.wait_for_timeout(300)
    for w in ['boldword', 'italicword', 'underword', 'Plain']:
        xy = pg.evaluate(XY, w); pg.mouse.click(xy[0], xy[1]); pg.wait_for_timeout(150)
        print(f'click into {w:11}', pg.evaluate(LIT))
    xy = pg.evaluate(XY, 'Plain'); pg.mouse.click(xy[0], xy[1]); pg.wait_for_timeout(100)
    for _ in range(8): pg.keyboard.press('ArrowRight')
    pg.wait_for_timeout(150); print('arrows into boldword ', pg.evaluate(LIT))
    pg.keyboard.type('X'); pg.wait_for_timeout(150); print('typed inside bold   ', pg.evaluate(LIT))
    pg.reload(); pg.wait_for_selector('#gap [contenteditable]'); pg.wait_for_timeout(300)

    SP = 'Add space'
    print('== MP-935: one click, one spacer')
    for where, w, o in [('end of a middle line', 'Line two', -1), ('start of a line', 'Line three', 0), ('very end of box', 'Line three', -1), ('mid-word', 'Line one', 3)]:
        caret(pg, 'gap', w, o); before = gaps(pg, 'gap'); btn(pg, 'gap', SP); after = gaps(pg, 'gap')
        print(f'   {where:22} spacers {before} -> {after}', 'OK' if after == before + 1 else 'PROBLEM')
    blur(pg)
    print('   saved:', pg.evaluate('window.__val_gap'))
    print('== MP-916: typing at a spacer, and lines after it')
    pg.evaluate("window.__set_gap('Line one<br>Line two<br>Line three')"); pg.wait_for_timeout(200)
    caret(pg, 'gap', 'Line one', -1); btn(pg, 'gap', SP)
    g = pg.evaluate("() => { const r = document.querySelector('#gap .mp-gap').getBoundingClientRect(); return [r.x + 20, r.y + r.height/2]; }")
    pg.mouse.click(g[0], g[1]); pg.wait_for_timeout(100); pg.keyboard.type('TYPED'); pg.wait_for_timeout(100)
    inside = pg.evaluate("() => [...document.querySelectorAll('#gap .mp-gap')].some(s => s.textContent.includes('TYPED'))")
    blur(pg); v = pg.evaluate('window.__val_gap')
    print('   text went inside the spacer:', inside, '| saved:', v)
    print('   lines after the spacer kept:', all(x in v for x in ['Line two', 'Line three']))
    print('== MP-920: New Event, empty box and filled box')
    btn(pg, 'empty', r'\+ ?Event|New Event'); blur(pg); v1 = pg.evaluate('window.__val_empty')
    print('   empty box ->', repr(v1), '| leading break:', v1.lstrip().lower().startswith('<br'))
    btn(pg, 'empty', r'\+ ?Event|New Event'); blur(pg); v2 = pg.evaluate('window.__val_empty')
    print('   second    ->', repr(v2))
    print('== MP-921: new question with the caret at the top')
    caret(pg, 'faq', 'First question', 0); btn(pg, 'faq', r'\+ ?Question|New Question'); blur(pg)
    v3 = pg.evaluate('window.__val_faq'); print('   saved:', repr(v3), '| first question still first:', v3.startswith('First question?'))
    print('errors', errs); br.close()
