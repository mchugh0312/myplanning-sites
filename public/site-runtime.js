/* ============================================================================
   site-runtime.js — shared runtime for all MyPlanning.ai wedding templates
   ============================================================================

   WHY THIS FILE EXISTS
   Every template used to carry its own copy of the RSVP engine, the guest
   lookup, the placeholder screens and the boot logic. Ten copies drifted into
   3–7 different variants per function, which is why RSVP behaved differently
   depending on which template a couple picked. This file is the single
   canonical implementation. Templates now only own their layout + their
   hydrateTemplate() function.

   WHAT A TEMPLATE MUST DO
     1. Before this script:   <script>window.MP_TEMPLATE_ID = 'goldenhour';</script>
     2. Load this script:     <script src="/site-runtime.js"></script>
     3. Define, in its own script tag, a global `hydrateTemplate(d)` and a
        global `SAMPLE_DATA` object (used for editor preview).
   The runtime waits for DOMContentLoaded, so load order between this file and
   the template's own script does not matter.

   WHAT THE RUNTIME OWNS
     - slug / preview / password param parsing
     - boot: sessionStorage handoff from index.html, live fetch, postMessage
       hydration from the editor iframe
     - not_published  -> Coming Soon screen
     - password_required -> password screen WITH a working input
     - Save the Date mode -> dedicated announcement screen (hydrateTemplate is
       never called in this mode)
     - custom font application
     - the entire RSVP engine
     - the placeholder screens (themed per template)

   GLOBALS IT PUBLISHES (templates and inline onclick= handlers rely on these)
     API, _isPreview, _liveSlug, _pwdParam, _rsvpEntreeOptions,
     buildRsvpBlocks, onNameInput, checkShowSubmit, addExtraGuest, submitRSVP,
     lookupGuest, lookupGuestById, renderHousehold, clearHousehold,
     showAmbiguousMatches
============================================================================ */

(function () {
  'use strict';

  var API = 'https://wedding-recommender.onrender.com';
  window.API = API;

  /* ==========================================================================
     PER-TEMPLATE CONFIG
     ==========================================================================
     scriptVar  — CSS var holding the decorative/script face
     displayVar — CSS var holding the headline face
     bodyVar    — CSS var holding the body face
     A chosen cursive font goes to scriptVar (falling back to displayVar when
     the template has no script face). Anything else goes to displayVar AND
     bodyVar, so the font picker visibly does something on every template.

     palette    — colours used by the Save the Date / password / error screens
     fonts      — font stacks for those same screens
     stdImage   — hero image element or background used on the STD screen. The
                  runtime falls back to the couple's uploaded hero image.
  ========================================================================== */
  var TEMPLATES = {
    pressedpetals: {
      navOverHero: true,   // hero is a full-bleed photograph
      label: 'Pressed Petals',
      heroNamesId: 'heroCoupleNames',
      heroId: 'hero',
      stdHideIds: ['our-story','events-primary','other-events','accommodations','need-to-know','travel-section','gallery','registry-section','rsvp'],
      footerVars: { bg: '--offwhite', ink: '--text' },
      loadingImage: 'https://assets.softr-files.com/applications/98da9671-14f5-418f-b98a-6f8fb833401f/assets/5fb8a5ba-cd46-4296-ab23-0b2a2c718eae.png',
      scriptVar: '--script', displayVar: '--serif', bodyVar: '--serif',
      palette: { bg: '#f9f7f5', ink: '#040505', accent: '#8d8863', rule: 'rgba(141,136,99,0.28)' },
      fonts: { display: "'Citadel Script','Dancing Script',cursive", body: "'Instrument Serif',serif" }
    },
    heirloombloom: {
      navOverHero: true,   // hero is a full-bleed photograph
      label: 'Heirloom Bloom',
      heroNamesId: 'heroInitialsWrap',
      heroId: 'hero',
      stdHideIds: ['story','wedding','events','accommodations','travel','ntk','gallery','registry','rsvp'],
      footerVars: { bg: '--gold', ink: '--text' },
      loadingImage: 'https://assets.softr-files.com/applications/98da9671-14f5-418f-b98a-6f8fb833401f/assets/4a57bd8a-41d2-4d52-a165-34aaa12e08f7.png',
      scriptVar: '--script', displayVar: '--serif', bodyVar: '--serif',
      palette: { bg: '#f2ece7', ink: '#4a3a3d', accent: '#673d45', rule: 'rgba(103,61,69,0.28)' },
      fonts: { display: "'Sloop Script Pro','Parfumerie Script',cursive", body: "'Lancelot',Georgia,serif" }
    },
    blacktietimeless: {
      label: 'Black Tie Timeless',
      // The motif is white line art, so the loading screen is dark for this
      // template. Separate from `palette`, which the drawer and gate screens
      // use and which stays light here.
      loading: { bg: '#1c2120', ink: '#f4f2ed', accent: '#f4f2ed', rule: 'rgba(244,242,237,0.30)' },
      heroNamesId: 'heroCoupleNames',
      heroId: 'home',
      stdHideIds: ['our-story','events-primary','other-events','accommodations','need-to-know','travel-section','gallery','registry-section','rsvp'],
      footerVars: { bg: '--offwhite', ink: '--text' },
      loadingImage: 'https://assets.softr-files.com/applications/98da9671-14f5-418f-b98a-6f8fb833401f/assets/4ba695df-c964-49f0-af5c-23e2b23ce77e.png',
      scriptVar: '--script', displayVar: '--serif', bodyVar: '--serif',
      palette: { bg: '#f4f2ed', ink: '#1c2120', accent: '#1c2120', rule: 'rgba(28,33,32,0.24)' },
      fonts: { display: "'Parfumerie Script',cursive", body: "'Goudy',Georgia,serif" }
    },
    goldenhour: {
      navOverHero: true,   // hero is a full-bleed photo collage
      label: 'Golden Hour',
      heroNamesId: 'heroNames',
      heroId: 'home',
      stdHideIds: ['story','wedding','events','accommodations','travel','ntk','gallery','registry','rsvp'],
      footerVars: { bg: '--blue', ink: '--dark' },
      loadingImage: 'https://assets.softr-files.com/applications/98da9671-14f5-418f-b98a-6f8fb833401f/assets/015b4006-b2b0-4cdc-85fb-6c86758de1f9.png',
      scriptVar: '--script', displayVar: '--serif', bodyVar: '--serif',
      palette: { bg: '#d7dde4', ink: '#32344b', accent: '#32344b', rule: 'rgba(50,52,75,0.24)' },
      fonts: { display: "'Holiday','Parfumerie Script',cursive", body: "'EB Garamond',Georgia,serif" }
    },
    sageandstill: {
      label: 'Sage & Still',
      heroNamesId: 'heroCoupleNames',
      heroId: 'hero',
      stdHideIds: ['our-story','weekend','registry-section','need-to-know','accommodations','travel-section','gallery','rsvp'],
      footerVars: { bg: '--offwhite', ink: '--text' },
      loadingImage: 'https://assets.softr-files.com/applications/98da9671-14f5-418f-b98a-6f8fb833401f/assets/c4d74a7e-2fde-4301-b288-f58cd3c8b911.png',
      scriptVar: null, displayVar: '--display', bodyVar: '--body',
      palette: { bg: '#f5f3ee', ink: '#1f211d', accent: '#696c62', rule: 'rgba(105,108,98,0.28)' },
      fonts: { display: "'Aboreto','Cormorant Garamond',serif", body: "'DM Sans',system-ui,sans-serif" }
    },
    modernminimal: {
      label: 'Modern Minimal',
      heroNamesId: 'heroCoupleNames',
      heroId: 'hero',
      stdHideIds: ['our-story','events-primary','other-events','accommodations','travel-section','faq-section','gallery','registry-section','rsvp'],
      footerVars: { bg: '--ivory', ink: '--text' },
      loadingImage: 'https://assets.softr-files.com/applications/98da9671-14f5-418f-b98a-6f8fb833401f/assets/ac1909d1-dfb8-4acd-9fa3-4fa478c1015a.svg',
      scriptVar: null, displayVar: '--body', bodyVar: '--body',
      palette: { bg: '#fffdf5', ink: '#000000', accent: '#004aad', rule: 'rgba(0,0,0,0.18)' },
      // The template's page frame and RSVP band are blue, so the mobile drawer
      // matches rather than taking the ivory page ground.
      drawer: { bg: '#004aad', ink: '#fffdf5', rule: 'rgba(255,253,245,0.28)' },
      fonts: { display: "'Poppins',sans-serif", body: "'Poppins',sans-serif" }
    },
    whimsicalromance: {
      label: 'Whimsical Romance',
      heroNamesId: 'heroCoupleNames',
      heroId: 'hero',
      stdHideIds: ['our-story','itinerary','accommodations','need-to-know','registry-section','travel-section','gallery','rsvp'],
      footerVars: { bg: '--rose', ink: '--text' },
      loadingImage: 'https://assets.softr-files.com/applications/98da9671-14f5-418f-b98a-6f8fb833401f/assets/d522a767-03e5-4559-a323-153bd7c5606c.png',
      scriptVar: '--script', displayVar: '--display', bodyVar: '--body',
      palette: { bg: '#fffdf5', ink: '#53141e', accent: '#e5989b', rule: 'rgba(83,20,30,0.24)' },
      fonts: { display: "'Pinyon Script','Dancing Script',cursive", body: "'DM Sans',system-ui,sans-serif" }
    },
    coastalchic: {
      navOverHero: true,   // hero is a full-bleed photograph
      label: 'Coastal Chic',
      heroNamesId: 'heroCoupleNames',
      heroId: 'hero',
      stdHideIds: ['our-story','event-schedule','travel-section','accommodations','faq-section','gallery','registry-section','rsvp'],
      footerVars: { bg: '--ivory', ink: '--text' },
      loadingImage: 'https://assets.softr-files.com/applications/98da9671-14f5-418f-b98a-6f8fb833401f/assets/35c7f1a4-8d18-414b-ae05-0d7246886b52.png',
      scriptVar: '--script', displayVar: '--body', bodyVar: '--body',
      palette: { bg: '#fefaf1', ink: '#1b2a41', accent: '#5f7689', rule: 'rgba(27,42,65,0.22)' },
      fonts: { display: "'La Belle Aurore',cursive", body: "'Lexend Deca',sans-serif" }
    },
    vintagelovestory: {
      label: 'Vintage Love Story',
      heroNamesId: 'heroCoupleNames',
      heroId: 'hero',
      stdHideIds: ['wedding','our-story','events','travel-section','need-to-know','gallery','registry-wrap','rsvp'],
      footerVars: { bg: '--blue', ink: '--text' },
      loadingImage: 'https://assets.softr-files.com/applications/98da9671-14f5-418f-b98a-6f8fb833401f/assets/2558bbd6-8fe8-4f9c-90a4-1b827ba7515d.svg',
      scriptVar: null, displayVar: '--display', bodyVar: '--sans',
      palette: { bg: '#f4efe6', ink: '#1a1a1a', accent: '#6b5844', rule: 'rgba(26,26,26,0.2)' },
      // The template's own desktop drawer is maroon, so the mobile one matches
      // it rather than taking the page's cream ground.
      drawer: { bg: '#513229', ink: '#fffdf5', rule: 'rgba(255,253,245,0.22)' },
      fonts: { display: "'Instrument Serif',Georgia,serif", body: "'Inter',system-ui,sans-serif" }
    },
    regalboho: {
      navOverHero: true,   // hero is a full-bleed photograph
      label: 'Regal Boho',
      heroNamesId: null,
      heroId: 'hero',
      stdHideIds: ['our-story','event-details','travel-section','travel-standalone','need-to-know','gallery','registry-wrap','rsvp'],
      footerVars: { bg: '--beige', ink: '--text' },
      loadingImage: 'https://assets.softr-files.com/applications/98da9671-14f5-418f-b98a-6f8fb833401f/assets/8cdfe7e4-e470-4115-bb89-993f7b234798.png',
      scriptVar: null, displayVar: '--display', bodyVar: '--body',
      palette: { bg: '#f1e4c9', ink: '#53141e', accent: '#53141e', rule: 'rgba(83,20,30,0.24)' },
      fonts: { display: "'Sorts Mill Goudy',Georgia,serif", body: "'Noto Serif',Georgia,serif" }
    }
  };

  var TID = window.MP_TEMPLATE_ID || '';
  var CFG = TEMPLATES[TID] || TEMPLATES.pressedpetals;

  /* ==========================================================================
     URL / MODE PARSING
     ========================================================================== */
  var _params = new URLSearchParams(window.location.search);
  var _slugParam = _params.get('slug') || '';
  var _firstPart = window.location.pathname.split('/').filter(Boolean)[0] || '';
  // A path segment that is itself a template filename is NOT a slug — that's
  // the editor previewing the raw template.
  var _pathSlug = /^template-[a-z]+\.html$/i.test(_firstPart) ? '' : _firstPart;
  var _liveSlug = _slugParam || _pathSlug;
  var _isPreview = !_liveSlug;
  var _pwdParam = _params.get('pwd') || '';

  window._liveSlug = _liveSlug;
  window._isPreview = _isPreview;
  window._pwdParam = _pwdParam;

  if (_params.get('thumbnail') === '1') {
    document.addEventListener('DOMContentLoaded', function () {
      document.body.classList.add('thumbnail-mode');
    });
    if (document.body) document.body.classList.add('thumbnail-mode');
  }

  /* ==========================================================================
     RSVP STATE
     ========================================================================== */
  /* MP-340. This shipped with Chicken/Fish/Vegetarian/Vegan/Kids Meal baked in,
     so every wedding asked guests to pick an entree whether or not the couple
     was serving a plated meal — and recorded answers to a question nobody
     asked. Empty by default now: no list, no question. */
  window._rsvpEntreeOptions = [];
  /* Per-event lists, keyed by Events Masterlist record id. Absent means "use
     the wedding-wide list"; present but empty means "this event serves no
     meal". The two are deliberately different. */
  window._rsvpEntreeByEvent = {};

  var MEAL_OPTIONS = [
    { v: '', l: 'Meal type' },
    { v: 'Vegetarian', l: 'Vegetarian' },
    { v: 'Non Vegetarian', l: 'Non-Vegetarian' },
    { v: 'Vegan', l: 'Vegan' },
    { v: 'Gluten Free', l: 'Gluten-Free' },
    { v: 'Kids Meal', l: 'Kids Meal' }
  ];

  var _guestLookupTimers = {};

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  /* The list that applies to one event: its own if it has one, otherwise the
     wedding-wide list. Returns [] when neither offers anything, which the
     caller reads as "do not render the control at all". */
  function entreeOptionsFor(eventId) {
    var byEvent = window._rsvpEntreeByEvent || {};
    var own = eventId != null ? byEvent[String(eventId)] : null;
    var list = Array.isArray(own) ? own : (window._rsvpEntreeOptions || []);
    return list.map(function (o) {
      return (o && typeof o === 'object') ? o : { value: String(o), label: String(o) };
    }).filter(function (o) { return o.value; });
  }

  function entreeOptionsHtml(eventId) {
    return entreeOptionsFor(eventId).map(function (o) {
      return '<option value="' + esc(o.value) + '">' + esc(o.label) + '</option>';
    }).join('');
  }

  function mealOptionsHtml(selected) {
    return MEAL_OPTIONS.map(function (o) {
      return '<option value="' + esc(o.v) + '"' + (o.v === (selected || '') ? ' selected' : '') + '>' + esc(o.l) + '</option>';
    }).join('');
  }

  /* ==========================================================================
     RSVP ENGINE
     ==========================================================================
     Flow, matching the designs: the guest enters their name ONCE, we look them
     up on the guest list, and only then do the event blocks appear — already
     attributed to them. The previous version put a name field inside every
     event block, so a guest attending three events typed their name three
     times and each block did its own lookup.

     Class names are unchanged from that version, so every template's existing
     RSVP styling still applies. `.rsvp-event-block` is now a per-event answer
     block rather than a self-contained mini-form.
  ========================================================================== */

  var _rsvpState = {
    guestId: '',
    matchedName: '',
    plusOneAllowed: false,
    householdMembers: [],
    events: []
  };

  function rsvpEl(id) { return document.getElementById(id); }

  // Event names arrive from the couple's data in whatever case they typed;
  // the designs set them in Title Case.
  function titleCase(str) {
    return String(str || '').toLowerCase().replace(/\b([a-z])/g, function (m) {
      return m.toUpperCase();
    });
  }

  /* Which events a given person may answer for.
     `invited` is that person's Events Invited ids. An EMPTY list means "not
     recorded", not "invited to nothing" — see renderEventBlocks below for the
     full reasoning. This lives in one function because the primary guest and
     every household member have to read that rule the same way; when it was
     inline in renderEventBlocks only, household members had no rule at all. */
  /* `invited` is the person's own invitation list. An EMPTY list now means
     exactly that - invited to nothing - and they are asked nothing.

     This used to fall back to every event on the celebration, twice over: once
     when the list was empty and again when the filter matched nothing. That
     turned "we have no record of inviting this person" into "invite them to
     everything", so household members nobody had invited were shown a full set
     of questions and could record answers for events they were not going to.
     The guest list then had RSVP rows with no matching invitation behind them,
     which is the mess this reverts.

     The second fallback goes too. Ids that do not line up with this
     celebration's events are a data problem, and answering on that person's
     behalf for all of them is not a safer failure than asking nothing. */
  function eventsForInvitation(invited) {
    var all = _rsvpState.events || [];
    // No invitation list at all: invited to nothing, asked nothing.
    if (!invited || !invited.length) return [];
    var list = all.filter(function (ev) { return invited.indexOf(String(ev.id)) !== -1; });
    /* A NON-empty list that resolves to nothing is a different situation: this
       person was invited to something, and the ids just do not line up with the
       events this page knows about. Showing them everything is wrong, but so is
       showing them nothing - they would silently lose the ability to reply.
       Keep the old behaviour for that case only. */
    return list.length ? list : all;
  }

  /* Entree is a question you only ask someone who is coming.
     `scope` is ONE answer block — a `.rsvp-event-block` for the primary guest or
     a `.rsvp-household-event` for a household member. It must be the per-event
     block and not the whole household row, or querySelector would find the first
     event's controls for every event.

     Clearing the value on the way out matters as much as hiding it: a guest who
     picks the salmon, changes their mind about attending and submits would
     otherwise send a stale entree for an event they just declined, and the
     backend's "only overwrite when non-empty" rule would faithfully store it. */
  /* A themed replacement for alert().
     A guest filling this in should feel they are on the couple's website, and
     a Chrome dialog saying "weddings.myplanning.ai says" breaks that harder
     than any styling choice on the page. It also reads as an error from the
     product rather than a note from the couple.

     Built from the template's own tokens: it borrows the computed colours and
     fonts off `.rsvp-select` and the RSVP section, so every template themes it
     without ten stylesheet edits and without this file knowing any palette.
     Falls back to alert() if there is nothing to borrow from - a guest must
     never be blocked by a dialog that failed to render. */
  function rsvpNotice(message) {
    var host = document.getElementById('rsvp') ||
               document.querySelector('.rsvp-section,#rsvpBlocks');
    if (!host || !document.body) { alert(message); return; }

    var probe = document.querySelector('.rsvp-select,.rsvp-text-input') || host;
    var cs;
    try { cs = window.getComputedStyle(probe); } catch (e) { alert(message); return; }
    var hostCs;
    try { hostCs = window.getComputedStyle(host); } catch (e) { hostCs = cs; }

    var old = document.querySelector('.rsvp-notice-overlay');
    if (old && old.parentNode) old.parentNode.removeChild(old);

    var ov = document.createElement('div');
    ov.className = 'rsvp-notice-overlay';
    ov.setAttribute('role', 'alertdialog');
    ov.setAttribute('aria-modal', 'true');
    ov.style.cssText = 'position:fixed;inset:0;z-index:9999;display:flex;' +
      'align-items:center;justify-content:center;padding:1.25rem;' +
      'background:rgba(0,0,0,0.45)';

    var box = document.createElement('div');
    box.className = 'rsvp-notice';
    box.style.cssText = 'max-width:26rem;width:100%;padding:1.5rem 1.5rem 1.25rem;' +
      'text-align:center;border-radius:' + (cs.borderRadius || '12px') + ';' +
      'background:' + (cs.backgroundColor || '#fff') + ';' +
      'color:' + (cs.color || '#222') + ';' +
      'font-family:' + (cs.fontFamily || 'inherit') + ';' +
      'font-size:' + (cs.fontSize || '1rem') + ';' +
      'box-shadow:0 12px 40px rgba(0,0,0,0.3)';

    var p = document.createElement('p');
    p.className = 'rsvp-notice-msg';
    p.textContent = message;
    p.style.cssText = 'margin:0 0 1.15rem;line-height:1.5';

    var ok = document.createElement('button');
    ok.type = 'button';
    ok.className = 'rsvp-notice-ok';
    ok.textContent = 'OK';
    /* The submit button is the closest thing to a themed CTA on the page, so
       borrow its colours rather than inventing a blue one. */
    var sub = document.getElementById('rsvpSubmit') ||
              document.querySelector('.rsvp-submit,button[type="submit"]');
    var sc = null;
    try { sc = sub ? window.getComputedStyle(sub) : null; } catch (e) {}
    ok.style.cssText = 'cursor:pointer;border:none;padding:0.6rem 2rem;' +
      'border-radius:' + ((sc && sc.borderRadius) || '999px') + ';' +
      'background:' + ((sc && sc.backgroundColor) || (hostCs && hostCs.color) || '#333') + ';' +
      'color:' + ((sc && sc.color) || (hostCs && hostCs.backgroundColor) || '#fff') + ';' +
      'font-family:' + ((sc && sc.fontFamily) || cs.fontFamily || 'inherit') + ';' +
      'font-size:' + ((sc && sc.fontSize) || cs.fontSize || '1rem') + ';' +
      'letter-spacing:' + ((sc && sc.letterSpacing) || 'normal');

    function close() {
      if (ov.parentNode) ov.parentNode.removeChild(ov);
      document.removeEventListener('keydown', onKey);
    }
    function onKey(e) { if (e.key === 'Escape' || e.key === 'Enter') close(); }
    ok.addEventListener('click', close);
    ov.addEventListener('click', function (e) { if (e.target === ov) close(); });
    document.addEventListener('keydown', onKey);

    box.appendChild(p); box.appendChild(ok); ov.appendChild(box);
    document.body.appendChild(ov);
    try { ok.focus(); } catch (e) {}
  }

  function applyEntreeGate(scope) {
    if (!scope || !scope.querySelector) return;
    var entree = scope.querySelector('[data-field="entree"],[data-h-field="entree"]');
    var att = scope.querySelector('[data-field="attending"],[data-h-field="attending"]');
    if (!att) return;
    /* An event with NO menu used to return here before the column collapse
       below ever ran, so its attending select kept the stylesheet's two-column
       track and sat at half width - next to an event that DID have a menu and
       had been collapsed to full width, which looked like a rendering fault.
       Width should say something about the answer, not about whether the
       couple happened to set a menu. So: full width whenever there is no
       entree control to show, and half only while one is actually visible. */
    var show = !!entree && (att.value || '').trim() === 'yes';

    if (entree) {
      entree.style.display = show ? '' : 'none';
      if (!show) entree.value = '';
    }

    /* Hiding a grid child leaves its column empty, so the attending select would
       sit at half width with a gap beside it. Collapse the parent to one column
       — but ONLY when it really is a grid: `.rsvp-field-row` is flex in Black Tie
       Timeless and neither grid nor flex in Regal Boho and Vintage Love Story, and
       writing grid-template-columns onto those does nothing good. The empty string
       hands the column count back to the stylesheet rather than guessing at it. */
    var wrap = (entree && entree.parentNode) || att.parentNode;
    if (wrap && wrap.style) {
      var disp = '';
      try { disp = window.getComputedStyle(wrap).display; } catch (e) {}
      wrap.style.gridTemplateColumns =
        (!show && (disp === 'grid' || disp === 'inline-grid')) ? '1fr' : '';
    }
  }

  /* Dietary needs are only worth asking of someone who is coming.
     Same principle as the entree gate one level up, but scoped to the whole
     household ROW rather than one event block: a person has ONE set of
     allergies, not one per event, so the box appears once they are attending
     ANYTHING and disappears when they are attending nothing.

     That also covers the case that prompted this - a member invited to no
     events has no attending control at all, so there is never a "yes", and they
     are never asked what they cannot eat at a wedding they are not going to. */
  function applyDietaryGate(row) {
    if (!row || !row.querySelector) return;
    var box = row.querySelector('.rsvp-household-dietary');
    if (!box) return;
    var coming = false;
    row.querySelectorAll('[data-h-field="attending"]').forEach(function (a) {
      if ((a.value || '').trim() === 'yes') coming = true;
    });
    box.style.display = coming ? '' : 'none';
    if (!coming) {
      var t = box.querySelector('[data-h-field="dietary"]');
      /* Clear on the way out, for the same reason the entree gate does: a note
         typed before changing the answer to "no" would otherwise still be sent
         and saved against someone who is not attending. */
      if (t) t.value = '';
    }
  }

  /* The submitter's own dietary box, under the same rule as the household
     ones: only asked of someone who is coming.

     The household boxes were gated first and this was left behind, so a guest
     whose party members were invited but who was not invited themselves got no
     attending question and a dietary question anyway - the one stale leftover
     of the old "one dietary box for the whole submission" design. */
  function applyPrimaryDietaryGate() {
    var box = document.querySelector('.rsvp-dietary-row');
    if (!box) return;
    var coming = false;
    document.querySelectorAll(
      '#rsvpEventList .rsvp-event-block [data-field="attending"]').forEach(function (a) {
      if ((a.value || '').trim() === 'yes') coming = true;
    });
    box.style.display = coming ? '' : 'none';
    if (!coming) {
      var t = document.getElementById('rsvpDietary');
      if (t) t.value = '';
    }
  }

  /* One delegated listener rather than an inline onchange per control. The
     household rows are rebuilt on every lookup and the event blocks are written
     with innerHTML, so anything bound per-element has to be rebound each time;
     delegation covers rows that do not exist yet. */
  var _entreeGateBound = false;
  function bindEntreeGate() {
    if (_entreeGateBound) return;
    _entreeGateBound = true;
    document.addEventListener('change', function (e) {
      var t = e.target;
      if (!t || !t.getAttribute) return;
      if (t.getAttribute('data-field') !== 'attending' &&
          t.getAttribute('data-h-field') !== 'attending') return;
      var scope = t.closest
        ? t.closest('.rsvp-event-block,.rsvp-household-event')
        : null;
      applyEntreeGate(scope);
      applyDietaryGate(t.closest ? t.closest('.rsvp-household-row') : null);
      applyPrimaryDietaryGate();
      checkShowSubmit();
    });
  }

  function buildRsvpBlocks(events) {
    var container = document.getElementById('rsvpBlocks');
    if (!container) return;

    bindEntreeGate();

    _rsvpState.events = (events || []).slice();
    _rsvpState.guestId = '';
    _rsvpState.matchedName = '';
    _rsvpState.plusOneAllowed = false;
    _rsvpState.householdMembers = [];

    container.innerHTML =
      // ── Step 1: who are you ──────────────────────────────────────────────
      '<div class="rsvp-identity" id="rsvpIdentity">' +
        '<div class="rsvp-name-row">' +
          '<input class="rsvp-name-input" id="rsvpNameInput" type="text" ' +
            'placeholder="Enter your first and last name" autocomplete="name" ' +
            'oninput="onNameInput(this)">' +
        '</div>' +
        '<div class="rsvp-lookup-status" id="rsvpStatus" style="display:none"></div>' +
        '<div class="rsvp-name-disambig" id="rsvpDisambig" style="display:none"></div>' +
      '</div>' +

      // ── Step 2: revealed once the guest is found ────────────────────────
      '<div class="rsvp-answers" id="rsvpAnswers" style="display:none">' +
        '<div id="rsvpEventList"></div>' +
        '<div class="rsvp-household" id="rsvpHousehold">' +
          '<div class="rsvp-household-label" id="rsvpHouseholdLabel"></div>' +
          '<div class="rsvp-household-list" id="rsvpHouseholdList"></div>' +
        '</div>' +
        '<div class="extra-guests-list" id="rsvpExtraGuests"></div>' +
        '<button type="button" class="rsvp-add-guest" id="rsvpAddGuestBtn" ' +
          'onclick="addExtraGuest(this)" ' +
          // Spacing lives here rather than in ten stylesheets. A top margin
          // only, so nothing below it moves. MP-347.
          'style="display:none;margin-top:0.9rem">+ Add Invited Guest</button>' +
        '<div class="rsvp-field-row full" style="margin-bottom:0.75rem">' +
          '<input class="rsvp-text-input" type="email" id="rsvpEmail" ' +
            'placeholder="Email address (required) *" data-field="email" required ' +
            'oninput="checkShowSubmit()">' +
        '</div>' +
        '<div class="rsvp-field-row full rsvp-dietary-row" style="margin-bottom:0.5rem">' +
          '<textarea class="rsvp-textarea" rows="2" id="rsvpDietary" ' +
            'placeholder="Allergies or dietary requirements?"></textarea>' +
        '</div>' +
        '<div class="rsvp-field-row full" style="margin-bottom:0.5rem">' +
          '<textarea class="rsvp-textarea" rows="2" id="rsvpMessage" ' +
            'placeholder="Message for the couple (optional)"></textarea>' +
        '</div>' +
      '</div>';

    checkShowSubmit();
  }

  // Per-event answer blocks, built once the guest is identified.
  function renderEventBlocks() {
    var list = rsvpEl('rsvpEventList');
    if (!list) return;

    // Only the events this guest was invited to. The couple already decides who
    // is invited to what, and the form was offering all of them to everyone, so
    // a guest could answer for a dinner they were never asked to. MP-344.
    //
    // An EMPTY invitation list means "not recorded", not "invited to nothing":
    // older guests, imported rows, anyone added before events existed. Showing
    // them everything is the safe reading — a guest who cannot answer at all is
    // a worse failure than one offered an event too many.
    var events = eventsForInvitation(_rsvpState.invitedEventIds);

    list.innerHTML = events.map(function (ev) {
      return '' +
        '<div class="rsvp-event-block" data-event-id="' + esc(ev.id) + '">' +
          '<div class="rsvp-event-label">' + esc(titleCase(ev.label)) + '</div>' +
          '<div class="rsvp-expanded visible">' +
            '<div class="rsvp-field-row" style="margin-bottom:0.6rem">' +
              '<select class="rsvp-select" data-field="attending" onchange="checkShowSubmit()">' +
                '<option value="">Do you plan to attend?</option>' +
                '<option value="yes">Yes</option>' +
                '<option value="no">Cannot make it</option>' +
                '<option value="maybe">Not sure yet</option>' +
              '</select>' +
              /* No entrees for this event means no meal is served at it, so the
                 control is omitted rather than rendered empty. submitRSVP reads
                 the select defensively and sends '' when it is absent. */
              (entreeOptionsFor(ev.id).length
                ? '<select class="rsvp-select" data-field="entree">' +
                    '<option value="">Your entr\u00e9e choice</option>' + entreeOptionsHtml(ev.id) +
                  '</select>'
                : '') +
            '</div>' +
          '</div>' +
        '</div>';
    }).join('');

    /* Nobody has answered yet, so every entree starts hidden. Running the gate
       here rather than rendering the select with display:none also collapses the
       grid column on first paint, so the attending select is full width from the
       start instead of snapping wider on the first change event. */
    list.querySelectorAll('.rsvp-event-block').forEach(applyEntreeGate);
    /* Same reasoning for the dietary box: nobody has answered yet, so it starts
       hidden rather than appearing and then vanishing on the first change. It
       also covers the case with no blocks at all - a guest invited to nothing
       never sees it. */
    applyPrimaryDietaryGate();
  }

  function onNameInput(input) {
    var name = (input.value || '').trim();

    // Editing the name after a match invalidates it, otherwise a guest could
    // match, retype someone else's name and submit under the first guest's id.
    if (_rsvpState.guestId && name !== _rsvpState.matchedName) resetRsvpMatch();

    checkShowSubmit();

    if (_guestLookupTimers.identity) clearTimeout(_guestLookupTimers.identity);
    if (name.length < 2) { setStatus('', ''); return; }
    _guestLookupTimers.identity = setTimeout(function () {
      lookupGuest(null, name);
    }, 500);
  }

  function resetRsvpMatch() {
    _rsvpState.guestId = '';
    _rsvpState.matchedName = '';
    _rsvpState.plusOneAllowed = false;
    _rsvpState.householdMembers = [];
    var answers = rsvpEl('rsvpAnswers');
    if (answers) answers.style.display = 'none';
  }

  function checkShowSubmit() {
    // The button appears as soon as the guest is found on the list. It used to
    // wait for a valid email too, which meant a matched guest saw no way to
    // continue and no explanation — the form looked like it had no submit at
    // all. submitRSVP() still checks the email and says so if it's missing.
    var btn = document.getElementById('rsvpSubmitBtn');
    if (btn) btn.style.display = _rsvpState.guestId ? 'block' : 'none';
  }

  /* ── Status banner ────────────────────────────────────────────────────── */
  var BANNER = {
    checking: { border: 'var(--mp-muted,#A9BDC4)', bg: 'rgba(169,189,196,0.10)', color: 'var(--mp-muted,#8C7D6E)' },
    ok:       { border: 'var(--mp-ok,#4B5244)',    bg: 'rgba(75,82,68,0.08)',    color: 'var(--mp-ok,#4B5244)' },
    warn:     { border: '#B69400',                 bg: 'rgba(182,148,0,0.08)',   color: '#B69400' },
    error:    { border: '#C23331',                 bg: 'rgba(194,51,49,0.08)',   color: '#C23331' }
  };

  // Walks up from the element to find the first non-transparent background,
  // so the banner can size its contrast against what's actually behind it.
  function effectiveBackground(el) {
    var node = el;
    for (var i = 0; node && i < 8; i++, node = node.parentElement) {
      try {
        var bg = getComputedStyle(node).backgroundColor;
        // Any fully transparent colour is skipped, not just rgba(0,0,0,0):
        // matching that one literal meant a parent with, say,
        // rgba(255,255,255,0) ended the walk and the banner sized its contrast
        // against the wrong colour.
        var alpha = bg && bg.match(/rgba?\([^)]*?,\s*([0-9.]+)\s*\)/);
        var transparent = bg === 'transparent' || (alpha && parseFloat(alpha[1]) === 0);
        if (bg && !transparent) {
          var c = parseColor(bg);
          if (c) return c;
        }
      } catch (e) {}
    }
    // Nothing resolved: assume dark. White text on an unexpectedly light
    // ground is still legible; the reverse is what keeps going wrong.
    return { r: 40, g: 40, b: 40 };
  }

  function setStatus(kind, text) {
    var el = rsvpEl('rsvpStatus');
    if (!el) return;
    if (!text) { el.style.display = 'none'; el.textContent = ''; return; }
    var s = BANNER[kind] || BANNER.checking;

    // Text colour is always derived from the background rather than taken from
    // the palette: the palette's greens and reds are tuned for a light section,
    // and several templates put the RSVP form on a dark band. Deciding by
    // luminance every time removes the guesswork — the earlier version only
    // flipped when a contrast threshold was crossed, which left the message
    // dark-on-dark whenever the background couldn't be resolved.
    var bg = effectiveBackground(el);
    // Mid-tones (a gold or sage band) sit near the luminance midpoint where a
    // single cut-off picks badly, so compare both and take the better.
    var white = { r: 255, g: 255, b: 255 }, ink = { r: 26, g: 26, b: 26 };
    var onDark = contrastRatio(white, bg) >= contrastRatio(ink, bg);
    var colour = onDark ? '#ffffff' : '#1a1a1a';
    var band = onDark ? 'rgba(255,255,255,0.22)' : 'rgba(0,0,0,0.09)';
    // The semantic colour survives on the left border, where contrast matters
    // less, so "found you" still reads differently from an error.
    var border = s.border;

    el.style.cssText = [
      'font-family:inherit', 'font-size:0.9rem', 'line-height:1.45',
      'font-weight:600',
      'padding:0.6rem 0.9rem', 'margin:0.6rem 0 0.2rem',
      'border-left:3px solid ' + border, 'border-radius:4px',
      'background:' + band, 'color:' + colour, 'display:block'
    ].join(';');
    el.textContent = text;
  }

  /* A way back from a wrong fuzzy match. Rendered next to the status message
     rather than inside it, so the message stays plain text. MP-346. */
  function renderNotYouLink(matchedName) {
    var status = rsvpEl('rsvpStatus');
    if (!status || !status.parentNode) return;
    var existing = document.getElementById('mpNotYou');
    if (existing) existing.parentNode.removeChild(existing);

    var wrap = document.createElement('div');
    wrap.id = 'mpNotYou';
    wrap.style.cssText = 'margin:0.35rem 0 0.2rem;font-size:0.82rem;opacity:0.85';
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = 'Not ' + (matchedName || 'you') + '? Search again';
    btn.style.cssText =
      'background:none;border:none;padding:0;font:inherit;color:inherit;' +
      'text-decoration:underline;cursor:pointer';
    btn.addEventListener('click', function () {
      _rsvpState.guestId = '';
      _rsvpState.matchedName = '';
      _rsvpState.householdMembers = [];
      var input = rsvpEl('rsvpNameInput');
      if (input) { input.value = ''; input.focus(); }
      clearHousehold();
      var form = rsvpEl('rsvpFormFields');
      if (form) form.classList.remove('visible');
      setStatus('', '');
      wrap.parentNode && wrap.parentNode.removeChild(wrap);
    });
    wrap.appendChild(btn);
    status.parentNode.insertBefore(wrap, status.nextSibling);
  }

  /* ── Guest lookup ─────────────────────────────────────────────────────── */
  function applyFoundGuest(json, displayName) {
    _rsvpState.guestId = json.guest_id || '';
    _rsvpState.matchedName = json.name || displayName || '';
    _rsvpState.plusOneAllowed = !!json.plus_one_allowed;
    _rsvpState.householdMembers = Array.isArray(json.household_members) ? json.household_members : [];
    _rsvpState.invitedEventIds = Array.isArray(json.invited_event_ids)
      ? json.invited_event_ids.map(String) : [];

    var input = rsvpEl('rsvpNameInput');
    if (input && json.name) input.value = json.name;

    // MP-346. The lookup is fuzzy: "ash" finds "Ashley Smith". With similar
    // names in a family that can quietly be the wrong person, and the guest has
    // no way back. Say who was matched and offer a way out of it.
    var prev = json.previous_rsvp;
    if (prev && prev.status) {
      // MP-343. Answering again is allowed — plans change — but it should be a
      // decision, not something done in ignorance of the first reply.
      var when = '';
      try {
        if (prev.submitted_at) {
          var dt = new Date(prev.submitted_at);
          if (!isNaN(dt)) when = ' on ' + fmtDate(prev.submitted_at);
        }
      } catch (e) {}
      setStatus('ok',
        '\u2713 ' + _rsvpState.matchedName + ', you have already replied' + when + ': ' +
        prev.status + (prev.meal ? ' (' + prev.meal + ')' : '') +
        '. Answering again will replace that.');
    } else {
      setStatus('ok', '\u2713 Found you on the list. ' + _rsvpState.matchedName);
    }
    renderNotYouLink(_rsvpState.matchedName);

    var disambig = rsvpEl('rsvpDisambig');
    if (disambig) { disambig.style.display = 'none'; disambig.innerHTML = ''; }

    renderEventBlocks();
    renderHousehold(json);

    var addBtn = rsvpEl('rsvpAddGuestBtn');
    if (addBtn) addBtn.style.display = json.plus_one_allowed ? '' : 'none';
    var extras = rsvpEl('rsvpExtraGuests');
    if (extras && !json.plus_one_allowed) extras.innerHTML = '';

    var answers = rsvpEl('rsvpAnswers');
    if (answers) answers.style.display = 'block';

    checkShowSubmit();
  }

  function rejectGuest(kind, message) {
    resetRsvpMatch();
    setStatus(kind === 'ambiguous' ? 'warn' : 'error', message);
    checkShowSubmit();
  }

  function lookupGuest(_block, name) {
    if (_isPreview) return;
    var slug = window._weddingSlug || _liveSlug || '';
    if (!slug || !name || name.length < 2) return;
    setStatus('checking', 'Checking guest list\u2026');

    fetch(API + '/wedding-site/' + encodeURIComponent(slug) + '/guest-lookup?name=' + encodeURIComponent(name))
      .then(function (r) {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.json();
      })
      .then(function (json) {
        if (json.found === true) {
          applyFoundGuest(json, name);
        } else if (json.ambiguous) {
          rejectGuest('ambiguous', 'Multiple matches. Please pick yours below');
          showAmbiguousMatches(json.matches || []);
        } else {
          rejectGuest('unknown',
            "We couldn't find your name on the guest list. RSVPs are by invitation only. " +
            'please contact the couple if you believe this is a mistake.');
        }
      })
      .catch(function () {
        rejectGuest('error', 'Could not check the guest list right now. Please try again.');
      });
  }

  function lookupGuestById(_block, guestId, displayName) {
    // Used after the guest picks from the ambiguous-match list, so identical
    // names don't loop straight back into "ambiguous".
    if (_isPreview) return;
    var slug = window._weddingSlug || _liveSlug || '';
    if (!slug || !guestId) return;
    setStatus('checking', 'Confirming\u2026');

    fetch(API + '/wedding-site/' + encodeURIComponent(slug) + '/guest-by-id/' + encodeURIComponent(guestId))
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (json) {
        if (!json || !json.found) {
          rejectGuest('unknown', "We couldn't verify that guest. Please try again.");
          return;
        }
        applyFoundGuest(json, displayName);
      })
      .catch(function () {
        rejectGuest('error', 'Could not check the guest list right now. Please try again.');
      });
  }

  function showAmbiguousMatches(matches) {
    var wrap = rsvpEl('rsvpDisambig');
    if (!wrap) return;
    if (!matches.length) { wrap.style.display = 'none'; return; }

    wrap.style.cssText = 'background:rgba(0,0,0,0.03);border:1px solid rgba(0,0,0,0.10);' +
      'border-radius:6px;padding:0.55rem 0.7rem;margin:0.5rem 0 0.6rem;' +
      'font-family:inherit;font-size:0.8rem;display:block;';
    wrap.innerHTML = '<div style="margin-bottom:0.4rem;font-size:0.72rem;opacity:0.7">' +
      'We found a few matches. Please pick yours:</div>';

    matches.forEach(function (m) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.style.cssText = 'display:block;width:100%;text-align:left;border:1px solid rgba(0,0,0,0.12);' +
        'background:#fff;padding:0.45rem 0.7rem;border-radius:4px;margin-bottom:0.3rem;cursor:pointer;' +
        'font-family:inherit;font-size:0.85rem;color:inherit;';
      var nameEl = document.createElement('div');
      nameEl.textContent = m.name;
      nameEl.style.cssText = 'font-weight:500;';
      btn.appendChild(nameEl);
      if (m.hint) {
        var hint = document.createElement('div');
        hint.textContent = m.hint;
        hint.style.cssText = 'font-size:0.7rem;opacity:0.6;margin-top:2px;';
        btn.appendChild(hint);
      }
      btn.onclick = function () {
        var input = rsvpEl('rsvpNameInput');
        if (input) input.value = m.name;
        wrap.style.display = 'none';
        lookupGuestById(null, m.id, m.name);
      };
      wrap.appendChild(btn);
    });
  }

  /* ── Household (party members already on the guest list) ──────────────── */
  function clearHousehold() {
    var section = rsvpEl('rsvpHousehold');
    var label = rsvpEl('rsvpHouseholdLabel');
    var list = rsvpEl('rsvpHouseholdList');
    if (section) section.classList.remove('visible');
    if (label) label.textContent = '';
    if (list) list.innerHTML = '';
  }

  function renderHousehold(json) {
    var section = rsvpEl('rsvpHousehold');
    var label = rsvpEl('rsvpHouseholdLabel');
    var list = rsvpEl('rsvpHouseholdList');
    if (!section || !label || !list) return;

    var members = (Array.isArray(json && json.household_members) ? json.household_members : [])
      .filter(function (m) { return m && m.guest_id && m.guest_id !== json.guest_id; });
    if (!members.length) { clearHousehold(); return; }

    var party = (json.party_name || '').trim();
    var count = members.length + ' other ' + (members.length === 1 ? 'person' : 'people');
    label.textContent = party ? 'Your household: ' + party + ' (' + count + ')' : 'Your household (' + count + ')';

    list.innerHTML = '';
    members.forEach(function (m, idx) {
      var row = document.createElement('div');
      row.className = 'rsvp-household-row';
      row.dataset.guestId = m.guest_id;
      row.dataset.memberIdx = String(idx);
      /* Each member answers for their OWN invitation, not the primary's. A
         child invited to the ceremony but not the adults-only dinner must not
         be offered the dinner, and before the lookup started returning
         `invited_event_ids` per member the form had no way to know that. */
      var memberEvents = eventsForInvitation(
        Array.isArray(m.invited_event_ids) ? m.invited_event_ids.map(String) : []
      );

      row.innerHTML =
        '<div class="rsvp-household-name">' + esc(m.name || '(household member)') +
          (m.is_primary ? '<span class="rsvp-household-name-primary-tag">primary contact</span>' : '') +
        '</div>' +
        memberEvents.map(function (ev) {
          /* Per-event menu, with the wedding-wide list as the fallback inside
             entreeOptionsFor. This row used to call entreeOptionsFor(null),
             which reads ONLY the wedding-wide list — so a couple who set menus
             per event and no default menu showed household members no entree
             control at all while the primary guest saw one. */
          var hasEntree = entreeOptionsFor(ev.id).length > 0;
          return '' +
            '<div class="rsvp-household-event" data-event-id="' + esc(ev.id) + '">' +
              /* Styled inline rather than in ten stylesheets, the same way the
                 MP-347 spacing was handled. The class is here so a template can
                 take it over later without a runtime change. */
              '<div class="rsvp-household-event-label" ' +
                'style="font-size:0.72rem;letter-spacing:0.04em;text-transform:uppercase;' +
                'opacity:0.75;margin-bottom:0.3rem">' + esc(titleCase(ev.label)) + '</div>' +
              '<div class="rsvp-household-controls">' +
                '<select class="rsvp-select" data-h-field="attending">' +
                  '<option value="">Attending?</option>' +
                  '<option value="yes">Yes</option>' +
                  '<option value="no">Cannot make it</option>' +
                  '<option value="maybe">Not sure</option>' +
                '</select>' +
                (hasEntree
                  /* "Your entree choice" is right on the primary block, where
                     the person reading it is the person choosing. On a
                     household row the dish belongs to whoever is named above
                     it, so the possessive is simply wrong there. */
                  ? '<select class="rsvp-select" data-h-field="entree">' +
                      '<option value="">Entr\u00e9e choice</option>' + entreeOptionsHtml(ev.id) +
                    '</select>'
                  : '') +
              '</div>' +
            '</div>';
        }).join('') +
        /* Dietary needs belong to a PERSON, not to whoever filled the form in.
           There used to be one dietary box for the whole submission, so a guest
           answering for their household typed "ash is vegetarian" into a field
           that saved onto their own row - and the caterer read it against the
           wrong name, or against five names if it had been copied across.
           `dietary_notes` is already accepted per household row by the backend
           (build_guest_fields takes each row's own notes), so this only needed
           somewhere to type it.

           Shown for every member, including one invited to nothing: allergies
           are worth recording whether or not that person is coming to anything
           yet. Placeholder names the person so it is unambiguous whose box it
           is when four are stacked. */
        '<div class="rsvp-household-dietary" style="margin-top:0.45rem">' +
          '<textarea class="rsvp-textarea" rows="1" data-h-field="dietary" ' +
            'placeholder="' + esc('Allergies or dietary needs for ' + (m.name || 'this guest') + '?') + '" ' +
            'style="width:100%;box-sizing:border-box;resize:vertical"></textarea>' +
        '</div>';
      list.appendChild(row);
      applyDietaryGate(row);
      row.querySelectorAll('.rsvp-household-event').forEach(applyEntreeGate);
    });
    section.classList.add('visible');
  }

  /* ── Plus one ─────────────────────────────────────────────────────────── */
  function addExtraGuest(btn) {
    var list = rsvpEl('rsvpExtraGuests');
    if (!list || list.children.length > 0) return; // one plus-one only

    var primaryInput = rsvpEl('rsvpNameInput');
    var primaryName = primaryInput ? (primaryInput.value || '').trim() : '';
    var defaultName = primaryName ? primaryName + "'s Plus One" : '';

    var row = document.createElement('div');
    row.className = 'extra-guest-row';

    var nameRow = document.createElement('div');
    nameRow.style.cssText = 'display:grid;grid-template-columns:1fr auto;gap:0.5rem;align-items:center;margin-bottom:0.4rem';

    var nameInput = document.createElement('input');
    nameInput.className = 'rsvp-text-input';
    nameInput.type = 'text';
    nameInput.value = defaultName;
    nameInput.placeholder = 'Enter invited guest name';
    nameInput.dataset.role = 'plus-one-name';
    // While untouched the name follows the primary guest's, so the seating
    // chart never ends up with "Unnamed".
    nameInput.dataset.isDefault = '1';
    nameInput.addEventListener('input', function () { nameInput.dataset.isDefault = '0'; });
    if (primaryInput) {
      primaryInput.addEventListener('input', function () {
        if (nameInput.dataset.isDefault === '1') {
          var n = (primaryInput.value || '').trim();
          nameInput.value = n ? n + "'s Plus One" : '';
        }
      });
    }

    var removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.className = 'rsvp-remove-btn';
    removeBtn.textContent = '\u00d7';
    removeBtn.setAttribute('aria-label', 'Remove plus one');
    removeBtn.onclick = function () { row.remove(); btn.style.display = ''; };

    nameRow.appendChild(nameInput);
    nameRow.appendChild(removeBtn);
    row.appendChild(nameRow);

    var controls = document.createElement('div');
    controls.className = 'rsvp-field-row';
    controls.style.cssText = 'display:grid;grid-template-columns:1fr 1fr;gap:0.5rem';

    var mealSel = document.createElement('select');
    mealSel.className = 'rsvp-select';
    mealSel.dataset.role = 'plus-one-meal';
    mealSel.innerHTML = mealOptionsHtml('');

    controls.appendChild(mealSel);
    // Same rule as the event blocks: no entrees configured, no control.
    if (entreeOptionsFor(null).length) {
      var entreeSel = document.createElement('select');
      entreeSel.className = 'rsvp-select';
      entreeSel.dataset.role = 'plus-one-entree';
      entreeSel.innerHTML = '<option value="">Entr\u00e9e (optional)</option>' + entreeOptionsHtml();
      controls.appendChild(entreeSel);
    }
    row.appendChild(controls);

    list.appendChild(row);
    btn.style.display = 'none';
  }

  /* ── Submit ───────────────────────────────────────────────────────────── */
  function submitRSVP() {
    if (_isPreview) { rsvpNotice('RSVP is disabled in preview mode.'); return; }
    var btn = document.getElementById('rsvpSubmitBtn');
    if (!btn) return;

    var name = (rsvpEl('rsvpNameInput') || {}).value || '';
    var email = ((rsvpEl('rsvpEmail') || {}).value || '').trim();
    if (!_rsvpState.guestId || !name.trim() || !email || email.indexOf('@') < 1) {
      rsvpNotice('Please enter your name as it appears on the invitation, and your email address.');
      return;
    }

    btn.disabled = true;
    btn.textContent = 'Submitting...';

    var slug = window._weddingSlug || _liveSlug || '';
    var dietary = (rsvpEl('rsvpDietary') || {}).value || '';
    var message = (rsvpEl('rsvpMessage') || {}).value || '';

    // Plus-one and household answers ride along with the first event so they're
    // recorded once rather than duplicated per event.
    var extraGuests = [];
    var plusOneRow = document.querySelector('#rsvpExtraGuests .extra-guest-row');
    if (plusOneRow) {
      var pn = (plusOneRow.querySelector('[data-role="plus-one-name"]') || {}).value || '';
      var pm = (plusOneRow.querySelector('[data-role="plus-one-meal"]') || {}).value || '';
      var pe = (plusOneRow.querySelector('[data-role="plus-one-entree"]') || {}).value || '';
      if (pn.trim()) extraGuests.push({ name: pn.trim(), meal: pm, entree: pe });
    }

    var householdRsvps = [];
    var hList = rsvpEl('rsvpHouseholdList');
    if (hList) {
      hList.querySelectorAll('.rsvp-household-row').forEach(function (hr) {
        var gid = hr.dataset.guestId || '';
        if (!gid) return;

        /* One answer per event this member was invited to, mirroring the
           primary guest's `events` array. Unanswered events are dropped, not
           sent blank: the backend merges into fkrGs and an event that was never
           answered must leave whatever is already stored alone. */
        var hEvents = [];
        hr.querySelectorAll('.rsvp-household-event').forEach(function (blk) {
          var a = blk.querySelector('[data-h-field="attending"]');
          var v = a ? (a.value || '').trim() : '';
          if (!v) return;
          var e = blk.querySelector('[data-h-field="entree"]');
          var lab = blk.querySelector('.rsvp-household-event-label');
          hEvents.push({
            event_id: blk.getAttribute('data-event-id') || '',
            event_name: lab ? lab.textContent : '',
            attending: v,
            entree_choice: e ? (e.value || '') : ''
          });
        });
        var hDietaryEl = hr.querySelector('[data-h-field="dietary"]');
        /* Derived from the answers, not just read off the box. The gate hides
           and clears the field when someone stops attending, but a value set
           without firing a change event (or a race between the two) would
           otherwise still be submitted for a person who is not coming. Decide
           it here from the same answers the backend will see. */
        var hComing = hEvents.some(function (e) { return e.attending === 'yes'; });
        var hDietary = (hComing && hDietaryEl) ? (hDietaryEl.value || '').trim() : '';

        /* Still requires an event answer before this member is sent at all.
           A dietary note on its own is NOT enough, and deliberately so: the
           backend derives a member's RSVP status from `h.attending or
           data.attending`, so a row carrying only a note would inherit the
           SUBMITTER's answer and record a reply that member never gave. That
           inheritance has to go before a note-only row can be accepted; until
           then, dropping the note is the lesser harm of the two. */
        if (!hEvents.length) return; // member left entirely blank — untouched

        // No longer rendered: the guest is not asked for a meal preference, so
        // the household is not either. Any value already on the record stays as
        // the planner set it rather than being blanked by an RSVP.
        var meal = hr.querySelector('[data-h-field="meal"]');
        /* The flat attending/entree fields are the first answer, kept only so a
           backend that has not been redeployed yet still records something sane.
           Same reasoning as the primary payload below — the two are separate
           deploys and the guest is the one who pays for a mismatch. */
        householdRsvps.push({
          guest_id: gid,
          attending: hEvents[0].attending,
          meal_preference: meal ? (meal.value || '') : '',
          entree_choice: hEvents[0].entree_choice,
          dietary_notes: hDietary,
          events: hEvents
        });
      });
    }

    /* MP-352 / MP-349. This built one payload PER EVENT and fired them all at
       /rsvp through Promise.all. Every one of them wrote the guest's single
       RSVP Status field, so a guest who accepted the ceremony and declined the
       dinner ended up with whichever request happened to land last — a race,
       and seating is downstream of that field.

       One request now carries every answer, which removes the race and is a
       prerequisite for per-event storage: N parallel read-modify-writes against
       one JSON field would lose answers outright rather than merely reorder
       them.

       event_id is the Events Masterlist record id. It was already sitting in
       the DOM (buildRsvpBlocks writes data-event-id) and was simply never sent
       — the old payload identified the event by its LABEL, which breaks the
       moment a couple renames an event. The label still rides along so the
       backend can fall back to name resolution for an event with no id. */
    var events = [];
    document.querySelectorAll('#rsvpEventList .rsvp-event-block').forEach(function (block) {
      var attendingEl = block.querySelector('[data-field="attending"]');
      var attending = attendingEl ? (attendingEl.value || '').trim() : '';
      if (!attending) return;   // unanswered events aren't submitted
      var entreeEl = block.querySelector('[data-field="entree"]');
      var labelEl = block.querySelector('.rsvp-event-label');
      events.push({
        event_id: block.getAttribute('data-event-id') || '',
        event_name: labelEl ? labelEl.textContent : '',
        attending: attending,
        entree_choice: entreeEl ? (entreeEl.value || '') : ''
      });
    });

    /* Derived from the answers, not just read off the box - the same reasoning
       as the household equivalent. The gate hides and clears the field, but a
       value set without firing a change event would otherwise still be sent,
       putting a dietary requirement on the row of someone who is not coming.
       Decided here, after `events` is built, because that is where the answers
       are. */
    if (!events.some(function (e) { return e.attending === 'yes'; })) dietary = '';

    /* The first answer is mirrored onto the top-level fields so a backend that
       has not been redeployed yet still records something sane rather than
       rejecting the request outright. Deploy order is backend first, so this
       should never be exercised — it is here because the two are separate
       deploys and the guest is the one who pays for a mismatch. */
    /* `events.length === 0` is no longer a reason to refuse the submission.
       Since an empty invitation list stopped meaning "invited to everything",
       a guest the couple has not yet invited to anything sees no event
       questions at all - and the old "at least one event" check then made the
       form impossible to complete. They could not answer, and could not send.
       They still have things worth sending: their email, dietary requirements
       and a message for the couple. So the payload is built either way and the
       check below only fires when there ARE questions and none were answered. */
    var payloads = [{
      slug: slug,
      guest_name: name.trim(),
      guest_id: _rsvpState.guestId,
      attending: events.length ? events[0].attending : '',
      meal_preference: '',
      entree_choice: events.length ? events[0].entree_choice : '',
      email: email,
      dietary_notes: dietary,
      message: message,
      event_name: events.length ? events[0].event_name : '',
      events: events,
      plus_one: false,
      extra_guests: [],
      household_rsvps: []
    }];

    /* Only nag when there was something to answer. `askedCount` counts the
       questions actually on the page for this guest, so someone with no
       invitation is never told to answer questions they were never shown. */
    var askedCount = document.querySelectorAll(
      '#rsvpEventList .rsvp-event-block [data-field="attending"]').length;
    if (askedCount > 0 && !events.length && !householdRsvps.length) {
      rsvpNotice('Please let us know whether you can attend at least one event.');
      btn.disabled = false;
      btn.textContent = 'Send My RSVP';
      return;
    }
    payloads[0].plus_one = extraGuests.length > 0;
    payloads[0].extra_guests = extraGuests;
    payloads[0].household_rsvps = householdRsvps;

    Promise.all(payloads.map(function (body) {
      return fetch(API + '/rsvp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      }).then(function (res) {
        return res.json().catch(function () { return {}; }).then(function (json) {
          return { ok: res.ok, json: json };
        });
      }).catch(function () {
        return { ok: false, json: {} };
      });
    })).then(function (results) {
      // One request now, carrying every event (see the payload build above), so
      // there is a single result. The max-not-sum rule is kept because the
      // response still reports how many PEOPLE were recorded, and a couple of
      // two answering for two events must not be told four RSVPs landed —
      // MP-342. Left as a loop so an older cached bundle that still posts one
      // request per event is reported correctly too.
      var anyOk = false, failMsg = null, total = 0;
      results.forEach(function (r) {
        if (r.ok) {
          anyOk = true;
          if (r.json && typeof r.json.total === 'number' && r.json.total > total) {
            total = r.json.total;
          }
        } else if (!failMsg) {
          failMsg = (r.json && r.json.detail) || null;
        }
      });
      if (!anyOk) throw new Error(failMsg || 'RSVP submission failed.');

      var successEl = document.getElementById('rsvpSuccess');
      if (successEl) {
        if (total > 1) {
          var msgEl = successEl.querySelector('.rsvp-success-msg');
          /* Not "RSVPs". Every template sets this line in the same display
             face as the "Rsvp Please" heading, and four capitals in a row is
             close to unreadable in a script face - which is exactly why the
             heading is not capitalised either. Match the heading. */
          var text = "Thank you! We've recorded Rsvps for " + total + ' people.';
          if (msgEl) msgEl.textContent = text;
          else successEl.textContent = text;
        }
        successEl.style.display = 'block';
        try { successEl.scrollIntoView({ behavior: 'smooth', block: 'center' }); } catch (e) {}
      }
      btn.style.display = 'none';
      var answers = rsvpEl('rsvpAnswers');
      if (answers) answers.style.display = 'none';
    }).catch(function (err) {
      rsvpNotice('Sorry, ' + (err && err.message ? err.message : 'something went wrong submitting your RSVP. Please try again.'));
      btn.disabled = false;
      btn.textContent = 'Send My RSVP';
    });
  }

  /* ==========================================================================
     CUSTOM FONT
     ==========================================================================
     Applied centrally so every template honours the couple's font choice —
     Golden Hour and Heirloom Bloom previously ignored it entirely.
  ========================================================================== */
  var CURSIVE_FONTS = ['Dancing Script', 'Pacifico', 'Great Vibes', 'Sacramento', 'Allura', 'Parisienne'];

  /* ── COLOUR CONTROLS ────────────────────────────────────────────────────────
     The editor offers Background, Accent and Text. Applying them was left to
     each template and had drifted badly:

       * Four templates (Regal Boho, Sage and Still, Vintage Love Story,
         Whimsical Romance) read the values and did nothing with them, so those
         controls were inert — change a colour, nothing happens, before or after
         saving.
       * The six that did apply them had Background and Accent the wrong way
         round: primary_color (labelled Background) was wired to the template's
         BRAND colour, and accent_color to the page ground.

     Applied here instead, once, using the variable names the runtime already
     knows: footerVars.bg is each template's page ground and footerVars.ink its
     text colour. Templates keep their own handling; this runs after
     hydrateTemplate so it wins, and setting nothing when a value is empty means
     the template's own palette still shows through. */
  var TEMPLATE_COLOR_VARS = {
    pressedpetals:       { bg: '--offwhite', accent: '--olive', ink: '--text' },
    heirloombloom:       { bg: '--offwhite', accent: '--berry', ink: '--text' },
    blacktietimeless:    { bg: '--offwhite', accent: '--black', ink: '--text' },
    goldenhour:          { bg: '--white', accent: '--blue', ink: '--dark' },
    sageandstill:        { bg: '--offwhite', accent: '--green-gray', ink: '--text' },
    modernminimal:       { bg: '--ivory', accent: '--blue', ink: '--text' },
    whimsicalromance:    { bg: '--ivory', accent: '--rose', ink: '--burgundy' },
    coastalchic:         { bg: '--ivory', accent: '--navy', ink: '--text' },
    vintagelovestory:    { bg: '--ivory', accent: '--brown', ink: '--text' },
    regalboho:           { bg: '--ivory', accent: '--beige', ink: '--text' },
  };

  /* ── SCROLL TO A SECTION ON REQUEST ────────────────────────────────────────
     The editor asks the preview to bring a section into view when the couple
     toggles it or starts typing into it, so they can see the thing they are
     editing without hunting for it.

     Section anchors differ per template — the same section is #need-to-know in
     one, #ntk in another and #faq-section in a third — so the editor sends a
     SEMANTIC key and the resolution lives here, where template knowledge
     belongs. Candidates are tried in order; missing sections are simply
     ignored, because three templates have no separate accommodations anchor. */
  var SECTION_ANCHORS = {
    home:           ['hero', 'home'],
    story:          ['our-story', 'story'],
    wedding:        ['events-primary', 'wedding', 'event-schedule', 'event-details', 'weekend', 'itinerary'],
    other_events:   ['other-events', 'events'],
    accommodations: ['accommodations'],
    travel:         ['travel-section', 'travel', 'travel-standalone'],
    faqs:           ['need-to-know', 'ntk', 'faq-section'],
    things_to_do:   ['things-to-do'],
    gallery:        ['gallery'],
    registry:       ['registry-section', 'registry', 'registry-wrap'],
    rsvp:           ['rsvp']
  };

  function scrollToSection(key) {
    var ids = SECTION_ANCHORS[key];
    if (!ids) return false;
    for (var i = 0; i < ids.length; i++) {
      var el = document.getElementById(ids[i]);
      /* A section that is toggled off is display:none and has no box, so
         scrolling to it would land nowhere. Skip to the next candidate. */
      if (!el || !el.offsetParent && getComputedStyle(el).display === 'none') continue;
      /* NOT scrollIntoView. In a frame it walks every scrollable ancestor,
         including ones in the PARENT document, so asking the preview to move
         dragged the editor panel around it — visible in Firefox in particular.
         Scrolling this document's own window can't cross the frame boundary. */
      try {
        var box = el.getBoundingClientRect();
        var y = box.top + (window.pageYOffset || document.documentElement.scrollTop || 0);
        window.scrollTo({ top: y, behavior: 'smooth' });
      } catch (e) {
        try {
          var b2 = el.getBoundingClientRect();
          window.scrollTo(0, b2.top + (window.pageYOffset || 0));
        } catch (e2) { return false; }
      }
      return true;
    }
    return false;
  }

  /* ── MP-315: MARK WHAT A TOGGLE JUST DID ───────────────────────────────────
     Switching a section ON scrolls to it, which explains itself. Switching one
     OFF leaves nothing to scroll to: the page silently gets shorter, possibly
     off screen, and the couple cannot tell whether they hit the right switch.

     So capture where the section IS at the moment the message arrives — the
     editor sends this before the hydrate that hides it — and leave a dashed
     outline with its name in that spot for a moment. Transient on purpose: a
     permanent label would sit on top of the design in the one place meant to
     show the couple what their guests see. */
  function markSection(key, label, on) {
    var ids = SECTION_ANCHORS[key];
    if (!ids) return;
    var el = null;
    for (var i = 0; i < ids.length && !el; i++) {
      var c = document.getElementById(ids[i]);
      if (c && (c.offsetParent || getComputedStyle(c).display !== 'none')) el = c;
    }
    /* A section with no content stays hidden even when switched on, and a
       section already hidden has no box to outline. Say what happened anyway,
       or the toggle looks broken — which is what Other Events looked like. */
    if (!el) { _floatSectionNote(label, on); return; }

    var box = el.getBoundingClientRect();
    var top = box.top + (window.pageYOffset || document.documentElement.scrollTop || 0);

    var mark = document.createElement('div');
    mark.setAttribute('data-mp-section-mark', '1');
    mark.style.cssText = [
      'position:absolute',
      'left:0', 'right:0',
      'top:' + Math.round(top) + 'px',
      'height:' + Math.max(64, Math.round(box.height)) + 'px',
      'border:2px dashed ' + (on ? '#4B5244' : '#C0892A'),
      'border-radius:10px',
      'background:' + (on ? 'rgba(75,82,68,0.08)' : 'rgba(192,137,42,0.10)'),
      'display:flex', 'align-items:center', 'justify-content:center',
      'pointer-events:none', 'z-index:2147483000',
      'opacity:0', 'transition:opacity 180ms ease'
    ].join(';');

    var tag = document.createElement('span');
    tag.textContent = (label || 'Section') + (on ? ' added' : ' removed');
    tag.style.cssText = [
      'font-family:"Open Sans",system-ui,sans-serif', 'font-size:12px', 'font-weight:600',
      'letter-spacing:0.04em', 'padding:5px 12px', 'border-radius:999px',
      'color:#FFFFFF', 'background:' + (on ? '#4B5244' : '#C0892A'),
      'box-shadow:0 2px 10px rgba(0,0,0,0.18)'
    ].join(';');
    mark.appendChild(tag);

    /* Previous marks go first, or a run of quick toggles stacks them up. */
    var old = document.querySelectorAll('[data-mp-section-mark]');
    for (var j = 0; j < old.length; j++) old[j].parentNode.removeChild(old[j]);
    document.body.appendChild(mark);

    try { window.scrollTo({ top: Math.max(0, top - 60), behavior: 'smooth' }); } catch (e) {}
    requestAnimationFrame(function () { mark.style.opacity = '1'; });
    setTimeout(function () {
      mark.style.opacity = '0';
      setTimeout(function () { if (mark.parentNode) mark.parentNode.removeChild(mark); }, 220);
    }, 1600);
  }

  function _floatSectionNote(label, on) {
    var old = document.querySelectorAll('[data-mp-section-mark]');
    for (var j = 0; j < old.length; j++) old[j].parentNode.removeChild(old[j]);

    var tag = document.createElement('div');
    tag.setAttribute('data-mp-section-mark', '1');
    tag.textContent = (label || 'Section') + (on ? ' added' : ' removed') +
                      (on ? ', add content to see it' : '');
    tag.style.cssText = [
      'position:fixed', 'top:16px', 'left:50%', 'transform:translateX(-50%)',
      'font-family:"Open Sans",system-ui,sans-serif', 'font-size:12px', 'font-weight:600',
      'letter-spacing:0.04em', 'padding:7px 14px', 'border-radius:999px',
      'color:#FFFFFF', 'background:' + (on ? '#4B5244' : '#C0892A'),
      'box-shadow:0 2px 12px rgba(0,0,0,0.22)', 'pointer-events:none',
      'z-index:2147483000', 'opacity:0', 'transition:opacity 180ms ease'
    ].join(';');
    document.body.appendChild(tag);
    requestAnimationFrame(function () { tag.style.opacity = '1'; });
    setTimeout(function () {
      tag.style.opacity = '0';
      setTimeout(function () { if (tag.parentNode) tag.parentNode.removeChild(tag); }, 220);
    }, 1600);
  }

  /* ── SECTION HEADINGS ──────────────────────────────────────────────────────
     The couple can rename a section. Applied centrally, against the same anchor
     table the scrolling uses, so no template needs to know about it.

     Headings are marked up inconsistently: a <div class="story-title">, an <h2
     class="ntk-title">, or Sage and Still's oval title wrapped in spans between
     two decorative rules. Setting textContent on the outer element would delete
     those rules, so find the innermost element that holds the whole heading and
     write to that one. */
  function _headingNode(section) {
    var el = null;
    try {
      var cands = section.querySelectorAll('h1,h2,h3,h4,[class*="title"],[class*="Title"]');
      for (var i = 0; i < cands.length; i++) {
        var c = cands[i];
        if (c.closest && c.closest('.mp-std-top,.mp-std-bottom,.mp-brand-footer')) continue;
        var t = (c.textContent || '').trim();
        if (t && t.length <= 60) { el = c; break; }
      }
    } catch (e) { return null; }
    if (!el) return null;
    /* Descend while a single child still carries the whole text, so decorative
       siblings survive. */
    var guard = 0;
    while (guard++ < 4) {
      var whole = (el.textContent || '').trim();
      var next = null;
      for (var j = 0; j < el.children.length; j++) {
        if ((el.children[j].textContent || '').trim() === whole) { next = el.children[j]; break; }
      }
      if (!next) break;
      el = next;
    }
    return el;
  }

  /* ── TITLES DO NOT NEED TO BE BOLD ─────────────────────────────────────────
     Templates read the first line of each block as that card's name and render
     it in their own display face — the script on Pressed Petals, condensed caps
     on Modern Minimal. They recognise it by its being wrapped in <strong>.

     The couple is told "the first line of each event becomes its title", which
     says nothing about bold. So deleting the supplied title and typing their
     own, or pasting one in, produced a line that looked like body copy — and no
     font picker would have fixed it, because the template applies the face and
     was simply not being asked to.

     Marking it here makes the promise true however the line was written, and no
     template has to change. */
  var TITLED_FIELDS = ['weddings_info', 'events_info', 'faqs'];

  function markFirstLineAsTitle(html) {
    if (!html || typeof html !== 'string') return html;
    /* Split on the blank line between cards, keeping the separators so the
       value is rebuilt exactly as it was written. */
    var parts = html.split(/((?:<br\s*\/?>\s*){2,})/i);
    for (var i = 0; i < parts.length; i += 2) {
      var block = parts[i];
      if (!block || !block.trim()) continue;
      var m = /^([\s\S]*?)(<br\s*\/?>)([\s\S]*)$/i.exec(block);
      var first = m ? m[1] : block;
      var rest  = m ? m[2] + m[3] : '';
      if (!first.replace(/<[^>]*>/g, '').trim()) continue;     /* nothing to mark */

      /* The WHOLE first line is the title, not just the part that happens to be
         bold. Bolding one word of "Welcome Cocktails" used to make "Welcome"
         the title and push "Cocktails" into the details, splitting a line that
         reads as one. Strip any bold inside the line and wrap the lot. */
      var bare = first.replace(/<\/?(?:strong|b)\b[^>]*>/gi, '');
      if (!bare.replace(/<[^>]*>/g, '').trim()) continue;

      parts[i] = '<strong>' + bare + '</strong>' + rest;
    }
    return parts.join('');
  }

  function markTitles(d) {
    if (!d) return;
    for (var i = 0; i < TITLED_FIELDS.length; i++) {
      var f = TITLED_FIELDS[i];
      if (typeof d[f] === 'string' && d[f]) d[f] = markFirstLineAsTitle(d[f]);
    }
  }

  /* Tell the editor what each section is ACTUALLY called on the page. Without
     this the Content tab showed its own generic label — "Our Registry" — while
     the site said "See Our Registry", and nothing had gone wrong; they were
     simply two different pieces of text. */
  function reportSectionHeadings() {
    if (!_isPreview) return;
    try {
      var out = {};
      Object.keys(SECTION_ANCHORS).forEach(function (key) {
        if (key === 'home') return;               /* the hero is the names */
        var ids = SECTION_ANCHORS[key];
        for (var i = 0; i < ids.length; i++) {
          var sec = document.getElementById(ids[i]);
          if (!sec) continue;
          var node = _headingNode(sec);
          var text = node && (node.textContent || '').trim();
          if (text) out[key] = text;
          break;
        }
      });
      parent.postMessage({ type: 'MP_SECTION_HEADINGS', headings: out }, '*');
    } catch (e) {}
  }

  function applySectionHeadings(d) {
    var map = d && d.section_headings;
    if (!map) return;
    Object.keys(map).forEach(function (key) {
      var text = map[key];
      if (!text || !String(text).trim()) return;   /* blank means keep the design's own */
      text = String(text).trim();
      var ids = SECTION_ANCHORS[key];
      if (!ids) return;
      for (var i = 0; i < ids.length; i++) {
        var sec = document.getElementById(ids[i]);
        if (!sec) continue;
        /* Home has no heading of its own: the first title-ish element in the
           hero is the couple's names, and writing over those would be a
           spectacular way to fail. Rename its menu link only. */
        if (key !== 'home') {
          var node = _headingNode(sec);
          if (node) node.textContent = text;
        }
        /* The menu has to agree with the page, or the couple renames a section
           and the nav still points at the old name. */
        try {
          var links = document.querySelectorAll('a[href="#' + ids[i] + '"]');
          for (var k = 0; k < links.length; k++) links[k].textContent = text;
        } catch (e) {}
        break;
      }
    });
  }

  /* ── GALLERY CAROUSEL ──────────────────────────────────────────────────────
     Every template renders its photographs into #galleryGrid, so this replaces
     that grid's contents and leaves the surrounding section, heading and
     background exactly as the template drew them.

     Three per view on a desktop, one on a phone. Photographs are contained
     rather than cropped, so a portrait shot is not cut into a square. */
  var GALLERY_PER_VIEW_DESKTOP = 3;
  var _galleryState = null;

  function buildGalleryCarousel(urls) {
    var grid = document.getElementById('galleryGrid');
    if (!grid || !urls || !urls.length) return;

    var perView = function () {
      return window.innerWidth < 768 ? 1 : GALLERY_PER_VIEW_DESKTOP;
    };

    grid.innerHTML = '';
    grid.removeAttribute('style');
    grid.className = (grid.className || '') + ' mp-gal';

    var style = document.getElementById('mp-gal-css');
    if (!style) {
      style = document.createElement('style');
      style.id = 'mp-gal-css';
      style.textContent =
        '.mp-gal{display:block!important;grid-template-columns:none!important;position:relative}' +
        '.mp-gal-view{overflow:hidden;width:100%}' +
        '.mp-gal-track{display:flex;transition:transform .38s ease;will-change:transform}' +
        '.mp-gal-cell{flex:0 0 auto;padding:0 6px;box-sizing:border-box}' +
        '.mp-gal-frame{width:100%;aspect-ratio:4/3;background:rgba(0,0,0,0.05);' +
          'border-radius:8px;overflow:hidden;display:flex;align-items:center;justify-content:center}' +
        '.mp-gal-frame img{width:100%;height:100%;object-fit:contain;display:block;cursor:zoom-in}' +
        '.mp-gal-nav{position:absolute;top:50%;transform:translateY(-50%);width:38px;height:38px;' +
          'border-radius:50%;border:none;background:rgba(0,0,0,0.45);color:#fff;font-size:18px;' +
          'line-height:1;cursor:pointer;display:flex;align-items:center;justify-content:center;z-index:2}' +
        '.mp-gal-nav[disabled]{opacity:0.25;cursor:default}' +
        '.mp-gal-prev{left:-6px}.mp-gal-next{right:-6px}' +
        '.mp-gal-dots{display:flex;gap:6px;justify-content:center;margin-top:14px}' +
        '.mp-gal-dot{width:7px;height:7px;border-radius:50%;border:none;padding:0;cursor:pointer;' +
          'background:currentColor;opacity:0.28}' +
        '.mp-gal-dot.is-on{opacity:0.9}' +
        '@media(prefers-reduced-motion:reduce){.mp-gal-track{transition:none}}';
      document.head.appendChild(style);
    }

    var view = document.createElement('div');
    view.className = 'mp-gal-view';
    var track = document.createElement('div');
    track.className = 'mp-gal-track';

    urls.forEach(function (url, i) {
      var cell = document.createElement('div');
      cell.className = 'mp-gal-cell';
      var frame = document.createElement('div');
      frame.className = 'mp-gal-frame';
      var img = document.createElement('img');
      img.src = url;
      img.alt = '';
      img.loading = 'lazy';
      /* Templates that ship a lightbox already expose openLightbox(i). Use it
         where it exists rather than building a second one. */
      img.addEventListener('click', function () {
        try {
          if (typeof window.openGalleryLightbox === 'function') window.openGalleryLightbox(i);
          else if (typeof window.openLightbox === 'function') window.openLightbox(i);
        } catch (e) {}
      });
      frame.appendChild(img);
      cell.appendChild(frame);
      track.appendChild(cell);
    });

    view.appendChild(track);
    grid.appendChild(view);

    var prev = document.createElement('button');
    prev.className = 'mp-gal-nav mp-gal-prev';
    prev.setAttribute('aria-label', 'Previous photographs');
    prev.innerHTML = '&#8249;';
    var next = document.createElement('button');
    next.className = 'mp-gal-nav mp-gal-next';
    next.setAttribute('aria-label', 'Next photographs');
    next.innerHTML = '&#8250;';
    grid.appendChild(prev);
    grid.appendChild(next);

    var dots = document.createElement('div');
    dots.className = 'mp-gal-dots';
    grid.appendChild(dots);

    var page = 0;
    var render = function () {
      var per = perView();
      var pages = Math.max(1, Math.ceil(urls.length / per));
      if (page > pages - 1) page = pages - 1;
      if (page < 0) page = 0;

      var cells = track.querySelectorAll('.mp-gal-cell');
      for (var i = 0; i < cells.length; i++) cells[i].style.width = (100 / per) + '%';
      track.style.transform = 'translateX(' + (-page * 100) + '%)';

      prev.disabled = page === 0;
      next.disabled = page >= pages - 1;
      /* One page fits everything: chevrons and dots would be furniture. */
      var many = pages > 1;
      prev.style.display = many ? '' : 'none';
      next.style.display = many ? '' : 'none';

      dots.innerHTML = '';
      if (many) {
        for (var p = 0; p < pages; p++) {
          (function (n) {
            var dot = document.createElement('button');
            dot.className = 'mp-gal-dot' + (n === page ? ' is-on' : '');
            dot.setAttribute('aria-label', 'Photographs ' + (n + 1) + ' of ' + pages);
            dot.addEventListener('click', function () { page = n; render(); });
            dots.appendChild(dot);
          })(p);
        }
      }
    };

    prev.addEventListener('click', function () { page--; render(); });
    next.addEventListener('click', function () { page++; render(); });

    /* Swipe, because a phone shows one photograph at a time. */
    var x0 = null;
    view.addEventListener('touchstart', function (e) { x0 = e.touches[0].clientX; }, { passive: true });
    view.addEventListener('touchend', function (e) {
      if (x0 === null) return;
      var dx = e.changedTouches[0].clientX - x0;
      if (Math.abs(dx) > 40) { page += dx < 0 ? 1 : -1; render(); }
      x0 = null;
    }, { passive: true });

    if (_galleryState && _galleryState.onResize) {
      window.removeEventListener('resize', _galleryState.onResize);
    }
    var onResize = function () { render(); };
    window.addEventListener('resize', onResize);
    _galleryState = { onResize: onResize };

    render();
  }

  function applyCustomColors(d) {
    var c = d && d.customization;
    if (!c) return;
    var v = TEMPLATE_COLOR_VARS[TID] || TEMPLATE_COLOR_VARS.pressedpetals;
    var pairs = [[v.bg, c.primary_color], [v.accent, c.accent_color], [v.ink, c.text_color]];
    try {
      var root = document.documentElement.style;
      for (var i = 0; i < pairs.length; i++) {
        var name = pairs[i][0], val = pairs[i][1];
        if (!name) continue;
        if (val) root.setProperty(name, val);
        else root.removeProperty(name);   /* cleared: back to the design */
      }
    } catch (e) {}
  }

  /* ── FONTS BY ROLE ─────────────────────────────────────────────────────────
     Headings, body and menu are set separately. The face is applied through the
     template's own CSS variables, so it lands wherever that template already
     uses that variable.

     Size is harder: templates set type with clamp() and rem, so a plain CSS
     override would throw away the fluid scale that keeps them readable at every
     width. Instead each element is MEASURED and its computed size multiplied,
     which preserves the template's proportions whatever the viewport, and is
     redone on resize because clamp() depends on it. */
  var FONT_ROLE_SCALES = { small: 0.9, medium: 1, large: 1.15, 'very-large': 1.3 };

  function _roleTargets(role) {
    if (role === 'menu') {
      return document.querySelectorAll(
        '.top-nav a, nav a, .menu-drawer a, .mp-mnav-panel a');
    }
    if (role === 'heading') {
      return document.querySelectorAll(
        'h1, h2, h3, [class*="-title"], [class*="Title"], .oval-title');
    }
    return document.querySelectorAll('p, li, .story-body, [class*="-answer"], [class*="-detail"], [class*="-address"]');
  }

  var _fontScaleTimer = null;

  function _scaleNodes(nodes, scale) {
    for (var i = 0; i < nodes.length; i++) {
      var el = nodes[i];
      if (el.closest && el.closest('.mp-brand-footer')) continue;
      /* The template's own size, remembered once, so repeated passes scale from
         the original rather than compounding. */
      if (!el.hasAttribute('data-mp-base-size')) {
        el.setAttribute('data-mp-base-size', parseFloat(getComputedStyle(el).fontSize) || 0);
      }
      var base = parseFloat(el.getAttribute('data-mp-base-size')) || 0;
      if (!base) continue;
      if (!scale || scale === 1) el.style.removeProperty('font-size');
      else el.style.fontSize = (base * scale).toFixed(2) + 'px';
    }
  }

  /* One section's own face and size, overriding the site-wide roles. Applied as
     inline styles rather than injected CSS: the templates set type through
     their own variables and class rules, and a scoped stylesheet would have to
     out-specify all of them. */
  function applySectionFonts(settings) {
    var sections = (settings && settings.sections) || {};
    Object.keys(sections).forEach(function (key) {
      var cfg = sections[key] || {};
      if (!cfg.font && !cfg.size) return;
      var ids = SECTION_ANCHORS[key];
      if (!ids) return;
      var sec = null;
      for (var i = 0; i < ids.length && !sec; i++) sec = document.getElementById(ids[i]);
      if (!sec) return;

      var nodes = sec.querySelectorAll(
        'h1,h2,h3,h4,p,li,span,div,[class*="-title"],[class*="-answer"],[class*="-detail"],[class*="-address"]');
      if (cfg.font) {
        for (var j = 0; j < nodes.length; j++) {
          /* Only elements that actually carry text, or a wrapper would set the
             face for children that have their own. */
          if (!nodes[j].querySelector || nodes[j].querySelector('h1,h2,h3,h4,p,li')) continue;
          nodes[j].style.fontFamily = "'" + cfg.font + "',serif";
        }
      }
      if (cfg.size) _scaleNodes(nodes, FONT_ROLE_SCALES[cfg.size]);
    });
  }

  function applyRoleSizes(settings) {
    var roles = ['heading', 'body', 'menu'];
    roles.forEach(function (role) {
      var cfg = settings[role] || {};
      var scale = FONT_ROLE_SCALES[cfg.size];
      var nodes = _roleTargets(role);
      _scaleNodes(nodes, scale);
    });
  }

  function applyFontSettings(d) {
    var settings = (d && d.font_settings) || null;
    if (!settings || !Object.keys(settings).length) return false;

    var root = document.documentElement.style;
    var families = [];
    var roleVar = {
      // scriptVar FIRST. On half the templates displayVar is the same variable
      // as bodyVar — Pressed Petals sets both to --serif — so writing the
      // heading face there changed the body copy and left the headings alone,
      // which is exactly what it looked like. The decorative face these
      // templates use for section titles is scriptVar.
      heading: CFG.scriptVar || CFG.displayVar,
      body: CFG.bodyVar,
      menu: CFG.bodyVar,   /* templates rarely give the menu its own variable */
    };
    Object.keys(settings.sections || {}).forEach(function (k) {
      var f = settings.sections[k] && settings.sections[k].font;
      if (f) families.push(f);
    });
    ['heading', 'body', 'menu'].forEach(function (role) {
      var cfg = settings[role] || {};
      if (!cfg.font) return;
      families.push(cfg.font);
      var v = roleVar[role];
      /* Menu shares the body variable in most templates; only set it when the
         body has not already claimed it, or one would silently win. */
      if (role === 'menu' && settings.body && settings.body.font) return;
      if (v) root.setProperty(v, "'" + cfg.font + "',serif");
    });

    if (families.length) loadGoogleFonts(families);

    /* After layout, and again on resize, because clamp() is viewport-dependent. */
    /* Sections last, so a section's own choice wins over the site-wide role. */
    var run = function () {
      try { applyRoleSizes(settings); } catch (e) {}
      try { applySectionFonts(settings); } catch (e) {}
    };
    if (window.requestAnimationFrame) requestAnimationFrame(function () { requestAnimationFrame(run); });
    else setTimeout(run, 0);
    try { if (document.fonts && document.fonts.ready) document.fonts.ready.then(run); } catch (e) {}
    if (_fontScaleTimer) window.removeEventListener('resize', _fontScaleTimer);
    _fontScaleTimer = function () { clearTimeout(_fontScaleTimer._t); _fontScaleTimer._t = setTimeout(run, 150); };
    window.addEventListener('resize', _fontScaleTimer);
    return true;
  }

  function loadGoogleFonts(names) {
    var id = 'mp-role-fonts';
    var link = document.getElementById(id);
    if (!link) {
      link = document.createElement('link');
      link.id = id;
      link.rel = 'stylesheet';
      document.head.appendChild(link);
    }
    link.href = 'https://fonts.googleapis.com/css2?' +
      names.map(function (n) {
        return 'family=' + encodeURIComponent(n).replace(/%20/g, '+') + ':wght@300;400;500;600;700';
      }).join('&') + '&display=swap';
  }

  function applyCustomFont(fontName) {
    var root = document.documentElement.style;

    // Clearing has to actively undo, not quietly do nothing. "Reset to template
    // default" sends an empty value, and returning early left the previous font
    // on the page — so the button looked broken.
    if (!fontName) {
      [CFG.scriptVar, CFG.displayVar, CFG.bodyVar].forEach(function (v) {
        if (v) { try { root.removeProperty(v); } catch (e) {} }
      });
      var stale = document.getElementById('mp-custom-font');
      if (stale && stale.parentNode) stale.parentNode.removeChild(stale);
      return;
    }

    var isCursive = CURSIVE_FONTS.some(function (f) { return fontName.indexOf(f) !== -1; });

    // One element, reused. hydrate() runs on every payload the editor posts, so
    // appending added a stylesheet link per keystroke.
    var link = document.getElementById('mp-custom-font');
    if (!link) {
      link = document.createElement('link');
      link.id = 'mp-custom-font';
      link.rel = 'stylesheet';
      document.head.appendChild(link);
    }
    link.href = 'https://fonts.googleapis.com/css2?family=' +
      encodeURIComponent(fontName).replace(/%20/g, '+') + ':wght@300;400;500;600;700&display=swap';

    var stack = "'" + fontName + "'," + (isCursive ? 'cursive' : 'serif');

    if (isCursive) {
      // A script face replaces only the decorative slot. Forcing it onto body
      // copy makes long paragraphs unreadable.
      root.setProperty(CFG.scriptVar || CFG.displayVar, stack);
    } else {
      if (CFG.displayVar) root.setProperty(CFG.displayVar, stack);
      if (CFG.bodyVar && CFG.bodyVar !== CFG.displayVar) root.setProperty(CFG.bodyVar, stack);
    }
  }

  /* ==========================================================================
     FULL-PAGE SCREENS (Save the Date / password / coming soon / not found)
     ==========================================================================
     All four are themed from CFG.palette + CFG.fonts so they look like the
     couple's chosen template rather than a generic error page.
  ========================================================================== */
  function fmtDate(iso) {
    if (!iso) return '';
    try {
      var d = new Date(String(iso).length === 10 ? iso + 'T00:00:00Z' : iso);
      if (isNaN(d.getTime())) return String(iso);
      return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' });
    } catch (e) { return String(iso); }
  }

  function screenShell(inner, extraCss, theme) {
    // Every one of these replaces the page: the password gate, Coming Soon, not
    // found, the error screen. They must lift the veil too, or a couple whose
    // site is unpublished or password-protected would stare at a blank page
    // until the safety timer fired.
    liftVeil();
    // Defaults to the couple's template, but a screen can hand in its own —
    // Coming Soon and Not Found use the product's palette instead.
    var p = (theme && theme.palette) || CFG.palette;
    var f = (theme && theme.fonts) || CFG.fonts;
    document.body.className = '';
    document.body.innerHTML =
      '<style>' +
      '.mp-screen{min-height:calc(100vh - 210px);display:flex;align-items:center;justify-content:center;' +
        'padding:56px 20px;background:' + p.bg + ';color:' + p.ink + ';text-align:center;box-sizing:border-box}' +
      'body{margin:0;background:' + p.bg + '}' +
      '.mp-screen *{box-sizing:border-box}' +
      '.mp-inner{max-width:560px;width:100%}' +
      '.mp-display{font-family:' + f.display + ';font-weight:400;line-height:1.1;margin:0;' +
        'font-size:clamp(2.6rem,8vw,4.4rem);color:' + p.ink + '}' +
      '.mp-body{font-family:' + f.body + ';font-size:1rem;line-height:1.7;opacity:0.85;margin:0 auto;max-width:440px}' +
      '.mp-eyebrow{font-family:' + f.body + ';font-size:0.72rem;letter-spacing:0.22em;' +
        'text-transform:uppercase;opacity:0.7;margin:0 0 18px}' +
      '.mp-date{font-family:' + f.body + ';font-size:0.95rem;letter-spacing:0.16em;' +
        'text-transform:uppercase;margin:18px 0 0;opacity:0.9}' +
      '.mp-rule{width:80px;height:1px;background:' + p.rule + ';margin:26px auto}' +
      '.mp-hero{width:100%;max-width:420px;aspect-ratio:4/5;object-fit:cover;margin:0 auto 30px;display:block}' +
      '.mp-foot{margin-top:44px;padding-top:20px;border-top:1px solid ' + p.rule + ';' +
        'font-family:' + f.body + ';font-size:0.66rem;letter-spacing:0.2em;text-transform:uppercase;opacity:0.5}' +
      (extraCss || '') +
      '</style>' +
      '<div class="mp-screen"><div class="mp-inner">' + inner + '</div></div>';
    document.body.classList.remove('hydrating');
    document.body.style.visibility = 'visible';
  }

  // ── Save the Date ────────────────────────────────────────────────────────
  // Save the Date is the template's own hero page with everything below it
  // hidden, plus a banner line. It is NOT a separate generic screen: the couple
  // picked a template and the announcement should look like it, using the same
  // hero photo (including the template's built-in one when they haven't
  // uploaded their own), the same type and the same colours.
  var STD_NAV_SELECTORS = [
    '[onclick*="openMenu"]', '.nav-hamburger', '.nav-toggle',
    '#siteNav', '#heroNav', '#topNav', '#menuOverlay', '#menuDrawer',
    '#navLinks', '#menuLinks'
  ].join(',');

  /* Hide reversibly: remember the inline display we found, so switching Save
     the Date back off restores exactly what was there — including sections the
     couple had already toggled off themselves, which must stay off. */
  function _stdHide(el) {
    if (!el || el.getAttribute('data-mp-std-hidden') !== null) return;
    el.setAttribute('data-mp-std-hidden', el.style.display || '');
    el.style.display = 'none';
  }

  function _stdRemoveBlocks() {
    try {
      var blocks = document.querySelectorAll('.mp-std-top,.mp-std-bottom');
      for (var i = 0; i < blocks.length; i++) blocks[i].parentNode.removeChild(blocks[i]);
      var st = document.getElementById('mp-std-css');
      if (st && st.parentNode) st.parentNode.removeChild(st);
    } catch (e) {}
  }

  function clearSaveTheDate() {
    _stdRemoveBlocks();
    try {
      var hidden = document.querySelectorAll('[data-mp-std-hidden]');
      for (var i = 0; i < hidden.length; i++) {
        hidden[i].style.display = hidden[i].getAttribute('data-mp-std-hidden') || '';
        hidden[i].removeAttribute('data-mp-std-hidden');
      }
    } catch (e) {}
  }

  function applySaveTheDate(d) {
    // 1. Hide every section below the hero. RSVP, registry, travel and the rest
    //    stay configured in the editor — they're simply not served to guests.
    /* Rebuild rather than bail out, so re-running with new data replaces the
       announcement instead of stacking a second one on top of it. */
    _stdRemoveBlocks();

    (CFG.stdHideIds || []).forEach(function (id) {
      _stdHide(document.getElementById(id));
    });

    // 2. Remove navigation, including the shared mobile drawer. With every
    //    target hidden, menu links would be dead ends.
    try {
      document.querySelectorAll(STD_NAV_SELECTORS + ',.mp-mnav-btn,.mp-mnav-panel,.mp-mnav-scrim')
        .forEach(_stdHide);
    } catch (e) {}

    // 2b. The template's own footer repeats the couple's names and the date,
    //     which the announcement above already carries, so in Save the Date
    //     mode it reads as the same information twice. No template lists its
    //     footer in stdHideIds, so hide it here. The MyPlanning.ai brand footer
    //     is appended to <body> separately and is untouched. MP-311.
    try {
      ['footerNames', 'footerCouple', 'footerDate'].forEach(function (id) {
        var el = document.getElementById(id);
        if (!el) return;
        var band = el.closest ? el.closest('footer:not(.mp-brand-footer), .site-footer, #siteFooter') : null;
        _stdHide(band || el);
      });
    } catch (e) {}

    var hero = document.getElementById(CFG.heroId) ||
               document.querySelector('.hero, .hero-section');
    if (!hero) return;

    var dateLine = fmtDate(d.celebration_date);
    var location = (d.celebration_location || '').trim();
    var names = d.couple_names || [d.partner_1, d.partner_2].filter(Boolean).join(' & ') || '';

    var namesEl = CFG.heroNamesId ? document.getElementById(CFG.heroNamesId) : null;
    var heroHasDate = !!hero.querySelector('#heroDate, .hero-date');
    var firstName = (d.partner_1 || names.split('&')[0] || '').trim();
    var _heroText = (hero.textContent || '').toLowerCase();
    var heroHasNames = !!firstName && _heroText.indexOf(firstName.toLowerCase()) !== -1;

    // ── Colour ───────────────────────────────────────────────────────────
    // Inherit the colour of the hero's own name text. That element is designed
    // to be legible against whatever the hero is — a photo, a colour block, a
    // gradient — so borrowing its colour is more reliable than guessing.
    // Coastal Chic is the case in point: its page ink is dark navy, which
    // vanished against the darkened photo, while its hero names are white.
    var inkColor = '';
    try {
      if (namesEl) inkColor = getComputedStyle(namesEl).color;
      if (!inkColor) inkColor = getComputedStyle(hero).color;
    } catch (e) {}
    if (!inkColor) inkColor = CFG.palette.ink;

    // A photo hero needs a shadow behind the type regardless of colour.
    var heroHasImage = false;
    try {
      heroHasImage = !!hero.querySelector('img') ||
        (getComputedStyle(hero).backgroundImage || 'none') !== 'none';
    } catch (e) {}
    var shadow = heroHasImage ? '0 2px 18px rgba(0,0,0,0.55)' : 'none';

    var style = document.createElement('style');
    style.id = 'mp-std-css';
    style.textContent =
      '.mp-std-top,.mp-std-bottom{position:absolute;left:50%;transform:translateX(-50%);' +
        'width:min(92%,680px);text-align:center;z-index:8;pointer-events:none;' +
        'color:' + inkColor + ';text-shadow:' + shadow + '}' +
      '.mp-std-top{top:7%}' +
      '.mp-std-bottom{bottom:6%}' +
      '.mp-std-eyebrow{font-size:1.05rem;letter-spacing:0.3em;text-transform:uppercase;margin:0;' +
        'font-weight:700}' +
      '.mp-std-names{font-size:clamp(2rem,6vw,3.2rem);line-height:1.1;margin:14px 0 0}' +
      '.mp-std-meta{font-size:0.9rem;letter-spacing:0.2em;text-transform:uppercase;margin:10px 0 0;' +
        'color:' + inkColor + ';text-shadow:' + shadow + '}' +
      '.mp-std-loc{opacity:0.85;margin-top:4px}' +
      '.mp-std-note{font-size:0.85rem;letter-spacing:0.08em;font-style:italic;opacity:0.92;' +
        'margin:16px 0 0}' +
      '.mp-std-top .mp-std-eyebrow + .mp-std-meta{margin-top:12px}' +
      '@media(max-width:640px){' +
        '.mp-std-top{top:5%}.mp-std-bottom{bottom:5%}' +
        '.mp-std-eyebrow{font-size:0.86rem;letter-spacing:0.22em}' +
        '.mp-std-meta{font-size:0.76rem;letter-spacing:0.15em}' +
        '.mp-std-note{font-size:0.78rem}}';
    document.head.appendChild(style);

    try {
      var pos = getComputedStyle(hero).position;
      if (!pos || pos === 'static') hero.style.position = 'relative';
    } catch (e) { hero.style.position = 'relative'; }

    // ── Top: the announcement itself ─────────────────────────────────────
    var top = document.createElement('div');
    top.className = 'mp-std-top';
    top.innerHTML = '<p class="mp-std-eyebrow">Save the Date</p>' +
      (!heroHasDate && dateLine ? '<p class="mp-std-meta">' + esc(dateLine) + '</p>' : '') +
      (location ? '<p class="mp-std-meta mp-std-loc">' + esc(location) + '</p>' : '') +
      (!heroHasNames && names ? '<p class="mp-std-names">' + esc(names) + '</p>' : '');
    hero.appendChild(top);

    // ── Bottom: the invitation line only ─────────────────────────────────
    var bottom = document.createElement('div');
    bottom.className = 'mp-std-bottom';
    bottom.innerHTML = '<p class="mp-std-note">Formal invitation to follow</p>';
    hero.appendChild(bottom);

    // The two blocks above are positioned over the hero, which is the intended
    // look. On templates whose hero already carries type near the top or bottom
    // they landed on top of it. Rather than guess a safe offset per template,
    // measure after layout and, only where they actually collide, drop the
    // block out of the overlay into normal flow above or below the hero.
    // MP-309.
    _scheduleStdDeoverlap(hero, [top, bottom]);

    try { document.title = (d.couple_names || 'Our Wedding') + ': Save the Date'; } catch (e) {}
  }

  function _stdOwnTextRects(hero) {
    var rects = [];
    try {
      var nodes = hero.querySelectorAll('h1,h2,h3,h4,h5,p,span,div,figcaption,li,time,svg');
      for (var i = 0; i < nodes.length; i++) {
        var el = nodes[i];
        if (el.closest && el.closest('.mp-std-top,.mp-std-bottom')) continue;
        if (!(el.textContent || '').trim()) continue;
        /* Skip wrappers: only measure the element that actually holds the text,
           or a container would report a rect covering the whole hero. */
        /* Skip wrappers, but never an <svg>: its children are its own text. */
        var tag = (el.tagName || '').toLowerCase();
        if (tag !== 'svg' && el.querySelector &&
            el.querySelector('h1,h2,h3,h4,h5,p,span,div,li,time,svg')) continue;
        var r = el.getBoundingClientRect();
        if (r.width > 0 && r.height > 0) rects.push(r);
      }
    } catch (e) {}
    return rects;
  }

  function _stdDeoverlap(hero, blocks) {
    if (!hero || !hero.parentNode) return;
    var own = _stdOwnTextRects(hero);
    if (!own.length) return;
    for (var i = 0; i < blocks.length; i++) {
      var b = blocks[i];
      if (!b || b.getAttribute('data-mp-std-flow') === '1') continue;
      var r = b.getBoundingClientRect();
      var hit = false;
      for (var j = 0; j < own.length; j++) {
        var o = own[j];
        if (!(r.right < o.left || r.left > o.right || r.bottom < o.top || r.top > o.bottom)) {
          hit = true; break;
        }
      }
      if (!hit) continue;
      b.setAttribute('data-mp-std-flow', '1');
      b.style.position   = 'static';
      b.style.transform  = 'none';
      b.style.width      = 'auto';
      b.style.padding    = '20px 16px';
      /* Out of the hero it no longer sits on the photograph, so the hero's ink
         and the drop shadow would be wrong: use the page's own ink. */
      b.style.color      = CFG.palette.ink;
      b.style.textShadow = 'none';
      if ((b.className || '').indexOf('mp-std-top') !== -1) {
        hero.parentNode.insertBefore(b, hero);
      } else {
        hero.parentNode.insertBefore(b, hero.nextSibling);
      }
    }
  }

  function _scheduleStdDeoverlap(hero, blocks) {
    var run = function () { try { _stdDeoverlap(hero, blocks); } catch (e) {} };
    if (window.requestAnimationFrame) {
      requestAnimationFrame(function () { requestAnimationFrame(run); });
    } else { setTimeout(run, 0); }
    /* Display faces change the metrics, so a block that cleared the hero's type
       with the fallback face can collide once the real one lands. */
    try { if (document.fonts && document.fonts.ready) document.fonts.ready.then(run); } catch (e) {}
    setTimeout(run, 500);
  }

  // ── Password gate (with a working input — the old screen had none) ───────
  function renderPasswordScreen(coupleNames) {
    var p = CFG.palette;
    screenShell(
      '<p class="mp-eyebrow">\uD83D\uDD12 Private</p>' +
      '<h1 class="mp-display">' + esc(coupleNames || 'A private celebration') + '</h1>' +
      '<div class="mp-rule"></div>' +
      '<p class="mp-body">This website is password protected. Please enter the password your hosts shared with you.</p>' +
      '<div class="mp-pw">' +
        '<input id="mpPwInput" type="password" placeholder="Password" autocomplete="current-password">' +
        '<button id="mpPwBtn" type="button">Enter</button>' +
        '<div id="mpPwError">Incorrect password. Please try again.</div>' +
      '</div>' +
      '<div class="mp-foot">myplanning.ai</div>',
      '.mp-pw{display:flex;flex-direction:column;gap:12px;max-width:300px;margin:26px auto 0}' +
      '.mp-pw input{width:100%;padding:12px 20px;border:1px solid ' + p.rule + ';border-radius:999px;' +
        'font-family:' + CFG.fonts.body + ';font-size:0.95rem;text-align:center;letter-spacing:0.05em;' +
        'background:#fff;color:' + p.ink + ';outline:none}' +
      '.mp-pw button{width:100%;padding:12px 20px;border:none;border-radius:999px;cursor:pointer;' +
        'background:' + p.accent + ';color:#fff;font-family:' + CFG.fonts.body + ';font-size:0.8rem;letter-spacing:0.12em;' +
        'text-transform:uppercase}' +
      '.mp-pw button:disabled{opacity:0.6;cursor:default}' +
      '#mpPwError{display:none;color:#C23331;font-family:' + CFG.fonts.body + ';font-size:0.8rem}'
    );

    var input = document.getElementById('mpPwInput');
    var btn = document.getElementById('mpPwBtn');
    var err = document.getElementById('mpPwError');
    if (input) input.focus();

    var attempt = function () {
      var pwd = (input.value || '').trim();
      if (!pwd) return;
      btn.disabled = true;
      btn.textContent = 'Checking\u2026';
      err.style.display = 'none';
      fetch(API + '/wedding-site/' + encodeURIComponent(_liveSlug) + '?password=' + encodeURIComponent(pwd))
        .then(function (r) { return r.json(); })
        .then(function (data) {
          if (data.password_required) {
            err.style.display = 'block';
            btn.disabled = false;
            btn.textContent = 'Enter';
            return;
          }
          // Keep the unlocked payload so a refresh doesn't dead-end back here.
          try { sessionStorage.setItem('weddingData_' + _liveSlug, JSON.stringify(data)); } catch (e) {}
          window.location.reload();
        })
        .catch(function () {
          err.style.display = 'block';
          btn.disabled = false;
          btn.textContent = 'Enter';
        });
    };
    if (btn) btn.onclick = attempt;
    if (input) input.addEventListener('keydown', function (e) { if (e.key === 'Enter') attempt(); });
  }

  // ── Coming soon / not found ──────────────────────────────────────────────
  /* The mark that replaces the star, and the MyPlanning.ai wordmark that
     replaces the plain-text footer. Both are real assets rather than glyphs, so
     the Coming Soon page reads as part of the brand instead of an emoji sitting
     on the couple's palette. The screen is already themed from CFG.palette and
     CFG.fonts, so it picks up whichever template they chose. */
  var MP_SCREEN_MARK  = 'https://assets.softr-files.com/applications/98da9671-14f5-418f-b98a-6f8fb833401f/assets/6491148d-4db6-4305-8aa0-59ca6abc0430.png';
  var MP_SCREEN_BRAND = 'https://assets.softr-files.com/applications/98da9671-14f5-418f-b98a-6f8fb833401f/assets/8815fd0e-bd66-4add-8c28-b9ec1e2509e3.png';

  /* Coming Soon is deliberately NOT themed from the chosen template. A couple in
     Draft is very often still switching templates, so borrowing the current one
     makes the page look like a decision they have not made. It uses the
     MyPlanning.ai palette instead, the same values index.html paints its loading
     screen with, so it reads as the product rather than a half-built site.
     The password screen still follows the template: by then the site exists and
     the guest is being shown that couple's site. */
  var MP_BRAND_THEME = {
    palette: { bg: '#f9f7f5', ink: '#1f211d', rule: 'rgba(141,136,99,0.28)' },
    fonts:   { display: "'Instrument Serif',serif", body: "'Open Sans',system-ui,sans-serif" }
  };

  var MP_SCREEN_BRAND_CSS =
    '.mp-mark{height:26px;width:auto;display:block;margin:0 auto 14px}' +
    '.mp-foot-brand{height:20px;width:auto;display:block;margin:0 auto;opacity:0.6}';

  function renderComingSoon(coupleNames, isoDate) {
    var dateLine = fmtDate(isoDate);
    screenShell(
      '<img class="mp-mark" src="' + MP_SCREEN_MARK + '" alt="">' +
      '<p class="mp-eyebrow">Coming soon</p>' +
      '<h1 class="mp-display">' + esc(coupleNames || 'Coming soon') + '</h1>' +
      (dateLine ? '<p class="mp-date">' + esc(dateLine) + '</p>' : '') +
      '<div class="mp-rule"></div>' +
      '<p class="mp-body">' +
        (coupleNames ? esc(coupleNames) + ' are putting the finishing touches on their wedding website. ' : 'The hosts are putting the finishing touches on their wedding website. ') +
        'Please check back soon.' +
      '</p>' +
      '<div class="mp-foot"><img class="mp-foot-brand" src="' + MP_SCREEN_BRAND +
        '" alt="MyPlanning.ai"></div>',
      MP_SCREEN_BRAND_CSS,
      MP_BRAND_THEME
    );
  }

  function renderNotFound() {
    screenShell(
      '<p class="mp-eyebrow">\uD83D\uDD0D Not found</p>' +
      '<h1 class="mp-display">We couldn\u2019t find that website</h1>' +
      '<div class="mp-rule"></div>' +
      '<p class="mp-body">The link you followed may be incorrect, or the website may have moved. ' +
      'Please double-check the address with your hosts.</p>' +
      '<div class="mp-foot"><img class="mp-foot-brand" src="' + MP_SCREEN_BRAND +
        '" alt="MyPlanning.ai"></div>',
      MP_SCREEN_BRAND_CSS,
      MP_BRAND_THEME
    );
  }

  /* ==========================================================================
     REGISTRY LINKS
     ==========================================================================
     The couple's registry lives at /{slug}/registry, which vercel.json rewrites
     to the live registry page. That page reads the slug straight back out of
     the path, so the link has to keep this exact shape.

     Templates ship their registry buttons as href="#" placeholders and only
     replace them if the couple happens to have typed a URL into their registry
     text. An unreplaced href="#" with target="_blank" opens a second copy of
     the wedding site — which is what guests were getting instead of the
     registry.
  ========================================================================== */
  var REGISTRY_LINK_SELECTORS = [
    '#registryCta', '#registryBtn', '.registry-cta', '.registry-btn',
    '.registry-buy-btn', '.registry-link'
  ].join(',');

  /* An in-page anchor (#travel-section) is navigation and stays. A link with no
     href at all, or href="#", is a button whose URL was never filled in. */
  var DEAD_CTA_SKIP = '.mp-brand-footer, nav, .top-nav, .menu-drawer, .menu-overlay, .mp-mnav-panel';

  function hideDeadCtas() {
    try {
      var links = document.querySelectorAll('a');
      for (var i = 0; i < links.length; i++) {
        var a = links[i];
        if (a.closest && a.closest(DEAD_CTA_SKIP)) continue;
        // The registry title and button are wired above and are never dead;
        // skip them by name as well as by class, so ordering can never take
        // them out again.
        if (a.classList && a.classList.contains('mp-registry-fallback')) continue;
        if (a.id === 'registryCta' || a.id === 'registryBtn' || a.id === 'registryLink') continue;
        if (a.className && /registry/i.test(String(a.className))) continue;
        if (a.closest && a.closest('#registry-section, #registry, .registry-section')) continue;
        var href = (a.getAttribute('href') || '').trim();
        if (href && href !== '#') continue;          /* has somewhere to go */
        if (href === '#' && a.getAttribute('onclick')) continue;  /* scripted */
        /* Hide the button, and the wrapper if the button is all it holds, so no
           empty frame or stray padding is left behind. */
        var target = a;
        var parent = a.parentElement;
        if (parent && parent.children.length === 1 &&
            !(parent.textContent || '').replace(a.textContent || '', '').trim()) {
          target = parent;
        }
        target.style.display = 'none';
      }
    } catch (e) {}
  }

  /* The registry title is an inline <a> in most templates, because for a long
     time it was the only thing in the section. Now that a couple can write copy
     underneath it, the two need to read as a heading and a paragraph rather
     than as one run of text. Set centrally so every template behaves alike. */
  function layOutRegistry() {
    try {
      var info = document.getElementById('registryInfo') ||
                 document.getElementById('registryText');
      if (!info) return;
      var hasCopy = !!(info.textContent || '').trim();
      var title = document.getElementById('registryCta') ||
                  document.querySelector('.registry-title, .registry-cta');
      if (title && hasCopy) {
        title.style.display = 'block';
        title.style.marginBottom = '0.2rem';
      }
      info.style.display = hasCopy ? 'block' : 'none';
      if (hasCopy && !info.style.marginTop) info.style.marginTop = '1.2rem';
    } catch (e) {}
  }

  function wireRegistryLinks(d) {
    // The editor preview receives a real slug in its payload, but navigating
    // the preview iframe to the live registry isn't what a couple expects from
    // a click in the editor — keep the button inert there.
    var slug = _isPreview ? '' : (window._weddingSlug || _liveSlug || '');
    var url = slug ? '/' + encodeURIComponent(slug) + '/registry' : '';

    var nodes = [];
    try { nodes = Array.prototype.slice.call(document.querySelectorAll(REGISTRY_LINK_SELECTORS)); }
    catch (e) { return; }

    // Also catch dead placeholder links sitting inside the registry section.
    var section = document.getElementById('registry-section') ||
                  document.getElementById('registry') ||
                  document.getElementById('registry-wrap');

    // Some templates make the whole registry section a single <a> (Sage & Still,
    // Regal Boho, Vintage Love Story). That's already the clickable element, so
    // wire it directly — injecting a fallback link inside it printed the CTA
    // text twice and left the outer anchor inert.
    if (section && section.tagName === 'A' && nodes.indexOf(section) === -1) {
      nodes.push(section);
    }
    if (section) {
      try {
        Array.prototype.slice.call(section.querySelectorAll('a[href="#"], a:not([href])'))
          .forEach(function (a) { if (nodes.indexOf(a) === -1) nodes.push(a); });
      } catch (e) {}
    }

    // Five templates ship a registry section with no clickable element at all
    // (Black Tie Timeless, Heirloom Bloom, Pressed Petals, Sage & Still, and
    // Golden Hour before this pass). Give those a text link rather than leaving
    // guests with a registry section they can't open. It inherits the section's
    // own type and colour, so it reads as part of the template.
    if (!nodes.length && section && url) {
      var fallback = document.createElement('a');
      fallback.className = 'mp-registry-fallback';
      fallback.textContent = 'View Our Registry';
      fallback.style.cssText = 'display:inline-block;margin-top:1.1rem;font:inherit;' +
        'font-size:0.82rem;letter-spacing:0.14em;text-transform:uppercase;' +
        'color:inherit;text-decoration:none;border-bottom:1px solid currentColor;' +
        'padding-bottom:3px;opacity:0.85;cursor:pointer';
      section.appendChild(fallback);
      nodes.push(fallback);
    }

    // Any remaining href="#" anchors in content areas are placeholder CTAs the
    // template ships (a Book Now with no URL configured, a demo registry item).
    // Left alone they jump the guest to the top of the page, which reads as a
    // broken link. Make them inert instead — the layout keeps its button.
    try {
      Array.prototype.slice.call(document.querySelectorAll('a[href="#"]'))
        .forEach(function (a) {
          if (nodes.indexOf(a) !== -1) return;                 // handled below
          if (a.closest && a.closest('nav, .mp-mnav-panel')) return;  // real anchors
          a.removeAttribute('target');
          a.style.cursor = 'default';
          a.addEventListener('click', function (e) { e.preventDefault(); });
        });
    } catch (e) {}

    nodes.forEach(function (a) {
      if (!url) {
        // Editor preview — there's no slug to build a real link from, so make
        // the button inert rather than let it open a copy of the page.
        a.setAttribute('href', '#');
        a.removeAttribute('target');
        a.style.cursor = 'default';
        a.onclick = function (e) { e.preventDefault(); };
        return;
      }
      a.setAttribute('href', url);
      // New tab: the registry is a separate journey — a guest browsing gifts
      // shouldn't lose their place on the wedding site, and coming back from an
      // external retailer's checkout via the back button is worse still.
      a.setAttribute('target', '_blank');
      a.setAttribute('rel', 'noopener');
    });
  }

  /* ==========================================================================
     MOBILE NAVIGATION
     ==========================================================================
     Desktop keeps each template's own navigation exactly as designed. Below
     768px every template switches to the same right-hand hamburger and drawer.

     The templates handled small screens very differently: Coastal Chic's navy
     bar wrapped its links onto three rows and ate most of the hero, while
     others had a hamburger in a different position, or none at all. This gives
     one consistent mobile pattern without touching ten stylesheets.

     Show/hide is done in CSS, not by measuring the viewport in JS, so rotating
     a phone or resizing switches cleanly.
  ========================================================================== */
  var NAV_LINK_SOURCES = [
    '#menuLinks a', '#navLinks a', '.nav-links a', '.site-nav a',
    '.hero-nav a', '.top-nav a', '#menuOverlay a', '#siteNav a',
    '#topNav a', '#heroNav a', '.nav-bar a'
  ].join(',');

  var NAV_CONTAINERS = [
    '.nav-bar', '.nav-links', '.site-nav', '#siteNav', '.hero-nav', '#heroNav',
    '.top-nav', '#topNav', '.nav-hamburger', '.nav-toggle', '[onclick*="openMenu"]'
  ].join(',');

  function buildMobileNav() {
    if (document.querySelector('.mp-mnav-btn')) return;

    // Collect the links the template rendered, before anything is hidden.
    var links = [];
    var seen = {};
    try {
      Array.prototype.slice.call(document.querySelectorAll(NAV_LINK_SOURCES)).forEach(function (a) {
        var href = a.getAttribute('href') || '';
        var label = (a.textContent || '').trim();
        if (!label || !href || href.charAt(0) !== '#') return;
        var key = href + '|' + label.toLowerCase();
        if (seen[key]) return;
        seen[key] = 1;
        links.push({ href: href, label: label });
      });
    } catch (e) { return; }
    if (!links.length) return;

    // A template can declare its own drawer colours; otherwise the page palette
    // is used.
    var p = CFG.palette;
    var dp = CFG.drawer || { bg: p.bg, ink: p.ink, rule: p.rule };

    var style = document.createElement('style');
    style.id = 'mp-mnav-css';
    style.textContent =
      // Hidden above the breakpoint — desktop navigation is untouched.
      '.mp-mnav-btn,.mp-mnav-panel,.mp-mnav-scrim{display:none}' +
      '@media(max-width:768px){' +
        '.mp-nav-desktop-only{display:none!important}' +
        // Content clears the fixed button rather than running under it.
        'body.mp-has-mnav{padding-top:58px}' +
        '.mp-mnav-btn{display:flex;position:fixed;top:14px;right:14px;z-index:9999;' +
          'width:44px;height:44px;border-radius:50%;border:none;cursor:pointer;' +
          'align-items:center;justify-content:center;flex-direction:column;gap:5px;' +
          // Neutral translucent chip reads on both photo and flat-colour heroes.
          'background:rgba(0,0,0,0.42);-webkit-backdrop-filter:blur(6px);backdrop-filter:blur(6px);' +
          'padding:0;-webkit-tap-highlight-color:transparent}' +
        '.mp-mnav-btn span{display:block;width:19px;height:1.5px;background:#fff;border-radius:2px;' +
          'transition:transform .28s ease,opacity .2s ease}' +
        '.mp-mnav-scrim{display:block;position:fixed;inset:0;z-index:9997;background:rgba(0,0,0,0.45);' +
          'opacity:0;pointer-events:none;transition:opacity .28s ease}' +
        '.mp-mnav-scrim.open{opacity:1;pointer-events:auto}' +
        '.mp-mnav-panel{display:block;position:fixed;top:0;right:0;bottom:0;z-index:9998;' +
          'width:min(78vw,300px);background:' + dp.bg + ';color:' + dp.ink + ';' +
          'transform:translateX(100%);transition:transform .3s cubic-bezier(.4,0,.2,1);' +
          'padding:76px 26px 30px;overflow-y:auto;box-shadow:-12px 0 34px rgba(0,0,0,0.18)}' +
        '.mp-mnav-panel.open{transform:translateX(0)}' +
        '.mp-mnav-panel a{display:block;padding:15px 0;text-decoration:none;color:' + dp.ink + ';' +
          'font-size:0.94rem;letter-spacing:0.13em;text-transform:uppercase;' +
          'border-bottom:1px solid ' + dp.rule + '}' +
        '.mp-mnav-panel a:last-child{border-bottom:none}' +
        'body.mp-mnav-open{overflow:hidden}' +
        // RSVP fields: 16px is the floor that stops iOS zooming the page on
        // focus. Templates were setting larger sizes, which read as oversized
        // on a phone, so this pins them all to the floor.
        // :where() gives these zero specificity, so they act as a default that
        // any template rule beats. Dropping !important wasn't enough on its own:
        // this stylesheet is injected at runtime, so it comes last in the
        // cascade and won ties against the templates' own mobile rules.
        ':where(.rsvp-name-input,.rsvp-text-input,.rsvp-select,.rsvp-textarea){' +
          'font-size:16px;padding-top:0.7rem;padding-bottom:0.7rem}' +
        ':where(.rsvp-name-input){text-align:center}' +
      '}';
    document.head.appendChild(style);

    // Tag the template's own navigation so CSS can drop it on small screens.
    try {
      Array.prototype.slice.call(document.querySelectorAll(NAV_CONTAINERS)).forEach(function (el) {
        el.classList.add('mp-nav-desktop-only');
      });
    } catch (e) {}

    var scrim = document.createElement('div');
    scrim.className = 'mp-mnav-scrim';

    var panel = document.createElement('nav');
    panel.className = 'mp-mnav-panel';
    panel.setAttribute('aria-label', 'Menu');
    panel.innerHTML = links.map(function (l) {
      return '<a href="' + esc(l.href) + '">' + esc(l.label) + '</a>';
    }).join('');

    var btn = document.createElement('button');
    btn.className = 'mp-mnav-btn';
    btn.type = 'button';
    btn.setAttribute('aria-label', 'Open menu');
    btn.setAttribute('aria-expanded', 'false');
    btn.innerHTML = '<span></span><span></span><span></span>';

    var open = false;
    function setOpen(next) {
      open = next;
      panel.classList.toggle('open', open);
      scrim.classList.toggle('open', open);
      document.body.classList.toggle('mp-mnav-open', open);
      btn.setAttribute('aria-expanded', open ? 'true' : 'false');
      btn.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
      var bars = btn.querySelectorAll('span');
      if (bars.length === 3) {
        bars[0].style.transform = open ? 'translateY(6.5px) rotate(45deg)' : '';
        bars[1].style.opacity = open ? '0' : '1';
        bars[2].style.transform = open ? 'translateY(-6.5px) rotate(-45deg)' : '';
      }
    }

    btn.addEventListener('click', function () { setOpen(!open); });
    scrim.addEventListener('click', function () { setOpen(false); });
    // Tapping a link should close the drawer and let the anchor scroll.
    panel.addEventListener('click', function (e) {
      if (e.target && e.target.tagName === 'A') setOpen(false);
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && open) setOpen(false);
    });

    document.body.appendChild(scrim);
    document.body.appendChild(panel);
    document.body.appendChild(btn);
    // Reserves the strip the fixed button occupies, so hero names and
    // headers don't run underneath it.
    // Full-bleed photo heroes let the button sit over the image; everything
    // else reserves a strip so the button doesn't land on the couple's names.
    if (!CFG.navOverHero) document.body.classList.add('mp-has-mnav');
  }

  /* ==========================================================================
     THINGS TO DO
     ==========================================================================
     Every template now carries a #things-to-do section. It used to be appended
     as an item inside the FAQ accordion, which meant the toggle appeared to do
     nothing and the content couldn't be reached from the menu.
  ========================================================================== */
  /* Optional sections are off by default, so they never appeared in a design
     mock and several inherited a class that carries no vertical padding of its
     own — Coastal Chic, Modern Minimal, Pressed Petals and Regal Boho. Switch
     one on and the copy sits flush against the section below it.

     :where() gives this zero specificity, so it fills a gap and never wins an
     argument: the six templates that do style their own section keep exactly
     what they have. Same reasoning as the RSVP field defaults above. */
  function ensureOptionalSectionSpacing() {
    if (document.getElementById('mp-optional-section-css')) return;
    var s = document.createElement('style');
    s.id = 'mp-optional-section-css';
    s.textContent =
      ':where(#things-to-do,#gallery){padding-top:3rem;padding-bottom:3rem}' +
      '@media(max-width:768px){' +
        ':where(#things-to-do,#gallery){padding-top:1.8rem;padding-bottom:1.8rem}' +
      '}';
    document.head.appendChild(s);
  }


  /* ── COUPLE NAMES MUST NEVER BE CLIPPED ─────────────────────────────────────
     Four templates set the hero name at a viewport-scaled size with
     white-space:nowrap (Pressed Petals, Coastal Chic, Golden Hour, Sage and
     Still). Because the size scales with the viewport AND wrapping is
     forbidden, whether the name fits depends only on HOW MANY CHARACTERS it
     has, not on the screen. Every design's sample name fits at every width;
     a longer real name overflows at every width. That is why this never showed
     up in a mock and why it is not a responsive bug.

     Fixing it per template would mean re-tuning four different hero designs
     blind. This measures instead: the name is compared against the box it sits
     in, and ONLY if it actually overflows is anything changed. A name that
     fits is left completely alone, so the designs are untouched in the normal
     case.

     Order matters. A modest shrink keeps a one-line design on one line, which
     is what the designs intend; wrapping is only allowed once shrinking alone
     stops being enough, and clipping is never allowed at all. */
  var MP_FIT_MIN     = 0.45;  /* never below 45% of the designed size */
  var MP_FIT_WRAP_AT = 0.65;  /* allow wrapping once past this reduction */

  function _fitHost(el) {
    /* The box the name must stay inside. For an absolutely positioned name the
       containing block is the offsetParent; for a name in normal flow it is the
       parent, which for a grid item is its cell. Using offsetParent for both
       was wrong: a grid item's offsetParent is the whole grid, so a name
       overflowing its COLUMN measured as fitting. */
    var host;
    try {
      var pos = getComputedStyle(el).position;
      host = (pos === 'absolute' || pos === 'fixed')
        ? (el.offsetParent || el.parentElement)
        : el.parentElement;
    } catch (e) { host = el.parentElement; }
    if (!host || host === document.body) host = el.parentElement || host;
    return host;
  }

  /* Templates that split the names across their own line elements are telling
     us how many lines the design has. Sage and Still writes
     <span class="line">Monika1</span><span class="line">&amp; Manish</span>,
     so each span is meant to be ONE line. On a narrow column "& Manish" wrapped
     to two, making three lines where the design has two: the names never left
     their box, so a box-overflow test alone reported everything as fine while
     the photo beside them was pushed off screen. */
  function _lineWraps(el) {
    try {
      var lines = el.querySelectorAll ? el.querySelectorAll('.line') : null;
      if (!lines || !lines.length) return false;
      var cs = getComputedStyle(el);
      var lh = parseFloat(cs.lineHeight);
      if (!lh || isNaN(lh)) lh = (parseFloat(cs.fontSize) || 0) * 1.2;
      if (!lh) return false;
      for (var i = 0; i < lines.length; i++) {
        var r = lines[i].getBoundingClientRect();
        if (r.height > lh * 1.45) return true;   /* this span took 2+ lines */
      }
    } catch (e) {}
    return false;
  }

  function _nameOverflows(el, host) {
    try {
      var b = el.getBoundingClientRect(), h = host.getBoundingClientRect();
      if (!b.width || !h.width) return false;
      /* scrollWidth catches a nowrap line inside a clipped box; the rect
         comparison catches a name spilling out of an overlay or a hero it is
         positioned against, which scrollWidth alone cannot see. */
      if (el.scrollWidth > el.clientWidth + 1) return true;
      if (_lineWraps(el)) return true;
      return (b.right > h.right + 1) || (b.left < h.left - 1) || (b.bottom > h.bottom + 1);
    } catch (e) { return false; }
  }

  function fitOneName(el) {
    if (!el) return;
    var host = _fitHost(el);
    if (!host) return;
    /* Start from the template's own values every time, so repeated runs are
       idempotent and a window that grows back gets the full size back. */
    el.style.removeProperty('font-size');
    el.style.removeProperty('white-space');
    el.style.removeProperty('overflow-wrap');
    if (!_nameOverflows(el, host)) return;

    var base = parseFloat(getComputedStyle(el).fontSize) || 0;
    if (!base) return;

    var scale = 1, wrapped = false;
    for (var i = 0; i < 24 && scale > MP_FIT_MIN; i++) {
      scale -= 0.05;
      if (!wrapped && scale <= MP_FIT_WRAP_AT) {
        el.style.whiteSpace  = 'normal';
        el.style.overflowWrap = 'break-word';
        wrapped = true;
      }
      el.style.fontSize = (base * scale).toFixed(2) + 'px';
      if (!_nameOverflows(el, host)) return;
    }
    /* Floor reached and still tight. Wrapped and small beats clipped. */
    el.style.whiteSpace   = 'normal';
    el.style.overflowWrap = 'break-word';
  }

  function fitCoupleNames() {
    var ids = [CFG.heroNamesId, 'heroCoupleNames', 'heroNames', 'heroInitialsWrap',
               'footerNames', 'footerCouple', 'menuCoupleName'];
    var seen = {};
    for (var i = 0; i < ids.length; i++) {
      var id = ids[i];
      if (!id || seen[id]) continue;
      seen[id] = 1;
      var el = document.getElementById(id);
      if (el) { try { fitOneName(el); } catch (e) {} }
    }
  }

  var _nameFitBound = false;
  function scheduleNameFit() {
    var run = function () { try { fitCoupleNames(); } catch (e) {} };
    /* Two frames: one for the write to land, one for layout to settle. */
    if (window.requestAnimationFrame) {
      requestAnimationFrame(function () { requestAnimationFrame(run); });
    } else { setTimeout(run, 0); }
    /* The script faces load late and change the metrics completely. Measuring
       before they arrive measures the fallback face and gets the wrong answer,
       which is the same trap the stationery editor hit with its font binding. */
    try { if (document.fonts && document.fonts.ready) document.fonts.ready.then(run); } catch (e) {}
    setTimeout(run, 400);
    if (!_nameFitBound) {
      _nameFitBound = true;
      var t = null;
      window.addEventListener('resize', function () {
        clearTimeout(t); t = setTimeout(run, 150);
      });
    }
  }

  function hydrateThingsToDo(d) {
    ensureOptionalSectionSpacing();
    var section = document.getElementById('things-to-do');
    if (!section) return;
    var menu = d.menu_config || {};
    var body = document.getElementById('thingsToDoText');
    var content = d.things_to_do && String(d.things_to_do).trim();
    // Emptied on purpose: clear the sample sitting in the markup rather than
    // leaving it on screen.
    if (body && d.things_to_do !== undefined && d.things_to_do !== null && !content) {
      body.innerHTML = '';
    }

    section.style.display = menu.things_to_do ? '' : 'none';
    if (!menu.things_to_do) return;

    if (body && content) body.innerHTML = d.things_to_do;
    else if (body) window.MP_SHOWING_PLACEHOLDERS = true;
  }

  /* ==========================================================================
     REGISTRY PREVIEW
     ==========================================================================
     Templates that show a few product cards above the "View Our Registry"
     button fill them with stock photos. The backend already exposes the real
     items at /public/registry/by-slug/{slug}, so pull the first few and show
     those instead — a genuine preview that the button then opens in full.

     Fails quietly: if the registry is unpublished, password-gated, empty or
     unreachable, the template's own placeholder cards stay exactly as they are.
  ========================================================================== */
  function hydrateRegistryPreview(d) {
    var grid = document.getElementById('registryGrid');
    if (!grid || _isPreview) return;
    var slug = window._weddingSlug || _liveSlug || '';
    if (!slug) return;

    var cards = grid.querySelectorAll('.registry-card');
    if (!cards.length) return;

    fetch(API + '/public/registry/by-slug/' + encodeURIComponent(slug))
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (reg) {
        if (!reg || reg.password_required || reg.not_published) return;
        // The API already returns items in the couple's arranged order
        // (sort_order). Take them as they come — filtering out image-less items
        // reordered the preview relative to the registry itself, which is why
        // it looked shuffled.
        var items = (reg.items || []).slice(0, cards.length);
        if (!items.length) return;

        var registryUrl = '/' + encodeURIComponent(slug) + '/registry';
        injectPreviewStyles();

        for (var i = 0; i < cards.length; i++) {
          if (i >= items.length) { cards[i].style.display = 'none'; continue; }
          renderPreviewCard(cards[i], items[i], registryUrl);
        }
      })
      .catch(function () { /* placeholder cards stand */ });
  }

  function fmtMoney(cents) {
    var n = Number(cents || 0) / 100;
    try {
      return n.toLocaleString('en-US', {
        style: 'currency', currency: 'USD',
        minimumFractionDigits: n % 1 === 0 ? 0 : 2,
        maximumFractionDigits: 2
      });
    } catch (e) { return '$' + n.toFixed(0); }
  }

  function injectPreviewStyles() {
    if (document.getElementById('mp-regprev-css')) return;
    var st = document.createElement('style');
    st.id = 'mp-regprev-css';
    // Inherits each template's own card styling; these only add the parts the
    // templates have no markup for.
    st.textContent =
      '.registry-card{position:relative}' +
      '.mp-reg-badge{position:absolute;top:8px;right:8px;z-index:2;' +
        'width:26px;height:26px;border-radius:50%;display:flex;align-items:center;' +
        'justify-content:center;background:rgba(255,255,255,0.92);' +
        'box-shadow:0 1px 4px rgba(0,0,0,0.18);font-size:13px;line-height:1;color:#c0392b}' +
      '.mp-reg-price{font-size:0.86rem;opacity:0.85;margin-top:2px}' +
      '.mp-reg-meta{font-size:0.72rem;opacity:0.65;margin-top:2px}' +
      '.mp-reg-gifted{opacity:0.55}';
    document.head.appendChild(st);
  }

  function renderPreviewCard(card, it, registryUrl) {
    var img = card.querySelector('img');
    var name = card.querySelector('.registry-card-name, .registry-item-name');
    var btn = card.querySelector('a');

    if (img) {
      if (it.image_url) { img.src = it.image_url; img.alt = it.title || ''; img.style.display = ''; }
      else { img.style.visibility = 'hidden'; }   // keeps the card's shape
    }
    if (name) name.textContent = it.title || '';

    // Most-wanted heart, as on the registry page.
    var old = card.querySelector('.mp-reg-badge');
    if (old) old.remove();
    if (it.is_most_wanted) {
      var badge = document.createElement('span');
      badge.className = 'mp-reg-badge';
      badge.setAttribute('title', 'Most wanted');
      badge.textContent = '\u2665';
      card.insertBefore(badge, card.firstChild);
    }

    // Price, or the goal for a cash fund.
    var isFund = Number(it.price_cents) === 0 && Number(it.goal_amount_cents) > 0;
    var amount = isFund ? it.goal_amount_cents : it.price_cents;
    var priceEl = card.querySelector('.mp-reg-price');
    if (!priceEl && name) {
      priceEl = document.createElement('div');
      priceEl.className = 'mp-reg-price';
      name.parentNode.insertBefore(priceEl, name.nextSibling);
    }
    if (priceEl) {
      priceEl.textContent = amount ? fmtMoney(amount) + (isFund ? ' goal' : '') : '';
      priceEl.style.display = amount ? '' : 'none';
    }

    // Group gift / remaining count, the way the registry page shows it.
    var metaEl = card.querySelector('.mp-reg-meta');
    if (!metaEl && priceEl) {
      metaEl = document.createElement('div');
      metaEl.className = 'mp-reg-meta';
      priceEl.parentNode.insertBefore(metaEl, priceEl.nextSibling);
    }
    if (metaEl) {
      var bits = [];
      if (it.is_group_gift) bits.push('Group gift');
      if (typeof it.quantity_remaining === 'number' &&
          it.quantity_remaining > 0 && it.quantity_requested > 1) {
        bits.push(it.quantity_remaining + ' of ' + it.quantity_requested + ' left');
      }
      metaEl.textContent = bits.join(' \u00b7 ');
      // Collapse when empty, so a card with no quantity line doesn't reserve
      // space for one.
      metaEl.style.display = bits.length ? '' : 'none';
    }

    if (btn) {
      // Always the couple's own registry page — that's where contributing
      // happens, not an external retailer.
      btn.setAttribute('href', registryUrl);
      btn.setAttribute('target', '_blank');
      btn.setAttribute('rel', 'noopener');
      var soldOut = it.quantity_remaining === 0;
      btn.textContent = soldOut ? 'Fully gifted' : (isFund ? 'Contribute' : 'Purchase this Item');
      card.classList.toggle('mp-reg-gifted', !!soldOut);
    }
  }

  /* ==========================================================================
     BRAND FOOTER
     ==========================================================================
     The MyPlanning.ai footer that sits below every couple's own footer. Lives
     here rather than in the ten templates so the links only have to be updated
     in one place when legal pages change.

     Links MUST be absolute. Wedding sites are served from weddings.myplanning.ai,
     where a relative "/about-us" would be caught by the /:slug rewrite in
     vercel.json and render the "page not found" screen.
  ========================================================================== */
  // Confirmed: the marketing site lives on the www subdomain.
  var BRAND_BASE = 'https://www.myplanning.ai';
  var BRAND_LOGO = 'https://assets.softr-files.com/applications/98da9671-14f5-418f-b98a-6f8fb833401f/assets/8815fd0e-bd66-4add-8c28-b9ec1e2509e3.png';

  // Labels and paths mirror the main-site footer block. "Your Privacy Choices"
  // is required by CCPA/CPRA and the Privacy and Cookie policies refer to it by
  // name, so the wording is fixed — don't shorten it.
  var BRAND_LINKS = [
    { label: 'About Us',                 href: '/about-us' },
    { label: 'Get In Touch',             href: '/get-in-touch' },
    { label: 'Terms of Use',             href: '/terms-of-use' },
    { label: 'Privacy & Cookie Policy',  href: '/privacy-policy' },
    { label: 'Your Privacy Choices',     href: '/privacy-choices' }
  ];

  // ── Colour maths ─────────────────────────────────────────────────────────
  // The footer takes its colours from the live page, so it tracks both the
  // template default AND anything the couple overrode in the editor (the
  // template writes those overrides onto the same CSS vars we read here).
  // Type stays brand — Instrument Serif + Open Sans — on every template.

  function parseColor(str) {
    if (!str) return null;
    str = String(str).trim();
    var m = str.match(/^#([0-9a-f]{3})$/i);
    if (m) {
      return {
        r: parseInt(m[1][0] + m[1][0], 16),
        g: parseInt(m[1][1] + m[1][1], 16),
        b: parseInt(m[1][2] + m[1][2], 16)
      };
    }
    m = str.match(/^#([0-9a-f]{6})([0-9a-f]{2})?$/i);
    if (m) {
      return {
        r: parseInt(m[1].slice(0, 2), 16),
        g: parseInt(m[1].slice(2, 4), 16),
        b: parseInt(m[1].slice(4, 6), 16)
      };
    }
    m = str.match(/^rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)/i);
    if (m) return { r: +m[1], g: +m[2], b: +m[3] };
    return null;
  }

  function relLuminance(c) {
    var f = function (v) {
      v = v / 255;
      return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    };
    return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b);
  }

  function contrastRatio(a, b) {
    var la = relLuminance(a), lb = relLuminance(b);
    var hi = Math.max(la, lb), lo = Math.min(la, lb);
    return (hi + 0.05) / (lo + 0.05);
  }

  function rgba(c, alpha) {
    return 'rgba(' + Math.round(c.r) + ',' + Math.round(c.g) + ',' + Math.round(c.b) + ',' + alpha + ')';
  }

  function cssVar(name, fallback) {
    if (!name) return fallback;
    try {
      var v = getComputedStyle(document.documentElement).getPropertyValue(name);
      v = (v || '').trim();
      return v || fallback;
    } catch (e) { return fallback; }
  }

  // Resolve the footer's ground + ink. `override` lets the Save the Date screen
  // pass colours directly, since no template stylesheet is applied there.
  function resolveFooterColors(override) {
    var vars = CFG.footerVars || {};
    var bgRaw = (override && override.bg) || cssVar(vars.bg, CFG.palette.bg);
    var inkRaw = (override && override.ink) || cssVar(vars.ink, CFG.palette.ink);

    var bg = parseColor(bgRaw) || parseColor(CFG.palette.bg) || { r: 249, g: 247, b: 245 };
    var ink = parseColor(inkRaw) || parseColor(CFG.palette.ink) || { r: 18, g: 18, b: 18 };

    // A couple can set any hex they like. If their text colour doesn't stand up
    // against the footer ground, fall back to whichever of black/white actually
    // reads better — not a luminance threshold, which picks white on mid-tone
    // grounds like Heirloom Bloom's gold where black is the more legible choice.
    if (contrastRatio(ink, bg) < 4.5) {
      var black = { r: 18, g: 18, b: 18 };
      var white = { r: 255, g: 255, b: 255 };
      ink = contrastRatio(black, bg) >= contrastRatio(white, bg) ? black : white;
    }

    return {
      bg: 'rgb(' + Math.round(bg.r) + ',' + Math.round(bg.g) + ',' + Math.round(bg.b) + ')',
      ink: 'rgb(' + Math.round(ink.r) + ',' + Math.round(ink.g) + ',' + Math.round(ink.b) + ')',
      rule: rgba(ink, 0.22),
      // The wordmark is dark artwork on transparency. Invert it only when the
      // resolved INK is light — tying it to the ink rather than the ground
      // keeps the logo and the link text the same colour on mid-tone grounds.
      logoFilter: relLuminance(ink) > 0.6 ? 'brightness(0) invert(1)' : 'none'
    };
  }

  var BRAND_FOOTER_CSS =
    '.mp-brand-footer{background:var(--mp-bf-bg,#F9F7F5);width:100%;margin:0;padding:0;' +
      'font-family:"Instrument Serif",Georgia,serif;color:var(--mp-bf-ink,#121212);' +
      '-webkit-font-smoothing:antialiased;box-sizing:border-box}' +
    '.mp-brand-footer *{box-sizing:border-box}' +
    // Dotted rules top and bottom, matching the main site footer.
    '.mp-brand-footer .mp-bf-rule{height:8px;width:100%;' +
      'background-image:repeating-linear-gradient(90deg,transparent,transparent 4px,' +
      'var(--mp-bf-rule,#e8e6e3) 4px,var(--mp-bf-rule,#e8e6e3) 5px,transparent 5px,transparent 8px);' +
      'background-size:12px 100%}' +
    '.mp-brand-footer .mp-bf-rule.bottom{height:4px}' +
    '.mp-brand-footer .mp-bf-inner{max-width:1100px;margin:0 auto;padding:28px 20px 24px;text-align:center}' +
    '.mp-brand-footer .mp-bf-logo{display:inline-block;margin:0 auto 20px}' +
    '.mp-brand-footer .mp-bf-logo img{height:44px;width:auto;object-fit:contain;display:block;border:0;' +
      'filter:var(--mp-bf-logo-filter,none)}' +
    '.mp-brand-footer .mp-bf-links{display:flex;flex-wrap:wrap;justify-content:center;' +
      'align-items:center;gap:10px 34px;margin:0 0 16px;padding:0;list-style:none}' +
    '.mp-brand-footer .mp-bf-links a{font-family:"Instrument Serif",Georgia,serif;' +
      'font-size:1.014rem;line-height:1.3;color:var(--mp-bf-ink,#121212);text-decoration:none;white-space:nowrap}' +
    '.mp-brand-footer .mp-bf-links a:hover{text-decoration:underline}' +
    '.mp-brand-footer .mp-bf-copy{font-family:"Open Sans",system-ui,-apple-system,sans-serif;' +
      'font-size:11px;line-height:1.6;color:var(--mp-bf-ink,#121212);opacity:0.8;margin:0}' +
    '@media(max-width:640px){' +
      '.mp-brand-footer .mp-bf-inner{padding:24px 16px 20px}' +
      '.mp-brand-footer .mp-bf-logo img{height:38px}' +
      '.mp-brand-footer .mp-bf-links{gap:8px 20px;margin-bottom:14px}' +
      '.mp-brand-footer .mp-bf-links a{font-size:0.94rem}' +
    '}' +
    // Never show the brand footer in the editor's carousel thumbnails.
    'body.thumbnail-mode .mp-brand-footer{display:none!important}';

  function ensureBrandFonts() {
    if (document.getElementById('mp-brand-fonts')) return;
    var link = document.createElement('link');
    link.id = 'mp-brand-fonts';
    link.rel = 'stylesheet';
    link.href = 'https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1' +
                '&family=Open+Sans:wght@400;600&display=swap';
    document.head.appendChild(link);
  }

  function brandFooterHtml() {
    var links = BRAND_LINKS.map(function (l) {
      return '<li><a href="' + BRAND_BASE + l.href + '">' + esc(l.label) + '</a></li>';
    }).join('');
    return '' +
      '<div class="mp-bf-rule"></div>' +
      '<div class="mp-bf-inner">' +
        '<a class="mp-bf-logo" href="' + BRAND_BASE + '/">' +
          '<img src="' + BRAND_LOGO + '" alt="MyPlanning.ai">' +
        '</a>' +
        '<ul class="mp-bf-links">' + links + '</ul>' +
        '<p class="mp-bf-copy">Copyright \u00a9 ' + new Date().getFullYear() +
          ' MyPlanning.ai, Inc. All rights reserved. Patent Pending.</p>' +
      '</div>' +
      '<div class="mp-bf-rule bottom"></div>';
  }

  function renderBrandFooter(override) {
    if (document.querySelector('.mp-brand-footer')) return;
    ensureBrandFonts();
    if (!document.getElementById('mp-brand-footer-css')) {
      var style = document.createElement('style');
      style.id = 'mp-brand-footer-css';
      style.textContent = BRAND_FOOTER_CSS;
      document.head.appendChild(style);
    }
    var footer = document.createElement('footer');
    footer.className = 'mp-brand-footer';
    var c = resolveFooterColors(override);
    footer.style.setProperty('--mp-bf-bg', c.bg);
    footer.style.setProperty('--mp-bf-ink', c.ink);
    footer.style.setProperty('--mp-bf-rule', c.rule);
    footer.style.setProperty('--mp-bf-logo-filter', c.logoFilter);
    footer.innerHTML = brandFooterHtml();
    document.body.appendChild(footer);
  }

  /* ==========================================================================
     HYDRATION
     ========================================================================== */
  /* MP-310. Templates ship sample photographs in their markup, so the browser
     has fetched and decoded those before hydrate swaps in the couple's URLs.
     reveal() then painted the sample for however long the real image took to
     arrive — the flash of someone else's wedding on first load.

     Hold the reveal until the hero has actually loaded. Capped at 2.5s: a slow
     or broken photograph must never leave the page hidden, and the sample is a
     better outcome than a blank screen.

     Covers both shapes of hero: an <img> (most templates) and a CSS background
     (Golden Hour composites three). Probing a background URL through Image()
     is free once the browser has it, and correct when it does not. */
  function _heroSources() {
    var urls = [];
    try {
      var img = document.getElementById('heroImg') ||
                document.querySelector('.hero img, .hero-image img, #hero img');
      if (img && img.getAttribute('src')) urls.push({ el: img, url: img.getAttribute('src') });

      var bgHosts = document.querySelectorAll('#heroCol1, .hero-section, .hero, #hero');
      for (var i = 0; i < bgHosts.length && urls.length < 3; i++) {
        var bg = bgHosts[i].style && bgHosts[i].style.backgroundImage;
        var m = bg && /url\(['"]?([^'")]+)/.exec(bg);
        if (m) urls.push({ el: null, url: m[1] });
      }
    } catch (e) {}
    return urls;
  }

  function revealWhenHeroReady() {
    var sources = _heroSources();
    if (!sources.length) { reveal(); return; }

    var pending = 0, settled = false;
    var finish = function () { if (settled) return; settled = true; reveal(); };
    var one = function () { if (--pending <= 0) finish(); };

    for (var i = 0; i < sources.length; i++) {
      var s = sources[i];
      if (s.el && s.el.complete) continue;
      pending++;
      var probe = s.el || new Image();
      probe.addEventListener('load', one);
      probe.addEventListener('error', one);
      if (!s.el) probe.src = s.url;
    }
    if (!pending) { finish(); return; }
    setTimeout(finish, 2500);
  }

  /* True only while the preview is showing the template's OWN sample payload
     because no editor answered. Distinct from MP_SHOWING_PLACEHOLDERS, which
     means "a section fell back to sample copy" and is true for many real
     couples — reusing that one would have withheld the ack from them. */
  var _previewSampleOnly = false;

  /* One line per preview frame, at the moment it becomes visible, saying how it
     got there. Console output from an iframe appears in the parent's console,
     so this is readable from the editor page without selecting frames.
     Preview only — a guest's site never logs. */
  var _mpT0 = (window.performance && performance.now) ? performance.now() : Date.now();
  var _mpMark = {};
  function mpMark(name) {
    if (!_isPreview) return;
    var t = (window.performance && performance.now) ? performance.now() : Date.now();
    if (_mpMark[name] === undefined) _mpMark[name] = Math.round(t - _mpT0);
  }
  function mpTimeline() {
    if (!_isPreview) return;
    var who = (window.MP_TEMPLATE_ID || 'template') +
              (_params.get('thumbnail') === '1' ? ' thumb' : ' preview');
    try {
      console.log('[mp] ' + who +
        '  asked@' + (_mpMark.asked === undefined ? '-' : _mpMark.asked) +
        '  payload@' + (_mpMark.payload === undefined ? '-' : _mpMark.payload) +
        '  hydrated@' + (_mpMark.hydrated === undefined ? '-' : _mpMark.hydrated) +
        '  visible@' + (_mpMark.visible === undefined ? '-' : _mpMark.visible) +
        (_previewSampleOnly ? '  <-- SAMPLE DATA, no editor reply' : ''));
    } catch (e) {}
  }

  /* Lift the veil the template's head script put up. Called once the real
     content is in place, so the couple's photographs are the first thing that
     paints rather than the samples. */
  /* A link a couple added inside their own words. Templates style their
     navigation but say nothing about these, so on the published site they
     inherited the surrounding text and looked like ordinary copy: nothing to
     click, no hint that anything was there.

     Underlined, in the template's own colour rather than browser blue, with a
     pointer cursor and the address on hover. */
  function styleContentLinks() {
    if (document.getElementById('mp-content-links')) return;
    var s = document.createElement('style');
    s.id = 'mp-content-links';
    s.textContent =
      '.section a[href]:not([class]), .section-inner a[href]:not([class]),' +
      '[id$="Text"] a[href]:not([class]), [id$="List"] a[href]:not([class]),' +
      '[id$="Content"] a[href]:not([class]), [id$="Info"] a[href]:not([class]) {' +
        'color:inherit;text-decoration:underline;text-underline-offset:3px;' +
        'text-decoration-thickness:1px;cursor:pointer;' +
      '}' +
      '.section a[href]:not([class]):hover, .section-inner a[href]:not([class]):hover {' +
        'text-decoration-thickness:2px;' +
      '}';
    document.head.appendChild(s);
  }

  function liftVeil() {
    try {
      var v = document.getElementById('mp-veil');
      if (v && v.parentNode) v.parentNode.removeChild(v);
    } catch (e) {}
  }

  function reveal() {
    document.body.classList.remove('hydrating');
    document.body.style.visibility = 'visible';
    // The live page is held hidden by a script in the template's head until
    // this moment, so the couple's photographs are the first thing painted.
    styleContentLinks();
    liftVeil();
    // Told here rather than at the call sites, so every path that reveals also
    // acks — the editor lifts its placeholder at the same moment the page
    // becomes worth looking at, not a beat earlier.
    //
    // NOT after the sample-data fallback. The editor uses this to decide when a
    // frame is worth showing, and a frame full of the template's stock couple is
    // exactly what it is trying to avoid showing.
    mpMark('visible');
    mpTimeline();
    if (_isPreview && !_previewSampleOnly) {
      try { parent.postMessage({ type: 'TEMPLATE_HYDRATED' }, '*'); } catch (err) {}
    }
  }

  /* ==========================================================================
     COUPLE NAMES
     ==========================================================================
     Sites should show the couple, never the celebration record's name. The
     backend falls back to the Celebration Name when a partner field is blank,
     which is how "Wedding - Monika & Manish" ended up as the hero title. When
     that happens, strip the record-keeping wrapper off the front so what's
     left is just the names.
  ========================================================================== */
  var NAME_PREFIXES = [
    /^the\s+wedding\s+of\s+/i,
    /^wedding\s+of\s+/i,
    /^wedding\s*[-–—:]\s*/i,
    /^celebration\s+of\s+/i,
    /^celebration\s*[-–—:]\s*/i,
    /^the\s+marriage\s+of\s+/i
  ];
  var NAME_SUFFIXES = [
    /\s*[-–—:]\s*wedding$/i,
    /['’]s\s+wedding$/i,
    /\s+wedding$/i
  ];

  function cleanCoupleName(raw) {
    var out = String(raw || '').trim();
    if (!out) return '';
    NAME_PREFIXES.forEach(function (re) { out = out.replace(re, ''); });
    NAME_SUFFIXES.forEach(function (re) { out = out.replace(re, ''); });
    return out.trim();
  }

  function coupleNames(d) {
    var p1 = (d && d.partner_1 || '').trim();
    var p2 = (d && d.partner_2 || '').trim();
    if (p1 && p2) return p1 + ' & ' + p2;
    if (p1) return p1;
    if (p2) return p2;
    return cleanCoupleName(d && d.couple_names);
  }

  function isSaveTheDate(d) {
    return String(d && d.website_mode || 'Full').toLowerCase().indexOf('save') !== -1;
  }

  function hydrate(d) {
    if (!d) return;

    // 1. Gate screens first — these never fall through to the template.
    if (d.password_required) { renderPasswordScreen(coupleNames(d)); return; }
    if (d.not_published)     { renderComingSoon(coupleNames(d), d.celebration_date || ''); return; }

    window._weddingSlug = d.slug || _liveSlug || '';

    // Every template and the save-the-date screen read d.couple_names, so
    // normalise it here rather than in ten places.
    d.couple_names = coupleNames(d);

    // 2. RSVP entree options must be set before the template builds its blocks.
    if (d.rsvp_config && d.rsvp_config.entreesByEvent && typeof d.rsvp_config.entreesByEvent === 'object') {
      window._rsvpEntreeByEvent = d.rsvp_config.entreesByEvent;
    }
    if (d.rsvp_config && Array.isArray(d.rsvp_config.entrees) && d.rsvp_config.entrees.length) {
      window._rsvpEntreeOptions = d.rsvp_config.entrees
        .filter(Boolean)
        .map(function (e) { return { value: e, label: e }; });
    }

    // 3. Custom CSS + font, then hand off to the template's own layout code.
    //
    //    Reuse one element. hydrate() runs again on EVERY payload the editor
    //    posts, so appending appended a fresh <style> per keystroke; a long
    //    editing session left hundreds in the head for the browser to cascade
    //    on each repaint, which is a slow preview for no reason.
    if (d.custom_css) {
      var style = document.getElementById('mp-custom-css');
      if (!style) {
        style = document.createElement('style');
        style.id = 'mp-custom-css';
        document.head.appendChild(style);
      }
      if (style.textContent !== d.custom_css) style.textContent = d.custom_css;
    }
    // Per-role settings win. custom_font is the older single choice and stays
    // as the fallback so couples who made one keep it.
    if (!applyFontSettings(d)) applyCustomFont(d.custom_font);
    applyCustomColors(d);

    // Toggling a section on should show something. Templates gate most sections
    // on BOTH the menu toggle and the content field, so a couple who switches
    // one on before writing anything sees nothing happen and reasonably
    // concludes the save failed. Fill any empty field whose section is switched
    // on from the template's own SAMPLE_DATA, and flag that placeholders are
    // showing. Gallery is excluded: photographs can't be substituted.
    try {
      var SAMPLE = window.SAMPLE_DATA || (typeof SAMPLE_DATA !== 'undefined' ? SAMPLE_DATA : null);
      if (SAMPLE && d.menu_config) {
        var FIELD_FOR = {
          story: 'story', wedding: 'weddings_info', other_events: 'events_info',
          accommodations: 'accommodation_info', travel: 'travel_info',
          faqs: 'faqs', things_to_do: 'things_to_do', registry: 'registry_info'
        };
        Object.keys(FIELD_FOR).forEach(function (toggle) {
          var field = FIELD_FOR[toggle];
          var on = d.menu_config[toggle];
          // Only when the field is ABSENT. An empty string is a decision the
          // couple made with the Clear button, and substituting sample copy over
          // it made Clear look broken: the editor emptied and the site did not.
          // The editor warns them a switched-on empty section will render blank.
          var never = d[field] === undefined || d[field] === null;
          if (on && never && SAMPLE[field]) {
            d[field] = SAMPLE[field];
            window.MP_SHOWING_PLACEHOLDERS = true;
          }
        });
      }
    } catch (e) {}

    window.MP_SHOWING_PLACEHOLDERS = window.MP_SHOWING_PLACEHOLDERS || false;

    // Before the template reads it: a first line the couple typed or pasted is
    // as much a title as one that arrived already in bold.
    try { markTitles(d); } catch (e) {}

    try {
      if (typeof window.hydrateTemplate === 'function') window.hydrateTemplate(d);
    } catch (err) {
      console.error('[site-runtime] hydrateTemplate failed:', err);
    }

    // Renames run before the mobile nav is built, so the drawer copies the new
    // labels rather than the template's originals.
    applySectionHeadings(d);

    // After the template has drawn its own grid, so this replaces it rather
    // than racing it.
    try {
      var _gal = (d.gallery_images || []).map(function (g) {
        return typeof g === 'string' ? g : (g && g.url) || '';
      }).filter(Boolean);
      if (_gal.length) buildGalleryCarousel(_gal);
    } catch (e) {}

    // After any rename, so the editor is told what the page ends up saying.
    reportSectionHeadings();

    // The template has just written the couple's real names over the sample
    // ones. Anything longer than the sample can overflow, so check now.
    scheduleNameFit();

    // 5. RSVP deadline — one canonical accessor. Templates used to read three
    //    different keys, two of which the backend never sent.
    // ── RSVP deadline ────────────────────────────────────────────────────
    // Treated exactly like every other bit of template copy: the couple's
    // configured deadline replaces it, and until they set one the template's
    // own placeholder line stands.
    //
    // What it never does is derive a date. Falling back to the celebration date
    // produced "RSVP by [the wedding day]", and on records whose celebration
    // date disagrees with the event dates it printed a deadline contradicting
    // the schedule directly above it.
    var deadlineEl = document.getElementById('rsvpDeadline');
    if (deadlineEl) {
      var deadline = (d.rsvp_config && d.rsvp_config.deadline) || d.rsvp_deadline || '';
      if (deadline) {
        // Keep each template's phrasing ("Please send your response by …",
        // "Kindly …", "By …") and swap only the date.
        var raw = (deadlineEl.textContent || '').trim();
        var lead = raw.match(/^(.*\bby\s+)/i);
        deadlineEl.textContent = (lead ? lead[1] : 'by ') + fmtDate(deadline);
      }
      // else: the template's placeholder stands, as with any other sample copy
    }

    // 5. Mobile navigation. Built from the links the template just rendered,
    //    so it has to run after hydrateTemplate. Skipped for save-the-date,
    //    where there's nowhere to navigate to.
    if (!isSaveTheDate(d) || _isPreview) buildMobileNav();

    // 6. Save the Date trims the fully-rendered page down to its hero. It runs
    //    AFTER hydrateTemplate so the announcement uses the template's real
    //    hero — photo, type and colours — rather than a generic card. It is
    //    skipped in the editor (no slug): the mode governs what guests see, not
    //    what the couple can build and preview.
    /* Deliberately NOT in the editor preview. The preview is there to show the
       couple the site they are building; Save the Date hides almost all of it,
       which makes the panel look broken while they are still editing sections
       they cannot see. clearSaveTheDate still runs so that switching the mode
       off on the live site restores everything it hid. */
    if (!_isPreview && isSaveTheDate(d)) applySaveTheDate(d);
    else clearSaveTheDate();

    // 7. Registry links, then the MyPlanning.ai footer.
    wireRegistryLinks(d);
    hydrateThingsToDo(d);
    hydrateRegistryPreview(d);
    renderBrandFooter();

    // A Book Now with no link behind it is a broken button, and the booking link
    // is optional by design, so any call to action still pointing at nothing is
    // hidden. MP-336.
    //
    // AFTER the registry is wired, not before. The registry title ships as
    // href="#" and only becomes a real link in wireRegistryLinks — running the
    // sweep first hid the couple's registry link on every template, leaving a
    // menu entry pointing at an empty section.
    layOutRegistry();
    hideDeadCtas();

    // Both paths wait for the hero. The preview needs it as much as the live
    // site: its placeholder lifts on the ack, and the ack now comes from
    // reveal(), so it waits for the photograph too.
    revealWhenHeroReady();
  }

  /* ==========================================================================
     LOADING SCREEN
     ========================================================================== */
  function showLoading() {
    var p = CFG.loading || CFG.palette;
    document.body.innerHTML =
      '<style>@keyframes mpPulse{0%,100%{opacity:0.35}50%{opacity:1}}' +
      // The motif is static — no rotation, no pulse.
      '@keyframes mpSlide{0%{left:-100%}50%{left:0}100%{left:100%}}' +
      '@media(prefers-reduced-motion:reduce){.mp-motif{animation:none!important}}</style>' +
      '<div style="min-height:100vh;display:flex;flex-direction:column;align-items:center;' +
        'justify-content:center;gap:24px;background:' + p.bg + ';color:' + p.ink + '">' +
        (CFG.loadingImage
          ? '<img class="mp-motif" src="' + CFG.loadingImage + '" alt="" ' +
            'style="width:72px;height:72px;object-fit:contain">'
          : '') +
        '<p style="font-family:' + CFG.fonts.display + ';font-size:1.6rem;margin:0;' +
          'animation:mpPulse 2.2s ease-in-out infinite">Your celebration awaits</p>' +
        '<div style="width:120px;height:1px;background:' + p.rule + ';position:relative;overflow:hidden;border-radius:999px">' +
          '<div style="position:absolute;left:-100%;top:0;width:100%;height:100%;background:' + p.accent + ';' +
            'animation:mpSlide 1.8s ease-in-out infinite"></div>' +
        '</div>' +
      '</div>';
    document.body.classList.remove('hydrating');
    document.body.style.visibility = 'visible';
  }

  /* ==========================================================================
     BOOT
     ========================================================================== */
  function boot() {
    // Editor preview: no slug. Wait for a HYDRATE_TEMPLATE postMessage from the
    // Softr block; fall back to the template's SAMPLE_DATA if none arrives.
    if (_isPreview) {
      // MP-285. reveal() used to run FIRST, so the editor's preview painted the
      // template's built-in sample couple before the real payload arrived and
      // the couple watched someone else's names for a beat. Reveal after the
      // first hydrate instead, and tell the parent when that has happened so it
      // can drop its own placeholder at the same moment.
      //
      // In a finally block on purpose: if hydrate throws we still reveal, so a
      // bad payload shows a sample-data page rather than a permanently blank one.
      var got = false;

      // Ask for the payload NOW. This runs while the document is still parsing,
      // long before load, so the editor can answer before the fallback below
      // has any chance to fire. The editor also still sends on load, which
      // covers a frame that was already up when the listener was attached.
      mpMark('asked');
      try { parent.postMessage({ type: 'MP_PREVIEW_READY' }, '*'); } catch (err) {}

      var settle = function (payload, isPlaceholder) {
        _previewSampleOnly = !!isPlaceholder;
        mpMark(isPlaceholder ? 'fallback' : 'payload');
        mpMark('hydrated');
        /* MP-310 (preview/thumbnails). This was:
             try { hydrate(payload); } finally { reveal(); }
           and that finally is the preview's copy of the window._reveal bug that
           was just fixed for live. hydrate() ENDS with revealWhenHeroReady(),
           which returns immediately having only registered load handlers — so
           the synchronous reveal() straight after it removed body.hydrating
           before the couple's photograph had arrived. That is the flash.

           Worth being explicit, because I had this wrong at first: the preview
           is NOT uncovered. body.hydrating {visibility:hidden} lives in every
           template's head <style> and applies here exactly as on live; only the
           extra #mp-veil element is live-only. Nothing needed adding. The cover
           was being lifted too early.

           reveal() now runs only on the paths that would otherwise leave a
           permanently blank frame — a hydrate that threw, or a payload hydrate()
           refuses (`if (!d) return`, which reveals nothing). A hydrate that
           succeeded already reveals through revealWhenHeroReady(), which caps
           its own wait at 2.5s so a slow or broken photograph cannot hang it.

           The gate screens (password, Coming Soon, not found) reveal themselves
           via screenShell -> liftVeil + body.className = '', so their early
           returns out of hydrate() are already covered. */
        try {
          if (!payload) reveal();
          else hydrate(payload);
        } catch (err) {
          try { console.warn('[site-runtime] preview hydrate failed:', err); } catch (e) {}
          reveal();
        }
        /* Last-resort backstop. revealWhenHeroReady always settles within 2.5s,
           and the template's own timer only removes #mp-veil — it does not clear
           body.hydrating — so this is the only thing standing between an
           unforeseen stall and a frame the editor never gets to show. */
        setTimeout(reveal, 6000);
      };
      window.addEventListener('message', function (e) {
        if (!e.data) return;
        if (e.data.type === 'HYDRATE_TEMPLATE') {
          got = true;
          settle(e.data.payload);
          return;
        }
        if (e.data.type === 'MP_SECTION_CHANGE') {
          var sk = e.data.section, sl = e.data.label, so = e.data.on;
          // A menu-only toggle changes the navigation, not the page, so there
          // is nothing on screen to outline.
          if (e.data.noteOnly) {
            try { _floatSectionNote(sl, so); } catch (err) {}
            return;
          }
          /* Measure before the hydrate that follows hides it. */
          if (!so) { try { markSection(sk, sl, false); } catch (err) {} }
          else {
            /* Switched on: it may not be in the DOM yet, so wait for the
               payload to land before marking. */
            setTimeout(function () { try { markSection(sk, sl, true); } catch (err) {} }, 260);
          }
          return;
        }
        if (e.data.type === 'MP_SCROLL_TO') {
          /* A scroll asked for in the same tick as a toggle would run before the
             section had been shown, and a scroll asked for while the payload is
             still in flight would run before it exists at all. Retry for a
             short while rather than firing once and missing. */
          var key = e.data.section;
          var tries = 0;
          var attempt = function () {
            var done = false;
            try { done = scrollToSection(key); } catch (err) {}
            if (!done && ++tries < 12) setTimeout(attempt, 120);
            else if (window.MP_DEBUG) {
              console.log('[site-runtime] scroll to ' + key + (done ? ' ok' : ' failed: no visible anchor'));
            }
          };
          if (window.requestAnimationFrame) {
            requestAnimationFrame(function () { requestAnimationFrame(attempt); });
          } else {
            setTimeout(attempt, 32);
          }
        }
      });
      // Longer than 800ms: that was routinely beaten by the editor's
      // load-then-post round trip once there were eleven frames on a page, and
      // losing the race meant showing sample data. This is a backstop for a
      // template opened with no editor at all, not part of the normal path.
      setTimeout(function () {
        if (!got) settle(window.SAMPLE_DATA || {}, true);
      }, 2500);
      return;
    }

    // Live site. index.html hands the payload over in sessionStorage to avoid a
    // second round-trip. The key is KEPT rather than deleted so a refresh on a
    // password-protected site doesn't dead-end at the gate.
    //
    // But it was kept for the whole browser session, so once a tab had loaded a
    // site, every later visit in that tab replayed the same payload. A couple
    // who changed their fonts or colours and saved then went to look at the live
    // site and saw the old ones, apparently forever — the changes had saved
    // correctly and were simply never fetched again. MP-354.
    //
    // The handoff is only useful for the moment right after index.html fetched
    // it, so it now expires: fresh enough to skip the duplicate round-trip,
    // stale enough that a later visit asks the server again.
    var STASH_MAX_AGE_MS = 60000;
    var key = 'weddingData_' + _liveSlug;
    var stashed = null;
    try { stashed = sessionStorage.getItem(key); } catch (e) {}

    if (stashed) {
      try {
        var parsed = JSON.parse(stashed);
        var stampedAt = Number(parsed && parsed._mpStashedAt) || 0;

        // No stamp means index.html has just handed this over, one redirect ago.
        // That payload is fresh by definition and is exactly the round-trip the
        // handoff exists to save — my expiry check was discarding it, so every
        // visit refetched and the address stayed on the template file. Use it,
        // then delete the key so it can never be replayed later.
        if (!stampedAt) {
          try { sessionStorage.removeItem(key); } catch (e2) {}
        } else if ((Date.now() - stampedAt) > STASH_MAX_AGE_MS) {
          try { sessionStorage.removeItem(key); } catch (e2) {}
          throw new Error('stale');
        }
        hydrate(parsed);
        if (window.location.search.indexOf('slug=') !== -1) {
          try { window.history.replaceState({}, parsed.couple_names || '', '/' + _liveSlug); } catch (e) {}
        }
        return;
      } catch (e) {
        try { sessionStorage.removeItem(key); } catch (e2) {}
      }
    }

    showLoading();
    fetch(API + '/wedding-site/' + encodeURIComponent(_liveSlug) +
          (_pwdParam ? '?password=' + encodeURIComponent(_pwdParam) : ''))
      .then(function (r) {
        if (r.status === 404) throw new Error('not-found');
        if (!r.ok) throw new Error('http-' + r.status);
        return r.json();
      })
      .then(function (d) {
        if (!d.password_required && !d.not_published) {
          try {
            d._mpStashedAt = Date.now();
            sessionStorage.setItem(key, JSON.stringify(d));
          } catch (e) {}
        }
        hydrate(d);
        // Same tidy-up as the handoff path. Without it the address stayed on
        // the template file, which is what the couple sees and shares.
        if (window.location.search.indexOf('slug=') !== -1) {
          try {
            window.history.replaceState({}, d.couple_names || '', '/' + _liveSlug);
          } catch (e) {}
        }
      })
      .catch(function () { renderNotFound(); });
  }

  /* ==========================================================================
     EXPORTS — inline onclick= handlers in the generated RSVP markup need these
     on window, and templates call buildRsvpBlocks from hydrateTemplate.
     ========================================================================== */
  window.buildRsvpBlocks = buildRsvpBlocks;
  window.onNameInput = onNameInput;
  window.checkShowSubmit = checkShowSubmit;
  window.addExtraGuest = addExtraGuest;
  window.submitRSVP = submitRSVP;
  window.lookupGuest = lookupGuest;
  window.lookupGuestById = lookupGuestById;
  window.renderHousehold = renderHousehold;
  window.clearHousehold = clearHousehold;
  window.showAmbiguousMatches = showAmbiguousMatches;
  window.applyCustomFont = applyCustomFont;
  /* Deliberately NOT `reveal`. Eight templates end hydrateTemplate with
     _reveal(), and hydrateTemplate is called from hydrate() at the top — so
     binding this to reveal() lifted the veil mid-hydrate and defeated the whole
     MP-310 hero wait below. It also fired TEMPLATE_HYDRATED early, which made
     the editor drop its placeholder while the photograph was still arriving,
     and it ran before layOutRegistry/hideDeadCtas, so a dead CTA got a frame of
     screen time. Golden Hour and Heirloom Bloom don't call it, which is exactly
     why those two were the only templates not flashing.

     hydrate() always finishes with revealWhenHeroReady(), including when
     hydrateTemplate throws (its call is wrapped), so the template's call is
     redundant rather than load-bearing and is safe to ignore. The head-script
     timer still backstops a runtime that never runs at all.

     Kept as a function, not deleted: the templates call it, and an undefined
     _reveal would throw at the end of every hydrate. */
  window._reveal = function () { /* intentionally a no-op — see above */ };
  window.MP = {
    config: CFG,
    hydrate: hydrate,
    applySaveTheDate: applySaveTheDate,
    clearSaveTheDate: clearSaveTheDate,
    wireRegistryLinks: wireRegistryLinks,
    hydrateRegistryPreview: hydrateRegistryPreview,
    hydrateThingsToDo: hydrateThingsToDo,
    fitCoupleNames: fitCoupleNames,
    scrollToSection: scrollToSection,
    applySectionHeadings: applySectionHeadings,
    buildMobileNav: buildMobileNav,
    renderBrandFooter: renderBrandFooter,
    renderComingSoon: renderComingSoon,
    renderPasswordScreen: renderPasswordScreen,
    renderNotFound: renderNotFound,
    fmtDate: fmtDate,
    coupleNames: coupleNames
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
