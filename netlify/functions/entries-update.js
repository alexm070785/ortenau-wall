// netlify/functions/entries-update.js
// PATCH erwartet JSON-Body: { id, status? , menuText? , featured? }
// Erfordert Login (Identity-Token). Optional kannst du admin-Rolle prüfen.

import { getStore } from "@netlify/blobs";

export default async (req, context) => {
  try {
    if (req.method === "OPTIONS") return ok();
    if (req.method !== "PATCH") return j(405, { error: "Method not allowed" });

    const hasToken = Boolean(context.clientContext?.identity?.token);
    if (!hasToken) return j(401, { error: "Unauthorized" });

    const body = await req.json().catch(() => ({}));
    const id = (body.id || "").toString().trim();
    if (!id) return j(400, { error: "id required" });

    const store = getStore("entries");
    const item = await store.getJSON(id);
    if (!item) return j(404, { error: "not found" });

    // Statusänderung (approve/reject) oder inhaltliche Updates
    if (typeof body.status === "string") {
      const next = body.status.toLowerCase();
      if (!["pending", "approved", "rejected"].includes(next)) {
        return j(400, { error: "invalid status" });
      }
      item.status = next;
    }

    if (typeof body.menuText === "string") item.menuText = body.menuText;
    if (typeof body.featured !== "undefined")
      item.featured = Boolean(body.featured === true || body.featured === "true");

    item.updatedAt = new Date().toISOString();

    await store.setJSON(id, item);
    return j(200, { ok: true });
  } catch (err) {
    console.error("entries-update error:", err);
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
