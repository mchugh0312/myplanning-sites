# Step 1 findings: what the map settles

Companion to `EDITOR-TYPOGRAPHY-PLAN.md`. Everything below was measured
(method in `harness/README.md`). Per-template detail is in `TEMPLATE-MAP.md`;
the gate reads `template-map.json`. No code was changed.


## The questions Step 1 was expected to settle

**Is there a real menu font variable anywhere?** No. No template has a variable
used by the menu alone.

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
in `fixes/` (diff: `fixes/content-loss-fixes.diff`), each verified in the
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
