import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { RichEditor } from './editor.jsx';
function Box() { const [v, setV] = useState('Plain <b>boldword</b> and <i>italicword</i> end'); window.__val = v; window.__setV = setV;
  return <div id="fmt" style={{ width: 520, margin: 12 }}><RichEditor value={v} onChange={setV} rows={3} isMobile={false} /></div>; }
// Like Softr: the editor lives inside a shadow root.
const host = document.getElementById('host');
const shadow = host.attachShadow({ mode: 'open' });
const mount = document.createElement('div'); shadow.appendChild(mount);
createRoot(mount).render(<Box />);
