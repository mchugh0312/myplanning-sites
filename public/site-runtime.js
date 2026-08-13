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
  window._rsvpEntreeOptions = [
    { value: 'Chicken', label: 'Chicken' },
    { value: 'Fish', label: 'Fish' },
    { value: 'Vegetarian', label: 'Vegetarian' },
    { value: 'Vegan', label: 'Vegan' },
    { value: 'Kids Meal', label: 'Kids Meal' }
  ];

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

  function entreeOptionsHtml() {
    return window._rsvpEntreeOptions.map(function (o) {
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

  function buildRsvpBlocks(events) {
    var container = document.getElementById('rsvpBlocks');
    if (!container) return;

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
          'onclick="addExtraGuest(this)" style="display:none">+ Add Invited Guest</button>' +
        '<div class="rsvp-field-row full" style="margin-bottom:0.75rem">' +
          '<input class="rsvp-text-input" type="email" id="rsvpEmail" ' +
            'placeholder="Email address (required) *" data-field="email" required ' +
            'oninput="checkShowSubmit()">' +
        '</div>' +
        '<div class="rsvp-field-row full" style="margin-bottom:0.5rem">' +
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
    list.innerHTML = _rsvpState.events.map(function (ev) {
      return '' +
        '<div class="rsvp-event-block" data-event-id="' + esc(ev.id) + '">' +
          '<div class="rsvp-event-label">' + esc(ev.label) + '</div>' +
          '<div class="rsvp-expanded visible">' +
            '<div class="rsvp-field-row" style="margin-bottom:0.6rem">' +
              '<select class="rsvp-select" data-field="attending" onchange="checkShowSubmit()">' +
                '<option value="">Do you plan to attend?</option>' +
                '<option value="yes">Yes</option>' +
                '<option value="no">Cannot make it</option>' +
                '<option value="maybe">Not sure yet</option>' +
              '</select>' +
              '<select class="rsvp-select" data-field="entree">' +
                '<option value="">Your entr\u00e9e choice</option>' + entreeOptionsHtml() +
              '</select>' +
            '</div>' +
          '</div>' +
        '</div>';
    }).join('');
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
    // Submit appears once the guest is on the list and has given an email. The
    // backend re-validates both; this is purely UX.
    var email = rsvpEl('rsvpEmail');
    var emailVal = email ? (email.value || '').trim() : '';
    var ok = !!_rsvpState.guestId && !!emailVal && emailVal.indexOf('@') > 0;
    var btn = document.getElementById('rsvpSubmitBtn');
    if (btn) btn.style.display = ok ? 'block' : 'none';
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
    var band = onDark ? 'rgba(255,255,255,0.14)' : 'rgba(0,0,0,0.05)';
    // The semantic colour survives on the left border, where contrast matters
    // less, so "found you" still reads differently from an error.
    var border = s.border;

    el.style.cssText = [
      'font-family:inherit', 'font-size:0.9rem', 'line-height:1.45',
      'padding:0.5rem 0.8rem', 'margin:0.6rem 0 0.2rem',
      'border-left:3px solid ' + border, 'border-radius:4px',
      'background:' + band, 'color:' + colour, 'display:block'
    ].join(';');
    el.textContent = text;
  }

  /* ── Guest lookup ─────────────────────────────────────────────────────── */
  function applyFoundGuest(json, displayName) {
    _rsvpState.guestId = json.guest_id || '';
    _rsvpState.matchedName = json.name || displayName || '';
    _rsvpState.plusOneAllowed = !!json.plus_one_allowed;
    _rsvpState.householdMembers = Array.isArray(json.household_members) ? json.household_members : [];

    var input = rsvpEl('rsvpNameInput');
    if (input && json.name) input.value = json.name;

    setStatus('ok', '\u2713 Found you on the list \u2014 ' + _rsvpState.matchedName);

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
          rejectGuest('ambiguous', 'Multiple matches \u2014 please pick yours below');
          showAmbiguousMatches(json.matches || []);
        } else {
          rejectGuest('unknown',
            "We couldn't find your name on the guest list. RSVPs are by invitation only \u2014 " +
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
      'We found a few matches \u2014 please pick yours:</div>';

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
    label.textContent = party ? 'Your household \u2014 ' + party + ' (' + count + ')' : 'Your household (' + count + ')';

    list.innerHTML = '';
    members.forEach(function (m, idx) {
      var row = document.createElement('div');
      row.className = 'rsvp-household-row';
      row.dataset.guestId = m.guest_id;
      row.dataset.memberIdx = String(idx);
      row.innerHTML =
        '<div class="rsvp-household-name">' + esc(m.name || '(household member)') +
          (m.is_primary ? '<span class="rsvp-household-name-primary-tag">primary contact</span>' : '') +
        '</div>' +
        '<div class="rsvp-household-controls three-up">' +
          '<select class="rsvp-select" data-h-field="attending">' +
            '<option value="">Attending?</option>' +
            '<option value="yes">Yes</option>' +
            '<option value="no">Cannot make it</option>' +
            '<option value="maybe">Not sure</option>' +
          '</select>' +
          '<select class="rsvp-select" data-h-field="meal">' + mealOptionsHtml(m.meal_preference) + '</select>' +
          '<select class="rsvp-select" data-h-field="entree">' +
            '<option value="">Entree (optional)</option>' + entreeOptionsHtml() +
          '</select>' +
        '</div>';
      list.appendChild(row);
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

    var entreeSel = document.createElement('select');
    entreeSel.className = 'rsvp-select';
    entreeSel.dataset.role = 'plus-one-entree';
    entreeSel.innerHTML = '<option value="">Entree (optional)</option>' + entreeOptionsHtml();

    controls.appendChild(mealSel);
    controls.appendChild(entreeSel);
    row.appendChild(controls);

    list.appendChild(row);
    btn.style.display = 'none';
  }

  /* ── Submit ───────────────────────────────────────────────────────────── */
  function submitRSVP() {
    if (_isPreview) { alert('RSVP is disabled in preview mode.'); return; }
    var btn = document.getElementById('rsvpSubmitBtn');
    if (!btn) return;

    var name = (rsvpEl('rsvpNameInput') || {}).value || '';
    var email = ((rsvpEl('rsvpEmail') || {}).value || '').trim();
    if (!_rsvpState.guestId || !name.trim() || !email || email.indexOf('@') < 1) {
      alert('Please enter your name as it appears on the invitation, and your email address.');
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
        var att = hr.querySelector('[data-h-field="attending"]');
        var attending = att ? (att.value || '').trim() : '';
        if (!attending) return; // unanswered rows leave existing RSVPs untouched
        var meal = hr.querySelector('[data-h-field="meal"]');
        var entree = hr.querySelector('[data-h-field="entree"]');
        householdRsvps.push({
          guest_id: gid,
          attending: attending,
          meal_preference: meal ? (meal.value || '') : '',
          entree_choice: entree ? (entree.value || '') : ''
        });
      });
    }

    var payloads = [];
    document.querySelectorAll('#rsvpEventList .rsvp-event-block').forEach(function (block) {
      var attendingEl = block.querySelector('[data-field="attending"]');
      var attending = attendingEl ? (attendingEl.value || '').trim() : '';
      if (!attending) return;   // unanswered events aren't submitted
      var entreeEl = block.querySelector('[data-field="entree"]');
      var labelEl = block.querySelector('.rsvp-event-label');
      payloads.push({
        slug: slug,
        guest_name: name.trim(),
        guest_id: _rsvpState.guestId,
        attending: attending,
        meal_preference: '',
        entree_choice: entreeEl ? (entreeEl.value || '') : '',
        email: email,
        dietary_notes: dietary,
        message: message,
        event_name: labelEl ? labelEl.textContent : '',
        plus_one: false,
        extra_guests: [],
        household_rsvps: []
      });
    });

    if (!payloads.length) {
      alert('Please let us know whether you can attend at least one event.');
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
      var anyOk = false, failMsg = null, total = 0;
      results.forEach(function (r) {
        if (r.ok) {
          anyOk = true;
          if (r.json && typeof r.json.total === 'number') total += r.json.total;
        } else if (!failMsg) {
          failMsg = (r.json && r.json.detail) || null;
        }
      });
      if (!anyOk) throw new Error(failMsg || 'RSVP submission failed.');

      var successEl = document.getElementById('rsvpSuccess');
      if (successEl) {
        if (total > 1) {
          var msgEl = successEl.querySelector('.rsvp-success-msg');
          var text = "Thank you! We've recorded RSVPs for " + total + ' people.';
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
      alert('Sorry \u2014 ' + (err && err.message ? err.message : 'something went wrong submitting your RSVP. Please try again.'));
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

  function applyCustomFont(fontName) {
    if (!fontName) return;
    var isCursive = CURSIVE_FONTS.some(function (f) { return fontName.indexOf(f) !== -1; });

    var link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://fonts.googleapis.com/css2?family=' +
      encodeURIComponent(fontName).replace(/%20/g, '+') + ':wght@300;400;500;600;700&display=swap';
    document.head.appendChild(link);

    var root = document.documentElement.style;
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

  function screenShell(inner, extraCss) {
    var p = CFG.palette;
    document.body.className = '';
    document.body.innerHTML =
      '<style>' +
      '.mp-screen{min-height:calc(100vh - 210px);display:flex;align-items:center;justify-content:center;' +
        'padding:56px 20px;background:' + p.bg + ';color:' + p.ink + ';text-align:center;box-sizing:border-box}' +
      'body{margin:0;background:' + p.bg + '}' +
      '.mp-screen *{box-sizing:border-box}' +
      '.mp-inner{max-width:560px;width:100%}' +
      '.mp-display{font-family:' + CFG.fonts.display + ';font-weight:400;line-height:1.1;margin:0;' +
        'font-size:clamp(2.6rem,8vw,4.4rem);color:' + p.ink + '}' +
      '.mp-body{font-family:' + CFG.fonts.body + ';font-size:1rem;line-height:1.7;opacity:0.85;margin:0 auto;max-width:440px}' +
      '.mp-eyebrow{font-family:' + CFG.fonts.body + ';font-size:0.72rem;letter-spacing:0.22em;' +
        'text-transform:uppercase;opacity:0.7;margin:0 0 18px}' +
      '.mp-date{font-family:' + CFG.fonts.body + ';font-size:0.95rem;letter-spacing:0.16em;' +
        'text-transform:uppercase;margin:18px 0 0;opacity:0.9}' +
      '.mp-rule{width:80px;height:1px;background:' + p.rule + ';margin:26px auto}' +
      '.mp-hero{width:100%;max-width:420px;aspect-ratio:4/5;object-fit:cover;margin:0 auto 30px;display:block}' +
      '.mp-foot{margin-top:44px;padding-top:20px;border-top:1px solid ' + p.rule + ';' +
        'font-family:' + CFG.fonts.body + ';font-size:0.66rem;letter-spacing:0.2em;text-transform:uppercase;opacity:0.5}' +
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

  function applySaveTheDate(d) {
    // 1. Hide every section below the hero. RSVP, registry, travel and the rest
    //    stay configured in the editor — they're simply not served to guests.
    (CFG.stdHideIds || []).forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.style.display = 'none';
    });

    // 2. Remove navigation, including the shared mobile drawer. With every
    //    target hidden, menu links would be dead ends.
    try {
      document.querySelectorAll(STD_NAV_SELECTORS + ',.mp-mnav-btn,.mp-mnav-panel,.mp-mnav-scrim')
        .forEach(function (el) { el.style.display = 'none'; });
    } catch (e) {}

    var hero = document.getElementById(CFG.heroId) ||
               document.querySelector('.hero, .hero-section');
    if (!hero || document.querySelector('.mp-std-top')) return;

    var dateLine = fmtDate(d.celebration_date);
    var location = (d.celebration_location || '').trim();
    var names = d.couple_names || [d.partner_1, d.partner_2].filter(Boolean).join(' & ') || '';

    var namesEl = CFG.heroNamesId ? document.getElementById(CFG.heroNamesId) : null;
    var heroHasDate = !!hero.querySelector('#heroDate, .hero-date');
    var firstName = (d.partner_1 || names.split('&')[0] || '').trim();
    var heroHasNames = !!firstName && (hero.textContent || '').indexOf(firstName) !== -1;

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
    style.textContent =
      '.mp-std-top,.mp-std-bottom{position:absolute;left:50%;transform:translateX(-50%);' +
        'width:min(92%,680px);text-align:center;z-index:8;pointer-events:none;' +
        'color:' + inkColor + ';text-shadow:' + shadow + '}' +
      '.mp-std-top{top:7%}' +
      '.mp-std-bottom{bottom:6%}' +
      '.mp-std-eyebrow{font-size:0.86rem;letter-spacing:0.34em;text-transform:uppercase;margin:0;' +
        'font-weight:500}' +
      '.mp-std-names{font-size:clamp(2rem,6vw,3.2rem);line-height:1.1;margin:14px 0 0}' +
      '.mp-std-meta{font-size:0.9rem;letter-spacing:0.2em;text-transform:uppercase;margin:10px 0 0;' +
        'color:' + inkColor + ';text-shadow:' + shadow + '}' +
      '.mp-std-loc{opacity:0.85;margin-top:4px}' +
      '.mp-std-note{font-size:0.85rem;letter-spacing:0.08em;font-style:italic;opacity:0.92;' +
        'margin:16px 0 0}' +
      '.mp-std-top .mp-std-eyebrow + .mp-std-meta{margin-top:12px}' +
      '@media(max-width:640px){' +
        '.mp-std-top{top:5%}.mp-std-bottom{bottom:5%}' +
        '.mp-std-eyebrow{font-size:0.7rem;letter-spacing:0.26em}' +
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

    try { document.title = (d.couple_names || 'Our Wedding') + ' \u2014 Save the Date'; } catch (e) {}
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
        '<div id="mpPwError">Incorrect password \u2014 please try again.</div>' +
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
  function renderComingSoon(coupleNames, isoDate) {
    var dateLine = fmtDate(isoDate);
    screenShell(
      '<p class="mp-eyebrow">\u2728 Coming soon</p>' +
      '<h1 class="mp-display">' + esc(coupleNames || 'Coming soon') + '</h1>' +
      (dateLine ? '<p class="mp-date">' + esc(dateLine) + '</p>' : '') +
      '<div class="mp-rule"></div>' +
      '<p class="mp-body">' +
        (coupleNames ? esc(coupleNames) + ' are putting the finishing touches on their wedding website. ' : 'The hosts are putting the finishing touches on their wedding website. ') +
        'Please check back soon.' +
      '</p>' +
      '<div class="mp-foot">myplanning.ai</div>'
    );
  }

  function renderNotFound() {
    screenShell(
      '<p class="mp-eyebrow">\uD83D\uDD0D Not found</p>' +
      '<h1 class="mp-display">We couldn\u2019t find that website</h1>' +
      '<div class="mp-rule"></div>' +
      '<p class="mp-body">The link you followed may be incorrect, or the website may have moved. ' +
      'Please double-check the address with your hosts.</p>' +
      '<div class="mp-foot">myplanning.ai</div>'
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
      // Same site, so same tab. target="_blank" here was part of why a stray
      // href="#" opened the wedding site again in a new tab.
      a.removeAttribute('target');
      a.removeAttribute('rel');
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
        '.rsvp-name-input,.rsvp-text-input,.rsvp-select,.rsvp-textarea{' +
          'font-size:16px!important;padding-top:0.7rem!important;padding-bottom:0.7rem!important}' +
        '.rsvp-name-input{text-align:center}' +
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
      btn.removeAttribute('target');
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
  function reveal() {
    document.body.classList.remove('hydrating');
    document.body.style.visibility = 'visible';
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
    if (d.rsvp_config && Array.isArray(d.rsvp_config.entrees) && d.rsvp_config.entrees.length) {
      window._rsvpEntreeOptions = d.rsvp_config.entrees
        .filter(Boolean)
        .map(function (e) { return { value: e, label: e }; });
    }

    // 3. Custom CSS + font, then hand off to the template's own layout code.
    if (d.custom_css) {
      var style = document.createElement('style');
      style.textContent = d.custom_css;
      document.head.appendChild(style);
    }
    applyCustomFont(d.custom_font);

    window.MP_SHOWING_PLACEHOLDERS = false;
    try {
      if (typeof window.hydrateTemplate === 'function') window.hydrateTemplate(d);
    } catch (err) {
      console.error('[site-runtime] hydrateTemplate failed:', err);
    }

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
    if (!_isPreview && isSaveTheDate(d)) applySaveTheDate(d);

    // 7. Registry links, then the MyPlanning.ai footer.
    wireRegistryLinks(d);
    hydrateRegistryPreview(d);
    renderBrandFooter();

    reveal();
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
      reveal();
      var got = false;
      window.addEventListener('message', function (e) {
        if (e.data && e.data.type === 'HYDRATE_TEMPLATE') {
          got = true;
          hydrate(e.data.payload);
        }
      });
      setTimeout(function () {
        if (!got) hydrate(window.SAMPLE_DATA || {});
      }, 800);
      return;
    }

    // Live site. index.html hands the payload over in sessionStorage to avoid a
    // second round-trip. We deliberately KEEP the key (rather than deleting it)
    // so a refresh on a password-protected site doesn't dead-end at the gate.
    var key = 'weddingData_' + _liveSlug;
    var stashed = null;
    try { stashed = sessionStorage.getItem(key); } catch (e) {}

    if (stashed) {
      try {
        var parsed = JSON.parse(stashed);
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
          try { sessionStorage.setItem(key, JSON.stringify(d)); } catch (e) {}
        }
        hydrate(d);
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
  window._reveal = reveal;
  window.MP = {
    config: CFG,
    hydrate: hydrate,
    applySaveTheDate: applySaveTheDate,
    wireRegistryLinks: wireRegistryLinks,
    hydrateRegistryPreview: hydrateRegistryPreview,
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
