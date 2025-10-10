// /netlify/functions/ads.js
// Robust: speichert Anzeigen in Netlify Blobs, Admin-Token optional,
// Felder: title, text, image, link, cta, positions[], active, start, end
// GET -> Liste, POST -> neu, PUT -> update, DELETE -> id oder alle

const blobs = require("@netlify/blobs");
const { NETLIFY_SITE_ID: SITE_ID, NETLIFY_AUTH_TOKEN: AUTH_TOKEN } = process.env;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, x-admin-token",
};

const STORE_NAME = "ads";
const KEY = "data";

const ok  = (b) => ({ statusCode: 200, headers: { ...CORS, "Content-Type":"application/json" }, body: JSON.stringify(b) });
const bad = (c,m) => ({ statusCode: c, headers: CORS, body: JSON.stringify({ error: m }) });

function requireAdmin(event){
  const need = !!process.env.NETLIFY_ADMIN_TOKEN; // wenn nicht gesetzt, ist POST/PUT/DELETE offen
  if (!need) return true;
  const got = event.headers["x-admin-token"];
  return got && got === process.env.NETLIFY_ADMIN_TOKEN;
}

function resolveStore() {
  if (!SITE_ID || !AUTH_TOKEN) throw new Error("Blobs not configured: missing NETLIFY_SITE_ID or NETLIFY_AUTH_TOKEN");

  // verschiedene SDK-Varianten abdecken
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

// Normalisiere/validiere Nutzdaten
function normAd(p = {}){
  const positions = Array.isArray(p.positions) ? p.positions.filter(Boolean) : [];
  return {
    id: typeof p.id === "string" && p.id ? p.id : makeId(),
    title: (p.title||"").trim(),
    text: (p.text||"").trim(),
    image: (p.image||"").trim(),
    link: (p.link||"").trim(),
    cta: (p.cta||"").trim(),
    positions,                // z.B. ["home_right_mid"]
    active: p.active !== false,
    start: p.start ? new Date(p.start).toISOString() : null,
    end:   p.end   ? new Date(p.end).toISOString()   : null,
    createdAt: p.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
}

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return { statusCode: 204, headers: CORS };

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
      if (!payload.title) return bad(400, "title fehlt");

      const raw = await store.get(KEY);
      const arr = raw ? JSON.parse(raw) : [];
      const ad = normAd(payload);
      arr.push(ad);
      await store.set(KEY, JSON.stringify(arr));
      return ok(ad);
    }

    if (event.httpMethod === "PUT") {
      if (!requireAdmin(event)) return bad(401, "Unauthorized");
      let payload; try { payload = JSON.parse(event.body || "{}"); } catch { return bad(400, "Invalid JSON"); }
      const id = payload.id;
      if (!id) return bad(400, "id fehlt");

      const raw = await store.get(KEY);
      const arr = raw ? JSON.parse(raw) : [];
      const idx = arr.findIndex(a => a.id === id);
      if (idx === -1) return bad(404, "Anzeige nicht gefunden");

      const merged = { ...arr[idx], ...payload };
      const fixed = normAd(merged);
      fixed.createdAt = arr[idx].createdAt || fixed.createdAt; // createdAt bewahren
      arr[idx] = fixed;

      await store.set(KEY, JSON.stringify(arr));
      return ok(arr[idx]);
    }

    if (event.httpMethod === "DELETE") {
      if (!requireAdmin(event)) return bad(401, "Unauthorized");

      const idFromQS = event.queryStringParameters && event.queryStringParameters.id;
      let idFromBody = null;
      try { idFromBody = JSON.parse(event.body||"{}").id; } catch {}
      const id = idFromQS || idFromBody;

      const raw = await store.get(KEY);
      const arr = raw ? JSON.parse(raw) : [];

      if (id) {
        const next = arr.filter(a => a.id !== id);
        await store.set(KEY, JSON.stringify(next));
        return ok(next);
      } else {
        await store.set(KEY, JSON.stringify([]));
        return ok([]);
      }
    }

    return bad(405, "Method Not Allowed");
  } catch (err) {
    console.error(err);
    return bad(500, String(err && err.message ? err.message : err));
  }
};
