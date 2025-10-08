// /netlify/functions/entries.js
import { getStore } from "@netlify/blobs";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,DELETE,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, x-admin-token",
};

const KEY = "data"; // unter diesem Schlüssel liegt das JSON-Array

export async function handler(event) {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: CORS };
  }

  const store = getStore("seiten"); // Blob-Store-Name

  // kleine Helfer
  const ok = (body) => ({ statusCode: 200, headers: {...CORS, "Content-Type":"application/json"}, body: JSON.stringify(body) });
  const bad = (code, msg) => ({ statusCode: code, headers: CORS, body: JSON.stringify({ error: msg }) });

  // Optionaler Admin-Token (in Netlify UI als Umgebungsvariable NETLIFY_ADMIN_TOKEN setzen)
  const requireAdmin = () => {
    const need = !!process.env.NETLIFY_ADMIN_TOKEN;
    if (!need) return true; // wenn kein Token gesetzt, kein Schutz
    const got = event.headers["x-admin-token"];
    return got && got === process.env.NETLIFY_ADMIN_TOKEN;
  };

  // Liste holen (GET)
  if (event.httpMethod === "GET") {
    const raw = await store.get(KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return ok(arr);
  }

  // Eintrag anlegen (POST)
  if (event.httpMethod === "POST") {
    if (!requireAdmin()) return bad(401, "Unauthorized");
    let payload;
    try { payload = JSON.parse(event.body || "{}"); } catch { return bad(400, "Invalid JSON"); }

    const { titel, url, kategorie, stadt } = payload;
    if (!titel) return bad(400, "titel fehlt");

    const raw = await store.get(KEY);
    const arr = raw ? JSON.parse(raw) : [];
    arr.push({
      titel: stadt ? `${titel} · ${stadt}` : titel,
      url: url || "",
      kategorie: kategorie || "restaurant",
      createdAt: new Date().toISOString()
    });
    await store.set(KEY, JSON.stringify(arr));
    return ok(arr);
  }

  // Alles löschen (DELETE)
  if (event.httpMethod === "DELETE") {
    if (!requireAdmin()) return bad(401, "Unauthorized");
    await store.set(KEY, JSON.stringify([]));
    return ok([]);
  }

  return bad(405, "Method Not Allowed");
}
