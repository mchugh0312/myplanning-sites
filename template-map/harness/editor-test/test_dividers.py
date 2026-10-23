import os, sys, json
if os.path.isdir('/opt/pw-browsers'): os.environ.setdefault('PLAYWRIGHT_BROWSERS_PATH', '/opt/pw-browsers')
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    br = p.chromium.launch(); pg = br.new_page(viewport={'width': 560, 'height': 640}); errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto(f'http://localhost:{sys.argv[1]}/index_dividers.html'); pg.wait_for_selector('#story [contenteditable]'); pg.wait_for_timeout(400)
    pg.screenshot(path=os.environ.get('SHOT_DIR', '.') + '/dividers.png')
    print('buttons events:', pg.evaluate("() => [...document.querySelectorAll('#events button')].map(b => b.title).filter(t => /Divider|Line break/.test(t)).map(t => t.split(':')[0])"),
          '| story:', pg.evaluate("() => [...document.querySelectorAll('#story button')].map(b => b.title).filter(t => /Divider|Line break/.test(t)).map(t => t.split(':')[0])"))
    # Divider at the cursor: put the caret after "4pm, The Chapel" and press the real button
    pg.evaluate("""() => { const box = document.querySelector('#events [contenteditable]'); box.focus();
      const tw = document.createTreeWalker(box, NodeFilter.SHOW_TEXT); let n; while ((n = tw.nextNode())) if (n.textContent.includes('4pm, The Chapel')) break;
      const r = document.createRange(); r.setStart(n, n.textContent.indexOf(',')); r.collapse(true); getSelection().removeAllRanges(); getSelection().addRange(r); }""")
    pg.evaluate("() => { const b = [...document.querySelectorAll('#events button')].find(x => /^Divider/.test(x.title)); const r = b.getBoundingClientRect(); window.__xy = [r.x + r.width/2, r.y + r.height/2]; }")
    xy = pg.evaluate('window.__xy'); pg.mouse.click(xy[0], xy[1]); pg.wait_for_timeout(150)
    pg.mouse.click(540, 630); pg.wait_for_timeout(300)
    print('events saved after Divider:', pg.evaluate('window.__val_events'))
    print('travel saved (unchanged):', pg.evaluate('window.__val_travel'))
    print('dividers drawn in events box:', pg.evaluate("() => document.querySelectorAll('#events mp-t[data-follows]').length"))
    pg.screenshot(path=os.environ.get('SHOT_DIR', '.') + '/dividers-after.png')
    print('errors:', errs)
    br.close()
