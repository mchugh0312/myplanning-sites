import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { RichEditor } from './editor.jsx';
const INIT = '<b>Alpha</b> <i>Bravo</i> <span style="font-family: Courier New;">Charlie</span> <u>Delta</u> <b><span style="font-family: Courier New;">Echo</span></b> end';
function Box() { const [v, setV] = useState(INIT); window.__val = v; window.__setV = setV;
  return <div id="fmt" style={{ width: 560, margin: 12 }}><RichEditor value={v} onChange={setV} rows={3} isMobile={false} /></div>; }
const shadow = new URLSearchParams(location.search).get('shadow') === '1';
const mountIn = (el) => { const m = document.createElement('div'); el.appendChild(m); createRoot(m).render(<Box />); };
if (shadow) mountIn(document.getElementById('host').attachShadow({ mode: 'open' })); else mountIn(document.getElementById('host'));
