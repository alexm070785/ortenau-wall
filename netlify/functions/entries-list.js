// netlify/functions/entries-list.js (DEBUG-VERSION)
import { getStore } from "@netlify/blobs";

export default async (req, context) => {
  const url = new URL(req.url);
  const status = url.searchParams.get("status") || "approved";
  const debug = url.searchParams.get("debug") === "1";

  const isAdmin = Boolean(context.clientContext?.identity?.token);
  if (!debug && (status === "pending" || status === "rejected") && !isAdmin) {
    return json(401, { error: "Unauthorized" });
  }

  const store = getStore("entries");
  const { blobs } = await store.list();
  const out = [];
  for (const b of blobs) {
    const item = await store.getJSON(b.key);
    if (!item) continue;
    if (debug || item.status === status) out.push(item);
  }
  out.sort((a,b)=>(b.createdAt||"").localeCompare(a.createdAt||""));
  return json(200, out);
};

const json = (s,b)=> new Response(JSON.stringify(b), {
  status:s, headers:{ "content-type":"application/json", "Access-Control-Allow-Origin":"*" }
});
