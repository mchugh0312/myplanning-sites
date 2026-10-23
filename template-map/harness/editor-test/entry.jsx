import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { RichEditor } from './editor.jsx';
const PP = { body: { font: 'Georgia', weight: '400', italic: 'italic' },
             title: { font: 'Courier New', weight: '700', italic: 'normal', caps: 'none' },
             attire: { font: 'Impact', weight: '400', italic: 'normal' } };
function Box({ id, initial, ...props }) {
  const [v, setV] = useState(initial);
  window['__val_' + id] = v;
  return <div id={id}><RichEditor value={v} onChange={setV} rows={2} isMobile={false} {...props} /></div>;
}
function App() {
  return <div>
    <Box id="story" initial="We met in Paris and the rest is history" boxStyle={{ body: PP.body }} />
    <Box id="events" initial="The Ceremony<br>4pm<br><em>Cocktail Attire</em>" blockNoun="event" boxStyle={PP} />
    <Box id="rsvp" initial="" placeholder="By May 1, 2027" boxStyle={{ body: PP.body }} />
  </div>;
}
createRoot(document.getElementById('root')).render(<App />);
