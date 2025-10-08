// netlify/functions/entries-list.mjs
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

export async function handler(event, context) {
  try {
    if (event.httpMethod === 'OPTIONS') return ok204;
    if (event.httpMethod !== 'GET') return json(405, { error: 'Method not allowed' });

    const url = new URL(event.rawUrl);
    const statusParam = (url.searchParams.get('status') || 'approved').toLowerCase();
    const status = ['approved', 'pending', 'rejected', 'all'].includes(statusParam)
      ? statusParam
      : 'approved';

    // Nur "approved" ist öffentlich – alles andere erfordert Identity
    const user = context?.clientContext?.user || null;
    const needsAuth = status !== 'approved';
    if (needsAuth && !user) return json(401, { error: 'Unauthorized' });

    const store = getStore('entries');

    // v5/v6-kompatibles JSON-Lesen
    const getJsonCompat = async (key) => {
      if (typeof store.getJSON === 'function') return store.getJSON(key);   // v6+
      return store.get(key, { type: 'json' });                               // v5
    };

    const listed = await store.list(); // { blobs: [...] }
    const keys = Array.isArray(listed?.blobs) ? listed.blobs.map(b => b.key) : [];

    const out = [];
    for (const key of keys) {
      try {
        const item = await getJsonCompat(key);
        if (!item) continue;

        if (
          status === 'all' ||
          (item.status || 'pending').toLowerCase() === status
        ) {
          out.push({ id: key, ...item });
        }
      } catch (e) {
        console.error('read failed', key, e);
      }
    }

    // Neueste zuerst
    out.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));

    return json(200, out);
  } catch (err) {
    console.error('entries-list error', err);
    return json(200, []); // lieber leer als 500
  }
}
