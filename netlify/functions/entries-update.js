// netlify/functions/entries-update.js
import { getStore } from '@netlify/blobs';

const json = (b, init = {}) =>
  new Response(JSON.stringify(b), {
    ...init,
    headers: {
      'content-type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET,POST,PATCH,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      ...(init.headers || {}),
    },
  });

function hasBearer(req) {
  const h = req.headers.get('authorization') || '';
  return /^Bearer\s+[\w-]+\.[\w-]+\.[\w-]+$/.test(h);
}

function norm(u) {
  if (!u) return u;
  if (u.startsWith('http') || u.startsWith('/_blob/')) return u;
  return '/_blob/images/' + u.replace(/^\/+/, '');
}

export default async (req) => {
  // CORS preflight
  if (req.method === 'OPTIONS') return json(null, { status: 204 });

  // Admin-Zugriff nur mit Token
  if (!hasBearer(req)) return json({ error: 'Unauthorized' }, { status: 401 });

  try {
    if (req.method !== 'PATCH')
      return json({ error: 'Method not allowed' }, { status: 405 });

    const url = new URL(req.url);
    let id = url.pathname.split('/').pop();
    if (!id || id === 'entries-update') id = url.searchParams.get('id');
    if (!id) return json({ error: 'missing_id' }, { status: 400 });

    const body = await req.json();
    const store = getStore('entries');

    const raw = await store.get(id);
    if (!raw) return json({ error: 'not_found' }, { status: 404 });

    const item = JSON.parse(raw);

    // Aktionen
    if (body.action === 'approve') {
      item.status = 'approved';
      item.approvedAt = new Date().toISOString();
    } else if (body.action === 'reject') {
      item.status = 'rejected';
      item.rejectedAt = new Date().toISOString();
    } else {
      if (typeof body.menuText === 'string') item.menuText = body.menuText;
      if (typeof body.featured !== 'undefined') item.featured = !!body.featured;
      item.updatedAt = new Date().toISOString();
    }

    // Bildpfade korrigieren
    if (item.thumbUrl) item.thumbUrl = norm(item.thumbUrl);
    if (Array.isArray(item.images)) item.images = item.images.map(norm);

    await store.set(id, JSON.stringify(item));
    return json({ ok: true, id, item }, { status: 200 });
  } catch (e) {
    console.error('entries-update error', e);
    return json({ error: 'update_failed' }, { status: 500 });
  }
};

export const config = { path: '/entries-update' };
