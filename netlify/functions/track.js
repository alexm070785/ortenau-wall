// /netlify/functions/track.js
// Nimmt Events entgegen und zählt hoch (aggregiert).
// event: "page" | "search" | "entry_click" | "ad_click"

const blobs = require("@netlify/blobs");
const { NETLIFY_SITE_ID: SITE_ID, NETLIFY_AUTH_TOKEN: AUTH } = process.env;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

const STORE = "analytics";
const KEY = "counters";

const ok = (b) => ({ statusCode: 200, headers: { ...CORS, "Content-Type":"application/json" }, body: JSON.stringify(b||{ok:true}) });
const bad = (c,m) => ({ statusCode: c, headers: CORS, body: JSON.stringify({ error: m }) });

function resolveStore() {
  if (!SITE_ID || !AUTH) throw new Error("Blobs not configured");
  if (typeof blobs.getStore === "function") {
    try { const st = blobs.getStore({ name: STORE, siteID: SITE_ID, token: AUTH }); if (st?.get && st?.set) return st; } catch {}
    try { const st = blobs.getStore(STORE, { siteID: SITE_ID, token: AUTH }); if (st?.get && st?.set) return st; } catch {}
  }
  if (typeof blobs.getDeployStore === "function") {
    const cli = blobs.getDeployStore({ siteID: SITE_ID, token: AUTH });
    if (cli?.store){ const st2 = cli.store(STORE); if (st2?.get && st2?.set) return st2; }
    if (cli?.getStore){ const st3 = cli.getStore(STORE); if (st3?.get && st3?.set) return st3; }
  }
  if (typeof blobs.BlobsServer === "function") {
    const client = new blobs.BlobsServer({ siteID: SITE_ID, token: AUTH });
    if (client?.getStore){ const st = client.getStore(STORE); if (st?.get && st?.set) return st; }
    if (client?.store){ const st = client.store(STORE); if (st?.get && st?.set) return st; }
  }
  throw new Error("No compatible Blobs API");
}

function inc(obj, path, by=1){
  const parts = Array.isArray(path)? path : String(path).split(".");
  let ref = obj;
  for (let i=0;i<parts.length-1;i++){
    const k = parts[i]; if (!ref[k] || typeof ref[k] !== "object") ref[k] = {};
    ref = ref[k];
  }
  const last = parts[parts.length-1];
  ref[last] = (ref[last]||0) + by;
}

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return { statusCode: 204, headers: CORS };
  if (event.httpMethod !== "POST") return bad(405, "POST only");

  let store;
  try { store = resolveStore(); } catch(e){ return bad(500, e.message || String(e)); }

  let p;
  try { p = JSON.parse(event.body||"{}"); } catch { return bad(400, "Invalid JSON"); }

  const type = (p.event||"").toString();
  if (!type) return bad(400, "event required");

  const today = new Date().toISOString().slice(0,10); // YYYY-MM-DD

  try {
    const raw = await store.get(KEY);
    const data = raw ? JSON.parse(raw) : {
      totals: { pageViews: 0, searches: 0, entryClicks: 0, adClicks: 0 },
      byPath: {},          // { "/": 123, "/details": 77, ... }
      searches: {},        // { "doener": 12, ... } (normalisiert)
      entries: {},         // { id: { title, clicks } }
      ads: {},             // { id: { title, clicks } }
      perDay: { pageViews:{}, searches:{} } // YYYY-MM-DD : count
    };

    if (type === "page") {
      const path = (p.path||"/").split("?")[0].slice(0,200);
      data.totals.pageViews++;
      inc(data.byPath, [path]);
      inc(data.perDay.pageViews, [today]);
    }

    if (type === "search") {
      const term = (p.term||"").toString().trim().toLowerCase().slice(0,80);
      if (term.length >= 2){
        data.totals.searches++;
        inc(data.searches, [term]);
        inc(data.perDay.searches, [today]);
      }
    }

    if (type === "entry_click") {
      const id = (p.id||"").toString().slice(0,80);
      const title = (p.title||"").toString().slice(0,150);
      if (id){
        data.totals.entryClicks++;
        if (!data.entries[id]) data.entries[id] = { title, clicks:0 };
        data.entries[id].title = title || data.entries[id].title; // aktualisieren falls leer
        data.entries[id].clicks++;
      }
    }

    if (type === "ad_click") {
      const id = (p.id||"").toString().slice(0,80);
      const title = (p.title||"").toString().slice(0,150);
      if (id){
        data.totals.adClicks++;
        if (!data.ads[id]) data.ads[id] = { title, clicks:0 };
        data.ads[id].title = title || data.ads[id].title;
        data.ads[id].clicks++;
      }
    }

    await store.set(KEY, JSON.stringify(data));
    return ok({ ok:true });
  } catch (e){
    console.error(e);
    return bad(500, e.message || String(e));
  }
};
