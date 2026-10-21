// Table and field ids are not secrets, so they live here.
// Credentials and the Amazon tag come from Vercel environment variables.

export const TABLES = {
  clickLog: {
    id: "HzlyLJQYXoK44U",
    fields: {
      clickId: "zrrdG",          // autonumber, read back on create
      clickedAt: "IwDnd",
      itemId: "ULDdE",
      catalogProductId: "HKJBR",
      registryId: "NW7RQ",
      celebrationId: "ovh2J",
      placement: "piVTY",
      retailer: "5do8k",
      network: "iVRYy",
      finalHost: "8siV0",
      isBot: "uGKMf",
      // Optional: the id of a Text column "Experience Id" in the click log.
      // Until it's set, experience clicks are logged in Item Id as "exp:<id>".
      experienceId: "",
    },
  },

  // Ids taken from main.py (TABLE_GIFT_REGISTRY_ITEMS, F_RITEM_SOURCE_URL).
  registryItems: {
    id: "f2pdwkbGU7ouWh",
    fields: { url: "LTmna" },
  },

  // The catalogue stores a link template, not a plain URL: it contains the
  // literal "{affiliate_tag}" (TABLE_PRODUCTS_CATALOGUE, F_CAT_AFFILIATE_TEMPLATE).
  catalogue: {
    id: "LGlF33UhUKHk71",
    fields: { url: "JQnGA" },
  },

  // Experiences: the booking link is the Vendor URL (main.py F_EXP_VENDOR_URL).
  experiences: {
    id: "cyP7i9bg931LhG",
    fields: { url: "YktkS" },
  },
};

// "registry" is the couple's own MyRegistry block; "guest" is the public
// live registry page, so guest clicks can be told apart from the couple's.
// "experience": the couple's "Book this" button on a funded experience card.
export const PLACEMENTS = new Set(["registry", "guest", "shop", "trending", "spotlight", "experience"]);

export const TIMEOUTS = {
  readMs: 1500,      // loading the clean URL
  logFirstMs: 800,   // CJ / Rakuten: wait this long for a click id, then go anyway
  deferredMs: 5000,  // writes made after the redirect
};
