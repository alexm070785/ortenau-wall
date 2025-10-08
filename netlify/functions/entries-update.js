import { getStore } from '@netlify/blobs';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'GET,POST,PATCH,OPTIONS',
};

const ok204 = { statusCode: 204, headers: CORS };
const json = (code, body) => ({
  statusCode: code,
  headers: { 'content-type': 'application/json', ...CORS },
  body: JSON.stringify(body),
});

// v5/v6 kompatibel lesen/schreiben
const getJsonCompat = async (store, key) => {
  if (typeof store.getJSON === 'function') return store.getJSON(key);
  return store.get(key, { type: 'json' });
};
const setJsonCompat = async (store, key, obj) => {
  if (typeof store.setJSON === 'function') return store.setJSON(key, obj);
  return store.set(key, JSON.stringify(obj), { contentType: 'application/json' });
};

export async function handler(event, context) {
  try {
    if (event.httpMethod === 'OPTIONS') return ok204;
    if (event.httpMethod !== 'PATCH') return json(405, { error: 'Method not allowed' });

    // Identity nötig
    const user = context?.clientContext?.user || null;
    if (!user) return json(401, { error: 'Unauthorized' });

    const id = event.queryStringParameters?.id;
    if (!id) return json(400, { error: 'Missing id' });

    let payload = {};
    try { payload = JSON.parse(event.body || '{}'); } catch {}

    const { action, menuText, featured } = payload;

    const store = getStore('entries');
    const item = await getJsonCompat(store, id);
    if (!item) return json(404, { error: 'Eintrag nicht gefunden' });

    if (action === 'approve') {
      item.status = 'approved';
      item.approvedAt = new Date().toISOString();
    } else if (action === 'reject') {
      item.status = 'rejected';
      item.rejectedAt = new Date().toISOString();
    } else {
      if (typeof menuText === 'string') item.menuText = menuText;
      if (typeof featured !== 'undefined') item.featured = !!featured;
      item.updatedAt = new Date().toISOString();
    }

    await setJsonCompat(store, id, item);
    return json(200, { ok: true, id, item });
  } catch (err) {
    console.error('entries-update error:', err);
    return json(500, { error: err?.message || 'Serverfehler' });
  }
}
