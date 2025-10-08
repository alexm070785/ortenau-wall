import { getStore } from "@netlify/blobs";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};
const res = (code, body) => ({
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
    if (event.httpMethod !== "POST") return res(405, { error: "Method not allowed" });

    const user = context?.clientContext?.user;
    if (!user) return res(401, { error: "Unauthorized" });

    // --- Body-Parsing robust ---
    let form;
    try {
      const contentType = event.headers["content-type"] || event.headers["Content-Type"] || "";
      if (!contentType.includes("multipart/form-data")) {
        return res(400, { error: "Expected multipart/form-data" });
      }

      const raw = Buffer.from(
        event.body || "",
        event.isBase64Encoded ? "base64" : "utf8"
      );
      const req = new Request("http://local", {
        method: "POST",
        headers: { "content-type": contentType },
        body: raw,
      });
      form = await req.formData();
    } catch (err) {
      console.error("formData parse error", err);
      return res(400, { error: "form_parse_failed" });
    }

    // --- Felder einlesen ---
    const name = (form.get("name") || "").trim();
    const category = (form.get("category") || "").trim();
    const city = (form.get("city") || "").trim();
    const street = (form.get("street") || "").trim();
    const zip = (form.get("zip") || "").trim();
    const website = (form.get("website") || "").trim();
    const phone = (form.get("phone") || "").trim();
    const menuText = (form.get("menuText") || "").toString();
    const mapsUrl = (form.get("mapsUrl") || "").trim();
    const featured = String(form.get("featured") || "") === "true";

    if (!name || !category || !city || !street || !zip)
      return res(400, { error: "missing_required_fields" });

    const address = [street, `${zip} ${city}`].join(", ");

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
      address,
      images: [],
    };

    // --- Optional: Bild speichern ---
    try {
      const file = form.get("image");
      if (file instanceof Blob && file.size > 0) {
        const imgStore = getStore("images");
        const ext = (file.type.split("/")[1] || "jpg").toLowerCase();
        const filename = `img_${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
        await imgStore.set(filename, file);
        entry.imageUrl = `/.netlify/blobs/images/${filename}`;
        entry.thumbUrl = entry.imageUrl;
        entry.images.push(entry.imageUrl);
      }
    } catch (imgErr) {
      console.warn("Image upload skipped:", imgErr);
    }

    // --- Speichern im entries-Store ---
    const id = `e_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const store = getStore("entries");
    await setJsonCompat(store, id, entry);

    return res(200, { ok: true, id, entry });
  } catch (err) {
    console.error("entries-create fatal error", err);
    return res(500, { error: "create_failed" });
  }
}
