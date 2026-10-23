import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { RichEditor } from './editor.jsx';
function Box() { const [v, setV] = useState('What should I wear?<br>Cocktail attire.<br><br>Is there parking?<br>Yes, on site.'); window.__val = v;
  return <div id="fmt" style={{ width: 560, margin: 12 }}><RichEditor value={v} onChange={setV} rows={6} isMobile={false} blockNoun="question" /></div>; }
const host = document.getElementById('host'); const sh = host.attachShadow({ mode: 'open' }); const m = document.createElement('div'); sh.appendChild(m); createRoot(m).render(<Box />);
