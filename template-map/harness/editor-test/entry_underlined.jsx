import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { RichEditor } from './editor.jsx';
const BS = { title: { font: 'Luxurious Script', weight: '400', italic: 'normal', caps: 'none' }, body: { font: 'Lancelot', weight: '400', italic: 'normal' }, attire: { font: 'Luxurious Script', weight: '400', italic: 'normal' } };
const INIT = '<u>The Ceremony<br>Saturday, April 5th, 2026 · 4:00 o\'clock in the Evening<br>Estancia La Jolla Hotel &amp; Spa<br><em>Cocktail Attire</em><br><br>The Reception<br>Saturday, April 5th, 2026 · 7:00 o\'clock in the Evening<br>Estancia La Jolla Hotel &amp; Spa</u>';
function Box() { const [v, setV] = useState(INIT); window.__val = v; window.__log = (window.__log || []).concat([v]);
  return <div id="fmt" style={{ width: 640, margin: 12 }}><RichEditor value={v} onChange={setV} rows={5} isMobile={false} blockNoun="event" boxStyle={BS} /></div>; }
const host = document.getElementById('host'); const shadow = host.attachShadow({ mode: 'open' });
const mount = document.createElement('div'); shadow.appendChild(mount); createRoot(mount).render(<Box />);
