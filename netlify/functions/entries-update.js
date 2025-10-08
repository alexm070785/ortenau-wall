// netlify/functions/entries-update.mjs
import { createStore } from "@netlify/blobs";

// JSON-kompatible Helpers
const getJsonCompat = (store, key) =>
  typeof store.getJSON === "function"
    ? store.getJSON(key)
    : store.get(key, { type: "json" });

const setJsonCompat = (store, key, obj) =>
  typeof store.setJSON === "function"
    ? store.setJSON(key, obj)
    : store.set(key, JSON.stringify(obj), {
        contentType: "application/json",
      });

export async function handler(event, context) {
  try {
    // Nur Admins (Identity) dürfen updaten
    const { user } = context.clientContext || {};
    if (!user) {
      return { statusCode: 401, body: "Nicht autorisiert." };
    }

    const id = event.queryStringParameters?.id;
    const { action, menuText, featured } = JSON.parse(event.body || "{}");
    if (!id) return { statusCode: 400, body: "Fehlende id" };

    const store = createStore("entries");
    const item = await getJsonCompat(store, id);
    if (!item) return { statusCode: 404, body: "Eintrag nicht gefunden" };

    // Aktion anwenden
    if (action === "approve") {
      item.status = "approved";
      item.approvedAt = new Date().toISOString();
    } else if (action === "reject") {
      item.status = "rejected";
      item.rejectedAt = new Date().toISOString();
    } else {
      if (typeof menuText === "string") item.menuText = menuText;
      if (typeof featured !== "undefined") item.featured = !!featured;
      item.updatedAt = new Date().toISOString();
    }

    await setJsonCompat(store, id, item);

    return {
      statusCode: 200,
      body: JSON.stringify({ ok: true, id, item }),
    };
  } catch (err) {
    console.error("entries-update error:", err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message || "Serverfehler" }),
    };
  }
}
