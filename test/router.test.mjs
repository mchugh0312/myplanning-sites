import { test } from "node:test";
import assert from "node:assert/strict";
import { hostMatches, matchRetailer, extractAsin } from "../lib/registry/retailers.mjs";
import { isBotRequest } from "../lib/registry/bots.mjs";
import { handleGo } from "../lib/registry/handler.mjs";
import { TABLES } from "../lib/registry/config.mjs";

const F = TABLES.clickLog.fields;
const UA_SAFARI = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile Safari/604.1";

test("host matching respects dot boundaries", () => {
  assert.ok(hostMatches("booking.com", "booking.com"));
  assert.ok(hostMatches("www.booking.com", "booking.com"));
  assert.ok(hostMatches("secure.booking.com", "booking.com"));
  assert.ok(!hostMatches("notbooking.com", "booking.com"));
  assert.ok(!hostMatches("booking.com.evil.io", "booking.com"));
  assert.ok(!hostMatches("amazon.co.uk", "amazon.com"));
});

test("ASIN extraction", () => {
  assert.equal(extractAsin(new URL("https://www.amazon.com/dp/B08N5WRWNW")), "B08N5WRWNW");
  assert.equal(extractAsin(new URL("https://amazon.com/Some-Title/dp/b08n5wrwnw/ref=x?th=1")), "B08N5WRWNW");
  assert.equal(extractAsin(new URL("https://www.amazon.com/gp/product/B08N5WRWNW")), "B08N5WRWNW");
  assert.equal(extractAsin(new URL("https://www.amazon.com/s?k=gift+card")), null);
});

test("bots", () => {
  const r = (ua, method = "GET") => new Request("https://x/", { method, headers: ua ? { "user-agent": ua } : {} });
  assert.ok(isBotRequest(r("facebookexternalhit/1.1 Facebot Twitterbot/1.0")));
  assert.ok(isBotRequest(r("WhatsApp/2.23.20")));
  assert.ok(isBotRequest(r("Slackbot-LinkExpanding 1.0")));
  assert.ok(isBotRequest(r("")));
  assert.ok(isBotRequest(r(UA_SAFARI, "HEAD")));
  assert.ok(!isBotRequest(r(UA_SAFARI)));
});

// ---- router -------------------------------------------------------------

function harness({ urls = {}, failGet = false, createResult, createFails = false } = {}) {
  const writes = [];
  const deferred = [];
  const softr = {
    async getRecord(table, id) {
      if (failGet) throw new Error("db slow");
      const url = urls[`${table}:${id}`];
      if (url === undefined) throw new Error("404");
      const field = table === TABLES.registryItems.id ? TABLES.registryItems.fields.url
                  : table === TABLES.experiences.id ? TABLES.experiences.fields.url : TABLES.catalogue.fields.url;
      return { id, fields: { [field]: url } };
    },
    async createRecord(table, fields) {
      if (createFails) throw new Error("timeout");
      writes.push({ op: "create", table, fields });
      return createResult ?? { id: "rec1", fields: { ...fields, [F.clickId]: 42 } };
    },
    async updateRecord(table, id, fields) { writes.push({ op: "update", table, id, fields }); },
  };
  return {
    writes,
    async run(qs, ua = UA_SAFARI, env = { AMAZON_ASSOCIATE_TAG: "myplanning-20" }) {
      const req = new Request(`https://myplanning.example/api/registry/go?${qs}`, { headers: { "user-agent": ua } });
      const res = await handleGo(req, {
        softr, env, waitUntil: (p) => deferred.push(p),
        now: () => new Date("2026-10-09T12:00:00Z"),
        logger: { error() {} },
      });
      await Promise.all(deferred);
      return res;
    },
  };
}
const CAT = TABLES.catalogue.id;
const REG = TABLES.registryItems.id;

test("amazon catalogue click: canonical tagged link, logged after", async () => {
  const h = harness({ urls: { [`${CAT}:recA`]: "https://www.amazon.com/Kitchen-Thing/dp/B0ABCDEF12/ref=sr_1?th=1" } });
  const res = await h.run("catalog_product_id=recA&placement=shop&registry_id=reg9");
  assert.equal(res.status, 302);
  assert.equal(res.headers.get("location"), "https://www.amazon.com/dp/B0ABCDEF12?tag=myplanning-20&ascsubtag=shop");
  assert.equal(res.headers.get("cache-control"), "no-store, max-age=0");
  assert.equal(res.headers.get("referrer-policy"), null);
  assert.equal(h.writes.length, 1);
  const f = h.writes[0].fields;
  assert.equal(f[F.clickedAt], "2026-10-09T12:00:00.000Z");
  assert.equal(f[F.catalogProductId], "recA");
  assert.equal(f[F.registryId], "reg9");
  assert.equal(f[F.celebrationId], undefined); // omitted, not blank
  assert.equal(f[F.placement], "shop");
  assert.equal(f[F.network], "amazon");
  assert.equal(f[F.retailer], "Amazon");
  assert.equal(f[F.finalHost], "www.amazon.com");
  assert.equal(f[F.isBot], false);
});

test("registry item id takes precedence and resolves from Gift Registry Items", async () => {
  const h = harness({ urls: { [`${REG}:item1`]: "https://amazon.com/dp/B0ABCDEF12" } });
  const res = await h.run("item_id=item1&catalog_product_id=recA&placement=registry");
  assert.match(res.headers.get("location"), /ascsubtag=registry$/);
  assert.equal(h.writes[0].fields[F.itemId], "item1");
  assert.equal(h.writes[0].fields[F.catalogProductId], undefined);
});

test("bad placement is dropped from the link and the log", async () => {
  const h = harness({ urls: { [`${CAT}:recA`]: "https://www.amazon.com/dp/B0ABCDEF12" } });
  const res = await h.run("catalog_product_id=recA&placement=12345");
  assert.equal(res.headers.get("location"), "https://www.amazon.com/dp/B0ABCDEF12?tag=myplanning-20");
  assert.equal(h.writes[0].fields[F.placement], undefined);
});

test("amazon search URL (no ASIN) goes through untagged", async () => {
  const url = "https://www.amazon.com/s?k=gift+card";
  const h = harness({ urls: { [`${CAT}:gc`]: url } });
  const res = await h.run("catalog_product_id=gc&placement=shop");
  assert.equal(res.headers.get("location"), url);
  assert.equal(h.writes[0].fields[F.network], "none");
});

test("missing Amazon tag env: clean URL, still logged", async () => {
  const url = "https://www.amazon.com/dp/B0ABCDEF12";
  const h = harness({ urls: { [`${CAT}:recA`]: url } });
  const res = await h.run("catalog_product_id=recA&placement=shop", UA_SAFARI, {});
  assert.equal(res.headers.get("location"), url);
  assert.equal(h.writes[0].fields[F.network], "none");
});

test("unknown retailer passes through", async () => {
  const url = "https://www.notbooking.com/x";
  const h = harness({ urls: { [`${CAT}:r`]: url } });
  const res = await h.run("catalog_product_id=r&placement=shop");
  assert.equal(res.headers.get("location"), url);
  assert.equal(h.writes[0].fields[F.retailer], undefined);
  assert.equal(h.writes[0].fields[F.finalHost], "www.notbooking.com");
});

test("disabled retailer passes through but is named in the log", async () => {
  const url = "https://www.booking.com/hotel/x.html";
  const h = harness({ urls: { [`${CAT}:b`]: url } });
  const res = await h.run("catalog_product_id=b&placement=shop");
  assert.equal(res.headers.get("location"), url);
  assert.equal(h.writes[0].fields[F.retailer], "Booking.com");
  assert.equal(h.writes[0].fields[F.network], "none");
});

test("database down: fallback redirect, never an error page", async () => {
  const h = harness({ failGet: true });
  const res = await h.run("catalog_product_id=recA&placement=shop", UA_SAFARI, { REGISTRY_GO_FALLBACK_URL: "/shop" });
  assert.equal(res.status, 302);
  assert.equal(res.headers.get("location"), "/shop");
});

test("bot click is still redirected and flagged", async () => {
  const h = harness({ urls: { [`${CAT}:recA`]: "https://www.amazon.com/dp/B0ABCDEF12" } });
  const res = await h.run("catalog_product_id=recA&placement=shop", "WhatsApp/2.23");
  assert.equal(res.status, 302);
  assert.equal(h.writes[0].fields[F.isBot], true);
});

test("log write failure never blocks the redirect", async () => {
  const h = harness({ urls: { [`${CAT}:recA`]: "https://www.amazon.com/dp/B0ABCDEF12" }, createFails: true });
  const res = await h.run("catalog_product_id=recA&placement=shop");
  assert.equal(res.status, 302);
});

test("junk ids are rejected before reaching Softr", async () => {
  const h = harness();
  const res = await h.run("catalog_product_id=../../databases&placement=shop");
  assert.equal(res.status, 302);
  assert.equal(h.writes[0].fields[F.catalogProductId], undefined);
});

test("stored URL without a scheme is repaired, not sent to the fallback", async () => {
  const h = harness({ urls: { [`${REG}:old1`]: "amazon.com/dp/B0ABCDEF12", [`${REG}:old2`]: "www.crateandbarrel.com/x" } });
  let res = await h.run("item_id=old1&placement=registry");
  assert.equal(res.headers.get("location"), "https://www.amazon.com/dp/B0ABCDEF12?tag=myplanning-20&ascsubtag=registry");
  res = await h.run("item_id=old2&placement=registry");
  assert.equal(res.headers.get("location"), "https://www.crateandbarrel.com/x");
});

test("non-web schemes are refused", async () => {
  const h = harness({ urls: { [`${REG}:bad`]: "javascript:alert(1)" } });
  const res = await h.run("item_id=bad&placement=registry", UA_SAFARI, { REGISTRY_GO_FALLBACK_URL: "/" });
  assert.equal(res.headers.get("location"), "/");
});

test("catalogue template placeholder is filled, never sent raw", async () => {
  const h = harness({ urls: {
    [`${CAT}:amz`]: "https://www.amazon.com/dp/B0ABCDEF12?tag={affiliate_tag}",
    [`${CAT}:oth`]: "https://www.example-shop.com/p/1?ref={affiliate_tag}",
  } });
  let res = await h.run("catalog_product_id=amz&placement=shop");
  assert.equal(res.headers.get("location"), "https://www.amazon.com/dp/B0ABCDEF12?tag=myplanning-20&ascsubtag=shop");
  res = await h.run("catalog_product_id=oth&placement=shop");
  assert.equal(res.headers.get("location"), "https://www.example-shop.com/p/1?ref=myplanning-20");
});

test("guest placement and celebration id are logged", async () => {
  const h = harness({ urls: { [`${REG}:i1`]: "https://www.amazon.com/dp/B0ABCDEF12?tag=myplanning-20" } });
  const res = await h.run("item_id=i1&placement=guest&registry_id=r1&celebration_id=c1");
  assert.match(res.headers.get("location"), /ascsubtag=guest$/);
  assert.equal(h.writes[0].fields[F.placement], "guest");
  assert.equal(h.writes[0].fields[F.celebrationId], "c1");
});

const NET_ENV = {
  AMAZON_ASSOCIATE_TAG: "myplanning-20",
  RAKUTEN_SITE_TOKEN: "TOKEN123", RAKUTEN_DYSON_MID: "4321",
  CJ_PID: "111", CJ_BOOKING_LINK_ID: "222", CJ_VRBO_LINK_ID: "333",
};

test("Dyson via Rakuten: logged first, click id in u1", async () => {
  const dest = "https://www.dyson.com/vacuum-cleaners/cordless/v15";
  const h = harness({ urls: { [`${CAT}:dy`]: dest } });
  const res = await h.run("catalog_product_id=dy&placement=shop", UA_SAFARI, NET_ENV);
  assert.equal(res.headers.get("location"),
    `https://click.linksynergy.com/deeplink?id=TOKEN123&mid=4321&murl=${encodeURIComponent(dest)}&u1=42`);
  assert.equal(h.writes[0].op, "create");
  assert.equal(h.writes[0].fields[F.network], "rakuten");
  assert.equal(h.writes[0].fields[F.retailer], "Dyson");
  assert.equal(h.writes[1].op, "update");
  assert.equal(h.writes[1].fields[F.finalHost], "click.linksynergy.com");
});

test("Rakuten link is still built when the log write fails", async () => {
  const h = harness({ urls: { [`${CAT}:dy`]: "https://www.dyson.com/x" }, createFails: true });
  const res = await h.run("catalog_product_id=dy&placement=shop", UA_SAFARI, NET_ENV);
  assert.match(res.headers.get("location"), /^https:\/\/click\.linksynergy\.com\/deeplink\?id=TOKEN123&mid=4321&murl=[^&]+$/);
});

test("Dyson without Rakuten variables passes through untracked, no waiting", async () => {
  const h = harness({ urls: { [`${CAT}:dy`]: "https://www.dyson.com/x" } });
  const res = await h.run("catalog_product_id=dy&placement=shop", UA_SAFARI, { AMAZON_ASSOCIATE_TAG: "t" });
  assert.equal(res.headers.get("location"), "https://www.dyson.com/x");
  assert.equal(h.writes.length, 1);
  assert.equal(h.writes[0].fields[F.network], "none");
});

test("Booking.com via CJ; DiscoverCars now passes through untracked", async () => {
  const b = "https://www.booking.com/hotel/fr/x.html", d = "https://www.discovercars.com/italy";
  const h = harness({ urls: { [`${REG}:bk`]: b, [`${REG}:dc`]: d } });
  let res = await h.run("item_id=bk&placement=guest", UA_SAFARI, NET_ENV);
  assert.equal(res.headers.get("location"), `https://www.anrdoezrs.net/click-111-222?url=${encodeURIComponent(b)}&sid=42`);
  res = await h.run("item_id=dc&placement=guest", UA_SAFARI, NET_ENV);
  assert.equal(res.headers.get("location"), d);
});


// ---- Viator --------------------------------------------------------------
const EXP = TABLES.experiences.id;
const VIATOR_ENV = { AMAZON_ASSOCIATE_TAG: "t", VIATOR_PID: "P00TESTPID", VIATOR_MCID: "11111" };
const MAUI = "https://www.viator.com/tours/Maui/Molokini-and-Turtle-Town-Snorkeling-Adventure/d671-9281P1";

test("Viator: experience click reproduces the known-good link shape", async () => {
  const h = harness({ urls: { [`${EXP}:expMaui`]: MAUI } });
  const res = await h.run("experience_id=expMaui&placement=experience&collection=maui&celebration_id=C10422&registry_id=r1",
                          UA_SAFARI, VIATOR_ENV);
  assert.equal(res.status, 302);
  assert.equal(res.headers.get("location"),
    `${MAUI}?pid=P00TESTPID&mcid=11111&medium=link&medium_version=selector&campaign=hf-maui-c10422`);
  const f = h.writes[0].fields;
  assert.equal(h.writes.length, 1);                 // not log-first: one deferred write
  assert.equal(f[F.network], "viator");
  assert.equal(f[F.retailer], "Viator");
  assert.equal(f[F.placement], "experience");
  assert.equal(f[F.itemId], "exp:expMaui");          // until an Experience Id column is configured
  assert.equal(f[F.celebrationId], "C10422");
  assert.equal(f[F.finalHost], "www.viator.com");
});

test("Viator: language subdomain matches; Viator's own params kept; old tracking replaced", async () => {
  const stored = "https://de.viator.com/tours/Maui/x/d671-9281P1?currency=EUR&pid=OLD&campaign=stale";
  const h = harness({ urls: { [`${EXP}:e2`]: stored } });
  const res = await h.run("experience_id=e2&placement=experience", UA_SAFARI, VIATOR_ENV);
  const loc = new URL(res.headers.get("location"));
  assert.equal(loc.hostname, "de.viator.com");
  assert.equal(loc.searchParams.get("currency"), "EUR");
  assert.deepEqual(loc.searchParams.getAll("pid"), ["P00TESTPID"]);
  assert.equal(loc.searchParams.get("campaign"), "hf-experience-anon");
  assert.equal(loc.searchParams.get("medium_version"), "selector");
});

test("Viator without its variables: clean URL, untracked, still logged", async () => {
  const h = harness({ urls: { [`${EXP}:e3`]: MAUI } });
  const res = await h.run("experience_id=e3&placement=experience", UA_SAFARI, { AMAZON_ASSOCIATE_TAG: "t" });
  assert.equal(res.headers.get("location"), MAUI);
  assert.equal(h.writes[0].fields[F.network], "none");
});

test("notviator.com does not match Viator", async () => {
  const h = harness({ urls: { [`${EXP}:e4`]: "https://notviator.com/tours/x" } });
  const res = await h.run("experience_id=e4&placement=experience", UA_SAFARI, VIATOR_ENV);
  assert.equal(res.headers.get("location"), "https://notviator.com/tours/x");
});

test("experience with no vendor link goes to the fallback, not an error", async () => {
  const h = harness({ urls: { [`${EXP}:e5`]: "" } });
  const res = await h.run("experience_id=e5&placement=experience", UA_SAFARI, { ...VIATOR_ENV, REGISTRY_GO_FALLBACK_URL: "/" });
  assert.equal(res.status, 302);
  assert.equal(res.headers.get("location"), "/");
});
