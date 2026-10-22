(()=>{const s=document.createElement('style');s.id='mp-probe-still';s.textContent='*,*::before,*::after{transition:none!important;animation:none!important}';document.head.appendChild(s);document.body.offsetHeight;})();
(() => {
  const all = [...document.querySelectorAll('body *')].filter(e => e.getClientRects().length && !e.closest('#mp-lb,#galleryLightbox'));
  const props = ['backgroundColor','borderTopColor','borderBottomColor','borderLeftColor','outlineColor','fill','stroke','color','textDecorationColor','boxShadow','backgroundImage'];
  const snap = () => all.map(e => { const c = getComputedStyle(e); return props.map(p => c[p]).join('|'); });
  const vars = {};
  const walk = (rules, cb) => { for (const r of rules) { if (r.cssRules && !r.selectorText) walk(r.cssRules, cb); else cb(r); } };
  [...document.styleSheets].forEach(s => { let rs; try { rs = s.cssRules; } catch (e) { return; } walk(rs, r => {
    if (!r.selectorText || !/(^|,)\s*(:root|html)\s*(,|$)/.test(r.selectorText)) return;
    for (let i = 0; i < r.style.length; i++) { const p = r.style[i]; if (p.startsWith('--')) vars[p] = r.style.getPropertyValue(p).trim(); }
  }); });
  const base = snap(); const root = document.documentElement.style; const out = {};
  const desc = e => { let s = e.tagName.toLowerCase(); if (e.id) s += '#' + e.id; else if (e.classList.length) s += '.' + [...e.classList].slice(0,2).join('.'); return s; };
  Object.keys(vars).forEach((v, k) => {
    const val = vars[v];
    if (!(CSS.supports('color', val))) return;
    root.setProperty(v, `rgb(3, 4, ${k + 1})`);
    const now = snap(); const hit = {};
    now.forEach((s, i) => { if (s !== base[i]) {
      const a = s.split('|'), b = base[i].split('|');
      props.forEach((p, j) => { if (a[j] !== b[j] && p !== 'color') { (hit[p] = hit[p] || new Set()).add(desc(all[i])); } });
    } });
    root.removeProperty(v);
    out[v] = Object.fromEntries(Object.entries(hit).map(([p, s]) => [p, [...s].slice(0, 6)]));
  });
  /* the colour rule behind each content leaf */
  const colorRules = [];
  [...document.styleSheets].forEach(s => { let rs; try { rs = s.cssRules; } catch (e) { return; } walk(rs, r => {
    if (r.selectorText && r.style && r.style.getPropertyValue('color')) colorRules.push({ sel: r.selectorText, color: r.style.getPropertyValue('color'), media: r.parentRule && r.parentRule.media ? r.parentRule.media.mediaText : '' });
  }); });
  const who = {};
  document.querySelectorAll('body *').forEach(e => {
    const own = [...e.childNodes].filter(c => c.nodeType === 3).map(c => c.textContent).join('').replace(/\s+/g, ' ').trim();
    if (!own || !e.getClientRects().length) return;
    const chain = []; let n = e;
    while (n && n !== document.documentElement) {
      const m = colorRules.filter(r => { try { return n.matches(r.sel) && (!r.media || matchMedia(r.media).matches); } catch (x) { return false; } });
      if (n.style && n.style.color) m.push({ sel: '[inline style]', color: n.style.color });
      if (m.length) { chain.push({ at: desc(n), rules: m.slice(-3) }); break; }
      n = n.parentElement;
    }
    who[own.slice(0, 40)] = { color: getComputedStyle(e).color, from: chain[0] || null };
  });
  return { paint: out, colorSource: who };
})();
