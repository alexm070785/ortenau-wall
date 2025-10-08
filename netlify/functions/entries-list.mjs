import { getStore } from "@netlify/blobs";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,PATCH,DELETE,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};
const res = (code, body) => ({
  statusCode: code,
  headers: { "content-type": "application/json", ...CORS },
  body: JSON.stringify(body ?? []),
});
const getJSON = async (store, key) =>
  typeof store.getJSON === "function"
    ? store.getJSON(key)
    : store.get(key, { type: "json" });

export async function handler(event, context) {
  try {
    if (event.httpMethod === "OPTIONS") return { statusCode: 204, headers: CORS };
    if (event.httpMethod !== "GET") return res(405, { error: "Method not allowed" });

    const url = new URL(event.rawUrl);
    const statusParam = (url.searchParams.get("status") || "approved").toLowerCase();
    const user = context?.clientContext?.user || null;

    const allowed = user ? ["approved", "all"] : ["approved"];
    const status = allowed.includes(statusParam) ? statusParam : "approved";

    const store = getStore("entries");
    const list = await store.list(); // { blobs: [...] }
    const keys = Array.isArray(list?.blobs) ? list.blobs.map(b => b.key) : [];

    const out = [];
    for (const key of keys) {
      try {
        const item = await getJSON(store, key);
        if (!item) continue;
        if (status === "all" || (item.status || "approved") === "approved") {
          out.push({ id: key, ...item });
        }
      } catch (e) {
        console.error("read fail", key, e);
      }
    }
    out.sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
    return res(200, out);
  } catch (e) {
    console.error("entries-list error", e);
    return res(200, []); // lieber leer zurückgeben
  }
}
