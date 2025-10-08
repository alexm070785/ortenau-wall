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
const getJSON = async (store, key) =>
  typeof store.getJSON === "function"
    ? store.getJSON(key)
    : store.get(key, { type: "json" });
const setJSON = async (store, key, obj) =>
  typeof store.setJSON === "function"
    ? store.setJSON(key, obj)
    : store.set(key, JSON.stringify(obj), { contentType: "application/json" });

export async function handler(event, context) {
  try {
    if (event.httpMethod === "OPTIONS") return { statusCode: 204, headers: CORS };

    const user = context?.clientContext?.user || null;
    if (!user) return res(401, { error: "Unauthorized" });

    const id = event.queryStringParameters?.id;
    if (!id) return res(400, { error: "missing_id" });

    const store = getStore("entries");

    if (event.httpMethod === "DELETE") {
      await store.delete(id);
      return res(200, { ok: true, deleted: id });
    }

    if (event.httpMethod !== "PATCH") return res(405, { error: "Method not allowed" });

    const payload = JSON.parse(event.body || "{}");
    const item = await getJSON(store, id);
    if (!item) return res(404, { error: "not_found" });

    // erlaubte Felder
    const fields = ["name","category","city","street","zip","website","phone","menuText","mapsUrl","featured"];
    for (const k of fields) {
      if (k in payload) item[k] = k === "featured" ? !!payload[k] : String(payload[k] || "");
    }
    item.updatedAt = new Date().toISOString();

    await setJSON(store, id, item);
    return res(200, { ok: true, id, item });
  } catch (e) {
    console.error("entries-update error", e);
    return res(500, { error: "update_failed" });
  }
}
