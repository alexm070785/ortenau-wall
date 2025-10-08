// netlify/functions/entries-update.js

// 🧩 Hilfsfunktionen für JSON-kompatible Speicherung:
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

// 🟢 Haupteinstiegspunkt – MUSS async sein!
exports.handler = async (event, context) => {
  try {
    // 🔐 Authentifizierung prüfen
    const { user } = context.clientContext || {};
    if (!user) {
      return { statusCode: 401, body: "Nicht autorisiert." };
    }

    const id = event.queryStringParameters?.id;
    const { action } = JSON.parse(event.body || "{}");

    if (!id || !action) {
      return { statusCode: 400, body: "Fehlende Parameter (id/action)" };
    }

    // 🔸 Beispiel: Zugriff auf deine Datenbank (z. B. Netlify Store)
    const store = require("@netlify/blobs").createStore("entries");

    // 📖 Eintrag lesen
    const item = await getJsonCompat(store, id);
    if (!item) {
      return { statusCode: 404, body: "Eintrag nicht gefunden" };
    }

    // ✏️ Status ändern
    item.status = action === "approve" ? "approved" : "rejected";
    item.updatedAt = new Date().toISOString();

    // 💾 Speichern
    await setJsonCompat(store, id, item);

    // ✅ Erfolgsmeldung
    return {
      statusCode: 200,
      body: JSON.stringify({ success: true, id, action }),
    };
  } catch (err) {
    console.error("entries-update error:", err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message || "Serverfehler" }),
    };
  }
};
