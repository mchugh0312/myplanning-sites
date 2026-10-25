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

- Un-bolding one title after select-all + B also un-bolded the other titles
  (Travel: Hotel took Flights with it). The editor's title marks stated the
  design's weight inline, and the browser read "font-weight:400" on a mark as
  "this text is not bold" when re-bolding the rest. Weight and slant now ride
  on attributes the editor's stylesheet turns into the same look.

- LIVE BUG, found while testing MP-945: on the live site, Travel disappeared
  for any couple whose old "Show Accomodations" field was off - which is many,
  since that switch has had no control since Travel and Accommodations merged.
  The runtime hides the merged band if either key is off, and main.py read the
  two keys from separate fields (the editor's preview sends both from the one
  Travel switch, so the preview never showed it). Confirmed on all ten live
  templates; fixed in both: the runtime makes Accommodations follow Travel
  before any template reads it, and main.py sends Travel's value for both.
- MP-945 (Coastal Chic stamp): the SVG drew a full white rectangle behind the
  stamp art, which showed in every gap between the scallops. Removed; the
  corrected file is on the asset CDN (748b56c0-...svg) and the template uses it.

- MP-931: the gift preview is its own band under the registry section, and the
  seam kept both paddings (the design's bottom padding plus the band's top):
  64-98px between the button and the gifts, with or without text. While the
  band shows, the seam is now an even ~32px on every design.

- MP-933 (hero narrower than the screen on mobile, gap on the right): could not
  be reproduced in Chrome at phone, tablet or resized-frame sizes, and the
  heroes are pure CSS. What WAS found: three things sticking out past the right
  edge on a phone - Pressed Petals' and Heirloom Bloom's closed menu drawer
  (200-300px), a Pressed Petals flower, and Modern Minimal's RSVP band (its
  14px pull into the blue frame overshot the 6-8px frame on small screens).
  Chrome clips such overflow; some mobile browsers instead widen the page to
  fit it and shrink everything - which matches the report. All three fixed;
  no template now has anything past the edge at phone width. Needs a re-test
  on the tester's device.

- MP-914 (photo drag-and-drop, Homepage images and Gallery): while a photo is
  dragged the grid re-flows to show where it will land (the photo shown faded
  in that slot; the HERO badge follows), the whole grid accepts the drop so the
  "not allowed" cursor no longer shows between photos, and letting go commits
  the order - on a photo, in a gap, or abandoned if released outside the grid.
  Tiles keep a stable identity (they were keyed by position, which would have
  cancelled a drag as they moved), and Firefox gets the data it needs to start
  a drag.

- RSVP: the "[your RSVP date]" hint showed in the preview as well as the
  Content box. The page now shows only what the couple has (their note, else
  the design's line with their deadline, else nothing); the hint stays as the
  Content box placeholder.
- Travel switched off and on again with an empty box: the section stayed
  hidden, so its menu link came back pointing at nothing and clicking it did
  nothing - on all ten designs, desktop and phone menus. The emptied-section
  code showed a collapsed section only the first time; it is shown every time
  now. (The link REMAINING after switching off did not reproduce on the current
  build in either menu - worth re-checking once deployed.)

- MP-921, as re-tested: "+ Question" now adds "New question" with "New
  answer" under it, marks the new block at once (so the divider shows above it,
  and between two new questions in a row, without clicking away), and selects
  "New question" so typing replaces it.
- Decided: second hotel cards get their own hotel card (to do: the runtime
  rule - hotels are the cards before the first travel heading - and six designs
  that fold a second hotel into the first card: Golden Hour, Heirloom Bloom,
  Modern Minimal, Pressed Petals, Regal Boho, Whimsical Romance).
- Decided: MP-923 via a small backend endpoint (to do).
- Decided: Pressed Petals' heading-less Wedding / Other Events stay as a plain
  band when emptied.

- Registry Purchase buttons out of line (regression from the MP-941 centring):
  the gift row became a wrapping row, and the cards kept the grid's
  height:100%, which stopped them stretching - a card without a quantity line
  had its button higher. Cards now size automatically and the row stretches
  them; aligned on all ten, centring unchanged.
- MP-939 (Heirloom Bloom hero): there were no arrows (only dots and swipe) and
  autoplay ran every 6s. Added previous / next arrows (next on the last photo
  goes round to the first; previous on the first, to the last) and autoplay
  every 3s, restarted after any arrow, dot or swipe.
- Map baseline re-taken: the only change on every design is the RSVP line no
  longer measured in the editor scenario (the page no longer shows the
  "[your RSVP date]" hint there).

- Password-protected sites flashed "Your celebration awaits" in Comic Sans:
  the loading screen's font list ended in the generic 'cursive', which Windows
  draws as Comic Sans while the script face downloads - and a protected site
  always passes through this screen (its data is not cached before the
  password). The fallback is Georgia now, and the words stay hidden until the
  template's face has loaded (at most 1.2s). Seven of the ten designs ended in
  'cursive'.
- MP-941, as tested: a word too long for its line (a pasted link, an unbroken
  test string) ran off the side - the Registry and hero text on Modern Minimal,
  and Our Story / FAQs / Registry on a phone on every design. Long words break
  now; zero overflows across all ten at desktop and phone width.
- MP-923 (RSVP settings event order): new endpoint in main.py,
  GET /celebration/{id}/event-order, returning the celebration's events in the
  RSVP form's order (Event Sequence, then date, then name - the same events and
  the same rule the site uses). The editor fetches it and orders the list;
  anything it does not return keeps its place after.

- MP-942, decided and done: fixed hero frames (Modern Minimal, Golden Hour)
  put the hero first and then cycle the couple's OTHER photographs, repeating
  the hero only when it is the only one - two photos give A B B (were A B A).
  Coastal Chic's Travel photo already took the second.
- MP-953, as tested: Vintage Love Story's Book Now copied the registry button,
  which is cream on the dark registry band - invisible on the light Travel
  section though clickable. Drawn in Travel's ink now, sized for the column.
- Registry text without spaces wraps on all ten (desktop and phone) since the
  long-word fix. "Purchase This Item" decided - see below.

- Decided: the gift button reads "Purchase This Item" on every design. It was
  forced to capitals by the runtime's fallback button rule (nine designs) while
  Modern Minimal's own grid skipped that rule. Now written in title case and
  shown as written on all ten. (Noted: on Golden Hour the gift button draws as
  plain text, not an outlined button - unchanged, flagged.)

- Vintage Love Story registry: the couple's text ran the full width, under the
  lace corner at each end of a long line, and with the gift preview showing the
  bottom-right corner sat at the seam above the gifts, so the pair no longer
  mirrored. The text keeps to the middle now, and the bottom-right corner moves
  to the bottom of the gift band (gifts above it).
- Gift buttons with no solid fill: the label took the band's own colour but the
  outline was still copied from the design (with a couple's colours: black
  label in a white ring). The outline follows the label now - every design.
- Vintage Love Story's Book Now: 3px outline.

- MP-942, re-opened and fixed at the cause: Modern Minimal's photo pair took
  photographs 1 and 2, and 1 IS the hero above it - so the hero repeated for
  every couple with two or more photographs, live and in the preview. The pair
  now takes the 2nd and 3rd (the runtime has already arranged them hero-first,
  then the others). The earlier "fixed" was a false pass: the tests used
  embedded images, which the runtime's sample clean-up re-filled in the right
  order by accident; real https photos are left where the template puts them.
  Re-tested with real web addresses.

- MP-919, re-opened: two Book Now live, one in the preview. The editor has one
  booking-link box (saved to Travel URL) and its preview sends it as the hotel
  link only; the live payload sent Travel URL as the FLIGHTS link and the old
  Accomodation URL column as the hotel link. main.py and the runtime now both
  send one link - the couple's - under the hotel. One button on all ten.
- Modern Minimal's Travel menu link did nothing, live and in the preview: its
  nav pointed at #accommodations, an always-hidden anchor on this design (the
  content is in #travel-section). Older suite checks pinned that target; they
  now require #travel-section.
- MP-923: the editor now logs what the event-order request returns ([MP-923]
  in the browser console) - HTTP status, or each event with its sequence and
  date - to tell an undeployed endpoint from events that have nothing to order by.
- The password-site "Your celebration is loading" flash is NOT in any file here
  (the runtime's own screen says "awaits"): it is the landing page, index.html.

- MP-918, re-opened: a card the couple TYPES (Enter twice, then its name) got
  no divider or title styling until the box lost focus. The box now redraws
  its marks as soon as the number of cards changes, or a title takes in the
  next line, putting the cursor back exactly (counting line breaks). Tested:
  typing a new event, merging two cards, typing inside a title, Travel.
- MP-914, re-opened: works in Chrome, including inside a shadow root as Softr
  renders it. Firefox treats an element as a drop target only if dragenter is
  cancelled as well as dragover; the grid did only dragover, which in Firefox
  is the "not allowed" cursor and no drop. Both are cancelled now. Firefox
  cannot be run here - needs a re-test there.

- MP-923, as tested (list unchanged): the editor matched events to the RSVP
  form's order by record id only. Its list comes from the celebration's linked
  field while the endpoint reads the couple's plan, and the two can hold the
  same event under different record ids - then nothing matched and the list
  kept its old order. Matched by id, then by name, now; and the console logs,
  per event, the position it took and how it was matched (or that it was not).

- MP-918, the button: the Divider button (in place of Line break in Events,
  FAQs and Travel) was there, but as a bare "⎯" it read as a minus sign and
  went unnoticed. Labelled "Divider" now, with a dashed line, styled like
  "+ Event" (the line alone on a phone). Pressing it mid-card splits the card
  and the dashed line shows at once.

- MP-923, from the console log: the endpoint read the couple's PLAN, which
  held three of the five events the editor lists; Welcome and Farewell came
  back unordered and fell to the bottom. The editor now sends its own event
  ids (?ids=...), and the endpoint orders all of them by Event Sequence. And
  the preview's RSVP form numbered events by their place in the list (it asked
  about the reception before the ceremony): the editor now sends each event's
  real sequence and date, and re-sends the preview when the order arrives.

- Live site opening at The Main Event (Modern Minimal, as tested): could not
  be reproduced on a fresh load by any path (hand-over, direct, slow photos,
  desktop or phone). The likely cause: menu links are plain #anchors, so a
  click put #events-primary into the address, and reopening that address -
  history, a bookmark, a reload - lands there; reloads also restored the old
  scroll position. Menu clicks now scroll without changing the address, and
  scroll restoration is off. A deliberate section link (#rsvp) still works.
- Comic Sans on Modern Minimal's loading screen: the runtime's own text there
  is Poppins and held back until loaded, so it is not that. Modern Minimal's
  loading motif is an SVG image (like Vintage Love Story's; the rest are PNG):
  lettering inside an SVG image cannot use web fonts, and Windows substitutes
  Comic Sans for a script face. Needs the file (ac1909d1-...svg) to confirm.

- Modern Minimal opening at #accommodations: the MP-901 empty-section rule
  re-showed ANY hidden section on the page with an empty box - including
  Modern Minimal's #accommodations, a heading-less placeholder the design
  always hides - so a blank band appeared above The Main Event, and an address
  ending in #accommodations (left by the old, dead Travel link) landed on it.
  A hidden element with no heading is never re-shown now; and an address
  ending in a section the page does not show opens at the top, the #... dropped.
- MP-932, re-opened: the registry page used the copy of the site data left in
  the browser tab and never fetched again, so fonts changed after visiting the
  site stayed old on the registry for the session. It paints from the copy,
  then always fetches the current data and applies it.
- MP-933, as tested (Pressed Petals' thumbnail): its thumbnail-only rule fixes
  the hero's height; with the phone rules' 5/4 aspect-ratio beside it, the
  browser narrowed the hero to 230px of 276 - the pale strip on the right.
  The ratio steps aside in thumbnail mode; full width on every thumbnail.

- MP-958 (High): one Travel card left travel_info empty after the cut, and an
  old rule hid #travel-section whenever travel_info was empty - on Vintage
  Love Story (and Modern Minimal) that section holds the hotels too, so typed
  Travel never appeared. The empty half is now hidden only while the other
  half has words, and never an element holding them. (Map: Modern Minimal's
  Travel is now measured in the one-card sample - the intended change.)
- Empty Travel box, one rule on all ten: one heading at most (no doubled
  Travel / Accommodations), the design's own Book Now if a link is set (alone
  where the design has no heading), and the separator between hotel and
  flights only when two cards show (Pressed Petals' .accom-pair divider).
- MP-919: the preview put the template's sample booking link back after an
  empty save (a cleared field reads like a never-set one). No sample link now.
- MP-357: the registry page read Site Background and Accent the wrong way round.
- MP-962: Body Text (eight designs) and Section Headings (Regal Boho) moved the
  menu font; the menu keeps its design face unless Menu Links is set.
- MP-947 / MP-952: Gallery headings follow Section Headings on all ten.
- MP-942: Golden Hour's Travel photos take photographs not in its three-column
  hero first; the second photo repeats before the main one.
- MP-936: iPhone auto-linking of dates/addresses/phones off on all ten.

- MP-959: deleting a Travel card could leave the card count the same while
  every mark and its "Hotel card" / "Travel card" label belonged to a
  different line. Marks are redrawn whenever they no longer sit on the cards'
  first lines or carry the wrong label.
- MP-964: U counted a link's own underline as the couple's, so it lit on every
  link and pressing it tried to remove it (nothing in Chrome; the link lost in
  Firefox). U on linked words now adds/removes the couple's own <u> by hand,
  never touching the link; the Link button lights when the cursor is in one.
- MP-960: the font and size menus are fixed where they open, so scrolling the
  editor floated them off their buttons. Any scroll outside a menu closes it;
  scrolling a list to its end no longer scrolls the page.
- MP-963: "X of X left" sits on one line across a row of gifts (price and count
  go to the bottom with the button) - aligned on all ten.
- MP-910, as tested: the registry description (all but three designs) and the
  Book Now label on Heirloom Bloom and Sage & Still kept fixed colours. They
  follow the panel once a colour is chosen (Text on light bands, Text 2 on
  dark ones, keeping the design's transparency).

- MP-937, from the screenshot: the font size box was a fixed 88px on phones,
  sized for 11px text; with iPhone fields at 16px (to stop Safari zooming in -
  the MP-052 approach) "Very large" was cut to "Very lar". The box now sizes to
  its longest option, and is 16px on phones by design.
- MP-961, from the screenshot: Whimsical Romance's hero photo kept square
  corners inside its rounded frame until a repaint - the WebKit case where a
  rounded overflow:hidden box does not clip a child on its own layer. The
  frame now carries the standard mask that makes Safari clip from the first
  paint. No visible change in Chromium; needs an iPhone/iPad check.

- MP-958, as tested: Vintage Love Story headed the couple's Travel columns
  with its own "Hotels" / "Airports", and Regal Boho with "Hotel" / "Airports"
  (plus a rule under each) - labels nobody typed; a card titled "Hotels" showed
  the word twice. Both removed; the couple's card titles head the columns.
  Checked all ten: no other design invents a Travel label.

- MP-952, decided: the couple's names follow Section Headings. Measured on all
  ten - eight already did; Whimsical Romance now does too (Corben until a font
  is chosen; its script "and" keeps its own face). Heirloom Bloom's hero shows
  the couple's INITIALS as a monogram, which do not follow (its footer names
  do) - awaiting a decision.

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
