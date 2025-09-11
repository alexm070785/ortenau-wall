import { getStore } from @netlifyblobs;

export default async (req, context) = {
  if (req.method === OPTIONS) return ok();
  if (req.method !== PATCH) return json(405, { error Method not allowed });
  if (!context.clientContext.identity.token) return json(401, { error Unauthorized });

  const id = req.url.split().pop();
  const store = getStore(entries);
  const entry = await store.getJSON(id);
  if (!entry) return json(404, { error Not found });

  const body = await req.json().catch(() = ({}));
  if (body.action === approve) entry.status = approved;
  if (body.action === reject) entry.status = rejected;
  if (typeof body.menuText !== undefined) entry.menuText = body.menuText;
  if (typeof body.featured === boolean) entry.featured = body.featured;

  await store.setJSON(id, entry);
  return json(200, { ok true });
};

const ok = () = new Response(null, { status 204, headers cors() });
const json = (s, b) = new Response(JSON.stringify(b), { status s, headers { content-typeapplicationjson, ...cors() }});
const cors = () = ({
  Access-Control-Allow-Origin,
  Access-Control-Allow-HeadersContent-Type, Authorization,
  Access-Control-Allow-MethodsPATCH,OPTIONS
});
