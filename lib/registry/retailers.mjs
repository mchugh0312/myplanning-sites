// Host matching on a dot boundary: "booking.com" matches booking.com and
// secure.booking.com, never notbooking.com. A leading www. needs no special case.
export function hostMatches(host, domain) {
  const h = String(host).toLowerCase().replace(/\.$/, "");
  const d = domain.toLowerCase();
  return h === d || h.endsWith("." + d);
}

export function matchRetailer(host, retailers = RETAILERS) {
  return retailers.find((r) => r.domains.some((d) => hostMatches(host, d))) || null;
}

const ASIN_RE = /\/(?:dp|gp\/product|gp\/aw\/d|exec\/obidos\/ASIN)\/([A-Z0-9]{10})(?=[/?#]|$)/i;

export function extractAsin(url) {
  const m = url.pathname.match(ASIN_RE);
  return m ? m[1].toUpperCase() : null;
}

// Pattern B. Canonical /dp/{ASIN} only; ascsubtag is the placement label.
// Returns null when there is no ASIN (e.g. a search fallback) or no tag,
// and the caller then redirects to the clean URL untagged.
function buildAmazon(url, { placement, env }) {
  const tag = env.AMAZON_ASSOCIATE_TAG;
  const asin = extractAsin(url);
  if (!tag || !asin) return null;
  const out = new URL(`https://www.amazon.com/dp/${asin}`);
  out.searchParams.set("tag", tag);
  if (placement) out.searchParams.set("ascsubtag", placement);
  return out.toString();
}

// ---- Networks ----------------------------------------------------------
// Each builder returns null when a value it needs is missing, and the click
// then goes to the clean URL untracked (and is logged as network "none").
// The sub-id is our Click Id when the log row was written in time; without it
// the link is still built, because the commission does not depend on it —
// only matching a sale back to one click does.
const enc = encodeURIComponent;

// CJ deep link: click-<website PID>-<per-advertiser link id>?url=…&sid=…
function cjBuilder(linkIdVar) {
  return (url, { env, clickId }) => {
    const pid = env.CJ_PID, aid = env[linkIdVar];
    if (!pid || !aid) return null;
    let out = `https://www.anrdoezrs.net/click-${enc(pid)}-${enc(aid)}?url=${enc(url.toString())}`;
    if (clickId) out += `&sid=${enc(clickId)}`;
    return out;
  };
}

// Rakuten deep link: the ENCRYPTED site token (not the numeric SID) + the
// advertiser's MID; u1 carries our click id.
function rakutenBuilder(midVar) {
  return (url, { env, clickId }) => {
    const token = env.RAKUTEN_SITE_TOKEN, mid = env[midVar];
    if (!token || !mid) return null;
    let out = `https://click.linksynergy.com/deeplink?id=${enc(token)}&mid=${enc(mid)}&murl=${enc(url.toString())}`;
    if (clickId) out += `&u1=${enc(clickId)}`;
    return out;
  };
}

// Travelpayouts redirect: marker (account) + trs (traffic source) + p
// (programme) + u (destination); sub_id carries our click id.
function travelpayoutsBuilder(trsVar, pVar) {
  return (url, { env, clickId }) => {
    const marker = env.TP_MARKER, trs = env[trsVar], p = env[pVar];
    if (!marker || !trs || !p) return null;
    let out = `https://tp.media/r?marker=${enc(marker)}&trs=${enc(trs)}&p=${enc(p)}&u=${enc(url.toString())}`;
    if (clickId) out += `&sub_id=${enc(clickId)}`;
    return out;
  };
}

// logFirst: the network takes our Click Id as its sub-id, so the row is
// written first (with a short timeout). `requires` lists the Vercel variables
// a retailer needs: until they are all set it is passed through untracked, so
// no request ever waits on a log write for a link that cannot be built.
export const RETAILERS = [
  { name: "Amazon", network: "amazon", enabled: true, logFirst: false,
    requires: ["AMAZON_ASSOCIATE_TAG"], domains: ["amazon.com"], build: buildAmazon },

  { name: "Dyson", network: "rakuten", enabled: true, logFirst: true,
    requires: ["RAKUTEN_SITE_TOKEN", "RAKUTEN_DYSON_MID"],
    domains: ["dyson.com"], build: rakutenBuilder("RAKUTEN_DYSON_MID") },

  { name: "Booking.com", network: "cj", enabled: true, logFirst: true,
    requires: ["CJ_PID", "CJ_BOOKING_LINK_ID"],
    domains: ["booking.com"], build: cjBuilder("CJ_BOOKING_LINK_ID") },
  { name: "Vrbo", network: "cj", enabled: true, logFirst: true,
    requires: ["CJ_PID", "CJ_VRBO_LINK_ID"],
    domains: ["vrbo.com"], build: cjBuilder("CJ_VRBO_LINK_ID") },

  { name: "DiscoverCars", network: "travelpayouts", enabled: true, logFirst: true,
    requires: ["TP_MARKER", "TP_DISCOVERCARS_TRS", "TP_DISCOVERCARS_P"],
    domains: ["discovercars.com"], build: travelpayoutsBuilder("TP_DISCOVERCARS_TRS", "TP_DISCOVERCARS_P") },
];

export function isTrackable(retailer, env = {}) {
  return !!(retailer && retailer.enabled && typeof retailer.build === "function"
            && (retailer.requires || []).every((k) => env[k]));
}
