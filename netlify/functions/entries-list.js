import { getStore } from "@netlify/blobs";

export default async (req /*, context */) => {
  try {
    if (req.method === "OPTIONS") return ok();

    const url = new URL(req.url);
    const status = (url.searchParams.get("status") || "approved").toLowerCase();
    const needsAuth = status === "pending" || status === "rejected";

    const auth = req.headers.get("authorization") || "";
    const hasToken = /^Bearer\s+.+/i.test(auth);
    if (needsAuth && !hasToken) return j(401, { error: "Unauthorized" });

    let store;
    try { store = getStore("entries"); }
    catch (e) { console.error("getStore(entries) failed:", e); return j(200, []); }

    let blobs = [];
    try {
      const list = await store.list();
      blobs = Array.isArray(list?.blobs) ? list.blobs : [];
    } catch (e) {
      console.error("store.list() failed:", e);
      return j(200, []);
    }

    const out = [];
    for (const b of blobs) {
      try {
        const item = await store.getJSON(b.key);
        if (item && item.status === status) out.push(item);
      } catch (e) {
        console.error("getJSON failed for", b?.key, e);
      }
    }

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
