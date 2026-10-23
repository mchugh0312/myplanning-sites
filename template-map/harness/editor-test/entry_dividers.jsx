import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { RichEditor } from './editor.jsx';
const T = { title: { font: 'Georgia', weight: '700', italic: 'normal', caps: 'none' }, body: { font: 'Georgia', weight: '400', italic: 'normal' } };
function Box({ id, initial, ...props }) {
  const [v, setV] = useState(initial); window['__val_' + id] = v;
  return <div id={id} style={{ width: 520, margin: 12 }}><RichEditor value={v} onChange={setV} rows={3} isMobile={false} {...props} /></div>;
}
createRoot(document.getElementById('root')).render(<div>
  <Box id="events" initial="The Ceremony<br>4pm, The Chapel<br><br>The Reception<br>7pm, The Barn" blockNoun="event" boxStyle={T} />
  <Box id="travel" initial="Hotel Nova<br>1 Main St<br><br>Flights<br>Fly into JFK" titleLine={true} boxStyle={T} />
  <Box id="story" initial="We met in Paris.<br>And the rest is history." boxStyle={T} />
</div>);
