// netlify/functions/entries-update.js
import { getStore } from "@netlify/blobs";

export default async (req, context) => {
  try {
    if (req.method === "OPTIONS") return ok();
    if (req.method !== "PATCH") return json(405, { error: "Method not allowed" });

    const isAdmin = Boolean(context.clientContext?.identity?.token);
    if (!isAdmin) return json(401, { error: "Unauthorized" });

    // URL-Form: /.netlify/functions/entries-update/<ID>
    const parts = new URL(req.url).pathname.split("/");
    const id = parts[parts.length - 1];
    if (!id) return json(400, { error: "missing id" });

    const store = getStore("entries");
    const entry = await store.getJSON(id);
    if (!entry) return json(404, { error: "Not found" });

    const body = await req.json().catch(() => ({}));

    if (body.action === "approve") entry.status = "approved";
    if (body.action === "reject") entry.status = "rejected";
    if (typeof body.menuText === "string") entry.menuText = body.menuText;
    if (typeof body.featured !== "undefined") entry.featured = Boolean(body.featured);

    await store.setJSON(id, entry);
    return json(200, { ok: true, id, status: entry.status });
  } catch (e) {
    console.error("entries-update", e);
    return json(500, { error: e?.message || "internal error" });
  }
};

const ok = () => new Response(null, { status: 204, headers: cors() });
const json = (s, b) =>
  new Response(JSON.stringify(b), { status: s, headers: { "content-type": "application/json", ...cors() } });
const cors = () => ({
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Allow-Methods": "PATCH,OPTIONS",
});
