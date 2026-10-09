import { TABLES, PLACEMENTS, TIMEOUTS } from "./config.mjs";
import { matchRetailer, isTrackable } from "./retailers.mjs";
import { isBotRequest } from "./bots.mjs";

const LOG = TABLES.clickLog;
const F = LOG.fields;
const ID_RE = /^[A-Za-z0-9_-]{1,64}$/;

const cleanId = (v) => (v && ID_RE.test(v) ? v : null);

function redirect(location) {
  return new Response(null, {
    status: 302,
    headers: {
      Location: location,
      "Cache-Control": "no-store, max-age=0", // never let the CDN answer a click
      "X-Robots-Tag": "noindex, nofollow",
      // No Referrer-Policy header: the retailer must see the referer.
    },
  });
}

// Mirrors safeUrl() in live_registry.html: older rows were saved without a
// scheme ("amazon.com/dp/..."), so add https:// rather than reject them.
// Any other scheme (mailto:, javascript:) is refused.
function parseHttpUrl(raw) {
  if (!raw || typeof raw !== "string") return null;
  let s = raw.trim();
  if (!s) return null;
  if (/^\/\//.test(s)) s = "https:" + s;
  else if (!/^[a-z][a-z0-9+.-]*:/i.test(s)) s = "https://" + s.replace(/^\/+/, "");
  try {
    const u = new URL(s);
    return u.protocol === "https:" || u.protocol === "http:" ? u : null;
  } catch {
    return null;
  }
}

function hostOf(href) {
  try { return new URL(href, "https://local.invalid").hostname; } catch { return null; }
}

// Drop nulls so Softr never receives blank writes for fields we don't know.
function compact(obj) {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== null && v !== undefined && v !== ""));
}

async function resolveCleanUrl(softr, { itemId, catalogProductId }, env = {}) {
  const src = itemId
    ? { table: TABLES.registryItems, id: itemId }
    : catalogProductId
      ? { table: TABLES.catalogue, id: catalogProductId }
      : null;
  if (!src) return null;
  const record = await softr.getRecord(src.table.id, src.id, TIMEOUTS.readMs);
  // Catalogue rows hold a template with a literal "{affiliate_tag}". Fill it
  // the way main.py does when adding a gift, so no link ever leaves with the
  // placeholder in it. Amazon links are rebuilt from the ASIN regardless.
  const raw = String(record?.fields?.[src.table.fields.url] ?? "")
    .split("{affiliate_tag}").join(env.AMAZON_ASSOCIATE_TAG || "");
  return parseHttpUrl(raw);
}

export async function handleGo(request, deps) {
  const { softr, waitUntil, env = {}, now = () => new Date(), logger = console } = deps;

  // Captured at arrival, not when a deferred write happens to run.
  const clickedAt = now().toISOString();
  const q = new URL(request.url).searchParams;

  const itemId = cleanId(q.get("item_id"));
  const catalogProductId = itemId ? null : cleanId(q.get("catalog_product_id"));
  const rawPlacement = q.get("placement");
  const placement = PLACEMENTS.has(rawPlacement) ? rawPlacement : null;

  const baseRow = {
    [F.clickedAt]: clickedAt,
    [F.itemId]: itemId,
    [F.catalogProductId]: catalogProductId,
    // Client-supplied: stored as given, never used for lookups.
    [F.registryId]: cleanId(q.get("registry_id")),
    [F.celebrationId]: cleanId(q.get("celebration_id")),
    [F.placement]: placement,
    [F.isBot]: isBotRequest(request),
  };

  const defer = (label, promise) =>
    waitUntil(promise.catch((e) => logger.error(`[registry/go] ${label}:`, e?.message || e)));
  const writeRow = (fields) =>
    softr.createRecord(LOG.id, compact({ ...baseRow, ...fields }), TIMEOUTS.deferredMs);

  // 1–2. Clean URL.
  let cleanUrl = null;
  try {
    cleanUrl = await resolveCleanUrl(softr, { itemId, catalogProductId }, env);
  } catch (e) {
    logger.error("[registry/go] resolve:", e?.message || e);
  }

  // Nothing known to send them to.
  if (!cleanUrl) {
    const fallback = env.REGISTRY_GO_FALLBACK_URL || "/";
    defer("log (unresolved)", writeRow({ [F.network]: "none", [F.finalHost]: hostOf(fallback) }));
    return redirect(fallback);
  }

  // 4. Match.
  const retailer = matchRetailer(cleanUrl.hostname);
  const trackable = isTrackable(retailer, env);
  const retailerName = retailer?.name ?? null;

  const tryBuild = (ctx) => {
    try { return retailer.build(cleanUrl, { placement, env, ...ctx }); }
    catch (e) { logger.error("[registry/go] build:", e?.message || e); return null; }
  };

  // 5. Unmatched or disabled: clean URL, still logged.
  if (!trackable) {
    const target = cleanUrl.toString();
    defer("log (untracked)", writeRow({
      [F.retailer]: retailerName, [F.network]: "none", [F.finalHost]: hostOf(target),
    }));
    return redirect(target);
  }

  // 6a. Amazon-style: no click id in the link, so redirect now and log after.
  if (!retailer.logFirst) {
    const built = tryBuild({});
    const target = built || cleanUrl.toString();
    defer("log", writeRow({
      [F.retailer]: retailerName,
      [F.network]: built ? retailer.network : "none",
      [F.finalHost]: hostOf(target),
    }));
    return redirect(target);
  }

  // 6b. CJ / Rakuten-style: the link carries our Click Id, so log first,
  // with a short timeout. On timeout or error, go to the clean URL anyway.
  let row = null;
  try {
    row = await softr.createRecord(
      LOG.id, compact({ ...baseRow, [F.retailer]: retailerName, [F.network]: retailer.network }),
      TIMEOUTS.logFirstMs
    );
  } catch (e) {
    logger.error("[registry/go] log-first:", e?.message || e);
  }
  // Built even without a click id: the commission does not depend on it.
  const clickId = row?.fields?.[F.clickId] ?? null;
  const built = tryBuild({ clickId: clickId != null ? String(clickId) : null });
  const target = built || cleanUrl.toString();

  // 7. Final Host (and the network, if we ended up untracked).
  if (row?.id) {
    defer("final host", softr.updateRecord(LOG.id, row.id, compact({
      [F.finalHost]: hostOf(target),
      [F.network]: built ? null : "none",
    }), TIMEOUTS.deferredMs));
  }
  // If the create timed out it may still land, so no retry: a missing row
  // is better than a duplicate.
  return redirect(target);
}
