import { getStore } from "@netlify/blobs";

/** CORS-Header */
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,PATCH,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

const json = (code, body) => ({
  statusCode: code,
  headers: { "content-type": "application/json", ...CORS },
  body: JSON.stringify(body ?? {}),
});

/** Nur 1 Bild, max 8 MB => vermeidet 502 bei Free-Tier */
const MAX_IMAGE_MB = 8;

export async function handler(event) {
  try {
    if (event.httpMethod === "OPTIONS") return { statusCode: 204, headers: CORS };
    if (event.httpMethod !== "POST") return json(405, { error: "Method not allowed" });

    // WHATWG Request bauen, damit formData() funktioniert
    const req = new Request("http://local", {
      method: "POST",
      headers: event.headers,
      body: event.body
        ? Buffer.from(event.body, event.isBase64Encoded ? "base64" : "utf8")
        : undefined,
    });

    const form = await req.formData();

    // Pflichtfelder
    const name     = (form.get("name") || "").trim();
    const category = (form.get("category") || "").trim();
    const ort      = (form.get("ort") || "").trim();
    const strasse  = (form.get("strasse") || "").trim();
    const hausnr   = (form.get("hausnr") || "").trim();
    const plz      = (form.get("plz") || "").trim();

    if (!name || !category || !ort || !strasse || !plz) {
      return json(400, { error: "missing_required_fields" });
    }

    // Adresse zusammenbauen
    const address =
      [strasse, hausnr].filter(Boolean).join(" ") +
      (plz || ort ? ", " + [plz, ort].filter(Boolean).join(" ") : "");

    // Eintrag-Grunddaten
    const entry = {
      status: "pending",
      createdAt: new Date().toISOString(),
      name,
      category,
      city: ort,
      address,
      menuText: form.get("menuText") || "",
      featured: false,
      images: [],
    };

    // === Bilder: nur 1 Bild zulassen, 8 MB Limit ===
    const allFiles = form.getAll("menuImages") || [];
    const first = allFiles.find((f) => f instanceof Blob && String(f.type).startsWith("image/"));
    if (!first) {
      return json(400, { error: "no_image_selected" });
    }
    if (first.size > MAX_IMAGE_MB * 1024 * 1024) {
      return json(413, { error: "image_too_large", maxMB: MAX_IMAGE_MB });
    }

    const imgStore = getStore("images");
    const ext = (first.type.split("/")[1] || "jpg").toLowerCase();
    const filename = `img_${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;

    await imgStore.set(filename, first, { contentType: first.type || "image/jpeg" });
    const blobUrl = `/.netlify/blobs/images/${filename}`;
    entry.images.push(blobUrl);
    entry.thumbUrl = blobUrl;

    // === Eintrag speichern ===
    const id = `e_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const entStore = getStore("entries");

    // v5/v6-kompatibel JSON schreiben
    if (typeof entStore.setJSON === "function") {
      await entStore.setJSON(id, entry);
    } else {
      await entStore.set(id, JSON.stringify(entry), {
        contentType: "application/json",
      });
    }

    return json(200, { ok: true, id });
  } catch (e) {
    console.error("entries-create error", e);
    return json(500, { error: "create_failed" });
  }
}
