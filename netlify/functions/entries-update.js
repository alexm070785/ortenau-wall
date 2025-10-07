// netlify/functions/entries-update.js
import { getStore } from "@netlify/blobs";

export const config = { path: "/.netlify/functions/entries-update" };

export default async (req, context) => {
  // --- Auth ---
  const user = context.clientContext?.user || null;         // kommt aus Netlify Identity
  if (!user) {
    return json({ error: "Unauthorized" }, 401);
  }
  const roles = user.app_metadata?.roles || [];
  const isAdmin = roles.includes("admin");

  // -> wenn NUR Admins dürfen, folgende 2 Zeilen aktivieren:
  // if (!isAdmin) {
  //   return json({ error: "Forbidden" }, 403);
  // }

  // --- ID & Body ---
  const id = req.query?.get("id") || new URL(req.url).searchParams.get("id");
  if (!id) return json({ error: "Missing id" }, 400);

  let body = {};
  try {
    body = await req.json();
  } catch { /* leer */ }

  try {
    const store = getStore("entries");

    // Eintrag laden
    const item = await store.getJSON(id);
    if (!item) return json({ error: "Not found" }, 404);

    // Aktionen
    if (body.action === "approve") {
      item.status = "approved";
      item.approvedAt = Date.now();
    } else if (body.action === "reject") {
      // du kannst auch löschen statt Status setzen:
      // await store.delete(id);
      item.status = "rejected";
      item.rejectedAt = Date.now();
    } else {
      // normale Feldupdates (z.B. menuText, featured)
      if (typeof body.menuText === "string") item.menuText = body.menuText;
      if (typeof body.featured === "boolean") item.featured = body.featured;
      item.updatedAt = Date.now();
    }

    // Speichern (nur wenn nicht gelöscht)
    if (body.action !== "reject" /* und du nicht löschst */) {
      await store.setJSON(id, item);
    }

    return json({ ok: true, id, item }, 200);
  } catch (e) {
    return json({ error: String(e?.message || e) }, 500);
  }
};

// kleine Helper
function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "access-control-allow-origin": "*"
    }
  });
}
