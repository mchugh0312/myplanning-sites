import React, { useState, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { ImageSet } from './editor.jsx';
const C = ['#c33','#3a3','#33c','#cc3','#3cc'], L = ['A','B','C','D','E'];
const px = (c, l) => 'data:image/svg+xml;utf8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80"><rect width="80" height="80" fill="' + c + '"/><text x="40" y="52" font-size="36" text-anchor="middle" fill="#fff">' + l + '</text></svg>');
const START = C.map((c, i) => px(c, L[i])); window.__L = Object.fromEntries(START.map((u, i) => [u, L[i]]));
function App() { const [urls, setUrls] = useState(START); const dragRef = useRef(null); window.__urls = urls;
  const onMove = (from, to) => setUrls(prev => { if (to < 0 || to >= prev.length) return prev; const n = prev.slice(); const [m] = n.splice(from, 1); n.splice(to, 0, m); return n; });
  return <div style={{ width: 520, margin: 20 }}><ImageSet title="Gallery" hint="" emptyHint="" urls={urls} onMove={onMove} onRemove={() => {}} onUpload={() => {}} uploading={false} dragRef={dragRef} firstIsHero={true} warn={null} isMobile={false} /></div>; }
createRoot(document.getElementById('root')).render(<App />);
