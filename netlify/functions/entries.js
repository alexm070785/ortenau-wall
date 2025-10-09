// /netlify/functions/entries.js
// CommonJS – robust gegenüber SDK-Unterschieden von @netlify/blobs,
// speichert kompletter Payload, vergibt id, unterstützt GET/POST/PUT/DELETE.

const blobs = require("@netlify/blobs");
const { NETLIFY_SITE_ID: SITE_ID, NETLIFY_AUTH_TOKEN: AUTH_TOKEN } = process.env;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, x-admin-token",
};

const STORE_NAME = "seiten";
const KEY = "data";

const ok = (b) => ({ statusCode: 200, headers: { ...CORS, "Content-Type":"application/json" }, body: JSON.stringify(b) });
const bad = (c,m) => ({ statusCode: c, headers: CORS, body: JSON.stringify({ error: m }) });

function requireAdmin(event){
  const need = !!process.env.NETLIFY_ADMIN_TOKEN; // wenn nicht gesetzt, ist POST/PUT/DELETE offen
  if (!need) return true;
  const got = event.headers["x-admin-token"];
  return got && got === process.env.NETLIFY_ADMIN_TOKEN;
}

function resolveStore() {
  if (!SITE_ID || !AUTH_TOKEN) throw new Error("Blobs not configured: missing NETLIFY_SITE_ID or NETLIFY_AUTH_TOKEN");

  if (typeof blobs.getStore === "function") {
    try { const st = blobs.getStore({ name: STORE_NAME, siteID: SITE_ID, token: AUTH_TOKEN }); if (st?.get && st?.set) return st; } catch {}
    try { const st = blobs.getStore(STORE_NAME, { siteID: SITE_ID, token: AUTH_TOKEN }); if (st?.get && st?.set) return st; } catch {}
  }
  if (typeof blobs.getDeployStore === "function") {
    try {
      const st = blobs.getDeployStore({ siteID: SITE_ID, token: AUTH_TOKEN, name: STORE_NAME }); if (st?.get && st?.set) return st;
      const cli = blobs.getDeployStore({ siteID: SITE_ID, token: AUTH_TOKEN });
      if (cli?.store){ const st2 = cli.store(STORE_NAME); if (st2?.get && st2?.set) return st2; }
      if (cli?.getStore){ const st3 = cli.getStore(STORE_NAME); if (st3?.get && st3?.set) return st3; }
    } catch {}
  }
  if (typeof blobs.BlobsServer === "function") {
    const client = new blobs.BlobsServer({ siteID: SITE_ID, token: AUTH_TOKEN });
    if (client?.getStore){ const st = client.getStore(STORE_NAME); if (st?.get && st?.set) return st; }
    if (client?.store){ const st = client.store(STORE_NAME); if (st?.get && st?.set) return st; }
  }
  throw new Error("No compatible Blobs API found in @netlify/blobs for this runtime");
}

function makeId(){ return (Date.now().toString(36) + Math.random().toString(36).slice(2,8)).toLowerCase(); }

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return { statusCode: 204, headers: CORS };

  if (event.queryStringParameters && event.queryStringParameters.debug === "1") {
    const exportsList = Object.keys(require("@netlify/blobs") || {});
    return ok({ envPresent: { NETLIFY_SITE_ID: !!SITE_ID, NETLIFY_AUTH_TOKEN: !!AUTH_TOKEN, NETLIFY_ADMIN_TOKEN: !!process.env.NETLIFY_ADMIN_TOKEN }, exports: exportsList });
  }

  let store;
  try { store = resolveStore(); } catch (e) { return bad(500, e.message || String(e)); }

  try {
    if (event.httpMethod === "GET") {
      const raw = await store.get(KEY);
      return ok(raw ? JSON.parse(raw) : []);
    }

    if (event.httpMethod === "POST") {
      if (!requireAdmin(event)) return bad(401, "Unauthorized");
      let payload; try { payload = JSON.parse(event.body || "{}"); } catch { return bad(400, "Invalid JSON"); }
      if (!payload.titel) return bad(400, "titel fehlt");

      const raw = await store.get(KEY);
      const arr = raw ? JSON.parse(raw) : [];
      const id = payload.id && typeof payload.id === "string" ? payload.id : makeId();

      const full = {
        ...payload,
        id,
        kategorie: payload.kategorie || "restaurant",
        stadt: payload.stadt || payload?.adresse?.stadt || "",
        createdAt: new Date().toISOString()
      };
      arr.push(full);
      await store.set(KEY, JSON.stringify(arr));
      return ok(arr);
    }

    if (event.httpMethod === "PUT") {
      if (!requireAdmin(event)) return bad(401, "Unauthorized");
      let payload; try { payload = JSON.parse(event.body || "{}"); } catch { return bad(400, "Invalid JSON"); }
      const id = payload.id;
      if (!id) return bad(400, "id fehlt");
      const raw = await store.get(KEY);
      const arr = raw ? JSON.parse(raw) : [];
      const idx = arr.findIndex(e => e.id === id);
      if (idx === -1) return bad(404, "Eintrag nicht gefunden");

      const merged = {
        ...arr[idx],
        ...payload,
        id, // id bleibt
        stadt: payload.stadt || payload?.adresse?.stadt || arr[idx].stadt || "",
        updatedAt: new Date().toISOString()
      };
      arr[idx] = merged;
      await store.set(KEY, JSON.stringify(arr));
      return ok(arr[idx]);
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
