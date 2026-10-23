# Step 1 findings: what the map settles

Companion to `EDITOR-TYPOGRAPHY-PLAN.md`. Everything below was measured
(method in `harness/README.md`). Per-template detail is in `TEMPLATE-MAP.md`;
the gate reads `template-map.json`. No code was changed.



## Status

Everything marked DONE is in `deploy/`, verified in the browser before and
after, and covered by the regenerated map. `deploy/all-changes.diff` holds
every change against the original files.

**DONE**
- Content loss: Coastal Chic and Modern Minimal FAQs, Vintage Love Story
  sample hotels and fused airports.
- Step 2: Menu Links has its own font on all ten templates, at both widths.
- Step 2: Section Headings reaches every section heading. It used to miss them
  on Coastal Chic, Modern Minimal and Whimsical Romance, and on Modern Minimal
  it changed the body copy instead.
- Font reset: un-choosing a font, or Reset to template default, clears every
  variable the runtime set. Before, a face could stay on the preview until a
  reload.
- Step 3: a Travel card's first line is a title on the page, as the Content
  box always showed it. Checked on Modern Minimal directly; the map's
  exact-text match cannot find it there.
- Step 3: the editor is told the right FAQ question face (Pressed Petals
  reported Arial).
- Step 3: Modern Minimal's Other Events names render in its event-name face.
- Step 4: a font applied to a whole Events box reaches every line, not only
  the titles.
- Step 4: whole-box formatting carries across the Travel hotel/flights cut and
  across FAQ questions and answers.
- Step 4: FAQ questions keep bold, italic, underline and fonts (MP-333) on all
  ten. Existing records with a bold delimiter render as before.
- Step 4: Coastal Chic bold shows on its 300-weight copy.
- Step 5: Text2 reaches the 13 fixed white texts on five templates (MP-910).
  The default look is pixel-identical; older browsers keep today's colour.
- Pressed Petals' Need to Knows and Registry headings follow Text2, like the
  rest of its copy on dark bands, instead of Highlight (MP-357). Default
  unchanged.
- Golden Hour's Text3 control is hidden: its variable is used nowhere. The
  other five "idle" controls were kept, because each colours hover states,
  focus rings, rules or a later RSVP step.

- Cocktail Attire, narrowed (MP-337): only a dress-code line - the last line
  of an event block, wholly italic, in a block that is not italic throughout -
  gets the design's script face. A single italic word, or a whole box in
  italics, stays italic in the body face; both used to turn into script. The
  runtime tags the line (mp-attire) and six templates style the tag. Showing
  that line in the script face in the Content box is part of the site-to-box
  work below.

- MP-337, site to box: each Content box now shows the design's own treatment
  of its lines, measured from the rendered page by the runtime (never from a
  list): the body face, weight and slant (Pressed Petals' italic Our Story, the
  italic FAQ answers, Coastal Chic's 300 weight), each box's own title style,
  and the dress-code line in the script face where the site uses one. The
  B/I/U buttons light from what the box shows, so I is lit inside default
  italic. Turning it off writes font-style:normal, which the site honours -
  verified end to end on Pressed Petals' Our Story. A whole-line bold title
  now shows at the design's title weight in the box (it was forced to 400).
  (Corrected: an earlier note here said a box italicised from its first
  character shows titles the site does not. Checked against markStructure,
  the site marks those titles too - box and site agree; nothing to fix.)

- MP-905, RSVP box. The box holds only the couple's own line; when empty it
  shows, greyed, exactly what the site shows then (the design's line, with
  their deadline in the design's wording). Reset to default removes their
  line. Fixed in the runtime: clearing the note left the OLD note on the
  preview; the editor was told a stale line (the previous note or a sample),
  which refilled the box; a deadline lost the design's wording; Golden Hour
  printed "by <the wedding day>" with no deadline set. "By Month Day, Year"
  appears in none of the current files, so it came from an older version.
- Editor: event titles in a box whose body is italic now show upright, as on
  the site (found by the new editor test, harness/editor-test).

- RSVP line with no note and no deadline: hidden on the live site (it showed
  the design's sample date, which guests read as real). In the editor preview
  and as the box's placeholder it shows faded, in the design's wording, with
  the date left open: "...by [your RSVP date]".
- MP-918, dividers. Boxes the site splits into cards (Events, FAQs, Travel)
  show a dashed divider above every card after the first, so a couple sees
  where the site will split their copy - and sees a card merge or appear when
  they delete or add a blank line. Travel titles are labelled Hotel card /
  Travel card. The Line break button in those boxes is now Divider: it starts
  a new card at the cursor (open question 3). Drawn with CSS on the title
  mark: nothing is added to the saved text, and dividers refresh when the box
  loses focus, like titles.

- Content box group, tested in the real editor (harness/editor-test):
  - MP-915: B/I/U light inside bold/italic/underlined text - by click, by
    arrow keys, while typing, after pressing B on an empty caret, at the edge
    of a bold word. Already working; no change needed.
  - MP-935: every click of the spacer button adds exactly one spacer, at the
    end or start of a line, mid-word, and at the very end of the box.
  - MP-920: New Event in an empty box adds no leading space.
  - MP-921: a new question goes at the end; the first question stays first.
  - MP-916: text never lands inside a spacer. FIXED the rest of it: the
    browser drops the line break beside a spacer it inserts, so the site
    (which splits lines on <br>) read the line AFTER a spacer as part of the
    line before - after a title, the next line joined the title. The break is
    restored by the editor on insert and on save, and by the runtime for
    records already saved that way, so existing sites are repaired without
    re-saving. Clicking a spacer and typing now starts a line above it.

- Group A, text on the site that was not in the box:
  - MP-954: Vintage Love Story showed its sample Other Events (Welcome Party,
    Sunday Brunch) whenever the couple had fewer; now always theirs. No other
    "keep the sample" rule remains in any template (checked structurally).
  - MP-951: Whimsical Romance and Vintage Love Story invented a "Request the
    ... room block" line (Whimsical even named the SAMPLE couple) and Vintage
    Love Story rewrote a note the couple did write. Now: their note, verbatim,
    or none. Vintage Love Story also showed their note twice; now once.
  - MP-944: on the four combined-schedule designs the Event Schedule box now
    shows any old Other Events text, in the order the design renders it, and
    saving moves it in and empties the old field - so box, preview and live
    agree and switching template cannot bring it back.
- Group B, decision: titles (event names, FAQ questions, Travel card titles)
  follow Section Headings and body copy follows Body Text, on every design.
  Measured on all ten: every heading, title and body line now follows its
  control. Fixed: FAQ questions on 8 designs, Coastal Chic's titles and Our
  Story heading, Travel card names on Regal Boho and Vintage Love Story, Sage
  & Still's event names and its Ovo body copy (MP-948), Vintage Love Story's
  Our Story. MP-940 and MP-947 were the pre-Step-2 behaviour; MP-952's
  Gallery heading already followed. Defaults unchanged (drift gate).

- Group C, buttons. Tested in LIVE mode as well as the preview (the test
  hands the page a couple's data the way the landing page does):
  - MP-941: the runtime's extra "View our registry" button is added only
    where the design has no registry button of its own. Modern Minimal,
    Coastal Chic, Whimsical Romance, Regal Boho and Vintage Love Story showed
    two; now one. Gift tiles are centred for any count (they sat left with 2
    or 3; Modern Minimal's four overflowed its grid).
  - MP-946: that button now shows in the preview too (inert, like the
    preview's other buttons), so live and preview match on all ten.
  - MP-953: Vintage Love Story gets Book Now under hotels and airports when
    there is a booking link, drawn like its own outlined button.
  - MP-919: no Book Now without a link on any design, desktop or phone, live
    or preview; desktop and phone match. Already fixed by earlier work.
  - Noted, not changed: Heirloom Bloom and Regal Boho have one booking
    button (hotel) by design, even when a flights link is set.

- marker-test.js: green on every file changed by these rounds. Run on the
  original files and on the new ones under identical conditions (six files
  this work never had were stubbed empty), the new files fail exactly the
  checks the originals fail - the 11 that read WebsiteHelp.txt - and nothing
  else. To get there: lift lists updated for the new helpers; checks pinned
  to code that was deliberately rewritten now assert the new behaviour, each
  with a comment saying why; 21 new checks cover this work; release stamped as
  2026-10-23-typography-map with harness/stamp.py. Coastal Chic's text on dark
  bands now uses its spec ivory, not a pure white that is in no spec.

- Group D, the "changes to save" counter (MP-943, MP-949): counts changes as
  the couple makes them. Four colours, the registry preview switch and two
  legacy colour keys share one field (customCss); it is now counted pair by
  pair, and pairs that only mirror a setting with its own field are not
  counted twice. Six colours read as six (were three); one registry click as
  one (was two).
- Group E, layout:
  - MP-950: Whimsical Romance and Coastal Chic centre a short last row of
    events (it sat left); full rows, tile widths and phones are unchanged.
  - MP-939: Heirloom Bloom's hero carousel loops round instead of rewinding
    across every photo.
  - MP-937: the editor's text-size and font menus stay on screen on phones
    (both ran off the edge at 320-360px wide).
  - MP-942, measured, no change: the runtime already fills these frames from
    the couple's photos in order; the hero repeats only when the couple has
    fewer photos than frames (Modern Minimal: three frames, so two photos).
    Needs a decision - see OPEN.
  - MP-945: the Travel stamp is an image with a white background baked into
    the gaps between its scallops, which only matches the default ivory
    background. Fix is editing that SVG (on the asset CDN, not reachable
    here) - needs the file.

- Travel formatting on Golden Hour and Sage & Still: kept now (bold, italic,
  underline, fonts, and formatting across a whole card). A card's lines are
  each made to stand alone (_mpLines) instead of every tag being stripped.
  Links behave exactly as before: Golden Hour removes pasted addresses (Book
  Now carries them) and keeps a link's words; Sage & Still keeps the words.
- Vintage Love Story's Our Story: the couple's formatting and line breaks are
  kept. A long story flows across the two columns on its own (CSS columns)
  instead of being cut by counting words of plain text, which could split a
  sentence anywhere; a short story stays one centred column; phones one.
- MP-945 (Coastal Chic): needs the stamp SVG - the asset CDN is not reachable
  from here.

- MP-915 / MP-333, re-opened in testing and fixed at the cause. Reproduced in
  the real editor: (1) B, I and U never saved anything themselves - they
  relied on the browser raising an input event after the command, which it did
  not for a whole title (and does not dependably in every browser), so the
  bold showed in the box, never reached the record, and on reselecting the
  text it was plain and B unlit; (2) applying a font, or B/I/U once the
  browser is in CSS mode, to a WHOLE title restyled the box's own title mark
  instead of the words, and the mark is stripped before saving. Now B/I/U save
  after every command, anything a command writes onto a title mark is moved
  into a real span, and the button state is read from the selection wherever
  it lives (both windows) and from the rendered weight/slant. Also: a
  whole-line <b> is the couple's bold and is kept on the site (only the old
  <strong> marker is unwrapped); FAQ questions keep a whole-line <b>; Vintage
  Love Story and Regal Boho accept formatting inside a hotel name. The site
  already rendered the editor's font and bold spans correctly - the fault was
  that they were never saved. Firefox could not be run here; the fix removes
  the browser-dependent step rather than relying on it.

- MP-915, third pass - the real cause of the unlit buttons. Softr renders the
  editor inside a shadow root, and window.getSelection() does not see into one:
  it reports the outer host, so the editor decided the selection was not in
  its box and never updated B, I or U, while bold itself applied fine. The
  earlier tests ran on an ordinary page and passed. Reproduced by rendering the
  real editor inside a shadow root; fixed by reading the selection from the
  shadow root itself, then the windows, then getComposedRanges. The selected
  look was also made unmistakable (filled green, white letter). Both are now in
  harness/editor-test, including a shadow-root run.

- Formatting a box that is underlined throughout (Heirloom Bloom, as tested):
  the editor's title marks were inline-block, and CSS does not carry an
  underline into an inline-block - so a title the site underlines showed plain
  in the box, the browser's U command (judging by what was drawn) ADDED an
  underline the couple meant to remove, and the toolbar (reading the tags)
  showed U on. Marks are inline now. B, I and U with nothing selected act on
  the word the cursor is in, as in most editors (the browser's own behaviour
  changes only what is typed next, so nothing visible happened). Empty tags the
  browser leaves are not saved. The runtime no longer reports a couple's
  underline round a whole title as the design's title style.

- The eraser (Clear formatting) clears the selected words only, or the whole
  section when nothing is selected - as its hint now says. It used to read the
  selection through window.getSelection(), which cannot see into Softr's
  shadow root, so it always cleared and selected the whole section. The
  selection is also kept through it, so bold on the same words as a font is
  removed too.

- Select all + B in a box with titles (Travel, as tested): the browser wraps
  the title marks in one <b>, and the weight each mark states for the design
  beat the inherited bold - titles stayed plain in the box while the preview
  showed them bold; a click elsewhere redrew some marks bold and not others,
  which is why un-bolding a title then took several clicks. The couple's
  bold, italic or font round a mark now wins over the mark's default.

- MP-901 / MP-904, decided: ONLY the Design tab hides a section. An emptied
  section stays, with its heading; what is under the heading (the design's
  sample copy, which a template leaves standing for an empty field) is set
  aside and given back exactly when the couple types again. Registry, RSVP and
  Gallery were already never hidden for being empty. Tested on all ten: no
  sample copy shows in any emptied section; merged schedules are untouched.
  Note: Pressed Petals' Wedding and Other Events bands have no heading in the
  design, so emptied they show as the band alone.
- MP-911: already fixed - all ten, live and preview: Travel off hides Hotel and
  Flights; FAQs off hides questions and heading even with Things to Do on.
- MP-922: already fixed - each Purchase button opens its own gift on the
  registry page (tested on the site and on the real registry page).
- MP-924 (main.py): every entree was dropped - the callers pass "entree", the
  writer read "entree_choice". Reads both now.
- MP-925 (main.py): confirmation date reads "October 23, 2026"; the guest who
  answered for a party gets one card with everyone, plus-ones included.
- MP-932 (live_registry.html): the registry page uses the couple's heading and
  body fonts, not only the template's.

**READY TO VERIFY**: MP-354, MP-333, MP-337, MP-357, MP-910, MP-905, MP-904,
MP-918, MP-915, MP-916, MP-920, MP-921, MP-935, MP-940, MP-944, MP-947,
MP-948, MP-951, MP-952, MP-954, MP-919, MP-941, MP-946, MP-953, MP-943,
MP-949, MP-950, MP-939, MP-937. What to check for each is in the chat summary of this round.

**OPEN: needs a decision**
- MP-942: with fewer photos than frames (Modern Minimal: hero + a pair = 3),
  one photo must repeat. Keep repeating the hero, or show fewer frames?
- Registry when emptied: kept as is (shown unless switched off), by decision.
- (was) Registry when emptied. Every live site has a registry link (built from its
  address), so "no words and no link" never happens. Choose: (a) keep it shown
  unless switched off, as today (suggested), or (b) hide it when it has no
  words and the backend confirms zero items, never on a failed request.
- A second hotel lands under Flights on every template (the runtime's cut).

**OPEN: work**
- Modern Minimal shows Our Story only as a plain 280-character hero tagline.
  This is the design, noted in case it is not wanted.
- MP-936 needs an iPhone check. The Registry colour swap needs the template
  name. MP-911 was not reproduced.

The sections below record the state Step 1 found. Where one says DONE or
FIXED, this Status section is the current word.

## The questions Step 1 was expected to settle

**Is there a real menu font variable anywhere?** There was not; there is now (see Step 2). Before the change:

| Template | Menu face (desktop / mobile) | Menu Links writes | Reaches menu (desktop / mobile) |
|---|---|---|---|
| Black Tie Timeless | `--serif` / `--serif` | `--serif` | yes / yes |
| Coastal Chic | `--body` / `--body` | `--body` | yes / yes |
| Golden Hour | `--serif` / `--serif` | `--serif` | yes / yes |
| Heirloom Bloom | `--serif` / `--serif` | `--serif` | yes / yes |
| Modern Minimal | `--body` / `--body` | `--body` | yes / yes |
| Pressed Petals | `--serif` / `--serif` | `--serif` | yes / yes |
| Regal Boho | `--display` / `--body` | `--body` | **no** / yes |
| Sage & Still | `--sub` / `--body`, `--sub` | `--body` | **no** / yes |
| Vintage Love Story | `--sans` / `--display` | `--sans` | yes / **no** |
| Whimsical Romance | `--body` / `--body` | `--body` | yes / yes |

"Yes" means it reaches the menu *and* all body text, since they share the
variable. That is MP-354. Per the decision taken, each template needs a menu
variable that defaults to the face shown here. Three templates already use
different faces at the two widths, so the menu needs one variable that both
widths read.

**Does Highlight change the Need to Knows and Registry headers?** Yes, on
Pressed Petals only: `--white` colours those two section headings. Highlight
colours no text on any other template.

**Which variable carries body text on dark backgrounds?** On five templates,
none. That text is a fixed colour that no control reaches, which is MP-910 and
the Text2 report:

- Pressed Petals: `.event-card-detail`, `.accom-address`
- Golden Hour: `.wedding-card-detail`, `.event-detail`, `.ntk-answer`
- Black Tie Timeless: `.ntk-answer` (FAQ answers and Things to Do)
- Coastal Chic: `.schedule-event-address`, `.faq-answer` (and Things to Do)
- Heirloom Bloom: `.rsvp-deadline`

Exact rules and backgrounds are under "Text no colour control can reach" in
`TEMPLATE-MAP.md`.


## Font roles (Step 2)

### Menu: DONE (in `deploy/`)

Each template now declares `--menu-font`, set to the face its menu has always
used, and its menu rule reads it. Menu Links writes `--menu-font`. The phone
drawer (built by the runtime) reads it too. A couple's choice is set on
`<html>` and overrides the default at every width.

- **Default look:** unchanged on all ten templates at desktop and phone width.
  On the three templates where the phone drawer always inherited a different
  face (Regal Boho and Sage & Still: body; Vintage Love Story: display), a
  phone-width default keeps it exactly as it was. The one measurable
  difference is Sage & Still's own menu on a phone, which sits off-screen in
  a drawer phones cannot open.
- **Menu Links now reaches the menu at both widths on all ten.** Before:
  Regal Boho and Sage & Still never at desktop, Vintage Love Story never on
  phones, and the other seven only by changing all body text with it.
- **Body Text no longer changes the menu,** except where the menu's default
  *is* the body face, which is the "default to inherit" decision.
- **Choosing both now works.** The runtime used to drop the menu choice
  whenever a body font was also set.
- **The editor's Menu Links dropdown shows the menu's real face:** Libre
  Baskerville on Regal Boho and Ovo on Sage & Still, instead of the body face.
- **Deploy order is safe either way.** An old runtime with new templates
  behaves as today. A new runtime with old templates leaves the menu
  unchanged and breaks nothing.

Two harness bugs were found and fixed while verifying this:

- The analyser assumed Menu Links writes the body variable instead of reading
  it from the runtime. That is a pinned literal, the kind of gate the plan
  warns about.
- The probe classified a variable declared as `var(--x)` as a colour, because
  `CSS.supports('color', 'var(…)')` is always true.

The corrected harness reproduces the previous map exactly, so neither bug had
affected earlier results; both would have hidden this step's.

### Headings: DONE (see Status). Before:

The Headings control writes `scriptVar || displayVar`. Where that is not the
face the section headings use:

- **Coastal Chic:** writes `--script`, which paints only the hero names. Every
  section heading is `--body`.
- **Modern Minimal:** headings use `--heading`, which `TEMPLATES` in the
  runtime does not list. The control writes `--body` and never reaches a heading.
- **Whimsical Romance:** `--script` reaches The Wedding heading and event names.
  The Accommodations, FAQ, RSVP and Things to Do headings are `--display`.
- **Regal Boho, Vintage Love Story:** `--display` also paints Our Story and
  Travel body text, and Regal Boho's desktop menu. Changing headings changes
  those too.
- **Sage & Still:** `--sub` paints the menu and event names and is not in
  `TEMPLATES` either.

`TEMPLATES[...].fonts`, the fallback stacks for the Save the Date and gate
screens, names the wrong face on six templates. For example, Black Tie
Timeless lists Parfumerie Script; the template uses Ballet.


## One definition of a title (Step 3)

The editor marks a title in five fields (`blockNoun`, `titleLine`). The runtime
marks two (`STRUCTURED_FIELDS`). The templates decide the other three for
themselves:

- **Travel (hotel and flights cards).** A first line is a title only if the
  whole line is `<strong>`/`<b>`. The editor no longer writes that bold, so on
  9 of 10 templates a first line typed today is **not a title on the page**,
  while the box shows it as one. (Vintage Love Story is the exception only
  because of the placeholder fault below.)
  - Several templates also take the first `<strong>` *anywhere* as the hotel
    name, and the first `<em>` anywhere as the room-block note.
  - So in Travel, bold and italic still decide structure, contrary to the
    runtime's stated rule.
- **FAQ questions.** Every template strips all tags from a question. Bold,
  italic, underline and font on a question never reach the page, though the
  box shows them.
- **Reported styles are sampled wrongly.**
  - Pressed Petals reports its question face as Arial; the page uses
    Instrument Serif.
  - One "label style" drives both Travel cards. It differs from the page on
    Golden Hour, Heirloom Bloom, Black Tie Timeless and Whimsical Romance.
- **Modern Minimal, Other Events.** This template never adopted `<mp-title>`.
  The title renders as raw inline text in Poppins 400; the box shows DIN
  Condensed 700.
- **Wholly italic lines.** `markBlock` leaves them unmarked by design, but six
  templates restyle them by selector, e.g. `.event-card-detail em:last-child
  { font-family: var(--script); font-style: normal }`. Any `<em>` that is the
  last element in a card becomes the script face and stops being italic.
  - This is "Cocktail Attire shows one face in the box and another onsite".
  - It also catches a single italic word, if it is the card's last `<em>`.


## Formatting that survives (Step 4)

Partial formatting in the event fields survives everywhere. Confirmed faults:

- **Whole-box font, Events (9 templates): titles keep it, body lines lose it.**
  - `markBlock` re-opens the couple's tags right after `</mp-title>`, on the
    title's own line. `_mpTitle` takes everything up to the first `<br>` as the
    title and strips it, re-opened `<span>` included.
  - `<i>`/`<u>` survive only because the browser's HTML parser automatically
    re-opens those across the card `<div>`; it does not do that for `<span>`.
  - Reproduce with `harness/trace_title_span.js`.
  - Likely fix: emit the re-opened tags after the `<br>`.
- **Whole-box underline or font, Travel: stops at the hotel card.** The
  runtime's hotel/flights cut does not carry open tags across. This is MP-337's
  old fault, in a field `markStructure` does not touch.
- **Tags stripped entirely:** Story on Modern Minimal and Vintage Love Story;
  both Travel cards on Sage & Still and Golden Hour.
- **Coastal Chic bold is invisible.** Body text is weight 300 and `<b>` lifts
  it only to 400.

Defaults a couple must be able to override (decision: all text is stylable):

- Pressed Petals: Our Story italic (`.story-text`), addresses italic, RSVP line
  italic
- FAQ answers italic on five templates; Things to Do shares that rule on
  several
- Coastal Chic: weight 300 throughout
- Whimsical Romance: `.accom-meta` italic and bold
- Regal Boho: event titles and questions italic

The full list per template is under "Defaults imposed on body copy".


## Colour slots (Step 5)

Controls that change nothing visible at rest:

- Coastal Chic: Highlight
- Golden Hour: Text3 (its variable is used nowhere)
- Modern Minimal: Text3
- Regal Boho: Text2
- Sage & Still: Accent (hover and focus only)
- Vintage Love Story: Additional (a later RSVP step only)

A couple moving any of these sees nothing happen.

Golden Hour's is deliberate. The runtime's own note (above
`TEMPLATE_COLOR_VARS`) says its `--ink3` "is declared so the control exists
and moves nothing". By this plan's own principle, a control with nothing to
move should be hidden, as `accent3` already is on six templates.

**Registry with Site Background and Accent swapped:** not reproduced. Coastal
Chic is the only template where both paint the Registry, and there the band is
Site Background and the button is Accent, as designed. Which template was it
seen on?


## Faults outside the typography bundle: FIXED

Found while mapping. Each was a couple's content not appearing at all. Fixed
in `deploy/` (diff: `deploy/all-changes.diff`), each verified in the
browser before and after. The map in this folder was regenerated against the
fixed templates; the gate showed differences only in these three templates,
all of them intended.

- **Coastal Chic and Modern Minimal never showed a couple's FAQs.** The
  placeholder-retention block committed to the page *before* the loop that
  built the questions, so the sample FAQs stayed on screen. It now commits
  after the loop. Emptying the box still hides the section.
- **Vintage Love Story showed its sample hotels and airports** whenever the
  couple wrote fewer entries than the sample's two of each. The couple's
  entries now always render; with none, the section hides as before.
- **Vintage Love Story fused every airport into one entry.** It split Travel
  cards on three `<br>` while the runtime rejoins them with two. The fix above
  exposed this, because the sample had been hiding it. It now splits on a blank
  line, like everything else.

**Not changed, for a runtime decision.** The runtime cuts the one Travel box
by giving its first card to the hotel slot and everything after to flights. A
couple with two hotels therefore gets the second under Airports or Flights, on
every template. Which card is a hotel belongs to Step 3's single definition of
structure.


## Sections (MP-904, MP-905, MP-911)

- Every section hides with its toggle off and when its box is emptied. That
  includes a box holding only the filler `<br>`, so "Our Story disappears on a
  second Clear" is fixed.
- Registry stays visible when emptied, on all ten templates. That is
  consistent and matches the code's stated intent; open question 1 is a product
  decision, not a fault.
- "FAQ header outlives its questions" (MP-911) was not reproduced.
- Black Tie Timeless, Golden Hour and Heirloom Bloom ship 9 or 10 sections as
  `display:none` until hydrated; the rest ship 3 or 4. This matches the runtime's
  MP-855 note.


## Mobile (MP-936)

No mobile-only rule changes FAQ colour on any template, and Chromium shows
nothing blue. No template sets `<meta name="format-detection">` or styles
`a[x-apple-data-detectors]`, so iOS Safari will turn dates, times and addresses
in FAQ answers into blue links. That is the leading candidate. Confirm on an
iPhone before fixing.


## Still open

- MP-936: device confirmation.
- The Registry colour swap: which template.
- MP-911: a reproduction, if it still occurs.
- The resting-state limit. Controls marked "nothing visible at rest" may still
  paint hover or focus states. Measuring those would need the harness to force
  `:hover` and `:focus` (possible via DevTools Protocol), not done here.
