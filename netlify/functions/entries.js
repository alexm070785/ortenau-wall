// /netlify/functions/entries.js
// CommonJS + Netlify Blobs (Server-Client) – robust für unterschiedliche SDK-Versionen
const blobs = require("@netlify/blobs");
const { BlobsServer } = blobs; // in deiner Version vorhanden

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,DELETE,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, x-admin-token",
};

const KEY = "data"; // hier speichern wir das Array

const ok = (body) => ({
  statusCode: 200,
  headers: { ...CORS, "Content-Type": "application/json" },
  body: JSON.stringify(body),
});
const bad = (code, msg) => ({
  statusCode: code,
  headers: CORS,
  body: JSON.stringify({ error: msg }),
});

// Schreibschutz optional: Setze NETLIFY_ADMIN_TOKEN in den Environment Variables,
// und übergib denselben Wert im Header `x-admin-token` (siehe admin.html).
function requireAdmin(event) {
  const need = !!process.env.NETLIFY_ADMIN_TOKEN;
  if (!need) return true;
  const got = event.headers["x-admin-token"];
  return got && got === process.env.NETLIFY_ADMIN_TOKEN;
}

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: CORS };
  }

  // Debug-Helfer: /api/entries?debug=1 zeigt ENV-Präsenz & verfügbare Exporte
  if (event.queryStringParameters && event.queryStringParameters.debug === "1") {
    const envPresent = {
      NETLIFY_SITE_ID: !!process.env.NETLIFY_SITE_ID,
      NETLIFY_AUTH_TOKEN: !!process.env.NETLIFY_AUTH_TOKEN,
      NETLIFY_ADMIN_TOKEN: !!process.env.NETLIFY_ADMIN_TOKEN,
    };
    const exportsList = Object.keys(require("@netlify/blobs") || {});
    return ok({ envPresent, exports: exportsList });
  }

  const siteID = process.env.NETLIFY_SITE_ID;
  const token = process.env.NETLIFY_AUTH_TOKEN;
  if (!siteID || !token) {
    return bad(500, "Blobs not configured: missing NETLIFY_SITE_ID or NETLIFY_AUTH_TOKEN");
  }

  // WICHTIG: In deiner SDK-Version hat BlobsServer die Methode getStore(...)
  const client = new BlobsServer({ siteID, token });
  const store = client.getStore("seiten"); // ← Store-Name frei wählbar

  try {
    if (event.httpMethod === "GET") {
      const raw = await store.get(KEY);
      const arr = raw ? JSON.parse(raw) : [];
      return ok(arr);
    }

    if (event.httpMethod === "POST") {
      if (!requireAdmin(event)) return bad(401, "Unauthorized");
      let payload;
      try {
        payload = JSON.parse(event.body || "{}");
      } catch {
        return bad(400, "Invalid JSON");
      }

      const { titel, url, kategorie, stadt } = payload;
      if (!titel) return bad(400, "titel fehlt");

      const raw = await store.get(KEY);
      const arr = raw ? JSON.parse(raw) : [];
      arr.push({
        titel: stadt ? `${titel} · ${stadt}` : titel,
        url: url || "",
        kategorie: kategorie || "restaurant",
        createdAt: new Date().toISOString(),
      });

      await store.set(KEY, JSON.stringify(arr));
      return ok(arr);
    }

    if (event.httpMethod === "DELETE") {
      if (!requireAdmin(event)) return bad(401, "Unauthorized");
      await store.set(KEY, JSON.stringify([]));
      return ok([]);
    }

    return bad(405, "Method Not Allowed");
  } catch (err) {
    console.error(err);
    return bad(500, String(err && err.message ? err.message : err));
  }
};
