import os, sys
if os.path.isdir('/opt/pw-browsers'): os.environ.setdefault('PLAYWRIGHT_BROWSERS_PATH', '/opt/pw-browsers')
from playwright.sync_api import sync_playwright
ORDER = "() => [...document.querySelectorAll('img')].map(i => window.__L[i.getAttribute('src')]).join('')"
SAVED = "() => window.__urls.map(u => window.__L[u]).join('')"
HERO = "() => { const t = [...document.querySelectorAll('img')][0].parentElement; return window.__L[t.querySelector('img').getAttribute('src')] + (t.textContent.includes('HERO') ? ' has HERO' : ''); }"
def centre(pg, i): return pg.evaluate(f"() => {{ const r = document.querySelectorAll('img')[{i}].parentElement.getBoundingClientRect(); return [r.x + r.width/2, r.y + r.height/2]; }}")
with sync_playwright() as p:
    br = p.chromium.launch(); pg = br.new_page(viewport={'width': 600, 'height': 400}); errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto(f'http://localhost:{sys.argv[1]}/index_imgset.html'); pg.wait_for_timeout(500)
    print('start                      shown', pg.evaluate(ORDER), '| saved', pg.evaluate(SAVED))
    a = centre(pg, 0); d = centre(pg, 3)
    pg.mouse.move(*a); pg.mouse.down(); pg.mouse.move(a[0] + 10, a[1] + 5, steps=3); pg.mouse.move(*d, steps=8); pg.wait_for_timeout(250)
    print('dragging A over D          shown', pg.evaluate(ORDER), '| saved', pg.evaluate(SAVED), '| faded:', pg.evaluate("() => [...document.querySelectorAll('img')].filter(i => getComputedStyle(i.parentElement).opacity < 0.9).map(i => window.__L[i.getAttribute('src')]).join('')"))
    pg.mouse.up(); pg.wait_for_timeout(250)
    print('dropped                    shown', pg.evaluate(ORDER), '| saved', pg.evaluate(SAVED), '| first tile:', pg.evaluate(HERO))
    # drop in the GAP between two photos
    e = centre(pg, 4); b0 = pg.evaluate("() => { const r1 = document.querySelectorAll('img')[0].parentElement.getBoundingClientRect(), r2 = document.querySelectorAll('img')[1].parentElement.getBoundingClientRect(); return [(r1.right + r2.left) / 2, r1.y + r1.height/2]; }")
    s1 = centre(pg, 1)
    pg.mouse.move(*e); pg.mouse.down(); pg.mouse.move(e[0] - 10, e[1], steps=3); pg.mouse.move(*s1, steps=8); pg.mouse.move(*b0, steps=4); pg.wait_for_timeout(200)
    pg.mouse.up(); pg.wait_for_timeout(250)
    print('E over 2nd, dropped in gap shown', pg.evaluate(ORDER), '| saved', pg.evaluate(SAVED))
    # release OUTSIDE the grid: abandoned, order unchanged
    c = centre(pg, 2)
    pg.mouse.move(*c); pg.mouse.down(); pg.mouse.move(c[0] + 10, c[1], steps=3); pg.mouse.move(c[0], 380, steps=8); pg.wait_for_timeout(200); pg.mouse.up(); pg.wait_for_timeout(250)
    print('released outside the grid  shown', pg.evaluate(ORDER), '| saved', pg.evaluate(SAVED))
    print('errors', errs); br.close()
