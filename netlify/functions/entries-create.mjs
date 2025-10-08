// netlify/functions/entries-create.mjs
import { getStore } from "@netlify/blobs";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};
const json = (code, body) => ({
  statusCode: code,
  headers: { "content-type": "application/json", ...CORS },
  body: JSON.stringify(body ?? {}),
});
const setJsonCompat = async (store, key, obj) =>
  typeof store.setJSON === "function"
    ? store.setJSON(key, obj)
    : store.set(key, JSON.stringify(obj), { contentType: "application/json" });

export async function handler(event, context) {
  try {
    if (event.httpMethod === "OPTIONS") return { statusCode: 204, headers: CORS };
    if (event.httpMethod !== "POST") return json(405, { error: "method_not_allowed" });

    // Nur mit Login (Netlify Identity)
    const user = context?.clientContext?.user || null;
    if (!user) return json(401, { error: "unauthorized" });

    // --- Body -> FormData (robust, inkl. Base64) ---
    let form;
    try {
      const ct = event.headers["content-type"] || event.headers["Content-Type"] || "";
      const raw = Buffer.from(event.body || "", event.isBase64Encoded ? "base64" : "utf8");
      const req = new Request("http://local", { method: "POST", headers: { "content-type": ct }, body: raw });
      form = await req.formData();
    } catch (err) {
      console.error("formData parse error", err);
      return json(400, { error: "form_parse_failed" });
    }

    // --- Felder: akzeptiere deutsch/englisch ---
    const pick = (...keys) => {
      for (const k of keys) {
        const v = form.get(k);
        if (v != null && String(v).trim() !== "") return String(v).trim();
      }
      return "";
    };

    const name     = pick("name");
    const category = pick("category", "kategorie");
    const city     = pick("city", "stadt", "ort");
    const zip      = pick("zip", "plz");
    const street   = pick("street", "straße", "strasse");
    const website  = pick("website", "webseite");
    const phone    = pick("phone", "telefon");
    const mapsUrl  = pick("mapsUrl", "google", "maps", "googleMaps");
    const menuText = pick("menuText", "menü", "notiz", "menu", "memo");

    const featuredRaw = pick("featured");
    const featured = featuredRaw ? ["true", "1", "yes", "ja"].includes(featuredRaw.toLowerCase()) : false;

    if (!name || !category || !city || !zip || !street) {
      return json(400, { error: "missing_required_fields", details: { name, category, city, zip, street } });
    }

    const address = `${street}, ${zip} ${city}`;

    const entry = {
      status: "approved", // du trägst selbst ein → direkt freigegeben
      createdAt: new Date().toISOString(),
      name,
      category,
      city,
      zip,
      street,
      address,
      website,
      phone,
      mapsUrl,
      menuText,
      featured,
      images: [],
    };

    // --- Optional: Bild speichern (akzeptiere "image" ODER "bild") ---
    try {
      const file = form.get("image") || form.get("bild");
      if (file instanceof Blob && file.size > 0) {
        const images = getStore("images");
        const ext = (file.type?.split("/")[1] || "jpg").toLowerCase();
        const filename = `img_${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
        await images.set(filename, file);
        const url = `/.netlify/blobs/images/${filename}`;
        entry.imageUrl = url;
        entry.thumbUrl = url;
        entry.images.push(url);
      }
    } catch (imgErr) {
      // Bild ist optional – nicht hart fehlschlagen
      console.warn("image upload skipped:", imgErr?.message || imgErr);
    }

    // --- Speichern ---
    const id = `e_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const entries = getStore("entries");
    await setJsonCompat(entries, id, entry);

    return json(200, { ok: true, id, entry });
  } catch (err) {
    console.error("entries-create fatal", err);
    return json(500, { error: "create_failed", msg: err?.message || String(err) });
  }
}
