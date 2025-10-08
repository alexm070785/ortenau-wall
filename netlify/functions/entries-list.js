// netlify/functions/entries-list.js
import { getStore } from '@netlify/blobs';

export const config = { path: '/entries-list' }; // pretty route (optional)

const json = (b, init = {}) =>
  new Response(JSON.stringify(b), {
    ...init,
    headers: {
      'content-type': 'application/json',
      ...(init.headers || {}),
    },
  });

const ok = () => new Response(null, { status: 204, headers: cors() });
const fail = (code, body) => json(body, { status: code, headers: cors() });

const cors = () => ({
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'GET,POST,PATCH,OPTIONS',
});

// Kompatible JSON-Reader für alte/neue Blobs-Versionen
async function getJsonCompat(store, key) {
  if (typeof store.getJSON === 'function') {
    // v6+
    return await store.getJSON(key);
  }
  // v5 fallback
  const raw = await store.get(key);
  return raw ? JSON.parse(raw) : null;
}

export default async (req, context) => {
  try {
    if (req.method === 'OPTIONS') return ok();
    if (req.method !== 'GET') return fail(405, { error: 'Method not allowed' });

    const url = new URL(req.url);
    const status = (url.searchParams.get('status') || 'approved').toLowerCase();

    // Pending/Rejected nur für eingeloggte User (Netlify Identity)
    const protectedView = status === 'pending' || status === 'rejected';
    if (protectedView) {
      const { user } = context || {};
      if (!user) return fail(401, { error: 'Unauthorized' });
    }

    // Store holen
    let store;
    try {
      store = getStore('entries');
    } catch (e) {
      console.error('getStore(entries) failed:', e);
      return json([], { status: 200, headers: cors() }); // lieber leer als 500
    }

    // Blobs auflisten
    let keys = [];
    try {
      const listed = await store.list(); // { blobs: [{ key, ... }, ...] }
      keys = Array.isArray(listed?.blobs) ? listed.blobs.map((b) => b.key) : [];
    } catch (e) {
      console.error('store.list() failed:', e);
      return json([], { status: 200, headers: cors() });
    }

    // Items laden & filtern
    const out = [];
    for (const key of keys) {
      try {
        const item = await getJsonCompat(store, key);
        if (!item) continue;
        // ID mitgeben (wichtig für Admin-Buttons)
        if ((item.status || 'pending').toLowerCase() === status) {
          out.push({ id: key, ...item });
        }
      } catch (e) {
        console.error('JSON read failed for', key, e);
      }
    }

    // Neueste zuerst
    out.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));

    return json(out, { status: 200, headers: cors() });
  } catch (err) {
    console.error('entries-list TOP-LEVEL error:', err);
    return json([], { status: 200, headers: cors() });
  }
};
