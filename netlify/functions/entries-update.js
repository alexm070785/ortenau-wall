// netlify/functions/entries-update.js
import { getStore } from '@netlify/blobs';

// "Pretty" Route (funktioniert auch ohne, wenn du direkt /.netlify/functions/entries-update aufrufst)
export const config = { path: '/entries-update' };

const json = (b, init = {}) =>
  new Response(JSON.stringify(b), {
    ...init,
    headers: {
      'content-type': 'application/json',
      ...(init.headers || {})
    }
  });

// Bildpfade normalisieren (alte Dateinamen -> Netlify Blob-Pfad)
function norm(u) {
  if (!u) return u;
  if (u.startsWith('http') || u.startsWith('/_blob/')) return u;
  return '/_blob/images/' + u.replace(/^\/+/, '');
}

// Kompatible JSON-Getter/Setter (ältere vs. neuere Blobs-Versionen)
async function getJsonCompat(store, key) {
  if (typeof store.getJSON === 'function') {
    return await store.getJSON(key); // v6+
  }
  const raw = await store.get(key);
  return raw ? JSON.parse(raw) : null; // v5 Fallback
}

async function setJsonCompat(store, key, obj) {
  if (typeof store.setJSON === 'function') {
    return await store.setJSON(key, obj); // v6+
  }
  return await store.set(key, JSON.stringify(obj), {
    contentType: 'application/json'
  }); // v5 Fallback
}

export default async (req, context) => {
  // ---- Auth (Identity) nur für Admins ----
  try {
    const { user } = context;
    if (!user) return json({ error: 'Unauthorized' }, { status: 401 });
  } catch {
    return json({ error: 'Unauthorized' }, { status: 401 });
  }

  // ---- Nur PATCH erlauben ----
  if (req.method !== 'PATCH') {
    return json({ error: 'Method not allowed' }, { status: 405 });
  }

  try {
    const url = new URL(req.url);
    let id = url.searchParams.get('id');
    if (!id) return json({ error: 'missing_id' }, { status: 400 });

    const store = getStore('entries');

    // Datensatz laden
    const item = await getJsonCompat(store, id);
    if (!item) return json({ error: 'not_found' }, { status: 404 });

    // Body lesen
    const body = await req.json().catch(() => ({}));

    // --- Update-Logik ---
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

    // Bildpfade korrigieren (dauerhaft)
    if (item.thumbUrl) item.thumbUrl = norm(item.thumbUrl);
    if (Array.isArray(item.images)) item.images = item.images.map(norm);

    // Speichern
    await setJsonCompat(store, id, item);

    return json({ ok: true, id, item }, { status: 200 });
  } catch (e) {
    console.error('entries-update error', e);
    return json({ error: 'update_failed' }, { status: 500 });
  }
};
