// /netlify/functions/entries.js
// CommonJS – robust gegenüber SDK-Unterschieden von @netlify/blobs

const blobs = require("@netlify/blobs"); // nicht destrukturieren → kompatibler
const { NETLIFY_SITE_ID: SITE_ID, NETLIFY_AUTH_TOKEN: AUTH_TOKEN } = process.env;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,DELETE,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, x-admin-token",
};

const STORE_NAME = "seiten";
const KEY = "data";

const ok = (b) => ({ statusCode: 200, headers: { ...CORS, "Content-Type":"application/json" }, body: JSON.stringify(b) });
const bad = (c,m) => ({ statusCode: c, headers: CORS, body: JSON.stringify({ error: m }) });

function requireAdmin(event){
  const need = !!process.env.NETLIFY_ADMIN_TOKEN; // wenn nicht gesetzt, ist POST/DELETE offen
  if (!need) return true;
  const got = event.headers["x-admin-token"];
  return got && got === process.env.NETLIFY_ADMIN_TOKEN;
}

// passende Store-API je nach SDK ermitteln
function resolveStore() {
  if (!SITE_ID || !AUTH_TOKEN) {
    throw new Error("Blobs not configured: missing NETLIFY_SITE_ID or NETLIFY_AUTH_TOKEN");
  }

  // 1) getStore({ name, siteID, token })
  if (typeof blobs.getStore === "function") {
    try {
      const st1 = blobs.getStore({ name: STORE_NAME, siteID: SITE_ID, token: AUTH_TOKEN });
      if (st1?.get && st1?.set) return st1;
    } catch {}
    // 2) getStore("name", { siteID, token })
    try {
      const st2 = blobs.getStore(STORE_NAME, { siteID: SITE_ID, token: AUTH_TOKEN });
      if (st2?.get && st2?.set) return st2;
    } catch {}
  }

  // 3) getDeployStore – liefert teils Store direkt, teils Client
  if (typeof blobs.getDeployStore === "function") {
    try {
      const stA = blobs.getDeployStore({ siteID: SITE_ID, token: AUTH_TOKEN, name: STORE_NAME });
      if (stA?.get && stA?.set) return stA;
      const cli = blobs.getDeployStore({ siteID: SITE_ID, token: AUTH_TOKEN });
      if (cli?.store) {
        const stB = cli.store(STORE_NAME);
        if (stB?.get && stB?.set) return stB;
      }
      if (cli?.getStore) {
        const stC = cli.getStore(STORE_NAME);
        if (stC?.get && stC?.set) return stC;
      }
    } catch {}
  }

  // 4) BlobsServer-Client
  if (typeof blobs.BlobsServer === "function") {
    const client = new blobs.BlobsServer({ siteID: SITE_ID, token: AUTH_TOKEN });
    if (client?.getStore) {
      const stD = client.getStore(STORE_NAME);
      if (stD?.get && stD?.set) return stD;
    }
    if (client?.store) {
      const stE = client.store(STORE_NAME);
      if (stE?.get && stE?.set) return stE;
    }
  }

  throw new Error("No compatible Blobs API found in @netlify/blobs for this runtime");
}

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return { statusCode: 204, headers: CORS };

  // Debug: /api/entries?debug=1
  if (event.queryStringParameters && event.queryStringParameters.debug === "1") {
    const exportsList = Object.keys(require("@netlify/blobs") || {});
    return ok({
      envPresent: {
        NETLIFY_SITE_ID: !!SITE_ID,
        NETLIFY_AUTH_TOKEN: !!AUTH_TOKEN,
        NETLIFY_ADMIN_TOKEN: !!process.env.NETLIFY_ADMIN_TOKEN,
      },
      exports: exportsList
    });
  }

  let store;
  try {
    store = resolveStore();
  } catch (e) {
    return bad(500, e.message || String(e));
  }

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

      const { titel } = payload;
      if (!titel) return bad(400, "titel fehlt");

      const raw = await store.get(KEY);
      const arr = raw ? JSON.parse(raw) : [];

      // ALLES speichern (1:1), plus sichere Defaults/Systemfelder
      const full = {
        ...payload,
        kategorie: payload.kategorie || "restaurant",
        stadt: payload.stadt || payload?.adresse?.stadt || "",
        createdAt: new Date().toISOString()
      };

      arr.push(full);
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
