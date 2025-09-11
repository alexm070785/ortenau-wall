// netlify/functions/entries-create.js
import { getStore } from "@netlify/blobs";

/**
 * Speichert einen Eintrag als "pending".
 * Erwartet multipart/form-data mit Feldern:
 * name, category, city, address, website, phone, hours_json (JSON-Array als String), image (optional)
 */
export default async (req) => {
  try {
    if (req.method === "OPTIONS") return ok();
    if (req.method !== "POST") return json(405, { error: "Method not allowed" });

    const ct = req.headers.get("content-type") || "";
    if (!ct.includes("multipart/form-data")) {
      return json(400, { error: "multipart/form-data expected" });
    }

    const form = await req.formData();

    // Pflichtfelder
    const name = (form.get("name") || "").toString().trim();
    const category = (form.get("category") || "").toString().trim();
    if (!name || !category) {
      return json(400, { error: "name & category required" });
    }

    const city = (form.get("city") || "").toString().trim();
    const address = (form.get("address") || "").toString().trim();
    const website = (form.get("website") || "").toString().trim();
    const phone = (form.get("phone") || "").toString().trim();

    // Öffnungszeiten
    let hours = [];
    const hoursStr = (form.get("hours_json") || "[]").toString().trim();
    try { hours = JSON.parse(hoursStr || "[]"); }
    catch { hours = []; }

    // Stores
    const images = getStore("images");
    const entries = getStore("entries");

    // Optional: Bild hochladen
    let imageUrl = "";
    const file = form.get("image");
    if (file && typeof file === "object" && file.arrayBuffer) {
      const ext = (file.type?.split("/")[1] || "jpg").replace(/[^a-z0-9]/gi, "");
      const key = `img_${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
      const buf = await file.arrayBuffer();
      await images.set(key, buf, { contentType: file.type || "image/jpeg" });
      imageUrl = await images.getPublicUrl(key);
      console.log("image uploaded:", key, imageUrl);
    }

    // Eintrag erzeugen
    const id = `e_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const entry = {
      id,
      status: "pending",
      name, category, city, address, website, phone,
      hours,
      imageUrl,
      featured: false,
      createdAt: new Date().toISOString(),
    };

    // Speichern
    await entries.setJSON(id, entry);
    // Direkt verifizieren
    const check = await entries.getJSON(id);
    console.log("entry saved?", Boolean(check), "id:", id);

    if (!check) {
      return json(500, { error: "Write failed (not found after setJSON)" });
    }

    return json(200, { ok: true, id, saved: true });
  } catch (err) {
    console.error("entries-create error:", err);
    return json(500, { error: err?.message || "internal error" });
  }
};

// Helpers
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
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
  };
}
