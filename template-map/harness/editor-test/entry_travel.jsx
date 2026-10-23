import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { RichEditor } from './editor.jsx';
const LS = { font: 'Georgia', weight: '400', italic: 'normal', caps: 'none' };
function Box() { const [v, setV] = useState('Hotel<br>Hyatt Regency La Jolla<br>3777 La Jolla Village Dr<br><br>Flights<br>The nearest airport is San Diego'); window.__val = v;
  return <div id="fmt" style={{ width: 560, margin: 12 }}><RichEditor value={v} onChange={setV} rows={4} isMobile={false} titleLine={true} labelStyle={LS} boxStyle={{ title: LS, body: { font: 'Georgia', weight: '400', italic: 'normal' } }} /></div>; }
const host = document.getElementById('host'); const sh = host.attachShadow({ mode: 'open' }); const m = document.createElement('div'); sh.appendChild(m); createRoot(m).render(<Box />);
