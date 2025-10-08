// netlify/functions/entries-create.mjs
import { createStore } from "@netlify/blobs";

/** CORS-Header für Browser-Requests */
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

export async function handler(event) {
  try {
    // Preflight (CORS)
    if (event.httpMethod === "OPTIONS") {
      return { statusCode: 204, headers: CORS };
    }

    // Nur POST zulassen
    if (event.httpMethod !== "POST") {
      return res(405, { error: "Method not allowed" });
    }

    // Body in einen WHATWG Request wickeln, damit formData() funktioniert
    const req = new Request("http://local", {
      method: event.httpMethod,
      headers: event.headers,
      body: event.body
        ? Buffer.from(
            event.body,
            event.isBase64Encoded ? "base64" : "utf8"
          )
        : undefined,
    });

    const form = await req.formData();

    // --- Felder einsammeln (genau wie deine Seite sie schickt) ---
    const name = (form.get("name") || "").trim();
    const category = (form.get("category") || "").trim();
    const ort = (form.get("ort") || "").trim();
    const strasse = (form.get("strasse") || "").trim();
    const hausnr = (form.get("hausnr") || "").trim();
    const plz = (form.get("plz") || "").trim();

    if (!name || !category || !ort || !strasse || !plz) {
      return res(400, { error: "missing_required_fields" });
    }

    // Adresse zusammenbauen, so wie du sie brauchst
    const address = [strasse, hausnr].filter(Boolean).join(" ") +
      (plz || ort ? ", " + [plz, ort].filter(Boolean).join(" ") : "");

    // Eintrags-Objekt
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

    // --- Bilder speichern ---
    const imgStore = createStore("images");
    const files = form.getAll("menuImages") || [];
    for (const file of files) {
      // Nur echte Bild-Blobs speichern
      if (!(file instanceof Blob)) continue;
      if (!String(file.type || "").startsWith("image/")) continue;

      const ext = (file.type.split("/")[1] || "jpg").toLowerCase();
      const filename =
        `img_${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;

      await imgStore.set(filename, file);
      entry.images.push(`/.netlify/blobs/images/${filename}`);
    }
    if (entry.images.length) entry.thumbUrl = entry.images[0];

    // --- Eintrag speichern ---
    const id = `e_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const entStore = createStore("entries");

    // kompatibel JSON speichern (v5/v6 SDK)
    if (typeof entStore.setJSON === "function") {
      await entStore.setJSON(id, entry);
    } else {
      await entStore.set(id, JSON.stringify(entry), {
        contentType: "application/json",
      });
    }

    return res(200, { ok: true, id });
  } catch (e) {
    console.error("entries-create error", e);
    return res(500, { error: "create_failed" });
  }
}
