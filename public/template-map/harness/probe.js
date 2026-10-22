(()=>{const s=document.createElement('style');s.id='mp-probe-still';s.textContent='*,*::before,*::after{transition:none!important;animation:none!important}';document.head.appendChild(s);document.body.offsetHeight;})();
/* Runs inside a hydrated template. Returns facts only; changes nothing it does
   not restore. */
(() => {
  const SECTION_ANCHORS = {
    home: ['hero', 'home'],
    story: ['our-story', 'story'],
    wedding: ['events-primary', 'wedding', 'event-schedule', 'event-details', 'weekend', 'itinerary'],
    other_events: ['other-events', 'events'],
    accommodations: ['accommodations'],
    travel: ['travel-section', 'travel', 'travel-standalone'],
    faqs: ['need-to-know', 'ntk', 'faq-section'],
    things_to_do: ['things-to-do'],
    gallery: ['gallery'],
    registry: ['registry-section', 'registry', 'registry-wrap'],
    rsvp: ['rsvp']
  };
  const idToSection = {};
  Object.keys(SECTION_ANCHORS).forEach(k => SECTION_ANCHORS[k].forEach(id => { if (!(id in idToSection)) idToSection[id] = k; }));

  const NAV_SEL = 'nav, .top-nav, header, .menu-drawer, .mp-mnav-panel, [class*="nav"]';
  const visible = el => {
    if (!el.getClientRects().length) return false;
    const cs = getComputedStyle(el);
    return cs.visibility !== 'hidden' && cs.display !== 'none' && parseFloat(cs.opacity || '1') > 0;
  };
  const sectionOf = el => {
    if (el.closest('.mp-brand-footer, footer')) return 'footer';
    if (el.closest(NAV_SEL) && el.closest('a, nav, .top-nav, .menu-drawer')) {
      if (el.closest('a') || el.closest('nav, .top-nav, .menu-drawer')) return 'nav';
    }
    let n = el;
    while (n && n !== document.body) {
      if (n.id && idToSection[n.id]) return idToSection[n.id];
      n = n.parentElement;
    }
    return 'other';
  };
  const path = el => {
    const out = [];
    let n = el;
    while (n && n !== document.body && out.length < 4) {
      let s = n.tagName.toLowerCase();
      if (n.id) s += '#' + n.id;
      else if (n.classList.length) s += '.' + [...n.classList].slice(0, 2).join('.');
      out.unshift(s);
      if (n.id) break;
      n = n.parentElement;
    }
    return out.join(' > ');
  };
  const effBg = el => {
    let n = el;
    while (n) {
      const c = getComputedStyle(n).backgroundColor;
      if (c && c !== 'rgba(0, 0, 0, 0)' && c !== 'transparent') return c;
      n = n.parentElement;
    }
    return 'rgb(255, 255, 255)';
  };

  /* Every visible element that owns text directly. */
  const leaves = [];
  document.querySelectorAll('body *').forEach(el => {
    if (/^(SCRIPT|STYLE|NOSCRIPT|SVG|PATH)$/i.test(el.tagName)) return;
    if (el.closest('#mp-lb, .gallery-lightbox, #galleryLightbox')) return;
    const own = [...el.childNodes].filter(c => c.nodeType === 3).map(c => c.textContent).join('').replace(/\s+/g, ' ').trim();
    if (!own) return;
    if (!visible(el)) return;
    leaves.push(el);
  });

  const snap = el => {
    const cs = getComputedStyle(el);
    return {
      font: cs.fontFamily, style: cs.fontStyle, weight: cs.fontWeight,
      color: cs.color, bg: effBg(el), caps: cs.textTransform, size: cs.fontSize
    };
  };
  const base = leaves.map(snap);

  /* Root variables: every custom property declared on :root / html. */
  const vars = {};
  const sheets = [...document.styleSheets];
  const walk = (rules, cb) => { for (const r of rules) { if (r.cssRules && !r.selectorText) { if (!r.media || matchMedia(r.media.mediaText).matches) walk(r.cssRules, cb); } else cb(r); } };
  sheets.forEach(s => { let rs; try { rs = s.cssRules; } catch (e) { return; } walk(rs, r => {
    if (!r.selectorText || !/(^|,)\s*(:root|html)\s*(,|$)/.test(r.selectorText)) return;
    for (let i = 0; i < r.style.length; i++) {
      const p = r.style[i];
      if (p.startsWith('--')) vars[p] = r.style.getPropertyValue(p).trim();
    }
  }); });

  const root = document.documentElement.style;
  const effects = {};
  let k = 0;
  Object.keys(vars).forEach(v => {
    const val = vars[v];
    const isColor = CSS.supports('color', val) || /^rgba?\(|^#/.test(val);
    const isFont = !isColor && /serif|sans|cursive|script|'|"|,/.test(val) && !/px|rem|%/.test(val);
    if (!isColor && !isFont) return;
    k++;
    const prev = root.getPropertyValue(v);
    const sentinel = isColor ? `rgb(1, 2, ${k})` : `"ZZProbe${k}"`;
    root.setProperty(v, sentinel);
    const hits = [];
    leaves.forEach((el, i) => {
      const now = snap(el);
      const changed = [];
      if (isColor) {
        if (now.color !== base[i].color) changed.push('text');
        if (now.bg !== base[i].bg) changed.push('ground');
      } else if (now.font !== base[i].font) changed.push('font');
      if (changed.length) hits.push([i, changed]);
    });
    if (prev) root.setProperty(v, prev); else root.removeProperty(v);
    effects[v] = { kind: isColor ? 'color' : 'font', value: val, hits };
  });

  /* Author rules that set slant, weight, face or case on each leaf. */
  const styleRules = [];
  sheets.forEach(s => { let rs; try { rs = s.cssRules; } catch (e) { return; } walk(rs, r => {
    if (!r.selectorText || !r.style) return;
    const props = {};
    ['font-style', 'font-weight', 'font-family', 'text-transform', 'font'].forEach(p => {
      const v = r.style.getPropertyValue(p); if (v) props[p] = v;
    });
    if (Object.keys(props).length) styleRules.push({ sel: r.selectorText, props });
  }); });
  const rulesFor = el => styleRules.filter(r => { try { return el.matches(r.sel); } catch (e) { return false; } })
    .filter(r => !/^(\*|html|body)$/.test(r.sel.trim()));

  const out = leaves.map((el, i) => ({
    i, section: sectionOf(el), path: path(el), tag: el.tagName.toLowerCase(),
    text: [...el.childNodes].filter(c => c.nodeType === 3).map(c => c.textContent).join('').replace(/\s+/g, ' ').trim().slice(0, 60),
    inlineStyle: el.getAttribute('style') || '',
    ...base[i],
    rules: rulesFor(el).map(r => ({ sel: r.sel, props: r.props }))
  }));
  return { leaves: out, vars, effects };
})();
