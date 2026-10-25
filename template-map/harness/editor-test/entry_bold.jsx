import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { RichEditor } from './editor.jsx';
function Box({ id, w, start }) { const [v, setV] = useState(start || 'Hotel<br>Hyatt Regency<br><br>Flights Info<br>Fly into SAN'); window['__' + id] = v;
  return <div id={id} style={{ width: 560, margin: 12 }}><RichEditor value={v} onChange={setV} rows={5} isMobile={false} titleLine={true} boxStyle={{ title: { weight: w } }} /></div>; }
const host = document.getElementById('host'); const sh = host.attachShadow({ mode: 'open' }); const m = document.createElement('div'); sh.appendChild(m);
createRoot(m).render(<div><Box id="tr" w="400" /><Box id="cc" w="700" /><Box id="pp" w="500" /><Box id="old" w="500" start="<strong>Hotel</strong><br>Hyatt Regency<br><br><strong>Flights</strong><br>Fly into SAN" /></div>);
