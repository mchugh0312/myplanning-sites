// ─────────────────────────────────────────────────────────────────────────────
// /api/site.js
// ─────────────────────────────────────────────────────────────────────────────
//
// PURPOSE
//   Serve the couple's site AT THEIR OWN URL, in one request.
//
//   /manishmonika used to return index.html, a shell whose only job was to ask
//   the backend which template the couple uses and then NAVIGATE to it. That
//   cost two full HTML downloads, and the address bar read
//   template-pressedpetals.html for the whole of the second one - nine seconds
//   on a throttled connection. The couple's site should not advertise which
//   template it was built from, least of all in a URL a guest might copy.
//
//   The mapping from slug to template is data the server can resolve, so it
//   does. One request, correct URL from the first byte, and the payload inlined
//   so the runtime can hydrate without a round-trip of its own.
//
// WHEN THIS RUNS
//   The vercel.json rewrite sends /:slug here for ordinary visitors. Crawlers
//   still go to /api/og first - that rule is listed before this one and is
//   matched on User-Agent.
//
// WHAT IT RETURNS
//   The chosen template's HTML with one <script> inserted into its <head>:
//
//       window.MP_SITE_DATA = { ... };
//
//   site-runtime.js checks for that before anything else, so hydrate runs on
//   first parse. No shell, no redirect, no sessionStorage handoff, no client
//   fetch.
//
// FALLBACKS - every one of them returns index.html, which is exactly today's
// behaviour. A failure here must cost a redirect, never a broken page.
//   - slug fails validation
//   - backend errors, times out, or returns a non-200
//   - the template file cannot be read
//
// PASSWORD-PROTECTED SITES
//   The payload is NOT inlined. The template is still served - so the URL is
//   right and the lock screen is theirs - but the data is left for the runtime
//   to fetch once the guest has entered the password. Inlining it would put a
//   gated couple's details in the page source of a public URL, which is the
//   same mistake /api/og is careful to avoid in link previews.
// ─────────────────────────────────────────────────────────────────────────────

import fs from "fs";
import path from "path";

const API_BASE         = "https://wedding-recommender.onrender.com";
const FETCH_TIMEOUT_MS = 4000;

// Same mapping index.html uses. Kept in step by a gate in marker-test.js:
// a label in one and not the other means a couple silently gets the default.
const TEMPLATE_MAP = {
  'pressed petals':      '/template-pressedpetals.html',
  'heirloom bloom':      '/template-heirloombloom.html',
  'black tie timeless':  '/template-blacktietimeless.html',
  'golden hour':         '/template-goldenhour.html',
  'sage & still':        '/template-sageandstill.html',
  'sage and still':      '/template-sageandstill.html',
  'modern minimal':      '/template-modernminimal.html',
  'whimsical romance':   '/template-whimsicalromance.html',
  'coastal chic':        '/template-coastalchic.html',
  'vintage love story':  '/template-vintagelovestory.html',
  'regal boho':          '/template-regalboho.html',

  // Generic style aliases (legacy fallback for older recommender outputs)
  'romantic':    '/template-pressedpetals.html',
  'elegant':     '/template-pressedpetals.html',
  'classic':     '/template-pressedpetals.html',
  'modern':      '/template-modernminimal.html',
  'minimalist':  '/template-modernminimal.html',
  'rustic':      '/template-pressedpetals.html',
};
const DEFAULT_TEMPLATE = '/template-pressedpetals.html';

/* Read once per container, not once per request. The files only change on
   deploy, and a warm invocation should cost one backend call and nothing
   else. */
const _fileCache = {};

function readPublic(file) {
  if (Object.prototype.hasOwnProperty.call(_fileCache, file)) return _fileCache[file];
  let body = null;
  try {
    body = fs.readFileSync(path.join(process.cwd(), "public", file), "utf8");
  } catch (err) {
    console.warn("[site] cannot read %s:", file, err && err.message);
  }
  _fileCache[file] = body;
  return body;
}

function templateFor(data) {
  const label = (data && data.template ? String(data.template) : "").toLowerCase();
  return (TEMPLATE_MAP[label] || DEFAULT_TEMPLATE).replace(/^\//, "");
}

async function fetchWithTimeout(url, ms) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, { signal: ctrl.signal });
  } finally {
    clearTimeout(t);
  }
}

/* Inlined as JSON inside a <script>, so the one thing that can break the page
   is a closing tag appearing inside a string the couple typed. `</script>` in
   their Our Story would end the block early and spill the rest of the payload
   into the document as markup.

   Escaping the slash prevents the parser recognising it while leaving the JSON
   identical once parsed. U+2028 and U+2029 are escaped for the same class of
   reason: they are literal line terminators in older JS parsers. */
function inlineJson(value) {
  return JSON.stringify(value)
    .replace(/</g, "\\u003c")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}

/* START THE HERO DOWNLOADING DURING HEAD PARSE.

   The hero photograph is the largest thing on the page and the last to be
   asked for: it cannot begin until site-runtime.js has arrived (111 KB over
   the wire) and hydrate has set the src. On a slow connection that is seconds
   of the page's own critical path spent idle.

   The server already has the url - it is in the payload it is inlining - so it
   can tell the browser to start fetching now. By the time hydrate sets the src
   the bytes are in flight or in cache, and the swap is instant.

   Only from the preloadable fields, and only http(s): a preload for something
   that is never requested is a wasted round-trip on the one connection that
   matters. */
function heroPreload(data) {
  const url = data && data.hero_image;
  if (typeof url !== "string" || !url) return "";
  try {
    const u = new URL(url);
    if (u.protocol !== "http:" && u.protocol !== "https:") return "";
  } catch { return ""; }
  return '<link rel="preload" as="image" fetchpriority="high" href="' +
    String(url).replace(/&/g, "&amp;").replace(/"/g, "&quot;") + '">';
}

function injectData(html, data) {
  const tag = heroPreload(data) +
    "<script>window.MP_SITE_DATA = " + inlineJson(data) + ";</script>";
  /* Into <head>, because site-runtime.js loads at the foot of the body and
     must find this already set. Appending to the end of the document would be
     too late. */
  const i = html.indexOf("</head>");
  if (i === -1) return null;
  return html.slice(0, i) + tag + "\n" + html.slice(i);
}

function send(res, html, cacheSeconds) {
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  /* NOT cached at the edge by default. This response carries one couple's
     data, and a shared cache holding it would serve a stale site after they
     save - the fault that cost several rounds of debugging when the edge held
     the templates. The browser revalidates as it does for every other page
     here. */
  res.setHeader(
    "Cache-Control",
    cacheSeconds
      ? `public, max-age=0, s-maxage=${cacheSeconds}`
      : "public, max-age=0, must-revalidate"
  );
  res.setHeader("CDN-Cache-Control", "no-store");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.status(200).send(html);
}

/* Today's behaviour, byte for byte: the shell resolves the slug itself and
   redirects. Slower and the URL is briefly wrong, but it works - which is what
   a fallback is for. */
function fallbackToShell(res, why) {
  const shell = readPublic("index.html");
  if (shell) {
    res.setHeader("X-Mp-Site-Fallback", why);
    return send(res, shell, 0);
  }
  res.status(500).send("Unable to load site");
}

export default async function handler(req, res) {
  const slug = (req.query && (req.query.slug || req.query[":slug"])) || "";

  // Same validation /api/og uses, mirroring the editor's own rule.
  const slugOk = typeof slug === "string" &&
    /^[a-z0-9](?:[a-z0-9-]{0,48}[a-z0-9])?$/.test(slug);
  if (!slugOk) return fallbackToShell(res, "bad-slug");

  let data = null;
  try {
    const r = await fetchWithTimeout(
      `${API_BASE}/wedding-site/${encodeURIComponent(slug)}`, FETCH_TIMEOUT_MS);
    if (!r.ok) return fallbackToShell(res, "upstream-" + r.status);
    data = await r.json();
  } catch (err) {
    console.warn("[site] lookup failed for slug=%s:", slug, err && err.message);
    return fallbackToShell(res, "lookup-failed");
  }

  if (!data || typeof data !== "object") return fallbackToShell(res, "empty-payload");

  const file = templateFor(data);
  const html = readPublic(file);
  if (!html) return fallbackToShell(res, "no-template");

  /* Gated sites get the template and not the data. The runtime fetches it
     after the password is accepted. */
  if (data.password_required) return send(res, html, 0);

  const withData = injectData(html, data);
  if (!withData) return fallbackToShell(res, "no-head");

  return send(res, withData, 0);
}
