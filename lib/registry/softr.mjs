// Softr Database API: https://docs.softr.io/softr-api/softr-database-api
// Records come back as { data: { id, fields: { <fieldId>: value } } }.
const BASE = "https://tables-api.softr.io/api/v1/databases";

export function createSoftr({ databaseId, apiKey, fetchImpl = fetch }) {
  const root = `${BASE}/${databaseId}/tables`;

  async function call(method, path, body, timeoutMs) {
    const res = await fetchImpl(root + path, {
      method,
      headers: { "Softr-Api-Key": apiKey, "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`Softr ${method} ${path} -> ${res.status} ${text.slice(0, 200)}`);
    }
    const json = await res.json();
    return json.data;
  }

  const rec = (tableId, id = "") =>
    `/${tableId}/records${id ? "/" + encodeURIComponent(id) : ""}`;

  return {
    getRecord: (tableId, id, ms) => call("GET", rec(tableId, id), null, ms),
    createRecord: (tableId, fields, ms) => call("POST", rec(tableId), { fields }, ms),
    // TODO: confirm PATCH (partial update) against Softr docs before CJ/Rakuten go live.
    updateRecord: (tableId, id, fields, ms) => call("PATCH", rec(tableId, id), { fields }, ms),
  };
}
