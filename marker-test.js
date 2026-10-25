// Lifted-out behavioural test. Pulls the real functions out of site-runtime.js
// and out of a converted template by brace-matching the shipping source, so it
// cannot pass against code that isn't shipping.
const fs = require('fs');

/* jsdom is NOT optional, whatever the try/catch guards below imply.
   Twenty-five gates - every DOM-behaviour one - require it inside a
   try/catch and quietly return {} when it is missing. The suite then runs
   414 gates instead of 439, prints "0 failed", and exits 0. A weakened run
   is indistinguishable from a clean one, which is the one thing a safety
   net must never do. Checked once here, loudly, before anything runs. */
try {
  require('jsdom');
} catch (e) {
  console.error('\nmarker-test: jsdom is not installed.\n' +
    '  Without it 25 DOM gates skip themselves and the suite still reports a\n' +
    '  clean pass. Refusing to run a partial suite.\n\n' +
    '  Fix: npm install jsdom\n');
  process.exit(1);
}

function lift(src, names) {
  let out = '';
  for (const n of names) {
    const i = src.indexOf('function ' + n + '(');
    if (i === -1) throw new Error('not found: ' + n);
    let d = 0;
    for (let k = src.indexOf('{', i); k < src.length; k++) {
      if (src[k] === '{') d++;
      else if (src[k] === '}') { d--; if (!d) { out += src.slice(i, k + 1) + '\n'; break; } }
    }
  }
  return out;
}

const rt = fs.readFileSync('site-runtime.js', 'utf8');
/* _openTags comes too: markBlock calls it to close and reopen formatting
   across the title boundary, and a harness missing it throws rather than
   failing - which reads as a broken suite, not a broken runtime. */
const runtime = new Function(
  lift(rt, ['_openTags', '_wrapsWhole', '_unwrap', 'markBlock', '_markAttire', 'markStructure', 'markTitles']) +
  rt.match(/var STRUCTURED_FIELDS = \[[\s\S]*?\];/)[0] + '\n' +
  rt.match(/var _VOID = \/\^\([^)]*\)\$\/i;/)[0] + '\n' +
  "var _text = function (h) { return String(h||'').replace(/<[^>]*>/g,'').replace(/&nbsp;/gi,' ').trim(); };\n" +
  'return { markStructure: markStructure, markTitles: markTitles };')();

const tplSrc = fs.readFileSync('template-heirloombloom.html', 'utf8');
const tpl = new Function(lift(tplSrc, ['_mpTitle']) + 'return { _mpTitle: _mpTitle };')();

// The shape every converted call site has, expressed once.
function parseCard(part) {
  const nm = tpl._mpTitle(part);
  const title = nm ? nm[1] : '';
  const rest = nm ? part.replace(nm[0], '').replace(/^<br\s*\/?>\s*/i, '') : part;
  /* Attributes allowed: the runtime tags the dress-code line class="mp-attire"
     (MP-337) so a design can style that line and no other italic. */
  const dm = rest.match(/<em(?:\s[^>]*)?>([^<]+)<\/em>\s*$/i);
  const dress = dm ? dm[1] : '';
  const detail = dm ? rest.replace(dm[0], '').replace(/<br\s*\/?>\s*$/i, '').trim() : rest.trim();
  return { title, detail, dress };
}
const blocks = h => h.replace(/<br\s*\/?>\s*<br\s*\/?>/gi, '||S||').split('||S||')
  .map(p => p.trim()).filter(p => p.length > 3);

let pass = 0, fail = 0;
const check = (n, got, want) => {
  if (JSON.stringify(got) === JSON.stringify(want)) pass++;
  else { fail++; console.log('FAIL ' + n + '\n  got  ' + JSON.stringify(got) + '\n  want ' + JSON.stringify(want)); }
};
const mark = runtime.markStructure;

// 1. Old input, runtime not yet deployed. Templates go first, so this matters.
check('legacy input, no runtime',
  parseCard('<strong>The Ceremony</strong><br>4:00 PM<br><em>Black Tie</em>'),
  { title: 'The Ceremony', detail: '4:00 PM', dress: 'Black Tie' });

// 2. Identical result once the runtime marks it. Same pixels either way.
check('same input, marked',
  parseCard(mark('<strong>The Ceremony</strong><br>4:00 PM<br><em>Black Tie</em>')),
  { title: 'The Ceremony', detail: '4:00 PM', dress: 'Black Tie' });

// 3. MP-333 / MP-337: bold on a word inside the card. Used to cut the card
//    there. Now it is just bold.
check('bold mid-detail is only bold',
  parseCard(mark('<strong>Welcome Party</strong><br>Arrive by <strong>6pm</strong> sharp<br><em>Cocktail</em>')),
  { title: 'Welcome Party', detail: 'Arrive by <strong>6pm</strong> sharp', dress: 'Cocktail' });

// 4. Bold on PART of the title line is the couple's own and is kept.
check('partial bold in the title survives',
  parseCard(mark('The <strong>Ceremony</strong><br>4:00 PM')),
  { title: 'The <strong>Ceremony</strong>', detail: '4:00 PM', dress: '' });

// 5. A font on the title survives — nothing peels it any more.
check('font on the title survives',
  parseCard(mark('<span style="font-family:Lancelot">The Ceremony</span><br>4:00 PM')),
  { title: '<span style="font-family:Lancelot">The Ceremony</span>', detail: '4:00 PM', dress: '' });

// 6. Untitled block. Position supplies the title; it used to have none.
check('untitled block gets a title from position',
  parseCard(mark('Welcome Drinks<br>The Rooftop<br><em>Casual</em>')),
  { title: 'Welcome Drinks', detail: 'The Rooftop', dress: 'Casual' });

// 7. The attire line is untouched by the runtime, so the templates' own
//    /<em>…<\/em>\s*$/ still finds it.
check('attire line still parses',
  parseCard(mark('<strong>A</strong><br>x<br><em>Black Tie</em>')).dress, 'Black Tie');

// 8. A wholly italic line is never a title. This is what keeps Golden Hour's
//    invitation line and Modern Minimal's standalone dress-code block working:
//    a marker's closing tag after the </em> would break the $ anchor.
check('wholly italic standalone block untouched',
  mark('<em>Dress Code Suggestion: Cocktail Attire</em>'),
  '<em>Dress Code Suggestion: Cocktail Attire</em>');
check('…and still matches the templates\' dress regex',
  /<em>([^<]+)<\/em>\s*$/i.test(mark('<em>Dress Code Suggestion: Cocktail Attire</em>')), true);
check('Golden Hour invitation line untouched',
  mark('<em>Alice and Conrad <i>lovingly invite</i> you to <i>celebrate</i>.</em>'),
  '<em>Alice and Conrad <i>lovingly invite</i> you to <i>celebrate</i>.</em>');

// 9. Two blank-line-separated blocks stay two cards.
check('two blocks -> two cards', blocks(mark(
  '<strong>Ceremony</strong><br>4:00<br><em>Black Tie</em><br><br><strong>Reception</strong><br>6:00<br><em>Cocktail</em>'
)).map(parseCard), [
  { title: 'Ceremony', detail: '4:00', dress: 'Black Tie' },
  { title: 'Reception', detail: '6:00', dress: 'Cocktail' },
]);

// 10. Agreed: no blank line means one card, and the later bolds stay bold.
{
  const m = mark('<strong>Hotel A</strong><br>1 St<br><strong>Hotel B</strong><br>2 St');
  check('no blank line -> one card', blocks(m).length, 1);
  check('…later bold kept verbatim', parseCard(m),
    { title: 'Hotel A', detail: '1 St<br><strong>Hotel B</strong><br>2 St', dress: '' });
}

// 11. accommodation_info / travel_info are not marked at all, so the {3,} split
//     and the unanchored <strong>/<em> parsers in Regal Boho, Sage & Still,
//     Vintage and Whimsical are unaffected.
{
  const accom = '<strong>Hyatt Regency</strong><br>3777 Village Dr<br><em>Ask for the room block</em>';
  const d = { weddings_info: '<strong>Ceremony</strong><br>4:00',
              accommodation_info: accom, travel_info: accom, faqs: accom };
  runtime.markTitles(d);
  check('accommodation_info untouched', d.accommodation_info, accom);
  check('travel_info untouched', d.travel_info, accom);
  check('faqs untouched', d.faqs, accom);
  check('weddings_info marked', d.weddings_info, '<mp-title>Ceremony</mp-title><br>4:00');
}

// 12. Idempotent: a payload hydrated twice must not nest markers.
{
  const once = mark('<strong>A</strong><br>x<br><em>Casual</em>');
  check('marking is idempotent', mark(once), once);
}


// ── MP-332: fonts the couple applied to content ────────────────────────────
{
  const F = new Function(
    lift(rt, ['_knownContentFont', 'collectContentFonts']) +
    rt.match(/var CONTENT_FONTS = \[[\s\S]*?\];/)[0] + '\n' +
    'var _contentFontIndex = null;\n' +
    'return { collect: collectContentFonts };')();

  check('picks up a font from an inline span', F.collect({
    weddings_info: '<span style="font-family:\'Pinyon Script\'">Cocktail Attire</span>' }),
    ['Pinyon Script']);

  check('canonicalises the spelling css2 needs', F.collect({
    story: '<span style="font-family: playfair display, serif">x</span>' }),
    ['Playfair Display']);

  check('scans every string field and de-duplicates', F.collect({
    weddings_info: '<span style="font-family:Lora">a</span><span style="font-family:Lora">b</span>',
    faqs: '<span style="font-family:Great Vibes">c</span>',
    couple_names: 'Alice & Conrad', events: [1, 2] }),
    ['Lora', 'Great Vibes']);

  // The whole reason for the allow-list: one unknown name would 400 the css2
  // request and take every other family in it down too.
  check('drops a family that is not in the picker', F.collect({
    story: '<span style="font-family:Comic Sans MS">x</span>' }), []);
  check('drops generic families', F.collect({
    story: '<span style="font-family:serif">x</span><p style="font-family:inherit">y</p>' }), []);
  check('no fonts, no request', F.collect({ story: 'plain text' }), []);
}

// ── Pressed Petals: body rendered as written ───────────────────────────────
// The card is title + body and nothing else. parseCard above still describes
// the other nine templates, which have not been converted yet; delete it when
// they have.
{
  const ppSrc = fs.readFileSync('template-pressedpetals.html', 'utf8');

  // Guards the change itself, not a copy of it. Both text-field call sites are
  // gone; the two that remain are the d.events fallback, which keeps its own
  // dress_code column and its own styled slot.
  check('no dress extraction left in the text-field path',
    (ppSrc.match(/dressMatch/g) || []).length, 0);
  check('d.events fallback keeps its dress slot',
    (ppSrc.match(/ev\.dress_code \?/g) || []).length, 2);

  // The shape both Pressed Petals call sites now have.
  const ppCard = (part) => {
    const nm = tpl._mpTitle(part);
    return {
      title: nm ? nm[1] : '',
      detail: (nm ? part.replace(nm[0], '').replace(/^<br\s*\/?>\s*/i, '') : part).trim(),
    };
  };

  // MP-332. A font on the attire line used to stop it matching /<em>([^<]+)…/,
  // so it was dropped from the dress slot and re-rendered in the body face.
  check('font on the attire line reaches the card intact',
    ppCard(mark('<strong>The Ceremony</strong><br>4:00 PM<br><em class=\"mp-attire\"><span style="font-family:\'Pinyon Script\'">Cocktail Attire</span></em>')),
    { title: 'The Ceremony',
      detail: '4:00 PM<br><em class=\"mp-attire\"><span style="font-family:\'Pinyon Script\'">Cocktail Attire</span></em>' });

  // MP-337. [^<] could not cross the <u>, and the trailing </strong> broke the
  // $ anchor. Neither matters when nothing is being matched.
  check('bold-and-italic attire line reaches the card intact',
    ppCard(mark('<strong>The Ceremony</strong><br>4:00 PM<br><strong><em><u>Black Tie</u></em></strong>')),
    { title: 'The Ceremony',
      detail: '4:00 PM<br><strong><em><u>Black Tie</u></em></strong>' });

  // A plain italic line is now just an italic line — no longer lifted out.
  check('plain italic attire line stays in the body',
    ppCard(mark('<strong>The Ceremony</strong><br>4:00 PM<br><em class=\"mp-attire\">Cocktail Attire</em>')),
    { title: 'The Ceremony', detail: '4:00 PM<br><em class=\"mp-attire\">Cocktail Attire</em>' });

  // A link mid-line used to be safe only by luck. It is content now.
  check('a link survives into the body',
    ppCard(mark('<strong>The Ceremony</strong><br>4:00 in the <a href="https://x.test">Evening</a>')).detail,
    '4:00 in the <a href="https://x.test">Evening</a>');

  // Still true, and the reason the couple can style the title at all.
  check('font on the title still survives',
    ppCard(mark('<span style="font-family:Lancelot">The Ceremony</span><br>4:00 PM')),
    { title: '<span style="font-family:Lancelot">The Ceremony</span>', detail: '4:00 PM' });

  // The blank line is still the only separator.
  check('blank line still starts a card', blocks(mark(
    '<strong>Ceremony</strong><br>4:00<br><em class=\"mp-attire\">Black Tie</em><br><br><strong>Reception</strong><br>6:00'
  )).map(ppCard), [
    { title: 'Ceremony', detail: '4:00<br><em class=\"mp-attire\">Black Tie</em>' },
    { title: 'Reception', detail: '6:00' },
  ]);
  // The spacer the editor inserts. It exists because a blank line would start a
  // new card, so the one thing it must never do is start a new card.
  const GAP = '<span class="mp-gap" style="display:block;height:12px"></span>';
  check('a spacer does not split a card', blocks(mark(
    '<strong>The Ceremony</strong><br>4:00 PM' + GAP + '<em>Cocktail Attire</em>'
  )).length, 1);
  check('a spacer reaches the card body',
    ppCard(mark('<strong>The Ceremony</strong><br>4:00 PM' + GAP + '<em>Cocktail Attire</em>')),
    { title: 'The Ceremony', detail: '4:00 PM' + GAP + '<em>Cocktail Attire</em>' });
  check('two spacers still one card', blocks(mark(
    '<strong>The Ceremony</strong><br>4:00 PM' + GAP + GAP + '<em>Cocktail Attire</em>'
  )).length, 1);

  // The couple still gets a second card the ordinary way.
  check('a blank line beside a spacer still splits', blocks(mark(
    '<strong>Ceremony</strong><br>4:00' + GAP + '<em>Black Tie</em><br><br><strong>Reception</strong><br>6:00'
  )).length, 2);
}

// ── Editor title marks (Website.txt) ──────────────────────────────────────
// Lifted out of the block, not reimplemented. The marks are painted into the
// box's DOM, so the property that matters is that they cannot reach the record.
{
  const wsSrc = fs.readFileSync('Website.txt', 'utf8');
  const grab = (name) => {
    const i = wsSrc.indexOf('const ' + name + ' = ');
    if (i === -1) throw new Error('not found: ' + name);
    // Scan to the semicolon that ends the declaration, ignoring any nested in
    // braces, parens or a regex/string. Cheap, and it cannot silently truncate.
    let depth = 0;
    for (let k = i; k < wsSrc.length; k++) {
      const c = wsSrc[k];
      if (c === '{' || c === '(' || c === '[') depth++;
      else if (c === '}' || c === ')' || c === ']') depth--;
      else if (c === ';' && depth === 0) return wsSrc.slice(i, k + 1);
    }
    throw new Error('unterminated: ' + name);
  };
  // blockNoun is the guard: only the sections that parse a title out of the
  // copy mark one. These existing checks are all block-parsing sections, so
  // the harness supplies one; the no-blockNoun case is checked below.
  const mk = (noun, titleLine) => new Function('var headingFont = "Pinyon Script";\n' +
    'var blockNoun = ' + JSON.stringify(noun) + ';\n' +
    'var titleLine = ' + JSON.stringify(!!titleLine) + ';\n' +
    // The runtime reports how the design styles a block label; the harness has
    // no live page, so the heading face is the fallback path here.
    'var labelStyle = null;\n' +
    'var titleStyle = null;\n' +
    // The box's own measured styles (MP-337); none in the harness, so the
    // reported-style fallback path is the one exercised, as before.
    'var boxStyle = null;\n' +
    grab('_stripTitleMarks') + '\n' + grab('_markAttireLine') + '\n' + grab('_markTitles') +
    '\nreturn { mark: _markTitles, strip: _stripTitleMarks };')();
  const ed = mk('event');

  const T = '<strong>The Ceremony</strong><br>4:00 PM<br><em>Cocktail Attire</em>' +
            '<br><br><strong>The Reception</strong><br>7:00 PM';

  // The face rides on the tag, because a stylesheet has to reach the box's root
  // to do anything and that turned out not to be a safe assumption.
  /* The tag may now carry data-whole-bold before its style, so the test is no
     longer anchored to style coming first - only that the opening tag carries
     the face. */
  check('the mark carries the heading face',
    /^<mp-t[^>]*style="[^"]*Pinyon Script/.test(ed.mark(T)), true);
  check('marks the first line of every block',
    (ed.mark(T).match(/<mp-t\b/g) || []).length, 2);
  check('marks nothing else',
    ed.mark(T).indexOf('<mp-t') < ed.mark(T).indexOf('4:00 PM'), true);

  // A section the template does NOT parse titles from must not be marked. The
  // registry copy was showing in Luxurious Script in the box while the site
  // rendered it in Lancelot - the editor promising a title nothing makes.
  const plain = mk(undefined, false);
  check('a section with no blockNoun is left unmarked',
    plain.mark('Thank you').indexOf('<mp-t'), -1);
  check('and its text is returned intact',
    plain.mark('Thank you'), 'Thank you');

  // Accommodations and Travel have a single block, so no blockNoun and no
  // "+ Event" button - but their template DOES turn the first line into the
  // heading, so the box must show it in the heading face rather than as bold
  // body text. That is what titleLine is for.
  const oneBlock = mk(undefined, true);
  check('a titleLine section marks its first line',
    oneBlock.mark('<strong>Hotel</strong><br>Hyatt Regency').indexOf('<mp-t') !== -1, true);

  // The whole point of the custom tag. A class on a span could not be unwrapped
  // by regex without stopping at this inner </span>.
  const F = '<span style="font-family:\'Pinyon Script\'">The Ceremony</span><br>4:00 PM';
  check('a font span inside the title round-trips', ed.strip(ed.mark(F)), F);

  check('round-trip is identity', ed.strip(ed.mark(T)), T);
  check('marking is idempotent', ed.mark(ed.mark(T)), ed.mark(T));
  check('an empty first line is not marked',
    ed.mark('<br>4:00 PM'), '<br>4:00 PM');
  check('a spacer-only block is not given a title',
    ed.strip(ed.mark('<span class="mp-gap" style="display:block;height:12px"></span>')),
    '<span class="mp-gap" style="display:block;height:12px"></span>');
  check('nothing survives the strip', /mp-t/.test(ed.strip(ed.mark(T))), false);

  // The marks live in the box's DOM, so the ONLY thing keeping them out of the
  // record is that every call hands its html to _clean first. Five callers did
  // not, which put marks in the record and bounced them back as the value the
  // box syncs against - that is what re-marked one title while the couple was
  // styling another. Asserted on the source, because a sixth caller added later
  // would be silent.
  const rteStart = wsSrc.indexOf('function RichEditor(');
  const rteEnd = wsSrc.indexOf('export default function Block(');
  if (rteStart === -1 || rteEnd === -1 || rteEnd < rteStart) throw new Error('RichEditor not found');
  const rte = wsSrc.slice(rteStart, rteEnd);
  const calls = rte.match(/onChange\(/g) || [];
  const cleaned = rte.match(/onChange\(_clean\(/g) || [];
  check('every onChange call in RichEditor goes through _clean',
    calls.length - cleaned.length, 0);
  check('...and there are some to check', calls.length > 5, true);
}

// ── MP-504: Website photographs vs Gallery photographs ────────────────────
// Two different sets. Site sections take the Website set; the gallery is only
// ever the gallery. Every template borrowed gallery photos for some section,
// which is how a picture added to a gallery turned up somewhere the couple
// never put it. Asserted on the source of all ten, because the leak was a
// different shape in each one and a new template would copy whichever it was
// pasted from.
{
  const tpls = fs.readdirSync('.').filter(f => /^template-.*\.html$/.test(f));
  check('all ten templates present', tpls.length, 10);

  for (const t of tpls) {
    const src = fs.readFileSync(t, 'utf8');
    const name = t.replace('template-', '').replace('.html', '');

    // Every remaining mention must be the gallery itself, the nav entry that
    // hides an empty gallery, the sample payload, or a comment.
    const stray = src.split('\n')
      .map((l, i) => [i + 1, l])
      .filter(([, l]) => l.indexOf('gallery_images') !== -1)
      .filter(([, l]) => !/hasImages|_galleryUrls|menu\.gallery|gallery_images:\s*\[\]|^\s*\/\//.test(l));
    check(name + ': no site section reads gallery_images', stray.map(x => x[0]), []);
  }

  // The nine that place a photograph in a section must read the Website set.
  // Regal Boho and Sage & Still are single-photo designs with one hero and
  // nothing else to fill, so they have nothing to read.
  const usesSet = tpls.filter(t => fs.readFileSync(t, 'utf8').indexOf('hero_images') !== -1)
    .map(t => t.replace('template-', '').replace('.html', '')).sort();
  check('templates drawing on the Website set', usesSet, [
    'blacktietimeless', 'coastalchic', 'goldenhour', 'heirloombloom',
    'modernminimal', 'pressedpetals', 'vintagelovestory', 'whimsicalromance',
  ]);
}

// ── Which templates are on the pass-through contract ──────────────────────
// The attire regex is what MP-332 and MP-337 both broke on. A converted
// template has none in its weddings/events path. The travel and accommodation
// parsers keep theirs: those fields are not marked and are a separate decision.
{
  const CONVERTED = ['blacktietimeless', 'coastalchic', 'goldenhour',
                     'heirloombloom', 'modernminimal', 'pressedpetals',
                     'regalboho', 'sageandstill', 'vintagelovestory',
                     'whimsicalromance'];
  const tpls = fs.readdirSync('.').filter(f => /^template-.*\.html$/.test(f));

  for (const t of tpls) {
    const name = t.replace('template-', '').replace('.html', '');
    if (CONVERTED.indexOf(name) === -1) continue;
    const src = fs.readFileSync(t, 'utf8');
    const dress = src.split('\n')
      .map((l, i) => [i + 1, l])
      .filter(([, l]) => /dressMatch|dressCode|_dm1/.test(l))
      .map(([i]) => i);
    check(name + ': no dress extraction left', dress, []);
  }

  // Every template's hydrate block still parses. A pass-through edit that left
  // a variable behind would be a runtime error on a live site, not a test
  // failure, so this is the only thing standing between an edit and a couple.
  for (const t of tpls) {
    const s = fs.readFileSync(t, 'utf8');
    const end = s.lastIndexOf('</script>');
    const start = s.lastIndexOf('<script>', end);
    let ok = true;
    try { new Function(s.slice(start + 8, end)); } catch (e) { ok = e.message; }
    check(t.replace('template-', '').replace('.html', '') + ': hydrate block parses', ok, true);
  }
}

// ── Section headings: blank, and put back ─────────────────────────────────
// MP: clearing a section heading in the Content tab refilled itself with the
// template's own wording, because "" meant both "no override" and "no
// heading". It is three states now, and the two that touch the page are
// checked here against every template's real markup.
//
// The un-blank half is the one that bites. An earlier version walked back up
// from the heading clearing display:none as it went, which also revealed any
// ancestor the template had deliberately hidden - and templates ship their
// sections hidden and let hydrate show them. So this asserts the section's own
// display is untouched, not merely that the heading came back.
{
  const src = fs.readFileSync('site-runtime.js', 'utf8');
  const lift = (sig) => {
    const i = src.indexOf(sig);
    if (i === -1) throw new Error('not found in site-runtime.js: ' + sig);
    let d = 0;
    for (let k = src.indexOf('{', i); k < src.length; k++) {
      if (src[k] === '{') d++;
      else if (src[k] === '}') { d--; if (!d) return src.slice(i, k + 1); }
    }
  };

  let JSDOM;
  try { ({ JSDOM } = require('jsdom')); } catch (e) { JSDOM = null; }

  if (!JSDOM) {
    check('section-heading blank/restore (jsdom not installed - SKIPPED)', true, true);
  } else {
    const ANCHORS = {
      story: ['our-story', 'story'],
      travel: ['travel-section', 'travel', 'travel-standalone'],
      faqs: ['need-to-know', 'ntk', 'faq-section'],
      registry: ['registry-section', 'registry', 'registry-wrap'],
      rsvp: ['rsvp'],
      gallery: ['gallery'],
    };
    const body = 'var _blankedNodes={};\n' + lift('function _headingNode(') + '\n' +
      lift('function _blankHeading(') + '\n' + lift('function _unblankHeading(') +
      '\nreturn {_headingNode:_headingNode,_blankHeading:_blankHeading,_unblankHeading:_unblankHeading};';

    const tpls = fs.readdirSync('.').filter(f => /^template-.*\.html$/.test(f)).sort();
    const bad = [];
    for (const t of tpls) {
      const doc = new JSDOM(fs.readFileSync(t, 'utf8')).window.document;
      const fn = new Function('document', 'SECTION_ANCHORS', body)(doc, ANCHORS);
      for (const key of Object.keys(ANCHORS)) {
        let sec = null;
        for (const id of ANCHORS[key]) { const e = doc.getElementById(id); if (e) { sec = e; break; } }
        if (!sec) continue;
        const node = fn._headingNode(sec);
        if (!node) continue;
        const secDisplayBefore = sec.style.display;

        fn._blankHeading(key);
        let hidden = false;
        for (let el = node; el && el !== sec && el.style; el = el.parentNode) {
          if (el.style.display === 'none') { hidden = true; break; }
        }
        if (!hidden) bad.push(t + '/' + key + ': not hidden');
        if (sec.style.display !== secDisplayBefore) bad.push(t + '/' + key + ': section display changed on blank');

        fn._unblankHeading(key);
        for (let el = node; el && el !== sec && el.style; el = el.parentNode) {
          if (el.style.display === 'none') { bad.push(t + '/' + key + ': still hidden after restore'); break; }
        }
        if (sec.style.display !== secDisplayBefore) bad.push(t + '/' + key + ': section display changed on restore');
      }
    }
    check('every section heading blanks and comes back cleanly', bad, []);
  }
}

// The three states must stay three. A payload that omits a key means "use the
// design's wording"; an explicit null means "no heading". Collapsing these is
// the bug this whole path exists to prevent.
{
  const src = fs.readFileSync('site-runtime.js', 'utf8');
  check('applySectionHeadings distinguishes absent from null',
    /hasOwnProperty\.call\(map, key\)/.test(src) && /val === null/.test(src), true);
  const block = fs.readFileSync('Website.txt', 'utf8');
  // Was "stored as null". It is "" now — see the record-shape checks below for
  // why nothing written to the record may be a non-string.
  check('the editor stores a deliberate blank as an empty string',
    /_headingBlank/.test(block) && /next\[sectionKey\] = ""/.test(block), true);
  check('reset drops the override rather than storing a blank',
    /_clearHeadingOverride/.test(block), true);
}

// ── Colour controls reach the whole design (MP-357) ───────────────────────
// Two faults, both checked here.
//
// 1. A palette tone hard-coded as a literal hex somewhere in the CSS does not
//    move when the couple changes that colour. Heirloom Bloom used var(--berry)
//    8 times and the literal #673d45 in 10 more, which is exactly why changing
//    the burgundy left burgundy on the page.
// 2. SAMPLE_DATA.customization is an override like any other, so a non-empty
//    value there paints over the template's own palette before the couple has
//    touched anything. Nine of ten shipped values with primary and accent the
//    wrong way round, which is what made the controls look mislabelled.
{
  const VARS = {
    pressedpetals: ['--offwhite', '--olive', '--text'],
    heirloombloom: ['--offwhite', '--berry', '--text'],
    blacktietimeless: ['--offwhite', '--black', '--text'],
    goldenhour: ['--white', '--blue', '--dark'],
    sageandstill: ['--offwhite', '--green-gray', '--text'],
    modernminimal: ['--ivory', '--blue', '--text'],
    whimsicalromance: ['--ivory', '--rose', '--burgundy'],
    coastalchic: ['--ivory', '--navy', '--text'],
    vintagelovestory: ['--ivory', '--brown', '--text'],
    regalboho: ['--ivory', '--beige', '--text'],
  };
  const strays = [];
  const dirtySamples = [];
  for (const [name, vars] of Object.entries(VARS)) {
    const f = 'template-' + name + '.html';
    const src = fs.readFileSync(f, 'utf8');
    const root = (src.match(/:root\s*\{[\s\S]*?\}/) || [''])[0];
    const rootStart = src.indexOf(root), rootEnd = rootStart + root.length;
    const scriptEnd = src.lastIndexOf('</script>');
    const scriptStart = src.lastIndexOf('<script>', scriptEnd);

    for (const v of vars) {
      const m = root.match(new RegExp(v.replace(/-/g, '\\-') + '\\s*:\\s*(#[0-9a-fA-F]{6})', 'i'));
      if (!m) continue;
      const hex = m[1].toLowerCase();
      const re = new RegExp(hex, 'gi');
      let hit;
      while ((hit = re.exec(src)) !== null) {
        const at = hit.index;
        if (at >= rootStart && at < rootEnd) continue;      // the definition
        if (at >= scriptStart && at < scriptEnd) continue;  // script, not CSS
        const before = src.slice(Math.max(0, at - 90), at);
        if (/<meta[^>]*$/i.test(before)) continue;          // theme-color literal
        strays.push(name + ': ' + hex + ' hard-coded (should be var(' + v + '))');
      }
    }
    const cust = (src.match(/customization:\{[^}]*\}/) || [''])[0];
    if (cust && !/primary_color:\s*''\s*,\s*accent_color:\s*''\s*,\s*text_color:\s*''/.test(cust)) {
      dirtySamples.push(name);
    }
  }
  check('no palette tone hard-coded past its variable', [...new Set(strays)], []);
  check('no template overrides its own palette in SAMPLE_DATA', dirtySamples, []);
}

// The gallery lightbox is the runtime's, in every template, unconditionally.
//
// Deferring to the template's own openLightbox() is what kept this broken:
// Golden Hour has none; coastalchic, modernminimal and pressedpetals throw
// ReferenceError because the _galleryUrls they read is declared inside
// hydrateTemplate while the function sits at the top level; and any template
// can return early and silently, which no caller out here can detect. So
// _openPhoto must not consult them at all - if this assertion ever fails
// because someone reinstated the fallback, clicking a photograph will go back
// to doing nothing on a quarter of the templates.
{
  const rt = fs.readFileSync('site-runtime.js', 'utf8');
  const i = rt.indexOf('function _openPhoto(');
  const body = i === -1 ? '' : rt.slice(i, rt.indexOf('function applyCustomColors('));
  check('_openPhoto exists', i !== -1, true);
  check('_openPhoto does not defer to a template lightbox',
    /window\.open(Gallery)?Lightbox/.test(body), false);
  check('_openPhoto opens the runtime lightbox', /_ensureLightbox\(\)/.test(body), true);
  check('the lightbox shows photographs uncropped',
    /#mp-lb img\{[^}]*object-fit:contain/.test(rt), true);
  // A magnifying-glass cursor sitting on the couple's photograph reads as page
  // furniture. Pointer says the same thing and draws nothing.
  check('no zoom-in cursor on gallery images',
    /\.mp-gal-frame img\{[^}]*cursor:zoom-in/.test(rt), false);
}

// ── Two text tones, and they must stay independent ────────────────────────
{
  const rt = fs.readFileSync('site-runtime.js', 'utf8');
  const block = fs.readFileSync('Website.txt', 'utf8');
  /* EVALUATED, not scraped. The table was read with a regex that only matched
     role: '--var', so the moment a slot named an ARRAY of aliases that role
     vanished from this view and the template looked as though it had lost a
     colour. Running the declaration gives whatever shape it actually holds. */
  const varsSrc = (rt.match(/var TEMPLATE_COLOR_VARS = \{[\s\S]*?\n  \};/) || [''])[0];
  const roles = new Function(varsSrc + '\nreturn TEMPLATE_COLOR_VARS;')();
  const names = Object.keys(roles);
  check('all ten templates have the six required colour roles',
    names.length === 10 && names.every(n => roles[n].bg && roles[n].accent && roles[n].accent2 &&
      roles[n].ink && roles[n].ink2 && roles[n].ink3), true);
  /* accent3 is optional: it exists wherever a design paints with a third fill
     that no other slider reaches. Derived from the CSS rather than listed
     here - the list said four, and fixing two templates whose colours were
     beyond every slider made it six. A hardcoded count turns a correct fix
     into a failing gate and invites someone to delete the control instead. */
  const needsThird = names.filter(n => {
    const src = fs.readFileSync('template-' + n + '.html', 'utf8');
    const css = [...src.matchAll(/<style>([\s\S]*?)<\/style>/g)].map(m => m[1]).join('\n');
    const painted = new Set([...css.matchAll(/background(?:-color)?\s*:\s*[^;]*var\((--[\w-]+)\)/g)]
      .map(m => m[1]));
    const core = new Set([roles[n].bg, roles[n].accent, roles[n].accent2]);
    return [...painted].some(v => !core.has(v) && v !== roles[n].ink &&
      v !== roles[n].ink2 && v !== roles[n].ink3);
  });
  check('the third fill exists on exactly the templates that paint with one',
    names.filter(n => roles[n].accent3).sort(), needsThird.sort());

  // ink2 must never be the same variable as bg. That was the state in six
  // templates and it is why the text on a coloured panel could not be changed
  // without repainting the page underneath it.
  const collide = names.filter(n => roles[n].ink2 === roles[n].bg || roles[n].ink === roles[n].bg);
  check('no text role shares a variable with the page background', collide, []);

  // Every role variable must actually exist in that template's :root, or the
  // control writes to a name nothing reads.
  const missing = [];
  for (const n of names) {
    const src = fs.readFileSync('template-' + n + '.html', 'utf8');
    const root = (src.match(/:root\s*\{[\s\S]*?\}/) || [''])[0];
    for (const role of ['bg', 'accent', 'accent2', 'accent3', 'ink', 'ink2', 'ink3']) {
      if (!roles[n][role]) continue;   // accent3 is optional
      /* A slot may name one variable or SEVERAL - whimsicalromance's ink drives
         --ink and --text, which are two aliases of one colour. Every one of
         them still has to be declared. */
      for (const v of [].concat(roles[n][role])) {
        if (!new RegExp(v.replace(/-/g, '\\-') + '\\s*:').test(root)) missing.push(n + '.' + role + ' ' + v);
      }
    }
  }
  check('every colour role names a variable the template declares', missing, []);

  // The ink variable has to carry the bulk of the body copy, or the control
  // moves a handful of declarations and looks broken - which is what MP-357
  // reported. Coastal Chic was 1 of 15 before this.
  const thin = [];
  for (const n of names) {
    const src = fs.readFileSync('template-' + n + '.html', 'utf8');
    const uses = v => (src.match(new RegExp('(^|[;{\\s])color\\s*:\\s*var\\(' + v.replace(/-/g, '\\-') + '\\)', 'g')) || []).length;
    /* Summed across the slot's variables: splitting one colour into two
       aliases must not make the control look thin when between them they still
       carry the body copy. */
    const inkVars = [].concat(roles[n].ink);
    const total = inkVars.reduce((a, v) => a + uses(v), 0);
    if (total < 5) thin.push(n + ': ink ' + inkVars.join('+') + ' sets only ' + total + ' declarations');
  }
  check('the body-text role carries the body copy', thin, []);

  // Both text roles must be text-ONLY variables. While they shared a variable
  // with panels and borders, changing the text colour repainted the design -
  // Whimsical Romance's --burgundy set 25 text declarations AND 14 panels, so
  // "change the text" meant "repaint the site". --ink and --on-dark exist to
  // be used in `color:` and nowhere else.
  // A text role must not fill a PANEL. Hairlines are a different matter: a
  // button outline, an input border, a hamburger bar and an SVG glyph are drawn
  // in the body-text tone in these designs and should follow it, so `border`,
  // `outline` and `fill` are allowed. `background` is not - that is how
  // Whimsical Romance's --burgundy came to repaint 14 panels when the text
  // colour changed, which is the bug this whole role split exists to prevent.
  // Walk actual CSS rules rather than matching loose strings, so the test can
  // tell a section band from a 1.5px hamburger bar. A rule is type-scale
  // furniture - allowed - if it constrains itself to a few pixels or sits in a
  // pill/tag. Anything else filling itself with a text tone is a panel.
  const painted = [];
  for (const n of names) {
    const src = fs.readFileSync('template-' + n + '.html', 'utf8');
    for (const rule of src.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
      const sel = rule[1].trim().split('\n').pop().trim();
      const body = rule[2];
      if (!/background[^;:]*:[^;]*var\(/.test(body)) continue;
      const small = /(height|width|max-height)\s*:\s*[0-3](\.\d+)?px/.test(body) ||
                    /border-radius\s*:\s*999px/.test(body) ||
                    /hamburger|-tag\b|-dot\b|-rule\b|divider/.test(sel);
      if (small) continue;
      for (const role of ['ink', 'ink2', 'ink3']) {
        // A slot may name several aliases; every one of them is a text colour
        // and none of them may fill a panel.
        for (const v of [].concat(roles[n][role])) {
          if (new RegExp('background[^;:]*:[^;]*var\\(' + v.replace(/-/g, '\\-') + '\\)').test(body)) {
            painted.push(n + ': ' + role + ' ' + v + ' fills ' + sel.slice(0, 40));
          }
        }
      }
    }
  }
  check('text roles never fill a panel', painted, []);

  // The other side of the same rule: bg and accent must not set TEXT. One
  // stray declaration means changing the page background or the main colour
  // also moves a word somewhere, which is the complaint MP-357 opened with.
  // Modern Minimal had a button hover in var(--ivory), Sage & Still an RSVP
  // remove-link in var(--green-gray), Whimsical an event title in var(--rose).
  //
  // accent2 is deliberately NOT held to this. It is a single design tone that
  // both fills and letters - Heirloom Bloom's mustard paints the registry panel
  // AND draws the couple's initials in the hero, and a couple changing that
  // colour means both. Splitting them would give two controls for one tone and
  // let the initials drift away from the panel they were designed to match.
  // Hero display type is exempt, for the same reason accent2 is: a design can
  // letter its centrepiece in the tone it fills with, and a couple changing
  // that colour means both. Sage & Still's couple names are --sage, the tone of
  // the Weekend band; Heirloom Bloom's initials are its --gold. Everything else
  // must not letter in a fill tone.
  const strayText = [];
  for (const n of names) {
    const src = fs.readFileSync('template-' + n + '.html', 'utf8');
    for (const role of ['bg', 'accent']) {
      const v = roles[n][role];
      const hits = [];
      let sel = '';
      for (const line of src.split('\n')) {
        const m = line.match(/^\s*([.#][^{]*)\{/);
        if (m) sel = m[1].trim();
        if (new RegExp('(^|[;{\\s])color\\s*:\\s*var\\(' + v.replace(/-/g, '\\-') + '\\)').test(line)) {
          if (/hero|initial|couple|-name/i.test(sel)) continue;   // display type
          hits.push(sel);
        }
      }
      if (hits.length) strayText.push(n + ': ' + role + ' ' + v + ' sets text on ' + hits.join(', '));
    }
  }
  check('background and accent letter nothing but hero display type', strayText, []);

  /* Same three names everywhere, so nothing downstream special-cases a design -
     with the one allowance that a slot may carry EXTRA aliases beside the
     canonical name. whimsicalromance paints <body> with --text and the rest
     with --ink, two names for one colour, and the slot drives both; what it may
     not do is use a different name instead. */
  const canon = { ink: '--ink', ink2: '--on-dark', ink3: '--ink3' };
  const odd = names.filter(n => Object.keys(canon)
    .some(r => [].concat(roles[n][r]).indexOf(canon[r]) === -1));
  check('every template uses the same three text variables', odd, []);

  // The picker opens on these, so a drift between the two files shows the
  // couple one colour and moves another. They live in different files.
  const drift = [];
  for (const n of names) {
    const root = (fs.readFileSync('template-' + n + '.html', 'utf8').match(/:root\s*\{[\s\S]*?\}/) || [''])[0];
    // The first alias of a slot is its canonical variable; that is the one the
    // picker swatch has to match.
    const hex = v => ((root.match(new RegExp([].concat(v)[0].replace(/-/g, '\\-') + '\\s*:\\s*(#[0-9a-fA-F]{6})', 'i')) || [])[1] || '').toLowerCase();
    const id = (block.match(new RegExp('"([0-9a-f-]{36})":[^\\n]*//\\s*' + {
      pressedpetals: 'Pressed Petals', heirloombloom: 'Heirloom Bloom',
      blacktietimeless: 'Black Tie Timeless', goldenhour: 'Golden Hour',
      sageandstill: 'Sage & Still', modernminimal: 'Modern Minimal',
      whimsicalromance: 'Whimsical Romance', coastalchic: 'Coastal Chic',
      vintagelovestory: 'Vintage Love Story', regalboho: 'Regal Boho',
    }[n].replace('&', '&'))) || [])[1];
    if (!id) { drift.push(n + ': no palette row'); continue; }
    const row = (block.match(new RegExp('"' + id + '":\\s*\\{([^}]*)\\}')) || [])[1] || '';
    const g = k => ((row.match(new RegExp(k + ':\\s*"(#[0-9a-fA-F]{6})"')) || [])[1] || '').toLowerCase();
    const pairs = [['primary', 'bg'], ['accent', 'accent'], ['accent2', 'accent2'],
                   ['accent3', 'accent3'], ['text', 'ink'], ['text2', 'ink2'], ['text3', 'ink3']];
    for (const [key, role] of pairs) {
      if (!roles[n][role]) continue;   // accent3 is optional
      /* No swatch means the editor hides the control. That is only honest for
         a slot whose variable the template never uses (Golden Hour's Text3):
         a hidden control that DID paint something would be a colour the couple
         cannot change. */
      if (!g(key)) {
        const v0 = [].concat(roles[n][role])[0];
        const tsrc = fs.readFileSync('template-' + n + '.html', 'utf8');
        if (new RegExp('var\\(' + v0.replace(/-/g, '\\-') + '\\)').test(tsrc))
          drift.push(n + '.' + key + ': hidden in the editor but ' + v0 + ' paints');
        continue;
      }
      if (g(key) !== hex(roles[n][role])) {
        drift.push(n + '.' + key + ': swatch ' + g(key) + ' but ' + roles[n][role] + ' is ' + hex(roles[n][role]));
      }
    }
  }
  check('picker swatches match the variables they drive', drift, []);

  // --text and --text2 share a prefix, so an unanchored match reads one as the
  // other. The editor must use the guarded pattern.
  // --text, --text2 and --text3 share a prefix. An unguarded --text pattern
  // matches all three, so Text 1 would read whichever numbered tone was set and
  // clearing any one would wipe the others.
  check('the editor guards --text against the numbered tones',
    /text\(\?!\[0-9\]\)/.test(block) && !/text\(\?!2\)/.test(block), true);
  check('the editor exposes a second text tone', /setText2Color/.test(block) && /text2_color/.test(block), true);
  check('the editor exposes a third text tone', /setText3Color/.test(block) && /text3_color/.test(block), true);
  check('the runtime applies the second text tone', /v\.ink2, pick\(c\.text2_color/.test(rt), true);
  check('the runtime applies the third text tone', /v\.ink3, pick\(c\.text3_color/.test(rt), true);
  // Labels are meant to be reworded without touching wiring, so they must come
  // from the table rather than being written into the controls.
  check('every colour control takes its label from COLOR_LABELS',
    /const COLOR_LABELS = \{/.test(block) &&
    (block.match(/COLOR_LABELS\.(primary|accent|text|text2|text3)\.label/g) || []).length >= 5, true);

  // The picker swatches must match what the control drives, which is the whole
  // of "the titles are opposite".
  const pal = (block.match(/const TEMPLATE_PALETTES = \{[\s\S]*?\};/) || [''])[0];
  check('palette defaults carry every role',
    (pal.match(/text2:/g) || []).length === 10 && (pal.match(/text3:/g) || []).length === 10 &&
    (pal.match(/accent2:/g) || []).length === 10, true);
  check('the editor exposes the second fill colour',
    /setAccent2Color/.test(block) && /accent2_color/.test(block), true);
  check('the runtime applies the second fill colour', /v\.accent2, pick\(c\.accent2_color/.test(rt), true);
  check('the runtime applies the third fill colour', /v\.accent3, pick\(c\.accent3_color/.test(rt), true);
  check('the editor hides the third fill where there is none',
    /_palette\.accent3 \?/.test(block), true);

  // Every role must actually paint or set something, or the control is dead.
  // Golden Hour's ink3 is the one known exception - it genuinely has only two
  // text tones - so it is named here rather than silently tolerated.
  const dead = [];
  for (const n of names) {
    const src = fs.readFileSync('template-' + n + '.html', 'utf8');
    for (const role of ['bg', 'accent', 'accent2', 'accent3', 'ink', 'ink2', 'ink3']) {
      if (!roles[n][role]) continue;   // accent3 is optional
      if (n === 'goldenhour' && role === 'ink3') continue;
      // Summed across a slot's aliases: between them they must be used, and an
      // alias that is never referenced is itself worth reporting.
      const vs = [].concat(roles[n][role]);
      const used = vs.reduce((a, v) =>
        a + (src.match(new RegExp('var\\(' + v.replace(/-/g, '\\-') + '\\)', 'g')) || []).length, 0);
      if (!used) dead.push(n + '.' + role + ' (' + vs.join('+') + ') is never used');
    }
  }
  check('no colour control is wired to an unused variable', dead, []);
}

// The registry section must never show two calls to action. The fallback link
// existed because five templates ship a section with nothing clickable in it,
// but it was gated only on REGISTRY_LINK_SELECTORS matching - so a template
// whose CTA is classed differently got a second one appended beside its own.
{
  const rt2 = fs.readFileSync('site-runtime.js', 'utf8');
  const i = rt2.indexOf('function wireRegistryLinks(');
  const body = i === -1 ? '' : rt2.slice(i, i + 4000);
  check('the registry fallback checks for an existing call to action',
    /alreadyHasCta/.test(body) && /!nodes\.length && !alreadyHasCta/.test(body), true);
}

// ── The live anti-flash cover ─────────────────────────────────────────────
// The template head installs #mp-veil and used to lift it blind at 4s. On a
// slow connection hydration is still running then, so lifting uncovered the
// UN-hydrated page - the template's own stock photographs, painted for a moment
// before the couple's replaced them. That is the flash that survived on live
// after preview and thumbnails were fixed.
{
  const rt = fs.readFileSync('site-runtime.js', 'utf8');
  check('the runtime announces itself at parse time',
    /window\.__mpRuntimeAlive = 1/.test(rt), true);
  const tpls = fs.readdirSync('.').filter(f => /^template-.*\.html$/.test(f)).sort();
  const blind = tpls.filter(f => {
    const src = fs.readFileSync(f, 'utf8');
    return !/__mpRuntimeAlive/.test(src);
  });
  check('every template veil defers to a live runtime', blind, []);

  // The reveal must wait for EVERY hero photograph. Waiting on the first
  // uncovered the page while a carousel's remaining slides were still arriving,
  // so they popped in one after another.
  const i = rt.indexOf('function _heroSources(');
  const body = rt.slice(i, rt.indexOf('function revealWhenHeroReady('));
  check('the reveal collects every hero image, not just the first',
    /querySelectorAll\(/.test(body) && /heroCarousel img/.test(body), true);
  // Pressed Petals flashed when nothing else did: its Need to Knows band ships
  // a stock photograph and hydrate swaps #needToKnowBg's backgroundImage to the
  // couple's. Only hero containers were watched, so the page uncovered while
  // that band still held the template's own photograph. An inline
  // background-image is the fingerprint of a swap - the stylesheet never sets
  // one - so reading them back after hydrate finds every photograph just put
  // there, whatever the element is called.
  check('the reveal waits for hydrate-swapped background photographs',
    /\[style\*="background-image"\]/.test(body), true);

  // Naming the elements did not scale. The list went hero containers, then
  // #heroCarousel, then anything with an inline background-image, and a scan
  // STILL turned up Coastal Chic's #travelImg and Vintage's three story
  // photographs - stock images in the markup, swapped at hydrate, watched by
  // nothing. So the runtime snapshots every img src as the markup shipped it
  // and compares afterwards: whatever changed is what hydrate replaced, which
  // is exactly the set that can flash. This is the check that keeps it general
  // rather than a list of ids someone has to remember to extend.
  check('the reveal snapshots the markup and watches whatever changed',
    /_initialSrc/.test(rt) && /now !== was/.test(body), true);
  // The hero must be collected BEFORE the general sweep. There is a cap, and
  // Modern Minimal ships thirteen photographs, most of them registry cards
  // below the fold, which would otherwise fill it first.
  check('the hero is collected before the general sweep',
    body.indexOf('#heroCarousel img') < body.indexOf('_initialSrc.length'), true);

  // load fires when the bytes are in; decode resolves when the frame can be
  // painted. Both report, so each source needs its own latch or a shared
  // counter takes both and uncovers early.
  const _rwStart = rt.indexOf('function revealWhenHeroReady(');
  const rw = rt.slice(_rwStart, rt.indexOf('function reveal(', _rwStart + 1));
  check('the reveal waits for decode, not just load', /\.decode\(\)/.test(rw), true);
  check('each hero source can only settle once', /onePer/.test(rw), true);
}

// Registry copy: clearing it in the editor must clear it on the page, and the
// heading must not have the couple's first words wrapped around it.
{
  const rt = fs.readFileSync('site-runtime.js', 'utf8');
  const i = rt.indexOf('function layOutRegistry(');
  // Bound by the next TOP-LEVEL declaration, not a character count:
  // layOutRegistry has grown twice and silently truncated these checks each
  // time. Two-space indent, so an inner callback does not end the slice early.
  const body = i === -1 ? '' : rt.slice(i, rt.indexOf('\n  function ', i + 10));
  // Golden Hour and Heirloom Bloom name the block registryBody; missing it made
  // this return early there, leaving the title inline for the copy to wrap.
  check('layOutRegistry knows all three registry copy ids',
    /registryInfo/.test(body) && /registryText/.test(body) && /registryBody/.test(body), true);
  // display:block on the heading is not enough. Heirloom Bloom's
  // .registry-frame is a FLEX ROW, so heading and copy are flex items sitting
  // side by side and `display` on an item is ignored - the couple's text
  // appeared to the RIGHT of the heading and pushed it into wrapping. The
  // container has to stack, and unstack again when the copy is cleared.
  check('a flex registry frame stacks when it holds copy',
    /flexDirection = 'column'/.test(body) && /flexDirection = ''/.test(body), true);
  const guarded = ['template-goldenhour.html', 'template-heirloombloom.html'].filter(f => {
    const src = fs.readFileSync(f, 'utf8');
    // Guarding the WRITE on a non-empty value means clearing never takes effect.
    return /if\s*\(\s*rb\s*&&\s*d\.registry_info\s*\)/.test(src);
  });
  check('clearing the registry copy clears the page', guarded, []);
}

// ── No tone outside the design's own colour spec ──────────────────────────
// The published spec for each template, verbatim. Several carried an extra
// near-black or a pure white that lettered or filled a good part of the page
// and was in no spec - Heirloom Bloom's was close enough to its berry to read
// as a second burgundy, which is how this was noticed. A tone creeping back in
// now fails here rather than on someone's screen.
{
  const SPEC = {
    pressedpetals:    ['#8d8863', '#f9f7f5', '#ffffff', '#040505'],
    blacktietimeless: ['#1c2120', '#f9f7f5', '#ffffff'],
    goldenhour:       ['#d7dde4', '#ffffff', '#32344b'],
    sageandstill:     ['#a8a99b', '#f5f3ee', '#4b5244', '#696c62', '#000000'],
    heirloombloom:    ['#afab57', '#f2ece7', '#673d45', '#696c62'],
    regalboho:        ['#fefaf1', '#515000', '#53141e', '#f1e4c9'],
    vintagelovestory: ['#513229', '#000000', '#fffdf5', '#d8ebf9'],
    coastalchic:      ['#1b2a41', '#fefaf1', '#5f7689', '#324a5f'],
    whimsicalromance: ['#e5989b', '#53141e', '#e4c567', '#fffdf5'],
    modernminimal:    ['#000000', '#004aad', '#fffdf5'],
  };
  const stray = [];
  for (const [name, allowed] of Object.entries(SPEC)) {
    const src = fs.readFileSync('template-' + name + '.html', 'utf8');
    const root = (src.match(/:root\s*\{[\s\S]*?\}/) || [''])[0];
    for (const m of root.matchAll(/(--[a-z0-9-]+)\s*:\s*(#[0-9a-fA-F]{6})/gi)) {
      const hex = m[2].toLowerCase();
      // Only tones the template actually uses matter; an unreferenced
      // declaration paints nothing.
      const used = (src.match(new RegExp('var\\(' + m[1].replace(/-/g, '\\-') + '\\)', 'g')) || []).length;
      if (used && !allowed.includes(hex)) stray.push(name + ': ' + m[1] + ' ' + hex + ' is not in the spec');
    }
  }
  check('no tone outside the design spec', stray, []);

  // The other direction: the picker's own defaults must be spec colours too, or
  // the swatch offers a tone the design does not have.
  const block = fs.readFileSync('Website.txt', 'utf8');
  const pal = (block.match(/const TEMPLATE_PALETTES = \{[\s\S]*?\};/) || [''])[0];
  const IDS = {
    '973f938f-30cd-42dc-b1f4-b4302d160698': 'heirloombloom',
    '2b508102-48ef-4330-92ac-24b0a0abc094': 'pressedpetals',
    '72c2caba-f5a8-4a85-b683-397b39e34b44': 'blacktietimeless',
    '1bdc5372-1d57-46e7-8883-1a0586838aa6': 'goldenhour',
    '1665a3ed-74c9-49f4-a002-e5b15686597c': 'sageandstill',
    '86596984-1045-4adb-838d-2b59b75f0003': 'modernminimal',
    'c2be12ee-8127-4a7d-b975-492bbc8bb812': 'whimsicalromance',
    'b2ea1d6d-da4f-4023-ba04-fb7baa756608': 'coastalchic',
    'ea503a80-4b62-4936-97ae-28e96cd960b4': 'vintagelovestory',
    '716cd27c-ea9c-4ece-b4f2-bba0a9935a0b': 'regalboho',
  };
  const badSwatch = [];
  for (const [id, name] of Object.entries(IDS)) {
    const row = (pal.match(new RegExp('"' + id + '":\\s*\\{([^}]*)\\}')) || [])[1] || '';
    for (const m of row.matchAll(/(\w+):\s*"(#[0-9a-fA-F]{6})"/g)) {
      if (!SPEC[name].includes(m[2].toLowerCase())) {
        badSwatch.push(name + '.' + m[1] + ' ' + m[2] + ' is not in the spec');
      }
    }
  }
  check('every picker default is a spec colour', badSwatch, []);
}

// ── The live site must apply every colour, not just the two columns ───────
// Only primary_color and accent_color are columns on the record. The other
// five tones are stored as keys inside custom_css, and in the editor the block
// unpacks them into the preview payload. Nothing did that on live - the page
// fetches the record straight from the API - so everything past Site
// Background and Accent applied in preview and silently did not on the site.
{
  const rt = fs.readFileSync('site-runtime.js', 'utf8');
  const i = rt.indexOf('function applyCustomColors(');
  const body = i === -1 ? '' : rt.slice(i, i + 2600);
  check('the live path derives the other tones from custom_css',
    /_cssColorVar/.test(rt) && /d\.custom_css/.test(body), true);
  // Same prefix trap as the editor: an unanchored "text" matches --text2 too.
  check('the runtime guards --text against the numbered tones',
    /text\(\?!\[0-9\]\)/.test(body), true);
  // Those keys are storage, not CSS. A bare declaration outside a selector is
  // invalid and the browser drops the run, taking a following rule with it.
  /* This pinned the hand-written pattern, and that pattern was the bug: it
     listed five keys and matched neither --bg nor a bare --accent. Pinning a
     literal meant the gate passed while two keys leaked into the stylesheet.
     It asserts the shared list is used instead; what is IN that list is
     checked against what the editor writes, further down. */
  check('the colour keys are stripped before custom_css is injected',
    /String\(d\.custom_css\)\.replace\(_STORAGE_KEY_RE, ''\)/.test(rt), true);
}

// The Content box must only show the heading face where the site actually
// makes a title. Marking it everywhere showed the registry copy in Luxurious
// Script while the site rendered it in Lancelot.
{
  const block = fs.readFileSync('Website.txt', 'utf8');
  const i = block.indexOf('const _markTitles =');
  const body = i === -1 ? '' : block.slice(i, i + 900);
  check('titles are marked only where the template parses them',
    /if \(!blockNoun && !titleLine\) return str;/.test(body), true);
  // Four sections parse a title out of the copy: the two event lists and the
  // FAQs, which are lists and carry a blockNoun, plus Travel, which is a single
  // block and carries titleLine. Accommodations used to be the second of those;
  // it has no box any more. If that set changes, the guard above needs
  // revisiting rather than silently covering more.
  const nouns = (block.match(/blockNoun: "\w+"/g) || []).length;
  check('three list sections parse titles out of their copy', nouns, 3);
  const titled = (block.match(/titleLine: true/g) || []).length;
  check('one single-block section parses titles out of its copy', titled, 1);
}

// ── Nothing written to the record may be a non-string ─────────────────────
// The save posts these field values verbatim. A JSON null inside
// sectionHeadings was a shape the backend had never been sent, and saving
// started returning 400 - which then looked like "my colours do not reach the
// live site", because nothing was being persisted at all. Both fields carry
// strings now; "" means the same as the null did, and hasOwnProperty is what
// separates "cleared" from "never set".
{
  const block = fs.readFileSync('Website.txt', 'utf8');
  const i = block.indexOf('const _setHeading =');
  const setter = i === -1 ? '' : block.slice(i, i + 700);
  check('the blank heading is stored as a string, not null',
    /next\[sectionKey\] = ""/.test(setter) && !/= null/.test(setter), true);
  check('the blank-heading test compares against ""',
    /_headings\[sectionKey\] === ""/.test(block), true);
  // customCss is the exception and deliberately still posts null: that is what
  // the reset-colours button has always sent for this field, so it is the only
  // value known to be accepted. Changing it to "" was a guess made while
  // chasing a 400, not a finding, and has been reverted. What must NOT happen
  // is a null inside the sectionHeadings JSON, which is a shape the backend had
  // never been sent - that is checked above.
  check('clearing a colour matches the long-standing reset behaviour',
    /handleUpdate\("customCss", existing \|\| null\)/.test(block), true);
  // Whatever is sent, nothing may go out as undefined: JSON.stringify omits it,
  // so the field silently vanishes from the payload instead of being cleared.
  check('undefined values are stripped before the save',
    /if \(changes\[k\] === undefined\) delete changes\[k\]/.test(block), true);
  // A failed save has to name what it sent, or diagnosing it is guesswork.
  check('a failed save logs the field map', /_lastSaveFields/.test(block), true);

  // A raw status told the couple nothing about whether their work survived,
  // which is the only thing they want to know. Every branch has to say what
  // probably happened, what to do, and how to check.
  {
    const src = (block.match(/const _saveErrorMessage = \(err\) => \{[\s\S]*?\n\};/) || [''])[0]
      .replace(/\r/g, '');
    check('save failures have a plain-language message', !!src, true);
    if (src) {
      const msg = new Function(src + '\nreturn _saveErrorMessage;')();
      const cases = [{ status: 409 }, { status: 401 }, { status: 413 }, { status: 400 },
                     { status: 422 }, { status: 500 }, { status: 0, message: 'network' },
                     {}, { response: { status: 400 } }];
      const bad = [];
      for (const e of cases) {
        const m = msg(e);
        if (m.indexOf(String.fromCharCode(8212)) !== -1) bad.push('em dash: ' + m);
        if (/\b(400|401|403|409|413|422|500)\b/.test(m)) bad.push('status code shown: ' + m);
        if (!m || m.length < 40) bad.push('too terse: ' + m);
      }
      check('every branch reads plainly and shows no status code', bad, []);
    }
  }

  // The runtime must still read a record written during the null window.
  const rt = fs.readFileSync('site-runtime.js', 'utf8');
  // Anchor on the comment above the branch itself. Two other loops open
  // identically - one in reportSectionHeadings, one the design-heading capture
  // pass at the top of applySectionHeadings - and matching either read the
  // wrong code.
  const j = rt.indexOf('hasOwnProperty is what separates them');
  const branch = j === -1 ? '' : rt.slice(j, j + 1600);
  check('the runtime accepts both "" and a legacy null as cleared',
    branch.indexOf('val === null || !String(val).trim()') !== -1, true);
}

// ── Save the Date is its own block ────────────────────────────────────────
// It used to hide a per-template list of section ids and dress whatever hero
// was left. That list was wrong wherever a template's structure differed from
// the assumption: Modern Minimal's heroId is its site HEADER, so the
// announcement dressed the nav bar while the real photograph sat in a section
// nobody hid, and things-to-do was missing from its list entirely.
{
  const rt = fs.readFileSync('site-runtime.js', 'utf8');
  const i = rt.indexOf('function applySaveTheDate(');
  const body = i === -1 ? '' : rt.slice(i, rt.indexOf('function clearSaveTheDate(') > i
    ? rt.indexOf('function clearSaveTheDate(') : i + 9000);
  /* To the end of the function, not a guessed width - the pointer-events fix
     pushed the motif past 9000 and the check read a slice without it. The
     sixth fixed-width window to do this; there are none left in this file. */
  const whole = rt.slice(i, rt.indexOf('_stdOwnTextRects, _stdDeoverlap'));

  check('the announcement is a block of its own', /mp-std-block/.test(whole), true);
  // Hiding by rule, not by list: every top-level element goes except the brand
  // footer and the block itself.
  check('everything else is hidden by rule, not by a list of ids',
    /document\.body\.children/.test(whole) && /mp-brand-footer/.test(whole), true);
  check('one photograph, chosen in order', /_stdPhotoUrl/.test(rt), true);
  // Desktop: the block is the screen and the type sits on the picture.
  check('on desktop the block fills the screen with the photo behind the type',
    /height:100vh/.test(whole) && /object-fit:cover/.test(whole), true);
  // Phone: block plus footer is one screen, photograph whole, no scrolling.
  check('on a phone the block and footer are one screen',
    /height:calc\(100svh - /.test(whole) && /height:calc\(100vh - /.test(whole), true);
  check('the phone photograph is shown whole', /object-fit:contain/.test(whole), true);
  check('the phone type sits in the site colour, not on the picture',
    /position:static;transform:none/.test(whole), true);
  // Type uses the template's own faces: heading for "Save the Date", body for
  // the date and the invitation line.
  check('the announcement uses the template fonts',
    /_stdFonts/.test(rt) && /fonts\.heading/.test(whole) && /fonts\.body/.test(whole), true);
  check('the band is the accent, read live',
    /_roleVars\.accent/.test(whole) && /_cssVal\(/.test(whole), true);
  check('the band ink is chosen by contrast, not fixed',
    /_bandLum/.test(whole) && /_roleVars\.ink2/.test(whole) && /_roleVars\.ink,/.test(whole), true);
  check('the motif sits with the invitation line',
    /mp-std-motif/.test(whole) && /CFG\.loadingImage/.test(whole), true);
  check('every template has a motif to show', (rt.match(/loadingImage:/g) || []).length, 10);

  // Every accent band must end up with a readable ink.
  {
    const vs = (rt.match(/var TEMPLATE_COLOR_VARS = \{[\s\S]*?\};/) || [''])[0];
    const roles = eval('(' + vs.replace('var TEMPLATE_COLOR_VARS = ', '').replace(/;$/, '') + ')');
    const lum = (h) => {
      h = h.replace('#', '');
      return (0.299 * parseInt(h.slice(0, 2), 16) + 0.587 * parseInt(h.slice(2, 4), 16) +
              0.114 * parseInt(h.slice(4, 6), 16)) / 255;
    };
    const weak = [];
    for (const [n, r] of Object.entries(roles)) {
      const root = (fs.readFileSync('template-' + n + '.html', 'utf8')
        .match(/:root\s*\{[\s\S]*?\}/) || [''])[0];
      const hex = (v) => ((root.match(new RegExp([].concat(v)[0].replace(/-/g, '\\-') +
        '\\s*:\\s*(#[0-9a-fA-F]{6})', 'i')) || [])[1] || '').toLowerCase();
      const bg = hex(r.accent); if (!bg) continue;
      const L = lum(bg);
      const ink = L < 0.55 ? hex(r.ink2) : hex(r.ink);
      if (ink && Math.abs(L - lum(ink)) < 0.35) weak.push(n + ': ' + bg + ' vs ' + ink);
    }
    check('every accent band has a readable ink', weak, []);
  }

  // The de-overlap pass measured collisions with the template hero's own type.
  // Nothing overlays that hero now, so it must be gone rather than left to run.
  check('the de-overlap machinery is gone',
    /function _stdDeoverlap\(/.test(rt), false);
  // Switching the mode off has to put the page back.
  const k = rt.indexOf('function clearSaveTheDate(');
  const clear = k === -1 ? '' : rt.slice(k, k + 700);
  check('turning Save the Date off restores what it hid',
    /data-mp-std-hidden/.test(clear), true);
}

// A swapped photograph must not keep showing the one it replaced.
{
  const rt = fs.readFileSync('site-runtime.js', 'utf8');
  const i = rt.indexOf('function revealWhenHeroReady(');
  const body = i === -1 ? '' : rt.slice(i, rt.indexOf('function reveal(', i + 1));
  // Setting a new src does not clear the old picture - the browser paints the
  // previous image until the replacement decodes. On Save the Date, where the
  // hero is the whole page, that is the template's stock couple on screen.
  /* `load`, not decode(). decode() answers about the picture the element is
     CURRENTLY showing, which during a swap is the outgoing one - in Firefox it
     resolved against the stock photograph and released the element while the
     couple's bytes were still arriving. load is the signal that means THIS src
     arrived, which is the question being asked. */
  check('a swapped image is hidden until its own pixels arrive',
    /visibility = 'hidden'/.test(body) && /addEventListener\('load', show\)/.test(body), true);
  check('and decode is not consulted about an element mid-swap',
    /img\.decode\(\)/.test(body), false);
  // The preview re-hydrates on every keystroke. A second pass read the
  // visibility we had just set, captured 'hidden' as the value to restore, and
  // put it back when the image finally arrived - the hero never appeared.
  check('re-hydrating cannot latch an image hidden',
    /__mpHiding/.test(body) && /=== 'hidden' \? '' :/.test(body), true);
  // And a later hydrate carrying the SAME photograph must leave it alone
  // rather than blank a picture the couple is already looking at. `complete`
  // is not dependable right after a load, so the src is remembered instead.
  check('the same photograph is never hidden twice',
    /__mpHidSrc/.test(body), true);
  check('and is never left hidden on a stalled request',
    /setTimeout\(show, HERO_REVEAL_CEILING_MS \+ /.test(body), true);
  // Thumbnails were exempted for a while, on the reasoning that one could be
  // captured mid-load with an empty hero. But a thumbnail is a LIVE iframe, not
  // a capture, so it resolves when the picture arrives. The card that lost its
  // photograph did so because of the 'hidden' latch below, which is fixed. The
  // exemption only meant the template's stock couple stayed on the card while
  // the real photograph was still downloading - which is the bug it looked
  // like, and worse than the one it was avoiding.
  check('thumbnails hide a swapped photograph too, like everywhere else',
    /thumbnail-mode/.test(body), false);
  // A cached image can finish between the `complete` test and the listeners
  // being attached, in which case load has already fired and will not fire
  // again - the picture would stay hidden for good.
  check('a race with a cached image cannot leave it hidden',
    /if \(img\.complete\) show\(\);/.test(body), true);
}

// ── The menu says what the sections say (Accommodations / Travel) ─────────
// Templates hard-code their menus and the two drifted. Pressed Petals offered
// a single "Recommended Accommodations" link while the page headed those bands
// "Hotel" and "Flights", and its travel section - a separate band with its own
// id - had no link at all, so guests could not reach it.
{
  const rt = fs.readFileSync('site-runtime.js', 'utf8');
  const i = rt.indexOf('function syncMenuLinks(');
  const body = i === -1 ? '' : rt.slice(i, rt.indexOf('function buildMobileNav('));
  check('menu links are synced from the section headings', i !== -1, true);
  // Only these two. Doing every section was worse than the problem: RSVP
  // became "Rsvp Please", Regal Boho took the couple's names as a menu item,
  // and Sage & Still listed "The Weekend" twice. A heading is written to sit on
  // a page, not to label a menu.
  const keys = (rt.match(/var MENU_SYNC_KEYS = \[([^\]]*)\]/) || [])[1] || '';
  check('only accommodations and travel are synced',
    keys.replace(/['\s]/g, '').split(',').sort(), ['accommodations', 'travel']);
  check('a hidden section gets no link',
    /style\.display === 'none'\) return/.test(body), true);
  // A long match means _headingNode found a paragraph, not a heading.
  check('an over-long heading is rejected as a label', /length > 40/.test(body), true);
  // Several navs are a row of inline anchors laid out with the whitespace
  // BETWEEN them - Modern Minimal's .site-nav is one - so a clone inserted with
  // no gap ran the new link straight into its neighbour. That is what "the
  // normal site is messed up" was.
  check('an inserted link carries the menu\'s own separator',
    /nodeType === 3/.test(body) && /createTextNode/.test(body), true);
  // Position comes from where the SECTIONS sit relative to each other.
  // offsetTop was the first attempt and is not comparable across elements with
  // different offset parents, which put Flights after Need to Knows instead of
  // straight after Hotel.
  // Strip comments before the negative half: the explanation above the code
  // names offsetTop, and matching prose made this pass or fail on wording.
  const codeOnly = body.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
  check('the new link is placed by document order, not offsetTop',
    /compareDocumentPosition/.test(codeOnly) && !/offsetTop/.test(codeOnly), true);
  // Must run before the drawer is built, or the drawer copies the old wording.
  check('the sync runs before the mobile drawer is built',
    rt.indexOf('syncMenuLinks();') < rt.indexOf('buildMobileNav();'), true);
}

// ── The brand footer takes the site's theme colour ────────────────────────
// footerVars named the tone per template and the result was split down the
// middle: five sat on the page ground and came out white, five on a theme
// tone. A white footer reads as a gap under the page rather than the end of it.
{
  const rt = fs.readFileSync('site-runtime.js', 'utf8');
  const i = rt.indexOf('function resolveFooterColors(');
  const body = i === -1 ? '' : rt.slice(i, i + 1600);
  check('the footer ground is the accent, read live',
    /_accentVar/.test(body) && /TEMPLATE_COLOR_VARS\[TID\]/.test(body), true);
  // footerVars stays as the fallback, and an explicit override still wins.
  check('footerVars remains the fallback', /cssVar\(vars\.bg/.test(body), true);
  check('an override still wins', /override && override\.bg/.test(body), true);
  // The ink is contrast-checked against whatever ground results, so an accent a
  // couple has changed cannot leave the footer unreadable.
  check('the footer ink is contrast-checked', /contrastRatio\(ink, bg\) < 4\.5/.test(body), true);
}

// The Save the Date motif has to sit in the middle. A couple of them are wide
// artwork with the mark off to one side - Sage & Still's sat well right of
// centre - so the width is capped as well as the margins being auto.
{
  const rt = fs.readFileSync('site-runtime.js', 'utf8');
  const i = rt.indexOf('function applySaveTheDate(');
  const body = i === -1 ? '' : rt.slice(i, i + 9000);
  check('the motif is centred by margin and capped in width',
    /margin-left:auto;margin-right:auto/.test(body) && /max-width:min\(/.test(body), true);
}

// ── A heading report must come from the template being shown ──────────────
// The editor keeps two preview iframes alive and swaps between them, so after
// a template switch the previous template's frame is still in the page and
// still reporting. Its headings landed on top of the current one's: Pressed
// Petals offered Modern Minimal's "Accommodations" and "Travel Info" in the
// Content tab while the page itself read Hotel and Flights.
{
  const rt = fs.readFileSync('site-runtime.js', 'utf8');
  const block = fs.readFileSync('Website.txt', 'utf8');
  check('the runtime says which template a report came from',
    /type: 'MP_SECTION_HEADINGS', headings: out, template: _file/.test(rt), true);
  check('the editor drops a report from any other template',
    /_shownTemplateFile/.test(block) && /endsWith\(String\(data\.template\)\)\) return/.test(block), true);
  // Module scope, not a closure: the listener is registered once with [] deps
  // and is declared above the value it needs, so a closure would capture the
  // first render's template and adding it to the deps would read it too early.
  check('the current template is held at module scope',
    /^let _shownTemplateFile = null;/m.test(block), true);
  // An untagged report - an older runtime still deployed - must still be taken,
  // or headings would stop working entirely mid-rollout.
  {
    const admit = (shown, from) => !(from && shown && !String(shown).endsWith(String(from)));
    const cur = 'https://x/template-pressedpetals.html';
    check('a report from the shown template is accepted', admit(cur, 'template-pressedpetals.html'), true);
    check('a report from another template is dropped', admit(cur, 'template-modernminimal.html'), false);
    check('an untagged report is still accepted', admit(cur, ''), true);
  }
}

// ── No two menu entries may point at the same section ─────────────────────
// Pressed Petals listed both "Accommodations" and "Travel" against
// '#accommodations'. The two items scrolled to the same place, the travel band
// had nothing pointing at it, and the runtime - which relabels a link from the
// heading of the section it targets - dutifully renamed BOTH to "Hotel".
{
  const bad = [];
  for (const f of fs.readdirSync('.').filter(x => /^template-.*\.html$/.test(x)).sort()) {
    const src = fs.readFileSync(f, 'utf8');
    const seen = {};
    for (const m of src.matchAll(/href\s*:\s*'(#[a-z0-9-]+)'\s*,\s*label\s*:\s*'([^']*)'/gi)) {
      (seen[m[1]] = seen[m[1]] || []).push(m[2]);
    }
    for (const href in seen) {
      if (seen[href].length > 1) {
        bad.push(f.replace('template-', '').replace('.html', '') +
          ': ' + href + ' <- ' + seen[href].join(' + '));
      }
    }
  }
  check('no template points two menu entries at one section', bad, []);

  /* Travel used to have to point at an id with "travel" in it. It cannot any
     more: Accommodations and Travel are one section, and on the designs that
     draw the hotel first the surviving link points at #accommodations. What
     matters now is that the id it points at EXISTS in that template - a link to
     a section the design does not have is a link that goes nowhere. */
  const deadTarget = [];
  for (const f of fs.readdirSync('.').filter(x => /^template-.*\.html$/.test(x)).sort()) {
    const src = fs.readFileSync(f, 'utf8');
    for (const m of src.matchAll(/href\s*:?\s*'(#[a-z0-9-]+)'\s*,?\s*(?:label|l)\s*:\s*'(Travel[^']*)'/gi)) {
      if (!new RegExp('id="' + m[1].slice(1) + '"').test(src)) {
        deadTarget.push(f.replace('template-', '').replace('.html', '') + ': ' + m[2] + ' -> ' + m[1]);
      }
    }
  }
  check('the travel menu entry targets a section that exists', deadTarget, []);
}

// The menu sync must not fail silently. Anything thrown in there leaves the
// template's own hardcoded labels in place and looks exactly like the sync
// never ran, with nothing anywhere to say otherwise.
{
  const rt = fs.readFileSync('site-runtime.js', 'utf8');
  const i = rt.indexOf('function syncMenuLinks(');
  const body = i === -1 ? '' : rt.slice(i, rt.indexOf('function buildMobileNav('));
  check('a failure in the menu sync is reported, not swallowed',
    /\[mp-menu\] sync failed/.test(body), true);
  check('the sync says what it found, in the editor only',
    /\[mp-menu\] '/.test(body) && /window\._isPreview/.test(body), true);
}

// ── A column title is content, not the section's heading ──────────────────
// Pressed Petals' accommodations band has no heading of its own: "Hotel" and
// "Flights" are the two COLUMN titles inside it. Reading one as the section
// heading made the Content tab label that section "Hotel", and left the word
// itself uneditable - the couple got a body box and nothing else. The titles
// come from the first line of their own copy now, exactly as the event lists
// work, and the section falls back to its own name.
{
  const rt = fs.readFileSync('site-runtime.js', 'utf8');
  const i = rt.indexOf('function _headingNode(');
  const body = i === -1 ? '' : rt.slice(i, rt.indexOf('function _rememberHeading('));
  check('a column or card title is not read as a section heading',
    /\(col\|card\|item\|event\|slide\|cell\)-title/.test(body), true);

  const tpl = fs.readFileSync('template-pressedpetals.html', 'utf8');
  check('the column title comes from the copy, not a hardcoded word',
    /_mpColBlock/.test(tpl) &&
    !/'<div class="accom-col-title">Hotel<\/div>' \+/.test(tpl) &&
    !/'<div class="accom-col-title">Flights<\/div>' \+/.test(tpl), true);
  // The sample copy has to carry its own title line or the standalone template
  // shows two untitled columns.
  check('the sample copy opens with its title line',
    /accommodation_info:'<strong>Hotel<\/strong><br>/.test(tpl) &&
    /travel_info:'<strong>Flights<\/strong><br>/.test(tpl), true);
}

// ── The Design tab toggle names the SECTION, not the template's wording ───
// That row is a toggle: it says which part of the site is being switched on and
// off, so it has to read "Accommodations" even where the template heads that
// band "Hotel". Falling back to the reported heading made the toggle rename
// itself to whatever the design happened to call the section.
{
  const block = fs.readFileSync('Website.txt', 'utf8');
  const i = block.indexOf('activeTab === "design"');
  // Bound by the next tab so this reads the design panel only.
  const panel = i === -1 ? '' : block.slice(i, block.indexOf('activeTab === "content"', i));
  check('the design toggle falls back to the section name',
    /_headingFor\(s\.section\) \|\| s\.label/.test(panel), true);
  check('and not to the reported heading',
    /_headingFor\(s\.section\) \|\| liveHeadings\[s\.section\] \|\| s\.label/.test(panel), false);
  // A rename the couple actually made must still show, or the toggle would
  // disagree with their own site.
  check('a real rename still shows on the toggle', /_headingFor\(s\.section\)/.test(panel), true);
  // The Content tab is where the template's wording belongs, so it keeps it.
  const rest = block.slice(block.indexOf('activeTab === "content"'));
  check('the content tab still shows the template wording',
    /_headingFor\(s\.section\) \|\| liveHeadings\[s\.section\] \|\| s\.label/.test(rest), true);
}

// ── Starter copy carries a title where the template needs one ─────────────
// Pressed Petals takes its two column titles from the first line of the
// couple's copy, so its starter copy has to have one or the columns arrive
// untitled with no "Hotel" or "Flights" anywhere to edit. Every other template
// hardcodes those words, so the shared table must NOT carry a title line - it
// would print twice.
{
  const block = fs.readFileSync('Website.txt', 'utf8').replace(/\r/g, '');
  const cd = (block.match(/const CONTENT_DEFAULTS = \{[\s\S]*?\n\};/) || [''])[0];
  const td = (block.match(/const TEMPLATE_CONTENT_DEFAULTS = \{[\s\S]*?\};/) || [''])[0];
  const hp = (block.match(/const _contentDefault = \(templateId, key\) => \{[\s\S]*?\n\};/) || [''])[0];
  check('the per-template starter table exists', !!td && !!hp, true);

  const ctx = new Function(cd + '\n' + td + '\n' + hp +
    '\nreturn {f:_contentDefault, C:CONTENT_DEFAULTS, T:TEMPLATE_CONTENT_DEFAULTS};')();
  const PP = '2b508102-48ef-4330-92ac-24b0a0abc094';

  /* ONE box holds both cards now. The two column headings still come from the
     first line of each card rather than from code, so a couple can rename or
     delete them - but they live in one field, hotel first, separated by the
     blank line the runtime cuts them apart on. */
  check('the one travel box opens with the hotel card',
    /^<strong>Hotel<\/strong><br>/.test(ctx.C.travelInfo), true);
  check('and carries the flights card after a blank line',
    /(?:<br\s*\/?>\s*){2,}<strong>Flights<\/strong><br>/.test(ctx.C.travelInfo), true);
  check('the retired accommodations box seeds nothing', ctx.C.accomodationInfo, '');
  check('every template resolves to the same starter copy',
    ctx.f(PP, 'travelInfo') === ctx.C.travelInfo &&
    ctx.f('973f938f-30cd-42dc-b1f4-b4302d160698', 'travelInfo') === ctx.C.travelInfo, true);
  // The venue name is body copy, not a second heading.
  check('the venue name is not bold',
    /^<strong>Hotel<\/strong><br><strong>/.test(ctx.C.accomodationInfo), false);

  // Both consumers - the Content box and the preview payload - must resolve to
  // the same text, or the editor and the site disagree about an untouched
  // section.
  const drift = [];
  for (const id of [PP, '973f938f-30cd-42dc-b1f4-b4302d160698']) {
    for (const k of ['accomodationInfo', 'travelInfo']) {
      const box = ctx.f(id, k);
      const payload = { ...ctx.C, ...(ctx.T[id] || {}) }[k];
      if (box !== payload) drift.push(id + '.' + k);
    }
  }
  check('the content box and the payload seed the same text', drift, []);

  // Whatever is in the box is what the site shows. The starter copy fills a
  // field that has never been set, and nothing else.
  //
  // There was briefly a list of former defaults, and a saved value matching one
  // was treated as untouched so the current starter copy would show. It had to
  // go: deleting the title line off the travel copy leaves exactly the old
  // default behind, so the box matched the list and the title was put back -
  // the couple deleted a heading and watched it reappear. Text arrived at by
  // editing is indistinguishable from text we shipped, so this cannot be
  // guessed safely and is not guessed at all.
  const un = (block.match(/const _isUntouchedContent = [\s\S]*?;\n/) || [''])[0];
  check('untouched means never set, nothing cleverer',
    /value === undefined \|\| value === null;/.test(un) &&
    !/LEGACY_CONTENT_DEFAULTS/.test(block), true);
  if (un) {
    const u = new Function(un + '\nreturn _isUntouchedContent;')();
    check('a never-set box takes the starter copy', u(undefined), true);
    // The cases that made the old approach untenable.
    check('copy that matches a former default is left alone',
      u('The nearest airport is San Diego International (SAN), approximately 20 minutes away by car.'), false);
    check("the couple's own words are left alone", u('<strong>Getting here</strong><br>Fly into SAN'), false);
    check('a deliberately cleared box stays cleared', u(''), false);
  }

  // And the template's own SAMPLE_DATA has to match, or the standalone file
  // shows something different again.
  const tpl = fs.readFileSync('template-pressedpetals.html', 'utf8');
  check('the template sample matches its starter copy',
    /accommodation_info:'<strong>Hotel<\/strong><br>Hyatt Regency/.test(tpl) &&
    /travel_info:'<strong>Flights<\/strong><br>/.test(tpl), true);
}

// ── These two sections are named the same everywhere ──────────────────────
// A menu link must read exactly what the section is headed. Templates had
// drifted apart: "Recommended Accommodations" in the menu over a section headed
// "Accommodations", "Travel Info" in some and "Travel" in others, "Hotel
// Details" in one.
{
  const banned = ['Travel Info', 'Hotel Details', 'Recommended Accommodations'];
  const bad = [];
  for (const f of fs.readdirSync('.').filter(x => /^template-.*\.html$/.test(x)).sort()) {
    const src = fs.readFileSync(f, 'utf8');
    for (const line of src.split('\n')) {
      // Comments and sample copy may still mention the old wording.
      if (/^\s*(\/\/|\*|<!--)/.test(line)) continue;
      if (/_info:'/.test(line)) continue;
      for (const b of banned) {
        if (line.indexOf('>' + b + '<') !== -1 ||
            new RegExp("label\\s*:\\s*'" + b + "'").test(line)) {
          bad.push(f.replace('template-', '').replace('.html', '') + ': ' + b);
        }
      }
    }
  }
  check('no template uses an off-name for these two sections', [...new Set(bad)], []);
}

// ── Content box, preview payload and thumbnail must agree ─────────────────
// They seeded untouched content by two different rules. The box treated a
// former default as untouched and showed the current starter copy; the payload
// checked only for missing or null and sent the OLD text. So the Content tab
// read "Hotel" while the preview headed that column "Hyatt Regency La Jolla At
// Aventine" - the first line of the stale copy. Thumbnails render SAMPLE_DATA
// and showed the current wording, so they disagreed with the preview too.
{
  const block = fs.readFileSync('Website.txt', 'utf8').replace(/\r/g, '');
  const grab = (re) => (block.match(re) || [''])[0];
  const ctx = new Function(
    grab(/const CONTENT_DEFAULTS = \{[\s\S]*?\n\};/) + '\n' +
    grab(/const LEGACY_CONTENT_DEFAULTS = \[[\s\S]*?\n\];/) + '\n' +
    grab(/const _isUntouchedContent = [\s\S]*?;\n/) + '\n' +
    grab(/const TEMPLATE_CONTENT_DEFAULTS = \{[\s\S]*?\};/) + '\n' +
    grab(/const _contentDefault = \(templateId, key\) => \{[\s\S]*?\n\};/) +
    '\nreturn {u:_isUntouchedContent,f:_contentDefault,C:CONTENT_DEFAULTS,T:TEMPLATE_CONTENT_DEFAULTS};')();

  // Neither seeds any more. The RECORD is the single source of truth: falling
  // back to the starter copy could not be made correct, because once a couple
  // clears a box and saves, the backend stores empty and reads it back as null,
  // which is indistinguishable from never having been set. selectTemplate
  // writes the copy into the record instead.
  check('the payload does not seed content', /const _orSeed = \(value\) => value;/.test(block), true);
  check('the content box does not seed either',
    /const _rawVal = \(currentVal === undefined \|\| currentVal === null\)/.test(block) &&
    /const displayVal = _mergedBox/.test(block), true);

  const PP = '2b508102-48ef-4330-92ac-24b0a0abc094';
  const PD = { ...ctx.C, ...(ctx.T[PP] || {}) };
  // Box and payload both read the record verbatim, so they cannot disagree.
  // The state that used to break this is the last one: cleared, saved, and read
  // back as null.
  const box = (v) => (v === undefined || v === null) ? '' : v;
  const payload = (v) => v;
  const drift = [];
  for (const rec of [undefined, null, '', ctx.C.accomodationInfo, 'The Ritz']) {
    const b = box(rec), p = payload(rec);
    const norm = (x) => (x === undefined || x === null) ? '' : x;
    if (norm(b) !== norm(p)) drift.push(JSON.stringify(rec).slice(0, 30));
  }
  check('every record state shows the same text in both', drift, []);
  check('a cleared box read back as null stays empty', box(null), '');

  /* And the template's own SAMPLE_DATA, which is what a thumbnail renders,
     must equal the payload seed - otherwise thumbnail and preview differ.

     The seed is now ONE field that the runtime cuts in two, so the comparison
     runs the real _splitTravelBlob over it rather than comparing field to
     field. That makes this the end-to-end gate on the merge: if the cut ever
     stops matching the two-card shape the designs draw, the thumbnail and the
     preview part company here. */
  const tpl = fs.readFileSync('template-pressedpetals.html', 'utf8');
  const sampleOf = (k) => (tpl.match(new RegExp(k + ":'([^']*)'")) || [])[1];
  const split = new Function(rt.match(/var _VOID = \/\^\([^)]*\)\$\/i;/)[0] + '\n' +
    lift(rt, ['_openTags', '_balanceBlocks', '_splitTravelBlob']) + '\nreturn _splitTravelBlob;')();
  const cut = { travel_info: PD.travelInfo, accommodation_info: '' };
  split(cut);
  check('the cut produces a hotel card', /Hyatt Regency/.test(cut.accommodation_info), true);
  check('and a separate flights card', /San Diego International/.test(cut.travel_info), true);
  check('with nothing of one leaking into the other',
    /San Diego International/.test(cut.accommodation_info) ||
    /Hyatt Regency/.test(cut.travel_info), false);
  check('the thumbnail sample matches the preview seed after the cut',
    sampleOf('accommodation_info') === cut.accommodation_info &&
    sampleOf('travel_info') === cut.travel_info, true);
}

// ── A title survives however the couple's formatting wrapped it ───────────
// _mpTitle used to require the line to BEGIN with <strong>, <b> or <mp-title>.
// Any wrapper defeated it, and the editor produces wrappers constantly:
// execCommand('fontName') over a fully selected line yields
// <span style="font-family:X"><strong>Flights</strong></span>, which did not
// match - so the heading silently became body text. Same fault as MP-332 and
// MP-337, which were about an attire line losing its styling for this reason.
// Every template shares this function, so a break here breaks all ten.
{
  const { JSDOM } = (() => { try { return require('jsdom'); } catch (e) { return {}; } })();
  if (!JSDOM) {
    check('title wrapping (jsdom not installed - SKIPPED)', true, true);
  } else {
    const dom = new JSDOM(fs.readFileSync('template-pressedpetals.html', 'utf8'),
      { runScripts: 'dangerously' });
    const t = (html) => {
      const out = dom.window._mpColBlock(html);
      const m = out.match(/accom-col-title">([\s\S]*?)<\/div>/);
      return m ? m[1] : null;
    };
    check('a plain title reads', t('<strong>Flights</strong><br>B'), 'Flights');
    // The two shapes execCommand actually produces, depending on the selection.
    check('a font inside the marker is carried through',
      t('<strong><span style="font-family:X">Flights</span></strong><br>B'),
      '<span style="font-family:X">Flights</span>');
    check('a marker inside a font wrapper still reads',
      t('<span style="font-family:X"><strong>Flights</strong></span><br>B'),
      '<span style="font-family:X">Flights</span>');
    // Only the OUTER marker is unwrapped, so emphasis inside the title lives.
    check('partial bold inside a title survives',
      t('<mp-title>The <strong>Ceremony</strong></mp-title><br>B'),
      'The <strong>Ceremony</strong>');
    // A line with text outside the marker is a sentence, not a heading.
    check('prose is not mistaken for a title',
      t('Join us at <strong>The Ritz</strong><br>B'), null);
    check('an unmarked line is not a title', t('Flights<br>B'), null);
  }
}

// ── Save the Date hides everything, and nothing puts it back ──────────────
// MP-561. applySaveTheDate hides every top-level element, but hydrateThingsToDo
// runs AFTER it and sets its own section's display from the menu toggle - so
// Things to Do reappeared underneath the announcement. All ten templates leaked
// it, not just the one reported. Anything below that call which shows a section
// from a toggle has to be skipped in this mode for the same reason.
{
  const rt = fs.readFileSync('site-runtime.js', 'utf8');
  const at = rt.indexOf('if (!_isPreview && isSaveTheDate(d)) applySaveTheDate(d);');
  check('Save the Date is applied in hydrate', at !== -1, true);
  const after = at === -1 ? '' : rt.slice(at, at + 3000);
  check('things-to-do is skipped in Save the Date',
    /if \(_isPreview \|\| !isSaveTheDate\(d\)\) hydrateThingsToDo\(d\);/.test(after), true);
  // Any OTHER function called after the announcement that sets a section's
  // display from a menu toggle would leak the same way.
  const leaks = [];
  for (const m of after.matchAll(/^\s*(?:if \([^)]*\) )?(\w+)\(d\);/gm)) {
    const fn = m[1];
    if (fn === 'hydrateThingsToDo') continue;
    const j = rt.indexOf('function ' + fn + '(');
    if (j === -1) continue;
    if (/style\.display\s*=\s*menu\./.test(rt.slice(j, j + 2500))) leaks.push(fn);
  }
  check('nothing else after it re-shows a section', leaks, []);
}

// ── Clearing a content box has to stick (MP-329, MP-562) ──────────────────
// The preview fell back to the starter copy whenever a field was undefined or
// null. But once a couple clears a box and saves, the backend stores empty and
// reads it back as null - indistinguishable from never having been set - so the
// default came back: cleared sections kept showing text, and a box switched off
// and on again had its text restored.
//
// Selecting a template now writes the starter copy into the record, so every
// content field holds a real string and "" unambiguously means emptied. No new
// field: these are the same content columns the boxes already write to.
{
  const block = fs.readFileSync('Website.txt', 'utf8').replace(/\r/g, '');
  const i = block.indexOf('const selectTemplate =');
  const body = i === -1 ? '' : block.slice(i, block.indexOf('applyChanges(additions);', i));
  check('selecting a template seeds the content boxes',
    /_contentDefault\(t\.id, key\)/.test(body) && /for \(const sec of PAGE_SECTIONS\)/.test(body), true);
  // Only where it has never been set: an emptied box and the couple's own
  // words must both survive a template switch.
  check('a box that was never set is seeded',
    /if \(!_isUntouchedContent\(currentData\[key\]\)\) continue;/.test(body), true);
  check('an edit made this session is not overwritten',
    /hasOwnProperty\.call\(localChanges, key\)\) continue;/.test(body), true);

  const grab = (re) => (block.match(re) || [''])[0];
  const ctx = new Function(
    grab(/const CONTENT_DEFAULTS = \{[\s\S]*?\n\};/) + '\n' +
    grab(/const TEMPLATE_CONTENT_DEFAULTS = \{[\s\S]*?\};/) + '\n' +
    grab(/const _isUntouchedContent = [\s\S]*?;\n/) + '\n' +
    grab(/const _contentDefault = \(templateId, key\) => \{[\s\S]*?\n\};/) +
    '\nreturn {u:_isUntouchedContent,f:_contentDefault};')();
  const PP = '2b508102-48ef-4330-92ac-24b0a0abc094';
  check('a never-set box would be seeded', ctx.u(undefined) && ctx.u(null), true);
  check('an emptied box would not be reseeded', ctx.u(''), false);
  check("the couple's own words would not be reseeded", ctx.u('The Ritz'), false);

  // Every content box must have starter copy to seed, or a template switch
  // would leave some sections empty while filling others.
  const keys = [...(grab(/const PAGE_SECTIONS = \[[\s\S]*?\n\];/))
    .matchAll(/contentKey:\s*"(\w+)"/g)].map(m => m[1]);
  check('all seven content boxes are covered', keys.length, 7);
  // registryInfo ships deliberately blank - the registry section is a link, not
  // prose - so it has nothing to seed and the loop skips it. Everything else
  // must have copy, or a template switch would fill some sections and not
  // others.
  check('every content box except the registry has starter copy',
    keys.filter(k => !ctx.f(PP, k)), ['registryInfo']);
}

// ── The mobile drawer follows the section toggles ─────────────────────────
// It was built once and then returned early on every later hydrate, so it kept
// whatever link set the first one saw. In the editor the page never reloads:
// clearing a section's content switches its toggle off on save, the template
// rebuilds its own menu correctly, and the drawer went on offering links to
// sections that were no longer there. The live site looked right only because
// it loads once, after the toggles have settled.
{
  const rt = fs.readFileSync('site-runtime.js', 'utf8');
  const i = rt.indexOf('function buildMobileNav(');
  const body = i === -1 ? '' : rt.slice(i, i + 2600);
  check('an existing drawer is refreshed, not skipped',
    !/^\s*if \(document\.querySelector\('\.mp-mnav-btn'\)\) return;/m.test(body) &&
    /_panel\.innerHTML = links\.map/.test(body), true);
  // Only when the set actually changed: rebuilding on every keystroke would
  // drop the drawer's open state.
  check('the drawer is only rebuilt when the links change',
    /if \(_cur !== _next\)/.test(body), true);
}

// ── Pressed Petals: the rule between the two cards ────────────────────────
// It is drawn by the WRAPPER, so hiding either section left it running down the
// middle of the one that remained - clear the Hotel card and a hairline
// appeared through the middle of Flights.
{
  const tpl = fs.readFileSync('template-pressedpetals.html', 'utf8');
  check('the divider is suppressed when only one column shows',
    /\.accom-pair\.mp-one-col::before,\s*\n\.accom-pair\.mp-one-col::after\{display:none;\}/.test(tpl), true);
  check('hydrate counts the visible columns',
    /_pair\.classList\.toggle\('mp-one-col', _shown < 2\)/.test(tpl), true);
  // Neither showing would otherwise leave an empty olive stripe.
  check('the band is hidden when neither column shows',
    /_pair\.style\.display = _shown \? '' : 'none';/.test(tpl), true);
}

// The same shape in Vintage Love Story: it built BOTH travel columns whatever
// the couple had written, filled an empty one with "No airport info provided."
// - text nobody wrote, the same fault as MP-457's invented attire line - and
// put the rule in unconditionally, so clearing one side left it down the middle
// of the other. Heirloom Bloom already guarded this; Regal Boho's rule lives
// inside each column so it cannot strand.
{
  const tpl = fs.readFileSync('template-vintagelovestory.html', 'utf8');
  check('no invented "no info provided" copy',
    /No airport info provided|No hotel info provided/.test(tpl), false);
  check('a travel column is only built when it has content',
    /var leftHtml = airportsHtml/.test(tpl) && /var rightHtml = hotelsHtml/.test(tpl), true);
  check('the rule is only drawn between two columns',
    /var dividerHtml = \(leftHtml && rightHtml\)/.test(tpl), true);
}

// ── A template's own desktop drawer starts at the top ─────────────────────
// justify-content:center reads fine with ten links, but a couple who switches
// most sections off is left with four or five floating halfway down the panel
// under a large empty band. Black Tie and Heirloom Bloom already override to
// flex-start on the line below; Pressed Petals did not.
{
  const bad = [];
  for (const f of fs.readdirSync('.').filter(x => /^template-.*\.html$/.test(x)).sort()) {
    const src = fs.readFileSync(f, 'utf8');
    const m = src.match(/\.menu-drawer\{[\s\S]*?\}/);
    if (!m) continue;
    const rule = m[0];
    // The last justify-content in the rule is the one that applies.
    const all = [...rule.matchAll(/justify-content:\s*([\w-]+)/g)].map(x => x[1]);
    if (all.length && all[all.length - 1] === 'center') {
      bad.push(f.replace('template-', '').replace('.html', ''));
    }
  }
  check('no drawer centres its link list', bad, []);
}

// ── MP-498: a cleared registry heading stays cleared ──────────────────────
// layOutRegistry runs LAST in hydrate and set the title's display
// unconditionally, handing "See Our Registry" straight back after
// _blankHeading had hidden it. It was the only heading still doing this
// because it is the only one that is also a call to action, and so the only
// one this function touches.
{
  const rt = fs.readFileSync('site-runtime.js', 'utf8');
  const i = rt.indexOf('function layOutRegistry(');
  // Bound by the next TOP-LEVEL declaration, not a character count:
  // layOutRegistry has grown twice and silently truncated these checks each
  // time. Two-space indent, so an inner callback does not end the slice early.
  const body = i === -1 ? '' : rt.slice(i, rt.indexOf('\n  function ', i + 10));
  check('layOutRegistry leaves a deliberately cleared heading alone',
    /_blankedNodes\.registry/.test(body) && /if \(title && !_blanked\)/.test(body), true);

  // With the heading cleared, the section's only clickable thing goes with it -
  // on most templates the heading IS the call to action. The copy becomes the
  // link instead, so a guest can still reach the registry.
  check('the copy becomes the link when the heading is cleared',
    /mp-registry-body-cta/.test(body) && /_registryUrl/.test(body), true);
  // A real anchor, not a click handler: reachable by keyboard, opens in a new
  // tab as the heading did, and shows its destination on hover.
  check('it is a real anchor',
    /wrap\.setAttribute\('href', _registryUrl\)/.test(body) &&
    /wrap\.setAttribute\('target', '_blank'\)/.test(body), true);
  // Inherit everything: this changes what a click does, not how the copy looks.
  check('the copy keeps its own styling', /color:inherit;font:inherit;/.test(body), true);
  // Re-hydrating must not nest a second one, and restoring the heading must
  // unwrap - otherwise the copy stays clickable under a heading that is
  // already the call to action.
  check('it does not nest on a re-hydrate',
    /!info\.querySelector\('\.mp-registry-body-cta'\)/.test(body), true);
  check('restoring the heading unwraps it',
    /while \(made\.firstChild\) info\.insertBefore\(made\.firstChild, made\);/.test(body), true);
}

// ── MP-350: the link dialog ───────────────────────────────────────────────
{
  const block = fs.readFileSync('Website.txt', 'utf8').replace(/\r/g, '');
  // The backdrop's preventDefault ran for its children too, and preventDefault
  // on mousedown is what stops a browser moving the caret or starting a
  // selection - so the address box could not be clicked into or dragged across.
  check('the backdrop only blocks presses on itself',
    /if \(e\.target !== e\.currentTarget\) return;/.test(block), true);
  // An existing link could only be removed. The box is now shown for one too,
  // prefilled with its address, with Remove and Update side by side.
  check('an existing link is editable',
    /defaultValue=\{linkPrompt\.href \|\| "https:\/\/"\}/.test(block) &&
    /"Update link" : "Add link"/.test(block), true);
  check('the dialog carries the current address',
    /setLinkPrompt\(\{ words: chosen, removing: !!prev, href: prev \|\| ""/.test(block), true);
  // A caret resting inside a link means "this one"; it used to be turned away
  // with "select the words first".
  check('a caret inside a link selects that link',
    /r\.selectNodeContents\(a\);/.test(block), true);

  // Checking only anchorNode missed a drag that started just before the link or
  // ended just after it, and a selection swallowing the link whole has BOTH
  // ends outside the anchor - so the dialog opened blank on text that was
  // already linked, with no Remove button and nothing to edit.
  check('both ends and the enclosed range are checked for a link',
    /const ends = \[sel && sel\.anchorNode, sel && sel\.focusNode\];/.test(block) &&
    /range\.intersectsNode\(a\)/.test(block), true);
  check('the placeholder href is never offered back as theirs',
    /indexOf\("mp-pending\.invalid"\) !== -1\) prev = null;/.test(block), true);
  // React keeps an uncontrolled input's own value across re-renders and IGNORES
  // a changed defaultValue, so reopening the dialog on a link showed whatever
  // was typed last time rather than the address on those words. The key forces
  // a fresh input each time.
  check('the address box remounts so it shows the real href',
    /key=\{linkPrompt\.href \|\| "new"\}/.test(block), true);
  // Cancel and Remove were muted text on no background beside a solid primary,
  // which read as disabled.
  check('the secondary buttons do not read as disabled',
    (block.match(/backgroundColor: "#F2EFE9", border: "1px solid #A9BDC4", borderRadius: "999px"/g) || []).length, 2);

  // _selection() tries _win() and then window because which one owns the
  // selection has been the question behind several failed attempts here. The
  // link code asked _win() directly, so when the selection lived in the other
  // window it saw nothing, found no anchor, and opened the dialog blank on
  // words that were already linked - which is why the colour fix landed but the
  // empty box did not.
  {
    // Scoped to linkSelection: the eraser button legitimately calls
    // _win().getSelection() to select the whole box, and is not a link path.
    const li = block.indexOf('const linkSelection =');
    const ls = li === -1 ? '' : block.slice(li, block.indexOf('const _closeLinkPrompt', li));
    check('the link paths use the window-agnostic selection',
      /const _liveSelection = \(\) => \{/.test(block) &&
      (ls.match(/_liveSelection\(\)/g) || []).length === 2 &&
      // The two selection READS. The selectionFrom diagnostic probes both
      // windows on purpose, so it is not a violation.
      !/const sel = _win\(\)\.getSelection\(\);/.test(ls), true);
  }
  // It must answer for a collapsed caret too - _selection() returns nothing
  // without text, which is right for a highlight and wrong for "am I in a link".
  check('it answers for a collapsed caret',
    /if \(!sel \|\| !sel\.rangeCount\) continue;/.test(block), true);
  // The [mp-link] tracing that found all of this has been removed now that it
  // has done its job. What it established stays covered by the checks around
  // it: the selection could not be trusted, an empty address was silently
  // treated as a cancel, and the previous link has to be found from the DOM.

  // Three attempts at reading the SELECTION each came back null on text that
  // plainly was a link. createLink settles it without the selection at all:
  // given a caret inside an existing anchor the browser reuses that element and
  // swaps its href, so an anchor that was in the snapshot and is now pending IS
  // the couple's link. Where a new element was made instead, the old one is
  // nested in or around it.
  check('the previous link is also found from the DOM',
    /let anchorsBefore = \[\];/.test(block) &&
    /const nowPending = pend\.indexOf\(was\.el\) !== -1;/.test(block) &&
    /p\.contains\(was\.el\) \|\| was\.el\.contains\(p\)/.test(block), true);
  // The browser can also THROW THE OLD ELEMENT AWAY and build a fresh anchor.
  // The log caught it doing exactly that: the replacement held
  // <span style="text-decoration: underline; color: inherit"> - the two styles
  // applyLink writes onto a link - so the couple's anchor had been dissolved
  // into a span and its href lost. The snapshot element is detached then, so
  // pending/nested both miss it.
  check('an anchor consumed by createLink is detected',
    /const consumed = host && !host\.contains\(was\.el\)/.test(block), true);
  // Matching words required: another link elsewhere can be detached when the
  // browser rebuilds part of the tree, and that must not be offered as the
  // address for these words.
  check('a consumed anchor must be the same words',
    /wasText\.indexOf\(t\) !== -1/.test(block), true);

  // Last resort, and the one DOM surgery cannot defeat: read the markup as it
  // was BEFORE createLink and find the anchor covering these words. Every
  // identity check assumes the browser kept, nested, wrapped or detached the
  // element; this assumes nothing about it.
  check('the markup before the edit is kept', /let htmlBefore = "";/.test(block), true);
  check('the previous link is found by matching the words',
    /tmp\.innerHTML = htmlBefore;/.test(block) &&
    /at\.indexOf\(pendText\) !== -1 \|\| pendText\.indexOf\(at\) !== -1/.test(block), true);
  {
    const { JSDOM } = (() => { try { return require('jsdom'); } catch (e) { return {}; } })();
    if (!JSDOM) { check('text-match fallback (jsdom not installed - SKIPPED)', true, true); }
    else {
      const doc = new JSDOM('<!doctype html><body></body>').window.document;
      const find = (htmlBefore, pendText) => {
        const tmp = doc.createElement('div');
        tmp.innerHTML = htmlBefore;
        const hit = [].slice.call(tmp.querySelectorAll('a')).find(a => {
          const at = (a.textContent || '').trim();
          const href = a.getAttribute('href') || '';
          if (!at || href.indexOf('mp-pending.invalid') !== -1) return false;
          return at.indexOf(pendText) !== -1 || pendText.indexOf(at) !== -1;
        });
        return hit ? hit.getAttribute('href') : null;
      };
      const REAL = 'San Diego <a href="https://real.example/x" ' +
        'style="text-decoration:underline;color:inherit">International</a> (SAN).';
      check('it finds the link whatever the browser did', find(REAL, 'International'), 'https://real.example/x');
      check('never-linked words find nothing', find('San Diego International (SAN).', 'International'), null);
      check('a different link is not offered',
        find('Visit <a href="https://other/y">the museum</a> and Main Street', 'Main Street'), null);
    }
  }
  // An old anchor left beside the new one would wrap the words twice.
  check('a surviving old anchor is unwrapped',
    /while \(was\.el\.firstChild\) parent\.insertBefore\(was\.el\.firstChild, was\.el\);/.test(block), true);

  // Every shape a browser can leave behind.
  {
    const { JSDOM } = (() => { try { return require('jsdom'); } catch (e) { return {}; } })();
    if (!JSDOM) { check('previous-link detection (jsdom not installed - SKIPPED)', true, true); }
    else {
      const PEND = 'https://mp-pending.invalid/link';
      const LINKED = 'Go to <a href="https://real.example/x">our hotel</a> now';
      // fixture is the page BEFORE the link button is pressed; mutate is what
      // the browser does to it. Keeping them apart matters: running the setup
      // after the snapshot made two of these pass without exercising anything.
      const run = (mutate, fixture) => {
        const dom = new JSDOM('<!doctype html><body><div id="h">' +
          (fixture || LINKED) + '</div></body>');
        const doc = dom.window.document, host = doc.getElementById('h');
        const before = [].slice.call(host.querySelectorAll('a'))
          .map(a => ({ el: a, href: a.getAttribute('href') || '' }))
          .filter(x => x.href.indexOf('mp-pending.invalid') === -1);
        mutate(doc, host);
        const pend = [].slice.call(host.querySelectorAll('a'))
          .filter(a => (a.getAttribute('href') || '').indexOf('mp-pending.invalid') !== -1);
        let prev = null;
        for (const was of before) {
          if (prev) break;
          const wasText = (was.el.textContent || '').trim();
          const consumed = !host.contains(was.el) && wasText && pend.some(p => {
            const t = (p.textContent || '').trim();
            return t && (t.indexOf(wasText) !== -1 || wasText.indexOf(t) !== -1);
          });
          if (pend.indexOf(was.el) !== -1 ||
              pend.some(p => p.contains(was.el) || was.el.contains(p)) ||
              consumed) prev = was.href;
        }
        return prev;
      };
      const HREF = 'https://real.example/x';
      check('reused anchor is detected',
        run((d, h) => { h.querySelector('a').setAttribute('href', PEND); }), HREF);
      check('nested new anchor is detected', run((d, h) => {
        const a = h.querySelector('a'), inner = d.createElement('a');
        inner.setAttribute('href', PEND); inner.textContent = a.textContent;
        a.textContent = ''; a.appendChild(inner);
      }), HREF);
      check('wrapping new anchor is detected', run((d, h) => {
        const a = h.querySelector('a'), outer = d.createElement('a');
        outer.setAttribute('href', PEND); a.parentNode.insertBefore(outer, a); outer.appendChild(a);
      }), HREF);
      // NOT "wipe innerHTML and re-add a link over the same words" - that
      // detaches an anchor covering the same text, which is indistinguishable
      // from the browser replacing the link, and is the case above. A real
      // no-previous-link run means linking words that were never linked.
      const OTHER = 'Visit <a href="https://other.example/y">the museum</a> and Main Street';
      check('linking unlinked words reports no previous link', run((d, h) => {
        const t = h.lastChild, na = d.createElement('a');
        na.setAttribute('href', PEND); na.textContent = 'Main Street';
        h.replaceChild(na, t);
      }, OTHER), null);
      // Even when an unrelated link is itself rebuilt in the same pass, which
      // detaches its element too.
      check('an unrelated rebuilt link is not offered', run((d, h) => {
        const old = h.querySelector('a'), rebuilt = d.createElement('a');
        rebuilt.setAttribute('href', 'https://other.example/y');
        rebuilt.textContent = 'the museum';
        h.replaceChild(rebuilt, old);
        const t = h.lastChild, na = d.createElement('a');
        na.setAttribute('href', PEND); na.textContent = 'Main Street';
        h.replaceChild(na, t);
      }, OTHER), null);
      // The shape the console actually showed.
      check('an anchor replaced outright is detected', run((d, h) => {
        const a = h.querySelector('a'), na = d.createElement('a');
        na.setAttribute('href', PEND);
        const sp = d.createElement('span');
        sp.setAttribute('style', 'text-decoration: underline; color: inherit;');
        sp.textContent = a.textContent; na.appendChild(sp);
        a.parentNode.replaceChild(na, a);
      }), HREF);
    }
  }

  // createLink was the one command going without styleWithCSS, so Firefox wrote
  // its own presentation alongside the anchor. The console showed
  //   <font color="rgba(0, 0, 0, 0)"><span style="text-decoration-…"><u><a …>
  // wrapped round the linked words: the <font> IS the colour change, and those
  // wrappers outlive the anchor, so each further attempt added another set and
  // buried any existing link where detection could not see it.
  check('createLink runs with styleWithCSS',
    /execCommand\("styleWithCSS", false, true\); \} catch \(e\) \{\}\s*\n\s*\/\/ The whole point/.test(block), true);
  check('browser link decoration is stripped', /_stripLinkDecoration/.test(block), true);
  // <font> is never ours with styleWithCSS on, so it always goes; <u> only when
  // no link is left inside it.
  check('a surviving link keeps its own markup',
    /if \(el\.tagName !== "FONT" && el\.querySelector\("a"\)\) return;/.test(block), true);
  // Dead link styling: applyLink writes underline + color:inherit onto the
  // anchor, and when the browser dissolves that anchor it keeps the styles as a
  // span - so the words stay underlined and read as a link that is not there.
  // The console showed exactly that span left behind.
  check('dead link styling is removed',
    /text-decoration\\s\*:\\s\*underline/.test(block) && /color\\s\*:\\s\*inherit/.test(block), true);
  check("a span the couple styled is left alone",
    /font-family\|font-size\|background/.test(block), true);

  // The exact markup from the console, cleaned.
  {
    const { JSDOM } = (() => { try { return require('jsdom'); } catch (e) { return {}; } })();
    if (!JSDOM) { check('link decoration strip (jsdom not installed - SKIPPED)', true, true); }
    else {
      const dom = new JSDOM('<!doctype html><body><div id="h"></div></body>');
      const doc = dom.window.document, host = doc.getElementById('h');
      host.innerHTML = 'San Diego <font color="rgba(0, 0, 0, 0)"><span style="x"><u>' +
        '<a href="https://real.example/x">International </a></u></span></font>(SAN)';
      [].slice.call(host.querySelectorAll('font, u')).forEach(el => {
        if (el.tagName !== 'FONT' && el.querySelector('a')) return;
        const p = el.parentNode; if (!p) return;
        while (el.firstChild) p.insertBefore(el.firstChild, el);
        p.removeChild(el);
      });
      check('the font wrapper is removed', host.querySelectorAll('font').length, 0);
      check('the link survives', host.querySelector('a').getAttribute('href'), 'https://real.example/x');
      check('the words are unchanged', host.textContent, 'San Diego International (SAN)');
    }
  }

  // createLink over text that is ALREADY an anchor leaves the browser to
  // reconcile the two - it nests a second anchor or writes an inline colour
  // onto the words, which is the font colour changing on a second link.
  check('an existing link is unlinked before a new one is made',
    /if \(prev\) \{ try \{ _doc\(\)\.execCommand\("unlink"\); \}/.test(block), true);

  // The detection itself, run over every selection shape.
  {
    const { JSDOM } = (() => { try { return require('jsdom'); } catch (e) { return {}; } })();
    if (!JSDOM) { check('link detection (jsdom not installed - SKIPPED)', true, true); }
    else {
      const dom = new JSDOM('<!doctype html><body><div id="h" contenteditable="true">' +
        'Visit <a href="https://old.example/p">our hotel</a> today</div></body>',
        { pretendToBeVisual: true });
      const w = dom.window, doc = w.document;
      const host = doc.getElementById('h'), a = host.querySelector('a');
      const sel = w.getSelection();
      const detect = () => {
        let prev = null;
        for (const node of [sel.anchorNode, sel.focusNode]) {
          if (prev || !node) continue;
          const el = node.nodeType === 1 ? node : node.parentElement;
          const link = el && el.closest ? el.closest('a') : null;
          if (link && host.contains(link)) prev = link.getAttribute('href');
        }
        if (!prev && sel.rangeCount) {
          const range = sel.getRangeAt(0);
          const inside = [].slice.call(host.querySelectorAll('a'))
            .find(x => range.intersectsNode && range.intersectsNode(x));
          if (inside) prev = inside.getAttribute('href');
        }
        return prev;
      };
      const set = (sn, so, en, eo) => {
        const r = doc.createRange(); r.setStart(sn, so); r.setEnd(en, eo);
        sel.removeAllRanges(); sel.addRange(r);
      };
      const t = host.firstChild, at = a.firstChild, tail = host.lastChild;
      const HREF = 'https://old.example/p';
      set(at, 2, at, 5);            check('a selection inside the link finds it', detect(), HREF);
      set(t, 2, at, 4);             check('a selection starting before it finds it', detect(), HREF);
      set(at, 3, tail, 3);          check('a selection ending after it finds it', detect(), HREF);
      set(t, 0, tail, tail.length); check('a selection swallowing it finds it', detect(), HREF);
      set(t, 0, t, 4);              check('plain text finds no link', detect(), null);
    }
  }
}

// ── An empty address must not look like Cancel (MP-350) ───────────────────
// applyLink treated an empty or bare "https://" as a cancel: it closed the
// dialog and dropped the anchor without a word. Every console capture showed
// neither "applied" nor "APPLY FAILED", meaning the function either was not
// reached or fell straight out here - and the couple got no link, no error and
// nothing saved, which is exactly what valueHasLink:false kept reporting.
{
  const block = fs.readFileSync('Website.txt', 'utf8').replace(/\r/g, '');
  const i = block.indexOf('const applyLink =');
  const body = i === -1 ? '' : block.slice(i, block.indexOf('// Enter, done by the browser', i));
  check('an empty address is not treated as a cancel',
    !/if \(!url \|\| url === "https:\/\/"\) \{ _closeLinkPrompt\(\); return; \}/.test(body), true);
  check('it says so instead', /Type a web address first/.test(body), true);
  // The guard must return BEFORE the dialog is dismissed, or the message
  // appears over a dialog that has already gone.
  {
    const guard = body.indexOf('Type a web address first');
    const dismiss = body.indexOf('_prevHref.current = null;\n    setLinkPrompt(null);');
    check('the dialog stays open for the correction', guard !== -1 && dismiss !== -1 && guard < dismiss, true);
  }
  // The Add button reads the box directly if the ref is unset: the input now
  // remounts (its key forces that), so there is an ordering where the ref is
  // null when the click fires.
  check('the address is read even without the ref',
    /querySelector\('input\[type="text"\]'\)/.test(block), true);
}

// ── The unsaved-work guard must ignore links being EDITED ─────────────────
// It runs in the capture phase on the top document and calls preventDefault and
// stopPropagation, so a click on a linked word inside a content box never
// reached the box: no caret was placed, no selection made, and the link button
// then had nothing to work with. That is what "selectionFrom: neither" was in
// every console capture. A link in a content box is text being written, not
// navigation.
{
  const block = fs.readFileSync('Website.txt', 'utf8').replace(/\r/g, '');
  const i = block.indexOf('const handleClick = (e) => {');
  const body = i === -1 ? '' : block.slice(i, i + 1800);
  check('the nav guard skips links inside a content box',
    /anchor\.closest\('\[contenteditable="true"\], \[contenteditable=""\]'\)\) return;/.test(body), true);
  // The skip has to come BEFORE preventDefault, or the click is swallowed
  // anyway.
  {
    const skip = body.indexOf('contenteditable="true"');
    const prevent = body.indexOf('e.preventDefault();');
    check('it skips before the click is swallowed', skip !== -1 && prevent !== -1 && skip < prevent, true);
  }
  {
    const { JSDOM } = (() => { try { return require('jsdom'); } catch (e) { return {}; } })();
    if (!JSDOM) { check('nav guard scope (jsdom not installed - SKIPPED)', true, true); }
    else {
      const d = new JSDOM('<!doctype html><body>' +
        '<div id="box" contenteditable="true">Fly into <a href="https://real/x">SAN</a> airport</div>' +
        '<a id="nav" href="/other-page">Leave</a></body>').window.document;
      const guard = (target) => {
        let el = target;
        while (el && el.tagName !== 'A') el = el.parentElement;
        if (!el) return 'ignored';
        if (el.closest && el.closest('[contenteditable="true"], [contenteditable=""]')) return 'ignored';
        return 'intercepted';
      };
      check('a link being edited is not intercepted', guard(d.querySelector('#box a')), 'ignored');
      // Real navigation must still be guarded, or unsaved work is lost.
      check('a real navigation link is still intercepted', guard(d.getElementById('nav')), 'intercepted');
    }
  }
}

// ── Role fonts: one family per request, no weight list ────────────────────
// loadGoogleFonts asked for 300;400;500;600;700 for every family in ONE
// stylesheet. css2 answers 400 for a weight a family does not have, and a 400
// fails the whole request - so a single single-weight face took every other
// font down with it. Pinyon Script, Great Vibes, Ballet and La Belle Aurore all
// ship one weight, so a template using one lost its headings AND body copy to
// fallbacks. loadContentFonts already worked this out; the role fonts had not.
{
  const rt = fs.readFileSync('site-runtime.js', 'utf8');
  const i = rt.indexOf('function loadGoogleFonts(');
  const body = i === -1 ? '' : rt.slice(i, rt.indexOf('\n  function ', i + 10));
  // Comments stripped: the explanation above the code names wght@, and matching
  // prose made this pass or fail on wording rather than on behaviour.
  const codeOnly = body.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
  check('role fonts request no weight axis', /wght@/.test(codeOnly), false);
  check('each family gets its own stylesheet',
    /data-mp-role-font/.test(body) && /wanted\.forEach/.test(body), true);
  // hydrate runs on every keystroke in the editor.
  check('an unchanged font is not re-requested',
    /if \(have\[href\]\) return;/.test(body), true);
  {
    const { JSDOM } = (() => { try { return require('jsdom'); } catch (e) { return {}; } })();
    if (!JSDOM) { check('font loading (jsdom not installed - SKIPPED)', true, true); }
    else {
      const doc = new JSDOM('<!doctype html><head></head><body></body>').window.document;
      const lift = (sig) => {
        const j = rt.indexOf(sig); let d = 0;
        for (let k = rt.indexOf('{', j); k < rt.length; k++) {
          if (rt[k] === '{') d++;
          else if (rt[k] === '}') { d--; if (!d) return rt.slice(j, k + 1); }
        }
      };
      const load = new Function('document', lift('function loadGoogleFonts(') +
        '\nreturn loadGoogleFonts;')(doc);
      const hrefs = () => [].slice.call(doc.querySelectorAll('link[data-mp-role-font]'))
        .map(l => l.getAttribute('href'));
      load(['Pinyon Script', 'EB Garamond']);
      check('a single-weight face is requested safely',
        hrefs().indexOf('https://fonts.googleapis.com/css2?family=Pinyon+Script&display=swap') !== -1, true);
      check('both families are requested', hrefs().length, 2);
      load(['Pinyon Script', 'EB Garamond']);
      check('a repeat hydrate adds nothing', hrefs().length, 2);
      load(['Lora']);
      check('a template change replaces them', hrefs().length, 1);
    }
  }
}

// ── The unsaved-work guard must not swallow clicks in a content box ───────
// It runs in the capture phase on the top document and calls preventDefault and
// stopPropagation for any link with a real href. A click on a linked WORD in a
// content box therefore never reached the box: no caret, no selection, and the
// link button had nothing to work with. That is what "selectionFrom: neither"
// was reporting.
{
  const block = fs.readFileSync('Website.txt', 'utf8').replace(/\r/g, '');
  const i = block.indexOf('const handleClick = (e) => {');
  const body = i === -1 ? '' : block.slice(i, i + 1800);
  check('links being edited are left alone',
    /anchor\.closest\('\[contenteditable="true"\], \[contenteditable=""\]'\)\) return;/.test(body), true);
  // Navigating away with unsaved work must still be caught.
  check('real navigation is still guarded',
    /setNavGuardModal\(\{/.test(body) && /e\.preventDefault\(\);/.test(body), true);
}

// ── Names fit the box they are in (MP-302, MP-312, MP-313) ────────────────
// Every template sized its couple names with clamp(min, Nvw, max) and nothing
// else, which causes all three tickets. The clamp has a FLOOR - Pressed Petals
// never below 4.5rem - so a long name cannot get small enough for a phone and
// is cut off; no container work fixes a font that refuses to shrink. And vw is
// the IFRAME's width, so the template card, the Live Preview and the real site
// size the same name three different ways. Measuring the rendered text and
// shrinking it to fit answers both: the box decides, not the viewport.
{
  const rt = fs.readFileSync('site-runtime.js', 'utf8');
  const lift = (sig) => {
    const j = rt.indexOf(sig); let d = 0;
    for (let k = rt.indexOf('{', j); k < rt.length; k++) {
      if (rt[k] === '{') d++;
      else if (rt[k] === '}') { d--; if (!d) return rt.slice(j, k + 1); }
    }
    return '';
  };
  check('there is a fitting pass', rt.indexOf('function fitHeroNames(') !== -1, true);
  // It runs during hydrate, before the page is revealed, so the first thing
  // seen is already the right size rather than a large name snapping smaller.
  check('it runs before the reveal',
    rt.indexOf('fitHeroNames();\n    watchHeroNames();') !== -1, true);
  // Re-measured on resize and once the webfonts land: a name measured in the
  // fallback face is measured against the wrong metrics.
  check('it re-measures on resize and after fonts load',
    /addEventListener\('resize', scheduleFitHeroNames\)/.test(rt) &&
    /document\.fonts\.ready\.then\(scheduleFitHeroNames/.test(rt), true);

  // The shrink loop, exercised without a layout engine.
  const shrink = new Function(lift('function _shrinkToFit(') + '\nreturn _shrinkToFit;')();
  // width grows with font size and name length; does it exceed the box?
  const spills = (chars, box) => (px) => (chars * px * 0.5) > box;
  check('a name that already fits is left alone', shrink(72, 30, spills(8, 600)), 72);
  check('a long name on a phone is brought down',
    shrink(72, 30, spills(16, 340)) < 72, true);
  check('and stays above the floor', shrink(72, 30, spills(16, 340)) >= 30, true);
  check('an impossible name stops at the floor', shrink(72, 30, () => true), 30);
  check('the loop never grows the type', shrink(40, 30, () => false), 40);

  // Every template that has hero names must be reachable by the pass.
  const cfgSrc = (rt.match(/var TEMPLATES = \{[\s\S]*?\n  \};/) || [''])[0];
  const T = eval('(' + cfgSrc.replace('var TEMPLATES = ', '').replace(/;$/, '') + ')');
  const unreachable = [];
  for (const [n, cfg] of Object.entries(T)) {
    // Regal Boho shows no names in its hero, so it has nothing to fit.
    if (!cfg.heroNamesId) continue;
    const src = fs.readFileSync('template-' + n + '.html', 'utf8');
    if (src.indexOf('id="' + cfg.heroNamesId + '"') === -1) unreachable.push(n);
  }
  check('every template with hero names has that element', unreachable, []);
}

// ── A single card sits in the middle, not in a stranded track ─────────────
// Hiding a grid column does not remove its TRACK, so the survivor stayed where
// its track was: Heirloom Bloom put Flights on the right with an empty column
// beside it when Accommodations was off. Same shape as the Pressed Petals
// divider. And its single-EVENT path set gridTemplateColumns on a DETACHED node
// and copied back only innerHTML, so that style never reached the page at all.
{
  const hb = fs.readFileSync('template-heirloombloom.html', 'utf8');
  check('one accommodation card collapses the grid',
    /\.accom-inner\.mp-one-col\{grid-template-columns:minmax\(0,1fr\);\}/.test(hb) &&
    /_inner\.classList\.toggle\('mp-one-col', !\(_hasAc&&_hasTr\)\)/.test(hb), true);
  // The count goes on the real grid as an attribute, so the mobile rule can
  // still win - an inline style would outrank it.
  check('the single-event grid is set on the real node',
    /_orig_grid\.setAttribute\('data-event-count'/.test(hb) &&
    /\.wedding-grid\[data-event-count="1"\]\{grid-template-columns:minmax\(0,1fr\);\}/.test(hb), true);
  check('no layout is set on the detached node',
    /grid\.style\.gridTemplateColumns='1fr';/.test(hb), false);

  // Every template that draws a rule between two cards must be able to drop it.
  const stranded = [];
  for (const f of ['template-heirloombloom.html', 'template-pressedpetals.html']) {
    const src = fs.readFileSync(f, 'utf8');
    if (!/mp-one-col/.test(src)) stranded.push(f.replace('template-', '').replace('.html', ''));
  }
  check('both two-card layouts handle a single card', stranded, []);
}

// ── An emptied section goes, chrome and all ───────────────────────────────
// Templates set accommodations and travel from the menu toggle alone, so
// clearing the copy left the section standing with nothing in it. On Golden
// Hour those are split cards with a rule and a border, so the page showed a
// pair of empty framed boxes. Six of the ten had the same toggle-only line, so
// this lives in the runtime: one rule beats six that can drift apart.
{
  const rt = fs.readFileSync('site-runtime.js', 'utf8');
  const i = rt.indexOf('function hideEmptyOptionalSections(');
  const body = i === -1 ? '' : rt.slice(i, rt.indexOf('\n  function ', i + 10));
  check('there is a rule for emptied sections', i !== -1, true);
  // It must only ever HIDE: a section the template hid for its own reasons
  // stays hidden, and nothing here can put one back.
  check('it only ever hides', /style\.display = 'none'/.test(body) &&
    !/style\.display = ''/.test(body), true);
  // undefined/null means never set, and the template's own sample is on screen.
  check('a never-set field keeps the sample copy',
    /if \(v === undefined \|\| v === null\) return;/.test(body), true);
  check('it runs during hydrate', /hideEmptyOptionalSections\(d\);/.test(rt), true);

  {
    const { JSDOM } = (() => { try { return require('jsdom'); } catch (e) { return {}; } })();
    if (!JSDOM) { check('emptied sections (jsdom not installed - SKIPPED)', true, true); }
    else {
      const anchors = (rt.match(/var SECTION_ANCHORS = \{[\s\S]*?\};/) || [''])[0];
      const lift = (sig) => {
        const j = rt.indexOf(sig); let d = 0;
        for (let k = rt.indexOf('{', j); k < rt.length; k++) {
          if (rt[k] === '{') d++;
          else if (rt[k] === '}') { d--; if (!d) return rt.slice(j, k + 1); }
        }
        return '';
      };
      const wrong = [];
      for (const f of fs.readdirSync('.').filter(x => /^template-.*\.html$/.test(x)).sort()) {
        const dom = new JSDOM(fs.readFileSync(f, 'utf8'), { pretendToBeVisual: true });
        const doc = dom.window.document;
        const el = doc.getElementById('accommodations');
        if (!el) continue;                       // not every template has one
        const fn = new Function('document',
          anchors + '\n' + lift('function hideEmptyOptionalSections(') +
          '\nreturn hideEmptyOptionalSections;')(doc);
        const at = (v) => { el.style.display = ''; fn({ accommodation_info: v, travel_info: 'x' });
          return el.style.display === 'none' ? 'hidden' : 'shown'; };
        const n = f.replace('template-', '').replace('.html', '');
        if (at(undefined) !== 'shown') wrong.push(n + ': never-set was hidden');
        if (at('') !== 'hidden') wrong.push(n + ': emptied stayed on screen');
        if (at('<br>') !== 'hidden') wrong.push(n + ': a bare break counted as copy');
        if (at('<strong>Hotel</strong><br>Hyatt') !== 'shown') wrong.push(n + ': real copy was hidden');
      }
      check('every template behaves the same way', wrong, []);
    }
  }
}

// ── Things to Do alternates with the Gallery ──────────────────────────────
// The bands alternate down the page and Things to Do sits directly above the
// Gallery, which is pale - so with the Gallery on, two light bands ended up
// side by side. Gallery ON: Things to Do takes the Wedding band's treatment;
// Gallery OFF: it keeps the Other Events one.
{
  const rt = fs.readFileSync('site-runtime.js', 'utf8');
  const i = rt.indexOf('function styleThingsToDo(');
  const body = i === -1 ? '' : rt.slice(i, rt.indexOf('\n  function ', i + 10));
  check('the runtime says which treatment applies',
    /classList\.toggle\('mp-ttd-alt', !!\(menu && menu\.gallery\)\)/.test(body), true);
  check('it runs during hydrate', /styleThingsToDo\(d\.menu_config \|\| \{\}\);/.test(rt), true);
  // The runtime only names the state - the colours belong to each design, which
  // is why they live in the template. A template with no rule for the class is
  // simply unaffected, so this rolls out one design at a time.
  check('the runtime sets no colours itself',
    /background|color:/.test(body), false);

  // Every design defines the alternate treatment, and each scopes it by ID:
  // most route Things to Do through a class shared with Need to Knows or the
  // FAQs (.ntk-section, .faq-section, .need-to-know), so a class-only rule
  // would repaint that band too.
  const missing = [], unscoped = [];
  for (const f of fs.readdirSync('.').filter(x => /^template-.*\.html$/.test(x)).sort()) {
    const src = fs.readFileSync(f, 'utf8');
    const n = f.replace('template-', '').replace('.html', '');
    if (!/mp-ttd-alt/.test(src)) { missing.push(n); continue; }
    if (!/#things-to-do\.mp-ttd-alt\{background:/.test(src)) unscoped.push(n);
  }
  check('every template defines the alternate treatment', missing, []);
  check('and scopes it to the section id', unscoped, []);

  const pp = fs.readFileSync('template-pressedpetals.html', 'utf8');
  check('Pressed Petals defines the alternate treatment',
    /#things-to-do\.mp-ttd-alt\{background:var\(--olive\);\}/.test(pp), true);
  // Type has to move with the band or it goes dark-on-dark.
  check('and moves its type onto the dark band',
    /#things-to-do\.mp-ttd-alt \.section-title,\s*\n#things-to-do\.mp-ttd-alt \.other-event-detail\{color:var\(--on-dark\);\}/.test(pp), true);
}

// The thumbnails were sent the payload only when localChanges, the celebration
// ID or the selected celebration changed. The ID does NOT change when the
// record's fields do, so partner names edited on the celebration itself never
// re-sent and the template cards kept showing the old ones.
{
  const block = fs.readFileSync('Website.txt', 'utf8').replace(/\r/g, '');
  check('a record change re-sends the payload',
    /* eventOrder may follow: the preview's RSVP form takes its sequence from it. */
    /\}, \[localChanges, celebration, selectedCelebrationId(, eventOrder)?\]\);/.test(block), true);
  check('and no longer keys off the id alone',
    /\[localChanges, celebration\?\.id, selectedCelebrationId\]/.test(block), false);
}

// ── A template switch does not undo the couple's section choices ──────────
// selectTemplate respected only a toggle flipped BY HAND IN THIS SESSION and
// reapplied the new template's defaults over everything else - so switching
// design silently undid choices made and saved earlier. These defaults are a
// starting point, not a description of what a design supports (all ten ship the
// same set), so they belong on a section that has never been set and nowhere
// else. Telling "their choice" from "a default that happened to be saved" is
// the same guess that went wrong with the content defaults; it is not tried.
{
  const block = fs.readFileSync('Website.txt', 'utf8').replace(/\r/g, '');
  const i = block.indexOf('const selectTemplate =');
  const body = i === -1 ? '' : block.slice(i, block.indexOf('applyChanges(additions);', i));
  check('an already-set toggle survives a template switch',
    /const alreadySet =/.test(body) && /if \(alreadySet\) continue;/.test(body), true);
  check('and it no longer keys off this session alone',
    /const setByCouple =/.test(body), false);
  // Both halves matter: saved on the record, or flipped this session.
  check('it checks the record as well as this session',
    /hasOwnProperty\.call\(localChanges, key\) \|\|/.test(body) &&
    /currentData\[key\] !== undefined && currentData\[key\] !== null/.test(body), true);
  {
    const decide = (saved, local) => {
      const cur = { ...saved, ...local };
      return (Object.prototype.hasOwnProperty.call(local, 'showGallery') ||
        (cur.showGallery !== undefined && cur.showGallery !== null))
        ? 'kept' : 'default';
    };
    check('a never-set section takes the new default', decide({}, {}), 'default');
    check('a section saved ON is kept', decide({ showGallery: true }, {}), 'kept');
    check('a section saved OFF is kept', decide({ showGallery: false }, {}), 'kept');
    check('a section flipped this session is kept', decide({}, { showGallery: true }), 'kept');
  }
}

// ── The Gallery is styled like Need to Knows / FAQs ───────────────────────
// Five templates already matched; four put the Gallery on a different ground
// (Black Tie offwhite vs black, Coastal Chic ivory vs navy, Golden Hour white
// vs blue, Heirloom Bloom berry vs offwhite). Pressed Petals is the exception:
// its Need to Knows is a photograph band over a light list, and the Gallery
// already sits on that same light ground.
{
  const bgOf = (src, cls) => {
    const m = src.match(new RegExp('\\n\\.' + cls + '\\{([^}]*)\\}'));
    if (!m) return null;
    const b = m[1].match(/background(?:-color)?:\s*([^;]+)/);
    return b ? b[1].trim() : null;
  };
  const bad = [];
  for (const f of fs.readdirSync('.').filter(x => /^template-.*\.html$/.test(x)).sort()) {
    const src = fs.readFileSync(f, 'utf8');
    const n = f.replace('template-', '').replace('.html', '');
    const gal = bgOf(src, 'gallery-section');
    let faq = null;
    for (const c of ['ntk-section', 'faq-section', 'need-to-know']) {
      const v = bgOf(src, c);
      if (v) { faq = v; break; }
    }
    if (faq === null) continue;          // Pressed Petals' photo band
    // Black Tie is a deliberate exception: its gallery is a "collage variant"
    // declared later in the file on the light offwhite band, and its heading is
    // black to suit. Matching the FAQ band here would have meant white type on
    // offwhite, which is what it was.
    if (n === 'blacktietimeless') continue;
    if (gal !== faq) bad.push(n + ': ' + gal + ' vs ' + faq);
  }
  check('every gallery sits on its FAQ band', bad, []);
  // Repointing a band onto a dark ground without moving the type leaves it
  // dark-on-dark, so each repointed template names its ink too.
  for (const [n, sel] of [['goldenhour', 'gallery-title'],
                          ['heirloombloom', 'gallery-title'],
                          ['coastalchic', 'section-title-mini']]) {
    const src = fs.readFileSync('template-' + n + '.html', 'utf8');
    check(n + ' moves its gallery type with the band',
      new RegExp('\\.gallery-section \\.' + sel + '\\{color:var\\(--').test(src), true);
  }
}

// ── Decoration is not hidden at a common phone width ──────────────────────
// The mobile preview renders at PREVIEW_MOBILE_WIDTH (390). Pressed Petals and
// Modern Minimal hid their right-hand motifs below 400px, so the preview lost
// them - and so did a real 390px iPhone, which is the commonest width there is.
// A slightly wider handset kept them, which is why it looked like a preview
// fault. The left-hand ones stayed either way, so it read as half the
// decoration failing to load. They now shrink at that width and only go below
// 340, where there genuinely is no room.
{
  const block = fs.readFileSync('Website.txt', 'utf8').replace(/\r/g, '');
  const m = block.match(/const PREVIEW_MOBILE_WIDTH\s*=\s*(\d+)/);
  check('the preview width is known', !!m, true);
  const previewW = m ? parseInt(m[1], 10) : 390;

  const bad = [];
  for (const f of fs.readdirSync('.').filter(x => /^template-.*\.html$/.test(x)).sort()) {
    const lines = fs.readFileSync(f, 'utf8').split('\n');
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].replace(/ /g, '').indexOf('display:none') === -1) continue;
      if (!/flower|petal|motif|deco/i.test(lines[i])) continue;
      for (let j = i; j >= 0; j--) {
        const q = lines[j].match(/@media[^{]*max-width:\s*(\d+)px/);
        if (q) {
          // A rule that fires at the preview width also fires on a real phone
          // of that width - that is the bug, not the preview.
          if (parseInt(q[1], 10) >= previewW) {
            bad.push(f.replace('template-', '').replace('.html', '') +
              ' hides decoration under ' + q[1] + 'px');
          }
          break;
        }
        if (lines[j].indexOf('@media') !== -1) break;
      }
    }
  }
  check('no template hides decoration at the preview width', [...new Set(bad)], []);
}

// ── The Gallery heading is editable, and says the same thing everywhere ───
// It was plain text in the Content tab - the one heading on the site a couple
// could not rename - and the designs disagreed about it besides: Pressed Petals
// said "Our Gallery", the other nine "Gallery", with nothing they could do.
{
  const block = fs.readFileSync('Website.txt', 'utf8').replace(/\r/g, '');
  // The RENDER branch, not the auto-off one earlier in the file that shares
  // the same `if (s.needsImages)` opening.
  const i = block.indexOf('if (s.needsImages) {', block.indexOf('const enabledSections ='));
  const body = i === -1 ? '' : block.slice(i, i + 2600);
  check('the gallery heading is an input, like every other section',
    /title=\{\s*<input/.test(body) && /_onHeadingChange\(s\.section/.test(body), true);
  // Same rename plumbing as the rest, so Reset to default and the blank state
  // behave identically.
  check('it uses the same rename plumbing',
    /_headingValue\(s\.section/.test(body) && /_headingBlank\(s\.section\)/.test(body), true);

  const headings = {};
  for (const f of fs.readdirSync('.').filter(x => /^template-.*\.html$/.test(x)).sort()) {
    const src = fs.readFileSync(f, 'utf8');
    const j = src.indexOf('id="gallery"');
    if (j === -1) continue;
    const m = src.slice(j, j + 320).match(/>([A-Za-z][A-Za-z '&]{2,30})</);
    if (m) headings[f.replace('template-', '').replace('.html', '')] = m[1].trim();
  }
  const distinct = [...new Set(Object.values(headings))];
  check('every template heads the gallery the same way', distinct, ['Gallery']);
}

// ── No font is named in a stack that nothing defines ──────────────────────
// Parfumerie Script, Sloop Script Pro and Citadel Script sat in three script
// stacks with no @font-face, no Google link and no entry in CONTENT_FONTS.
// A name like that is not inert: if a visitor happens to have a font of that
// name installed, the browser uses it, so the same page renders differently on
// their machine for reasons nobody can see from the code.
{
  const rt = fs.readFileSync('site-runtime.js', 'utf8');
  const known = new Set([...((rt.match(/var CONTENT_FONTS = \[([\s\S]*?)\];/) || ['', ''])[1])
    .matchAll(/'([^']+)'/g)].map(m => m[1]));
  const ghosts = [];
  for (const f of fs.readdirSync('.').filter(x => /^template-.*\.html$/.test(x)).sort()) {
    const src = fs.readFileSync(f, 'utf8');
    // Self-hosted faces, however the @font-face block is laid out.
    const faces = new Set([...src.matchAll(/@font-face\s*\{[\s\S]*?\}/g)]
      .flatMap(m => [...m[0].matchAll(/font-family:\s*'([^']+)'/g)].map(x => x[1])));
    const linked = new Set([...src.matchAll(/family=([A-Za-z+0-9]+)/g)]
      .map(m => m[1].replace(/\+/g, ' ')));
    // System faces a stack may legitimately reach for.
    const SYSTEM = new Set(['Avenir Next', 'Avenir', 'Georgia', 'Helvetica Neue', 'Times New Roman']);
    for (const m of src.matchAll(/--(?:script|display|body)[a-z-]*:\s*([^;]+);/g)) {
      for (const q of m[1].matchAll(/'([^']+)'/g)) {
        const name = q[1];
        if (faces.has(name) || linked.has(name) || known.has(name) || SYSTEM.has(name)) continue;
        ghosts.push(f.replace('template-', '').replace('.html', '') + ': ' + name);
      }
    }
  }
  check('no stack names a font nothing defines', [...new Set(ghosts)], []);
}

// ── One dotted rule, above the brand footer ───────────────────────────────
// The footer drew a rule above AND below itself. On most designs the footer
// ground differs from the band above, so the top one read as "the line above
// the footer" and the bottom one went unnoticed at the edge of the page. On
// Modern Minimal the footer sits on the same blue as the RSVP band above it, so
// the top rule vanished into it and the only line visible was the one
// UNDERNEATH - the same element, reading as though the pattern had moved.
{
  const rt = fs.readFileSync('site-runtime.js', 'utf8');
  const i = rt.indexOf('function brandFooterHtml');
  const body = i === -1 ? '' : rt.slice(i, i + 1600);
  check('the footer draws exactly one rule', (body.match(/mp-bf-rule/g) || []).length, 1);
  check('and none below it', /mp-bf-rule bottom/.test(body), false);
}

// Heirloom Bloom put a 50px gold hairline under Our Story and Gallery and under
// no other heading, which read as those two being underlined.
{
  const hb = fs.readFileSync('template-heirloombloom.html', 'utf8');
  check('no stray rule under Our Story', /<div class="section-rule-gold"><\/div>/.test(hb), false);
  check('no stray rule under Gallery', /<div class="gallery-rule"><\/div>/.test(hb), false);
}

// Modern Minimal's hero decorations. Under 640px .hero-pair becomes a grid and
// its photos stack, so a deco anchored to `bottom` landed below BOTH of them -
// a stray motif under the last picture rather than beside the hero.
{
  const mm = fs.readFileSync('template-modernminimal.html', 'utf8');
  // Anchored to the top, and by a PROPORTION. .hero-pair is a grid of two
  // stacked photos at this width and its height changes with the screen, so a
  // fixed offset is only right at one size: 70px sat by the couple's heads,
  // 300px hung below the picture. A percentage lands in the same part of the
  // first photo at any width.
  check('the left deco is anchored to the top on a phone',
    /\.hero-deco-left\{[\s\S]*?top:\d+%;bottom:auto;/.test(mm), true);
  check('and not by a fixed offset',
    /\.hero-deco-left\{[\s\S]*?top:\d+px;bottom:auto;/.test(mm), false);
  check('and no longer to the bottom',
    /\.hero-deco-left\{left:-14px;top:auto;bottom:-18px;/.test(mm), false);
  check('the glasses are large enough to read',
    /\.hero-deco-right\{[\s\S]*?width:96px;\}/.test(mm), true);
}

// ── The registry preview is ONE ROW, and nothing else ─────────────────────
// It was capped at 12, which stacked three or four rows of gifts into a section
// whose job is to say "we have a registry" - and then carried a "see all gifts"
// link to excuse its own length, pointing at the very page the section's own
// button already goes to. Two links, one destination, stacked.
{
  const rt = fs.readFileSync('site-runtime.js', 'utf8');
  const i = rt.indexOf('function hydrateRegistryPreview');
  const body = i === -1 ? '' : rt.slice(i, rt.indexOf('\n  function ', i + 10));
  // Cloning still has to happen - the runtime builds a one-card grid for the
  // nine templates that ship none, so without it they show a single gift.
  check('cards are cloned up to the row', /cloneNode\(true\)/.test(body), true);
  check('the preview stops at one row', /REG_PREVIEW_MAX = 4;/.test(body), true);
  /* Four placeholders, always. Building ONE and relying on the gift fetch to
     clone it up meant a registry that returns nothing, is gated, or is still
     loading showed a single lonely tile where a template shipping its own
     markup showed a row of four. applyRegistry hides the cards it has no gift
     for, so four costs nothing when there are fewer. */
  check('the built grid starts as a full row',
    /ensureRegistryGrid\(4\);/.test(rt), true);
  check('and no longer depends on the slug for its width',
    /ensureRegistryGrid\(\(d && d\.slug\) \? 1 : 4\)/.test(rt), false);
  // No gifts used to return with the template's PLACEHOLDER cards still on
  // screen - four stock gift tiles on a couple's wedding site. That is also the
  // "link only" shape, for a couple pointing guests at a shop elsewhere.
  check('no gifts means no sample tiles',
    /if \(!all\.length\) \{[\s\S]*?cards\[z\]\.style\.display = 'none';/.test(body), true);
  // The redundant second link is gone, function and stylesheet with it.
  check('no see-all-gifts link is built', /addRegistryMore/.test(rt), false);
  check('and its styling went with it', /mp-reg-more/.test(rt), false);

  const css = rt.slice(rt.indexOf('function injectPreviewStyles'), rt.indexOf('function renderPreviewCard'));
  // minmax(0,1fr), not 1fr: a 1fr track will not shrink below its content's
  // minimum width, so a wide Purchase button pushed the second column off the
  // right edge and the page scrolled sideways.
  check('a phone gets two columns that can shrink',
    /#registryGrid\{display:grid!important;grid-template-columns:repeat\(2,minmax\(0,1fr\)\)!important/.test(css), true);
  check('and the cards may go narrower than their buttons',
    /min-width:0!important/.test(css), true);
  // The templates size these cards for a desktop row, so the card's own width
  // and flex have to be overridden or the columns collapse again.
  check('and the card sizing is overridden with it',
    /#registryGrid \.registry-card\{width:auto!important/.test(css), true);

  // ── The Purchase CTAs line up, and wear the design's colour ────────────
  // A gift whose name wrapped to two lines pushed its button below its
  // neighbours', so the row read as ragged. Equal-height cards plus an auto
  // top margin pins every CTA to the same baseline whatever the name does.
  // Every grid, not only a built one - a template shipping its own had cards at
  // their natural height, so its buttons sat wherever the card above them ended.
  check('cards are equal height, not their natural height',
    /#registryGrid\{align-items:stretch\}/.test(css), true);
  check('so the buttons share one baseline',
    /#registryGrid \.registry-card\{display:flex;flex-direction:column;height:100%\}/.test(css) &&
    /#registryGrid \.registry-buy-btn\{margin-top:auto/.test(css), true);
  // currentColor gave all ten designs the same grey pill. The accent comes from
  // the same map the rest of the runtime themes from, so it cannot drift.
  check('the CTA takes the template accent, not a browser default',
    /var _cv = TEMPLATE_COLOR_VARS\[TID\] \|\| \{\};/.test(css) &&
    /_cv\.accent \? 'var\(' \+ _cv\.accent \+ '\)' : 'currentColor'/.test(css), true);
  check('and both its ink and its border use it',
    /color:' \+ _btnInk \+ ';border:1px solid ' \+ _btnInk \+ ';/.test(css), true);

  // The cloning, exercised against the real cap read out of the runtime.
  {
    const { JSDOM } = require('jsdom');
    const CAP = Number((rt.match(/REG_PREVIEW_MAX = (\d+);/) || [])[1]);
    check('the cap is a real number', Number.isFinite(CAP) && CAP > 0, true);
    const doc = new JSDOM('<!doctype html><body><div id="registryGrid">' +
      Array(4).fill('<div class="registry-card"><img><a></a></div>').join('') +
      '</div></body>').window.document;
    const grid = doc.getElementById('registryGrid');
    const run = (total) => {
      grid.querySelectorAll('[data-mp-reg-clone]').forEach(e => e.remove());
      let cards = grid.querySelectorAll('.registry-card');
      const want = Math.min(total, CAP), first = cards[0];
      for (let n = cards.length; n < want; n++) {
        const c = first.cloneNode(true);
        c.setAttribute('data-mp-reg-clone', '1');
        first.parentNode.appendChild(c);
      }
      return grid.querySelectorAll('.registry-card').length;
    };
    check('fewer gifts than cards adds none', run(3), 4);
    // The point of the change: a big registry no longer stacks rows.
    check('nine gifts still show one row', run(9), CAP);
    check('twenty stop at the same row', run(20), CAP);
    check('and nothing is ever appended past it',
      (run(20), doc.querySelectorAll('#registryGrid > :not(.registry-card)').length), 0);
  }
}

// ── Every hero slot gets one of the couple's own photographs ──────────────
// Designs with a fixed row - Modern Minimal's three, Golden Hour's three - take
// hero_images in order and leave any slot they run out for on the template's
// SAMPLE picture. A couple who uploaded one photo published a site with two
// stock ones beside it, and nothing said so. Cycling what they gave us fills
// every slot with something of theirs: repetition is their own picture, which
// is theirs to repeat; a stock photograph is not licensed for their live site.
{
  const rt = fs.readFileSync('site-runtime.js', 'utf8');
  check('fixed-slot designs declare their count',
    (rt.match(/heroSlots: 3,/g) || []).length, 2);
  check('the runtime fills the slots before hydrating',
    /var _slots = CFG\.heroSlots \|\| 0;/.test(rt) &&
    /_filled\.push\(_rest\[\(_i - 1\) % _rest\.length\]\)/.test(rt), true);
  // A carousel takes as many as it is given; padding would loop one photo.
  check('a design without a fixed count is not padded',
    /if \(_slots > 1 && _own\.length && _own\.length < _slots\)/.test(rt), true);
  {
    const fill = (slots, own) => {
      if (!(slots > 1 && own.length && own.length < slots)) return own;
      /* MP-942: the hero first, then the OTHER photographs; the hero repeats
         only when it is the only one. */
      const rest = own.length > 1 ? own.slice(1) : own;
      const out = [own[0]];
      for (let i = 1; i < slots; i++) out.push(rest[(i - 1) % rest.length]);
      return out;
    };
    check('one photo fills three slots', fill(3, ['a']), ['a', 'a', 'a']);
    check('two photos: the second repeats, not the hero', fill(3, ['a', 'b']), ['a', 'b', 'b']);
    check('three are used once each', fill(3, ['a', 'b', 'c']), ['a', 'b', 'c']);
    check('more than the slots is left alone', fill(3, ['a', 'b', 'c', 'd']), ['a', 'b', 'c', 'd']);
    check('no photos stays empty, so the gate still blocks', fill(3, []), []);
    check('a carousel is never padded', fill(0, ['a']), ['a']);
  }
}

// ── The stitched rule is visible on a dark footer ─────────────────────────
// A flat rgba(ink, 0.22) was set for the pale footers this started with. On a
// saturated dark ground the same alpha disappears - Modern Minimal's footer
// sits on its blue and the pattern above it could not be seen at all. Tying the
// alpha to the ground fixes every dark footer rather than exempting one.
{
  const rt = fs.readFileSync('site-runtime.js', 'utf8');
  check('the rule alpha follows the footer ground',
    /rule: rgba\(ink, relLuminance\(bg\) < 0\.4 \? 0\.7 : 0\.22\)/.test(rt), true);
  check('it is no longer a flat value', /rule: rgba\(ink, 0\.22\),/.test(rt), false);
}

// ── Golden Hour: stray rules, and one heading heavier than the rest ───────
// Same 50px hairline under Our Story and Gallery as Heirloom Bloom had. And the
// markup is inconsistent about the tag - Things to Do is an <h2> while the rest
// are <div>s - so with no font-weight declared, the browser's default bold
// applied to that heading alone.
{
  const gh = fs.readFileSync('template-goldenhour.html', 'utf8');
  check('no stray rule under Our Story', /<div class="story-rule"><\/div>/.test(gh), false);
  check('no stray rule under Gallery', /<div class="gallery-rule"><\/div>/.test(gh), false);
  check('every heading names its weight',
    /\.story-title,\.ntk-title,\.gallery-title,\.registry-title,\.rsvp-title\{font-weight:400;\}/.test(gh), true);
}

// No template should leave a heading's weight to the tag: the same class is
// used on an <h2> in one place and a <div> in another, and only one of them
// comes out bold.
{
  const mixed = [];
  for (const f of fs.readdirSync('.').filter(x => /^template-.*\.html$/.test(x)).sort()) {
    const src = fs.readFileSync(f, 'utf8');
    const tagOf = {};
    for (const m of src.matchAll(/<(h1|h2|h3|div)[^>]*class="([a-z-]*title[a-z-]*)"/g)) {
      (tagOf[m[2]] = tagOf[m[2]] || new Set()).add(m[1]);
    }
    for (const cls in tagOf) {
      if (tagOf[cls].size < 2) continue;              // one tag, nothing to differ
      // (^|[.,\s]) - a rule at the start of a line has no . or , before it, and
      // Heirloom Bloom's was missed that way on the first run.
      const rule = src.match(new RegExp('(^|[.,\\s])\\.' + cls + '[^{}]*\\{[^}]*font-weight', 'm'));
      if (!rule) mixed.push(f.replace('template-', '').replace('.html', '') + ': .' + cls);
    }
  }
  check('a class used on two different tags declares its weight', mixed, []);
}

// ── The registry note is written, not appended ────────────────────────────
// Modern Minimal pushed the couple's registry words in with
// insertAdjacentHTML('afterbegin') on the CTA wrapper, and hydrate runs on
// every keystroke in the preview - so the note stacked up, one copy per
// keypress, each holding what had been typed so far: "thanks", "thank",
// "than", "tha" down the page, below the last gift.
{
  const mm = fs.readFileSync('template-modernminimal.html', 'utf8');
  check('the note has an element of its own', /id="registryInfo"/.test(mm), true);
  check('it is assigned, not appended',
    /noteEl\.innerHTML = d\.registry_info;/.test(mm) &&
    !/ctaWrap\.insertAdjacentHTML\('afterbegin'/.test(mm), true);
  // Cleared each pass, or the last thing typed lingers after the copy is
  // deleted.
  check('it is cleared before being rewritten',
    /if \(_note\) _note\.innerHTML = '';/.test(mm), true);
  // Under the heading, above the gifts - which is where a note like "we are
  // registered at..." belongs.
  check('it sits above the gift grid',
    mm.indexOf('id="registryInfo"') < mm.indexOf('id="registryGrid"'), true);
}

// ── Show gifts, or just a link ────────────────────────────────────────────
{
  const block = fs.readFileSync('Website.txt', 'utf8').replace(/\r/g, '');
  const rt = fs.readFileSync('site-runtime.js', 'utf8');
  check('the new column is mapped in both places',
    (block.match(/showRegistryPreview: "yikz2",/g) || []).length, 2);
  // In the editor's own toolbar, beside the block button - both act on this
  // box's content, so that is where it belongs rather than above the box.
  check('the toggle is an editor control',
    /extraControl=\{s\.section === "registry" \? \(/.test(block) &&
    /Include preview/.test(block), true);
  // Only one of the ten ships a grid in its markup, so on the other nine the
  // switch had nowhere to put anything. The runtime builds the grid instead of
  // nine templates each growing their own and drifting apart.
  {
    const rt = fs.readFileSync('site-runtime.js', 'utf8');
    check('the runtime builds a grid where there is none',
      /function ensureRegistryGrid\(/.test(rt) &&
      /grid = grid \|\| ensureRegistryGrid\(\);/.test(rt), true);
    // On the LIVE path, only once there are gifts to put in it: a grid built up
    // front is empty until they are fetched, which showed as one blank card
    // with a Purchase link under it.
    check('it is not built before the gifts are fetched',
      rt.indexOf('grid = grid || ensureRegistryGrid();') >
      rt.indexOf('var slug = window._weddingSlug'), true);
    // The editor fetches the couple's real gifts too: the slug is in the
    // payload, and this used to read it off the URL, which the editor's iframe
    // has not got.
    check('the slug is taken from the payload',
      /var slug = window\._weddingSlug \|\| _liveSlug \|\| \(d && d\.slug\) \|\| '';/.test(rt), true);
    // Scoped to this function: lookupGuest has its own _isPreview bail-out and
    // keeps it, since guest lookup is not something to run from the editor.
    {
      const j = rt.indexOf('function hydrateRegistryPreview');
      const body = rt.slice(j, rt.indexOf('\n  function ', j + 10));
      check('and the preview no longer bails out before fetching',
        /if \(_isPreview\) return;/.test(body), false);
    }
    // In the EDITOR the fetch is skipped entirely, so the grid is built with
    // placeholder cards - otherwise a design without its own grid showed
    // nothing while Modern Minimal, which ships sample cards, showed a preview,
    // and the same switch appeared to stop working on switching template.
    // A full row either way now: with a slug it used to build ONE and rely on
    // the fetch to clone it up, so a gated or empty registry showed one tile.
    /* Read through _flagOff now: the column is absent on the live site, so the
       switch is carried in custom_css as well - see MP-908. */
    check('the editor gets placeholder cards without a slug',
      /if \(!grid && _isPreview && !_flagOff\(d, 'registry_preview', 'registry-preview'\)\) \{/.test(rt) &&
      /ensureRegistryGrid\(4\);/.test(rt), true);
  }

  // The footer reaches the window edges whatever frame the page sits in. Modern
  // Minimal draws a 14px frame with body{border}, and a plain width:100% stopped
  // inside it, leaving a thin line of page background down each side.
  {
    const rt = fs.readFileSync('site-runtime.js', 'utf8');
    check('the footer is full-bleed',
      /width:100vw;max-width:100vw;margin-left:calc\(50% - 50vw\)/.test(rt), true);
    check('and no longer a plain width:100%',
      /\.mp-brand-footer\{[^']*width:100%;/.test(rt), false);
    /* BESIDE the registry section, not inside it. Four cards injected into the
       section made it far taller, and a design whose decoration is anchored to
       its own box came apart - Heirloom Bloom's corner flourishes slid into the
       middle of the gifts, Sage & Still's background image stretched. The
       section is finished artwork; the preview is an addition after it. */
    check('the preview is its own band after the section',
      /sec\.parentNode\.insertBefore\(band, sec\.nextSibling\)/.test(rt), true);
    check('and is no longer injected inside it',
      /copy\.parentNode\.insertBefore\(grid, copy\.nextSibling\)/.test(rt), false);
    check('the grid still lives inside that band',
      /band\.appendChild\(grid\);/.test(rt), true);
    // A registry switched off in Design hides the section; a stray row of gifts
    // beneath a hidden section would be worse than no preview at all.
    check('the band follows the section it belongs to',
      /_syncRegistryBand\(\);/.test(rt), true);
    check('and can find both on a later hydrate',
      /if \(!band\) band = document\.getElementById\('mp-reg-band'\);/.test(rt), true);
    // A built grid has none of the template's card styling, so it gets its own.
    check('a built grid is styled', /#registryGrid\[data-mp-built\]\{display:grid/.test(rt), true);
    /* Its card STYLING is still left alone - only the position changes. A
       template shipping its own grid kept it inside the registry section, above
       the View Our Registry button, so that one design put the gifts before the
       button while every other put them after. */
    check('a shipped grid is lifted into the band too',
      /_liftRegistryGrid\(grid\);/.test(rt), true);
    check('and its own styling is untouched',
      /#registryGrid\[data-mp-built\]/.test(rt) &&
      !/_liftRegistryGrid[\s\S]{0,600}?setAttribute\('data-mp-built'/.test(rt), true);
    check('lifting twice is a no-op',
      /if \(band && band\.contains\(grid\)\) return;/.test(rt), true);
  }
  check('the editor renders it in its toolbar',
    /\{extraControl\}/.test(block), true);
  // A switch, matching the section toggles in the Design tab - the same kind of
  // on/off decision - rather than a checkbox.
  check('it is a switch, not a checkbox',
    /borderRadius: "999px"/.test(block) && !/type="checkbox"[\s\S]{0,200}showRegistryPreview/.test(block), true);
  // Default ON: the column is empty for everyone created before it existed, and
  // a couple who has added gifts expects to see them. Only an explicit false
  // turns it off.
  check('it defaults to showing the gifts',
    /currentData\.showRegistryPreview !== false \? "#4B5244"/.test(block) &&
    /registry_preview: d\.showRegistryPreview !== false,/.test(block), true);
  // The sample tiles ship in the template's markup, so the setting has to be
  // read BEFORE the editor-preview bail-out or the toggle does nothing there.
  // The sample tiles ship in the template's markup, so the setting has to be
  // read - and undone - BEFORE the editor-preview bail-out, or the toggle does
  // nothing there in either direction.
  // The sample tiles ship in the template's markup, so the setting has to be
  // read - and undone - before anything else happens.
  check('the setting is honoured in the editor preview too',
    /if \(_flagOff\(d, 'registry_preview', 'registry-preview'\)\) \{[\s\S]{0,400}tiles\[u\]\.style\.display = '';/.test(rt), true);
  check('the runtime honours it',
    /_flagOff\(d, 'registry_preview', 'registry-preview'\)/.test(rt), true);
}

// ── The RSVP line, in the couple's own words ──────────────────────────────
// Each template words this differently and the runtime only ever swapped the
// DATE into that wording, so a couple who wanted to say something else had no
// way to. Stored beside the date in the same RSVP Info JSON - no new column.
{
  const block = fs.readFileSync('Website.txt', 'utf8').replace(/\r/g, '');
  const rt = fs.readFileSync('site-runtime.js', 'utf8');
  // In the section's own editor now, like every other section - it sat in RSVP
  // Settings as a bare input, so RSVP alone said it had "no text to edit". The
  // separate date control went with it: the line is written in full, so a date
  // field was a second way to say the same thing and the two could disagree.
  check('the RSVP line has the same editor as other sections',
    /s\.section === "rsvp" \? \(/.test(block) && /value=\{_rsvpNote\}/.test(block), true);
  check('and no duplicate controls are left in Settings',
    /cfg\.note/.test(block) || /cfg\.deadline/.test(block), false);
  // Stored in the RSVP Info JSON beside the entree choices - no new column.
  check('it is stored without a column of its own',
    /_saveRsvpNote = \(v\) => handleUpdate\("rsvpInfo"/.test(block), true);
  /* Read through _noteHtml now: the box produces HTML, so a cleared one holds
     a filler <br> rather than '' and has to be recognised as empty before the
     deadline fallback can be reached. */
  check('the runtime prefers it over the template wording',
    /var note = _noteHtml\(\(d\.rsvp_config && d\.rsvp_config\.note\) \|\| ''\);/.test(rt), true);
  // It runs inside hydrate, not a helper of its own: an early return here would
  // have skipped the mobile drawer, the footer and everything after it.
  check('and does not return out of hydrate',
    /deadlineEl\.innerHTML = note;\s*\n\s*deadlineEl\.style\.display = '';\s*\n\s*\} else \{/.test(rt), true);
  {
    const line = (cfg, tpl) => {
      const note = (cfg && cfg.note) || '', deadline = (cfg && cfg.deadline) || '';
      if (note && note.trim()) return note.trim();
      if (deadline) { const lead = tpl.match(/^(.*\bby\s+)/i); return (lead ? lead[1] : 'by ') + 'DATE'; }
      return tpl;
    };
    const T = 'Please let us know if you can make it by July 1st, 2027';
    check('nothing set keeps the template wording', line({}, T), T);
    check('a date keeps the wording and swaps the date',
      line({ deadline: '2027-07-01' }, T), 'Please let us know if you can make it by DATE');
    check('their own sentence replaces the line',
      line({ note: 'Reply by 1 July, please!' }, T), 'Reply by 1 July, please!');
  }
}

// A block comment sitting directly among JSX children is NOT a comment - it is
// text, and it renders. One of mine printed itself above every section's editor
// in the Content tab.
{
  const block = fs.readFileSync('Website.txt', 'utf8').replace(/\r/g, '');
  const lines = block.split('\n');
  const bare = [];
  for (let i = 0; i < lines.length; i++) {
    if (!/^\s{24,}\/\*/.test(lines[i])) continue;   // deep indent = inside JSX
    if (/\{\/\*/.test(lines[i])) continue;           // properly braced
    // An attribute list is fine: a comment there is inside the tag, not among
    // the children.
    let inTag = false;
    for (let j = i - 1; j > i - 12 && j >= 0; j--) {
      if (/^\s*<[A-Za-z]/.test(lines[j])) { inTag = !/>\s*$/.test(lines[j]); break; }
      if (/^\s*(return|\}|\)|\{)/.test(lines[j])) break;
    }
    // And a comment opening a JS callback body is ordinary JavaScript, not JSX
    // children: `.map(role => {` then a comment is fine.
    const prev = (lines[i - 1] || '').trim();
    const inCallback = /=>\s*\{$/.test(prev) || /\{$/.test(prev) && !/^<|>$/.test(prev);
    if (!inTag && !inCallback) bare.push((i + 1) + ': ' + lines[i].trim().slice(0, 46));
  }
  check('no unbraced block comment among JSX children', bare, []);
}

// A template's own motif must not be resized by a rule meant for its photograph.
// Moving Modern Minimal's decorations into .hero-image-wrap - so their offsets
// are measured against the picture - put them in reach of `img{width:100%}`, and
// a 150px motif rendered at the full width of the hero.
{
  const mm = fs.readFileSync('template-modernminimal.html', 'utf8');
  check('the photo rule skips the decorations',
    /\.hero-image-wrap img:not\(\.hero-deco\)\{/.test(mm), true);
  check('and no unscoped img rule is left in that wrapper',
    /\.hero-image-wrap img\{/.test(mm), false);
}

// A gallery repointed onto its FAQ band needs its heading colour to WIN. Mine
// sat above the base rule for the same class, so the base colour applied and the
// heading was invisible against its own band - navy on navy in Coastal Chic.
{
  const bad = [];
  for (const [n, sel] of [['coastalchic', 'section-title-mini'], ['blacktietimeless', 'gallery-title'],
                          ['goldenhour', 'gallery-title'], ['heirloombloom', 'gallery-title']]) {
    const src = fs.readFileSync('template-' + n + '.html', 'utf8');
    const mine = [...src.matchAll(new RegExp('\\.gallery-section \\.' + sel + '\\{', 'g'))].map(m => m.index);
    const base = [...src.matchAll(new RegExp('\\n\\.' + sel + '\\{', 'g'))].map(m => m.index);
    if (!mine.length) { bad.push(n + ': no gallery heading colour'); continue; }
    if (base.length && Math.max(...mine) < Math.max(...base)) bad.push(n + ': base rule wins');
  }
  check('every repointed gallery heading wins the cascade', bad, []);
}

// Switching the registry preview back ON must restore the tiles. Turning it off
// set display:none inline and nothing ever cleared it, so switching on again did
// nothing at all - the couple turned the preview on and the section stayed empty.
{
  const rt = fs.readFileSync('site-runtime.js', 'utf8');
  check('the tiles are put back when the preview is on',
    /for \(var u = 0; u < tiles\.length; u\+\+\) tiles\[u\]\.style\.display = '';/.test(rt), true);
}

// The RSVP box needs no explanatory line: it behaves like every other section's.
{
  const block = fs.readFileSync('Website.txt', 'utf8').replace(/\r/g, '');
  check('no leftover RSVP hint', /Shown above your RSVP form/.test(block), false);
}

// Golden Hour's template card composites its hero as three background layers,
// because the real columns are hidden in thumbnail mode. Those layers have to
// carry the SAME proportions as the live grid - a flat 33.33% each made the
// middle photograph as wide as its neighbours, so the card showed a layout the
// site never uses.
{
  const gh = fs.readFileSync('template-goldenhour.html', 'utf8');
  const grid = gh.match(/grid-template-columns:\s*1fr\s+([\d.]+)fr\s+1fr/);
  check('the live hero grid is a 1 : n : 1 split', !!grid, true);
  if (grid) {
    const mid = parseFloat(grid[1]);
    const side = +(1 / (2 + mid) * 100).toFixed(1);
    const centre = +(mid / (2 + mid) * 100).toFixed(1);
    const sizes = gh.match(/background-size:\s*([\d.]+)% 100%, ([\d.]+)% 100%, ([\d.]+)% 100%!important/);
    check('the thumbnail composites at those proportions',
      !!sizes && Math.abs(parseFloat(sizes[1]) - side) < 0.5
             && Math.abs(parseFloat(sizes[2]) - centre) < 0.5
             && Math.abs(parseFloat(sizes[3]) - side) < 0.5, true);
    check('and no longer at three equal thirds',
      /background-size:33\.33% 100%, 33\.33% 100%, 33\.33% 100%/.test(gh), false);
  }
}

// ── Nothing paints over the brand footer ──────────────────────────────────
// Modern Minimal's RSVP band ends with margin-bottom:-14px and position:relative
// so it can reach into the page's blue frame. That drags the footer up beneath
// it and, being positioned, the band painted on top - covering exactly the 8px
// stitch at the footer's top edge. The dot contrast was raised twice for
// nothing: the line was never visible whatever colour it was.
{
  const rt = fs.readFileSync('site-runtime.js', 'utf8');
  check('the footer sits above a band that overlaps it',
    /'\.mp-brand-footer\{position:relative;z-index:1;/.test(rt), true);
}

// ── Coastal Chic: the couple's own headings, in the right order ───────────
// It rendered travel BEFORE accommodations, so the page said Flights above
// Hotel while the Content tab said the opposite. And _renderRichTravel was
// handed 'Airport' and 'Hotel' as labels which it applied OVER whatever the
// couple had written, folding their heading down into the body - a word nobody
// typed appearing above their own.
{
  const cc = fs.readFileSync('template-coastalchic.html', 'utf8');
  // The RENDER calls, not the earlier visibility check that also names both.
  check('accommodations are rendered before travel',
    cc.indexOf('_mpColParts(d.accommodation_info') <
    cc.indexOf('_mpColParts(d.travel_info'), true);
  check("a heading in the copy is not overridden",
    /if \(!label && out\.length === 0 && fallbackLabel\) label = fallbackLabel;/.test(cc), true);
  check('no fixed Airport label is passed in',
    /_renderRichTravel\(d\.travel_info, 'Airport'\)/.test(cc), false);
  // The room-block line was built from the couple's names when they had not
  // written one - invented copy on their own wedding site.
  check('the room-block line is no longer invented',
    /'<br><em>\*Request the ' \+ _names/.test(cc), false);

  {
    const { JSDOM } = (() => { try { return require('jsdom'); } catch (e) { return {}; } })();
    if (!JSDOM) { check('coastal chic travel (jsdom not installed - SKIPPED)', true, true); }
    else {
      const dom = new JSDOM(cc, { runScripts: 'dangerously', pretendToBeVisual: true });
      const w = dom.window, doc = w.document;
      w._reveal = function () {};
      try {
        w.hydrateTemplate({ couple_names: 'A & B',
          accommodation_info: '<strong>Hotel</strong><br>Hyatt Regency',
          travel_info: '<strong>Flights</strong><br>San Diego International',
          menu_config: { accommodations: true, travel: true }, events: [] });
      } catch (e) {}
      const labels = [...doc.querySelectorAll('.travel-block-label')].map(e => e.textContent.trim());
      check('the blocks read Hotel then Flights', labels, ['Hotel', 'Flights']);
    }
  }
}

// ── The box marks a block label the way the DESIGN does ───────────────────
// A titleLine section's first line is a block label, not a section heading, and
// the two are not styled alike: Pressed Petals sets those labels in its script
// face, Coastal Chic in bold uppercase body. The editor marked every one in the
// heading face, so on Coastal Chic the box showed flowing script where the page
// showed bold caps.
{
  const rt = fs.readFileSync('site-runtime.js', 'utf8');
  const block = fs.readFileSync('Website.txt', 'utf8').replace(/\r/g, '');
  // TWO styles, reported apart: a block LABEL is the "Hotel"/"Flights" over the
  // accommodation columns, a block TITLE is an event name or an FAQ question,
  // and a design can set them differently.
  check('the runtime reports both label and title style',
    /labelStyle: _labelStyle, titleStyle: _titleStyle/.test(rt), true);
  // Read off the rendered element, not guessed from a table - the label class
  // differs per template.
  check('it reads it from the rendered page',
    /\.travel-block-label,\.accom-col-title,\.accom-card-title/.test(rt), true);
  // THREE styles now, not two. Event names and FAQ questions were sampled from
  // one selector list, so whichever element came first in the document spoke for
  // both: Black Tie sets event names in script at clamp(2rem,4vw,3rem) and
  // questions in bold serif at 1.1rem, so the Content box marked questions in a
  // script the page never used. blockNoun says which box is which.
  check('questions are reported apart from event names',
    /questionStyle: _questionStyle/.test(rt), true);
  /* One at a time, text element first: querySelector returns document order,
     so the list form found Pressed Petals' <button> and reported Arial. */
  check('and sampled from their own selectors',
    /\['\.faq-q-text', '\.ntk-question', '\.faq-q', '\.faq-question'\]\.some\(/.test(rt), true);
  check('the event list no longer claims to speak for questions',
    (/var _titleStyle = _styleOf\(([\s\S]*?)\);/.exec(rt) || [0, ''])[1]
      .replace(/\/\*[\s\S]*?\*\//g, '').includes('faq'), false);
  check('the editor picks the right one per section',
    /blockNoun === "question" \? \(questionStyle \|\| titleStyle\)/.test(block), true);
  // Face and weight alone left italic, size and ink to drift.
  check('slant and ink are reported too',
    /italic: cs\.fontStyle \|\| '',/.test(rt) && /color: cs\.color \|\| ''/.test(rt), true);
  /* Weight and slant ride on attributes now (data-tw / data-ti, turned into
     CSS by editorCss): stated inline, the browser read the mark's weight as
     "not bold" and un-bolding one title stripped the others. Ink stays inline. */
  check('and the box wears them',
    /caps \+ ink \+ 'font-family/.test(block) && /' data-tw="' \+ tw \+ '"' \+ \(ti \? ' data-ti="' \+ ti \+ '"' : ''\)/.test(block), true);
  // Coastal Chic is why both are needed: it sets block titles AND labels in bold
  // uppercase body, where every other design uses its script or display face.
  {
    const cc = fs.readFileSync('template-coastalchic.html', 'utf8');
    const pp = fs.readFileSync('template-pressedpetals.html', 'utf8');
    const face = (src, cls) => {
      const m = src.match(new RegExp('\\n\\.' + cls + '\\{([^}]*)\\}'));
      /* The design's face, through the Section Headings wrapper where there is
         one: var(--heading-font, var(--x)) is --x until a heading font is set. */
      const g = m && m[1].match(/font-family:\s*var\((?:--heading-font,\s*var\()?(--[a-z]+)\)/);
      return g ? g[1] : null;
    };
    check('coastal chic sets event names in the body face',
      face(cc, 'schedule-event-name'), '--body');
    check('pressed petals sets them in the script face',
      face(pp, 'event-card-name'), '--script');
  }
  check('and falls back to the heading face without it',
    /const face = \(ls && ls\.font\) \|\| headingFont \|\| "Playfair Display";/.test(block), true);

  // The two designs that prove the point still disagree, so the report matters.
  const cc = fs.readFileSync('template-coastalchic.html', 'utf8');
  const pp = fs.readFileSync('template-pressedpetals.html', 'utf8');
  const ccLab = (cc.match(/\n\.travel-block-label\{([^}]*)\}/) || ['', ''])[1];
  const ppLab = (pp.match(/\n\.accom-col-title\{([^}]*)\}/) || ['', ''])[1];
  /* Still the body face by default; Section Headings now reaches it through
     var(--heading-font, ...) - titles follow Section Headings everywhere. */
  check('coastal chic labels use the body face', /font-family:var\((?:--heading-font, var\()?--body\)/.test(ccLab), true);
  check('pressed petals labels use the script face', /font-family:var\(--script\)/.test(ppLab), true);
}

// Ten template cards each load a full page, its runtime and its webfonts, but
// only one or two are on screen in the carousel at a time.
{
  const block = fs.readFileSync('Website.txt', 'utf8').replace(/\r/g, '');
  check('offscreen template cards are not loaded', /loading="lazy"/.test(block), true);
}

// The placeholder gift cards the editor builds have no photographs and no
// template styling of their own: the <img> rendered as a blank gap and the
// button took the browser's link blue.
{
  const rt = fs.readFileSync('site-runtime.js', 'utf8');
  check('placeholder cards are marked as such', /mp-reg-placeholder/.test(rt), true);
  check('they show a tinted block, not an empty image',
    /class="mp-reg-thumb"/.test(rt) && /\.mp-reg-thumb\{width:100%/.test(rt), true);
  // currentColor throughout, so the card takes the section's own ink rather
  // than a colour this code would have to know per template.
  // The rule is built from several concatenated strings, so match the pieces
  // rather than the whole declaration.
  // The button must never fall back to the browser's link styling. It used to
  // take currentColor, which was right about not hardcoding a colour but gave
  // all ten designs the same grey pill; it now takes the template's own accent
  // from TEMPLATE_COLOR_VARS. The guarantee is unchanged: no colour literal
  // here, and nothing this code has to know per template.
  check('the button is themed, not a browser default',
    /\[data-mp-built\] \.registry-buy-btn\{display:inline-block/.test(rt) &&
    /color:' \+ _btnInk \+ ';border:1px solid ' \+ _btnInk \+ ';/.test(rt), true);
  check('and no colour is hardcoded into it',
    /\[data-mp-built\] \.registry-buy-btn\{[^}]*#[0-9a-f]{3,6}/i.test(rt), false);
  check('and is not a bare underlined link',
    /\[data-mp-built\] \.registry-buy-btn\{font-size:0\.78rem;text-decoration:underline/.test(rt), false);
}

// A gallery heading must be readable against the band that actually WINS.
// Black Tie declares .gallery-section twice - my repoint set the first to black
// and a later rule set it back to offwhite - so the title was white on offwhite
// and could not be read at all.
{
  const bad = [];
  for (const f of fs.readdirSync('.').filter(x => /^template-.*\.html$/.test(x)).sort()) {
    const src = fs.readFileSync(f, 'utf8');
    const bands = [...src.matchAll(/\n\.gallery-section\{([^}]*)\}/g)]
      .map(m => (m[1].match(/background:\s*var\((--[a-z-]+)\)/) || [])[1])
      .filter(Boolean);
    if (!bands.length) continue;
    const winner = bands[bands.length - 1];          // last declaration wins
    const inkRule = src.match(/\.gallery-section \.(?:gallery-title|section-title-mini)\{color:var\((--[a-z-]+)\)\}/);
    if (!inkRule) continue;
    const dark = /black|navy|blue|berry|burgundy/.test(winner);
    const light = /on-dark|white|ivory|offwhite/.test(inkRule[1]);
    if (dark !== light) {
      bad.push(f.replace('template-', '').replace('.html', '') +
        ': ' + winner + ' band with ' + inkRule[1] + ' ink');
    }
  }
  check('gallery headings are readable on their band', bad, []);
}

// ── A reported style must not survive a template switch ───────────────────
// labelStyle and titleStyle were assigned only when TRUTHY, so a design that
// reports nothing - because it has no element matching the sampled selectors -
// kept the PREVIOUS template's style. Switching from Coastal Chic to Whimsical
// Romance left Coastal Chic's bold uppercase body face marking the boxes on a
// template that uses a script. Null is a real answer and must overwrite.
{
  const block = fs.readFileSync('Website.txt', 'utf8').replace(/\r/g, '');
  check('a null report overwrites the last one',
    /if \("labelStyle" in data\) _liveLabelStyle = data\.labelStyle \|\| null;/.test(block) &&
    /if \("titleStyle" in data\) _liveTitleStyle = data\.titleStyle \|\| null;/.test(block), true);
  check('and the truthy-only assignment is gone',
    /if \(data\.titleStyle\) _liveTitleStyle/.test(block), false);
  // Belt and braces: cleared on switch, so a template that never reports at all
  // cannot inherit either.
  check('switching template clears what the last one reported',
    /if \(_shownTemplateFile !== _previewUrl\) \{[\s\S]{0,200}_liveTitleStyle = null;/.test(block), true);

  // Every one of these is module scope, not React state: the message listener
  // is registered once with [] deps and would read state stale.
  for (const v of ['_shownTemplateFile', '_liveRsvpLine', '_liveLabelStyle', '_liveTitleStyle']) {
    check(v + ' is module scope', new RegExp('^let ' + v + ' =', 'm').test(block), true);
  }
}

// ── Every template can report a title style ───────────────────────────────
// The INTENT, not the list: whatever selectors reportSectionHeadings samples,
// all ten designs must resolve one. Three reported nothing and the editor
// silently fell back to the heading face - a wrong font, never an error. The
// near miss was .faq-q against class="faq-q-text": a class selector matches
// whole tokens, not prefixes, so the list looked wider than it was.
//
// Read live out of site-runtime.js so widening the list keeps this honest and
// a future narrowing fails here rather than in a couple's editor.
{
  const { JSDOM } = require('jsdom');
  const m = rt.match(/var _titleStyle = _styleOf\(([\s\S]*?)\);/);
  check('the title-style sampler is still there', !!m, true);
  const SEL = !m ? [] : m[1].split('\n').map(l => l.trim())
    .filter(l => l.startsWith("'"))
    .map(l => l.replace(/^'|'\s*\+?\s*$/g, '')).join('')
    .split(',').map(s => s.trim()).filter(Boolean);

  for (const f of fs.readdirSync('.').filter(x => /^template-.*\.html$/.test(x)).sort()) {
    const src = fs.readFileSync(f, 'utf8');
    const doc = new JSDOM(src).window.document;
    const n = f.replace(/^template-|\.html$/g, '');
    // Static markup, OR built by the template's own script during hydrate -
    // Black Tie, Golden Hour and Heirloom Bloom ship #faqList empty and fill
    // it with .ntk-question, so a DOM-only check understates them.
    const hit = SEL.some(s =>
      doc.querySelector(s) || src.includes('class="' + s.slice(1) + '"'));
    check(n + ' can report a title style', hit, true);
    // And a question style, from its own list. Both must resolve: a template
    // that reports only one leaves the editor guessing for the other box.
    const QSEL = ((rt.match(/\[('\.faq[^\]]*)\]\.some\(/) || [0, ''])[1].match(/'[^']+'/g) || [])
      .map(x => x.replace(/'/g, '').trim()).filter(Boolean);
    const qhit = QSEL.some(s =>
      doc.querySelector(s) || src.includes('class="' + s.slice(1) + '"'));
    check(n + ' can report a question style', qhit, true);
  }
}

// ── A gated registry says why, instead of showing nothing ─────────────────
// A password-protected or unpublished registry returns metadata with NO items,
// so there is nothing to render and the sample tiles stood there unexplained -
// which reads as a broken preview when the cause is a setting the couple owns.
{
  const { JSDOM } = require('jsdom');
  const i = rt.indexOf('function hydrateRegistryPreview(');
  const body = i === -1 ? '' : rt.slice(i, rt.indexOf('\n  function ', i + 10));

  check('both gate cases are handled, not swallowed',
    /reg\.password_required \|\| reg\.not_published/.test(body) &&
    /showRegistryNotice\(/.test(body), true);
  // Editor only. Guests on the live site meet the real password gate; a notice
  // aimed at the couple must never reach them.
  check('the notice is editor-only',
    /if \(reg\.password_required \|\| reg\.not_published\) \{[\s\S]{0,120}if \(!_isPreview\) return;/.test(body), true);
  check('the placeholder tiles come down with it',
    /if \(reg\.password_required \|\| reg\.not_published\) \{[\s\S]{0,400}cards\[g\]\.style\.display = 'none'/.test(body), true);
  // Unlock the registry and the warning has to go, or it sits under real gifts.
  check('a stale notice is cleared once gifts arrive',
    /clearRegistryNotice\(\);/.test(body), true);

  // Behavioural: the helpers actually write, replace and hide.
  {
    const doc = new JSDOM('<div id="sec"><div id="registryGrid"></div></div>').window.document;
    const h = new Function('document',
      lift(rt, ['showRegistryNotice', 'clearRegistryNotice']) +
      'var injectPreviewStyles = function () {};' +
      'return { show: showRegistryNotice, clear: clearRegistryNotice };')(doc);
    const grid = doc.getElementById('registryGrid');

    h.show(grid, 'locked');
    const box = doc.getElementById('mp-reg-notice');
    check('the notice is written into the page', !!box && box.textContent, 'locked');
    check('it sits next to the grid, not inside it',
      !!box && box.parentNode === grid.parentNode && grid.nextSibling === box, true);
    h.show(grid, 'not published');
    check('a second call replaces rather than stacks',
      doc.querySelectorAll('#mp-reg-notice').length === 1 &&
      doc.getElementById('mp-reg-notice').textContent, 'not published');
    h.clear();
    check('clearing hides it', doc.getElementById('mp-reg-notice').style.display, 'none');
    check('and showing again brings it back',
      (h.show(grid, 'again'), doc.getElementById('mp-reg-notice').style.display), '');
  }
}

// ── One registry request per slug, not one per keystroke ──────────────────
// hydrate() runs on EVERY payload the editor posts and this fetch sat inside it
// unguarded: a single session fired 23 identical requests, each up to 2s. That
// is also a 3.2 symptom generator - a slow reply means a late or missing report.
{
  const i = rt.indexOf('function hydrateRegistryPreview(');
  const body = i === -1 ? '' : rt.slice(i, rt.indexOf('\n  function ', i + 10));

  check('a repeat payload for the same slug does not refetch',
    /if \(_regCacheSlug === slug && _regCache\)/.test(body), true);
  // RE-APPLIED, not skipped. The toggle going off and on restores the tiles
  // above, so a bare "already asked, do nothing" leaves placeholders standing.
  check('the cached answer is re-applied, not skipped',
    /if \(_regCacheSlug === slug && _regCache\) \{ applyRegistry\(_regCache\); return; \}/.test(body), true);
  check('a second keystroke does not queue behind the first',
    /if \(_regInFlight === slug\) return;/.test(body), true);
  // Both exits must release, or one failure wedges the section for the session.
  check('the in-flight flag is released on success',
    /\.then\(function \(reg\) \{\s*\n\s*_regInFlight = null;/.test(body), true);
  check('and released on failure',
    /\.catch\(function \(\) \{ _regInFlight = null;/.test(body), true);

  for (const v of ['_regCacheSlug', '_regCache', '_regInFlight']) {
    check(v + ' is module scope, not per-call',
      new RegExp('^  var ' + v + ' = null;', 'm').test(rt), true);
  }
}

// ── Nothing on the page that isn't in the Content box ─────────────────────
// The rule, stated once: the card title is the FIRST LINE of what the couple
// wrote, and if there is no title line the card has no title. Templates used to
// push "Hotel" and "Flights" in as fallbacks, which made them the only words on
// that band a couple could not change - the Content tab offered a body box and
// nothing else. Golden Hour invented "Airport" the same way, from a regex
// hunting the couple's prose for an airport name.
//
// Tests the INTENT: no literal may be handed to a first-line title parser as a
// fallback, in any template, whatever the word is.
{
  for (const f of fs.readdirSync('.').filter(x => /^template-.*\.html$/.test(x)).sort()) {
    const src = fs.readFileSync(f, 'utf8');
    const n = f.replace(/^template-|\.html$/g, '');
    // Strip comments first, so the note explaining a removal doesn't trip it.
    const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    const bad = [...code.matchAll(/_mpColParts\s*\([^,)]+,\s*(['"])([^'"]*)\1\s*\)/g)]
      .map(m => m[2]).filter(Boolean);
    check(n + ' invents no card label', bad, []);
  }
  // Golden Hour's airport guess, specifically - it produced a card named
  // "Airport" for any couple whose travel copy didn't contain the word.
  const gh = fs.readFileSync('template-goldenhour.html', 'utf8');
  check('goldenhour does not guess an airport name', /:'Airport'/.test(gh), false);
  // The short rule under the Hotel/Flights label is gone from the design, so
  // it must not be built at all - conditionally or otherwise.
  const bt = fs.readFileSync('template-blacktietimeless.html', 'utf8');
  check('blacktietimeless builds no label rule', /arch-card-rule"><\/div>/.test(bt), false);
  const ss = fs.readFileSync('template-sageandstill.html', 'utf8');
  check('sageandstill builds no title rule', /accom-card-rule"><\/div>/.test(ss), false);
  const gh2 = fs.readFileSync('template-goldenhour.html', 'utf8');
  check('goldenhour builds no split rule', /split-rule"><\/div>/.test(gh2), false);
  // And the short underline beneath "Our Story" goes with them.
  for (const t of ['blacktietimeless', 'sageandstill']) {
    const src = fs.readFileSync('template-' + t + '.html', 'utf8');
    check(t + ' has no Our Story underline', /<div class="story-rule"><\/div>/.test(src), false);
  }
}

// ── The design's labels come from the seeded copy, not from code ──────────
// This is the whole rule working end to end: the templates invent nothing, and
// the arch cards still read "Hotel" and "Flights" because the STARTER COPY
// opens with those words. A couple can rename or delete them like any other
// text. If these first lines ever go, the labels vanish from every template at
// once - so they are load-bearing, and gated here rather than left to luck.
{
  const wt = fs.readFileSync('Website.txt', 'utf8');
  check('the seeded hotel card opens with its label',
    /travelInfo: '<strong>Hotel<\/strong><br>/.test(wt), true);
  check('and the flights card with its own',
    /(?:<br\s*\/?>){2,}<strong>Flights<\/strong><br>/.test(wt), true);
  // Every seeded event block ends with its dress line, so the attire styling
  // has something to show on a site nobody has edited yet.
  check('both wedding events carry an attire line',
    (wt.match(/<em>Cocktail Attire<\/em>/g) || []).length >= 2, true);
  check('welcome cocktails carries one too',
    /<em>Evening Casual<\/em>/.test(wt), true);
}

// ── The arches keep their shape on a phone ────────────────────────────────
// .arch-card draws its outline as a background image at 100% 100%, so the
// artwork is only true if the box is. min-height:0 on mobile let each card
// shrink to its own copy: the flights card has less text and often no button,
// so it drew visibly squatter than the hotel card beside it.
{
  const bt = fs.readFileSync('template-blacktietimeless.html', 'utf8');
  check('a mobile arch cannot collapse to its copy',
    /\.arch-card\{min-height:0/.test(bt), false);
  check('it has a floor instead', /\.arch-card\{min-height:360px/.test(bt), true);
  check('and both arches stretch to match',
    (bt.match(/\.travel-cards\{[^}]*align-items:stretch/g) || []).length >= 2, true);
  // The heavier rule across the spring point of the arch, drawn in CSS so it
  // stays crisp at any width rather than being baked into the PNG.
  // Moved down from 30%: the label, the rule and the copy all sit lower now.
  const spring = parseFloat((bt.match(/\.arch-card::before\{[^}]*top:(\d+)%/) || [0, 0])[1]);
  check('the arch carries its spring line', spring >= 30, true);
  // The copy steps down FURTHER than the rule, so the gap opens between them
  // rather than the whole group sliding.
  check('and the copy steps down further than the rule',
    parseFloat((bt.match(/\.arch-card-name\{[^}]*margin:([\d.]+)rem/) || [0, 0])[1]) >= 1.5, true);
  /* Measured from the TOP, not centred. Centring made each element's position
     depend on how much copy the card held - three lines and a button in the
     hotel card, two lines and none in flights - so their titles sat at
     different heights while the rule, positioned as a percentage, stayed put.
     Anchored to the top, both cards agree whatever is written below. */
  check('the arch group is anchored to the top',
    /\.arch-card\{[^}]*justify-content:flex-start/.test(bt), true);
}

// ── The dress_code line is spaced, not promoted to a heading ──────────────
// It was running on as part of the address, so it needed air above it. It does
// NOT need the title face: this is an ordinary line of the couple's copy,
// formatted, not a section heading.
{
  for (const [t, sel] of [['modernminimal', 'event-dress'],
                          ['regalboho', 'event-col-dress'],
                          ['sageandstill', 'weekend-event-dress']]) {
    const src = fs.readFileSync('template-' + t + '.html', 'utf8');
    const m = src.match(new RegExp('^\\.' + sel + '\\{[^}]*\\}', 'm'));
    check(t + ' has a dress rule', !!m, true);
    if (!m) continue;
    check(t + ' keeps the attire line as body italic',
      /font-style:italic/.test(m[0]) && !/var\(--(heading|script)\)/.test(m[0]), true);
    check(t + ' gives it room above',
      parseFloat((m[0].match(/margin-top:([\d.]+)rem/) || [0, 0])[1]) >= 1.4, true);
  }
}

// ── The three style props travel together, once per editor ───────────────
// One RichEditor carried labelStyle twice and titleStyle three times, at an
// indentation that did not match the element - residue from an earlier edit.
// JSX takes the last of a repeated prop, so it was harmless AND invisible,
// which is exactly why it survived. The three are only ever meaningful as a
// set, so an unequal count means a call site was edited by hand and missed.
{
  const wt = fs.readFileSync('Website.txt', 'utf8');
  const n = k => (wt.match(new RegExp(k + '=\\{_live[A-Za-z]+\\}', 'g')) || []).length;
  check('every editor is passed all three styles',
    n('labelStyle') === n('titleStyle') && n('titleStyle') === n('questionStyle'), true);
  check('and none is passed twice to the same one',
    n('titleStyle'), 2);
}

// ── A title mark is never invisible in the Content box ────────────────────
// Colour is the one reported property that does NOT travel. The page and the
// editor are not the same surface: Black Tie sets event titles to --on-dark
// (#ffffff) because that band is black, and copied literally onto the
// near-white box that was white on white - the couple could not see their own
// title until they selected it. Guarded by contrast, at the large-text bar so
// real design colours like Pressed Petals' gold still come through.
{
  const wt = fs.readFileSync('Website.txt', 'utf8');
  const m = wt.match(/const _lum = \(c\) => \{[\s\S]*?\? "color:" \+ ls\.color \+ ";" : "";/);
  check('the ink is contrast-guarded', !!m, true);
  if (m) {
    // Run the real code, so this tests behaviour rather than its shape.
    const src = m[0].replace(/const ink =/, 'return ');
    const ink = new Function('ls', src.replace(/\r/g, ''));
    const of = c => ink({ color: c });
    check('white on the box is dropped', of('rgb(255, 255, 255)'), '');
    check('a near-white is dropped too', of('rgb(240, 238, 236)'), '');
    check('the design\'s dark ink is kept', of('rgb(28, 33, 32)'), 'color:rgb(28, 33, 32);');
    check('and a mid-tone gold survives', of('rgb(141, 136, 99)'), 'color:rgb(141, 136, 99);');
    check('a missing colour is simply absent', of(''), '');
    check('and so is an unparseable one', of('transparent'), '');
  }
}

// ── Travel sits beside Accommodations in the menu ─────────────────────────
// The Content tab puts those two boxes next to each other, so the menu has to
// as well. Three templates listed Travel after Need to Knows and Things to Do,
// three entries away from the section it belongs beside. Pressed Petals had
// already been fixed; this holds the other two to the same order.
//
// Sage & Still and Whimsical Romance have LEFT this list: they have one menu
// link for both, so there is no adjacency to check. The gate above them
// asserts they carry no #travel-section entry at all - dropping them from
// here without that would have been how this stopped testing anything.
{
  /* Empty on purpose, and kept rather than deleted. Every template now has ONE
     entry for this pair, so there is no adjacency left to check anywhere - the
     gate above ("no template has a menu entry for the dead section") is what
     holds the line. Deleting this block would leave no record of why the rule
     stopped applying. */
  for (const t of []) {
    const src = fs.readFileSync('template-' + t + '.html', 'utf8');
    const order = (src.match(/href: '#(accommodations|travel-section|need-to-know|things-to-do)'/g) || [])
      .map(x => x.replace(/href: '#|'/g, ''));
    const ia = order.indexOf('accommodations'), it = order.indexOf('travel-section');
    check(t + ' lists travel next to accommodations', it - ia, 1);
  }
}

// ── A renamed section renames its menu link, heading or no heading ────────
// syncMenuLinks read the label off the RENDERED heading. Black Tie draws no
// heading over its accommodation band - two arch cards, no title, and no
// #accommodations element at all - so a rename found nothing to read and the
// menu kept the template's hardcoded word. The typed value is the fallback.
{
  const { JSDOM } = require('jsdom');
  const lifted = lift(rt, ['syncMenuLinks', '_headingNode']);

  const run = (html, d) => {
    const dom = new JSDOM('<!doctype html><body>' + html + '</body>');
    const fn = new Function('document', 'Node', 'window', 'SECTION_ANCHORS',
      'MENU_SYNC_KEYS', 'NAV_LINK_SOURCES', '_isPreview',
      lifted + '\nreturn syncMenuLinks;');
    fn(dom.window.document, dom.window.Node, dom.window,
       { accommodations: ['accommodations'],
         travel: ['travel-section', 'travel', 'travel-standalone'] },
       ['accommodations', 'travel'], '#menuLinks a', false)(d);
    return [...dom.window.document.querySelectorAll('#menuLinks a')]
      .map(a => a.getAttribute('href') + '=' + a.textContent);
  };

  // Black Tie: link points at an id the template never renders, and the band
  // that does hold the copy carries no heading.
  const BT = '<ul id="menuLinks">' +
    '<li><a href="#accommodations">Accommodations</a></li>' +
    '<li><a href="#travel-section">Travel</a></li></ul>' +
    '<section id="travel-section"><div class="travel-cards"></div></section>';
  check('a rename reaches a menu link with no heading behind it',
    run(BT, { section_headings: { accommodations: 'Accommodations123' } })[0],
    '#accommodations=Accommodations123');
  check('and an untouched section keeps the template wording',
    run(BT, { section_headings: {} })[0], '#accommodations=Accommodations');
  // The page still wins where it has something to say.
  const WITH = '<ul id="menuLinks"><li><a href="#accommodations">Accommodations</a></li></ul>' +
    '<section id="accommodations"><h2>Where To Stay</h2></section>';
  check('a rendered heading beats the typed value',
    run(WITH, { section_headings: { accommodations: 'Ignored' } })[0],
    '#accommodations=Where To Stay');
  // Cleared on purpose is not the same as never set.
  check('a cleared heading leaves the menu alone',
    run(BT, { section_headings: { accommodations: '' } })[0],
    '#accommodations=Accommodations');
  check('and a hidden section is left alone too',
    run('<ul id="menuLinks"><li><a href="#accommodations">Accommodations</a></li></ul>' +
        '<section id="accommodations" style="display:none"><h2>X</h2></section>',
        { section_headings: { accommodations: 'Nope' } })[0],
    '#accommodations=Accommodations');
  // No section element means relabel only - never invent a link that scrolls
  // nowhere.
  check('no phantom link is added',
    run(BT, { section_headings: { accommodations: 'A1', travel: 'T1' } }).length, 2);
  check('the heading data is actually passed in',
    /syncMenuLinks\(d\);/.test(rt), true);
}

// ── The registry preview wears the design, not an approximation ───────────
// The Purchase button drew itself from the accent colour, so it read as a
// visitor on the page while every other section had a "Book Now" styled to fit
// the design. The class list is only used to FIND that button; everything
// visual is copied off the live element, so there is no table of ten button
// styles in the runtime to drift.
{
  const { JSDOM } = require('jsdom');
  check('the CTA style is copied, not invented',
    /var cs = getComputedStyle\(src\);/.test(rt), true);
  /* Applied to ANY registry grid. Gating on data-mp-built left the one
     template that ships its own grid with a Purchase button sized by its own
     stylesheet - larger than the other nine, and missed by the phone-width
     override, which is exactly the inconsistency this is meant to remove. */
  // The BASE rule specifically - matching the media query below it would pass
  // while the base rule was still gated, which is the whole bug.
  /* SPECIFICITY, not order. The fallback is #registryGrid[data-mp-built]
     .registry-buy-btn = (1,2,0); this sheet was #registryGrid .registry-buy-btn
     = (1,1,0), which loses however late it loads. Every copied property was
     being overridden on every built grid. */
  check('the copied rule matches the fallback selector',
    /var BTN = '#registryGrid\[data-mp-built\] \.registry-buy-btn,' \+/.test(rt), true);
  check('and still covers a shipped grid',
    /'#registryGrid \.registry-buy-btn';/.test(rt), true);
  check('the button rule is built from it',
    /BTN \+ '\{margin-top:auto;align-self:center;' \+ css/.test(rt), true);
  /* The pinning contract lives in THIS sheet, not only in the fallback. The
     fallback is injected first so the copied colours win, which also means a
     template's own CSS loaded after it can override what the fallback says
     about layout - and the buttons drifted off a common baseline on the one
     template that ships its own registry styling. */
  check('the row stretches from the last sheet',
    /var rule = '#registryGrid\{align-items:stretch\}' \+/.test(rt), true);
  check('and the card is a full-height column there too',
    /'#registryGrid \.registry-card\{display:flex;flex-direction:column;height:100%\}' \+/.test(rt), true);
  check('and is not gated on data-mp-built',
    /if \(!grid \|\| !grid\.hasAttribute\('data-mp-built'\)\) return;/.test(rt), false);
  check('the phone override uses the same selector',
    /@media\(max-width:640px\)\{' \+ BTN \+ '\{/.test(rt), true);
  // The lift must run where a grid ALREADY exists - the only case it is for.
  check('the lift runs on an existing grid',
    /if \(grid\) _liftRegistryGrid\(grid\);/.test(rt), true);
  // Width and margin belong to the card the source button sits in.
  const fn = rt.slice(rt.indexOf('function styleRegistryCtas'),
                      rt.indexOf('function renderPreviewCard'));
  check('card geometry is not dragged across with it',
    /'width'|'margin|'display:block'/.test(fn.match(/var css = \[[\s\S]*?\]/)[0]), false);
  check('a one-sided border is squared up',
    /k = 'border-' \+ k\.slice\(11\)/.test(fn), true);

  // Every template this could sample from must actually have such a button.
  const SRC = (rt.match(/var REG_CTA_SOURCES = \[([\s\S]*?)\]/) || [0, ''])[1]
    .split(',').map(x => x.trim().replace(/^'|'$/g, '')).filter(Boolean);
  for (const f of fs.readdirSync('.').filter(x => /^template-.*\.html$/.test(x)).sort()) {
    const src = fs.readFileSync(f, 'utf8');
    const doc = new JSDOM(src).window.document;
    const n = f.replace(/^template-|\.html$/g, '');
    const hit = SRC.some(sel =>
      doc.querySelector(sel) || src.includes('class="' + sel.slice(1) + '"'));
    // Vintage Love Story genuinely has no section button; it keeps the accent
    // fallback, which is why that rule stays in injectPreviewStyles.
    if (n === 'vintagelovestory') continue;
    check(n + ' has a section button to copy', hit, true);
  }
}

// ── The most-wanted heart is the registry's own mark ──────────────────────
// It was a red heart CHARACTER at 26px; the registry draws an SVG at 28px in
// #A9BDC4. Two attempts at one badge, sitting side by side in the same product.
{
  check('the badge is the registry SVG, not a text heart',
    /badge\.textContent = '\\u2665'/.test(rt), false);
  check('and carries the registry path',
    /M20\.8 4\.6a5\.5 5\.5 0 0 0-7\.8 0L12 5\.7/.test(rt), true);
  check('in the registry colour', (rt.match(/#A9BDC4/g) || []).length >= 2, true);
  // Geometry lifted from the registry stylesheet.
  check('at the registry size and position',
    /\.mp-reg-badge\{position:absolute;top:10px;right:10px;z-index:4;/.test(rt) &&
    /width:28px;height:28px/.test(rt), true);
  check('with its shadow, not a heavier one',
    /box-shadow:0 1px 4px rgba\(0,0,0,0\.14\)/.test(rt), true);
}

// ── No stock photograph survives beside a couple's own ────────────────────
// A sample image is not licensed for a real wedding site. Hero rows were
// already covered by CFG.heroSlots; the slots beside them were governed by
// nothing, so a couple who uploaded a photo still published a stranger's
// kitchen on their other-events card. Ornament is declared, not inferred:
// both arrive as the same baked CDN url, and a rule keyed on "image the
// template shipped" would strip Black Tie's arches with it.
{
  const { JSDOM } = require('jsdom');
  const lifted = lift(rt, ['purgeSampleImages', 'releaseContentImages']);
  const MAP = (rt.match(/var CONTENT_IMAGES = \{([\s\S]*?)\n  \};/) || [0, ''])[1];
  check('the content slots are declared per template', !!MAP, true);

  const run = (tid, html, d) => {
    const dom = new JSDOM('<!doctype html><body>' + html + '</body>');
    new Function('document', 'TID', 'CONTENT_IMAGES', 'CONTENT_BACKGROUNDS',
      lifted + '\nreturn purgeSampleImages;')(
      dom.window.document, tid,
      new Function('return {' + MAP + '}')(), {})(d);
    return [...dom.window.document.querySelectorAll('img')]
      .map(i => i.getAttribute('src'));
  };

  const STOCK = 'https://assets.softr-files.com/x/stock.png';
  const MINE  = 'https://cdn.example.com/mine1.jpg';
  const BT = '<img class="other-event-photo" src="' + STOCK + '">' +
             '<img class="wedding-candelabra" src="' + STOCK + '">';

  check('a stock photo is replaced by the couple\'s own',
    run('blacktietimeless', BT, { hero_images: [MINE] })[0], MINE);
  // The ornament in the same markup, on the same CDN, must be untouched.
  check('the ornament beside it is left alone',
    run('blacktietimeless', BT, { hero_images: [MINE] })[1], STOCK);
  // No photograph of theirs: the sample IS the template being previewed.
  check('with no photo of their own the sample stands',
    run('blacktietimeless', BT, { hero_images: [] })[0], STOCK);
  // A slot already showing something they uploaded is not overwritten.
  const OURS = 'https://cdn.example.com/event.jpg';
  check('a photo they already uploaded is kept',
    run('blacktietimeless', '<img class="other-event-photo" src="' + OURS + '">',
        { hero_images: [MINE], events: [{ photo: OURS }] })[0], OURS);
  // One photo fills several slots by repetition - theirs to repeat.
  check('one photo fills every slot',
    run('modernminimal',
        '<img id="heroImg" src="' + STOCK + '"><img id="heroPairA" src="' + STOCK +
        '"><img id="heroPairB" src="' + STOCK + '">', { hero_images: [MINE] })
      .every(x => x === MINE), true);
  // A template with nothing declared must not be touched at all.
  check('an undeclared template is untouched',
    run('vintagelovestory', BT, { hero_images: [MINE] })[0], STOCK);
  check('the purge runs before the headings are applied',
    /purgeSampleImages\(d\);\n\n    applySectionHeadings\(d\);/.test(rt), true);

  // Slots painted as a CSS background, not an <img>. Pressed Petals sets its
  // Need to Knows photograph that way, so img.src never reached it.
  const BGMAP = (rt.match(/var CONTENT_BACKGROUNDS = \{([\s\S]*?)\n  \};/) || [0, ''])[1];
  check('background slots are declared too', !!BGMAP, true);
  const runBg = (tid, html, d) => {
    const dom = new JSDOM('<!doctype html><body>' + html + '</body>');
    new Function('document', 'TID', 'CONTENT_IMAGES', 'CONTENT_BACKGROUNDS',
      lifted + '\nreturn purgeSampleImages;')(
      dom.window.document, tid,
      new Function('return {' + MAP + '}')(),
      new Function('return {' + BGMAP + '}')())(d);
    // Compare the URL, not the raw value: jsdom re-quotes what it stores.
    const v = dom.window.document.getElementById('needToKnowBg').style.backgroundImage;
    const m = v.match(/url\(['"]?([^'")]+)/);
    return m ? m[1] : '';
  };
  const PP = '<div id="needToKnowBg" style="background-image:url(\'' + STOCK + '\')"></div>';
  check('a stock background is replaced',
    runBg('pressedpetals', PP, { hero_images: [MINE] }), MINE);
  check('and left alone with no photo of their own',
    runBg('pressedpetals', PP, { hero_images: [] }), STOCK);
  // Nothing inline means the stylesheet painted it: that is the design's.
  check('a stylesheet background is not painted over',
    runBg('pressedpetals', '<div id="needToKnowBg"></div>', { hero_images: [MINE] }), '');
}

// ── Modern Minimal has no photo slot above The Main Event ─────────────────
// #eventsHeroPhoto was display:none markup that nothing ever populated - a
// slot for a photograph that was not part of the design.
{
  const mm = fs.readFileSync('template-modernminimal.html', 'utf8');
  check('the dead events photo slot is gone',
    /eventsHeroImg|eventsHeroPhoto/.test(mm), false);
}

// Every template the couple can upload into is declared somewhere. An empty
// list is a claim that the design has no photo slot beside its hero, not an
// oversight - so the two maps together must name all ten.
{
  const names = fs.readdirSync('.').filter(x => /^template-.*\.html$/.test(x))
    .map(f => f.replace(/^template-|\.html$/g, '')).sort();
  const declared = (rt.match(/var CONTENT_IMAGES = \{([\s\S]*?)\n  \};/) || [0, ''])[1];
  for (const n of names) {
    check(n + ' is declared in the content map',
      new RegExp('(^|\\s)' + n + ':').test(declared), true);
  }

  /* The classification itself, as given: how many uploadable photo slots each
     design has BESIDE the hero row that CFG.heroSlots already fills. Held as
     counts rather than selector strings so a class can be renamed without
     touching this, while emptying a list still fails. */
  const EXPECTED = {
    blacktietimeless: 1,   // other events
    coastalchic:      2,   // hero + the photo inside the travel frame
    goldenhour:       2,   // hotel + flights
    heirloombloom:    1,   // hero only
    modernminimal:    3,   // hero + two in Our Story
    pressedpetals:    2,   // hero + Need to Knows (one is a background)
    regalboho:        1,   // hero only
    sageandstill:     1,   // hero only
    vintagelovestory: 1,   // the three Our Story photos, one selector
    whimsicalromance: 2    // hero + the photo inside the hotel frame
  };
  const bg = (rt.match(/var CONTENT_BACKGROUNDS = \{([\s\S]*?)\n  \};/) || [0, ''])[1];
  const both = new Function('return [{' + declared + '},{' + bg + '}]')();
  for (const n of names) {
    const got = (both[0][n] || []).length + (both[1][n] || []).length;
    check(n + ' declares every slot it has', got, EXPECTED[n]);
  }
}

// ── A keystroke does not hydrate eleven iframes ───────────────────────────
// The payload went to the live preview AND all ten carousel thumbnails on
// every edit, debounced only 80ms. Thumbnails render SAMPLE_DATA, so nothing
// they draw changes when the couple types - that was ten full hydrates per
// keystroke for no visible difference, and a large part of why the editor
// felt slow (a session showed 742 requests and 106MB in one minute).
{
  const wt = fs.readFileSync('Website.txt', 'utf8');
  /* Thumbnails DO render the couple's copy - ?thumbnail=1 only adds a CSS
     class. Skipping them on content changes froze a carousel showing names the
     couple had already changed. They must still be updated; what they must not
     do is redraw ten times a word. */
  check('a design change reaches the thumbnails at once',
    /if \(_k !== _lastThumbKey\) \{\s*\r?\n\s*_lastThumbKey = _k;\s*\r?\n\s*_sendThumbs\(\);/.test(wt), true);
  check('and a content change still reaches them, on a pause',
    /\} else \{\s*\r?\n\s*_thumbIdleTimer = setTimeout\(_sendThumbs, \d+\);/.test(wt), true);
  check('content is never dropped entirely',
    /_thumbIdleTimer = setTimeout/.test(wt), true);
  // A run of keystrokes must push the redraw out, not queue one per character.
  check('the idle timer is cleared between keystrokes',
    /clearTimeout\(timer\); clearTimeout\(_thumbIdleTimer\);/.test(wt), true);
  // The live preview is NOT gated: it draws the couple's copy and must follow
  // every keystroke.
  // Ungated and unqueued: it draws the couple's copy and must follow every
  // keystroke. Asserted as "sent before any thumbnail bookkeeping", not by the
  // comment that happens to follow it.
  /* The window widened when the thumbnail branch grew its flag check, so the
     span is looser - but the ORDER is the assertion, not the distance: the
     preview send has to come before any thumbnail bookkeeping. */
  check('the live preview still gets every change',
    /if \(livePreviewRef\.current\) sendToIframe\(livePreviewRef\.current, payload\);[\s\S]{0,1200}?_thumbKey\(payload\)/.test(wt) &&
    !/_thumbIdleTimer[\s\S]{0,200}livePreviewRef/.test(wt), true);
  /* A thumbnail that mounts later is seeded by its own load handler, so gating
     the broadcast cannot leave one unstyled - but that handler is now behind
     HYDRATE_THUMBNAILS too, or a card scrolled into view would hydrate on a
     desktop when nothing else does and the carousel would show a mix of the
     couple's site and the templates'. */
  check('a late thumbnail is seeded on load',
    /onIframeLoad=\{e => \{ if \(_hydrateThumbs\(\)\) sendToIframe\(e\.target, buildPayload\(\)\); \}\}/.test(wt), true);

  // The key itself, exercised: content moves must not wake the thumbnails,
  // design moves must.
  const src = (wt.match(/const THUMB_FIELDS = [\s\S]*?\n\};/) || [0])[0].replace(/\r/g, '');
  check('the key is defined', !!src, true);
  if (src) {
    const key = new Function(src + '\nreturn _thumbKey;')();
    const base = { primary_color: '#000', weddings_info: 'a', story: 'x' };
    // Same key for a content-only edit: that is what routes it to the pause
    // rather than the immediate send. It does NOT mean the edit is discarded.
    check('a content edit takes the delayed path',
      key(base) === key({ ...base, weddings_info: 'ab', story: 'y' }), true);
    check('but a colour change does',
      key(base) === key({ ...base, primary_color: '#fff' }), false);
    check('and a font change does',
      key(base) === key({ ...base, font_settings: { h: 1 } }), false);
    check('and switching sections on or off does',
      key(base) === key({ ...base, menu_config: { gallery: false } }), false);
    // Never silently stop updating.
    const circ = {}; circ.self = circ; circ.primary_color = circ;
    check('an unserialisable payload still sends', key(circ) === key(circ), false);
  }
}

// ── Every template's couple names are measured by something ───────────────
// fitCoupleNames shrinks, then wraps, a name that overflows its host. It works
// off a fixed list of ids, so a template whose names live under a different id
// is silently never fitted - which is not a crash, just a couple's name running
// off their own wedding site. Regal Boho was exactly that: heroNamesId is null
// (its hero is a full-bleed photograph), and the names are the Our Story <h1>.
{
  const { JSDOM } = require('jsdom');
  /* Scoped to fitCoupleNames, NOT the first `var ids` in the file: there are
     two fitters. fitHeroNames covers hero ids only; fitCoupleNames is the one
     with the host-relative overflow test, the wrap fallback and the re-run once
     webfonts land, so it is the list that has to be complete. */
  const body = rt.slice(rt.indexOf('function fitCoupleNames'),
                        rt.indexOf('function scheduleNameFit'));
  const IDS = (body.match(/var ids = \[CFG\.heroNamesId,([\s\S]*?)\];/) || [0, ''])[1]
    .split(',').map(x => x.trim().replace(/^'|'$/g, '')).filter(x => /^[a-zA-Z]+$/.test(x));
  check('the fit list is readable', IDS.length > 0, true);
  for (const f of fs.readdirSync('.').filter(x => /^template-.*\.html$/.test(x)).sort()) {
    const doc = new JSDOM(fs.readFileSync(f, 'utf8')).window.document;
    const n = f.replace(/^template-|\.html$/g, '');
    check(n + ' has a name element the fitter can reach',
      IDS.some(id => doc.getElementById(id)), true);
    /* Not enough on its own: a template can satisfy the line above through its
       FOOTER names while the big display pair goes unmeasured, which is what
       Regal Boho did. The element that carries the couple's names at display
       size has to be in the list, not merely some element that mentions them. */
    const display = doc.querySelector(
      '#heroCoupleNames,#heroNames,#heroInitialsWrap,#storyNames');
    check(n + ' has its DISPLAY names in the fit list',
      !!display && IDS.indexOf(display.id) !== -1, true);
  }
}

// ── Pressed Petals ────────────────────────────────────────────────────────
{
  const pp = fs.readFileSync('template-pressedpetals.html', 'utf8');

  // The two short rules either side of "Our Story". Left alone in an earlier
  // pass because they are a different treatment from the single underline the
  // other templates had - now removed on request.
  check('no rules flank the Our Story title',
    /<div class="story-rule-line"><\/div>/.test(pp), false);

  // The Book Now button sat hard against the dotted separator below it.
  const mob = (pp.match(/\.accom-btn,\.travel-btn\{[^}]*\}/) || [''])[0];
  check('the mobile CTA has room above it',
    parseFloat((mob.match(/margin-top:([\d.]+)rem/) || [0, 0])[1]) >= 1.5, true);
  check('and room below it',
    parseFloat((mob.match(/margin-bottom:([\d.]+)rem/) || [0, 0])[1]) >= 1.5, true);

  /* No styling rule for <em> inside a detail. An earlier attempt made every
     <em> there a block, which would have put a couple's mid-sentence italic
     word on a line of its own. The attire line stands apart because the SEEDED
     COPY spaces it, not because a rule reformats italics. */
  /* The trailing <em> of a detail - the attire line - wears the event-title
     face. :last-child is the whole trick: an italicised word MID-sentence is
     not the last child, so it stays an italic word inline. An unqualified
     `em` rule here would have put it on a line of its own. */
  check('a mid-sentence italic is not restyled',
    /\.event-card-detail em\{/.test(pp), false);
  /* The line the runtime tags mp-attire - the last line, wholly italic - not
     the last <em>, which also caught one italic word at the end of a card. */
  const em = (pp.match(/\.event-card-detail :is\(em,i\)\.mp-attire\{[^}]*\}/) || [''])[0];
  check('the attire line takes the title face',
    /font-family:var\(--script\)/.test(em), true);
  check('and is not left italic like the address',
    /font-style:normal/.test(em), true);
  // Nothing that would break it out of the flow of the block.
  check('and is not turned into a block',
    /display:block/.test(em), false);

  // Olive stars under the story copy, not in the design.
  check('no star motif under Our Story',
    /story-heart/.test(pp), false);

  // The divider is a grid item between the two columns, so the mobile gap
  // applies above AND below it: at 2.4rem the button sat on the rule while the
  // next title was pushed far below. The button's own margin carries the top.
  const split = (pp.match(/\.accom-split\{grid-template-columns:1fr;gap:([\d.]+)rem;\}/) || [0, 9])[1];
  check('the mobile column gap is tightened', parseFloat(split) <= 1.5, true);
  const mob2 = (pp.match(/\.accom-btn,\.travel-btn\{[^}]*\}/) || [''])[0];
  check('and the button still carries its own space below',
    parseFloat((mob2.match(/margin-bottom:([\d.]+)rem/) || [0, 0])[1]) >= 1.5, true);
}

// ── The seeded attire line is spaced, not reformatted ─────────────────────
// It needs air above it, but a BLANK LINE cannot be used: two <br>s are the
// block separator, so "Cocktail Attire" would become its own event card. The
// editor already solves this - the toolbar's spacer inserts .mp-gap for exactly
// this reason - so the seed uses the same markup a couple would produce.
{
  const wt = fs.readFileSync('Website.txt', 'utf8');
  const defs = wt.slice(wt.indexOf('const CONTENT_DEFAULTS'),
                        wt.indexOf('\r\n};', wt.indexOf('const CONTENT_DEFAULTS')));
  // Two presses of the spacer, which is what a couple would do to open it up.
  check('each attire line is preceded by two spacers',
    (defs.match(/(<span class="mp-gap"[^>]*><\/span>){2}<em>/g) || []).length, 3);
  check('and never by a blank line, which would split the card',
    /<br><br><em>(Cocktail Attire|Evening Casual)<\/em>/.test(defs), false);
  // The spacer is the editor's own, so the couple can select and delete it.
  check('the spacer is the one the toolbar inserts',
    /const insertGap[\s\S]{0,400}class="mp-gap"/.test(wt) &&
    defs.includes('<span class="mp-gap" style="display:block;height:12px"></span>'), true);
  // Still italic, still the couple's own text - no face is imposed on it.
  check('the attire line is plain italic text',
    (defs.match(/<em>(Cocktail Attire|Evening Casual)<\/em>/g) || []).length, 3);
}

// ── The copied CTA styling actually reaches the button ────────────────────
// It was correct and invisible. Two sheets write a rule for the SAME selector,
// #registryGrid[data-mp-built] .registry-buy-btn, at identical specificity:
// injectPreviewStyles' accent fallback, and the one copied off the design's own
// Book Now. Last in the document wins - and the copy ran first, so the fallback
// overrode every property of it on every template.
{
  const { JSDOM } = require('jsdom');
  const fn = rt.slice(rt.indexOf('function styleRegistryCtas'),
                      rt.indexOf('function renderPreviewCard'));
  check('the fallback sheet is placed before ours', /injectPreviewStyles\(\);/.test(fn), true);
  // appendChild MOVES an existing node, so ours stays last on every pass.
  check('and ours is appended every time, not only when created',
    /\}\s*\n\s*\/\*[\s\S]*?\*\/\s*\n\s*document\.head\.appendChild\(st\);/.test(fn), true);

  // Both rules present, in the right order, in a real document.
  const dom = new JSDOM('<!doctype html><head></head><body></body>');
  const d = dom.window.document;
  ['mp-regprev-css', 'mp-regcta-css'].forEach(id => {
    const st = d.createElement('style'); st.id = id; d.head.appendChild(st);
  });
  const ids = [...d.head.querySelectorAll('style')].map(x => x.id);
  check('the copied sheet wins on document order',
    ids.indexOf('mp-regcta-css') > ids.indexOf('mp-regprev-css'), true);
  // A re-append must not duplicate the sheet.
  d.head.appendChild(d.getElementById('mp-regcta-css'));
  check('re-appending moves rather than duplicates',
    d.head.querySelectorAll('#mp-regcta-css').length, 1);
  check('and it is last after the move',
    [...d.head.querySelectorAll('style')].pop().id, 'mp-regcta-css');
}

// ── The band, exercised ───────────────────────────────────────────────────
{
  const { JSDOM } = require('jsdom');
  const lifted = lift(rt, ['_regSection', '_paintUnder', '_syncRegistryBand']);
  const build = (secStyle) => {
    const dom = new JSDOM('<!doctype html><body>' +
      '<section id="registry-section" style="' + secStyle + '">' +
      '<div id="registryInfo">copy</div><a class="reg-cta">View Our Registry</a>' +
      '</section>' +
      '<div id="mp-reg-band"><div id="registryGrid"></div></div>' +
      '<footer id="f"></footer></body>');
    const d = dom.window.document;
    new Function('document', 'getComputedStyle', 'SECTION_ANCHORS',
      lifted + '\nreturn _syncRegistryBand;')(
      d, dom.window.getComputedStyle.bind(dom.window), { registry: ['registry-section'] })();
    return d;
  };
  let d = build('');
  const kids = [...d.body.children].map(x => x.id);
  check('the band sits directly after the section',
    kids.indexOf('mp-reg-band') - kids.indexOf('registry-section'), 1);
  check('and before whatever followed it',
    kids.indexOf('mp-reg-band') < kids.indexOf('f'), true);
  // Nothing inside the section moves: copy and button stay put.
  check('the section keeps its own contents',
    [...d.getElementById('registry-section').children].map(x => x.className || x.id).join(','),
    'registryInfo,reg-cta');
  check('the band is visible when the section is', d.getElementById('mp-reg-band').style.display, '');
  d = build('display:none');
  check('and hidden when the section is hidden',
    d.getElementById('mp-reg-band').style.display, 'none');
}

// ── The band keeps its own height ─────────────────────────────────────────
// The grid carried margin:1.6rem auto 2rem, and a margin collapses straight
// through a parent with no padding or border of its own. Both escaped the band:
// a white strip opened between the section and the gifts, and the last row of
// buttons sat on the bottom edge with the background stopping dead behind them.
{
  // Written as a length, not left empty - calc() included, since the top
  // padding now carries the pixel the overlap borrows back.
  check('the band has vertical padding, which cannot collapse',
    /band\.style\.paddingTop = '(calc\([^']+\)|[\d.]+rem)';/.test(rt) &&
    /band\.style\.paddingBottom = '(calc\([^']+\)|[\d.]+rem)';/.test(rt), true);
  /* The seam the strip actually was. The preview iframe is scaled with a CSS
     transform, so the section/band boundary falls on a fractional device pixel
     and a hairline of the page shows through - which is why three passes of
     matching the colours changed nothing. The band overlaps by 1px so there is
     no boundary left, and the pixel is added back to the top padding so
     nothing moves. Both halves, or the overlap eats a pixel of the gifts. */
  check('the band overlaps the section rather than butting against it',
    /band\.style\.marginTop = '-1px';/.test(rt), true);
  check('and takes that pixel back out of its own padding',
    /band\.style\.paddingTop = 'calc\([\d.]+rem \+ 1px\)';/.test(rt), true);
  /* A bare div appended after the section inherits the PAGE's text colour, not
     the section's, so gift names and anything in currentColor came out
     near-black on a dark registry. Chosen by luminance, not per template. */
  check('the band picks its ink against its own background',
    /band\.style\.color = \(contrastRatio\(/.test(rt), true);
  // Belt and braces: the margins are also zeroed inside the band, so they
  // cannot reopen the strip from the other side.
  check('and the grid drops its margins inside it',
    /#mp-reg-band > #registryGrid\[data-mp-built\]\{margin-top:0;margin-bottom:0\}/.test(rt), true);
  // Room under the last row specifically - that is the edge the buttons hit.
  const pb = parseFloat((rt.match(/band\.style\.paddingBottom = '([\d.]+)rem'/) || [0, 0])[1]);
  check('with more room below than above', pb >= 2, true);
}

// ── The Purchase button is not phone-sized by accident ────────────────────
// The design's button is sized to sit alone under a hotel card. Four of them in
// a two-column grid are far too heavy, and the label wrapped inside a tall pill.
{
  const fn = rt.slice(rt.indexOf('function styleRegistryCtas'),
                      rt.indexOf('function renderPreviewCard'));
  check('there is a phone-width override', /@media\(max-width:640px\)/.test(fn), true);
  // In the COPIED sheet, which is loaded last - in the fallback it would lose.
  check('and it is in the sheet that wins', /st\.textContent !== rule/.test(fn), true);
  // Scaled from the design's own values, never a fixed size.
  const sc = rt.slice(rt.indexOf('function _scale'), rt.indexOf('function styleRegistryCtas'));
  const _scale = new Function(sc + '\nreturn _scale;')();
  check('a large button is scaled down', _scale('14.4px', 0.82, 11), '12px');
  check('a small one is not scaled up past the floor', _scale('8px', 0.82, 11), '11px');
  check('and an unparseable length is dropped, not written as NaN',
    _scale('auto', 0.82, 11), '');
  check('padding shrinks too', parseFloat(_scale('38.4px', 0.55, 8)) < 38.4, true);
}

// ── Modern Minimal behaves like the other nine ────────────────────────────
{
  const { JSDOM } = require('jsdom');
  const mm = fs.readFileSync('template-modernminimal.html', 'utf8');

  /* Two sections, two fields, two buttons. There was ONE button, in Travel,
     and it fell back to accommodation_url - so a hotel booking link entered
     under Accommodations surfaced as a Book Now under Flights, with nothing
     under Accommodations at all. */
  check('accommodations has its own button', /id="accomBtn"/.test(mm), true);
  check('and it reads the accommodation field', /d\.accommodation_url \|\|/.test(mm), true);
  check('travel no longer borrows the accommodation link',
    /d\.travel_url \|\| d\.accommodation_url/.test(mm), false);

  // It sat on the last line of the copy above it.
  const btn = (mm.match(/^\.travel-btn\{[^}]*\}/m) || [''])[0];
  check('the button has room above it',
    parseFloat((btn.match(/margin-top:([\d.]+)rem/) || [0, 0])[1]) >= 1.5, true);

  /* The block's first line is its title and the Content box always showed it in
     the heading face; the page rendered it as bold body text. Only the FIRST
     line - a bold word later in the copy stays just bold. */
  const t = (mm.match(/\.travel-content > strong:first-child\{[^}]*\}/) || [''])[0];
  check('the block title takes the heading face',
    /font-family:var\(--heading\)/.test(t), true);
  check('and only the first line does',
    /> strong:first-child/.test(mm), true);
  // And the editor is told what the page actually renders.
  check('the label sampler can see it',
    /'\.travel-content > strong:first-child'\)/.test(rt), true);

  // The lift, exercised: a shipped grid ends up in the band, after the section.
  const dom = new JSDOM('<!doctype html><body>' +
    '<section id="registry-section"><div id="registryInfo">c</div>' +
    '<div class="registry-grid" id="registryGrid"></div>' +
    '<a class="registry-cta">View Our Registry</a></section><footer id="f"></footer></body>');
  const d = dom.window.document;
  const lifted = lift(rt, ['_regSection', '_paintUnder', '_liftRegistryGrid', '_syncRegistryBand']);
  const fn = new Function('document', 'getComputedStyle', 'SECTION_ANCHORS',
    lifted + '\nreturn _liftRegistryGrid;')(
    d, dom.window.getComputedStyle.bind(dom.window), { registry: ['registry-section'] });
  fn(d.getElementById('registryGrid'));
  check('the shipped grid moves into a band',
    d.getElementById('mp-reg-band').contains(d.getElementById('registryGrid')), true);
  check('the band lands after the section',
    [...d.body.children].map(x => x.id).indexOf('mp-reg-band'), 1);
  check('and the button stays behind, above the gifts',
    !!d.querySelector('#registry-section .registry-cta'), true);
  fn(d.getElementById('registryGrid'));
  check('lifting again changes nothing',
    d.querySelectorAll('#mp-reg-band').length, 1);
}

// ── The lift is reachable for the template it exists for ──────────────────
// It was written inside ensureRegistryGrid, which returns early when a grid
// already exists - the only case the lift is for. So it was correct code in a
// branch that never ran for Modern Minimal, the one template shipping a grid.
// Checked by tracing the call, not by trusting that the function exists.
{
  const hydrate = rt.slice(rt.indexOf('function hydrateRegistryPreview'),
                           rt.indexOf('function renderPreviewCard'));
  check('hydrate lifts a grid that already exists',
    /if \(grid\) _liftRegistryGrid\(grid\);/.test(hydrate), true);
  // And that call comes before the early return for a link-only registry, so
  // the order is right even when no gifts render.
  const at = hydrate.indexOf('_liftRegistryGrid(grid)');
  /* The early return no longer tests the column directly - it goes through
     _flagOff, because the live site never receives that column (MP-908). The
     ORDER is what this gate is about, so it looks for the return itself. */
  const ret = hydrate.indexOf("_flagOff(d, 'registry_preview', 'registry-preview')) return;");
  check('the early return is still there', ret > -1, true);
  check('and does so before any early return', at > -1 && at < ret, true);

  // The single template that ships its own grid must be the one this covers.
  const own = fs.readdirSync('.').filter(f => /^template-.*\.html$/.test(f))
    .filter(f => fs.readFileSync(f, 'utf8').includes('id="registryGrid"'))
    .map(f => f.replace(/^template-|\.html$/g, ''));
  check('exactly one template ships its own grid', own, ['modernminimal']);
  // Its View Our Registry button sits AFTER the grid in the markup, so lifting
  // the grid out is what puts the button above the gifts, as elsewhere.
  const mm2 = fs.readFileSync('template-modernminimal.html', 'utf8');
  check('its button follows the grid in the section',
    mm2.indexOf('id="registryCtaWrap"') > mm2.indexOf('id="registryGrid"'), true);
}

// ── Coastal Chic: a Book Now under the block it belongs to ────────────────
// There was ONE button after both blocks, reading travel_url or else
// accommodation_url. Accommodations is written first and Travel second, so a
// hotel booking link rendered under Flights - the link was right, the section
// was wrong. Same fault Modern Minimal had, same fix.
{
  const cc = fs.readFileSync('template-coastalchic.html', 'utf8');
  check('each block carries its own button', /mp-block-btn/.test(cc), true);
  check('the accommodation button reads its own field',
    /_urlIn\(d\.accommodation_info, d\.accommodation_url\)/.test(cc), true);
  check('and travel reads its own',
    /_urlIn\(d\.travel_info, d\.travel_url\)/.test(cc), true);
  check('neither borrows the other',
    /d\.travel_url \|\| d\.accommodation_url/.test(cc), false);
  // Otherwise the page shows a button under the hotel AND a second below both.
  check('the shared button steps aside when blocks have their own',
    /if \(btn && _anyBlockBtn\)\{ btn\.style\.display = 'none'; \}/.test(cc), true);
  // It stays for the untouched sample layout, which has no blocks to hang one on.
  check('but remains for the sample layout', /else if \(btn\)\{/.test(cc), true);
  check('and the per-block button is spaced for its position',
    /\.mp-block-btn\{margin-top:[\d.]+rem;margin-bottom:[\d.]+rem;\}/.test(cc), true);
}

// ── No thin horizontal scroll from the full-bleed footer ──────────────────
// 100vw is the VIEWPORT, and the viewport includes the vertical scrollbar - so
// on any page long enough to scroll, a 100vw element is wider than the space
// actually available. The drag is a scrollbar counted twice, not a wide layout.
{
  check('the footer is still full-bleed', /\.mp-brand-footer\{[^']*width:100vw/.test(rt), true);
  check('and the overflow it causes is contained',
    /'html,body\{overflow-x:hidden\}' \+\s*\n\s*\n\s*\/\* width:100vw/.test(rt), true);
  // Next to the rule that causes it, so the two cannot be separated by accident.
  const i = rt.indexOf("'html,body{overflow-x:hidden}' +\n\n    /* width:100vw");
  check('the guard sits with the rule that needs it', i > -1, true);
}

// ── Sage & Still ─────────────────────────────────────────────────────────
{
  const ss = fs.readFileSync('template-sageandstill.html', 'utf8');

  /* The couple's line breaks. Stripping every tag took the <br>s with it, so
     three lines of an address ran together - "Resort Block3777 La Jolla". */
  /* Kept through _mpLines now, which splits on the breaks and keeps the
     couple's formatting on every line (MP-333); still joined back with <br>. */
  check('line breaks survive into the card', /var place = _mpLines\(rest\)/.test(ss), true);
  {
    const L = new Function(lift(ss, ['_mpLines']) + 'return _mpLines;')();
    check('three address lines stay three lines', L('Resort Block<br>3777 La Jolla<br>CA').length, 3);
    check('and italic across them reaches each one',
      L('<em>Resort Block<br>3777 La Jolla</em>').every(l => /^<em>[\s\S]*<\/em>$/.test(l)), true);
  }
  check('and are put back as breaks', /\.join\('<br>'\)/.test(ss), true);
  check('the old blind strip is gone',
    /var place = rest\.replace\(\/<\[\^>\]\+>\/g, ''\)\.trim\(\);/.test(ss), false);

  /* The gap above the button is set explicitly rather than eaten by an auto
     margin. margin-top:auto pinned it to the card's bottom, which fought the
     card's own vertical placement and left the text block sitting high.

     That placement has since flipped from center to flex-start - Hotel and
     Flights hold different amounts of copy, and centring inside an
     equal-height card made each title's position depend on the other card. The
     explicit gap is right either way, and an auto margin would fight both. */
  check('the button no longer fights the card',
    /\.accom-card-cta\{[^}]*margin-top:auto/.test(ss), false);
  check('and has an explicit gap above it',
    parseFloat((ss.match(/\.accom-card-cta\{[^}]*margin-top:([\d.]+)rem/) || [0, 0])[1]) >= 1.4, true);
  check('the card anchors its contents to the top',
    /\.accom-card\{[\s\S]*?justify-content:flex-start/.test(ss), true);
  // Grid stretches row-mates but gives each row its own height, so once the
  // cards stacked on a phone the shorter one shrank.
  check('both cards take the taller height',
    /\.accom-inner\{[^}]*grid-auto-rows:1fr/.test(ss), true);

  /* The hero photo is an absolute panel. A 768px block once set it STATIC, and
     because it sits later in the file it beat the 640px phone rules too - a
     static panel in a hero with a fixed aspect ratio and overflow:hidden, so
     the photograph vanished rather than moved.

     This used to be checked by requiring a @640 block that restated the panel
     AFTER it. That block is gone: the 768 rule is the composition now, and a
     second copy could only drift out of step with it. The property that
     actually mattered is asserted directly instead - the panel is absolute in
     the last block that sizes it - which is true however many blocks there are. */
  const late = ss.slice(ss.indexOf('@media(max-width:768px){'));
  const lastPhotoRule = (late.match(/\.hero-photo-wrap\{[\s\S]*?\n  \}/g) || []).slice(-1)[0] || '';
  check('the phone panel is still an absolute panel',
    /position:absolute/.test(lastPhotoRule), true);
  check('and nothing later sets it static',
    /\.hero-photo-wrap\{[^}]*position:static/.test(late), false);
  // Every stylesheet still balances - the fix sits between blocks, not inside.
  const css = ss.match(/<style[^>]*>[\s\S]*?<\/style>/g) || [];
  check('the stylesheets still balance',
    css.every(c => (c.match(/\{/g) || []).length === (c.match(/\}/g) || []).length), true);
}

// ── The Purchase label is never left unreadable ───────────────────────────
// The design's button is often pale text on a solid fill. Copying the ink while
// the fill fails to come across - a shorthand background, a gradient, an image -
// leaves pale ink on the card's own tone: the label is there and invisible.
{
  const fn = rt.slice(rt.indexOf('function styleRegistryCtas'),
                      rt.indexOf('function renderPreviewCard'));
  check('ink and background travel together',
    /if \(\(k === 'color' \|\| k === 'background-color'\) && !_solid\) return '';/.test(fn), true);
  check('and a see-through fill counts as no fill',
    /!\/transparent\/i\.test\(_bg\)/.test(fn) && /,\s*0\s\*\\\)/.test(fn) === false, true);
  // The copy has to run even when no gifts render, or a placeholder preview
  // keeps the accent fallback - accent ink on no fill.
  const hyd = rt.slice(rt.indexOf('function hydrateRegistryPreview'),
                       rt.indexOf('function renderPreviewCard'));
  check('the copy runs on every hydrate, not only when gifts arrive',
    /styleRegistryCtas\(\);/.test(hyd), true);
  /* And with no fill to copy the label still has to be readable. Omitting the
     colours left the accent fallback in charge, which on a band of the same
     tone is dark ink on a dark ground. `inherit` takes the band's own text
     colour - the colour that design already uses ON that background. */
  check('an unfilled button falls back to the band\'s own ink',
    /var readable = _solid \? '' : 'color:inherit;background-color:transparent;border-color:currentColor;';/.test(fn), true);
  /* And the outline with it: label and ring one colour, not a label in the
     band's ink inside a ring copied from the design. */
  check('an unfilled button\'s outline follows its label', /border-color:currentColor;';/.test(fn), true);
  check('and that fallback is written into the rule',
    /css \+ readable \+/.test(fn), true);
}

// ── Every template's attire line matches its event title ─────────────────
// The dress_code FIELD had this treatment already; the SEEDED copy carries its
// attire as a TRAILING <em> inside the detail, which inherited the address
// styling instead. :last-child throughout, so a word italicised mid-sentence
// stays an italic word inline rather than being restyled or moved.
// The face is READ OFF each template's own event-title rule and compared,
// rather than matched against a list of variable names. The old
// (script|display|heading) alternation passed for any of three names whether or
// not that name was the title face on that design, and it could not express a
// template whose title face is called something else. Reading the design's own
// rule means a template that changes its title face and forgets the attire line
// fails here.
//
// Every card container that receives the couple's verbatim copy needs its own
// rule, which is why several templates appear with two: a design that renders
// weddings_info and events_info into differently-classed cards would otherwise
// get the treatment on one of them.
{
  for (const [t, pairs] of [
    ['pressedpetals',    [['event-card-detail',      'event-card-name']]],
    ['blacktietimeless', [['wedding-card-detail',    'wedding-card-name']]],
    ['goldenhour',       [['wedding-card-detail',    'wedding-card-name'],
                          ['event-detail',           'event-name']]],
    ['heirloombloom',    [['wedding-card-detail',    'wedding-card-name'],
                          ['other-event-detail',     'other-event-name']]],
    ['whimsicalromance', [['itinerary-event-detail', 'itinerary-event-name']]],
    ['vintagelovestory', [['wedding-col-meta',       'wedding-col-title'],
                          ['event-col-meta',         'event-col-title']]],
  ]) {
    const src = fs.readFileSync('template-' + t + '.html', 'utf8');
    for (const [sel, titleSel] of pairs) {
      const label = t + ' .' + sel;
      const m = src.match(new RegExp('^\\.' + sel + ' :is\\(em,i\\)\\.mp-attire\\{[^}]*\\}', 'm'));
      check(label + ' styles the trailing attire line', !!m, true);
      const title = src.match(new RegExp('^\\.' + titleSel + '\\{[^}]*\\}', 'm'));
      check(label + ' has an event title rule to read', !!title, true);
      if (!m || !title) continue;
      const face = (title[0].match(/font-family:\s*(var\(--[\w-]+\))/) || [])[1];
      check(label + ' has a title face to copy', !!face, true);
      check(label + ' uses that same face',
        !!face && m[0].indexOf('font-family:' + face) !== -1, true);
      check(label + ' does not leave it italic',
        /font-style:normal/.test(m[0]), true);
      check(label + ' leaves a mid-sentence italic alone',
        new RegExp('\\.' + sel + ' em\\{').test(src), false);
    }
  }
}

// ── A thumbnail is rendered near the size it is shown at ──────────────────
// The thumbnail is an iframe of the real template, displayed through a CSS
// transform, so the scale is how much of the type survives. A carousel card is
// 200px and desktop rendered at 1100, giving 0.18: the template's 16px body
// text arrived at under 3px. Nothing was out of focus - there was not enough of
// it left to read, which is what "blurred" describes.
{
  const wt = fs.readFileSync('Website.txt', 'utf8');
  const num = (re) => { const m = wt.match(re); return m ? parseFloat(m[1]) : NaN; };
  const renderW = num(/const THUMB_MOBILE_WIDTH\s*=\s*(\d+);/);
  /* The card widths are DERIVED from the render width now rather than written
     as literals, so they are computed here the same way. Two literals that
     happen to match today drift the moment one is tuned, and the drift is
     invisible: the thumbnail just goes soft again. */
  const focus = /const FOCUS_CARD_WIDTH = THUMB_MOBILE_WIDTH;/.test(wt) ? renderW : NaN;
  const peekFactor = num(/const PEEK_CARD_WIDTH\s*=\s*Math\.round\(FOCUS_CARD_WIDTH \* ([\d.]+)\);/);
  const peek = Math.round(focus * peekFactor);
  check('the card widths were found', [renderW, focus, peek].every(v => isFinite(v)), true);
  check('the focus card is the base card width exactly', focus, renderW);

  /* THE RATIO IS AGAINST THE RENDER WIDTH, not the card width.

     This compared focus to THUMB_MOBILE_WIDTH, which the focus card is now
     equal to by definition - so it read 1.0 and passed whatever the frame was
     actually rendered at. A gate that cannot fail is worse than none, and this
     is the exact measurement it exists to protect.

     The floor is a third of full size: below that a 16px line lands under 6px
     and there is nothing left to look at. The multiple that produces it is free
     to be retuned between 1 and 3. */
  const multiple = num(/const THUMB_RENDER_WIDTH\s*=\s*THUMB_MOBILE_WIDTH \* (\d+);/);
  check('the render width is a whole multiple of the card', isFinite(multiple), true);
  check('the focus card is not shown at a small fraction of its render',
    1 / multiple > 0.3, true);
  /* And it must show MORE than one card's worth of page. A multiple of 1 is
     the hero and nothing else, which is the state this replaced - it passed
     every other check here, because every other check is about sharpness and
     1:1 is the sharpest there is. Coverage needs its own floor or the two
     requirements are not both held. */
  check('and it shows more of the page than the hero alone', multiple >= 2, true);
  check('and even a peek card keeps something to look at',
    (peek / renderW) / multiple > 0.15, true);

  /* ONE render size, which was the point - not one NAME. The original fault was
     a second constant used only on desktop, so the two surfaces were different
     renders of the same template and only one of them was wrong. A single
     THUMB_RENDER_WIDTH read by both is the opposite of that, so the assertion
     is now what it always meant: nothing branches on which surface it is. */
  check('the render width is one value for both surfaces',
    (wt.match(/const THUMB_RENDER_WIDTH\s*=/g) || []).length, 1);
  check('and it is derived from the card width, not a second literal',
    /const THUMB_RENDER_WIDTH\s*=\s*THUMB_MOBILE_WIDTH \*/.test(wt), true);
  check('nor a second height', /THUMB_RENDER_HEIGHT/.test(wt), false);
  check('and nothing still branches on which surface it is',
    /renderW = narrow \?/.test(wt), false);

  /* Never magnify: scaling a 276px render up to fill a wider card blows up
     every fixed-pixel element inside it, and the template's own hamburger came
     out half as big again as the Live Preview's. */
  check('the scale is still capped at 1', /Math\.min\(1, w \/ rw\)/.test(wt), true);
  /* The first paint uses this until measure() runs, so a value sized for the
     old render made every card start at a quarter of its size. It is a whole
     number now - the focused card is the render width, so 1 - and a regex that
     only matched 0.xx read NaN and failed for the wrong reason. */
  const initial = num(/useState\((\d+(?:\.\d+)?)\);\r?\n?\s*const \[offsetX/);
  const guess = isFinite(initial) ? initial
    : num(/const \[scale, setScale\] = useState\((\d+(?:\.\d+)?)\)/);
  check('the first paint is sized for the render it will get',
    isFinite(guess) && Math.abs(guess - focus / renderW) < 0.1, true);
  // THUMB_MOBILE_MAX_VW is still load-bearing for the hydrate flag, not layout.
  check('the viewport threshold still drives the hydrate flag',
    /window\.innerWidth < THUMB_MOBILE_MAX_VW; \} catch/.test(wt), true);
}

// ── MP-332: a font a couple sets on a word is actually loaded ─────────────
// The span survives into the page - the preview confirmed one in
// .event-card-name - and the inline style would win over the template's own
// face. But the FACE was never requested, so the browser had nothing to render
// it with and fell back silently.
//
// Both faults are the same thing: a family whose name has a space is quoted by
// the browser, and those quotes reach the payload as &quot; because the span
// lives in a double-quoted HTML attribute.
//
//   1. the capture pattern stops at the first ';' - which is the one INSIDE
//      &quot; - so it read back the four characters "&quot"
//   2. the name lookup trims [\s"'], which does not touch an entity
//
// A one-word family needs no quotes, has no entities, and worked throughout.
// That is the whole of "it works for some fonts and not others".
{
  const lift1 = (n) => {
    const i = rt.indexOf('function ' + n + '(');
    let d = 0;
    for (let k = rt.indexOf('{', i); k < rt.length; k++) {
      if (rt[k] === '{') d++;
      else if (rt[k] === '}') { d--; if (!d) return rt.slice(i, k + 1); }
    }
    return '';
  };
  const src = (rt.match(/var CONTENT_FONTS = \[[\s\S]*?\];/) || [''])[0] +
    '\nvar _contentFontIndex=null;\n' + lift1('_knownContentFont') + '\n' + lift1('collectContentFonts');
  const collect = new Function(src + '\nreturn collectContentFonts;')();
  const known = new Function(src + '\nreturn _knownContentFont;')();
  check('the font collector was found', typeof collect, 'function');

  /* RUN against the exact markup the browser produces. Every one of these is a
     shape a real payload carries, and the entity ones are what was broken. */
  const field = (css) => ({ weddings_info: '<span style="font-family: ' + css + '">x</span>' });
  check('a quoted multi-word family is collected',
    collect(field('&quot;Great Vibes&quot;, serif;')).join(','), 'Great Vibes');
  check('and the one from the report',
    collect(field('&quot;Dancing Script&quot;, serif;')).join(','), 'Dancing Script');
  check('a single-quoted entity too',
    collect(field('&#39;Pinyon Script&#39;, serif;')).join(','), 'Pinyon Script');
  /* The case that always worked. It must keep working - it is why the bug
     looked intermittent instead of total. */
  check('an unquoted single-word family still works',
    collect(field('Lora, serif;')).join(','), 'Lora');
  check('a literally-quoted family still works',
    collect(field('\'Playfair Display\', serif;')).join(','), 'Playfair Display');
  /* Two in one field: the pattern is global and must not stop at the first. */
  check('every family in a field is found',
    collect({ weddings_info: '<span style="font-family: &quot;Great Vibes&quot;;">a</span>' +
                             '<span style="font-family: Oswald;">b</span>' }).join(','),
    'Great Vibes,Oswald');
  /* A family that is not on the list must NOT be requested: css2 answers 400
     for an unknown name and that would drop every other family in the batch. */
  check('an unknown family is not requested',
    collect(field('&quot;Nonesuch&quot;;')).length, 0);
  check('and a field with no fonts asks for nothing',
    collect({ weddings_info: '<strong>The Ceremony</strong>' }).length, 0);

  /* The lookup itself, which is the second half of the same fault. */
  check('an entity-quoted name resolves', known('&quot;Great Vibes&quot;'), 'Great Vibes');
  check('with whitespace around it', known(' &quot;Dancing Script&quot; '), 'Dancing Script');
  check('the canonical spelling is returned, not the couple\'s',
    known('&quot;dancing script&quot;'), 'Dancing Script');
  check('and an unknown name is still refused', known('&quot;Nonesuch&quot;'), null);

  /* Every face the picker offers has to be collectable in its quoted form, or
     this is fixed for the two fonts that were reported and nobody else. */
  const list = new Function((rt.match(/var CONTENT_FONTS = \[[\s\S]*?\];/) || [''])[0] +
    '\nreturn CONTENT_FONTS;')();
  check('the picker offers a real list', list.length > 20, true);
  const missed = list.filter(f => collect(field('&quot;' + f + '&quot;, serif;')).join(',') !== f);
  check('every offered face is collectable when quoted', missed.join(','), '');

  /* The /g flag, checked as SOURCE rather than by running it. Dropping it makes
     `while ((m = re.exec(v)))` return the same match for ever - the suite does
     not fail, it hangs, and a gate that hangs tells you nothing and costs a
     five-minute timeout to discover. */
  check('the family pattern is global',
    /var re = \/font-family[^\/]*\/gi;/.test(rt), true);
}

// ── Nothing on the critical path waits to be discovered ───────────────────
// The runtime is 111 KB over the wire and is declared at the FOOT of a 100 KB
// document, so the browser only learns it exists after parsing everything
// above. The hero photograph is worse: it cannot begin until the runtime has
// arrived AND hydrate has set the src, which on a slow connection is seconds of
// the critical path spent idle.
{
  const tpls = fs.readdirSync('.').filter(f => /^template-.*\.html$/.test(f)).sort();
  check('all ten templates are covered', tpls.length, 10);
  const bad = [];
  for (const t of tpls) {
    const src = fs.readFileSync(t, 'utf8');
    const name = t.replace('template-', '').replace('.html', '');
    const head = src.slice(0, src.indexOf('</head>'));
    if (!/<link rel="preload" as="script" href="\/site-runtime\.js">/.test(head))
      bad.push(name + ': does not preload the runtime');
    /* In the HEAD. Further down the document it is no earlier than the script
       tag it is trying to get ahead of, which is the entire point. */
    if (head.indexOf('rel="preload" as="script"') === -1)
      bad.push(name + ': preloads it too late to matter');
    /* And the tag it preloads must still be there - a preload for something
       never requested is a wasted round-trip on the connection that matters. */
    if (!/<script src="\/site-runtime\.js"><\/script>/.test(src))
      bad.push(name + ': preloads a script it never loads');
    /* Only where the fonts are remote. Three designs self-host from /fonts,
       and a preconnect to a host they never use costs a handshake for nothing. */
    const remote = /fonts\.googleapis\.com\/css2/.test(src);
    const pre = /<link rel="preconnect" href="https:\/\/fonts\.gstatic\.com" crossorigin>/.test(src);
    if (remote && !pre) bad.push(name + ': remote fonts without a preconnect');
    if (!remote && pre) bad.push(name + ': preconnects to a font host it does not use');
  }
  check('every template asks for the runtime early', bad.join(' | '), '');

  /* The hero preload is built by the server, which is the only place the url is
     known before hydrate. */
  const api = fs.readFileSync('api/site.js', 'utf8');
  const mod = new Function(api.replace(/^import .*$/gm, '')
    .replace(/^export default /m, 'const handler = ') +
    '\nreturn { heroPreload, injectData };')();
  check('a hero url becomes a preload',
    /rel="preload" as="image"/.test(mod.heroPreload({ hero_image: 'https://x/y.jpg' })), true);
  check('and is marked as the important one',
    /fetchpriority="high"/.test(mod.heroPreload({ hero_image: 'https://x/y.jpg' })), true);
  /* No hero, or something that is not a fetchable url: no preload. A preload
     the browser never uses is a wasted request on the critical path. */
  check('no hero means no preload', mod.heroPreload({}), '');
  check('nor does a non-http url', mod.heroPreload({ hero_image: 'data:image/png;base64,AA' }), '');
  check('nor does nonsense', mod.heroPreload({ hero_image: 'not a url' }), '');
  /* Quotes in a url would end the attribute early and put the rest of it into
     the document as markup. */
  check('a quote in the url cannot break the attribute',
    mod.heroPreload({ hero_image: 'https://x/a"onload=y' }).indexOf('"onload='), -1);
  /* It has to land in the head, ahead of the runtime, or it is no earlier than
     the swap it exists to beat. */
  const out = mod.injectData('<html><head><title>t</title></head><body></body></html>',
    { hero_image: 'https://x/y.jpg' });
  /* PRESENT first, then early. indexOf returns -1 when a thing is absent, and
     -1 is less than every real index - so the ordering check alone passed
     against output with no preload in it at all. */
  const iPre = out.indexOf('rel="preload" as="image"');
  check('the preload is injected at all', iPre > -1, true);
  check('and it lands inside the head', iPre > -1 && iPre < out.indexOf('</head>'), true);
}

// ── The block says which build it is ─────────────────────────────────────
// The runtime has had a stamp for weeks and it is repeatedly the fastest way
// to end an argument about whether a fix is live. This file had none, so the
// only way to tell was to look at its behaviour - which is the thing in
// question whenever a fix spans both files and only one has landed.
//
// That cost a round: the hex-field guard that stops a half-typed colour
// reaching the page lives in the BLOCK, the runtime beside it was deployed
// without it, and a fault reported as "come back" had never gone live.
{
  const wt = fs.readFileSync('Website.txt', 'utf8');
  check('the block states its build',
    /const MP_BLOCK_BUILD = '[\w.-]+';/.test(wt), true);
  check('and puts it on window to be read',
    /window\.MP_BLOCK_BUILD = MP_BLOCK_BUILD;/.test(wt), true);
  check('and logs it on load', /console\.log\('\[mp-block\] build '/.test(wt), true);
  /* It must not be able to take the editor down: this runs at module scope,
     before any error boundary exists. */
  check('stamping cannot break the block', /\} catch \(e\) \{\}/.test(
    wt.slice(wt.indexOf('const MP_BLOCK_BUILD'), wt.indexOf('const TEMPLATES = ['))), true);

  /* THE TWO BUILDS MOVE TOGETHER. They ship as one change and are deployed
     separately, so a mismatch is the single most useful thing to be able to
     see - and a stamp that lags is worse than none, because it would be
     believed. */
  const block = (wt.match(/const MP_BLOCK_BUILD = '([\w.-]+)';/) || [])[1];
  const runtime = (rt.match(/var MP_RUNTIME_BUILD = '([\w.-]+)';/) || [])[1];
  check('the block and the runtime name the same build', block, runtime);

  /* Any edit to this file is a different build, the same rule the runtime
     follows - otherwise the stamp only fails after someone has already
     bumped it, which is backwards. */
  const body = wt.replace(/const MP_BLOCK_BUILD = '[\w.-]+';/, '');
  let h = 5381;
  for (let i = 0; i < body.length; i++) h = ((h * 33) ^ body.charCodeAt(i)) >>> 0;
  check('and nothing in the block has moved since',
    ('0000000' + h.toString(16)).slice(-8), '90e16f67');
}

// ── Nothing the editor stores is injected as CSS ─────────────────────────
// custom_css holds two different things: the couple's own CSS, which is
// injected as a stylesheet, and STORAGE KEYS the editor keeps there as bare
// "--text2:#xxx;" declarations. A bare declaration outside any selector is
// invalid, and the browser drops the run - taking a following rule with it.
//
// The strip pattern listed five keys and matched neither --bg nor a bare
// --accent (accent[0-9] requires a digit). Those two were added when Site
// Background and Accent needed a way to reach the live site, so they survived
// the strip and were injected loose: a couple opening the colour picker watched
// a band they had not touched go white, with its white text still on it,
// because the rule painting that band had been dropped.
{
  const wt = fs.readFileSync('Website.txt', 'utf8');
  const keysSrc = (rt.match(/var _STORAGE_KEYS = \[[\s\S]*?\];/) || [''])[0];
  const reSrc = (rt.match(/var _STORAGE_KEY_RE = new RegExp\([\s\S]*?\);/) || [''])[0];
  check('there is one list of storage keys', !!keysSrc && !!reSrc, true);
  const ctx = new Function(keysSrc + '\n' + reSrc +
    '\nreturn { keys: _STORAGE_KEYS, re: _STORAGE_KEY_RE };')();

  /* EVERY key the editor writes must be stripped, or it reaches the stylesheet
     as a loose declaration. This is the rule the bug broke, checked against
     what the editor actually writes rather than against a list. */
  const written = [...wt.matchAll(/_setVarColor\('([a-z0-9()?!\[\]-]+)'/g)]
    .map(m => m[1].replace('(?![0-9])', ''));
  check('the editor writes keys into custom_css', written.length > 0, true);
  const leaked = [...new Set(written)].filter(k => ctx.keys.indexOf(k) === -1);
  check('every key the editor writes is stripped before injection', leaked.join(','), '');
  // The two that caused it, named.
  check('bg is stripped', ctx.keys.indexOf('bg') > -1, true);
  check('a bare accent is stripped', ctx.keys.indexOf('accent') > -1, true);
  check('and the flag is too', ctx.keys.indexOf('registry-preview') > -1, true);

  /* Run it: only the couple's own CSS survives. */
  const strip = (css) => css.replace(new RegExp(ctx.re.source, 'g'), '').trim();
  check('storage keys are removed',
    strip('--accent:#8d8863; --bg:#f9f5f9; --text:#040505; --accent2:#fff; --registry-preview:0;'), '');
  check('and the couple\'s own css is kept',
    strip('--bg:#f9f5f9; .my-own{color:red}'), '.my-own{color:red}');
  check('a rule mentioning a variable is not eaten',
    strip('.x{color:var(--bg)}'), '.x{color:var(--bg)}');
  /* The injection must use that one pattern, not a copy. */
  check('the injection uses the shared pattern',
    /String\(d\.custom_css\)\.replace\(_STORAGE_KEY_RE, ''\)/.test(rt), true);
  check('and carries no hand-listed pattern of its own',
    /--\(\?:text\[0-9\]\?\|accent\[0-9\]\)/.test(rt), false);
}

// ── Reset clears every colour, including the two with columns ────────────
// MP-357, after my own regression. Site Background and Accent were stored only
// as record columns, so emptying those columns was the whole of resetting them
// - until they started being written into customCss as well, to survive the
// trip to the live site. The reset list was not updated with them.
//
// So "Reset to template colors" emptied the columns and left the customCss copy
// standing: the panel showed every default restored while the preview kept the
// colour the couple had just set, with no control left that could clear it.
{
  const wt = fs.readFileSync('Website.txt', 'utf8');

  /* ONE list, read by the reset. A second list of colour names is what caused
     this, so the fix is not a longer list but a shared one. */
  /* Not [^\]]* - one of the entries is `text(?![0-9])`, which contains a
     closing bracket, so that pattern stopped inside the list and found
     nothing. Non-greedy to the first `];` instead. */
  const listSrc = (wt.match(/const COLOR_CSS_VARS = \[[\s\S]*?\];/) || [''])[0];
  check('there is one list of the customCss colours', !!listSrc, true);
  const vars = new Function(listSrc + '\nreturn COLOR_CSS_VARS;')();
  check('the reset reads that list',
    /const existing = COLOR_CSS_VARS\s*\n?\s*\.reduce\(\(css, n\) => _stripVarColor\(css, n\)/.test(wt), true);
  check('and no longer carries its own copy',
    /\['text\(\?!\[0-9\]\)', 'text2', 'text3', 'accent2', 'accent3'\]\s*\n?\s*\.reduce/.test(wt), false);

  /* Every name a setter writes has to be in it, or that colour cannot be
     cleared - which is the bug, stated as a rule. */
  const written = [...wt.matchAll(/_setVarColor\('([a-z0-9-]+)'/g)].map(m => m[1])
    .filter(n => n !== 'registry-preview');   // a flag, not a colour
  check('something writes colours into customCss', written.length > 0, true);
  const unclearable = [...new Set(written)].filter(n =>
    !vars.some(v => v === n || v.indexOf(n) === 0));
  check('every colour written can also be cleared', unclearable.join(','), '');
  // And the two that caused it, named.
  check('site background is in the list', vars.indexOf('bg') > -1, true);
  check('accent is too', vars.indexOf('accent') > -1, true);
  /* The text guard has to survive being moved into the list: --text must not
     match --text2 or --text3. */
  check('the text pattern still excludes its numbered siblings',
    vars.indexOf('text(?![0-9])') > -1, true);

  /* A half-typed hex must not reach the page. The field fires on every
     keystroke, so typing a colour sent "#f", "#ff", "#ffe" - each landing as
     it was typed, and an unparseable value leaves the variable unset, which is
     how white text on a white ground appeared mid-edit. */
  check('only a complete hex is applied',
    /onChange=\{hex => \{ if \(\/\^#\[0-9a-fA-F\]\{6\}\$\/\.test\(hex\)\) c\.set\(hex\); \}\}/.test(wt), true);
}

// ── MP-897: the lock screen carries the couple's own hint ────────────────
// Couples were sending the password itself alongside the link, which defeats
// the lock. A hint they choose lets the people they actually invited in without
// the password travelling with the invitation.
{
  const wt = fs.readFileSync('Website.txt', 'utf8');
  /* To the end of the function. The seventh fixed-width window to go wrong
     this session - this one is the last. */
  const scr = rt.slice(rt.indexOf('function renderPasswordScreen'),
                       rt.indexOf('function renderComingSoon'));
  check('the screen takes a hint', /function renderPasswordScreen\(coupleNames, hint\)/.test(scr), true);
  check('and the caller passes it',
    /renderPasswordScreen\(coupleNames\(d\), d\.password_hint\)/.test(rt), true);
  /* ESCAPED, and shown only when there is one. This is the one screen rendered
     to someone who has not proved they belong, so nothing on it is treated as
     markup - the hint is written to be read at the gate and carries no privacy
     weight of its own, but it must not be able to carry anything else. */
  check('the hint is escaped', /esc\(hintText\)/.test(scr), true);
  /* Labelled and in brackets, so it reads as a prompt rather than as another
     instruction the guest is meant to follow. */
  check('the hint is shown as a hint',
    scr.indexOf("(Hint: ' + esc(hintText) + ')") > -1, true);

  /* Two lines: the first states the situation, the second says what to do. As
     one paragraph they ran together and the instruction was easy to read past. */
  check('the instruction stands on its own line',
    /mp-body2">Please enter the password your hosts shared with you/.test(scr), true);

  /* No lock emoji, no PRIVATE eyebrow - the page says it in words directly
     below, and the emoji rendered in whatever the system supplied. */
  check('the lock emoji is gone', /\\uD83D\\uDD12/.test(scr), false);
  check('and the eyebrow with it', /mp-eyebrow/.test(scr), false);
  /* And no second footer: screenShell renders the real one. */
  check('the stray footer line is gone', /mp-foot">myplanning\.ai/.test(rt), false);

  /* A guest can reveal what they typed. One dictated over the phone needs
     checking as much as the one the couple set. */
  check('the guest can reveal the password', /id="mpPwEye"/.test(scr), true);
  check('it toggles the field type',
    /input\.type = show \? 'text' : 'password';/.test(scr), true);
  check('and says which it will do next',
    /eye\.setAttribute\('aria-label', show \? 'Hide password' : 'Show password'\)/.test(scr), true);
  /* Drawn inline: the gate renders before anything else and must not wait on
     an icon font or a network request to show its controls. */
  check('the icon needs nothing loaded', /function _eyeSvg\(shown\)/.test(rt), true);
  check('and takes the page ink', /stroke="currentColor"/.test(rt), true);
  /* The field leaves room for it, or a long password runs underneath. */
  check('the field makes room for the control',
    /\.mp-pw input\{width:100%;padding:12px 40px/.test(scr), true);

  /* The tab said "Pressed Petals" - the template file's own <title>, left
     standing because the gate replaces the body and never touched the head. */
  check('the tab names the wedding, not the template',
    /document\.title = _slug/.test(scr), true);
  /* Set FIRST, before anything is drawn. Doing it after the markup left the
     template file's own <title> in the tab while the gate rendered, so a guest
     saw "Heirloom Bloom" flash past. */
  check('the tab is named before the page is drawn',
    scr.indexOf('document.title') < scr.indexOf('screenShell('), true);
  /* Title case, to match the unlocked site - that one uses the couple's names,
     and a lowercase slug beside it in the tab strip looked like another site. */
  check('and reads as a name',
    /replace\(\/\\b\[a-z\]\/g, function \(c\) \{ return c\.toUpperCase\(\); \}\)/.test(scr), true);

  /* The template's motif where a bare rule used to sit. With the heading gone
     the rule divided nothing - it read as a stray line across an empty page. */
  check('the gate shows the template motif',
    /mp-screen-motif" src="' \+ CFG\.loadingImage/.test(scr), true);
  check('and falls back to a rule when a template has none',
    /: '<div class="mp-rule"><\/div>'/.test(scr), true);
  check('the motif is sized for the screen',
    /\.mp-screen-motif\{display:block;height:54px/.test(scr), true);
  /* No heading when there are no names. The lock-screen payload withholds them
     by design, so the fallback filled that space with "A private celebration"
     at heading size - a large line of text saying nothing, in whatever face
     the template had not yet loaded. */
  check('the names appear only when there are some',
    /\(coupleNames \? '<h1 class="mp-display">' \+ esc\(coupleNames\) \+ '<\/h1>' : ''\)/.test(scr), true);
  check('and there is no invented stand-in',
    /A private celebration/.test(rt), false);

  /* And the screen carries the real footer. These screens replace the whole
     document, so the one the site builds at the end of hydrate was never
     there - a guest landing on a locked site sees this page and nothing
     else. */
  const shell = rt.slice(rt.indexOf('function screenShell'), rt.indexOf('// \u2500\u2500 Save the Date'));
  check('the shell draws the brand footer',
    /renderBrandFooter\(theme && theme\.footer\)/.test(shell), true);
  check('after the body is shown, since it appends to it',
    shell.indexOf("style.visibility = 'visible'") < shell.indexOf('renderBrandFooter'), true);
  check('and a footer failure cannot blank the gate',
    /try \{ renderBrandFooter\(theme && theme\.footer\); \} catch \(e\) \{\}/.test(shell), true);
  check('and omitted entirely when blank', /hintText \?/.test(scr), true);
  check('with whitespace collapsed first', scr.indexOf("replace(/\\s+/g, ' ').trim()") > -1, true);

  /* EDITOR: the hint saves with the password in one write. Separately would
     let a couple keep a hint for a password they have since changed. */
  check('the editor knows the column', /passwordHint: "XYf1l"/.test(wt), true);
  check('the hint saves with the password',
    /websitePassword: pwInput\.trim\(\),\s*\n\s*passwordHint: pwHint\.trim\(\)/.test(wt), true);

  /* AND protection itself. It used to ride in on pendingChanges, which
     openPwDialog clears - so spreading null gave an empty object and the only
     fields written were the password and the hint. A couple set a password,
     were told it had saved, watched the toggle fall back off, and the site
     stayed open to anyone with the link.

     This is the only path that sets a password, and a password is worthless
     without the flag that enforces it. */
  check('protection is written with the password',
    /passwordProtected: true,\s*\n\s*websitePassword: pwInput\.trim\(\)/.test(wt), true);
  check('and a null queue cannot swallow it',
    /\{ \.\.\.\(pendingChanges \|\| \{\}\), passwordProtected: true,/.test(wt), true);
  check('opening the dialog no longer clears the queue',
    /const openPwDialog = \(\) => \{\s*\n\s*\/\*[\s\S]{0,200}\*\/\s*\n\s*setPwInput/.test(wt), true);

  /* The label reads "Password protected", with a space. This row is an
     inline-flex container and a flex container strips the leading whitespace
     of a text run, so " protected" rendered hard against the word before it. */
  check('the label keeps its space',
    /\{"\\u00A0" \+ item\.label\.slice\(item\.linkWord\.length \+ 1\)\}/.test(wt), true);
  check('the modal is seeded from the record',
    /setPwHint\(currentData\.passwordHint \|\| ""\)/.test(wt), true);
  /* AND it opens whenever protection is switched on. The hint lives in this
     dialog and nowhere else, and the dialog used to appear only for a couple
     who had never set a password - so anyone who already had one could turn
     protection on and never be shown anywhere to write a hint. */
  /* OPENED BY THE SWITCH, not by save. It used to wait for saveChanges, so a
     couple switched protection on, carried on editing, and were asked for a
     password minutes later with no obvious connection to what they had done. */
  check('the switch opens the dialog',
    /onChange: c => \{\s*\n\s*handleUpdate\("passwordProtected", c\);\s*\n\s*if \(c\) openPwDialog\(\);/.test(wt), true);
  /* And it stays reachable. A couple who set a password had no way to read it
     back or change the hint - the switch is already on, so flicking it does
     nothing. The word itself opens the dialog. */
  check('the word Password opens it too',
    /linkWord: "Password",\s*\n\s*onWordClick: \(\) => openPwDialog\(\)/.test(wt), true);
  check('and is underlined so it reads as clickable',
    /textDecoration: "underline", cursor: "pointer"/.test(wt), true);
  check('reachable by keyboard as well as mouse',
    /onKeyDown=\{e => \{ if \(e\.key === "Enter" \|\| e\.key === " "\)/.test(wt), true);

  /* One way in, seeding both fields from the record - empty boxes would read
     as "nothing saved" to a couple who had set both. */
  check('the dialog seeds from what is saved',
    /setPwInput\(currentData\.websitePassword \|\| ""\);\s*\n\s*setPwHint\(currentData\.passwordHint \|\| ""\);/.test(wt), true);

  /* The password can be revealed. Hidden by default - one on screen in an open
     tab is one anyone walking past can read - but a couple typing a password
     they will have to dictate needs to see what they typed. */
  check('the field hides the password by default',
    /const \[pwShown, setPwShown\] = useState\(false\)/.test(wt), true);
  check('and can reveal it', /type=\{pwShown \? "text" : "password"\}/.test(wt), true);
  check('with a control that says which it will do',
    /title=\{pwShown \? "Hide password" : "Show password"\}/.test(wt), true);
  check('and an accessible name on it',
    /aria-label=\{pwShown \? "Hide password" : "Show password"\}/.test(wt), true);
  check('the icons are imported', /Eye, EyeOff \} from "lucide-react"/.test(wt), true);

  check('the dialog opens on every switch-on',
    /if \(changes\.passwordProtected === true\) \{/.test(wt), true);
  check('not only when no password exists',
    /changes\.passwordProtected === true && !existingPw/.test(wt), false);
  /* With the existing password in the field, so switching on again is a
     confirmation rather than a re-entry. */
  check('and carries the password they already set',
    /setPwInput\(existingPw \|\| ""\)/.test(wt), true);
  check('and the editor preview is sent it',
    /password_hint: d\.passwordHint \|\| ''/.test(wt), true);
  // A hint long enough to be a paragraph is not a hint.
  check('the field is capped', /maxLength=\{140\}/.test(wt), true);
}

// ── MP-896: a save-the-date asks for an address ──────────────────────────
// The one thing a save-the-date needs back is an address, and this is the
// moment a guest is most willing to give it. A link to the collector the couple
// already has, not a second form: a second place to collect the same addresses
// is a second place for them to go missing.
{
  /* To the end of the function, not a guessed number of characters: the
     markup sits 9,500 characters in and a 9,000-character window cut it off,
     so three assertions were reading a slice that did not contain the thing
     they were about. */
  const std = rt.slice(rt.indexOf('function applySaveTheDate'),
                       rt.indexOf('_stdOwnTextRects, _stdDeoverlap'));
  check('the block reads the collector link',
    /var collector = String\(d\.contact_collector_url \|\| ''\)\.trim\(\)/.test(std), true);
  /* Only a link a browser can follow. A blank or malformed value must produce
     no control at all rather than a dead one. */
  check('only an http(s) link is used',
    /if \(!\/\^https\?:\\\/\\\/\/i\.test\(collector\)\) collector = '';/.test(std), true);
  check('the control is conditional', /collector$[\s\S]{0,40}\?/m.test(std) || /\(collector\b/.test(std), true);
  /* The wording names what it asks for. "Share your address" read as a request
     for a street address alone; the collector takes a name, an email and a
     postal address. */
  check('it says what it is for',
    /'Share your contact details'/.test(std), true);
  /* AND it can be clicked. The band it sits in carries pointer-events:none -
     it is text laid over the photograph and must not swallow a click meant for
     the page - which made the one interactive thing in it inert: a correct <a>
     with a valid href, rendered, visible, and dead to the mouse. */
  check('the control takes clicks back',
    /\.mp-std-cta\{pointer-events:auto;/.test(std), true);
  /* The band keeps its own rule: it is right for the words around the button. */
  check('and the band still lets clicks through',
    /\.mp-std-top,\.mp-std-bottom\{[\s\S]{0,160}pointer-events:none;/.test(std), true);
  check('it opens away from the page', /rel="noopener noreferrer"/.test(std), true);
  check('and the url is escaped', /esc\(collector\)/.test(std), true);

  /* It sits on the template's ACCENT band, and that block already computes an
     ink for this ground by luminance. Using the page ink would have put dark
     type on a dark band on half the designs. */
  check('it takes its colour from the band it sits on',
    /\.mp-std-cta\{[\s\S]{0,300}bandInk/.test(std), true);
  check('and nothing in this block reaches for a palette it does not have',
    /\bp\.(ink|bg|accent)\b/.test(std), false);

  /* Compared against the MARKUP, not the class name: the stylesheet mentions
     .mp-std-cta two thousand characters earlier, so the loose match found the
     CSS and reported the control as sitting above a note it is below. */
  check('the note still closes the page',
    std.indexOf('Formal invitation to follow') < std.indexOf('class="mp-std-cta"'), true);
}

// ── Every field the editor saves is one the live site can read ───────────
// Four fields have been lost between the editor and the backend this week:
// Site Background, Accent, the registry preview toggle, and the hotel booking
// link. Each time the editor wrote one column and main.py read another, or did
// not read it at all - and each was found by someone noticing a missing button
// on a live site, days later.
//
// The editor's FIELD_IDS and main.py's CF_ constants both carry the Softr field
// id, so the two sides can be matched EXACTLY rather than by column name. That
// is the whole gate: a field the couple can save has to arrive.
{
  const py = (() => { try { return fs.readFileSync('main.py', 'utf8'); } catch (e) { return null; } })();
  if (!py) { check('field round-trip (main.py not present - SKIPPED)', true, true); }
  else {
    const wt = fs.readFileSync('Website.txt', 'utf8');
    /* The map is `q.select({...})`, not a constant called FIELD_IDS - looking
       for the latter read nothing and the gate passed on an empty object,
       which is the shape of fault it exists to catch. */
    const block = (wt.match(/const select = q\.select\(\{[\s\S]*?\n\}\);/) || [''])[0];
    const editor = {};
    for (const m of block.matchAll(/^\s*(\w+):\s*"([A-Za-z0-9]{5})"/gm)) editor[m[1]] = m[2];
    check('the editor field map was read', Object.keys(editor).length > 20, true);

    /* main.py names its columns and comments each with the same id. */
    const byId = {};
    for (const m of py.matchAll(/^(CF_\w+)\s*=\s*"([^"]*)"\s*#\s*([A-Za-z0-9]{5})\b/gm)) {
      byId[m[3]] = m[1];
    }
    check('the backend constants were read', Object.keys(byId).length > 20, true);

    /* The published-site payload, which is what a guest actually receives -
       PLUS the helpers it calls. Several columns are read through one:
       _parse_font_settings, _website_mode_label, _parse_section_headings. A
       check that only looked inside the handler reported the couple's fonts as
       unreachable, which would have been alarming and wrong.

       One level of indirection is enough for the helpers that exist; if a
       second appears, this gate reports it as missing and someone extends it,
       which is the right way round. */
    const i = py.indexOf('@app.get("/wedding-site/{slug}")');
    const handler = py.slice(i, py.indexOf('@app.get("/wedding-site/{slug}/check-availability")'));
    check('the published payload was found', handler.length > 2000, true);
    let reach = handler;
    for (const m of handler.matchAll(/\b(_\w+)\s*\(/g)) {
      const fn = py.match(new RegExp('^def ' + m[1] + '\\([\\s\\S]*?(?=\\n(?:@|def |CF_))', 'm'));
      if (fn) reach += '\n' + fn[0];
    }

    /* Fields a couple can save that the live site is NOT meant to receive.
       Each one needs a reason, because "it is exempt" is how the next missing
       button gets written. */
    const EXEMPT = {
      websiteTemplate: 'decides which template file is served, not part of its payload',
      websiteStatus:   'read before the payload is built, to decide whether to serve one',
      websiteSlug:     'the key the payload is fetched BY',
      websitePassword: 'never sent to a browser; compared server-side',
      customFont:      'folded into fontSettings before it is sent',
      showHome:        'the hero is never hidden',
      showAccomodations: 'merged into the Travel toggle',
      accomodationInfo:  'merged into the Travel box',
      accomodationUrl:   'merged into the Travel box; read as a fallback only',
      finalEvents:     'a rollup, read by the editor and written by nobody',
      /* These three have no id comment on their backend constant, so they
         cannot be matched this way. They ARE read - the date and the location
         appear on every site - and the honest fix is to add the id to those
         constants, at which point these lines come out. */
      id:              'the record id, not a field of the site',
      celebrationDate: 'read, but its backend constant carries no field id to match on',
      cLocation:       'read, but its backend constant carries no field id to match on',
    };

    const missing = [];
    for (const [name, id] of Object.entries(editor)) {
      if (EXEMPT[name]) continue;
      const cf = byId[id];
      if (!cf) { missing.push(name + ' (' + id + '): no backend constant'); continue; }
      if (reach.indexOf(cf) === -1) {
        missing.push(name + ' (' + id + '): ' + cf + ' is never read by the published payload');
      }
    }
    check('every saved field reaches the live site', missing.join(' | '), '');

    /* And the exemptions stay honest: one that no longer exists in the editor
       is a note nobody will delete, quietly widening the hole. */
    const stale = Object.keys(EXEMPT).filter(k => !(k in editor));
    check('no exemption outlives its field', stale.join(','), '');
  }
}

// ── The backend reads the columns that actually exist ────────────────────
// MP-354's real cause, found once main.py was in hand: the payload read
// "Primary Color" and "Accent Color" while the Celebrations columns are named
// "Custom Colors Primary" and "Custom Colors Accent". wedding.get() returned ""
// every time, so no couple's background or accent ever reached a guest - and a
// note directly above those constants had flagged exactly this possibility.
//
// The lesson is not the two names. It is that these were the only colour fields
// read with a plain .get while every other variant-prone field went through the
// alias table, so the mistake had nothing to catch it.
{
  const py = (() => { try { return fs.readFileSync('main.py', 'utf8'); } catch (e) { return null; } })();
  if (!py) { check('backend payload (main.py not present - SKIPPED)', true, true); }
  else {
    const constOf = (name) => (py.match(new RegExp('^' + name + '\\s*=\\s*"([^"]*)"', 'm')) || [])[1];
    check('the primary colour constant names the real column',
      constOf('CF_PRIMARY_COLOR'), 'Custom Colors Primary');
    check('and so does the accent one',
      constOf('CF_ACCENT_COLOR'), 'Custom Colors Accent');

    /* Read through _cf, which is where the tolerance lives. A plain .get on a
       column whose name is wrong is silent, which is the whole story here. */
    check('the colours are read through the alias table',
      /"primary_color": _cf\(wedding, CF_PRIMARY_COLOR, ""\)/.test(py), true);
    check('both of them', /"accent_color":  _cf\(wedding, CF_ACCENT_COLOR, ""\)/.test(py), true);
    check('and neither is read with a bare get',
      /wedding\.get\(CF_(PRIMARY|ACCENT)_COLOR/.test(py), false);

    /* The old spellings stay listed: if any record anywhere still carries them,
       dropping the alias would break it the other way. */
    const aliases = (py.match(/CF_ALIASES = \{[\s\S]*?\n\}/) || [''])[0];
    check('the old column name is still accepted',
      /"Custom Colors Primary": \["Custom Colors Primary", "Primary Color"\]/.test(aliases), true);

    /* The two fields the site could not see at all. */
    check('the registry toggle is in the payload',
      /"registry_preview": bool\(_cf\(wedding, CF_REGISTRY_PREVIEW, True\)\)/.test(py), true);
    /* Default True. A couple who has never touched the switch should see the
       preview, and an unknown column name must not read as "switched off". */
    check('and defaults to showing', /CF_REGISTRY_PREVIEW, True\)/.test(py), true);
    /* The hotel booking link falls back to the Travel URL column. The two
       sections were merged into one box with ONE link, and the editor saves it
       to ZgQL7 ("Travel URL") while building its own payload's
       accommodation_url from it. Reading only MXzO9 ("Accomodation URL") - a
       column nothing writes any more - left the hotel column with no link on
       the live site, so its Book Now never rendered while the preview showed
       it. The same shape as the two colour columns. */
    check('the hotel link falls back to the column the editor writes',
      /* MP-919: the editor's column FIRST now - it is the couple's link; the old
         Accomodation URL column is only a fallback for records that predate it. */
      /"accommodation_url":\s*_clean_url\(_cf\(wedding, CF_TRAVEL_URL, ""\)\)\s*\n\s*or _clean_url\(_cf\(wedding, CF_ACCOMMODATION_URL, ""\)\)/.test(py), true);
    /* The two constants still name different columns - the fallback is a
       fallback, not a reason to point them at one place. */
    check('they remain two distinct columns',
      constOf('CF_ACCOMMODATION_URL') !== constOf('CF_TRAVEL_URL'), true);

      /* The REAL column name, read off a celebration via /debug-wedding:
       "ContactCollector Link", one word, no space. Five spellings were guessed
       at before anyone looked and none was it; the field id was tried too and
       could not work, because softr_fetch_all runs with use_field_names=True
       and the record comes back keyed by display name. */
    check('the collector column is named as it really is',
      constOf('CF_GUEST_CONNECT'), 'ContactCollector Link');
    check('and the old spellings stay as aliases',
      /"ContactCollector Link": \["ContactCollector Link", "Guest Connect Link"/.test(py), true);
    /* A field id in an alias list is dead weight here, and worse, it reads as
       though it might work. */
    check('no field id is used as an alias',
      /\["[^"]*", "[A-Za-z0-9]{5}",/.test((py.match(/CF_ALIASES = \{[\s\S]*?\n\}/) || [''])[0]), false);

    check('the collector link is in the payload',
      /"contact_collector_url": _clean_url\(_cf\(wedding, CF_GUEST_CONNECT, ""\)\)/.test(py), true);

    /* The hint rides with the LOCK SCREEN, which is the one branch that returns
       to someone who has not proved they belong. It is written to be read at
       the gate, so it carries no privacy weight - but the names, the date and
       the photographs do, and that branch must still return none of them. */
    const locked = (py.match(/if is_pw and not pwd_correct:[\s\S]*?"message": "This website is password protected"\}/) || [''])[0];
    check('the lock screen was found', locked.length > 60, true);
    check('the hint is returned with it', /"password_hint":/.test(locked), true);

    /* THE TEMPLATE GOES OUT WITH THE GATE.

       This branch withheld it along with everything else, so api/site.js had
       nothing to match on and served its default - Pressed Petals - to every
       password-protected site. The couple's own design never appeared, in the
       page or in the tab, whatever they had chosen.

       It is not private: which design a couple picked says nothing about them,
       and the page already serves one of ten template files a guest can read
       in full. */
    check('the template is returned with the gate',
      /"template": _gate_template/.test(locked), true);
    /* Resolved inside the branch. The assignment further down runs after this
       has returned, so naming it there would raise NameError and turn every
       locked site into a 500. */
    check('and resolved where it is used',
      /_gate_template = \(_get_select_label\(wedding\.get\(CF_TEMPLATE\)\) or "Classic"\)\.lower\(\)/.test(locked), true);
    for (const leak of ['couple_names', 'hero_image', 'celebration_date', 'partner_1', 'custom_css']) {
      check('the lock screen still withholds ' + leak, locked.indexOf(leak), -1);
    }
  }
}

// ── Bold inside a title shows, unless it wraps the whole line ────────────
// The box flattened any <strong> inside a title: "mp-t strong{font-weight:400}".
// That is right for one wrapping a WHOLE title, because markBlock unwraps those
// - but it also killed bold applied to part of a line, which the site keeps. A
// couple bolding three words of a Need to Knows question watched nothing
// happen in the Content box while the site rendered it correctly.
{
  const wt = fs.readFileSync('Website.txt', 'utf8');

  /* Decided where the title is marked, not in CSS. :only-child does not help:
     it counts element children and ignores text, so a <strong> with words
     either side of it still matches. */
  const src = wt.slice(wt.indexOf('      const wholeBold ='), wt.indexOf("      return '<mp-t'"));
  check('the whole-line test exists', src.length > 60, true);
  // The slice also holds the MP-918 card counter, which reads these two.
  const isWhole = new Function('head', 'var _cards = 0, titleLine = false, weight = "400", ls = null;\n' + src + ' return wholeBold;');
  check('a wholly bold title is flattened',
    isWhole('<strong>What should I wear?</strong>'), true);
  check('even with markup inside it',
    isWhole('<strong>What <em>should</em> I wear?</strong>'), true);
  /* The ones the site KEEPS must keep their weight in the box too. */
  check('bold on part of a line stays', isWhole('Some <strong>words</strong> bold'), false);
  check('and two separate runs stay', isWhole('<strong>a</strong> and <strong>b</strong>'), false);
  check('a plain title is unaffected', isWhole('What should I wear?'), false);

  /* The CSS follows the mark rather than matching every nested strong. */
  check('the rule is scoped to the mark',
    /\[contenteditable\] mp-t\[data-whole-bold\] strong/.test(wt), true);
  check('and no longer flattens any bold in a title',
    /\[contenteditable\] mp-t strong,/.test(wt), false);
  check('the mark is written onto the tag',
    /\(wholeBold \? ' data-whole-bold="1"' : ''\)/.test(wt), true);
  /* The marks are stripped on the way out, so this attribute must go with
     them - it is the box's business, not the record's. */
  check('and leaves with the rest of the mark',
    /replace\(\/<mp-t\\b\[\^>\]\*>\|<\\\/mp-t>\/gi, ""\)/.test(wt), true);
}

// ── MP-915: the format buttons show what applies ─────────────────────────
// btnStyle has taken an `active` flag since it was written and every call site
// passed false, so B, I and U never lit up - a couple could not tell whether
// the words under the cursor were already bold without trying it and looking.
{
  const wt = fs.readFileSync('Website.txt', 'utf8');
  check('the buttons read their state', /const \[fmt, setFmt\] = useState\(/.test(wt), true);
  for (const [cmd, prop] of [['bold', 'fmt.bold'], ['italic', 'fmt.italic'],
                             ['underline', 'fmt.underline']]) {
    check(cmd + ' is lit from the caret',
      new RegExp('exec\\("' + cmd + '"\\); \\}\\} style=\\{(?:\\{ \\.\\.\\.)?btnStyle\\(' +
        prop.replace('.', '\\.') + '\\)').test(wt), true);
  }
  check('none is hardwired to off any more',
    /exec\("(bold|italic|underline)"\); \}\} style=\{(?:\{ \.\.\.)?btnStyle\(false\)/.test(wt), false);

  /* queryCommandState answers for the current selection, read on
     selectionchange - the one event that fires for a click, an arrow key and a
     drag alike. */
  /* Still queryCommandState - asked of the document that holds the words - and
     the rendered weight beside it, since browsers do not all answer for the
     same window (MP-915: a selected bold word left B unlit). */
  check('state comes from the document, not a guess',
    /d\.queryCommandState\("bold"\)/.test(wt) && /parseInt\(cs\.fontWeight, 10\) >= 600/.test(wt), true);
  check('and is refreshed on selection changes',
    /docs\.forEach\(d => d\.addEventListener\("selectionchange", _syncFmt\)\)/.test(wt), true);
  /* Removed again, or every box ever opened keeps a listener on a shared
     document for the life of the page. */
  check('the listener is removed on unmount',
    /docs\.forEach\(d => d\.removeEventListener\("selectionchange", _syncFmt\)\)/.test(wt), true);
  /* execCommand raises no selectionchange of its own, so without this the
     buttons would show the state from before the command. */
  check('and after each command',
    /_keepOffMarks\(\(\) => _doc\(\)\.execCommand\(cmd, false, null\)\);[\s\S]{0,900}_syncFmt\(\);/.test(wt), true);

  /* ONLY when the caret is in THIS box. The event is document-wide and every
     section on the page has one of these toolbars; without the containment
     test, typing in Our Story would light up the buttons above Travel. */
  /* Through _liveSelection, which keeps only a selection inside THIS box, and
     again on the element the state is read from. */
  check('a caret in another box is ignored',
    /const r = _rangeInBox\(\);/.test(wt) && /if \(!el \|\| !host\.contains\(el\)\) return;/.test(wt), true);
  /* Softr renders the editor inside a shadow root, which window.getSelection()
     does not see into: the buttons never lit there (MP-915, as tested). The
     state reads the shadow root's own selection, then the windows, then the
     standard getComposedRanges. */
  check('the button state can see into a shadow root',
    /root\.getSelection\(\)/.test(wt) && /getComposedRanges/.test(wt), true);
  /* And reading it cannot throw: queryCommandState is unsupported in some
     embedded views and this runs on every caret move. */
  check('reading the state cannot break typing',
    /const _syncFmt = \(\) => \{\s*\n\s*try \{/.test(wt), true);
}

// ── MP-916: a spacer holds nothing ───────────────────────────────────────
// The spacer is an empty block-level span, and a contenteditable will happily
// put the caret inside one - so a couple typing after a gap could type INTO it.
// Twelve pixels tall with the text overflowing, that reads as lines overlapping
// the space; and a line that lands inside one is a line the templates never
// render, because markStructure splits on breaks and text buried in a span
// between them is not a line at all. Three lines arriving as two.
{
  const { JSDOM } = (() => { try { return require('jsdom'); } catch (e) { return {}; } })();
  const wt = fs.readFileSync('Website.txt', 'utf8');

  /* New spacers cannot be typed into. */
  check('the spacer is inert',
    /<span class="mp-gap" contenteditable="false" style="display:block;height:12px"><\/span>/.test(wt), true);
  /* And everything leaving the box is repaired, for gaps saved before that
     attribute existed or dragged in since. */
  check('the repair runs on the way out',
    /* _gapBreaks too (MP-916): the line break the browser drops beside a
       spacer goes back before the record is written. */
    /const str = _gapBreaks\(_emptyGaps\(_stripTitleMarks\(html\)\)\)/.test(wt), true);

  if (!JSDOM) { check('spacer repair (jsdom not installed - SKIPPED)', true, true); }
  else {
    const src = wt.slice(wt.indexOf('const _emptyGaps = (html) =>'),
                         wt.indexOf('  const _stripTitleMarks'));
    const dom = new JSDOM('<!doctype html>');
    const fix = new Function('_doc',
      src.replace(/^\s*const _emptyGaps = /, 'return ') + ';')(() => dom.window.document);
    const G = '<span class="mp-gap" style="display:block;height:12px">';

    /* THE WORDS SURVIVE. A line typed into a gap is the couple's writing, and
       emptying the gap by discarding it would turn a display fault into data
       loss - which is worse than the bug. */
    const one = fix('a<br>' + G + 'lost line</span>');
    check('a line typed into a gap is kept', one.indexOf('lost line') > -1, true);
    check('and moved out in front of it',
      one.indexOf('lost line') < one.indexOf('mp-gap'), true);
    const three = fix('a<br>' + G + 'two<br>three</span>');
    check('several lines all come back',
      three.indexOf('two') > -1 && three.indexOf('three') > -1, true);
    check('in their own order', three.indexOf('two') < three.indexOf('three'), true);

    /* The gap itself stays - it is the couple's spacing - and is made inert. */
    check('the gap is not removed', /mp-gap/.test(one), true);
    check('and is made inert', /contenteditable="false"/.test(one), true);
    /* An ordinary box is returned untouched, and the cheap exit is taken. */
    check('content with no gaps is untouched', fix('plain<br>text'), 'plain<br>text');
    check('and nothing is returned as undefined', typeof fix(''), 'string');
  }
}

// ── The eraser actually strips the font ──────────────────────────────────
// It appeared to do nothing but select the box. removeFormat only undoes
// formatting execCommand itself applied - bold, italic, underline, a <font>
// tag - and the font picker writes <span style="font-family:...">, which it
// leaves exactly where it is. So the button selected everything, ran a command
// that found nothing of its own to remove, and finished.
{
  const { JSDOM } = (() => { try { return require('jsdom'); } catch (e) { return {}; } })();
  const wt = fs.readFileSync('Website.txt', 'utf8');
  /* It takes the range to work in now - the selected words, or null for the
     whole section - because reading window.getSelection() inside it could not
     see into Softr's shadow root and always stripped the whole section. */
  check('the strip exists', /const _stripFonts = \(host, range\) =>/.test(wt), true);
  check('and the eraser calls it before removeFormat',
    /_stripFonts\(host, hasSel \? picked : null\);[\s\S]{0,1400}exec\("removeFormat"\);/.test(wt), true);

  if (!JSDOM) { check('eraser behaviour (jsdom not installed - SKIPPED)', true, true); }
  else {
    const src = wt.slice(wt.indexOf('const _stripFonts = (host, range) =>'),
                         wt.indexOf('  const exec = (cmd) =>'));
    const dom = new JSDOM('<!doctype html><body><div id=h></div></body>');
    const host = dom.window.document.getElementById('h');
    const strip = new Function('_win',
      src.replace(/^\s*const _stripFonts = /, 'return ') + ';')(() => dom.window);
    const run = (html) => { host.innerHTML = html; strip(host); return host.innerHTML; };

    /* The thing the button is for. */
    check('a font span is removed',
      run('<span style="font-family: X">Ceremony</span>'), 'Ceremony');
    check('including the entity-quoted form the editor writes',
      run('<span style="font-family: &quot;Dancing Script&quot;, serif;">a</span>'), 'a');
    check('and a font size', run('<span style="font-size:2rem">a</span>'), 'a');

    /* NOT bold, italic or underline. The tooltip says fonts, and a couple who
       bolded one line did not ask for that to go. */
    check('bold survives', run('<b>Bold</b> text'), '<b>Bold</b> text');
    check('and underline', run('<u><span style="font-family:X">a</span></u>'), '<u>a</u>');

    /* The spacer is structural - display and height, no font - and removing it
       would change the layout the couple built. */
    check('the spacer is untouched',
      run('<span class="mp-gap" style="display:block;height:12px"></span>'),
      '<span class="mp-gap" style="display:block;height:12px"></span>');
    /* A span keeping a non-font declaration keeps its wrapper too. */
    check('only the font declarations go',
      run('<span style="font-family:X;letter-spacing:2px">a</span>'),
      '<span style="letter-spacing:2px">a</span>');
    /* Structure is never touched. */
    check('line breaks survive', run('a<br>b'), 'a<br>b');
    check('and so do links',
      run('<a href="/x"><span style="font-family:X">go</span></a>'), '<a href="/x">go</a>');
  }
}

// ── MP-920 / MP-921: a new block is added at the end ─────────────────────
// "+ Event" and "+ Question" inserted at the CURSOR. Click with the caret
// still at the top of the box - where it is when you have not typed yet, or
// have just clicked in - and the two leading breaks landed above everything:
// a gap at the top of the field, and the item that used to be first now
// sitting under the new one with no obvious way to get it back.
{
  const wt = fs.readFileSync('Website.txt', 'utf8');
  const fn = wt.slice(wt.indexOf('const startNewBlock'), wt.indexOf('const insertGap'));
  check('the add-a-block handler was found', fn.length > 100, true);

  /* The caret goes to the END first. collapse(false) is the whole fix; without
     it the insert lands wherever the couple last clicked. */
  check('it selects the whole box', /r\.selectNodeContents\(host\)/.test(fn), true);
  check('and collapses to the end', /r\.collapse\(false\)/.test(fn), true);
  check('before inserting', fn.indexOf('collapse(false)') < fn.indexOf('insertHTML'), true);

  /* The separator is omitted when there is nothing to separate from - into an
     empty box those two breaks are just a gap. */
  check('leading breaks are conditional', /\(hasText \? "<br><br>" : ""\)/.test(fn), true);
  check('and emptiness ignores markup',
    /replace\(\/<\[\^>\]\*>\/g, ''\)/.test(fn), true);
  check('and entities', /&nbsp;\|&#160;/.test(fn), true);

  /* The block itself is unchanged: first line bold, then a line to type on.
     Templates split on two or more breaks, so the pair between blocks is what
     makes this a new card rather than another line of the last one. */
  /* NO <strong>. A title is the first line of its block, marked in the box by
     position with <mp-t> and taken by the site the same way. The bold tag did
     nothing but make the words look bold in the Content field - it never
     reached the page, because markBlock unwraps a <strong> wrapping a whole
     first line, which is why the preview looked right and the box did not. */
  /* The title first, then its second line: "New answer" under a question
     (MP-921 - the answer line was empty, with no hint where it goes), an
     empty line under anything else. */
  check('the new block starts with its title',
    /"New " \+ \(blockNoun \|\| "section"\) \+ "<br>" \+ second/.test(fn) &&
    /const second = blockNoun === "question" \? "New answer" : "&nbsp;";/.test(fn), true);
  check('and is not bolded', /<strong>New /.test(fn), false);
  /* The box still SHOWS it as a title - that marking is by position and owes
     nothing to the tag just removed. */
  check('titles are still marked by position',
    /const _markTitles = \(html\) =>/.test(wt), true);
  check('with a tag of their own, stripped on the way out',
    /replace\(\/<mp-t\\b\[\^>\]\*>\|<\\\/mp-t>\/gi, ""\)/.test(wt), true);
  /* Still goes through _clean, or the editor's own markup rules are skipped
     for exactly the content a couple adds most often. */
  check('the result is cleaned', /onChange\(_clean\(host\.innerHTML\)\)/.test(fn), true);
}

// ── MP-912 / MP-917: one switch is one change, and the eraser is honest ──
{
  const wt = fs.readFileSync('Website.txt', 'utf8');

  /* MP-912. The RSVP switch writes two fields - the section toggle and whether
     the form accepts replies. _bundledKeys is exactly the set the counter
     skips, and both were being DELETED from it, so one flick was reported as
     "2 unsaved changes" and the couple had to wonder what the other was. */
  check('the companion field is bundled, not counted',
    /_bundledKeys\.current\.add\("rsvpEnabled"\);/.test(wt), true);
  check('and the switch itself still counts',
    /_bundledKeys\.current\.delete\("showRSVP"\);/.test(wt), true);
  check('neither is deleted from the set any more',
    /_bundledKeys\.current\.delete\("rsvpEnabled"\)/.test(wt), false);
  /* The counter has to actually skip that set, or bundling means nothing. */
  /* Still skipped; customCss is now counted pair by pair instead (MP-949). */
  check('the counter skips bundled keys',
    /Object\.keys\(localChanges\)\.filter\(k => k !== "customCss" && !_bundledKeys\.current\.has\(k\)\)/.test(wt), true);
  /* Both fields still get written - counting them as one must not stop one
     being saved. */
  check('both fields are still saved',
    /applyChanges\(\{ showRSVP: c, rsvpEnabled: c \}\)/.test(wt), true);

  /* MP-917. The tooltip claims only what the button does. It clears fonts and
     sizes (_stripFonts) AND bold, italic and underline (removeFormat, which
     always ran after it), from the selected words - or the whole section when
     nothing is selected, which it now actually honours. Not colours: there is
     no colour control at the content level. */
  check('the eraser tooltip claims only what it does',
    /title="Clear formatting — the selected words, or the whole section if nothing is selected"/.test(wt), true);
  check('and no longer mentions colours',
    /Strip fonts and colours/.test(wt), false);
}

// ── MP-903: the two reset controls look the same ─────────────────────────
// The Fonts reset coloured itself from its own state - dark while fonts were
// set, pale blue once they were not - so clearing them changed the button's
// colour at the moment of the click. That reads as a pressed state rather than
// as a control going quiet, and it disagreed with the reset sitting above it in
// Colors, which never changes.
{
  const wt = fs.readFileSync('Website.txt', 'utf8');
  const hex = (label) => {
    const i = wt.indexOf('\u21ba ' + label);
    const seg = wt.slice(Math.max(0, i - 900), i);
    const m = [...seg.matchAll(/color: "(#[0-9A-Fa-f]{6})"/g)];
    return m.length ? m[m.length - 1][1].toLowerCase() : null;
  };
  const colours = hex('Reset to template colors');
  const fonts = hex('Reset to template default');
  check('both reset controls were found', !!colours && !!fonts, true);
  check('and they are the same ink', fonts, colours);
  /* No second colour conditional on state - that is the thing that looked like
     a click. The enabled difference rides on opacity, one hue. */
  check('the ink does not change with state',
    /color: \(currentData\.fontSettings \|\| currentData\.customFont\) \? "#\w+" : "#\w+"/.test(wt), false);
  check('the difference is carried by opacity',
    /opacity: \(currentData\.fontSettings \|\| currentData\.customFont\) \? 1 : 0\.45/.test(wt), true);
  /* And a control that does nothing should not invite a click. */
  check('it is disabled when there is nothing to reset',
    /disabled=\{!\(currentData\.fontSettings \|\| currentData\.customFont\)\}/.test(wt), true);
  check('with a cursor that says so',
    /cursor: \(currentData\.fontSettings \|\| currentData\.customFont\) \? "pointer" : "default"/.test(wt), true);

  /* BOTH controls, or they disagree about their own state - which is what the
     report was: Fonts went quiet with nothing to reset, Colors stayed lit. */
  check('the colours reset is disabled the same way',
    /disabled=\{!_coloursChanged\}/.test(wt), true);
  check('and dims rather than changing colour',
    /opacity: _coloursChanged \? 1 : 0\.45/.test(wt), true);
  check('with the same cursor treatment',
    /cursor: _coloursChanged \? "pointer" : "default"/.test(wt), true);
  /* "Changed" has to mean anything this button would clear - the two columns
     or any tone in customCss - or it goes quiet while still having work to do. */
  check('changed means any of the seven',
    /const _coloursChanged = !!\(currentData\.primaryColor \|\| currentData\.accentColor \|\|\s*\n\s*COLOR_CSS_VARS\.some/.test(wt), true);
  /* Both resets use one ink. A second colour conditional on state is what read
     as a click in the first place. */
  const inks = [...wt.matchAll(/\u21ba Reset to template/g)].map(m => {
    const seg = wt.slice(Math.max(0, m.index - 700), m.index);
    const c = [...seg.matchAll(/color: "(#[0-9A-Fa-f]{6})"/g)];
    return c.length ? c[c.length - 1][1].toLowerCase() : null;
  });
  check('both resets were found', inks.length, 2);
  check('and share one ink', inks[0], inks[1]);
}

// ── MP-908: a toggle the couple set reaches the live site ────────────────
// registry_preview is built by the editor from a record column, and the live
// page fetches the record straight from the API - where that column does not
// appear. The runtime tested `=== false`, so an absent key read as "not
// switched off" and the preview showed whether the toggle was on or not.
// Exactly the fault MP-354 had with Site Background and Accent, and the same
// remedy: custom_css is the one channel proven to carry a couple's settings.
{
  const off = new Function(lift(rt, ['_cssFlag', '_flagOff']) + '\nreturn _flagOff;')();
  const F = (d) => off(d, 'registry_preview', 'registry-preview');

  /* The column wins where it exists - in the editor's own payload it is
     immediate, and a couple flipping the switch must see it at once. */
  check('the editor payload still decides when it is present', F({ registry_preview: false }), true);
  check('and on means on', F({ registry_preview: true }), false);
  /* On the live site there is no column, so the flag has to come from
     custom_css or the switch does nothing at all. */
  check('custom_css carries it when the column is absent',
    F({ custom_css: '--registry-preview:0; --bg:#fff;' }), true);
  check('and carries on as well', F({ custom_css: '--registry-preview:1;' }), false);
  /* Default is ON. A couple who has never touched the switch should see the
     preview, so an absent flag must not read as off. */
  check('nothing set leaves it showing', F({ custom_css: '--bg:#fff;' }), false);
  check('and an empty payload does too', F({}), false);
  check('and a missing one', F(null), false);
  /* The flag must not be confused with a colour sitting beside it. */
  check('a lookalike variable is not mistaken for it',
    F({ custom_css: '--registry-preview-x:0;' }), false);

  /* All three call sites, or the preview is suppressed in one place and built
     in another. */
  const raw = (rt.match(/d\.registry_preview === false/g) || []).length;
  check('no call site tests the column directly any more', raw, 0);
  check('all three go through the flag',
    (rt.match(/_flagOff\(d, 'registry_preview', 'registry-preview'\)/g) || []).length, 3);

  /* And the editor has to write it. */
  const wt = fs.readFileSync('Website.txt', 'utf8');
  check('the toggle writes into custom_css too',
    /_setVarColor\('registry-preview', on \? '1' : '0'\)/.test(wt), true);
  check('and still writes its column',
    /handleUpdate\("showRegistryPreview", on\)/.test(wt), true);
}

// ── MP-910: every piece of text answers to a slider ──────────────────────
// Whimsical Romance paints <body> with --text and everything else with --ink.
// The two hold the same colour, so the split was invisible until a couple moved
// Text1 and watched the body copy stay where it was. Scanned rather than
// listed: a colour no slider reaches is the thing to find, on any template.
{
  const vars = new Function(rt.match(/var TEMPLATE_COLOR_VARS = \{[\s\S]*?\n  \};/)[0] +
    '\nreturn TEMPLATE_COLOR_VARS;')();
  const rules = (css) => {
    const out = []; let i = 0;
    while (i < css.length) {
      const o = css.indexOf('{', i); if (o < 0) break;
      let d = 1, k = o + 1;
      while (k < css.length && d) { if (css[k] === '{') d++; else if (css[k] === '}') d--; k++; }
      const sel = css.slice(i, o).replace(/\/\*[\s\S]*?\*\//g, '').trim();
      const body = css.slice(o + 1, k - 1);
      if (sel && !sel.startsWith('@')) out.push([sel, body]);
      if (sel.startsWith('@')) out.push(...rules(body));
      i = k;
    }
    return out;
  };
  const beyond = [];
  for (const t of Object.keys(vars)) {
    const src = fs.readFileSync('template-' + t + '.html', 'utf8');
    const css = [...src.matchAll(/<style>([\s\S]*?)<\/style>/g)].map(m => m[1]).join('\n');
    const mapped = new Set();
    for (const v of Object.values(vars[t])) {
      (Array.isArray(v) ? v : [v]).forEach(x => mapped.add(x));
    }
    for (const [, body] of rules(css)) {
      for (const m of body.matchAll(/(?:^|;)\s*(?:color|fill)\s*:\s*[^;]*var\((--[\w-]+)\)/g)) {
        if (!mapped.has(m[1])) beyond.push(t + ': ' + m[1]);
      }
    }
  }
  check('no text colour is beyond every slider', [...new Set(beyond)].join(' | '), '');

  /* A slot may name several variables. That is what fixes the alias above, and
     the application has to flatten them or only the first is ever written. */
  check('a slot may drive more than one variable',
    Array.isArray(vars.whimsicalromance.ink), true);
  /* To the end of the function. A fixed character window is a gate that goes
     quietly wrong every time the function grows - the colour trace pushed the
     flattening past 3000 and this read a slice without it in. */
  const fn = rt.slice(rt.indexOf('function applyCustomColors'),
                      rt.indexOf('/* \u2500\u2500 FONTS BY ROLE'));
  check('and the application flattens them',
    /\[object Array\]/.test(fn) && /flat\.push\(\[names\[q\], pairs\[p\]\[1\]\]\)/.test(fn), true);
}

// ── MP-329 / MP-901 / MP-904: an empty section collapses ─────────────────
// Every section starts seeded, so a field that arrives empty can only mean the
// couple emptied it - there is no "never filled in" to tell apart. Empty means
// gone, everywhere, and the Design toggle is the only other thing that hides a
// section.
//
// It was none of those things. Some designs kept their shipped placeholder and
// showed stock event names over an empty box; others collapsed; Our Story
// collapsed only on a SECOND clear, because the first left a filler <br> and
// that is not nothing to an `if (d.story)` test. Three reports, one rule.
{
  const { JSDOM } = (() => { try { return require('jsdom'); } catch (e) { return {}; } })();
  if (!JSDOM) { check('empty sections (jsdom not installed - SKIPPED)', true, true); }
  else {
    const anchors = rt.match(/var SECTION_ANCHORS = \{[\s\S]*?\n  \};/)[0];
    const content = rt.match(/var SECTION_CONTENT = \{[\s\S]*?\n  \};/)[0];
    check('both tables were found', !!anchors && !!content, true);
    const ids = ['hero', 'our-story', 'events-primary', 'other-events', 'travel-section',
                 'accommodations', 'need-to-know', 'things-to-do',
                 'registry-section', 'rsvp', 'gallery'];
    /* Each section has a heading and some of the design's sample copy, so the
       three outcomes can be told apart: GONE (switched off in Design), EMPTIED
       (the section and its heading stay, the copy under it is set aside -
       MP-901/904: only the Design toggle hides a section), and SHOWN. */
    const fresh = () => new JSDOM('<!doctype html><body>' +
        ids.map(i => '<section id="' + i + '"><h2>Heading</h2><p>Sample copy</p></section>').join('') +
        '</body>').window.document;
    const make = (doc) => new Function('document', anchors + '\n' + content + '\n' +
        'var _emptiedNodes = {};\n' +
        /* Every helper the pass calls - a harness missing one throws, which
           reads as a broken suite rather than a broken runtime. */
        lift(rt, ['_hasText', '_hideSection', '_headingNode', '_emptySection', '_unemptySection',
                  'collapseEmptySections']) +
        '\nreturn collapseEmptySections;')(doc);
    const state = (doc) => {
      const out = {};
      ids.forEach(i => {
        const sec = doc.getElementById(i);
        if (sec.style.display === 'none') out[i] = 'gone';
        else if (sec.querySelector('p').style.display === 'none' && sec.querySelector('h2').style.display !== 'none') out[i] = 'emptied';
        else out[i] = 'shown';
      });
      return out;
    };
    const run = (d) => { const doc = fresh(); make(doc)(d); return state(doc); };

    /* MP-911. A section the couple switched OFF goes, whatever the template
       does about it. Templates gate their own sections on the toggle and do it
       inconsistently - some skip populating but leave the shipped markup
       standing, so Travel kept a Hotel card and the FAQ heading stayed up with
       its questions gone. */
    const off = run({ menu_config: { travel: false, faqs: false, registry: false },
                      story: 'x', weddings_info: 'x', events_info: 'x', faqs: 'q',
                      things_to_do: 'x', travel_info: 't', accommodation_info: 'h' });
    check('a section switched off goes even with content in it', off['travel-section'], 'gone');
    check('and its merged half goes with it', off['accommodations'], 'gone');
    check('the faq heading goes too', off['need-to-know'], 'gone');
    /* Registry, RSVP and Gallery are exempt from the EMPTY test - a form and a
       gift list are worth showing with no words in them - but nothing is
       exempt from the couple having switched it off. */
    check('registry is exempt from empty but not from the toggle',
      off['registry-section'], 'gone');
    check('and sections left on are untouched',
      [off['our-story'], off['things-to-do'], off['rsvp']].join(','), 'shown,shown,shown');
    /* Home is never hidden: there is no toggle for it and nothing to fall back
       to if it went. */
    check('home is never hidden',
      run({ menu_config: { home: false } })['hero'], 'shown');

    const all = run({ story: '', weddings_info: '', events_info: '', travel_info: '',
                      accommodation_info: '', faqs: '', things_to_do: '' });
    check('an emptied story stays, its copy set aside', all['our-story'], 'emptied');
    check('an emptied wedding section stays, its copy set aside', all['events-primary'], 'emptied');
    check('an emptied other-events stays, its copy set aside', all['other-events'], 'emptied');
    check('an emptied travel stays, its copy set aside', all['travel-section'], 'emptied');
    check('an emptied faqs stays, its copy set aside', all['need-to-know'], 'emptied');
    check('an emptied things-to-do stays, its copy set aside', all['things-to-do'], 'emptied');

    /* These are worth showing with nothing in them: a clickable registry title,
       a form, and photographs that are not copy at all. Collapsing them would
       take away a working control because a text box was blank. */
    check('the registry is never collapsed by this', all['registry-section'], 'shown');
    check('nor the rsvp form', all['rsvp'], 'shown');
    check('nor the gallery', all['gallery'], 'shown');

    /* MARKUP WITH NO WORDS IS EMPTY. This is the whole of MP-904: the first
       clear left a filler <br>, which passed an `if (d.story)` test, so the
       section only went on the second. */
    check('a filler break counts as empty',
      run({ story: '<br data-mp-filler="1">' })['our-story'], 'emptied');
    check('as does a single space', run({ story: '&nbsp;' })['our-story'], 'emptied');
    check('and empty markup', run({ story: '<b></b><br>' })['our-story'], 'emptied');
    /* Typing again gives back exactly what was set aside. */
    {
      const doc = fresh(); const pass = make(doc);
      pass({ story: '' }); pass({ story: 'We met in 2019' });
      check('typing again brings the copy back', state(doc)['our-story'], 'shown');
    }
    check('but real words keep it', run({ story: 'We met in 2019' })['our-story'], 'shown');
    check('and words inside markup do too',
      run({ story: '<b>We met</b>' })['our-story'], 'shown');

    /* Travel and Accommodations are ONE section fed by one box the runtime
       cuts in two, so either half being filled means it has content. Keeping
       them separate took the band down on the designs where #accommodations IS
       the travel band, with the couple's flights still in it. */
    const hotel = run({ accommodation_info: 'Hyatt', travel_info: '' });
    check('a hotel with no flights keeps travel up', hotel['travel-section'], 'shown');
    check('and keeps the merged band up', hotel['accommodations'], 'shown');
    const flights = run({ accommodation_info: '', travel_info: 'Fly to SAN' });
    check('flights with no hotel keep it up too', flights['travel-section'], 'shown');
    check('and the merged band with it', flights['accommodations'], 'shown');

    /* It has to run AFTER the template has built itself, or a section the
       template populates from its own markup is taken down and then put back. */
    const h = rt.slice(rt.indexOf('collapseEmptySections(d);') - 400,
                       rt.indexOf('collapseEmptySections(d);') + 200);
    check('it runs after the template has built itself',
      /hydrateTemplate|layOutRegistry|hideDeadCtas/.test(h), true);
    check('and before the page is revealed',
      rt.indexOf('collapseEmptySections(d);') < rt.indexOf('revealWhenHeroReady();'), true);
  }
}

// ── MP-905 / MP-909: the RSVP line is markup, not text ───────────────────
// That box is the same rich-text editor as every other section, so it produces
// HTML: a typed space is &nbsp; and a line break is <br>. The line was written
// with textContent, which printed both literally - "&nbsp;" on the page, and a
// <br> left standing in a box the couple had cleared.
{
  const note = new Function(rt.slice(rt.indexOf('function _noteHtml'),
    rt.indexOf('function applyCustomColors')) + '\nreturn _noteHtml;')();

  check('a typed space survives as markup',
    note('reply by<br>the 1st&nbsp;of May'), 'reply by<br>the 1st&nbsp;of May');
  check('and plain text is untouched', note('Kindly reply by May 1st'), 'Kindly reply by May 1st');

  /* EMPTY IS NOT ''. The editor leaves a filler <br> so the browser shows the
     last line break, and a cleared box can hold nothing but that. All of it is
     markup with no text in it, and none of it should reach the page - it has
     to fall through to the deadline and then to the template's own line. */
  check('a cleared box is empty', note('<br data-mp-filler="1">'), '');
  check('a box holding one space is empty', note('&nbsp;'), '');
  check('as is one holding only breaks', note('<br><br>'), '');
  check('and an absent note', note(''), '');
  check('and a null one', note(null), '');

  /* It must be written as HTML, or none of the above matters. */
  /* 2600, not 1600: the comment explaining the markup change sits inside this
     window and pushed the date fallback past the end of it, so the slice
     stopped containing the thing being asserted. */
  const hyd = rt.slice(rt.indexOf('var deadlineEl = document.getElementById'),
                       rt.indexOf('var deadlineEl = document.getElementById') + 2600);
  check('the line is rendered as markup', /deadlineEl\.innerHTML = note;/.test(hyd), true);
  check('and not as text', /deadlineEl\.textContent = String\(note\)/.test(hyd), false);
  /* The two fallbacks behind it have to stay reachable: a couple with no note
     but a deadline keeps their date, and one with neither keeps the template's
     own wording. */
  /* Both now live in _rsvpEmptyLineHtml (MP-905), which the page and the
     editor's placeholder share: the deadline in the design's own phrasing,
     else - live - nothing, else - preview - a hint. */
  const emptyFn = lift(rt, ['_rsvpEmptyLineHtml']);
  check('a deadline still fills the line when there is no note',
    /_rsvpEmptyLineHtml\(d, false\)/.test(hyd) && /if \(deadline\) return/.test(emptyFn), true);
  check('and the template keeps its own phrasing around the date',
    /lead \? lead\[1\] : 'by '/.test(emptyFn), true);
}

// ── Heirloom Bloom: the four it was reported for ─────────────────────────
// MP-926, 927, 928, 919. One template, four small faults, all of them things
// the travel merge left behind or a fixed height could not accommodate.
{
  const hb = fs.readFileSync('template-heirloombloom.html', 'utf8');

  /* MP-927. The two sections became one band and this design kept both menu
     entries, so the drawer listed Travel twice and the second scrolled to an
     empty anchor. */
  /* THE BUILDER, not the markup. Two templates rebuild #menuLinks from a JS
     array on every hydrate, so the static <ul> is overwritten and editing it
     changes what ships and nothing that renders. The first fix did exactly
     that: the markup had one entry, the page still showed two.

     Checked wherever the menu is assembled, which for these two is the array. */
  /* Comments stripped first. My own note about the entry I removed contained
     the very string this looks for, so the gate reported the fix as the fault. */
  const nocomment = (t) => t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/<!--[\s\S]*?-->/g, '');
  const menuSrc = (src) => {
    const i = src.indexOf('var items=[');
    return i === -1 ? '' : nocomment(src.slice(i, src.indexOf('ml.innerHTML', i)));
  };
  /* MENU LINKS only. Counting every >Travel< on the page caught section
     headings and card titles, which are not menu entries and are meant to say
     Travel. The list element is what the report was about. */
  const menuMarkup = (src) => {
    const m = nocomment(src).match(/<ul[^>]*(?:menu-links|menuLinks)[^>]*>[\s\S]*?<\/ul>/i);
    return m ? m[0] : '';
  };
  const builders = [];
  for (const t of fs.readdirSync('.').filter(f => /^template-.*\.html$/.test(f)).sort()) {
    const src = fs.readFileSync(t, 'utf8');
    const name = t.replace('template-', '').replace('.html', '');
    const menu = menuSrc(src);
    const labels = (menu.match(/l(?:abel)?:\s*'Travel'/g) || []).length;
    if (labels > 1) builders.push(name + ': ' + labels + ' Travel entries in its builder');
    const statics = (menuMarkup(src).match(/>Travel</g) || []).length;
    if (statics > 1) builders.push(name + ': ' + statics + ' Travel links in its markup');
    /* No link to an anchor the design does not have: it scrolls nowhere, and
       the runtime cannot relabel what it cannot find. */
    if (/h(?:ref)?:\s*'#travel'/.test(menu) && !/id="travel"/.test(src))
      builders.push(name + ': links #travel but has no such section');
  }
  check('one Travel entry per design, wherever the menu is built',
    builders.join(' | '), '');
  check('Travel appears once in the shipped list',
    ((hb.match(/<ul[^>]*menuLinks[^>]*>[\s\S]*?<\/ul>/i) || [''])[0].match(/>Travel</g) || []).length, 1);

  /* MP-926. The booking link is a HOTEL booking link. Every other design puts
     it under Hotels; this one had a second copy under the flights column. */
  const flights = hb.slice(hb.indexOf('Flights \u2014 the second column'),
                           hb.indexOf('Flights \u2014 the second column') + 700);
  check('the flights column was found', flights.length > 100, true);
  check('no booking button under flights', /accom-btn/.test(flights), false);
  check('and the hotel column still has one',
    /_acUrl \? '<a class="accom-btn"/.test(hb), true);

  /* MP-919. Rendered whatever happened and pointed at '#', so the editor
     preview showed a Book Now that did nothing while the live site hid it
     later through hideDeadCtas - which is why it appeared in one and not the
     other. Not rendering it is simpler than hiding it afterwards. */
  check('no inert booking button is built', /\|\|'#'\)/.test(hb), false);
  check('the button needs a url', /\(_acUrl \? /.test(hb), true);

  /* MP-928. aspect-ratio alone fixes the height from the width, so copy longer
     than the sample ran out through the ornate border. */
  /* MP-928, settled. THE COPY SITS BELOW THE FRAME.

     The frame is a fixed drawn ornament around a heading, and anything typed
     into it had to fit a shape that cannot grow with the words: widening it
     pushed the text out of the sides, letting it grow pushed it out of the
     bottom, and breaking long runs only moved where it escaped. A border drawn
     as an image and copy of any length are not reconcilable - three passes
     went into trying before the shape itself was the thing to change.

     So the frame keeps the heading it was drawn for, and the copy behaves like
     every other section on the page. */
  /* From the MARKUP, not from the first mention: .gallery-lightbox appears in
     the stylesheet thousands of characters before the section does, so slicing
     between them gave an empty string and three checks failed on nothing. */
  const sec = hb.slice(hb.indexOf('<section class="registry-section"'),
                       hb.indexOf('<div class="gallery-lightbox"'));
  check('the registry section was found', sec.length > 100, true);
  const frameEnd = sec.indexOf('</div>');
  const bodyAt = sec.indexOf('id="registryBody"');
  check('the body is outside the frame', frameEnd > -1 && bodyAt > frameEnd, true);
  check('and the heading is still inside it',
    sec.indexOf('registry-title') < frameEnd, true);
  /* It reads as a section now, not as a caption squeezed under an ornament. */
  const body = (hb.match(/\.registry-body\{[\s\S]*?\n\}/) || [''])[0];
  check('the copy has a readable measure', /max-width:min\(100%, 620px\)/.test(body), true);
  check('and room above it', /margin:1\.6rem auto 0;/.test(body), true);
  /* The long-run break stays: it is cheap, and a pasted URL can still be wider
     than the measure. */
  check('long runs can still break', /overflow-wrap:anywhere;/.test(body), true);
  const svg = (hb.match(/\.registry-frame-svg\{[\s\S]*?\n\}/) || [''])[0];
  check('the border stretches with the frame', /object-fit:fill;/.test(svg), true);

  const frame = (hb.match(/\.registry-frame\{[\s\S]*?\n\}/) || [''])[0];
  check('the registry frame was found', frame.length > 50, true);
  check('it keeps the ornament\'s proportions', /aspect-ratio:5\/2;/.test(frame), true);
  check('but can grow with its copy', /min-height:min-content;/.test(frame), true);
  check('and keeps text off the scrollwork',
    /padding:[\d.]+rem [\d.]+rem;/.test(frame), true);
}

// ── The gift button is a button, not a heading ───────────────────────────
// Measured on the live site: the sheet WAS there and the button still resolved
// to 41.6px in a flex box - which is Heirloom Bloom's .registry-title at
// 2.6rem. The stylesheet was reaching the page and losing on specificity.
//
// Ten designs each have their own idea of what an anchor inside a registry card
// looks like, and a specificity ladder against all of them is a race.
{
  /* Matched in the whole file, not in a slice of it. The rule sits further
     into that stylesheet than the window I guessed, so the slice came back
     without it - the fifth fixed-width window to do this. The selector is
     unique; there is no need to bound the search at all.

     The concatenation is joined first: this stylesheet is built from string
     fragments, so the declarations of one rule are split across several of
     them and a naive match sees only the first. */
  const flat = rt.replace(/'\s*\+\s*\n?\s*'/g, '');
  const rule = (flat.match(/#registryGrid\[data-mp-built\] \.registry-buy-btn\{[^}]*\}/) || [''])[0];
  check('the button rule was found', rule.length > 40, true);

  /* The five that make it a control rather than a line of text. Each one is
     what a heading style would otherwise impose. */
  /* text-transform still wins over the template - now as NONE: the button
     reads "Purchase This Item" as written on every design (decided). */
  for (const prop of ['display:inline-block', 'font-size:0.75rem',
                      'line-height:1.4', 'width:auto', 'text-transform:none']) {
    check(prop + ' wins over the template',
      new RegExp(prop.replace(/[.[\]]/g, '\\$&') + '!important').test(rule), true);
  }

  /* And ONLY those. Colour, face and the card around it still belong to the
     design - blanket !important would make every template's registry look the
     same, which is the opposite of the point. */
  const forced = (rule.match(/!important/g) || []).length;
  check('nothing else is forced', forced, 5);
  check('the colour is left to the design', /color:[^;]*!important/.test(rule), false);
}

// ── MP-922: the gift buttons have somewhere to go ────────────────────────
// renderPreviewCard finds the button with card.querySelector('a') and hangs the
// registry url on it. The grid this file builds wrote that button as a <span>,
// so it was never found, never given an href, and clicking it did nothing -
// every gift in the grid had a dead button.
{
  const build = rt.slice(rt.indexOf("grid.setAttribute('data-mp-built'"),
                         rt.indexOf("grid.setAttribute('data-mp-built'") + 1200);
  check('the built card uses an anchor',
    /<a class="registry-buy-btn" href="#">/.test(build), true);
  check('and no longer a span',
    /<span class="registry-buy-btn">/.test(build), false);

  /* A template may still ship a non-anchor - ten designs write this markup
     themselves and nothing says it has to be an <a>. Upgraded in place rather
     than left dead. */
  /* To the end of the function, not a guessed width - the upgrade block pushed
     the href assignment past 2600 and two assertions read a slice without it.
     The third fixed-width window to go wrong this way. */
  const render = rt.slice(rt.indexOf('function renderPreviewCard'),
                          rt.indexOf('function parseColor'));
  check('a plain button is upgraded to an anchor',
    /var plain = card\.querySelector\('\.registry-buy-btn, \.registry-btn'\);/.test(render), true);
  check('keeping its class so the design still styles it',
    /btn\.className = plain\.className;/.test(render), true);
  check('and its wording', /btn\.textContent = plain\.textContent;/.test(render), true);
  check('put back where it stood', /plain\.parentNode\.replaceChild\(btn, plain\)/.test(render), true);

  /* STRAIGHT TO THE GIFT. The button said "Purchase this Item" and landed on
     the whole list, so a guest had to find again the thing they had just
     clicked. The gift's id is already in the public payload, so this costs the
     backend nothing. */
  check('the button carries the gift id',
    /it\.id \? registryUrl \+ '#gift-' \+ encodeURIComponent\(it\.id\) : registryUrl/.test(render), true);
  /* Encoded: an id is opaque and may hold characters a fragment would eat. */
  check('and encodes it', /encodeURIComponent\(it\.id\)/.test(render), true);
  /* Falls back to the plain list when there is no id - a placeholder card has
     none, and a dead fragment is worse than the list. */
  check('an item with no id still reaches the registry',
    /: registryUrl\)/.test(render), true);

  /* THE REGISTRY PAGE HAS TO HONOUR IT, or the link is decoration. */
  const reg = (() => { try { return fs.readFileSync('live_registry.html', 'utf8'); } catch (e) { return null; } })();
  if (!reg) { check('registry page (not present - SKIPPED)', true, true); }
  else {
    check('the page reads the fragment', /function openFromHash\(\)/.test(reg), true);
    check('and opens that gift', /openDetail\(decodeURIComponent\(m\[1\]\)\)/.test(reg), true);
    /* AFTER render(). openDetail reads state.data.items and draws into the
       page; called earlier it finds nothing and silently does nothing. */
    check('after the list has been drawn',
      /render\(\);\s*\n\s*openFromHash\(\);/.test(reg), true);
    /* An id no longer in the list - an old link, a gift since removed - must
       leave the guest on the full registry rather than on an error. */
    check('a stale id leaves the page alone',
      /const it=\(state\.data\.items\|\|\[\]\)\.find\(x=>x\.id===id\); if\(!it\) return;/.test(reg), true);
    check('and the reader cannot throw', /\}catch\(e\)\{\}/.test(
      reg.slice(reg.indexOf('function openFromHash'), reg.indexOf('function openDetail'))), true);
  }
  check('and opens away from the page',
    /btn\.setAttribute\('target', '_blank'\);/.test(render), true);
}

// ── MP-907: the registry says where it goes ──────────────────────────────
// The heading is a link and the gift tiles each have a button, but nothing says
// the section leads anywhere else - a guest wanting the rest of the list had to
// guess that a heading was clickable. Underlining it would be the smaller
// change and the wrong one: it is a heading first, and several designs set it
// in a script face where an underline reads as damage.
{
  /* To the end of the function, not a guessed width. The placement fix pushed
     the last assertions past 6000 and three of them read a slice without the
     code they were about - the fourth fixed-width window to do this. */
  const fn = rt.slice(rt.indexOf('function layOutRegistry'),
                      rt.indexOf('function wireRegistryLinks'));
  check('the registry layout was found', fn.length > 500, true);
  check('a visible control is added', /_more\.className = 'mp-registry-more'/.test(fn), true);
  check('and it says where it goes',
    /_more\.textContent = 'View our registry'/.test(fn), true);
  check('it is a real anchor, reachable by keyboard',
    /createElement\('a'\)[\s\S]{0,200}mp-registry-more/.test(fn), true);
  check('opening away from the page', /rel", "noopener|rel', 'noopener noreferrer'/.test(fn), true);

  /* Only when there is somewhere to go. A button pointing at nothing is worse
     than no button. */
  /* On the live site, still only with somewhere to go. The preview has no
     address by design (every registry link is inert there) and shows the
     button anyway, so preview and live show the same section (MP-946). And
     never beside a registry button the design already has (MP-941). */
  check('it needs a registry url',
    /var _wantMore = \(!!_registryUrl \|\| _isPreview\) && !_blanked && hasCopy && !_ownCta;/.test(fn), true);
  /* AND copy. With the box empty the section is just the heading in its frame,
     and a button beside it reads as a second title rather than a control -
     which is what the live site showed while the preview, with no url to hang
     it on, showed nothing. A heading alone is already the link on every
     design; the button is for when a paragraph has come between the heading
     and the gifts and the heading has stopped looking clickable. */
  check('and copy to sit under', /&& hasCopy(?: && !_ownCta)?;/.test(fn), true);
  /* Block and centred, not inline: inline-block put it on the same line as
     whatever it followed, so inside a centred frame it sat beside the title. */
  check('it is laid out as its own block',
    /display:block;width:fit-content;margin:1\.1rem auto 0;/.test(fn), true);
  check('and is restored to block when shown again',
    /_more\.style\.display = 'block';/.test(fn), true);
  check('and is hidden when there is none',
    /_more\.style\.display = 'none';/.test(fn), true);
  /* And NOT when the heading has been cleared - the whole paragraph is already
     the link then, and two ways to open one page is worse than one unobvious
     one. */
  check('it stands down when the copy is already the link',
    /&& !_blanked/.test(fn), true);

  /* The href is refreshed on every hydrate: a couple can change the link
     without reloading, and a button pointing at the old one is worse than
     none. */
  check('the href is refreshed, not set once',
    /_more\.setAttribute\('href', _registryUrl\);/.test(fn), true);
  /* One control, however many times hydrate runs - the preview re-hydrates on
     every keystroke. */
  check('it is not duplicated on re-hydrate',
    /querySelector\('\.mp-registry-more'\)/.test(fn), true);

  /* hideDeadCtas must not take it away. It skips anything whose class mentions
     registry, which this does - checked rather than assumed, because that
     sweep has removed registry controls before. */
  const dead = rt.slice(rt.indexOf('function hideDeadCtas'),
                        rt.indexOf('function hideDeadCtas') + 1400);
  check('the dead-link sweep spares it',
    /\/registry\/i\.test\(String\(a\.className\)\)/.test(dead), true);
}

// ── The site serves the template the couple picked ───────────────────────
// Every live site rendered as Pressed Petals, with Pressed Petals in the
// browser tab, whatever the editor showed. Website Template is a Softr select,
// and what arrives is sometimes the bare option id - a uuid, which matched no
// label in the name map and fell through to the default. The default is
// Pressed Petals, so the fault was invisible: a real template, correctly
// rendered, just not the one chosen.
{
  const api = (() => { try { return fs.readFileSync('api/site.js', 'utf8'); } catch (e) { return null; } })();
  if (!api) { check('template routing (api/site.js not present - SKIPPED)', true, true); }
  else {
    const wt = fs.readFileSync('Website.txt', 'utf8');
    const pick = new Function(
      api.match(/const TEMPLATE_MAP = \{[\s\S]*?\n\};/)[0] + '\n' +
      api.match(/const TEMPLATE_IDS = \{[\s\S]*?\n\};/)[0] + '\n' +
      api.match(/const DEFAULT_TEMPLATE = '[^']*';/)[0] + '\n' +
      api.match(/function templateFor\(data\) \{[\s\S]*?\n\}/)[0] +
      '\nreturn templateFor;')();

    /* EVERY template the editor offers must route to its own file, by the id
       the editor stores AND by its name. Read from the editor's own list, so
       adding a template there without adding it here fails the suite rather
       than quietly serving Pressed Petals. */
    const list = (wt.match(/const TEMPLATES = \[[\s\S]*?\n\];/) || [''])[0];
    const rows = [...list.matchAll(/id:\s*"([^"]+)",\s*label:\s*"([^"]+)",[\s\S]*?template-([a-z]+)\.html/g)];
    check('the editor template list was read', rows.length, 10);
    const wrong = [];
    for (const [, id, label, slug] of rows) {
      const want = 'template-' + slug + '.html';
      if (pick({ template: id }) !== want) wrong.push(label + ' by id');
      if (pick({ template: label }) !== want) wrong.push(label + ' by name');
    }
    check('every template routes to its own file', wrong.join(', '), '');

    /* And an unrecognised value is reported rather than silently defaulted -
       silence is how this went unnoticed. */
    check('an unknown template is logged',
      /console\.warn\("\[site\] unknown template/.test(api), true);
    check('and still serves something', pick({ template: 'nonsense' }),
      'template-pressedpetals.html');
    check('a missing template does not throw', pick({}), 'template-pressedpetals.html');
  }
}

// ── MP-855: a thumbnail rule is not scoped to a width ────────────────────
// Golden Hour's card was blank above the invitation while every other design
// was fine. Its thumbnail-mode block was wrapped in @media (min-width:641px),
// written when a thumbnail rendered at 1100px - and the render width is derived
// from the card now and is 552, so the whole block stopped applying, taking the
// --mp-thumb-hero composite with it. Two numbers in two files that had to agree
// and nobody could see together.
{
  const wt = fs.readFileSync('Website.txt', 'utf8');
  const base = parseFloat((wt.match(/const THUMB_MOBILE_WIDTH\s*=\s*(\d+);/) || [])[1]);
  const mult = parseFloat((wt.match(/const THUMB_RENDER_WIDTH\s*=\s*THUMB_MOBILE_WIDTH \* (\d+);/) || [])[1]);
  const renderAt = base * mult;
  check('the render width is known', renderAt > 0, true);

  const bad = [];
  for (const t of fs.readdirSync('.').filter(f => /^template-.*\.html$/.test(f)).sort()) {
    const css = [...fs.readFileSync(t, 'utf8').matchAll(/<style>([\s\S]*?)<\/style>/g)]
      .map(m => m[1]).join('\n');
    /* Any thumbnail rule behind a min-width the render never reaches is a rule
       that cannot run. Checked against the real number rather than a literal,
       so retuning the render width moves this with it. */
    const re = /@media[^{]*min-width:\s*(\d+)px[^{]*\{([\s\S]*?)\n\}/g;
    let m;
    while ((m = re.exec(css))) {
      if (parseFloat(m[1]) > renderAt && /thumbnail-mode/.test(m[2])) {
        bad.push(t.replace('template-', '').replace('.html', '') +
          ': thumbnail rules behind min-width ' + m[1] + ', render is ' + renderAt);
      }
    }
  }
  check('no thumbnail rule is out of reach of the render', bad.join(' | '), '');

  /* And Golden Hour's composite specifically, since it is the only thing that
     puts a photograph on that card. */
  const gh = fs.readFileSync('template-goldenhour.html', 'utf8');
  check('the thumbnail hero composite is still there',
    /body\.thumbnail-mode \.hero-section\{/.test(gh), true);
  check('and hydrate still fills it',
    /_heroSec\.style\.setProperty\('--mp-thumb-hero'/.test(gh), true);
  check('with samples behind it when there are no photographs',
    /background-image: var\(--mp-thumb-hero,/.test(gh), true);
}

// ── The brand footer follows a colour change ─────────────────────────────
// renderBrandFooter bailed as soon as the footer existed, so its four colours
// were whatever they had been on the FIRST render. A live page builds it once,
// after hydrate, and looked right; the editor preview re-hydrates on every
// keystroke and the footer kept the colours it was born with - the couple
// changed Accent and watched every band follow except that one.
{
  const fn = rt.slice(rt.indexOf('function renderBrandFooter'),
                      rt.indexOf('HYDRATION'));
  check('the footer builder was found', fn.length > 100, true);
  check('an existing footer is repainted, not skipped',
    /var existing = document\.querySelector\('\.mp-brand-footer'\);\s*\n\s*if \(existing\) \{ paintBrandFooter\(existing, override\); return; \}/.test(fn), true);
  check('and no longer returns bare', /if \(document\.querySelector\('\.mp-brand-footer'\)\) return;/.test(fn), false);

  /* One painter for both paths. Two would drift, and the drift would show only
     on the path nobody tests - which is how this one survived. */
  const paint = rt.slice(rt.indexOf('function paintBrandFooter'),
                         rt.indexOf('function renderBrandFooter'));
  check('there is a single painter', paint.length > 60, true);
  for (const v of ['--mp-bf-bg', '--mp-bf-ink', '--mp-bf-rule', '--mp-bf-logo-filter']) {
    check('it sets ' + v, paint.indexOf(v) > -1, true);
  }
  check('and the builder uses it', /paintBrandFooter\(footer, override\);/.test(fn), true);
  check('with the colours set nowhere else',
    (rt.match(/setProperty\('--mp-bf-bg'/g) || []).length, 1);

  /* The colours must be RESOLVED each time, not captured once - that is what
     makes a repaint mean anything. */
  check('the painter resolves the palette as it stands',
    /var c = resolveFooterColors\(override\);/.test(paint), true);
}

// ── MP-357: only the runtime writes a palette variable ───────────────────
// The real cause, found by tracing the write rather than reading the source.
// applyCustomColors was handed ["--olive",""] and correctly REMOVED it - and
// --olive was set to the background colour anyway. Nine templates carried a
// colour block of their own that ran afterwards and overwrote it:
//
//     setProperty('--olive',    d.customization.primary_color)   <- the ACCENT
//     setProperty('--offwhite', d.customization.accent_color)    <- the PAGE
//
// Inverted, in every one of the nine. That is the whole report: moving Site
// Background changed the accent bands, and moving Accent filled the sections
// that had been the background. The runtime's own comment records this wiring
// being corrected months ago; the templates were never cleaned up, so the fix
// was overwritten on every load.
//
// Three passes went into explaining how the runtime could do this. It could
// not, and said so plainly in the trace the first time one was added.
{
  const tpls = fs.readdirSync('.').filter(f => /^template-.*\.html$/.test(f)).sort();
  check('all ten templates are covered', tpls.length, 10);
  const colourTable = new Function(
    rt.match(/var TEMPLATE_COLOR_VARS = \{[\s\S]*?\n  \};/)[0] +
    '\nreturn TEMPLATE_COLOR_VARS;')();
  const writers = [];
  for (const t of tpls) {
    const src = fs.readFileSync(t, 'utf8');
    const name = t.replace('template-', '').replace('.html', '');
    /* No template may write a palette variable. The runtime maps every colour
       through TEMPLATE_COLOR_VARS and is the only thing that should. */
    /* Any setProperty of a custom property, however the style object was
       reached. Golden Hour aliased documentElement.style to a local `_r`, so a
       pattern anchored on documentElement missed it entirely. */
    /* A template's PALETTE variables - the ones TEMPLATE_COLOR_VARS maps. A
       template may still set its own private custom properties: Golden Hour
       builds its thumbnail hero image into --mp-thumb-hero, which is its own
       plumbing and nothing to do with the couple's colours. The test is
       whether the runtime claims the variable, not whether it starts with --. */
    const claimed = new Set();
    for (const slot of Object.values(colourTable[name] || {})) {
      [].concat(slot).forEach(v => claimed.add(v));
    }
    for (const m of src.matchAll(/\.setProperty\(\s*'(--[\w-]+)'/g)) {
      if (claimed.has(m[1])) writers.push(name + ': ' + m[1]);
    }
    // And no direct style write fed from a colour field - Modern Minimal
    // painted its page frame that way.
    if (/\.style\.\w+\s*=\s*d\.customization\./.test(src)) {
      writers.push(name + ': writes a style from a customization colour');
    }
    // Nor read the colour fields to apply them some other way.
    if (/d\.customization\.(primary|accent|text)_color/.test(src)) {
      writers.push(name + ': still reads a customization colour');
    }
  }
  check('no template writes a palette variable', writers.join(' | '), '');

  /* The runtime still does, and still through the table - otherwise this
     check would pass on a build where colours stopped working entirely. */
  check('the runtime applies colours through the table',
    /var v = TEMPLATE_COLOR_VARS\[TID\]/.test(rt), true);
  check('and writes them itself',
    /if \(val\) root\.setProperty\(name, val\);/.test(rt), true);
  check('removing one restores the design',
    /else root\.removeProperty\(name\);/.test(rt), true);

  /* The trace that found it is gone; it was for one question and answered it.
     The hero trace stays - that one has earned its place twice. */
  check('the colour trace was removed', /\[mp-colors\]/.test(rt), false);
  check('the hero trace is still there', /\[mp-hero\]/.test(rt), true);
}

// ── MP-354: every colour reaches the live site the same way ──────────────
// customization came back from the API with primary_color and accent_color
// EMPTY while text_color, which lives in custom_css, arrived intact - and the
// picker still showed the colour after an editor reload, so it had saved. The
// loss was between the column and the payload.
//
// Two of the seven colours had their own record columns and the other five
// lived in custom_css. Only the columns failed. One mechanism now.
{
  const wt = fs.readFileSync('Website.txt', 'utf8');

  /* THE COLUMN AND NOWHERE ELSE.

     These were briefly written into custom_css as well, to survive a trip to
     the live site that was broken for an entirely different reason - main.py
     read two column names that do not exist. With that fixed the copy had no
     purpose, and it caused three faults of its own: a reset that emptied the
     columns and left the copy standing, storage keys that corrupted the
     injected stylesheet, and a stale --accent repainting a band while the
     picker showed the template default, because an empty column DISPLAYS as
     the default and nothing in the editor could reveal what was applied. */
  check('site background writes only its column',
    /const setPrimaryColor = \(hex\) => \{ handleUpdate\('primaryColor', hex\); _clearVarColor\('bg'\); \}/.test(wt), true);
  check('and accent only its own',
    /const setAccentColor  = \(hex\) => \{ handleUpdate\('accentColor',  hex\); _clearVarColor\('accent'\); \}/.test(wt), true);
  /* Cleared on WRITE as well as on reset, so a value left from that period
     goes the first time a couple touches either control rather than waiting
     for them to find a reset they have no reason to press. */
  check('neither writes a copy into custom_css',
    /_setVarColor\('(bg|accent)',/.test(wt), false);
  /* Reset has to clear BOTH, or the custom_css value outlives the reset and
     the template default never comes back. */
  check('reset clears the custom_css copy as well',
    /const clearPrimaryColor = \(\) => \{[^}]*_clearVarColor\('bg'\)/.test(wt), true);
  check('for accent as well',
    /const clearAccentColor  = \(\) => \{[^}]*_clearVarColor\('accent'\)/.test(wt), true);
  /* The picker rows must call those, not handleUpdate directly - that was the
     path that wrote the column alone. */
  check('the pickers go through the new setters',
    /onChange=\{e => c\.set\(e\.target\.value\)\}/.test(wt), true);
  /* The hex field now validates before it applies - a half-typed "#f" used to
     land on the page as it was typed. It still has to go through the setter,
     which is what this was asserting. */
  check('including the hex field',
    /onChange=\{hex => \{ if \(\/\^#\[0-9a-fA-F\]\{6\}\$\/\.test\(hex\)\) c\.set\(hex\); \}\}/.test(wt), true);
  check('and the reset button', /onClick=\{\(\) => c\.clear\(\)\}/.test(wt), true);
  check('no picker writes the column on its own any more',
    /handleUpdate\(c\.key, /.test(wt), false);

  /* RUNTIME: the five that live in custom_css read it; the two with columns
     read only their column. A value a couple cannot see and cannot clear is
     worse than a missing one. */
  /* 4200, not 3000: the colour trace added to this function pushed the
     flattening past the end of the window, so the assertion was reading a
     slice that no longer contained it. */
  const fn = rt.slice(rt.indexOf('function applyCustomColors'),
                      rt.indexOf('function applyCustomColors') + 4200);
  check('the colour application was found', fn.length > 200, true);
  check('site background comes from its column alone',
    /\[v\.bg, c\.primary_color \|\| ''\]/.test(fn), true);
  check('and accent from its own',
    /\[v\.accent, c\.accent_color \|\| ''\]/.test(fn), true);
  check('neither consults custom_css any more',
    /pick\(c\.(primary|accent)_color/.test(fn), false);
  /* The other five still do - that is where they are stored, and they work. */
  check('the tones still read custom_css',
    /pick\(c\.text_color, 'text\(\?!\[0-9\]\)'\)/.test(fn), true);
  /* And the strip keeps bg and accent listed, so a legacy value left in
     custom_css is never injected as a loose declaration. */
  check('legacy keys are still stripped before injection',
    /_STORAGE_KEYS = \['bg', 'accent'/.test(rt), true);

  /* The fallback reader must not confuse --text with --text2. It already
     guards that; bg and accent are new names and must not collide either. */
  const names = ['bg', 'accent', 'accent2', 'accent3', 'text(?![0-9])', 'text2', 'text3'];
  const reader = new Function(rt.slice(rt.indexOf('function _cssColorVar'),
    rt.indexOf('function applyCustomColors')) + '\nreturn _cssColorVar;')();
  const css = '--bg:#111111; --accent:#222222; --accent2:#333333; --accent3:#444444; ' +
              '--text:#555555; --text2:#666666; --text3:#777777;';
  const got = names.map(n => reader(css, n));
  check('each key reads back its own colour',
    got.join(','), '#111111,#222222,#333333,#444444,#555555,#666666,#777777');
  /* --accent must not match --accent2's value, which is the same trap the
     text guard exists for. */
  check('accent does not swallow accent2', reader('--accent2:#aaaaaa; --accent:#bbbbbb;', 'accent'), '#bbbbbb');
}

// ── MP-357: a colour slot moves what its label says ──────────────────────
// "Changing site background changed the whole page, and changing accent filled
// the sections that were originally the site background." That is two sliders
// doing each other's job, and it was true: Whimsical Romance had --rose, which
// paints <body>, wired to Accent, and --ivory, which paints the drawer and the
// buttons, wired to Site Background.
//
// Checked by RULE rather than per template. Reading the CSS is the only way to
// know what a variable paints, and a list written here by hand would be the
// same kind of second source that let this drift.
{
  const vars = new Function(rt.match(/var TEMPLATE_COLOR_VARS = \{[\s\S]*?\n  \};/)[0] +
    '\nreturn TEMPLATE_COLOR_VARS;')();
  check('the colour map was found', Object.keys(vars).length, 10);

  /* A real block walk, not a regex over the file: a declaration inside a media
     query belongs to its own rule, and background shorthand can carry more
     than a colour. */
  const rules = (css) => {
    const out = []; let i = 0;
    while (i < css.length) {
      const o = css.indexOf('{', i); if (o < 0) break;
      let d = 1, k = o + 1;
      while (k < css.length && d) { if (css[k] === '{') d++; else if (css[k] === '}') d--; k++; }
      const sel = css.slice(i, o).replace(/\/\*[\s\S]*?\*\//g, '').trim();
      const body = css.slice(o + 1, k - 1);
      if (sel && !sel.startsWith('@')) out.push([sel, body]);
      if (sel.startsWith('@')) out.push(...rules(body));
      i = k;
    }
    return out;
  };

  const wrongBg = [], deadAccent = [], unmapped = [];
  for (const t of Object.keys(vars)) {
    const src = fs.readFileSync('template-' + t + '.html', 'utf8');
    const css = [...src.matchAll(/<style>([\s\S]*?)<\/style>/g)].map(m => m[1]).join('\n');
    const paints = {};
    let bodyVar = null;
    for (const [sel, body] of rules(css)) {
      const m = body.match(/(?:^|;)\s*background(?:-color)?\s*:\s*[^;]*var\((--[\w-]+)\)/);
      if (!m) continue;
      paints[m[1]] = (paints[m[1]] || 0) + 1;
      if (/(^|,)\s*body\s*(,|$)/.test(sel)) bodyVar = m[1];
    }
    /* SITE BACKGROUND is the variable that paints the page. Not a judgement -
       it is what the label means. */
    if (bodyVar && vars[t].bg !== bodyVar) {
      wrongBg.push(t + ': bg=' + vars[t].bg + ' but body uses ' + bodyVar);
    }
    /* A slider that moves one rule reads as broken rather than as subtle.
       Accent should carry more of the design than any unmapped colour does. */
    const mapped = new Set(Object.values(vars[t]));
    const accentUse = paints[vars[t].accent] || 0;
    for (const [v, n] of Object.entries(paints)) {
      if (!mapped.has(v)) unmapped.push(t + ': ' + v + ' paints ' + n + ' rules and no slider moves it');
      else if (v !== vars[t].bg && n > accentUse * 3 && n >= 5) {
        deadAccent.push(t + ': accent=' + vars[t].accent + ' (' + accentUse +
          ') while ' + v + ' paints ' + n);
      }
    }
  }
  check('every Site Background slot points at the page ground', wrongBg.join(' | '), '');
  check('no colour in a template is beyond every slider', unmapped.join(' | '), '');
  check('no Accent slider is dwarfed by a colour below it', deadAccent.join(' | '), '');

  /* Slots must stay distinct. Two pointing at one variable would make two
     sliders fight over the same colour, which is this bug in another form. */
  const dupes = [];
  for (const t of Object.keys(vars)) {
    const used = Object.values(vars[t]).filter(Boolean);
    if (used.length !== new Set(used).size) dupes.push(t);
  }
  check('no two slots share a variable', dupes.join(','), '');
}

// ── MP-337: formatting survives the title boundary ───────────────────────
// <mp-title> is spliced in by string position, and the first line of a block is
// rarely a whole element. Select a section and hit underline: the editor writes
// ONE <u> around everything, so the first line begins inside it. Wrapping that
// line produced "<mp-title><u>Ceremony</mp-title>…" - the <u> opening inside
// the title and closing long after. A browser repairs that by closing <u> at
// </mp-title>, so the formatting covered the first line and nothing else.
{
  const pre = "var _text=function(h){return String(h||'').replace(/<[^>]*>/g,'')" +
              ".replace(/&nbsp;/gi,' ').trim();};var _VOID=/^(br|img|hr|input|source|wbr)$/i;";
  const mark = new Function(pre +
    lift(rt, ['_openTags', '_wrapsWhole', '_unwrap', 'markBlock', '_markAttire', 'markStructure']) +
    '\nreturn markStructure;')();

  /* BALANCE is the property, checked by counting rather than by matching a
     shape: every element opened inside the title is closed inside it. */
  const balanced = (html) => {
    const stack = [], re = /<(\/?)([a-z][a-z0-9-]*)\b[^>]*?(\/?)>/gi;
    let m;
    while ((m = re.exec(html))) {
      const n = m[2].toLowerCase();
      if (/^(br|img|hr|input|source|wbr)$/i.test(n) || m[3] === '/') continue;
      if (m[1]) { const i = stack.lastIndexOf(n); if (i > -1) stack.splice(i, 1); else return false; }
      else stack.push(n);
    }
    return stack.length === 0;
  };
  const titleOf = (out) => (out.match(/<mp-title>([\s\S]*?)<\/mp-title>/) || [])[1];

  /* EVERY CARD STANDS ALONE. A template cuts this blob on the same blank line
     and renders each card as its own fragment, so a block beginning inside a
     tag opened in an earlier block loses it entirely. Select a section, hit
     underline, and the editor writes ONE <u> around everything: the first card
     keeps it, every later card is a substring whose <u> opened somewhere it
     will never see.

     The earlier pass balanced the <mp-title> boundary, which is the same fault
     one level down - it fixed the title and left the cards. */
  const cards = (out) => out.split(/(?:<br\s*\/?>\s*){2,}/).filter(x => x.trim());
  const both = mark('<u><span style="font-family:X">Ceremony<br>4pm<br><br>Reception<br>7pm</span></u>');
  const two = cards(both);
  check('the blob still cuts into two cards', two.length, 2);
  for (let i = 0; i < two.length; i++) {
    check('card ' + (i + 1) + ' is valid on its own', balanced(two[i]), true);
    check('card ' + (i + 1) + ' keeps the underline', /<u>/.test(two[i]), true);
    check('card ' + (i + 1) + ' keeps the font',
      /<span style="font-family:X">/.test(two[i]), true);
  }
  /* Three cards: the carry has to survive more than one boundary. */
  const three = cards(mark('<u>A<br>1<br><br>B<br>2<br><br>C<br>3</u>'));
  check('a third card is reached too', three.length, 3);
  check('and still carries the formatting',
    three.filter(c => /<u>/.test(c)).length, 3);
  /* Formatting that ENDS inside a block must not be carried past it - a couple
     who underlines one card only should not see the rest follow. */
  const partial = cards(mark('<u>A<br>1</u><br><br>B<br>2'));
  check('formatting that closes early is not carried on',
    /<u>/.test(partial[1]), false);
  check('and the card that had it keeps it', /<u>/.test(partial[0]), true);

  const whole = mark('<u>Ceremony<br>4pm<br><br>Reception<br>7pm</u>');
  check('the whole fragment is balanced', balanced(whole), true);
  check('and so is the title on its own', balanced(titleOf(whole)), true);
  /* The formatting must still reach past the title - closing it at the
     boundary without reopening is the same bug wearing the other hat. */
  /* After the title's <br>, not straight after </mp-title>: a template strips
     the whole first line as the title, and a tag re-opened ON it went too -
     which is how a whole-box font reached titles and no lines under them. */
  check('the underline continues after the title', /<\/mp-title><br\s*\/?><u>/.test(whole), true);
  /* lastIndexOf. The FIRST </u> is the one closing the title, so indexOf found
     it at position 20-odd and the comparison was always false - a gate that
     could not pass rather than one that could not fail, but wrong either way. */
  check('and still covers the second card',
    whole.lastIndexOf('</u>') > whole.lastIndexOf('<mp-title>'), true);

  /* A reopened tag keeps its attributes. Reopening <span> bare would drop the
     style carrying the couple's font, so the title would keep it and every
     line under it would lose it. */
  const span = mark('<span style="font-family: X">Ceremony<br>a<br><br>Reception<br>b</span>');
  /* Four, not two: one per title and one per card body, now that each block
     carries its own copy rather than relying on a tag opened in an earlier
     one. The number is not the point - every occurrence having the style is,
     because a bare reopened <span> would drop the couple's font. */
  const spans = span.match(/<span[^>]*>/g) || [];
  check('every reopened span keeps its style',
    spans.filter(t => t.indexOf('style="font-family: X"') === -1).length, 0);
  check('and there is one in each card and each title', spans.length, 4);
  check('and the fragment is still balanced', balanced(span), true);

  // Nesting, and the case where nothing is open at all.
  check('nested formatting is balanced',
    balanced(mark('<u><b>Ceremony</b> day<br>4pm</u>')), true);
  const plain = mark('Ceremony<br>4pm');
  check('plain text is untouched apart from the title',
    plain, '<mp-title>Ceremony</mp-title><br>4pm');
  /* Nothing reopened. The separator follows the title in every case, so the
     test has to exclude it or it matches the <br> and reports a stray tag on
     perfectly correct output. */
  check('and gains no stray reopened tags',
    /<\/mp-title>(?!<br)</.test(plain), false);

  /* The existing behaviours this sits beside must not have moved: a wholly
     italic line is emphasis rather than a heading, <strong> is unwrapped
     because the title element supplies its own weight, and a second pass over
     an already-marked payload must not nest one title inside another. */
  check('a wholly italic line is still left alone',
    mark('<em>just a note</em><br>more'), '<em>just a note</em><br>more');
  check('a bold first line is still unwrapped',
    mark('<strong>Ceremony</strong><br>4pm'), '<mp-title>Ceremony</mp-title><br>4pm');
  check('marking twice does not nest titles',
    mark(mark('Ceremony<br>4pm')), '<mp-title>Ceremony</mp-title><br>4pm');
}

// ── The help text describes the product that exists ───────────────────────
// It had drifted. It listed an Accommodations section that was merged into
// Travel, missed Things to Do entirely, claimed nine fonts when there are 27,
// and described Unpublished as "temporarily offline" - which is Draft. That
// last one is the dangerous sort of wrong: a couple reading it would choose
// Unpublished to take their site down for a week and lose their address.
{
  const help = fs.readFileSync('WebsiteHelp.txt', 'utf8');
  const wt = fs.readFileSync('Website.txt', 'utf8');

  /* The section list, against PAGE_SECTIONS rather than against a list written
     out here - the whole fault was two lists kept by hand. */
  const sections = (wt.match(/const PAGE_SECTIONS = \[[\s\S]*?\n\];/) || [''])[0];
  const labels = [...sections.matchAll(/label: "([^"]+)"/g)].map(m => m[1]);
  check('the section labels were found', labels.length >= 9, true);
  const panel = (help.match(/the Pages & Sections panel[^"]*/) || [''])[0];
  check('the help describes the panel', panel.length > 80, true);
  const missing = labels.filter(l => panel.indexOf(l) === -1);
  check('every section a couple can toggle is named', missing.join(', '), '');
  /* And nothing that no longer exists. Accommodations is the one that went. */
  check('no retired section is still listed',
    /\bAccommodations\b/.test(panel), false);

  /* The font count, counted rather than remembered. */
  const fonts = (wt.match(/const FONTS = \[[\s\S]*?\n\];/) || [''])[0];
  const n = (fonts.match(/label: "/g) || []).length;
  check('the font list was found', n > 0, true);
  const claim = (help.match(/Font Style panel offers (\d+|\w+) fonts/) || [])[1];
  check('the help states a number of fonts', !!claim, true);
  check('and it is the number there actually are', String(n), claim);
  /* Every group named in the help has to be a real category, or a couple looks
     for a heading that is not there. */
  const cats = [...new Set([...fonts.matchAll(/category: "(\w+)"/g)].map(m => m[1]))];
  const named = ((help.match(/grouped by mood \(([^)]*)\)/) || [])[1] || '')
    .split(',').map(x => x.trim()).filter(Boolean);
  check('the help names the font groups', named.length > 0, true);
  check('and every one of them exists',
    named.filter(c => cats.indexOf(c) === -1).join(','), '');
  check('and none is left out',
    cats.filter(c => named.indexOf(c) === -1).join(','), '');

  /* Unpublished. The help must not call it temporary, and must say what it
     really does - the same two consequences the confirm dialog names. */
  const status = (help.match(/Three radio buttons[^"]*/) || [''])[0];
  check('the status section was found', status.length > 80, true);
  check('Unpublished is not described as temporary',
    /Unpublished \(temporarily/.test(status), false);
  check('it says the content is removed', /content is removed/.test(status), true);
  check('and the address is released', /address is released/.test(status), true);
  check('and it points at Draft for a temporary takedown',
    /choose Draft/.test(status), true);
  /* The 30-day claim removed from the product must not survive here. */
  check('the help makes no 30-day claim either', /30 days/.test(help), false);

  /* No typographic characters. The doc is plain ASCII prose apart from the box
     drawing in its own code comments. */
  const prose = [...help.matchAll(/(?:title|body): "((?:[^"\\]|\\.)*)"/g)].map(m => m[1]).join(' ');
  check('there is prose to check', prose.length > 1000, true);
  const typographic = [...new Set([...prose].filter(c => c.charCodeAt(0) > 127))];
  check('the help text is plain ASCII', typographic.join(' '), '');
}

// ── Unpublishing does not claim to delete anything ────────────────────────
// MP-889. Both the tooltip and the confirm dialog said a site left unpublished
// for 30 days or more is "cleared automatically". Nothing does that - not on a
// schedule, not at all. A deletion that is described but never performed is
// worse than silence: it reads as a promise, and the first couple who loses
// work will reasonably believe this is why it went.
{
  const wt = fs.readFileSync('Website.txt', 'utf8');
  check('nothing claims a 30-day clearance', /30 days/.test(wt), false);
  check('nor any other automatic clearing', /cleared automatically/i.test(wt), false);

  /* Both places, because it was written twice and the confirm dialog is the
     worse one to be wrong in - it is the last thing read before the click. */
  /* ONLY WHAT A COUPLE READS. The first version of this slurped the whole
     block, comments included - and the comment explaining the removal says
     "deletion", "automatically" and "30-day", so the gate failed on the note
     describing the fix. Pull the quoted strings out and test those. */
  const visible = (block) => (block.match(/"(?:[^"\\]|\\.)*"/g) || []).join(' ');
  const tip = visible((wt.match(/label: "Unpublished",[\s\S]*?\n    info: "[\s\S]*?",/) || [''])[0]
    .replace(/\/\*[\s\S]*?\*\//g, ''));
  check('the Unpublished tooltip was found', tip.length > 40, true);
  check('and makes no claim about later deletion',
    /clear|delete|30|automatic/i.test(tip), false);
  const dialog = visible((wt.match(/"Unpublish this website\?[\s\S]*?\);/) || [''])[0]
    .replace(/\/\/[^\n]*/g, ''));
  check('the confirm dialog was found', dialog.length > 40, true);
  check('and makes none either',
    /clear|delete|30|automatic/i.test(dialog), false);

  /* What IS true has to survive. The content really is removed and the address
     really is released - that is the whole reason this needs confirming, and
     softening it to nothing would be the opposite mistake. */
  for (const [where, text] of [['tooltip', tip], ['dialog', dialog]]) {
    check(where + ' still says the content is removed',
      /content is removed/.test(text), true);
    check(where + ' still says the address is released',
      /address is released/.test(text), true);
    check(where + ' still points at Draft as the gentler option',
      /Draft/.test(text), true);
  }
}

// ── The server resolves the slug, so there is no redirect ─────────────────
// /manishmonika used to return a shell whose only job was to ask which template
// the couple uses and then NAVIGATE to it: two HTML downloads, and an address
// bar reading template-pressedpetals.html for the whole of the second one -
// nine seconds on a throttled connection. The mapping is data the server can
// resolve, so /api/site resolves it and returns the template directly.
{
  const api = fs.readFileSync('api/site.js', 'utf8');
  const shell = fs.readFileSync('index.html', 'utf8');
  const vj = JSON.parse(fs.readFileSync('vercel.json', 'utf8'));

  /* The two template maps must agree. A label in one and not the other means a
     couple silently gets the default template - which looks like their design
     was lost, not like a routing bug. */
  const read = (src) => {
    const t = (src.match(/TEMPLATE_MAP = \{[\s\S]*?\n\};/) || [''])[0];
    const d = (src.match(/DEFAULT_TEMPLATE = '([^']+)'/) || [])[1];
    const fn = new Function(t + '\nreturn TEMPLATE_MAP;')();
    return { map: fn, dflt: d };
  };
  const a = read(api), b = read(shell);
  check('both maps were found', !!a.map && !!b.map, true);
  check('they list the same labels',
    Object.keys(a.map).sort().join(','), Object.keys(b.map).sort().join(','));
  check('and point them at the same files',
    Object.keys(a.map).filter(k => a.map[k] !== b.map[k]).join(','), '');
  check('with the same default', a.dflt, b.dflt);
  /* And every file either map names has to exist, or a couple whose template is
     perfectly valid falls through to the shell. The paths are absolute as the
     browser sees them; on disk they sit beside this suite. */
  const files = [...new Set([...Object.values(a.map), a.dflt])];
  check('there are templates to check', files.length > 0, true);
  check('every mapped template exists',
    files.filter(f => !fs.existsSync(f.replace(/^\//, ''))).join(','), '');

  /* Routing. The crawler rule has to stay FIRST - it is matched on User-Agent
     and /api/og exists so a link preview gets meta tags rather than an app. */
  const rw = vj.rewrites;
  check('the crawler rule is still first', rw[0].destination.indexOf('/api/og') === 0, true);
  check('and still matched on user-agent', !!(rw[0].has && rw[0].has[0].key === 'user-agent'), true);
  const slugRule = rw.filter(r => r.source === '/:slug').pop();
  check('a visitor is served the real page', slugRule.destination, '/api/site?slug=:slug');
  check('and no longer the shell', slugRule.destination.indexOf('index.html'), -1);
  /* Sub-pages still go to the shell: this route serves one couple's site, not
     the app's inner screens. */
  check('sub-pages still go to the app',
    (rw.find(r => r.source === '/:slug/:page') || {}).destination, '/index.html');
  /* The function reads the templates off disk, and files in public/ are static
     assets that are NOT bundled into a function unless asked for. */
  check('the templates are bundled with the function',
    !!(vj.functions && vj.functions['api/site.js'] &&
       vj.functions['api/site.js'].includeFiles), true);

  /* Behaviour, run rather than read. */
  const mod = new Function(api.replace(/^import .*$/gm, '')
    .replace(/^export default /m, 'const handler = ') +
    '\nreturn { templateFor, inlineJson, injectData };')();
  /* The real labels are the template names, not the short aliases I first
     assumed - 'coastal chic', not 'coastal'. Taken from the map itself rather
     than written out here, so this cannot drift from what the product sends. */
  const label = Object.keys(a.map).find(k => /coastal/.test(k));
  check('there is a coastal label to test with', !!label, true);
  check('a known label picks its template',
    mod.templateFor({ template: label }), 'template-coastalchic.html');
  check('case does not matter', mod.templateFor({ template: label.toUpperCase() }),
    'template-coastalchic.html');
  /* The legacy aliases still resolve: older recommender output used style
     words, and a couple created then must not lose their design. */
  check('a legacy style alias still resolves',
    mod.templateFor({ template: 'minimalist' }), 'template-modernminimal.html');
  check('an unknown label falls back rather than failing',
    mod.templateFor({ template: 'nope' }), 'template-pressedpetals.html');
  check('and so does a missing one', mod.templateFor({}), 'template-pressedpetals.html');

  /* A closing tag inside the couple's own words would end the script block
     early and spill the rest of the payload into the page as markup. */
  check('a script tag in their copy cannot break out',
    mod.inlineJson({ s: '</script><img onerror=x>' }).indexOf('</script>'), -1);
  check('and the json still parses to the same thing',
    JSON.parse(mod.inlineJson({ s: '</script>' })).s, '</script>');

  /* The payload must land in <head>: site-runtime.js loads at the foot of the
     body and has to find it already set. */
  const out = mod.injectData('<html><head><title>t</title></head><body></body></html>', { a: 1 });
  check('the payload is injected', out.indexOf('MP_SITE_DATA') > -1, true);
  check('and before the runtime could run',
    out.indexOf('MP_SITE_DATA') < out.indexOf('</head>'), true);
  check('a document with no head is refused rather than mangled',
    mod.injectData('<html><body></body></html>', { a: 1 }), null);

  /* Every failure path returns the shell - today's behaviour. A route that
     500s is worse than the redirect it replaced. */
  for (const why of ['bad-slug', 'upstream-', 'lookup-failed', 'empty-payload',
                     'no-template', 'no-head']) {
    check('it falls back to the shell on ' + why,
      new RegExp("fallbackToShell\\(res, \"" + why).test(api), true);
  }
  /* A gated site gets the template but NOT the data - inlining it would put a
     protected couple's details in the source of a public URL, which is the
     leak /api/og is careful to avoid in previews. */
  check('a password-protected site is served without its data',
    /if \(data\.password_required\) return send\(res, html, 0\);/.test(api), true);
  /* And this response carries one couple's data, so the edge must not hold it. */
  check('the response is not cached at the edge',
    /res\.setHeader\("CDN-Cache-Control", "no-store"\)/.test(api), true);

  /* The runtime has to prefer the inlined copy. If both are present the stash
     is from an older visit and the inlined one came with this document. */
  const boot = rt.slice(rt.indexOf('// Live site.') - 1200, rt.indexOf('// Live site.') + 200);
  check('the runtime uses the inlined payload', /window\.MP_SITE_DATA/.test(rt), true);
  check('and prefers it to the stash',
    rt.indexOf('window.MP_SITE_DATA && typeof') < rt.indexOf("var key = 'weddingData_'"), true);
  check('and says so in the trace', /'server-inlined MP_SITE_DATA'/.test(rt), true);
}

// ── A decode() rejection is not readiness ─────────────────────────────────
// The trace settled it. The hero was hidden at 146ms and shown again at 177ms,
// with complete still false at reveal - so the page uncovered over a stock
// photograph that had not been replaced yet. Nothing was waiting: decode() had
// rejected and the rejection handler was `show`.
//
// Chrome resolves decode() on a swap in flight; Firefox rejects it. That is the
// whole of the browser difference, and it is why four fixes aimed at reveal
// timing changed nothing - the reveal was correct and the release was wrong.
{
  const loop = rt.slice(rt.indexOf('function revealWhenHeroReady'),
                        rt.indexOf('var _previewSampleOnly = false;'));
  check('the wait loop was found', loop.length > 0, true);

  /* decode() ANSWERS ABOUT THE PICTURE THE ELEMENT IS SHOWING, which during a
     swap is still the old one. In Firefox it therefore resolves against the
     stock photograph and reports the element ready while the couple's bytes are
     still in flight - hidden at 40ms, shown at 61ms, complete false at reveal.

     Making it resolve-only was a wasted pass: it was never rejecting. The fix
     is not to ask it at all about an element mid-swap. */
  check('a hidden element is not released by decode at all',
    /img\.decode\(\)/.test(loop), false);
  check('and the page is not settled by decode on a swapped element',
    /if \(probe\.decode && !\(s\.el && _wasSwapped\(s\.el\)\)\)/.test(loop), true);
  check('neither takes a rejection as ready',
    /\.then\(show, show\)|\.then\(one, one\)/.test(loop), false);
  /* decode() is still worth having where nothing was swapped: a fresh probe
     Image, or an element showing the picture the page shipped. There the
     current frame IS the one being waited for, and load alone can be late. */
  check('it is still used where the current picture is the awaited one',
    /probe\.decode\(\)\.then\(one, function \(\) \{\}\)/.test(loop), true);

  /* Removing the rejection path only works because something else still
     settles it. All three have to stay, or an element that never decodes stays
     hidden for good - which is worse than the flash. */
  check('load still releases it', /img\.addEventListener\('load', show\)/.test(loop), true);
  check('error still releases it', /img\.addEventListener\('error', show\)/.test(loop), true);
  check('a cached swap still releases it', /if \(img\.complete\) show\(\);/.test(loop), true);
  check('and a stalled one is released by the ceiling',
    /setTimeout\(show, HERO_REVEAL_CEILING_MS \+ \d+\);/.test(loop), true);
  check('the page has the same backstop',
    /setTimeout\(finish, HERO_REVEAL_CEILING_MS\)/.test(loop), true);
}

// ── The hero path says what it did ────────────────────────────────────────
// Four fixes have been shipped against one symptom, each reasoned from a
// description rather than a measurement, and each has changed nothing. The page
// records its own decisions instead and prints them at reveal.
{
  check('the trace exists', /var _heroTrace = \[\];/.test(rt), true);
  check('and is printed as one block at reveal',
    /function _dumpHeroTrace\(why\)/.test(rt), true);
  /* Live too. The symptom is on the live site, and a trace that only runs in
     preview would be answering a question nobody is asking. */
  const dump = rt.slice(rt.indexOf('function _dumpHeroTrace'),
                        rt.indexOf('function _dumpHeroTrace') + 900);
  check('it is not restricted to preview', /_isPreview/.test(dump), false);

  /* The points that matter, each of which has been a guess at some stage. */
  for (const [what, why] of [
    ["'shipped-imgs'", 'how many pictures the markup carried'],
    ["'heroImg-shipped'", 'what the hero held before hydrate'],
    ["'boot'", 'which boot path ran - the stash path is the one a guest takes'],
    ["'sources'", 'how many sources the wait collected'],
    ["'source'", 'each one, with complete and swapped as the code saw them'],
    ["'skipped'", 'anything the wait decided not to wait for'],
    ["'hide-img'", 'whether the element was actually hidden'],
    ["'show-img'", 'and when it came back'],
    ["'hide-bg'", 'the same for a background'],
    ["'reveal'", 'when the cover came off and why'],
  ]) {
    check('it records ' + why, new RegExp('_trace\\(' + what).test(rt), true);
  }
  check('and what the hero holds at reveal', /'heroImg-now'/.test(rt), true);

  /* Both ways out of the wait print it, or the interesting case - nothing to
     wait for - is the one that stays silent. */
  check('the settled path prints it',
    /_dumpHeroTrace\('all sources settled or ceiling'\)/.test(rt), true);
  check('and so does the no-sources path',
    /_dumpHeroTrace\('no sources to wait for'\)/.test(rt), true);

  /* A trace that throws would take the reveal with it, which is far worse than
     the bug it is chasing. */
  const tr = rt.slice(rt.indexOf('function _trace(what, detail)'),
                      rt.indexOf('function _trace(what, detail)') + 300);
  check('recording cannot break the page', /catch \(e\) \{\}/.test(tr), true);
  check('nor can printing it', /catch \(e\) \{\}/.test(dump), true);
  /* Urls are trimmed: a signed CDN link fills a console line on its own and
     the last 40 characters are what tell a stock file from an uploaded one. */
  check('urls are trimmed to their tail', /function _tail\(u\)/.test(rt), true);
}

// ── A background photograph is hidden too, not only watched ───────────────
// The flash that survived everything appeared AFTER the page had finished
// loading, which ruled out the reveal entirely. A photograph painted as a CSS
// background was watched - the page waited for it - but never hidden, so when
// the cover came off the stock one was still painted underneath. Only an <img>
// was ever hidden, because the branch tested tagName.
{
  const src = rt.slice(rt.indexOf('function _heroSources'),
                       rt.indexOf('var _previewSampleOnly = false;'));
  check('the hero-source walk was found', src.length > 0, true);

  /* The host is carried, not null. Watched-but-unhidden was exactly what null
     bought: something to wait for and nothing to hide. */
  check('a background carries its host element',
    /add\(bgHosts\[b\], m\[1\], true\)/.test(src), true);
  check('and is marked as a background', /urls\.push\(\{ el: el, url: url, bg: !!isBg \}\)/.test(src), true);

  /* Taken SECOND, before the general sweep. The list is capped at six, and a
     template with several swapped <img>s pushed the backgrounds off the end -
     the one kind of source that cannot be hidden any other way. */
  const iBg = src.indexOf('var bgHosts');
  const iSweep = src.indexOf('Then anything else hydrate swapped');
  check('backgrounds are collected before the general sweep',
    iBg > -1 && iSweep > -1 && iBg < iSweep, true);

  /* The picture is taken off, not the element: there is text sitting on these
     bands, and hiding the host would blank that with it. */
  check('a background is hidden by removing its picture',
    /host\.style\.backgroundImage = 'none';/.test(src), true);
  check('and the element itself is left alone',
    /host\.style\.visibility/.test(src), false);
  check('the original is restored when the picture arrives',
    /host\.style\.backgroundImage = prev;/.test(src), true);

  /* Every release the <img> branch has, or a band that never loads stays blank
     for good - which is worse than the flash it replaced. */
  const bgBlock = src.slice(src.indexOf('if (s.bg && s.el)'), src.indexOf("if (s.el && s.el.tagName === 'IMG')"));
  check('it releases on load', /probe\.addEventListener\('load', show\)/.test(bgBlock), true);
  check('and on error', /probe\.addEventListener\('error', show\)/.test(bgBlock), true);
  check('and on a ceiling', /setTimeout\(show, HERO_REVEAL_CEILING_MS \+ \d+\)/.test(bgBlock), true);
  check('and only once', /if \(shown\) return;/.test(bgBlock), true);
  /* Re-hydration must not re-hide a band the couple is already looking at -
     the same latch the <img> branch needed. */
  check('a repeat hydrate leaves a settled band alone',
    /if \(host\.__mpBgHidUrl === url\) return;/.test(bgBlock), true);
}

// ── The address bar never advertises the template ─────────────────────────
// A guest arriving at /manishmonika is redirected by the shell and used to
// watch the URL read template-pressedpetals.html for the whole load - ten
// seconds on a slow connection - because the runtime only rewrote it after
// hydrating. The head script does it at parse time instead.
{
  const tpls = fs.readdirSync('.').filter(f => /^template-.*\.html$/.test(f)).sort();
  const bad = [];
  for (const t of tpls) {
    const src = fs.readFileSync(t, 'utf8');
    const name = t.replace('template-', '').replace('.html', '');
    if (!/history\.replaceState\(\{\}, '', '\/' \+ decodeURIComponent\(sm\[1\]\)\)/.test(src))
      bad.push(name + ': does not clean the url');
    // After isLive has been decided, or the test changes meaning.
    if (src.indexOf("window.__mpVeil.by = 'preview'") > src.indexOf('decodeURIComponent(sm[1])'))
      bad.push(name + ': cleans the url before deciding isLive');
  }
  check('every template cleans its own address bar', bad.join(' | '), '');
  /* Only safe because the runtime falls back to the PATH when there is no
     ?slug= - otherwise stripping it would leave it unable to find the couple. */
  check('the runtime can still find the slug in the path',
    /var _liveSlug = _slugParam \|\| _pathSlug;/.test(rt), true);
  check('and a template path is still not mistaken for a slug',
    /_pathSlug = \/\^template-\[a-z\]\+\\\.html\$\/i\.test\(_firstPart\) \? '' : _firstPart;/.test(rt), true);
}

// ── The veil waits for the script, not for a clock ────────────────────────
// The head script covers the page until the runtime says it is worth showing,
// with a timer as a safety net. That timer gave up at 4s if __mpRuntimeAlive
// was unset, reasoning that no flag means the runtime never arrived - but on a
// slow connection it has simply not finished DOWNLOADING. On a throttled 3G
// reload site-runtime.js parsed at 9.9s, so the veil lifted at 4s onto the
// un-hydrated page and the stock photographs showed for six seconds.
//
// No care inside the runtime can prevent that: the runtime is not running yet.
{
  const tpls = fs.readdirSync('.').filter(f => /^template-.*\.html$/.test(f)).sort();
  check('all ten templates are covered', tpls.length, 10);
  const bad = [];
  for (const t of tpls) {
    const src = fs.readFileSync(t, 'utf8');
    const name = t.replace('template-', '').replace('.html', '');
    // The old shape, which uncovers an un-hydrated page on any slow load.
    if (/if \(!window\.__mpRuntimeAlive\) \{ lift\(\); return; \}/.test(src)) bad.push(name + ': gives up at 4s');
    // A failed script must still uncover the page at once, or a 404 hides it.
    /* lift() takes WHO now, so the record can separate a 404 from the ceiling
       from the runtime finishing - by hand all three are a missing element. */
    if (!/sc\.addEventListener\('error', function \(\) \{ clearInterval\(watch\); lift\('script-error'\); \}\)/.test(src))
      bad.push(name + ': a failed script never lifts');
    // ...and there must still be a ceiling.
    if (!/if \(\+\+tries > \d+\) \{ clearInterval\(watch\); lift\('ceiling'\); \}/.test(src))
      bad.push(name + ': no ceiling, could stay hidden forever');
    // The runtime, once alive, owns the decision - the watcher must stand down.
    if (!/if \(window\.__mpRuntimeAlive\) \{ clearInterval\(watch\); return; \}/.test(src))
      bad.push(name + ': does not defer to the runtime');
  }
  check('every template waits for the script rather than the clock', bad.join(' | '), '');

  /* The ceiling has to clear a slow first visit. 9.9s was measured on a
     throttled 3G reload, so anything at or under that reproduces the bug. */
  for (const t of tpls) {
    const src = fs.readFileSync(t, 'utf8');
    const m = src.match(/if \(\+\+tries > (\d+)\) \{ clearInterval\(watch\); lift\('ceiling'\); \}/);
    /* The poll interval, read from the setInterval that closes the watcher -
       anchored on the ceiling line above it rather than on whatever happens to
       follow the block, which moved when the veil record was added. */
    const every = src.match(/lift\('ceiling'\); \}\s*\}, (\d+)\);/);
    const ms = m && every ? parseInt(m[1], 10) * parseInt(every[1], 10) : NaN;
    check(t.replace('template-', '').replace('.html', '') + ' waits past a slow first load',
      ms > 9900, true);
  }
}

// ── MP-310: a swapped photograph is waited for, whatever complete says ────
// Setting a new src is supposed to make `complete` false at once, and in Chrome
// it does. Firefox leaves it TRUE for a beat - and revealWhenHeroReady skipped
// any source whose element was already complete. On Firefox that skipped the
// freshly swapped hero: nothing was left pending, the page was uncovered
// immediately, and the only pixels decoded at that moment were the stock ones.
//
// Both protections went at once, which is why the flash was total rather than
// brief: the page did not wait, AND the element was never hidden, because the
// hide lives inside the loop body the skip jumps over.
{
  const { JSDOM } = (() => { try { return require('jsdom'); } catch (e) { return {}; } })();
  if (!JSDOM) { check('swap detection (jsdom not installed - SKIPPED)', true, true); }
  else {
    const fn = rt.slice(rt.indexOf('function _wasSwapped'), rt.indexOf('function revealWhenHeroReady'));
    check('the swap test exists', fn.length > 0, true);
    /* It must ask _initialSrc - the record taken while the document parsed -
       and NOT the element's own flag, which is the thing that lied. */
    check('it compares against what the page shipped with',
      /_initialSrc\[i\]\[0\] === el/.test(fn), true);
    check('and does not consult complete', /\.complete/.test(fn), false);

    const dom = new JSDOM('<!doctype html><body>' +
      '<img id="hero" src="stock.jpg"><img id="other" src="keep.jpg"></body>');
    const doc = dom.window.document;
    const hero = doc.getElementById('hero'), other = doc.getElementById('other');
    const run = new Function('_initialSrc', fn + '\nreturn _wasSwapped;')(
      [[hero, 'stock.jpg'], [other, 'keep.jpg']]);
    check('an untouched picture is not a swap', run(other), false);
    hero.setAttribute('src', 'theirs.jpg');
    check('a replaced picture is', run(hero), true);
    /* A picture the page never shipped - one hydrate created - has no record,
       and must not be reported as swapped or every reveal waits on it. */
    const added = doc.createElement('img');
    check('an element with no record is not a swap', run(added), false);
    check('and neither is nothing at all', run(null), false);

    /* The skip now carries the condition. Checked as source because the loop
       around it is DOM and timer driven, but the helper above is run for real. */
    const loop = rt.slice(rt.indexOf('function revealWhenHeroReady'),
                          rt.indexOf('var _previewSampleOnly = false;'));
    check('the loop no longer skips on complete alone',
      /if \(s\.el && s\.el\.complete\) continue;/.test(loop), false);
    /* The skip records itself now, so the condition is matched up to its brace
       rather than to `continue` - the trace line sits between the two. */
    check('it skips only an untouched, finished picture',
      /if \(s\.el && s\.el\.complete && !_wasSwapped\(s\.el\)\) \{/.test(loop), true);
    check('and says so when it does', /_trace\('skipped'/.test(loop), true);
    /* An already-cached swap is released by decode(), because load fired before
       the listeners were attached. Without decode it would hold the page to the
       2.5s ceiling, so there has to be a fallback. */
    check('a cached swap is released rather than held to the ceiling',
      /else if \(s\.el && s\.el\.complete\) one\(\);/.test(loop), true);
    // And the per-element hide is still reached for those sources.
    check('a waited source is still hidden until its own pixels land',
      /img\.style\.visibility = 'hidden';/.test(loop), true);
    check('with a timeout so it cannot stay hidden',
      /setTimeout\(show, HERO_REVEAL_CEILING_MS \+ \d+\);/.test(loop), true);
  }
}

// ── MP-855: a card showing the template shows all of it ───────────────────
// The editor answers a thumbnail that is standing in for the DESIGN with a null
// payload, meaning "show yourself, not their site". That used to only reveal
// the page - and three templates ship almost every section as display:none,
// waiting for hydrateTemplate to switch on the ones the couple turned on. Those
// three showed a hero and nothing under it; the other seven looked complete
// because their sections are visible in the markup either way.
{
  const tpls = fs.readdirSync('.').filter(f => /^template-.*\.html$/.test(f)).sort();
  check('all ten templates are covered', tpls.length, 10);
  /* The measurement that explains the report. Kept as a number rather than a
     list of three names: a template that starts hiding its sections joins the
     affected set silently, and the fix below has to already cover it. */
  const hidden = {};
  for (const t of tpls) {
    const src = fs.readFileSync(t, 'utf8');
    hidden[t.replace('template-', '').replace('.html', '')] =
      (src.match(/id="[a-z-]+"[^>]*style="display:none"/g) || []).length;
  }
  check('some designs build themselves almost entirely from the payload',
    Math.max(...Object.values(hidden)) >= 9, true);
  check('and Black Tie, Golden Hour and Heirloom Bloom are among them',
    ['blacktietimeless', 'goldenhour', 'heirloombloom'].every(n => hidden[n] >= 9), true);
  /* Every one of them exposes a SAMPLE_DATA for the fix to hydrate from - a
     template without one falls back to a bare reveal and the hero-only bug
     comes back for it alone. */
  for (const t of tpls) {
    check(t.replace('template-', '').replace('.html', '') + ' ships a sample to render',
      /window\.SAMPLE_DATA|SAMPLE_DATA\s*=/.test(fs.readFileSync(t, 'utf8')), true);
  }

  const settle = rt.slice(rt.indexOf('var settle = function (payload, isPlaceholder)'),
                          rt.indexOf("window.addEventListener('message'"));
  check('the settle path was found', settle.length > 0, true);
  check('a null payload renders the sample rather than an unbuilt page',
    /hydrate\(_sample\);/.test(settle), true);
  /* Guarded both ways: no sample, or a template whose hydrateTemplate never
     registered, must still uncover the frame rather than sit behind
     body.hydrating forever. */
  check('and falls back to revealing when there is nothing to render',
    /if \(_sample && typeof window\.hydrateTemplate === 'function'\)/.test(settle), true);
  check('with a bare reveal as the else', /\} else \{\s*reveal\(\);\s*\}/.test(settle), true);
  /* Marked as a sample, or something downstream treats stock photographs as
     the couple's own - purgeSampleImages reads this. */
  check('the frame still knows it is showing a sample',
    /_previewSampleOnly = true;\s*hydrate\(_sample\)/.test(settle), true);
  // The real payload path is untouched.
  check('a real payload still hydrates normally',
    /else hydrate\(payload\);/.test(settle), true);
}

// ── A block sized in vh is capped where vh is not the screen ──────────────
// The editor's desktop preview renders the page in a 1440-wide frame sized to
// fill its pane - about 1150 tall - which is a viewport shape no laptop has. A
// template that hangs a full-screen block off 100vh therefore gets a viewport
// ~45% taller than the live site, and Whimsical Romance's .our-story centres
// one paragraph in whatever that block has left over: empty pink above and
// below the text, in the preview only.
{
  const wt = fs.readFileSync('Website.txt', 'utf8');
  const vw = parseFloat((wt.match(/const PREVIEW_DESKTOP_WIDTH = (\d+);/) || [])[1]);
  const fh = parseFloat((wt.match(/frameHeight=\{(\d+)\}/) || [])[1]);
  check('the preview frame dimensions were found', isFinite(vw) && isFinite(fh), true);
  /* innerHeight = frameHeight / scale, and scale = paneWidth / viewportWidth -
     so the frame is as many CSS pixels tall as it needs to fill its pane. For
     any pane narrower than 1440 that is taller than the pane, and the narrower
     the pane the taller the viewport a template sees. */
  const innerAt = (paneW) => fh / Math.min(1, paneW / vw);
  check('a half-width pane gives the page a viewport far taller than a laptop',
    innerAt(vw / 2) > 1000, true);

  const wr = fs.readFileSync('template-whimsicalromance.html', 'utf8');
  const block = (wr.match(/^\.home-block\{[\s\S]*?\n\}/m) || [''])[0];
  check('the shared hero/story block was found', !!block, true);
  const cap = parseFloat((block.match(/min-height:min\(100vh,\s*(\d+)px\)/) || [])[1]);
  check('its height is capped as well as being a share of the viewport',
    isFinite(cap), true);
  /* The cap has to be BELOW what the preview hands it, or it changes nothing
     there - and at or above a real laptop screen, or it changes the live site. */
  check('the cap bites in the preview', cap < innerAt(vw / 2), true);
  check('and leaves a laptop window alone', cap >= 800, true);

  /* .our-story is what turns the overshoot into empty space: it takes the
     remainder and centres in it. If that ever stops being true the cap is
     no longer load-bearing and this gate should be revisited, not deleted. */
  const story = (wr.match(/^\.our-story\{[\s\S]*?\n\}/m) || [''])[0];
  check('the story still takes the leftover height', /flex:1 1 auto/.test(story), true);
  check('and still centres in it', /align-items:center/.test(story), true);
}

// ── A section with nowhere to go has no switch and no box ─────────────────
// Four designs render one event grid from both blobs and show one menu link, so
// Other Events has nothing left to hold. The switch and the box go with the
// copy: a toggle for a section that cannot exist does nothing when it is
// thrown, and a box the couple fills is text their site never shows.
{
  const wt = fs.readFileSync('Website.txt', 'utf8');
  const pieces = ['const TEMPLATES = \\[[\\s\\S]*?\\n\\];',
                  'const TEMPLATE_ID = TEMPLATES\\.reduce[\\s\\S]*?\\n\\}, \\{\\}\\);',
                  'const MERGED_EVENT_TEMPLATES = new Set\\(\\[[\\s\\S]*?\\]\\);',
                  'const PAGE_SECTIONS = \\[[\\s\\S]*?\\n\\];',
                  'function sectionsFor\\(templateId\\) \\{[\\s\\S]*?\\n\\}'];
  const src = pieces.map(p => (wt.match(new RegExp(p)) || [''])[0]);
  check('every piece of the filter was found', src.every(Boolean), true);
  const ctx = new Function(src[0] +
    '\nconst VISIBLE_TEMPLATES = TEMPLATES.filter(t => t.available);\n' +
    src.slice(1).join('\n') +
    '\nreturn { ID: TEMPLATE_ID, M: MERGED_EVENT_TEMPLATES, all: PAGE_SECTIONS, f: sectionsFor };')();

  const has = (list, sec) => list.some(s => s.section === sec);
  check('the shared list still carries Other Events', has(ctx.all, 'other_events'), true);

  for (const n of ['coastalchic', 'sageandstill', 'whimsicalromance', 'regalboho']) {
    const list = ctx.f(ctx.ID[n]);
    check(n + ' is offered no Other Events section', has(list, 'other_events'), false);
    check(n + ' keeps its one event section', has(list, 'wedding'), true);
    /* Only that one goes. Filtering by anything looser would take Travel or
       the Registry with it and the loss would be invisible - the tab would
       simply have fewer boxes. */
    check(n + ' loses exactly one section', ctx.all.length - list.length, 1);
  }
  for (const n of ['pressedpetals', 'heirloombloom', 'modernminimal', 'goldenhour',
                   'blacktietimeless', 'vintagelovestory']) {
    check(n + ' still has both event sections', has(ctx.f(ctx.ID[n]), 'other_events'), true);
  }
  /* No selection yet, or a template id this build does not know: the couple
     must see the full list rather than a silently shortened one. */
  check('an unknown template gets the whole list', ctx.f(undefined).length, ctx.all.length);

  /* BOTH tabs, from the same call. They read the same array, so a section
     filtered out of one and not the other is a switch in Design with no box in
     Content - which is the state this whole merge exists to remove. */
  check('the Design tab asks for the filtered list',
    /\{sectionsFor\(_selectedTemplateId\)\.map\(s => \(/.test(wt), true);
  check('and the Content tab asks for the same one',
    /const enabledSections = sectionsFor\(_selectedTemplateId\)\.filter\(/.test(wt), true);
  check('neither still walks the unfiltered array',
    /\{PAGE_SECTIONS\.map\(s => \(/.test(wt), false);

  /* And the payload must not read the stale column. A record saved before the
     merge still HOLDS the welcome event, which all four append to their grid -
     a fourth card the couple has no box to edit or remove. Same fault the
     stale accommodation column caused. */
  check('the merged designs are sent no second event blob',
    /events_info: MERGED_EVENT_TEMPLATES\.has\(_tid\)\s*\?\s*''/.test(wt), true);
}

// ── A card can show a still instead of a live frame ───────────────────────
// An iframe lays the page out at some viewport width and is then reduced by a
// CSS transform, so that one width decides BOTH how much of the page fits and
// how large the type ends up - the two pull against each other and no setting
// gives both. A screenshot has already made that choice at capture time, and
// the browser's image filter is a better path than compositing a scaled live
// document. Empty today; every template still falls back to its iframe.
{
  const wt = fs.readFileSync('Website.txt', 'utf8');
  check('there is a place to put the stills', /const TEMPLATE_STILLS = \{/.test(wt), true);
  check('and a lookup for them', /function stillFor\(url\)/.test(wt), true);

  const table = (wt.match(/const TEMPLATE_STILLS = \{[\s\S]*?\n\};/) || [''])[0];
  const fn = new Function(table + '\n' +
    (wt.match(/function stillFor\(url\)\{?[\s\S]*?\n\}/) || [''])[0] +
    '\nreturn stillFor;')();

  /* Keyed the same way the loading motif is, so one naming rule covers both -
     a second convention here would be a silent miss, not an error. */
  check('an unlisted template falls back to its frame',
    fn('https://weddings.myplanning.ai/template-whimsicalromance.html'), null);
  check('a url it cannot parse does too', fn('nonsense'), null);
  check('and a missing url does not throw', fn(undefined), null);
  // Every commented example uses a key the lookup would actually find.
  const keys = (table.match(/'([a-z]+)':/g) || []).map(k => k.slice(1, -2));
  check('the ten examples are all real template keys',
    keys.filter(k => !new RegExp('template-' + k + '\\.html').test(wt)).join(','), '');
  check('and all ten are listed', keys.length, 10);

  /* The still replaces the frame ONLY where the card is showing the template.
     With the hydrate flag on, the card has to reflect the couple's own site and
     a screenshot cannot. */
  check('the still is gated on the hydrate flag',
    /const still = !_hydrateThumbs\(\) \? stillFor\(template\.url\) : null;/.test(wt), true);

  /* The early return must sit after EVERY hook. One that skipped a hook would
     change the hook order between renders, which is React #310. */
  const comp = wt.slice(wt.indexOf('const TemplateThumbnail = memo'),
                        wt.indexOf('// ── CAROUSEL CARD'));
  const retAt = comp.indexOf('if (still) {');
  check('the still branch is inside the thumbnail component', retAt > -1, true);
  const hookAfter = /use[A-Z]\w*\(/.exec(comp.slice(retAt));
  check('no hook is called after it', hookAfter, null);

  // Anchored to the top: a card is a window onto the start of the page.
  check('a full-page capture is shown from the top',
    /objectPosition: "top"/.test(comp), true);
  check('and fills the card rather than letterboxing',
    /objectFit: "cover"/.test(comp), true);
  // The veil has to lift for a still too, or the card sits under it forever.
  check('the still reports when it has loaded',
    /onLoad=\{\(\) => setLoaded\(true\)\}/.test(comp), true);
}

// ── Sage & Still's desktop hero photo, sized by arithmetic ────────────────
// The panel is a percentage of a box that is itself a ratio of its own width,
// so "20% bigger" is two numbers that have to move together: at 92% of the old
// box, 1.2x is 110% and does not fit. The box grows by the 10.4% that turns
// 110% into 100%. Checked as the panel's own PROPORTIONS and its size relative
// to the hero's width - both survive a retune, a pair of literals would not.
{
  const ss = fs.readFileSync('template-sageandstill.html', 'utf8');
  const desktop = ss.slice(0, ss.indexOf('@media(max-width:768px)'));
  const inner = (desktop.match(/^\.hero-inner\{[\s\S]*?\n\}/m) || [''])[0];
  const photo = (desktop.match(/^\.hero-photo-wrap\{[\s\S]*?\n\}/m) || [''])[0];
  const boxRatio = parseFloat((inner.match(/aspect-ratio:\s*([\d.]+) \/ 1/) || [])[1]);
  const w = parseFloat((photo.match(/width:\s*([\d.]+)%/) || [])[1]);
  const h = parseFloat((photo.match(/height:\s*([\d.]+)%/) || [])[1]);
  /* `%?` - a flush panel is written `top:0`, with no unit, and requiring one
     read NaN. NaN fails every comparison, so this looked like a failing gate
     rather than an unreadable value; the same slip in the other direction is a
     silent pass. */
  const top = parseFloat((photo.match(/top:\s*([\d.]+)%?/) || [])[1]);
  check('the desktop hero numbers were all found',
    [boxRatio, w, h, top].every(v => isFinite(v)), true);

  // Everything in units of the hero's own width.
  const photoW = w / 100;
  const photoH = (h / 100) / boxRatio;
  const wasW = 0.46, wasH = 0.92 / 2.15;    // the sizes this replaced
  check('the panel is 20% wider than it was', Math.abs(photoW / wasW - 1.2) < 0.005, true);
  check('and 20% taller', Math.abs(photoH / wasH - 1.2) < 0.005, true);
  /* Both by the same factor, so object-fit:cover crops the photograph exactly
     as it did - growing one alone changes what is visible in it. */
  check('its own proportions are unchanged',
    Math.abs((photoH / photoW) - (wasH / wasW)) < 0.005, true);
  // It has to stay inside the box it is positioned in.
  check('and it still fits the hero', top + h <= 100, true);
}

// ── Sage & Still's phone hero is built around the photograph ──────────────
// It was a two-column grid with the picture in a 42% column, capped at 220px -
// written because the desktop overlap let one long unwrapped name shove the
// photo off the right edge. That solved the overflow by shrinking the picture,
// which is the wrong half of the trade. The overlap is back and the overflow is
// the name fitter's job.
//
// The ratio is asserted by ARITHMETIC over the two numbers that produce it,
// not by looking for a literal 1.3: the photo is 60% of the hero's width and
// its full height, so its own proportions fall out of the box's aspect ratio.
{
  const ss = fs.readFileSync('template-sageandstill.html', 'utf8');
  const phone = ss.slice(ss.indexOf('@media(max-width:768px)'));
  check('the phone block was found', phone.length > 0, true);

  const inner = (phone.match(/\.hero-inner\{[\s\S]*?\n  \}/) || [''])[0];
  const photo = (phone.match(/\.hero-photo-wrap\{[\s\S]*?\n  \}/) || [''])[0];
  check('the phone hero box and photo are both styled', !!inner && !!photo, true);

  const boxRatio = (inner.match(/aspect-ratio:\s*1 \/ ([\d.]+)/) || [])[1];
  const w = (photo.match(/width:\s*([\d.]+)%/) || [])[1];
  const h = (photo.match(/height:\s*([\d.]+)%/) || [])[1];
  check('the box has a ratio, the photo a width and a height',
    [boxRatio, w, h].every(v => v !== undefined), true);
  // photo height / photo width, both as a share of the box's own width.
  const ratio = (parseFloat(boxRatio) * (parseFloat(h) / 100)) / (parseFloat(w) / 100);
  check('the photo is 60% of the hero\'s width', parseFloat(w), 60);
  check('and 1.3 times as tall as it is wide', Math.abs(ratio - 1.3) < 0.01, true);

  /* The names lie ACROSS it, which needs the overlap composition - a grid
     column cannot overlap its neighbour. */
  const name = (phone.match(/\.hero-couple-name\{[\s\S]*?\n  \}/) || [''])[0];
  check('the names are positioned over the box', /position:absolute/.test(name), true);
  check('and span its full width', /width:100%/.test(name), true);
  check('the box is not a two-column grid any more',
    /grid-template-columns/.test(inner), false);
  /* nowrap plus the fitter, not wrapping: the fitter shrinks a long name to
     fit rather than letting it wrap into the picture or overflow. */
  check('a long name is shrunk rather than wrapped',
    /white-space:nowrap/.test(name), true);
  check('and the size it shrinks from is on the fitted element',
    /font-size:\s*clamp\(/.test(name), true);
  check('which is the element the fitter writes to',
    /id="heroCoupleNames"/.test(ss), true);
  check('and the lines inside it do not size themselves',
    /\.hero-couple-name \.line\{[^}]*font-size/.test(ss), false);

  /* ONE place. Both of these restated the photo's size LATER in the file and
     therefore won - a px clamp inside the same media query, and a whole @640
     block written to beat the rule this now is. */
  check('no px clamp restates the photo size',
    /\.hero-photo-wrap\{\s*width:clamp\(/.test(ss), false);
  const photoRules = (ss.match(/\.hero-photo-wrap\{/g) || []).length;
  check('the photo is sized in two places only: desktop and phone', photoRules, 2);
}

// ── The focused thumbnail is never resampled ──────────────────────────────
// A 200px card against a 276px render meant the focused frame was painted at
// one size and displayed at another - 0.72 - which is what reads as blur. It
// does not improve by rendering LARGER, which is what the old 1100px version
// got wrong in the other direction: the fix is for the two numbers to be equal.
{
  const wt = fs.readFileSync('Website.txt', 'utf8');
  const num = (re) => { const m = wt.match(re); return m ? parseFloat(m[1]) : NaN; };
  const render = num(/const THUMB_MOBILE_WIDTH\s*=\s*(\d+);/);
  check('the render width is a single number', isFinite(render), true);
  /* Derived from it, not written twice. Two literals that happen to match today
     drift the moment one is tuned, and the drift is invisible - it just goes
     soft again. */
  check('the focus card is derived from the render width',
    /const FOCUS_CARD_WIDTH = THUMB_MOBILE_WIDTH;/.test(wt), true);
  check('the slot keeps a gutter around it',
    /const SLOT_WIDTH\s*=\s*FOCUS_CARD_WIDTH \+ (\d+);/.test(wt), true);
  const gutter = num(/const SLOT_WIDTH\s*=\s*FOCUS_CARD_WIDTH \+ (\d+);/);
  check('and the gutter is real', gutter > 0, true);

  /* measure() must resolve to exactly 1 for a card of the render width, and
     must still never magnify - scaling 276 up to fill a wider card blew up
     every fixed-pixel element inside the template. */
  /* Scoped to TemplateThumbnail. Another component further down has its own
     `const measure`, and an unscoped match lifted that one instead - it closes
     over a different ref and threw, which is a crash rather than a gate. */
  const comp = wt.slice(wt.indexOf('const TemplateThumbnail = memo'),
                        wt.indexOf('// ── CAROUSEL CARD'));
  const src = (comp.match(/const measure = \(\) => \{[\s\S]*?\n    \};/) || [''])[0];
  check('the measure routine was found', !!src, true);
  check('and it is the thumbnail\'s own', /wrapperRef\.current/.test(src), true);
  /* The card no longer equals the render width: the frame renders at a multiple
     of it so the card shows more of the page, and is reduced to fit. The
     harness is handed both numbers, as the component is. */
  const renderPx = num(/const THUMB_RENDER_WIDTH\s*=\s*THUMB_MOBILE_WIDTH \* (\d+);/) * render;
  check('the render width is a multiple of the card width', isFinite(renderPx), true);
  const measure = (cardW) => {
    let scale = null, offset = null;
    new Function('wrapperRef', 'THUMB_MOBILE_WIDTH', 'THUMB_RENDER_WIDTH', 'setScale', 'setOffsetX',
      src + '\nmeasure();')(
      { current: { offsetWidth: cardW } }, render, renderPx,
      (v) => { scale = v; }, (v) => { offset = v; });
    return { scale, offset };
  };
  /* An EXACT 1/n reduction. That is the whole reason the render width is a
     multiple: every output pixel is an even block of input pixels, which is the
     one downscale a browser resamples without softening, and on a 2x display it
     lands back on the device grid at 1:1. A fractional scale is what "blurred"
     described. */
  const focusScale = measure(render).scale;
  check('the focus card reduces by an exact fraction',
    Number.isInteger(1 / focusScale), true);
  check('and sits flush, with nothing to centre', measure(render).offset, 0);
  check('a peek card is smaller again', measure(Math.round(render * 0.78)).scale < focusScale, true);
  check('a card as wide as the render is never magnified', measure(renderPx * 2).scale, 1);
  check('and the leftover space is centred', measure(renderPx * 2).offset, renderPx / 2);
  // A zero-width wrapper must not produce a zero scale and a blank card.
  check('an unmeasured wrapper is left alone', measure(0).scale, null);
  /* The frame crops at its OWN height before the card does, so the height has
     to grow with the width or the extra coverage is cut straight back off. */
  check('the frame is made tall enough for what it now shows',
    /THUMB_MOBILE_HEIGHT \* \(THUMB_RENDER_WIDTH \/ THUMB_MOBILE_WIDTH\)/.test(wt), true);
  /* Animating the transform promotes the frame to a composited layer rasterised
     at one scale and resampled at every later one - softness on top of the
     reduction. The card's width animates underneath it instead. */
  check('the scale is not animated',
    /transition: "transform \d+ms/.test(wt), false);

  /* Five slots have to fit the window that turns the second peek on, or the
     carousel overflows the moment it widens. */
  const wideAt = num(/const wide = windowWidth >= (\d+);/);
  check('there is a threshold for the second peek', isFinite(wideAt), true);
  check('five slots fit inside it', (render + gutter) * 5 <= wideAt, true);
  // ...and three fit below it, which is the fallback.
  check('three fit in the narrower case', (render + gutter) * 3 <= 1024, true);

  // The first paint uses the focused value, since that is the card being read.
  check('the first paint is seeded at 1:1', /useState\(1\);/.test(wt), true);
}

// ── Which template file is deployed is answerable in one line ─────────────
// Three reports were debugged as code faults before anyone checked which build
// was being served. Two more were called a stale deploy on a reading that was
// itself wrong: the fingerprint HASHED THE PAGE, and a live page carries
// whatever the host injects as well as the template, so one file read 34a1a52a
// on disk and 8eb0282f in the browser.
//
// So nothing is inferred now. Each template declares its own marker and this
// recomputes it from the file - every byte except the marker line - so a
// template edited without updating its marker fails here rather than reporting
// a value that agrees with itself and is wrong.
{
  check('the runtime states its build', /var MP_RUNTIME_BUILD = '[\w.-]+';/.test(rt), true);
  check('and puts it on window for the editor to read',
    /window\.MP_RUNTIME_BUILD = MP_RUNTIME_BUILD;/.test(rt), true);
  const stamp = rt.slice(rt.indexOf("var MP_RUNTIME_BUILD ="),
                         rt.indexOf("var MP_RUNTIME_BUILD =") + 3600);
  check('the stamp is logged on every surface',
    /console\.log\('\[mp-runtime\] build/.test(stamp) && !/_isPreview/.test(stamp), true);
  const version = (rt.match(/var MP_RUNTIME_BUILD = '([\w.-]+)';/) || [])[1];
  check('the stamp names the change it shipped with', version, '2026-10-23-registry-header');
  /* Any edit to the runtime is a different build, so the hash covers all of it
     bar the stamp line. Two runtimes once shipped under one name because this
     watched only two functions and the change landed outside them. */
  const body = rt.replace(/var MP_RUNTIME_BUILD = '[\w.-]+';/, '');
  let bh = 5381;
  for (let i = 0; i < body.length; i++) bh = ((bh * 33) ^ body.charCodeAt(i)) >>> 0;
  check('and nothing in the runtime has moved since',
    ('0000000' + bh.toString(16)).slice(-8), 'ad08af31');

  /* The runtime REPORTS the declared value and computes nothing. */
  const fpFn = rt.slice(rt.indexOf('function _templateFingerprint'),
                        rt.indexOf('function _templateFingerprint') + 400);
  check('the runtime reads the marker rather than hashing the page',
    /return window\.__mpTemplate \|\| 'unmarked';/.test(fpFn), true);
  check('and does not look at stylesheets at all',
    /querySelectorAll\('style'\)/.test(fpFn), false);

  /* Every template declares one, and it matches the file. */
  const tpls = fs.readdirSync('.').filter(f => /^template-.*\.html$/.test(f)).sort();
  check('all ten templates are covered', tpls.length, 10);
  const stale = [], unmarked = [], seen = {};
  for (const t of tpls) {
    const html = fs.readFileSync(t, 'utf8');
    const name = t.replace('template-', '').replace('.html', '');
    const m = /\n\s*window\.__mpTemplate = '([a-z]+):([0-9a-f]{8})';\n/.exec(html);
    if (!m) { unmarked.push(name); continue; }
    if (m[1] !== name) stale.push(name + ' declares itself ' + m[1]);
    let h = 5381;
    const text = html.replace(m[0], '\n');
    for (let i = 0; i < text.length; i++) h = ((h * 33) ^ text.charCodeAt(i)) >>> 0;
    const actual = ('0000000' + h.toString(16)).slice(-8);
    if (actual !== m[2]) stale.push(name + ' says ' + m[2] + ', file is ' + actual);
    (seen[m[2]] = seen[m[2]] || []).push(name);
  }
  check('every template declares a marker', unmarked.join(','), '');
  check('and every marker matches its file', stale.join(' | '), '');
  check('no two templates share one',
    Object.values(seen).filter(n => n.length > 1).length, 0);

  /* The TOOL has to agree with the suite, or the number you read locally is not
     the number that was checked. */
  const tool = fs.readFileSync('fingerprint.js', 'utf8');
  const toolFn = new Function(
    (tool.match(/function fingerprint\(html\) \{[\s\S]*?\n\}/) || [''])[0] +
    '\nreturn fingerprint;')();
  const disagree = [];
  for (const t of tpls) {
    const r = toolFn(fs.readFileSync(t, 'utf8'));
    if (r.declared !== r.actual) disagree.push(t + ' tool says stale');
  }
  check('the tool agrees the markers are current', disagree.join(','), '');
  check('and it reports an unmarked file rather than guessing',
    toolFn('<html></html>').actual, 'unmarked');
}

// ── The veil says when it went up and what took it down ───────────────────
// A console reading taken by hand during a slow load cannot tell "not installed
// yet" from "already removed" - both read null, and one such reading was taken
// at 1.4s on a page whose head script had not run. The cover records itself
// instead, and the runtime prints it with the build line.
{
  const tpls = fs.readdirSync('.').filter(f => /^template-.*\.html$/.test(f)).sort();
  const bad = [];
  for (const t of tpls) {
    const src = fs.readFileSync(t, 'utf8');
    const name = t.replace('template-', '').replace('.html', '');
    if (!/window\.__mpVeil = \{ up: null, down: null, by: null \};/.test(src))
      bad.push(name + ': no record');
    if (!/window\.__mpVeil\.up = Math\.round\(performance\.now\(\)\);/.test(src))
      bad.push(name + ': does not note when it went up');
    if (!/window\.__mpVeil\.down = Math\.round\(performance\.now\(\)\);/.test(src))
      bad.push(name + ': does not note when it came down');
    // Each path that uncovers has to name itself, or the record cannot separate
    // the 4s ceiling from a 404 from the runtime finishing.
    for (const who of ['preview', 'script-error', 'ceiling'])
      if (!new RegExp("'" + who + "'").test(src)) bad.push(name + ': no ' + who + ' path');
    // The runtime lifts through the template's own function, so attribution is
    // written in one place.
    if (!/window\.__mpLift = lift;/.test(src)) bad.push(name + ': does not expose its lift');
  }
  check('every template records its own cover', bad.join(' | '), '');
  check('the runtime lifts through it, so the record names it',
    /if \(typeof window\.__mpLift === 'function'\) \{ window\.__mpLift\('runtime'\); return; \}/.test(rt), true);
  check('and the build line carries the record',
    /veil up@' \+/.test(rt) && /down@' \+/.test(rt) && /by ' \+/.test(rt), true);
  /* The first reading must survive: a later lift must not overwrite who got
     there first, which is the whole question. */
  const tpl = fs.readFileSync('template-pressedpetals.html', 'utf8');
  check('only the first lift is recorded',
    /if \(window\.__mpVeil && window\.__mpVeil\.down === null\)/.test(tpl), true);
}

// ── A card can show a still instead of a live frame ───────────────────────
// An iframe lays the page out at some viewport width and is then reduced by a
// CSS transform, so that one width decides BOTH how much of the page fits and
// how large the type ends up - the two pull against each other and no setting
// gives both. A screenshot has already made that choice at capture time, and
// the browser's image filter is a better path than compositing a scaled live
// document. Empty today; every template still falls back to its iframe.
{
  const wt = fs.readFileSync('Website.txt', 'utf8');
  check('there is a place to put the stills', /const TEMPLATE_STILLS = \{/.test(wt), true);
  check('and a lookup for them', /function stillFor\(url\)/.test(wt), true);

  const table = (wt.match(/const TEMPLATE_STILLS = \{[\s\S]*?\n\};/) || [''])[0];
  const fn = new Function(table + '\n' +
    (wt.match(/function stillFor\(url\)\{?[\s\S]*?\n\}/) || [''])[0] +
    '\nreturn stillFor;')();

  /* Keyed the same way the loading motif is, so one naming rule covers both -
     a second convention here would be a silent miss, not an error. */
  check('an unlisted template falls back to its frame',
    fn('https://weddings.myplanning.ai/template-whimsicalromance.html'), null);
  check('a url it cannot parse does too', fn('nonsense'), null);
  check('and a missing url does not throw', fn(undefined), null);
  // Every commented example uses a key the lookup would actually find.
  const keys = (table.match(/'([a-z]+)':/g) || []).map(k => k.slice(1, -2));
  check('the ten examples are all real template keys',
    keys.filter(k => !new RegExp('template-' + k + '\\.html').test(wt)).join(','), '');
  check('and all ten are listed', keys.length, 10);

  /* The still replaces the frame ONLY where the card is showing the template.
     With the hydrate flag on, the card has to reflect the couple's own site and
     a screenshot cannot. */
  check('the still is gated on the hydrate flag',
    /const still = !_hydrateThumbs\(\) \? stillFor\(template\.url\) : null;/.test(wt), true);

  /* The early return must sit after EVERY hook. One that skipped a hook would
     change the hook order between renders, which is React #310. */
  const comp = wt.slice(wt.indexOf('const TemplateThumbnail = memo'),
                        wt.indexOf('// ── CAROUSEL CARD'));
  const retAt = comp.indexOf('if (still) {');
  check('the still branch is inside the thumbnail component', retAt > -1, true);
  const hookAfter = /use[A-Z]\w*\(/.exec(comp.slice(retAt));
  check('no hook is called after it', hookAfter, null);

  // Anchored to the top: a card is a window onto the start of the page.
  check('a full-page capture is shown from the top',
    /objectPosition: "top"/.test(comp), true);
  check('and fills the card rather than letterboxing',
    /objectFit: "cover"/.test(comp), true);
  // The veil has to lift for a still too, or the card sits under it forever.
  check('the still reports when it has loaded',
    /onLoad=\{\(\) => setLoaded\(true\)\}/.test(comp), true);
}

// ── Sage & Still's desktop hero photo, sized by arithmetic ────────────────
// The panel is a percentage of a box that is itself a ratio of its own width,
// so "20% bigger" is two numbers that have to move together: at 92% of the old
// box, 1.2x is 110% and does not fit. The box grows by the 10.4% that turns
// 110% into 100%. Checked as the panel's own PROPORTIONS and its size relative
// to the hero's width - both survive a retune, a pair of literals would not.
{
  const ss = fs.readFileSync('template-sageandstill.html', 'utf8');
  const desktop = ss.slice(0, ss.indexOf('@media(max-width:768px)'));
  const inner = (desktop.match(/^\.hero-inner\{[\s\S]*?\n\}/m) || [''])[0];
  const photo = (desktop.match(/^\.hero-photo-wrap\{[\s\S]*?\n\}/m) || [''])[0];
  const boxRatio = parseFloat((inner.match(/aspect-ratio:\s*([\d.]+) \/ 1/) || [])[1]);
  const w = parseFloat((photo.match(/width:\s*([\d.]+)%/) || [])[1]);
  const h = parseFloat((photo.match(/height:\s*([\d.]+)%/) || [])[1]);
  /* `%?` - a flush panel is written `top:0`, with no unit, and requiring one
     read NaN. NaN fails every comparison, so this looked like a failing gate
     rather than an unreadable value; the same slip in the other direction is a
     silent pass. */
  const top = parseFloat((photo.match(/top:\s*([\d.]+)%?/) || [])[1]);
  check('the desktop hero numbers were all found',
    [boxRatio, w, h, top].every(v => isFinite(v)), true);

  // Everything in units of the hero's own width.
  const photoW = w / 100;
  const photoH = (h / 100) / boxRatio;
  const wasW = 0.46, wasH = 0.92 / 2.15;    // the sizes this replaced
  check('the panel is 20% wider than it was', Math.abs(photoW / wasW - 1.2) < 0.005, true);
  check('and 20% taller', Math.abs(photoH / wasH - 1.2) < 0.005, true);
  /* Both by the same factor, so object-fit:cover crops the photograph exactly
     as it did - growing one alone changes what is visible in it. */
  check('its own proportions are unchanged',
    Math.abs((photoH / photoW) - (wasH / wasW)) < 0.005, true);
  // It has to stay inside the box it is positioned in.
  check('and it still fits the hero', top + h <= 100, true);
}

// ── Sage & Still's phone hero is built around the photograph ──────────────
// It was a two-column grid with the picture in a 42% column, capped at 220px -
// written because the desktop overlap let one long unwrapped name shove the
// photo off the right edge. That solved the overflow by shrinking the picture,
// which is the wrong half of the trade. The overlap is back and the overflow is
// the name fitter's job.
//
// The ratio is asserted by ARITHMETIC over the two numbers that produce it,
// not by looking for a literal 1.3: the photo is 60% of the hero's width and
// its full height, so its own proportions fall out of the box's aspect ratio.
{
  const ss = fs.readFileSync('template-sageandstill.html', 'utf8');
  const phone = ss.slice(ss.indexOf('@media(max-width:768px)'));
  check('the phone block was found', phone.length > 0, true);

  const inner = (phone.match(/\.hero-inner\{[\s\S]*?\n  \}/) || [''])[0];
  const photo = (phone.match(/\.hero-photo-wrap\{[\s\S]*?\n  \}/) || [''])[0];
  check('the phone hero box and photo are both styled', !!inner && !!photo, true);

  const boxRatio = (inner.match(/aspect-ratio:\s*1 \/ ([\d.]+)/) || [])[1];
  const w = (photo.match(/width:\s*([\d.]+)%/) || [])[1];
  const h = (photo.match(/height:\s*([\d.]+)%/) || [])[1];
  check('the box has a ratio, the photo a width and a height',
    [boxRatio, w, h].every(v => v !== undefined), true);
  // photo height / photo width, both as a share of the box's own width.
  const ratio = (parseFloat(boxRatio) * (parseFloat(h) / 100)) / (parseFloat(w) / 100);
  check('the photo is 60% of the hero\'s width', parseFloat(w), 60);
  check('and 1.3 times as tall as it is wide', Math.abs(ratio - 1.3) < 0.01, true);

  /* The names lie ACROSS it, which needs the overlap composition - a grid
     column cannot overlap its neighbour. */
  const name = (phone.match(/\.hero-couple-name\{[\s\S]*?\n  \}/) || [''])[0];
  check('the names are positioned over the box', /position:absolute/.test(name), true);
  check('and span its full width', /width:100%/.test(name), true);
  check('the box is not a two-column grid any more',
    /grid-template-columns/.test(inner), false);
  /* nowrap plus the fitter, not wrapping: the fitter shrinks a long name to
     fit rather than letting it wrap into the picture or overflow. */
  check('a long name is shrunk rather than wrapped',
    /white-space:nowrap/.test(name), true);
  check('and the size it shrinks from is on the fitted element',
    /font-size:\s*clamp\(/.test(name), true);
  check('which is the element the fitter writes to',
    /id="heroCoupleNames"/.test(ss), true);
  check('and the lines inside it do not size themselves',
    /\.hero-couple-name \.line\{[^}]*font-size/.test(ss), false);

  /* ONE place. Both of these restated the photo's size LATER in the file and
     therefore won - a px clamp inside the same media query, and a whole @640
     block written to beat the rule this now is. */
  check('no px clamp restates the photo size',
    /\.hero-photo-wrap\{\s*width:clamp\(/.test(ss), false);
  const photoRules = (ss.match(/\.hero-photo-wrap\{/g) || []).length;
  check('the photo is sized in two places only: desktop and phone', photoRules, 2);
}

// ── The focused thumbnail is never resampled ──────────────────────────────
// A 200px card against a 276px render meant the focused frame was painted at
// one size and displayed at another - 0.72 - which is what reads as blur. It
// does not improve by rendering LARGER, which is what the old 1100px version
// got wrong in the other direction: the fix is for the two numbers to be equal.
{
  const wt = fs.readFileSync('Website.txt', 'utf8');
  const num = (re) => { const m = wt.match(re); return m ? parseFloat(m[1]) : NaN; };
  const render = num(/const THUMB_MOBILE_WIDTH\s*=\s*(\d+);/);
  check('the render width is a single number', isFinite(render), true);
  /* Derived from it, not written twice. Two literals that happen to match today
     drift the moment one is tuned, and the drift is invisible - it just goes
     soft again. */
  check('the focus card is derived from the render width',
    /const FOCUS_CARD_WIDTH = THUMB_MOBILE_WIDTH;/.test(wt), true);
  check('the slot keeps a gutter around it',
    /const SLOT_WIDTH\s*=\s*FOCUS_CARD_WIDTH \+ (\d+);/.test(wt), true);
  const gutter = num(/const SLOT_WIDTH\s*=\s*FOCUS_CARD_WIDTH \+ (\d+);/);
  check('and the gutter is real', gutter > 0, true);

  /* measure() must resolve to exactly 1 for a card of the render width, and
     must still never magnify - scaling 276 up to fill a wider card blew up
     every fixed-pixel element inside the template. */
  /* Scoped to TemplateThumbnail. Another component further down has its own
     `const measure`, and an unscoped match lifted that one instead - it closes
     over a different ref and threw, which is a crash rather than a gate. */
  const comp = wt.slice(wt.indexOf('const TemplateThumbnail = memo'),
                        wt.indexOf('// ── CAROUSEL CARD'));
  const src = (comp.match(/const measure = \(\) => \{[\s\S]*?\n    \};/) || [''])[0];
  check('the measure routine was found', !!src, true);
  check('and it is the thumbnail\'s own', /wrapperRef\.current/.test(src), true);
  /* The card no longer equals the render width: the frame renders at a multiple
     of it so the card shows more of the page, and is reduced to fit. The
     harness is handed both numbers, as the component is. */
  const renderPx = num(/const THUMB_RENDER_WIDTH\s*=\s*THUMB_MOBILE_WIDTH \* (\d+);/) * render;
  check('the render width is a multiple of the card width', isFinite(renderPx), true);
  const measure = (cardW) => {
    let scale = null, offset = null;
    new Function('wrapperRef', 'THUMB_MOBILE_WIDTH', 'THUMB_RENDER_WIDTH', 'setScale', 'setOffsetX',
      src + '\nmeasure();')(
      { current: { offsetWidth: cardW } }, render, renderPx,
      (v) => { scale = v; }, (v) => { offset = v; });
    return { scale, offset };
  };
  /* An EXACT 1/n reduction. That is the whole reason the render width is a
     multiple: every output pixel is an even block of input pixels, which is the
     one downscale a browser resamples without softening, and on a 2x display it
     lands back on the device grid at 1:1. A fractional scale is what "blurred"
     described. */
  const focusScale = measure(render).scale;
  check('the focus card reduces by an exact fraction',
    Number.isInteger(1 / focusScale), true);
  check('and sits flush, with nothing to centre', measure(render).offset, 0);
  check('a peek card is smaller again', measure(Math.round(render * 0.78)).scale < focusScale, true);
  check('a card as wide as the render is never magnified', measure(renderPx * 2).scale, 1);
  check('and the leftover space is centred', measure(renderPx * 2).offset, renderPx / 2);
  // A zero-width wrapper must not produce a zero scale and a blank card.
  check('an unmeasured wrapper is left alone', measure(0).scale, null);
  /* The frame crops at its OWN height before the card does, so the height has
     to grow with the width or the extra coverage is cut straight back off. */
  check('the frame is made tall enough for what it now shows',
    /THUMB_MOBILE_HEIGHT \* \(THUMB_RENDER_WIDTH \/ THUMB_MOBILE_WIDTH\)/.test(wt), true);
  /* Animating the transform promotes the frame to a composited layer rasterised
     at one scale and resampled at every later one - softness on top of the
     reduction. The card's width animates underneath it instead. */
  check('the scale is not animated',
    /transition: "transform \d+ms/.test(wt), false);

  /* Five slots have to fit the window that turns the second peek on, or the
     carousel overflows the moment it widens. */
  const wideAt = num(/const wide = windowWidth >= (\d+);/);
  check('there is a threshold for the second peek', isFinite(wideAt), true);
  check('five slots fit inside it', (render + gutter) * 5 <= wideAt, true);
  // ...and three fit below it, which is the fallback.
  check('three fit in the narrower case', (render + gutter) * 3 <= 1024, true);

  // The first paint uses the focused value, since that is the card being read.
  check('the first paint is seeded at 1:1', /useState\(1\);/.test(wt), true);
}

// ── (The inferred-fingerprint block that stood here is gone.) ─────────────
// It hashed the page's own <style> and <script> content to identify a
// template. That cannot work: a live page carries whatever the HOST injects
// as well, so one file read 34a1a52a on disk and 8eb0282f in the browser, and
// two deploys were called stale on the strength of it. The replacement is
// above - each template DECLARES its marker and the suite recomputes it from
// the file. Left as a note rather than deleted, because the deleted version
// looked entirely reasonable and someone will think of it again.


// ── A design's calls to action are drawn with one stroke ──────────────────
// Vintage Love Story draws every CTA at 2px and its registry ring at 1px, so
// the ring read as a hairline beside them. It matters twice over: this design
// ships no Book Now, so .registry-cta is the button styleRegistryCtas copies
// for the registry preview's Purchase buttons - the hairline was reaching the
// gift cards too. Fixed in the design, not in a table of ten button styles.
{
  const vl = fs.readFileSync('template-vintagelovestory.html', 'utf8');
  const widthOf = (sel) => {
    const r = (vl.match(new RegExp('^\\' + sel + '\\{[\\s\\S]*?\\n\\}', 'm')) || [''])[0];
    const m = r.match(/border:\s*([\d.]+)px solid/);
    return m ? parseFloat(m[1]) : null;
  };
  const cta = widthOf('.registry-cta');
  /* OUTLINED controls only. .rsvp-submit is a filled pill with border:none, so
     it has no stroke to match and comparing against it read null - a gate that
     failed for the right reason but the wrong measurement. */
  const guest = widthOf('.rsvp-add-guest');
  const textarea = widthOf('.rsvp-textarea');
  check('the design\'s outlined controls were found',
    [cta, guest, textarea].every(v => v !== null), true);
  /* Compared against the design's own controls rather than asserted as 2: the
     number is free to change as long as they change together. */
  check('the registry ring matches the design\'s other outlines', cta, guest);
  check('and the form controls agree', cta, textarea);
  check('which is thicker than the hairline it was', cta > 1, true);
  // The phone override must not quietly put the hairline back.
  const phone = (vl.match(/\.registry-cta\{min-height:44px;[^}]*\}/) || [''])[0];
  check('the phone rule leaves the stroke alone',
    /border(-\w+)?-?width|border:\s*[\d.]+px/.test(phone), false);

  /* And the copy has to carry it. border-* are read from ONE edge and written
     to all four - a one-sided border on a pill would look broken - so the
     width must be in the copied list or the ring never reaches the button. */
  check('the Purchase button copies a border width',
    /'border-top-width'/.test(rt), true);
  check('and its style and colour with it',
    /'border-top-style', 'border-top-color'/.test(rt), true);
  check('written back to all four edges',
    /k = 'border-' \+ k\.slice\(11\)/.test(rt), true);
}

// ── Two designs name a section their own way ──────────────────────────────
// The menu names the section and the heading follows it, so the label is the
// only place either of these is written. Run through the real alignment rather
// than matched in source: a label the alignment cannot reach - a heading node
// it skips, a link it does not match - would leave the two disagreeing again.
{
  const { JSDOM } = (() => { try { return require('jsdom'); } catch (e) { return {}; } })();
  if (!JSDOM) { check('section naming (jsdom not installed - SKIPPED)', true, true); }
  else {
    const ANCH = {
      wedding: ['events-primary', 'wedding', 'event-schedule', 'event-details', 'weekend', 'itinerary'],
      registry: ['registry-section', 'registry', 'registry-wrap'],
    };
    const NAV = (rt.match(/var NAV_LINK_SOURCES = \[([\s\S]*?)\]\.join/)[1]
      .match(/'[^']+'/g) || []).map(x => x.slice(1, -1)).join(',');
    for (const [t, key, want] of [['heirloombloom', 'registry', 'Our Registry'],
                                  ['modernminimal', 'wedding', 'The Main Event']]) {
      const src = fs.readFileSync('template-' + t + '.html', 'utf8');
      const doc = new JSDOM(src).window.document;
      const fn = new Function('document', 'SECTION_ANCHORS', 'NAV_LINK_SOURCES',
        lift(rt, ['_headingNode', '_menuLabelFor', '_alignHeadingsToMenu']) +
        '\nreturn { align: _alignHeadingsToMenu, head: _headingNode, label: _menuLabelFor };')(
        doc, ANCH, NAV);
      check(t + ' ' + key + ' menu label', fn.label(ANCH[key]), want);
      fn.align();
      let sec = null;
      for (const id of ANCH[key]) { const e = doc.getElementById(id); if (e) { sec = e; break; } }
      const node = sec && fn.head(sec);
      check(t + ' ' + key + ' heading follows it',
        node ? (node.textContent || '').trim() : null, want);
      /* The built table too: several designs rebuild the nav on every hydrate,
         so a shipped link can be replaced a moment later by the old wording. */
      check(t + ' rebuilds it with the same words',
        new RegExp("label:\\s*'" + want + "'").test(src), true);
    }
  }
}

// ── Stacked cards are their own height ────────────────────────────────────
// grid-auto-rows:1fr makes every row as tall as the tallest, which is what
// keeps Hotel and Flights level side by side. Stacked there is no row to be
// level with: it padded the Hotel card out to the taller of the two and left a
// band of empty card under it, so Flights began a long way down the page.
{
  const ss = fs.readFileSync('template-sageandstill.html', 'utf8');
  const base = (ss.match(/^\.accom-inner\{[\s\S]*?\n\}/m) || [''])[0];
  check('side by side, the rows are levelled', /grid-auto-rows:1fr/.test(base), true);
  // The stacked override must undo it, not merely change the columns.
  const stacked = (ss.match(/\.accom-inner\{grid-template-columns:1fr;[^}]*\}/) || [''])[0];
  check('the stacked rule was found', !!stacked, true);
  check('and it stacks them', /grid-template-columns:1fr;/.test(stacked), true);
  check('and lets each card be its own height',
    /grid-auto-rows:auto/.test(stacked), true);
  /* An inline style beats a media query, so setting the two-column value in JS
     defeated the stacking rule entirely - the cards stayed two-up at 320px,
     each narrower than its own Book Now button. Only the ONE-card case sets it
     inline, because no media query knows about that state. */
  check('the two-column case is left to the stylesheet',
    /accomInner\.style\.gridTemplateColumns = '1fr 1fr'/.test(ss), false);
  check('while the single-card case still spans',
    /accomInner\.style\.gridTemplateColumns = '1fr'/.test(ss), true);
}

// ── Black Tie's phone arch moves as one group ─────────────────────────────
// Title, rule and copy are all measured from the card's top padding, so that
// one number moves the group down INSIDE the arch as a unit. Raising only the
// copy's margin opens a gap between the parts instead. Desktop is untouched.
{
  const bt = fs.readFileSync('template-blacktietimeless.html', 'utf8');
  const i = bt.indexOf('.arch-card{min-height:360px');
  check('the phone arch block was found', i > -1, true);
  const mob = bt.slice(i, i + 1200);
  const pad = parseFloat((mob.match(/padding:([\d.]+)rem/) || [])[1]);
  const r = mob.match(/\.arch-card::before\{top:calc\(([\d.]+)rem \+ ([\d.]+)rem\)/) || [];
  check('the rule is measured from the same edge as the title',
    r.length ? parseFloat(r[1]) === pad : false, true);
  check('and the group sits lower than it did', pad > 3.4, true);
  const label = parseFloat((mob.match(/\.arch-card-label\{font-size:([\d.]+)rem/) || [])[1]);
  const nameRule = (mob.match(/\.arch-card-name\{[^}]*\}/) || [''])[0];
  const name = parseFloat((nameRule.match(/margin-top:([\d.]+)rem/) || [])[1]);
  const ruleTop = r.length ? parseFloat(r[1]) + parseFloat(r[2]) : NaN;
  check('order still holds: title, rule, copy',
    pad + label * 1.1 < ruleTop && pad + label * 1.1 + name > ruleTop, true);
  // The card has to grow to hold it, or the button leaves the arch.
  check('the arch still has a floor to grow from',
    /min-height:360px/.test(mob), true);
}

// ── Thumbnails hydrate only where the flag says ───────────────────────────
// On a desktop the carousel sits beside a Live Preview that already shows the
// couple's own site, so the ten cards answer "what does this design look like"
// - and a design shown in someone else's photographs answers that badly. On a
// phone there is no preview pane and the card IS the preview.
//
// EVERY send path has to go through the flag. The one that seeds a thumbnail on
// its own load is the easy one to miss: a card scrolled into view would hydrate
// when nothing else does, and the carousel would drift into a mix of the two.
{
  const wt = fs.readFileSync('Website.txt', 'utf8');
  check('the flag exists', /const HYDRATE_THUMBNAILS = /.test(wt), true);
  check('and defaults to the phone-only behaviour',
    /const HYDRATE_THUMBNAILS = 'mobile';/.test(wt), true);

  /* RUN it, at all three settings and both viewports. A gate on the source
     would pass against a helper that always returned true. */
  const src = (wt.match(/const _hydrateThumbs = \(\) => \{[\s\S]*?\n\};/) || [''])[0];
  check('the helper was found', !!src, true);
  const make = (flag, width) => new Function('HYDRATE_THUMBNAILS', 'THUMB_MOBILE_MAX_VW', 'window',
    src + '\nreturn _hydrateThumbs;')(flag, 900, { innerWidth: width });
  check('mobile: hydrates on a phone', make('mobile', 380)(), true);
  check('mobile: does not on a desktop', make('mobile', 1400)(), false);
  check('true: hydrates on a desktop too', make(true, 1400)(), true);
  check('false: never hydrates, even on a phone', make(false, 380)(), false);
  // Exactly the block's own isMobile threshold, not a second one.
  check('the boundary is the shared threshold', make('mobile', 899)(), true);
  check('and the other side of it', make('mobile', 900)(), false);
  /* No window - server render, or a sandbox - must not silently stop the
     phone case, which is the one where the thumbnail IS the preview. */
  const noWin = new Function('HYDRATE_THUMBNAILS', 'THUMB_MOBILE_MAX_VW',
    src + '\nreturn _hydrateThumbs;')('mobile', 900);
  check('and it errs toward hydrating when it cannot tell', noWin(), true);

  /* FOUR send paths, not three. Every frame ASKS for its payload while its
     document is still parsing - that is what stops the runtime's sample-data
     fallback winning the race - and the responder answered all of them. Gating
     the batch send and the two onLoad handlers left the couple's photographs in
     the thumbnails, because none of those is how a thumbnail normally gets its
     data. Counted, so a fifth path added later has to be counted too. */
  const guarded = (wt.match(/_hydrateThumbs\(\)/g) || []).length;
  check('every thumbnail send path checks the flag', guarded >= 5, true);
  check('the ask/answer responder checks it too',
    /\(isThumb\(e\.source\) && !_hydrateThumbs\(\)\) \? null : buildPayload\(\)/.test(wt), true);
  /* It has to tell a thumbnail from the Live Preview by the FRAME, since both
     send the same message. */
  check('and tells them apart by matching the frame',
    /ref\.contentWindow === win/.test(wt), true);
  /* An unrecognised frame is answered in full: a stray frame showing the
     couple's site is a smaller fault than the Live Preview showing a stranger's. */
  const ready = wt.slice(wt.indexOf('const isThumb ='), wt.indexOf('const isThumb =') + 1400);
  check('an unrecognised frame still gets the real payload',
    /catch \(err\) \{ return false; \}/.test(ready), true);
  /* null rather than silence: the runtime reveals what it already has straight
     away, instead of ten cards sitting under a veil for its 2.5s backstop. */
  check('a skipped thumbnail is answered with null, not ignored',
    /const payload = \(isThumb/.test(wt), true);
  check('the batch send checks it', /if \(!_hydrateThumbs\(\)\) return;/.test(wt), true);
  check('the mobile card checks it on load',
    /onLoad=\{e => \{ if \(_hydrateThumbs\(\)\) sendToIframe/.test(wt), true);
  check('and so does the desktop carousel',
    /onIframeLoad=\{e => \{ if \(_hydrateThumbs\(\)\) sendToIframe/.test(wt), true);
  /* The Live Preview is a different surface and always shows the couple's own
     site. Guarding the whole effect instead of just the thumbnail branch would
     have stopped it updating on desktop - the one thing that must never break. */
  check('the live preview is sent unconditionally',
    /if \(livePreviewRef\.current\) sendToIframe\(livePreviewRef\.current, payload\);/.test(wt), true);

  /* The comment that used to state the old behaviour as a fact. Building on a
     stale comment has shipped a bug here before. */
  check('no comment still claims thumbnails always render the couple\'s copy',
    /Thumbnails DO render the couple's own copy/.test(wt), false);
}

// ── Both cards in a merged section get the same treatment ─────────────────
// Whimsical Romance parsed the hotel card - first <strong> becomes the title in
// .accom-name - and did not parse the travel card at all: it went in whole,
// under a hardcoded "Travel" subtitle left over from when this section was
// called Accommodations. So the couple's own "Flights" line rendered as body
// text while "Hotel" above it was a heading, under a stale second heading.
{
  const wr = fs.readFileSync('template-whimsicalromance.html', 'utf8');
  check('the stale subtitle is gone from the markup',
    /accom-travel-title/.test(wr), false);
  check('and its rule went with it', /^\.accom-travel-title\{/m.test(wr), false);
  check('no hardcoded heading is invented for the travel card',
    /'<div class="accom-travel-title">Travel<\/div>'/.test(wr), false);

  /* ONE parse, shared. The two cards drifted because each had its own; a gate
     that only checked the output would pass again the next time one changed. */
  const i = wr.indexOf('function _mpAccomParts');
  check('the two cards share one parse', i > -1, true);
  const body = wr.slice(i, wr.indexOf('// ── Hydration', i));
  const parts = new Function('_mpBookUrl', 'window', 'document',
    body + '\nreturn _mpAccomParts;')(() => '', {}, { getElementById: () => null });

  // The couple's own first line is the title, on both cards.
  const flights = parts('<strong>Flights</strong><br>The nearest airport is SAN.');
  check('the flights card takes its title from the copy', flights.name, 'Flights');
  check('and keeps the rest as its body', flights.address, 'The nearest airport is SAN.');
  const hotel = parts('<strong>Hotel</strong><br>Hyatt Regency<br><em>Room block</em>');
  check('the hotel card is parsed the same way', hotel.name, 'Hotel');
  check('and still lifts its room-block note', hotel.meta, 'Room block');

  /* RUN it. Counting 'accom-name' in the source passed against a travel card
     that had been given a hand-made parts object with an empty name - the class
     was still written, the branch just never fired. The rendered DOM is the
     only thing that answers "do both titles get the same treatment". */
  const { JSDOM } = (() => { try { return require('jsdom'); } catch (e) { return {}; } })();
  if (!JSDOM) { check('travel card render (jsdom not installed - SKIPPED)', true, true); }
  else {
    const dom = new JSDOM('<!doctype html><body><div id="accomContent"></div></body>');
    const doc = dom.window.document;
    const render = wr.slice(wr.indexOf('function _mpAccomParts'),
                            wr.indexOf('// ── Hydration', wr.indexOf('function _mpAccomParts')));
    const fn = new Function('document', 'window', '_mpBookUrl',
      render + '\nreturn renderAccomContent;')(doc, { MP_DATA: {} }, () => '');
    fn('<strong>Hotel</strong><br>Hyatt Regency<br><em>Room block</em>',
       '<strong>Flights</strong><br>The nearest airport is SAN.');
    const el = doc.getElementById('accomContent');
    const titles = [].slice.call(el.querySelectorAll('.accom-name'))
      .map(n => (n.textContent || '').trim());
    check('both cards render a title, in the same class', titles.length, 2);
    check('and they are the words the couple wrote', titles.join('|'), 'Hotel|Flights');
    check('with no stale subtitle above either',
      !!el.querySelector('.accom-travel-title'), false);
    check('the section is still headed once',
      el.querySelectorAll('.accom-title').length, 1);
    // A card with no copy must not draw an empty title box.
    const dom2 = new JSDOM('<!doctype html><body><div id="accomContent"></div></body>');
    const fn2 = new Function('document', 'window', '_mpBookUrl',
      render + '\nreturn renderAccomContent;')(dom2.window.document, { MP_DATA: {} }, () => '');
    fn2('<strong>Hotel</strong><br>Hyatt Regency', '');
    check('a missing flights card draws no empty title',
      dom2.window.document.querySelectorAll('.accom-name').length, 1);
  }
}

// ── Card titles line up across a row, whatever the cards say ──────────────
// Centring a grid item makes its position depend on how much copy it holds, so
// two cards with different amounts put their titles at different heights. It
// cost a pass on Hotel and Flights in Regal Boho and again in Heirloom Bloom.
// A divider that spans the band keeps its own align-self and is exempt.
{
  const cases = [
    ['template-heirloombloom.html', '.accom-inner', '.accom-divider'],
  ];
  for (const [file, wrap, divider] of cases) {
    const src = fs.readFileSync(file, 'utf8');
    const rule = (src.match(new RegExp('^\\' + wrap + '\\{[^}]*\\}', 'm')) || [''])[0];
    check(file + ' ' + wrap + ' was found', !!rule, true);
    check(wrap + ' anchors its cards to the top',
      /align-items:\s*start/.test(rule), true);
    check('and does not centre them', /align-items:\s*center/.test(rule), false);
    // The rule between them must NOT follow the cards up.
    const div = (src.match(new RegExp('^\\' + divider + '\\{[\\s\\S]*?\\n\\}', 'm')) || [''])[0];
    check(divider + ' stays centred on the band',
      /align-self:\s*center/.test(div), true);
  }

  /* The same fault through the OTHER property. Sage & Still's cards are made
     equal height by the grid, then centred INSIDE that height with
     justify-content - so each title's position still depended on how much copy
     sat under it. Equal boxes are not aligned contents; both are needed. */
  const flexCases = [
    ['template-sageandstill.html', '.accom-card'],
  ];
  for (const [file, card] of flexCases) {
    const src = fs.readFileSync(file, 'utf8');
    const rule = (src.match(new RegExp('^\\' + card + '\\{[\\s\\S]*?\\n\\}', 'm')) || [''])[0];
    check(file + ' ' + card + ' was found', !!rule, true);
    check(card + ' anchors its contents to the top',
      /justify-content:\s*flex-start/.test(rule), true);
    check('and does not centre them', /justify-content:\s*center/.test(rule), false);
    // The boxes must still be equal, or anchoring alone leaves ragged cards.
    const inner = (src.match(/^\.accom-inner\{[\s\S]*?\n\}/m) || [''])[0];
    check('while the boxes stay equal height',
      /align-items:\s*stretch/.test(inner) && /grid-auto-rows:1fr/.test(inner), true);
  }
}

// ── One section, one heading, one link for the merged pair ────────────────
// Modern Minimal drew Accommodations and Travel as two bands, each with its own
// <h2 class="section-title">. Merged, they both took the same name - so the
// page carried two headings reading "Travel" and syncMenuLinks added a second
// menu link for the second one. Counted in the rendered DOM, because the
// duplicate came from markup the template ships, not from the link table.
{
  const { JSDOM } = (() => { try { return require('jsdom'); } catch (e) { return {}; } })();
  if (!JSDOM) { check('one travel band (jsdom not installed - SKIPPED)', true, true); }
  else {
    const mm = fs.readFileSync('template-modernminimal.html', 'utf8');
    const doc = new JSDOM(mm).window.document;
    const headings = [].slice.call(doc.querySelectorAll('.section-title'))
      .map(h => (h.textContent || '').trim())
      .filter(t => /^travel$/i.test(t) || /^accommodations$/i.test(t));
    check('the merged pair is headed once', headings.length, 1);
    check('and it is called Travel', headings[0], 'Travel');
    /* The old anchor stays so a link or a saved scroll position pointing at it
       still lands somewhere - but it must hold no copy of its own. */
    const anchor = doc.getElementById('accommodations');
    check('the old anchor is still reachable', !!anchor, true);
    check('and carries nothing', anchor ? anchor.textContent.trim() : null, '');
    // Both cards live in the one band.
    const band = doc.getElementById('travel-section');
    check('the hotel card is in the travel band',
      !!(band && band.querySelector('#accomList')), true);
    check('and so is the flights card',
      !!(band && band.querySelector('#travelContent')), true);
    // Two buttons, one per card - not one shared between them.
    check('each card keeps its own button',
      band ? band.querySelectorAll('.travel-btn').length : 0, 2);
    // Same alignment rule as above: the two cards hold different amounts.
    const cards = (mm.match(/^\.travel-cards\{[^}]*\}/m) || [''])[0];
    check('the two cards anchor to the top', /align-items:\s*start/.test(cards), true);
  }
}

// ── (The second build-stamp block that stood here is gone.) ──────────────
// It duplicated the stamp checks now kept with the template markers above,
// and pinned the stamp to an older value - so after a bump the suite failed
// in two places for one reason and the second looked like a separate fault.
// One stamp, checked once.


// ── One menu entry for the merged section, on every template ──────────────
// Accommodations and Travel are one section with one toggle and one box, so a
// second link points at half of it - and on several designs BOTH entries showed
// at once, giving a couple two menu items for one thing. Read out of the
// rendered nav as well as the built table: the shipped markup is what a visitor
// sees before hydrate, and it drifted from the table on four templates.
{
  const { JSDOM } = (() => { try { return require('jsdom'); } catch (e) { return {}; } })();
  if (!JSDOM) { check('one travel entry (jsdom not installed - SKIPPED)', true, true); }
  else {
    const NAV = (rt.match(/var NAV_LINK_SOURCES = \[([\s\S]*?)\]\.join/)[1]
      .match(/'[^']+'/g) || []).map(x => x.slice(1, -1)).join(',');
    const PAIR = /#(accommodations|travel-section|travel-standalone)$/;
    const tpls = fs.readdirSync('.').filter(f => /^template-.*\.html$/.test(f)).sort();
    check('all ten templates are covered', tpls.length, 10);
    const twoLinks = [], notTravel = [], stillAccom = [];
    for (const t of tpls) {
      const src = fs.readFileSync(t, 'utf8');
      const doc = new JSDOM(src).window.document;
      const links = [].slice.call(doc.querySelectorAll(NAV))
        .filter(a => PAIR.test(a.getAttribute('href') || ''));
      const name = t.replace('template-', '').replace('.html', '');
      /* Golden Hour ships an empty <ul> and builds every link in JS, so 0 in the
         markup is correct there and 2 never is. The built table below carries
         the other half of the answer; between them a template must offer the
         section exactly once. */
      if (links.length > 1) twoLinks.push(name + '=' + links.length);
      const builtPair = (src.match(/(?:href|h)\s*:\s*'#(?:accommodations|travel-section|travel-standalone)'/g) || []);
      if (builtPair.length > 1) twoLinks.push(name + ' built=' + builtPair.length);
      if (!links.length && !builtPair.length) twoLinks.push(name + ' offers none');
      for (const a of links) {
        const txt = (a.textContent || '').trim();
        if (txt !== 'Travel') notTravel.push(name + ':"' + txt + '"');
      }
      /* The BUILT table too - several designs rebuild the nav on every hydrate,
         so a shipped link that reads Travel can be replaced by one that reads
         Accommodations a moment later. That is the state the owner saw. */
      const built = (src.match(/(?:label|l)\s*:\s*'Accommodations[^']*'/g) || []);
      if (built.length) stillAccom.push(name + '=' + built.length);
    }
    check('no template offers two links for the one section', twoLinks.join(','), '');
    check('and the one it offers is called Travel', notTravel.join(','), '');
    check('nothing rebuilds it as Accommodations', stillAccom.join(','), '');
  }
}

// ── One Travel box, two cards, ten templates ──────────────────────────────
// Accommodations and Travel are one section: one toggle, one box, one booking
// link. But all ten designs draw the hotel and the flights as two separate
// things and every one of them reads BOTH fields to do it - so the merged blob
// is cut once in the runtime rather than the templates being rewritten. The
// cut is RUN here; a gate on the editor's field list alone would pass while
// every site rendered its travel copy twice.
{
  const wt = fs.readFileSync('Website.txt', 'utf8');
  const sections = (wt.match(/const PAGE_SECTIONS = \[[\s\S]*?\n\];/) || [''])[0];
  check('the sections list was found', !!sections, true);
  check('there is no accommodations toggle left',
    /section: "accommodations"/.test(sections), false);
  check('and travel is still there',
    /section: "travel"/.test(sections), true);
  // One booking link, and it is the surviving one.
  check('travel carries the only booking link',
    (sections.match(/urlKey:/g) || []).length, 1);
  check('which is the travel url', /urlKey: "travelUrl"/.test(sections), true);
  /* The ten per-template default sets must not still be setting a dead switch.
     Scoped to the LINES that carry the switches, not to the top of the file:
     the field-id maps at the top still bind showAccomodations to its Airtable
     column, deliberately. The column exists in the base whether or not the
     editor draws a box for it, and pulling the id out is how a save quietly
     stops writing something. */
  const toggleLines = wt.split(/\r?\n/).filter(l => /showTravel:\s*true/.test(l));
  check('the ten template default sets were found', toggleLines.length, 10);
  check('none of them still flips the dead switch',
    toggleLines.filter(l => /showAccomodations:/.test(l)).length, 0);
  check('and the field-id binding is left alone',
    /showAccomodations: "QQB5r"/.test(wt), true);
  // The payload sends the empty key rather than dropping it: every template
  // branches on accommodation_info, and a missing key is a different shape from
  // an empty string.
  check('the payload still sends the key, empty',
    /accommodation_info: '',/.test(wt), true);
  /* Still the surviving field - with no sample link standing in when it is empty
     (MP-919: a cleared link came back as the template's sample after saving). */
  check('and points the old booking link at the surviving field',
    /accommodation_url: _cleanUrl\(d\.travelUrl \|\| ''\),/.test(wt), true);
  /* ONE button, under the hotel. The single box has one URL, and sending it as
     both keys drew a Book Now under the flights card too - every design draws a
     button for whichever of the two URLs it is handed. */
  check('the flights card is given no booking link', /travel_url: '',/.test(wt), true);
  /* Seeded like starter copy: a site nobody has edited has a working button.
     Emptied by the couple it stays empty, which a falsy fallback would undo. */
  check('there is a default booking link', /travelUrl: 'https:\/\/hyatt\.com',/.test(wt), true);
  check('and the seeding loop reaches it', /for \(const key of \[sec\.contentKey, sec\.urlKey\]\)/.test(wt), true);
  check('one switch drives both menu keys',
    /accommodations: d\.showTravel === true \|\| !!localChanges\.travelInfo/.test(wt), true);

  // ── The cut itself ──────────────────────────────────────────────────────
  const split = new Function(rt.match(/var _VOID = \/\^\([^)]*\)\$\/i;/)[0] + '\n' +
    lift(rt, ['_openTags', '_balanceBlocks', '_splitTravelBlob']) + '\nreturn _splitTravelBlob;')();

  const two = { travel_info: 'A<br><br>B', accommodation_info: '' };
  split(two);
  check('the first card goes where the hotel goes', two.accommodation_info, 'A');
  check('and the rest where the flights go', two.travel_info, 'B');

  // Three cards: the extra one stays on the travel side, rejoined on the same
  // separator so a design that splits again still finds its boundaries.
  const three = { travel_info: 'A<br><br>B<br><br>C', accommodation_info: '' };
  split(three);
  check('a third card stays with the travel copy', three.travel_info, 'B<br><br>C');

  // One card: it goes in the hotel slot and the flights slot stays empty -
  // the same state as a couple who wrote about a hotel and not about airports.
  const one = { travel_info: 'A', accommodation_info: '' };
  split(one);
  check('a single card fills the hotel slot', one.accommodation_info, 'A');
  check('and leaves the other empty', one.travel_info, '');

  // Idempotent: hydrate runs more than once in the editor, and a second cut
  // would move the flights card into the hotel slot.
  const twice = { travel_info: 'A<br><br>B', accommodation_info: '' };
  split(twice); split(twice);
  check('cutting twice changes nothing',
    twice.accommodation_info + '|' + twice.travel_info, 'A|B');

  /* THE LIVE-SITE CASE, and the reason this gate is written the way it is.

     Every record written before the merge still HOLDS the hotel in
     accommodation_info - the editor stopped writing that column, nothing
     cleared it. The preview never sees that, because the editor builds its
     payload fresh with accommodation_info: ''. The live site reads the record,
     so it arrives full.

     The first version of the cut bailed out whenever that column had anything
     in it, which meant the merged blob was never cut on a live site: Pressed
     Petals drew the hotel on the left and the hotel PLUS the flights on the
     right. Preview was clean the whole time, which is what made it look like a
     stale deploy. Travel is the field the couple edits, so travel wins. */
  const stale = { travel_info: 'H<br><br>F', accommodation_info: 'OLD HOTEL' };
  split(stale);
  check('a merged blob overrides the stale hotel column', stale.accommodation_info, 'H');
  check('and the flights card is left on its own', stale.travel_info, 'F');

  /* But a genuinely two-column record - one card in travel, hotel in the old
     column - is what a pre-merge site looks like when it was correct. Nothing
     to cut there, and cutting would move its flights copy into the hotel slot. */
  const legacy = { travel_info: 'F', accommodation_info: 'OLD HOTEL' };
  split(legacy);
  check('a pre-merge record with both columns is left alone',
    legacy.accommodation_info + '|' + legacy.travel_info, 'OLD HOTEL|F');

  /* Idempotency no longer rides on "accommodation_info is empty" - that signal
     meant two different things and one of them was this bug. */
  const flagged = { travel_info: 'H<br><br>F<br><br>X', accommodation_info: '' };
  split(flagged); split(flagged);
  check('a three-card blob is cut once, not twice',
    flagged.accommodation_info + '|' + flagged.travel_info, 'H|F<br><br>X');

  // Nothing to cut is not an error.
  const empty = { travel_info: '', accommodation_info: '' };
  split(empty);
  check('an empty box produces nothing', empty.accommodation_info, '');

  // It has to run before the templates read the payload, and before markTitles
  // reshapes anything.
  const hyd = rt.slice(rt.indexOf('function hydrate(d)'),
                       rt.indexOf('function hydrate(d)') + 3000);
  check('the cut happens inside hydrate', /_splitTravelBlob\(d\);/.test(hyd), true);
  check('and before the template is handed the payload',
    hyd.indexOf('_splitTravelBlob(d);') < hyd.indexOf('hydrateTemplate') ||
    hyd.indexOf('hydrateTemplate') === -1, true);
}

// ── A wrapper around artwork is not a section heading ─────────────────────
// Whimsical Romance's itinerary title is an SVG textPath with a screen-reader
// <h2> beside it, both inside one .itinerary-title-wrap. That wrapper matched
// on [class*="title"] and holds BOTH copies, so it reported "Weekend Itinerary
// Weekend Itinerary" - and once that doubled string came back as the section's
// heading, _writeHeading set textContent on the wrapper and replaced the arched
// artwork with the doubled words as plain text. The loop closed on screen.
{
  const { JSDOM } = (() => { try { return require('jsdom'); } catch (e) { return {}; } })();
  if (!JSDOM) { check('artwork wrappers (jsdom not installed - SKIPPED)', true, true); }
  else {
    const dom = new JSDOM(fs.readFileSync('template-whimsicalromance.html', 'utf8'));
    const doc = dom.window.document;
    const head = new Function('document',
      lift(rt, ['_headingNode']) + '\nreturn _headingNode;')(doc);
    const node = head(doc.getElementById('itinerary'));
    check('the itinerary reports a heading at all', !!node, true);
    check('and it says the words once', node ? (node.textContent || '').trim() : null,
      'Weekend Itinerary');
    check('the wrapper holding the artwork is not the one offered',
      !!(node && node.querySelector && node.querySelector('svg')), false);
    // Whatever it picked has to be safe to write to, or the loop reopens.
    check('and it holds nothing but its own words',
      node ? node.children.length : null, 0);
    /* Writing the heading must leave the drawing alone. Run the real write and
       count the artwork before and after - the check that would have caught
       this the first time. */
    const before = doc.querySelectorAll('svg').length;
    if (node) node.textContent = 'Weekend Itinerary';
    check('writing it does not destroy the drawing',
      doc.querySelectorAll('svg').length, before);
  }
}

// ── Black Tie's rule sits between the title and the copy, at any height ───
// top:38% is a share of the CARD's height while the title is a fixed distance
// from the top, so the two only line up at one card height. Stacked on a phone
// the cards grow with the hotel's address and the rule came to rest through the
// first line of the copy. Asserted as ORDER, computed from the values, not as
// the values themselves - the numbers are free to be retuned.
{
  const bt = fs.readFileSync('template-blacktietimeless.html', 'utf8');
  /* The phone block, located by the rule it contains rather than by a media
     query string: this file writes '@media(max-width:640px)' without the space
     and has three of them, so slicing on a hand-typed query found nothing and
     every value came back NaN. A NaN comparison is false, which reads as a
     failure here - but in the other direction it would have been a silent pass. */
  const mobStart = bt.indexOf('.arch-card{min-height:360px');
  check('the phone arch block was found', mobStart > -1, true);
  const mob = bt.slice(mobStart, mobStart + 1200);
  const num = (re, src) => { const m = src.match(re); return m ? parseFloat(m[1]) : NaN; };
  const pad   = num(/\.arch-card\{min-height:360px;padding:([\d.]+)rem/, mob);
  const label = num(/\.arch-card-label\{font-size:([\d.]+)rem/, mob);
  const rule2 = (mob.match(/\.arch-card::before\{top:calc\(([\d.]+)rem \+ ([\d.]+)rem\)/) || []);
  const ruleTop = rule2.length ? parseFloat(rule2[1]) + parseFloat(rule2[2]) : NaN;
  const nameRule = (mob.match(/\.arch-card-name\{[^}]*\}/) || [''])[0];
  const name  = num(/margin-top:([\d.]+)rem/, nameRule);
  check('the phone values were all found',
    [pad, label, ruleTop, name].every(v => isFinite(v)), true);
  // The rule must no longer be a percentage on a phone: that is the bug itself.
  check('the phone rule is measured from the top, not a share of the height',
    /\.arch-card::before\{top:calc\(/.test(mob), true);
  const labelBottom = pad + label * 1.1;              // line-height:1.1
  check('the title clears the rule', labelBottom < ruleTop, true);
  check('and the copy starts below it', labelBottom + name > ruleTop, true);
  // Desktop is untouched - it is side-by-side, shorter, and lines up with the
  // arch as drawn.
  const base = bt.slice(0, mobStart);
  check('desktop keeps the percentage', /\.arch-card::before\{[\s\S]*?top:38%/.test(base), true);
}

// ── Nothing is visually hidden by accident, or by mistake ─────────────────
// Whimsical Romance draws its itinerary title as an SVG textPath with a
// screen-reader <h2> beside it carrying the same words. .itinerary-title comes
// LATER in the file and sets position:relative, which beat .visually-hidden's
// position:absolute at equal specificity - and clip only applies to an
// absolutely positioned box, so the clip went inert and "Weekend Itinerary"
// rendered twice. The class is always worn alongside a visible-element class,
// so it has to win on more than source order.
{
  const wr = fs.readFileSync('template-whimsicalromance.html', 'utf8');
  const vh = (wr.match(/^\.visually-hidden\{[\s\S]*?\n\}/m) || [''])[0];
  check('the hiding class exists', !!vh, true);
  // Every declaration, not just position: any one of them losing reopens it.
  const decls = vh.replace(/^[^{]*\{|\}$/g, '').split(';')
    .map(x => x.trim()).filter(x => x && !x.startsWith('/*'));
  check('there are declarations to check', decls.length > 0, true);
  check('every one of them wins on more than source order',
    decls.filter(d => !/!important/.test(d)).join(' | '), '');
  // The element it is on must still be there - hiding it by deleting it would
  // pass a "does not appear twice" check and lose the accessible name.
  check('the screen-reader heading is still in the markup',
    /class="itinerary-title visually-hidden"/.test(wr), true);
  check('and the arched title it duplicates is too',
    /class="itinerary-title-text"/.test(wr), true);
}

// ── Section headings weigh the same as each other ─────────────────────────
// Gallery was the only one at 700. Corben is heavy to begin with, so it read as
// a different level of heading rather than the same one.
{
  const wr = fs.readFileSync('template-whimsicalromance.html', 'utf8');
  const weights = {};
  for (const cls of ['ntk-title', 'gallery-title', 'accom-title', 'rsvp-title']) {
    const r = (wr.match(new RegExp('^\\.' + cls + '\\{[^}]*\\}', 'm')) || [''])[0];
    if (!r) continue;
    weights[cls] = (r.match(/font-weight:\s*(\d+)/) || [])[1] || 'unset';
  }
  check('the section headings were found', Object.keys(weights).length >= 3, true);
  const distinct = [...new Set(Object.values(weights))];
  check('they all carry the same weight',
    distinct.length === 1 ? '' : JSON.stringify(weights), '');
}

// ── Vintage Love Story is called the same thing in both places ────────────
// The Content box is "The Wedding"; the menu said "Event Details", so the
// couple edited a box whose name was in no menu. And #events had no entry at
// all - switching Other Events on gave a section with no way to reach it.
{
  const { JSDOM } = (() => { try { return require('jsdom'); } catch (e) { return {}; } })();
  if (!JSDOM) { check('VLS naming (jsdom not installed - SKIPPED)', true, true); }
  else {
    const vl = fs.readFileSync('template-vintagelovestory.html', 'utf8');
    const doc = new JSDOM(vl).window.document;
    const label = h => {
      const a = doc.querySelector('.top-nav a[href="' + h + '"]');
      return a ? (a.textContent || '').trim() : null;
    };
    check('the wedding link is named after its Content box', label('#wedding'), 'The Wedding');
    check('other events has a link at all', label('#events'), 'Other Events');
    // Every nav anchor needs a visibility rule, or it shows on every site.
    const rules = (vl.match(/href:\s*'(#[a-z-]+)'/g) || [])
      .map(x => (x.match(/'(#[a-z-]+)'/) || [])[1]);
    const hrefs = [].slice.call(doc.querySelectorAll('.top-nav a'))
      .map(a => a.getAttribute('href'));
    check('every nav link has a rule deciding when it shows',
      hrefs.filter(h => rules.indexOf(h) === -1).join(','), '');
    // ...and the section is headed what the link calls it.
    const head = new Function('document', lift(rt, ['_headingNode']) + '\nreturn _headingNode;')(doc);
    const node = head(doc.getElementById('events'));
    check('the other-events section is headed the same',
      node ? (node.textContent || '').trim() : null, 'Other Events');
  }
}

// ── A name is re-measured when its frame changes size ─────────────────────
// The carousel thumbnails are iframes the editor resizes AFTER load - it sets
// the render width, then scales them down. The name was measured at whatever
// width the frame had at hydrate and never again, so a long one stayed clipped
// in the thumbnail while the preview shrank it correctly. Watching the element
// covers that without depending on which resize path a surface takes.
{
  const fit = rt.slice(rt.indexOf('function scheduleNameFit'),
                       rt.indexOf('function hydrateThingsToDo'));
  check('the fitter still re-runs on a window resize',
    /addEventListener\('resize'/.test(fit), true);
  check('and on the element being resized', /new ResizeObserver\(/.test(fit), true);
  check('watching something that changes with the frame',
    /ro\.observe\(document\.(documentElement|body)\)/.test(fit), true);
  // Debounced: a ResizeObserver fires per frame during a drag, and fitOneName
  // walks 24 steps of layout each time.
  check('the re-run is debounced', /clearTimeout\(t\); t = setTimeout\(run,/.test(fit), true);
  check('and it is guarded for browsers without one',
    /if \(window\.ResizeObserver\)/.test(fit), true);
}

// ── Modern Minimal: a link for every section it actually has ──────────────
// Unlike the designs that merge these pairs, this one keeps four separate
// sections with four separate toggles - but the nav offered two entries, each
// standing for a pair. A couple switching Other Events or Accommodations on got
// a section with no way to reach it, and the entry that WAS there scrolled past
// it to the wrong one. The link table is EVALUATED against each toggle
// combination, because every entry already existed; only its condition was wrong.
{
  const mm = fs.readFileSync('template-modernminimal.html', 'utf8');
  const table = (mm.match(/var links = \[[\s\S]*?\n  \];/) || [''])[0];
  check('the nav link table was found', !!table, true);
  const build = new Function('menu', 'rsvpOn', 'd', table + '\nreturn links;');
  const OFF = { home: true };
  /* Three, not four. Accommodations and Travel merged into one entry after
     this gate was written; the two event sections are still separate here. */
  for (const [key, href] of [['wedding', '#events-primary'], ['other_events', '#other-events'],
                             /* #travel-section: where the Travel content is drawn.
                                #accommodations is an always-hidden anchor here. */
                             ['travel', '#travel-section']]) {
    const on = build(Object.assign({}, OFF, { [key]: true }), false, {});
    const shown = on.filter(l => l.show).map(l => l.href);
    check('modernminimal links ' + href + ' when only ' + key + ' is on',
      shown.indexOf(href) > -1, true);
    // ...and does not offer it when that section is off.
    const off = build(OFF, false, {}).filter(l => l.show).map(l => l.href);
    check('and does not when it is off', off.indexOf(href), -1);
  }
  // The four are distinct entries, not one entry standing for a pair.
  const all = build({ home: true, wedding: true, other_events: true,
                      accommodations: true, travel: true }, false, {})
    .filter(l => l.show).map(l => l.href);
  check('all three sections are reachable at once',
    ['#events-primary', '#other-events', '#travel-section']
      .every(h => all.indexOf(h) > -1), true);
  check('and the merged pair is offered once, not twice',
    all.filter(h => h === '#accommodations' || h === '#travel-section').length, 1);
  // The shipped nav is what shows before hydrate; it must agree.
  const staticHrefs = (mm.match(/<a href="#[a-z-]+"/g) || []).map(x => x.slice(9, -1));
  check('the shipped nav offers them too',
    ['#other-events', '#travel-section'].every(h => staticHrefs.indexOf(h) > -1), true);
  check('and does not still ship the second one',
    /* #accommodations is an always-hidden anchor on this design now - the
       Travel content is in #travel-section - so a link to it scrolled nowhere. */
    staticHrefs.indexOf('#accommodations'), -1);
}

// ── Golden Hour: the invitation belongs to the hero ───────────────────────
// It reads "<names> lovingly invite you to celebrate their wedding" - addressed
// to a guest arriving at the page. It lived inside #wedding, so Our Story sat
// between the photograph and the invitation. Order is asserted in the DOM, and
// the band needs its own display now that it no longer inherits #wedding's.
{
  const { JSDOM } = (() => { try { return require('jsdom'); } catch (e) { return {}; } })();
  if (!JSDOM) { check('invite order (jsdom not installed - SKIPPED)', true, true); }
  else {
    const gh = fs.readFileSync('template-goldenhour.html', 'utf8');
    const doc = new JSDOM(gh).window.document;
    const invite = doc.getElementById('weddingInvite');
    const story = doc.getElementById('story');
    const hero = doc.getElementById('home');
    check('the invitation line is still on the page', !!invite, true);
    check('it is no longer inside the wedding section',
      !!(doc.getElementById('wedding') || {}).contains &&
      doc.getElementById('wedding').contains(invite), false);
    // DOCUMENT_POSITION_FOLLOWING === 4
    check('it comes after the hero',
      !!(hero.compareDocumentPosition(invite) & 4), true);
    check('and before Our Story',
      !!(invite.compareDocumentPosition(story) & 4), true);
    check('its band carries its own display',
      /el\('invite'\)[\s\S]{0,60}menu\.wedding/.test(gh), true);
    check('and is painted like the sections around it',
      /^\.invite-section\{[^}]*background:var\(--blue\)/m.test(gh), true);
  }
}

// ── One box of copy per section that exists ───────────────────────────────
// Coastal Chic has ONE menu link over the events grid and ONE over travel, but
// the shared table seeded Other Events and Accommodations too - so the couple
// found a third event card in a box whose section is not on their site, and the
// hotel in a box that renders nowhere. The copy moves rather than duplicating,
// and the two empty boxes turn their own toggles off on save.
//
// _contentDefault is EVALUATED, not read: the merge is an expression, and a
// gate matching the source text would pass against a table that never resolves.
{
  const block = fs.readFileSync('Website.txt', 'utf8');
  /* Non-greedy to the FIRST '};'. Anchoring on '\n};' instead skipped straight
     past a one-line `= {};` and swallowed everything down to the next
     multi-line object - so emptying the table made this block throw on a
     duplicate declaration rather than fail a check, and a crash is not a gate.
     Neither table has a nested object that closes with '};'. */
  const cd = (block.match(/const CONTENT_DEFAULTS = \{[\s\S]*?\};/) || [''])[0];
  const td = (block.match(/const TEMPLATE_CONTENT_DEFAULTS = \{[\s\S]*?\};/) || [''])[0];
  check('both tables were found', !!cd && !!td, true);
  /* The per-template table is DECLARED empty and filled on the line after it,
     so lifting the declaration alone gave an empty object and every seed read
     as the shared default - a gate reporting that nothing was merged, when what
     had actually gone missing was the half of the source that does the
     merging. The pieces that build it come too. */
  const seed = (block.match(/const _mergedEvents = \{[\s\S]*?\n\};/) || [''])[0];
  const fill = (block.match(/MERGED_EVENT_TEMPLATES\.forEach\(id => \{[^\n]*\n/) || [''])[0];
  check('the table is actually populated somewhere', !!seed && !!fill, true);
  let fn = null;
  try {
    fn = new Function((block.match(/const TEMPLATES = \[[\s\S]*?\n\];/) || [''])[0] +
      '\nconst VISIBLE_TEMPLATES = TEMPLATES.filter(t => t.available);\n' +
      (block.match(/const TEMPLATE_ID = TEMPLATES\.reduce[\s\S]*?\n\}, \{\}\);/) || [''])[0] + '\n' +
      (block.match(/const MERGED_EVENT_TEMPLATES = new Set\(\[[\s\S]*?\]\);/) || [''])[0] + '\n' +
      cd + '\n' + seed + '\n' + td + '\n' + fill +
      '\nreturn { f: (t, k) => {' +
      '  const p = TEMPLATE_CONTENT_DEFAULTS[t] || {};' +
      '  return (k in p) ? p[k] : (CONTENT_DEFAULTS[k] || ""); },' +
      '  C: CONTENT_DEFAULTS };')();
  } catch (e) { fn = null; }
  check('the two tables evaluate together', !!fn, true);

  /* KEYED BY TEMPLATE ID, AND THE ID IS DERIVED, NOT TYPED.

     This gate used to call fn.f('coastalchic', ...) against a table the
     product looks up by uuid. Both sides used the same wrong key, so the gate
     passed for a year's worth of passes while the seed it describes reached
     nobody. Reading the ids out of TEMPLATES is the only version that cannot
     agree with itself and be wrong. */
  const tbl = (block.match(/const TEMPLATES = \[[\s\S]*?\n\];/) || [''])[0];
  const idMap = (block.match(/const TEMPLATE_ID = TEMPLATES\.reduce[\s\S]*?\n\}, \{\}\);/) || [''])[0];
  const merged = (block.match(/const MERGED_EVENT_TEMPLATES = new Set\(\[[\s\S]*?\]\);/) || [''])[0];
  check('the id map and the merged list were found', !!tbl && !!idMap && !!merged, true);
  const ctx = new Function(tbl +
    '\nconst VISIBLE_TEMPLATES = TEMPLATES.filter(t => t.available);\n' +
    idMap + '\n' + merged +
    '\nreturn { ID: TEMPLATE_ID, M: MERGED_EVENT_TEMPLATES };')();
  check('every template resolved to an id', Object.keys(ctx.ID).length, 10);

  const NAMES = ['coastalchic', 'sageandstill', 'whimsicalromance', 'regalboho'];
  check('four designs merge their event sections', ctx.M.size, 4);
  check('and they are the four named',
    NAMES.every(n => ctx.M.has(ctx.ID[n])), true);
  /* Every id in the set has to BE an id. A name that is not a template
     resolves to undefined, which a Set accepts silently. */
  check('no entry in the set is undefined', ctx.M.has(undefined), false);

  for (const n of NAMES) {
    const D = fn ? fn.f.bind(null, ctx.ID[n]) : (() => '');
    const ev = D('weddingsInfo');
    check(n + ' seeds no Other Events copy', D('eventsInfo'), '');
    check(n + ' carries the third card in its one box',
      ev.indexOf('Welcome Cocktails') > -1, true);
    check(n + ' still has the two it had',
      ev.indexOf('The Ceremony') > -1 && ev.indexOf('The Reception') > -1, true);
    /* markStructure splits cards on two or more <br>s. Three cards need two
       separators; a single <br> would fuse the new card onto the Reception. */
    check(n + ' has three cards, not two and a paragraph',
      (ev.match(/(<br\s*\/?>\s*){2,}/gi) || []).length, 2);
    /* A blank line INSIDE a card would make the attire line a card of its own,
       so the spacer has to stay the editor's own span. */
    check(n + ' spaces inside a card with the editor\'s own spacer',
      /class="mp-gap"/.test(ev), true);
  }

  // Travel is merged for every template, so the shared table carries it.
  const T = fn ? fn.f.bind(null, ctx.ID.coastalchic) : (() => '');
  const tr = T('travelInfo');
  check('the hotel is in Travel', tr.indexOf('Hyatt Regency') > -1, true);
  check('and the flights with it', tr.indexOf('San Diego International') > -1, true);
  check('hotel before flights, as it renders',
    tr.indexOf('Hyatt Regency') < tr.indexOf('San Diego International'), true);
  check('travel is one card and one card', (tr.match(/(<br\s*\/?>\s*){2,}/gi) || []).length, 1);
  check('the retired accommodations box seeds nothing', T('accomodationInfo'), '');

  // The six that keep two event sections are untouched by any of it.
  const KEEPS = ['pressedpetals', 'heirloombloom', 'modernminimal', 'goldenhour',
                 'blacktietimeless', 'vintagelovestory'];
  check('the other six still have an Other Events box to fill',
    KEEPS.filter(n => !fn || fn.f(ctx.ID[n], 'eventsInfo') !== fn.C.eventsInfo).join(','), '');
  check('and their wedding copy is the shared two cards',
    KEEPS.filter(n => !fn || fn.f(ctx.ID[n], 'weddingsInfo') !== fn.C.weddingsInfo).join(','), '');
}

// ── One section for hotel and flights where the design has one link ───────
// Sage & Still and Whimsical Romance each ship a single "Accommodations" menu
// link and a single place to put this content. Travel used to be its own
// section, shown only while Accommodations was OFF - so a couple who filled in
// both saw the hotel and lost the flights, and switching Accommodations on
// silently removed the Travel link. The menu names the section, so
// Accommodations keeps the header and travel is clubbed into it.
//
// Driven through the real hydrate paths with all four toggle combinations,
// because the bug was entirely in the CONDITIONS - every branch existed.
{
  const { JSDOM } = (() => { try { return require('jsdom'); } catch (e) { return {}; } })();
  if (!JSDOM) { check('merged travel (jsdom not installed - SKIPPED)', true, true); }
  else {
    for (const t of ['sageandstill', 'whimsicalromance']) {
      const src = fs.readFileSync('template-' + t + '.html', 'utf8');
      // The standalone section must never be shown, on any path.
      const shows = (src.match(/travelSection\.style\.display\s*=\s*([^;]+);/g) || []);
      check(t + ' decides the travel section once', shows.length, 1);
      check(t + ' never shows it', /travelSection\.style\.display = 'none';/.test(src), true);
      // The merged section answers to EITHER toggle.
      check(t + ' opens the merged section for either toggle',
        /menu\.accommodations \|\| menu\.travel/.test(src), true);
      // No second menu entry pointing at a section that is never displayed.
      check(t + ' has no menu entry for the dead section',
        /href:\s*'#travel-section'/.test(src), false);
      check(t + ' still links the surviving one',
        /href="#accommodations"|href:\s*'#accommodations'/.test(src), true);
    }
    // Whimsical builds its drawer in JS: run it and read the labels back.
    {
      const dom = new JSDOM(fs.readFileSync('template-whimsicalromance.html', 'utf8'));
      const doc = dom.window.document;
      const labels = [].slice.call(doc.querySelectorAll('#menuLinks a'))
        .map(a => (a.getAttribute('href') || '') + '=' + (a.textContent || '').trim());
      check('the shipped drawer offers accommodations once',
        labels.filter(l => /^#accommodations=/.test(l)).length, 1);
      check('and offers no separate travel link',
        labels.filter(l => /^#travel-section=/.test(l)).length, 0);
    }
    // Hotel before travel inside the merged card.
    {
      const wr = fs.readFileSync('template-whimsicalromance.html', 'utf8');
      const join = (wr.match(/content\.innerHTML =[\s\S]*?;/) || [''])[0];
      const iHotel = join.indexOf('hotelBlock'), iTravel = join.indexOf('travelBlock');
      check('Whimsical puts the hotel before the travel copy',
        iHotel > -1 && iTravel > -1 && iHotel < iTravel, true);
      check('and it styles the travel half rather than dropping it raw',
        /^\.accom-travel\{/m.test(wr), true);
    }
  }
}

// ── Hotel before flights ──────────────────────────────────────────────────
// Where the couple books is what guests act on; the airport is reference. Both
// templates build the two columns from different blobs and then concatenate, so
// the order lives in that one join - and in the sample markup, which is what
// the couple sees before their payload arrives. Both are checked: a fix to the
// renderer alone leaves the preview flipping order as it hydrates.
{
  const { JSDOM } = (() => { try { return require('jsdom'); } catch (e) { return {}; } })();
  if (!JSDOM) { check('travel order (jsdom not installed - SKIPPED)', true, true); }
  else {
    for (const [t, hotelWord] of [['regalboho', 'Hotel'], ['vintagelovestory', 'Hotels']]) {
      const src = fs.readFileSync('template-' + t + '.html', 'utf8');
      const dom = new JSDOM(src);
      const titles = [].slice.call(dom.window.document.querySelectorAll('#travelGrid .travel-col-title'))
        .map(n => (n.textContent || '').trim());
      check(t + ' ships both travel columns', titles.length, 2);
      check(t + ' shows the hotel column first in the markup', titles[0], hotelWord);
      // ...and the renderer must agree. Read the join, not the whole function:
      // leftHtml is built from the airport blob on both templates.
      const join = (src.match(/grid\.innerHTML = (left|right)Html[^;]*;/) || [''])[0];
      check(t + ' renders the hotel column first too',
        /grid\.innerHTML = rightHtml/.test(join), true);
    }
  }
}

// ── Regal Boho's story reads as one centred block ─────────────────────────
{
  const rb = fs.readFileSync('template-regalboho.html', 'utf8');
  const sec = (rb.match(/^\.our-story\{[\s\S]*?\n\}/m) || [''])[0];
  const body = (rb.match(/^\.our-story-body\{[\s\S]*?\n\}/m) || [''])[0];
  check('the section is centred', /text-align:center/.test(sec), true);
  check('and the story inside it is not ranged left',
    /text-align:\s*left/.test(body), false);
  check('the story box is still the narrow measure the design uses',
    /max-width:520px/.test(body), true);
}

// ── The menu names the section, on every template ─────────────────────────
// One section, one name: the nav link, the heading on the page and the Content
// tab box. They disagreed on all ten - "Event Schedule" over "Our Wedding
// Weekend", "Events" over "The Main Event". _alignHeadingsToMenu is RUN here
// against each real template and the resulting page is read back, rather than
// checking the function exists.
{
  const { JSDOM } = (() => { try { return require('jsdom'); } catch (e) { return {}; } })();
  if (!JSDOM) { check('menu/heading alignment (jsdom not installed - SKIPPED)', true, true); }
  else {
    const ANCHORS = {
      story: ['our-story', 'story'],
      wedding: ['events-primary', 'wedding', 'event-schedule', 'event-details', 'weekend', 'itinerary'],
      other_events: ['other-events', 'events'],
      accommodations: ['accommodations'],
      travel: ['travel-section', 'travel', 'travel-standalone'],
      faqs: ['need-to-know', 'ntk', 'faq-section'],
      things_to_do: ['things-to-do'], gallery: ['gallery'],
      registry: ['registry-section', 'registry', 'registry-wrap'], rsvp: ['rsvp'],
    };
    const NAVSEL = (rt.match(/var NAV_LINK_SOURCES = \[([\s\S]*?)\]\.join/)[1]
      .match(/'[^']+'/g) || []).map(x => x.slice(1, -1)).join(',');
    const src = lift(rt, ['_headingNode', '_menuLabelFor', '_alignHeadingsToMenu']) +
      '\nreturn { align: _alignHeadingsToMenu, head: _headingNode, label: _menuLabelFor };';
    const tpls = fs.readdirSync('.').filter(f => /^template-.*\.html$/.test(f)).sort();
    let aligned = 0;
    const disagree = [], damaged = [];
    for (const t of tpls) {
      const dom = new JSDOM(fs.readFileSync(t, 'utf8'));
      const doc = dom.window.document;
      const fn = new Function('document', 'SECTION_ANCHORS', 'NAV_LINK_SOURCES', src)(
        doc, ANCHORS, NAVSEL);
      // Count the artwork before, so a write that eats an <svg> is visible.
      const svgBefore = doc.querySelectorAll('svg').length;
      fn.align();
      if (doc.querySelectorAll('svg').length !== svgBefore) damaged.push(t);
      for (const key of Object.keys(ANCHORS)) {
        const label = fn.label(ANCHORS[key]);
        if (!label) continue;
        let sec = null;
        for (const id of ANCHORS[key]) { const e = doc.getElementById(id); if (e) { sec = e; break; } }
        if (!sec) continue;
        const node = fn.head(sec);
        if (!node) continue;
        // A node with children was deliberately left alone; everything else
        // must now read exactly what the menu reads.
        if (node.children.length) continue;
        aligned++;
        const head = (node.textContent || '').replace(/\s+/g, ' ').trim();
        if (head !== label) disagree.push(t + ':' + key + ' "' + head + '" != "' + label + '"');
      }
    }
    check('the alignment reached a real number of sections', aligned >= 20, true);
    /* No shipped template has a nav label long enough to exercise the ceiling,
       so it gets its own document. Without it a link holding a sentence - a
       template that hangs a description off its nav, or a rename gone wrong -
       becomes the section's heading. */
    {
      const long = 'A'.repeat(60);
      const d2 = new JSDOM('<!doctype html><body><nav class="nav-links">' +
        '<a href="#faq-section">' + long + '</a></nav>' +
        '<section id="faq-section"><h2 class="ntk-title">Need to Knows</h2></section></body>');
      const f2 = new Function('document', 'SECTION_ANCHORS', 'NAV_LINK_SOURCES', src)(
        d2.window.document, ANCHORS, NAVSEL);
      check('a nav label that is really a sentence is ignored', f2.label(['faq-section']), null);
      f2.align();
      check('and the heading keeps the design\'s wording',
        (d2.window.document.querySelector('.ntk-title').textContent || '').trim(),
        'Need to Knows');
    }
    check('no heading disagrees with its menu link', disagree.join(' | '), '');
    check('and no template lost artwork to a heading write', damaged.join(','), '');
  }
}

// ── The couple's names are not a section heading ──────────────────────────
// Regal Boho's Our Story opens with <h1 class="our-story-names">, so the
// Content tab labelled that section with the sample couple's names - and the
// alignment above would have written a nav label straight over them.
{
  const { JSDOM } = (() => { try { return require('jsdom'); } catch (e) { return {}; } })();
  if (!JSDOM) { check('names are not headings (jsdom not installed - SKIPPED)', true, true); }
  else {
    const dom = new JSDOM(fs.readFileSync('template-regalboho.html', 'utf8'));
    const doc = dom.window.document;
    const head = new Function('document', lift(rt, ['_headingNode']) + '\nreturn _headingNode;')(doc);
    const sec = doc.getElementById('our-story');
    check('Regal Boho still opens Our Story with the names', !!sec, true);
    const namesEl = sec && sec.querySelector('.our-story-names');
    check('and that element is still there', !!namesEl, true);
    const node = head(sec);
    check('but it is not offered as the section heading', node === namesEl, false);
    // A real heading elsewhere still resolves, so the exclusion is not a blanket off-switch.
    const faq = doc.getElementById('need-to-know');
    check('a genuine heading still resolves',
      !!(faq && head(faq) && (head(faq).textContent || '').trim()), true);
  }
}

// ── A long name can actually be shrunk ────────────────────────────────────
// fitOneName measures #heroCoupleNames and writes a font-size onto THAT
// element. Whimsical Romance sized its two name lines with their own clamp in
// rem and vw, so the write landed on a parent nothing inherited from and a long
// name was clipped at full size. Every rule that sizes a descendant of the
// fitted element has to be relative, or the fitter is decorative.
{
  const wr = fs.readFileSync('template-whimsicalromance.html', 'utf8');
  // The element the runtime writes to must carry an absolute size to scale from.
  const host = (wr.match(/^\.hero-couple-name\{[^}]*\}/gm) || []).join('');
  check('the fitted element carries the size', /font-size:\s*clamp\(/.test(host), true);
  // ...and everything under it must be relative to that.
  const kids = (wr.match(/\.hero-couple-name\s+\.[\w-]+(\s*,\s*\n?\s*\.hero-couple-name\s+\.[\w-]+)*\{[^}]*\}/g) || []);
  check('there are descendant rules to check', kids.length > 0, true);
  const absolute = kids
    .map(r => [r, (r.match(/font-size:\s*([^;}]+)/) || [])[1]])
    .filter(([, v]) => v && /\d\s*(rem|px|vw|vh|pt)\b/.test(v))
    .map(([r]) => (r.match(/\.hero-couple-name\s+\.([\w-]+)/) || [])[1]);
  check('no name line sizes itself in absolute units', absolute.join(','), '');
  // The fitter reaches this element by id, so the id has to still be on it.
  check('the fitter can still find it', /id="heroCoupleNames"/.test(wr), true);
  check('and it is in the fitter\'s id list', /'heroCoupleNames'/.test(rt), true);
}

// ── Sage & Still's hero panel stays inside its hero ───────────────────────
// The panel is absolutely positioned as a percentage of a hero box with
// overflow:hidden, so growing height without moving top pushes the bottom edge
// out of the box and the photograph is silently cropped. Arithmetic, gated.
{
  const sg = fs.readFileSync('template-sageandstill.html', 'utf8');
  const rules = sg.match(/\.hero-photo-wrap\{[^}]*\}/g) || [];
  check('the hero panel is styled somewhere', rules.length > 0, true);
  const bad = [];
  for (const r of rules) {
    const top = parseFloat((r.match(/top:\s*([\d.]+)%/) || [])[1]);
    const h = parseFloat((r.match(/height:\s*([\d.]+)%/) || [])[1]);
    if (!isFinite(top) || !isFinite(h)) continue;      // px/clamp rules are the stacked layout
    if (top + h > 100) bad.push(top + '+' + h);
  }
  check('no rule pushes the panel past the bottom of the hero', bad.join(','), '');
  // And it did actually grow - the request was at least 15%.
  const base = (sg.match(/^\.hero-photo-wrap\{[\s\S]*?\}/m) || [''])[0];
  const w = parseFloat((base.match(/width:\s*([\d.]+)%/) || [])[1]);
  check('the desktop panel is at least 15% wider than the 40% it was',
    isFinite(w) && w >= 46, true);
}

// ── Black Tie's arch content sits below the spring point ──────────────────
// Everything in the card is anchored to the top padding, so that one number is
// the distance from the top of the arch. The rule across the arch is a
// PERCENTAGE of card height and is deliberately not moved with it - but the
// title must not be driven down through it.
{
  const bt = fs.readFileSync('template-blacktietimeless.html', 'utf8');
  const card = (bt.match(/^\.arch-card\{[\s\S]*?\n\}/m) || [''])[0];
  const pad = parseFloat((card.match(/padding:\s*([\d.]+)rem/) || [])[1]);
  check('the arch card anchors its content from the top',
    /justify-content:flex-start/.test(card), true);
  /* The TITLE and the rule across the arch both hold their positions - only
     the copy beneath them moves. This padding is where the title sits, so it
     is back to the design's own 6.4rem; raising it moved the title too, and at
     the card's min-height it was heading into the rule. */
  check('the title sits where the design put it',
    Math.abs(pad - 6.4) < 0.01, true);
  const minH = parseFloat((card.match(/min-height:clamp\((\d+)px/) || [])[1]);
  const before = (bt.match(/\.arch-card::before\{[^}]*\}/) || [''])[0];
  const rulePct = parseFloat((before.match(/top:\s*([\d.]+)%/) || [])[1]);
  // 16px root. The title starts at the padding and the rule at a percentage of
  // the shortest card; if the first crosses the second the two collide.
  check('the title still starts above the rule across the arch',
    pad * 16 < minH * (rulePct / 100), true);
  const name = (bt.match(/^\.arch-card-name\{[\s\S]*?\n\}/m) || [''])[0];
  const nm = parseFloat((name.match(/margin:\s*([\d.]+)rem/) || [])[1]);
  // The whole drop lives here now rather than being split with the top padding.
  check('the copy below the title has dropped',
    nm > 2.6, true);
  /* .arch-card-note is flex:1, so the extra space comes out of the note rather
     than growing the card past the arch artwork behind it. */
  const note = (bt.match(/^\.arch-card-note\{[\s\S]*?\n\}/m) || [''])[0];
  check('and the card absorbs it instead of growing', /flex:1/.test(note), true);
  /* A phone arch is shorter, so the drop is scaled rather than inherited -
     4.6rem under the phone's smaller top padding pushes the button off it. */
  const phone = (bt.match(/\.arch-card-name\{[^}]*margin-top:([\d.]+)rem[^}]*\}/) || [])[1];
  check('the phone arch scales the drop rather than inheriting it',
    !!phone && parseFloat(phone) < nm, true);
}

// ── A section is called the same thing in the menu and on the page ────────
// Coastal Chic's menu has always shown one "Event Schedule" link, because the
// section renders weddings_info AND events_info into one grid - but the heading
// above that grid read "Our Wedding Weekend", so the couple saw three different
// names for one section across the menu, the page and the Content tab. Read
// through the same _headingNode the editor uses, against the same menu-link
// selectors the runtime uses, so a heading that drifts from its link fails.
{
  const { JSDOM } = (() => { try { return require('jsdom'); } catch (e) { return {}; } })();
  if (!JSDOM) { check('heading/menu agreement (jsdom not installed - SKIPPED)', true, true); }
  else {
    const NAV = (rt.match(/var NAV_LINK_SOURCES = \[([\s\S]*?)\]\.join/)[1]
      .match(/'[^']+'/g) || []).map(x => x.slice(1, -1)).join(',');
    check('the nav selectors were read off the runtime, not copied', NAV.length > 0, true);
    const pairs = [
      // template, section anchor id, the heading that must match its own link
      ['coastalchic',      'event-schedule'],
      ['coastalchic',      'travel-section'],
      ['regalboho',        'event-details'],
      ['regalboho',        'travel-section'],
      ['vintagelovestory', 'travel-section'],
    ];
    for (const [t, id] of pairs) {
      const dom = new JSDOM(fs.readFileSync('template-' + t + '.html', 'utf8'));
      const doc = dom.window.document;
      const fn = new Function('document', lift(rt, ['_headingNode']) + '\nreturn _headingNode;')(doc);
      const sec = doc.getElementById(id);
      check(t + ' #' + id + ' exists', !!sec, true);
      if (!sec) continue;
      const node = fn(sec);
      const head = node ? (node.textContent || '').replace(/\s+/g, ' ').trim() : null;
      let label = null;
      doc.querySelectorAll(NAV).forEach(a => {
        if ((a.getAttribute('href') || '').replace('#', '') !== id) return;
        const txt = (a.textContent || '').replace(/\s+/g, ' ').trim();
        if (txt && !label) label = txt;
      });
      check(t + ' #' + id + ' has a menu link', !!label, true);
      check(t + ' #' + id + ' heading matches its menu link', head, label);
    }
  }
}

// ── The preview band lands BESIDE the registry, never inside it ───────────
// SECTION_ANCHORS.registry tries 'registry-section' first, and on four designs
// that id is on an <a> nested inside the band it sits in. The band was inserted
// as that LINK's sibling, so the four cards rendered inside the registry
// section - the exact layout the band was built to avoid. Run for real on all
// ten: the assertion is where the band ENDS UP, not that a resolver exists.
{
  const { JSDOM } = (() => { try { return require('jsdom'); } catch (e) { return {}; } })();
  if (!JSDOM) { check('registry band placement (jsdom not installed - SKIPPED)', true, true); }
  else {
    const ANCHORS = { registry: ['registry-section', 'registry', 'registry-wrap'] };
    /* ensureRegistryGrid and _liftRegistryGrid are RUN, not inspected. A gate
       that only exercised _regSection passed while a call site went straight
       back to getElementById - the resolver was correct and unreached, which is
       the same shape as the ensureRegistryGrid early-return trap. */
    const body = lift(rt, ['_regSection', '_paintUnder', '_syncRegistryBand',
                           '_liftRegistryGrid', 'ensureRegistryGrid']) +
      '\nreturn { _regSection: _regSection, ensureRegistryGrid: ensureRegistryGrid };';
    const tpls = fs.readdirSync('.').filter(f => /^template-.*\.html$/.test(f)).sort();
    check('all ten templates are covered', tpls.length, 10);
    const inside = [], missing = [];
    for (const t of tpls) {
      const dom = new JSDOM(fs.readFileSync(t, 'utf8'));
      const doc = dom.window.document;
      const fn = new Function('document', 'SECTION_ANCHORS', 'getComputedStyle', body)(
        doc, ANCHORS, dom.window.getComputedStyle.bind(dom.window));
      // The element the OLD code used - the raw first-match anchor.
      let raw = null;
      for (const id of ANCHORS.registry) { const e = doc.getElementById(id); if (e) { raw = e; break; } }
      if (!raw) { missing.push(t); continue; }
      const sec = fn._regSection();
      if (!sec) { missing.push(t); continue; }
      // The real path: this is what builds the band on nine templates and lifts
      // the shipped grid into it on the tenth.
      fn.ensureRegistryGrid(4);
      const band = doc.getElementById('mp-reg-band');
      if (!band) { missing.push(t); continue; }
      /* NOT raw.contains(band): the band is inserted as the link's SIBLING, so
         that is false even in the broken case, and the first version of this
         gate passed against the very bug it was written for. What matters is
         what WRAPS the band - if any ancestor is registry markup, the preview
         has been put inside the design's own artwork. */
      let enclosing = null;
      for (let a = band.parentElement; a && a !== doc.body; a = a.parentElement) {
        if (/registry/i.test(a.id + ' ' + (a.className || ''))) { enclosing = a; break; }
      }
      if (enclosing) inside.push(t);
    }
    check('every registry section resolves', missing.join(','), '');
    check('the band is never inside the registry markup', inside.join(','), '');
  }
}

// ── The lift obeys the resolver too ───────────────────────────────────────
// Only Modern Minimal ships its own grid, and its registry anchor is already
// the section - so the ten-template gate above cannot tell whether
// _liftRegistryGrid resolves properly. A document shaped like Vintage Love
// Story's, with a shipped grid, is the case that would go unnoticed.
{
  const { JSDOM } = (() => { try { return require('jsdom'); } catch (e) { return {}; } })();
  if (!JSDOM) { check('lift resolution (jsdom not installed - SKIPPED)', true, true); }
  else {
    const dom = new JSDOM('<!doctype html><body>' +
      '<section class="registry-wrap" id="registry-wrap">' +
        '<a class="registry-section" id="registry-section" href="#">' +
          '<span class="registry-cta">View our registry</span>' +
          '<div id="registryGrid"></div>' +
        '</a>' +
      '</section><footer id="f"></footer></body>');
    const d = dom.window.document;
    const fn = new Function('document', 'getComputedStyle', 'SECTION_ANCHORS',
      lift(rt, ['_regSection', '_paintUnder', '_liftRegistryGrid', '_syncRegistryBand']) +
      '\nreturn _liftRegistryGrid;')(
      d, dom.window.getComputedStyle.bind(dom.window),
      { registry: ['registry-section', 'registry', 'registry-wrap'] });
    fn(d.getElementById('registryGrid'));
    const band = d.getElementById('mp-reg-band');
    check('the shipped grid still ends up in a band', !!band && !!band.querySelector('#registryGrid'), true);
    check('and the band is outside the registry wrapper',
      !!band && band.parentElement === d.body, true);
    check('the wrapper keeps its own contents',
      !!d.querySelector('#registry-wrap .registry-cta'), true);
  }
}

// ── The band wears a colour, on every template ────────────────────────────
// Copying getComputedStyle(sec).backgroundColor gave transparent wherever the
// design paints with an image or from a wrapper - gifts on bare page. The gate
// runs the resolver over a document whose registry is painted one level up and
// checks the value COMES BACK, rather than checking the walk is written.
{
  const { JSDOM } = (() => { try { return require('jsdom'); } catch (e) { return {}; } })();
  if (!JSDOM) { check('band paint (jsdom not installed - SKIPPED)', true, true); }
  else {
    const dom = new JSDOM('<!doctype html><html><body style="background-color:rgb(1,2,3)">' +
      '<div id="wrap" style="background-color:rgb(9,8,7)">' +
      '<a id="inner" style="background-image:url(x.png)">t</a></div></body></html>');
    const fn = new Function('getComputedStyle', lift(rt, ['_paintUnder']) + '\nreturn _paintUnder;')(
      dom.window.getComputedStyle.bind(dom.window));
    check('a painted wrapper is found from an unpainted child',
      fn(dom.window.document.getElementById('inner')), 'rgb(9, 8, 7)');
    check('and the element\'s own colour still wins',
      fn(dom.window.document.getElementById('wrap')), 'rgb(9, 8, 7)');
  }
}

// ── Black Tie's rule ends up under the gifts, not through them ────────────
// .registry-section carries border-bottom:2px solid var(--black) so Registry
// and RSVP - which share a background - are separated. The band goes after the
// section, so that rule fell between the copy and its own gifts: the black
// line. Moved, not duplicated, and the move has to survive re-running.
{
  const bt = fs.readFileSync('template-blacktietimeless.html', 'utf8');
  const rule = (bt.match(/^\.registry-section\{[^}]*\}/m) || [''])[0];
  check('Black Tie still draws a rule under its registry',
    /border-bottom:\s*2px solid/.test(rule), true);
  const sync = rt.slice(rt.indexOf('function _syncRegistryBand'),
                        rt.indexOf('function hydrateRegistryPreview'));
  // Read ONCE and cached on the element: reading live would return 0 on the
  // second run, because the first run zeroed it.
  check('the original is cached before it is cleared',
    /if \(!sec\.hasAttribute\('data-mp-reg-bb'\)\)/.test(sync), true);
  check('the band takes it and the section gives it up',
    /band\.style\.borderBottom = _bb;\s*sec\.style\.borderBottom = '0';/.test(sync), true);
  // A hidden band must hand it back, or a registry with the preview switched
  // off loses the separator the design was drawn with.
  check('and a hidden band returns it',
    /band\.style\.borderBottom = '';\s*sec\.style\.borderBottom = '';/.test(sync), true);
}

// ── The Purchase button has something to copy on every template ───────────
// Vintage Love Story draws no Book Now at all - its travel cards are a name and
// an address - so styleRegistryCtas returned before writing anything and the
// button kept var(--ink3), which on that design is the registry background's
// own hex. The gate asserts a source EXISTS in each template's markup, which is
// the condition that actually failed, not that a fallback line is present.
{
  const SRC = ['arch-card-btn', 'accom-card-cta', 'accom-btn', 'accom-cta',
               'travel-cta', 'travel-btn', 'split-btn'];
  const tpls = fs.readdirSync('.').filter(f => /^template-.*\.html$/.test(f)).sort();
  const none = [];
  for (const t of tpls) {
    const src = fs.readFileSync(t, 'utf8');
    const has = SRC.some(c => new RegExp('class="[^"]*\\b' + c + '\\b').test(src)) ||
                /class="[^"]*\bregistry-cta\b/.test(src);
    if (!has) none.push(t);
  }
  check('every template has a button the Purchase CTA can copy', none.join(','), '');
  const fn = rt.slice(rt.indexOf('function styleRegistryCtas'),
                      rt.indexOf('function renderPreviewCard'));
  // A SECOND query, not another selector in the list: querySelector returns the
  // first match in DOCUMENT order, so listing it would let a template whose
  // registry precedes its travel cards take the wrong button.
  check('the registry CTA is a fallback, not a peer',
    /REG_CTA_SOURCES = \[[^\]]*registry-cta/.test(rt), false);
  check('and it is only reached when there is no Book Now',
    /if \(!src\) src = document\.querySelector\('\.registry-cta'\);/.test(fn), true);
}

// ── Both arches read the same ─────────────────────────────────────────────
// The rule across the arch is positioned as a PERCENTAGE, so it only lands in
// the same place on both cards if both cards are the same height. Grid stretches
// cards that share a row but gives each row its own height, so once they stacked
// on a phone the shorter one shrank and Flights stopped matching Hotel.
{
  const bt = fs.readFileSync('template-blacktietimeless.html', 'utf8');
  /* The BASE rule carries it; the breakpoint rules only override columns and
     width, so they inherit it. What must not happen is one of them setting it
     back to auto. */
  const base = (bt.match(/^\.travel-cards\{[^}]*\}/m) || [''])[0];
  check('the arch row equalises by default', /grid-auto-rows:1fr/.test(base), true);
  check('and no breakpoint undoes it',
    (bt.match(/\.travel-cards\{[^}]*grid-auto-rows:(?!1fr)/g) || []).length, 0);
  // Stacked as well as side by side - the phone case is the one that broke.
  check('including the stacked phone layout',
    /\.travel-cards\{grid-template-columns:1fr;[^}]*grid-auto-rows:1fr/.test(bt), true);
}

// ── No flash of the sample photograph ─────────────────────────────────────
// The sample is in the markup, so the browser paints it the moment the page
// loads - a beat before any payload says whether the couple has a photograph of
// their own. That beat is the flash: a stranger's picture on the couple's hero,
// then theirs. Held back until hydrate has decided.
{
  const { JSDOM } = require('jsdom');
  const hold = rt.slice(rt.indexOf('function holdContentImages'),
                        rt.indexOf('function purgeSampleImages'));

  check('the hold is preview-only', /if \(!_isPreview\) return;/.test(hold), true);
  // visibility, not display: the slot keeps its size so nothing reflows.
  check('and hides without collapsing the slot',
    /\{visibility:hidden\}/.test(hold) && !/display:none/.test(hold), true);
  // If hydrate never runs, the images must still appear.
  check('there is a timeout that releases regardless',
    /setTimeout\(releaseContentImages, \d+\)/.test(hold), true);

  const purge = rt.slice(rt.indexOf('function purgeSampleImages'),
                         rt.indexOf('function _liftRegistryGrid'));
  // With no photograph of their own the sample IS the right thing to show, so
  // the early return must release rather than leave it hidden forever.
  check('the no-photo path releases too',
    /if \(!own\.length \|\| !sels\.length\) \{ releaseContentImages\(\); return; \}/.test(purge), true);
  check('and so does a throw inside it',
    /catch \(e\) \{ releaseContentImages\(\); \}/.test(purge), true);
  check('the swap releases on success', /releaseContentImages\(\);\n\s*\} catch/.test(purge), true);

  /* Called after the map it reads, not at the top of the file: CONTENT_IMAGES
     is a var, so earlier it is hoisted but undefined and the hold would
     silently do nothing. */
  const at = rt.indexOf('\n  holdContentImages();');
  check('the hold runs after its map is assigned',
    at > rt.indexOf('var CONTENT_IMAGES = {'), true);

  // Behavioural: hold writes a rule covering the declared slots, release clears.
  const dom = new JSDOM('<!doctype html><head></head><body><img id="heroImg"></body>');
  const d = dom.window.document;
  const fns = new Function('document', '_isPreview', 'TID', 'CONTENT_IMAGES', 'setTimeout',
    lift(rt, ['holdContentImages', 'releaseContentImages']) +
    'return { hold: holdContentImages, release: releaseContentImages };')(
    d, true, 'pressedpetals', { pressedpetals: ['#heroImg'] }, function () {});
  fns.hold();
  check('the hold writes a rule for the declared slots',
    (d.getElementById('mp-ci-hold') || {}).textContent, '#heroImg{visibility:hidden}');
  fns.hold();
  check('holding twice does not stack rules',
    d.querySelectorAll('#mp-ci-hold').length, 1);
  fns.release();
  check('releasing removes it', !!d.getElementById('mp-ci-hold'), false);
  fns.release();
  check('and releasing twice is safe', !!d.getElementById('mp-ci-hold'), false);
}

// ── The copied CTA rule can actually win ──────────────────────────────────
// Five passes went into the colours and none of them showed, because the
// problem was never the values or the load order - it was specificity. A rule
// with lower specificity loses however late it is appended. Compared here as
// NUMBERS, so neither selector can drift out from under the other again.
{
  const spec = (sel) => {
    const ids = (sel.match(/#[\w-]+/g) || []).length;
    const cls = (sel.match(/\.[\w-]+/g) || []).length +
                (sel.match(/\[[^\]]+\]/g) || []).length;
    return ids * 100 + cls * 10;
  };
  // The fallback, read out of injectPreviewStyles.
  const fb = (rt.match(/'(#registryGrid\[data-mp-built\] \.registry-buy-btn)\{display:inline-block/) || [0, ''])[1];
  check('the fallback selector is readable', !!fb, true);
  // The copied sheet's selector list.
  const btn = (rt.match(/var BTN = '([^']+)' \+\s*\n\s*'([^']+)'/) || [0, '', '']);
  const parts = (btn[1] + btn[2]).split(',').map(x => x.trim()).filter(Boolean);
  check('the copied rule lists both grid shapes', parts.length, 2);
  check('and at least one part is as specific as the fallback',
    Math.max.apply(null, parts.map(spec)) >= spec(fb), true);
  // The narrower selector must still be there, or a shipped grid loses its copy.
  check('the shipped-grid selector survives',
    parts.some(p => !/data-mp-built/.test(p)), true);
}

// The label centres INSIDE the button, not just the button inside the card:
// a two-line label sat left in a button whose width came from the card.
{
  const fn2 = rt.slice(rt.indexOf('function styleRegistryCtas'),
                       rt.indexOf('function renderPreviewCard'));
  check('the CTA label is centred in the button',
    /display:flex;align-items:center;justify-content:center;/.test(fn2), true);
  check('and is no longer an inline-block that only centres its text',
    /'display:inline-block;text-align:center;max-width:100%\}'/.test(fn2), false);
}


// ── Typography map rounds (template-map/FINDINGS.md) ───────────────────────
// Behaviour checks for the fixes made from the template map. Lifted from the
// shipping source like everything above, so they cannot pass against code that
// isn't shipping. One line per finding; the ticket is in the name.
{
  const rt = fs.readFileSync('site-runtime.js', 'utf8');
  const ws = fs.readFileSync('Website.txt', 'utf8');
  const T10 = ['blacktietimeless','coastalchic','goldenhour','heirloombloom','modernminimal',
               'pressedpetals','regalboho','sageandstill','vintagelovestory','whimsicalromance'];
  const src = n => fs.readFileSync('template-' + n + '.html', 'utf8');

  /* MP-354. The menu has its own face on every design, and Menu Links writes it. */
  check('MP-354 every template declares --menu-font',
    T10.filter(n => !/--menu-font:\s*var\(--[a-z-]+\);/.test(src(n))), []);
  check('MP-354 Menu Links writes --menu-font, not the body variable',
    /menu: '--menu-font',/.test(rt) && !/menu: CFG\.bodyVar/.test(rt), true);
  check('MP-354 the phone drawer reads it', /'font-family:var\(--menu-font\);'/.test(rt), true);

  /* Section Headings and Body Text reach the faces a design sets apart, and a
     reset clears every variable the runtime can write. */
  check('headings write --heading-font, body copy --body-font',
    /root\.setProperty\('--heading-font'/.test(rt) && /root\.setProperty\('--body-font'/.test(rt), true);
  const clr = lift(rt, ['_clearRoleFonts']);
  check('a font reset clears all of them',
    ['--menu-font', '--heading-font', '--body-font'].every(v => clr.includes("'" + v + "'")), true);

  /* MP-954 / MP-951. Nothing on the page the couple did not write. */
  check('MP-954 no template keeps its sample when the couple has fewer',
    T10.filter(n => /_placeholderCols|_phItems/.test(src(n))), []);
  check('MP-951 no template invents a room-block line',
    T10.filter(n => /'Request the ' \+/.test(src(n))), []);

  /* MP-916. A spacer never swallows the line break beside it. */
  const gb = new Function(lift(rt, ['_gapBreaks']) + 'return _gapBreaks;')();
  const GAP = '<span class="mp-gap" contenteditable="false" style="display:block;height:12px"></span>';
  check('MP-916 a break goes back in front of a spacer after text',
    gb('Title' + GAP + '4pm'), 'Title<br>' + GAP + '4pm');
  check('MP-916 and is not doubled where one is already there',
    gb('Title<br>' + GAP + '4pm'), 'Title<br>' + GAP + '4pm');
  check('MP-916 the runtime repairs saved records before reading them',
    /GAP_FIELDS\.forEach\(function \(f\) \{ if \(typeof d\[f\] === 'string'\) d\[f\] = _gapBreaks\(d\[f\]\); \}\);/.test(rt), true);

  /* MP-337. Only a whole italic LAST line is the dress code. */
  const ma = new Function(rt.match(/var _VOID = \/\^\([^)]*\)\$\/i;/)[0] + '\n' +
    "var _text = function (h) { return String(h||'').replace(/<[^>]*>/g,'').replace(/&nbsp;/gi,' ').trim(); };\n" +
    lift(rt, ['_wrapsWhole', '_markAttire']) + 'return _markAttire;')();
  check('MP-337 a whole italic last line is tagged',
    /class="mp-attire"/.test(ma('Ceremony<br>4pm<br><em>Black tie</em>')), true);
  check('MP-337 one italic word at the end is not',
    /mp-attire/.test(ma('Ceremony<br>Join us <em>outside</em>')), false);
  check('MP-337 nor a box in italics throughout',
    /mp-attire/.test(ma('<em>Ceremony</em><br><em>4pm</em>')), false);

  /* MP-905. With no note: the deadline in the design's words, else nothing live
     and a hint in the editor. */
  const re = new Function('var _designRsvpLine = "Please reply by June 10";\n' +
    "var fmtDate = function () { return 'May 1, 2027'; };\n" +
    lift(rt, ['_rsvpEmptyLineHtml']) + "\nvar RSVP_DATE_HINT = '[your RSVP date]';\nreturn _rsvpEmptyLineHtml;")();
  check('MP-905 a deadline keeps the design wording',
    re({ rsvp_config: { deadline: '2027-05-01' } }, false), 'Please reply by May 1, 2027');
  check('MP-905 no deadline, live: no line at all', re({}, false), '');
  check('MP-905 no deadline, editor: a hint where the date goes',
    /Please reply by \[your RSVP date\]/.test(re({}, true)), true);

  /* MP-941 / MP-946. One registry button, and the same one in the preview. */
  check('MP-941 the extra registry button defers to the design\'s own',
    /var _ownCta = false;/.test(rt) && /&& !_ownCta;/.test(rt), true);
  check('MP-941 gift tiles are centred whatever the count',
    /#registryGrid\{display:flex!important;flex-wrap:wrap;' \+[\s\S]{0,400}'justify-content:center;/.test(rt), true);

  /* MP-337, site to box. Each Content box is told the design's own styles. */
  check('the runtime reports each box\'s styles to the editor', /boxStyles: \(function \(\)/.test(rt), true);
  check('and the editor reads them', /let _liveBoxStyles = null;/.test(ws) && /boxStyle=\{_liveBoxStyles/.test(ws), true);

  /* MP-918. The divider the site will put between cards is shown in the box. */
  check('MP-918 the box draws a divider above each card after the first',
    /mp-t\[data-follows\]::before/.test(ws), true);
}


// ── Counter and layout round (template-map/FINDINGS.md) ───────────────────
{
  const ws = fs.readFileSync('Website.txt', 'utf8').replace(/\r\n/g, '\n');
  /* MP-943 / MP-949. Changes as the couple makes them. The counter is lifted
     from the block and run against the cases the tickets describe. */
  const i = ws.indexOf('  const _CSS_MIRRORS'), j = ws.indexOf('    : 0;\n', i) + '    : 0;\n'.length;
  const count = new Function('localChanges', 'savedCss',
    'const celebration = { fields: { customCss: savedCss } };\n' +
    'const _bundledKeys = { current: new Set() };\n' +
    'const hasChanges = Object.keys(localChanges).length > 0;\n' + ws.slice(i, j) + 'return changeCount;');
  check('MP-949 six colours read as six changes',
    count({ primaryColor: '#111111', accentColor: '#222222',
            customCss: '--text:#333333; --text2:#444444; --text3:#555555; --accent2:#666666;' }, ''), 6);
  check('MP-943 one registry preview click is one change',
    count({ showRegistryPreview: false, customCss: '--registry-preview:0;' }, ''), 1);
  check('a colour set over an old --bg is one change',
    count({ primaryColor: '#111111', customCss: '--text:#333333;' }, '--bg:#000000; --text:#333333;'), 1);

  /* MP-950. A short last row of events is centred. */
  check('MP-950 Whimsical Romance centres a partial row',
    /\.itinerary-grid\{display:flex;flex-wrap:wrap;justify-content:center;\}/.test(fs.readFileSync('template-whimsicalromance.html', 'utf8')), true);
  check('MP-950 Coastal Chic centres a partial row',
    /\.schedule-grid\{display:flex;flex-wrap:wrap;justify-content:center;\}/.test(fs.readFileSync('template-coastalchic.html', 'utf8')), true);

  /* MP-939. Heirloom Bloom's carousel loops through a copy of the first slide. */
  const hb = fs.readFileSync('template-heirloombloom.html', 'utf8');
  check('MP-939 the carousel loops instead of rewinding',
    /function _carouselClone\(c\)/.test(hb) && /idx === n && _carouselIdx === n - 1/.test(hb), true);

  /* MP-937. Toolbar menus stay on screen. */
  check('MP-937 every toolbar menu is kept on screen',
    (ws.match(/<div ref=\{_keepOnScreen\} (?:data-mp-menu="1" )?style=\{(?:\{ \.\.\.)?menuStyle/g) || []).length, 2);
  /* MP-960: both menus marked, so scrolling inside either keeps it open. */
  check('MP-960 both toolbar menus are marked as menus',
    (ws.match(/<div ref=\{_keepOnScreen\} data-mp-menu="1" style=/g) || []).length, 2);
}


// ── Formatting a whole title (MP-915 / MP-333, as tested by the couple) ───
{
  const ws = fs.readFileSync('Website.txt', 'utf8');
  /* B, I and U save after the command, rather than trusting the browser to
     raise an input event: it did not, inside the box's title marks, and the
     bold never reached the record. */
  check('MP-915 B, I and U save after the command',
    /_keepOffMarks\(\(\) => _doc\(\)\.execCommand\(cmd, false, null\)\);[\s\S]{0,700}onChange\(_clean\(h\.innerHTML\)\)/.test(ws), true);
  /* A command the browser applies to the box's own title mark is moved off it
     before the mark is stripped - fonts and, in CSS mode, B, I and U too. */
  check('MP-333 formatting that lands on a title mark is kept',
    /const _keepOffMarks = \(run\) =>/.test(ws) && (ws.match(/_keepOffMarks\(\(\) =>/g) || []).length === 2, true);   // B/I/U, and font/size
  /* Only <strong> is the old title marker; a whole-line <b> is the couple's. */
  check('MP-915 a whole bold title keeps its bold on the site',
    /<b>Reception<\/b>/.test(runtime.markStructure('<b>Reception</b><br>7pm')), true);
  check('and the old <strong> marker is still unwrapped',
    /<strong>/.test(runtime.markStructure('<strong>Reception</strong><br>7pm')), false);
  check('the box shows only <strong> at title weight',
    /mp-t\[data-whole-bold\] strong\{font-weight:inherit\}/.test(ws) &&
    !/mp-t\[data-whole-bold\] b\{/.test(ws), true);
  check('FAQ questions keep a whole-line <b>',
    ['blacktietimeless','coastalchic','goldenhour','heirloombloom','modernminimal','pressedpetals',
     'regalboho','sageandstill','vintagelovestory','whimsicalromance']
      .filter(n => !/if \(!\/<\(strong\|mp-title\)\\b\/i\.test\(s\)\) return s;/.test(fs.readFileSync('template-' + n + '.html', 'utf8'))), []);
}


// ── Reset to default sits in the same place for every section ─────────────
{
  const ws = fs.readFileSync('Website.txt', 'utf8');
  /* Two header rows render a Reset - the content sections' and the one Home and
     RSVP share - and both put it on the right of the section name. RSVP's used
     to sit under its box. */
  check('every Reset to default is in a section header row',
    (ws.match(/↺ Reset to default/g) || []).length, 2);
  check('and none is placed under a box',
    /marginTop: "4px" \}\}>\s*↺ Reset to default/.test(ws), false);
  check('RSVP\'s resets its line from the header row',
    /if \(s\.section === "rsvp"\) _resetRsvpNote\(\);/.test(ws), true);
}


// ── A pressed B / I / U looks pressed (MP-333, as tested) ────────────────
{
  const ws = fs.readFileSync('Website.txt', 'utf8');
  /* The selected state was a pale beige on the off-white bar: the state was
     right and nobody could see it. Filled and inverted now. */
  check('a selected toolbar button is filled, not tinted',
    /background: active \? "#4B5244" : "none"/.test(ws) && /color: active \? "#FFFFFF" : "#4B5244"/.test(ws), true);
}


// ── Underline through a title, and B/I/U at a caret (as tested on Heirloom Bloom) ─
{
  const ws = fs.readFileSync('Website.txt', 'utf8');
  /* Title marks are inline: as inline-block, a <u> round the title did not
     reach the words in the box (CSS does not carry decorations into an
     inline-block), the browser's U then ADDED an underline the couple meant to
     remove, and the toolbar showed U on. */
  check('title marks are inline, so formatting reaches through them',
    /' style="display:inline;line-height:1\.35;font-size:'/.test(ws) && !/style="display:inline-block;line-height:1\.35/.test(ws), true);
  check('B, I and U at a caret act on the word it is in',
    /if \(cmd === "bold" \|\| cmd === "italic" \|\| cmd === "underline"\) _wordAtCaret\(\);/.test(ws), true);
  check('empty formatting left by the browser is not saved',
    /\.replace\(\/<\(u\|b\|i\|em\|strong\|s\)>\\s\*<\\\/\\1>\/gi, ""\)/.test(ws), true);
  /* The runtime: a couple's <u> round a whole title is theirs, not the design's. */
  const rt = fs.readFileSync('site-runtime.js', 'utf8');
  check('only <strong>/<b> round a whole title counts as the design\'s',
    /\/\^\(STRONG\|B\)\$\/\.test\(el\.tagName\) && _norm\(el\.textContent\) === wholeText/.test(rt), true);
}


// ── The eraser works on the selected words (as tested) ───────────────────
{
  const ws = fs.readFileSync('Website.txt', 'utf8');
  /* It decided "nothing selected" through window.getSelection(), which cannot
     see into Softr's shadow root, so it always selected and cleared the whole
     section. It asks the shadow-aware selection now. */
  check('the eraser reads the selection where the box lives',
    /const picked = _liveRangeInBox\(\);/.test(ws) && /if \(!hasSel\) \{/.test(ws), true);
  /* Taking a font off unwraps its span and drops the selection; it is put back
     before removeFormat, or bold on the same words would survive. */
  check('and keeps the selection through it, for removeFormat',
    /if \(done\) \{ const sel = _win\(\)\.getSelection\(\); sel\.removeAllRanges\(\); sel\.addRange\(r\); \}/.test(ws), true);
}


// ── Formatting round a title mark shows in the box (Travel, as tested) ───
{
  const ws = fs.readFileSync('Website.txt', 'utf8');
  /* Select-all + B wraps the marks in one <b>; the mark's stated design weight
     beat the inherited bold, so titles stayed plain in the box while the
     preview was bold. The couple's formatting round a mark wins. */
  check('a bold round a title mark shows in the box',
    /\[contenteditable\] :is\(b,strong\) mp-t,/.test(ws) && /mp-t\{font-weight:700!important\}/.test(ws), true);
  check('and so do italic and a font round it',
    /mp-t\{font-style:italic!important\}/.test(ws) && /\[style\*='font-family'\] mp-t\{font-family:inherit!important\}/.test(ws), true);
}


// ── RSVP backend and the registry page (MP-924, MP-925, MP-932) ──────────
{
  const py = fs.readFileSync('main.py', 'utf8');
  const reg = fs.readFileSync('live_registry.html', 'utf8');
  /* MP-924. Every caller builds its answers with the entree under "entree";
     the writer read "entree_choice", so every entree was dropped at the last
     step. It reads both now. */
  const w = py.slice(py.indexOf('def _replace_event_answers'), py.indexOf('def _merge_event_answers'));
  check('MP-924 the RSVP writer keeps the entree its callers send',
    /a\.get\("entree"\) or a\.get\("entree_choice"\)/.test(w), true);
  check('and every caller sends it under that name',
    (py.match(/"entree":\s+str\(_(?:ev|he)\.get\("entree(?:_choice)?"\)/g) || []).length >= 3, true);
  /* MP-925. The date reads as a guest reads it, and the person who answered
     for their party gets everyone on one card. */
  check('MP-925 the confirmation date is Month Day, Year',
    /_received = f"\{_now\.strftime\('%B'\)\} \{_now\.day\}, \{_now\.year\}"/.test(py) &&
    !/strftime\("%d %B %Y"\)/.test(py), true);
  check('MP-925 the submitter\'s card lists the whole party',
    /_rsvp_card_html\(_celeb_label, _party if _i == 0 else \[_p\], _received\)/.test(py), true);
  check('and plus-ones are on it',
    /_party = \[p for p in card_people \+ _card_extras if p\.get\("events"\)\]/.test(py), true);
  /* MP-932. The registry page wears the couple's fonts, not only the template's. */
  check('MP-932 the registry page reads the couple\'s font choices',
    /fonts: data\.font_settings \|\| \{\}/.test(reg) &&
    /r\.setProperty\("--skin-display", headFont \?/.test(reg) && /r\.setProperty\("--skin-body", bodyFont \?/.test(reg), true);
}


// ── Un-bolding one title leaves the others alone (Travel, as tested) ─────
{
  const ws = fs.readFileSync('Website.txt', 'utf8');
  /* The mark's design weight is not inline style: the browser took an inline
     font-weight:400 on a title mark as "not bold", so after select-all + B,
     un-bolding Hotel re-bolded everything except the other titles. */
  check('a title mark states no weight or slant inline',
    !/';font-weight:' \+ weight \+ ';'/.test(ws) && /\[100, 200, 300, 400, 500, 600, 700, 800, 900\]\.map\(w => "\[contenteditable\] mp-t\[data-tw='" \+ w/.test(ws), true);
}


// ── One Travel switch, live as well as in the preview ────────────────────
{
  const rt = fs.readFileSync('site-runtime.js', 'utf8');
  const py = fs.readFileSync('main.py', 'utf8');
  /* The live site read Accommodations from its own record field, which has had
     no control since the merge and is false for many couples; the merged band
     is hidden if either key is off, so Travel vanished from live sites with
     Travel switched on. Travel decides, in the runtime and in the payload. */
  check('the runtime makes Accommodations follow Travel before templates read it',
    /d\.menu_config\.accommodations = d\.menu_config\.travel;/.test(rt), true);
  check('and the live payload sends one value for both',
    /"accommodations": bool\(_cf\(wedding, CF_SHOW_TRAVEL,\s+False\)\),/.test(py), true);
  /* MP-945. Coastal Chic uses the corrected stamp, not the one that painted a
     white rectangle into the gaps between its scallops. */
  const cc = fs.readFileSync('template-coastalchic.html', 'utf8');
  check('MP-945 Coastal Chic uses the corrected stamp',
    cc.includes('748b56c0-25fb-404b-add1-e130d8758f64.svg') && !cc.includes('9b5e87fe-b224-4bc4-9489-3488fd7e5964'), true);
}


// ── MP-931: the gifts sit close under the registry copy ──────────────────
{
  const rt = fs.readFileSync('site-runtime.js', 'utf8');
  check('MP-931 the seam is tightened only while the gift band shows',
    /sec\.classList\.toggle\('mp-reg-has-band', !hidden\)/.test(rt) &&
    /'\.mp-reg-has-band\{padding-bottom:16px!important\}'/.test(rt) &&
    /'#mp-reg-band\{padding-top:16px!important\}'/.test(rt), true);
}


// ── MP-933: nothing sticks out past the screen edge on a phone ───────────
{
  const rt = fs.readFileSync('site-runtime.js', 'utf8');
  check('MP-933 a closed menu drawer is clipped to the screen', /'\.menu-overlay\{overflow:hidden\}' \+/.test(rt), true);
  check('Pressed Petals clips the flower at Other Events\' edge',
    /#other-events\{overflow-x:clip\}/.test(fs.readFileSync('template-pressedpetals.html', 'utf8')), true);
  const mm = fs.readFileSync('template-modernminimal.html', 'utf8');
  check('Modern Minimal\'s RSVP pull matches the frame at each size',
    /@media\(max-width:768px\)\{\.rsvp-section\{margin:0 -8px -8px;\}\}/.test(mm) &&
    /@media\(max-width:400px\)\{\.rsvp-section\{margin:0 -6px -6px;\}\}/.test(mm), true);
}


// ── MP-914: dragging a photo shows where it will land ────────────────────
{
  const ws = fs.readFileSync('Website.txt', 'utf8');
  const set = ws.slice(ws.indexOf('function ImageSet('), ws.indexOf('function ImageSet(') + 9000);
  check('MP-914 the grid re-flows while a photo is dragged',
    /const order = \(\(\) => \{/.test(set) && /order\.map\(\(idx, pos\) => tile\(urls\[idx\], idx, pos\)\)/.test(set), true);
  check('tiles keep their identity while they move',
    /key=\{keys\[idx\]\}/.test(set) && !/key=\{url \+ "-" \+ idx\}/.test(set), true);
  check('the whole grid accepts the drop, gaps included',
    /onDrop=\{e => \{ if \(live\.current\) \{ e\.preventDefault\(\); commitDrag\(\); \} \}\}/.test(set), true);
  check('a drop on the dragged photo itself still commits',
    /if \(d && !d\.done && d\.inGrid\) commitDrag\(\);/.test(set), true);
  check('and Firefox is given the data it needs to start a drag',
    /e\.dataTransfer\.setData\("text\/plain", String\(idx\)\)/.test(set), true);
}


// ── The RSVP hint is for the Content box; a switched-on section is shown ──
{
  const rt = fs.readFileSync('site-runtime.js', 'utf8');
  /* The page shows only what the couple has - no "[your RSVP date]" in the
     preview. The report to the editor still carries the hint for the box. */
  check('the page never shows the RSVP date hint',
    /var _empty = _rsvpEmptyLineHtml\(d, false\);/.test(rt), true);
  check('the editor\'s placeholder still gets it',
    /_rsvpLine = _rsvpEmptyLineHtml\(d, _isPreview\)/.test(rt), true);
  /* Off then on again with the box still empty: the section has to come back,
     or its menu link points at nothing. It was shown only the first time. */
  check('an emptied, switched-on section is shown every time',
    /if \(sec\.style\.display === 'none'\) \{\s*\n\s*if \(!saved\.sec\) saved\.sec = \{ el: sec, prev: 'none' \};\s*\n\s*sec\.style\.display = '';/.test(rt), true);
}


// ── MP-921: a new question is marked at once, so its divider shows ───────
{
  const ws = fs.readFileSync('Website.txt', 'utf8');
  const fn = ws.slice(ws.indexOf('  const startNewBlock = '), ws.indexOf('  const insertGap = '));
  check('MP-921 a new block is marked straight away (divider above it)',
    /host\.innerHTML = _markTitles\(_gapBreaks\(_clean\(host\.innerHTML\)\)\);/.test(fn), true);
  check('and its title is selected, ready to type over', /r\.selectNodeContents\(last\);/.test(fn), true);
}


// ── Gift buttons line up; Heirloom Bloom's hero has arrows and autoplay ───
{
  const rt = fs.readFileSync('site-runtime.js', 'utf8');
  /* MP-941's centring turned the gift grid into a wrapping row; the cards kept
     the grid's height:100% and stopped stretching, so a card with no quantity
     line had its Purchase button higher than its neighbours'. */
  check('gift cards stretch to the tallest in the row',
    /align-items:stretch!important/.test(rt) && /#registryGrid > \.registry-card\{box-sizing:border-box;min-width:0;height:auto!important;/.test(rt), true);
  const hb = fs.readFileSync('template-heirloombloom.html', 'utf8');
  check('MP-939 the hero has previous and next arrows',
    /id="carouselPrev"[^>]*onclick="shiftCarousel\(-1, true\)"/.test(hb) && /id="carouselNext"[^>]*onclick="shiftCarousel\(1, true\)"/.test(hb), true);
  check('and moves itself every 3 seconds', /setInterval\(function\(\)\{ shiftCarousel\(1\); \}, 3000\)/.test(hb), true);
}


// ── Loading screen font, long words, RSVP event order (as tested) ────────
{
  const rt = fs.readFileSync('site-runtime.js', 'utf8');
  const ws = fs.readFileSync('Website.txt', 'utf8');
  const py = fs.readFileSync('main.py', 'utf8');
  /* The loading screen never falls back to 'cursive' (Comic Sans on Windows
     while the script face downloads), and holds its words until the face is in. */
  const sl = rt.slice(rt.indexOf('function showLoading()'), rt.indexOf('function showLoading()') + 4000);
  check('the loading screen has no cursive fallback',
    /replace\(\/,\\s\*cursive\\s\*\$\/i, ''\) \+ ', Georgia, serif'/.test(sl), true);
  check('and shows its words only once the face is ready',
    /visibility:hidden;animation:mpPulse/.test(sl) && /document\.fonts\.load\(/.test(sl) && /setTimeout\(_show, 1200\)/.test(sl), true);
  /* A word too long for its line breaks rather than running off the side. */
  check('MP-941 long words wrap', /'body\{overflow-wrap:break-word\}'/.test(rt) &&
    /#registryInfo,#registryText,#registryBody,\.story-col,#storyText,#heroDescription\{overflow-wrap:anywhere\}/.test(rt), true);
  /* MP-923. The RSVP settings follow the RSVP form's order. */
  check('MP-923 the backend gives a celebration\'s events in RSVP order',
    /@app\.get\("\/celebration\/\{celebration_id\}\/event-order"\)/.test(py) &&
    /out\.sort\(key=lambda e: \(0 if e\["sort_order"\] is not None else 1,/.test(py), true);
  check('and the editor lists them in that order',
    /\/celebration\/\$\{encodeURIComponent\(_celebRecordId\)\}\/event-order/.test(ws) &&
    /\.map\(\(e, i\) => \(\{ e, i, r: _eventRank\(e\)\.r \}\)\)/.test(ws) &&
    /* By record id, then by name: the editor's linked field and the plan the RSVP
       form reads can hold one event under different record ids. */
    /const byName = eventOrder\.findIndex\(o => _normEv\(o\.name\) && _normEv\(o\.name\) === _normEv\(e\.label\)\);/.test(ws), true);
  /* Hooks above the component's first return, never inside a callback. */
  const hookAt = ws.indexOf('const [eventOrder, setEventOrder] = useState(null);');
  check('the order is fetched where hooks are allowed',
    hookAt > ws.indexOf('  const currentData = celebration ?') &&
    hookAt < ws.slice(ws.indexOf('export default function Block(')).search(/\n  return \(\r?\n/) + ws.indexOf('export default function Block('), true);
}


// ── MP-942 hero frames; MP-953 Vintage Love Story's Book Now is visible ──
{
  const rt = fs.readFileSync('site-runtime.js', 'utf8');
  /* The first frame is the hero; the others cycle the OTHER photographs and
     only repeat the hero when it is the only one (A B B, not A B A). */
  check('MP-942 fixed hero frames repeat another photo before the hero',
    /var _rest = _own\.length > 1 \? _own\.slice\(1\) : _own;/.test(rt) &&
    /_filled\.push\(_rest\[\(_i - 1\) % _rest\.length\]\)/.test(rt), true);
  const vls = fs.readFileSync('template-vintagelovestory.html', 'utf8');
  /* It copied the registry button, drawn cream-on-dark; on the light Travel
     section it was invisible though clickable. */
  check('MP-953 Vintage Love Story\'s Book Now is drawn in Travel\'s ink',
    /\.travel-cta\{color:var\(--ink\);border-color:var\(--ink\);background:transparent;border-width:3px!important;/.test(vls), true);
}


// ── "Purchase This Item" on every design ─────────────────────────────────
{
  const rt = fs.readFileSync('site-runtime.js', 'utf8');
  check('the gift button is written "Purchase This Item"',
    (rt.match(/Purchase This Item/g) || []).length >= 2 && !/>Purchase this Item</.test(rt) && !/: 'Purchase this Item'\)/.test(rt), true);
  check('and its case is not copied from the design',
    !/'letter-spacing', 'text-transform', 'text-decoration-line',/.test(rt), true);
  check('Modern Minimal\'s own sample buttons match',
    !/>Purchase this Item</.test(fs.readFileSync('template-modernminimal.html', 'utf8')), true);
}


// ── Vintage Love Story's registry: mirrored corners, text clear of them ───
{
  const vls = fs.readFileSync('template-vintagelovestory.html', 'utf8');
  check('the registry text keeps to the middle, clear of the lace corners',
    /\.registry-info\{position:relative;z-index:2;max-width:min\(620px,/.test(vls), true);
  check('with gifts showing, the bottom-right lace closes the gift band',
    /\.registry-wrap\.mp-reg-has-band \.registry-lace\.br\{display:none;\}/.test(vls) &&
    /\.registry-wrap\.mp-reg-has-band \+ #mp-reg-band::after\{/.test(vls), true);
}


// ── MP-942: Modern Minimal's pair is the hero's companions, not the hero ──
{
  const mm = fs.readFileSync('template-modernminimal.html', 'utf8');
  /* It took photographs 1 and 2, and 1 IS the hero above it, so the hero
     repeated for every couple with two or more photographs. The runtime's
     clean-up hid this in tests with embedded images; real https photos are
     the couple's own and are left exactly where the template put them. */
  check('MP-942 the pair takes the 2nd and 3rd photographs',
    /_pa\.src = _gal\[1\];\s*\n\s*_pb\.src = _gal\[2\] \|\| _gal\[1\];/.test(mm) && !/_pa\.src = _gal\[0\];/.test(mm), true);
}


// ── MP-919 one booking link live; Modern Minimal's Travel link ───────────
{
  const rt = fs.readFileSync('site-runtime.js', 'utf8');
  const py = fs.readFileSync('main.py', 'utf8');
  /* One link, under the hotel, as in the editor and its preview: live data sent
     the couple's link as the flights link AND an old hotel link beside it. */
  check('MP-919 the runtime keeps one booking link, the couple\'s, for the hotel',
    /d\.accommodation_url = d\.travel_url;\s*\n\s*d\.travel_url = '';/.test(rt), true);
  check('and the live payload sends it that way',
    /"travel_url":\s+"",/.test(py) && /"accommodation_url":\s+_clean_url\(_cf\(wedding, CF_TRAVEL_URL, ""\)\)/.test(py), true);
  /* Modern Minimal's menu pointed Travel at #accommodations, an always-hidden
     anchor on this design - the link did nothing, live and in the preview. */
  const mm = fs.readFileSync('template-modernminimal.html', 'utf8');
  check('Modern Minimal\'s Travel link goes to its Travel section',
    /href:'#travel-section',\s+label:'Travel'/.test(mm) && !/href:'#accommodations',\s+label:'Travel'/.test(mm), true);
}


// ── MP-918 typed cards; MP-914 in Firefox ────────────────────────────────
{
  const ws = fs.readFileSync('Website.txt', 'utf8');
  /* A card the couple types got its divider only on blur. Redrawn when the
     number of cards changes, or a title takes in the next line, with the
     cursor's place counted in characters AND line breaks. */
  check('MP-918 a typed card is marked as it is typed',
    /const handleInput = \(e\) => \{\s*\n\s*onChange\(_clean\(e\.currentTarget\.innerHTML\)\);\s*\n\s*_remarkIfCardsChanged\(\);/.test(ws) &&
    /const spilled = !!host\.querySelector\("mp-t:not\(\[data-attire\]\) br"\);/.test(ws), true);
  check('and the cursor position counts line breaks',
    /else if \(n\.nodeName === "BR"\) count \+= 1;/.test(ws), true);
  /* Firefox drops only on an element that cancels dragenter as well as dragover. */
  const set = ws.slice(ws.indexOf('function ImageSet('), ws.indexOf('function ImageSet(') + 9000);
  check('MP-914 tiles and grid cancel dragenter too (Firefox)',
    (set.match(/onDragEnter=\{e => \{ if \(live\.current\) \{ e\.preventDefault\(\); overGrid\(/g) || []).length, 2);
}


// ── MP-918: the Divider button says what it is ───────────────────────────
{
  const ws = fs.readFileSync('Website.txt', 'utf8');
  /* A bare "⎯" read as a minus sign; the button couples asked for was there and
     went unnoticed. Labelled, with the dashed line the box draws. */
  check('MP-918 the Divider button is labelled',
    /\{isMobile \? null : "Divider"\}/.test(ws) && /borderTop: "1\.5px dashed currentColor"/.test(ws) && !/>⎯<\/button>/.test(ws), true);
}


// ── MP-923: every listed event is ordered, editor and preview ────────────
{
  const ws = fs.readFileSync('Website.txt', 'utf8');
  const py = fs.readFileSync('main.py', 'utf8');
  /* The plan the endpoint read lacked some of the events the editor lists
     (Welcome, Farewell); they came back unordered and fell to the bottom. */
  check('MP-923 the endpoint orders the events the editor names',
    /async def get_celebration_event_order\(celebration_id: str, ids: Optional\[str\] = None\):/.test(py) &&
    /for eid in \(ids or ""\)\.split\(","\):/.test(py), true);
  check('and the editor names them', /\?ids=\$\{encodeURIComponent\(_finalEventIds\)\}/.test(ws), true);
  /* The preview's RSVP form numbered events by their place in the list. */
  check('the preview sends each event\'s real sequence and date',
    /return o \? \{ \.\.\.e, sort_order: o\.sort_order, date: o\.date \} : e;/.test(ws) &&
    /\}, \[localChanges, celebration, selectedCelebrationId, eventOrder\]\);/.test(ws), true);
}


// ── The site opens at its top; menu clicks leave no #anchor ──────────────
{
  const rt = fs.readFileSync('site-runtime.js', 'utf8');
  /* A menu click put #events-primary into the address, so reopening it landed
     on The Main Event; a reload also restored the old scroll position. */
  check('menu clicks scroll without writing the anchor into the address',
    /function keepAddressClean\(\)/.test(rt) && /history\.replaceState\(history\.state, '', location\.pathname \+ location\.search\)/.test(rt), true);
  check('and the browser\'s scroll restoration is off', /history\.scrollRestoration = 'manual'/.test(rt), true);
  check('it runs at boot', /function boot\(\) \{\s*\n\s*keepAddressClean\(\);/.test(rt), true);
}


// ── Dead anchors, placeholders, registry fonts, Pressed Petals thumbnail ──
{
  const rt = fs.readFileSync('site-runtime.js', 'utf8');
  /* An address ending in a section the page does not show opens at the top. */
  check('a dead #anchor is dropped at reveal', /function reveal\(\) \{\s*\n\s*document\.body\.classList\.remove\('hydrating'\);\s*\n\s*document\.body\.style\.visibility = 'visible';\s*\n\s*dropDeadAnchor\(\);/.test(rt), true);
  /* Modern Minimal's #accommodations placeholder: hidden, no heading - never re-shown. */
  check('a heading-less hidden placeholder is never re-shown', /if \(sec\.style\.display === 'none' && !head\) return;/.test(rt), true);
  /* MP-932: the registry fetches current data even when the tab holds an old copy. */
  const reg = fs.readFileSync('live_registry.html', 'utf8');
  check('MP-932 the registry refreshes over a stale copy of the site',
    /if \(stashed\) applySkin\(skinFor\(stashed\)\);\s*\n\s*\n\s*fetch\(RENDER_API \+ "\/wedding-site\/"/.test(reg), true);
  /* MP-933: Pressed Petals' thumbnail hero keeps its full width. */
  check('MP-933 Pressed Petals\' thumbnail hero is full width',
    /body\.thumbnail-mode \.hero\{height:66\.67vw!important;min-height:0!important;aspect-ratio:auto!important;width:100%!important;\}/.test(fs.readFileSync('template-pressedpetals.html', 'utf8')), true);
}


// ── Travel: one rule when empty or single; menu font; gallery; iPhone links ──
{
  const rt = fs.readFileSync('site-runtime.js', 'utf8');
  const ws = fs.readFileSync('Website.txt', 'utf8');
  /* MP-958: the empty-half hider only acts while the OTHER half has words, and
     never on an element holding them - one card hid Vintage Love Story's and
     Modern Minimal's whole Travel. */
  check('MP-958 the empty half is hidden only beside content',
    /var otherRaw = d\[FIELDS\[key === 'travel' \? 'accommodations' : 'travel'\]\];\s*\n\s*if \(!_txt\(otherRaw\)\) return;/.test(rt), true);
  /* An empty Travel box: one heading, the design's own Book Now if linked, and
     no separator unless two cards are showing. */
  check('an empty Travel box shows one heading and its Book Now',
    /function _travelWhenEmptyInner\(d, menu\)/.test(rt) && /wrap\.className = 'mp-empty-book';/.test(rt), true);
  check('a separator only between two cards',
    /if \(shown < 2\) pair\.setAttribute\('data-mp-travel-lone', '1'\);/.test(rt) &&
    /\[data-mp-travel-lone\]::before,\[data-mp-travel-lone\]::after\{display:none!important/.test(rt), true);
  check('the empty-state is undone before the template draws',
    /try \{ _travelEmptyUndo\(\); \} catch \(e\) \{\}\s*\n\s*GAP_FIELDS\.forEach/.test(rt), true);
  /* MP-962: the menu keeps its design face unless Menu Links is set. */
  check('MP-962 Body Text and Section Headings do not move the menu',
    /if \(!\(settings\.menu && settings\.menu\.font\) && _designMenuFont\) root\.setProperty\('--menu-font', _designMenuFont\);/.test(rt), true);
  /* MP-947 / MP-952: Gallery headings follow Section Headings. */
  check('Gallery headings follow Section Headings (Coastal Chic, Whimsical Romance)',
    /\.gallery-section \.section-title-mini\{\s*\n[^\n]*\n\s*font-family:var\(--heading-font, var\(--body\)\)/.test(fs.readFileSync('template-coastalchic.html', 'utf8')) &&
    /\.gallery-title\{\s*\n[^\n]*\n\s*font-family:var\(--heading-font, var\(--display\)\)/.test(fs.readFileSync('template-whimsicalromance.html', 'utf8')), true);
  /* MP-936: no iPhone auto-links on any design. */
  check('MP-936 every template turns off iPhone auto-linking',
    ['blacktietimeless','coastalchic','goldenhour','heirloombloom','modernminimal','pressedpetals','regalboho','sageandstill','vintagelovestory','whimsicalromance']
      .filter(n => !/<meta name="format-detection" content="telephone=no, date=no, address=no, email=no">/.test(fs.readFileSync('template-' + n + '.html', 'utf8'))), []);
  /* MP-357: the registry page reads Site Background and Accent the right way. */
  const reg = fs.readFileSync('live_registry.html', 'utf8');
  check('MP-357 the registry reads primary_color as the background',
    /const bg\s+= cz\.primary_color \|\| s\.bg;/.test(reg) && /const accent = cz\.accent_color\s+\|\| s\.accent;/.test(reg), true);
  /* MP-942: Golden Hour's Travel photos skip the three hero columns first. */
  check('MP-942 Golden Hour\'s Travel photos are not the hero\'s first',
    /var _sectionPool=_uniq\.slice\(3\)\.concat\(_uniq\.slice\(1,3\)\)/.test(fs.readFileSync('template-goldenhour.html', 'utf8')), true);
}


// ── MP-959 / 964 / 960 / 963 / 910 ───────────────────────────────────────
{
  const rt = fs.readFileSync('site-runtime.js', 'utf8');
  const ws = fs.readFileSync('Website.txt', 'utf8');
  /* MP-959: marks and card labels redrawn when they no longer sit on the cards'
     first lines - a deletion can leave the count the same. */
  check('MP-959 stale card labels are redrawn',
    /const stale = markEls\.some\(\(m, i\) => _t\(m\.textContent\) !== \(heads\[i\] \|\| ""\) \|\|/.test(ws) &&
    /if \(cards === marks && !spilled && !stale\) return;/.test(ws), true);
  /* MP-964: a link's own underline is not the couple's; U inside a link is the
     editor's own toggle; the Link button lights in a link. */
  check('MP-964 U ignores a link\'s built-in underline', /underline: inLink \? under : \(!!q\.underline \|\| under\),/.test(ws), true);
  check('and toggles the couple\'s own underline inside a link', /if \(cmd === "underline" && _underlineInLink\(\)\) \{/.test(ws), true);
  check('and the Link button lights in a link', /style=\{\{ \.\.\.btnStyle\(!!fmt\.link\), fontSize: "10px"/.test(ws), true);
  /* MP-960: scrolling anything but the menu closes it; the list does not
     scroll the page. */
  check('MP-960 a scroll outside the menu closes it',
    /w\.addEventListener\("scroll", onScroll, true\);/.test(ws) && /overscrollBehavior: "contain",/.test(ws) && /data-mp-menu="1"/.test(ws), true);
  /* MP-963: price and count go to the bottom with the button. */
  check('MP-963 the gift count sits on one line across a row',
    /_first\.style\.marginTop = 'auto';\s*\n\s*btn\.style\.setProperty\('margin-top', '0\.7rem', 'important'\);/.test(rt), true);
  /* MP-910: the registry description and two Book Now labels follow the panel. */
  check('MP-910 fixed copy follows the Colours panel once chosen',
    /function applyPanelToFixedCopy\(d\)/.test(rt) && /applyPanelToFixedCopy\(d\);/.test(rt), true);
}


// ── MP-937 size boxes fit on iPhone; MP-961 Whimsical Romance's corners ───
{
  const ws = fs.readFileSync('Website.txt', 'utf8');
  /* 16px on a phone (iPhone zooms into smaller fields, MP-052) in a box sized
     to its longest option - a fixed 88px cut "Very large" to "Very lar". */
  check('MP-937 the size box is sized to its text, 16px on a phone',
    /width: "auto", minWidth: isMobile \? "122px" : "104px", flexShrink: 0,/.test(ws) &&
    /fontSize: isMobile \? "16px" : "12px", color: "#121212",/.test(ws), true);
  /* Safari did not clip the photo to the rounded frame until a repaint. */
  check('MP-961 Whimsical Romance\'s hero frame clips from the first paint',
    /-webkit-mask-image:-webkit-radial-gradient\(white, black\);\s*\n\s*isolation:isolate;/.test(fs.readFileSync('template-whimsicalromance.html', 'utf8')), true);
}


// ── MP-958, as tested: no invented Travel column headings ────────────────
{
  /* Vintage Love Story ("Hotels" / "Airports") and Regal Boho ("Hotel" /
     "Airports") headed the couple's Travel columns with labels nobody typed -
     a card titled "Hotels" showed the word twice. */
  const vls = fs.readFileSync('template-vintagelovestory.html', 'utf8');
  const rb = fs.readFileSync('template-regalboho.html', 'utf8');
  check('MP-958 Vintage Love Story builds no column heading of its own',
    /'<h3 class="travel-col-title">(Hotels|Airports)<\/h3>' \+/.test(vls), false);
  check('MP-958 nor does Regal Boho',
    /'<h3 class="travel-col-title">(Airports|' \+ titleLabel \+ ')/.test(rb) || /var titleLabel = /.test(rb), false);
}


// ── MP-952: Whimsical Romance's couple names follow Section Headings ─────
{
  /* As on Black Tie, Coastal Chic, Golden Hour, Modern Minimal, Pressed Petals,
     Regal Boho, Sage & Still and Vintage Love Story; Corben until chosen. */
  const wr = fs.readFileSync('template-whimsicalromance.html', 'utf8');
  const rule = wr.slice(wr.indexOf('.hero-couple-name{'), wr.indexOf('}', wr.indexOf('.hero-couple-name{')));
  check('MP-952 Whimsical Romance\'s names follow Section Headings',
    /font-family:var\(--heading-font, var\(--display\)\);/.test(rule), true);
}


// ── MP-942: the sample clean-up repeats the other photos before the hero ──
{
  /* Cycling from the first put the couple's hero back beside itself (A, B, A
     on Vintage Love Story's story frames) when B was there to repeat. */
  check('MP-942 the sample clean-up cycles the other photographs first',
    /img\.src = own\.length > 1 \? own\[1 \+ \(n % \(own\.length - 1\)\)\] : own\[0\];/.test(fs.readFileSync('site-runtime.js', 'utf8')), true);
}


// ── MP-357: the registry page's header looks like the site's registry ────
{
  const reg = fs.readFileSync('live_registry.html', 'utf8');
  /* Background, heading and text colour through the same settings the site's
     registry section uses (measured per design); Accent and fixed white before. */
  check('MP-357 every design has a registry look',
    ['blacktietimeless','coastalchic','goldenhour','heirloombloom','modernminimal','pressedpetals','regalboho','sageandstill','vintagelovestory','whimsicalromance']
      .filter(n => !new RegExp('"' + n + '":\\{"bg":').test(reg)), []);
  check('Heirloom Bloom\'s header follows Accent 2, as its registry band does',
    /"heirloombloom":\{"bg":"accent2","head":"ink","text":"ink"/.test(reg), true);
  check('the header panel, title and text use the look',
    /\.rhero-panel\{position:relative;background:var\(--rh-bg,var\(--olive\)\);color:var\(--rh-text,#fff\);/.test(reg) &&
    /color:var\(--rh-head,#fff\);\}/.test(reg), true);
  check('and the template is known to the skin', /if \(byId\) return \{ alias: label, skin: byId,/.test(reg), true);
}

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
