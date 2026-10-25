import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { RichEditor } from './editor.jsx';
function Box({ id, w }) { const [v, setV] = useState('Hotel<br>Hyatt Regency<br><br>Flights Info<br>Fly into SAN'); window['__' + id] = v;
  return <div id={id} style={{ width: 560, margin: 12 }}><RichEditor value={v} onChange={setV} rows={5} isMobile={false} titleLine={true} boxStyle={{ title: { weight: w } }} /></div>; }
const host = document.getElementById('host'); const sh = host.attachShadow({ mode: 'open' }); const m = document.createElement('div'); sh.appendChild(m);
createRoot(m).render(<div><Box id="tr" w="400" /><Box id="cc" w="700" /><Box id="pp" w="500" /></div>);
