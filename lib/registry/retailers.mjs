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

// logFirst: the network takes our Click Id as its sub-id, so the row must
// exist before the link can be built. Disabled entries still get their name
// logged, so untracked clicks to them show up in the numbers.
export const RETAILERS = [
  { name: "Amazon", network: "amazon", enabled: true, logFirst: false,
    domains: ["amazon.com"], build: buildAmazon },

  // Groundwork: waiting on Kevin (CJ link ids, Rakuten token + MID, TP trs/p).
  { name: "Booking.com", network: "cj", enabled: false, logFirst: true,
    domains: ["booking.com"], build: null },
  { name: "Vrbo", network: "cj", enabled: false, logFirst: true,
    domains: ["vrbo.com"], build: null },
  { name: "Dyson", network: "rakuten", enabled: false, logFirst: true,
    domains: ["dyson.com"], build: null },
  { name: "DiscoverCars", network: "travelpayouts", enabled: false, logFirst: true,
    domains: ["discovercars.com"], build: null },
];
