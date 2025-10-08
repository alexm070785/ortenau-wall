import { getStore } from "@netlify/blobs";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,PATCH,DELETE,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};
const res = (code, body) => ({
  statusCode: code,
  headers: { "content-type": "application/json", ...CORS },
  body: JSON.stringify(body ?? {}),
});
const setJSON = async (store, key, obj) =>
  typeof store.setJSON === "function"
    ? store.setJSON(key, obj)
    : store.set(key, JSON.stringify(obj), { contentType: "application/json" });

export async function handler(event, context) {
  try {
    if (event.httpMethod === "OPTIONS") return { statusCode: 204, headers: CORS };
    if (event.httpMethod !== "POST") return res(405, { error: "Method not allowed" });

    // Nur eingeloggte (Admin/Identity) dürfen
    const user = context?.clientContext?.user || null;
    if (!user) return res(401, { error: "Unauthorized" });

    // Request -> formData
    const buf = event.body
      ? Buffer.from(event.body, event.isBase64Encoded ? "base64" : "utf8")
      : undefined;

    const headers = new Headers();
    for (const [k, v] of Object.entries(event.headers || {})) {
      if (typeof v === "string") headers.set(k, v);
    }

    const req = new Request("http://local", { method: "POST", headers, body: buf });
    const form = await req.formData();

    const name     = (form.get("name") || "").trim();
    const category = (form.get("category") || "").trim();
    const city     = (form.get("city") || "").trim();
    const street   = (form.get("street") || "").trim();
    const zip      = (form.get("zip") || "").trim();
    const website  = (form.get("website") || "").trim();
    const phone    = (form.get("phone") || "").trim();
    const menuText = (form.get("menuText") || "").toString();
    const mapsUrl  = (form.get("mapsUrl") || "").trim();
    const featured = String(form.get("featured") || "") === "true";

    if (!name || !category || !city || !street || !zip) {
      return res(400, { error: "missing_required_fields" });
    }

    const entry = {
      status: "approved",
      createdAt: new Date().toISOString(),
      name,
      category,
      city,
      street,
      zip,
      website,
      phone,
      menuText,
      mapsUrl,
      featured,
      imageUrl: "", // wird unten gesetzt, wenn Bild da
      // Für Abwärtskompatibilität:
      address: [street, zip && city ? `${zip} ${city}` : city].filter(Boolean).join(", "),
      images: []
    };

    // Bild speichern (optional)
    const img = form.get("image");
    if (img instanceof Blob && String(img.type || "").startsWith("image/")) {
      const imagesStore = getStore("images");
      const ext = (img.type.split("/")[1] || "jpg").toLowerCase();
      const filename = `img_${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
      await imagesStore.set(filename, img);
      entry.imageUrl = `/.netlify/blobs/images/${filename}`;
      entry.images.push(entry.imageUrl);
      entry.thumbUrl = entry.imageUrl;
    }

    const id = `e_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const ent = getStore("entries");
    await setJSON(ent, id, entry);

    return res(200, { ok: true, id, item: { id, ...entry } });
  } catch (e) {
    console.error("entries-create error", e);
    return res(500, { error: "create_failed" });
  }
}
