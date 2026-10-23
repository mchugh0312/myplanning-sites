# Template map

Generated from `template-map.json` by `render_md.py`. Do not edit by hand; rerun the harness.

Every fact here was measured in a rendered page, not read from a hand-written list. Fonts and colours: each `:root` variable was set to a sentinel value and the visible text that changed was recorded. Formatting: marked words were injected into each field and checked on the page. Payloads are shaped the way the editor sends them (`events` carry id and name only; `accommodation_info` is empty and the runtime cuts the Travel box). Chromium, desktop 1280px and mobile 390px, transitions disabled, resting state only (no hover, focus, or later RSVP steps).

Role words used below: **section heading** (e.g. "Our Story"), **block title** (first line of an event, question, or hotel/flights card), **italic line** (a line wholly in `<em>`, e.g. a dress code), **body** (everything else in a section).

Formatting key: ✓ shows on the page, = invisible because the text already had it, ✗ lost, ∅ the text never appeared.


## Black Tie Timeless (`blacktietimeless`)

### Fonts

| Variable | Face | Paints |
|---|---|---|
| `--menu-font` | Goudy | menu |
| `--script` | Ballet | section heading: faqs, rsvp, story, things_to_do; block title: other_events, travel, wedding; body: travel; italic line: wedding; menu |
| `--serif` | Goudy | block title: faqs; body: faqs, other_events, rsvp, story, things_to_do, travel, wedding; italic line: other_events; menu |

Headings control writes `--script`, which reaches: section heading: faqs, rsvp, story, things_to_do; block title: other_events, travel, wedding; body: travel; italic line: wedding; menu.  
Body control writes `--serif`, which reaches: block title: faqs; body: faqs, other_events, rsvp, story, things_to_do, travel, wedding; italic line: other_events; menu.  
Menu Links writes `--menu-font`. The menu is set in `--menu-font, --serif` on desktop and `--menu-font, --serif` on mobile. Own menu variable: yes. Menu Links reaches the menu: desktop **yes**, mobile **yes**.

Font variables the runtime config does not know: `--menu-font`.

### Colour slots

| Control | Variable | Text it colours | Backgrounds it paints | Other paint at rest (borders, buttons, inputs) |
|---|---|---|---|---|
| Site Background | `--offwhite` | - | home, nav, other_events, rsvp, story | backgroundColor |
| Accent Color | `--black` | - | faqs, footer, things_to_do, travel, wedding | backgroundColor |
| Text1 | `--ink` | section heading: rsvp, story; block title: other_events, travel; body: other_events, rsvp, story, travel; italic line: other_events; menu | - | borderBottomColor, borderLeftColor, borderTopColor, outlineColor, textDecorationColor |
| Text2 | `--on-dark`, `--on-dark-copy` | section heading: faqs, things_to_do; block title: faqs, wedding; body: faqs, things_to_do, wedding; italic line: wedding | - | borderBottomColor, borderLeftColor, borderTopColor, outlineColor, textDecorationColor |
| Text3 | `--ink3` | - | - | borderBottomColor, borderLeftColor, borderTopColor, outlineColor, textDecorationColor |
| Highlight Color | `--white` | - | - | backgroundColor |

### Block titles: Content box vs page

| Field | First line | Page | Box shows |
|---|---|---|---|
| weddings_info | The Ceremony | Ballet 400 (`div.wedding-card-name`) | Ballet 400 |
| weddings_info | The Reception | Ballet 400 (`div.wedding-card-name`) | Ballet 400 |
| events_info | Welcome Cocktails | Ballet 400 (`div.other-event-name`) | Ballet 400 |
| faqs | What should I wear? | Goudy 700 (`div.ntk-question`) | Goudy 700 |
| faqs | Will there be transportation | Goudy 700 (`div.ntk-question`) | Goudy 700 |
| travel_info | Hyatt Regency La Jolla At Av | Ballet 400 (`div.arch-card-label`) | (heading face) |
| travel_info | The nearest airport is San D | Ballet 400 (`div.arch-card-label`) | (heading face) |

Wholly italic lines (dress codes, notes):

- weddings_info "Cocktail Attire": page shows Ballet normal via `.wedding-card-detail :is(em, i).mp-attire`
- events_info "Evening Casual": page shows Goudy italic

### CSS that restyles the couple's own tags

- `i).mp-attire` → font-family: var(--script); font-style: normal

### Defaults imposed on body copy (must stay overridable)

- other_events `em.mp-attire`: italic
- faqs `div.ntk-answer`: italic (`.ntk-answer`)
- things_to_do `div#thingsToDoText`: italic (`.ntk-answer`)

### Formatting survival

| Field | Title b i u font | Body b i u font | Whole box italic | Whole box underline | Whole box font |
|---|---|---|---|---|---|
| weddings_info | ✓ ✓ ✓ ✓ | ✓ ✓ ✓ ✓ | ✓ ✓ ✓ ✓ | ✓ ✓ ✓ ✓ | ✓ ✓ ✓ ✓ |
| events_info | ✓ ✓ ✓ ✓ | ✓ ✓ ✓ ✓ | ✓ ✓ ✓ ✓ | ✓ ✓ ✓ ✓ | ✓ ✓ ✓ ✓ |
| faqs | ✓ ✓ ✓ ✓ | ✓ = ✓ ✓ | ✓ = ✓ = | ✓ ✓ ✓ ✓ | ✓ ✓ ✓ ✓ |
| travel_info | ✓ ✓ ✓ ✓ | ✓ ✓ ✓ ✓ | ✓ ✓ ✓ ✓ | ✓ ✓ ✓ ✓ | ✓ ✓ ✓ ✓ |
| story | ✓ ✓ ✓ ✓ | ✓ ✓ ✓ ✓ | ✓ ✓ ✓ ✓ | ✓ ✓ ✓ ✓ | ✓ ✓ ✓ ✓ |
| things_to_do | ✓ = ✓ ✓ | ✓ = ✓ ✓ | = = = = | ✓ ✓ ✓ ✓ | ✓ ✓ ✓ ✓ |

### Sections

Shipped with `display:none` until hydrated: `#our-story`, `#events-primary`, `#other-events`, `#travel-section`, `#need-to-know`, `#things-to-do`, `#gallery`, `#registry-section`, `#rsvp`.
Visibility: every section hides with its toggle off and (except Registry, by design) when its box is emptied.

## Coastal Chic (`coastalchic`)

### Fonts

| Variable | Face | Paints |
|---|---|---|
| `--menu-font` | Lexend Deca | menu |
| `--script` | La Belle Aurore | - |
| `--body` | Lexend Deca | section heading: faqs, registry, rsvp, things_to_do, travel, wedding; block title: faqs, travel, wedding; body: faqs, registry, rsvp, things_to_do, travel, wedding; italic line: travel; menu |

Headings control writes `--script`, which reaches: -.  
Body control writes `--body`, which reaches: section heading: faqs, registry, rsvp, things_to_do, travel, wedding; block title: faqs, travel, wedding; body: faqs, registry, rsvp, things_to_do, travel, wedding; italic line: travel; menu.  
Menu Links writes `--menu-font`. The menu is set in `--body, --menu-font` on desktop and `--body, --menu-font` on mobile. Own menu variable: yes. Menu Links reaches the menu: desktop **yes**, mobile **yes**.

Section headings the Headings control does not reach: faqs (Lexend Deca), registry (Lexend Deca), rsvp (Lexend Deca), things_to_do (Lexend Deca), travel (Lexend Deca), wedding (Lexend Deca).

Font variables the runtime config does not know: `--menu-font`.

### Colour slots

| Control | Variable | Text it colours | Backgrounds it paints | Other paint at rest (borders, buttons, inputs) |
|---|---|---|---|---|
| Site Background | `--ivory` | - | registry, travel | backgroundColor |
| Accent Color | `--navy` | - | faqs, nav, registry, rsvp, things_to_do, wedding | backgroundColor |
| Text1 | `--ink` | section heading: registry, travel; block title: travel; body: registry, travel | - | borderBottomColor, borderLeftColor, borderTopColor, outlineColor, textDecorationColor |
| Text2 | `--on-dark` | section heading: faqs, rsvp, things_to_do, wedding; block title: faqs, wedding; body: faqs, registry, rsvp, things_to_do, wedding; menu | - | borderBottomColor, borderLeftColor, borderTopColor, outlineColor, textDecorationColor |
| Text3 | `--ink3` | italic line: travel | - | backgroundColor, borderBottomColor, borderLeftColor, borderTopColor, outlineColor, textDecorationColor |
| Highlight Color **(nothing visible at rest)** | `--white` | - | - | - |

### Block titles: Content box vs page

| Field | First line | Page | Box shows |
|---|---|---|---|
| weddings_info | Wedding | Lexend Deca 700 uppercase (`div.schedule-event-name`) | Lexend Deca 700 |
| events_info | Welcome Drinks | Lexend Deca 700 uppercase (`div.schedule-event-name`) | Lexend Deca 700 |
| events_info | Beach Day | Lexend Deca 700 uppercase (`div.schedule-event-name`) | Lexend Deca 700 |
| faqs | What should I wear to the we | Lexend Deca 500 (`span.faq-q-text`) | Lexend Deca 500 |
| faqs | Will there be transportation | Lexend Deca 500 (`span.faq-q-text`) | Lexend Deca 500 |
| travel_info | AIRPORT | Lexend Deca 700 uppercase (`div.travel-block-label`) | Lexend Deca 600 |
| travel_info | HOTEL | Lexend Deca 700 uppercase (`div.travel-block-label`) | Lexend Deca 600 |

Wholly italic lines (dress codes, notes):

- travel_info "*Request the Liz & Nic r": page shows Lexend Deca italic via `.travel-note`

### CSS that restyles the couple's own tags

- `strong)` → font-weight: 600

### Defaults imposed on body copy (must stay overridable)

- travel `div.travel-block-detail`: weight 300 (`.travel-block-detail`)
- travel `div.travel-note`: italic, weight 300 (`.travel-note`)
- faqs `div.faq-answer`: weight 300 (`.faq-answer`)
- things_to_do `div#thingsToDoText`: weight 300 (`.faq-answer`)
- registry `div#registryInfo`: weight 300 (`.registry-info`)
- registry `a#registryBtn`: weight 600, uppercase (`.registry-btn`)
- rsvp `span.mp-rsvp-hint`: weight 300

### Formatting survival

| Field | Title b i u font | Body b i u font | Whole box italic | Whole box underline | Whole box font |
|---|---|---|---|---|---|
| weddings_info | ✓ ✓ ✓ ✓ | ✓ ✓ ✓ ✓ | ✓ ✓ ✓ ✓ | ✓ ✓ ✓ ✓ | ✓ ✓ ✓ ✓ |
| events_info | ✓ ✓ ✓ ✓ | ✓ ✓ ✓ ✓ | ✓ ✓ ✓ ✓ | ✓ ✓ ✓ ✓ | ✓ ✓ ✓ ✓ |
| faqs | ✓ ✓ ✓ ✓ | ✓ ✓ ✓ ✓ | ✓ ✓ ✓ ✓ | ✓ ✓ ✓ ✓ | ✓ ✓ ✓ ✓ |
| travel_info | ✓ ✓ ✓ ✓ | ✓ ✓ ✓ ✓ | ✓ ✓ ✓ ✓ | ✓ ✓ ✓ ✓ | ✓ ✓ ✓ ✓ |
| story | ✓ ✓ ✓ ✓ | ✓ ✓ ✓ ✓ | ✓ ✓ ✓ ✓ | ✓ ✓ ✓ ✓ | ✓ ✓ ✓ ✓ |
| things_to_do | ✓ ✓ ✓ ✓ | ✓ ✓ ✓ ✓ | ✓ ✓ ✓ ✓ | ✓ ✓ ✓ ✓ | ✓ ✓ ✓ ✓ |

### Sections

Shipped with `display:none` until hydrated: `#our-story`, `#accommodations`, `#things-to-do`, `#gallery`.
Visibility: every section hides with its toggle off and (except Registry, by design) when its box is emptied.

### Mobile only

- nav: color rgb(254, 250, 241) → rgb(27, 42, 65)
- nav: bg rgb(27, 42, 65) → rgb(254, 250, 241)
- nav: weight 500 → 400

## Golden Hour (`goldenhour`)

### Fonts

| Variable | Face | Paints |
|---|---|---|
| `--menu-font` | EB Garamond | menu |
| `--script` | La Belle Aurore | section heading: faqs, registry, rsvp, story, things_to_do; block title: accommodations, other_events, wedding; body: travel; italic line: other_events, wedding |
| `--serif` | EB Garamond | block title: faqs; body: accommodations, faqs, other_events, rsvp, story, things_to_do, travel, wedding; menu |

Headings control writes `--script`, which reaches: section heading: faqs, registry, rsvp, story, things_to_do; block title: accommodations, other_events, wedding; body: travel; italic line: other_events, wedding.  
Body control writes `--serif`, which reaches: block title: faqs; body: accommodations, faqs, other_events, rsvp, story, things_to_do, travel, wedding; menu.  
Menu Links writes `--menu-font`. The menu is set in `--menu-font, --serif` on desktop and `--menu-font, --serif` on mobile. Own menu variable: yes. Menu Links reaches the menu: desktop **yes**, mobile **yes**.

Font variables the runtime config does not know: `--menu-font`.

### Colour slots

| Control | Variable | Text it colours | Backgrounds it paints | Other paint at rest (borders, buttons, inputs) |
|---|---|---|---|---|
| Site Background | `--white` | - | accommodations, home, nav, registry, travel | backgroundColor |
| Accent Color | `--blue` | - | faqs, nav, other_events, rsvp, story, things_to_do, wedding | backgroundColor |
| Text1 | `--ink` | section heading: registry; block title: accommodations; body: accommodations, travel; menu | - | borderBottomColor, borderLeftColor, borderTopColor, outlineColor, textDecorationColor |
| Text2 | `--on-dark` | section heading: faqs, rsvp, story, things_to_do; block title: faqs, other_events, wedding; body: accommodations, faqs, other_events, rsvp, story, things_to_do, travel, wedding; italic line: other_events, wedding; menu | - | borderBottomColor, borderLeftColor, borderTopColor, outlineColor, textDecorationColor |
| Text3 **(nothing visible at rest)** | `--ink3` | - | - | - |
| Highlight Color | `--dark` | - | accommodations, footer, travel | backgroundColor, borderBottomColor, borderLeftColor, borderTopColor |

### Block titles: Content box vs page

| Field | First line | Page | Box shows |
|---|---|---|---|
| weddings_info | Alice Dalton and Conrad Brow | **not a title on the page** | La Belle Aurore 400 |
| weddings_info | The Ceremony | La Belle Aurore 400 (`div.wedding-card-name`) | La Belle Aurore 400 |
| events_info | Welcome Cocktails | La Belle Aurore 400 (`div.event-name`) | La Belle Aurore 400 |
| faqs | What should I wear to the we | EB Garamond 400 (`div.ntk-question`) | EB Garamond 400 |
| faqs | Will there be transportation | EB Garamond 400 (`div.ntk-question`) | EB Garamond 400 |
| travel_info | Hotel | La Belle Aurore 400 (`div.split-label`) | La Belle Aurore 400 |
| travel_info | San Diego National Airport.  | La Belle Aurore 400 (`div.split-label`) | La Belle Aurore 400 |

Wholly italic lines (dress codes, notes):

- events_info "Evening Casual": page shows La Belle Aurore normal via `.event-detail :is(em, i).mp-attire`

### CSS that restyles the couple's own tags

- `.wedding-invite em` → font-family: var(--script); font-style: normal
- `.wedding-invite i` → font-family: var(--script); font-style: normal
- `i).mp-attire` → font-family: var(--script); font-style: normal
- `i).mp-attire` → font-family: var(--script); font-style: normal

### Defaults imposed on body copy (must stay overridable)

- accommodations `div.split-name`: weight 600 (`.split-name`)
- faqs `div.ntk-answer`: italic (`.ntk-answer`)
- things_to_do `div#thingsToDoText`: italic (`.ntk-answer`)

### Formatting survival

| Field | Title b i u font | Body b i u font | Whole box italic | Whole box underline | Whole box font |
|---|---|---|---|---|---|
| weddings_info | ✓ ✓ ✓ ✓ | ✓ ✓ ✓ ✓ | ✓ ✓ ✓ ✓ | ✓ ✓ ✓ ✓ | ✓ ✓ ✓ ✓ |
| events_info | ✓ ✓ ✓ ✓ | ✓ ✓ ✓ ✓ | ✓ ✓ ✓ ✓ | ✓ ✓ ✓ ✓ | ✓ ✓ ✓ ✓ |
| faqs | ✓ ✓ ✓ ✓ | ✓ = ✓ ✓ | ✓ = ✓ = | ✓ ✓ ✓ ✓ | ✓ ✓ ✓ ✓ |
| travel_info | ✓ ✓ ✓ ✓ | ✓ ✓ ✓ ✓ | ✓ ✓ ✓ ✓ | ✓ ✓ ✓ ✓ | ✓ ✓ ✓ ✓ |
| story | ✓ ✓ ✓ ✓ | ✓ ✓ ✓ ✓ | ✓ ✓ ✓ ✓ | ✓ ✓ ✓ ✓ | ✓ ✓ ✓ ✓ |
| things_to_do | ✓ = ✓ ✓ | ✓ = ✓ ✓ | = = = = | ✓ ✓ ✓ ✓ | ✓ ✓ ✓ ✓ |

### Sections

Shipped with `display:none` until hydrated: `#story`, `#wedding`, `#events`, `#accommodations`, `#travel`, `#ntk`, `#things-to-do`, `#gallery`, `#registry`, `#rsvp`.
Visibility: every section hides with its toggle off and (except Registry, by design) when its box is emptied.

## Heirloom Bloom (`heirloombloom`)

### Fonts

| Variable | Face | Paints |
|---|---|---|
| `--menu-font` | Lancelot | menu |
| `--script` | Luxurious Script | section heading: faqs, registry, rsvp, story, things_to_do; block title: accommodations, other_events, wedding; body: accommodations; italic line: other_events, wedding |
| `--serif` | Lancelot | block title: faqs; body: accommodations, faqs, other_events, rsvp, story, things_to_do, wedding; menu |

Headings control writes `--script`, which reaches: section heading: faqs, registry, rsvp, story, things_to_do; block title: accommodations, other_events, wedding; body: accommodations; italic line: other_events, wedding.  
Body control writes `--serif`, which reaches: block title: faqs; body: accommodations, faqs, other_events, rsvp, story, things_to_do, wedding; menu.  
Menu Links writes `--menu-font`. The menu is set in `--menu-font, --serif` on desktop and `--menu-font, --serif` on mobile. Own menu variable: yes. Menu Links reaches the menu: desktop **yes**, mobile **yes**.

Font variables the runtime config does not know: `--menu-font`.

### Colour slots

| Control | Variable | Text it colours | Backgrounds it paints | Other paint at rest (borders, buttons, inputs) |
|---|---|---|---|---|
| Site Background | `--offwhite` | - | accommodations, faqs, home, nav, things_to_do, wedding | backgroundColor |
| Accent Color | `--berry` | - | footer, other_events | backgroundColor |
| Text1 | `--ink` | section heading: faqs, registry, story, things_to_do; block title: accommodations, faqs, wedding; body: accommodations, faqs, story, things_to_do, wedding; italic line: wedding; menu | - | borderBottomColor, borderLeftColor, borderTopColor, outlineColor, textDecorationColor |
| Text2 | `--on-dark` | section heading: rsvp; block title: other_events; body: other_events, rsvp; italic line: other_events | - | backgroundColor, borderBottomColor, borderLeftColor, borderTopColor, outlineColor, textDecorationColor |
| Text3 | `--ink3` | - | - | borderBottomColor, borderLeftColor, borderTopColor, outlineColor, textDecorationColor |
| Highlight Color | `--gold` | - | registry, story | backgroundColor |
| Additional Color | `--gray` | - | rsvp | backgroundColor |

### Block titles: Content box vs page

| Field | First line | Page | Box shows |
|---|---|---|---|
| weddings_info | The Ceremony | Luxurious Script 400 (`div.wedding-card-name`) | Luxurious Script 400 |
| weddings_info | The Reception | Luxurious Script 400 (`div.wedding-card-name`) | Luxurious Script 400 |
| events_info | Welcome Cocktails | Luxurious Script 400 (`div.other-event-name`) | Luxurious Script 400 |
| faqs | What should I wear to the we | Lancelot 400 (`div.ntk-question`) | Lancelot 400 |
| faqs | Will there be transportation | Lancelot 400 (`div.ntk-question`) | Lancelot 400 |
| travel_info | Estancia La Jolla Hotel & Sp | Luxurious Script 400 (`div.accom-col-title`) | Luxurious Script 400 |
| travel_info | The nearest airport is San D | Luxurious Script 400 (`div.accom-col-title`) | Luxurious Script 400 |

Wholly italic lines (dress codes, notes):

- weddings_info "Cocktail Attire": page shows Luxurious Script normal via `.wedding-card-detail :is(em, i).mp-attire`
- events_info "Evening Casual": page shows Luxurious Script normal via `.other-event-detail :is(em, i).mp-attire`

### CSS that restyles the couple's own tags

- `i).mp-attire` → font-family: var(--script); font-style: normal
- `i).mp-attire` → font-family: var(--script); font-style: normal

### Formatting survival

| Field | Title b i u font | Body b i u font | Whole box italic | Whole box underline | Whole box font |
|---|---|---|---|---|---|
| weddings_info | ✓ ✓ ✓ ✓ | ✓ ✓ ✓ ✓ | ✓ ✓ ✓ ✓ | ✓ ✓ ✓ ✓ | ✓ ✓ ✓ ✓ |
| events_info | ✓ ✓ ✓ ✓ | ✓ ✓ ✓ ✓ | ✓ ✓ ✓ ✓ | ✓ ✓ ✓ ✓ | ✓ ✓ ✓ ✓ |
| faqs | ✓ ✓ ✓ ✓ | ✓ ✓ ✓ ✓ | ✓ ✓ ✓ ✓ | ✓ ✓ ✓ ✓ | ✓ ✓ ✓ ✓ |
| travel_info | ✓ ✓ ✓ ✓ | ✓ ✓ ✓ ✓ | ✓ ✓ ✓ ✓ | ✓ ✓ ✓ ✓ | ✓ ✓ ✓ ✓ |
| story | ✓ ✓ ✓ ✓ | ✓ ✓ ✓ ✓ | ✓ ✓ ✓ ✓ | ✓ ✓ ✓ ✓ | ✓ ✓ ✓ ✓ |
| things_to_do | ✓ ✓ ✓ ✓ | ✓ ✓ ✓ ✓ | ✓ ✓ ✓ ✓ | ✓ ✓ ✓ ✓ | ✓ ✓ ✓ ✓ |

### Sections

Shipped with `display:none` until hydrated: `#story`, `#wedding`, `#events`, `#accommodations`, `#ntk`, `#things-to-do`, `#gallery`, `#registry`, `#rsvp`.
Visibility: every section hides with its toggle off and (except Registry, by design) when its box is emptied.

## Modern Minimal (`modernminimal`)

### Fonts

| Variable | Face | Paints |
|---|---|---|
| `--menu-font` | Poppins | menu |
| `--heading` | DIN Next Condensed | section heading: faqs, other_events, registry, rsvp, things_to_do, wedding; block title: other_events, wedding |
| `--body` | Poppins | block title: faqs, other_events, wedding; body: faqs, other_events, rsvp, things_to_do, wedding; menu |

Headings control writes `--body`, which reaches: block title: faqs, other_events, wedding; body: faqs, other_events, rsvp, things_to_do, wedding; menu.  
Body control writes `--body`, which reaches: block title: faqs, other_events, wedding; body: faqs, other_events, rsvp, things_to_do, wedding; menu.  
Menu Links writes `--menu-font`. The menu is set in `--body, --menu-font` on desktop and `--body, --menu-font` on mobile. Own menu variable: yes. Menu Links reaches the menu: desktop **yes**, mobile **yes**.

Section headings the Headings control does not reach: faqs (DIN Next Condensed), other_events (DIN Next Condensed), registry (DIN Next Condensed), rsvp (DIN Next Condensed), things_to_do (DIN Next Condensed), wedding (DIN Next Condensed).

Font variables the runtime config does not know: `--menu-font`, `--heading`.

### Colour slots

| Control | Variable | Text it colours | Backgrounds it paints | Other paint at rest (borders, buttons, inputs) |
|---|---|---|---|---|
| Site Background | `--ivory` | - | faqs, home, nav, other_events, registry, things_to_do, wedding | backgroundColor |
| Accent Color | `--black` | - | - | borderBottomColor, borderLeftColor, borderTopColor |
| Text1 | `--ink` | section heading: faqs, other_events, registry, things_to_do, wedding; block title: faqs, other_events, wedding; body: faqs, other_events, things_to_do, wedding; menu | - | borderBottomColor, borderLeftColor, borderTopColor, outlineColor, textDecorationColor |
| Text2 | `--on-dark` | section heading: rsvp; body: rsvp | - | borderBottomColor, borderLeftColor, borderTopColor, outlineColor, textDecorationColor |
| Text3 **(nothing visible at rest)** | `--ink3` | - | - | - |
| Highlight Color | `--blue` | - | rsvp | backgroundColor |
| Additional Color | `--white` | - | - | backgroundColor |

### Block titles: Content box vs page

| Field | First line | Page | Box shows |
|---|---|---|---|
| weddings_info | Ceremony | DIN Next Condensed 700 (`div.event-name`) | DIN Next Condensed 700 |
| weddings_info | Reception | DIN Next Condensed 700 (`div.event-name`) | DIN Next Condensed 700 |
| events_info | Welcome Party | DIN Next Condensed 700 (`mp-title`) | DIN Next Condensed 700 |
| events_info | Vault 27 | DIN Next Condensed 700 (`mp-title`) | DIN Next Condensed 700 |
| faqs | What should I wear to the we | Poppins 700 (`span.faq-q-text`) | Poppins 700 |
| faqs | Will there be transportation | Poppins 700 (`span.faq-q-text`) | Poppins 700 |
| travel_info | The Penny Hotel Williamsburg | **not a title on the page** | DIN Next Condensed 600 |

Wholly italic lines (dress codes, notes):

- weddings_info "Dress Code Suggestion: C": page shows Poppins italic
- events_info "Dress Code Suggestion: C": page shows Poppins italic

### CSS that restyles the couple's own tags

- `.event-dress strong` → font-weight: 600; font-style: italic
- `.travel-content > strong:first-child` → display: block; font-family: var(--heading); font-weight: 600
- `.travel-content strong` → font-weight: 700; display: block
- `.travel-content em` → font-style: italic

### Defaults imposed on body copy (must stay overridable)

- wedding `strong`: weight 700
- other_events `em`: italic
- faqs `div.faq-answer`: italic (`.faq-answer`)
- things_to_do `div#thingsToDoText`: italic (`.faq-answer`)
- rsvp `span.mp-rsvp-hint`: weight 600

### Formatting survival

| Field | Title b i u font | Body b i u font | Whole box italic | Whole box underline | Whole box font |
|---|---|---|---|---|---|
| weddings_info | ✓ ✓ ✓ ✓ | ✓ ✓ ✓ ✓ | ✓ ✓ ✓ ✓ | ✓ ✓ ✓ ✓ | ✓ ✓ ✓ ✓ |
| events_info | ✓ ✓ ✓ ✓ | ✓ ✓ ✓ ✓ | ✓ ✓ ✓ ✓ | ✓ ✓ ✓ ✓ | ✓ ✓ ✓ ✓ |
| faqs | ✓ ✓ ✓ ✓ | ✓ = ✓ ✓ | ✓ = ✓ = | ✓ ✓ ✓ ✓ | ✓ ✓ ✓ ✓ |
| travel_info | ✓ ✓ ✓ ✓ | ✓ ✓ ✓ ✓ | ✓ ✓ ✓ ✓ | ✓ ✓ ✓ ✓ | ✓ ✓ ✓ ✓ |
| story | ✗ ✗ ✗ ✗ | ✗ ✗ ✗ ✗ | ✗ ✗ ✗ ✗ | ✗ ✗ ✗ ✗ | ✗ ✗ ✗ ✗ |
| things_to_do | ✓ = ✓ ✓ | ✓ = ✓ ✓ | = = = = | ✓ ✓ ✓ ✓ | ✓ ✓ ✓ ✓ |

### Sections

Shipped with `display:none` until hydrated: `#our-story`, `#accommodations`, `#things-to-do`, `#gallery`.
Visibility: every section hides with its toggle off and (except Registry, by design) when its box is emptied.

### Mobile only

- nav: color rgb(0, 0, 0) → rgb(255, 253, 245)
- nav: bg rgb(255, 253, 245) → rgb(0, 74, 173)
- nav: weight 500 → 400

## Pressed Petals (`pressedpetals`)

### Fonts

| Variable | Face | Paints |
|---|---|---|
| `--menu-font` | Instrument Serif | menu |
| `--script` | Pinyon Script | section heading: faqs, registry, rsvp, story, things_to_do; block title: accommodations, other_events, travel, wedding; italic line: wedding |
| `--serif` | Instrument Serif | block title: faqs; body: accommodations, faqs, other_events, rsvp, story, things_to_do, travel, wedding; menu |

Headings control writes `--script`, which reaches: section heading: faqs, registry, rsvp, story, things_to_do; block title: accommodations, other_events, travel, wedding; italic line: wedding.  
Body control writes `--serif`, which reaches: block title: faqs; body: accommodations, faqs, other_events, rsvp, story, things_to_do, travel, wedding; menu.  
Menu Links writes `--menu-font`. The menu is set in `--menu-font, --serif` on desktop and `--menu-font, --serif` on mobile. Own menu variable: yes. Menu Links reaches the menu: desktop **yes**, mobile **yes**.

Font variables the runtime config does not know: `--menu-font`.

### Colour slots

| Control | Variable | Text it colours | Backgrounds it paints | Other paint at rest (borders, buttons, inputs) |
|---|---|---|---|---|
| Site Background | `--offwhite` | - | faqs, home, nav, other_events, rsvp, story, things_to_do | backgroundColor |
| Accent Color | `--olive` | - | accommodations, footer, registry, travel, wedding | backgroundColor |
| Text1 | `--ink` | section heading: rsvp, story, things_to_do; block title: faqs, other_events; body: faqs, other_events, story, things_to_do; menu | - | backgroundColor, borderBottomColor, borderLeftColor, borderTopColor, outlineColor, textDecorationColor |
| Text2 | `--on-dark` | section heading: faqs, registry; block title: accommodations, travel, wedding; body: accommodations, travel, wedding; italic line: wedding | - | borderBottomColor, borderLeftColor, borderTopColor, outlineColor, textDecorationColor |
| Text3 | `--ink3` | body: faqs, rsvp | - | borderBottomColor, borderLeftColor, borderTopColor, outlineColor, textDecorationColor |
| Highlight Color | `--white` | - | - | backgroundColor |

### Block titles: Content box vs page

| Field | First line | Page | Box shows |
|---|---|---|---|
| weddings_info | The Ceremony | Pinyon Script 500 (`div.event-card-name`) | Pinyon Script 500 |
| weddings_info | The Reception | Pinyon Script 500 (`div.event-card-name`) | Pinyon Script 500 |
| events_info | Welcome Cocktails | Pinyon Script 500 (`div.event-card-name`) | Pinyon Script 500 |
| faqs | What should I wear? | Instrument Serif 400 (`span.faq-q-text`) | Instrument Serif 400 |
| faqs | Will there be transportation | Instrument Serif 400 (`span.faq-q-text`) | Instrument Serif 400 |
| travel_info | Hotel | Pinyon Script 500 (`div.accom-col-title`) | Pinyon Script 500 |
| travel_info | Flights | Pinyon Script 500 (`div.accom-col-title`) | Pinyon Script 500 |

Wholly italic lines (dress codes, notes):

- weddings_info "Cocktail Attire": page shows Pinyon Script normal via `.event-card-detail :is(em, i).mp-attire`

### CSS that restyles the couple's own tags

- `i).mp-attire` → font-family: var(--script); font-style: normal

### Defaults imposed on body copy (must stay overridable)

- story `p#storyText`: italic (`.story-text`)
- wedding `em.mp-attire`: face Pinyon Script (`.event-card-detail :is(em, i).mp-attire`)
- accommodations `div.accom-address`: italic (`.accom-address`)
- travel `div.accom-address`: italic (`.accom-address`)
- faqs `span.faq-icon`: face Arial
- faqs `div.faq-answer`: italic (`.faq-answer`)
- rsvp `span.mp-rsvp-hint`: italic

### Formatting survival

| Field | Title b i u font | Body b i u font | Whole box italic | Whole box underline | Whole box font |
|---|---|---|---|---|---|
| weddings_info | ✓ ✓ ✓ ✓ | ✓ ✓ ✓ ✓ | ✓ ✓ ✓ ✓ | ✓ ✓ ✓ ✓ | ✓ ✓ ✓ ✓ |
| events_info | ✓ ✓ ✓ ✓ | ✓ ✓ ✓ ✓ | ✓ ✓ ✓ ✓ | ✓ ✓ ✓ ✓ | ✓ ✓ ✓ ✓ |
| faqs | ✓ ✓ ✓ ✓ | ✓ = ✓ ✓ | ✓ = ✓ = | ✓ ✓ ✓ ✓ | ✓ ✓ ✓ ✓ |
| travel_info | ✓ = ✓ ✓ | ✓ = ✓ ✓ | ✓ = ✓ = | ✓ ✓ ✓ ✓ | ✓ ✓ ✓ ✓ |
| story | ✓ = ✓ ✓ | ✓ = ✓ ✓ | = = = = | ✓ ✓ ✓ ✓ | ✓ ✓ ✓ ✓ |
| things_to_do | ✓ ✓ ✓ ✓ | ✓ ✓ ✓ ✓ | ✓ ✓ ✓ ✓ | ✓ ✓ ✓ ✓ | ✓ ✓ ✓ ✓ |

### Sections

Shipped with `display:none` until hydrated: `#our-story`, `#things-to-do`, `#gallery`, `#registry-section`.
Visibility: every section hides with its toggle off and (except Registry, by design) when its box is emptied.

## Regal Boho (`regalboho`)

### Fonts

| Variable | Face | Paints |
|---|---|---|
| `--menu-font` | Libre Baskerville | menu |
| `--display` | Libre Baskerville | section heading: faqs, registry, rsvp, story, things_to_do, travel, wedding; block title: faqs, wedding; body: story, travel; menu |
| `--body` | Noto Serif | block title: travel; body: faqs, registry, rsvp, story, things_to_do, travel, wedding; italic line: travel, wedding |

Headings control writes `--display`, which reaches: section heading: faqs, registry, rsvp, story, things_to_do, travel, wedding; block title: faqs, wedding; body: story, travel; menu.  
Body control writes `--body`, which reaches: block title: travel; body: faqs, registry, rsvp, story, things_to_do, travel, wedding; italic line: travel, wedding.  
Menu Links writes `--menu-font`. The menu is set in `--display, --menu-font` on desktop and `--body, --menu-font` on mobile. Own menu variable: yes. Menu Links reaches the menu: desktop **yes**, mobile **yes**.

Font variables the runtime config does not know: `--menu-font`.

### Colour slots

| Control | Variable | Text it colours | Backgrounds it paints | Other paint at rest (borders, buttons, inputs) |
|---|---|---|---|---|
| Site Background | `--ivory` | - | faqs, footer, registry, story, things_to_do, travel, wedding | backgroundColor |
| Accent Color | `--beige` | - | rsvp, wedding | backgroundColor |
| Text1 | `--ink` | section heading: faqs, registry, rsvp, things_to_do, travel, wedding; block title: faqs, travel, wedding; body: faqs, registry, rsvp, story, things_to_do, travel, wedding; italic line: travel, wedding | - | borderBottomColor, borderLeftColor, borderTopColor, outlineColor, textDecorationColor |
| Text2 **(nothing visible at rest)** | `--on-dark` | - | - | - |
| Text3 | `--ink3` | section heading: story; body: story; menu | - | borderBottomColor, borderLeftColor, borderTopColor, outlineColor, textDecorationColor |
| Highlight Color | `--burgundy` | - | - | backgroundColor, borderBottomColor, borderLeftColor, borderTopColor |
| Additional Color | `--olive` | - | - | backgroundColor |

### Block titles: Content box vs page

| Field | First line | Page | Box shows |
|---|---|---|---|
| weddings_info | Wedding Day | Libre Baskerville 400 italic (`div.event-col-name`) | Libre Baskerville 400 |
| weddings_info | Send-Off Brunch | Libre Baskerville 400 italic (`div.event-col-name`) | Libre Baskerville 400 |
| events_info | Welcome Dinner | Libre Baskerville 400 italic (`div.event-col-name`) | Libre Baskerville 400 |
| faqs | What should I wear to the we | Libre Baskerville 400 italic (`div.faq-q-text`) | Libre Baskerville 400 |
| faqs | Will there be transportation | Libre Baskerville 400 italic (`div.faq-q-text`) | Libre Baskerville 400 |
| travel_info | Fairmont San Francisco | Noto Serif 400 (`span.travel-item-name`) | (heading face) |
| travel_info | San Francisco International  | Noto Serif 400 (`span.travel-item-name`) | (heading face) |

Wholly italic lines (dress codes, notes):

- weddings_info "Formal": page shows Noto Serif italic
- events_info "Semi-Formal": page shows Noto Serif italic
- travel_info "Request the Nisha & Roha": page shows Noto Serif italic via `.travel-note`

### Defaults imposed on body copy (must stay overridable)

- story `span.ampersand`: italic (`.our-story-names .ampersand`)
- wedding `em.mp-attire`: italic
- travel `h3.travel-col-title`: italic (`.travel-col-title`)
- travel `div.travel-note`: italic (`.travel-note`)

### Formatting survival

| Field | Title b i u font | Body b i u font | Whole box italic | Whole box underline | Whole box font |
|---|---|---|---|---|---|
| weddings_info | ✓ = ✓ ✓ | ✓ ✓ ✓ ✓ | = ✓ = ✓ | ✓ ✓ ✓ ✓ | ✓ ✓ ✓ ✓ |
| events_info | ✓ = ✓ ✓ | ✓ ✓ ✓ ✓ | = ✓ = ✓ | ✓ ✓ ✓ ✓ | ✓ ✓ ✓ ✓ |
| faqs | ✓ = ✓ ✓ | ✓ ✓ ✓ ✓ | = ✓ = ✓ | ✓ ✓ ✓ ✓ | ✓ ✓ ✓ ✓ |
| travel_info | ✓ ✓ ✓ ✓ | ✓ ✓ ✓ ✓ | ✓ ✓ ✓ ✓ | ✓ ✓ ✓ ✓ | ✓ ✓ ✓ ✓ |
| story | ✓ ✓ ✓ ✓ | ✓ ✓ ✓ ✓ | ✓ ✓ ✓ ✓ | ✓ ✓ ✓ ✓ | ✓ ✓ ✓ ✓ |
| things_to_do | ✓ ✓ ✓ ✓ | ✓ ✓ ✓ ✓ | ✓ ✓ ✓ ✓ | ✓ ✓ ✓ ✓ | ✓ ✓ ✓ ✓ |

### Sections

Shipped with `display:none` until hydrated: `#travel-standalone`, `#things-to-do`, `#gallery`.
Visibility: every section hides with its toggle off and (except Registry, by design) when its box is emptied.

### Mobile only

- nav: color rgb(81, 80, 0) → rgb(83, 20, 30)
- nav: bg rgb(58, 58, 54) → rgb(241, 228, 201)
- nav: font Libre Baskerville → Noto Serif
- nav: style italic → normal

## Sage & Still (`sageandstill`)

### Fonts

| Variable | Face | Paints |
|---|---|---|
| `--menu-font` | Ovo | menu |
| `--display` | Aboreto | section heading: faqs, rsvp, things_to_do, wedding; block title: accommodations; menu |
| `--sub` | Ovo | block title: accommodations, wedding; body: accommodations, rsvp; italic line: accommodations; menu |
| `--body` | DM Sans | block title: faqs; body: faqs, things_to_do, wedding; italic line: wedding; menu |

Headings control writes `--display`, which reaches: section heading: faqs, rsvp, things_to_do, wedding; block title: accommodations; menu.  
Body control writes `--body`, which reaches: block title: faqs; body: faqs, things_to_do, wedding; italic line: wedding; menu.  
Menu Links writes `--menu-font`. The menu is set in `--menu-font, --sub` on desktop and `--body, --menu-font` on mobile. Own menu variable: yes. Menu Links reaches the menu: desktop **yes**, mobile **yes**.

Font variables the runtime config does not know: `--menu-font`, `--sub`.

### Colour slots

| Control | Variable | Text it colours | Backgrounds it paints | Other paint at rest (borders, buttons, inputs) |
|---|---|---|---|---|
| Site Background | `--offwhite` | - | accommodations, faqs, home, rsvp, things_to_do | backgroundColor |
| Accent Color **(nothing visible at rest)** | `--green-gray` | - | - | - |
| Text1 | `--ink` | section heading: faqs, rsvp, things_to_do; block title: accommodations, faqs; body: accommodations | - | backgroundColor, borderBottomColor, borderLeftColor, borderTopColor, outlineColor, textDecorationColor |
| Text2 | `--on-dark` | body: wedding; italic line: wedding | - | borderBottomColor, borderLeftColor, borderTopColor, outlineColor, textDecorationColor |
| Text3 | `--ink3` | body: faqs, rsvp, things_to_do; italic line: accommodations | - | borderBottomColor, borderLeftColor, borderTopColor, outlineColor, textDecorationColor |
| Highlight Color | `--sage` | - | nav, wedding | backgroundColor, borderBottomColor, borderLeftColor, borderTopColor, outlineColor, textDecorationColor |
| Additional Color | `--dark-green` | section heading: wedding; block title: accommodations, wedding | footer | backgroundColor, borderBottomColor, borderLeftColor, borderTopColor, outlineColor, textDecorationColor |

### Block titles: Content box vs page

| Field | First line | Page | Box shows |
|---|---|---|---|
| weddings_info | The Wedding | Ovo 400 (`div.weekend-event-name`) | Ovo 400 |
| weddings_info | Farewell Brunch | Ovo 400 (`div.weekend-event-name`) | Ovo 400 |
| events_info | The Welcome Cocktails | Ovo 400 (`div.weekend-event-name`) | Ovo 400 |
| faqs | What should I wear to the we | DM Sans 400 (`span.faq-q-text`) | DM Sans 400 |
| faqs | Will there be transportation | DM Sans 400 (`span.faq-q-text`) | DM Sans 400 |
| travel_info | Hyatt Regency La Jolla At Av | Aboreto 400 uppercase (`div.accom-card-title`) | Aboreto 400 |
| travel_info | San Diego National Airport | Aboreto 400 uppercase (`div.accom-card-title`) | Aboreto 400 |

Wholly italic lines (dress codes, notes):

- weddings_info "Cocktail Attire": page shows DM Sans italic
- travel_info "Request the Maya & Jason": page shows Ovo italic

### Defaults imposed on body copy (must stay overridable)

- wedding `em.mp-attire`: italic
- accommodations `em`: italic

### Formatting survival

| Field | Title b i u font | Body b i u font | Whole box italic | Whole box underline | Whole box font |
|---|---|---|---|---|---|
| weddings_info | ✓ ✓ ✓ ✓ | ✓ ✓ ✓ ✓ | ✓ ✓ ✓ ✓ | ✓ ✓ ✓ ✓ | ✓ ✓ ✓ ✓ |
| events_info | ✓ ✓ ✓ ✓ | ✓ ✓ ✓ ✓ | ✓ ✓ ✓ ✓ | ✓ ✓ ✓ ✓ | ✓ ✓ ✓ ✓ |
| faqs | ✓ ✓ ✓ ✓ | ✓ ✓ ✓ ✓ | ✓ ✓ ✓ ✓ | ✓ ✓ ✓ ✓ | ✓ ✓ ✓ ✓ |
| travel_info | ✓ ✓ ✓ ✓ | ✓ ✓ ✓ ✓ | ✓ ✓ ✓ ✓ | ✓ ✓ ✓ ✓ | ✓ ✓ ✓ ✓ |
| story | ✓ = ✓ ✓ | ✓ = ✓ ✓ | = = = = | ✓ ✓ ✓ ✓ | ✓ ✓ ✓ ✓ |
| things_to_do | ✓ ✓ ✓ ✓ | ✓ ✓ ✓ ✓ | ✓ ✓ ✓ ✓ | ✓ ✓ ✓ ✓ | ✓ ✓ ✓ ✓ |

### Sections

Shipped with `display:none` until hydrated: `#our-story`, `#travel-section`, `#things-to-do`, `#gallery`.
Visibility: every section hides with its toggle off and (except Registry, by design) when its box is emptied.

### Mobile only

- nav: font Ovo → DM Sans

## Vintage Love Story (`vintagelovestory`)

### Fonts

| Variable | Face | Paints |
|---|---|---|
| `--menu-font` | Stack Sans Headline | menu |
| `--display` | Instrument Serif | section heading: faqs, other_events, rsvp, story, things_to_do, travel, wedding; block title: faqs, other_events; body: story, travel; menu |
| `--sans` | Stack Sans Headline | block title: travel; body: faqs, other_events, rsvp, things_to_do, travel, wedding; italic line: travel; menu |

Headings control writes `--display`, which reaches: section heading: faqs, other_events, rsvp, story, things_to_do, travel, wedding; block title: faqs, other_events; body: story, travel; menu.  
Body control writes `--sans`, which reaches: block title: travel; body: faqs, other_events, rsvp, things_to_do, travel, wedding; italic line: travel; menu.  
Menu Links writes `--menu-font`. The menu is set in `--menu-font, --sans` on desktop and `--display, --menu-font` on mobile. Own menu variable: yes. Menu Links reaches the menu: desktop **yes**, mobile **yes**.

Font variables the runtime config does not know: `--menu-font`.

### Colour slots

| Control | Variable | Text it colours | Backgrounds it paints | Other paint at rest (borders, buttons, inputs) |
|---|---|---|---|---|
| Site Background | `--ivory` | - | faqs, home, other_events, rsvp, things_to_do, travel, wedding | backgroundColor, borderBottomColor, borderLeftColor, borderTopColor |
| Accent Color | `--brown` | - | footer, nav, story | backgroundColor |
| Text1 | `--ink` | section heading: faqs, other_events, rsvp, things_to_do, travel, wedding; block title: faqs, other_events, travel; body: faqs, other_events, rsvp, things_to_do, travel, wedding; italic line: travel | - | backgroundColor, borderBottomColor, borderLeftColor, borderTopColor, fill, outlineColor, textDecorationColor |
| Text2 | `--on-dark` | section heading: story; body: story; menu | - | borderBottomColor, borderLeftColor, borderTopColor, outlineColor, textDecorationColor |
| Text3 **(nothing visible at rest)** | `--ink3` | - | - | - |
| Highlight Color | `--blue` | - | - | backgroundColor, borderBottomColor, borderLeftColor, borderTopColor, outlineColor, textDecorationColor |
| Additional Color **(nothing visible at rest)** | `--black` | - | - | - |

### Block titles: Content box vs page

| Field | First line | Page | Box shows |
|---|---|---|---|
| weddings_info | The Ceremony | Instrument Serif 400 (`h2.wedding-col-title`) | Instrument Serif 400 |
| weddings_info | The Reception | Instrument Serif 400 (`h2.wedding-col-title`) | Instrument Serif 400 |
| events_info | Welcome Party | Instrument Serif 400 (`h3.event-col-title`) | Instrument Serif 400 |
| events_info | Sunday Brunch | Instrument Serif 400 (`h3.event-col-title`) | Instrument Serif 400 |
| faqs | What should I wear to the we | Instrument Serif 400 (`div.faq-q-text`) | Instrument Serif 400 |
| faqs | Will there be transportation | Instrument Serif 400 (`div.faq-q-text`) | Instrument Serif 400 |
| travel_info | Windy City Inn | Stack Sans Headline 400 (`span.travel-item-name`) | (heading face) |
| travel_info | Lakeshore Plaza Hotel | Stack Sans Headline 400 (`span.travel-item-name`) | (heading face) |

Wholly italic lines (dress codes, notes):

- travel_info "Request the Iris & Natha": page shows Stack Sans Headline italic

### CSS that restyles the couple's own tags

- `.oval-title span` → font-family: var(--display); font-weight: 400
- `i).mp-attire` → font-family: var(--display); font-style: normal
- `i).mp-attire` → font-family: var(--display); font-style: normal

### Defaults imposed on body copy (must stay overridable)

- travel `em`: italic

### Formatting survival

| Field | Title b i u font | Body b i u font | Whole box italic | Whole box underline | Whole box font |
|---|---|---|---|---|---|
| weddings_info | ✓ ✓ ✓ ✓ | ✓ ✓ ✓ ✓ | ✓ ✓ ✓ ✓ | ✓ ✓ ✓ ✓ | ✓ ✓ ✓ ✓ |
| events_info | ✓ ✓ ✓ ✓ | ✓ ✓ ✓ ✓ | ✓ ✓ ✓ ✓ | ✓ ✓ ✓ ✓ | ✓ ✓ ✓ ✓ |
| faqs | ✓ ✓ ✓ ✓ | ✓ ✓ ✓ ✓ | ✓ ✓ ✓ ✓ | ✓ ✓ ✓ ✓ | ✓ ✓ ✓ ✓ |
| travel_info | ✓ ✓ ✓ ✓ | ✓ ✓ ✓ ✓ | ✓ ✓ ✓ ✓ | ✓ ✓ ✓ ✓ | ✓ ✓ ✓ ✓ |
| story | ✓ ✓ ✓ ✓ | ✓ ✓ ✓ ✓ | ✓ ✓ ✓ ✓ | ✓ ✓ ✓ ✓ | ✓ ✓ ✓ ✓ |
| things_to_do | ✓ ✓ ✓ ✓ | ✓ ✓ ✓ ✓ | ✓ ✓ ✓ ✓ | ✓ ✓ ✓ ✓ | ✓ ✓ ✓ ✓ |

### Sections

Shipped with `display:none` until hydrated: `#our-story`, `#events`, `#things-to-do`, `#gallery`.
Visibility: every section hides with its toggle off and (except Registry, by design) when its box is emptied.

### Mobile only

- nav: font Stack Sans Headline → Instrument Serif

## Whimsical Romance (`whimsicalromance`)

### Fonts

| Variable | Face | Paints |
|---|---|---|
| `--menu-font` | Avenir Next | menu |
| `--display` | Corben | section heading: accommodations, faqs, rsvp, things_to_do; block title: faqs |
| `--script` | Pinyon Script | section heading: wedding; block title: accommodations, wedding; menu |
| `--body` | Avenir Next | body: accommodations, faqs, rsvp, story, things_to_do, wedding; italic line: accommodations; menu |

Headings control writes `--script`, which reaches: section heading: wedding; block title: accommodations, wedding; menu.  
Body control writes `--body`, which reaches: body: accommodations, faqs, rsvp, story, things_to_do, wedding; italic line: accommodations; menu.  
Menu Links writes `--menu-font`. The menu is set in `--body, --menu-font` on desktop and `--body, --menu-font` on mobile. Own menu variable: yes. Menu Links reaches the menu: desktop **yes**, mobile **yes**.

Section headings the Headings control does not reach: accommodations (Corben), faqs (Corben), rsvp (Corben), things_to_do (Corben).

Font variables the runtime config does not know: `--menu-font`.

### Colour slots

| Control | Variable | Text it colours | Backgrounds it paints | Other paint at rest (borders, buttons, inputs) |
|---|---|---|---|---|
| Site Background | `--rose` | - | faqs, story, things_to_do | backgroundColor, borderBottomColor, borderLeftColor, borderTopColor |
| Accent Color | `--burgundy` | - | footer, nav, wedding | backgroundColor, borderBottomColor, borderLeftColor, borderTopColor |
| Text1 | `--ink`, `--text` | section heading: accommodations, faqs, rsvp, things_to_do; block title: accommodations, faqs; body: accommodations, faqs, rsvp, story, things_to_do; italic line: accommodations; menu | - | borderBottomColor, borderLeftColor, borderTopColor, outlineColor, textDecorationColor |
| Text2 | `--on-dark` | section heading: wedding; body: wedding | - | borderBottomColor, borderLeftColor, borderTopColor, outlineColor, textDecorationColor |
| Text3 | `--ink3` | section heading: wedding; block title: wedding; menu | - | borderBottomColor, borderLeftColor, borderTopColor, outlineColor, textDecorationColor |
| Highlight Color | `--ivory` | - | nav | backgroundColor |
| Additional Color | `--yellow` | - | accommodations, rsvp | backgroundColor, fill |

### Block titles: Content box vs page

| Field | First line | Page | Box shows |
|---|---|---|---|
| weddings_info | Wedding | Pinyon Script 400 (`div.itinerary-event-name`) | Pinyon Script 400 |
| weddings_info | Farewell Brunch | Pinyon Script 400 (`div.itinerary-event-name`) | Pinyon Script 400 |
| events_info | Welcome Party | Pinyon Script 400 (`div.itinerary-event-name`) | Pinyon Script 400 |
| faqs | What should I wear to the we | Corben 400 (`div.faq-q-text`) | Corben 400 |
| faqs | Will there be transportation | Corben 400 (`div.faq-q-text`) | Corben 400 |
| travel_info | Hilton Minneapolis | Pinyon Script 400 (`div.accom-name`) | Corben 400 |

Wholly italic lines (dress codes, notes):

- travel_info "Request the Sherrie & Ro": page shows Avenir Next italic via `.accom-meta`

### CSS that restyles the couple's own tags

- `i).mp-attire` → font-family: var(--script); font-style: normal

### Defaults imposed on body copy (must stay overridable)

- accommodations `div.accom-meta`: italic, weight 700 (`.accom-meta`)
- faqs `div.faq-answer`: italic (`.faq-answer`)
- things_to_do `div#thingsToDoText`: italic (`.faq-answer`)

### Formatting survival

| Field | Title b i u font | Body b i u font | Whole box italic | Whole box underline | Whole box font |
|---|---|---|---|---|---|
| weddings_info | ✓ ✓ ✓ ✓ | ✓ ✓ ✓ ✓ | ✓ ✓ ✓ ✓ | ✓ ✓ ✓ ✓ | ✓ ✓ ✓ ✓ |
| events_info | ✓ ✓ ✓ ✓ | ✓ ✓ ✓ ✓ | ✓ ✓ ✓ ✓ | ✓ ✓ ✓ ✓ | ✓ ✓ ✓ ✓ |
| faqs | ✓ ✓ ✓ ✓ | ✓ = ✓ ✓ | ✓ = ✓ = | ✓ ✓ ✓ ✓ | ✓ ✓ ✓ ✓ |
| travel_info | ✓ ✓ ✓ ✓ | ✓ ✓ ✓ ✓ | ✓ ✓ ✓ ✓ | ✓ ✓ ✓ ✓ | ✓ ✓ ✓ ✓ |
| story | ✓ ✓ ✓ ✓ | ✓ ✓ ✓ ✓ | ✓ ✓ ✓ ✓ | ✓ ✓ ✓ ✓ | ✓ ✓ ✓ ✓ |
| things_to_do | ✓ = ✓ ✓ | ✓ = ✓ ✓ | = = = = | ✓ ✓ ✓ ✓ | ✓ ✓ ✓ ✓ |

### Sections

Shipped with `display:none` until hydrated: `#our-story`, `#travel-section`, `#things-to-do`, `#gallery`.
Visibility: every section hides with its toggle off and (except Registry, by design) when its box is emptied.
