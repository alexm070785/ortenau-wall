// netlify/functions/entries-create.js
// Speichert einen Eintrag in "entries" und (optional) ein Bild in "images" (Blob-Store).
// Erwartete Felder (multipart/form-data):
//  - name, category (Pflicht)
//  - city, address, website, phone (optional)
//  - hours_json (optional, JSON-Array als String)
//  - image (optional, 1 Datei)
// Hinweis: In netlify.toml muss der Blob-Store "images" visibility="public" haben,
// dann ist die Datei unter /.netlify/blobs/images/<key> öffentlich abrufbar.

import { getStore } from "@netlify/blobs";

export default async (req) => {
  try {
    // CORS preflight
    if (req.method === "OPTIONS") return ok();

    if (req.method !== "POST") {
      return j(405, { error: "Method not allowed" });
    }

    const ct = req.headers.get("content-type") || "";
    if (!ct.toLowerCase().includes("multipart/form-data")) {
      return j(400, { error: "multipart/form-data expected" });
    }

    const form = await req.formData();

    const name = (form.get("name") || "").toString().trim();
    const category = (form.get("category") || "").toString().trim();

    if (!name || !category) {
      return j(400, { error: "name & category required" });
    }

    const city    = (form.get("city") || "").toString().trim();
    const address = (form.get("address") || "").toString().trim();
    const website = (form.get("website") || "").toString().trim();
    const phone   = (form.get("phone") || "").toString().trim();

    let hours = [];
    try {
      const raw = (form.get("hours_json") || "[]").toString();
      hours = JSON.parse(raw || "[]");
      if (!Array.isArray(hours)) hours = [];
    } catch {
      hours = [];
    }

    const images  = getStore("images");
    const entries = getStore("entries");

    // Optional: 1 Bild speichern
    let imageUrl = "";
    const file = form.get("image");
    if (file && typeof file === "object" && file.arrayBuffer) {
      const buf = await file.arrayBuffer();

      // einfache Größenbremse (optional)
      const MAX = 8 * 1024 * 1024; // 8 MB
      if (buf.byteLength > MAX) {
        return j(413, { error: "image too large (max 8MB)" });
      }

      const ext = (file.type?.split("/")[1] || "jpg").replace(/[^a-z0-9]/gi, "") || "jpg";
      const key = `img_${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;

      await images.set(key, buf, { contentType: file.type || "image/jpeg" });

      // Da der Store "images" in netlify.toml visibility="public" hat,
      // ist diese URL direkt erreichbar:
      imageUrl = `/.netlify/blobs/images/${encodeURIComponent(key)}`;
    }

    // Eintrag erzeugen & speichern
    const id = `e_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const entry = {
      id,
      status: "pending",
      name,
      category,
      city,
      address,
      website,
      phone,
      hours,
      imageUrl,
      featured: false,
      createdAt: new Date().toISOString(),
    };

    await entries.setJSON(id, entry);

    return j(200, { ok: true, id });
  } catch (err) {
    console.error("entries-create error:", err);
    return j(500, { error: err?.message || "internal error" });
  }
};

// Hilfsfunktionen (CORS + JSON)
const ok = () => new Response(null, { status: 204, headers: cors() });
const j = (status, body) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...cors() },
  });

const cors = () => ({
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Allow-Methods": "GET,POST,PATCH,OPTIONS",
});
