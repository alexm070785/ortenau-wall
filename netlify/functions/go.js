// /netlify/functions/go.js
// Zählt Klicks & leitet weiter.
// /go?kind=entry|ad&id=ID&title=...&to=URL

const fetch = global.fetch || require("node-fetch");

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

const ok = (b) => ({ statusCode: 200, headers: { ...CORS, "Content-Type":"application/json" }, body: JSON.stringify(b) });
const redir = (to) => ({ statusCode: 302, headers: { Location: to, ...CORS } });

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return { statusCode: 204, headers: CORS };

  const q = event.queryStringParameters || {};
  const kind  = (q.kind||"").toLowerCase();
  const id    = (q.id||"").toString();
  const title = (q.title||"").toString();
  const to    = (q.to||"").toString();

  // nur http/https erlauben (oder relative)
  const isHttp = to.startsWith("/") || /^https?:\/\//i.test(to);
  const safeTo = isHttp ? to : "/";

  // fire & forget Tracking
  try {
    if (kind === "entry"){
      await fetch(process.env.URL + "/api/track", {
        method:"POST",
        headers: { "Content-Type":"application/json" },
        body: JSON.stringify({ event:"entry_click", id, title })
      });
    } else if (kind === "ad"){
      await fetch(process.env.URL + "/api/track", {
        method:"POST",
        headers: { "Content-Type":"application/json" },
        body: JSON.stringify({ event:"ad_click", id, title })
      });
    }
  } catch {}

  return redir(safeTo);
};
