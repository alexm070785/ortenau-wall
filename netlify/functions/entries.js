// CommonJS-Version für Netlify Functions
const { getStore } = require("@netlify/blobs");

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,DELETE,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, x-admin-token",
};

// Blobs-Store "seiten" mit SiteID + Token aus den Environment Variables
const store = getStore("seiten", {
  siteID: process.env.NETLIFY_SITE_ID,
  token: process.env.NETLIFY_AUTH_TOKEN,
});

const KEY = "data";

function ok(body) {
  return {
    statusCode: 200,
    headers: { ...CORS, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  };
}
function bad(code, msg) {
  return { statusCode: code, headers: CORS, body: JSON.stringify({ error: msg }) };
}

// Optional: Admin-Token setzen (ENV: NETLIFY_ADMIN_TOKEN). Ohne ENV ist POST/DELETE offen.
function requireAdmin(event) {
  const need = !!process.env.NETLIFY_ADMIN_TOKEN;
  if (!need) return true;
  const got = event.headers["x-admin-token"];
  return got && got === process.env.NETLIFY_ADMIN_TOKEN;
}

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return { statusCode: 204, headers: CORS };

  try {
    if (event.httpMethod === "GET") {
      const raw = await store.get(KEY);
      const arr = raw ? JSON.parse(raw) : [];
      return ok(arr);
    }

    if (event.httpMethod === "POST") {
      if (!requireAdmin(event)) return bad(401, "Unauthorized");
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
