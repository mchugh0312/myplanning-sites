import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { RichEditor } from './editor.jsx';
function Box({ id, initial, ...props }) {
  const [v, setV] = useState(initial); window['__val_' + id] = v;
  window['__set_' + id] = setV;
  return <div id={id} style={{ width: 520, margin: 12 }}><RichEditor value={v} onChange={setV} rows={3} isMobile={false} {...props} /></div>;
}
createRoot(document.getElementById('root')).render(<div>
  <Box id="fmt" initial="Plain <b>boldword</b> and <i>italicword</i> and <u>underword</u> end" />
  <Box id="gap" initial="Line one<br>Line two<br>Line three" blockNoun="event" />
  <Box id="faq" initial="First question?<br>First answer." blockNoun="question" />
  <Box id="empty" initial="" blockNoun="event" />
</div>);
