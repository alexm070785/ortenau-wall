import { getStore } from "@netlify/blobs";

/* ---- CORS Helpers ---- */
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,PATCH,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};
const res = (statusCode, bodyObj) => ({
  statusCode,
  headers: { "content-type": "application/json", ...CORS },
  body: JSON.stringify(bodyObj ?? {}),
});

/* ---- JSON speichern: v5/v6 kompatibel ---- */
const setJsonCompat = async (store, key, obj) => {
  if (typeof store.setJSON === "function") return store.setJSON(key, obj); // v6+
  return store.set(key, JSON.stringify(obj), { contentType: "application/json" }); // v5
};

export async function handler(event) {
  try {
    // Preflight
    if (event.httpMethod === "OPTIONS") return { statusCode: 204, headers: CORS };

    // Nur POST
    if (event.httpMethod !== "POST") return res(405, { error: "Method not allowed" });

    // Body für formData() vorbereiten
    const buf = event.body
      ? Buffer.from(event.body, event.isBase64Encoded ? "base64" : "utf8")
      : undefined;

    // Content-Type MUSS durchgereicht werden, sonst erkennt formData() kein multipart
    const headers = new Headers();
    for (const [k, v] of Object.entries(event.headers || {})) {
      if (typeof v === "string") headers.set(k, v);
    }

    const req = new Request("http://local", {
      method: "POST",
      headers,
      body: buf,
    });

    const form = await req.formData();

    // ---- Felder (GENAU wie dein Frontend sie sendet) ----
    const name     = (form.get("name") || "").trim();
    const category = (form.get("category") || "").trim();
    const ort      = (form.get("ort") || "").trim();
    const strasse  = (form.get("strasse") || "").trim();
    const hausnr   = (form.get("hausnr") || "").trim();
    const plz      = (form.get("plz") || "").trim();
    const menuText = (form.get("menuText") || "").toString();

    if (!name || !category || !ort || !strasse || !plz) {
      return res(400, { error: "missing_required_fields" });
    }

    const address =
      [strasse, hausnr].filter(Boolean).join(" ") +
      (plz || ort ? ", " + [plz, ort].filter(Boolean).join(" ") : "");

    const entry = {
      status: "pending",
      createdAt: new Date().toISOString(),
      name,
      category,
      city: ort,
      address,
      menuText,
      featured: false,
      images: [],
    };

    // ---- Bilder speichern ----
    const imgStore = getStore("images");
    const files = form.getAll("menuImages") || [];

    for (const file of files) {
      if (!(file instanceof Blob)) continue;
      const type = String(file.type || "");
      if (!type.startsWith("image/")) continue;

      const ext = (type.split("/")[1] || "jpg").toLowerCase();
      const filename = `img_${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;

      await imgStore.set(filename, file);
      // öffentlicher Blob-Pfad
      entry.images.push(`/.netlify/blobs/images/${filename}`);
    }

    if (entry.images.length) entry.thumbUrl = entry.images[0];

    // ---- Eintrag speichern ----
    const id = `e_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const entStore = getStore("entries");
    await setJsonCompat(entStore, id, entry);

    return res(200, { ok: true, id });
  } catch (e) {
    console.error("entries-create error", e);
    return res(500, { error: "create_failed" });
  }
}
