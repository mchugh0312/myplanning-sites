// ─────────────────────────────────────────────────────────────────────────────
// /api/og.js
// ─────────────────────────────────────────────────────────────────────────────
//
// PURPOSE
//   Serve a tiny HTML stub with per-couple Open Graph + Twitter meta tags so
//   chat-app crawlers (WhatsApp, iMessage, Facebook, Telegram, Slack, etc.)
//   show the couple's hero photo and names in the rich link preview, instead
//   of always falling back to the brand banner.
//
// WHEN THIS RUNS
//   Only for crawler requests. The vercel.json rewrite at the bottom of this
//   project routes /:slug to this function only when the User-Agent header
//   matches a known crawler regex. Real users (Chrome, Safari, etc.) hit the
//   normal /:slug -> /index.html rewrite and never see this output.
//
// WHAT IT DOES
//   1. Read ?slug from the query string (set by the rewrite).
//   2. Fetch the wedding-site payload from the same backend the live site
//      uses (https://wedding-recommender.onrender.com/wedding-site/{slug}).
//   3. Pull out hero_image, couple_names, celebration_date.
//   4. Render a minimal HTML document with og:* and twitter:* tags pointing
//      at THOSE per-couple values.
//   5. Return it. Crawler reads the meta tags and stops; that's the whole job.
//
// SAFETY / FALLBACKS
//   - If the slug isn't found, the backend errors, or the payload is empty:
//       → return brand-fallback OG tags (same image as the static templates).
//   - If the site is password-protected (`password_required: true` in the
//     response): also return brand fallback. We must never leak a couple's
//     hero photo or name into a public chat preview when their site is
//     gated. The lock screen they put up is the whole point.
//   - If hero_image is missing: brand fallback for the image, but keep their
//     names in the title (no privacy concern there — names are public on the
//     site itself).
//
// CACHING
//   Crawlers re-fetch links periodically (especially WhatsApp, which has no
//   real way to invalidate). We set s-maxage so Vercel's edge caches the
//   response per-slug for an hour. If a couple updates their hero photo,
//   they'll need to either wait an hour or share a fresh URL with a query
//   param (e.g. `?v=2`) to bypass cache. Trade-off favours fewer backend
//   round-trips on the share-spam path.
//
// CONFIG / KNOBS (top of file, easy to tweak):
//   API_BASE          - backend URL
//   BRAND_OG_IMAGE    - fallback image absolute URL
//   BRAND_TITLE       - fallback title
//   BRAND_DESCRIPTION - fallback description
//   CACHE_SECONDS     - how long Vercel CDN caches each per-slug response
//   FETCH_TIMEOUT_MS  - upstream timeout; if the backend is slow we'd rather
//                      ship brand fallback fast than hang the crawler
// ─────────────────────────────────────────────────────────────────────────────

const API_BASE          = "https://wedding-recommender.onrender.com";
const BRAND_OG_IMAGE    = "https://weddings.myplanning.ai/og-image.png";
const BRAND_TITLE       = "A Wedding Website by MyPlanning.ai";
const BRAND_DESCRIPTION = "Beautifully simple wedding websites for couples and their guests. RSVP, share details, celebrate together.";
const SITE_BASE         = "https://weddings.myplanning.ai";
const CACHE_SECONDS     = 3600; // 1 hour at the edge

// Render-on-the-Render-free-tier cold starts can take a while. We give the
// backend FETCH_TIMEOUT_MS to respond; past that we ship brand fallback so
// the crawler doesn't sit there waiting and time out on its own end.
const FETCH_TIMEOUT_MS  = 4000;

// Escape user-provided strings before injecting into HTML. Without this, a
// couple named e.g. `Alice & "Bob"` would break the HTML attribute the
// content goes into. We escape conservatively for HTML attribute context:
// & < > " ' all become entities.
function escapeAttr(s) {
  if (s == null) return "";
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// Validate a hero image URL is something a crawler can actually fetch. We're
// strict about this: must be http(s), must look like a real path, no data:
// URLs, no relative paths. If it doesn't pass, we use the brand fallback.
function safeImageUrl(url) {
  if (typeof url !== "string" || !url) return BRAND_OG_IMAGE;
  try {
    const u = new URL(url);
    if (u.protocol !== "http:" && u.protocol !== "https:") return BRAND_OG_IMAGE;
    return u.toString();
  } catch {
    return BRAND_OG_IMAGE;
  }
}

// Format the celebration_date (ISO YYYY-MM-DD or full ISO datetime) into a
// human description. If it's missing or unparseable, fall back to a generic
// invitation phrase so the description field is never blank.
function buildDescription(coupleNames, isoDate) {
  if (isoDate) {
    const d = new Date(isoDate);
    if (!Number.isNaN(d.getTime())) {
      const formatted = d.toLocaleDateString("en-US", {
        year: "numeric", month: "long", day: "numeric",
      });
      return `Join ${coupleNames || "us"} as we celebrate on ${formatted}.`;
    }
  }
  return coupleNames
    ? `Join ${coupleNames} for our wedding celebration.`
    : BRAND_DESCRIPTION;
}

// Render the HTML response. Kept tiny: just <head> with meta tags + a
// minimal body that redirects real humans (in case one ever lands here)
// back to the live site. Crawlers stop reading after </head>.
function renderHtml({ title, description, image, url }) {
  const T = escapeAttr(title);
  const D = escapeAttr(description);
  const I = escapeAttr(image);
  const U = escapeAttr(url);
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>${T}</title>

<meta property="og:type"        content="website">
<meta property="og:site_name"   content="MyPlanning.ai Weddings">
<meta property="og:title"       content="${T}">
<meta property="og:description" content="${D}">
<meta property="og:image"       content="${I}">
<meta property="og:image:width"  content="1200">
<meta property="og:image:height" content="630">
<meta property="og:url"         content="${U}">

<meta name="twitter:card"        content="summary_large_image">
<meta name="twitter:title"       content="${T}">
<meta name="twitter:description" content="${D}">
<meta name="twitter:image"       content="${I}">

<meta name="description" content="${D}">

<!-- If a real human ever lands here (unexpected), bounce them to the
     live site immediately. Crawlers stop reading after </head> so this
     refresh is harmless to them. -->
<meta http-equiv="refresh" content="0;url=${U}">
<link rel="canonical" href="${U}">
</head>
<body>
<p style="font-family:serif;color:#4B5143;text-align:center;margin-top:4rem">
  Redirecting to <a href="${U}">${U}</a>…
</p>
<script>window.location.replace(${JSON.stringify(url)});</script>
</body>
</html>`;
}

// Fetch with a timeout. The Render free-tier cold start can be slow; we'd
// rather give up and ship brand fallback than block the crawler indefinitely.
async function fetchWithTimeout(url, ms) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    return res;
  } finally {
    clearTimeout(t);
  }
}

// ─── Handler ────────────────────────────────────────────────────────────────

export default async function handler(req, res) {
  // Pull the slug from the query string. The rewrite passes it as ?slug=...
  // but we accept ?:slug too just in case the rewrite syntax changes later.
  const slug = (req.query && (req.query.slug || req.query[":slug"])) || "";

  // Default fallback values — used whenever anything below goes wrong.
  let title       = BRAND_TITLE;
  let description = BRAND_DESCRIPTION;
  let image       = BRAND_OG_IMAGE;
  let pageUrl     = `${SITE_BASE}/`;

  // Only attempt per-couple lookup if we got a plausible slug. Slugs are
  // lowercase letters, numbers, hyphens (mirrors the validation in the
  // editor block). Anything else: ship brand fallback.
  const slugOk = typeof slug === "string" && /^[a-z0-9](?:[a-z0-9-]{0,48}[a-z0-9])?$/.test(slug);

  if (slugOk) {
    pageUrl = `${SITE_BASE}/${slug}`;
    try {
      const apiUrl = `${API_BASE}/wedding-site/${encodeURIComponent(slug)}`;
      const r = await fetchWithTimeout(apiUrl, FETCH_TIMEOUT_MS);
      if (r.ok) {
        const data = await r.json();

        // Password-protected: NEVER leak hero photo / names into the preview.
        // Brand-only fallback is the right behaviour here.
        if (data && data.password_required) {
          // (intentionally keep brand fallback values)
        } else if (data && typeof data === "object") {
          // The backend returns the same payload shape that hydrateTemplate
          // consumes — see the live-site fetch in any template-*.html.
          const couple = (data.couple_names || "").trim()
            || [data.partner_1, data.partner_2].filter(Boolean).join(" & ").trim();

          if (couple) title = `${couple} — Wedding Website`;
          description    = buildDescription(couple, data.celebration_date);
          image          = safeImageUrl(data.hero_image);
        }
      }
      // Non-OK status (404, 500, etc.): keep brand fallback, no error spew.
    } catch (err) {
      // Network error, timeout, JSON parse failure — anything. Ship brand
      // fallback rather than crashing the function. Log for diagnostics.
      console.warn("[og] lookup failed for slug=%s:", slug, err && err.message);
    }
  }

  const html = renderHtml({ title, description, image, url: pageUrl });

  // Cache headers: tell Vercel's edge to cache per-URL for an hour, and tell
  // browsers + intermediate caches not to hold it (only the edge).
  // s-maxage     -> Vercel CDN
  // max-age=0    -> browsers / private caches don't hold a stale copy
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader(
    "Cache-Control",
    `public, max-age=0, s-maxage=${CACHE_SECONDS}, stale-while-revalidate=${CACHE_SECONDS}`
  );
  // Crawlers fetching from arbitrary origins; harmless to set:
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.status(200).send(html);
}
