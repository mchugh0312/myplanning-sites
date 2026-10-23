import os, sys, json
if os.path.isdir('/opt/pw-browsers'): os.environ.setdefault('PLAYWRIGHT_BROWSERS_PATH', '/opt/pw-browsers')
from playwright.sync_api import sync_playwright
BTN = """([id, title]) => { const b = [...document.querySelectorAll('#' + id + ' button')].find(x => (x.title || x.textContent || '').trim() === title || x.getAttribute('aria-label') === title); const c = getComputedStyle(b); return c.backgroundColor + ' / ' + c.color; }"""
with sync_playwright() as p:
    br = p.chromium.launch(); pg = br.new_page(viewport={'width': 900, 'height': 900}); errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto(f'http://localhost:{sys.argv[1]}/index.html'); pg.wait_for_selector('#story [contenteditable]'); pg.wait_for_timeout(400)
    box = pg.locator('#story [contenteditable]')
    print('1. Our Story box text style:', pg.evaluate("() => { const c = getComputedStyle(document.querySelector('#story [contenteditable]')); return c.fontFamily + ' ' + c.fontStyle; }"))
    print('   Italic button, caret elsewhere:', pg.evaluate(BTN, ['story', 'Italic']))
    box.click(position={'x': 120, 'y': 18}); pg.wait_for_timeout(250)
    print('   Italic button, caret in text: ', pg.evaluate(BTN, ['story', 'Italic']), '   Bold button:', pg.evaluate(BTN, ['story', 'Bold']))
    # select "We met" with the keyboard, then press the REAL Italic button
    pg.keyboard.press('Home'); pg.keyboard.down('Shift')
    for _ in range(6): pg.keyboard.press('ArrowRight')
    pg.keyboard.up('Shift'); pg.wait_for_timeout(150)
    pg.evaluate("() => { const b = [...document.querySelectorAll('#story button')].find(x => (x.title || x.textContent || '').trim() === 'Italic' || x.getAttribute('aria-label') === 'Italic'); const r = b.getBoundingClientRect(); window.__ib = [r.x + r.width/2, r.y + r.height/2]; }"); xy = pg.evaluate('window.__ib'); pg.mouse.click(xy[0], xy[1]); pg.wait_for_timeout(200)
    pg.mouse.click(850, 850); pg.wait_for_timeout(300)
    print('2. Saved value after un-italic:', pg.evaluate("window.__val_story"))
    print('3. Events box marks:', pg.evaluate("""() => [...document.querySelectorAll('#events mp-t')].map(m => (m.dataset.attire ? 'ATTIRE ' : 'TITLE ') + getComputedStyle(m).fontFamily.split(',')[0] + ' ' + (m.querySelector('em') ? getComputedStyle(m.querySelector('em')).fontStyle : getComputedStyle(m).fontStyle) + ' | ' + m.textContent)"""))
    print('   Events saved value unchanged:', pg.evaluate("window.__val_events") == 'The Ceremony<br>4pm<br><em>Cocktail Attire</em>')
    ph = lambda: pg.evaluate("() => { const d = [...document.querySelectorAll('#rsvp div[aria-hidden]')][0]; return d ? d.textContent + ' (' + getComputedStyle(d).color + ')' : 'NO PLACEHOLDER'; }")
    print('4. RSVP empty, placeholder:', ph())
    pg.locator('#rsvp [contenteditable]').click(); pg.keyboard.type('Reply by text!'); pg.wait_for_timeout(200)
    print('   after typing, placeholder:', ph(), '| saved:', pg.evaluate("window.__val_rsvp"))
    print('page errors:', errs)
    br.close()
