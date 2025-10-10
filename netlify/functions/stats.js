// /netlify/functions/stats.js
// Liefert gesammelte Statistiken zurück.
// Wenn NETLIFY_ADMIN_TOKEN gesetzt ist: erfordert Header "x-admin-token".

const blobs = require("@netlify/blobs");
const { NETLIFY_SITE_ID: SITE_ID, NETLIFY_AUTH_TOKEN: AUTH, NETLIFY_ADMIN_TOKEN: ADMIN } = process.env;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, x-admin-token",
};

const STORE = "analytics";
const KEY = "counters";

const ok = (b) => ({ statusCode: 200, headers: { ...CORS, "Content-Type":"application/json" }, body: JSON.stringify(b) });
const bad = (c,m) => ({ statusCode: c, headers: CORS, body: JSON.stringify({ error: m }) });

function requireAdmin(event){
  const need = !!ADMIN;
  if (!need) return true;
  const got = event.headers["x-admin-token"];
  return got && got === ADMIN;
}

function resolveStore() {
  if (!SITE_ID || !AUTH) throw new Error("Blobs not configured");
  const blobsLib = require("@netlify/blobs");
  if (typeof blobsLib.getStore === "function") {
    try { const st = blobsLib.getStore({ name: STORE, siteID: SITE_ID, token: AUTH }); if (st?.get && st?.set) return st; } catch {}
  }
  if (typeof blobsLib.getDeployStore === "function") {
    const cli = blobsLib.getDeployStore({ siteID: SITE_ID, token: AUTH });
    if (cli?.store){ const st2 = cli.store(STORE); if (st2?.get && st2?.set) return st2; }
    if (cli?.getStore){ const st3 = cli.getStore(STORE); if (st3?.get && st3?.set) return st3; }
  }
  if (typeof blobsLib.BlobsServer === "function") {
    const client = new blobsLib.BlobsServer({ siteID: SITE_ID, token: AUTH });
    if (client?.getStore){ const st = client.getStore(STORE); if (st?.get && st?.set) return st; }
    if (client?.store){ const st = client.store(STORE); if (st?.get && st?.set) return st; }
  }
  throw new Error("No compatible Blobs API");
}

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return { statusCode: 204, headers: CORS };
  if (!requireAdmin(event)) return bad(401, "Unauthorized");

  try {
    const store = resolveStore();
    const raw = await store.get(KEY);
    const data = raw ? JSON.parse(raw) : {};
    return ok(data);
  } catch (e){
    return bad(500, e.message || String(e));
  }
};
