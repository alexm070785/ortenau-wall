import { getStore } from "@netlify/blobs";

export default async (req /*, context */) => {
  try {
    if (req.method === "OPTIONS") return ok();

    const url = new URL(req.url);
    const status = (url.searchParams.get("status") || "approved").toLowerCase();
    const needsAuth = status === "pending" || status === "rejected";

    // Auth nur für geschützte Views
    const auth = req.headers.get("authorization") || "";
    const hasToken = /^Bearer\s+.+/i.test(auth);
    if (needsAuth && !hasToken) return j(401, { error: "Unauthorized" });

    // Store holen
    let store;
    try {
      store = getStore("entries");
    } catch (e) {
      console.error("getStore(entries) failed:", e);
      return j(200, []); // lieber leere Liste als 500
    }

    // Blobs auflisten
    let blobs = [];
    try {
      const list = await store.list(); // => { blobs: [...] }
      blobs = Array.isArray(list?.blobs) ? list.blobs : [];
    } catch (e) {
      console.error("store.list() failed:", e);
      return j(200, []);
    }

    // Helper: kompatibel JSON laden (getJSON ODER get(..., {type:'json'}))
    const getJsonCompat = async (key) => {
      if (typeof store.getJSON === "function") {
        return store.getJSON(key);
      }
      return store.get(key, { type: "json" }); // neue API
    };

    const out = [];
    for (const b of blobs) {
      try {
        const item = await getJsonCompat(b.key);
        if (item && item.status === status) out.push(item);
      } catch (e) {
        console.error("JSON read failed for", b?.key, e);
      }
    }

    // Neueste oben
    out.sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
    return j(200, out);
  } catch (err) {
    console.error("entries-list TOP-LEVEL error:", err);
    return j(200, []);
  }
};

const ok = () => new Response(null, { status: 204, headers: cors() });
const j = (s, body) =>
  new Response(JSON.stringify(body), {
    status: s,
    headers: { "content-type": "application/json", ...cors() },
  });

const cors = () => ({
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Allow-Methods": "GET,POST,PATCH,OPTIONS",
});
