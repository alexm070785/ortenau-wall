// netlify/functions/entries-list.js
// Liste Einträge aus Blob-Store "entries" gefiltert nach status.
// - approved: öffentlich
// - pending / rejected: nur mit Authorization: Bearer <jwt>

import { getStore } from "@netlify/blobs";

export default async (req /*, context */) => {
  try {
    if (req.method === "OPTIONS") return ok();

    const url = new URL(req.url);
    const status = (url.searchParams.get("status") || "approved").toLowerCase();
    const needsAuth = status === "pending" || status === "rejected";

    // **Robust:** Header direkt lesen, nicht auf context verlassen
    const auth = req.headers.get("authorization") || "";
    const hasToken = /^Bearer\s+.+/i.test(auth);

    if (needsAuth && !hasToken) {
      return j(401, { error: "Unauthorized" });
    }

    const store = getStore("entries");
    const { blobs } = await store.list(); // [{ key, ... }]

    const out = [];
    for (const b of blobs) {
      const item = await store.getJSON(b.key).catch(() => null);
      if (item && item.status === status) out.push(item);
    }

    // Neueste zuerst
    out.sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
    return j(200, out);
  } catch (err) {
    console.error("entries-list error:", err);
    return j(500, { error: err?.message || "internal error" });
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
