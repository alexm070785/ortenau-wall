// netlify/functions/entries-update.js
import { getStore } from '@netlify/blobs';

/** Gemeinsame CORS-Header */
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,PATCH,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json', ...CORS },
  });

const empty = (status = 204) =>
  new Response(null, { status, headers: CORS });

export default async (req, context) => {
  // Preflight
  if (req.method === 'OPTIONS') return empty(204);

  // Auth: irgendein eingeloggter Identity-User reicht
  const token = context.clientContext?.identity?.token;
  if (!token) return json({ error: 'Unauthorized' }, 401);

  // id kommt jetzt als ?id=... (nicht mehr /:id)
  const { searchParams } = new URL(req.url);
  const id = (searchParams.get('id') || '').trim();
  if (!id) return json({ error: 'Missing id' }, 400);

  const store = getStore('entries');

  // Eintrag laden (neues API: get(..., { type: 'json' }))
  let entry = await store.get(id, { type: 'json' });
  if (!entry) return json({ error: 'Not found' }, 404);

  // Body lesen (kann leer sein)
  let body = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  // Aktionen: approve / reject ODER Felder (menuText, featured) patchen
  const now = new Date().toISOString();

  if (body.action === 'approve') {
    entry.status = 'approved';
    entry.approvedAt = now;
  } else if (body.action === 'reject') {
    entry.status = 'rejected';
    entry.rejectedAt = now;
  } else {
    if (typeof body.menuText === 'string') entry.menuText = body.menuText;
    if (typeof body.featured === 'boolean') entry.featured = body.featured;
    entry.updatedAt = now;
  }

  // Speichern (neues API: setJSON)
  await store.setJSON(id, entry);

  return json({ ok: true, id, status: entry.status });
};
