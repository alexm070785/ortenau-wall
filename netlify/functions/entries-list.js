// netlify/functions/entries-list.js
// Liefert Einträge aus dem Blob-Store "entries" gefiltert nach status.
// - approved: öffentlich
// - pending / rejected: nur mit Identity-Token (Login)
// Admin-Rolle ist optional – Token reicht (kannst du leicht verschärfen).

import { getStore } from "@netlify/blobs";

export default async (req, context) => {
  try {
    // CORS
    if (req.method === "OPTIONS") return ok();

    const url = new URL(req.url);
    const status = (url.searchParams.get("status") || "approved").toLowerCase();

    const needsAuth = status === "pending" || status === "rejected";
    const hasToken = Boolean(context.clientContext?.identity?.token);

    if (needsAuth && !hasToken) {
      return j(401, { error: "Unauthorized" });
    }

    const store = getStore("entries");
    const { blobs } = await store.list(); // [{ key, size, uploadedAt, ... }]

    const out = [];
    for (const b of blobs) {
      const item = await store.getJSON(b.key);
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
