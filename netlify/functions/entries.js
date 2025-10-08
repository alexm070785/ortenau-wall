// /netlify/functions/entries.js
// CommonJS – robust gegenüber SDK-Unterschieden von @netlify/blobs

const blobs = require("@netlify/blobs"); // NICHT destrukturieren → kompatibler
const { NETLIFY_SITE_ID: SITE_ID, NETLIFY_AUTH_TOKEN: AUTH_TOKEN } = process.env;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,DELETE,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, x-admin-token",
};

const KEY = "data";
const STORE_NAME = "seiten";

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

function requireAdmin(event) {
  const need = !!process.env.NETLIFY_ADMIN_TOKEN;
  if (!need) return true;
  const got = event.headers["x-admin-token"];
  return got && got === process.env.NETLIFY_ADMIN_TOKEN;
}

// --- Ermittelt zur Laufzeit die passende Store-API für deine Blobs-Version
function resolveStore() {
  if (!SITE_ID || !AUTH_TOKEN) {
    throw new Error("Blobs not configured: missing NETLIFY_SITE_ID or NETLIFY_AUTH_TOKEN");
  }

  // 1) getStore({ name, siteID, token })
  if (typeof blobs.getStore === "function") {
    try {
      const st1 = blobs.getStore({ name: STORE_NAME, siteID: SITE_ID, token: AUTH_TOKEN });
      if (st1 && typeof st1.get === "function" && typeof st1.set === "function") return st1;
    } catch {}
    // 2) getStore("name", { siteID, token })
    try {
      const st2 = blobs.getStore(STORE_NAME, { siteID: SITE_ID, token: AUTH_TOKEN });
      if (st2 && typeof st2.get === "function" && typeof st2.set === "function") return st2;
    } catch {}
  }

  // 3) getDeployStore({ siteID, token, name })  ODER  getDeployStore(...).store/getStore
  if (typeof blobs.getDeployStore === "function") {
    try {
      // Variante A: direkt ein Store-Objekt
      const stA = blobs.getDeployStore({ siteID: SITE_ID, token: AUTH_TOKEN, name: STORE_NAME });
      if (stA && typeof stA.get === "function" && typeof stA.set === "function") return stA;

      // Variante B: ein Client mit .store() oder .getStore()
      const cli = blobs.getDeployStore({ siteID: SITE_ID, token: AUTH_TOKEN });
      if (cli) {
        if (typeof cli.store === "function") {
          const stB = cli.store(STORE_NAME);
          if (stB && typeof stB.get === "function" && typeof stB.set === "function") return stB;
        }
        if (typeof cli.getStore === "function") {
          const stC = cli.getStore(STORE_NAME);
          if (stC && typeof stC.get === "function" && typeof stC.set === "function") return stC;
        }
      }
    } catch {}
  }

  // 4) BlobsServer-Client (ältere/bestimmte Server-Builds)
  if (typeof blobs.BlobsServer === "function") {
    const client = new blobs.BlobsServer({ siteID: SITE_ID, token: AUTH_TOKEN });
    if (client) {
      if (typeof client.getStore === "function") {
        const stD = client.getStore(STORE_NAME);
        if (stD && typeof stD.get === "function" && typeof stD.set === "function") return stD;
      }
      if (typeof client.store === "function") {
        const stE = client.store(STORE_NAME);
        if (stE && typeof stE.get === "function" && typeof stE.set === "function") return stE;
      }
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
      exports: exportsList,
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
