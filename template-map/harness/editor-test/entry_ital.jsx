import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { RichEditor } from './editor.jsx';
function Box({ id, italic, start }) { const [v, setV] = useState(start); window['__' + id] = v;
  return <div id={id} style={{ width: 560, margin: 12 }}><RichEditor value={v} onChange={setV} rows={3} isMobile={false} boxStyle={italic ? { body: { italic: 'italic' } } : undefined} /></div>; }
const host = document.getElementById('host'); const sh = host.attachShadow({ mode: 'open' }); const m = document.createElement('div'); sh.appendChild(m);
createRoot(m).render(<div><Box id="story" italic={true} start="We met at a coffee shop in 2019.<br>It was a rainy Tuesday." /><Box id="plain" italic={false} start="Plain words here." /></div>);
