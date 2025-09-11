// netlify/functions/entries-update.js
import { getStore } from "@netlify/blobs";

export default async (req, context) => {
  if (req.method === "OPTIONS") return ok();
  if (req.method !== "PATCH") return json(405, { error: "Method not allowed" });
  if (!context.clientContext?.identity?.token) {
    return json(401, { error: "Unauthorized" });
  }

  // Aufruf-URL endet mit der ID: /.netlify/functions/entries-update/<id>
  const id = req.url.split("/").pop();
  if (!id) return json(400, { error: "missing id" });

  const store = getStore("entries");
  const entry = await store.getJSON(id);
  if (!entry) return json(404, { error: "Not found" });

  const body = await req.json().catch(() => ({}));

  // Aktionen
  if (body.action === "approve") entry.status = "approved";
  if (body.action === "reject") entry.status = "rejected";

  // Bearbeitbare Felder
  if (typeof body.menuText !== "undefined") entry.menuText = body.menuText;
  if (typeof body.featured === "boolean") entry.featured = body.featured;

  // Falls du auch Stammdaten ändern willst, diese Zeilen ent-kommentieren:
  // const editable = ["category", "address", "city", "website", "phone", "name"];
  // for (const k of editable) if (typeof body[k] !== "undefined") entry[k] = body[k];

  await store.setJSON(id, entry);
  return json(200, { ok: true });
};

// Helpers (CORS/JSON)
const ok = () => new Response(null, { status: 204, headers: cors() });
const json = (status, body) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...cors() },
  });
function cors() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Methods": "PATCH,OPTIONS",
  };
}
